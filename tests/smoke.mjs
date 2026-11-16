#!/usr/bin/env node
// Headless-browser smoke test: serve the repo, boot the game in Chromium (software WebGL via SwiftShader),
// start a New Game and fail on any page error, console error or failed request.
// Usage: node tests/smoke.mjs   (or `bun run test:smoke`). On failure a screenshot lands in test-results/.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    const fail = (msg) => { throw new Error(msg); };
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

    step(`open ${server.url}?debug=1`);
    await page.goto(`${server.url}?debug=1`, { waitUntil: 'load' });

    const ms = await waitFor('boot (G.world, loading screen gone, title shown)', () => {
      const G = window.G;
      const loading = document.getElementById('loading');
      return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
    }, BOOT_TIMEOUT);
    step(`booted to title in ${ms} ms`);

    await page.locator('#game').focus();
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
  } catch (e) {
    for (const p of problems) console.error(`  - ${p}`);
    if (page) {
      await mkdir(new URL('.', SHOT), { recursive: true });
      await page.screenshot({ path: fileURLToPath(SHOT) }).catch(() => {});
      console.error(`[smoke] screenshot: ${fileURLToPath(SHOT)}`);
    }
    throw e;
  } finally {
    await browser.close();
    server.proc.kill();
  }
  step('PASS');
}

main().catch((e) => {
  console.error(`[smoke] FAIL: ${e.message}`);
  process.exit(1);
});
