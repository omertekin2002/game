// Particles (two pooled Points systems: normal + additive), glows, halos. Slash trail → fx-trail.js, ground rings → fx-ground.js.
// WP7 (art §8, arch §9.2-9): the painted 16-cell `fx_atlas` (cells by name from its JSON; the procedural 2×2 canvas atlas
// stays for SOFT / DOT and replaces every painted cell when the art is missing), near fade (alpha → 0 under ~0.35 m view
// depth), screen-size cap (≤ 0.16 × buffer height within 2 m, ≤ 0.25 beyond), halos faded under 3 m and capped at 1.6 m.
import * as THREE from 'three';
import { U } from './toon.js';
import { rand, TAU, clamp, pick } from './util.js';
import { GroundFX } from './fx-ground.js';
import { Assets } from './assets.js';
import { perf as TP } from './tune.js';
export { GroundFX } from './fx-ground.js';
export { SlashTrail } from './fx-trail.js';

function atlasTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  // 0: soft circle
  let g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  // 1: star (4-point sparkle + glow)
  g = x.createRadialGradient(96, 32, 0, 96, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(64, 0, 64, 64);
  x.fillStyle = '#fff';
  x.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 6 : 29;
    const px = 96 + Math.cos(a) * r, py = 32 + Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.fill();
  // 2: leaf / petal
  x.save(); x.translate(32, 96); x.rotate(0.6);
  x.beginPath(); x.ellipse(0, 0, 26, 13, 0, 0, TAU); x.fillStyle = '#fff'; x.fill();
  x.restore();
  // 3: hard dot (snow, fluff) with soft rim
  g = x.createRadialGradient(96, 96, 0, 96, 96, 28);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(96, 96, 28, 0, TAU); x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 0–3: procedural cells (SOFT glow, STAR sparkle, LEAF ellipse, DOT); 4–19: the painted fx_atlas cells by name
export const SHAPE = {
  SOFT: 0, STAR: 1, LEAF: 2, DOT: 3,
  PUFF: 4, SPARKLE: 5, STAR5: 6, PETAL: 7, LEAFP: 8, SNOW: 9, DROP: 10, IMPACT: 11, SMOKE: 12, HEART: 13, ALERT: 14, CHIPS: 15,
  SHARD: 16, CLIP: 17, RING: 18, STREAK: 19,
};
const FX_CELLS = ['soft_puff', 'sparkle_4', 'star_5', 'petal', 'leaf', 'snowflake', 'droplet', 'impact', 'smoke_curl', 'heart', 'alert', 'sand_chips', 'shard', 'grass_clipping', 'ring', 'speed_streak'];
// without the painted atlas each painted cell falls back to the closest procedural one
const FALLBACK = [0, 1, 1, 2, 2, 3, 3, 1, 0, 0, 0, 3, 3, 2, 0, 0];
/** the fx_atlas texture + cell rects (u0, v0, u1, v1, flipY) or null */
function paintedAtlas() {
  const tex = Assets.textures.fx_atlas, at = (tex && tex.userData.atlas) || Assets.atlas.fx_atlas;
  if (!tex || !at || !at.cells || !at.size) return null;
  const [W, H] = at.size, inset = 1.5;
  const rects = FX_CELLS.map((n) => { const c = at.cells[n]; return c ? new THREE.Vector4((c.x + inset) / W, 1 - (c.y + c.h - inset) / H, (c.x + c.w - inset) / W, 1 - (c.y + inset) / H) : null; });
  if (rects.some((r) => !r)) return null;
  return { tex, rects };
}

class Particles {
  setPainted(p) { this.painted = true; this.mat.uniforms.tPaint.value = p.tex; this.mat.uniforms.uRects.value = p.rects; }
  constructor(scene, max, additive, atlas, painted) {
    this.painted = !!painted;
    this.max = max;
    this.list = [];
    this.free = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pshape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('prot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.uScale = { value: 800 };
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tAtlas: { value: atlas } }]);
    uniforms.uScale = this.uScale;
    Object.assign(uniforms, {
      tPaint: { value: painted ? painted.tex : atlas }, uRects: { value: painted ? painted.rects : FX_CELLS.map(() => new THREE.Vector4()) },
      uRes: U.uRes, uPassK: U.uPassK, uNearP: { value: new THREE.Vector2(...TP.pNear) }, uCap: { value: new THREE.Vector2(TP.pCapNear, TP.pCapFar) },
    });
    this.mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec4 pcolor; attribute float psize; attribute float pshape; attribute float prot;
        uniform float uScale; uniform vec2 uRes; uniform float uPassK; uniform vec2 uNearP; uniform vec2 uCap;
        varying vec4 vC; varying float vShape; varying float vRot;
        void main(){
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float dz = -mvPosition.z;
          // WP7: never bigger than a slice of the screen (smaller still right at the eye), faded out right at the eye
          gl_PointSize = min(psize * uScale * uPassK / max(0.05, dz), mix(uCap.x, uCap.y, smoothstep(1.0, 2.0, dz)) * uRes.y);   // uPassK: the scaled main pass
          vC = pcolor; vC.a *= smoothstep(uNearP.x, uNearP.y, dz); vShape = pshape; vRot = prot;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D tAtlas; uniform sampler2D tPaint; uniform vec4 uRects[16];
        varying vec4 vC; varying float vShape; varying float vRot;
        void main(){
          if (vC.a < 0.004) discard;
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
          vec4 t;
          if (vShape < 3.5) {
            float col = mod(vShape, 2.0), row = floor(vShape / 2.0);
            t = vec4(1.0, 1.0, 1.0, texture2D(tAtlas, vec2((col + p.x) * 0.5, 1.0 - (row + p.y) * 0.5)).a);
          } else {
            vec4 r = uRects[int(vShape - 3.5)];
            t = texture2D(tPaint, vec2(mix(r.x, r.z, p.x), mix(r.w, r.y, p.y)));
          }
          float a = t.a * vC.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC.rgb * t.rgb, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
    scene.add(this.points);
  }
  spawn(o) {
    if (this.list.length >= this.max) return null;
    const p = this.free.pop() || {};
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = o.life || 1; p.t = 0;
    p.s0 = o.size ?? 0.3; p.s1 = o.size1 ?? p.s0;
    const c = o.color ?? 0xffffff;
    p.r = ((c >> 16) & 255) / 255; p.g = ((c >> 8) & 255) / 255; p.b = (c & 255) / 255;
    // colours authored in sRGB → convert to linear working space
    p.r = p.r ** 2.2; p.g = p.g ** 2.2; p.b = p.b ** 2.2;
    p.a = o.alpha ?? 1;
    p.fadeIn = o.fadeIn ?? 0.05;
    const sh = o.shape ?? 0;
    p.shape = sh >= 4 && !this.painted ? FALLBACK[sh - 4] : sh === SHAPE.STAR && this.painted ? SHAPE.SPARKLE : sh;
    p.rot = o.rot ?? rand(0, TAU); p.vr = o.vr ?? 0;
    p.grav = o.grav ?? 0; p.drag = o.drag ?? 0;
    p.sway = o.sway ?? 0; p.ph = rand(0, TAU);
    p.floor = o.floor ?? -999;
    p.flutter = o.flutter ?? 0;
    p.wander = o.wander ?? 0;
    p.tag = o.tag || null;
    this.list.push(p);
    return p;
  }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { this.free.push(p); continue; }
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.vy -= p.grav * dt;
      if (p.wander) { p.vx += Math.sin(p.t * 1.7 + p.ph) * p.wander * dt; p.vz += Math.cos(p.t * 1.3 + p.ph * 2) * p.wander * dt; p.vy += Math.sin(p.t * 2.3 + p.ph) * p.wander * 0.5 * dt; }
      p.x += (p.vx + (p.sway ? Math.sin(p.t * 2.2 + p.ph) * p.sway : 0)) * dt;
      p.y += p.vy * dt;
      p.z += (p.vz + (p.sway ? Math.cos(p.t * 1.7 + p.ph) * p.sway * 0.6 : 0)) * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      p.rot += p.vr * dt;
      L[n++] = p;
    }
    L.length = n;
    for (let i = 0; i < n; i++) {
      const p = L[i];
      const k = p.t / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const fin = p.fadeIn > 0 ? Math.min(1, p.t / p.fadeIn) : 1;
      const fout = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = p.a * fin * fout;
      let s = p.s0 + (p.s1 - p.s0) * k;
      if (p.flutter) s *= 0.65 + 0.35 * Math.abs(Math.sin(p.t * p.flutter + p.ph));
      this.size[i] = s;
      this.shape[i] = p.shape;
      this.rot[i] = p.rot;
    }
    const g = this.geo;
    g.setDrawRange(0, n);
    for (const k of ['position', 'pcolor', 'psize', 'pshape', 'prot']) {
      const a = g.attributes[k];
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
    }
  }
  count(tag) { let c = 0; for (const p of this.list) if (p.tag === tag) c++; return c; }
}


// ---------------------------------------------------------------- facade
export class FX {
  constructor(scene) {
    this.atlas = atlasTexture();
    this.painted = paintedAtlas();   // WP7: null → every painted cell falls back to its procedural neighbour
    this.norm = new Particles(scene, 2600, false, this.atlas, this.painted);
    this.add = new Particles(scene, 2200, true, this.atlas, this.painted);
    // a later fx_atlas (quality raised: the full file replaces the lo one; or the art arrived late) is swapped in
    if (Assets.onTex) Assets.onTex((key) => { if (key !== 'fx_atlas') return; const p = paintedAtlas(); if (p) { this.painted = p; this.norm.setPainted(p); this.add.setPainted(p); } });
    this.ground = new GroundFX(scene);
  }
  setScale(px) { this.norm.uScale.value = px; this.add.uScale.value = px; }
  update(dt) { this.norm.update(dt); this.add.update(dt); this.ground.update(dt); }
  dust(x, y, z, n = 4, color = 0xe8d6b8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.4, 1.4);
      this.norm.spawn({ x: x + Math.cos(a) * 0.15, y: y + 0.08, z: z + Math.sin(a) * 0.15, vx: Math.cos(a) * s, vy: rand(0.4, 1.1), vz: Math.sin(a) * s, drag: 4, life: rand(0.35, 0.6), size: rand(0.16, 0.26), size1: rand(0.34, 0.5), color, alpha: 0.75, shape: SHAPE.PUFF, vr: rand(-1.5, 1.5) });
    }
  }
  sparks(x, y, z, n = 8, color = 0xfff4b0) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), e = rand(-0.3, 1.2), s = rand(3, 6.5);
      this.add.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s, vz: Math.sin(a) * Math.cos(e) * s, drag: 7, life: rand(0.2, 0.38), size: rand(0.3, 0.5), size1: 0.05, color, shape: SHAPE.STAR, vr: rand(-8, 8) });
    }
    this.add.spawn({ x, y, z, life: 0.12, size: 0.9, size1: 0.3, color: 0xffffff, alpha: 0.6, shape: SHAPE.SOFT });
    this.norm.spawn({ x, y, z, life: 0.14, size: 0.42, size1: 0.3, color: 0xfff3d8, alpha: 0.95, shape: SHAPE.IMPACT, rot: rand(-0.4, 0.4), fadeIn: 0 });
  }
  poof(x, y, z, color = 0xffffff, n = 12, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1, 3) * scale;
      this.norm.spawn({ x, y: y + rand(-0.1, 0.3) * scale, z, vx: Math.cos(a) * s, vy: rand(0.5, 2.2) * scale, vz: Math.sin(a) * s, drag: 4.5, life: rand(0.45, 0.8), size: rand(0.26, 0.42) * scale, size1: rand(0.5, 0.72) * scale, color, alpha: 0.88, shape: SHAPE.PUFF, vr: rand(-2, 2) });
    }
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      const a = rand(0, TAU), s = rand(2, 5) * scale;
      this.add.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vy: rand(1, 4), vz: Math.sin(a) * s, drag: 3, grav: 4, life: rand(0.5, 0.8), size: rand(0.2, 0.32), size1: 0.05, color: pick([0xfff4a0, 0xffffff, 0xffc8e0]), shape: SHAPE.STAR5, vr: rand(-6, 6) });
    }
  }
  leaves(x, y, z, n = 6, colors = [0x8bd65d, 0xa6e07a, 0x6cc04a]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1, 3);
      this.norm.spawn({ x, y: y + rand(0, 0.4), z, vx: Math.cos(a) * s, vy: rand(1.5, 3.5), vz: Math.sin(a) * s, drag: 2.5, grav: 6, life: rand(0.8, 1.3), size: rand(0.16, 0.24), color: pick(colors), shape: SHAPE.LEAFP, vr: rand(-10, 10), sway: 0.8 });
    }
  }
  /** WP7: grass clippings (art §8 grass cut: arc up ≈ 1.5 m/s, gravity 6) */
  clippings(x, y, z, n = 4, colors = [0x8cc63a, 0xb9f07a, 0x9ad04e]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.4, 1.2);
      this.norm.spawn({ x: x + Math.cos(a) * 0.08, y, z: z + Math.sin(a) * 0.08, vx: Math.cos(a) * s, vy: rand(1.1, 1.9), vz: Math.sin(a) * s, grav: 6, drag: 1.5, life: rand(0.5, 0.8), size: rand(0.1, 0.16), color: pick(colors), shape: SHAPE.CLIP, vr: rand(-12, 12) });
    }
  }
  shards(x, y, z, n = 8, colors = [0xc87848, 0xa85a30, 0xe8a878]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1.5, 3.5);
      this.norm.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vy: rand(2, 4.5), vz: Math.sin(a) * s, grav: 14, drag: 1, life: rand(0.6, 0.9), size: rand(0.14, 0.22), color: pick(colors), shape: SHAPE.SHARD, vr: rand(-9, 9), floor: y + 0.05 });
    }
  }
  splash(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.6, 1.8);
      this.norm.spawn({ x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: rand(1.5, 3.2), vz: Math.sin(a) * s, grav: 12, life: rand(0.35, 0.6), size: rand(0.1, 0.18), color: pick([0xe8fbff, 0xb8ecff]), shape: SHAPE.DROP });
    }
  }
  snowBurst(x, y, z, n = 18, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(2, 6) * scale;
      this.norm.spawn({ x, y: y + 0.2, z, vx: Math.cos(a) * s, vy: rand(1.5, 5), vz: Math.sin(a) * s, grav: 9, drag: 2, life: rand(0.5, 1.0), size: rand(0.15, 0.32) * scale, color: pick([0xffffff, 0xe8f4ff, 0xd8ecff]), shape: SHAPE.SNOW, vr: rand(-4, 4), floor: y + 0.05 });
    }
    this.poof(x, y, z, 0xf4faff, 8, scale);
  }
  sparkle(x, y, z, color = 0xfff4a0, n = 1, spread = 0.4) {
    for (let i = 0; i < n; i++) this.add.spawn({ x: x + rand(-spread, spread), y: y + rand(-spread, spread), z: z + rand(-spread, spread), vy: rand(0.2, 0.8), life: rand(0.4, 0.8), size: rand(0.2, 0.35), size1: 0.02, color, shape: SHAPE.STAR, vr: rand(-4, 4), fadeIn: 0.1 });
  }
  burst(x, y, z, color = 0xfff4a0, n = 24, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1), e = rand(-0.2, 0.9);
      this.add.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * speed, vy: Math.sin(e) * speed, vz: Math.sin(a) * Math.cos(e) * speed, drag: 2.5, life: rand(0.6, 1.1), size: rand(0.3, 0.48), size1: 0.05, color, shape: SHAPE.STAR5, vr: rand(-5, 5) });
    }
    this.add.spawn({ x, y, z, life: 0.3, size: 4, size1: 1, color: 0xffffff, alpha: 0.7, shape: SHAPE.SOFT });
  }
  petals(x, y, z, n = 1, spread = 8) {
    for (let i = 0; i < n; i++) this.norm.spawn({ x: x + rand(-spread, spread), y: y + rand(0, 4), z: z + rand(-spread, spread), vx: rand(0.3, 1.2), vy: rand(-0.9, -0.4), vz: rand(-0.3, 0.6), life: rand(4, 6), size: rand(0.14, 0.22), color: pick([0xffc2d9, 0xffd9e6, 0xff9fc2, 0xffffff]), shape: SHAPE.PETAL, vr: rand(-3, 3), sway: 0.9, fadeIn: 0.4 });
  }
  glow(x, y, z, color, size = 1, life = 0.1) { this.add.spawn({ x, y, z, life, size, color, alpha: 0.8, shape: SHAPE.SOFT, fadeIn: 0 }); }
}

// ---------------------------------------------------------------- static halos (lamps / glowing things), 1 draw call
export class Halos {
  constructor(scene, atlas, pts) {
    const n = pts.length;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    pts.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; size[i] = p.size; const c = new THREE.Color(p.color); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('hsize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('hcol', new THREE.BufferAttribute(col, 3));
    this.uScale = { value: 800 };
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { tAtlas: { value: atlas }, uScale: this.uScale, uNight: U.uNight, uTime: U.uTime, uHalo: { value: new THREE.Vector3(TP.haloNear[0], TP.haloNear[1], TP.haloMax) }, uRes: U.uRes, uPassK: U.uPassK },
      // WP7: a halo never exceeds haloMax metres and fades out under 3 m view depth (a lantern beside the eye is no fog bank)
      vertexShader: `attribute float hsize; attribute vec3 hcol; uniform float uScale, uNight, uTime, uPassK; uniform vec3 uHalo; uniform vec2 uRes; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          float fl = 0.92 + 0.08 * sin(uTime * 7.0 + position.x * 3.0), dz = -mv.z;
          gl_PointSize = min(min(hsize, uHalo.z) * fl * uScale * uPassK / max(0.1, dz), 0.3 * uRes.y); vC = hcol; vA = uNight * fl * smoothstep(uHalo.x, uHalo.y, dz); }`,
      fragmentShader: `uniform sampler2D tAtlas; varying vec3 vC; varying float vA;
        void main(){ vec2 uv = vec2(gl_PointCoord.x * 0.5, 1.0 - gl_PointCoord.y * 0.5); float a = texture2D(tAtlas, uv).a * vA * 0.55; if (a < 0.005) discard; gl_FragColor = vec4(vC, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }
}
