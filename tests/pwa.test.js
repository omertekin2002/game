// The offline / installable build: when the page registers the service worker (js/pwa.js) and what
// tools/build-pages.mjs refuses to ship (checkPwa: the web manifest and the precache list). Run with `bun test`.
// The browser side (install, offline play, updates) is tests/pwa.mjs.
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SW_CACHE_PREFIX, registerServiceWorker, swPlan } from '../js/pwa.js';
import { SW_MARKER, checkPwa } from '../tools/build-pages.mjs';

describe('swPlan', () => {
  test('the build marker registers, nothing else does', () => {
    expect(swPlan({ marker: 'sw.js', search: '' })).toBe('register');
    expect(swPlan({ marker: 'sw.js', search: '?debug=1&seed=7' })).toBe('register');
    expect(swPlan({ marker: null, search: '' })).toBe('none');
    expect(swPlan({ marker: null, search: '?debug=1' })).toBe('none');
  });
  test('?nosw=1 removes, wherever it is in the query', () => {
    expect(swPlan({ marker: 'sw.js', search: '?nosw=1' })).toBe('remove');
    expect(swPlan({ marker: 'sw.js', search: '?debug=1&nosw=1&seed=3' })).toBe('remove');
    expect(swPlan({ marker: 'sw.js', search: '?nosw=10' })).toBe('register');
    expect(swPlan({ marker: 'sw.js', search: '?nosw=0' })).toBe('register');
  });
  test('a page served by a service worker without the marker removes it; no API, nothing', () => {
    expect(swPlan({ marker: null, controlled: true })).toBe('remove');
    expect(swPlan({ marker: 'sw.js', supported: false })).toBe('none');
    expect(swPlan({ marker: null, search: '?nosw=1', supported: false })).toBe('none');
  });
});

// a stand-in for document / location / navigator / caches
function fakes({ marker = null, search = '', controller = null, registerFails = false } = {}) {
  const calls = [];
  const regs = [
    { scope: 'https://x.test/game/', unregister: async () => calls.push(['unregister', 'https://x.test/game/']) },
    { scope: 'https://x.test/other/', unregister: async () => calls.push(['unregister', 'https://x.test/other/']) },
  ];
  const doc = { querySelector: (q) => (q === 'meta[name="starseed-sw"]' && marker ? { content: marker } : null) };
  const loc = { href: `https://x.test/game/${search}`, search };
  const nav = {
    serviceWorker: {
      controller,
      register: async (url, opts) => { calls.push(['register', url, opts]); if (registerFails) throw new Error('nope'); },
      getRegistrations: async () => { calls.push(['getRegistrations']); return regs; },
    },
  };
  const caches = {
    keys: async () => [SW_CACHE_PREFIX + 'aaa', SW_CACHE_PREFIX + 'bbb', 'someone-elses-cache'],
    delete: async (k) => { calls.push(['delete', k]); return true; },
  };
  return { doc, loc, nav, caches, calls };
}

describe('registerServiceWorker', () => {
  const realCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  afterAll(() => {
    if (realCaches) Object.defineProperty(globalThis, 'caches', realCaches);
    else delete globalThis.caches;
  });

  test('without the marker (running from the repo) it touches nothing', async () => {
    const f = fakes();
    expect(await registerServiceWorker(Promise.resolve(), f.doc, f.loc, f.nav)).toBe('none');
    expect(f.calls).toEqual([]);
  });

  test('with the marker it registers sw.js, only once `ready` settles', async () => {
    const f = fakes({ marker: 'sw.js', search: '?seed=7' });
    let go;
    const done = registerServiceWorker(new Promise((r) => { go = r; }), f.doc, f.loc, f.nav);
    await new Promise((r) => setTimeout(r, 10));
    expect(f.calls).toEqual([]);
    go();
    expect(await done).toBe('register');
    expect(f.calls).toEqual([['register', 'sw.js', { updateViaCache: 'none' }]]);
  });

  test('?nosw=1 unregisters this scope only and deletes only our caches, without waiting', async () => {
    const f = fakes({ marker: 'sw.js', search: '?nosw=1' });
    globalThis.caches = f.caches;
    expect(await registerServiceWorker(new Promise(() => {}), f.doc, f.loc, f.nav)).toBe('remove');
    expect(f.calls).toEqual([
      ['getRegistrations'], ['unregister', 'https://x.test/game/'],
      ['delete', SW_CACHE_PREFIX + 'aaa'], ['delete', SW_CACHE_PREFIX + 'bbb'],
    ]);
  });

  test('a failing registration resolves quietly', async () => {
    const f = fakes({ marker: 'sw.js', registerFails: true });
    expect(await registerServiceWorker(Promise.resolve(), f.doc, f.loc, f.nav)).toBe('failed');
  });

  test('no service worker API: nothing happens', async () => {
    const f = fakes({ marker: 'sw.js' });
    expect(await registerServiceWorker(Promise.resolve(), f.doc, f.loc, {})).toBe('none');
  });
});

describe('checkPwa (tools/build-pages.mjs)', () => {
  const dirs = [];
  afterAll(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); });
  const INTEGRITY = 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const MANIFEST = {
    name: 'Starseed Isle', short_name: 'Starseed', start_url: './', scope: './', display: 'fullscreen',
    background_color: '#fff6e2', theme_color: '#7cc35a',
    icons: [
      { src: 'icons/a-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/a-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/m-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  // a tiny built site: index.html (marker + manifest link), the manifest, three icons, sw.js; returns it and its
  // precache list (every file but sw.js)
  async function site({ manifest = MANIFEST, html = null, extra = {} } = {}) {
    const d = await mkdtemp(join(tmpdir(), 'pwa-site-'));
    dirs.push(d);
    await mkdir(join(d, 'icons'));
    const files = {
      'index.html': html ?? `<html><head><link rel="manifest" href="app.webmanifest">\n${SW_MARKER}\n</head></html>`,
      'app.webmanifest': typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
      'icons/a-192.png': 'x', 'icons/a-512.png': 'x', 'icons/m-512.png': 'x', 'sw.js': '//', ...extra,
    };
    for (const [p, body] of Object.entries(files)) await writeFile(join(d, p), body);
    return [d, Object.keys(files).filter((p) => p !== 'sw.js').map((p) => [p, INTEGRITY])];
  }

  test('a complete site passes', async () => {
    const [d, pre] = await site({ extra: { 'a b.txt': 'spaces are URL-encoded' } });
    expect(await checkPwa(d, pre.map(([p, i]) => [encodeURI(p), i]))).toEqual([]);
  });

  test('a missing or root-absolute manifest icon fails', async () => {
    const icons = [...MANIFEST.icons, { src: 'icons/gone.png', sizes: '96x96' }];
    let [d, pre] = await site({ manifest: { ...MANIFEST, icons } });
    expect((await checkPwa(d, pre)).join('\n')).toMatch(/icon 3 src "icons\/gone\.png" is missing/);
    [d, pre] = await site({ manifest: { ...MANIFEST, icons: MANIFEST.icons.map((i, n) => (n ? i : { ...i, src: '/icons/a-192.png' })) } });
    expect((await checkPwa(d, pre)).join('\n')).toMatch(/icon 0 src "\/icons\/a-192\.png" must be a relative path/);
  });

  test('a manifest without the required members, sizes or a maskable icon fails', async () => {
    const { theme_color, ...noTheme } = MANIFEST;
    let [d, pre] = await site({ manifest: { ...noTheme, display: 'browser', start_url: '/game/', icons: MANIFEST.icons.slice(0, 1) } });
    const msg = (await checkPwa(d, pre)).join('\n');
    expect(msg).toMatch(/"theme_color" is missing/);
    expect(msg).toMatch(/display "browser" is not installable/);
    expect(msg).toMatch(/start_url "\/game\/" must be a relative path/);
    expect(msg).toMatch(/no 512x512 icon/);
    expect(msg).toMatch(/no maskable icon/);
    [d, pre] = await site({ manifest: '{ not json' });
    expect((await checkPwa(d, pre)).join('\n')).toMatch(/is not valid JSON/);
  });

  test('index.html must link the manifest and carry the marker', async () => {
    const [d, pre] = await site({ html: '<html><head></head></html>' });
    const msg = (await checkPwa(d, pre)).join('\n');
    expect(msg).toMatch(/no <link rel="manifest"/);
    expect(msg).toMatch(/service-worker marker/);
  });

  test('a missing, root-absolute or unchecked precache entry fails, and so does an unlisted file', async () => {
    const [d, pre] = await site();
    let msg = (await checkPwa(d, [...pre, ['assets/gone.png', INTEGRITY]])).join('\n');
    expect(msg).toMatch(/precache entry "assets\/gone\.png" is missing/);
    msg = (await checkPwa(d, [...pre.slice(1), ['/index.html', INTEGRITY]])).join('\n');
    expect(msg).toMatch(/precache entry "\/index\.html" must be a relative path/);
    expect(msg).toMatch(/site file index\.html is not precached/);
    msg = (await checkPwa(d, [...pre, ['../outside.txt', INTEGRITY]])).join('\n');
    expect(msg).toMatch(/points outside the site/);
    msg = (await checkPwa(d, pre.map(([p], n) => [p, n ? INTEGRITY : 'md5-x']))).join('\n');
    expect(msg).toMatch(/has no sha256 integrity/);
    expect((await checkPwa(d, [])).join('\n')).toMatch(/precache list is empty/);
  });
});
