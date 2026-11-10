// Procedural prop models (instanced nature + village buildings + Great Tree + bridges + chests).
import * as THREE from 'three';
import { GB } from './toon.js';
import { TAU } from './util.js';

const shade = (dark, light) => {
  const a = new THREE.Color(dark), b = new THREE.Color(light), c = new THREE.Color();
  return (x, y, z, nx, ny) => c.copy(a).lerp(b, Math.min(1, Math.max(0, ny * 0.55 + 0.5))).getHex();
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
  const leaf = shade(0x4f8f30, 0x9ad04e);
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
function treePine(snow) {
  const b = new GB();
  b.cyl(0.18, 0.3, 1.5, 0x7a4b2a, { y: 0.75, seg: 8 });
  const tiers = [[1.75, 2.0, 1.9], [1.4, 1.8, 2.95], [1.05, 1.55, 3.85], [0.7, 1.3, 4.65]];
  const green = shade(0x2f6a35, 0x5e9e45);
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
function sign() {
  const b = new GB();
  b.cyl(0.07, 0.08, 1.2, 0x8a5a30, { y: 0.6, seg: 7 });
  b.rbox(0.95, 0.5, 0.08, 0xd9a066, { y: 1.05, radius: 0.04 });
  b.box(0.6, 0.04, 0.01, 0x8a5a30, { y: 1.12, z: 0.045, outline: false });
  b.box(0.45, 0.04, 0.01, 0x8a5a30, { y: 1.0, z: 0.045, outline: false, x: -0.07 });
  b.sphere(0.03, 0x6a4a30, { y: 1.22, x: 0.36, z: 0.045, outline: false, ws: 6, hs: 4 });
  b.sphere(0.03, 0x6a4a30, { y: 1.22, x: -0.36, z: 0.045, outline: false, ws: 6, hs: 4 });
  for (let i = 0; i < 2; i++) b.ico(0.12, 0xa8a096, { x: (i ? 0.15 : -0.15), y: 0.04, z: 0.1, sy: 0.5, detail: 0, outline: false });
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
function well() {
  const b = new GB();
  const brick = (x, y, z) => ((Math.floor(y * 6) + Math.floor(Math.atan2(x, z) * 4 + (Math.floor(y * 6) % 2) * 0.5)) % 2 ? 0xb8aca0 : 0xa49888);
  b.cyl(1.0, 1.08, 0.85, 0, { y: 0.42, seg: 14, colorFn: brick, open: false });
  b.torus(0.95, 0.12, 0xc0b4a8, { y: 0.86, rx: Math.PI / 2, ts: 16, rs: 6 });
  b.cyl(0.85, 0.85, 0.02, 0x3a5a7a, { y: 0.8, seg: 14, outline: false, glow: 0.1 });
  for (const x of [-0.95, 0.95]) b.cyl(0.08, 0.09, 1.9, 0x8a5a30, { x, y: 1.4, seg: 7 });
  b.cyl(0.06, 0.06, 2.0, 0x8a5a30, { y: 1.9, rz: Math.PI / 2, seg: 7 });
  b.box(1.35, 0.08, 1.0, 0xc06a3a, { y: 2.48, x: -0.0, z: 0.4, rx: -0.6 });
  b.box(1.35, 0.08, 1.0, 0xc06a3a, { y: 2.48, z: -0.4, rx: 0.6 });
  b.box(2.5, 0.08, 1.0, 0xc8743f, { y: 2.48, z: 0.4, rx: -0.6 });
  b.box(2.5, 0.08, 1.0, 0xc8743f, { y: 2.48, z: -0.4, rx: 0.6 });
  b.cyl(0.05, 0.05, 2.55, 0x8a5030, { y: 2.78, rz: Math.PI / 2, seg: 6 });
  b.cyl(0.16, 0.13, 0.25, 0x9a6438, { y: 1.35, seg: 8 });
  b.cyl(0.01, 0.01, 0.45, 0x6a4a30, { y: 1.65, seg: 3, outline: false });
  for (let i = 0; i < 3; i++) b.sphere(0.2, 0x7cbf4a, { x: Math.sin(i * 2) * 1.05, y: 0.1, z: Math.cos(i * 2) * 1.05, sy: 0.6, ws: 8, hs: 6 });
  return b.build();
}
function pedestal() {
  const b = new GB();
  b.lathe([[0, 0], [1.15, 0], [1.15, 0.2], [1.0, 0.25], [0.95, 0.5], [1.05, 0.55], [1.05, 0.68], [0, 0.7]], 0xc8b8a0, { seg: 20 });
  b.cyl(1.07, 1.07, 0.05, 0xb4a48c, { y: 0.66, seg: 20, outline: false });
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.58;
    b.shape(star(0.24, 0.11), 0.04, 0x7a6a58, { x, y: 0.69, z: 0.05, rx: -Math.PI / 2, outline: false, bevel: 0.01 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    b.sphere(0.12, 0x8ab048, { x: Math.sin(a) * 1.1, y: 0.05, z: Math.cos(a) * 1.1, sx: 1.6, sy: 0.4, ry: a, ws: 8, hs: 5 });
    if (i % 2) b.sphere(0.07, 0x9ac858, { x: Math.sin(a) * 0.75, y: 0.7, z: Math.cos(a) * 0.75, sx: 1.6, sy: 0.35, ry: a, ws: 6, hs: 4, outline: false });
  }
  return b.build();
}

const PROP_BUILDERS = {
  tree_round: () => treeRound(), tree_pine: () => treePine(false), tree_snow: () => treePine(true), tree_palm: () => treePalm(),
  bush: () => bush(), rock: () => rock(false), boulder: () => rock(true), stump: () => stump(),
  flowers: () => flowers(), grass: () => grassTuft(false), tallgrass: () => grassTuft(true), fern: () => fern(),
  pebble: () => pebble(), shell: () => shell(), crystal: () => crystal(), glowshroom: () => glowshroom(),
  fence: () => fence(), lamp: () => lamp(), sign: () => sign(), pot: () => pot(), well: () => well(), pedestal: () => pedestal(),
};
// material kind per type
export const PROP_KIND = {
  tree_round: 'tree', tree_pine: 'tree', tree_snow: 'tree', tree_palm: 'palm', bush: 'bush', rock: 'solid', boulder: 'big', stump: 'solid',
  flowers: 'grass', grass: 'grass', tallgrass: 'grass', fern: 'grass', pebble: 'deco', shell: 'deco', crystal: 'decoGlow', glowshroom: 'decoGlow',
  fence: 'solid', lamp: 'glow', sign: 'solid', pot: 'solid', well: 'big', pedestal: 'solid',
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
export function houseA() {
  const b = new GB();
  b.cyl(2.35, 2.45, 0.45, 0, { y: 0.22, seg: 11, colorFn: (x, y, z) => (Math.floor(Math.atan2(x, z) * 3) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.cyl(1.95, 2.05, 2.3, 0xf6e6c8, { y: 1.5, seg: 18 });
  // mushroom roof
  b.sphere(2.95, 0xe05a48, { y: 2.45, sy: 0.72, t1: Math.PI * 0.56, ws: 22, hs: 12 });
  b.lathe([[2.6, 0], [2.0, 0.12], [0, 0.2]], 0xf0d8b0, { y: 2.32, seg: 22 });
  const spots = [[0.3, 1.0, 0.45], [1.6, 0.6, 0.38], [-1.5, 0.75, 0.4], [-0.6, 0.35, 0.3], [0.9, 0.25, 0.32], [-0.2, 1.3, 0.28], [2.1, 1.2, 0.3], [-2.0, 1.9, 0.32], [0.4, 2.3, 0.3]];
  for (const [a, p, r] of spots) {
    const th = p * 0.62;
    const x = Math.sin(a) * Math.sin(th) * 2.95, z = Math.cos(a) * Math.sin(th) * 2.95, y = 2.45 + Math.cos(th) * 2.95 * 0.72;
    b.sphere(r, 0xfff4e8, { x, y, z, sy: 0.35, rx: Math.cos(a) * th, rz: -Math.sin(a) * th, outline: false, ws: 10, hs: 6 });
  }
  // chimney
  for (let i = 0; i < 3; i++) b.cyl(0.3, 0.32, 0.32, i % 2 ? 0xa89c8e : 0xb8aca0, { x: 1.3, z: -0.9, y: 3.9 + i * 0.3, seg: 8 });
  b.cyl(0.36, 0.36, 0.12, 0x9a8e80, { x: 1.3, z: -0.9, y: 4.8, seg: 8 });
  // door
  b.rbox(0.95, 1.5, 0.15, 0x9a6038, { y: 1.05, z: 1.98, radius: 0.06 });
  b.cyl(0.475, 0.475, 0.15, 0x9a6038, { y: 1.8, z: 1.98, rx: Math.PI / 2, seg: 14, t: 0 });
  b.box(0.04, 1.3, 0.02, 0x7a4828, { x: -0.2, y: 1.15, z: 2.07, outline: false });
  b.box(0.04, 1.3, 0.02, 0x7a4828, { x: 0.2, y: 1.15, z: 2.07, outline: false });
  b.sphere(0.06, 0xf5c040, { x: 0.3, y: 1.1, z: 2.1, glow: 0.2, ws: 8, hs: 6, outline: false });
  b.cyl(0.7, 0.75, 0.12, 0xb0a498, { y: 0.4, z: 2.4, seg: 10 });
  windowRound(b, 1.25, 1.65, 1.62, 0.36, 0.65);
  windowRound(b, -1.3, 1.6, 1.55, 0.3, -0.7);
  // little bushes
  for (const s of [-1, 1]) {
    b.sphere(0.45, 0x6aae3a, { x: s * 1.75, y: 0.5, z: 1.35, ws: 10, hs: 8 });
    b.sphere(0.32, 0x7cc048, { x: s * 2.15, y: 0.4, z: 0.85, ws: 10, hs: 8 });
  }
  return b.build();
}
export function houseB() {
  const b = new GB();
  b.box(4.2, 0.45, 3.6, 0, { y: 0.22, colorFn: (x, y, z) => ((Math.floor(x * 1.6) + Math.floor(z * 1.6)) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.box(3.7, 2.3, 3.1, 0xf6e6c8, { y: 1.55 });
  // timber frame
  const tim = 0x8a5a30;
  for (const x of [-1.85, 1.85]) for (const z of [-1.55, 1.55]) b.box(0.18, 2.35, 0.18, tim, { x, z, y: 1.55 });
  b.box(3.8, 0.16, 0.18, tim, { y: 2.66, z: 1.56 });
  b.box(3.8, 0.16, 0.18, tim, { y: 0.48, z: 1.56 });
  b.box(0.16, 0.16, 3.2, tim, { y: 2.66, x: 1.86 });
  b.box(0.16, 0.16, 3.2, tim, { y: 2.66, x: -1.86 });
  // gable fill
  const gable = new THREE.Shape(); gable.moveTo(-1.85, 0); gable.lineTo(1.85, 0); gable.lineTo(0, 1.45); gable.closePath();
  b.shape(gable, 2.9, 0xf6e6c8, { y: 2.66, bevel: 0.02 });
  // blue tiled roof
  const tiles = (x, y, z) => (Math.floor(y * 3.2) % 2 ? 0x4a6aa8 : 0x5a7cbc);
  b.rbox(2.6, 0.2, 3.9, 0, { x: 1.05, y: 3.38, rz: -0.66, colorFn: tiles, radius: 0.08 });
  b.rbox(2.6, 0.2, 3.9, 0, { x: -1.05, y: 3.38, rz: 0.66, colorFn: tiles, radius: 0.08 });
  b.cyl(0.13, 0.13, 3.95, 0x8a5a30, { y: 4.15, rx: Math.PI / 2, seg: 8 });
  b.sphere(0.2, 0x9a6438, { y: 4.35, z: 1.9, ws: 10, hs: 8 });
  // door + windows
  b.rbox(0.95, 1.55, 0.15, 0x9a6038, { y: 1.15, z: 1.58, radius: 0.06 });
  b.cyl(0.475, 0.475, 0.15, 0x9a6038, { y: 1.92, z: 1.58, rx: Math.PI / 2, seg: 14 });
  b.sphere(0.06, 0xf5c040, { x: 0.3, y: 1.15, z: 1.7, glow: 0.2, ws: 8, hs: 6, outline: false });
  for (const s of [-1, 1]) {
    b.rbox(0.8, 0.8, 0.1, 0x8a5a30, { x: s * 1.15, y: 1.6, z: 1.57, radius: 0.04 });
    b.box(0.62, 0.62, 0.04, 0xffe7a0, { x: s * 1.15, y: 1.6, z: 1.62, glow: 0.35, outline: false });
    b.box(0.05, 0.62, 0.03, 0x8a5a30, { x: s * 1.15, y: 1.6, z: 1.65, outline: false });
    b.box(0.62, 0.05, 0.03, 0x8a5a30, { x: s * 1.15, y: 1.6, z: 1.65, outline: false });
    // flower box
    b.box(0.9, 0.2, 0.25, 0xa86a34, { x: s * 1.15, y: 1.1, z: 1.7 });
    for (let k = 0; k < 4; k++) b.sphere(0.08, [0xff8fa8, 0xffffff, 0xffd85a, 0xff8fa8][k], { x: s * 1.15 + (k - 1.5) * 0.2, y: 1.25, z: 1.72, ws: 6, hs: 5, outline: false });
  }
  windowRound(b, 0, 3.2, 1.5, 0.28);
  b.cyl(0.7, 0.75, 0.12, 0xb0a498, { y: 0.4, z: 2.05, seg: 10 });
  return b.build();
}
export function shopModel() {
  const b = new GB();
  b.box(4.6, 0.45, 3.6, 0, { y: 0.22, colorFn: (x, y, z) => ((Math.floor(x * 1.6) + Math.floor(z * 1.6)) % 2 ? 0xb8aca0 : 0xa89c8e) });
  b.box(4.1, 2.4, 3.1, 0xf8e8cc, { y: 1.6 });
  for (const x of [-2.05, 2.05]) for (const z of [-1.55, 1.55]) b.box(0.18, 2.45, 0.18, 0x8a5a30, { x, z, y: 1.6 });
  // roof (rounded orange-brown) with cat ears
  b.rbox(4.7, 0.9, 3.8, 0xd9783a, { y: 3.15, radius: 0.4 });
  b.rbox(4.0, 0.6, 3.2, 0xe08a48, { y: 3.65, radius: 0.28 });
  for (const s of [-1, 1]) {
    b.cone(0.75, 1.2, 0xd9783a, { x: s * 1.45, y: 4.3, z: 0.6, seg: 4, ry: Math.PI / 4, sz: 0.55, rz: -s * 0.15 });
    b.cone(0.45, 0.8, 0xffb8c0, { x: s * 1.45, y: 4.18, z: 0.8, seg: 4, ry: Math.PI / 4, sz: 0.3, rz: -s * 0.15, outline: false });
  }
  // sprout on top
  b.cyl(0.05, 0.06, 0.45, 0x5a9a3a, { y: 4.15, seg: 6 });
  b.sphere(0.25, 0x8fd14f, { x: 0.22, y: 4.42, sx: 1.3, sy: 0.4, rz: 0.4, ws: 10, hs: 6 });
  b.sphere(0.25, 0x8fd14f, { x: -0.22, y: 4.42, sx: 1.3, sy: 0.4, rz: -0.4, ws: 10, hs: 6 });
  // striped awning
  const stripes = (x) => (Math.floor((x + 3) * 2.5) % 2 ? 0x8ab048 : 0xf6efd0);
  b.box(3.0, 0.08, 1.2, 0, { x: 0.5, y: 2.55, z: 2.05, rx: 0.35, colorFn: stripes });
  for (let i = 0; i < 8; i++) b.sphere(0.19, i % 2 ? 0x8ab048 : 0xf6efd0, { x: -0.85 + i * 0.385, y: 2.3, z: 2.62, sz: 0.4, sy: 0.6, ws: 8, hs: 6 });
  // counter window + goods
  b.box(2.4, 1.0, 0.05, 0x5a3a24, { x: 0.5, y: 1.85, z: 1.56, outline: false });
  b.box(2.6, 0.18, 0.6, 0xa86a34, { x: 0.5, y: 1.3, z: 1.8 });
  b.sphere(0.25, 0xe0a050, { x: 0.9, y: 1.5, z: 1.8, sx: 1.4, sy: 0.6, ws: 10, hs: 6 });
  b.cyl(0.14, 0.14, 0.28, 0xffc870, { x: 0.1, y: 1.53, z: 1.8, seg: 10, glow: 0.15 });
  b.cyl(0.15, 0.15, 0.05, 0x8a5a30, { x: 0.1, y: 1.7, z: 1.8, seg: 10 });
  b.sphere(0.12, 0xff6a5a, { x: 1.5, y: 1.48, z: 1.85, ws: 8, hs: 6 });
  b.sphere(0.12, 0x9ad04e, { x: 1.3, y: 1.46, z: 1.9, ws: 8, hs: 6 });
  // door
  b.rbox(0.85, 1.5, 0.15, 0x9a6038, { x: -1.4, y: 1.1, z: 1.58, radius: 0.06 });
  b.cyl(0.425, 0.425, 0.15, 0x9a6038, { x: -1.4, y: 1.85, z: 1.58, rx: Math.PI / 2, seg: 14 });
  b.sphere(0.06, 0xf5c040, { x: -1.15, y: 1.1, z: 1.7, ws: 8, hs: 6, outline: false });
  // paw sign on a bracket
  b.box(0.9, 0.08, 0.08, 0x8a5a30, { x: 2.45, y: 2.75, z: 1.4 });
  b.cyl(0.36, 0.36, 0.08, 0xf5c040, { x: 2.75, y: 2.3, z: 1.4, rx: Math.PI / 2, seg: 16 });
  b.cyl(0.29, 0.29, 0.02, 0xffe080, { x: 2.75, y: 2.3, z: 1.45, rx: Math.PI / 2, seg: 16, outline: false });
  b.sphere(0.11, 0x8a5a30, { x: 2.75, y: 2.22, z: 1.47, sz: 0.3, ws: 8, hs: 6, outline: false });
  for (let i = 0; i < 4; i++) b.sphere(0.05, 0x8a5a30, { x: 2.75 + (i - 1.5) * 0.09, y: 2.36 + (i === 0 || i === 3 ? 0 : 0.04), z: 1.47, sz: 0.3, ws: 6, hs: 4, outline: false });
  // flower pot
  b.cyl(0.25, 0.2, 0.35, 0xc87848, { x: 2.0, y: 0.62, z: 1.9, seg: 10 });
  b.sphere(0.28, 0x6aae3a, { x: 2.0, y: 0.9, z: 1.9, ws: 10, hs: 8 });
  for (let k = 0; k < 3; k++) b.sphere(0.08, 0xff8fa8, { x: 2.0 + (k - 1) * 0.15, y: 1.1, z: 2.0, ws: 6, hs: 4, outline: false });
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
  return { trunk: trunkB, canopy: canopyB, bloom: bloomB, sleepy: sleepy.build(), awake: awake.build(), branchEnds };
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
