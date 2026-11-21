// Pip: movement, jump, sword chain, dash-roll, hurt (simulation). Body construction + render animation live in
// player-body.js; dust, splashes, the pad sprint toggle and the stuck warp in the wp3-player-fx module (player-fx.js).
// The player never reads input or the camera: Game.step hands it an intent built from this frame's look (arch §7.1).
//   intent = { mx, mz, ml (world wish, |m| ≤ 1), lookYaw, lookPitch, mode: 'fp'|'tp', attack, dash, jump (press edges),
//              jumpHeld, sprint (roll button held), sprintToggle (pad L3 latch, wp3-player-fx), faceYaw / facePitch (TP
//              sword aim or null), bodyYaw (TP held body yaw or null), bodyShown (camera out of the head) }
// Facing: FP = look yaw every step (strafe/backpedal; eased while the body is still on screen); TP = turn toward
// movement, or face intent.bodyYaw while a module holds it (lock-on: the body faces the target, movement strafes).
// Both snap to the aim on attack.
// Movement (TUNE.move, RULINGS §1): run 4.4 m/s × direction (strafe 0.95, backpedal 0.80 of the look / lock forward;
// TP explore turns to move so 1.0), wading × 0.62, sprint 5.8 while the roll button stays held after a roll (or pad
// L3), vector acceleration 38 / 30 m/s². Jump: v0 6.12, gravity 22 rising / 32 falling, release while rising halves
// vy once, coyote 0.10 s, buffer 0.12 s, air acceleration 14 toward the wish with momentum kept, air cap 6.2. Airborne
// motion keeps the walkability gate and every wall (phys.moveCircle): a jump never reaches anywhere a walk can't,
// except the tops of stumps and low rocks. Ground contact: step up ≤ 0.35, snap down ≤ 0.35 per step, deeper is a fall.
// Sword: a 3-hit chain A → B → C (feel §8.1, numbers in TUNE.combat). Pip keeps moving at 55 % while swinging.
import * as THREE from 'three';
import { G } from './core.js';
import { CFG } from './data.js';
import { moveCircle, penetration, headroom } from './phys.js';
import { dampAngle, angDiff, fwdXZ, lerp, smoothstep } from './util.js';
import { combat as TC, move as TM } from './tune.js';
import { buildBody, PlayerBody } from './player-body.js';
import { EV } from './events.js';

const emit = (type, payload) => { if (G.events) G.events.emit(type, payload); };
const NO_WISH = { x: 0, z: 0, l: 0 };
const D2R = Math.PI / 180;
const _gf = { on: null }, _tv = { x: 0, z: 0 };

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.facing = Math.PI; // body yaw (facing convention); π looks north
    this.prevFacing = this.facing;
    this.state = 'normal';
    this.t = 0;
    this.attackT = 0; this.attackBuffer = 0; this.dashBuffer = 0; this.jumpBuffer = 0; this.dashCD = 0;
    this.iframes = 0; this.hurtT = 0; this.swingId = 0;
    this.combo = 'A'; this.swingDur = TC.swingAB; // current / last swing of the chain
    this.chainT = 9;                 // time since the last swing ended (> chainGap: the chain lapsed, next is A)
    this.restT = 0;                  // after C: no new swing until it runs out
    // the current swing's aim (TP latches it: swingLatch) and start point (sweep bearings are measured from it)
    this.swingYaw = this.facing; this.swingPitch = 0; this.swingLatch = false; this.swingX = 0; this.swingZ = 0;
    this.dashDir = new THREE.Vector2();
    this.walkPhase = 0; this.stepIdx = 0; this.foot = 'R';
    this.squash = 0; this.flash = 0;
    this.frozen = false;
    this.wading = false;
    this.r = CFG.playerR;
    // vertical (contract C2): vy, grounded, alt (getter), sprint; EV.JUMP / EV.LAND
    this.vy = 0; this.grounded = true; this.jumpHeld = false; this.sprint = false;
    this.coyoteT = 0; this.airT = 0; this.jumping = false; this.cutDone = false; this.airCap = TM.airCap;
    this.groundY = 0; this.standOn = null; this.surface = 'grass'; this.landImpact = 0;
    this.hopY = null;                // feet y at a knockback hop's take-off (TP only; its touchdown is no EV.LAND)
    this.bodyShown = false;          // intent.bodyShown of the last step (the camera is out of Pip's head)
    this.sprintMode = null; this.sprintRef = 0; this.sprintEnd = null; this.sprintToggleOff = false; this.sprintOutT = 0;
    // stuck recovery: the last grounded, walkable, clear spot (refreshed every safeEvery s); stuck after unstickAfter s
    this.lastSafe = { x: 0, y: 0, z: 0 }; this.safeT = 0; this.unsafeT = 0; this.stuck = false;
    this._sim = new THREE.Vector3(NaN, NaN, NaN);   // pos at the end of the last step (an external move re-seats Pip)
    this._mv = { r: this.r, extra: null, arena: null, feetY: 0, grounded: true, step: TM.stepUp, slide: true };
    this.hurtDir = { x: 0, z: 1 };   // unit vector from Pip toward the last damage source
    this.blinkOff = false;           // i-frame blink (render); the view hides the body instead of root.visible
    this.mode = 'fp';

    buildBody(this, scene);
    this.setSword(1);
  }

  setSword(level) {
    this.swordLevel = level;
    this.swords[0].visible = level < 2;
    this.swords[1].visible = level >= 2;
    this.reach = level >= 2 ? CFG.reachShiny : CFG.reachWood;
    this.trail.setReach(this.reach, level >= 2);
  }
  place(x, z, facing = Math.PI) {
    this.pos.set(x, G.world.ground(x, z), z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0);
    this.facing = this.prevFacing = facing;
    this.state = 'normal';
    this.attackT = 0; this.iframes = 0; this.hurtT = 0; this.dashCD = 0;
    this.combo = 'A'; this.chainT = 9; this.restT = 0;
    this.vy = 0; this.grounded = true; this.blinkOff = false;
    this.autoMove = null;            // a boss intro cut short (Save & Quit, respawn) never walks Pip later
    this.root.visible = true;
    this.spin.rotation.set(0, 0, 0);
    this.resync();
  }
  /** move Pip to a spot as a cut (stuck recovery, scripted placements): standing, still, nothing carried over */
  warp(x, z) {
    this.pos.set(x, G.world.ground(x, z), z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0);
    if (this.state === 'dash' || this.state === 'attack' || this.state === 'hurt') this.state = 'normal';
    this.resync();
  }
  /** after an external move (teleport, place, warp): stand on the ground there, drop vertical motion, restart the
   *  safe-spot bookkeeping */
  resync() {
    const W = G.world, p = this.pos;
    if (!W) return;
    const g = this.groundAt(p.x, p.z, p.y + 0.05);
    if (p.y <= g + 0.06) { p.y = g; this.grounded = true; this.groundY = g; } else { this.grounded = false; this.groundY = g; }
    this.vy = 0; this.jumping = false; this.coyoteT = 0; this.airT = 0; this.unsafeT = 0; this.safeT = 0; this.stuck = false;
    this.sprint = false; this.sprintMode = null; this.hopY = null;
    if (W.walkable(p.x, p.z)) { this.lastSafe.x = p.x; this.lastSafe.y = p.y; this.lastSafe.z = p.z; }
    this.prev.y = p.y;
    this._sim.copy(p);
  }
  /** body yaw write for other modules (TP item-get / talk / debug); in FP the next step resets it to the look */
  turnTo(yaw) { this.facing = this.prevFacing = yaw; }
  /** C2: metres of the feet above the ground under Pip (0 while grounded) */
  get alt() { return this.grounded ? 0 : Math.max(0, this.pos.y - this.groundY); }
  /** blob shadow (render): on the ground under the interpolated feet (a deck only from above, a standable top once
   *  Pip stands on it: W.groundFor), so it stays down during a jump; game.render adds it only with the camera out of
   *  Pip's head */
  blob(out) {
    const p = this.root.position;
    out.x = p.x; out.y = Math.max(G.world.groundFor(p.x, p.z, p.y), -0.25); out.z = p.z; out.r = 0.38;
    return out;
  }
  // state is an accessor so every way out of a dash (timer, boss trigger, item-get, cutscene, place) emits DASH_END once
  get state() { return this._state; }
  set state(s) { const was = this._state; this._state = s; if (was === 'dash' && s !== 'dash') emit(EV.DASH_END, {}); }
  get attacking() { return this.state === 'attack'; }
  /** inside this swing's hit window (A/B 36–186 ms, C 80–200 ms) */
  get attackActive() { const w = this.combo === 'C' ? TC.winC : TC.winAB; return this.state === 'attack' && this.attackT > w[0] && this.attackT < w[1]; }
  get invulnerable() { return this.iframes > 0 || this.state === 'dash' || this.state === 'dizzy'; }

  /** ground for the feet here: terrain / one-way deck / standable top (W.groundFor); water is waded at −0.25 */
  groundAt(x, z, feetY) {
    const g = G.world.groundFor(x, z, feetY, true, _gf);
    this._on = _gf.on;
    this._wade = g < -0.08 && _gf.on !== 'deck';
    return this._wade ? Math.max(g, -0.25) : g;
  }

  /** fixed step; intent from Game.buildIntent (never reads input or the camera) */
  update(dt, intent, canAct) {
    const p = this.pos;
    if (p.x !== this._sim.x || p.y !== this._sim.y || p.z !== this._sim.z) this.resync();
    this.prev.copy(p);
    this.prevFacing = this.facing;
    this.t += dt;
    if (this.state !== 'attack') this.chainT += dt;
    this.restT = Math.max(0, this.restT - dt);
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyoteT = Math.max(0, this.coyoteT - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.squash *= Math.exp(-10 * dt);
    const W = G.world;
    const fp = (this.mode = intent.mode) === 'fp';
    this.bodyShown = !!intent.bodyShown;
    let wish = NO_WISH;
    if (canAct && !this.frozen) {
      wish = { x: intent.mx, z: intent.mz, l: intent.ml };
      if (intent.attack) this.attackBuffer = TC.buffer;
      if (intent.dash) this.dashBuffer = 0.12;
      if (intent.jump) this.jumpBuffer = TM.buffer;
    } else { this.attackBuffer = 0; this.dashBuffer = 0; this.jumpBuffer = 0; }
    // variable height: letting go while rising halves vy, once per jump
    const held = !!intent.jumpHeld && canAct;
    if (this.jumping && !this.grounded && this.vy > 0 && !held && !this.cutDone) { this.vy *= TM.cutK; this.cutDone = true; }
    this.jumpHeld = held;
    // FP: the body faces the look (the camera shows its shadow); while the camera is still out of the head (TP→FP
    // blend, shots) it turns there instead of snapping. Auto-walks and dizzy keep their own facing
    if (fp && this.state !== 'dizzy' && !(this.state === 'frozen' && this.autoMove)) {
      if (intent.bodyShown) this.facing = dampAngle(this.facing, intent.lookYaw, 12, dt);
      else this.facing = this.prevFacing = intent.lookYaw;
    }
    // state transitions: dash cancels a swing from dashCancel; a buffered press chains A → B → C from chainAt (C: only
    // after its recovery + cRest). No roll in the air (it waits in the buffer for the landing)
    const atk = this.state === 'attack', footing = this.grounded || this.coyoteT > 0;
    if (this.state === 'normal' || (atk && this.attackT >= TC.dashCancel)) {
      if (this.dashBuffer > 0 && this.dashCD <= 0 && footing) this.startDash(wish, intent);
      else if (this.attackBuffer > 0 && this.restT <= 0 && (!atk || (this.combo !== 'C' && this.attackT >= TC.chainAt))) this.startAttack(wish, intent);
    }
    this.updateSprint(wish, intent, dt);
    // jump: from the ground or within coyote time; cancels a swing's tail or a roll's start
    if (this.jumpBuffer > 0 && footing && this.canJump()) this.jump();
    const air = !this.grounded;
    switch (this.state) {
      case 'normal': {
        this.targetVel(wish, intent, fp, 1);
        // TP: a held body yaw (lock-on) faces it and the wish strafes; otherwise turn-to-move
        if (!fp && intent.bodyYaw != null) this.facing = dampAngle(this.facing, intent.bodyYaw, 12, dt);
        else if (!fp && wish.l > 0.12) this.facing = dampAngle(this.facing, Math.atan2(wish.x, wish.z), 12, dt);
        if (this.grounded) this.accel(_tv.x, _tv.z, (wish.l > 0.05 ? TM.accel : TM.decel) * dt);
        else this.airMove(_tv.x, _tv.z, wish.l > 0.05, dt);
        break;
      }
      case 'attack': {
        this.attackT += dt;
        // keep moving at 55 % (facing holds the aim): along the swing the lunge decays at λ lungeK down to the wish; across
        // it (strafing) and below the wish the usual acceleration applies. In the air: air control at 55 %
        this.targetVel(wish, intent, fp, TC.moveK);
        const tvx = _tv.x, tvz = _tv.z;
        if (!this.grounded) this.airMove(tvx, tvz, wish.l > 0.05, dt);
        else {
          const f = fwdXZ(this.facing), acc = (wish.l > 0.05 ? TM.accel : TM.decel) * dt;
          let va = this.vel.x * f.x + this.vel.y * f.z;
          const ta = tvx * f.x + tvz * f.z;
          let cx = this.vel.x - f.x * va, cz = this.vel.y - f.z * va, dx = tvx - f.x * ta - cx, dz = tvz - f.z * ta - cz;
          const l = Math.hypot(dx, dz);
          if (l > acc) { dx *= acc / l; dz *= acc / l; }
          cx += dx; cz += dz;
          va = va > ta ? ta + (va - ta) * Math.exp(-TC.lungeK * dt) : Math.min(ta, va + acc);
          this.vel.set(cx + f.x * va, cz + f.z * va);
        }
        if (this.attackT >= this.swingDur) this.endChainSwing();
        break;
      }
      case 'dash': {
        this.dashT += dt;
        const k = this.dashT / CFG.dashTime;
        const sp = CFG.dashSpeed * (1 - k * 0.45) * (this.wading ? TM.wadeK : 1) * (this.backstep ? 0.7 : 1);
        this.vel.set(this.dashDir.x * sp, this.dashDir.y * sp);
        if (this.dashT >= CFG.dashTime) {
          this.state = 'normal'; this.squash = 1;
          // still holding the roll button: run on as a sprint, else the ×0.45 brake
          if (intent.sprint && canAct && wish.l >= TM.sprintMinWish && !this.wading && !this.backstep) {
            this.startSprint('hold', intent, wish);
            this.vel.set(this.dashDir.x * TM.sprint, this.dashDir.y * TM.sprint);
          } else this.vel.multiplyScalar(0.45);
        }
        break;
      }
      case 'hurt': {
        this.hurtT -= dt;
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        if (this.hurtT <= 0) this.state = 'normal';
        break;
      }
      case 'dizzy': case 'frozen': case 'item': {
        if (this.autoMove && this.state === 'frozen') {
          this.vel.set(this.autoMove.x, this.autoMove.z);
          this.facing = dampAngle(this.facing, this.autoMove.face ?? Math.atan2(this.autoMove.x, this.autoMove.z), 12, dt);   // face: a step back
        } else this.vel.multiplyScalar(Math.exp(-12 * dt));
        break;
      }
    }
    this.integrate(dt, W);
    // the jump buffer (feel T16: a press ≤ 0.12 s before touchdown) jumps on the touchdown step itself: the test above
    // ran while Pip was still in the air, and the next step's would come a step late and with 1/60 s less buffer
    if (air && this.grounded && this.jumpBuffer > 0 && this.canJump()) this.jump();
    this.footsteps(dt);
    this.safety(dt, W);
    this._sim.copy(this.pos);
  }

  /** horizontal move with collision, then gravity, ground contact, falls and landings (arch §7.2 order) */
  integrate(dt, W) {
    const p = this.pos, y0 = p.y, mv = this._mv;
    mv.r = this.r; mv.extra = G.game ? G.game.dynamicColliders(this) : null;
    mv.arena = G.game && G.game.fight && G.game.fight.phase !== 'won' ? G.game.fight.arenaClamp : null;
    mv.feetY = y0; mv.grounded = this.grounded; mv.step = TM.stepUp; mv.on = this.standOn && this.standOn !== 'deck' ? this.standOn : null;
    const x0 = p.x, z0 = p.z;
    if (moveCircle(W, this, this.vel.x * dt, this.vel.y * dt, mv) && this.state !== 'dash') {
      // a wall took part of the move: the velocity becomes what actually happened (sliding speed, no running in place;
      // never more than it was, so a shove from a moving NPC or boss doesn't launch Pip)
      let ax = (p.x - x0) / dt, az = (p.z - z0) / dt;
      const al = Math.hypot(ax, az), vl = this.vel.length();
      if (al > vl && al > 1e-9) { ax *= vl / al; az *= vl / al; }
      this.vel.set(ax, az);
    }
    if (this.grounded) {
      const g = this.groundAt(p.x, p.z, y0);
      if (y0 - g > TM.stepDown) {
        // walked off an edge deeper than a step: fall (coyote time to still jump)
        this.grounded = false; this.vy = 0; this.jumping = false; this.coyoteT = TM.coyote; this.airT = 0; this.standOn = null;
        this.airCap = Math.min(TM.airCap, Math.max(this.vel.length(), TM.run));
        this.fall(dt, W, y0);
      } else {
        p.y = g; this.groundY = g; this.standOn = this._on; this.wading = this._wade;
      }
    } else this.fall(dt, W, y0);
  }
  /** one airborne step: gravity 22 rising / 32 falling (exact within the step, split at the apex), then land */
  fall(dt, W, y0) {
    const p = this.pos;
    this.airT += dt;
    let vy = this.vy, y = y0;
    if (vy > 0) {
      const ta = vy / TM.gUp;
      if (ta >= dt) { y += vy * dt - 0.5 * TM.gUp * dt * dt; vy -= TM.gUp * dt; }
      else { const rest = dt - ta; y += vy * ta - 0.5 * TM.gUp * ta * ta - 0.5 * TM.gFall * rest * rest; vy = -TM.gFall * rest; }
    } else { y += vy * dt - 0.5 * TM.gFall * dt * dt; vy -= TM.gFall * dt; }
    if (vy < -TM.termV) vy = -TM.termV;
    // an overhead part above (the shop counter): the head stops at its underside and the jump turns into a fall
    if (y > y0) { const top = headroom(W, p.x, p.z, this.r, y0); if (y > top) { y = Math.max(y0, top); if (vy > 0) { vy = 0; this.cutDone = true; } } }
    // the start height decides one-way surfaces (a deck or a top the feet were above stays solid at any fall speed)
    const g = this.groundAt(p.x, p.z, Math.max(y0, y));
    this.groundY = g;
    if (y <= g && vy <= 0) {
      p.y = g;
      const impact = Math.max(0, -vy);
      // a knockback hop (TP) back down on its own level is no landing (C2 consumers: spring, sound, dust); one that
      // carried Pip off a ledge (lower than a step) is
      const hop = this.hopY != null && g >= this.hopY - TM.stepDown;
      this.vy = 0; this.grounded = true; this.jumping = false; this.coyoteT = 0; this.hopY = null;
      this.standOn = this._on; this.wading = this._wade;
      this.landImpact = impact;
      if (impact > 2) this.squash = Math.min(1, 0.25 + impact / 10);
      this.surface = this.surfaceHere();
      if (!hop) emit(EV.LAND, { impact: +impact.toFixed(3), surface: this.surface });
    } else if (y <= g) { p.y = g; this.vy = vy; }   // rising past a slope or a top's dome: carried up, still rising
    else { p.y = y; this.vy = vy; }
  }
  /** may a jump start in this state (footing aside): normal, a swing's tail (attackJump), a roll's start (dashJump) */
  canJump() { return this.state === 'normal' || (this.state === 'attack' && this.attackT >= TM.attackJump) || (this.state === 'dash' && this.dashT <= TM.dashJump); }
  jump() {
    if (this.state === 'attack') this.endChainSwing(true);
    else if (this.state === 'dash') this.state = 'normal';
    this.vy = TM.jumpV * (this.wading ? TM.wadeJumpK : 1);
    this.grounded = false; this.jumping = true; this.cutDone = false; this.coyoteT = 0; this.jumpBuffer = 0; this.airT = 0; this.hopY = null;
    const sp = this.vel.length();
    this.airCap = Math.min(TM.airCap, Math.max(sp, TM.run));
    if (sp > this.airCap) this.vel.multiplyScalar(this.airCap / sp);
    this.standOn = null;
    emit(EV.JUMP, {});
  }
  /** a swing ran to its end (or a jump cut its tail): the chain stays live for chainGap; C rests */
  endChainSwing(cut = false) {
    this.state = 'normal';
    this.chainT = 0;
    if (this.combo === 'C') this.restT = TC.cRest;
    if (cut) this.trail.stop();
  }
  /** target ground velocity for this wish into _tv: run × direction multiplier (FP look / TP lock forward), sprint in
   *  its forward cone (sideways still capped at the strafe speed), wading, optional slope slow-down, × k */
  targetVel(wish, intent, fp, k) {
    const l = wish.l;
    if (!(l > 1e-4)) { _tv.x = _tv.z = 0; return _tv; }
    const wl = Math.hypot(wish.x, wish.z) || 1, ux = wish.x / wl, uz = wish.z / wl;
    const ref = fp ? intent.lookYaw : intent.bodyYaw;
    let fx = 0, fz = 0, c = 1;
    if (ref != null) { fx = Math.sin(ref); fz = Math.cos(ref); c = ux * fx + uz * fz; }
    const mul = ref == null ? 1 : c >= 0 ? lerp(TM.strafeK, 1, c) : lerp(TM.strafeK, TM.backK, -c);
    let sp = TM.run * mul;
    let tx = ux * l * sp, tz = uz * l * sp;
    if (this.sprint && (ref == null || c >= Math.cos(TM.sprintCone * D2R))) {
      tx = ux * l * TM.sprint; tz = uz * l * TM.sprint;
      if (ref != null) {
        const lat = tx * fz - tz * fx, cap = TM.run * TM.strafeK * l;   // right-handed lateral (+ = right of forward)
        if (Math.abs(lat) > cap) { const d = lat - Math.sign(lat) * cap; tx -= d * fz; tz += d * fx; }
      }
    }
    if (this.wading) { tx *= TM.wadeK; tz *= TM.wadeK; }
    if (TM.slopeSpeed && this.grounded) {
      const W = G.world, e = 0.4, up = (W.hAt(this.pos.x + ux * e, this.pos.z + uz * e) - W.hAt(this.pos.x - ux * e, this.pos.z - uz * e)) / (2 * e);
      const m = 1 - TM.slopeK * smoothstep(TM.slopeLo, TM.slopeHi, up);
      tx *= m; tz *= m;
    }
    _tv.x = tx * k; _tv.z = tz * k;
    return _tv;
  }
  /** vector acceleration toward the target velocity (no per-axis clamp: same rate in every direction) */
  accel(tvx, tvz, acc) {
    let dx = tvx - this.vel.x, dz = tvz - this.vel.y;
    const l = Math.hypot(dx, dz);
    if (l > acc) { dx *= acc / l; dz *= acc / l; }
    this.vel.x += dx; this.vel.y += dz;
  }
  /** air control: 14 m/s² toward the wish, keeping any speed along it beyond the target (dash / sprint jumps carry);
   *  no wish = light drag; never over this jump's cap */
  airMove(tvx, tvz, wishing, dt) {
    const v = this.vel;
    if (!wishing) { v.multiplyScalar(Math.exp(-TM.airDrag * dt)); return; }
    const tl = Math.hypot(tvx, tvz) || 1e-6, ux = tvx / tl, uz = tvz / tl;
    const along = v.x * ux + v.y * uz, want = Math.max(tl, along);
    this.accel(ux * want, uz * want, TM.airAccel * dt);
    const sp = v.length(), cap = Math.max(this.airCap, TM.run);
    if (sp > cap) v.multiplyScalar(cap / sp);
  }
  /** sprint (feel §4.2, no auto-jog): starts when a roll ends with the button still held, on a roll press while the
   *  roll cools down, or from the pad toggle; ends on release (hold), stopping (wish < 0.3), a > 60° input turn,
   *  the wish staying outside the sprint cone (±sprintCone of the look / held body forward, where the sprint speed no
   *  longer applies) for sprintConeT s ('cone': a gradual turn into a strafe or a backpedal), wading, a swing, hurt or
   *  any non-moving state. player.sprint is the live state (C2) */
  updateSprint(wish, intent, dt) {
    const loc = wish.l > 0.05 ? angDiff(intent.lookYaw, Math.atan2(wish.x, wish.z)) : null;
    this.sprintEnd = null;
    if (this.sprint) {
      // the same forward reference targetVel applies the sprint speed by (FP: the look; TP: a held body yaw, else any way)
      const ref = intent.mode === 'fp' ? intent.lookYaw : intent.bodyYaw;
      const outCone = ref != null && loc != null && Math.cos(Math.atan2(wish.x, wish.z) - ref) < Math.cos(TM.sprintCone * D2R);
      this.sprintOutT = outCone ? (this.sprintOutT || 0) + dt : 0;
      let end = null;
      if (this.sprintMode === 'hold' && !intent.sprint) end = 'release';
      else if (wish.l < TM.sprintMinWish) end = 'stop';
      else if (this.wading) end = 'wade';
      else if (this.state !== 'normal') end = this.state;
      else if (loc != null && Math.abs(angDiff(this.sprintRef, loc)) > TM.sprintTurn * D2R) end = 'turn';
      else if (this.sprintOutT > (TM.sprintConeT ?? 0.2) + 1e-9) end = 'cone';
      if (end) {
        if (this.sprintMode === 'toggle') this.sprintToggleOff = true;
        this.sprint = false; this.sprintMode = null; this.sprintEnd = end; this.sprintOutT = 0;
      } else this.sprintRef = dampAngle(this.sprintRef, loc, TM.sprintTurnLag, dt);
    }
    if (!this.sprint && this.state === 'normal' && wish.l >= TM.sprintMinWish && !this.wading) {
      if (intent.sprintToggle) this.startSprint('toggle', intent, wish);
      else if (intent.sprint && this.dashBuffer > 0 && this.dashCD > 0) { this.startSprint('hold', intent, wish); this.dashBuffer = 0; }
    }
  }
  startSprint(mode, intent, wish) {
    this.sprint = true; this.sprintMode = mode; this.sprintOutT = 0;
    this.sprintRef = angDiff(intent.lookYaw, Math.atan2(wish.x, wish.z));
  }
  /** footsteps: one per half stride cycle (floor(walkPhase/π) ticks), the same phase that drives the body animation
   *  and WP1's head bob; only while grounded */
  footsteps(dt) {
    const sp = this.vel.length();
    if (this.grounded && (this.state === 'normal' || this.state === 'frozen') && sp > 1) {
      this.walkPhase += dt * (6 + sp * 1.6);
      const idx = Math.floor(this.walkPhase / Math.PI);
      if (idx > this.stepIdx) {
        this.foot = this.foot === 'L' ? 'R' : 'L';
        this.surface = this.surfaceHere();
        emit(EV.STEP, { foot: this.foot, surface: this.surface, speed: sp });
      }
      this.stepIdx = idx;
    } else { this.walkPhase *= 0.9; this.stepIdx = Math.floor(this.walkPhase / Math.PI); }
  }
  /** footstep / landing surface: water, a standable top (stump wood, rock stone), the deck, else the terrain's */
  surfaceHere() {
    if (this.wading) return 'water';
    const on = this.standOn;
    if (on && on !== 'deck') return on.kind === 'stump' ? 'wood' : 'stone';
    return G.game ? G.game.surfaceAt(this.pos) : 'grass';
  }
  /** lastSafe bookkeeping and the stuck flag (the wp3-player-fx module warps Pip back under a fade) */
  safety(dt, W) {
    const p = this.pos;
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) { this.warp(this.lastSafe.x, this.lastSafe.z); return; }
    // (standable tops don't count: their side slides Pip off softly and he can always walk along it or hop back up)
    const pen = penetration(W, p.x, p.z, this.r, p.y, this.grounded, this.standOn && this.standOn !== 'deck' ? this.standOn : null, true);
    const bad = !W.walkable(p.x, p.z) || pen > 0.05 || p.y < W.hAt(p.x, p.z) - 0.6;
    this.unsafeT = bad ? this.unsafeT + dt : 0;
    this.stuck = this.unsafeT > TM.unstickAfter;
    if (this.grounded && !bad && pen < 0.01 && this.reachable(p.x, p.z)) {
      this.safeT += dt;
      if (this.safeT >= TM.safeEvery) { this.safeT = 0; this.lastSafe.x = p.x; this.lastSafe.y = p.y; this.lastSafe.z = p.z; }
    }
  }
  /** on (or beside) a cell the reachability BFS reached from the spawn */
  reachable(x, z) {
    const R = G.world.reach;
    if (!R) return true;
    const ci = Math.floor(x + 180), cj = Math.floor(z + 180);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < 360 && j < 360 && R[j * 360 + i]) return true; }
    return false;
  }
  /** back to the last safe spot at once (the module fades around it) */
  unstick() { this.warp(this.lastSafe.x, this.lastSafe.z); this.stuck = false; this.unsafeT = 0; }
  startAttack(wish, intent) {
    this.attackBuffer = 0;
    // chain: A → B → C while each swing starts within chainGap of the last (or cancels into it); after C a new chain
    const chained = this.state === 'attack' || this.chainT <= TC.chainGap;
    this.combo = chained && this.combo !== 'C' ? (this.combo === 'A' ? 'B' : 'C') : 'A';
    const C = this.combo === 'C';
    this.swingDur = C ? TC.swingC : TC.swingAB;
    this.chainT = 9;                 // set back to 0 only when this swing runs to its end (interruptions end the chain)
    // the swing goes along the aim: TP snaps the body to it (lock-on / crosshair yaw) and latches it for the whole swing
    // (combat.swingState); in FP it already is the look, and the blade keeps following the eye
    this.turnTo(intent.faceYaw ?? intent.lookYaw);
    this.swingYaw = this.facing; this.swingPitch = intent.facePitch ?? intent.lookPitch ?? 0;
    this.swingLatch = intent.mode !== 'fp';
    this.swingX = this.pos.x; this.swingZ = this.pos.z;   // sweep bearings are measured from here
    this.state = 'attack';
    this.attackT = 0;
    this.swingId++;
    // lunge along the aim: strong when stepping in or a target waits just out of reach, else a nudge; C always lunges.
    // No lunge in the air (air swings keep the jump's motion)
    if (this.grounded) {
      const f = fwdXZ(this.facing);
      const lunge = C ? TC.lungeC : wish.x * f.x + wish.z * f.z > 0.3 || this.lungeTarget(f) ? TC.lunge : TC.lungeSoft;
      this.vel.x += f.x * lunge;
      this.vel.y += f.z * lunge;
    }
    this.trail.start(this.swingDur * 0.75, this.combo === 'B');
    emit(EV.SWING, { id: this.swingId, kind: this.combo, level: this.swordLevel, side: C ? 'C' : this.combo === 'A' ? 'R' : 'L', aimYaw: this.swingYaw, aimPitch: this.swingPitch });
  }
  /** stop a swing at once (interacting mid-swing): no more hits, the chain ends */
  endSwing() {
    if (this.state !== 'attack') return;
    this.state = 'normal';
    this.attackT = 0; this.attackBuffer = 0; this.chainT = 9;
    this.trail.stop();
  }
  /** a hostile 1.2–3.0 m ahead within ±20° of the swing (feel §8.1 lunge rule) */
  lungeTarget(f) {
    const game = G.game;
    if (!game) return false;
    const yaw = Math.atan2(f.x, f.z), [n0, n1] = TC.lungeNear, cone = (TC.lungeCone * Math.PI) / 180;
    const ok = (x, z) => { const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz); return d >= n0 && d <= n1 && Math.abs(angDiff(yaw, Math.atan2(dx, dz))) <= cone; };
    for (const e of game.enemies) if (e.alive && ok(e.pos.x, e.pos.z)) return true;
    const b = game.fight && game.fight.boss;
    return !!(b && !b.dying && ok(b.pos.x, b.pos.z));
  }
  startDash(wish, intent) {
    this.dashBuffer = 0;
    this.chainT = 9; // a roll ends the chain
    let dx = wish.x, dz = wish.z;
    const l = Math.hypot(dx, dz);
    this.backstep = false;
    if (l >= 0.2) { dx /= l; dz /= l; if (intent.mode !== 'fp') this.facing = Math.atan2(dx, dz); }
    else if (intent.mode === 'fp') { dx = -Math.sin(intent.lookYaw); dz = -Math.cos(intent.lookYaw); this.backstep = true; } // FP no-input dash = backstep
    else { dx = Math.sin(this.facing); dz = Math.cos(this.facing); }
    this.dashDir.set(dx, dz);
    this.state = 'dash';
    this.dashT = 0;
    this.dashCD = CFG.dashCooldown;
    this.iframes = Math.max(this.iframes, CFG.dashTime + 0.06);
    emit(EV.DASH_START, { dirX: dx, dirZ: dz });
  }
  /** returns true if damage was applied. With the camera out of Pip's head (TP, shots) a grounded Pip hops a little so
   *  the knockback reads (TUNE.move.hurtHop, feel §4.3: "readable in TP"); in FP there is no hop — it lifted the eye
   *  13 cm (also under reduce motion) and its touchdown fired a full landing; the FP hurt is WP1's directional kick
   *  (feel §6.4). The hop's touchdown is no landing (no EV.LAND, as its take-off is no EV.JUMP; see fall) */
  hurt(dmg, fx, fz, knock = 7) {
    if (this.invulnerable || this.state === 'item' || this.frozen) return false;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, l = Math.hypot(dx, dz) || 1;
    this.hurtDir.x = -dx / l; this.hurtDir.z = -dz / l;
    this.vel.set((dx / l) * knock, (dz / l) * knock);
    this.chainT = 9;
    this.state = 'hurt';
    this.hurtT = 0.25;
    this.iframes = CFG.hurtIframes;
    this.flash = 1;
    if (this.grounded && TM.hurtHop > 0) {
      if (this.bodyShown) { this.vy = TM.hurtHop; this.grounded = false; this.jumping = false; this.coyoteT = 0; this.hopY = this.pos.y; }
    } else if (!this.grounded) this.vy = Math.max(this.vy, TM.hurtHop * 0.5);
    return true;
  }
}
Object.assign(Player.prototype, PlayerBody);
