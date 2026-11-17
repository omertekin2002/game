// WP4 in-page test suites (registered by js/debug/tests.js; only loaded with ?debug=1): combat volumes, lock-on (C1),
// crosshair interaction, the eye-level spawner, sim-time beats. 'wp4' runs in 'all'; 'wp4-matrix' (heavy) is the full
// combat matrix of arch §15.2 WP4 accept 1 (6 types × 4 distances × 9 bearings × 3 pitches × A/B/C) checked against
// SPEC below, a plain restatement of the sword rules in degrees (no sweep, no steps): the stepped, swept simulation must
// agree with it on every cell.
import { G } from '../../core.js';
import { EV } from '../../events.js';
import { combat as TC, view as TV } from '../../tune.js';
import { swordTest, walksOnGround, trunkR } from '../../combat.js';
import { trySpawnEnemy, inViewCone, coneOrigin } from '../../spawn.js';
import { Enemy } from '../../entities.js';
import { yawOf, angDiff, wrapAngle, clamp } from '../../util.js';
import { STEP } from '../../clock.js';
import { ENEMY, CFG } from '../../data.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const TYPES = ['slime', 'mushroom', 'bat', 'bee', 'crab', 'snowpuff'];
const ALT = { slime: 0, mushroom: 0, bat: 1.5, bee: 1.0, crab: 0, snowpuff: 0.35 };

/** SPEC: does swing `kind` hit a target (hurt volume relative to Pip's feet: r, y0, y1) at horizontal distance d,
 *  bearing rel (deg, + = left of the aim), aim pitch p (deg)? Magnetism off, Pip standing, flat ground (no terrain wall),
 *  clear LOS. ground: a walking critter (the ledge rules) */
export function SPEC({ d, rel, p, kind, r, y0, y1, reach, ground = false, eyeH = TV.eyeH }) {
  if (d > reach + r) return false;                                            // surface out of reach
  if (Math.hypot(d, clamp(eyeH, y0, y1) - eyeH) - r > reach + TC.reachSlack) return false;
  if (y0 > eyeH + TC.reachUp) return false;                                   // wholly above the blade
  if (ground) {                                                               // higher / lower than a walkable slope allows
    const lim = TC.groundSlack + TC.walkK * d;
    if (y0 > Math.min(TC.groundUp, lim) || -y0 > lim) return false;
  } else if (y1 < -TC.reachDown) return false;                                // a flyer wholly below the feet
  if (d < TC.bubble + TC.bubbleR * r && y1 >= -0.2 && y0 <= 1.6) return true; // inside the body bubble
  const edge = Math.abs(rel) - Math.atan(r / Math.max(r, d)) * R2D;          // nearest edge off the aim
  const dv = Math.max(d, 0.3), e0 = Math.atan2(y0 - eyeH, dv) * R2D, e1 = Math.atan2(y1 - eyeH, dv) * R2D;
  if (kind === 'C') return edge <= TC.arcC && e1 >= p + TC.chopDown && e0 <= p + TC.chopUp;
  return edge <= TC.arc && e1 >= p - TC.bandDown && e0 <= p + TC.bandUp;
}

/** lunge off (the matrix measures the volume, not the step-in), restored by the returned function */
function noLunge() {
  const keep = { lunge: TC.lunge, lungeSoft: TC.lungeSoft, lungeC: TC.lungeC };
  TC.lunge = TC.lungeSoft = TC.lungeC = 0;
  return () => Object.assign(TC, keep);
}

/** one deterministic swing of `kind` at a spawned enemy (Pip at o.x/o.z, default the flat plaza looking south) →
 *  { hit, kind (the swing that ran), hitT (attackT of the first hit), contactT, ev (HIT payload), e, hb (at spawn) } */
function swing(t, o) {
  const { game, D } = t, pl = game.player;
  t.clearEnemies(); t.resetPlayer();
  D.teleport(o.x ?? 0, o.z ?? 9.5, o.yaw ?? 0, (o.pitch ?? 0) * D2R);
  t.frames(1);
  if (o.at) { const q = new Enemy(o.type, o.at.x, o.at.z); q.spawnT = 1; game.addEnemy(q); D.last = q; }
  else D.spawn(o.type, o.dist, o.rel ?? 0, { alt: o.alt, face: o.face, state: o.state });
  const e = D.last, hp0 = e.hp, hb = e.hurtbox({});
  if (o.y0 != null) { const q = e.hurtbox({}); e.alt += o.y0 + pl.pos.y - q.y0; e.altCur = e.alt; e.hurtbox(hb); } // bottom at feet + y0
  if (o.aim) { const p = game.lockPoint(e); D.aimAt(p.x, p.y, p.z); t.frames(1); }
  e.iframes = 0; e.lastSwing = -1;
  if (o.setup) o.setup(e);
  if (o.kind === 'B') { pl.combo = 'A'; pl.chainT = 0; }
  if (o.kind === 'C') { pl.combo = 'B'; pl.chainT = 0; }
  const hits = [], kinds = [];
  const off1 = game.events.on(EV.HIT, (p) => { if (p.target === e) hits.push({ ...p, attackT: pl.attackT }); });
  const off2 = game.events.on(EV.SWING, (p) => kinds.push(p.kind));
  t.press('attack');
  const end = (o.kind === 'C' ? TC.winC : TC.winAB)[1] + 0.04;
  try {
    for (let i = 0; i < 45; i++) {
      t.frames(1);
      if (o.each) o.each(e, i);
      if (pl.state !== 'attack' || (pl.attackT > end && game.clock.hitStopT <= 0)) break;
    }
  } finally { off1(); off2(); }
  const ev = hits[0] || null;
  const out = { hit: !!ev || e.hp < hp0 || !e.alive, kind: kinds.join(''), hitT: ev ? ev.attackT : null, contactT: ev ? ev.contactT : null, ev, e, hb, dmg: hp0 - Math.max(0, e.hp) };
  if (!o.keep) t.clearEnemies();
  return out;
}

/** a temporary solid cylinder (circle collider) at (x, z): returns remove() */
function tempCollider(W, x, z, r = 0.35, h = 1.6) {
  const c = W.addDynamicCollider({ x, z, r, kind: 'wp4test', decl: { h, cam: h } });
  return () => {
    c.active = false;
    const i = W.colliders.indexOf(c); if (i >= 0) W.colliders.splice(i, 1);
    for (const arr of W.cHash.values()) { const k = arr.indexOf(c); if (k >= 0) arr.splice(k, 1); }
  };
}
/** a temporary terrain ridge (height add) across the segment from (ax, az) to (bx, bz) at its midpoint: returns remove() */
function tempRidge(W, ax, az, bx, bz, h = 1.6, half = 0.15) {
  const own = Object.prototype.hasOwnProperty.call(W, 'hAt'), orig = W.hAt;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, l = Math.hypot(bx - ax, bz - az) || 1, fx = (bx - ax) / l, fz = (bz - az) / l;
  W.hAt = function (x, z) { const v = orig.call(this, x, z); return Math.abs((x - mx) * fx + (z - mz) * fz) < half && Math.abs((x - mx) * -fz + (z - mz) * fx) < 3 ? v + h : v; };
  return () => { if (own) W.hAt = orig; else delete W.hAt; };
}
const lockT = (game) => game.view.lockTarget;
const isGround = (type) => walksOnGround({ type, def: ENEMY[type] });
/** simulate WP1's TP lock framing (view.feel.lockOn) for fn; restored after */
function withFraming(view, fn) {
  const keep = view.feel;
  view.feel = Object.assign(Object.create(keep || null), { lockOn() {} });
  try { return fn(); } finally { view.feel = keep; }
}
/** real-terrain steps: pairs of walkable points (x, z) → (x2, z2) whose ground differs by [lo, hi] m, ≥ 6 m apart */
function findSteps(W, lo, hi, want, start = -170) {
  const out = [];
  for (let z = start; z < 170 && out.length < want; z += 1) for (let x = -170; x < 170 && out.length < want; x += 1) {
    if (!W.walkable(x, z)) continue;
    const h = W.hAt(x, z);
    for (const [dx, dz] of [[1.4, 0], [0, 1.4], [1, 1], [-1, 1]]) {
      const x2 = x + dx, z2 = z + dz;
      if (!W.walkable(x2, z2)) continue;
      const dh = Math.abs(W.hAt(x2, z2) - h);
      if (dh >= lo && dh <= hi && out.length < want && !out.some((q) => Math.hypot(q.x - x, q.z - z) < 6)) out.push({ x, z, x2, z2, dh });
    }
  }
  return out;
}

export default function register(suite) {
  // ---------------------------------------------------------------------------------------------- wp4 (fast)
  suite('wp4', [
    // ---- sword volumes
    ['R6 matrix subset: each type — front A/B/C hit, side ±60° A/B hit, behind miss (1.5 m, level)', (t) => {
      const undo = noLunge(), bad = [];
      try {
        for (const type of TYPES) {
          const cells = [['A', 0, true], ['B', 0, true], ['C', 0, true], ['A', 60, true], ['A', -60, true], ['B', 60, true], ['B', -60, true], ['C', 60, false], ['A', 180, false], ['C', 180, false]];
          for (const [kind, rel, want] of cells) {
            const r = swing(t, { type, dist: 1.5, rel, kind, alt: ALT[type] });
            if (r.kind !== kind || r.hit !== want) bad.push({ type, kind, rel, want, got: r.hit, ran: r.kind });
          }
        }
      } finally { undo(); }
      t.note('bad', bad);
      t.eq(bad.length, 0, 'cells off the spec');
    }],
    ['bat at altitude 2.1, 1.5 m: missed level and below 15° of look-up; hit from ≈ 15.5° (A and B)', (t) => {
      const undo = noLunge(), rows = [];
      try {
        for (const kind of ['A', 'B']) for (const pitch of [0, 10, 14, 17, 25, 35]) {
          const r = swing(t, { type: 'bat', dist: 1.5, rel: 0, alt: 2.1, pitch, kind });
          rows.push({ kind, pitch, hit: r.hit });
          t.eq(r.hit, pitch >= 15, kind + ' at pitch ' + pitch);
        }
      } finally { undo(); }
      t.note('rows', rows);
    }],
    ['never whiffs on a slime that fills the crosshair (0.7–2.0 m, looking at it; A, B, C; with the lunge)', (t) => {
      const bad = [];
      for (const dist of [0.7, 1.0, 1.4, 1.8, 2.0]) for (const kind of ['A', 'B', 'C']) {
        const pitch = Math.atan2(0.37 - TV.eyeH, dist) * R2D;               // the slime's centre under the crosshair
        const r = swing(t, { type: 'slime', dist, rel: 0, pitch, kind });
        if (!r.hit) bad.push({ dist, kind, pitch: +pitch.toFixed(1) });
      }
      t.note('bad', bad);
      t.eq(bad.length, 0, 'whiffs');
    }],
    ['never hits up or down a wall-sized height difference (target 2.6 m above the feet / top 0.9 m below them)', (t) => {
      const undo = noLunge(), bad = [];
      try {
        for (const kind of ['A', 'C']) {
          for (const pitch of [0, 25, 45, 60]) { const r = swing(t, { type: 'slime', dist: 1.2, rel: 0, alt: 2.6, pitch, kind }); if (r.hit) bad.push({ kind, pitch, where: 'above' }); }
          for (const pitch of [0, -30, -50, -70]) { const r = swing(t, { type: 'slime', dist: 1.2, rel: 0, alt: -1.65, pitch, kind }); if (r.hit) bad.push({ kind, pitch, where: 'below' }); }
        }
        // a slope-sized step stays hittable: a slime sitting 0.6 m lower / 0.6 m higher, looked at
        const lo = swing(t, { type: 'slime', dist: 1.3, rel: 0, alt: -0.6, pitch: -35, kind: 'A' });
        const hi = swing(t, { type: 'slime', dist: 1.3, rel: 0, alt: 0.6, pitch: 10, kind: 'A' });
        t.ok(lo.hit && hi.hit, 'a 0.6 m step up / down is still hit', { lo: lo.hit, hi: hi.hit });
      } finally { undo(); }
      t.note('bad', bad);
      t.eq(bad.length, 0, 'hits through a wall height');
    }],
    ['real terrain (peaks cliffs ≥ 1.45 m): no walking critter (slime, mushroom, crab, snowpuff) across one is hit, up or down, A or C, with the real lunge; across a 0.5 m step it is', (t) => {
      const { W } = t, big = findSteps(W, 1.45, 3.0, 5), small = findSteps(W, 0.4, 0.6, 3), rows = [], bad = [];
      for (const q of big) for (const [from, to] of [[{ x: q.x, z: q.z }, { x: q.x2, z: q.z2 }], [{ x: q.x2, z: q.z2 }, { x: q.x, z: q.z }]]) {
        const up = W.hAt(to.x, to.z) > W.hAt(from.x, from.z);
        for (const type of ['slime', 'mushroom', 'crab', 'snowpuff']) for (const kind of ['A', 'C']) {
          const r = swing(t, { type, x: from.x, z: from.z, at: to, aim: true, kind });
          rows.push({ dh: +q.dh.toFixed(2), up, type, kind, hit: r.hit });
          if (r.hit) bad.push({ dh: +q.dh.toFixed(2), up, type, kind, from, to });
        }
      }
      for (const q of small) for (const type of ['slime', 'snowpuff']) {
        const r = swing(t, { type, x: q.x, z: q.z, at: { x: q.x2, z: q.z2 }, aim: true, kind: 'A' });
        rows.push({ dh: +q.dh.toFixed(2), type, kind: 'A', hit: r.hit, control: true });
        t.ok(r.hit, 'missed a ' + type + ' across a small ' + q.dh.toFixed(2) + ' m step', q);
      }
      t.note('rows', rows.filter((x) => x.hit || x.control)); t.note('bad', bad);
      t.eq(bad.length, 0, 'hits across a cliff');
      t.ok(big.length >= 4 && small.length >= 2, 'found steps', { big: big.length, small: small.length });
    }],
    ['wallBetween: a smooth rock bank (grade 0.9 for 1 m then 1.4, 1.46 m, slope ≥ 1: under 1:1 for most of it, as WP9\'s peaks summit bank) is a wall up and down; the same profile walkable, or just past the walk limit (0.87, which Pip slides around), is not; a 0.5 m bank is not', (t) => {
      const { game, W } = t, x0 = 0, z0 = 9.5;
      const own = { h: Object.prototype.hasOwnProperty.call(W, 'hAt'), s: Object.prototype.hasOwnProperty.call(W, 'slopeAt') }, hAt = W.hAt, slopeAt = W.slopeAt;
      const set = (top, slope) => {
        const prof = (u) => (u <= 0 ? 0 : u <= 1 ? 0.9 * u : u <= 1.4 ? 0.9 + 1.4 * (u - 1) : 1.46) * (top / 1.46);
        W.hAt = function (x, z) { const v = hAt.call(this, x, z); return Math.abs(z - z0) < 2 && x > x0 - 3 && x < x0 + 5 ? hAt.call(this, x0, z0) + prof(x - x0) : v; };
        W.slopeAt = function (x, z) { const u = x - x0; return Math.abs(z - z0) < 2 && u > 0.6 && u < 1.3 ? slope : slopeAt.call(this, x, z); };
      };
      const undo = () => { if (own.h) W.hAt = hAt; else delete W.hAt; if (own.s) W.slopeAt = slopeAt; else delete W.slopeAt; };
      const both = () => [game.wallBetween(x0, z0, x0 + 1.4, z0), game.wallBetween(x0 + 1.4, z0, x0, z0)];
      const rows = {};
      try {
        set(1.46, 1.05); rows.bank = [...both(), W.walkable(x0 + 0.9, z0)];
        set(1.46, 0.5); rows.walkable = both();
        set(1.46, 0.87); rows.nearLimit = both();
        set(0.5, 1.05); rows.low = both();
      } finally { undo(); }
      t.note('rows', rows);
      t.ok(rows.bank[0] && rows.bank[1] && rows.bank[2] === false, 'the 1.46 m rock bank is a wall up and down', rows.bank);
      t.ok(!rows.walkable[0] && !rows.walkable[1], 'the same profile, walkable: not a wall', rows.walkable);
      t.ok(!rows.nearLimit[0] && !rows.nearLimit[1], 'just past the walk limit (a steep slope): not a wall', rows.nearLimit);
      t.ok(!rows.low[0] && !rows.low[1], 'a 0.5 m bank: not a wall', rows.low);
    }],
    ['a slime down a steep walkable slope, under the crosshair, is hit (woods −58, −37: 1.68 m away, ≈ 1.3 m below)', (t) => {
      const { W } = t, q = { x: -58.03, z: -36.96, yaw: 1.325, d: 1.68 };
      const at = { x: q.x + Math.sin(q.yaw) * q.d, z: q.z + Math.cos(q.yaw) * q.d };
      const dh = W.hAt(at.x, at.z) - W.hAt(q.x, q.z);
      const rows = ['A', 'C'].map((kind) => ({ kind, hit: swing(t, { type: 'slime', x: q.x, z: q.z, at, aim: true, kind }).hit }));
      t.note('rows', { dh: +dh.toFixed(2), rows });
      t.ok(dh < -1.0, 'the spot is still a steep downhill', dh);
      t.ok(rows.every((r) => r.hit), 'hit', rows);
    }],
    ['line of sight: a collider or a terrain ridge between the eye and a slime blocks the swing', (t) => {
      const { W, pl } = t, undo = noLunge();
      try {
        const clear = swing(t, { type: 'slime', dist: 1.6, rel: 0, kind: 'A' });
        t.ok(clear.hit, 'clear: hit');
        let rm = null;
        const post = swing(t, { type: 'slime', dist: 1.6, rel: 0, kind: 'A', setup: (e) => { rm = tempCollider(W, (pl.pos.x + e.pos.x) / 2, (pl.pos.z + e.pos.z) / 2, 0.3, 1.6); } });
        rm();
        t.ok(!post.hit, 'a 1.6 m post in between: miss');
        let rr = null;
        const ridge = swing(t, { type: 'slime', dist: 1.6, rel: 0, kind: 'A', setup: (e) => { rr = tempRidge(W, pl.pos.x, pl.pos.z, e.pos.x, e.pos.z, 1.6); } });
        rr();
        t.ok(!ridge.hit, 'a terrain ridge in between: miss');
        let rb = null;
        const low = swing(t, { type: 'slime', dist: 1.6, rel: 0, kind: 'A', setup: (e) => { rb = tempRidge(W, pl.pos.x, pl.pos.z, e.pos.x, e.pos.z, 0.25); } });
        rb();
        t.ok(low.hit, 'a 25 cm lip in between: still hit');
      } finally { undo(); }
    }],
    ['line of sight by the trunk (real woods trees): a slime beside a trunk (its centre line inside the tree collider, its body in view) is hit; one wholly behind the trunk is not', (t) => {
      const { W } = t, rows = [], D2 = D2R;
      const trees = W.colliders.filter((c) => (c.kind === 'tree_round' || c.kind === 'tree_pine') && c.active !== false && c.y0 != null && W.regionAt(c.x, c.z) === W.regionAt(-60, -40));
      const flat = (ax, az, bx, bz) => { for (let k = 0; k <= 8; k++) { const x = ax + (bx - ax) * k / 8, z = az + (bz - az) * k / 8; if (!W.walkable(x, z) || Math.abs(W.hAt(x, z) - W.hAt(ax, az)) > 0.25) return false; } return true; };
      const others = (c, x, z, r) => W.nearColliders(x, z, r + 2, []).some((q) => q !== c && q.active && Math.hypot(q.x - x, q.z - z) < q.r + r);
      let beside = 0, behind = 0;
      for (const c of trees) {
        if (beside >= 3 && behind >= 3) break;
        const tr = trunkR(c);
        for (let a = 0; a < 6.28; a += 0.5) {
          const fx = Math.sin(a), fz = Math.cos(a), rx = -fz, rz = fx;
          if (beside < 3) {
            // the reviewers' set-up: Pip 0.32 m off the collider, the slime 1.85 m away, centre 4° inside the collider's silhouette
            const dT = c.r + 0.32, px = c.x - fx * dT, pz = c.z - fz * dT, b = Math.asin(Math.min(0.99, c.r / dT)) - 4 * D2;
            const sx = px + (fx * Math.cos(b) + rx * Math.sin(b)) * 1.85, sz = pz + (fz * Math.cos(b) + rz * Math.sin(b)) * 1.85;
            if (Math.hypot(sx - c.x, sz - c.z) >= c.r + 0.45 && flat(px, pz, sx, sz) && !others(c, px, pz, 0.35) && !others(c, sx, sz, 0.45)) {
              const r = swing(t, { type: 'slime', x: px, z: pz, at: { x: sx, z: sz }, kind: 'A', setup: (e) => { const hb = e.hurtbox({}); t.D.aimAt(sx + rx * 0.3, (hb.y0 + hb.y1) / 2, sz + rz * 0.3); t.frames(1); } });
              rows.push({ case: 'beside', tree: c.kind, r: +c.r.toFixed(2), trunk: +tr.toFixed(2), hit: r.hit });
              t.ok(r.hit, 'beside a ' + c.kind + ': hit', { px, pz, sx, sz });
              beside++;
              continue;
            }
          }
          if (behind < 3) {
            // the slime straight behind the trunk (inside the movement radius, only the trunk hides it), in reach
            const dT = c.r + 0.35, px = c.x - fx * dT, pz = c.z - fz * dT, dS = dT + tr + 0.47, sx = px + fx * dS, sz = pz + fz * dS;
            if (dS <= t.pl.reach + 0.42 - 0.05 && flat(px, pz, sx, sz) && !others(c, px, pz, 0.35) && !others(c, sx, sz, 0.45)) {
              const r = swing(t, { type: 'slime', x: px, z: pz, at: { x: sx, z: sz }, aim: true, kind: 'A' });
              rows.push({ case: 'behind', tree: c.kind, r: +c.r.toFixed(2), trunk: +tr.toFixed(2), dS: +dS.toFixed(2), hit: r.hit });
              t.ok(!r.hit, 'wholly behind a ' + c.kind + ' trunk: miss', { px, pz, sx, sz });
              behind++;
            }
          }
        }
      }
      t.note('rows', rows);
      t.ok(beside >= 3 && behind >= 2, 'found trees', { beside, behind });
    }],
    ['magnetism (feel T31): slime at 75° / 1.4 m — off miss, low hit, high 80° hit; the camera never moves', (t) => {
      const { settings, game, view } = t, undo = noLunge(), dev = game.input.lastDevice;
      try {
        game.input.lastDevice = 'keyboard';
        settings.set('aimAssist', 'off');
        const off = swing(t, { type: 'slime', dist: 1.4, rel: 75, kind: 'A' });
        settings.set('aimAssist', 'low');
        const yaw0 = view.yaw;
        const low = swing(t, { type: 'slime', dist: 1.4, rel: 75, kind: 'A', each: () => { if (Math.abs(view.yaw - yaw0) > 1e-9) t.ok(false, 'camera moved'); } });
        const low85 = swing(t, { type: 'slime', dist: 1.4, rel: 85, kind: 'A' });          // edge 68.3°: 13.3° out
        settings.set('aimAssist', 'high');
        const high80 = swing(t, { type: 'slime', dist: 1.4, rel: -80, kind: 'A' });        // edge 63.3°: 8.3° out
        const high100 = swing(t, { type: 'slime', dist: 1.4, rel: 100, kind: 'A' });       // edge 83.3°: 28.3° out
        settings.set('aimAssist', 'auto'); game.input.lastDevice = 'touch';
        const touch = swing(t, { type: 'slime', dist: 1.4, rel: 95, kind: 'A' });          // edge 78.3°: 23.3° out
        t.note('r', { off: off.hit, low: low.hit, low85: low85.hit, high80: high80.hit, high100: high100.hit, touch95: touch.hit });
        t.ok(!off.hit && low.hit && !low85.hit && high80.hit && !high100.hit && touch.hit, 'magnetism per setting');
        t.ok(low.ev && low.ev.magnet === true, 'HIT says magnet');
      } finally { undo(); settings.set('aimAssist', 'auto'); game.input.lastDevice = dev; }
    }],
    ['C chop: guard break (+1, no clink), knockback 9 vs 6.5 along the aim; A clinks a raised claw', (t) => {
      const undo = noLunge();
      try {
        const a = swing(t, { type: 'crab', dist: 1.3, rel: 0, face: true, state: 'windup', kind: 'A' });
        const c = swing(t, { type: 'crab', dist: 1.3, rel: 0, face: true, state: 'windup', kind: 'C', keep: true });
        const kc = c.e.knock.length();
        t.clearEnemies();
        t.ok(a.dmg === 0 && t.events(EV.CLINK).length > 0, 'A clinks', a.dmg);
        t.ok(c.hit && c.dmg === 1 + TC.dmgC, 'C breaks the guard, +1', c.dmg);
        const ab = swing(t, { type: 'mushroom', dist: 1.3, rel: 0, kind: 'A', keep: true });
        const kab = ab.e.knock.length();
        t.clearEnemies();
        t.note('knock', { C: +kc.toFixed(2), A: +kab.toFixed(2) });
        t.near(kc, TC.knockC, 0.6, 'C knock'); t.near(kab, TC.knockAB, 0.5, 'A knock');
        // a slime 35° off the aim flies mostly along the aim, not sideways out of the swing
        const s = swing(t, { type: 'mushroom', dist: 1.4, rel: 35, kind: 'A', keep: true });
        const kd = Math.atan2(s.e.knock.x, s.e.knock.y), aim = t.view.yaw, out = yawOf(s.e.pos.x - t.pl.pos.x, s.e.pos.z - t.pl.pos.z);
        t.clearEnemies();
        t.note('dirDeg', { knock: +(angDiff(aim, kd) * R2D).toFixed(1), outward: +(angDiff(aim, out) * R2D).toFixed(1) });
        t.ok(Math.abs(angDiff(aim, kd)) < 18 * D2R, 'knockback leans along the aim');
      } finally { undo(); }
    }],
    ['crab guard keeps its meaning (Pip is the hit source): a crab facing Pip within the guard is never damaged by A/B, even at the arc edge with magnetism; knockback still along the aim', (t) => {
      const { game, D, settings } = t, dev = game.input.lastDevice, bad = [], rows = [];
      try {
        // windup, facing Pip + phi, at bearing theta, 1.2 m, assist off (the reviewers' table)
        for (const phi of [-50, -35, 0, 35, 50]) for (const theta of [-40, -20, 0, 20, 40]) {
          const r = swing(t, { type: 'crab', dist: 1.2, rel: theta, face: true, state: 'windup', kind: 'A', setup: (e) => { e.facing = e.prevFacing = e.facing + phi * D2R; e.st = 99; } });
          if (r.dmg > 0) bad.push({ phi, theta });
        }
        // charging at 1.0 m, 85° / 88° off the aim, aim assist auto + mouse (10° magnetism)
        settings.set('aimAssist', 'auto'); game.input.lastDevice = 'mouse';
        for (const rel of [80, 85, 88, -85]) {
          const r = swing(t, { type: 'crab', dist: 1.0, rel, face: true, state: 'charge', kind: 'A', setup: (e) => { e.st = 99; } });
          rows.push({ rel, dmg: r.dmg });
          if (r.dmg > 0) bad.push({ charge: rel });
        }
      } finally { settings.set('aimAssist', 'off'); game.input.lastDevice = dev; }
      t.note('rows', rows); t.note('bad', bad);
      t.eq(bad.length, 0, 'guard ignored');
    }],
    ['events: HIT { swing, swingId, x/y/z, contactT, knock }, KILL { swing }, CLINK { kind }; hp never < 0; HUD fields', (t) => {
      const { game } = t, undo = noLunge();
      try {
        game.S.swordLevel = 2; t.pl.setSword(2);
        const r = swing(t, { type: 'bat', dist: 1.4, rel: 0, alt: 1.2, kind: 'C', keep: true });
        const e = r.e;
        const ev = r.ev, kill = t.events(EV.KILL)[0];
        t.ok(ev && ev.swing === 'C' && Number.isFinite(ev.x + ev.y + ev.z) && ev.swingId === t.pl.swingId, 'HIT payload', ev && { swing: ev.swing, id: ev.swingId });
        t.ok(ev && ev.contactT >= TC.winC[0] - 1e-6 && ev.contactT <= TC.winC[1], 'contactT in the window', ev && ev.contactT);
        t.ok(ev && Number.isFinite(ev.knockX) && Math.abs(Math.hypot(ev.knockX, ev.knockZ) - 1) < 1e-6, 'knock dir unit');
        t.ok(kill && kill.swing === 'C' && kill.target === e, 'KILL carries the swing kind', kill && kill.swing);
        // C5: WP5 names its enemies (ENEMY.bat.name); hudFields only fills a missing name
        t.ok(e.hp === 0 && e.maxHp === 1 && e.name === (ENEMY.bat.name || 'Bat') && typeof e.name === 'string', 'hp clamped 0, maxHp, name', { hp: e.hp, maxHp: e.maxHp, name: e.name, want: ENEMY.bat.name });
      } finally { undo(); game.S.swordLevel = 1; t.pl.setSword(1); t.clearEnemies(); }
    }],
    ['contact feedback: one FP punch per hit (WP1\'s, on EV.HIT: A yaw ≤ 0.6°, FOV ≥ −1.5) — combat never kicks the view or punches the FOV itself; "Speed effects" off leaves the FP camera still; a TP hit adds trauma', (t) => {
      const { game, view, settings, THREE } = t, undo = noLunge(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
      const calls = { kick: 0, fov: 0 }, k0 = view.kick, f0 = view.fovPunch, rows = {};
      view.kick = function (...a) { calls.kick++; return k0.apply(this, a); };
      view.fovPunch = function (...a) { calls.fov++; return f0.apply(this, a); };
      const peak = { yaw: 0, fov: 0 };
      const each = () => {
        eu.setFromQuaternion(game.camera.quaternion, 'YXZ');
        const dy = angDiff(view.yaw, eu.y - Math.PI) * R2D, df = game.camera.fov - view.baseFov();
        if (Math.abs(dy) > Math.abs(peak.yaw)) peak.yaw = dy;
        if (df < peak.fov) peak.fov = df;
      };
      try {
        settings.set('shake', 0);
        for (const fx of [1, 0]) {
          settings.set('speedFx', fx); peak.yaw = 0; peak.fov = 0;
          const r = swing(t, { type: 'slime', dist: 1.4, rel: 0, kind: 'A', each });
          for (let i = 0; i < 6; i++) { t.frames(1); each(); }
          rows['speedFx' + fx] = { hit: r.hit, yaw: +peak.yaw.toFixed(3), fov: +peak.fov.toFixed(3) };
          t.ok(r.hit, 'hit (speedFx ' + fx + ')');
        }
        t.eq(calls.kick + calls.fov, 0, 'combat added no kick / fovPunch of its own');
        const a = rows.speedFx1, z = rows.speedFx0;
        t.ok(a.yaw > 0.3 && a.yaw <= 0.62 && a.fov < -0.5 && a.fov >= -1.6, 'one punch: A yaws ≤ 0.6° left along the sweep, FOV ≥ −1.5', a);
        t.ok(Math.abs(z.yaw) < 0.02 && Math.abs(z.fov) < 0.05, 'Speed effects off: no hit punch', z);
        settings.set('shake', 1); settings.set('speedFx', 1);
        t.D.setView('tp'); t.frames(2); view.shk.reset();
        let tr = 0;
        const r = swing(t, { type: 'slime', dist: 1.4, rel: 0, kind: 'A', each: () => { tr = Math.max(tr, view.shk.trauma); } });
        rows.tp = { hit: r.hit, trauma: +tr.toFixed(3) };
        t.ok(r.hit && tr > 0.05, 'TP: the hit adds trauma', rows.tp);
      } finally { view.kick = k0; view.fovPunch = f0; undo(); settings.set('speedFx', 1); settings.set('shake', 1); t.D.setView('fp'); }
      t.note('rows', rows);
    }],
    ['feel T25: a slime 1.9 m dead ahead is hit when attackT = 66.7 ms; contactT at its right edge (a = −12.5°)', (t) => {
      const undo = noLunge();
      try {
        const r = swing(t, { type: 'slime', dist: 1.9, rel: 0, kind: 'A' });
        const w = Math.atan(0.42 / 1.9), [s0, s1] = TC.sweepAB, k = (-w + TC.arc * D2R) / (2 * TC.arc * D2R);
        const want = s0 + (s1 - s0) * (1 - Math.cbrt(1 - k));
        t.near(r.hitT, 4 / 60, 1e-6, 'hit step');
        t.near(r.contactT, want, 1e-6, 'contactT');
        t.note('contactMs', +(r.contactT * 1000).toFixed(2));
      } finally { undo(); }
    }],
    ['feel T26: slimes at ±40° (1.5 m): A hits the right one at 50 ms and the left at 83.3 ms; B the reverse', (t) => {
      const { game, D, pl } = t, undo = noLunge();
      try {
        for (const kind of ['A', 'B']) {
          t.clearEnemies(); t.resetPlayer();
          D.teleport(0, 9.5, 0, 0); t.frames(1);
          D.spawn('slime', 1.5, 40); const L = D.last; D.spawn('slime', 1.5, -40); const R = D.last;
          if (kind === 'B') { pl.combo = 'A'; pl.chainT = 0; }
          const at = new Map();
          const off = game.events.on(EV.HIT, (p) => { if (!at.has(p.target)) at.set(p.target, pl.attackT); });
          t.press('attack');
          try { for (let i = 0; i < 25; i++) t.frames(1); } finally { off(); }
          const first = kind === 'A' ? R : L, second = kind === 'A' ? L : R;
          t.near(at.get(first), 3 / 60, 1e-6, kind + ' first side at 50 ms');
          t.near(at.get(second), 5 / 60, 1e-6, kind + ' second side at 83.3 ms');
        }
      } finally { undo(); t.clearEnemies(); }
    }],
    ['airborne: the volume follows the feet (pure swordTest, feet 0.85 m up): a slime below is hit looking level', (t) => {
      const s = { kind: 'A', ex: 0, ey: 0.85 + TV.eyeH, ez: 0, feet: 0.85, yaw: 0, pitch: 0, reach: 1.6, t0: 0.05, t1: 0.0667 };
      const slime = { x: 0, z: 1.4, r: 0.42, y0: 0, y1: 0.74 }, bat = { x: 0, z: 1.4, r: 0.38, y0: 1.8, y1: 2.48 };
      t.ok(swordTest(slime, { ...s }), 'slime below hit in the air');
      t.ok(swordTest(bat, { ...s }), 'a bat at 2.1 is level with the jumping eye: hit');
      t.ok(!swordTest(bat, { ...s, ey: TV.eyeH, feet: 0 }), 'the same bat from the ground, level: miss');
    }],
    ['TP: a locked bat at 2.1 m is hit with the camera level (swings aim at the lock point)', (t) => {
      const { D, game } = t, undo = noLunge();
      try {
        D.setView('tp');
        const r = swing(t, { type: 'bat', dist: 1.6, rel: 0, alt: 2.1, pitch: -6, kind: 'A', setup: (e) => { game.setLock(e, 'debug'); t.frames(1); } });
        const r0 = swing(t, { type: 'bat', dist: 1.6, rel: 0, alt: 2.1, pitch: -6, kind: 'A' });
        t.ok(r.hit, 'locked: hit'); t.ok(!r0.hit, 'not locked: miss');
      } finally { undo(); game.releaseLock(); }
    }],
    // ---- lock-on (C1)
    ['lock-on: Q picks the enemy nearest the crosshair, emits EV.LOCK, sets view.lockTarget; Q again releases', (t) => {
      const { D, game, view } = t;
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('slime', 6, 30); const a = D.last; D.spawn('mushroom', 5, 4); const b = D.last; D.spawn('bat', 4, 150); t.frames(2);
      D.clearEvents();
      t.press('lockOn'); t.frames(1);
      t.eq(view.lockTarget, b, 'picked the one at 4°');
      const ev = t.events(EV.LOCK)[0];
      t.ok(ev && ev.target === b && ev.prev === null, 'EV.LOCK { target, prev }');
      t.ok(b.maxHp > 0 && typeof b.name === 'string', 'HUD fields on the locked enemy');
      t.press('lockOn'); t.frames(1);
      t.eq(view.lockTarget, null, 'released');
      const ev2 = t.events(EV.LOCK)[1];
      t.ok(ev2 && ev2.target === null && ev2.prev === b, 'EV.LOCK on release');
      t.ok(a, 'spawned');
    }],
    ['lock-on: hold (RMB / LT) locks while held; lockMode hold makes Q hold-to-lock', (t) => {
      const { D, view, settings } = t;
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('slime', 5, 0); const e = D.last; t.frames(1);
      D.hold('lockHold'); t.frames(3);
      t.eq(view.lockTarget, e, 'held: locked');
      D.release('lockHold'); t.frames(2);
      t.eq(view.lockTarget, null, 'released: unlocked');
      settings.set('lockMode', 'hold');
      try {
        D.hold('lockOn'); t.frames(3);
        t.eq(view.lockTarget, e, 'Q held: locked');
        D.release('lockOn'); t.frames(2);
        t.eq(view.lockTarget, null, 'Q released: unlocked');
      } finally { settings.set('lockMode', 'toggle'); }
    }],
    ['lock-on breaks: beyond 22 m, after 1 s without LOS, FP look > 40° away for 0.35 s, held or released (a look-away inside 40° eases back: kept)', (t) => {
      const { D, game, view, W, pl, settings } = t;
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('slime', 8, 0); const e = D.last; t.frames(1);
      game.setLock(e, 'toggle'); t.frames(2);
      e.pos.x = pl.pos.x; e.pos.z = pl.pos.z + 23; e.prev.copy(e.pos); t.frames(2);
      t.eq(view.lockTarget, null, 'beyond 22 m');
      e.pos.x = pl.pos.x; e.pos.z = pl.pos.z + 8; e.prev.copy(e.pos);
      game.setLock(e, 'toggle'); t.frames(1);
      const rm = tempRidge(W, pl.pos.x, pl.pos.z, e.pos.x, e.pos.z, 3, 0.4);
      try {
        t.frames(50); t.eq(view.lockTarget, e, 'still locked after 0.83 s without LOS');
        t.frames(15); t.eq(view.lockTarget, null, 'broken after 1 s without LOS');
      } finally { rm(); }
      // FP: the look > 40° away for 0.35 s breaks it (feel §8.8, RULINGS "Lock-on"). First with live mouse input, one
      // count per frame further away
      const off = () => { const p = game.lockPoint(e), q = view.simEye(); return Math.abs(angDiff(view.yaw, yawOf(p.x - q.x, p.z - q.z))) * R2D; };
      const relock = () => { const p = game.lockPoint(e); D.aimAt(p.x, p.y, p.z); t.frames(1); game.setLock(e, 'toggle'); t.frames(2); };
      relock();
      D.look(view.yaw + 60 * D2R, 0);
      for (let i = 0; i < 18; i++) { D.lookDelta(-1, 0, { single: true }); t.frames(1); }
      t.eq(view.lockTarget, e, 'held away 0.3 s: kept');
      for (let i = 0; i < 6; i++) { D.lookDelta(-1, 0, { single: true }); t.frames(1); }
      t.eq(view.lockTarget, null, 'held away > 0.35 s: broken');
      // merged with WP1 (round 2): its soft lock never pulls a look back out of the break zone, so a RELEASED 60°
      // look-away stays where the player put it and the lock drops after 0.35 s like a held one (no rubber band)
      relock();
      D.look(view.yaw + 60 * D2R, 0);
      t.frames(18); t.ok(view.lockTarget === e && off() > 50, 'released 60° look-away, 0.3 s: kept, view not dragged back', off());
      t.frames(6); t.ok(view.lockTarget === null && off() > 50, 'released 60° look-away > 0.35 s: broken, view where the player left it', off());
      { const y0 = view.yaw; t.frames(20); t.ok(Math.abs(angDiff(view.yaw, y0)) * R2D < 0.1, 'r3: after the break nothing turns the view (no late ease)', +(angDiff(view.yaw, y0) * R2D).toFixed(3)); }
      // a released look-away INSIDE the 40° zone is the soft lock's job: the view eases back and the lock is kept
      relock();
      D.look(view.yaw + 30 * D2R, 0);
      const tr = [];
      for (let i = 0; i < 40; i++) { t.frames(1); if (i % 4 === 3) tr.push(+off().toFixed(1)); }
      t.note('released 30°', tr);
      t.ok(view.lockTarget === e && off() < 10, 'released 30° look-away: eased back, kept', tr);
      // with "Lock-on turns the camera" off nothing eases the view: a released look-away past 40° breaks it after 0.35 s
      settings.set('lockTurnsCamera', false);
      try {
        relock();
        D.look(view.yaw + 60 * D2R, 0);
        t.frames(18); t.eq(view.lockTarget, e, 'lockTurnsCamera off, looked away 0.3 s: kept');
        t.frames(6); t.eq(view.lockTarget, null, 'lockTurnsCamera off, looked away > 0.35 s: broken');
      } finally { settings.set('lockTurnsCamera', true); }
    }],
    ['lock-on: a dead target hands over to the nearest within 8 m / ±60°, else unlocks', (t) => {
      const { D, game, view } = t;
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('slime', 4, 0); const a = D.last; D.spawn('slime', 6, 25); const b = D.last; D.spawn('slime', 5, 120); t.frames(1);
      game.setLock(a, 'toggle'); t.frames(1);
      a.hp = 0; a.alive = false; t.frames(2);
      t.eq(view.lockTarget, b, 'handed over to the one in front');
      b.hp = 0; b.alive = false; t.frames(2);
      t.eq(view.lockTarget, null, 'the last one is behind: unlocked');
    }],
    ['FP: lock pressed while another enemy sits nearer the crosshair switches; TP mouse flick switches sides', (t) => {
      const { D, game, view } = t;
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('slime', 6, 25); const a = D.last; D.spawn('slime', 6, -25); const b = D.last; t.frames(1);
      game.setLock(a, 'toggle'); t.frames(1);
      D.look(view.yaw - 25 * D2R, 0); t.frames(1);                                    // now looking at b
      t.press('lockOn'); t.frames(1);
      t.eq(view.lockTarget, b, 'switched to the one under the crosshair');
      D.setView('tp'); D.look(view.yaw + 25 * D2R, -6 * D2R); t.frames(3);
      withFraming(view, () => {                                                      // WP1 frames the TP lock
        game.setLock(b, 'toggle'); t.frames(1);
        D.lookDelta(-80, 0, { single: true }); t.frames(1);                           // flick left: b is the right one → a
        t.eq(view.lockTarget, a, 'flick left switched to the left target');
      });
    }],
    ['TP with WP1\'s framing: a slow mouse pan (< 45 counts / 0.12 s) keeps the lock, a flick switches it, the near fallback locks anywhere; with "Lock-on turns the camera" off (no framing) a pan never switches, nothing behind the camera is locked, a lock far off camera breaks', (t) => {
      const { D, game, view, settings } = t;
      D.setView('tp'); D.pose('meadow'); D.look(0, -6 * D2R); t.frames(3);
      D.spawn('slime', 6, 0); const a = D.last; D.spawn('slime', 7, 20); D.spawn('slime', 7, -20); const R = D.last; t.frames(2);
      game.setLock(a, 'toggle'); t.frames(10);
      t.ok(game.lockFramed(), 'WP1 frames TP locks');
      for (let i = 0; i < 30; i++) { D.lookDelta(-5, 0, { single: true }); t.frames(1); }        // 36 counts / 0.12 s
      t.eq(view.lockTarget, a, 'framed: a slow pan kept the target');
      D.lookDelta(80, 0, { single: true }); t.frames(1);                                      // a flick right
      t.eq(view.lockTarget, R, 'framed: a flick right switched to the right target');
      game.releaseLock(); t.clearEnemies();
      D.look(0, -6 * D2R); t.frames(2);
      D.spawn('slime', 4, 180); const b2 = D.last; t.frames(2);
      t.press('lockOn'); t.frames(2);
      t.eq(view.lockTarget, b2, 'framed: the near fallback locks anywhere (feel §8.8)');
      game.releaseLock(); t.clearEnemies();
      settings.set('lockTurnsCamera', false);
      let back = null;
      try {
        t.ok(!game.lockFramed(), 'setting off: no framing');
        D.look(0, -6 * D2R); t.frames(2);
        D.spawn('slime', 6, 0); const a2 = D.last; D.spawn('slime', 7, 20); D.spawn('slime', 7, -20); t.frames(2);
        game.setLock(a2, 'toggle'); t.frames(1);
        for (let i = 0; i < 30; i++) { D.lookDelta(-12, 0, { single: true }); t.frames(1); }    // a 90°/s pan at sens 1
        t.eq(view.lockTarget, a2, 'pan kept the target');
        game.releaseLock(); t.clearEnemies();
        D.look(0, -6 * D2R); t.frames(2);
        D.spawn('slime', 4, 180); back = D.last; t.frames(2);
        t.press('lockOn'); t.frames(2);
        t.eq(view.lockTarget, null, 'nothing locked behind the camera');
        t.clearEnemies(); D.spawn('slime', 4, 90); const side = D.last; t.frames(2);
        t.press('lockOn'); t.frames(2);
        t.eq(view.lockTarget, side, 'the near fallback still locks one beside Pip (≈ 57° off the camera)');
        D.look(view.yaw - 100 * D2R, -6 * D2R); t.frames(30);
        t.eq(view.lockTarget, null, 'held > 70° off camera for 0.35 s: unlocked');
      } finally { settings.set('lockTurnsCamera', true); game.releaseLock(); }
      t.ok(back, 'spawned');
    }],
    ['TP lock flick with the look inverted left / right: the pick follows the hand (mouse right, stick right → the target on the right)', (t) => {
      const { D, game, view, settings } = t, got = {};
      try {
        withFraming(view, () => {
          for (const dev of ['mouse', 'stick']) {
            D.setView('tp'); D.pose('meadow'); D.look(0, -6 * D2R); t.frames(3); t.clearEnemies();
            D.spawn('slime', 6, 0); const a = D.last; D.spawn('slime', 6, 30); const L = D.last; D.spawn('slime', 6, -30); const R = D.last; t.frames(2);
            game.setLock(a, 'toggle'); t.frames(2);
            settings.set(dev === 'mouse' ? 'invertX' : 'padInvertX', true);
            D.pad(0, 0); t.frames(30);
            if (dev === 'mouse') { D.lookDelta(80, 0, { single: true }); t.frames(1); } else { D.pad(0.95, 0); t.frames(1); }
            D.pad(0, 0); t.frames(2); D.pad(null);
            const now = view.lockTarget;
            got[dev] = now === a ? 'same' : now === L ? 'L' : now === R ? 'R' : String(now);
            settings.set('invertX', false); settings.set('padInvertX', false); game.releaseLock();
          }
        });
      } finally { settings.set('invertX', false); settings.set('padInvertX', false); D.pad(null); }
      t.note('flick', got);
      t.eq(got.mouse, 'R', 'invertX: a mouse flick right');
      t.eq(got.stick, 'R', 'padInvertX: a stick flick right');
    }],
    ['TP pad flick (with the framing): only a horizontal push switches; (±0.03…0.1, −0.95), (0.05, +0.95) never do', (t) => {
      const { D, game, view } = t, rows = [];
      withFraming(view, () => {
        for (const [rx, ry, want] of [[0, -0.95, 'same'], [0.03, -0.95, 'same'], [-0.03, -0.95, 'same'], [0.1, -0.9, 'same'], [-0.1, -0.9, 'same'], [0.05, 0.95, 'same'], [0.95, 0, 'R'], [-0.95, 0, 'L'], [0.9, -0.3, 'R']]) {
          D.setView('tp'); D.pose('meadow'); D.look(0, -6 * D2R); t.frames(3); t.clearEnemies();
          D.spawn('slime', 6, 0); const a = D.last; D.spawn('slime', 6, 30); const L = D.last; D.spawn('slime', 6, -30); const R = D.last; t.frames(2);
          game.setLock(a, 'toggle'); t.frames(2);
          D.pad(0, 0); t.frames(30); D.pad(rx, ry); t.frames(1); D.pad(0, 0); t.frames(2); D.pad(null);
          const now = view.lockTarget, got = now === a ? 'same' : now === L ? 'L' : now === R ? 'R' : String(now);
          rows.push({ rx, ry, got });
          t.eq(got, want, 'stick (' + rx + ', ' + ry + ')');
          game.releaseLock();
        }
      });
      t.note('rows', rows);
    }],
    ['TP lock pick and friction come from the crosshair ray (camera), not Pip\'s eye: two slimes 0.7 m apart, the one under the crosshair is picked; friction fires on it', (t) => {
      const { D, game, view } = t, rows = [];
      t.settings.set('aimAssist', 'auto');
      for (const mode of ['tp', 'fp']) for (const dist of [3, 5, 8]) for (const side of [1, -1]) {
        game.releaseLock(); D.setView(mode); D.pose('meadow'); t.frames(3); t.clearEnemies();
        const pl = t.pl, yaw0 = view.yaw, fx = Math.sin(yaw0), fz = Math.cos(yaw0), rx = -Math.cos(yaw0), rz = Math.sin(yaw0);
        const ax = pl.pos.x + fx * dist, az = pl.pos.z + fz * dist, bx = ax + rx * 0.7 * side, bz = az + rz * 0.7 * side;
        const A = new Enemy('slime', ax, az); A.spawnT = 1; game.addEnemy(A);
        const B = new Enemy('slime', bx, bz); B.spawnT = 1; game.addEnemy(B); t.frames(2);
        const pa = game.lockPoint(A); D.aimAt(pa.x, pa.y, pa.z); t.frames(2);
        t.press('lockOn'); t.frames(2);
        const pick = view.lockTarget === A ? 'A' : view.lockTarget === B ? 'B' : 'none';
        game.releaseLock(); t.clearEnemies();
        rows.push({ mode, dist, side, pick });
        t.eq(pick, 'A', mode + ' ' + dist + ' m, B ' + (side > 0 ? 'right' : 'left'));
      }
      // friction: crosshair on a slime 3 / 5 m ahead in TP
      for (const dist of [3, 5]) {
        D.setView('tp'); D.pose('meadow'); t.frames(3); t.clearEnemies();
        D.spawn('slime', dist, 0); const e = D.last; t.frames(2);
        const p = game.lockPoint(e); D.aimAt(p.x, p.y, p.z); t.frames(2);
        const y0 = view.yaw; D.pad(0.5, 0); t.frames(1); D.pad(null);
        const over = Math.abs(angDiff(y0, view.yaw));
        t.clearEnemies(); D.look(y0, view.pitch); t.frames(1);
        const y1 = view.yaw; D.pad(0.5, 0); t.frames(1); D.pad(null);
        const free = Math.abs(angDiff(y1, view.yaw));
        rows.push({ friction: dist, ratio: +(over / free).toFixed(3) });
        t.near(over / free, TC.friction, 0.02, 'TP friction on the slime under the crosshair at ' + dist + ' m');
      }
      t.note('rows', rows);
    }],
    ['TP lock: the body faces the target, the wish strafes around it, swings latch its bearing (C1 intent hook)', (t) => {
      const { D, game, pl, view } = t;
      D.setView('tp');
      D.pose('meadow'); D.look(0, -6 * D2R); t.frames(1);
      D.spawn('mushroom', 5, 20); const e = D.last; t.frames(1);
      game.setLock(e, 'toggle');
      t.move(1, 0); t.frames(40); t.move(0, 0); t.frames(25);
      const want = yawOf(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
      t.ok(Math.abs(angDiff(pl.facing, want)) < 4 * D2R, 'body faces the target', angDiff(pl.facing, want) * R2D);
      t.press('attack'); t.frames(2);
      t.ok(Math.abs(angDiff(pl.swingYaw, yawOf(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z))) < 3 * D2R, 'swing latched at the target');
      // C1: WP1 frames the lock (the camera turned to it): the target and Pip both on screen
      const st = view.worldToScreen(game.lockPoint(e), {}), sp = view.worldToScreen({ x: pl.pos.x, y: pl.pos.y + 0.5, z: pl.pos.z }, {});
      t.ok(Math.abs(angDiff(view.yaw, 0)) > 2 * D2R, 'the camera follows the lock (WP1)', angDiff(view.yaw, 0) * R2D);
      t.ok(st.onScreen && sp.onScreen && Math.abs(st.ndcX) < 0.8 && Math.abs(sp.ndcX) < 0.8, 'target and Pip framed', { target: [st.ndcX, st.ndcY], pip: [sp.ndcX, sp.ndcY] });
      game.releaseLock();
    }],
    ['TP lock (WP1 framing): W walks at the target and stops at contact without orbiting it; D at contact circles it at ≤ lockOrbit °/s; S backs off; D further out circles at a steady radius at the strafe speed', (t) => {
      const { D, game, pl, view } = t;
      D.setView('tp'); D.pose('meadow'); D.look(0, -6 * D2R); t.frames(3);
      D.spawn('slime', 6, 0); const e = D.last; t.frames(2);
      game.setLock(e, 'toggle'); t.frames(20);
      const bear = () => yawOf(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z), dist = () => Math.hypot(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
      // W for 3 s: approach, then stand at contact (the camera settles: WP1 keeps the target on the crosshair, its
      // shoulder parallax turns it once on the way in)
      t.move(0, 1);
      let swept = 0, camSwept = 0, camLate = 0, pb = bear(), cy = view.yaw;
      for (let i = 0; i < 180; i++) { t.frames(1); swept += Math.abs(angDiff(pb, bear())); pb = bear(); const dc = Math.abs(angDiff(cy, view.yaw)); camSwept += dc; if (i >= 120) camLate += dc; cy = view.yaw; }
      const wDist = dist();
      t.note('W', { dist: +wDist.toFixed(2), orbitDeg: +(swept * R2D).toFixed(1), camDeg: +(camSwept * R2D).toFixed(1), camLastSecond: +(camLate * R2D).toFixed(2) });
      t.ok(wDist < 1.0 && wDist > 0.42 + pl.r - 0.1, 'W reached the target and stopped at contact (not inside it)', wDist);
      t.ok(swept * R2D < 10, 'no orbit: Pip\'s bearing from the target barely turns', swept * R2D);
      t.ok(camSwept * R2D < 90 && camLate * R2D < 2, 'the camera turns once on the way in, then holds still (no spin)', { cam: camSwept * R2D, last: camLate * R2D });
      t.ok(view.lockTarget === e, 'still locked');
      // S for 0.8 s (from a standstill, back the way Pip came): backs off along the line
      t.move(0, 0); t.frames(20);
      t.move(0, -1); const bs = bear(), d0 = dist(); t.frames(48);
      t.ok(dist() > d0 + 1.5 && Math.abs(angDiff(bs, bear())) < 10 * D2R, 'S backs off', { d: dist(), turn: angDiff(bs, bear()) * R2D });
      // D for 2 s further out (from a standstill): circles at a steady radius at about the strafe speed
      t.move(0, 0); t.frames(20);
      const r0 = dist(); let rmin = r0, rmax = r0; swept = 0; pb = bear();
      t.move(1, 0);
      for (let i = 0; i < 120; i++) { t.frames(1); rmin = Math.min(rmin, dist()); rmax = Math.max(rmax, dist()); swept += angDiff(pb, bear()); pb = bear(); }
      const rate = Math.abs(swept * R2D) / 2, want = Math.min(TC.lockOrbit, (4.4 * 0.95 / r0) * R2D);
      t.note('D', { r0: +r0.toFixed(2), rmin: +rmin.toFixed(2), rmax: +rmax.toFixed(2), degPerS: +rate.toFixed(1), want: +want.toFixed(1), facing: +(angDiff(pl.facing, yawOf(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z)) * R2D).toFixed(1) });
      t.ok(rmax - rmin < 0.06 * r0, 'D circles at a steady radius', { r0, rmin, rmax });
      t.ok(rate > want * 0.85 && rate < want * 1.1, 'D circles at about the strafe speed', { rate, want });
      t.ok(Math.abs(angDiff(pl.facing, yawOf(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z))) < 15 * D2R, 'the body faces the target (λ 12 lag)');
      // back to contact (W), then D for 1 s there: circles it, capped at lockOrbit °/s, and stays at contact
      t.move(0, 1); t.frames(60); t.move(0, 0); t.frames(10);
      let s1 = 0, cs = 0; pb = bear(); cy = view.yaw;
      t.move(1, 0);
      for (let i = 0; i < 60; i++) { t.frames(1); s1 += angDiff(pb, bear()); pb = bear(); cs += Math.abs(angDiff(cy, view.yaw)); cy = view.yaw; }
      t.move(0, 0);
      t.note('Dcontact', { degPerS: +(Math.abs(s1) * R2D).toFixed(1), camDegPerS: +(cs * R2D).toFixed(1), d: +dist().toFixed(2) });
      t.ok(Math.abs(s1) * R2D > 60 && Math.abs(s1) * R2D <= TC.lockOrbit * 1.05, 'D at contact: circles it at ≤ lockOrbit °/s', Math.abs(s1) * R2D);
      t.ok(dist() < 1.0, 'D at contact: stays at the target', dist());
      game.releaseLock();
    }],
    ['boss fights: one press locks the boss in each arena (arch accept 6); autoLockBosses on / auto+pad lock it, auto+mouse not', (t) => {
      const { D, game, view, settings } = t, dev = game.input.lastDevice, rows = {};
      try {
        for (const id of ['woods', 'peaks', 'shores']) {
          if (game.S.bosses[id]) continue;
          if (game.fight) game.endFight(true);
          D.cutscene('bossIntro', id); t.frames(160);
          if (!game.fight || game.fight.phase !== 'fight') { t.ok(false, 'fight did not start ' + id); continue; }
          D.look(view.yaw + 150 * D2R, 0); t.frames(1);              // even looking away
          t.press('lockOn'); t.frames(1);
          rows[id] = view.lockTarget === game.fight.boss;
          t.ok(rows[id], 'boss locked in one press: ' + id);
          game.endFight(true); t.frames(1);
          t.eq(view.lockTarget, null, 'fight end releases ' + id);
        }
        const auto = (mode, device) => {
          settings.set('autoLockBosses', mode); game.input.lastDevice = device;
          if (game.fight) game.endFight(true);
          D.cutscene('bossIntro', 'woods'); t.frames(160);
          const got = !!(game.fight && view.lockTarget === game.fight.boss);
          if (game.fight) game.endFight(true);
          t.frames(1);
          return got;
        };
        rows.on = auto('on', 'mouse'); rows.autoPad = auto('auto', 'pad'); rows.autoMouse = auto('auto', 'mouse'); rows.off = auto('off', 'pad');
        t.ok(rows.on && rows.autoPad && !rows.autoMouse && !rows.off, 'autoLockBosses', rows);
      } finally { settings.set('autoLockBosses', 'auto'); game.input.lastDevice = dev; if (game.fight) game.endFight(true); }
      t.note('rows', rows);
    }],
    ['aim friction: pad look over an enemy runs at ×0.6, mouse look never', (t) => {
      const { D, view } = t;
      t.settings.set('aimAssist', 'auto');
      D.pose('meadow'); D.look(0, 0); t.frames(1);
      D.spawn('mushroom', 5, 0); const e = D.last; t.frames(1);
      const p = t.game.lockPoint(e); D.lookAt(p.x, p.y, p.z); t.frames(1);
      const y0 = view.yaw; D.pad(0.6, 0); t.frames(1); D.pad(null);
      const over = Math.abs(angDiff(y0, view.yaw));
      t.clearEnemies(); D.look(y0, view.pitch); t.frames(1);
      const y1 = view.yaw; D.pad(0.6, 0); t.frames(1); D.pad(null);
      const free = Math.abs(angDiff(y1, view.yaw));
      t.note('deg', { over: +(over * R2D).toFixed(3), free: +(free * R2D).toFixed(3) });
      t.near(over / free, TC.friction, 0.02, 'friction ratio');
    }],
    // ---- interaction
    ['feel T40 / arch accept 3: Shellby at 1.6 m "Talk · Elder Shellby" (key token); 25° away null in ≤ 150 ms; back in 1 frame', (t) => {
      const { D, view } = t;
      D.standAt('shellby', 0, { dist: 1.6 }); t.frames(2);
      const tg = D.target();
      t.eq(tg && tg.label, 'Talk · Elder Shellby', 'label');
      t.eq(t.game.target && t.game.target.key, '{interact}', 'key token (C7)');
      const y = view.yaw, p = view.pitch;
      D.look(y + 25 * D2R, p); let n = 0;
      while (D.target() && n < 20) { t.frames(1); n++; }
      t.ok(n <= 9, 'dropped within 150 ms (' + n + ' frames)');
      D.look(y, p); t.frames(1);
      t.ok(!!D.target(), 'reacquired in 1 frame');
      D.look(y + 40 * D2R, p); t.frames(12);
      t.eq(D.target(), null, '40° away: null');
    }],
    ['feel T40: an NPC 0.9 m behind and a sign seen from behind are never targeted', (t) => {
      const { D, view, game, W, pl } = t;
      D.standAt('shellby', 0, { dist: 0.9 }); t.frames(2);
      D.look(view.yaw + Math.PI, 0); let seen = 0;
      for (let i = 0; i < 20; i++) { t.frames(1); if (D.target()) seen++; }
      t.eq(seen, 0, 'NPC behind');
      const sg = W.interact.find((it) => it.kind === 'sign' && it.prop);
      const r = sg.prop.rot || 0, bx = sg.x - Math.sin(r) * 1.3, bz = sg.z - Math.cos(r) * 1.3;
      D.teleport(bx, bz, yawOf(sg.x - bx, sg.z - bz), 0); D.aimAt(sg.x, sg.y + TC.aimPts.sign[0], sg.z);
      seen = 0;
      for (let i = 0; i < 12; i++) { t.frames(1); if (game.target && game.target.o === sg) seen++; }
      t.eq(seen, 0, 'sign from behind');
      t.ok(pl, 'ok');
    }],
    ['feel T41 / arch accept 2: LMB within 1.3 m of a targeted sign swings (swingId+1) and never opens it', (t) => {
      const { D, pl, ui } = t;
      D.standAt('sign', 0, { dist: 1.3 }); t.frames(3);
      t.ok(!!D.target() && D.target().kind === 'sign', 'sign targeted');
      const id = pl.swingId;
      t.press('attack'); t.frames(3);
      t.eq(pl.swingId, id + 1, 'swung');
      t.ok(!ui.dlg, 'no dialogue');
      t.press('interact'); t.frames(2);
      t.ok(!!ui.dlg, 'E opens it'); t.dlgDone();
    }],
    ['the well prompt is on screen (FP and TP), and a post between the eye and Shellby hides Shellby', (t) => {
      const { D, game, W, pl, ui } = t;
      for (const mode of ['fp', 'tp']) {
        D.setView(mode);
        D.standAt('well'); t.frames(3);
        t.eq(D.target() && D.target().kind, 'well', mode + ' well targeted');
        const r = ui.promptEl.getBoundingClientRect();
        t.ok(!ui.promptEl.classList.contains('hidden') && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, mode + ' prompt inside the viewport', { top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      }
      D.setView('fp');
      const st = D.standAt('shellby', 0, { dist: 1.8 }); t.frames(2);
      t.ok(!!D.target(), 'Shellby targeted');
      const n = game.npcs.find((q) => q.id === 'shellby');
      const rm = tempCollider(W, (pl.pos.x + n.pos.x) / 2, (pl.pos.z + n.pos.z) / 2, 0.3, 2.2);
      try { game._tgt = null; t.frames(12); t.eq(D.target(), null, 'a post in between blocks it'); } finally { rm(); }
      const rl = tempCollider(W, (pl.pos.x + n.pos.x) / 2, (pl.pos.z + n.pos.z) / 2, 0.3, 0.6);  // a low counter / fence
      try { game._tgt = null; t.frames(4); t.ok(!!D.target(), 'a 0.6 m counter in between does not'); } finally { rl(); }
      t.ok(st, 'stood');
    }],
    ['TP proximity fallback: a sign 1 m in front of the body is offered without aiming; never one behind it', (t) => {
      const { D, view, pl } = t;
      D.setView('tp');
      D.standAt('sign', 0, { dist: 1.2 }); t.frames(2);
      D.look(view.yaw, 40 * D2R); t.frames(12);                                      // crosshair up in the sky
      t.ok(!!D.target() && D.target().ang === null, 'fallback target', D.target());
      pl.turnTo(pl.facing + Math.PI); t.frames(12);
      t.eq(D.target(), null, 'body turned away: none');
    }],
    // ---- spawner (C16)
    ['arch accept 4: 60 forced woods spawns, fixed view: 0 in the view cone closer than 24 m; ≥ 40 % in the forward ±70°; every one emerge()s', (t) => {
      const { D, game, view } = t;
      const kinds = {}, orig = Enemy.prototype.emerge;
      Enemy.prototype.emerge = function (k) { kinds[k] = (kinds[k] || 0) + 1; this._emerged = k; };
      let n = 0, bad = 0, fwd = 0, emerged = 0;
      try {
        for (const mode of ['fp', 'tp']) {
          D.setView(mode); D.pose('woods'); t.frames(2);
          for (let i = 0; i < 300 && n < (mode === 'fp' ? 60 : 90); i++) {
            t.clearEnemies();
            const e = trySpawnEnemy(game);
            if (!e) continue;
            n++;
            if (e._emerged) emerged++;
            const o = coneOrigin(game), d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z);
            if (inViewCone(game, e.pos.x, e.pos.z) && d < TC.spawnClear) bad++;
            const p = game.player.pos;
            if (Math.abs(angDiff(view.yaw, yawOf(e.pos.x - p.x, e.pos.z - p.z))) <= TC.spawnFwdDeg * D2R) fwd++;
          }
        }
      } finally { Enemy.prototype.emerge = orig; t.clearEnemies(); }
      t.note('spawns', { n, bad, fwdShare: +(fwd / n).toFixed(3), kinds });
      t.ok(n >= 90, 'spawned ' + n);
      t.eq(bad, 0, 'in the cone closer than 24 m');
      t.ok(fwd / n >= 0.4, 'forward share ' + (fwd / n).toFixed(2));
      t.eq(emerged, n, 'emerge() on every spawn');
    }],
    ['arch accept 5: no despawn in the view cone closer than 70 m; out of it beyond 44 m and anywhere beyond 70 m it goes', (t) => {
      const { D, game } = t;
      D.pose('woods'); t.frames(1);
      const mk = (dist, rel) => { D.spawn('slime', dist, rel); return D.last; };
      const keep = [mk(50, 0), mk(66, 20), mk(30, 170), mk(43, 120)], go = [mk(50, 150), mk(60, -100), mk(72, 0), mk(80, 170)];
      game.updateSpawning(STEP);
      const alive = (e) => game.enemies.includes(e);
      t.eq(keep.filter(alive).length, keep.length, 'kept');
      t.eq(go.filter(alive).length, 0, 'despawned');
    }],
    ['regrowth: never inside the view cone within 90 m, never within 20 m; else it regrows', (t) => {
      const { D, game } = t;
      const o = game.nearCuttables(0, 0, 400).find((q) => q.cutKind === 'bush') || game.nearCuttables(0, 0, 400)[0];
      const at = (dist, rel) => D.teleport(o.x, o.z - dist, -rel * D2R, 0);              // the bush due +Z, rel° off the look
      const rows = {};
      for (const [name, dist, rel, want] of [['view30', 30, 0, true], ['view60', 60, 30, true], ['near15', 15, 180, true], ['back25', 25, 180, false], ['view95', 95, 0, false]]) {
        at(dist, rel);
        o.cut = true; game.scenery.hide(o); game.regrow = [{ o, t: 0 }];
        game.updateRegrowth(STEP);
        rows[name] = o.cut;
        t.eq(o.cut, want, name + (want ? ' stays cut' : ' regrows'));
      }
      o.cut = false; game.scenery.show(o); game.regrow = [];
      t.note('rows', rows);
    }],
    // ---- sim-time beats
    ['chest beat runs on sim time: a pause during the 0.42 s lid beat holds it', async (t) => {
      const { D, game, W, ui } = t;
      const idx = W.interact.filter((it) => it.kind === 'chest' && !game.S.chests[it.chest.id]).sort((a, b) => Math.hypot(a.x - W.spawn.x, a.z - W.spawn.z) - Math.hypot(b.x - W.spawn.x, b.z - W.spawn.z)).findIndex((it) => it.chest.kind !== 'heart');
      if (idx < 0) { t.ok(true, 'no coin chest'); return; }
      D.standAt('chest', idx); t.frames(3);
      t.eq(D.target() && D.target().kind, 'chest', 'chest targeted');
      t.press('interact'); t.frames(6);
      t.ok(game.player.frozen, 'frozen in the beat');
      ui.openPause(); t.frames(2);
      await t.wait(500); t.frames(40);
      const during = game.pickups.length;
      ui.closeMenu(true); await t.wait(130); t.frames(30);
      t.eq(during, 0, 'no gems while paused');
      t.ok(game.pickups.length > 0 && !game.player.frozen, 'gems after the beat, unfrozen', game.pickups.length);
    }],
    ['chest beat cancelled (Save & Quit / session change during the 0.42 s lid beat): the chest stays closed in the save, no heart is lost; a finished beat grants and saves', (t) => {
      const { game, W } = t, S = game.S;
      const c = W.chests.find((q) => q.kind === 'heart' && !S.chests[q.id]);
      if (!c) { t.ok(true, 'no heart chest left'); return; }
      const hp0 = S.maxHp;
      t.D.teleport(c.x + 1.2, c.z + 1.2); t.frames(2);
      game.openChest(c); t.frames(3);
      t.ok(!S.chests[c.id] && c._opening && game.player.frozen, 'in the beat: not yet marked open');
      t.ok(!game.interactables().some((q) => q.o.chest === c), 'not offered again during the beat');
      game.clearLater();                                                // what onTitle / onSession do
      t.ok(!S.chests[c.id] && !c._opening && !game.player.frozen && S.maxHp === hp0, 'cancelled: closed, unfrozen, max hearts unchanged', { open: S.chests[c.id], maxHp: S.maxHp });
      game.leaving = true;                                              // the Save & Quit fade: the beat runs out but grants nothing
      try { game.openChest(c); t.frames(30); } finally { game.leaving = false; }
      t.ok(!S.chests[c.id] && S.maxHp === hp0 && !t.ui.dlg, 'during the quit fade: nothing granted, no dialogue', { open: S.chests[c.id], maxHp: S.maxHp });
      game.scenery.setChestOpen(c.id, false, true);
      game.openChest(c); t.frames(30);
      t.ok(S.chests[c.id] === true && S.maxHp === Math.min(hp0 + 2, CFG.maxHp), 'a finished beat: open + max hearts', { maxHp: S.maxHp });
      t.dlgDone();
    }],
    ['interaction LOS: the allowance is measured from Pip\'s eye in TP too; a 1.3 m post on the crosshair ray hides Shellby (the camera height no longer lets the ray ignore it), a 0.6 m counter does not; in FP the same between Pip and Shellby', (t) => {
      const { D, game, W, pl } = t;
      const n = game.npcs.find((q) => q.id === 'shellby'), rows = {};
      for (const mode of ['tp', 'fp']) {
        D.setView(mode);
        D.standAt('shellby', 0, { dist: 2.0 }); t.frames(3);
        const tg = D.target();
        t.ok(!!tg, 'Shellby targeted in ' + mode);
        if (!tg) continue;
        // where the crosshair ray runs: TP from the camera (WP1's shoulder rig puts it 0.4 m beside the Pip–Shellby
        // line), FP from the eye; the post / counter goes on it 1 m short of the aim point
        const o = mode === 'tp' ? game.camera.position : t.view.eye, a = tg.point, dx = a[0] - o.x, dz = a[2] - o.z, L = Math.hypot(dx, dz);
        const px = a[0] - (dx / L) * 1.0, pz = a[2] - (dz / L) * 1.0;
        const rm = tempCollider(W, px, pz, 0.3, 1.3);
        let post, low;
        try { game._tgt = null; t.frames(12); post = D.target(); } finally { rm(); }
        const rl = tempCollider(W, px, pz, 0.3, 0.6);
        try { game._tgt = null; t.frames(4); low = D.target(); } finally { rl(); }
        rows[mode] = { post: post && post.label, low: low && low.label, at: [+px.toFixed(2), +pz.toFixed(2)], pip: [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)], npc: [+n.pos.x.toFixed(2), +n.pos.z.toFixed(2)] };
        t.eq(post, null, mode + ': a 1.3 m post on the crosshair ray blocks it');
        t.ok(!!low, mode + ': a 0.6 m counter there does not');
      }
      t.note('rows', rows);
      D.setView('fp');
    }],
    ['feel §8.7 touch auto-face: touch + assist auto/high turns the FP view onto a slime 20° off within 0.15 s of a swing start; never with the mouse, assist low, 40° off, or in TP', (t) => {
      const { D, game, view, settings } = t, dev = game.input.lastDevice, rows = {};
      const run = (device, assist, rel, mode = 'fp') => {
        t.clearEnemies(); t.resetPlayer(); D.setView(mode); D.pose('meadow'); D.look(0, mode === 'tp' ? -6 * D2R : 0); t.frames(2);
        settings.set('aimAssist', assist); game.input.lastDevice = device;
        D.spawn('slime', 2.5, rel); const e = D.last; t.frames(1);
        game.input.lastDevice = device;
        const y0 = view.yaw, want = yawOf(e.pos.x - t.pl.pos.x, e.pos.z - t.pl.pos.z);
        t.press('attack'); t.frames(10);
        return { turned: +(angDiff(y0, view.yaw) * R2D).toFixed(1), left: +(angDiff(view.yaw, want) * R2D).toFixed(1) };
      };
      try {
        rows.touch = run('touch', 'auto', 20); rows.touchHigh = run('touch', 'high', -20);
        rows.mouse = run('mouse', 'auto', 20); rows.low = run('touch', 'low', 20); rows.far = run('touch', 'auto', 40); rows.tp = run('touch', 'auto', 20, 'tp');
      } finally { settings.set('aimAssist', 'off'); game.input.lastDevice = dev; D.setView('fp'); t.clearEnemies(); }
      t.note('rows', rows);
      t.ok(Math.abs(rows.touch.left) < 2 && Math.abs(rows.touchHigh.left) < 2, 'touch: turned onto it', rows);
      t.ok([rows.mouse, rows.low, rows.far, rows.tp].every((r) => Math.abs(r.turned) < 0.5), 'no turn otherwise', rows);
    }],
  ], { desc: 'WP4: sword volumes, lock-on (C1), crosshair interaction, eye-level spawner', prepare: { god: true, freeze: true, sword: 1, settings: { aimAssist: 'off', autoLockBosses: 'off', lockMode: 'toggle', lockTurnsCamera: true } } });

  // ---------------------------------------------------------------------------------------------- wp4-matrix (heavy)
  suite('wp4-matrix', [
    ['arch accept 1: 6 types × {0.8, 1.5, reach+r−0.05, reach+r+0.1} × {0, ±40, ±60, ±120, 180}° × pitch {−30, 0, +25} × A/B/C match SPEC 100 %', (t) => {
      const undo = noLunge(), bad = [], tally = {};
      let n = 0, hits = 0;
      try {
        for (const type of TYPES) {
          const reach = t.pl.reach, r = ENEMY[type].r;
          for (const d of [0.8, 1.5, reach + r - 0.05, reach + r + 0.1]) for (const rel of [0, 40, -40, 60, -60, 120, -120, 180]) for (const p of [-30, 0, 25]) for (const kind of ['A', 'B', 'C']) {
            const res = swing(t, { type, dist: d, rel, pitch: p, kind, alt: ALT[type] });
            const feet = t.pl.pos.y;
            const want = SPEC({ d, rel, p, kind, r: res.hb.r, y0: res.hb.y0 - feet, y1: res.hb.y1 - feet, reach, ground: isGround(type) });
            n++; if (res.hit) hits++;
            const k = type + kind; tally[k] = (tally[k] || 0) + (res.hit ? 1 : 0);
            if (res.hit !== want || res.kind !== kind) bad.push({ type, d: +d.toFixed(2), rel, p, kind, want, got: res.hit, ran: res.kind });
          }
        }
        // the bat at altitude 2.1: only with look-up, at every distance in reach
        for (const d of [0.8, 1.5, 1.93]) for (const p of [-30, 0, 10, 25, 40]) for (const kind of ['A', 'B']) {
          const res = swing(t, { type: 'bat', dist: d, rel: 0, pitch: p, kind, alt: 2.1 });
          const feet = t.pl.pos.y, want = SPEC({ d, rel: 0, p, kind, r: res.hb.r, y0: res.hb.y0 - feet, y1: res.hb.y1 - feet, reach: t.pl.reach, ground: false });
          n++;
          if (res.hit !== want) bad.push({ type: 'bat2.1', d, p, kind, want, got: res.hit });
          if (res.hit && p < 0) bad.push({ type: 'bat2.1', d, p, kind, why: 'hit looking down' });
        }
      } finally { undo(); }
      t.note('cells', n); t.note('hits', hits); t.note('tally', tally); t.note('bad', bad.slice(0, 20));
      t.eq(bad.length, 0, 'cells off the spec');
    }],
    // above: a flyer's bottom 1.8 m over the feet (the risen bat), a ground critter on a 1.2 m ledge; below: sunk 0.6 m
    // (a dip; its top stays above the ground, so the terrain never hides it); wall: 2.6 m up / 2.0 m down, out of the
    // blade's vertical reach whatever the look
    ['lead: each type × front / side 60° / behind / above / below × A/B/C (1.3 m)', (t) => {
      const undo = noLunge(), bad = [], rows = [];
      try {
        for (const type of TYPES) for (const kind of ['A', 'B', 'C']) {
          const row = { type, kind };
          const up = isGround(type) ? 1.2 : 1.8;
          for (const [name, rel, dAlt, pitch, y0] of [['front', 0, 0, 0], ['side60', 60, 0, 0], ['side-60', -60, 0, 0], ['behind', 180, 0, 0], ['aboveLevel', 0, 0, 0, up], ['aboveLook', 0, 0, 30, up], ['belowLevel', 0, -0.6, 0], ['belowLook', 0, -0.6, -40], ['wallAbove', 0, 2.6, 45], ['wallBelow', 0, -2.0, -60]]) {
            const res = swing(t, { type, dist: 1.3, rel, pitch, kind, alt: ALT[type] + dAlt, y0 });
            const feet = t.pl.pos.y, want = SPEC({ d: 1.3, rel, p: pitch, kind, r: res.hb.r, y0: res.hb.y0 - feet, y1: res.hb.y1 - feet, reach: t.pl.reach, ground: isGround(type) });
            row[name] = res.hit ? 'hit' : '-';
            if (res.hit !== want) bad.push({ type, kind, name, want, got: res.hit });
          }
          rows.push(row);
        }
      } finally { undo(); }
      t.note('rows', rows); t.note('bad', bad);
      t.eq(bad.length, 0, 'cells off the spec');
    }],
  ], { desc: 'WP4 full combat matrix (heavy)', heavy: true, prepare: { god: true, freeze: true, sword: 1, settings: { aimAssist: 'off', autoLockBosses: 'off' } } });
}
