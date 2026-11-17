// Cinematics (arch §4.8, feel §9.3 / §12, art §10–§11).
// Shots: one active shot with a priority and a token. The blend is position lerp + orientation slerp + FOV lerp against
// the live gameplay pose, eased in-out, so a shot never pops in or out; a moving shot updates its pose every frame
// (move), a shot that starts exactly at the camera can snap in (snapIn) and then travel (the ending crane).
// Cine (WP1, driven by feel.js): the per-mode staging that is not a cutscene of its own:
// - eyelids (Lids, our own overlay just above the fade): new-game wake-up, respawn, after the ending card;
// - dialogue framing (EV.TALK_START / TALK_END): FP eases onto the speaker's face (42 % from the top, inside soft look
//   limits ±25° / ±15°, FOV −6) and, when the speaker is too close, the eye backs off; TP a two-shot picked from
//   candidates that keep the speaker's face in sight (beside the pair, raised, nearer, over Pip's shoulder for a far
//   speaker), fitted above the dialogue box;
// - item-get (EV.ITEM_GET / ITEM_DONE): FP FOV −8 in the eye; TP a front 3/4 shot;
// - boss intros (EV.BOSS_INTRO / BOSS_FIGHT): FP in the eye (fight.js tracks the boss) + FOV −10 and a stomp punch; TP a
//   moving over-the-shoulder push-in that replaces fight.js's static shot; both hand back facing the boss;
// - dizzy / death (EV.DOWN / RESPAWN): FP wobble → topple (roll, eye sink, look to the sky) → hold; TP pivot drop + slow
//   orbit; motion comfort: no roll / wobble / orbit, a gentle sink. Then the eyelids close; respawn wakes up looking up.
// Every cinematic hands control back with the hand-back rule (look set to the subject first, then a blend: no pop).
// TP shot FOVs are stored like the view's (horizontal degrees at 16:9, Hor+ with the narrow-screen rule of vFovFor), and
// every TP shot is fitted (fitShot): the camera backs off along its own ray (or, when something is in the way, the FOV
// widens) until its subjects sit inside the frame, so a far speaker or a portrait phone never leaves Pip out.
import * as THREE from 'three';
import { EV } from '../events.js';
import { sfx } from '../core.js';
import { view as T } from '../tune.js';
import { Ease, clamp, damp, lerp, angDiff, wrapAngle, yawOf, fwdXZ, rightXZ, dir3, LAYER } from '../util.js';
import { anchors } from '../cutscenes.js';
import { vFovFor } from './view.js';

const D2R = Math.PI / 180;
const _m = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _x = new THREE.Vector3();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _ip = new THREE.Vector3(), _il = new THREE.Vector3();
const _fit = { pos: new THREE.Vector3(), fov: 0, k: 1 };
const _pts = [];
const _po = { terrain: true, water: true, decks: true, colliders: true };
const _po2 = { terrain: true, water: false, decks: false, colliders: true, ignore: null };
const _fitT = { pos: new THREE.Vector3(), fov: 0, k: 1, look: new THREE.Vector3() };
const _fitU = { pos: new THREE.Vector3(), fov: 0, k: 1 };
const _fc = new THREE.Vector3(), _hd = new THREE.Vector3();
// TP two-shot candidates (Cine.twoShot): side s (−1: Pip on the left), h m higher, d × talk.shotDist, ots (over Pip's
// shoulder; for a speaker nearer than talk.otsDist it costs talk.otsNear more: the fallback that keeps Pip on the left
// when the side shots are blocked, as at Miso's counter); cost: how much a clear shot must win by to be taken over the
// plain one
const TWO_SHOTS = [
  { s: -1, h: 0, d: 1, cost: 0 }, { s: 1, h: 0, d: 1, cost: 0 },
  { s: -1, h: 0.9, d: 1, cost: 0.35 }, { s: 1, h: 0.9, d: 1, cost: 0.35 },
  { s: -1, h: 0.3, d: 0.7, cost: 0.45 }, { s: 1, h: 0.3, d: 0.7, cost: 0.45 },
  { s: -1, h: 0, d: 1, ots: true, cost: 0.2 }, { s: -1, h: 0.8, d: 1, ots: true, cost: 0.5 },
];

export class Shots {
  constructor() {
    this.cur = null;        // active shot { token, pos, quat, fov, speed, cut, priority }
    this.last = null;       // shot being blended out
    this.w = 0;             // linear blend weight 0..1
    this.k = 0;             // eased weight
    this.outSpeed = 1.8;
    this.seq = 0;
    this.from = null;       // shot → shot: the camera pose the new shot blends from
    this.x = 0;
    this.mix = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: null };
  }
  /** o: { pos, look | quat, fov (vertical deg, optional), speed = 1.4, cut = false, priority = 1, snapIn = false } → token
   *  (0 = refused). cam: the current rendered pose { pos, quat, fov }; a shot replacing a visible one blends from it */
  set(o, cam = null) {
    if (this.cur && (o.priority ?? 1) < this.cur.priority) return 0;
    const pos = o.pos.clone();
    const quat = o.quat ? o.quat.clone() : new THREE.Quaternion().setFromRotationMatrix(_m.lookAt(pos, o.look, UP));
    this.from = null;
    if (this.w > 0.02 && cam && !o.cut && !o.snapIn) { this.from = { pos: cam.pos.clone(), quat: cam.quat.clone(), fov: cam.fov }; this.x = 0; this.w = 1; }
    this.cur = { token: ++this.seq, pos, quat, fov: o.fov ?? null, speed: o.speed ?? 1.4, cut: !!o.cut, priority: o.priority ?? 1 };
    this.last = this.cur;
    if (this.cur.cut || o.snapIn) this.w = 1;
    return this.cur.token;
  }
  /** move the active shot (token) to a new pose: pos, look (point) or quat, fov; stale tokens are ignored */
  move(token, pos, look = null, quat = null, fov) {
    const c = this.cur;
    if (!c || c.token !== token) return false;
    c.pos.copy(pos);
    if (quat) c.quat.copy(quat); else if (look) c.quat.setFromRotationMatrix(_m.lookAt(c.pos, look, UP));
    if (fov !== undefined) c.fov = fov;
    return true;
  }
  /** stale tokens are ignored; no token clears whatever is active */
  clear(token, speed = 1.8) {
    if (!this.cur || (token != null && token !== this.cur.token)) return false;
    this.cur = null;
    this.outSpeed = speed;
    return true;
  }
  /** advances the blend (in: 1/(0.6·speed) s, out: 1/(0.8·speed) s); returns the eased weight */
  update(dt) {
    if (this.cur) this.w = Math.min(1, this.w + dt * this.cur.speed * 0.6);
    else this.w = Math.max(0, this.w - dt * this.outSpeed * 0.8);
    if (this.w <= 0) { this.last = null; this.from = null; }
    if (this.from) { this.x = Math.min(1, this.x + dt * (this.cur ? this.cur.speed : this.outSpeed) * 0.6); if (this.x >= 1) this.from = null; }
    this.k = Ease.inOutSine(this.w);
    return this.k;
  }
  /** the shot pose to blend toward (mid shot → shot transition: the eased mix of the two) */
  get pose() {
    const p = this.cur || this.last;
    if (!p || !this.from) return p;
    const e = Ease.inOutSine(this.x), m = this.mix;
    m.pos.lerpVectors(this.from.pos, p.pos, e);
    m.quat.slerpQuaternions(this.from.quat, p.quat, e);
    m.fov = p.fov != null && this.from.fov != null ? this.from.fov + (p.fov - this.from.fov) * e : p.fov;
    return m;
  }
  reset() { this.cur = this.last = this.from = null; this.w = this.k = 0; }
}

/** blend speeds for Shots from seconds: in = 1/(0.6·s), out = 1/(0.8·s) */
export const shotIn = (sec) => 1 / (0.6 * Math.max(0.05, sec));
export const shotOut = (sec) => 1 / (0.8 * Math.max(0.05, sec));

/** eyelids: two rounded #2a1a12 panels (the fade's colour) over the world, our own element inserted right after the
 *  crosshair (above the fade, the HUD, the dialogue, the title and the crosshair; under the veil, the loading screen,
 *  menus and touch controls). r2: they sat under the crosshair, whose target ring floated on the closed lids when the
 *  ending's blink-back reset the crane shot under them. k: 0 open … 1 closed */
export class Lids {
  constructor(ui) {
    this.k = 0; this.seq = []; this.cb = null;
    const root = (this.el = document.createElement('div'));
    root.id = 'wp1-eyelids';
    root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none';
    const mk = (top) => {
      const p = document.createElement('div');
      p.style.cssText = `position:absolute;left:-12%;width:124%;height:66%;${top ? 'top:0' : 'bottom:0'};background:#2a1a12;` +
        (top ? 'border-radius:0 0 50% 50% / 0 0 42% 42%;box-shadow:0 8px 22px rgba(42,26,18,0.55)' : 'border-radius:50% 50% 0 0 / 42% 42% 0 0;box-shadow:0 -8px 22px rgba(42,26,18,0.55)') +
        ';will-change:transform';
      root.appendChild(p);
      return p;
    };
    this.top = mk(true); this.bot = mk(false);
    try {
      const R = ui && ui.root;
      const at = ui && ((ui.crossEl && ui.crossEl.parentNode === R && ui.crossEl) || (ui.fadeEl && ui.fadeEl.parentNode === R && ui.fadeEl));
      if (R) { if (at) R.insertBefore(root, at.nextSibling); else R.appendChild(root); }
    } catch (e) { /* no DOM: headless test */ }
    this.apply();
  }
  apply() {
    const k = clamp(this.k, 0, 1);
    this.el.style.display = k > 0.001 ? '' : 'none';
    this.top.style.transform = `translateY(${(-(1 - k) * 105).toFixed(2)}%)`;
    this.bot.style.transform = `translateY(${((1 - k) * 105).toFixed(2)}%)`;
  }
  /** instant */
  set(k) { this.seq.length = 0; this.k = clamp(+k || 0, 0, 1); this.apply(); return this.k; }
  /** a list of [k, seconds, ease] legs; cb when it finishes */
  play(legs, cb = null) { this.seq = legs.map(([k, d, e]) => ({ k0: null, k, d: Math.max(1e-3, d), e: e || Ease.inOutSine, t: 0 })); this.cb = cb; }
  /** wake-up: open, a sleepy half blink, open (art §11) */
  wake(cb) { const E = T.eyelids; sfx('eyelid', { vol: 0.7 }); this.play([[0, E.open, Ease.outCubic], [E.halfK, E.half, Ease.inOutSine], [0, E.reopen, Ease.outCubic]], cb); }
  close(cb, dur = T.eyelids.close) { sfx('eyelid', { vol: 0.5, rate: 0.85 }); this.play([[1, dur, Ease.inOutSine]], cb); }
  blink(cb) { this.play([[1, 0.18, Ease.inOutSine], [1, 0.12], [0, 0.35, Ease.outCubic]], cb); }
  get busy() { return this.seq.length > 0; }
  update(dt) {
    const s = this.seq[0];
    if (!s) return;
    if (s.k0 == null) s.k0 = this.k;
    s.t += dt;
    const u = clamp(s.t / s.d, 0, 1);
    this.k = lerp(s.k0, s.k, s.e(u));
    if (u >= 1) { this.seq.shift(); if (!this.seq.length && this.cb) { const f = this.cb; this.cb = null; f(); } }
    this.apply();
  }
}

export class Cine {
  constructor(feel) {
    this.feel = feel;
    this.lids = new Lids(feel.game.ui);
    this.talk = null; this.pendTalk = null;
    this.item = null; this.intro = null; this.dizzy = null; this.wake = null; this.waking = null;
    this.limit = null;              // dialogue soft limits { yaw, pitch, hy, hp }
    this.back = 0; this.backWant = 0; this.backDir = { x: 0, z: 0 };
    this.tpDrop = 0;
  }
  get game() { return this.feel.game; }
  get view() { return this.feel.view; }
  listen(E) {
    E.on(EV.TALK_START, (p) => { if (p && p.npc) this.pendTalk = { npc: p.npc, intro: !!this.waking }; });
    E.on(EV.TALK_END, (p) => this.endTalk(p && p.npc));
    E.on(EV.ITEM_GET, (p) => this.startItem(p));
    E.on(EV.ITEM_DONE, (p) => this.endItem(p));
    E.on(EV.BOSS_INTRO, (p) => this.startIntro(p));
    E.on(EV.BOSS_FIGHT, () => this.endIntro(true));
    E.on(EV.FIGHT_END, () => this.endIntro(false));
    E.on(EV.CUTSCENE_END, (p) => { if (p && p.type === 'bossIntro') this.endIntro(!!(this.game.fight && this.game.fight.phase === 'fight')); });
    E.on(EV.DOWN, () => this.startDizzy());
    E.on(EV.RESPAWN, () => this.respawn());
  }
  // ------------------------------------------------------------------ session / title / modal
  onSession(isNew) {
    this.talk = this.pendTalk = this.item = this.intro = this.dizzy = this.wake = null;
    this.limit = null; this.back = this.backWant = 0; this.tpDrop = 0; this.feel.view.tp.pivotDrop = 0;
    this.waking = null;
    if (isNew) {
      // new game: eyes closed under the fade, looking up into the Great Tree's crown; they open as the fade clears and the
      // intro talk then eases the view down to Shellby (TALK_START, introDur)
      this.lids.set(1);
      const a = this.anchors(), pl = this.game.player, view = this.view;
      const yaw = Math.hypot(a.tree.x - pl.pos.x, a.tree.z - pl.pos.z) > 0.5 ? yawOf(a.tree.x - pl.pos.x, a.tree.z - pl.pos.z) : view.yaw;
      view.setLook(yaw, T.wake.pitch * D2R);
      view.snap();
      this.waking = { t: 0, open: false };
    } else this.lids.set(0);
  }
  /** view.snap(): offsets that ease (eye back-off) jump to their targets */
  snapped() { this.back = this.talk && this.talk.mode === 'fp' ? this.backWant : 0; }
  onTitle() { this.onSession(false); this.lids.set(0); }
  onModal() {}
  /** world anchors (C6: W.pedestal / W.greatTree / W.shots, with today's fields as fallbacks; cutscenes.js) */
  anchors() { return anchors(this.game); }
  // ------------------------------------------------------------------ helpers
  /** a camera position for a shot: start at `from`, head for `to`; pulled in to just short of the first thing in the way
   *  (terrain, water, decks, colliders) → out (Vector3); returns the clear fraction */
  safe(from, to, out, r = 0.25) {
    const W = this.game.world;
    let t = 1;
    if (W.probeSegment) t = W.probeSegment(from, to, r, _po);
    const k = t >= 1 ? 1 : Math.max(0, t - 0.04);
    out.lerpVectors(from, to, k);
    const f = W.hAt(out.x, out.z) + 0.3;
    if (out.y < f) out.y = f;
    return k;
  }
  /** vertical FOV (deg) of a TP shot whose FOV is stored as horizontal degrees at 16:9 (the view's Hor+ rule) */
  shotFov(hDeg) { return vFovFor(hDeg, this.game.camera.aspect || 16 / 9); }
  /** fit a shot to its subjects: the camera at `cam` looking at `look` backs off along that ray (up to maxD from the look
   *  point) until every point of pts (flat [x, y, z, …]) sits inside ±mx (NDC x) and ±my (NDC y) at vertical FOV v (deg);
   *  then safe() (from `from`) keeps it out of terrain and colliders, and if that pulled it in, the FOV widens just enough
   *  (≤ vMax, default T.fitVMax). → out { pos, fov (vertical deg), k (clear fraction) } */
  fitShot(look, cam, pts, v, mx, my, maxD, from, out, vMax = T.fitVMax) {
    const asp = this.game.camera.aspect || 16 / 9;
    _f.subVectors(look, cam);
    const D0 = _f.length() || 1;
    _f.multiplyScalar(1 / D0);
    _r.crossVectors(_f, UP);
    if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
    _r.normalize(); _u.crossVectors(_r, _f);
    const tV = Math.tan((v * D2R) / 2), tH = tV * asp;
    let D = D0;
    for (let i = 0; i < pts.length; i += 3) {
      _x.set(pts[i] - look.x, pts[i + 1] - look.y, pts[i + 2] - look.z);
      const a = Math.abs(_x.dot(_r)), c = Math.abs(_x.dot(_u)), b = _x.dot(_f);
      D = Math.max(D, a / (mx * tH) - b, c / (my * tV) - b);
    }
    D = Math.min(D, Math.max(D0, maxD));
    _x.copy(look).addScaledVector(_f, -D);
    out.k = this.safe(from, _x, out.pos);
    // what the camera got (blocked: closer): the FOV that still holds every subject
    _x.subVectors(look, out.pos);
    const Da = Math.max(0.3, _x.dot(_f));
    let tv = tV;
    for (let i = 0; i < pts.length; i += 3) {
      _x.set(pts[i] - look.x, pts[i + 1] - look.y, pts[i + 2] - look.z);
      const z = _x.dot(_f) + Da;
      if (z > 0.2) tv = Math.max(tv, Math.abs(_x.dot(_r)) / (mx * z * asp), Math.abs(_x.dot(_u)) / (my * z));
    }
    out.fov = Math.min(Math.max(v, (2 * Math.atan(tv)) / D2R), Math.max(v, vMax));
    return out;
  }
  /** a fitted shot that is no shot (r2): the camera ended within talk.minLook of its look point (pulled in through a
   *  counter), or a subject (flat pts) sits behind it or within talk.minDepth of it */
  badShot(pos, look, pts) {
    _f.subVectors(look, pos);
    const L = _f.length();
    if (L < T.talk.minLook) return true;
    _f.multiplyScalar(1 / L);
    for (let i = 0; i < pts.length; i += 3) if ((pts[i] - pos.x) * _f.x + (pts[i + 1] - pos.y) * _f.y + (pts[i + 2] - pos.z) * _f.z < T.talk.minDepth) return true;
    return false;
  }
  /** look yaw / pitch that put a world point under the crosshair: FP from the eye, TP through the rig's crosshair ray */
  aimLook(x, y, z, maxPitch = 1.2) {
    const view = this.view, pl = this.game.player, p = pl.pos;
    if (view.mode !== 'tp') { const e = view.simEye(_a), dx = x - e.x, dz = z - e.z; return { yaw: yawOf(dx, dz), pitch: clamp(Math.atan2(y - e.y, Math.hypot(dx, dz)), -maxPitch, maxPitch) }; }
    const side = T.tpShoulder * view.shoulderSide(), ph = view.tp.pivotH(view.shoulderSide());
    let yaw = yawOf(x - p.x, z - p.z), pitch = 0;
    for (let i = 0; i < 6; i++) {
      const r = rightXZ(yaw); dir3(yaw, pitch, _b);
      const cx = p.x + r.x * side - _b.x * view.tp.boom, cy = p.y + ph - _b.y * view.tp.boom, cz = p.z + r.z * side - _b.z * view.tp.boom;
      yaw = yawOf(x - cx, z - cz); pitch = clamp(Math.atan2(y - cy, Math.hypot(x - cx, z - cz)), T.pitchTPDown * D2R, Math.min(maxPitch, T.pitchTPUp * D2R));
    }
    return { yaw, pitch };
  }
  setShot(o) { return this.view.setShot(o); }
  /** context FOV channel (vertical degrees, eased λ 4 by FeelFP): FP in-eye cinematics narrow the view a little */
  ctxFov() {
    const g = this.game, fp = this.view.mode === 'fp', C = T.ctx;
    let c = 0;
    if (!fp) return 0;
    if (this.talk) c = Math.min(c, C.talk);
    if (this.item) c = Math.min(c, C.item);
    if (this.intro && g.fight && g.fight.phase === 'intro') c = Math.min(c, C.intro);
    const cs = g.cutscene;
    if (cs && cs.type === 'place') c = Math.min(c, C.place);
    if (cs && cs.type === 'ending' && !cs.shot) c = C.ending;     // looking up the trunk: a little wider sells the height
    return c;
  }
  // ------------------------------------------------------------------ per frame
  frameInput(dt) {
    if (this.pendTalk) { const p = this.pendTalk; this.pendTalk = null; this.startTalk(p.npc, p.intro); }
  }
  beforeCamera(alpha, dt) {
    const g = this.game, view = this.view;
    this.lids.update(dt);
    // new-game wake-up: the lids open as the fade clears
    if (this.waking) {
      const w = this.waking, tr = g.trans;
      w.t += dt;
      if (!w.open && (!tr || (tr.phase === 'in' && tr.t >= 0.25) || w.t > 2)) { w.open = true; this.lids.wake(); }
      if (w.t > 4) this.waking = null;
    }
    // respawn: closed under the fade, open when it clears, then the look eases down from the tree
    if (this.wake) {
      const w = this.wake, tr = g.trans;
      w.t += dt;
      if (!w.open && (!tr || (tr.phase === 'in' && tr.t >= 0.2) || w.t > 3)) {
        w.open = true;
        this.lids.wake();
        const e = view.simEye(_a), f = fwdXZ(view.yaw), pt = g.defaultPitch ? g.defaultPitch() : 0;
        view.faceTo(e.x + f.x * 10, e.y + Math.tan(pt) * 10, e.z + f.z * 10, { dur: T.wake.respawnEase });
      }
      if (w.open && !this.lids.busy) this.wake = null;
    }
    // dizzy: lids close when the respawn fade starts
    if (this.dizzy && g.trans && !this.dizzy.closing) { this.dizzy.closing = true; this.lids.close(); }
    this.updateTalk(dt);
    this.updateItem(dt);
    this.updateIntro(dt);
    // the cutscene's moving parts (ending crane, flying seeds) move per render frame, not per fixed step (no stair-steps
    // above 60 Hz); the world being paused (pause menu, shop) holds them
    if (g.cutscene && g.renderCutscene) g.renderCutscene(alpha, (g.ui.menu && g.ui.menu !== 'ending') || g.ui.shop ? 0 : dt);
  }
  /** pose offsets (inside view.update's pose mods): dialogue eye back-off, dizzy cams */
  pose(M, fpW, tpW, dt, frozen) {
    const view = this.view, C = this.feel.comfort;
    // dialogue: the eye backs away from a speaker who stands too close (camera only; Pip stays put)
    if (!frozen) {
      const want = this.talk && this.talk.mode === 'fp' ? this.backWant : 0;
      this.back = damp(this.back, want, want > this.back ? 3 / T.talk.backIn : 3 / T.talk.backOut, dt);
      if (!want && this.back < 1e-3) this.back = 0;
    }
    if (this.back > 0) { M.eye.x -= this.backDir.x * this.back * fpW; M.eye.z -= this.backDir.z * this.back * fpW; }
    // dizzy / death (ends with the player's dizzy state, whatever ended it: respawn, a reset, a test)
    if (this.dizzy && this.game.player.state !== 'dizzy') { this.dizzy = null; if (!this.wake) this.lids.set(0); }
    const d = this.dizzy, Z = T.dizzy;
    let drop = 0;
    if (d) {
      if (!frozen) d.t += dt;
      const t = d.t, full = C.motion && C.roll;
      if (fpW > 0) {
        if (full) {
          const wob = Z.wobble * Math.sin(2 * Math.PI * Z.wobbleHz * t) * (1 - clamp((t - 0.15) / 0.15, 0, 1));
          const k = Ease.inCubic(clamp((t - 0.25) / 0.75, 0, 1));
          const bounce = t > 1 && t < 1.15 ? 0.04 * Math.sin((Math.PI * (t - 1)) / 0.15) : 0;
          const drift = t > 1.15 ? Z.drift * (t - 1.15) : 0;
          M.yaw += (wob + drift * d.dir) * D2R * fpW;
          M.roll += Z.roll * d.dir * k * D2R * fpW;
          M.eye.y += (-(T.eyeH - Z.eye) * k + bounce) * fpW;
          M.pitch += (Z.pitch * D2R - view.pitch) * k * fpW;
        } else {
          const k = Ease.inOutSine(clamp(t / 0.9, 0, 1));
          M.eye.y -= (T.eyeH - Z.eyeComfort) * k * fpW;
          M.pitch += (8 * D2R - view.pitch) * k * fpW;
        }
      }
      if (tpW > 0 && C.motion) {
        drop = Z.tpDrop * Ease.inOutSine(clamp(t / 0.8, 0, 1));
        if (!frozen && view.blend >= 1) view.yaw = wrapAngle(view.yaw + (Z.tpOrbit / 1.9) * D2R * dt * d.dir);
      }
    }
    this.tpDrop = drop;
    view.tp.pivotDrop = drop;
  }
  /** dialogue soft limits (FP): beyond ±yaw / ±pitch of the speaker, outward look is damped and the view springs back */
  look(L) {
    const lim = this.limit, view = this.view;
    if (!lim || view.blend >= 0.5) return;
    const idle = !L.mouse && !L.touch && !(L.pad > 0.05), k = 1 - Math.exp(-T.talk.spring * L.dt);
    const soft = (cur, d, center, half, wrap) => {
      const offOf = (v) => (wrap ? angDiff(center, v) : v - center);
      let off = offOf(cur + d);
      if (Math.abs(off) <= half) return d;
      const s = Math.sign(off);
      if (!idle && Math.sign(d) === s) { d *= 0.25; off = offOf(cur + d); }   // resistance past the edge
      if (idle) { d -= s * (Math.abs(off) - half) * k; off = offOf(cur + d); } // spring back to the edge
      const cap = half * 1.8;                                                  // never lose the speaker
      if (Math.abs(off) > cap) d -= s * (Math.abs(off) - cap);
      return d;
    };
    L.dyaw = soft(view.yaw, L.dyaw, lim.yaw, lim.hy, true);
    L.dpitch = soft(view.pitch, L.dpitch, lim.pitch, lim.hp, false);
  }
  // ------------------------------------------------------------------ dialogue (C14)
  npcFace(npc, out = _c) { return out.set(npc.pos.x, npc.pos.y + (npc.hop || 0) + T.talk.faceK * (npc.height || 1.2), npc.pos.z); }
  /** where the speaker's face goes (fraction of the height from the top): talk.faceAt, or higher when the open dialogue
   *  box (layout top, minus its name tab; transforms ignored) leaves less room above it (WP6 owns the box) */
  faceAt() {
    const K = T.talk, ui = this.game.ui, el = ui && ui.dlgEl, R = ui && ui.root;
    try {
      const H = (R && R.clientHeight) || window.innerHeight;
      if (!el || !H || !el.offsetHeight) return K.faceAt;
      const free = (el.offsetTop - K.nameTab) / H;
      return free > 0.2 ? clamp(Math.min(K.faceAt, K.faceFree * free), 0.15, K.faceAt) : K.faceAt;
    } catch (e) { return K.faceAt; }
  }
  startTalk(npc, intro = false) {
    if (!npc) return;
    const view = this.view;
    this.talk = { npc, t: 0, mode: view.mode, shot: 0, intro };
    if (view.mode === 'fp') this.fpTalk(intro); else this.tpTalk();
  }
  /** FP dialogue framing. The speaker's face is taken where the speaker will stand: WP5's talk back-hop (a speaker
   *  closer than TUNE.actors.npcBackHop hops away from Pip) is still running when the talk starts, and framed from the
   *  start distance the eye backed off for a distance the hop then added to (Ribbit at 0.8 m: 1.95 m eye ↔ face, the face
   *  at 0.45 H instead of 0.42). r2: the hop's end point is used, and while it runs the framing is redone each frame
   *  (retarget: the look assist follows, the limits and the eye back-off update) */
  fpTalk(intro, retarget = false) {
    const g = this.game, view = this.view, tk = this.talk, npc = tk.npc, C = this.feel.comfort, K = T.talk;
    if (tk.shot) { view.clearShot(tk.shot, { speed: shotOut(K.shotIn) }); tk.shot = 0; }
    tk.mode = 'fp';
    const e = view.simEye(_a), face = this.npcFace(npc, _b), hop = npc.backHop;
    face.y -= npc.hop || 0;                  // the face at rest (the greeting hop lands again within ≈ 0.4 s)
    tk.hopping = !!(hop && hop.left > 0);
    if (tk.hopping) { face.x += hop.x * hop.left; face.z += hop.z * hop.left; }
    let dx = face.x - e.x, dz = face.z - e.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    dx /= d; dz /= d;
    // back off when the speaker is too close (camera only), never into a wall
    let back = clamp(K.near - d, 0, K.back);
    if (back > 0.02 && g.world.probeSegment) {
      _d.set(e.x - dx * back, e.y, e.z - dz * back);
      const t = g.world.probeSegment(e, _d, 0.15, _po);
      back = t >= 1 ? back : Math.max(0, back * t - 0.05);
    }
    this.backWant = back; this.backDir.x = dx; this.backDir.z = dz;
    // pitch: the face sits faceAt from the top of the (narrowed) frame, above the dialogue box (on a short landscape phone
    // the box owns half the screen: the face then sits at faceFree of the free band above it)
    const vf = Math.max(30, view.fovV + T.ctx.talk) * D2R;
    const lift = Math.atan((0.5 - this.faceAt()) * 2 * Math.tan(vf / 2));
    const pitch = clamp(Math.atan2(face.y - e.y, d + back) - lift, -0.6, 0.6), yaw = yawOf(dx, dz);
    this.limit = { yaw, pitch, hy: K.yaw * D2R, hp: K.pitch * D2R };
    if (!C.lookAt) return;
    if (retarget) { if (view.assist) view.retarget(e.x + dx * d, e.y + Math.tan(pitch) * d, e.z + dz * d); }
    else view.faceTo(e.x + dx * d, e.y + Math.tan(pitch) * d, e.z + dz * d, { dur: intro ? K.introDur : K.dur });
  }
  /** NDC y of the open dialogue box's top (its name tab included), or null (WP6 owns the box; transforms ignored) */
  boxTopNdc() {
    const ui = this.game.ui, el = ui && ui.dlgEl, R = ui && ui.root;
    try {
      const H = (R && R.clientHeight) || window.innerHeight;
      if (!el || !H || !el.offsetHeight) return null;
      return 1 - (2 * Math.max(0, el.offsetTop - T.talk.nameTab)) / H;
    } catch (e) { return null; }
  }
  /** r4: the line from a shot camera at `pos` to the point q passes through Pip (feet P): within talk.pipR of his axis,
   *  between his feet and talk.pipTop, and between the camera and q */
  pipHides(pos, q, P) {
    const K = T.talk, dx = q.x - pos.x, dz = q.z - pos.z, L2 = dx * dx + dz * dz;
    if (L2 < 1e-6) return false;
    const k = ((P.x - pos.x) * dx + (P.z - pos.z) * dz) / L2;
    if (k <= 0 || k >= 1) return false;
    const y = pos.y + (q.y - pos.y) * k;
    return Math.hypot(pos.x + dx * k - P.x, pos.z + dz * k - P.z) < K.pipR && y > P.y && y < P.y + K.pipTop;
  }
  /** a shot camera at `pos` sees the point q (its own collider and the subject's are ignored: near = their positions) */
  sees(pos, q, nearA, nearB) {
    const W = this.game.world;
    if (!W.probeSegment) return true;
    // (a collider standing where a subject stands is its own body: the NPC's, a chair it sits on)
    const own = (c, q) => (W.colliderDist ? W.colliderDist(c, q.x, q.z) : Math.hypot(c.x - q.x, c.z - q.z) - (c.r || 0)) < 0.12;
    _po2.ignore = (c) => own(c, nearA) || own(c, nearB);
    _x.subVectors(q, pos);
    const L = _x.length();
    if (L < 0.4) return true;
    _p1.copy(pos).addScaledVector(_x, (L - 0.3) / L);
    return W.probeSegment(pos, _p1, 0.06, _po2) >= 1;
  }
  /** TP two-shot (art §10): Pip on the left, the speaker on the right with a 3/4 face; fitted so both stay inside
   *  ±talk.fitX (Pip ≥ 0.18 W from the edge) and vertically inside the free band above the dialogue box (a phone's box
   *  owns a third of the screen: the shot tilts down so the subjects sit above it). Candidates — beside the pair on
   *  either side, raised, nearer, and for a speaker more than talk.otsDist away an over-the-shoulder shot from behind
   *  Pip — are scored once (at the start of the talk, or when the chosen one loses sight of the speaker): the speaker's
   *  face and Pip's head must be in the camera's sight (W.probeSegment: the pedestal hid Shellby in the intro; r4: and the
   *  face clear of Pip himself, pipHides — over his shoulder from Shellby's altar side his head covered her face), then
   *  the preferred side, then the plain side shot. The chosen one is re-fitted every frame → out { pos, fov }; returns
   *  the look point */
  twoShot(out, pick = false) {
    const g = this.game, pl = g.player, tk = this.talk, npc = tk.npc, K = T.talk;
    const P = pl.root.position, N = npc.root ? npc.root.position : npc.pos;
    let ux = N.x - P.x, uz = N.z - P.z;
    const l = Math.hypot(ux, uz) || 1;
    ux /= l; uz /= l;
    const mx = (P.x + N.x) / 2, mz = (P.z + N.z) / 2, gy = Math.max(P.y, N.y), nh = npc.height || 1.2, ny = N.y + (npc.hop || 0);
    // subjects: Pip's head and chest, the speaker's face and head top
    const pts = _pts;
    pts.length = 0;
    pts.push(P.x, P.y + 0.95, P.z, P.x, P.y + 0.5, P.z, N.x, ny + T.talk.faceK * nh, N.z, N.x, ny + nh, N.z);
    const v = this.shotFov(K.shotFovH), ca = Math.cos(K.shotAngle * D2R), sa = Math.sin(K.shotAngle * D2R);
    // a dialogue shot widens at most to the TP view's FOV (r2: up to fitVMax 100°, a fish-eyed close-up of Pip's face)
    const vMax = Math.max(v, K.fovMaxV);
    // vertical band: the subjects keep above the dialogue box (≥ talk.bandMin NDC tall, else they may sink behind it)
    const bt = this.boxTopNdc(), hi = K.fitY, lo = bt == null ? -K.fitY : Math.min(hi - K.bandMin, Math.max(-K.fitY, bt + 0.04));
    const myH = (hi - lo) / 2, yc = (hi + lo) / 2;
    const face = _fc.set(N.x, ny + T.talk.faceK * nh, N.z), head = _hd.set(P.x, P.y + 0.95, P.z);
    const pose = (c, o) => {
      // c: { s (side), h (m higher), d (× distance), ots }; o: { pos, fov, look (Vector3) } (fitted, tilted for the band)
      const look = o.look;
      if (c.ots) {
        // behind Pip, off his right (he stands on the left), looking past him to the speaker
        const rx = -uz, rz = ux;
        look.set(P.x + ux * l * 0.62, gy + K.shotLook + (ny + T.talk.faceK * nh - gy - K.shotLook) * 0.5, P.z + uz * l * 0.62);
        _a.set(P.x - ux * K.otsBack + rx * K.otsSide, P.y + K.otsH + c.h, P.z - uz * K.otsBack + rz * K.otsSide);
      } else {
        look.set(mx + ux * 0.25, gy + K.shotLook, mz + uz * 0.25);
        // n: camera side. Looking back at M from M + n·dist, the camera's right is −u·s, so s = −1 puts Pip on the left
        // third and the speaker on the right; swung shotAngle toward Pip's back, so the speaker shows a 3/4 face
        const nx = uz * c.s * ca - ux * sa, nz = -ux * c.s * ca - uz * sa;
        _a.set(mx + nx * K.shotDist * c.d, gy + K.shotH + c.h, mz + nz * K.shotDist * c.d);
      }
      let r = this.fitShot(look, _a, pts, v, K.fitX, myH, K.shotMax, look, o, vMax);
      if (r.k < 0.5) {
        // the look point stands in a prop (r2: Miso's counter — every side shot was pulled in to it and widened to 100°):
        // keep the camera out of colliders from Pip's head instead, when that keeps more of the shot
        const r2 = this.fitShot(look, _a, pts, v, K.fitX, myH, K.shotMax, head, _fitU, vMax);
        if (r2.k > r.k + 0.05) { o.pos.copy(r2.pos); o.fov = r2.fov; o.k = r2.k; r = o; }
      }
      // tilt down so the band's middle (not the screen's) holds the subjects
      if (Math.abs(yc) > 1e-3) {
        _f.subVectors(look, r.pos); const L = _f.length() || 1; _f.multiplyScalar(1 / L);
        _r.crossVectors(_f, UP).normalize(); _x.crossVectors(_r, _f);
        const th = Math.atan(yc * Math.tan((r.fov * D2R) / 2));
        _f.multiplyScalar(Math.cos(th)).addScaledVector(_x, -Math.sin(th));
        look.copy(r.pos).addScaledVector(_f, L);
      }
      return r;
    };
    const C = TWO_SHOTS;
    if (pick || tk.pick == null) {
      let best = -1, bestS = -Infinity;
      for (let i = 0; i < C.length; i++) {
        const c = C[i];
        const r = pose(c, _fitT);
        // r4: the face must also clear Pip himself (an over-the-shoulder shot from his altar side put his head, sprout and
        // sword over Elder Shellby's face; colliders only were tested)
        const sf = this.sees(r.pos, face, N, P) && !this.pipHides(r.pos, face, P), sp = this.sees(r.pos, head, P, N);
        // r2: a shot whose camera ended in the subjects is out (badShot); Pip on the left (the side shot from his back's
        // side, or over his shoulder) is worth talk.leftBonus, so a blocked preferred side goes over the shoulder before
        // it flips (Pip right of the speaker at Ribbit, 4 m)
        const cost = c.cost + (c.ots && l < K.otsDist ? K.otsNear : 0);
        const score = (sf ? 3 : 0) + (sp ? 1.5 : 0) + r.k + (c.s === -1 ? K.leftBonus : 0) + (tk.pick === i ? 0.4 : 0) - cost - Math.max(0, r.fov - v) / 25 - (this.badShot(r.pos, _fitT.look, pts) ? 20 : 0);
        if (score > bestS) { bestS = score; best = i; }
      }
      tk.pick = best;
    }
    const c = C[tk.pick], r = pose(c, _fitT);
    tk.side = c.s;
    out.pos.copy(r.pos); out.fov = r.fov;
    tk.sight = this.sees(r.pos, face, N, P);
    return _fitT.look;
  }
  tpTalk() {
    const tk = this.talk, K = T.talk;
    tk.mode = 'tp'; this.limit = null; this.backWant = 0;
    const o = this._ts || (this._ts = { pos: new THREE.Vector3(), fov: 0 }), look = this.twoShot(o, true);
    tk.shot = this.setShot({ pos: o.pos, look, fov: o.fov, speed: shotIn(K.shotIn), priority: 1 });
  }
  updateTalk(dt) {
    const tk = this.talk;
    if (!tk) return;
    tk.t += dt;
    const view = this.view;
    if (view.mode !== tk.mode) { if (view.mode === 'fp') this.fpTalk(false); else this.tpTalk(); }
    else if (tk.mode === 'fp' && tk.hopping) this.fpTalk(false, true);   // the speaker's back-hop is still running
    if (tk.mode === 'tp' && tk.shot) {
      const o = this._ts;
      let look = this.twoShot(o);
      if (!tk.sight && (tk.repick = (tk.repick || 0) + dt) > 0.5) { tk.repick = 0; look = this.twoShot(o, true); }
      view.shots.move(tk.shot, o.pos, look, null, o.fov);
    }
  }
  endTalk(npc) {
    if (this.pendTalk && (!npc || this.pendTalk.npc === npc)) this.pendTalk = null;
    if (this.waking && this.talk && this.talk.intro) this.waking = null;      // the wake-up ends with its first talk
    const tk = this.talk;
    if (!tk || (npc && tk.npc !== npc)) return;
    this.talk = null; this.limit = null; this.backWant = 0;
    if (tk.shot) {
      // hand back: look from Pip toward the speaker at the default TP pitch, then blend 0.45 s to the TP pose
      const g = this.game, P = g.player.pos, N = tk.npc.pos;
      this.view.setLook(yawOf(N.x - P.x, N.z - P.z), g.defaultPitch ? g.defaultPitch() : T.tpPitch * D2R);
      this.view.clearShot(tk.shot, { speed: shotOut(T.talk.shotIn) });
    }
  }
  // ------------------------------------------------------------------ item-get (C13)
  startItem(ev) {
    this.item = { ev, t: 0, shot: 0 };
    if (this.view.mode === 'tp') this.itemShot();
  }
  itemShot() {
    const g = this.game, pl = g.player, K = T.item, it = this.item;
    const P = pl.root.position, f = fwdXZ(pl.facing), r = rightXZ(pl.facing);
    const look = _d.set(P.x, P.y + K.look, P.z);
    _a.set(P.x + f.x * K.fwd + r.x * K.side, P.y + K.h, P.z + f.z * K.fwd + r.z * K.side);
    const pts = _pts;
    pts.length = 0;
    pts.push(P.x, P.y + 1.35, P.z, P.x, P.y + 0.05, P.z);          // Pip with the item raised over his head
    const o = this.fitShot(look, _a, pts, this.shotFov(K.fovH), 0.8, 0.85, K.fwd + 1.5, _c.set(P.x, P.y + 1.0, P.z), _fit);
    it.shot = this.setShot({ pos: o.pos, look, fov: o.fov, speed: shotIn(K.inT), priority: 1 });
  }
  updateItem(dt) {
    const it = this.item;
    if (!it) return;
    it.t += dt;
    const view = this.view;
    if (view.mode === 'tp' && !it.shot) this.itemShot();
    else if (view.mode === 'fp' && it.shot) { view.clearShot(it.shot, { speed: shotOut(T.item.inT) }); it.shot = 0; }
    if (this.game.player.state !== 'item' && it.t > 0.5 && !this.game.ui.dlg) this.endItem(it.ev);
  }
  endItem(ev) {
    const it = this.item;
    if (!it || (ev && it.ev !== ev)) return;
    this.item = null;
    if (it.shot) this.view.clearShot(it.shot, { speed: shotOut(T.item.inT) });
  }
  // ------------------------------------------------------------------ boss intro (C15)
  bossFace(b) { return { x: b.pos.x, y: (b.arena ? b.arena.h : b.pos.y) + (b.height || 3) * 0.45, z: b.pos.z }; }
  startIntro(p) {
    const b = p && p.boss;
    if (!b) return;
    this.intro = { id: p.id, boss: b, t: 0, shot: 0, punched: false, fpAssist: false };
    // TP: our moving over-the-shoulder push-in replaces fight.js's static shot (same priority); FP stays in the eye,
    // where fight.js tracks the boss with a locked look assist
    if (this.view.mode === 'tp') this.introShot(true);
  }
  /** the push-in pose → out { pos, fov }; look (Vector3) = the boss face. On a narrow screen the shoulder offset shrinks
   *  (Pip stays beside the boss, not off the left edge), then the shot is fitted to Pip */
  introPose(out, look) {
    const g = this.game, I = T.intro, it = this.intro, b = it.boss, P = g.player.root.position;
    let ux = b.pos.x - P.x, uz = b.pos.z - P.z;
    const l = Math.hypot(ux, uz) || 1;
    ux /= l; uz /= l;
    const rx = -uz, rz = ux, push = I.push * Ease.inOutSine(clamp(it.t / 2.0, 0, 1)), back = I.back - push;   // right of u
    const v = this.shotFov(I.fovH), tH = Math.tan((v * D2R) / 2) * (g.camera.aspect || 16 / 9);
    const lat = Math.min(I.lateral, I.fitX * 0.9 * tH * back);
    _a.set(P.x - ux * back + rx * lat, P.y + I.h, P.z - uz * back + rz * lat);
    look.set(b.pos.x, (b.arena ? b.arena.h : b.pos.y) + (b.height || 3) * I.look, b.pos.z);
    const pts = _pts;
    pts.length = 0;
    pts.push(P.x, P.y + 0.95, P.z, P.x, P.y + 0.45, P.z);
    return this.fitShot(look, _a, pts, v, I.fitX, 0.9, 0, _b.set(P.x + rx * 0.3, P.y + I.h, P.z + rz * 0.3), out);
  }
  introShot(start) {
    const it = this.intro, view = this.view, o = this.introPose(_fit, _il);
    if (start || !it.shot) it.shot = this.setShot({ pos: o.pos, look: _il, fov: o.fov, speed: shotIn(T.intro.inT), priority: 2 });
    else view.shots.move(it.shot, o.pos, _il, null, o.fov);
  }
  updateIntro(dt) {
    const it = this.intro, g = this.game, view = this.view;
    if (!it) return;
    const f = g.fight;
    if (!f || f.boss !== it.boss || f.phase !== 'intro') return;
    if (!g.ui.menu && !g.ui.shop) it.t += dt;
    // the stomp / roar beat: a small FOV punch (speed effects; none under motion comfort)
    if (!it.punched && it.t >= 0.6) { it.punched = true; if (view.mode === 'fp') this.feel.fovPunch(T.intro.fovPunch, 0.08, 0.1, 0.45); }
    if (view.mode === 'tp') this.introShot(false);
    else if (it.shot) {
      // switched to FP mid-intro: back into the eye, tracking the boss for the rest of the intro only (fight.js's own FP
      // tracking does not run: its shot token went stale when ours replaced it), and endIntro hands back from it
      const face = this.bossFace(it.boss);
      view.clearShot(it.shot, { speed: shotOut(0.35) }); it.shot = 0; it.fpAssist = true;
      view.faceTo(face.x, face.y, face.z, { dur: 0.35, lock: true, hold: Math.max(0, T.intro.len - f.t) });
    }
    if (it.fpAssist && view.mode === 'fp' && view.assist) { const face = this.bossFace(it.boss); view.retarget(face.x, face.y, face.z); }
  }
  /** hand back (BOSS_FIGHT): TP aims the crosshair at the boss first, then blends out to the (lock) pose; after a switch
   *  to FP mid-intro the look snaps onto the face it has been tracking, which also ends our locked look assist */
  endIntro(fight) {
    const it = this.intro;
    if (!it) return;
    this.intro = null;
    const view = this.view, b = it.boss;
    if (it.shot) {
      if (fight && b && !b.dying) {
        const face = this.bossFace(b), L = this.aimLook(face.x, face.y, face.z, 20 * D2R);
        view.setLook(L.yaw, clamp(L.pitch, -20 * D2R, 20 * D2R));
        view.clearShot(it.shot, { speed: shotOut(T.intro.outT) });
      } else view.clearShot(it.shot, { speed: shotOut(0.4) });
    } else if (it.fpAssist) {
      if (fight && b && !b.dying && view.mode === 'fp') { const face = this.bossFace(b); view.lookAtPoint(face.x, face.y, face.z, 0.6); }
      else view.setLook(view.yaw, view.pitch);
    }
  }
  // ------------------------------------------------------------------ dizzy / death, respawn
  startDizzy() {
    const C = this.feel.comfort;
    this.dizzy = { t: 0, dir: Math.random() < 0.5 ? -1 : 1, closing: false };
    this.talk = null; this.limit = null; this.backWant = 0;
    if (this.view.mode === 'tp' && C.motion) this.view.shake(0.67);
  }
  respawn() {
    this.dizzy = null; this.tpDrop = 0; this.view.tp.pivotDrop = 0;
    const view = this.view;
    this.lids.set(1);
    view.setLook(view.yaw, T.wake.respawnPitch * D2R);    // under the fade: wake up looking up at the tree
    this.wake = { t: 0, open: false };
  }
  // ------------------------------------------------------------------ debug: TP framing measurement
  /** renders Pip's body layer alone off-screen from the live camera and measures his framing (fractions of the screen,
   *  from the top-left): { pipTop, pipBottom, pipH, pipLeft, pipRight, pipCx, clearM (crosshair ray → Pip, metres at
   *  his depth), depth, camH (camera above the feet), horizonY, armLen } */
  framing({ w = 320, h = 180 } = {}) {
    const g = this.game, r = g.renderer, cam = g.camera, scene = g.scene, pl = g.player;
    const rt = this._rt && this._rt.width === w && this._rt.height === h ? this._rt : (this._rt = new THREE.WebGLRenderTarget(w, h));
    const white = this._white || (this._white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    const mask = cam.layers.mask, ov = scene.overrideMaterial, bg = scene.background, fog = scene.fog;
    const prevRT = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), au = r.shadowMap.autoUpdate;
    const buf = new Uint8Array(w * h * 4);
    try {
      cam.layers.set(LAYER.BODY);
      scene.overrideMaterial = white; scene.background = null; scene.fog = null; r.shadowMap.autoUpdate = false;
      r.setRenderTarget(rt); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, cam);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    } finally {
      cam.layers.mask = mask; scene.overrideMaterial = ov; scene.background = bg; scene.fog = fog; r.shadowMap.autoUpdate = au;
      r.setRenderTarget(prevRT); r.setClearColor(cc, ca);
    }
    // view-space depth of Pip's chest
    _a.set(pl.root.position.x, pl.root.position.y + 0.5, pl.root.position.z).applyMatrix4(cam.matrixWorldInverse);
    const depth = -_a.z, tv = Math.tan((cam.fov * D2R) / 2), th = tv * cam.aspect;
    let top = h, bot = -1, left = w, right = -1, sx = 0, n = 0, clear = Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (buf[(y * w + x) * 4] < 128) continue;
      const yy = h - 1 - y;                      // readPixels rows are bottom-up
      n++; sx += x; if (yy < top) top = yy; if (yy > bot) bot = yy; if (x < left) left = x; if (x > right) right = x;
      const nx = ((x + 0.5) / w) * 2 - 1, ny = 1 - ((yy + 0.5) / h) * 2;
      const m = Math.hypot(nx * th, ny * tv) * depth;
      if (m < clear) clear = m;
    }
    _b.setFromMatrixColumn(cam.matrixWorld, 2);
    const camPitch = Math.asin(clamp(-_b.y, -1, 1));
    const f = (v, d = 4) => +(+v).toFixed(d);
    return {
      pixels: n, pipTop: n ? f(top / h) : null, pipBottom: n ? f((bot + 1) / h) : null, pipH: n ? f((bot + 1 - top) / h) : 0,
      pipLeft: n ? f(left / w) : null, pipRight: n ? f((right + 1) / w) : null, pipCx: n ? f(sx / n / w) : null,
      clearM: n ? f(clear, 3) : null, depth: f(depth, 3), camH: f(cam.position.y - pl.root.position.y, 3),
      horizonY: f(0.5 + (0.5 * Math.tan(camPitch)) / tv), armLen: f(this.view.armLen, 3), fovV: f(cam.fov, 2),
    };
  }
  info() {
    return { talk: this.talk ? { npc: this.talk.npc.id, mode: this.talk.mode, shot: this.talk.shot, intro: this.talk.intro } : null, limit: this.limit ? { yaw: +(this.limit.yaw / D2R).toFixed(2), pitch: +(this.limit.pitch / D2R).toFixed(2) } : null, back: +this.back.toFixed(3), item: !!this.item, intro: this.intro ? { id: this.intro.id, shot: this.intro.shot, t: +this.intro.t.toFixed(3) } : null, dizzy: this.dizzy ? +this.dizzy.t.toFixed(3) : null, lids: +this.lids.k.toFixed(3), waking: !!this.waking, wake: !!this.wake };
  }
}
