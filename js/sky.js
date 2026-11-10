// Sky dome, sun/moon light (tight player-following shadow camera), hemisphere light, fog, clouds,
// day/night keyframes, lamp light pool + soft night light around Pip.
import * as THREE from 'three';
import { U, GB, toonMat } from './toon.js';
import { clamp, lerp, smoothstep, TAU } from './util.js';

// hour, skyTop, horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity, fog
const KEYS = [
  [0.0, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.55, 0x5a6ab8, 0x2c3150, 1.25, 0x36437e],
  [4.8, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.55, 0x5a6ab8, 0x2c3150, 1.25, 0x36437e],
  [6.0, 0x7a8fd8, 0xffb7c6, 0xffb48a, 1.4, 0xd6b6dd, 0x7a6670, 1.35, 0xf0bfc8],
  [7.6, 0x5aaef2, 0xd4f0fc, 0xfff1dc, 2.6, 0xd8ecff, 0x8a9a6a, 1.45, 0xcfe9f5],
  [16.4, 0x5aaef2, 0xd4f0fc, 0xfff1dc, 2.6, 0xd8ecff, 0x8a9a6a, 1.45, 0xcfe9f5],
  [18.0, 0x7484cc, 0xffc890, 0xffc08a, 1.5, 0xe8ccc0, 0x7a6658, 1.35, 0xeec8a0],
  [19.5, 0x2c3778, 0x6a5aa8, 0xb4a8ff, 0.7, 0x6a6ab8, 0x352f50, 1.25, 0x4a4888],
  [24.0, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.55, 0x5a6ab8, 0x2c3150, 1.25, 0x36437e],
];
const _a = new THREE.Color(), _b = new THREE.Color();
function mixHex(h1, h2, t, out) { _a.setHex(h1); _b.setHex(h2); return out.copy(_a).lerp(_b, t); }

export function nightAmount(h) {
  if (h >= 7.2 && h <= 17.4) return 0;
  if (h > 17.4 && h < 19.8) return smoothstep(17.4, 19.8, h);
  if (h >= 4.6 && h < 7.2) return 1 - smoothstep(4.6, 7.2, h);
  return 1;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.skyTop = new THREE.Color();
    this.horizon = new THREE.Color();
    this.fogColor = new THREE.Color();
    // dome
    const geo = new THREE.SphereGeometry(900, 32, 16);
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: U.uNight, uTime: U.uTime },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        uniform vec3 uTop, uHor, uSunDir, uSunCol; uniform float uNight, uTime; varying vec3 vDir;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float t = smoothstep(-0.05, 0.55, d.y);
          vec3 c = mix(uHor, uTop, t);
          c = mix(c, uHor * 0.85, smoothstep(0.0, -0.3, d.y));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          c += uSunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25) * (1.0 - uNight * 0.5);
          // stars
          vec2 g = vec2(atan(d.z, d.x) * 60.0, d.y * 120.0);
          vec2 id = floor(g); vec2 f = fract(g) - 0.5;
          float r = h21(id);
          float star = step(0.985, r) * smoothstep(0.12, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 50.0));
          c += vec3(1.0, 0.95, 0.85) * star * uNight * smoothstep(0.05, 0.3, d.y);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(geo, this.domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // lights
    this.hemi = new THREE.HemisphereLight(0xd8ecff, 0x8a9a6a, 1.4);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(2048, 2048);
    const E = 22;
    sh.camera.left = -E; sh.camera.right = E; sh.camera.top = E; sh.camera.bottom = -E;
    sh.camera.near = 1; sh.camera.far = 160;
    sh.bias = -0.0006;
    sh.normalBias = 0.035;
    sh.radius = 2.5;
    this.shadowExtent = E;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.45).normalize();

    // point light pool: lamps + Pip glow (constant count → no shader recompiles)
    this.lampLights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffc27a, 0, 10, 2);
      l.castShadow = false;
      scene.add(l);
      this.lampLights.push(l);
    }
    this.pipLight = new THREE.PointLight(0xfff0d0, 0, 7, 1.5);
    scene.add(this.pipLight);

    scene.fog = new THREE.Fog(0xcfe9f5, 50, 170);
    this.buildClouds();
    this.night = 0;
  }
  buildClouds() {
    const b = new GB();
    const puffs = [[0, 0, 0, 3.2], [3.4, -0.4, 0.5, 2.4], [-3.2, -0.5, -0.3, 2.5], [1.5, 1.3, -0.4, 2.2], [-1.4, 1.1, 0.4, 2.0], [5.6, -0.9, 0, 1.6], [-5.4, -0.9, 0.2, 1.5]];
    for (const [x, y, z, r] of puffs) b.sphere(r, 0xffffff, { x, y, z, sy: 0.8, ws: 14, hs: 10, glow: 0.35 });
    const built = b.build();
    const mat = toonMat({ glow: true, glowBase: 1, rim: 0.4 });
    this.clouds = new THREE.InstancedMesh(built.geo, mat, 22);
    this.cloudData = [];
    let s = 9;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + rnd() * 0.3;
      const r = 170 + rnd() * 160;
      this.cloudData.push({ a, r, y: 38 + rnd() * 30, s: 1.2 + rnd() * 1.6, sp: 0.004 + rnd() * 0.006 });
    }
    this.clouds.frustumCulled = false;
    this.clouds.castShadow = false;
    this.scene.add(this.clouds);
    this.updateClouds(0);
  }
  updateClouds(t) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    this.cloudData.forEach((c, i) => {
      const a = c.a + t * c.sp;
      p.set(Math.sin(a) * c.r, c.y, Math.cos(a) * c.r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      sc.set(c.s, c.s * 0.8, c.s);
      m.compose(p, q, sc);
      this.clouds.setMatrixAt(i, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
  }
  /** h: hour 0..24 */
  update(h, focus, camera, lamps, dt, time) {
    let i = 0;
    while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const t = smoothstep(A[0], B[0], h);
    mixHex(A[1], B[1], t, this.skyTop);
    mixHex(A[2], B[2], t, this.horizon);
    mixHex(A[3], B[3], t, this.sun.color);
    this.sun.intensity = lerp(A[4], B[4], t);
    mixHex(A[5], B[5], t, this.hemi.color);
    mixHex(A[6], B[6], t, this.hemi.groundColor);
    this.hemi.intensity = lerp(A[7], B[7], t);
    mixHex(A[8], B[8], t, this.fogColor);
    this.scene.fog.color.copy(this.fogColor);
    this.night = nightAmount(h);
    U.uNight.value = this.night;
    // sun path: day arc east→west; at night a moon on a similar arc (smoothly blended through dusk/dawn)
    const day = clamp((h - 6) / 12, 0, 1), nightT = ((h + 6) % 24) / 12;
    const isDay = h >= 6 && h <= 18;
    const f = isDay ? day : clamp(nightT - 1, 0, 1);
    const az = lerp(1.25, -1.25, f) + 0.25;
    const el = lerp(0.62, 1.05, Math.sin(f * Math.PI));
    const blendEdge = isDay ? Math.min(smoothstep(6, 6.6, h), 1 - smoothstep(17.4, 18, h)) : 1;
    this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el) * 0.8 + 0.35).normalize();
    this.sun.intensity *= 0.35 + 0.65 * blendEdge;
    this.domeMat.uniforms.uTop.value.copy(this.skyTop);
    this.domeMat.uniforms.uHor.value.copy(this.horizon);
    this.domeMat.uniforms.uSunDir.value.copy(this.sunDir);
    this.domeMat.uniforms.uSunCol.value.copy(this.sun.color);
    this.dome.position.copy(camera.position);
    // tight shadow camera around the focus, snapped to texels
    const sh = this.sun.shadow;
    const texel = (this.shadowExtent * 2) / sh.mapSize.x;
    const tgt = this.sun.target.position;
    tgt.set(Math.round(focus.x / texel) * texel, focus.y, Math.round(focus.z / texel) * texel);
    this.sun.position.copy(tgt).addScaledVector(this.sunDir, 70);
    this.sun.target.updateMatrixWorld();
    // lamps
    const n = this.night;
    if (lamps && lamps.length) {
      const sorted = lamps.map((l) => ({ l, d: (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2 })).sort((a, b) => a.d - b.d);
      this.lampLights.forEach((L, k) => {
        const s = sorted[k];
        if (!s || s.d > 40 * 40 || n < 0.02) { L.intensity = 0; return; }
        L.position.set(s.l.x + Math.cos(s.l.rot) * 1.1, s.l.y + 1.7, s.l.z - Math.sin(s.l.rot) * 1.1);
        L.intensity = n * 6 * (0.92 + 0.08 * Math.sin(time * 9 + k));
      });
    }
    this.pipLight.position.set(focus.x, focus.y + 1.6, focus.z);
    this.pipLight.intensity = n * 4.5;
    this.updateClouds(time);
  }
}
