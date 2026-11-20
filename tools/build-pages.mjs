#!/usr/bin/env node
// Assemble the static site that GitHub Pages serves, then check it.
// Usage: node tools/build-pages.mjs [outDir]   (default _site)
//
// Copies only what the game needs at runtime (see SITE_FILES) and fails if:
//  - a file referenced by index.html, the import map, styles.css, a JS import or
//    the asset manifest is missing from the site, or
//  - anything uses a root-absolute path ("/assets/..."), which would break when
//    the game is served from a project subpath such as https://<user>.github.io/game/.
// Then it makes the site installable and offline-playable: it adds the service-worker marker to index.html (js/pwa.js
// registers sw.js only when it is there), writes sw.js (tools/sw-template.js plus the precache list and a version hashed
// from every file's contents), and fails if the web manifest or a precache entry is missing, invalid or root-absolute.
// The other modules import { buildPages, checkPwa } (tests/pwa.mjs, tests/pwa.test.js).
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

// Runtime files only: no tests, tools, docs, CI config or dev dependencies.
const SITE_FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'js', 'assets', 'vendor/three'];
export const SW_FILE = 'sw.js';
export const SW_MARKER = `<meta name="starseed-sw" content="${SW_FILE}">`;
const SW_TEMPLATE = join(root, 'tools', 'sw-template.js');

let out = null;   // the site being built or checked (set by buildPages)
let errors = [];
const fail = (msg) => errors.push(msg);

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

const isRemote = (u) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u);
const isRootAbsolute = (u) => u.startsWith('/') && !u.startsWith('//');

// Resolve a relative URL found in `fromFile` (a site path) and check it exists in the site.
async function checkRef(fromFile, url, what) {
  if (!url || isRemote(url) || url.startsWith('#')) return;
  const where = `${relative(out, fromFile)}: ${what} "${url}"`;
  if (isRootAbsolute(url)) { fail(`${where} is root-absolute; use a relative path so the game works from a subpath`); return; }
  const clean = url.split(/[?#]/)[0];
  const target = posix.normalize(posix.join(posix.dirname(relative(out, fromFile).split(sep).join('/')), clean));
  if (target.startsWith('..')) { fail(`${where} points outside the site`); return; }
  if (!(await exists(join(out, target)))) fail(`${where} is missing from the site (${target})`);
}

async function build() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const f of SITE_FILES) {
    const from = join(root, f);
    if (!(await exists(from))) { fail(`${f} is listed in SITE_FILES but does not exist`); continue; }
    await mkdir(dirname(join(out, f)), { recursive: true });
    await cp(from, join(out, f), { recursive: true });
  }
}

async function check() {
  const indexPath = join(out, 'index.html');
  const html = await readFile(indexPath, 'utf8');

  // <script src>, <link href>, <img src> …
  for (const m of html.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/g)) await checkRef(indexPath, m[1], 'attribute');

  // Import map targets; remember them to resolve bare specifiers in JS.
  const importMap = {};
  const im = html.match(/<script\s+type=["']importmap["']\s*>([\s\S]*?)<\/script>/);
  if (im) Object.assign(importMap, JSON.parse(im[1]).imports || {});
  for (const [key, url] of Object.entries(importMap)) await checkRef(indexPath, url, `import map entry "${key}"`);

  // CSS url(...)
  for (const f of (await walk(out)).filter((p) => extname(p) === '.css')) {
    const css = await readFile(f, 'utf8');
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) await checkRef(f, m[1], 'url()');
  }

  // Our own JS (vendored three.js is checked through the imports that reach it).
  const ownJs = (await walk(join(out, 'js'))).filter((p) => extname(p) === '.js');
  ownJs.push(join(out, 'assets', 'manifest.js'));
  for (const f of ownJs) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)) {
      const spec = m[1];
      const mapped = Object.keys(importMap)
        .filter((k) => spec === k || (k.endsWith('/') && spec.startsWith(k)))
        .sort((a, b) => b.length - a.length)[0];
      if (mapped !== undefined) await checkRef(indexPath, importMap[mapped] + spec.slice(mapped.length), `import "${spec}" in ${relative(out, f)}`);
      else if (spec.startsWith('.') || spec.startsWith('/')) await checkRef(f, spec, 'import');
      else fail(`${relative(out, f)}: bare import "${spec}" is not in the import map`);
    }
    // String literals like '/assets/…' or `/js/…` that would load from the domain root.
    for (const m of src.matchAll(/["'`]\/(?:assets|js|vendor|styles\.css)\b[^"'`]*["'`]/g)) {
      fail(`${relative(out, f)}: root-absolute path ${m[0]}; use a relative path so the game works from a subpath`);
    }
  }

  // Every file in the asset manifest must ship (paths are relative to index.html).
  const sandbox = { window: {} };
  vm.runInNewContext(await readFile(join(out, 'assets', 'manifest.js'), 'utf8'), sandbox);
  const manifest = sandbox.window.ASSET_MANIFEST;
  if (!manifest) fail('assets/manifest.js did not define window.ASSET_MANIFEST');
  for (const [group, entries] of Object.entries(manifest || {})) {
    for (const [key, v] of Object.entries(entries || {})) {
      const url = typeof v === 'string' ? v : v && v.src;
      if (url) await checkRef(indexPath, url, `manifest ${group}.${key}`);
    }
  }
}

// ---------------------------------------------------------------- offline / installable (PWA)

const toUrlPath = (file, base) => relative(base, file).split(sep).join('/');
const sriOf = (buf) => 'sha256-' + createHash('sha256').update(buf).digest('base64');

/** Add the marker to index.html, then write sw.js precaching every other file in the site. */
async function writeServiceWorker() {
  const indexPath = join(out, 'index.html');
  const html = await readFile(indexPath, 'utf8');
  if (!html.includes(SW_MARKER)) {
    if (!html.includes('</head>')) fail('index.html has no </head> to add the service-worker marker to');
    else await writeFile(indexPath, html.replace('</head>', `  ${SW_MARKER}\n</head>`));
  }
  const files = (await walk(out)).map((f) => toUrlPath(f, out)).filter((p) => p !== SW_FILE).sort();
  const precache = [];
  let bytes = 0;
  for (const p of files) {
    const buf = await readFile(join(out, p));
    bytes += buf.length;
    precache.push([encodeURI(p), sriOf(buf)]);
  }
  const version = createHash('sha256').update(precache.map(([u, i]) => `${u} ${i}\n`).join('')).digest('hex').slice(0, 16);
  const body = await readFile(SW_TEMPLATE, 'utf8');
  const head = `// Generated by tools/build-pages.mjs from tools/sw-template.js; do not edit.\n` +
    `const VERSION = ${JSON.stringify(version)};\nconst PRECACHE = ${JSON.stringify(precache, null, 0).replace(/\],\[/g, '],\n  [')};\n`;
  await writeFile(join(out, SW_FILE), head + body);
  return { precache, version, bytes };
}

const isPlainRel = (u) => typeof u === 'string' && u !== '' && !isRemote(u) && !u.startsWith('/') && !u.startsWith('#');

/**
 * Check the installable / offline parts of a built site: the web manifest that index.html links (valid JSON, the
 * required members, 192 and 512 icons with one maskable, every path relative and present) and the service worker's
 * precache list (every entry relative, inside the site and present; every site file listed). Returns the problems.
 * @param {string} site absolute path of the built site
 * @param {Array<[string, string]>} precache [relative URL, integrity] entries as written into sw.js
 */
export async function checkPwa(site, precache) {
  const problems = [];
  const bad = (m) => problems.push(m);
  const present = async (url, what) => {
    if (!isPlainRel(url)) { bad(`${what} "${url}" must be a relative path inside the site (the game is served from a subpath)`); return false; }
    const target = posix.normalize(decodeURI(url.split(/[?#]/)[0]) || '.');
    if (target.startsWith('..')) { bad(`${what} "${url}" points outside the site`); return false; }
    if (!(await exists(join(site, target)))) { bad(`${what} "${url}" is missing from the site`); return false; }
    return true;
  };

  const html = await readFile(join(site, 'index.html'), 'utf8').catch(() => '');
  if (!html.includes(SW_MARKER)) bad(`index.html lacks the service-worker marker ${SW_MARKER}`);
  const link = html.match(/<link\b[^>]*\brel=["']manifest["'][^>]*>/);
  const href = link && (link[0].match(/\bhref=["']([^"']+)["']/) || [])[1];
  if (!href) bad('index.html has no <link rel="manifest" href="…">');
  else if (await present(href, 'manifest link')) {
    let m = null;
    try { m = JSON.parse(await readFile(join(site, decodeURI(href)), 'utf8')); } catch (e) { bad(`${href} is not valid JSON (${e.message})`); }
    if (m) {
      for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) {
        if (typeof m[k] !== 'string' || !m[k]) bad(`${href}: "${k}" is missing`);
      }
      if (m.display && !['fullscreen', 'standalone', 'minimal-ui'].includes(m.display)) bad(`${href}: display "${m.display}" is not installable`);
      const base = posix.dirname(href);
      for (const k of ['start_url', 'scope', 'id']) {
        if (m[k] === undefined) continue;
        if (!isPlainRel(m[k])) bad(`${href}: ${k} "${m[k]}" must be a relative path`);
        else await present(posix.join(base, m[k]), `${href}: ${k}`);
      }
      const icons = Array.isArray(m.icons) ? m.icons : [];
      if (!icons.length) bad(`${href}: no icons`);
      const sizes = new Set(icons.flatMap((i) => String(i.sizes || '').split(/\s+/)));
      for (const sz of ['192x192', '512x512']) if (!sizes.has(sz)) bad(`${href}: no ${sz} icon`);
      if (!icons.some((i) => String(i.purpose || '').split(/\s+/).includes('maskable'))) bad(`${href}: no maskable icon`);
      for (const [n, i] of icons.entries()) {
        if (!isPlainRel(i.src)) bad(`${href}: icon ${n} src "${i.src}" must be a relative path`);
        else await present(posix.join(base, i.src), `${href}: icon ${n} src`);
      }
    }
  }

  if (!Array.isArray(precache) || !precache.length) bad(`${SW_FILE}: the precache list is empty`);
  const listed = new Set();
  for (const entry of precache || []) {
    const [url, integrity] = Array.isArray(entry) ? entry : [];
    if (!/^sha256-[A-Za-z0-9+/]+=*$/.test(integrity || '')) bad(`${SW_FILE}: precache entry "${url}" has no sha256 integrity`);
    if (await present(url, `${SW_FILE}: precache entry`)) listed.add(posix.normalize(decodeURI(url)));
  }
  for (const f of (await walk(site)).map((p) => toUrlPath(p, site))) {
    if (f !== SW_FILE && !listed.has(f)) bad(`${SW_FILE}: site file ${f} is not precached`);
  }
  return problems;
}

/**
 * Build (copy, unless `copy` is false: re-finish a site already in `outDir`) and check the site.
 * @returns {Promise<{ errors: string[], files: number, bytes: number, precacheBytes: number, version: string }>}
 */
export async function buildPages(outDir = '_site', { copy = true } = {}) {
  out = resolve(root, outDir);
  if (out === root || !out.startsWith(root + sep)) throw new Error(`refusing to build into ${out}`);
  errors = [];
  if (copy) await build();
  await check();
  const sw = await writeServiceWorker();
  errors.push(...(await checkPwa(out, sw.precache)));
  const files = await walk(out);
  const bytes = (await Promise.all(files.map((f) => stat(f)))).reduce((n, st) => n + st.size, 0);
  return { errors, files: files.length, bytes, precacheBytes: sw.bytes, version: sw.version, out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const r = await buildPages(process.argv[2] || '_site');
  if (r.errors.length) {
    console.error(`build-pages: ${r.errors.length} problem(s):\n  - ${r.errors.join('\n  - ')}`);
    process.exit(1);
  }
  const mib = (n) => (n / 1048576).toFixed(1);
  console.log(`build-pages: ${relative(root, r.out)}/ ready, ${r.files} files, ${mib(r.bytes)} MiB`);
  console.log(`build-pages: ${SW_FILE} version ${r.version} precaches ${r.files - 1} files, ${mib(r.precacheBytes)} MiB`);
}
