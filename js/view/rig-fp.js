// First-person rig. RigFP: eye = interpolated feet + eye height; the eye's height is smoothed while grounded (a critically
// damped spring: hides heightfield kinks and step-ups, feel §4.7), exact while airborne and re-seeded on landing; xz is
// never smoothed so aim stays rigid. Then two slots
// other code fills: `off` (view.poseMods' M.eye: bob, dips, dizzy sink — WP1's FeelFP below) and the world's eye keep-out
// (W.eyeKeepOut — WP3).
// FeelFP: the FP camera feel layers in the fixed order of feel §6.1, every one scaled by the comfort settings:
//   pos.xz += right·bobX                       pos.y += bobY + land.y + dashDip + kick.eye
//   yaw    += kick.yaw + punch.yaw             pitch += bobNod + land.nod + dashNod + kick.pitch + punch.pitch
//   roll   += strafeRoll + bobRoll + dashRoll + kick.roll   (|roll| ≤ rollCap)
//   fov    += sprint + dash + punch + context  (clamped to [fovMin, fovMax] around the base)
// The trauma shake comes after (view.js), the shot blend last. None of these change the look yaw / pitch (aim).
import * as THREE from 'three';
import { view as T } from '../tune.js';
import { damp, clamp, Ease } from '../util.js';

const D2R = Math.PI / 180;

export class RigFP {
  constructor() { this.eyeY = null; this.eyeV = 0; this.feetY = null; this.air = false; this.landT = null; this.pos = new THREE.Vector3(); this.onSnap = null; }
  /** view.snap (teleport, respawn, session): also resets the feel layers (onSnap, set by the wp1-feel module) */
  snap(feet) { this.eyeY = feet.y + T.eyeH; this.eyeV = 0; this.feetY = feet.y; this.air = false; this.landT = null; this.pos.set(feet.x, this.eyeY, feet.z); if (this.onSnap) this.onSnap(); }
  /** frozen: hit-stop (the eye must not move at all); airborne: exact height, no filter; off: eye offset (Vector3);
   *  W: the world (its eyeKeepOut(eye, feet) moves the eye out of nearby colliders in place); simT: the clock's simTime
   *  (the step the render feet interpolate toward) */
  update(feet, dt, frozen, grounded = true, off = null, W = null, simT = null) {
    const target = feet.y + T.eyeH, f0 = this.feetY ?? feet.y;
    this.feetY = feet.y;
    // touchdown re-seeds the filter (feel §4.7): while the render feet still interpolate from the last airborne step (the
    // rest of the landing step) the eye stays exact, and it is re-seeded once more on the first frame of the next step,
    // where they reach the ground (r2: the filter engaged half a step above the ground and soaked up 2 cm of the landing
    // dip: 5.7 cm at 83 ms instead of 7.4 at 72)
    let landing = false;
    if (!grounded) { this.air = true; this.landT = null; }
    else if (this.air) { this.air = false; landing = true; this.landT = simT; }
    else if (this.landT != null) { landing = true; if (simT !== this.landT) this.landT = null; }
    if (this.eyeY == null || !grounded || landing || Math.abs(target - this.eyeY) > 0.6) { this.eyeY = target; this.eyeV = 0; }
    else if (!frozen && dt > 0) {
      // grounded: a critically damped spring (ω eyeW) toward the feet + eyeH, sub-stepped with the target moving linearly
      // over the frame, so it smooths the eye's acceleration, not only its position, at any frame rate (r2: the 1 m
      // bilinear terrain kinks change the feet's vertical speed between two frames; a first-order λ 20 / 26 passed them
      // on as 15 / 34 m/s² p95 / max on the peaks path)
      const n = Math.max(1, Math.ceil(dt * 480)), h = dt / n, w = T.eyeW, w2 = w * w, c = 2 * w, d = feet.y - f0;
      let y = this.eyeY, v = this.eyeV;
      for (let i = 1; i <= n; i++) { v += (w2 * (f0 + (d * i) / n + T.eyeH - y) - c * v) * h; y += v * h; }
      this.eyeY = y; this.eyeV = v;
    }
    this.pos.set(feet.x, this.eyeY, feet.z);
    if (off) this.pos.add(off);
    if (W && W.eyeKeepOut) W.eyeKeepOut(this.pos, feet);
    return this.pos;
  }
}

/** damped spring x'' = −ω²x − 2ζωx′, integrated in ≤ 1/480 s substeps (frame-rate independent) */
export class Spring {
  constructor(w, z) { this.w = w; this.z = z; this.x = 0; this.v = 0; }
  /** velocity impulse so that the response from rest peaks at `peak` (one-sided overshoot shape of this ω, ζ) */
  kick(peak) { this.v += peak * this.peakK(); return this; }
  peakK() {
    const w = this.w, z = this.z, wd = w * Math.sqrt(1 - z * z), tp = Math.atan2(wd, z * w) / wd;
    return wd / (Math.exp(-z * w * tp) * Math.sin(wd * tp));
  }
  update(dt) {
    if (this.x === 0 && this.v === 0) return 0;
    const n = Math.max(1, Math.ceil(dt * 480)), h = dt / n, w2 = this.w * this.w, c = 2 * this.z * this.w;
    for (let i = 0; i < n; i++) { this.v += (-w2 * this.x - c * this.v) * h; this.x += this.v * h; }
    if (Math.abs(this.x) < 1e-6 && Math.abs(this.v) < 1e-5) this.x = this.v = 0;
    return this.x;
  }
  reset() { this.x = this.v = 0; }
}

/** the FP layer stack (feel §6): state + one compute per render frame */
export class FeelFP {
  constructor() {
    const L = T.land, K = T.kick;
    this.land = new Spring(L.w, L.z);                     // eye dip (m)
    this.kp = new Spring(K.w, K.z); this.ky = new Spring(K.w, K.z); this.kr = new Spring(K.w, K.z); // kick (deg)
    this.ke = new Spring(K.w, K.z);                       // kick eye y (m)
    this.amp = 0; this.strafe = 0;
    this.dash = null;                                     // { t, end, lat, fwd, back }
    this.punchY = 0; this.punchP = 0; this.punchF = 0;    // deg, decaying at λ punch.lambda
    this.sprint = 0; this.ctx = 0; this.ctxTarget = 0; this.ctxTo = 0; this.ctxFrom = 0; this.ctxT = 0; this.fight = 0;
    this.pulses = [];                                     // fovPunch envelopes { d, a, h, o, t }
    this.held = { x: 0, y: 0, z: 0, ok: false };          // eye offset held through a hit-stop
    this.out = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, fov: 0, bobY: 0, bobX: 0, land: 0, dashDip: 0, fovFx: 0, speedFx: 0 };
  }
  reset() {
    this.ctx = this.ctxFrom = this.ctxTo = this.ctxTarget; this.ctxT = 0;
    this.land.reset(); this.kp.reset(); this.ky.reset(); this.kr.reset(); this.ke.reset();
    this.amp = 0; this.strafe = 0; this.dash = null; this.punchY = this.punchP = this.punchF = 0; this.sprint = 0; this.pulses.length = 0; this.held.ok = false;
  }
  /** touchdown: impact = downward speed (m/s) */
  onLand(impact, comfort) {
    const L = T.land;
    if (!(impact > L.min)) return 0;
    const vi = Math.min(L.max, L.k * impact) * comfort.dip;
    this.land.v -= vi;
    return vi;
  }
  /** spring kick, degrees at the peak (pitch + = up, yaw + = left, roll + = bank left) and eye y (m) */
  kick(p, y, r, eye, comfort) {
    const s = comfort.dip, kp = this.kp.peakK();
    this.kp.v += p * s * kp; this.ky.v += y * s * kp; if (comfort.roll) this.kr.v += r * s * kp;
    if (eye) this.ke.v += eye * s * kp;
  }
  /** directional hurt kick (feel §6.4): rel = the source's bearing from the look (+ = left) */
  hurt(rel, comfort) {
    const H = T.hurt, c = Math.cos(rel), s = Math.sin(rel);
    this.kick(H.pitch * c, -H.yaw * s, -H.roll * s, H.eye, comfort);
  }
  /** dash start: dir · (look forward / right) at the start */
  onDash(dirX, dirZ, f, r, t) {
    const l = Math.hypot(dirX, dirZ) || 1, fwd = (dirX * f.x + dirZ * f.z) / l, lat = (dirX * r.x + dirZ * r.z) / l;
    this.dash = { t, end: null, fwd, lat };
  }
  onDashEnd(t) { if (this.dash && this.dash.end == null) this.dash.end = t; }
  /** sword contact punch (feel §6.6): A / B yaw along the sweep + FOV, C a pitch nod + a bigger FOV pinch; a boss hit
   *  punches harder (feel §8.4: 0.9° / −2.5 FOV; r2 player: the one FP punch since combat.hitPunch no longer kicks) */
  punch(kind, comfort, boss = false) {
    const P = T.punch, k = comfort.speed, yaw = boss ? P.yawBoss : P.yaw, fb = boss ? P.fovBoss : 0;
    if (!k) return;
    if (kind === 'C') { this.punchP = P.pitchC * k; this.punchF = Math.min(this.punchF, Math.min(P.fovC, fb) * k); }
    else { this.punchY = (kind === 'B' ? -yaw : yaw) * k; this.punchF = Math.min(this.punchF, Math.min(P.fov, fb) * k); }
  }
  fovPunch(d, a, h, o) { this.pulses.push({ d, a: Math.max(0, a), h: Math.max(0, h), o: Math.max(1e-3, o), t: 0 }); if (this.pulses.length > 8) this.pulses.shift(); }

  /** s: { t, dt, frozen, phase, speed, lat, grounded, wading, sprintK, comfort, fpW, tpW, right {x,z} } → this.out */
  compute(s) {
    const o = this.out, C = s.comfort, B = T.bob, dt = s.dt;
    // --- head bob (feel §6.2): phase = the stride, footfall = bob minimum
    if (!s.frozen) {
      const want = s.grounded ? Math.min(1, s.speed / B.ref) * (s.sprintK > 0.5 ? B.sprint : 1) : 0;
      this.amp = damp(this.amp, want, s.grounded ? B.rise : B.air, dt);
      if (want === 0 && this.amp < 2e-3) this.amp = 0;
      const sr = s.grounded && C.roll ? clamp(-T.strafeRoll * (s.lat / T.strafeRef), -T.strafeRoll * 1.5, T.strafeRoll * 1.5) : 0;
      this.strafe = damp(this.strafe, sr * C.speed, T.strafeLambda, dt);
      if (sr === 0 && Math.abs(this.strafe) < 1e-3) this.strafe = 0;
    }
    const k = this.amp * C.bob, ph = s.phase, sn = Math.sin(ph), shape = 2 * Math.pow(Math.abs(sn), 0.75) - 1;
    const bobY = k ? B.y * k * shape * (s.wading ? B.wade : 1) : 0, bobX = k ? B.x * k * sn : 0;
    const bobRoll = k && C.roll ? B.roll * k * sn : 0, bobNod = k ? B.nod * k * shape : 0;
    // --- springs: rotation kicks keep running through a hit-stop (render time, feel §2.5); the eye-moving ones (landing,
    // kick eye) hold with the eye, so nothing jumps when the stop ends
    const kp = this.kp.update(dt), ky = this.ky.update(dt), kr = this.kr.update(dt);
    const land = s.frozen ? this.land.x : this.land.update(dt), ke = s.frozen ? this.ke.x : this.ke.update(dt);
    // --- dash treatment (feel §5): eye dip, lean roll toward the dash side, nod, FOV kick; never a somersault
    let dashDip = 0, dashRoll = 0, dashNod = 0, dashFov = 0, dashFx = 0;
    const d = this.dash;
    if (d) {
      const D = T.dash, tau = s.t - d.t, end = d.end ?? Math.max(s.t, d.t + 0.2), te = s.t - end;
      const dip = tau < D.dipIn ? Ease.outQuad(tau / D.dipIn) : tau < D.dipHold ? 1 : tau < D.dipHold + D.dipOut ? 1 - Ease.outBack((tau - D.dipHold) / D.dipOut, 1.1) : 0;
      const lean = tau < D.dipIn ? Ease.outQuad(tau / D.dipIn) : te < 0 ? 1 : te < D.dipOut ? 1 - Ease.inOutSine(te / D.dipOut) : 0;
      const fk = tau < D.fovIn ? Ease.outCubic(tau / D.fovIn) : te < 0 ? 1 : te < D.fovOut ? 1 - Ease.inOutSine(te / D.fovOut) : 0;
      dashDip = -D.dip * dip * C.dip;
      dashRoll = C.roll ? -D.roll * d.lat * lean * C.speed : 0;
      dashNod = (d.fwd > 0 ? -D.nod * d.fwd : D.back * -d.fwd) * lean * C.speed;
      dashFov = fk * C.speed * (D.fov * s.fpW + D.fovTP * s.tpW);
      dashFx = fk;
      if (tau > D.dipHold + D.dipOut && te > Math.max(D.fovOut, D.dipOut)) this.dash = null;
    }
    // --- sword punch (decays λ), FOV pulses (fovPunch), sprint FOV, context FOV (slow)
    const pd = Math.exp(-T.punch.lambda * dt);
    this.punchY *= pd; this.punchP *= pd; this.punchF *= pd;
    if (Math.abs(this.punchY) < 1e-4) this.punchY = 0; if (Math.abs(this.punchP) < 1e-4) this.punchP = 0; if (Math.abs(this.punchF) < 1e-4) this.punchF = 0;
    let pulse = 0;
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]; p.t += dt;
      const e = p.t < p.a ? Ease.outQuad(p.t / p.a) : p.t < p.a + p.h ? 1 : 1 - Ease.inOutSine((p.t - p.a - p.h) / p.o);
      if (p.t >= p.a + p.h + p.o) { this.pulses.splice(i, 1); continue; }
      pulse += p.d * e;
    }
    pulse *= C.speed;
    this.sprint = damp(this.sprint, T.sprintFov * s.sprintK * C.speed, T.sprintLambda, dt);
    if (s.sprintK === 0 && this.sprint < 1e-3) this.sprint = 0;
    // context channel: a finite in-out tween to each new target (reaches it exactly: no endless tail)
    if (this.ctxTarget !== this.ctxTo) { this.ctxFrom = this.ctx; this.ctxTo = this.ctxTarget; this.ctxT = 0; }
    if (this.ctx !== this.ctxTo) {
      this.ctxT += dt;
      const u = clamp(this.ctxT / (this.ctxTo < this.ctxFrom ? T.ctx.inT : T.ctx.outT), 0, 1);
      this.ctx = u >= 1 ? this.ctxTo : this.ctxFrom + (this.ctxTo - this.ctxFrom) * Ease.inOutSine(u);
    }
    // --- compose (FP-weighted where FP-only)
    const w = s.fpW;
    let ex = s.right.x * bobX, ez = s.right.z * bobX, ey = bobY + land + dashDip + ke;
    const H = this.held;
    if (s.frozen && H.ok) { ex = H.x; ey = H.y; ez = H.z; }  // hit-stop: the eye holds exactly still
    else { H.x = ex; H.y = ey; H.z = ez; H.ok = true; }
    o.x = ex * w; o.y = ey * w; o.z = ez * w;
    o.pitch = (bobNod + land * T.land.nod * C.dip + dashNod + kp + this.punchP) * w * D2R;
    o.yaw = (ky + this.punchY) * w * D2R;
    o.roll = clamp(this.strafe + bobRoll + dashRoll + kr, -T.rollCap, T.rollCap) * w * D2R;
    const fovFx = clamp(this.sprint * w + dashFov + this.punchF * w + pulse, T.fovMin, T.fovMax);
    // (the boss-fight +3 rides the context channel since r2 — this.fight is only its share, for info: added here
    // unsmoothed it popped 3° in one frame at the intro's hand-back and at the defeat)
    o.fov = clamp(fovFx + this.ctx, T.fovMin, T.fovMax);
    o.bobY = bobY; o.bobX = bobX; o.land = land; o.dashDip = dashDip; o.fovFx = fovFx;
    o.speedFx = clamp(Math.max(dashFx, s.sprintK * T.sprintSpeedFx), 0, 1) * C.speed;
    return o;
  }
  info() {
    const o = this.out, r = (v, n = 4) => +(+v).toFixed(n);
    return { amp: r(this.amp), strafe: r(this.strafe), land: r(this.land.x), kick: [r(this.kp.x), r(this.ky.x), r(this.kr.x), r(this.ke.x)], dash: !!this.dash, punch: [r(this.punchY), r(this.punchP), r(this.punchF)], sprint: r(this.sprint), ctx: r(this.ctx), ctxTarget: this.ctxTarget, fight: this.fight, out: { y: r(o.y), x: r(o.x), z: r(o.z), pitch: r(o.pitch / D2R), yaw: r(o.yaw / D2R), roll: r(o.roll / D2R), fov: r(o.fov), speedFx: r(o.speedFx) } };
  }
}
