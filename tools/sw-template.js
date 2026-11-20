// Starseed Isle service worker: the body of _site/sw.js. tools/build-pages.mjs writes `VERSION` (a hash of every site
// file's contents) and `PRECACHE` ([relative URL, SRI integrity] for every site file) above this code. Only the Pages
// build has a service worker: running from the repo never registers one (js/pwa.js).
//
// install   precache every file into `starseed-isle <scope> <VERSION>` (the scope keeps two deployments on one origin,
//           such as /game/ and a preview path, from deleting each other's caches). A file whose integrity matches the copy in an older
//           version's cache is copied from there, the rest are fetched (the HTTP cache first, then the network) and
//           checked against their integrity, so a stale CDN or HTTP-cache copy never lands in the new cache. Any
//           failure fails the install and the old version keeps serving; the browser tries again on a later load.
// activate  the new version takes over at once (skipWaiting + clients.claim), so a deploy reaches players on their
//           next load at the latest, then the older versions' caches are deleted. An open session keeps working: the
//           new cache is complete before it activates, so its later requests are all answered (from the new version).
// fetch     same-origin GETs inside the scope, cache-first with the query string ignored (?debug=1, ?seed=…), a
//           directory URL served as its index.html; anything not precached goes to the network.
/* global VERSION, PRECACHE */
const PREFIX = `starseed-isle ${self.registration.scope} `;   // cachePrefix(scope) in js/pwa.js
const CACHE = PREFIX + VERSION;
const INDEX = 'sw-precache-index.json';   // { url: integrity } of a complete cache, written last
const PARALLEL = 6;

const abs = (url) => new URL(url, self.location.href).href;

// url → cache name of an older complete cache holding the same file (same integrity)
async function reusable() {
  const found = new Map();
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || name === CACHE) continue;
    try {
      const res = await caches.match(abs(INDEX), { cacheName: name });
      if (!res) continue;
      for (const [url, integrity] of Object.entries(await res.json())) found.set(url + ' ' + integrity, name);
    } catch (e) { /* an unreadable index: nothing to reuse from that cache */ }
  }
  return found;
}

async function fetchChecked(url, integrity) {
  try {
    const res = await fetch(new Request(url, { integrity, credentials: 'same-origin' }));
    if (res.ok) return res;
  } catch (e) { /* integrity mismatch (a stale HTTP-cache copy) or offline: try the network once more */ }
  const res = await fetch(new Request(url, { integrity, cache: 'reload', credentials: 'same-origin' }));
  if (!res.ok) throw new Error(`precache ${url}: HTTP ${res.status}`);
  return res;
}

async function precache() {
  const cache = await caches.open(CACHE);
  const old = await reusable();
  const queue = PRECACHE.slice();
  const index = {};
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [rel, integrity] = item, url = abs(rel);
      index[rel] = integrity;
      if (await cache.match(url)) continue;                    // an earlier, interrupted install of this version
      const from = old.get(rel + ' ' + integrity);
      const prev = from && (await caches.match(url, { cacheName: from }));
      await cache.put(url, prev || (await fetchChecked(url, integrity)));
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  await cache.put(abs(INDEX), new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const scope = self.registration.scope;
  if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return;
  let key = url.origin + url.pathname;                         // no query string, no hash
  if (key.endsWith('/')) key += 'index.html';
  event.respondWith((async () => {
    // cacheName: never re-creates this version's cache if it was deleted; a miss goes to the network
    const hit = await caches.match(key, { cacheName: CACHE }).catch(() => null);
    return hit || fetch(req);
  })());
});
