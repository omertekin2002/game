// Asset loading: textures, GLB models (optional, by manifest key), UI images. Every key may be missing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, sharedOutline, outlineGeometry } from './toon.js';
import { G } from './core.js';

export const Assets = { textures: {}, gltf: {}, modelInfo: {}, images: {}, maxAniso: 4 };

function srcOf(v) { return v ? (typeof v === 'string' ? v : v.src) : null; }

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
  Assets.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
  const jobs = [];
  const texLoader = new THREE.TextureLoader();
  for (const [k, v] of Object.entries(M.textures || {})) {
    const src = srcOf(v);
    if (!src) continue;
    jobs.push(() => texLoader.loadAsync(src).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Assets.maxAniso;
      Assets.textures[k] = t;
    }));
  }
  const gl = new GLTFLoader();
  try { gl.setMeshoptDecoder(MeshoptDecoder); } catch (e) { /* optional */ }
  for (const [k, v] of Object.entries(M.models || {})) {
    const src = srcOf(v);
    if (!src) continue;
    jobs.push(() => gl.loadAsync(src).then((g) => {
      Assets.gltf[k] = g;
      Assets.modelInfo[k] = { height: (v && v.height) || 1 };
    }));
  }
  for (const k of ['title']) {
    const src = srcOf(M.ui && M.ui[k]);
    if (!src) continue;
    jobs.push(() => new Promise((res) => {
      const im = new Image();
      im.onload = () => { Assets.images[k] = im; res(); };
      im.onerror = () => res();
      im.src = src;
    }));
  }
  // UI sprites used constantly — warm the cache so HUD icons pop in instantly.
  for (const k of ['heart', 'heart_empty', 'coin', 'potion', 'seed_forest', 'seed_frost', 'seed_sea', 'heart_container', 'sword_shiny', 'sword_wood']) {
    const src = srcOf(M.sprites && M.sprites[k]);
    if (!src) continue;
    jobs.push(() => new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = src; }));
  }
  let done = 0;
  const total = jobs.length || 1;
  onProgress && onProgress(0);
  await Promise.all(jobs.map((j) => j().catch((e) => console.warn('[Starseed] asset failed to load', e)).finally(() => {
    done++;
    onProgress && onProgress(done / total);
  })));
  if (!Assets.textures.rock) Assets.textures.rock = (() => {
    const t = proceduralRockTexture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Assets.maxAniso;
    return t;
  })();
  for (const k of ['grass', 'forest', 'meadow', 'sand', 'snow', 'dirt', 'water']) {
    if (!Assets.textures[k]) {
      const c = document.createElement('canvas'); c.width = c.height = 4;
      const x = c.getContext('2d');
      x.fillStyle = { grass: '#8ccf63', forest: '#5f9a4f', meadow: '#a9da78', sand: '#f1dba2', snow: '#eef5fb', dirt: '#c4935d', water: '#57bfe6' }[k];
      x.fillRect(0, 0, 4, 4);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      Assets.textures[k] = t;
    }
  }
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
      try { ol = outlineGeometry([o.geometry]); } catch (e) { ol = null; }
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
