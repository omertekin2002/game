#!/usr/bin/env node
// Headless runner for the in-page test suites (js/debug/tests.js and js/debug/tests/wp1.js … wp9.js; see README
// "Debug and in-page tests"). Serves the repo, boots the game in Chromium (software WebGL) with ?debug=1&nolock=1 and,
// for each suite named on the command line, runs `await G.debug.test.run(name)` in the page. With no names it runs
// every suite G.debug.test.list() reports as not heavy (the same set as run('all')); heavy suites (GPU timing, perf
// sweeps, minute-long statistics) run only when named. Prints one line per test and a summary; exits non-zero on any
// failing test, unknown suite, page error, console error or failed request. Tests in SKIP below are not run (they are
// reported as skipped, never as passed). On failure a screenshot and the JSON results land in test-results/.
// Usage: node tests/inpage.mjs [suite …]   (or `bun run test:inpage [suite …]`), e.g. `node tests/inpage.mjs wp3`.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH, startServer } from './lib/browser.mjs';

const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
// one suite in software WebGL on a two-core runner takes up to a few minutes; past this the page is taken as stuck
const SUITE_TIMEOUT = Number(process.env.INPAGE_SUITE_TIMEOUT || 15 * 60_000);
// nolock=1: no pointer lock (headless Chromium floods a locked page with mouse moves; see tests/smoke.mjs)
const QUERY = '?debug=1&nolock=1';
const OUT = new URL('../test-results/', import.meta.url);

/** Tests that cannot pass in headless Chromium's software WebGL: suite → { test name: reason }. Every entry is one
 *  test by its exact name with a one-line reason; no suite is skipped whole. */
export const SKIP = {
};

const T0 = Date.now();
const log = (msg) => console.log(`[inpage] ${((Date.now() - T0) / 1000).toFixed(0).padStart(4)} s  ${msg}`);

async function main() {
  const asked = process.argv.slice(2);
  const problems = [];
  const server = await startServer();
  let browser, page, failed = false;
  const report = { suites: [], pass: 0, fail: 0, skip: 0, problems };
  const tag = asked.length ? asked.join('-') : 'all';
  try {
    browser = await chromium.launch(LAUNCH);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

    log(`open ${server.url}${QUERY}`);
    await page.goto(`${server.url}${QUERY}`, { waitUntil: 'load', timeout: BOOT_TIMEOUT });
    const s0 = Date.now();
    for (;;) {
      if (problems.length) throw new Error(`errors while booting:\n  ${problems.join('\n  ')}`);
      const ready = await page.evaluate(() => {
        const G = window.G, loading = document.getElementById('loading');
        return !!(G && G.world && G.game && G.game.state === 'title' && G.debug && G.debug.test && (!loading || loading.classList.contains('gone')));
      }).catch(() => false);
      if (ready) break;
      if (Date.now() - s0 > BOOT_TIMEOUT) throw new Error(`timed out after ${BOOT_TIMEOUT} ms waiting for boot (G.debug.test ready, title shown)`);
      await new Promise((r) => setTimeout(r, 200));
    }
    log(`booted to the title in ${Date.now() - s0} ms`);

    const all = await page.evaluate(() => window.G.debug.test.list());
    const names = asked.length ? asked : all.filter((s) => !s.heavy).map((s) => s.name);
    const known = new Set(all.map((s) => s.name));
    for (const n of Object.keys(SKIP)) if (!known.has(n)) throw new Error(`SKIP names an unknown suite: ${n}`);
    log(`suites: ${names.join(', ')}`);

    for (const name of names) {
      const skip = Object.keys(SKIP[name] || {});
      const s1 = Date.now();
      log(`${name}: running${skip.length ? ` (${skip.length} skipped)` : ''}`);
      let timer;
      const res = await Promise.race([
        page.evaluate(([name, skip]) => window.G.debug.test.run(name, { skip }), [name, skip]),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name}: did not finish within ${SUITE_TIMEOUT} ms`)), SUITE_TIMEOUT); }),
      ]).finally(() => clearTimeout(timer));
      for (const r of res.results) {
        if (r.skipped) console.log(`  skip  ${name} › ${r.name}  (${SKIP[name]?.[r.name] || 'skipped'})`);
        else if (r.pass) console.log(`  pass  ${name} › ${r.name}  ${r.ms ?? ''} ms`);
        else console.log(`  FAIL  ${name} › ${r.name}  ${r.msg}${r.data && Object.keys(r.data).length ? `\n        data: ${JSON.stringify(r.data).slice(0, 600)}` : ''}`);
      }
      const skipped = res.results.filter((r) => r.skipped).length;
      const missing = skip.filter((n) => !res.results.some((r) => r.skipped && r.name === n));
      if (missing.length) { failed = true; console.log(`  FAIL  ${name} › SKIP names tests the suite does not have: ${missing.join(' | ')}`); }
      if (res.fail) failed = true;
      report.pass += res.pass; report.fail += res.fail; report.skip += skipped;
      report.suites.push(res);
      log(`${name}: ${res.pass} passed, ${res.fail} failed, ${skipped} skipped of ${res.results.length} in ${((Date.now() - s1) / 1000).toFixed(0)} s`);
    }
    if (problems.length) { failed = true; console.log(`page errors:\n  ${problems.join('\n  ')}`); }
  } catch (e) {
    failed = true;
    console.error(`[inpage] ${e.message}`);
  } finally {
    const total = report.pass + report.fail + report.skip;
    log(`total: ${report.pass} passed, ${report.fail} failed, ${report.skip} skipped of ${total}${problems.length ? `; ${problems.length} page error(s)` : ''}`);
    if (failed) {
      await mkdir(OUT, { recursive: true });
      await writeFile(fileURLToPath(new URL(`inpage-${tag}.json`, OUT)), JSON.stringify(report, null, 1));
      if (page) await page.screenshot({ path: fileURLToPath(new URL(`inpage-${tag}.png`, OUT)) }).catch(() => {});
      console.log(`[inpage] results and a screenshot in test-results/inpage-${tag}.*`);
    }
    if (browser) await browser.close();
    server.proc.kill();
  }
  process.exit(failed ? 1 : 0);
}

main();
