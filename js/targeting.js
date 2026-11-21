// Crosshair interaction target, lock-on and aim friction (Game mixin) + the WP4 module (`wp4-targeting`).
//
// Interaction (feel §9.1–9.2, arch WP4). Every interactable has an aim point and radius (TUNE.combat.aimPts): NPC face,
// sign board, door centre, chest lid, pedestal top, well rim. A candidate is valid when Pip is within its range + 0.6 m
// (XZ, to the aim point), the angle between the look ray and the aim point is ≤ clamp(atan(R/d) + 6°, 8°, 25°) (touch
// × 1.6), nothing blocks the ray (terrain, colliders other than its own), and (signs, chests) it is faced from the front.
// FP casts from the eye, TP from the camera through the crosshair; TP falls back to the nearest thing just in front of
// Pip's body. The smallest angle wins, with hysteresis (the current target holds +4° / +0.3 m, is dropped 150 ms after it
// fails while the look is still within keepGrace of it, and a rival must beat it by 3°). The result carries prompt data for the HUD: { verb, name, label, kind, key }.
// Attack never interacts (interact.js).
//
// Lock-on (contract C1). Inputs: lockOn (Q / MMB / R3) toggles; lockHold (RMB / LT) locks while held. settings.lockMode
// 'hold' makes Q / R3 hold-to-lock too. A candidate is an emerged, living enemy ≤ lockRange from Pip inside ±lockCone of
// the crosshair ray (FP from the eye, TP from the camera) with terrain LOS from the eye (TP: else the nearest ≤ lockNear,
// anywhere when WP1 frames TP locks, else within ±lockFreeDeg of the camera), or the fight boss anywhere in its arena;
// score = angle° + 1.5·m (the boss gets a bonus, so one press always picks it in a fight). Lifetime: breaks beyond
// lockBreak (never the fight boss), after lockLosT without LOS, in FP after the look stays > lockOffDeg off it for
// lockOffT (TP without WP1's framing: > lockFreeDeg), on the button, on the hold release, on dizzy / session / title /
// fight end; a dead target hands over to the nearest within 8 m and ±60° of the look. Pressing lock again while another
// candidate sits clearly nearer the crosshair switches to it. TP with WP1's framing (view.feel.lockOn, setting
// lockTurnsCamera): a quick mouse flick (≥ 45 counts in 0.12 s) or a horizontal stick flick switches toward that side.
// Auto-lock of the boss when the fight starts per settings.autoLockBosses (auto = pad / touch). view.lockOn(target)
// stores view.lockTarget and tells WP1's view.feel.lockOn; EV.LOCK { target, prev } on every change. In TP the intent hook
// turns Pip's body to the target (it.bodyYaw: movement strafes) and aims swings at it (it.faceYaw / it.facePitch). The
// lock target also gets the strongest swing magnetism (combat.js). Touch auto-face (feel §8.7): see touchAutoFace.
import * as THREE from 'three';
import { ERRANDS, progress, errands, secrets } from './data.js';
import { NPC } from './npcs.js';
import { Boss } from './bosses.js';
import { EV } from './events.js';
import { combat as TC, view as TV, move as TM } from './tune.js';
import { STEP } from './clock.js';
import { clamp, angDiff, yawOf, dir3 } from './util.js';
import { hudFields } from './combat.js';
import { MOUSE_K } from './view/view.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const VERB = { sign: 'Read', door: 'Knock', chest: 'Open', well: 'Peek', shell: 'Pick up', guardian: 'Wake' };
const NAME = { sign: 'Sign', door: 'Door', chest: 'Chest', pedestal: 'Starseed Pedestal', well: 'Well', shell: 'Rainbow shell' };
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Vector3(), _ce = new THREE.Vector3(), _se = new THREE.Vector3(), _hb = {}, _probe = {};
/** signs are read (from the viewer's side) and chests opened (from Pip's side) from the front hemisphere only: a chest's
 *  lid hinges at its back, so opened from behind it swings up into the FP eye and hides the reward */
function frontOk(c, x, z) {
  const r = c.kind === 'sign' ? (c.o.prop ? c.o.prop.rot || 0 : null) : c.kind === 'chest' ? c.o.chest.rot : null;
  if (r == null) return true;
  return (x - c.px) * Math.sin(r) + (z - c.pz) * Math.cos(r) >= 0;
}
const isBoss = (o) => o instanceof Boss;

export const TargetingMixin = {
  /** every interactable near Pip as { o, kind, px, py, pz (aim point), R, range, x, y, z, h (prompt anchor) } */
  interactables(out = []) {
    out.length = 0;
    const pl = this.player, S = this.S, A = TC.aimPts;
    for (const n of this.npcs) {
      if (Math.abs(n.pos.x - pl.pos.x) > 5 || Math.abs(n.pos.z - pl.pos.z) > 5) continue;
      const h = n.height || 1.2;
      out.push({ o: n, kind: 'npc', px: n.pos.x, py: n.pos.y + A.npc[0] * h, pz: n.pos.z, R: A.npc[1], range: TC.npcRange, x: n.pos.x, y: n.pos.y, z: n.pos.z, h: h + 0.3 });
    }
    for (const it of this.world.interact) {
      if (Math.abs(it.x - pl.pos.x) > 5 || Math.abs(it.z - pl.pos.z) > 5) continue;
      if (it.kind === 'chest' && (S.chests[it.chest.id] || it.chest._opening)) continue;   // open, or in its lid beat
      const a = A[it.kind] || [0.8, 0.5];
      out.push({ o: it, kind: it.kind, px: it.x, py: it.y + a[0], pz: it.z, R: a[1], range: it.r, x: it.x, y: it.y, z: it.z, h: it.h });
    }
    // a guardian napping for a rematch after the bloom (fight.js): woken with Use, never by walking in. Aimed at its
    // body (TUNE.combat.aimPts.guardian: fraction of its height, radius), offered within its own radius + guardianRange
    if (!this.fight) for (const id in this.bosses) {
      const b = this.bosses[id];
      if (!b.rematch || b.state !== 'sleep' || Math.abs(b.pos.x - pl.pos.x) > 6 || Math.abs(b.pos.z - pl.pos.z) > 6) continue;
      const a = A.guardian, y = b.arena.h;
      out.push({ o: b, kind: 'guardian', px: b.pos.x, py: y + a[0] * b.height, pz: b.pos.z, R: a[1], range: b.r + TC.guardianRange, x: b.pos.x, y, z: b.pos.z, h: b.height + 0.3 });
    }
    // errand items picked up with Use (ERRANDS how 'use': Clover's rainbow shells, W.shells), offered like a chest while
    // the errand has them out. Items lit by walking past (Ribbit's parade lanterns) are never a Use target
    if (S) for (const e of ERRANDS) {
      if (e.how !== 'use') continue;
      for (const sh of this.world[e.list] || []) {
        if (Math.abs(sh.x - pl.pos.x) > 5 || Math.abs(sh.z - pl.pos.z) > 5 || !errands.itemOut(S, e, sh.id)) continue;
        const a = A[e.item] || [0.25, 0.45];
        out.push({ o: sh, kind: e.item, px: sh.x, py: sh.y + a[0], pz: sh.z, R: a[1], range: TC[e.item + 'Range'] || 1.6, x: sh.x, y: sh.y, z: sh.z, h: 0.8 });
      }
    }
    // the landmark keepsakes not found yet (W.secrets, data.js SECRETS): read with Use, before and after the bloom
    if (S) for (const it of this.world.secrets || []) {
      if (Math.abs(it.x - pl.pos.x) > 5 || Math.abs(it.z - pl.pos.z) > 5 || secrets.got(S, it.id)) continue;
      const a = A.secret || [0.25, 0.5];
      out.push({ o: it, kind: 'secret', px: it.x, py: it.y + a[0], pz: it.z, R: a[1], range: TC.secretRange || 1.6, x: it.x, y: it.y, z: it.z, h: 0.8 });
    }
    return out;
  },
  /** angle (rad) from the ray (o, d) to the aim point and its distance, or null when out of range / blocked / behind */
  aimCheck(c, o, d, keep) {
    const pl = this.player;
    const xz = Math.hypot(c.px - pl.pos.x, c.pz - pl.pos.z);
    if (xz > c.range + TC.rangeAdd + (keep ? TC.keepDist : 0)) return null;
    if (c.kind === 'chest' ? !frontOk(c, pl.pos.x, pl.pos.z) : !frontOk(c, o.x, o.z)) return null;
    const dx = c.px - o.x, dy = c.py - o.y, dz = c.pz - o.z, dist = Math.hypot(dx, dy, dz) || 1e-3;
    const ang = Math.acos(clamp((dx * d.x + dy * d.y + dz * d.z) / dist, -1, 1));
    const touch = this.input && this.input.lastDevice === 'touch' ? TC.touchTol : 1;
    const tol = clamp(Math.atan(c.R / dist) / D2R + TC.tolAdd, TC.tolMin, TC.tolCap) * touch * D2R + (keep ? TC.keepDeg * D2R : 0);
    if (ang > tol || !this.losClear(o, c, dist)) return null;
    return { ang, dist };
  },
  /** angle (rad) between the ray (o, d) and an interactable's aim point */
  rayAngle(c, o, d) {
    const dx = c.px - o.x, dy = c.py - o.y, dz = c.pz - o.z, l = Math.hypot(dx, dy, dz) || 1e-3;
    return Math.acos(clamp((dx * d.x + dy * d.y + dz * d.z) / l, -1, 1));
  },
  /** line of sight from the ray origin to (just short of) the aim point: terrain in 0.25 m steps, then collider cylinders.
   *  A collider around the aim point itself (the sign's post, the well, the house of a door) never blocks it, nor one
   *  whose top is below the higher of Pip's eye (also in TP: never the camera's height) and the aim point: a counter, a
   *  fence, a pot or a rock up to Pip's eye height, which he talks / reaches over; walls, trees, tall props do */
  losClear(o, c, dist) {
    const W = this.world, n = Math.floor(Math.max(0, dist - 0.3) / 0.25);
    for (let i = 1; i <= n; i++) {
      const k = (i * 0.25) / dist, x = o.x + (c.px - o.x) * k, y = o.y + (c.py - o.y) * k, z = o.z + (c.pz - o.z) * k;
      if (y < W.hAt(x, z)) return false;
    }
    if (!W.probeSegment) return true;
    _probe.terrain = false; _probe.water = false; _probe.decks = false; _probe.top = 'body';
    const low = Math.max(this.player.pos.y + TV.eyeH, c.py) + 0.05;
    _probe.ignore = (q) => Math.hypot(q.x - c.px, q.z - c.pz) < q.r + 0.15 || (q.y1 != null && q.y1 < low);
    const k = Math.max(0, (dist - 0.15) / dist);
    return W.probeSegment(o.x, o.y, o.z, o.x + (c.px - o.x) * k, o.y + (c.py - o.y) * k, o.z + (c.pz - o.z) * k, 0.02, _probe) >= 1;
  },
  findTarget() {
    const pl = this.player, v = this.view;
    if (!this.playing || (pl.state !== 'normal' && pl.state !== 'attack')) { this._tgt = null; return null; }
    const now = this.time, tp = v.bodyOut;
    // the crosshair ray: FP from the eye, TP from the camera (both along the look)
    if (tp) _o.copy(this.camera.position); else _o.copy(v.eye);
    dir3(v.yaw, v.pitch, _d);
    const list = this.interactables(this._ilist || (this._ilist = []));
    const cur = this._tgt;
    let best = null, bestAng = Infinity, curHit = null;
    for (const c of list) {
      const isCur = !!cur && cur.o === c.o;
      const r = this.aimCheck(c, _o, _d, isCur);
      if (!r) continue;
      c.ang = r.ang; c.dist = r.dist;
      if (isCur) curHit = c;
      if (r.ang < bestAng) { bestAng = r.ang; best = c; }
    }
    let pick = best;
    if (cur) {
      if (curHit) { if (!best || best === curHit || best.ang > curHit.ang - TC.beatDeg * D2R) pick = curHit; cur.lostAt = null; }
      else if (!best && list.some((c) => c.o === cur.o && Math.hypot(c.px - pl.pos.x, c.pz - pl.pos.z) <= c.range + TC.rangeAdd + TC.keepDist && this.rayAngle(c, _o, _d) <= TC.keepGrace * D2R)) {
        // grace: the current target survives a short near-miss look-away while still in reach (no prompt flicker); a
        // snap turn drops it at once (nothing behind the view may answer E)
        if (cur.lostAt == null) cur.lostAt = now;
        if (now - cur.lostAt < TC.keepT) return cur;
      }
    }
    // TP: nothing under the crosshair → the nearest thing just in front of Pip's body
    if (!pick && tp) {
      let bd = Infinity;
      for (const c of list) {
        const dx = c.px - pl.pos.x, dz = c.pz - pl.pos.z, d = Math.hypot(dx, dz), surf = d - c.R;
        if (surf > TC.tpNear || d > c.range + TC.rangeAdd || Math.abs(angDiff(pl.facing, yawOf(dx, dz))) > TC.tpNearDeg * D2R || !frontOk(c, pl.pos.x, pl.pos.z)) continue;
        if (surf < bd) { bd = surf; pick = c; }
      }
      if (pick) { pick.ang = null; pick.dist = bd; }
    }
    if (!pick) { this._tgt = null; return null; }
    if (cur && cur.o === pick.o) { Object.assign(cur, pick, { lostAt: null }); return cur; }
    return (this._tgt = this.labelTarget({ ...pick, lostAt: null, since: now }));
  },
  /** prompt data for the HUD: verb + name ('Talk · Elder Shellby'); key = the action token (C7) WP6 turns into a glyph */
  labelTarget(t) {
    const o = t.o;
    if (o instanceof NPC) { t.verb = o.def.shop ? 'Shop' : 'Talk'; t.name = o.name; }
    else if (isBoss(o)) { t.verb = VERB.guardian; t.name = o.name; }   // a napping rematch guardian: 'Wake · Grumble Shroom'
    else if (t.kind === 'secret') { const s = secrets.get(o.id); t.verb = (s && s.verb) || 'Look'; t.name = (s && s.label) || 'Something'; }   // 'Look · Something glowing'
    else {
      t.verb = t.kind === 'pedestal' ? (progress.carried(this.S) > 0 ? 'Place' : 'Look') : VERB[t.kind] || 'Use';
      t.name = NAME[t.kind] || t.kind;
    }
    t.label = t.verb + ' · ' + t.name;
    t.key = '{interact}';
    return t;
  },

  // ------------------------------------------------------------------ lock-on (C1)
  /** where the lock aims (and WP1 frames, WP6 draws the reticle): enemy hurt-volume centre, boss at 0.45 of its height */
  lockPoint(t, out = new THREE.Vector3()) {
    const hb = t.hurtbox(_hb), k = isBoss(t) ? TC.lockPt.boss : TC.lockPt.enemy;
    return out.set(hb.x, hb.y0 + (hb.y1 - hb.y0) * k, hb.z);
  },
  /** the crosshair ray's origin: FP the eye, TP the camera (picks, angles and friction are measured from it) */
  lockEye(out = _e) { return this.view.bodyOut ? out.copy(this.camera.position) : this.view.simEye(out); },
  /** WP1 frames TP locks (view.feel.lockOn) and the setting lets it turn the camera: then mouse X / the stick only flick
   *  between targets while locked in TP. Without it the TP camera turns freely, so no flicks and no lock behind it */
  lockFramed() {
    const f = this.view.feel;
    return !!(f && typeof f.lockOn === 'function') && this.settings.get('lockTurnsCamera') !== false;
  },
  /** terrain line of sight from the eye to the lock point in lockLosN samples */
  lockLos(t) {
    const W = this.world, e = this.view.simEye(_e), p = this.lockPoint(t, _p), n = TC.lockLosN;
    for (let i = 1; i < n; i++) {
      const k = i / n, x = e.x + (p.x - e.x) * k, z = e.z + (p.z - e.z) * k;
      if (e.y + (p.y - e.y) * k < W.hAt(x, z) - 0.05) return false;
    }
    return true;
  },
  /** a target that may stay locked: alive, still in the game, a boss only while it is this fight's and not dying */
  lockValid(t) {
    if (!t) return false;
    if (isBoss(t)) return !!(this.fight && this.fight.boss === t && !t.dying && this.fight.phase !== 'won');
    return !!(t.alive && !t.removed && this.enemies.includes(t));
  },
  /** lock candidates: { o, ang (deg off the crosshair ray, 3D), yawOff (deg, + = left), dist (m from Pip), score }; the
   *  angles are measured from the crosshair ray's origin (lockEye: TP the camera), LOS from Pip's eye.
   *  o: { exclude, cone (deg), range (m), near (m: inside it the cone is nearCone, default anywhere), bossAnywhere } */
  lockCandidates(o = {}) {
    const out = [], pl = this.player, v = this.view, cone = o.cone ?? TC.lockCone, range = o.range ?? TC.lockRange, near = o.near ?? 0, nearCone = o.nearCone ?? 180;
    const e = this.lockEye(_ce);
    dir3(v.yaw, v.pitch, _d);
    const add = (t, boss) => {
      if (t === o.exclude) return;
      const p = this.lockPoint(t, _p), dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, dist = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z);
      if (!boss && dist > range) return;
      const ang = Math.acos(clamp((dx * _d.x + dy * _d.y + dz * _d.z) / (Math.hypot(dx, dy, dz) || 1), -1, 1)) * R2D;
      const yawOff = angDiff(v.yaw, yawOf(dx, dz)) * R2D;
      const inCone = Math.abs(yawOff) <= cone || (dist <= near && Math.abs(yawOff) <= nearCone) || (boss && o.bossAnywhere);
      if (!inCone || !this.lockLos(t)) return;
      out.push({ o: t, ang, yawOff, dist, score: ang + TC.lockDistW * dist - (boss ? TC.lockBossBonus : 0) });
    };
    for (const en of this.enemies) if (en.alive && !en.removed && !(en.spawnT < 0.5) && !en.emerging) add(en, false);
    const b = this.fight && this.fight.boss;
    if (b && !b.dying && this.fight.phase !== 'won') add(b, true);
    out.sort((a, b2) => a.score - b2.score);
    return out;
  },
  /** best target for a fresh lock: inside the cone; TP falls back to the nearest within lockNear (anywhere when WP1
   *  frames the lock, else only within ±lockFreeDeg of the camera: Pip would face away from it); a fight boss anywhere */
  pickLock(exclude = null) {
    const b = this.fight && this.fight.boss;
    if (b && b !== exclude && this.lockValid(b)) return b;                // a fight: one press always picks the boss
    let c = this.lockCandidates({ exclude });
    if (!c.length && this.view.bodyOut) c = this.lockCandidates({ exclude, near: TC.lockNear, cone: 0, nearCone: this.lockFramed() ? 180 : TC.lockFreeDeg });
    if (!c.length && this.fight) c = this.lockCandidates({ exclude, cone: 0, bossAnywhere: true });
    return c.length ? c[0].o : null;
  },
  lockS() { return this._lock || (this._lock = { target: null, src: null, losT: 0, offT: 0, holdPrev: false, flickAcc: 0, flickT: 0, flickCD: 0, padPrev: 0 }); },
  /** set / clear the lock (C1): view.lockOn + EV.LOCK { target, prev }; src 'toggle' | 'hold' | 'holdKey' | 'auto' | 'debug' */
  setLock(t, src = 'toggle') {
    const L = this.lockS(), prev = this.view.lockTarget || null;
    t = t || null;
    L.target = t; L.src = t ? src : null; L.losT = 0; L.offT = 0;
    if (t) hudFields(t);
    if (t === prev) return t;
    this.view.lockOn(t);
    this.events.emit(EV.LOCK, { target: t, prev });
    return t;
  },
  releaseLock() { if (this.view.lockTarget) this.setLock(null); },
  /** TP flick / pad: the nearest candidate on that side of the current target (dir +1 = left, −1 = right) */
  switchLock(dir) {
    const L = this.lockS(), cur = this.view.lockTarget;
    if (!cur) return null;
    const e = this.lockEye(_se), cp = this.lockPoint(cur, _p), base = yawOf(cp.x - e.x, cp.z - e.z);
    let best = null, bd = Infinity;
    for (const c of this.lockCandidates({ exclude: cur, cone: 180 })) {
      const p = this.lockPoint(c.o, _p), off = angDiff(base, yawOf(p.x - e.x, p.z - e.z));
      if (Math.sign(off) !== Math.sign(dir) || Math.abs(off) < 2 * D2R) continue;
      if (Math.abs(off) < bd) { bd = Math.abs(off); best = c.o; }
    }
    if (best) this.setLock(best, L.src || 'toggle');
    return best;
  },
  /** per frame (module frameInput): lock / unlock / switch inputs, then the lifetime rules */
  updateLock(input, dt) {
    const L = this.lockS(), pl = this.player, v = this.view;
    L.flickCD = Math.max(0, L.flickCD - dt);
    const free = this.playing && pl.state !== 'dizzy';
    const holdMode = this.settings.get('lockMode') === 'hold';
    const holdNow = input.held('lockHold');
    if (free) {
      if (holdNow && !L.holdPrev) this.setLock(this.pickLock(), 'hold');
      else if (!holdNow && L.holdPrev && L.src === 'hold') this.releaseLock();
      if (input.pressed('lockOn')) {
        if (holdMode && input.held('lockOn')) this.setLock(this.pickLock(), 'holdKey');        // Q / R3 held
        else if (!v.lockTarget) this.setLock(this.pickLock(), 'toggle');
        else {
          // FP: another candidate clearly nearer the crosshair → switch to it; else unlock
          const cur = v.lockTarget, c = this.lockCandidates({ exclude: cur })[0], curAng = this.lockAngle(cur);
          if (c && c.ang + TC.lockSwitchDeg < curAng) this.setLock(c.o, 'toggle'); else this.releaseLock();
        }
      } else if (holdMode && L.src === 'holdKey' && !input.held('lockOn')) this.releaseLock();
    }
    L.holdPrev = holdNow;
    // lifetime
    const t = v.lockTarget;
    if (!t) return;
    if (this.state !== 'play' || pl.state === 'dizzy') { this.releaseLock(); return; }
    if (!this.lockValid(t)) {
      const dead = isBoss(t) ? t.dying : !t.alive;
      const next = dead ? this.lockCandidates({ exclude: t, cone: TC.lockRetargetDeg, range: TC.lockRetarget })[0] : null;
      this.setLock(next ? next.o : null, L.src);
      return;
    }
    const p = this.lockPoint(t, _p), d = Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z), e = this.lockEye(_se), bearing = yawOf(p.x - e.x, p.z - e.z);
    if (!isBoss(t) && d > TC.lockBreak) { this.releaseLock(); return; }
    if (!this.playing) return;                         // dialogue / menus / cutscenes: the lock waits
    L.losT = this.lockLos(t) ? 0 : L.losT + dt;
    if (L.losT > TC.lockLosT) { this.releaseLock(); return; }
    // the look held away from it: FP > lockOffDeg; TP without WP1's framing (the camera turns freely) > lockFreeDeg, so
    // Pip never faces a target far off camera (he would walk backwards toward the camera)
    const off = v.mode === 'fp' && !v.bodyOut ? TC.lockOffDeg : this.lockFramed() ? 0 : TC.lockFreeDeg;
    if (off) {
      L.offT = Math.abs(angDiff(v.yaw, bearing)) > off * D2R ? L.offT + dt : 0;
      if (L.offT > TC.lockOffT) this.releaseLock();
    } else L.offT = 0;
  },
  /** degrees between the crosshair ray (from lockEye) and a target's lock point */
  lockAngle(t) {
    const e = this.lockEye(_e), p = this.lockPoint(t, _p), dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
    dir3(this.view.yaw, this.view.pitch, _d);
    return Math.acos(clamp((dx * _d.x + dy * _d.y + dz * _d.z) / (Math.hypot(dx, dy, dz) || 1), -1, 1)) * R2D;
  },
  /** TP lock framed by WP1 (lockFramed: mouse X / the stick no longer turn the camera): a quick horizontal mouse flick
   *  (counts) or a horizontal stick flick switches the lock toward that side (look mod, observes). The stick counts
   *  only when its horizontal part crosses lockFlickPad while it is ≥ lockFlickHoriz × its vertical part (pushing it up
   *  or down to look at a leaping boss never switches) */
  lockFlick(Lk) {
    const L = this.lockS(), v = this.view, st = this.input && this.input.lookStick;
    const hx = st && st.m > 0 ? (Math.abs(st.x) / (Math.hypot(st.x, st.y) || 1)) * st.m : 0; // horizontal stick magnitude
    if (!v.lockTarget || v.mode !== 'tp' || !this.playing || !this.lockFramed()) { L.flickAcc = 0; L.flickT = 0; L.padPrev = hx; return; }
    // + = mouse right, as the hand moved: the look delta carries the invertX sign, a pick on the screen must not (the
    // stick below is read raw for the same reason, so padInvertX does not turn it either)
    const counts = Lk.mouse > 0 ? (-Lk.dyaw / (MOUSE_K * (this.settings.get('sens') || 1))) * (this.settings.get('invertX') ? -1 : 1) : 0;
    if (counts && Math.sign(counts) !== Math.sign(L.flickAcc)) { L.flickAcc = 0; L.flickT = 0; }
    L.flickT += Lk.dt; L.flickAcc += counts;
    if (L.flickT > TC.lockFlickT) { L.flickAcc = counts; L.flickT = Lk.dt; }
    let dir = 0;
    if (Math.abs(L.flickAcc) >= TC.lockFlick) dir = -Math.sign(L.flickAcc);           // mouse right → the target on the right
    if (hx > TC.lockFlickPad && L.padPrev <= TC.lockFlickPad && Math.abs(st.x) >= TC.lockFlickHoriz * Math.abs(st.y)) dir = st.x < 0 ? 1 : -1;
    L.padPrev = hx;
    if (dir && L.flickCD <= 0) { this.switchLock(dir); L.flickCD = TC.lockFlickCD; L.flickAcc = 0; L.flickT = 0; }
  },
  /** module intent hook: TP lock-on turns the body to the target (movement strafes) and aims swings at its lock point.
   *  While WP1 frames the lock (lockFramed) the stick is read relative to Pip → target, not to the camera: the framing
   *  yaw is the pivot → target bearing plus a shoulder parallax that grows near the target (46–64° at 1 m), so a
   *  camera-relative W turned tangential close in and Pip orbited the target at ≈ 250°/s with the camera spinning along.
   *  Now W walks at the target and stops at contact (enemies are not solid for Pip: the part of the stick toward the
   *  target fades out over the last lockStop m before the two bodies touch), S backs off, A / D circle it (feel §10.4)
   *  at a steady radius (the strafe leans in by the angle it sweeps in half a step: each step's chord spiralled Pip out)
   *  and never faster than lockOrbit °/s around it (at contact a full-speed strafe swung Pip and the framing camera
   *  round at ≈ 300°/s). Unframed (setting lockTurnsCamera off) the camera turns freely and the wish stays
   *  camera-relative */
  lockIntent(it, canAct) {
    const t = this.view.lockTarget;
    if (!t || it.mode !== 'tp' || !canAct || !this.lockValid(t)) return;
    const pl = this.player, p = this.lockPoint(t, _p), tr = _hb.r || 0.4, dx = p.x - pl.pos.x, dz = p.z - pl.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const yaw = yawOf(dx, dz);
    it.bodyYaw = yaw; it.faceYaw = yaw;
    it.facePitch = clamp(Math.atan2(p.y - (pl.pos.y + TV.eyeH), d), -60 * D2R, 60 * D2R);
    if (!(it.ml > 0) || !this.lockFramed()) return;
    const a = angDiff(it.lookYaw, yaw), c = Math.cos(a), s = Math.sin(a);                 // camera → target basis
    const mx = it.mx * c + it.mz * s, mz = it.mz * c - it.mx * s, ux = dx / d, uz = dz / d, vs = TM.run * TM.strafeK;
    let rad = mx * ux + mz * uz, tx = mx - ux * rad, tz = mz - uz * rad, tl = Math.hypot(tx, tz);
    const tmax = (TC.lockOrbit * D2R * d) / vs;                                           // orbit rate cap
    if (tl > tmax) { tx *= tmax / tl; tz *= tmax / tl; tl = tmax; }
    if (rad > 0) rad *= clamp((d - tr - pl.r) / TC.lockStop, 0, 1);                       // contact: stop walking in
    rad += tl * Math.tan((0.5 * STEP * tl * vs) / Math.max(d, 0.5));                      // circle-strafe lean
    it.mx = tx + ux * rad; it.mz = tz + uz * rad; it.ml = Math.min(1, Math.hypot(it.mx, it.mz));
  },
  /** boss fight started: auto-lock per settings.autoLockBosses (auto = pad / touch players) */
  autoLockBoss() {
    const s = this.settings.get('autoLockBosses'), dev = this.input.lastDevice;
    if (s === 'off' || (s === 'auto' && dev !== 'pad' && dev !== 'touch')) return null;
    const b = this.fight && this.fight.boss;
    return b && !b.dying ? this.setLock(b, 'auto') : null;
  },

  // ------------------------------------------------------------------ aim friction (feel §3.3; pad / touch only)
  aimFriction(Lk) {
    if (!(Lk.pad > 0 || Lk.touch > 0) || Lk.mouse > 0 || this.settings.get('aimAssist') === 'off' || !this.playing) return;
    const v = this.view, e = this.lockEye(_e), pl = this.player.pos;   // the crosshair ray (TP: from the camera)
    dir3(v.yaw, v.pitch, _d);
    const lim = Math.cos(TC.frictionDeg * D2R);
    for (const en of this.enemies) {
      if (!en.alive) continue;
      const p = this.lockPoint(en, _p), dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, l = Math.hypot(dx, dy, dz);
      if (Math.hypot(p.x - pl.x, p.y - pl.y, p.z - pl.z) > TC.frictionRange || l < 1e-3) continue;   // range from Pip
      if ((dx * _d.x + dy * _d.y + dz * _d.z) / l >= lim) { Lk.dyaw *= TC.friction; Lk.dpitch *= TC.friction; return; }
    }
  },

  // ------------------------------------------------------------------ touch auto-face (feel §8.7)
  /** at a swing start on touch with aim assist high (auto on touch is high), FP, not locked and no other look assist
   *  running: the view turns toward the best emerged enemy within ±faceDeg of the look and faceRange m (LOS), at a peak
   *  of faceSpeed °/s (≤ faceDeg of correction). The FP blade follows the view, so the sweep lands on it. Any look input
   *  cancels it (view.faceTo). TP is left to the swing magnetism (the TP swing latches its aim at the start). → target */
  touchAutoFace() {
    const v = this.view, a = this.settings.get('aimAssist');
    if (this.input.lastDevice !== 'touch' || (a !== 'high' && a !== 'auto') || v.mode !== 'fp' || v.bodyOut || v.lockTarget || v.assist || !this.playing) return null;
    const e = this.view.simEye(_se);
    let best = null, bd = Infinity;
    for (const en of this.enemies) {
      if (!en.alive || en.removed || en.spawnT < 0.5 || en.emerging) continue;
      const p = this.lockPoint(en, _p), dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), off = Math.abs(angDiff(v.yaw, yawOf(dx, dz)));
      if (d > TC.faceRange || off > TC.faceDeg * D2R || !this.lockLos(en)) continue;
      if (off < bd) { bd = off; best = en; }
    }
    if (!best || bd < 0.5 * D2R) return best;
    const p = this.lockPoint(best, _p);
    v.faceTo(p.x, p.y, p.z, { dur: (bd * Math.PI) / 2 / (TC.faceSpeed * D2R), pitch: false });   // inOutSine peak = π/2 × mean
    return best;
  },
};

/** module `wp4-targeting` (modules.js): lock-on input / lifetime / intent, aim friction, HUD fields, sim-time timers */
export default {
  name: 'wp4-targeting',
  attach(game) {
    this.game = game;
    // observers first (they read the raw deltas before WP1's lock framing may zero them), friction after them
    game.view.lookMods.unshift((L) => game.lockFlick(L));
    game.view.addLookMod((L) => game.aimFriction(L));
    game.events.on(EV.BOSS_FIGHT, () => game.autoLockBoss());
    game.events.on(EV.FIGHT_END, () => { const t = game.view.lockTarget; if (t && isBoss(t)) game.releaseLock(); });
    game.events.on(EV.RESPAWN, () => game.releaseLock());
    game.events.on(EV.DOWN, () => game.releaseLock());
    // a swing starts: remember Pip's ground (the ledge rules measure from it) and run the touch auto-face
    game.events.on(EV.SWING, (p) => { game.noteSwingStart(p.id); game.touchAutoFace(); });
    game.registerDebug('lockOn', (arg) => {
      if (arg === null || arg === false) { game.releaseLock(); return null; }
      const t = arg && typeof arg === 'object' ? arg : game.pickLock();
      game.setLock(t, 'debug');
      return game.debugLockInfo();
    });
    game.debugLockInfo = () => {
      const t = game.view.lockTarget, L = game.lockS();
      if (!t) return { target: null };
      const p = game.lockPoint(t), pl = game.player.pos;
      return { target: t.id || t.type, boss: isBoss(t), src: L.src, dist: +Math.hypot(p.x - pl.x, p.z - pl.z).toFixed(3), point: [p.x, p.y, p.z].map((v) => +v.toFixed(3)), ang: +game.lockAngle(t).toFixed(2), losT: +L.losT.toFixed(3), offT: +L.offT.toFixed(3) };
    };
    game.registerDebug('lockInfo', () => game.debugLockInfo());
    game.registerDebug('lockCandidates', () => game.lockCandidates().map((c) => ({ type: c.o.id || c.o.type, ang: +c.ang.toFixed(2), yawOff: +c.yawOff.toFixed(2), dist: +c.dist.toFixed(2), score: +c.score.toFixed(2) })));
  },
  onSession() { this.game.releaseLock(); if (this.game.clearLater) this.game.clearLater(); },
  onTitle() { this.game.releaseLock(); if (this.game.clearLater) this.game.clearLater(); },
  frameInput(input, dt) { this.game.updateLock(input, dt); },
  intent(it, canAct) { this.game.lockIntent(it, canAct); },
  afterStep(dt) {
    const g = this.game;
    for (const e of g.enemies) if (e.maxHp == null || e.name == null || e.hp < 0) hudFields(e);
    if (g.tickLater) g.tickLater(dt);
  },
};
