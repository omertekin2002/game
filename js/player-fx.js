// Module wp3-player-fx (WP3): Pip's physical feedback and the parts of movement that need the game around them.
// - dust and splashes from the event bus: footsteps (EV.STEP; bigger puffs while sprinting), take-off (EV.JUMP),
//   landings sized by EV.LAND.impact (a ring of dust, a splash in water, a little snow spray), the roll (EV.DASH_START /
//   DASH_END and a puff trail while rolling)
// - legacy sounds (TUNE.move.legacySfx): the step / splash / swing / roll sounds the foundation played from player.js,
//   now driven by the same events (C8: WP5's event-driven audio replaces them; set legacySfx false when it lands)
// - the pad sprint toggle (L3, input action 'sprintToggle'), handed to the player through the intent hook
// - stuck recovery: when the player flags itself stuck (inside a collider or off the walkable area for > 0.5 s) the
//   screen fades out, Pip is warped to his last safe spot (view snapped) and it fades back in
// - footprints on sand and snow: a pair of boot prints per stride (and at a landing) lying on the terrain, lit like it,
//   one boot print per step (the sprite's left or right half, beside the foot's side of the path; the pair at a landing),
//   lying on the terrain and lit like it, fading out after TUNE.move.printLife s (sprite fx_footprint; a drawn pair of
//   ovals when it is missing). One instanced draw call, at most printMax prints
// - debug helpers: G.debug.phys.{ state, jumpTrace, near, warpSafe, prints }
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { Assets } from './assets.js';
import { EV } from './events.js';
import { move as TM } from './tune.js';
import { SHAPE } from './fx.js';
import { STEP } from './clock.js';
import { penetration } from './phys.js';

const TAU = Math.PI * 2;
let seed = 0x2f6e2b1;
/** cosmetic randomness: never the sim's (seeded) Math.random stream */
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let x = seed; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
/** a colour mixed toward white by k (dust reads lighter than the ground it comes from) */
const lighten = (c, k) => { const f = (s) => Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * k); return (f(16) << 16) | (f(8) << 8) | f(0); };

const fxm = {
  name: 'wp3-player-fx',
  toggle: false,          // pad L3 sprint latch
  warping: false,
  attach(game) {
    this.game = game;
    const ev = game.events;
    ev.on(EV.STEP, (e) => this.onStep(e));
    ev.on(EV.JUMP, () => this.onJump());
    ev.on(EV.LAND, (e) => this.onLand(e));
    ev.on(EV.DASH_START, () => this.onDash(true));
    ev.on(EV.DASH_END, () => this.onDash(false));
    ev.on(EV.SWING, () => { if (TM.legacySfx) sfx('swing'); });
    game.registerDebug('phys', debugApi(game));
  },
  onSession() { this.toggle = false; this.warping = false; this.clearPrints(); },
  onTitle() { this.toggle = false; },
  frameInput(input) { if (input.framePressed('sprintToggle')) this.toggle = !this.toggle; },   // (not from a menu press: input.modal)
  intent(it) { it.sprintToggle = this.toggle; },
  afterStep() {
    const game = this.game, pl = game.player;
    if (pl.sprintToggleOff) { pl.sprintToggleOff = false; this.toggle = false; }
    // the roll kicks up a trail
    if (pl.state === 'dash' && pl.grounded && rnd() < 0.6) this.puff(pl.pos.x, pl.pos.y, pl.pos.z, 1, this.dustCol(), 1);
    if (pl.stuck && !this.warping && !game.trans) this.warp();
    this.agePrints(STEP);
  },
  // ------------------------------------------------------------------ effects
  dustCol() { const g = this.game, pl = g.player; return pl.standOn && pl.standOn !== 'deck' ? (pl.standOn.kind === 'stump' ? 0xd8b088 : 0xd8d4c8) : g.dustColor(pl.pos); },
  /** soft dust puffs (k scales size and speed) */
  puff(x, y, z, n, color, k = 1, ring = false) {
    const fx = G.fx;
    if (!fx) return;
    for (let i = 0; i < n; i++) {
      const a = ring ? (i / n) * TAU + rr(-0.2, 0.2) : rr(0, TAU), s = rr(0.5, 1.4) * k;
      fx.norm.spawn({ x: x + Math.cos(a) * 0.2 * k, y: y + 0.06, z: z + Math.sin(a) * 0.2 * k, vx: Math.cos(a) * s, vy: rr(0.25, 0.8) * Math.min(1.4, k), vz: Math.sin(a) * s,
        drag: 4.5, life: rr(0.35, 0.6), size: rr(0.16, 0.26) * k, size1: rr(0.4, 0.6) * k, color, alpha: 0.7, shape: SHAPE.SOFT });
    }
  },
  splash(x, y, z, n) { if (G.fx) G.fx.splash(x, Math.max(0, y), z, n); },
  onStep(e) {
    const pl = this.game.player, p = pl.pos;
    if (e.surface === 'water') { this.splash(p.x, p.y, p.z, pl.sprint ? 6 : 4); if (TM.legacySfx && rnd() < 0.3) sfx('splash'); return; }
    if (PRINT_TINT[e.surface] != null) this.print(p.x, p.z, Math.atan2(pl.vel.x, pl.vel.y), e.surface, e.foot);
    this.puff(p.x, p.y, p.z, pl.sprint ? 2 : 1, this.dustCol(), pl.sprint ? 1.15 : 0.9);
    if (TM.legacySfx && rnd() < 0.5) sfx('step');
  },
  onJump() {
    const pl = this.game.player, p = pl.pos;
    if (pl.wading) this.splash(p.x, p.y, p.z, 8);
    else this.puff(p.x, p.y, p.z, pl.sprint ? 5 : 3, this.dustCol(), 0.8, true);
  },
  onLand(e) {
    const pl = this.game.player, p = pl.pos, imp = e.impact || 0;
    if (imp >= 2.5 && PRINT_TINT[e.surface] != null) this.print(p.x, p.z, pl.vel.lengthSq() > 0.5 ? Math.atan2(pl.vel.x, pl.vel.y) : pl.facing, e.surface, null);
    if (imp < 1.5) return;
    if (e.surface === 'water') { this.splash(p.x, p.y, p.z, Math.round(Math.min(16, 4 + imp * 1.2))); return; }
    const k = Math.min(1.5, 0.6 + imp / 12), n = Math.round(Math.min(10, 2 + imp * 0.8)), col = this.dustCol();
    this.puff(p.x, p.y, p.z, n, col, k, true);
    // a full jump or a fall: a low ring that rolls out ~1.2 m (carrying some of Pip's speed), so its front edge shows
    // at the bottom of the first-person view too
    if (imp >= 6 && G.fx) {
      const m = Math.round(Math.min(16, imp * 1.5)), vx = pl.vel.x * 0.45, vz = pl.vel.y * 0.45;
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU + rr(-0.15, 0.15), s = rr(2.4, 3.4) * Math.min(1.3, imp / 8);
        G.fx.norm.spawn({ x: p.x + Math.cos(a) * 0.55, y: p.y + 0.05, z: p.z + Math.sin(a) * 0.55, vx: Math.cos(a) * s + vx, vy: rr(0.1, 0.4), vz: Math.sin(a) * s + vz,
          drag: 3.2, life: rr(0.45, 0.6), size: rr(0.2, 0.28), size1: rr(0.5, 0.7), color: col, alpha: 0.6, shape: SHAPE.SOFT });
      }
    }
    if (e.surface === 'snow' && G.fx && imp > 5) G.fx.snowBurst(p.x, p.y, p.z, Math.round(imp), 0.35);
    const v = this.game.view;
    if (G.fx && v && v.mode === 'fp' && !v.bodyOut && imp >= TM.fpDustImpact) this.fpFan(pl, imp, e.surface, col);
  },
  /** first person: the feet are under the eye and the landing ring only shows its front edge, so a fan of puffs is
   *  placed by the view: each one on the ground where the eye's ray through a point in the lower fifth of the frame
   *  lands (any FOV, aspect and pitch; 0.7–4 m out), spread across the frame, carrying Pip's momentum so a running
   *  landing doesn't overtake it. A warmer, darker tint than the ring (soil kicked up reads against bright grass), a
   *  little more opaque from a full jump's impact (fpDustBig) */
  fpFan(pl, imp, surface, col) {
    const v = this.game.view, cam = v.camera, e = v.eye, fx = G.fx;
    const tv = Math.tan((((cam && cam.fov) || 67.4) * Math.PI) / 360), th = tv * ((cam && cam.aspect) || 16 / 9);
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch || 0), sp = Math.sin(v.pitch || 0);
    const m = Math.round(Math.min(14, 4 + imp)), k2 = Math.min(1.3, imp / 7), big = imp >= (TM.fpDustBig ?? 6);
    const tint = FP_TINT[surface] ?? lighten(col, 0.1), gy = pl.pos.y + 0.1;
    for (let i = 0; i < m; i++) {
      // a clumpy band: jittered across the frame, a near row at the very bottom edge and a far one above it
      const near = i % 3 === 0, xn = ((i + 0.5) / m - 0.5) * 1.6 + rr(-0.12, 0.12), yn = near ? rr(-1.02, -0.86) : rr(-0.86, -0.62);
      // the ray through (xn, yn): forward (sin yaw, cos yaw) pitched, right (−cos yaw, sin yaw), up
      const dx = cp * sy - cy * xn * th - sp * sy * yn * tv, dy = sp + cp * yn * tv, dz = cp * cy + sy * xn * th - sp * cy * yn * tv;
      const hl = Math.hypot(dx, dz) || 1, ux = dx / hl, uz = dz / hl;
      const dist = dy < -0.05 ? Math.min(4, Math.max(0.7, ((gy - e.y) / dy) * hl)) : 1.4, sz = (0.55 + dist * 0.3) * (near ? 1.3 : 1), s = rr(0.4, 0.8) * k2;
      fx.norm.spawn({ x: e.x + ux * dist, y: gy, z: e.z + uz * dist, vx: ux * s + pl.vel.x * 0.95, vy: rr(0.45, 0.85) * k2, vz: uz * s + pl.vel.y * 0.95,
        drag: 2.6, life: rr(0.5, 0.7), size: rr(0.18, 0.3) * sz, size1: rr(0.55, 0.85) * sz, color: tint, alpha: (big ? 0.88 : 0.76) * rr(0.85, 1), shape: SHAPE.SOFT });
    }
  },
  onDash(start) {
    const pl = this.game.player, p = pl.pos;
    if (start && TM.legacySfx) sfx('dash');
    if (!pl.grounded) return;
    if (pl.wading) { this.splash(p.x, p.y, p.z, start ? 6 : 4); return; }
    this.puff(p.x, p.y, p.z, start ? 5 : 4, this.dustCol(), 1);
  },
  // ------------------------------------------------------------------ footprints
  /** the instanced print mesh, built on first use (null when it can't be: no scene / WebGL features) */
  printMesh() {
    if (this.pm !== undefined) return this.pm;
    this.pm = null;
    const scene = this.game.scene;
    if (!scene) return null;
    try {
      const max = TM.printMax ?? 48, tex = Assets.tex('fx_footprint', { hd: false, wrap: 'clamp', make: drawPrintTex });
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);           // flat, the toes (texture top) toward local +z
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      fade.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFade', fade);
      geo.setAttribute('aSide', new THREE.InstancedBufferAttribute(new Float32Array(max), 1));   // 0 left / 1 right half, −1 both
      const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, opacity: TM.printAlpha ?? 0.6,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = 'attribute float aFade;\nattribute float aSide;\nvarying float vFade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nif (aSide > -0.5) vMapUv.x = vMapUv.x * 0.5 + aSide * 0.5;\n#endif');
        sh.fragmentShader = 'varying float vFade;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= vFade;');
      };
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.frustumCulled = false; m.renderOrder = 1; m.name = 'wp3-prints';
      m.userData.cull = { dist: Infinity };                       // C10: lives around Pip, never distance-culled
      const hide = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < max; i++) { m.setMatrixAt(i, hide); m.setColorAt(i, _col.set(0xffffff)); }
      scene.add(m);
      this.pm = m; this.pAge = new Float32Array(max).fill(1e9); this.pNext = 0;
    } catch (e) { this.pm = null; }
    return this.pm;
  },
  /** a boot print at (x, z) heading yaw (foot 'L' / 'R': that half of the sprite, beside the path on its side; null:
   *  the pair), lying on the terrain (tilted to its slope) */
  print(x, z, yaw, surface, foot) {
    const m = this.printMesh(), W = this.game.world;
    if (!m || !W) return;
    const i = this.pNext, sz = TM.printSize ?? 0.3, side = foot === 'L' ? -1 : foot === 'R' ? 1 : 0;
    x += -Math.cos(yaw) * side * sz * 0.22; z += Math.sin(yaw) * side * sz * 0.22;   // right of the heading = (−cos, sin)
    const e = 0.3, y = W.hAt(x, z);
    _n.set(W.hAt(x - e, z) - W.hAt(x + e, z), 2 * e, W.hAt(x, z - e) - W.hAt(x, z + e)).normalize();
    _q.setFromUnitVectors(_up, _n).multiply(_qy.setFromAxisAngle(_up, yaw));
    m.setMatrixAt(i, _m.compose(_p.set(x, y + 0.012, z), _q, _s.set(side ? sz * 0.5 : sz, 1, sz)));
    m.setColorAt(i, _col.set(PRINT_TINT[surface]));
    const S = m.geometry.attributes.aSide;
    S.array[i] = side < 0 ? 0 : side > 0 ? 1 : -1; S.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.pAge[i] = 0; this.pNext = (i + 1) % this.pAge.length;
  },
  /** fade the prints out over their last printFade s */
  agePrints(dt) {
    const m = this.pm;
    if (!m) return;
    const A = m.geometry.attributes.aFade, life = TM.printLife ?? 8, fd = TM.printFade ?? 2.5;
    let dirty = false;
    for (let i = 0; i < this.pAge.length; i++) {
      if (this.pAge[i] > life) { if (A.array[i] !== 0) { A.array[i] = 0; dirty = true; } continue; }
      this.pAge[i] += dt;
      const f = Math.min(1, this.pAge[i] / 0.08, (life - this.pAge[i]) / fd);
      A.array[i] = Math.max(0, f); dirty = true;
    }
    if (dirty) A.needsUpdate = true;
  },
  clearPrints() { if (this.pAge) { this.pAge.fill(1e9); this.agePrints(0); } },
  // ------------------------------------------------------------------ stuck recovery
  warp() {
    const game = this.game, pl = game.player;
    this.warping = true;
    const fade = TM.unstickFade ?? 0.15;
    const done = () => { this.warping = false; };
    const move = () => {
      pl.unstick();
      game.view.snap();
      game.clock.resetPhase();
      game.events.emit('unstick', { x: pl.pos.x, z: pl.pos.z });
    };
    if (fade > 0 && game.fadeOutIn) game.fadeOutIn(fade, move, done);
    else { move(); done(); }
  },
};
export default fxm;

// footprints: tint per surface (multiplies the sprite: darker sand, a cool shadow in snow); scratch objects
const PRINT_TINT = { sand: 0xd2a874, snow: 0xa8b8dc };
// first-person landing fan: kicked-up soil per surface (warmer and darker than the ring's dust so it reads on grass)
const FP_TINT = { grass: 0xc2a77a, dirt: 0xb88e62, sand: 0xe2c690, snow: 0xf4f8ff, wood: 0xc8a070, stone: 0xc8c2b4 };
const _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
/** fallback print sprite: two soft boot ovals (toes up), drawn once */
function drawPrintTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(150,140,120,0.85)';
  for (const [x, y, r] of [[20, 26, 1], [44, 34, -1]]) {
    g.beginPath(); g.ellipse(x, y, 8, 12, 0.12 * r, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x - 1 * r, y + 19, 6, 5, 0, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** G.debug.phys: frame-exact physics probes (manual clock) and state snapshots */
function debugApi(game) {
  const r4 = (v) => +(+v).toFixed(4);
  return {
    /** Pip's movement state */
    state() {
      const p = game.player;
      return { pos: p.pos.toArray().map(r4), vel: [r4(p.vel.x), r4(p.vel.y)], speed: r4(p.vel.length()), vy: r4(p.vy), grounded: p.grounded, alt: r4(p.alt),
        sprint: p.sprint, sprintMode: p.sprintMode, wading: p.wading, standOn: p.standOn ? (p.standOn === 'deck' ? 'deck' : p.standOn.kind) : null, surface: p.surface,
        coyoteT: r4(p.coyoteT), jumpBuffer: r4(p.jumpBuffer), airT: r4(p.airT), lastSafe: [r4(p.lastSafe.x), r4(p.lastSafe.z)], unsafeT: r4(p.unsafeT), state: p.state,
        pen: r4(penetration(game.world, p.pos.x, p.pos.z, p.r, p.pos.y, p.grounded)) };
    },
    /** a jump from where Pip stands, stepped frame by frame (manual clock): o = { hold = true (button held), run = 0
     *  (m/s forward wish scale 0..1), sprint = false, frames = 50 } → { apex, airtime, dist, impact, trace: [{ f, y,
     *  vy, alt, grounded }] }. Leaves the manual clock on if it was on */
    jumpTrace(o = {}) {
      const D = G.debug, p = game.player, man = game.clock.manual;
      D.manual(true);
      const hold = o.hold !== false, frames = o.frames ?? 50, y0 = p.pos.y, x0 = p.pos.x, z0 = p.pos.z, tr = [];
      if (o.run) { D.move(0, o.run); if (o.sprint) { D.press('dash', 0); D.hold('sprint'); } D.advance(o.warm ?? 40, STEP, { render: false }); }
      const sx = p.pos.x, sz = p.pos.z, sy = p.pos.y;
      if (hold) D.hold('jump'); else D.press('jump', 0);
      let apex = 0, t0 = null, t1 = null, land = null, impact = 0, lx = 0, lz = 0;
      const off = game.events.on(EV.LAND, (e) => { if (t0 != null && land == null) { land = tr.length; impact = e.impact; } });
      for (let f = 0; f < frames; f++) {
        D.advance(1, STEP, { render: false });
        const y = p.pos.y - sy;
        if (!p.grounded && t0 == null) t0 = f;
        if (t0 != null && p.grounded && t1 == null) { t1 = f; lx = p.pos.x; lz = p.pos.z; }
        apex = Math.max(apex, y);
        tr.push({ f, y: r4(y), vy: r4(p.vy), alt: r4(p.alt), grounded: p.grounded });
        if (t1 != null && f > t1 + 2) break;
      }
      off();
      D.move(0, 0); D.release();
      if (!man) D.manual(false);
      const dist = t1 != null ? Math.hypot(lx - sx, lz - sz) : null;
      return { apex: r4(apex), airtime: t0 != null && t1 != null ? r4((t1 - t0 + 1) * STEP) : null, dist: dist == null ? null : r4(dist), impact: r4(impact), from: [r4(x0), r4(y0), r4(z0)], trace: tr };
    },
    /** colliders within d of a point (default: Pip) with their shape and signed distance */
    near(x = game.player.pos.x, z = game.player.pos.z, d = 3) {
      const out = [];
      game.world.nearColliders(x, z, d, out);
      return out.map((c) => ({ kind: c.kind, shape: c.shape, x: r4(c.x), z: r4(c.z), r: r4(c.r), hx: r4(c.hx), hz: r4(c.hz), rot: r4(c.rot), y0: r4(c.y0), y1: r4(c.y1), camTop: r4(c.camTop), rEye: r4(c.rEye), stand: c.stand, body: c.body !== false }));
    },
    /** back to the last safe spot now (what the stuck recovery does) */
    warpSafe() { fxm.warp(); return true; },
    /** footprints: { built, live (visible), max, fallback (no sprite file) } */
    prints() { const m = fxm.pm; return { built: !!m, live: m ? Array.from(m.geometry.attributes.aFade.array).filter((v) => v > 0).length : 0, max: m ? m.count : 0, fallback: !!(m && m.material.map && m.material.map.isCanvasTexture) }; },
  };
}
