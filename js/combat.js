// Sword resolution, cuttables, drops, enemy kills, hit-stop, player damage, dizzy/respawn (Game mixin).
// The sword (feel §8.2–8.3, RULINGS) is a 3D test from the eye along view.aim() (TP: Pip's virtual eye converging on the
// crosshair ray, latched at the swing start like the body). The eye and feet come from the sim feet (player.pos), so it
// works the same in the air:
// - A/B: a horizontal sweep ±arc around the aim yaw (A right → left, B left → right; easeOutCubic in sweepAB). A target is
//   hit on the step the swept bearing meets its edges [θ − w, θ + w] (w = atan(r/d)), if its surface is within reach and
//   its elevation interval seen from the eye meets [pitch − bandDown, pitch + bandUp] (a raised bat needs a look up);
// - C: an overhead chop: the target's edges within ±arcC and the pitch sweep (aim + chopUp → aim + chopDown) crosses its
//   elevation interval; it breaks the crab's guard, deals +1 and knocks harder;
// - vertical reach: never a target wholly above eye + reachUp; a flyer never wholly below feet − reachDown; a ground
//   critter (it walks: slimes, mushrooms, crabs and the floating-but-walking snowpuff) never across a wall-sized terrain
//   step (the profile from the swing start to it rises or drops ≥ wallRise over stretches steeper than wallGrade), nor
//   higher / lower than a walkable slope allows from Pip's ground at the swing start (groundSlack + walkK·d, at most
//   groundUp up): no hits up or down a wall, and the lunge never climbs into range; a steep walkable slope still hits;
// - line of sight: terrain and collider cylinders (a tree by its trunk, not its movement radius) between the eye and the
//   target block the hit unless one of its sample points (contact point, left / right edge, upper part) is clear;
// - magnetism (aimAssist setting, more for the lock-on target) widens the horizontal test toward ONE chosen enemy whose
//   nearest edge lies just outside the sweep; the camera never moves;
// - bearings are measured from where the swing started, so the lunge never narrows the arc; reach, the band and the
//   bubble use the current eye. Anything inside the close bubble at body height is hit in any direction.
// Each target once per swingId. Enemy.hit gets Pip's position as the source (so the crab's guard keeps its meaning); the
// knockback is then re-aimed along the aim (blended with away-from-Pip; behind Pip: straight away).
import * as THREE from 'three';
import { sfx } from './core.js';
import { CFG } from './data.js';
import { Pickup } from './entities.js';
import { EV } from './events.js';
import { rand, pick, clamp, wrapAngle, yawOf, angDiff, Ease } from './util.js';
import { combat as TC, view as TV } from './tune.js';
import { STEP } from './clock.js';

const _v = new THREE.Vector3(), _q = new THREE.Vector3(), _hb = {}, _aim = {}, _probe = {}, _kd = { x: 0, z: 0 }, _near = [];
const D2R = Math.PI / 180;
// cuttable hurt [radius, height] above their base
const CUT_H = { grass: [0.25, 0.5], bush: [0.4, 1.0], pot: [0.3, 0.6] };
// display names for the HUD (C5) when an enemy has none of its own (WP5 names them; theirs win)
const NAMES = { slime: 'Slime', mushroom: 'Mushroom', bat: 'Bat', bee: 'Bee', crab: 'Crab', snowpuff: 'Snowpuff' };
// line of sight through trees: the trunk the eye sees at body height is about this share of the movement radius
// (props.js: round trunk 0.40 / collider 0.72, pine 0.30 / 0.60, palm 0.24 / 0.42); a collider may declare its own `los`
const TRUNK_K = { tree_round: 0.56, tree_pine: 0.5, tree_snow: 0.5, tree_palm: 0.6 };
export const trunkR = (c) => { const d = c.decl || (c.prop && c.prop.collider); return d && d.los != null ? d.los : TRUNK_K[c.kind] ? c.r * TRUNK_K[c.kind] : null; };
const isTrunk = (c) => trunkR(c) != null;

/** a critter that walks on the ground, so the ledge rules apply: not a flyer, except the snowpuff, which floats but walks
 *  (entities.js moves it with flying: false). WP5 may declare def.ground (true / false) to say so explicitly */
export function walksOnGround(e) {
  const d = e.def || {};
  return d.ground != null ? !!d.ground : !d.flying || e.type === 'snowpuff';
}
/** does the 3D segment (a → a + d·1) cross the vertical cylinder (c.x, c.z, r, [c.y0, c.y1])? A segment starting inside
 *  its circle never counts (like W.probeSegment) */
function crossesCyl(ax, ay, az, dx, dy, dz, c, r) {
  const fx = ax - c.x, fz = az - c.z, A = dx * dx + dz * dz, C = fx * fx + fz * fz - r * r;
  if (A < 1e-12 || C <= 0) return false;
  const B = 2 * (fx * dx + fz * dz), disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const q = Math.sqrt(disc), t0 = Math.max(0, (-B - q) / (2 * A)), t1 = Math.min(1, (-B + q) / (2 * A));
  if (t0 > t1) return false;
  const ya = ay + dy * t0, yb = ay + dy * t1, lo = c.y0 ?? -1e9, hi = c.y1 ?? lo + 3;
  return Math.max(Math.min(ya, yb), lo) <= Math.min(Math.max(ya, yb), hi);
}

/** A/B sweep bearing (rad, + = left) at attackT t: A from the right (−arc) to the left (+arc), B mirrored */
export function sweepAt(kind, t) {
  const [s0, s1] = TC.sweepAB, k = Ease.outCubic(clamp((t - s0) / (s1 - s0), 0, 1));
  const a = (-TC.arc + 2 * TC.arc * k) * D2R;
  return kind === 'B' ? -a : a;
}
/** inverse of sweepAt: the attackT at which the A/B sweep reaches bearing a (rad; clamped to the sweep) */
export function sweepT(kind, a) {
  const [s0, s1] = TC.sweepAB, arc = TC.arc * D2R, k = clamp(((kind === 'B' ? -a : a) + arc) / (2 * arc), 0, 1);
  return s0 + (s1 - s0) * (1 - Math.cbrt(1 - k));
}
/** C chop pitch offset (rad) from the aim pitch at attackT t (easeInQuad from chopUp down to chopDown) */
export function chopAt(t) {
  const [s0, s1] = TC.sweepC, k = clamp((t - s0) / (s1 - s0), 0, 1);
  return (TC.chopUp + (TC.chopDown - TC.chopUp) * k * k) * D2R;
}
/** inverse of chopAt: the attackT at which the chop reaches pitch offset p (rad; clamped) */
export function chopT(p) {
  const [s0, s1] = TC.sweepC, u = TC.chopUp * D2R, dn = TC.chopDown * D2R;
  return s0 + (s1 - s0) * Math.sqrt(clamp((p - u) / (dn - u), 0, 1));
}
const overlap = (hb, lo, hi) => hb.y1 >= lo && hb.y0 <= hi;

/** vertical reach: no hits up or down a wall. Every target: not wholly above eye + reachUp. A flyer / projectile: not
 *  wholly below feet − reachDown. A ground critter (hb.ground): not across a wall-sized terrain step (hb.wall, from
 *  resolveSword's terrain profile), and its base (hb.base ?? y0) within groundSlack + walkK·d of Pip's ground (up: at most
 *  groundUp), d measured from the swing start; Pip's ground is the lower (up) / higher (down) of now and the swing start
 *  (s.gnd, s.gnd0; default the feet), so the lunge never climbs into range and a jump never adds reach to a ledge */
export function vReach(hb, s) {
  if (hb.y0 > s.ey + TC.reachUp) return false;
  if (!hb.ground) return hb.y1 >= s.feet - TC.reachDown;
  if (hb.wall) return false;
  const g = s.gnd ?? s.feet, g0 = s.gnd0 ?? g, base = hb.base ?? hb.y0;
  const lim = TC.groundSlack + TC.walkK * Math.hypot(hb.x - (s.ox ?? s.ex), hb.z - (s.oz ?? s.ez));
  return base - Math.min(g, g0) <= Math.min(TC.groundUp, lim) && Math.max(g, g0) - base <= lim;
}

/** one swing step against a hurtbox { x, z, r, y0, y1, ground (a walking critter: the ledge rules apply), wall, base }
 *  (pure geometry; line of sight is resolveSword's): s = { kind, ex, ey, ez (eye), ox, oz (swing start; default the
 *  eye), feet, gnd, gnd0 (Pip's ground now / at the swing start; default the feet), yaw, pitch, reach, t0, t1, mag (rad
 *  of magnetism for this target, optional) } → true when hit; then s.contactT = the attackT the blade met it (feel §8.3) */
export function swordTest(hb, s) {
  s.contactT = null;
  const dx = hb.x - s.ex, dz = hb.z - s.ez, d = Math.hypot(dx, dz);
  if (d > s.reach + hb.r) return false;                                                // reach to the target surface
  if (Math.hypot(d, clamp(s.ey, hb.y0, hb.y1) - s.ey) - hb.r > s.reach + TC.reachSlack) return false; // 3D
  if (!vReach(hb, s)) return false;                                                    // never up / down a wall
  if (d < TC.bubble + TC.bubbleR * hb.r && overlap(hb, s.feet - 0.2, s.feet + 1.6)) { s.contactT = s.t1; return true; } // inside the body
  const C = s.kind === 'C';
  if (s.t0 >= (C ? TC.sweepC : TC.sweepAB)[1]) return false;                          // after the sweep: the bubble only
  const bx = hb.x - (s.ox ?? s.ex), bz = hb.z - (s.oz ?? s.ez);
  const w = Math.atan(hb.r / Math.max(hb.r, Math.hypot(bx, bz))), mag = s.mag || 0;
  let th = wrapAngle(yawOf(bx, bz) - s.yaw);
  th = th > 0 ? Math.max(0, th - mag) : Math.min(0, th + mag);                         // magnetism pulls it toward the aim
  const dv = Math.max(d, 0.3), e0 = Math.atan2(hb.y0 - s.ey, dv), e1 = Math.atan2(hb.y1 - s.ey, dv);
  if (C) {
    if (Math.abs(th) - w > TC.arcC * D2R) return false;
    const p0 = s.pitch + chopAt(s.t0), p1 = s.pitch + chopAt(s.t1);
    if (Math.max(Math.min(p0, p1), e0) > Math.min(Math.max(p0, p1), e1)) return false;
    s.contactT = clamp(chopT(e1 - s.pitch), s.t0, s.t1);                               // the chop meets its top first
    return true;
  }
  const a0 = sweepAt(s.kind, s.t0), a1 = sweepAt(s.kind, s.t1);
  if (th + w < Math.min(a0, a1) || th - w > Math.max(a0, a1)) return false;
  if (e1 < s.pitch - TC.bandDown * D2R || e0 > s.pitch + TC.bandUp * D2R) return false;
  s.contactT = clamp(sweepT(s.kind, s.kind === 'B' ? th + w : th - w), s.t0, s.t1);    // A meets its right edge, B its left
  return true;
}
/** where sparks / events go: the target point facing the eye at about eye height */
function contact(hb, s, out) {
  const dx = hb.x - s.ex, dz = hb.z - s.ez, d = Math.hypot(dx, dz) || 1, k = Math.min(hb.r, d * 0.9) / d;
  return out.set(hb.x - dx * k, clamp(s.ey - 0.15, hb.y0, hb.y1), hb.z - dz * k);
}
/** C5: every enemy carries hp ≥ 0, maxHp and a display name for the HUD pips (WP5's own values win) */
export function hudFields(e) {
  if (!(e.hp >= 0)) e.hp = Math.max(0, e.hp || 0);
  if (e.maxHp == null) e.maxHp = e.def && e.def.hp != null ? e.def.hp : e.hp;
  if (e.name == null) e.name = (e.def && e.def.name) || NAMES[e.type] || e.type || 'Critter';
  return e;
}

export const CombatMixin = {
  buildCuttables() {
    const W = this.world;
    this.cutHash = new Map();
    const add = (o, kind) => {
      o.cutKind = kind;
      const key = (Math.floor(o.x / 4) + 100) * 1000 + (Math.floor(o.z / 4) + 100);
      let a = this.cutHash.get(key);
      if (!a) this.cutHash.set(key, (a = []));
      a.push(o);
    };
    for (const d of W.deco) if (d.type === 'tallgrass') add(d, 'grass');
    for (const p of W.props) {
      if (p.removed) continue;
      if (p.type === 'bush') add(p, 'bush');
      if (p.type === 'pot' && p.breakable) add(p, 'pot');
    }
    for (const c of W.colliders) if (c.prop && (c.prop.type === 'bush' || c.prop.type === 'pot')) c.prop.collider = c;
  },
  nearCuttables(x, z, r, out = []) {
    out.length = 0;
    const x0 = Math.floor((x - r) / 4), x1 = Math.floor((x + r) / 4), z0 = Math.floor((z - r) / 4), z1 = Math.floor((z + r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const arr = this.cutHash.get((a + 100) * 1000 + (b + 100));
      if (arr) for (const o of arr) if (!o.cut) out.push(o);
    }
    return out;
  },
  /** this step's swing state. FP: the eye's live aim (frozen for the frame; the blade moves with the view). TP: the aim
   *  latched at the swing start, like the body, so turning the camera mid-swing never swings behind Pip's back. The eye
   *  follows Pip through the steps (feet = player.pos, also in the air); bearings are taken from the swing's start point */
  swingState(dt = STEP, out = {}) {
    const pl = this.player, a = this.view.aim(_aim), sw = pl.state === 'attack', latch = sw && pl.swingLatch;
    out.kind = pl.combo; out.yaw = latch ? pl.swingYaw : a.yaw; out.pitch = latch ? pl.swingPitch : a.pitch; out.reach = pl.reach;
    out.ex = pl.pos.x; out.ey = pl.pos.y + TV.eyeH; out.ez = pl.pos.z; out.feet = pl.pos.y;
    out.ox = sw ? pl.swingX : out.ex; out.oz = sw ? pl.swingZ : out.ez;
    // Pip's ground (feet − WP3's player.alt) now and at the swing start (recorded on EV.SWING by the wp4-targeting module)
    out.gnd = pl.pos.y - (pl.alt || 0);
    const g0 = this._swingGnd;
    out.gnd0 = sw && g0 && g0.id === pl.swingId ? g0.y : out.gnd;
    out.t1 = pl.attackT; out.t0 = pl.attackT - dt;
    out.id = pl.swingId; out.mag = 0;
    return out;
  },
  /** EV.SWING: remember Pip's ground at the swing start (the ledge rules measure from it, so the lunge never climbs) */
  noteSwingStart(id) { const pl = this.player; this._swingGnd = { id, y: pl.pos.y - (pl.alt || 0) }; },
  /** fill the ground-critter fields of a hurtbox: ground, base (its feet: the slime's hop does not lift it off a slope)
   *  and wall (a wall-sized terrain step between the swing start and it; only computed when it is near enough to matter) */
  groundFields(hb, s, e = null) {
    hb.ground = e ? walksOnGround(e) : true;
    hb.base = hb.y0 - ((e && e.hop) || 0);
    hb.wall = hb.ground && Math.hypot(hb.x - s.ex, hb.z - s.ez) <= s.reach + hb.r + TC.magReach ? this.wallBetween(s.ox ?? s.ex, s.oz ?? s.ez, hb.x, hb.z) : false;
    return hb;
  },
  /** a wall-sized terrain step between two points, along the straight line (every wallStep m): the terrain rises, or
   *  drops, by wallRise or more over stretches steeper than wallGrade (rise / run; real cliffs run 1.2–1.8), or the two
   *  points differ by wallRise or more and the line crosses a bank clearly too steep to walk (the smoothed slope field ≥
   *  wallSlope; the walk limit is 0.84, and a band just over it, which Pip slides around, is still a steep slope) that
   *  makes up wallUnw of that rise / drop: a smooth rock bank (grade 0.9 → 1.4, slope to 1.16) that walkers can't cross
   *  but that is not steeper than wallGrade for wallRise. Bridge decks and deep water never count */
  wallBetween(ax, az, bx, bz) {
    const W = this.world, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.ceil(L / TC.wallStep);
    if (n < 1) return false;
    const seg = L / n, br = W.bridges && W.bridges.length > 0, ha = W.hAt(ax, az);
    let h0 = ha, up = 0, dn = 0, bu = 0, bd = 0;
    for (let i = 1; i <= n; i++) {
      const x = ax + (dx * i) / n, z = az + (dz * i) / n, h = W.hAt(x, z), dh = h - h0;
      h0 = h;
      if (br && W.bridgeAt(x, z) !== null) continue;
      if (Math.abs(dh) >= TC.wallGrade * seg) { if (dh > 0) up += dh; else dn -= dh; }
      const mx = ax + (dx * (i - 0.5)) / n, mz = az + (dz * (i - 0.5)) / n;
      if (W.slopeAt(mx, mz) >= TC.wallSlope && W.hAt(mx, mz) > -0.4) { if (dh > 0) bu += dh; else bd -= dh; }   // a bank
    }
    if (up >= TC.wallRise || dn >= TC.wallRise) return true;
    const net = h0 - ha;
    return (net >= TC.wallRise && bu >= TC.wallUnw) || (-net >= TC.wallRise && bd >= TC.wallUnw);
  },
  /** swing magnetism for the aimAssist setting (deg): off 0, low 10, high 20 (25 on touch); auto by the last device */
  magnetDeg() {
    const a = this.settings.get('aimAssist'), dev = this.input.lastDevice, M = TC.mag;
    if (a === 'off') return M.off;
    if (a === 'low') return M.low;
    if (a === 'high') return dev === 'touch' ? M.touch : M.high;
    return dev === 'pad' ? M.high : dev === 'touch' ? M.touch : M.low;
  },
  /** the one enemy (or boss) this swing's magnetism leans toward, chosen once per swing: within reach + magReach, inside
   *  the vertical test, its nearest edge outside the sweep by no more than the magnetism; the lock-on target first */
  magnetFor(s) {
    const m = this._mag || (this._mag = { id: -1, target: null, rad: 0 });
    if (m.id === s.id) return m;
    m.id = s.id; m.target = null; m.rad = 0;
    const base = this.magnetDeg(), lock = this.view.lockTarget, C = s.kind === 'C';
    const arc = (C ? TC.arcC : TC.arc) * D2R;
    let bs = Infinity;
    const consider = (o, boss) => {
      const deg = o === lock && base > 0 ? Math.max(base, TC.lockMag) : base;
      if (deg <= 0) return;
      const hb = o.hurtbox(_hb), d = Math.hypot(hb.x - s.ex, hb.z - s.ez);
      if (d - hb.r > s.reach + TC.magReach) return;
      if (boss) hb.ground = false; else this.groundFields(hb, s, o);
      if (!vReach(hb, s)) return;                                         // the same vertical rules as the swing
      const bx = hb.x - s.ox, bz = hb.z - s.oz, edge = Math.abs(wrapAngle(yawOf(bx, bz) - s.yaw)) - Math.atan(hb.r / Math.max(hb.r, Math.hypot(bx, bz)));
      const ex = edge - arc;
      if (ex <= 0 || ex > deg * D2R) return;
      const dv = Math.max(d, 0.3), e0 = Math.atan2(hb.y0 - s.ey, dv), e1 = Math.atan2(hb.y1 - s.ey, dv);
      const lo = s.pitch + (C ? TC.chopDown : -TC.bandDown) * D2R, hi = s.pitch + (C ? TC.chopUp : TC.bandUp) * D2R;
      if (e1 < lo || e0 > hi) return;
      const sc = ex + d * 0.02 - (o === lock ? 10 : 0);
      if (sc < bs) { bs = sc; m.target = o; m.rad = deg * D2R; }
    };
    for (const e of this.enemies) if (e.alive) consider(e, false);
    const b = this.fight && this.fight.boss;
    if (b && !b.dying) consider(b, true);
    return m;
  },
  /** knockback direction (unit xz): mostly along the aim, partly away from Pip; a target behind Pip goes straight away */
  knockDir(s, hb) {
    const tx = hb.x - s.ex, tz = hb.z - s.ez, l = Math.hypot(tx, tz) || 1, ux = tx / l, uz = tz / l;
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), k = TC.knockAim;
    let x = ux, z = uz;
    if (fx * ux + fz * uz > 0) { x = fx * k + ux * (1 - k); z = fz * k + uz * (1 - k); }
    const n = Math.hypot(x, z) || 1;
    _kd.x = x / n; _kd.z = z / n;
    return _kd;
  },
  /** can the blade reach the target from the eye: clear when the ray to ANY of its sample points is (the contact point p;
   *  with a hurtbox also its left / right edge at that height, losEdge·r off its centre line, and its upper part), so a
   *  slime half behind a trunk is still hit and one wholly behind it is not. self: a collider to ignore (a cuttable's) */
  swordLos(s, p, self = null, hb = null) {
    if (this.losRay(s, p, self)) return true;
    if (!hb) return false;
    const dx = hb.x - s.ex, dz = hb.z - s.ez, d = Math.hypot(dx, dz) || 1, k = (hb.r * TC.losEdge) / d, px = -dz * k, pz = dx * k;
    if (this.losRay(s, _q.set(hb.x + px, p.y, hb.z + pz), self) || this.losRay(s, _q.set(hb.x - px, p.y, hb.z - pz), self)) return true;
    const top = hb.y0 + (hb.y1 - hb.y0) * 0.8;
    return top > p.y + 0.1 && this.losRay(s, _q.set(p.x, top, p.z), self);
  },
  /** one sword ray from the eye to p: terrain sampled every losStep, then collider cylinders up to their body tops
   *  (W.probeSegment; colliders the ray starts inside are ignored), trees by their trunk radius (trunkR) instead */
  losRay(s, p, self) {
    const W = this.world, dx = p.x - s.ex, dy = p.y - s.ey, dz = p.z - s.ez, L = Math.hypot(dx, dz), n = Math.floor(L / TC.losStep);
    for (let i = 1; i < n; i++) {
      const k = i / n, x = s.ex + dx * k, z = s.ez + dz * k;
      if (s.ey + dy * k < W.hAt(x, z) - 0.02) return false;
    }
    _probe.terrain = false; _probe.water = false; _probe.decks = false; _probe.top = 'body';
    _probe.ignore = self ? (c) => c === self || isTrunk(c) : isTrunk;
    if (W.probeSegment(s.ex, s.ey, s.ez, p.x, p.y, p.z, 0.02, _probe) < 1) return false;
    W.nearColliders((s.ex + p.x) / 2, (s.ez + p.z) / 2, L / 2 + 0.5, _near);
    for (const c of _near) if (c !== self && isTrunk(c) && crossesCyl(s.ex, s.ey, s.ez, dx, dy, dz, c, trunkR(c))) return false;
    return true;
  },
  /** FP: hit sparks never inside fxNear of the eye (a point sprite there fills the screen) */
  fxPoint(s, p) {
    if (this.view.bodyOut) return p;
    const dx = p.x - s.ex, dy = p.y - s.ey, dz = p.z - s.ez, d = Math.hypot(dx, dy, dz);
    if (d < TC.fxNear && d > 1e-4) p.set(s.ex + (dx / d) * TC.fxNear, s.ey + (dy / d) * TC.fxNear, s.ez + (dz / d) * TC.fxNear);
    return p;
  },
  /** contact feedback on the camera (feel §8.4). FP: the punch is WP1's (view.feel punches on EV.HIT: once per swing,
   *  scaled by the speedFx / reduceMotion comfort settings, the boss row included), so nothing here — kicking the view
   *  as well doubled it; only without view.feel the old hit shake. TP: a little trauma */
  hitPunch(kind, boss) {
    const v = this.view;
    if (v.bodyOut) { v.shake(TC.shakeTPHit); return; }
    if (!v.feel) v.shake(boss ? 0.3 : 0.22);
  },
  resolveSword(dt = STEP) {
    const pl = this.player, S = this.S, s = this.swingState(dt, this._sw || (this._sw = {}));
    const C = s.kind === 'C';
    const dmg = (S.swordLevel >= 2 ? 2 : 1) + (C ? TC.dmgC : 0), knock = C ? TC.knockC : TC.knockAB;
    const mg = this.magnetFor(s);
    let stop = 0, hit = false, boss = false;
    for (const e of this.enemies) {
      if (!e.alive || e.lastSwing === pl.swingId) continue;
      s.mag = e === mg.target ? mg.rad : 0;
      const hb = this.groundFields(e.hurtbox(_hb), s, e);
      if (!swordTest(hb, s)) continue;
      const cp = contact(hb, s, _v);
      if (!this.swordLos(s, cp, null, hb)) continue;
      const kd = this.knockDir(s, hb), ct = s.contactT;
      // the source is Pip (the crab's guard faces Pip, as before); then the knockback is re-aimed along the aim, keeping
      // the strength Enemy.hit gave it
      const res = e.hit(dmg, s.ex, s.ez, knock, C, pl.swingId);
      if (!res) continue;                                    // not hittable this step: a later step of the swing may land
      if (res !== 'clink' && e.knock && e.knock.set) { const k = Math.hypot(e.knock.x, e.knock.y); e.knock.set(kd.x * k, kd.z * k); }
      e.lastSwing = pl.swingId;
      hudFields(e);
      const p = this.fxPoint(s, cp);
      if (res === 'clink') {
        stop = Math.max(stop, TC.stopClink);
        this.events.emit(EV.CLINK, { x: p.x, y: p.y, z: p.z, target: e, kind: s.kind, swingId: pl.swingId, contactT: ct });
        sfx('hit'); this.fx.sparks(p.x, p.y + 0.1, p.z, 6, 0xffffff);
        this.ui.floater(p, 'Clink!', '#e8f4ff', 18);
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        pl.vel.set(-fx * 4, -fz * 4);
        this.view.shake(TC.traumaClink / 0.75);
      } else {
        hit = true;
        e.lastHitKind = s.kind;
        stop = Math.max(stop, res === 'dead' ? TC.stopKill : TC.stopEnemy);
        this.events.emit(EV.HIT, { kind: 'enemy', swing: s.kind, swingId: pl.swingId, x: p.x, y: p.y, z: p.z, dmg, target: e, killed: res === 'dead', contactT: ct, knockX: kd.x, knockZ: kd.z, magnet: s.mag > 0 });
        sfx('hit');
        this.fx.sparks(p.x, p.y, p.z, 9, S.swordLevel >= 2 ? 0xffe27a : 0xfff4b0);
      }
    }
    const b = this.fight && this.fight.boss;
    if (b && !b.dying && b.lastSwing !== pl.swingId) {
      s.mag = b === mg.target ? mg.rad : 0;
      const hb = b.hurtbox(_hb);
      hb.ground = false;                                      // bosses lift off their floor (unhittable above 1.6 m)
      const cp = swordTest(hb, s) ? contact(hb, s, _v) : null;
      if (cp && this.swordLos(s, cp, null, hb)) {
        const kd = this.knockDir(s, hb), ct = s.contactT;
        const res = b.hit(dmg, s.ex, s.ez, pl.swingId);        // from Pip (its small push goes away from Pip)
        if (res) {
          b.lastSwing = pl.swingId;
          hit = boss = true;
          stop = Math.max(stop, res === 'dead' ? TC.stopKill : TC.stopBoss);
          const p = this.fxPoint(s, cp);
          this.events.emit(EV.HIT, { kind: 'boss', swing: s.kind, swingId: pl.swingId, x: p.x, y: p.y, z: p.z, dmg, target: b, killed: b.hp <= 0, contactT: ct, knockX: kd.x, knockZ: kd.z, magnet: s.mag > 0 });
          this.events.emit(EV.BOSS_HIT, { id: b.id, hp: b.hp });
          sfx('bossHit');
          this.fx.sparks(p.x, p.y, p.z, 12, 0xfff4b0);
          this.ui.bossBar(b);
        }
      }
    }
    s.mag = 0;
    _hb.ground = false;
    for (const p of this.projectiles) {
      if (!p.alive || !p.poppable || p.lastSwing === pl.swingId || !swordTest(p.hurtbox(_hb), s)) continue;
      if (!this.swordLos(s, _v.set(p.pos.x, p.pos.y, p.pos.z))) continue;
      p.lastSwing = pl.swingId;
      p.pop(true); sfx('bubble');
      this.events.emit(EV.HIT, { kind: 'projectile', swing: s.kind, swingId: pl.swingId, x: p.pos.x, y: p.pos.y, z: p.pos.z, dmg, target: p, killed: true, contactT: s.contactT });
    }
    // cuttables: the same swing volume
    for (const o of this.nearCuttables(pl.pos.x, pl.pos.z, pl.reach + 1)) {
      if (o.lastSwing === pl.swingId) continue;
      const y = o.y ?? this.world.hAt(o.x, o.z), ch = CUT_H[o.cutKind] || CUT_H.bush;
      _hb.x = o.x; _hb.z = o.z; _hb.r = ch[0]; _hb.y0 = y; _hb.y1 = y + ch[1];
      this.groundFields(_hb, s);
      if (!swordTest(_hb, s) || !this.swordLos(s, contact(_hb, s, _v), o.collider || null, _hb)) continue;
      o.lastSwing = pl.swingId;
      this.events.emit(EV.HIT, { kind: 'cut', swing: s.kind, swingId: pl.swingId, x: o.x, y, z: o.z, dmg, target: o, killed: true, contactT: s.contactT });
      this.cutObject(o);
    }
    if (stop) this.clock.hitStopFor(stop);                    // whole steps; simultaneous hits take the max
    if (hit) this.hitPunch(s.kind, boss);
  },
  cutObject(o) {
    o.cut = true;
    this.scenery.hide(o);
    if (o.collider) o.collider.active = false;
    const y = o.y ?? this.world.hAt(o.x, o.z);
    if (o.cutKind === 'grass') {
      sfx('bush');
      this.fx.leaves(o.x, y + 0.2, o.z, 6, [0x8bd65d, 0xa6e07a, 0x6cc04a, 0xc8e88a]);
      this.regrow.push({ o, t: CFG.grassRespawn + rand(0, 30) });
      this.maybeDrop(o.x, o.z, 0.06, 0.04);
    } else if (o.cutKind === 'bush') {
      sfx('bush');
      this.fx.leaves(o.x, y + 0.4, o.z, 14);
      this.regrow.push({ o, t: CFG.bushRespawn });
      this.maybeDrop(o.x, o.z, 0.25, 0.1);
    } else if (o.cutKind === 'pot') {
      sfx('pot');
      this.fx.shards(o.x, y, o.z, 12);
      this.fx.dust(o.x, y, o.z, 4, 0xe8c8a8);
      this.regrow.push({ o, t: CFG.potRespawn });
      this.maybeDrop(o.x, o.z, 0.5, 0.2);
    }
  },
  maybeDrop(x, z, pGem, pHeart) {
    const S = this.S;
    if (Math.random() < pGem) this.pickups.push(new Pickup('gem', x, z, { value: pick([1, 1, 1, 3, 5]) }));
    if (S.hp < S.maxHp && Math.random() < pHeart) this.pickups.push(new Pickup('heart', x, z));
  },
  /** freeze the sim (whole steps via the clock; same step counts as the old float timer) */
  hitStop(t) { this.clock.hitStop(t); },
  playerHurt(dmg, fx, fz, knock = 7, source = 'enemy') {
    const pl = this.player;
    if (this.state !== 'play' || this.cutscene || pl.state === 'dizzy' || this.god) return false;
    if (!pl.hurt(dmg, fx, fz, knock)) return false;
    const S = this.S;
    S.hp = Math.max(0, S.hp - dmg);
    // hurtDir: unit vector toward the source; rel: its bearing from the look (+ = left), for HUD damage petals
    const hd = pl.hurtDir;
    this.events.emit(EV.HURT, { dmg, fromX: fx, fromY: pl.pos.y + 0.5, fromZ: fz, knock, source, hurtDir: { x: hd.x, z: hd.z }, rel: angDiff(this.view.yaw, yawOf(hd.x, hd.z)) });
    sfx('hurt');
    this.cam.shake(0.45);
    this.redFlash = 1;
    this.clock.hitStopFor(TC.stopHurt);
    if (S.hp <= 0) this.playerDown();
    return true;
  },
  playerDown() {
    const pl = this.player;
    pl.state = 'dizzy';
    pl.dizzyT = 0;
    pl.iframes = 99;
    this.ui.setDizzy(true);
    sfx('death');
    this.events.emit(EV.DOWN, {});
    if (this.ui.dlg) { this.ui.dlg = null; this.ui.dlgEl.classList.remove('show'); }
  },
  updateDizzy(dt) {
    const pl = this.player;
    pl.dizzyT += dt;
    // world dizzy stars only while Pip's body is on screen (never at the FP eye)
    if (this.view.bodyVisible && Math.random() < 0.3) this.fx.sparkle(pl.pos.x + Math.sin(this.time * 8) * 0.5, pl.pos.y + 1.0, pl.pos.z + Math.cos(this.time * 8) * 0.5, 0xfff070, 1, 0.05);
    if (pl.dizzyT > 1.9 && !this.trans) {
      this.fadeOutIn(0.7, () => {
        const S = this.S;
        if (this.fight) this.endFight(true);
        for (const e of this.enemies) e.remove();
        for (const p of this.projectiles) p.pop(false);
        this.enemies = []; this.projectiles = [];
        S.hp = S.maxHp;
        const W = this.world;
        pl.place(W.spawn.x, W.spawn.z, Math.PI);
        pl.iframes = 1.5;
        this.view.setLook(Math.PI, this.defaultPitch()); // under the fade: wake up looking north, nothing visible pops
        this.view.snap();
        this.clock.resetPhase();
        this.ui.setDizzy(false);
        this.updateMusic(true);
        this.events.emit(EV.RESPAWN, {});
      }, () => this.ui.toast('Pip woke up by the Great Tree.'));
    }
  },
  killEnemy(e) {
    e.removed = true;
    if (e.hp < 0) e.hp = 0;
    const y = e.pos.y + e.altCur + (e.hop || 0);
    const col = { slime: 0xc8f0a0, mushroom: 0xffd0c8, bat: 0xd8c0f0, bee: 0xfff0a0, crab: 0xffc8a0, snowpuff: 0xffffff }[e.type] || 0xffffff;
    this.fx.poof(e.pos.x, y + 0.2, e.pos.z, col, 12);
    sfx('enemyDie');
    this.events.emit(EV.KILL, { type: e.type, x: e.pos.x, y, z: e.pos.z, swing: e.lastHitKind || null, target: e });
    this.view.shake(TC.traumaKill / 0.75);
    e.remove();
    if (!e.minion || Math.random() < 0.5) {
      const S = this.S;
      if (Math.random() < 0.45) this.pickups.push(new Pickup('gem', e.pos.x, e.pos.z, { value: pick([1, 1, 3, 3, 5]) }));
      if (S.hp < S.maxHp && Math.random() < 0.15) this.pickups.push(new Pickup('heart', e.pos.x, e.pos.z));
    }
  },
};
