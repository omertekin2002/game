// Third-person rig (WP1): over the shoulder, level with Pip. Pivot above Pip's feet (smoothed), shoulder offset along
// the camera right, boom straight back along the look direction, so the orientation is exactly the look yaw / pitch
// (FP ↔ TP never rotates). The boom shortens looking up and lengthens a little looking down (feel §10.1).
// Spring arm (feel §10.2, arch §4.5), in this order every render frame:
// 0. pivot: follows the feet as a ramp-exact first-order filter (the lag behind a steady walk is the same at any frame time);
//    a narrow screen (portrait: vertical FOV widened up to 100°) shortens the boom by the same factor, ≥ tpNarrowMin;
// 1. side leg pivot → shoulder: a slope or a collider on the shoulder side pulls the shoulder in (a spring toward the soft
//    probe's target, the hard probe immediate; slow release);
// 2. slide: when a collider blocks the boom (a trunk or post right behind Pip), the shoulder offset slides sideways —
//    further out or over the other shoulder (never to the centre: Pip would stand under the crosshair, and any offset
//    that leaves him within tpSlideCentreW shoulders of it costs extra), whichever keeps the longest arm for the least
//    sideways move — eased, so backing into a tree glides the camera around it instead of collapsing it into Pip's head;
//    through the band under the crosshair it crosses fast (tpSlideCross);
// 3. boom: low colliders (rocks, stumps, fences, chests… whose top is under the pivot + tpLowTop) are part of the
//    camera floor with the terrain, water and decks: the camera is lifted over them (ground hug, framing-capped) — but
//    only those the hug can really ride over on this boom (pruneLow: a 1.35 m altar or a sign right behind Pip is a
//    wall again, so the arm stops at its face or the slide steps round it instead of folding into Pip's head); walls
//    (houses, trunks, boulders, the well) pull the arm in at once (never a wall's inside); a wider soft probe makes the
//    slide side-step them before they reach the boom. Release is slow (λ tpArmRelease, ≤ 4·dt·boom per frame).
//    Thin trunks and posts (PASS kinds, r ≤ tpPassR) that cross the boom between Pip and a camera that is already
//    behind them do not pull the arm in: the camera stays put and the occluder dither shows Pip through the trunk (no
//    2 m pop each time the boom swings past a tree). The camera itself never enters one (≥ tpPassGap from its circle)
//    and never passes through one: a trunk beyond the camera stops the release in front of it.
// 4. canopies (tree crowns, pine skirts: from each tree's camTop up, shapes in CANOPY) keep the camera point out: the
//    arm eases in under the leaves (looking down in the woods) instead of showing a crown's inside; a canopy that
//    already holds the shoulder point (Pip under a low skirt) cannot be escaped that way and is ignored.
// 5. Pip dithers out under tpFadeBody and hides under tpHideBody (bodyFade, C12; player-body.js applies it). The shoulder
//    offset shrinks with the arm (sideK ≤ offScale: Pip's centre stays within tpOffEdge NDC of the middle), so a short
//    arm against a wall never pushes him to the screen edge or off it.
// 6. fence (boss arenas): the vine gate is no collider, so while it stands the camera point keeps inside the arena within
//    the gate's span (gate.r past the ring): the arm pulls in (eased) instead of ending up behind the vines. It stays open
//    while a locked boss is in the air (fence.open: Frostbun's leap needs the long lock boom; the vines are below the
//    boss and dither around Pip), then closes again, eased.
// 7. feet (r3): a short arm lowers the camera point so Pip's feet stay on screen (feetDrop; part of the crosshair height).
// r3 also: a low collider the camera rides over stays floor until the arm is in front of it (no wall-verdict snap), and the
// canopy pull-in never comes in through a crossed trunk.
// Extra inputs set by the wp1-feel module: lockBoom / lockPivot / lockHug (lock-on framing, eased), pivotDrop (dizzy cam),
// airDrop (the pivot follows only part of a jump), fence (the standing vine gate), aspect (the camera's).
import * as THREE from 'three';
import { view as T } from '../tune.js';
import { damp, clamp, smoothstep } from '../util.js';

const N = 12;
const PIP_H = 1.0;   // Pip's height: the head top sits pivotH − PIP_H under the pivot
const MARGIN = 0.05; // the arm stops this far short of a contact
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
// never part of the camera floor: trees (their crowns hang over) and bushes (riding over one hides Pip behind it: the
// slide side-steps them instead)
const NOT_LOW = { tree_round: 1, tree_pine: 1, tree_snow: 1, tree_palm: 1, tree: 1, bush: 1 };
// thin occluders the boom may cross (trees use the occluder dither; posts are thinner than Pip)
const PASS = { tree_round: 1, tree_pine: 1, tree_snow: 1, tree_palm: 1, lamp: 1, sign: 1 };
// canopy shapes at scale 1, from the collider's camTop (where the crown / lowest skirt starts) up to its top (y1):
// pine tiers [radius, bottom, top] relative to the lowest skirt (props.js treePine), round crowns as an ellipsoid
const PINE_TIERS = [[1.75, 0, 2.0], [1.4, 1.15, 2.95], [1.05, 2.18, 3.73], [0.7, 3.1, 4.4]];
const CANOPY = { tree_pine: 'pine', tree_snow: 'pine', tree_round: 'round' };
const _a = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 }, _sd = { x: 0, y: 0, z: 0 }, _s = { x: 0, y: 0, z: 0 }, _q = { x: 0, y: 0, z: 0 };
const _sc = { x: 0, y: 0, z: 0 }, _sd2 = { x: 0, y: 0, z: 0 }, _q2 = { x: 0, y: 0, z: 0 };
const _near = [];
/** first-order follow (λ lam) of a target that moved linearly from u0 to u1 over dt: exact for a ramp, so the lag behind
 *  a target moving at v is v/λ at any frame time (r2: damp's per-frame lag v·(dt/(1 − e^−λdt) − dt) changes with dt, and
 *  the TP camera's speed behind a steady 4.4 m/s walk wobbled 3.9–4.7 m/s at uneven frame times) */
function follow(x, u0, u1, lam, dt) {
  if (!(dt > 0)) return x;
  const k = lam * dt, e = Math.exp(-k);
  return u1 + (x - u0) * e - ((u1 - u0) * (1 - e)) / k;
}

export class RigTP {
  /** how much of Pip to draw at this arm length (view.bodyFade, 0..1): RULINGS dither band, hidden under tpHideBody */
  bodyFade(arm) { return clamp((arm - T.tpHideBody) / (T.tpFadeBody - T.tpHideBody), 0, 1); }
  constructor() {
    this.pivot = new THREE.Vector3();
    this.pu = new THREE.Vector3();             // the pivot's target last frame (follow)
    this.cam = new THREE.Vector3();
    this.shoulder = new THREE.Vector3();
    this.boom = T.tpBoom;          // wheel-adjusted desired length (target)
    this.len = T.tpBoom;           // eased desired length
    this.arm = T.tpBoom;           // current length
    this.sideBase = 1;             // eased shoulder side from the setting (−1 left, 0 centre, 1 right)
    this.slideAdj = 0; this.slideTo = 0; // slide, in shoulder units, added to the side
    this.side = 1;                 // sideBase + slideAdj (view.freezeAim reads it)
    this.sideK = 1;                // shoulder-offset factor = legF · armK (view.freezeAim / lockon read it)
    this.legF = 1; this.armK = 1;  // side-leg clearance factor / the arm's offset scale (offScale), each eased
    this.legV = 0;                 // the side leg's pull-in rate (1/s, spring)
    this.lift = 0;
    this.drop = 0;                 // r3: the camera point lowered so Pip's feet stay on screen (feetDrop)
    this.hit = false; this.clear = T.tpBoom;  // boom shortened / the length it is heading to
    this.collide = false;                     // a collider caps the boom this frame
    this.live = false;                        // updated at least once since the last snap (view.freezeAim uses it)
    this.lockBoom = 0; this.lockPivot = 0; this.lockB = 0; this.lockP = 0; // lock-on (targets / eased)
    this.lockHug = 0; this.lockH = 0;        // r3: extra ground-hug lift allowed under a lifted boss's lock (target / eased)
    this.pivotDrop = 0; this.airDrop = 0;
    this.liftK = 0.4; this.headDrop = 0.2;   // hugMax(a) = liftK·a − headDrop (set per update from the FOV)
    this.frameCap = (len) => this.hugMax(len);
    this.hugCap = () => T.tpHug + T.tpHugEase + this.lockH; // r3: the physical limit while an eased pull-in runs (the framing fit keeps tpHug)
    this.low = []; this.lowSet = new Set();   // nearby low colliders (camera floor) this frame
    this.walls = new Set(); this._walls = new Set(); // low colliders pruneLow made walls this frame / the last
    this.trees = [];                          // nearby trees with a canopy (camera keep-out) this frame
    this.dbg = false; this.scores = [];       // dbg: record the last slide evaluation [[slide, score], …]
    this.pass = { sx: 0, sz: 0, dx: 0, dz: 0, a: 0, L: 0 }; this.passOn = false; // boom probe: shoulder, back (xz), camera arm
    this.passed = 0; this.canopy = false;     // debug: trunks crossed by the boom / the canopy capped the arm this frame
    this.fence = null;                        // { x, z, r, ang, half, soft, top } arena keep-in (feel.js), or null
    this.fenced = false;                      // debug: the fence capped the arm this frame
    this.aspect = 16 / 9; this.tanH = 1;      // camera aspect (feel.js) / tan(horizontal FOV / 2) this frame
    this.narrow = 1;                          // view.js: tan(vFOV/2) at 16:9 over now (< 1 on a narrow screen: shorter boom)
    this._cl = [];                            // canopyLen's working list
    this.ignoreLow = (c) => this.lowSet.has(c) || (this.passOn && this.passable(c));
    this._po = { terrain: false, water: false, decks: false, ignore: this.ignoreLow };
    // line of sight to Pip (r2, sees): low colliders (the camera rides over them) and thin trunks / posts (the occluder
    // dither shows Pip through them) never block it
    this._ps = { terrain: false, water: false, decks: false, ignore: (c) => this.lowSet.has(c) || (!!PASS[c.kind] && c.r <= T.tpPassR) };
    this.sighted = true;                      // debug: the camera saw Pip without a sight pull-in this frame
    this.noPass = false; this.trunkT = 0;     // slide scoring with crossed trunks as walls / how long one stood near the camera
    this._crossed = []; this._rec = false;    // r3: trunks the boom probe crossed this frame (behindTrunks)
    this.pushOut = 0;                         // r3: the arm that takes the camera point out of a crossed trunk's gap
  }
  /** the camera point (x, y, z) has a line of sight to Pip (the pivot over his head) */
  sees(W, x, y, z) {
    // any of three points across his head: the pivot and ± tpSightW along the camera right (a post or a beam that only
    // hides the middle is the occluder dither's job, not the arm's)
    _q.x = x; _q.y = y; _q.z = z;
    const p = this.pivot, r = this._right, w = T.tpSightW;
    if (W.probeSegment(_q, p, 0.04, this._ps) >= 1) return true;
    if (!r) return false;
    _q2.x = p.x + r.x * w; _q2.y = p.y; _q2.z = p.z + r.z * w;
    if (W.probeSegment(_q, _q2, 0.04, this._ps) >= 1) return true;
    _q2.x = p.x - r.x * w; _q2.z = p.z - r.z * w;
    return W.probeSegment(_q, _q2, 0.04, this._ps) >= 1;
  }
  /** how far (≤ want) the camera at c may move sideways along d toward Pip's own line (the offset scale): short of
   *  anything in its way, and (r2) never round a corner out of his sight (the move starts where the camera sees him) */
  sideIn(W, c, d, want) {
    let got = Math.min(want, this.collLen(W, c, d, want));
    if (W.probeSegment && got > 0.02 && !this.noSight && !this.sees(W, c.x + d.x * got, c.y, c.z + d.z * got)) {
      let lo = 0, hi = got;
      for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (this.sees(W, c.x + d.x * m, c.y, c.z + d.z * m)) lo = m; else hi = m; }
      got = lo;
    }
    return got;
  }
  /** longest arm ≤ this.arm along S → S + back·a (+ the lift, scaled) from which the camera sees Pip and, after the offset
   *  scale's sideways move toward his line (offL: the leg's lateral offset), keeps his centre within tpSightEdge NDC. The
   *  boom is probed from the slid / side-leg shoulder, so the straight line back to Pip can cut a corner the boom went round
   *  (r2: Pip's back to the 1.35 m altar — the slid camera ended behind the slab, Pip wholly occluded, a grey wall over two
   *  thirds of the screen; stopping only for the sight left him at the screen edge) */
  sightLen(W, S, back, right, offL) {
    const arm = this.arm, lift = this.lift, ao = Math.abs(offL), c = _sc;
    _sd2.x = right.x * (offL > 0 ? -1 : 1); _sd2.y = 0; _sd2.z = right.z * (offL > 0 ? -1 : 1);
    const ok = (a) => {
      c.x = S.x + back.x * a; c.y = S.y + back.y * a + (arm > 0 ? (lift * a) / arm : 0); c.z = S.z + back.z * a;
      if (!this.sees(W, c.x, c.y, c.z)) return false;
      if (ao <= 0.01 || a <= T.tpHideBody) return true;
      const want = ao * (1 - this.offScale(offL, a));
      if (want <= 0.01) return true;
      // only a move the sight cut short counts (a wall in the way keeps the old rule: Pip dithered by the edge)
      const g1 = Math.min(want, this.collLen(W, c, _sd2, want)), g2 = this.sideIn(W, c, _sd2, want);
      return g2 >= g1 - 0.02 || ao - g2 <= T.tpSightEdge * a * this.tanH;
    };
    if (ok(arm)) return arm;
    let lo = 0, hi = arm;
    for (let i = 7; i >= 1; i--) { const m = (arm * i) / 8; if (ok(m)) { lo = m; break; } hi = m; }
    for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return lo;
  }
  /** a thin trunk / post the boom may cross: it lies between the shoulder and the camera as it is now (never beyond it),
   *  and the camera point keeps tpPassGap from its circle */
  passable(c) {
    const P = this.pass;
    if (!PASS[c.kind] || c.r > T.tpPassR) return false;
    const ex = P.sx + P.dx * P.a, ez = P.sz + P.dz * P.a;
    const along = (c.x - P.sx) * P.dx + (c.z - P.sz) * P.dz;   // the trunk's centre along the boom (xz)
    const bl = Math.hypot(P.dx, P.dz);
    if (along > P.a * bl * bl) return false;
    const dc = Math.hypot(ex - c.x, ez - c.z);
    if (dc < c.r + T.tpPassGap) {
      // r3: the camera point came within tpPassGap of a trunk it is behind (the boom swept sideways): it steps back out of
      // the gap (pushOut, the main probe) where the boom is long enough; else the arm snaps in to the trunk's near side
      if (!(bl > 0.05)) return false;
      const R = c.r + T.tpPassGap + 0.02, lat = Math.abs((c.x - P.sx) * P.dz - (c.z - P.sz) * P.dx) / bl;
      const far = (along / bl + Math.sqrt(Math.max(0, R * R - lat * lat))) / bl;
      if (!(far <= P.L)) return false;
      if (this._rec) this.pushOut = Math.max(this.pushOut, far);
    }
    this.passed++;
    if (this._rec) this._crossed.push(c);
    return true;
  }
  pivotH(sideTarget) { return sideTarget === 0 ? T.tpPivotCenter : T.tpPivot; }
  snap(feet, sideTarget = 1) {
    this.sideBase = this.side = sideTarget; this.slideAdj = this.slideTo = 0;
    this.lockB = this.lockBoom; this.lockP = this.lockPivot; this.lockH = this.lockHug;
    this.pivot.set(feet.x, feet.y + this.pivotH(sideTarget) + this.lockP - this.pivotDrop - this.airDrop, feet.z);
    this.pu.copy(this.pivot);
    this.len = this.arm = this.boom;
    this.sideK = this.legF = this.armK = 1; this.legV = 0; this.lift = 0; this.drop = 0; this.live = false; this.trunkT = 0;
  }
  zoom(dy) { this.boom = clamp(this.boom + dy * 0.0025, T.tpBoomMin, T.tpBoomMax); }
  /** boom length rule for the look pitch (rad): shorter looking up, a little longer looking down */
  pitchK(p) { return p >= 0 ? 1 - T.tpUpShort * smoothstep(0, 50 * D2R, p) : 1 + T.tpDownLong * smoothstep(0, 55 * D2R, -p); }
  /** world floor for the camera at (x, z): terrain + clearance, never below the water line; a bridge deck counts while
   *  the pivot is above it; a low collider (this.low) lifts it over its top */
  floor(W, x, z) {
    let f = Math.max(W.hAt(x, z) + T.tpClear, T.tpWater);
    if (W.bridges && W.bridges.length) { const d = W.bridgeAt(x, z); if (d !== null && this.pivot.y >= d && d + T.tpClear > f) f = d + T.tpClear; }
    for (let i = 0; i < this.low.length; i++) {
      const c = this.low[i], R = c.r + T.tpProbe, dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < R * R && c.camTop + T.tpProbe > f) f = c.camTop + T.tpProbe;
    }
    return f;
  }
  /** colliders near the pivot that the camera rides over instead of pulling in for (rocks, stumps, fences, chests…) */
  gatherLow(W, reach) {
    this.low.length = 0; this.trees.length = 0; this.lowSet.clear();
    if (!W.nearColliders) return;
    W.nearColliders(this.pivot.x, this.pivot.z, reach, _near);
    const top = this.pivot.y + T.tpLowTop - T.tpProbe;
    for (const c of _near) {
      if (c.active === false || c.camTop == null) continue;
      if (CANOPY[c.kind]) this.trees.push(c);
      if (!NOT_LOW[c.kind] && c.camTop <= top) { this.low.push(c); this.lowSet.add(c); }
    }
  }
  /** low colliders the framing-capped hug cannot ride over on this boom are walls again (out of the floor, back in the
   *  probe): from the pivot p along back, the boom reaches a collider's near edge at length s; the rotating lift that
   *  clears its top there is (top − y(s))·L / s, which must fit hugMax(L). One standing right at Pip's back (s ≈ 0) is a
   *  wall unless it is under the pivot. The along-boom distance does not depend on the shoulder offset, so the slide's
   *  candidates share the verdict */
  pruneLow(p, back, L, fresh = false) {
    const hb = Math.hypot(back.x, back.z), cap = this.hugMax(L), was = this.walls, now = this._walls;
    now.clear();
    for (let i = this.low.length - 1; i >= 0; i--) {
      const c = this.low[i], top = c.camTop + T.tpProbe;
      const s = hb > 0.05 ? (((c.x - p.x) * back.x + (c.z - p.z) * back.z) / hb - c.r) / hb : 0;
      if (s > L) continue;                                                     // beyond the camera
      // (one beside Pip stays floor while the shoulder can pass over it: a fence at his side keeps the shoulder offset;
      // one that was a wall last frame needs a 25 % margin to ride again, so a boom that sweeps the threshold does not
      // flip it every frame)
      const k = was.has(c) ? 0.75 : 1;
      if (s > 0.05 ? (top - (p.y + back.y * s)) * L <= k * cap * s : top <= p.y + T.tpLowSide - (k < 1 ? 0.05 : 0)) continue;
      // r3: one the camera is riding over right now (floor last frame, the camera past its footprint's near edge) stays floor
      // until the arm is in front of it: the fit then brings the arm in along the hug's limit, continuously. A wall verdict
      // snapped the arm in, dropped the lift and the shoulder leg in one frame (peaks walks: 0.5–2.4 m pops; backing into
      // the altar: 1.2 m)
      if (k === 1 && s > 0.05 && !fresh && this.arm > s - (T.tpProbe + MARGIN) / Math.max(0.05, hb)) continue;
      this.low[i] = this.low[this.low.length - 1]; this.low.pop(); this.lowSet.delete(c); now.add(c);
    }
    this._walls = was; this.walls = now;
  }
  /** shoulder-offset factor for an arm: Pip's centre (≈ off / (arm · tanH) NDC from the middle) stays within tpOffEdge */
  offScale(off, arm) { const ao = Math.abs(off); return ao < 0.01 ? 1 : clamp((T.tpOffEdge * Math.max(0, arm) * this.tanH) / ao, 0, 1); }
  /** longest clear length (m) along p → p + d·len against colliders (W.probeSegment; terrain and low colliders are the
   *  floor's job), probe radius r; pass = the camera's current arm on this boom (thin trunks it is behind are crossed) */
  collLen(W, p, d, len, r = T.tpProbe, pass = -1) {
    if (!W || !W.probeSegment || len <= 0) return len;
    _a.x = p.x; _a.y = p.y; _a.z = p.z;
    _b.x = p.x + d.x * len; _b.y = p.y + d.y * len; _b.z = p.z + d.z * len;
    if (pass > 0 && !this.noPass) { const P = this.pass; P.sx = p.x; P.sz = p.z; P.dx = d.x; P.dz = d.z; P.a = Math.min(pass, len); P.L = len; this.passOn = true; }
    const t = W.probeSegment(_a, _b, r, this._po);
    this.passOn = false;
    return t >= 1 ? len : Math.max(0, t * len - MARGIN);
  }
  /** allowed radius of the fence at a camera point (x, y, z): F.r inside the gate's span, opening out over F.soft rad
   *  beyond its edges (no pop when the boom swings past an edge); above the vines (F.top) there is no limit */
  fenceR(x, y, z) {
    const F = this.fence, dx = x - F.x, dz = z - F.z;
    if (y > F.top) return Infinity;
    let da = Math.atan2(dx, dz) - F.ang;
    da = Math.abs(da - TAU * Math.round(da / TAU));
    if (da <= F.half) return F.r;
    if (da >= F.half + F.soft) return Infinity;
    const u = (da - F.half) / F.soft;
    return F.r + 8 * u * u;
  }
  /** the boom point at arm a lies outside the fence */
  fenceOut(p, d, a) {
    const x = p.x + d.x * a, y = p.y + d.y * a, z = p.z + d.z * a, R = this.fenceR(x, y, z);
    return R !== Infinity && Math.hypot(x - this.fence.x, z - this.fence.z) > R;
  }
  /** longest arm ≤ len along p → p + d·len whose points stay inside the fence (scan out, then bisect); only while the
   *  shoulder is inside the arena (a gate still sinking after a respawn elsewhere keeps nothing in) */
  fenceLen(p, d, len) {
    const F = this.fence;
    if (!F || F.open || len <= 0.05 || Math.hypot(p.x - F.x, p.z - F.z) > F.r - 0.2 || this.fenceOut(p, d, 0)) return len;
    let lo = 0, hi = -1;
    for (let i = 1; i <= N; i++) { const m = (len * i) / N; if (this.fenceOut(p, d, m)) { hi = m; break; } lo = m; }
    if (hi < 0) return len;
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (this.fenceOut(p, d, m)) hi = m; else lo = m; }
    return Math.max(0, lo - MARGIN);
  }
  /** the shortest arm along S → S + back·arm that keeps the camera point tpPassGap behind every trunk the boom crossed */
  behindTrunks(S, back) {
    const hb = Math.hypot(back.x, back.z) || 1, ax = back.x / hb, az = back.z / hb;
    let m = 0;
    for (const c of this._crossed) {
      const dx = c.x - S.x, dz = c.z - S.z, along = dx * ax + dz * az, lat = Math.abs(dx * az - dz * ax), R = c.r + T.tpPassGap + 0.02;
      if (lat < R) m = Math.max(m, (along + Math.sqrt(R * R - lat * lat)) / hb);
    }
    return m;
  }
  /** how deep (m, > 0 inside) the point q is in canopy c (tpCanopyPad included) */
  inCanopy(c, q) {
    const s = (c.prop && c.prop.s) || 1, pad = T.tpCanopyPad, u = c.camTop, h = q.y - u, d = Math.hypot(q.x - c.x, q.z - c.z);
    if (h < -pad || q.y > (c.y1 ?? u + 5 * s) + pad) return -1;
    if (CANOPY[c.kind] === 'round') {
      const rx = 2.0 * s + pad, ry = 1.55 * s + pad, cy = u + 1.5 * s;
      const e = Math.hypot(d / rx, (q.y - cy) / ry);
      return e < 1 ? (1 - e) * rx : -1;
    }
    let best = -1;
    for (let i = 0; i < PINE_TIERS.length; i++) {
      const P = PINE_TIERS[i], R = P[0], hb = P[1] * s, ht = P[2] * s;
      if (h < hb - pad || h > ht + pad) continue;
      const rr = R * s * (1 - clamp((h - hb) / (ht - hb), 0, 1)) + pad;
      if (d < rr) best = Math.max(best, rr - d);
    }
    return best;
  }
  /** longest arm ≤ len whose camera point is outside every nearby canopy that does not already hold the shoulder */
  canopyLen(p, d, len) {
    if (!this.trees.length || len <= 0.05) return len;
    const list = this._cl;
    list.length = 0;
    for (const c of this.trees) if (this.inCanopy(c, p) < 0) list.push(c);
    if (!list.length) return len;
    if (!this.canopyAt(p, d, len, list)) return len;
    let lo = 0, hi = len;
    for (let i = N - 1; i >= 1; i--) { const m = (len * i) / N; if (!this.canopyAt(p, d, m, list)) { lo = m; break; } hi = m; }
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (this.canopyAt(p, d, m, list)) hi = m; else lo = m; }
    return lo;
  }
  /** the boom point at arm a is inside one of the canopies of list */
  canopyAt(p, d, a, list) {
    _q.x = p.x + d.x * a; _q.y = p.y + d.y * a; _q.z = p.z + d.z * a;
    for (let i = 0; i < list.length; i++) if (this.inCanopy(list[i], _q) > 0) return true;
    return false;
  }
  /** lift needed along a → a + d·len so every sample clears the floor (raising the end by L raises sample t by L·t) */
  need(W, a, d, len) {
    let need = 0;
    for (let i = 2; i <= N; i++) {
      const t = i / N, x = a.x + d.x * len * t, y = a.y + d.y * len * t, z = a.z + d.z * len * t;
      const f = this.floor(W, x, z);
      if (y < f) need = Math.max(need, (f - y) / t);
    }
    return need;
  }
  /** lift allowed on an arm of length a: the full hug on a long arm, fading as it shortens (head top stays in frame) */
  hugMax(a) { return clamp(this.liftK * a - this.headDrop, 0, T.tpHug + this.lockH); }
  /** longest arm in [lo, hi] whose lift need fits cap(len) (scan inward from hi, then bisect; lo is the fallback).
   *  Behind a ledge the fitting arms split into a short run in front of it and a long run over it: the long one wins */
  fitArm(W, a, d, lo, hi, cap) {
    if (this.need(W, a, d, hi) <= cap(hi)) return hi;
    for (let i = N - 1; i >= 1; i--) {
      let m0 = lo + ((hi - lo) * i) / N;
      if (this.need(W, a, d, m0) > cap(m0)) { hi = m0; continue; }
      for (let k = 0; k < 6; k++) { const m = (m0 + hi) / 2; if (this.need(W, a, d, m) <= cap(m)) m0 = m; else hi = m; }
      return m0;
    }
    return lo;
  }
  /** largest fraction of the shoulder leg p → p + right·off whose points keep tpSideRoom above the floor (continuous) */
  sideLeg(W, p, right, off) {
    let g0 = this.sideRoom(W, p, right, off, 0);
    if (g0 < 0) return 0;
    for (let i = 1; i <= 8; i++) {
      const g = this.sideRoom(W, p, right, off, i / 8);
      if (g < 0) return (i - 1 + g0 / (g0 - g)) / 8;
      g0 = g;
    }
    return 1;
  }
  /** room above the floor at fraction t of the shoulder leg: tpSideRoom over the terrain / water / decks, but only
   *  tpLowSide over a low collider's top (the shoulder passes over a fence at Pip's side; the floor's tpProbe margin plus
   *  tpSideRoom used to fold the shoulder into the crosshair next to any fence or chest) */
  sideRoom(W, p, right, off, t) {
    const x = p.x + right.x * off * t, z = p.z + right.z * off * t;
    // the dizzy drop lowers the camera, not the room the shoulder needs (r2: with the pivot dropped 0.5–0.6 m the room at
    // Pip himself went negative, the leg snapped from 1 to 0 in one frame and the camera jumped 0.8 m sideways)
    const py = p.y + this.pivotDrop;
    let f = Math.max(W.hAt(x, z) + T.tpClear, T.tpWater) + T.tpSideRoom;
    if (W.bridges && W.bridges.length) { const d = W.bridgeAt(x, z); if (d !== null && py >= d && d + T.tpClear + T.tpSideRoom > f) f = d + T.tpClear + T.tpSideRoom; }
    for (let i = 0; i < this.low.length; i++) {
      const c = this.low[i], R = c.r + 0.1, dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < R * R && c.camTop + T.tpLowSide > f) f = c.camTop + T.tpLowSide;
    }
    return py - f;
  }
  /** side-leg fraction (terrain room + colliders) for a lateral offset off (m, + = right) */
  legK(W, p, right, off) {
    const ao = Math.abs(off);
    if (!W || ao < 0.01) return 1;
    let k = this.sideLeg(W, p, right, off);
    const sg = off < 0 ? -1 : 1; _sd.x = right.x * sg; _sd.y = 0; _sd.z = right.z * sg;
    return Math.min(k, this.collLen(W, p, _sd, ao) / ao);
  }
  /** clear boom length from the shoulder point for lateral offset off (hard probe) → { len, k } */
  boomFor(W, p, right, back, off, L, r = T.tpProbe) {
    const k = this.legK(W, p, right, off);
    _s.x = p.x + right.x * off * k; _s.y = p.y; _s.z = p.z + right.z * off * k;
    return this.collLen(W, _s, back, L, r, this.arm);
  }
  /** slide score for the extra offset o (m) on top of base: clear boom (half hard probe, half soft probe: a candidate
   *  that also keeps the soft margin wins) for the least sideways move; over the shoulder (cz > 0) an offset that would
   *  park Pip under the crosshair (lateral < cz, after the leg and the arm's offset scale) costs up to tpSlideCentre (a
   *  wall on the shoulder side swings the camera over the other shoulder),
   *  and so does one that leaves Pip's centre toward the screen edge: past NDC tpSlideEdge (0.25 W) at the arm it would
   *  get, tpSlideEdgeCost m of arm per NDC unit (a collapsed arm with Pip beside the camera scores worst of all) */
  slideScore(W, p, right, back, L, base, cz, o) {
    const off = base + o * T.tpShoulder, k = this.legK(W, p, right, off);
    const hard = this.boomFor(W, p, right, back, off, L), soft = Math.min(hard, this.boomFor(W, p, right, back, off, L, T.tpSoftProbe) + T.tpSoftProbe - T.tpProbe);
    // the lateral Pip gets, both ways pessimistic: under the crosshair after the arm's offset scale (a short arm brings
    // the camera in), toward the edge without it (the camera may not be able to come in)
    let arm = Math.min(L, 0.5 * (hard + soft));
    // r3: a candidate whose camera point would not see Pip is no way out (the sight rule would pull it in, and only part
    // way): Pip's back to the altar, a slide round the slab ended at 1.4 m with him solid in the corner of the frame, cut
    // off — it scores as a collapsed arm (the edge cost then prefers the unslid camera in his head: hidden, view clear)
    if (arm > T.tpHideBody && W.probeSegment && !this.noSight) {
      const sx = p.x + right.x * off * k, sz = p.z + right.z * off * k;
      if (!this.sees(W, sx + back.x * arm, p.y + back.y * arm, sz + back.z * arm)) arm = 0;
    }
    const lat = Math.abs(off * k), latIn = lat * this.offScale(off * k, arm);
    const centre = cz > 0 ? T.tpSlideCentre * Math.max(0, 1 - latIn / cz) : 0;
    const edge = Math.max(0, lat / (Math.max(0.3, arm) * this.tanH) - T.tpSlideEdge) * T.tpSlideEdgeCost;
    // (r2: easing round a crossed trunk never trades it for Pip under the crosshair: that slide is no candidate)
    if (this.noPass && o !== 0 && cz > 0 && latIn < cz) return -Infinity;
    return arm * k - T.tpSlideCost * Math.abs(o * T.tpShoulder) - centre - edge;
  }
  /** feet: interpolated root; back: unit vector from pivot to the camera (−look dir); right: camera right (xz);
   *  tanHalf: tan(vertical FOV / 2) of the camera, for the framing bound on the lift */
  update(feet, back, right, dt, W, sideTarget, tanHalf = 0.56) {
    const ph = this.pivotH(sideTarget);
    this._right = right;
    const fresh = !this.live;                  // first frame after a snap (teleport, respawn, mode switch): no easing in
    this.live = true;
    this.tanH = tanHalf * (this.aspect || 16 / 9);
    this.lockB = damp(this.lockB, this.lockBoom, T.lock.ease, dt);
    this.lockH = damp(this.lockH, this.lockHug, T.lock.liftW, dt);
    this.lockP = damp(this.lockP, this.lockPivot, T.lock.ease, dt);
    this.sideBase = damp(this.sideBase, sideTarget, 12, dt);
    this.len = damp(this.len, this.boom, T.tpZoom, dt);
    const p = this.pivot, u = this.pu, uy = feet.y + ph + this.lockP - this.pivotDrop - this.airDrop;
    if (fresh) u.set(feet.x, uy, feet.z);
    p.x = follow(p.x, u.x, feet.x, T.tpPivotXZ, dt); p.z = follow(p.z, u.z, feet.z, T.tpPivotXZ, dt);
    p.y = follow(p.y, u.y, uy, T.tpPivotY, dt);
    u.set(feet.x, uy, feet.z);
    if (Math.abs(p.x - feet.x) + Math.abs(p.z - feet.z) > 4) this.snap(feet, sideTarget);
    const pitch = Math.asin(clamp(-back.y, -1, 1));
    // narrow screens (view.js sets narrow = tan(vFOV/2 at 16:9) / tan(vFOV/2 now) ≤ 1): the boom × narrow, not under
    // tpNarrowMin (nor under the wheel length), so Pip keeps about his 16:9 height share in portrait
    const nk = this.narrow < 1 ? Math.max(this.narrow, Math.min(1, T.tpNarrowMin / Math.max(0.1, this.len))) : 1;
    const L = this.len * nk * this.pitchK(pitch) + this.lockB;
    // head top at NDC −tpFrame for any pitch: (lift + drop)·(cos p + f·τ·sin p) ≤ f·τ·a, worst case over p
    const ft = T.tpFrame * tanHalf;
    this.liftK = ft / Math.hypot(1, ft); this.headDrop = ph + this.lockP - this.pivotDrop - PIP_H;
    if (W) { this.gatherLow(W, L + Math.abs(T.tpShoulder) * 2.6 + 1.5); this.pruneLow(p, back, L, fresh); }
    // slide: a collider near the boom (soft probe) at the current shoulder offset → look for a lateral offset whose boom
    // is clear by the soft margin too, before the hard probe has to pull the arm in (anticipates trunks and posts)
    const base = T.tpShoulder * this.sideBase;
    if (W && dt > 0) {
      const sg = sideTarget < 0 ? -1 : 1, cz = sideTarget !== 0 ? T.tpShoulder * T.tpSlideCentreW : 0;
      // a thin trunk the unslid boom crosses right in front of the camera (it covers the crosshair and what Pip aims at),
      // for tpPassNearT s (Pip standing still behind it): this frame's slide scoring treats crossed trunks as walls, so
      // the camera eases round it; walking past one changes nothing (r2: the camera parked 1 m behind a trunk for 60
      // frames, the crosshair and a slime hidden)
      if (this.arm > 1) {
        this.noPass = true;
        const hn = this.boomFor(W, p, right, back, base, L);
        this.noPass = false;
        const near = hn < this.arm - 0.1 && this.arm - hn < T.tpPassNear && hn > 0.3 && this.boomFor(W, p, right, back, base, L) > hn + 0.1;
        this.trunkT = near ? (this.trunkT || 0) + dt : 0;
      } else this.trunkT = 0;
      this.noPass = this.trunkT > T.tpPassNearT;
      const s0 = this.slideScore(W, p, right, back, L, base, cz, 0);
      if (s0 < 0.75 * L || this.slideTo !== 0) {
        let best = 0, bestS = s0;
        const dbg = this.dbg ? this.scores : null;
        if (dbg) { dbg.length = 0; dbg.push([0, +s0.toFixed(2)]); }
        if (s0 < 0.75 * L) {
          for (let i = 0; i < T.tpSlide.length; i++) {
            const o = T.tpSlide[i] * sg, sc = this.slideScore(W, p, right, back, L, base, cz, o);
            if (dbg) dbg.push([o, +sc.toFixed(2)]);
            if (sc > bestS + 0.25) { bestS = sc; best = o; }
          }
        }
        // keep the current slide while it is still about as good (no flip-flop between two offsets)
        if (this.slideTo !== 0 && best !== this.slideTo && s0 < 0.75 * L && this.slideScore(W, p, right, back, L, base, cz, this.slideTo) > bestS - 0.3) best = this.slideTo;
        this.slideTo = best;
      }
      this.noPass = false;
    }
    if (dt > 0) {
      // under the crosshair (|side| < tpSlideCentreW shoulders) on the way over the other shoulder: cross fast
      const cross = sideTarget !== 0 && Math.abs(this.sideBase + this.slideAdj) < T.tpSlideCentreW && Math.sign(this.sideBase + this.slideTo) !== Math.sign(this.sideBase + this.slideAdj);
      const v = damp(this.slideAdj, this.slideTo, T.tpSlideRate, dt) - this.slideAdj, cap = ((cross ? T.tpSlideCross : T.tpSlideSpeed) / Math.max(0.1, T.tpShoulder)) * dt;
      this.slideAdj += cross ? clamp(this.slideTo - this.slideAdj, -cap, cap) : clamp(v, -cap, cap);
    }
    this.side = this.sideBase + this.slideAdj;
    // side leg: a slope or collider on the shoulder side pulls the shoulder in behind Pip first
    const off = T.tpShoulder * this.side;
    const sk = W ? this.legK(W, p, right, off) : 1;
    // r2 part 3: the pull-in is a critically damped spring (ω tpLegW: no velocity step) toward a soft target (the soft
    // probe's clear length + its extra radius: the same leg against a wall square to it, shorter before a grazing
    // contact); only the hard probe is immediate (the shoulder point never enters a collider's probe margin: the boom
    // probe would ignore that collider). The release stays slow (λ tpArmRelease). Orbiting past a house corner the leg
    // dropped 10 % in one frame: the camera jumped 16 cm (9.8 m/s against a steady 5.2)
    let st = sk;
    if (W && sk > 0.01 && Math.abs(off) > 0.01) {
      const ao = Math.abs(off), sg = off < 0 ? -1 : 1; _sd.x = right.x * sg; _sd.y = 0; _sd.z = right.z * sg;
      st = Math.min(sk, (this.collLen(W, p, _sd, ao, T.tpSoftProbe) + T.tpSoftProbe - T.tpProbe) / ao);
    }
    if (fresh) { this.legF = st; this.legV = 0; }
    else if (dt <= 0) { /* hit-stop: only the hard floor below */ }
    else if (st < this.legF - 1e-4 || this.legV < 0) {
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, w = T.tpLegW;
      for (let i = 0; i < n; i++) { this.legV += (w * w * (st - this.legF) - 2 * w * this.legV) * h; this.legF += this.legV * h; }
      if (this.legV > 0 && this.legF >= st) this.legV = 0;
    } else { this.legV = 0; this.legF = damp(this.legF, st, T.tpArmRelease, dt); }
    if (this.legF > sk) { this.legF = sk; this.legV = 0; }
    // the boom is probed from the leg's shoulder; the arm's offset scale (at the end) then slides the camera in
    const S = this.shoulder.set(p.x + right.x * off * this.legF, p.y, p.z + right.z * off * this.legF);
    // boom: collider cap (immediate pull-in; thin trunks the camera is already behind are crossed), the arena fence (same
    // rule: a wall), terrain / low-collider fit (framing-capped lift, eased pull-in)
    const prevArm = this.arm, pass = prevArm;
    this.passed = 0;
    const fl = this.fenceLen(S, back, L);
    this.fenced = fl < L;
    this._crossed.length = 0; this._rec = true; this.pushOut = 0;
    const cl = W ? this.collLen(W, S, back, L, T.tpProbe, pass) : L;
    this._rec = false;
    this.collide = cl < L;
    // (a collider wins over tpArmMin: hard against a wall the camera ends up in Pip's head, where the body hides; the
    // fence is no collider, so it pulls in eased like the framing — it may open for a leaping boss and close again)
    const fit = W ? this.fitArm(W, S, back, 0, L, this.frameCap) : L;
    const clear = Math.min(cl, fl, Math.max(T.tpArmMin, fit));
    if (cl < this.arm) this.arm = cl;
    else if (this.pushOut > this.arm && !fresh) this.arm = Math.max(this.arm, Math.min(cl, clear, this.pushOut)); // out of a trunk's gap (r3)
    this.hit = clear < L; this.clear = clear;
    if (clear < this.arm) {
      // the framing pull-in eases (λ tpArmPull, speed-capped; exact on the first frame after a snap); where the plain hug
      // can't clear the ground it jumps in, but only as far as the floor needs: never shows the ground's inside
      const eased = fresh ? clear : Math.max(damp(this.arm, clear, T.tpArmPull, dt), this.arm - T.tpArmPullMax * dt);
      this.arm = W ? Math.min(cl, this.fitArm(W, S, back, clear, eased, this.hugCap)) : clear;
    } else this.arm = Math.min(clear, damp(this.arm, clear, T.tpArmRelease, dt), this.arm + T.tpArmGrow * dt * this.boom); // release ≤ tpArmGrow·dt·boom (arch #2) even when L > boom (looking down, lock)
    // canopies: the camera point eases in under the leaves (fast, speed-capped) rather than into a crown
    let can = W ? this.canopyLen(S, back, this.arm) : this.arm;
    // r3: a pull-in under a crown never comes in through a trunk the boom crossed: it stops tpPassGap behind the trunk, just
    // inside the padded crown (woods walk: the eased pull-in reached the trunk's gap and the re-probe below snapped the
    // camera 1.6 m to its near side in one frame)
    if (!fresh && can < this.arm && this._crossed.length) can = Math.max(can, Math.min(this.arm, this.behindTrunks(S, back)));
    this.canopy = can < this.arm;
    if (this.canopy) {
      this.arm = fresh ? can : Math.max(can, Math.min(this.arm, Math.max(damp(prevArm, can, T.tpCanopyPull, dt), prevArm - T.tpCanopyPullMax * dt)));
      // pulled in along a boom that crossed a trunk: the new camera point must not land in (or within tpPassGap of) that
      // trunk; probing up to it as the camera stops it in front instead (after a snap the crossing is fresh, so this is
      // where the first frame used to end inside a round tree under its own crown)
      if (W && this.passed) { const c3 = this.collLen(W, S, back, this.arm, T.tpProbe, this.arm); if (c3 < this.arm) { this.arm = c3; this.collide = true; } }
    }
    this.lift = W ? Math.min(this.need(W, S, back, this.arm), this.hugCap()) : 0;
    if (W && this.lift > 1e-3 && this.arm > 0.05) {
      // the ground hug must not lift the camera into a collider standing on higher ground (a house on a rise): probe the
      // lifted boom and shorten along it (the same world points keep the same lift, so the floor stays cleared)
      _sd.x = back.x; _sd.y = back.y + this.lift / this.arm; _sd.z = back.z;
      const cl2 = this.collLen(W, S, _sd, this.arm, T.tpProbe, pass);
      if (cl2 < this.arm) { this.lift *= cl2 / this.arm; this.arm = cl2; this.collide = true; }
    }
    // sight (r2): the camera keeps a line of sight to Pip; where it cannot (his back to a slab the slid boom went round)
    // the arm comes in at once until it does (released like any pull-in) — in the worst case into his head (hidden),
    // never behind the slab
    this.sighted = true;
    if (W && W.probeSegment && this.arm > 0.05 && !this.noSight) {
      const a = this.sightLen(W, S, back, right, off * this.legF);
      if (a < this.arm) { this.lift *= a / this.arm; this.arm = a; this.collide = true; this.sighted = false; }
    }
    const cam = this.cam.set(S.x + back.x * this.arm, S.y + back.y * this.arm + this.lift, S.z + back.z * this.arm);
    // a short arm brings the camera in sideways toward Pip's own line at once (slow release): his centre stays within
    // tpOffEdge NDC of the middle instead of at the screen edge or off it. The arm itself is the leg shoulder's (no
    // feedback), the sideways move stops short of anything in its way and stays above the camera floor
    const offL = off * this.legF, ok = this.offScale(offL, this.arm);
    this.armK = fresh || ok < this.armK ? ok : Math.min(ok, damp(this.armK, ok, T.tpArmRelease, dt));
    let k = this.armK;
    if (k < 1 - 1e-4 && Math.abs(offL) > 0.01) {
      const want = Math.abs(offL) * (1 - k), sg = offL > 0 ? -1 : 1;
      _sd.x = right.x * sg; _sd.y = 0; _sd.z = right.z * sg;
      const got = W ? this.sideIn(W, cam, _sd, want) : want;
      cam.x += _sd.x * got; cam.z += _sd.z * got;
      if (W) cam.y = Math.max(cam.y, this.floor(W, cam.x, cam.z));
      k = 1 - got / Math.abs(offL);
    }
    this.sideK = this.legF * k;
    this.feetDrop(W, feet, cam, back, pitch, tanHalf, dt, fresh);
    return cam;
  }
  /** r3: Pip's feet stay on screen while the arm is short (the lead's tour: a lamp post behind Pip held the arm at 1.62 m
   *  and the frame cut him at the knees): the camera point drops until his feet sit inside NDC −tpFeetY at the look pitch
   *  (a look up counts as level), fully from tpFeetArm m of arm, fading out toward tpFadeBody (he dithers below), at most
   *  tpDropMax; never into the camera floor, a collider or out of his sight; eased (λ tpDropRate), so a wall snapping the
   *  arm in adds no vertical pop. drop is part of the crosshair ray's height (view.freezeAim, lockon) */
  feetDrop(W, feet, cam, back, pitch, tanHalf, dt, fresh) {
    let want = 0;
    const w = smoothstep(T.tpFadeBody, T.tpFeetArm, this.arm);
    if (w > 0) {
      const p = Math.min(pitch, 0), cp = Math.cos(p), sp = Math.sin(p), k = T.tpFeetY * tanHalf;
      const hb = Math.hypot(back.x, back.z) || 1, fx = -back.x / hb, fz = -back.z / hb;
      const vx = feet.x - cam.x, vy = feet.y - cam.y, vz = feet.z - cam.z;
      const z0 = (vx * fx + vz * fz) * cp + vy * sp, y0 = -(vx * fx + vz * fz) * sp + vy * cp;
      want = Math.min(T.tpDropMax, Math.max(0, (-k * z0 - y0) / (cp + k * sp)) * w);
    }
    const hi = Math.max(want, this.drop || 0);
    let ok = hi;
    if (W && hi > 0.005) {
      const S = this.shoulder, fits = (d) => {
        // the lowered camera point keeps over its floor, the boom S → camera clear of colliders (a fence it rides over may
        // then stand in front of Pip's feet, as from any low camera), and the camera sees Pip
        if (cam.y - d < this.floor(W, cam.x, cam.z)) return false;
        _sd.x = cam.x - S.x; _sd.y = cam.y - d - S.y; _sd.z = cam.z - S.z;
        const L = Math.hypot(_sd.x, _sd.y, _sd.z);
        if (L > 0.05) { _sd.x /= L; _sd.y /= L; _sd.z /= L; if (this.collLen(W, S, _sd, L, T.tpProbe, L) < L - MARGIN - 0.03) return false; } // (a wall the arm already stops at stays at MARGIN)
        return !W.probeSegment || this.noSight || this.sees(W, cam.x, cam.y - d, cam.z);
      };
      if (!fits(hi)) { let lo = 0, up = hi; for (let i = 0; i < 5; i++) { const m = (lo + up) / 2; if (fits(m)) lo = m; else up = m; } ok = lo; }
    }
    const target = Math.min(want, ok);
    this.drop = Math.min(ok, fresh ? target : dt > 0 ? damp(this.drop || 0, target, T.tpDropRate, dt) : this.drop || 0);
    if (this.drop < 1e-4) this.drop = 0;
    cam.y -= this.drop;
  }
  info() {
    const r = (v) => +(+v).toFixed(3);
    return { arm: r(this.arm), len: r(this.len), clear: r(this.clear), side: r(this.side), sideK: r(this.sideK), legF: r(this.legF), armK: r(this.armK), slide: r(this.slideAdj), slideTo: r(this.slideTo), lift: r(this.lift), drop: r(this.drop), collide: this.collide, sighted: this.sighted, trunkT: r(this.trunkT), passed: this.passed, canopy: this.canopy, fenced: this.fenced, lockB: r(this.lockB), lockP: r(this.lockP), low: this.low.length, scores: this.scores.slice() };
  }
}
