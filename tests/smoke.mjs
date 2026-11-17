#!/usr/bin/env node
// Headless-browser smoke test: serve the repo, boot the game in Chromium (software WebGL via SwiftShader),
// start a New Game, then continue a valid, a corrupt and a newer-version save from localStorage. Fails on any
// page error, console error or failed request.
// Usage: node tests/smoke.mjs   (or `bun run test:smoke`). On failure a screenshot lands in test-results/.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const SAVE_KEY = 'starseed-isle-save-v2'; // SAVE_KEY in js/data.js

const root = fileURLToPath(new URL('..', import.meta.url));
const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
// Starting a session compiles every shader on its first frame; in software WebGL on a two-core runner that frame
// alone takes around 10 s.
const STEP_TIMEOUT = 60_000;
// nolock=1: the game looks by mouse drag instead of capturing the pointer. Headless Chromium keeps feeding mouse
// moves to a page that holds the pointer lock; at software-WebGL frame rates the page cannot drain them and the
// browser process grows by about 100 MB a second until the runner is out of memory.
const QUERY = '?debug=1&nolock=1';
const SHOT = new URL('../test-results/smoke-failure.png', import.meta.url);

const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.unref();
  srv.on('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

async function startServer() {
  const port = await freePort();
  const proc = spawn(process.execPath, ['tools/serve.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    reject = ((r) => (e) => { proc.kill(); r(e); })(reject);
    const timer = setTimeout(() => reject(new Error('static server did not start within 10 s')), 10_000);
    proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`static server exited early (code ${code})`)); });
    proc.stdout.on('data', (d) => { if (String(d).includes('http://')) { clearTimeout(timer); resolve(); } });
  });
  return { proc, url: `http://127.0.0.1:${port}/` };
}

const step = (msg) => console.log(`[smoke] ${msg}`);

async function main() {
  const problems = [];
  const server = await startServer();
  let browser, page;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const fail = (msg) => { throw new Error(msg); };
    // Open the game in a fresh context (its own localStorage). `save`, if given, is written to localStorage
    // before any page script runs, so the game boots with exactly that save.
    const openGame = async (save) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      if (save !== undefined) {
        await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save)]);
      }
      if (page) await page.context().close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
      page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
      page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
      step(`open ${server.url}${QUERY}${save !== undefined ? ' with a save in localStorage' : ''}`);
      await page.goto(`${server.url}${QUERY}`, { waitUntil: 'load' });
      const ms = await waitFor('boot (G.world, loading screen gone, title shown)', () => {
        const G = window.G;
        const loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
      }, BOOT_TIMEOUT);
      step(`booted to title in ${ms} ms`);
      await page.locator('#game').focus();
    };
    // Errors are recorded asynchronously; poll them alongside each wait so a broken boot fails fast.
    const waitFor = async (what, fn, timeout) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (problems.length) fail(`errors while waiting for ${what}`);
        if (await page.evaluate(fn).catch(() => false)) return Date.now() - t0;
        await new Promise((r) => setTimeout(r, 200));
      }
      fail(`timed out after ${timeout} ms waiting for ${what}`);
    };
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
    await openGame(save);
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
    if (problems.length) fail('errors after continuing a valid save');
    step('valid v2 save continued with the same chests, bosses, seeds and position');

    // 3. Continue a corrupt save: it must still start a playable session
    await openGame({ ...save, chests: null, hp: 'x', bosses: [1], seeds: null, coins: -5, px: 'nope' });
    if (!(await continueVisible())) fail('Continue is hidden for a corrupt but recoverable save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue on a corrupt save", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await page.waitForTimeout(1000);
    const fixed = await page.evaluate(() => window.G.game.S);
    if (!(Number.isFinite(fixed.hp) && fixed.hp >= 1 && fixed.coins === 0 && JSON.stringify(fixed.chests) === '{}')) fail(`corrupt save not normalized: ${JSON.stringify(fixed)}`);
    if (problems.length) fail('errors after continuing a corrupt save');
    step('corrupt save continued without errors');

    // 4. A save from a newer version is not offered as Continue
    await openGame({ ...save, v: 99 });
    if (await continueVisible()) fail('Continue is shown for a save from a newer version');
    if (problems.length) fail('errors with a newer-version save');
    step('newer-version save ignored');
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
