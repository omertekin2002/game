// WP2 viewmodel (arch §6.1–6.2, art §1, feel §7–8.3): Pip's hands, sleeves and swords in first person, in their own
// scene + camera drawn after the world with the depth cleared (never clips into walls). vmScene uses world axes
// translated so the eye is at the origin: the vm camera sits at (0, 0, 0) with the main camera's orientation and a
// fixed vertical FOV (TUNE.vm.fov, widened on narrow screens); the arms hang off the vm camera (camera space); the
// lights copy the sky (hemisphere, sun with a canopy shade factor; at night the nearest lamp and Pip's glow).
// Driven only by player state and events: swings follow player.attackT and the sim's sweep (the blade passes through
// the sweep point, so it crosses the crosshair when the hit test does; the hit-stop freezes on the contact pose),
// keyed poses for dialogue / boss intro / item-get / potion / chest / seed placing, and procedural motion layers (look
// sway, stride bob, strafe tilt, breathing, jump / land, dash tuck, sprint carry, hurt jolt, i-frame flash, dizzy drop).
// Also owns Pip's boots in FP (vm/boots.js). Hidden in TP (first 0.15 s of the switch), during shots, menus and the shop.
import * as THREE from 'three';
import { seedBuilt, heartContainerBuilt } from '../models.js';
import { toonMat, meshWithOutline } from '../toon.js';
import { vm as T, combat as TC } from '../tune.js';
import { EV } from '../events.js';
import { sfx } from '../core.js';
import { STEP } from '../clock.js';
import { CFG, SEEDS } from '../data.js';
import { clamp, lerp, damp, Ease, wrapAngle, yawOf, smoothstep, mulberry32 } from '../util.js';
import { Pose, slashPose, chopPose, recoverPose, sweepAt, chopAt, sweepTimeAt, chopTimeAt, armDir, Stride } from '../vm/anim.js';
import { buildArm, vmOutlineMat, potionGB, vmSwordBuilt } from '../vm/rig.js';
import { VmTrail, VmSparks, raysCard } from '../vm/fx.js';
import { Boots } from '../vm/boots.js';

const D2R = Math.PI / 180;
const REF = 0.40;                       // depth at which the aspect offsets are measured
const rnd = mulberry32(0x7a11);          // cosmetic randomness (never the sim's Math.random)
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _hb = {};
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
/** every spring is integrated in uniform sub-steps of at most SUB s, so it behaves the same at 60, 30 or 10 fps
 *  (one semi-implicit step per render frame went unstable once λ·dt neared 1: item-get paws strobing at 30 fps) */
const SUB = 1 / 120;
const subN = (dt) => Math.max(1, Math.ceil(dt / SUB - 1e-6));
const fin3 = (v) => Number.isFinite(v.x + v.y + v.z);

/** vm vertical FOV: TUNE.vm.fov (54°), widened on narrow screens so the horizontal FOV stays ≥ 70° (≤ 100° vertical),
 *  the same rule as the world camera; otherwise a portrait phone is narrower than the hands */
export function vmFovFor(aspect) {
  const v = T.fov * D2R;
  if (2 * Math.atan(Math.tan(v / 2) * aspect) >= 70 * D2R) return T.fov;
  return Math.min(100, (2 * Math.atan(Math.tan(35 * D2R) / aspect)) / D2R);
}
/** first-swing peak per unit start velocity of the damped spring x'' = −k x − d x' as layers() steps it (semi-implicit
 *  Euler in SUB sub-steps), so a kick can be sized in metres */
function springPeak(k, d) { let x = 0, v = 1, m = 0; for (let i = 0; i < 1.5 / SUB; i++) { v += (-k * x - d * v) * SUB; x += v * SUB; m = Math.max(m, x); } return m; }
/** draw a part's ink hull after every solid part (renderOrder 1): the hull's inside then fails the early depth test
 *  instead of being shaded and overdrawn (the hands cover a lot of screen, so this is most of the pass's cost) */
function inkLast(g) { g.traverse((o) => { if (o.isMesh && o.material && o.material.side === THREE.BackSide) o.renderOrder = 1; }); return g; }
/** A/B recovery ease with a small overshoot past rest (feel §8.3: 6 % at 260 ms) */
const recoverEase = (x) => Ease.inOutSine(x) + T.overshoot * 2 * Math.sin(Math.PI * x) * smoothstep(0.35, 1, x);

const vm = {
  name: 'wp2-viewmodel',
  attach(game) {
    this.game = game;
    const scene = (this.scene = new THREE.Scene());
    scene.matrixWorldAutoUpdate = true;
    const cam = (this.camera = new THREE.PerspectiveCamera(vmFovFor(game.camera.aspect), game.camera.aspect, 0.01, 5));
    scene.add(cam);
    // lights (copied from the sky every frame; constant count so the shader never recompiles)
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.lamp = new THREE.PointLight(0xffc27a, 0, 10, 2);
    this.glow = new THREE.PointLight(0xfff0d0, 0, 7, 1.5);
    scene.add(this.hemi, this.sun, this.lamp, this.glow);
    // materials: one toon (arms, sword: vertex colours + glow), one ink line (skinned or not), one for held items
    this.mat = toonMat({ glow: true, nearFade: false });
    this.ol = vmOutlineMat(T.outline);
    this.itemMat = toonMat({ glow: true, glowBase: 0.45, rim: 0.7, nearFade: false });
    this.mat.userData.flashColor.value.setRGB(1, 0.96, 0.86);
    // arms (2 calls each) and the swords in the right fist (2 calls)
    this.armR = buildArm(1, this.mat, this.ol, cam);
    this.armL = buildArm(-1, this.mat, this.ol, cam, potionGB(T));
    this.hand = this.armR.bones[1];
    this.swords = [false, true].map((shiny) => {
      const g = inkLast(meshWithOutline(vmSwordBuilt(shiny), this.mat, this.ol, { cast: false }));
      g.scale.setScalar(T.swordS);
      g.position.y = -T.grip * T.swordS;            // the grip centre sits in the fist
      g.traverse((o) => { o.frustumCulled = false; });
      this.hand.add(g);
      return g;
    });
    // held item (item-get), the seed in a paw (placing), effects; all in camera space
    this.item = new THREE.Group(); this.item.name = 'vm-item'; cam.add(this.item);
    this.seed = new THREE.Group(); this.seed.name = 'vm-seed';
    this.rays = raysCard(); cam.add(this.rays);
    this.trail = new VmTrail(); cam.add(this.trail.mesh);
    this.sparks = new VmSparks(); cam.add(this.sparks.mesh);
    // FP boots (main scene)
    this.boots = new Boots(game.scene, T);
    // render-side stride phase (r2): the hands' bob, the boots and Pip's TP legs (player-body.js) read it, never the
    // per-step walkPhase
    this.stride = new Stride();
    if (game.player) { game.player.stride = this.stride; this.stride.sync(game.player); }
    this.ph = 0;
    // poses: current R / L, targets, rest, the pose a swing started from; aspect offsets
    this.R = new Pose(); this.L = new Pose(); this.tR = new Pose(); this.tL = new Pose(); this.rest = new Pose();
    this.from = new Pose(); this.tmp = new Pose(); this.tmp2 = new Pose(); this.lowP = new Pose(); this.pv = new THREE.Vector3(); this.lv = new THREE.Vector3();
    this.off = new THREE.Vector3(); this.offL = new THREE.Vector3(); this.offC = new THREE.Vector3(); this.itemPos = new THREE.Vector3();
    this.SR = V(T.shoulderR); this.SL = V(T.shoulderL); this.SS = V(T.shoulderSwing || T.shoulderR);
    this.low = 1; this.wL = 0; this.handR = 'fist'; this.handL = 'fist'; this.now = 0;
    this.sw = null; this.ev = {}; this.mode = 'rest'; this.force = null;
    this.visible = false;
    this.stats = { calls: 0, tris: 0, cpuMs: 0, frames: 0 };
    this.k = { x: 1, y: 1 };
    this.layout(game.camera.aspect);
    this.R.copy(this.rest); this.L.arr(T.hiddenL);
    // motion-layer state
    this.sway = { y: 0, p: 0, x: 0, yv: 0, lastYaw: null, lastPitch: 0, inYaw: 0, inPitch: 0 };
    this.land = { y: 0, v: 0 }; this.hurtS = { y: 0, v: 0, r: 0, rv: 0, side: 1 };
    this.resetMotion();
    this.shade = 1;
    // the look input of each frame (mouse, touch, pad, after the other look mods that ran first): a yaw / pitch jump
    // the input did not make is a cut (teleport, respawn, setLook), however fast the player flicks
    if (game.view && game.view.addLookMod) game.view.addLookMod((L) => { this.sway.inYaw += L.dyaw || 0; this.sway.inPitch += L.dpitch || 0; });
    const E = game.events;
    E.on(EV.SWING, (p) => this.onSwing(p));
    E.on(EV.HIT, (p) => this.onContact(p, false));
    E.on(EV.CLINK, (p) => this.onContact(p, true));
    E.on(EV.DASH_START, () => { this.ev.dash = this.now; });
    E.on(EV.DASH_END, () => { this.ev.dashEnd = this.now; });
    // jump / land: kicks on one vertical spring, sized so its first swing peaks at jumpDip / landDip·impact (art §1.5)
    const pL = springPeak(T.landK, T.landD), pH = springPeak(T.hurtW * T.hurtW, 2 * T.hurtZ * T.hurtW);
    E.on(EV.JUMP, () => { this.land.v -= T.jumpDip / pL; });
    E.on(EV.LAND, (p) => { const k = clamp((p && p.impact || 0) / 8, 0, 1); this.land.v -= T.landDip * k / pL; });
    // hurt: the hands jolt down hurtY and roll hurtRoll° away from the hit (feel §7.5)
    E.on(EV.HURT, (p) => { this.ev.hurt = this.now; const H = this.hurtS; H.v -= Math.abs(T.hurtY) / pH; H.side = p && p.rel > 0 ? -1 : 1; H.rv += H.side * T.hurtRoll * D2R / pH; });
    E.on(EV.POTION, () => { const ev = this.ev; ev.potion = this.now; ev.corked = false; ev.hearts = false; });
    E.on(EV.ITEM_GET, (p) => this.onItem(p));
    E.on(EV.ITEM_DONE, () => { this.ev.itemDone = this.now; });
    E.on(EV.CHEST_OPEN, () => { this.ev.chest = this.now; });
    // respawn grace (combat.js: 1.5 s of i-frames): the hands pulse like the hurt i-frames (the foundation blinked)
    E.on(EV.RESPAWN, () => { this.ev.respawn = this.now; });
    // a purchase at Miso's is raised in both paws as the shop closes (art §1.6: "potion bought"; no dialogue)
    E.on(EV.SHOP_OPEN, () => { const S = game.S; this.shopSnap = { potions: S.potions, maxHp: S.maxHp, sword: S.swordLevel }; });
    E.on(EV.SHOP_CLOSE, () => this.presentPurchase());
    E.on(EV.VIEW_MODE, (p) => { const pl = game.player; if (p.mode === 'tp' && pl.state === 'item') pl.turnTo(game.view.yaw + Math.PI); });
    // warm the vm programs (skinned toon + ink, sword, item, effects) now, not on the first frame in play
    try { this.armL.visible = true; this.item.add(new THREE.Mesh(vmSwordBuilt(false).geo, this.itemMat)); this.trail.mesh.visible = this.sparks.mesh.visible = this.rays.visible = true; for (const on of [true, false]) { this.lamp.visible = this.glow.visible = on; game.renderer.compile(scene, cam); } } catch (e) { /* first draw compiles */ }
    this.item.clear(); this.trail.mesh.visible = this.sparks.mesh.visible = this.rays.visible = false;
    const self = this;
    const dbg = () => self.info();
    dbg.state = dbg;
    /** force a named pose for screenshots / tests (null releases): rest, lowered, guard, item, potion, chest, seed, sprint, dash, dizzy */
    dbg.pose = (name = null) => { self.force = name; return name; };
    dbg.check = (aspect) => self.frameCheck(aspect);
    dbg.module = self;
    dbg.T = T;
    /** present an item in both paws for hold s: 'potion' | 'heart' | 'sword' | 'seed' or a GB build { geo, ol } */
    dbg.present = (item = 'potion', hold = 1.4) => self.present(item, hold);
    dbg.relayout = () => { self.SR.set(...T.shoulderR); self.SL.set(...T.shoulderL); self.SS.set(...(T.shoulderSwing || T.shoulderR)); self.layout(self.aspect); return self.rest.P.toArray(); };
    game.registerDebug('vm', dbg);
  },
  onResize(w, h) { this.layout(w / h); },
  /** title (boot, Save & Quit): afterCamera stops running there, so drop the in-play state it would have refreshed */
  onTitle() { this.visible = false; this.sw = null; this.low = 1; this.ev = {}; this.item.clear(); this.boots.group.visible = false; this.trail.clear(); this.sparks.clear(); this.dropSeed(); this.resetMotion(); },
  onSession() { this.ev = {}; this.sw = null; this.item.clear(); this.R.copy(this.rest); this.L.arr(T.hiddenL); this.wL = 0; this.trail.clear(); this.sparks.clear(); this.dropSeed(); this.resetMotion(); this.stride.sync(this.game.player); },
  beforeStep() { this.stride.before(this.game.player); },
  afterStep() { this.stride.after(this.game.player); },
  /** drop every transient motion state (springs, sway, hand velocity): session start, title, hidden, a bad value */
  resetMotion() {
    const s = this.sway;
    s.lastYaw = null; s.y = s.p = s.x = s.yv = s.inYaw = s.inPitch = 0;
    this.land.y = this.land.v = 0;
    const H = this.hurtS; H.y = H.v = H.r = H.rv = 0;
    this.pv.set(0, 0, 0);
    this.amp = 0; this.lat = 0; this.fwd = 0; this.jumpY = 0;
    if (this.lay) { this.lay.p.set(0, 0, 0); this.lay.q.identity(); }
  },
  /** the placing seed rides a hand bone (the arm's visibility does not reach a bone's children): off it goes */
  dropSeed() { const s = this.seed; s.visible = false; if (s.parent) s.removeFromParent(); },

  // ------------------------------------------------------------------ layout (aspect)
  /** rest pose solved from its NDC targets (grip + tip) for this aspect; offsets for the keyed poses */
  layout(aspect) {
    this.aspect = aspect;
    const th = Math.tan((vmFovFor(aspect) * D2R) / 2), tw = th * Math.min(aspect, 16 / 9);
    // sx: tan-space shift right (ultrawide: the composition keeps its 16:9 width, moved right just enough that the
    // tip stays at ≥ restTipMinX NDC, out of the centre box)
    const solve = (out, h, tip, thv, twv, sx = 0) => {
      const P = _v.set((h[0] * twv + sx) * h[2], h[1] * thv * h[2], -h[2]);
      const dir = _w.set(tip[0] * twv + sx, tip[1] * thv, -1).normalize();
      const b = dir.dot(P), c = P.lengthSq() - T.bladeLen * T.bladeLen, s = b + Math.sqrt(Math.max(0, b * b - c));
      _u.copy(dir).multiplyScalar(s).sub(P);
      out.set(P, _u, armDir(this.lv, P, this.SR || V(T.shoulderR), T.elbowSag));
      return T.restRoll ? out.roll(T.restRoll * D2R) : out;
    };
    const th0 = Math.tan((T.fov * D2R) / 2), tw0 = th0 * 16 / 9;
    this.thK = th / th0;                                                // vertical tan scale vs the 16:9 design
    solve(this.tmp2, T.restHand, T.restTip, th0, tw0);                // the 16:9 design rest
    const design = this.tmp2.P.clone();
    // portrait targets blend in over aspect 1.2 → 0.9 (no jump at a square window)
    const wp = 1 - smoothstep(0.9, 1.2, aspect), mix = (a, b) => a.map((x, i) => lerp(x, b[i], wp));
    const hand = mix(T.restHand, T.restHandPortrait), tip = mix(T.restTip, T.restTipPortrait);
    const sx = Math.max(0, T.restTipMinX * th * aspect - tip[0] * tw);
    // grip and tip in tan space (x right, y up, at unit depth)
    let hx = hand[0] * tw + sx, hy = hand[1] * th, tx = tip[0] * tw + sx, ty = tip[1] * th;
    // r2 part 3: a phone with the touch controls up — the rest composition moves left / up just enough that the paw
    // (touchPaw around the grip, + touchGap) clears every thumb button (touchRects), cheapest move first (up costs
    // touchUpCost × left); the tip keeps ≥ restTipMinX NDC and ≤ touchTipY NDC. The keyed and swing poses follow through
    // this.off. The paw and sleeve sat under Roll / Use in landscape and on Hop's corner in portrait
    const R = this.touchR;
    if (R && R.length) {
      const [pl, pr, pd, pu] = T.touchPaw, g = T.touchGap;
      const clear = (x, y) => R.every((b) => x + pr + g <= b.l || x + pl - g >= b.r || y + pu + g <= b.b || y + pd - g >= b.t);
      let best = null, bc = Infinity;
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
        const c = i + T.touchUpCost * j;
        if (c < bc && clear(hx - i * 0.02, hy + j * 0.02)) { bc = c; best = [-i * 0.02, j * 0.02]; }
      }
      if (best) {
        hx += best[0]; hy += best[1];
        tx = Math.max(tx + best[0], T.restTipMinX * th * aspect); ty = Math.min(ty + best[1], T.touchTipY * th);
      }
      this.touchShift = best;
    } else this.touchShift = null;
    solve(this.rest, [hx, hy, hand[2]], [tx, ty], 1, 1, 0);
    this.off.copy(this.rest.P).sub(design).multiplyScalar(REF / -this.rest.P.z);
    this.offL.set(-this.off.x, this.off.y, this.off.z);
    // centre poses (item-get, chest, seed) follow the presented item's NDC anchor
    const n = T.itemNdc;
    this.itemPos.set(n[0] * tw * n[2], n[1] * th * n[2], -n[2]);
    this.offC.set(this.itemPos.x - n[0] * tw0 * n[2], this.itemPos.y - n[1] * th0 * n[2], 0).multiplyScalar(REF / n[2]);
  },
  /** keyed pose from TUNE (arr) with an aspect offset: the right hand's (default), the centre's (true) or the left
   *  hand's ('L': the right offset mirrored) */
  key(out, a, centre = false) { return out.arr(a, 1, centre === 'L' ? this.offL : centre ? this.offC : this.off); },
  /** r2 part 3: the touch controls' buttons in the lower half of the screen as tan-space rects at unit depth for this
   *  aspect ({ l, r, t, b }, y up). A cluster button that is off right now (Use shows only at a target) is measured too,
   *  so the rest never moves when it appears. Re-measured when the layout key changes and the controls are shown (they
   *  hide in dialogue and menus: the last rects stay) */
  checkTouch() {
    const g = this.game, inp = g.input, ui = g.ui;
    if (!inp || !inp.touchVisible || !ui || typeof document === 'undefined') { if (this.touchR) { this.touchR = null; this.touchKey = ''; this.layout(this.aspect); } return; }
    const W = innerWidth, H = innerHeight, key = `${ui.lay}|${W}x${H}|${g.settings.get('touchLeftHanded') ? 1 : 0}|${g.settings.get('hudScale')}`;
    if (key === this.touchKey || !inp.touchOn) return;
    this.touchKey = key;
    const th = Math.tan((vmFovFor(this.aspect) * D2R) / 2), ax = th * this.aspect, out = [];
    for (const e of document.querySelectorAll('#touch .tb')) {
      const hid = e.classList.contains('off') && !!e.closest('.cluster');
      if (hid) e.classList.remove('off');
      const r = e.getBoundingClientRect();
      if (hid) e.classList.add('off');
      if (!r.width || r.top + r.height / 2 < H * 0.5) continue;   // the small top buttons sit far above the hands
      out.push({ l: ((2 * r.left) / W - 1) * ax, r: ((2 * r.right) / W - 1) * ax, t: (1 - (2 * r.top) / H) * th, b: (1 - (2 * r.bottom) / H) * th });
    }
    this.touchR = out.length ? out : null;
    this.layout(this.aspect);
  },

  // ------------------------------------------------------------------ events
  onSwing(p) {
    const pl = this.game.player;
    this.sw = { id: p.id, kind: p.kind, shiny: (p.level ?? pl.swordLevel) >= 2, contactT: null, hitKind: null, clink: false, release: null, tVis: 0, tLast: 0, glints: 0, elev: p.kind === 'C' ? 0 : this.aimElev(p) };
    this.from.copy(this.R);
    this.trail.style(this.sw.shiny, T.trailLife, T.trailA[this.sw.shiny ? 1 : 0]);
    this.trail.clear();
    this.ev.potion = null;                                   // a swing cancels the drink (feel §7.5)
    this.ev.chest = null;                                    // and the lid push (a gem chest frees Pip after 0.42 s)
    if (this.ev.presentEnd != null) { this.ev.presentEnd = null; this.ev.item = null; }   // and a purchase presentation
  },
  /** A/B: the slash plane's tilt (rad, from the aim pitch) toward the nearest enemy / boss ahead within reach, so the
   *  blade cuts through the target the hit test will hit (a slime at your feet, a bat overhead); 0 with none */
  aimElev(p) {
    const g = this.game, pl = g.player, ey = pl.pos.y + 0.88, yaw = p.aimYaw ?? g.view.aimYaw, pitch = p.aimPitch ?? g.view.aimPitch;
    let best = null, bd = 1e9;
    const consider = (o) => {
      if (!o || typeof o.hurtbox !== 'function') return;
      const hb = o.hurtbox(_hb), dx = hb.x - pl.pos.x, dz = hb.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > pl.reach + hb.r + T.aimRange || Math.abs(wrapAngle(yawOf(dx, dz) - yaw)) > T.aimCone * D2R || d >= bd) return;
      bd = d; best = Math.atan2((hb.y0 + hb.y1) / 2 - ey, Math.max(0.3, d)) - pitch;
    };
    for (const e of g.enemies) if (e.alive) consider(e);
    const b = g.fight && g.fight.boss;
    if (b && !b.dying) consider(b);
    return best == null ? 0 : clamp(best, T.aimElev[0] * D2R, T.aimElev[1] * D2R);
  },
  /** EV.HIT / EV.CLINK: the attackT at which the sweep reached the target (contact pose for the hit-stop, feel §8.3) */
  onContact(p, clink) {
    const sw = this.sw, game = this.game, pl = game.player;
    if (!sw || pl.swingId !== sw.id || sw.contactT != null) return;
    if (!clink && p.kind !== 'enemy' && p.kind !== 'boss') return;  // cut grass / pops pass through (no hit-stop)
    const t1 = pl.attackT, t0 = Math.max(0, t1 - STEP);
    let ct = t1;
    const tg = p.target;
    if (tg && typeof tg.hurtbox === 'function') {
      const hb = tg.hurtbox(_hb), view = game.view;
      const ox = pl.swingX ?? pl.pos.x, oz = pl.swingZ ?? pl.pos.z, yaw = pl.swingLatch ? pl.swingYaw : view.aimYaw;
      const d = Math.hypot(hb.x - pl.pos.x, hb.z - pl.pos.z);
      if (d >= TC.bubble + TC.bubbleR * hb.r) {
        if (sw.kind === 'C') {
          // the frozen contact shows the blade biting in, chopBite of the hurtbox's height below its top (r2: the top
          // itself sits above a slime's or a mushroom's visible cap, and the hit-stop froze the blade ≈ 0.27 NDC over it);
          // the chop is far past that depth by the end of the hit step, so the clamp below keeps it inside that step
          const pitch = pl.swingLatch ? pl.swingPitch : view.aimPitch, ey = pl.pos.y + 0.88, yb = hb.y1 - (hb.y1 - hb.y0) * (T.chopBite || 0);
          ct = chopTimeAt(TC, Math.atan2(yb - ey, Math.max(0.2, d)) - pitch);
        } else ct = sweepTimeAt(TC, sw.kind, wrapAngle(yawOf(hb.x - ox, hb.z - oz) - yaw));
      }
    }
    sw.contactT = clamp(ct, t0, t1);
    sw.hitKind = clink ? 'clink' : p.kind;
    sw.clink = clink;
  },
  onItem(p) {
    const ev = this.ev;
    ev.item = this.now; ev.itemDone = null; ev.presentEnd = null; this.itemLift = null;
    this.setItem(p && p.built);
    // 18 sparkles around the item (art §11), spawned over the raise
    ev.itemSparks = 18;
  },
  /** the presented item: a copy of a GB build with the vm materials, centred on its bounds, its larger face size m */
  setItem(b, size = T.itemS) {
    this.item.clear();
    if (!b || !b.geo) return;
    const m = inkLast(meshWithOutline(b, this.itemMat, this.ol, { cast: false }));
    m.traverse((o) => { o.frustumCulled = false; });
    if (!b.geo.boundingBox) b.geo.computeBoundingBox();
    b.geo.boundingBox.getCenter(_v);
    m.position.copy(_v).multiplyScalar(-1);
    const inner = new THREE.Group(); inner.add(m);
    const sz = b.geo.boundingBox.getSize(_w);
    inner.scale.setScalar(size / Math.max(0.05, sz.x, sz.y));
    this.item.add(inner);
  },
  /** arch §15.2 `vm.present(item)`: both paws raise an item for hold s with no dialogue, then lower it by themselves;
   *  item = 'potion' | 'heart' | 'sword' | 'seed' or a GB build. A swing, a real item-get or a hidden viewmodel ends it */
  present(item, hold = 1.4) {
    // built once and reused (setItem only removes the old item, it never disposes shared geometry)
    const C = this.presentC || (this.presentC = {});
    const kinds = { potion: () => C.potion || (C.potion = potionGB(T).build()), heart: () => heartContainerBuilt(), sword: () => C.sword || (C.sword = vmSwordBuilt(true)), seed: () => seedBuilt(0x9be36a) };
    const b = typeof item === 'string' ? (kinds[item] ? kinds[item]() : null) : item;
    if (!b || !b.geo) return false;
    this.setItem(b, item === 'sword' ? T.itemS * 1.7 : T.itemS);
    const ev = this.ev;
    ev.item = this.now; ev.itemDone = null; ev.presentEnd = this.now + hold; ev.itemSparks = 12; this.itemLift = null;
    return true;
  },
  /** shop closed: raise what was bought (the sword first, then a heart container, then a potion) */
  presentPurchase() {
    const a = this.shopSnap, S = this.game.S;
    this.shopSnap = null;
    if (!a || this.game.view.bodyOut) return;
    const kind = S.swordLevel > a.sword ? 'sword' : S.maxHp > a.maxHp ? 'heart' : S.potions > a.potions ? 'potion' : null;
    if (kind && this.present(kind, 1.3)) sfx('sparkle');
  },

  // ------------------------------------------------------------------ swing poses
  /** right-hand pose of the current swing at attackT t */
  swingPose(out, kind, t) {
    // the forearm aims at the low swing shoulder: it leaves the frame through the bottom edge instead of running
    // across the screen to the right-hand corner (screen coverage = most of the pass's GPU time)
    const S = this.SS, kx = this.k.x, ky = this.k.y, off = this.off;
    if (kind === 'C') {
      const [s0, s1] = TC.sweepC;
      if (t < s0) {
        chopPose(this.tmp, T, 0, TC.chopUp * D2R, kx, ky, off, S, 0.688);
        this.tmp.P.add(_v.set(T.anticipC[0], T.anticipC[1], T.anticipC[2]).multiplyScalar(Math.sin(Math.PI * Math.min(1, t / s0))));
        return out.lerp(this.from, this.tmp, Ease.outQuad(t / s0));
      }
      const ux = Math.sqrt(TC.chopUp / (TC.chopUp - TC.chopDown));   // chop progress at which the sim's chop crosses the aim
      if (t < s1) return chopPose(out, T, (t - s0) / (s1 - s0), Math.max(chopAt(TC, t), T.chopFloor * D2R), kx, ky, off, S, ux);
      chopPose(this.tmp, T, 1, Math.max(TC.chopDown, T.chopFloor) * D2R, kx, ky, off, S, ux);
      // the hold settles a little (the blade bites, the hand sinks 1 cm), then a low recovery
      this.tmp.P.y -= 0.01 * smoothstep(s1, s1 + 0.05, t);
      if (t < T.chopHoldTo) return out.copy(this.tmp);
      return recoverPose(out, this.tmp, this.rest, this.key(this.lowP, T.carry), recoverEase(clamp((t - T.chopHoldTo) / (TC.swingC - T.chopHoldTo), 0, 1)), T.recDip);
    }
    const [s0, s1] = TC.sweepAB, dir = kind === 'B' ? -1 : 1, arc = TC.arc * D2R, e0 = this.sw ? this.sw.elev || 0 : 0;
    const fl = T.recFloor == null ? null : T.recFloor * Math.tan((this.camera.fov * D2R) / 2);   // r3: grip floor (tan)
    if (t < s0) {
      slashPose(this.tmp, T, dir, 0, -dir * arc, kx, ky, off, S, e0);
      this.tmp.P.add(_v.set(dir * T.anticip[0], T.anticip[1], T.anticip[2]));
      return out.lerp(this.from, this.tmp, Ease.outQuad(t / s0));
    }
    if (t < s1) { const a = sweepAt(TC, kind, t); return slashPose(out, T, dir, (dir * a / arc + 1) / 2, a, kx, ky, off, S, e0); }
    // r3: the follow-through eases in and out (the sweep ends at rest speed: an outCubic follow-through started at full
    // speed, and since r2's holdTo 0.15 cut it short the recovery started from the full overrun — B's blade flipped upright
    // and A's hand dropped 0.4 NDC in one frame); it keeps travelling under the recovery, which pulls it home from there
    const fu = 1 + 0.25 * Ease.inOutSine(clamp((t - s1) / T.follow, 0, 1));
    slashPose(this.tmp, T, dir, fu, dir * arc, kx, ky, off, S, e0, fl);
    if (t < T.holdTo) return out.copy(this.tmp);
    return recoverPose(out, this.tmp, this.rest, this.key(this.lowP, T.carry), recoverEase(clamp((t - T.holdTo) / (TC.swingAB - T.holdTo), 0, 1)), dir > 0 ? T.recDip : T.recDip * 0.3, fl);
  },
  /** turn a pose's blade against the swing about the wrist (A/B: about the vertical, C: up) */
  kickPose(p, ang, chop, dir) {
    _q.setFromAxisAngle(chop ? _u.set(1, 0, 0) : _u.set(0, 1, 0), chop ? ang : -dir * ang);
    p.Q.premultiply(_q);
    return p;
  },
  /** blade point at fraction f (0 = grip centre, 1 = tip) of a pose */
  bladePt(out, pose, f) { return pose.blade(out).multiplyScalar(f * T.bladeLen).add(pose.P); },

  // ------------------------------------------------------------------ per frame
  afterCamera(alpha, dt) {
    const g = this.game, v = g.view, pl = g.player, ui = g.ui;
    this.visible = false;
    const inPlay = g.state === 'play' && !ui.menu && !ui.shop;
    this.ph = this.stride.at(alpha);                          // the stride phase at this frame (interpolated, never backwards)
    this.boots.update(pl, v, inPlay && !v.bodyOut && v.mode === 'fp' && v.shotW <= 0.02, dt, this.ph);
    if (!inPlay) return;
    // own monotonic render clock (game.time is reset by the test harness; event stamps must never run backwards)
    this.now += Math.min(0.1, Math.max(0, dt));
    const frozen = g.clock.hitStopT > 0 || g.clock.frozenFrame, now = this.now;
    const settings = g.settings, motion = settings.get('reduceMotion') ? 0 : clamp(settings.get('headBob') ?? 1, 0, 1);
    // hidden / lowered: TP (out over the first 0.15 s of the switch), shots
    const want = Math.max(clamp(v.blend / 0.43, 0, 1), clamp(v.shotW * 2, 0, 1));
    this.low = want >= this.low ? Math.min(want, this.low + dt / T.hideT) : damp(this.low, want, 12, dt);
    this.updateMapping();
    this.checkTouch();
    if (this.low >= 0.999) { this.snapHidden(); return; }
    // ---- mode and targets
    const ev = this.ev, mode = this.pickMode(pl, ui, now);
    this.mode = mode;
    const tR = this.tR, tL = this.tL;
    let handR = 'fist', handL = 'fist', wantL = 0, swordOn = 1, lamb = T.recover, itemK = 0, raysK = 0;
    this.key(tL, T.hiddenL, 'L');
    const sinceItem = ev.item != null ? now - ev.item : 9;
    const sinceDone = ev.itemDone != null ? now - ev.itemDone : ev.presentEnd != null ? now - ev.presentEnd : -1;
    switch (mode) {
      case 'item': {
        // the sword drops (0.15 s), both paws rise with the item (0.35 s, outBack); after itemDone they lower (0.25 s)
        const up = sinceDone >= 0 ? 1 - clamp(sinceDone / 0.25, 0, 1) : Ease.outBack(clamp((sinceItem - 0.12) / 0.35, 0, 1), 1.2);
        const drop = sinceDone >= 0 ? 1 : clamp(sinceItem / 0.15, 0, 1);
        swordOn = 0; handR = handL = 'paw';
        this.key(tR, T.itemR, true); this.key(tL, T.itemL, true);
        this.liftItem(ui, dt, tR, tL);
        tR.P.y -= (1 - up) * 0.32; tL.P.y -= (1 - up) * 0.32;
        if (drop < 1) { this.key(tR, T.lowered); tR.P.y -= drop * 0.3; handR = 'fist'; swordOn = 1; }
        wantL = up > 0.02 ? 1 : 0; lamb = 30; itemK = up; raysK = up;
        break;
      }
      case 'chest': {
        const k = now - ev.chest, push = smoothstep(0.08, 0.28, k) * (1 - smoothstep(0.42, 0.6, k));
        swordOn = 0; handR = handL = 'paw';
        this.key(tR, T.chestR, true); this.key(tL, T.chestL, true);
        const rise = smoothstep(0, 0.12, k) * (1 - smoothstep(0.45, 0.6, k));
        for (const P of [tR.P, tL.P]) { P.y -= 0.2 * (1 - rise); P.z -= push * 0.08; }
        wantL = 1; lamb = 22;
        break;
      }
      case 'seed': {
        // count the seeds that left the hand in this cutscene: the hands alternate L, R, L
        const c = g.cutscene;
        if (ev.seedCs !== c) { ev.seedCs = c; ev.seedIdx = 0; ev.seedCur = null; }
        if (c.cur && ev.seedCur !== c.cur) { ev.seedCur = c.cur; ev.seedIdx++; }
        const i = ev.seedIdx - (c.cur ? 1 : 0), right = i % 2 === 1, holding = !c.cur && c.queue && c.queue.length > 0;
        swordOn = 0; handR = handL = 'paw';
        this.key(tR, holding && right ? T.seedR : T.itemR, true); this.key(tL, holding && !right ? T.seedL : T.itemL, true);
        if (!holding) { tR.P.y -= 0.12; tL.P.y -= 0.12; }
        else { (right ? tL : tR).P.y -= 0.14; }
        wantL = 1; lamb = 12;
        this.updateSeed(c, holding, right);
        break;
      }
      case 'talk': this.key(tR, T.lowered); this.talkDrop(ui, tR); lamb = 1 / T.talkT * 3; break;
      case 'guard': this.key(tR, T.guard); break;
      // r4: the boss intro (its name card): the blade lowered out of the shot (the guard pose held it up across the boss);
      // it rises to the rest pose as the fight starts
      case 'intro': this.key(tR, T.lowered); this.tipUnder(tR, T.introTipY); lamb = 1 / T.talkT * 3; break;
      case 'dizzy': {
        const k = Ease.inOutSine(clamp((pl.dizzyT || 0) / T.dizzyT, 0, 1));
        // the drop scales with the vm camera's vertical extent (portrait widens it to 100°): the blade leaves the frame
        tR.copy(this.rest); tR.P.y += T.dizzyY * this.thK * Ease.inOutSine(k);
        this.key(tL, T.dizzyL, 'L'); tL.P.y -= 0.12 * k; wantL = 1;
        break;
      }
      case 'sprint': {
        this.key(tR, T.sprint);
        const ph = Math.max(0, Math.sin(this.ph));
        tL.set(_v.set(T.sprintPump[0] + this.offL.x, T.sprintPump[1] - T.sprintPumpA * (1 - ph) + this.off.y, T.sprintPump[2]), _w.set(0.15, 0.85, -0.5), armDir(this.lv, _v, this.SL, T.elbowSag));
        wantL = 1; lamb = 20;
        break;
      }
      default: tR.copy(this.rest);
    }
    // potion (non-blocking overlay on the left paw)
    if (ev.potion != null && mode !== 'item' && mode !== 'dizzy') {
      const k = now - ev.potion;
      if (k < 0.9) {
        handL = 'prop'; wantL = 1; lamb = Math.max(lamb, 24);
        if (k < 0.2) this.key(tL, T.potionRaise, 'L');
        else if (k < 0.65) { this.key(tL, T.potionDrink, 'L'); if (!ev.corked) { ev.corked = true; this.cork(); } }
        else { this.key(tL, T.potionRaise, 'L'); tL.P.y -= smoothstep(0.65, 0.88, k) * 0.3; }
        if (k >= 0.62 && !ev.hearts) { ev.hearts = true; this.hearts(); }
      } else ev.potion = null;
    }
    // dash: both fists tuck (the left appears at the mirror spot)
    const dashK = this.dashK(now);
    if (dashK > 0.01 && mode !== 'item' && mode !== 'chest' && mode !== 'seed' && handL !== 'prop') {
      tL.copy(this.rest); tL.P.x = -tL.P.x - 0.02; this.mirrorQ(tL); wantL = Math.max(wantL, dashK > 0.2 ? 1 : 0);
      lamb = Math.max(lamb, 34);   // the dash lasts 0.2 s: the left fist has to arrive within a few frames
    }
    // ---- right hand: exact swing, or ease toward the target
    const sw = this.sw;
    let swinging = false;
    if (sw && pl.state === 'attack' && pl.swingId === sw.id && mode !== 'item' && mode !== 'dizzy') {
      swinging = true;
      const tSim = frozen ? pl.attackT : Math.max(0, pl.attackT - (1 - g.clock.alpha) * STEP);
      if (sw.contactT != null && (frozen || sw.clink)) {
        sw.tVis = sw.contactT;
        if (!frozen && sw.release == null) sw.release = now;
      } else {
        if (sw.contactT != null && sw.release == null) sw.release = now;
        sw.tVis = sw.tVis < tSim ? tSim - (tSim - sw.tVis) * 0.35 : tSim;
        if (tSim - sw.tVis < 0.002) sw.tVis = tSim;
      }
      this.swingPose(this.R, pl.combo, sw.tVis);
      if (sw.contactT != null) {
        if (frozen) {
          // impact buzz while the stop holds the contact pose (feel §2.5: ±0.8 cm at 30 Hz)
          const ph = now * T.jitterHz * Math.PI * 2;
          this.R.P.x += Math.sin(ph) * T.jitter; this.R.P.y += Math.cos(ph * 1.37) * T.jitter * 0.6;
        } else if (sw.release != null) {
          // then the blade kicks back against the swing (hit) or bounces off the claw (clink) and recovers
          const k = now - sw.release;
          const ang = sw.clink ? T.clink * (k < T.clinkIn ? Ease.outQuad(k / T.clinkIn) : 1 - Ease.inOutSine(clamp((k - T.clinkIn) / T.clinkOut, 0, 1)))
            : (sw.hitKind === 'boss' ? T.kickBoss : T.kick) * Math.sin(Math.PI * clamp(k / T.kickT, 0, 1));
          if (ang) this.kickPose(this.R, ang * D2R, sw.kind === 'C', sw.kind === 'B' ? -1 : 1);
          if (sw.clink) this.R.lerp(this.R, this.rest, smoothstep(T.clinkIn + T.clinkOut * 0.5, T.clinkIn + T.clinkOut + 0.1, k));
        }
      }
      this.pv.set(0, 0, 0);
    } else {
      if (sw && (pl.swingId !== sw.id || pl.state !== 'attack')) { this.sw = null; }
      // P on a light spring (a touch of overshoot; sub-stepped, so any frame rate gives the same motion), the
      // rotations eased
      const kq = 1 - Math.exp(-lamb * dt), n = subN(dt), h = dt / n, k2 = lamb * lamb * h, c = 1.5 * lamb * h;
      for (let i = 0; i < n; i++) {
        _v.copy(tR.P).sub(this.R.P).multiplyScalar(k2).addScaledVector(this.pv, -c);
        this.pv.add(_v); this.R.P.addScaledVector(this.pv, h);
      }
      if (this.R.P.distanceToSquared(tR.P) > 0.25) { this.R.P.copy(tR.P); this.pv.set(0, 0, 0); }
      this.R.Q.slerp(tR.Q, kq); this.R.F.slerp(tR.F, kq);
    }
    // left hand: eases toward its target; shown while wanted (its own visibility weight)
    this.wL = wantL ? Math.min(1, this.wL + dt / 0.12) : Math.max(0, this.wL - dt / 0.2);
    if (!wantL) this.key(tL, T.hiddenL, 'L');
    {
      const kq = 1 - Math.exp(-Math.max(lamb, 14) * dt);
      this.L.P.lerp(tL.P, kq); this.L.Q.slerp(tL.Q, kq); this.L.F.slerp(tL.F, kq);
    }
    // a broken tunable must never put NaN into the bones (it would blank the pass): fall back to rest
    const fin = (q) => Number.isFinite(q.P.x + q.P.y + q.P.z + q.Q.x + q.Q.w + q.F.x + q.F.w);
    if (!fin(this.R) || !fin3(this.pv)) { this.R.copy(this.rest); this.pv.set(0, 0, 0); }
    if (!fin(this.L)) this.key(this.L, T.hiddenL, 'L');
    this.handR = handR; this.handL = handL;
    if (mode !== 'seed' && this.seed.visible) this.dropSeed();
    // ---- motion layers → one camera-space rigid offset for both arms
    const lay = this.layers(pl, v, now, dt, frozen, motion, mode, swinging, dashK);
    // ---- write bones
    const low = Ease.inOutSine(this.low);
    this.armR.setHand(handR);
    this.armL.setHand(handL);
    this.armL.visible = this.wL > 0.01;
    this.place(this.armR, this.R, lay, low);
    this.place(this.armL, this.L, lay, low);
    const lvl = pl.swordLevel >= 2 ? 1 : 0;
    this.swords[0].visible = !!swordOn && lvl === 0; this.swords[1].visible = !!swordOn && lvl === 1;
    // the i-frame flash (feel §6.4: 0.35 at 8 Hz for the hurt i-frames, and for the respawn grace) and the hurt
    // white flash
    const sinceHurt = ev.hurt != null ? now - ev.hurt : 9, sinceRsp = ev.respawn != null ? now - ev.respawn : 9;
    const iwin = sinceHurt < CFG.hurtIframes ? sinceHurt : sinceRsp < 1.5 && pl.iframes > 0 ? sinceRsp : -1;
    const fl = Math.max(pl.flash > 0 ? pl.flash * 0.6 : 0, iwin >= 0 && pl.state !== 'dizzy' ? (Math.floor(iwin * T.flashHz * 2) % 2 === 0 ? T.flashK : 0) : 0);
    this.mat.userData.flash.value = fl; this.ol.uniforms.uFlash.value = fl;
    // ---- presented item, effects, lights
    this.updateItem(itemK, raysK, now, dt, frozen, lay, low);
    this.updateFx(sw, swinging, now, dt, frozen, lay, low);
    this.updateLights();
    this.visible = true;
  },
  /** fully hidden (TP, shots): nothing on screen, so drop transient motion and settle the arms on rest; coming back
   *  they rise from the lowered position into it with no catch-up */
  snapHidden() {
    this.sw = null; this.trail.clear(); this.sparks.clear();
    if (this.ev.presentEnd != null) { this.ev.presentEnd = null; if (this.game.player.state !== 'item') this.ev.item = null; }
    this.R.copy(this.rest); this.L.arr(T.hiddenL); this.wL = 0;
    this.resetMotion(); this.dropSeed();
  },
  /** state priority: dizzy > item > seed placing > chest > dialogue > boss intro (lowered) > dash/sprint > rest */
  pickMode(pl, ui, now) {
    const g = this.game, ev = this.ev, f = this.force;
    if (f) return { rest: 'rest', lowered: 'talk', item: 'item', chest: 'chest', seed: 'seed', guard: 'guard', dizzy: 'dizzy', sprint: 'sprint' }[f] || 'rest';
    if (pl.state === 'dizzy') return 'dizzy';
    if ((pl.state === 'item' && ev.item != null) || (ev.itemDone != null && now - ev.itemDone < 0.25 && ev.item != null && ev.itemDone > ev.item)) return 'item';
    if (ev.presentEnd != null && now < ev.presentEnd + 0.25) return 'item';
    if (g.cutscene && g.cutscene.type === 'place') return 'seed';
    if (ev.chest != null && now - ev.chest < 0.6) return 'chest';
    if (ui.dlg) return 'talk';
    if (g.fight && g.fight.phase === 'intro') return 'intro';
    if (pl.state === 'normal' && pl.sprint && pl.vel.length() > 4.6) return 'sprint';
    return 'rest';
  },
  dashK(now) {
    const ev = this.ev;
    if (ev.dash == null) return 0;
    const k = now - ev.dash, end = ev.dashEnd != null && ev.dashEnd >= ev.dash ? now - ev.dashEnd : -1;
    const tin = smoothstep(0, T.dashIn, k);
    return end >= 0 ? tin * (1 - smoothstep(0, T.dashOut, end)) : tin;
  },
  /** the left pose from a right one: mirror x and the rotations across the YZ plane */
  mirrorQ(p) {
    for (const q of [p.Q, p.F]) { q.y = -q.y; q.z = -q.z; }
    return p;
  },
  /** world → vm mapping of bearings / elevations (same screen point), from the two cameras' projections */
  updateMapping() {
    const pw = this.game.camera.projectionMatrix.elements, c = this.camera;
    if (c.aspect !== this.game.camera.aspect) { c.aspect = this.game.camera.aspect; c.fov = vmFovFor(c.aspect); c.updateProjectionMatrix(); this.layout(c.aspect); }
    const pv = c.projectionMatrix.elements;
    this.k.x = pw[0] / pv[0]; this.k.y = pw[5] / pv[5];
    c.quaternion.copy(this.game.camera.quaternion);
  },

  // ------------------------------------------------------------------ motion layers (feel §7.3, art §1.5)
  layers(pl, v, now, dt, frozen, motion, mode, swinging, dashK) {
    const lay = this.lay || (this.lay = { q: new THREE.Quaternion(), p: new THREE.Vector3(), pivot: new THREE.Vector3(0.12, -0.26, -0.18) });
    const sw = this.sway;
    // look sway: rotation + position lag behind the look rate (λ swayL), clamped
    if (sw.lastYaw == null) { sw.lastYaw = v.yaw; sw.lastPitch = v.pitch; sw.inYaw = sw.inPitch = 0; }
    // a cut (teleport, respawn, setLook) is a jump the look input did not make; a flick at any speed is not one: it
    // saturates the sway (swayRotMax) instead of zeroing it
    const dyaw = wrapAngle(v.yaw - sw.lastYaw), dp = v.pitch - sw.lastPitch;
    const cut = Math.abs(wrapAngle(dyaw - sw.inYaw)) > 0.35 || Math.abs(dp - sw.inPitch) > 0.35;
    const yr = dt > 0 && !cut ? dyaw / dt : 0, pr = dt > 0 && !cut ? dp / dt : 0;
    sw.lastYaw = v.yaw; sw.lastPitch = v.pitch; sw.inYaw = sw.inPitch = 0;
    const k = 1 - Math.exp(-T.swayL * dt);
    sw.y += (clamp(-yr * T.swayRot[0], -T.swayRotMax[0], T.swayRotMax[0]) - sw.y) * k;
    sw.p += (clamp(-pr * T.swayRot[1], -T.swayRotMax[1], T.swayRotMax[1]) - sw.p) * k;
    sw.x += (clamp(-yr * T.swayPos[0], -T.swayPosMax[0], T.swayPosMax[0]) - sw.x) * k;
    sw.yv += (clamp(pr * T.swayPos[1], -T.swayPosMax[1], T.swayPosMax[1]) - sw.yv) * k;
    // stride bob (figure-8 on the interpolated stride phase, this.ph), strafe tilt, forward pull-back; amplitude follows
    // the speed
    const vx = pl.vel.x, vz = pl.vel.y, sp = Math.hypot(vx, vz);
    const grounded = pl.grounded !== false, moving = (pl.state === 'normal' || pl.state === 'attack') && grounded;
    this.amp = damp(this.amp, moving ? Math.min(1.2, sp / 4.4) : 0, 10, dt);
    const fy = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    this.lat = damp(this.lat, -(vx * -fz + vz * fy) / 4.4, 8, dt);   // + = moving right
    this.fwd = damp(this.fwd, (vx * fy + vz * fz) / 4.4, 8, dt);
    const ph = this.ph, bm = mode === 'sprint' ? T.bobSprint : 1;
    const bx = T.bob[0] * this.amp * Math.sin(ph) * bm, by = T.bob[1] * this.amp * Math.cos(2 * ph) * bm;
    // breathing (idle only)
    const idle = 1 - clamp(this.amp, 0, 1), br = Math.sin(now * T.breatheHz * Math.PI * 2 * 3.17) * T.breathe * idle;
    const brr = Math.sin(now * 0.95 * Math.PI) * T.breatheRot * D2R * idle;
    // jump: lag on vy; landing spring (k, d)
    this.jumpY = damp(this.jumpY, clamp(-(pl.vy || 0) * T.jumpK, -T.jumpMax, T.jumpMax), 14, dt);
    // hurt jolt: y + roll springs (ω hurtW, ζ hurtZ); both sub-stepped (stable at any frame rate) and bounded
    const L = this.land, H = this.hurtS, w = T.hurtW, z = T.hurtZ;
    if (!frozen) {
      const n = subN(dt), h = dt / n;
      for (let i = 0; i < n; i++) {
        L.v += (-T.landK * L.y - T.landD * L.v) * h; L.y += L.v * h;
        H.v += (-w * w * H.y - 2 * z * w * H.v) * h; H.y += H.v * h; H.rv += (-w * w * H.r - 2 * z * w * H.rv) * h; H.r += H.rv * h;
      }
      if (!Number.isFinite(L.y + L.v + H.y + H.v + H.r + H.rv)) { L.y = L.v = 0; H.y = H.v = H.r = H.rv = 0; }
      L.y = clamp(L.y, -0.15, 0.15); H.y = clamp(H.y, -0.2, 0.2); H.r = clamp(H.r, -0.5, 0.5);
    }
    // dizzy roll
    const dz = mode === 'dizzy' ? Ease.inOutSine(clamp((pl.dizzyT || 0) / T.dizzyT, 0, 1)) : 0;
    const m = motion;
    const hm = 0.5 + 0.5 * m;   // state jolts stay half-strength under Motion comfort; the procedural sway goes
    lay.p.set(sw.x * m + bx * m, sw.yv * m + by * m + br + this.jumpY * m + L.y * m + H.y * hm, this.fwd * T.pushBack * m);
    lay.p.add(_v.set(T.dashPos[0], T.dashPos[1], T.dashPos[2]).multiplyScalar(dashK));
    _e.set(sw.p * m + brr + dashK * T.dashRot * D2R - H.y * 2 * hm, sw.y * m, -this.lat * T.strafeRoll * D2R * m + H.r * hm - dz * T.dizzyRoll * D2R, 'YXZ');
    lay.q.setFromEuler(_e);
    // a bad value anywhere upstream (a broken tunable, a NaN field from another package) must not blank the hands
    // for the rest of the session: drop the motion state and show the plain pose
    if (!fin3(lay.p) || !Number.isFinite(lay.q.x + lay.q.y + lay.q.z + lay.q.w)) this.resetMotion();
    return lay;
  },
  /** write a pose (+ the layer transform and the lowering) to an arm's two bones */
  place(arm, pose, lay, low) {
    const [fore, hand] = arm.bones, piv = lay.pivot;
    _v.copy(pose.P).sub(piv).applyQuaternion(lay.q).add(piv).add(lay.p);
    _v.y -= low * T.lowerY;
    _q.copy(lay.q).multiply(pose.Q);
    if (low > 0) _q.premultiply(_q2.setFromAxisAngle(_w.set(1, 0, 0), -low * T.lowerRot));
    hand.position.copy(_v); hand.quaternion.copy(_q);
    // wrist: a fixed point of the hand frame; the forearm starts there
    fore.position.copy(_u.set(T.wrist[0] * arm.side, T.wrist[1], T.wrist[2]).applyQuaternion(_q).add(_v));
    fore.quaternion.copy(lay.q).multiply(pose.F);
    if (low > 0) fore.quaternion.premultiply(_q2);
  },

  // ------------------------------------------------------------------ item-get, seed, potion bits
  /** r2 part 3: FP dialogue — the lowered blade's tip stays talkGap NDC under the dialogue box's top edge (it rose from the
   *  box into the speaker's beard at 1024×768 and onto his staff at 1280×720; the vm camera's fixed vFOV brings it toward
   *  the middle on narrower screens), so the hand sinks behind / below the box */
  talkDrop(ui, tR) {
    const el = ui.dlg && ui.dlgEl, H = this.game.renderer.domElement.clientHeight || innerHeight;
    if (!el || !(H > 0)) return;
    const r = el.getBoundingClientRect();
    if (!(r.height > 0)) return;
    this.tipUnder(tR, 1 - (2 * r.top) / H - T.talkGap);
  },
  /** drop the paw so the blade tip sits at or under NDC y = yb (talk: the box's top; r4 boss intro: introTipY) */
  tipUnder(tR, yb) {
    const th = Math.tan((this.camera.fov * D2R) / 2);
    this.bladePt(_v, tR, 1);
    const need = _v.y - yb * th * -_v.z;
    if (need > 0) tR.P.y -= need;
  },
  /** keep the presented item (and the paws under it) above the dialogue box: on a phone in landscape the box covers
   *  the lower half of the screen. Lift (NDC y) eased, applied to the paws here and to the item in updateItem */
  liftItem(ui, dt, tR, tL) {
    let want = 0;
    const el = ui.dlg && ui.dlgEl, H = this.game.renderer.domElement.clientHeight || innerHeight;
    if (el && H > 0) {
      const r = el.getBoundingClientRect(), th = Math.tan((this.camera.fov * D2R) / 2), n = T.itemNdc;
      if (r.height > 0) want = clamp(1 - (2 * r.top) / H + (T.itemS * 0.5) / (th * n[2]) + 0.05 - n[1], 0, 0.6);
    }
    this.itemLift = this.itemLift == null ? want : damp(this.itemLift, want, 10, dt);
    const th = Math.tan((this.camera.fov * D2R) / 2);
    for (const p of [tR.P, tL.P]) p.y += this.itemLift * th * -p.z;
  },
  updateItem(itemK, raysK, now, dt, frozen, lay, low) {
    const it = this.item, has = it.children.length > 0;
    it.visible = has && itemK > 0.01;
    this.rays.visible = has && raysK > 0.02;
    if (!it.visible) return;
    const t = now - (this.ev.item ?? now);
    _v.copy(this.itemPos);
    _v.y += (this.itemLift || 0) * Math.tan((this.camera.fov * D2R) / 2) * T.itemNdc[2];
    _v.sub(lay.pivot).applyQuaternion(lay.q).add(lay.pivot).add(lay.p);
    _v.y += -(1 - itemK) * 0.32 - low * T.lowerY + Math.sin(t * 2.2) * 0.006;
    it.position.copy(_v);
    // the item's front (+Z) faces the eye: a gentle sway, never a full turn
    it.quaternion.copy(lay.q).multiply(_q.setFromEuler(_e.set(0.12 + Math.sin(t * 1.3) * 0.05, Math.sin(t * 0.8) * 0.45, Math.sin(t * 2.1) * 0.06, 'YXZ')));
    const r = this.rays;
    r.position.copy(it.position).add(_w.set(0, 0, -0.12));
    r.scale.setScalar(T.raysS * (0.9 + 0.1 * Math.sin(t * 3)));
    r.rotation.set(0, 0, t * 0.2);
    r.material.uniforms.uK.value = raysK * T.raysK;
    // sparkles around the item over the raise
    const ev = this.ev;
    if (ev.itemSparks > 0 && t > 0.2) {
      for (let i = 0; i < 3 && ev.itemSparks > 0; i++, ev.itemSparks--) {
        const a = rnd() * Math.PI * 2, rr = 0.07 + rnd() * 0.08;
        this.sparks.add(it.position.x + Math.cos(a) * rr, it.position.y + Math.sin(a) * rr, it.position.z + 0.02, { cell: 'sparkle_4', color: rnd() < 0.5 ? 0xfff4a0 : 0xffffff, size: 0.018 + rnd() * 0.014, life: 0.7 + rnd() * 0.5, vx: Math.cos(a) * 0.05, vy: Math.sin(a) * 0.05 + 0.02, spin: 1.5 });
      }
    }
  },
  /** seed placing: the presenting paw holds the next seed until it flies (cutscene c.cur) */
  updateSeed(c, holding, right) {
    const s = this.seed, arm = right ? this.armR : this.armL, id = c.queue && c.queue[0];
    if (!holding || !id) { s.visible = false; return; }
    if (s.userData.id !== id) {
      s.clear();
      const m = inkLast(meshWithOutline(seedBuilt(SEEDS[id].color), this.itemMat, this.ol, { cast: false }));
      m.scale.setScalar(0.18); m.traverse((o) => { o.frustumCulled = false; });
      s.add(m); s.userData.id = id;
    }
    if (s.parent !== arm.bones[1]) arm.bones[1].add(s);
    s.visible = true;
    s.position.set(-arm.side * 0.05, 0.075, 0.0);
    // front toward the eye: undo the hand's rotation (bone quaternion is camera-space)
    s.quaternion.copy(arm.bones[1].quaternion).invert();
  },
  cork() {
    const L = this.armL.bones[1];
    _v.set(0.05, 0.11, 0).applyQuaternion(L.quaternion).add(L.position);
    this.sparks.add(_v.x, _v.y, _v.z, { cell: 'sparkle_4', color: 0xc08a50, size: 0.025, life: 0.45, vx: 0.15, vy: 0.5, g: 2.2, spin: 6 });
  },
  hearts() {
    // 6 pink hearts rising from the bottom edge in screen space (vm space at a fixed depth)
    const d = 0.3, th = Math.tan((this.camera.fov * D2R) / 2), tw = th * this.camera.aspect;
    for (let i = 0; i < 6; i++) {
      const x = (-0.55 + rnd() * 0.9) * tw * d, y = -0.95 * th * d;
      this.sparks.add(x, y, -d, { cell: 'heart', color: 0xff9fb6, size: 0.016 + rnd() * 0.01, life: 0.9 + rnd() * 0.4, vy: 0.10 + rnd() * 0.06, vx: (rnd() - 0.5) * 0.02, rot: (rnd() - 0.5) * 0.4 });
    }
  },
  updateFx(sw, swinging, now, dt, frozen, lay, low) {
    const tr = this.trail;
    if (swinging && sw && !sw.clink) {
      const kind = sw.kind, [s0, s1] = kind === 'C' ? TC.sweepC : TC.sweepAB, t1 = sw.tVis, t0 = sw.tLast;
      const end = s1 + (kind === 'C' ? 0.03 : T.follow);
      if (t1 > t0 && t1 > s0 * 0.7 && t0 < end) {
        const n = T.trailSub;
        for (let i = 1; i <= n; i++) {
          const t = t0 + ((t1 - t0) * i) / n;
          if (t < s0 * 0.7 || t > end) continue;
          this.swingPose(this.tmp2, kind, t);
          this.xform(this.bladePt(_v, this.tmp2, T.trailFrom), lay, low);
          this.xform(this.bladePt(_w, this.tmp2, 1), lay, low);
          tr.push(_v, _w);
        }
      }
      // shiny: 3 glints along the blade during the slash
      if (sw.shiny && sw.glints < 3 && t1 > s0 + (s1 - s0) * sw.glints / 3) {
        sw.glints++;
        this.swingPose(this.tmp2, kind, t1);
        this.xform(this.bladePt(_v, this.tmp2, 0.5 + rnd() * 0.5), lay, low);
        this.sparks.add(_v.x, _v.y, _v.z, { cell: 'sparkle_4', color: 0xffe27a, size: 0.03, life: 0.35, spin: 4 });
      }
      sw.tLast = t1;
    }
    tr.update(dt, frozen);
    // shiny blade: a glint every 0.35 s somewhere on the blade
    const pl = this.game.player;
    if (pl.swordLevel >= 2 && this.swords[1].visible) {
      this.glintT = (this.glintT || 0) + dt;
      if (this.glintT > T.sparkleEvery) {
        this.glintT = 0;
        const h = this.hand;
        _v.set(0, (0.12 + rnd() * 0.5) * T.swordS, 0.015).applyQuaternion(h.quaternion).add(h.position);
        this.sparks.add(_v.x, _v.y, _v.z, { cell: 'sparkle_4', color: 0xfff4a0, size: 0.022, life: 0.4, spin: 3 });
      }
    }
    const c = this.camera, bh = this.game.renderer.getDrawingBufferSize(_u).y;
    this.sparks.update(dt, bh / (2 * Math.tan((c.fov * D2R) / 2)), frozen);
  },
  /** a camera-space point through the layer transform and the lowering (as place() does for the hand) */
  xform(p, lay, low) { p.sub(lay.pivot).applyQuaternion(lay.q).add(lay.pivot).add(lay.p); p.y -= low * T.lowerY; return p; },

  // ------------------------------------------------------------------ lights
  updateLights() {
    const g = this.game, sky = g.sky, mc = g.camera, c = this.camera;
    // canopy / building shade: one ray from the eye toward the sun (arch §6.1); eased
    this.shade = damp(this.shade, this.sunBlocked(mc.position, sky.sunDir) ? T.shadeSun : 1, 8, Math.min(0.1, g.clock.dt || 0.016));
    const sh = this.shade, shH = lerp(T.shadeHemi, 1, (sh - T.shadeSun) / (1 - T.shadeSun));
    this.hemi.color.copy(sky.hemi.color); this.hemi.groundColor.copy(sky.hemi.groundColor); this.hemi.intensity = sky.hemi.intensity * shH;
    this.sun.color.copy(sky.sun.color); this.sun.intensity = sky.sun.intensity * T.sunK * sh;
    // the key keeps the sun's direction, biased toward a view-space upper-left key so the hands are never backlit flat
    _v.set(T.keyView[0], T.keyView[1], T.keyView[2]).normalize().applyQuaternion(c.quaternion);
    this.sun.position.copy(sky.sunDir).multiplyScalar(1 - T.keyBias).addScaledVector(_v, T.keyBias).normalize();
    const L = sky.lampLights[0];
    this.lamp.intensity = L ? L.intensity : 0;
    if (L) { this.lamp.color.copy(L.color); this.lamp.position.copy(L.position).sub(mc.position); }
    // Pip's glow sits 0.72 m over the eye and lights the ground 1.6–3 m away; at that true offset it would light the
    // hands from ~1 m at full strength (brighter than noon). Keep its direction, move it out to glowDist from the hand
    const P = sky.pipLight;
    _v.copy(this.hand.position).applyQuaternion(c.quaternion);
    this.glow.color.copy(P.color); this.glow.intensity = P.intensity;
    this.glow.position.copy(P.position).sub(mc.position).sub(_v).normalize().multiplyScalar(T.glowDist).add(_v);
    // the two point lights only exist at night (both light sets are compiled at attach, so the switch never hitches):
    // by day they are black but would still cost every hand pixel two light loops
    this.lamp.visible = this.glow.visible = (sky.night || 0) > 0.01 || this.lamp.intensity > 0.001;
    this.ol.uniforms.uNightK.value = sky.night || 0;   // ink a little lighter at night, like the world's outlines
  },
  /** is the sun hidden from the eye by a nearby tree canopy, the Great Tree or a house? (proxies: canopy spheres,
   *  building cylinders; ~2 µs) */
  sunBlocked(eye, sd) {
    const W = this.game.world;
    if (!W || !W.nearColliders || sd.y <= 0.05) return false;
    const list = W.nearColliders(eye.x, eye.z, T.shadeR, this._near || (this._near = []));
    const hit = (cx, cy, cz, r) => {
      const ox = cx - eye.x, oy = cy - eye.y, oz = cz - eye.z, b = ox * sd.x + oy * sd.y + oz * sd.z;
      if (b < 0) return false;
      return ox * ox + oy * oy + oz * oz - b * b < r * r;
    };
    for (const c of list) {
      const s = (c.prop && c.prop.s) || 1, y0 = c.y0 ?? W.hAt(c.x, c.z);
      if (c.kind === 'tree_round' && hit(c.x, y0 + 3.4 * s, c.z, 1.9 * s)) return true;
      if ((c.kind === 'tree_pine' || c.kind === 'tree_snow') && hit(c.x, y0 + 3.0 * s, c.z, 1.7 * s)) return true;
      if (c.kind === 'tree_palm' && hit(c.x, y0 + 4.8 * s, c.z, 2.0 * s)) return true;
      if (c.kind === 'house' || c.kind === 'tree') {
        // vertical cylinder [y0, y1] of radius 0.9 r: where the ray passes its axis distance, is it below the top?
        const ox = c.x - eye.x, oz = c.z - eye.z, h = Math.hypot(sd.x, sd.z) || 1e-6, b = (ox * sd.x + oz * sd.z) / h;
        if (b < 0) continue;
        const perp = Math.sqrt(Math.max(0, ox * ox + oz * oz - b * b)), r = c.r * (c.kind === 'tree' ? 0.6 : 0.9);
        if (perp > r) continue;
        const enter = Math.max(0, b - Math.sqrt(r * r - perp * perp)), yAt = eye.y + (enter / h) * sd.y, top = c.y1 ?? y0 + 4.5;
        if (yAt < top) return true;
      }
    }
    // the Great Tree's crown (WP9 may publish W.greatTree.height; the built tree's height otherwise)
    const GT = W.greatTree, sc = this.game.scenery && this.game.scenery.greatTree;
    if (GT) {
      const h = GT.height || (sc && sc.height) || 9;
      if (hit(GT.x, (GT.y ?? W.hAt(GT.x, GT.z)) + h * 0.7, GT.z, h * 0.42)) return true;
    }
    return false;
  },

  // ------------------------------------------------------------------ pass
  afterRender(r) {
    if (!this.visible || this.game.state !== 'play') return;
    const t0 = performance.now(), info = r.info.render, c0 = info.calls, tr0 = info.triangles, gt = this.game.gpuT;
    const ac = r.autoClear, su = r.shadowMap.autoUpdate;
    r.autoClear = false; r.shadowMap.autoUpdate = false;   // never re-render shadow maps for the vm pass
    if (gt) gt.begin('vm');
    try { r.clearDepth(); r.render(this.scene, this.camera); } finally { r.autoClear = ac; r.shadowMap.autoUpdate = su; }
    if (gt) gt.end('vm');
    const s = this.stats;
    s.calls = info.calls - c0; s.tris = info.triangles - tr0; s.cpuMs = performance.now() - t0; s.frames++;
  },

  // ------------------------------------------------------------------ debug
  /** projected NDC of the blade tip / hands / item; a geometric frame check for an aspect (tests) */
  ndc(p) { return _u.copy(p).applyMatrix4(this.camera.projectionMatrix); },
  info() {
    const g = this.game, pl = g.player, sw = this.swords[pl.swordLevel >= 2 ? 1 : 0], vis = this.visible && g.state === 'play';
    let tip = null, grip = null, item = null;
    if (vis) {
      this.scene.updateMatrixWorld(true);
      _v.set(0, 0.66, 0).applyMatrix4(sw.matrixWorld).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
      tip = [+_v.x.toFixed(3), +_v.y.toFixed(3)];
      _v.copy(this.hand.position).applyMatrix4(this.camera.projectionMatrix);
      grip = [+_v.x.toFixed(3), +_v.y.toFixed(3)];
      if (this.item.visible) { _v.copy(this.item.position).applyMatrix4(this.camera.projectionMatrix); item = [+_v.x.toFixed(3), +_v.y.toFixed(3)]; }
    }
    const e = new THREE.Euler().setFromQuaternion(this.hand.quaternion, 'YXZ'), sw2 = this.sw;
    return {
      visible: vis, low: +this.low.toFixed(3), mode: vis ? this.mode : 'hidden',
      state: !vis ? 'hidden' : sw2 && pl.state === 'attack' && pl.swingId === sw2.id ? 'swing' : this.mode === 'rest' ? 'rest' : this.mode,
      kind: sw2 ? sw2.kind : null, swingId: sw2 ? sw2.id : null, tVis: sw2 ? +sw2.tVis.toFixed(4) : null, contactT: sw2 && sw2.contactT != null ? +sw2.contactT.toFixed(4) : null,
      hand: this.hand.position.toArray().map((x) => +x.toFixed(4)), rot: [e.x, e.y, e.z].map((x) => +(x / D2R).toFixed(2)), tip, grip, item,
      left: this.armL.visible, handR: this.handR, handL: this.handL, sword: this.swords[0].visible || this.swords[1].visible,
      shade: +this.shade.toFixed(3), flash: +this.mat.userData.flash.value.toFixed(2), boots: +this.boots.k.toFixed(3),
      calls: this.stats.calls, tris: this.stats.tris, cpuMs: +this.stats.cpuMs.toFixed(3), fov: +this.camera.fov.toFixed(2),
    };
  },
  /** geometric composition check for an aspect without resizing the page: the rest pose's blade samples, fist and tip in
   *  screen fractions (x from the left, y from the top) through a temporary vm camera */
  frameCheck(aspect) {
    const cam = new THREE.PerspectiveCamera(vmFovFor(aspect), aspect, 0.01, 5);
    cam.updateProjectionMatrix();
    const keep = this.aspect;
    this.layout(aspect);
    const p = this.rest, pts = [];
    for (let i = 0; i <= 20; i++) { this.bladePt(_v, p, 0.12 + (0.88 * i) / 20).applyMatrix4(cam.projectionMatrix); pts.push([_v.x * 0.5 + 0.5, 0.5 - _v.y * 0.5]); }
    _v.copy(p.P).applyMatrix4(cam.projectionMatrix);
    const fist = [_v.x * 0.5 + 0.5, 0.5 - _v.y * 0.5];
    _v.copy(this.itemPos).applyMatrix4(cam.projectionMatrix);
    const item = [_v.x, _v.y];
    // the leaf-green sleeve's start (its axis 0.075 m up the forearm from the wrist), as place() puts the forearm
    _v.set(T.wrist[0], T.wrist[1], T.wrist[2]).applyQuaternion(p.Q).add(p.P).add(_w.set(0, 0.075, 0).applyQuaternion(p.F)).applyMatrix4(cam.projectionMatrix);
    const sleeve = [_v.x * 0.5 + 0.5, 0.5 - _v.y * 0.5];
    this.layout(keep);
    const inBox = pts.filter(([x, y]) => x >= 0.4 && x <= 0.6 && y >= 0.38 && y <= 0.62).length;
    return { aspect: +aspect.toFixed(3), fov: +cam.fov.toFixed(2), tip: pts[20].map((x) => +x.toFixed(3)), fist: fist.map((x) => +x.toFixed(3)), sleeve: sleeve.map((x) => +x.toFixed(3)), inBox, item: item.map((x) => +x.toFixed(3)) };
  },
};
export default vm;
