// Module wp8-atmo (WP8): the render-side glue of the atmosphere.
// - world far plane (TUNE.atmo.far) — the sky layer (sky.js) draws behind it;
// - fog per region / time of day / boss fight, blended over ~3 s (snapped on session start and teleports);
// - the water's light, sky reflection, glints and wading ripples (took over game.js's water tint);
// - landmark fog caps: the Great Tree and W.landmarks by position (shared uniform cylinders, refreshed when WP9's
//   anchors change), plus any Object3D tagged userData.fogCap (per-material define);
// - procedural gulls circling over the shores and painted light-shaft cards in the woods (one draw call each);
// - G.debug.atmo helpers.
import * as THREE from 'three';
import { G } from './core.js';
import { REGIONS, REGION } from './data.js';
import { EV } from './events.js';
import { U } from './toon.js';
import { atmo as TA } from './tune.js';
import { clamp, lerp, smoothstep } from './util.js';
import { Assets } from './assets.js';
import { fogCap, displayed, ATMO, sunLightDir } from './sky.js';

const _c = new THREE.Color();

// ---------------------------------------------------------------- gulls (shores, daytime): body + two flapping wings
function gullGeometry() {
  // a tiny low-poly gull (+Z forward): a double-pyramid body, beak and two wings (inner panel + grey tip);
  // attribute wing = span fraction (0 body … 1 tip) drives the flap in the vertex shader
  const P = [], C = [];
  const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) C.push(...col); };
  const white = [1, 1, 1], grey = [0.6, 0.64, 0.72], beak = [1.0, 0.72, 0.3];
  const nose = [0, 0.02, 0.32], tail = [0, 0.03, -0.34], top = [0, 0.1, 0], bot = [0, -0.07, 0], l = [-0.08, 0.01, 0], r = [0.08, 0.01, 0];
  for (const [a, b] of [[top, l], [l, bot], [bot, r], [r, top]]) { tri(nose, a, b, white); tri(tail, b, a, white); }
  tri([0, 0.04, 0.32], [0.025, 0.02, 0.44], [-0.025, 0.02, 0.44], beak);
  for (const s of [-1, 1]) {
    const r0 = [s * 0.06, 0.03, 0.1], r1 = [s * 0.06, 0.03, -0.12], m0 = [s * 0.42, 0.05, 0.06], m1 = [s * 0.42, 0.05, -0.12], tip = [s * 0.78, 0.04, -0.16];
    tri(r0, m0, r1, white); tri(r1, m0, m1, white); tri(m0, tip, m1, grey);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const wing = new Float32Array(P.length / 3);
  for (let i = 0; i < wing.length; i++) { const x = Math.abs(P[i * 3]); wing[i] = x > 0.07 ? x / 0.78 : 0; }
  g.setAttribute('wing', new THREE.BufferAttribute(wing, 1));
  g.computeVertexNormals();
  return g;
}

function buildGulls(W) {
  const n = TA.gulls, geo = gullGeometry();
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = i * 1.37;
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform float uTime; attribute float wing; attribute float phase;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float f = sin(uTime * 9.0 + phase) * 0.55 + 0.12; transformed.y += wing * f * 0.55; transformed.x *= 1.0 - wing * abs(f) * 0.18; }`);
  };
  mat.customProgramCacheKey = () => 'wp8gull';
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.name = 'gulls';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.userData.cull = { dist: Infinity };
  // circling centres over the shores beaches and the islets (deterministic)
  const sh = W.arenas && W.arenas.shores ? W.arenas.shores : { x: 26, z: 142 };
  const isl = (W.islets && W.islets[0]) || { x: -40, z: 139 };
  const C = [[sh.x - 18, sh.z - 22], [isl.x, isl.z - 6], [sh.x + 30, sh.z - 40]];
  mesh.userData.birds = Array.from({ length: n }, (_, i) => {
    const c = C[i % C.length];
    return { cx: c[0], cz: c[1], r: 11 + ((i * 7) % 5) * 3.2, y: 13 + ((i * 5) % 6) * 2.2, w: (0.38 + ((i * 3) % 4) * 0.05) * (i % 2 ? 1 : -1), a: i * 2.1 };
  });
  return mesh;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function updateGulls(mesh, t, night) {
  const B = mesh.userData.birds, vis = night < 0.6;
  mesh.visible = vis;
  if (!vis) return;
  for (let i = 0; i < B.length; i++) {
    const b = B[i], a = b.a + t * b.w;
    _p.set(b.cx + Math.sin(a) * b.r, b.y + Math.sin(t * 0.4 + i) * 1.2, b.cz + Math.cos(a) * b.r);
    const dir = b.w > 0 ? a + Math.PI / 2 : a - Math.PI / 2;            // tangent of the circle
    _e.set(0, dir, (b.w > 0 ? -1 : 1) * 0.35, 'YXZ');                     // bank into the turn
    _q.setFromEuler(_e);
    _s.setScalar(1.15);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- woods light shafts (procedural, additive)
// Each beam is light falling out of a tree crown: its top end sits just inside a round crown's underside and it is gone
// before it (so it is never drawn against the open sky), it runs down the morning sun ray (baked at shaftHour, so the top
// stays in its crown) to the ground beside the woods path, and it shows only while the sun shines along it (morning;
// gone by early afternoon and at night).
const SHAFT_VS = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>
  attribute vec2 corner; attribute vec4 iBase; attribute vec4 iAxis;   // ground point + width; unit axis + length
  varying vec2 vUv; varying float vNear;
  void main() {
    vec3 ax = iAxis.xyz;
    vec3 toCam = cameraPosition - iBase.xyz;
    vec3 side = normalize(cross(ax, toCam) + vec3(1e-4));
    // from the ground up the sun ray into the crown's underside (an even width, so no corner pokes out of the crown)
    vec3 w = iBase.xyz + side * corner.x * 0.5 * iBase.w + ax * corner.y * iAxis.w;
    vUv = vec2(corner.x * 0.5 + 0.5, corner.y);
    vec4 mvPosition = viewMatrix * vec4(w, 1.0);
    vNear = smoothstep(1.2, 5.0, length(cameraPosition - w));
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const SHAFT_FS = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uCol; uniform float uK, uTop;
  varying vec2 vUv; varying float vNear;
  void main() {
    float x = vUv.x - 0.5;
    float beam = exp(-x * x * 7.0) * (0.75 + 0.25 * sin(vUv.x * 17.0 + vUv.y * 2.0));
    // a soft contact with the ground, an even body below the crown, gone before the top end (inside the crown)
    float a = beam * smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(uTop * 0.55, uTop, vUv.y)) * uK * vNear;
    #ifdef USE_FOG
      a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);   // additive: fog fades it out (never adds the fog colour)
    #endif
    gl_FragColor = vec4(uCol * a, 1.0);
  }`;
/** beam spots: [x, y, z (ground), width, axis x, y, z, length] under round tree crowns near the woods path. ax: the
 *  baked sun ray */
export function shaftSpots(W, ax) {
  const pts = (W.paths && W.paths.woods) || [], spots = [];
  if (pts.length < 2 || !W.colliders || ax.y < 0.2) return spots;
  const pathD = (x, z) => { let d = 1e9; for (const p of pts) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2); return Math.sqrt(d); };
  const pathI = (x, z) => { let b = 0, d = 1e9; pts.forEach((p, i) => { const e = (p.x - x) ** 2 + (p.z - z) ** 2; if (e < d) { d = e; b = i; } }); return b; };
  const cand = [];
  for (const c of W.colliders) {
    if (c.kind !== 'tree_round' || !c.active || !Number.isFinite(c.camTop) || !Number.isFinite(c.y1)) continue;
    if (W.regionAt(c.x, c.z) !== REGION.WOODS || pathD(c.x, c.z) > 12) continue;
    // the top end: just inside the round crown's underside (shaftIn m above it) on the trunk axis
    const ty = c.camTop + TA.shaftIn;
    let gx = c.x, gz = c.z, g = W.hAt(gx, gz);
    for (let k = 0; k < 2; k++) { const run = (ty - g) / ax.y; gx = c.x - ax.x * run; gz = c.z - ax.z * run; g = W.hAt(gx, gz); }
    const len = (ty - g) / ax.y, rise = ty - g;
    if (!(rise > 1.8 && rise < 5)) continue;
    const pd = pathD(gx, gz);
    if (pd < 0.8 || pd > 8) continue;                                  // beside the path, where the player walks past
    if (W.regionAt(gx, gz) !== REGION.WOODS || (W.inArena && W.inArena(gx, gz, 3))) continue;
    let clear = true;
    for (const o of W.nearColliders(gx, gz, 3, [])) if (o !== c && Math.hypot(o.x - gx, o.z - gz) < o.r + 0.3) clear = false;
    if (clear) cand.push({ i: pathI(gx, gz), s: [gx, g, gz, 0, ax.x, ax.y, ax.z, len] });
  }
  // spread along the path (from a fifth of its length), ≥ 7 m apart, alternating widths
  cand.sort((a, b) => a.i - b.i);
  for (const c of cand) {
    if (spots.length >= TA.shafts || c.i < pts.length * 0.2) continue;
    if (spots.some((s) => Math.hypot(s[0] - c.s[0], s[2] - c.s[2]) < 7)) continue;
    c.s[3] = 2.2 + (spots.length % 3) * 0.4;
    spots.push(c.s);
  }
  return spots;
}
function buildShafts(W) {
  const ax = sunLightDir(TA.shaftHour), spots = shaftSpots(W, ax);
  if (!spots.length) return null;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geo.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('iBase', new THREE.InstancedBufferAttribute(new Float32Array(spots.flatMap((s) => s.slice(0, 4))), 4));
  geo.setAttribute('iAxis', new THREE.InstancedBufferAttribute(new Float32Array(spots.flatMap((s) => s.slice(4, 8))), 4));
  geo.instanceCount = spots.length;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCol: { value: new THREE.Color(0xfff4d0) }, uK: { value: 0 }, uTop: { value: TA.shaftTop } }]);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: SHAFT_VS, fragmentShader: SHAFT_FS, transparent: true, depthWrite: false, fog: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lightShafts';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.userData.cull = { dist: Infinity };   // r2 world: world-space instances at the origin; WP7 would cull it by the camera's distance from (0, 0)
  mesh.userData.spots = spots;
  mesh.userData.axis = ax;
  return mesh;
}

// ---------------------------------------------------------------- the module
const mod = {
  name: 'wp8-atmo',
  game: null,
  fog: { near: 30, far: 230, tint: new THREE.Color(1, 1, 1), tintK: 0, snap: true },
  feat: { fogAtmo: true, caps: true, shadowAhead: true, terrainDetail: true, terrainCliff: true, terrainSide: true, terrainGrain: true, terrainPlaza: true, sprites: true, water: true, gulls: true, shafts: true },
  ripI: 0, lastCam: new THREE.Vector3(1e9, 0, 0), idleRip: 0,
  attach(game) {
    this.game = game;
    const cam = game.camera;
    cam.far = TA.far;
    cam.updateProjectionMatrix();
    this.water = game.waterMat || null;
    // built now, added to the scene (and compiled) once the title is up: lateInit
    this.gulls = buildGulls(game.world);
    this.shafts = buildShafts(game.world);
    game.atmoShafts = this.shafts;                  // ambient.js drifts dust motes in them
    this.applyCaps(true);
    const a = game.world.arenas && game.world.arenas.peaks;
    if (a && game.sky.sprites) game.sky.sprites.u.uPeaksAz.value = Math.atan2(a.x, a.z);
    // wading ripples: one ring per step in water (EV.STEP surface 'water'); recorded at render time (game.time)
    game.events.on(EV.STEP, (e) => { if (e && e.surface === 'water') this.ripple(game.player.pos.x, game.player.pos.z, 1); });
    game.events.on(EV.LAND, () => { const p = game.player; if (p.wading) this.ripple(p.pos.x, p.pos.z, 1.4); });
    game.registerDebug('atmo', {
      info: () => this.info(),
      fogCap: (obj, cap) => fogCap(obj, cap),
      caps: () => this.capList.map((c) => c.slice()),
      applyCaps: () => this.applyCaps(true),
      ripple: (x, z, k = 1) => this.ripple(x, z, k),
      snapFog: () => { this.fog.snap = true; },
      features: (patch) => this.features(patch),
    });
    this.features({});
    game.settings.on('quality', () => this.features({}));
  },
  onTitle() {
    if (this.titleAt == null) this.titleAt = performance.now();   // boot title (acceptance: HD within 5 s)
    if (!this.lateDone) setTimeout(() => this.lateInit(), 80);      // after the title has painted
  },
  /** what WP8 keeps out of the boot-to-title time (arch §15.2 WP8 accept 4): the sky textures' upload, the gull and
   *  light-shaft programs. Runs once, during the title (or before the first play frame at the latest) */
  lateInit() {
    if (this.lateDone) return;
    this.lateDone = true;
    const g = this.game, add = [this.gulls, this.shafts].filter(Boolean);
    g.sky.upload(g.renderer);
    for (const o of add) g.scene.add(o);
    // compiled for both point-light sets (three keys a program by the light count, and the lamps are still on at dawn
    // while the gulls fly): the night set, then the day set; the lights' own visibility is put back
    const L = [];
    g.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight) && !o.userData.alwaysOn) L.push([o, o.visible]); });
    try {
      for (const on of [true, false]) {
        for (const [l] of L) l.visible = on;
        for (const o of add) { try { g.renderer.compile(o, g.camera, g.scene); } catch (e) { /* compiled on first draw */ } }
      }
    } finally { for (const [l, v] of L) l.visible = v; }
  },
  onSession() {
    this.fog.snap = true;
    this.applyCaps(true);
    const W = this.game.world, u = this.game.terrain && this.game.terrain.material && this.game.terrain.material.userData.uniforms;
    if (u && W.plaza) u.uPlaza.value.set(W.plaza.x, W.plaza.z, W.plaza.r, u.uPlaza.value.w);   // WP9 may move / grow the plaza
  },
  /** fog caps. By position (shared atmoCap uniforms, every fogged material inside the cylinder): the Great Tree
   *  (W.greatTree; TUNE.atmo.capTree) and each of W.landmarks (C6; capLandmark), WP9's fields when present, today's
   *  otherwise. tags = also give every Object3D tagged userData.fogCap its per-material define (a scene traversal:
   *  attach / session only). → the cylinders [x, z, r, y0, cap] */
  applyCaps(tags = false) {
    const g = this.game, W = g.world, T = W.greatTree, gt = g.scenery && g.scenery.greatTree, out = [];
    if (T && Number.isFinite(T.x) && Number.isFinite(T.z)) {
      const H = T.height || T.scaleHeight || (gt && gt.height) || 14, y = Number.isFinite(T.y) ? T.y : W.hAt(T.x, T.z);
      out.push([T.x, T.z, Math.max(TA.capTreeR, H * 0.55), y + TA.capY0, TA.capTree]);
    }
    for (const L of Array.isArray(W.landmarks) ? W.landmarks : []) {
      if (!L || !Number.isFinite(L.x) || !Number.isFinite(L.z) || out.length >= 8) continue;
      if (T && Math.hypot(L.x - T.x, L.z - T.z) < 4) continue;          // the Great Tree is listed there too (C6)
      const H = Number.isFinite(L.height) ? L.height : 12, r = L.r || L.radius || clamp(H * 0.45, 3, 9);
      out.push([L.x, L.z, r, (Number.isFinite(L.y) ? L.y : W.hAt(L.x, L.z)) + TA.capY0, Number.isFinite(L.fogCap) ? L.fogCap : TA.capLandmark]);
    }
    const e = [ATMO.CA.elements, ATMO.CB.elements];
    ATMO.B.elements[7] = out.length ? Math.min(...out.slice(0, 8).map((c) => clamp(c[4], 0, 0.999))) : 0;   // the fog chunk skips the caps below it
    for (let i = 0; i < 8; i++) {
      const c = this.feat.caps ? out[i] : null, m = e[i >> 2], o = (i & 3) * 4;
      if (!c) { m[o] = m[o + 1] = m[o + 2] = m[o + 3] = 0; continue; }
      m[o] = c[0]; m[o + 1] = c[1]; m[o + 2] = Math.max(1, Math.round(c[2])) + clamp(c[4], 0, 0.999); m[o + 3] = c[3];
    }
    this.capList = out;
    this._lm = W.landmarks; this._lmN = Array.isArray(W.landmarks) ? W.landmarks.length : -1; this._gt = T; this._gtH = T && (T.height || T.scaleHeight);
    if (tags) g.scene.traverse((o) => {
      if (o.userData && typeof o.userData.fogCap === 'number' && !o.userData.fogCapDone) { this.capped = (this.capped || 0) + fogCap(o, o.userData.fogCap, g.scene); o.userData.fogCapDone = true; }
    });
    return out;
  },
  /** switch the package's features on / off at runtime (GPU attribution, before / after captures); → the state.
   *  fogAtmo (dome-coloured fog + caps), caps, shadowAhead (false = the foundation's E 22 box around Pip), terrainDetail,
   *  terrainCliff, terrainSide, terrainGrain (r3), terrainPlaza, sprites (sun / moon / clouds / isles), water, gulls, shafts. Quality low and phones
   *  (Assets.lowRes) never get the near detail or the cliff layer (re-applied when the quality setting changes) */
  features(patch = {}) {
    const g = this.game, sky = g.sky, F = this.feat;
    for (const k in patch) if (k in F) F[k] = !!patch[k];
    sky.atmoOn = F.fogAtmo;
    const E = F.shadowAhead ? TA.shadowE : 22;
    sky.shadowAhead = F.shadowAhead ? TA.shadowAhead : 0;
    if (sky.shadowExtent !== E) { sky.shadowExtent = E; sky.setShadowQuality(g.settings.get('quality')); }
    const u = g.terrain && g.terrain.material && g.terrain.material.userData.uniforms;
    if (u) {
      const low = Assets.lowRes || g.settings.get('quality') === 'low';
      u.uDetail.value.z = F.terrainDetail && !low ? TA.detailAmt : 0;
      const cliff = F.terrainCliff && !low;
      u.uCliff.value.x = cliff ? TA.cliffNy[1] : -3; u.uCliff.value.y = cliff ? TA.cliffNy[0] : -2;
      // rock / snow side-projected on steep faces (r2; off on low / phones with the cliff layer: up to 3 fetches a layer)
      if (u.uSide) { const side = F.terrainSide && !low; u.uSide.value.x = side ? TA.sideNy[0] : -1; u.uSide.value.y = side ? TA.sideNy[1] : -2; }
      if (u.uGrain) u.uGrain.value.z = F.terrainGrain && !low ? TA.grain.amt : 0;   // r3 near-ground grain (off on low / phones)
      if (!F.terrainPlaza && u.uPlaza.value.w > 0.5) { this._plazaW = 1; u.uPlaza.value.w = 0; }
      else if (F.terrainPlaza && this._plazaW) { u.uPlaza.value.w = 1; this._plazaW = 0; }
    }
    if (sky.sprites) sky.sprites.mesh.visible = F.sprites;
    const wm = g.scene.getObjectByName('water');
    if (wm) wm.visible = F.water;
    if (!F.caps) { ATMO.CA.elements.fill(0); ATMO.CB.elements.fill(0); } else this.applyCaps();
    return Object.assign({}, F);
  },
  ripple(x, z, k = 1) {
    if (!this.water) return;
    const R = this.water.uniforms.uRip.value, r = R[this.ripI++ % R.length];
    r.set(x, z, this.game.time, k);
  },
  /** fog targets: region table × dusk / night factors; boss fights close in (art §5.4) */
  fogTarget(out) {
    // the region under the camera itself (game.curRegion lags 0.75 s for the banner; a teleport snap must use the new one)
    const g = this.game, sky = g.sky, cp = g.camera.position, R = REGIONS[g.world.regionAt(cp.x, cp.z)] || REGIONS[g.curRegion], id = R ? R.id : 'village';
    const F = TA.fog[id] || TA.fog.village;
    let near = F[0], far = F[1], tk = F[3] || 0;
    out.tint.setHex(F[2] || 0xffffff);
    if (g.fight && g.fight.phase !== 'won' && TA.fog.arena) { near = TA.fog.arena[0]; far = TA.fog.arena[1]; tk = Math.min(0.6, tk * 1.5); }
    const n = sky.night, dusk = (1 - sky.sunK) * (1 - n);
    const k = lerp(1, TA.fogDusk, dusk) * lerp(1, TA.fogNight, n);
    out.near = near * k; out.far = Math.min(far * k, TA.far - 30);
    out.tint.lerp(sky.sun.color, dusk * 0.5);
    out.tintK = (tk + 0.18 * dusk) * (1 - 0.6 * n);
    out.woods = id === 'woods' ? 1 : 0;
    return out;
  },
  beforeCamera(alpha, dt) {
    const g = this.game, sky = g.sky, f = this.fog, T = this._t || (this._t = { tint: new THREE.Color() }), W = g.world;
    if (!this.lateDone) this.lateInit();
    if (W.landmarks !== this._lm || (Array.isArray(W.landmarks) ? W.landmarks.length : -1) !== this._lmN || W.greatTree !== this._gt || (W.greatTree && (W.greatTree.height || W.greatTree.scaleHeight)) !== this._gtH) this.applyCaps();
    this.fogTarget(T);
    // teleports / respawns snap (no 3 s of wrong fog after a jump across the island)
    const cp = g.camera.position;
    if (cp.distanceToSquared(this.lastCam) > 30 * 30) f.snap = true;
    this.lastCam.copy(cp);
    const k = f.snap ? 1 : 1 - Math.exp(-TA.fogBlend * Math.min(dt, 0.1));
    f.snap = false;
    f.near = lerp(f.near, T.near, k); f.far = lerp(f.far, T.far, k); f.tintK = lerp(f.tintK, T.tintK, k);
    f.tint.lerp(T.tint, k);
    f.woods = lerp(f.woods || 0, T.woods, k);
    sky.fogNear = f.near; sky.fogFar = f.far; sky.fogTint.copy(f.tint); sky.fogTintK = f.tintK;
  },
  afterCamera(alpha, dt) {
    const g = this.game, sky = g.sky, t = g.time;
    // shaded forest floor stays green, never muddy (art §7): lift the hemisphere's ground colour in the woods
    if (this.fog.woods > 0.001) sky.hemi.groundColor.multiplyScalar(1 + TA.woodsHemi * this.fog.woods);
    // water: lit body colour, sky reflection, sun / moon glint (game.js used to tint it here)
    const w = this.water;
    if (w) {
      const u = w.uniforms;
      u.uLight.value.copy(sky.waterLight);
      u.uSunCol.value.copy(sky.sun.color);
      u.uSunVis.value.copy(sky.sunVis);
      displayed(_c.copy(sky.sun.color).multiplyScalar(1.4), u.uSunGlint.value);
      u.uSunGlint.value.multiplyScalar(smoothstep(-0.02, 0.06, sky.sunVis.y) * (1 - sky.night));
      u.uMoonVis.value.copy(sky.moonVis);
      u.uMoonGlint.value.setRGB(0.62, 0.71, 1.0).multiplyScalar(0.8 * smoothstep(-0.02, 0.06, sky.moonVis.y) * sky.night);
      // standing still in water: a slow ring now and then
      const p = g.player;
      if (p && p.wading && g.playing) { this.idleRip -= dt; if (this.idleRip <= 0) { this.idleRip = 1.3; this.ripple(p.pos.x, p.pos.z, 0.6); } }
    }
    if (this.gulls) { updateGulls(this.gulls, t, sky.night); if (!this.feat.gulls) this.gulls.visible = false; }
    if (this.shafts) {
      const u = this.shafts.material.uniforms, h = g.S ? g.S.tod * 24 : 12;
      // only while the sun shines along the baked beams: strongest in the morning (7–11 h), gone by early afternoon and
      // at night (art §4.5)
      const day = smoothstep(5.5, 7.5, h) * (1 - smoothstep(17.0, 18.6, h)) * (1 - sky.night);
      const along = smoothstep(0.86, 0.97, sky.sunDir.dot(this.shafts.userData.axis));
      u.uK.value = TA.shaftK * day * along;
      this.shafts.visible = u.uK.value > 0.002 && this.feat.shafts;
    }
  },
  info() {
    const g = this.game, sky = g.sky, sh = sky.sun.shadow, S = sky.sprites, T = g.terrain && g.terrain.material && g.terrain.material.userData.uniforms;
    const terr = {};
    if (T) for (const k of ['tGrass', 'tForest', 'tMeadow', 'tSand', 'tSnow', 'tDirt', 'tRock', 'tCliff', 'tCobble']) { const x = T[k].value; terr[k] = x ? (x.userData.key || (x.userData.fallback ? 'fallback' : 'base')) + (x.userData.lo ? ' (lo)' : '') : null; }
    return {
      far: g.camera.far, fog: { near: +this.fog.near.toFixed(1), far: +this.fog.far.toFixed(1), tintK: +this.fog.tintK.toFixed(3) },
      night: +sky.night.toFixed(3), sunVis: sky.sunVis.toArray().map((x) => +x.toFixed(3)), sunDir: sky.sunDir.toArray().map((x) => +x.toFixed(3)),
      shadow: { E: sky.shadowExtent, ahead: sky.shadowAhead, map: sh.mapSize.x, near: sh.camera.near, far: sh.camera.far, center: sky.shadowCenter.toArray().map((x) => +x.toFixed(2)) },
      uploaded: sky.uploaded, atlas: S.atlas.size, moonVis: sky.moonVis.toArray().map((x) => +x.toFixed(3)), feat: Object.assign({}, this.feat),
      sprites: { total: S.list.length, clouds: S.count(2), cirrus: S.count(3), isles: S.count(4), skyIsle: S.count(5), art: Object.entries(S.atlas.cells).filter(([, c]) => c && c.art).map(([k]) => k) },
      terrain: terr, plaza: T ? T.uPlaza.value.toArray() : null, aniso: Assets.maxAniso, capped: this.capped,
      atmoOn: ATMO.A.elements[3], caps: this.capList ? this.capList.length : 0, gulls: this.gulls ? this.gulls.visible : false, shafts: this.shafts ? this.shafts.userData.spots.length : 0,
    };
  },
};
export default mod;
