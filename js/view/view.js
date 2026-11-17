// ViewController (arch §4): owns look yaw/pitch, the camera transform, FOV, near plane and camera.layers.
// Look input is applied once per frame before the fixed steps (zero added latency) and frozen for those steps
// (aim/forward/right). The render pose is FP eye ↔ TP boom (0.35 s position blend at identical orientation),
// then trauma shake, then the cinematic shot blend. G.cam is an alias of this controller.
import * as THREE from 'three';
import { G } from '../core.js';
import { EV } from '../events.js';
import { view as T, combat as TC } from '../tune.js';
import { U } from '../toon.js';
import { clamp, lerp, wrapAngle, angDiff, Ease, fwdXZ, rightXZ, yawOf, dir3, smoothstep, LAYER } from '../util.js';
import { RigFP } from './rig-fp.js';
import { RigTP } from './rig-tp.js';
import { Shots } from './shots.js';
import { Shake } from './shake.js';

const D2R = Math.PI / 180;
export const MOUSE_K = 0.0022;                  // rad per mouse count at sensitivity 1 (RULINGS)
const TOUCH_YAW = 0.0050, TOUCH_PITCH = 0.0042;  // rad per CSS px (feel §3.4)
const TOUCH_ACC = [400, 1600];                   // finger speed (px/s) over which the touch gain ramps 1 → 2 (feel §3.4)
const PAD_YAW = 200, PAD_PITCH = 140, PAD_BOOST = 320; // deg/s (feel §3.3)

/** vertical FOV (deg) for a horizontal FOV stored at 16:9, Hor+; narrow screens keep ≥ 70° horizontal up to 100° vertical */
export function vFovFor(hDeg, aspect) {
  let v = 2 * Math.atan(Math.tan((hDeg * D2R) / 2) / (16 / 9));
  if (2 * Math.atan(Math.tan(v / 2) * aspect) < 70 * D2R) v = Math.min(100 * D2R, 2 * Math.atan(Math.tan(35 * D2R) / aspect));
  return v / D2R;
}
export const hFovOf = (vDeg, aspect) => (2 * Math.atan(Math.tan((vDeg * D2R) / 2) * aspect)) / D2R;
/** C1 ease with a flat cruise: peak speed 1.25× linear (in-out sine peaks at 1.57×), so the 3 m eye ↔ boom move stays
 *  under 0.3 m per 60 Hz frame even while walking toward it */
function trapezoid(t, a = 0.2) {
  const v = 1 / (1 - a);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < a) return (v * t * t) / (2 * a);
  if (t > 1 - a) return 1 - (v * (1 - t) * (1 - t)) / (2 * a);
  return v * (t - a / 2);
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _v4 = new THREE.Vector4(), _back = new THREE.Vector3(), _sz = new THREE.Vector2();

export class ViewController {
  constructor({ camera, renderer, settings }) {
    this.camera = camera; this.renderer = renderer; this.settings = settings;
    this.game = null;
    this.mode = 'fp';
    this.yaw = Math.PI; this.pitch = 0; this.roll = 0;
    this.blend = 0;                     // 0 = FP pose, 1 = TP pose (linear; eased when used)
    this.shotW = 0;                     // eased cinematic weight
    this.eye = new THREE.Vector3();     // render-interpolated FP eye
    this.armLen = T.tpBoom;
    this.fovV = 60; this.fovH = 90; this.px = 800; this.near = T.nearFP;
    this.fp = new RigFP(); this.tp = new RigTP(); this.shots = new Shots(); this.shk = new Shake();
    this.assist = null;                 // faceTo ease
    this.limit = null;                  // setLookLimit { center, half }
    this.lockTarget = null;             // lockOn stub (WP1/WP4)
    this.lookAllowed = false;
    this.assistPaused = false;          // Game: the world is paused (menus, shop): assists don't advance
    this.bodyVisible = false;
    this.bodyOut = false;               // render camera out of Pip's head (TP, blends, shots), blink ignored
    this.bodyFade = 0;                  // 0..1 how much of Pip to draw (TP arm close in: RigTP.bodyFade); WP2 dithers by it
    this.occActive = false;
    this.padBoostT = 0;
    this._f = { x: 0, z: -1 }; this._r = { x: 1, z: 0 }; // frozen look basis for this frame's steps
    this._aim = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1, yaw: Math.PI, pitch: 0 };
    // extension points, so packages register from their own files instead of editing applyLook / update:
    // lookMods (WP1 lock-on assist, WP4 aim friction), poseMods (WP1 bob, dips, kicks, FOV channels), feel (WP1 effects)
    this.lookMods = [];                 // fn(L, view): may change L.dyaw / L.dpitch before they apply (see applyLook)
    this.poseMods = [];                 // fn(M, view, alpha, dt): add offsets to M (see update)
    this.feel = null;                   // WP1 object: kick() / fovPunch() / lockOn() forward to it when it has them
    this._L = { dyaw: 0, dpitch: 0, mouse: 0, touch: 0, pad: 0, dt: 0 };
    this.mods = { pitch: 0, yaw: 0, roll: 0, fov: 0, eye: new THREE.Vector3(), pos: new THREE.Vector3() };
    this.lastFovKey = '';
    settings.on('view', (m) => this.setMode(m));
    settings.on('fovFP', () => this.applyFov(true));
    settings.on('fovTP', () => this.applyFov(true));
  }
  attach(game) { this.game = game; this.freezeAim(); }
  get events() { return G.events; }
  get player() { return this.game && this.game.player; }

  // ------------------------------------------------------------------ queries (sim-safe: frozen at applyLook)
  forward() { return this._f; }
  right() { return this._r; }
  /** sword aim for this frame's steps. FP: the eye ray (= the look). TP: from Pip's virtual eye toward the crosshair
   *  ray's point tpConverge m past the pivot (yaw/pitch differ from the look by the shoulder parallax) */
  aim(out = {}) { return Object.assign(out, this._aim); }
  /** sim-time eye: feet + eye height (not interpolated) */
  simEye(out = _w) { const p = this.player.pos; return out.set(p.x, p.y + T.eyeH, p.z); }
  freezeAim() {
    const f = fwdXZ(this.yaw), r = rightXZ(this.yaw);
    this._f.x = f.x; this._f.z = f.z; this._r.x = r.x; this._r.z = r.z;
    this._ly = this.yaw; this._lp = this.pitch;
    const a = this._aim;
    if (this.player) { const e = this.simEye(_v); a.ox = e.x; a.oy = e.y; a.oz = e.z; }
    dir3(this.yaw, this.pitch, _v); a.dx = _v.x; a.dy = _v.y; a.dz = _v.z;
    a.yaw = this.yaw; a.pitch = this.pitch;
    if (this.mode === 'tp' && this.player) {
      // the crosshair ray (from the rig as last rendered: smoothed pivot, eased side leg, centre-shoulder height, ground-hug
      // lift) at tpConverge m past Pip's own shoulder plane, so the swing goes where the crosshair is while moving
      const p = this.player.pos, tp = this.tp, live = tp.live && this.blend >= 1, side = T.tpShoulder * tp.side * tp.sideK, c = TC.tpConverge;
      const sx = (live ? tp.pivot.x : p.x) + r.x * side, sy = live ? tp.pivot.y + tp.lift - (tp.drop || 0) : p.y + T.tpPivot, sz = (live ? tp.pivot.z : p.z) + r.z * side;
      const k = live ? (p.x + r.x * side - sx) * a.dx + (p.y + tp.pivotH(this.shoulderSide()) - sy) * a.dy + (p.z + r.z * side - sz) * a.dz : 0;
      const x = sx + a.dx * (k + c) - a.ox, y = sy + a.dy * (k + c) - a.oy, z = sz + a.dz * (k + c) - a.oz;
      a.yaw = yawOf(x, z); a.pitch = clamp(Math.atan2(y, Math.hypot(x, z)), -60 * D2R, 60 * D2R);
      dir3(a.yaw, a.pitch, _v); a.dx = _v.x; a.dy = _v.y; a.dz = _v.z;
    }
  }
  get aimYaw() { return this._aim.yaw; }
  get aimPitch() { return this._aim.pitch; }
  /** the look yaw/pitch frozen for this frame's steps (movement basis, FP facing) */
  get lookYaw() { return this._ly ?? this.yaw; }
  get lookPitch() { return this._lp ?? this.pitch; }
  /** where self-centred effects spawn: 'chest' | 'head' | 'hand' */
  selfAnchor(kind = 'chest', out = new THREE.Vector3()) {
    const p = this.player.pos;
    if (this.blend < 0.5 && this.shotW < 0.5) {
      const e = this.simEye(out), f = this._f, r = this._r;
      if (kind === 'hand') return e.set(e.x + f.x * 0.5 + r.x * 0.22, e.y - 0.3, e.z + f.z * 0.5 + r.z * 0.22);
      if (kind === 'head') return e.set(e.x + f.x * 0.6, e.y, e.z + f.z * 0.6);
      return e.set(e.x + f.x * 0.8, e.y - 0.3, e.z + f.z * 0.8);
    }
    return out.set(p.x, p.y + (kind === 'head' ? 1.2 : kind === 'hand' ? 0.7 : 0.6), p.z);
  }
  shadowFocus() { return { x: this.eye.x, z: this.eye.z, fx: this._f.x, fz: this._f.z }; }
  occlusionActive() { return this.occActive; }
  /** world → CSS px; never NaN: points at or behind the eye (clip w ≤ 0.05) report behind = true */
  worldToScreen(v, out = {}) {
    const c = this.camera;
    _v4.set(v.x, v.y, v.z, 1).applyMatrix4(c.matrixWorldInverse).applyMatrix4(c.projectionMatrix);
    const w = _v4.w, W = window.innerWidth, H = window.innerHeight;
    out.behind = !(w > 0.05);
    if (out.behind) { out.x = out.y = -9999; out.ndcX = out.ndcY = 0; out.viewZ = 0; out.onScreen = false; out.edgeAngle = Math.atan2(-_v4.x, -_v4.y) || 0; return out; }
    out.ndcX = _v4.x / w; out.ndcY = _v4.y / w; out.viewZ = w;
    out.x = (out.ndcX * 0.5 + 0.5) * W; out.y = (-out.ndcY * 0.5 + 0.5) * H;
    out.onScreen = Math.abs(out.ndcX) <= 1 && Math.abs(out.ndcY) <= 1;
    out.edgeAngle = Math.atan2(out.ndcX, out.ndcY);
    return out;
  }

  // ------------------------------------------------------------------ look
  /** limits follow the linear mode blend, so a pitch outside the TP range eases in at ≤ 100°/s (≤ 2°/frame, feel §11) */
  pitchLimits() {
    const b = this.blend;
    return [lerp(-T.pitchFP, T.pitchTPDown, b) * D2R, lerp(T.pitchFP, T.pitchTPUp, b) * D2R];
  }
  clampLook() {
    const [lo, hi] = this.pitchLimits();
    this.pitch = clamp(this.pitch, lo, hi);
    if (this.limit) { const d = angDiff(this.limit.center, this.yaw); if (Math.abs(d) > this.limit.half) this.yaw = wrapAngle(this.limit.center + Math.sign(d) * this.limit.half); }
    this.yaw = wrapAngle(this.yaw);
  }
  /** per frame, before the steps: mouse counts, touch px and the pad stick → yaw/pitch (drained while not allowed) */
  applyLook(input, dt) {
    const m = input.takeMouse(), tc = input.takeTouch(), st = input.lookStick;
    if (!this.lookAllowed) {
      // input drains, but scripted assists still run (boss intro, chest) and the pitch follows the mode's limits;
      // while the world is paused (pause, map, shop) they wait with it, so a tracked boss intro never runs out early
      if (this.assist && !this.assistPaused) this.runAssist(dt);
      const [lo, hi] = this.pitchLimits();
      this.pitch = clamp(this.pitch, lo, hi);
      this.padBoostT = 0; this.freezeAim(); return;
    }
    const S = this.settings;
    const mk = MOUSE_K * S.get('sens'), inv = S.get('invertY') ? -1 : 1, invX = S.get('invertX') ? -1 : 1;
    let dyaw = -m.x * mk * invX, dpitch = -m.y * mk * inv;
    // touch: × (1 + smoothstep(400, 1600, finger speed px/s)) (feel §3.4: a slow 400 px swipe turns 115°, a flick up to
    // 230°); the speed is this frame's travel over the time since the last frame that brought any (touch events may
    // come at 60 Hz on a 120 Hz display), at most 1/30 s back (a swipe's first move)
    this.touchT = (this.touchT ?? 1) + dt;
    const tl = Math.hypot(tc.x, tc.y);
    let tk = S.get('touchSens');
    if (tl > 0) { tk *= 1 + smoothstep(TOUCH_ACC[0], TOUCH_ACC[1], tl / clamp(this.touchT, 1 / 240, 1 / 30)); this.touchT = 0; }
    dyaw -= tc.x * TOUCH_YAW * tk; dpitch -= tc.y * TOUCH_PITCH * tk;
    if (st && st.m > 0) {
      if (st.m >= 0.98) this.padBoostT += dt; else if (st.m < 0.95) this.padBoostT = 0;
      const ps = S.get('padSens'), pinv = S.get('padInvertY') ? -1 : 1, pinvX = S.get('padInvertX') ? -1 : 1;
      const yr = lerp(PAD_YAW, PAD_BOOST, clamp((this.padBoostT - 0.12) / 0.3, 0, 1));
      dyaw -= st.x * yr * D2R * ps * dt * pinvX;
      dpitch -= st.y * PAD_PITCH * D2R * ps * dt * pinv;
    } else this.padBoostT = 0;
    if (this.lookMods.length) {
      // L: this frame's look deltas (rad) + how much each device moved (mouse counts, touch px, stick magnitude)
      const L = this._L;
      L.dyaw = dyaw; L.dpitch = dpitch; L.mouse = Math.abs(m.x) + Math.abs(m.y); L.touch = Math.abs(tc.x) + Math.abs(tc.y); L.pad = st ? st.m : 0; L.dt = dt;
      this.runMods(this.lookMods, 'lookMod', L);
      if (Number.isFinite(L.dyaw) && Number.isFinite(L.dpitch)) { dyaw = L.dyaw; dpitch = L.dpitch; }
    }
    if (this.assist && !this.assist.lock && (Math.abs(m.x) + Math.abs(m.y) > 2 || (st && st.m > 0.3) || Math.abs(tc.x) + Math.abs(tc.y) > 2)) this.assist = null;
    this.yaw += dyaw; this.pitch += dpitch;
    if (this.assist) this.runAssist(dt);
    this.clampLook();
    this.freezeAim();
  }
  runAssist(dt) {
    const a = this.assist;
    a.t += dt;
    const e = this.simEye(_v), dx = a.x - e.x, dz = a.z - e.z;
    const k = Ease.inOutSine(clamp(a.t / a.dur, 0, 1));
    this.yaw = a.yaw0 + angDiff(a.yaw0, yawOf(dx, dz)) * k;
    if (a.pitch) this.pitch = lerp(a.p0, clamp(Math.atan2(a.y - e.y, Math.hypot(dx, dz)), -0.6, 0.6), k);
    if (a.t >= a.dur + a.hold) this.assist = null;   // hold: keep tracking the point after the ease
  }
  /** instant absolute look (cancels assists); also refreshes this frame's frozen aim */
  setLook(yaw, pitch = 0) {
    if (!Number.isFinite(yaw)) yaw = this.yaw;          // never let a bad value turn the view NaN
    if (!Number.isFinite(pitch)) pitch = 0;
    this.yaw = yaw; this.pitch = pitch; this.assist = null;
    this.clampLook(); this.freezeAim();
    return { yaw: this.yaw, pitch: this.pitch };
  }
  /** instant look at a world point from the eye (pitch clamped to ±maxPitch) */
  lookAtPoint(x, y, z, maxPitch = 1.5) {
    const e = this.simEye(_v), dx = x - e.x, dz = z - e.z;
    return this.setLook(yawOf(dx, dz), clamp(Math.atan2(y - e.y, Math.hypot(dx, dz)), -maxPitch, maxPitch));
  }
  /** eased look assist toward a point; any real look input cancels it unless lock; hold (s) keeps tracking it after */
  faceTo(x, y, z, { dur = 0.3, pitch = true, lock = false, hold = 0 } = {}) {
    this.assist = { x, y, z, dur: Math.max(0.01, dur), pitch, lock, hold, t: 0, yaw0: this.yaw, p0: this.pitch };
  }
  /** move the running faceTo assist's point (a subject that moves while it is tracked); no-op without an assist */
  retarget(x, y, z) { const a = this.assist; if (a) { a.x = x; a.y = y; a.z = z; } }
  setLookLimit(center, half) { this.limit = center == null ? null : { center, half }; }
  /** lock-on target (WP4 picks it) → lockTarget; the camera behaviour is WP1's (view.feel.lockOn, look / pose mods) */
  lockOn(target) {
    this.lockTarget = target || null;
    const f = this.feel; if (f && f.lockOn) f.lockOn(this.lockTarget);
    return this.lockTarget;
  }

  // ------------------------------------------------------------------ extension points
  /** look modifier fn(L, view), run in applyLook (only while look is allowed) after the device deltas and before they
   *  apply: L = { dyaw, dpitch (rad, this frame), mouse (counts), touch (px), pad (stick magnitude), dt }. Scale, add or
   *  replace L.dyaw / L.dpitch (aim friction, lock-on ease while input is idle). → off() */
  addLookMod(fn) { this.lookMods.push(fn); return () => { const i = this.lookMods.indexOf(fn); if (i >= 0) this.lookMods.splice(i, 1); }; }
  /** pose modifier fn(M, view, alpha, dt), run every render frame before the rigs: add to M = { eye (Vector3: FP eye
   *  offset before the eye keep-out: bob, landing dip, dizzy sink), pos (Vector3: camera offset, both modes), pitch, yaw,
   *  roll (rad, on top of the look + shake), fov (vertical degrees, before shots) }; M is zeroed each frame. → off() */
  addPoseMod(fn) { this.poseMods.push(fn); return () => { const i = this.poseMods.indexOf(fn); if (i >= 0) this.poseMods.splice(i, 1); }; }
  /** a throwing modifier never stops the frame (counted in game.modErrs as view.<kind>) */
  runMods(list, kind, a, b, c) {
    for (const f of list) {
      try { f(a, this, b, c); } catch (e) { if (this.game) this.game.modError({ name: 'view' }, kind, e); }
    }
  }

  // ------------------------------------------------------------------ effects
  /** legacy scale 0.15..1.2; src {x, z} attenuates by distance from the eye */
  shake(amount, src = null) { this.shk.add(amount, src ? Math.hypot(src.x - this.eye.x, src.z - this.eye.z) : null); }
  /** spring kick in degrees (hurt flinch, landing, hits): forwarded to view.feel (WP1), a no-op until it exists */
  kick(pitchDeg, yawDeg = 0, rollDeg = 0) { const f = this.feel; if (f && f.kick) f.kick(pitchDeg, yawDeg, rollDeg); return this; }
  /** FOV punch (vertical degrees, in / hold / out seconds): forwarded to view.feel (WP1), a no-op until it exists */
  fovPunch(deltaDegV, inSec, holdSec, outSec) { const f = this.feel; if (f && f.fovPunch) f.fovPunch(deltaDegV, inSec, holdSec, outSec); return this; }

  // ------------------------------------------------------------------ cinematics
  /** setShot({ pos, look | quat, fov, speed, cut, priority }) → token; legacy setShot(pos, look, { speed }) is accepted */
  setShot(a, b, c) {
    const o = a && a.isVector3 ? Object.assign({ pos: a, look: b }, c || {}) : a;
    const cam = this.camera;
    return this.shots.set(o, { pos: cam.position, quat: cam.quaternion, fov: cam.fov });
  }
  /** hand-back rule: face the subject first (face {x,y,z}), then blend out to the live gameplay pose */
  clearShot(token, { face = null, speed = 1.8 } = {}) {
    if (!this.shots.clear(token, speed)) return false;
    if (face) this.lookAtPoint(face.x, face.y, face.z, 0.5);
    return true;
  }

  // ------------------------------------------------------------------ mode
  shoulderSide() { const s = this.settings.get('tpShoulder'); return s === 'left' ? -1 : s === 'center' ? 0 : 1; }
  setMode(mode, { instant = false } = {}) {
    if (mode !== 'fp' && mode !== 'tp') return this.mode;
    const prev = this.mode;
    if (mode === prev && !instant) return mode;
    const pl = this.player;
    if (mode === 'tp' && (this.blend <= 0 || instant) && pl) this.tp.snap(pl.root.position, this.shoulderSide());
    this.mode = mode;
    if (instant) { this.blend = mode === 'tp' ? 1 : 0; this.bodyOut = this.blend > 0 || this.shotW > 0; }
    if (mode !== prev && this.events) this.events.emit(EV.VIEW_MODE, { mode, prev });
    return mode;
  }
  /** V / pad RB: flips the live mode (which ?view= may have set apart from the setting), then persists it */
  toggleMode() { const m = this.mode === 'fp' ? 'tp' : 'fp'; this.setMode(m); this.settings.set('view', m); return m; }
  swapShoulder() { const s = this.settings.get('tpShoulder'); return this.settings.set('tpShoulder', s === 'right' ? 'left' : 'right'); }
  zoom(wheelDy) { if (this.mode === 'tp') this.tp.zoom(wheelDy); }
  /** reset smoothing (teleport, respawn, session start) */
  snap() {
    const pl = this.player;
    if (!pl) return;
    pl.root.position.copy(pl.pos);
    this.fp.snap(pl.pos);
    this.tp.snap(pl.pos, this.shoulderSide());
    this.blend = this.mode === 'tp' ? 1 : 0;
    if (!this.shots.cur) { this.shots.reset(); this.shotW = 0; } // a shot still blending out is cut (session start, respawn)
    this.bodyOut = this.blend > 0 || this.shotW > 0;
    this.assist = null;
    this.shk.reset();
    this.freezeAim();
  }

  // ------------------------------------------------------------------ FOV
  baseFov(aspect = this.camera.aspect) {
    const S = this.settings, e = Ease.inOutSine(this.blend);
    return lerp(vFovFor(S.get('fovFP'), aspect), vFovFor(S.get('fovTP'), aspect), e);
  }
  /** the one place camera.fov changes; also rescales point sprites (particles, halos) for the new FOV */
  applyFov(force = false, v = this.fovV, near = this.near) {
    const c = this.camera;
    if (force) v = this.fovV = this.shotW > 0 ? v : this.baseFov();
    if (!force && Math.abs(c.fov - v) < 1e-5 && c.near === near) return;
    c.fov = v; c.near = near;
    c.updateProjectionMatrix();
    this.fovH = hFovOf(v, c.aspect);
    const bh = this.renderer.getDrawingBufferSize(_sz).y;
    this.px = bh / (2 * Math.tan((v * D2R) / 2));
    const game = this.game;
    if (game) { game.fx.setScale(this.px); if (game.halos) game.halos.uScale.value = this.px; }
    const key = v.toFixed(2) + '/' + bh;
    if (force && key !== this.lastFovKey && this.events) { this.lastFovKey = key; this.events.emit(EV.FOV, { v: +v.toFixed(3), h: +this.fovH.toFixed(3), px: +this.px.toFixed(2) }); }
  }
  onResize(w, h) { this.camera.aspect = w / h; this.applyFov(true); }

  // ------------------------------------------------------------------ per render frame
  update(alpha, dt) {
    const game = this.game, pl = game.player, cam = this.camera, S = this.settings;
    const feet = pl.root.position;            // interpolated by Player.render
    const frozen = game.clock.hitStopT > 0 || game.clock.frozenFrame;
    // pose modifiers (WP1 …): offsets for this frame; a non-finite result is dropped whole
    const M = this.mods;
    M.pitch = M.yaw = M.roll = M.fov = 0; M.eye.set(0, 0, 0); M.pos.set(0, 0, 0);
    if (this.poseMods.length) {
      this.runMods(this.poseMods, 'poseMod', M, alpha, dt);
      if (![M.pitch, M.yaw, M.roll, M.fov, M.eye.x, M.eye.y, M.eye.z, M.pos.x, M.pos.y, M.pos.z].every(Number.isFinite)) { M.pitch = M.yaw = M.roll = M.fov = 0; M.eye.set(0, 0, 0); M.pos.set(0, 0, 0); }
    }
    // FP eye: interpolated feet + eye height (+ M.eye), then the world's eye keep-out (W.eyeKeepOut, WP3)
    const eye = this.eye.copy(this.fp.update(feet, dt, frozen, pl.grounded !== false, M.eye, game.world, game.clock.simTime));
    // FP ↔ TP blend (position only; orientation is the look in both)
    const target = this.mode === 'tp' ? 1 : 0;
    const blending = this.blend !== target;
    if (blending) this.blend = target > this.blend ? Math.min(1, this.blend + dt / T.modeBlend) : Math.max(0, this.blend - dt / T.modeBlend);
    const e = Ease.inOutSine(this.blend);
    const pos = _v.copy(eye);
    if (this.blend > 0) {
      dir3(this.yaw, this.pitch, _back).multiplyScalar(-1);
      const tanHalf = Math.tan((vFovFor(S.get('fovTP'), cam.aspect) * D2R) / 2);
      // r2 part 3: a narrow screen widens the vertical FOV (≤ 100°): the boom shortens by the same factor, so Pip keeps his
      // height share (a portrait phone, the TP default there, showed him at 15 % of the height instead of ≈ 31 %)
      this.tp.narrow = Math.tan((vFovFor(S.get('fovTP'), 16 / 9) * D2R) / 2) / tanHalf;
      const tpCam = this.tp.update(feet, _back, this._r, frozen ? 0 : dt, game.world, this.shoulderSide(), tanHalf);
      this.armLen = this.tp.arm;
      pos.lerp(tpCam, trapezoid(this.blend));
    }
    // shake (rotation; TP adds a little translation)
    const comfort = S.get('reduceMotion');
    this.shk.update(dt, S.get('shake') * (comfort ? 0.25 : 1), e, comfort || !S.get('cameraRoll'));
    pos.x += this.shk.dx + M.pos.x; pos.y += this.shk.dy + M.pos.y; pos.z += this.shk.dz + M.pos.z;
    _e.set(this.pitch + this.shk.p + M.pitch, this.yaw + Math.PI + this.shk.y + M.yaw, this.roll + this.shk.r + M.roll, 'YXZ');
    const quat = _q.setFromEuler(_e);
    let fov = clamp(this.baseFov() + M.fov, 10, 150);
    let near = e < 0.5 ? T.nearFP : T.nearTP;
    // cinematic shot
    const k = this.shots.update(dt);
    this.shotW = k;
    const sp = this.shots.pose;
    if (k > 0 && sp) {
      pos.lerp(sp.pos, k);
      quat.slerp(sp.quat, k);
      if (sp.fov) fov = lerp(fov, sp.fov, k);
      if (k > 0.5) near = T.nearTP;
    }
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    this.fovV = fov; this.near = near;
    this.applyFov(false, fov, near);
    if (blending && this.blend === target && k <= 0) { this.applyFov(true); this.applyFov(false, fov, near); } // settled: announce the new base FOV, keep this frame's
    // Pip's body: hidden from the eye, visible whenever the camera is out of the head (TP, shots, blends)
    const dEye = pos.distanceTo(eye);
    this.bodyOut = dEye > 0.4;                  // camera out of the head (Player eases its FP facing while true)
    // RULINGS band by the real camera-to-head distance in every pose (the V blend, a shot leaving the eye), and in settled
    // TP also by the arm (the shoulder point sits beside the head): no solid hood over the crosshair mid-blend
    this.bodyFade = !this.bodyOut ? 0 : Math.min(this.tp.bodyFade(dEye), this.blend >= 1 && k <= 0 ? this.tp.bodyFade(this.armLen) : 1);
    this.bodyVisible = this.bodyOut && !pl.blinkOff && this.bodyFade > 0;
    // the dither uniform (player-body.js) follows this frame's fade: Player.render runs before the camera, a frame late
    if (pl.fadeU) pl.fadeU.value = this.bodyOut ? this.bodyFade : 1;
    cam.layers.set(LAYER.WORLD);
    if (this.bodyVisible) cam.layers.enable(LAYER.BODY);
    cam.updateMatrixWorld();
    this.updateOcclusion(feet, k);
  }
  /** occluder dither: off in FP and during shots; in TP a backstop around Pip's projected body */
  updateOcclusion(feet, k) {
    this.occActive = this.blend > 0.5 && k <= 0.02 && this.bodyVisible;
    if (!this.occActive) { U.uOccR.value = 1; U.uOccC.value.set(-9999, -9999); return; }
    const c = this.camera, size = this.renderer.getDrawingBufferSize(_sz);
    _w.set(feet.x, feet.y + 0.5, feet.z);
    const viewZ = -_v.copy(_w).applyMatrix4(c.matrixWorldInverse).z;
    if (viewZ < 0.2) { U.uOccR.value = 1; U.uOccC.value.set(-9999, -9999); return; }
    _w.project(c);
    U.uOccC.value.set((_w.x * 0.5 + 0.5) * size.x, (_w.y * 0.5 + 0.5) * size.y);
    U.uOccR.value = (1.15 * 0.6 * size.y) / (2 * Math.tan((c.fov * D2R) / 2) * viewZ);
    U.uOccDepth.value = viewZ - 0.35;
  }
  /** debug / tests snapshot */
  info() {
    const c = this.camera, p = c.position;
    return {
      mode: this.mode, blend: +this.blend.toFixed(3), yaw: +this.yaw.toFixed(6), pitch: +this.pitch.toFixed(6),
      fovV: +this.fovV.toFixed(3), fovH: +this.fovH.toFixed(3), near: c.near, px: +this.px.toFixed(2),
      pos: [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)], eye: [+this.eye.x.toFixed(4), +this.eye.y.toFixed(4), +this.eye.z.toFixed(4)],
      quat: [c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w].map((v) => +v.toFixed(6)),
      armLen: +this.armLen.toFixed(3), boom: +this.tp.boom.toFixed(2), shotW: +this.shotW.toFixed(3), shot: this.shots.cur ? this.shots.cur.token : 0,
      bodyVisible: this.bodyVisible, bodyFade: +this.bodyFade.toFixed(3), bodyLayer: c.layers.isEnabled(LAYER.BODY), occ: this.occActive, lookAllowed: this.lookAllowed,
      assist: !!this.assist, limit: this.limit, trauma: +this.shk.trauma.toFixed(3),
    };
  }
}
