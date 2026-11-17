#!/usr/bin/env node
// Headless-browser smoke test: serve the repo, boot the game in Chromium (software WebGL via SwiftShader),
// start a New Game, change settings from the pause menu and reload, then continue a valid, a corrupt and a
// newer-version save from localStorage (with corrupt settings). Fails on any page error, console error or failed request.
// Usage: node tests/smoke.mjs   (or `bun run test:smoke`). On failure a screenshot lands in test-results/.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const SAVE_KEY = 'starseed-isle-save-v2'; // SAVE_KEY in js/data.js
const SETTINGS_KEY = 'starseed-isle-settings-v1'; // SETTINGS_KEY in js/settings.js

const root = fileURLToPath(new URL('..', import.meta.url));
const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
const STEP_TIMEOUT = 20_000;
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
    // before any page script runs, so the game boots with exactly that save. `settings` is a raw stored string.
    const openGame = async (save, settings) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      if (save !== undefined) {
        await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save)]);
      }
      if (settings !== undefined) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, settings]);
      if (page) await page.context().close();
      page = await ctx.newPage();
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
      page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
      page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
      step(`open ${server.url}?debug=1${save !== undefined ? ' with a save in localStorage' : ''}`);
      await page.goto(`${server.url}?debug=1`, { waitUntil: 'load' });
      await waitBoot();
    };
    const waitBoot = async () => {
      const ms = await waitFor('boot (G.world, loading screen gone, title shown)', () => {
        const G = window.G;
        const loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
      }, BOOT_TIMEOUT);
      step(`booted to title in ${ms} ms`);
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
    // Press a key, then wait until the game has seen it (input is sampled once per frame).
    const press = async (key, what, fn, arg) => {
      await page.keyboard.press(key);
      await waitFor(what, fn, STEP_TIMEOUT, arg);
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

    // 2. Continue a valid v2 save (one chest open, one boss beaten and its seed placed, a saved position)
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
        introDone: true, controlsSeen: true, playTime: 321.5, px, pz, facing: 0.5,
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

    // 3. Settings: pause → Settings, change values with the keyboard and the mouse, check they apply, reload
    await page.evaluate(() => {
      const a = window.G.audio, calls = (window.__vol = []);
      for (const n of ['setMusicVolume', 'setSfxVolume']) { const f = a[n]; a[n] = (v) => { calls.push([n, v]); return f(v); }; }
    });
    await waitFor('gameplay accepts input', () => window.G.game.playing, STEP_TIMEOUT);
    await press('Escape', 'pause menu', () => window.G.ui.menu === 'pause');
    await press('ArrowDown', 'pause selection 1', () => window.G.ui.pauseSel === 1);
    await press('ArrowDown', 'pause selection 2 (Settings)', () => window.G.ui.pauseSel === 2);
    await press('Enter', 'settings overlay', () => window.G.ui.menu === 'settings' && !document.getElementById('settings').classList.contains('hidden'));
    await press('ArrowLeft', 'music volume 30%', () => window.G.settings.musicVolume === 0.3);
    for (let i = 1; i <= 5; i++) await press('ArrowDown', `settings row ${i}`, (n) => window.G.ui.settingsSel === n, i);
    await press('Enter', 'reduced motion on', () => window.G.settings.reducedMotion === true);
    await page.click('#settings .srow[data-r="1"] .sb[data-d="1"]');
    await waitFor('SFX volume 80% after a click', () => window.G.settings.sfxVolume === 0.8, STEP_TIMEOUT);
    await page.click('#settings .srow[data-r="3"] .sb');
    await waitFor('invert horizontal on after a click', () => window.G.settings.invertCamX === true, STEP_TIMEOUT);
    const vol = await page.evaluate(() => window.__vol);
    if (!vol.some(([n, v]) => n === 'setMusicVolume' && v === 0.3) || !vol.some(([n, v]) => n === 'setSfxVolume' && v === 0.8)) fail(`audio setters not called: ${JSON.stringify(vol)}`);
    const applied = await page.evaluate(async () => {
      const { G } = window, C = G.cam;
      // yaw delta from one camera update with a fake input: Q held, or a mouse-drag orbit of 0.1 rad
      const yaw = (o) => {
        const y0 = C.yawTarget;
        C.update(1 / 60, G.player.pos, G.player.vel, { takeOrbit: () => o.orbit || 0, takePitch: () => 0, takeWheel: () => 0, held: (a) => a === o.held, padCam: 0 }, true);
        return C.yawTarget - y0;
      };
      const r = { qInverted: yaw({ held: 'camL' }) };
      const base = G.settings;
      G.ui.onSettingsChange({ ...base, invertCamX: false, camSensitivity: 1 });
      r.q1 = yaw({ held: 'camL' }); r.drag1 = yaw({ orbit: 0.1 });
      G.ui.onSettingsChange({ ...base, invertCamX: false, camSensitivity: 2 });
      r.q2 = yaw({ held: 'camL' }); r.drag2 = yaw({ orbit: 0.1 });
      G.ui.onSettingsChange({ ...base, invertCamX: false, camSensitivity: 0.5 });
      r.drag05 = yaw({ orbit: 0.1 });
      G.ui.onSettingsChange(base);
      C.shake(1);
      r.shake = C.shakeAmt;
      G.game.whiteFlash = 1; G.game.redFlash = 1;
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      r.flash = +document.getElementById('flash').style.opacity;
      r.vignette = +document.getElementById('vignette').style.opacity;
      r.stored = JSON.parse(localStorage.getItem('starseed-isle-settings-v1'));
      return r;
    });
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    if (!(applied.q1 > 0 && near(applied.qInverted, -applied.q1))) fail(`invert horizontal did not flip Q: ${JSON.stringify(applied)}`);
    if (!(near(applied.q2, 2 * applied.q1) && near(applied.drag2, 2 * applied.drag1) && near(applied.drag05, applied.drag1 / 2))) fail(`sensitivity did not scale the orbit delta: ${JSON.stringify(applied)}`);
    if (applied.shake !== 0) fail(`reduced motion left a camera shake of ${applied.shake}`);
    if (!(applied.flash > 0 && applied.flash <= 0.2 && applied.vignette > 0 && applied.vignette <= 0.2)) fail(`reduced motion flash opacity ${applied.flash} / ${applied.vignette} is not capped at 0.2`);
    const want = { v: 1, musicVolume: 0.3, sfxVolume: 0.8, camSensitivity: 1, invertCamX: true, invertCamY: false, reducedMotion: true };
    if (JSON.stringify(applied.stored) !== JSON.stringify(want)) fail(`stored settings ${JSON.stringify(applied.stored)}, expected ${JSON.stringify(want)}`);
    await press('Escape', 'back to the pause menu on Settings', () => window.G.ui.menu === 'pause' && window.G.ui.pauseSel === 2);
    step('settings changed by keyboard and mouse; audio, camera, shake and flash follow them');
    await page.reload({ waitUntil: 'load' });
    await waitBoot();
    const reloaded = await page.evaluate(() => ({ s: window.G.settings, scale: window.G.cam.scale, rm: window.G.cam.reducedMotion }));
    if (JSON.stringify(reloaded.s) !== JSON.stringify(want) || reloaded.scale.yaw !== -1 || !reloaded.rm) fail(`settings not restored after reload: ${JSON.stringify(reloaded)}`);
    await page.evaluate(() => window.G.game.newGame());
    await waitFor('play after New Game', () => window.G.game.state === 'play', STEP_TIMEOUT);
    const afterNew = await page.evaluate(() => [window.G.settings, JSON.parse(localStorage.getItem('starseed-isle-settings-v1'))]);
    if (afterNew.some((s) => JSON.stringify(s) !== JSON.stringify(want))) fail(`New Game changed the settings: ${JSON.stringify(afterNew)}`);
    if (problems.length) fail('errors in the settings menu');
    step('settings survived a reload and New Game');

    // 4. Continue a corrupt save, with corrupt settings: it must still start a playable session
    await openGame({ ...save, chests: null, hp: 'x', bosses: [1], seeds: null, coins: -5, px: 'nope' }, '{not json');
    if (!(await page.evaluate(() => JSON.stringify(window.G.settings) === JSON.stringify(window.G.ui.settingsDefaults)))) fail('unreadable settings did not fall back to the defaults');
    if (!(await continueVisible())) fail('Continue is hidden for a corrupt but recoverable save');
    await page.keyboard.press('Enter');
    await waitFor("G.game.state === 'play' after Continue on a corrupt save", () => window.G.game.state === 'play', STEP_TIMEOUT);
    await page.waitForTimeout(1000);
    const fixed = await page.evaluate(() => window.G.game.S);
    if (!(Number.isFinite(fixed.hp) && fixed.hp >= 1 && fixed.coins === 0 && JSON.stringify(fixed.chests) === '{}')) fail(`corrupt save not normalized: ${JSON.stringify(fixed)}`);
    if (problems.length) fail('errors after continuing a corrupt save');
    step('corrupt save continued without errors');

    // 5. A save from a newer version is not offered as Continue; garbage settings values fall back to the defaults
    await openGame({ ...save, v: 99 }, JSON.stringify({ v: 99, musicVolume: 'loud', sfxVolume: null, camSensitivity: [2], invertCamX: 1, reducedMotion: {}, extra: true }));
    if (!(await page.evaluate(() => JSON.stringify(window.G.settings) === JSON.stringify(window.G.ui.settingsDefaults)))) fail('garbage settings did not fall back to the defaults');
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
