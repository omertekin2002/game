// WP7 near-field grass (art §4.2, arch §9.2-8): painted crossed-quad cards from the `grass_cards` / `flower_cards`
// billboards in a camera-centred window of 5 m tiles (radius 20 m), density from the terrain splat under each clump
// (meadow 9 / village grass 6 / woods 5 per m², none on paths, sand, snow, dirt, rock or inside colliders), heights
// 0.16–0.45 m (never above the 0.88 m eye), toon-lit with the terrain ramp and an up normal so they shade like the
// ground, wind sway + Pip push, shrunk away over 16–20 m (the island-wide deco tufts carry on to 35 m), near-camera
// dither. One draw per atlas. The sword cuts them (the same 3D swing test as the cuttables) and they regrow out of view.
// No card texture (?noassets): the old grass-tuft mesh at 0.6× scale and a third of the density within 15 m.
import * as THREE from 'three';
import { U, gradientTex, toonMat } from '../toon.js';
import { Assets } from '../assets.js';
import { propModel } from '../props.js';
import { swordTest } from '../combat.js';
import { sfx } from '../core.js';
import { perf as TP } from '../tune.js';
import { hash2 } from '../util.js';

const T = TP.grass;
const GRASS_CELLS = ['short', 'airy', 'clover', 'seed_heads'], FLOWER_CELLS = ['daisies', 'cosmos', 'forget_me_nots', 'buttercups'];
// per cell: height range (m); clover is ground cover
const H = { short: [0.22, 0.32], airy: [0.30, 0.45], clover: [0.16, 0.24], seed_heads: [0.34, 0.45], flower: [0.28, 0.42] };
// hand-tuned tints per splat layer: the fallback when the ground textures cannot be read (see groundTints)
const TINT0 = { grass: [0.92, 0.96, 0.88], forest: [0.56, 0.68, 0.52], meadow: [1.04, 1.04, 0.84] };
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** average linear colour of a texture's image (null when it cannot be read) */
function texAvg(tex) {
  const img = tex && tex.image;
  if (!img) return null;
  try {
    let d;
    if (img.data && img.width) d = img.data;   // DataTexture (solid fallback)
    else {
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 16, 16);
      d = x.getImageData(0, 0, 16, 16).data;
    }
    const a = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < d.length; i += 4) { a[0] += lin(d[i]); a[1] += lin(d[i + 1]); a[2] += lin(d[i + 2]); n++; }
    return n ? a.map((v) => v / n) : null;
  } catch (e) { return null; }
}
/** per splat layer, the tint that turns the cards' average colour into the ground's (the terrain texture of that layer),
 *  so a card is the colour of the ground it grows from (TUNE grass.groundMatch blends it with the hand-tuned tint) */
function groundTints(cardAvg) {
  const out = {}, k = T.groundMatch ?? 1, mid = T.tintMid ?? 0.85;
  for (const key of ['grass', 'forest', 'meadow']) {
    const g = cardAvg && texAvg(Assets.textures[key]);
    out[key] = TINT0[key].map((v, c) => (g ? v + (Math.min(2.2, Math.max(0.3, g[c] / Math.max(1e-4, cardAvg[c]) / mid)) - v) * k : v));
  }
  return out;
}
const STRIDE = 12;   // per clump: x, y, z, rot, h, w, cell, r, g, b, flower (0/1), unused

/** tight rect (u0, v0, u1, v1 in texture space, flipY) of each named cell's main content: the largest run of non-empty
 *  columns (some cells carry a stray leaf from their neighbour) and the rows that hold it */
function cellRects(tex, atlas, names) {
  const W = atlas.size[0], Hh = atlas.size[1], out = [], avg = [0, 0, 0];
  let nAvg = 0;
  let px = null, cw = 0, ch = 0;
  try {
    const img = tex.image, s = 0.25;
    cw = Math.max(1, Math.round(W * s)); ch = Math.max(1, Math.round(Hh * s));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, cw, ch);
    px = x.getImageData(0, 0, cw, ch).data;
  } catch (e) { px = null; }
  for (const n of names) {
    const r = atlas.cells[n];
    if (!r) { out.push(null); continue; }
    let x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h;
    if (px) {
      const s = cw / W, cx0 = Math.floor(r.x * s), cx1 = Math.ceil((r.x + r.w) * s), cy0 = Math.floor(r.y * s), cy1 = Math.ceil((r.y + r.h) * s);
      const colOn = (cx) => { for (let y = cy0; y < cy1; y++) if (px[(y * cw + cx) * 4 + 3] > 110) return true; return false; };
      let best = [cx0, cx1 - 1], run = null, bl = -1;
      for (let cx = cx0; cx <= cx1; cx++) {
        const on = cx < cx1 && colOn(cx);
        if (on && run === null) run = cx;
        if (!on && run !== null) { if (cx - run > bl) { bl = cx - run; best = [run, cx - 1]; } run = null; }
      }
      let ry0 = cy1, ry1 = cy0;
      for (let y = cy0; y < cy1; y++) for (let cx = best[0]; cx <= best[1]; cx++) if (px[(y * cw + cx) * 4 + 3] > 110) { ry0 = Math.min(ry0, y); ry1 = Math.max(ry1, y); break; }
      if (bl > 0 && ry1 >= ry0) { x0 = best[0] / s; x1 = (best[1] + 1) / s; y0 = ry0 / s; y1 = (ry1 + 1) / s; }
      // the cell's opaque interior colour (linear): what the ground-matched tint is measured against
      for (let y = ry0; y <= ry1; y++) for (let cx = best[0]; cx <= best[1]; cx++) {
        const i = (y * cw + cx) * 4;
        if (px[i + 3] > 200) { avg[0] += lin(px[i]); avg[1] += lin(px[i + 1]); avg[2] += lin(px[i + 2]); nAvg++; }
      }
    }
    out.push({ u0: x0 / W, u1: x1 / W, vTop: 1 - y0 / Hh, vBot: 1 - y1 / Hh, aspect: (x1 - x0) / Math.max(1, y1 - y0) });
  }
  out.avg = nAvg > 20 ? avg.map((v) => v / nAvg) : null;
  return out;
}

/** two crossed unit quads (x/z ∈ [−0.5, 0.5], y ∈ [0, 1]) with a dark-to-light base gradient */
function cardGeometry(cap) {
  const g = new THREE.InstancedBufferGeometry();
  const P = [], UV = [], C = [], I = [];
  for (let q = 0; q < 2; q++) {
    const b = q * 4;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const a = u - 0.5;
      P.push(q ? 0 : a, v, q ? a : 0); UV.push(u, v);
      const k = 0.62 + 0.38 * v; C.push(k, k, k);
    }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  for (const [k, n] of [['iPos', 4], ['iCard', 4], ['iTint', 3]]) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  return g;
}

/** plain alpha test, no alpha-to-coverage: on this GPU path (ANGLE / Vulkan) alpha-to-coverage left a pale 1-px stipple
 *  along every blade edge (strongest at night), whatever the draw order or background */
function cardMaterial(tex, rects) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, map: tex, vertexColors: true, gradientMap: gradientTex('terrain'), side: THREE.DoubleSide, alphaTest: T.alphaTest });
  const uRects = { value: rects.map((r) => (r ? new THREE.Vector4(r.u0, r.vBot, r.u1, r.vTop) : new THREE.Vector4())) };
  const uFade = { value: new THREE.Vector2(...T.fade) }, uSwayG = { value: T.sway };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uPip: U.uPip, uRects, uFade, uSwayG, uNearFadeF: U.uNearFadeF });
    sh.vertexShader = `
      uniform float uTime; uniform vec3 uPip; uniform vec4 uRects[4]; uniform vec2 uFade; uniform float uSwayG;
      attribute vec4 iPos; attribute vec4 iCard; attribute vec3 iTint;
      varying float vViewDepth;
    ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', /* glsl */`
        float ca = cos(iPos.w), sa = sin(iPos.w);
        float fd = length(iPos.xz - cameraPosition.xz), fk = 1.0 - smoothstep(uFade.x, uFade.y, fd);
        float hh = position.y * iCard.x * fk;
        vec2 lp = vec2(position.x * ca - position.z * sa, position.x * sa + position.z * ca) * iCard.y * fk;
        vec3 transformed = vec3(iPos.x + lp.x, iPos.y + hh, iPos.z + lp.y);
        float sw = sin(uTime * 1.7 + iPos.x * 0.33 + iPos.z * 0.27) + 0.45 * sin(uTime * 3.1 + iPos.z * 0.61 + iPos.x * 0.2);
        transformed.x += sw * uSwayG * hh; transformed.z += sw * 0.55 * uSwayG * hh;
        vec2 pd = transformed.xz - uPip.xz; float pl = length(pd) + 1e-4;
        float pp = (1.0 - smoothstep(0.25, 1.05, pl)) * step(abs(iPos.y - uPip.y), 2.0);
        transformed.xz += pd / pl * pp * hh * 0.65; transformed.y -= pp * hh * 0.25;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        { vec4 r = uRects[int(iCard.z + 0.5)]; vMapUv = vec2(mix(r.x, r.z, uv.x), mix(r.y, r.w, uv.y)); }`)
      .replace('#include <color_vertex>', '#include <color_vertex>\n vColor.rgb *= iTint;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\n vViewDepth = -mvPosition.z;');
    // the atlas paints a paler rim around each blade (alpha 0.5–0.8 texels are lighter than the interior): darkened toward
    // the interior colour so a card's edge never reads as a light fringe
    sh.fragmentShader = `
      uniform vec2 uNearFadeF; varying float vViewDepth;
      float bayer4g(vec2 p) { ivec2 i = ivec2(mod(p, 4.0)); int idx = i.x + i.y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[idx] + 0.5) / 16.0; }
    ` + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vViewDepth < uNearFadeF.y && smoothstep(uNearFadeF.x, uNearFadeF.y, vViewDepth) <= bayer4g(gl_FragCoord.xy)) discard;`)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.45, 0.95, sampledDiffuseColor.a));');
  };
  m.customProgramCacheKey = () => 'grassCards';
  return m;
}

export class NearGrass {
  constructor(game) {
    this.game = game; this.W = game.world; this.on = true;
    this.tiles = new Map(); this.active = []; this.center = null; this.dirty = true; this.cuts = 0; this.regrowT = 0;
    const scene = game.scene;
    const gTex = Assets.billboards.grass_cards, gAt = Assets.atlas.grass_cards;
    const fTex = Assets.billboards.flower_cards, fAt = Assets.atlas.flower_cards;
    this.cards = !!(gTex && gAt && gAt.cells);
    this.sets = [];
    const R = T.radius + T.tile, area = Math.PI * R * R;
    this.tint = TINT0;
    if (this.cards) {
      const rects = cellRects(gTex, gAt, GRASS_CELLS);
      this.tint = groundTints(rects.avg);
      this.sets.push(this.makeSet(scene, gTex, rects, Math.ceil(area * 9.5), 'grass'));
      if (fTex && fAt && fAt.cells) this.sets.push(this.makeSet(scene, fTex, cellRects(fTex, fAt, FLOWER_CELLS), Math.ceil(area * 1.4), 'flower'));
    } else {
      // fallback: grass tufts (the scatter 'grass' look: sway + push)
      const model = propModel('grass');
      if (model && model.geo) {
        const cap = Math.ceil(Math.PI * 15 * 15 * 3.2);
        const mesh = new THREE.InstancedMesh(model.geo, toonMat({ sway: 0.11, swayBase: 0, push: true, rim: 0.4 }), cap);
        mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.grass = 'blades';
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(mesh);
        this.blades = { mesh, cap };
      }
    }
  }
  makeSet(scene, tex, rects, cap, kind) {
    const geo = cardGeometry(cap), mat = cardMaterial(tex, rects);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData.grass = kind;
    mesh.visible = false;
    scene.add(mesh);
    return { kind, mesh, geo, cap, rects, n: 0 };
  }
  setEnabled(on) { this.on = !!on; if (!on) this.hideAll(); else this.dirty = true; }
  hideAll() { for (const s of this.sets) s.mesh.visible = false; if (this.blades) this.blades.mesh.visible = false; }
  clear() { this.hideAll(); this.center = null; }
  info() {
    return { on: this.on, cards: this.cards, tiles: this.active.length, cached: this.tiles.size, grass: this.sets[0] ? this.sets[0].n : 0, flowers: this.sets[1] ? this.sets[1].n : 0, blades: this.blades ? this.blades.mesh.count : 0, cuts: this.cuts, sfx: this.sfxN || 0, tris: (this.sets.reduce((a, s) => a + s.n, 0) * 4) + (this.blades ? this.blades.mesh.count * 42 : 0) };
  }

  /** density (clumps / m²) and tint under a point: grassy splat layers, nothing on paths / sand / snow / dirt / rock */
  ground(x, z, out) {
    const W = this.W, h = W.hAt(x, z);
    if (h < 0.18 || W.slopeAt(x, z) > 0.8) return 0;
    if (W.pathDAt && W.pathDAt(x, z) < T.pathD) return 0;
    if (W.bridgeAt && W.bridges && W.bridges.length && W.bridgeAt(x, z) !== null) return 0;
    if (!W.splatA || !W.splatB || !W.splatK) {   // the splat layout changed (WP8): plain grass wherever the footsteps say grass
      if (!W.surfaceAt || W.surfaceAt(x, z) !== 'grass') return 0;
      out.g = 1; out.f = 0; out.m = 0; out.y = h;
      return T.dens.grass;
    }
    const k = W.splatK(x, z), A = W.splatA, B = W.splatB;
    const g = A[k * 4], f = A[k * 4 + 1], m = A[k * 4 + 2], other = A[k * 4 + 3] + B[k * 4] + B[k * 4 + 1] + B[k * 4 + 2];
    const tot = g + f + m + other + 1e-6, green = (g + f + m) / tot;
    if (green < T.minK) return 0;
    const D = T.dens, w = 1 / Math.max(1e-6, g + f + m);
    out.g = g * w; out.f = f * w; out.m = m * w; out.y = h;
    return (g * D.grass + f * D.forest + m * D.meadow) * w * smoothstep01((green - T.minK) / 0.3);
  }
  /** a tile's clumps (deterministic for its coordinates) */
  tile(ti, tj) {
    const key = ti * 4096 + tj;
    let t = this.tiles.get(key);
    if (t) { t.used = this.game.time; return t; }
    const W = this.W, S = T.tile, x0 = ti * S, z0 = tj * S, maxD = 9.5;
    const nCand = Math.ceil(S * S * maxD), g = [], f = [], o = { g: 0, f: 0, m: 0, y: 0 };
    const near = [];
    for (let i = 0; i < nCand; i++) {
      const r1 = hash2(ti * 977 + i, tj * 613 - i, 11), r2 = hash2(ti * 131 - i, tj * 257 + i * 3, 12), r3 = hash2(i * 7 + ti, i * 13 + tj, 13);
      const x = x0 + r1 * S, z = z0 + r2 * S;
      const dens = this.ground(x, z, o);
      if (dens <= 0) continue;
      const flowerP = (o.m * T.flowers.meadow + o.g * T.flowers.grass + o.f * T.flowers.forest) / maxD;
      const isFlower = r3 < flowerP, grassP = dens / maxD;
      if (!isFlower && r3 > flowerP + grassP) continue;
      // inside a solid collider (house plinth, rock, trunk): no grass
      W.nearColliders(x, z, 0.3, near);
      if (near.some((c) => c.active !== false && (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + 0.05) ** 2)) continue;
      const r4 = hash2(i * 31 + ti, tj * 17 - i, 14), r5 = hash2(i * 3 - ti, tj + i * 29, 15);
      let cell, hr;
      if (isFlower) { cell = Math.floor(r4 * 4) % 4; hr = H.flower; }
      else {
        // seed heads in the meadow, airy blades in the woods, clover patches in village grass
        const wS = 1, wA = 0.8 + o.f * 1.6, wC = 0.25 + o.g * 0.9 * (hash2(Math.floor(x / 3), Math.floor(z / 3), 16) > 0.55 ? 1 : 0.2), wH = 0.15 + o.m * 1.4;
        const sum = wS + wA + wC + wH, q = r4 * sum;
        cell = q < wS ? 0 : q < wS + wA ? 1 : q < wS + wA + wC ? 2 : 3;
        hr = H[GRASS_CELLS[cell]];
      }
      const h = hr[0] + (hr[1] - hr[0]) * r5;
      const tint = [0, 0, 0];
      const TN = this.tint;
      for (let c = 0; c < 3; c++) tint[c] = (TN.grass[c] * o.g + TN.forest[c] * o.f + TN.meadow[c] * o.m) * (0.92 + 0.16 * hash2(i, ti + tj, 17));
      if (isFlower) for (let c = 0; c < 3; c++) tint[c] = 0.75 + 0.25 * tint[c];
      (isFlower ? f : g).push(x, o.y - 0.03, z, r1 * 6.283 + r2 * 3.1, h, 0, cell, tint[0], tint[1], tint[2], isFlower ? 1 : 0, 0);
    }
    t = { ti, tj, key, used: this.game.time, data: [new Float32Array(g), new Float32Array(f)], cutT: [new Float32Array(g.length / STRIDE), new Float32Array(f.length / STRIDE)], slots: [null, null] };
    this.tiles.set(key, t);
    if (this.tiles.size > 320) {   // forget the oldest tiles (their cut state goes with them: they regrow)
      const keep = new Set((this.want || []).map((w) => w[0] * 4096 + w[1]));
      const old = [...this.tiles.values()].filter((o2) => !keep.has(o2.key)).sort((a, b) => a.used - b.used).slice(0, 80);
      for (const o2 of old) this.tiles.delete(o2.key);
    }
    return t;
  }

  /** per render frame: when the camera enters another tile (or cut grass regrew) the window is re-listed and the
   *  instance buffers re-filled. Tiles nearer than syncR are made at once; the rest (and a prefetch ring one tile beyond
   *  the window, so walking finds its next row ready) are made within budgetMs per frame, re-filling every refillEvery
   *  frames while the window is still filling (a teleport), so no frame pays for a whole window */
  update(cam, dt, force = false) {
    if (!this.on) return;
    const S = T.tile, ti = Math.floor(cam.position.x / S), tj = Math.floor(cam.position.z / S);
    this.frame = (this.frame || 0) + 1;
    this.regrowT -= dt;
    if (this.regrowT <= 0) { this.regrowT = 0.5; this.regrow(cam); }
    if (force || this.dirty || !this.center || this.center[0] !== ti || this.center[1] !== tj) {
      this.center = [ti, tj]; this.dirty = false;
      const R = T.radius + S * 0.75, n = Math.ceil(R / S) + 1, want = [], ring = [];
      for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
        const cx = (ti + i + 0.5) * S - cam.position.x, cz = (tj + j + 0.5) * S - cam.position.z, d = Math.hypot(cx, cz);
        if (d <= R + S * 0.71) want.push([ti + i, tj + j, d]);
        else if (d <= R + S * 1.71) ring.push([ti + i, tj + j, d]);
      }
      want.sort((a, b) => a[2] - b[2]); ring.sort((a, b) => a[2] - b[2]);
      this.want = want; this.queue = [];
      for (const w of want) if (!this.tiles.has(w[0] * 4096 + w[1]) && (force || w[2] < T.syncR)) this.tile(w[0], w[1]);
      for (const w of want) if (!this.tiles.has(w[0] * 4096 + w[1])) this.queue.push(w);
      this.missing = this.queue.length;
      for (const w of ring) if (!this.tiles.has(w[0] * 4096 + w[1])) this.queue.push(w);
      this.refill();
      return;
    }
    if (!this.queue || !this.queue.length) return;
    const t0 = performance.now();
    let made = 0;
    while (this.queue.length && performance.now() - t0 < T.budgetMs) {
      const w = this.queue.shift();
      if (this.tiles.has(w[0] * 4096 + w[1])) continue;
      this.tile(w[0], w[1]);
      if (this.missing > 0) { this.missing--; made++; }
    }
    if (made) this.pendingFill = true;
    if (this.pendingFill && (this.missing === 0 || this.frame - (this.lastFill || 0) >= T.refillEvery)) this.refill();
  }
  refill() {
    this.active = [];
    for (const w of this.want) { const t = this.tiles.get(w[0] * 4096 + w[1]); if (t) { t.used = this.game.time; this.active.push(t); } }
    this.pendingFill = false; this.lastFill = this.frame;
    if (this.cards) this.fillCards(); else this.fillBlades(this.game.camera);
  }
  fillCards() {
    // a card that cannot come inside the fade end before the next refill (the camera moves ≤ about one tile before the
    // window is re-listed) is not drawn at all: it would only be a zero-size instance (vertex work)
    const cam = this.game.camera.position, cx = cam.x, cz = cam.z, keepR2 = (T.fade[1] + T.tile * 1.5) ** 2;
    this.sets.forEach((s, si) => {
      const a = s.geo.attributes, P = a.iPos.array, C = a.iCard.array, Tn = a.iTint.array, rects = s.rects;
      let n = 0;
      for (const t of this.active) {
        const d = t.data[si], cut = t.cutT[si], sl = t.slots[si] || (t.slots[si] = new Int32Array(d.length / STRIDE));
        sl.fill(-1);
        for (let i = 0, c = 0; i < d.length; i += STRIDE, c++) {
          if (n >= s.cap) break;
          if ((d[i] - cx) ** 2 + (d[i + 2] - cz) ** 2 > keepR2) continue;
          sl[c] = n;
          const r = rects[d[i + 6]] || rects[0];
          const live = cut[c] <= 0, h = live ? d[i + 4] : 0;
          P[n * 4] = d[i]; P[n * 4 + 1] = d[i + 1]; P[n * 4 + 2] = d[i + 2]; P[n * 4 + 3] = d[i + 3];
          C[n * 4] = h; C[n * 4 + 1] = h * (r ? r.aspect : 0.7); C[n * 4 + 2] = d[i + 6]; C[n * 4 + 3] = 0;
          Tn[n * 3] = d[i + 7]; Tn[n * 3 + 1] = d[i + 8]; Tn[n * 3 + 2] = d[i + 9];
          n++;
        }
      }
      s.n = n; s.geo.instanceCount = n; s.mesh.visible = n > 0;
      for (const k of ['iPos', 'iCard', 'iTint']) { const at = a[k]; at.clearUpdateRanges(); at.addUpdateRange(0, Math.max(1, n) * at.itemSize); at.needsUpdate = true; }
    });
  }
  fillBlades(cam) {
    const B = this.blades;
    if (!B) return;
    const arr = B.mesh.instanceMatrix.array, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (const t of this.active) {
      const d = t.data[0], cut = t.cutT[0];
      for (let i = 0, c = 0; i < d.length; i += STRIDE, c++) {
        if (c % 3 || cut[c] > 0 || n >= B.cap) continue;
        if ((d[i] - cam.position.x) ** 2 + (d[i + 2] - cam.position.z) ** 2 > 15 * 15) continue;
        q.setFromAxisAngle(up, d[i + 3]); p.set(d[i], d[i + 1] + 0.03, d[i + 2]); s.setScalar(T.blades * (0.8 + d[i + 4]));
        m.compose(p, q, s).toArray(arr, n * 16); n++;
      }
    }
    B.mesh.count = n; B.mesh.visible = n > 0;
    const im = B.mesh.instanceMatrix; im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(1, n) * 16); im.needsUpdate = true;
  }

  /** each fixed step while the sword's hit window is open: cut the cards the swing volume sweeps (wp7-perf afterStep) */
  cut(game, s) {
    if (!this.on || !this.active.length) return 0;
    const pl = game.player, R = (pl.reach || 1.6) + 1, hb = {};
    // one 'leaves' sound and at most clipFx bursts per swing (cut() runs on every step of the hit window)
    if (this.swing !== pl.swingId) { this.swing = pl.swingId; this.swingFx = 0; this.swingSfx = false; }
    let n = 0, fx = this.swingFx;
    this.active.forEach((t) => {
      const S = T.tile, x0 = t.ti * S, z0 = t.tj * S;
      if (pl.pos.x < x0 - R || pl.pos.x > x0 + S + R || pl.pos.z < z0 - R || pl.pos.z > z0 + S + R) return;
      for (let si = 0; si < 2; si++) {
        const d = t.data[si], cut = t.cutT[si];
        for (let i = 0, c = 0; i < d.length; i += STRIDE, c++) {
          if (cut[c] > 0) continue;
          const dx = d[i] - pl.pos.x, dz = d[i + 2] - pl.pos.z;
          if (dx * dx + dz * dz > R * R) continue;
          hb.x = d[i]; hb.z = d[i + 2]; hb.r = T.cutR; hb.y0 = d[i + 1]; hb.y1 = d[i + 1] + d[i + 4];
          if (!swordTest(hb, s)) continue;
          cut[c] = T.regrow[0] + (T.regrow[1] - T.regrow[0]) * hash2(c, t.key, 18);
          n++;
          if (fx < T.clipFx && game.fx) { fx++; (game.fx.clippings || game.fx.leaves).call(game.fx, d[i], d[i + 1] + d[i + 4] * 0.6, d[i + 2], 3, si ? [0xffffff, 0xffe27a, 0x9ad04e] : [0x8cc63a, 0xb9f07a, 0x9ad04e]); }
          this.zero(t, si, c);
        }
      }
    });
    this.swingFx = fx;
    if (n) {
      this.cuts += n;
      if (!this.swingSfx) { this.swingSfx = true; this.sfxN = (this.sfxN || 0) + 1; sfx('leaves', { x: pl.pos.x, y: pl.pos.y + 0.3, z: pl.pos.z, vol: Math.min(1, 0.5 + n * 0.06) }); }
    }
    return n;
  }
  zero(t, si, c) {
    if (!this.cards) { this.dirty = true; return; }
    const s = this.sets[si];
    if (!s) return;
    const k = t.slots[si] ? t.slots[si][c] : -1, at = s.geo.attributes.iCard;
    if (k < 0 || k >= s.n) return;
    at.array[k * 4] = 0; at.array[k * 4 + 1] = 0;
    at.addUpdateRange(k * 4, 2); at.needsUpdate = true;
  }
  /** cut cards grow back once their timer ran out and they are out of view (beyond regrowNear or behind the eye) */
  regrow(cam) {
    let any = false;
    const yaw = this.game.view.yaw, vx = Math.sin(yaw), vz = Math.cos(yaw), cosH = Math.cos(((this.game.view.fovH || 100) / 2 + 15) * Math.PI / 180);
    for (const t of this.tiles.values()) {
      for (let si = 0; si < 2; si++) {
        const d = t.data[si], cut = t.cutT[si];
        for (let i = 0, c = 0; i < cut.length; i++, c++) {
          if (cut[c] <= 0) continue;
          cut[c] = Math.max(0.001, cut[c] - 0.5);
          if (cut[c] > 0.001) continue;
          const dx = d[i * STRIDE] - cam.position.x, dz = d[i * STRIDE + 2] - cam.position.z, dd = Math.hypot(dx, dz);
          if (dd < T.regrowNear || (dd < T.radius + 2 && dx * vx + dz * vz > cosH * dd)) continue;
          cut[c] = 0; any = true;
        }
      }
    }
    if (any) this.dirty = true;
  }
}
const smoothstep01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
