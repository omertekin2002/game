// Terrain chunks (splat-blended toon shading), animated sea/river water, minimap image.
import * as THREE from 'three';
import { SIZE, HALF, N } from './world.js';
import { gradientTex, U } from './toon.js';
import { Assets } from './assets.js';
import { clamp, smoothstep } from './util.js';

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

function terrainMaterial() {
  const T = Assets.textures;
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientTex('terrain') });
  const uniforms = {
    tGrass: { value: T.grass }, tForest: { value: T.forest }, tMeadow: { value: T.meadow }, tSand: { value: T.sand },
    tSnow: { value: T.snow }, tDirt: { value: T.dirt }, tRock: { value: T.rock }, tNoise: { value: getNoiseTex() },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uNight: U.uNight });
    sh.vertexShader = `
      attribute vec4 splatA; attribute vec4 splatB;
      varying vec4 vSplatA; varying vec4 vSplatB; varying vec3 vWPos;
    ` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vSplatA = splatA; vSplatB = splatB; vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = `
      uniform sampler2D tGrass, tForest, tMeadow, tSand, tSnow, tDirt, tRock, tNoise;
      varying vec4 vSplatA; varying vec4 vSplatB; varying vec3 vWPos;
    ` + sh.fragmentShader.replace('#include <map_fragment>', /* glsl */`
      {
        vec2 tuv = vWPos.xz / 7.0;
        vec4 nz = texture2D(tNoise, vWPos.xz * 0.031);
        vec4 nz2 = texture2D(tNoise, vWPos.xz * 0.0071 + 0.31);
        vec4 wa = vSplatA * (0.25 + nz * 1.5);
        vec4 wb = vSplatB * (0.25 + nz.wzyx * 1.5);
        wa = wa * wa * wa; wb = wb * wb * wb;
        float ws = dot(wa, vec4(1.0)) + dot(wb, vec4(1.0)) + 1e-4;
        wa /= ws; wb /= ws;
        vec3 c = vec3(0.0);
        if (wa.x > 0.01) c += texture2D(tGrass, tuv).rgb * wa.x;
        if (wa.y > 0.01) c += texture2D(tForest, tuv * 1.1).rgb * wa.y;
        if (wa.z > 0.01) c += texture2D(tMeadow, tuv).rgb * wa.z;
        if (wa.w > 0.01) c += texture2D(tSand, tuv * 0.9).rgb * wa.w;
        if (wb.x > 0.01) c += texture2D(tSnow, tuv * 0.8).rgb * wb.x;
        if (wb.y > 0.01) { vec3 dc = texture2D(tDirt, tuv * 1.2).rgb; dc = mix(vec3(dot(dc, vec3(0.3, 0.55, 0.15))), dc, 0.72) * vec3(1.08, 1.04, 1.0); c += dc * wb.y; }
        if (wb.z > 0.01) c += texture2D(tRock, tuv * 0.7).rgb * wb.z;
        // macro variation so tiling does not read
        c *= 0.86 + 0.28 * nz2.x;
        // wet sand darkening just above the waterline
        c *= mix(0.78, 1.0, smoothstep(0.05, 0.55, vWPos.y));
        diffuseColor.rgb *= c;
      }`);
  };
  m.customProgramCacheKey = () => 'terrainSplat';
  return m;
}

export function buildTerrain(W, scene) {
  const mat = terrainMaterial();
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
  const geo = new THREE.PlaneGeometry(1800, 1800, 180, 180);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    tWater: { value: Assets.textures.water },
    tHeight: { value: heightTexture(W) },
    tNoise: { value: getNoiseTex() },
    uShallow: { value: new THREE.Color(0x46dcd2) },
    uDeep: { value: new THREE.Color(0x1b86c8) },
    uFoam: { value: new THREE.Color(0xffffff) },
    uLight: { value: new THREE.Color(1, 1, 1) },
    uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
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
      #include <fog_pars_fragment>
      uniform sampler2D tWater, tHeight, tNoise;
      uniform vec3 uShallow, uDeep, uFoam, uLight, uSunCol;
      uniform float uTime, uNight, uHalf, uSize;
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
        // shoreline foam: soft band + rolling lines
        float nzv = texture2D(tNoise, vW.xz * 0.09 + uTime * 0.01).r;
        float edge = 1.0 - smoothstep(0.02, 0.1 + 0.06 * sin(uTime * 1.4 + vW.x * 0.3 + vW.z * 0.2) + 0.05 * nzv, depth);
        float lines = smoothstep(0.86, 0.97, sin(depth * 9.0 - uTime * 2.1 + nzv * 4.0)) * (1.0 - smoothstep(0.1, 0.6, depth));
        float foam = clamp(edge + lines * 0.75, 0.0, 1.0) * smoothstep(0.25, 0.55, nzv + 0.35);
        col = mix(col, uFoam, foam * 0.92);
        // sparkles
        float sp = pow(clamp((t1.g * t2.g - 0.62) * 4.0, 0.0, 1.0), 3.0);
        col += uSunCol * sp * (1.0 - 0.75 * uNight) * 0.9;
        col *= uLight;
        float alpha = mix(0.58, 0.97, smoothstep(0.0, 1.4, depth));
        alpha = max(alpha, foam);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  scene.add(mesh);
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
