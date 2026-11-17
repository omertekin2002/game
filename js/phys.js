// Circle-vs-world movement (WP3): terrain walkability (cliffs, deep water), static colliders of every shape (circles,
// boxes) pushed out along their surface normal so walls slide at any angle, optional dynamic circles and arena
// confinement. Walkers that pass their feet height (the player) also get: standable tops (stumps, low rocks) that only
// block when they are above a step, one-way bridge decks that are walls from below, and a collide-and-slide along the
// edge of the walkable area instead of the axis fallback (enemies keep the old behaviour).
import { len2 } from './util.js';
import { G } from './core.js';
import { shapeDist } from './world-collide.js';
import { move as TM } from './tune.js';

const tmp = [], _n = { nx: 0, nz: 0 }, _n0 = { nx: 0, nz: 0 }, _wn = { x: 0, z: 0 }, _wn2 = { x: 0, z: 0 }, _po = { nx: 0, nz: 0 };
export const HEAD = 1.0;         // a walker's height above its feet (decks it can pass under, overhead ceilings)
const OVER = 0.35;               // an overhead part (c.over) whose bottom is more than a step above the feet

export function standOK(W, x, z, o) {
  if (o && o.custom && !o.custom(x, z)) return false;
  if (o && o.flying) return Math.abs(x) < 175 && Math.abs(z) < 175;
  return o && o.slide ? walkOK(W, x, z) : W.walkable(x, z);
}
const THIN = 0.1, THIN_F = 0.35, THIN_D = [[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]];
/** the player's ground (walkers with o.slide): walkable and not a hairline. A point is refused when, along one of four
 *  directions, the walkable area ends within THIN m on both sides: a sliver < 2·THIN m across, where deep water meets a
 *  bank too steep to walk at a grazing angle, which the edge slide used to thread for metres (r3: a walk waded 4 m along
 *  one into a pocket the reachability grid never sees). Away from every edge (margin ≥ THIN_F) it is W.walkable */
export function walkOK(W, x, z) {
  if (!W.walkable(x, z)) return false;
  if (!W.walkF || W.walkF(x, z) >= THIN_F) return true;
  for (const d of THIN_D) if (!W.walkable(x + d[0] * THIN, z + d[1] * THIN) && !W.walkable(x - d[0] * THIN, z - d[1] * THIN)) return false;
  return true;
}

/** a collider a walker with feet at o.feetY may pass: the standable top it stands on (o.on) or one whose top its feet
 *  are already at (reached by jumping: tops are never stepped onto, so there is no threshold to flicker at), or an
 *  overhead part (c.over: eaves, awnings, a declared overhead) that starts above its head — only those: a prop on a
 *  slope reaches down into the ground on its downhill side, so its base height never makes it passable (it used to,
 *  and a walk downhill along a boulder flickered it solid / passable). An overhead part (bottom above a step) the
 *  walker already overlapped at the start of the step (o.x0 / o.z0) stays passable while it does: the feet height only
 *  decides on the way in, so terrain that rises under the part can't flicker it either (a jump under it is stopped by
 *  the ceiling instead: headroom). Every other collider blocks at every height */
function passable(c, o) {
  if (o.feetY == null) return false;
  if (c.over) {
    if (c.y0 > o.feetY + HEAD - 0.02) return true;
    if (c.y0 > o.feetY + OVER && o.x0 != null && shapeDist(c, o.x0, o.z0, _po) < o.r - 0.005) return true;
  }
  if (!c.stand || TM.standOnProps === false) return false;
  return c === o.on || c.y1 <= o.feetY + 0.05;
}
/** the highest feet y a walker of radius r at (x, z) with feet at feetY may rise to: the bottom of the lowest overhead
 *  body part (c.over: a counter, a declared overhead) above a step that its circle overlaps, minus HEAD (a jump under it
 *  bonks); Infinity */
export function headroom(W, x, z, r, feetY) {
  W.nearColliders(x, z, r + 1.5, tmp);
  let top = Infinity;
  for (const c of tmp) if (c.over && c.body !== false && c.y0 > feetY + OVER && c.y0 - HEAD < top && shapeDist(c, x, z, _po) < r - 0.005) top = c.y0 - HEAD;
  return top;
}
/** a bridge deck that is a wall for these feet: above a step and below the head */
function deckWall(W, b, x, z, o) {
  const d = W.deckAt(b, x, z);
  return d > o.feetY + 0.30 && d - 0.25 < o.feetY + HEAD;
}

/**
 * Move entity e (with e.pos Vector3) by (dx, dz). o: { r, flying, collideProps, extra: [{x, z, r}], custom(x, z) → bool,
 * arena: {x, z, r}, feetY (enables standable tops, overheads, deck walls), grounded (false: airborne), on (the standable
 * collider the walker stands on), slide (collide-and-slide along unwalkable edges) }. Returns true if the movement was
 * (partially) blocked.
 */
export function moveCircle(W, e, dx, dz, o) {
  const r = o.r;
  const x0 = e.pos.x, z0 = e.pos.z;
  if (o.feetY != null) { o.x0 = x0; o.z0 = z0; }   // the step's start: overhead parts already overlapped stay passable
  let nx = x0 + dx, nz = z0 + dz;
  let blocked = false;
  if (!standOK(W, nx, nz, o)) {
    blocked = true;
    if (o.slide) { slideWalk(W, o, x0, z0, nx, nz); nx = _sl.x; nz = _sl.z; }
    else if (standOK(W, nx, z0, o)) nz = z0;
    else if (standOK(W, x0, nz, o)) nx = x0;
    else { nx = x0; nz = z0; }
  }
  if (!o.flying || o.collideProps) {
    const iters = o.feetY != null ? 3 : 2;
    for (let iter = 0; iter < iters; iter++) {
      W.nearColliders(nx, nz, r + 1.5, tmp);
      for (const c of tmp) {
        if (c.body === false || passable(c, o)) continue;
        const d = shapeDist(c, nx, nz, _n), pen = r - d;
        if (pen <= 0) continue;
        if (c.stand && o.feetY != null) {
          // overlapping a standable top already (just stepped or dropped off it): slide off at softPush per step and
          // never deeper than before; from outside it is a wall like any other
          const pen0 = r - shapeDist(c, x0, z0, _n0);
          if (pen0 > 0.005) {
            const keep = Math.max(0, Math.min(pen, pen0) - (TM.softPush ?? 0.06));
            if (pen > keep) { nx += _n.nx * (pen - keep); nz += _n.nz * (pen - keep); blocked = true; }
            continue;
          }
        }
        nx += _n.nx * pen; nz += _n.nz * pen; blocked = true;
      }
      if (o.extra) for (const c of o.extra) {
        if (!c || c === e) continue;
        const ddx = nx - c.x, ddz = nz - c.z;
        const d = Math.sqrt(ddx * ddx + ddz * ddz), min = c.r + r;
        if (d < min && d > 1e-5) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; blocked = true; }
      }
      if (o.feetY != null && W.bridges) for (const b of W.bridges) {
        const bx = b.deckBox;
        if (!bx || (nx - bx.x) ** 2 + (nz - bx.z) ** 2 > (bx.r + r) ** 2) continue;
        const d = shapeDist(bx, nx, nz, _n);
        if (d < r && deckWall(W, b, nx, nz, o)) { nx += _n.nx * (r - d); nz += _n.nz * (r - d); blocked = true; }
      }
    }
  }
  if (o.arena) {
    const a = o.arena;
    const ddx = nx - a.x, ddz = nz - a.z, d = len2(ddx, ddz);
    if (d > a.r - r) { nx = a.x + (ddx / d) * (a.r - r); nz = a.z + (ddz / d) * (a.r - r); blocked = true; }
  }
  if (!standOK(W, nx, nz, o)) {
    // collider push shoved us somewhere invalid → slide from the start toward it, or stay put (pure-axis slide)
    blocked = true;
    if (o.slide) {
      slideWalk(W, o, x0, z0, nx, nz);
      if (overlaps(W, _sl.x, _sl.z, o)) { nx = x0; nz = z0; } else { nx = _sl.x; nz = _sl.z; }
    } else if (standOK(W, nx, z0, o)) nz = z0; else if (standOK(W, x0, nz, o)) nx = x0; else { nx = x0; nz = z0; }
  }
  // a wedge between colliders the push-out could not settle: take the part of the move that stays clear (the start
  // was clear), so a walker never ends a step inside something
  if (o.slide && blocked && (nx !== x0 || nz !== z0) && overlaps(W, nx, nz, o) && !overlaps(W, x0, z0, o)) {
    let lo = 0, hi = 1;
    for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2, x = x0 + (nx - x0) * m, z = z0 + (nz - z0) * m; if (!overlaps(W, x, z, o) && standOK(W, x, z, o)) lo = m; else hi = m; }
    nx = x0 + (nx - x0) * lo; nz = z0 + (nz - z0) * lo;
  }
  e.pos.x = nx;
  e.pos.z = nz;
  return blocked;
}

const _sl = { x: 0, z: 0 };
const SLIDE_ITERS = 4, SLIDE_SKIN = 0.004, SLIDE_E = 0.06, SLIDE_E2 = 0.25, SLIDE_HEAD_ON = 0.95;
/** collide-and-slide on the walkable area (result in _sl): move to the edge along the step, then along the edge's
 *  tangent with what is left, up to SLIDE_ITERS contacts (a curved edge keeps its speed; a concave corner stops).
 *  The edge normal is the local gradient of the walkability field (W.walkNormal, SLIDE_E), so a cliff or shoreline at
 *  any angle slides; where that local normal meets the move head-on (|cos| > SLIDE_HEAD_ON) and the edge's average
 *  direction (SLIDE_E2) leaves more tangent — a small notch of the 1 m walkability field — the average one is used,
 *  so notches don't glue Pip. Each contact backs off SLIDE_SKIN so the next tangent move never starts on the edge itself */
function slideWalk(W, o, x0, z0, x1, z1) {
  if (!standOK(W, x0, z0, o)) {
    // already off the walkable area (a shove, a teleport): any move that climbs back toward it is allowed
    if (standOK(W, x1, z1, o) || (W.walkF && !o.custom && W.walkF(x1, z1) > W.walkF(x0, z0))) { _sl.x = x1; _sl.z = z1; } else { _sl.x = x0; _sl.z = z0; }
    return;
  }
  let cx = x0, cz = z0, rx = x1 - x0, rz = z1 - z0;
  for (let it = 0; it < SLIDE_ITERS && rx * rx + rz * rz > 1e-12; it++) {
    if (standOK(W, cx + rx, cz + rz, o)) { cx += rx; cz += rz; break; }
    let lo = 0, hi = 1;
    for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (standOK(W, cx + rx * m, cz + rz * m, o)) lo = m; else hi = m; }
    const hx = cx + rx * hi, hz = cz + rz * hi;
    cx += rx * lo; cz += rz * lo; rx *= 1 - lo; rz *= 1 - lo;
    let n = W.walkNormal ? W.walkNormal(hx, hz, _wn, SLIDE_E) : null;
    if (!n) {   // flat field (should not happen at an edge): the old axis slide
      if (standOK(W, cx + rx, cz, o)) cx += rx; else if (standOK(W, cx, cz + rz, o)) cz += rz;
      break;
    }
    let d = rx * n.x + rz * n.z;
    const rl = Math.hypot(rx, rz);
    if (-d > SLIDE_HEAD_ON * rl) {
      const m = W.walkNormal(hx, hz, _wn2, SLIDE_E2), dm = m ? rx * m.x + rz * m.z : 0;
      if (m && dm < 0 && -dm < -d - 0.02 * rl) { n = m; d = dm; }
    }
    if (d >= 0) break;
    rx -= n.x * d; rz -= n.z * d;
    if (standOK(W, cx + n.x * SLIDE_SKIN, cz + n.z * SLIDE_SKIN, o)) { cx += n.x * SLIDE_SKIN; cz += n.z * SLIDE_SKIN; }
  }
  _sl.x = cx; _sl.z = cz;
}
const tmp2 = [];
/** does a circle walker overlap a static collider or a dynamic circle (by > 1 cm) at (x, z)? */
function overlaps(W, x, z, o) {
  W.nearColliders(x, z, o.r + 1.5, tmp2);
  for (const c of tmp2) if (c.body !== false && !passable(c, o) && !c.stand && shapeDist(c, x, z, _n) < o.r - 0.01) return true;
  if (o.extra) for (const c of o.extra) if (c && Math.hypot(x - c.x, z - c.z) < c.r + o.r - 0.01) return true;
  return false;
}

const _pen = { r: 0, feetY: null, grounded: true, on: null, x0: null, z0: null };
/** deepest overlap (m) of a circle of radius r at (x, z) with the static body colliders, ignoring what a walker at
 *  feetY may pass (the top it stands on, overheads above its head or already overlapped from underneath) and, with
 *  skipStand, every standable top (0 = clear) */
export function penetration(W, x, z, r, feetY = null, grounded = true, on = null, skipStand = false) {
  const o = _pen;
  o.r = r; o.feetY = feetY; o.grounded = grounded; o.on = on; o.x0 = x; o.z0 = z;
  W.nearColliders(x, z, r + 1.5, tmp);
  let p = 0;
  for (const c of tmp) if (c.body !== false && !passable(c, o) && !(skipStand && c.stand)) p = Math.max(p, r - shapeDist(c, x, z, _n));
  return p;
}

/** Is a point inside any static collider? */
export function insideCollider(W, x, z, r = 0) {
  W.nearColliders(x, z, r + 1.5, tmp);
  for (const c of tmp) if (c.body !== false && shapeDist(c, x, z, _n) < r) return true;
  return false;
}

export function groundY(x, z) { return G.world.ground(x, z); }
