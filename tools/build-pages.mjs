#!/usr/bin/env node
// Assemble the static site that GitHub Pages serves, then check it.
// Usage: node tools/build-pages.mjs [outDir]   (default _site)
//
// Copies only what the game needs at runtime (see SITE_FILES) and fails if:
//  - a file referenced by index.html, the import map, styles.css, a JS import or
//    the asset manifest is missing from the site, or
//  - anything uses a root-absolute path ("/assets/..."), which would break when
//    the game is served from a project subpath such as https://<user>.github.io/game/.
import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(root, process.argv[2] || '_site');
if (out === root || !out.startsWith(root + sep)) throw new Error(`refusing to build into ${out}`);

// Runtime files only: no tests, tools, docs, CI config or dev dependencies.
const SITE_FILES = ['index.html', 'styles.css', 'js', 'assets', 'vendor/three'];

const errors = [];
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

await build();
await check();
if (errors.length) {
  console.error(`build-pages: ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
const files = await walk(out);
const bytes = (await Promise.all(files.map((f) => stat(f)))).reduce((n, s) => n + s.size, 0);
console.log(`build-pages: ${relative(root, out)}/ ready, ${files.length} files, ${(bytes / 1048576).toFixed(1)} MiB`);
