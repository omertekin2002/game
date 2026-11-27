// Act I in-page suite (registered by js/debug/tests.js; only loaded with ?debug=1): the Catchers' handover (S-005, S-006)
// and Shellby's myth instalments (S-008).
//   act1   each Catcher's first win (Grumble Shroom, Captain Pinch, Frostbun): it sits down, says its three lines, holds
//          its Starseed out and the shipped item-get gives it; skipping leaves the same save; Talk until the bloom;
//          Continue keeps him sitting; a save written mid-scene replays it; the bloom shows the three as watchers at their
//          plaza marks (S-006) and then sends them to nap for the shipped rematch; Shellby tells inst:1 once (S-008)
// The saves come from tests/fixtures/saves/ (act1-fresh, act1-1seed, act1-3carried), loaded with G.debug.loadSave.
import { SAVE_KEY, HANDOVER, CATCHER_TALK, SEEDS, BOSSES, SEED_ORDER, INSTALMENTS, NPCS } from '../../data.js';
import { WATCH, watchPose } from '../../cutscenes.js';
import { store } from '../../core.js';
import { combat as TC } from '../../tune.js';
import { yawOf } from '../../util.js';
import { objective } from '../../hud/nav.js';

const FIX = {};
/** a save fixture by name (fetched once from the served repo) → a fresh copy */
async function fixture(name) {
  if (!FIX[name]) {
    const r = await fetch(new URL('../../../tests/fixtures/saves/' + name + '.json', import.meta.url));
    FIX[name] = await r.json();
  }
  return structuredClone(FIX[name]);
}
/** Continue `obj` (G.debug.loadSave) and run the session fade-in and its greeting out */
function load(t, obj) {
  const { D, game } = t;
  D.loadSave(obj);
  for (let i = 0; i < 200 && (game.trans || game.ui.dlg); i++) { if (game.ui.dlg) t.dlgDone(); t.frames(3); }
  t.resetPlayer();
  t.frames(2);
}
/** run frames until cond() (at most max) → frames run, or -1 */
function until(t, cond, max) {
  for (let i = 0; i < max; i++) { if (cond()) return i; t.frames(1); }
  return cond() ? max : -1;
}
/** the part of a save the handover decides (no clocks, position or look) */
function core(s) {
  return s && JSON.stringify({ seeds: s.seeds, bosses: s.bosses, flags: s.flags, coins: s.coins, hp: s.hp, ending: s.ending, rematches: s.rematches, v: s.v });
}
/** from act1-fresh: walk into Catcher `id`'s arena (Grumble's by default), beat it (killBoss) and run up to the handover
 *  cutscene → { b, frames } */
async function toHandover(t, id = 'woods') {
  const { D, game } = t, name = BOSSES[id].name;
  load(t, await fixture('act1-fresh'));
  t.ok(D.toBoss(id) === id, 'toBoss(' + id + ')');
  t.frames(2);
  const a = game.world.arenas[id];
  D.move(0, 1);
  const walk = until(t, () => { const p = game.player.pos; D.look(yawOf(a.x - p.x, a.z - p.z), 0); return !!game.fight; }, 15 * 60);
  D.move(0, 0);
  t.ok(walk >= 0 && game.fight && game.fight.id === id, 'walking in started the ' + id + ' fight', { walk });
  until(t, () => game.fight && game.fight.phase === 'fight', 10 * 60);
  const b = game.fight.boss;
  D.clearEvents();
  t.ok(D.killBoss(), 'killBoss');
  t.frames(1);
  t.ok(b.sitting && b.dying && !b.dead, name + ' sits down (no burst)', { sitting: b.sitting, dead: b.dead });
  const n = until(t, () => game.cutscene && game.cutscene.type === 'handover', 3 * 60);
  t.ok(n >= 55 && n <= 75, 'the sit takes 1.0 s, then the handover starts', { n });
  return { b, frames: n };
}
/** read the open dialogue box (only this one: the item-get opens right after the handover's last line) with Use
 *  presses → its lines */
function readLines(t) {
  const ui = t.game.ui, d = ui.dlg, lines = d ? d.lines.slice() : [];
  for (let i = 0; i < 80 && d && ui.dlg === d; i++) { t.D.press('interact', 0); t.frames(3); }
  return lines;
}
/** record the sound names played (G.audio.sfx) while fn runs */
async function sounds(t, fn) {
  const A = t.G.audio, log = [];
  if (!A || typeof A.sfx !== 'function') { await fn(log); return log; }
  const orig = A.sfx;
  A.sfx = function (n, o) { log.push(n); return orig.call(this, n, o); };
  try { await fn(log); } finally { A.sfx = orig; }
  return log;
}

/** a Catcher's first win from act1-fresh, watched through (story.md #I.2): the sit, its three lines with its name and
 *  portrait, the Starseed held out, the shipped item-get, the flags and the save; it stays sat */
async function handover(t, id) {
  const { game, ui } = t, S = () => game.S, name = BOSSES[id].name;
  let b;
  const sit = await sounds(t, async () => { ({ b } = await toHandover(t, id)); });
  t.note('sfx', sit);
  t.ok(sit.includes('bossSit') && !sit.includes('bossPop') && !sit.includes('bossDie'), 'the sit sounds bossSit; no bossPop / bossDie', sit);
  t.ok(b.root.parent === game.scene && game.bosses[id] === b && b.state === 'sat', name + ' stays on the island, sat (the root not removed)', { state: b.state });
  t.ok(t.events('bossDefeated').some((p) => p.id === id), 'BOSS_DEFEATED for ' + id);
  t.ok(!game.pickups.some((p) => p.kind === 'seed'), 'no Starseed pickup');
  t.ok(game.player.state === 'frozen' && t.events('cutsceneStart').some((p) => p.type === 'handover' && p.id === id), 'Pip frozen, CUTSCENE_START handover');
  t.ok(typeof game.skipScene === 'function', 'the handover can be skipped (game.skipScene)');
  // wait 1.0 s, then lines 1 and 2 with the Catcher's name and portrait
  const hold = until(t, () => !!ui.dlg, 90);
  t.ok(hold >= 50 && hold <= 62, 'the first lines after the 1.0 s hold', { hold, step: game.cutscene && game.cutscene.step, t: game.cutscene && game.cutscene.t });
  const say = HANDOVER[id].map((l) => l.text), shown = [];
  t.eq(ui.dlg.name, name, 'speaker name'); t.eq(ui.dlg.portrait, BOSSES[id].key, 'speaker portrait');
  shown.push(...readLines(t));
  t.eq(JSON.stringify(shown), JSON.stringify(say.slice(0, 2)), 'lines 1 and 2');
  // the seed rises out of the Catcher and is held out in front of it at 1.4 m
  const c = game.cutscene;
  t.ok(c && c.type === 'handover' && c.seed, 'the Starseed rises out of ' + name);
  t.ok(until(t, () => !!ui.dlg, 60) >= 30, 'held out over 0.6 s, then line 3');
  const sp = c.seed.position, f = { x: Math.sin(b.facing), z: Math.cos(b.facing) };
  t.near(sp.y - b.arena.h, 1.4, 0.05, 'held at 1.4 m');
  t.near((sp.x - b.pos.x) * f.x + (sp.z - b.pos.z) * f.z, b.r + 0.6, 0.1, 'held out 0.6 m in front');
  shown.push(...readLines(t));
  t.eq(shown[2], say[2], 'line 3');
  // the shipped item-get
  t.ok(!game.cutscene && ui.dlg && game.player.state === 'item', 'the item-get follows');
  const item = readLines(t);
  t.eq(item[0], 'You got the ' + SEEDS[id].name + '!', 'the shipped item-get text');
  t.ok(/^Bring it to the pedestal by the Great Tree\. 2 more to find!$/.test(item[1]), 'the shipped second line', item);
  t.ok(t.events('itemGet').length === 1 && t.events('collect').some((p) => p.kind === 'seed'), 'ITEM_GET and COLLECT seed once');
  t.ok(game.player.state === 'normal' && t.events('cutsceneEnd').some((p) => p.type === 'handover' && p.id === id), 'control back, CUTSCENE_END handover');
  t.ok(![...shown, ...item].some((l) => /defeat/i.test(l)), 'no "defeat" in what is shown');
  t.eq(S().seeds[id], 1, 'S.seeds.' + id); t.eq(S().flags['calm:' + id], 1, 'calm:' + id + ' (the first one calmed)'); t.eq(S().flags['handover:' + id], true, 'handover:' + id);
  t.ok(game.bosses[id] === b && b.state === 'sat', 'still sat');
  t.ok(!game.pickups.some((p) => p.kind === 'seed'), 'still no seed pickup');
  const saved = store.get(SAVE_KEY);
  t.ok(saved.seeds[id] === 1 && saved.flags['handover:' + id] === true && saved.flags['calm:' + id] === 1, 'saved', saved.flags);
  // the fight winds down and the vines drop
  t.ok(until(t, () => !game.fight, 5 * 60) >= 0 && game.vines[id].target === 0, 'the fight ends, the vines drop');
  // budgets per view: the arena after the win (recorded, FP)
  const r = game.renderer;
  game.render(1, 0); r.info.autoReset = false; r.info.reset(); r.render(game.scene, game.camera); r.info.autoReset = true;
  t.note('arenaAfterWin', { calls: r.info.render.calls, tris: r.info.render.triangles });
}

export default function register(suite) {
  suite('act1', [
    ['Grumble handover: sits, three lines, seed held out, item-get', (t) => handover(t, 'woods')],
    ['Pinch handover: sits, three lines, seed held out, item-get', (t) => handover(t, 'shores')],
    ['Frostbun handover: sits, three lines, seed held out, item-get', (t) => handover(t, 'peaks')],
    ['skip leaves the same state', async (t) => {
      const { game, D, ui } = t;
      // watched in TP (its shots), then skipped in FP right after the sit, then skipped by holding Use 0.8 s
      const run = async (how) => {
        D.setView(how === 'watch' ? 'tp' : 'fp', { instant: true });
        await toHandover(t);
        if (how === 'skip') t.ok(D.scene.skip(), 'G.debug.scene.skip() skipped it');
        if (how === 'hold') { D.hold('interact'); until(t, () => !game.cutscene, 70); D.release('interact'); }
        if (how === 'watch') {
          until(t, () => !!ui.dlg, 90);
          t.ok(game.view.shotW > 0.5, 'TP: in the handover shot', game.view.shotW);
          for (let i = 0; i < 4 && game.cutscene; i++) { readLines(t); until(t, () => !!ui.dlg || !game.cutscene, 60); }
        }
        t.ok(!game.cutscene && !game.skipScene, how + ': the scene is over');
        t.ok(ui.dlg && ui.dlg.lines[0] === 'You got the ' + SEEDS.woods.name + '!', how + ': the item-get still shows');
        t.dlgDone();
        t.frames(60);
        t.ok(game.player.state === 'normal' && game.view.shotW < 0.01, how + ': control back, no shot left', { shotW: game.view.shotW });
        return core(store.get(SAVE_KEY));
      };
      const watched = await run('watch'), skipped = await run('skip'), held = await run('hold');
      t.note('watched', watched);
      t.eq(skipped, watched, 'skipped: the same save state');
      t.eq(held, watched, 'held Use: the same save state');
      D.setView('fp', { instant: true });
    }],
    ['talk until the bloom (all three)', async (t) => {
      const { game, D, ui } = t;
      const talkTo = (id) => {
        const b = game.bosses[id], a = b.arena, ang = yawOf(a.outside.x - b.pos.x, a.outside.z - b.pos.z), d = b.r + 1.0;
        D.teleport(b.pos.x + Math.sin(ang) * d, b.pos.z + Math.cos(ang) * d, ang + Math.PI, 0);
        D.lookAt(b.pos.x, a.h + TC.aimPts.guardian[0] * b.height, b.pos.z);
        t.frames(3);
        return game.target;
      };
      for (const id of SEED_ORDER) {
        const name = BOSSES[id].name, s = await fixture('act1-fresh');
        s.bosses[id] = true; s.seeds[id] = 1; s.flags = { ['calm:' + id]: 1, ['handover:' + id]: true };
        load(t, s);
        const tg = talkTo(id);
        t.ok(tg && tg.o === game.bosses[id], 'the sat ' + name + ' is the Use target', tg && tg.label);
        t.eq(tg && tg.label, 'Talk · ' + name, 'the prompt');
        const before = CATCHER_TALK[id].before.map((l) => l.text), got = [];
        for (let i = 0; i < 3; i++) {
          t.press('interact'); t.frames(2);
          t.ok(ui.dlg && ui.dlg.name === name && ui.dlg.portrait === BOSSES[id].key && ui.dlg.lines.length === 1, 'one box with the name and portrait of ' + name);
          got.push(...readLines(t)); t.frames(10); talkTo(id);
        }
        t.eq(JSON.stringify(got), JSON.stringify([before[0], before[1], before[0]]), name + ': the before lines in turn');
        t.ok(!game.cutscene && game.S.seeds[id] === 1, 'a Talk changes nothing');
      }
      load(t, await fixture('act1-1seed'));
      t.ok(game.bosses.woods && game.bosses.woods.sat, 'act1-1seed: he sits');
      talkTo('woods');
      t.press('interact'); t.frames(2);
      t.eq(readLines(t)[0], CATCHER_TALK.woods.placed[0].text, 'his seed placed: the placed line');
      // act1-3carried: the Woods and Peaks seeds are placed, the Shores one carried
      load(t, await fixture('act1-3carried'));
      t.ok(SEED_ORDER.every((id) => game.bosses[id] && game.bosses[id].sat), 'act1-3carried: all three sit');
      game.catcherTalks = {};   // the before lines' turn is a runtime counter (not saved): start them over
      for (const id of ['peaks', 'shores']) {
        talkTo(id);
        t.press('interact'); t.frames(2);
        t.eq(readLines(t)[0], (game.S.seeds[id] === 2 ? CATCHER_TALK[id].placed[0] : CATCHER_TALK[id].before[0]).text, BOSSES[id].name + ': ' + (game.S.seeds[id] === 2 ? 'placed' : 'before') + ' line');
      }
    }],
    ['Continue keeps him sitting', async (t) => {
      const { game, D } = t;
      await toHandover(t);
      D.scene.skip(); t.dlgDone(); t.frames(5);
      t.ok(game.S.flags['handover:woods'] === true, 'handed over');
      game.save(true);
      const obj = store.get(SAVE_KEY);
      load(t, obj);
      const b = game.bosses.woods, a = game.world.arenas.woods;
      t.ok(b && b.sat && b.state === 'sat' && b.dying && !b.dead, 'Grumble is sat after Continue', b && { state: b.state });
      const d = Math.hypot(b.pos.x - a.x, b.pos.z - a.z), toOut = Math.hypot(b.pos.x - a.outside.x, b.pos.z - a.outside.z);
      t.near(d, 3, 0.01, '3 m from the arena centre');
      t.ok(toOut < Math.hypot(a.x - a.outside.x, a.z - a.outside.z), 'toward the entrance');
      t.ok(game.dynamicColliders(game.player).some((c) => c.x === b.pos.x && c.z === b.pos.z), 'his collider is kept');
      t.ok(!game.pickups.some((p) => p.kind === 'seed'), 'no seed pickup');
      // walking into the arena starts nothing; a sword hit does nothing
      const p0 = b.pos.clone();
      D.teleport(a.x, a.z, 0, 0); t.frames(30);
      t.ok(!game.fight && b.state === 'sat' && b.hit(5, a.x, a.z) === null && b.pos.distanceTo(p0) < 1e-9, 'no fight, no hit, he never moves');
    }],
    ['a save written mid-scene replays the handover on Talk', async (t) => {
      const { game, D, ui } = t;
      const s = await fixture('act1-fresh');
      s.bosses.woods = true;   // beaten, no seed, no handover flag
      load(t, s);
      const b = game.bosses.woods;
      t.ok(b && b.sat && !game.pickups.some((p) => p.kind === 'seed'), 'he sits; no seed pickup');
      const o = objective(game.world, game.S, game.player.pos);
      t.ok(o && o.id === 'arena-woods' && o.text === 'Talk to Grumble Shroom', 'the objective: talk to him', o);
      const a = b.arena, ang = yawOf(a.outside.x - b.pos.x, a.outside.z - b.pos.z), d = b.r + 1.0;
      D.teleport(b.pos.x + Math.sin(ang) * d, b.pos.z + Math.cos(ang) * d, ang + Math.PI, 0);
      D.lookAt(b.pos.x, a.h + TC.aimPts.guardian[0] * b.height, b.pos.z); t.frames(3);
      t.eq(game.target && game.target.label, 'Talk · Grumble Shroom', 'the prompt');
      t.press('interact'); t.frames(2);
      t.ok(game.cutscene && game.cutscene.type === 'handover' && ui.dlg, 'Talk replays the handover from its lines');
      const say = HANDOVER.woods.map((l) => l.text), shown = [...readLines(t)];
      until(t, () => !!ui.dlg, 60); shown.push(...readLines(t));
      t.eq(JSON.stringify(shown), JSON.stringify(say), 'the three lines');
      t.ok(ui.dlg && ui.dlg.lines[0] === 'You got the ' + SEEDS.woods.name + '!', 'then the item-get');
      t.dlgDone();
      t.ok(game.S.seeds.woods === 1 && game.S.flags['handover:woods'] === true && game.S.flags['calm:woods'] === 1, 'the seed and the flags', game.S.flags);
    }],
    ['a migrated v6 save with an uncollected seed replays the handover on Talk', async (t) => {
      const { game, D, ui } = t;
      const s = await fixture('act1-fresh');
      s.v = 6; delete s.flags;
      s.bosses.woods = true;   // beaten in v6, seed not picked up yet: v7Flags marks handover:woods while seeds.woods stays 0
      load(t, s);
      t.ok(game.S.v === 7 && game.S.flags['handover:woods'] === true && game.S.flags['calm:woods'] === 1 && !game.S.seeds.woods, 'migrated with handover:woods and no seed', game.S.flags);
      const b = game.bosses.woods;
      t.ok(b && b.sat && !game.pickups.some((p) => p.kind === 'seed'), 'he sits; no seed pickup');
      const a = b.arena, ang = yawOf(a.outside.x - b.pos.x, a.outside.z - b.pos.z), d = b.r + 1.0;
      D.teleport(b.pos.x + Math.sin(ang) * d, b.pos.z + Math.cos(ang) * d, ang + Math.PI, 0);
      D.lookAt(b.pos.x, a.h + TC.aimPts.guardian[0] * b.height, b.pos.z); t.frames(3);
      t.press('interact'); t.frames(2);
      t.ok(game.cutscene && game.cutscene.type === 'handover' && ui.dlg, 'Talk replays the handover despite migrated handover:woods');
      t.ok(D.scene.skip(), 'skip to the item-get');
      t.ok(ui.dlg && ui.dlg.lines[0] === 'You got the ' + SEEDS.woods.name + '!', 'the item-get gives the seed');
      t.dlgDone();
      t.ok(game.S.seeds.woods === 1 && game.S.flags['handover:woods'] === true && game.S.flags['calm:woods'] === 1, 'seed recovered and calm order kept', game.S.flags);
    }],
    ['getting dizzy during the sit still respawns Pip and Talk recovers the seed', async (t) => {
      const { game, D, ui } = t;
      load(t, await fixture('act1-fresh'));
      try {
        D.god(false);
        t.ok(D.toBoss('woods') === 'woods', 'toBoss(woods)');
        t.frames(2);
        const a = game.world.arenas.woods;
        D.move(0, 1);
        until(t, () => { const p = game.player.pos; D.look(yawOf(a.x - p.x, a.z - p.z), 0); return !!game.fight; }, 15 * 60);
        D.move(0, 0);
        until(t, () => game.fight && game.fight.phase === 'fight', 10 * 60);
        const b = game.fight.boss;
        t.ok(D.killBoss(), 'killBoss');
        t.frames(10);   // mid-sit: a lingering hit downs Pip
        game.S.hp = 1;
        t.ok(game.playerHurt(2, a.x, a.z, 0, 'ring'), 'hit during sit');
        t.eq(game.player.state, 'dizzy', 'Pip is dizzy at 0 HP');
        t.ok(until(t, () => b.sat, 2 * 60) >= 0, 'Grumble finishes sitting');
        t.ok(!game.cutscene && game.player.state === 'dizzy', 'dizzy preserved, handover deferred');
        t.ok(until(t, () => game.player.state === 'normal' && !game.trans, 8 * 60) >= 0, 'Pip respawns');
        t.eq(game.S.hp, game.S.maxHp, 'full HP after respawn');
        t.ok(game.bosses.woods === b && b.sat && !game.S.seeds.woods, 'Grumble still sat with seed pending');
        const ang = yawOf(a.outside.x - b.pos.x, a.outside.z - b.pos.z), d = b.r + 1.0;
        D.teleport(b.pos.x + Math.sin(ang) * d, b.pos.z + Math.cos(ang) * d, ang + Math.PI, 0);
        D.lookAt(b.pos.x, a.h + TC.aimPts.guardian[0] * b.height, b.pos.z); t.frames(3);
        t.press('interact'); t.frames(2);
        t.ok(game.cutscene && game.cutscene.type === 'handover' && ui.dlg, 'Talk replays handover after respawn');
        t.ok(D.scene.skip(), 'skip to item-get');
        t.dlgDone();
        t.eq(game.S.seeds.woods, 1, 'seed recovered after respawn');
      } finally { D.god(true); }
    }],
    ['bloom: the three watch from their marks, then nap', async (t) => {
      const { game, D, ui } = t, W = game.world;
      load(t, await fixture('act1-3carried'));
      t.ok(SEED_ORDER.every((id) => game.bosses[id] && game.bosses[id].sat), 'before the bloom all three sit');
      const real = Object.fromEntries(SEED_ORDER.map((id) => [id, game.bosses[id]]));
      D.setView('tp', { instant: true });   // the budget is measured in TP at the card
      t.ok(D.cutscene('place') && game.cutscene && game.cutscene.type === 'place', 'placing the last seed');
      t.ok(until(t, () => game.cutscene && game.cutscene.type === 'ending', 20 * 60) >= 0, 'the ending starts');
      // the watchers: one per Catcher, at its mark (a clear walkable spot within WATCH.reach m), on the ground, facing the
      // Tree, at 0.6 × its size; the real ones stay sat in their arenas
      const ws = game.watchers || [], Tr = W.greatTree || { x: 0, z: 0 }, rows = {};
      t.eq(ws.map((w) => w.id).sort().join(), 'peaks,shores,woods', 'three watchers, one per Catcher');
      for (const w of ws) {
        const m = WATCH.marks[w.id], p = w.root.position, off = Math.hypot(p.x - m[0], p.z - m[1]), room = game.colliderRoom(p.x, p.z, WATCH.clear);
        const yaw = yawOf(Tr.x - p.x, Tr.z - p.z), dyaw = Math.abs(Math.atan2(Math.sin(w.root.rotation.y - yaw), Math.cos(w.root.rotation.y - yaw)));
        rows[w.id] = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), off: +off.toFixed(2), room: +room.toFixed(2), h: +w.height.toFixed(2) };
        t.ok(w.root.parent === game.scene && off <= WATCH.reach + 1e-6, w.id + ': within ' + WATCH.reach + ' m of its mark', rows[w.id]);
        t.ok(W.walkable(p.x, p.z) && room >= WATCH.clear, w.id + ': walkable, ≥ 3 m from every collider', rows[w.id]);
        t.near(p.y, W.ground(p.x, p.z), 1e-6, w.id + ': on the ground');
        t.ok(dyaw < 1e-6, w.id + ': facing the Tree', { dyaw });
        t.near(w.root.scale.x, WATCH.scale, 1e-9, w.id + ': 0.6 × its size');
        t.near(w.height, real[w.id].height * WATCH.scale, 1e-6, w.id + ': 0.6 × the boss\'s in-game height');
        t.ok(real[w.id].sat && real[w.id].root.parent === game.scene && w.root !== real[w.id].root, w.id + ': the real one stays in its arena');
      }
      t.note('marks', rows);
      // the bloom poses (render side): Grumble's small bobs, Frostbun's hop, Pinch's hat doff
      t.ok(until(t, () => game.cutscene.stage >= 1, 10 * 60) >= 0, 'the bloom');
      const peak = { woods: 0, peaks: 0, shores: 0 };
      for (let i = 0; i < 60; i++) {
        t.frames(1);
        for (const w of game.watchers) peak[w.id] = Math.max(peak[w.id], w.id === 'shores' ? w.root.rotation.x : w.root.position.y - w.y);
      }
      t.note('poses', peak);
      t.ok(peak.woods > 0.05 && peak.woods <= 0.08 + 1e-6, 'Grumble: a small bob (≤ 0.08 m)', peak);
      t.ok(peak.peaks > 0.3 && peak.peaks <= 0.4 + 1e-6, 'Frostbun: a 0.4 m hop', peak);
      t.ok(peak.shores > 12 * Math.PI / 180 && peak.shores <= 15 * Math.PI / 180 + 1e-6, 'Pinch: tips forward 15°', peak);
      t.ok(game.watchers.every((w) => Math.abs(w.root.position.y - w.y) < 1e-6 && w.root.rotation.x === 0), 'all still again after the poses');
      t.near(watchPose('woods', 0.15).dy, 0.08, 1e-9, 'watchPose: Grumble at the top of a bob');
      t.near(watchPose('woods', 0.45).dy, 0.08, 1e-9, 'watchPose: his second bob');
      t.near(watchPose('peaks', 0.25).dy, 0.4, 1e-9, 'watchPose: Frostbun at the top of his hop');
      t.near(watchPose('shores', 0.3).tilt, 15 * Math.PI / 180, 1e-9, 'watchPose: Pinch at 15°');
      // the ending card: budgets per view (TP, main pass: shadow map not redrawn) with the three actors
      t.ok(until(t, () => ui.menu === 'ending', 30 * 60) >= 0, 'the ending card');
      t.ok(game.watchers && game.watchers.length === 3, 'the watchers stay through the card');
      const r = game.renderer, main = () => {
        game.render(1, 0);
        const au = r.shadowMap.autoUpdate;
        r.shadowMap.autoUpdate = false; r.info.autoReset = false; r.info.reset();
        r.render(game.scene, game.camera);
        r.info.autoReset = true; r.shadowMap.autoUpdate = au;
        return { calls: r.info.render.calls, tris: r.info.render.triangles };
      };
      const withW = main();
      for (const w of game.watchers) w.root.visible = false;
      const without = main();
      for (const w of game.watchers) w.root.visible = true;
      t.note('endingCardTP', { with: withW, without, watchers: withW.calls - without.calls });
      t.ok(withW.calls <= 200, 'the ending view: ≤ 200 main-pass draw calls with the three actors (TP)', withW);
      const roots = game.watchers.map((w) => w.root);
      ui.endingT -= 1600;
      t.press('interact'); t.frames(3);
      t.ok(game.S.ending === true && ui.menu !== 'ending', 'the ending closed');
      t.ok(!game.watchers && roots.every((q) => !q.parent), 'the watchers are gone after the card');
      const b = game.bosses.woods;
      t.ok(b && b.rematch === true && b.state === 'sleep' && !b.sat, 'Grumble naps for the rematch', b && { rematch: b.rematch, state: b.state, sat: b.sat });
      t.eq(Object.keys(game.bosses).filter((id) => game.bosses[id].rematch && game.bosses[id].state === 'sleep').sort().join(), 'peaks,shores,woods', 'all three nap');
      t.ok(!Object.values(game.bosses).some((q) => q.sat), 'no Catcher sits after the bloom');
      D.setView('fp', { instant: true });
    }],
    ['instalment once: Shellby tells inst:1 on the first Talk, never again', async (t) => {
      const { game, D, ui } = t;
      load(t, await fixture('act1-1seed'));
      t.ok(!game.S.flags['inst:1'], 'act1-1seed: inst:1 not heard yet', game.S.flags);
      const sh = NPCS.find((n) => n.id === 'shellby'), talk = () => {
        D.standAt('shellby'); t.frames(3);
        t.eq(game.target && game.target.label, 'Talk · Elder Shellby', 'the prompt');
        t.press('interact'); t.frames(2);
        t.ok(ui.dlg && ui.dlg.name === 'Elder Shellby', 'his dialogue box');
        return readLines(t);
      };
      const first = talk();
      t.eq(first[0], INSTALMENTS[0].text, 'the first box is inst:1');
      t.eq(JSON.stringify(first.slice(1)), JSON.stringify(sh.lines(game.S)), 'then his shipped lines');
      t.ok(game.S.flags['inst:1'] === true, 'S.flags[inst:1] set', game.S.flags);
      t.ok(store.get(SAVE_KEY).flags['inst:1'] === true, 'saved');
      t.frames(10);
      const second = talk();
      t.eq(JSON.stringify(second), JSON.stringify(sh.lines(game.S)), 'a second Talk: no instalment box');
    }],
  ], { desc: 'Act I: the Catchers\' handover, the bloom watchers and Shellby\'s instalments (S-005, S-006, S-008)', prepare: { view: 'fp', pose: 'spawn', god: true } });
}
