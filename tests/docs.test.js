// docs/roadmap/: the roadmap index, the canon, the game bible and the step specs (S-001, S-002a, S-002b, S-002c). Every bible
// anchor INDEX.md cites must be an explicit `<a id="..."></a>` in a bible file that exists; every link between bible
// files and from the step files must reach an anchor GitHub renders: an explicit `<a id>` or a heading slug; every row of
// charter.md's glossary tables links to its defining file; every `### S-xxx · ` step heading is unique and carries the
// header line the step-index generator reads; the generator's own check passes and regenerating INDEX.md from the step
// files reproduces the committed one; and every CANON / CANON-NOW section reference in the roadmap docs must name a real
// section. Run with `bun test`.
import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', 'docs', 'roadmap');
const BIBLE = join(ROOT, 'bible');
const STEPS = join(ROOT, 'steps');
const read = (p) => readFileSync(p, 'utf8');
const lines = (text) => text.split(/\r?\n/);
const isHeading = (line) => /^#{1,6}\s/.test(line);
const mdFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);

/**
 * Bible-to-bible links that do not resolve yet because the bible files were written in parallel and disagree. The bible
 * text is not edited to fit (S-002a); each entry names the file to fix and the close-out step that adds the anchor or
 * cast entry and removes the entry here. This list only shrinks: a new broken link fails the test, and so does a second
 * copy of a listed one.
 */
const ALLOW_PENDING = [
  // creatures.md names the six shipped species by id; S-047 adds these anchors before their rows in creatures.md.
  'charter.md -> creatures.md#enemy-jelly-slime',
  'charter.md -> creatures.md#enemy-grumpy-shroomlet',
  'charter.md -> creatures.md#enemy-dozy-bat',
  'charter.md -> creatures.md#enemy-buzzy-bee',
  'charter.md -> creatures.md#enemy-snippy-crab',
  'charter.md -> creatures.md#enemy-snowpuff',
  // cast.md has no entry for these yet; the named step adds the cast entry with this anchor.
  'side-content.md -> cast.md#foreman-knock',          // S-116
  'side-content.md -> cast.md#nana-kelp',              // S-137
  'side-content.md -> cast.md#the-snoozing-whale',     // S-221
  // the target file lacks the anchor; the named step adds it before the matching heading.
  'story.md -> creatures.md#boss-wickwork',            // S-166 (creatures.md)
  'story.md -> atlas-home.md#remembered',              // S-197 (atlas-home.md)
  'story.md -> atlas-home.md#shellbys-bench',          // S-031 (atlas-home.md)
  // creatures.md marks the section `<a id="tiers">`; S-047 (M06 close-out; pattern tiers ship in S-041) adds this one.
  'systems.md -> creatures.md#pattern-tiers',
];

/**
 * charter.md glossary rows (by Name cell) that cite a whole bible file or the shipped code instead of a file#anchor. All
 * six are shipped (L) names, and the glossary is not edited to fit (charter decision 16), so they are listed here
 * rather than failing. This list only shrinks: any other row without an anchor fails, and so does a listed row once it
 * links an anchor.
 */
const GLOSSARY_WITHOUT_ANCHOR = [
  'Starseed Isle (`home`)',
  'Sprout Village, Whispering Woods, Frostcap Peaks, Sunny Shores, Bloom Meadow',
  "Grumble's Crown, Summit Crystal Cairn, Pinch's Lighthouse, Meadow Windmill",
  "Grumble Shroom's Hollow, Captain Pinch's Cove, Frostbun's Summit",
  "Miso's Shop; the signpost; the well; the hidden glade; the fairy rings; islet 1 and islet 2; the Peaks bridge",
  'Rainbow shells; parade lanterns',
];

/** Every bible reference INDEX.md makes: Appendix B lists plus `bible/<file>.md#<anchor>` links, as { file, anchor, where }. */
function indexBibleRefs(text) {
  const refs = [];
  const all = lines(text);
  let inAppendixB = false;
  all.forEach((line, i) => {
    if (/^##\s/.test(line)) inAppendixB = /^##\s+Appendix B\b/.test(line);
    const where = `INDEX.md:${i + 1}`;
    if (inAppendixB) {
      const m = line.match(/^-\s+\*\*([a-z0-9-]+\.md)\*\*:\s*(.*)$/);
      if (m) for (const a of m[2].matchAll(/`([^`]+)`\s*\(/g)) refs.push({ file: m[1], anchor: a[1], where });
    }
    for (const m of line.matchAll(/bible\/([a-z0-9-]+\.md)#([^\s)\]`'"<>]+)/g)) refs.push({ file: m[1], anchor: m[2], where });
  });
  return refs;
}

const ANCHOR_RE = /<a id="([^"]*)"><\/a>/g;
const ANCHOR_LINE_RE = /^(?:<a id="[^"]*"><\/a>)+$/;
/** What an anchor may label: a heading, or a paragraph led by a bold title (`**Mote's traces (Act II).** ...`). */
const isTarget = (line) => isHeading(line) || /^\*\*\S/.test(line);

/**
 * The explicit anchors in a bible file: id → [line numbers], and the ids that do not label anything. An anchor labels
 * something when its line holds only anchor tags (one or more, as in `<a id="I.2"></a><a id="I.3"></a>`) and the next
 * line, or the one after a single blank line, is a heading or a bold-titled paragraph.
 */
function explicitAnchors(text) {
  const all = lines(text);
  const ids = new Map();
  const unheaded = [];
  all.forEach((line, i) => {
    for (const m of line.matchAll(ANCHOR_RE)) {
      if (!ids.has(m[1])) ids.set(m[1], []);
      ids.get(m[1]).push(i + 1);
    }
  });
  for (const [id, at] of ids) {
    const ok = at.some((n) => {
      if (!ANCHOR_LINE_RE.test(all[n - 1].trim())) return false;   // the tags sit on their own line
      const next = all[n] ?? '';
      return isTarget(next) || (next.trim() === '' && isTarget(all[n + 1] ?? ''));
    });
    if (!ok) unheaded.push(id);
  }
  return { ids, unheaded };
}

/** A heading's GitHub anchor: inline markup dropped, lower-cased, punctuation removed, spaces to hyphens. */
function githubSlug(heading) {
  return heading
    .replace(/<[^>]+>/g, '')                       // inline HTML such as <a id>
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')     // [text](url) -> text
    .replace(/[*`]/g, '')                          // emphasis and code marks (underscores stay, as on GitHub)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');
}

/** Every anchor a file offers on GitHub: its explicit `<a id>` ids plus its heading slugs (repeats get -1, -2, ...). */
function renderedAnchors(text) {
  const out = new Set(explicitAnchors(text).ids.keys());
  const seen = new Map();
  let fence = false;
  for (const line of lines(text)) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence || !isHeading(line)) continue;
    const base = githubSlug(line.replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, ''));
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
}

const LINK_RE = /\[[^\]]*\]\((?:\.\/)?((?:\.\.\/|[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md)?#([^)\s]+)\)/g;
const BARE_REF_RE = /(?<![\w/.#-])(?:\.\/)?((?:\.\.\/[a-z]+\/)?[a-z0-9-]+\.md)#([A-Za-z0-9_.-]*[A-Za-z0-9_-])/g;

/**
 * Anchor references outside code fences, as { file, anchor, line }: file is the path relative to the referring file
 * (`./` dropped), or null for the same file. Markdown links count (`](#a)`, `](./f.md#a)`, `](f.md#a)`,
 * `](../bible/f.md#a)`), and so do bare references in prose or code spans (`./f.md#a`, `` `f.md#a` ``), which the bible
 * uses in tables such as art-audio.md's asset list; those carry `bare: true`.
 */
function anchorLinks(text) {
  const out = [];
  let fence = false;
  lines(text).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    if (fence) return;
    for (const m of line.matchAll(LINK_RE)) out.push({ file: m[1] ?? null, anchor: m[2], line: i + 1 });
    for (const m of line.replace(/\[[^\]]*\]\([^)]*\)/g, ' ').matchAll(BARE_REF_RE)) out.push({ file: m[1], anchor: m[2], line: i + 1, bare: true });
  });
  return out;
}

/** Whole-file markdown links (`](./f.md)`, `](f.md)`, `](../bible/f.md)`), as { file, line }. */
function fileLinks(text) {
  const out = [];
  lines(text).forEach((line, i) => {
    for (const m of line.matchAll(/\]\((?:\.\/)?((?:\.\.\/|[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.md)\)/g)) out.push({ file: m[1], line: i + 1 });
  });
  return out;
}

/** Where a link from `from` points, relative to its folder; null skips it. The default: the link's own path. */
const ownTarget = (l, from) => l.file ?? from;

/**
 * Links from the files in `dir` that do not resolve, as { key: "<from> -> <target>#<anchor>", at: "<from>:<line>" }.
 * Each link resolves relative to the linking file (a step's `../bible/x.md#a` reaches the bible), or wherever `target`
 * says; same-file links resolve against the file itself; a target file that does not exist is broken.
 */
function brokenLinks(dir, anchorsOf, readFile = read, target = ownTarget) {
  const bad = [];
  for (const f of mdFiles(dir)) {
    for (const l of anchorLinks(readFile(join(dir, f)))) {
      const to = target(l, f);
      if (to === null) continue;
      const anchors = anchorsOf(join(dir, to));
      if (!anchors || !anchors.has(l.anchor)) bad.push({ key: `${f} -> ${to}#${l.anchor}`, at: `${f}:${l.line}` });
    }
    for (const l of fileLinks(readFile(join(dir, f)))) {
      const to = target(l, f);
      if (to === null) continue;
      if (!anchorsOf(join(dir, to))) bad.push({ key: `${f} -> ${to}`, at: `${f}:${l.line}` });
    }
  }
  return bad;
}

/**
 * Where a step file's link points. Markdown links (`../bible/x.md#a`, `#a`, `./M01-M04.md#a`) resolve as written, and a
 * missing file is broken. Bare `x.md#a` references are skipped: in the step files they are prose shorthand for a bible
 * section, often quoting the ALLOW_PENDING entries a step will remove, not links GitHub renders.
 */
function stepTarget(l, from) {
  if (l.bare) return null;
  return l.file ?? from;
}

/** The step files README.md lists (`steps/M01-M04.md`, ...), whether or not they are in the repo yet. */
function listedStepFiles(text = read(join(ROOT, 'README.md'))) {
  return [...new Set([...text.matchAll(/\bsteps\/(M\d\d-M\d\d\.md)\b/g)].map((m) => m[1]))].sort();
}

/**
 * The `### S-xxx · ` step headings outside code fences, as { id, line, header }: header is the next non-empty line,
 * which the step-index generator reads (`Milestone M.. · Depends on: ... · Size: ...`).
 */
function stepHeadings(text) {
  const all = lines(text);
  const out = [];
  let fence = false;
  all.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    const m = !fence && line.match(/^### (S-\S+) · /);
    if (!m) return;
    let j = i + 1;
    while (j < all.length && all[j].trim() === '') j++;
    out.push({ id: m[1], line: i + 1, header: all[j] ?? '' });
  });
  return out;
}

/** What is wrong with the step headings of { file: text }: ids repeated across the files, and malformed header lines. */
function stepHeadingProblems(files) {
  const bad = [];
  const where = new Map();
  for (const [f, text] of Object.entries(files)) {
    for (const h of stepHeadings(text)) {
      if (!where.has(h.id)) where.set(h.id, []);
      where.get(h.id).push(`${f}:${h.line}`);
      if (!h.header.startsWith('Milestone M') || !h.header.includes('Depends on:') || !h.header.includes('Size:')) {
        bad.push(`${f}:${h.line}: ${h.id}: header line is not "Milestone M.. · Depends on: ... · Size: ..."`);
      }
    }
  }
  for (const [id, at] of where) if (at.length > 1) bad.push(`${id}: repeated at ${at.join(', ')}`);
  return bad;
}

/**
 * The glossary tables' body rows in charter.md (the `###` sections under `## Master glossary index`), as
 * { row, line, name, locked }; `locked` is true when the row's St. column starts with L (a shipped name).
 */
function glossaryRows(text) {
  const all = lines(text);
  const cells = (line) => line.slice(1, -1).split('|').map((c) => c.trim());
  const isSeparator = (line) => /^\|[\s|:-]+\|$/.test(line);
  const rows = [];
  let inGlossary = false;
  let stCol = -1;
  all.forEach((line, i) => {
    if (/^##\s/.test(line)) inGlossary = /^##\s+Master glossary index\b/.test(line);
    if (!inGlossary || !line.startsWith('|') || isSeparator(line)) return;
    if (isSeparator(all[i + 1] ?? '')) { stCol = cells(line).indexOf('St.'); return; }   // header row
    rows.push({ row: line, line: i + 1, name: cells(line)[0], locked: stCol >= 0 && /^L\b/.test(cells(line)[stCol] ?? '') });
  });
  return rows;
}

/**
 * What is wrong with one glossary row: each file#anchor it links must resolve (or be in ALLOW_PENDING). A row with no
 * anchor must be a shipped (L) name in GLOSSARY_WITHOUT_ANCHOR and cite an existing bible file or `js/` file; a listed
 * row that now links an anchor must leave the list.
 */
function glossaryRowProblems({ row, name, locked }, anchorsOf, withoutAnchor = GLOSSARY_WITHOUT_ANCHOR) {
  const bad = [];
  const links = anchorLinks(row).filter((l) => l.file !== null);
  for (const l of links) {
    const key = `charter.md -> ${l.file}#${l.anchor}`;
    if (!anchorsOf(join(BIBLE, l.file))?.has(l.anchor) && !ALLOW_PENDING.includes(key)) bad.push(key);
  }
  const listed = withoutAnchor.includes(name);
  if (links.length > 0) return listed ? [...bad, 'links an anchor now: remove it from GLOSSARY_WITHOUT_ANCHOR'] : bad;
  if (!listed || !locked) return [...bad, 'no file#anchor link'];
  const files = fileLinks(row).map((l) => join(BIBLE, l.file));
  const code = [...row.matchAll(/`(js\/[^`\s]+)`/g)].map((m) => join(import.meta.dir, '..', m[1]));
  if (files.length + code.length === 0) bad.push('cites no bible file or js/ file');
  for (const f of [...files, ...code]) if (!existsSync(f)) bad.push(`missing ${f}`);
  return bad;
}

const CANON_RE = /CANON(-NOW)?\s+(?:§|section\s+)(\d+)(?:\.(\d+))?/g;

/** Does `## <a>.` (and, with b, `### <a>.<b> ` or list item `<b>. ` under `## <a>.`) exist in this canon text? */
function canonHas(text, a, b) {
  const all = lines(text);
  let fence = false;
  let inSection = false;
  let found = false;
  for (const line of all) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (fence) continue;
    if (/^##\s/.test(line)) {
      inSection = line.startsWith(`## ${a}.`) && !/^\d/.test(line.slice(`## ${a}.`.length));
      if (inSection && b === undefined) return true;
      continue;
    }
    if (b === undefined) continue;
    if (line.startsWith(`### ${a}.${b} `)) return true;
    if (inSection && line.startsWith(`${b}. `)) found = true;
  }
  return found;
}

/** Every CANON / CANON-NOW reference in a text that does not resolve, as "file:line: text". */
function unresolvedCanonRefs(name, text, canon, canonNow) {
  const bad = [];
  lines(text).forEach((line, i) => {
    for (const m of line.matchAll(CANON_RE)) {
      const target = m[1] ? canonNow : canon;
      if (!canonHas(target, m[2], m[3])) bad.push(`${name}:${i + 1}: ${m[0]}`);
    }
  });
  return bad;
}

test('docs/roadmap: README, INDEX, CANON and CANON-NOW exist', () => {
  for (const f of ['README.md', 'INDEX.md', 'CANON.md', 'CANON-NOW.md']) expect(existsSync(join(ROOT, f))).toBe(true);
});

test('INDEX bible references: every cited bible file exists and defines an explicit anchor before a heading (0 pending)', () => {
  const refs = indexBibleRefs(read(join(ROOT, 'INDEX.md')));
  expect(refs.length).toBeGreaterThan(0);
  const missing = [];
  const anchors = new Map();
  for (const r of refs) {
    const path = join(BIBLE, r.file);
    if (!existsSync(path)) {
      missing.push(`${r.where}: bible/${r.file} (file missing)`);
      continue;
    }
    if (!anchors.has(r.file)) anchors.set(r.file, explicitAnchors(read(path)));
    const { ids, unheaded } = anchors.get(r.file);
    if (!ids.has(r.anchor) || unheaded.includes(r.anchor)) missing.push(`${r.where}: bible/${r.file}#${r.anchor}`);
  }
  expect(missing).toEqual([]);
});

const anchorCache = new Map();
const anchorsOf = (path) => {
  if (!anchorCache.has(path)) anchorCache.set(path, existsSync(path) ? renderedAnchors(read(path)) : null);
  return anchorCache.get(path);
};

test('bible cross-links: every anchor link between bible files and from the step files resolves', () => {
  const bible = brokenLinks(BIBLE, anchorsOf);
  const steps = brokenLinks(STEPS, anchorsOf, read, stepTarget);
  const linkCount = mdFiles(BIBLE).reduce((n, f) => n + anchorLinks(read(join(BIBLE, f))).length, 0);
  expect(linkCount).toBeGreaterThan(1000);
  // A broken bible link not on the list fails; so does a listed one that now resolves (remove it from ALLOW_PENDING)
  // or that appears more than once (the list must not grow by copies).
  expect(bible.filter((b) => !ALLOW_PENDING.includes(b.key)).map((b) => `${b.at}: ${b.key}`)).toEqual([]);
  const seen = ALLOW_PENDING.map((k) => [k, bible.filter((b) => b.key === k).map((b) => b.at)]);
  expect(seen.filter(([, at]) => at.length !== 1)).toEqual([]);
  const stepLinks = mdFiles(STEPS).reduce((n, f) => n + anchorLinks(read(join(STEPS, f))).filter((l) => !l.bare).length, 0);
  expect(stepLinks).toBeGreaterThan(700);   // markdown links from M01-M14 alone; M15-M35 add more
  expect(steps.map((b) => `${b.at}: ${b.key}`)).toEqual([]);
});

const STEP_FILES = [
  'M01-M04.md', 'M05-M08.md', 'M09-M12.md', 'M13-M14.md', 'M15-M17.md', 'M18-M20.md', 'M21-M23.md', 'M24-M26.md',
  'M27-M29.md', 'M30-M33.md', 'M34-M35.md',
];

test('step files: all eleven are present, README.md lists exactly them, and every `### S-xxx · ` heading is unique with a generator header', () => {
  const present = mdFiles(STEPS);
  expect(present).toEqual(STEP_FILES);
  expect(listedStepFiles()).toEqual(STEP_FILES);
  const files = Object.fromEntries(present.map((f) => [f, read(join(STEPS, f))]));
  expect(Object.values(files).reduce((n, t) => n + stepHeadings(t).length, 0)).toBe(415);
  expect(stepHeadingProblems(files)).toEqual([]);
});

/** python3 for the step-index generator, or null (the generator tests then skip with a printed note). */
const PYTHON = spawnSync('python3', ['--version']).status === 0 ? 'python3' : null;
const skipNote = (what) => console.log(`docs.test.js: python3 not found; skipping ${what}`);

test('step index: the generator\'s check passes (ids, titles and dependencies match the step files; no unknown dependency, no cycle)', () => {
  if (!PYTHON) return skipNote('the step-index generator check');
  const run = spawnSync(PYTHON, [join(ROOT, 'tools', 'step-index-src.py'), 'check'], { encoding: 'utf8' });
  expect({ status: run.status, out: run.stdout + run.stderr }).toEqual({ status: 0, out: expect.stringContaining(' 0 problems') });
});

test('step index: regenerating INDEX.md from the step files in a scratch copy reproduces the committed one byte for byte', () => {
  if (!PYTHON) return skipNote('the INDEX.md regeneration check');
  // build-step-index.sh rewrites INDEX.md in place, so it runs on a copy of docs/roadmap, never on the repo's.
  const tmp = mkdtempSync(join(tmpdir(), 'roadmap-'));
  try {
    cpSync(ROOT, join(tmp, 'roadmap'), { recursive: true });
    const run = spawnSync('sh', [join(tmp, 'roadmap', 'tools', 'build-step-index.sh')], { encoding: 'utf8' });
    expect({ status: run.status, out: run.stdout + run.stderr }).toEqual({ status: 0, out: expect.stringContaining('order violations []') });
    expect(read(join(tmp, 'roadmap', 'INDEX.md')) === read(join(ROOT, 'INDEX.md'))).toBe(true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}, 30_000);

test('glossary: every row of charter.md\'s glossary tables links its defining file and anchor, and each resolves', () => {
  const rows = glossaryRows(read(join(BIBLE, 'charter.md')));
  expect(rows.length).toBeGreaterThan(100);
  const bad = rows.flatMap((r) => glossaryRowProblems(r, anchorsOf).map((p) => `charter.md:${r.line}: ${r.name}: ${p}`));
  expect(bad).toEqual([]);
  expect(GLOSSARY_WITHOUT_ANCHOR.filter((n) => !rows.some((r) => r.name === n))).toEqual([]);   // no stale names
});

test('bible: every <a id> is unique within its file', () => {
  const files = mdFiles(BIBLE);
  expect(files.length).toBeGreaterThan(0);
  const dupes = [];
  for (const f of files) {
    for (const [id, at] of explicitAnchors(read(join(BIBLE, f))).ids) if (at.length > 1) dupes.push(`${f}#${id} (lines ${at.join(', ')})`);
  }
  expect(dupes).toEqual([]);
});

test('CANON / CANON-NOW references in README, INDEX, the bible and the step files all resolve', () => {
  const canon = read(join(ROOT, 'CANON.md'));
  const canonNow = read(join(ROOT, 'CANON-NOW.md'));
  const files = [
    'README.md', 'INDEX.md',
    ...mdFiles(BIBLE).map((f) => `bible/${f}`),
    ...mdFiles(join(ROOT, 'steps')).map((f) => `steps/${f}`),
  ].filter((f) => existsSync(join(ROOT, f)));
  let count = 0;
  const bad = [];
  for (const f of files) {
    const text = read(join(ROOT, f));
    count += [...text.matchAll(CANON_RE)].length;
    bad.push(...unresolvedCanonRefs(f, text, canon, canonNow));
  }
  expect(count).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test('helpers: anchors need their own line and a heading; canon refs resolve headings and numbered decisions', () => {
  const { ids, unheaded } = explicitAnchors([
    '<a id="a"></a>', '## A', '', '<a id="b"></a>', '', '### B', '<a id="c"></a>', 'text', '<a id="d"></a>', '', '', '## D',
    '<a id="e"></a><a id="f"></a>', '### E-F', '<a id="g"></a>', '**G.** a bold-titled paragraph',
    '| <a id="h"></a>H | cell |', '<a id="i"></a> ## not a heading', '<a id="j"></a>', '** not bold',
  ].join('\n'));
  expect([...ids.keys()]).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  expect(unheaded).toEqual(['c', 'd', 'h', 'i', 'j']);
  expect(indexBibleRefs('## Appendix B: x\n\n- **story.md**: `I.2` (S-004+), `ch7` (S-067)\n## Next\n- **story.md**: `no` (S-1)\nsee [x](../bible/charter.md#tone).'))
    .toEqual([
      { file: 'story.md', anchor: 'I.2', where: 'INDEX.md:3' },
      { file: 'story.md', anchor: 'ch7', where: 'INDEX.md:3' },
      { file: 'charter.md', anchor: 'tone', where: 'INDEX.md:6' },
    ]);
  const canon = '## 1. One\n### 1.2 Sub\n## 15. Decisions\n\n1. **First**\n2. **Second**\n   3. nested\n## 16. Next\n4. stray\n```\n## 9. fenced\n```\n';
  expect(canonHas(canon, '1')).toBe(true);
  expect(canonHas(canon, '1', '2')).toBe(true);
  expect(canonHas(canon, '1', '3')).toBe(false);
  expect(canonHas(canon, '15', '2')).toBe(true);
  expect(canonHas(canon, '15', '3')).toBe(false);   // indented, not a decision of §15
  expect(canonHas(canon, '15', '4')).toBe(false);   // under §16
  expect(canonHas(canon, '9')).toBe(false);        // inside a code fence
  expect(canonHas(canon, '5')).toBe(false);
  expect(unresolvedCanonRefs('x.md', 'CANON §1.2 and CANON section 15.2, CANON-NOW §3; CANON §7', canon, '## 3. Places\n'))
    .toEqual(['x.md:1: CANON §7']);
});

test('helpers: GitHub heading slugs, anchor links and glossary rows', () => {
  expect(githubSlug('Pattern tiers (harder by pattern, never by damage)')).toBe('pattern-tiers-harder-by-pattern-never-by-damage');
  expect(githubSlug('**Bold** `code` [link](./x.md#y) <a id="z"></a>Ünïcode_ok?')).toBe('bold-code-link-ünïcode_ok');
  const anchors = renderedAnchors('<a id="tiers"></a>\n### Pattern tiers\n## Same\n## Same\n```\n## fenced\n```\n# Closed #\n');
  expect([...anchors].sort()).toEqual(['closed', 'pattern-tiers', 'same', 'same-1', 'tiers']);
  expect(anchorLinks('[a](#x) [b](./cast.md#pip) [c](lore.md#I.2) [d](./cast.md) [e](https://e.com/x.md#f)\n```\n[g](#h)\n```\n[i](../bible/systems.md#journal)'))
    .toEqual([
      { file: null, anchor: 'x', line: 1 },
      { file: 'cast.md', anchor: 'pip', line: 1 },
      { file: 'lore.md', anchor: 'I.2', line: 1 },
      { file: '../bible/systems.md', anchor: 'journal', line: 5 },
    ]);
  // A step file's links resolve relative to it: `../bible/` reaches the bible; a missing file or anchor is broken.
  const step = '[ok](../bible/charter.md#tone) [bad](../bible/charter.md#nope) [gone](../bible/gone.md#a) [own](#nope)\n';
  expect(brokenLinks(join(ROOT, 'no-such-dir'), anchorsOf, () => step)).toEqual([]);   // an absent folder is skipped
  const bible = (path) => (path.startsWith(BIBLE) ? step : read(path));
  expect(brokenLinks(BIBLE, anchorsOf, bible).filter((b) => b.key.startsWith('charter.md ->')).map((b) => b.key)).toEqual([
    'charter.md -> ../bible/charter.md#nope', 'charter.md -> ../bible/gone.md#a', 'charter.md -> charter.md#nope',
  ]);
  const rows = glossaryRows([
    '## Master glossary index', '### A', '| Name | Kind | St. | Defined in |', '|---|---|---|---|',
    '| Pip | hero | L | [cast.md#pip](./cast.md#pip) |', '| Mote | moth | C | x |',
    '### B', '| Land | Side stories |', '|---|---|', '| Home | y |', '## Engineering invariants', '| out | of | scope |',
  ].join('\n'));
  expect(rows.map((r) => [r.line, r.name, r.locked])).toEqual([[5, 'Pip', true], [6, 'Mote', false], [10, 'Home', false]]);
  // Bare references in prose and code spans count; the text of a markdown link does not count twice.
  expect(anchorLinks('see `./creatures.md#boss-rollo` and (cast.md#pip). [lore.md#myth](./lore.md#myth) https://x.io/a.md#b'))
    .toEqual([
      { file: 'lore.md', anchor: 'myth', line: 1 },
      { file: 'creatures.md', anchor: 'boss-rollo', line: 1, bare: true },
      { file: 'cast.md', anchor: 'pip', line: 1, bare: true },
    ]);
  expect(fileLinks('[a](./atlas-home.md) [b](./cast.md#pip) [c](../bible/gone.md)')).toEqual([
    { file: 'atlas-home.md', line: 1 }, { file: '../bible/gone.md', line: 1 },
  ]);
  // In a step file a markdown link resolves as written and a bare `x.md#a` is skipped.
  const to = (text) => anchorLinks(text).map((l) => stepTarget(l, 'M01-M04.md'));
  expect(to('story.md#beacon-1 [a](story.md#beacon-1) [b](../bible/story.md#x) [c](#own)')).toEqual([
    'story.md', '../bible/story.md', 'M01-M04.md', null,   // markdown links first, then the bare reference
  ]);
  expect(to('[d](./M18-M20.md#s-158a) [e](./M99-M99.md#s-1)')).toEqual(['M18-M20.md', 'M99-M99.md']);
  expect(brokenLinks(STEPS, anchorsOf, () => '[a](../bible/charter.md#nope) [b](#nope) [c](./M99-M99.md) charter.md#nope\n', stepTarget)
    .filter((b) => b.at.startsWith('M01-M04.md:')).map((b) => b.key)).toEqual([
    'M01-M04.md -> ../bible/charter.md#nope', 'M01-M04.md -> M01-M04.md#nope', 'M01-M04.md -> M99-M99.md',
  ]);
  expect(listedStepFiles('[a](steps/M01-M04.md) `steps/M15-M17.md` … steps/M01-M04.md, steps/README.md')).toEqual(['M01-M04.md', 'M15-M17.md']);
  expect(stepHeadings('### S-001 · a\n\nMilestone M01 · Depends on: none · Size: S\n```\n### S-009 · fenced\n```\n### S-002a · b\nx'))
    .toEqual([
      { id: 'S-001', line: 1, header: 'Milestone M01 · Depends on: none · Size: S' },
      { id: 'S-002a', line: 7, header: 'x' },
    ]);
  expect(stepHeadingProblems({
    'A.md': '### S-001 · a\nMilestone M01 · Depends on: none · Size: S\n### S-002 · b\nMilestone M01 · Size: S\n',
    'B.md': '### S-001 · again\nMilestone M02 · Depends on: S-001 · Size: M\n### S-003 · c\n',
  })).toEqual([
    'A.md:3: S-002: header line is not "Milestone M.. · Depends on: ... · Size: ..."',
    'B.md:3: S-003: header line is not "Milestone M.. · Depends on: ... · Size: ..."',
    'S-001: repeated at A.md:1, B.md:1',
  ]);
  // The glossary exception: only listed shipped rows, citing a bible file or js/ file that exists.
  const row = (defined, locked, name = 'X') => ({ row: `| ${name} | k | ${locked ? 'L' : 'C'} | ${defined} |`, name, locked });
  const problems = (r) => glossaryRowProblems(r, anchorsOf, ['X']);
  expect(problems(row('[cast.md#pip](./cast.md#pip)', false, 'Y'))).toEqual([]);
  expect(problems(row('[cast.md#nope](./cast.md#nope)', false, 'Y'))).toEqual(['charter.md -> cast.md#nope']);
  expect(problems(row('[atlas-home.md](./atlas-home.md)', true))).toEqual([]);
  expect(problems(row('shipped `js/data.js` `ERRANDS`', true))).toEqual([]);
  expect(problems(row('[gone.md](./gone.md)', true))).toEqual([`missing ${join(BIBLE, 'gone.md')}`]);
  expect(problems(row('shipped `js/gone.js`', true))).toEqual([`missing ${join(import.meta.dir, '..', 'js/gone.js')}`]);
  expect(problems(row('nothing', true))).toEqual(['cites no bible file or js/ file']);
  expect(problems(row('[atlas-home.md](./atlas-home.md)', false))).toEqual(['no file#anchor link']);           // CANON row
  expect(problems(row('[atlas-home.md](./atlas-home.md)', true, 'Y'))).toEqual(['no file#anchor link']);       // not listed
  expect(problems(row('[cast.md#pip](./cast.md#pip)', true))).toEqual(['links an anchor now: remove it from GLOSSARY_WITHOUT_ANCHOR']);
});
