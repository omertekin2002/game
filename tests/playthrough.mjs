#!/usr/bin/env node
// Headless-browser playthrough: serve the repo, boot the game in Chromium (software WebGL via SwiftShader) with a clean
// localStorage and play it from New Game to the ending, then Continue it after a reload:
//  1. New Game from the title, through Elder Shellby's intro;
//  2. each guardian (woods, shores, peaks): walk into its arena so the fight starts, beat it (G.debug.killBoss), walk
//     onto the Starseed it drops until the game picks it up, and read the item-get through;
//  3. at the pedestal, Use (the interact press) places the three seeds; the ending runs and shows its card, and closing
//     the card returns to free roam where Pip can walk; the pause menu's tracker reads 3/3 guardians and 3/3 Starseeds;
//  4. Save & Quit, reload the page, Continue: the bloomed tree and the placed seeds come back.
// The simulation is stepped through the real frame loop (game.runFrame with the manual clock) rather than waited for in
// real time, because software WebGL runs at about 1–11 fps. Fails on any page error, console error or failed request.
// Usage: node tests/playthrough.mjs   (or `bun run test:playthrough`). On failure a screenshot lands in test-results/.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH, SAVE_KEY, startServer } from './lib/browser.mjs';

const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
// starting a session compiles every shader on its first frame (around 10 s in software WebGL on a two-core runner)
const STEP_TIMEOUT = 60_000;
// nolock=1: look by mouse drag instead of pointer lock (headless Chromium floods a locked page with mouse moves; see
// tests/smoke.mjs)
const QUERY = '?debug=1&nolock=1';
const SHOT = new URL('../test-results/playthrough-failure.png', import.meta.url);
const GUARDIANS = ['woods', 'shores', 'peaks'];
const STEP = 1 / 60;                    // one frame = one fixed step (STEP in js/clock.js)
const FPS = 60;
// frames per page.evaluate (one second of game time). Only the last frame of a chunk is drawn: the others run every
// update with draw = false (game.runFrame, as G.debug.advance and the in-page tests use it). A software-WebGL draw costs
// most of a second, and G.debug.advance(1) always draws its one frame.
const CHUNK = 60;

const T0 = Date.now();
const VERBOSE = !!process.env.PLAYTHROUGH_VERBOSE;   // log every wait with its frames and wall time
const step = (msg) => console.log(`[playthrough] ${((Date.now() - T0) / 1000).toFixed(0).padStart(4)} s  ${msg}`);
const fail = (msg) => { throw new Error(msg); };

async function main() {
  const problems = [];
  const server = await startServer();
  let browser, page;
  try {
    browser = await chromium.launch(LAUNCH);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

    // Errors are recorded asynchronously; check them alongside each wait so a broken step fails fast.
    const waitFor = async (what, fn, timeout = STEP_TIMEOUT, arg) => {
      const s = Date.now();
      while (Date.now() - s < timeout) {
        if (problems.length) fail(`errors while waiting for ${what}`);
        if (await page.evaluate(fn, arg).catch(() => false)) return Date.now() - s;
        await new Promise((r) => setTimeout(r, 200));
      }
      fail(`timed out after ${timeout} ms waiting for ${what}`);
    };
    // Run frames through the real loop (manual clock) until cond holds; cond is the body of a function of (G, game, S),
    // checked after each frame. `each` (optional, same form) runs before every chunk, e.g. to steer. → frames run
    const framesUntil = async (what, cond, maxSec, each = null) => {
      const max = Math.ceil(maxSec * FPS), w0 = Date.now();
      let n = 0, evals = 0;
      while (n < max) {
        if (problems.length) fail(`errors while waiting for ${what}`);
        const r = await page.evaluate(([cond, each, chunk, STEP]) => {
          const G = window.G, game = G.game;
          const ok = new Function('G', 'game', 'S', `return !!(${cond});`);
          if (each) new Function('G', 'game', 'S', each)(G, game, game.S);
          for (let i = 0; i < chunk; i++) {
            const draw = i === chunk - 1;
            game.runFrame(STEP, true, draw);
            if (draw) window.__gpuSync();
            if (ok(G, game, game.S)) return { done: true, n: i + 1 };
          }
          return { done: false, n: chunk };
        }, [cond, each, Math.min(CHUNK, max - n), STEP]);
        n += r.n; evals++;
        if (r.done) { if (VERBOSE) step(`  ${what}: ${n} frames, ${evals} chunks, ${Date.now() - w0} ms`); return n; }
      }
      fail(`${what}: not within ${maxSec} s of game time (${n} frames)`);
    };
    const frames = (n) => page.evaluate(([k, STEP]) => { for (let i = 0; i < k; i++) window.G.game.runFrame(STEP, true, i === k - 1); window.__gpuSync(); }, [n, STEP]);
    // Wait for the GPU to finish what was drawn (a one-pixel read back): software WebGL draws slower than the test runs
    // frames, and a queue of draws left behind is paid when the page is torn down (a reload waited minutes for it on CI)
    const installGpuSync = () => page.evaluate(() => {
      const px = new Uint8Array(4);
      window.__gpuSync = () => { const gl = window.G.game.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    });
    // a Use press (the interact action, as E / Enter / pad Y give it), then k frames with no draw
    const pressUse = (k) => page.evaluate(([k, STEP]) => { window.G.debug.press('interact', 0); for (let i = 0; i < k; i++) window.G.game.runFrame(STEP, true, false); }, [k, STEP]);
    // read a dialogue through with Use presses (the first press shows the whole line, the next one moves on)
    const readDialogue = async (what) => {
      const w0 = Date.now();
      for (let i = 0; i < 80; i++) {
        if (await page.evaluate(() => !window.G.ui.dlg)) { if (VERBOSE) step(`  ${what}: ${i} presses, ${Date.now() - w0} ms`); return; }
        await pressUse(6);
        if (problems.length) fail(`errors during ${what}`);
      }
      fail(`${what} did not end after 80 presses`);
    };
    const state = () => page.evaluate(() => {
      const G = window.G, g = G.game, S = g.S;
      return { state: g.state, playing: g.playing, pState: g.player.state, cutscene: g.cutscene ? g.cutscene.type : null, menu: G.ui.menu, dlg: !!G.ui.dlg, fight: g.fight ? g.fight.phase : null, seeds: { ...S.seeds }, bosses: { ...S.bosses }, ending: S.ending };
    });
    const boot = async (what) => {
      const ms = await waitFor(`boot (${what})`, () => {
        const G = window.G, loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
      }, BOOT_TIMEOUT);
      step(`booted to the title in ${ms} ms (${what})`);
      await page.locator('#game').focus();
    };
    const continueVisible = () => page.evaluate(() => {
      const b = document.querySelector('[data-a="continue"]');
      return !!b && b.style.display !== 'none';
    });

    // ---- 1. New Game from a clean localStorage, through Shellby's intro
    step(`open ${server.url}${QUERY}`);
    await page.goto(`${server.url}${QUERY}`, { waitUntil: 'load', timeout: BOOT_TIMEOUT });
    await boot('clean localStorage');
    if (await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY) !== null) fail('localStorage already holds a save');
    if (await continueVisible()) fail('Continue is shown with no save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after New Game", () => window.G.game.state === 'play');
    // from here the test runs every frame: the manual clock, without its redraws, so only the frames the test draws reach
    // the GPU (a software-WebGL draw costs a fraction of a second; redraws at 60 Hz queue minutes of them); a fixed seed
    // for the AI and effects; Pip takes no damage, and other enemies hold still (the guardians are beaten with killBoss)
    await installGpuSync();
    await page.evaluate(() => { const D = window.G.debug; D.clock({ manual: true, redraw: false }); D.seed(29); D.god(true); D.freezeAI(true); });
    await framesUntil("Shellby's intro dialogue", 'G.ui.dlg && !game.trans', 10);
    await readDialogue("Shellby's intro");
    let s = await state();
    if (!s.playing) fail(`not in free play after the intro: ${JSON.stringify(s)}`);
    if (!(await page.evaluate(() => window.G.game.S.introDone))) fail('the intro is not recorded as done');
    step('new game started and Shellby\'s intro read through');

    // ---- 2. The three guardians
    for (const id of GUARDIANS) {
      const got = await page.evaluate((id) => window.G.debug.toBoss(id), id);
      if (got !== id) fail(`G.debug.toBoss('${id}') returned ${got}`);
      await frames(2);
      // walk in through the arena's entrance (toBoss leaves Pip outside it, facing the middle) until the fight starts
      await page.evaluate(() => window.G.debug.move(0, 1));
      const walk = await framesUntil(`the ${id} fight to start`, 'game.fight', 15, `{ const a = G.world.arenas['${id}']; const p = game.player.pos; G.debug.look(Math.atan2(a.x - p.x, a.z - p.z), 0); }`);
      await page.evaluate(() => window.G.debug.move(0, 0));
      if ((await state()).fight !== 'intro') fail(`the ${id} fight did not open with its intro`);
      await framesUntil(`the ${id} intro to hand over to the fight`, "game.fight && game.fight.phase === 'fight'", 10);
      if (!(await page.evaluate(() => window.G.debug.killBoss()))) fail(`G.debug.killBoss() found no ${id} boss to beat`);
      await framesUntil(`the ${id} guardian to be beaten`, `S.bosses['${id}'] === true`, 20);
      await framesUntil(`the ${id} fight to wind down`, '!game.fight', 10);
      // the Starseed it dropped: walk onto it (steering at it every chunk) until the game picks it up
      const seed = await page.evaluate((id) => { const p = window.G.game.pickups.find((q) => q.kind === 'seed' && q.seedId === id && q.alive); return p ? [p.pos.x, p.pos.z] : null; }, id);
      if (!seed) fail(`no ${id} Starseed dropped`);
      await page.evaluate(() => window.G.debug.move(0, 1));
      await framesUntil(`Pip to pick up the ${id} Starseed`, `S.seeds['${id}'] === 1`, 20, `{ const q = game.pickups.find((o) => o.kind === 'seed' && o.seedId === '${id}' && o.alive); if (q) { const p = game.player.pos; G.debug.look(Math.atan2(q.pos.x - p.x, q.pos.z - p.z), 0); G.debug.move(0, Math.hypot(q.pos.x - p.x, q.pos.z - p.z) > 0.6 ? 1 : 0); } }`);
      await page.evaluate(() => window.G.debug.move(0, 0));
      await framesUntil(`the ${id} item-get dialogue`, 'G.ui.dlg', 3);
      await readDialogue(`the ${id} item-get`);
      s = await state();
      if (s.bosses[id] !== true) fail(`${id} not recorded as beaten: ${JSON.stringify(s.bosses)}`);
      if (s.seeds[id] !== 1) fail(`${id} Starseed not carried: ${JSON.stringify(s.seeds)}`);
      if (!s.playing) fail(`not back in free play after the ${id} Starseed: ${JSON.stringify(s)}`);
      if (await page.evaluate((id) => !!window.G.game.bosses[id], id)) fail(`the ${id} guardian is still on the island`);
      step(`${id}: walked into the arena (${walk} frames), beaten, Starseed picked up and carried`);
    }

    // ---- 3. The pedestal: Use places the seeds, the ending plays, then free roam
    const at = await page.evaluate(() => window.G.debug.standAt('pedestal'));
    if (!at) fail('G.debug.standAt(\'pedestal\') found no spot');
    await framesUntil('the pedestal to be the Use target', "game.target && game.target.o && game.target.o.kind === 'pedestal'", 2);
    await pressUse(1);
    if ((await state()).cutscene !== 'place') fail(`Use at the pedestal did not start the placing: ${JSON.stringify(await state())}`);
    await framesUntil('the three Starseeds to be placed and the ending to start', "game.cutscene && game.cutscene.type === 'ending'", 30);
    s = await state();
    if (!GUARDIANS.every((id) => s.seeds[id] === 2)) fail(`not every Starseed is placed: ${JSON.stringify(s.seeds)}`);
    step('Use at the pedestal placed all three Starseeds; the ending started');
    await framesUntil('the ending card', "G.ui.menu === 'ending'", 30);
    await waitFor('the ending card to show', () => window.G.ui.endingEl.classList.contains('show'));
    // the card ignores presses for its first 1.5 s of wall-clock time, then any button closes it: its opening time is
    // moved back instead of waiting that out
    await page.evaluate(() => { window.G.ui.endingT -= 1600; });
    await pressUse(1);
    s = await state();
    if (s.menu === 'ending') fail('a press did not close the ending card');
    if (s.ending !== true) fail('S.ending is not set after the ending');
    await framesUntil('free roam after the ending', 'game.playing && game.player.state === \'normal\'', 10);
    await frames(90);                   // the eyelid blink back to the altar
    const p0 = await page.evaluate(() => window.G.game.player.pos.toArray());
    await page.evaluate(() => window.G.debug.move(0, -1));
    await frames(45);
    await page.evaluate(() => window.G.debug.move(0, 0));
    const p1 = await page.evaluate(() => window.G.game.player.pos.toArray());
    const moved = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
    s = await state();
    if (s.state !== 'play' || !s.playing) fail(`not in free roam after the ending: ${JSON.stringify(s)}`);
    if (!(moved > 0.5)) fail(`Pip did not move after the ending (${moved.toFixed(2)} m)`);
    step(`ending card shown and closed; free roam, Pip walked ${moved.toFixed(2)} m`);

    // the completion tracker on the pause menu
    const tally = await page.evaluate(() => {
      window.G.ui.openPause();
      const chips = [...document.querySelectorAll('#pause .ptrack .tchip')];
      return Object.fromEntries(chips.map((c) => [c.dataset.k, { text: c.querySelector('b').textContent.trim(), full: c.classList.contains('full') }]));
    });
    for (const k of ['guardians', 'seeds']) if (!tally[k] || tally[k].text !== '3/3' || !tally[k].full) fail(`pause tracker ${k}: ${JSON.stringify(tally[k])}, expected 3/3`);
    step(`pause tracker: guardians ${tally.guardians.text}, Starseeds ${tally.seeds.text}`);

    // ---- 4. Save & Quit (from the pause menu), reload, Continue: the bloom comes back
    await page.evaluate(() => window.G.ui.onPauseChoice(5));
    await framesUntil('the title after Save & Quit', "game.state === 'title'", 5);
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    if (!saved || saved.ending !== true || !GUARDIANS.every((id) => saved.seeds[id] === 2 && saved.bosses[id] === true)) fail(`the save does not hold the finished game: ${JSON.stringify(saved && { ending: saved.ending, seeds: saved.seeds, bosses: saved.bosses })}`);
    step('saved and quit to the title');
    const r0 = Date.now();
    await page.reload({ waitUntil: 'load', timeout: BOOT_TIMEOUT });
    step(`reloaded the page in ${Date.now() - r0} ms`);
    await boot('after the reload');
    if (!(await continueVisible())) fail('Continue is hidden after the reload');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue", () => window.G.game.state === 'play');
    await installGpuSync();
    await page.evaluate(() => window.G.debug.clock({ manual: true, redraw: false }));
    await framesUntil('the session fade-in after Continue', '!game.trans', 5);
    await frames(30);
    const back = await page.evaluate(() => {
      const g = window.G.game, S = g.S, T = g.scenery.greatTree;
      // the bloomed tree: the blossom model when the tree is the GLB pair, else the built canopy's bloom group
      const bloom = T.glb ? (T.glb.b ? T.glb.b.visible && !T.glb.a.visible : null) : T.bloom.visible && !T.canopy.visible;
      return {
        ending: S.ending, seeds: S.seeds, bosses: S.bosses, bloom, liveBosses: Object.keys(g.bosses),
        pedSeeds: g.pedSeeds.map((m) => m.visible), treeSeeds: g.treeSeedsWanted() ? g.treeSeeds.every((m) => m.visible) : null,
      };
    });
    if (back.ending !== true) fail('S.ending is not restored by Continue');
    if (!GUARDIANS.every((id) => back.seeds[id] === 2 && back.bosses[id] === true)) fail(`seeds or guardians not restored: ${JSON.stringify(back)}`);
    if (back.liveBosses.length) fail(`guardians back on the island after Continue: ${back.liveBosses}`);
    if (back.bloom === false) fail(`the Great Tree is not bloomed after Continue: ${JSON.stringify(back)}`);
    if (back.bloom === null && back.treeSeeds !== true) fail(`no bloom shown after Continue: ${JSON.stringify(back)}`);
    if (!back.pedSeeds.every(Boolean)) fail(`pedestal seeds not shown after Continue: ${JSON.stringify(back.pedSeeds)}`);
    if (problems.length) fail('errors after Continue');
    step(`Continue restored the ending: bloomed tree, ${back.pedSeeds.length} seeds on the pedestal, no guardians left`);
  } catch (e) {
    for (const p of problems) console.error(`  - ${p}`);
    if (page) {
      await mkdir(new URL('.', SHOT), { recursive: true });
      await page.screenshot({ path: fileURLToPath(SHOT) }).catch(() => {});
      console.error(`[playthrough] screenshot: ${fileURLToPath(SHOT)}`);
    }
    throw e;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.proc.kill();
  }
  step('PASS');
}

main().catch((e) => {
  console.error(`[playthrough] FAIL: ${e.message}`);
  process.exit(1);
});
