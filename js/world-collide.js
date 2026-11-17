// Ground / walkability / bridge / surface queries, collider shapes + hash, walk-grid rasterisation, segment probes,
// standable tops and the FP eye keep-out (World mixin, WP3).
//
// Collider object (W.colliders, hashed in 4 m cells by its bounding circle):
//   { x, z, r (bounding radius), kind, prop?, active, shape: 'circle' | 'obb' | 'star', hx, hz, rot (OBB half extents /
//     yaw: local +z = (sin rot, cos rot)), y0 (base), y1 (top of the mesh), camTop (top of what the TP spring arm treats
//     as solid: tree trunks stop where the canopy starts), rEye (FP eye keep-out radius: the mesh extent at eye height;
//     OBBs and stars keep the eye out of the shape itself), stand (a low top Pip may stand on: stumps, low rocks), body
//     (false: a camera / eye-only part such as a roof eave that never blocks the body), over (an overhead part: its
//     bottom y0 is above the ground it stands on — eaves, the shop counter, awnings; a ceiling for the FP eye and for a
//     jump, never pushed against sideways), canopy (trees: the measured underside of the crown / lowest skirt, a ceiling
//     for the FP eye), wp3 (built here) }
//   'star' (the Great Tree, measured from its built model): a polygon of n vertices vx / vz around (x, z) at the angles
//     2πk/n (atan2(dx, dz)), core (trunk radius), and a polar grid of mesh heights top[k·nr + j] (rings of dr m) that is
//     the spring arm's top over each spot (W.colliderContains / probeSegment read it; camTop is the full height)
//
// Shapes are data, never coordinates: every collider is derived from what was generated (props by kind + scale +
// yaw, buildings by type + yaw, chests, fence runs, bridges) with the tables below, so a re-laid world keeps fitting:
//   FIT[kind]      footprint parts of a prop at scale 1 in its own frame, measured from the prop meshes in Pip's body
//                  band (feet → 1.0 m above them): { x, z, r } circles or { x, z, hx, hz } boxes, h (the part's own
//                  top when lower than the prop's), eye (mesh extent at eye height, from the part centre)
//   BUILDINGS[type] the same for W.houses[i].type and the shop (local +z = the door side; y0: the part starts this high
//                  (an overhead part blocks only a walker whose head reaches it); cam: camera / eye-only, never the body)
//   COLLIDER_H     per-kind heights (mesh top, spring-arm top, sink, default eye radius), as the foundation baked them
// A prop declares its own shape where it is made (WP9): W.addProp(type, x, z, { s, collider: { r | hx, hz, h, cam,
// eye | eyeS | eyeAdd, sink, stand, shape, parts: [{ x, z, r | hx, hz, h }] } }); a declared r / hx / parts replaces
// FIT, the other fields override COLLIDER_H. A building may carry `collider: [parts]` the same way.
import { len2, clamp, TAU } from './util.js';
import { SIZE, HALF, N } from './world-const.js';
import { move as TM, view as TV } from './tune.js';
import { propModel } from './props.js';

// per kind at scale 1: h = mesh top above the base (bbox of the prop geometry), cam = spring-arm top (default h),
// eye = FP keep-out radius (× s when eyeS, else absolute; eyeAdd: r + eyeAdd), sink = how far the mesh is sunk
// (scatter.composeFor), stand = a standable top when it is low (≤ STAND_MAX)
export const COLLIDER_H = {
  tree_round: { h: 5.15, cam: 1.9, eyeAdd: 0.15, sink: 0.08 },
  tree_pine: { h: 5.30, cam: 0.9, eyeAdd: 0.15, sink: 0.08 },  // cam: the lowest skirt (measured from the mesh below)
  tree_snow: { h: 5.33, cam: 0.9, eyeAdd: 0.15, sink: 0.08 },
  tree_palm: { h: 5.10, cam: 2.4, eyeAdd: 0.15, sink: 0.08 },  // the trunk leans out of its circle above 2.4 m
  bush: { h: 1.26, eyeS: 0.89 },
  rock: { h: 0.67, eyeS: 0.85, sink: 0.12, stand: true },       // eye radii: measured mesh extents (arch had 0.74 / 1.63)
  boulder: { h: 1.63, eyeS: 1.72, sink: 0.12 },
  stump: { h: 0.57, eyeS: 0.59, stand: true },
  pot: { h: 0.57, eye: 0.32 },
  lamp: { h: 2.62, eye: 0.30 },
  sign: { h: 1.30, eye: 0.50 },
  well: { h: 2.82, eye: 1.27 },
  pedestal: { h: 0.72, eye: 1.21 },
  fence: { h: 0.94, eyeAdd: 0.1 },
  chest: { h: 0.83, eyeS: 0.64 },                                 // closed lid top (body 0.58); heart chests are scaled 1.15
  house: { h: 4.86, eyeAdd: 0.12 },                               // per building below (house_a / house_b / shop)
  tree: { h: 9.0, eyeAdd: 0.3 },                                  // Great Tree trunk + roots: the built model's height
  rail: { h: 1.5 },                                               // bridge rails: their own heights from the deck (railShapes)
};
const HOUSE_H = { house_a: 4.86, house_b: 4.55, shop: 4.89 };
// fitted footprints (see the header). Measured by triangle-sampling each prop mesh in 24 sectors (WP3 doc §fit)
export const FIT = {
  bush: [{ r: 0.84, eye: 0.72 }],                                 // lobes 0.74–0.89; foliage, so a little overlap is fine
  rock: [{ z: 0.05, r: 0.63, eye: 0.6 }],                          // 0.48–0.76 (low lobe toward +x+z)
  boulder: [{ x: -0.05, z: -0.02, r: 1.29, eye: 1.35 }, { x: 0.95, z: 0.55, r: 0.66, h: 0.95, eye: 0.66 }], // + its lobe
  stump: [{ r: 0.56, eye: 0.47 }],                                // trunk 0.42–0.47, four low roots to 0.72
  pot: [{ r: 0.30 }],
  lamp: [{ r: 0.34, eye: 0.1 }],                                  // base 0.32 + grass tufts; the post is 0.08
  sign: [{ hx: 0.50, hz: 0.10 }],                                 // the 0.95 m board (it was a 0.28 circle)
  well: [{ r: 1.13, eye: 1.07 }],
  pedestal: [{ r: 1.17 }],                                        // arch §15.2: r 1.15 (lathe 1.15 + moss); eye: table
  tree_round: [{ r: 0.60, eye: 0.34 }],                           // roots 0.66, trunk 0.36–0.47 (was 0.72)
  tree_palm: [{ x: 0.08, r: 0.34, eye: 0.40 }],                   // leaning trunk
};
// pines: the trunk is 0.28; while the lowest skirt hangs below Pip's eye the body keeps the old 0.6 (WP9 raises the
// skirts; then the collider shrinks to the trunk by itself). A jump under a skirt is kept out of it by the canopy
// ceiling (CANOPY below), not by the body radius
const PINE = { trunk: 0.42, skirt: 0.60, clear: 0.35 };
// tree canopies (FP eye ceiling): the lowest mesh point per polar cell (n bearings × dr rings, at scale 1, in the prop's
// own frame) of everything above yMin outside the trunk (dMin), measured from the built model of each kind (so WP9's
// raised skirts are picked up by themselves); cells beyond the crown rise EYE_FLARE m per m from its edge
const CANOPY = { kinds: { tree_pine: 1, tree_snow: 1, tree_round: 1 }, n: 24, dr: 0.1, yMin: 0.45, dMin: 0.45, sample: 0.07, flare: 2.0 };
// ceilings (overhead parts, canopies) round their rim and rise this many m per m outside their footprint (flareUp), so
// the eye ducks under a rim continuously instead of popping (a 56° flare); EYE_REACH: how far around the eye ceilings
// and sides are gathered
const EYE_FLARE = 1.5, EYE_REACH = 4.0;
/** how far above an underside (− eyeClear) the eye may be at u m outside its footprint: a quarter circle of radius M
 *  round the rim (the eye stays M from the rim's edge), then EYE_FLARE m per m */
const flareUp = (u, M) => (u <= 0 ? 0 : u < M ? M - Math.sqrt(M * M - u * u) : M + EYE_FLARE * (u - M));
// raw Great Tree colliders the star fit replaces: kind 'tree', and any the generator flags greatTree: true (opt-in: WP9's
// 'gtroot' ring is kept unless flagged — it also covers bark overhangs 1.1–1.5 m up that the body-band star leaves open)
const isTreeRaw = (c) => c.kind === 'tree' || c.greatTree === true;
export const BUILDINGS = {
  house_a: [{ r: 2.42 }, { z: 2.75, hx: 0.56, hz: 0.37, h: 0.5 }, { x: 1.75, z: 1.35, r: 0.45, h: 0.95 }, { x: -1.75, z: 1.35, r: 0.45, h: 0.95 },
    { x: 2.15, z: 0.85, r: 0.32, h: 0.72 }, { x: -2.15, z: 0.85, r: 0.32, h: 0.72 }, { r: 2.95, y0: 2.0, cam: true }],
  // house_b / shop re-measured on WP9's models (integration round 2): the body-band mesh reaches past the 4.2 / 4.6 m
  // plinths with the side flower boxes and the ivy (house_b |x| 2.21, front boxes z 1.85; shop |x| 2.42)
  house_b: [{ hx: 2.22, hz: 1.85 }, { z: 2.05, r: 0.75, h: 0.5 }, { hx: 2.12, hz: 1.97, y0: 2.6, cam: true }],
  // shop: WP9's outdoor counter (top 0.57 m + goods; the stretch in front of Miso is clear) and its end crates as their
  // boxes, the awning's two posts (r 0.05 to the ground: they had no collider, so Pip's body passed 0.27 m into one and
  // the FP eye stopped 0.046 m from it) and the stacked crates out back. WP9's own 'counter' / 'dressing' circles stay
  // (they are a superset); the foundation's counter / crate parts (z 1.8–1.9, behind WP9's counter) are gone
  shop: [{ hx: 2.42, hz: 1.8 }, { x: 0.55, z: 2.55, hx: 1.18, hz: 0.29, h: 0.82 },
    { x: -0.62, z: 2.0, hx: 0.28, hz: 0.28, h: 0.7 }, { x: 1.95, z: 2.0, hx: 0.28, hz: 0.28, h: 0.7 },
    { x: -0.95, z: 2.6, r: 0.07, h: 2.3, eye: 0.05 }, { x: 1.95, z: 2.6, r: 0.07, h: 2.3, eye: 0.05 },
    { x: 1.75, z: -2.0, r: 0.36, h: 0.5 },
    { x: 0.5, z: 2.1, hx: 1.55, hz: 0.65, y0: 2.2, h: 2.85, cam: true },
    { hx: 2.35, hz: 1.9, y0: 2.7, cam: true }],
};
const CHEST_FIT = { z: 0.03, hx: 0.52, hz: 0.41 };
const FENCE_FIT = { off: 0.045, hx: 0.15, end: 0.04 };            // pickets on the run's right; posts r 0.08
// rails: boxes from `end` m in from each deck end (arch §7.2 / feel §4.6 keep the mouths open), the end posts as circles
const RAIL_FIT = { off: 0.08, hx: 0.11, seg: 3.0, below: 0.6, above: 0.92, end: 0.35, post: 0.12 };
// standable tops (feel §4.5 / RULINGS: stumps and low rocks): the stand height falls off as a dome from the collider
// centre (top radius tr × s, drop dome × s at its edge); support reaches ledge m past it
const STAND = { stump: { tr: 0.45, dome: 0.03 }, rock: { tr: 0.42, dome: 0.20 }, def: { tr: 0.5, dome: 0.05 } };
const STAND_MAX = 0.75;
const UNKNOWN_H = 3.0;           // a solid kind with no table entry or declaration: tall enough to keep the TP arm out
const EYE_FIELDS = ['eye', 'eyeS', 'eyeAdd'];
// the Great Tree's star outline: body band (m above its base), sample spacing on the mesh, vertex spacing at the rim,
// gaps narrower than this closed, polar height-grid ring width, heights above armCap count as the trunk going up
export const TREE_FIT = { band: [0.15, 1.1], sample: 0.12, rim: 0.22, gap: 0.6, dr: 0.25, armCap: 5.0 };
const DECK_STEP = 0.30;          // a bridge deck counts as ground once the feet are within this of it (one-way)
/** a prop's collider declaration (addProp's o.collider), or null. combat.buildCuttables links bushes and pots to their
 *  live collider through the same field (prop.collider = c): a built collider (wp3) is not a declaration */
function declOf(p) { const d = p && p.collider; return d && !d.wp3 && d.kind == null ? d : null; }
/** the height spec for one collider: COLLIDER_H[kind] with the declaration's fields on top (null when neither exists) */
function specFor(c) {
  const base = COLLIDER_H[c.kind] || null, d = c.decl || declOf(c.prop);
  if (!d) return base;
  const k = Object.assign({}, base);
  if (EYE_FIELDS.some((f) => d[f] != null)) for (const f of EYE_FIELDS) delete k[f];  // a declared eye radius replaces the default
  return Object.assign(k, d);
}
const _near = [], _gf = [], _ek = [], _sd = { nx: 0, nz: 0 };

/** signed distance from (x, z) to the collider's footprint (< 0 inside); out.nx / nz = the outward unit normal */
export function shapeDist(c, x, z, out = _sd) {
  const dx = x - c.x, dz = z - c.z;
  if (c.shape === 'obb') {
    const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0);
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;           // world → local (+z_local = (sin rot, cos rot))
    const qx = Math.abs(lx) - c.hx, qz = Math.abs(lz) - c.hz, sx = lx < 0 ? -1 : 1, sz = lz < 0 ? -1 : 1;
    let d, ax, az;
    if (qx > 0 || qz > 0) { const ox = Math.max(qx, 0), oz = Math.max(qz, 0); d = Math.hypot(ox, oz); ax = (ox / d) * sx; az = (oz / d) * sz; }
    else if (qx > qz) { d = qx; ax = sx; az = 0; } else { d = qz; ax = 0; az = sz; }
    out.nx = ax * cs + az * sn; out.nz = -ax * sn + az * cs;
    return d;
  }
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > 1e-9) { out.nx = dx / d; out.nz = dz / d; } else { out.nx = 1; out.nz = 0; }
  if (c.shape === 'star') return d > c.r + 1.5 ? d - c.r : starDist(c, dx, dz, d, out);
  return d - c.r;
}
/** signed distance to a star polygon (vertices vx / vz around its centre, offsets dx, dz, |d|): exact, the nearest
 *  edge point gives the normal; inside = nearer the centre than the edge the centre ray crosses. Beyond r + 1.5 the
 *  caller uses d − r (a lower bound) */
function starDist(c, dx, dz, d, out) {
  const n = c.n, vx = c.vx, vz = c.vz;
  let best = Infinity, qx = 0, qz = 0;
  for (let k = 0; k < n; k++) {
    const k2 = k + 1 === n ? 0 : k + 1, ax = vx[k], az = vz[k], ex = vx[k2] - ax, ez = vz[k2] - az, ee = ex * ex + ez * ez;
    let t = ee > 1e-12 ? ((dx - ax) * ex + (dz - az) * ez) / ee : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + ex * t - dx, pz = az + ez * t - dz, p2 = px * px + pz * pz;
    if (p2 < best) { best = p2; qx = px; qz = pz; }
  }
  const b = Math.sqrt(best);
  // the edge the centre ray through (dx, dz) crosses: its radius at this angle
  const u = ((Math.atan2(dx, dz) / TAU) * n + n) % n, k = Math.floor(u) % n, k2 = k + 1 === n ? 0 : k + 1;
  const ax = vx[k], az = vz[k], ex = vx[k2] - ax, ez = vz[k2] - az, ux = d > 1e-9 ? dx / d : 0, uz = d > 1e-9 ? dz / d : 1;
  const den = ux * ez - uz * ex, rEdge = Math.abs(den) > 1e-12 ? (ax * ez - az * ex) / den : Math.hypot(ax, az);
  const inside = d < rEdge;
  if (b > 1e-9) { const s = inside ? 1 : -1; out.nx = (qx / b) * s; out.nz = (qz / b) * s; }
  return inside ? -b : b;
}
/** a star collider's spring-arm top (absolute y) above (x, z): the measured polar height grid (low roots stay low),
 *  the full height over the trunk core */
function starTop(c, x, z) {
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d < c.core) return c.y1;
  const j = Math.floor(d / c.dr);
  if (j >= c.nr) return c.y0;
  const k = Math.round(((Math.atan2(dx, dz) / TAU) * c.n + c.n)) % c.n;
  return c.y0 + c.top[k * c.nr + j];
}
/** a part of a prop / building: local (x, z) offset rotated by yaw, × s */
function part(kind, src, bx, bz, rot, s, P, extra) {
  const cs = Math.cos(rot), sn = Math.sin(rot), lx = (P.x || 0) * s, lz = (P.z || 0) * s;
  const c = { x: bx + lx * cs + lz * sn, z: bz - lx * sn + lz * cs, kind, wp3: true, part: P, ps: s };
  if (src) c.prop = src;
  if (P.hx != null) { c.shape = 'obb'; c.hx = P.hx * s; c.hz = (P.hz ?? P.hx) * s; c.rot = rot; c.r = Math.hypot(c.hx, c.hz); }
  else { c.shape = 'circle'; c.r = P.r * s; c.hx = c.hz = 0; c.rot = 0; }
  if (P.cam) c.body = false;
  if (P.y0 > 0) c.over = true;
  return extra ? Object.assign(c, extra) : c;
}
let _pine = null;
/** the pine skirt's lowest point at scale 1 (measured from the built mesh: WP9 raises it), or null */
function pineSkirt() {
  if (_pine !== null) return _pine || null;
  _pine = 0;
  try {
    const g = propModel('tree_pine'), pos = g && g.geo && g.geo.attributes.position;
    if (pos) { let lo = Infinity; for (let i = 0; i < pos.count; i++) if (Math.hypot(pos.getX(i), pos.getZ(i)) > 0.6) lo = Math.min(lo, pos.getY(i)); if (Number.isFinite(lo)) _pine = lo; }
  } catch (e) { _pine = 0; }
  return _pine || null;
}
const _canopy = {};
/** a tree kind's canopy underside (see CANOPY) measured from its built model at scale 1: { n, nr, dr, y (Float32Array
 *  n × nr: mesh y of the lowest point over node (k, j) = bearing 2πk/n, radius j·dr, flared outside the crown) }, or
 *  null when the model can't be read */
export function canopyOf(kind) {
  if (_canopy[kind] !== undefined) return _canopy[kind];
  _canopy[kind] = null;
  try {
    const g = propModel(kind), geo = g && g.geo, pos = geo && geo.attributes.position;
    if (!pos) return null;
    const { n, dr, yMin, dMin } = CANOPY, idx = geo.index, nt = idx ? idx.count / 3 : pos.count / 3;
    let rc = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) >= yMin) rc = Math.max(rc, Math.hypot(pos.getX(i), pos.getZ(i)));
    if (!(rc > dMin)) return null;
    const nr = Math.ceil((rc + CANOPY.flare) / dr) + 1, raw = new Float32Array(n * nr).fill(Infinity), t = new Float32Array(9);
    // every triangle sampled ≤ CANOPY.sample apart; a point lands on its nearest node
    for (let f = 0; f < nt; f++) {
      let L = 0, hi = -Infinity;
      for (let v = 0; v < 3; v++) { const i = idx ? idx.getX(f * 3 + v) : f * 3 + v; t[v * 3] = pos.getX(i); t[v * 3 + 1] = pos.getY(i); t[v * 3 + 2] = pos.getZ(i); hi = Math.max(hi, t[v * 3 + 1]); }
      if (hi < yMin) continue;
      for (let v = 0; v < 3; v++) { const w = (v + 1) % 3; L = Math.max(L, Math.hypot(t[v * 3] - t[w * 3], t[v * 3 + 1] - t[w * 3 + 1], t[v * 3 + 2] - t[w * 3 + 2])); }
      const k = Math.min(60, Math.max(1, Math.ceil(L / CANOPY.sample)));
      for (let a = 0; a <= k; a++) for (let b = 0; b <= k - a; b++) {
        const wa = 1 - (a + b) / k, wb = a / k, wc = b / k, y = t[1] * wa + t[4] * wb + t[7] * wc;
        if (y < yMin) continue;
        const x = t[0] * wa + t[3] * wb + t[6] * wc, z = t[2] * wa + t[5] * wb + t[8] * wc, d = Math.hypot(x, z);
        if (d < dMin) continue;
        const kk = Math.round(((Math.atan2(x, z) / TAU) * n + n)) % n, j = Math.round(d / dr), i = kk * nr + j;
        if (j < nr && y < raw[i]) raw[i] = y;
      }
    }
    // each node takes the lowest of its 3 × 3 neighbourhood, so the bilinear blend of a cell's four corners never rises
    // above the mesh anywhere inside that cell (a point's own nearest-node sample is among them)
    const mn = new Float32Array(n * nr);
    for (let k = 0; k < n; k++) for (let j = 0; j < nr; j++) {
      let m = Infinity;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const jj = j + b; if (jj >= 0 && jj < nr) m = Math.min(m, raw[((k + a + n) % n) * nr + jj]); }
      mn[k * nr + j] = m;
    }
    raw.set(mn);
    // flare: every node is at most flareUp(d) above any measured node d m away (a continuous ceiling that rounds the
    // crown's rim, rises outside it and fills the trunk's inner nodes, which the eye never reaches)
    const src = [];
    for (let i = 0; i < n * nr; i++) if (raw[i] < Infinity) src.push(i);
    if (src.length < 8) return null;
    const px = (i) => Math.sin((Math.floor(i / nr) / n) * TAU) * (i % nr) * dr, pz = (i) => Math.cos((Math.floor(i / nr) / n) * TAU) * (i % nr) * dr;
    const sx = src.map(px), sz = src.map(pz), y = new Float32Array(n * nr);
    for (let i = 0; i < n * nr; i++) {
      const x = px(i), z = pz(i);
      let m = raw[i];
      for (let q = 0; q < src.length; q++) { const v = raw[src[q]] + flareUp(Math.hypot(x - sx[q], z - sz[q]), TM.eyeClear ?? 0.12); if (v < m) m = v; }
      y[i] = m;
    }
    _canopy[kind] = { n, nr, dr, y, rc };
  } catch (e) { _canopy[kind] = null; }
  return _canopy[kind];
}
/** absolute y of a tree collider's canopy underside above (x, z) (bilinear on its polar grid, so continuous), or
 *  Infinity beyond the grid (where the flared ceiling is metres above any eye) */
function canopyY(c, x, z) {
  const P = c.canopy, p = c.prop, s = c.ps || 1, dx = x - p.x, dz = z - p.z;
  const u = Math.hypot(dx, dz) / (s * P.dr);
  if (u >= P.nr - 1) return Infinity;
  const nr = P.nr, n = P.n, a = ((Math.atan2(dx, dz) - (p.rot || 0)) / TAU) * n, v = ((a % n) + n) % n;
  const j = Math.floor(u), fu = u - j, k = Math.floor(v) % n, fv = v - Math.floor(v), k2 = (k + 1) % n, Y = P.y;
  const y0 = Y[k * nr + j] * (1 - fu) + Y[k * nr + j + 1] * fu, y1 = Y[k2 * nr + j] * (1 - fu) + Y[k2 * nr + j + 1] * fu;
  return c.cy + (y0 * (1 - fv) + y1 * fv) * s;
}

export const WorldCollide = {
  // ------------------------------------------------------------------ shapes
  /** signed XZ distance from (x, z) to collider c's footprint (< 0 inside): circles and boxes alike */
  colliderDist(c, x, z) { return shapeDist(c, x, z); },
  /** is (x, y, z) inside collider c: its footprint, between y0 and its spring-arm top (a star: the measured height
   *  grid; top 'body': y1)? */
  colliderContains(c, x, y, z, top = 'cam') {
    if (y < c.y0 || shapeDist(c, x, z) >= 0) return false;
    return y <= (top === 'body' ? c.y1 : c.shape === 'star' ? starTop(c, x, z) : c.camTop);
  },
  /** the colliders the generator pushed itself (house circles, fence chains, chests, Great Tree ring, …), kept once */
  rawColliders() {
    const raw = this._raw || (this._raw = []);
    if (this._rawN !== this.colliders.length) {
      const have = new Set(raw);
      for (const c of this.colliders) if (!c.wp3 && !have.has(c)) raw.push(c);
      this._rawN = this.colliders.length;
    }
    return raw;
  },
  /** every static collider, fitted (heights are baked later): props by kind, buildings, chests, fence runs, rails,
   *  the Great Tree, plus any raw collider of a kind not handled here (kept as it was pushed) */
  solidShapes() {
    const out = [], raw = this.rawColliders(), blds = this.houses.concat(this.shop ? [Object.assign({ type: 'shop' }, this.shop)] : []);
    // buildings: our parts replace the generator's footprint circles near a building we have a table for
    const fitted = blds.filter((b) => b.collider || BUILDINGS[b.type || 'shop']);
    for (const b of fitted) {
      const parts = b.collider || BUILDINGS[b.type || 'shop'], y0 = (b.y ?? this.hAt(b.x, b.z)) - 0.05, H = HOUSE_H[b.type || 'shop'] || COLLIDER_H.house.h;
      parts.forEach((P, i) => out.push(part('house', null, b.x, b.z, b.rot || 0, 1, P, { y0: y0 + (P.y0 || 0), y1: y0 + (P.h ?? H), building: b, main: i === 0 })));
    }
    const nearFitted = (c) => fitted.some((b) => (b.x - c.x) ** 2 + (b.z - c.z) ** 2 < 25);
    // fence chains → one box per straight run (no posts to snag on)
    const fences = raw.filter((c) => c.kind === 'fence');
    for (let i = 0; i < fences.length;) {
      let j = i + 1;
      const a = fences[i];
      while (j < fences.length) {
        const p = fences[j - 1], q = fences[j], d = len2(q.x - p.x, q.z - p.z);
        if (d > 0.75 || d < 1e-3) break;
        if (j - i >= 2) { const o = fences[i + 1], ux = (o.x - a.x), uz = (o.z - a.z), vx = q.x - p.x, vz = q.z - p.z; if ((ux * vx + uz * vz) / (len2(ux, uz) * d) < 0.985) break; }
        j++;
      }
      const b = fences[j - 1], len = len2(b.x - a.x, b.z - a.z);
      if (j - i >= 2 && len > 0.1) {
        const rot = Math.atan2(b.x - a.x, b.z - a.z), cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
        out.push(part('fence', null, cx, cz, rot, 1, { x: FENCE_FIT.off, hx: FENCE_FIT.hx, hz: len / 2 + FENCE_FIT.end }, { y0: this.hAt(cx, cz), y1: this.hAt(cx, cz) + COLLIDER_H.fence.h }));
      } else for (let k = i; k < j; k++) out.push(fences[k]);
      i = j;
    }
    // chests: their box, yawed like the chest (heart chests are scaled 1.15)
    for (const ch of this.chests) {
      const s = ch.kind === 'heart' ? 1.15 : 1;
      out.push(part('chest', null, ch.x, ch.z, ch.rot || 0, s, CHEST_FIT, { chest: ch }));
    }
    // the Great Tree: the fit from its built model once fitTreeColliders ran, else the generator's ring
    if (this._treeFit) out.push(...this._treeFit);
    for (const c of raw) {
      if (c.active === false) continue;              // a dynamic collider taken out again (tests)
      if (c.kind === 'fence' || c.kind === 'chest' && this.chests.length) continue;
      if (c.kind === 'house' && nearFitted(c)) continue;
      if (this._treeFit && isTreeRaw(c)) continue;
      out.push(c);
    }
    // props: declared footprint (WP9), else FIT parts by kind, else the generator's circle; trees carry their canopy
    for (const p of this.props) {
      if (p.removed || !p.solid || !p.r) continue;
      const d = declOf(p), s = p.s || 1;
      let parts = d && d.parts ? d.parts : d && (d.r != null || d.hx != null) ? null : FIT[p.type];
      if (!parts && (p.type === 'tree_pine' || p.type === 'tree_snow')) {
        const sk = pineSkirt(), clear = sk != null && (sk - COLLIDER_H[p.type].sink) * s >= TV.eyeH + PINE.clear;
        parts = [{ r: clear ? PINE.trunk : PINE.skirt, eye: 0.3 }];
      }
      // the canopy's mesh base: scatter.composeFor sinks trees 0.08 (unscaled)
      const cano = CANOPY.kinds[p.type] ? canopyOf(p.type) : null, cx = cano ? { canopy: cano, cy: p.y - 0.08 } : null;
      if (!parts) {
        const c = { x: p.x, z: p.z, r: p.r, kind: p.type, prop: p, wp3: true, ps: s };
        if (d && d.shape === 'obb' && d.hx != null) { c.shape = 'obb'; c.hx = d.hx * s; c.hz = (d.hz ?? d.hx) * s; c.rot = p.rot || 0; }
        out.push(cx ? Object.assign(c, cx) : c);
        continue;
      }
      parts.forEach((P, i) => out.push(part(p.type, p, p.x, p.z, p.rot || 0, s, P, i === 0 && cx ? Object.assign({ main: true }, cx) : { main: i === 0 })));
    }
    // bridge rails: boxes along both rail lines, in pieces that follow the deck's arch
    for (const b of this.bridges) out.push(...this.railShapes(b));
    return out;
  },
  /** rail boxes for one bridge (also caches its deck box for the one-way rule) */
  railShapes(b) {
    const deck = (t) => b.h0 + (b.h1 - b.h0) * t + Math.sin(t * Math.PI) * b.arch, rot = Math.atan2(b.dx, b.dz), out = [];
    const off = b.w / 2 - RAIL_FIT.off, e = Math.min(RAIL_FIT.end / b.len, 0.25), n = Math.max(1, Math.ceil((b.len * (1 - 2 * e)) / RAIL_FIT.seg));
    for (const sd of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const t0 = e + ((1 - 2 * e) * i) / n, t1 = e + ((1 - 2 * e) * (i + 1)) / n, tm = (t0 + t1) / 2;
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k <= 4; k++) { const y = deck(t0 + ((t1 - t0) * k) / 4); lo = Math.min(lo, y); hi = Math.max(hi, y); }
        const cx = b.ax + b.dx * b.len * tm + b.dz * sd * off, cz = b.az + b.dz * b.len * tm - b.dx * sd * off;
        out.push(part('rail', null, cx, cz, rot, 1, { hx: RAIL_FIT.hx, hz: (b.len * (t1 - t0)) / 2 + (i === 0 || i === n - 1 ? 0 : 0.03) }, { bridge: b, y0: lo - RAIL_FIT.below, y1: hi + RAIL_FIT.above, fixed: true }));
      }
      // the end posts (the mesh has a post at each deck end): round, so a walker slides around them into the mouth
      for (const te of [0, 1]) {
        const y = deck(te), cx = b.ax + b.dx * b.len * te + b.dz * sd * off, cz = b.az + b.dz * b.len * te - b.dx * sd * off;
        out.push(part('rail', null, cx, cz, rot, 1, { r: RAIL_FIT.post }, { bridge: b, y0: y - RAIL_FIT.below, y1: y + RAIL_FIT.above, fixed: true }));
      }
    }
    const mx = b.ax + (b.dx * b.len) / 2, mz = b.az + (b.dz * b.len) / 2;
    b.deckBox = { x: mx, z: mz, shape: 'obb', hx: b.w / 2, hz: b.len / 2, rot, r: Math.hypot(b.w / 2, b.len / 2) };
    return out;
  },
  /** deck height at a point of bridge b (clamped along it) */
  deckAt(b, x, z) {
    const t = clamp(((x - b.ax) * b.dx + (z - b.az) * b.dz) / b.len, 0, 1);
    return b.h0 + (b.h1 - b.h0) * t + Math.sin(t * Math.PI) * b.arch;
  },
  /** fit the Great Tree from its built model (WP9 scales it): the body-band (TREE_FIT.band) silhouette in 64 directions,
   *  dilated by Pip's width, as a trunk circle + a ring of small overlapping circles whose tops follow the roots; falls
   *  back to the footprint radius (no 3.4 m cap) when the model can't be read */
  fitTreeColliders(fp, height = null) {
    const T = this.greatTree;
    if (!T) return;
    const fit = this.treeFitFromModel(height);
    if (fit) { this._treeFit = fit; this.colliders = this.colliders.filter((c) => !isTreeRaw(c)).concat(fit); }
    else if (fp || height) {
      const R = fp ? Math.max(1.2, fp * 0.62) : 0;
      for (const c of this.colliders) {
        if (c.kind !== 'tree') continue;
        if (fp) {
          const d = Math.hypot(c.x - T.x, c.z - T.z);
          if (d < 0.1) c.r = Math.min(c.r, R);
          else { const a = Math.atan2(c.x - T.x, c.z - T.z); c.x = T.x + Math.sin(a) * R * 0.9; c.z = T.z + Math.cos(a) * R * 0.9; c.r = Math.min(0.9, R * 0.4); }
        }
        if (height) c.th = height;
        this.bakeCollider(c, true);
      }
    }
    this.rehash();
    this.refreshReach();
  },
  /** re-run the reachability BFS on the colliders as built now (the Great Tree fit replaces the generator's ring after
   *  generation): W.reach / W.walk follow what Pip collides with, W.unreachable is re-checked (nothing is carved any
   *  more; a target the fit closed off is logged under ?debug=1) */
  refreshReach() {
    if (!this.bfs || !this.reachTargets) return;
    const R = this.bfs(this.buildWalk());
    this.unreachable = this.reachTargets().filter((t) => !this.isReached(R, t.x, t.z, t.adj));
    if (this.unreachable.length && globalThis.G && globalThis.G.debugOn) console.warn('[Starseed] unreachable after the collider fit:', this.unreachable.map((t) => t.name));
  },
  /** the Great Tree as one star polygon around its centre, measured from the built model at whatever scale WP9 builds
   *  it: the outline of every mesh triangle in Pip's reach (TREE_FIT.band above the base) per direction (the trunk and
   *  each root out to its tip, so nothing between them is hollow), gaps narrower than Pip closed; plus a polar grid of
   *  mesh heights for the spring arm (it passes over low root tips, not through the trunk). null when unreadable */
  treeFitFromModel(height) {
    const S = globalThis.G && globalThis.G.scenery && globalThis.G.scenery.greatTree, T = this.greatTree;
    const model = S && (S.glb ? S.glb.a : S.group);
    if (!model || !model.traverse || !model.updateWorldMatrix) return null;
    const base = T.y - 0.1, B0 = TREE_FIT.band[0], B1 = TREE_FIT.band[1];
    model.updateWorldMatrix(true, true);          // parents first: nothing has rendered yet
    const meshes = [];
    model.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.attributes.position) meshes.push(m); });
    // triangles in world space, each sampled on a barycentric grid ≤ TREE_FIT.sample apart; fn(dx, dz, hy) per point
    const tri = new Float32Array(9);
    const eachPoint = (fn, hiCap, step = TREE_FIT.sample) => {
      for (const m of meshes) {
        const pos = m.geometry.attributes.position, idx = m.geometry.index, e = m.matrixWorld.elements;
        const nt = idx ? idx.count / 3 : pos.count / 3;
        for (let f = 0; f < nt; f++) {
          let lo = Infinity, hi = -Infinity;
          for (let v = 0; v < 3; v++) {
            const i = idx ? idx.getX(f * 3 + v) : f * 3 + v, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            tri[v * 3] = e[0] * x + e[4] * y + e[8] * z + e[12] - T.x;
            tri[v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13] - base;
            tri[v * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - T.z;
            lo = Math.min(lo, tri[v * 3 + 1]); hi = Math.max(hi, tri[v * 3 + 1]);
          }
          if (hi < B0 - 0.01 || lo > hiCap) continue;
          const L = Math.max(Math.hypot(tri[0] - tri[3], tri[1] - tri[4], tri[2] - tri[5]), Math.hypot(tri[3] - tri[6], tri[4] - tri[7], tri[5] - tri[8]), Math.hypot(tri[6] - tri[0], tri[7] - tri[1], tri[8] - tri[2]));
          const k = Math.min(48, Math.max(1, Math.ceil(L / step)));
          for (let a = 0; a <= k; a++) for (let b = 0; b <= k - a; b++) {
            const wa = 1 - (a + b) / k, wb = a / k, wc = b / k;
            fn(tri[0] * wa + tri[3] * wb + tri[6] * wc, tri[2] * wa + tri[5] * wb + tri[8] * wc, tri[1] * wa + tri[4] * wb + tri[7] * wc);
          }
        }
      }
    };
    // pass 1: the body-band outline's reach (sets the angular resolution: ≤ TREE_FIT.rim m between vertices at the rim)
    let Rmax = 0, H = 0, npts = 0;
    for (const m of meshes) { const pos = m.geometry.attributes.position, e = m.matrixWorld.elements; for (let i = 0; i < pos.count; i++) H = Math.max(H, e[1] * pos.getX(i) + e[5] * pos.getY(i) + e[9] * pos.getZ(i) + e[13] - base); }
    eachPoint((dx, dz, hy) => { if (hy >= B0 && hy <= B1) { npts++; const d = dx * dx + dz * dz; if (d > Rmax) Rmax = d; } }, B1);
    Rmax = Math.sqrt(Rmax);
    if (npts < 150 || !(Rmax > 0.5)) return null;
    const n = clamp(Math.ceil((TAU * Rmax) / TREE_FIT.rim), 64, 512), raw = new Float32Array(n);
    const bin = (dx, dz) => Math.round(((Math.atan2(dx, dz) / TAU) * n + n)) % n;
    eachPoint((dx, dz, hy) => { if (hy >= B0 && hy <= B1) { const k = bin(dx, dz), d = Math.sqrt(dx * dx + dz * dz); if (d > raw[k]) raw[k] = d; } }, B1);
    // close gaps narrower than TREE_FIT.gap (a morphological closing in metres: a neighbour j counts for k while the arc
    // from j's tip to k's direction, raw[j]·|j − k|·Δ, is under half the gap), so slits Pip can't enter don't snag him
    // and wider pockets between roots stay open
    const da = TAU / n, hg = TREE_FIT.gap / 2, close = (src, dst, op) => {
      for (let k = 0; k < n; k++) {
        let m = src[k];
        for (let j = 1; j < n / 2; j++) {
          const a = src[(k + j) % n], b = src[(k - j + n) % n], fa = a * j * da <= hg, fb = b * j * da <= hg;
          if (!fa && !fb && j * da * 0.5 > hg) break;
          if (fa) m = op(m, a); if (fb) m = op(m, b);
        }
        dst[k] = m;
      }
    };
    const dil = new Float32Array(n), rad = new Float32Array(n);
    close(raw, dil, Math.max); close(dil, rad, Math.min);
    for (let k = 0; k < n; k++) rad[k] = Math.max(raw[k], rad[k]);
    let core = Infinity, R = 0;
    for (let k = 0; k < n; k++) { core = Math.min(core, rad[k]); R = Math.max(R, rad[k]); }
    if (!(core > 0.3)) return null;
    // pass 2: the spring arm's height grid (polar: n directions × dr rings) of everything over the outline, up to armCap
    const dr = TREE_FIT.dr, nr = Math.ceil((R + dr) / dr), top = new Float32Array(n * nr);
    eachPoint((dx, dz, hy) => {
      const d = Math.sqrt(dx * dx + dz * dz), k = bin(dx, dz), j = Math.floor(d / dr);
      if (j < nr && d <= rad[k] + dr) { const i = k * nr + j; if (hy > top[i]) top[i] = hy > TREE_FIT.armCap ? 1e3 : hy; }
    }, TREE_FIT.armCap, TREE_FIT.dr * 0.8);
    // spread each cell to its neighbours (the arm's probe sphere spans more than one cell)
    const grow = new Float32Array(n * nr);
    for (let k = 0; k < n; k++) for (let j = 0; j < nr; j++) {
      let m = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const jj = j + b; if (jj >= 0 && jj < nr) m = Math.max(m, top[((k + a + n) % n) * nr + jj]); }
      grow[k * nr + j] = m;
    }
    const vx = new Float32Array(n), vz = new Float32Array(n);
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; vx[k] = Math.sin(a) * rad[k]; vz[k] = Math.cos(a) * rad[k]; }
    const ht = height || this.greatTree.scaleHeight || H || COLLIDER_H.tree.h;
    return [{ x: T.x, z: T.z, r: R, kind: 'tree', shape: 'star', n, rad, vx, vz, core: core - 0.05, nr, dr, top: grow, hx: 0, hz: 0, rot: 0,
      wp3: true, y0: base, y1: base + ht, camTop: base + ht, rEye: R, fixed: true, th: ht }];
  },
  // ------------------------------------------------------------------ queries
  bridgeAt(x, z) {
    for (const b of this.bridges) {
      const dx = x - b.ax, dz = z - b.az;
      const t = (dx * b.dx + dz * b.dz) / b.len;
      if (t < 0 || t > 1) continue;
      const side = Math.abs(dx * -b.dz + dz * b.dx);
      if (side > b.w / 2) continue;
      return b.h0 + (b.h1 - b.h0) * t + Math.sin(t * Math.PI) * b.arch;
    }
    return null;
  },
  ground(x, z) {
    const h = this.hAt(x, z);
    if (this.bridges.length) {
      const b = this.bridgeAt(x, z);
      if (b !== null && b > h) return b;
    }
    return h;
  },
  /** stand height of a standable collider at (x, z) (its dome), or −Infinity off its top (+ ledge) */
  standY(c, x, z) {
    const st = STAND[c.kind] || STAND.def, s = c.ps || (c.prop && c.prop.s) || 1, tr = st.tr * s;
    const u = len2(x - c.x, z - c.z) / tr;
    if (u > 1 + (TM.ledge ?? 0.15) / tr) return -Infinity;
    return c.y1 - st.dome * s * Math.min(1, u * u);
  },
  /** the highest standable top within reach of the feet (feetY + step) here, or null: { y, c } */
  standTop(x, z, feetY, step = TM.stepUp ?? 0.35) {
    if (TM.standOnProps === false) return null;
    this.nearColliders(x, z, 0.3, _gf);
    let best = null, by = -Infinity;
    for (const c of _gf) if (c.stand) { const y = this.standY(c, x, z); if (y > by && feetY >= y - step) { by = y; best = c; } }
    return best ? { y: by, c: best } : null;
  },
  /** ground under feet at feetY: terrain; a bridge deck only from above (feetY ≥ deck − 0.30); a standable top (stump,
   *  low rock) when feetY ≥ top − step within its top radius + ledge (props = false skips them). out (optional) gets
   *  { on: null | 'deck' | collider } */
  groundFor(x, z, feetY, props = true, out = null) {
    let g = this.hAt(x, z), on = null;
    const d = this.bridges.length ? this.bridgeAt(x, z) : null;
    if (d !== null && feetY >= d - DECK_STEP && d > g) { g = d; on = 'deck'; }
    if (props) { const st = this.standTop(x, z, feetY); if (st && st.y > g) { g = st.y; on = st.c; } }
    if (out) out.on = on;
    return g;
  },
  /** Can a walker stand here? (not deep water, not a cliff) */
  walkable(x, z) {
    const b = this.bridges.length ? this.bridgeAt(x, z) : null;
    if (b !== null) return true;
    if (this.hAt(x, z) < -0.4) return false;
    return this.slopeAt(x, z) < 0.84;
  },
  /** walkability margin (> 0 walkable): the slope and depth limits as one continuous field (bridges: 1) */
  walkF(x, z) {
    if (this.bridges.length && this.bridgeAt(x, z) !== null) return 1;
    return Math.min(0.84 - this.slopeAt(x, z), (this.hAt(x, z) + 0.4) * 2);
  },
  /** unit normal of the walkable edge near (x, z), pointing to the walkable side (null where the field is flat);
   *  e = the central-difference half step (small: the local edge; larger: its average direction) */
  walkNormal(x, z, out = {}, e = 0.25) {
    const gx = this.walkF(x + e, z) - this.walkF(x - e, z), gz = this.walkF(x, z + e) - this.walkF(x, z - e), l = Math.hypot(gx, gz);
    if (!(l > 1e-6)) return null;
    out.x = gx / l; out.z = gz / l;
    return out;
  },
  // ---- ground surface (footstep sounds, dust colour), from the splat weights
  splatK(x, z) { const i = clamp(Math.round(x + HALF), 0, N - 1), j = clamp(Math.round(z + HALF), 0, N - 1); return j * N + i; },
  dustColor(x, z) {
    const k = this.splatK(x, z);
    if (this.splatB[k * 4] > 0.5) return 0xffffff;
    if (this.splatA[k * 4 + 3] > 0.5) return 0xf6e4b8;
    if (this.splatB[k * 4 + 1] > 0.4) return 0xd8b088;
    return 0xd8e0b0;
  },
  /** EV.STEP surface: 'wood' on bridges, else snow / sand / dirt / grass by the same thresholds as dustColor
   *  ('water' is the player's wading state; 'stone' / 'wood' on a standable top come from the player) */
  surfaceAt(x, z) {
    if (this.bridgeAt(x, z) !== null) return 'wood';
    const k = this.splatK(x, z);
    if (this.splatB[k * 4] > 0.5) return 'snow';
    if (this.splatA[k * 4 + 3] > 0.5) return 'sand';
    if (this.splatB[k * 4 + 1] > 0.4) return 'dirt';
    return 'grass';
  },
  /** the walk grid for reachability: walkable cells minus every body collider's footprint (+ 0.25 m) — the same shapes
   *  Pip collides with (circles, boxes, rails), cuttable bushes and breakable pots excepted */
  buildWalk() {
    const W = new Uint8Array(SIZE * SIZE);
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const x = i - HALF + 0.5, z = j - HALF + 0.5;
      W[j * SIZE + i] = this.walkable(x, z) ? 1 : 0;
    }
    for (const c of this.solidShapes()) {
      if (c.body === false || (c.prop && (c.prop.cuttable || c.prop.breakable)) || (c.part && c.part.y0 >= 1.0)) continue;
      const R = Math.ceil(c.r + 1.25), ci = Math.floor(c.x + HALF), cj = Math.floor(c.z + HALF);
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
        if (shapeDist(c, i - HALF + 0.5, j - HALF + 0.5) < 0.25) W[j * SIZE + i] = 0;
      }
    }
    this.walk = W;
    return W;
  },
  buildColliderHash() {
    const raw = this.rawColliders();
    this.colliders = this.solidShapes();
    for (const c of this.colliders) this.bakeCollider(c);
    this._rawN = this.colliders.length;
    this.rehash();
    return raw;
  },
  /** fill a collider's height / shape fields from its kind, prop scale and the thing it stands on (force: re-bake) */
  bakeCollider(c, force = false) {
    if (c.y1 != null && c.camTop != null && c.rEye != null && (!force || c.fixed)) return c;
    const k = specFor(c), p = c.prop;
    if (!k && globalThis.G && globalThis.G.debugOn && !(this._unk || (this._unk = new Set())).has(c.kind)) { this._unk.add(c.kind); console.info('[Starseed] collider kind without heights (declare it with addProp collider):', c.kind); }
    // chests carry no prop: their scale is the heart chest's 1.15 (scatter.buildChests)
    const ch = c.kind === 'chest' ? c.chest || this.chests.find((q) => Math.abs(q.x - c.x) < 0.05 && Math.abs(q.z - c.z) < 0.05) : null;
    const s = p ? p.s || 1 : ch && ch.kind === 'heart' ? 1.15 : 1, P = c.part || null;
    let y0, h = P && P.h != null ? P.h * s : k && k.h != null ? k.h * s : UNKNOWN_H, cam = k && k.cam != null ? k.cam * s : null;
    if (c.y0 != null && c.y1 != null && !p && !ch) { y0 = c.y0; h = c.y1 - c.y0; }   // given heights (buildings, rails)
    else if (p) y0 = p.y - (k && k.sink ? k.sink * s : 0) + (P && P.y0 ? P.y0 * s : 0);
    else if (c.kind === 'house') {
      const b = this.nearestBuilding(c.x, c.z);
      y0 = b ? b.y - 0.05 : this.hAt(c.x, c.z);
      h = (b && HOUSE_H[b.type || 'shop']) || h;
    } else if (c.kind === 'chest') y0 = ch ? ch.y : this.hAt(c.x, c.z);
    else if (c.kind === 'tree' && this.greatTree) {
      y0 = this.greatTree.y - 0.1;
      h = c.th || this.greatTree.scaleHeight || h;
    } else y0 = this.ground(c.x, c.z);
    // pines: the spring arm's solid part ends where the measured skirt starts
    if (p && (p.type === 'tree_pine' || p.type === 'tree_snow') && !(declOf(p) && declOf(p).cam != null)) { const sk = pineSkirt(); if (sk != null) cam = Math.max(0.3, sk - 0.04) * s; }
    c.shape = c.shape || (k && k.shape) || 'circle';
    if (c.hx == null) {
      const obb = c.shape === 'obb' && k && k.hx != null;          // declared box: half extents × s, the prop's yaw
      c.hx = obb ? k.hx * s : 0; c.hz = obb ? (k.hz ?? k.hx) * s : 0; c.rot = obb && p ? p.rot || 0 : 0;
    }
    if (c.shape === 'obb' && !(c.hx > 0)) c.shape = 'circle';
    c.y0 = y0; c.y1 = y0 + h;
    c.camTop = cam != null ? Math.min(y0 + cam, c.y1) : c.y1;
    c.rEye = P ? (P.eye != null ? P.eye * s : c.r) : !k ? c.r + 0.1 : k.eyeS ? k.eyeS * s : k.eye != null ? k.eye : c.r + (k.eyeAdd || 0);
    c.stand = !!(k && k.stand && (!P || c.main !== false) && h <= STAND_MAX);
    return c;
  },
  /** FP eye keep-out (arch §4.2 / §7.3): keep eye (Vector3, moved in place) ≥ TUNE.move.eyeClear (M, 0.12 m) from the
   *  meshes of nearby colliders. Continuous in the eye position (no pops). Called by the FP rig every frame after its
   *  offsets; feet = the interpolated feet (unused: everything is read from the eye and the world).
   *  - sides: out of each collider's eye radius (circles: rEye; boxes / the star: the shape) along its XZ normal; above
   *    a collider's top the clearance shrinks like a sphere, so looking over low things is free
   *  - ceilings: overhead parts (c.over: eaves, the shop counter, awnings) and tree canopies (c.canopy) are never pushed
   *    against sideways (a side push from under a roof is a pop); the eye stays M below their underside instead, a
   *    ceiling that rounds the rim (radius M) and rises EYE_FLARE m per m further out, so it is continuous too. A
   *    canopy never pulls the eye below the standing eye height over the terrain there (a skirt that already hangs
   *    below the eye — the foundation's pines, until WP9 raises them — keeps the old view and only stops a jump from
   *    rising into it); an overhead part always keeps the eye M under it */
  eyeKeepOut(eye, feet = null) {
    const M = TM.eyeClear ?? 0.12;
    if (!(M > 0) || !this.cHash) return eye;
    this.nearColliders(eye.x, eye.z, EYE_REACH, _ek);
    for (let pass = 0; pass < 2; pass++) {
      for (const c of _ek) {
        if (c.over || eye.y < c.y0 - M || eye.y > c.y1 + M) continue;
        const exact = c.shape === 'obb' || c.shape === 'star', ext = exact ? 0 : c.rEye - c.r;
        const dx = eye.x - c.x, dz = eye.z - c.z, reach = c.r + Math.max(0, ext) + M;
        if (dx * dx + dz * dz > reach * reach) continue;
        const above = Math.max(0, eye.y - c.y1), need = above > 0 ? Math.sqrt(Math.max(0, M * M - above * above)) : M;
        const d = shapeDist(c, eye.x, eye.z, _sd) - ext;
        if (d < need) { eye.x += _sd.nx * (need - d); eye.z += _sd.nz * (need - d); }
      }
    }
    let cap = Infinity, cano = Infinity;
    for (const c of _ek) {
      if (c.over) cap = Math.min(cap, c.y0 - M + flareUp(shapeDist(c, eye.x, eye.z, _sd), M));
      else if (c.canopy) cano = Math.min(cano, canopyY(c, eye.x, eye.z) - M);
    }
    if (eye.y > cano) eye.y = Math.max(cano, Math.min(eye.y, this.ground(eye.x, eye.z) + TV.eyeH));
    if (eye.y > cap) eye.y = cap;
    return eye;
  },
  /** the FP eye ceiling over (x, z) (absolute y the eye may reach: overhead parts and canopies − eyeClear, flared), or
   *  Infinity; debug / tests */
  eyeCeiling(x, z) {
    const M = TM.eyeClear ?? 0.12;
    this.nearColliders(x, z, EYE_REACH, _ek);
    let cap = Infinity;
    for (const c of _ek) {
      if (c.over) cap = Math.min(cap, c.y0 - M + flareUp(shapeDist(c, x, z, _sd), M));
      else if (c.canopy) cap = Math.min(cap, canopyY(c, x, z) - M);
    }
    return cap;
  },
  /** the house or shop whose footprint holds (x, z) (house colliders carry no link to their building) */
  nearestBuilding(x, z) {
    let best = null, bd = 25;
    for (const b of this.houses.concat(this.shop ? [this.shop] : [])) { const d = (b.x - x) ** 2 + (b.z - z) ** 2; if (d < bd) { bd = d; best = b; } }
    return best;
  },
  rehash() {
    this.cHash = new Map();
    this.colliders.forEach((c) => {
      c.active = true;
      const x0 = Math.floor((c.x - c.r) / 4), x1 = Math.floor((c.x + c.r) / 4);
      const z0 = Math.floor((c.z - c.r) / 4), z1 = Math.floor((c.z + c.r) / 4);
      for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
        const key = (a + 100) * 1000 + (b + 100);
        let arr = this.cHash.get(key);
        if (!arr) this.cHash.set(key, (arr = []));
        arr.push(c);
      }
    });
  },
  addDynamicCollider(c) {
    c.active = true;
    this.bakeCollider(c);
    this.colliders.push(c);
    const x0 = Math.floor((c.x - c.r) / 4), x1 = Math.floor((c.x + c.r) / 4);
    const z0 = Math.floor((c.z - c.r) / 4), z1 = Math.floor((c.z + c.r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const key = (a + 100) * 1000 + (b + 100);
      let arr = this.cHash.get(key);
      if (!arr) this.cHash.set(key, (arr = []));
      arr.push(c);
    }
    return c;
  },
  /** active colliders whose hash cells overlap the square around (x, z) ± r; each once (query stamp, not includes) */
  nearColliders(x, z, r, out) {
    out.length = 0;
    if (!this.cHash) return out;
    const q = (this._qs = ((this._qs || 0) + 1) & 0x3fffffff) || (this._qs = 1);
    const x0 = Math.floor((x - r) / 4), x1 = Math.floor((x + r) / 4);
    const z0 = Math.floor((z - r) / 4), z1 = Math.floor((z + r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const arr = this.cHash.get((a + 100) * 1000 + (b + 100));
      if (!arr) continue;
      for (const c of arr) if (c.active && c._q !== q) { c._q = q; out.push(c); }
    }
    return out;
  },
  /**
   * First contact of a sphere moved from a to b: t ∈ [0, 1] (1 = clear). Two call forms:
   *   probeSegment(ax, ay, az, bx, by, bz, radius = 0.22, opts)   probeSegment(a, b, radius = 0.22, opts)   ({x, y, z})
   * Layers: terrain (hAt + clear), water (waterY), bridge decks (one-way: only when a starts above the deck), collider
   * cylinders / boxes [y0, camTop] widened by radius (top: 'body' uses y1); boxes are exact (a rounded box: the box
   * grown by the radius with round corners). Rails, roof eaves and the Great Tree's roots are colliders like any other.
   * A collider the segment starts inside is ignored.
   * opts (optional) is also the result: { terrain = true, water = true, decks = true, colliders = true, clear = 0.30,
   * waterY = 0.25, top = 'cam', ignore(c) } → opts.t, opts.kind ('terrain'|'water'|'deck'|'collider'|null), opts.collider
   */
  probeSegment(ax, ay, az, bx, by, bz, radius, opts) {
    if (typeof ax === 'object') { const a = ax, b = ay; radius = az; opts = bx; ax = a.x; ay = a.y; az = a.z; bx = b.x; by = b.y; bz = b.z; }
    if (radius == null) radius = 0.22;
    const o = opts || {};
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let best = 1, kind = null, hitC = null;
    // terrain / water / decks: march at ≤ 0.25 m, then bisect the first crossing
    const useT = o.terrain !== false, useW = o.water !== false, useD = o.decks !== false && this.bridges.length > 0;
    if (useT || useW || useD) {
      const clear = o.clear ?? 0.30, wy = o.waterY ?? 0.25;
      const floor = (t) => {
        const x = ax + dx * t, z = az + dz * t;
        let f = -1e9, k = null;
        if (useT) { f = this.hAt(x, z) + clear; k = 'terrain'; }
        if (useW && wy > f) { f = wy; k = 'water'; }
        if (useD) { const d = this.bridgeAt(x, z); if (d !== null && ay >= d - 0.05 && d + clear > f) { f = d + clear; k = 'deck'; } }
        _fk = k;
        return f;
      };
      const gap = (t) => ay + dy * t - floor(t);
      const n = Math.max(4, Math.ceil(Math.hypot(dx, dy, dz) / 0.25));
      if (gap(0) < 0) { best = 0; kind = _fk; }
      else {
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          if (gap(t) >= 0) continue;
          let lo = (i - 1) / n, hi = t;
          for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (gap(m) < 0) hi = m; else lo = m; }
          gap(hi); best = lo; kind = _fk;
          break;
        }
      }
    }
    // collider cylinders / boxes
    if (o.colliders !== false && best > 0) {
      const A = dx * dx + dz * dz, body = o.top === 'body';
      this.nearColliders((ax + bx) / 2, (az + bz) / 2, Math.sqrt(A) / 2 + radius, _near);
      for (const c of _near) {
        if (o.ignore && o.ignore(c)) continue;
        if (c.shape === 'star') {
          const t = segStar(c, ax, ay, az, dx, dy, dz, radius, body, best);
          if (t >= 0 && t < best) { best = t; kind = 'collider'; hitC = c; }
          continue;
        }
        let t0, t1;
        if (c.shape === 'obb') { if (!segRoundBox(c, ax, az, dx, dz, radius, _iv)) continue; t0 = _iv[0]; t1 = _iv[1]; }
        else {
          const R = c.r + radius, fx = ax - c.x, fz = az - c.z, C = fx * fx + fz * fz - R * R;
          if (A < 1e-12) { if (C > 0) continue; t0 = 0; t1 = 1; }
          else {
            const B = 2 * (fx * dx + fz * dz), disc = B * B - 4 * A * C;
            if (disc < 0) continue;
            const s = Math.sqrt(disc);
            t0 = (-B - s) / (2 * A); t1 = (-B + s) / (2 * A);
          }
        }
        if (t1 < 0 || t0 > best) continue;
        const lo = c.y0 - radius, hi = (body ? c.y1 : c.camTop) + radius;
        if (t0 < 0) { if (ay >= lo && ay <= hi) continue; t0 = 0; } // starts inside: never collapse onto it
        if (Math.abs(dy) < 1e-9) { if (ay < lo || ay > hi) continue; }
        else {
          let v0 = (lo - ay) / dy, v1 = (hi - ay) / dy;
          if (v0 > v1) { const w = v0; v0 = v1; v1 = w; }
          t0 = Math.max(t0, v0); t1 = Math.min(t1, v1);
        }
        if (t0 <= t1 && t0 < best) { best = t0; kind = 'collider'; hitC = c; }
      }
    }
    if (opts) { opts.t = best; opts.kind = kind; opts.collider = hitC; }
    return best;
  },
};
let _fk = null;
const _iv = [0, 0], _ss = { nx: 0, nz: 0 };

/** first t ∈ [0, tmax] where a sphere of radius R on the segment a + t·d touches a star collider (its outline grown by R,
 *  between y0 − R and its top + R: the polar height grid for the arm, y1 with body), or −1 (no contact, or the segment
 *  starts in contact: ignored like the other shapes). Marched at ≤ 0.1 m (under the 2R-wide band), then bisected */
function segStar(c, ax, ay, az, dx, dy, dz, R, body, tmax) {
  // the segment's closest approach to the centre: nowhere near the outline → clear
  const L2 = dx * dx + dz * dz, fx = ax - c.x, fz = az - c.z;
  const tc = L2 > 1e-12 ? clamp(-(fx * dx + fz * dz) / L2, 0, 1) : 0;
  if (Math.hypot(fx + dx * tc, fz + dz * tc) > c.r + R) return -1;
  if (starSolid(c, ax, ay, az, dx, dy, dz, R, body, 0)) return -1;
  const n = Math.max(2, Math.ceil((Math.sqrt(L2) * tmax) / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * tmax;
    if (!starSolid(c, ax, ay, az, dx, dy, dz, R, body, t)) continue;
    let lo = ((i - 1) / n) * tmax, hi = t;
    for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (starSolid(c, ax, ay, az, dx, dy, dz, R, body, m)) hi = m; else lo = m; }
    return lo;
  }
  return -1;
}
/** is the probe sphere (radius R) at a + t·d in contact with star collider c (outline grown by R, up to its top + R)? */
function starSolid(c, ax, ay, az, dx, dy, dz, R, body, t) {
  const x = ax + dx * t, z = az + dz * t, y = ay + dy * t;
  if (y < c.y0 - R || shapeDist(c, x, z, _ss) >= R) return false;
  return y <= (body ? c.y1 : Math.max(starTop(c, x, z), starTop(c, x - _ss.nx * R, z - _ss.nz * R))) + R;
}

/** XZ segment a + t·d against a box collider grown by R with round corners (convex): the t interval it spends inside,
 *  or false. Box slabs grown along one axis at a time, plus the four corner circles (no allocations: per probe) */
function segRoundBox(c, ax, az, dx, dz, R, out) {
  const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0), px = ax - c.x, pz = az - c.z;
  const lx = px * cs - pz * sn, lz = px * sn + pz * cs, ux = dx * cs - dz * sn, uz = dx * sn + dz * cs;
  _rb[0] = Infinity; _rb[1] = -Infinity;
  slab2(lx, lz, ux, uz, c.hx + R, c.hz); slab2(lx, lz, ux, uz, c.hx, c.hz + R);
  corner(lx - c.hx, lz - c.hz, ux, uz, R); corner(lx + c.hx, lz - c.hz, ux, uz, R);
  corner(lx - c.hx, lz + c.hz, ux, uz, R); corner(lx + c.hx, lz + c.hz, ux, uz, R);
  if (!(_rb[0] <= _rb[1])) return false;
  out[0] = _rb[0]; out[1] = _rb[1];
  return true;
}
const _rb = [0, 0];
/** one slab interval (|x| ≤ hx and |z| ≤ hz for p + s·u in the box frame) merged into _rb */
function slab2(lx, lz, ux, uz, hx, hz) {
  let a = -Infinity, b = Infinity;
  if (Math.abs(ux) < 1e-12) { if (lx < -hx || lx > hx) return; }
  else { let s0 = (-hx - lx) / ux, s1 = (hx - lx) / ux; if (s0 > s1) { const w = s0; s0 = s1; s1 = w; } a = s0; b = s1; }
  if (Math.abs(uz) < 1e-12) { if (lz < -hz || lz > hz) return; }
  else { let s0 = (-hz - lz) / uz, s1 = (hz - lz) / uz; if (s0 > s1) { const w = s0; s0 = s1; s1 = w; } a = Math.max(a, s0); b = Math.min(b, s1); }
  if (a > b) return;
  _rb[0] = Math.min(_rb[0], a); _rb[1] = Math.max(_rb[1], b);
}
/** a corner circle (offset f from the walker start, radius R) merged into _rb */
function corner(fx, fz, ux, uz, R) {
  const A = ux * ux + uz * uz, C = fx * fx + fz * fz - R * R;
  if (A < 1e-12) { if (C <= 0) { _rb[0] = -Infinity; _rb[1] = Infinity; } return; }
  const B = 2 * (fx * ux + fz * uz), disc = B * B - 4 * A * C;
  if (disc < 0) return;
  const s = Math.sqrt(disc);
  _rb[0] = Math.min(_rb[0], (-B - s) / (2 * A)); _rb[1] = Math.max(_rb[1], (-B + s) / (2 * A));
}
