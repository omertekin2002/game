// Boss AI: Grumble Shroom (woods), Captain Pinch (shores), Frostbun (peaks). GLB model if present, else procedural.
// WP5 (readable from a 0.88 m eye, no scale-up): every attack starts with EV.TELEGRAPH (C3), a coral body pulse, a
// glint and a whole-body tell (the GLBs have no limbs: lean / rise / swell); openings (stunned, recovering after a big
// attack) pulse gold with sparkles at belly height and set boss.opening. Telegraphs match the damage exactly: the
// shockwave light wall spans its hit band (fight.js) and glows at the Shroom's feet from the crouch, Pinch's charge
// stripe is his contact width and his snap stripe is the snap's whole hit area, Frostbun's slide stripe ends where the
// slide ends (the arena wall stops it), and the full 2.9 m landing disc (rim wall) + sky pillar + whistle shows from
// the crouch. Passive contact shoves (no damage) out to TA.room[id], so the FP eye keeps a sword's length from the body
// and the tells stay in view (also while it dies); only charges and slides hurt on contact, once per rush, bowling Pip
// out of their path. A string of hits worth ≥ TA.shrug.hits damage taken in a row outside an opening is shrugged off (Pip
// shoved out of reach, no damage) and answered with an attack, so the gold openings are where a long string of hits lands. A boss landing on
// Pip moves itself off him; nothing brings the FP eye inside TA.keepOut[id] of its centre.
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { BOSSES, REMATCH, rematch } from './data.js';
import { makeModel } from './assets.js';
import { instRig, bossDef } from './models.js';
import { Enemy, telegraph, hint } from './entities.js';
import { emitter } from './audio-bus.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, rand, TAU, len2, angDiff, Ease } from './util.js';
import { actors as TA } from './tune.js';
import { STEP } from './clock.js';

const DANGER = new THREE.Color(TA.danger), CHANCE = new THREE.Color(TA.chance), WHITE = new THREE.Color(1, 1, 1);
// wind-up tells per state: lean (+ forward), rise, swell (× TA.lean°, TA.rise m, TA.swell), and the glint points
// (x, z in m in the boss frame, y as a fraction of its height)
const TELL = {
  stompCrouch: [-0.6, -0.6, 1], sporeWind: [-1, 1, 1], summon: [0, 1, 0.5],
  chargeWind: [0.9, -0.5, 0.5], snapWind: [-1, 1, 0.8], bubbleWind: [-0.6, 0.6, 1],
  crouch: [0.3, -1, 1], throwWind: [-1, 1, 0.6], slideWind: [0.9, -0.5, 0.4],
};
const GLINTS = { woods: [[0, 0.95, 0.35]], shores: [[1.05, 0.62, 0.95], [-1.05, 0.62, 0.95]], peaks: [[0.35, 0.97, 0.2], [-0.35, 0.97, 0.2]] };
/** the ring hint (C18): at the stomp's crouch, so it reads before the first ring arrives (fight.js keeps it as a fallback) */
export const RING_HINT = 'A glowing ring! Hop over it with {jump} or roll through it with {dash}.';

export class Boss {
  /** `opts.rematch`: a guardian rematch after the bloom (fight.js): napping until Pip wakes it with Use, REMATCH.hpK ×
   *  its HP, enraged from REMATCH.enrage of its HP; same moves and wind-ups */
  constructor(id, arena, opts = {}) {
    this.id = id;
    this.def = BOSSES[id];
    this.name = this.def.name;
    this.arena = arena;
    this.rematch = !!opts.rematch;
    this.enrageAt = this.rematch ? REMATCH.enrage : 0.5;
    this.maxHp = this.rematch ? rematch.hp(id) : this.def.hp;
    this.hp = this.maxHp;
    this.r = id === 'shores' ? 1.55 : 1.35;
    this.pos = new THREE.Vector3(arena.x, arena.h, arena.z);
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector2();
    this.facing = arena.entAng; // look toward the entrance
    this.prevFacing = this.facing;
    this.state = 'sleep'; this.st = 0; this.t = 0;
    this.iframes = 0; this.flash = 0; this.squash = 0; this.lift = 0;
    this.cool = 2.0; this.dead = false; this.dying = false;
    this.opening = false;         // a stunned / recovering boss: hits are free (HUD "Now!" tag, gold pulse)
    this.echo = 0;
    this.hits = [];
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';   // lean / roll in the boss's own frame after the facing yaw
    const glb = makeModel(this.def.key, { outline: 'prop' });
    if (glb) { this.root.add(glb.group); this.mats = glb.materials; this.nodes = {}; this.height = glb.height; this.glb = true; }
    else {
      const r = instRig(bossDef(id), { outline: 'prop' });
      this.root.add(r.root);
      this.nodes = r.nodes; this.mats = r.mats;
      this.height = id === 'woods' ? 3.4 : id === 'shores' ? 2.4 : 4.2;
    }
    this.root.position.copy(this.pos);
    G.scene.add(this.root);
  }
  /** sim-space hurt volume: vertical cylinder { x, z, r, y0, y1 } from the floor + lift up the model height */
  hurtbox(out = {}) {
    out.x = this.pos.x; out.z = this.pos.z; out.r = this.r; out.y0 = this.pos.y; out.y1 = this.pos.y + this.height;
    return out;
  }
  /** blob shadow on the arena floor, shrinking as the boss lifts off (render; arch §8.2 extension point) */
  blob(out) { out.x = this.root.position.x; out.y = this.arena.h; out.z = this.root.position.z; out.r = this.r * (1.1 - Math.min(0.5, this.lift * 0.08)); return out; }
  get enraged() { return this.hp <= this.maxHp * this.enrageAt; }
  /** in a wind-up or an attack (not walking, recovering or stunned) */
  get busy() { return !(this.state === 'walk' || this.state === 'recover' || this.state === 'stunned' || this.state === 'intro' || this.state === 'sleep'); }
  get speedK() { return this.enraged ? 1.4 : 1; }
  /** the contact width every telegraph matches: centre distance at which a charge / slide touches Pip */
  get touchR() { return this.r + (G.player ? G.player.r : 0.32) + TA.stripePad; }
  /** personal space: passive contact keeps Pip's centre this far from the boss's (within wooden-sword reach) */
  get room() { return (TA.room && TA.room[this.id]) || this.r + 1.2; }
  /** the closest Pip's centre (the FP eye) ever gets to the boss's: its body's reach at eye height + the near plane */
  get keepOut() { return (TA.keepOut && TA.keepOut[this.id]) || this.r * 0.85 + 0.34; }
  /** the radius of its body collider for Pip (game.dynamicColliders), so the collider stops his centre at keepOut */
  get colliderR() { return this.keepOut - (G.player ? G.player.r : 0.32); }
  dist() { const p = G.player.pos; return len2(p.x - this.pos.x, p.z - this.pos.z); }
  dirTo() { const p = G.player.pos; return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  clampArena(margin = 1.2) {
    const a = this.arena, dx = this.pos.x - a.x, dz = this.pos.z - a.z, d = len2(dx, dz);
    const lim = a.r - this.r - margin + 1.2;
    if (d > lim) { this.pos.x = a.x + (dx / d) * lim; this.pos.z = a.z + (dz / d) * lim; return true; }
    return false;
  }
  /** distance along yaw `ang` from the boss centre to where clampArena stops it */
  runTo(ang) {
    const a = this.arena, lim = a.r - this.r, px = this.pos.x - a.x, pz = this.pos.z - a.z, dx = Math.sin(ang), dz = Math.cos(ang);
    const b = px * dx + pz * dz, c = px * px + pz * pz - lim * lim, disc = b * b - c;
    return disc > 0 ? Math.max(0, -b + Math.sqrt(disc)) : 0;
  }
  /** the farthest a rush of `sp` m/s lasting `T` s carries the centre along yaw `ang` while it can still hurt (the
   *  wall stops it; the last step's move is after the last hit test) */
  rushTo(ang, sp, T) { return Math.min(sp * STEP * Math.max(0, Math.ceil(T / STEP - 1e-6) - 1), this.runTo(ang)); }
  /** Pinch's snap along yaw `ang`: how far ahead of his centre the hit area (and its stripe) reaches */
  snapLen(ang) { return this.rushTo(ang, TA.snap[2], TA.snap[3]) + TA.snap[0] + TA.snap[1]; }
  /** Frostbun's slide along yaw `ang`: its stripe length (the path to the wall or to the slide's end, + touchR) */
  slideLen(ang) { return this.rushTo(ang, TA.slide[0] * Math.sqrt(this.speedK), TA.slide[1]) + this.touchR; }
  edgeDist() { const a = this.arena; return a.r - len2(this.pos.x - a.x, this.pos.z - a.z); }
  set(state, st) { this.state = state; this.st = st; this.stT = 0; this.windDur = st; this.rushHurt = false; this.windHits = 0; if (state === 'walk') this.walkAt = this.t; }
  wake() { this.set('intro', 2.0); }
  /** C3 + the tell: the wind-up begins (t = seconds until it can hit) */
  windUp(state, dur, kind, t) {
    this.set(state, dur);
    this.lastAtk = state;
    this.vel.set(0, 0);
    const h = this.height, s = Math.sin(this.facing), c = Math.cos(this.facing);
    for (const g of GLINTS[this.id] || []) if (G.fx) G.fx.ground.glint(this.pos.x + g[0] * c + g[2] * s, this.pos.y + g[1] * h, this.pos.z - g[0] * s + g[2] * c, { size: 0.9, life: 0.28 });
    telegraph(this, kind, this.pos.x, this.pos.y + h * 0.6, this.pos.z, t);
  }
  /** a hit-free window after a big attack: gold pulse + sparkles (boss.opening) */
  openFor(state, st) { this.set(state, st); this.opening = true; }

  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.t += dt;
    this.st -= dt; this.stT = (this.stT || 0) + dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.squash *= Math.exp(-7 * dt);
    if (this.dying) return this.updateDying(dt);
    if (this.state === 'sleep') return;
    if (this.state === 'intro') {
      this.facing = dampAngle(this.facing, this.dirTo(), 5, dt);
      if (this.stT > 0.6 && this.stT < 0.65 + dt) { this.squash = -0.8; sfx('stomp', this.at(0)); G.cam.shake(0.6); }
      if (this.st <= 0) this.set('walk', 0.5);
      return;
    }
    if (G.player.state === 'dizzy') { this.vel.multiplyScalar(0.9); return; }
    // the enraged Shroom's echo ring: counted here whatever the state (the old echo only ran down in 'recover' and
    // fired during the next attack), with its own little hop tell TA.echoWarn s before
    if (this.echo > 0) {
      const was = this.echo;
      this.echo -= dt;
      if (was > TA.echoWarn && this.echo <= TA.echoWarn) { this.squash = 0.7; telegraph(this, 'ring', this.pos.x, this.pos.y + 0.5, this.pos.z, TA.echoWarn + this.ringEta(6.5)); }
      if (this.echo <= 0) { this.squash = -0.5; this.ring(6.5, 0.4); }
    }
    if (this.pre && this.pre.active && this.pre.manual) {
      // the stomp's glow at its feet: brightens through the crouch and the hop, pulsing faster near the landing
      const k = this.state === 'stompCrouch' ? 0.5 * clamp(this.stT / Math.max(0.05, this.windDur), 0, 1) : this.state === 'stompAir' ? 0.5 + 0.5 * clamp(this.stT / 0.5, 0, 1) : 1;
      this.pre.m.material.uniforms.uA.value = (0.45 + 0.55 * k) * (0.8 + 0.2 * Math.sin(this.t * (10 + 14 * k)));
    }
    if (this.state !== 'recover' && this.state !== 'stunned') this.opening = false;
    // a string of hits outside an opening, while it is free to act: shrug Pip off and answer with an attack
    if (this.combo >= TA.shrug.hits && (this.state === 'walk' || (this.state === 'recover' && !this.opening))) this.shrug();
    // hits while it winds up or attacks: it shoves Pip off (no damage) and goes on with the attack, so the tell is read from
    // outside sword reach (a Pip who swung through every tell and volley used to land a third of all his hits there)
    else if (TA.shrug.wind && this.windHits >= TA.shrug.wind && this.busy && !(this.shrugT > 0)) this.shrug(true);
    if (this.id === 'woods') this.aiShroom(dt);
    else if (this.id === 'shores') this.aiCrab(dt);
    else this.aiFrost(dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    const hitEdge = this.clampArena();
    if (hitEdge && this.onEdge) this.onEdge();
    this.pos.y = this.arena.h + this.lift;
    // contact: charges and slides hurt; otherwise the boss keeps Pip at arm's (sword's) length (shoved, no damage)
    const pl = G.player;
    const d = this.dist();
    const rush = this.state === 'charge' || this.state === 'slide';
    this.shrugT = Math.max(0, (this.shrugT || 0) - dt);
    // (the Shroom's stomp hop keeps its room too: walking under it would bury the landing in the FP view)
    if ((this.lift < 1.2 || this.state === 'stompAir') && !this.dying) {
      if (rush) { if (d < this.touchR) this.rushHit(pl, d); }
      else if (this.shrugT > 0) this.shove(pl, d, TA.shrug.v);
      else if (d < this.room) this.shove(pl, d);
    }
    // (not during a rush: stepping the boss back off Pip every step pinned him in front of it for the whole rush)
    if (this.lift < 1 && !rush) this.separate(pl, d);
    // an opening's gold sparkles at belly height: TA.sparkleHz per second of sim time (not per rendered frame)
    if (this.opening && G.fx) {
      this.sparkT = (this.sparkT || 0) + dt * TA.sparkleHz;
      for (; this.sparkT >= 1; this.sparkT--) {
        const s = Math.sin(this.facing), c = Math.cos(this.facing), a = rand(-0.8, 0.8);
        G.fx.sparkle(this.pos.x + s * this.r * 0.9 + c * a, this.arena.h + rand(0.8, 1.4), this.pos.z + c * this.r * 0.9 - s * a, TA.chance, 1, 0.15);
      }
    } else this.sparkT = 0.5;
  }
  /** passive contact: push Pip out toward this.room (a velocity, so the FP eye glides); `v` given: at least that fast
   *  wherever he is (the shrug) */
  shove(pl, d, v = 0) {
    if (pl.state === 'dizzy' || pl.frozen) return;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, l = d || 1;
    if (!v) v = TA.shove * clamp((this.room - d) / 0.5, 0.35, 1);
    const out = (pl.vel.x * dx + pl.vel.y * dz) / l;
    if (out < v) { pl.vel.x += (dx / l) * (v - out); pl.vel.y += (dz / l) * (v - out); }
  }
  /** a charge / slide reaching Pip: it hurts once per rush (each step of a rush used to hurt again as soon as the 1 s
   *  i-frames ran out, while separate() kept the boss parked in front of him: one Pinch charge took 6 HP), and it bowls
   *  him sideways out of its path, so the rush carries on past him to the wall (its bonk and opening) */
  rushHit(pl, d) {
    const fx = Math.sin(this.cd), fz = Math.cos(this.cd), dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const side = dx * fz - dz * fx >= 0 ? 1 : -1, sx = fz * side, sz = -fx * side;   // out of the path, on his side
    if (!this.rushHurt) {
      // knocked mostly sideways (a glancing blow): the hurt comes from his front-side, the knock goes out of the path
      const kx = sx + fx * 0.5, kz = sz + fz * 0.5, kl = Math.hypot(kx, kz);
      this.rushHurt = G.game.playerHurt(TA.bossDmg.rush, pl.pos.x - kx / kl, pl.pos.z - kz / kl, 9, 'boss');
    }
    if (pl.state === 'dizzy' || pl.frozen) return;
    const v = TA.shove * 1.4, out = pl.vel.x * sx + pl.vel.y * sz;
    if (out < v) { pl.vel.x += sx * (v - out); pl.vel.y += sz * (v - out); }
  }
  /** damage worth ≥ TA.shrug.hits taken in a row outside an opening (wooden sword A 1, B 1, C 2: the third hit; Shiny 2, 2,
   *  3: the second): a no-damage huff that shoves Pip out of sword reach, and its next attack comes TA.shrug.cool s later
   *  (so the tells start while Pip has the whole boss in view) */
  shrug(wind = false) {
    this.combo = 0;
    this.shrugT = TA.shrug.t;
    if (wind) { this.windHits = 0; if (G.fx) G.fx.dust(this.pos.x, this.arena.h, this.pos.z, 8, this.id === 'peaks' ? 0xeef6ff : 0xe8d8b8); return; }
    this.squash = -0.7;
    // a shrug that ends a recover starts the walk the recover would have (with a fresh cool: the spent one, ≤ 0, made the
    // next attack start the same step, so a Pip who swung through a snap met the next snap 1.05 s after the first)
    if (this.state === 'recover') { this.set('walk', 0); this.cool = rand(...TA.cool[this.id]) / this.speedK; }
    // …and its answer never comes sooner than TA.shrug.rest after that walk began
    this.cool = Math.min(this.cool, Math.max(TA.shrug.cool, TA.shrug.rest - (this.t - (this.walkAt ?? -9))));
    sfx('hup', this.at(this.height * 0.6));
    if (G.fx) G.fx.dust(this.pos.x, this.arena.h, this.pos.z, 12, this.id === 'peaks' ? 0xeef6ff : 0xe8d8b8);
  }
  /** Pip inside the boss's keep-out (it just landed on him): the boss steps off him instead of the collider snapping
   *  Pip's eye sideways */
  separate(pl, d) {
    const need = this.keepOut + 0.02;
    if (d >= need) return;
    const a = d > 1e-3 ? Math.atan2(this.pos.x - pl.pos.x, this.pos.z - pl.pos.z) : this.facing + Math.PI;
    this.pos.x = pl.pos.x + Math.sin(a) * need; this.pos.z = pl.pos.z + Math.cos(a) * need;
    if (this.clampArena()) { // against the wall: Pip gets the rest as a push instead
      const dd = this.dist();
      if (dd < need) { const b = a + Math.PI; pl.vel.x = Math.sin(b) * TA.shove; pl.vel.y = Math.cos(b) * TA.shove; }
    }
    this.prev.x = lerp(this.prev.x, this.pos.x, 0.5); this.prev.z = lerp(this.prev.z, this.pos.z, 0.5);
  }
  at(dy = 1) { return { x: this.pos.x, y: this.pos.y + dy, z: this.pos.z }; }
  /** seconds until a ring of `speed` from the boss reaches Pip's side of its band */
  ringEta(speed) { return Math.max(0, this.dist() - 0.8 - 0.55) / speed; }
  ring(speed, shake) {
    G.game.addShockwave(this.pos.x, this.arena.h, this.pos.z, { speed, max: this.arena.r + 1 });
    G.cam.shake(shake);
    sfx('stomp', this.at(0));
  }
  pickAttack(table) {
    if (this.forceAtk) { const n = this.forceAtk; this.forceAtk = null; if (table.some((t) => t[0] === n)) return n; }   // G.debug.actors.boss
    const tot = table.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * tot;
    for (const [n, w] of table) { r -= w; if (r <= 0) return n; }
    return table[0][0];
  }

  // ---------------------------------------------------------------- Grumble Shroom
  aiShroom(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 4, dt);
        const sp = d > this.room + TA.roomWalk ? 1.6 * k : 0;   // walks up to just outside its personal space
        this.vel.set(Math.sin(this.facing) * sp, Math.cos(this.facing) * sp);
        this.cool -= dt;
        if (this.cool <= 0) {
          const minions = G.game.enemies.filter((e) => e.minion && e.alive).length;
          const atk = this.pickAttack([['stomp', 45], ['spores', 35], ['summon', minions < TA.minions ? 20 : 0]]);
          const sp6 = 6.5 * (this.enraged ? 1.2 : 1);
          if (atk === 'stomp') {
            this.windUp('stompCrouch', 0.55, 'slam', 0.55 + 0.5 + this.ringEta(sp6));
            // the ring's first light wall glows at its feet from the crouch: seen from right beside the body too
            this.pre = G.fx.ground.band(this.pos.x, this.arena.h, this.pos.z, { r: this.r + TA.preRing[0], w: TA.preRing[1], h: TA.preRing[2], wallA: 0.6, floorA: 0.5, top: 0.12 });
            hint('wp5-ring', RING_HINT);   // read during the crouch, not 0.2 s before the first ring arrives
          }
          else if (atk === 'spores') this.windUp('sporeWind', 0.55, 'shot', 0.55 + Math.max(0, d - 1.4 - 0.6) / 4.2);
          else this.windUp('summon', 0.9, 'summon', 0.9 + 0.6);
        }
        break;
      }
      case 'stompCrouch':
        this.squash = Math.min(1, this.squash + dt * 4);
        this.facing = dampAngle(this.facing, toP, 6, dt);
        if (this.st <= 0) this.set('stompAir', 0.5);
        break;
      case 'stompAir': {
        const kk = 1 - this.st / 0.5;
        this.lift = Math.sin(kk * Math.PI) * 2.2;
        if (this.st <= 0) {
          this.lift = 0; this.squash = 1.2;
          G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 16, 0xd8c8a8);
          G.fx.ground.crack(this.pos.x, this.arena.h, this.pos.z, 2.5);
          this.ring(6.5 * (this.enraged ? 1.2 : 1), 0.9);
          if (this.pre) { this.pre.manual = false; this.pre.fade = 0.15; this.pre.life = 0; this.pre = null; }   // the ring takes over
          this.openFor('recover', 0.8 / k);
          this.echo = this.enraged ? 0.6 : 0;
        }
        break;
      }
      case 'sporeWind':
        this.facing = dampAngle(this.facing, toP, 8, dt);
        this.squash = -Math.sin((this.stT / 0.55) * Math.PI) * 0.5;
        if (this.st <= 0) {
          const n = this.enraged ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = this.facing + (i - (n - 1) / 2) * 0.24;
            G.game.spawnProjectile('spore', this.pos.x + Math.sin(a) * 1.4, this.arena.h + 1.2, this.pos.z + Math.cos(a) * 1.4, a, 4.2, { scale: 1.3, r: 0.3 });
          }
          sfx('shoot', this.at(1.4));
          this.set('recover', 0.7 / k);
        }
        break;
      case 'summon':
        this.squash = Math.sin(this.stT * 10) * 0.2;
        if (this.st <= 0) {
          for (let i = 0; i < 2; i++) {
            const a = this.facing + (i ? 1.4 : -1.4);
            const x = this.pos.x + Math.sin(a) * 2.6, z = this.pos.z + Math.cos(a) * 2.6;
            const e = new Enemy('mushroom', x, z, { minion: true });
            if (TA.minionHp) e.hp = e.maxHp = TA.minionHp;
            G.game.addEnemy(e);
            e.emerge('ground');
            G.fx.poof(x, this.arena.h, z, 0xe0c0ff, 10);
          }
          sfx('summon', this.at(1));
          this.set('recover', 0.6);
        }
        break;
      case 'recover':
        this.vel.multiplyScalar(0.8);
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(...TA.cool.woods) / k; }
        break;
    }
  }

  // ---------------------------------------------------------------- Captain Pinch
  aiCrab(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    this.onEdge = null;
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 5, dt);
        this.side = this.side || 1;
        if (this.stT > 1.6) { this.side *= -1; this.stT = 0; }
        const a = this.facing + Math.PI / 2 * this.side;
        let vx = Math.sin(a) * 2.6 * k, vz = Math.cos(a) * 2.6 * k;
        const want = 6;
        vx += Math.sin(toP) * (d - want) * 0.6; vz += Math.cos(toP) * (d - want) * 0.6;
        this.vel.set(vx, vz);
        this.cool -= dt;
        if (this.cool <= 0) {
          const atk = this.pickAttack([['charge', 42], ['bubbles', 33], ['snap', d < 4.5 ? 40 : 15]]);
          if (atk === 'charge') {
            const wind = 0.8 / Math.sqrt(k);
            this.cd = toP;
            this.windUp('chargeWind', wind, 'charge', wind + Math.max(0, d - this.touchR) / (13 * Math.sqrt(k)));
            // the stripe is exactly the charge's contact width, from here to where the wall stops him
            this.tele = G.fx.ground.stripe(this.pos.x, this.arena.h, this.pos.z, this.cd, this.runTo(this.cd) + this.touchR, 2 * this.touchR);
            this.locked = false;
            hint('wp5-stripe', 'The glowing stripe is his charge path: step out of it!');
          } else if (atk === 'bubbles') this.windUp('bubbleWind', TA.bubbleWind, 'shot', TA.bubbleWind + Math.max(0, d - 1.6 - 0.6) / 3.6);
          else {
            this.windUp('snapWind', TA.snapWind, 'lunge', TA.snapWind);
            // the snap's whole hit area (the claws lunge TA.snap[2] m/s for TA.snap[3] s): a stripe that ends where it ends
            this.tele = G.fx.ground.stripe(this.pos.x, this.arena.h, this.pos.z, this.facing, this.snapLen(this.facing), 2 * TA.snap[1], { end: true, wall: 0.35 });
            this.locked = false;
            hint('wp5-snap', 'His claws will snap along the glowing stripe: step sideways out of it!');
          }
        }
        break;
      }
      case 'chargeWind': {
        this.facing = dampAngle(this.facing, this.cd, 12, dt);
        const lockAt = this.windDur - TA.stripeLock;
        if (this.stT < lockAt) this.cd = dampAngle(this.cd, toP, 3, dt);
        else if (!this.locked) { this.locked = true; sfx('chargeLock', this.at(0.5)); }
        if (this.tele) {
          this.tele.m.rotation.y = this.cd;
          this.tele.m.position.set(this.pos.x, this.arena.h + 0.03, this.pos.z);
          this.tele.m.material.uniforms.uLen.value = this.runTo(this.cd) + this.touchR;
          // the lock flash: alpha ×2 for 0.1 s, 0.4 s before the charge
          this.tele.flash = this.stT >= lockAt && this.stT < lockAt + 0.1 ? 1 : 0;
        }
        if (Math.random() < 0.5) G.fx.dust(this.pos.x - Math.sin(this.cd) * 1.2, this.arena.h, this.pos.z - Math.cos(this.cd) * 1.2, 1, 0xf6e2b0);
        if (this.st <= 0) { G.fx.ground.remove(this.tele); this.tele = null; this.set('charge', 2.2); sfx('whoosh', this.at(0.5)); }
        break;
      }
      case 'charge': {
        const sp = 13 * Math.sqrt(k);
        this.vel.set(Math.sin(this.cd) * sp, Math.cos(this.cd) * sp);
        if (Math.random() < 0.7) G.fx.dust(this.pos.x, this.arena.h, this.pos.z, 2, 0xf6e2b0);
        this.onEdge = () => {
          this.vel.set(0, 0);
          this.openFor('stunned', 1.2);
          this.squash = 1; G.cam.shake(1); sfx('bonk', this.at(1));
          G.fx.sparks(this.pos.x + Math.sin(this.cd) * 1.5, this.arena.h + 1, this.pos.z + Math.cos(this.cd) * 1.5, 14);
        };
        if (this.st <= 0) this.set('recover', 0.6);
        break;
      }
      case 'stunned':
        this.vel.set(0, 0);
        if (Math.random() < 0.25) G.fx.sparkle(this.pos.x + Math.sin(this.t * 6) * 0.8, this.arena.h + 2.6, this.pos.z + Math.cos(this.t * 6) * 0.8, 0xfff070, 1, 0.1);
        if (this.st <= 0) this.set('recover', 0.4);
        break;
      case 'bubbleWind':
        this.facing = dampAngle(this.facing, toP, 6, dt);
        if (this.st <= 0) { this.set('bubbles', this.enraged ? TA.bubbleEnraged : 1.2); this.shot = 0; }
        break;
      case 'bubbles':
        this.facing = dampAngle(this.facing, toP, 6, dt);
        this.vel.set(0, 0);
        if (this.stT > this.shot * 0.18 && this.shot < (this.enraged ? 9 : 6)) {
          const a = toP + rand(-0.35, 0.35);
          G.game.spawnProjectile('bubble', this.pos.x + Math.sin(a) * 1.6, this.arena.h + 1.0, this.pos.z + Math.cos(a) * 1.6, a, 3.6, { life: 4 });
          sfx('bubble', this.at(1));
          this.shot++;
        }
        if (this.st <= 0) this.set('recover', 0.5);
        break;
      case 'snapWind': {
        // aims at Pip, then locks TA.snapLock s before the snap (alpha flash + click), like the charge
        const lockAt = this.windDur - TA.snapLock;
        if (this.stT < lockAt) this.facing = dampAngle(this.facing, toP, 10, dt);
        else if (!this.locked) { this.locked = true; sfx('chargeLock', this.at(0.5)); }
        this.vel.set(0, 0);
        if (this.tele) {
          this.tele.m.rotation.y = this.facing;
          this.tele.m.position.set(this.pos.x, this.arena.h + 0.03, this.pos.z);
          this.tele.m.material.uniforms.uLen.value = this.tele.len = this.snapLen(this.facing);
          this.tele.flash = this.stT >= lockAt && this.stT < lockAt + 0.1 ? 1 : 0;
        }
        if (this.st <= 0) {
          G.fx.ground.remove(this.tele); this.tele = null;
          this.set('snap', TA.snap[3]); this.cd = this.facing; this.snapped = false; this.from = { x: this.pos.x, z: this.pos.z };
          sfx('snap', this.at(1.2));
        }
        break;
      }
      case 'snap': {
        const sp = TA.snap[2], fx = Math.sin(this.cd), fz = Math.cos(this.cd);
        this.vel.set(fx * sp, fz * sp);
        // the hit area is exactly the stripe drawn in the wind-up: Pip's centre within snap[1] of the snap line, from
        // the start point out to how far the claws have got (the claws reach snap[0] + snap[1] ahead of the body)
        const pl = G.player, rx = pl.pos.x - this.from.x, rz = pl.pos.z - this.from.z;
        const along = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
        const reach = len2(this.pos.x - this.from.x, this.pos.z - this.from.z) + TA.snap[0] + TA.snap[1];
        if (!this.snapped && side < TA.snap[1] && along > 0 && along < reach) this.snapped = G.game.playerHurt(TA.bossDmg.snap, this.pos.x, this.pos.z, 9, 'boss');
        if (this.st <= 0) { this.set('recover', 0.6 / k); G.fx.sparks(this.pos.x + fx * TA.snap[0], this.arena.h + 0.8, this.pos.z + fz * TA.snap[0], 6, 0xffffff); }
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(0.8);
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(...TA.cool.shores) / k; }
        break;
    }
  }

  // ---------------------------------------------------------------- Frostbun
  aiFrost(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    const air = 1.15 / Math.sqrt(k);
    this.onEdge = null;
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 4, dt);
        const sp = d > this.room + TA.roomWalk ? 1.5 * k : 0;
        this.vel.set(Math.sin(this.facing) * sp, Math.cos(this.facing) * sp);
        this.lift = Math.abs(Math.sin(this.t * 5)) * 0.25;
        this.cool -= dt;
        if (this.cool <= 0) {
          const atk = this.pickAttack([['leap', 42], ['throw', 33], ['slide', 25]]);
          this.lift = 0;
          if (atk === 'leap') {
            this.windUp('crouch', 0.45, 'leap', 0.45 + air);
            // the full 2.9 m danger disc + sky pillar from the crouch, on Pip; it tracks him until 30 % into the air
            const pl = G.player.pos;
            this.to = { x: pl.x, z: pl.z };
            this.shadow = G.fx.ground.zone(pl.x, this.arena.h, pl.z, TA.frostDisc);
            hint('wp5-leap', 'Something big is coming down! Run out of the glowing circle!');
          } else if (atk === 'throw') this.windUp('throwWind', TA.throwWind, 'shot', TA.throwWind + clamp(d / 8, 0.45, 1.1));
          else {
            this.cd = toP;
            this.windUp('slideWind', TA.slideWind, 'charge', TA.slideWind + Math.max(0, d - this.touchR) / (10 * Math.sqrt(k)));
            // the slide stops at the arena wall (a bonk), so the stripe is its whole path
            this.tele = G.fx.ground.stripe(this.pos.x, this.arena.h, this.pos.z, this.cd, this.slideLen(this.cd), 2 * this.touchR, { wall: 0.3, end: true });
          }
        }
        break;
      }
      case 'crouch': {
        this.squash = Math.min(1, this.squash + dt * 5);
        const pl = G.player.pos;
        this.to.x = lerp(this.to.x, pl.x, Math.min(1, dt * 6)); this.to.z = lerp(this.to.z, pl.z, Math.min(1, dt * 6));
        this.zoneAt(this.stT / (0.45 + air) * 0.999);
        if (this.st <= 0) {
          this.set('air', air);
          this.from = { x: this.pos.x, z: this.pos.z }; this.body = null;
          sfx('hup', this.at(1.5));
          this.whistle = emitter('leapWhistle', { x: this.pos.x, y: this.pos.y + 2, z: this.pos.z, dur: air });
        }
        break;
      }
      case 'air': {
        const kk = clamp(this.stT / air, 0, 1), pl = G.player;
        if (kk < 0.3) { this.to.x = lerp(this.to.x, pl.pos.x, dt * 4); this.to.z = lerp(this.to.z, pl.pos.z, dt * 4); }
        // the body lands beside Pip when he stands near the disc centre (never around the FP eye); the disc and its
        // damage stay centred on this.to
        const need = this.keepOut + 0.1, dx = this.to.x - pl.pos.x, dz = this.to.z - pl.pos.z, dl = Math.hypot(dx, dz);
        let bx = this.to.x, bz = this.to.z;
        if (dl < need) { const a = dl > 1e-3 ? Math.atan2(dx, dz) : Math.atan2(this.from.x - pl.pos.x, this.from.z - pl.pos.z); bx = pl.pos.x + Math.sin(a) * need; bz = pl.pos.z + Math.cos(a) * need; }
        this.body = this.body || { x: bx, z: bz };
        this.body.x = lerp(this.body.x, bx, Math.min(1, dt * 10)); this.body.z = lerp(this.body.z, bz, Math.min(1, dt * 10));
        this.vel.set(0, 0);
        this.pos.x = lerp(this.from.x, this.body.x, Ease.inOutSine(kk));
        this.pos.z = lerp(this.from.z, this.body.z, Ease.inOutSine(kk));
        this.lift = Math.sin(kk * Math.PI) * 6.5;
        this.zoneAt((0.45 + this.stT) / (0.45 + air));
        if (this.whistle) this.whistle.set(this.pos.x, this.arena.h + this.lift + 1.5, this.pos.z);
        if (Math.random() < 0.6) G.fx.sparkle(this.to.x + rand(-1, 1), this.arena.h + rand(0.3, 5), this.to.z + rand(-1, 1), 0xe8f6ff, 1, 0.2);
        if (this.st <= 0) {
          this.lift = 0; this.squash = 1.3;
          G.fx.ground.remove(this.shadow); this.shadow = null;
          if (this.whistle) { this.whistle.stop(); this.whistle = null; }
          G.cam.shake(1.1); sfx('stomp', this.at(0)); sfx('snow', this.at(0.3));
          G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 30, 1.6);
          G.fx.ground.crack(this.pos.x, this.arena.h, this.pos.z, 2.5);
          // the disc is the damage: inside it (centred on this.to) a landing hurts, unless Pip is in the air (C2) and
          // clear of the body itself
          const dd = len2(pl.pos.x - this.to.x, pl.pos.z - this.to.z), db = len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
          if (dd < TA.frostDisc && (db < this.r + pl.r || (pl.alt ?? 0) <= TA.ringJump)) G.game.playerHurt(TA.bossDmg.leap, this.pos.x, this.pos.z, 10, 'boss');
          this.body = null;
          if (this.enraged) {
            for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; G.game.spawnProjectile('snowball', this.pos.x, this.arena.h + 1.2, this.pos.z, a, 5, { vy: 4, grav: 9 }); }
          }
          this.openFor('recover', 0.9 / k);
        }
        break;
      }
      case 'throwWind':
        this.facing = dampAngle(this.facing, toP, 8, dt);
        this.squash = -Math.sin((this.stT / TA.throwWind) * Math.PI) * 0.4;
        if (this.st <= 0) {
          // a fan of flat throws at Pip's chest height; the middle one (aimed at Pip) gets the landing reticle and the
          // whistle, the others read by their ground shadows
          const n = this.enraged ? 7 : 5, g = 9, pl = G.player;
          const T = clamp(d / TA.snowK, TA.snowT[0], TA.snowT[1]);
          for (let i = 0; i < n; i++) {
            const a = toP + (i - (n - 1) / 2) * 0.22;
            const x0 = this.pos.x + Math.sin(a) * 1.2, y0 = this.arena.h + 2.2, z0 = this.pos.z + Math.cos(a) * 1.2;
            const tx = this.pos.x + Math.sin(a) * d, tz = this.pos.z + Math.cos(a) * d, dd = len2(tx - x0, tz - z0);
            const vy = (g * T) / 2 + (pl.pos.y + 0.5 - y0) / T;
            G.game.spawnProjectile('snowball', x0, y0, z0, Math.atan2(tx - x0, tz - z0), dd / T, { vy, grav: g, scale: 1.4, r: 0.3, target: i === (n - 1) / 2 ? { x: tx, y: G.world.ground(tx, tz), z: tz, T } : null, whistle: i === (n - 1) / 2 });
          }
          sfx('throw', this.at(2.2));
          this.set('recover', 0.6 / k);
        }
        break;
      case 'slideWind':
        this.facing = dampAngle(this.facing, this.cd, 10, dt);
        this.squash = Math.min(0.8, this.squash + dt * 4);
        if (this.stT < this.windDur - TA.stripeLock) this.cd = dampAngle(this.cd, toP, 3, dt);
        if (this.tele) { this.tele.m.rotation.y = this.cd; this.tele.m.material.uniforms.uLen.value = this.tele.len = this.slideLen(this.cd); }
        if (this.st <= 0) { G.fx.ground.remove(this.tele); this.tele = null; this.set('slide', TA.slide[1]); sfx('slide', this.at(0.5)); }
        break;
      case 'slide': {
        const sp = TA.slide[0] * Math.sqrt(k);
        this.vel.set(Math.sin(this.cd) * sp, Math.cos(this.cd) * sp);
        this.facing = this.cd;
        if (Math.random() < 0.8) G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 2, 0.5);
        this.onEdge = () => {
          // bonk: the arena wall ends the slide (the old bounce went on along a path no stripe showed)
          this.vel.set(0, 0);
          this.squash = 1; G.cam.shake(0.5); G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 14, 1); sfx('bonk', this.at(1));
          this.openFor('recover', TA.slide[2]);
        };
        if (this.st <= 0) this.openFor('recover', 0.7);
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(0.85);
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(...TA.cool.peaks) / k; }
        break;
    }
  }
  /** Frostbun's landing disc: follows the target, fill = progress to the landing */
  zoneAt(fill) {
    if (!this.shadow) return;
    G.fx.ground.moveZone(this.shadow, this.to.x, this.arena.h, this.to.z);
    this.shadow.fill = fill;
  }

  /** returns 'hit' | 'dead' | null; swing: the sword's swingId (i-frames only guard against the swing that caused them) */
  hit(dmg, fx, fz, swing = null) {
    if ((this.iframes > 0 && (swing == null || swing === this.iframeSwing)) || this.dying || this.state === 'sleep' || this.state === 'intro') return null;
    if (this.lift > 1.6) return null;
    this.iframeSwing = swing;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = 0.15;
    // damage taken in a row outside an opening (a gap over TA.shrug.gap s starts a new string); an opening's hits are
    // free. Damage, not hits: the Shiny Sword (2 per hit) is shrugged off after two swings, so it pays off in openings
    // and cannot simply out-mash the shove (with hit counting a masher won every fight in 13-17 s)
    this.combo = this.opening ? 0 : (this.t - (this.comboT ?? -9) < TA.shrug.gap ? this.combo || 0 : 0) + Math.max(1, dmg);
    this.comboT = this.t;
    if (this.busy) this.windHits = (this.windHits || 0) + 1;
    this.flash = 1;
    const a = Math.atan2(this.pos.x - fx, this.pos.z - fz);
    if (this.state === 'walk' || this.state === 'stunned' || this.state === 'recover') { this.pos.x += Math.sin(a) * 0.15; this.pos.z += Math.cos(a) * 0.15; }
    this.squash = Math.max(this.squash, 0.35);
    if (this.hp <= 0) { this.startDying(); return 'dead'; }
    return 'hit';
  }
  startDying() {
    this.dying = true;
    this.deathT = 0;
    this.vel.set(0, 0);
    this.lift = 0;
    this.opening = false;
    this.clearTells();
  }
  clearTells() {
    for (const t of [this.tele, this.shadow, this.pre]) if (t) G.fx.ground.remove(t);
    this.tele = this.shadow = this.pre = null;
    if (this.whistle) { this.whistle.stop(); this.whistle = null; }
  }
  updateDying(dt) {
    this.deathT += dt;
    const k = this.deathT;
    // the body stays solid while it bursts: the same no-damage personal space (and game.dynamicColliders keeps its
    // collider until it is gone), so a Pip still holding forward after the last hit never walks inside it
    const pl = G.player, d = this.dist();
    if (d < this.room && !this.dead) this.shove(pl, d);
    this.flash = Math.floor(k * 10) % 2 ? 0.9 : 0.1;
    if (Math.floor(k / 0.3) !== Math.floor((k - dt) / 0.3)) {
      G.fx.burst(this.pos.x + rand(-1, 1), this.arena.h + rand(0.8, 2.6), this.pos.z + rand(-1, 1), [0xfff4a0, 0xffc8e0, 0xc8f0ff][Math.floor(k * 3) % 3], 14, 5);
      G.cam.shake(0.5);
      sfx('bossPop', this.at(1.5));
    }
    if (k > 2.2 && !this.dead) {
      this.dead = true;
      G.fx.burst(this.pos.x, this.arena.h + 1.5, this.pos.z, 0xfff4a0, 40, 9);
      G.fx.poof(this.pos.x, this.arena.h + 0.5, this.pos.z, 0xffffff, 30, 2.4);
      G.cam.shake(1.2);
      sfx('bossDie', this.at(1.5));
      G.scene.remove(this.root);
      G.game.onBossDefeated(this);
    }
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    let sx = 1, sy = 1;
    const sq = this.squash;
    sy -= sq * 0.22; sx += sq * 0.15;
    const n = this.nodes;
    const walking = this.state === 'walk' && this.vel.lengthSq() > 0.1;
    const ph = time * (this.id === 'shores' ? 10 : 6);
    this.root.rotation.z = 0; this.root.rotation.x = 0;
    if (this.state === 'sleep') { sy += Math.sin(time * 1.5) * 0.03; this.root.rotation.z = Math.sin(time * 0.8) * 0.03; }
    if (walking && this.id !== 'shores') this.root.rotation.z = Math.sin(ph) * 0.07;
    // the whole-body tell: lean / rise / swell through the wind-up (eased), shaking a little as it peaks. With Pip
    // close the forward lean, the swell and the crouch's widening shrink (TA.tellNear) so the body never closes in
    // on the FP eye during a tell
    const tell = TELL[this.state];
    let wind = 0;
    if (tell && !this.dying) {
      wind = Ease.outCubic(clamp((this.stT || 0) / Math.max(0.05, this.windDur || 0.5), 0, 1));
      const far = G.player ? clamp((this.dist() - this.room) / TA.tellNear[0], 0, 1) : 1, near = lerp(TA.tellNear[1], 1, far);
      this.root.rotation.x = (tell[0] * (tell[0] > 0 ? near : 1) * TA.lean * Math.PI / 180) * wind;
      p.y += tell[1] * TA.rise * wind;
      sx *= 1 + tell[2] * TA.swell * near * wind;
      if (sq > 0) sx -= sq * 0.15 * (1 - near);
      this.root.rotation.z += Math.sin(time * 38) * 0.015 * wind;
    }
    if (this.state === 'slide') { this.root.rotation.x = 1.2; p.y -= 0.6; }
    if (this.state === 'stunned') this.root.rotation.z = Math.sin(time * 12) * 0.12;
    if (this.dying) { this.root.rotation.z = Math.sin(time * 30) * 0.08; sy *= 1 + Math.sin(time * 20) * 0.05; }
    if (n.legL) { n.legL.rotation.x = walking ? Math.sin(ph) * 0.5 : 0; n.legR.rotation.x = walking ? -Math.sin(ph) * 0.5 : 0; }
    if (this.id === 'shores' && n.legL) { n.legL.rotation.z = Math.sin(ph) * 0.12; n.legR.rotation.z = -Math.sin(ph) * 0.12; n.legL.rotation.x = 0; n.legR.rotation.x = 0; }
    if (n.armL) {
      const raise = this.state === 'chargeWind' || this.state === 'charge' || this.state === 'snapWind' || this.state === 'intro' || this.state === 'crouch' || this.state === 'stompCrouch';
      n.armL.rotation.z = raise ? -0.5 : Math.sin(time * 2) * 0.08;
      n.armR.rotation.z = raise ? 0.5 : -Math.sin(time * 2) * 0.08;
      n.armL.rotation.x = this.state === 'snap' ? -0.8 : walking ? Math.sin(ph) * 0.3 : 0;
      n.armR.rotation.x = this.state === 'snap' ? -0.8 : walking ? -Math.sin(ph) * 0.3 : 0;
    }
    if (n.head) n.head.rotation.x = this.state === 'sleep' ? 0.15 : 0;
    this.root.scale.set(sx, sy, sx);
    // flash: white hit > coral wind-up pulse > gold opening pulse (3 Hz) with sparkles at belly height. Motion comfort
    // holds the wind-up rim steady at about its mean and the dying flicker (5 Hz) at dieCalm (WCAG 2.3.1)
    const calm = !!(G.settings && G.settings.get('reduceMotion'));
    let f = (calm && this.dying ? TA.dieCalm : this.flash) * 0.85, c = WHITE;
    const rim = wind > 0 ? TA.rimFlash * (calm ? TA.rimCalm : 0.6 + 0.4 * Math.sin(time * TA.rimHz * TAU)) : 0;
    const gold = this.opening && !this.dying ? 0.3 * (0.5 + 0.5 * Math.sin(time * 3 * TAU)) : 0;
    if (rim > f) { f = rim; c = DANGER; }
    if (gold > f) { f = gold; c = CHANCE; }
    for (const m of this.mats) {
      if (m.userData.flash) m.userData.flash.value = f;
      if (m.userData.flashColor) m.userData.flashColor.value.copy(c);
    }
  }
  remove() { G.scene.remove(this.root); this.clearTells(); }
}
