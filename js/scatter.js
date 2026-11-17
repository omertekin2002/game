// Scenery: chunked InstancedMeshes for props/decoration (frustum-culled per chunk), buildings, Great Tree,
// bridges and chests. Supports hiding/showing single instances (cut bushes, broken pots, cut grass).
import * as THREE from 'three';
import { HALF, CHUNK, NCH } from './world.js';
import { toonMat, sharedOutline, outlineMat, meshWithOutline } from './toon.js';
import { makeModel } from './assets.js';
import { propModel, PROP_KIND, houseA, houseB, shopModel, greatTreeParts, bridgeGeo, chestParts } from './props.js';
import { hash2 } from './util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

let MATS = null;
function mats() {
  if (MATS) return MATS;
  MATS = {
    tree: { m: toonMat({ sway: 0.018, swayBase: 1.6, occ: true, glow: true }), ol: sharedOutline('tree'), cast: true },
    palm: { m: toonMat({ sway: 0.03, swayBase: 2.6, occ: true, glow: true }), ol: outlineMat({ width: 0.04, occ: true, sway: 0.03, swayBase: 2.6 }), cast: true },
    bush: { m: toonMat({ sway: 0.03, swayBase: 0.1, glow: true }), ol: sharedOutline('bush'), cast: true },
    solid: { m: toonMat({ glow: true }), ol: sharedOutline('prop'), cast: true },
    big: { m: toonMat({ occ: true, glow: true, nightGlow: true, glowBase: 0.3 }), ol: sharedOutline('big'), cast: true },
    grass: { m: toonMat({ sway: 0.11, swayBase: 0, push: true, rim: 0.4 }), ol: null, cast: false },
    deco: { m: toonMat({ glow: true }), ol: null, cast: false },
    decoGlow: { m: toonMat({ glow: true, nightGlow: true, glowBase: 0.3, nightGlowAmt: 2.2 }), ol: null, cast: false },
    glow: { m: toonMat({ glow: true, nightGlow: true, glowBase: 0.25, nightGlowAmt: 1.8 }), ol: sharedOutline('prop'), cast: true },
    canopy: { m: toonMat({ sway: 0.01, swayBase: 7, occ: true, glow: true }), ol: outlineMat({ width: 0.05, occ: true, sway: 0.01, swayBase: 7 }), cast: true },
  };
  return MATS;
}
export function sceneryMats() { return mats(); }

// Decoration the graphics preset may thin out: non-interactive and never collides. Not `tallgrass`, which is cuttable.
const THINNABLE = new Set(['grass', 'flowers', 'fern', 'pebble', 'shell', 'glowshroom', 'crystal']);

const VARIATION = {
  tree_round: 0.12, tree_pine: 0.1, tree_snow: 0.06, tree_palm: 0.08, bush: 0.12, grass: 0.14, tallgrass: 0.12, fern: 0.14, flowers: 0.05,
  rock: 0.08, boulder: 0.08,
};

export class Scenery {
  constructor(W, scene) {
    this.W = W;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'scenery';
    scene.add(this.root);
    this.meshes = [];
    this.thinned = []; // { mesh, keys }: decoration meshes whose instances are sorted by `keys` (ascending)
    this.decoDensity = 1;
    this.chests = new Map();
  }
  build() {
    const W = this.W;
    this.buildInstanced(W.props.filter((p) => !p.removed && PROP_KIND[p.type]), true);
    this.buildInstanced(W.deco, false);
    this.buildBuildings();
    this.buildGreatTree();
    this.buildBridges();
    this.buildChests();
  }
  buildInstanced(list, isProp) {
    const groups = new Map();
    for (const p of list) {
      const ci = Math.min(NCH - 1, Math.max(0, Math.floor((p.x + HALF) / CHUNK)));
      const cj = Math.min(NCH - 1, Math.max(0, Math.floor((p.z + HALF) / CHUNK)));
      const key = p.type + '|' + ci + '|' + cj;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { type: p.type, items: [] }));
      g.items.push(p);
    }
    for (const g of groups.values()) {
      const model = propModel(g.type);
      if (!model || !model.geo) continue;
      // Thinnable decoration is ordered by a fixed per-instance hash, so drawing only the first `count`
      // instances drops a stable, evenly spread subset (see setDecoDensity). `p._inst.i` follows the new order.
      let keys = null;
      if (!isProp && THINNABLE.has(g.type)) {
        const keyed = g.items.map((p) => ({ p, k: hash2(Math.round(p.x * 10), Math.round(p.z * 10), 31) }));
        keyed.sort((a, b) => a.k - b.k);
        g.items = keyed.map((e) => e.p);
        keys = Float32Array.from(keyed, (e) => e.k);
      }
      const kind = mats()[PROP_KIND[g.type]] || mats().solid;
      const mesh = new THREE.InstancedMesh(model.geo, kind.m, g.items.length);
      const vari = VARIATION[g.type] || 0;
      g.items.forEach((p, i) => {
        this.composeFor(p);
        mesh.setMatrixAt(i, _m);
        if (vari) {
          const h = hash2(Math.round(p.x * 10), Math.round(p.z * 10), 7);
          const v = 1 + (h - 0.5) * 2 * vari;
          _c.setRGB(v * (1 + (h - 0.5) * vari * 0.6), v, v * (1 - (h - 0.5) * vari * 0.5));
          mesh.setColorAt(i, _c);
        }
        p._inst = { mesh, i };
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = kind.cast;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.root.add(mesh);
      this.meshes.push(mesh);
      if (kind.ol && model.ol) {
        const om = new THREE.InstancedMesh(model.ol, kind.ol, g.items.length);
        om.instanceMatrix = mesh.instanceMatrix;
        om.computeBoundingSphere();
        om.castShadow = false;
        om.raycast = () => {};
        this.root.add(om);
        mesh.userData.outline = om;
      }
      if (keys) { this.thinned.push({ mesh, keys }); this.thinMesh(mesh, keys); }
    }
  }
  /** Draw only this fraction (0..1) of the thinnable decoration. Fewer instances are submitted, so the
   *  triangles really drop (a zero-scaled instance would still cost its vertices). */
  setDecoDensity(d) {
    this.decoDensity = Math.min(1, Math.max(0, d));
    for (const t of this.thinned) this.thinMesh(t.mesh, t.keys);
  }
  thinMesh(mesh, keys) {
    let n = keys.length;
    if (this.decoDensity < 1) { n = 0; while (n < keys.length && keys[n] < this.decoDensity) n++; }
    for (const m of [mesh, mesh.userData.outline]) if (m) { m.count = n; m.visible = n > 0; }
  }
  composeFor(p) {
    _e.set(0, p.rot || 0, 0);
    _q.setFromEuler(_e);
    const sink = p.type.startsWith('tree') ? 0.08 : p.type === 'boulder' || p.type === 'rock' ? 0.12 : 0;
    _p.set(p.x, p.y - sink, p.z);
    const s = p.s || 1;
    _s.set(s, s, s);
    _m.compose(_p, _q, _s);
    return _m;
  }
  hide(p) {
    if (!p || !p._inst) return;
    p._inst.mesh.setMatrixAt(p._inst.i, ZERO);
    p._inst.mesh.instanceMatrix.needsUpdate = true;
  }
  show(p) {
    if (!p || !p._inst) return;
    this.composeFor(p);
    p._inst.mesh.setMatrixAt(p._inst.i, _m);
    p._inst.mesh.instanceMatrix.needsUpdate = true;
  }
  buildBuildings() {
    const W = this.W;
    const big = mats().big;
    const A = houseA(), B = houseB(), S = shopModel();
    for (const h of W.houses) {
      const g = meshWithOutline(h.type === 'house_a' ? A : B, big.m, big.ol, { receive: true });
      g.position.set(h.x, h.y - 0.05, h.z);
      g.rotation.y = h.rot;
      this.root.add(g);
    }
    if (W.shop) {
      const g = meshWithOutline(S, big.m, big.ol, { receive: true });
      g.position.set(W.shop.x, W.shop.y - 0.05, W.shop.z);
      g.rotation.y = W.shop.rot;
      this.root.add(g);
    }
  }
  buildGreatTree() {
    const W = this.W;
    const parts = greatTreeParts();
    const g = new THREE.Group();
    g.position.set(W.greatTree.x, W.greatTree.y - 0.1, W.greatTree.z);
    const big = mats().big, can = mats().canopy;
    g.add(meshWithOutline(parts.trunk, big.m, big.ol, { receive: true }));
    const canopy = meshWithOutline(parts.canopy, can.m, can.ol);
    const bloom = meshWithOutline(parts.bloom, can.m, can.ol);
    bloom.visible = false;
    const sleepy = meshWithOutline(parts.sleepy, big.m, null, { cast: false });
    const awake = meshWithOutline(parts.awake, big.m, null, { cast: false });
    awake.visible = false;
    g.add(canopy, bloom, sleepy, awake);
    this.root.add(g);
    this.greatTree = { group: g, canopy, bloom, sleepy, awake, branchEnds: parts.branchEnds, height: 14 };
    // Prefer the art pipeline's GLBs when present (sleepy + bloom); procedural parts stay as fallback.
    const glbA = makeModel('great_tree', { outline: 'big', occ: true, receive: true });
    if (glbA) {
      const glbB = makeModel('great_tree_bloom', { outline: 'big', occ: true, receive: true });
      g.children.slice().forEach((c) => (c.visible = false));
      g.add(glbA.group);
      if (glbB) { glbB.group.visible = false; g.add(glbB.group); }
      const T = this.greatTree;
      T.glb = { a: glbA.group, b: glbB ? glbB.group : null };
      T.height = glbA.height;
      const h = glbA.height;
      T.branchEnds = [0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI * 2 + 0.5; return [Math.sin(a) * h * 0.33, h * 0.62, Math.cos(a) * h * 0.33]; });
      T.footprint = footprintRadius(glbA.group, h);
    }
  }
  setBloom(on) {
    const t = this.greatTree;
    if (!t) return;
    if (t.glb) {
      if (t.glb.b) { t.glb.a.visible = !on; t.glb.b.visible = on; }
      else { t.glb.a.visible = true; t.bloom.visible = false; }
      return;
    }
    t.canopy.visible = !on; t.bloom.visible = on; t.sleepy.visible = !on; t.awake.visible = on;
  }
  buildBridges() {
    const solid = mats().solid;
    for (const br of this.W.bridges) {
      const built = bridgeGeo(br);
      const g = meshWithOutline(built, solid.m, solid.ol, { receive: true });
      this.root.add(g);
    }
  }
  buildChests() {
    const solid = mats().solid;
    const parts = { coins: chestParts(false), heart: chestParts(true) };
    for (const c of this.W.chests) {
      const p = parts[c.kind];
      const g = new THREE.Group();
      g.position.set(c.x, c.y, c.z);
      g.rotation.y = c.rot;
      const body = meshWithOutline(p.body, solid.m, solid.ol, { receive: true });
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.56, -0.35);
      const lid = meshWithOutline(p.lid, solid.m, solid.ol);
      lidPivot.add(lid);
      g.add(body, lidPivot);
      if (c.kind === 'heart') g.scale.setScalar(1.15);
      this.root.add(g);
      this.chests.set(c.id, { group: g, lid: lidPivot, data: c, open: 0, target: 0 });
    }
  }
  setChestOpen(id, open, instant) {
    const ch = this.chests.get(id);
    if (!ch) return;
    ch.target = open ? 1 : 0;
    if (instant) { ch.open = ch.target; ch.lid.rotation.x = -ch.open * 1.9; }
  }
  update(dt) {
    for (const ch of this.chests.values()) {
      if (ch.open !== ch.target) {
        const sp = 3.2;
        ch.open = ch.target > ch.open ? Math.min(ch.target, ch.open + dt * sp) : Math.max(ch.target, ch.open - dt * sp);
        const t = ch.open;
        // overshoot wobble
        ch.lid.rotation.x = -(t * 1.9 + Math.sin(t * Math.PI) * 0.25);
      }
    }
  }
}

/** radius of a model's footprint near the ground (roots/trunk), in metres */
function footprintRadius(obj, h) {
  obj.updateMatrixWorld(true);
  let r = 0;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      if (v.y < h * 0.12) r = Math.max(r, Math.hypot(v.x, v.z));
    }
  });
  return r;
}
