// Pedestal + tree seeds, seed placement cutscene, ending (Game mixin). Staging by WP1, FP first (art §11, feel §12):
// - place: FP in the eye: the view eases onto the altar (locked), FOV −6, each seed leaves Pip's hand and arcs into its
//   socket; TP: a shot from beside the altar (W.shots.place when the world provides one); hand back facing the pedestal.
// - ending: FP looks up the trunk (+35°, a wider FOV) from the eye, the tree blooms, then the camera leaves the eye and
//   cranes up and around to look at the crown (to W.shots.endingCrane when given), the ending card; on close the eyelids
//   blink and you are back at the altar facing the tree. (W.shots.ending, WP9's ground-level look-up, is not used: the
//   look-up stays in the eye in FP and beside Pip in TP.)
// Every position comes from the world's anchors (C6: W.pedestal { x, z, y, top, sockets? }, W.greatTree { x, z, y,
// height }, W.shots.{ place, endingCrane }) with today's fields as the fallback, never from literals; a cutscene reads them once.
// The moving parts (a seed's flight, the crane) advance in the sim but are posed per render frame (renderCutscene, called
// by the wp1-feel module before the camera): the seed from its interpolated flight time, the crane from render time.
// - handover (S-005, story.md #I.2 'handover-woods'): a Catcher's first win ends with it sitting down (bosses.js); this
//   cutscene runs the script's steps in order (HANDOVER_STEPS, so S-034 can port it to the scene runner): wide shot,
//   the sit, a two shot over Pip's shoulder, its lines with the Starseed held out, the pov hand-back, the calm flags and
//   the shipped seed item-get. Skippable (G.debug.scene.skip, or {interact} held 0.8 s) to the same save state.
import * as THREE from 'three';
import { sfx, music } from './core.js';
import { SEED_ORDER, SEEDS, BOSSES, HANDOVER, progress } from './data.js';
import { toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { seedBuilt } from './models.js';
import { rand, pick, Ease, clamp, lerp, yawOf, wrapAngle, angDiff, dampAngle, fwdXZ, rightXZ } from './util.js';
import { EV } from './events.js';
import { view as TV } from './tune.js';
import { STEP } from './clock.js';

const D2R = Math.PI / 180;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();

/** world anchors for the cinematics (C6), with today's fields as fallbacks */
export function anchors(game) {
  const W = game.world, gt = (game.scenery && game.scenery.greatTree) || {};
  const P = W.pedestal || { x: 0, z: 0 }, Tr = W.greatTree || { x: 0, z: 0 };
  const pedY = Number.isFinite(P.y) ? P.y : W.plaza ? W.plaza.h : W.ground(P.x, P.z);
  const treeY = Number.isFinite(Tr.y) ? Tr.y : W.ground(Tr.x, Tr.z);
  const height = Tr.height ?? gt.height ?? 9;
  return {
    ped: { x: P.x, z: P.z, y: pedY, top: P.top ?? 1.1, sockets: Array.isArray(P.sockets) ? P.sockets : null },
    tree: { x: Tr.x, z: Tr.z, y: treeY, height },
    shots: W.shots || {},
  };
}
/** socket i (0…2) of the pedestal: the world's when it has them, else a row across the altar top; the seed sits
 *  place.seat lower (set into the socket, not standing on the slab) */
function socket(A, i, out) {
  const s = A.ped.sockets && A.ped.sockets[i];
  if (s && Number.isFinite(s.x)) return out.set(s.x, (s.y ?? A.ped.y + A.ped.top) + TV.place.seat, s.z);
  return out.set(A.ped.x + (i - 1) * 0.58, A.ped.y + A.ped.top + TV.place.seat, A.ped.z + 0.05);
}
/** the handover's staging (S-005): the wide shot from `wide` m back toward Pip and `wideUp` m up; the two shot over Pip's
 *  shoulder (`twoBack` m behind him, `twoUp` m up, `twoSide` m to his right); the seed held out `seedOut` m in front of
 *  the Catcher at `seedH` m over its floor, risen over `seedT` s; Use held `skipHold` s skips */
const HO = { sit: 1.0, wide: 6, wideUp: 3, wideIn: 0.6, wideFovH: 62, two: 2.4, twoUp: 1.4, twoSide: 0.55, twoIn: 0.5, twoFovH: 56, povOut: 0.4, seedOut: 0.6, seedH: 1.4, seedT: 0.6, skipHold: 0.8 };
/** the handover script's step names, in order (story.md #I.2 'handover-woods'); c.step is the index of the running one */
export const HANDOVER_STEPS = ['wide', 'sit', 'two', 'say12', 'holdOut', 'say3', 'pov', 'flags', 'item'];
const shotPose = (s) => (s && Array.isArray(s.pos) && Array.isArray(s.look) ? { pos: new THREE.Vector3(...s.pos), look: new THREE.Vector3(...s.look) } : null);

export const CutsceneMixin = {
  /** render-time bob of the pedestal seeds and the bloomed tree's seeds */
  animateSeeds(t) {
    this.pedSeeds.forEach((g, i) => { g.rotation.set(-0.5, Math.sin(t * 1.2 + i) * 0.6, 0, 'YXZ'); g.position.y = g.userData.y0 + 0.05 + Math.sin(t * 2 + i) * 0.08; });
    this.treeSeeds.forEach((g, i) => { g.rotation.set(-0.3, Math.sin(t + i) * 0.5, 0, 'YXZ'); });
  },
  treeSeedsWanted() { const t = this.scenery.greatTree; return !(t && t.glb && t.glb.b); },
  buildPedestalSeeds() {
    const W = this.world, A = anchors(this);
    const mat = toonMat({ glow: true, rim: 1.5 });
    this.pedSeeds = SEED_ORDER.map((id, i) => {
      const g = meshWithOutline(seedBuilt(SEEDS[id].color), mat, sharedOutline('char'));
      socket(A, i, g.position);
      g.userData.y0 = g.position.y;
      g.scale.setScalar(TV.place.seedScale);   // jewels set in the altar (1.1 hid the tree's face from the eye)
      g.visible = false;
      this.scene.add(g);
      return g;
    });
    // seeds hanging in the bloomed tree
    this.treeSeeds = SEED_ORDER.map((id, i) => {
      const g = meshWithOutline(seedBuilt(SEEDS[id].color), mat, sharedOutline('char'));
      const e = this.scenery.greatTree.branchEnds[i * 2];
      const th = this.scenery.greatTree.height;
      g.position.set(W.greatTree.x + e[0] * 0.8, W.greatTree.y + e[1] - th * 0.086, W.greatTree.z + e[2] * 0.8);
      g.scale.setScalar(th > 11 ? 2.2 : 1.6);
      g.visible = false;
      this.scene.add(g);
      return g;
    });
  },
  /** where the seeds leave from: FP the hand in front of the eye; TP Pip's paws */
  seedLaunch(out) {
    const pl = this.player, f = fwdXZ(pl.facing);
    if (this.view.mode === 'fp' && this.view.shotW < 0.5) {
      // just in front of the hand, low in the view (never so close that it fills the screen)
      const e = this.view.simEye(out), r = rightXZ(this.view.yaw), F = fwdXZ(this.view.yaw);
      return out.set(e.x + F.x * 0.95 + r.x * 0.18, e.y - 0.42, e.z + F.z * 0.95 + r.z * 0.18);
    }
    return out.set(pl.pos.x + f.x * 0.3, pl.pos.y + 0.9, pl.pos.z + f.z * 0.3);
  },
  /** pedestal: place the carried seeds (ids). Pip freezes; FP stays in the eye, TP cuts to a shot by the altar */
  startPlace(carried) {
    const A = anchors(this), P = A.ped, pl = this.player, K = TV.place;
    const c = (this.cutscene = { type: 'place', t: 0, queue: carried.slice(), cur: null, shot: 0, mode: this.view.mode, A });
    pl.state = 'frozen';
    this.events.emit(EV.CUTSCENE_START, { type: 'place' });
    // FP: the look rests a little above the slab, so the sockets sit low in the frame and the tree's face stays clear
    if (c.mode === 'fp') this.view.faceTo(P.x, P.y + P.top + K.fpLook, P.z, { dur: K.dur, lock: true, hold: 99 });
    else {
      const given = shotPose(A.shots.place), cine = this.view.feel && this.view.feel.cine;
      let pos, look, fov = cine ? cine.shotFov(K.fovH) : 50;
      if (given) ({ pos, look } = given);
      else {
        // beside the altar on Pip's side, off his left so he stands whole in the lower-left third: toward Pip · back,
        // aside · side, up; looking at the slab
        let ux = pl.pos.x - P.x, uz = pl.pos.z - P.z;
        const l = Math.hypot(ux, uz) || 1;
        ux /= l; uz /= l;
        pos = new THREE.Vector3(P.x + ux * K.tpBack + uz * K.tpSide, P.y + K.tpUp, P.z + uz * K.tpBack - ux * K.tpSide);
        look = new THREE.Vector3(P.x, P.y + P.top * K.tpLook, P.z);
      }
      // fitted either way (r2: WP9's W.shots.place too): Pip whole in frame with the slab, also on a portrait phone (the
      // narrow horizontal FOV) or with Pip further out
      if (cine) {
        const Q = pl.pos, o = cine.fitShot(look, pos, [Q.x, Q.y + 1.0, Q.z, Q.x, Q.y + 0.05, Q.z, P.x, P.y + P.top, P.z], fov, 0.72, 0.85, pos.distanceTo(look) + 2.5, look, { pos: new THREE.Vector3(), fov, k: 1 });
        pos = o.pos; fov = o.fov;
      }
      c.shot = this.view.setShot({ pos, look, speed: 1 / (0.6 * 0.6), fov, priority: 3 });
    }
  },
  /** where a flying seed is t s into its flight (sim and render share it) */
  seedAt(cu, t, out) {
    const K = TV.place, k = clamp(t / K.seedT, 0, 1), to = this.pedSeeds[cu.i].position, d = cu.from.distanceTo(to);
    out.lerpVectors(cu.from, to, Ease.inOutSine(k));
    out.y += Math.sin(k * Math.PI) * (K.arc + 0.12 * d);
    return out;
  },
  /** render side (wp1-feel's beforeCamera): the flying seed at its flight time interpolated to this frame; the ending crane
   *  by render time (dt 0 while the world is paused) */
  renderCutscene(alpha, dt) {
    const c = this.cutscene;
    if (!c) return;
    if (c.type === 'place' && c.cur) {
      const cu = c.cur, K = TV.place, t = clamp(cu.t - (1 - clamp(alpha, 0, 1)) * STEP, 0, K.seedT);
      this.seedAt(cu, t, cu.mesh.position);
      cu.mesh.rotation.y = t * 8;
      cu.mesh.scale.setScalar(K.seedScale + (cu.s0 - K.seedScale) * Math.exp(-3 * t));
    } else if (c.type === 'ending' && c.shot) this.moveCrane(dt);
    else if (c.type === 'handover' && c.seed) {
      const t = clamp(c.seedT - (1 - clamp(alpha, 0, 1)) * STEP, 0, HO.seedT);
      this.handoverSeedAt(c, t, c.seed.position);
      c.seed.rotation.y = this.time * 1.2;
    }
  },
  updateCutscene(dt) {
    const c = this.cutscene;
    c.t += dt;
    if (c.type === 'place') {
      const A = c.A || anchors(this), P = A.ped, K = TV.place;
      if (!c.cur && c.t > K.gap) {
        const id = c.queue.shift();
        if (!id) {
          // done: hand control back facing the pedestal (TP blends out of its shot; FP already looks at it)
          const face = { x: P.x, y: P.y + P.top * 0.85, z: P.z };
          if (c.shot) this.view.clearShot(c.shot, { face, speed: 1 / (0.8 * 0.6) });
          else this.view.setLook(this.view.yaw, this.view.pitch);       // drop the locked look assist where it is
          this.cutscene = null;
          this.player.state = 'normal';
          this.events.emit(EV.CUTSCENE_END, { type: 'place' });
          const placed = progress.placed(this.S);
          this.save(true);
          if (placed >= 3) this.startEnding();
          else this.ui.say(['The Great Tree rustles happily and perks up a little!', (3 - placed) + ' more Starseed' + (3 - placed === 1 ? '' : 's') + ' to go.'], {});
          return;
        }
        const i = SEED_ORDER.indexOf(id);
        const mesh = meshWithOutline(seedBuilt(SEEDS[id].color), toonMat({ glow: true }), sharedOutline('char'));
        const from = this.seedLaunch(new THREE.Vector3());
        mesh.position.copy(from);
        const s0 = this.view.mode === 'fp' ? K.seedScale * 0.5 : 1;
        mesh.scale.setScalar(s0);
        this.scene.add(mesh);
        c.cur = { id, i, mesh, from, t: 0, s0 };
        sfx('seed');
      }
      if (c.cur) {
        // the flight runs on sim time; renderCutscene poses the mesh every render frame
        const cu = c.cur;
        cu.t += dt;
        const k = Math.min(1, cu.t / K.seedT), to = this.pedSeeds[cu.i].position;
        if (Math.random() < 0.6) { const q = this.seedAt(cu, cu.t, _v); this.fx.sparkle(q.x, q.y, q.z, SEEDS[cu.id].glow, 1, 0.2); }
        if (k >= 1) {
          this.scene.remove(cu.mesh);
          this.S.seeds[cu.id] = 2;
          this.pedSeeds[cu.i].visible = true;
          this.fx.burst(to.x, to.y, to.z, SEEDS[cu.id].glow, 22, 4);
          sfx('place');
          this.view.shake(K.shake, { x: to.x, z: to.z });
          this.ui.updateHud(this.S);
          c.cur = null;
          c.t = 0;
        }
      }
    } else if (c.type === 'ending') this.updateEnding(dt);
    else if (c.type === 'handover') this.updateHandover(dt);
  },
  // ------------------------------------------------------------------ the Catchers' handover (S-005)
  /** start the handover of Catcher `b` (sat, fight.js onBossDefeated); `replay`: a Talk after a save written mid-scene
   *  (beaten, no seed, no handover flag) starts it at the two shot and its first line */
  startHandover(b, { replay = false } = {}) {
    const id = b.id;
    if (!HANDOVER[id] || this.cutscene) return false;
    const pl = this.player, view = this.view;
    const c = (this.cutscene = { type: 'handover', id, b, t: 0, step: 0, shot: 0, mode: view.mode, seed: null, seedT: 0, holdT: 0, flagged: false, done: false });
    pl.state = 'frozen'; pl.vel.set(0, 0); pl.autoMove = null; pl.endSwing();
    this.skipScene = () => this.skipHandover();
    this.events.emit(EV.CUTSCENE_START, { type: 'handover', id });
    // 1 wide: TP a shot from wide m back toward Pip and wideUp m up, looking at the Catcher; FP the eye eases onto it
    const face = this.bossFace(b);
    if (c.mode === 'fp') view.faceTo(face.x, face.y, face.z, { dur: 0.6, lock: true, hold: 99 });
    else if (!replay) c.shot = view.setShot(this.handoverShot(c, 'wide'));
    if (replay) this.handoverStep(c, 2);   // straight to the two shot and the lines
    else c.step = 1;                       // 2 sit: the sit plays (bosses.js updateSitting), held for HO.sit s
    return true;
  },
  /** the handover's camera shots (TP): 'wide' or 'two' → setShot options */
  handoverShot(c, kind) {
    const b = c.b, P = this.player.pos, a = b.arena, cine = this.view.feel && this.view.feel.cine;
    let ux = P.x - b.pos.x, uz = P.z - b.pos.z;
    const l = Math.hypot(ux, uz) || 1;
    ux /= l; uz /= l;
    const look = new THREE.Vector3(b.pos.x, a.h + b.height * (kind === 'wide' ? 0.45 : 0.55), b.pos.z);
    let pos, from;
    if (kind === 'wide') {
      pos = new THREE.Vector3(b.pos.x + ux * HO.wide, a.h + HO.wideUp, b.pos.z + uz * HO.wide);
      from = new THREE.Vector3(b.pos.x + ux * (b.r + 0.5), a.h + HO.wideUp, b.pos.z + uz * (b.r + 0.5));
    } else {
      // over Pip's shoulder: behind him (away from the Catcher), up, a little to his right
      pos = new THREE.Vector3(P.x + ux * HO.two - uz * HO.twoSide, P.y + HO.twoUp, P.z + uz * HO.two + ux * HO.twoSide);
      from = new THREE.Vector3(P.x, P.y + HO.twoUp, P.z);
    }
    if (cine && cine.safe) cine.safe(from, pos.clone(), pos);   // never through a tree, a rock or the vine wall
    const fov = cine ? cine.shotFov(kind === 'wide' ? HO.wideFovH : HO.twoFovH) : 50;
    return { pos, look, fov, speed: 1 / (0.6 * (kind === 'wide' ? HO.wideIn : HO.twoIn)), priority: 3 };
  },
  /** where the held-out seed is t s into its rise: from the Catcher's centre to seedOut m in front of it at seedH m */
  handoverSeedAt(c, t, out) {
    const b = c.b, k = Ease.outCubic(clamp(t / HO.seedT, 0, 1)), f = fwdXZ(b.facing), h = b.arena.h;
    const x0 = b.pos.x, y0 = h + b.height * 0.5, z0 = b.pos.z, x1 = b.pos.x + f.x * (b.r + HO.seedOut), z1 = b.pos.z + f.z * (b.r + HO.seedOut);
    return out.set(lerp(x0, x1, k), lerp(y0, h + HO.seedH, k), lerp(z0, z1, k));
  },
  /** run handover step i (HANDOVER_STEPS[i]) */
  handoverStep(c, i) {
    c.step = i;
    const id = c.id, lines = HANDOVER[id], who = { name: BOSSES[id].name, portrait: BOSSES[id].key }, view = this.view;
    const then = (j) => () => { if (this.cutscene === c && !c.done) this.handoverStep(c, j); };
    const name = HANDOVER_STEPS[i];
    if (name === 'two') {
      // 3 two: TP over Pip's shoulder; FP unchanged
      if (c.mode === 'tp') c.shot = view.setShot(this.handoverShot(c, 'two'));
      return this.handoverStep(c, 3);
    }
    if (name === 'say12') { this.ui.say([lines[0].text, lines[1].text], { ...who, onDone: then(4) }); return; }
    if (name === 'holdOut') {
      // 5 holdOut: the Starseed rises out of the Catcher and is held out in front of it (posed in renderCutscene)
      const mesh = meshWithOutline(seedBuilt(SEEDS[id].color), toonMat({ glow: true }), sharedOutline('char'));
      this.handoverSeedAt(c, 0, mesh.position);
      this.scene.add(mesh);
      c.seed = mesh; c.seedT = 0;
      return;                              // updateHandover moves on to say3 once it is held out
    }
    if (name === 'say3') { this.ui.say([lines[2].text], { ...who, onDone: then(6) }); return; }
    if (name === 'pov') return this.finishHandover(c);
  },
  updateHandover(dt) {
    const c = this.cutscene;   // (c.t is advanced by updateCutscene)
    // the Catcher turns (slowly) to face Pip while it talks (its own update rests while it is sat)
    const b = c.b;
    b.prevFacing = b.facing;
    b.facing = dampAngle(b.facing, yawOf(this.player.pos.x - b.pos.x, this.player.pos.z - b.pos.z), 3, dt);
    // {interact} held for HO.skipHold s skips the scene (a press still reads the lines)
    c.holdT = this.input.held('interact') ? c.holdT + dt : 0;
    if (c.holdT >= HO.skipHold) return this.skipHandover();
    if (c.step === 1 && c.t >= HO.sit) return this.handoverStep(c, 2);
    if (c.step === 4 && c.seed) {
      c.seedT += dt;
      if (Math.random() < 0.5) { const q = this.handoverSeedAt(c, c.seedT, _v); this.fx.sparkle(q.x, q.y, q.z, SEEDS[c.id].glow, 1, 0.2); }
      if (c.seedT >= HO.seedT) this.handoverStep(c, 5);
    }
  },
  /** skip: close the open line, then the same end as a watched handover (flags, the item-get), so the save state matches */
  skipHandover() {
    const c = this.cutscene;
    if (!c || c.type !== 'handover' || c.done) return false;
    this.ui.closeDialogue();
    this.finishHandover(c);
    return true;
  },
  /** 7 pov: drop the shot (FP: the locked look); 8 flags; 9 the shipped seed item-get; 10 on its close, control back */
  finishHandover(c) {
    if (c.done) return;
    c.done = true;
    const id = c.id, view = this.view, b = c.b;
    this.cutscene = null;
    this.skipScene = null;
    if (c.seed) { this.scene.remove(c.seed); c.seed = null; }
    c.step = 6;
    const face = this.bossFace(b);
    if (c.shot) view.clearShot(c.shot, { face, speed: 1 / (0.8 * HO.povOut) });
    else view.setLook(view.yaw, view.pitch);   // FP: drop the locked look assist where it is (on the Catcher)
    c.step = 7;
    this.calmFlags(id);
    c.step = 8;
    this.giveSeed(id, () => {
      this.player.state = 'normal';
      this.events.emit(EV.CUTSCENE_END, { type: 'handover', id });
      this.save(true);
    });
  },
  /** the handover's flags (story.md flag table): calm:<id> = the order this Catcher was calmed in (1-3), handover:<id> */
  calmFlags(id) {
    const F = this.S.flags;
    if (!Number.isFinite(F['calm:' + id])) F['calm:' + id] = 1 + Object.keys(F).filter((k) => k.startsWith('calm:')).length;
    F['handover:' + id] = true;
  },
  startEnding() {
    const A = anchors(this), Tr = A.tree, E = TV.ending, view = this.view;
    const c = (this.cutscene = { type: 'ending', t: 0, stage: 0, shot: 0, lookShot: 0, crane: 0, A });
    this.player.state = 'frozen';
    this.events.emit(EV.CUTSCENE_START, { type: 'ending' });
    // 0 – lookT: from the eye, the view eases up the trunk to +35°
    const e = view.simEye(_v), d = Math.max(1.5, Math.hypot(Tr.x - e.x, Tr.z - e.z));
    view.faceTo(Tr.x, e.y + Math.tan(E.look * D2R) * d, Tr.z, { dur: E.lookT, lock: true, hold: 99 });
    // TP: the raw TP pose looking up sits on the grass behind Pip's hood; a short shot beside and above him looks up the
    // trunk instead (the crane then starts from it)
    const cine = view.feel && view.feel.cine;
    if (view.mode === 'tp' && cine) {
      const P = this.player.pos;
      let ux = Tr.x - P.x, uz = Tr.z - P.z;
      const l = Math.hypot(ux, uz) || 1;
      ux /= l; uz /= l;
      const from = new THREE.Vector3(P.x, P.y + 1.0, P.z), pos = new THREE.Vector3();
      cine.safe(from, _w.set(P.x - ux * E.tpBack - uz * E.tpSide, P.y + E.tpUp, P.z - uz * E.tpBack + ux * E.tpSide), pos);
      const dd = Math.max(1.5, Math.hypot(Tr.x - pos.x, Tr.z - pos.z));
      c.lookShot = view.setShot({ pos, look: new THREE.Vector3(Tr.x, pos.y + Math.tan(E.look * D2R) * dd, Tr.z), fov: cine.shotFov(E.tpFovH), speed: 1 / (0.6 * E.lookT), priority: 3 });
    }
    this.ui.showHud(false);
  },
  /** render side: the crane (a shot that started exactly at the camera) rises up and around the tree by render time */
  moveCrane(dt) {
    const c = this.cutscene, Tr = c.A.tree, E = TV.ending;
    c.crane = Math.min(1, c.crane + dt / E.craneT);
    const k = Ease.inOutSine(c.crane), p = _u;
    if (c.polar) {
      const q = c.polar, r = lerp(q.r0, q.r1, Ease.inOutCubic(c.crane)), a = q.a0 + (q.a1 - q.a0) * k, y = lerp(q.y0, q.y1, k);
      p.set(Tr.x + Math.sin(a) * r, y, Tr.z + Math.cos(a) * r);
    } else p.lerpVectors(c.from, c.to, k);
    // never through the ground or a roof: the crane only ever rises over what is under it
    p.y = Math.max(p.y, this.world.hAt(p.x, p.z) + 0.6);
    const look = _w.lerpVectors(c.look0, c.look1, Ease.inOutSine(clamp(c.crane * 1.25, 0, 1)));
    this.view.shots.move(c.shot, p, look, null, lerp(c.fov0, c.fov1, k));
  },
  updateEnding(dt) {
    const c = this.cutscene, A = c.A || (c.A = anchors(this)), Tr = A.tree, E = TV.ending, th = this.scenery.greatTree.height || Tr.height;
    if (c.stage === 0 && c.t > E.bloom) {
      c.stage = 1;
      this.scenery.setBloom(true);
      this.treeSeeds.forEach((g) => (g.visible = this.treeSeedsWanted()));
      sfx('bloom');
      music('ending');
      this.whiteFlash = 0.9;
      this.view.shake(0.53);
      for (let i = 0; i < 6; i++) this.fx.burst(Tr.x + rand(-th * 0.35, th * 0.35), Tr.y + rand(th * 0.55, th * 0.92), Tr.z + rand(-th * 0.35, th * 0.35), pick([0xffc2d9, 0xfff4a0, 0xffffff]), 20, 6);
      // petals fall through the eye too
      const e = this.view.simEye(_v), f = fwdXZ(this.view.yaw);
      this.fx.petals(e.x + f.x * 3, e.y + 3, e.z + f.z * 3, 3, 2.5);
    }
    if (c.stage >= 1) {
      this.fx.petals(Tr.x, Tr.y + th * 0.6, Tr.z, 3, th * 0.6);
      if (Math.random() < 0.5) this.fx.sparkle(Tr.x + rand(-th * 0.4, th * 0.4), Tr.y + rand(th * 0.45, th), Tr.z + rand(-th * 0.4, th * 0.4), pick([0xfff4a0, 0xffc2d9]), 1, 0.2);
    }
    // crane: the camera leaves the eye (a shot that starts exactly at the camera) and rises around the tree
    if (c.stage >= 1 && c.t > E.crane && !c.shot) {
      const cam = this.camera, view = this.view;
      c.from = cam.position.clone();
      c.look0 = _w.set(0, 0, -6).applyQuaternion(cam.quaternion).add(cam.position).clone();
      // the crane's end: W.shots.endingCrane (C6; W.shots.ending is the opening look-up from the ground, not where the
      // crane goes), else up and E.orbit° around to craneH·H at craneR·H. Either way it travels around the tree in polar
      // form (radius, bearing and height eased apart), so it rises over the plaza instead of cutting through the trunk
      const given = shotPose(A.shots.endingCrane);
      const r0 = Math.max(1, Math.hypot(c.from.x - Tr.x, c.from.z - Tr.z)), a0 = Math.atan2(c.from.x - Tr.x, c.from.z - Tr.z);
      const a1 = given ? a0 + angDiff(a0, Math.atan2(given.pos.x - Tr.x, given.pos.z - Tr.z)) : a0 + E.orbit * D2R;
      const r1 = given ? Math.max(1, Math.hypot(given.pos.x - Tr.x, given.pos.z - Tr.z)) : th * E.craneR, y1 = given ? given.pos.y : Tr.y + th * E.craneH;
      c.to = new THREE.Vector3(Tr.x + Math.sin(a1) * r1, y1, Tr.z + Math.cos(a1) * r1);
      c.look1 = given ? given.look : new THREE.Vector3(Tr.x, Tr.y + th * 0.62, Tr.z);
      c.polar = { r0, a0, y0: c.from.y, r1, a1, y1 };
      c.fov0 = cam.fov; c.fov1 = view.feel && view.feel.cine ? view.feel.cine.shotFov(E.craneFovH) : 50;
      c.shot = view.setShot({ pos: c.from, quat: cam.quaternion, fov: cam.fov, snapIn: true, priority: 3, speed: 2 });
      sfx('whoosh', { vol: 0.6 });                     // C8 name (silent until WP5 adds it)
      c.crane = 0;
    }
    // (the crane itself moves render-side: renderCutscene → moveCrane)
    if (c.stage === 1 && c.t > E.card) { c.stage = 2; this.ui.openEnding(); }
  },
  finishEnding() {
    const c = this.cutscene, A = anchors(this), Tr = A.tree, view = this.view, E = TV.ending;
    this.cutscene = null;
    this.player.state = 'normal';
    this.ui.showHud(true);
    this.S.ending = true;
    this.S.flags.bloom = true;   // story I.5: the bloom (S.flags, save v7)
    // the sitting Catchers (S-005) go: the shipped rematch nap takes over unchanged
    for (const id in this.bosses) { const b = this.bosses[id]; if (b.sat) { b.remove(); delete this.bosses[id]; } }
    this.spawnRematches(true);   // the guardians nap in their arenas again, for a friendly rematch (fight.js)
    this.events.emit(EV.CUTSCENE_END, { type: 'ending' });
    this.save(false);
    // the eyelids blink, and under them the camera is back in the eye at the altar, facing the tree a little upward
    const back = () => {
      if (c && (c.shot || c.lookShot)) view.shots.reset();
      const e = view.simEye(_v), yaw = yawOf(Tr.x - e.x, Tr.z - e.z);
      view.setLook(yaw, (view.mode === 'tp' ? E.pitchBack * 0.5 : E.pitchBack) * D2R);
      view.snap();
    };
    const cine = view.feel && view.feel.cine;
    if (cine) cine.lids.play([[1, 0.2, Ease.inOutSine]], () => { back(); cine.lids.blink(); });
    else { view.clearShot(c ? c.shot : undefined, { face: { x: Tr.x, y: this.player.pos.y + 3, z: Tr.z } }); }
  },
};
