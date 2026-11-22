// WP5 in-page suites (registered by js/debug/tests.js; only loaded with ?debug=1): actors, telegraphs, positional audio.
//   wp5        the acceptance checks of arch §15.2 WP5 + the WP-BRIEFS bullets (≈ 10 s)
//   wp5-heavy  the long runs: 60 s 6-enemy token script, the telegraph-lead matrix (every type in view + behind),
//              the offline level table of every sound
// Pip's damage is observed through a playerHurt stub that records every call and returns false (no knockback, no
// i-frames): "frozen player" runs where each attack keeps trying to land.
import { actors as TA, hud as TH } from '../../tune.js';
import { STEP_NAME } from '../../audio-bus.js';
import { yawOf, angDiff, rightXZ, fwdXZ } from '../../util.js';
import { Boss } from '../../bosses.js';
import { offView, hintReset } from '../../entities.js';
import { CFG, BOSSES, REMATCH } from '../../data.js';

const D2R = Math.PI / 180;
const TYPES = ['slime', 'mushroom', 'bat', 'bee', 'crab', 'snowpuff'];

/** record events of these types (the 64-entry log is too short for long runs) */
function rec(game, types) {
  const got = [];
  const offs = types.map((ty) => game.events.on(ty, (p) => got.push({ type: ty, t: game.clock.simTime, p })));
  return { got, off() { offs.forEach((f) => f()); } };
}
/** every playerHurt call → { t, dmg, source }, never applied */
function stubHurt(game) {
  const calls = [];
  game.playerHurt = function (dmg, fx, fz, knock, source = 'enemy') { calls.push({ t: game.clock.simTime, dmg, source }); return false; };
  return { calls, restore() { delete game.playerHurt; } };
}
function noSpawns(game) { game.spawnT = 1e9; }
/** start a boss fight and skip its intro; the boss at the arena centre, Pip `dist` m out on the entrance side.
 *  `rematch`: a guardian rematch (data.js REMATCH), woken the way Use wakes it (game.startFight; walking in never does) */
function fight(t, id, dist = 6, rematch = false) {
  const { game, D } = t;
  // an earlier test may have beaten this boss (smoke's 'place' gives its seed): bring it back for this run (the runner
  // restores the save afterwards)
  if (game.S.bosses[id] || !game.bosses[id]) {
    game.S.bosses[id] = false; game.S.seeds[id] = 0;
    for (const p of game.pickups) if (p.kind === 'seed' && p.seedId === id) p.remove();
    if (!game.bosses[id]) game.bosses[id] = new Boss(id, game.world.arenas[id]);
  }
  if (rematch) { game.bosses[id].remove(); game.bosses[id] = new Boss(id, game.world.arenas[id], { rematch: true }); }
  D.cutscene('bossIntro', id);
  if (rematch) game.startFight(id);
  t.frames(160);
  const b = game.fight.boss, a = b.arena;
  b.clearTells(); b.lift = 0; b.set('walk', 0); b.cool = 99; b.pos.set(a.x, a.h, a.z); b.prev.copy(b.pos);
  const px = a.x + Math.sin(a.entAng) * dist, pz = a.z + Math.cos(a.entAng) * dist;
  D.teleport(px, pz, yawOf(a.x - px, a.z - pz), 0);
  noSpawns(game); t.frames(2);
  return b;
}
function leadCheck(t, e, hits, tels) {
  const mine = tels.filter((q) => q.p.source === e);
  let worst = Infinity;
  for (const h of hits) {
    const before = mine.filter((q) => q.t <= h.t + 1e-9);
    const last = before[before.length - 1];
    worst = Math.min(worst, last ? h.t - last.t : -1);
  }
  return { worst, tel: mine.length, hits: hits.length };
}
/** one enemy type, Pip standing still: every damage call must come ≥ 0.55 s after this enemy's latest TELEGRAPH */
function leadRun(t, type, rel, secs) {
  const { game, D } = t;
  noSpawns(game);
  const R = rec(game, ['telegraph']), H = stubHurt(game);
  try {
    D.spawn(type, type === 'snowpuff' ? 6 : 3.5, rel, { face: true });
    const e = D.last;
    t.frames(Math.round(secs * 60));
    return { ...leadCheck(t, e, H.calls, R.got), e };
  } finally { R.off(); H.restore(); }
}

/** photosensitivity (WCAG 2.3.1): flashes per second in a per-frame (60 fps) sample of a flash value: each fall through
 *  the midpoint of its range is one flash; a value that holds steady has none */
function flashRate(vals) {
  const lo = Math.min(...vals), hi = Math.max(...vals), mid = (lo + hi) / 2;
  if (hi - lo < 1e-3) return 0;
  let n = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i - 1] > mid && vals[i] <= mid) n++;
  return n / (vals.length / 60);
}

export default function register(suite) {
  suite('wp5', [
    ['C5: every enemy and boss has numeric hp / maxHp and a display name', (t) => {
      const { game, D } = t;
      for (const ty of TYPES) {
        D.spawn(ty, 5, 0); const e = D.last;
        t.ok(Number.isFinite(e.hp) && Number.isFinite(e.maxHp) && e.hp === e.maxHp && typeof e.name === 'string' && e.name.length > 1, 'enemy ' + ty, { hp: e.hp, maxHp: e.maxHp, name: e.name });
      }
      for (const id in game.bosses) { const b = game.bosses[id]; t.ok(Number.isFinite(b.hp) && Number.isFinite(b.maxHp) && typeof b.name === 'string', 'boss ' + id); }
    }],
    ['rematch guardians: HP × 1.25 (60 / 60 / 63) and enraged from 75 %; first fights keep 48 / 48 / 50 and enrage at 50 %', (t) => {
      const { game } = t;
      const want = { woods: 60, shores: 60, peaks: 63 }, first = { woods: 48, shores: 48, peaks: 50 };
      for (const id of Object.keys(BOSSES)) {
        const a = game.world.arenas[id], r = new Boss(id, a, { rematch: true }), f = new Boss(id, a);
        try {
          t.eq(r.maxHp, want[id], id + ' rematch HP'); t.eq(r.hp, want[id], id + ' rematch starts full');
          t.ok(r.rematch && r.state === 'sleep', id + ' rematch guardian naps');
          r.hp = Math.floor(r.maxHp * REMATCH.enrage) + 1; t.ok(!r.enraged, id + ' rematch calm above 75 %', { hp: r.hp });
          r.hp = Math.floor(r.maxHp * REMATCH.enrage); t.ok(r.enraged, id + ' rematch enraged at 75 %', { hp: r.hp });
          t.eq(f.maxHp, first[id], id + ' first-fight HP'); t.ok(!f.rematch, id + ' first fight is not a rematch');
          f.hp = f.maxHp / 2 + 1; t.ok(!f.enraged, id + ' first fight calm above 50 %');
          f.hp = f.maxHp / 2; t.ok(f.enraged, id + ' first fight enraged at 50 %');
        } finally { r.remove(); f.remove(); }
      }
    }],
    ['wind-ups per arch WP5; EV.TELEGRAPH precedes every damaging attack by ≥ 0.55 s (each type, in view, 6 s)', (t) => {
      const { game, D } = t;
      const want = { slime: 0.40, mushroom: 0.55, bat: 0.60, bee: 0.70, crab: 0.65, snowpuff: 0.60 }, rows = {};
      for (const ty of TYPES) {
        t.eq(TA.windup[ty], want[ty], 'TUNE wind-up ' + ty);
        t.clearEnemies(); D.teleport(...game.player.pos.toArray().filter((_, i) => i !== 1), game.view.yaw, 0);
        const r = leadRun(t, ty, 0, 6);
        rows[ty] = { worst: +r.worst.toFixed(3), tel: r.tel, hits: r.hits, wind: r.e.windDur };
        t.ok(r.hits > 0, ty + ': the attack connects (else the check proves nothing)', rows[ty]);
        t.ok(r.worst >= 0.55 - 1e-6, ty + ': telegraph lead ≥ 0.55 s', rows[ty]);
      }
      t.note('lead', rows);
    }],
    ['C3: an enemy telegraphs only within its reach (no far false alarms); from reach − 0.15 m the attack lands', (t) => {
      const { game, D } = t;
      noSpawns(game);
      const rows = {};
      // AI runs: far starts ahead and behind; every TELEGRAPH (announce or wind-up) must start inside TA.reach[type]
      for (const ty of TYPES) for (const [dist, rel] of [[11, 0], [9, 180]]) {
        t.clearEnemies(); D.teleport(game.player.pos.x, game.player.pos.z, game.view.yaw, 0);
        const R = rec(game, ['telegraph']), H = stubHurt(game);
        let e;
        try { D.spawn(ty, dist, rel, { face: true }); e = D.last; t.frames(600); } finally { R.off(); H.restore(); }
        const ds = R.got.filter((q) => q.p.source === e).map((q) => Math.hypot(q.p.source.pos.x - game.player.pos.x, q.p.source.pos.z - game.player.pos.z));
        const far = ds.length ? Math.max(...ds) : 0;
        rows[ty + '@' + dist + '/' + rel] = { tel: ds.length, far: +far.toFixed(2), reach: TA.reach[ty] };
        t.ok(far <= TA.reach[ty] + 0.05, ty + ' at ' + dist + ' m @' + rel + '°: no telegraph beyond its reach', rows[ty + '@' + dist + '/' + rel]);
      }
      t.ok(rows['slime@11/0'].tel > 0 && rows['slime@9/180'].tel > 0, 'a far slime closes in and then attacks', rows);
      // the reach is honest: forced from reach − 0.15 m in view, each melee attack lands on a standing Pip
      for (const ty of ['slime', 'bat', 'bee', 'crab']) {
        t.clearEnemies(); D.teleport(game.player.pos.x, game.player.pos.z, game.view.yaw, 0);
        const H = stubHurt(game);
        try {
          D.spawn(ty, TA.reach[ty] - 0.15, 0, { face: true }); const e = D.last; e.spawnT = 1; t.frames(1);
          D.actors.attack(e); t.frames(150);
          rows['land ' + ty] = H.calls.length;
          t.ok(H.calls.length > 0, ty + ' attack from reach − 0.15 m lands', { calls: H.calls.length, d: e.dist(), state: e.state });
        } finally { H.restore(); }
      }
      t.note('reach', rows);
    }],
    ['off-view = off the screen: the first bearing past the screen edge announces, the last one on it does not', (t) => {
      const { game, D, view, pl } = t;
      D.look(game.view.yaw, 0); t.frames(2);
      const half = view.fovH / 2, rows = [];
      for (const deg of [half - 6, half + 3, half + 8, 59, 75, 120, 180]) {
        const a = view.yaw + deg * Math.PI / 180, x = pl.pos.x + Math.sin(a) * 5, z = pl.pos.z + Math.cos(a) * 5, y = view.eye.y;
        const s = view.worldToScreen({ x, y, z }), on = !s.behind && Math.abs(s.ndcX) <= TA.offEdge;
        rows.push({ deg: +deg.toFixed(1), on, off: offView(x, z, y) });
      }
      t.note('rows', rows);
      t.ok(rows.every((r) => r.off === !r.on), 'offView matches the screen at every bearing', rows);
      t.ok(!rows[0].off && rows[1].off && rows[2].off, 'half-FOV − 6° in view, + 3° / + 8° announced (FOV ' + view.fovH.toFixed(1) + '°)', rows);
    }],
    ['off-view: announce ≥ 0.7 s before the wind-up, which is +0.25 s; the bat waits to swoop from the view', (t) => {
      const { game, D } = t;
      noSpawns(game);
      const R = rec(game, ['telegraph']);
      try {
        D.spawn('crab', 4, 180, { face: true }); const e = D.last;
        e.noticed = true; e.noticeT = 0; e.cool = 0; e.st = 99;
        t.frames(1);
        t.eq(e.state, 'announce', 'behind → announce');
        const a = R.got.find((q) => q.p.source === e && q.p.announce);
        t.ok(a && a.p.t >= TA.announce + TA.windup.crab + TA.announceAdd - 1e-6, 'announce TELEGRAPH t', a && a.p.t);
        t.frames(Math.round(TA.announce * 60) + 1);
        t.eq(e.state, 'windup', 'then the wind-up');
        t.near(e.windDur, TA.windup.crab + TA.announceAdd, 1e-9, 'wind-up +0.25 s');
        const w = R.got.filter((q) => q.p.source === e && !q.p.announce);
        t.ok(w.length === 1 && w[0].t - a.t >= TA.announce - 1e-6, 'announce ≥ 0.7 s before the wind-up', w.map((q) => q.t - a.t));
      } finally { R.off(); }
      t.clearEnemies();
      D.spawn('bat', 4, 150, { face: true }); const b = D.last;
      b.noticed = true; b.noticeT = 0; b.cool = 0;
      t.frames(20);
      t.ok(b.state === 'idle' && b.waitT > 0, 'an off-view bat keeps orbiting first', { state: b.state, waitT: b.waitT });
    }],
    ['attack tokens: 6 enemies, 20 s → never more than 2 winding up or attacking', (t) => {
      const { game, D } = t;
      noSpawns(game);
      const H = stubHurt(game);
      let max = 0;
      const who = new Set();
      try {
        [['slime', 3, 0], ['slime', 4, 60], ['bee', 4, -60], ['bee', 5, 150], ['crab', 4.5, -150], ['mushroom', 6, 30]].forEach(([ty, d, rel]) => D.spawn(ty, d, rel, { face: true }));
        for (let i = 0; i < 1200; i++) {
          t.frames(1);
          const n = game.enemies.filter((e) => e.alive && e.attacking);
          n.forEach((e) => who.add(e));
          max = Math.max(max, n.length);
        }
      } finally { H.restore(); }
      t.note('maxAttacking', max); t.note('attackers', who.size);
      t.ok(max <= TA.tokens, 'max attacking ' + max);
      t.ok(who.size >= 4, 'tokens rotate between enemies (' + who.size + ' attacked)');
    }],
    ['contact needs a vertical overlap and an attack: a hovering bee bumps, a diving one hurts; a high bat misses', (t) => {
      const { game, D, pl } = t;
      noSpawns(game);
      const H = stubHurt(game);
      try {
        D.spawn('bee', 0.4, 0, { face: true, alt: 0.6 }); const e = D.last; e.spawnT = 1;
        e.state = 'idle'; e.contact(pl, e.dist());
        t.eq(H.calls.length, 0, 'hovering bee: no damage');
        e.state = 'dive'; e.contact(pl, e.dist());
        t.eq(H.calls.length, 1, 'diving bee: damage');
        t.clearEnemies();
        D.spawn('bat', 0.4, 0, { face: true, alt: 2.1 }); const b = D.last; b.spawnT = 1;
        b.state = 'swoop'; b.contact(pl, b.dist());
        t.eq(H.calls.length, 1, 'a bat 2.1 m up (no vertical overlap): no damage');
        b.altCur = 0.55; b.contact(pl, b.dist());
        t.eq(H.calls.length, 2, 'a swooping bat at 0.55 m: damage');
      } finally { H.restore(); }
    }],
    ['C16: emerge(kind) runs TUNE.actors.emerge s, harmless and unhittable early; spawn → the type\'s kind', (t) => {
      const { game, D, pl } = t;
      noSpawns(game);
      const H = stubHurt(game), was = TA.passiveContact;
      TA.passiveContact = true;
      try {
        D.spawn('slime', 0.3, 0, { face: true }); const e = D.last;
        e.emerge('spawn');
        t.eq(e.emergeKind, 'ground', "'spawn' → ENEMY.slime.emerge");
        t.eq(e.hit(1, pl.pos.x, pl.pos.z), null, 'not hittable in the first half');
        t.frames(Math.round(TA.emerge * 60) - 2);
        t.ok(e.emerging && H.calls.length === 0, 'no contact damage while emerging', { emerging: e.emerging, calls: H.calls.length });
        t.frames(4);
        t.ok(!e.emerging && H.calls.length > 0, 'afterwards it is a normal enemy (passive contact on for the control)', H.calls.length);
        for (const k of ['sky', 'water', 'bush']) { D.spawn('bat', 6, 0); D.last.emerge(k); t.eq(D.last.emergeKind, k, 'kind ' + k); }
      } finally { TA.passiveContact = was; H.restore(); }
    }],
    ['projectiles cast blob shadows; a snowball shows a shrinking landing reticle, removed when it lands', (t) => {
      const { game, pl } = t;
      noSpawns(game);
      const p0 = pl.pos, x = p0.x + 4, z = p0.z, y = game.world.ground(x, z) + 1.5;
      game.spawnProjectile('snowball', x, y, z, yawOf(p0.x - x, p0.z - z), 6, { vy: 2, grav: 9, target: { x: p0.x, y: p0.y, z: p0.z, T: 0.66 } });
      const p = game.projectiles[game.projectiles.length - 1];
      t.frames(3);
      const o = p.blob({});
      t.ok(o && o.r > 0.1 && Math.abs(o.y - Math.max(game.world.ground(o.x, o.z), -0.25)) < 1e-6, 'blob on the ground under it', o);
      t.ok(p.reticle && p.reticle.active, 'reticle on');
      const r0 = p.reticle.m.material.uniforms.uR.value;
      t.frames(20);
      t.ok(!p.alive || p.reticle.m.material.uniforms.uR.value < r0, 'it shrinks', [r0, p.reticle.m.material.uniforms.uR.value]);
      t.frames(80);
      t.ok(!p.alive && !p.reticle.active, 'gone with the ball');
      for (const k of ['spore', 'bubble']) { game.spawnProjectile(k, x, y, z, 0, 1); t.ok(!!game.projectiles[game.projectiles.length - 1].blob({}), k + ' blob'); }
    }],
    ['shockwave: the light wall always covers the hit band; a jump (alt > 0.30) clears it (0 hurt calls)', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'woods', 6);
      D.freezeAI(true);
      const H = stubHurt(game);
      let bad = null, frames = 0, jumped = 0, ground = 0;
      try {
        // jump: Pip's feet held 0.5 m up (C2 player.alt, simulated: WP3 provides the getter)
        Object.defineProperty(pl, 'alt', { configurable: true, get: () => 0.5 });
        const r = D.actors.ring(6.5);
        for (let i = 0; i < 140 && r.active; i++) {
          t.frames(1); frames++;
          if (!r.active) break;                       // past the arena wall: removed (the fight skips it too)
          const u = r.m.material.uniforms, lo = u.uR.value - u.uW.value, hi = u.uR.value + u.uW.value;
          if (lo > r.r - r.width + 1e-6 || hi < r.r + r.width - 1e-6) { bad = { lo, hi, r: r.r, w: r.width }; break; }
        }
        jumped = H.calls.filter((c) => c.source === 'ring').length;
        delete pl.alt;
        D.actors.ring(6.5);
        t.frames(120);
        ground = H.calls.filter((c) => c.source === 'ring').length;
      } finally { delete pl.alt; H.restore(); }
      t.ok(!bad && frames > 20, 'visual band ⊇ hit band every frame', bad);
      t.eq(jumped, 0, 'ring hurt calls while airborne');
      t.ok(ground > 0, 'control: the same ring on the ground hits', ground);
      t.eq(b.id, 'woods', 'woods fight');
    }],
    ['Pinch: the charge stripe is exactly his contact width; 1.9 m off the line is hit, 2.15 m is not', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'shores', 7);
      const H = stubHurt(game), res = [];
      try {
        for (const off of [1.9, 2.15]) {
          b.set('walk', 0); b.pos.set(b.arena.x, b.arena.h, b.arena.z); b.prev.copy(b.pos);
          D.actors.boss('charge'); t.frames(1);
          t.ok(b.state === 'chargeWind' && b.tele, 'charge wind-up with a stripe');
          t.near(b.tele.width, 2 * (b.r + pl.r + TA.stripePad), 1e-9, 'stripe width = 2 × contact radius');
          t.near(b.tele.m.material.uniforms.uWidth.value, b.tele.width, 1e-9, 'drawn width');
          t.frames(Math.ceil((b.windDur - TA.stripeLock) * 60) + 2);   // past the lock: the line is fixed
          const f = fwdXZ(b.cd), r = rightXZ(b.cd), n = H.calls.length;
          D.teleport(b.pos.x + f.x * 4.5 + r.x * off, b.pos.z + f.z * 4.5 + r.z * off, b.cd + Math.PI, 0);
          t.frames(110);
          res.push({ off, hits: H.calls.filter((c, i) => i >= n && c.source === 'boss').length });
        }
      } finally { H.restore(); }
      t.note('stripe', res);
      t.ok(res[0].hits > 0, '1.9 m off the charge line: hit', res);
      t.eq(res[1].hits, 0, '2.15 m off the charge line: missed');
    }],
    ['Frostbun: the full 2.9 m disc + sky pillar from the crouch; the landing hurts inside the disc only', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'peaks', 5);
      const R = rec(game, ['telegraph']), H = stubHurt(game), res = [];
      try {
        for (const off of [2.4, 3.3]) {
          b.set('walk', 0); b.pos.set(b.arena.x, b.arena.h, b.arena.z); b.prev.copy(b.pos);
          D.actors.boss('leap'); t.frames(1);
          t.ok(b.state === 'crouch' && b.shadow && b.shadow.pillar, 'disc + pillar from the crouch');
          t.near(b.shadow.m.scale.x, TA.frostDisc, 1e-9, 'disc radius');
          t.ok(b.shadow.rim && Math.abs(b.shadow.rim.material.uniforms.uR.value + b.shadow.rim.material.uniforms.uW.value - TA.frostDisc) < 1e-6 && b.shadow.rim.material.uniforms.uH.value === TA.zoneWall, 'a light wall on the disc rim');
          const tel = R.got.filter((q) => q.p.source === b && q.p.kind === 'leap').pop();
          t.ok(tel && tel.p.t >= 1.0, 'leap TELEGRAPH lead', tel && tel.p.t);
          t.frames(Math.round((0.45 + 1.15 * 0.35) * 60));            // past the tracking: the target is locked
          const n = H.calls.length, a = Math.random() * Math.PI * 2;
          D.teleport(b.to.x + Math.sin(a) * off, b.to.z + Math.cos(a) * off, a + Math.PI, 0);
          t.frames(70);
          res.push({ off, hits: H.calls.filter((c, i) => i >= n && c.source === 'boss').length, state: b.state });
        }
      } finally { R.off(); H.restore(); }
      t.note('landing', res);
      t.ok(res[0].hits > 0, 'inside the disc (2.4 m): hit', res);
      t.eq(res[1].hits, 0, 'outside the disc (3.3 m): no hit');
    }],
    ['passive boss contact shoves Pip out to its room (no damage); enraged echo ring 0.6 s after the stomp', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'woods', 1.7);
      const H = stubHurt(game), R = rec(game, ['shockwave']);
      let d1 = 0;
      try {
        b.cool = 99;
        t.frames(30);
        d1 = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z);
        t.eq(H.calls.length, 0, 'no damage from touching');
        t.ok(d1 > b.room - 0.1, 'pushed out to the room', { d1, room: b.room });
        b.hp = Math.floor(b.maxHp / 2) - 1;
        D.teleport(b.pos.x + 6, b.pos.z, 0, 0);
        D.actors.boss('stomp');
        t.frames(150);
        const ts = R.got.map((q) => q.t);
        t.ok(ts.length >= 2 && Math.abs(ts[1] - ts[0] - 0.6) < 0.03, 'echo 0.6 s after the stomp ring', ts.map((x) => +(x - ts[0]).toFixed(3)));
      } finally { H.restore(); R.off(); }
    }],
    ['Pinch snap: the stripe is the whole hit area (just inside: hurt, just outside: not), locked before the snap', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'shores', 7);
      const H = stubHurt(game), res = [];
      try {
        // [along, side] from Pinch's centre in the locked snap frame; along in m or 'end ± x'
        for (const [lab, al, sd, want] of [['end − 0.15', -0.15, 0, 1], ['end + 0.2', 0.2, 0, 0], ['side in', 2.6, TA.snap[1] - 0.12, 1], ['side out', 2.6, TA.snap[1] + 0.15, 0], ['old circle', 4.8, 0, 1]]) {
          b.clearTells(); b.set('walk', 0); b.pos.set(b.arena.x, b.arena.h, b.arena.z); b.prev.copy(b.pos); b.vel.set(0, 0);
          D.actors.boss('snap'); t.frames(1);
          t.ok(b.state === 'snapWind' && b.tele, 'snap wind-up with a stripe');
          t.frames(Math.ceil((b.windDur - TA.snapLock) * 60) + 2);
          const tele = b.tele, f = fwdXZ(b.facing), r = rightXZ(b.facing), len = tele.len;
          t.near(len, b.snapLen(b.facing), 1e-9, 'stripe length = snap reach');
          t.near(tele.m.material.uniforms.uWidth.value, 2 * TA.snap[1], 1e-9, 'stripe width = 2 × hit half-width');
          const along = lab.startsWith('end') ? len + al : al, n = H.calls.length;
          D.teleport(b.pos.x + f.x * along + r.x * sd, b.pos.z + f.z * along + r.z * sd, b.facing + Math.PI, 0);
          for (let i = 0; i < 90 && b.state !== 'recover'; i++) t.frames(1);
          const hits = H.calls.filter((c, i) => i >= n && c.source === 'boss').length;
          res.push({ lab, along: +along.toFixed(2), side: sd, len: +len.toFixed(2), hits });
          t.ok(want ? hits > 0 : hits === 0, 'snap ' + lab + (want ? ': hurt' : ': safe'), res[res.length - 1]);
        }
      } finally { H.restore(); }
      t.note('snap', res);
    }],
    ['Frostbun slide: the arena wall ends it (bonk + opening, no bounce); the stripe ends where the slide ends', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'peaks', 6);
      const H = stubHurt(game), res = {};
      try {
        // toward the wall: Pip 5 m out from the centre, Frostbun at the centre
        D.actors.boss('slide'); t.frames(1);
        t.ok(b.state === 'slideWind' && b.tele, 'slide wind-up with a stripe');
        t.frames(Math.ceil((b.windDur - TA.stripeLock) * 60) + 2);
        const cd = b.cd, len = b.tele.len, run = b.runTo(cd), x0 = b.pos.x, z0 = b.pos.z;
        t.near(len, Math.min(run, b.rushTo(cd, TA.slide[0], TA.slide[1])) + b.touchR, 1e-9, 'stripe = path + touchR');
        D.teleport(b.arena.x - Math.sin(cd) * 6, b.arena.z - Math.cos(cd) * 6, null, 0);   // out of the way, behind him
        for (let i = 0; i < 120 && b.state !== 'recover'; i++) t.frames(1);
        const travel = Math.hypot(b.pos.x - x0, b.pos.z - z0);
        res.wall = { state: b.state, opening: b.opening, travel: +travel.toFixed(2), run: +run.toFixed(2), cdAfter: b.cd === cd };
        t.ok(b.state === 'recover' && b.opening && b.vel.lengthSq() === 0 && b.cd === cd && travel <= run + 1e-6, 'stopped at the wall, an opening, no bounce', res.wall);
        // across the arena: a slide that ends before the wall; just past the stripe's end is safe, just inside is hit
        for (const [lab, dl, want] of [['end − 0.3', -0.3, 1], ['end + 0.2', 0.2, 0]]) {
          const ang = b.arena.entAng;
          b.clearTells(); b.set('walk', 0); b.vel.set(0, 0); b.opening = false;
          b.pos.set(b.arena.x - Math.sin(ang) * 8, b.arena.h, b.arena.z - Math.cos(ang) * 8); b.prev.copy(b.pos);
          D.teleport(b.arena.x + Math.sin(ang) * 6, b.arena.z + Math.cos(ang) * 6, ang + Math.PI, 0);
          D.actors.boss('slide'); t.frames(1);
          t.frames(Math.ceil((b.windDur - TA.stripeLock) * 60) + 2);
          const c = b.cd, L = b.tele.len, run = b.runTo(c), n = H.calls.length;
          D.teleport(b.pos.x + Math.sin(c) * (L + dl), b.pos.z + Math.cos(c) * (L + dl), c + Math.PI, 0);
          for (let i = 0; i < 120 && b.state !== 'recover'; i++) t.frames(1);
          res[lab] = { L: +L.toFixed(2), run: +run.toFixed(2), hits: H.calls.filter((q, i) => i >= n && q.source === 'boss').length };
          t.ok(run > L - b.touchR + 0.5 && (want ? res[lab].hits > 0 : res[lab].hits === 0), 'slide ' + lab + (want ? ': hurt' : ': safe') + ' (ends before the wall)', res[lab]);
        }
      } finally { H.restore(); }
      t.note('slide', res);
    }],
    ['FP melee: holding forward into a boss parks Pip at its room, inside sword reach (the swing lands); the stomp glows at its feet', (t) => {
      const { game, D, pl } = t;
      const rows = {};
      for (const id of ['woods', 'shores', 'peaks']) {
        const b = fight(t, id, 4.5);
        t.ok(TA.room[id] <= b.r + CFG.reachWood - 0.15, id + ': room within wooden-sword reach', { room: TA.room[id], reach: b.r + CFG.reachWood });
        const H = stubHurt(game);
        try {
          if (id !== 'shores') {   // a walking boss stops just outside its room (Pinch keeps his 6 m)
            b.cool = 99; t.frames(180);
            const dw = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z);
            t.ok(dw > b.room + TA.roomWalk - 0.1 && dw < b.room + TA.roomWalk + 0.3, id + ': walks up to its room + roomWalk', { dw, room: b.room });
          }
          b.set('recover', 99); b.vel.set(0, 0);   // standing still (no attack), contact rules live
          for (let i = 0; i < 150; i++) { D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); D.move(0, 1); t.frames(1); }
          D.move(0, 0); t.frames(2);
          const d = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z), hp0 = b.hp;
          D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); t.press('attack'); t.frames(30);
          rows[id] = { boss: b.id, fight: game.fight && game.fight.id, d: +d.toFixed(2), room: b.room, hurt: H.calls.length, hit: hp0 - b.hp };
          t.ok(d > b.room - 0.15 && d < b.room + 0.4, id + ': parked at its room', rows[id]);
          t.ok(b.hp < hp0, id + ': a swing from there lands', rows[id]);
          t.eq(H.calls.length, 0, id + ': no damage from pushing into it');
        } finally { H.restore(); D.move(0, 0); }
        if (id === 'woods') {
          b.set('walk', 0); b.cool = 99; D.actors.boss('stomp'); t.frames(10);
          t.ok(b.state === 'stompCrouch' && b.pre && b.pre.active && Math.abs(b.pre.m.material.uniforms.uR.value - (b.r + TA.preRing[0])) < 1e-9, 'stomp crouch: a light wall at its feet', b.state);
          const pre = b.pre;
          t.frames(70);
          t.ok(!b.pre && game.fight.rings.length > 0, 'it hands over to the ring at the landing', { pre: !!b.pre, rings: game.fight.rings.length });
          t.frames(20);
          t.ok(!pre.active, 'and fades out');
        }
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('melee', rows);
    }],
    ['r2: a dying boss keeps its body: Pip holding forward stays at its room until it is gone (its collider stays too)', (t) => {
      const { game, D, pl } = t;
      const rows = {};
      for (const id of ['woods', 'shores', 'peaks']) {
        const b = fight(t, id, 4);
        D.killBoss(); t.frames(1);
        t.ok(b.dying, id + ': dying');
        let min = 9, coll = 0, n = 0;
        for (let i = 0; i < 125 && !b.dead; i++) {     // 2.1 s of the 2.2 s death, holding forward at it
          D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); D.move(0, 1); t.frames(1); n++;
          min = Math.min(min, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z));
          if (game.dynamicColliders(pl).some((c) => c.x === b.pos.x && c.z === b.pos.z && Math.abs(c.r - b.colliderR) < 1e-9)) coll++;
        }
        D.move(0, 0);
        rows[id] = { min: +min.toFixed(3), room: b.room, keepOut: b.keepOut, coll, n };
        t.ok(min > b.room - 0.15, id + ': held at its room while it dies (was 0.04 m: inside the body)', rows[id]);
        t.eq(coll, n, id + ': its body collider stays while it dies');
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('dying', rows);
    }],
    ['r2: TA.keepOut covers each boss model at 0.5–1.2 m; the collider (AI frozen) and the leap landing keep Pip there', (t) => {
      const { game, D, pl, THREE } = t;
      const rows = {}, rc = new THREE.Raycaster();
      for (const id of ['woods', 'shores', 'peaks']) {
        const b = fight(t, id, 4.5);
        b.root.position.copy(b.pos); b.root.rotation.set(0, b.facing, 0); b.root.scale.set(1, 1, 1); b.root.updateMatrixWorld(true);
        let ext = 0;
        for (const h of [0.5, 0.7, 0.88, 1.0, 1.2]) for (let k = 0; k < 48; k++) {
          const a = (k / 48) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
          rc.set(new THREE.Vector3(b.pos.x + dx * 6, b.pos.y + h, b.pos.z + dz * 6), new THREE.Vector3(-dx, 0, -dz)); rc.far = 6;
          const hit = rc.intersectObject(b.root, true).find((x) => x.object.visible && x.object.material && x.object.material.side !== THREE.BackSide);
          if (hit) ext = Math.max(ext, 6 - hit.distance);
        }
        D.freezeAI(true);
        let min = 9;
        for (let i = 0; i < 120; i++) { D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); D.move(0, 1); t.frames(1); min = Math.min(min, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z)); }
        D.move(0, 0); D.freezeAI(false);
        rows[id] = { ext: +ext.toFixed(3), keepOut: b.keepOut, frozenMin: +min.toFixed(3) };
        t.ok(ext > 0.9 && b.keepOut >= ext + 0.1, id + ': keep-out ≥ the body at eye height + 0.1', rows[id]);
        t.ok(min > b.keepOut - 0.03, id + ': the body collider stops the eye at the keep-out', rows[id]);
        if (id === 'peaks') {
          // the leap aimed right at Pip: the body lands beside him, never closer than its keep-out
          const H = stubHurt(game);
          try {
            b.clearTells(); b.set('walk', 0); b.vel.set(0, 0); b.pos.set(b.arena.x, b.arena.h, b.arena.z); b.prev.copy(b.pos);
            D.teleport(b.arena.x + Math.sin(b.arena.entAng) * 5, b.arena.z + Math.cos(b.arena.entAng) * 5, b.arena.entAng + Math.PI, 0);
            D.actors.boss('leap');
            let lmin = 9;
            for (let i = 0; i < 150; i++) { t.frames(1); if (b.lift < 1) lmin = Math.min(lmin, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z)); if (b.state === 'walk' && i > 30) break; }
            rows.leap = { min: +lmin.toFixed(3), keepOut: b.keepOut };
            t.ok(lmin > b.keepOut - 0.03, 'Frostbun lands beside Pip at ≥ its keep-out (was 1.49: the eye inside its fur)', rows.leap);
          } finally { H.restore(); }
        }
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('keepOut', rows);
    }],
    ['r2: a charge / slide hurts once per rush and carries on past Pip (one Pinch charge used to take 6 HP)', (t) => {
      const { game, D, pl } = t;
      const rows = {};
      for (const [id, atk, dist] of [['shores', 'charge', 3], ['shores', 'charge', 6], ['peaks', 'slide', 3], ['peaks', 'slide', 6]]) {
        const b = fight(t, id, 7), a = b.arena, ang = a.entAng;
        // the tester's set-up: the boss 2 m off centre on the far side, Pip `dist` m toward the entrance, standing still
        b.pos.set(a.x - Math.sin(ang) * 2, a.h, a.z - Math.cos(ang) * 2); b.prev.copy(b.pos);
        D.teleport(b.pos.x + Math.sin(ang) * dist, b.pos.z + Math.cos(ang) * dist, ang + Math.PI, 0);
        game.S.hp = game.S.maxHp; pl.iframes = 0; t.frames(2);
        const orig = game.playerHurt, got = [], x0 = b.pos.x, z0 = b.pos.z;
        game.playerHurt = function (...q) { const r = orig.apply(this, q); if (r) got.push(+game.clock.simTime.toFixed(3)); return r; };
        let rushed = false;
        try {
          D.actors.boss(atk);
          for (let i = 0; i < 300; i++) { t.frames(1); if (b.state === atk) rushed = true; else if (rushed) break; }
        } finally { delete game.playerHurt; }
        const travel = Math.hypot(b.pos.x - x0, b.pos.z - z0);
        rows[`${id}-${atk}-${dist}`] = { hurts: got.length, hp: game.S.hp, maxHp: game.S.maxHp, travel: +travel.toFixed(2), end: b.state, dizzy: pl.state === 'dizzy' };
        const r = rows[`${id}-${atk}-${dist}`];
        t.eq(got.length, 1, `${id} ${atk} from ${dist} m: hurt once`);
        t.ok(!r.dizzy && r.hp === r.maxHp - TA.bossDmg.rush, `${id} ${atk} from ${dist} m: TA.bossDmg.rush (${TA.bossDmg.rush}) HP lost, still standing`, r);
        t.ok(travel > dist + 1, `${id} ${atk} from ${dist} m: the rush carried on past him`, r);
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('rush', rows);
    }],
    ['r2: Pinch snap: a strafe begun 0.3 s after the telegraph leaves the stripe (no hurt); standing still is hurt; a hint', (t) => {
      const { game, D, pl } = t;
      const b = fight(t, 'shores', 7), a = b.arena, ang = a.entAng;
      const H = stubHurt(game), R = rec(game, ['hint']), res = {};
      hintReset('wp5-snap');
      try {
        for (const mode of ['still', 'strafe R', 'strafe L']) {
          b.clearTells(); b.set('walk', 0); b.vel.set(0, 0); b.pos.set(a.x, a.h, a.z); b.prev.copy(b.pos); b.facing = b.prevFacing = ang;
          D.teleport(a.x + Math.sin(ang) * b.room, a.z + Math.cos(ang) * b.room, ang + Math.PI, 0); t.frames(2);
          const n = H.calls.length;
          D.actors.boss('snap'); t.frames(1);
          t.frames(18);                                   // a 0.3 s reaction
          if (mode !== 'still') D.move(mode === 'strafe R' ? 1 : -1, 0);
          for (let i = 0; i < 90 && b.state !== 'recover'; i++) t.frames(1);
          D.move(0, 0);
          res[mode] = H.calls.length - n;
        }
      } finally { H.restore(); R.off(); D.move(0, 0); }
      t.note('snap', res);
      t.ok(res.still > 0, 'standing still in the stripe: hurt', res);
      t.ok(res['strafe R'] === 0 && res['strafe L'] === 0, 'a strafe after a 0.3 s reaction: safe (it used to need a roll)', res);
      t.ok(R.got.some((q) => q.p.id === 'wp5-snap'), 'the snap stripe has its hint');
    }],
    ['r2: three hits in a row outside an opening are shrugged off (Pip shoved out of reach, no damage, an attack soon); an opening is not', (t) => {
      const { game, D, pl } = t;
      const res = {};
      for (const mode of ['walk', 'opening']) {
        const b = fight(t, 'woods', 4);
        const H = stubHurt(game);
        try {
          b.combo = 0;
          if (mode === 'opening') b.openFor('recover', 99); else { b.set('walk', 0); b.cool = 99; }
          for (let i = 0; i < 90; i++) { D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); D.move(0, 1); t.frames(1); }
          const hp0 = b.hp;
          let hits = 0, lastHp = b.hp, shrugAt = -1, maxD = 0, cool = null, atk = null;
          for (let i = 0; i < 120; i++) {
            D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z);
            if (i % 12 === 0 && shrugAt < 0) t.press('attack');
            t.frames(1);
            if (b.hp < lastHp) { hits++; lastHp = b.hp; }
            if (shrugAt < 0 && b.shrugT > 0) { shrugAt = i; cool = b.cool; }
            if (shrugAt >= 0 && i - shrugAt <= 40) maxD = Math.max(maxD, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z));
            if (shrugAt >= 0 && !atk && b.state !== 'walk') atk = { state: b.state, after: +((i - shrugAt) / 60).toFixed(2) };
            if (mode === 'opening') maxD = Math.max(maxD, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z));
          }
          res[mode] = { hits, dmg: hp0 - b.hp, shrugAt, maxD: +maxD.toFixed(2), room: b.room, reach: +(b.r + CFG.reachWood).toFixed(2), cool, atk };
        } finally { H.restore(); D.move(0, 0); }
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('shrug', res);
      const w = res.walk, o = res.opening;
      t.ok(w.shrugAt >= 0 && w.hits === TA.shrug.hits, 'shrugged after ' + TA.shrug.hits + ' hits', w);
      t.ok(w.maxD > w.reach + 0.3, 'Pip shoved out of sword reach', w);
      t.ok(w.cool != null && w.cool <= TA.shrug.cool + 1e-9 && w.atk && w.atk.after <= TA.shrug.cool + 0.1, 'its next attack comes soon', w);
      t.ok(o.shrugAt < 0 && o.hits >= 5 && o.maxD < o.room + 0.4, 'in an opening the hits keep landing (no shrug, Pip stays at its room)', o);
    }],
    ['r2: the ring hint shows at the stomp crouch, ≥ 1 s before the first ring (it came 0.2 s before the ring hurt)', (t) => {
      const { game, D } = t;
      fight(t, 'woods', 6);
      hintReset('wp5-ring');
      const R = rec(game, ['hint', 'shockwave', 'telegraph']), H = stubHurt(game);
      try { D.actors.boss('stomp'); t.frames(90); } finally { R.off(); H.restore(); }
      const h = R.got.find((q) => q.type === 'hint' && q.p.id === 'wp5-ring'), s = R.got.find((q) => q.type === 'shockwave'), tel = R.got.find((q) => q.type === 'telegraph' && q.p.kind === 'slam');
      t.ok(h && s && tel && Math.abs(h.t - tel.t) < 1e-9 && s.t - h.t >= 1.0, 'hint with the slam telegraph, before the ring', { hint: h && h.t, slam: tel && tel.t, ring: s && s.t });
    }],
    ['r3: a shrug that ends a recover waits for its answer (the spent cool started the next attack the same step: Pinch snapped again 1.05 s after a snap)', (t) => {
      const { game, D } = t;
      const rows = {};
      for (const id of ['woods', 'shores', 'peaks']) {
        const b = fight(t, id, 4);
        const H = stubHurt(game), R = rec(game, ['telegraph']);
        try {
          // the boss just finished an attack that leaves no opening, with a string of hits on it and its cool spent
          b.set('recover', 0.4); b.opening = false; b.cool = -0.4; b.combo = TA.shrug.hits; b.comboT = b.t;
          let shrugAt = null, tel = null;
          for (let i = 0; i < 300 && !tel; i++) {
            t.frames(1);
            if (shrugAt == null && b.shrugT > 0) shrugAt = game.clock.simTime;
            tel = R.got.find((q) => q.p.source === b && q.p.kind !== 'ring' && !q.p.announce);
          }
          rows[id] = { shrug: shrugAt != null, gap: tel && shrugAt != null ? +(tel.t - shrugAt).toFixed(3) : null, next: tel && tel.p.kind };
          const want = Math.max(TA.shrug.cool, TA.shrug.rest) - 0.05;   // (whole steps: the cool runs down in the shrug's own step)
          t.ok(rows[id].shrug && rows[id].gap != null && rows[id].gap >= want, id + ': the answer comes ≥ max(shrug.cool, shrug.rest) after the shrug (was 0 s)', rows[id]);
        } finally { H.restore(); R.off(); }
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('answer', rows);
    }],
    ['r3: a hit during a wind-up lands, then the boss shoves Pip out of sword reach and goes on with its attack (the tell is read from outside reach)', (t) => {
      const { game, D, pl } = t;
      const rows = {};
      for (const [id, atk, wind, next] of [['woods', 'stomp', 'stompCrouch', 'stompAir'], ['shores', 'snap', 'snapWind', 'snap'], ['peaks', 'throw', 'throwWind', 'recover']]) {
        const b = fight(t, id, 4);
        const H = stubHurt(game);
        try {
          const a = b.arena;
          D.teleport(a.x + Math.sin(a.entAng) * (b.room + 0.05), a.z + Math.cos(a.entAng) * (b.room + 0.05), a.entAng + Math.PI, 0); t.frames(2);
          b.combo = 0;
          D.actors.boss(atk);
          for (let i = 0; i < 30 && b.state !== wind; i++) t.frames(1);
          const hp0 = b.hp, d0 = Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z);
          let shoved = -1, maxD = 0, states = new Set();
          D.lookAt(b.pos.x, b.pos.y + 1, b.pos.z); t.press('attack');
          for (let i = 0; i < 60; i++) {
            t.frames(1); states.add(b.state);
            if (shoved < 0 && b.shrugT > 0) shoved = i;
            maxD = Math.max(maxD, Math.hypot(pl.pos.x - b.pos.x, pl.pos.z - b.pos.z));
          }
          rows[id] = { atk, d0: +d0.toFixed(2), hit: hp0 - b.hp, shoved, maxD: +maxD.toFixed(2), reach: +(b.r + CFG.reachWood).toFixed(2), states: [...states] };
        } finally { H.restore(); D.move(0, 0); }
        const r = rows[id];
        if (TA.shrug.wind) {
          t.ok(r.hit > 0 && r.shoved >= 0, `${id}: the hit in its ${wind} lands and it shoves Pip off`, r);
          t.ok(r.maxD > r.reach + 0.3, `${id}: out of sword reach`, r);
          t.ok(r.states.includes(next) && !r.states.includes('walk'), `${id}: it goes on with the ${atk}`, r);
        } else t.ok(r.hit > 0, `${id}: the hit lands (TA.shrug.wind off)`, r);
        game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('wind shove', rows);
    }],
    ['r3: what a boss attack takes follows TUNE.actors.bossDmg (the stomp ring, a snap, a landing; a rush above)', (t) => {
      const { game, D, pl } = t;
      const rows = {};
      for (const [id, atk, key] of [['woods', 'stomp', 'ring'], ['shores', 'snap', 'snap'], ['peaks', 'leap', 'leap']]) {
        const b = fight(t, id, 7), a = b.arena;
        D.teleport(a.x + Math.sin(a.entAng) * b.room, a.z + Math.cos(a.entAng) * b.room, a.entAng + Math.PI, 0);
        game.S.hp = game.S.maxHp; pl.iframes = 0; t.frames(2);
        const orig = game.playerHurt, got = [];
        game.playerHurt = function (dmg, ...q) { const r = orig.call(this, dmg, ...q); if (r) got.push(dmg); return r; };
        try { D.actors.boss(atk); for (let i = 0; i < 200 && !got.length; i++) t.frames(1); } finally { delete game.playerHurt; }
        rows[id] = { atk, got, want: TA.bossDmg[key] };
        t.ok(got.length === 1 && got[0] === TA.bossDmg[key], `${id} ${atk}: takes TA.bossDmg.${key}`, rows[id]);
        game.S.hp = game.S.maxHp; game.endFight(true); D.pose('spawn'); t.frames(2);
      }
      t.note('dmg', rows);
    }],
    ['openings: gold sparkles at TUNE.actors.sparkleHz per second of sim time, whatever the frame rate', (t) => {
      const { game, G } = t;
      const b = fight(t, 'shores', 6);
      const fx = G.fx, orig = fx.sparkle, counts = {};
      try {
        for (const [lab, dt] of [['30 fps', 1 / 30], ['120 fps', 1 / 120], ['60 fps', 1 / 60]]) {
          let n = 0;
          fx.sparkle = function (...a) { if (a[3] === TA.chance) n++; return orig.apply(this, a); };
          b.set('walk', 0); b.cool = 99; b.openFor('stunned', 99); b.sparkT = 0;
          t.frames(Math.round(2 / dt), { dt });
          counts[lab] = n;
        }
      } finally { fx.sparkle = orig; b.set('walk', 0); b.opening = false; }
      t.note('sparkles in 2 s', counts);
      t.ok(Object.values(counts).every((n) => Math.abs(n - 2 * TA.sparkleHz) <= 1), 'about ' + 2 * TA.sparkleHz + ' in 2 s at every frame rate', counts);
    }],
    ['NPCs: eye contact from 4 m, a wave inside 2.6 m, face Pip while talking, hop back when too close', (t) => {
      const { game, D, pl } = t;
      const npc = game.npcs.find((n) => !n.glbGroup && n.nodes.head) || game.npcs[0];
      const put = (d, side = 0.6) => { const a = npc.facing + side, x = npc.pos.x + Math.sin(a) * d, z = npc.pos.z + Math.cos(a) * d; D.teleport(x, z, yawOf(npc.pos.x - x, npc.pos.z - z), 0); };
      put(6); t.frames(30);
      t.ok(npc.look < 0.1, 'no eye contact at 6 m', npc.look);
      put(3.6); t.frames(40);
      const toP = yawOf(pl.pos.x - npc.pos.x, pl.pos.z - npc.pos.z), head = npc.facing + npc.lookYaw * npc.look;
      t.ok(npc.look > 0.85 && Math.abs(angDiff(head, toP)) < 0.2, 'eye contact at 3.6 m', { look: npc.look, err: angDiff(head, toP) });
      t.ok(npc.waveT === 0, 'no wave outside 2.6 m');
      put(2.3); t.frames(3);
      t.ok(npc.waveT > 0, 'waves inside 2.6 m', npc.waveT);
      put(2.0, 1.4); npc.talkStart(); t.frames(40);
      t.ok(Math.abs(angDiff(npc.facing, yawOf(pl.pos.x - npc.pos.x, pl.pos.z - npc.pos.z))) < 0.12, 'faces Pip while talking');
      npc.talkEnd();
      put(0.75); npc.talkStart(); t.frames(40);
      t.ok(Math.hypot(pl.pos.x - npc.pos.x, pl.pos.z - npc.pos.z) >= TA.npcBackHop - 0.05, 'hopped back to ≥ 1.1 m', Math.hypot(pl.pos.x - npc.pos.x, pl.pos.z - npc.pos.z));
      npc.talkEnd();
      // a stay-at-home villager (wander 0: Miso) never drifts from her spot. In the merged world WP9's shop counter stands
      // between her and her customers and her spot overlaps the counter's and the shop's colliders, so (1) walking up to
      // her from the front and both sides, then talking three times from the closest spot reached, leaves her on her
      // spot (she never hops: a hop through those colliders ejected her 1.7 m and stranded her there); (2) a talk with Pip
      // placed 0.75 m from her starts no hop; (3) displaced anyway, she walks straight back and turns to her spot's facing
      const home = game.npcs.find((n) => !n.def.wander);
      if (!home) { t.note('stay-at-home', 'none'); return; }
      const spot = { x: home.home.x, z: home.home.z }, from = (o) => Math.hypot(o.pos.x - spot.x, o.pos.z - spot.z);
      const dist = () => Math.hypot(pl.pos.x - home.pos.x, pl.pos.z - home.pos.z);
      let best = null;
      for (const deg of [0, -35, 35, -70, 70]) {
        const a = home.homeRot + deg * D2R, x = spot.x + Math.sin(a) * 3.5, z = spot.z + Math.cos(a) * 3.5;
        D.teleport(x, z, yawOf(spot.x - x, spot.z - z), 0); t.frames(2);
        let min = 9, at = null;
        for (let i = 0; i < 120; i++) { D.lookAt(home.pos.x, home.pos.y + 1, home.pos.z); D.move(0, 1); t.frames(1); if (dist() < min) { min = dist(); at = { x: pl.pos.x, z: pl.pos.z }; } }
        D.move(0, 0);
        if (!best || min < best.d) best = { d: min, deg, ...at };
      }
      const rows = [];
      for (let k = 0; k < 3; k++) {
        D.teleport(best.x, best.z, yawOf(home.pos.x - best.x, home.pos.z - best.z), 0); t.frames(2);
        home.talkStart(); t.frames(40); const moved = from(home); home.talkEnd();
        t.frames(150);
        rows.push({ d: +dist().toFixed(2), moved: +moved.toFixed(3), after: +from(home).toFixed(3) });
      }
      t.note('stay-at-home ' + home.id, { closestWalked: +best.d.toFixed(2), fromDeg: best.deg, rows });
      t.ok(rows.every((r) => r.moved < 0.03 && r.after <= 0.03), home.id + ': talks from the closest spot Pip can walk to leave her on her spot', rows);
      const p0 = pl.pos.clone(), a0 = home.homeRot;
      pl.pos.set(spot.x + Math.sin(a0) * 0.75, pl.pos.y, spot.z + Math.cos(a0) * 0.75);
      home.talkStart(); const hop = home.backHop; home.talkEnd(); pl.pos.copy(p0);
      t.ok(!hop, home.id + ': no back-hop even from 0.75 m (her counter gives the distance)', hop);
      const fx = spot.x + Math.sin(a0) * 5, fz = spot.z + Math.cos(a0) * 5;
      D.teleport(fx, fz, yawOf(spot.x - fx, spot.z - fz), 0); t.frames(2);
      home.pos.x += Math.cos(a0) * 0.5; home.pos.z -= Math.sin(a0) * 0.5;   // 0.5 m sideways, into the counter's colliders
      const pushed = from(home);
      t.frames(240);
      const back = { pushed: +pushed.toFixed(2), after: +from(home).toFixed(3), turn: +Math.abs(angDiff(home.facing, home.homeRot)).toFixed(3) };
      t.note('displaced ' + home.id, back);
      t.ok(back.after <= 0.03 && back.turn < 0.15, home.id + ': displaced, she walks straight back to her spot and its facing', back);
    }],
    ['audio: pan follows the screen side, inverse distance gain, low-pass behind; the arch test point', (t) => {
      const { game, D, G } = t;
      const A = G.audio;
      if (!A || A.stub) { t.ok(true, 'audio stubbed (?noaudio=1)'); return; }
      D.look(0, 0); t.frames(1);
      const v = game.view, e = v.eye, f = fwdXZ(v.yaw), r = rightXZ(v.yaw);
      A.listener(e.x, e.y, e.z, v.yaw);
      const L = { x: e.x + f.x * 3 - r.x * 3, y: e.y, z: e.z + f.z * 3 - r.z * 3 }, Rr = { x: e.x + f.x * 3 + r.x * 3, y: e.y, z: e.z + f.z * 3 + r.z * 3 };
      t.ok(v.worldToScreen(L).x < innerWidth / 2 && A.place(L.x, L.y, L.z).pan < -0.5, 'screen-left → pan < −0.5');
      t.ok(v.worldToScreen(Rr).x > innerWidth / 2 && A.place(Rr.x, Rr.y, Rr.z).pan > 0.5, 'screen-right → pan > 0.5');
      // the arch §15.2 test point, in this game's convention (facing +Z the screen's right is −X)
      A.listener(0, 0, 0, 0);
      const pr = A.place(-5, 0, 0), pl = A.place(5, 0, 0), front = A.place(0, 0, 5), back = A.place(0, 0, -5);
      t.ok(pr.pan > 0.5 && pl.pan < -0.5, '(−5, 0, 0) is screen-right (+ pan), (5, 0, 0) screen-left', { pr: pr.pan, pl: pl.pan });
      t.ok(back.lp < 2000 && front.lp > 15000, 'behind → low-pass engaged', { back: back.lp, front: front.lp });
      t.near(A.place(0, 0, 10).gain, 0.25, 1e-9, '10 m: ref 2.5 / 10');
      t.near(A.place(0, 0, 1).gain, 1, 1e-9, 'inside ref: full');
      t.eq(A.place(0, 0, 45).gain, 0, '45 m: silent');
    }],
    ['audio: offline render — left/right energy, no clipping when 14 loud sounds stack', async (t) => {
      const { G } = t;
      const A = G.audio;
      if (!A || A.stub || typeof OfflineAudioContext === 'undefined') { t.ok(true, 'no offline audio here'); return; }
      // a stubbed / broken OfflineAudioContext renders nothing (and never throws): say so instead of failing
      if (!(await A.render(null, null, { sec: 0.05 }))) { t.note('skipped', 'offline audio cannot render here (stubbed context)'); t.ok(true, 'skipped'); return; }
      const L = { x: 0, y: 0, z: 0, yaw: 0 };
      const left = await A.render('hit', { x: 5, y: 0, z: 0 }, { sec: 0.6, listener: L });
      t.ok(left && left.rmsL > 4 * left.rmsR, 'screen-left source: left channel louder', left);
      const loud = ['fanfare', 'bloom', 'seed', 'bossDie', 'stomp', 'heart', 'chest', 'bossIntro', 'bossHit', 'hurt', 'rumble', 'windLunge', 'alert', 'hit'].map((n) => [n, { x: 0, y: 0, z: 1 }]);
      const st = await A.render(loud, null, { sec: 1.5, listener: L });
      t.note('stack', st);
      t.ok(st && st.played >= 12 && st.peak < 1, 'stacked peak < 0 dBFS', st);
    }],
    ['audio is event-driven (C8): steps by surface, jump / land (simulated C2), swings A/B/C, wind-up cues; old names claimed', (t) => {
      const { game, G, EV } = t;
      const ev = game.events, last = () => G.debug.audio.last().last.map((q) => q.name);
      G.debug.audio.clear();
      ev.emit(EV.STEP, { foot: 'L', surface: 'sand', speed: 4.4 }); ev.emit(EV.STEP, { foot: 'R', surface: 'water', speed: 3 });
      ev.emit(EV.JUMP, {}); ev.emit(EV.LAND, { impact: 5, surface: 'grass' }); ev.emit(EV.LAND, { impact: 9.5, surface: 'grass' });
      ev.emit(EV.SWING, { kind: 'A', level: 1 }); ev.emit(EV.SWING, { kind: 'B', level: 1 }); ev.emit(EV.SWING, { kind: 'C', level: 2 });
      ev.emit(EV.TELEGRAPH, { kind: 'lunge', x: 0, y: 1, z: 0, t: 0.7, source: { type: 'bee', windDur: 0.7 } });
      ev.emit(EV.TELEGRAPH, { kind: 'slam', x: 0, y: 1, z: 0, t: 1.2, source: { id: 'woods', arena: {}, windDur: 0.55 } });
      ev.emit(EV.LOCK, { target: { type: 'slime' }, prev: null });
      const got = last();
      for (const n of ['step_sand', 'step_wade', 'jump', 'land', 'landHeavy', 'swingA', 'swingB', 'swingC', 'swingSparkle', 'windup_bee', 'windSlam', 'lockOn']) t.ok(got.includes(n), 'played ' + n, got);
      t.eq(STEP_NAME.stone, 'step_stone', 'surface table');
      for (const n of ['uiMove', 'uiSelect', 'uiBack', 'uiOpen', 'uiClose', 'uiTab', 'uiSlider', 'coach', 'waypoint', 'shoulder', 'eyelid', 'whoosh', 'sparkle', 'creak', 'splashBig', 'leaves', 'bell',
        'step_grass', 'step_dirt', 'step_snow', 'step_wood', 'step_stone', 'step_wade', 'landHeavy', 'lock', 'unlock', 'lockOn', 'lockOff', 'uiHover', 'uiTick', 'viewSwitch', 'pickupGem',
        'menu', 'select', 'cancel', 'error', 'door', 'talk', 'swing', 'hit', 'step', 'heartbeat', 'whistle', 'rumble', 'alert'])
        t.ok(!G.audio.sfxNames || G.audio.stub || G.audio.sfxNames.includes(n), 'sound name ' + n);
      if (G.audio && G.audio.ready) {
        ev.emit(EV.SWING, { kind: 'A', level: 1 });
        t.eq(G.audio.sfx('swing'), false, "a direct sfx('swing') next to EV.SWING is dropped (no double)");
      } else t.note('claims', 'audio context not running: claim check skipped');
    }],
    ['audio: music ducks in dialogue, low-health heartbeat, region ambience, junk arguments never throw', (t) => {
      const { game, D, G, ui, EV } = t;
      const A = G.audio;
      if (!A || A.stub) { t.ok(true, 'audio stubbed'); return; }
      D.standAt('sign'); t.frames(2); t.press('interact'); t.frames(3);
      t.ok(!!ui.dlg && A.info().duck === 0.45, 'ducked in dialogue', A.info().duck);
      t.dlgDone(); t.frames(2);
      t.eq(A.info().duck, 1, 'back after');
      game.S.hp = 1; t.frames(2);
      t.eq(A.info().heart, 1, 'one half-heart: heartbeat on');
      // Save & Quit → title (everything off) → Continue at the same low hp: the heartbeat comes back
      game.events.emit(EV.TITLE, {}); t.eq(A.info().heart, 0, 'title: off');
      t.frames(2);
      t.eq(A.info().heart, 1, 'back in play at the same hp: on again');
      game.events.emit(EV.SESSION, { isNew: false }); A.heartbeat(0); t.frames(2);
      t.eq(A.info().heart, 1, 'a new session re-sends the level');
      game.S.hp = game.S.maxHp; t.frames(2);
      t.eq(A.info().heart, 0, 'healed: off');
      D.pose('shores'); t.frames(80);
      t.eq(A.info().bed, 'shores', 'shores bed');
      let threw = null;
      const junk = [undefined, null, NaN, {}, 'x', -1, [1, 2]];
      for (const k of Object.keys(A)) {
        if (typeof A[k] !== 'function' || k[0] === '_' || ['init', 'render', 'setMuted', 'toggleMute', 'music', 'setMusicVolume', 'setSfxVolume'].includes(k)) continue;
        for (const j of junk) { try { A[k](j, j, j, j); } catch (e) { threw = k + ': ' + e.message; } }
      }
      t.ok(!threw, 'no throw', threw);
      A.duck(1); A.heartbeat(0); A.ambience(null); A.config({ ref: 2.5, max: 45, minGain: 0.03, lpFront: 18000, lpBehind: 1400, panK: 0.9 }); A.setVolumes({ music: 1, sfx: 1, amb: 1 });
    }],
    ['r2: the low-health heartbeat follows the HUD beat: hp ≤ 2 soft / ≤ 1 full whatever maxHp, period TUNE.hud.beat, on the HUD phase', async (t) => {
      const { game, G } = t;
      const A = G.audio;
      if (!A || A.stub) { t.ok(true, 'audio stubbed'); return; }
      const S = game.S, keep = { hp: S.hp, maxHp: S.maxHp };
      try {
        S.maxHp = 20;   // the old rule started at max(2, 25 % of max) = 5 here, with no HUD pulse at all
        for (const [hp, want] of [[5, 0], [3, 0], [2, TA.audio.heartSoft], [1, 1]]) { S.hp = hp; t.frames(2); t.eq(A.info().heart, want, `heart level at hp ${hp} of 20`); }
        const hb = A.info().heartBeat;
        t.near(hb.period, TH.beat, 1e-9, 'period = TUNE.hud.beat (was 1.05 − 0.3 k: 0.75 s at half a heart)');
        if (A.info().state !== 'running') { t.note('beats', 'audio context not running: scheduling not measured'); return; }
        await t.wait(2400);
        const last = A.info().heartBeat.last, per = TH.beat;
        const rows = last.map((q) => ({ n: q.n, perf: q.perf, phase: +(((q.perf / per) % 1 + 1) % 1).toFixed(4) }));
        t.note('beats', rows);
        t.ok(rows.length >= 2, 'beats scheduled', rows);
        t.ok(rows.every((q) => Math.abs(q.phase - hb.lead) < 0.004), 'each beat on the HUD phase (ui.beatPhase ' + hb.lead + ')', rows);
        t.ok(rows.slice(1).every((q, i) => Math.abs(q.perf - rows[i].perf - per * (q.n - rows[i].n)) < 0.003 && q.n - rows[i].n === 1), 'one beat per HUD period', rows);
        // each beat is placed on the audio clock from a clock pairing at most the scheduler's look-ahead old (the pairing is
        // taken again for every beat, so a stalled or drifting audio clock never carries the beat off the HUD phase)
        const ahead = last.map((q) => q.ahead);
        t.ok(ahead.every((x) => x >= 0 && x <= 0.2), 'scheduled ≤ 0.2 s ahead of the audio clock', ahead);
      } finally { S.hp = keep.hp; S.maxHp = keep.maxHp; t.frames(2); }
    }],
    ['r4 first person: a drop at sword reach (gem / heart, 1 m ahead) never rises to the eye line or comes within 0.8 m of the eye; third person still pulls it to his chest', (t) => {
      const { game, D, G } = t;
      noSpawns(game);
      const pl = game.player, rows = [];
      try {
        for (let s = 0; s < 16; s++) {
          D.seed(500 + s);
          for (const p of game.pickups) p.remove();
          game.pickups = [];
          const yaw = D.info().yaw, x = pl.pos.x + Math.sin(yaw) * 1.0, z = pl.pos.z + Math.cos(yaw) * 1.0;
          game.S.hp = 2; game.maybeDrop(x, z, 1, 1);
          let minD = 9, maxDy = -9, n = 0;
          for (let f = 0; f < 90 && game.pickups.some((p) => p.alive); f++) {
            t.frames(1);
            const e = G.view.eye;
            for (const p of game.pickups) if (p.alive) { n++; const d = Math.hypot(p.pos.x - e.x, p.pos.y - e.y, p.pos.z - e.z); minD = Math.min(minD, d); if (d < 1.5) maxDy = Math.max(maxDy, p.pos.y - e.y); }
          }
          rows.push({ s, minD: +minD.toFixed(2), maxDy: +maxDy.toFixed(2), n, left: game.pickups.filter((p) => p.alive).length });
        }
        t.note('fp', rows);
        t.ok(rows.every((r) => r.n > 0 && r.left === 0), 'every drop flew and was collected', rows);
        t.ok(rows.every((r) => r.minD >= 0.8), 'never within 0.8 m of the eye (was 0.45)', rows.map((r) => r.minD));
        t.ok(rows.every((r) => r.maxDy <= -0.15), 'within 1.5 m always ≥ 0.15 m under the eye line (was 0.1–0.3 m over it)', rows.map((r) => r.maxDy));
        // third person: the old flight (any direction, vy 4–6, magnet to the chest)
        D.setView('tp', { instant: true }); t.frames(2);
        for (const p of game.pickups) p.remove();
        game.pickups = [];
        const vys = [];
        for (let s = 0; s < 6; s++) { D.seed(77 + s); game.maybeDrop(pl.pos.x + 1, pl.pos.z, 1, 0); vys.push(+game.pickups[game.pickups.length - 1].vel.y.toFixed(2)); }
        t.ok(vys.every((v) => v >= 4 && v <= 6), 'third person: the drop still pops up (vy 4–6 m/s)', vys);
      } finally { D.setView('fp', { instant: true }); for (const p of game.pickups) p.remove(); game.pickups = []; game.S.hp = game.S.maxHp; t.frames(1); }
    }],
    ['motion comfort: the enemy and boss wind-up rim and a dying boss\'s flicker hold steady (≤ 3 flashes / s, WCAG 2.3.1) and stay shown; off, 7 Hz / 5 Hz as before', (t) => {
      const { game, D, settings } = t, rows = {};
      const flashOf = (o) => { const m = o.mats.find((q) => q.userData.flash); return () => m.userData.flash.value; };
      const H = stubHurt(game);
      try {
        for (const calm of [true, false]) {
          settings.set('reduceMotion', calm);
          // an enemy (crab: a 0.65 s wind-up), in view
          t.clearEnemies(); noSpawns(game); D.teleport(game.player.pos.x, game.player.pos.z, game.view.yaw, 0);
          D.spawn('crab', 3, 0, { face: true }); const e = D.last; e.spawnT = 1; t.frames(1);
          D.actors.attack(e);
          const fe = flashOf(e), en = [];
          for (let i = 0; i < 120 && e.state !== 'windup'; i++) t.frames(1);
          t.frames(1);                                     // its first frame has no wind yet
          for (let i = 0; i < 120 && e.state === 'windup'; i++) { t.frames(1); if (e.state === 'windup') en.push(fe()); }
          t.clearEnemies();
          // a boss (Pinch's charge wind-up), then its death
          const b = fight(t, 'shores', 7), fb = flashOf(b), bo = [];
          D.actors.boss('charge'); t.frames(2);
          for (let i = 0; i < 200 && b.state === 'chargeWind'; i++) { t.frames(1); if (b.state === 'chargeWind') bo.push(fb()); }
          b.set('walk', 0); b.cool = 99; t.frames(30);
          D.killBoss(); t.frames(1);
          const die = [];
          for (let i = 0; i < 90 && !b.dead; i++) { t.frames(1); die.push(fb()); }
          game.endFight(true); D.pose('meadow'); t.frames(2);
          const r = rows[calm ? 'comfort' : 'off'] = { enemy: flashRate(en), boss: flashRate(bo), dying: flashRate(die), n: [en.length, bo.length, die.length], minEnemy: Math.min(...en), minBoss: Math.min(...bo) };
          t.ok(en.length >= 25 && bo.length >= 25 && die.length >= 60, 'sampled the whole wind-ups and the death', r);
          if (calm) {
            t.ok(r.minEnemy > 0.15 && r.minBoss > 0.15, 'comfort: the wind-up tell stays clearly on (flash > 0.15) for the whole wind-up', r);
            t.ok(r.enemy <= 3 && r.boss <= 3 && r.dying <= 3, 'comfort: no flicker above 3 flashes / s', r);
            const steady = (a, v) => a.every((x) => Math.abs(x - v) < 1e-6);
            t.ok(steady(en, TA.rimFlash * TA.rimCalm) && steady(bo, TA.rimFlash * TA.rimCalm), 'comfort: both rims hold at rimFlash × rimCalm', { en, bo });
            t.ok(steady(die, TA.dieCalm * 0.85), 'comfort: the dying boss holds a steady glow', die);
          } else {
            t.ok(r.enemy >= 5 && r.boss >= 5 && r.dying >= 4, 'off: the rims pulse at 7 Hz and the death flickers at 5 Hz as before', r);
          }
        }
      } finally { H.restore(); settings.set('reduceMotion', false); if (game.fight) game.endFight(true); }
      t.note('rates', rows);
    }],
  ], { desc: 'actors, telegraphs, positional audio (WP5)', prepare: { view: 'fp', pose: 'meadow', god: false, freeze: false, time: 12 } });

  suite('wp5-heavy', [
    ['60 s, 6-enemy arena script: at most 2 winding up or attacking at once', (t) => {
      const { game, D } = t;
      noSpawns(game);
      const H = stubHurt(game);
      let max = 0, frames = 0;
      const who = new Set();
      try {
        [['slime', 3, 0], ['slime', 4, 90], ['bee', 4, -60], ['bee', 5, 170], ['crab', 4.5, -120], ['mushroom', 6, 40]].forEach(([ty, d, rel]) => D.spawn(ty, d, rel, { face: true }));
        for (let i = 0; i < 3600; i++) { t.frames(1); frames++; const n = game.enemies.filter((e) => e.alive && e.attacking); n.forEach((e) => who.add(e)); max = Math.max(max, n.length); }
      } finally { H.restore(); }
      t.note('max', max); t.note('attackers', who.size); t.note('frames', frames);
      t.ok(max <= TA.tokens, 'max ' + max);
      t.ok(who.size >= 5, 'attackers ' + who.size);
    }],
    ['telegraph lead matrix: every type, in view and behind, 10 s each → every hit ≥ 0.55 s after its telegraph', (t) => {
      const { game, D } = t;
      const rows = {};
      for (const ty of TYPES) for (const rel of [0, 180]) {
        t.clearEnemies();
        D.teleport(game.player.pos.x, game.player.pos.z, game.view.yaw, 0);
        const r = leadRun(t, ty, rel, 10);
        rows[ty + '@' + rel] = { worst: +r.worst.toFixed(3), tel: r.tel, hits: r.hits };
        t.ok(r.hits > 0, ty + '@' + rel + ' connects', rows[ty + '@' + rel]);
        t.ok(r.worst >= 0.55 - 1e-6, ty + '@' + rel + ' lead', rows[ty + '@' + rel]);
      }
      t.note('rows', rows);
    }],
    ['r3 balance: a player who never dodges (holds forward, swings every 0.18 s) is not downed by a boss before 15 s, and no boss falls to it in under 15 s', (t) => {
      const { game, D, pl, ui } = t;
      const rows = {}, S = game.S, keep = { hp: S.hp, maxHp: S.maxHp };
      try {
        for (const id of ['woods', 'shores', 'peaks']) for (const seed of [3, 8]) {
          D.seed(seed);
          const b = fight(t, id, 6);
          b.cool = 2.0;                                   // as the intro leaves it
          S.maxHp = 6; S.hp = 6; t.resetPlayer();
          let T = 0, end = 'time';
          for (let i = 0; i < 40 * 60; i++) {
            if (pl.state === 'dizzy' || S.hp <= 0) { end = 'down'; break; }
            if (b.dying || !game.fight) { end = 'win'; break; }
            const lp = game.lockPoint(b); D.lookAt(lp.x, lp.y, lp.z); D.move(0, 1);
            if (i % 11 === 0) t.press('attack');
            t.frames(1); T += 1 / 60;
          }
          D.move(0, 0);
          rows[id + '#' + seed] = { end, T: +T.toFixed(2), hp: S.hp, bossHp: b.hp, maxHp: b.maxHp };
          t.ok(T >= 15, `${id} (seed ${seed}): the fight lasts ≥ 15 s (${end})`, rows[id + '#' + seed]);
          if (pl.state === 'dizzy') { pl.state = 'normal'; pl.iframes = 0; if (ui.setDizzy) ui.setDizzy(false); }
          S.hp = 6; game.endFight(true); t.resetPlayer(); D.pose('spawn'); t.frames(2);
        }
      } finally { S.hp = keep.hp; S.maxHp = keep.maxHp; D.move(0, 0); }
      t.note('masher', rows);
    }],
    ['rematch balance: the same never-dodging player is not downed by a rematch guardian before 10 s, and wins no rematch in under 20 s', (t) => {
      const { game, D, pl, ui } = t;
      const rows = {}, S = game.S, keep = { hp: S.hp, maxHp: S.maxHp };
      try {
        for (const id of ['woods', 'shores', 'peaks']) for (const seed of [3, 8]) {
          D.seed(seed);
          const b = fight(t, id, 6, true);
          t.ok(b.rematch && b.maxHp === Math.round(BOSSES[id].hp * REMATCH.hpK), id + ': a rematch guardian', { maxHp: b.maxHp });
          b.cool = 2.0;                                   // as the intro leaves it
          S.maxHp = 6; S.hp = 6; t.resetPlayer();
          let T = 0, end = 'time';
          for (let i = 0; i < 40 * 60; i++) {
            if (pl.state === 'dizzy' || S.hp <= 0) { end = 'down'; break; }
            if (b.dying || !game.fight) { end = 'win'; break; }
            const lp = game.lockPoint(b); D.lookAt(lp.x, lp.y, lp.z); D.move(0, 1);
            if (i % 11 === 0) t.press('attack');
            t.frames(1); T += 1 / 60;
          }
          D.move(0, 0);
          rows[id + '#' + seed] = { end, T: +T.toFixed(2), hp: S.hp, bossHp: b.hp, maxHp: b.maxHp };
          t.ok(end !== 'down' || T >= 10, `${id} (seed ${seed}): not downed before 10 s`, rows[id + '#' + seed]);
          t.ok(end !== 'win' || T >= 20, `${id} (seed ${seed}): no rematch won in under 20 s`, rows[id + '#' + seed]);
          if (pl.state === 'dizzy') { pl.state = 'normal'; pl.iframes = 0; if (ui.setDizzy) ui.setDizzy(false); }
          S.hp = 6; game.endFight(true);
          // endFight puts a rematch guardian back to nap: leave the first-fight one for the next test
          if (game.bosses[id]) game.bosses[id].remove();
          game.bosses[id] = new Boss(id, game.world.arenas[id]);
          t.resetPlayer(); D.pose('spawn'); t.frames(2);
        }
      } finally { S.hp = keep.hp; S.maxHp = keep.maxHp; D.move(0, 0); }
      t.note('masher', rows);
    }],
    ['every sound renders under 0 dBFS at 1 m (offline)', async (t) => {
      const A = t.G.audio;
      if (!A || A.stub || typeof OfflineAudioContext === 'undefined' || !(await A.render(null, null, { sec: 0.05 }))) { t.note('skipped', 'no offline audio'); t.ok(true, 'no offline audio'); return; }
      const lv = {};
      for (const n of A.sfxNames) { const m = await A.render(n, { x: 0, y: 0, z: 1 }, { sec: 1.2, listener: { x: 0, y: 0, z: 0, yaw: 0 } }); lv[n] = m ? m.peakDb : null; }
      t.note('levels', lv);
      const over = Object.entries(lv).filter((q) => q[1] == null || q[1] >= 0);
      t.ok(!over.length, 'all under 0 dBFS', over);
    }],
  ], { desc: 'WP5 long runs (≈ 40 s)', heavy: true, prepare: { view: 'fp', pose: 'meadow', god: false, freeze: false, time: 12 } });
}
