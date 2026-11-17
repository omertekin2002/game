// Module wp1-feel: the camera's feel and its cinematics (WP1). It plugs into the ViewController only through the
// extension points (view.feel, addPoseMod, addLookMod) and the event bus, so view.js / game.js stay untouched:
// - FP feel layers (rig-fp.js FeelFP) in feel §6.1 order: head bob on the stride, strafe roll, landing spring (EV.LAND),
//   dash treatment (EV.DASH_START/END: dip, lean, nod, FOV kick; never a somersault), hurt kick away from the source
//   (EV.HURT), sword punch (EV.HIT), FOV channels (sprint, dash, punch, fovPunch, context); all scaled by comfort.js.
// - view.speedFx (C9): 0…1 every render frame, already scaled by the speedFx / reduceMotion settings.
// - lock-on camera (C1, lockon.js), cinematics (shots.js Cine: dialogue framing, item-get, boss intros, dizzy / death,
//   eyelids for wake-up and respawn) and the pedestal / ending staging (cutscenes.js).
// Debug: G.debug.cam.* (merged into the existing G.debug.cam() function by registerDebug).
import { G } from '../core.js';
import { EV } from '../events.js';
import { view as T } from '../tune.js';
import { clamp, Ease, angDiff } from '../util.js';
import { FeelFP } from './rig-fp.js';
import { Comfort } from './comfort.js';
import { LockCam } from './lockon.js';
import { Cine } from './shots.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const r4 = (v) => +(+v).toFixed(4);

const feel = {
  name: 'wp1-feel',
  game: null, view: null, comfort: null, fp: null, lock: null, cine: null,
  t: 0,                        // feel clock (render seconds; holds through hit-stops)
  // head-bob stride phase at the start / end of the last fixed step (interpolated by alpha). It only ever moves forward
  // with the player's walkPhase: walkPhase decays (× 0.9 a step) whenever Pip is not walking in 'normal' / 'frozen'
  // (swinging, dashing, stopping), and a bob read straight from it would run backwards and judder. While it does not
  // advance, the bob holds its phase and its amplitude eases out (bobOn false)
  bp0: 0, bp1: 0, w0: 0, bobOn: false,
  lastFeet: null, swingHit: -1,
  attach(game) {
    this.game = game; this.view = game.view;
    const view = game.view;
    this.comfort = new Comfort(game.settings);
    this.fp = new FeelFP();
    this.lock = new LockCam(this);
    this.cine = new Cine(this);
    view.feel = this;                       // view.kick / fovPunch / lockOn forward here
    view.fp.onSnap = () => this.snapped();  // view.snap() (teleport, respawn, session): drop running feel offsets
    view.speedFx = 0;                       // C9
    view.addPoseMod((M, v, alpha, dt) => this.pose(M, alpha, dt));
    view.addLookMod((L, v) => this.look(L));
    const E = game.events;
    E.on(EV.LAND, (p) => this.fp.onLand(+p.impact || 0, this.comfort));
    E.on(EV.DASH_START, (p) => this.fp.onDash(p.dirX || 0, p.dirZ || 0, view.forward(), view.right(), this.t));
    E.on(EV.DASH_END, () => this.fp.onDashEnd(this.t));
    E.on(EV.HURT, (p) => { if (this.fpWeight() > 0.5) this.fp.hurt(+p.rel || 0, this.comfort); });
    E.on(EV.HIT, (p) => {
      if ((p.kind !== 'enemy' && p.kind !== 'boss') || this.swingHit === game.player.swingId) return;
      this.swingHit = game.player.swingId;
      if (this.fpWeight() > 0.5) this.fp.punch(p.swing, this.comfort, p.kind === 'boss');
    });
    this.cine.listen(E);
    this.registerDebug();
  },
  // ------------------------------------------------------------------ view.feel API (view.js forwards to these)
  /** spring kick, peak degrees (pitch + up, yaw + left, roll + bank left); eye (m, optional) */
  kick(pitchDeg = 0, yawDeg = 0, rollDeg = 0, eye = 0) { this.fp.kick(+pitchDeg || 0, +yawDeg || 0, +rollDeg || 0, +eye || 0, this.comfort); return this.view; },
  /** FOV pulse (vertical degrees; in / hold / out seconds), scaled by the speedFx comfort setting */
  fovPunch(d, a = 0.08, h = 0, o = 0.25) { if (Number.isFinite(+d)) this.fp.fovPunch(+d, +a || 0, +h || 0, +o || 0.25); return this.view; },
  /** lock-on camera behaviour (C1): WP4 picks the target and calls view.lockOn(target) */
  lockOn(target) { this.lock.set(target); return target; },
  // ------------------------------------------------------------------ module hooks
  onSession(isNew) { this.fp.reset(); this.lock.set(null); this.cine.onSession(isNew); this.lastFeet = null; this.syncBob(); },
  onTitle() { this.fp.reset(); this.view.speedFx = 0; this.cine.onTitle(); },
  onModal(m, prev) { this.cine.onModal(m, prev); },
  beforeStep() { this.bp0 = this.bp1; this.w0 = this.game.player.walkPhase; },
  afterStep() {
    const pl = this.game.player, w = pl.walkPhase, d = w - this.w0;
    this.bobOn = d > 1e-6 && (pl.state === 'normal' || pl.state === 'frozen');
    if (!this.bobOn) return;                                   // hold the phase (the amplitude eases out in FeelFP)
    // (almost) no bob showing: re-lock to the stride exactly, forward by whole cycles (the phase never steps back)
    if (this.fp.amp * this.comfort.bob < 0.08) { this.bp1 = w + TAU * Math.ceil((this.bp0 - w) / TAU); return; }
    // phase-lock to walkPhase (footfall = bob minimum) without ever stepping back: the correction is at most half a step
    const e = Math.atan2(Math.sin(w - this.bp1), Math.cos(w - this.bp1));
    this.bp1 += d + clamp(e * 0.25, -0.5 * d, 0.5 * d);
  },
  /** bob phase = the walk phase (snaps, sessions: nothing is bobbing then) */
  syncBob() { const w = this.game ? this.game.player.walkPhase : 0; this.bp0 = this.bp1 = this.w0 = w; this.bobOn = false; },
  frameInput(input, dt) { this.cine.frameInput(dt); },
  beforeCamera(alpha, dt) {
    // self-healing links: view.feel points here (something may have swapped it), and view.lockTarget (C1) is the source
    // of truth for the lock-on camera even if a lockOn call happened while view.feel was missing
    const v = this.view;
    if (!v.feel) v.feel = this;
    if (v.lockTarget !== this.lock.target) this.lock.set(v.lockTarget);
    this.cine.beforeCamera(alpha, dt); this.lock.beforeCamera(dt);
    this.fence();
  },
  /** TP camera keep-in while an arena's vine gate stands (it is no collider): the rig keeps the camera point inside
   *  r + lock.gateIn within the gate's span (+ a soft margin), so it never ends up behind the vines */
  fence() {
    const g = this.game, tp = this.view.tp, V = g.vines, A = g.world.arenas;
    let f = null;
    const fid = g.fight && g.fight.id;                          // the fight's own gate first (another may still be sinking)
    if (V && A && fid && V[fid] && V[fid].k > 0.05) f = A[fid];
    else if (V && A) for (const id in V) { const v = V[id], a = A[id]; if (a && v && v.k > 0.05) { f = a; break; } }
    if (!f) { tp.fence = null; return; }
    const F = tp.fence || (tp.fence = { x: 0, z: 0, r: 0, ang: 0, half: 0, soft: 0, top: 0, open: false });
    F.x = f.x; F.z = f.z; F.r = f.r + T.gate.r; F.ang = f.entAng; F.half = T.gate.half; F.soft = T.gate.soft; F.top = f.h + T.gate.top;
    // a locked boss in the air (Frostbun's leap lands on Pip): the lock boom may pass the gate for the jump (the vines are
    // below the boss and dither around Pip); r1 kept it in, at 0.6–1.2 m, and lost the boss off the top of the frame
    const L = this.lock, b = L.target;
    F.open = !!(L.boss && b && L.active() && (+b.lift || 0) > T.lock.liftAt);
  },
  /** context FOV target (vertical degrees): the cinematics' channel plus the boss fight's +ctx.fight (both views). One
   *  eased channel (FeelFP's ctx tween, inT / outT), so the fight's +3 comes in at the intro's hand-back and leaves at the
   *  defeat / FIGHT_END without a one-frame pop (r2: it was added unsmoothed) */
  ctxFov() {
    const g = this.game, fight = g.fight && g.fight.phase === 'fight' ? T.ctx.fight : 0;
    this.fp.fight = fight;
    return this.cine.ctxFov() + fight;
  },
  snapped() { this.fp.ctxTarget = this.ctxFov(); this.fp.reset(); this.lock.py = null; this.cine.snapped(); this.lastFeet = null; this.syncBob(); },
  fpWeight() { const v = this.view; return (1 - Ease.inOutSine(v.blend)) * (1 - v.shotW); },
  // ------------------------------------------------------------------ per render frame (view.update → pose mods)
  pose(M, alpha, dt) {
    const game = this.game, pl = game.player, view = this.view, C = this.comfort, clock = game.clock;
    const frozen = clock.hitStopT > 0 || clock.frozenFrame;
    if (!frozen) this.t += dt;
    const feet = pl.root.position;
    if (this.lastFeet && Math.hypot(feet.x - this.lastFeet.x, feet.z - this.lastFeet.z) > 3) this.fp.reset(); // teleport / respawn
    this.lastFeet = this.lastFeet || feet.clone(); this.lastFeet.copy(feet);
    const eb = Ease.inOutSine(view.blend), sw = view.shotW;
    const fpW = (1 - eb) * (1 - sw), tpW = eb * (1 - sw);
    const vx = pl.vel.x, vz = pl.vel.y, speed = Math.hypot(vx, vz), rx = -Math.cos(view.yaw), rz = Math.sin(view.yaw);
    const grounded = pl.grounded !== false && !((pl.alt ?? 0) > 0.05);
    const moving = pl.state === 'normal' || pl.state === 'attack' || pl.state === 'frozen';
    const sprintK = pl.sprint && grounded && pl.state === 'normal' ? clamp((speed - T.sprintMin) / (T.sprintFull - T.sprintMin), 0, 1) : 0;
    const a = clock.manual || frozen ? clock.alpha : alpha;
    const s = this._s || (this._s = { right: { x: 0, z: 0 } });
    s.t = this.t; s.dt = dt; s.frozen = frozen; s.phase = this.bp0 + (this.bp1 - this.bp0) * clamp(a, 0, 1);
    // the bob runs only while the stride advances (walking, not swinging / dashing / stopping); strafe roll follows the
    // lateral velocity in every moving state (it is smoothed, so a swing's lunge cannot jolt it)
    s.speed = this.bobOn ? speed : 0; s.lat = moving ? vx * rx + vz * rz : 0; s.grounded = grounded; s.wading = !!pl.wading;
    s.sprintK = sprintK; s.comfort = C; s.fpW = fpW; s.tpW = tpW; s.right.x = rx; s.right.z = rz;
    view.tp.airDrop = Math.max(0, +(pl.alt ?? 0) || 0) * (1 - T.tpAirFollow); // TP pivot follows part of a jump (C2)
    view.tp.aspect = game.camera.aspect;     // the rig's slide keeps Pip off the screen edge (horizontal FOV)
    this.fp.ctxTarget = this.ctxFov();
    const o = this.fp.compute(s);
    M.eye.x += o.x; M.eye.y += o.y; M.eye.z += o.z;
    M.pitch += o.pitch; M.yaw += o.yaw; M.roll += o.roll; M.fov += o.fov;
    view.speedFx = o.speedFx * (1 - sw);      // C9 (WP6 speed lines, WP2 sprint pose)
    this.cine.pose(M, fpW, tpW, dt, frozen);
  },
  /** look modifiers (only while look is allowed): lock-on ease / framing, dialogue soft limits, TP auto-recentre */
  look(L) {
    // this frame's raw input, for later look mods (WP4 target switching): always fresh, never left over from a lock
    L.inDyaw = L.dyaw; L.inDpitch = L.dpitch;
    this.cine.look(L);
    this.lock.look(L);
    this.recenter(L);
  },
  /** TP "Camera drifts behind Pip" (settings.tpAutoRecenter, feel §3.3): pad / touch, after recenter.idle s without look
   *  input while Pip runs, the yaw drifts toward his travel direction (λ recenter.rate, ≤ recenter.max °/s). Never while
   *  locked on, with an enemy within recenter.near m, in dialogue / shots, backpedalling (travel > recenter.back° off the
   *  look), or with "Pip faces where you look" on (strafing is then deliberate) */
  recenter(L) {
    const g = this.game, v = this.view, pl = g.player, S = g.settings, R = T.recenter;
    const idle = !L.mouse && !L.touch && !(L.pad > 0.05);
    this.lookIdle = idle ? (this.lookIdle || 0) + L.dt : 0;
    const dev = g.input && g.input.lastDevice;
    if (!S.get('tpAutoRecenter') || S.get('tpBodyFacesCamera') || v.mode !== 'tp' || v.blend < 1 || v.shotW > 0 || v.lockTarget) return;
    if ((dev !== 'pad' && dev !== 'touch') || this.lookIdle < R.idle || !g.playing || pl.state !== 'normal') return;
    const sp = Math.hypot(pl.vel.x, pl.vel.y);
    if (sp < R.speed) return;
    for (const e of g.enemies) if (e.alive && Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) < R.near) return;
    const d = angDiff(v.yaw + L.dyaw, Math.atan2(pl.vel.x, pl.vel.y));
    if (Math.abs(d) > R.back * D2R) return;
    // running forward-ish it follows; a sideways run drifts at a quarter (the stick is camera-relative: a full-rate drift
    // would spin a strafing Pip in circles)
    const m = R.max * D2R * L.dt * Math.max(R.side, Math.cos(d));
    L.dyaw += clamp(d * (1 - Math.exp(-R.rate * L.dt)), -m, m);
  },
  /** TP "Pip faces where you look" (settings.tpBodyFacesCamera, feel §10: strafe mode): the body faces the look yaw and
   *  the wish strafes (the C1 bodyYaw hook); a lock-on (WP4's hook runs after this one) still faces the target */
  intent(it, canAct) {
    const v = this.view;
    if (canAct && it.mode === 'tp' && it.bodyYaw == null && v.blend > 0.5 && this.game.settings.get('tpBodyFacesCamera')) it.bodyYaw = v.lookYaw;
  },
  // ------------------------------------------------------------------ debug (G.debug.cam.*)
  registerDebug() {
    const self = this, game = this.game, view = this.view;
    game.registerDebug('cam', {
      /** feel layer state: { comfort, fp: { amp, strafe, land, kick, dash, punch, sprint, ctx, out }, speedFx, lock, cine } */
      feel() { return { t: r4(self.t), comfort: self.comfort.info(), fp: self.fp.info(), speedFx: r4(view.speedFx), lock: self.lock.info(), cine: self.cine.info() }; },
      /** simulate WP3's touchdown (C2): EV.LAND { impact, surface } */
      land(impact = 7.4, surface = 'grass') { game.events.emit(EV.LAND, { impact, surface }); return impact; },
      /** simulate a take-off (C2) */
      jump() { game.events.emit(EV.JUMP, {}); return true; },
      kick(p, y, r, e) { self.kick(p, y, r, e); return self.fp.info().kick; },
      fovPunch(d, a, h, o) { self.fovPunch(d, a, h, o); return true; },
      /** per-frame camera trace over n frames of dt (manual clock): { pos, yaw, pitch, roll (deg), fov, eye, arm, shotW, blend } */
      trace(n = 60, dt = 1 / 60, each = null) {
        const out = [];
        for (let i = 0; i < n; i++) {
          if (each) each(i);
          game.runFrame(Array.isArray(dt) ? dt[i % dt.length] : dt, true, false);
          out.push(self.sample());
        }
        return out;
      },
      sample() { return self.sample(); },
      /** live TUNE.view patch (candidate framings, tuning); returns the previous values */
      tune(patch = {}) { const prev = {}; for (const k in patch) { prev[k] = T[k]; T[k] = patch[k]; } if ('tpBoom' in patch) view.tp.boom = T.tpBoom; return prev; },
      /** TP framing of Pip in the current view (renders Pip's layer off-screen): { pipH, pipTop, pipBottom, pipCx, clearM, … } */
      framing(o) { return self.cine.framing(o); },
      lockOn(target) { return view.lockOn(target ?? null); },
      eyelids(k) { return self.cine.lids.set(k); },
    });
  },
  sample() {
    const v = this.view, c = this.game.camera, e = this._e || (this._e = new (c.rotation.constructor)(0, 0, 0, 'YXZ'));
    e.setFromQuaternion(c.quaternion, 'YXZ');
    return { pos: [r4(c.position.x), r4(c.position.y), r4(c.position.z)], eye: [r4(v.eye.x), r4(v.eye.y), r4(v.eye.z)], yaw: r4(v.yaw), pitch: r4(v.pitch), camPitch: r4(e.x / D2R), camYaw: r4(e.y / D2R), roll: r4(e.z / D2R), fov: r4(c.fov), arm: r4(v.armLen), shotW: r4(v.shotW), blend: r4(v.blend), speedFx: r4(v.speedFx), bodyFade: r4(v.bodyFade), steps: this.game.clock.steps };
  },
};

export default feel;
