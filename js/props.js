// Procedural prop models (instanced nature + village buildings + Great Tree + bridges + chests).
import * as THREE from 'three';
import { GB } from './toon.js';
import { TAU } from './util.js';
import { world as TW } from './tune.js';

// WP9: canopy undersides darken 18 % where the normal points down (sells volume when you look up from under a tree)
const shade = (dark, light, under = 0) => {
  const a = new THREE.Color(dark), b = new THREE.Color(light), c = new THREE.Color();
  return (x, y, z, nx, ny) => { c.copy(a).lerp(b, Math.min(1, Math.max(0, ny * 0.55 + 0.5))); if (under && ny < -0.3) c.multiplyScalar(1 - under * Math.min(1, (-0.3 - ny) / 0.4)); return c.getHex(); };
};
function star(r1, r0, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU + Math.PI / 2;
    const r = i % 2 ? r0 : r1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}
export function starShape(r1, r0) { return star(r1, r0); }
const _fc = new THREE.Color();
/** recolour the part last added to `b` per triangle: fn(x, y, z, nx, ny, nz) at the triangle's centroid (model space) → hex.
 *  Stripes, bricks and checkers need this: a per-vertex colorFn on a primitive with few vertices blends its colours into
 *  one smear (a 16 m lathe with rings at 0.8 / 6.2 / 11.5 m shows one soft coral band). Give the primitive vertices at the
 *  pattern's edges (lathe rings, box segments): GB parts are non-indexed, so each triangle takes one colour */
function faceColor(b, fn) {
  const g = b.parts[b.parts.length - 1], p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
  for (let i = 0; i + 2 < p.count; i += 3) {
    _fc.set(fn((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, n.getX(i), n.getY(i), n.getZ(i)));
    for (let k = 0; k < 3; k++) c.setXYZ(i + k, _fc.r, _fc.g, _fc.b);
  }
  return b;
}
export function heartShape(s = 1) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.5 * s);
  h.bezierCurveTo(0.15 * s, -0.32 * s, 0.55 * s, -0.12 * s, 0.5 * s, 0.18 * s);
  h.bezierCurveTo(0.46 * s, 0.45 * s, 0.12 * s, 0.5 * s, 0, 0.26 * s);
  h.bezierCurveTo(-0.12 * s, 0.5 * s, -0.46 * s, 0.45 * s, -0.5 * s, 0.18 * s);
  h.bezierCurveTo(-0.55 * s, -0.12 * s, -0.15 * s, -0.32 * s, 0, -0.5 * s);
  return h;
}

// ---------------------------------------------------------------- nature
function treeRound() {
  const b = new GB();
  b.cyl(0.26, 0.4, 2.3, 0x8a5a32, { y: 1.15, seg: 10 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    b.sphere(0.24, 0x7a4b2a, { x: Math.sin(a) * 0.35, y: 0.1, z: Math.cos(a) * 0.35, sx: 1, sy: 0.6, sz: 1.6, ry: a, ws: 6, hs: 4 });
  }
  const leaf = shade(0x4f8f30, 0x9ad04e, 0.18);
  b.sphere(1.45, 0, { y: 3.35, colorFn: leaf, ws: 12, hs: 9 });
  const blobs = [[1.0, 2.95, 0.2, 1.05], [-1.0, 3.0, 0.3, 1.0], [0.2, 2.9, 1.0, 1.0], [-0.3, 3.05, -1.0, 1.05], [0.75, 3.75, -0.5, 0.9], [-0.6, 3.9, 0.55, 0.9], [0.1, 4.3, 0.1, 0.85]];
  for (const [x, y, z, r] of blobs) b.sphere(r, 0, { x, y, z, colorFn: leaf, ws: 11, hs: 8 });
  // leaf highlight marks
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, yy = 3.0 + (i % 3) * 0.55;
    const rr = 1.55 - (i % 3) * 0.25;
    b.add(new THREE.OctahedronGeometry(0.18, 0), 0xb8e070, { x: Math.sin(a) * rr, y: yy, z: Math.cos(a) * rr, sx: 1.4, sy: 0.45, sz: 0.9, ry: a, rx: 0.4, outline: false });
  }
  return b.build();
}
// WP9: skirts raised so the eye passes under them (lowest underside 1.95 m × s, ≥ 1.55 m at the smallest scale) with
// bare trunk below, as in tree_pine.png; 6.1 m tall (declared in world.js DECL)
function treePine(snow) {
  const b = new GB();
  b.cyl(0.17, 0.32, 2.5, 0x7a4b2a, { y: 1.25, seg: 7 });
  const tiers = [[1.6, 1.9, 2.9], [1.32, 1.75, 3.85], [1.02, 1.55, 4.7], [0.68, 1.3, 5.45]];
  const side = shade(0x2f6a35, 0x5e9e45), under = new THREE.Color(0x3d7a3e).getHex();
  const green = (x, y, z, nx, ny, nz) => (ny < -0.6 ? under : side(x, y, z, nx, ny, nz));   // a lit-looking skirt underside
  tiers.forEach(([r, h, y], i) => {
    b.cone(r, h, 0, { y, seg: 9, colorFn: green, ry: i * 0.35 });
    if (snow) {
      b.cone(r * 0.82, h * 0.5, 0xf6faff, { y: y + h * 0.27, seg: 9, ry: i * 0.35 + 0.17, s: 1.02 });
      // drips of snow along the rim
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + i;
        b.add(new THREE.IcosahedronGeometry(0.16 * r, 0), 0xf6faff, { x: Math.sin(a) * r * 0.62, y: y - h * 0.05, z: Math.cos(a) * r * 0.62, sy: 0.7, outline: false });
      }
    }
  });
  return b.build();
}
function treePalm() {
  const b = new GB();
  const segs = 7;
  let x = 0, y = 0;
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const nx = Math.sin(t * 1.4) * 0.9, ny = i * 0.68;
    pts.push([nx, ny]);
  }
  for (let i = 0; i < segs; i++) {
    const [px, py] = pts[i];
    const nxt = pts[i + 1] || [px + 0.15, py + 0.68];
    const ang = Math.atan2(nxt[0] - px, nxt[1] - py);
    const r = 0.24 - i * 0.012;
    b.cyl(r * 0.92, r, 0.72, i % 2 ? 0x9a6434 : 0xb27a44, { x: px, y: py + 0.36, rz: -ang, seg: 9 });
    b.torus(r * 0.95, 0.05, 0x8a5a30, { x: px + Math.sin(ang) * 0.05, y: py + 0.05, rx: Math.PI / 2, rz: -ang, ts: 12, rs: 4, outline: false });
    x = px; y = py;
  }
  const top = [pts[segs - 1][0] + 0.15, segs * 0.68];
  const leafC = shade(0x4a8f2a, 0x9cd84e);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const droop = 0.35 + (i % 2) * 0.2;
    // two-segment drooping frond
    b.sphere(0.5, 0, { x: top[0] + Math.sin(a) * 0.75, y: top[1] + 0.12, z: Math.cos(a) * 0.75, sx: 0.42, sy: 0.08, sz: 1.6, ry: a, rx: droop * 0.6, colorFn: leafC, ws: 10, hs: 6 });
    b.sphere(0.45, 0, { x: top[0] + Math.sin(a) * 1.7, y: top[1] - 0.35, z: Math.cos(a) * 1.7, sx: 0.36, sy: 0.07, sz: 1.3, ry: a, rx: droop * 1.6, colorFn: leafC, ws: 10, hs: 6 });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    b.sphere(0.17, 0x7a4a26, { x: top[0] + Math.sin(a) * 0.2, y: top[1] - 0.2, z: Math.cos(a) * 0.2, ws: 10, hs: 8 });
  }
  return b.build();
}
function bush() {
  const b = new GB();
  const leaf = shade(0x4a8a30, 0x96cc4c);
  b.sphere(0.6, 0, { y: 0.5, colorFn: leaf, sy: 0.9, ws: 12, hs: 9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    b.sphere(0.42, 0, { x: Math.sin(a) * 0.48, y: 0.36, z: Math.cos(a) * 0.48, colorFn: leaf, ws: 10, hs: 7 });
  }
  b.sphere(0.4, 0, { y: 0.86, x: 0.1, colorFn: leaf, ws: 12, hs: 9 });
  for (let i = 0; i < 6; i++) {
    const a = i * 2.1;
    b.add(new THREE.OctahedronGeometry(0.1, 0), 0xb8e070, { x: Math.sin(a) * 0.62, y: 0.55 + (i % 2) * 0.2, z: Math.cos(a) * 0.62, sx: 1.4, sy: 0.5, ry: a, outline: false });
  }
  return b.build();
}
function rock(big) {
  const b = new GB();
  const moss = (x, y, z, nx, ny) => (ny > 0.62 ? 0x8ab048 : ny > 0.45 ? 0x9aa070 : 0xa8a096);
  if (big) {
    b.ico(1.25, 0, { y: 0.75, sy: 0.72, detail: 1, jitter: 0.28, seed: 3, colorFn: moss });
    b.ico(0.6, 0, { x: 0.95, y: 0.35, z: 0.55, sy: 0.75, detail: 1, jitter: 0.3, seed: 8, colorFn: moss });
  } else {
    b.ico(0.6, 0, { y: 0.3, sy: 0.62, detail: 0, jitter: 0.35, seed: 5, colorFn: moss });
    b.ico(0.28, 0, { x: 0.5, y: 0.1, z: 0.25, sy: 0.7, detail: 0, jitter: 0.3, seed: 2, colorFn: moss, outline: false });
  }
  return b.build();
}
function stump() {
  const b = new GB();
  b.lathe([[0, 0], [0.55, 0], [0.47, 0.1], [0.42, 0.45], [0.44, 0.52], [0, 0.53]], 0x8a5a32, { seg: 12 });
  b.cyl(0.4, 0.4, 0.02, 0xe8b878, { y: 0.535, seg: 14 });
  b.torus(0.22, 0.025, 0xc48a50, { y: 0.55, rx: Math.PI / 2, outline: false });
  b.torus(0.1, 0.02, 0xc48a50, { y: 0.55, rx: Math.PI / 2, outline: false });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.6;
    b.sphere(0.18, 0x7a4b2a, { x: Math.sin(a) * 0.45, y: 0.08, z: Math.cos(a) * 0.45, sx: 0.9, sy: 0.55, sz: 1.5, ry: a, ws: 8, hs: 6 });
  }
  return b.build();
}
function flowers() {
  const b = new GB();
  const heads = [[0xff8fa8, 0.0, 0.0], [0xffd85a, 0.14, 0.09], [0xffffff, -0.12, 0.1]];
  heads.forEach(([c, x, z], i) => {
    const h = 0.26 + i * 0.05;
    b.cyl(0.012, 0.016, h, 0x5a9a3a, { x, z, y: h / 2, seg: 3, outline: false });
    b.cyl(0.075, 0.06, 0.03, c, { x, y: h, z, seg: 5, outline: false, glow: 0.05 });
    b.add(new THREE.OctahedronGeometry(0.03, 0), i === 1 ? 0xff9a3a : 0xffd040, { x, y: h + 0.02, z, outline: false });
    b.add(new THREE.OctahedronGeometry(0.05, 0), 0x6aac3a, { x: x + 0.05, y: h * 0.4, z, sx: 1.5, sy: 0.3, rz: 0.4, outline: false });
  });
  return b.build();
}
function bladeGeo(w, h, lean, ang) {
  // a 3-triangle curved blade, normals tilted up so it shades like the ground
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (u, v) => { const bend = lean * v * v; return [u * w * (1 - v) * ca + bend * sa, v * h, -u * w * (1 - v) * sa + bend * ca]; };
  const pts = [P(-1, 0), P(1, 0), P(-0.55, 0.5), P(0.55, 0.5), P(0, 1)];
  const tri = [0, 1, 2, 1, 3, 2, 2, 3, 4, 0, 2, 1, 1, 2, 3, 2, 4, 3]; // both windings, shared up-normals
  const pos = [];
  for (const i of tri) pos.push(...pts[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nor = [];
  for (let i = 0; i < tri.length; i++) nor.push(sa * 0.35, 0.93, ca * 0.35);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function grassTuft(tall) {
  const b = new GB();
  const n = tall ? 9 : 7;
  const H = tall ? 0.7 : 0.42;
  const c0 = new THREE.Color(tall ? 0x4a8a2a : 0x4f9230), c1 = new THREE.Color(tall ? 0xb6e05a : 0xb0dc64), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (i % 2) * 0.4;
    const h = H * (0.65 + ((i * 37) % 10) / 22);
    b.add(bladeGeo(tall ? 0.07 : 0.05, h, 0.12 + (i % 3) * 0.06, a), 0, {
      x: Math.sin(a) * 0.07, z: Math.cos(a) * 0.07, outline: false,
      colorFn: (x, y) => tmp.copy(c0).lerp(c1, Math.min(1, y / H)).getHex(),
    });
  }
  return b.build();
}
function fern() {
  const b = new GB();
  const c0 = new THREE.Color(0x2f6a30), c1 = new THREE.Color(0x6aa84a), tmp = new THREE.Color();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    b.sphere(0.2, 0, { x: Math.sin(a) * 0.2, y: 0.16, z: Math.cos(a) * 0.2, sx: 0.28, sy: 0.08, sz: 1.3, ry: a, rx: -0.5, outline: false, ws: 5, hs: 3,
      colorFn: (x, y, z) => tmp.copy(c0).lerp(c1, Math.min(1, Math.hypot(x, z) / 0.4)).getHex() });
  }
  return b.build();
}
function pebble() {
  const b = new GB();
  b.ico(0.12, 0xb0a89e, { y: 0.03, sy: 0.55, detail: 0, jitter: 0.3, seed: 1, outline: false });
  b.ico(0.08, 0x9a948c, { x: 0.15, y: 0.02, z: 0.05, sy: 0.6, detail: 0, jitter: 0.3, seed: 4, outline: false });
  b.ico(0.06, 0xc0b8ac, { x: -0.1, y: 0.02, z: 0.12, sy: 0.6, detail: 0, jitter: 0.3, seed: 6, outline: false });
  return b.build();
}
function shell() {
  const b = new GB();
  b.cone(0.09, 0.2, 0xffb8c0, { y: 0.07, rx: Math.PI / 2 - 0.2, seg: 8, outline: false });
  b.sphere(0.08, 0xffd0d6, { z: -0.08, y: 0.06, ws: 8, hs: 6, outline: false });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    b.sphere(0.035, 0xffa04a, { x: 0.28 + Math.sin(a) * 0.06, y: 0.02, z: 0.1 + Math.cos(a) * 0.06, sx: 1, sy: 0.4, sz: 2.2, ry: a, ws: 6, hs: 4, outline: false });
  }
  return b.build();
}
/** Clover's errand: the decorative shell's spiral and body (no starfish), striped in rainbow hues along its length and
 *  softly glowing, so it reads apart from the plain pink shells scattered on the sand. Model units, ≈ 0.2 m long */
function rainbowShell() {
  const b = new GB(), col = new THREE.Color();
  const hue = (x, y, z) => col.setHSL((((z + 0.2) * 3.2) % 1 + 1) % 1, 0.9, 0.6).getHex();
  b.cone(0.09, 0.2, 0, { y: 0.07, rx: Math.PI / 2 - 0.2, seg: 10, colorFn: hue, glow: 0.45 });
  b.sphere(0.08, 0, { z: -0.08, y: 0.06, ws: 10, hs: 8, colorFn: hue, glow: 0.45 });
  return b.build();
}
export function rainbowShellModel() { return cache.rainbowShell || (cache.rainbowShell = rainbowShell()); }
/** Ribbit's parade: a paper lantern hung from a short shepherd's-crook post. Two models so the paper can light on its
 *  own material: the post and the lantern's wooden cap and base (model units ≈ m, 1.5 m tall), and the round paper
 *  body (white vertex colour: the scenery tints it, unlit cream to lit warm, and ramps its glow) */
function paradePost() {
  const b = new GB();
  b.cyl(0.05, 0.065, 1.42, 0x8a5a30, { y: 0.71, seg: 7 });
  b.box(0.46, 0.05, 0.05, 0x8a5a30, { x: 0.2, y: 1.42 });
  b.sphere(0.05, 0x9a6438, { x: 0.42, y: 1.42, ws: 7, hs: 5 });
  b.cyl(0.012, 0.012, 0.12, 0x5a3a24, { x: 0.38, y: 1.36, seg: 4, outline: false });
  b.cyl(0.085, 0.11, 0.05, 0xd0503a, { x: 0.38, y: 1.29, seg: 8 });
  b.cyl(0.11, 0.085, 0.05, 0xd0503a, { x: 0.38, y: 0.95, seg: 8 });
  for (let i = 0; i < 2; i++) b.sphere(0.1, 0x7cbf4a, { x: (i ? -1 : 1) * 0.16, y: 0.06, z: 0.1, sy: 0.6, ws: 8, hs: 6 });
  return b.build();
}
export const PARADE_PAPER = { x: 0.38, y: 1.12 };   // the paper's centre in model space (the post at the origin)
function paradePaper() {
  const b = new GB();
  b.sphere(0.2, 0xffffff, { x: PARADE_PAPER.x, y: PARADE_PAPER.y, sy: 0.85, ws: 12, hs: 9, glow: 1 });
  return b.build();
}
export function paradeLanternModels() { return cache.paradeLantern || (cache.paradeLantern = { post: paradePost(), paper: paradePaper() }); }
function crystal() {
  const b = new GB();
  b.add(new THREE.OctahedronGeometry(0.16, 0), 0xa8e4ff, { y: 0.22, sy: 1.8, glow: 0.35, flat: true, outline: false });
  b.add(new THREE.OctahedronGeometry(0.1, 0), 0xc8f0ff, { x: 0.13, y: 0.12, rz: -0.4, sy: 1.6, glow: 0.35, flat: true, outline: false });
  return b.build();
}
function glowshroom() {
  const b = new GB();
  const caps = [[0, 0, 0.3, 0.16], [0.17, 0.08, 0.22, 0.11], [-0.12, 0.14, 0.18, 0.09]];
  for (const [x, z, h, r] of caps) {
    b.cyl(r * 0.35, r * 0.45, h, 0xfff2dc, { x, z, y: h / 2, seg: 6, outline: false });
    b.sphere(r, 0x45d6c4, { x, z, y: h, t1: Math.PI * 0.55, sy: 0.75, glow: 0.35, ws: 10, hs: 6, outline: false });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + x * 10;
      b.sphere(r * 0.2, 0xf4fffa, { x: x + Math.sin(a) * r * 0.55, z: z + Math.cos(a) * r * 0.55, y: h + r * 0.38, sy: 0.4, glow: 0.4, ws: 6, hs: 4, outline: false });
    }
  }
  return b.build();
}
function fence() {
  const b = new GB();
  const wood = 0xc88a4a, dark = 0xa86a34;
  for (const x of [-0.6, 0.6]) {
    b.cyl(0.07, 0.08, 0.85, dark, { x, y: 0.42, seg: 8 });
    b.sphere(0.085, wood, { x, y: 0.86, ws: 8, hs: 6 });
  }
  b.box(1.25, 0.09, 0.05, wood, { y: 0.32, z: 0.06 });
  b.box(1.25, 0.09, 0.05, wood, { y: 0.6, z: 0.06 });
  for (const x of [-0.3, 0, 0.3]) {
    b.box(0.17, 0.6, 0.04, wood, { x, y: 0.42, z: 0.1 });
    b.cone(0.12, 0.12, wood, { x, y: 0.78, z: 0.1, seg: 4, ry: Math.PI / 4, sz: 0.3 });
  }
  return b.build();
}
function lamp() {
  const b = new GB();
  b.lathe([[0, 0], [0.32, 0], [0.3, 0.15], [0.18, 0.28], [0, 0.3]], 0xb0a498, { seg: 8 });
  b.cyl(0.07, 0.09, 2.3, 0x9a6438, { y: 1.35, seg: 8 });
  b.sphere(0.1, 0x8a5a30, { y: 2.52, ws: 8, hs: 6 });
  b.box(0.6, 0.07, 0.07, 0x8a5a30, { x: 0.27, y: 2.35 });
  b.box(0.05, 0.4, 0.05, 0x8a5a30, { x: 0.12, y: 2.15, rz: 0.75 });
  // lantern
  b.cyl(0.13, 0.1, 0.06, 0x5a3a24, { x: 0.52, y: 2.22, seg: 6 });
  b.cyl(0.11, 0.11, 0.3, 0xffd27a, { x: 0.52, y: 2.04, seg: 6, glow: 0.9 });
  b.cone(0.15, 0.13, 0x5a3a24, { x: 0.52, y: 2.28, seg: 6 });
  b.cyl(0.09, 0.12, 0.06, 0x5a3a24, { x: 0.52, y: 1.87, seg: 6 });
  for (let i = 0; i < 2; i++) b.sphere(0.12, 0x7cbf4a, { x: (i ? -1 : 1) * 0.3, y: 0.1, z: 0.15, sy: 0.6, ws: 8, hs: 6 });
  return b.build();
}
// WP9: the post stands behind the board (it no longer runs up through the text); the board face (z = +0.045) carries
// the painted text quad from world-mod.js
export const SIGN_BOARD = { w: 0.98, h: 0.54, y: 1.08, z: 0.046 };
function sign() {
  const b = new GB();
  b.cyl(0.065, 0.08, 1.42, 0x8a5a30, { y: 0.71, z: -0.1, seg: 7 });
  b.sphere(0.08, 0x9a6438, { y: 1.43, z: -0.1, ws: 7, hs: 5 });
  b.rbox(1.06, 0.62, 0.08, 0xb07a48, { y: SIGN_BOARD.y, radius: 0.04 });
  b.box(0.12, 0.08, 0.1, 0x7a4b2a, { y: SIGN_BOARD.y + 0.18, z: -0.06, outline: false });
  b.box(0.12, 0.08, 0.1, 0x7a4b2a, { y: SIGN_BOARD.y - 0.18, z: -0.06, outline: false });
  for (let i = 0; i < 2; i++) b.ico(0.12, 0xa8a096, { x: (i ? 0.15 : -0.15), y: 0.04, z: -0.02, sy: 0.5, detail: 0, outline: false });
  return b.build();
}
// WP9: a 1.25 m waymarker post along the paths: an arrow board pointing down the path (local +Z) and a round plaque
// on top that carries the region icon (world-mod.js quads at WAYMARK_PLAQUE)
export const WAYMARK_PLAQUE = { y: 1.12, r: 0.15, x: 0.03 };
function waymarker() {
  const b = new GB();
  b.cyl(0.055, 0.07, 1.1, 0x8a5a30, { y: 0.55, seg: 7 });
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.22, -0.07); arrow.lineTo(0.12, -0.07); arrow.lineTo(0.12, -0.13); arrow.lineTo(0.3, 0); arrow.lineTo(0.12, 0.13); arrow.lineTo(0.12, 0.07); arrow.lineTo(-0.22, 0.07); arrow.closePath();
  b.shape(arrow, 0.035, 0xe8c99a, { y: 0.82, ry: -Math.PI / 2, bevel: 0.008 });
  b.cyl(WAYMARK_PLAQUE.r + 0.025, WAYMARK_PLAQUE.r + 0.025, 0.045, 0xb07a48, { y: WAYMARK_PLAQUE.y, rz: Math.PI / 2, seg: 14 });
  b.ico(0.1, 0xa8a096, { y: 0.03, sy: 0.5, detail: 0, outline: false });
  return b.build();
}
// WP9: tall sunflowers for the meadow heart-chest ring (1.35 m × s, taller than the eye), head facing local +Z
function sunflower() {
  const b = new GB();
  b.cyl(0.025, 0.035, 1.3, 0x5a9a3a, { y: 0.65, seg: 6 });
  for (const [y, s2] of [[0.45, 1], [0.8, -1]]) b.sphere(0.09, 0x6aac3a, { x: s2 * 0.1, y, sx: 1.8, sy: 0.25, sz: 0.8, rz: s2 * 0.4, ws: 8, hs: 4, outline: false });
  const hy = 1.32;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    b.sphere(0.07, i % 2 ? 0xffd23a : 0xffc020, { x: Math.sin(a) * 0.15, y: hy + Math.cos(a) * 0.15, z: 0.02, sx: 0.6, sy: 1.25, sz: 0.25, rz: -a, ws: 6, hs: 4, outline: false, glow: 0.08 });
  }
  b.cyl(0.1, 0.1, 0.06, 0x7a4b2a, { y: hy, z: 0.04, rx: Math.PI / 2, seg: 12 });
  return b.build();
}
function pot() {
  const b = new GB();
  const band = (x, y) => (y > 0.2 && y < 0.34 ? 0xe8a878 : y > 0.5 ? 0xb06a3a : 0xc87848);
  b.lathe([[0, 0], [0.16, 0], [0.26, 0.1], [0.3, 0.26], [0.24, 0.42], [0.15, 0.48], [0.17, 0.54], [0.2, 0.56], [0.15, 0.57], [0.12, 0.5], [0, 0.48]], 0, { seg: 14, colorFn: band });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    b.sphere(0.04, 0xa85a30, { x: Math.sin(a) * 0.29, y: 0.27, z: Math.cos(a) * 0.29, sz: 0.4, ry: a, ws: 6, hs: 4, outline: false });
  }
  return b.build();
}
// WP9: rim lowered to 0.62 m so Pip can look in (water at 0.3 m, a frog on a lily pad: world-mod.js), bucket on a rope
export const WELL = { rim: 0.62, water: 0.42, inner: 0.82 };   // rim = top of the rim torus
function well() {
  const b = new GB();
  const brick = (x, y, z) => ((Math.floor(y * 6) + Math.floor(Math.atan2(x, z) * 4 + (Math.floor(y * 6) % 2) * 0.5)) % 2 ? 0xb8aca0 : 0xa49888);
  b.cyl(1.0, 1.08, WELL.rim - 0.07, 0, { y: (WELL.rim - 0.07) / 2, seg: 16, colorFn: brick, open: true });
  // the inner wall faces inward (lathe points top → bottom), so looking in you see stone, not the outline hull
  b.lathe([[WELL.inner, WELL.rim - 0.06], [WELL.inner, WELL.water - 0.05]], 0x7a7064, { seg: 16, outline: false });
  b.lathe([[0.97, WELL.rim - 0.08], [WELL.inner - 0.01, WELL.rim - 0.08]], 0xb4a89a, { seg: 16, outline: false });
  b.torus(0.93, 0.08, 0xc0b4a8, { y: WELL.rim - 0.08, rx: Math.PI / 2, ts: 18, rs: 6 });
  b.cyl(WELL.inner, WELL.inner, 0.02, 0x3a6a8c, { y: WELL.water, seg: 16, outline: false, glow: 0.12 });
  // r3: the posts stand on the rim (they used to run down through the wall and poke out of it as two stakes) and carry
  // a pitched roof up to the ridge beam (the panels were tilted the other way: a V under the ridge, with a second,
  // narrower panel in the same plane flickering through each)
  for (const x of [-0.95, 0.95]) b.cyl(0.08, 0.09, 2.17, 0x8a5a30, { x, y: 1.635, seg: 7 });
  b.cyl(0.06, 0.06, 2.0, 0x8a5a30, { y: 1.95, rz: Math.PI / 2, seg: 7 });
  b.box(2.5, 0.08, 1.0, 0xc8743f, { y: 2.48, z: 0.4, rx: 0.6 });
  b.box(2.5, 0.08, 1.0, 0xc8743f, { y: 2.48, z: -0.4, rx: -0.6 });
  b.cyl(0.05, 0.05, 2.55, 0x8a5030, { y: 2.78, rz: Math.PI / 2, seg: 6 });
  // crank, rope and a bucket resting on the rim
  b.box(0.05, 0.3, 0.05, 0x7a4b2a, { x: 1.05, y: 1.85 });
  b.cyl(0.012, 0.012, 0.55, 0xd8c49a, { y: 1.65, seg: 3, outline: false });
  b.cyl(0.16, 0.13, 0.25, 0x9a6438, { y: 1.27, seg: 10 });
  b.torus(0.15, 0.015, 0x5a3a24, { y: 1.36, rx: Math.PI / 2, ts: 12, rs: 4, outline: false });
  for (let i = 0; i < 3; i++) b.sphere(0.2, 0x7cbf4a, { x: Math.sin(i * 2) * 1.08, y: 0.1, z: Math.cos(i * 2) * 1.08, sy: 0.6, ws: 8, hs: 6 });
  return b.build();
}
// WP9: the altar (art §4.4): a 1.05 m stone lectern on a brick ring, its socket slab tilted 0.5 rad back toward the
// south approach so the three star sockets read from 5 m at eye level. Socket i sits at x = (i − 1)·0.58, z = 0.05 on
// the slab top (y = 1.05); world-mod.js lays the pulsing empty-socket glows on them. W.pedestal.sockets holds them
export const ALTAR = { top: TW.pedestalTop, tilt: TW.pedestalTilt, dx: TW.socketDX, z: 0.05, slab: [1.84, 0.14, 0.95] };
function pedestal() {
  const b = new GB();
  const { top, tilt, dx, z: sz, slab } = ALTAR;
  const brick = (x, y, z) => ((Math.floor(y * 7) + Math.floor(Math.atan2(x, z) * 5 + (Math.floor(y * 7) % 2) * 0.5)) % 2 ? 0xb8aca0 : 0xa49888);
  b.cyl(1.0, 1.06, 0.22, 0, { y: 0.11, seg: 20, colorFn: brick });
  b.lathe([[0, 0.2], [0.8, 0.2], [0.72, 0.3], [0.56, 0.42], [0.5, 0.6], [0.56, 0.72], [0.7, 0.8], [0, 0.82]], 0xcfc4ae, { seg: 18 });
  b.torus(0.53, 0.035, 0xb0a48e, { y: 0.6, rx: Math.PI / 2, ts: 18, rs: 5, outline: false });
  // the slab: its top surface centre at (0, top, sz), normal (0, cos t, sin t); a darker recessed panel holds the sockets
  const ny = Math.cos(tilt), nz = Math.sin(tilt), half = slab[1] / 2, ux = 0, uy = -nz, uz = ny;   // u = slab "down-slope"
  b.rbox(slab[0], slab[1], slab[2], 0xc2b9a4, { y: top - half * ny, z: sz - half * nz, rx: tilt, radius: 0.045 });
  b.rbox(slab[0] - 0.16, 0.02, slab[2] - 0.2, 0x8f8676, { y: top + 0.004 * ny, z: sz + 0.004 * nz, rx: tilt, radius: 0.01, outline: false });
  b.box(1.0, 0.3, 0.5, 0xc8b8a0, { y: 0.84, z: -0.22, rx: tilt });
  // carved lip along the low (south) edge and a leaf crest along the high edge
  const lo = slab[2] / 2 - 0.02;
  b.rbox(slab[0] - 0.06, 0.08, 0.08, 0xb0a48e, { y: top + uy * lo + 0.03 * ny, z: sz + uz * lo + 0.03 * nz, rx: tilt, radius: 0.03 });
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.26;
    b.sphere(0.1, i % 2 ? 0x8ab048 : 0x9ac858, { x, y: top - uy * lo + 0.06, z: sz - uz * lo, sx: 1.5, sy: 0.45, sz: 0.9, rz: (i - 3) * 0.15, ws: 8, hs: 5 });
  }
  // three star sockets: gold rim, dark recess (world-mod.js lays the pulsing glow star in each)
  const srx = -(Math.PI / 2 - tilt);
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * dx;
    b.shape(star(0.27, 0.13), 0.02, 0xe8b84a, { x, y: top + 0.012 * ny, z: sz + 0.012 * nz, rx: srx, outline: false, bevel: 0.006 });
    b.shape(star(0.215, 0.1), 0.02, 0x4e4238, { x, y: top + 0.02 * ny, z: sz + 0.02 * nz, rx: srx, outline: false, bevel: 0.004 });
  }
  void ux;
  // leaf trim around the base and moss on the ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3;
    b.sphere(0.13, 0x8ab048, { x: Math.sin(a) * 1.04, y: 0.08, z: Math.cos(a) * 1.04, sx: 1.6, sy: 0.4, ry: a, ws: 8, hs: 5 });
    if (i % 2) b.sphere(0.08, 0x9ac858, { x: Math.sin(a) * 0.7, y: 0.8, z: Math.cos(a) * 0.7, sx: 1.6, sy: 0.35, ry: a, ws: 6, hs: 4, outline: false });
  }
  // a little sprout emblem on the column front
  b.sphere(0.07, 0x8fd14f, { x: 0.06, y: 0.52, z: 0.52, sx: 1.4, sy: 0.4, sz: 0.5, rz: 0.5, ws: 8, hs: 5, outline: false });
  b.sphere(0.07, 0x8fd14f, { x: -0.06, y: 0.52, z: 0.52, sx: 1.4, sy: 0.4, sz: 0.5, rz: -0.5, ws: 8, hs: 5, outline: false });
  return b.build();
}

const PROP_BUILDERS = {
  tree_round: () => treeRound(), tree_pine: () => treePine(false), tree_snow: () => treePine(true), tree_palm: () => treePalm(),
  bush: () => bush(), rock: () => rock(false), boulder: () => rock(true), stump: () => stump(),
  flowers: () => flowers(), grass: () => grassTuft(false), tallgrass: () => grassTuft(true), fern: () => fern(),
  pebble: () => pebble(), shell: () => shell(), crystal: () => crystal(), glowshroom: () => glowshroom(),
  fence: () => fence(), lamp: () => lamp(), sign: () => sign(), pot: () => pot(), well: () => well(), pedestal: () => pedestal(),
  sunflower: () => sunflower(),
};
export function waymarkerModel() { return cache.waymarker || (cache.waymarker = waymarker()); }
// material kind per type
export const PROP_KIND = {
  tree_round: 'tree', tree_pine: 'tree', tree_snow: 'tree', tree_palm: 'palm', bush: 'bush', rock: 'solid', boulder: 'big', stump: 'solid',
  flowers: 'grass', grass: 'grass', tallgrass: 'grass', fern: 'grass', pebble: 'deco', shell: 'deco', crystal: 'decoGlow', glowshroom: 'decoGlow',
  // WP9: no `lamp` here: world-mod.js draws every lamp as one island-wide instanced mesh (2 draw calls, not 2 per chunk)
  fence: 'solid', sign: 'solid', pot: 'solid', well: 'big', pedestal: 'solid',
  sunflower: 'bush',
};
const cache = {};
export function propModel(type) {
  if (cache[type]) return cache[type];
  const f = PROP_BUILDERS[type];
  if (!f) return null;
  return (cache[type] = f());
}

// ---------------------------------------------------------------- village buildings
function windowRound(b, x, y, z, r, ry = 0) {
  b.torus(r, r * 0.22, 0x8a5a30, { x, y, z, ry, ts: 16, rs: 6 });
  b.cyl(r, r, 0.04, 0xffe7a0, { x, y, z, rx: Math.PI / 2, rz: 0, ry, seg: 14, glow: 0.35, outline: false });
  b.box(r * 2, 0.05, 0.05, 0x8a5a30, { x, y, z: z + Math.cos(ry) * 0.03, ry, outline: false });
  b.box(0.05, r * 2, 0.05, 0x8a5a30, { x, y, z: z + Math.cos(ry) * 0.03, ry, outline: false });
}
// WP9 (art §4.4): every building is dressed on all four sides at eye level. Low "peekable" windows (sill ≈ 0.75 m)
// carry an interior card drawn by world-mod.js: HOUSE_WINDOWS lists them in model space { x, y, z, ry (facing),
// r (round) | w, h (square) } on the wall surface. Back dressing (woodpile, barrels, laundry line) stands inside the
// footprint colliders (world.js), so walking around a house you meet a woodpile, not an invisible wall.
const WOOD = 0x8a5a30, STONE = 0xc9bfae, LOG = 0x9a6438;
const wallR = (y) => 2.05 - ((y - 0.35) / 2.3) * 0.1;              // house_a round wall radius at height y
const onWallA = (th, y, r, out = 0.035) => ({ x: Math.sin(th) * (wallR(y) + out), y, z: Math.cos(th) * (wallR(y) + out), ry: th, r });
// back dressing footprints (model space: x, z, r, h) — world.js declares them as colliders so they stay solid when the
// footprint circles become fitted boxes (WP3)
export const HOUSE_DRESSING = {
  house_a: [[-0.45, -2.55, 0.62, 0.7], [1.75, -1.95, 0.3, 0.6], [2.12, -1.4, 0.26, 0.5], [-1.15, -2.75, 0.08, 1.6], [0.95, -2.85, 0.08, 1.6]],
  house_b: [[-0.6, -2.2, 0.62, 0.7], [0.75, -2.1, 0.3, 0.6], [1.2, -2.05, 0.26, 0.5], [-1.1, -2.6, 0.08, 1.65], [1.1, -2.62, 0.08, 1.65]],
  shop: [[1.45, -2.05, 0.6, 1.0], [-1.4, -2.05, 0.3, 0.6], [-0.9, -2.15, 0.26, 0.5]],
};
export const SHOP_COUNTER = { top: 0.57, gap: [0.04, 1.05] };   // counter top (m) and the clear stretch in front of Miso (model x)
export const HOUSE_WINDOWS = {
  house_a: [onWallA(0.65, 1.12, 0.34), onWallA(-0.7, 1.12, 0.3), onWallA(Math.PI + 0.45, 1.15, 0.3), onWallA(-1.62, 1.15, 0.28)],
  house_b: [{ x: 1.15, y: 1.12, z: 1.625, ry: 0, w: 0.6, h: 0.6 }, { x: -1.15, y: 1.12, z: 1.625, ry: 0, w: 0.6, h: 0.6 },
    { x: 0.55, y: 1.2, z: -1.625, ry: Math.PI, w: 0.6, h: 0.6 }, { x: 1.925, y: 1.15, z: -0.3, ry: Math.PI / 2, w: 0.55, h: 0.55 }],
  shop: [{ x: 0.5, y: 1.55, z: 1.625, ry: 0, w: 1.6, h: 0.75 }, { x: -0.6, y: 1.25, z: -1.625, ry: Math.PI, w: 0.6, h: 0.6 },
    { x: 2.125, y: 1.2, z: 0.45, ry: Math.PI / 2, w: 0.55, h: 0.55 }, { x: -2.125, y: 1.2, z: 0.4, ry: -Math.PI / 2, w: 0.55, h: 0.55 }],
};
function squareWindow(b, wd) {
  const { x, y, z, ry, w, h } = wd, fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
  const P = (a, c, d) => ({ x: x + rx * a + fx * d, y: y + c, z: z + rz * a + fz * d });
  for (const [a, c, sw, sh] of [[0, h / 2 + 0.04, w + 0.18, 0.09], [0, -h / 2 - 0.04, w + 0.24, 0.1], [w / 2 + 0.05, 0, 0.09, h + 0.1], [-w / 2 - 0.05, 0, 0.09, h + 0.1]]) {
    const q = P(a, c, 0.02);
    b.box(sw, sh, 0.12, WOOD, { x: q.x, y: q.y, z: q.z, ry });
  }
  const m = P(0, 0, 0.04);
  b.box(0.04, h, 0.03, WOOD, { x: m.x, y: m.y, z: m.z, ry, outline: false });
  b.box(w, 0.04, 0.03, WOOD, { x: m.x, y: m.y, z: m.z, ry, outline: false });
}
function roundFrame(b, wd) {
  const { x, y, z, ry, r } = wd;
  b.torus(r, 0.065, WOOD, { x, y, z, ry, ts: 18, rs: 6 });
  b.box(0.04, r * 2, 0.03, WOOD, { x: x + Math.sin(ry) * 0.012, y, z: z + Math.cos(ry) * 0.012, ry, outline: false });
  b.box(r * 2, 0.04, 0.03, WOOD, { x: x + Math.sin(ry) * 0.012, y, z: z + Math.cos(ry) * 0.012, ry, outline: false });
  b.box(r * 1.5, 0.06, 0.16, WOOD, { x: x + Math.sin(ry) * 0.05, y: y - r - 0.05, z: z + Math.cos(ry) * 0.05, ry });
}
function stoneSteps(b, z0, w = 1.0) {
  b.rbox(w, 0.3, 0.34, STONE, { y: 0.15, z: z0 + 0.17, radius: 0.05 });
  b.rbox(w + 0.1, 0.15, 0.34, 0xbdb2a0, { y: 0.075, z: z0 + 0.5, radius: 0.04 });
}
function woodpile(b, x, z) {
  b.box(1.1, 0.06, 0.66, WOOD, { x, y: 0.03, z });
  [[-0.24, 0.17], [0, 0.17], [0.24, 0.17], [-0.12, 0.38], [0.12, 0.38], [0, 0.59]].forEach(([u, y]) => {
    b.cyl(0.115, 0.115, 1.0, LOG, { x, y, z: z + u, rz: Math.PI / 2, seg: 7 });
    b.cyl(0.08, 0.08, 1.006, 0xe8b878, { x, y, z: z + u, rz: Math.PI / 2, seg: 7, outline: false });
  });
}
function barrel(b, x, z, y0 = 0, s = 1) {
  b.lathe([[0, 0], [0.24 * s, 0], [0.29 * s, 0.3 * s], [0.24 * s, 0.6 * s], [0, 0.6 * s]], 0xa86a34, { x, y: y0, z, seg: 9 });
  for (const yy of [0.12, 0.48]) b.torus(0.272 * s, 0.018, 0x5a3a24, { x, y: y0 + yy * s, z, rx: Math.PI / 2, ts: 10, rs: 3, outline: false });
}
function laundry(b, ax, az, bx, bz, h = 1.5) {
  for (const [x, z] of [[ax, az], [bx, bz]]) b.cyl(0.04, 0.05, h + 0.1, WOOD, { x, y: (h + 0.1) / 2, z, seg: 6 });
  const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
  b.cyl(0.008, 0.008, len, 0xf0e4c8, { x: (ax + bx) / 2, y: h - 0.04, z: (az + bz) / 2, rz: Math.PI / 2, ry, seg: 3, outline: false });
  [0xff9fb6, 0x9fdcff, 0xfff3a0].forEach((c, i) => {
    const t = 0.25 + i * 0.25, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    b.box(0.34, 0.42 - i * 0.05, 0.02, c, { x, y: h - 0.26 + i * 0.025, z, ry: ry, rz: (i - 1) * 0.06 });
  });
}
function ivy(b, pts) {
  for (const [x, y, z, s] of pts) {
    for (let k = 0; k < 3; k++) b.sphere(0.13 * s, k % 2 ? 0x6a9a34 : 0x7aa63a, { x: x + Math.cos(k * 1.7) * 0.12 * s, y: y + Math.sin(k * 2.3) * 0.14 * s, z: z + Math.sin(k * 1.7) * 0.05, sx: 1.3, sy: 0.9, sz: 0.45, ws: 6, hs: 4, outline: false });
  }
}
function flowerBox(b, x, y, z, ry, w = 0.8) {
  b.box(w, 0.18, 0.22, 0xa86a34, { x, y, z, ry });
  for (let k = 0; k < 4; k++) {
    const u = (k - 1.5) * (w / 4.2);
    b.sphere(0.075, [0xff8fa8, 0xffffff, 0xffd85a, 0xff8fa8][k], { x: x + Math.cos(ry) * u + Math.sin(ry) * 0.03, y: y + 0.14, z: z - Math.sin(ry) * u + Math.cos(ry) * 0.03, ws: 5, hs: 4, outline: false });
  }
}
function plaque(b, x, y, z) {
  b.cyl(0.13, 0.13, 0.04, 0xc88a4a, { x, y, z, rx: Math.PI / 2, seg: 14 });
  b.sphere(0.06, 0x7cc048, { x: x - 0.02, y: y + 0.01, z: z + 0.025, sx: 1.4, sy: 0.6, sz: 0.3, rz: 0.6, ws: 8, hs: 5, outline: false });
}
export function houseA() {
  const b = new GB();
  b.cyl(2.35, 2.45, 0.45, 0, { y: 0.22, seg: 11, colorFn: (x, y, z) => (Math.floor(Math.atan2(x, z) * 3) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.cyl(1.95, 2.05, 2.3, 0xf6e6c8, { y: 1.5, seg: 18 });
  // mushroom roof
  b.sphere(2.95, 0xe05a48, { y: 2.45, sy: 0.72, t1: Math.PI * 0.56, ws: 22, hs: 12 });
  b.lathe([[2.6, 0], [2.0, 0.12], [0, 0.2]], 0xf0d8b0, { y: 2.32, seg: 22 });
  const spots = [[0.3, 1.0, 0.45], [1.6, 0.6, 0.38], [-1.5, 0.75, 0.4], [-0.6, 0.35, 0.3], [0.9, 0.25, 0.32], [-0.2, 1.3, 0.28], [2.1, 1.2, 0.3], [-2.0, 1.9, 0.32], [0.4, 2.3, 0.3], [3.4, 0.9, 0.36], [4.4, 0.7, 0.34]];
  for (const [a, p, r] of spots) {
    const th = p * 0.62;
    const x = Math.sin(a) * Math.sin(th) * 2.95, z = Math.cos(a) * Math.sin(th) * 2.95, y = 2.45 + Math.cos(th) * 2.95 * 0.72;
    b.sphere(r, 0xfff4e8, { x, y, z, sy: 0.35, rx: Math.cos(a) * th, rz: -Math.sin(a) * th, outline: false, ws: 10, hs: 6 });
  }
  // chimney
  for (let i = 0; i < 3; i++) b.cyl(0.3, 0.32, 0.32, i % 2 ? 0xa89c8e : 0xb8aca0, { x: 1.3, z: -0.9, y: 3.9 + i * 0.3, seg: 8 });
  b.cyl(0.36, 0.36, 0.12, 0x9a8e80, { x: 1.3, z: -0.9, y: 4.8, seg: 8 });
  // door, plaque and stone steps down to the ground
  b.rbox(0.95, 1.5, 0.15, 0x9a6038, { y: 1.05, z: 1.98, radius: 0.06 });
  b.cyl(0.475, 0.475, 0.15, 0x9a6038, { y: 1.8, z: 1.98, rx: Math.PI / 2, seg: 14, t: 0 });
  b.box(0.04, 1.3, 0.02, 0x7a4828, { x: -0.2, y: 1.15, z: 2.07, outline: false });
  b.box(0.04, 1.3, 0.02, 0x7a4828, { x: 0.2, y: 1.15, z: 2.07, outline: false });
  b.sphere(0.06, 0xf5c040, { x: 0.3, y: 1.1, z: 2.1, glow: 0.2, ws: 8, hs: 6, outline: false });
  plaque(b, -0.66, 1.62, 2.0);
  stoneSteps(b, 2.44);
  // low peekable windows (cards: world-mod.js) + one high window that just glows
  for (const w of HOUSE_WINDOWS.house_a) roundFrame(b, w);
  windowRound(b, -1.15, 2.05, -1.62, 0.22, Math.PI + 0.62);
  // side: flower box under the side window; ivy on the other side
  { const w = HOUSE_WINDOWS.house_a[3]; flowerBox(b, w.x + Math.sin(w.ry) * 0.12, w.y - w.r - 0.15, w.z + Math.cos(w.ry) * 0.12, w.ry, 0.7); }
  ivy(b, [[2.0, 0.9, 0.35, 1], [2.02, 1.35, 0.1, 1.1], [1.95, 1.8, -0.35, 0.9], [1.9, 1.15, -0.6, 1], [1.98, 2.15, 0.2, 0.8]].map(([x, y, z, s2]) => { const th = Math.atan2(x, z); const R = wallR(y) + 0.05; return [Math.sin(th) * R, y, Math.cos(th) * R, s2]; }));
  // back: woodpile, barrels, laundry line
  woodpile(b, -0.45, -2.55);
  barrel(b, 1.75, -1.95); barrel(b, 2.12, -1.4, 0, 0.85);
  laundry(b, -1.15, -2.75, 0.95, -2.85, 1.5);
  // little bushes
  for (const s2 of [-1, 1]) {
    b.sphere(0.45, 0x6aae3a, { x: s2 * 1.75, y: 0.5, z: 1.35, ws: 10, hs: 8 });
    b.sphere(0.32, 0x7cc048, { x: s2 * 2.15, y: 0.4, z: 0.85, ws: 10, hs: 8 });
  }
  return b.build();
}
export function houseB() {
  const b = new GB();
  b.box(4.2, 0.45, 3.6, 0, { y: 0.22, colorFn: (x, y, z) => ((Math.floor(x * 1.6) + Math.floor(z * 1.6)) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.box(3.7, 2.3, 3.1, 0xf6e6c8, { y: 1.55 });
  // timber frame (all four sides)
  const tim = WOOD;
  for (const x of [-1.85, 1.85]) for (const z of [-1.55, 1.55]) b.box(0.18, 2.35, 0.18, tim, { x, z, y: 1.55 });
  for (const z of [1.56, -1.56]) { b.box(3.8, 0.16, 0.18, tim, { y: 2.66, z }); b.box(3.8, 0.16, 0.18, tim, { y: 0.48, z }); }
  b.box(0.16, 0.16, 3.2, tim, { y: 2.66, x: 1.86 });
  b.box(0.16, 0.16, 3.2, tim, { y: 2.66, x: -1.86 });
  // diagonal braces: the east one sits on the window-free half of its wall (the side window is at z −0.3)
  for (const x of [1.86, -1.86]) { b.box(0.16, 0.16, 3.2, tim, { y: 0.48, x }); b.box(0.12, 2.0, 0.12, tim, { x, y: 1.55, z: x > 0 ? 0.8 : 0.45, rx: 0.62 }); }
  // gable fill
  const gable = new THREE.Shape(); gable.moveTo(-1.85, 0); gable.lineTo(1.85, 0); gable.lineTo(0, 1.45); gable.closePath();
  b.shape(gable, 2.9, 0xf6e6c8, { y: 2.66, bevel: 0.02 });
  // blue tiled roof
  const tiles = (x, y, z) => (Math.floor(y * 3.2) % 2 ? 0x4a6aa8 : 0x5a7cbc);
  b.rbox(2.6, 0.2, 3.9, 0, { x: 1.05, y: 3.38, rz: -0.66, colorFn: tiles, radius: 0.08 });
  b.rbox(2.6, 0.2, 3.9, 0, { x: -1.05, y: 3.38, rz: 0.66, colorFn: tiles, radius: 0.08 });
  b.cyl(0.13, 0.13, 3.95, WOOD, { y: 4.15, rx: Math.PI / 2, seg: 8 });
  b.sphere(0.2, 0x9a6438, { y: 4.35, z: 1.9, ws: 10, hs: 8 });
  // door, plaque, steps
  b.rbox(0.95, 1.55, 0.15, 0x9a6038, { y: 1.15, z: 1.58, radius: 0.06 });
  b.cyl(0.475, 0.475, 0.15, 0x9a6038, { y: 1.92, z: 1.58, rx: Math.PI / 2, seg: 14 });
  b.sphere(0.06, 0xf5c040, { x: 0.3, y: 1.15, z: 1.7, glow: 0.2, ws: 8, hs: 6, outline: false });
  plaque(b, 0.0, 2.55, 1.66);
  stoneSteps(b, 1.8);
  // low windows with flower boxes; attic windows front and back
  HOUSE_WINDOWS.house_b.forEach((w, i) => { squareWindow(b, w); if (i < 2) flowerBox(b, w.x, w.y - w.h / 2 - 0.17, 1.74, 0, 0.82); });
  { const w = HOUSE_WINDOWS.house_b[3]; flowerBox(b, w.x + 0.13, w.y - w.h / 2 - 0.17, w.z, Math.PI / 2, 0.7); }
  windowRound(b, 0, 3.2, 1.5, 0.28);
  windowRound(b, 0, 3.2, -1.5, 0.24, Math.PI);
  // ivy up the west wall; back: woodpile, barrels, laundry line
  ivy(b, [[-1.9, 0.9, 0.8, 1.1], [-1.92, 1.4, 0.35, 1], [-1.9, 1.9, 0.6, 0.9], [-1.9, 1.2, -0.4, 1], [-1.92, 2.2, -0.1, 0.8]]);
  woodpile(b, -0.6, -2.2);
  barrel(b, 0.75, -2.1); barrel(b, 1.2, -2.05, 0, 0.85);
  laundry(b, -1.1, -2.6, 1.1, -2.62, 1.55);
  return b.build();
}
export function shopModel() {
  const b = new GB();
  b.box(4.6, 0.45, 3.6, 0, { y: 0.22, colorFn: (x, y, z) => ((Math.floor(x * 1.6) + Math.floor(z * 1.6)) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.box(4.1, 2.4, 3.1, 0xf8e8cc, { y: 1.6 });
  for (const x of [-2.05, 2.05]) for (const z of [-1.55, 1.55]) b.box(0.18, 2.45, 0.18, WOOD, { x, z, y: 1.6 });
  // roof (rounded orange-brown) with cat ears
  b.rbox(4.7, 0.9, 3.8, 0xd9783a, { y: 3.15, radius: 0.4 });
  b.rbox(4.0, 0.6, 3.2, 0xe08a48, { y: 3.65, radius: 0.28 });
  for (const s2 of [-1, 1]) {
    b.cone(0.75, 1.2, 0xd9783a, { x: s2 * 1.45, y: 4.3, z: 0.6, seg: 4, ry: Math.PI / 4, sz: 0.55, rz: -s2 * 0.15 });
    b.cone(0.45, 0.8, 0xffb8c0, { x: s2 * 1.45, y: 4.18, z: 0.8, seg: 4, ry: Math.PI / 4, sz: 0.3, rz: -s2 * 0.15, outline: false });
  }
  // sprout on top
  b.cyl(0.05, 0.06, 0.45, 0x5a9a3a, { y: 4.15, seg: 6 });
  b.sphere(0.25, 0x8fd14f, { x: 0.22, y: 4.42, sx: 1.3, sy: 0.4, rz: 0.4, ws: 10, hs: 6 });
  b.sphere(0.25, 0x8fd14f, { x: -0.22, y: 4.42, sx: 1.3, sy: 0.4, rz: -0.4, ws: 10, hs: 6 });
  // striped awning (green / cream, art §4.4): 8 stripes of 0.375 m, one box segment each, coloured per face so the edges
  // are hard; each stripe runs on into the valance scallop below it (scallop i sits at stripe i's centre)
  b.add(new THREE.BoxGeometry(3.0, 0.08, 1.2, 8, 1, 1), 0, { x: 0.5, y: 2.55, z: 2.05, rx: 0.35 });
  faceColor(b, (x) => (Math.min(7, Math.max(0, Math.floor((x - 0.5 + 1.5) / 0.375))) % 2 ? 0x7cc35a : 0xfff6e2));
  for (let i = 0; i < 8; i++) b.sphere(0.19, i % 2 ? 0x7cc35a : 0xfff6e2, { x: -0.85 + i * 0.385, y: 2.3, z: 2.62, sz: 0.4, sy: 0.6, ws: 8, hs: 6 });
  for (const x of [-0.95, 1.95]) b.cyl(0.05, 0.05, 2.3, WOOD, { x, y: 1.15, z: 2.6, seg: 6 });
  // the window behind Miso (kitchen card: world-mod.js) and the outdoor counter. Its top is at SHOP_COUNTER.top (0.57 m,
  // below Miso's chin from Pip's 0.88 m eye) and the goods stand at its two ends, so the middle metre in front of Miso
  // (model x 0.04–1.05; she stands at x 0.55) is clear: from the FP eye you see her whole face over the counter
  HOUSE_WINDOWS.shop.forEach((w, i) => { squareWindow(b, w); if (i > 1) flowerBox(b, w.x + Math.sin(w.ry) * 0.13, w.y - w.h / 2 - 0.17, w.z, w.ry, 0.7); });
  const ct = SHOP_COUNTER.top, cy = ct - 0.035;
  b.box(2.2, cy - 0.04, 0.46, 0xa86a34, { x: 0.55, y: (cy - 0.04) / 2, z: 2.55 });
  for (let i = 0; i < 5; i++) b.box(0.03, cy - 0.1, 0.02, 0x8a5428, { x: -0.4 + i * 0.47, y: (cy - 0.04) / 2, z: 2.79, outline: false });
  b.rbox(2.36, 0.07, 0.58, 0xc88a4a, { x: 0.55, y: cy, z: 2.55, radius: 0.025 });
  // goods: bread and a honey jar on the left end, a potion row and the shiny sword on a little stand on the right end
  b.sphere(0.17, 0xe0a050, { x: -0.33, y: ct + 0.065, z: 2.5, sx: 1.45, sy: 0.6, ws: 10, hs: 6 });
  for (let k = 0; k < 3; k++) b.box(0.025, 0.02, 0.12, 0xb87830, { x: -0.43 + k * 0.1, y: ct + 0.165, z: 2.5, outline: false });
  b.cyl(0.08, 0.08, 0.16, 0xffc870, { x: -0.05, y: ct + 0.085, z: 2.45, seg: 10, glow: 0.15 });
  b.cyl(0.085, 0.085, 0.03, WOOD, { x: -0.05, y: ct + 0.175, z: 2.45, seg: 10 });
  for (let k = 0; k < 3; k++) {
    const x = 1.12 + k * 0.15;
    b.sphere(0.065, 0xff7ab0, { x, y: ct + 0.065, z: 2.6, ws: 8, hs: 6, glow: 0.3 });
    b.cyl(0.022, 0.025, 0.07, 0xe8f4ff, { x, y: ct + 0.155, z: 2.6, seg: 6, outline: false });
    b.cyl(0.026, 0.026, 0.025, WOOD, { x, y: ct + 0.205, z: 2.6, seg: 6, outline: false });
  }
  b.box(0.06, 0.14, 0.06, WOOD, { x: 1.6, y: ct + 0.065, z: 2.4 });
  b.box(0.06, 0.03, 0.42, 0xdcecff, { x: 1.6, y: ct + 0.165, z: 2.48, rx: -0.25, glow: 0.25 });
  b.box(0.16, 0.03, 0.05, 0xf5c040, { x: 1.6, y: ct + 0.185, z: 2.3, rx: -0.25 });
  // crates at the counter's ends (world.js colliders): a basket of apples on the left one, flowers on the right one
  for (const [x, z, c] of [[-0.62, 2.0, 0], [1.95, 2.0, 0xffb0c8]]) {
    b.box(0.52, 0.5, 0.52, 0xb07a48, { x, y: 0.25, z });
    b.box(0.54, 0.05, 0.54, 0x8a5428, { x, y: 0.12, z, outline: false });
    if (c) { for (let k = 0; k < 3; k++) b.sphere(0.08, c, { x: x - 0.12 + k * 0.12, y: 0.55, z, ws: 7, hs: 5, outline: false }); continue; }
    b.cyl(0.16, 0.12, 0.1, 0x9a6438, { x, y: 0.55, z, seg: 10 });
    for (const [ax, az, ac] of [[-0.04, -0.02, 0xff6a5a], [0.06, 0.06, 0x9ad04e], [0.02, -0.06, 0xff6a5a], [-0.06, 0.08, 0xff6a5a]]) b.sphere(0.06, ac, { x: x + ax, y: 0.64, z: z + az, ws: 8, hs: 6 });
  }
  // door
  b.rbox(0.85, 1.5, 0.15, 0x9a6038, { x: -1.4, y: 1.1, z: 1.58, radius: 0.06 });
  b.cyl(0.425, 0.425, 0.15, 0x9a6038, { x: -1.4, y: 1.85, z: 1.58, rx: Math.PI / 2, seg: 14 });
  b.sphere(0.06, 0xf5c040, { x: -1.15, y: 1.1, z: 1.7, ws: 8, hs: 6, outline: false });
  // paw sign on a bracket
  b.box(0.9, 0.08, 0.08, WOOD, { x: 2.45, y: 2.75, z: 1.4 });
  b.cyl(0.36, 0.36, 0.08, 0xf5c040, { x: 2.75, y: 2.3, z: 1.4, rx: Math.PI / 2, seg: 16 });
  b.cyl(0.29, 0.29, 0.02, 0xffe080, { x: 2.75, y: 2.3, z: 1.45, rx: Math.PI / 2, seg: 16, outline: false });
  b.sphere(0.11, WOOD, { x: 2.75, y: 2.22, z: 1.47, sz: 0.3, ws: 8, hs: 6, outline: false });
  for (let i = 0; i < 4; i++) b.sphere(0.05, WOOD, { x: 2.75 + (i - 1.5) * 0.09, y: 2.36 + (i === 0 || i === 3 ? 0 : 0.04), z: 1.47, sz: 0.3, ws: 6, hs: 4, outline: false });
  // flower pot by the door
  b.cyl(0.25, 0.2, 0.35, 0xc87848, { x: -2.0, y: 0.62, z: 1.55, seg: 10 });
  b.sphere(0.28, 0x6aae3a, { x: -2.0, y: 0.9, z: 1.55, ws: 10, hs: 8 });
  for (let k = 0; k < 3; k++) b.sphere(0.08, 0xff8fa8, { x: -2.0 + (k - 1) * 0.15, y: 1.1, z: 1.65, ws: 6, hs: 4, outline: false });
  // back and sides: stacked crates, barrels, ivy
  for (const [x, y, z] of [[1.2, 0.25, -2.05], [1.75, 0.25, -2.0], [1.45, 0.74, -2.05]]) b.box(0.5, 0.48, 0.5, 0xb07a48, { x, y, z, ry: x * 0.3 });
  barrel(b, -1.4, -2.05); barrel(b, -0.9, -2.15, 0, 0.85);
  ivy(b, [[2.1, 0.9, -0.5, 1.1], [2.12, 1.45, -0.9, 1], [2.1, 1.95, -0.3, 0.9], [-2.1, 1.0, -0.8, 1], [-2.12, 1.6, -0.3, 0.9]]);
  return b.build();
}

// ---------------------------------------------------------------- Great Tree
export function greatTreeParts() {
  const trunk = new GB();
  const bark = shade(0x6e4526, 0xa8723e);
  trunk.lathe([[0, 0], [2.7, 0], [2.3, 0.6], [1.85, 1.8], [1.6, 4], [1.55, 6], [1.8, 7.4], [2.1, 8.2], [0, 8.4]], 0, { seg: 16, colorFn: bark });
  // twisted strands
  for (let s = 0; s < 6; s++) {
    const a0 = (s / 6) * TAU;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const y = k * 1.35, a = a0 + k * 0.45;
      const r = 1.65 - Math.sin((k / 6) * Math.PI) * 0.15;
      pts.push([Math.sin(a) * r, y + 0.2, Math.cos(a) * r]);
    }
    trunk.tube(pts, 0.42, 0x8a5a32, { tseg: 20, rs: 6 });
  }
  // roots
  for (let s = 0; s < 7; s++) {
    const a = (s / 7) * TAU + 0.2;
    trunk.tube([[Math.sin(a) * 1.6, 1.4, Math.cos(a) * 1.6], [Math.sin(a) * 2.8, 0.5, Math.cos(a) * 2.8], [Math.sin(a + 0.2) * 3.9, 0.05, Math.cos(a + 0.2) * 3.9]], 0.38, 0x7e5030, { tseg: 10, rs: 6 });
    trunk.sphere(0.3, 0x8a9a3a, { x: Math.sin(a) * 2.7, y: 0.75, z: Math.cos(a) * 2.7, sy: 0.4, ws: 8, hs: 5, outline: false });
  }
  // branches
  const branchEnds = [];
  for (let s = 0; s < 6; s++) {
    const a = (s / 6) * TAU + 0.5;
    const len = 4.2 + (s % 2) * 1.2;
    const end = [Math.sin(a) * len, 10.5 + (s % 3) * 0.6, Math.cos(a) * len];
    trunk.tube([[Math.sin(a) * 1.0, 7.6, Math.cos(a) * 1.0], [Math.sin(a) * len * 0.5, 9.3, Math.cos(a) * len * 0.5], end], 0.42 - (s % 2) * 0.06, 0x8a5a32, { tseg: 10, rs: 6 });
    branchEnds.push(end);
  }
  // shelf fungi on the sides + a smooth bark "face plate" so the face is never hidden by the twisted strands
  for (const [a, y] of [[-1.7, 2.6], [1.9, 3.4], [2.6, 5.4], [-2.4, 6.0]]) {
    trunk.sphere(0.42, 0xe8c48a, { x: Math.sin(a) * 1.95, y, z: Math.cos(a) * 1.95, sy: 0.28, ws: 10, hs: 5 });
  }
  trunk.sphere(1.05, 0xa8723e, { y: 4.3, z: 1.55, sx: 1.15, sy: 1.2, sz: 0.55, ws: 16, hs: 12 });
  const trunkB = trunk.build();

  // sleepy canopy: sparse droopy moss clumps
  const canopy = new GB();
  const moss = shade(0x7a8a30, 0xb8b450);
  for (const e of branchEnds) {
    canopy.sphere(1.7, 0, { x: e[0], y: e[1] + 0.3, z: e[2], sy: 0.62, colorFn: moss, ws: 14, hs: 9 });
    canopy.sphere(1.1, 0, { x: e[0] * 0.75, y: e[1] + 0.9, z: e[2] * 0.75, sy: 0.65, colorFn: moss, ws: 12, hs: 8 });
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7;
      canopy.sphere(0.22, 0x8a9a38, { x: e[0] + Math.sin(a) * 1.1, y: e[1] - 0.9, z: e[2] + Math.cos(a) * 1.1, sy: 3.2, ws: 6, hs: 6 });
    }
  }
  canopy.sphere(2.0, 0, { y: 12.2, sy: 0.6, colorFn: moss, ws: 14, hs: 9 });
  const canopyB = canopy.build();

  // lush bloom canopy + blossoms
  const bloom = new GB();
  const lush = shade(0x5aa03a, 0xa8dc5a);
  for (const e of branchEnds) {
    bloom.sphere(2.4, 0, { x: e[0], y: e[1] + 0.5, z: e[2], sy: 0.8, colorFn: lush, ws: 16, hs: 10 });
    bloom.sphere(1.7, 0, { x: e[0] * 0.6, y: e[1] + 1.6, z: e[2] * 0.6, colorFn: lush, ws: 14, hs: 10 });
  }
  bloom.sphere(3.2, 0, { y: 12.8, sy: 0.75, colorFn: lush, ws: 18, hs: 12 });
  const blossom = new GB();
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const e = branchEnds[i % branchEnds.length];
    const a = rnd() * TAU, el = rnd() * 1.2 - 0.2, r = 2.3 + rnd() * 0.5;
    const x = e[0] + Math.cos(el) * Math.sin(a) * r, y = e[1] + 0.5 + Math.sin(el) * r * 0.8, z = e[2] + Math.cos(el) * Math.cos(a) * r;
    const c = rnd() < 0.62 ? 0xffb0c8 : rnd() < 0.5 ? 0xffffff : 0xffd0e0;
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * TAU;
      blossom.sphere(0.13, c, { x: x + Math.sin(pa) * 0.13, y: y + Math.cos(pa) * 0.13, z, sz: 0.5, ws: 6, hs: 4, outline: false, glow: 0.12 });
    }
    blossom.sphere(0.07, 0xffd040, { x, y, z: z + 0.04, ws: 6, hs: 4, outline: false, glow: 0.2 });
  }
  bloom.merge(blossom);
  const bloomB = bloom.build();

  // faces
  const sleepy = new GB();
  for (const s of [-1, 1]) {
    sleepy.torus(0.3, 0.07, 0x3a2416, { x: s * 0.5, y: 4.6, z: 2.08, arc: Math.PI, rz: Math.PI, ts: 12, rs: 5, outline: false });
    sleepy.sphere(0.24, 0xff9f9f, { x: s * 0.85, y: 4.1, z: 1.98, sz: 0.3, sy: 0.6, ws: 10, hs: 6, outline: false });
  }
  sleepy.torus(0.22, 0.06, 0x3a2416, { y: 3.8, z: 2.08, arc: Math.PI, rz: Math.PI, ts: 12, rs: 5, outline: false });
  const awake = new GB();
  for (const s of [-1, 1]) {
    awake.sphere(0.27, 0x2a1a12, { x: s * 0.5, y: 4.6, z: 2.0, sz: 0.5, sy: 1.2, ws: 12, hs: 10, outline: false });
    awake.sphere(0.09, 0xffffff, { x: s * 0.5 + 0.09, y: 4.8, z: 2.13, glow: 1, ws: 8, hs: 6, outline: false });
    awake.sphere(0.26, 0xff9f9f, { x: s * 0.88, y: 4.05, z: 1.98, sz: 0.3, sy: 0.6, ws: 10, hs: 6, outline: false });
  }
  awake.torus(0.34, 0.08, 0x3a2416, { y: 4.0, z: 2.08, arc: Math.PI, rz: Math.PI, ts: 14, rs: 5, outline: false });
  // WP9: the procedural fallback (no GLB) is authored 14 m tall; scale it to the Great Tree's height like the GLB
  const k = TW.treeH / 14, out = { trunk: trunkB, canopy: canopyB, bloom: bloomB, sleepy: sleepy.build(), awake: awake.build() };
  for (const key in out) for (const g of [out[key].geo, out[key].ol]) if (g) { g.scale(k, k, k); g.computeBoundingSphere(); g.computeBoundingBox && g.computeBoundingBox(); }
  out.branchEnds = branchEnds.map((e) => e.map((v) => v * k));
  out.height = TW.treeH;
  return out;
}

// ---------------------------------------------------------------- bridge (per instance; length varies)
export function bridgeGeo(br) {
  const b = new GB();
  const n = Math.max(3, Math.round(br.len / 0.45));
  const ang = Math.atan2(br.dx, br.dz);
  const deck = (t) => br.h0 + (br.h1 - br.h0) * t + Math.sin(t * Math.PI) * br.arch;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = br.ax + br.dx * br.len * t, z = br.az + br.dz * br.len * t;
    const y = deck(t);
    const t2 = Math.min(1, t + 0.5 / n), t1 = Math.max(0, t - 0.5 / n);
    const pitch = Math.atan2(deck(t2) - deck(t1), (t2 - t1) * br.len);
    b.box(br.w, 0.1, 0.4, i % 3 === 0 ? 0xb07a48 : i % 3 === 1 ? 0xc08850 : 0xa87040, { x, y: y - 0.05, z, ry: ang, rx: -pitch, order: 'YXZ' });
  }
  const posts = Math.max(2, Math.round(br.len / 1.8) + 1);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    const cx = br.ax + br.dx * br.len * t, cz = br.az + br.dz * br.len * t, y = deck(t);
    for (const s of [-1, 1]) {
      const x = cx + br.dz * s * (br.w / 2 - 0.08), z = cz - br.dx * s * (br.w / 2 - 0.08);
      b.cyl(0.08, 0.09, 0.85, 0x8a5a30, { x, y: y + 0.38, z, seg: 7 });
      b.sphere(0.09, 0x9a6438, { x, y: y + 0.82, z, ws: 7, hs: 5 });
      if (i === 0 || i === posts - 1 || i % 2 === 0) b.cyl(0.1, 0.1, 2.2, 0x6a4428, { x, y: y - 1.2, z, seg: 6, outline: false });
    }
  }
  // rails
  const segs = Math.max(4, Math.round(br.len / 1.2));
  for (const s of [-1, 1]) {
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, tm = (t0 + t1) / 2;
      const cx = br.ax + br.dx * br.len * tm + br.dz * s * (br.w / 2 - 0.08), cz = br.az + br.dz * br.len * tm - br.dx * s * (br.w / 2 - 0.08);
      const pitch = Math.atan2(deck(t1) - deck(t0), (t1 - t0) * br.len);
      b.box(0.08, 0.08, br.len / segs + 0.02, 0xc88a4a, { x: cx, y: deck(tm) + 0.72, z: cz, ry: ang, rx: -pitch, order: 'YXZ' });
    }
  }
  return b.build();
}

// ---------------------------------------------------------------- chest (body + lid separately)
export function chestParts(heart) {
  const wood = heart ? 0xa8603a : 0x9a6034, gold = 0xf5c040;
  const body = new GB();
  body.rbox(1.0, 0.55, 0.7, wood, { y: 0.29, radius: 0.06 });
  for (const x of [-0.42, 0.42]) body.box(0.1, 0.57, 0.74, gold, { x, y: 0.29 });
  body.box(1.04, 0.08, 0.74, 0x7a4828, { y: 0.06 });
  body.rbox(0.22, 0.26, 0.06, gold, { y: 0.45, z: 0.36, radius: 0.03 });
  body.sphere(0.04, 0x5a3a24, { y: 0.45, z: 0.4, ws: 6, hs: 4, outline: false });
  if (heart) body.shape(heartShape(0.2), 0.04, 0xff5a7a, { y: 0.24, z: 0.37, glow: 0.25, outline: false });
  const lid = new GB();
  // lid authored with pivot at back-top edge (0, 0, -0.35) → geometry offset
  lid.add(new THREE.CylinderGeometry(0.36, 0.36, 1.0, 14, 1, false, 0, Math.PI), wood, { z: 0.35, rz: Math.PI / 2, sx: 0.7 });
  for (const x of [-0.42, 0.42]) lid.add(new THREE.CylinderGeometry(0.375, 0.375, 0.1, 14, 1, false, 0, Math.PI), gold, { x, z: 0.35, rz: Math.PI / 2, sx: 0.72 });
  lid.rbox(0.18, 0.14, 0.06, gold, { y: 0.02, z: 0.71, radius: 0.02 });
  return { body: body.build(), lid: lid.build() };
}

// ---------------------------------------------------------------- WP9 region landmarks (art §4.5 / §4.7, RULINGS)
// Original designs in the game's style, one per region, tall enough to read over the canopy. Each returns
// { main: built, spin?: { built, pivot: [x, y, z] } (a part world-mod.js turns), lamp?: [x, y, z] (night light point),
// beam?: [x, y, z] } in model space: origin at the base centre, front toward +Z, height H.
// collider radius per landmark (m) at height H: the stem flare / stone stack / base plinth at eye height plus a margin, so
// neither Pip's body nor the FP eye ever enters the model (decor stays inside this ring). world.js declares them
export const LANDMARK_R = { woods: (H) => 2.35 * (H / 15), peaks: (H) => 2.75 * (H / 15), shores: (H) => 2.1 * (H / 16), meadow: (H) => 2.3 * (H / 13) };
/** uniform scale of a landmarkParts result (geometry, outline hull, pivot / lamp / beam points) */
function scaleParts(p, k) {
  if (k === 1) return p;
  const sc = (bt) => { for (const g of [bt.geo, bt.ol]) if (g) { g.scale(k, k, k); g.computeBoundingSphere(); g.computeBoundingBox(); } };
  sc(p.main);
  if (p.spin) { sc(p.spin.built); p.spin.pivot = p.spin.pivot.map((v) => v * k); }
  for (const key of ['lamp', 'beam']) if (p[key]) p[key] = p[key].map((v) => v * k);
  return p;
}
export function landmarkParts(id, H) {
  if (id === 'woods') {
    // Grumble's Crown: a giant purple-capped mushroom with golden spots and a little golden crown on top
    const b = new GB(), sh = H * 0.7, cr = H * 0.36, cy = sh - 0.2, w = H / 15;
    b.lathe([[0, 0], [2.3 * w, 0], [1.9 * w, 0.35], [1.55 * w, 1.5], [1.35 * w, sh * 0.45], [1.42 * w, sh * 0.8], [1.75 * w, sh], [0, sh + 0.1]], 0, { seg: 18, colorFn: (x, y) => (y < 1.2 ? 0xe8cfa6 : 0xf3dfba) });
    b.lathe([[1.4 * w, 0], [2.7 * w, -0.75 * w], [2.6 * w, -0.85 * w], [1.35 * w, -0.35 * w]], 0xfff2de, { y: sh * 0.62, seg: 18 });
    const capA = new THREE.Color(0x5e3060), capB = new THREE.Color(0x9a5aa0), t = new THREE.Color();
    b.sphere(cr, 0, { y: cy, sy: 0.58, t1: Math.PI * 0.55, ws: 26, hs: 12, colorFn: (x, y, z, nx, ny) => t.copy(capA).lerp(capB, Math.max(0, ny) * 0.75).getHex() });
    b.lathe([[cr * 0.97, 0], [cr * 0.7, 0.35], [cr * 0.3, 0.6], [0, 0.66]], 0xf2d2b4, { y: cy - 0.1, seg: 24 });
    for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; b.box(0.05, 0.36, cr * 0.6, 0xd8b090, { x: Math.sin(a) * cr * 0.62, y: cy - 0.12, z: Math.cos(a) * cr * 0.62, ry: a, outline: false }); }
    for (const [a, th, r] of [[0, 0.35, 0.95], [1.2, 0.62, 0.85], [2.4, 0.5, 1.0], [3.5, 0.7, 0.8], [4.6, 0.45, 0.95], [5.6, 0.75, 0.8], [0.6, 0.95, 0.6], [1.9, 1.0, 0.65], [3.0, 0.98, 0.6], [4.1, 1.02, 0.62], [5.1, 0.98, 0.6], [6.0, 1.0, 0.55], [0.2, 0.12, 0.7]]) {
      b.sphere(r * w, 0xf5c040, { x: Math.sin(a) * Math.sin(th) * cr, y: cy + Math.cos(th) * cr * 0.58, z: Math.cos(a) * Math.sin(th) * cr, sy: 0.3, rx: Math.cos(a) * th * 0.8, rz: -Math.sin(a) * th * 0.8, ws: 10, hs: 6, outline: false, glow: 0.35 });
    }
    const top = cy + cr * 0.58;
    b.cyl(0.95 * w, 1.05 * w, 0.55 * w, 0xf5c040, { y: top + 0.2 * w, seg: 14, glow: 0.2 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.cone(0.24 * w, 0.6 * w, 0xf5c040, { x: Math.sin(a) * 0.85 * w, y: top + 0.72 * w, z: Math.cos(a) * 0.85 * w, seg: 6, glow: 0.2 }); b.sphere(0.11 * w, 0xff4a5a, { x: Math.sin(a) * 0.85 * w, y: top + 1.05 * w, z: Math.cos(a) * 0.85 * w, ws: 6, hs: 4, outline: false, glow: 0.6 }); }
    // baby mushrooms and moss on the stem's root flare, all inside the collider ring (LANDMARK_R.woods); the group sits
    // 0.25 m into the ground, so ground level is local y 0.25
    for (const [a, d, s] of [[0.5, 2.02, 1], [2.2, 2.05, 0.8], [4.0, 2.0, 1.05], [5.3, 2.05, 0.7]]) {
      const x = Math.sin(a) * d * w, z = Math.cos(a) * d * w;
      b.cyl(0.12 * s, 0.16 * s, 0.6 * s, 0xfff0d8, { x, y: 0.25 + 0.3 * s, z, seg: 8 });
      b.sphere(0.42 * s, 0xb06ab0, { x, y: 0.25 + 0.6 * s, z, sy: 0.62, t1: Math.PI * 0.55, ws: 12, hs: 6 });
      b.sphere(0.09 * s, 0xf5c040, { x, y: 0.25 + 0.85 * s, z: z + 0.12 * s, sy: 0.4, ws: 6, hs: 4, outline: false, glow: 0.5 });
    }
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; b.sphere(0.35 * w, 0x7aa63a, { x: Math.sin(a) * 2.1 * w, y: 0.3, z: Math.cos(a) * 2.1 * w, sy: 0.35, sx: 1.4, ry: a, ws: 8, hs: 5 }); }
    return { main: b.build(), lamp: [0, top + 0.8 * w, 0] };
  }
  if (id === 'peaks') {
    // Summit Crystal Cairn: five stacked snow-capped stones (≈ 0.55 H) crowned by a frost-blue crystal cluster, with two
    // rings of blue and white diamond pennants wrapped round the stack (nothing anchored to the ground, so it sits on any
    // summit). Authored for H = 15; everything scales with u
    const b = new GB(), u = H / 15;
    const stone = (x, y, z, nx, ny) => (ny > 0.55 ? 0xf6faff : ny > 0.3 ? 0xdde6ee : 0xa8a096);
    const stack = [[2.3, 1.0, 0, 0, 1, 0.6], [1.95, 2.9, 0.15, -0.1, 2, 0.6], [1.6, 4.55, -0.12, 0.1, 3, 0.62], [1.25, 5.95, 0.1, 0, 4, 0.62], [0.95, 7.15, -0.05, 0.08, 5, 0.65]];
    for (const [r, y, x, z, sd, sy] of stack) b.ico(r * u, 0, { x: x * u, y: y * u, z: z * u, sy, detail: 1, jitter: 0.18, seed: sd, colorFn: stone });
    for (const [a, r] of [[0.6, 0.7], [2.5, 0.55], [4.2, 0.8], [5.4, 0.5]]) b.ico(r * u, 0, { x: Math.sin(a) * 1.95 * u, y: r * 0.3 * u, z: Math.cos(a) * 1.95 * u, sy: 0.7, detail: 1, jitter: 0.3, seed: a * 10, colorFn: stone });
    const cy = 7.6 * u, CR = 0x8fd8ff;
    b.add(new THREE.OctahedronGeometry(1.3 * u, 0), CR, { y: cy + 2.6 * u, sy: 2.3, flat: true, glow: 0.7 });
    b.add(new THREE.OctahedronGeometry(0.8 * u, 0), 0xb8ecff, { x: 0.9 * u, y: cy + 1.2 * u, z: 0.25 * u, rz: -0.5, sy: 2.0, flat: true, glow: 0.7 });
    b.add(new THREE.OctahedronGeometry(0.72 * u, 0), 0xa8e4ff, { x: -0.85 * u, y: cy + 1.1 * u, z: -0.2 * u, rz: 0.55, sy: 1.9, flat: true, glow: 0.7 });
    b.add(new THREE.OctahedronGeometry(0.5 * u, 0), 0xc8f0ff, { x: 0.15 * u, y: cy + 0.8 * u, z: 0.85 * u, rx: 0.55, sy: 1.8, flat: true, glow: 0.7 });
    b.add(new THREE.OctahedronGeometry(0.45 * u, 0), 0xd8f6ff, { x: -0.2 * u, y: cy + 0.75 * u, z: -0.8 * u, rx: -0.5, sy: 1.7, flat: true, glow: 0.7 });
    // pennant garlands: a sagging rope ring round a stone's waist, tied at 7 points, two diamond flags per span
    for (const [y0, R0, seed] of [[4.55, 2.02, 0.3], [2.9, 2.42, 1.1]]) {
      const ties = 7, pts = [], y = y0 * u, R = R0 * u;
      for (let i = 0; i <= ties * 4; i++) {
        const t = i / 4, a = (t / ties) * TAU + seed, sag = Math.sin((t % 1) * Math.PI) * 0.32 * u;
        pts.push([Math.sin(a) * R, y - sag, Math.cos(a) * R]);
      }
      b.tube(pts, 0.022 * u, 0xf0e4c8, { tseg: ties * 8, rs: 3, outline: false });
      for (let i = 0; i < ties; i++) for (const f of [0.33, 0.67]) {
        const a = ((i + f) / ties) * TAU + seed, sag = Math.sin(f * Math.PI) * 0.32 * u;
        b.add(new THREE.OctahedronGeometry(0.17 * u, 0), (i + (f > 0.5 ? 1 : 0)) % 2 ? 0x6ab4f0 : 0xffffff, { x: Math.sin(a) * (R + 0.02), y: y - sag - 0.2 * u, z: Math.cos(a) * (R + 0.02), sx: 0.12, sy: 1.3, ry: a + Math.PI / 2, outline: false });
      }
    }
    return { main: b.build(), lamp: [0, cy + 2.6 * u, 0] };
  }
  if (id === 'shores') {
    // Pinch's Lighthouse: cream and coral stripes, a gallery, a gold lamp room and a coral cap; the beam is world-mod.js's.
    // Authored at 16 m and scaled uniformly to H (scaleParts)
    const k = H / 16; H = 16;
    const b = new GB(), base = 0.8, tTop = H * 0.72;
    const brick = (x, y, z) => ((Math.floor(y * 4) + Math.floor(Math.atan2(x, z) * 4 + (Math.floor(y * 4) % 2) * 0.5)) % 2 ? 0xb8aca0 : 0xa49888);
    b.cyl(2.0, 2.15, base, 0, { y: base / 2, seg: 16, colorFn: brick });
    // cream and coral stripes 1.55 m tall: a lathe ring at every stripe edge (radius along the tower's profile) and one
    // colour per face, so the stripes are hard-edged (on the 5-point profile they blended into one soft coral band)
    const SW = 1.55, band = (x, y) => (Math.floor((y - base) / SW) % 2 ? 0xff7a6a : 0xfff6e2);
    const prof = [[1.55, base], [1.38, base + (tTop - base) * 0.5], [1.05, tTop]], ys = prof.map((q) => q[1]);
    for (let y = base + SW; y < tTop - 0.05; y += SW) if (!ys.some((v) => Math.abs(v - y) < 0.05)) ys.push(y);
    const rAt = (y) => { const i = y <= prof[1][1] ? 0 : 1, [r0, y0] = prof[i], [r1, y1] = prof[i + 1]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); };
    b.lathe([[0, base], ...ys.sort((p, q) => p - q).map((y) => [rAt(y), y]), [0, tTop]], 0, { seg: 18 });
    faceColor(b, band);
    b.cyl(1.55, 1.45, 0.22, 0xf0e4d0, { y: tTop + 0.1, seg: 18 });
    b.torus(1.45, 0.04, 0x5a3a24, { y: tTop + 0.75, rx: Math.PI / 2, ts: 28, rs: 4 });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; b.cyl(0.035, 0.035, 0.55, 0x5a3a24, { x: Math.sin(a) * 1.45, y: tTop + 0.48, z: Math.cos(a) * 1.45, seg: 4, outline: false }); }
    b.cyl(0.8, 0.8, 1.35, 0xffe08a, { y: tTop + 0.9, seg: 12, glow: 0.8 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(0.06, 1.35, 0.06, 0x5a3a24, { x: Math.sin(a) * 0.82, y: tTop + 0.9, z: Math.cos(a) * 0.82, outline: false }); }
    b.cone(1.15, 1.5, 0xff7a6a, { y: tTop + 2.3, seg: 14 });
    b.sphere(0.2, 0xf5c040, { y: tTop + 3.15, ws: 10, hs: 8, glow: 0.3 });
    b.cyl(0.02, 0.02, 0.9, 0x5a3a24, { y: tTop + 3.6, seg: 3, outline: false });
    b.box(0.5, 0.3, 0.02, 0xff5a4a, { x: 0.26, y: tTop + 3.85, outline: false });
    // door, porthole windows, a life ring and a crab-shell sign by the door
    b.rbox(0.85, 1.45, 0.16, 0x4a6aa8, { y: base + 0.72, z: 1.52, radius: 0.08 });
    b.cyl(0.425, 0.425, 0.16, 0x4a6aa8, { y: base + 1.45, z: 1.52, rx: Math.PI / 2, seg: 14 });
    for (const y of [4.2, 6.7]) { const r = 1.55 - ((y - base) / (tTop - base)) * 0.5; b.torus(0.24, 0.05, 0x5a3a24, { y, z: r + 0.02, ts: 14, rs: 5 }); b.cyl(0.22, 0.22, 0.03, 0xffe7a0, { y, z: r + 0.01, rx: Math.PI / 2, seg: 12, glow: 0.4, outline: false }); }
    b.torus(0.32, 0.08, 0xff7a6a, { x: 1.05, y: base + 1.2, z: 1.2, ry: 0.7, ts: 16, rs: 6 });
    b.sphere(0.3, 0xe05a40, { x: -0.95, y: base + 1.15, z: 1.3, sy: 0.6, sz: 0.4, ry: -0.6, ws: 10, hs: 6 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; b.sphere(0.3, i % 2 ? 0xffb8c0 : 0xf5e0c0, { x: Math.sin(a) * 2.25, y: 0.12, z: Math.cos(a) * 2.25, sy: 0.4, ws: 8, hs: 5 }); }
    return scaleParts({ main: b.build(), lamp: [0, tTop + 0.9, 0], beam: [0, tTop + 0.9, 0] }, k);
  }
  // meadow: the windmill: an octagonal cream tower with timber bands, a terracotta cap and four canvas sails (spin part).
  // Authored at 13 m and scaled uniformly to H
  const k = H / 13; H = 13;
  const b = new GB(), tw = H * 0.64, hub = [0, tw - 0.35, 1.45];
  const oct = Math.PI / 8;   // a face (not a corner) of the octagon toward +Z, where the door and windows sit
  b.cyl(2.25, 2.4, 0.4, 0xb8aca0, { y: 0.2, seg: 8, ry: oct });
  b.cyl(1.35, 2.05, tw - 0.4, 0xf6e6c8, { y: 0.4 + (tw - 0.4) / 2, seg: 8, ry: oct });
  for (const y of [1.0, tw * 0.5, tw - 0.2]) { const r = 2.05 - ((y - 0.4) / (tw - 0.4)) * 0.7 + 0.04; b.cyl(r, r + 0.02, 0.16, 0x8a5a30, { y, seg: 8, ry: oct, outline: false }); }
  b.cone(1.95, H * 0.24, 0xd9783a, { y: tw + H * 0.12 - 0.05, seg: 8, ry: oct });
  b.sphere(0.24, 0xf5c040, { y: tw + H * 0.24, ws: 10, hs: 8 });
  b.rbox(0.9, 1.5, 0.15, 0x9a6038, { y: 1.15, z: 2.0, radius: 0.06 });
  b.cyl(0.45, 0.45, 0.15, 0x9a6038, { y: 1.9, z: 2.0, rx: Math.PI / 2, seg: 12 });
  for (const y of [3.3, 5.2]) { const R = (2.05 - ((y - 0.4) / (tw - 0.4)) * 0.7) * Math.cos(oct); b.box(0.5, 0.5, 0.1, 0x8a5a30, { y, z: R + 0.03, rx: -0.09 }); b.box(0.38, 0.38, 0.06, 0xffe7a0, { y, z: R + 0.07, rx: -0.09, glow: 0.4, outline: false }); }
  b.cyl(0.32, 0.32, 0.9, 0x7a4b2a, { x: hub[0], y: hub[1], z: hub[2] - 0.35, rx: Math.PI / 2, seg: 10 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; b.sphere(0.3, i % 2 ? 0xff8fa8 : 0xfff3a0, { x: Math.sin(a) * 2.5, y: 0.25, z: Math.cos(a) * 2.5, ws: 7, hs: 5, outline: false }); b.sphere(0.32, 0x6aae3a, { x: Math.sin(a + 0.4) * 2.55, y: 0.18, z: Math.cos(a + 0.4) * 2.55, sy: 0.6, ws: 7, hs: 5 }); }
  const s = new GB(), L = H * 0.4;
  s.cyl(0.42, 0.42, 0.3, 0x8a5a30, { rx: Math.PI / 2, seg: 10 });
  s.sphere(0.2, 0xf5c040, { z: 0.2, ws: 8, hs: 6 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.3, ca = Math.cos(a), sa = Math.sin(a);
    const P = (u, v) => ({ x: ca * u - sa * v, y: sa * u + ca * v });
    const m = P(L / 2, 0);
    s.box(L, 0.13, 0.1, 0x8a5a30, { x: m.x, y: m.y, z: 0.08, rz: a });
    for (let j = 0; j < 5; j++) { const q = P(0.95 + j * (L - 1.1) / 4.2, 0.48); s.box(0.06, 0.95, 0.05, 0x9a6438, { x: q.x, y: q.y, z: 0.1, rz: a, outline: false }); }
    const c = P(0.95 + (L - 1.1) / 2, 0.5);
    s.box(L - 1.1, 0.88, 0.03, 0xfff6e2, { x: c.x, y: c.y, z: 0.12, rz: a });
  }
  return scaleParts({ main: b.build(), spin: { built: s.build(), pivot: hub }, lamp: [0, 5.2, 1.4] }, k);
}
