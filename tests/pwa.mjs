#!/usr/bin/env node
// Headless-browser test of the installable, offline-playable Pages build (manifest.webmanifest + the generated sw.js).
// Builds the site into test-results/pwa-site/ with tools/build-pages.mjs and serves it under /game/ (as GitHub Pages
// does) from a small static server that records every request and can go down. Then, in Chromium:
//  1. an online visit to /game/: the service worker installs and controls the page; the manifest is valid, its icons
//     load and Chromium reports no installability errors;
//  2. offline (context offline and the server down): /game/?nolock=1 and /game/?seed=7&nolock=1 boot to the title and
//     New Game starts a session (query strings are ignored by the cache);
//  3. an update: one file changes and the site is re-finished; the next load installs the new version, downloading only
//     the changed file, the old version's cache is deleted, the page that was open keeps working, and the load after
//     serves the new file;
//  4. ?nosw=1: a fresh visit registers nothing and never requests sw.js; on a page the worker controls it removes the
//     worker and its caches.
// Fails on any page error, console error, failed same-origin request or HTTP error.
// Usage: node tests/pwa.mjs   (or `bun run test:pwa`). On failure a screenshot lands in test-results/.
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildPages, SW_FILE } from '../tools/build-pages.mjs';

const OUT_REL = 'test-results/pwa-site';
const OUT = fileURLToPath(new URL(`../${OUT_REL}/`, import.meta.url));
const BASE = '/game/';
const PREFIX = 'starseed-isle-';   // PREFIX in tools/sw-template.js
const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
const STEP_TIMEOUT = 60_000;
const SW_TIMEOUT = 120_000;        // the title, then the deferred textures (≤ 10 s), then precaching ~25 MB from localhost
const SHOT = new URL('../test-results/pwa-failure.png', import.meta.url);
const step = (msg) => console.log(`[pwa] ${msg}`);
const fail = (msg) => { throw new Error(msg); };

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.txt': 'text/plain',
};

// The built site under /game/ (anything else 404s), with the headers GitHub Pages would not change the outcome of.
class Site {
  constructor(dir) { this.dir = dir; this.requests = []; this.server = null; this.port = 0; }
  async start(port = 0) {
    this.server = createServer(async (req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      this.requests.push(path);
      try {
        if (!path.startsWith(BASE)) throw new Error('outside the base');
        const rel = path.slice(BASE.length) || 'index.html';
        const file = normalize(join(this.dir, rel.endsWith('/') ? rel + 'index.html' : rel));
        if (!file.startsWith(this.dir)) throw new Error('outside the site');
        if (!(await stat(file)).isFile()) throw new Error('not a file');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
        res.end(body);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      }
    });
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(port, '127.0.0.1', resolve); });
    this.port = this.server.address().port;
    return `http://127.0.0.1:${this.port}${BASE}`;
  }
  async stop() {
    if (!this.server) return;
    const s = this.server;
    this.server = null;
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
}

async function build(copy) {
  const r = await buildPages(OUT_REL, { copy });
  if (r.errors.length) fail(`build-pages failed:\n  - ${r.errors.join('\n  - ')}`);
  return r;
}

async function main() {
  const v1 = await build(true);
  step(`built ${OUT_REL}/: ${v1.files} files, sw.js version ${v1.version}, precache ${(v1.precacheBytes / 1048576).toFixed(1)} MiB`);
  const site = new Site(OUT);
  const url = await site.start();
  const origin = new URL(url).origin;
  const problems = [];
  let browser, page;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    const watch = (p) => {
      p.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
      p.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
      p.on('requestfailed', (r) => { if (r.url().startsWith(origin)) problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`); });
      p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(origin)) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    };
    const newPage = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const p = await ctx.newPage();
      watch(p);
      return p;
    };
    const waitFor = async (what, fn, timeout, arg) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (problems.length) fail(`errors while waiting for ${what}`);
        if (await page.evaluate(fn, arg).catch(() => false)) return Date.now() - t0;
        await new Promise((r) => setTimeout(r, 250));
      }
      fail(`timed out after ${timeout} ms waiting for ${what}`);
    };
    const open = async (path) => {
      step(`open ${path}`);
      await page.goto(origin + path, { waitUntil: 'load' });
      const ms = await waitFor(`boot to the title (${path})`, () => {
        const G = window.G, loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
      }, BOOT_TIMEOUT);
      step(`booted to the title in ${ms} ms`);
    };
    const newGame = async () => {
      await page.locator('#game').focus();
      await page.keyboard.press('Enter');
      await waitFor("G.game.state === 'play' after New Game", () => window.G.game.state === 'play', STEP_TIMEOUT);
      await page.waitForTimeout(1000);   // a second of play so per-frame errors surface
      if (problems.length) fail('errors during play');
    };
    const ourCaches = () => page.evaluate(async (pre) => (await caches.keys()).filter((k) => k.startsWith(pre)), PREFIX);
    const cacheReady = (version) => waitFor(`the service worker to control the page with cache ${version}`, async ([pre, v]) => {
      const c = navigator.serviceWorker.controller;
      return !!c && /\/sw\.js$/.test(c.scriptURL) && (await caches.keys()).filter((k) => k.startsWith(pre)).join() === pre + v;
    }, SW_TIMEOUT, [PREFIX, version]);

    // 1. online visit: install, control, manifest, installability
    page = await newPage();
    await open(BASE);
    const ms = await cacheReady(v1.version);
    const cached = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).length, PREFIX + v1.version);
    if (cached !== v1.files) fail(`the cache holds ${cached} entries, expected ${v1.files} (${v1.files - 1} site files + the index)`);
    step(`service worker controls the page, ${cached - 1} files precached (${ms} ms after the title)`);
    const man = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]');
      const res = await fetch(link.href);
      const m = await res.json();
      const icons = await Promise.all(m.icons.map((i) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ...i, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ ...i, w: 0, h: 0 });
        img.src = new URL(i.src, link.href).href;
      })));
      return { href: link.href, type: res.headers.get('content-type'), m, icons };
    });
    const M = man.m;
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) if (!M[k]) fail(`manifest lacks ${k}`);
    if (M.name !== 'Starseed Isle' || M.start_url !== './' || M.scope !== './') fail(`manifest name / start_url / scope: ${JSON.stringify(M)}`);
    for (const i of man.icons) {
      const [w, h] = i.sizes.split('x').map(Number);
      if (i.w !== w || i.h !== h) fail(`icon ${i.src} is ${i.w}×${i.h}, the manifest says ${i.sizes}`);
      if (/^\/|^[a-z]+:/i.test(i.src)) fail(`icon ${i.src} is not relative`);
    }
    if (!man.icons.some((i) => i.sizes === '192x192') || !man.icons.some((i) => i.sizes === '512x512')) fail('manifest lacks a 192 or a 512 icon');
    if (!man.icons.some((i) => (i.purpose || '').includes('maskable'))) fail('manifest lacks a maskable icon');
    const cdp = await page.context().newCDPSession(page);
    const app = await cdp.send('Page.getAppManifest');
    if (app.errors && app.errors.length) fail(`Chromium could not parse the manifest: ${JSON.stringify(app.errors)}`);
    // Chromium's installability check: no errors other than the ones a test browser always reports for itself
    const inst = await cdp.send('Page.getInstallabilityErrors');
    const instErrors = (inst.installabilityErrors || []).map((e) => e.errorId).filter((id) => !['in-incognito'].includes(id));
    if (instErrors.length) fail(`Chromium reports installability errors: ${JSON.stringify(inst.installabilityErrors)}`);
    step(`manifest ${man.href} (${man.type}) valid, ${man.icons.length} icons load at their sizes, installable (${JSON.stringify(inst.installabilityErrors || [])})`);

    // 2. offline: context offline and the server down
    await page.context().setOffline(true);
    await site.stop();
    await open(`${BASE}?nolock=1`);
    await newGame();
    step('offline: /game/ booted to the title and New Game started');
    await open(`${BASE}?seed=7&nolock=1`);
    if (await page.evaluate(() => window.G.world.seed) !== 7) fail('?seed=7 did not generate island 7 offline');
    await newGame();
    step('offline: /game/?seed=7 booted to the title and New Game started');

    // 3. update: one changed file; the next load installs the new version, the one after serves it
    const mark = `/* pwa-test update ${Date.now()} */`;
    await appendFile(join(OUT, 'styles.css'), `\n${mark}\n`);
    const v2 = await build(false);
    if (v2.version === v1.version) fail('changing styles.css did not change the service worker version');
    step(`rebuilt with a changed styles.css: version ${v2.version}`);
    await site.start(site.port);
    await page.context().setOffline(false);
    site.requests = [];
    await open(`${BASE}?nolock=1`);   // load 1: still the old version's files; the browser finds the new sw.js
    await cacheReady(v2.version);
    const fetched = [...new Set(site.requests)].sort();
    const expected = [BASE + 'styles.css', BASE + SW_FILE].sort();
    if (JSON.stringify(fetched) !== JSON.stringify(expected)) fail(`the update downloaded ${JSON.stringify(fetched)}, expected only ${JSON.stringify(expected)}`);
    step(`new version active and the old cache deleted; the update downloaded only ${fetched.join(', ')}`);
    // the page that was open when the new version took over keeps working
    const ok = await page.evaluate(async () => (await fetch('assets/ui/icon.png')).ok);
    if (!ok) fail('the open page could not fetch a file after the update');
    await newGame();
    step('the page open during the update still starts a New Game');
    await page.reload({ waitUntil: 'load' });   // load 2: the new file
    const css = await page.evaluate(() => fetch('styles.css').then((r) => r.text()));
    if (!css.includes(mark)) fail('the load after the update still serves the old styles.css');
    const sheet = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=stylesheet]');
      return (await caches.match(link.href)) ? 'cached' : 'missing';
    });
    if (sheet !== 'cached') fail('styles.css is not in the new cache');
    if ((await ourCaches()).join() !== PREFIX + v2.version) fail(`caches after the update: ${JSON.stringify(await ourCaches())}`);
    step('the next load serves the new styles.css from the new cache');

    // 4a. ?nosw=1 on a page the worker controls: the worker and its caches go
    await page.goto(`${origin}${BASE}?nosw=1&nolock=1`, { waitUntil: 'load' });
    await waitFor('?nosw=1 to remove the service worker and its caches', async (pre) =>
      (await navigator.serviceWorker.getRegistrations()).length === 0 && !(await caches.keys()).some((k) => k.startsWith(pre)), STEP_TIMEOUT, PREFIX);
    step('?nosw=1 removed the service worker and its caches');
    await page.context().close();

    // 4b. ?nosw=1 on a fresh visit: no registration, no request for sw.js (registration would come ≤ 10 s after the title)
    page = await newPage();
    site.requests = [];
    await open(`${BASE}?nosw=1&nolock=1`);
    await page.waitForTimeout(12_000);
    const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    if (regs || site.requests.includes(BASE + SW_FILE)) fail(`?nosw=1 registered a service worker (${regs}) or requested sw.js`);
    if (problems.length) fail('errors with ?nosw=1');
    step('?nosw=1 on a fresh visit registered nothing and never requested sw.js');
  } catch (e) {
    for (const p of problems) console.error(`  - ${p}`);
    if (page) {
      await mkdir(new URL('.', SHOT), { recursive: true });
      await page.screenshot({ path: fileURLToPath(SHOT) }).catch(() => {});
      console.error(`[pwa] screenshot: ${fileURLToPath(SHOT)}`);
    }
    throw e;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await site.stop();
  }
  step('PASS');
}

main().catch((e) => {
  console.error(`[pwa] FAIL: ${e.message}`);
  process.exit(1);
});
