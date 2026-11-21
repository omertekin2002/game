#!/usr/bin/env node
// Headless-browser smoke test: serve the repo, boot the game in Chromium (software WebGL via SwiftShader),
// start a New Game (checking the completion tracker on the pause menu and the map), then continue a valid, a corrupt
// and a newer-version save from localStorage. The same loads carry stored settings (valid, wrong-typed, not JSON at
// all) and check that they are applied, repaired and saved. Running from the repo registers no service worker and never
// requests sw.js (only the Pages build has one; tests/pwa.mjs). Fails on any page error, console error or failed request.
// Usage: node tests/smoke.mjs   (or `bun run test:smoke`). On failure a screenshot lands in test-results/.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH, SAVE_KEY, SETTINGS_KEY, startServer } from './lib/browser.mjs';
const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
// Starting a session compiles every shader on its first frame; in software WebGL on a two-core runner that frame
// alone takes around 10 s.
const STEP_TIMEOUT = 60_000;
// nolock=1: the game looks by mouse drag instead of capturing the pointer. Headless Chromium keeps feeding mouse
// moves to a page that holds the pointer lock; at software-WebGL frame rates the page cannot drain them and the
// browser process grows by about 100 MB a second until the runner is out of memory.
const QUERY = '?debug=1&nolock=1';
const SHOT = new URL('../test-results/smoke-failure.png', import.meta.url);

const step = (msg) => console.log(`[smoke] ${msg}`);

async function main() {
  const problems = [];
  const server = await startServer();
  let browser, page, titleAt = 0;
  try {
    browser = await chromium.launch(LAUNCH);
    const fail = (msg) => { throw new Error(msg); };
    // Open the game in a fresh context (its own localStorage). `save` and `settings`, if given, are written to
    // localStorage before any page script runs, so the game boots with exactly those (`settings` may be raw text).
    const openGame = async (save, settings) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      if (save !== undefined) {
        await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save)]);
      }
      if (settings !== undefined) {
        await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, typeof settings === 'string' ? settings : JSON.stringify(settings)]);
      }
      if (page) await page.context().close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
      page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
      page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
      page.on('request', (r) => { if (/\/sw\.js(?:[?#]|$)/.test(r.url())) problems.push(`requested the service worker: ${r.url()}`); });
      step(`open ${server.url}${QUERY}${save !== undefined ? ' with a save in localStorage' : ''}`);
      await page.goto(`${server.url}${QUERY}`, { waitUntil: 'load' });
      const ms = await waitFor('boot (G.world, loading screen gone, title shown)', () => {
        const G = window.G;
        const loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
      }, BOOT_TIMEOUT);
      step(`booted to title in ${ms} ms`);
      titleAt = Date.now();
      await page.locator('#game').focus();
    };
    // Errors are recorded asynchronously; poll them alongside each wait so a broken boot fails fast.
    const waitFor = async (what, fn, timeout, arg) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (problems.length) fail(`errors while waiting for ${what}`);
        if (await page.evaluate(fn, arg).catch(() => false)) return Date.now() - t0;
        await new Promise((r) => setTimeout(r, 200));
      }
      fail(`timed out after ${timeout} ms waiting for ${what}`);
    };
    // the settings in effect, what the game made of two of them, and what is in storage right now
    const settingsNow = () => page.evaluate((key) => {
      const G = window.G, S = G.settings;
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* unreadable text: null */ }
      return { all: S.all(), shadowMap: G.sky.sun.shadow.mapSize.x, calm: document.getElementById('ui').classList.contains('calm'), stored };
    }, SETTINGS_KEY);
    const continueVisible = () => page.evaluate(() => {
      const b = document.querySelector('[data-a="continue"]');
      return !!b && b.style.display !== 'none';
    });

    // 1. New Game with no save
    await openGame();
    if (await continueVisible()) fail('Continue is shown with no save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Enter on the title", () => window.G.game.state === 'play', STEP_TIMEOUT);
    step('new game started');

    // let a second of gameplay frames run so per-frame errors surface
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => window.G.debug && window.G.debug.info());
    if (!info) fail('G.debug.info() is unavailable (is ?debug=1 honoured?)');
    step(`debug info: ${JSON.stringify(info)}`);
    if (info.unreachable !== 0) fail(`world reports ${info.unreachable} unreachable targets`);
    if (problems.length) fail('errors during gameplay');

    // 1b. The completion tracker on the pause menu and the map card: a fresh game shows nothing found, a chest, a
    // guardian and a region set through G.game.S show on the next opening, and a finished save marks every chip.
    const tally = (sel) => page.evaluate((q) => {
      const chips = [...document.querySelectorAll(q + ' .tchip')];
      return Object.fromEntries(chips.map((c) => [c.dataset.k, { text: c.querySelector('b').textContent.trim(), full: c.classList.contains('full'), tick: !!c.querySelector('.tok') }]));
    }, sel);
    const openPause = () => page.evaluate(() => { window.G.ui.openPause(); return window.G.ui.menu; });
    const pauseToMap = () => page.evaluate(() => { window.G.ui.onPauseChoice(3); return window.G.ui.menu; });
    const closeMenus = () => page.evaluate(() => { window.G.ui.closeMenu(true); return window.G.ui.menu; });
    const regionsSeen = () => page.evaluate(() => [0, 1, 2, 3, 4].filter((i) => window.G.game.S.visited[i]).length);
    const nChests = await page.evaluate(() => window.G.world.chests.length);
    if (await openPause() !== 'pause') fail('the pause menu did not open');
    let t = await tally('#pause .ptrack');
    const r0 = await regionsSeen();
    const want0 = { chests: `0/${nChests}`, hearts: '0/5', guardians: '0/3', regions: `${r0}/5`, seeds: '0/3', errands: '0/2', plushies: '0/3', rematches: '0/3', secrets: '0/4' };
    for (const [k, v] of Object.entries(want0)) if (!t[k] || t[k].text !== v || t[k].full) fail(`pause tracker ${k} on a new game: ${JSON.stringify(t[k])}, expected ${v}`);
    await closeMenus();
    const had3 = await page.evaluate(() => {
      const g = window.G.game, W = window.G.world, had = !!g.S.visited[3];
      g.S.chests[W.chests.find((c) => c.kind !== 'heart').id] = true;
      g.S.bosses.woods = true;
      g.S.visited[3] = true;
      return had;
    });
    const r1 = await regionsSeen();
    if (r1 !== r0 + (had3 ? 0 : 1)) fail(`setting a visited region did not take: ${r0} → ${r1}`);
    const want1 = { chests: `1/${nChests}`, guardians: '1/3', regions: `${r1}/5` };
    if (await openPause() !== 'pause') fail('the pause menu did not reopen');
    t = await tally('#pause .ptrack');
    for (const [k, v] of Object.entries(want1)) if (!t[k] || t[k].text !== v) fail(`pause tracker ${k} after setting flags: ${JSON.stringify(t[k])}, expected ${v}`);
    if (await pauseToMap() !== 'map') fail('Map from the pause menu did not open the map card');
    t = await tally('#mapview .mtrack');
    for (const [k, v] of Object.entries(want1)) if (!t[k] || t[k].text !== v) fail(`map tracker ${k} after setting flags: ${JSON.stringify(t[k])}, expected ${v}`);
    await closeMenus();
    await page.evaluate(() => {
      const S = window.G.game.S, W = window.G.world;
      for (const c of W.chests) S.chests[c.id] = true;
      for (const id of ['woods', 'peaks', 'shores']) { S.bosses[id] = true; S.seeds[id] = 2; }
      for (let i = 0; i < 5; i++) S.visited[i] = true;
      S.shopHeart = true;
    });
    // everything but the errands: their chip and the total are not complete yet; with Clover's done, still not
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.errands || t.errands.text !== '0/2' || t.errands.full || t.errands.tick || !t.pct || t.pct.full) fail(`pause tracker without the errands: ${JSON.stringify({ errands: t.errands, pct: t.pct })}`);
    await closeMenus();
    await page.evaluate(() => { window.G.game.S.errands.clover = 2; });
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.errands || t.errands.text !== '1/2' || t.errands.full || t.errands.tick || !t.pct || t.pct.full) fail(`pause tracker with one errand done: ${JSON.stringify({ errands: t.errands, pct: t.pct })}`);
    await closeMenus();
    await page.evaluate(() => { window.G.game.S.errands.ribbit = 2; });
    // both errands done but no plushie bought yet: the Plushies chip and the total are still not complete
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.plushies || t.plushies.text !== '0/3' || t.plushies.full || t.plushies.tick || !t.pct || t.pct.full) fail(`pause tracker without the plushies: ${JSON.stringify({ plushies: t.plushies, pct: t.pct })}`);
    await closeMenus();
    await page.evaluate(() => { window.G.game.S.plushies = { woods: true, shores: true, peaks: true }; });
    // every plushie bought but no rematch won yet: the Rematches chip and the total are still not complete
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.rematches || t.rematches.text !== '0/3' || t.rematches.full || t.rematches.tick || !t.pct || t.pct.full) fail(`pause tracker without the rematches: ${JSON.stringify({ rematches: t.rematches, pct: t.pct })}`);
    await closeMenus();
    await page.evaluate(() => { window.G.game.S.rematches = { woods: true, shores: true, peaks: true }; });
    // every rematch won but no landmark keepsake found yet: the Secrets chip and the total are still not complete
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.secrets || t.secrets.text !== '0/4' || t.secrets.full || t.secrets.tick || !t.pct || t.pct.full) fail(`pause tracker without the secrets: ${JSON.stringify({ secrets: t.secrets, pct: t.pct })}`);
    await closeMenus();
    await page.evaluate(() => { window.G.game.S.secrets = { acorn: true, stone: true, bottle: true, pouch: true }; });
    await openPause();
    t = await tally('#pause .ptrack');
    if (!t.secrets || t.secrets.text !== '4/4') fail(`pause tracker secrets on a finished save: ${JSON.stringify(t.secrets)}`);
    if (!t.errands || t.errands.text !== '2/2') fail(`pause tracker errands on a finished save: ${JSON.stringify(t.errands)}`);
    if (!t.plushies || t.plushies.text !== '3/3') fail(`pause tracker plushies on a finished save: ${JSON.stringify(t.plushies)}`);
    if (!t.rematches || t.rematches.text !== '3/3') fail(`pause tracker rematches on a finished save: ${JSON.stringify(t.rematches)}`);
    for (const [k, v] of Object.entries(t)) if (!v.full || (k !== 'pct' && !v.tick)) fail(`pause tracker ${k} not marked complete: ${JSON.stringify(v)}`);
    if (!t.pct || t.pct.text !== '★ 100%') fail(`pause tracker total on a finished save: ${JSON.stringify(t.pct)}`);
    await closeMenus();
    if (problems.length) fail('errors with the completion tracker');
    step(`completion tracker on the pause menu and the map: 0/${nChests} → 1/${nChests} chests, 1/3 guardians, ${r1}/5 regions, errands 0/2 → 1/2 → 2/2, plushies 0/3 → 3/3, rematches 0/3 → 3/3, secrets 0/4 → 4/4, ✓ and ★ 100% when finished`);

    // 2. Continue a valid v2 save (one chest open, one boss beaten and its seed placed, a saved position).
    // controlsV is the controls-card version the player has seen (CONTROLS_V in js/game.js); a save without it
    // predates the first-person controls and gets the card once more, which clears controlsSeen.
    const save = await page.evaluate(() => {
      const W = window.G.world;
      let px = W.spawn.x, pz = W.spawn.z;
      for (const [dx, dz] of [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [0, 3]]) {
        if (W.walkable(W.spawn.x + dx, W.spawn.z + dz) && !W.inArena(W.spawn.x + dx, W.spawn.z + dz, 1)) { px = W.spawn.x + dx; pz = W.spawn.z + dz; break; }
      }
      return {
        v: 2, seed: W.seed, hp: 5, maxHp: 8, coins: 42, potions: 1, swordLevel: 1,
        seeds: { woods: 2, peaks: 0, shores: 0 }, chests: { [W.chests[0].id]: true }, bosses: { woods: true },
        shopHeart: false, ending: false, tod: 0.45, visited: { village: true, woods: true },
        introDone: true, controlsSeen: true, controlsV: 2, playTime: 321.5, px, pz, facing: 0.5,
      };
    });
    // ... with settings the player changed earlier, one of them from a newer build
    const chosen = { v: 1, quality: 'low', reduceMotion: true, sens: 2, invertX: true, musicVol: 0.4, someFutureSetting: 'kept' };
    await openGame(save, chosen);
    if (!(await continueVisible())) fail('Continue is hidden for a valid v2 save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await page.waitForTimeout(1000);
    const resumed = await page.evaluate(() => {
      const { S, player, bosses } = window.G.game;
      return { S, pos: { x: player.pos.x, z: player.pos.z }, liveBosses: Object.keys(bosses).sort() };
    });
    for (const k of ['seed', 'maxHp', 'coins', 'potions', 'swordLevel', 'seeds', 'chests', 'bosses', 'introDone', 'controlsSeen']) {
      if (JSON.stringify(resumed.S[k]) !== JSON.stringify(save[k])) fail(`continued save differs in ${k}: ${JSON.stringify(resumed.S[k])} vs ${JSON.stringify(save[k])}`);
    }
    if (Math.hypot(resumed.pos.x - save.px, resumed.pos.z - save.pz) > 0.5) fail(`resumed at ${JSON.stringify(resumed.pos)}, saved at ${save.px}, ${save.pz}`);
    if (resumed.liveBosses.includes('woods') || resumed.liveBosses.length !== 2) fail(`unexpected live bosses after continue: ${resumed.liveBosses}`);
    // migrated to v6 on load (MIGRATIONS[2]–[5] in js/save.js): no errand started, no rainbow shell out, no plushie, no
    // rematch won, no keepsake found (all four still in the world)
    if (resumed.S.v !== 6 || JSON.stringify(resumed.S.errands) !== '{}' || JSON.stringify(resumed.S.shells) !== '{}' || JSON.stringify(resumed.S.plushies) !== '{}' || JSON.stringify(resumed.S.rematches) !== '{}' || JSON.stringify(resumed.S.secrets) !== '{}') fail(`the v2 save was not migrated to v6: ${JSON.stringify({ v: resumed.S.v, errands: resumed.S.errands, shells: resumed.S.shells, plushies: resumed.S.plushies, rematches: resumed.S.rematches, secrets: resumed.S.secrets })}`);
    if (await page.evaluate(() => [...window.G.game.scenery.secrets.values()].filter((o) => o.shown).length) !== 4) fail('the four landmark keepsakes are not in the world after continuing a save without any found');
    if (await page.evaluate(() => [...window.G.game.scenery.plushies.values()].some((o) => o.visible))) fail('plushies on Miso\'s counter after continuing a save without any');
    if (problems.length) fail('errors after continuing a valid save');
    step('valid v2 save continued (migrated to v6) with the same chests, bosses, seeds and position');

    // 2b. The stored settings are in effect (Low: the small shadow map; motion comfort: the calm HUD), and a change
    // made now is written back next to the ones that were there, the unknown key included.
    const kept = await settingsNow();
    for (const k of ['quality', 'reduceMotion', 'sens', 'invertX', 'musicVol']) {
      if (kept.all[k] !== chosen[k]) fail(`stored setting ${k} not in effect: ${JSON.stringify(kept.all[k])} vs ${JSON.stringify(chosen[k])}`);
    }
    if (kept.shadowMap !== 1024) fail(`graphics quality Low not applied: shadow map ${kept.shadowMap}`);
    if (!kept.calm) fail('motion comfort not applied to the HUD');
    // ... and two of them do what they say: motion comfort caps a full-screen flash at 20 %, and with left / right
    // inverted a mouse move to the right turns the view to the left (yaw grows). Both are read without waiting on a frame.
    // (the look is not free until the opening fade is over, which takes a few seconds at software-WebGL frame rates)
    await waitFor('the view to take look input after Continue', () => window.G.game.view.lookAllowed === true, STEP_TIMEOUT);
    const effect = await page.evaluate(() => {
      const G = window.G, g = G.game, v = g.view;
      g.redFlash = 1; g.whiteFlash = 1;
      G.ui.frame(g, 0);
      const flash = { hurt: G.ui.vigA, white: G.ui.flA };
      g.redFlash = 0; g.whiteFlash = 0;
      const y0 = v.yaw;
      G.debug.lookDelta(40, 0);
      v.applyLook(g.input, 1 / 60);
      return { flash, turn: Math.atan2(Math.sin(v.yaw - y0), Math.cos(v.yaw - y0)), lookAllowed: v.lookAllowed };
    });
    if (!(effect.flash.hurt > 0.1 && effect.flash.hurt <= 0.2 && effect.flash.white > 0.1 && effect.flash.white <= 0.2)) fail(`motion comfort did not cap the flashes at 0.2: ${JSON.stringify(effect.flash)}`);
    if (!(effect.turn > 0.05)) fail(`inverted left / right did not turn the view the other way: ${JSON.stringify(effect)}`);
    await page.evaluate(() => { window.G.settings.set('hudScale', 1.1); window.G.settings.set('quality', 'high'); });
    // the write is debounced (250 ms), and a software-rendered frame can hold the timer up
    await waitFor('the changed settings to reach localStorage', () => {
      try { return JSON.parse(localStorage.getItem('starseed-isle-settings-v1')).hudScale === 1.1; } catch (e) { return false; }
    }, STEP_TIMEOUT);
    const changed = await settingsNow();
    const want = { ...chosen, hudScale: 1.1, quality: 'high' };
    if (JSON.stringify(Object.entries(changed.stored).sort()) !== JSON.stringify(Object.entries(want).sort())) fail(`settings not saved as expected: ${JSON.stringify(changed.stored)}`);
    if (changed.shadowMap !== 2048) fail(`graphics quality High not applied live: shadow map ${changed.shadowMap}`);
    if (problems.length) fail('errors after changing settings');
    step('stored settings applied (flash cap and inverted look included), changed live and saved');

    // 3. Continue a corrupt save: it must still start a playable session. The stored settings are wrong-typed too.
    await openGame({ ...save, chests: null, hp: 'x', bosses: [1], seeds: null, coins: -5, px: 'nope' },
      { quality: 'ultra', sens: 'fast', fovFP: 9999, invertY: 'maybe', musicVol: -3, view: 7 });
    if (!(await continueVisible())) fail('Continue is hidden for a corrupt but recoverable save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue on a corrupt save", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await page.waitForTimeout(1000);
    const fixed = await page.evaluate(() => window.G.game.S);
    if (!(Number.isFinite(fixed.hp) && fixed.hp >= 1 && fixed.coins === 0 && JSON.stringify(fixed.chests) === '{}')) fail(`corrupt save not normalized: ${JSON.stringify(fixed)}`);
    const repaired = (await settingsNow()).all;
    if (!(repaired.quality === 'auto' && repaired.sens === 1 && repaired.fovFP === 115 && repaired.invertY === false && repaired.musicVol === 0 && repaired.view === 'fp')) {
      fail(`wrong-typed settings not repaired: ${JSON.stringify(repaired)}`);
    }
    if (problems.length) fail('errors after continuing a corrupt save');
    step('corrupt save and wrong-typed settings continued without errors');

    // 4. A save from a newer version is not offered as Continue. Settings that are not JSON at all give the defaults.
    await openGame({ ...save, v: 99 }, '{not json');
    if (await continueVisible()) fail('Continue is shown for a save from a newer version');
    const fresh = (await settingsNow()).all;
    if (!(fresh.quality === 'auto' && fresh.sens === 1 && fresh.invertX === false)) fail(`unreadable settings did not give the defaults: ${JSON.stringify(fresh)}`);
    if (problems.length) fail('errors with a newer-version save');
    step('newer-version save ignored, unreadable settings replaced by the defaults');

    // 5. Rebound keys. Continue with Hop stored on T: the controls card shows T, T hops and Space no longer does.
    await openGame(save, { v: 1, keys: { jump: 'KeyT' } });
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue with rebound keys", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await waitFor('the view to take look input (play is live)', () => window.G.game.view.lookAllowed === true, STEP_TIMEOUT);
    const card = await page.evaluate(() => {
      const ui = window.G.ui;
      ui.openControls(true); ui.controlsCard.setDev('kbm');
      const rows = Object.fromEntries([...ui.controlsCard.grid.querySelectorAll('.crow')].map((r) => [r.querySelector('.k').textContent, r.querySelector('.v').textContent]));
      ui.closeMenu(true);
      return rows;
    });
    if (card.Hop !== 'T') fail(`the controls card does not show Hop on T: ${JSON.stringify(card)}`);
    // count hops (EV.JUMP) and input frames: a software-rendered frame can take a second, so a check waits for frames
    await page.evaluate(() => {
      const I = window.G.input, up = I.update.bind(I);
      window.__jumps = 0; window.__frames = 0;
      window.G.events.on('jump', () => { window.__jumps++; });
      I.update = (dt) => { up(dt); window.__frames++; };
    });
    const free = () => { const G = window.G; return G.game.playing && !G.ui.menu && !G.ui.dlg && G.game.player.grounded; };
    await waitFor('free play (no menu, no dialogue, Pip on the ground)', free, STEP_TIMEOUT);
    await page.waitForTimeout(500);                         // the 120 ms guard after a closed card, at slow frame rates
    const hops = async (key) => {
      await waitFor('free play before a hop', free, STEP_TIMEOUT);
      const [before, f0] = await page.evaluate(() => [window.__jumps, window.__frames]);
      await page.keyboard.press(key);
      await waitFor('six frames after the key press', (f) => window.__frames >= f + 6, STEP_TIMEOUT, f0);
      return (await page.evaluate(() => window.__jumps)) - before;
    };
    if ((await hops('KeyT')) < 1) fail('T (Hop rebound to T) did not hop');
    if ((await hops('Space')) !== 0) fail('Space still hops after Hop moved to T');
    if (problems.length) fail('errors with rebound keys in play');
    step('stored binding in effect: the controls card shows T, T hops, Space does not');

    // ... rebind with real key presses in Settings → Controls: keys move to the Map row, Enter waits, Esc cancels, P is
    // refused, E (Use's key) swaps Map and Use; then the bindings are saved and come back on the next load
    await page.evaluate(() => { const ui = window.G.ui; ui.openPause(); ui.onPauseChoice(1); ui.settingsCard.setTab('controls'); });
    const focused = () => page.evaluate(() => { const r = document.querySelector('#ui .srow.foc'); return r ? r.dataset.a || r.dataset.k : null; });
    for (let f = await focused(), guard = 0; f !== 'map'; f = await focused()) {
      if (++guard > 40) fail('could not reach the Map key row with the arrow keys');
      await page.keyboard.press('ArrowDown');
      await waitFor('the settings focus to move down', (w) => { const r = document.querySelector('#ui .srow.foc'); return (r ? r.dataset.a || r.dataset.k : null) !== w; }, STEP_TIMEOUT, f);
    }
    const keyRow = () => page.evaluate(() => {
      const r = document.querySelector('#ui .srow[data-a="map"]');
      return { key: r.querySelector('kbd').textContent, waiting: r.classList.contains('waiting'), note: r.querySelector('.snote').textContent, keys: window.G.settings.get('keys'), menu: window.G.ui.menu };
    });
    const waitRow = (what, fn) => waitFor(what, fn, STEP_TIMEOUT);
    await page.keyboard.press('Enter');
    await waitRow('the Map row to wait for a key', () => document.querySelector('#ui .srow[data-a="map"]').classList.contains('waiting'));
    await page.keyboard.press('Escape');
    let row = await keyRow();
    if (row.waiting || row.key !== 'M' || row.menu !== 'settings' || JSON.stringify(row.keys) !== '{"jump":"KeyT"}') fail(`Esc did not just cancel the rebind: ${JSON.stringify(row)}`);
    await page.keyboard.press('Enter');
    await waitRow('the Map row to wait for a key again', () => document.querySelector('#ui .srow[data-a="map"]').classList.contains('waiting'));
    await page.keyboard.press('KeyP');
    row = await keyRow();
    if (!row.waiting || !/stay as they are/.test(row.note) || JSON.stringify(row.keys) !== '{"jump":"KeyT"}') fail(`P (pause) was not refused: ${JSON.stringify(row)}`);
    await page.keyboard.press('KeyE');
    row = await keyRow();
    const swapped = { jump: 'KeyT', interact: 'KeyM', map: 'KeyE' };
    if (row.waiting || row.key !== 'E' || !/Swapped with Use/.test(row.note) || JSON.stringify(row.keys) !== JSON.stringify(swapped)) fail(`E did not swap Map and Use: ${JSON.stringify(row)}`);
    await waitFor('the new bindings to reach localStorage', (k) => {
      try { const v = JSON.parse(localStorage.getItem(k)).keys; return !!v && v.map === 'KeyE'; } catch (e) { return false; }
    }, STEP_TIMEOUT, SETTINGS_KEY);
    const written = (await settingsNow()).stored;
    if (JSON.stringify(written.keys) !== JSON.stringify(swapped)) fail(`rebound keys not saved: ${JSON.stringify(written)}`);
    step('rebound Map to E in Settings with real key presses (Esc cancels, P refused, Use swapped onto M) and saved');

    // the next load with what was saved: the bindings are back, E opens the map, the Controls tab's Reset restores all
    await openGame(save, written);
    if (JSON.stringify(await page.evaluate(() => window.G.settings.get('keys'))) !== JSON.stringify(swapped)) fail('rebound keys did not survive a reload');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after the reload", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await waitFor('the view to take look input after the reload', () => window.G.game.view.lookAllowed === true, STEP_TIMEOUT);
    await waitFor('free play after the reload', () => { const G = window.G; return G.game.playing && !G.ui.menu && !G.ui.dlg; }, STEP_TIMEOUT);
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyE');
    await waitFor('E (Map rebound to E) to open the map', () => window.G.ui.menu === 'map', STEP_TIMEOUT);
    await page.keyboard.press('Escape');
    await waitFor('the map to close', () => !window.G.ui.menu, STEP_TIMEOUT);
    const reset = await page.evaluate(() => {
      const ui = window.G.ui;
      ui.openPause(); ui.onPauseChoice(1); ui.settingsCard.setTab('controls'); ui.settingsCard.resetTab();
      const keys = window.G.settings.get('keys'), map = document.querySelector('#ui .srow[data-a="map"] kbd').textContent;
      ui.closeSettings(true);
      return { keys, map };
    });
    if (JSON.stringify(reset.keys) !== '{}' || reset.map !== 'M') fail(`Reset on the Controls tab did not restore the default keys: ${JSON.stringify(reset)}`);
    if (problems.length) fail('errors after rebinding');
    step('rebound keys came back after a reload, worked in play, and Reset restored the defaults');

    // no service worker from the repo: the Pages build would have registered one by 10 s after the title (js/pwa.js)
    await page.waitForTimeout(Math.max(0, 11_000 - (Date.now() - titleAt)));
    const sw = await page.evaluate(async () => ({
      regs: (await navigator.serviceWorker.getRegistrations()).length,
      controlled: !!navigator.serviceWorker.controller,
    }));
    if (sw.regs || sw.controlled || page.context().serviceWorkers().length) fail(`a service worker is registered when running from the repo: ${JSON.stringify(sw)}`);
    if (problems.length) fail('errors while checking for a service worker');
    step('no service worker registered and sw.js never requested');
  } catch (e) {
    for (const p of problems) console.error(`  - ${p}`);
    if (page) {
      await mkdir(new URL('.', SHOT), { recursive: true });
      await page.screenshot({ path: fileURLToPath(SHOT) }).catch(() => {});
      console.error(`[smoke] screenshot: ${fileURLToPath(SHOT)}`);
    }
    throw e;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.proc.kill();
  }
  step('PASS');
}

main().catch((e) => {
  console.error(`[smoke] FAIL: ${e.message}`);
  process.exit(1);
});
