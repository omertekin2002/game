// Scenery: instanced props / decoration with distance culling, view-cone packing and tree LOD (WP7, arch §9.2-1/2),
// buildings, Great Tree, bridges and chests. Supports hiding/showing single instances (cut bushes, broken pots, cut grass).
//
// One layer per prop type (not per 40 m chunk any more): an InstancedMesh for the full model (+ its outline hull, with its
// own instance buffer: only the items inside the hull's fade end), for trees and heavy props a fitted-primitive proxy
// (perf/lod.js, ≤ TUNE.perf.lodTris) with its own outline hull (sharing the proxy's instance buffer) and, for shadow
// casters, a shadow-only mesh on LAYER_SHADOW (the sun's shadow camera renders it, the view never does). cull(camera, view) re-packs the
// instance buffers from the CPU-side item list whenever the camera moved / turned enough: only items inside the view's
// XZ cone (+ margin) and inside their class distance are packed, nearest-first for the outline prefix (hulls stop at
// their fade end), trees by distance into the full model (< lodBand[1]) and the proxy (> lodBand[0]), crossfaded in the
// shader with complementary Bayer masks. Deco / small props shrink to nothing over the last `fade` metres (vertex scale
// in the shader, the same XZ distance as the CPU test), so nothing pops. Items behind the view that can still throw a
// shadow into it (inside the sun's light-space box) go to the shadow-only mesh.
// Stable ids: p._inst = { L, k } never changes; hide(p) zeroes the item's current slots at once, show(p) re-packs.
import * as THREE from 'three';
import { HALF, CHUNK, NCH } from './world.js';
import { toonMat, sharedOutline, outlineMat, meshWithOutline, outlineGeometry, radialProfile, setHullProfile } from './toon.js';
import { makeModel, Assets } from './assets.js';
import { propModel, PROP_KIND, houseA, houseB, shopModel, greatTreeParts, bridgeGeo, chestParts, rainbowShellModel, paradeLanternModels, secretModel, SHOP_COUNTER, PLUSHIE_SPOTS, PLUSHIE_SIZE } from './props.js';
import { hash2 } from './util.js';
import { perf as TP } from './tune.js';
import { proxyGeometry } from './perf/lod.js';

export const LAYER_SHADOW = 4;   // WP7: shadow-only casters (enabled on the sun's shadow camera by the perf module)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

// material kinds: toon options, outline (shared kind name or px options), shadow casting
const OLC = {   // outline configs (the named ones are the shared outline kinds of toon.js)
  tree: { ...TP.outline.tree, occ: true, sway: 0.018, swayBase: 1.6 }, bush: { ...TP.outline.bush, sway: 0.03, swayBase: 0.1 },
  prop: { ...TP.outline.prop }, big: { ...TP.outline.big, occ: true },
};
const KIND = {
  tree: { mat: { sway: 0.018, swayBase: 1.6, occ: true, glow: true }, ol: 'tree', cast: true },
  palm: { mat: { sway: 0.03, swayBase: 2.6, occ: true, glow: true }, ol: { ...TP.outline.tree, occ: true, sway: 0.03, swayBase: 2.6 }, cast: true },
  bush: { mat: { sway: 0.03, swayBase: 0.1, glow: true }, ol: 'bush', cast: true },
  solid: { mat: { glow: true }, ol: 'prop', cast: true },
  big: { mat: { occ: true, glow: true, nightGlow: true, glowBase: 0.3 }, ol: 'big', cast: true },
  grass: { mat: { sway: 0.11, swayBase: 0, push: true, rim: 0.4 }, ol: null, cast: false },
  deco: { mat: { glow: true }, ol: null, cast: false },
  decoGlow: { mat: { glow: true, nightGlow: true, glowBase: 0.3, nightGlowAmt: 2.2 }, ol: null, cast: false },
  glow: { mat: { glow: true, nightGlow: true, glowBase: 0.25, nightGlowAmt: 1.8 }, ol: 'prop', cast: true },
  canopy: { mat: { sway: 0.01, swayBase: 7, occ: true, glow: true }, ol: { ...TP.outline.big, occ: true, sway: 0.01, swayBase: 7 }, cast: true },
};
let MATS = null;
const olMats = new Map(), variants = new Map();
function olFor(k) { const ol = KIND[k].ol; if (!ol) return null; if (typeof ol === 'string') return sharedOutline(ol); if (!olMats.has(k)) olMats.set(k, outlineMat(ol)); return olMats.get(k); }
function mats() {
  if (MATS) return MATS;
  MATS = {};
  for (const k in KIND) MATS[k] = { m: toonMat(KIND[k].mat), ol: olFor(k), cast: KIND[k].cast };
  return MATS;
}
export function sceneryMats() { return mats(); }
/** a kind's material with an instance fade band or LOD crossfade (one program per flag set, a material per band) */
function variant(kind, o) {
  const key = kind + '|' + JSON.stringify(o);
  if (!variants.has(key)) variants.set(key, toonMat({ ...KIND[kind].mat, ...o }));
  return variants.get(key);
}
/** the outline of a layer that crossfades to a proxy: side 0 = the full model's hull, which keeps its width through the
 *  band and dithers out with the model (the proxy's own hull takes over, so the line never thins and thickens again);
 *  side 1 = the proxy's hull, dithered in over the band and drawn to the far plane (px outlines thin with distance).
 *  No band: the kind's own outline. One material per layer (type): its radial profile (eye in the crown) is its own
 *  uniform; materials with the same flags share one program */
function olVariant(kind, band, side = 0, range = null, type = '', cut = null) {
  const ol = KIND[kind].ol, cfg = typeof ol === 'string' ? OLC[ol] : ol;
  const key = kind + '|ol' + side + '|' + (band ? band.join(',') : '-') + '|' + range + '|' + type;
  if (!variants.has(key)) variants.set(key, outlineMat({ ...(band ? { ...cfg, far: side ? [1e9, 2e9] : [band[1], band[1] + 1], lodBand: band, lod: side, ...(side && range ? { instFade: range } : {}) } : cfg), ...(cut ? { cut } : {}) }));
  return variants.get(key);
}
/** r3 canopy cutaway parameters of a tree model (toonMat / outlineMat `cut`, model units): [canopy base (lowest leaf
 *  vertex), canopy radius (farthest leaf vertex from the axis), trunk radius the hull keeps (bark inside the canopy band,
 *  ≤ 0.45 m), top]. Leaves and snow are every vertex colour that is not bark (bark: red > 1.2 × green) */
function canopyCut(geo) {
  const p = geo.attributes.position, c = geo.attributes.color;
  if (!p || !c) return null;
  let base = Infinity, R = 0, top = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); top = Math.max(top, y); if (c.getX(i) > c.getY(i) * 1.2) continue; base = Math.min(base, y); R = Math.max(R, Math.hypot(p.getX(i), p.getZ(i))); }
  let keep = 0;
  for (let i = 0; i < p.count; i++) if (c.getX(i) > c.getY(i) * 1.2 && p.getY(i) >= base) keep = Math.max(keep, Math.hypot(p.getX(i), p.getZ(i)));
  return R > 0 && base < top ? [base, R, Math.min(keep + 0.05, 0.45), top] : null;
}
const triCount = (g) => (g.index ? g.index.count / 3 : g.attributes.position.count / 3);

const VARIATION = {
  tree_round: 0.12, tree_pine: 0.1, tree_snow: 0.06, tree_palm: 0.08, bush: 0.12, grass: 0.14, tallgrass: 0.12, fern: 0.14, flowers: 0.05,
  rock: 0.08, boulder: 0.08,
};
/** cull class of a prop type: deco 35 m, glowing deco 60 m, small props 90 m, trees LOD, big / lamps never */
function classOf(kind, radius) {
  if (kind === 'tree' || kind === 'palm') return 'tree';
  if (kind === 'grass' || kind === 'deco') return 'deco';
  if (kind === 'decoGlow') return 'glow';
  if (kind === 'big' || kind === 'glow' || kind === 'canopy') return 'big';
  return radius > 3 ? 'big' : 'small';
}
function classRange(cls) {
  const C = TP.cull;
  if (cls === 'deco') return [C.deco - C.decoFade, C.deco];
  if (cls === 'glow') return [C.glow - C.glowFade, C.glow];
  if (cls === 'small') return [C.small - C.smallFade, C.small];
  return null;   // never culled by distance (trees: LOD)
}
const olFar = (ol) => (ol && ol.userData.far ? ol.userData.far.value.y : 55);

export class Scenery {
  constructor(W, scene) {
    this.W = W;
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'scenery';
    scene.add(this.root);
    this.meshes = [];
    this.layers = [];
    this.chests = new Map();
    this.shells = new Map();         // Clover's rainbow shells (W.shells): hidden until her errand puts them out
    this.lanterns = new Map();       // Ribbit's parade lanterns (W.lanterns): hidden until the parade starts, then unlit / lit
    this.plushies = new Map();       // Miso's guardian plushies on her counter (guardian id → mesh): hidden until bought
    this.secrets = new Map();        // the landmark keepsakes (W.secrets): shown until found (an opened bottle stays)
    this.cullOff = false;            // G.debug.perf.cull(false): everything packed, full models only (base for A/B)
    this.packs = 0; this.packMs = 0; // stats
    this._v = null; this.dirty = true;
  }
  build() {
    const W = this.W;
    this.buildInstanced(W.props.filter((p) => !p.removed && PROP_KIND[p.type]));
    this.buildInstanced(W.deco);
    this.buildBuildings();
    this.buildGreatTree();
    this.buildBridges();
    this.buildChests();
    this.buildShells();
    this.buildLanterns();
    this.buildPlushies();
    this.buildSecrets();
  }
  buildInstanced(list) {
    const byType = new Map();
    for (const p of list) { let a = byType.get(p.type); if (!a) byType.set(p.type, (a = [])); a.push(p); }
    for (const [type, items] of byType) {
      const model = propModel(type);
      if (!model || !model.geo) continue;
      const kind = KIND[PROP_KIND[type]] ? PROP_KIND[type] : 'solid';
      const base = mats()[kind];
      const bs = model.geo.boundingSphere || (model.geo.computeBoundingSphere(), model.geo.boundingSphere);
      const n = items.length;
      let smax = 0;
      for (const p of items) smax = Math.max(smax, p.s || 1);
      const cls = classOf(kind, bs.radius * smax);
      const range = classRange(cls);
      // LOD: trees always; other classes when the model is heavy ([band start, band end, proxy triangles])
      // (a layer of a few instances, such as the 12 lamps or the one well, keeps its full model: the saving is nil)
      const lodCfg = cls === 'tree' ? [TP.lodBand[0], TP.lodBand[1], TP.lodTris] : TP.lod[cls] && triCount(model.geo) > TP.lodMin && n * triCount(model.geo) > TP.lodMinTotal ? TP.lod[cls] : null;
      const pg = lodCfg ? proxyGeometry(model.geo, lodCfg[2]) : null;
      const band = pg ? [lodCfg[0], lodCfg[1]] : null;
      const cut = cls === 'tree' ? canopyCut(model.geo) : null;   // r3: canopy cutaway beside the TP camera (full model only)
      const L = {
        type, kind, cls, n, items, cast: base.cast, rad: bs.radius, cy: bs.center.y, cut,
        x: new Float32Array(n), z: new Float32Array(n), y: new Float32Array(n), r: new Float32Array(n),
        M: new Float32Array(n * 16), C: VARIATION[type] ? new Float32Array(n * 3) : null, hidden: new Uint8Array(n),
        slot0: new Int32Array(n).fill(-1), slot1: new Int32Array(n).fill(-1), slotS: new Int32Array(n).fill(-1), slotO: new Int32Array(n).fill(-1),
        range, band, far0: band ? band[1] : range ? range[1] : Infinity, far1: range ? range[1] : Infinity, olR: Infinity,
        m0: null, ol0: null, m1: null, olP: null, ms: null, msProxy: false, chunks: [], n0: 0, n0s: 0, nOl: 0, n1: 0, n1s: 0, ns: 0,
        // cone margin (deg): cheap short-range deco packs a much wider cone, so turning rarely re-packs it
        margin: (cls === 'deco' || cls === 'glow' ? TP.coneMarginDeco : TP.coneMargin) * Math.PI / 180, v: null, dirty: true,
      };
      items.forEach((p, k) => {
        this.composeFor(p);
        _m.toArray(L.M, k * 16);
        const s = p.s || 1;
        L.x[k] = p.x; L.z[k] = p.z; L.y[k] = p.y + L.cy * s; L.r[k] = bs.radius * s;
        if (L.C) {
          const h = hash2(Math.round(p.x * 10), Math.round(p.z * 10), 7), vari = VARIATION[type];
          const v = 1 + (h - 0.5) * 2 * vari;
          L.C[k * 3] = v * (1 + (h - 0.5) * vari * 0.6); L.C[k * 3 + 1] = v; L.C[k * 3 + 2] = v * (1 - (h - 0.5) * vari * 0.5);
        }
        p._inst = { L, k };
      });
      // CPU-side 40 m buckets (the world chunks) with bounding circles, so a pack only visits the chunks in range
      const buckets = new Map();
      items.forEach((p, k) => {
        const ci = Math.min(NCH - 1, Math.max(0, Math.floor((p.x + HALF) / CHUNK))), cj = Math.min(NCH - 1, Math.max(0, Math.floor((p.z + HALF) / CHUNK)));
        const key = ci * 64 + cj; let b = buckets.get(key); if (!b) buckets.set(key, (b = [])); b.push(k);
      });
      for (const idx of buckets.values()) {
        let cx = 0, cz = 0;
        for (const k of idx) { cx += L.x[k]; cz += L.z[k]; }
        cx /= idx.length; cz /= idx.length;
        let r = 0;
        for (const k of idx) r = Math.max(r, Math.hypot(L.x[k] - cx, L.z[k] - cz) + L.r[k]);
        L.chunks.push({ x: cx, z: cz, r, idx: Int32Array.from(idx) });
      }
      // meshes: full model (+ hull), tree proxy, shadow-only casters
      const inst = (geo, mat, cast) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.count = 0; m.visible = false; m.frustumCulled = false;
        m.castShadow = cast; m.receiveShadow = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if (L.C) { m.setColorAt(0, _c.setRGB(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
        m.userData.scatter = type;
        this.root.add(m); this.meshes.push(m);
        return m;
      };
      const fo = range ? { instFade: range } : {};
      const mat0 = band ? variant(kind, { lod: 0, lodBand: band, ...fo, ...(cut ? { cut } : {}) }) : range ? variant(kind, fo) : base.m;
      L.m0 = inst(model.geo, mat0, base.cast);
      // draw order (three sorts opaque meshes by renderOrder, then material id, then depth): the trees' full models first
      // (the big near occluders), every outline hull after the terrain (renderOrder 1), so hull and ground fragments
      // behind a body fail the early depth test. Same picture; 0.5-0.7 ms less GPU in the woods at 1080p
      if (cls === 'tree') L.m0.renderOrder = -1;
      if (base.cast) {   // the shadow pass draws only the full models inside the light box (packed first)
        L.m0.onBeforeShadow = function () { this.userData.full = this.count; this.count = L.n0s; };
        L.m0.onAfterShadow = function () { this.count = this.userData.full; };
      }
      if (base.ol && model.ol) {
        // its own material: no hull while the eye is inside this model's radial profile (in a pine tier, a bush, a crown)
        const olm = olVariant(kind, band, 0, null, type, cut);
        setHullProfile(olm, radialProfile(model.ol));
        const om = new THREE.InstancedMesh(model.ol, olm, n);   // own instance buffer: only the items inside the hull's fade end
        om.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        om.count = 0; om.visible = false; om.frustumCulled = false; om.castShadow = false; om.raycast = () => {}; om.userData.scatter = type; om.renderOrder = 2;
        this.root.add(om); this.meshes.push(om);
        L.ol0 = om; L.m0.userData.outline = om;
        L.olR = Math.min(L.far0, olFar(olm));
      }
      if (pg) {
        L.m1 = inst(pg, variant(kind, { lod: 1, lodBand: band, ...fo }), base.cast);
        L.m1.userData.lod = 1; L.lodTris = triCount(pg);
        // the shadow pass draws only the proxies inside the light box (they are packed first)
        L.m1.onBeforeShadow = function () { this.userData.full = this.count; this.count = L.n1s; };
        L.m1.onAfterShadow = function () { this.count = this.userData.full; };
        if (base.ol && model.ol) {   // the proxy's own outline hull (shares the proxy's instance buffer and count)
          const pm = new THREE.InstancedMesh(outlineGeometry([pg]), olVariant(kind, band, 1, range), n);
          pm.instanceMatrix = L.m1.instanceMatrix;
          pm.renderOrder = 2;
          pm.count = 0; pm.visible = false; pm.frustumCulled = false; pm.castShadow = false; pm.raycast = () => {}; pm.userData.scatter = type;
          this.root.add(pm); this.meshes.push(pm);
          L.olP = pm; L.m1.userData.outline = pm;
        }
      }
      // shadow-only casters (behind the view, and full models farther than shadowFullR): the proxy where there is one
      if (base.cast) { L.ms = inst(pg || model.geo, base.m, true); L.ms.layers.set(LAYER_SHADOW); L.ms.receiveShadow = false; L.msProxy = !!pg; }
      this.layers.push(L);
    }
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
  /** cut / broken: gone from every mesh it is packed in right now (stable id p._inst) */
  hide(p) {
    const r = p && p._inst;
    if (!r || !r.L) return;
    const L = r.L, k = r.k;
    L.hidden[k] = 1;
    for (const [mesh, slots] of [[L.m0, L.slot0], [L.ol0, L.slotO], [L.m1, L.slot1], [L.ms, L.slotS]]) {
      if (!mesh || slots[k] < 0) continue;
      const a = mesh.instanceMatrix.array, o = slots[k] * 16;
      for (let i = 0; i < 16; i++) a[o + i] = 0;
      mesh.instanceMatrix.addUpdateRange(o, 16); mesh.instanceMatrix.needsUpdate = true;
      slots[k] = -1;
    }
  }
  /** regrown: packed again by the next cull() (show(p, { grow }) keeps the old signature; grow is accepted) */
  show(p) {
    const r = p && p._inst;
    if (!r || !r.L) return;
    r.L.hidden[r.k] = 0;
    r.L.dirty = true;
  }
  /**
   * Re-pack every layer for this camera when needed (WP7 perf module, afterCamera). view = { x, z, fx, fz, cosH, full,
   * box: { tx, ty, tz, ax, ay, az, bx, by, bz, E } | null } (light-space box of the sun's shadow camera) → true when packed
   */
  cull(view, force = false) {
    const t0 = performance.now(), all = force || this.dirty;
    let n = 0;
    for (const L of this.layers) {
      if (!all && !L.dirty && !this.needs(L, view)) continue;
      this.pack(L, view);
      L.v = { x: view.x, z: view.z, fx: view.fx, fz: view.fz, half: view.half, full: view.full, box: view.box && { ...view.box } };
      L.dirty = false; n++;
    }
    this.dirty = false;
    if (n) { this.packs++; this.packMs = performance.now() - t0; this.packLayers = n; }
    return n > 0;
  }
  /** a layer re-packs when the camera moved repackMove, turned (or widened the view) by half its cone margin, or the sun's
   *  shadow box moved (casters) */
  needs(L, v) {
    const o = L.v;
    if (!o || v.full !== o.full || Math.hypot(v.x - o.x, v.z - o.z) >= TP.repackMove) return true;
    if (L.cast && boxMoved(v.box, o.box)) return true;
    if (v.full || v.half + L.margin >= Math.PI * 0.98) return false;
    return Math.acos(Math.max(-1, Math.min(1, v.fx * o.fx + v.fz * o.fz))) + Math.max(0, v.half - o.half) >= L.margin * 0.5;
  }
  pack(L, v) {
    const off = this.cullOff, near = TP.nearAll, B = v.box, pad = TP.shadowPad, mv = TP.repackMove + 0.5, sfr = L.msProxy && !off ? TP.shadowFullR : Infinity;
    const H = v.half + L.margin, full = v.full || H >= Math.PI * 0.98, cosH = Math.cos(H);
    const lod0 = L.m1 ? L.band[0] - mv : Infinity, far1 = L.far1 + mv;
    const far0 = off ? Infinity : L.far0 + mv, olR = L.olR + mv;
    const tmp = Scenery._tmp || (Scenery._tmp = { a: new Int32Array(1 << 15), b: new Int32Array(1 << 15), c: new Int32Array(1 << 15), d: new Int32Array(1 << 15), e: new Int32Array(1 << 15), o: new Int32Array(1 << 15) });
    if (tmp.a.length < L.n) for (const k in tmp) tmp[k] = new Int32Array(L.n * 2);
    // a: full model in the light box, b: full model, o: outlined (near), c: proxy in the box, d: proxy, e: shadow-only
    let na = 0, nb = 0, nc = 0, nd = 0, ne = 0, no = 0;
    const maxR = Math.max(L.m1 ? far1 : far0, L.ms ? 120 : 0);
    const inBox = (k) => {
      if (!B) return Math.hypot(L.x[k] - v.x, L.z[k] - v.z) < 60;
      const dx = L.x[k] - B.tx, dy = L.y[k] - B.ty, dz = L.z[k] - B.tz, e = B.E + L.r[k] + pad;
      return Math.abs(dx * B.ax + dy * B.ay + dz * B.az) <= e && Math.abs(dx * B.bx + dy * B.by + dz * B.bz) <= e;
    };
    L.slot0.fill(-1); L.slot1.fill(-1); L.slotS.fill(-1); L.slotO.fill(-1);
    for (const ch of L.chunks) {
      const dc = Math.hypot(ch.x - v.x, ch.z - v.z);
      if (dc - ch.r > maxR) continue;
      const chunkCone = off || full || dc < ch.r + near || (ch.x - v.x) * v.fx + (ch.z - v.z) * v.fz >= cosH * dc - ch.r - mv;
      if (!chunkCone && !L.ms) continue;
      for (let j = 0; j < ch.idx.length; j++) {
        const k = ch.idx[j];
        if (L.hidden[k]) continue;
        const dx = L.x[k] - v.x, dz = L.z[k] - v.z, d = Math.sqrt(dx * dx + dz * dz), r = L.r[k];
        // inside the view cone (sphere test, conservative), or close enough to show at the screen edge whatever the yaw
        const cone = off || full || d < near + r || dx * v.fx + dz * v.fz >= cosH * d - r - mv;
        if (cone && d <= far0) {
          // in the light box: the full model casts its own shadow up to shadowFullR, beyond that its proxy (shadow-only) does
          if (L.cast && inBox(k)) { if (d <= sfr) tmp.a[na++] = k; else { tmp.b[nb++] = k; tmp.e[ne++] = k; } } else tmp.b[nb++] = k;
          if (L.ol0 && (off || d <= olR)) tmp.o[no++] = k;
        }
        if (cone && !off && d > lod0 && d <= far1) { if (L.cast && inBox(k)) tmp.c[nc++] = k; else tmp.d[nd++] = k; }
        if (!cone && L.ms && !off && d < 120 && inBox(k)) tmp.e[ne++] = k;
      }
    }
    L.n0 = na + nb; L.n0s = na; L.nOl = no; L.n1 = nc + nd; L.n1s = nc; L.ns = ne;
    writeMesh(L, L.m0, L.slot0, tmp.a, na, tmp.b, nb);
    if (L.ol0) writeMesh(L, L.ol0, L.slotO, tmp.o, no, null, 0);
    if (L.m1) writeMesh(L, L.m1, L.slot1, tmp.c, nc, tmp.d, nd);
    if (L.olP) { L.olP.count = L.m1.count; L.olP.visible = L.m1.visible; }
    if (L.ms) writeMesh(L, L.ms, L.slotS, tmp.e, ne, null, 0);
  }
  /** A/B base (G.debug.perf.cull(false)): every item packed as its full model, no instance fade, LOD dither or outline
   *  distance fade, so the culled view can be compared with "everything drawn" (on = true); false restores */
  setBase(on) {
    this.cullOff = !!on; this.dirty = true;
    const BIG = [1e9, 2e9], keep = this._base || (this._base = new Map());
    for (const L of this.layers) {
      for (const m of [L.m0, L.ol0, L.m1, L.olP, L.ms]) {
        const u = m && m.material.userData;
        if (!u) continue;
        for (const k of ['lodBand', 'instFade', 'far']) {
          const un = u[k];
          if (!un || !un.value) continue;
          if (!keep.has(un)) keep.set(un, un.value.toArray());
          un.value.fromArray(on ? BIG : keep.get(un));
        }
      }
    }
  }
  /** pack counts for tests / G.debug.perf.state() */
  stats() {
    const out = { packs: this.packs, packMs: +this.packMs.toFixed(3), layers: {} };
    let tris = 0;
    for (const L of this.layers) {
      const t0 = L.m0.geometry.index ? L.m0.geometry.index.count / 3 : L.m0.geometry.attributes.position.count / 3;
      out.layers[L.type] = { cls: L.cls, n: L.n, full: L.n0, outlined: L.nOl, proxy: L.n1, proxyHull: !!L.olP, proxyShadow: L.n1s, shadowOnly: L.ns, lodTris: L.lodTris || null };
      tris += L.n0 * t0;
    }
    out.fullTris = tris;
    return out;
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
    g.userData.cull = { dist: Infinity };
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
    const sh = W.greatTree.scaleHeight;   // WP9 sets it in world.js (≈ 19.8 m); absent → the manifest height
    const glbA = makeModel('great_tree', { outline: 'big', occ: true, receive: true, height: sh });
    if (glbA) {
      const glbB = makeModel('great_tree_bloom', { outline: 'big', occ: true, receive: true, height: sh && sh * bloomK() });
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
      g.userData.cull = { dist: Infinity };   // built in world coordinates (origin at 0, 0): never by distance
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
  /** one small group per rainbow shell, hidden (game.syncErrands shows the ones that are out). Model and procedural
   *  only: rainbowShellModel is the decorative shell's shape in rainbow colours, so it needs no asset */
  buildShells() {
    const shells = this.W.shells || [];
    if (!shells.length) return;
    const model = rainbowShellModel(), mat = toonMat({ glow: true, glowBase: 0.35, rim: 0.6 }), ol = mats().solid.ol;
    for (const sh of shells) {
      const g = new THREE.Group(), spin = meshWithOutline(model, mat, ol, { cast: false });
      spin.scale.setScalar(2.4);
      g.add(spin);
      g.position.set(sh.x, sh.y + 0.1, sh.z);
      g.visible = false;
      this.root.add(g);
      this.shells.set(sh.id, { group: g, spin, data: sh, shown: false, ph: hash2(Math.round(sh.x * 10), Math.round(sh.z * 10), 11) * Math.PI * 2 });
    }
  }
  /** `shown` is the game's wish; group.visible also reads false while the distance culler (perf.js, C10) hides it */
  setShellShown(id, on) {
    const s = this.shells.get(id);
    if (s) { s.shown = !!on; s.group.visible = s.shown; }
  }
  /** one group per parade lantern: the post and its own paper material (tinted and glowing by how lit it is), hidden
   *  until game.syncErrands shows them. Procedural only (paradeLanternModels), so it needs no asset */
  buildLanterns() {
    const list = this.W.lanterns || [];
    if (!list.length) return;
    const m = paradeLanternModels(), postMat = mats().solid.m, ol = mats().solid.ol;
    for (const it of list) {
      const g = new THREE.Group(), mat = toonMat({ glow: true, glowBase: 0, rim: 0.5 });
      g.add(meshWithOutline(m.post, postMat, ol, { cast: false }));
      const paper = meshWithOutline(m.paper, mat, ol, { cast: false });
      g.add(paper);
      g.position.set(it.x, it.y, it.z);
      g.rotation.y = it.rot;
      g.visible = false;
      this.root.add(g);
      const L = { group: g, paper, mat, data: it, shown: false, lit: false, glow: 0, ph: hash2(Math.round(it.x * 10), Math.round(it.z * 10), 17) * Math.PI * 2 };
      this.lanterns.set(it.id, L);
      this.tintLantern(L);
    }
  }
  /** Miso's guardian plushies: one small copy of each guardian's model (one mesh + its outline, no shadow) on the counter,
   *  in a group that shares the shop's transform, at fixed offsets (props.js PLUSHIE_SPOTS: no world RNG, no colliders).
   *  All hidden; game.syncPlushies / a purchase shows the bought ones. Without a guardian model, a small toon blob */
  buildPlushies() {
    const W = this.W;
    if (!W.shop) return;
    const g = new THREE.Group();
    g.name = 'plushies';
    g.position.set(W.shop.x, W.shop.y - 0.05, W.shop.z);
    g.rotation.y = W.shop.rot;
    g.userData.cull = { dist: 60 };
    const keys = { woods: 'boss_shroom', shores: 'boss_crab', peaks: 'boss_frost' }, tint = { woods: 0xb07ad8, shores: 0xff7a5a, peaks: 0xc8ecff };
    const box = new THREE.Box3(), size = new THREE.Vector3();
    for (const [id, [x, z, ry]] of Object.entries(PLUSHIE_SPOTS)) {
      const m = makeModel(keys[id], { outline: 'prop', cast: false, height: 1 });
      let o;
      if (m) {
        o = m.group;
        box.setFromObject(o); box.getSize(size);   // fit the 1 m model inside the plushie's box, feet on the counter
        o.scale.setScalar(Math.min(PLUSHIE_SIZE.h / Math.max(size.y, 1e-3), PLUSHIE_SIZE.w / Math.max(size.x, size.z, 1e-3)));
      } else {
        const mat = toonMat({ color: tint[id], rim: 0.6 });
        o = meshWithOutline(new THREE.SphereGeometry(PLUSHIE_SIZE.w * 0.45, 12, 8), mat, mats().solid.ol, { cast: false });
        o.position.y = PLUSHIE_SIZE.w * 0.4;
        o = new THREE.Group().add(o);
      }
      o.position.set(x, SHOP_COUNTER.top, z);
      o.rotation.y = ry;
      o.visible = false;
      g.add(o);
      this.plushies.set(id, o);
    }
    this.root.add(g);
  }
  /** one group per landmark keepsake (W.secrets), shown from the start; game.syncSecrets hides the found ones (an opened
   *  bottle keeps its body). Procedural only (props.js secretModel), so it needs no asset */
  buildSecrets() {
    const list = this.W.secrets || [];
    if (!list.length) return;
    const mat = toonMat({ glow: true, glowBase: 0.15, rim: 0.6 }), ol = mats().solid.ol;
    for (const it of list) {
      const m = secretModel(it.id);
      if (!m) continue;
      const g = new THREE.Group();
      g.name = 'secret_' + it.id;
      g.add(meshWithOutline(m.main, mat, ol, { cast: false }));
      const lid = m.lid ? meshWithOutline(m.lid, mat, ol, { cast: false }) : null;
      if (lid) g.add(lid);
      g.position.set(it.x, it.y - 0.02, it.z);
      g.rotation.y = it.rot;
      g.scale.setScalar(1.4);
      this.root.add(g);
      this.secrets.set(it.id, { group: g, lid, data: it, found: false, shown: true });
    }
  }
  /** a keepsake found (data.js SECRETS): it goes, or for a `keep` one (the bottle) only its lid goes (opened). `shown`
   *  is the game's wish; group.visible also reads false while the distance culler (perf.js, C10) hides it */
  setSecret(id, found, keep = false) {
    const s = this.secrets.get(id);
    if (!s) return;
    s.found = !!found;
    s.shown = !found || !!keep;
    s.group.visible = s.shown;
    if (s.lid) s.lid.visible = !found;
  }
  /** show / hide a bought guardian plushie on Miso's counter (guardian id, data.js PLUSHIES `boss`) */
  setPlushie(id, on) {
    const o = this.plushies.get(id);
    if (o) o.visible = !!on;
  }
  /** a lantern's look at glow g (0 unlit cream paper, 1 lit warm and glowing) */
  tintLantern(L) {
    const g = L.glow;
    // pale paper → warm amber, in sRGB (the glow adds the paper's own colour on top of the light: a deep amber keeps it
    // from washing out to white)
    L.mat.color.setRGB(0.93 + 0.07 * g, 0.91 - 0.37 * g, 0.86 - 0.7 * g, THREE.SRGBColorSpace);
    L.mat.userData.glowK.value.x = 0.6 * g;
  }
  /** show / hide a parade lantern and light it: a newly lit one warms up over ≈ 0.8 s (update), `instant` at once */
  setLantern(id, shown, lit, instant = false) {
    const L = this.lanterns.get(id);
    if (!L) return;
    L.shown = !!shown; L.group.visible = L.shown; L.lit = !!lit;
    if (instant || !L.lit) { L.glow = L.lit ? 1 : 0; this.tintLantern(L); }
  }
  /** an errand item's scenery (data.js ERRANDS `item`): shown or hidden, found (a lit lantern) or not */
  setErrandItem(kind, id, shown, found = false, instant = false) {
    if (kind === 'shell') this.setShellShown(id, shown);
    else if (kind === 'lantern') this.setLantern(id, shown, found, instant);
  }
  setChestOpen(id, open, instant) {
    const ch = this.chests.get(id);
    if (!ch) return;
    ch.target = open ? 1 : 0;
    if (instant) { ch.open = ch.target; ch.lid.rotation.x = -ch.open * 1.9; }
  }
  update(dt) {
    const t = (this._t = (this._t || 0) + dt);
    for (const s of this.shells.values()) {
      if (!s.group.visible) continue;
      s.spin.rotation.y = t * 0.9 + s.ph;
      s.spin.position.y = 0.05 + Math.sin(t * 2.2 + s.ph) * 0.05;
    }
    for (const L of this.lanterns.values()) {
      if (!L.shown) continue;
      if (L.lit && L.glow < 1) { L.glow = Math.min(1, L.glow + dt * 1.25); this.tintLantern(L); }   // a soft warm-up
      L.paper.rotation.z = this.calm ? 0 : Math.sin(t * 1.3 + L.ph) * 0.03;   // a gentle sway in the breeze (not with Motion comfort)
    }
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

/** copy the items of two index lists into a mesh's instance buffer (first list first), recording each item's slot */
function writeMesh(L, mesh, slots, a, na, b, nb) {
  const arr = mesh.instanceMatrix.array, M = L.M, C = L.C, carr = C && mesh.instanceColor ? mesh.instanceColor.array : null;
  let s = 0;
  for (let pass = 0; pass < 2; pass++) {
    const list = pass ? b : a, n = pass ? nb : na;
    for (let j = 0; j < n; j++, s++) {
      const k = list[j], o = s * 16, mo = k * 16;
      for (let i = 0; i < 16; i++) arr[o + i] = M[mo + i];
      if (carr) { carr[s * 3] = C[k * 3]; carr[s * 3 + 1] = C[k * 3 + 1]; carr[s * 3 + 2] = C[k * 3 + 2]; }
      slots[k] = s;
    }
  }
  mesh.count = s; mesh.visible = s > 0;
  const im = mesh.instanceMatrix;
  im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(16, s * 16)); im.needsUpdate = true;
  if (carr) { const ic = mesh.instanceColor; ic.clearUpdateRanges(); ic.addUpdateRange(0, Math.max(3, s * 3)); ic.needsUpdate = true; }
}
function boxMoved(a, b) {
  if (!a || !b) return !!a !== !!b;
  return Math.hypot(a.tx - b.tx, a.tz - b.tz) > 2 || a.ax * b.ax + a.ay * b.ay + a.az * b.az < 0.9995 || a.bx * b.bx + a.by * b.by + a.bz * b.bz < 0.9995 || Math.abs(a.E - b.E) > 0.5;
}

/** bloom / sleepy model height ratio from the manifest (the bloom crown is a little taller) */
function bloomK() { const m = Assets.modelInfo; return m.great_tree_bloom && m.great_tree ? m.great_tree_bloom.height / m.great_tree.height : 1; }
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
