// G.debug API, debug keys, collider gizmos, overlay text (Game mixin) + registerDebug for modules.
import * as THREE from 'three';
import { G } from '../core.js';
import { REGIONS, SEED_ORDER } from '../data.js';
import { Enemy } from '../entities.js';
import { EV } from '../events.js';
import { TAU, len2, mulberry32, yawOf, wrapAngle, dir3, rightXZ, clamp } from '../util.js';
import { STEP } from '../clock.js';
import { swordTest } from '../combat.js';
import { combat as TC, view as TV } from '../tune.js';
import { heartContainerBuilt } from '../models.js';
import { RigTP } from '../view/rig-tp.js';
import { vFovFor } from '../view/view.js';
import { GpuTimer, pct } from './gpu-timer.js';

const _rand = Math.random;
const r4 = (v) => +(+v).toFixed(4);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const _hb = {}, _d = new THREE.Vector3();

/** G.debug.freezeAI: an actor holds still (no AI, no movement) while its timers (spawn, i-frames, flash) still run */
export function frozenTick(o, dt) {
  if (o.dying) return o.update(dt);
  o.prev.copy(o.pos); o.prevFacing = o.facing;
  if (o.spawnT != null) o.spawnT = Math.min(1, o.spawnT + dt * 3);
  o.iframes = Math.max(0, o.iframes - dt);
  o.flash = Math.max(0, o.flash - dt * 7);
  o.squash *= Math.exp(-10 * dt);
}
/** the perf sweep's 9 locations (render map §: village spawn, four path points, the highest reachable cell, three arena
 *  interiors 4 m inside the ring on the entrance side) */
export function perfLocations(W) {
  if (W._perfLocs) return W._perfLocs;
  const L = [{ name: 'village', x: W.spawn.x, z: W.spawn.z }];
  for (const k of ['woods', 'peaks', 'shores', 'meadow']) { const pts = W.paths[k], p = pts[Math.round(pts.length * (k === 'meadow' ? 0.85 : 0.55))]; L.push({ name: k, x: p.x, z: p.z }); }
  let best = null;
  for (let j = 0; j < 360; j += 2) for (let i = 0; i < 360; i += 2) { if (W.reach && !W.reach[j * 360 + i]) continue; const x = i - 180 + 0.5, z = j - 180 + 0.5, h = W.hAt(x, z); if (!best || h > best.h) best = { x, z, h }; }
  L.push({ name: 'hilltop', x: best.x, z: best.z });
  for (const id of ['woods', 'peaks', 'shores']) { const a = W.arenas[id], dx = a.outside.x - a.x, dz = a.outside.z - a.z, l = Math.hypot(dx, dz); L.push({ name: 'arena-' + id, x: a.x + (dx / l) * (a.r - 4), z: a.z + (dz / l) * (a.r - 4), arena: id, yaw: yawOf(-dx, -dz) }); }
  return (W._perfLocs = L);
}
// natural standing distance from each kind of interactable's aim point (debug standAt)
const STAND = { npc: 1.3, sign: 1.4, door: 1.1, chest: 1.3, pedestal: 2.1, well: 2.2, shell: 1.1 };

/** expose a namespace of debug helpers as G.debug[ns] (modules call this from attach). An existing namespace is never
 *  lost: an object merges its members into it (registerDebug('cam', {…}) keeps G.debug.cam() callable and adds cam.*);
 *  a function takes the old members over and replaces it (warned under ?debug=1 when it replaces a function) */
export function registerDebug(ns, obj) {
  G.debug = G.debug || {};
  const cur = G.debug[ns], merge = cur && cur !== obj && (typeof cur === 'object' || typeof cur === 'function');
  if (merge && obj && typeof obj === 'object') return Object.assign(cur, obj);
  if (merge && typeof obj === 'function') {
    for (const k of Object.keys(cur)) if (!(k in obj)) obj[k] = cur[k];
    if (typeof cur === 'function' && G.debugOn) console.warn('[Starseed] registerDebug replaces the function G.debug.' + ns);
  }
  G.debug[ns] = obj;
  return obj;
}

// event payloads hold live objects (enemies, NPCs, meshes): keep primitives, name the rest
function flat(p) {
  const o = {};
  for (const k in p) {
    const v = p[k];
    if (v == null || typeof v !== 'object') o[k] = v;
    else o[k] = v.id ?? v.type ?? v.kind ?? v.name ?? (v.constructor && v.constructor.name) ?? 'object';
  }
  return o;
}

export const DebugMixin = {
  setupDebug() {
    const game = this, view = this.view, input = this.input;
    this.debugGizmo = null;
    G.debug = {
      /** optional yaw/pitch: also set the look (and the body facing) */
      teleport(x, z, yaw = null, pitch = 0) { const p = game.player; const y = game.world.ground(x, z); p.pos.set(x, y, z); p.prev.copy(p.pos); if (yaw != null) { p.turnTo(yaw); view.setLook(yaw, pitch); } view.snap(); game.clock.resetPhase(); return [x, y, z]; },
      giveSeeds() { for (const id of SEED_ORDER) { if (!game.S.seeds[id]) game.S.seeds[id] = 1; game.S.bosses[id] = true; if (game.bosses[id]) { game.bosses[id].remove(); delete game.bosses[id]; } } game.pickups.filter((p) => p.kind === 'seed').forEach((p) => p.remove()); game.ui.updateHud(game.S, true); game.ui.toast('Got all seeds (debug)'); },
      setTime(h) { game.S.tod = (((h % 24) + 24) % 24) / 24; return h; },
      killBoss() { const f = game.fight; if (f && f.boss && !f.boss.dying) { if (f.phase === 'intro') { f.phase = 'fight'; game.player.autoMove = null; const face = game.bossFace(f.boss); if (f.shot) view.clearShot(f.shot, { face }); else view.lookAtPoint(face.x, face.y, face.z, 0.6); game.player.state = 'normal'; game.events.emit(EV.CUTSCENE_END, { type: 'bossIntro' }); game.events.emit(EV.BOSS_FIGHT, { id: f.id }); } f.boss.hp = 0; f.boss.startDying(); return true; } return false; },
      /** teleport outside a boss arena (id 'woods' | 'peaks' | 'shores', else the nearest unbeaten one) → id */
      toBoss(id = null) { return game.debugToBoss(id); },
      /** relDeg given: deterministic, relative to the view yaw (0 = straight ahead, + = left); else a random bearing
       *  (old behaviour). o: { alt (flying altitude), face (true: turn toward Pip), state, st } → returns the type; the
       *  enemy is G.debug.last */
      spawn(type, dist = 4, relDeg = null, o = {}) {
        if (typeof o === 'number') o = { alt: o };   // arch §13 form: spawn(type, dist, relDeg, alt)
        const p = game.player; const a = relDeg == null ? Math.random() * TAU : view.yaw + relDeg * D2R;
        const e = new Enemy(type, p.pos.x + Math.sin(a) * dist, p.pos.z + Math.cos(a) * dist); e.spawnT = 1;
        if (o.alt != null) e.alt = e.altCur = o.alt;
        if (o.face) e.facing = e.prevFacing = yawOf(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        if (o.state) { e.state = o.state; e.st = o.st ?? 99; }
        game.addEnemy(e); G.debug.last = e; return type;
      },
      /** enemies hold still (timers still run); also the fight boss once the fight has started */
      freezeAI(on = true) { game.aiFrozen = !!on; return game.aiFrozen; },
      /** the time of day holds still (perf sweeps, screenshots: lighting and point lights depend on it); setTime still
       *  sets it */
      freezeTime(on = true) { game.todFrozen = !!on; return game.todFrozen; },
      /** no damage to Pip */
      god(on = true) { game.god = !!on; return game.god; },
      /** damage from a fake source 1.5 m away at relDeg from the view yaw (+ = left); returns whether it landed */
      hurt(dmg = 1, relDeg = 0) { const p = game.player.pos, a = view.yaw + relDeg * D2R; return game.playerHurt(dmg, p.x + Math.sin(a) * 1.5, p.z + Math.cos(a) * 1.5); },
      down() { game.playerDown(); return true; },
      enemies() { return game.enemies.map((e) => { const h = e.hurtbox({}); return { type: e.type, hp: e.hp, alive: e.alive, state: e.state, pos: e.pos.toArray().map(r4), alt: r4(e.altCur), y0: r4(h.y0), y1: r4(h.y1), d: r4(len2(e.pos.x - game.player.pos.x, e.pos.z - game.player.pos.z)) }; }); },
      /** the sword aim and what a full swing would hit now: { aim, interact, inCone: [{ type, dist, angH, angV, hit,
       *  hitA, hitC }] }; hit = the next swing of the chain (A, or B / C while the chain is live) */
      aim() {
        const s = game.swingState(STEP, {}), out = [], pl = game.player;
        const next = pl.state === 'attack' || pl.chainT <= TC.chainGap ? (pl.combo === 'A' ? 'B' : pl.combo === 'B' ? 'C' : 'A') : 'A';
        const test = (hb, kind) => { const w = kind === 'C' ? TC.sweepC : TC.sweepAB; return swordTest(hb, { ...s, kind, t0: w[0], t1: w[1] }); };
        const add = (o, type) => {
          const hb = o.hurtbox(_hb), dx = hb.x - s.ex, dz = hb.z - s.ez, d = Math.hypot(dx, dz);
          if (d > 8) return;
          out.push({ type, dist: r4(d), angH: +(wrapAngle(yawOf(dx, dz) - s.yaw) * R2D).toFixed(2), angV: +((Math.atan2((hb.y0 + hb.y1) / 2 - s.ey, d) - s.pitch) * R2D).toFixed(2), y0: r4(hb.y0), y1: r4(hb.y1), hit: test(hb, next), hitA: test(hb, 'A'), hitC: test(hb, 'C') });
        };
        for (const e of game.enemies) if (e.alive) add(e, e.type);
        if (game.fight && game.fight.boss) add(game.fight.boss, 'boss:' + game.fight.id);
        for (const p of game.projectiles) if (p.alive) add(p, 'projectile:' + p.kind);
        const t = game.target;
        return { aim: { yaw: r4(s.yaw), pitch: r4(s.pitch), origin: [r4(s.ex), r4(s.ey), r4(s.ez)], reach: s.reach, combo: pl.combo, next }, interact: t ? t.label : null, inCone: out };
      },
      /** current interaction target (label data + angle in degrees + distance) */
      target() { const t = game.target; return t ? { label: t.label, verb: t.verb, name: t.name, kind: t.kind, ang: t.ang == null ? null : +(t.ang * R2D).toFixed(2), dist: r4(t.dist), point: [r4(t.px), r4(t.py), r4(t.pz)] } : null; },
      /** aim the crosshair at a world point: FP from the eye; TP so the camera ray through the screen centre hits it */
      aimAt(x, y, z) {
        if (view.mode !== 'tp') return view.lookAtPoint(x, y, z);
        // r4: iterate from the real camera, not the nominal boom and shoulder (with a shortened or slid arm the crosshair
        // missed the point): each candidate look runs the live TP rig to where it settles for it (its slide, side leg,
        // pull-ins and feet drop; the frames that follow would take it there anyway), then aims from that camera
        const pl = game.player, feet = pl.root ? pl.root.position : pl.pos, W = game.world, side = view.shoulderSide();
        const tanHalf = Math.tan((vFovFor(game.settings.get('fovTP'), game.camera.aspect) * Math.PI) / 360);
        const settle = (yaw, pitch) => {
          const L = view.setLook(yaw, pitch), back = dir3(L.yaw, L.pitch, _d).multiplyScalar(-1), right = rightXZ(L.yaw);
          let c = null;
          for (let i = 0; i < 45; i++) c = view.tp.update(feet, back, right, STEP, W, side, tanHalf);
          return c;
        };
        // the crosshair ray's miss (m) for a look whose rig has settled at c; the best look found is kept: where a slide flips
        // shoulders with the aim (a trunk beside the boom) no look hits exactly, and the iteration then goes back and forth
        const missOf = (c, yaw, pitch) => { dir3(yaw, pitch, _d); const vx = x - c.x, vy = y - c.y, vz = z - c.z, k = vx * _d.x + vy * _d.y + vz * _d.z; return Math.hypot(vx - _d.x * k, vy - _d.y * k, vz - _d.z * k); };
        let yaw = yawOf(x - feet.x, z - feet.z), pitch = 0, best = null;
        for (let i = 0; i < 12; i++) {
          const c = settle(yaw, pitch), m = missOf(c, view.yaw, view.pitch);
          if (!best || m < best.m) best = { yaw: view.yaw, pitch: view.pitch, m };
          if (m < 0.002) break;
          yaw = yawOf(x - c.x, z - c.z); pitch = clamp(Math.atan2(y - c.y, Math.hypot(x - c.x, z - c.z)), TV.pitchTPDown * D2R, TV.pitchTPUp * D2R);
        }
        yaw = best.yaw; pitch = best.pitch;
        settle(yaw, pitch);
        return view.setLook(yaw, pitch);
      },
      /** stand at a natural spot in front of an interactable and aim at it: kind 'npc' (id), 'sign' | 'door' | 'chest' |
       *  'well' | 'pedestal' (index n among that kind, nearest first from the spawn), 'shell' (Clover's rainbow shell n in
       *  W.shells order, picked up or not); returns { x, z, kind, point } */
      standAt(kind, n = 0, o = {}) {
        const W = game.world;
        let pt = null, front = null;
        if (kind === 'npc' || game.npcs.some((q) => q.id === kind)) {
          const npc = game.npcs.find((q) => q.id === (kind === 'npc' ? n : kind)) || game.npcs[n | 0];
          pt = { x: npc.pos.x, y: npc.pos.y + TC.aimPts.npc[0] * npc.height, z: npc.pos.z }; front = npc.facing; kind = 'npc';
        } else if (kind === 'shell') {
          const it = (W.shells || [])[n | 0];
          if (!it) return null;
          pt = { x: it.x, y: it.y + (TC.aimPts.shell || [0.25])[0], z: it.z };
          front = yawOf(W.spawn.x - it.x, W.spawn.z - it.z);
        } else {
          const its = W.interact.filter((it) => it.kind === kind && !(it.kind === 'chest' && game.S.chests[it.chest.id])).sort((a, b) => len2(a.x - W.spawn.x, a.z - W.spawn.z) - len2(b.x - W.spawn.x, b.z - W.spawn.z));
          const it = its[n | 0];
          if (!it) return null;
          pt = { x: it.x, y: it.y + (TC.aimPts[kind] || [0.8])[0], z: it.z };
          if (kind === 'sign' && it.prop) front = it.prop.rot;
          else if (kind === 'chest') front = it.chest.rot;   // chests open from the front (the lid hinges at the back)
          else if (kind === 'door') { const h = W.houses.concat(W.shop ? [W.shop] : []).sort((a, b) => len2(a.x - it.x, a.z - it.z) - len2(b.x - it.x, b.z - it.z))[0]; front = yawOf(it.x - h.x, it.z - h.z); }
          else front = yawOf(W.spawn.x - it.x, W.spawn.z - it.z);
        }
        const dist = o.dist ?? STAND[kind] ?? 1.3;
        for (let k = 0; k < 24; k++) {
          const a = front + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (TAU / 24);
          const x = pt.x + Math.sin(a) * dist, z = pt.z + Math.cos(a) * dist;
          if (!W.walkable(x, z)) continue;
          const yaw = yawOf(pt.x - x, pt.z - z);
          G.debug.teleport(x, z, yaw, 0);
          G.debug.aimAt(pt.x, pt.y, pt.z);
          return { x: r4(x), z: r4(z), kind, point: [r4(pt.x), r4(pt.y), r4(pt.z)] };
        }
        return null;
      },
      /** named poses for screenshots/tests: { x, z, yaw, pitch } */
      pose(name) {
        const W = game.world, P = { spawn: [W.spawn.x, W.spawn.z, Math.PI, 0], 'plaza-N': [W.spawn.x, W.spawn.z, Math.PI, 0.05], 'plaza-S': [W.spawn.x, W.spawn.z, 0, 0], tree: [W.spawn.x, W.spawn.z + 4, Math.PI, 0.35] };
        for (const l of perfLocations(W)) if (!P[l.name]) P[l.name] = [l.x, l.z, l.yaw ?? Math.PI, 0];
        const q = P[name];
        if (!q) return Object.keys(P);
        G.debug.teleport(q[0], q[1], q[2], q[3]);
        return { x: q[0], z: q[1], yaw: q[2], pitch: q[3] };
      },
      info() {
        const pl = game.player, v = view, c = game.camera.position;
        return { pos: pl.pos.toArray().map((x) => +x.toFixed(2)), region: REGIONS[game.curRegion] && REGIONS[game.curRegion].id, calls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles, fps: Math.round(game.fps || 0), enemies: game.enemies.length, unreachable: game.world.unreachable.length, hitStopT: +game.clock.hitStopT.toFixed(4), alpha: +game.clock.alpha.toFixed(3), fight: game.fight ? game.fight.phase : null, modal: game.modal,
          view: v.mode, yaw: r4(v.yaw), pitch: r4(v.pitch), facing: r4(pl.facing), fovH: +v.fovH.toFixed(2), fovV: +v.fovV.toFixed(2), eye: v.eye.toArray().map(r4), camPos: [r4(c.x), r4(c.y), r4(c.z)], armLen: +v.armLen.toFixed(3), shotW: +v.shotW.toFixed(3),
          pointerLocked: !!(game.lock && game.lock.locked), lockOn: v.lockTarget ? (v.lockTarget.id || v.lockTarget.type || true) : null, grounded: pl.grounded, vy: pl.vy, target: game.target ? game.target.label : null };
      },
      player() { const p = game.player; return { pos: p.pos.toArray().map(r4), vel: [r4(p.vel.x), r4(p.vel.y)], facing: r4(p.facing), state: p.state, grounded: p.grounded, vy: p.vy, attackT: r4(p.attackT), swingId: p.swingId, walkPhase: r4(p.walkPhase), hurtDir: { ...p.hurtDir }, blinkOff: p.blinkOff, mode: p.mode }; },
      /** feel §15 aliases. manual(on): the rAF loop runs no frames (it only redraws); step()/advance() run them */
      manual(on = true) { return G.debug.clock({ manual: on }); },
      inject(o = {}) {
        if (o.look) G.debug.lookDelta(o.look[0], o.look[1] || 0);
        for (const a of o.hold || []) input.debugHold(a);
        for (const a of o.release || []) input.debugRelease(a);
        for (const a of o.press || []) input.debugPress(a);
        if (o.pad) G.debug.pad(o.pad.rx ?? null, o.pad.ry ?? 0);
        if (o.touch) { input.touchLook.x += o.touch.lookDx || 0; input.touchLook.y += o.touch.lookDy || 0; }
        return o.frames ? G.debug.advance(o.frames) : null;
      },
      world: () => game.world,
      game: () => game,
      /** clock control: { manual, redraw, timeScale } → clock state (manual holds the whole rAF frame, not just the steps;
       *  redraw: false also stops its redraw, so only the frames a test runs with draw = true reach the GPU) */
      clock(o = {}) { const c = game.clock; if ('manual' in o) c.manual = !!o.manual; if ('redraw' in o) c.redraw = !!o.redraw; if (o.timeScale != null) c.timeScale = Math.max(0, +o.timeScale || 0); return c.info(); },
      /** one input/frame pass (injected look and presses apply), then n fixed steps (frozen ticks while a hit-stop
       *  runs) + one render, synchronously; use with clock({ manual: true }) */
      step(n = 1) {
        n = Math.max(0, n | 0);
        const fdt = Math.min(game.clock.MAX_DT, Math.max(1, n) * STEP);
        input.update(fdt); game.frame(fdt, fdt);
        const r = game.clock.advance(n);
        return { ...r, pos: game.player.pos.toArray().map((v) => +v.toFixed(4)) };
      },
      /** n whole rAF-equivalent frames of `dt` (number or array) through the real loop body (snap → input → frame →
       *  steps → render), even with the manual clock; returns one record per frame. { render: false } skips the GPU
       *  draw of all but the last frame (hundreds of synchronous draws stall the page's rAF until the GPU catches up) */
      advance(n = 1, dt = STEP, o = {}) {
        const out = [];
        for (let i = 0; i < n; i++) {
          const d = Array.isArray(dt) ? dt[i % dt.length] : dt;
          game.runFrame(d, true, o.render !== false || i === n - 1);
          const c = game.clock, e = view.eye, p = game.camera.position;
          out.push({ steps: c.steps, alpha: r4(c.alpha), hitStopT: r4(c.hitStopT), eye: [r4(e.x), r4(e.y), r4(e.z)], cam: [r4(p.x), r4(p.y), r4(p.z)], yaw: +view.yaw.toFixed(6), pitch: +view.pitch.toFixed(6), fovV: +view.fovV.toFixed(3), blend: +view.blend.toFixed(3), shotW: +view.shotW.toFixed(3), body: view.bodyVisible, facing: +game.player.facing.toFixed(6), pState: game.player.state });
        }
        return out;
      },
      // ---- view / look (arch §13; feel §15 names are aliases)
      setView(mode, o = {}) { view.setMode(mode, { instant: o.instant !== false }); game.settings.set('view', view.mode); return view.mode; },
      view(mode, o) { return mode ? G.debug.setView(mode, o) : view.mode; },
      look(yaw, pitch = 0) { return view.setLook(yaw, pitch); },
      /** mouse counts through the real path (outlier filter, sensitivity, invert); split into ≤ 250-count events unless single */
      lookDelta(dx, dy = 0, o = {}) {
        if (o.single) return input.addMouse(dx, dy);
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 250));
        for (let i = 0; i < n; i++) input.addMouse(dx / n, dy / n);
        return true;
      },
      lookAt(x, y, z) { return view.lookAtPoint(x, y, z); },
      /** set the current mode's horizontal FOV setting (16:9 degrees); returns the live values */
      fov(h) { if (h != null) game.settings.set(view.mode === 'tp' ? 'fovTP' : 'fovFP', h); return { h: +view.fovH.toFixed(3), v: +view.fovV.toFixed(3), px: +view.px.toFixed(2), setting: game.settings.get(view.mode === 'tp' ? 'fovTP' : 'fovFP') }; },
      press(a, ms = 80) { input.debugPress(a, ms); return a; },
      hold(a, ms = 0) { input.debugHold(a, ms); return a; },
      release(a) { input.debugRelease(a); return a || null; },
      move(x, y, ms = 0) { input.debugAxis = x || y ? { x, y } : null; if (ms > 0) setTimeout(() => { input.debugAxis = null; }, ms); return input.debugAxis; },
      /** raw right-stick override { rx, ry } (null clears) */
      pad(rx, ry) { input.debugStick = rx == null ? null : { rx, ry }; return input.debugStick; },
      /** seeds Math.random (mulberry32) for deterministic AI in tests; seed(null) restores it */
      seed(n) { Math.random = n == null ? _rand : mulberry32(n >>> 0); return n ?? null; },
      cam() { return { ...view.info(), lock: game.lock ? game.lock.info() : null, device: input.lastDevice }; },
      lock() { return game.lock ? game.lock.info() : { supported: false }; },
      /** last n events: payload fields flattened in, but n / type / t (sim time) always win; the whole payload is also under data */
      events(n = 64) { return game.events.log.slice(-n).map((r) => { const d = flat(r.payload); return { ...d, n: r.n, type: r.type, t: +r.t.toFixed(4), data: d }; }); },
      clearEvents() { game.events.clearLog(); },
      settings(patch) { if (patch) for (const k in patch) game.settings.set(k, patch[k]); return game.settings.all(); },
      /** feel §15 alias: trauma shake (legacy 0.15..1.2 scale) */
      shake(a = 0.5, src = null) { view.shake(a, src); return view.shk.trauma; },
      /** start a cinematic: 'place' (pedestal; gives one seed if none is carried), 'ending', 'bossIntro' (id: woods |
       *  peaks | shores, else the nearest unbeaten boss; Pip is put just inside the ring and the next step starts it),
       *  'itemGet' (feel alias: a heart-container presentation) → true when started */
      cutscene(name, id = null) {
        const W = game.world, S = game.S;
        if (game.state !== 'play') return false;
        if (name === 'place') {
          if (!SEED_ORDER.some((k) => S.seeds[k] === 1)) {
            const k = SEED_ORDER.find((q) => S.seeds[q] !== 2);
            if (!k) return false;
            // the seed's boss counts as beaten: it leaves the island like giveSeeds' (an awake boss left in game.bosses
            // would keep running its AI with no fight)
            if (game.fight && game.fight.id === k) game.endFight(true);
            if (game.bosses[k]) { game.bosses[k].remove(); delete game.bosses[k]; }
            S.seeds[k] = 1; S.bosses[k] = true;
          }
          G.debug.teleport(W.pedestal.x, W.pedestal.z + 2.2, Math.PI, -0.2);
          game.usePedestal(); return !!game.cutscene;
        }
        if (name === 'ending') { game.startEnding(); return true; }
        if (name === 'itemGet') { game.itemGet(heartContainerBuilt(), 'heart_container', ['A debug Heart Container!']); return true; }
        if (name === 'bossIntro') {
          const bid = game.debugToBoss(id);
          if (!bid) return false;
          const a = W.arenas[bid], d = a.r - 3.2, x = a.x + Math.sin(a.entAng) * d, z = a.z + Math.cos(a.entAng) * d;
          G.debug.teleport(x, z, yawOf(a.x - x, a.z - z), game.defaultPitch());
          return true;
        }
        return false;
      },
      /** hide / show every HUD element (golden screenshots); the dialogue box and menus stay */
      hud(on = true) {
        const ui = game.ui;
        for (const e of [ui.hud, ui.promptEl, ui.crossEl, ui.floatRoot, ui.toastEl, ui.banner, ui.bossbar, ui.bosscard, ui.debugEl, ui.veilEl, input.touchRoot]) if (e) e.style.visibility = on ? '' : 'hidden';
        game.hudOff = !on;
        return !!on;
      },
      /** TP spring arm as a pure query at (x, z) with look (yaw, pitch): a scratch rig settles for 30 frames →
       *  { cam: [x, y, z], armLen, hit (anything shortened it), collide (a collider did) } */
      armProbe(x, z, yaw, pitch = (TV.tpPitch * Math.PI) / 180) {
        const W = game.world, rig = new RigTP(), feet = { x, y: W.ground(x, z), z }, side = view.shoulderSide();
        const back = dir3(yaw, pitch, _d).clone().multiplyScalar(-1), right = rightXZ(yaw);
        const tanHalf = Math.tan((vFovFor(game.settings.get('fovTP'), game.camera.aspect) * Math.PI) / 360);
        rig.boom = view.tp.boom; rig.snap(feet, side);
        let c = null;
        for (let i = 0; i < 30; i++) c = rig.update(feet, back, right, STEP, W, side, tanHalf);
        return { cam: [r4(c.x), r4(c.y), r4(c.z)], armLen: r4(rig.arm), hit: rig.hit, collide: rig.collide };
      },
      /** frame cost over ms of real frames (async): rAF fps, CPU frame ms (game.frameMs), GPU ms per pass from the timer
       *  query when available (main = shadow + world pass; vm = viewmodel pass), draw calls / triangles of the whole
       *  frame (all passes), DPR, the time of day it was sampled at (hours; counts depend on it: pin it with setTime +
       *  freezeTime) → { fps, cpuMs: {p50, p90}, gpuMain: {p50, p90, n} | null, gpuVm, calls, tris, dpr, tod } */
      async perf(o = {}) {
        const ms = o.ms ?? 2000, r = game.renderer;
        const gt = (game.gpuT = new GpuTimer(r.getContext()));
        const smp = game.perfSampler || (game.perfSampler = game.addModule({ name: 'debug-perf', active: null, afterRender(rr) { const a = this.active; if (!a) return; if (game.gpuT) game.gpuT.poll(); a.calls.push(rr.info.render.calls); a.tris.push(rr.info.render.triangles); a.cpu.push(game.frameMs || 0); } }));
        const rec = (smp.active = { calls: [], tris: [], cpu: [] });
        const raf = () => new Promise((res) => requestAnimationFrame(res));
        const t0 = performance.now();
        let n = 0;
        while (performance.now() - t0 < ms) { await raf(); n++; }
        const el = performance.now() - t0;
        smp.active = null;
        for (let i = 0; i < 8 && gt.pending.length; i++) { await raf(); gt.poll(); }
        game.gpuT = null; gt.dispose();
        const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);
        return {
          fps: +((n * 1000) / el).toFixed(1), frames: n, cpuMs: pct(rec.cpu), gpuMain: pct(gt.samples.main), gpuVm: pct(gt.samples.vm), gpuTimer: gt.ok, gpuDropped: gt.dropped,
          calls: med(rec.calls), tris: med(rec.tris), dpr: r.getPixelRatio(), size: [r.domElement.width, r.domElement.height], view: view.mode,
          tod: game.S ? +(game.S.tod * 24).toFixed(2) : null,
        };
      },
      /** in-page test suites (js/debug/tests.js, loaded on first use, only with ?debug=1): run(name | 'all') → Promise of
       *  { suite, pass, fail, ms, results: [{ name, pass, msg, data }] }; list() → suite names */
      test: {
        async run(name = 'all', o = {}) {
          if (!G.debugAllowed) return { suite: name, pass: 0, fail: 1, results: [{ name: 'load', pass: false, msg: 'in-page tests need ?debug=1' }] };
          const T = await import('./tests.js');
          return T.run(name, o);
        },
        async list() { if (!G.debugAllowed) return []; const T = await import('./tests.js'); return T.list(); },
      },
    };
    this.gpuT = null;
  },
  registerDebug(ns, obj) { return registerDebug(ns, obj); },
  debugToBoss(want = null) {
    const pl = this.player;
    let best = null, bd = Infinity;
    for (const id of SEED_ORDER) {
      if (this.S.bosses[id] || (want && id !== want)) continue;
      const a = this.world.arenas[id];
      const d = len2(a.x - pl.pos.x, a.z - pl.pos.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { this.ui.toast('All bosses beaten!'); return null; }
    G.debug.teleport(best.outside.x, best.outside.z);
    const yaw = Math.atan2(best.x - best.outside.x, best.z - best.outside.z);
    this.player.turnTo(yaw);
    this.view.setLook(yaw, this.defaultPitch());
    this.view.snap();
    return best.id;
  },
  debugKeys(input) {
    if (!G.debugAllowed) return;     // a player build (no ?debug=1): ` and the cheat keys are ordinary keys that do nothing
    if (input.keyPressed('Backquote')) { G.debugOn = !G.debugOn; if (!G.debugOn) { this.ui.setDebug(null); this.setGizmos(false); } }
    if (!G.debugOn || this.state !== 'play' || !this.playing) return;
    const tp = { Digit1: 'village', Digit2: 'woods', Digit3: 'peaks', Digit4: 'shores', Digit5: 'meadow' };
    for (const k in tp) if (input.keyPressed(k)) {
      const id = tp[k];
      const W = this.world;
      let p = W.spawn;
      if (id !== 'village') { const pts = W.paths[id]; p = pts[Math.round(pts.length * (id === 'meadow' ? 0.85 : 0.55))]; }
      G.debug.teleport(p.x, p.z);
      this.ui.toast('Teleport: ' + id);
    }
    if (input.keyPressed('KeyG')) { this.S.coins += 100; this.ui.toast('+100 gems (debug)'); }
    if (input.keyPressed('KeyH')) { this.S.hp = this.S.maxHp; this.ui.toast('Healed (debug)'); }
    if (input.keyPressed('KeyB')) this.debugToBoss();
    if (input.keyPressed('KeyN')) { this.S.tod = (this.S.tod + 0.125) % 1; this.ui.toast('Time ' + (this.S.tod * 24).toFixed(1) + 'h'); }
    if (input.keyPressed('KeyC')) this.setGizmos(!this.gizmosOn);
  },
  setGizmos(on) {
    this.gizmosOn = on;
    if (this.debugGizmo) { this.scene.remove(this.debugGizmo); this.debugGizmo.geometry.dispose(); this.debugGizmo = null; }
  },
  rebuildGizmos() {
    if (this.debugGizmo) { this.scene.remove(this.debugGizmo); this.debugGizmo.geometry.dispose(); }
    const pl = this.player.pos;
    const pts = [];
    const circle = (x, z, r, y) => { const n = 16; for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; pts.push(x + Math.sin(a0) * r, y, z + Math.cos(a0) * r, x + Math.sin(a1) * r, y, z + Math.cos(a1) * r); } };
    const list = [];
    this.world.nearColliders(pl.x, pl.z, 22, list);
    for (const c of list) circle(c.x, c.z, c.r, this.world.ground(c.x, c.z) + 0.15);
    for (const id in this.world.arenas) { const a = this.world.arenas[id]; if (len2(a.x - pl.x, a.z - pl.z) < 60) circle(a.x, a.z, a.r, a.h + 0.2); }
    circle(pl.x, pl.z, this.player.r, pl.y + 0.15);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.debugGizmo = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff2060, depthTest: false }));
    this.debugGizmo.renderOrder = 99;
    this.scene.add(this.debugGizmo);
  },
  updateDebug(dt) {
    if (!G.debugOn) return;
    if (this.gizmosOn) { this._gzT = (this._gzT || 0) - dt; if (this._gzT <= 0) { this._gzT = 0.4; this.rebuildGizmos(); } }
    const info = this.renderer.info;
    const pl = this.player.pos;
    const R = REGIONS[this.curRegion];
    this.ui.setDebug([
      `FPS ${Math.round(this.fps || 0)}  frame ${(this.frameMs || 0).toFixed(1)}ms  calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k  geo ${info.memory.geometries} tex ${info.memory.textures}  long ${this.clock.longFrames}`,
      `${R ? R.name : '-'}  pos ${pl.x.toFixed(1)}, ${pl.y.toFixed(1)}, ${pl.z.toFixed(1)}  slope ${this.world.slopeAt(pl.x, pl.z).toFixed(2)}  tod ${(this.S.tod * 24).toFixed(1)}h`,
      `view ${this.view.mode}${this.view.blend > 0 && this.view.blend < 1 ? '~' : ''}  yaw ${(this.view.yaw * 57.2958).toFixed(1)}°  pitch ${(this.view.pitch * 57.2958).toFixed(1)}°  fov ${this.view.fovH.toFixed(0)}/${this.view.fovV.toFixed(0)}  arm ${this.view.armLen.toFixed(2)}  shot ${this.view.shotW.toFixed(2)}  lock ${this.lock ? (this.lock.locked ? 'on' : this.lock.supported ? 'off' : 'n/a') : '-'}  grounded ${this.player.grounded} vy ${this.player.vy.toFixed(1)}`,
      `enemies ${this.enemies.length}  proj ${this.projectiles.length}  pickups ${this.pickups.length}  particles ${this.fx.norm.list.length}+${this.fx.add.list.length}  unreachable ${this.world.unreachable.length}  carved ${this.world.carved}`,
      `keys: 1-5 teleport  G +100 gems  H heal  B boss  N +3h  C colliders  \` hide`,
    ].join('\n'));
  },
};
