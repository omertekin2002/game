# INDEX: Starseed Isle, "The Hundred-Year Letter"

The complete, ordered build of the 80-120 hour game, from `main` at `b79d73d` (save v6) to the full canon in
[`CANON.md`](CANON.md). Start with [`README.md`](README.md): it explains the target game and the protocol the plan and
implement jobs follow. This file is the step list they follow.

**Generated; never edit it by hand.** `sh tools/build-step-index.sh` rebuilds it from `tools/step-index-head.md` (the
text above the milestone overview), `tools/step-index-src.py` (milestone goals, entry and exit criteria, bible refs)
and the step files `steps/*.md`. Every row's id, title, dependencies, size and save come from the step file's own
`### S-xxx · <title>` heading and the `Milestone · Depends on · Size · Save` line under it, so a row can never drift
from its spec. `python3 tools/step-index-src.py check` fails on a missing section, a dependency that names no step,
or a cycle. A step file edit (a split, a new lettered step) is followed by a rebuild in the same PR.

**Order of authority.** [`CANON-NOW.md`](CANON-NOW.md) LOCKED items (what the shipped game already says) >
[`CANON.md`](CANON.md) > the reconciliation rows in `steps/*.md` (for the topics they name, until the named close-out
edits the losing file) > the game bible (`bible/*.md`) > this index > the issue. A step file's reconciliation table
deliberately overrides the bible file it names; any other contradiction between a step and the bible is a bug in the
step. "CANON §n" anywhere means numbered section n of `CANON.md`; "CANON-NOW section n" means `CANON-NOW.md`. Older
text that says `STEP-INDEX` means this file.

**Totals.** **{{ISSUES}} steps** in **{{MILESTONES}} milestones**, one `agent:improvement` issue each. They come from
{{ROWS}} planned rows (311 numbered steps plus lettered steps added in review, such as S-011b, S-078b, S-090b and
S-158a); the step files split oversize rows into lettered parts and add depth steps beside rows ({{SPLITS}} more
steps than rows), and every part has its own row below. 5 save bumps (v7-v11). 8 performance checkpoints. 15 art
brief batches. {{DUNGEON_ISSUES}} steps build the 15 dungeons and 24 Hollows (Appendix A). Every main quest ships with
its chapter test. At `maxStackedPerRepo = 8` that is about **{{MERGES}} umbrella merges**. Main story playable at the
end of M32, the true ending at M33, 100 % at M34. M35 is polish.

**Cadence.** One step per plan + implement cycle: one job per repo at a time, ordinary plan turns only when the
pipeline is empty across all repos (`maxPlansPerDay` 12, shared), and one owner umbrella merge every 8 stacked steps.
At that rate the build takes months; the order below is what keeps every release playable.

---

<a id="protocol"></a>

## 1. How the pipeline uses this index

The full protocol, with the issue template, is [README.md § The step protocol](README.md#plan-protocol). In short:

1. **One row = one step = one `agent:improvement` issue = one PR into `agent/improvements`.** The **#** column is the
   filing order. Each plan turn, after broken things (failing CI, bugs, security), the plan job files the row with the
   **lowest #** whose dependencies are all merged on `main` or stacked on `agent/improvements` and that has no issue
   yet (`gh issue list --repo omertekin2002/game --state all --search "S-xxx in:title"`). The # order is a topological
   order of the dependencies, so in normal running the next row is simply the next #. A row is never pulled past an
   act-card step (S-067, S-165a, S-165b, S-272, S-286a, S-286b): an act card ships only in the same release as the
   content behind it. A row whose dependencies are met may be filed out of order only when the lower rows are blocked,
   and only if no file or debug hook its text names is created by a step that is not yet stacked.
2. **Issue title** = the step heading after the id, then the id in brackets: `### S-029a · feat: …` → `feat: … (S-029a)`.
   Label `agent:improvement`. The id suffix lets every later plan turn find the step's issue by search; it replaces the
   "title verbatim" wording in the step files' intros.
3. **Issue body** = the step's `### S-xxx` section from `steps/<file>.md`, **pasted verbatim** (its `#### Why`,
   `#### What`, `#### Acceptance criteria`, `#### Verification plan`, `#### Out of scope` and `#### Risk & rollback`
   headings become `##`; the `#### Assets` block goes inside `## What`; the header line under the heading goes at the
   top of `## Why`). `## Why` starts with two lines: `Vision: #1 — **<milestone bold title>**` and
   `Roadmap: docs/roadmap/INDEX.md S-xxx`. The plan job never rebuilds a body from this index or the bible. A step that
   states a fact the bible states differently follows the order of authority above; a contradiction no reconciliation
   row covers goes in a 🤖 comment on the issue.
4. **Vision issue (#1).** Each milestone is one Roadmap item: `**Mxx · <title>**`, tag `[agent-feasible]`, and a
   `Work:` list. Filing a step adds its issue number to its milestone's `Work:` list (with `[partial]` until the
   milestone's last step is filed) and a Log line. **The roadmap is the vision's Direction, set by an Owner directive
   on 2026-11-21**, so choosing or shaping the next step needs no council: the steps are the plan. The council is only
   for product questions a step leaves open (§7).
5. **Close-out steps** (`chore: close Mxx`, or a `perf: checkpoint` that closes a milestone) do five things:
   - update `docs/DESIGN.md` and `docs/ARCHITECTURE.md` for what landed;
   - add a dated entry to `docs/roadmap/progress.md`: steps done, genMs, draw calls and tris at the milestone's
     views, precache size, save size, hours built vs CANON section 11;
   - write that milestone's art brief batch when one is scheduled;
   - run the full local suite once;
   - from S-078b on, run `node tools/hours.mjs` and record the **modelled** hours per bucket (main path per act,
     side stories, activities, exploration, dungeons) in the progress entry and the vision's "Where it is today";
     never copy the budget numbers of CANON section 11 or the overview below in their place.
6. **If a step proves too big** (more than about 500 changed lines, data included, or more than one session):
   - noticed by the plan job before filing: it files part `a` only (title `… (S-xxxa)`, the What cut to the first
     slice, the rest listed under `## Out of scope` as "part b");
   - noticed by the implementer: the PR ships part `a` and hands the rest back in a 🤖 comment.
   Either way, **the PR that ships part `a` also edits the step file**: it replaces the `### S-xxx` section with
   `### S-xxxa` and `### S-xxxb` sections (each with its own header line and six sections; `b` depends on `a`) and
   reruns `sh docs/roadmap/tools/build-step-index.sh`. The plan job then files part `b` as the next row. Ids are never
   renumbered, and a dependency on `S-xxx` means its last part.
7. **If a step proves impossible** (for example free sailing in S-198/S-199), use the fallback the bible names.
   For sailing that is chart stops, a switch built into S-199. Record the fallback in the vision Log.
8. **Filing order differs from numbering in these places** (ids stay as they are, so every link keeps working; the #
   column already encodes all of them):
   - **M05 is filed directly after M02.** After S-015 closes M02, the plan job files S-024, S-025, then S-032a-S-039
     (M05), and only then S-016 (M03). S-024 depends only on S-003 (its `normalize` is shape-only: it keeps any
     well-formed realm, item, quest or dungeon id and never consults a registry, so it needs no realm engine; S-021
     does the realm save and Continue), and S-025's `realm:<id>.visited` atom reads `S.realm` and simply never holds
     until realms exist. So the journal, Ask the Tree and scene replay ship around step 30 instead of step 45. The
     vision lists the M05 Roadmap item directly after M02's. S-031 (close M04) still documents S-024 and S-025.
   - **S-158a (Sledding with Frostbun)** is listed and filed in M07 as that milestone's player-visible step; S-158b
     (Spore Rally) stays in M18.
   - **Set-piece steps** S-106c, S-127c, S-127d and S-148c are filed between their land's `a` and `b` chain steps
     (after the people steps, before the beacon step that unhides the land). S-091b, S-203b, S-232c and S-254c land
     after their land is open. All of them add a `before` sub-objective to an existing quest step (the field S-091b
     adds to `js/quests.js`) instead of inserting a step, so every saved step index stays valid.
9. **Every milestone after M02 ships at least one player-visible step** (something a player of that release can see,
   hear or do that the previous release lacked). M03 and M04 have none of their own and are covered by the M05
   reorder (rule 8); M06's is S-046 (the Bestiary tab); M07's is S-158a; M08's is S-056a (Pip's Nook).

## 2. Invariants every issue restates (copy into Acceptance criteria)

- **Frozen home island.** `tests/fixtures/world-prints.json` stays byte-identical. New home content is a post-pass
  on its own `new RNG(7151 * k + c)` stream that follows the `placeShells` rules: nearest-walkable around a named
  anchor, nothing added to other lists, `W.walk / W.reach` restored, and a world test on seeds 1-40. The pass
  constants already taken are listed in `bible/atlas-home.md#passes`.
- **Frozen realms.** Every new realm's `tests/fixtures/realm-prints/<id>.json` is written in the PR that first
  generates it, and is refreshed only by later steps of the same build milestone. After the realm is unhidden,
  only post-passes may add to it.
- **Hidden until whole.** A realm stays `hidden: true` (reachable only through `?realm=` and `G.debug.realm`)
  until the step that ships its main quest. Unbuilt isles show as fog banks on the chart ("Nell won't risk the
  fog yet.").
- **One save slot.** Every schema change bumps `SAVE_VERSION`, adds `MIGRATIONS[n]`, adds tests from every older
  version, and keeps the `-bak` copy. No v6 field moves or changes meaning. New content ids are namespaced
  `<realm>:<id>`. Data that fits `flags`, `items`, `quests`, `collect` or the per-id maps never bumps the version
  (section 3).
- **Budgets per view, both cameras.**
  - Draw calls: main pass ≤ 200, total ≤ 300, hard cap 350.
  - Triangles: ≤ 1.3 M.
  - Frame rate: 60 fps target.
  - Far plane: 300 m with fog outdoors, 120 m in dungeons.
  - Realm generation: ≤ 1.2 s on desktop.
  - Content per realm: ≤ 24 instanced prop types and ≤ 12 new material programs.
  - Precache: core ≤ 30 MB; each realm bundle ≤ 2.5 MB without GLBs.
- **Assets.** Every manifest key has a procedural or canvas fallback and a `realm` tag when it belongs to one
  realm. `?noassets=all` must still render.
  - Painted art is generated inside the step that needs it. It is original, never imitating another game, and
    made in the soft painterly storybook style of `bible/art-audio.md#style`. It is processed with
    `tools/make_seamless.py`, `slice_sheet.py`, `process_strip.py` and `export_sprites.py`, and saved as webp.
  - 3D is code-built (js/models.js, props.js, toon.js) with an ART BRIEF in the PR.
  - **Pip's GLB is never replaced.**
- **Tone.** `bible/charter.md#tone`:
  - towns spawn no enemies, enemies poof, Pip gets dizzy, and Pip never hits Mote;
  - every attack is drawn at least 0.55 s ahead;
  - nothing earned is taken back, and nothing is missable;
  - lines are at most 220 characters, `~` appears only in Miso's speech, and Pip never speaks.
- **Original IP only.** Never copy another game's names, characters, art, levels or story.
- **Machine.** One heavy job at a time on the 12 GB machine: one browser, one full suite. `bun test` plus the
  step's in-page suite pass locally before the PR. CI stays green.

## 3. Save versions

**Every save-bump step depends on the previous save-bump step**, so no pull-forward or failed step can land
`MIGRATIONS[n]` before `MIGRATIONS[n-1]` exists: S-024 → S-003, S-071 → S-024, S-199 → S-071, S-233a → S-199. A
new bump added later follows the same rule.

| Version | Step | Adds | Why it cannot be a flag |
|---|---|---|---|
| v7 | S-003 | `flags {}` (true or finite number); a backup copy before any migration | the generic store every later step uses |
| v8 | S-024 | `realm {id}`, `items {}`, `quests {}`, `abilities {}`, `travel {}`, `bestiary {}`, `dungeons {}` | the containers ENGINE F7 defines; Continue into a saved realm |
| v9 | S-071 | `collect {acorn, bottle, log, petal, vista, fish, hollow, dash, dream}`; the `maxHp` clamp widens 20 → 32 | per-kind id maps for the 10 collectible kinds and tracker rows; an older build must refuse a 32-HP save, not clamp it |
| v10 | S-199 | `boat {realm, x, z, heading}` | the boat has a position, not a state |
| v11 | S-233 | `swordLevel` may be 3 (Starsteel) | `normalize` clamps to 2 today; widening the range is a schema change |

**Clamp-widening rule.** Any change that lets the save hold a value an older build's `normalize` would clamp or
drop is a schema change: it rides a `SAVE_VERSION` bump (its own, or the nearest earlier one in the plan), so an
older build refuses the save (`migrate` returns null for `v > SAVE_VERSION`) instead of silently losing progress.
So `maxHp` 20 → 32 rides v9 (S-071, not S-072), and `swordLevel` 1-3 rides v11 (S-233a). The one exception is a
consumable count that refills in play and records no progress: `potions` up to 5 (S-304) widens without a bump.

Everything else goes in flags (story beats, `seen:`, `thorn:`, letter phrases as numbers), in items (tools, key
items, furnishings, trims), in quests, or in the per-id maps that already exist: `chests`, `secrets`, `bosses`,
`plushies` and `rematches`, keyed `<realm>:<id>`. Expected save size at 100 % is 40-80 KB. S-196 checks it stays
under 80 KB.

## 4. Test infrastructure, in build order

| Step | What it adds |
|---|---|
| S-001 | `tests/docs.test.js`: every bible anchor in this index's Appendix B resolves to an explicit anchor, and every CANON / CANON-NOW section reference resolves (S-002a-c extend it to the bible's and the step files' links and run `step-index-src.py check`) |
| S-003 | v6 save fixture Continue in test:smoke; Act I save fixtures and debug hooks |
| S-022 | in-page `realm` suite plus CI job: leaks, spawns, palettes, draw and triangle budgets at 4 views per realm |
| S-025 | `tests/content.test.js` lint: ids, conditions, text, tokens, line length, manifest fallbacks |
| S-030 | `tests/chapter.mjs`: chapter playthroughs from save fixtures, one CI job per chapter group (`act1`, `act2a`, `act2b`, `act3`, `finale`, `post`), and the chain check |
| S-048 / S-049 | progression solver (realm graph) and dungeon lock-and-key solver, both in `bun test` |
| S-069 | Act I chapters ch1-ch6 in every seed order |
| S-078 | economy ledger: fixed sources ≥ 105 % of one-time sinks |
| S-078b | playtime model `tools/hours.mjs` + `tests/hours.test.js`: each act's modelled main path within ±20 % of CANON section 11; the full planned table models ≥ 90 h at 100 %; regenerates the overview's play columns |
| every land | realm prints, coverage test (every 40 × 40 m land cell), solver pass, realm-suite views, chapter test of its main quest |
| every dungeon / Hollow | compiler and solver (exit, boss door and every chest reachable; no soft-lock) |
| every boss | balance test: a careful bot wins ≥ 90 % in 45-90 s losing ≤ 3 hearts; a never-dodging bot wins ≤ 50 % |
| S-108 | progression solver over the whole graph: no sibling-tool dependency (pacing rule 6) |
| S-150 / S-256 | all six Act II isle orders and all six Stair Stone orders |
| S-310 | the chapter chain from New Game to the true ending; Completion reaches 100 % |

**Performance checkpoints:**

| Checkpoint | Step | What it measures |
|---|---|---|
| 1 | S-047 | combat and the journal on home |
| 2 | S-087 | the first overworld realm |
| 3 | S-109 | the land template |
| 4 | S-151 | four isles plus a swap soak |
| 5 | S-196 | mid-game soak and a full save |
| 6 | S-261 | ten realms plus the precache |
| 7 | S-287 | the finale |
| 8 | S-309 | final |

Each one measures the fixed views in both cameras, fixes what fails, and records the numbers in `progress.md`.

**Art brief batches** (briefs only, no generation, written to `docs/roadmap/briefs/batch-NN.md`): S-014, S-063,
S-079, S-094, S-109, S-116, S-137, S-159, S-173, S-197, S-221, S-242, S-261, S-279 and S-306. Each brief follows
`bible/art-audio.md#brief-template`:

- silhouette, size in m, palette hexes, materials, poly budget and pose;
- an image prompt and a 3D prompt;
- the manifest key and the code fallback it replaces.

The owner can then batch-generate painted GLBs and drop them in with no code change.

## 5. Step types and sizes

Types: `feat` (player-facing or system), `refactor` (behaviour-identical), `perf`, `test`, `docs`, `art` (asset
generation and wiring), `chore` (close-outs).

Sizes:
- **S**: up to about 250 changed lines including data.
- **M**: about 250-500 changed lines including data.

Nothing is L. Generated images, fixtures and lockfiles do not count toward the size. Dialogue-heavy steps keep
the code under 300 lines and put the text in `js/text/en/*.js` tables. If the table data pushes the PR past 500
lines, the implementer splits it (section 1.6).

## 6. Pacing check

**Hours are modelled by `tools/hours.mjs` (S-078b).** Until it lands, the "Play added" and "Cumulative play" columns
below are budgets copied from CANON section 11 and overstate what a milestone really adds (for example M13 budgets
+5 h for Pinewhistle, whose main path models at about 2 h plus about 1.5 h of finds and Hollows). S-078b regenerates
both columns from the model through `step-index-src.py`; from then on the close-out of each milestone records the
modelled hours, and the vision issue quotes the modelled figure, never the budget.

The milestone budgets in the overview were written before the 2026-11-22 playtime model and sum to about 94.5 h
plus about 10.5 h of cross-land exploration (the old 105 h). CANON section 11 now **models** the game at about 95 h
for 100 % (band 84-112) and 40 h for the main story, including the depth additions of CANON §11.1 (deeper dungeons,
real and Deep Hollows, one set piece per land, Mote's traces, present-day Mote, playable memories, longer act-closer
bosses). Pacing rules 1-8 (`CANON.md` section 12) are checked as follows:

- A tool arrives at least every 5 h of story: Lantern S-057, Glider S-102a, Tide Bell S-122a, Hook S-143a, Sunglass
  S-160, Paws S-181a, Starsong S-208, Sling S-227a, Gloves S-248a, Cloudstep S-268.
- Every land re-opens home finds through its tool step's post-pass.
- Every main quest step includes its chapter test.

## 7. Owner decisions and where they bite

| CANON section 15 | Decision | Default assumed | Must be settled before |
|---|---|---|---|
| 1 | load-bearing names (Wenna, Mote, Starkin, Lamplighters, six land names; Candlecove renamed **Duskwick**) | as in CANON | S-064 (first name on screen), at latest S-080 |
| 2 | Shellby wrote the bottle | yes | S-008 plants it; S-289 reveals it |
| 3 | heart cap **14** (6 petals per heart), two HUD rows of 7 | yes (the owner may restore 16) | S-072 |
| 4 | free sailing vs chart stops in the Glassway | free sailing, fallback built in | S-198 |
| 5 | fishing as one owned activity | yes | S-206 |
| 6 | hood trims tint the existing GLB | yes, after a side-by-side in the PR | S-303 |
| 7 | the Act I card rewrite | in S-067, with chapter 7 | S-067 |
| 8 | scope ({{ISSUES}} steps in {{MILESTONES}} milestones) | full build; M01-M02 alone already improve the shipped game | any milestone boundary |
| 9 | Pip's origin: drop the foundling-in-the-roots origin | drop | S-289 |
| 10 | item names: Digging Paws, Root Key, Chime Stone; the shipped Heart Container keeps its name | yes | S-052 |

**How decisions are settled.** The defaults in this table are the plan. The Owner directive that adopted the roadmap
(2026-11-21) accepts the CANON §15 defaults unless the vision's **Owner decisions** or **Owner directives** say
otherwise, so no step waits on the owner. If the owner later overrides a default, the override binds from the next
step filed, and the plan job records it in the vision Log. A product question a step leaves open (not one of these ten)
goes to the council (plan.md "The council"), never to an `agent:decision` issue (RUNBOOK: `agent:decision` is for
credentials, spending, irreversible or personal matters); if the council is unavailable, the implementer makes the
smallest reasonable call inside the step's scope and records it (README § implement protocol). Steps read a decision
from the vision's Owner decisions, Owner directives or a council record (S-199 item 6, S-302a, S-303 item 1), never
from a decision issue.

## 8. The game bible: `docs/roadmap/bible/` (12 files)

Each file has one owner topic, and the scopes do not overlap. If a fact could live in two files, it lives where
the **thing is defined**, and the other file links to it. Every anchor a step cites is an explicit
`<a id="..."></a>` placed immediately before its heading. Ids are case-sensitive; S-001's docs test enforces them.
The appendix lists every anchor the steps cite, which is the minimum each file must define.

| File | Scope (owns) | Does not own (links instead) |
|---|---|---|
| `charter.md` | The tone charter (Always / Never), voice rules, the UI verb list, naming and originality rules, the master glossary index (every proper name → the file that defines it), the invariants block of section 2, budgets, and the close-out checklist | any story, place or number specific to content |
| `lore.md` | Cosmology (Lantern Sky, Wide Blue, Rootdeep, Starkin, Lamplighters, Catchers, given light, the Spiral); the true timeline; Pip's origin; twists T1-T7; the **full texts** of the myth, the 12 Bottle Chain letters, the 30 Lamp Logs, Mote's 12 unsent letters, Dormy's 7 night stories, and the 12 memory scenes (staging, cast, lines) | beats and triggers (story.md), where items are placed (atlas files) |
| `story.md` | Acts, chapters 1-22 and every beat id (I.1-I.6, ch7-ch22, II.M, beacon-n, stone-beats); flags set; scene scripts in the scene-step format; the count-keyed line matrices (Shellby, Wenna's ~60 lines, villager reactions per act, memory lines); act cards; both endings; the save-built lantern chain | side stories (side-content.md), NPC descriptions (cast.md) |
| `cast.md` | ~50 named characters, each with: id, species, size m, palette hexes, look, verbal tic, home and spot per land, schedule, arc, the side stories they own (links), a portrait prompt and an ART BRIEF for the model; plus the young cast and the Catchers' post-Act I behaviour | bosses' combat (creatures.md), dialogue beats (story.md, side-content.md) |
| `atlas-home.md` | Starseed Isle only: every post-pass (constant, anchor, contents, when visible) with a `#passes` table of taken RNG constants; the Great Tree crown and boughs; the sky and horizon cards; the ~40 tool-gated home finds; home interiors (Nook, cottages, Puddle's Grotto, Library-free); home variants (Remembered Isle, Moonmere, Hundred-Year Night); home vistas, acorns, Village Works props | dungeon interiors under home (dungeons.md) |
| `atlas-isles.md` | Duskwick, Pinewhistle, Archwater, Threemills, Hoot's Margins, plus the shared Lamplighter kit. Per land: id, seed, grid, recipe, palette, regions and card subtitles, landmark, jetty and benches, root-gate, the POI list with coordinates or rules, keepsake texts, collectible placements and counts, enemy tables, interiors, music and ambience notes, prop kit with ART BRIEFs, and the 40 × 40 m coverage proof plan | dungeons (dungeons.md), creatures (creatures.md) |
| `atlas-far.md` | The Rootdeep, the Glassway (sail lanes, islets, tide), Kettle Isle, Saltglass Flats, Driftholm, the Starmeadow and the Crown, on the same per-land template; travel geography (chart, buoys, the Starstair) | travel systems (systems.md) |
| `dungeons.md` | The tile-map format and legend; the interior kit; puzzle entities; every dungeon d1-d11 and o1-o4: room-by-room tile maps, entity tables, keys, chest contents, signature mechanic, reward, solver notes and step split; the 24 Hollows; the Hundred Lamps floors | bosses fought inside (creatures.md) |
| `creatures.md` | The archetype framework and parameters; the 32 enemy species (archetype, HP, tells, numbers, model brief, bestiary text, spawn lands); the boss framework; every boss def (HP formula, moves, telegraphs, phases, arena, handover lines, plushie, rematch); Dreams; the finale encounter mechanics; the Jamboree | where they spawn geographically beyond the land tables (atlas files) |
| `systems.md` | Realms, portals and variants; the save plan; the condition and flag dictionary; dialogue, scenes, quests, journal and hints; items, tools, abilities and gate objects (with numbers); travel (chart, benches, root-gates, boat); beacons and crown lanterns; schedules; collectible kinds and counts; hearts; completion rows; the economy ledger; the test harness | content text (lore.md, story.md, side-content.md) |
| `side-content.md` | The 53 side stories (`ss-01` … `ss-53`: owner, unlock condition, steps, dialogue, reward, world mark, journal text); the 12 activities (`act-*`: owner, verbs, rules, tiers); Nook furnishings; plushies; Village Works projects | main beats (story.md) |
| `art-audio.md` | The style guide (`#style`) and image-prompt preamble; the processing pipeline; manifest key naming; per-realm asset lists with sizes, prompts and fallbacks; PWA bundle budgets; the ART BRIEF template; the index of owner GLB briefs; key art and loading cards; music tracks and ambience per realm as note data; SFX | character looks (cast.md), prop lists (atlas files) |

**Parallel writing.** The files can be written by up to 12 writers at once. Each writer starts from `CANON.md`
and `CANON-NOW.md` and adds new names to `charter.md`'s glossary index in the same pass. Sequencing matters in
two places:

- `story.md` and `lore.md` should be drafted before `side-content.md` references their beats.
- `atlas-*.md` and `creatures.md` must agree on the enemy tables. The atlas lists ids only; creatures.md defines
  them.

---

