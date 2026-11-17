// Lock-on camera (C1, RULINGS "Lock-on", feel §8.8 / §10.8). WP4 picks the target and its lifetime and calls
// view.lockOn(target) → view.feel.lockOn(target) → LockCam.set(target). This file is only the camera's behaviour:
// - FP, soft: the view eases toward the lock point only while look input has been idle for lock.fpIdle s, at
//   ω lock.fpRate with a lock.fpDead° dead zone, never faster than lock.fpMax (240°/s). Any look input wins at once.
//   It never pulls a look back from WP4's break zone (yaw > TUNE.combat.lockOffDeg off the target: a deliberate
//   look-away, which targeting.js releases after lockOffT), and while a locked boss is in the air (Frostbun's leap lands
//   on Pip) it does not tilt the view above lock.fpLiftPitch°: the landing disc at Pip's feet stays on screen and the
//   HUD's look-up caret carries the boss.
// - Dialogue, signs, item-get, menus and cutscenes (game.playing false, like targeting.js's lock): the camera waits,
//   in both views, so the view stays on the speaker / the item.
// - TP, framing lock: the camera yaw springs toward the bearing that puts the target on the crosshair ray (the shoulder
//   offset taken into account; r3: for a non-boss at ≥ tpLockParD m, so walking in does not swing it), the pitch toward the
//   elevation from the pivot to the lock point − 6° (clamped −25…+30°);
//   the boom grows (+0.6 m enemies; bosses 4.2 m and the pivot +0.35 m; +1.0 m more while a boss is lifted > 2 m, the
//   lock point following it up at ω 6), so the target and Pip stay in frame — Frostbun's 6.5 m leap included.
//   A lifted boss right above Pip cannot always share the frame with his feet: then the lock point (the boss's middle)
//   stays under the top edge first, Pip's head second, with the pitch cap raised to lock.liftPitchHi while it is up.
//   Mouse / stick deltas do not turn the TP camera while locked; this frame's raw input stays readable for target
//   switching (WP4) as L.inDyaw / L.inDpitch in later look mods (feel.look sets them every frame, locked or not).
// - Setting "Lock-on turns the camera" off (comfort.lockCam): no camera behaviour at all (WP4 still marks the target).
// Lock point: enemy = hurtbox centre; boss = hurtbox bottom (floor + lift) + 0.45 · height.
import { view as T, combat as TC } from '../tune.js';
import { clamp, damp, angDiff, yawOf } from '../util.js';

const D2R = Math.PI / 180;
const _hb = {};

export class LockCam {
  constructor(feel) {
    this.feel = feel;
    this.target = null;
    this.idleT = 0;
    this.py = null;             // smoothed lock point height (follows a lifting boss at ω liftW)
    this.pt = { x: 0, y: 0, z: 0 };
    this.boss = false;
  }
  set(target) {
    this.target = target || null;
    this.py = null; this.idleT = T.lock.fpIdle;     // a fresh lock may ease at once if the player isn't looking around
    this.boss = !!(target && target.arena !== undefined && target.lift !== undefined);
  }
  /** a target that died / left is not followed (WP4 unlocks it; until then the camera simply stops caring) */
  live() {
    const t = this.target;
    return !!(t && !t.removed && t.alive !== false && !t.dying && typeof t.hurtbox === 'function');
  }
  active() { return this.live() && this.feel.comfort.lockCam; }
  /** lock point (world) → this.pt; dt smooths the height (lifting bosses) */
  point(dt = 0) {
    const h = this.target.hurtbox(_hb), y0 = +h.y0 || 0, y1 = +h.y1 || y0 + 1;
    const y = this.boss ? y0 + 0.45 * (this.target.height || y1 - y0) : (y0 + y1) / 2;
    this.py = this.py == null || !dt ? y : damp(this.py, y, T.lock.liftW, dt);
    this.pt.x = +h.x || 0; this.pt.z = +h.z || 0; this.pt.y = this.py;
    return this.pt;
  }
  /** view look mod (only runs while look is allowed) */
  look(L) {
    const view = this.feel.view, g = this.feel.game;
    if (!this.active()) { this.idleT = T.lock.fpIdle; return; }
    // the lock waits through dialogue, signs, item-get, menus and cutscenes (targeting.js does the same): no ease / framing
    if (!g.playing || g.player.state === 'item') { this.idleT = 0; return; }
    const K = T.lock, p = this.point(L.dt);
    if (view.blend < 0.5) {
      // FP soft ease: only while every look device is idle; any input wins
      const idle = !L.mouse && !L.touch && !(L.pad > 0.05);
      if (!idle) { this.idleT = 0; return; }
      this.idleT += L.dt;
      if (this.idleT < K.fpIdle) return;
      const e = view.simEye(), dx = p.x - e.x, dz = p.z - e.z;
      const yaw = view.yaw + L.dyaw, pitch = view.pitch + L.dpitch;
      const dy = angDiff(yaw, yawOf(dx, dz));
      // WP4's break zone (> lockOffDeg off): the player looked away on purpose; the lock releases after lockOffT, the
      // camera never rubber-bands it back (it resumes once the player brings the target inside again)
      if (Math.abs(dy) > TC.lockOffDeg * D2R) return;
      let wp = clamp(Math.atan2(p.y - e.y, Math.hypot(dx, dz)), -1.2, 1.2);
      // a boss in the air: never tilt up past fpLiftPitch (the landing disc at Pip's feet stays in view); a look the player
      // already raised is held, not pulled down
      if (this.boss && (+this.target.lift || 0) > K.fpLiftAt) wp = Math.min(wp, Math.max(pitch, K.fpLiftPitch * D2R));
      const dp = wp - pitch;
      const m = Math.hypot(dy, dp), ex = m - K.fpDead * D2R;
      if (ex <= 0) return;
      const step = Math.min(ex, Math.min(K.fpMax * D2R, K.fpRate * ex) * L.dt);
      L.dyaw += (dy / m) * step; L.dpitch += (dp / m) * step;
      return;
    }
    // TP framing lock: input does not turn the camera (feel.look keeps this frame's raw input in L.inDyaw / inDpitch for
    // target switching)
    const tp = view.tp, pv = tp.pivot, dx = p.x - pv.x, dz = p.z - pv.z, d = Math.hypot(dx, dz);
    const side = T.tpShoulder * tp.side * tp.sideK;
    // r3: the parallax term grows as Pip closes in (walking in on a locked enemy it swung the camera ≈ 57°, ≈ 115°/s over
    // the last metre): for a non-boss target it is taken at no closer than tpLockParD m, a gentle constant offset up close
    // (the target then sits a little left of the crosshair, right in front of Pip; WP4 aims the swing at it)
    const dPar = this.boss ? d : Math.max(d, T.tpLockParD ?? 0);
    const want = yawOf(dx, dz) + (d > 0.5 ? Math.asin(clamp(side / dPar, -0.9, 0.9)) : 0);
    const pivY = pv.y + (tp.lift || 0) - (tp.drop || 0);
    // a boss in the air (Frostbun's leap lands on Pip, so it is right above him) may need a steeper look than the usual cap
    const lifted = this.boss && (+this.target.lift || 0) > K.liftAt, hiCap = (lifted ? K.liftPitchHi : K.tpPitchHi) * D2R;
    let wp = clamp(Math.atan2(p.y - pivY, Math.max(0.5, d)) + K.tpPitchOff * D2R, K.tpPitchLo * D2R, hiCap);
    // keep both in frame: the lock point under the top edge and Pip's feet over the bottom edge (seen from the camera as
    // last rendered). A target too high for both (a leaping boss) keeps the lock point (the boss's middle) in frame first,
    // then Pip's head: his feet are the first thing to leave (the landing disc around them still shows where it lands)
    const cam = this.feel.game.camera, half = ((cam.fov * D2R) / 2) - K.margin * D2R, c = cam.position, P = this.feel.game.player.root.position;
    const dc = Math.max(0.3, Math.hypot(P.x - c.x, P.z - c.z));
    let eT = Math.atan2(p.y - c.y, Math.max(0.5, Math.hypot(p.x - c.x, p.z - c.z)));
    // a lifted boss: its real middle (point() just read its hurtbox) must stay in frame, not only the smoothed lock point,
    // which trails a 0.6 s leap by metres
    if (lifted) eT = Math.max(eT, Math.atan2((+_hb.y0 + +_hb.y1) / 2 - c.y, Math.max(0.5, Math.hypot(+_hb.x - c.x, +_hb.z - c.z))));
    const eF = Math.atan2(P.y + 0.05 - c.y, dc), eH = Math.atan2(P.y + 0.95 - c.y, dc);
    const lo = eT - half, hi = eF + half;
    wp = lo <= hi ? clamp(wp, lo, hi) : Math.min(lo, eH + half);
    wp = clamp(wp, K.tpPitchLo * D2R, hiCap);
    L.dyaw = angDiff(view.yaw, want) * (1 - Math.exp(-K.tpYaw * L.dt));
    L.dpitch = (wp - view.pitch) * (1 - Math.exp(-(lifted ? K.liftPitch : K.tpPitch) * L.dt));
  }
  /** render side, before the view: the TP rig's lock boom / pivot (eased by the rig) */
  beforeCamera(dt) {
    const tp = this.feel.view.tp, K = T.lock;
    let boom = 0, piv = 0, hug = 0;
    if (this.active()) {
      if (this.boss) {
        const lift = +this.target.lift || 0;
        boom = Math.max(0, K.bossBoom - tp.boom) + (lift > K.liftAt ? K.liftBoom : 0);
        piv = K.bossPivot;
        // r3: the steep look up at a leaping boss points the long boom into the ground behind Pip; with the hug lift capped at
        // tpHug the fit cut the arm to 2.7 m (1.2 m on a rise), and the boss's middle left the frame: more lift while it is up
        if (lift > K.liftAt) hug = T.tpLockLiftHug ?? 0;
      } else boom = K.enemyBoom;
    }
    tp.lockBoom = boom; tp.lockPivot = piv; tp.lockHug = hug;
  }
  info() {
    const t = this.target;
    return { target: t ? (t.id || t.type || 'target') : null, boss: this.boss, live: this.live(), active: !!t && this.active(), idleT: +this.idleT.toFixed(3), point: t && this.live() ? [+this.pt.x.toFixed(3), +this.pt.y.toFixed(3), +this.pt.z.toFixed(3)] : null };
  }
}
