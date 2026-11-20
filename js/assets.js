// Asset loading (arch §12): textures, billboards (sky sprites), GLB models, UI images; every manifest key may be absent
// and any file may 404 or fail to decode: it is then treated as absent (procedural fallback, never a thrown error; one
// console.info listing them under ?debug=1). Manifest entries are 'path' or { src, lo?, atlas?, deferred?, eager?,
// wrap?: 'repeat' | 'clamp', srgb?, mips?, height? (models) }; .png / .jpg / .webp all work. New keys need no code:
// - textures: Repeat, aniso, sRGB. Keys ending in _hd (or deferred: true) load after the title (loadDeferred). lo = a
//   smaller file of the same art: an _hd key loads its lo while HD is not allowed (quality 'low', a coarse pointer or
//   maxTextureSize < 2048; an _hd key without lo then loads nothing), any other key while quality is low / on phones.
//   One slot per key: Assets.textures[k] holds whichever file is loaded (texture.userData.lo marks the small one).
//   Raising the quality fetches the full files (an _hd key never loaded, or one holding its lo) and announces each
//   through onTex; lowering it downloads nothing and keeps what is resident.
//   tex('grass') returns grass_hd (full or lo, whichever is loaded) → grass → a solid colour.
// - billboards (new section): ClampToEdge, mipmaps, sRGB (clouds, horizon isles, sun, moon).
// - atlas: a JSON file of named cells loaded with the image → Assets.atlas[key] (texture.userData.atlas).
// ?noassets=<csv> hides sections (textures, billboards, models, sprites, ui), 'hd' (every *_hd key) or single keys.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, sharedOutline, outlineGeometry, punchHull } from './toon.js';
import { G } from './core.js';
import { settings } from './settings.js';
import { atmo as TA } from './tune.js';

const SECTIONS = ['textures', 'billboards', 'models', 'sprites', 'ui'];
const SOLID = { grass: '#8ccf63', forest: '#5f9a4f', meadow: '#a9da78', sand: '#f1dba2', snow: '#eef5fb', dirt: '#c4935d', water: '#57bfe6', rock: '#a49a90', cobble: '#b8aca0', planks: '#c88a4a', cliff: '#9a8e80' };
const entry = (v) => (v ? (typeof v === 'string' ? { src: v } : v) : null);
function srcOf(v) { const e = entry(v); return e ? e.src : null; }
const isHd = (k) => /_hd$/.test(k);
const listeners = [];
const inflight = new Map();
const solidCache = new Map();

export const Assets = {
  textures: {}, billboards: {}, gltf: {}, modelInfo: {}, images: {}, atlas: {}, maxAniso: 4,
  // performance.now() of the first loadDeferred() call and of each texture's first arrival through it (WP8 acceptance: HD
  // in ≤ 5 s; a later quality change that swaps a texture to its lo file and back does not move it)
  deferredAt: null, arrivals: {},
  missing: [],          // 'section.key (reason)': failed / undecodable / disabled by ?noassets / skipped by the HD policy
  failed: new Set(),    // 'section.key' that are absent at runtime (url() returns null for them)
  noassets: [],         // the ?noassets tokens
  hdOk: true,           // HD textures allowed (loadAll; re-evaluated when settings.quality changes)
  lowRes: false,        // low quality / phone: entries with `lo` use it
  /** manifest entry ({ src, ... }) or null when absent / disabled */
  entry(section, key) { const M = window.ASSET_MANIFEST || {}; return this.failed.has(section + '.' + key) ? null : entry(M[section] && M[section][key]); },
  /** file URL of a present key (null when absent, disabled or failed): for <img> / CSS users */
  url(section, key) { const e = this.entry(section, key); return e ? e.src : null; },
  has(section, key) { return section === 'textures' || section === 'billboards' ? !!this[section][key] : section === 'models' ? !!this.gltf[key] : !!this.url(section, key); },
  /**
   * A texture, never null: tex(key, ...fallbackKeys, opts?) tries base_hd (unless opts.hd === false; it holds the full
   * HD file, or its lo while HD is not allowed: the loader decides which one, see the header), key, the base key without
   * _hd/_lo, then each fallback key, in textures then billboards; else opts.make() if given, else a 4×4 solid colour
   * (opts.color, a per-terrain default, or grey; texture.userData.fallback = true). Call it again from an onTex
   * listener to pick up a file that arrived later (deferred HD, a quality raise replacing a lo).
   */
  tex(key, ...rest) {
    const o = rest.length && typeof rest[rest.length - 1] === 'object' ? rest.pop() : {};
    const base = key.replace(/_lo$/, '').replace(/_hd$/, ''), chain = [];
    if (o.hd !== false) chain.push(base + '_hd');
    chain.push(key, base, ...rest, ...(o.fallback ? [].concat(o.fallback) : []));
    for (const k of chain) { const t = this.textures[k] || this.billboards[k]; if (t) return t; }
    if (o.make) { try { const t = o.make(); if (t) return t; } catch (e) { /* fall through */ } }
    return solidTex(o.color || SOLID[base] || '#9a9a9a', o.wrap === 'clamp');
  },
  /** fn(key, texture, section) whenever a texture arrives (deferred HD swaps); returns off() */
  onTex(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  /** load deferred textures / billboards (default: every deferred key not loaded yet, and every key holding its lo
   *  once the policy allows the full file) after the title is up; never rejects → { loaded: [keys], failed: [keys] };
   *  arrivals notify onTex listeners */
  loadDeferred(keys = null) { return loadDeferred(keys); },
};
G.assets = Assets;

/** ?noassets=<csv>: drop sections / keys from the manifest before anything reads it (UI sprites included) */
(function applyNoAssets() {
  const q = location.search.match(/[?&]noassets=([^&]*)/);
  if (!q) return;
  const toks = decodeURIComponent(q[1]).split(',').map((s) => s.trim()).filter(Boolean);
  Assets.noassets = toks;
  const M = window.ASSET_MANIFEST || {};
  for (const sec of SECTIONS) {
    const S = M[sec];
    if (!S) continue;
    for (const k of Object.keys(S)) {
      if (toks.includes('all') || toks.includes(sec) || toks.includes(k) || toks.includes(sec + '.' + k) || (toks.includes('hd') && isHd(k))) {
        delete S[k];
        Assets.missing.push(sec + '.' + k + ' (noassets)');
      }
    }
  }
})();

function solidTex(css, clamp) {
  const id = css + (clamp ? '|c' : '');
  if (solidCache.has(id)) return solidCache.get(id);
  const c = document.createElement('canvas'); c.width = c.height = 4;
  const x = c.getContext('2d'); x.fillStyle = css; x.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.userData.fallback = true;
  solidCache.set(id, t);
  return t;
}

const texLoader = new THREE.TextureLoader();
/** which file of an entry the policy wants now: an _hd key's lo while HD is not allowed, another key's lo on low res */
const wantLo = (k, e) => !!e.lo && (isHd(k) ? !Assets.hdOk : Assets.lowRes);
/** one texture-like entry → THREE.Texture (rejects on 404 / decode failure; the caller records it as absent). lo: load
 *  the entry's lo file (and its loAtlas). Resolves null when a full file already took the slot (a quality raise while
 *  the lo was in flight): the small file never replaces the full one */
async function loadTexture(section, key, e, lo = wantLo(key, e), replace = false) {
  const t = await texLoader.loadAsync(lo ? e.lo : e.src);
  const clamp = e.wrap ? e.wrap === 'clamp' : section === 'billboards';
  t.colorSpace = e.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.generateMipmaps = e.mips !== false;
  t.anisotropy = section === 'textures' ? Assets.maxAniso : 1;
  t.userData.key = key; t.userData.lo = lo;
  const aj = (lo && e.loAtlas) || e.atlas || e.json;
  let atlas = null;
  if (aj) {
    try { const r = await fetch(aj); if (!r.ok) throw new Error(r.status); atlas = t.userData.atlas = await r.json(); }
    catch (err) { Assets.missing.push(section + '.' + key + ' atlas (' + (err && err.message) + ')'); }
  }
  const cur = Assets[section][key];
  if (lo && cur && !cur.userData.lo && !replace) return null;   // (replace: the quality was lowered, see lowerQuality)
  Assets[section][key] = t;
  if (atlas) Assets.atlas[key] = atlas;
  return t;
}
function absent(section, key, why) {
  Assets.failed.add(section + '.' + key);
  Assets.missing.push(section + '.' + key + ' (' + why + ')');
}
const deferredOf = (k, e) => e.deferred === true || (isHd(k) && e.deferred !== false);

function loadDeferred(keys) {
  const M = window.ASSET_MANIFEST || {}, want = [];
  for (const sec of ['textures', 'billboards']) {
    for (const [k, v] of Object.entries(M[sec] || {})) {
      const e = entry(v);
      if (!e || !e.src || Assets.failed.has(sec + '.' + k)) continue;
      const cur = Assets[sec][k], lo = wantLo(k, e);
      if (cur && !(cur.userData.lo && !lo)) continue;           // loaded (a lo copy waits until the full file is allowed)
      if (!(keys ? keys.includes(k) : deferredOf(k, e) || cur)) continue;
      if (isHd(k) && !Assets.hdOk && !lo) continue;             // HD policy: never the full file on low / phones / small GPUs
      if (lo && Assets.failed.has(sec + '.' + k + '|lo')) continue;
      want.push([sec, k, e, lo]);
    }
  }
  const loaded = [], failed = [];
  if (Assets.deferredAt == null) Assets.deferredAt = performance.now();
  return Promise.all(want.map(([sec, k, e, lo]) => {
    const id = sec + '.' + k + (lo ? '|lo' : '');
    if (!inflight.has(id)) inflight.set(id, loadTexture(sec, k, e, lo));
    return inflight.get(id).then((t) => {
      if (!t) return;
      loaded.push(k);
      if (Assets.arrivals[k] == null) Assets.arrivals[k] = performance.now();   // the first arrival (a quality change re-announces it)
      for (const fn of listeners.slice()) { try { fn(k, t, sec); } catch (err) { /* a listener never breaks loading */ } }
    }, () => {
      if (!failed.includes(k)) failed.push(k);
      if (Assets.failed.has(lo ? id : sec + '.' + k)) return;   // a second caller of the same failed load
      if (lo) { Assets.failed.add(id); Assets.missing.push(sec + '.' + k + ' lo (failed)'); } // the full file may still come
      else absent(sec, k, 'failed');
    });
  })).then(() => {
    if (G.debugOn && failed.length) console.info('[Starseed] deferred assets absent (fallbacks in use):', failed.join(', '));
    return { loaded, failed };
  }, () => ({ loaded, failed }));
}

/** quality lowered while playing (RULINGS: low = lo textures): every resident full _hd texture is replaced by its lo file
 *  (announced through onTex, so the terrain / water swap their slots; the quality listener already lowered the resident
 *  anisotropy). The replaced full files are not disposed (an owner may still hold one until its swap; ARCHITECTURE §14) */
function lowerQuality() {
  const M = (window.ASSET_MANIFEST && window.ASSET_MANIFEST.textures) || {};
  const swap = [];
  for (const [k, v] of Object.entries(M)) {
    const e = entry(v), cur = Assets.textures[k];
    if (isHd(k) && e && e.lo && cur && !cur.userData.lo && !Assets.failed.has('textures.' + k + '|lo')) swap.push([k, e]);
  }
  return Promise.all(swap.map(([k, e]) => loadTexture('textures', k, e, true, true).then((t) => {
    if (!t) return;
    inflight.delete('textures.' + k);   // a later raise loads the full file again (its old promise holds the replaced one)
    for (const fn of listeners.slice()) { try { fn(k, t, 'textures'); } catch (err) { /* a listener never breaks loading */ } }
  }, () => { Assets.failed.add('textures.' + k + '|lo'); Assets.missing.push('textures.' + k + ' lo (failed)'); })));
}

function proceduralRockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#a49a90';
  x.fillRect(0, 0, 256, 256);
  // soft facets
  let s = 1234;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const px = r() * 256, py = r() * 256, rad = 10 + r() * 34;
    const l = 140 + r() * 50;
    x.fillStyle = `rgba(${l + 10},${l},${l - 12},0.35)`;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      x.beginPath();
      x.moveTo(px + ox, py + oy - rad);
      x.lineTo(px + ox + rad, py + oy - rad * 0.2);
      x.lineTo(px + ox + rad * 0.5, py + oy + rad);
      x.lineTo(px + ox - rad * 0.8, py + oy + rad * 0.6);
      x.closePath();
      x.fill();
    }
  }
  for (let i = 0; i < 60; i++) {
    const px = r() * 256, py = r() * 256;
    x.strokeStyle = 'rgba(90,80,72,0.35)';
    x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 40, py + (r() - 0.5) * 40); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadAll(renderer, onProgress) {
  const M = window.ASSET_MANIFEST || {};
  const caps = renderer.capabilities, gpuAniso = caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 4;
  let coarse = false;
  try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { /* ignore */ }
  // HD policy, live: a quality change re-evaluates it. Raising it fetches the full files (deferred HD never loaded, and
  // every key holding its lo), which onTex listeners swap in; lowering it downloads nothing and keeps what is resident
  const policy = () => {
    Assets.lowRes = settings.get('quality') === 'low' || coarse;
    Assets.hdOk = !Assets.lowRes && (caps.maxTextureSize || 0) >= 2048;
    // grazing-angle ground at eye level needs strong anisotropic filtering (WP8: 16 on desktop, 4 on phones / low);
    // applies to textures loaded from now on
    Assets.maxAniso = Math.max(1, Math.min(Assets.lowRes ? TA.anisoLow : TA.aniso, gpuAniso));
  };
  policy();
  settings.on('quality', () => {
    const was = [Assets.hdOk, Assets.lowRes];
    policy();
    // resident textures follow the new anisotropy (a sampler setting: re-uploaded once)
    for (const t of Object.values(Assets.textures)) if (t && !t.userData.fallback && t.anisotropy !== Assets.maxAniso) { t.anisotropy = Assets.maxAniso; t.needsUpdate = true; }
    if ((Assets.hdOk && !was[0]) || (was[1] && !Assets.lowRes)) loadDeferred(null);
    else if (!Assets.hdOk && was[0]) lowerQuality();
  });
  const jobs = [];
  for (const sec of ['textures', 'billboards']) {
    for (const [k, v] of Object.entries(M[sec] || {})) {
      const e = entry(v);
      if (!e || !e.src || deferredOf(k, e)) continue;  // deferred keys come after the title (loadDeferred)
      // a missing lo falls back to the full file (never for an _hd key HD is not allowed for)
      const lo = wantLo(k, e), full = () => (lo && !(isHd(k) && !Assets.hdOk) ? loadTexture(sec, k, e, false) : Promise.reject());
      jobs.push(() => loadTexture(sec, k, e, lo).catch(full).catch(() => absent(sec, k, 'failed')));
    }
  }
  const gl = new GLTFLoader();
  try { gl.setMeshoptDecoder(MeshoptDecoder); } catch (e) { /* optional */ }
  for (const [k, v] of Object.entries(M.models || {})) {
    const src = srcOf(v);
    if (!src) continue;
    jobs.push(() => gl.loadAsync(src).then((g) => {
      if (!g || !(g.scene || (g.scenes && g.scenes[0]))) throw new Error('no scene');
      Assets.gltf[k] = g;
      Assets.modelInfo[k] = { height: (v && v.height) || 1 };
    }).catch(() => absent('models', k, 'failed')));
  }
  for (const [k, v] of Object.entries(M.ui || {})) {
    const e = entry(v);
    if (!e || !e.src || !(k === 'title' || e.eager)) continue;   // other UI images load where they are shown
    jobs.push(() => new Promise((res) => {
      const im = new Image();
      im.onload = () => { Assets.images[k] = im; res(); };
      im.onerror = () => { absent('ui', k, 'failed'); res(); };
      im.src = e.src;
    }));
  }
  // UI sprites used constantly — warm the cache so HUD icons pop in instantly
  for (const k of ['heart', 'heart_empty', 'coin', 'potion', 'seed_forest', 'seed_frost', 'seed_sea', 'heart_container', 'sword_shiny', 'sword_wood']) {
    const src = srcOf(M.sprites && M.sprites[k]);
    if (!src) continue;
    jobs.push(() => new Promise((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => { absent('sprites', k, 'failed'); res(); }; im.src = src; }));
  }
  let done = 0;
  const total = jobs.length || 1;
  onProgress && onProgress(0);
  await Promise.all(jobs.map((j) => Promise.resolve().then(j).catch(() => {}).finally(() => {
    done++;
    onProgress && onProgress(done / total);
  })));
  if (!Assets.textures.rock) Assets.textures.rock = (() => {
    const t = proceduralRockTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Assets.maxAniso;
    return t;
  })();
  for (const k of ['grass', 'forest', 'meadow', 'sand', 'snow', 'dirt', 'water']) if (!Assets.textures[k]) Assets.textures[k] = solidTex(SOLID[k]);
  if (G.debugOn && Assets.missing.length) console.info('[Starseed] assets absent (fallbacks in use):', Assets.missing.join(', '));
}

export function hasModel(key) { return !!Assets.gltf[key]; }

const templCache = {};
const cfgByMat = new WeakMap();   // source material → toon config
const olByGeo = new WeakMap();    // source geometry → smooth outline hull
function template(key) {
  if (templCache[key]) return templCache[key];
  const g = Assets.gltf[key];
  if (!g) return null;
  const root = g.scene || (g.scenes && g.scenes[0]);
  if (!root) return null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (src && !cfgByMat.has(src)) {
      const map = src.map || null;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      cfgByMat.set(src, {
        map,
        color: src.color ? src.color.clone() : new THREE.Color(1, 1, 1),
        vc: !!o.geometry.attributes.color,
        transparent: !!src.transparent,
        opacity: src.opacity ?? 1,
      });
    }
    if (!olByGeo.has(o.geometry)) {
      let ol = null;
      try {
        ol = outlineGeometry([o.geometry]);
        if (Array.isArray(o.userData.olHoles)) punchHull(ol, o.userData.olHoles);   // node extras: where no ink belongs
      } catch (e) { ol = null; }
      olByGeo.set(o.geometry, ol);
    }
  });
  templCache[key] = root;
  return root;
}

/**
 * Instantiate a GLB model as toon-shaded group, scaled to its manifest height.
 * Returns { group, materials, height } or null if the key is absent.
 * Pipeline guarantee: origin at feet, facing +Z, 1 unit tall → uniform scale by `height`.
 */
export function makeModel(key, o = {}) {
  let t;
  try { t = template(key); } catch (e) { console.warn('[Starseed] model template failed', key, e); return null; }
  if (!t) return null;
  const height = (o.height ?? Assets.modelInfo[key].height) || 1;
  const inst = skeletonClone(t);
  const materials = [];
  const outlines = [];
  const olMat = sharedOutline(o.outline || 'char');
  const matCache = new Map();
  inst.traverse((m) => {
    if (!m.isMesh) return;
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    let mat = matCache.get(src);
    if (!mat) {
      const cfg = cfgByMat.get(src) || { color: new THREE.Color(1, 1, 1) };
      mat = toonMat({ map: cfg.map, color: cfg.color, vc: cfg.vc, transparent: cfg.transparent, opacity: cfg.opacity, rim: 0.8, occ: !!o.occ, grad: o.grad });
      matCache.set(src, mat);
      materials.push(mat);
    }
    m.material = mat;
    m.castShadow = o.cast !== false;
    m.receiveShadow = !!o.receive;
    const ol = olByGeo.get(m.geometry);
    if (ol && !m.isSkinnedMesh) outlines.push([m, ol]);
  });
  for (const [m, g] of outlines) {
    const ol = new THREE.Mesh(g, olMat);
    ol.castShadow = false;
    ol.raycast = () => {};
    m.add(ol);
  }
  const group = new THREE.Group();
  const wrap = new THREE.Group();
  wrap.scale.setScalar(height);
  wrap.add(inst);
  group.add(wrap);
  return { group, materials, height, wrap };
}

export function isDebug() { return G.debugOn; }
