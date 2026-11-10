// Procedural character models (rigged as nested pivot groups) matching the 2D sprite designs.
import * as THREE from 'three';
import { GB, toonMat, sharedOutline } from './toon.js';
import { starShape, heartShape } from './props.js';
import { TAU } from './util.js';

const INK = 0x2a1a12;

// ---------------------------------------------------------------- helpers
function face(b, o) {
  const { y, z, dx, r = 0.035, sy = 1.35, blush = true, bdx = dx * 1.65, by = y - r * 1.6, bz = z - 0.01, br = r * 1.05, angry = false, browY = y + r * 2.0, smile = true, mouthY = y - r * 2.2, mouthR = r * 0.65, blushCol = 0xff9f9f, eyeCol = INK, s = 1 } = o;
  for (const sd of [-1, 1]) {
    b.sphere(r, eyeCol, { x: sd * dx, y, z, sy, sz: 0.6, ws: 12, hs: 10, outline: false });
    b.sphere(r * 0.38, 0xffffff, { x: sd * dx + r * 0.32, y: y + r * 0.45, z: z + r * 0.45, glow: 1, ws: 8, hs: 6, outline: false });
    b.sphere(r * 0.18, 0xffffff, { x: sd * dx - r * 0.3, y: y - r * 0.45, z: z + r * 0.5, glow: 1, ws: 6, hs: 4, outline: false });
    if (blush) b.sphere(br, blushCol, { x: sd * bdx, y: by, z: bz, sz: 0.3, sy: 0.6, ws: 10, hs: 6, outline: false });
    if (angry) b.box(r * 2.4, r * 0.55, r * 0.5, INK, { x: sd * dx * 1.05, y: browY, z: z + r * 0.2, rz: sd * 0.45, outline: false });
  }
  if (smile) b.torus(mouthR, mouthR * 0.28, INK, { y: mouthY, z: z + 0.005, arc: Math.PI, rz: Math.PI, ts: 10, rs: 4, outline: false, s });
}

export function buildRig(spec) {
  const parts = spec.map((p) => ({ name: p.name, parent: p.parent || null, pivot: p.pivot || [0, 0, 0], built: p.b.build(), noShadow: p.noShadow, transparent: p.transparent }));
  const byName = {};
  parts.forEach((p) => (byName[p.name] = p));
  return { parts, byName };
}

/** Create meshes for a rig def. Returns { root, nodes, mat, matT } */
export function instRig(def, o = {}) {
  const mat = toonMat({ glow: true, rim: o.rim ?? 1 });
  let matT = null;
  const ol = sharedOutline(o.outline || 'char');
  const root = new THREE.Group();
  const nodes = { root };
  for (const p of def.parts) {
    const parent = p.parent ? nodes[p.parent] : root;
    const pp = p.parent ? def.byName[p.parent].pivot : [0, 0, 0];
    const g = new THREE.Group();
    g.position.set(p.pivot[0] - pp[0], p.pivot[1] - pp[1], p.pivot[2] - pp[2]);
    g.userData.rest = g.position.clone();
    if (p.built.geo) {
      let m;
      if (p.transparent) {
        matT = matT || toonMat({ glow: true, transparent: true, opacity: 0.82, rim: 1.4 });
        m = new THREE.Mesh(p.built.geo, matT);
      } else m = new THREE.Mesh(p.built.geo, mat);
      m.position.set(-p.pivot[0], -p.pivot[1], -p.pivot[2]);
      m.castShadow = !p.noShadow;
      g.add(m);
      if (p.built.ol) {
        const om = new THREE.Mesh(p.built.ol, ol);
        om.position.copy(m.position);
        om.raycast = () => {};
        g.add(om);
      }
    }
    parent.add(g);
    nodes[p.name] = g;
  }
  return { root, nodes, mat, matT, mats: matT ? [mat, matT] : [mat] };
}

const defCache = {};
function cached(key, fn) { return defCache[key] || (defCache[key] = fn()); }

// ---------------------------------------------------------------- Pip
export function swordBuilt(shiny) {
  return cached('sword' + (shiny ? 1 : 0), () => {
    const b = new GB();
    const blade = shiny ? 0xdcecff : 0xdba468, edge = shiny ? 0xffffff : 0xe8bc84;
    b.box(0.075, 0.46, 0.028, blade, { y: 0.33, glow: shiny ? 0.25 : 0 });
    b.box(0.03, 0.44, 0.03, edge, { y: 0.33, z: 0.004, outline: false, glow: shiny ? 0.4 : 0 });
    b.cone(0.053, 0.1, blade, { y: 0.61, seg: 4, ry: Math.PI / 4, sz: 0.37, glow: shiny ? 0.25 : 0 });
    b.rbox(0.22, 0.05, 0.06, shiny ? 0xf5c040 : 0x9a6034, { y: 0.09, radius: 0.02 });
    b.cyl(0.025, 0.025, 0.13, shiny ? 0x4a6aa8 : 0x7a4b2a, { y: 0.01, seg: 6 });
    b.sphere(0.035, shiny ? 0xff5a7a : 0x9a6034, { y: -0.07, ws: 8, hs: 6, glow: shiny ? 0.4 : 0 });
    return b.build();
  });
}

export function pipDef() {
  return cached('pip', () => {
    const G1 = 0x7aa63a, G2 = 0x8fbf45, SKIN = 0xffdcbf, CREAM = 0xf3e3c3, BROWN = 0x7a4a2e;
    const legL = new GB(), legR = new GB(), body = new GB(), head = new GB(), armL = new GB(), armR = new GB();
    for (const [b, x] of [[legL, 0.085], [legR, -0.085]]) {
      b.capsule(0.06, 0.07, BROWN, { x, y: 0.09 });
      b.sphere(0.065, 0x5a3420, { x, y: 0.04, z: 0.025, sy: 0.6, sz: 1.3, ws: 10, hs: 6 });
      b.cyl(0.055, 0.06, 0.06, CREAM, { x, y: 0.19, seg: 10 });
    }
    // torso: tunic + belt + capelet
    body.lathe([[0, 0.16], [0.17, 0.16], [0.16, 0.24], [0.13, 0.4], [0.115, 0.5], [0, 0.52]], CREAM, { seg: 16 });
    body.torus(0.145, 0.025, 0x7a4a2a, { y: 0.29, rx: Math.PI / 2, ts: 18, rs: 5, outline: false });
    body.rbox(0.06, 0.05, 0.02, 0xe8b84a, { y: 0.29, z: 0.15, radius: 0.01, outline: false, glow: 0.15 });
    body.add(new THREE.ConeGeometry(0.24, 0.24, 16, 1, true), G1, { y: 0.42, z: -0.01, side: 0 });
    body.cone(0.24, 0.02, G1, { y: 0.305, seg: 16, outline: false });
    body.sphere(0.04, 0x9ad04e, { y: 0.47, z: 0.13, sx: 1.4, sy: 0.6, rz: 0.4, ws: 8, hs: 5, outline: false });
    // head
    const hy = 0.68;
    head.sphere(0.2, SKIN, { y: hy - 0.02, z: 0.06, ws: 20, hs: 14 });
    head.sphere(0.24, G1, { y: hy + 0.03, z: -0.03, ws: 20, hs: 14 });
    head.torus(0.18, 0.035, G2, { y: hy - 0.01, z: 0.165, ts: 22, rs: 6, sx: 1.05 });
    for (const sd of [-1, 1]) {
      head.cone(0.08, 0.18, G1, { x: sd * 0.14, y: hy + 0.25, z: -0.02, rz: -sd * 0.38, seg: 10 });
      head.cone(0.05, 0.12, 0xf0a060, { x: sd * 0.135, y: hy + 0.235, z: 0.012, rz: -sd * 0.38, seg: 8, sz: 0.5, outline: false });
    }
    // bangs
    for (const [x, rz] of [[-0.09, 0.5], [0, 0], [0.09, -0.5], [-0.15, 0.9], [0.15, -0.9]]) head.sphere(0.07, 0x8b5a2b, { x, y: hy + 0.105 - Math.abs(x) * 0.5, z: 0.16 - Math.abs(x) * 0.25, sx: 0.9, sy: 0.6, sz: 0.55, rz, ws: 10, hs: 6, outline: false });
    // sprout
    head.cyl(0.012, 0.016, 0.1, 0x5a9a3a, { y: hy + 0.29, seg: 6, outline: false });
    head.sphere(0.06, 0x8fd14f, { x: 0.045, y: hy + 0.34, sx: 1.25, sy: 0.4, rz: 0.5, ws: 10, hs: 6 });
    head.sphere(0.06, 0x8fd14f, { x: -0.045, y: hy + 0.34, sx: 1.25, sy: 0.4, rz: -0.5, ws: 10, hs: 6 });
    face(head, { y: hy - 0.02, z: 0.235, dx: 0.075, r: 0.034, by: hy - 0.08, bdx: 0.12, bz: 0.215, mouthY: hy - 0.1, mouthR: 0.02 });
    // arms
    for (const [b, sd] of [[armL, 1], [armR, -1]]) {
      b.capsule(0.048, 0.1, CREAM, { x: sd * 0.2, y: 0.36, rz: sd * 0.35 });
      b.sphere(0.052, SKIN, { x: sd * 0.235, y: 0.28, ws: 10, hs: 8 });
    }
    return buildRig([
      { name: 'body', pivot: [0, 0.2, 0], b: body },
      { name: 'legL', pivot: [0.085, 0.19, 0], b: legL },
      { name: 'legR', pivot: [-0.085, 0.19, 0], b: legR },
      { name: 'head', parent: 'body', pivot: [0, 0.5, 0], b: head },
      { name: 'armL', parent: 'body', pivot: [0.16, 0.44, 0], b: armL },
      { name: 'armR', parent: 'body', pivot: [-0.16, 0.44, 0], b: armR },
    ]);
  });
}

// ---------------------------------------------------------------- enemies
export function enemyDef(type) {
  return cached('enemy_' + type, () => {
    switch (type) {
      case 'slime': {
        const body = new GB(), face_ = new GB();
        const sl = new THREE.Color(0x8cc63a), sl2 = new THREE.Color(0xc8ec7a), t = new THREE.Color();
        body.sphere(0.38, 0, { y: 0.3, sy: 0.82, sx: 1.08, sz: 1.0, ws: 22, hs: 14, colorFn: (x, y, z, nx, ny) => t.copy(sl).lerp(sl2, Math.max(0, ny) * 0.8).getHex() });
        body.sphere(0.15, 0xe8ffd0, { x: -0.16, y: 0.48, z: 0.14, sx: 1.3, sy: 0.55, sz: 0.6, rz: 0.5, outline: false, glow: 0.4 });
        face_.cyl(0.012, 0.012, 0.08, 0x5a7a2a, { y: 0.63, seg: 5, outline: false });
        face_.sphere(0.1, 0x6fb03a, { x: 0.06, y: 0.68, sx: 1.3, sy: 0.25, rz: -0.35, ws: 10, hs: 5 });
        face(face_, { y: 0.34, z: 0.33, dx: 0.1, r: 0.045, bz: 0.32, by: 0.27, bdx: 0.18, mouthY: 0.24, mouthR: 0.03 });
        return buildRig([{ name: 'body', pivot: [0, 0, 0], b: body, transparent: true }, { name: 'face', parent: 'body', pivot: [0, 0, 0], b: face_ }]);
      }
      case 'mushroom': {
        const body = new GB(), cap = new GB(), legL = new GB(), legR = new GB();
        body.lathe([[0, 0.1], [0.24, 0.1], [0.27, 0.25], [0.24, 0.45], [0.18, 0.55], [0, 0.56]], 0xf6dcb8, { seg: 16 });
        face(body, { y: 0.34, z: 0.25, dx: 0.085, r: 0.038, angry: true, smile: false, by: 0.27, bdx: 0.16, bz: 0.23 });
        body.torus(0.03, 0.01, INK, { y: 0.23, z: 0.26, arc: Math.PI, ts: 8, rs: 4, outline: false });
        cap.sphere(0.38, 0xe2574c, { y: 0.52, sy: 0.72, t1: Math.PI * 0.58, ws: 18, hs: 10 });
        cap.lathe([[0.36, 0], [0.25, 0.06], [0, 0.08]], 0xf0d0a8, { y: 0.49, seg: 16 });
        for (const [a, th, r] of [[0, 0.5, 0.11], [1.6, 0.7, 0.09], [3.1, 0.6, 0.1], [4.5, 0.75, 0.09], [0.8, 1.1, 0.07], [2.4, 1.15, 0.07], [5.4, 0.25, 0.08]]) {
          cap.sphere(r * 0.85, 0xffe9d0, { x: Math.sin(a) * Math.sin(th) * 0.38, y: 0.52 + Math.cos(th) * 0.38 * 0.72, z: Math.cos(a) * Math.sin(th) * 0.38, sy: 0.35, rx: Math.cos(a) * th, rz: -Math.sin(a) * th, ws: 8, hs: 5, outline: false });
        }
        for (const [b, x] of [[legL, 0.11], [legR, -0.11]]) b.sphere(0.09, 0x8a5a3a, { x, y: 0.06, z: 0.03, sy: 0.7, sz: 1.2, ws: 10, hs: 8 });
        return buildRig([
          { name: 'body', pivot: [0, 0.1, 0], b: body }, { name: 'cap', parent: 'body', pivot: [0, 0.5, 0], b: cap },
          { name: 'legL', pivot: [0.11, 0.1, 0], b: legL }, { name: 'legR', pivot: [-0.11, 0.1, 0], b: legR },
        ]);
      }
      case 'bat': {
        const body = new GB(), wl = new GB(), wr = new GB();
        body.sphere(0.24, 0x7a5a8c, { y: 0, ws: 16, hs: 12 });
        body.sphere(0.16, 0x9a7aac, { y: -0.04, z: 0.12, sy: 0.9, sz: 0.5, outline: false });
        for (const sd of [-1, 1]) {
          body.cone(0.11, 0.26, 0x7a5a8c, { x: sd * 0.14, y: 0.24, rz: -sd * 0.35, seg: 8 });
          body.cone(0.065, 0.17, 0xf0a0b0, { x: sd * 0.135, y: 0.22, z: 0.035, rz: -sd * 0.35, seg: 8, sz: 0.4, outline: false });
          body.cone(0.02, 0.05, 0xffffff, { x: sd * 0.035, y: -0.09, z: 0.2, rx: Math.PI, seg: 4, outline: false });
        }
        face(body, { y: 0.03, z: 0.21, dx: 0.075, r: 0.035, by: -0.03, bdx: 0.13, bz: 0.19, smile: false });
        for (const [b, sd] of [[wl, 1], [wr, -1]]) {
          const wing = new THREE.Shape();
          wing.moveTo(0, 0.06); wing.lineTo(sd * 0.5, 0.16); wing.lineTo(sd * 0.6, -0.05); wing.quadraticCurveTo(sd * 0.48, 0.0, sd * 0.42, -0.12); wing.quadraticCurveTo(sd * 0.32, -0.04, sd * 0.24, -0.13); wing.quadraticCurveTo(sd * 0.14, -0.05, 0, -0.08); wing.closePath();
          b.shape(wing, 0.015, 0x8d6aa0, { x: sd * 0.16, bevel: 0.006 });
          b.cyl(0.015, 0.015, 0.5, 0x5a3a6c, { x: sd * 0.42, y: 0.11, rz: Math.PI / 2 - sd * 0.2, seg: 4, outline: false });
        }
        return buildRig([{ name: 'body', pivot: [0, 0, 0], b: body }, { name: 'wingL', parent: 'body', pivot: [0.16, 0.02, 0], b: wl }, { name: 'wingR', parent: 'body', pivot: [-0.16, 0.02, 0], b: wr }]);
      }
      case 'bee': {
        const body = new GB(), wl = new GB(), wr = new GB();
        body.sphere(0.25, 0, { ws: 20, hs: 14, colorFn: (x, y, z) => (z < -0.04 && Math.floor((z + 0.4) * 11) % 2 === 0 ? 0x3a2a20 : 0xffc93c) });
        body.cone(0.05, 0.12, 0x3a2a20, { z: -0.28, rx: -Math.PI / 2, seg: 6 });
        for (const sd of [-1, 1]) {
          body.cyl(0.01, 0.01, 0.2, 0x3a2a20, { x: sd * 0.08, y: 0.27, z: 0.08, rz: -sd * 0.3, seg: 4, outline: false });
          body.sphere(0.035, 0xffb020, { x: sd * 0.11, y: 0.37, z: 0.08, ws: 8, hs: 6 });
        }
        face(body, { y: 0.03, z: 0.23, dx: 0.08, r: 0.034, by: -0.03, bdx: 0.14, bz: 0.21, mouthR: 0.022, mouthY: -0.05 });
        for (const [b, sd] of [[wl, 1], [wr, -1]]) b.sphere(0.16, 0xf0f6ff, { x: sd * 0.14, y: 0.08, sx: 1.0, sy: 0.12, sz: 0.62, rz: sd * 0.5, glow: 0.35, ws: 12, hs: 6 });
        return buildRig([{ name: 'body', pivot: [0, 0, 0], b: body }, { name: 'wingL', parent: 'body', pivot: [0.06, 0.2, -0.04], b: wl }, { name: 'wingR', parent: 'body', pivot: [-0.06, 0.2, -0.04], b: wr }]);
      }
      case 'crab': {
        const body = new GB(), cl = new GB(), cr = new GB(), legs = new GB();
        body.sphere(0.36, 0xf07a3a, { y: 0.3, sy: 0.55, sz: 0.8, ws: 18, hs: 12 });
        body.sphere(0.28, 0xffc890, { y: 0.24, z: 0.08, sy: 0.4, sz: 0.65, outline: false });
        for (const sd of [-1, 1]) {
          body.cyl(0.025, 0.03, 0.2, 0xf07a3a, { x: sd * 0.12, y: 0.52, z: 0.1, seg: 6 });
          body.sphere(0.075, 0xffffff, { x: sd * 0.12, y: 0.63, z: 0.11, ws: 10, hs: 8 });
          body.sphere(0.04, INK, { x: sd * 0.12, y: 0.635, z: 0.17, ws: 8, hs: 6, outline: false });
          body.sphere(0.015, 0xffffff, { x: sd * 0.12 + 0.012, y: 0.65, z: 0.205, glow: 1, ws: 6, hs: 4, outline: false });
          body.sphere(0.045, 0xff9f9f, { x: sd * 0.2, y: 0.32, z: 0.25, sz: 0.3, sy: 0.6, ws: 8, hs: 5, outline: false });
          for (let k = 0; k < 3; k++) legs.cyl(0.025, 0.02, 0.32, 0xe06a2a, { x: sd * (0.33 + k * 0.02), y: 0.14, z: -0.15 + k * 0.13, rz: sd * 0.9, seg: 5 });
        }
        body.torus(0.04, 0.012, INK, { y: 0.3, z: 0.29, arc: Math.PI, rz: Math.PI, ts: 8, rs: 4, outline: false });
        for (const [b, sd] of [[cl, 1], [cr, -1]]) {
          b.cyl(0.04, 0.05, 0.22, 0xf07a3a, { x: sd * 0.4, y: 0.4, z: 0.12, rz: sd * 0.6, seg: 6 });
          b.sphere(0.13, 0xf07a3a, { x: sd * 0.5, y: 0.55, z: 0.15, sy: 0.85, ws: 12, hs: 10 });
          b.cone(0.06, 0.17, 0xf58a4a, { x: sd * 0.53, y: 0.7, z: 0.2, rx: 0.3, seg: 6 });
          b.cone(0.05, 0.14, 0xf58a4a, { x: sd * 0.44, y: 0.69, z: 0.2, rx: 0.3, rz: sd * 0.3, seg: 6 });
        }
        return buildRig([{ name: 'body', pivot: [0, 0, 0], b: body }, { name: 'legs', parent: 'body', pivot: [0, 0.15, 0], b: legs }, { name: 'clawL', parent: 'body', pivot: [0.35, 0.38, 0.1], b: cl }, { name: 'clawR', parent: 'body', pivot: [-0.35, 0.38, 0.1], b: cr }]);
      }
      case 'snowpuff': {
        const body = new GB(), top = new GB();
        const puffs = [[0, 0.35, 0, 0.32], [0.22, 0.3, 0.05, 0.22], [-0.22, 0.3, 0.05, 0.22], [0.15, 0.5, -0.05, 0.2], [-0.15, 0.52, -0.05, 0.2], [0, 0.18, 0.05, 0.22], [0.25, 0.42, -0.12, 0.18], [-0.25, 0.42, -0.12, 0.18], [0, 0.55, 0.08, 0.2]];
        const wc = new THREE.Color(0xdbe8f8), wc2 = new THREE.Color(0xffffff), t = new THREE.Color();
        for (const [x, y, z, r] of puffs) body.sphere(r, 0, { x, y, z, ws: 14, hs: 10, colorFn: (a, b2, c, nx, ny) => t.copy(wc).lerp(wc2, ny * 0.5 + 0.5).getHex() });
        face(body, { y: 0.36, z: 0.3, dx: 0.09, r: 0.036, angry: true, blushCol: 0x9cc8f0, by: 0.3, bdx: 0.16, bz: 0.29, mouthY: 0.27, mouthR: 0.025 });
        top.add(new THREE.OctahedronGeometry(0.1, 0), 0xa8e0ff, { y: 0.78, sy: 1.7, flat: true, glow: 0.35 });
        top.add(new THREE.OctahedronGeometry(0.06, 0), 0xc8f0ff, { x: 0.08, y: 0.72, rz: -0.6, sy: 1.6, flat: true, glow: 0.35 });
        top.add(new THREE.OctahedronGeometry(0.06, 0), 0xc8f0ff, { x: -0.08, y: 0.72, rz: 0.6, sy: 1.6, flat: true, glow: 0.35 });
        for (const [x, y, r] of [[0.05, 0.02, 0.05], [-0.06, -0.06, 0.035], [0.02, -0.12, 0.025]]) body.sphere(r, 0xffffff, { x, y, z: 0.05, ws: 8, hs: 6 });
        return buildRig([{ name: 'body', pivot: [0, 0, 0], b: body }, { name: 'top', parent: 'body', pivot: [0, 0.7, 0], b: top }]);
      }
    }
    return null;
  });
}

// ---------------------------------------------------------------- NPCs
export function npcDef(id) {
  return cached('npc_' + id, () => {
    const body = new GB(), head = new GB(), armL = new GB(), armR = new GB(), extra = new GB();
    let headPivot = [0, 0.55, 0];
    switch (id) {
      case 'ribbit': { // frog mayor
        const GR = 0x8cbf4a;
        body.lathe([[0, 0.05], [0.26, 0.05], [0.28, 0.2], [0.22, 0.45], [0, 0.5]], 0x8a2f2a, { seg: 16 });
        body.sphere(0.17, 0xf4e8b0, { y: 0.3, z: 0.13, sy: 1.1, sz: 0.5, outline: false });
        for (const sd of [-1, 1]) {
          body.cone(0.06, 0.12, 0xd83a3a, { x: sd * 0.06, y: 0.47, z: 0.18, rz: sd * Math.PI / 2, seg: 8 });
          body.sphere(0.08, GR, { x: sd * 0.12, y: 0.05, z: 0.1, sy: 0.4, sz: 1.5, ws: 10, hs: 6 });
          body.box(0.03, 0.08, 0.02, 0xf5c040, { x: sd * 0.2, y: 0.32, z: 0.2, outline: false });
        }
        body.sphere(0.035, 0xd83a3a, { y: 0.47, z: 0.2, ws: 8, hs: 6 });
        body.cyl(0.05, 0.05, 0.015, 0xf5c040, { y: 0.36, z: 0.2, rx: Math.PI / 2, seg: 12, glow: 0.2, outline: false });
        head.sphere(0.28, GR, { y: 0.72, sy: 0.75, ws: 20, hs: 14 });
        head.sphere(0.22, 0xf4e8b0, { y: 0.66, z: 0.1, sy: 0.55, sz: 0.7, outline: false });
        for (const sd of [-1, 1]) {
          head.sphere(0.11, GR, { x: sd * 0.14, y: 0.9, z: 0.08, ws: 14, hs: 10 });
          head.sphere(0.075, 0xffffff, { x: sd * 0.14, y: 0.91, z: 0.15, ws: 12, hs: 10, outline: false });
          head.sphere(0.045, INK, { x: sd * 0.14, y: 0.91, z: 0.205, sy: 1.2, ws: 10, hs: 8, outline: false });
          head.sphere(0.016, 0xffffff, { x: sd * 0.14 + 0.012, y: 0.93, z: 0.245, glow: 1, ws: 6, hs: 4, outline: false });
          head.sphere(0.05, 0xff9f9f, { x: sd * 0.2, y: 0.7, z: 0.2, sz: 0.3, sy: 0.6, ws: 8, hs: 5, outline: false });
        }
        head.torus(0.12, 0.012, INK, { y: 0.71, z: 0.22, arc: Math.PI, rz: Math.PI, ts: 14, rs: 4, outline: false });
        // monocle
        head.torus(0.085, 0.014, 0xf5c040, { x: 0.14, y: 0.91, z: 0.215, ts: 16, rs: 5, glow: 0.2 });
        head.cyl(0.004, 0.004, 0.3, 0xf5c040, { x: 0.22, y: 0.76, z: 0.2, rz: 0.2, seg: 3, outline: false });
        // top hat
        head.cyl(0.2, 0.2, 0.025, 0x4a3028, { y: 1.0, seg: 18 });
        head.cyl(0.12, 0.13, 0.22, 0x4a3028, { y: 1.12, seg: 16 });
        head.cyl(0.132, 0.132, 0.045, 0xd83a3a, { y: 1.05, seg: 16, outline: false });
        headPivot = [0, 0.5, 0];
        for (const [b, sd] of [[armL, 1], [armR, -1]]) { b.capsule(0.05, 0.12, 0x8a2f2a, { x: sd * 0.26, y: 0.32, rz: sd * 0.4 }); b.sphere(0.055, GR, { x: sd * 0.3, y: 0.22, ws: 10, hs: 8 }); }
        break;
      }
      case 'clover': { // bunny
        const CR = 0xfff1dc;
        body.lathe([[0, 0.05], [0.2, 0.05], [0.21, 0.2], [0.16, 0.42], [0, 0.45]], 0xf6e6c4, { seg: 16 });
        body.torus(0.12, 0.05, 0xf59aa8, { y: 0.44, rx: Math.PI / 2, ts: 16, rs: 6 });
        body.rbox(0.07, 0.18, 0.03, 0xf59aa8, { x: 0.08, y: 0.33, z: 0.15, rz: 0.2, radius: 0.012 });
        body.rbox(0.13, 0.1, 0.06, 0xa86a3a, { x: -0.16, y: 0.2, z: 0.1, radius: 0.02 });
        for (const sd of [-1, 1]) body.sphere(0.07, CR, { x: sd * 0.08, y: 0.05, z: 0.06, sy: 0.6, sz: 1.3, ws: 10, hs: 6 });
        head.sphere(0.24, CR, { y: 0.66, sy: 0.92, ws: 20, hs: 14 });
        for (const sd of [-1, 1]) {
          head.capsule(0.065, 0.3, CR, { x: sd * 0.1, y: 1.03, rz: -sd * 0.18 });
          head.capsule(0.035, 0.22, 0xf8b8c0, { x: sd * 0.105, y: 1.03, z: 0.04, rz: -sd * 0.18, sz: 0.5, outline: false });
        }
        face(head, { y: 0.66, z: 0.225, dx: 0.085, r: 0.038, by: 0.6, bdx: 0.14, bz: 0.205, mouthY: 0.57, mouthR: 0.022 });
        head.sphere(0.022, 0xff8a9a, { y: 0.62, z: 0.24, ws: 8, hs: 6, outline: false });
        // flower crown
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI - Math.PI / 2;
          const c = [0xff8fa8, 0xffffff, 0xffd85a][i % 3];
          head.sphere(0.045, c, { x: Math.sin(a) * 0.2, y: 0.84 + Math.cos(a) * 0.02, z: Math.cos(a) * 0.1, ws: 8, hs: 6, outline: false, glow: 0.1 });
          head.sphere(0.03, 0x7cc048, { x: Math.sin(a + 0.15) * 0.21, y: 0.83, z: Math.cos(a + 0.15) * 0.1 - 0.02, sx: 1.4, sy: 0.5, ws: 6, hs: 4, outline: false });
        }
        for (const [b, sd] of [[armL, 1], [armR, -1]]) { b.capsule(0.045, 0.1, CR, { x: sd * 0.2, y: 0.3, rz: sd * 0.4 }); }
        headPivot = [0, 0.46, 0];
        break;
      }
      case 'shellby': { // turtle elder
        const SK = 0xa8b860;
        body.lathe([[0, 0.05], [0.24, 0.05], [0.26, 0.2], [0.2, 0.45], [0, 0.5]], 0xf0e2c0, { seg: 16 });
        body.sphere(0.36, 0, { y: 0.4, z: -0.2, sz: 0.7, ws: 18, hs: 12, colorFn: (x, y, z, nx, ny) => (ny > 0.35 && (Math.sin(x * 30) + Math.cos(y * 25)) > -0.3 ? 0x7aa63a : 0x8a6a3a) });
        body.torus(0.3, 0.04, 0x6a4a28, { y: 0.4, z: -0.12, ts: 20, rs: 6, sy: 1.15 });
        for (const [x, y, r] of [[0.1, 0.73, 0.06], [-0.18, 0.66, 0.05]]) { body.cyl(0.015, 0.02, 0.06, 0xfff0d8, { x, y, z: -0.25, seg: 5, outline: false }); body.sphere(r, 0xf0c890, { x, y: y + 0.04, z: -0.25, sy: 0.55, ws: 8, hs: 5 }); }
        body.sphere(0.07, 0x7cc048, { y: 0.42, z: 0.18, sx: 1.4, sy: 0.5, ws: 8, hs: 5 });
        for (const sd of [-1, 1]) body.sphere(0.08, SK, { x: sd * 0.12, y: 0.05, z: 0.08, sy: 0.6, sz: 1.3, ws: 10, hs: 6 });
        head.sphere(0.21, SK, { y: 0.66, ws: 18, hs: 14 });
        head.cone(0.14, 0.28, 0xfaf6ec, { y: 0.47, z: 0.13, rx: Math.PI, seg: 10 });
        head.sphere(0.13, 0xfaf6ec, { y: 0.56, z: 0.14, sx: 1.3, sy: 0.55, ws: 12, hs: 8 });
        for (const sd of [-1, 1]) {
          head.torus(0.035, 0.011, INK, { x: sd * 0.075, y: 0.68, z: 0.2, arc: Math.PI, ts: 8, rs: 4, outline: false });
          head.sphere(0.04, 0xff9f9f, { x: sd * 0.12, y: 0.63, z: 0.18, sz: 0.3, sy: 0.6, ws: 8, hs: 5, outline: false });
          head.sphere(0.05, 0xfaf6ec, { x: sd * 0.08, y: 0.76, z: 0.17, sx: 1.4, sy: 0.5, rz: sd * 0.3, ws: 8, hs: 5 });
        }
        headPivot = [0, 0.52, 0];
        extra.cyl(0.025, 0.03, 1.05, 0x8a5a30, { x: -0.3, y: 0.52, z: 0.15, seg: 6 });
        extra.torus(0.08, 0.025, 0x8a5a30, { x: -0.36, y: 1.06, z: 0.15, arc: Math.PI * 1.4, ts: 10, rs: 5 });
        extra.sphere(0.05, 0x7cc048, { x: -0.26, y: 0.95, z: 0.15, sx: 1.5, sy: 0.4, rz: 0.4, ws: 8, hs: 5 });
        for (const [b, sd] of [[armL, 1], [armR, -1]]) { b.capsule(0.05, 0.1, 0xf0e2c0, { x: sd * 0.24, y: 0.3, rz: sd * 0.3 }); b.sphere(0.05, SK, { x: sd * 0.28, y: 0.21, ws: 10, hs: 8 }); }
        break;
      }
      case 'miso': { // cat shopkeeper
        const OR = 0xf5a050, ST = 0xd9783a;
        body.lathe([[0, 0.05], [0.24, 0.05], [0.25, 0.2], [0.2, 0.45], [0, 0.5]], 0xfff0d8, { seg: 16 });
        body.lathe([[0, 0.06], [0.255, 0.06], [0.26, 0.2], [0.22, 0.36], [0, 0.37]], 0x6f8f3a, { seg: 16, sz: 0.85 });
        body.sphere(0.06, 0xf5c040, { x: 0.1, y: 0.2, z: 0.2, ws: 8, hs: 6, glow: 0.15 });
        for (const sd of [-1, 1]) body.sphere(0.08, OR, { x: sd * 0.12, y: 0.05, z: 0.08, sy: 0.6, sz: 1.3, ws: 10, hs: 6 });
        body.tube([[0, 0.15, -0.2], [0.12, 0.2, -0.35], [0.22, 0.45, -0.32], [0.18, 0.62, -0.25]], 0.05, 0, { tseg: 16, rs: 6, colorFn: (x, y) => (Math.floor(y * 14) % 2 ? OR : ST) });
        head.sphere(0.25, 0, { y: 0.7, sy: 0.88, sx: 1.08, ws: 20, hs: 14, colorFn: (x, y, z) => (z < 0.1 && Math.abs(x) < 0.12 && y > 0.78 && Math.floor(x * 30 + 10) % 2 ? ST : OR) });
        head.sphere(0.13, 0xfff0d8, { y: 0.63, z: 0.13, sy: 0.6, sz: 0.7, outline: false });
        for (const sd of [-1, 1]) {
          head.cone(0.1, 0.17, OR, { x: sd * 0.16, y: 0.92, rz: -sd * 0.35, seg: 8 });
          head.cone(0.06, 0.11, 0xffb8c0, { x: sd * 0.155, y: 0.91, z: 0.03, rz: -sd * 0.35, seg: 8, sz: 0.4, outline: false });
          for (let k = 0; k < 2; k++) head.box(0.12, 0.008, 0.008, INK, { x: sd * 0.24, y: 0.63 - k * 0.03, z: 0.18, rz: sd * (0.15 - k * 0.25), outline: false });
        }
        // happy closed eyes ^^
        for (const sd of [-1, 1]) head.torus(0.035, 0.011, INK, { x: sd * 0.085, y: 0.7, z: 0.235, arc: Math.PI, ts: 8, rs: 4, outline: false });
        for (const sd of [-1, 1]) head.sphere(0.04, 0xff9f9f, { x: sd * 0.15, y: 0.64, z: 0.21, sz: 0.3, sy: 0.6, ws: 8, hs: 5, outline: false });
        head.sphere(0.022, 0xff8a9a, { y: 0.655, z: 0.255, ws: 8, hs: 6, outline: false });
        head.torus(0.035, 0.01, INK, { y: 0.61, z: 0.245, arc: Math.PI, rz: Math.PI, ts: 8, rs: 4, outline: false });
        // bandana
        head.sphere(0.255, 0xfff3e0, { y: 0.74, sy: 0.88, sx: 1.09, t1: Math.PI * 0.32, ws: 20, hs: 6, rx: -0.25 });
        head.sphere(0.06, 0xfff3e0, { x: 0.25, y: 0.75, z: -0.08, sx: 1.4, sy: 0.7, ws: 8, hs: 6 });
        headPivot = [0, 0.5, 0];
        for (const [b, sd] of [[armL, 1], [armR, -1]]) { b.capsule(0.05, 0.1, 0xfff0d8, { x: sd * 0.25, y: 0.33, rz: sd * 0.4 }); b.sphere(0.055, OR, { x: sd * 0.29, y: 0.24, ws: 10, hs: 8 }); }
        break;
      }
      case 'hoot': { // owl professor
        const BR = 0x8a5a3a;
        body.sphere(0.3, BR, { y: 0.35, sy: 1.05, ws: 18, hs: 14 });
        body.sphere(0.2, 0xf0d8b0, { y: 0.33, z: 0.16, sy: 1.2, sz: 0.55, outline: false });
        body.add(new THREE.ConeGeometry(0.34, 0.5, 16, 1, true), 0x6a3a5a, { y: 0.38, z: -0.03 });
        for (const sd of [-1, 1]) body.sphere(0.07, 0xf5a040, { x: sd * 0.1, y: 0.04, z: 0.1, sy: 0.5, sz: 1.3, ws: 10, hs: 6 });
        head.sphere(0.26, BR, { y: 0.78, sx: 1.08, sy: 0.9, ws: 20, hs: 14 });
        head.sphere(0.2, 0xf0d8b0, { y: 0.76, z: 0.1, sx: 1.2, sy: 0.75, sz: 0.7, outline: false });
        for (const sd of [-1, 1]) {
          head.sphere(0.075, 0xffffff, { x: sd * 0.1, y: 0.79, z: 0.21, sz: 0.5, ws: 12, hs: 10, outline: false });
          head.sphere(0.045, INK, { x: sd * 0.1, y: 0.79, z: 0.24, sy: 1.1, ws: 10, hs: 8, outline: false });
          head.sphere(0.015, 0xffffff, { x: sd * 0.1 + 0.012, y: 0.81, z: 0.265, glow: 1, ws: 6, hs: 4, outline: false });
          head.torus(0.085, 0.012, 0xf5c040, { x: sd * 0.1, y: 0.79, z: 0.25, ts: 16, rs: 4, glow: 0.15 });
          head.cone(0.07, 0.14, BR, { x: sd * 0.18, y: 1.0, rz: -sd * 0.5, seg: 6 });
        }
        head.cone(0.035, 0.07, 0xf5a040, { y: 0.71, z: 0.26, rx: Math.PI / 2 + 0.6, seg: 6 });
        // grad cap
        head.cyl(0.16, 0.17, 0.08, 0x3a2a2a, { y: 1.0, seg: 14 });
        head.box(0.4, 0.03, 0.4, 0x3a2a2a, { y: 1.06, ry: Math.PI / 4 });
        head.cyl(0.006, 0.006, 0.14, 0xf5c040, { x: 0.18, y: 0.99, z: 0.04, seg: 3, outline: false });
        head.sphere(0.025, 0xf5c040, { x: 0.18, y: 0.92, z: 0.04, ws: 6, hs: 4, glow: 0.2, outline: false });
        headPivot = [0, 0.62, 0];
        armL.sphere(0.12, BR, { x: 0.27, y: 0.38, sx: 0.5, sy: 1.3, rz: 0.2, ws: 10, hs: 8 });
        armR.sphere(0.12, BR, { x: -0.27, y: 0.38, sx: 0.5, sy: 1.3, rz: -0.2, ws: 10, hs: 8 });
        armR.rbox(0.2, 0.26, 0.07, 0x5a7a3a, { x: -0.2, y: 0.35, z: 0.18, radius: 0.02, ry: 0.3 });
        armR.sphere(0.04, 0x9ad04e, { x: -0.17, y: 0.36, z: 0.225, sx: 1.3, sy: 0.6, ws: 8, hs: 5, outline: false, ry: 0.3 });
        break;
      }
      case 'digby': { // mole miner
        const BR = 0x7a5240;
        body.lathe([[0, 0.05], [0.25, 0.05], [0.26, 0.2], [0.21, 0.42], [0, 0.46]], 0x4a6a9a, { seg: 16 });
        body.sphere(0.18, 0xf0e2c0, { y: 0.4, z: 0.08, sy: 0.6, sz: 0.8, outline: false });
        for (const sd of [-1, 1]) {
          body.box(0.04, 0.2, 0.02, 0x3a5a8a, { x: sd * 0.1, y: 0.38, z: 0.2, outline: false });
          body.sphere(0.03, 0xf5c040, { x: sd * 0.1, y: 0.42, z: 0.215, ws: 6, hs: 4, outline: false });
          body.sphere(0.085, 0x5a3a2a, { x: sd * 0.12, y: 0.05, z: 0.08, sy: 0.6, sz: 1.3, ws: 10, hs: 6 });
        }
        body.torus(0.235, 0.02, 0x8a5a30, { y: 0.24, rx: Math.PI / 2, ts: 18, rs: 4, outline: false });
        head.sphere(0.24, BR, { y: 0.66, ws: 20, hs: 14 });
        head.sphere(0.13, 0xc8a080, { y: 0.6, z: 0.14, sy: 0.65, sz: 0.7, outline: false });
        head.sphere(0.055, 0xf0a0a0, { y: 0.63, z: 0.26, ws: 10, hs: 8 });
        face(head, { y: 0.69, z: 0.215, dx: 0.085, r: 0.026, by: 0.6, bdx: 0.15, bz: 0.2, mouthY: 0.57, mouthR: 0.025 });
        // helmet + lamp
        head.sphere(0.26, 0xf5c030, { y: 0.7, t1: Math.PI * 0.5, ws: 20, hs: 8 });
        head.cyl(0.29, 0.3, 0.035, 0xe0a820, { y: 0.71, seg: 20 });
        head.cyl(0.07, 0.07, 0.07, 0xa08020, { y: 0.88, z: 0.2, rx: Math.PI / 2 - 0.4, seg: 12 });
        head.cyl(0.055, 0.055, 0.02, 0xfff4b0, { y: 0.9, z: 0.235, rx: Math.PI / 2 - 0.4, seg: 12, glow: 1.0, outline: false });
        headPivot = [0, 0.48, 0];
        armL.capsule(0.05, 0.1, BR, { x: 0.25, y: 0.32, rz: 0.4 });
        armR.capsule(0.05, 0.1, BR, { x: -0.25, y: 0.32, rz: -0.4 });
        extra.cyl(0.022, 0.022, 0.8, 0x9a6438, { x: -0.36, y: 0.5, z: 0.12, seg: 6 });
        extra.box(0.16, 0.2, 0.03, 0xa0a0a8, { x: -0.36, y: 0.1, z: 0.12 });
        extra.cone(0.08, 0.08, 0xa0a0a8, { x: -0.36, y: -0.03, z: 0.12, rx: Math.PI, seg: 4, sz: 0.2, ry: Math.PI / 4 });
        break;
      }
    }
    const spec = [
      { name: 'body', pivot: [0, 0, 0], b: body },
      { name: 'head', parent: 'body', pivot: headPivot, b: head },
      { name: 'armL', parent: 'body', pivot: [0.2, 0.42, 0], b: armL },
      { name: 'armR', parent: 'body', pivot: [-0.2, 0.42, 0], b: armR },
    ];
    if (!extra.empty) spec.push({ name: 'extra', parent: 'body', pivot: [0, 0, 0], b: extra });
    return buildRig(spec);
  });
}

// ---------------------------------------------------------------- boss fallbacks (~3 m)
export function bossDef(id) {
  return cached('boss_' + id, () => {
    const body = new GB(), head = new GB(), armL = new GB(), armR = new GB(), legL = new GB(), legR = new GB();
    if (id === 'woods') {
      // Grumble Shroom: purple/gold mushroom king
      body.lathe([[0, 0.2], [0.95, 0.2], [1.05, 0.6], [0.95, 1.3], [0.7, 1.75], [0, 1.8]], 0xf5d0b0, { seg: 20 });
      for (const [x, y, z, r] of [[0.7, 0.5, 0.5, 0.25], [-0.8, 0.8, 0.4, 0.22], [0.5, 1.2, -0.7, 0.2]]) body.sphere(r, 0x8ab040, { x, y, z, sy: 0.5, ws: 10, hs: 6 });
      // face
      face(body, { y: 1.3, z: 0.86, dx: 0.28, r: 0.1, angry: true, smile: false, by: 1.08, bdx: 0.5, bz: 0.78, browY: 1.5 });
      // moustache + beard
      for (const sd of [-1, 1]) body.sphere(0.28, 0xfff6ea, { x: sd * 0.25, y: 1.02, z: 0.85, sx: 1.4, sy: 0.55, sz: 0.6, rz: sd * 0.35, ws: 14, hs: 8 });
      body.cone(0.45, 0.75, 0xfff6ea, { y: 0.62, z: 0.78, rx: Math.PI + 0.25, seg: 12, sz: 0.6 });
      for (const [b, x] of [[legL, 0.45], [legR, -0.45]]) b.sphere(0.32, 0x8a5a3a, { x, y: 0.18, z: 0.15, sy: 0.6, sz: 1.3, ws: 12, hs: 8 });
      for (const [b, sd] of [[armL, 1], [armR, -1]]) { b.capsule(0.18, 0.4, 0xf5d0b0, { x: sd * 1.05, y: 0.95, rz: sd * 0.5 }); b.sphere(0.2, 0xf5d0b0, { x: sd * 1.25, y: 0.62, ws: 12, hs: 10 }); }
      // cap (head node)
      const capC = new THREE.Color(0x8a4a8a), capC2 = new THREE.Color(0xb06ab0), t = new THREE.Color();
      head.sphere(1.65, 0, { y: 1.75, sy: 0.68, t1: Math.PI * 0.58, ws: 26, hs: 14, colorFn: (x, y, z, nx, ny) => t.copy(capC).lerp(capC2, ny * 0.6).getHex() });
      head.lathe([[1.6, 0], [1.1, 0.2], [0, 0.25]], 0xf0d0b0, { y: 1.68, seg: 24 });
      for (const [a, th, r] of [[0, 0.55, 0.4], [1.7, 0.75, 0.35], [3.3, 0.6, 0.38], [4.7, 0.8, 0.33], [0.9, 1.15, 0.25], [2.5, 1.2, 0.25], [4.0, 1.15, 0.24], [5.6, 1.15, 0.24]]) {
        head.sphere(r, 0xf5c040, { x: Math.sin(a) * Math.sin(th) * 1.65, y: 1.75 + Math.cos(th) * 1.65 * 0.68, z: Math.cos(a) * Math.sin(th) * 1.65, sy: 0.3, rx: Math.cos(a) * th, rz: -Math.sin(a) * th, ws: 10, hs: 6, outline: false });
      }
      for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; head.sphere(0.2, 0x8ab040, { x: Math.sin(a) * 1.55, y: 1.65, z: Math.cos(a) * 1.55, sy: 0.6, ws: 8, hs: 6 }); }
      // crown
      head.cyl(0.5, 0.55, 0.3, 0xf5c040, { y: 2.95, seg: 14, glow: 0.15 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; head.cone(0.13, 0.32, 0xf5c040, { x: Math.sin(a) * 0.47, y: 3.25, z: Math.cos(a) * 0.47, seg: 6, glow: 0.15 }); head.sphere(0.06, 0xff4a5a, { x: Math.sin(a) * 0.47, y: 3.43, z: Math.cos(a) * 0.47, glow: 0.4, ws: 6, hs: 4, outline: false }); }
      head.sphere(0.11, 0xff4a5a, { y: 2.95, z: 0.53, glow: 0.5, ws: 8, hs: 6, outline: false });
      // baby shroom on cap
      head.cyl(0.06, 0.08, 0.2, 0xfff0d8, { x: 0.9, y: 2.75, z: 0.2, seg: 6 });
      head.sphere(0.18, 0xe2574c, { x: 0.9, y: 2.85, z: 0.2, t1: Math.PI * 0.55, sy: 0.7, ws: 10, hs: 6 });
      return buildRig([
        { name: 'body', pivot: [0, 0.2, 0], b: body }, { name: 'head', parent: 'body', pivot: [0, 1.7, 0], b: head },
        { name: 'armL', parent: 'body', pivot: [0.9, 1.25, 0], b: armL }, { name: 'armR', parent: 'body', pivot: [-0.9, 1.25, 0], b: armR },
        { name: 'legL', pivot: [0.45, 0.3, 0], b: legL }, { name: 'legR', pivot: [-0.45, 0.3, 0], b: legR },
      ]);
    }
    if (id === 'shores') {
      // Captain Pinch: giant red crab with pirate hat
      const RED = 0xe05a40;
      body.sphere(1.3, RED, { y: 1.0, sy: 0.6, sz: 0.85, ws: 24, hs: 16 });
      body.sphere(1.0, 0xffd0a0, { y: 0.85, z: 0.25, sy: 0.45, sz: 0.7, outline: false });
      body.shape(starShape(0.22, 0.1), 0.05, 0xf5c040, { x: -0.5, y: 0.95, z: 1.02, rx: -0.2, glow: 0.2, outline: false });
      for (const [x, y, z] of [[0.6, 1.4, 0.7], [0.75, 1.25, 0.8], [0.5, 1.25, 0.9]]) body.sphere(0.12, 0xe8dcc8, { x, y, z, sy: 0.6, ws: 8, hs: 6 });
      for (const sd of [-1, 1]) {
        body.cyl(0.07, 0.09, 0.55, RED, { x: sd * 0.4, y: 1.55, z: 0.45, seg: 8 });
        body.sphere(0.22, 0xffffff, { x: sd * 0.4, y: 1.88, z: 0.5, ws: 14, hs: 10 });
        body.sphere(0.12, INK, { x: sd * 0.4, y: 1.86, z: 0.68, ws: 10, hs: 8, outline: false });
        body.sphere(0.04, 0xffffff, { x: sd * 0.4 + 0.04, y: 1.9, z: 0.79, glow: 1, ws: 6, hs: 4, outline: false });
        body.box(0.32, 0.07, 0.07, INK, { x: sd * 0.38, y: 2.08, z: 0.6, rz: sd * 0.5, outline: false });
        body.sphere(0.13, 0xff9f9f, { x: sd * 0.75, y: 1.05, z: 0.95, sz: 0.3, sy: 0.6, ws: 8, hs: 5, outline: false });
      }
      body.torus(0.18, 0.035, INK, { y: 0.98, z: 1.05, arc: Math.PI, ts: 10, rs: 4, outline: false });
      // pirate hat
      body.cyl(0.5, 0.6, 0.35, 0x3a2a3a, { y: 1.7, z: -0.2, seg: 16, sx: 1.4 });
      body.box(1.5, 0.2, 0.5, 0x3a2a3a, { y: 1.62, z: -0.05, rx: -0.2 });
      body.box(1.55, 0.06, 0.08, 0xf5c040, { y: 1.68, z: 0.2, rx: -0.2, glow: 0.15 });
      body.torus(0.12, 0.03, 0xf5c040, { y: 1.88, z: 0.08, ts: 12, rs: 4, glow: 0.15, outline: false });
      body.sphere(0.25, 0xffffff, { x: 0.45, y: 2.1, z: -0.3, sx: 0.4, sy: 1.6, rz: -0.5, ws: 8, hs: 6 });
      for (let k = 0; k < 4; k++) for (const [b, sd] of [[legL, 1], [legR, -1]]) {
        b.cyl(0.09, 0.07, 1.0, 0xd04a30, { x: sd * (1.2 + k * 0.05), y: 0.45, z: -0.55 + k * 0.38, rz: sd * 0.85, seg: 6 });
      }
      for (const [b, sd] of [[armL, 1], [armR, -1]]) {
        b.cyl(0.14, 0.16, 0.7, RED, { x: sd * 1.35, y: 1.25, z: 0.5, rz: sd * 0.9, seg: 8 });
        b.sphere(0.5, RED, { x: sd * 1.75, y: 1.75, z: 0.65, sy: 0.85, ws: 16, hs: 12 });
        b.cone(0.24, 0.6, 0xf07050, { x: sd * 1.85, y: 2.3, z: 0.8, rx: 0.25, seg: 8 });
        b.cone(0.2, 0.5, 0xf07050, { x: sd * 1.55, y: 2.25, z: 0.85, rx: 0.3, rz: sd * 0.35, seg: 8 });
      }
      return buildRig([
        { name: 'body', pivot: [0, 0.3, 0], b: body }, { name: 'head', parent: 'body', pivot: [0, 1.6, 0], b: head },
        { name: 'armL', parent: 'body', pivot: [1.1, 1.1, 0.4], b: armL }, { name: 'armR', parent: 'body', pivot: [-1.1, 1.1, 0.4], b: armR },
        { name: 'legL', parent: 'body', pivot: [1.0, 0.6, 0], b: legL }, { name: 'legR', parent: 'body', pivot: [-1.0, 0.6, 0], b: legR },
      ]);
    }
    // Frostbun: giant fluffy yeti bunny
    const W1 = new THREE.Color(0xe6eef8), W2 = new THREE.Color(0xffffff), t = new THREE.Color();
    const fluff = (x, y, z, nx, ny) => t.copy(W1).lerp(W2, ny * 0.5 + 0.5).getHex();
    body.sphere(1.25, 0, { y: 1.25, sy: 1.05, ws: 22, hs: 16, colorFn: fluff });
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; body.sphere(0.45, 0, { x: Math.sin(a) * 1.1, y: 0.85 + (i % 3) * 0.35, z: Math.cos(a) * 1.0, ws: 12, hs: 9, colorFn: fluff }); }
    body.sphere(0.9, 0xf8f4f0, { y: 1.1, z: 0.5, sy: 1.0, sz: 0.6, outline: false });
    for (const sd of [-1, 1]) {
      body.add(new THREE.OctahedronGeometry(0.28, 0), 0xa8dcff, { x: sd * 1.15, y: 1.9, z: -0.1, sy: 1.8, rz: -sd * 0.6, flat: true, glow: 0.3 });
      body.add(new THREE.OctahedronGeometry(0.18, 0), 0xc8ecff, { x: sd * 1.3, y: 1.6, z: 0.2, sy: 1.6, rz: -sd * 0.9, flat: true, glow: 0.3 });
    }
    head.sphere(0.85, 0, { y: 2.55, ws: 22, hs: 16, colorFn: fluff });
    face(head, { y: 2.6, z: 0.8, dx: 0.28, r: 0.09, angry: true, smile: false, blushCol: 0x9cc8f0, by: 2.38, bdx: 0.48, bz: 0.74, browY: 2.8 });
    head.torus(0.1, 0.025, INK, { y: 2.3, z: 0.84, arc: Math.PI, ts: 10, rs: 4, outline: false });
    head.sphere(0.07, 0xffb0c0, { y: 2.45, z: 0.86, ws: 8, hs: 6, outline: false });
    for (const sd of [-1, 1]) {
      head.capsule(0.22, 1.1, 0xffffff, { x: sd * 0.42, y: 3.65, rz: -sd * 0.22 });
      head.capsule(0.12, 0.8, 0xffc0cc, { x: sd * 0.43, y: 3.6, z: 0.12, rz: -sd * 0.22, sz: 0.4, outline: false });
      head.cone(0.24, 0.35, 0xa8dcff, { x: sd * 0.57, y: 4.25, rz: -sd * 0.22, seg: 8, glow: 0.3 });
      for (let k = 0; k < 3; k++) head.cone(0.06, 0.2, 0xc8ecff, { x: sd * (0.5 + k * 0.08), y: 4.05 - k * 0.06, z: 0.15, rx: Math.PI, seg: 5, glow: 0.3, outline: false });
    }
    for (const [b, sd] of [[legL, 1], [legR, -1]]) {
      b.sphere(0.45, 0xffffff, { x: sd * 0.6, y: 0.3, z: 0.25, sy: 0.65, sz: 1.3, ws: 14, hs: 10 });
      b.sphere(0.2, 0x7a9cd8, { x: sd * 0.6, y: 0.28, z: 0.78, sz: 0.4, ws: 10, hs: 8, outline: false });
      for (let k = 0; k < 3; k++) b.sphere(0.08, 0x7a9cd8, { x: sd * 0.6 + (k - 1) * 0.15, y: 0.48, z: 0.76, sz: 0.4, ws: 6, hs: 4, outline: false });
    }
    for (const [b, sd] of [[armL, 1], [armR, -1]]) {
      b.capsule(0.32, 0.6, 0xffffff, { x: sd * 1.35, y: 1.3, rz: sd * 0.35 });
      b.sphere(0.36, 0xf4f8ff, { x: sd * 1.5, y: 0.8, z: 0.1, ws: 12, hs: 10 });
      b.sphere(0.16, 0x7a9cd8, { x: sd * 1.5, y: 0.75, z: 0.43, sz: 0.4, ws: 8, hs: 6, outline: false });
    }
    return buildRig([
      { name: 'body', pivot: [0, 0.4, 0], b: body }, { name: 'head', parent: 'body', pivot: [0, 2.0, 0], b: head },
      { name: 'armL', parent: 'body', pivot: [1.2, 1.7, 0], b: armL }, { name: 'armR', parent: 'body', pivot: [-1.2, 1.7, 0], b: armR },
      { name: 'legL', pivot: [0.6, 0.4, 0], b: legL }, { name: 'legR', pivot: [-0.6, 0.4, 0], b: legR },
    ]);
  });
}

// ---------------------------------------------------------------- pickups & small things
export function gemBuilt() {
  return cached('gem', () => {
    const b = new GB();
    b.add(new THREE.OctahedronGeometry(0.17, 0), 0x2ed6b0, { sy: 1.25, flat: true, glow: 0.35 });
    b.add(new THREE.OctahedronGeometry(0.09, 0), 0xb8fff0, { sy: 1.2, z: 0.07, y: 0.04, flat: true, glow: 0.7, outline: false });
    return b.build();
  });
}
export function heartBuilt() {
  return cached('heart', () => {
    const b = new GB();
    b.shape(heartShape(0.42), 0.09, 0xff4a6a, { glow: 0.3 });
    b.sphere(0.05, 0xffffff, { x: -0.1, y: 0.08, z: 0.09, glow: 1, ws: 6, hs: 4, outline: false });
    return b.build();
  });
}
export function seedBuilt(color) {
  return cached('seed' + color, () => {
    const b = new GB();
    b.shape(starShape(0.32, 0.17), 0.12, color, { glow: 0.55 });
    b.shape(starShape(0.16, 0.085), 0.12, 0xffffff, { z: 0.06, glow: 0.8, outline: false });
    b.cyl(0.02, 0.025, 0.12, 0x5a9a3a, { y: 0.34, seg: 5, outline: false });
    b.sphere(0.08, 0x8fd14f, { x: 0.07, y: 0.42, sx: 1.4, sy: 0.4, rz: 0.5, ws: 8, hs: 5 });
    b.sphere(0.08, 0x8fd14f, { x: -0.07, y: 0.42, sx: 1.4, sy: 0.4, rz: -0.5, ws: 8, hs: 5 });
    return b.build();
  });
}
export function heartContainerBuilt() {
  return cached('heartc', () => {
    const b = new GB();
    b.shape(heartShape(0.6), 0.14, 0xff5a7a, { glow: 0.4 });
    b.shape(heartShape(0.36), 0.14, 0xffd0dc, { z: 0.05, glow: 0.6, outline: false });
    return b.build();
  });
}
export function projectileBuilt(kind) {
  return cached('proj_' + kind, () => {
    const b = new GB();
    if (kind === 'spore') {
      b.sphere(0.18, 0xc07ad8, { glow: 0.5, ws: 12, hs: 8 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; b.sphere(0.06, 0xe8b8ff, { x: Math.sin(a) * 0.15, y: Math.cos(a) * 0.15, glow: 0.6, ws: 6, hs: 4, outline: false }); }
    } else if (kind === 'snowball') {
      b.sphere(0.2, 0xf4f8ff, { ws: 12, hs: 8, glow: 0.2 });
      b.sphere(0.08, 0xffffff, { x: 0.08, y: 0.1, z: 0.1, glow: 0.6, ws: 6, hs: 4, outline: false });
    } else if (kind === 'bubble') {
      b.sphere(0.24, 0x9ae0ff, { ws: 14, hs: 10, glow: 0.4 });
      b.sphere(0.07, 0xffffff, { x: -0.09, y: 0.1, z: 0.15, glow: 1, ws: 6, hs: 4, outline: false });
    } else {
      b.sphere(0.2, 0xffffff, { glow: 0.5 });
    }
    return b.build();
  });
}
