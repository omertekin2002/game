// Offline / installable build: registers the service worker (sw.js) that tools/build-pages.mjs writes into _site/.
// Only the Pages build registers it: the build adds <meta name="starseed-sw" content="sw.js"> to _site/index.html, and
// without that marker (running from the repo: `bun run start`, tests/smoke.mjs) nothing is registered and sw.js is never
// requested, so local development never serves stale files. ?nosw=1 skips registration and removes this scope's service
// worker and its caches (the escape hatch for a broken one). Nothing here ever throws or logs a console error.

export const SW_CACHE_PREFIX = 'starseed-isle-';   // PREFIX in tools/sw-template.js

/** 'register' | 'remove' | 'none' for this page: the build marker's script URL decides, ?nosw=1 or a page that a
 *  service worker controls without the marker (a dev server on an origin where a build once ran) removes it. */
export function swPlan({ marker, search = '', supported = true, controlled = false }) {
  if (!supported) return 'none';
  if (/[?&]nosw=1(?:&|$)/.test(search)) return 'remove';
  if (marker) return 'register';
  return controlled ? 'remove' : 'none';
}

async function removeOurs(nav, scope) {
  for (const reg of await nav.serviceWorker.getRegistrations()) if (reg.scope === scope) await reg.unregister();
  const c = globalThis.caches;
  if (c) for (const name of await c.keys()) if (name.startsWith(SW_CACHE_PREFIX)) await c.delete(name);
}

/** Register (once `ready` settles) or remove (at once, even if the boot later fails) the service worker; resolves to
 *  what it did. Failures are swallowed: the game never depends on it. */
export async function registerServiceWorker(ready = Promise.resolve(), doc = document, loc = location, nav = navigator) {
  try {
    const sw = nav.serviceWorker;
    const meta = doc.querySelector('meta[name="starseed-sw"]');
    const plan = swPlan({ marker: meta && meta.content, search: loc.search, supported: !!sw, controlled: !!(sw && sw.controller) });
    if (plan === 'register') { await ready; await sw.register(meta.content, { updateViaCache: 'none' }); }
    else if (plan === 'remove') await removeOurs(nav, new URL('./', loc.href).href);
    return plan;
  } catch (e) {
    return 'failed';
  }
}
