#!/usr/bin/env node
// Headless-browser opening test: what a new player does first, driven by real input events only (key presses, mouse
// buttons and drags, touch taps and drags; never G.debug.press / move / look). From a clean localStorage, in two
// layouts, each booted once:
//  - desktop 1280×720, keyboard and mouse: Enter on the title starts a New Game; E reads Elder Shellby's intro through
//    (each page shown whole, then the next); then the coach marks: a right-button drag turns the view (?nolock=1, so the
//    mouse looks by drag), holding W walks Pip, a left click swings. The coach finishes and marks the save
//    (S.controlsSeen), so the first-run controls are done.
//  - portrait phone 390×844 (hasTouch, isMobile): a tap on New Adventure; taps read the intro through; a swipe turns the
//    view, the floating stick walks Pip, the Swing button swings. The objective line under the compass never leaves the
//    distance unit ("m") on a line of its own, at the distance on screen and at a few others.
// Both: the intro has at most 3 pages and every page fits its box, S.introDone is set, and no page error, console error
// or failed request. The simulation is stepped through the real frame loop (game.runFrame with the manual clock), as in
// tests/playthrough.mjs: the input events are real, only the clock is the test's.
// Usage: node tests/opening.mjs   (or `bun run test:opening`). Screenshots land in test-results/ (opening-*.png).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH, SAVE_KEY, startServer } from './lib/browser.mjs';

const BOOT_TIMEOUT = Number(process.env.SMOKE_BOOT_TIMEOUT || 120_000);
const STEP_TIMEOUT = 60_000;
// nolock=1: no pointer lock, the mouse looks by drag (headless Chromium floods a locked page with mouse moves; see
// tests/smoke.mjs)
const QUERY = '?debug=1&nolock=1';
const OUT = new URL('../test-results/', import.meta.url);
const STEP = 1 / 60;                    // one frame = one fixed step (STEP in js/clock.js)
const MAX_PAGES = 3;                    // Shellby's intro (js/data.js NPCS[0].intro)

const T0 = Date.now();
const step = (msg) => console.log(`[opening] ${((Date.now() - T0) / 1000).toFixed(0).padStart(4)} s  ${msg}`);
const fail = (msg) => { throw new Error(msg); };

const LAYOUTS = [
  { id: 'desktop', ctx: { viewport: { width: 1280, height: 720 } } },
  { id: 'portrait', ctx: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
];

async function run(browser, server, L) {
  const problems = [];
  const ctx = await browser.newContext(L.ctx);
  const page = await ctx.newPage();
  const touch = !!L.ctx.hasTouch;
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.stack || e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  const say = (msg) => step(`${L.id}: ${msg}`);
  const check = (what) => { if (problems.length) fail(`${L.id}: errors ${what}:\n  ${problems.join('\n  ')}`); };
  try {
    const waitFor = async (what, fn, timeout = STEP_TIMEOUT, arg) => {
      const s = Date.now();
      while (Date.now() - s < timeout) {
        check(`while waiting for ${what}`);
        if (await page.evaluate(fn, arg).catch(() => false)) return Date.now() - s;
        await new Promise((r) => setTimeout(r, 200));
      }
      fail(`${L.id}: timed out after ${timeout} ms waiting for ${what}`);
    };
    // k frames through the real loop (only the last one drawn), then wait for the GPU (see tests/playthrough.mjs)
    const frames = (k) => page.evaluate(([k, STEP]) => {
      const g = window.G.game;
      for (let i = 0; i < k; i++) g.runFrame(STEP, true, i === k - 1);
      window.__gpuSync();
    }, [k, STEP]);
    // frames until cond (the body of a function of (G, game, S)) holds, at most maxSec of game time → frames run
    const framesUntil = async (what, cond, maxSec) => {
      const max = Math.ceil(maxSec * 60);
      let n = 0;
      while (n < max) {
        check(`while waiting for ${what}`);
        const r = await page.evaluate(([cond, chunk, STEP]) => {
          const G = window.G, game = G.game, ok = new Function('G', 'game', 'S', `return !!(${cond});`);
          for (let i = 0; i < chunk; i++) {
            const draw = i === chunk - 1;
            game.runFrame(STEP, true, draw);
            if (draw) window.__gpuSync();
            if (ok(G, game, game.S)) return { done: true, n: i + 1 };
          }
          return { done: false, n: chunk };
        }, [cond, Math.min(60, max - n), STEP]);
        n += r.n;
        if (r.done) return n;
      }
      fail(`${L.id}: ${what}: not within ${maxSec} s of game time`);
    };
    const pose = () => page.evaluate(() => {
      const g = window.G.game, p = g.player.pos;
      return { yaw: g.view.yaw, pitch: g.view.pitch, x: p.x, z: p.z, swings: window.__swings, pState: g.player.state, playing: g.playing, coach: g.ui.coach.step };
    });
    const centre = async (sel) => {
      const b = await page.locator(sel).first().boundingBox();
      if (!b) fail(`${L.id}: ${sel} is not on screen`);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    // a touch drag through CDP (Playwright's touchscreen only taps): down, `n` moves to (x + dx, y + dy) with a frame after
    // each (a finger's swipe spans frames), optional frames while held, up. Chromium turns these into touch and pointer
    // events like a real finger.
    const cdp = touch ? await ctx.newCDPSession(page) : null;
    const touchDrag = async (x, y, dx, dy, { n = 8, hold = 0 } = {}) => {
      const pt = (f) => [{ x: x + dx * f, y: y + dy * f, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0) });
      for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(i / n) }); await frames(1); }
      if (hold) await frames(hold);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };

    // ---- boot, New Game from the title with real input
    say(`open ${server.url}${QUERY} at ${L.ctx.viewport.width}×${L.ctx.viewport.height}${touch ? ' (touch)' : ''}`);
    await page.goto(`${server.url}${QUERY}`, { waitUntil: 'load', timeout: BOOT_TIMEOUT });
    const ms = await waitFor('boot to the title', () => {
      const G = window.G, loading = document.getElementById('loading');
      return !!(G && G.world && G.game && G.game.state === 'title' && (!loading || loading.classList.contains('gone')));
    }, BOOT_TIMEOUT);
    say(`booted to the title in ${ms} ms`);
    if (await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY) !== null) fail(`${L.id}: localStorage already holds a save`);
    if (touch) await page.tap('#title [data-a="new"]');
    else { await page.locator('#game').focus(); await page.keyboard.press('Enter'); }
    await waitFor("G.game.state === 'play' after New Game", () => window.G.game.state === 'play');
    // from here every frame is the test's (manual clock, no redraws); a swing counter on the game's own event
    await page.evaluate(() => {
      const G = window.G, px = new Uint8Array(4);
      window.__gpuSync = () => { const gl = G.game.renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      window.__swings = 0;
      G.game.events.on('swing', () => { window.__swings++; });
      G.debug.clock({ manual: true, redraw: false });
    });
    await framesUntil("Shellby's intro dialogue", 'G.ui.dlg && !game.trans', 10);
    say('new game started; Shellby speaks');

    // ---- the intro, page by page, with the confirm key / taps
    const dlg = () => page.evaluate(() => {
      const ui = window.G.ui, d = ui.dlg;
      if (!d) return null;
      const box = ui.dlgEl, text = box.querySelector('.text');
      return { i: d.i, n: d.lines.length, full: d.chars >= d.len, fits: box.scrollHeight <= box.clientHeight + 1 && text.scrollHeight <= text.clientHeight + 1, h: box.clientHeight };
    });
    const tapAt = touch ? { x: L.ctx.viewport.width / 2, y: Math.round(L.ctx.viewport.height * 0.35) } : null;
    const confirm = async () => { if (touch) await page.touchscreen.tap(tapAt.x, tapAt.y); else await page.keyboard.press('KeyE'); };
    let d = await dlg(), presses = 0;
    const pages = d.n, seen = new Set();
    if (pages > MAX_PAGES) fail(`${L.id}: Shellby's intro has ${pages} pages, at most ${MAX_PAGES} wanted`);
    while (d) {
      if (d.full && !seen.has(d.i)) {
        seen.add(d.i);
        if (!d.fits) fail(`${L.id}: intro page ${d.i + 1} overflows its box: ${JSON.stringify(d)}`);
        if (L.id === 'portrait' && d.i === 0) await page.screenshot({ path: fileURLToPath(new URL('opening-portrait-intro.png', OUT)) });
      }
      if (++presses > pages * 3 + 4) fail(`${L.id}: the intro did not end after ${presses} presses`);
      await confirm();
      await frames(10);
      d = await dlg();
    }
    check('during the intro');
    if (seen.size !== pages) fail(`${L.id}: saw ${seen.size} of ${pages} intro pages shown whole`);
    let s = await page.evaluate(() => ({ introDone: window.G.game.S.introDone, playing: window.G.game.playing, coach: window.G.ui.coach.step }));
    if (!s.introDone || !s.playing) fail(`${L.id}: not in free play with the intro done after the intro: ${JSON.stringify(s)}`);
    if (s.coach !== 0) fail(`${L.id}: the first-run controls (coach marks) did not start: step ${s.coach}`);
    say(`intro read through: ${pages} pages, ${presses} ${touch ? 'taps' : 'E presses'}`);

    // ---- look, once the camera has left the talk framing (the coach counts only the player's own look, never a
    // scripted shot easing out; a player reads the coach pill first)
    await framesUntil('the camera to leave the talk framing', 'G.view.shotW < 0.01', 3);
    const p0 = await pose();
    if (touch) {
      // a swipe on the open sky / world above the controls (the look zone is the canvas outside the stick and buttons)
      await touchDrag(330, 300, -260, 0, { n: 10 });
    } else {
      await page.mouse.move(640, 300);
      await page.mouse.down({ button: 'right' });
      for (let i = 1; i <= 10; i++) await page.mouse.move(640 - i * 40, 300);
      await page.mouse.up({ button: 'right' });
    }
    await frames(30);
    const p1 = await pose();
    const turned = Math.abs(Math.atan2(Math.sin(p1.yaw - p0.yaw), Math.cos(p1.yaw - p0.yaw))) * 57.2958;
    if (!(turned > 20)) fail(`${L.id}: the ${touch ? 'swipe' : 'mouse drag'} did not turn the view: ${turned.toFixed(1)}° (${JSON.stringify([p0, p1])})`);
    say(`${touch ? 'swipe' : 'right-button drag'} turned the view ${turned.toFixed(0)}°`);

    // ---- move (about 2 s: the coach's walk step wants 4 m)
    if (touch) {
      const z = await page.evaluate(() => { const r = document.querySelector('#touch .mzone').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await touchDrag(z.x, z.y, 0, -70, { n: 6, hold: 120 });
    } else {
      await page.keyboard.down('KeyW');
      await frames(120);
      await page.keyboard.up('KeyW');
    }
    await frames(10);
    const p2 = await pose();
    const walked = Math.hypot(p2.x - p1.x, p2.z - p1.z);
    if (!(walked > 2)) fail(`${L.id}: ${touch ? 'the stick' : 'holding W'} did not move Pip: ${walked.toFixed(2)} m (${JSON.stringify([p1, p2])})`);
    say(`${touch ? 'the floating stick' : 'holding W'} walked Pip ${walked.toFixed(1)} m`);

    // ---- swing
    if (touch) { const c = await centre('#touch .tb.atk'); await page.touchscreen.tap(c.x, c.y); } else await page.mouse.click(640, 360);
    const sw = await framesUntil('a swing to start', "window.__swings > 0 && game.player.state === 'attack'", 1);
    say(`${touch ? 'the Swing button' : 'a left click'} started a swing (${sw} frames)`);

    // ---- the first-run controls are done (the coach marks finish and mark the save)
    await framesUntil('the coach marks to finish', 'S.controlsSeen === true', 3).catch(async (e) => {
      const c = await page.evaluate(() => { const c = window.G.ui.coach; return { step: c.step, did: c.did, shown: c.shownKey }; });
      fail(`${e.message} (coach ${JSON.stringify(c)})`);
    });
    await frames(30);
    s = await page.evaluate((k) => {
      const S = window.G.game.S, saved = JSON.parse(localStorage.getItem(k) || 'null');
      return { introDone: S.introDone, controlsSeen: S.controlsSeen, saved: saved && { introDone: saved.introDone, controlsSeen: saved.controlsSeen } };
    }, SAVE_KEY);
    if (!s.introDone || !s.controlsSeen || !s.saved || !s.saved.introDone || !s.saved.controlsSeen) fail(`${L.id}: the opening is not recorded as done: ${JSON.stringify(s)}`);

    // ---- portrait: the objective line keeps its distance whole (no lone "m" on a line of its own)
    if (L.id === 'portrait') {
      const ob = await page.evaluate(() => {
        const ui = window.G.ui, g = window.G.game, el = ui.objText;
        // the text's lines (by each character's box) and its height in lines
        const lines = () => {
          const tn = el.firstChild, rows = [];
          if (!tn || tn.nodeType !== 3) return { rows, n: 0 };
          const r = document.createRange();
          for (let i = 0; i < tn.length; i++) {
            r.setStart(tn, i); r.setEnd(tn, i + 1);
            const b = r.getClientRects()[0];
            if (!b || !b.width) continue;
            const row = rows.find((x) => Math.abs(x.top - b.top) < 4);
            if (row) row.s += tn.data[i]; else rows.push({ top: b.top, s: tn.data[i] });
          }
          return { rows: rows.map((x) => x.s), n: rows.length };
        };
        const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.25;
        const now = { text: el.textContent, ...lines(), h: el.getBoundingClientRect().height, lh, shown: getComputedStyle(el).display !== 'none' && !document.getElementById('objline').classList.contains('infight') };
        // the same line at other distances, through the game's own updateObjective (the objective moved, then restored)
        const o = ui.obj, p = g.player.pos, others = [];
        if (o) {
          for (const dm of [7, 42, 117, 238, 999]) {
            ui.obj = { ...o, x: p.x + dm, z: p.z };
            ui.updateObjective(g);
            others.push({ dm, text: el.textContent, ...lines(), h: el.getBoundingClientRect().height });
          }
          ui.obj = o; ui.updateObjective(g);
        }
        return { now, others };
      });
      // a line that is only the unit, a number whose unit wrapped onto the next line, or more than two lines
      const bad = (l) => l.n > 2 || l.rows.some((r, i) => /^\s*m\s*$/.test(r) || (/\d\s*$/.test(r) && /^\s*m\b/.test(l.rows[i + 1] || '')));
      if (!ob.now.shown || !ob.now.text) fail(`portrait: the objective line is not shown: ${JSON.stringify(ob.now)}`);
      for (const l of [ob.now, ...ob.others]) if (bad(l)) fail(`portrait: the objective line breaks its distance or runs past two lines: ${JSON.stringify(l)}`);
      say(`objective line ${JSON.stringify(ob.now.rows)} (${ob.now.n} line${ob.now.n > 1 ? 's' : ''}); ${ob.others.length} other distances keep "N m" whole`);
    }
    await frames(1);
    await page.screenshot({ path: fileURLToPath(new URL(`opening-${L.id}.png`, OUT)) });
    check('during the opening');
    say('opening passed (zero errors)');
  } catch (e) {
    try { await page.screenshot({ path: fileURLToPath(new URL(`opening-${L.id}-failure.png`, OUT)) }); } catch (_) { /* ignore */ }
    if (problems.length) console.error(`[opening] ${L.id} problems:\n  ${problems.join('\n  ')}`);
    throw e;
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch(LAUNCH);
    for (const L of LAYOUTS) await run(browser, server, L);
    step('PASS');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.proc.kill();
  }
}

main().catch((e) => { console.error(`[opening] FAIL: ${e.message}`); process.exit(1); });
