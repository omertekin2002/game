// Module wp7-perf: rendering core + performance (arch §9.2, RULINGS perf budget).
// - afterCamera: the view's XZ cone (sampled frustum edges + margin) and the sun's light-space box → Scenery.cull (instanced
//   props: distance classes, tree LOD, shadow-only casters), the generic object culler (C10 userData.cull), night-only
//   point lights (two light sets, both compiled at boot), the near-field grass tiles (perf/grass.js)
// - resolution: DPR cap per quality (auto 1.5, low 1.0, high 2.0) for the canvas; dynamic resolution 0.70–1.0 scales
//   only the main pass, which is drawn into the lower-left part of the canvas and stretched over it (copy + one quad), so
//   a step re-allocates nothing and costs nothing (arch §9.2-7 steps: ±0.05, ≥ 0.5 s apart); driven by a GPU timer around
//   the main pass (rAF time without the extension); held at 1.0 while G.debug.perf samples, under the manual clock or
//   with settings.dynRes off
// - quality: low = DPR 1.0, no near grass, 1024² shadow map (lo textures: assets.js); auto / high = 2048²
// - G.debug.perf.* helpers (perf() itself stays the foundation's sampler)
import * as THREE from 'three';
import { G } from '../core.js';
import { perf as TP } from '../tune.js';
import { setBufferSize, U } from '../toon.js';
import { LAYER_SHADOW } from '../scatter.js';
import { GpuTimer } from '../debug/gpu-timer.js';
import { NearGrass } from './grass.js';

const D2R = Math.PI / 180;
const WARM_LAYER = 30;   // the boot warm-up's shadow-depth casters (warmDepth): seen by the sun's shadow camera only, only then
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** C10: a tracked object's `visible` becomes "the owner's value and not culled" (the culler only flips e.hid) */
function ownVisible(o, e) {
  let own = o.visible;
  Object.defineProperty(o, 'visible', { configurable: true, enumerable: true, get() { return own && !e.hid; }, set(v) { own = !!v; } });
}
/** the culler lets go of an object: not hidden, its own scale back */
function release(o) {
  const e = o.userData._wp7;
  if (!e) return;
  e.hid = false;
  if (e.base) { o.scale.copy(e.base); e.base = null; e.set = null; }
  e.k = 1;
}
const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Quaternion(), _b = new THREE.Box3(), _sz = new THREE.Vector2();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _w = new THREE.Vector3(), _vp = new THREE.Vector4();

/** base pixel ratio for a quality level (RULINGS: auto 1.5, low 1.0, high 2.0), before dynamic resolution */
export function dprFor(quality) {
  const cap = TP.dprCap[quality] ?? TP.dprCap.auto;
  return Math.min(window.devicePixelRatio || 1, cap);
}

const perf = {
  name: 'wp7-perf',
  game: null, dyn: 1, dynHold: false, pass: null, up: null, lightsOn: null, lightsForced: null, lights: [], objs: [], objHidden: 0, lastLightScan: -1e9, keep: [], warmed: 0,
  view: { x: 0, z: 0, fx: 0, fz: 1, cosH: -1, half: Math.PI, full: true, box: null },
  gt: null, frameN: 0, hiWins: 0, loWins: 0, lastDyn: -1e9, rafDts: [], timing: true, ctxLost: false, stats: { cullMs: 0, grassMs: 0, objMs: 0 },
  attach(game) {
    this.game = game;
    const sky = game.sky, S = game.settings;
    if (sky && sky.sun && sky.sun.shadow) sky.sun.shadow.camera.layers.enable(LAYER_SHADOW);
    game.camera.far = TP.far; game.camera.updateProjectionMatrix();
    try { this.grass = new NearGrass(game); } catch (e) { this.grass = null; if (G.debugOn) console.warn('[Starseed] near grass off', e); }
    this.scanLights(true);
    this.scanObjects();
    this.applyQuality(true);
    S.on('quality', () => this.applyQuality());
    S.on('dynRes', (on) => { if (!on) this.setDyn(1); });
    // GPU time of the main pass (dynamic resolution). TIME_ELAPSED queries cannot nest: skipped while G.debug.perf runs
    // its own timer (game.gpuT) and for any other scene (title, viewmodel pass). Below dyn 1 the main pass is drawn scaled
    const r = game.renderer, orig = r.render.bind(r);
    this.gt = new GpuTimer(r.getContext());
    // r4: a lost / restored context — the timer heals itself (gpu-timer.js); dynamic resolution starts over at full size
    // (it held whatever scale it had for the rest of the session: no sample ever arrived again)
    r.domElement.addEventListener('webglcontextlost', () => this.contextLost());
    r.domElement.addEventListener('webglcontextrestored', () => this.contextRestored());
    this.up = this.makeUpscaler();
    r.render = (scene, camera) => {
      const main = scene === game.scene && r.getRenderTarget() === null;
      const on = main && this.timing && this.gt.ok && !game.gpuT && !this.gt.open && (this.frameN++ & 1) === 0;
      if (on) this.gt.begin('f');
      if (main && this.dyn < 1) this.renderScaled(orig, scene, camera); else { orig(scene, camera); if (main) this.pass = null; }
      if (on) this.gt.end('f');
    };
    // shadow-depth programs: three copies every caster's map onto its shared depth material, also without an alpha test
    // (where the depth shader never reads it), and re-picks that material's program only when the instancing flags flip
    // between two casters, so the variant a frame needed depended on the draw order (Pip's body after an instanced layer
    // compiled a "depth + map" program at the first hilltop view). Without an alpha test a depth material now carries no
    // map: the variants are instancing × instance colour × side, all drawn by the boot warm-up (warmDepth)
    const rbd = r.renderBufferDirect;
    r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if ((material.isMeshDepthMaterial || material.isMeshDistanceMaterial) && (material.map || material.alphaMap) && !(material.alphaTest > 0) && !material.alphaHash) { material.map = null; material.alphaMap = null; }
      return rbd.apply(this, arguments);
    };
    this.onResize();
    game.registerDebug('perf', this.debugApi());
  },
  onResize() { const r = this.game.renderer; r.getDrawingBufferSize(_sz); setBufferSize(_sz.x, _sz.y); },
  contextLost() { this.ctxLost = true; },
  contextRestored() {
    this.ctxLost = false; this.setDyn(1); this.pass = null;
    this.hiWins = this.loWins = 0; this.lastDyn = -1e9; this.rafDts.length = 0;
    if (this.gt) this.gt.samples.f = [];
    this.onResize();
  },
  onTitle() { if (this.grass) this.grass.clear(); },

  // ------------------------------------------------------------------ per frame (render side, after the view)
  afterCamera(alpha, dt) {
    const game = this.game, cam = game.camera;
    const t0 = performance.now();
    // r3 canopy cutaway (toon.js CUTAWAY): on as the render camera leaves the FP eye (TP, the V blend, shots), off at the eye
    const ve = game.view && game.view.eye;
    U.uCutK.value = ve ? smooth(TP.cutaway.on[0], TP.cutaway.on[1], cam.position.distanceTo(ve)) : 0;
    // r4: the view's forward in the ground plane and Pip's depth along it (TP ≈ the arm; a shot: wherever he stands, at
    // least depthMin): trees at or past it keep their crowns. Looking straight down: no depth limit
    if (U.uCutK.value > 0) {
      cam.getWorldDirection(_d);
      const fl = Math.hypot(_d.x, _d.z), P = game.player && game.player.root.position, F = U.uCutFwd.value;
      if (fl < 0.05 || !P) F.set(0, 1, 1e3);
      else { const fx = _d.x / fl, fz = _d.z / fl; F.set(fx, fz, Math.max(TP.cutaway.depthMin, (P.x - cam.position.x) * fx + (P.z - cam.position.z) * fz)); }
    }
    this.computeView(cam);
    if (game.scenery && game.scenery.cull) game.scenery.cull(this.view);
    const t1 = performance.now();
    this.stats.cullMs = t1 - t0;
    this.updateLights();
    this.cullObjects(cam);
    const t2 = performance.now();
    this.stats.objMs = t2 - t1;
    if (this.grass && this.grassOn) this.grass.update(cam, dt);
    this.stats.grassMs = performance.now() - t2;
  },
  /** the sword cuts near grass cards in its hit window (the same 3D swing volume as the cuttables; not while talking) */
  afterStep(dt) {
    const g = this.game, pl = g.player;
    if (this.grass && this.grassOn && pl && pl.attackActive && !g.ui.dlg && g.swingState) this.grass.cut(g, g.swingState(dt, this._sw || (this._sw = {})));
  },
  afterRender(renderer, dt) {
    if (!this.game.gpuT && (this.frameN & 3) === 0) this.gt.poll();
    this.dynamicRes(dt);
  },

  /** XZ cone of everything the camera can see: frustum edge samples (rays steeper than 40° down hit the ground within
   *  nearAll and are skipped), widened by coneMargin; `full` when a kept ray points sideways/back or up through the zenith */
  computeView(cam) {
    const v = this.view, tv = Math.tan((cam.fov * D2R) / 2), th = tv * cam.aspect;
    cam.getWorldDirection(_d);
    const fl = Math.hypot(_d.x, _d.z);
    v.x = cam.position.x; v.z = cam.position.z;
    let full = fl < 1e-3, maxA = 0;
    if (!full) {
      v.fx = _d.x / fl; v.fz = _d.z / fl;
      _q.copy(cam.quaternion);
      for (let e = 0; e < 4 && !full; e++) {
        for (let i = 0; i <= 4; i++) {
          const t = -1 + (i / 4) * 2;
          const sx = e === 0 ? -1 : e === 1 ? 1 : t, sy = e === 2 ? -1 : e === 3 ? 1 : t;
          _r.set(sx * th, sy * tv, -1).applyQuaternion(_q);
          const l = _r.length(), h = Math.hypot(_r.x, _r.z);
          if (_r.y < -0.643 * l) continue;                 // > 40° down: lands within a few metres (nearAll covers it)
          if (h < 0.05 * l) { full = true; break; }        // straight up
          const c = (_r.x * v.fx + _r.z * v.fz) / h;
          if (c <= 0.05) { full = true; break; }
          maxA = Math.max(maxA, Math.acos(Math.min(1, c)));
        }
      }
    }
    const half = maxA + TP.coneMargin * D2R;
    v.full = full || half >= Math.PI * 0.98;
    v.half = maxA; v.cosH = v.full ? -1 : Math.cos(half);
    v.box = this.lightBox(v.box);
    return v;
  },
  /** the sun's orthographic shadow box in light space (camera at sun.position looking at sun.target, up +Y) */
  lightBox(out) {
    const sun = this.game.sky && this.game.sky.sun;
    if (!sun || !sun.castShadow || !sun.target) return null;
    const c = sun.shadow.camera, T = sun.target.position, P = sun.position;
    _z.subVectors(P, T); if (_z.lengthSq() < 1e-6) return null; _z.normalize();
    _x.set(0, 1, 0).cross(_z); if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0); _x.normalize();
    _y.crossVectors(_z, _x);
    const o = out || {};
    o.tx = T.x; o.ty = T.y; o.tz = T.z; o.ax = _x.x; o.ay = _x.y; o.az = _x.z; o.bx = _y.x; o.by = _y.y; o.bz = _y.z;
    o.E = Math.max(Math.abs(c.left), Math.abs(c.right), Math.abs(c.top), Math.abs(c.bottom));
    return o;
  },

  // ------------------------------------------------------------------ point lights only at night (arch §9.2-6)
  scanLights(force) {
    const now = performance.now();
    if (!force && now - this.lastLightScan < 2000) return;
    this.lastLightScan = now;
    const L = [];
    this.game.scene.traverse((o) => { if ((o.isPointLight || o.isSpotLight) && !o.userData.alwaysOn) L.push(o); });
    if (L.length !== this.lights.length && this.lightsOn !== null) for (const l of L) l.visible = this.lightsOn;
    this.lights = L;
  },
  updateLights() {
    this.scanLights(false);
    if (this.lightsForced !== null) { if (this.lightsOn !== this.lightsForced) this.setLights(this.lightsForced); return; }   // G.debug.perf.lights(on)
    const n = this.game.sky ? this.game.sky.night || 0 : 0;
    const on = this.lightsOn ? n > 0.012 : n >= 0.02;
    if (on === this.lightsOn) return;
    this.lightsOn = on;
    for (const l of this.lights) l.visible = on;
  },
  setLights(on) { this.lightsOn = on; for (const l of this.lights) l.visible = on; },

  // ------------------------------------------------------------------ generic object culler (C10)
  /** every Object3D in the scene (any depth) that carries userData.cull = { dist, fade } (dist: Infinity = never), plus the
   *  direct children of scenery.root without it, classified by bounding radius (TUNE.perf.objCull). Instanced meshes manage
   *  themselves (scatter layers, near grass) unless they carry userData.cull. Re-scanned every objScanEvery s */
  scanObjects() {
    const game = this.game, root = game.scenery && game.scenery.root, list = [];
    const add = (o, auto) => {
      const c = o.userData.cull;
      if (!c && (!auto || o.isInstancedMesh || o.isLight || o.isCamera)) return;
      let e = o.userData._wp7;
      if (!e) {
        o.updateWorldMatrix(true, true);
        _b.setFromObject(o);                       // instance-aware for instanced meshes
        const r = _b.isEmpty() ? 0 : _b.getSize(_w).length() / 2, m = o.matrixWorld.elements;
        // spread out (r2): bounds reaching farther than objSpread from the origin (WP9 puts every lamp / edge stone / sign
        // board of the island in one instanced or merged mesh with its origin at the island centre). Measured by its
        // nearest point and only hidden: by the origin, all of them shrank toward the centre and vanished 60–120 m out,
        // also the ones beside Pip
        let spread = null;
        if (!_b.isEmpty()) { _b.getCenter(_w); const dx = _w.x - m[12], dz = _w.z - m[14]; if (r > TP.objSpread || Math.hypot(dx, dz) > TP.objSpread) spread = { dx, dz, r }; }
        e = o.userData._wp7 = { r, spread, hid: false, k: 1, base: null, set: null };
        ownVisible(o, e);
      }
      let dist = c && c.dist != null ? +c.dist : Infinity;
      if (!c) for (const [rr, d] of TP.objCull) if (e.r <= rr) { dist = d; break; }
      e.dist = dist;
      // the scale fade only where the owner asked for it (userData.cull.fade > 0): an auto-classified object (a chest) is
      // only hidden, beyond dist + 3 m, so nothing that measures it (bounding boxes, tests) ever sees a shrunken copy
      e.fade = c && c.fade > 0 && !e.spread ? +c.fade : 0;
      if (dist !== Infinity || e.hid || e.k < 1) list.push(o);
    };
    if (root) for (const o of root.children) add(o, true);
    game.scene.traverse((o) => { if (o !== game.scene && o.parent !== root && o.userData.cull) add(o, false); });
    // an object that left the scene (or the culler) while culled gets its own visibility and scale back
    for (const o of this.objs) if (!list.includes(o)) release(o);
    this.objs = list;
    this._objScan = performance.now();
  },
  /** per frame: hide what is beyond its dist (+ 3 m without a fade); shrink what is inside its fade band (scale × k, the
   *  owner's own scale kept: a scale the owner changes meanwhile becomes the new base). Hiding never writes the owner's
   *  `visible`: a tracked object's visible reads "owner's value and not culled", so an owner that hides an object while
   *  it is culled keeps it hidden */
  cullObjects(cam) {
    if (performance.now() - (this._objScan || 0) > TP.objScanEvery * 1000) this.scanObjects();
    const off = this.game.scenery && this.game.scenery.cullOff, cx = cam.position.x, cz = cam.position.z;
    let hidden = 0;
    for (const o of this.objs) {
      const e = o.userData._wp7;
      if (!e) continue;
      const m = o.matrixWorld.elements, sp = e.spread;
      const d = sp ? Math.max(0, Math.hypot(m[12] + sp.dx - cx, m[14] + sp.dz - cz) - sp.r) : Math.hypot(m[12] - cx, m[14] - cz);
      const k = off || e.dist === Infinity ? 1 : e.fade > 0 ? 1 - smooth(e.dist - e.fade, e.dist, d) : d > e.dist ? 0 : 1;
      if (k <= 0.01) { if (!e.hid && d > e.dist + (e.fade > 0 ? 0 : 3)) e.hid = true; }
      else if (e.hid) e.hid = false;
      if (e.fade > 0 && (k < 1 || e.k < 1)) {
        if (e.set && !o.scale.equals(e.set)) e.base = null;          // the owner changed the scale: that is the new base
        if (!e.base) e.base = o.scale.clone();
        if (k >= 1) { o.scale.copy(e.base); e.base = null; e.set = null; }
        else { o.scale.copy(e.base).multiplyScalar(Math.max(k, 1e-3)); (e.set || (e.set = new THREE.Vector3())).copy(o.scale); }
      }
      e.k = k;
      if (e.hid) hidden++;
    }
    this.objHidden = hidden;
  },

  // ------------------------------------------------------------------ resolution
  applyQuality(first = false) {
    const q = this.game.settings.get('quality'), sky = this.game.sky;
    this.grassOn = q !== 'low';
    if (this.grass) this.grass.setEnabled(this.grassOn);
    const sz = q === 'low' ? TP.shadowLow : TP.shadowHigh, sh = sky && sky.sun && sky.sun.shadow;
    if (sh && sh.mapSize.x !== sz) { sh.mapSize.set(sz, sz); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    if (!first) this.applyDpr();
  },
  /** dynamic resolution scale of the main pass (no canvas work: the next main pass is drawn at that size) */
  setDyn(k) { this.dyn = Math.min(1, Math.max(TP.dynMin, Math.round(k * 100) / 100)); return this.dyn; },
  /** the canvas pixel ratio: the quality's cap (a settings change re-allocates the canvas once; dynamic resolution never does) */
  applyDpr() {
    const game = this.game, r = game.renderer, pr = dprFor(game.settings.get('quality'));
    if (Math.abs(r.getPixelRatio() - pr) < 1e-3) return;
    const w = window.innerWidth, h = window.innerHeight;
    r.setPixelRatio(pr); r.setSize(w, h);
    game.view.onResize(w, h);
    game.onResize(w, h);
  },
  /** the quad that stretches the scaled main pass over the canvas (its program is compiled by the boot warm-up) */
  makeUpscaler() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMain: { value: null } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec2 vU; void main() { vU = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      // the copy already holds tone-mapped sRGB output: written back as is
      fragmentShader: 'uniform sampler2D tMain; varying vec2 vU; void main() { gl_FragColor = texture2D(tMain, vU); }',
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { mat, scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), tex: null };
  },
  /** main pass at dyn < 1: drawn into the lower-left w × h of the canvas (outline px, particle sizes and the occluder
   *  circle follow that size), copied into a texture and stretched over the whole canvas (bilinear); later passes
   *  (viewmodel, item-get) draw at full size on top */
  renderScaled(orig, scene, camera) {
    const r = this.game.renderer, up = this.up, pr = r.getPixelRatio();
    r.getDrawingBufferSize(_sz);
    const W = _sz.x, H = _sz.y, w = Math.max(1, Math.round(W * this.dyn)), h = Math.max(1, Math.round(H * this.dyn));
    if (!up.tex || up.tex.image.width !== w || up.tex.image.height !== h) {
      if (up.tex) up.tex.dispose();
      up.tex = new THREE.FramebufferTexture(w, h);
      up.tex.minFilter = up.tex.magFilter = THREE.LinearFilter;
      up.tex.generateMipmaps = false;
      up.mat.uniforms.tMain.value = up.tex;
    }
    const vp = r.getViewport(_vp), oc = U.uOccC.value, ox = oc.x, oy = oc.y, oR = U.uOccR.value;
    setBufferSize(w, h, h / H);
    oc.set(ox * (w / W), oy * (h / H)); U.uOccR.value = oR * (h / H);
    r.setViewport(0, 0, w / pr, h / pr);
    try {
      orig(scene, camera);
      r.copyFramebufferToTexture(up.tex);
    } finally {
      r.setViewport(vp); setBufferSize(W, H); oc.set(ox, oy); U.uOccR.value = oR;
    }
    const ac = r.autoClear;
    r.autoClear = false;
    try { orig(up.scene, up.cam); } finally { r.autoClear = ac; }
    this.pass = [w, h];
  },
  dynamicRes(dt) {
    const game = this.game, S0 = game.settings.get('dynRes') !== false, now = performance.now();
    const on = S0 && !this.dynHold && !this.ctxLost && !game.gpuT && !game.clock.manual && game.state === 'play' && game.playing;
    if (!on) {
      this.gt.samples.f = []; this.rafDts.length = 0; this.hiWins = this.loWins = 0;
      if (!this.dynHold && this.dyn !== 1 && (game.gpuT || !S0 || game.clock.manual)) this.setDyn(1);   // measurements and tests run at full res
      return;
    }
    const S = this.gt.ok ? (this.gt.samples.f || (this.gt.samples.f = [])) : this.rafDts;
    if (!this.gt.ok && dt > 0) this.rafDts.push(dt * 1000);
    if (S.length < TP.dynEvery) return;
    const s = S.slice().sort((a, b) => a - b), p75 = s[Math.floor(s.length * 0.75)];
    S.length = 0;
    const hi = this.gt.ok ? TP.dynHi : 1000 / 55, lo = this.gt.ok ? TP.dynLo : 1000 / 62;
    this.hiWins = p75 > hi ? (this.hiWins || 0) + 1 : 0;
    this.loWins = p75 < lo ? (this.loWins || 0) + 1 : 0;
    if (now - this.lastDyn < TP.dynGap * 1000) return;
    // one step per decision (a step is free: nothing waits for a calm moment, nothing stacks)
    if (this.hiWins >= TP.dynHiWins && this.dyn > TP.dynMin) { this.hiWins = 0; this.lastDyn = now; this.setDyn(this.dyn - TP.dynStep); }
    else if (this.loWins >= TP.dynLoWins && this.dyn < 1) { this.loWins = 0; this.lastDyn = now; this.setDyn(this.dyn + TP.dynStep); }
  },

  // ------------------------------------------------------------------ boot warm-up (main.js renderer setup)
  /** compile every program the first minutes can need and upload every buffer / texture: each mesh is drawn once per
   *  point-light set (day / night) with frustum culling off and every layer on (tree proxies + hulls, near grass, shadow-only
   *  casters, objects behind the boot camera, bosses in their arenas), so the shadow-depth variants of every caster exist
   *  too, plus the dynamic-resolution quad. KHR_parallel_shader_compile is unsupported here: a program compiled later is a
   *  synchronous hitch. Instanced meshes draw one instance and the main view a 16 px corner (programs and uploads do not
   *  depend on either), so the GPU is not left chewing on four full-island frames when the title comes up.
   *  `between(lightsOn)` (async, optional) runs after each light set: main.js moves the loading bar there */
  async warmup(renderer, scene, camera, between = null) {
    const game = this.game;
    this.computeView(camera);
    if (game.scenery && game.scenery.cull) game.scenery.cull(this.view, true);
    if (this.grass) this.grass.update(camera, 0, true);
    this.scanLights(true);
    const counts = new Map(), forced = [], culled = [];
    scene.traverse((o) => {
      if ((o.isInstancedMesh || o.userData.grass) && !o.visible) { forced.push(o); o.visible = true; }
      if (o.isInstancedMesh) { counts.set(o, o.count); o.count = 1; }
      else if (o.geometry && o.geometry.isInstancedBufferGeometry) { counts.set(o, o.geometry.instanceCount); o.geometry.instanceCount = 1; }
      if ((o.isMesh || o.isPoints || o.isLine) && o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
    });
    const mask = camera.layers.mask, vp = renderer.getViewport(new THREE.Vector4()), pr = renderer.getPixelRatio();
    camera.layers.enableAll();
    camera.layers.disable(WARM_LAYER);
    renderer.setViewport(0, 0, 16 / pr, 16 / pr);
    const dw = this.warmDepth(), sc = game.sky && game.sky.sun && game.sky.sun.shadow ? game.sky.sun.shadow.camera : null;
    if (sc) sc.layers.enable(WARM_LAYER);
    try {
      for (const on of [true, false]) {
        this.setLights(on);
        try { renderer.compile(scene, camera); } catch (e) { /* first draw compiles */ }
        scene.add(dw.group);          // after compile(): only the shadow pass draws these (their own materials never compile)
        try { renderer.render(scene, camera); } finally { scene.remove(dw.group); }
        if (between) await between(on);
      }
      try { renderer.compile(this.up.scene, this.up.cam); } catch (e) { /* first scaled frame compiles */ }
    } finally {
      camera.layers.mask = mask;
      if (sc) sc.layers.disable(WARM_LAYER);
      dw.dispose();
      renderer.setViewport(vp);
      for (const o of forced) o.visible = false;
      for (const [o, c] of counts) { if (o.isInstancedMesh) o.count = c; else o.geometry.instanceCount = c; }
      for (const o of culled) o.frustumCulled = true;
    }
    this.lightsOn = null;
    this.updateLights();
    this.warmed = renderer.info.programs.length;
  },
  /** casters that make the shared shadow-depth material pick every program variant it can need in play: three re-picks
   *  it when instancing or the instance colour flips between two casters, taking the side of the caster at hand, so a
   *  run where each of those flips happens once per side (front / back / double) compiles all of them, whatever order
   *  the scene draws its casters in. Tiny, far below the island, on a layer only the sun's shadow camera sees during the
   *  warm-up → { group, dispose() } */
  warmDepth() {
    const group = new THREE.Group(), geo = new THREE.BoxGeometry(0.01, 0.01, 0.01), mats = {}, objs = [];
    group.name = 'wp7-depth-warm';
    const one = (side, inst, color) => {
      const m = mats[side] || (mats[side] = new THREE.MeshBasicMaterial({ side }));
      const o = inst ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m);
      if (inst) { o.setMatrixAt(0, new THREE.Matrix4()); if (color) o.setColorAt(0, new THREE.Color(1, 1, 1)); }
      o.castShadow = true; o.frustumCulled = false; o.layers.set(WARM_LAYER); o.position.set(0, -900, 0);
      group.add(o); objs.push(o);
    };
    one(THREE.FrontSide, true, false);
    for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) { one(side, false, false); one(side, true, true); one(side, true, false); }
    return {
      group,
      dispose() { for (const o of objs) if (o.isInstancedMesh) o.dispose(); geo.dispose(); for (const k in mats) mats[k].dispose(); },
    };
  },
  /** run the owners' own teardown of the boot warm-up objects (Enemy.remove, Boss.remove, GroundFX.remove …: whatever they
   *  add, they clean up) while Material.dispose is held, so the warmed programs stay alive: the materials they would have
   *  disposed are kept here (never drawn again). Without this, the first slime / telegraph of a session recompiles */
  keepPrograms(fn) {
    const proto = THREE.Material.prototype, dispose = proto.dispose, kept = [];
    proto.dispose = function () { kept.push(this); };
    try { fn(); } catch (e) { if (G.debugOn) console.warn('[Starseed] warm-up teardown', e); } finally { proto.dispose = dispose; }
    this.keep.push(...kept);
    return kept.length;
  },

  // ------------------------------------------------------------------ debug
  debugApi() {
    const self = this;
    return {
      /** state snapshot: dpr, dynamic scale, light set, cull / pack stats, object culler, grass */
      state() {
        const g = self.game, sc = g.scenery;
        return {
          dpr: g.renderer.getPixelRatio(), dyn: self.dyn, dynHold: self.dynHold, pass: self.pass, quality: g.settings.get('quality'), lights: self.lightsOn, lightsForced: self.lightsForced, nLights: self.lights.length,
          view: { full: self.view.full, half: +(self.view.half / D2R).toFixed(1), cone: self.view.full ? 360 : +((Math.acos(self.view.cosH) / D2R) * 2).toFixed(1), box: !!self.view.box },
          cullOff: !!(sc && sc.cullOff), scatter: sc && sc.stats ? sc.stats() : null,
          objs: { tracked: self.objs.length, hidden: self.objHidden },
          grass: self.grass ? self.grass.info() : null, ms: { cull: +self.stats.cullMs.toFixed(3), obj: +self.stats.objMs.toFixed(3), grass: +self.stats.grassMs.toFixed(3) },
          far: g.camera.far, timer: self.gt.ok,
        };
      },
      /** culling / LOD on (default) or off (everything packed, full models: the "base" for A/B screenshots) */
      cull(on = true) { self.game.scenery.setBase(!on); return on; },
      /** dynamic resolution scale of the main pass (0.70–1.0) by hand, held (also under the manual clock) until dyn(null),
       *  which hands it back to the controller */
      dyn(k = null) { if (k == null) { self.dynHold = false; self.lastDyn = -1e9; return self.dyn; } self.dynHold = true; return self.setDyn(k); },
      /** force the point-light set (true night set, false day set) until lights(null) = automatic again */
      lights(on = null) { if (on == null) { self.lightsForced = null; self.lightsOn = null; self.updateLights(); } else { self.lightsForced = !!on; self.setLights(!!on); } return self.lightsOn; },
      grass(on = true) { if (self.grass) self.grass.setEnabled(on && self.game.settings.get('quality') !== 'low'); self.grassOn = !!on; return on; },
      repack() { const sc = self.game.scenery; sc.dirty = true; return true; },
    };
  },
};
export default perf;
