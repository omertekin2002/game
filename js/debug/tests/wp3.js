// WP3 in-page test suites (registered by js/debug/tests.js; only loaded with ?debug=1): player physics and world
// collision. 'wp3' (in 'all', fast) checks the RULINGS numbers and every rule once; 'wp3-heavy' (heavy) runs the arch
// §15.2 statistics: 1000 random jumps, 500 random 10 s walks, 200 walks into every bridge side, house gaps by ray march
// and FP eye-to-mesh distances at props. Both are frame-exact (manual clock or direct fixed steps).
import * as THREE from 'three';
import { move as TM } from '../../tune.js';
import { shapeDist, TREE_FIT, BUILDINGS } from '../../world-collide.js';
import { penetration, moveCircle, walkOK } from '../../phys.js';
import { propModel, houseA, houseB, shopModel } from '../../props.js';

const D2R = Math.PI / 180;
const _s = { nx: 0, nz: 0 };

// ------------------------------------------------------------------ helpers
/** a synthetic intent for direct fixed steps (no input, no camera): yaw = look, (x, y) = stick (y forward) */
function intentFor(o = {}) {
  const yaw = o.yaw ?? 0, x = o.x || 0, y = o.y || 0, l = Math.min(1, Math.hypot(x, y));
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) }, r = { x: -Math.cos(yaw), z: Math.sin(yaw) };
  const k = l > 1e-6 ? l / Math.hypot(x, y) : 0;
  return { mx: (r.x * x + f.x * y) * k, mz: (r.z * x + f.z * y) * k, ml: l, lookYaw: yaw, lookPitch: 0, mode: o.mode || 'fp', attack: !!o.attack, dash: !!o.dash,
    jump: !!o.jump, jumpHeld: !!o.jumpHeld, sprint: !!o.sprint, sprintToggle: !!o.toggle, faceYaw: null, facePitch: null, bodyYaw: o.bodyYaw ?? null, bodyShown: false };
}
/** n fixed steps of the player alone (fast; the module hooks don't run). step(i) may return an intent per step */
function sim(game, n, it, each) {
  const pl = game.player;
  for (let i = 0; i < n; i++) {
    const x = typeof it === 'function' ? it(i) : it;
    pl.update(1 / 60, x, true);
    x.jump = false; x.dash = false; x.attack = false;
    if (each && each(i) === false) break;
  }
}
/** a flat open spot: walkable, slope < 0.12 and no collider within clear m, near (x, z) */
function openSpot(W, x, z, clear = 3, span = 30) {
  const near = [];
  for (let k = 0; k < 4000; k++) {
    const a = k * 2.399, d = Math.sqrt(k / 4000) * span, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
    if (!W.walkable(px, pz) || W.hAt(px, pz) < 0.2 || W.bridgeAt(px, pz) !== null) continue;
    let ok = true;
    for (let i = 0; i < 8 && ok; i++) { const b = (i / 8) * Math.PI * 2; if (W.slopeAt(px + Math.sin(b) * clear, pz + Math.cos(b) * clear) > 0.12 || !W.walkable(px + Math.sin(b) * clear, pz + Math.cos(b) * clear)) ok = false; }
    if (!ok || W.slopeAt(px, pz) > 0.12) continue;
    W.nearColliders(px, pz, clear + 3, near);
    if (near.some((c) => shapeDist(c, px, pz) < clear)) continue;
    return { x: px, z: pz };
  }
  return null;
}
function standables(W, kind) { return W.colliders.filter((c) => c.stand && c.kind === kind); }
/** a standable with open, flat walkable ground around it */
function openStand(W, kind) {
  const near = [];
  let best = null, bs = 0;
  for (const c of standables(W, kind)) {
    if (c.y1 - W.hAt(c.x, c.z) < 0.45 || W.slopeAt(c.x, c.z) > 0.2) continue;
    let ok = true;
    for (let i = 0; i < 8 && ok; i++) { const b = (i / 8) * Math.PI * 2, x = c.x + Math.sin(b) * 2.6, z = c.z + Math.cos(b) * 2.6; if (!W.walkable(x, z) || W.slopeAt(x, z) > 0.3 || W.hAt(x, z) < 0.2) ok = false; }
    if (!ok) continue;
    W.nearColliders(c.x, c.z, 6, near);
    const clear = Math.min(...near.filter((q) => q !== c && q.body !== false).map((q) => shapeDist(q, c.x, c.z)), 9);
    if (clear > bs) { bs = clear; best = c; }
  }
  return bs > 1.6 ? best : null;
}
/** a shallow-water spot (wading) with room around */
function wadeSpot(W) {
  for (let j = -170; j < 170; j += 1) for (let i = -170; i < 170; i += 1) {
    const h = W.hAt(i, j);
    if (h > -0.15 || h < -0.37 || W.bridgeAt(i, j) !== null) continue;
    let ok = true;
    for (let k = 0; k < 8 && ok; k++) { const b = (k / 8) * Math.PI * 2, hh = W.hAt(i + Math.sin(b) * 1.2, j + Math.cos(b) * 1.2); if (hh > -0.09 || hh < -0.39 || W.bridgeAt(i + Math.sin(b) * 1.2, j + Math.cos(b) * 1.2) !== null) ok = false; }
    if (ok && W.walkable(i, j)) return { x: i, z: j };
  }
  return null;
}
/** teleport + settle (direct steps); nothing carried over from the last run (cooldowns, buffers, sprint) */
function put(t, x, z, yaw = 0) {
  const pl = t.pl;
  t.D.teleport(x, z, yaw, 0);
  pl.vel.set(0, 0); pl.state = 'normal'; pl.dashCD = 0; pl.dashBuffer = 0; pl.jumpBuffer = 0; pl.attackBuffer = 0; pl.restT = 0; pl.chainT = 9; pl.sprint = false; pl.sprintMode = null;
  sim(t.game, 2, intentFor({ yaw }));
}

export default function register(suite) {
  // ------------------------------------------------------------------ fast suite
  suite('wp3', [
    ['speeds: run 4.4, strafe 4.18, backpedal 3.52 (FP); TP explore 4.4 any way; wading × 0.62', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 4);
      t.ok(!!sp, 'flat spot');
      const run = (x, y, mode = 'fp') => { put(t, sp.x, sp.z, 0.3); const it = intentFor({ yaw: 0.3, x, y, mode }); sim(game, 40, it); return pl.vel.length(); };
      const f = run(0, 1), s = run(1, 0), b = run(0, -1), tp = run(0, -1, 'tp');
      t.note('speeds', { fwd: +f.toFixed(3), strafe: +s.toFixed(3), back: +b.toFixed(3), tpBack: +tp.toFixed(3) });
      t.near(f, 4.40, 0.01, 'forward'); t.near(s, 4.18, 0.01, 'strafe'); t.near(b, 3.52, 0.01, 'backpedal'); t.near(tp, 4.40, 0.01, 'TP explore (turns to move)');
      const w = wadeSpot(W);
      t.ok(!!w, 'a shallow-water spot');
      if (w) {
        put(t, w.x, w.z, 0);
        let v = 0, n = 0;
        sim(game, 30, intentFor({ yaw: 0, y: 0.6 }), () => { if (pl.wading) { v = pl.vel.length(); n++; } return pl.wading; });
        t.note('wade', { v: +v.toFixed(3), steps: n });
        t.ok(n >= 12, 'wading', n); t.near(v, 0.6 * 4.4 * 0.62, 0.03, 'wading speed (60 % stick)');
      }
    }],
    ['vector acceleration: 0 → 4.4 in 7 steps, 4.4 → 0 in 9 steps, same rate on diagonals', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 4);
      const steps = (x, y, v) => { put(t, sp.x, sp.z, 0); let n = 0; sim(game, 30, intentFor({ yaw: 0, x, y }), () => { n++; return pl.vel.length() < v - 1e-6; }); return n; };
      const a = steps(0, 1, 4.4), d = steps(Math.SQRT1_2, Math.SQRT1_2, 4.4 * (0.95 + 0.05 * Math.SQRT1_2));
      put(t, sp.x, sp.z, 0); sim(game, 30, intentFor({ yaw: 0, y: 1 }));
      let s = 0; sim(game, 30, intentFor({ yaw: 0 }), () => { s++; return pl.vel.length() > 1e-6; });
      t.note('steps', { accel: a, diag: d, stop: s });
      t.eq(a, 7, 'accel steps'); t.eq(d, 7, 'diagonal accel steps'); t.eq(s, 9, 'stop steps');
    }],
    ['jump: apex 0.85 ± 0.03 m, airtime 0.508 ± 0.03 s, jog distance 2.24 ± 0.15 m; EV.JUMP / EV.LAND { impact, surface }', (t) => {
      const { W, D } = t, sp = openSpot(W, -6, 9, 4);
      D.teleport(sp.x, sp.z, 0, 0); t.frames(3); D.clearEvents();
      const st = D.phys.jumpTrace({ hold: true });
      t.note('stand', { apex: st.apex, airtime: st.airtime, impact: st.impact });
      t.near(st.apex, 0.85, 0.03, 'apex'); t.near(st.airtime, 0.508, 0.03, 'airtime');
      t.ok(st.apex >= 0.84 && st.apex <= 0.90, 'arch §15.2 apex 0.87 ± 0.03 also holds', st.apex);
      const jumps = t.events('jump'), lands = t.events('land');
      t.ok(jumps.length === 1 && lands.length === 1, 'one jump, one land', { jumps: jumps.length, lands: lands.length });
      t.ok(lands[0] && lands[0].impact > 7.0 && lands[0].impact < 7.8 && typeof lands[0].surface === 'string', 'land payload', lands[0]);
      D.teleport(sp.x, sp.z - 3, 0, 0); t.frames(3);
      const jog = D.phys.jumpTrace({ hold: true, run: 1, warm: 30 });
      t.note('jog', { dist: jog.dist, airtime: jog.airtime });
      t.near(jog.dist, 2.24, 0.15, 'distance at 4.4 m/s');
    }],
    ['jump cut: a tap hops 0.29 ± 0.04 m; full apex needs the button held', (t) => {
      const { W, D } = t, sp = openSpot(W, -6, 9, 4);
      D.teleport(sp.x, sp.z, 0, 0); t.frames(3);
      const tap = D.phys.jumpTrace({ hold: false });
      t.note('tap', tap.apex);
      t.near(tap.apex, 0.29, 0.04, 'min hop');
    }],
    ['C2: player.alt > 0.30 for ≥ 0.40 s of a held jump (shockwave clearance), 0 while grounded; vy / grounded live', (t) => {
      const { W, D, pl } = t, sp = openSpot(W, -6, 9, 4);
      D.teleport(sp.x, sp.z, 0, 0); t.frames(3);
      t.eq(pl.alt, 0, 'grounded alt'); t.eq(pl.grounded, true, 'grounded');
      const tr = D.phys.jumpTrace({ hold: true });
      const above = tr.trace.filter((r) => r.alt > 0.30).length / 60;
      t.note('above0.30', +above.toFixed(3));
      t.ok(above >= 0.40, 'time above 0.30 m', above);
      t.ok(tr.trace.some((r) => r.vy > 5) && tr.trace.some((r) => r.vy < -5), 'vy rises and falls');
      t.ok(typeof pl.sprint === 'boolean', 'player.sprint is a bool');
    }],
    ['coyote 0.10 s after walking off a top, buffer 0.12 s before landing', (t) => {
      const { game, W, pl, D } = t, c = openStand(W, 'stump') || openStand(W, 'rock');
      t.ok(!!c, 'an open standable top');
      // stand on it, walk off, jump k steps after leaving the top
      const offJump = (k) => {
        D.teleport(c.x, c.z, 0, 0); pl.vel.set(0, 0); pl.pos.y = c.y1; pl._sim.copy(pl.pos); pl.grounded = true; pl.vy = 0; sim(game, 2, intentFor({ yaw: 0 }));
        let left = -1, cur = -1, at = -1, air = null;
        const off = game.events.on('jump', () => { if (at < 0) at = cur; });
        sim(game, 90, (i) => { cur = i; if (left >= 0 && i === left + k) air = !pl.grounded; return intentFor({ yaw: 0, y: 1, jump: left >= 0 && i === left + k, jumpHeld: left >= 0 && i >= left + k }); },
          (i) => { if (left < 0 && !pl.grounded) left = i; return !(at >= 0 || (left >= 0 && i > left + k + 14)); });
        off();
        return { left, air, coyote: at >= 0 && at === left + k, at };
      };
      const a = offJump(4), b = offJump(8);
      t.note('coyote', { at4: a, at8: b, top: +(c.y1 - W.hAt(c.x, c.z)).toFixed(3) });
      t.ok(a.left >= 0 && a.air && a.coyote, 'jump 4 steps (0.067 s) after leaving the top, in the air', a);
      t.ok(b.left >= 0 && b.air && !b.coyote, 'no air jump 8 steps (0.133 s) after (the buffer takes it at the landing)', b);
      // buffer: press 6 steps before touching down (0.10 s) → jumps on landing; 10 steps before (0.167 s) → doesn't
      const sp = openSpot(W, -6, 9, 4);
      // the landing step of a plain held jump, then presses k steps before it
      put(t, sp.x, sp.z, 0);
      sim(game, 1, intentFor({ yaw: 0, jump: true, jumpHeld: true }));
      let L = -1;
      sim(game, 60, intentFor({ yaw: 0, jumpHeld: true }), (i) => { if (pl.grounded) { L = i; return false; } });
      const buf = (k) => {
        put(t, sp.x, sp.z, 0);
        let jumps = 0;
        const off = game.events.on('jump', () => jumps++);
        sim(game, 1, intentFor({ yaw: 0, jump: true, jumpHeld: true }));
        sim(game, 50, (i) => intentFor({ yaw: 0, jumpHeld: true, jump: i === L - k }), (i) => i < L + 4);
        off();
        return jumps;
      };
      const pre = buf(6), early = buf(10);
      t.note('landStep', L);
      t.note('buffer', { pre, early });
      t.eq(pre, 2, 'pressed 0.10 s before landing: jumps again on touchdown');
      t.eq(early, 1, 'pressed 0.17 s before landing: no second jump');
    }],
    ['sprint: held after a roll → 5.8; release → 4.4; roll press while cooling down → sprint; L3 toggle; ends on a swing', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 6, 40);
      put(t, sp.x, sp.z, 0);
      sim(game, 20, intentFor({ yaw: 0, y: 1 }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true, sprint: true }));
      sim(game, 40, intentFor({ yaw: 0, y: 1, sprint: true }));
      t.ok(pl.sprint, 'sprinting after the roll'); t.near(pl.vel.length(), 5.8, 0.02, 'sprint speed');
      sim(game, 30, intentFor({ yaw: 0, y: 1 }));
      t.ok(!pl.sprint, 'released'); t.near(pl.vel.length(), 4.4, 0.02, 'run again');
      put(t, sp.x, sp.z, 0);
      sim(game, 20, intentFor({ yaw: 0, y: 1 }));
      sim(game, 40, intentFor({ yaw: 0, y: 1, toggle: true }));
      t.ok(pl.sprint && pl.sprintMode === 'toggle', 'pad toggle sprints'); t.near(pl.vel.length(), 5.8, 0.02, 'toggle speed');
      sim(game, 30, intentFor({ yaw: 0, x: 1, y: 1, toggle: true }));
      const lat = Math.abs(pl.vel.x * -Math.cos(0) + pl.vel.y * Math.sin(0));
      t.ok(lat <= 4.18 + 0.02, 'sideways capped at the strafe speed', lat);
      sim(game, 1, intentFor({ yaw: 0, y: 1, toggle: true, attack: true }));
      t.ok(!pl.sprint && pl.sprintEnd === 'attack' && pl.sprintToggleOff, 'a swing ends it (and the toggle)', { sprint: pl.sprint, end: pl.sprintEnd });
      sim(game, 30, intentFor({ yaw: 0, y: 1 }));
      put(t, sp.x, sp.z, 0);
      sim(game, 20, intentFor({ yaw: 0, y: 1 }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true }));
      sim(game, 14, intentFor({ yaw: 0, y: 1 }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true, sprint: true }));
      t.ok(pl.sprint && pl.state === 'normal', 'a roll press while cooling down sprints at once', pl.state);
    }],
    ['air: dash-jump keeps ≤ 6.2 m/s, sprint-jump carries 5.8; no roll in the air (buffered to the landing)', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 6, 40);
      put(t, sp.x, sp.z, 0);
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true }));
      sim(game, 3, intentFor({ yaw: 0, y: 1 }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, jump: true, jumpHeld: true }));
      const v0 = pl.vel.length();
      let vmax = 0, dashed = false;
      sim(game, 40, intentFor({ yaw: 0, y: 1, jumpHeld: true }), () => { vmax = Math.max(vmax, pl.vel.length()); return !pl.grounded; });
      t.note('dashJump', { v0: +v0.toFixed(3), vmax: +vmax.toFixed(3) });
      t.ok(Math.abs(v0 - 6.2) < 0.01 && vmax <= 6.2 + 1e-6, 'dash-jump speed', { v0, vmax });
      put(t, sp.x, sp.z, 0);
      sim(game, 1, intentFor({ yaw: 0, jump: true, jumpHeld: true }));
      sim(game, 8, intentFor({ yaw: 0, jumpHeld: true }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true, jumpHeld: true }));
      t.ok(pl.state !== 'dash' && !pl.grounded, 'no roll in the air', pl.state);
      sim(game, 30, intentFor({ yaw: 0, y: 1 }), () => { if (pl.state === 'dash') dashed = true; return !dashed; });
      t.ok(!dashed, 'a press 0.15 s+ before landing is gone by then (0.12 s buffer)');
    }],
    ['a jump cuts a swing tail from attackT 0.20 (earlier presses wait); air swings have no lunge', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 4);
      put(t, sp.x, sp.z, 0);
      sim(game, 1, intentFor({ yaw: 0, attack: true }));
      sim(game, 5, intentFor({ yaw: 0 }));
      sim(game, 1, intentFor({ yaw: 0, jump: true, jumpHeld: true }));   // attackT 0.10: buffered (0.12 s) until 0.20
      t.ok(pl.state === 'attack' && pl.grounded, 'early press: still swinging', pl.state);
      let at = null;
      sim(game, 20, intentFor({ yaw: 0, jumpHeld: true }), () => { if (!pl.grounded && at == null) at = pl.t; return pl.grounded; });
      t.ok(!pl.grounded && pl.state === 'normal', 'the buffered jump fired once the swing allowed it');
      put(t, sp.x, sp.z, 0);
      sim(game, 1, intentFor({ yaw: 0, jump: true, jumpHeld: true }));
      sim(game, 4, intentFor({ yaw: 0, jumpHeld: true }));
      const v0 = pl.vel.length();
      sim(game, 1, intentFor({ yaw: 0, attack: true, jumpHeld: true }));
      t.ok(pl.state === 'attack' && pl.vel.length() - v0 < 0.2, 'air swing without lunge', pl.vel.length());
    }],
    ['standing on props: stumps and low rocks yes (surface wood / stone), pots and chests never', (t) => {
      const { game, W, pl, D } = t;
      for (const kind of ['stump', 'rock']) {
        const c = openStand(W, kind);
        t.ok(!!c, 'an open ' + kind);
        if (!c) continue;
        // run at it from 2.5 m along its most open side, jump at ~1.9 m out
        const near = []; W.nearColliders(c.x, c.z, 4, near);
        let yaw = 0, far = -1;
        for (let i = 0; i < 16; i++) { const b = (i / 16) * Math.PI * 2, x = c.x - Math.sin(b) * 2.5, z = c.z - Math.cos(b) * 2.5; const d = Math.min(...near.filter((q) => q !== c).map((q) => shapeDist(q, x, z)), 9); if (d > far && W.walkable(x, z)) { far = d; yaw = b; } }
        const sx = c.x - Math.sin(yaw) * 2.5, sz = c.z - Math.cos(yaw) * 2.5;
        put(t, sx, sz, yaw);
        let on = null, landS = null;
        const off = game.events.on('land', (e) => { if (!on && pl.standOn && pl.standOn !== 'deck') { on = pl.standOn; landS = e.surface; } });
        sim(game, 80, (i) => intentFor({ yaw, y: Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z) > 0.15 ? 1 : 0, jump: i === 10, jumpHeld: i >= 10 && i < 40 }), () => !on);
        off();
        t.ok(on === c, kind + ': landed on top', { on: on && on.kind, y: pl.pos.y, top: c.y1 });
        t.eq(landS, kind === 'stump' ? 'wood' : 'stone', kind + ' surface');
        // walk off the far side: falls back to the ground
        sim(game, 60, intentFor({ yaw, y: 1 }));
        t.ok(pl.grounded && !pl.standOn && Math.abs(pl.pos.y - W.hAt(pl.pos.x, pl.pos.z)) < 0.05, kind + ': walked off onto the ground');
        t.ok(penetration(W, pl.pos.x, pl.pos.z, pl.r, pl.pos.y, true) < 0.02, kind + ': not inside it');
      }
      const pot = W.colliders.find((c) => c.kind === 'pot'), ch = W.colliders.find((c) => c.kind === 'chest');
      t.ok(!pot.stand && !ch.stand, 'pots / chests are not standable');
      t.eq(TM.standOnProps, true, 'TUNE.move.standOnProps default on');
      D.teleport(W.spawn.x, W.spawn.z, 0, 0);
    }],
    ['grounded steps never move the feet more than 0.35 m (snap down / step up), deeper drops fall', (t) => {
      const { game, W, pl } = t;
      const p = W.paths.woods, a = p[Math.round(p.length * 0.1)];
      put(t, a.x, a.z, 0);
      let worst = 0, falls = 0, prevY = pl.pos.y, prevG = true;
      const pts = p.slice(Math.round(p.length * 0.1), Math.round(p.length * 0.8));
      let k = 0;
      sim(game, 900, () => { const q = pts[Math.min(pts.length - 1, k)]; if (Math.hypot(q.x - pl.pos.x, q.z - pl.pos.z) < 1.5) k++; const yaw = Math.atan2(q.x - pl.pos.x, q.z - pl.pos.z); return intentFor({ yaw, y: 1 }); },
        () => { const dy = Math.abs(pl.pos.y - prevY); if (pl.grounded && prevG) worst = Math.max(worst, dy); if (!pl.grounded) falls++; prevY = pl.pos.y; prevG = pl.grounded; return k < pts.length; });
      t.note('woodsPath', { worst: +worst.toFixed(4), airSteps: falls, reached: k });
      t.ok(worst <= 0.36, 'grounded single-step |Δy|', worst);
      t.ok(k > pts.length * 0.8, 'walked the path', k);
    }],
    ['bridges: rails stop walks / rolls / jumps off the side; the deck is a wall from the shallow water', (t) => {
      const { game, W, pl } = t;
      let exits = 0, n = 0, entries = 0, m = 0;
      for (const b of W.bridges) for (const tt of [0.25, 0.5, 0.75]) for (const sd of [-1, 1]) for (const how of ['walk', 'dash', 'jump']) {
        const cx = b.ax + b.dx * b.len * tt, cz = b.az + b.dz * b.len * tt, side = Math.atan2(b.dz * sd, -b.dx * sd);
        put(t, cx, cz, side); n++;
        sim(game, 70, (i) => intentFor({ yaw: side, y: 1, dash: how === 'dash' && i === 2, jump: how === 'jump' && i === 2, jumpHeld: how === 'jump' }));
        const s = Math.abs(-(pl.pos.x - b.ax) * b.dz + (pl.pos.z - b.az) * b.dx);
        if (s > b.w / 2 - 0.08 || W.bridgeAt(pl.pos.x, pl.pos.z) === null) exits++;
      }
      // waders beside the islet bridges walking at the deck
      for (const b of W.bridges.filter((q) => q.id && q.id.startsWith('islet'))) for (let k = 0; k < 10; k++) for (const sd of [-1, 1]) {
        const tt = 0.15 + (k / 9) * 0.7, cx = b.ax + b.dx * b.len * tt + b.dz * sd * (b.w / 2 + 1.0), cz = b.az + b.dz * b.len * tt - b.dx * sd * (b.w / 2 + 1.0);
        if (!W.walkable(cx, cz) || W.hAt(cx, cz) > 0.3) continue;
        const yaw = Math.atan2(-b.dz * sd, b.dx * sd);
        put(t, cx, cz, yaw); m++;
        sim(game, 70, (i) => intentFor({ yaw, y: 1, jump: i === 20, jumpHeld: i >= 20 && i < 40 }));
        const d = W.bridgeAt(pl.pos.x, pl.pos.z);
        if (d !== null && pl.pos.y > d - 0.1) entries++;
      }
      t.note('bridges', { sideRuns: n, exits, waderRuns: m, entries });
      t.eq(exits, 0, 'exits through the rails'); t.eq(entries, 0, 'entries onto the deck from the water');
    }],
    ['colliders: fitted shapes (sign / house_b / shop / chest boxes, fence runs, rails, Great Tree from its model); reach intact', (t) => {
      const { W } = t, by = (k, s) => W.colliders.filter((c) => c.kind === k && c.shape === s).length;
      const tree = W.colliders.filter((c) => c.kind === 'tree');
      t.note('shapes', { sign: by('sign', 'obb'), houseObb: by('house', 'obb'), chest: by('chest', 'obb'), fence: by('fence', 'obb'), rail: by('rail', 'obb'), tree: tree.length && { verts: tree[0].n, r: +tree[0].r.toFixed(2), core: +tree[0].core.toFixed(2) }, boulder: by('boulder', 'circle') });
      t.ok(by('sign', 'obb') > 0 && by('chest', 'obb') === W.chests.length && by('fence', 'obb') > 0 && by('rail', 'obb') >= W.bridges.length * 2, 'boxes');
      t.ok(by('house', 'obb') >= 3, 'house_b / shop boxes');
      t.ok(tree.length === 1 && tree[0].shape === 'star' && tree[0].n >= 64, 'Great Tree: one star outline fitted from its model', { n: tree.length, shape: tree[0] && tree[0].shape, verts: tree[0] && tree[0].n });
      t.eq(W.unreachable.length, 0, 'unreachable'); t.eq(W.carved, 0, 'carved');
    }],
    ['Great Tree: one star outline that covers its mesh in the body band, at the foundation scale and at WP9\'s ×2.2', (t) => {
      const { W, G } = t, S = G.scenery.greatTree, model = S && (S.glb ? S.glb.a : S.group);
      t.ok(!!model, 'built tree');
      if (!model) return;
      const check = () => {
        const c = W.colliders.find((q) => q.kind === 'tree'), pts = treeBand(model, W.greatTree);
        let inside = 0, near = 0;
        for (let i = 0; i < pts.length; i += 2) { const d = shapeDist(c, pts[i], pts[i + 1]); if (d <= 0) inside++; else if (d <= 0.05) near++; }
        // vertices on the mesh: within 0.15 m of a band point (the rest close gaps narrower than Pip)
        const on = new Uint8Array(c.n);
        for (let i = 0; i < pts.length; i += 2) {
          const dx = pts[i] - c.x, dz = pts[i + 1] - c.z, kb = Math.round((Math.atan2(dx, dz) / (Math.PI * 2)) * c.n);
          for (let j = kb - 2; j <= kb + 2; j++) { const k = ((j % c.n) + c.n) % c.n; if (!on[k] && Math.hypot(dx - c.vx[k], dz - c.vz[k]) < 0.15) on[k] = 1; }
        }
        return { shape: c.shape, verts: c.n, r: +c.r.toFixed(2), points: pts.length / 2, cover: +((inside + near) / (pts.length / 2)).toFixed(4), onMesh: +(on.reduce((a, b) => a + b, 0) / c.n).toFixed(3), unreachable: W.unreachable.length };
      };
      const t0 = performance.now(), a = check(), s0 = model.scale.clone();
      let b = null, ms = 0;
      try {
        model.scale.multiplyScalar(2.2); model.updateWorldMatrix(true, true);
        const t1 = performance.now(); W.fitTreeColliders(S.footprint, S.height * 2.2); ms = performance.now() - t1;
        b = check();
      } finally { model.scale.copy(s0); model.updateWorldMatrix(true, true); W.fitTreeColliders(S.footprint, S.height); }
      const back = check();
      t.note('tree', { x1: a, x22: b, refitMs: +ms.toFixed(1), testMs: Math.round(performance.now() - t0) });
      for (const [k, r] of [['x1', a], ['x2.2', b]]) {
        t.ok(r.shape === 'star' && r.cover >= 0.995, k + ': ≥ 99.5 % of the band mesh inside the outline (or within 5 cm)', r);
        t.ok(r.onMesh >= 0.75, k + ': the outline sits on the mesh (≥ 75 % of its vertices within 0.15 m of it)', r);
      }
      t.ok(b.r > a.r * 1.8, 'the ×2.2 tree got the bigger outline', { x1: a.r, x22: b.r });
      t.eq(back.verts, a.verts, 'refit back to the built scale'); t.eq(W.unreachable.length, 0, 'unreachable after the refits');
    }],
    ['walls slide at any angle: into a house box at 20–70°, along a fence (no snag), along a cliff edge', (t) => {
      const { game, W, pl } = t;
      const hb = W.colliders.find((c) => c.kind === 'house' && c.shape === 'obb' && c.main);
      const out = [];
      for (const ang of [20, 45, 70]) {
        // stand 0.6 m off the box's +x face (behind its middle), walk into it at ang° off the normal
        const nx = Math.cos(hb.rot), nz = -Math.sin(hb.rot), tx = Math.sin(hb.rot), tz = Math.cos(hb.rot);
        const sx = hb.x + nx * (hb.hx + 0.6) - tx * 1.2, sz = hb.z + nz * (hb.hx + 0.6) - tz * 1.2;
        const yaw = Math.atan2(-nx * Math.cos(ang * D2R) + tx * Math.sin(ang * D2R), -nz * Math.cos(ang * D2R) + tz * Math.sin(ang * D2R));
        put(t, sx, sz, yaw);
        sim(game, 14, intentFor({ yaw, y: 1 }));
        const a0 = pl.pos.x * tx + pl.pos.z * tz;
        sim(game, 6, intentFor({ yaw, y: 1 }));
        const along = ((pl.pos.x * tx + pl.pos.z * tz) - a0) * 10, gap = shapeDist(hb, pl.pos.x, pl.pos.z) - pl.r, v = pl.vel.length();
        out.push({ ang, along: +along.toFixed(3), gap: +gap.toFixed(4), v: +v.toFixed(3) });
        t.ok(along >= 4.4 * Math.sin(ang * D2R) * 0.97, 'keeps the tangential speed at ' + ang + '°', along);
        t.ok(gap > -0.01 && gap < 0.02, 'flush against the wall at ' + ang + '°', gap);
        t.ok(Math.abs(v - along) < 0.05, 'velocity = the slide (no running in place)', { v, along });
      }
      // along a fence run while pushing into it: the lateral wobble
      const f = W.colliders.find((c) => c.kind === 'fence' && c.shape === 'obb');
      const fx = Math.cos(f.rot), fz = -Math.sin(f.rot), ax = Math.sin(f.rot), az = Math.cos(f.rot);
      put(t, f.x - ax * (f.hz - 0.3) + fx * 0.8, f.z - az * (f.hz - 0.3) + fz * 0.8, 0);
      const yaw = Math.atan2(ax * 0.8 - fx * 0.6, az * 0.8 - fz * 0.6);
      let lo = Infinity, hi = -Infinity, k = 0;
      sim(game, 60, intentFor({ yaw, y: 1 }), () => { k++; if (k > 12) { const s = (pl.pos.x - f.x) * fx + (pl.pos.z - f.z) * fz; const along = (pl.pos.x - f.x) * ax + (pl.pos.z - f.z) * az; if (Math.abs(along) < f.hz - 0.2) { lo = Math.min(lo, s); hi = Math.max(hi, s); } } });
      out.push({ fenceWobble: +(hi - lo).toFixed(5) });
      t.ok(hi - lo < 0.01, 'no snag along a fence', hi - lo);
      // cliff edges that are not axis-aligned (24 of them, sliding both ways): walk into each at 45° for 1.25 s. A stall
      // is 12 steps (0.2 s) with < 0.12 m net progress; one is legitimate where the edge itself turns head-on to the
      // wish (its 0.5 m-scale normal within 25° of it: a 1.9 m/s slide at best, and a 0.15 m lip of the 1 m
      // walkability field in front of it can hold Pip for ~0.5 s, a known limit), closes into a concave wedge (both
      // tangents unwalkable 0.5 m out) or ends at a solid met head-on; any other stall is glue (a notch the slide
      // should pass). The foundation's axis fallback (mv.slide = false) is measured on the first 6 edges for comparison
      const edges = [];
      for (let k = 0; k < 120000 && edges.length < 24; k++) {
        const a = k * 2.399, d = 20 + (k % 150), x = Math.sin(a) * d, z = Math.cos(a) * d;
        if (!W.walkable(x, z) || W.walkable(x + 1.2, z) === W.walkable(x - 1.2, z) && W.walkable(x, z + 1.2) === W.walkable(x, z - 1.2)) continue;
        const n = W.walkNormal(x, z, {});
        if (!n || Math.min(Math.abs(n.x), Math.abs(n.z)) < 0.35) continue;      // diagonal edges only
        if (W.hAt(x, z) < 0.6 || W.bridges.some((b) => Math.hypot(b.ax + b.dx * b.len / 2 - x, b.az + b.dz * b.len / 2 - z) < b.len / 2 + 8)) continue; // a cliff, not a shore or a bridge end
        let ok = true;
        for (let s2 = -4; s2 <= 4 && ok; s2 += 0.5) for (const off of [0.4, 1.5]) { const px = x - n.z * s2 + n.x * off, pz = z + n.x * s2 + n.z * off; if (!W.walkable(px, pz) || penetration(W, px, pz, 1.0) > 0) ok = false; }
        if (ok) edges.push({ x, z, n });
      }
      t.ok(edges.length >= 12, 'diagonal cliff edges', edges.length);
      const run = (edge, sgn, slide) => {
        const { x, z, n } = edge, sx = x + n.x * 1.2, sz = z + n.z * 1.2, wx = -n.x * Math.SQRT1_2 - sgn * n.z * Math.SQRT1_2, wz = -n.z * Math.SQRT1_2 + sgn * n.x * Math.SQRT1_2;
        const yaw = Math.atan2(wx, wz);
        put(t, sx, sz, yaw); pl._mv.slide = slide;
        const d = [], P = [];
        let px = pl.pos.x, pz = pl.pos.z;
        sim(game, 75, intentFor({ yaw, y: 1 }), (i) => { if (i >= 15) d.push(Math.hypot(pl.pos.x - px, pl.pos.z - pz) * 60); px = pl.pos.x; pz = pl.pos.z; P.push([px, pz]); });
        pl._mv.slide = true;
        let stall = null;
        for (let i = 15; i + 12 < P.length && !stall; i++) if (Math.hypot(P[i + 12][0] - P[i][0], P[i + 12][1] - P[i][1]) < 0.12) stall = P[i + 12];
        let legit = false;
        if (stall) {
          const nb = W.walkNormal(stall[0], stall[1], {}, 0.5), tx = nb ? -nb.z : 0, tz = nb ? nb.x : 0;
          legit = !!nb && (-(wx * nb.x + wz * nb.z) > 0.9 || (!W.walkable(stall[0] + tx * 0.5, stall[1] + tz * 0.5) && !W.walkable(stall[0] - tx * 0.5, stall[1] - tz * 0.5)));
          // slid off the edge's end into a solid met (nearly) head-on: a round trunk creeps, as it should
          W.nearColliders(stall[0], stall[1], 2, _nb);
          for (const c of _nb) if (c.body !== false && shapeDist(c, stall[0], stall[1], _s) - pl.r < 0.02 && -(wx * _s.nx + wz * _s.nz) > 0.9) legit = true;
        }
        return { mean: d.reduce((a, b) => a + b, 0) / d.length, min: Math.min(...d), walk: W.walkable(pl.pos.x, pl.pos.z), stall: !!stall, glue: !!stall && !legit, at: stall && stall.map((v) => +v.toFixed(2)) };
      };
      const cl = [], axf = [];
      for (const [i, e] of edges.entries()) for (const sgn of [1, -1]) { cl.push(run(e, sgn, true)); if (i < 6) axf.push(run(e, sgn, false)); }
      const sum = (L) => ({ runs: L.length, stalls: L.filter((r) => r.stall).length, glue: L.filter((r) => r.glue).length, minSpeed: +Math.min(...L.map((r) => r.min)).toFixed(3), meanSpeed: +(L.reduce((a, r) => a + r.mean, 0) / L.length).toFixed(3) });
      out.push({ cliff: sum(cl), axisFallback6: sum(axf), glueAt: cl.filter((r) => r.glue).map((r) => r.at) });
      t.eq(sum(cl).glue, 0, 'cliff slides never glue (stalls only where the edge turns head-on or closes into a wedge)');
      t.ok(sum(cl).meanSpeed > 2.5, 'cliff slide speed (45° into the edge: 3.1 m/s on a straight one)', sum(cl));
      t.ok(cl.every((r) => r.walk), 'always on walkable ground');
      t.note('slide', out);
    }],
    ['FP eye keep-out: the eye never goes within 0.12 m of a collider\'s eye radius, and moves continuously', (t) => {
      const { W, D, view, game } = t;
      // a declared tall collider whose eye radius exceeds its body (the case the keep-out exists for)
      const sp = openSpot(W, -6, 9, 4);
      const c = W.addDynamicCollider({ x: sp.x + 1.2, z: sp.z, r: 0.3, kind: 'wp3_test', decl: { h: 3, eye: 0.7 } });
      try {
        D.teleport(sp.x, sp.z, Math.PI / 2, 0); t.frames(3, { draw: false });
        let worst = Infinity, jump = 0, prev = null;
        for (let i = 0; i < 40; i++) {
          t.move(0, 1); t.frames(1);
          const d = Math.hypot(view.eye.x - c.x, view.eye.z - c.z) - c.rEye;
          worst = Math.min(worst, d);
          if (prev) jump = Math.max(jump, view.eye.distanceTo(prev));
          prev = view.eye.clone();
        }
        t.move(0, 0);
        t.note('keepOut', { worst: +worst.toFixed(4), maxStep: +jump.toFixed(4) });
        t.ok(worst >= TM.eyeClear - 1e-6, 'eye clearance', worst);
        t.ok(jump < 0.12, 'continuous', jump);
      } finally { c.active = false; W.colliders.splice(W.colliders.indexOf(c), 1); W.rehash(); game.view.snap(); }
    }],
    ['FP eye under eaves / awnings / the counter: a held jump flush against every building moves the eye only up and down, never into the underside', (t) => {
      const { W, D, view, pl } = t, blds = W.houses.concat(W.shop ? [Object.assign({ type: 'shop' }, W.shop)] : []);
      const res = { runs: 0, capped: 0, worstSide: 0, worstOver: -9, samples: [] };
      for (const b of blds) for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        let spot = null;
        for (let d = 1.5; d < 5 && !spot; d += 0.02) { const x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d; if (W.walkable(x, z) && penetration(W, x, z, pl.r + 0.005, W.hAt(x, z)) === 0) spot = { x, z }; }
        if (!spot || !W.colliders.some((c) => c.over && c.building && Math.hypot(c.building.x - b.x, c.building.z - b.z) < 0.1)) continue;
        const yaw = a + Math.PI;
        D.release(); D.teleport(spot.x, spot.z, yaw, 0); t.frames(3);
        if (Math.hypot(pl.pos.x - spot.x, pl.pos.z - spot.z) > 0.02) continue;
        res.runs++;
        let pe = view.eye.clone(), pb = pl.pos.clone(), capped = false;
        D.hold('jump');
        for (let f = 0; f < 36; f++) {
          t.frames(1);
          const e = view.eye, side = Math.hypot(e.x - pe.x, e.z - pe.z) - Math.hypot(pl.pos.x - pb.x, pl.pos.z - pb.z);
          const cap = W.eyeCeiling(e.x, e.z), raw = pl.pos.y + 0.88, over = e.y - Math.max(cap, W.ground(e.x, e.z) + 0.88);
          if (raw > cap + 0.005) capped = true;
          res.worstSide = Math.max(res.worstSide, side); res.worstOver = Math.max(res.worstOver, over);
          if ((side > 0.01 || over > 1e-3) && res.samples.length < 4) res.samples.push({ b: b.type, k, f, side: +side.toFixed(3), over: +over.toFixed(3) });
          pe = e.clone(); pb = pl.pos.clone();
        }
        D.release(); t.frames(30);
        if (capped) res.capped++;
      }
      res.worstSide = +res.worstSide.toFixed(4); res.worstOver = +res.worstOver.toFixed(4);
      t.note('eaves', res);
      t.ok(res.runs >= 20, 'flush jumps', res.runs);
      t.ok(res.capped >= 2, 'some jumps reach an underside (house_a eaves)', res.capped);
      t.ok(res.worstSide <= 0.01, 'eye ΔXZ per frame ≤ body ΔXZ + 1 cm (no sideways pop)', res);
      t.ok(res.worstOver <= 1e-3, 'eye never above the ceiling (underside − 0.12 m)', res);
    }],
    ['overhead body parts are sticky: rising ground under one never shoves Pip out; a jump under it bonks at its underside', (t) => {
      const { game, W, pl } = t;
      // an uphill run (slope ~0.1–0.3) with room: the part's bottom is just above the head at its near edge
      let spot = null;
      for (let k = 0; k < 20000 && !spot; k++) {
        const a = k * 2.399, d = 10 + (k % 140), x = Math.sin(a) * d, z = Math.cos(a) * d;
        if (!W.walkable(x, z) || W.inArena(x, z, 4) || W.bridgeAt(x, z) !== null) continue;
        const gx = W.hAt(x + 0.5, z) - W.hAt(x - 0.5, z), gz = W.hAt(x, z + 0.5) - W.hAt(x, z - 0.5), g = Math.hypot(gx, gz);
        if (g < 0.1 || g > 0.3) continue;
        const ux = gx / g, uz = gz / g;
        let ok = true;
        for (let s = -1.5; s <= 4 && ok; s += 0.5) { const px = x + ux * s, pz = z + uz * s; if (!W.walkable(px, pz) || penetration(W, px, pz, 1.0) > 0) ok = false; }
        for (let s = 0; s <= 2.5 && ok; s += 0.25) { const dh = W.hAt(x + ux * (s + 0.25), z + uz * (s + 0.25)) - W.hAt(x + ux * s, z + uz * s); if (dh < 0.02 || dh > 0.09) ok = false; }   // rising all the way
        if (ok) spot = { x, z, ux, uz };
      }
      t.ok(!!spot, 'an open uphill run');
      if (!spot) return;
      const yaw = Math.atan2(spot.ux, spot.uz), cx = spot.x + spot.ux * 2.0, cz = spot.z + spot.uz * 2.0;
      const y0 = W.hAt(spot.x + spot.ux * 0.9, spot.z + spot.uz * 0.9) + 0.99;   // passable at its near edge, the ground keeps rising
      const c = W.addDynamicCollider({ x: cx, z: cz, kind: 'wp3_test', shape: 'obb', hx: 1.0, hz: 1.0, rot: yaw, r: Math.SQRT2, y0, y1: y0 + 0.4, over: true });
      try {
        put(t, spot.x - spot.ux * 0.5, spot.z - spot.uz * 0.5, yaw);
        let worst = 0, under = 0, px = pl.pos.x, pz = pl.pos.z;
        sim(game, 60, intentFor({ yaw, y: 0.6 }), () => { worst = Math.max(worst, Math.hypot(pl.pos.x - px, pl.pos.z - pz)); px = pl.pos.x; pz = pl.pos.z; if (shapeDist(c, pl.pos.x, pl.pos.z) < pl.r) under++; });
        const rise = pl.pos.y + 1.0 - y0;
        t.note('sticky', { worstStep: +worst.toFixed(4), under, headAboveBottom: +rise.toFixed(3) });
        t.ok(under > 20 && rise > 0, 'walked in under it while the ground rose past the threshold', { under, rise });
        t.ok(worst < 0.05, 'never shoved (largest step at 2.64 m/s)', worst);
        t.ok(penetration(W, pl.pos.x, pl.pos.z, pl.r, pl.pos.y, true) === 0 && pl.unsafeT === 0, 'not flagged stuck under it');
        // a held jump just inside its edge (head below its bottom): the head stops at the underside, no shove
        put(t, spot.x + spot.ux * 0.7, spot.z + spot.uz * 0.7, yaw);
        const pos = { x: pl.pos.x, z: pl.pos.z }, under0 = shapeDist(c, pos.x, pos.z) < pl.r;
        let top = -9, side = 0, air = 0;
        sim(game, 40, (i) => intentFor({ yaw, jump: i === 0, jumpHeld: true }), () => { top = Math.max(top, pl.pos.y + 1.0 - c.y0); side = Math.max(side, Math.hypot(pl.pos.x - pos.x, pl.pos.z - pos.z)); if (!pl.grounded) air++; });
        t.note('bonk', { under0, headOverBottom: +top.toFixed(4), side: +side.toFixed(4), air, grounded: pl.grounded });
        t.ok(under0 && air > 0, 'jumped from under it', { under0, air });
        t.ok(top <= 1e-6, 'head never rises into it', top);
        t.ok(side < 0.02 && pl.grounded, 'no shove, landed', side);
      } finally { c.active = false; W.colliders.splice(W.colliders.indexOf(c), 1); W.rehash(); }
    }],
    ['shop counter (WP9\'s, top 0.57 m): walking into it from 4 offsets stops Pip at its front without a shove (also during a jump there); the awning posts beside it stop his body', (t) => {
      const { game, W, pl } = t, b = W.shop;
      t.ok(!!b, 'a shop');
      if (!b) return;
      const rot = b.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), L = (lx, lz) => ({ x: b.x + lx * cs + lz * sn, z: b.z - lx * sn + lz * cs });
      const res = [], ct = BUILDINGS.shop.find((P) => P.hx > 1 && P.z > 2 && !P.cam), front = ct.z + ct.hz;   // its box
      // offsets along the counter at least 0.4 m in from its ends (WP9's counter spans model x −0.63 … 1.73; walking at
      // its very end slides Pip round it to the crate beside it, which is open ground)
      for (const lx of [ct.x - ct.hx + 0.45, ct.x - 0.3, ct.x + 0.4, ct.x + ct.hx - 0.45]) {
        const s = L(lx, 3.4), e = L(lx, 0), yaw = Math.atan2(e.x - s.x, e.z - s.z);
        put(t, s.x, s.z, yaw);
        let worst = 0, px = pl.pos.x, pz = pl.pos.z;
        sim(game, 150, intentFor({ yaw, y: 1 }), (i) => { if (i > 20) worst = Math.max(worst, Math.hypot(pl.pos.x - px, pl.pos.z - pz)); px = pl.pos.x; pz = pl.pos.z; });
        const lz = (pl.pos.x - b.x) * sn + (pl.pos.z - b.z) * cs, x0 = pl.pos.x, z0 = pl.pos.z;
        let side = 0;
        sim(game, 40, (i) => intentFor({ yaw, y: 1, jump: i === 0, jumpHeld: true }), () => { side = Math.max(side, Math.hypot(pl.pos.x - x0, pl.pos.z - z0)); });
        res.push({ lx: +lx.toFixed(2), worst: +worst.toFixed(3), lz: +lz.toFixed(3), jumpDrift: +side.toFixed(3), unsafe: pl.unsafeT });
      }
      t.note('counter', res);
      t.ok(res.every((r) => r.worst < 0.08), 'no shove (the run speed is 0.073 m per step)', res);
      t.ok(res.every((r) => r.lz >= front + pl.r - 0.02), 'stopped in front of the counter (its front edge + Pip\'s radius)', { front, res });
      t.ok(res.every((r) => r.jumpDrift < 0.03 && r.unsafe === 0), 'a jump pushing into it never shoves, never stuck', res);
      // the awning posts (r 0.05 to the ground; r2: they had no collider and Pip's body passed 0.27 m into one): walking
      // at each, from the front and from the side, his centre never comes nearer than his radius + the post's
      const posts = BUILDINGS.shop.filter((P) => P.r != null && P.r < 0.1), rows = [];
      t.ok(posts.length === 2, 'two awning posts', posts.length);
      for (const P of posts) for (const [ox, oz] of [[0, 1.2], [1.2, 0.2], [-1.2, 0.2]]) {
        const s0 = L(P.x + ox, P.z + oz), q = L(P.x, P.z), yaw = Math.atan2(q.x - s0.x, q.z - s0.z);
        if (!W.walkable(s0.x, s0.z) || penetration(W, s0.x, s0.z, pl.r) > 0) continue;
        put(t, s0.x, s0.z, yaw);
        let near = 9;
        sim(game, 90, intentFor({ yaw, y: 1 }), () => { near = Math.min(near, Math.hypot(pl.pos.x - q.x, pl.pos.z - q.z)); });
        rows.push({ post: P.x, from: [ox, oz], near: +near.toFixed(3) });
      }
      t.note('posts', rows);
      t.ok(rows.length >= 3 && rows.every((r) => r.near >= pl.r + 0.05 - 0.01), 'the posts stop Pip\'s body', rows);
    }],
    ['buildings fit WP9\'s models: every mesh point in Pip\'s body band (0.05–1.0 m) is inside the building\'s body colliders or within 3 cm of them (flower boxes, ivy, door steps, the shop counter, its crates and awning posts)', (t) => {
      const { W } = t, geos = { house_a: houseA().geo, house_b: houseB().geo, shop: shopModel().geo }, res = {};
      const blds = W.houses.concat(W.shop ? [Object.assign({ type: 'shop' }, W.shop)] : []);
      for (const b of blds) {
        if (res[b.type]) continue;
        const own = (c) => (c.building && Math.hypot(c.building.x - b.x, c.building.z - b.z) < 0.1) || c.kind === 'counter' || c.kind === 'dressing';
        const near = W.nearColliders(b.x, b.z, 6, []).filter((c) => c.body !== false && c.active !== false && Math.hypot(c.x - b.x, c.z - b.z) < 5 && own(c));
        const pts = bandPoints(geos[b.type], b, 0.05, 1.0), y0 = b.y - 0.05, cs = Math.cos(b.rot), sn = Math.sin(b.rot);
        let worst = 0, at = null;
        for (let i = 0; i < pts.length; i += 3) {
          const y = pts[i + 1] - y0;
          if (y < 0.05 || y > 1.0) continue;
          let d = Infinity;
          for (const c of near) d = Math.min(d, shapeDist(c, pts[i], pts[i + 2]));
          if (d > worst) { const dx = pts[i] - b.x, dz = pts[i + 2] - b.z; worst = d; at = [+(dx * cs - dz * sn).toFixed(2), +y.toFixed(2), +(dx * sn + dz * cs).toFixed(2)]; }
        }
        res[b.type] = { worst: +worst.toFixed(3), local: at, colliders: near.length };
      }
      t.note('cover', res);
      t.ok(Object.keys(res).length === 3, 'house_a, house_b and the shop', Object.keys(res));
      t.ok(Object.values(res).every((r) => r.worst <= 0.03), 'body-band mesh within 3 cm of the colliders', res);
    }],
    ['tree canopies: a held jump beside pines / snow pines / round trees never lifts the eye into the crown', (t) => canopyRuns(t, 4)],
    ['sprint ends once the wish stays outside the ±50° cone for 0.2 s (a gradual turn into a strafe / backpedal)', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 6, 40);
      put(t, sp.x, sp.z, 0);
      sim(game, 20, intentFor({ yaw: 0, y: 1 }));
      sim(game, 1, intentFor({ yaw: 0, y: 1, dash: true, sprint: true }));
      sim(game, 24, intentFor({ yaw: 0, y: 1, sprint: true }));
      const seq = [];
      for (const [x, y] of [[Math.SQRT1_2, Math.SQRT1_2], [1, 0], [Math.SQRT1_2, -Math.SQRT1_2], [0, -1]]) {
        let endAt = null;
        sim(game, 24, intentFor({ yaw: 0, x, y, sprint: true }), (i) => { if (endAt == null && !pl.sprint) endAt = i; });
        seq.push({ dir: Math.round(Math.atan2(x, y) / D2R), sprint: pl.sprint, endAt, end: pl.sprintEnd || null, v: +pl.vel.length().toFixed(3) });
      }
      t.note('turn', seq);
      t.ok(seq[0].sprint && Math.abs(seq[0].v - 5.8) < 0.02, '45°: still sprinting at 5.8', seq[0]);
      t.ok(!seq[1].sprint && seq[1].endAt != null && seq[1].endAt <= 13, '90°: ended within 0.2 s + a step', seq[1]);
      t.ok(seq.slice(1).every((s) => !s.sprint), 'stays ended while strafing / backpedalling', seq);
      t.near(seq[3].v, 3.52, 0.02, 'backpedal at the plain backpedal speed');
    }],
    ['the Great Tree fit replaces the raw colliders of the tree (kind tree, or flagged greatTree: true); others are kept', (t) => {
      const { W, G } = t, S = G.scenery.greatTree, T = W.greatTree;
      const fake = [{ x: T.x + 5, z: T.z, r: 1.1, kind: 'gtroot', greatTree: true }, { x: T.x, z: T.z + 5, r: 0.9, kind: 'root_ring', greatTree: true }], keep = { x: T.x - 5, z: T.z, r: 0.9, kind: 'gtroot' };
      try {
        W.colliders.push(...fake, keep); W.rawColliders();
        W.fitTreeColliders(S.footprint, S.height);
        const left = W.colliders.filter((c) => fake.includes(c)).length, shapes = W.solidShapes().filter((c) => fake.includes(c)).length;
        const kept = W.colliders.includes(keep) && W.solidShapes().includes(keep);
        t.note('treeRaw', { left, shapes, kept, star: W.colliders.filter((c) => c.kind === 'tree').length });
        t.eq(left, 0, 'flagged ones dropped from W.colliders'); t.eq(shapes, 0, 'not rebuilt by solidShapes'); t.ok(kept, 'an unflagged raw collider of another kind is kept');
      } finally {
        W._raw = W._raw.filter((c) => !fake.includes(c) && c !== keep); W.colliders = W.colliders.filter((c) => !fake.includes(c) && c !== keep); W._rawN = -1;
        W.fitTreeColliders(S.footprint, S.height);
      }
      t.eq(W.colliders.filter((c) => c.kind === 'tree').length, 1, 'one star'); t.eq(W.unreachable.length, 0, 'unreachable');
    }],
    ['bridge mouths: walking onto every deck end along its axis and at ±35° ends on the deck (no world solid in a mouth: WP9 keeps them clear)', (t) => {
      const { game, W, pl } = t, res = { runs: 0, onDeck: 0, fail: [] };
      for (const [bi, b] of W.bridges.entries()) for (const end of [0, 1]) for (const off of [0, -35, 35]) {
        const ex = end ? b.ax + b.dx * b.len : b.ax, ez = end ? b.az + b.dz * b.len : b.az, sg = end ? -1 : 1, yaw = Math.atan2(b.dx * sg, b.dz * sg) + off * D2R;
        const sx = ex - Math.sin(yaw) * 3, sz = ez - Math.cos(yaw) * 3;
        if (!W.walkable(sx, sz) || penetration(W, sx, sz, pl.r, W.hAt(sx, sz)) > 0) continue;
        put(t, sx, sz, yaw); res.runs++;
        sim(game, 120, intentFor({ yaw, y: 1 }));   // 2 s: on the deck, or settled against what stopped him
        if (pl.standOn === 'deck') { res.onDeck++; continue; }
        W.nearColliders(pl.pos.x, pl.pos.z, 2, _nb);
        const touch = _nb.filter((c) => c.body !== false && shapeDist(c, pl.pos.x, pl.pos.z) - pl.r < 0.02), wx = Math.sin(yaw), wz = Math.cos(yaw);
        const headOn = touch.filter((c) => !c.bridge).map((c) => { shapeDist(c, pl.pos.x, pl.pos.z, _s); return -(wx * _s.nx + wz * _s.nz); });
        const rec = { bi, end, off, at: [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)], touch: touch.map((c) => c.kind), headOn: headOn.map((v) => +v.toFixed(3)) };
        res.fail.push(rec);   // r3: no exemption any more (the islet rock's wedge with the end post is gone): any other stop fails
      }
      t.note('mouths', res);
      t.ok(res.runs >= W.bridges.length * 4, 'runs', res.runs);
      t.eq(res.fail.length, 0, 'every entry ends on the deck');
    }],
    ['hairline (r3): the edge slide never threads a sliver of walkable ground < 0.2 m across (deep water against a bank too steep to walk, met at a grazing angle); a 0.5 m strip still walks end to end', (t) => {
      // a stub world: open ground for z < 0 and a strip |x| < hw from z 0 to 6 (the real field's margin: > 0 walkable).
      // Pip walks up it from the open side, drifting left into its edge (the slide then runs along that edge, as it ran
      // 4 m along the band at the peaks shore, 61.5…62.8, 30…33.5, in wp3-heavy's walks)
      const run = (hw) => {
        const f = (x, z) => Math.max(-z, z >= 0 && z <= 6 ? hw - Math.abs(x) : -1);
        const S = { bridges: [], walkF: f, walkable: (x, z) => f(x, z) > 0, walkNormal: t.W.walkNormal, nearColliders: (x, z, r, out) => { out.length = 0; return out; } };
        const e = { pos: { x: 0.6, z: -0.5 } }, o = { r: 0.3, slide: true, feetY: 0, grounded: true }, l = Math.hypot(0.3, 1), v = 4.4 / 60;
        for (let i = 0; i < 150; i++) moveCircle(S, e, (-0.3 / l) * v, (1 / l) * v, o);
        return { z: +e.pos.z.toFixed(3), x: +e.pos.x.toFixed(3), mid: { walkable: S.walkable(0, 3), walkOK: walkOK(S, 0, 3) } };
      };
      const hair = run(0.05), strip = run(0.25);
      t.note('hairline', { hair, strip });
      t.ok(hair.mid.walkable && !hair.mid.walkOK, 'a 0.1 m sliver: walkable by the field, not ground for Pip', hair.mid);
      t.ok(hair.z < 0.15, 'the slide stops at the sliver mouth (never threads it)', hair);
      t.ok(strip.mid.walkOK && strip.z > 5.5, 'a 0.5 m strip: walked to its end', strip);
    }],
    ['stuck recovery: dropped in deep water (no way out), Pip is back on his last safe spot within 0.5 s + the fade', (t) => {
      const { game, W, D, pl } = t;
      // a walkable shore spot with deep water 3 m away
      let spot = null;
      for (let k = 0; k < 20000 && !spot; k++) {
        const a = k * 2.399, d = 60 + (k % 120), x = Math.sin(a) * d, z = Math.cos(a) * d;
        if (W.hAt(x, z) > -1.2) continue;
        for (let j = 0; j < 8 && !spot; j++) { const b = (j / 8) * Math.PI * 2, sx = x + Math.sin(b) * 3, sz = z + Math.cos(b) * 3; if (W.walkable(sx, sz) && W.hAt(sx, sz) > 0.3 && penetration(W, sx, sz, pl.r) === 0) spot = { x, z, sx, sz }; }
      }
      t.ok(!!spot, 'a shore');
      D.teleport(spot.sx, spot.sz, 0, 0); t.frames(40);
      const safe = { ...pl.lastSafe };
      pl.pos.set(spot.x, W.hAt(spot.x, spot.z), spot.z); pl._sim.copy(pl.pos);   // an impossible spot (no resync)
      let n = 0;
      for (; n < 90 && Math.hypot(pl.pos.x - spot.x, pl.pos.z - spot.z) < 0.5; n++) t.frames(1);
      t.frames(20);
      t.note('unstick', { frames: n, safe, now: [pl.pos.x, pl.pos.z] });
      t.ok(n <= 31 + Math.ceil(TM.unstickFade * 60) + 2, 'warped within 0.5 s + fade', n);
      t.ok(Math.hypot(pl.pos.x - safe.x, pl.pos.z - safe.z) < 0.01, 'at lastSafe', { safe, at: [pl.pos.x, pl.pos.z] });
      t.ok(pl.grounded && !pl.stuck, 'standing again');
    }],
    ['knockback hops in TP only: hurt lifts Pip 2.5 m/s and he lands within 0.3 s without an EV.LAND; in FP (also under reduce motion) no hop, no eye rise, no landing', (t) => {
      const { game, W, D, pl, view, settings } = t, sp = openSpot(W, -6, 9, 4);
      const lands = () => t.events(t.EV.LAND).length;
      D.setView('tp'); D.teleport(sp.x, sp.z, 0, 0); t.frames(3);
      D.god(false);
      D.clearEvents();
      t.ok(D.hurt(1, 90), 'TP: hurt landed');
      t.near(pl.vy, TM.hurtHop, 1e-9, 'TP: hop');
      let n = 0; while (!pl.grounded && n < 60) { t.frames(1); n++; }
      t.note('hopFrames', n);
      t.ok(pl.grounded && n <= 18 + 4, 'TP: landed', n);   // + 4 hit-stop frames
      t.frames(10);
      t.eq(lands(), 0, 'TP: the hop\'s touchdown is no landing (EV.LAND)');
      const rows = {};
      for (const rm of [false, true]) {
        settings.set('reduceMotion', rm);
        D.setView('fp'); D.teleport(sp.x, sp.z, 0, 0); pl.iframes = 0; pl.state = 'normal'; t.frames(30);
        D.clearEvents();
        const y0 = view.eye.y;
        let rise = 0, air = 0;
        t.ok(D.hurt(1, 90), 'FP: hurt landed');
        for (let i = 0; i < 40; i++) { t.frames(1); rise = Math.max(rise, view.eye.y - y0); if (!pl.grounded) air++; }
        rows[rm ? 'reduceMotion' : 'fp'] = { rise: +rise.toFixed(4), air, lands: lands() };
        t.ok(air === 0 && rise < 0.005 && lands() === 0, 'FP' + (rm ? ' (reduce motion)' : '') + ': no hop, the eye never rises, no landing', rows);
      }
      settings.set('reduceMotion', false);
      t.note('fp', rows);
    }],
    ['jump buffer (feel T16): a press 7 steps (≤ 0.12 s) before touchdown jumps on the touchdown step; 8 steps before: no jump', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 4);
      const run = (k) => {
        put(t, sp.x, sp.z, 0);
        let L = -1, n = 0;
        sim(game, 60, (i) => intentFor({ jump: i === 0, jumpHeld: i < 20 }), () => { n++; if (L < 0 && pl.grounded) L = n; });   // reference landing step
        put(t, sp.x, sp.z, 0);
        let land = -1, jump2 = -1, i = 0;
        const off1 = game.events.on(t.EV.LAND, () => { if (land < 0) land = i; }), off2 = game.events.on(t.EV.JUMP, () => { if (i > 1 && jump2 < 0) jump2 = i; });
        try { sim(game, 60, (s) => { i = s + 1; return intentFor({ jump: s === 0 || s === L - 1 - k, jumpHeld: s < 20 }); }); } finally { off1(); off2(); }
        return { L, k, land, jump2 };
      };
      const r7 = run(7), r8 = run(8), r3 = run(3);
      t.note('buffer', { r3, r7, r8 });
      t.ok(r7.land > 0 && r7.jump2 === r7.land, 'pressed 7 steps before: jumps on the touchdown step', r7);
      t.ok(r3.land > 0 && r3.jump2 === r3.land, 'pressed 3 steps before: jumps on the touchdown step', r3);
      t.eq(r8.jump2, -1, 'pressed 8 steps before: no jump');
    }],
    ['pad L3 (input sprintToggle) latches a sprint through the module; stopping ends it and clears the latch', (t) => {
      const { W, D, pl, game } = t, sp = openSpot(W, -6, 9, 6, 40);
      const mod = game.modules.find((m) => m && m.name === 'wp3-player-fx');
      D.teleport(sp.x, sp.z, 0, 0); t.frames(2);
      t.move(0, 1); t.frames(12);
      t.press('sprintToggle'); t.frames(30);
      t.ok(mod && mod.toggle === true, 'module latched', mod && mod.toggle);
      t.ok(pl.sprint && pl.sprintMode === 'toggle', 'sprinting', { sprint: pl.sprint, mode: pl.sprintMode });
      t.near(pl.vel.length(), 5.8, 0.05, 'sprint speed');
      t.move(0, 0); t.frames(10);
      t.ok(!pl.sprint && mod.toggle === false, 'stopping ends it and the latch', { sprint: pl.sprint, toggle: mod.toggle });
    }],
    ['footprints: running on sand / snow leaves boot prints (one per step), grass none; they fade out after printLife', (t) => {
      const { W, D, pl, game } = t, P = D.phys;
      const find = (surf) => { for (let z = -170; z < 170; z += 1.5) for (let x = -170; x < 170; x += 1.5) { if (W.surfaceAt(x, z) !== surf || !W.walkable(x, z) || W.slopeAt(x, z) > 0.3 || W.inArena(x, z, 6)) continue; let ok = true; for (let k = 1; k <= 6 && ok; k++) if (W.surfaceAt(x + k, z) !== surf || !W.walkable(x + k, z) || penetration(W, x + k, z, 0.5) > 0) ok = false; if (ok && penetration(W, x, z, 0.5) === 0) return { x, z }; } return null; };
      const mod = game.modules.find((m) => m && m.name === 'wp3-player-fx');
      mod.clearPrints();
      const run = (sp) => { D.teleport(sp.x, sp.z, Math.PI / 2, 0); t.frames(2); const n0 = P.prints().live; t.move(0, 1); t.frames(70); t.move(0, 0); t.frames(10); return P.prints().live - n0; };
      const g = openSpot(W, -6, 9, 4), sand = find('sand'), snow = find('snow');
      t.ok(!!sand && !!snow, 'sand and snow spots', { sand, snow });
      const ng = run({ x: g.x - 2, z: g.z }), ns = sand ? run(sand) : 0, nw = snow ? run(snow) : 0;
      t.note('prints', { grass: ng, sand: ns, snow: nw, max: P.prints().max, fallback: P.prints().fallback });
      t.eq(ng, 0, 'grass: no prints');
      t.ok(ns >= 3 && nw >= 3, 'sand / snow: a print per step', { sand: ns, snow: nw });
      t.frames(Math.ceil((TM.printLife + 0.5) * 60));
      t.eq(P.prints().live, 0, 'all faded after printLife');
    }],
    ['boss arena clamp holds in the air (a jump at the edge never leaves the ring)', (t) => {
      const { game, W, pl } = t, sp = openSpot(W, -6, 9, 6, 40);
      const keep = game.fight;
      game.fight = { phase: 'fight', arenaClamp: { x: sp.x, z: sp.z, r: 3 }, rings: [], boss: null };
      try {
        put(t, sp.x, sp.z, 0);
        let worst = 0;
        sim(game, 90, (i) => intentFor({ yaw: 0, y: 1, sprint: true, dash: i === 3, jump: i === 10 || i === 50, jumpHeld: true }), () => { worst = Math.max(worst, Math.hypot(pl.pos.x - sp.x, pl.pos.z - sp.z)); });
        t.note('arena', { worst: +worst.toFixed(4), limit: 3 - pl.r });
        t.ok(worst <= 3 - pl.r + 1e-6, 'inside the clamp', worst);
      } finally { game.fight = keep; }
    }],
    ['probeSegment: boxes are exact (a segment past a house corner is clear; into the face stops at radius)', (t) => {
      const { W } = t, hb = W.colliders.find((c) => c.kind === 'house' && c.shape === 'obb' && c.main);
      const nx = Math.cos(hb.rot), nz = -Math.sin(hb.rot), tx = Math.sin(hb.rot), tz = Math.cos(hb.rot), y = hb.y0 + 1.2;
      const o = { terrain: false, water: false, decks: false, ignore: (c) => c !== hb };
      const ax = hb.x + nx * (hb.hx + 3), az = hb.z + nz * (hb.hx + 3);
      const tt = W.probeSegment(ax, y, az, hb.x, y, hb.z, 0.22, o);
      t.near(tt * Math.hypot(ax - hb.x, az - hb.z), 3 - 0.22, 1e-6, 'face contact distance');
      // a segment that passes the corner diagonally 0.3 m outside it: clear (a bounding circle would hit)
      const cx = hb.x + nx * hb.hx + tx * hb.hz, cz = hb.z + nz * hb.hx + tz * hb.hz, dx = (nx + tx) / Math.SQRT2, dz = (nz + tz) / Math.SQRT2;
      const px = cx + dx * 0.55, pz = cz + dz * 0.55, qx = -dz, qz = dx;
      t.eq(W.probeSegment(px - qx * 3, y, pz - qz * 3, px + qx * 3, y, pz + qz * 3, 0.22, { ...o }), 1, 'clear past the corner');
      t.ok(W.probeSegment(px - qx * 3 - dx * 0.4, y, pz - qz * 3 - dz * 0.4, px + qx * 3 - dx * 0.4, y, pz + qz * 3 - dz * 0.4, 0.22, { ...o }) < 1, 'clips the rounded corner');
    }],
  ], { desc: 'WP3 player physics + world collision (RULINGS numbers, every rule once)', prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12, sword: 1 } });

  // ------------------------------------------------------------------ heavy statistics
  suite('wp3-heavy', [
    ['1000 random jumps (run / sprint / dash-jumps, random wish): 0 landings outside W.reach, 0 stuck > 0.5 s', (t) => {
      const { game, W, pl } = t, n = (t.opts && t.opts.n) || 1000;
      let rs = 917;
      const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const R = W.reach, cells = [];
      for (let k = 0; k < R.length; k++) if (R[k]) cells.push(k);
      const res = { jumps: 0, aimed: 0, outside: 0, joined: 0, stuck: 0, unsafe: 0, onTops: 0, maxAir: 0, samples: [] };
      const tops = W.colliders.filter((c) => c.stand && !W.inArena(c.x, c.z, 2));
      for (let tries = 0; res.jumps < n && tries < n * 20; tries++) {
        const k = cells[(rnd() * cells.length) | 0], x = (k % 360) - 180 + rnd(), z = ((k / 360) | 0) - 180 + rnd();
        if (!W.walkable(x, z) || W.inArena(x, z, 1) || penetration(W, x, z, pl.r) > 0) continue;
        res.jumps++;
        let yaw = rnd() * Math.PI * 2, mode = rnd(), sx = rnd() * 2 - 1, sy = rnd() * 2 - 1, hold = rnd() < 0.8;
        // one in five: aimed at a stump / low rock 1.5–2.6 m away (landing on tops, stepping and dropping off them)
        if (tops.length && rnd() < 0.2) {
          const c = tops[(rnd() * tops.length) | 0], a = rnd() * Math.PI * 2, d = 1.5 + rnd() * 1.1, tx = c.x - Math.sin(a) * d, tz = c.z - Math.cos(a) * d;
          if (W.walkable(tx, tz) && penetration(W, tx, tz, pl.r) === 0 && pl.reachable(tx, tz)) { put(t, tx, tz, a); yaw = a; sx = 0; sy = 1; mode = 1; res.aimed++; } else put(t, x, z, yaw);
        } else put(t, x, z, yaw);
        const run = 6 + ((rnd() * 20) | 0);
        if (mode < 0.25) { sim(game, 1, intentFor({ yaw, x: sx, y: sy, dash: true, sprint: true })); sim(game, 14, intentFor({ yaw, x: sx, y: sy, sprint: true })); }
        else if (mode < 0.45) { sim(game, 1, intentFor({ yaw, x: sx, y: sy, dash: true })); sim(game, 2, intentFor({ yaw, x: sx, y: sy })); }
        else sim(game, run, intentFor({ yaw, x: sx, y: sy }));
        sim(game, 1, intentFor({ yaw, x: sx, y: sy, jump: true, jumpHeld: hold, sprint: mode < 0.25 }));
        let air = 0;
        sim(game, 120, intentFor({ yaw, x: sx, y: sy, jumpHeld: hold, sprint: mode < 0.25 }), () => { air++; return !pl.grounded || air < 2; });
        res.maxAir = Math.max(res.maxAir, air);
        const lx = pl.pos.x, lz = pl.pos.z, top = pl.standOn && pl.standOn !== 'deck' ? pl.standOn : null;
        if (top) res.onTops++;
        // W.reach is a 4-connected BFS on 1 m cells sampled at their centres; Pip's walkability is continuous, so a walk
        // can already end a cell beyond it where a walkable tongue pinches between cells: ±2 cells is "reached", and so
        // is a landing joined to a reached cell by a walk (a 0.1 m flood fill of spots Pip's body fits)
        let ok = reach2(R, lx, lz) || (top && reach2(R, top.x, top.z));
        if (!ok && !top) { ok = walkJoined(W, R, lx, lz, pl.r); if (ok) res.joined++; }
        if (!ok) { res.outside++; if (res.samples.length < 6) res.samples.push(['outside', +lx.toFixed(2), +lz.toFixed(2), +pl.pos.x.toFixed(2), top ? top.kind : null]); }
        // not stuck: some direction gets him ≥ 0.3 m away within 0.25 s each, and no unsafe flag > 0.5 s
        let moved = 0;
        for (let d = 0; d < 8 && moved < 0.3; d++) {
          const yy = (d / 8) * Math.PI * 2;
          pl.pos.set(lx, pl.pos.y, lz); pl.vel.set(0, 0); pl._sim.copy(pl.pos);
          sim(game, 15, intentFor({ yaw: yy, y: 1 }));
          moved = Math.max(moved, Math.hypot(pl.pos.x - lx, pl.pos.z - lz));
        }
        if (moved < 0.3) { res.stuck++; if (res.samples.length < 6) res.samples.push(['stuck', +lx.toFixed(2), +lz.toFixed(2)]); }
        if (top) {   // walk off the top somewhere and make sure that ends clear too
          pl.pos.set(lx, top.y1, lz); pl.vel.set(0, 0); pl._sim.copy(pl.pos); pl.grounded = true; pl.standOn = top;
          const wy = rnd() * Math.PI * 2;
          sim(game, 45, intentFor({ yaw: wy, y: 1 }));
          if (pl.unsafeT > 0 || penetration(W, pl.pos.x, pl.pos.z, pl.r, pl.pos.y, pl.grounded, pl.standOn && pl.standOn !== 'deck' ? pl.standOn : null, true) > 0.02) { res.unsafe++; if (res.samples.length < 6) res.samples.push(['offTop', +pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)]); }
        }
        if (pl.unsafeT > 0.5) res.unsafe++;
      }
      t.note('jumps', res);
      t.eq(res.jumps, n, 'jumps');
      t.eq(res.outside, 0, 'landings outside W.reach');
      t.eq(res.stuck + res.unsafe, 0, 'stuck');
    }],
    ['500 random 10 s walks: no grounded single-step |Δy| > 0.36 m that is not a fall; never stuck or out of the world', (t) => {
      const { game, W, pl } = t, n = (t.opts && t.opts.walks) || 500;
      let rs = 4242;
      const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const R = W.reach, cells = [];
      for (let k = 0; k < R.length; k++) if (R[k]) cells.push(k);
      const res = { walks: 0, steps: 0, bigSteps: 0, worst: 0, falls: 0, unsafe: 0, offWorld: 0, unreached: 0, farthest: 0, farAt: null, jumps: 0, samples: [] };
      for (let tries = 0; res.walks < n && tries < n * 20; tries++) {
        const k = cells[(rnd() * cells.length) | 0], x = (k % 360) - 180 + rnd(), z = ((k / 360) | 0) - 180 + rnd();
        if (!W.walkable(x, z) || W.inArena(x, z, 1) || penetration(W, x, z, pl.r) > 0) continue;
        res.walks++;
        let yaw = rnd() * Math.PI * 2, sx = 0, sy = 1, sprint = rnd() < 0.3, py = null, pg = true;
        put(t, x, z, yaw);
        if (sprint) { sim(game, 1, intentFor({ yaw, y: 1, dash: true, sprint: true })); }
        sim(game, 600, (i) => {
          if (i % 45 === 0) { yaw += (rnd() - 0.5) * 2.4; sx = rnd() < 0.3 ? rnd() * 2 - 1 : 0; sy = rnd() < 0.85 ? 1 : -1; }
          const j = rnd() < 0.01;
          if (j) res.jumps++;
          return intentFor({ yaw, x: sx, y: sy, sprint, jump: j, jumpHeld: j || !pl.grounded, dash: rnd() < 0.004 });
        }, () => {
          res.steps++;
          const y = pl.pos.y;
          if (py != null && pl.grounded && pg) { const dy = Math.abs(y - py); res.worst = Math.max(res.worst, dy); if (dy > 0.36) { res.bigSteps++; if (res.samples.length < 6) res.samples.push(['dy', +pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2), +dy.toFixed(3)]); } }
          if (!pl.grounded && pg && !pl.jumping) res.falls++;   // walked off a top / hurt hop (not a jump)
          if (pl.unsafeT > 0.5) { res.unsafe++; if (res.samples.length < 8 && pl.unsafeT < 0.52) res.samples.push(['unsafe', +pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2), W.walkable(pl.pos.x, pl.pos.z), +penetration(W, pl.pos.x, pl.pos.z, pl.r, pl.pos.y, pl.grounded).toFixed(3), +(pl.pos.y - W.hAt(pl.pos.x, pl.pos.z)).toFixed(2), pl.state]); }
          if (!(Math.abs(pl.pos.x) < 180 && Math.abs(pl.pos.z) < 180) || pl.pos.y < W.hAt(pl.pos.x, pl.pos.z) - 0.6) res.offWorld++;
          if (pl.grounded && !reach2(R, pl.pos.x, pl.pos.z) && !(pl.standOn && pl.standOn !== 'deck')) {
            res.unreached++;
            const d = reachDist(R, pl.pos.x, pl.pos.z);
            if (d > res.farthest) { res.farthest = d; res.farAt = [+pl.pos.x.toFixed(1), +pl.pos.z.toFixed(1)]; }
          }
          py = y; pg = pl.grounded;
        });
      }
      t.note('walks', res);
      t.eq(res.walks, n, 'walks');
      t.eq(res.bigSteps, 0, 'grounded steps > 0.36 m');
      t.eq(res.unsafe, 0, 'steps stuck > 0.5 s');
      t.eq(res.offWorld, 0, 'out of the world / under terrain');
      // the BFS grid misses thin walkable tongues (a shallow bar in a pond, a pinch between two cells), which a walk
      // may follow a few metres; a sequence break would go far beyond that
      t.ok(res.farthest <= 6, 'walks never get more than 6 m from W.reach', { steps: res.unreached, farthest: res.farthest, at: res.farAt });
    }],
    ['200 perpendicular walks into every bridge side: 0 exits through the rails; 0 entries from the islet water', (t) => {
      const { game, W, pl } = t, per = (t.opts && t.opts.per) || 200;
      const res = {};
      for (const b of W.bridges) {
        const r = (res[b.id] = { runs: 0, exits: 0, waders: 0, entries: 0 });
        for (let k = 0; k < per; k++) {
          const tt = 0.03 + (k / (per - 1)) * 0.94, sd = k % 2 ? 1 : -1, how = ['walk', 'dash', 'jump', 'sprint'][k % 4];
          const cx = b.ax + b.dx * b.len * tt, cz = b.az + b.dz * b.len * tt, side = Math.atan2(b.dz * sd, -b.dx * sd);
          const yaw = side + ((k * 7) % 5 - 2) * 0.15;
          put(t, cx, cz, yaw); r.runs++;
          sim(game, 60, (i) => intentFor({ yaw, y: 1, dash: (how === 'dash' && i === 2) || (how === 'sprint' && i === 1), sprint: how === 'sprint', jump: how === 'jump' && i % 30 === 2, jumpHeld: how === 'jump' }));
          // an exit = beside the bridge within its span, outside the rail line (walking off an end onto the path is fine)
          const s = Math.abs(-(pl.pos.x - b.ax) * b.dz + (pl.pos.z - b.az) * b.dx), u = ((pl.pos.x - b.ax) * b.dx + (pl.pos.z - b.az) * b.dz) / b.len;
          if (u > 0 && u < 1 && s > b.w / 2 - 0.08) { r.exits++; if (!r.samples) r.samples = []; if (r.samples.length < 4) r.samples.push([+tt.toFixed(3), how, +u.toFixed(3), +s.toFixed(3)]); }
        }
        if (!(b.id && b.id.startsWith('islet'))) continue;
        for (let k = 0; k < per; k++) {
          const tt = 0.02 + (k / (per - 1)) * 0.96, sd = k % 2 ? 1 : -1, off = b.w / 2 + 0.6 + (k % 3) * 0.5;
          const cx = b.ax + b.dx * b.len * tt + b.dz * sd * off, cz = b.az + b.dz * b.len * tt - b.dx * sd * off;
          if (!W.walkable(cx, cz) || W.hAt(cx, cz) > 0.3 || penetration(W, cx, cz, pl.r, W.hAt(cx, cz)) > 0) continue;
          const yaw = Math.atan2(-b.dz * sd, b.dx * sd) + ((k * 3) % 5 - 2) * 0.2;
          put(t, cx, cz, yaw); r.waders++;
          sim(game, 70, (i) => intentFor({ yaw, y: 1, jump: i % 25 === 10, jumpHeld: i % 25 >= 10 && i % 25 < 20, dash: i === 40 }));
          const d = W.bridgeAt(pl.pos.x, pl.pos.z);
          if (d !== null && pl.pos.y > d - 0.1) r.entries++;
        }
      }
      t.note('bridges', res);
      t.ok(Object.values(res).every((r) => r.exits === 0), 'exits', res);
      t.ok(Object.values(res).every((r) => r.entries === 0), 'entries', res);
      t.ok(Object.values(res).some((r) => r.waders > 50), 'wader runs happened', res);
    }],
    ['the Great Tree (built scale and WP9\'s ×2.2): 150 random 3 s walks / jumps / rolls into its roots: never inside it, never stuck', (t) => {
      const { game, W, G, pl } = t, S = G.scenery.greatTree, model = S && (S.glb ? S.glb.a : S.group), n = (t.opts && t.opts.tree) || 150;
      let rs = 777;
      const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const res = {};
      const runAll = (label) => {
        const c = W.colliders.find((q) => q.kind === 'tree'), T = W.greatTree, r = (res[label] = { runs: 0, inside: 0, worst: 0, unsafe: 0, moved: 0, samples: [] });
        for (let tries = 0; r.runs < n && tries < n * 30; tries++) {
          const a = rnd() * Math.PI * 2, d0 = c.r * 0.3 + rnd() * c.r, x = T.x + Math.sin(a) * d0, z = T.z + Math.cos(a) * d0;
          if (!W.walkable(x, z) || penetration(W, x, z, pl.r + 0.02) > 0 || shapeDist(c, x, z) > 2.5) continue;
          r.runs++;
          let yaw = Math.atan2(T.x - x, T.z - z) + (rnd() - 0.5) * 2.4;
          put(t, x, z, yaw);
          const x0 = pl.pos.x, z0 = pl.pos.z;
          sim(game, 180, (i) => {
            if (i % 45 === 44) yaw += (rnd() - 0.5) * 3;
            return intentFor({ yaw, x: rnd() < 0.2 ? rnd() * 2 - 1 : 0, y: 1, jump: rnd() < 0.02, jumpHeld: rnd() < 0.8, dash: rnd() < 0.01, sprint: rnd() < 0.3 });
          }, () => {
            const g = shapeDist(c, pl.pos.x, pl.pos.z) - pl.r;
            if (g < -0.02) { r.inside++; if (r.samples.length < 4) r.samples.push([+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2), +g.toFixed(3)]); }
            r.worst = Math.min(r.worst, g);
            if (pl.unsafeT > 0.5) r.unsafe++;
          });
          if (Math.hypot(pl.pos.x - x0, pl.pos.z - z0) > 0.5) r.moved++;
        }
        r.worst = +r.worst.toFixed(4);
      };
      runAll('x1');
      const s0 = model.scale.clone();
      try { model.scale.multiplyScalar(2.2); model.updateWorldMatrix(true, true); W.fitTreeColliders(S.footprint, S.height * 2.2); runAll('x2.2'); }
      finally { model.scale.copy(s0); model.updateWorldMatrix(true, true); W.fitTreeColliders(S.footprint, S.height); }
      t.note('tree', res);
      for (const k in res) {
        t.eq(res[k].runs, n, k + ' runs');
        t.eq(res[k].inside, 0, k + ': steps inside the outline by > 2 cm');
        t.eq(res[k].unsafe, 0, k + ': steps flagged stuck > 0.5 s');
      }
    }],
    ['houses: walking in from 36 directions, the body stops within 0.15 m of the walls and never overlaps the mesh > 0.05 m', (t) => {
      const { game, W, pl } = t;
      const geos = { house_a: houseA().geo, house_b: houseB().geo, shop: shopModel().geo };
      const res = [];
      const blds = W.houses.concat(W.shop ? [Object.assign({ type: 'shop' }, W.shop)] : []);
      for (const b of blds) {
        const pts = bandPoints(geos[b.type], b, 0.05, 1.0);
        let worstGap = 0, worstOver = 0, runs = 0;
        for (let k = 0; k < 36; k++) {
          const a = (k / 36) * Math.PI * 2, sx = b.x + Math.sin(a) * 6, sz = b.z + Math.cos(a) * 6;
          if (!W.walkable(sx, sz) || penetration(W, sx, sz, pl.r) > 0) continue;
          const yaw = Math.atan2(b.x - sx, b.z - sz);
          put(t, sx, sz, yaw);
          sim(game, 150, intentFor({ yaw, y: 1 }));
          // only runs that ended against this building (not a fence, pot or lamp first, nor WP9's yard dressing: the
          // laundry line hangs at Pip's ear tips); WP9's shop counter circles are part of the building
          W.nearColliders(pl.pos.x, pl.pos.z, 2, _nb);
          const touching = _nb.filter((c) => c.body !== false && shapeDist(c, pl.pos.x, pl.pos.z) - pl.r < 0.03);
          const own = (c) => (c.building && Math.hypot(c.building.x - b.x, c.building.z - b.z) < 0.1) || (c.kind === 'counter' && Math.hypot(c.x - b.x, c.z - b.z) < 5);
          if (!touching.length || !touching.every(own)) continue;
          runs++;
          // ray-march gap: the nearest mesh point in Pip's body band, horizontally, minus his radius
          // (overlap: the mesh in his body band; gap: also what stops him just above his head, a counter's board)
          let best = Infinity, bestG = Infinity;
          for (let i = 0; i < pts.length; i += 3) { if (pts[i + 1] < pl.pos.y + 0.05 || pts[i + 1] > pl.pos.y + 1.1) continue; const d = Math.hypot(pts[i] - pl.pos.x, pts[i + 2] - pl.pos.z); if (d < bestG) bestG = d; if (pts[i + 1] <= pl.pos.y + 1.0 && d < best) best = d; }
          worstGap = Math.max(worstGap, bestG - pl.r); worstOver = Math.max(worstOver, pl.r - best);
        }
        res.push({ type: b.type, runs, worstGap: +worstGap.toFixed(3), worstOverlap: +worstOver.toFixed(3) });
      }
      t.note('houses', res);
      t.ok(res.every((r) => r.runs >= 12), 'enough clean runs per building', res);
      t.ok(res.every((r) => r.worstGap <= 0.15), 'gap ≤ 0.15 m', res);
      t.ok(res.every((r) => r.worstOverlap <= 0.05), 'overlap ≤ 0.05 m', res);
    }],
    ['FP at tree canopies, 12 trees per kind: standing and at a held jump\'s apex the eye stays out of the crown', (t) => canopyRuns(t, 12)],
    ['FP contact at bushes, boulders, rocks, houses and the well: eye-to-mesh distance ≥ 0.12 m', (t) => {
      const { game, W, D, view, pl } = t;
      const res = {};
      const kinds = [['bush', 6], ['boulder', 6], ['rock', 6], ['well', 1], ['house_a', 3], ['house_b', 2], ['shop', 1]];
      for (const [kind, count] of kinds) {
        const r = (res[kind] = { runs: 0, min: Infinity, skip: { walk: 0, pen: 0, far: 0 } });
        const list = kind.startsWith('house') || kind === 'shop' ? W.houses.concat(W.shop ? [Object.assign({ type: 'shop' }, W.shop)] : []).filter((b) => b.type === kind)
          : W.props.filter((p) => p.type === kind && !p.removed && !p.arena && !W.inArena(p.x, p.z, 8) && W.slopeAt(p.x, p.z) < 0.5 && W.walkable(p.x + 2, p.z));
        for (const o of list.slice(0, count)) {
          const geo = kind === 'house_a' ? houseA().geo : kind === 'house_b' ? houseB().geo : kind === 'shop' ? shopModel().geo : propModel(kind).geo;
          const tris = worldTris(geo, o, kind);
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2, R = (o.r || 3) + 2.5, sx = o.x + Math.sin(a) * R, sz = o.z + Math.cos(a) * R;
            if (!W.walkable(sx, sz)) { r.skip.walk++; continue; }
            if (penetration(W, sx, sz, pl.r) > 0) { r.skip.pen++; continue; }
            const yaw = Math.atan2(o.x - sx, o.z - sz);
            if (game.fight) game.endFight(true);
            D.teleport(sx, sz, yaw, 0); t.frames(2);
            t.move(0, 1); t.frames(60); t.move(0, 0); t.frames(4);
            if (Math.hypot(pl.pos.x - o.x, pl.pos.z - o.z) > R - 0.3) { r.skip.far++; continue; }   // blocked by something else
            for (const pitch of [0, -40 * D2R, 30 * D2R]) {
              D.look(yaw, pitch); t.frames(1);
              r.min = Math.min(r.min, pointTriDist(view.eye, tris));
            }
            r.runs++;
          }
        }
        r.min = +r.min.toFixed(3);
      }
      t.note('eye', res);
      t.ok(Object.values(res).every((r) => r.runs > 0), 'runs', res);
      t.ok(Object.values(res).every((r) => r.min >= 0.12), 'eye-to-mesh ≥ 0.12 m', res);
    }],
  ], { desc: 'WP3 statistics: random jumps / walks, bridge sides, house gaps, FP eye distances (≈ 1–2 min)', heavy: true, prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12, sword: 1 } });
}

const _nb = [];
/** FP eye at tree canopies (wp3 / wp3-heavy): Pip at trunk contact on 4 sides of `per` trees of each kind, a held
 *  jump. Where the crown hangs above the standing eye, the eye (standing and at its highest) must stay ≥ eyeClear
 *  under the mesh straight above and ≥ the near plane (standing: eyeClear) from every face; under a skirt that already
 *  hangs below the standing eye (the foundation's pines until WP9 raises them) a jump must add no height */
function canopyRuns(t, per) {
  const { W, D, view, pl } = t, M = TM.eyeClear;
  const res = {};
  const up = (p, tris) => { const ray = new THREE.Ray(p, new THREE.Vector3(0, 1, 0)), hit = new THREE.Vector3(); let u = Infinity; for (const tr of tris) if (ray.intersectTriangle(tr.a, tr.b, tr.c, false, hit)) u = Math.min(u, hit.y - p.y); return u; };
  for (const kind of ['tree_pine', 'tree_snow', 'tree_round']) {
    const r = (res[kind] = { trees: 0, runs: 0, low: 0, capped: 0, minRay: Infinity, minDist: Infinity, standRay: Infinity, standDist: Infinity, risesInLow: 0, samples: [] });
    const geo = propModel(kind).geo;
    const trees = W.colliders.filter((c) => c.kind === kind && c.main !== false && c.canopy && c.prop && !W.inArena(c.x, c.z, 4) && W.slopeAt(c.x, c.z) < 0.3);
    for (let ti = 0; ti < trees.length && r.trees < per; ti += Math.max(1, Math.floor(trees.length / (per * 1.5)))) {
      const c = trees[ti], tris = worldTris(geo, c.prop, kind);
      let used = false;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.3, d = c.r + pl.r + 0.03, x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if (!W.walkable(x, z) || penetration(W, x, z, pl.r, W.hAt(x, z)) > 0) continue;
        const yaw = a + Math.PI;
        D.release(); D.teleport(x, z, yaw, 0.1); t.frames(3);
        if (Math.hypot(pl.pos.x - x, pl.pos.z - z) > 0.03) continue;
        used = true; r.runs++;
        const stand = view.eye.clone(), low = W.eyeCeiling(stand.x, stand.z) < stand.y;   // a skirt below the standing eye
        let hi = view.eye.clone(), capped = false;
        D.hold('jump');
        for (let f = 0; f < 34; f++) { t.frames(1); if (view.eye.y > hi.y) hi = view.eye.clone(); if (pl.pos.y + 0.88 > W.eyeCeiling(view.eye.x, view.eye.z) + 0.005) capped = true; }
        D.release(); t.frames(30);
        if (capped) r.capped++;
        if (low) { r.low++; if (hi.y > stand.y + 0.01) { r.risesInLow++; if (r.samples.length < 3) r.samples.push({ low: true, x: +x.toFixed(2), z: +z.toFixed(2), rise: +(hi.y - stand.y).toFixed(3) }); } continue; }
        const su = up(stand, tris), sd = pointTriDist(stand, tris), hu = up(hi, tris), hd = pointTriDist(hi, tris);
        r.standRay = Math.min(r.standRay, su); r.standDist = Math.min(r.standDist, sd); r.minRay = Math.min(r.minRay, hu); r.minDist = Math.min(r.minDist, hd);
        if ((hu < M - 0.01 || hd < 0.08 || su < M - 0.01 || sd < M) && r.samples.length < 3) r.samples.push({ x: +x.toFixed(2), z: +z.toFixed(2), su: +su.toFixed(3), sd: +sd.toFixed(3), hu: +hu.toFixed(3), hd: +hd.toFixed(3) });
      }
      if (used) r.trees++;
    }
    for (const k of ['minRay', 'minDist', 'standRay', 'standDist']) r[k] = +r[k].toFixed(3);
  }
  t.note('canopy', res);
  for (const [k, r] of Object.entries(res)) {
    t.ok(r.runs >= Math.min(per * 1.5, 12), k + ': runs', r);
    t.eq(r.risesInLow, 0, k + ': under a skirt that hangs below the eye (foundation pines) a jump adds no height');
    t.ok(r.standRay >= M - 0.01 && r.standDist >= M, k + ': standing, the eye is ≥ eyeClear from the crown', r);
    t.ok(r.minRay >= M - 0.01 && r.minDist >= 0.08, k + ': the apex eye stays under the crown (≥ eyeClear below it, ≥ the near plane from any face)', r);
  }
  t.ok(res.tree_round.capped > 0 || res.tree_pine.capped > 0, 'some jumps reach a ceiling', res);
}
/** distance (m, cells) from (x, z) to the nearest reached cell (searched to 12) */
function reachDist(R, x, z) {
  const ci = Math.floor(x + 180), cj = Math.floor(z + 180);
  let best = 99;
  for (let dj = -12; dj <= 12; dj++) for (let di = -12; di <= 12; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < 360 && j < 360 && R[j * 360 + i]) best = Math.min(best, Math.hypot(di, dj)); }
  return +best.toFixed(2);
}
/** is (x, z) joined to a reached cell of W.reach by a walk? 0.1 m flood fill (4-connected, within 6 m) over spots
 *  that are walkable and where a body of radius r fits */
function walkJoined(W, R, x, z, r) {
  const h = 0.1, n = 121, c = 60, seen = new Uint8Array(n * n), q = [c * n + c];
  seen[c * n + c] = 1;
  while (q.length) {
    const k = q.shift(), i = (k % n) - c, j = Math.floor(k / n) - c, px = x + i * h, pz = z + j * h;
    const ci = Math.floor(px + 180), cj = Math.floor(pz + 180);
    if (ci >= 0 && cj >= 0 && ci < 360 && cj < 360 && R[cj * 360 + ci]) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di + c, jj = j + dj + c, kk = jj * n + ii;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n || seen[kk]) continue;
      seen[kk] = 1;
      const qx = x + (ii - c) * h, qz = z + (jj - c) * h;
      if (W.walkable(qx, qz) && penetration(W, qx, qz, r, W.hAt(qx, qz)) === 0) q.push(kk);
    }
  }
  return false;
}
/** a reached cell within ±2 cells of (x, z) */
function reach2(R, x, z) {
  const ci = Math.floor(x + 180), cj = Math.floor(z + 180);
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < 360 && j < 360 && R[j * 360 + i]) return true; }
  return false;
}
/** the Great Tree model's triangles sampled ≤ 0.1 m apart, kept in the fit's band (TREE_FIT.band above its base): [x, z, …] */
function treeBand(model, T) {
  const out = [], base = T.y - 0.1, [B0, B1] = TREE_FIT.band, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), v = new THREE.Vector3();
  model.updateWorldMatrix(true, true);
  model.traverse((m) => {
    if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
    const pos = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count / 3 : pos.count / 3;
    for (let f = 0; f < n; f++) {
      a.fromBufferAttribute(pos, idx ? idx.getX(f * 3) : f * 3).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, idx ? idx.getX(f * 3 + 1) : f * 3 + 1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, idx ? idx.getX(f * 3 + 2) : f * 3 + 2).applyMatrix4(m.matrixWorld);
      if (Math.max(a.y, b.y, c.y) - base < B0 || Math.min(a.y, b.y, c.y) - base > B1) continue;
      const L = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)), k = Math.min(40, Math.max(1, Math.ceil(L / 0.1)));
      for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
        v.copy(a).multiplyScalar(1 - (i + j) / k).addScaledVector(b, i / k).addScaledVector(c, j / k);
        const h = v.y - base;
        if (h >= B0 && h <= B1) out.push(v.x, v.z);
      }
    }
  });
  return out;
}
/** world-space points sampled on a building's triangles within a body band above its base (x, y, z flat) */
function bandPoints(geo, b, lo, hi) {
  const out = [], pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count / 3 : pos.count / 3;
  const cs = Math.cos(b.rot), sn = Math.sin(b.rot), y0 = b.y - 0.05;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    A.fromBufferAttribute(pos, idx ? idx.getX(f * 3) : f * 3); B.fromBufferAttribute(pos, idx ? idx.getX(f * 3 + 1) : f * 3 + 1); C.fromBufferAttribute(pos, idx ? idx.getX(f * 3 + 2) : f * 3 + 2);
    if (Math.max(A.y, B.y, C.y) < lo - 0.05 || Math.min(A.y, B.y, C.y) > hi + 1.0) continue;
    const L = Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)), k = Math.min(30, Math.max(2, Math.ceil(L / 0.04)));
    for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
      P.copy(A).multiplyScalar(1 - (i + j) / k).addScaledVector(B, i / k).addScaledVector(C, j / k);
      out.push(b.x + P.x * cs + P.z * sn, y0 + P.y, b.z - P.x * sn + P.z * cs);
    }
  }
  return out;
}
/** a prop / building mesh's triangles in world space (prop: scatter.composeFor's transform) */
function worldTris(geo, o, kind) {
  const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count / 3 : pos.count / 3, out = [];
  const building = kind === 'house_a' || kind === 'house_b' || kind === 'shop';
  const s = building ? 1 : o.s || 1, rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot);
  const sink = building ? 0.05 : kind.startsWith('tree') ? 0.08 : kind === 'boulder' || kind === 'rock' ? 0.12 : 0;   // scatter.composeFor (unscaled)
  const y0 = o.y - sink, v = new THREE.Vector3();
  const tf = (i) => { v.fromBufferAttribute(pos, i); return new THREE.Vector3(o.x + (v.x * cs + v.z * sn) * s, y0 + v.y * s, o.z + (-v.x * sn + v.z * cs) * s); };
  for (let f = 0; f < n; f++) out.push(new THREE.Triangle(tf(idx ? idx.getX(f * 3) : f * 3), tf(idx ? idx.getX(f * 3 + 1) : f * 3 + 1), tf(idx ? idx.getX(f * 3 + 2) : f * 3 + 2)));
  return out;
}
const _cp = new THREE.Vector3();
function pointTriDist(p, tris) {
  let best = Infinity;
  for (const tr of tris) { tr.closestPointToPoint(p, _cp); const d = _cp.distanceTo(p); if (d < best) best = d; }
  return best;
}
