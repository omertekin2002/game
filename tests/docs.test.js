// docs/roadmap/: the roadmap index, the canon and the game bible (S-001, S-002a). Every bible anchor INDEX.md cites must
// be an explicit `<a id="..."></a>` in a bible file that exists; every link between bible files (and, once S-002b lands
// them, from the step files) must reach an anchor GitHub renders: an explicit `<a id>` or a heading slug; every row of
// charter.md's glossary tables links to its defining file; and every CANON / CANON-NOW section reference in the roadmap
// docs must name a real section. Run with `bun test`.
import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', 'docs', 'roadmap');
const BIBLE = join(ROOT, 'bible');
const read = (p) => readFileSync(p, 'utf8');
const lines = (text) => text.split(/\r?\n/);
const isHeading = (line) => /^#{1,6}\s/.test(line);
const mdFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);

/**
 * Bible-to-bible links that do not resolve yet because the bible files were written in parallel and disagree. The bible
 * text is not edited to fit (S-002a); each entry names the file to fix and the close-out step that adds the anchor or
 * cast entry and removes the entry here. This list only shrinks: a new broken link fails the test.
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

/** Markdown links that carry an anchor: `](#a)`, `](./f.md#a)` and `](f.md#a)`, as { file, anchor, line } (file null = same file). */
function anchorLinks(text) {
  const out = [];
  let fence = false;
  lines(text).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return; }
    if (fence) return;
    for (const m of line.matchAll(/\]\((?:\.\/)?([A-Za-z0-9_-]+\.md)?#([^)\s]+)\)/g)) out.push({ file: m[1] ?? null, anchor: m[2], line: i + 1 });
  });
  return out;
}

/**
 * Links from the files in `dir` (named `prefix<file>`) that do not resolve against the bible, as
 * { key: "<from> -> <file>#<anchor>", at: "<from>:<line>" }. Same-file links resolve against the file itself; links
 * to `<file>.md` resolve in `dir` for bible files and in the bible for step files.
 */
function brokenLinks(dir, anchorsOf) {
  const bad = [];
  for (const f of mdFiles(dir)) {
    for (const l of anchorLinks(read(join(dir, f)))) {
      const target = l.file ?? f;
      const anchors = l.file === null ? anchorsOf(join(dir, f)) : anchorsOf(join(BIBLE, l.file));
      if (!anchors || !anchors.has(l.anchor)) bad.push({ key: `${f} -> ${target}#${l.anchor}`, at: `${f}:${l.line}` });
    }
  }
  return bad;
}

/**
 * The glossary tables' body rows in charter.md (the `###` sections under `## Master glossary index`), as
 * { row, line, locked }; `locked` is true when the row's St. column starts with L (a shipped name).
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
    rows.push({ row: line, line: i + 1, locked: stCol >= 0 && /^L\b/.test(cells(line)[stCol] ?? '') });
  });
  return rows;
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

test('bible cross-links: every anchor link between bible files (and from steps/, once present) resolves', () => {
  const bible = brokenLinks(BIBLE, anchorsOf);
  const steps = brokenLinks(join(ROOT, 'steps'), anchorsOf);
  const linkCount = mdFiles(BIBLE).reduce((n, f) => n + anchorLinks(read(join(BIBLE, f))).length, 0);
  expect(linkCount).toBeGreaterThan(1000);
  const keys = new Set(bible.map((b) => b.key));
  // A broken bible link not on the list fails; so does a listed one that now resolves (remove it from ALLOW_PENDING).
  expect(bible.filter((b) => !ALLOW_PENDING.includes(b.key)).map((b) => `${b.at}: ${b.key}`)).toEqual([]);
  expect(ALLOW_PENDING.filter((k) => !keys.has(k))).toEqual([]);
  expect(steps.map((b) => `${b.at}: ${b.key}`)).toEqual([]);
});

test('glossary: every row of charter.md\'s glossary tables links its defining file and anchor, and each resolves', () => {
  const charter = read(join(BIBLE, 'charter.md'));
  const rows = glossaryRows(charter);
  expect(rows.length).toBeGreaterThan(100);
  const bad = [];
  for (const { row, line, locked } of rows) {
    const links = anchorLinks(row).filter((l) => l.file !== null);
    for (const l of links) {
      const key = `charter.md -> ${l.file}#${l.anchor}`;
      if (!anchorsOf(join(BIBLE, l.file))?.has(l.anchor) && !ALLOW_PENDING.includes(key)) bad.push(`charter.md:${line}: ${key}`);
    }
    if (links.length > 0) continue;
    // A shipped (L) name may instead cite a whole bible file or the shipped code; a CANON name needs file#anchor.
    const files = [...row.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    const ok = locked && (files.length > 0 ? files.every((f) => existsSync(join(BIBLE, f))) : /`js\/[^`]+`/.test(row));
    if (!ok) bad.push(`charter.md:${line}: no file#anchor link`);
  }
  expect(bad).toEqual([]);
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
  expect(anchorLinks('[a](#x) [b](./cast.md#pip) [c](lore.md#I.2) [d](./cast.md) [e](https://e.com/#f)\n```\n[g](#h)\n```'))
    .toEqual([
      { file: null, anchor: 'x', line: 1 },
      { file: 'cast.md', anchor: 'pip', line: 1 },
      { file: 'lore.md', anchor: 'I.2', line: 1 },
    ]);
  const rows = glossaryRows([
    '## Master glossary index', '### A', '| Name | Kind | St. | Defined in |', '|---|---|---|---|',
    '| Pip | hero | L | [cast.md#pip](./cast.md#pip) |', '| Mote | moth | C | x |',
    '### B', '| Land | Side stories |', '|---|---|', '| Home | y |', '## Engineering invariants', '| out | of | scope |',
  ].join('\n'));
  expect(rows.map((r) => [r.line, r.locked])).toEqual([[5, true], [6, false], [10, false]]);
});
