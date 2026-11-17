// Telegraph kit (WP5, art §9): ground decals and the 3D telegraphs that read from a 0.88 m eye. Fixed colour code
// (TUNE.actors): coral = danger, cream = the bright top edge, gold = an opening. Every item is { kind, active, life, … }
// and goes away with remove(it); none of them is ever distance-culled (userData.cull, C10).
// - shockwave(x, y, z, o): an expanding ring whose light wall spans exactly its damage band r ± width: two 0.45 m walls
//   and a floor band in one draw call. The fight's fixed step advances it (stepRings), the render draws the radius
//   interpolated by the clock's alpha: what you see is what hits.
// - band(x, y, z, o): the same shader at a set radius (snowball landing reticle, landing-zone rims)
// - stripe(x, y, z, ang, len, width, { end }): a charge / snap / slide path, floor + 0.4 m sand-spray edge walls;
//   it.flash = lock flash; end: a crisp far edge + end wall (the attack stops there) instead of a fade
// - zone(x, y, z, r): Frostbun's landing disc, full radius from the start (it.fill 0 → 1 grows inward), a low light
//   wall on its rim (reads at eye level from inside it) + a sky pillar (faint from inside)
// - crack(x, y, z, size): landing crack decal (fx_crack; fallback: a flat ring band), fades over 1.5 s
// - alert(target, h): '!' pop over an actor (fx_atlas cell 'alert'; fallback: a drawn bubble)
// - glint(x, y, z, o): a 4-point sparkle flash at an attack's business end (fx_atlas 'sparkle_4'; fallback drawn)
// - aura(target, o): a soft coral halo behind an enemy for its wind-up (drawn; never a crisp ring, so it never reads as
//   a UI reticle and never shows a ground cut)
// - disc / line: the old flat decals (kept for compatibility)
import * as THREE from 'three';
import { G } from './core.js';
import { U } from './toon.js';
import { Assets } from './assets.js';
import { actors as TA } from './tune.js';

const NOCULL = { dist: Infinity, fade: 0 };
const col = (hex) => new THREE.Color(hex);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- shaders
const BAND_VS = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute vec2 aDir; attribute float aSide; attribute float aH; attribute float aFloor;
  uniform float uR, uW, uH;
  varying float vSide, vH, vFloor;
  void main() {
    float rr = max(0.0, uR + aSide * uW);
    vec4 mvPosition = modelViewMatrix * vec4(aDir.x * rr, aH * uH + aFloor * 0.02, aDir.y * rr, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vSide = aSide; vH = aH; vFloor = aFloor;
    #include <fog_vertex>
  }`;
const BAND_FS = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor, uEdge; uniform float uA, uFloorA, uWallA, uTop;
  varying float vSide, vH, vFloor;
  void main() {
    vec3 c = uColor; float a;
    if (vFloor > 0.5) {
      float e = abs(vSide);                              // 0 on the band's centre line, 1 on its edges
      float centre = 1.0 - smoothstep(0.0, 0.1, e);
      a = uFloorA * (0.55 + 0.45 * smoothstep(0.8, 1.0, e)) + centre * uFloorA * 0.6;
      c = mix(c, uEdge, centre * 0.5);
    } else {
      float top = smoothstep(1.0 - uTop, 1.0 - uTop * 0.4, vH);
      a = uWallA * pow(1.0 - vH, 1.25) + top * min(1.0, uWallA * 1.7);
      c = mix(c, uEdge, top);
    }
    gl_FragColor = vec4(c, clamp(a * uA, 0.0, 1.0));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
const STRIPE_VS = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute float aU; attribute float aV; attribute float aH; attribute float aFloor;
  uniform float uWidth, uLen, uH;
  varying float vU, vV, vH, vFloor;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(aU * 0.5 * uWidth, aH * uH + aFloor * 0.02, aV * uLen, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vU = aU; vV = aV; vH = aH; vFloor = aFloor;
    #include <fog_vertex>
  }`;
const STRIPE_FS = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor, uEdge; uniform float uA, uFlash, uTime, uLen, uEnd;
  varying float vU, vV, vH, vFloor;
  void main() {
    vec3 c = uColor; float a;
    float far = mix(1.0 - smoothstep(0.7, 1.0, vV), 1.0, uEnd);   // uEnd: the attack stops there → a crisp end
    if (vFloor > 1.5) {                                             // the end wall (only with uEnd)
      float top = smoothstep(0.86, 0.96, vH);
      a = uEnd * (0.6 * pow(1.0 - vH, 1.2) + top * 0.8);
      c = mix(c, uEdge, top * 0.85);
    } else if (vFloor > 0.5) {
      float e = abs(vU);
      float centre = 1.0 - smoothstep(0.0, 0.05, e);
      float edge = max(smoothstep(0.93, 0.99, e), uEnd * smoothstep(uLen - 0.14, uLen - 0.03, vV * uLen));
      a = 0.35 + 0.35 * centre + 0.45 * edge;
      c = mix(c, uEdge, max(centre * 0.55, edge * 0.7));
      // chevrons sliding toward the far end: the direction of the charge
      float ch = fract(vV * uLen * 0.35 - abs(vU) * 0.6 - uTime * 1.6);
      a += 0.12 * smoothstep(0.75, 0.95, ch) * (1.0 - e);
    } else {
      float spray = 0.7 + 0.3 * sin(vV * uLen * 5.0 + uTime * 13.0 + vU * 3.0);
      float top = smoothstep(0.86, 0.96, vH);
      a = 0.6 * pow(1.0 - vH, 1.2) * spray + top * 0.8;
      c = mix(c, uEdge, top * 0.85);
    }
    gl_FragColor = vec4(c, clamp(a * far * uA * (1.0 + uFlash), 0.0, 1.0));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
const ZONE_VS = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  varying vec2 vP;
  void main() {
    vP = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const ZONE_FS = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uColor, uEdge; uniform float uA, uFill, uTime;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    if (d > 1.0) discard;
    float filled = step(1.0 - uFill, d);
    float a = mix(0.3, mix(0.38, 0.66, uFill), filled);
    float rim = smoothstep(0.94, 0.975, d);
    float front = filled * (1.0 - smoothstep(0.0, 0.05, d - (1.0 - uFill))) * step(0.01, uFill) * step(uFill, 0.99);
    float pulse = 0.85 + 0.15 * sin(uTime * 12.0);
    vec3 c = mix(uColor, uEdge, max(rim, front * 0.7));
    a = max(a, max(rim * 0.95, front * 0.8)) * pulse;
    gl_FragColor = vec4(c, clamp(a * uA, 0.0, 1.0));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;
// a column of light seen from outside: bright at its silhouette edges, nearly clear in the middle (it never hides
// what is behind it), faded near the eye; seen from inside (uInside, the eye within its radius): a faint swirling coral
// veil all round (uIn), brightest low down, so a player standing in the landing zone sees it whichever way he looks
const PILLAR_VS = /* glsl */`
  varying vec2 vUv; varying float vDepth; varying vec3 vN; varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`;
const PILLAR_FS = /* glsl */`
  uniform vec3 uColor, uEdge; uniform float uA, uTime, uIn, uInside;
  varying vec2 vUv; varying float vDepth; varying vec3 vN; varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float swirl = 0.75 + 0.25 * sin(vUv.x * 37.7 + vUv.y * 9.0 - uTime * 4.0);
    float a = (0.07 + 0.5 * rim) * pow(1.0 - vUv.y, 0.8) * swirl + 0.25 * rim * (1.0 - smoothstep(0.0, 0.05, vUv.y));
    a *= smoothstep(1.8, 3.4, vDepth) * (1.0 - smoothstep(60.0, 110.0, vDepth));
    float ain = uIn * swirl * pow(1.0 - vUv.y, 0.5) * (0.7 + 0.3 * rim);
    a = mix(a, ain, uInside);
    vec3 c = mix(uEdge, uColor, 0.35 + 0.65 * smoothstep(0.0, 0.4, vUv.y));
    gl_FragColor = vec4(c, clamp(a * uA, 0.0, 1.0));
    #include <colorspace_fragment>
  }`;

function shader(vs, fs, uniforms, o = {}) {
  const fog = o.fog !== false;
  const u = THREE.UniformsUtils.merge(fog ? [THREE.UniformsLib.fog, uniforms] : [uniforms]);
  if (uniforms.uTime) u.uTime = U.uTime;              // shared clock (merge would copy it)
  return new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, fog,
    side: THREE.DoubleSide, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
}

/** ring band: floor strip (inner → outer) + inner wall + outer wall, unit-parameterised (the shader places it) */
function bandGeometry(n = 96) {
  const dir = [], side = [], h = [], fl = [], idx = [];
  const strips = [[-1, 0, 1, 0, 1, 1], [-1, 0, 0, -1, 1, 0], [1, 0, 0, 1, 1, 0]]; // [sideA, hA, floor, sideB, hB, floor]
  for (const [sA, hA, fA, sB, hB, fB] of strips) {
    const base = dir.length / 2;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, x = Math.sin(a), z = Math.cos(a);
      dir.push(x, z, x, z); side.push(sA, sB); h.push(hA, hB); fl.push(fA, fB);
      if (i < n) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  const nv = dir.length / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nv * 3), 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(h, 1));
  g.setAttribute('aFloor', new THREE.Float32BufferAttribute(fl, 1));
  g.setIndex(idx);
  return g;
}
/** stripe: floor (u −1..1, v 0..1) + two edge walls + an end wall across v = 1 (aFloor 2), unit-parameterised */
function stripeGeometry(n = 24) {
  const U_ = [], V = [], H = [], F = [], idx = [];
  const strips = [[-1, 0, 1, 1, 0, 1], [-1, 0, 0, -1, 1, 0], [1, 0, 0, 1, 1, 0]];
  for (const [uA, hA, fA, uB, hB, fB] of strips) {
    const base = U_.length;
    for (let i = 0; i <= n; i++) {
      const v = i / n;
      U_.push(uA, uB); V.push(v, v); H.push(hA, hB); F.push(fA, fB);
      if (i < n) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const base = U_.length, m = 8;
  for (let i = 0; i <= m; i++) {
    const u = -1 + (2 * i) / m;
    U_.push(u, u); V.push(1, 1); H.push(0, 1); F.push(2, 2);
    if (i < m) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(U_.length * 3), 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(U_, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(V, 1));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(H, 1));
  g.setAttribute('aFloor', new THREE.Float32BufferAttribute(F, 1));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- sprites ('!' alert, glint)
function canvasTex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const DRAWN = {
  alert: (x) => {          // cream bubble with a coral '!' and a brown outline (art §15 B02 fallback)
    x.lineWidth = 7; x.strokeStyle = '#4a2c1a'; x.fillStyle = '#fff6e2';
    x.beginPath(); x.arc(64, 58, 44, 0, TAU); x.moveTo(52, 96); x.lineTo(60, 122); x.lineTo(74, 98); x.fill(); x.stroke();
    x.fillStyle = '#ff7a4a'; x.strokeStyle = '#4a2c1a'; x.lineWidth = 4;
    x.beginPath(); x.roundRect(54, 22, 20, 46, 10); x.fill(); x.stroke();
    x.beginPath(); x.arc(64, 84, 10, 0, TAU); x.fill(); x.stroke();
  },
  ring: (x) => { x.lineWidth = 12; x.strokeStyle = '#ffffff'; x.beginPath(); x.arc(64, 64, 50, 0, TAU); x.stroke(); },
  // a soft glow (white; tinted by the sprite colour): full behind the body, a bright band around it, fading out
  halo: (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 63);
    g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)'); g.addColorStop(0.64, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  },
  sparkle_4: (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = '#fff'; x.beginPath();
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? 9 : 60; i ? x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r) : x.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    x.fill();
  },
};
const cellCache = new Map();
// the '!' pop has nothing per-pop in its material: one shared material per texture, never disposed (a new material per pop,
// disposed with it, released the sprite program after the last pop and the next first '!' compiled it again)
const alertMats = new Map();
function alertMat() {
  const tex = cellTex('alert');
  let m = alertMats.get(tex);
  if (!m) { m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }); m.userData.shared = true; alertMats.set(tex, m); }
  return m;
}
let halo = null;
const haloTex = () => halo || (halo = canvasTex(DRAWN.halo));
/** a texture showing one fx_atlas cell (the full or lo file, whichever is loaded), or a drawn fallback */
function cellTex(name) {
  const base = Assets.textures && Assets.textures.fx_atlas;
  const atlas = base && (base.userData.atlas || (Assets.atlas && Assets.atlas.fx_atlas));
  const cell = atlas && atlas.cells && atlas.cells[name];
  const key = name + (cell ? '@' + base.uuid : '@drawn');
  let t = cellCache.get(key);
  if (t) return t;
  if (cell && base.image) {
    const [W, H] = atlas.size || [base.image.width, base.image.height];
    t = base.clone();
    t.repeat.set(cell.w / W, cell.h / H);
    t.offset.set(cell.x / W, 1 - (cell.y + cell.h) / H);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
  } else t = canvasTex(DRAWN[name] || DRAWN.sparkle_4);
  cellCache.set(key, t);
  return t;
}

export class GroundFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 64, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48);
    this.discGeo.rotateX(-Math.PI / 2);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.planeGeo.rotateX(-Math.PI / 2);
    this.planeGeo.translate(0, 0, 0.5);
    this.bandGeo = bandGeometry();
    this.stripeGeo = stripeGeometry();
    this.pillarGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
    this.pillarGeo.translate(0, 0.5, 0);
    this.crackGeo = new THREE.PlaneGeometry(1, 1);
    this.crackGeo.rotateX(-Math.PI / 2);
  }
  mat(color, opacity, additive) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  add(it, ...meshes) {
    for (const m of meshes) { m.userData.cull = NOCULL; m.frustumCulled = false; this.scene.add(m); }
    it.active = true; it.life = it.life || 0;
    this.items.push(it);
    return it;
  }
  bandMat(o = {}) {
    return shader(BAND_VS, BAND_FS, {
      uR: { value: o.r ?? 1 }, uW: { value: o.w ?? 0.55 }, uH: { value: o.h ?? TA.ringWall },
      uColor: { value: col(o.color ?? TA.danger) }, uEdge: { value: col(o.edge ?? TA.dangerEdge) },
      uA: { value: 1 }, uFloorA: { value: o.floorA ?? 0.42 }, uWallA: { value: o.wallA ?? 0.55 }, uTop: { value: o.top ?? 0.07 },
    });
  }
  /** expanding shockwave: a light wall exactly on the damage band r ± width. Returns the handle the fight steps:
   *  { r, prevR, width, speed, max, cx, cy, cz, active } (fixed-step radius; the mesh draws it interpolated) */
  shockwave(x, y, z, o = {}) {
    const width = o.width ?? 0.55;
    const m = new THREE.Mesh(this.bandGeo, this.bandMat({ w: width, h: o.wall ?? TA.ringWall, color: o.color, wallA: 0.55, floorA: 0.42 }));
    m.position.set(x, y + 0.04, z);
    m.renderOrder = 3;
    const r0 = o.r0 ?? 0.8;
    const it = { kind: 'ring', m, sim: true, r: r0, prevR: r0, speed: o.speed ?? 7, max: o.max ?? 13, width, cx: x, cz: z, cy: y, puffT: 0 };
    return this.add(it, m);
  }
  /** a static band (reticles, zone rims): o = { r, w, h, color, wallA, floorA } → it with it.m.material.uniforms */
  band(x, y, z, o = {}) {
    const m = new THREE.Mesh(this.bandGeo, this.bandMat(o));
    m.position.set(x, y + 0.04, z);
    m.renderOrder = 3;
    return this.add({ kind: 'band', m, manual: true }, m);
  }
  /** Pinch's charge path: ang = yaw of the charge, len, width = the damage width; set it.flash (0..1) for the lock */
  stripe(x, y, z, ang, len, width, o = {}) {
    const m = new THREE.Mesh(this.stripeGeo, shader(STRIPE_VS, STRIPE_FS, {
      uWidth: { value: width }, uLen: { value: len }, uH: { value: o.wall ?? TA.stripeWall }, uTime: U.uTime,
      uColor: { value: col(o.color ?? TA.danger) }, uEdge: { value: col(TA.dangerEdge) }, uA: { value: 1 }, uFlash: { value: 0 },
      uEnd: { value: o.end ? 1 : 0 },
    }));
    m.position.set(x, y + 0.03, z);
    m.rotation.y = ang;
    m.renderOrder = 3;
    return this.add({ kind: 'stripe', m, manual: true, width, len, flash: 0 }, m);
  }
  /** landing zone: the full radius r at once, it.fill (0 → 1) grows inward; a light wall on the rim (o.wall m,
   *  default TA.zoneWall; 0 = none); o.pillar (default on) adds the sky column */
  zone(x, y, z, r, o = {}) {
    const m = new THREE.Mesh(this.discGeo, shader(ZONE_VS, ZONE_FS, {
      uColor: { value: col(o.color ?? TA.danger) }, uEdge: { value: col(TA.dangerEdge) }, uA: { value: 1 }, uFill: { value: 0 }, uTime: U.uTime,
    }));
    m.position.set(x, y + 0.05, z);
    m.scale.setScalar(r);
    m.renderOrder = 3;
    const it = { kind: 'zone', m, manual: true, r, fill: 0 };
    const meshes = [m];
    const wall = o.wall ?? TA.zoneWall;
    if (wall > 0) {
      // the rim as a low light wall (the shockwave's band shader): its edge reads at eye level from inside the disc
      const b = new THREE.Mesh(this.bandGeo, this.bandMat({ r: r - 0.04, w: 0.04, h: wall, color: o.color, wallA: 0.62, floorA: 0, top: 0.16 }));
      b.position.set(x, y + 0.04, z);
      b.renderOrder = 3;
      it.rim = b; meshes.push(b);
    }
    if (o.pillar !== false) {
      const p = new THREE.Mesh(this.pillarGeo, shader(PILLAR_VS, PILLAR_FS, { uColor: { value: col(TA.danger) }, uEdge: { value: col(TA.dangerEdge) }, uA: { value: 1 }, uTime: U.uTime, uIn: { value: TA.pillarIn }, uInside: { value: 0 } }, { fog: false }));
      p.position.set(x, y, z);
      p.scale.set(o.pillarR ?? TA.pillarR, o.pillarH ?? TA.pillarH, o.pillarR ?? TA.pillarR);
      p.renderOrder = 7;
      it.pillar = p; meshes.push(p);
    }
    return this.add(it, ...meshes);
  }
  /** move a zone (and its pillar) */
  moveZone(it, x, y, z) {
    if (!it || !it.active) return;
    it.m.position.set(x, y + 0.05, z);
    if (it.rim) it.rim.position.set(x, y + 0.04, z);
    if (it.pillar) it.pillar.position.set(x, y, z);
  }
  /** a landing crack decal (fx_crack) that fades over `life` s; without the art a flat danger ring */
  crack(x, y, z, size = 2.5, life = 1.5) {
    const tex = Assets.tex ? Assets.tex('fx_crack', { hd: false }) : null;
    if (!tex || tex.userData.fallback) {
      const b = this.band(x, y, z, { r: size * 0.45, w: size * 0.08, h: 0.01, wallA: 0, floorA: 0.5 });
      b.fade = life; b.manual = false;
      return b;
    }
    const m = new THREE.Mesh(this.crackGeo, new THREE.MeshBasicMaterial({ map: tex, color: 0x6a4630, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.position.set(x, y + 0.035, z);
    m.rotation.y = Math.random() * TAU;
    m.scale.setScalar(size);
    m.renderOrder = 2;
    return this.add({ kind: 'crack', m, fade: life }, m);
  }
  /** '!' pop over target (anything with root.position, or {x,y,z}); h = height of its top above the root */
  alert(target, h = 1) {
    const s = new THREE.Sprite(alertMat());
    s.renderOrder = 8;
    s.scale.setScalar(0.001);
    const it = { kind: 'alert', m: s, target, h, life: 0, dur: TA.alertLife };
    this.placeAlert(it);
    return this.add(it, s);
  }
  placeAlert(it, up = TA.alertH) {
    const p = it.target && (it.target.root ? it.target.root.position : it.target);
    if (p) it.m.position.set(p.x, p.y + it.h + up, p.z);
  }
  /** a 4-point glint at an attack's business end: o = { color, size, life } */
  glint(x, y, z, o = {}) {
    const mat = new THREE.SpriteMaterial({ map: cellTex('sparkle_4'), color: o.color ?? TA.glint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, y, z);
    s.renderOrder = 8;
    s.scale.setScalar(0.001);
    s.material.rotation = Math.random() * 0.6;
    return this.add({ kind: 'glint', m: s, life: 0, dur: o.life ?? TA.glintLife, size: o.size ?? TA.glintSize }, s);
  }
  /** a pulsing soft coral halo behind an actor for its whole wind-up (reads at any range, whatever the actor's
   *  colour): o = { h (centre height over its root), size / sizeY (m), back (m pushed away from the camera, so the body
   *  hides its middle), dur, color, until() (false ends it early) } */
  aura(target, o = {}) {
    const mat = new THREE.SpriteMaterial({ map: haloTex(), color: o.color ?? TA.danger, transparent: true, depthWrite: false, fog: false, opacity: 0.8 });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 1;
    s.scale.setScalar(0.001);
    const it = { kind: 'aura', m: s, target, h: o.h ?? 0.4, size: o.size ?? 1.2, sizeY: o.sizeY ?? o.size ?? 1.2, back: o.back ?? 0.3, dur: o.dur ?? 0.6, until: o.until || null };
    this.placeAura(it);
    return this.add(it, s);
  }
  placeAura(it) {
    this.placeAlert(it, 0);
    const cam = G.camera, p = it.m.position;
    if (!cam) return;
    const dx = p.x - cam.position.x, dz = p.z - cam.position.z, l = Math.hypot(dx, dz);
    if (l > 1e-3) { p.x += (dx / l) * it.back; p.z += (dz / l) * it.back; }
  }
  // ---- legacy flat decals
  disc(x, y, z, r, color = 0x2a1a30, opacity = 0.35) {
    const m = new THREE.Mesh(this.discGeo, this.mat(color, opacity, false));
    m.position.set(x, y + 0.05, z);
    m.scale.setScalar(r);
    m.renderOrder = 2;
    return this.add({ kind: 'disc', m, manual: true }, m);
  }
  line(x, y, z, ang, len, width, color = 0xff6a4a, opacity = 0.35) {
    const m = new THREE.Mesh(this.planeGeo, this.mat(color, opacity, false));
    m.position.set(x, y + 0.06, z);
    m.rotation.y = ang;
    m.scale.set(width, 1, len);
    m.renderOrder = 2;
    return this.add({ kind: 'line', m, manual: true }, m);
  }
  remove(it) {
    if (!it || !it.active) return;
    it.active = false;
    for (const m of [it.m, it.glow, it.pillar, it.rim]) if (m) { this.scene.remove(m); if (!m.material.userData.shared) m.material.dispose(); }
  }
  /** fixed step (the fight calls it): shockwave radii advance here, so the hit test and the picture share them */
  stepRings(dt) {
    for (const it of this.items) {
      if (!it.active || it.kind !== 'ring') continue;
      it.prevR = it.r;
      it.r += it.speed * dt;
      if (it.r >= it.max) this.remove(it);
    }
  }
  /** render frame: draw rings at the interpolated radius, animate pops / glints / fades */
  update(dt) {
    const alpha = G.clock ? G.clock.alpha : 1;
    for (const it of this.items) {
      if (!it.active) continue;
      it.life += dt;
      const m = it.m;
      if (it.kind === 'ring') {
        if (!it.sim) { it.prevR = it.r; it.r += it.speed * dt; if (it.r >= it.max) { this.remove(it); continue; } }
        // drawn between the interpolated and the sim radius, widened by the gap: the picture always covers the band
        // the hit test uses this frame (exactly it when alpha = 1)
        const r = it.prevR + (it.r - it.prevR) * alpha, u = m.material.uniforms;
        u.uR.value = (r + it.r) / 2; u.uW.value = it.width + Math.abs(it.r - r) / 2;
        u.uA.value = Math.max(0, Math.min(1, (it.max - r) / 1.5));   // fades only past the arena wall (max = r + 1)
        // dust puffs riding the wave
        it.puffT -= dt;
        if (it.puffT <= 0 && G.fx && r > 1.2) {
          it.puffT = 0.05;
          for (let i = 0; i < 2; i++) { const a = Math.random() * TAU; G.fx.dust(it.cx + Math.sin(a) * r, it.cy, it.cz + Math.cos(a) * r, 1, 0xf2e2c8); }
        }
      } else if (it.kind === 'stripe') {
        m.material.uniforms.uFlash.value = it.flash || 0;
      } else if (it.kind === 'zone') {
        m.material.uniforms.uFill.value = Math.max(0, Math.min(1, it.fill));
        if (it.pillar && G.camera) {   // the eye inside the column: the inside veil instead of the outside look
          const p = it.pillar.position, c = G.camera.position, r = it.pillar.scale.x;
          it.pillar.material.uniforms.uInside.value = 1 - Math.max(0, Math.min(1, (Math.hypot(c.x - p.x, c.z - p.z) - (r - 0.25)) / 0.5));
        }
      } else if (it.kind === 'alert') {
        const k = it.life / 0.25, out = it.life > it.dur - 0.15 ? Math.max(0, (it.dur - it.life) / 0.15) : 1;
        // 0 → 1.2 → 1 (ease-out-back) over 0.25 s; grows with distance so it stays ≥ ~20 px far away
        const pop = k < 1 ? Math.sin((k * Math.PI) / 2) * (1 + 0.3 * Math.sin(k * Math.PI)) : 1;
        const cam = G.camera, d = cam ? cam.position.distanceTo(m.position) : 4;
        this.placeAlert(it);
        m.scale.setScalar(Math.max(0.001, TA.alertSize * Math.max(1, d / 8) * pop * out));
        if (it.life >= it.dur) { this.remove(it); continue; }
      } else if (it.kind === 'aura') {
        const k = it.life / it.dur;
        if (k >= 1 || (it.until && !it.until())) { this.remove(it); continue; }
        this.placeAura(it);
        const grow = Math.min(1, it.life / 0.12), pulse = (1 + 0.1 * Math.sin(it.life * 16)) * (1 + 0.2 * k) * grow;
        m.scale.set(Math.max(0.001, it.size * pulse), Math.max(0.001, it.sizeY * pulse), 1);
        m.material.opacity = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(it.life * 16));
      } else if (it.kind === 'glint') {
        const k = it.life / it.dur;
        m.scale.setScalar(Math.max(0.001, it.size * Math.sin(Math.min(1, k) * Math.PI)));
        m.material.rotation += dt * 3;
        if (k >= 1) { this.remove(it); continue; }
      }
      if (it.fade) {
        const a = Math.max(0, 1 - it.life / it.fade);
        if (m.material.uniforms) m.material.uniforms.uA.value = a; else m.material.opacity = a;
        if (a <= 0) { this.remove(it); continue; }
      }
    }
    this.items = this.items.filter((i) => i.active);
  }
  clear() { for (const it of this.items) this.remove(it); this.items = []; }
  /** live telegraph items by kind (tests, debug) */
  count(kind) { let n = 0; for (const it of this.items) if (it.active && (!kind || it.kind === kind)) n++; return n; }
}
