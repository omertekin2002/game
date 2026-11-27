// Act I in-page suite (registered by js/debug/tests.js; only loaded with ?debug=1): the Catchers' handover (S-005).
//   act1   Grumble Shroom's first win: he sits down, says his three lines, holds the Woods Starseed out and the shipped
//          item-get gives it; skipping leaves the same save; Talk until the bloom; Continue keeps him sitting; a save
//          written mid-scene replays it; the bloom sends him to nap for the shipped rematch
// The saves come from tests/fixtures/saves/ (act1-fresh, act1-1seed, act1-3carried), loaded with G.debug.loadSave.
import { SAVE_KEY, HANDOVER, CATCHER_TALK, SEEDS } from '../../data.js';
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
/** from act1-fresh: walk into Grumble's arena, beat him (killBoss) and run up to the handover cutscene → { b, frames } */
async function toHandover(t) {
  const { D, game } = t;
  load(t, await fixture('act1-fresh'));
  t.ok(D.toBoss('woods') === 'woods', 'toBoss(woods)');
  t.frames(2);
  const a = game.world.arenas.woods;
  D.move(0, 1);
  const walk = until(t, () => { const p = game.player.pos; D.look(yawOf(a.x - p.x, a.z - p.z), 0); return !!game.fight; }, 15 * 60);
  D.move(0, 0);
  t.ok(walk >= 0 && game.fight && game.fight.id === 'woods', 'walking in started the woods fight', { walk });
  until(t, () => game.fight && game.fight.phase === 'fight', 10 * 60);
  const b = game.fight.boss;
  D.clearEvents();
  t.ok(D.killBoss(), 'killBoss');
  t.frames(1);
  t.ok(b.sitting && b.dying && !b.dead, 'Grumble sits down (no burst)', { sitting: b.sitting, dead: b.dead });
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

export default function register(suite) {
  suite('act1', [
    ['Grumble handover: sits, three lines, seed held out, item-get', async (t) => {
      const { game, D, ui } = t, S = () => game.S;
      let b;
      const sit = await sounds(t, async () => { ({ b } = await toHandover(t)); });
      t.note('sfx', sit);
      t.ok(sit.includes('bossSit') && !sit.includes('bossPop') && !sit.includes('bossDie'), 'the sit sounds bossSit; no bossPop / bossDie', sit);
      t.ok(b.root.parent === game.scene && game.bosses.woods === b && b.state === 'sat', 'he stays on the island, sat (his root not removed)', { state: b.state });
      t.ok(t.events('bossDefeated').some((p) => p.id === 'woods'), 'BOSS_DEFEATED for woods');
      t.ok(!game.pickups.some((p) => p.kind === 'seed'), 'no Starseed pickup');
      t.ok(game.player.state === 'frozen' && t.events('cutsceneStart').some((p) => p.type === 'handover' && p.id === 'woods'), 'Pip frozen, CUTSCENE_START handover');
      t.ok(typeof game.skipScene === 'function', 'the handover can be skipped (game.skipScene)');
      // wait 1.0 s, then lines 1 and 2 with Grumble's name and portrait
      const hold = until(t, () => !!ui.dlg, 90);
      t.ok(hold >= 50 && hold <= 62, 'his first lines after the 1.0 s hold', { hold, step: game.cutscene && game.cutscene.step, t: game.cutscene && game.cutscene.t });
      const say = HANDOVER.woods.map((l) => l.text), shown = [];
      t.eq(ui.dlg.name, 'Grumble Shroom', 'speaker name'); t.eq(ui.dlg.portrait, 'boss_shroom', 'speaker portrait');
      shown.push(...readLines(t));
      t.eq(JSON.stringify(shown), JSON.stringify(say.slice(0, 2)), 'lines 1 and 2');
      // the seed rises out of him and is held out in front of him at 1.4 m
      const c = game.cutscene;
      t.ok(c && c.type === 'handover' && c.seed, 'the Starseed rises out of him');
      t.ok(until(t, () => !!ui.dlg, 60) >= 30, 'held out over 0.6 s, then line 3');
      const sp = c.seed.position, f = { x: Math.sin(b.facing), z: Math.cos(b.facing) };
      t.near(sp.y - b.arena.h, 1.4, 0.05, 'held at 1.4 m');
      t.near((sp.x - b.pos.x) * f.x + (sp.z - b.pos.z) * f.z, b.r + 0.6, 0.1, 'held out 0.6 m in front of him');
      shown.push(...readLines(t));
      t.eq(shown[2], say[2], 'line 3');
      // the shipped item-get
      t.ok(!game.cutscene && ui.dlg && game.player.state === 'item', 'the item-get follows');
      const item = readLines(t);
      t.eq(item[0], 'You got the ' + SEEDS.woods.name + '!', 'the shipped item-get text');
      t.ok(/^Bring it to the pedestal by the Great Tree\. 2 more to find!$/.test(item[1]), 'the shipped second line', item);
      t.ok(t.events('itemGet').length === 1 && t.events('collect').some((p) => p.kind === 'seed'), 'ITEM_GET and COLLECT seed once');
      t.ok(game.player.state === 'normal' && t.events('cutsceneEnd').some((p) => p.type === 'handover' && p.id === 'woods'), 'control back, CUTSCENE_END handover');
      t.ok(![...shown, ...item].some((l) => /defeat/i.test(l)), 'no "defeat" in what is shown');
      t.eq(S().seeds.woods, 1, 'S.seeds.woods'); t.eq(S().flags['calm:woods'], 1, 'calm:woods'); t.eq(S().flags['handover:woods'], true, 'handover:woods');
      t.ok(game.bosses.woods === b && b.state === 'sat', 'still sat');
      t.ok(!game.pickups.some((p) => p.kind === 'seed'), 'still no seed pickup');
      const saved = store.get(SAVE_KEY);
      t.ok(saved.seeds.woods === 1 && saved.flags['handover:woods'] === true && saved.flags['calm:woods'] === 1, 'saved', saved.flags);
      // the fight winds down and the vines drop
      t.ok(until(t, () => !game.fight, 5 * 60) >= 0 && game.vines.woods.target === 0, 'the fight ends, the vines drop');
      // budgets per view: the arena after the win (recorded, FP)
      const r = game.renderer;
      game.render(1, 0); r.info.autoReset = false; r.info.reset(); r.render(game.scene, game.camera); r.info.autoReset = true;
      t.note('arenaAfterWin', { calls: r.info.render.calls, tris: r.info.render.triangles });
    }],
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
    ['talk until the bloom', async (t) => {
      const { game, D, ui } = t;
      const talkTo = () => {
        const b = game.bosses.woods, a = b.arena, ang = yawOf(a.outside.x - b.pos.x, a.outside.z - b.pos.z), d = b.r + 1.0;
        D.teleport(b.pos.x + Math.sin(ang) * d, b.pos.z + Math.cos(ang) * d, ang + Math.PI, 0);
        D.lookAt(b.pos.x, a.h + TC.aimPts.guardian[0] * b.height, b.pos.z);
        t.frames(3);
        return game.target;
      };
      const s = await fixture('act1-fresh');
      s.bosses.woods = true; s.seeds.woods = 1; s.flags = { 'calm:woods': 1, 'handover:woods': true };
      load(t, s);
      const tg = talkTo();
      t.ok(tg && tg.o === game.bosses.woods, 'the sat Grumble is the Use target', tg && tg.label);
      t.eq(tg && tg.label, 'Talk · Grumble Shroom', 'the prompt');
      const before = CATCHER_TALK.woods.before.map((l) => l.text), got = [];
      for (let i = 0; i < 3; i++) {
        t.press('interact'); t.frames(2);
        t.ok(ui.dlg && ui.dlg.name === 'Grumble Shroom' && ui.dlg.portrait === 'boss_shroom' && ui.dlg.lines.length === 1, 'one box with his name and portrait');
        got.push(...readLines(t)); t.frames(10); talkTo();
      }
      t.eq(JSON.stringify(got), JSON.stringify([before[0], before[1], before[0]]), 'the before lines in turn');
      t.ok(!game.cutscene && game.S.seeds.woods === 1, 'a Talk changes nothing');
      load(t, await fixture('act1-1seed'));
      t.ok(game.bosses.woods && game.bosses.woods.sat, 'act1-1seed: he sits');
      talkTo();
      t.press('interact'); t.frames(2);
      t.eq(readLines(t)[0], CATCHER_TALK.woods.placed[0].text, 'his seed placed: the placed line');
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
    ['bloom sends him to nap', async (t) => {
      const { game, D, ui } = t;
      load(t, await fixture('act1-3carried'));
      t.ok(game.bosses.woods && game.bosses.woods.sat, 'before the bloom he sits');
      t.ok(D.cutscene('place') && game.cutscene && game.cutscene.type === 'place', 'placing the last seed');
      t.ok(until(t, () => game.cutscene && game.cutscene.type === 'ending', 20 * 60) >= 0, 'the ending starts');
      t.ok(until(t, () => ui.menu === 'ending', 30 * 60) >= 0, 'the ending card');
      ui.endingT -= 1600;
      t.press('interact'); t.frames(3);
      t.ok(game.S.ending === true && ui.menu !== 'ending', 'the ending closed');
      const b = game.bosses.woods;
      t.ok(b && b.rematch === true && b.state === 'sleep' && !b.sat, 'Grumble naps for the rematch', b && { rematch: b.rematch, state: b.state, sat: b.sat });
      t.eq(Object.keys(game.bosses).filter((id) => game.bosses[id].rematch && game.bosses[id].state === 'sleep').sort().join(), 'peaks,shores,woods', 'all three nap');
      t.ok(!Object.values(game.bosses).some((q) => q.sat), 'no Catcher sits after the bloom');
    }],
  ], { desc: 'Act I: the Catchers\' handover (S-005)', prepare: { view: 'fp', pose: 'spawn', god: true } });
}
