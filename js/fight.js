// Boss fights: vine walls, trigger, intro, shockwave rings, defeat, reset (Game mixin). C15 events: BOSS_INTRO,
// BOSS_FIGHT, BOSS_DEFEATED, FIGHT_END (BOSS_HIT: combat.js). Shockwave rings (WP5) advance in the fixed step and are
// drawn on the same radius (fx-ground.js stepRings): the light wall spans exactly the damage band r ± width, and a
// jump clears it (no damage while (player.alt ?? 0) > TUNE.actors.ringJump, C2).
// Guardian rematches (after the bloom, data.js REMATCH): each beaten guardian naps in its arena again as a rematch Boss.
// Walking in never starts one; Use on it does (interact.js wakeRematch → startFight). A win drops no Starseed: the first
// win per guardian gives REMATCH.gems once (S.rematches), then it naps again; getting dizzy resets it like a first fight.
// The Catchers' handover (S-005): a first win over a guardian with a data.js HANDOVER entry ends with it sitting down
// (bosses.js updateSitting): it stays in game.bosses, sat, and the handover cutscene gives its Starseed (cutscenes.js).
import * as THREE from 'three';
import { sfx, music } from './core.js';
import { SEEDS, BOSSES, SEED_ORDER, rematch } from './data.js';
import { Pickup, telegraph, hint } from './entities.js';
import { Boss, RING_HINT } from './bosses.js';
import { GB, toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { len2 } from './util.js';
import { EV } from './events.js';
import { view as TV, actors as TA, hud as TH } from './tune.js';
import { frozenTick } from './debug/debug.js';

export const FightMixin = {
  buildVineWalls() {
    this.vines = {};
    const mat = toonMat({ glow: true, nightGlow: false, glowBase: 1, occ: true });
    for (const id in this.world.arenas) {
      const a = this.world.arenas[id];
      const b = new GB();
      const half = 0.36;
      for (let k = 0; k < 7; k++) {
        const pts = [];
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          const ang = a.entAng - half + t * half * 2;
          const r = a.r + 1.0 + Math.sin(t * Math.PI * 3 + k) * 0.35;
          pts.push([Math.sin(ang) * r, 0.2 + k * 0.42 + Math.sin(t * Math.PI * 4 + k * 1.3) * 0.25, Math.cos(ang) * r]);
        }
        b.tube(pts, 0.12, k % 2 ? 0x5aa83a : 0x6fc04a, { tseg: 28, rs: 6, glow: 0.25 });
      }
      for (let k = 0; k < 18; k++) {
        const t = (k + 0.5) / 18;
        const ang = a.entAng - half + t * half * 2;
        const r = a.r + 1.0;
        const y = 0.3 + (k % 7) * 0.42;
        b.sphere(0.16, 0x9ad04e, { x: Math.sin(ang) * r, y, z: Math.cos(ang) * r, sx: 1.6, sy: 0.4, rz: k, ry: ang, ws: 8, hs: 5, glow: 0.3 });
        if (k % 3 === 0) b.sphere(0.12, 0xffd0f0, { x: Math.sin(ang) * (r + 0.15), y: y + 0.2, z: Math.cos(ang) * (r + 0.15), ws: 8, hs: 6, glow: 0.9, outline: false });
      }
      for (const side of [-1, 1]) {
        const ang = a.entAng + side * half;
        b.cyl(0.25, 0.32, 3.3, 0x4a8a2a, { x: Math.sin(ang) * (a.r + 1), y: 1.6, z: Math.cos(ang) * (a.r + 1), glow: 0.15 });
      }
      const g = meshWithOutline(b.build(), mat, sharedOutline('propOcc'));
      g.position.set(a.x, a.h, a.z);
      g.visible = false;
      g.scale.set(1, 0.01, 1);
      this.scene.add(g);
      this.vines[id] = { g, k: 0, target: 0 };
    }
  },
  updateFight(dt) {
    const pl = this.player;
    // trigger (a first fight only: a napping rematch guardian is woken with Use, never by walking in)
    if (!this.fight && pl.state !== 'dizzy') {
      for (const id in this.bosses) {
        const b = this.bosses[id], a = this.world.arenas[id];
        if (!b.rematch && len2(pl.pos.x - a.x, pl.pos.z - a.z) < a.r - 2.5 && b.state === 'sleep') { this.startFight(id); break; }
      }
    }
    if (!this.fight) this.spawnRematches();
    // idle bosses (asleep)
    for (const id in this.bosses) { const b = this.bosses[id]; if (!this.fight || this.fight.boss !== b) b.update(dt); }
    for (const id in this.vines) {
      const v = this.vines[id];
      v.k += (v.target - v.k) * Math.min(1, dt * 4);
      v.g.visible = v.k > 0.02;
      v.g.scale.set(1, Math.max(0.01, v.k), 1);
    }
    const f = this.fight;
    if (!f) return;
    f.t += dt;
    const b = f.boss;
    if (f.phase === 'intro') {
      b.update(dt);
      // walk Pip a few steps into the arena so the vine wall is behind the camera framing (player.js faces the walk). A
      // rematch is woken from right next to the guardian: Pip steps back out to TA.rematchBack m from it, still facing it
      const a = f.arena, dx = a.x - pl.pos.x, dz = a.z - pl.pos.z, d = Math.hypot(dx, dz) || 1e-3;
      if (d > a.r - 6 && f.t < 2.0) pl.autoMove = { x: (dx / d) * 3.4, z: (dz / d) * 3.4 };
      else if (b.rematch && d < TA.rematchBack && f.t < 2.0) pl.autoMove = { x: (-dx / d) * 2.4, z: (-dz / d) * 2.4, face: Math.atan2(dx, dz) };
      else pl.autoMove = null;
      if (!f.shot) { const face = this.bossFace(b); this.view.retarget(face.x, face.y, face.z); } // FP: keep the eye on it
      if (!f.card && f.t >= TH.bossCardDelay) { f.card = 1; this.ui.showBossCard(BOSSES[f.id].name + (b.rematch ? ' · Rematch' : ''), BOSSES[f.id].title, true, 0); }
      if (f.t > 2.4) {
        f.phase = 'fight';
        pl.autoMove = null;
        pl.state = 'normal';
        // control returns already facing the boss: TP blends out of its shot looking at it; FP has been tracking it in
        // the eye, so the hand-back is the same pose (no jump)
        const face = this.bossFace(b);
        if (f.shot) this.view.clearShot(f.shot, { face, speed: TV.introOut });
        else this.view.lookAtPoint(face.x, face.y, face.z, 0.6);
        this.ui.showBossCard('', '', false);
        this.ui.bossBar(b);
        this.events.emit(EV.CUTSCENE_END, { type: 'bossIntro' });
        this.events.emit(EV.BOSS_FIGHT, { id: f.id });
      }
    } else if (f.phase === 'fight') {
      if (this.aiFrozen) frozenTick(b, dt); else b.update(dt);
      // shockwaves: step the radius, then the band test on that same radius (a jump clears it)
      this.fx.ground.stepRings(dt);
      const airborne = (pl.alt ?? 0) > TA.ringJump;
      for (const r of f.rings) {
        if (!r.active) continue;
        const d = len2(pl.pos.x - r.cx, pl.pos.z - r.cz);
        if (Math.abs(d - r.r) < r.width && !pl.invulnerable && !airborne) this.playerHurt(TA.bossDmg.ring, r.cx, r.cz, 8, 'ring');
      }
      f.rings = f.rings.filter((r) => r.active);
    } else if (f.phase === 'won') {
      f.wonT += dt;
      if (f.wonT > 2.5 && this.vines[f.id].target) { this.vines[f.id].target = 0; sfx('door'); }
      if (f.wonT > 3.2) { this.fight = null; this.updateMusic(true); this.events.emit(EV.FIGHT_END, { id: f.id, reset: false }); }
    }
  },
  /** after the bloom, every beaten guardian naps in its arena for a rematch (data.js rematch.available). A missing one
   *  comes back (a soft poof) once Pip is clear of the arena's middle, so it never appears on top of him; `force`: at
   *  once and quietly (a session start, a reset under the fade) */
  spawnRematches(force = false) {
    const S = this.S, pl = this.player;
    if (!S || !S.ending) return;
    for (const id of SEED_ORDER) {
      if (this.bosses[id] || !rematch.available(S, id)) continue;
      const a = this.world.arenas[id];
      if (!force && len2(pl.pos.x - a.x, pl.pos.z - a.z) < 4) continue;
      this.bosses[id] = new Boss(id, a, { rematch: true });
      if (!force && this.fx) this.fx.poof(a.x, a.h + 0.6, a.z, 0xffffff, 14, 1.6);
    }
  },
  /** Use on a napping rematch guardian (interact.js): the normal fight flow, vines and intro included */
  wakeRematch(b) {
    if (this.fight || !b || !b.rematch || b.state !== 'sleep' || this.bosses[b.id] !== b) return false;
    this.startFight(b.id);
    return true;
  },
  /** where the hand-back look aims: the boss body at ~0.45 of its height (pitch is clamped by the view) */
  bossFace(b) { return { x: b.pos.x, y: b.arena.h + b.height * 0.45, z: b.pos.z }; },
  startFight(id) {
    const a = this.world.arenas[id];
    const b = this.bosses[id];
    this.fight = { id, arena: a, boss: b, phase: 'intro', t: 0, rings: [], arenaClamp: { x: a.x, z: a.z, r: a.r - 0.3 } };
    b.wake();
    const pl = this.player;
    pl.state = 'frozen';
    pl.vel.set(0, 0);
    this.vines[id].target = 1;
    sfx('door');
    music('boss');
    // despawn regular enemies nearby
    for (const e of this.enemies) if (!e.minion) { e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    // FP: the intro plays in the eye (Pip walks in while the view is drawn to the boss and tracks it; look input is
    // locked). TP: a short low 3/4 shot from Pip's side of the arena, handed back facing the boss
    const face = this.bossFace(b);
    if (this.view.mode === 'fp') { this.fight.shot = 0; this.view.faceTo(face.x, face.y, face.z, { dur: 0.6, lock: true, hold: 2.2 }); }
    else {
      const dx = pl.pos.x - b.pos.x, dz = pl.pos.z - b.pos.z, l = Math.hypot(dx, dz) || 1, I = TV.introShot;
      const cpos = new THREE.Vector3(b.pos.x + (dx / l) * I.back + (dz / l) * I.side, a.h + I.h, b.pos.z + (dz / l) * I.back - (dx / l) * I.side);
      this.fight.shot = this.view.setShot({ pos: cpos, look: new THREE.Vector3(b.pos.x, a.h + b.height * I.look, b.pos.z), speed: TV.introIn, fov: I.fov, priority: 2 });
    }
    // r4: the name card runs on the intro's own clock (updateFight: in at TUNE.hud.bossCardDelay, out with the intro), so
    // a pause or a hidden tab holds it with the intro (wall-clock timers showed and hid it behind the pause menu)
    this.fight.card = 0;
    this.ui.notices.hideBanner();
    this.events.emit(EV.BOSS_INTRO, { id, boss: b });
    this.events.emit(EV.CUTSCENE_START, { type: 'bossIntro' });
  },
  addShockwave(x, y, z, o) {
    if (!this.fight) return;
    const r = this.fx.ground.shockwave(x, y, z, o);
    this.fight.rings.push(r);
    this.events.emit(EV.SHOCKWAVE, { x, y, z, ring: r });
    const pl = this.player, d = len2(pl.pos.x - x, pl.pos.z - z);   // C3: the ring itself, for the HUD's chevrons
    telegraph(this.fight.boss, 'ring', x, y, z, Math.max(0, d - r.r - r.width) / r.speed, { ring: r });
    hint('wp5-ring', RING_HINT);   // a no-op after the stomp's crouch showed it (bosses.js); here for any other ring
  },
  onBossDefeated(b) {
    const f = this.fight;
    const S = this.S;
    if (!b.rematch) S.bosses[b.id] = true;
    if (!b.sat) delete this.bosses[b.id];   // a sat Catcher stays on the island until the bloom
    this.events.emit(EV.BOSS_DEFEATED, { id: b.id, rematch: b.rematch });
    if (f) { f.phase = 'won'; f.wonT = 0; }
    this.ui.bossBar(null);
    if (!b.sat) this.whiteFlash = 0.8;
    for (const e of this.enemies) if (e.minion) { this.fx.poof(e.pos.x, e.pos.y, e.pos.z, 0xffffff, 8); e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    for (const p of this.projectiles) p.pop(true);
    this.projectiles = [];
    if (b.rematch) {
      // a rematch: no Starseed; the first win per guardian gives its gems once (data.js rematch.win), then it naps again
      // (spawnRematches, once the fight has wound down)
      const gems = rematch.win(S, b.id);
      sfx('fanfare');
      if (gems) this.events.emit(EV.COLLECT, { kind: 'gem', value: gems });   // the feed's "+40 gems" line and the gem sound
      this.ui.toast('✿ Rematch won: ' + b.name + '!');
      this.ui.updateHud(S);
    } else if (b.sat) {
      // the handover: no seed pickup; the cutscene gives the Starseed with the shipped item-get (cutscenes.js)
      this.save(true);
      this.startHandover(b);
      return;
    } else this.pickups.push(new Pickup('seed', b.pos.x, b.pos.z, { seedId: b.id, color: SEEDS[b.id].color, vy: 7, spread: 0, y0: 1.2 }));
    this.save(true);
  },
  endFight(reset) {
    const f = this.fight;
    if (!f) return;
    this.player.autoMove = null;          // an intro cut short (Save & Quit, respawn) leaves no walk behind
    if (f.phase === 'intro') {
      if (!f.shot) this.view.setLook(this.view.yaw, this.view.pitch); // FP: drop the intro's locked look assist
      this.events.emit(EV.CUTSCENE_END, { type: 'bossIntro' });
    }
    for (const r of f.rings) this.fx.ground.remove(r);
    if (reset && f.boss && (f.boss.rematch || !this.S.bosses[f.id])) {
      // the guardian is back asleep in its arena (a rematch one naps for another go)
      f.boss.remove();
      this.bosses[f.id] = new Boss(f.id, f.arena, { rematch: f.boss.rematch });
    }
    for (const e of this.enemies) if (e.minion) { e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.vines[f.id].target = 0;
    this.fight = null;
    this.view.clearShot(f.shot);
    this.ui.bossBar(null);
    this.ui.showBossCard('', '', false);
    this.events.emit(EV.FIGHT_END, { id: f.id, reset: !!reset });
  },
};
