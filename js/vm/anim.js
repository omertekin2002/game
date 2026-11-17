// WP2 viewmodel pose math (art §1.3–1.4, feel §7–8.3). A pose is P (grip centre, vm camera space, metres), B (grip /
// blade direction) and A (forearm direction, wrist → elbow); the hand basis is X = B × A, Y = B, Z = X × Y and the
// forearm basis Y = A, X = the same X (so the sleeve rolls with the hand). Poses blend by lerp + slerp.
// Swings are generated, not keyframed: the blade always passes through the sweep point K, the sim's sweep bearing (A/B)
// or chop pitch (C) carried into the vm camera (same screen point as in the world camera), so the blade crosses the
// crosshair exactly when the hit test does, and the hit-stop freezes on the contact pose.
import * as THREE from 'three';
import { clamp, lerp, Ease } from '../util.js';

const D2R = Math.PI / 180;
const REF = 0.40;   // depth at which the aspect offsets are measured (viewmodel.js layout)
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _k = new THREE.Vector3(), _p = new THREE.Vector3();

export class Pose {
  constructor() { this.P = new THREE.Vector3(); this.Q = new THREE.Quaternion(); this.F = new THREE.Quaternion(); }
  copy(o) { this.P.copy(o.P); this.Q.copy(o.Q); this.F.copy(o.F); return this; }
  /** from position + blade direction + forearm direction (need not be unit) */
  set(P, B, A) {
    this.P.copy(P);
    _y.copy(B).normalize(); _a.copy(A).normalize();
    _x.crossVectors(_y, _a);
    if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0); else _x.normalize();
    _z.crossVectors(_x, _y);
    this.Q.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    // forearm: Y = A, X = X (made ⊥ A), Z = X × A
    _x.addScaledVector(_a, -_x.dot(_a)).normalize();
    _z.crossVectors(_x, _a);
    this.F.setFromRotationMatrix(_m.makeBasis(_x, _a, _z));
    return this;
  }
  /** from a 9-array [Px, Py, Pz, Bx, By, Bz, Ax, Ay, Az]; s scales P (art values at vFOV 50 → × 0.915 at 54) */
  arr(a, s = 1, off = null) {
    _p.set(a[0] * s, a[1] * s, a[2] * s);
    if (off) _p.addScaledVector(off, -_p.z / REF);
    this.set(_p, _b.set(a[3], a[4], a[5]), _a.set(a[6], a[7], a[8]));
    return a[9] ? this.roll(a[9] * D2R) : this;
  }
  /** turn the hand about its own grip axis (supination; the forearm keeps its direction) */
  roll(r) { this.Q.multiply(_q.setFromAxisAngle(_y.set(0, 1, 0), r)); return this; }
  lerp(a, b, k) { this.P.lerpVectors(a.P, b.P, k); this.Q.slerpQuaternions(a.Q, b.Q, k); this.F.slerpQuaternions(a.F, b.F, k); return this; }
  /** move toward o by factor k (k = 1 − e^{−λ dt}) */
  toward(o, k) { return this.lerp(this, o, k); }
  /** blade direction (hand +Y) */
  blade(out) { return out.set(0, 1, 0).applyQuaternion(this.Q); }
}

/** screen mapping from the world camera to the vm camera: a direction at world bearing a / elevation e (relative to the
 *  view) lands on the same pixel as the vm direction with tan a' = kx·tan a, tan e' = ky·tan e */
export function vmDir(out, a, e, kx, ky) {
  const tx = kx * Math.tan(a), ty = ky * Math.tan(e) * Math.sqrt(1 + tx * tx);
  return out.set(-tx, ty, -1).normalize();
}

/** forearm direction toward the shoulder S from the hand P, with the elbow sagging by `sag` */
export function armDir(out, P, S, sag = 0.08) { return out.copy(S).sub(P).normalize().add(_k.set(0, -sag, 0)).normalize(); }

/** quadratic Bézier through three points at u */
function bez(out, p0, p1, p2, u) {
  const v = 1 - u;
  return out.set(v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1], v * v * p0[2] + 2 * v * u * p1[2] + u * u * p2[2]);
}

/**
 * Slash pose for A (dir +1: right → left, a falling diagonal) or B (dir −1: left → right, rising) at sweep progress u
 * (0 = sweep start, 1 = sweep end; > 1 = follow-through overrun) with the sim's sweep bearing a (rad, + = left).
 * T = TUNE.vm. The hand travels a Bézier arc; the blade points from the hand through K (the sweep point at radius
 * T.slashK, elevation from T.slashE), so the blade covers the target's screen x when the sim hits it.
 */
export function slashPose(out, T, dir, u, a, kx, ky, off, S, e0 = 0, floor = null) {
  const path = dir > 0 ? T.pathA : T.pathB, el = dir > 0 ? T.elevA : T.elevB;
  const uu = clamp(u, 0, 1), w = u > 1 ? Math.min(1, (u - 1) / 0.25) : 0, fi = dir > 0 ? 0 : 1;
  // past the sweep end the blade wraps on: its point drifts back toward the centre and up (B) / down (A), on screen
  const e = (lerp(el[0], el[1], uu) + T.followE[fi] * w) * D2R + e0;
  a -= dir * T.followA[fi] * D2R * w;
  vmDir(_k, a, e, kx, ky).multiplyScalar(T.slashK + T.slashKBulge * Math.sin(Math.PI * uu));
  bez(_p, path[0], path[1], path[2], uu);
  if (u > 1) _p.add(_a.set(-dir * T.overrun[0], T.overrun[1], T.overrun[2]).multiplyScalar(Math.min(1, (u - 1) / 0.25)));
  if (off) _p.addScaledVector(off, -_p.z / REF);
  _b.copy(_k).sub(_p);
  const d = _b.length();
  if (d > T.reachMax) _p.copy(_k).addScaledVector(_b.normalize(), -T.reachMax);   // K stays on the blade
  else if (d < T.reachMin) _p.copy(_k).addScaledVector(_b.normalize(), -T.reachMin);
  // r3: past the sweep the grip never sinks below floor (tan of its screen height, at unit depth): the fist stays at the
  // bottom edge instead of dropping out of the frame for the follow-through and the recovery (recoverPose)
  if (floor != null && u > 1) _p.y = Math.max(_p.y, floor * -_p.z);
  _b.copy(_k).sub(_p).normalize();
  // follow-through: the wrist rolls over, the tip drops (A) / lifts less (B) past the sweep end
  if (u > 1) { _b.y -= T.rollOver[dir > 0 ? 0 : 1] * Math.min(1, (u - 1) / 0.25); _b.normalize(); }
  out.set(_p, _b, armDir(_a, _p, S, T.elbowSag));
  return T.slashRoll ? out.roll(dir * T.slashRoll * D2R) : out;
}

/**
 * Chop pose (C) at pitch offset e (rad, the sim's chopAt relative to the aim) and bearing a: K on the chop ray, the hand
 * on a path below and right of it, the blade from the hand through K.
 */
export function chopPose(out, T, u, e, kx, ky, off, S, ux = 0.688) {
  // the chop line bends from upper right to lower left and passes the crosshair's bearing (0) at the crossing ux
  const uu = clamp(u, 0, 1), A = T.chopA, a = uu < ux ? lerp(A[0], A[1], uu / ux) : lerp(A[1], A[2], (uu - ux) / (1 - ux));
  vmDir(_k, a * D2R, e, kx, ky).multiplyScalar(T.chopK);
  bez(_p, T.pathC[0], T.pathC[1], T.pathC[2], uu);
  if (off) _p.addScaledVector(off, -_p.z / REF);
  _b.copy(_k).sub(_p);
  const d = _b.length();
  if (d > T.reachC) _p.copy(_k).addScaledVector(_b.normalize(), -T.reachC);
  else if (d < T.reachMin) _p.copy(_k).addScaledVector(_b.normalize(), -T.reachMin);
  _b.copy(_k).sub(_p).normalize();
  return out.set(_p, _b, armDir(_a, _p, S, T.elbowSag));
}

/** recovery from a swing's end pose back to rest along a low arc (the blade never swings back up through the
 *  centre): P on a Bézier dipping recDip below both ends, the rotations through the lowered carry pose. floor (r3, tan of
 *  a screen height at unit depth): the grip stays at or above it (a start below it rises to it over the first 30 %), so
 *  the hand travels back along the bottom edge in view instead of dipping out of the frame and popping in at the rest */
export function recoverPose(out, from, rest, low, x, dip, floor = null) {
  const v = 1 - x;
  _p.lerpVectors(from.P, rest.P, 0.5); _p.y = Math.min(from.P.y, rest.P.y) - dip;
  out.P.set(v * v * from.P.x + 2 * v * x * _p.x + x * x * rest.P.x, v * v * from.P.y + 2 * v * x * _p.y + x * x * rest.P.y, v * v * from.P.z + 2 * v * x * _p.z + x * x * rest.P.z);
  if (floor != null) {
    const f0 = from.P.y / -from.P.z, f = Math.min(floor, f0 + (floor - f0) * clamp(x / 0.3, 0, 1));
    out.P.y = Math.max(out.P.y, f * -out.P.z);
  }
  // quadratic slerp (de Casteljau) from → low → rest. (r3: written as out.Q.slerpQuaternions(_q, out.Q, k) it copied _q into
  // out.Q before reading it, so the hand only ever turned toward the carry pose and the rest spring finished the turn
  // after the swing)
  const k = clamp(x, 0, 1);
  _q.slerpQuaternions(from.Q, low.Q, k); _q2.slerpQuaternions(low.Q, rest.Q, k); out.Q.slerpQuaternions(_q, _q2, k);
  _q.slerpQuaternions(from.F, low.F, k); _q2.slerpQuaternions(low.F, rest.F, k); out.F.slerpQuaternions(_q, _q2, k);
  return out;
}

/** Render-side stride phase (r2). player.walkPhase changes once per fixed step, and whenever Pip is not walking in
 *  'normal' / 'frozen' it decays × 0.9 a step (it runs backwards, tens of radians a step after a long walk), so motion read
 *  straight from it ticked at 60 Hz on a faster screen (the FP hand still on 227 of 399 frames at 144 Hz) and flailed as
 *  Pip stopped or swung. This phase moves forward with walkPhase, holds while it does not advance, phase-locks to it
 *  gently (≤ half a step per step, so footfalls stay in sync with the step sounds) and is interpolated between the last
 *  two steps like the world (alpha). The viewmodel owns one (its beforeStep / afterStep hooks); the FP hands' bob and
 *  sprint pump, the FP boots and Pip's TP legs read it (player.stride). */
export class Stride {
  constructor() { this.p0 = 0; this.p1 = 0; this.w0 = 0; }
  sync(pl) { this.p0 = this.p1 = this.w0 = +pl.walkPhase || 0; }
  before(pl) { this.p0 = this.p1; this.w0 = +pl.walkPhase || 0; }
  after(pl) {
    const w = +pl.walkPhase || 0, d = w - this.w0;
    if (!(d > 1e-6)) return;                                       // not walking: hold
    const e = Math.atan2(Math.sin(w - this.p1), Math.cos(w - this.p1));
    this.p1 += d + clamp(e * 0.25, -0.5 * d, 0.5 * d);
    if (!Number.isFinite(this.p1)) this.sync(pl);
  }
  /** the phase this render frame (alpha: the clock's render phase) */
  at(alpha) { return this.p0 + (this.p1 - this.p0) * clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1); }
}

/** A/B sweep bearing at attackT t (same formula as combat.sweepAt): rad, + = left */
export function sweepAt(TC, kind, t) {
  const [s0, s1] = TC.sweepAB, k = Ease.outCubic(clamp((t - s0) / (s1 - s0), 0, 1));
  const a = (-TC.arc + 2 * TC.arc * k) * D2R;
  return kind === 'B' ? -a : a;
}
/** C chop pitch offset at attackT t (as combat.chopAt) */
export function chopAt(TC, t) {
  const [s0, s1] = TC.sweepC, k = clamp((t - s0) / (s1 - s0), 0, 1);
  return (TC.chopUp + (TC.chopDown - TC.chopUp) * k * k) * D2R;
}
/** attackT at which the A/B sweep reaches bearing th (inverse of sweepAt) */
export function sweepTimeAt(TC, kind, th) {
  const [s0, s1] = TC.sweepAB, arc = TC.arc * D2R, a = kind === 'B' ? -th : th;
  const k = clamp((a + arc) / (2 * arc), 0, 1), u = 1 - Math.cbrt(1 - k);
  return s0 + u * (s1 - s0);
}
/** attackT at which the C chop's pitch reaches e (inverse of chopAt) */
export function chopTimeAt(TC, e) {
  const [s0, s1] = TC.sweepC, up = TC.chopUp * D2R, dn = TC.chopDown * D2R;
  const k = Math.sqrt(clamp((e - up) / (dn - up), 0, 1));
  return s0 + k * (s1 - s0);
}
