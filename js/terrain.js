// Terrain chunks (splat-blended toon shading, HD swap, near detail, cliffs, plaza cobble), the sea / river water
// (fresnel to the sky, sun / moon glints, foam lace, wading ripples), minimap image. WP8.
import * as THREE from 'three';
import { SIZE, HALF, N } from './world.js';
import { gradientTex, U } from './toon.js';
import { Assets } from './assets.js';
import { clamp, smoothstep } from './util.js';
import { atmo as TA } from './tune.js';
import { ATMO_GLSL } from './sky.js';
import { G } from './core.js';

const TCH = 45; // cells per terrain chunk

export function noiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const hash = (x, y, c) => {
    let h = (x * 374761393 + y * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const vnoise = (x, y, period, c) => {
    const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const w = (v) => ((v % period) + period) % period;
    const a = hash(w(xi), w(yi), c), b = hash(w(xi + 1), w(yi), c), d = hash(w(xi), w(yi + 1), c), e = hash(w(xi + 1), w(yi + 1), c);
    return (a + (b - a) * sx) + ((d + (e - d) * sx) - (a + (b - a) * sx)) * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (let c = 0; c < 4; c++) {
      let v = 0, amp = 0.55, tot = 0;
      for (let o = 0; o < 3; o++) {
        const period = 4 << o;
        v += amp * vnoise((x / size) * period, (y / size) * period, period, c * 7 + o);
        tot += amp; amp *= 0.5;
      }
      data[(y * size + x) * 4 + c] = clamp((v / tot) * 255, 0, 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

let sharedNoise = null;
export function getNoiseTex() { return sharedNoise || (sharedNoise = noiseTexture(128)); }

/** r3 near-ground grain (RULINGS r3: the ground within ≈ 1.5 m of the eye read as a soft smear — the art is 8–15 mm a
 *  texel against ≈ 1.2 mm a pixel there). Generated at boot, tileable, linear values around 0.5 (no asset, so it also
 *  works with ?noassets): R fine grain (per-texel hash over a soft value noise), G pebbles (a jittered 16 × 16 grid, half
 *  the cells hold a lit rounded pebble with a contact shadow), B sparkle (≈ 1.5 % single bright texels), A mottle (a
 *  32 px value noise: masks the pebbles into patches and phases the sparkle) */
export function grainTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const hash = (x, y, c) => { let h = (x * 374761393 + y * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const wrap = (v, n) => ((v % n) + n) % n;
  const vnoise = (x, y, cell, c) => {
    const n = size / cell, fx = x / cell, fy = y / cell, xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), h = (i, j) => hash(wrap(i, n), wrap(j, n), c);
    const a = h(xi, yi), b = h(xi + 1, yi), d = h(xi, yi + 1), e = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
  };
  const CELL = 16, NC = size / CELL, peb = [];
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) {
    if (hash(i, j, 11) > 0.55) { peb.push(null); continue; }
    const r = 3.2 + hash(i, j, 12) * 3.4, e = 0.7 + hash(i, j, 13) * 0.3, a = hash(i, j, 14) * Math.PI;
    peb.push({ x: (i + 0.25 + hash(i, j, 15) * 0.5) * CELL, y: (j + 0.25 + hash(i, j, 16) * 0.5) * CELL, r, e, ca: Math.cos(a), sa: Math.sin(a), k: 0.75 + hash(i, j, 17) * 0.5 });
  }
  const L = [-0.45, -0.55, 0.7];   // light for the pebbles' baked shading (top-left), normalised below
  const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4;
    // R: grain
    const g = 0.5 + (hash(x, y, 1) - 0.5) * 0.62 + (vnoise(x, y, 4, 2) - 0.5) * 0.38;
    // G: pebbles (the nearest of the 3 × 3 cells around, wrapped)
    let pv = 0.5;
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const P = peb[wrap(cj + dj, NC) * NC + wrap(ci + di, NC)];
      if (!P) continue;
      const dx = wrap(x - P.x + size / 2, size) - size / 2, dy = wrap(y - P.y + size / 2, size) - size / 2;   // tileable
      const u = (dx * P.ca + dy * P.sa) / P.r, v = (-dx * P.sa + dy * P.ca) / (P.r * P.e), nd = Math.hypot(u, v);
      if (nd < 1) {
        const hgt = Math.sqrt(1 - nd * nd), nx = u * 0.8, ny = v * 0.8, nl = Math.hypot(nx, ny, hgt);
        const lam = Math.max(0, (nx * L[0] + ny * L[1] + hgt * L[2]) / nl);
        pv = 0.5 + (lam - 0.62) * 0.55 * P.k + 0.06;
      } else if (nd < 1.4 && pv === 0.5) pv = 0.5 - 0.16 * (1 - (nd - 1) / 0.4);
    }
    // B: sparkle; A: mottle
    const sp = hash(x, y, 7) > 0.985 ? 1 : 0;
    const m = vnoise(x, y, 32, 8) * 0.7 + vnoise(x, y, 8, 9) * 0.3;
    data[o] = clamp(g * 255, 0, 255); data[o + 1] = clamp(pv * 255, 0, 255); data[o + 2] = sp * 255; data[o + 3] = clamp(m * 255, 0, 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 2;   // a 2:1 footprint is enough for a layer gone by 4 m (16 taps on the soft near detail cost ≈ 1 ms)
  t.needsUpdate = true;
  return t;
}
let sharedGrain = null;
export function getGrainTex() { return sharedGrain || (sharedGrain = grainTexture(256)); }

// terrain layers in splat order (splatA: grass forest meadow sand, splatB: snow dirt rock); uv scale per layer
export const TERRAIN_LAYERS = ['grass', 'forest', 'meadow', 'sand', 'snow', 'dirt', 'rock'];
const UNI = { grass: 'tGrass', forest: 'tForest', meadow: 'tMeadow', sand: 'tSand', snow: 'tSnow', dirt: 'tDirt', rock: 'tRock', cliff: 'tCliff', cobble: 'tCobble' };
/** the texture a terrain slot shows now: the HD file (or its lo) when loaded, else the base art, else a fallback */
function layerTex(k) {
  if (k === 'cliff') return Assets.tex('cliff', 'rock');
  if (k === 'cobble') return Assets.tex('cobble', 'dirt');
  return Assets.tex(k);
}
const hasArt = (k) => !!(Assets.textures[k + '_hd'] || Assets.textures[k]);

function terrainMaterial(W) {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientTex('terrain') });
  const uniforms = { tNoise: { value: getNoiseTex() }, tGrain: { value: getGrainTex() } };
  for (const k in UNI) uniforms[UNI[k]] = { value: layerTex(k) };
  const pz = W.plaza || { x: 0, z: 0, r: 11 };
  // x, z, radius, cobble on (only once the cobble art is resident: a flat colour disc would read as a hole)
  uniforms.uPlaza = { value: new THREE.Vector4(pz.x, pz.z, pz.r, hasArt('cobble') ? 1 : 0) };
  uniforms.uDetail = { value: new THREE.Vector4(TA.detailNear, TA.detailFar, TA.detailAmt, TA.plazaEdge) };
  // cliffs: normal y full / start, vertical period (m), horizontal stretch; snow on them from / full at these heights (m)
  uniforms.uCliff = { value: new THREE.Vector4(TA.cliffNy[1], TA.cliffNy[0], TA.cliffPeriod, TA.cliffStretch) };
  uniforms.uCliffSnow = { value: new THREE.Vector3(TA.cliffSnow[0], TA.cliffSnow[1], TA.cliffSoft) };
  uniforms.uRock = { value: new THREE.Vector2(TA.rockScale, TA.rockSoft) };
  // steep faces: rock / snow side-projected from normal y sideNy[0] (none) to sideNy[1] (full); near-detail gain on them
  uniforms.uSide = { value: new THREE.Vector4(TA.sideNy[0], TA.sideNy[1], TA.detailSteep, TA.sideFar) };
  // r3 near-ground grain: full within near, gone by far (m from the camera), amount (0 = off: quality low / phones),
  // metres per tile of the boot-generated grain texture
  uniforms.uGrain = { value: new THREE.Vector4(TA.grain.near, TA.grain.far, TA.grain.amt, TA.grain.tile) };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uNight: U.uNight });
    sh.vertexShader = `
      attribute vec4 splatA; attribute vec4 splatB;
      varying vec4 vSplatA; varying vec4 vSplatB; varying vec3 vWPos; varying vec3 vWNorm;
    ` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vSplatA = splatA; vSplatB = splatB; vWPos = (modelMatrix * vec4(position, 1.0)).xyz; vWNorm = normal;`);
    sh.fragmentShader = `
      uniform sampler2D tGrass, tForest, tMeadow, tSand, tSnow, tDirt, tRock, tNoise, tCliff, tCobble, tGrain;
      uniform vec4 uPlaza, uDetail, uCliff; uniform vec3 uCliffSnow; uniform vec4 uSide; uniform vec2 uRock; uniform vec4 uGrain; uniform float uNight;
      varying vec4 vSplatA; varying vec4 vSplatB; varying vec3 vWPos; varying vec3 vWNorm;
      const vec3 LUM = vec3(0.299, 0.587, 0.114);
      vec3 dirtTone(vec3 dc) { return mix(vec3(dot(dc, vec3(0.3, 0.55, 0.15))), dc, 0.72) * vec3(1.08, 1.04, 1.0); }
      // rock_hd is stacked stones: bigger (uRock.x) and softened toward its own mean (uRock.y) it reads as ledges, not paving
      vec3 rockTone(vec3 rc) { float m = dot(rc, LUM); return mix(rc, vec3(m) * vec3(1.05, 1.0, 0.94), uRock.y); }
      // one layer by index at an explicit mip level (lod: log2 of the uv footprint; the near-detail resample of the
      // dominant layer: one plain trilinear fetch, valid in any branch, no 16-tap anisotropic filter, no gradients)
      float lodOf(sampler2D t, float lod, float k) { return lod + log2(float(textureSize(t, 0).x) * k); }
      vec3 layerLod(int i, vec2 uv, float lod) {
        if (i == 0) return textureLod(tGrass, uv, lodOf(tGrass, lod, 1.0)).rgb;
        if (i == 1) return textureLod(tForest, uv * 1.1, lodOf(tForest, lod, 1.1)).rgb;
        if (i == 2) return textureLod(tMeadow, uv, lodOf(tMeadow, lod, 1.0)).rgb;
        if (i == 3) return textureLod(tSand, uv * 0.9, lodOf(tSand, lod, 0.9)).rgb;
        if (i == 4) return textureLod(tSnow, uv * 0.8, lodOf(tSnow, lod, 0.8)).rgb;
        if (i == 5) return dirtTone(textureLod(tDirt, uv * 1.2, lodOf(tDirt, lod, 1.2)).rgb);
        return rockTone(textureLod(tRock, uv * uRock.x, lodOf(tRock, lod, uRock.x)).rgb);
      }
      // the mip level of a 2:1-anisotropy fetch from uv gradients (dx.xy, dy.zw): the larger axis halved
      float lodOfGrad(vec4 g) { float a = dot(g.xy, g.xy), b = dot(g.zw, g.zw); return 0.5 * log2(max(max(a, b) * 0.25, min(a, b)) + 1e-12); }
      // a ground layer on a steep face: top-down (w.x) blended into the two side projections (w.y on z/y, w.z on x/y, the
      // cliff layer's axis weights), with explicit gradients (textureGrad: valid inside the per-layer branches)
      vec3 projTex(sampler2D t, float k, vec2 tu, vec2 ua, vec2 ub, vec4 gT, vec4 gA, vec4 gB, vec3 w) {
        vec3 c = vec3(0.0); float n = 0.0;
        if (w.x > 0.03) { c += textureGrad(t, tu * k, gT.xy * k, gT.zw * k).rgb * w.x; n += w.x; }
        if (w.y > 0.03) { c += textureGrad(t, ua * k, gA.xy * k, gA.zw * k).rgb * w.y; n += w.y; }
        if (w.z > 0.03) { c += textureGrad(t, ub * k, gB.xy * k, gB.zw * k).rgb * w.z; n += w.z; }
        return c / max(n, 1e-4);
      }
      // the near-detail sample of rock (i 6) / snow (i 4) with the same projection weights, at an explicit mip level
      vec3 projLod(int i, vec2 tu, vec2 ua, vec2 ub, vec3 lod, vec3 w) {
        vec3 c = vec3(0.0); float n = 0.0;
        if (w.x > 0.03) { c += layerLod(i, tu, lod.x) * w.x; n += w.x; }
        if (w.y > 0.03) { c += layerLod(i, ua, lod.y) * w.y; n += w.y; }
        if (w.z > 0.03) { c += layerLod(i, ub, lod.z) * w.z; n += w.z; }
        return c / max(n, 1e-4);
      }
    ` + sh.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      {
        vec2 tuv = vWPos.xz / 7.0;
        // the near detail's mip level (uv footprint of the 4x layer, log2), from the gradients here in uniform control
        // flow: the larger axis halved (an anisotropy of 2:1 in one fetch, a bit soft at grazing angles; the full 16-tap
        // anisotropic filter on this soft overlay cost ≈ 1 ms in the village at 1080p)
        vec4 gT = vec4(dFdx(tuv), dFdy(tuv));
        float dLod = lodOfGrad(gT * 4.0);
        // steep faces (r2): rock and snow are projected from the side there, blended in from normal y uSide.x (≈ 31°) to
        // uSide.y (≈ 52°). Top-down they stretched 1.7–2.2× down the fall line on the peaks' 50–60° faces right at Pip's
        // feet (the smoothed slope field there reads only ≈ 30°), a brown / white smear in both views. Only within uSide.w m
        // (beyond, the stretch is lost in the mips and steep rock gets the cliff layer), one side axis on most faces
        // (a sharp axis blend): ≤ 2 fetches per layer where it applies
        float eyeD = length(vWPos - cameraPosition);
        float sk = (1.0 - smoothstep(uSide.y, uSide.x, vWNorm.y)) * (1.0 - smoothstep(uSide.w * 0.6, uSide.w, eyeD));
        vec2 an = pow(abs(vWNorm.xz) + 1e-3, vec2(4.0));
        an /= an.x + an.y;
        vec2 sa8 = pow(abs(vWNorm.xz) + 1e-3, vec2(8.0));
        sa8 /= sa8.x + sa8.y;
        vec2 sua = vWPos.zy / 7.0, sub = vWPos.xy / 7.0;
        vec4 gA = vec4(dFdx(sua), dFdy(sua)), gB = vec4(dFdx(sub), dFdy(sub));
        vec3 sw = vec3(1.0 - sk, sk * sa8.x, sk * sa8.y);
        vec4 nz = texture2D(tNoise, vWPos.xz * 0.031);
        vec4 nz2 = texture2D(tNoise, vWPos.xz * 0.0071 + 0.31);
        vec4 wa = vSplatA * (0.25 + nz * 1.5);
        vec4 wb = vSplatB * (0.25 + nz.wzyx * 1.5);
        wa = wa * wa * wa; wb = wb * wb * wb;
        float ws = dot(wa, vec4(1.0)) + dot(wb, vec4(1.0)) + 1e-4;
        wa /= ws; wb /= ws;
        // drop faint layers continuously (≤ 3 fetches in practice: arch "top-3 splat weights") and renormalise
        wa = max(wa - 0.05, 0.0); wb = max(wb - 0.05, 0.0);
        ws = dot(wa, vec4(1.0)) + dot(wb, vec4(1.0)) + 1e-4;
        wa /= ws; wb /= ws;
        // village plaza first (cobble_hd on the dirt inside a noisy disc around W.plaza): where it covers the ground
        // fully, the ground layers, the near detail and the cliff are not fetched at all
        float pk = 0.0;
        if (uPlaza.w > 0.5) {
          float pd = length(vWPos.xz - uPlaza.xy) + (nz.y - 0.5) * 2.0 * uDetail.w;
          pk = (1.0 - smoothstep(uPlaza.z - 0.4, uPlaza.z + 0.4, pd)) * smoothstep(0.12, 0.5, wb.y + wa.w);
        }
        vec3 c = vec3(0.0);
        if (pk < 0.995) {
          float top = wa.x; int ti = 0;
          if (wa.y > top) { top = wa.y; ti = 1; } if (wa.z > top) { top = wa.z; ti = 2; } if (wa.w > top) { top = wa.w; ti = 3; }
          if (wb.x > top) { top = wb.x; ti = 4; } if (wb.y > top) { top = wb.y; ti = 5; } if (wb.z > top) { top = wb.z; ti = 6; }
          // the splat sum; ct keeps the dominant layer's sample (the near detail's coarse reference, never fetched twice)
          vec3 s, ct = vec3(0.0);
          if (wa.x > 0.0) { s = texture2D(tGrass, tuv).rgb; c += s * wa.x; if (ti == 0) ct = s; }
          if (wa.y > 0.0) { s = texture2D(tForest, tuv * 1.1).rgb; c += s * wa.y; if (ti == 1) ct = s; }
          if (wa.z > 0.0) { s = texture2D(tMeadow, tuv).rgb; c += s * wa.z; if (ti == 2) ct = s; }
          if (wa.w > 0.0) { s = texture2D(tSand, tuv * 0.9).rgb; c += s * wa.w; if (ti == 3) ct = s; }
          if (wb.x > 0.0) { s = sk > 0.03 ? projTex(tSnow, 0.8, tuv, sua, sub, gT, gA, gB, sw) : texture2D(tSnow, tuv * 0.8).rgb; c += s * wb.x; if (ti == 4) ct = s; }
          if (wb.y > 0.0) { s = dirtTone(texture2D(tDirt, tuv * 1.2).rgb); c += s * wb.y; if (ti == 5) ct = s; }
          if (wb.z > 0.0) { s = rockTone(sk > 0.03 ? projTex(tRock, uRock.x, tuv, sua, sub, gT, gA, gB, sw) : texture2D(tRock, tuv * uRock.x).rgb); c += s * wb.z; if (ti == 6) ct = s; }
          // cliffs: faces ≥ ~50° where rock is the ground layer get cliff_hd projected from the side, stretched along the
          // face (uCliff.w) so the stone rows read as strata / ledges, softened toward its own mean, snow-dusted up high
          float ck = (1.0 - smoothstep(uCliff.x, uCliff.y, vWNorm.y)) * smoothstep(0.3, 0.6, wb.z);
          if (ck > 0.0) {
            vec2 sc = vec2(1.0 / (uCliff.z * uCliff.w), 1.0 / uCliff.z), off = vec2(nz2.x * 0.7, nz2.y * 0.25);
            vec2 ua = vWPos.zy * sc + off, ub = vWPos.xy * sc + off;
            vec3 cl = texture2D(tCliff, ua).rgb * an.x + texture2D(tCliff, ub).rgb * an.y;
            float cm = dot(cl, LUM);
            cl = mix(vec3(cm) * vec3(1.06, 1.0, 0.92), cl, uCliffSnow.z) * 0.95;
            // snow on the ledges up in the peaks (by height, not by the snow splat, which steep faces never carry)
            float sn = smoothstep(uCliffSnow.x, uCliffSnow.y, vWPos.y + (nz.z - 0.5) * 3.0) * smoothstep(0.22, 0.4, cm + (nz.x - 0.5) * 0.2);   // (linear: the brighter stone tops)
            cl = mix(cl, vec3(0.93, 0.96, 1.0), max(sn * 0.7, wb.x * 0.45));
            c = mix(c, cl, ck);
          }
          // near-detail layer: the dominant layer again at 4x frequency, as a luminance contrast around its own mean,
          // fading out by uDetail.y m (fixes the soft first metres at eye level). After the cliff layer (r2: the cliff
          // used to replace it, so the stretched, softened strata stood unrelieved at the feet); on rock / snow with
          // their projection and uSide.z × the gain (their art is soft and large-scale: stones ≈ 1.5 m, snow drifts)
          float dk = (1.0 - smoothstep(uDetail.x, uDetail.y, eyeD)) * uDetail.z * (1.0 - pk);
          bool steep = ti == 4 || ti == 6;
          if (steep) dk *= uSide.z;
          if (dk > 0.004) {
            vec3 fine = steep && sk > 0.03
              ? projLod(ti, tuv * 4.0 + 0.37, sua * 4.0 + 0.37, sub * 4.0 + 0.37, vec3(dLod, lodOfGrad(gA * 4.0), lodOfGrad(gB * 4.0)), sw)
              : layerLod(ti, tuv * 4.0 + 0.37, dLod);
            c *= 1.0 + clamp(dot(fine - ct, LUM) * 1.6, -0.45, 0.45) * min(dk, 1.0);
          }
        }
        if (pk > 0.0) c = mix(c, texture2D(tCobble, vWPos.xz / 3.0).rgb * vec3(0.72, 0.68, 0.63), pk);
        // r3 near-ground grain (RULINGS r3): within uGrain.y m of the camera the ground gets the boot-generated grain
        // texture, two fetches at unrelated scales and rotations (no visible repeat), as a luminance change of the colour
        // already there (so it takes the surface's tint): fine grain on soil / sand / rock / forest floor, pebbles on dirt
        // and rock (in patches, by the other fetch's mottle), a twinkling sparkle on snow and a little on sand (its phase
        // follows the view direction). Steep faces take the side projection's axis (no stretch down the fall line)
        if (eyeD < uGrain.y && uGrain.z > 0.0) {
          float gk = (1.0 - smoothstep(uGrain.x, uGrain.y, eyeD)) * uGrain.z;
          vec2 gp = sk > 0.5 ? (sa8.x > sa8.y ? vWPos.zy : vWPos.xy) : vWPos.xz;
          vec4 g1 = texture2D(tGrain, gp / uGrain.w), g2 = texture2D(tGrain, mat2(0.8, -0.6, 0.6, 0.8) * gp / (uGrain.w * 1.618) + 0.37);
          float wGr = 0.35 * (wa.x + wa.z) + 0.6 * wa.y + wa.w + 0.6 * wb.x + wb.y + 0.85 * wb.z + 0.5 * pk;
          float wPb = (0.12 * (wa.x + wa.z) + 0.3 * wa.y + 0.35 * wa.w + wb.y + 0.75 * wb.z) * (1.0 - pk) * smoothstep(0.38, 0.62, g2.a);
          float grain = (g1.r - 0.5) * 0.55 + (g2.r - 0.5) * 0.45;
          c *= 1.0 + gk * (grain * 0.42 * wGr + (g1.g - 0.5) * 0.9 * wPb);
          float wSp = (wb.x + 0.3 * wa.w) * g1.b;
          if (wSp > 0.01) {
            float tw = fract(g1.a * 5.0 + dot(vWPos - cameraPosition, vec3(9.1, 5.3, 7.7)) / eyeD);
            c += gk * wSp * smoothstep(0.55, 0.8, tw) * 0.9 * (1.0 - 0.75 * uNight);
          }
        }
        // macro variation so tiling does not read
        c *= 0.86 + 0.28 * nz2.x;
        // wet sand darkening just above the waterline
        c *= mix(0.78, 1.0, smoothstep(0.05, 0.55, vWPos.y));
        diffuseColor.rgb *= c;
      }`);
  };
  m.customProgramCacheKey = () => 'terrainSplat6';
  return m;
}

/** swap terrain slots to newly arrived files (deferred HD, a quality raise replacing a lo); → off() */
export function watchTerrainTextures(mat) {
  const u = mat.userData.uniforms;
  return Assets.onTex((key) => {
    const base = key.replace(/_hd$/, '');
    const touch = base === 'rock' ? ['rock', 'cliff'] : base === 'dirt' ? ['dirt', 'cobble'] : [base];
    for (const k of touch) if (UNI[k] && u[UNI[k]]) u[UNI[k]].value = layerTex(k);
    if (base === 'cobble') u.uPlaza.value.w = 1;
    // upload now (they arrive while the title is up): the first play frame does not pay for 11 HD textures
    if (touch.some((k) => UNI[k])) { const t = layerTex(touch[0]); try { if (G.renderer && t && !t.userData.fallback) G.renderer.initTexture(t); } catch (e) { /* uploads on first use */ } }
  });
}

export function buildTerrain(W, scene) {
  const mat = terrainMaterial(W);
  watchTerrainTextures(mat);
  const group = new THREE.Group();
  group.name = 'terrain';
  const per = TCH + 1;
  // shared index
  const idx = [];
  for (let j = 0; j < TCH; j++) for (let i = 0; i < TCH; i++) {
    const a = j * per + i, b = a + 1, c = a + per, d = c + 1;
    // alternate diagonal for smoother look
    if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  const index = new THREE.BufferAttribute(new Uint16Array(idx), 1);
  const H = W.H;
  let chunks = 0;
  for (let cj = 0; cj < SIZE; cj += TCH) {
    for (let ci = 0; ci < SIZE; ci += TCH) {
      let maxH = -99;
      for (let j = cj; j <= cj + TCH; j++) for (let i = ci; i <= ci + TCH; i++) maxH = Math.max(maxH, H[Math.min(j, SIZE) * N + Math.min(i, SIZE)]);
      if (maxH < -4.5) continue;
      const pos = new Float32Array(per * per * 3), nor = new Float32Array(per * per * 3);
      const sa = new Float32Array(per * per * 4), sb = new Float32Array(per * per * 4);
      for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) {
        const gi = Math.min(ci + i, SIZE), gj = Math.min(cj + j, SIZE);
        const k = gj * N + gi, v = j * per + i;
        pos[v * 3] = gi - HALF; pos[v * 3 + 1] = H[k]; pos[v * 3 + 2] = gj - HALF;
        const hl = H[gj * N + Math.max(0, gi - 1)], hr = H[gj * N + Math.min(SIZE, gi + 1)];
        const hd = H[Math.max(0, gj - 1) * N + gi], hu = H[Math.min(SIZE, gj + 1) * N + gi];
        let nx = (hl - hr) * 0.5, ny = 1, nz = (hd - hu) * 0.5;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
        for (let c = 0; c < 4; c++) { sa[v * 4 + c] = W.splatA[k * 4 + c]; sb[v * 4 + c] = W.splatB[k * 4 + c]; }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('splatA', new THREE.BufferAttribute(sa, 4));
      g.setAttribute('splatB', new THREE.BufferAttribute(sb, 4));
      g.setIndex(index);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      // r3: drawn after the props, Pip, enemies, grass cards and tree bodies (renderOrder 0 / −1), before the scatter outline
      // hulls (2) and the sky dome (1e6), so the early depth test rejects the splat shader wherever something opaque
      // already covers the ground (opaque and depth-tested: the picture is the same). TP arena-woods facing S during the
      // fight: −1.3 … −1.8 ms GPU at 1080p
      mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
      chunks++;
    }
  }
  group.userData.chunks = chunks;
  scene.add(group);
  return { group, material: mat };
}

// ---------------------------------------------------------------- water
export const HMIN = -6, HMAX = 3;
export function heightTexture(W) {
  const data = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) data[k] = clamp(((W.H[k] - HMIN) / (HMAX - HMIN)) * 255, 0, 255);
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function buildWater(W, scene) {
  // 10 m cells out to ±500 m: the far plane (TUNE.atmo.far) clips the rest, the dome's far-sea band continues it
  const geo = new THREE.PlaneGeometry(1000, 1000, 100, 100);
  geo.rotateX(-Math.PI / 2);
  const foam = Assets.textures.fx_foam || null;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    tWater: { value: Assets.tex('water') },
    tHeight: { value: heightTexture(W) },
    tNoise: { value: getNoiseTex() },
    tFoam: { value: foam },
    uHasFoam: { value: foam ? 1 : 0 },
    uShallow: { value: new THREE.Color(0x46dcd2) },
    uDeep: { value: new THREE.Color(0x1b86c8) },
    uFoam: { value: new THREE.Color(0xffffff) },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
    uSunVis: { value: new THREE.Vector3(0, 1, 0) }, uSunGlint: { value: new THREE.Color(0, 0, 0) },
    uMoonVis: { value: new THREE.Vector3(0, -1, 0) }, uMoonGlint: { value: new THREE.Color(0, 0, 0) },
    uFres: { value: new THREE.Vector4(TA.fresnelMax, TA.glint, TA.glintPow, TA.foamTile) },
    uRip: { value: Array.from({ length: TA.ripples }, () => new THREE.Vector4(0, 0, -99, 0)) },
    uRipK: { value: new THREE.Vector2(TA.rippleLife, TA.rippleSpeed) },
    uHalf: { value: HALF },
    uSize: { value: SIZE },
  }]);
  uniforms.uTime = U.uTime;
  uniforms.uNight = U.uNight;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    fog: true,
    depthWrite: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vW;
      void main() {
        vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
        w.y += 0.06 * sin(w.x * 0.21 + uTime * 1.1) + 0.05 * sin(w.z * 0.17 - uTime * 0.9) + 0.025 * sin((w.x + w.z) * 0.5 + uTime * 2.0);
        vW = w;
        vec4 mvPosition = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      ${ATMO_GLSL}
      #include <fog_pars_fragment>
      uniform sampler2D tWater, tHeight, tNoise, tFoam;
      uniform vec3 uShallow, uDeep, uFoam, uLight, uSunCol, uSunVis, uSunGlint, uMoonVis, uMoonGlint;
      uniform vec4 uFres; uniform vec4 uRip[${TA.ripples}]; uniform vec2 uRipK;
      uniform float uTime, uNight, uHalf, uSize, uHasFoam;
      varying vec3 vW;
      void main() {
        vec2 huv = (vW.xz + uHalf + 0.5) / (uSize + 1.0);
        float th = -6.0;
        if (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) th = texture2D(tHeight, huv).r * ${(HMAX - HMIN).toFixed(1)} + ${HMIN.toFixed(1)};
        float depth = max(0.0, vW.y - th);
        vec2 uv1 = vW.xz / 9.0 + vec2(uTime * 0.021, uTime * 0.013);
        vec2 uv2 = vW.xz / 13.5 + vec2(-uTime * 0.016, uTime * 0.022);
        vec3 t1 = texture2D(tWater, uv1).rgb, t2 = texture2D(tWater, uv2).rgb;
        float lum = dot(t1 + t2, vec3(0.15, 0.25, 0.1));
        float d01 = smoothstep(0.0, 4.5, depth);
        vec3 col = mix(uShallow, uDeep, d01);
        col *= 0.78 + 0.45 * lum;
        col += vec3(0.9, 1.0, 1.0) * pow(max(lum - 0.6, 0.0) * 2.4, 2.0) * (1.0 - d01 * 0.6);
        // shoreline foam band: soft edge + rolling lines, laced with fx_foam where the art is present
        float nzv = texture2D(tNoise, vW.xz * 0.09 + uTime * 0.01).r;
        float edge = 1.0 - smoothstep(0.02, 0.1 + 0.06 * sin(uTime * 1.4 + vW.x * 0.3 + vW.z * 0.2) + 0.05 * nzv, depth);
        float lines = smoothstep(0.86, 0.97, sin(depth * 9.0 - uTime * 2.1 + nzv * 4.0)) * (1.0 - smoothstep(0.1, 0.6, depth));
        float band = clamp(edge + lines * 0.75, 0.0, 1.0);
        float foam = band * smoothstep(0.25, 0.55, nzv + 0.35);
        if (uHasFoam > 0.5) {
          // the lace only inside the shore band, gone within a few dm of depth: open shallows show the water art,
          // never a sheet of lace holes
          float lace = max(texture2D(tFoam, vW.xz / uFres.w + vec2(uTime * 0.012, 0.0)).a, texture2D(tFoam, vW.xz / (uFres.w * 1.37) + vec2(0.31, -uTime * 0.009)).a);
          float near = 1.0 - smoothstep(0.04, 0.3, depth);
          foam = clamp(max(foam * 0.85, lace * near * band), 0.0, 1.0);
        }
        col = mix(col, uFoam, foam * 0.92);
        col *= uLight;
        // body → displayed values (the sky reflection, glints and fog all work in output space, like the dome)
        vec3 body = col;
        #ifdef TONE_MAPPING
          body = toneMapping(body);
        #endif
        body = linearToOutputTexel(vec4(body, 1.0)).rgb;
        // surface normal: the vertex swell + the water art as small ripples (smoothed out with distance, as the waves
        // average out: far water mirrors the sky right at the horizon instead of sparkling higher-up blue)
        float camDist = length(cameraPosition - vW);
        float rk = 0.16 * (1.0 - smoothstep(25.0, 140.0, camDist));
        float ca = cos(vW.x * 0.21 + uTime * 1.1), cb = cos(vW.z * 0.17 - uTime * 0.9), cc = cos((vW.x + vW.z) * 0.5 + uTime * 2.0);
        vec3 N = normalize(vec3(-(0.0126 * ca + 0.0125 * cc) + (t1.g - t2.g) * rk, 1.0, -(0.0085 * cb + 0.0125 * cc) + (t2.b - t1.r) * rk));
        vec3 V = normalize(cameraPosition - vW);
        // fresnel, capped near the eye (the water stays water-coloured underfoot) but free toward the horizon, where the
        // sea mirrors the haze: distance compresses into the last few pixel rows there, so this, not the fog, makes the
        // sea meet the sky without a line
        float F = min(0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0), mix(uFres.x, 0.97, smoothstep(20.0, 140.0, camDist))) * (1.0 - foam);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 c = mix(body, atmoSky(normalize(R)), F);
        // sun / moon glint: the tight reflection (art: exponent 220) plus a wider path under it that only the sparkles
        // of the water art pick up; soft-clamped into what is left below white, so a low sun lays a sparkling path,
        // never a white wash. Fades before the far-plane cut
        float gk = uFres.y * (1.0 - foam) * (1.0 - smoothstep(170.0, 290.0, camDist));
        float spk = smoothstep(0.42, 0.75, t1.g * t2.g * 1.25);
        float rs = max(dot(R, uSunVis), 0.0), rm = max(dot(R, uMoonVis), 0.0);
        vec3 g = uSunGlint * (pow(rs, uFres.z) * 0.8 + pow(rs, uFres.z * 0.3) * spk * 0.6) * gk
               + uMoonGlint * (pow(rm, uFres.z) * 0.8 + pow(rm, uFres.z * 0.3) * spk * 0.55) * gk * 0.8;
        c += (1.0 - exp(-g)) * max(1.0 - c, 0.0) * 0.86;
        // wading ripples: expanding rings at Pip's steps (uRip: x, z, start time, strength)
        float rip = 0.0;
        for (int i = 0; i < ${TA.ripples}; i++) {
          vec4 r = uRip[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > uRipK.x) continue;
          float rad = 0.18 + age * uRipK.y, d = length(vW.xz - r.xy);
          rip += (1.0 - smoothstep(0.0, 0.05 + age * 0.05, abs(d - rad))) * (1.0 - age / uRipK.x) * r.w;
        }
        c = mix(c, vec3(1.0), clamp(rip, 0.0, 1.0) * 0.6);
        // transparency follows the view path through the water, not the vertical depth: at grazing angles over a drop-off
        // the ray would otherwise see past the sea floor (deep chunks are not built) and a chunk outline showed through
        float path = depth / max(V.y, 0.12);
        float alpha = mix(0.58, 1.0, smoothstep(0.0, 2.6, path));
        alpha = max(max(alpha, foam), max(F * 1.2, rip * 0.7));
        gl_FragColor = vec4(c, alpha);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.name = 'water';
  scene.add(mesh);
  // the water art may arrive later (deferred water_hd): keep the slot current
  Assets.onTex((key) => {
    if (key !== 'water_hd' && key !== 'water') return;
    const t = (uniforms.tWater.value = Assets.tex('water'));
    try { if (G.renderer && !t.userData.fallback) G.renderer.initTexture(t); } catch (e) { /* uploads on first use */ }
  });
  return { mesh, material: mat };
}

// ---------------------------------------------------------------- minimap image
const LAYER_COL = [[140, 207, 99], [86, 146, 72], [169, 218, 120], [241, 219, 162], [238, 245, 251], [196, 147, 93], [163, 158, 152]];
export function buildMapCanvas(W) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const x = c.getContext('2d');
  const img = x.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
    const k = j * N + i, o = (j * SIZE + i) * 4;
    const h = W.H[k];
    let r = 0, g = 0, b = 0;
    if (h < 0.05) {
      const t = smoothstep(0, 4, -h);
      r = 120 - 70 * t; g = 214 - 60 * t; b = 222 - 20 * t;
      if (h > -0.35) { r = 190; g = 236; b = 236; }
    } else {
      const w = [W.splatA[k * 4], W.splatA[k * 4 + 1], W.splatA[k * 4 + 2], W.splatA[k * 4 + 3], W.splatB[k * 4], W.splatB[k * 4 + 1], W.splatB[k * 4 + 2]];
      let s = 0;
      for (let l = 0; l < 7; l++) { r += LAYER_COL[l][0] * w[l]; g += LAYER_COL[l][1] * w[l]; b += LAYER_COL[l][2] * w[l]; s += w[l]; }
      r /= s || 1; g /= s || 1; b /= s || 1;
      // hillshade
      const hl = W.H[k - 1] ?? h, hu = W.H[k - N] ?? h;
      const sh = clamp(1 + (hl - h) * 0.25 + (hu - h) * 0.25, 0.7, 1.25);
      const alt = 1 + Math.min(h, 20) * 0.006;
      r *= sh * alt; g *= sh * alt; b *= sh * alt;
    }
    if (W.bridgeAt(i - HALF, j - HALF) !== null) { r = 170; g = 120; b = 70; }
    d[o] = clamp(r, 0, 255); d[o + 1] = clamp(g, 0, 255); d[o + 2] = clamp(b, 0, 255); d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // trees & features
  for (const p of W.props) {
    if (p.removed) continue;
    const px = p.x + HALF, pz = p.z + HALF;
    if (p.type.startsWith('tree')) { x.fillStyle = p.type === 'tree_snow' ? 'rgba(70,110,90,0.7)' : 'rgba(40,95,45,0.55)'; x.beginPath(); x.arc(px, pz, 1.6, 0, Math.PI * 2); x.fill(); }
    else if (p.type === 'boulder' || p.type === 'rock') { x.fillStyle = 'rgba(110,100,95,0.6)'; x.fillRect(px - 1, pz - 1, 2, 2); }
  }
  for (const h of W.houses) { x.fillStyle = h.type === 'house_a' ? '#d8604a' : '#5a78b8'; x.fillRect(h.x + HALF - 2.5, h.z + HALF - 2.5, 5, 5); }
  if (W.shop) { x.fillStyle = '#e08a3a'; x.fillRect(W.shop.x + HALF - 2.5, W.shop.z + HALF - 2.5, 5, 5); }
  return c;
}
