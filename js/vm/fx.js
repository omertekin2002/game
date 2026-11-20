// WP2 viewmodel-space effects (one draw call each): the FP blade trail ribbon (art §1.4: fx_slash_swoosh brush, wood
// cream / shiny additive gold), sparkle + heart particles (fx_atlas cells sparkle_4 / heart; shiny-blade glints, item-get
// sparkles, potion hearts) and the item-get rays card (fx_raysburst, additive). Every texture has a drawn fallback.
import * as THREE from 'three';
import { Assets } from '../assets.js';
import { mulberry32 } from '../util.js';

const TAU = Math.PI * 2;
const rnd = mulberry32(0x5a4c);   // cosmetic randomness: render-side effects never draw on the sim's (seeded) Math.random

// ------------------------------------------------------------------ fallback textures (canvas, built once)
let fbAtlas = null, fbRays = null;
function fallbackAtlas() {
  if (fbAtlas) return fbAtlas;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  // cell 0: 4-point sparkle with a glow
  let g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; x.beginPath();
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 5 : 29; const px = 32 + Math.cos(a) * r, py = 32 + Math.sin(a) * r; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
  x.fill();
  // cell 1: heart
  x.save(); x.translate(96, 34); x.fillStyle = '#fff'; x.beginPath();
  x.moveTo(0, 20); x.bezierCurveTo(-30, 0, -22, -24, 0, -10); x.bezierCurveTo(22, -24, 30, 0, 0, 20); x.fill(); x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  fbAtlas = { tex: t, cells: { sparkle_4: [0, 0, 0.5, 1], heart: [0.5, 0, 0.5, 1] } };
  return fbAtlas;
}
function fallbackRays() {
  if (fbRays) return fbRays;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.translate(128, 128);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, L = i % 2 ? 70 : 118, w = i % 2 ? 0.07 : 0.1;
    const g = x.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0);
    x.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L); x.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L); x.fill();
  }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 60);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(-128, -128, 256, 256);
  fbRays = new THREE.CanvasTexture(c); fbRays.colorSpace = THREE.SRGBColorSpace;
  return fbRays;
}
/** { tex, cells: name → [u, v, w, h] (0..1, v from the bottom) } from the fx_atlas asset, else the drawn fallback */
function atlasCells() {
  const t = Assets.textures.fx_atlas, A = Assets.atlas.fx_atlas;
  if (!t || !A || !A.cells || !A.cells.sparkle_4 || !A.cells.heart) return fallbackAtlas();
  const [W, H] = A.size || [t.image.width, t.image.height], cells = {};
  for (const k of ['sparkle_4', 'heart']) { const c = A.cells[k]; cells[k] = [c.x / W, 1 - (c.y + c.h) / H, c.w / W, c.h / H]; }
  return { tex: t, cells };
}

// ------------------------------------------------------------------ trail ribbon
const TRAIL_MAX = 48;
export class VmTrail {
  constructor() {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(TRAIL_MAX * 2 * 3);
    this.uv = new Float32Array(TRAIL_MAX * 2 * 2);
    this.al = new Float32Array(TRAIL_MAX * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aA', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < TRAIL_MAX - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    const map = Assets.billboards.fx_slash_swoosh || null;
    this.uniforms = { uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uColor: { value: new THREE.Color(0xffd9a0) }, uEdge: { value: new THREE.Color(0xb8642a) }, uK: { value: 1 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.NormalBlending,
      vertexShader: /* glsl */`attribute float aA; varying float vA; varying vec2 vUv;
        void main() { vA = aA; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform vec3 uEdge; uniform float uK;
        varying float vA; varying vec2 vUv;
        void main() {
          // a crescent: full width at the blade (u = 1), narrowing to a line along the tip's path at its old end (u = 0).
          // Across it (x: 0 = inner edge, 1 = the tip's path): a soft body, a bright core and a thin warm-brown edge, so
          // it keeps its value contrast over a pale sky as well as over grass (a cream-only smear vanished on the sky)
          float w = mix(0.45, 1.0, smoothstep(0.0, 0.6, vUv.x));
          float x = (vUv.y - (1.0 - w)) / w;
          if (x <= 0.0) discard;
          float body = smoothstep(0.0, 0.6, x);
          if (uHasMap > 0.5) {
            // the painted swoosh's brush streaks: sample its thick head band (streaky alpha) along the ribbon
            vec4 s = texture2D(uMap, vec2(mix(0.55, 0.92, vUv.x), mix(0.62, 0.78, x)));
            body *= 0.7 + 0.45 * s.a;
          } else body *= 0.85 + 0.15 * sin(x * 38.0 + vUv.x * 5.0);
          float core = smoothstep(0.55, 0.82, x) * (1.0 - smoothstep(0.88, 0.94, x));
          float edge = smoothstep(0.92, 0.96, x);
          vec3 c = mix(mix(uColor, vec3(1.0), core * 0.9), uEdge, edge);
          float a = vA * max(body * 0.85, max(core, edge * 0.9));
          gl_FragColor = vec4(c * uK, min(1.0, a));
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = 'vm-trail';
    this.s = [];        // samples { b: [x,y,z], t: [x,y,z], age }
    this.life = 0.11;
    this.mesh.visible = false;
  }
  /** starter: warm cream with a brown edge; shiny: gold with an amber edge (both normal blending) */
  style(shiny, life, peak) {
    this.life = life;
    // normal blending for both: an additive trail washes out to white over the bright sky
    this.uniforms.uColor.value.set(shiny ? 0xffd04a : 0xffd9a0);
    this.uniforms.uEdge.value.set(shiny ? 0xc07a10 : 0xb8642a);
    this.peak = peak;
  }
  clear() { this.s.length = 0; this.mesh.visible = false; }
  push(b, t) {
    this.s.push({ b: [b.x, b.y, b.z], t: [t.x, t.y, t.z], age: 0 });
    if (this.s.length > TRAIL_MAX) this.s.shift();
  }
  /** age the samples (frozen: hold still through a hit-stop) and rebuild the strip */
  update(dt, frozen) {
    const S = this.s;
    if (!frozen) for (const s of S) s.age += dt;
    while (S.length && S[0].age > this.life) S.shift();
    const n = S.length;
    this.mesh.visible = n >= 2;
    if (n < 2) { this.mesh.geometry.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      const s = S[i], k = Math.sqrt(Math.max(0, 1 - s.age / this.life)), u = i / (n - 1), a = this.peak * k * Math.min(1, u * 2.2);
      this.pos.set(s.b, i * 6); this.pos.set(s.t, i * 6 + 3);
      this.uv[i * 4] = u; this.uv[i * 4 + 1] = 0; this.uv[i * 4 + 2] = u; this.uv[i * 4 + 3] = 1;
      this.al[i * 2] = a; this.al[i * 2 + 1] = a;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    g.setDrawRange(0, (n - 1) * 6);
  }
}

// ------------------------------------------------------------------ particles (sparkles, hearts)
const SP_MAX = 64;
export class VmSparks {
  constructor() {
    const A = (this.atlas = atlasCells());
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(SP_MAX * 3); this.c = new Float32Array(SP_MAX * 4); this.sz = new Float32Array(SP_MAX); this.r = new Float32Array(SP_MAX * 4); this.rot = new Float32Array(SP_MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.c, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRect', new THREE.BufferAttribute(this.r, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uniforms = { uMap: { value: A.tex }, uScale: { value: 500 } };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`attribute vec4 aCol; attribute float aSize; attribute vec4 aRect; attribute float aRot; uniform float uScale;
        varying vec4 vCol; varying vec4 vRect; varying float vRot;
        void main() { vCol = aCol; vRect = aRect; vRot = aRot; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uScale / max(0.02, -mv.z), 1.0, 256.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform sampler2D uMap; varying vec4 vCol; varying vec4 vRect; varying float vRot;
        void main() {
          vec2 q = gl_PointCoord - 0.5; float cs = cos(vRot), sn = sin(vRot);
          q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y) + 0.5;
          if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) discard;
          vec4 t = texture2D(uMap, vRect.xy + vec2(q.x, 1.0 - q.y) * vRect.zw);
          float a = t.a * vCol.a;
          gl_FragColor = vec4(vCol.rgb * t.rgb * a, a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Points(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    this.mesh.name = 'vm-sparks';
    this.list = [];
    this.col = new THREE.Color();
  }
  /** a particle in vm camera space: o = { cell, color, size, life, vx, vy, vz, grow, spin, g } */
  add(x, y, z, o = {}) {
    if (this.list.length >= SP_MAX) this.list.shift();
    this.list.push({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, g: o.g || 0, t: 0, life: o.life || 0.5, size: o.size || 0.03, grow: o.grow ?? 0, cell: o.cell || 'sparkle_4', color: o.color ?? 0xfff4a0, spin: o.spin || 0, rot: o.rot ?? rnd() * TAU, a: o.a ?? 1 });
  }
  clear() { this.list.length = 0; }
  update(dt, scale, frozen) {
    this.uniforms.uScale.value = scale;
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const s = L[i];
      if (!frozen) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= s.g * dt; s.rot += s.spin * dt; }
      if (s.t >= s.life) L.splice(i, 1);
    }
    const A = this.atlas.cells;
    for (let i = 0; i < L.length; i++) {
      const s = L[i], k = s.t / s.life, fade = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.55) / 0.45));
      this.p[i * 3] = s.x; this.p[i * 3 + 1] = s.y; this.p[i * 3 + 2] = s.z;
      this.col.set(s.color);
      this.c[i * 4] = this.col.r; this.c[i * 4 + 1] = this.col.g; this.c[i * 4 + 2] = this.col.b; this.c[i * 4 + 3] = fade * s.a;
      this.sz[i] = s.size * (1 + s.grow * k) * (s.cell === 'sparkle_4' ? 0.7 + 0.3 * Math.sin(k * Math.PI) : 1);
      this.r.set(A[s.cell] || A.sparkle_4, i * 4);
      this.rot[i] = s.rot;
    }
    const g = this.mesh.geometry;
    for (const k of ['position', 'aCol', 'aSize', 'aRect', 'aRot']) g.attributes[k].needsUpdate = true;
    g.setDrawRange(0, L.length);
    this.mesh.visible = L.length > 0;
  }
}

// ------------------------------------------------------------------ rays card behind the presented item
export function raysCard() {
  const tex = Assets.billboards.fx_raysburst || fallbackRays();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Color(0xffd36a) }, uK: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`uniform sampler2D uMap; uniform vec3 uColor; uniform float uK; varying vec2 vUv;
      void main() { vec4 t = texture2D(uMap, vUv); float a = t.a * uK;
        if (a < 0.012) discard;   // the gaps between the rays: no blend, no write (the disc is large on screen)
        gl_FragColor = vec4(uColor * t.rgb * a, a);
        #include <colorspace_fragment>
      }`,
  });
  // a disc, not a square: the burst is radial, so the square's corners were only transparent fill (the card is big
  // on screen in first person, and every covered pixel is blended)
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), mat);
  m.frustumCulled = false; m.renderOrder = 2; m.name = 'vm-rays';
  m.visible = false;
  return m;
}
