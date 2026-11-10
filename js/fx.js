// Particles (two pooled Points systems: normal + additive), sword slash trails, ground rings/telegraphs, glows.
import * as THREE from 'three';
import { U } from './toon.js';
import { rand, TAU, clamp, pick } from './util.js';

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

export const SHAPE = { SOFT: 0, STAR: 1, LEAF: 2, DOT: 3 };

class Particles {
  constructor(scene, max, additive, atlas) {
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
    this.mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec4 pcolor; attribute float psize; attribute float pshape; attribute float prot;
        uniform float uScale;
        varying vec4 vC; varying float vShape; varying float vRot;
        void main(){
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = psize * uScale / max(0.5, -mvPosition.z);
          vC = pcolor; vShape = pshape; vRot = prot;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D tAtlas;
        varying vec4 vC; varying float vShape; varying float vRot;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vRot), s = sin(vRot);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
          if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
          float col = mod(vShape, 2.0), row = floor(vShape / 2.0);
          vec2 uv = vec2((col + p.x) * 0.5, 1.0 - (row + p.y) * 0.5);
          float a = texture2D(tAtlas, uv).a * vC.a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC.rgb, a);
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
    p.shape = o.shape ?? 0;
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

// ---------------------------------------------------------------- slash trail
function slashGeometry(r0, r1, arc, segs = 28) {
  const pos = [], tt = [], rr = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = -arc / 2 + arc * t; // from right (-) to left (+) around +Z
    for (let j = 0; j < 2; j++) {
      const r = j ? r1 : r0;
      pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
      tt.push(t); rr.push(j);
    }
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rr, 1));
  g.setIndex(idx);
  return g;
}
export class SlashTrail {
  constructor() {
    this.uProg = { value: 0 };
    this.uAlpha = { value: 0 };
    this.uColor = { value: new THREE.Color(1, 1, 1) };
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
      uniforms: { uProg: this.uProg, uAlpha: this.uAlpha, uColor: this.uColor },
      vertexShader: `attribute float aT; attribute float aR; varying float vT; varying float vR; void main(){ vT = aT; vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uProg, uAlpha; uniform vec3 uColor; varying float vT; varying float vR;
        void main(){
          if (vT > uProg) discard;
          float tail = smoothstep(uProg - 0.75, uProg, vT);
          float edge = smoothstep(0.0, 0.85, vR) * (1.0 - smoothstep(0.9, 1.0, vR) * 0.5);
          float a = tail * edge * uAlpha * 0.9;
          gl_FragColor = vec4(mix(uColor * 0.92, vec3(1.0), smoothstep(0.6, 0.95, vR)), a);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(slashGeometry(0.55, 1.6, (140 / 180) * Math.PI), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
    this.t = 1;
    this.dur = 0.3;
  }
  setReach(r, shiny) {
    this.mesh.geometry.dispose();
    this.mesh.geometry = slashGeometry(Math.max(0.5, r - 1.1), r, (140 / 180) * Math.PI);
    this.uColor.value.set(shiny ? 0xffd04a : 0xdff4ff);
  }
  start(dur) { this.t = 0; this.dur = dur; this.mesh.visible = true; }
  update(dt) {
    if (this.t >= 1) { this.mesh.visible = false; return; }
    this.t = Math.min(1, this.t + dt / this.dur);
    const k = this.t;
    this.uProg.value = Math.min(1.15, k * 1.9);
    this.uAlpha.value = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
  }
}

// ---------------------------------------------------------------- ground rings / decals
export class GroundFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 64, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 40);
    this.discGeo.rotateX(-Math.PI / 2);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.planeGeo.rotateX(-Math.PI / 2);
    this.planeGeo.translate(0, 0, 0.5);
  }
  mat(color, opacity, additive) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  /** expanding shockwave ring. returns handle with .r (current radius) */
  shockwave(x, y, z, o = {}) {
    const m = new THREE.Mesh(this.ringGeo, this.mat(o.color ?? 0xfff2c0, 0.9, false));
    m.position.set(x, y + 0.06, z);
    m.renderOrder = 3;
    const glow = new THREE.Mesh(this.ringGeo, this.mat(o.glow ?? 0xffc860, 0.6, true));
    glow.position.copy(m.position); glow.position.y += 0.02;
    glow.renderOrder = 4;
    this.scene.add(m, glow);
    const it = { kind: 'ring', m, glow, r: o.r0 ?? 0.8, speed: o.speed ?? 7, max: o.max ?? 13, width: o.width ?? 0.55, life: 0, active: true, cx: x, cz: z, cy: y };
    m.scale.setScalar(it.r);
    this.items.push(it);
    return it;
  }
  /** shadow / target telegraph circle */
  disc(x, y, z, r, color = 0x2a1a30, opacity = 0.35) {
    const m = new THREE.Mesh(this.discGeo, this.mat(color, opacity, false));
    m.position.set(x, y + 0.05, z);
    m.scale.setScalar(r);
    m.renderOrder = 2;
    this.scene.add(m);
    const it = { kind: 'disc', m, active: true, life: 0, manual: true };
    this.items.push(it);
    return it;
  }
  line(x, y, z, ang, len, width, color = 0xff6a4a, opacity = 0.35) {
    const m = new THREE.Mesh(this.planeGeo, this.mat(color, opacity, false));
    m.position.set(x, y + 0.06, z);
    m.rotation.y = ang;
    m.scale.set(width, 1, len);
    m.renderOrder = 2;
    this.scene.add(m);
    const it = { kind: 'line', m, active: true, life: 0, manual: true };
    this.items.push(it);
    return it;
  }
  remove(it) {
    if (!it || !it.active) return;
    it.active = false;
    for (const m of [it.m, it.glow]) if (m) { this.scene.remove(m); m.material.dispose(); }
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.active) continue;
      it.life += dt;
      if (it.kind === 'ring') {
        it.r += it.speed * dt;
        const k = it.r / it.max;
        it.m.scale.set(it.r, 1, it.r);
        it.glow.scale.set(it.r * 1.02, 1, it.r * 1.02);
        it.m.material.opacity = 0.9 * (1 - k * k);
        it.glow.material.opacity = 0.7 * (1 - k);
        if (it.r >= it.max) this.remove(it);
      }
    }
    this.items = this.items.filter((i) => i.active);
  }
  clear() { for (const it of this.items) this.remove(it); this.items = []; }
}

// ---------------------------------------------------------------- facade
export class FX {
  constructor(scene) {
    this.atlas = atlasTexture();
    this.norm = new Particles(scene, 2600, false, this.atlas);
    this.add = new Particles(scene, 2200, true, this.atlas);
    this.ground = new GroundFX(scene);
  }
  setScale(px) { this.norm.uScale.value = px; this.add.uScale.value = px; }
  update(dt) { this.norm.update(dt); this.add.update(dt); this.ground.update(dt); }
  dust(x, y, z, n = 4, color = 0xe8d6b8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.4, 1.4);
      this.norm.spawn({ x: x + Math.cos(a) * 0.15, y: y + 0.08, z: z + Math.sin(a) * 0.15, vx: Math.cos(a) * s, vy: rand(0.4, 1.1), vz: Math.sin(a) * s, drag: 4, life: rand(0.35, 0.6), size: rand(0.18, 0.3), size1: rand(0.4, 0.6), color, alpha: 0.75, shape: SHAPE.SOFT });
    }
  }
  sparks(x, y, z, n = 8, color = 0xfff4b0) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), e = rand(-0.3, 1.2), s = rand(3, 6.5);
      this.add.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s, vz: Math.sin(a) * Math.cos(e) * s, drag: 7, life: rand(0.2, 0.38), size: rand(0.3, 0.5), size1: 0.05, color, shape: SHAPE.STAR, vr: rand(-8, 8) });
    }
    this.add.spawn({ x, y, z, life: 0.14, size: 1.4, size1: 0.4, color: 0xffffff, alpha: 0.8, shape: SHAPE.SOFT });
  }
  poof(x, y, z, color = 0xffffff, n = 12, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1, 3) * scale;
      this.norm.spawn({ x, y: y + rand(-0.1, 0.3) * scale, z, vx: Math.cos(a) * s, vy: rand(0.5, 2.2) * scale, vz: Math.sin(a) * s, drag: 4.5, life: rand(0.45, 0.8), size: rand(0.35, 0.6) * scale, size1: rand(0.7, 1.0) * scale, color, alpha: 0.9, shape: SHAPE.SOFT });
    }
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      const a = rand(0, TAU), s = rand(2, 5) * scale;
      this.add.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vy: rand(1, 4), vz: Math.sin(a) * s, drag: 3, grav: 4, life: rand(0.5, 0.8), size: rand(0.25, 0.4), size1: 0.05, color: pick([0xfff4a0, 0xffffff, 0xffc8e0]), shape: SHAPE.STAR, vr: rand(-6, 6) });
    }
  }
  leaves(x, y, z, n = 6, colors = [0x8bd65d, 0xa6e07a, 0x6cc04a]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1, 3);
      this.norm.spawn({ x, y: y + rand(0, 0.4), z, vx: Math.cos(a) * s, vy: rand(1.5, 3.5), vz: Math.sin(a) * s, drag: 2.5, grav: 6, life: rand(0.8, 1.3), size: rand(0.18, 0.26), color: pick(colors), shape: SHAPE.LEAF, vr: rand(-10, 10), sway: 0.8 });
    }
  }
  shards(x, y, z, n = 8, colors = [0xc87848, 0xa85a30, 0xe8a878]) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(1.5, 3.5);
      this.norm.spawn({ x, y: y + 0.3, z, vx: Math.cos(a) * s, vy: rand(2, 4.5), vz: Math.sin(a) * s, grav: 14, drag: 1, life: rand(0.6, 0.9), size: rand(0.12, 0.2), color: pick(colors), shape: SHAPE.DOT, floor: y + 0.05 });
    }
  }
  splash(x, y, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.6, 1.8);
      this.norm.spawn({ x, y: y + 0.05, z, vx: Math.cos(a) * s, vy: rand(1.5, 3.2), vz: Math.sin(a) * s, grav: 12, life: rand(0.35, 0.6), size: rand(0.1, 0.18), color: pick([0xe8fbff, 0xb8ecff]), shape: SHAPE.DOT });
    }
  }
  snowBurst(x, y, z, n = 18, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(2, 6) * scale;
      this.norm.spawn({ x, y: y + 0.2, z, vx: Math.cos(a) * s, vy: rand(1.5, 5), vz: Math.sin(a) * s, grav: 9, drag: 2, life: rand(0.5, 1.0), size: rand(0.15, 0.35) * scale, color: pick([0xffffff, 0xe8f4ff, 0xd8ecff]), shape: SHAPE.DOT, floor: y + 0.05 });
    }
    this.poof(x, y, z, 0xf4faff, 8, scale);
  }
  sparkle(x, y, z, color = 0xfff4a0, n = 1, spread = 0.4) {
    for (let i = 0; i < n; i++) this.add.spawn({ x: x + rand(-spread, spread), y: y + rand(-spread, spread), z: z + rand(-spread, spread), vy: rand(0.2, 0.8), life: rand(0.4, 0.8), size: rand(0.2, 0.35), size1: 0.02, color, shape: SHAPE.STAR, vr: rand(-4, 4), fadeIn: 0.1 });
  }
  burst(x, y, z, color = 0xfff4a0, n = 24, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.1, 0.1), e = rand(-0.2, 0.9);
      this.add.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(e) * speed, vy: Math.sin(e) * speed, vz: Math.sin(a) * Math.cos(e) * speed, drag: 2.5, life: rand(0.6, 1.1), size: rand(0.35, 0.55), size1: 0.05, color, shape: SHAPE.STAR, vr: rand(-5, 5) });
    }
    this.add.spawn({ x, y, z, life: 0.3, size: 4, size1: 1, color: 0xffffff, alpha: 0.7, shape: SHAPE.SOFT });
  }
  petals(x, y, z, n = 1, spread = 8) {
    for (let i = 0; i < n; i++) this.norm.spawn({ x: x + rand(-spread, spread), y: y + rand(0, 4), z: z + rand(-spread, spread), vx: rand(0.3, 1.2), vy: rand(-0.9, -0.4), vz: rand(-0.3, 0.6), life: rand(4, 6), size: rand(0.14, 0.22), color: pick([0xffc2d9, 0xffd9e6, 0xff9fc2, 0xffffff]), shape: SHAPE.LEAF, vr: rand(-3, 3), sway: 0.9, fadeIn: 0.4 });
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
      uniforms: { tAtlas: { value: atlas }, uScale: this.uScale, uNight: U.uNight, uTime: U.uTime },
      vertexShader: `attribute float hsize; attribute vec3 hcol; uniform float uScale, uNight, uTime; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          float fl = 0.92 + 0.08 * sin(uTime * 7.0 + position.x * 3.0);
          gl_PointSize = hsize * fl * uScale / max(0.5, -mv.z); vC = hcol; vA = uNight * fl; }`,
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
