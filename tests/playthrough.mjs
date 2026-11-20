#!/usr/bin/env node
// Headless-browser playthrough: serve the repo, boot the game in Chromium (software WebGL via SwiftShader) with a clean
// localStorage and play it from New Game to the ending, then Continue it after a reload:
//  1. New Game from the title, through Elder Shellby's intro;
//  2. each guardian (woods, shores, peaks): walk into its arena so the fight starts, beat it (G.debug.killBoss), walk
//     onto the Starseed it drops until the game picks it up, and read the item-get through; after Captain Pinch, Clover's
//     errand: talking to her starts it, Use picks up the five rainbow shells (each saved), talking again gives the reward
//     once and finishes it;
//  3. at the pedestal, Use (the interact press) places the three seeds; the ending runs and shows its card, and closing
//     the card returns to free roam where Pip can walk; then Mayor Ribbit's parade: talking to him (Use) starts it and
//     shows four unlit lanterns; for each lantern Pip is put about 9 m out and walks to it, and it lights only once
//     Ribbit, following on his own (walking or a catch-up hop, never moved by the test), is close behind; mid-parade
//     Save & Quit → Continue keeps the lit lanterns and sends Ribbit home, and a talk picks the parade up again; with Pip
//     out of the village Ribbit waits at its edge; with all four lit he goes home and a talk finishes it once (+50
//     gems); then Miso's guardian plushies through her real shop (Use on Miso, arrow keys that wrap over the rows on
//     show, E and a mouse click to buy): the heart and sword first if needed, then all three plushies (a sold-out and a
//     not-enough-gems buy refused), each on her counter at once and saved; the pause menu's tracker reads 3/3 guardians,
//     3/3 Starseeds, 2/2 errands and 3/3 plushies;
//  4. Save & Quit, reload the page, Continue: the bloomed tree, the placed seeds, the finished errands and the plushies
//     on Miso's counter come back.
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

    // talk to Clover: stand in front of her, wait until she is the Use target, Use, read her lines through
    const talkToClover = async (what) => {
      if (!(await page.evaluate(() => window.G.debug.standAt('clover')))) fail(`G.debug.standAt('clover') found no spot (${what})`);
      await framesUntil(`Clover to be the Use target (${what})`, "game.target && game.target.o && game.target.o.id === 'clover'", 2);
      await pressUse(1);
      await framesUntil(`Clover's dialogue (${what})`, 'G.ui.dlg', 2);
      await readDialogue(`Clover's lines (${what})`);
      await frames(2);
    };
    const errandState = () => page.evaluate((k) => {
      const g = window.G.game, saved = JSON.parse(localStorage.getItem(k) || 'null');
      return {
        errand: g.S.errands.clover || 0, shells: Object.keys(g.S.shells).sort(), coins: g.S.coins, world: g.world.shells.length,
        shown: [...g.scenery.shells.values()].filter((q) => q.shown).map((q) => q.data.id),
        saved: saved && { errand: (saved.errands || {}).clover || 0, shells: Object.keys(saved.shells || {}).sort(), coins: saved.coins, v: saved.v },
      };
    }, SAVE_KEY);
    // Clover's errand, right after Captain Pinch: start it, pick up the five shells, finish it once
    const cloverErrand = async () => {
      let e = await errandState();
      if (e.errand !== 0 || e.shown.length) fail(`the errand started before Clover asked: ${JSON.stringify(e)}`);
      if (e.world !== 5) fail(`the island has ${e.world} rainbow shells, expected 5`);
      await talkToClover('start');
      e = await errandState();
      if (e.errand !== 1 || e.shown.length !== 5 || !e.saved || e.saved.errand !== 1) fail(`talking to Clover did not start the errand: ${JSON.stringify(e)}`);
      for (let i = 0; i < 5; i++) {
        if (!(await page.evaluate((i) => window.G.debug.standAt('shell', i), i))) fail(`G.debug.standAt('shell', ${i}) found no spot`);
        await framesUntil(`rainbow shell ${i + 1} to be the Use target`, `game.target && game.target.kind === 'shell' && game.target.o.id === 'shell${i + 1}'`, 2);
        await pressUse(2);
        e = await errandState();
        if (e.shells.length !== i + 1 || e.shown.includes('shell' + (i + 1)) || !e.saved || e.saved.shells.length !== i + 1) fail(`Use did not pick up and save rainbow shell ${i + 1}: ${JSON.stringify(e)}`);
      }
      await talkToClover('progress');   // a talk with every shell found finishes it
      const c0 = e.coins;
      e = await errandState();
      if (e.errand !== 2 || e.coins !== c0 + 50 || e.saved.errand !== 2 || e.saved.coins !== e.coins) fail(`returning the shells did not finish the errand once with its reward: ${JSON.stringify({ c0, ...e })}`);
      await talkToClover('after');
      const e2 = await errandState();
      if (e2.errand !== 2 || e2.coins !== e.coins) fail(`a second talk changed the errand or the gems: ${JSON.stringify(e2)}`);
      step(`Clover's errand: started, 5 rainbow shells picked up and saved, finished once (+50 gems, ${e.coins} total)`);
    };

    // talk to a villager by id through real Use input: stand in front of him, wait until he is the target, Use, read
    // his lines through
    const talkToNpc = async (id, what) => {
      if (!(await page.evaluate((id) => window.G.debug.standAt(id), id))) fail(`G.debug.standAt('${id}') found no spot (${what})`);
      await framesUntil(`${id} to be the Use target (${what})`, `game.target && game.target.o && game.target.o.id === '${id}'`, 2);
      await pressUse(1);
      await framesUntil(`${id}'s dialogue (${what})`, 'G.ui.dlg', 2);
      await readDialogue(`${id}'s lines (${what})`);
      await frames(2);
    };
    const paradeState = () => page.evaluate((k) => {
      const g = window.G.game, S = g.S, saved = JSON.parse(localStorage.getItem(k) || 'null');
      const r = g.npcs.find((n) => n.id === 'ribbit'), p = g.player.pos, L = [...g.scenery.lanterns.values()];
      const lit = (o) => Object.keys((o && o.shells) || {}).filter((q) => q.startsWith('lantern')).sort();
      return {
        errand: S.errands.ribbit || 0, lit: lit(S), coins: S.coins, world: g.world.lanterns.length,
        shown: L.filter((q) => q.shown).map((q) => q.data.id), litShown: L.filter((q) => q.shown && q.lit).map((q) => q.data.id),
        follow: r.follow, homing: r.homing, catchUps: r.catchUps, rib: [r.pos.x, r.pos.z], pip: [p.x, p.z],
        gap: Math.hypot(r.pos.x - p.x, r.pos.z - p.z), home: Math.hypot(r.pos.x - r.home.x, r.pos.z - r.home.z), ribR: Math.hypot(r.pos.x, r.pos.z),
        saved: saved && { errand: (saved.errands || {}).ribbit || 0, lit: lit(saved), coins: saved.coins },
      };
    }, SAVE_KEY);
    // a spot about 9 m from lantern i with a clear, walkable straight line to it that passes no other lantern (inside
    // the village circle) → { x, z, yaw } facing the lantern
    const lanternApproach = (i) => page.evaluate(async (i) => {
      const { penetration } = await import('/js/phys.js'), { world: TW } = await import('/js/tune.js');
      const W = window.G.world, it = W.lanterns[i];
      const clear = (x, z) => W.walkable(x, z) && penetration(W, x, z, 0.5) <= 0 && Math.hypot(x, z) < TW.paradeR - 2
        && W.lanterns.every((q) => q === it || Math.hypot(q.x - x, q.z - z) > 3.5);
      for (const d of [9, 8, 10, 7]) for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, x0 = it.x + Math.sin(a) * d, z0 = it.z + Math.cos(a) * d;
        let ok = true;
        for (let t = 0; t <= d - 0.8 && ok; t += 0.4) ok = clear(x0 + ((it.x - x0) * t) / d, z0 + ((it.z - z0) * t) / d);
        if (ok) return { x: x0, z: z0, yaw: Math.atan2(it.x - x0, it.z - z0) };
      }
      return null;
    }, i);
    // walk Pip to lantern i from its approach spot (steering at it every chunk); it must light only with Ribbit close
    // behind, having moved there himself (walking with Pip or a catch-up hop) → { before, after, frames }
    const walkToLantern = async (i) => {
      const ap = await lanternApproach(i);
      if (!ap) fail(`no clear approach to parade lantern ${i + 1}`);
      await page.evaluate(([x, z, yaw]) => window.G.debug.teleport(x, z, yaw, 0), [ap.x, ap.z, ap.yaw]);
      const before = await paradeState();
      if (before.lit.includes('lantern' + (i + 1))) fail(`parade lantern ${i + 1} lit before Pip got there: ${JSON.stringify(before)}`);
      await page.evaluate(() => window.G.debug.move(0, 1));
      const n = await framesUntil(`parade lantern ${i + 1} to light`, `S.shells['lantern${i + 1}'] === true`, 25,
        `{ const q = G.world.lanterns[${i}], p = game.player.pos; G.debug.look(Math.atan2(q.x - p.x, q.z - p.z), 0); G.debug.move(0, Math.hypot(q.x - p.x, q.z - p.z) > 0.8 ? 1 : 0); }`);
      await page.evaluate(() => window.G.debug.move(0, 0));
      const after = await paradeState();
      const it = await page.evaluate((i) => { const q = window.G.world.lanterns[i]; return [q.x, q.z]; }, i);
      const pipToLantern = Math.hypot(after.pip[0] - it[0], after.pip[1] - it[1]);
      const ribMoved = Math.hypot(after.rib[0] - before.rib[0], after.rib[1] - before.rib[1]);
      if (pipToLantern > 2.6) fail(`parade lantern ${i + 1} lit with Pip ${pipToLantern.toFixed(2)} m away`);
      if (after.gap > 6.05) fail(`parade lantern ${i + 1} lit with Ribbit ${after.gap.toFixed(2)} m behind`);
      if (!(ribMoved > 3) && after.catchUps === before.catchUps) fail(`Ribbit did not follow to lantern ${i + 1} (moved ${ribMoved.toFixed(2)} m, no catch-up hop)`);
      if (!after.litShown.includes('lantern' + (i + 1)) || !after.saved || !after.saved.lit.includes('lantern' + (i + 1))) fail(`parade lantern ${i + 1} not shown lit and saved at once: ${JSON.stringify(after)}`);
      return { before, after, frames: n, ribMoved };
    };
    // Mayor Ribbit's parade, after the bloom
    const ribbitParade = async () => {
      let e = await paradeState();
      if (e.errand !== 0 || e.shown.length || e.follow) fail(`the parade started before Ribbit asked: ${JSON.stringify(e)}`);
      if (e.world !== 4) fail(`the village has ${e.world} parade lanterns, expected 4`);
      await talkToNpc('ribbit', 'start');
      e = await paradeState();
      if (e.errand !== 1 || e.shown.length !== 4 || e.litShown.length || !e.follow || !e.saved || e.saved.errand !== 1) fail(`talking to Ribbit did not start the parade: ${JSON.stringify(e)}`);
      step('Ribbit\'s parade: started by a talk, four unlit lanterns shown, Ribbit following');
      for (let i = 0; i < 4; i++) {
        if (i === 2) {
          // mid-parade Save & Quit → Continue: the two lit lanterns stay lit, Ribbit is home and not following
          await page.evaluate(() => { window.G.ui.openPause(); window.G.ui.onPauseChoice(5); });
          await framesUntil('the title after Save & Quit (mid-parade)', "game.state === 'title'", 5);
          if (!(await continueVisible())) fail('Continue is hidden after Save & Quit mid-parade');
          await page.locator('[data-a="continue"]').click();
          await waitFor("G.game.state === 'play' after Continue (mid-parade)", () => window.G.game.state === 'play');
          await framesUntil('the session fade-in after Continue (mid-parade)', '!game.trans', 5);
          await frames(30);
          e = await paradeState();
          if (e.errand !== 1 || e.lit.join() !== 'lantern1,lantern2' || e.litShown.join() !== 'lantern1,lantern2' || e.shown.length !== 4 || e.follow || e.home > 0.7) fail(`Continue mid-parade did not keep the lit lanterns and send Ribbit home: ${JSON.stringify(e)}`);
          // without Ribbit (home, not following) Pip standing right at a lantern does not light it
          await page.evaluate(() => { const q = window.G.world.lanterns[2]; window.G.debug.teleport(q.x + 1, q.z); });
          await frames(90);
          e = await paradeState();
          if (e.lit.includes('lantern3') || e.follow) fail(`a lantern lit without Ribbit following: ${JSON.stringify(e)}`);
          await talkToNpc('ribbit', 'resume');
          e = await paradeState();
          if (e.errand !== 1 || !e.follow || e.lit.length !== 2) fail(`a talk did not pick the parade up again after Continue: ${JSON.stringify(e)}`);
          // Pip leaves the village: Ribbit waits at its edge
          await page.evaluate(() => { const W = window.G.world, p = W.pathAtDist('meadow', 75); window.G.debug.teleport(p.x, p.z); });
          await frames(240);
          e = await paradeState();
          const edge = await page.evaluate(async () => (await import('/js/tune.js')).world.paradeR);
          if (!e.follow || e.ribR > edge + 0.5 || e.gap < 10 || e.lit.length !== 2) fail(`with Pip out of the village Ribbit did not wait at its edge: ${JSON.stringify(e)}`);
          step(`mid-parade Save & Quit → Continue kept 2 lit lanterns, Ribbit went home and followed again after a talk; with Pip out of the village he waited at its edge (${e.ribR.toFixed(1)} m from the plaza, ${e.gap.toFixed(1)} m from Pip)`);
        }
        const w = await walkToLantern(i);
        if (i === 0) {
          // Pip stops: Ribbit stops too, close behind, standing (no walking or hopping on the spot)
          await frames(90);
          const still = await page.evaluate((n) => {
            const g = window.G.game, r = g.npcs.find((q) => q.id === 'ribbit'), p0 = r.pos.clone();
            let hop = 0, walk = 0;
            for (let k = 0; k < n; k++) { g.runFrame(1 / 60, true, false); hop = Math.max(hop, r.hop); if (r.state === 'walk') walk++; }
            return { moved: r.pos.distanceTo(p0), hop, walk, gap: Math.hypot(r.pos.x - g.player.pos.x, r.pos.z - g.player.pos.z), follow: r.follow };
          }, 60);
          if (!still.follow || still.moved > 0.05 || still.hop > 0.01 || still.walk || still.gap > 6) fail(`Ribbit did not stop when Pip stopped: ${JSON.stringify(still)}`);
          // a talk while he follows keeps the parade going
          await talkToNpc('ribbit', 'mid-parade');
          const t = await paradeState();
          if (t.errand !== 1 || !t.follow || t.lit.join() !== 'lantern1') fail(`a talk mid-parade changed it: ${JSON.stringify(t)}`);
          step(`Pip stopped and Ribbit stood ${still.gap.toFixed(1)} m behind him; a talk mid-parade kept him following`);
        }
        step(`parade lantern ${i + 1} (${await page.evaluate((i) => window.G.world.lanterns[i].at, i)}) lit after ${w.frames} frames: Ribbit ${w.after.gap.toFixed(1)} m behind, moved ${w.ribMoved.toFixed(1)} m${w.after.catchUps > w.before.catchUps ? ' (a catch-up hop)' : ''}`);
      }
      e = await paradeState();
      if (e.follow || e.lit.length !== 4 || e.litShown.length !== 4) fail(`all four lit but the parade did not end: ${JSON.stringify(e)}`);
      await framesUntil('Ribbit to hop home after the parade', "!game.npcs.find((n) => n.id === 'ribbit').homing", 30);
      const c0 = e.coins;
      await talkToNpc('ribbit', 'finish');
      e = await paradeState();
      if (e.errand !== 2 || e.coins !== c0 + 50 || e.saved.errand !== 2 || e.saved.coins !== e.coins || e.follow) fail(`the parade did not finish once with its reward: ${JSON.stringify({ c0, ...e })}`);
      await talkToNpc('ribbit', 'after');
      const e2 = await paradeState();
      if (e2.errand !== 2 || e2.coins !== e.coins || e2.follow || e2.litShown.length !== 4) fail(`a second talk changed the parade or the gems: ${JSON.stringify(e2)}`);
      step(`Ribbit's parade: 4 lanterns lit and saved, finished once (+50 gems, ${e.coins} total), lanterns stay lit`);
    };

    // Miso's guardian plushies, after the bloom, through the real shop UI: Use on Miso opens it after her lines, arrow keys
    // choose (wrapping over the rows on show), E buys, a mouse click buys too; Esc leaves (and saves)
    const shopState = () => page.evaluate((k) => {
      const G = window.G, g = G.game, S = g.S, saved = JSON.parse(localStorage.getItem(k) || 'null');
      const rows = [...document.querySelectorAll('#shop .shop-item')];
      return {
        open: !!G.ui.shop, sel: G.ui.shop ? G.ui.shop.sel : null, msg: G.ui.shop ? G.ui.shop.msg : null, coins: S.coins,
        rows: rows.map((r) => ({ name: r.querySelector('.nm').textContent, price: r.querySelector('.pr').textContent.trim(), sel: r.classList.contains('sel') })),
        heart: S.shopHeart, sword: S.swordLevel, plushies: Object.keys(S.plushies || {}).filter((q) => S.plushies[q] === true).sort(),
        shown: [...g.scenery.plushies.entries()].filter(([, o]) => o.visible).map(([q]) => q).sort(),
        saved: saved && { v: saved.v, plushies: Object.keys(saved.plushies || {}).sort(), coins: saved.coins },
      };
    }, SAVE_KEY);
    // a real key press, then a few frames (no draw) so the game reads it
    const shopKey = async (code) => {
      await page.keyboard.press(code);
      await page.evaluate((STEP) => { for (let i = 0; i < 3; i++) window.G.game.runFrame(STEP, true, false); }, STEP);
      if (problems.length) fail(`errors after pressing ${code} in the shop`);
      return shopState();
    };
    const shopSel = async (want) => {
      for (let guard = 0; ; guard++) {
        const st = await shopState();
        if (st.sel === want) return st;
        if (guard > 12) fail(`could not reach shop row ${want} with the arrow keys: ${JSON.stringify(st)}`);
        await shopKey('ArrowDown');
      }
    };
    const PLUSH = ['Grumble Shroom plushie', 'Captain Pinch plushie', 'Frostbun plushie'];
    const misoPlushies = async () => {
      await talkToNpc('miso', 'open the shop');
      let e = await shopState();
      if (!e.open) fail(`Miso's shop did not open after her lines: ${JSON.stringify(e)}`);
      const bought = e.heart && e.sword === 2;
      if (!bought && e.rows.map((r) => r.name).join() !== 'Potion,Heart Container,Shiny Sword') fail(`before the heart and sword are sold the shop shows ${JSON.stringify(e.rows)}`);
      if (e.plushies.length || e.shown.length) fail(`plushies before any were bought: ${JSON.stringify(e)}`);
      // gems for everything left, minus one: the last plushie is refused first
      const need = (e.heart ? 0 : 120) + (e.sword === 2 ? 0 : 150) + 240;
      await page.evaluate((n) => window.G.debug.gems(n), need - 1 - e.coins);
      if (!e.heart) { await shopSel(1); e = await shopKey('KeyE'); if (!e.heart || e.rows[1].price !== 'SOLD OUT') fail(`E did not buy the Heart Container: ${JSON.stringify(e)}`); }
      if (e.sword !== 2) { await shopSel(2); e = await shopKey('KeyE'); if (e.sword !== 2 || e.rows[2].price !== 'SOLD OUT') fail(`E did not buy the Shiny Sword: ${JSON.stringify(e)}`); }
      e = await shopState();
      if (e.rows.length !== 6 || e.rows.slice(3).map((r) => r.name).join() !== PLUSH.join() || e.rows.slice(3).some((r) => r.price !== '80')) fail(`with the shop bought out and three guardians beaten, the plushie rows are wrong: ${JSON.stringify(e.rows)}`);
      if (e.coins !== 239) fail(`gems before the plushies: ${e.coins}, expected 239`);
      // ↑ wraps from the first row to the last plushie, ↓ from it back to the first
      await shopSel(0);
      e = await shopKey('ArrowUp');
      if (e.sel !== 5 || !e.rows[5].sel) fail(`↑ on the first row did not wrap to the last plushie: ${JSON.stringify(e)}`);
      e = await shopKey('ArrowDown');
      if (e.sel !== 0) fail(`↓ on the last row did not wrap to the first: ${JSON.stringify(e)}`);
      // E buys the Grumble Shroom plushie once; a second E is refused with the sold-out line
      await shopSel(3);
      e = await shopKey('KeyE');
      if (e.coins !== 159 || e.plushies.join() !== 'woods' || e.rows[3].price !== 'SOLD OUT' || e.shown.join() !== 'woods') fail(`E did not buy the Grumble Shroom plushie (on the counter at once): ${JSON.stringify(e)}`);
      e = await shopKey('KeyE');
      if (e.coins !== 159 || !/^Sold out!/.test(e.msg)) fail(`a second buy of the same plushie was not refused: ${JSON.stringify(e)}`);
      await shopSel(4);
      e = await shopKey('KeyE');
      if (e.coins !== 79 || e.plushies.join() !== 'shores,woods' || e.shown.join() !== 'shores,woods') fail(`E did not buy the Captain Pinch plushie: ${JSON.stringify(e)}`);
      // a mouse click (a tap's path) on the Frostbun row: 79 gems are not enough, then with 80 it is bought
      const clickRow = async (i) => { await page.click(`#shop .shop-item[data-i="${i}"]`); await page.evaluate((STEP) => { for (let k = 0; k < 3; k++) window.G.game.runFrame(STEP, true, false); }, STEP); return shopState(); };
      e = await clickRow(5);
      if (e.coins !== 79 || e.plushies.length !== 2 || !/^Not enough gems/.test(e.msg)) fail(`a click with too few gems was not refused: ${JSON.stringify(e)}`);
      await page.evaluate(() => window.G.debug.gems(1));
      e = await clickRow(5);
      if (e.coins !== 0 || e.plushies.join() !== 'peaks,shores,woods' || e.shown.join() !== 'peaks,shores,woods' || e.rows.slice(3).some((r) => r.price !== 'SOLD OUT')) fail(`a click did not buy the Frostbun plushie: ${JSON.stringify(e)}`);
      e = await shopKey('Escape');
      if (e.open || !e.saved || e.saved.v !== 4 || e.saved.plushies.join() !== 'peaks,shores,woods' || e.saved.coins !== 0) fail(`leaving the shop did not save the plushies: ${JSON.stringify(e)}`);
      await frames(2);
      // Miso is still the Use target with three plushies on her counter, and she talks about them
      await talkToNpc('miso', 'after the plushies');
      e = await shopState();
      const said = await page.evaluate(() => window.G.game.npcs.find((n) => n.id === 'miso').def.lines(window.G.game.S).join(' '));
      if (!e.open || !said.includes('All three guardian plushies')) fail(`Miso after all three plushies: ${JSON.stringify({ e, said })}`);
      await shopKey('Escape');
      step(`Miso's plushies: shop bought out, 6 rows (↑↓ wrap), 3 plushies bought (2 with E, 1 by click; sold-out and not-enough-gems refused), on her counter at once and saved`);
    };

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
    { const e = await paradeState(); if (e.world !== 4 || e.shown.length || e.errand !== 0) fail(`parade lanterns before the bloom: ${JSON.stringify(e)}`); }

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
      if (id === 'shores') await cloverErrand();
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
    await ribbitParade();
    await misoPlushies();

    // the completion tracker on the pause menu
    const tally = await page.evaluate(() => {
      window.G.ui.openPause();
      const chips = [...document.querySelectorAll('#pause .ptrack .tchip')];
      return Object.fromEntries(chips.map((c) => [c.dataset.k, { text: c.querySelector('b').textContent.trim(), full: c.classList.contains('full') }]));
    });
    for (const k of ['guardians', 'seeds']) if (!tally[k] || tally[k].text !== '3/3' || !tally[k].full) fail(`pause tracker ${k}: ${JSON.stringify(tally[k])}, expected 3/3`);
    if (!tally.errands || tally.errands.text !== '2/2' || !tally.errands.full) fail(`pause tracker errands: ${JSON.stringify(tally.errands)}, expected 2/2`);
    if (!tally.plushies || tally.plushies.text !== '3/3' || !tally.plushies.full) fail(`pause tracker plushies: ${JSON.stringify(tally.plushies)}, expected 3/3`);
    step(`pause tracker: guardians ${tally.guardians.text}, Starseeds ${tally.seeds.text}, errands ${tally.errands.text}, plushies ${tally.plushies.text}`);

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
        ending: S.ending, seeds: S.seeds, bosses: S.bosses, bloom, liveBosses: Object.keys(g.bosses), errands: S.errands, shells: S.shells,
        shellsShown: [...g.scenery.shells.values()].filter((q) => q.shown).length,
        lanternsLit: [...g.scenery.lanterns.values()].filter((q) => q.shown && q.lit && q.glow === 1).length, ribbitFollows: g.npcs.find((n) => n.id === 'ribbit').follow,
        plushies: S.plushies, plushiesShown: [...g.scenery.plushies.entries()].filter(([, o]) => o.visible).map(([q]) => q).sort(), v: S.v,
        pedSeeds: g.pedSeeds.map((m) => m.visible), treeSeeds: g.treeSeedsWanted() ? g.treeSeeds.every((m) => m.visible) : null,
      };
    });
    if (back.ending !== true) fail('S.ending is not restored by Continue');
    if (!GUARDIANS.every((id) => back.seeds[id] === 2 && back.bosses[id] === true)) fail(`seeds or guardians not restored: ${JSON.stringify(back)}`);
    if (back.liveBosses.length) fail(`guardians back on the island after Continue: ${back.liveBosses}`);
    if (back.bloom === false) fail(`the Great Tree is not bloomed after Continue: ${JSON.stringify(back)}`);
    if (back.bloom === null && back.treeSeeds !== true) fail(`no bloom shown after Continue: ${JSON.stringify(back)}`);
    if (!back.pedSeeds.every(Boolean)) fail(`pedestal seeds not shown after Continue: ${JSON.stringify(back.pedSeeds)}`);
    if (back.errands.clover !== 2 || Object.keys(back.shells).filter((k) => k.startsWith('shell')).length !== 5 || back.shellsShown !== 0) fail(`Clover's errand not restored: ${JSON.stringify({ errands: back.errands, shells: back.shells, shown: back.shellsShown })}`);
    if (back.errands.ribbit !== 2 || ['lantern1', 'lantern2', 'lantern3', 'lantern4'].some((k) => back.shells[k] !== true) || back.lanternsLit !== 4 || back.ribbitFollows) fail(`Ribbit's parade not restored: ${JSON.stringify({ errands: back.errands, shells: back.shells, lit: back.lanternsLit, follows: back.ribbitFollows })}`);
    if (JSON.stringify(back.plushies) !== JSON.stringify({ woods: true, shores: true, peaks: true }) || back.plushiesShown.join() !== 'peaks,shores,woods' || back.v !== 4) fail(`Miso's plushies not restored: ${JSON.stringify({ plushies: back.plushies, shown: back.plushiesShown, v: back.v })}`);
    if (problems.length) fail('errors after Continue');
    step(`Continue restored the ending: bloomed tree, ${back.pedSeeds.length} seeds on the pedestal, no guardians left, Clover's errand done, Ribbit's parade done with 4 lanterns lit, 3 plushies on Miso's counter`);
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
