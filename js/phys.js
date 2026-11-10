// Circle-vs-world movement: terrain walkability (cliffs, deep water), static colliders with sliding,
// optional dynamic circles and arena confinement.
import { len2 } from './util.js';
import { G } from './core.js';

const tmp = [];

export function standOK(W, x, z, o) {
  if (o && o.custom && !o.custom(x, z)) return false;
  if (o && o.flying) return Math.abs(x) < 175 && Math.abs(z) < 175;
  return W.walkable(x, z);
}

/**
 * Move entity e (with e.pos Vector3) by (dx,dz). o: { r, flying, extra:[{x,z,r}], custom(x,z)->bool, arena:{x,z,r} }
 * Returns true if movement was (partially) blocked.
 */
export function moveCircle(W, e, dx, dz, o) {
  const r = o.r;
  const x0 = e.pos.x, z0 = e.pos.z;
  let nx = x0 + dx, nz = z0 + dz;
  let blocked = false;
  if (!standOK(W, nx, nz, o)) {
    blocked = true;
    if (standOK(W, nx, z0, o)) nz = z0;
    else if (standOK(W, x0, nz, o)) nx = x0;
    else { nx = x0; nz = z0; }
  }
  if (!o.flying || o.collideProps) {
    for (let iter = 0; iter < 2; iter++) {
      W.nearColliders(nx, nz, r + 1.5, tmp);
      for (const c of tmp) {
        const ddx = nx - c.x, ddz = nz - c.z;
        const d = Math.sqrt(ddx * ddx + ddz * ddz), min = c.r + r;
        if (d < min && d > 1e-5) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; blocked = true; }
        else if (d <= 1e-5) { nx += min; blocked = true; }
      }
      if (o.extra) for (const c of o.extra) {
        if (!c || c === e) continue;
        const ddx = nx - c.x, ddz = nz - c.z;
        const d = Math.sqrt(ddx * ddx + ddz * ddz), min = c.r + r;
        if (d < min && d > 1e-5) { nx = c.x + (ddx / d) * min; nz = c.z + (ddz / d) * min; blocked = true; }
      }
    }
  }
  if (o.arena) {
    const a = o.arena;
    const ddx = nx - a.x, ddz = nz - a.z, d = len2(ddx, ddz);
    if (d > a.r - r) { nx = a.x + (ddx / d) * (a.r - r); nz = a.z + (ddz / d) * (a.r - r); blocked = true; }
  }
  if (!standOK(W, nx, nz, o)) {
    // collider push shoved us somewhere invalid → stay put (but allow pure-axis slide)
    if (standOK(W, nx, z0, o)) nz = z0; else if (standOK(W, x0, nz, o)) nx = x0; else { nx = x0; nz = z0; }
    blocked = true;
  }
  e.pos.x = nx;
  e.pos.z = nz;
  return blocked;
}

/** Is a point inside any static collider? */
export function insideCollider(W, x, z, r = 0) {
  W.nearColliders(x, z, r + 1.5, tmp);
  for (const c of tmp) if (len2(x - c.x, z - c.z) < c.r + r) return true;
  return false;
}

export function groundY(x, z) { return G.world.ground(x, z); }
