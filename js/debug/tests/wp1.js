// WP1 in-page test suites (registered by js/debug/tests.js; only loaded with ?debug=1). Camera feel and cinematics:
// suite 'wp1' (fast, in 'all'), suite 'wp1-heavy' (TP arm sweep over 300 placements + boss intros in both modes).
// Every check reads the live camera (the real view.update path) through the manual clock.
import * as THREE from 'three';
import { view as TV, move as TM } from '../../tune.js';
import { wrapAngle, yawOf } from '../../util.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const FLAT = [-6, 9];     // flat village grass (feel-basic uses it)
const CALM = { headBob: 1, speedFx: 1, cameraRoll: true, reduceMotion: false, shake: 0, dialogueLookAt: true, lockTurnsCamera: true };

const feelMod = (t) => t.game.modules.find((m) => m && m.name === 'wp1-feel');
/** camera orientation relative to the look: { dp, dy, roll } degrees, plus fov offset from the base */
function rel(t) {
  const c = t.game.camera, v = t.view;
  _e.setFromQuaternion(c.quaternion, 'YXZ');
  return { dp: (_e.x - v.pitch) * R2D, dy: wrapAngle(_e.y - Math.PI - v.yaw) * R2D, roll: _e.z * R2D, fov: c.fov - v.baseFov(), y: c.position.y, pos: c.position.clone() };
}
const stand = (t, yaw = Math.PI / 2) => { t.D.teleport(FLAT[0], FLAT[1], yaw, 0); t.frames(20); };
const p2p = (a) => Math.max(...a) - Math.min(...a);
const r3 = (v) => +(+v).toFixed(3);
/** NDC of a world point through the live camera */
function ndc(t, x, y, z) { _v.set(x, y, z).project(t.game.camera); return { x: _v.x, y: _v.y, z: _v.z }; }

export default function register(suite) {
  suite('wp1', [
    // ---------------------------------------------------------------- FP feel layers (feel §6)
    ['head bob: 2.3 cm p2p at full stride, lateral 2.0, roll 0.7°, footfall = bob minimum (feel T19, arch #1)', (t) => {
      const { D, game } = t, F = feelMod(t);
      stand(t);
      t.move(0, 1); t.frames(60);
      const y = [], x = [], roll = [], steps = [];
      let n0 = t.events('step').length;
      for (let i = 0; i < 180; i++) {
        t.frames(1);
        const o = F.fp.out; y.push(o.bobY); x.push(o.bobX); roll.push(o.roll * R2D);
        const n = t.events('step').length; if (n > n0) steps.push(i); n0 = n;
      }
      t.move(0, 0);
      const sp = game.player.vel.length();
      t.note('bob', { speed: r3(sp), y: r3(p2p(y) * 100), x: r3(p2p(x) * 100), roll: r3(p2p(roll)), steps: steps.length });
      t.near(p2p(y), 0.023, 0.002, 'vertical p2p (m)');
      t.near(p2p(x), 0.020, 0.003, 'lateral p2p (m)');
      t.near(p2p(roll), 0.70, 0.1, 'roll p2p (deg)');
      // every footstep lands within one render frame of a bob minimum (the footfall)
      let bad = 0;
      for (const f of steps) {
        let m = f;
        for (let k = Math.max(0, f - 3); k <= Math.min(y.length - 1, f + 3); k++) if (y[k] < y[m]) m = k;
        if (Math.abs(m - f) > 1) bad++;
      }
      t.ok(steps.length >= 11, 'steps ' + steps.length);
      t.eq(bad, 0, 'steps off the bob minimum');
    }],
    ['head bob setting: 0 → no bob, 0.4 → 40 %; motion comfort → none', (t) => {
      const F = feelMod(t), run = (o) => { t.D.settings(o); stand(t); t.move(0, 1); t.frames(60); const y = []; for (let i = 0; i < 90; i++) { t.frames(1); y.push(t.view.eye.y - t.game.player.root.position.y); } t.move(0, 0); return p2p(y); };
      const full = run({ headBob: 1, reduceMotion: false }), off = run({ headBob: 0 }), low = run({ headBob: 0.4 }), rm = run({ headBob: 1, reduceMotion: true });
      t.note('p2p', { full: r3(full * 1000), off: r3(off * 1000), low: r3(low * 1000), comfort: r3(rm * 1000) });
      t.ok(off < 0.0005, 'headBob 0 → p2p < 0.5 mm', off);
      t.near(low / full, 0.4, 0.05, 'headBob 0.4 → 40 %');
      t.ok(rm < 0.0005, 'motion comfort → no bob', rm);
      t.eq(F.fp.out.bobY, 0, 'bobY 0');
    }],
    ['landing spring: full jump (impact 7.38) dips 0.074 m at 72 ms, ≤ 9 mm overshoot, settled by 0.5 s (feel T18; C2 simulated)', (t) => {
      const { D } = t;
      stand(t);
      const base = t.view.eye.y, d = [];
      D.cam.land(7.38);
      for (let i = 0; i < 40; i++) { t.frames(1); d.push(t.view.eye.y - base); }
      const min = Math.min(...d), at = d.indexOf(min) + 1, over = Math.max(0, ...d.slice(at));
      t.note('land', { dip: r3(min), atMs: Math.round((at * 1000) / 60), over: r3(over * 1000), at05: r3(d[29] * 1000) });
      t.near(-min, 0.074, 0.010, 'dip');
      t.near(at / 60, 0.072, 0.017, 'peak time');
      t.ok(over <= 0.009, 'overshoot ≤ 9 mm', over);
      t.ok(Math.abs(d[29]) < 0.002, '< 2 mm at 0.5 s', d[29]);
      t.frames(60);
      const settled = t.view.eye.y;
      D.cam.land(1.5); t.frames(10);
      t.near(t.view.eye.y, settled, 1e-6, 'a soft touchdown (≤ 2 m/s) does nothing');
    }],
    ['dash: FOV +8 (Full) / +2.8 (Reduced) / 0 (Off), lean roll ≤ 6° toward the dash, nod ≤ 4°, no somersault, back by 0.3 s (feel T36, §5)', (t) => {
      const { D } = t;
      const dash = (speedFx, mx = 1) => {
        D.settings({ speedFx }); stand(t, Math.PI / 2); t.frames(40);
        t.move(mx, 0); t.press('dash');
        const r = [];
        for (let i = 0; i < 50; i++) { t.frames(1); r.push(rel(t)); }
        t.move(0, 0);
        return { fov: Math.max(...r.map((q) => q.fov)), roll: r.map((q) => q.roll), dp: r.map((q) => q.dp), after: r[13 + 18].fov };
      };
      const full = dash(1), red = dash(0.35), off = dash(0), back = dash(1, 0);
      const rmax = Math.max(...full.roll.map(Math.abs));
      t.note('dash', { fov: [r3(full.fov), r3(red.fov), r3(off.fov)], rollMax: r3(rmax), rollAt6: r3(full.roll[6]), dpMax: r3(Math.max(...full.dp.map(Math.abs))), backDp: r3(Math.max(...back.dp)), after: r3(full.after) });
      t.near(full.fov, 8, 0.5, 'Full FOV peak'); t.near(red.fov, 2.8, 0.3, 'Reduced FOV peak'); t.near(off.fov, 0, 0.05, 'Off FOV');
      t.ok(rmax <= 6 && rmax >= 2, 'lean roll 2…6°', rmax);
      t.ok(full.roll[6] < 0, 'leans toward the dash (right → bank right, roll −)', full.roll[6]);
      t.ok(Math.max(...full.dp.map(Math.abs)) <= 4, '|pitch offset| ≤ 4°');
      t.ok(full.dp.concat(back.dp).every((v) => Math.abs(v) < 10), 'never > 10° from the look (no somersault)');
      t.ok(Math.max(...back.dp) > 0.5, 'no-input FP dash (backstep) tilts up', Math.max(...back.dp));
      t.ok(Math.abs(full.after) <= 0.5, 'FOV back within 0.5° 0.3 s after the dash', full.after);
    }],
    ['hurt kick: roll 3.5° away from the source at ≤ 80 ms, opposite sides opposite signs, pitch ≤ 0.3°, look untouched (feel T35)', (t) => {
      const { D, view } = t;
      // the kick layer alone: WP3's knockback hop (TUNE.move.hurtHop) lands ≈ 0.2 s later with its own landing nod (the
      // landing spring, its own test); measured with the hop off, then the merged hurt (hop on) keeps that nod small
      const hit = (deg, hop = 0) => {
        const h0 = TM.hurtHop; TM.hurtHop = hop;
        try {
          stand(t); t.game.player.iframes = 0;
          const y0 = view.yaw, r = [];
          D.hurt(1, deg);
          for (let i = 0; i < 30; i++) { t.frames(1); r.push(rel(t)); }
          return { r, yawKept: Math.abs(wrapAngle(view.yaw - y0)) < 1e-9 };
        } finally { TM.hurtHop = h0; }
      };
      const L = hit(90), R = hit(-90), M = hit(90, TM.hurtHop);
      const peak = (a) => a.reduce((m, q, i) => (Math.abs(q.roll) > Math.abs(m.v) ? { v: q.roll, i } : m), { v: 0, i: 0 });
      const pl = peak(L.r), pr = peak(R.r);
      t.note('hurt', { left: [r3(pl.v), Math.round(((pl.i + 1) * 1000) / 60)], right: [r3(pr.v), Math.round(((pr.i + 1) * 1000) / 60)], pitch: r3(Math.max(...L.r.map((q) => Math.abs(q.dp)))), at04: r3(L.r[23].roll) });
      t.near(Math.abs(pl.v), 3.5, 0.5, 'peak roll'); t.ok((pl.i + 1) / 60 <= 0.084, 'peak ≤ 80 ms', (pl.i + 1) / 60);
      t.ok(pl.v < 0 && pr.v > 0, 'tilts away: source left → bank right (−), right → (+)', [pl.v, pr.v]);
      t.ok(Math.max(...L.r.map((q) => Math.abs(q.dp))) <= 0.3, 'side hit: pitch ≤ 0.3°');
      t.ok(L.yawKept && R.yawKept, 'look yaw unchanged');
      t.ok(Math.abs(L.r[23].roll) < 0.2, '< 0.2° by 0.4 s', L.r[23].roll);
      t.ok(Math.max(...M.r.map((q) => Math.abs(q.dp))) <= 1.0, 'merged (with the knockback hop): its landing nod ≤ 1°', Math.max(...M.r.map((q) => Math.abs(q.dp))));
    }],
    ['sword punch: A yaws +0.6° along the sweep, FOV −1.5; the look never moves (feel §6.6)', (t) => {
      const { D } = t;
      D.settings({ speedFx: 1 });
      const s = t.swing({ type: 'slime', dist: 1.4, rel: 0, frames: 4 });
      const r = rel(t);
      t.note('punch', { hit: s.hit, dy: r3(r.dy), fov: r3(r.fov) });
      t.ok(s.hit, 'hit');
      t.ok(r.dy > 0.25 && r.dy <= 0.62, 'yaw punch (A: + = left)', r.dy);
      t.ok(r.fov < -0.5 && r.fov >= -1.6, 'FOV pinch', r.fov);
      t.frames(30);
      t.ok(Math.abs(rel(t).dy) < 0.02, 'recovered');
    }],
    ['r3: a killing blow gets the hit punch once (not twice) plus feel §8.4\'s kill trauma 0.15; the boss punch reads TUNE.view.punch.yawBoss / fovBoss', (t) => {
      const { D, view, game } = t, F = feelMod(t);
      D.settings({ speedFx: 1 });
      t.clearEnemies(); D.teleport(0, 9.5, 0, 0); t.frames(5);
      D.spawn('slime', 1.4, 0, { face: true }); const e = D.last; e.iframes = 0; e.lastSwing = -1; e.hp = 1; D.freezeAI(true);
      D.clearEvents(); t.press('attack');
      let py = 0, tr = 0;
      for (let i = 0; i < 12; i++) { t.frames(1); py = Math.max(py, rel(t).dy); tr = Math.max(tr, view.shk.trauma); }
      const hits = t.events('hit').filter((h) => h.kind === 'enemy'), kills = t.events('kill').length;
      D.freezeAI(false);
      // the boss row: its punch from the TUNE keys (feel §8.4: 0.9° / −2.5 FOV), through FeelFP.punch
      F.fp.punchY = F.fp.punchF = 0; F.fp.punch('A', F.comfort, true);
      const boss = { yaw: F.fp.punchY, fov: F.fp.punchF };
      F.fp.punchY = F.fp.punchF = 0;
      t.note('kill', { hits: hits.length, killed: hits.map((h) => h.killed), kills, punchYaw: r3(py), trauma: r3(tr), boss });
      t.ok(hits.length === 1 && hits[0].killed && kills === 1, 'one killing hit', { hits: hits.length, kills });
      t.ok(py > 0.25 && py <= 0.62, 'the kill punches like any hit (yaw ≤ 0.6°: one punch)', py);
      t.ok(tr > 0.1 && tr <= 0.16, 'kill trauma ≈ 0.15', tr);
      t.near(boss.yaw, TV.punch.yawBoss, 1e-9, 'boss yaw punch = punch.yawBoss'); t.near(boss.fov, TV.punch.fovBoss, 1e-9, 'boss FOV punch = punch.fovBoss');
      void game;
    }],
    ['shake 0 → no camera jitter; motion comfort → roll always 0 (arch #4)', (t) => {
      const { D, game } = t;
      D.settings({ shake: 0 }); stand(t);
      _q.copy(game.camera.quaternion);
      D.shake(1.2); let jit = 0;
      for (let i = 0; i < 30; i++) { t.frames(1); jit = Math.max(jit, game.camera.quaternion.angleTo(_q)); _q.copy(game.camera.quaternion); }
      t.eq(jit, 0, 'quaternion jitter with shake 0');
      D.settings({ shake: 1, reduceMotion: true });
      stand(t); game.player.iframes = 0;
      let roll = 0;
      const watch = (n) => { for (let i = 0; i < n; i++) { t.frames(1); roll = Math.max(roll, Math.abs(rel(t).roll)); } };
      D.shake(1.2); t.move(1, 0.3); watch(40); t.press('dash'); watch(30); t.move(0, 0); D.hurt(1, 90); watch(30); D.down(); watch(80);
      t.note('comfortRoll', roll);
      t.ok(roll < 1e-6, 'roll with motion comfort', roll);
    }],
    ['view.speedFx (C9): 0 at rest, ≈ 1 in a dash, × the speedFx setting, 0 under motion comfort', (t) => {
      const { D, view } = t;
      const peak = (o) => { D.settings(o); stand(t); const r0 = view.speedFx; t.move(1, 0); t.press('dash'); let m = 0; for (let i = 0; i < 20; i++) { t.frames(1); m = Math.max(m, view.speedFx); } t.move(0, 0); t.frames(40); return { r0, m, end: view.speedFx }; };
      const a = peak({ speedFx: 1, reduceMotion: false }), b = peak({ speedFx: 0.35 }), c = peak({ speedFx: 1, reduceMotion: true });
      t.note('speedFx', { full: r3(a.m), reduced: r3(b.m), comfort: r3(c.m) });
      t.eq(a.r0, 0, 'rest'); t.ok(a.m > 0.9, 'dash ≈ 1', a.m); t.near(b.m, 0.35, 0.04, 'Reduced'); t.eq(c.m, 0, 'motion comfort');
      t.eq(a.end, 0, 'back to 0');
    }],
    ['FOV channels stay within base −14 … +10 (fovPunch +30 is capped)', (t) => {
      stand(t); t.D.cam.fovPunch(30, 0.05, 0.2, 0.2);
      let m = 0; for (let i = 0; i < 20; i++) { t.frames(1); m = Math.max(m, rel(t).fov); }
      t.ok(m <= 10 + 1e-6 && m > 9, 'capped at +10', m);
    }],
    // ---------------------------------------------------------------- third person (RULINGS TP camera)
    ['TP framing: level with Pip, Pip 28–36 % of the height, crosshair ray ≥ 0.35 m clear, horizon near mid-screen', (t) => {
      const { D } = t;
      D.setView('tp'); D.teleport(-1.5, 9.2, Math.PI - 0.25, TV.tpPitch * D2R); t.frames(60, { draw: true });
      const f = D.cam.framing();
      t.note('framing', f);
      t.ok(f.pipH >= 0.28 && f.pipH <= 0.36, 'Pip height share', f.pipH);
      t.ok(f.clearM >= 0.35, 'crosshair clearance', f.clearM);
      t.ok(f.camH >= 1.05 && f.camH <= 1.45, 'camera level with Pip (1.05–1.45 m over his feet)', f.camH);
      t.ok(f.horizonY >= 0.4 && f.horizonY <= 0.5, 'horizon', f.horizonY);
      t.ok(f.pipCx >= 0.32 && f.pipCx <= 0.42, 'Pip left of centre', f.pipCx);
    }],
    ['TP body fade (C12): RigTP.bodyFade band 0.45 → 0.9 m; view.bodyFade follows the arm; boom shortens looking up', (t) => {
      const { D, view } = t, R = view.tp;
      t.ok(R.bodyFade(0.45) === 0 && R.bodyFade(0.9) === 1 && Math.abs(R.bodyFade(0.675) - 0.5) < 1e-9, 'band');
      D.setView('tp'); D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -4 * D2R); t.frames(40);
      t.near(view.bodyFade, R.bodyFade(view.armLen), 1e-9, 'follows the arm');
      const a0 = view.armLen;
      D.look(Math.PI / 2, 40 * D2R); t.frames(90);
      t.ok(view.armLen < a0 * 0.8, 'looking up 40° shortens the boom', [a0, view.armLen]);
    }],
    ['TP arm: backing into a round tree keeps the arm (crosses the trunk or slides around it: ≥ 1.5 m, no pop), never inside it', (t) => {
      const { D, W, view, game } = t;
      D.setView('tp');
      const near = [];
      // an isolated round tree (nothing else within 4 m: a cornered spot has no room to slide)
      const c = W.colliders.find((q) => q.kind === 'tree_round' && Math.hypot(q.x, q.z) < 150 && W.nearColliders(q.x, q.z, 4, near).filter((o) => o !== q).length === 0 && [0, 1, 2, 3, 4, 5].some((k) => W.walkable(q.x + Math.sin(k) * (q.r + 0.45), q.z + Math.cos(k) * (q.r + 0.45))));
      let k = 0; while (!W.walkable(c.x + Math.sin(k) * (c.r + 0.45), c.z + Math.cos(k) * (c.r + 0.45))) k++;
      const x = c.x + Math.sin(k) * (c.r + 0.45), z = c.z + Math.cos(k) * (c.r + 0.45);
      D.teleport(x, z, yawOf(x - c.x, z - c.z), -4 * D2R);
      let inside = 0, grow = 0, pop = 0, minArm = 9, prev = view.tp.arm;   // the teleport snapped the arm (view.armLen is stale)
      for (let i = 0; i < 90; i++) {
        game.runFrame(1 / 60, true, false);
        const p = game.camera.position;
        W.nearColliders(p.x, p.z, 3, near);
        if (near.some((q) => q.active !== false && (W.colliderContains ? W.colliderContains(q, p.x, p.y, p.z) : Math.hypot(p.x - q.x, p.z - q.z) < q.r && p.y >= q.y0 && p.y <= q.camTop))) inside++;
        if (view.armLen - prev > 4 * (1 / 60) * view.tp.boom + 1e-6) grow++;
        if (prev - view.armLen > 0.4) pop++;
        minArm = Math.min(minArm, view.armLen);
        prev = view.armLen;
      }
      t.note('slide', { ...view.tp.info(), minArm: r3(minArm), tree: [r3(c.x), r3(c.z), r3(c.r)], at: [r3(x), r3(z)], near: (W.nearColliders(x, z, 2.5, []) || []).map((q) => q.kind + ':' + r3(q.r) + '@' + r3(Math.hypot(q.x - x, q.z - z))) });
      t.ok(view.armLen >= 1.5, 'arm after 1.5 s', view.armLen);
      t.eq(inside, 0, 'frames inside a collider'); t.eq(grow, 0, 'frames lengthening > 4·dt·boom'); t.eq(pop, 0, 'one-frame drops > 0.4 m');
    }],
    ['V mid-fight: 0.35 s blend, ≤ 0.30 m and ≤ 0.5° per frame, look identical after FP → TP → FP (feel T48)', (t) => {
      const { D, view, game } = t;
      stand(t); D.spawn('slime', 3, 0, { face: true }); t.frames(5);
      const y0 = view.yaw, p0 = view.pitch;
      let maxMove = 0, maxRot = 0, frames = 0;
      const run = () => {
        _q.copy(game.camera.quaternion); let prev = game.camera.position.clone();
        t.press('view');
        for (let i = 0; i < 26; i++) { t.frames(1); maxMove = Math.max(maxMove, game.camera.position.distanceTo(prev)); maxRot = Math.max(maxRot, game.camera.quaternion.angleTo(_q) * R2D); prev.copy(game.camera.position); _q.copy(game.camera.quaternion); if (view.blend > 0 && view.blend < 1) frames++; }
      };
      run(); const tp = view.mode; run();
      t.note('switch', { maxMove: r3(maxMove), maxRot: r3(maxRot), frames });
      t.eq(tp, 'tp', 'to TP'); t.eq(view.mode, 'fp', 'back to FP');
      t.ok(maxMove <= 0.30, 'per-frame move', maxMove); t.ok(maxRot <= 0.5, 'per-frame rotation', maxRot);
      t.ok(Math.abs(wrapAngle(view.yaw - y0)) < 1e-9 && Math.abs(view.pitch - p0) < 1e-9, 'look identical');
    }],
    // ---------------------------------------------------------------- lock-on camera (C1, simulated: WP4 calls view.lockOn)
    ['lock-on FP: eases only while look input is idle, ≤ 240°/s, into the 4° dead zone; any mouse input wins; setting off → nothing', (t) => {
      const { D, view, game } = t;
      // 30° off: inside WP4's break zone (TUNE.combat.lockOffDeg 40°), where the soft ease works (merged rule)
      stand(t); D.spawn('slime', 4, 30, { face: true }); const e = D.last; t.frames(2);
      view.lockOn(e);
      let maxRate = 0, prev = view.yaw;
      for (let i = 0; i < 90; i++) { t.frames(1); maxRate = Math.max(maxRate, Math.abs(wrapAngle(view.yaw - prev)) * 60 * R2D); prev = view.yaw; }
      const ey = view.simEye(new THREE.Vector3()), err = Math.abs(wrapAngle(yawOf(e.pos.x - ey.x, e.pos.z - ey.z) - view.yaw)) * R2D;
      const y0 = view.yaw; D.lookDelta(-40, 0); t.frames(1);
      const moved = wrapAngle(view.yaw - y0), want = 40 * 0.0022;
      t.note('lockFP', { maxRate: r3(maxRate), err: r3(err), mouse: r3(moved / want) });
      t.ok(maxRate <= 240.5 && maxRate > 30, 'ease rate ≤ 240°/s', maxRate);
      t.ok(err <= 4.5, 'settles inside the dead zone', err);
      t.near(moved, want, 1e-6, 'a mouse frame turns exactly by the mouse (no assist)');
      D.settings({ lockTurnsCamera: false }); D.look(view.yaw + 0.7, 0); const y1 = view.yaw; t.frames(30);
      t.near(view.yaw, y1, 1e-9, 'lockTurnsCamera off → no ease');
      view.lockOn(null);
    }],
    ['lock-on FP (r2): a look-away past WP4\'s 40° break zone is never pulled back (one inside still eases); the lock waits through dialogue; a boss in the air never tilts the view past lock.fpLiftPitch', (t) => {
      const { D, view, game } = t, K = 0.0022 * t.settings.get('sens');
      const off = (e) => { const ey = view.simEye(new THREE.Vector3()); return Math.abs(wrapAngle(yawOf(e.pos.x - ey.x, e.pos.z - ey.z) - view.yaw)) * R2D; };
      const flick = (deg, n) => { for (let i = 0; i < n; i++) { D.lookDelta(-(deg * D2R) / K / n, 0); t.frames(1); } };
      stand(t); D.spawn('slime', 4.5, 0, { face: true }); const e = D.last; D.freezeAI(true); t.frames(2);
      view.lockOn(e); t.frames(20);
      flick(60, 4); const a0 = off(e); t.frames(45); const a1 = off(e);
      const ey = view.simEye(new THREE.Vector3());
      D.look(yawOf(e.pos.x - ey.x, e.pos.z - ey.z), 0); t.frames(2); view.lockOn(e); t.frames(10);
      flick(32, 4); const b0 = off(e); t.frames(60); const b1 = off(e);
      view.lockOn(null);
      // dialogue: Shellby in front, a locked slime 70° to the side; the view stays on the speaker
      t.clearEnemies(); D.standAt('shellby'); const npc = game.npcs.find((n) => n.id === 'shellby');
      D.spawn('slime', 5, -70, { face: true }); const s = D.last; t.frames(2);
      view.lockOn(s); t.frames(2);
      game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
      t.frames(90);
      const lim = feelMod(t).cine.limit, drift = lim ? Math.abs(wrapAngle(view.yaw - lim.yaw)) * R2D : 99;
      t.dlgDone(); view.lockOn(null); t.clearEnemies(); t.frames(5);
      // Frostbun at 6.5 m right above Pip, locked, no look input: the pitch stays ≤ fpLiftPitch (the landing disc in view)
      D.cutscene('bossIntro', 'peaks'); t.frames(170);
      const f = game.fight, b = f && f.boss;
      let pmax = -99;
      if (b) {
        D.freezeAI(true); D.look(yawOf(b.pos.x - game.player.pos.x, b.pos.z - game.player.pos.z), 0); t.frames(1);
        view.lockOn(b); b.lift = 6.5; b.pos.y = b.arena.h + 6.5; b.prev.copy(b.pos);
        for (let i = 0; i < 60; i++) { t.frames(1); pmax = Math.max(pmax, view.pitch * R2D); }
        view.lockOn(null); b.lift = 0; b.pos.y = b.arena.h; b.prev.copy(b.pos); game.endFight(true);
      }
      t.note('lockFP2', { away: [r3(a0), r3(a1)], inside: [r3(b0), r3(b1)], talkDrift: r3(drift), liftPitch: r3(pmax) });
      t.ok(a0 > 50 && a1 >= a0 - 1, 'a 60° look-away stays put (no rubber band)', [a0, a1]);
      t.ok(b0 > 25 && b1 <= 5, 'a 32° glance inside the zone eases back', [b0, b1]);
      t.ok(drift <= 3, 'dialogue: the view stays on the speaker with a lock held', drift);
      t.ok(!!b && pmax <= TV.lock.fpLiftPitch + 0.5, 'leaping boss: pitch ≤ fpLiftPitch', pmax);
    }],
    ['lock-on TP: frames the target on the crosshair and Pip; Frostbun at 6.5 m lift stays in frame with Pip (feel §10.8)', (t) => {
      const { D, view, game } = t;
      D.setView('tp'); D.cutscene('bossIntro', 'peaks'); t.frames(170);
      const f = game.fight, b = f && f.boss;
      t.ok(f && f.phase === 'fight', 'peaks fight', f && f.phase);
      D.freezeAI(true);
      D.look(view.yaw + 1.1, -4 * D2R); t.frames(1);                       // look well away first
      view.lockOn(b); t.frames(120);
      const p = t.G.debug.cam.feel().lock.point, a = ndc(t, p[0], p[1], p[2]);
      const P = game.player.root.position, feet = ndc(t, P.x, P.y + 0.05, P.z), head = ndc(t, P.x, P.y + 0.95, P.z);
      b.lift = 6.5; b.pos.y = b.arena.h + 6.5; b.prev.copy(b.pos); t.frames(90);
      const top = ndc(t, b.pos.x, b.pos.y + b.height, b.pos.z), bot = ndc(t, b.pos.x, b.pos.y, b.pos.z);
      const feet2 = ndc(t, P.x, P.y + 0.05, P.z), head2 = ndc(t, P.x, P.y + 0.95, P.z);
      t.note('lockTP', { target: [r3(a.x), r3(a.y)], pip: [r3(feet.y), r3(head.y), r3(feet.x)], lift: { top: [r3(top.x), r3(top.y)], bot: r3(bot.y), feet: r3(feet2.y), head: r3(head2.y) }, rig: view.tp.info() });
      t.ok(Math.abs(a.x) < 0.15 && Math.abs(a.y) < 0.6, 'target near the crosshair', a);
      t.ok([feet, head].every((q) => Math.abs(q.x) < 1 && Math.abs(q.y) < 1), 'Pip in frame');
      t.ok([top, bot, feet2, head2].every((q) => Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1), 'lifted boss (top + bottom) and Pip in frame');
      view.lockOn(null); b.lift = 0; b.pos.y = b.arena.h; b.prev.copy(b.pos);
    }],
    // ---------------------------------------------------------------- cinematics
    ['dialogue FP: eases onto the face (centred, 42 % from the top) in ≈ 0.35 s, FOV −6, soft limit pulls a 60° look back to ≤ 25° (C14)', (t) => {
      const { D, view, game } = t;
      D.standAt('shellby'); const npc = game.npcs.find((n) => n.id === 'shellby');
      D.look(view.yaw + 40 * D2R, 0); t.frames(2);
      game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
      t.frames(28);
      const face = ndc(t, npc.pos.x, npc.pos.y + TV.talk.faceK * npc.height, npc.pos.z);
      t.frames(12);
      const fov = rel(t).fov;
      const y0 = feelMod(t).cine.limit.yaw;
      D.lookDelta(60 / (0.0022 * R2D), 0); t.frames(80);
      const off = Math.abs(wrapAngle(view.yaw - y0)) * R2D;
      t.note('talkFP', { faceX: r3(face.x), faceFromTop: r3(0.5 - face.y / 2), fov: r3(fov), off: r3(off), back: feelMod(t).cine.back });
      t.ok(Math.abs(face.x) < 0.08, 'face centred', face.x);
      t.near(0.5 - face.y / 2, TV.talk.faceAt, 0.05, 'face height on screen');
      t.near(fov, TV.ctx.talk, 0.5, 'FOV −6');
      t.ok(off <= 26, 'soft limit', off);
      t.dlgDone(); t.frames(40);
      t.near(rel(t).fov, 0, 0.05, 'FOV restored');
      t.eq(feelMod(t).cine.limit, null, 'limits released');
    }],
    ['dialogue TP: side two-shot swung toward Pip\'s back (the speaker\'s face shows), Pip left / speaker right, both in frame; hand-back faces the speaker', (t) => {
      const { D, view, game } = t;
      D.setView('tp'); D.standAt('ribbit'); const npc = game.npcs.find((n) => n.id === 'ribbit'); t.frames(5);
      game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
      t.frames(40);
      const P = game.player.root.position, N = npc.pos, pip = ndc(t, P.x, P.y + 0.6, P.z), sp = ndc(t, N.x, N.y + 0.6, N.z);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion), u = new THREE.Vector3(N.x - P.x, 0, N.z - P.z).normalize();
      const c = game.camera.position, side = (c.x - (P.x + N.x) / 2) * u.x + (c.z - (P.z + N.z) / 2) * u.z;
      // a pure 90° profile reads as two backs (Pip's hood hides his face): the shot sits TV.talk.shotAngle toward Pip's back
      t.note('twoShot', { shotW: view.shotW, pip: [r3(pip.x), r3(pip.y)], npc: [r3(sp.x), r3(sp.y)], dot: r3(fwd.dot(u)), side: r3(side) });
      t.ok(view.shotW > 0.99, 'shot in');
      t.ok(fwd.dot(u) > 0.2 && fwd.dot(u) < 0.75, 'camera beside the pair, swung toward Pip\'s back (40–78° off the line)', fwd.dot(u));
      t.ok(side < 0, 'camera on Pip\'s side of the midpoint (the speaker faces it)', side);
      t.ok(pip.x < sp.x, 'Pip left of the speaker', [pip.x, sp.x]);
      t.ok([pip, sp].every((q) => Math.abs(q.x) < 0.9 && Math.abs(q.y) < 0.9), 'both in frame');
      t.dlgDone(); t.frames(40);
      const bear = yawOf(N.x - game.player.pos.x, N.z - game.player.pos.z);
      t.ok(view.shotW === 0, 'shot out', view.shotW);
      t.ok(Math.abs(wrapAngle(view.yaw - bear)) < 3 * D2R, 'facing the speaker', wrapAngle(view.yaw - bear) * R2D);
    }],
    ['item-get: FP FOV −8 in the eye (no shot); TP front shot; the look never changes (C13)', async (t) => {
      const { D, view, game } = t;
      stand(t); const y0 = view.yaw;
      D.cutscene('itemGet'); t.frames(40);
      const fp = { fov: rel(t).fov, shot: view.shotW };
      t.dlgDone(); t.frames(40);
      const after = rel(t).fov;
      await t.wait(130);
      D.setView('tp'); D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -4 * D2R); t.frames(10);
      const y1 = view.yaw;
      D.cutscene('itemGet'); t.frames(40);
      const P = game.player.root.position, pip = ndc(t, P.x, P.y + 0.6, P.z), tp = view.shotW;
      t.dlgDone(); t.frames(40);
      t.note('item', { fp, after: r3(after), tp, pip: [r3(pip.x), r3(pip.y)], tpAfter: view.shotW });
      t.near(fp.fov, TV.ctx.item, 0.5, 'FP FOV −8'); t.eq(fp.shot, 0, 'FP: no shot'); t.near(after, 0, 0.05, 'FOV back');
      t.ok(tp > 0.99 && Math.abs(pip.x) < 0.8 && Math.abs(pip.y) < 0.9, 'TP shot with Pip in frame');
      t.eq(view.shotW, 0, 'TP shot out');
      t.ok(Math.abs(wrapAngle(view.yaw - y1)) < 1e-9, 'look unchanged');
    }],
    ['dizzy / death cam: FP topples (roll 72°, eye 0.28 m, looks at the sky); motion comfort: no roll, eye ≥ 0.5 (feel T51)', (t) => {
      const { D, view, game } = t;
      const run = (o) => {
        D.settings(o); D.god(false); stand(t);
        D.down(); let roll = 0, minEye = 9, pitch = -9;
        for (let i = 0; i < 100; i++) { t.frames(1); const r = rel(t); roll = Math.max(roll, Math.abs(r.roll)); minEye = Math.min(minEye, view.eye.y - game.player.root.position.y); pitch = Math.max(pitch, r.dp + view.pitch * R2D); }
        return { roll, minEye, pitch };
      };
      const full = run({ reduceMotion: false }), calm = run({ reduceMotion: true });
      t.note('dizzy', { full: { roll: r3(full.roll), eye: r3(full.minEye), pitch: r3(full.pitch) }, calm: { roll: r3(calm.roll), eye: r3(calm.minEye) } });
      t.near(full.roll, TV.dizzy.roll, 3, 'roll'); t.near(full.minEye, TV.dizzy.eye, 0.03, 'eye height'); t.ok(full.pitch > 15, 'looks up', full.pitch);
      t.ok(calm.roll < 1e-6, 'comfort: no roll', calm.roll); t.ok(calm.minEye >= 0.5 - 1e-3, 'comfort: eye ≥ 0.5', calm.minEye);
    }],
    ['eyelids: a new game opens them as the fade clears (looking up into the tree), the intro talk eases to Shellby', (t) => {
      const { game } = t, F = feelMod(t);
      game.newGame(); t.frames(1);
      const k0 = F.cine.lids.k, p0 = t.view.pitch * R2D;
      t.frames(100);
      const k1 = F.cine.lids.k;
      t.frames(80);
      const talk = F.cine.talk;
      t.note('wake', { k0, p0: r3(p0), k1, talk: talk && talk.npc.id, el: !!document.getElementById('wp1-eyelids') });
      t.eq(k0, 1, 'closed at the start'); t.ok(p0 > 25, 'looking up', p0); t.ok(k1 < 0.01, 'open by 1.7 s', k1);
      t.ok(talk && talk.npc.id === 'shellby' && talk.intro, 'intro talk framed');
      t.ok(!!document.getElementById('wp1-eyelids'), 'overlay element');
      t.dlgDone(); t.frames(5);
    }],
    // ---------------------------------------------------------------- regressions (review round 1)
    ['head bob after a long walk: swinging or dashing while walking never runs the bob backwards (per-frame |Δ bob| ≤ walking)', (t) => {
      const F = feelMod(t), pl = t.game.player;
      const run = (action) => {
        stand(t); pl.walkPhase = 212; t.move(0, 1); t.frames(70);       // walkPhase decays × 0.9 a step outside 'normal'
        const walk = [], act = [], ph = [];
        for (let i = 0; i < 30; i++) { t.frames(1); walk.push(F.fp.out.bobY); }
        t.press(action);
        for (let i = 0; i < 40; i++) { t.frames(1); act.push(F.fp.out.bobY); ph.push(F._s.phase); }
        t.move(0, 0); t.frames(20);
        const d = (a) => Math.max(...a.slice(1).map((v, i) => Math.abs(v - a[i])));
        return { walk: d(walk), act: d(act), back: ph.slice(1).filter((v, i) => v < ph[i] - 1e-9).length };
      };
      const a = run('attack'), b = run('dash');
      t.note('bobSwing', { attack: [r3(a.walk * 1000), r3(a.act * 1000), a.back], dash: [r3(b.walk * 1000), r3(b.act * 1000), b.back] });
      t.ok(a.act <= a.walk + 2e-4, 'swing: per-frame bob step ≤ walking (mm)', [a.walk * 1000, a.act * 1000]);
      t.ok(b.act <= b.walk + 2e-4, 'dash: per-frame bob step ≤ walking (mm)', [b.walk * 1000, b.act * 1000]);
      t.eq(a.back + b.back, 0, 'frames where the bob phase went backwards');
    }],
    ['invert left / right: the mouse (invertX) and the look stick (padInvertX) turn the other way; up / down is untouched', (t) => {
      const { D, view, settings } = t, K = 0.0022 * settings.get('sens');
      const mouse = () => { const y0 = view.yaw, p0 = view.pitch; D.lookDelta(40, 20); t.frames(1); return { yaw: wrapAngle(view.yaw - y0), pitch: view.pitch - p0 }; };
      const stick = () => { const y0 = view.yaw, p0 = view.pitch; D.pad(0.6, 0.3); t.frames(1); D.pad(null); return { yaw: wrapAngle(view.yaw - y0), pitch: view.pitch - p0 }; };
      D.setView('fp'); D.pose('meadow'); t.frames(3); t.clearEnemies(); D.look(view.yaw, 0); t.frames(2);
      try {
        const m0 = mouse(); settings.set('invertX', true); const m1 = mouse(); settings.set('invertX', false);
        const s0 = stick(); settings.set('padInvertX', true); const s1 = stick(); const mPad = mouse(); settings.set('padInvertX', false);
        t.note('invertX', { m0, m1, s0, s1, mPad });
        t.near(m0.yaw, -40 * K, 1e-9, 'mouse right turns right');
        t.near(m1.yaw, 40 * K, 1e-9, 'invertX: the same move turns left');
        t.near(m1.pitch, m0.pitch, 1e-9, 'invertX: up / down as before');
        t.ok(s0.yaw < -1e-4 && Math.abs(s1.yaw + s0.yaw) < 1e-9 && Math.abs(s1.pitch - s0.pitch) < 1e-9, 'padInvertX: the stick turns the other way, its up / down as before', { s0, s1 });
        t.near(mPad.yaw, m0.yaw, 1e-9, 'padInvertX leaves the mouse alone');
      } finally { settings.set('invertX', false); settings.set('padInvertX', false); D.pad(null); }
    }],
    ['V mid boss intro (TP → FP at 1.0 s): mouse look turns the view on the first fight frame, no look assist left', (t) => {
      const { D, view, game } = t;
      D.setView('tp'); D.cutscene('bossIntro', 'woods');
      let i = 0;
      for (; i < 240 && !(game.fight && game.fight.phase === 'intro' && game.fight.t >= 1.0); i++) t.frames(1);
      t.press('view'); t.frames(1);
      const mode = view.mode;
      for (; i < 480 && !(game.fight && game.fight.phase === 'fight'); i++) t.frames(1);
      const fight = !!(game.fight && game.fight.phase === 'fight'), y0 = view.yaw;
      D.lookDelta(60, 0); t.frames(1);
      const turned = Math.abs(wrapAngle(view.yaw - y0)), want = 60 * 0.0022 * t.settings.get('sens');
      t.note('introSwitch', { mode, fight, turned: r3(turned * R2D), want: r3(want * R2D), assist: !!view.assist });
      t.eq(mode, 'fp', 'switched to FP'); t.ok(fight, 'fight started');
      t.near(turned, want, 1e-6, 'the first fight frame turns exactly by the mouse');
      t.ok(!view.assist, 'no look assist left');
      game.endFight(true);
    }],
    ['TP shots fit their subjects: two-shot with the speaker 4.0 / 2.4 m away and on a portrait screen (390×844), item-get and boss intro on portrait', (t) => {
      const { D, view, game } = t, npc = game.npcs.find((n) => n.id === 'ribbit'), rows = [];
      const inside = (q, mx = 0.8, my = 0.95) => Math.abs(q.x) <= mx && Math.abs(q.y) <= my && q.z < 1;
      const talkAt = (dist, tag) => {
        D.setView('tp'); D.standAt('ribbit', 0, { dist }); t.frames(5);
        game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
        t.frames(45);
        const P = game.player.root.position, N = npc.pos;
        const r = { tag, d: r3(Math.hypot(N.x - P.x, N.z - P.z)), w: view.shotW, head: ndc(t, P.x, P.y + 0.95, P.z), chest: ndc(t, P.x, P.y + 0.5, P.z), face: ndc(t, N.x, N.y + TV.talk.faceK * npc.height, N.z), fov: r3(game.camera.fov) };
        t.dlgDone(); t.frames(30);
        return r;
      };
      let item = null, intro = null;
      try {
        rows.push(talkAt(4.0, '4 m'), talkAt(2.4, '2.4 m'));
        view.onResize(390, 844);
        rows.push(talkAt(1.3, 'portrait'), talkAt(2.4, 'portrait 2.4 m'));
        D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -4 * D2R); t.frames(10);
        D.cutscene('itemGet'); t.frames(40);
        const P = game.player.root.position;
        item = { w: view.shotW, head: ndc(t, P.x, P.y + 0.95, P.z), feet: ndc(t, P.x, P.y + 0.05, P.z) };
        t.dlgDone(); t.frames(30);
        D.cutscene('bossIntro', 'shores');
        for (let i = 0; i < 240 && !(game.fight && game.fight.phase === 'intro' && game.fight.t >= 1.5); i++) t.frames(1);
        const Q = game.player.root.position, b = game.fight && game.fight.boss;
        intro = { w: view.shotW, head: ndc(t, Q.x, Q.y + 0.95, Q.z), chest: ndc(t, Q.x, Q.y + 0.5, Q.z), boss: b ? ndc(t, b.pos.x, b.arena.h + b.height * 0.5, b.pos.z) : null };
        if (game.fight) game.endFight(true);
      } finally { view.onResize(window.innerWidth, window.innerHeight); }
      const f = (q) => q && [r3(q.x), r3(q.y)];
      t.note('fit', { rows: rows.map((r) => ({ ...r, head: f(r.head), chest: f(r.chest), face: f(r.face) })), item: item && { w: item.w, head: f(item.head), feet: f(item.feet) }, intro: intro && { w: intro.w, head: f(intro.head), boss: f(intro.boss) } });
      for (const r of rows) {
        t.ok(r.w > 0.99, r.tag + ': shot in', r.w);
        t.ok(inside(r.head) && inside(r.chest), r.tag + ': Pip inside 0.1–0.9 W', [f(r.head), f(r.chest)]);
        t.ok(inside(r.face), r.tag + ': speaker face inside 0.1–0.9 W', f(r.face));
        t.ok(r.head.x < r.face.x, r.tag + ': Pip left of the speaker');
      }
      t.ok(item && item.w > 0.9 && inside(item.head) && inside(item.feet, 0.8, 1), 'portrait item-get: Pip in frame', item && [f(item.head), f(item.feet)]);
      t.ok(intro && intro.w > 0.99 && inside(intro.head, 0.9) && inside(intro.chest, 0.9) && intro.boss && inside(intro.boss, 0.9), 'portrait boss intro: Pip and the boss in frame', intro && [f(intro.head), f(intro.boss)]);
    }],
    ['TP settings (r2): "Pip faces where you look" strafes with the body on the look; "Camera drifts behind Pip" eases a pad player\'s idle camera toward the travel, never for the mouse or when off', (t) => {
      const { D, view, game } = t, pl = game.player, input = game.input, dev0 = input.lastDevice;
      const run = (patch, device, frames) => {
        D.settings(patch); D.setView('tp'); D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -4 * D2R); t.frames(10);
        input.lastDevice = device; const y0 = view.yaw;
        t.move(1, 0); t.frames(frames); t.move(0, 0);
        const r = { turn: wrapAngle(view.yaw - y0) * R2D, body: wrapAngle(pl.facing - view.yaw) * R2D };
        t.frames(20);
        return r;
      };
      try {
        const faceOn = run({ tpBodyFacesCamera: true, tpAutoRecenter: false }, 'keyboard', 60), faceOff = run({ tpBodyFacesCamera: false, tpAutoRecenter: false }, 'keyboard', 60);
        const padOn = run({ tpBodyFacesCamera: false, tpAutoRecenter: true }, 'pad', 260), padOff = run({ tpBodyFacesCamera: false, tpAutoRecenter: false }, 'pad', 260);
        const mouse = run({ tpBodyFacesCamera: false, tpAutoRecenter: true }, 'mouse', 260);
        t.note('tpSettings', { faceOn, faceOff, padOn, padOff, mouse });
        t.ok(Math.abs(faceOn.body) < 6, 'faces the look while strafing', faceOn.body);
        t.ok(Math.abs(faceOff.body) > 60, 'off: turns to move', faceOff.body);
        t.ok(padOn.turn < -15, 'pad, recentre on: the camera drifts toward the travel (to the right)', padOn.turn);
        t.ok(Math.abs(padOff.turn) < 1e-6 && Math.abs(mouse.turn) < 1e-6, 'off / mouse: no drift', [padOff.turn, mouse.turn]);
      } finally { input.lastDevice = dev0; }
    }],
    ['look mods: L.inDyaw / inDpitch carry this frame\'s raw input every frame (none left over after a TP lock ends)', (t) => {
      const { D, view } = t, seen = [];
      D.setView('tp'); D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -4 * D2R); t.frames(10);
      D.spawn('slime', 4, 0, { face: true }); const e = D.last;
      const off = view.addLookMod((L) => seen.push({ in: L.inDyaw, raw: L.dyaw, lock: !!view.lockTarget }));
      try {
        view.lockOn(e); t.frames(5);
        D.lookDelta(-50, 0); t.frames(1);
        const locked = seen[seen.length - 1];
        view.lockOn(null); t.frames(3); D.setView('fp'); t.frames(3);
        const after = seen.slice(-6);
        t.note('inDyaw', { locked, after });
        t.ok(locked.lock && Math.abs(locked.in - 50 * 0.0022 * t.settings.get('sens')) < 1e-9, 'locked: raw input kept', locked);
        t.ok(after.every((q) => !q.lock && q.in === q.raw), 'unlocked: inDyaw is this frame\'s input', after);
      } finally { off(); view.lockOn(null); }
    }],
    ['TP arm: the release never grows > 4·dt·boom (also looking down, where the boom is longer); the first frame after a snap next to a round tree is never inside its trunk', (t) => {
      const { D, W, view, game } = t;
      D.setView('tp'); D.teleport(FLAT[0], FLAT[1], Math.PI / 2, -30 * D2R); t.frames(20);
      view.tp.arm = 0.3;
      let grow = 0, prev = view.tp.arm;
      for (let i = 0; i < 90; i++) { game.runFrame(1 / 60, true, false); if (view.tp.arm - prev > 4 * (1 / 60) * view.tp.boom + 1e-9) grow++; prev = view.tp.arm; }
      // round trees: Pip just outside the trunk, the boom straight through it (looking away), level and looking down
      const near = [], trees = W.colliders.filter((q) => q.kind === 'tree_round' && Math.hypot(q.x, q.z) < 160).slice(0, 14);
      let snaps = 0, inside = 0, worst = 9;
      for (const c of trees) for (let k = 0; k < 4; k++) for (const pitch of [-0.006, -0.48]) {
        const a = k * Math.PI / 2 + 0.3, x = c.x + Math.sin(a) * (c.r + 0.45), z = c.z + Math.cos(a) * (c.r + 0.45);
        if (!W.walkable(x, z)) continue;
        D.teleport(x, z, yawOf(x - c.x, z - c.z), pitch); game.runFrame(1 / 60, true, false); snaps++;
        const p = game.camera.position;
        W.nearColliders(p.x, p.z, 3, near);
        for (const q of near) { if (q.camTop == null || p.y < q.y0 || p.y > q.camTop) continue; const s = Math.hypot(p.x - q.x, p.z - q.z) - q.r; worst = Math.min(worst, s); if (s < 0) inside++; }
      }
      t.note('armCaps', { grow, snaps, inside, worst: r3(worst), arm: r3(view.tp.arm) });
      t.eq(grow, 0, 'frames growing > 4·dt·boom looking down 30°');
      t.ok(snaps >= 20, 'snaps next to round trees', snaps);
      t.eq(inside, 0, 'first frames inside a collider');
    }],
    // ---------------------------------------------------------------- regressions (integration round 2, part 2)
    ['r2: the boss fight\'s +3 FOV eases in at the intro hand-back and out at the defeat (≤ 1° a frame; it popped 3° in one frame)', (t) => {
      const { D, game } = t, F = feelMod(t), rec = [];
      D.setView('fp'); D.cutscene('bossIntro', 'woods');
      let k = -1;
      for (let i = 0; i < 400; i++) {
        t.frames(1);
        rec.push(game.camera.fov);
        if (k < 0 && game.fight && game.fight.phase === 'fight') k = i;
        if (k >= 0 && i >= k + 50) break;
      }
      const ctxIn = F.fp.ctx, step = (a) => Math.max(...a.slice(1).map((v, i) => Math.abs(v - a[i])));
      const hand = k > 10 ? step(rec.slice(k - 10)) : 99;
      // the defeat: the phase turns 'won' (as the boss's death does; not killed here — a beaten boss would change the world
      // for every later suite, and endFight(true) with Pip in the arena starts a new intro), the channel eases out
      game.fight.phase = 'won'; game.fight.wonT = 0;
      const out = [game.camera.fov];
      for (let i = 0; i < 45; i++) { t.frames(1); out.push(game.camera.fov); }
      const won = step(out), ctxOut = F.fp.ctx;
      game.endFight(true);
      t.note('fightFov', { handBack: k, ctxIn: r3(ctxIn), stepIn: r3(hand), stepOut: r3(won), ctxOut: r3(ctxOut) });
      t.ok(k > 0, 'the fight started', k);
      t.near(ctxIn, TV.ctx.fight, 0.05, 'fight FOV channel in');
      t.ok(hand <= 1.0, 'per-frame FOV step through the hand-back ≤ 1°', hand);
      t.ok(won <= 1.0, 'per-frame FOV step at the defeat (phase won) ≤ 1°', won);
      t.near(ctxOut, 0, 0.05, 'fight FOV channel out');
    }],
    ['r2: dizzy in TP and V mid-topple: the camera never jumps (≤ 0.25 m a frame; the pivot drop snapped the shoulder in, 0.5–0.8 m)', (t) => {
      const { D, game } = t;
      const run = (mode, vAt) => {
        t.resetPlayer(); D.god(false); D.setView(mode); stand(t);   // (100 frames stay short of the 1.9 s respawn fade)
        D.down();
        let worst = 0;
        const prev = game.camera.position.clone();
        for (let i = 0; i < 100; i++) { if (i === vAt) t.press('view'); t.frames(1); if (i > 0) worst = Math.max(worst, game.camera.position.distanceTo(prev)); prev.copy(game.camera.position); }
        return r3(worst);
      };
      const tp = run('tp', -1), sw = run('fp', 20);
      t.resetPlayer(); if (game.ui.setDizzy) game.ui.setDizzy(false);
      t.note('dizzyJump', { tp, switch: sw });
      t.ok(tp <= 0.25, 'TP dizzy: largest per-frame camera move', tp);
      t.ok(sw <= 0.25, 'V 20 frames into the topple: largest per-frame camera move', sw);
    }],
    ['r2: TP dialogue at Miso\'s counter: no fish-eye (FOV ≤ talk.fovMaxV), the camera ≥ talk.minLook off its look point, both faces in front and in frame, Pip left', (t) => {
      const { D, view, game } = t, npc = game.npcs.find((n) => n.id === 'miso'), rows = [];
      for (const dist of [null, 1.8]) {
        D.setView('tp'); D.standAt('miso', 0, dist ? { dist } : {}); t.frames(5);
        game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
        t.frames(45);
        const P = game.player.root.position, N = npc.pos, c = game.camera.position;
        const head = ndc(t, P.x, P.y + 0.95, P.z), face = ndc(t, N.x, N.y + TV.talk.faceK * npc.height, N.z);
        rows.push({ dist, w: view.shotW, fov: r3(game.camera.fov), toMiso: r3(c.distanceTo(N)), head: [r3(head.x), r3(head.y), head.z < 1], face: [r3(face.x), r3(face.y), face.z < 1] });
        for (let i = 0; i < 10 && (game.ui.dlg || game.ui.shop); i++) { if (game.ui.shop) game.ui.closeShop(); else t.dlgDone(); t.frames(2); }
        t.frames(30);
      }
      t.note('miso', rows);
      const cap = Math.max(feelMod(t).cine.shotFov(TV.talk.shotFovH), TV.talk.fovMaxV) + 0.1;
      for (const r of rows) {
        const tag = r.dist ? r.dist + ' m' : 'counter';
        t.ok(r.w > 0.99 && r.fov <= cap, tag + ': shot in, FOV capped', r);
        t.ok(r.toMiso >= 1.2, tag + ': the camera is not at the speaker', r.toMiso);
        t.ok(r.head[2] && r.face[2] && Math.abs(r.head[0]) < 0.9 && Math.abs(r.face[0]) < 0.9 && Math.abs(r.head[1]) < 0.95 && Math.abs(r.face[1]) < 0.95, tag + ': Pip and Miso in frame, in front of the camera', r);
        t.ok(r.head[0] < r.face[0], tag + ': Pip left of the speaker', r);
      }
    }],
    ['r2: FP dialogue with a speaker that hops back (0.8 m): the eye backs off for where she lands — eye ↔ face 1.8 m, the face at talk.faceAt (both were corrected twice)', (t) => {
      const { D, view, game } = t, npc = game.npcs.find((n) => n.id === 'ribbit');
      D.setView('fp'); D.standAt('ribbit', 0, { dist: 0.8 }); t.frames(20);
      game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
      t.frames(60);
      const fy = npc.pos.y + (npc.hop || 0) + TV.talk.faceK * npc.height, q = ndc(t, npc.pos.x, fy, npc.pos.z);
      const d = Math.hypot(npc.pos.x - view.eye.x, npc.pos.z - view.eye.z), fromTop = 0.5 - q.y / 2, want = feelMod(t).cine.faceAt();
      t.note('hopTalk', { d: r3(d), fromTop: r3(fromTop), want, hop: r3(Math.hypot(npc.pos.x - game.player.pos.x, npc.pos.z - game.player.pos.z)) });
      t.near(d, TV.talk.near, 0.06, 'eye ↔ face (m)');
      t.near(fromTop, want, 0.03, 'face height on screen');
      t.dlgDone();
    }],
    ['r2: TP with Pip\'s back to the altar: the camera sees Pip past the slab or comes into his head, never behind the slab', (t) => {
      const { D, W, view, game } = t, P = W.pedestal || { x: 0, z: 7.3 }, rows = [];
      const only = { terrain: false, water: false, decks: false, ignore: (q) => q.kind !== 'pedestal' };
      D.setView('tp');
      for (const [dx, a] of [[0, 0], [0.45, 0], [-0.45, 0], [0.35, 0.45], [-0.35, -0.45], [0.8, 0.3]]) {
        D.teleport(P.x + dx, P.z + 0.75, a, -4 * D2R); t.frames(40);
        // the pivot over his head, or ± tpSightW across it, in sight past the slab (RigTP.sees' three points)
        const c = game.camera.position, pv = view.tp.pivot, rx = -Math.cos(view.yaw), rz = Math.sin(view.yaw), w = TV.tpSightW;
        const clear = [0, w, -w].some((s) => W.probeSegment(c, _v.set(pv.x + rx * s, pv.y, pv.z + rz * s), 0.04, only) >= 1);
        rows.push({ dx, a, arm: r3(view.tp.arm), clear, fade: r3(view.bodyFade) });
      }
      t.note('altarSight', rows);
      t.ok(rows.every((r) => r.clear || r.fade < 0.05), 'camera sees Pip past the altar, or Pip is hidden (the camera in his head)', rows);
    }],
    ['r2: TP standing still with a thin trunk ≈ 1 m in front of the camera (the boom crossed it): the camera eases round it within 1.5 s, off the crosshair ray, without a pop', (t) => {
      const { D, W, view, game } = t;
      D.setView('tp');
      const res = [];
      for (const c of W.colliders.filter((q) => q.kind === 'tree_round' && q.shape !== 'obb')) {
        if (res.length >= 2) break;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2, x = c.x + Math.sin(a) * 1.6 + Math.cos(a) * TV.tpShoulder, z = c.z + Math.cos(a) * 1.6 - Math.sin(a) * TV.tpShoulder;
          if (!W.walkable(x, z)) continue;
          const near = []; W.nearColliders(x, z, 3.2, near);
          if (near.some((q) => q !== c && q.active !== false && q.camTop != null && q.camTop > W.hAt(q.x, q.z) + 0.5)) continue;
          D.teleport(x, z, a, -4 * D2R);   // facing away: the trunk stands on the boom, 1.0 m in front of the camera
          let onX = 0, pop = 0, first = null;
          const prev = new THREE.Vector3();
          for (let i = 0; i < 100; i++) {
            t.frames(1);
            const cp = game.camera.position, fx = Math.sin(view.yaw), fz = Math.cos(view.yaw);
            const along = (c.x - cp.x) * fx + (c.z - cp.z) * fz, lat = Math.abs((c.x - cp.x) * fz - (c.z - cp.z) * fx);
            const on = along > 0 && along < 2.5 && lat < c.r + 0.1;
            if (i === 2) first = on;
            if (i >= 90 && on) onX++;
            if (i > 0) pop = Math.max(pop, cp.distanceTo(prev));
            prev.copy(cp);
          }
          res.push({ tree: [r3(c.x), r3(c.z)], first, onX, pop: r3(pop), side: r3(view.tp.side) });
          break;
        }
      }
      t.note('trunk', res);
      t.ok(res.length >= 2, 'placements found', res.length);
      t.ok(res.every((r) => r.first), 'the trunk starts on the crosshair ray', res);
      t.ok(res.every((r) => r.onX === 0), 'off the crosshair ray by 1.5 s', res);
      t.ok(res.every((r) => r.pop <= 0.2), 'no pop (≤ 0.2 m a frame)', res);
    }],
    ['r2: the eyelids sit above the crosshair (the ending\'s blink-back resets the crane under closed lids: the target ring floated on them)', (t) => {
      const lids = document.getElementById('wp1-eyelids'), cross = document.getElementById('crosshair');
      t.ok(!!lids && !!cross && lids.parentNode === cross.parentNode, 'both in #ui');
      t.ok(!!(cross.compareDocumentPosition(lids) & Node.DOCUMENT_POSITION_FOLLOWING), 'eyelids after (above) the crosshair');
    }],
    ['r2 part 3: a real jump lands with the full dip (the eye filter is re-seeded: 7.4 ± 1.0 cm at 72 ± 17 ms, feel T18; it was 5.7 cm at 100 ms); walking the peaks path the eye smooths the terrain kinks (accel max ≤ 12 m/s², p95 ≤ half the feet\'s; it was 34 / 0.64)', (t) => {
      const { D, W, game, view } = t, pl = game.player;
      stand(t);
      t.hold('jump');
      const rel = []; let land = -1;
      for (let i = 0; i < 80; i++) {
        t.frames(1);
        if (land < 0 && t.events('land').length) land = i;
        if (land >= 0) rel.push(game.camera.position.y - (W.ground(pl.pos.x, pl.pos.z) + TV.eyeH));
      }
      t.release('jump');
      const d = rel.slice(0, 40), min = Math.min(...d), at = d.indexOf(min) + 1, over = Math.max(0, ...d.slice(at));
      // peaks path: eye base (fp.eyeY) vs the interpolated feet, per-frame second differences
      D.pose('peaks'); t.frames(20); t.move(0, 1);
      const ey = [], fy = [], lag = [];
      for (let i = 0; i < 180; i++) { t.frames(1); ey.push(view.fp.eyeY); fy.push(pl.root.position.y); lag.push(Math.abs(pl.root.position.y + TV.eyeH - view.fp.eyeY)); }
      t.move(0, 0);
      const acc = (a) => a.slice(12).map((y, i) => Math.abs(y - 2 * a[i + 11] + a[i + 10]) * 3600).sort((x, y) => x - y);
      const ae = acc(ey), af = acc(fy), p95 = (s) => s[Math.floor(s.length * 0.95)];
      t.note('land+slope', { landFrame: land, dip: r3(min), atMs: Math.round((at * 1000) / 60), over: r3(over * 1000), eye: [r3(p95(ae)), r3(ae[ae.length - 1])], feet: [r3(p95(af)), r3(af[af.length - 1])], lagMax: r3(Math.max(...lag)) });
      t.ok(land >= 0, 'landed');
      t.near(-min, 0.074, 0.010, 'landing dip (m)');
      t.near(at / 60, 0.072, 0.017, 'dip peak time (s)');
      t.ok(over <= 0.009, 'overshoot ≤ 9 mm', over);
      t.ok(ae[ae.length - 1] <= 12, 'eye accel max ≤ 12 m/s²', ae[ae.length - 1]);
      t.ok(p95(ae) <= 0.5 * p95(af), 'eye accel p95 ≤ half the feet\'s', [p95(ae), p95(af)]);
      t.ok(Math.max(...lag) <= 0.25, 'eye lag ≤ 0.25 m', Math.max(...lag));
    }],
    ['r2 part 3: TP at uneven frame times — a steady 4.4 m/s walk moves the camera at 4.4 m/s every frame (it wobbled 3.9–4.7); orbiting past a post the side leg never jumps (it pulled in 8 cm in one frame: 9.8 m/s against 5.2)', (t) => {
      const { D, view, game } = t;
      const DT = [1 / 60, 1 / 40, 1 / 90, 1 / 60, 1 / 30, 1 / 120, 1 / 50, 1 / 75];
      D.setView('tp'); D.teleport(FLAT[0] - 4, FLAT[1], Math.PI / 2, 0); t.frames(20);
      t.move(0, 1); t.frames(40, { dt: DT });
      const f = { x: Math.sin(view.yaw), z: Math.cos(view.yaw) }, v = [], prev = game.camera.position.clone();
      for (let i = 0; i < 160; i++) { const dt = DT[i % DT.length]; t.frames(1, { dt }); const c = game.camera.position; v.push(((c.x - prev.x) * f.x + (c.z - prev.z) * f.z) / dt); prev.copy(c); }
      t.move(0, 0);
      const vs = v.slice(16), walk = [r3(Math.min(...vs)), r3(Math.max(...vs))];
      // standing orbit 1.2 m from a village lamp post at a constant stick (the side leg sweeps over it)
      t.resetPlayer(); D.teleport(FLAT[0] - 2, FLAT[1] + 4, Math.PI / 2, -4 * D2R); t.frames(40);
      D.pad(0.7, 0); t.frames(20);
      const o = []; let legMin = 1;
      prev.copy(game.camera.position);
      for (let i = 0; i < 200; i++) { t.frames(1); o.push(game.camera.position.distanceTo(prev) * 60); prev.copy(game.camera.position); legMin = Math.min(legMin, view.tp.legF); }
      D.pad(null);
      const med = [...o].sort((a, b) => a - b)[o.length >> 1], dv = Math.max(...o.slice(1).map((x, i) => Math.abs(x - o[i])));
      t.note('tpSmooth', { walk, orbit: { med: r3(med), max: r3(Math.max(...o)), dv: r3(dv), legMin: r3(legMin) } });
      t.ok(walk[0] >= 4.35 && walk[1] <= 4.45, 'TP camera speed behind a 4.4 m/s walk at uneven frame times', walk);
      t.ok(legMin < 0.95, 'the orbit brings the post into the side leg', legMin);
      t.ok(Math.max(...o) - med <= 1.4, 'orbit camera speed ≤ the steady orbit + 1.4 m/s', [med, Math.max(...o)]);
      t.ok(dv <= 0.8, 'orbit camera speed changes ≤ 0.8 m/s between frames', dv);
    }],
    ['r2 part 3: touch look accelerates with the finger speed (feel §3.4: × (1 + smoothstep(400, 1600, px/s))): a 400 px flick turns 2× a slow 400 px swipe', (t) => {
      const { view, game } = t, inp = game.input;
      // (n frames of px / n each at 60 Hz, the per-frame yaw steps summed: 400 px at 2× turns 229°)
      const turn = (px, n) => { stand(t); t.frames(10); let d = 0, y = view.yaw; for (let i = 0; i < n; i++) { inp.touchLook.x -= px / n; t.frames(1); d += wrapAngle(view.yaw - y); y = view.yaw; } t.frames(2); return d; };
      const slow = turn(400, 72), flick = turn(400, 6), mid = turn(400, 24);
      t.note('touch', { slow: r3(slow * R2D), flick: r3(flick * R2D), mid: r3(mid * R2D) });
      t.near(flick / slow, 2, 0.02, 'flick (4000 px/s) / slow (333 px/s)');
      t.near(mid / slow, 1.5, 0.03, '1000 px/s / slow');
    }],
    ['r2 part 3: a portrait screen (390×844, vFOV 100°) shortens the TP boom with the vertical FOV: Pip ≥ 20 % of the height (was 15 %), the arm ≥ tpNarrowMin; 16:9 keeps the full boom', (t) => {
      const { D, view } = t;
      let f = null, arm = 0;
      try {
        view.onResize(390, 844);
        D.setView('tp'); D.teleport(-1.5, 9.2, Math.PI - 0.25, TV.tpPitch * D2R); t.frames(60, { draw: true });
        f = D.cam.framing(); arm = view.armLen;
      } finally { view.onResize(window.innerWidth, window.innerHeight); }
      t.frames(60, { draw: true });
      const arm169 = view.armLen;
      t.note('portrait', { pipH: f && f.pipH, pipCx: f && f.pipCx, clearM: f && f.clearM, arm: r3(arm), arm169: r3(arm169) });
      t.ok(f && f.pipH >= 0.20, 'portrait Pip height share', f && f.pipH);
      t.ok(arm >= TV.tpNarrowMin - 0.01 && arm <= TV.tpNarrowMin + 0.05, 'portrait arm ≈ tpNarrowMin', arm);
      t.ok(Math.abs(arm169 - TV.tpBoom) < 0.02, '16:9 arm = tpBoom', arm169);
    }],
    ['r3: TP lock-on walk-in: Pip walks from 6 m into a locked slime and the camera turns ≤ 15°, ≤ 45°/s over any 0.25 s, the slime in frame (the shoulder parallax swung it 57° at ≈ 115°/s)', (t) => {
      const { D, view, game } = t;
      D.setView('tp'); D.pose('meadow'); D.look(0, -0.1); t.frames(10);
      D.spawn('slime', 6, 0); const e = D.last; D.freezeAI(true); t.frames(2);
      if (game.setLock) game.setLock(e, 'toggle'); else view.lockOn(e);
      t.frames(40);
      const y = [];
      D.move(0, 1);
      for (let i = 0; i < 120; i++) { t.frames(1); y.push(view.yaw); }
      D.move(0, 0);
      const d = (a, b) => Math.abs(wrapAngle(a - b)) * R2D;
      let swing = 0, peak = 0;
      for (let i = 1; i < y.length; i++) swing += wrapAngle(y[i] - y[i - 1]) * R2D;
      for (let i = 15; i < y.length; i++) peak = Math.max(peak, d(y[i], y[i - 15]) * 4);
      const P = game.player.pos, q = ndc(t, e.pos.x, e.pos.y + 0.3, e.pos.z);
      t.note('lockWalk', { swing: r3(swing), peak: r3(peak), dist: r3(Math.hypot(e.pos.x - P.x, e.pos.z - P.z)), slime: [r3(q.x), r3(q.y)], locked: view.lockTarget === e });
      t.ok(view.lockTarget === e, 'still locked');
      t.ok(Math.hypot(e.pos.x - P.x, e.pos.z - P.z) < 1.5, 'Pip walked in', Math.hypot(e.pos.x - P.x, e.pos.z - P.z));
      t.ok(Math.abs(swing) <= 15, 'camera yaw swing ≤ 15°', swing);
      t.ok(peak <= 45, 'peak turn rate ≤ 45°/s (0.25 s window)', peak);
      t.ok(Math.abs(q.x) < 0.6 && Math.abs(q.y) < 1 && q.z < 1, 'the slime stays in frame', q);
      if (game.setLock) game.setLock(null); else view.lockOn(null);
    }],
    ['r3: a short TP arm (Pip\'s back to a house wall, arm 1.2–2.1 m) keeps his feet on screen (the camera point drops); the open 2.6 m boom does not drop', (t) => {
      const { D, W, view, game } = t;
      D.setView('tp'); D.pose('meadow'); D.look(view.yaw, TV.tpPitch * D2R); t.frames(60);
      const open = { drop: view.tp.drop, arm: view.tp.arm };
      const free = (x, z) => { if (!W.walkable(x, z)) return false; const n = []; W.nearColliders(x, z, 6, n); return n.every((c) => c.active === false || W.colliderDist(c, x, z) >= 0.4); };
      const rows = [];
      for (const h of (W.houses || []).slice(0, 6)) {
        for (const a of [0.4, 2.0, 3.6, 5.2]) {
          let q = null;
          for (let d = 0.5; d < 14 && !q; d += 0.05) { const x = h.x + Math.sin(a) * d, z = h.z + Math.cos(a) * d; if (free(x, z)) q = { x: x + Math.sin(a) * 1.3, z: z + Math.cos(a) * 1.3 }; }
          if (!q || !free(q.x, q.z)) continue;
          D.teleport(q.x, q.z, a, TV.tpPitch * D2R); t.frames(50, { draw: false });
          if (view.tp.arm < 1.2 || view.tp.arm > 2.1 || view.bodyFade < 0.99) continue;
          const P = game.player.root.position, feet = ndc(t, P.x, P.y + 0.02, P.z), head = ndc(t, P.x, P.y + 1.0, P.z);
          rows.push({ h: [r3(h.x), r3(h.z)], a, arm: r3(view.tp.arm), drop: r3(view.tp.drop), feet: r3(feet.y), head: r3(head.y) });
          if (rows.length >= 4) break;
        }
        if (rows.length >= 4) break;
      }
      t.note('feet', { open, rows });
      t.ok(open.arm > 2.5 && open.drop === 0, 'the open boom keeps its height', open);
      t.ok(rows.length >= 1, 'found a short-arm pose by a house', rows.length);
      t.ok(rows.every((r) => r.feet >= -0.97 && r.head <= 1), 'feet (and head) on screen with the arm 1.2–2.1 m', rows);
    }],
    ['r3: TP lock on a boss lifted 6.5 m: the steep look up does not fold the long boom into the ground behind Pip (arm ≥ 3.6 m; it was 2.7 m and the boss\'s middle left the frame)', (t) => {
      const { D, view, game } = t;
      D.setView('tp'); D.cutscene('bossIntro', 'peaks'); t.frames(170);
      const f = game.fight, b = f && f.boss;
      t.ok(f && f.phase === 'fight', 'peaks fight', f && f.phase);
      D.freezeAI(true); view.lockOn(b); t.frames(90);
      b.lift = 6.5; b.pos.y = b.arena.h + 6.5; b.prev.copy(b.pos); t.frames(60);
      const hb = b.hurtbox({}), mid = ndc(t, hb.x, (hb.y0 + hb.y1) / 2, hb.z), P = game.player.root.position, head = ndc(t, P.x, P.y + 0.95, P.z);
      t.note('liftArm', { arm: r3(view.tp.arm), lift: r3(view.tp.lift), pitch: r3(view.pitch * R2D), mid: [r3(mid.x), r3(mid.y)], head: [r3(head.x), r3(head.y)] });
      t.ok(view.tp.arm >= 3.6, 'lock boom kept', view.tp.arm);
      t.ok([mid, head].every((q) => Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1), 'the boss\'s middle and Pip\'s head in frame', { mid, head });
      view.lockOn(null); b.lift = 0; b.pos.y = b.arena.h; b.prev.copy(b.pos);
    }],
    ['r4 TP talk two-shot: the speaker\'s face is never behind Pip — Elder Shellby from her altar side (+60°, 1.3 / 2 m, standAt) and Ribbit at 1.6 m from five bearings', (t) => {
      const { D, game, view } = t;
      const cine = game.modules.find((m) => m && m.name === 'wp1-feel').cine, rows = [];
      const talk = (id, at) => {
        const npc = game.npcs.find((n) => n.id === id);
        D.setView('tp', { instant: true });
        if (at) { const a = npc.facing + at[1] * D2R; D.teleport(npc.pos.x + Math.sin(a) * at[0], npc.pos.z + Math.cos(a) * at[0], a + Math.PI, 0); } else D.standAt(id);
        t.frames(5);
        game.interact({ o: npc, kind: 'npc', px: npc.pos.x, py: npc.pos.y + 0.62 * npc.height, pz: npc.pos.z });
        t.frames(45);
        const P = game.player.root.position, N = npc.pos, cam = game.camera.position, f = D.cam.framing();
        const face = ndc(t, N.x, N.y + TV.talk.faceK * npc.height, N.z), fx = (face.x + 1) / 2, fy = (1 - face.y) / 2;
        const covered = f.pipLeft != null && fx > f.pipLeft && fx < f.pipRight && fy > f.pipTop && fy < f.pipBottom;
        rows.push({ id, at: at ? at.join('/') : 'standAt', pick: cine.talk && cine.talk.pick, w: r3(view.shotW), covered, hides: cine.pipHides(cam, { x: N.x, y: N.y + TV.talk.faceK * npc.height, z: N.z }, P), face: [r3(fx), r3(fy)], pip: [f.pipLeft, f.pipRight, f.pipTop, f.pipBottom] });
        t.dlgDone(); t.frames(30);
      };
      try {
        for (const at of [[1.3, 60], [2.0, 60], null]) talk('shellby', at);
        for (const b of [-60, -30, 0, 30, 60]) talk('ribbit', [1.6, b]);
      } finally { D.setView('fp', { instant: true }); t.frames(2); }
      t.note('talk', rows);
      t.ok(rows.every((r) => r.w > 0.9), 'every talk in its shot', rows.map((r) => r.w));
      t.ok(rows.every((r) => !r.covered && !r.hides), 'the face clear of Pip (his box, and the camera\'s line to it)', rows);
    }],
    ['r4 G.debug.aimAt in third person: with the arm shortened by a wall behind Pip (or slid), the crosshair ray passes through the point (it assumed the nominal boom and shoulder)', (t) => {
      const { D, W, view, game } = t;
      D.setView('tp', { instant: true }); t.frames(2);
      const miss = (q) => {
        const c = game.camera.position, d = new t.THREE.Vector3(); game.camera.getWorldDirection(d);
        const v = new t.THREE.Vector3(q.x - c.x, q.y - c.y, q.z - c.z), k = v.dot(d);
        return v.addScaledVector(d, -k).length();
      };
      // spots around the village where a collider behind Pip shortens the arm (the rig as a pure query)
      const spots = [];
      for (let i = 0; i < 900 && spots.length < 4; i++) {
        const x = W.spawn.x - 30 + ((i * 37) % 60) + 0.5, z = W.spawn.z - 30 + ((i * 53) % 60) + 0.5, yaw = (i * 2.399) % (Math.PI * 2), n = [];
        if (!W.walkable(x, z)) continue;
        W.nearColliders(x, z, 6, n);
        if (!n.every((c) => c.active === false || W.colliderDist(c, x, z) >= 0.4)) continue;
        if (D.armProbe(x, z, yaw).armLen < TV.tpBoom - 0.6) spots.push({ x, z, yaw });
      }
      const rows = [];
      for (const q of spots) {
        D.teleport(q.x, q.z, q.yaw, 0); t.frames(30);
        const tgt = { x: q.x + Math.sin(q.yaw + 0.35) * 5, z: q.z + Math.cos(q.yaw + 0.35) * 5 };
        tgt.y = W.ground(tgt.x, tgt.z) + 0.8;
        D.aimAt(tgt.x, tgt.y, tgt.z); t.frames(60);
        rows.push({ x: r3(q.x), z: r3(q.z), arm: r3(view.tp.arm), side: r3(view.tp.side), miss: r3(miss(tgt)) });
      }
      t.note('aimAt', rows);
      t.ok(rows.length >= 3 && rows.some((r) => r.arm < TV.tpBoom - 0.4) && rows.some((r) => Math.abs(r.side - 1) > 0.2), 'poses with a shortened arm and a slid one', rows);
      t.ok(rows.every((r) => r.miss <= 0.06), 'the crosshair ray within 6 cm of the point', rows);
    }],
    ['r3: backing into the altar the TP camera never jumps (≤ 0.3 m a frame; the wall verdict snapped the arm 1.2 m) and ends seeing Pip or in his head', (t) => {
      const { D, W, view, game } = t;
      const pd = W.colliders.find((c) => c.kind === 'pedestal'), rows = [];
      t.ok(!!pd, 'pedestal collider');
      if (!pd) return;
      D.setView('tp');
      for (const a of [0.3, 1.35, 2.4, 4.0]) {
        let q = null;
        for (let d = 3.5; d < 9 && !q; d += 0.05) { const x = pd.x + Math.sin(a) * d, z = pd.z + Math.cos(a) * d, n = []; W.nearColliders(x, z, 6, n); if (W.walkable(x, z) && n.every((c) => c.active === false || W.colliderDist(c, x, z) >= 0.4)) q = { x, z }; }
        if (!q) continue;
        D.teleport(q.x, q.z, a, -4 * D2R); t.frames(40);
        const cam = game.camera.position, prev = cam.clone();
        let mx = 0;
        D.move(0, -1);
        for (let i = 0; i < 110; i++) { t.frames(1); mx = Math.max(mx, cam.distanceTo(prev)); prev.copy(cam); }
        D.move(0, 0); t.frames(30);
        // r4: where Pip is drawn, his head and chest are in the frame (NDC)
        const P = game.player.root.position, ndc = (y) => { const v = new t.THREE.Vector3(P.x, P.y + y, P.z).project(game.camera); return [r3(v.x), r3(v.y)]; };
        rows.push({ a, maxMove: r3(mx), arm: r3(view.tp.arm), fade: r3(view.bodyFade), sighted: view.tp.sighted, head: ndc(0.95), chest: ndc(0.5) });
      }
      t.note('altarBack', rows);
      t.ok(rows.length >= 2, 'walk-back poses', rows.length);
      t.ok(rows.every((r) => r.maxMove <= 0.3), 'no camera jump', rows);
      // r4: the second half of this test's name was never checked (a camera that neither sees Pip nor sits in his head,
      // the round-2 altar complaint, passed)
      t.ok(rows.every((r) => r.sighted || r.fade < 0.05), 'ends seeing Pip or in his head (hidden)', rows);
      const inF = (q) => Math.abs(q[0]) < 1 && Math.abs(q[1]) < 1;
      t.ok(rows.every((r) => r.fade <= 0.9 || (inF(r.head) && inF(r.chest))), 'Pip drawn → his head and chest in the frame', rows);
    }],
  ], { desc: 'WP1 camera feel + cinematics', prepare: { view: 'fp', pose: 'spawn', time: 12, settings: CALM, freeze: true } });

  // ---------------------------------------------------------------- heavy: arch accept #2 / #3, hand-back (feel T49)
  suite('wp1-heavy', [
    ['TP arm: 300 random placements (village / woods / shores, random yaw, pitch and boom): never inside a collider or under terrain + 0.2, never lengthening > 4·dt·boom (arch #2), not inside tree crowns', (t) => {
      const { game, D, W, view } = t;
      const near = [], n = (t.opts && t.opts.n) || 300;
      let rs = 4321; const rnd = () => { rs = (rs + 0x6d2b79f5) >>> 0; let x = rs; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      D.setView('tp'); D.god(true); D.freezeAI(true);
      const out = { placements: 0, frames: 0, inCollider: 0, underTerrain: 0, armGrowth: 0, inCrown: 0, short: 0, slid: 0, crossed: 0 };
      let tries = 0;
      while (out.placements < n && tries < 60000) {
        tries++;
        const goal = [0, 1, 3][out.placements % 3], span = goal === 0 ? 70 : 340, x = (rnd() - 0.5) * span, z = (rnd() - 0.5) * span;
        if (W.regionAt(x, z) !== goal || !W.walkable(x, z) || W.inArena(x, z, 4) || W.hAt(x, z) < -0.1) continue;
        W.nearColliders(x, z, 3, near);
        if (near.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 0.35)) continue;
        out.placements++;
        t.clearEnemies();
        view.tp.boom = 1.8 + rnd() * 2.7;
        D.teleport(x, z, rnd() * Math.PI * 2, (-55 + rnd() * 105) * D2R);
        let prev = null, slid = false, crossed = false;
        for (let f = 0; f < 30; f++) {
          game.runFrame(1 / 60, true, false);
          const c = game.camera.position;
          out.frames++;
          W.nearColliders(c.x, c.z, 3, near);
          // (r2: the exact shape through W.colliderContains: a bounding circle counted the Great Tree's star, house parts
          // and bridge rails around every camera near them — 150 false hits on the merged world, 0 real ones)
          if (near.some((q) => q.active !== false && (W.colliderContains ? W.colliderContains(q, c.x, c.y, c.z) : Math.hypot(c.x - q.x, c.z - q.z) < q.r && c.y >= q.y0 && c.y <= q.camTop))) out.inCollider++;
          if (c.y < W.hAt(c.x, c.z) + 0.2) out.underTerrain++;
          if (prev != null && view.armLen - prev > 4 * (1 / 60) * view.tp.boom + 1e-6) out.armGrowth++;
          // inside a tree crown / pine skirt that does not also hold the shoulder point (the arm cannot help there)
          const tp = view.tp, S = tp.shoulder;
          if (f > 0 && tp.trees.some((q) => tp.inCanopy(q, c) > TV.tpCanopyPad && tp.inCanopy(q, S) < 0)) out.inCrown++;
          if (tp.passed) crossed = true;
          if (view.tp.slideTo) slid = true;
          prev = view.armLen;
        }
        if (view.armLen < 0.45) out.short++;
        if (slid) out.slid++;
        if (crossed) out.crossed++;
      }
      view.tp.boom = TV.tpBoom;
      t.note('probe', out);
      t.eq(out.placements, n, 'placements');
      t.eq(out.inCollider, 0, 'frames inside a collider'); t.eq(out.underTerrain, 0, 'frames under terrain + 0.2'); t.eq(out.armGrowth, 0, 'arm growth > 4·dt·boom');
      t.ok(out.inCrown <= out.frames * 0.002, 'frames inside a tree crown the shoulder is not in (≤ 0.2 %: the eased pull-in)', out.inCrown);
    }],
    ['boss intros, every boss in both modes: control returns facing the boss (|yaw − bearing| < 8°, pitch within 6° of its face) with a smooth hand-back (≤ 4°, ≤ 0.15 / 0.35 m per frame) (arch #3, feel T49)', (t) => {
      const { game, D, view } = t, rows = [];
      for (const id of ['woods', 'peaks', 'shores']) for (const mode of ['fp', 'tp']) {
        t.resetPlayer(); D.setView(mode); D.cutscene('bossIntro', id);
        let f = 0, handed = null, maxRot = 0, maxMove = 0, prevQ = game.camera.quaternion.clone(), prevP = game.camera.position.clone();
        for (let i = 0; i < 240; i++) {
          t.frames(1);
          const fi = game.fight;
          if (handed == null && fi && fi.phase === 'fight') {
            D.freezeAI(true);
            const b = fi.boss, face = game.bossFace(b), e = mode === 'tp' ? game.camera.position.clone() : view.simEye(new THREE.Vector3());
            const L = feelMod(t).cine.aimLook(face.x, face.y, face.z), dx = face.x - e.x, dz = face.z - e.z;
            handed = { yawErr: Math.abs(wrapAngle(yawOf(b.pos.x - game.player.pos.x, b.pos.z - game.player.pos.z) - view.yaw)) * R2D, pitchErr: Math.abs(L.pitch - view.pitch) * R2D, at: i };
          }
          if (handed && i - handed.at < 48 && i > handed.at) { maxRot = Math.max(maxRot, game.camera.quaternion.angleTo(prevQ) * R2D); maxMove = Math.max(maxMove, game.camera.position.distanceTo(prevP)); }
          prevQ.copy(game.camera.quaternion); prevP.copy(game.camera.position);
          if (handed && i - handed.at > 50) break;
        }
        rows.push({ id, mode, ...(handed || {}), maxRot: r3(maxRot), maxMove: r3(maxMove) });
        game.endFight(true); D.freezeAI(false); D.pose('spawn'); t.frames(3);
      }
      t.note('intros', rows);
      for (const r of rows) {
        t.ok(r.at != null, r.id + '/' + r.mode + ': handed back');
        t.ok(r.yawErr < 8, r.id + '/' + r.mode + ': yaw', r.yawErr);
        t.ok(r.pitchErr < 6, r.id + '/' + r.mode + ': pitch', r.pitchErr);
        t.ok(r.maxRot <= 4, r.id + '/' + r.mode + ': rotation per frame', r.maxRot);
        t.ok(r.maxMove <= (r.mode === 'fp' ? 0.15 : 0.35), r.id + '/' + r.mode + ': move per frame', r.maxMove);
      }
    }],
    ['TP camera never behind a standing vine gate: Pip on the entrance side of every arena looking at the boss, with and without the boss lock', (t) => {
      const { game, D, W, view } = t, rows = [];
      D.setView('tp');
      for (const id of ['woods', 'peaks', 'shores']) {
        t.resetPlayer(); D.cutscene('bossIntro', id);
        for (let i = 0; i < 240 && !(game.fight && game.fight.phase === 'fight'); i++) t.frames(1);
        D.freezeAI(true);
        const a = W.arenas[id], b = game.fight && game.fight.boss;
        for (const lock of [false, true]) {
          view.lockOn(lock ? b : null);
          let n = 0, behind = 0, fenced = 0;
          for (let rr = 7.5; rr <= a.r - 0.5; rr += 1.5) for (let da = -0.5; da <= 0.51; da += 0.25) {
            const ang = a.entAng + da, x = a.x + Math.sin(ang) * rr, z = a.z + Math.cos(ang) * rr;
            if (!b || !W.walkable(x, z)) continue;
            D.teleport(x, z, yawOf(b.pos.x - x, b.pos.z - z), -0.07); t.frames(30); n++;
            const p = game.camera.position, cr = Math.hypot(p.x - a.x, p.z - a.z), dA = wrapAngle(Math.atan2(p.x - a.x, p.z - a.z) - a.entAng);
            if (Math.abs(dA) < 0.42 && cr > a.r + 0.75 && p.y - a.h < 3.4) behind++;
            if (view.tp.fenced) fenced++;
          }
          rows.push({ id, lock, n, behind, fenced });
        }
        view.lockOn(null); if (game.fight) game.endFight(true); D.freezeAI(false); D.pose('spawn'); t.frames(3);
      }
      t.note('gate', rows);
      for (const r of rows) { t.ok(r.n >= 15, r.id + (r.lock ? '+lock' : '') + ': placements', r.n); t.eq(r.behind, 0, r.id + (r.lock ? '+lock' : '') + ': camera behind the gate'); }
      t.ok(rows.some((r) => r.fenced > 0), 'the fence engaged somewhere (the test reaches the gate)');
    }],
    ['TP lock on Frostbun in a live fight (AI on, strafing): through each leap the boss\'s middle stays on screen in most frames, its bottom and Pip\'s head always', (t) => {
      const { game, D, view } = t;
      D.setView('tp'); D.cutscene('bossIntro', 'peaks');
      for (let i = 0; i < 240 && !(game.fight && game.fight.phase === 'fight'); i++) t.frames(1);
      const b = game.fight && game.fight.boss;
      view.lockOn(b); t.move(1, 0.2);
      let n = 0, mid = 0, bot = 0, head = 0, leaps = 0, up = false;
      const on = (q) => Math.abs(q.x) <= 1 && Math.abs(q.y) <= 1 && q.z < 1, bad = [], a = game.fight && game.fight.arena;
      let calm = 0;
      for (let i = 0; i < 60 * 30 && leaps < 3 && b; i++) {
        // the AI picks a leap 42 % of the time: start one whenever it has walked for 0.75 s (its own crouch → air → land)
        calm = b.state === 'walk' ? calm + 1 : 0;
        // (r2: through WP5's own helper, which queues the leap for the AI; a bare set('crouch') skips the AI's target)
        if (calm > 45) { if (!(D.actors && D.actors.boss && D.actors.boss('leap')) && typeof b.set === 'function') { b.vel.set(0, 0); b.lift = 0; b.to = { x: game.player.pos.x, z: game.player.pos.z }; b.set('crouch', 0.45); } calm = 0; }
        t.frames(1);
        if (!game.fight || game.fight.boss !== b) break;
        if (b.lift > 2) {
          up = true; n++;
          const h = b.hurtbox({}), P = game.player.root.position, m = ndc(t, h.x, (h.y0 + h.y1) / 2, h.z), bo = ndc(t, h.x, h.y0, h.z);
          if (on(m)) mid++;
          if (on(bo)) bot++;
          if (on(ndc(t, P.x, P.y + 0.95, P.z))) head++;
          if ((!on(m) || !on(bo)) && bad.length < 6) bad.push({ i, lift: r3(b.lift), mid: r3(m.y), bot: r3(bo.y), pitch: r3(view.pitch * R2D), arm: r3(view.armLen), fenced: view.tp.fenced, coll: view.tp.collide, pr: a ? r3(Math.hypot(P.x - a.x, P.z - a.z)) : null, d: r3(Math.hypot(b.pos.x - P.x, b.pos.z - P.z)) });
        } else if (up) { up = false; leaps++; }
      }
      t.move(0, 0); view.lockOn(null); if (game.fight) game.endFight(true);
      t.note('leap', { leaps, n, mid, bot, head, bad });
      t.ok(leaps >= 2 && n > 60, 'leaps seen', { leaps, n });
      t.ok(mid >= 0.65 * n, 'boss middle on screen ≥ 65 % of lifted frames', mid / n);
      t.ok(bot >= 0.95 * n, 'boss bottom on screen ≥ 95 %', bot / n);
      t.eq(head, n, 'Pip\'s head on screen in every lifted frame');
    }],
    ['pedestal + ending: positions come from the world anchors (fallbacks today); TP pedestal hand-back is smooth; the ending crane rises over the plaza', (t) => {
      const { game, D, view, W } = t;
      D.setView('tp'); D.cutscene('place');
      let maxRot = 0, maxMove = 0, prevQ = game.camera.quaternion.clone(), prevP = game.camera.position.clone(), ended = null;
      for (let i = 0; i < 400 && (game.cutscene || ended == null || i - ended < 48); i++) {
        t.frames(1);
        if (!game.cutscene && ended == null) ended = i;
        if (game.ui.dlg && ended != null) t.dlgDone();
        if (ended != null && i > ended) { maxRot = Math.max(maxRot, game.camera.quaternion.angleTo(prevQ) * R2D); maxMove = Math.max(maxMove, game.camera.position.distanceTo(prevP)); }
        prevQ.copy(game.camera.quaternion); prevP.copy(game.camera.position);
      }
      const ped = W.pedestal, bear = yawOf(ped.x - game.player.pos.x, ped.z - game.player.pos.z);
      t.note('place', { ended, maxRot: r3(maxRot), maxMove: r3(maxMove), yawErr: r3(Math.abs(wrapAngle(view.yaw - bear)) * R2D) });
      t.ok(ended != null, 'place cutscene ended');
      t.ok(maxRot <= 4 && maxMove <= 0.35, 'TP hand-back per frame', { maxRot, maxMove });
      // ending: the crane ends well above the plaza and looks at the crown
      D.setView('fp'); t.resetPlayer(); D.teleport(ped.x, ped.z + 2.2, Math.PI, 0); t.frames(2);
      D.cutscene('ending');
      for (let i = 0; i < 460 && game.ui.menu !== 'ending'; i++) t.frames(1);
      const tree = W.greatTree, th = game.scenery.greatTree.height, c = game.camera.position;
      const ECl = W.shots && W.shots.endingCrane && W.shots.endingCrane.look, crown = ECl ? new THREE.Vector3(...ECl) : new THREE.Vector3(tree.x, tree.y + th * 0.62, tree.z);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(game.camera.quaternion), toCrown = crown.clone().sub(c).normalize();
      t.note('ending', { camY: r3(c.y - tree.y), th: r3(th), lookErr: r3(Math.acos(Math.min(1, fwd.dot(toCrown))) * R2D), card: game.ui.menu });
      t.eq(game.ui.menu, 'ending', 'ending card');
      // the crane ends at WP9's endingCrane anchor when the world gives one (C6), else WP1's 0.85·H fallback (r2: it used
      // to go to W.shots.ending, the ground-level look-up, and stayed 1 m over the plaza)
      const EC = W.shots && W.shots.endingCrane;
      if (EC) t.ok(Math.hypot(c.x - EC.pos[0], c.y - EC.pos[1], c.z - EC.pos[2]) < 0.6 && c.y - tree.y > th * 0.5, 'crane at W.shots.endingCrane, well above the plaza', [c.x, c.y, c.z]);
      else t.ok(c.y - tree.y > th * 0.6, 'crane above the plaza', c.y - tree.y);
      t.ok(fwd.dot(toCrown) > Math.cos(12 * D2R), 'looking at the crown');
      game.ui.endingT = 0; game.ui.closeEnding(); t.frames(60);
      t.ok(view.shotW === 0 && !game.cutscene, 'back in play after the blink', view.shotW);
    }],
    // ---------------------------------------------------------------- regressions (review round 1)
    ['TP pedestal shot keeps Pip whole, left of the altar; TP ending looks up from beside and above Pip (not from behind his hood); the crane moves every render frame at 144 Hz', (t) => {
      const { game, D, view, W } = t, ped = W.pedestal;
      D.setView('tp'); D.cutscene('place');
      let worst = 0, sx = -Infinity, seen = 0;
      for (let i = 0; i < 400 && game.cutscene; i++) {
        t.frames(1);
        if (view.shotW > 0.99 && game.cutscene) {
          const P = game.player.root.position, h = ndc(t, P.x, P.y + 1.0, P.z), f = ndc(t, P.x, P.y + 0.05, P.z);
          worst = Math.max(worst, Math.abs(h.x), Math.abs(h.y), Math.abs(f.x), Math.abs(f.y)); sx = Math.max(sx, h.x); seen++;
        }
      }
      for (let i = 0; i < 20 && game.ui.dlg; i++) { t.dlgDone(); t.frames(5); }
      t.resetPlayer(); D.setView('tp'); D.teleport(ped.x, ped.z + 2.2, Math.PI, 0); t.frames(10);
      D.cutscene('ending');
      let lookMin = 9;
      for (let i = 0; i < 175; i++) { t.frames(1); if (i > 60) lookMin = Math.min(lookMin, game.camera.position.y - game.player.pos.y); }
      let frames = 0, still = 0;
      const prev = game.camera.position.clone();
      for (let i = 0; i < 144 * 5 && game.ui.menu !== 'ending'; i++) {
        t.frames(1, { dt: 1 / 144 });
        const c = game.cutscene;
        if (c && c.shot && c.crane > 0.02 && c.crane < 0.98) { frames++; if (game.camera.position.distanceTo(prev) < 1e-5) still++; }
        prev.copy(game.camera.position);
      }
      t.note('tpCine', { place: { seen, worst: r3(worst), pipMaxX: r3(sx) }, lookMinH: r3(lookMin), crane: { frames, still } });
      t.ok(seen > 30 && worst <= 0.95, 'pedestal shot: Pip (head and feet) inside the frame', worst);
      t.ok(sx < 0, 'pedestal shot: Pip on the left', sx);
      t.ok(lookMin >= 1.2, 'ending look-up: camera ≥ 1.2 m over Pip\'s feet', lookMin);
      t.ok(frames > 200 && still <= 2, 'crane at 144 Hz moves every render frame', { frames, still });
      if (game.ui.menu === 'ending') { game.ui.endingT = 0; game.ui.closeEnding(); }
      t.frames(60);
    }],
    ['TP next to the Great Tree\'s roots (r2: Pip walks in from 12 m until the roots stop him, the boom swings into them): Pip framed at most bearings; against a root wall he hides, the camera never inside the bark', (t) => {
      const { game, D, W, view } = t, T = W.greatTree, rows = [];
      const st = W.colliders.find((c) => c.kind === 'tree' && c.shape === 'star');
      D.setView('tp');
      for (const ang of [0.5, 1.6, 2.6, 4.2, 5.4, 3.14]) {
        D.teleport(T.x + Math.sin(ang) * 12, T.z + Math.cos(ang) * 12, ang + Math.PI, -0.07); t.frames(5);
        t.move(0, 1); t.frames(240); t.move(0, 0); t.frames(5);
        D.look(ang + 0.5, -0.07); t.frames(60);
        const P = game.player.root.position, q = ndc(t, P.x, P.y + 0.5, P.z), c = game.camera.position;
        // a root wall: the tree's star (the measured mesh) at the pivot's height within 0.6 m behind Pip (centre and both
        // shoulders)
        let wall = false;
        for (let s = 0.2; s <= 0.61; s += 0.1) for (const lat of [-0.8, 0, 0.8]) { const y = ang + 0.5, x = P.x - Math.sin(y) * s - Math.cos(y) * lat, z = P.z - Math.cos(y) * s + Math.sin(y) * lat; if (W.colliderContains(st, x, P.y + 1.1, z)) wall = true; }
        const inBark = W.colliderContains(st, c.x, c.y, c.z);
        rows.push({ ang, stop: r3(Math.hypot(P.x - T.x, P.z - T.z)), arm: r3(view.armLen), x: r3((q.x + 1) / 2), fade: r3(view.bodyFade), wall, inBark });
      }
      const framed = rows.filter((r) => r.fade >= 0.9 && r.x >= 0.05 && r.x <= 0.95 && r.arm >= 1.0);
      t.note('greatTree', rows);
      t.ok(framed.length >= 4, 'Pip framed (fade ≥ 0.9, centre inside 0.05–0.95 W, arm ≥ 1 m) at ≥ 4 of 6 bearings', framed.length);
      t.ok(framed.reduce((s, r) => s + r.arm, 0) / Math.max(1, framed.length) >= 1.5, 'mean framed arm ≥ 1.5 m');
      for (const r of rows) {
        t.ok(!r.inBark, 'ang ' + r.ang + ': camera not inside the bark');
        if (!framed.includes(r)) t.ok(r.wall && r.fade < 0.05, 'ang ' + r.ang + ': unframed only against a root wall, Pip hidden (not half shown)', r);
      }
    }],
  ], { desc: 'WP1 heavy: TP arm sweep, boss intro hand-backs, pedestal / ending, gate, leap, Great Tree', heavy: true, prepare: { view: 'fp', pose: 'spawn', time: 12, settings: CALM, god: true } });
}
