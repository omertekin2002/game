# Builds docs/roadmap/INDEX.md from step-index-head.md + step-index-src.py + coverage.py + the step files (../steps).
# Run: sh build-step-index.sh (or python3 build-index.py [--check]). Layout: this file lives in docs/roadmap/tools/.
# --check: verify that INDEX.md lists exactly the '### S-xxx · ' headings of the step files, once each, and that the
#          '#' order is a topological order of the dependencies; exit 1 on any mismatch.
import io, os, re, sys, json, glob, contextlib, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
SRC = os.path.join(HERE, 'step-index-src.py')
OUT = os.path.join(ROOT, 'INDEX.md')


def load_src():
    g = {'__file__': SRC, '__name__': 'step_index_src'}
    argv = sys.argv
    sys.argv = [SRC, '__none__']
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            exec(compile(open(SRC, encoding='utf-8').read(), SRC, 'exec'), g)
    finally:
        sys.argv = argv
    return g


def act_of(mid):
    n = int(mid[1:])
    if n <= 2: return 'I'
    if n <= 7: return 'engine'
    if n <= 9: return 'Interlude'
    if n <= 20: return 'II'
    if n <= 30: return 'III'
    if n <= 32: return 'IV'
    if n <= 34: return 'post'
    return 'polish'


def filing_order(milestones):
    """Desired order: milestones in order, except M05 right after M02 with S-024, S-025 first (§1.8).
    Then a stable topological sort, so every dependency gets a lower # than its dependant."""
    by_ms = {m['id']: m['issues'] for m in milestones}
    desired = []
    for m in milestones:
        mid = m['id']
        if mid == 'M03':
            continue
        if mid == 'M04':
            continue
        desired += by_ms[mid]
        if mid == 'M02':
            early = [r for r in by_ms['M04'] if r['id'] in ('S-024', 'S-025')]
            desired += early
            desired += by_ms['M05']
            desired += by_ms['M03']
            desired += [r for r in by_ms['M04'] if r['id'] not in ('S-024', 'S-025')]
    seen, uniq = set(), []
    for r in desired:  # M05 appears twice above (once in its own place); keep the first
        if r['id'] not in seen:
            seen.add(r['id']); uniq.append(r)
    pos = {r['id']: i for i, r in enumerate(uniq)}
    done, order = set(), []
    remaining = list(uniq)
    while remaining:
        for k, r in enumerate(remaining):
            if all(d in done for d in r['deps']):
                order.append(r); done.add(r['id']); remaining.pop(k); break
        else:
            raise SystemExit('dependency cycle among: ' + ', '.join(r['id'] for r in remaining[:10]))
    return {r['id']: i + 1 for i, r in enumerate(order)}, pos


def heading_ids():
    ids = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'steps', 'M*.md'))):
        for line in open(f, encoding='utf-8'):
            m = re.match(r'^### (S-\d{3}[a-z]?) · ', line)
            if m:
                ids.append((m.group(1), os.path.basename(f)))
            elif line.startswith('### S-'):
                ids.append(('MALFORMED:' + line.strip()[:60], os.path.basename(f)))
    return ids


def main():
    g = load_src()
    if g['PROBLEMS']:
        for p in g['PROBLEMS']:
            print('ERROR', p, file=sys.stderr)
        raise SystemExit('step-index-src.py check fails; fix the step files or the source first')
    M = g['M']
    num, _ = filing_order(M)
    issues = [r for m in M for r in m['issues']]
    n_issues, n_rows = len(issues), g['N_ROWS']
    hours = None
    hp = os.path.join(ROOT, 'hours.json')
    if os.path.exists(hp):
        hours = json.load(open(hp)).get('milestones')

    if '--check' in sys.argv:
        heads = heading_ids()
        bad = [h for h, f in heads if h.startswith('MALFORMED')]
        hid = [h for h, f in heads if not h.startswith('MALFORMED')]
        dup = sorted({h for h in hid if hid.count(h) > 1})
        text = open(OUT, encoding='utf-8').read()
        rows = re.findall(r'^\| (\d+) \| \[(S-\d{3}[a-z]?)\]', text, re.M)
        rid = [r[1] for r in rows]
        missing = sorted(set(hid) - set(rid)); extra = sorted(set(rid) - set(hid))
        rdup = sorted({r for r in rid if rid.count(r) > 1})
        seq = sorted(int(r[0]) for r in rows)
        topo = [f"{r['id']} (# {num[r['id']]}) needs {d} (# {num[d]})" for r in issues for d in r['deps'] if num[d] >= num[r['id']]]
        ok = not (bad or dup or missing or extra or rdup or topo) and seq == list(range(1, len(rows) + 1))
        print(f"headings {len(hid)}, index rows {len(rows)}, malformed {len(bad)}, duplicate headings {dup}, "
              f"missing from index {missing}, not in step files {extra}, duplicate rows {rdup}, "
              f"# contiguous {seq == list(range(1, len(rows) + 1))}, order violations {topo[:5]}")
        raise SystemExit(0 if ok else 1)

    dung = subprocess.check_output([sys.executable, 'coverage.py', '--count', 'Dungeons'], cwd=HERE, text=True).strip()
    head = open(os.path.join(HERE, 'step-index-head.md'), encoding='utf-8').read()
    head = (head.replace('{{ROWS}}', str(n_rows)).replace('{{ISSUES}}', str(n_issues))
                .replace('{{MILESTONES}}', str(len(M))).replace('{{SPLITS}}', str(n_issues - n_rows))
                .replace('{{MERGES}}', str(-(-n_issues // 8))).replace('{{DUNGEON_ISSUES}}', dung))
    o = [head.rstrip('\n'), '', '---', '', '<a id="overview"></a>', '', '## Milestone overview', '']
    o.append('Milestones are listed by id; the # range shows where each sits in the filing order (M05 is filed before '
             'M03 and M04, §1.8). "Play added" is the milestone budget written before the 2026-11-22 playtime model; '
             'CANON §11 models the finished game at about 95 h for 100 % (band 84-112) and 40 h for the main story, '
             'and S-078b regenerates these columns from `tools/hours.mjs`.')
    o.append('')
    budget_col = hours is not None
    hdr = '| Milestone | Act | Title | Steps | # | Count | Step file | Play added | Cumulative play (h) |'
    if budget_col:
        hdr = hdr[:-1] + ' Budget (CANON §11) |'
    o.append(hdr)
    o.append('|' + '---|' * (hdr.count('|') - 1))
    cum = 3.0
    for m in M:
        iss = m['issues']
        files = []
        for r in iss:
            if r['file'] not in files: files.append(r['file'])
        nums = [num[r['id']] for r in iss]
        if budget_col:
            add = float(hours.get(m['id'], 0)); cum += add
            play = f"+{add:.1f} h"
        else:
            mm = re.match(r'\+([0-9.]+) h', m['hours'])
            cum += float(mm.group(1)) if mm else 0
            play = m['hours']
        fl = ', '.join(f"[{f[:-3]}](steps/{f})" for f in files)
        row = (f"| [{m['id']}](#{m['id'].lower()}) | {act_of(m['id'])} | {m['title']} | {iss[0]['id']} - {iss[-1]['id']} | "
               f"{min(nums)}-{max(nums)} | {len(iss)} | {fl} | {play} | {cum:.1f} |")
        if budget_col:
            row = row[:-1] + f" {m['hours']} |"
        o.append(row)
    o += ['', f"**{n_issues} steps, {len(M)} milestones.** Cumulative play starts from the 3 h the game has today.",
          '', '---', '']
    for m in M:
        iss = m['issues']
        o += [f'<a id="{m["id"].lower()}"></a>', '', f"## {m['id']} · {m['title']}", '',
              f"**Goal.** {m['goal']}", '', f"**Entry.** {m['entry']}", '',
              f"**Exit criteria (what the player can do).** {m['exit']}", '',
              f"**Play added.** {m['hours']} · **Steps** {iss[0]['id']} - {iss[-1]['id']} ({len(iss)})", '',
              '| # | id | title | step file | depends on | size | save |', '|---|---|---|---|---|---|---|']
        for r in sorted(iss, key=lambda r: num[r['id']]):
            cell = lambda x: x.replace('|', '\\|')
            deps = ', '.join(r['deps']) or '-'
            f = r['file']
            o.append(f"| {num[r['id']]} | [{r['id']}](steps/{f}#{r['id'].lower()}) | {cell(r['title'])} | "
                     f"[{f[:-3]}](steps/{f}) | {deps} | {r['size']} | {r['save']} |")
        o.append('')
    o += ['---', '']
    o.append(subprocess.check_output([sys.executable, 'coverage.py'], cwd=HERE, text=True).rstrip('\n'))
    o += ['', '## Appendix B: bible anchors cited by steps (the minimum each file must define)', '']
    anchors = subprocess.check_output([sys.executable, 'step-index-src.py', 'anchors'], cwd=HERE, text=True,
                                      stderr=subprocess.DEVNULL)
    o.append(anchors.rstrip('\n'))
    o += ['', 'Section 2 of this index also cites `atlas-home#passes` (the table of taken post-pass RNG constants) and '
          '`art-audio#style` (the style guide and prompt preamble).', '',
          'Every anchor is written as an explicit `<a id="..."></a>` immediately before its heading; S-001 adds '
          '`tests/docs.test.js`, which fails on a missing one.', '']
    open(OUT, 'w', encoding='utf-8').write('\n'.join(o))
    print(f'wrote {OUT}: {n_issues} steps, {len(M)} milestones')


main()
