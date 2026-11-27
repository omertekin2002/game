// In-page test suites (arch §15.1 item 12, §15.4). Loaded only by G.debug.test.run / list (dynamic import, ?debug=1),
// so normal play never pays for them. Run: `await G.debug.test.run('look')` → { suite, pass, fail, ms, results:
// [{ suite, name, pass, msg, checks, ms, data }] }; run('all') runs every suite not marked heavy; list() → suite info.
//
// Registering suites (work packages: in your own js/debug/tests/wpN.js, never in this file):
//   export default function register(suite) {
//     suite('wp3', [
//       ['jump apex 0.87 m', async (t) => { t.press('jump'); t.frames(30); t.near(apex, 0.87, 0.03, 'apex'); }],
//     ], { desc: 'physics', prepare: { view: 'fp', pose: 'spawn', god: true }, heavy: false });
//   }
// Every test starts from prepare(): manual clock (frames only through t.frames), Math.random seeded, play state with no
// dialogue / menu / shop / cutscene / fight, enemies and projectiles removed, full hearts, noon, FP (or opts.view),
// default look settings, Pip at the pose (D.pose name, or at: [x, z, yaw, pitch]). After the run the stored save and the
// settings are put back and the session is reloaded from that save (run(name, { keep: true }) skips the reload).
// The context t: { G, game, D (G.debug), view, pl, W, ui, input, settings, EV, STEP, THREE,
//   ok(cond, msg, data), eq(a, b, msg), near(a, b, tol, msg), note(key, value) (→ result.data),
//   frames(n, { dt = 1/60 | dt[], draw = false }) (whole frames through the real loop body), press(action) (edge),
//   hold(action) / release(action?), move(x, y), wait(ms) (real time; gameplay ignores attack 120 ms after a modal),
//   nextFrame(ms = 20000) (one real animation frame → true: every rAF callback queued before it has run, e.g.
//   ui.showOverlay's .show; false if none came within ms), settle() (finishes the running CSS transitions: their timeline
//   only moves with rendered frames),
//   dlgDone() (advances dialogue to its end), events(type) (payloads from the event log), clearEnemies(), resetPlayer(),
//   swing(o) (one deterministic swing at a spawned enemy → { hit, dmg, stop, clink, kinds }) }.
// A test with no checks fails ('no checks'); a throw fails it with the message.
import * as THREE from 'three';
import { G, store } from '../core.js';
import { EV } from '../events.js';
import { SAVE_KEY } from '../data.js';
import { SAVE_VERSION } from '../save.js';
import { settings, SCHEMA, SETTINGS_KEY } from '../settings.js';
import { STEP } from '../clock.js';
import { LAYER, wrapAngle, yawOf, dir3 } from '../util.js';
import { combat as TC, view as TV } from '../tune.js';
import { perfLocations } from './debug.js';
import { Boss } from '../bosses.js';
import wp1 from './tests/wp1.js';
import wp2 from './tests/wp2.js';
import wp3 from './tests/wp3.js';
import wp4 from './tests/wp4.js';
import wp5 from './tests/wp5.js';
import wp6 from './tests/wp6.js';
import wp7 from './tests/wp7.js';
import wp8 from './tests/wp8.js';
import wp9 from './tests/wp9.js';
import act1 from './tests/act1.js';

const D2R = Math.PI / 180;
const SUITES = new Map();

/** register a suite: tests = [[name, fn(t)], ...] or { name: fn }; o = { desc, prepare: {...}, heavy } */
export function suite(name, tests, o = {}) {
  SUITES.set(name, { name, tests: Array.isArray(tests) ? tests : Object.entries(tests), o });
  return name;
}
export function list() { return [...SUITES.values()].map((s) => ({ name: s.name, desc: s.o.desc || '', tests: s.tests.length, heavy: !!s.o.heavy, names: s.tests.map(([tn]) => tn) })); }

// ------------------------------------------------------------------ runner
function ctx(res, opts = {}) {
  const game = G.game, D = G.debug;
  const t = {
    opts, G, game, D, EV, STEP, THREE, view: game.view, pl: game.player, W: game.world, ui: game.ui, input: game.input, settings,
    ok(cond, msg = 'check failed', data) {
      res.checks++;
      if (!cond && res.pass) { res.pass = false; res.msg = msg; if (data !== undefined) res.data.fail = data; }
      return !!cond;
    },
    eq(a, b, msg = 'eq') { return t.ok(a === b, `${msg}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
    near(a, b, tol, msg = 'near') { return t.ok(Number.isFinite(a) && Math.abs(a - b) <= tol, `${msg}: ${+(+a).toFixed(6)} vs ${b} ± ${tol}`); },
    note(k, v) { res.data[k] = v; return v; },
    frames(n = 1, o = {}) {
      const dt = o.dt ?? STEP;
      for (let i = 0; i < n; i++) game.runFrame(Array.isArray(dt) ? dt[i % dt.length] : dt, true, !!o.draw && i === n - 1);
    },
    press(a) { D.press(a, 0); }, hold(a) { D.hold(a); }, release(a) { D.release(a); }, move(x, y) { D.move(x, y); },
    wait(ms) { return new Promise((r) => setTimeout(r, ms)); },
    // (callbacks requested earlier run first in the same frame, so no fixed wait is needed. The rAF frame waits for the
    // GPU: with the manual clock's redraw, a software-WebGL frame of the island can take seconds in headless Chromium)
    nextFrame(ms = 20000) {
      return new Promise((r) => { const to = setTimeout(() => r(false), ms); requestAnimationFrame(() => { clearTimeout(to); r(true); }); });
    },
    settle() {
      document.documentElement.getBoundingClientRect();           // style changes made since the last frame start theirs
      for (const a of document.getAnimations ? document.getAnimations() : []) if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) try { a.finish(); } catch (e) { /* ignore */ }
    },
    dlgDone(max = 80) { for (let i = 0; i < max && game.ui.dlg; i++) { D.press('interact', 0); t.frames(3); } return !game.ui.dlg; },
    events(type) { return game.events.log.filter((r) => r.type === type).map((r) => r.payload); },
    clearEnemies() {
      for (const e of game.enemies) e.remove();
      game.enemies = [];
      for (const p of game.projectiles) p.pop(false);
      game.projectiles = [];
    },
    resetPlayer() {
      const pl = game.player;
      pl.state = 'normal'; pl.attackT = 0; pl.chainT = 9; pl.restT = 0; pl.combo = 'A'; pl.attackBuffer = 0; pl.dashBuffer = 0;
      pl.vel.set(0, 0); pl.iframes = 0; pl.hurtT = 0; pl.frozen = false; pl.autoMove = null; pl.walkPhase = 0; pl.stepIdx = 0; pl.squash = 0; pl.flash = 0;
      game.clock.hitStopT = 0; game.clearPresses();
    },
    /** one swing at a spawned enemy: o = { type, dist, rel (deg, + = left), pitch (deg), alt, face, state, chainC (make it
     *  the C of a live chain), x, z, yaw } → { hit, dmg, stop (hit-stop frames), clink, kinds } */
    swing(o) {
      const pl = game.player;
      t.clearEnemies(); t.resetPlayer();
      D.teleport(o.x ?? 0, o.z ?? 9.5, o.yaw ?? 0, (o.pitch ?? 0) * D2R);
      t.frames(1);
      D.spawn(o.type, o.dist, o.rel ?? 0, { alt: o.alt, face: o.face, state: o.state });
      const e = D.last, hp0 = e.hp;
      e.iframes = 0; e.lastSwing = -1;
      if (o.chainC) { pl.combo = 'B'; pl.chainT = 0; }
      D.clearEvents();
      t.press('attack');
      let hit = false, stop = 0;
      for (let i = 0; i < (o.frames || 30); i++) {
        t.frames(1);
        const steps = game.clock.steps;
        if (!hit && (e.hp < hp0 || !e.alive)) hit = true;
        else if (hit && steps === 0) stop++;
        else if (hit && stop) break;
      }
      const evs = game.events.log;
      const out = { hit, dmg: hp0 - Math.max(0, e.hp), stop, clink: evs.some((r) => r.type === 'clink'), kinds: evs.filter((r) => r.type === 'swing').map((r) => r.payload.kind).join(''), hitDmg: (evs.find((r) => r.type === 'hit') || { payload: {} }).payload.dmg };
      t.clearEnemies();
      return out;
    },
  };
  return t;
}

/** deterministic start state for one test (see the header) */
async function prepare(t, o = {}) {
  const { game, D, ui } = t;
  D.manual(true);
  if (game.state !== 'play') { game.newGame(); t.frames(75); }
  for (let k = 0; k < 8; k++) {
    if (game.trans) t.frames(70);
    if (ui.dlg) t.dlgDone();
    if (ui.shop) ui.closeShop();
    if (ui.menu === 'controls') ui.closeControls();
    else if (ui.menu && ui.menu !== 'ending') ui.closeMenu(true);
    if (!game.trans && !ui.dlg && !ui.shop && !ui.menu) break;
  }
  if (game.cutscene) { game.view.clearShot(); game.cutscene = null; game.skipScene = null; }
  if (game.watchers) game.clearWatchers();   // the bloom watchers (S-006) go with a dropped ending
  if (game.fight) game.endFight(true);
  // no boss is awake outside a fight (its AI would keep stomping and shaking the camera island-wide); a Catcher sitting
  // after its handover (S-005) stays while it is beaten
  for (const id in game.bosses) { const b = game.bosses[id]; if (b.sat ? !game.S.bosses[id] : b.state !== 'sleep' || b.dying) { b.remove(); if (game.S.bosses[id]) delete game.bosses[id]; else game.bosses[id] = new Boss(id, game.world.arenas[id]); } }
  t.clearEnemies(); t.resetPlayer();
  for (const p of game.pickups) p.remove();
  game.pickups = [];
  game.clearHeldItem();
  const S = game.S;
  S.hp = S.maxHp;
  if (o.sword) { S.swordLevel = o.sword; game.player.setSword(o.sword); }
  D.seed(o.seed ?? 1); D.god(!!o.god); D.freezeAI(!!o.freeze); D.freezeTime(false); D.hud(true);
  D.release(); D.move(0, 0); D.pad(null);
  for (const [k, v] of Object.entries({ sens: 1, invertY: false, invertX: false, padInvertY: false, padInvertX: false, padCurve: 'default', padSens: 1, touchSens: 1, arrowLook: false, fovFP: 100, fovTP: 90, tpShoulder: 'right', reduceMotion: false, shake: 1, ...(o.settings || {}) })) settings.set(k, v);
  D.setView(o.view || 'fp');
  game.view.tp.boom = TV.tpBoom;
  D.setTime(o.time ?? 12);
  if (o.at) D.teleport(o.at[0], o.at[1], o.at[2] ?? Math.PI, o.at[3] ?? 0); else D.pose(o.pose || 'spawn');
  game.input.takeMouse(); game.input.takeTouch(); game.input.takeWheel();
  game.view.shk.reset();
  // render-time clocks restart too (viewmodel breathing, shader time, cloud drift, the target's hysteresis stamps), the
  // villagers go back to their spots and live particles go, so a test sees the same frames whatever ran before it
  game.time = 0; game._tgt = null; game.target = null; game.spawnT = 0; game.ambT = 0;
  game.npcs.forEach((n, i) => {
    const sp = game.world.npcSpots[n.id];
    n.pos.set(n.home.x, game.world.ground(n.home.x, n.home.z), n.home.z); n.prev.copy(n.pos);
    n.facing = n.prevFacing = sp && sp.rot != null ? sp.rot : 0;
    n.state = 'idle'; n.st = 2; n.talking = false; n.hop = n.hopV = 0; n.ph = i * 1.3;
    n.follow = false; n.homing = false; n.stuckT = 0;   // out of Ribbit's parade follow mode
  });
  for (const P of [game.fx.norm, game.fx.add]) { P.free.push(...P.list); P.list.length = 0; }
  for (const r of game.regrow) { r.o.cut = false; game.scenery.show(r.o); if (r.o.collider) r.o.collider.active = true; }
  game.regrow = [];                                  // grass / bushes / pots cut by earlier swings grow back at once
  t.frames(2);
  D.clearEvents();
  const left = 125 - (performance.now() - game.modalClosedAt);   // the closing press of a modal never swings
  if (left > 0) await t.wait(left);
}

function snapshot() {
  const game = G.game;
  return { save: store.get(SAVE_KEY), settings: settings.all(), state: game.state, manual: game.clock.manual };
}
async function restore(snap, o) {
  const game = G.game, D = G.debug;
  for (const k in SCHEMA) settings.set(k, snap.settings[k]);
  settings.flush();
  if (snap.save) store.set(SAVE_KEY, snap.save); else store.del(SAVE_KEY);
  D.seed(null); D.god(false); D.freezeAI(false); D.freezeTime(false); D.hud(true); D.release(); D.move(0, 0); D.pad(null);
  D.manual(snap.manual);
  if (o.keep) return;
  if (snap.save && snap.state === 'play') game.continueGame();          // the session as it was saved
  else if (snap.state === 'title') { game.resetEntities(); game.ui.showHud(false); game.ui.setPrompt(null); game.showTitle(); }
}

export async function run(name = 'all', o = {}) {
  const names = name === 'all' ? [...SUITES.values()].filter((s) => !s.o.heavy).map((s) => s.name) : [].concat(name);
  const out = { suite: name, pass: 0, fail: 0, ms: 0, results: [] };
  const T0 = performance.now(), snap = snapshot();
  try {
    for (const n of names) {
      const s = SUITES.get(n);
      if (!s) { out.fail++; out.results.push({ suite: n, name: '(suite)', pass: false, msg: 'no such suite', checks: 0, data: {} }); continue; }
      for (const [i, [tn, fn]] of s.tests.entries()) {
        if (o.only && !String(tn).includes(o.only)) continue;
        // tests/inpage.mjs (headless CI): o.shard = [k, n] runs every n-th test from the k-th (1-based); o.skip: exact
        // test names not to run (ones software WebGL cannot pass), reported as skipped; o.onResult(res) after each test
        if (o.shard && i % o.shard[1] !== o.shard[0] - 1) continue;
        if (o.skip && o.skip.includes(tn)) { const res = { suite: n, name: tn, pass: false, skipped: true, msg: 'skipped', checks: 0, ms: 0, data: {} }; out.results.push(res); if (o.onResult) o.onResult(res); continue; }
        const res = { suite: n, name: tn, pass: true, msg: null, checks: 0, ms: 0, data: {} };
        const t = ctx(res, o), t0 = performance.now();
        try { await prepare(t, { ...(s.o.prepare || {}), ...(fn.prepare || {}) }); await fn(t); }
        catch (e) { res.pass = false; res.msg = 'threw: ' + (e && e.message ? e.message : e); res.data.stack = String(e && e.stack || '').split('\n').slice(0, 4).join(' | '); }
        if (res.pass && res.checks === 0) { res.pass = false; res.msg = 'no checks'; }
        res.ms = +(performance.now() - t0).toFixed(1);
        if (res.pass) out.pass++; else out.fail++;
        out.results.push(res);
        if (o.onResult) o.onResult(res);
      }
    }
  } finally {
    try { G.debug.release(); G.debug.move(0, 0); } catch (e) { /* ignore */ }
    await restore(snap, o);
  }
  out.ms = +(performance.now() - T0).toFixed(0);
  return out;
}

// ------------------------------------------------------------------ helpers
const finite = (...a) => a.every((v) => Number.isFinite(v));
const camOk = (c) => finite(c.position.x, c.position.y, c.position.z, c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w);
const wrapDiff = (a, b) => wrapAngle(a - b);
/** queue a copy of the drawing buffer into a pixel-pack buffer (call right after drawing, in the same task); the copy
 *  is fetched once its fence signals, so the GPU never stalls */
function grab(gl) {
  const n = gl.drawingBufferWidth * gl.drawingBufferHeight * 4, buf = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf); gl.bufferData(gl.PIXEL_PACK_BUFFER, n, gl.STREAM_READ);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
  return { buf, sync, n };
}
async function fetchGrab(gl, g) {
  for (let i = 0; i < 400 && gl.clientWaitSync(g.sync, 0, 0) === gl.TIMEOUT_EXPIRED; i++) await new Promise((r) => setTimeout(r, 5));
  gl.deleteSync(g.sync);
  const out = new Uint8Array(g.n);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, g.buf); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  gl.deleteBuffer(g.buf);
  return out;
}
/** mean luminance (0–255, Rec. 709 on the sRGB bytes) of the screen pixels the viewmodel pass draws: the pass is drawn
 *  over a flat black frame (not the world, so neither the pixel mask nor the MSAA edges depend on what stands behind the
 *  blade), each copied off the drawing buffer before the browser presents it */
async function vmLuma(game) {
  const r = game.renderer, gl = r.getContext(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  r.setClearColor(0x000000, 1); r.clear(); const g0 = grab(gl);
  game.afterRender(0); const g1 = grab(gl);
  r.setClearColor(cc, ca);
  const off = await fetchGrab(gl, g0), on = await fetchGrab(gl, g1);
  let n = 0, s = 0;
  for (let i = 0; i < on.length; i += 4) {
    if (Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) < 18) continue;
    n++; s += 0.2126 * on[i] + 0.7152 * on[i + 1] + 0.0722 * on[i + 2];
  }
  return { px: n, sword: +(s / Math.max(1, n)).toFixed(1) };
}

// ------------------------------------------------------------------ smoke
suite('smoke', [
  ['stable test surface (RULINGS §2.4)', (t) => {
    const { game, D } = t;
    for (const k of ['teleport', 'spawn', 'setTime', 'toBoss', 'killBoss', 'giveSeeds', 'info', 'game', 'world']) t.ok(typeof D[k] === 'function', 'G.debug.' + k);
    t.ok(G.game === game && G.player === game.player, 'G.game / G.player');
    t.ok(typeof game.newGame === 'function', 'G.game.newGame');
    t.eq(game.state, 'play', 'state'); t.eq(game.playing, true, 'playing');
    t.ok(game.S && game.S.v === SAVE_VERSION, 'S.v ' + SAVE_VERSION); t.ok(typeof game.fps === 'number', 'fps');
    t.ok(D.game() === game && D.world() === game.world, 'game() / world()');
  }],
  ['debug API v2 (arch §13 + feel §15 aliases)', (t) => {
    const { D } = t;
    const names = ['setView', 'view', 'look', 'lookDelta', 'lookAt', 'fov', 'press', 'hold', 'release', 'move', 'clock', 'step', 'seed', 'spawn', 'freezeAI', 'freezeTime', 'god', 'hurt', 'down', 'cutscene', 'toBoss', 'events', 'clearEvents', 'aim', 'hud', 'pose', 'perf', 'info',
      'manual', 'advance', 'inject', 'cam', 'player', 'vm', 'settings', 'lock', 'armProbe', 'shake', 'pad', 'target', 'aimAt', 'standAt', 'enemies'];
    const missing = names.filter((k) => typeof D[k] !== 'function');
    t.ok(!missing.length, 'missing: ' + missing.join(', '));
    t.ok(D.test && typeof D.test.run === 'function' && typeof D.test.list === 'function', 'test.run / test.list');
    t.ok(typeof D.vm.state === 'function', 'vm.state');
  }],
  ['info() has the arch §13 fields', (t) => {
    const i = t.D.info();
    const keys = ['pos', 'region', 'view', 'yaw', 'pitch', 'fovH', 'fovV', 'eye', 'camPos', 'armLen', 'shotW', 'target', 'pointerLocked', 'lockOn', 'grounded', 'vy', 'hitStopT', 'fight', 'calls', 'tris', 'fps', 'enemies', 'unreachable'];
    const missing = keys.filter((k) => !(k in i));
    t.ok(!missing.length, 'missing: ' + missing.join(', '));
  }],
  ['world reachability + baked collider fields', (t) => {
    const W = t.W;
    t.eq(W.unreachable.length, 0, 'unreachable');
    let bad = null;
    for (const c of W.colliders) {
      if (!(finite(c.y0, c.y1, c.camTop, c.rEye) && c.y1 > c.y0 && c.camTop >= c.y0 && c.camTop <= c.y1 + 1e-9 && c.rEye > 0 && (c.shape === 'circle' || c.shape === 'obb' || c.shape === 'star'))) { bad = { kind: c.kind, y0: c.y0, y1: c.y1, camTop: c.camTop, rEye: c.rEye, shape: c.shape }; break; }
    }
    t.ok(!bad, 'collider fields', bad); // WP3: + shape 'star' (the Great Tree's measured outline)
    // chests have no prop table geometry: their y1 must reach the built chest's closed lid (Box3, lid shut)
    const bb = new t.THREE.Box3(), dy = [];
    for (const ch of G.scenery.chests.values()) {
      const rx = ch.lid.rotation.x;
      ch.lid.rotation.x = 0; ch.group.updateMatrixWorld(true); bb.setFromObject(ch.group);
      ch.lid.rotation.x = rx; ch.group.updateMatrixWorld(true);
      const c = W.colliders.find((q) => q.kind === 'chest' && Math.abs(q.x - ch.data.x) < 0.05 && Math.abs(q.z - ch.data.z) < 0.05);
      dy.push(c ? +(bb.max.y - c.y1).toFixed(3) : null);
    }
    t.ok(dy.length > 0 && dy.every((d) => d != null && Math.abs(d) <= 0.02), 'chest y1 = closed lid top ± 2 cm', dy);
    const out = [];
    W.nearColliders(0, 0, 40, out);
    t.ok(out.length > 20 && new Set(out).size === out.length, 'nearColliders dedupe (' + out.length + ')');
  }],
  ['probeSegment / groundFor v1', (t) => {
    const W = t.W, o = {};
    const near = [];
    W.nearColliders(-4, -60, 40, near);
    const c = near.find((q) => q.kind === 'tree_round');
    t.ok(!!c, 'a tree near the woods path');
    const y = c.y0 + 1.0, ex = { colliders: true, terrain: false, water: false, decks: false, ignore: (q) => q !== c };
    const tt = W.probeSegment(c.x - 3, y, c.z, c.x + 3, y, c.z, 0.22, ex);
    t.near(tt, (3 - (c.r + 0.22)) / 6, 1e-6, 'trunk contact t');
    t.eq(ex.kind, 'collider', 'kind');
    t.eq(W.probeSegment({ x: c.x - 3, y, z: c.z }, { x: c.x + 3, y, z: c.z }, 0.22, { ...ex }), tt, 'object form = scalar form');
    t.eq(W.probeSegment(c.x - 3, c.camTop + 0.5, c.z, c.x + 3, c.camTop + 0.5, c.z, 0.22, ex), 1, 'above the trunk top (camTop) is clear');
    t.eq(W.probeSegment(c.x - 3, y, c.z, c.x + 3, y, c.z, 0.22, { ...ex, top: 'body' }) < 1, true, "top: 'body' still hits");
    const g = W.hAt(c.x + 5, c.z + 5);
    const tg = W.probeSegment(c.x + 5, g + 3, c.z + 5, c.x + 5, g - 1, c.z + 5, 0.2, o);
    t.ok(tg < 1 && o.kind === 'terrain', 'terrain hit', { tg, kind: o.kind });
    t.near(g + 3 - 4 * tg, g + 0.30, 0.02, 'terrain contact height (hAt + 0.30)');
    const b = W.bridges[0], mx = (b.ax + b.bx) / 2, mz = (b.az + b.bz) / 2, deck = W.bridgeAt(mx, mz);
    t.near(W.groundFor(mx, mz, deck + 0.1), deck, 1e-9, 'deck from above');
    t.near(W.groundFor(mx, mz, deck - 1.0), W.hAt(mx, mz), 1e-9, 'under the deck: terrain');
    const st = W.colliders.find((q) => q.stand);
    t.near(W.groundFor(st.x, st.z, st.y1 + 0.1), st.y1, 1e-9, 'standable top');
    t.near(W.groundFor(st.x, st.z, st.y1 - 0.6), W.hAt(st.x, st.z), 1e-9, 'feet below the top: terrain');
    t.near(W.groundFor(st.x, st.z, st.y1 + 0.1, false), W.hAt(st.x, st.z), 1e-9, 'props = false: terrain');
  }],
  ['FP: walk 2 s, finite camera, no module errors', (t) => {
    const { game, D } = t;
    D.teleport(0, 9.5, 0, 0);
    const p0 = game.player.pos.clone();
    t.move(0, 1); t.frames(120); t.move(0, 0);
    t.ok(game.player.pos.distanceTo(p0) > 8, 'moved ' + game.player.pos.distanceTo(p0).toFixed(2) + ' m');
    t.ok(camOk(game.camera), 'camera finite');
    t.eq(game.modErrs.size, 0, 'module errors');
    t.ok(!game.camera.layers.isEnabled(LAYER.BODY), 'FP: body layer off');
  }],
  ['TP: walk, spring arm, body visible', (t) => {
    const { game, D, view } = t;
    D.setView('tp');
    D.teleport(0, 9.5, 0, -6 * D2R);
    t.move(1, 0); t.frames(60); t.move(0, 0); t.frames(10);
    t.ok(camOk(game.camera), 'camera finite');
    t.ok(view.armLen > 0 && view.armLen <= TV.tpBoomMax + 1e-6, 'arm ' + view.armLen);
    t.ok(game.camera.layers.isEnabled(LAYER.BODY), 'TP: body layer on');
    // view.bodyFade (WP2 dithers Pip by it): the arm band 0.45 → 0.9 m, 0 in FP
    const R = view.tp;
    t.ok(R.bodyFade(0.4) === 0 && Math.abs(R.bodyFade(0.675) - 0.5) < 1e-9 && R.bodyFade(1.2) === 1, 'RigTP.bodyFade band');
    t.near(view.bodyFade, R.bodyFade(view.armLen), 1e-9, 'view.bodyFade follows the arm');
    D.setView('fp'); t.frames(2);
    t.eq(view.bodyFade, 0, 'FP: bodyFade 0');
  }],
  ['V toggles FP ↔ TP in ≤ 0.35 s', (t) => {
    const { view } = t;
    t.press('view'); t.frames(22);
    t.ok(view.mode === 'tp' && view.blend === 1, 'to TP', { mode: view.mode, blend: view.blend });
    t.press('view'); t.frames(22);
    t.ok(view.mode === 'fp' && view.blend === 0, 'back to FP', { mode: view.mode, blend: view.blend });
  }],
  ['events + module host', (t) => {
    const { game } = t;
    t.press('attack'); t.frames(3);
    t.ok(t.events(EV.SWING).length === 1, 'one swing event');
    t.ok(game.modules.length >= 9, 'modules');
    const names = game.modules.map((m) => m.name);
    for (const n of ['wp1', 'wp2', 'wp3', 'wp4', 'wp5', 'wp6', 'wp7', 'wp8', 'wp9']) t.ok(names.some((x) => x && x.startsWith(n)), 'module slot ' + n);
    let got = 0;
    game.events.once('f3-test', () => got++);
    game.events.emit('f3-test'); game.events.emit('f3-test');
    t.eq(got, 1, 'once fires once');
    const fn = () => got++;
    game.events.once('f3-test2', fn); game.events.off('f3-test2', fn); game.events.emit('f3-test2');
    t.eq(got, 1, 'off(type, fn) removes a once listener');
  }],
  ['viewmodel pass: FP only, ≤ 8 calls, ≤ 6k tris', (t) => {
    const { D } = t;
    t.frames(3, { draw: true });
    let v = D.vm();
    t.ok(v.visible && v.state === 'rest', 'visible at rest', v);
    t.ok(v.calls > 0 && v.calls <= 8 && v.tris <= 6000, 'cost', { calls: v.calls, tris: v.tris });
    t.press('attack'); t.frames(4, { draw: true });
    v = D.vm();
    t.ok(v.state === 'swing' && v.kind === 'A', 'swing A', v);
    D.setView('tp'); t.frames(10);
    t.eq(D.vm().visible, false, 'hidden in TP');
  }],
  ['debug helpers: toBoss(id), cutscene(), hud(), armProbe(), aim().hit, spawn(…, alt)', (t) => {
    const { D, game } = t, W = game.world;
    t.eq(D.toBoss('shores'), 'shores', 'toBoss(shores)');
    const o = W.arenas.shores.outside;
    t.ok(Math.hypot(game.player.pos.x - o.x, game.player.pos.z - o.z) < 0.01, 'outside the shores arena');
    t.ok(D.cutscene('bossIntro', 'woods'), 'bossIntro started'); t.frames(3);
    t.ok(game.fight && game.fight.id === 'woods' && game.fight.phase === 'intro', 'woods intro', game.fight && game.fight.phase);
    game.endFight(true); D.pose('spawn'); t.frames(2);   // out of the ring first: a step inside it starts the fight again
    t.ok(!game.fight && game.bosses.woods && game.bosses.woods.state === 'sleep', 'the reset boss sleeps', game.bosses.woods && game.bosses.woods.state);
    t.ok(D.cutscene('place') && game.cutscene && game.cutscene.type === 'place', 'place cutscene');
    t.ok(Object.values(game.bosses).every((b) => (b.state === 'sleep' && !game.S.bosses[b.id]) || b.sat), 'a placed seed\'s boss is gone; the rest sleep (or sit after a handover)');
    game.view.clearShot(); game.cutscene = null; t.resetPlayer(); t.frames(1);
    t.ok(D.cutscene('ending') && game.cutscene && game.cutscene.type === 'ending', 'ending cutscene');
    game.view.clearShot(); game.cutscene = null; game.ui.showHud(true); t.resetPlayer(); t.frames(1);
    t.ok(D.cutscene('itemGet') && game.player.state === 'item', 'item-get');
    t.dlgDone(); t.frames(1);
    D.hud(false);
    t.ok(game.ui.hud.style.visibility === 'hidden' && game.ui.crossEl.style.visibility === 'hidden', 'hud(false)');
    D.hud(true);
    t.eq(game.ui.hud.style.visibility, '', 'hud(true)');
    const ap = D.armProbe(0, 9.5, 0);
    t.ok(ap.cam.every(Number.isFinite) && ap.armLen > 0 && ap.armLen <= TV.tpBoomMax, 'armProbe', ap);
    D.teleport(0, 9.5, 0, 0); t.frames(1);
    D.spawn('bat', 1.5, 0, 1.2);
    t.near(D.last.altCur, 1.2, 1e-9, 'spawn(type, dist, rel, alt)');
    const row = D.aim().inCone.find((q) => q.type === 'bat');
    t.ok(row && typeof row.hit === 'boolean', 'aim().inCone[].hit', row);
  }],
  ['viewmodel: feel §7.2 rest composition; 21:00 ≥ 30 % darker than noon', async (t) => {
    const { game, D } = t;
    const vm = game.modules.find((m) => m && m.name === 'wp2-viewmodel');
    D.teleport(0, 9.5, 0, 0); t.frames(20, { draw: true });
    // blade samples (guard → tip) through the vm camera: never in the centre box; the tip on its 16:9 spot
    const sw = vm.swords[game.player.swordLevel >= 2 ? 1 : 0], c = vm.camera, v = new THREE.Vector3(), pts = [];
    vm.scene.updateMatrixWorld(true);
    for (let i = 0; i <= 20; i++) { v.set(0, 0.12 + (0.54 * i) / 20, 0).applyMatrix4(sw.matrixWorld).applyMatrix4(c.matrixWorldInverse).applyMatrix4(c.projectionMatrix); pts.push([v.x * 0.5 + 0.5, 0.5 - v.y * 0.5]); }
    const inBox = pts.filter(([x, y]) => x >= 0.4 && x <= 0.6 && y >= 0.38 && y <= 0.62).length, tip = pts[20];
    t.note('tip', tip.map((x) => +x.toFixed(3)));
    t.eq(inBox, 0, 'blade samples in the centre box');
    if (Math.abs(c.aspect - 16 / 9) < 0.05) t.ok(Math.hypot(tip[0] - 0.66, tip[1] - 0.56) < 0.03, 'tip at (0.66 W, 0.56 H)', tip);
    // lit like the world: the sword pixels' mean luminance at 21:00 vs noon
    const lum = (h) => { D.setTime(h); D.teleport(0, 9.5, 0, 0); t.frames(6, { draw: true }); return vmLuma(game); };
    const noon = await lum(12), night = await lum(21);
    t.note('luma', { noon, night });
    t.ok(noon.px > 500 && night.px > 500, 'sword pixels found', { noon: noon.px, night: night.px });
    t.ok(night.sword <= 0.7 * noon.sword, '21:00 ≥ 30 % darker', { noon: noon.sword, night: night.sword });
  }],
  ['extension points: intent hook, look / pose mods, view.feel, eye keep-out slot', (t) => {
    const { game, D, view, W } = t;
    D.teleport(0, 9.5, 0, 0); t.frames(2);
    // intent(it, canAct): a module steers this step's intent (walk +Z with no input)
    let calls = 0, canAct = null;
    const mod = game.addModule({ name: 'f3-intent-test', intent(it, ca) { calls++; canAct = ca; it.mx = 0; it.mz = 1; it.ml = 1; } });
    const z0 = game.player.pos.z;
    try { t.frames(30); } finally { game.modules.splice(game.modules.indexOf(mod), 1); }
    t.ok(calls >= 30 && canAct === true, 'intent hook every step', { calls, canAct });
    t.ok(game.player.pos.z - z0 > 1.5, 'the hooked intent moved Pip', game.player.pos.z - z0);
    t.frames(40);                                     // stop and let the eye settle
    // look mods: scale the mouse; add while the input is idle
    D.look(0, 0);
    let off = view.addLookMod((L) => { L.dyaw *= 0.5; });
    D.lookDelta(100, 0); t.frames(1); off();
    t.near(view.yaw, -0.11, 1e-9, 'lookMod halves the mouse turn');
    off = view.addLookMod((L) => { if (!L.mouse && !L.touch && !L.pad) L.dyaw += 0.01; });
    D.look(0, 0); t.frames(3); off();
    t.near(view.yaw, 0.03, 1e-9, 'lookMod adds while input is idle');
    // pose mods: FP eye offset (before the keep-out), roll, FOV
    D.look(0, 0); t.frames(2);
    const y0 = game.camera.position.y, f0 = game.camera.fov;
    off = view.addPoseMod((M) => { M.eye.y += 0.1; M.fov += 5; M.roll += 0.05; });
    t.frames(1); off();
    t.near(game.camera.position.y - y0, 0.1, 1e-6, 'M.eye moves the FP eye');
    t.near(game.camera.fov - f0, 5, 1e-6, 'M.fov adds vertical degrees');
    t.near(new THREE.Euler().setFromQuaternion(game.camera.quaternion, 'YXZ').z, 0.05, 1e-6, 'M.roll');
    t.frames(1);
    t.near(game.camera.fov, f0, 1e-6, 'M is zeroed each frame');
    // a throwing modifier is counted, never fatal
    const dbg = G.debugOn, n0 = game.modErrs.get('view.poseMod') || 0;
    G.debugOn = false;
    off = view.addPoseMod(() => { throw new Error('f3 test'); });
    try { t.frames(1); } finally { off(); G.debugOn = dbg; }
    t.eq(game.modErrs.get('view.poseMod'), n0 + 1, 'a throwing poseMod is counted');
    if (n0) game.modErrs.set('view.poseMod', n0); else game.modErrs.delete('view.poseMod');
    // view.feel (WP1): kick / fovPunch / lockOn forward to it; no-ops without it
    const got = [];
    view.feel = { kick: (...a) => got.push(['kick', ...a]), fovPunch: (...a) => got.push(['fov', ...a]), lockOn: (x) => got.push(['lock', x]) };
    try { view.kick(-3, 1, 2); view.fovPunch(4, 0.1, 0.2, 0.3); view.lockOn(null); } finally { view.feel = null; }
    t.eq(JSON.stringify(got), JSON.stringify([['kick', -3, 1, 2], ['fov', 4, 0.1, 0.2, 0.3], ['lock', null]]), 'forwarded to view.feel');
    t.ok(view.kick(1) === view && view.fovPunch(1, 0, 0, 0) === view, 'no-ops without view.feel');
    // the FP eye keep-out slot (WP3 fills W.eyeKeepOut; F ships the identity)
    const ex = view.eye.x;
    W.eyeKeepOut = (eye) => { eye.x += 0.05; return eye; };
    try { t.frames(1); } finally { delete W.eyeKeepOut; }
    t.near(view.eye.x - ex, 0.05, 1e-6, 'W.eyeKeepOut moves the eye');
    t.frames(1);
    t.near(view.eye.x, ex, 1e-9, 'v1 keep-out is the identity');
  }],
  ['contracts: addProp({ collider }), dialogue touch mode, ui.project records, drawn heart fallback', (t) => {
    const { game, D, W, ui } = t;
    // a landmark declared where it is made (WP9 → WP3): solid, its own heights × s; a declared field overrides
    // COLLIDER_H and the rest stay; an undeclared kind defaults tall
    const n0 = W.props.length, made = [];
    try {
      const p = W.addProp('f3_landmark', 40, 40, { s: 1.5, rot: 0, collider: { r: 2, h: 9, cam: 8, eye: 2.4 } }); made.push(p);
      t.ok(p.solid && p.r === 3 && !!p.collider, 'declared → solid, r × s', { solid: p.solid, r: p.r });
      const c = W.bakeCollider({ x: p.x, z: p.z, r: p.r, kind: p.type, prop: p });
      t.near(c.y1 - c.y0, 13.5, 1e-9, 'h × s'); t.near(c.camTop - c.y0, 12, 1e-9, 'cam × s'); t.eq(c.rEye, 2.4, 'eye');
      const q = W.addProp('pedestal', 44, 40, { rot: 0, collider: { h: 1.05 } }); made.push(q);
      const d = W.bakeCollider({ x: q.x, z: q.z, r: q.r, kind: q.type, prop: q });
      t.near(d.y1 - d.y0, 1.05, 1e-9, 'pedestal height override'); t.eq(d.rEye, 1.21, 'table eye radius kept');
      const u = W.bakeCollider({ x: 40, z: 40, r: 1, kind: 'f3_unknown_kind' });
      t.ok(u.y1 - u.y0 >= 2.5 && u.camTop === u.y1, 'undeclared kind defaults tall', u.y1 - u.y0);
    } finally { for (const p of made) p.removed = true; W.props.length = n0; }
    // dialogue reports its own touch mode (the controls hide; a tap anywhere advances)
    D.standAt('sign'); t.frames(1); t.press('interact'); t.frames(2);
    t.ok(!!ui.dlg, 'sign dialogue');
    t.eq(game.input.touchMode, 'dialogue', 'touch mode in dialogue');
    t.dlgDone(); t.frames(1);
    t.eq(game.input.touchMode, 'play', 'touch mode after');
    // ui.project: a new record per call (or the caller's out)
    const e = game.view.simEye(new THREE.Vector3()), f = game.view.forward();
    const a = ui.project({ x: e.x + f.x * 4, y: e.y, z: e.z + f.z * 4 }, game.camera), ax = a && a.x;
    const b = ui.project({ x: e.x + f.x * 4 - f.z, y: e.y, z: e.z + f.z * 4 + f.x }, game.camera);
    t.ok(a && b && a !== b && a.x === ax && a.x !== b.x, 'independent records', { ax, a: a && a.x, b: b && b.x });
    // a missing heart sprite: drawn hearts with the same states
    const M = (window.ASSET_MANIFEST || {}).sprites || {}, keep = M.heart;
    try { delete M.heart; ui.updateHud(game.S, true); } finally { if (keep !== undefined) M.heart = keep; }
    const hs = [...ui.hearts.children];
    t.ok(hs.length > 0 && hs.every((h) => h.classList.contains('nosprite') && h.querySelector('.hg.f')), 'drawn hearts', hs.map((h) => h.className));
    ui.updateHud(game.S, true);
    t.ok([...ui.hearts.children].every((h) => !h.classList.contains('nosprite')), 'sprites back');
  }],
  ['assets: tex() never null, fallbacks flagged; HD lo while HD is off, the full file once it is allowed', async (t) => {
    const A = G.assets;
    t.ok(A && A.tex('grass') && A.tex('grass').isTexture, 'grass');
    t.ok(A.tex('no_such_texture').userData.fallback === true, 'unknown key → solid colour');
    t.ok(Array.isArray(A.missing) && typeof A.loadDeferred === 'function' && typeof A.onTex === 'function', 'api');
    // an HD-only key with a lo (like cobble_hd): HD off → its lo answers tex(base); HD on → the full file replaces it
    const M = window.ASSET_MANIFEST.textures, k = 'f3t' + Date.now(), pol = [A.hdOk, A.lowRes], got = [];
    M[k + '_hd'] = { src: 'assets/textures/cobble_hd.jpg', lo: 'assets/textures/cobble_hd_lo.jpg' };
    const off = A.onTex((key, tx) => { if (key === k + '_hd') got.push(tx.image.width); });
    try {
      A.hdOk = false; A.lowRes = true;
      await A.loadDeferred([k + '_hd']);
      const lo = A.tex(k);
      t.ok(!lo.userData.fallback && lo.userData.lo === true && lo.image.width === 512, 'HD off: tex(base) = the lo', { w: lo.image && lo.image.width, lo: lo.userData.lo });
      A.hdOk = true; A.lowRes = false;
      await A.loadDeferred([k + '_hd']);              // what a quality raise does for every key holding its lo
      const hd = A.tex(k);
      t.ok(hd.userData.lo === false && hd.image.width === 1024, 'HD on: the full file replaced it', { w: hd.image && hd.image.width });
      t.eq(got.join(','), '512,1024', 'onTex announced both');
    } finally { off(); [A.hdOk, A.lowRes] = pol; delete M[k + '_hd']; delete A.textures[k + '_hd']; }
  }],
  // r2 core: the ` toggle used to switch the overlay and every cheat key on in a player build (no ?debug=1)
  ['player build (no ?debug=1): ` shows no overlay and the cheat keys do nothing; with ?debug=1 both work (ARCHITECTURE §17)', (t) => {
    const { game, ui } = t, S = game.S, was = { allowed: G.debugAllowed, on: G.debugOn }, c0 = S.coins;
    const tap = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); t.frames(1); };
    try {
      G.debugAllowed = false; G.debugOn = false; ui.setDebug(null);
      S.hp = 1;
      for (const k of ['Backquote', 'KeyG', 'KeyH', 'KeyC']) tap(k);
      t.eq(G.debugOn, false, '` keeps debug off');
      t.ok(ui.debugEl.classList.contains('hidden'), 'overlay hidden');
      t.eq(S.coins, c0, 'G gives no gems'); t.eq(S.hp, 1, 'H does not heal'); t.eq(!!game.gizmosOn, false, 'C shows no colliders');
      G.debugAllowed = true;
      tap('Backquote');
      t.eq(G.debugOn, true, '?debug=1: ` turns it on');
      t.ok(!ui.debugEl.classList.contains('hidden'), '?debug=1: overlay shown');
      tap('KeyG');
      t.eq(S.coins, c0 + 100, '?debug=1: G +100 gems');
    } finally { G.debugAllowed = was.allowed; G.debugOn = was.on; S.coins = c0; if (!was.on) ui.setDebug(null); }
  }],
  // r2 core: a phone used to be told 'press E' until its first touch (input.lastDevice started as 'keyboard')
  ['first device before any input: coarse pointer without a fine one = touch, else keyboard', async (t) => {
    const { firstDevice } = await import('../input.js');
    const mm = (coarse, fine) => (q) => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(any-pointer: fine)' ? fine : false });
    t.eq(firstDevice(mm(true, false)), 'touch', 'phone');
    t.eq(firstDevice(mm(true, true)), 'keyboard', 'touch laptop with a mouse / trackpad');
    t.eq(firstDevice(mm(false, true)), 'keyboard', 'desktop');
    t.eq(firstDevice(() => { throw new Error('no matchMedia'); }), 'keyboard', 'no matchMedia');
    t.eq(firstDevice(), firstDevice((q) => matchMedia(q)), 'default reads this browser');
  }],
], { desc: 'boot, stable surface, both views, probes, viewmodel, events' });

// ------------------------------------------------------------------ look
suite('look', [
  ['lookDelta(100, 0) at sens 1 turns −0.22 rad; camera matches the same frame within 1e-6', (t) => {
    const { D, view, game, settings: S } = t;
    S.set('shake', 0);
    D.look(1.0, 0.1); t.frames(1);
    const y0 = view.yaw, p0 = view.pitch;
    D.lookDelta(100, 0); t.frames(1);
    t.near(wrapDiff(view.yaw, y0), -0.22, 1e-9, 'yaw delta');
    t.near(view.pitch, p0, 1e-12, 'pitch unchanged');
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(view.pitch, view.yaw + Math.PI, 0, 'YXZ'));
    t.ok(game.camera.quaternion.angleTo(q) < 1e-6, 'camera quaternion', game.camera.quaternion.angleTo(q));
  }],
  ['FP pitch clamps at ±85°', (t) => {
    const { D, view } = t;
    D.look(0, 0); D.lookDelta(0, -50000); t.frames(1);
    t.near(view.pitch, 85 * D2R, 1e-9, 'up');
    D.lookDelta(0, 100000); t.frames(1);
    t.near(view.pitch, -85 * D2R, 1e-9, 'down');
  }],
  ['TP pitch clamps at −55° … +50°', (t) => {
    const { D, view } = t;
    D.setView('tp'); D.look(0, 0); D.lookDelta(0, -50000); t.frames(1);
    t.near(view.pitch, 50 * D2R, 1e-9, 'up');
    D.lookDelta(0, 100000); t.frames(1);
    t.near(view.pitch, -55 * D2R, 1e-9, 'down');
  }],
  ['invert Y and sensitivity apply live', (t) => {
    const { D, view, settings: S } = t;
    S.set('invertY', true); D.look(0, 0); D.lookDelta(0, 100); t.frames(1);
    t.near(view.pitch, 0.22, 1e-9, 'inverted pitch');
    S.set('invertY', false); S.set('sens', 2); D.look(0, 0); D.lookDelta(100, 0); t.frames(1);
    t.near(view.yaw, -0.44, 1e-9, 'sens 2');
  }],
  ['single mouse spikes over 300 counts are dropped', (t) => {
    const { D, view } = t;
    D.look(0.5, 0); D.lookDelta(400, 0, { single: true }); t.frames(1);
    t.near(view.yaw, 0.5, 1e-12, 'yaw unchanged');
  }],
  ['pad pitch rate is the same at 60 and 144 Hz (≤ 2 %)', (t) => {
    const { D, view } = t;
    D.pad(0.0, 0.6); D.look(0, 0); t.frames(60);
    const p60 = view.pitch, y60 = view.yaw;
    D.look(0, 0); t.frames(144, { dt: 1 / 144 });
    const p144 = view.pitch;
    D.pad(null);
    t.note('p60', p60); t.note('p144', p144);
    t.ok(Math.abs(p60) > 0.2 && Math.abs(p60 - p144) <= 0.02 * Math.abs(p60), 'pitch over 1 s', { p60, p144 });
    t.near(y60, 0, 1e-12, 'no yaw from a vertical stick');
  }],
  ['look input drains while paused (never applied later)', (t) => {
    const { D, view, ui } = t;
    D.look(0.3, 0); t.frames(1);
    ui.openPause(); t.frames(1);
    D.lookDelta(250, 0); t.frames(2);
    t.near(view.yaw, 0.3, 1e-12, 'paused');
    ui.closeMenu(true); t.frames(2);
    t.near(view.yaw, 0.3, 1e-12, 'after resume');
  }],
  // r2 core: the setting existed but nothing read it (arrows always walked, a keyboard-only player could not look)
  ['arrow keys look with "Arrow keys look around" on (feel §3.5: yaw 60 → 140°/s over 0.25 s, pitch 90°/s) and never walk; WASD still walks; off: they walk and never look', (t) => {
    const { view, pl, settings: S } = t, R2D = 180 / Math.PI;
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    const moved = (p) => Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z);
    try {
      S.set('arrowLook', true); S.set('shake', 0); t.frames(2);
      const y0 = view.yaw, p0 = pl.pos.clone();
      key('ArrowLeft', true); t.frames(1);
      t.near(wrapDiff(view.yaw, y0) * R2D, 1, 0.02, 'first frame: 60°/s, + = left');
      t.frames(59);
      t.near(wrapDiff(view.yaw, y0) * R2D, 129.33, 0.5, '1 s with the 0.25 s ramp');
      const y1 = view.yaw;
      t.frames(30);
      t.near(wrapDiff(view.yaw, y1) * R2D, 70, 0.1, 'then 140°/s');
      key('ArrowLeft', false); t.frames(5);
      t.ok(moved(p0) < 0.01, 'ArrowLeft never walks', moved(p0));
      const q0 = view.pitch;
      key('ArrowUp', true); t.frames(20); key('ArrowUp', false); t.frames(1);
      t.near((view.pitch - q0) * R2D, 30, 0.1, 'ArrowUp: pitch up at 90°/s');
      const p1 = pl.pos.clone();
      key('KeyA', true); t.frames(30); key('KeyA', false); t.frames(1);
      t.ok(moved(p1) > 0.5, 'A still walks', moved(p1));
      S.set('arrowLook', false); t.frames(30);
      const y2 = view.yaw, p2 = pl.pos.clone();
      key('ArrowLeft', true); t.frames(30); key('ArrowLeft', false); t.frames(1);
      t.near(wrapDiff(view.yaw, y2), 0, 1e-12, 'off: no look');
      t.ok(moved(p2) > 0.5, 'off: ArrowLeft walks', moved(p2));
    } finally { for (const k of ['ArrowLeft', 'ArrowUp', 'KeyA']) key(k, false); S.set('arrowLook', false); }
  }],
  ['arrow look stays out of cursor menus: with the setting on, ↓ still moves the pause selection', (t) => {
    const { ui, settings: S } = t;
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    try {
      S.set('arrowLook', true);
      ui.openPause(); t.frames(2);
      const s0 = ui.pauseList.sel;
      key('ArrowDown', true); t.frames(1); key('ArrowDown', false); t.frames(1);
      t.ok(ui.pauseList.sel !== s0, 'pause selection moved', { s0, s1: ui.pauseList.sel });
      t.eq(t.input.lookStick.m, 0, 'no look while a cursor menu is open');
    } finally { key('ArrowDown', false); ui.closeMenu(true); S.set('arrowLook', false); }
  }],
  ['lookAt / setLook use the facing convention', (t) => {
    const { D, view, game } = t;
    const e = view.simEye(new THREE.Vector3());
    D.lookAt(e.x + 3, e.y, e.z);            // +X
    t.near(view.yaw, Math.PI / 2, 1e-9, 'yaw toward +X');
    const r = D.look(Math.PI, 0); t.frames(1);
    const f = view.forward();
    t.ok(Math.abs(f.x) < 1e-9 && Math.abs(f.z + 1) < 1e-9, 'π looks −Z', f);
    const body = game.player.facing;
    t.ok(r.yaw === view.yaw && body === view.yaw, 'FP facing = look');
  }],
], { desc: 'arch §15.1 look acceptance: sensitivity, clamps, pad rate, drains' });

// ------------------------------------------------------------------ feel-basic
suite('feel-basic', [
  ['render alpha stays 0.5 ± 0.01 at a locked 60 Hz (600 frames)', (t) => {
    const recs = t.D.advance(600, STEP, { render: false });
    const bad = recs.filter((r) => Math.abs(r.alpha - 0.5) > 0.01 || r.steps !== 1).length;
    t.eq(bad, 0, 'frames off 0.5 alpha / 1 step');
  }],
  ['run speed 4.4 ± 0.05 m/s (FP, W held)', (t) => { // WP3: RULINGS run speed 4.4 (was CFG.playerSpeed 5.0)
    const { D, pl } = t;
    D.teleport(-6, 9, Math.PI / 2, 0);
    t.move(0, 1); t.frames(50);
    t.near(pl.vel.length(), 4.4, 0.05, 'speed'); // WP3: was 5.0
    t.move(0, 0);
  }],
  // r2 core: MAX_STEPS was 5, so a 0.1 s frame ran 5 steps and the whole sim slowed to 83 % below 12 fps
  ['10 fps (0.1 s frames) still runs real time: 6 steps a frame, 4.4 m/s, no long frames (feel §2.3)', (t) => {
    const { D, pl, game } = t;
    D.teleport(-6, 9, Math.PI / 2, 0);
    t.move(0, 1); t.frames(30);
    const p0 = pl.pos.clone(), lf = game.clock.longFrames, steps = [];
    for (let i = 0; i < 10; i++) { t.frames(1, { dt: 0.1 }); steps.push(game.clock.steps); }
    t.move(0, 0);
    t.ok(steps.every((s) => s === 6), 'steps per 0.1 s frame', steps);
    t.near(Math.hypot(pl.pos.x - p0.x, pl.pos.z - p0.z), 4.4, 0.05, 'metres in 1 s of 10 fps frames');
    t.eq(game.clock.longFrames, lf, 'no long frames');
  }],
  ['eye moves 7.33 ± 0.3 cm per frame while walking (p5–p95)', (t) => { // WP3: 4.4 m/s / 60 (was 8.33 at 5.0)
    const { D, view } = t;
    D.teleport(-6, 9, Math.PI / 2, 0);
    t.move(0, 1); t.frames(25);
    const d = [], e = view.eye.clone();
    for (let i = 0; i < 60; i++) { t.frames(1); d.push(view.eye.distanceTo(e) * 100); e.copy(view.eye); }
    t.move(0, 0);
    d.sort((a, b) => a - b);
    const p5 = d[3], p95 = d[56];
    t.note('cm', { p5: +p5.toFixed(3), p95: +p95.toFixed(3) });
    t.ok(p5 >= 7.03 && p95 <= 7.63, 'per-frame eye displacement', { p5, p95 }); // WP3: was 8.03 … 8.63
  }],
  ['a 0.07 s hit-stop freezes the eye exactly', (t) => {
    const { D, view, game } = t;
    D.teleport(-6, 9, Math.PI / 2, 0);
    t.move(0, 1); t.frames(25);
    game.hitStop(0.07);
    let frozen = 0, moved = 0;
    const e = view.eye.clone();
    for (let i = 0; i < 8; i++) {
      const stopped = game.clock.hitStopT > 0;
      t.frames(1);
      if (stopped) { frozen++; if (view.eye.distanceTo(e) !== 0) moved++; }
      e.copy(view.eye);
    }
    t.move(0, 0);
    t.ok(frozen >= 4, 'frozen frames ' + frozen);
    t.eq(moved, 0, 'eye motion during the stop');
  }],
  ['FP: body facing equals the look after strafing and dashing', (t) => {
    const { D, pl, view } = t;
    D.teleport(-6, 9, 0.7, 0);
    t.move(1, 0); t.frames(30);
    D.lookDelta(180, 0); t.frames(5);
    t.press('dash'); t.frames(20); t.move(0, 0); t.frames(3);
    t.ok(Math.abs(wrapAngle(pl.facing - view.yaw)) < 1e-6, 'facing − yaw', wrapAngle(pl.facing - view.yaw));
  }],
  ['TP: the body turns to the move direction within 0.2 s', (t) => {
    const { D, pl } = t;
    D.setView('tp');
    D.teleport(-6, 9, 0, -6 * D2R); pl.turnTo(0); t.frames(2);
    t.move(1, 0);                          // right of a look at yaw 0 = −X → yaw −π/2
    t.frames(12);
    const err = Math.abs(wrapAngle(pl.facing + Math.PI / 2));
    t.move(0, 0);
    t.note('errDeg', +(err / D2R).toFixed(2));
    t.ok(err <= 0.1 * Math.PI / 2 + D2R, 'turned ≥ 90 % in 0.2 s', err / D2R);
  }],
  ['TP: a module-held intent.bodyYaw faces a target while the wish strafes (lock-on hook)', (t) => {
    const { D, pl, game, view } = t;
    D.setView('tp');
    D.teleport(-6, 9, Math.PI, -6 * D2R); t.frames(2);
    const T = { x: -6, z: -11 };                     // 20 m north, straight ahead of the look
    const mod = game.addModule({ name: 'f3-bodyyaw-test', intent(it) { it.bodyYaw = yawOf(T.x - pl.pos.x, T.z - pl.pos.z); } });
    const p0 = pl.pos.clone(), r = { x: -Math.cos(view.yaw), z: Math.sin(view.yaw) };
    t.move(1, 0);
    try { t.frames(60); } finally { game.modules.splice(game.modules.indexOf(mod), 1); }
    const want = yawOf(T.x - pl.pos.x, T.z - pl.pos.z), side = (pl.pos.x - p0.x) * r.x + (pl.pos.z - p0.z) * r.z;
    t.note('lock', { facingDeg: +(pl.facing / D2R).toFixed(2), targetDeg: +(want / D2R).toFixed(2), side: +side.toFixed(3) });
    t.ok(Math.abs(wrapDiff(pl.facing, want)) < 3 * D2R, 'body faces the target', wrapDiff(pl.facing, want) / D2R);
    t.ok(side > 3, 'moved along the view right (strafe)', side);
    t.frames(20); t.move(0, 0);                      // hold released: turn-to-move again (right of yaw π = +X → π/2)
    t.ok(Math.abs(wrapDiff(pl.facing, Math.PI / 2)) < 10 * D2R, 'turn-to-move once the hold ends', pl.facing / D2R);
  }],
  ['body layer: hidden in FP (shadow kept), shown in TP', (t) => {
    const { game, D } = t;
    t.frames(2);
    t.eq(game.camera.layers.isEnabled(LAYER.BODY), false, 'FP camera');
    t.eq(game.sky.sun.shadow.camera.layers.isEnabled(LAYER.BODY), true, 'shadow camera');
    D.setView('tp'); t.frames(5);
    t.eq(game.camera.layers.isEnabled(LAYER.BODY), true, 'TP camera');
  }],
  ['no NaN in floaters, prompts or feed lines (scripted FP session)', async (t) => {
    const { game, D, ui } = t;
    const S = game.S;
    S.potions = 2; S.hp = 2;
    game.drinkPotion();
    game.collect({ kind: 'gem', value: 5 });
    const e = game.view.simEye(new THREE.Vector3());
    for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [0, 0.05]]) ui.floater(new THREE.Vector3(e.x + dx, e.y, e.z + dz), '+1', '#fff', 18);
    D.standAt('sign'); t.frames(3);
    let bad = 0, seen = 0;
    const check = () => {
      for (const el of document.querySelectorAll('.floater, .prompt, .feedline')) {
        seen++;
        const l = el.style.left, tp = el.style.top;
        if (/NaN|undefined/.test(l + tp + el.style.transform)) bad++;
        if (el.style.visibility !== 'hidden' && !el.classList.contains('hidden') && l && !Number.isFinite(parseFloat(l))) bad++;
      }
    };
    for (let i = 0; i < 30; i++) { t.frames(4); check(); if (i === 10) { t.press('interact'); } if (i === 20) t.dlgDone(); D.lookDelta(60, 20); }
    t.note('sampled', seen);
    t.ok(seen > 10, 'elements sampled ' + seen);
    t.eq(bad, 0, 'NaN / bad coordinates');
  }],
], { desc: 'arch §15.1 feel acceptance: interpolation, speed, hit-stop, facing, body layer, HUD numbers' });

// ------------------------------------------------------------------ combat-basic
suite('combat-basic', [
  ['A hits a slime 1.4 m ahead; misses it at ±105° and behind', (t) => {
    const r0 = t.swing({ type: 'slime', dist: 1.4, rel: 0 });
    t.ok(r0.hit && r0.kinds === 'A', 'ahead', r0);
    // WP4: target edges count (feel §8.2 / T27; at 1.4 m a slime at 70°, edge 53.3°, is hit) and touch magnetism adds up
    // to 25°, so the miss is checked at ±105° (edge 88.3°)
    for (const rel of [105, -105, 180]) { const r = t.swing({ type: 'slime', dist: 1.4, rel }); t.ok(!r.hit, 'miss at ' + rel + '°', r); }
  }],
  ['chain: mashing gives A → B → C; C deals +1 damage', (t) => {
    const { game, D } = t;
    t.clearEnemies(); D.teleport(0, 9.5, 0, 0); t.frames(1);
    for (let i = 0; i < 40; i++) { t.press('attack'); t.frames(1); }
    const kinds = t.events(EV.SWING).map((p) => p.kind).join('');
    t.ok(kinds.startsWith('ABC'), 'kinds ' + kinds);
    const a = t.swing({ type: 'mushroom', dist: 1.3, rel: 0 });
    const c = t.swing({ type: 'mushroom', dist: 1.3, rel: 0, chainC: true });
    t.ok(a.hit && a.dmg === 1, 'A damage 1', a);
    t.ok(c.hit && c.kinds === 'C' && c.dmg === 1 + TC.dmgC, 'C damage 2', c);
    t.note('levels', game.S.swordLevel);
  }],
  ['vertical band: a bat at 2.1 m is missed level, hit looking up 25°', (t) => {
    const lv = t.swing({ type: 'bat', dist: 1.5, rel: 0, alt: 2.1, pitch: 0 });
    const up = t.swing({ type: 'bat', dist: 1.5, rel: 0, alt: 2.1, pitch: 25 });
    t.ok(!lv.hit, 'level miss', lv);
    t.ok(up.hit, '+25° hit', up);
  }],
  ['crab guard: A clinks (no damage), C breaks it', (t) => {
    const a = t.swing({ type: 'crab', dist: 1.3, rel: 0, face: true, state: 'windup' });
    const c = t.swing({ type: 'crab', dist: 1.3, rel: 0, face: true, state: 'windup', chainC: true });
    t.ok(a.clink && a.dmg === 0, 'A clink', a);
    t.ok(c.hit && !c.clink && c.dmg >= 2, 'C breaks the guard', c);
  }],
  ['hit-stop in whole steps: hit 3, kill 4, clink 2', (t) => {
    const hit = t.swing({ type: 'slime', dist: 1.4, rel: 0 });
    const kill = t.swing({ type: 'bat', dist: 1.4, rel: 0, alt: 1.0 });
    const clink = t.swing({ type: 'crab', dist: 1.3, rel: 0, face: true, state: 'windup' });
    t.eq(hit.stop, TC.stopEnemy, 'hit stop');
    t.eq(kill.stop, TC.stopKill, 'kill stop');
    t.ok(clink.clink, 'clink happened');
  }],
  ['TP: a slime 1.4 m along the crosshair is hit', (t) => {
    t.D.setView('tp');
    const r = t.swing({ type: 'slime', dist: 1.4, rel: 0, pitch: -6 });
    t.ok(r.hit, 'hit', r);
  }],
], { desc: 'minimal 3D sword checks (WP4 owns the full matrix)', prepare: { god: true, freeze: true, sword: 1 } });

// ------------------------------------------------------------------ interact-basic
suite('interact-basic', [
  ['a sign is targeted with its label; attack swings and never interacts', (t) => {
    const { D, pl, ui } = t;
    t.ok(!!D.standAt('sign'), 'standAt sign'); t.frames(3);
    const tg = D.target();
    t.ok(tg && /Sign/.test(tg.label), 'label', tg);
    const id = pl.swingId;
    t.press('attack'); t.frames(3);
    t.eq(pl.swingId, id + 1, 'swung');
    t.ok(!ui.dlg, 'no dialogue');
  }],
  ['E at a sign opens it', (t) => {
    const { D, ui } = t;
    D.standAt('sign'); t.frames(3);
    t.press('interact'); t.frames(2);
    t.ok(!!ui.dlg && ui.dlg.name === 'Sign', 'sign dialogue', ui.dlg && ui.dlg.name);
    t.ok(t.dlgDone(), 'dialogue closes');
  }],
  ['Shellby: "Talk · Elder Shellby"; looking 40° away drops it within 150 ms', (t) => {
    const { D, view } = t;
    D.standAt('shellby'); t.frames(3);
    const tg = D.target();
    t.eq(tg && tg.label, 'Talk · Elder Shellby', 'label');
    D.look(view.yaw + 40 * D2R, view.pitch); t.frames(9);
    t.eq(D.target(), null, 'target after 9 frames');
  }],
  ['nothing behind Pip is targeted (FP)', (t) => {
    const { D, view } = t;
    D.standAt('shellby'); t.frames(3);
    D.look(view.yaw + Math.PI, 0); t.frames(12);
    t.eq(D.target(), null, 'target');
  }],
  ['TP: something in front of the body is targeted without aiming', (t) => {
    const { D, view } = t;
    D.setView('tp');
    D.standAt('sign'); t.frames(3);
    D.look(view.yaw + 50 * D2R, -6 * D2R); t.frames(12);
    t.ok(!!D.target(), 'fallback target');
  }],
  ['shop: 10 canvas clicks never buy, swing or close it', async (t) => {
    const { game, D, ui, pl } = t;
    game.S.coins = 500;
    t.ok(!!D.standAt('miso'), 'standAt Miso'); t.frames(3);
    t.press('interact'); t.frames(2);
    t.dlgDone();
    t.frames(2);
    t.ok(!!ui.shop, 'shop open');
    const coins = game.S.coins, sw = pl.swingId, cv = game.renderer.domElement;
    for (let i = 0; i < 10; i++) {
      const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', clientX: innerWidth / 2, clientY: innerHeight / 2, button: 0 };
      cv.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1 }));
      window.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
      t.frames(2);
    }
    t.eq(game.S.coins, coins, 'coins');
    t.eq(pl.swingId, sw, 'no swing');
    t.ok(!!ui.shop, 'shop still open');
    ui.closeShop(); t.frames(2);
  }],
], { desc: 'crosshair interaction (WP4 owns the full set)' });

// ------------------------------------------------------------------ save-migrate
const FADE = 75;
suite('save-migrate', [
  ['save → Continue restores position, yaw and pitch (± 0.01)', (t) => {
    const { game, D, view } = t;
    D.teleport(2, 12, 1.0, 0.2); t.frames(2);
    Object.assign(game.S, { controlsSeen: true, controlsV: 2, introDone: true });
    game.save(true);
    D.teleport(0, 9.5, 0, 0); t.frames(2);
    game.continueGame(); t.frames(FADE);
    const p = game.player.pos;
    t.ok(Math.hypot(p.x - 2, p.z - 12) <= 0.01, 'position', [p.x, p.z]);
    t.near(Math.abs(wrapAngle(view.yaw - 1.0)), 0, 0.01, 'yaw');
    t.near(view.pitch, 0.2, 0.01, 'pitch');
    t.eq(game.ui.menu, null, 'no controls card');
  }],
  ['an old v2 save (no pitch / controlsV) loads; the new controls card shows once', (t) => {
    const { game, view, ui } = t;
    const S = { ...game.S, px: 2, pz: 12, facing: -4.7119, controlsSeen: true, introDone: true };
    delete S.pitch; delete S.controlsV;
    store.set(SAVE_KEY, S);
    game.continueGame(); t.frames(FADE);
    t.ok(ui.menu === null && ui.coach.active, 'coach marks shown'); // WP6: the first-run card became in-play coach marks
    t.near(Math.abs(wrapAngle(view.yaw - -4.7119)), 0, 0.01, 'yaw (mod 2π)');
    t.near(view.pitch, game.defaultPitch(), 1e-9, 'default pitch');
    ui.closeControls(); t.frames(2);
    t.eq(store.get(SAVE_KEY).controlsV, 2, 'controlsV written');
    game.continueGame(); t.frames(FADE);
    t.ok(ui.menu === null && !ui.coach.active, 'not shown again'); // WP6: coach marks
  }],
  ['corrupted optional fields fall back (no NaN; saving still works)', (t) => {
    const { game, view } = t;
    store.set(SAVE_KEY, { ...game.S, px: 2, pz: 12, facing: 'north', pitch: 'abc', controlsSeen: true, controlsV: 2, introDone: true });
    game.continueGame(); t.frames(FADE);
    t.ok(camOk(game.camera) && finite(game.player.pos.x, game.player.pos.z, view.yaw, view.pitch), 'finite');
    t.near(Math.abs(wrapAngle(view.yaw - Math.PI)), 0, 1e-9, 'default yaw (π)');
    let threw = null;
    try { game.save(true); } catch (e) { threw = e.message; }
    t.eq(threw, null, 'save threw');
    t.ok(typeof store.get(SAVE_KEY).pitch === 'number', 'numeric pitch saved');
  }],
  ['settings persist; values equal to the default are not stored', (t) => {
    const { settings: S } = t;
    S.set('fovFP', 105); S.flush();
    t.eq((store.get(SETTINGS_KEY) || {}).fovFP, 105, 'stored');
    S.set('fovFP', SCHEMA.fovFP.def); S.flush();
    t.ok(!('fovFP' in (store.get(SETTINGS_KEY) || {})), 'default dropped');
    t.eq(S.set('fovFP', 999), SCHEMA.fovFP.max, 'clamped');
  }],
], { desc: 'save v2 + optional fields, migration, corrupted fields, settings persistence' });

// ------------------------------------------------------------------ heavy suites (not in 'all')
suite('probe', [
  ['TP camera: 300 placements in village / woods / shores, never inside a collider or under terrain', (t) => {
    const { game, D, W, view } = t;
    const n = (t.opts && t.opts.n) || 300, near = [];
    let rs = 1234;
    const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    D.setView('tp'); D.god(true); D.freezeAI(true);
    const out = { placements: 0, frames: 0, inCollider: 0, underTerrain: 0, armGrowth: 0, collideFrames: 0 };
    let tries = 0;
    while (out.placements < n && tries < 60000) {
      tries++;
      const goal = [0, 1, 3][out.placements % 3], span = goal === 0 ? 70 : 340;
      const x = (rnd() - 0.5) * span, z = (rnd() - 0.5) * span;
      if (W.regionAt(x, z) !== goal || !W.walkable(x, z) || W.inArena(x, z, 4) || W.hAt(x, z) < -0.1) continue;
      W.nearColliders(x, z, 3, near);
      if (near.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.35)) continue;
      const k = out.placements++;
      t.clearEnemies();
      D.teleport(x, z, rnd() * Math.PI * 2, k % 2 ? (-55 + rnd() * 105) * D2R : -6 * D2R);
      let prev = null;
      for (let f = 0; f < 30; f++) {
        game.runFrame(STEP, true, false);
        const c = game.camera.position;
        out.frames++;
        W.nearColliders(c.x, c.z, 3, near);
        if (near.some((q) => (W.colliderContains ? W.colliderContains(q, c.x, c.y, c.z) : Math.hypot(c.x - q.x, c.z - q.z) < q.r && c.y >= q.y0 && c.y <= q.camTop))) out.inCollider++; // WP3: exact shapes (boxes, the Great Tree's outline + root heights)
        if (c.y < W.hAt(c.x, c.z) + 0.2) out.underTerrain++;
        if (prev != null && view.armLen - prev > 4 * STEP * view.tp.boom + 1e-6) out.armGrowth++;
        if (view.tp.collide) out.collideFrames++;
        prev = view.armLen;
      }
    }
    t.note('probe', out);
    t.eq(out.placements, n, 'placements');
    t.eq(out.inCollider, 0, 'frames inside a collider');
    t.eq(out.underTerrain, 0, 'frames under terrain + 0.2');
    t.eq(out.armGrowth, 0, 'arm growth > 4·dt·boom');
  }],
], { desc: 'TP spring arm vs colliders (≈ 20 s)', heavy: true });

suite('sweep', [
  ['perf sweep: 9 locations × 4 directions (+ the 3 arena fights) per view mode (real frames, uncapped in the harness)', async (t) => {
    const { game, D } = t, o = t.opts || {};
    const modes = o.modes || ['fp', 'tp'], ms = o.ms || 1200, settle = o.settle || 450, rows = [];
    // the hour is pinned for the whole sweep (o.time, default noon): lighting, fog and the night point lights change the
    // counts, and real frames would otherwise drift ≈ 1 h per 20 s, so rows would depend on when they were sampled
    D.manual(false); D.god(true); D.freezeAI(true); D.hud(false); D.setTime(o.time ?? 12); D.freezeTime(true);
    const yaws = [['S', 0], ['E', Math.PI / 2], ['N', Math.PI], ['W', -Math.PI / 2]];
    for (const mode of modes) {
      D.setView(mode);
      for (const L of perfLocations(game.world)) {
        if (game.fight) game.endFight(true);
        t.resetPlayer(); t.clearEnemies();
        D.teleport(L.x, L.z, L.yaw ?? Math.PI, 0);
        if (L.arena) {             // walk-in trigger: wait for the intro to hand over (the boss is present, AI frozen)
          for (let i = 0; i < 60 && !(game.fight && game.fight.phase === 'fight'); i++) await t.wait(100);
        }
        for (const [dir, yaw] of yaws) {
          D.look(yaw, mode === 'tp' ? -6 * D2R : 0);
          t.clearEnemies();        // the spawner keeps running on real frames: no stray enemies in this view's counts
          await t.wait(settle);
          const p = await D.perf({ ms });
          rows.push({ mode, loc: L.name, dir, fight: game.fight ? game.fight.phase : null, ...p });
        }
      }
      if (game.fight) game.endFight(true);
    }
    D.hud(true); D.freezeTime(false);
    t.note('rows', rows);
    t.ok(rows.length === modes.length * 36 && rows.every((r) => r.frames > 10), 'rows ' + rows.length);
    t.ok(rows.every((r) => r.tod === rows[0].tod), 'every row at the same hour', [...new Set(rows.map((r) => r.tod))]);
  }],
], { desc: 'perf sweep for baselines (WP7 extends it; ≈ 2 min)', heavy: true });

// ------------------------------------------------------------------ work packages (one file each, no shared edits)
for (const reg of [wp1, wp2, wp3, wp4, wp5, wp6, wp7, wp8, wp9, act1]) {
  try { reg(suite); } catch (e) { console.error('[Starseed] test registration', e); }
}
