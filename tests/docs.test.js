// docs/roadmap/: the roadmap index, the canon and the game bible (S-001). Every bible anchor INDEX.md cites must be an
// explicit `<a id="..."></a>` in a bible file that exists (files that have not landed yet are reported as pending),
// and every CANON / CANON-NOW section reference in the roadmap docs must name a real section. Run with `bun test`.
import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', 'docs', 'roadmap');
const BIBLE = join(ROOT, 'bible');
const read = (p) => readFileSync(p, 'utf8');
const lines = (text) => text.split(/\r?\n/);
const isHeading = (line) => /^#{1,6}\s/.test(line);
const mdFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []);

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

test('INDEX bible references: each present bible file defines an explicit anchor before a heading; absent files are pending', () => {
  const refs = indexBibleRefs(read(join(ROOT, 'INDEX.md')));
  expect(refs.length).toBeGreaterThan(0);
  const missing = [];
  const pending = new Map();
  const anchors = new Map();
  for (const r of refs) {
    const path = join(BIBLE, r.file);
    if (!existsSync(path)) {
      pending.set(r.file, (pending.get(r.file) ?? 0) + 1);
      continue;
    }
    if (!anchors.has(r.file)) anchors.set(r.file, explicitAnchors(read(path)));
    const { ids, unheaded } = anchors.get(r.file);
    if (!ids.has(r.anchor) || unheaded.includes(r.anchor)) missing.push(`${r.where}: bible/${r.file}#${r.anchor}`);
  }
  const n = [...pending.values()].reduce((s, v) => s + v, 0);
  console.log(`pending: ${n} refs in ${[...pending.keys()].join(', ') || 'no files'}`);
  expect(missing).toEqual([]);
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
