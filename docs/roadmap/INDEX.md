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

**Totals.** **415 steps** in **35 milestones**, one `agent:improvement` issue each. They come from
325 planned rows (311 numbered steps plus lettered steps added in review, such as S-011b, S-078b, S-090b and
S-158a); the step files split oversize rows into lettered parts and add depth steps beside rows (90 more
steps than rows), and every part has its own row below. 5 save bumps (v7-v11). 8 performance checkpoints. 15 art
brief batches. 79 steps build the 15 dungeons and 24 Hollows (Appendix A). Every main quest ships with
its chapter test. At `maxStackedPerRepo = 8` that is about **52 umbrella merges**. Main story playable at the
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
| 8 | scope (415 steps in 35 milestones) | full build; M01-M02 alone already improve the shipped game | any milestone boundary |
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

---

<a id="overview"></a>

## Milestone overview

Milestones are listed by id; the # range shows where each sits in the filing order (M05 is filed before M03 and M04, §1.8). "Play added" is the milestone budget written before the 2026-11-22 playtime model; CANON §11 models the finished game at about 95 h for 100 % (band 84-112) and 40 h for the main story, and S-078b regenerates these columns from `tools/hours.mjs`.

| Milestone | Act | Title | Steps | # | Count | Step file | Play added | Cumulative play (h) |
|---|---|---|---|---|---|---|---|---|
| [M01](#m01) | I | Canon in the repo; the Catchers hand over | S-001 - S-007 | 1-9 | 9 | [M01-M04](steps/M01-M04.md) | +0.3 h (Act I 3.0 -> 3.3 h) | 3.3 |
| [M02](#m02) | I | Act I deepened | S-008 - S-015 | 10-18 | 9 | [M01-M04](steps/M01-M04.md) | +0.7 h (Act I -> 4.0 h) | 4.0 |
| [M03](#m03) | engine | Realm engine I: many lands, one at a time | S-016 - S-023 | 33-40 | 8 | [M01-M04](steps/M01-M04.md) | 0 h | 4.0 |
| [M04](#m04) | engine | Realm engine II: saves, conditions, portals, palettes, bundles, chapters | S-024 - S-031 | 19-47 | 9 | [M01-M04](steps/M01-M04.md) | 0 h | 4.0 |
| [M05](#m05) | engine | Story systems: dialogue, scenes, items, quests and Hoot's Field Notes | S-032a - S-039 | 21-32 | 12 | [M05-M08](steps/M05-M08.md) | 0 h (quality of life) | 4.0 |
| [M06](#m06) | engine | Combat frameworks: archetypes, bosses, bestiary | S-040 - S-047 | 48-55 | 8 | [M05-M08](steps/M05-M08.md) | 0 h | 4.0 |
| [M07](#m07) | engine | Abilities and the dungeon engine | S-048 - S-158a | 56-64 | 9 | [M05-M08](steps/M05-M08.md), [M18-M20](steps/M18-M20.md) | 0 h | 4.0 |
| [M08](#m08) | Interlude | The Interlude I: Pip's Nook and Under the Roots | S-056a - S-063 | 65-75 | 11 | [M05-M08](steps/M05-M08.md) | 0 h visible (+3 h built, shipped in M09) | 4.0 |
| [M09](#m09) | Interlude | The Interlude II: Wenna wakes (Act I's turn ships) | S-064 - S-070 | 76-83 | 8 | [M09-M12](steps/M09-M12.md) | +3 h (Interlude 2.0 h + home finds) | 7.0 |
| [M10](#m10) | II | Collections, hearts and the Completion page | S-071 - S-079 | 84-94 | 11 | [M09-M12](steps/M09-M12.md) | +1 h | 8.0 |
| [M11](#m11) | II | Travel and the Duskwick land | S-080 - S-087 | 95-105 | 11 | [M09-M12](steps/M09-M12.md) | 0 h visible | 8.0 |
| [M12](#m12) | II | Duskwick and chapter 8: Act II opens | S-088 - S-094 | 106-115 | 10 | [M09-M12](steps/M09-M12.md) | +2 h | 10.0 |
| [M13](#m13) | II | Pinewhistle: the first isle (land template) | S-095a - S-109 | 116-139 | 24 | [M13-M14](steps/M13-M14.md) | +5 h | 15.0 |
| [M14](#m14) | II | Pinewhistle side stories, Rook and the first home stories | S-110a - S-116 | 140-147 | 8 | [M13-M14](steps/M13-M14.md) | +3 h | 18.0 |
| [M15](#m15) | II | Archwater and the midpoint | S-117 - S-130 | 148-169 | 22 | [M15-M17](steps/M15-M17.md) | +4.5 h | 22.5 |
| [M16](#m16) | II | Archwater side stories and home households I | S-131a - S-137 | 170-178 | 9 | [M15-M17](steps/M15-M17.md) | +3.5 h | 26.0 |
| [M17](#m17) | II | Threemills; the Tower unlocks | S-138 - S-151 | 179-198 | 20 | [M15-M17](steps/M15-M17.md) | +4.5 h | 30.5 |
| [M18](#m18) | II | Threemills side stories and Village Works | S-152a - S-159 | 199-209 | 11 | [M18-M20](steps/M18-M20.md) | +3.5 h | 34.0 |
| [M19](#m19) | II | The Lamplighters' Tower and the end of Act II | S-160 - S-166 | 210-221 | 12 | [M18-M20](steps/M18-M20.md) | +4 h | 38.0 |
| [M20](#m20) | II | Act II aftercare: Duskwick stories, old beacons, Wenna and the Catchers | S-167a - S-173 | 222-230 | 9 | [M18-M20](steps/M18-M20.md) | +2.5 h | 40.5 |
| [M21](#m21) | III | The Rootdeep: the land, the Heart and Lumbra | S-174 - S-187 | 231-247 | 17 | [M21-M23](steps/M21-M23.md) | 0 h visible (+3.5 h shipped with chapter 13) | 40.5 |
| [M22](#m22) | III | The Remembered Isle, chapter 13 and Grumble's Undercap | S-188 - S-197 | 248-260 | 13 | [M21-M23](steps/M21-M23.md) | +6 h | 46.5 |
| [M23](#m23) | III | The Glassway I: sailing and Puffin Post | S-198 - S-205b | 261-271 | 11 | [M21-M23](steps/M21-M23.md) | +2 h | 48.5 |
| [M24](#m24) | III | The Glassway II: fishing, the Starsong and the Sunken Bell | S-206 - S-213 | 272-284 | 13 | [M24-M26](steps/M24-M26.md) | +5 h | 53.5 |
| [M25](#m25) | III | Glassway stories, the Merry Mabel and Moonmere | S-214a - S-221 | 285-296 | 12 | [M24-M26](steps/M24-M26.md) | +4 h | 57.5 |
| [M26](#m26) | III | Kettle Isle: the forge, the Belly and Starsteel | S-222 - S-235 | 297-317 | 21 | [M24-M26](steps/M24-M26.md) | +5 h | 62.5 |
| [M27](#m27) | III | Kettle stories, the Snowglobe and the parcel chain | S-236a - S-242 | 318-327 | 10 | [M27-M29](steps/M27-M29.md) | +4.5 h | 67.0 |
| [M28](#m28) | III | Saltglass Flats and the third stone | S-243 - S-257 | 328-349 | 22 | [M27-M29](steps/M27-M29.md) | +5 h | 72.0 |
| [M29](#m29) | III | Saltglass stories and the road to the sky | S-258a - S-261 | 350-354 | 5 | [M27-M29](steps/M27-M29.md) | +2 h | 74.0 |
| [M30](#m30) | III | The Starstair, Driftholm and the end of Act III | S-262 - S-273 | 355-368 | 14 | [M30-M33](steps/M30-M33.md) | +4.5 h | 78.5 |
| [M31](#m31) | IV | The Starmeadow | S-274 - S-279 | 369-377 | 9 | [M30-M33](steps/M30-M33.md) | +2 h | 80.5 |
| [M32](#m32) | IV | The Ladder of Lights, the Crown and the Second Sneeze | S-280 - S-287 | 378-386 | 9 | [M30-M33](steps/M30-M33.md) | +5.5 h | 86.0 |
| [M33](#m33) | post | The Hundred-Year Night and Guardian Dreams | S-288a - S-296 | 387-397 | 11 | [M30-M33](steps/M30-M33.md) | +4.5 h | 90.5 |
| [M34](#m34) | post | The Hundred Lamps, Hoot's Margins and the last gem sinks | S-297 - S-306 | 398-410 | 13 | [M34-M35](steps/M34-M35.md) | +4 h | 94.5 |
| [M35](#m35) | polish | Release polish: art refresh, final budgets and the 100 % audit | S-307 - S-311 | 411-415 | 5 | [M34-M35](steps/M34-M35.md) | 0 h (quality) | 94.5 |

**415 steps, 35 milestones.** Cumulative play starts from the 3 h the game has today.

---

<a id="m01"></a>

## M01 · Canon in the repo; the Catchers hand over

**Goal.** Put the roadmap and bible in the repo, add the generic flags map (save v7), and give the three guardians their kind reasons and sit-down handing-over scenes.

**Entry.** main at b79d73d, save v6, all CI green.

**Exit criteria (what the player can do).** The player sees each Catcher's reason beside its arena before the fight, and after the last hit the guardian sits down, explains, and hands the seed over; it stays talkable until the bloom. docs/roadmap/ holds the bible.

**Play added.** +0.3 h (Act I 3.0 -> 3.3 h) · **Steps** S-001 - S-007 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 1 | [S-001](steps/M01-M04.md#s-001) | docs: the roadmap index and the story bible live in docs/roadmap/ | [M01-M04](steps/M01-M04.md) | - | S | - |
| 2 | [S-002a](steps/M01-M04.md#s-002a) | docs: the rest of the game bible lands and DESIGN.md retires "No quest log" | [M01-M04](steps/M01-M04.md) | S-001 | S | - |
| 3 | [S-002b](steps/M01-M04.md#s-002b) | docs: the step specs for M01-M14 land in docs/roadmap/steps/ | [M01-M04](steps/M01-M04.md) | S-002a | S | - |
| 4 | [S-002c](steps/M01-M04.md#s-002c) | docs: the step specs for M15-M35 land, and the index regenerates from them | [M01-M04](steps/M01-M04.md) | S-002b | S | - |
| 5 | [S-003](steps/M01-M04.md#s-003) | feat: save v7 adds a generic flags map, backed up before any migration | [M01-M04](steps/M01-M04.md) | - | M | v6 -> v7 |
| 6 | [S-004](steps/M01-M04.md#s-004) | feat: the Catchers' kind reasons are visible beside their arenas | [M01-M04](steps/M01-M04.md) | S-003 | M | - |
| 7 | [S-005](steps/M01-M04.md#s-005) | feat: Grumble Shroom sits down and hands the Woods Starseed over | [M01-M04](steps/M01-M04.md) | S-003 | M | - |
| 8 | [S-006](steps/M01-M04.md#s-006) | feat: Captain Pinch and Frostbun hand over their Starseeds with their own reasons | [M01-M04](steps/M01-M04.md) | S-005 | S | - |
| 9 | [S-007](steps/M01-M04.md#s-007) | chore: close M01: DESIGN and ARCHITECTURE record the handover and the flags map | [M01-M04](steps/M01-M04.md) | S-006, S-004, S-002c | S | - |

<a id="m02"></a>

## M02 · Act I deepened

**Goal.** Finish phase P0: count-keyed myth instalments, blossoming boughs, music layers, healed regions, villager memory lines and thornvine caches. Still the shipped ending card.

**Entry.** M01 closed.

**Exit criteria (what the player can do).** Act I reads as a story: Shellby tells the myth in three instalments keyed to seeds home, a bough blossoms and a music layer joins per seed, each region heals visibly, villagers mention things this player did, and the Shiny Sword cuts four thornvine caches.

**Play added.** +0.7 h (Act I -> 4.0 h) · **Steps** S-008 - S-015 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 10 | [S-008](steps/M01-M04.md#s-008) | feat: Shellby tells the myth in count-keyed instalments | [M01-M04](steps/M01-M04.md) | S-003, S-005 | S | - |
| 11 | [S-009](steps/M01-M04.md#s-009) | feat: one bough of the Great Tree blossoms for each Starseed home | [M01-M04](steps/M01-M04.md) | S-003, S-005 | M | - |
| 12 | [S-010](steps/M01-M04.md#s-010) | feat: the village theme gains one instrument layer per Starseed home | [M01-M04](steps/M01-M04.md) | S-003, S-005, S-009 | S | - |
| 13 | [S-011](steps/M01-M04.md#s-011) | feat: each guardian's region heals visibly when its Starseed is placed | [M01-M04](steps/M01-M04.md) | S-004, S-009, S-005 | M | - |
| 14 | [S-011b](steps/M01-M04.md#s-011b) | feat: a moving light on the sky isle, from the first night | [M01-M04](steps/M01-M04.md) | S-003 | S | - |
| 15 | [S-012](steps/M01-M04.md#s-012) | feat: villagers remember specific things this player did | [M01-M04](steps/M01-M04.md) | S-003, S-005 | S | - |
| 16 | [S-013](steps/M01-M04.md#s-013) | feat: thornvine brambles the Shiny Sword cuts guard four small home caches | [M01-M04](steps/M01-M04.md) | S-003, S-004, S-005, S-009 | M | - |
| 17 | [S-014](steps/M01-M04.md#s-014) | docs: art brief batch 01 (Act I deepened) for the owner | [M01-M04](steps/M01-M04.md) | S-004, S-009, S-013, S-001 | S | - |
| 18 | [S-015](steps/M01-M04.md#s-015) | chore: close M02: Act I deepened is documented and asserted end to end | [M01-M04](steps/M01-M04.md) | S-008, S-010, S-011, S-012, S-013, S-014, S-001 | S | - |

<a id="m03"></a>

## M03 · Realm engine I: many lands, one at a time

**Goal.** ENGINE F1-F6: per-instance grid size, a realm registry with a debug sandbox, teardown and an in-page realm swap. Nothing player-visible.

**Entry.** M02 closed (or in parallel: these steps do not touch Act I content).

**Exit criteria (what the player can do).** A debug-only sandbox realm loads through `?realm=sandbox` and `G.debug.realm()`; home <-> sandbox swaps 3x with no leaks; home prints unchanged.

**Play added.** 0 h · **Steps** S-016 - S-023 (8)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 33 | [S-016](steps/M01-M04.md#s-016) | perf: post-passes share one walk+BFS and generation-only arrays are dropped | [M01-M04](steps/M01-M04.md) | S-004, S-013 | M | - |
| 34 | [S-017](steps/M01-M04.md#s-017) | refactor: the World reads its grid size from the instance, with alias-safe hash keys | [M01-M04](steps/M01-M04.md) | S-016 | M | - |
| 35 | [S-018](steps/M01-M04.md#s-018) | feat: realm registry, generateRealm and a 96 m debug sandbox realm | [M01-M04](steps/M01-M04.md) | S-017 | M | - |
| 36 | [S-019](steps/M01-M04.md#s-019) | refactor: terrain, water and scenery dispose and rebuild cleanly | [M01-M04](steps/M01-M04.md) | S-018 | M | - |
| 37 | [S-020](steps/M01-M04.md#s-020) | refactor: world-bound modules rebuild through an onWorld hook | [M01-M04](steps/M01-M04.md) | S-019, S-009 | M | - |
| 38 | [S-021](steps/M01-M04.md#s-021) | feat: in-page realm swap with fade, loading card and a resident parent realm | [M01-M04](steps/M01-M04.md) | S-020, S-024 | M | - |
| 39 | [S-022](steps/M01-M04.md#s-022) | test: an in-page realm suite and CI job gate every realm on leaks and budgets | [M01-M04](steps/M01-M04.md) | S-021 | M | - |
| 40 | [S-023](steps/M01-M04.md#s-023) | chore: close M03: ARCHITECTURE gains a "Realms" chapter | [M01-M04](steps/M01-M04.md) | S-022 | S | - |

<a id="m04"></a>

## M04 · Realm engine II: saves, conditions, portals, palettes, bundles, chapters

**Goal.** ENGINE F7-F12 and F28: the save holds realm and content state, content is gated by a tested condition language, portals exist, each realm has its own look and music and its own PWA bundle, and chapters are tested one by one.

**Entry.** M03 closed.

**Exit criteria (what the player can do).** A hidden portal post-pass exists on home; the sandbox has its own fog and music; Continue resumes in the saved realm; a sandbox "chapter" runs in CI. Players see no change.

**Play added.** 0 h · **Steps** S-024 - S-031 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 19 | [S-024](steps/M01-M04.md#s-024) | feat: save v8 adds realm position and generic content containers | [M01-M04](steps/M01-M04.md) | S-003 | M | v7 -> v8 |
| 20 | [S-025](steps/M01-M04.md#s-025) | feat: a condition and effect language with a content lint | [M01-M04](steps/M01-M04.md) | S-024 | M | - |
| 41 | [S-026](steps/M01-M04.md#s-026) | feat: portals and walk-in triggers, unlocked by flags, with a home post-pass | [M01-M04](steps/M01-M04.md) | S-021, S-025 | M | - |
| 42 | [S-027](steps/M01-M04.md#s-027) | feat: per-realm palette and region tables drive fog, sky, terrain and water | [M01-M04](steps/M01-M04.md) | S-021 | M | - |
| 43 | [S-028](steps/M01-M04.md#s-028) | feat: realms register their own music and ambience at load | [M01-M04](steps/M01-M04.md) | S-027 | S | - |
| 44 | [S-029a](steps/M01-M04.md#s-029a) | feat: realm assets load lazily from per-realm PWA bundles | [M01-M04](steps/M01-M04.md) | S-018, S-021 | M | - |
| 45 | [S-029b](steps/M01-M04.md#s-029b) | test: every manifest key is checked for its file, size limit, realm tag and fallback | [M01-M04](steps/M01-M04.md) | S-029a | S | - |
| 46 | [S-030](steps/M01-M04.md#s-030) | test: chapter playthroughs run from save fixtures, in grouped CI jobs | [M01-M04](steps/M01-M04.md) | S-021, S-024 | M | - |
| 47 | [S-031](steps/M01-M04.md#s-031) | chore: close M04: ARCHITECTURE documents saves, conditions, portals, palettes and bundles | [M01-M04](steps/M01-M04.md) | S-026, S-028, S-029b, S-030 | S | - |

<a id="m05"></a>

## M05 · Story systems: dialogue, scenes, items, quests and Hoot's Field Notes

**Goal.** ENGINE F13-F16 plus a scene-script runner and "Ask the Tree": everything a 100-hour story needs to be written as data and tracked in a journal.

**Entry.** M04 closed.

**Exit criteria (what the player can do).** Players get Hoot's Field Notes (L / pad map tab) with Quests, Items and Lore tabs; Act I and the two errands appear as quests; one-time scenes replay from Lore; "Ask the Tree" gives a nudge then a plain answer.

**Play added.** 0 h (quality of life) · **Steps** S-032a - S-039 (12)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 21 | [S-032a](steps/M05-M08.md#s-032a) | feat: text tables and t() with a content lint | [M05-M08](steps/M05-M08.md) | S-025 | M | - |
| 22 | [S-032b](steps/M05-M08.md#s-032b) | feat: data-driven dialogue with a fallback to lines(S) | [M05-M08](steps/M05-M08.md) | S-032a, S-025 | M | - |
| 23 | [S-033a](steps/M05-M08.md#s-033a) | refactor: Shellby, Ribbit and Miso speak from dialogue tables, word for word | [M05-M08](steps/M05-M08.md) | S-032b, S-008, S-012 | M | - |
| 24 | [S-033b](steps/M05-M08.md#s-033b) | refactor: Clover, Hoot, Digby and the villagers' memory lines move into dialogue tables, word for word | [M05-M08](steps/M05-M08.md) | S-033a | M | - |
| 25 | [S-034](steps/M05-M08.md#s-034) | feat: data-driven scene scripts with skip and replay | [M05-M08](steps/M05-M08.md) | S-032b, S-006 | M | - |
| 26 | [S-035](steps/M05-M08.md#s-035) | feat: items and key items, with a rebindable tool action | [M05-M08](steps/M05-M08.md) | S-025, S-032a | M | - |
| 27 | [S-036](steps/M05-M08.md#s-036) | feat: quests drive the objective line; Act I and the errands become quests | [M05-M08](steps/M05-M08.md) | S-032b, S-035 | M | - |
| 28 | [S-037a](steps/M05-M08.md#s-037a) | feat: Hoot's Field Notes opens with L, from the pause menu and the map card, with a Quests tab | [M05-M08](steps/M05-M08.md) | S-036 | M | - |
| 29 | [S-037b](steps/M05-M08.md#s-037b) | feat: the Items tab and the journal's painted icons and cover | [M05-M08](steps/M05-M08.md) | S-037a | M | - |
| 30 | [S-038a](steps/M05-M08.md#s-038a) | feat: the Lore tab lists the myth, the keepsakes and every scene, and replays scenes | [M05-M08](steps/M05-M08.md) | S-037a, S-034 | M | - |
| 31 | [S-038b](steps/M05-M08.md#s-038b) | feat: "Ask the Tree" gives a nudge, then the plain answer, for every quest step | [M05-M08](steps/M05-M08.md) | S-038a, S-036 | S | - |
| 32 | [S-039](steps/M05-M08.md#s-039) | chore: close M05: DESIGN replaces "No quest log" with the Field Notes chapter | [M05-M08](steps/M05-M08.md) | S-033b, S-038b | S | - |

<a id="m06"></a>

## M06 · Combat frameworks: archetypes, bosses, bestiary

**Goal.** ENGINE F17-F19 and F26: enemies and bosses become data plus small AI modules, so 32 species and 16 bosses can be added one PR at a time.

**Entry.** M05 closed (F17 has no deps and may be pulled earlier when the stack has room).

**Exit criteria (what the player can do).** Players see a Bestiary tab with painted cards for the six home enemies and the three guardians; combat is unchanged.

**Play added.** 0 h · **Steps** S-040 - S-047 (8)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 48 | [S-040](steps/M05-M08.md#s-040) | refactor: enemy AI moves into an archetype registry, behaviour unchanged | [M05-M08](steps/M05-M08.md) | - | M | - |
| 49 | [S-041](steps/M05-M08.md#s-041) | feat: burrower, shield, splitter and kiter archetypes | [M05-M08](steps/M05-M08.md) | S-040, S-018 | M | - |
| 50 | [S-042](steps/M05-M08.md#s-042) | feat: swarm, turret, mimic and ghost archetypes | [M05-M08](steps/M05-M08.md) | S-041 | M | - |
| 51 | [S-043](steps/M05-M08.md#s-043) | refactor: boss framework with defs, phases and a move runner; Grumble Shroom ported | [M05-M08](steps/M05-M08.md) | S-040 | M | - |
| 52 | [S-044](steps/M05-M08.md#s-044) | refactor: Captain Pinch and Frostbun ported; arenas come from realm anchors; HP scales by count | [M05-M08](steps/M05-M08.md) | S-043 | M | - |
| 53 | [S-045](steps/M05-M08.md#s-045) | feat: handover, plushie and Wake rematch are boss-def data for any boss | [M05-M08](steps/M05-M08.md) | S-044, S-034 | S | - |
| 54 | [S-046](steps/M05-M08.md#s-046) | feat: a Bestiary tab with seen and poofed counts and painted cards | [M05-M08](steps/M05-M08.md) | S-037a, S-040, S-043, S-029b | M | - |
| 55 | [S-047](steps/M05-M08.md#s-047) | perf: checkpoint 1: combat and journal budgets on home; close M06 | [M05-M08](steps/M05-M08.md) | S-046, S-045 | S | - |

<a id="m07"></a>

## M07 · Abilities and the dungeon engine

**Goal.** ENGINE F20-F23: abilities with gate objects and a progression solver, the dungeon compiler and solver, the dungeon realm recipe, an interior kit and puzzle entities.

**Entry.** M06 closed.

**Exit criteria (what the player can do).** A sandbox test dungeon and a test cottage interior run end to end headlessly; players see no change.

**Play added.** 0 h · **Steps** S-048 - S-158a (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 56 | [S-048](steps/M05-M08.md#s-048) | feat: abilities, world gate objects and a progression solver | [M05-M08](steps/M05-M08.md) | S-026, S-035 | M | - |
| 57 | [S-049](steps/M05-M08.md#s-049) | feat: a dungeon text-map compiler and lock-and-key solver | [M05-M08](steps/M05-M08.md) | - | M | - |
| 58 | [S-050](steps/M05-M08.md#s-050) | feat: dungeon realm recipe with room camera and light profile | [M05-M08](steps/M05-M08.md) | S-049, S-021, S-027 | M | - |
| 59 | [S-051](steps/M05-M08.md#s-051) | feat: an instanced interior prop kit with stone, brick and moss textures | [M05-M08](steps/M05-M08.md) | S-050, S-029b | M | - |
| 60 | [S-052](steps/M05-M08.md#s-052) | feat: puzzle entities I: doors, keys, locked and boss doors, plates, map and Chime Stone | [M05-M08](steps/M05-M08.md) | S-051, S-050, S-037b | M | - |
| 61 | [S-053](steps/M05-M08.md#s-053) | feat: puzzle entities II: crystal switches, push-blocks and a reset lever, saved | [M05-M08](steps/M05-M08.md) | S-052 | M | - |
| 62 | [S-054](steps/M05-M08.md#s-054) | feat: house doors can become portals into small interior realms | [M05-M08](steps/M05-M08.md) | S-050, S-026 | M | - |
| 63 | [S-055](steps/M05-M08.md#s-055) | chore: close M07: ARCHITECTURE gains the dungeon authoring guide | [M05-M08](steps/M05-M08.md) | S-048, S-053, S-054 | S | - |
| 64 | [S-158a](steps/M18-M20.md#s-158a) | feat: Sledding with Frostbun: a home activity on the Peaks with a plaza time board | [M18-M20](steps/M18-M20.md) | S-045 | M | - |

<a id="m08"></a>

## M08 · The Interlude I: Pip's Nook and Under the Roots

**Goal.** Build the first dungeon and its tool behind a hidden root door: Pip's Nook, the Glowbud Lantern, Dimlings, Under the Roots and Sir Rollo.

**Entry.** M07 closed.

**Exit criteria (what the player can do).** Under the Roots is complete and solver-proven but reachable only via `?realm=` until M09 opens the root door.

**Play added.** 0 h visible (+3 h built, shipped in M09) · **Steps** S-056a - S-063 (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 65 | [S-056a](steps/M05-M08.md#s-056a) | feat: Pip's Nook behind a root door in the Great Tree (hidden until Wenna wakes) | [M05-M08](steps/M05-M08.md) | S-054 | M | - |
| 66 | [S-056b](steps/M05-M08.md#s-056b) | feat: the Keepsake Hollow: forty-four niches, the home shelf and its plaque | [M05-M08](steps/M05-M08.md) | S-056a | M | - |
| 67 | [S-057](steps/M05-M08.md#s-057) | feat: the Glowbud Lantern lights 6 m, kindles things and reveals ghosts | [M05-M08](steps/M05-M08.md) | S-048, S-042, S-037b | M | - |
| 68 | [S-058](steps/M05-M08.md#s-058) | feat: Dimlings, the shy little lights of dark places | [M05-M08](steps/M05-M08.md) | S-057, S-046 | S | - |
| 69 | [S-059](steps/M05-M08.md#s-059) | feat: Under the Roots rooms 1-5: darkness, glowbud doors and wall-lanterns (hidden) | [M05-M08](steps/M05-M08.md) | S-056a, S-051, S-053 | M | - |
| 70 | [S-060](steps/M05-M08.md#s-060) | feat: Under the Roots rooms 6-9: the dark run, the Glow Pit, the Root Key and the boss door (hidden) | [M05-M08](steps/M05-M08.md) | S-059, S-058 | M | - |
| 71 | [S-060b](steps/M05-M08.md#s-060b) | feat: Under the Roots grows the Lamplighters' cellars: the Wick Wheel flip, the Root Key in the Oil Cellar (depth rule R14) | [M05-M08](steps/M05-M08.md) | S-060 | M | - |
| 72 | [S-061a](steps/M05-M08.md#s-061a) | feat: Sir Rollo, the pill-bug who rolls the tunnels flat: model, moves, sulk puzzle and handover | [M05-M08](steps/M05-M08.md) | S-060b, S-045 | M | - |
| 73 | [S-061b](steps/M05-M08.md#s-061b) | feat: Sir Rollo's plushie, Wake rematch, bestiary page and balance test | [M05-M08](steps/M05-M08.md) | S-061a, S-046 | S | - |
| 74 | [S-062](steps/M05-M08.md#s-062) | art: Under the Roots and Sir Rollo painted assets | [M05-M08](steps/M05-M08.md) | S-061a, S-029b | S | - |
| 75 | [S-063](steps/M05-M08.md#s-063) | chore: close M08: the first dungeon is documented with brief batch 02 | [M05-M08](steps/M05-M08.md) | S-062 | S | - |

<a id="m09"></a>

## M09 · The Interlude II: Wenna wakes (Act I's turn ships)

**Goal.** Wake the Tree, show the lights going out, bring Nell home, open the root door and the jetty, and turn the ending card into an act break, all in one release with the dungeon behind it.

**Entry.** M08 closed; owner decision 7 (act card rewrite) at its default.

**Exit criteria (what the player can do).** After the bloom, at dusk, Wenna speaks; the horizon lights go out; Nell comes home; Pip goes down through his Nook into Under the Roots, earns the Lantern, calms Sir Rollo and opens Nell's Jetty. The chart shows fog banks ("Nell won't risk the fog yet").

**Play added.** +3 h (Interlude 2.0 h + home finds) · **Steps** S-064 - S-070 (8)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 76 | [S-064](steps/M09-M12.md#s-064) | feat: horizon isle cards point at fixed bearings, with night windows and fog banks | [M09-M12](steps/M09-M12.md) | S-025 | M | - |
| 77 | [S-065](steps/M09-M12.md#s-065) | feat: Wenna speaks at the pedestal in a soft-gold frame with count-keyed lines | [M09-M12](steps/M09-M12.md) | S-032b, S-038b | M | - |
| 78 | [S-066](steps/M09-M12.md#s-066) | feat: I.6 Wenna Wakes: the lights go out and Nell comes home | [M09-M12](steps/M09-M12.md) | S-064, S-065, S-034, S-056b | M | - |
| 79 | [S-067](steps/M09-M12.md#s-067) | feat: chapter 7 Under the Roots: Wenna explains the beacons and the Lantern | [M09-M12](steps/M09-M12.md) | S-066, S-061b, S-036, S-030 | M | - |
| 80 | [S-068a](steps/M09-M12.md#s-068a) | feat: Nell Pelliwick is home: the bird rig, her look, portrait and lines | [M09-M12](steps/M09-M12.md) | S-067, S-030, S-033a | M | - |
| 81 | [S-068b](steps/M09-M12.md#s-068b) | feat: Nell's Jetty: Ribbit's speech, the moored Dandelion and a fog-bank chart | [M09-M12](steps/M09-M12.md) | S-068a, S-026, S-030 | M | - |
| 82 | [S-069](steps/M09-M12.md#s-069) | test: chapter tests ch1-ch6 cover Act I in any seed order | [M09-M12](steps/M09-M12.md) | S-067, S-030 | M | - |
| 83 | [S-070](steps/M09-M12.md#s-070) | chore: close M09: Act I + Interlude release notes, DESIGN gains the act structure | [M09-M12](steps/M09-M12.md) | S-069, S-068b, S-001 | S | - |

<a id="m10"></a>

## M10 · Collections, hearts and the Completion page

**Goal.** The collectible kinds the whole game uses get their save maps, homes and tracker rows before the first new land: heart petals and 14 hearts, Hollows, Lamp Logs, the Bottle Chain, Vistas, and completion v2.

**Entry.** M09 closed.

**Exit criteria (what the player can do).** On home the player can open two fairy-ring Hollows with the Lantern for heart petals, sketch 4 vistas for Hoot's Board, visit Puddle's Grotto, and read a per-land Completion page.

**Play added.** +1 h · **Steps** S-071 - S-079 (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 84 | [S-071](steps/M09-M12.md#s-071) | feat: save v9 adds collect maps for the new collectible kinds | [M09-M12](steps/M09-M12.md) | S-024, S-025 | S | v8 -> v9 |
| 85 | [S-072](steps/M09-M12.md#s-072) | feat: heart petals make a heart per six, and the HUD shows up to 14 hearts in two rows | [M09-M12](steps/M09-M12.md) | S-071 | M | - |
| 86 | [S-073](steps/M09-M12.md#s-073) | feat: Hollows: one-room puzzle caves behind spiral doors; two open on home | [M09-M12](steps/M09-M12.md) | S-071, S-057, S-053 | M | - |
| 87 | [S-074](steps/M09-M12.md#s-074) | feat: Completion v2: Field Notes groups rows by land from a generated stats file | [M09-M12](steps/M09-M12.md) | S-071, S-037b | M | - |
| 88 | [S-075a](steps/M09-M12.md#s-075a) | feat: Lamp Logs and the Bottle Chain are collectibles with letters and a Lore home | [M09-M12](steps/M09-M12.md) | S-071, S-038b | M | - |
| 89 | [S-075b](steps/M09-M12.md#s-075b) | feat: Pinch's Lighthouse opens, with the Bottle Chain shelf in the lamp room | [M09-M12](steps/M09-M12.md) | S-075a, S-054 | M | - |
| 90 | [S-076](steps/M09-M12.md#s-076) | feat: Vistas: sketch Hoot's spots and pin them to Hoot's Board | [M09-M12](steps/M09-M12.md) | S-071, S-074 | M | - |
| 91 | [S-077](steps/M09-M12.md#s-077) | feat: Puddle's Grotto under the well (side story 7) | [M09-M12](steps/M09-M12.md) | S-073, S-054, S-068a | M | - |
| 92 | [S-078](steps/M09-M12.md#s-078) | test: the economy ledger sums content tables and keeps sources ≥ 105 % of sinks | [M09-M12](steps/M09-M12.md) | S-074, S-076 | S | - |
| 93 | [S-078b](steps/M09-M12.md#s-078b) | test: a playtime model sums modelled hours from the content tables | [M09-M12](steps/M09-M12.md) | S-078, S-049, S-036 | M | - |
| 94 | [S-079](steps/M09-M12.md#s-079) | chore: close M10: collectibles chapter in DESIGN, brief batch 03 | [M09-M12](steps/M09-M12.md) | S-072, S-073, S-075b, S-076, S-077, S-078, S-078b, S-001 | S | - |

<a id="m11"></a>

## M11 · Travel and the Duskwick land

**Goal.** ENGINE F24 travel (chart, benches, fast travel, per-land map), chart sailing, a shared Lamplighter kit and the Duskwick overworld (hidden).

**Entry.** M10 closed; owner decision 1 (load-bearing names) answered or at its default.

**Exit criteria (what the player can do).** Duskwick generates, passes prints, solver and the 40 x 40 m coverage test, and is fully dressed, but stays hidden until M12.

**Play added.** 0 h visible · **Steps** S-080 - S-087 (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 95 | [S-080](steps/M09-M12.md#s-080) | feat: per-land map card, the Lamplighter's Chart, benches and fast travel | [M09-M12](steps/M09-M12.md) | S-021, S-026 | M | - |
| 96 | [S-081](steps/M09-M12.md#s-081) | feat: chart sailing on the Dandelion with a painted sailing card | [M09-M12](steps/M09-M12.md) | S-080, S-068b | M | - |
| 97 | [S-082a](steps/M09-M12.md#s-082a) | feat: Lamplighter kit I: the bench, the beacon and the spiral; home's five benches | [M09-M12](steps/M09-M12.md) | S-080, S-068b, S-074 | M | - |
| 98 | [S-082b](steps/M09-M12.md#s-082b) | feat: Lamplighter kit II: ruins, log niche, spiral door, root-gate, star-door stand-in and curios | [M09-M12](steps/M09-M12.md) | S-082a, S-068b | M | - |
| 99 | [S-083](steps/M09-M12.md#s-083) | feat: Duskwick lagoon recipe: terrain, Wickhaven's decks, regions and name cards (hidden) | [M09-M12](steps/M09-M12.md) | S-027, S-018 | M | - |
| 100 | [S-084a](steps/M09-M12.md#s-084a) | feat: Duskwick scatter kit: palms, coral, basalt, driftwood and hot-pool rims | [M09-M12](steps/M09-M12.md) | S-083, S-082a | M | - |
| 101 | [S-084b](steps/M09-M12.md#s-084b) | feat: Duskwick landmarks: the Lamplighters' Tower, the Wick Mast, the Chimneys, the Old Fan and the stilt town | [M09-M12](steps/M09-M12.md) | S-084a, S-082b | M | - |
| 102 | [S-085](steps/M09-M12.md#s-085) | art: Duskwick look: terrain layers, cards, loading card, map art and music | [M09-M12](steps/M09-M12.md) | S-083, S-029b, S-028 | M | - |
| 103 | [S-086a](steps/M09-M12.md#s-086a) | feat: Duskwick finds I: benches, chests, keepsakes, Hollow doors, the root-gate and tool gates | [M09-M12](steps/M09-M12.md) | S-084b, S-075a, S-076, S-074 | M | - |
| 104 | [S-086b](steps/M09-M12.md#s-086b) | feat: Duskwick finds II: acorns, vistas, the bottle, Lamp Logs, curios and the coverage test | [M09-M12](steps/M09-M12.md) | S-086a, S-074 | M | - |
| 105 | [S-087](steps/M09-M12.md#s-087) | perf: checkpoint 2: the first overworld realm meets every budget | [M09-M12](steps/M09-M12.md) | S-086b, S-085 | S | - |

<a id="m12"></a>

## M12 · Duskwick and chapter 8: Act II opens

**Goal.** People, enemies and the first sight of the Lamp Thief; chapter 8 unhides Duskwick and gives the Chart.

**Entry.** M11 closed.

**Exit criteria (what the player can do).** Pip sails to Duskwick, meets Granny Wick and the drowsy Wicklings, gets the Chart and Lamp Log 1, glimpses the Lamp Thief on the tower stair, and meets Kinako's Floating Bazaar. Pinewhistle, Archwater and Threemills show as fog banks until their lands ship.

**Play added.** +2 h · **Steps** S-088 - S-094 (10)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 106 | [S-088](steps/M09-M12.md#s-088) | feat: Wickhaven's people: Granny Wick, Flick and the drowsy Wicklings | [M09-M12](steps/M09-M12.md) | S-086b, S-032b, S-068a | M | - |
| 107 | [S-089](steps/M09-M12.md#s-089) | feat: Duskwick enemies: Sizzle Beetle and Coco Clonk | [M09-M12](steps/M09-M12.md) | S-042, S-086b | M | - |
| 108 | [S-090](steps/M09-M12.md#s-090) | feat: Mote's emissive figure and the Lamp Thief glimpse on the Tower stair | [M09-M12](steps/M09-M12.md) | S-034, S-084b | M | - |
| 109 | [S-090b](steps/M09-M12.md#s-090b) | feat: Mote's traces: a scrap lamp and a note signed M by each dark beacon | [M09-M12](steps/M09-M12.md) | S-090, S-034, S-038b | M | - |
| 110 | [S-091](steps/M09-M12.md#s-091) | feat: chapter 8 Duskwick: the Chart, Lamp Log 1 and the locked Tower; Duskwick opens | [M09-M12](steps/M09-M12.md) | S-088, S-090, S-081, S-030, S-037b | M | - |
| 111 | [S-091b](steps/M09-M12.md#s-091b) | feat: The Lamp Round: Pip relights Wickhaven's eight stilt lamps so the moths wake and Granny Wick's door opens | [M09-M12](steps/M09-M12.md) | S-091 | M | - |
| 112 | [S-092](steps/M09-M12.md#s-092) | feat: Kinako's Floating Bazaar docks at Duskwick | [M09-M12](steps/M09-M12.md) | S-091, S-078 | M | - |
| 113 | [S-093](steps/M09-M12.md#s-093) | feat: Duskwick's two Hollows | [M09-M12](steps/M09-M12.md) | S-073, S-086a, S-074 | S | - |
| 114 | [S-093b](steps/M09-M12.md#s-093b) | feat: Duskwick's Hollows get their second stage, and The Ember-Sand Hollow becomes a Deep Hollow | [M09-M12](steps/M09-M12.md) | S-093, S-090b | M | - |
| 115 | [S-094](steps/M09-M12.md#s-094) | chore: close M12: Act II opening documented, brief batch 04 | [M09-M12](steps/M09-M12.md) | S-091, S-091b, S-090b, S-092, S-093, S-089, S-001, S-093b | S | - |

<a id="m13"></a>

## M13 · Pinewhistle: the first isle (land template)

**Goal.** The land-template vertical slice: beacons and crown lanterns, the Pinewhistle overworld, its people and enemies, the Leaf Glider, Whistlehollow, Mossmantle and the full people -> depths -> Warden loop.

**Entry.** M12 closed.

**Exit criteria (what the player can do).** Pip sails to Pinewhistle, helps the Acornets, glides through Whistlehollow, calms Mossmantle and kindles the beacon: the pine sings, crown lantern 1 of 8 lights, Granny Wick reads Lamp Log 2, Hoot starts his star count, and the Glider reaches three new home finds.

**Play added.** +5 h · **Steps** S-095a - S-109 (24)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 116 | [S-095a](steps/M13-M14.md#s-095a) | feat: beacons can be kindled with the Glowbud Lantern | [M13-M14](steps/M13-M14.md) | S-082b, S-057, S-034, S-050 | M | - |
| 117 | [S-095b](steps/M13-M14.md#s-095b) | feat: eight crown lanterns on the Great Tree keep score, with the crown card and plaza visitors | [M13-M14](steps/M13-M14.md) | S-095a, S-009, S-068b | M | - |
| 118 | [S-096](steps/M13-M14.md#s-096) | feat: Pinewhistle ridges recipe: terrain, ravines, bridges, paths and regions (hidden) | [M13-M14](steps/M13-M14.md) | S-083 | M | - |
| 119 | [S-097a](steps/M13-M14.md#s-097a) | feat: Pinewhistle prop kit: pines, rope bridges, treehouses, mist and the shared kit pieces | [M13-M14](steps/M13-M14.md) | S-096, S-082b | M | - |
| 120 | [S-097b](steps/M13-M14.md#s-097b) | feat: Pinewhistle landmarks: the Whistling Pine, the Long Bridge Trestle, the sawmill and the Hoard Oak | [M13-M14](steps/M13-M14.md) | S-097a | M | - |
| 121 | [S-098](steps/M13-M14.md#s-098) | art: Pinewhistle look: terrain layers, cards, loading card, map art, music and ambience | [M13-M14](steps/M13-M14.md) | S-096, S-085, S-028, S-029b | M | - |
| 122 | [S-099a](steps/M13-M14.md#s-099a) | feat: Acornet Hollow's people stand in the isle: the rodent rig, looks and spots for Nutmeg, Pinfeather, the Acornets and the woodpeckers | [M13-M14](steps/M13-M14.md) | S-097b, S-068b | M | - |
| 123 | [S-099b](steps/M13-M14.md#s-099b) | feat: Acornet Hollow's people speak: dialogue, door lines and the first three steps of mq-pinewhistle | [M13-M14](steps/M13-M14.md) | S-099a, S-036 | M | - |
| 124 | [S-100](steps/M13-M14.md#s-100) | feat: Pinewhistle enemies: Mossling, Pinecone Puff, Bark Beetle and Needle Wasp | [M13-M14](steps/M13-M14.md) | S-041, S-097a | M | - |
| 125 | [S-101a](steps/M13-M14.md#s-101a) | feat: Pinewhistle finds I: chests, keepsakes, acorns, vistas, a bottle, Lamp Logs and benches | [M13-M14](steps/M13-M14.md) | S-097b, S-086b, S-075b, S-076, S-078 | M | - |
| 126 | [S-101b](steps/M13-M14.md#s-101b) | feat: Pinewhistle finds II: sites, curios, gate objects, Hollow doors, the root-gate and the coverage test | [M13-M14](steps/M13-M14.md) | S-101a, S-048 | M | - |
| 127 | [S-102a](steps/M13-M14.md#s-102a) | feat: the Leaf Glider: glide by holding Hop, ride updrafts | [M13-M14](steps/M13-M14.md) | S-048, S-095a, S-037b | M | - |
| 128 | [S-102b](steps/M13-M14.md#s-102b) | feat: three home glide finds: the Blossom Run, Tern Stack and the Old Stump | [M13-M14](steps/M13-M14.md) | S-102a, S-075b, S-056b, S-078 | M | - |
| 129 | [S-103](steps/M13-M14.md#s-103) | feat: Whistlehollow rooms 1-6: knot-hole updrafts switched by plates, and the Leaf Glider | [M13-M14](steps/M13-M14.md) | S-102a, S-053, S-097b | M | - |
| 130 | [S-104](steps/M13-M14.md#s-104) | feat: Whistlehollow rooms 7-12: gliding gaps, the Root Key and the climb to the Warden | [M13-M14](steps/M13-M14.md) | S-103 | M | - |
| 131 | [S-104b](steps/M13-M14.md#s-104b) | feat: Whistlehollow grows the Sap Galleries: three annex rooms, the sap flip and the Warden's latch (depth rule R14) | [M13-M14](steps/M13-M14.md) | S-104, S-060b | M | - |
| 132 | [S-105](steps/M13-M14.md#s-105) | feat: Mossmantle, the hoarse sloth who hummed the pine's song | [M13-M14](steps/M13-M14.md) | S-104, S-045, S-046, S-037b, S-104b | M | - |
| 133 | [S-106a](steps/M13-M14.md#s-106a) | feat: Pinewhistle's main chain: the jammed wheel, Mossy Span, the knot-hole score and the root door | [M13-M14](steps/M13-M14.md) | S-105, S-099b, S-101b | M | - |
| 134 | [S-106c](steps/M13-M14.md#s-106c) | feat: The Night Crossing: after Mossy Span, Pip follows the Acornets' whistles across misty Misthollow | [M13-M14](steps/M13-M14.md) | S-106a, S-091b, S-058 | M | - |
| 135 | [S-106b](steps/M13-M14.md#s-106b) | feat: the first beacon: the pine sings, a lantern lights in the crown, and Pinewhistle opens | [M13-M14](steps/M13-M14.md) | S-106a, S-106c, S-095b, S-030, S-074, S-098 | M | - |
| 136 | [S-107](steps/M13-M14.md#s-107) | feat: Pinewhistle's three Hollows: the Gap, the Knot-Clock and the Resin Block | [M13-M14](steps/M13-M14.md) | S-101b, S-073, S-102a, S-078 | M | - |
| 137 | [S-107b](steps/M13-M14.md#s-107b) | feat: Pinewhistle's Hollows get their second stage, and The Knot-Clock Hollow becomes a Deep Hollow | [M13-M14](steps/M13-M14.md) | S-107, S-090b | M | - |
| 138 | [S-108](steps/M13-M14.md#s-108) | test: the progression solver walks the whole realm graph in bun test | [M13-M14](steps/M13-M14.md) | S-106b, S-107 | S | - |
| 139 | [S-109](steps/M13-M14.md#s-109) | perf: checkpoint 3: the land template meets every budget; close M13 | [M13-M14](steps/M13-M14.md) | S-106b, S-107, S-108, S-001, S-104b, S-107b | S | - |

<a id="m14"></a>

## M14 · Pinewhistle side stories, Rook and the first home stories

**Goal.** Side content that makes Pinewhistle and home feel lived in: four Pinewhistle stories, Clover's Dash, Rook's Races, For Spring and The Long Nap.

**Entry.** M13 closed.

**Exit criteria (what the player can do).** Four Pinewhistle side stories, two Dash courses, Rook's first race, Digby's "For Spring" (part 1) and Grandpa Dormy's nightly stories are playable.

**Play added.** +3 h · **Steps** S-110a - S-116 (8)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 140 | [S-110a](steps/M13-M14.md#s-110a) | feat: side story 19 The Acorn Hoard, and the in-page `side` suite | [M13-M14](steps/M13-M14.md) | S-106b, S-078 | M | - |
| 141 | [S-110b](steps/M13-M14.md#s-110b) | feat: side story 20 Peer Review: Hoot's sabbatical on Pinewhistle | [M13-M14](steps/M13-M14.md) | S-110a, S-078 | M | - |
| 142 | [S-111](steps/M13-M14.md#s-111) | feat: side stories 21 Lost in the Mist and 22 The Sawmill Song | [M13-M14](steps/M13-M14.md) | S-106b, S-110b, S-078 | M | - |
| 143 | [S-112](steps/M13-M14.md#s-112) | feat: Clover's Dash: timed courses with tiered prizes, on home and Pinewhistle | [M13-M14](steps/M13-M14.md) | S-071, S-106b, S-078 | M | - |
| 144 | [S-113](steps/M13-M14.md#s-113) | feat: Rook the crow and Rook's Races part 1 | [M13-M14](steps/M13-M14.md) | S-112, S-078 | M | - |
| 145 | [S-114](steps/M13-M14.md#s-114) | feat: side story 1 For Spring, part 1: Digby's secret planting | [M13-M14](steps/M13-M14.md) | S-033b, S-034, S-078 | M | - |
| 146 | [S-115](steps/M13-M14.md#s-115) | feat: side story 2 The Long Nap: Grandpa Dormy's cottage and one story a night | [M13-M14](steps/M13-M14.md) | S-054, S-032b, S-099a, S-033a, S-078 | M | - |
| 147 | [S-116](steps/M13-M14.md#s-116) | chore: close M14: brief batch 06, side-story rules in DESIGN, progress | [M13-M14](steps/M13-M14.md) | S-110a, S-110b, S-111, S-112, S-113, S-114, S-115, S-001 | S | - |

<a id="m15"></a>

## M15 · Archwater and the midpoint

**Goal.** The second isle from the template, with a two-state tide, the Tide Bell, Undertow Grotto and Old Gloop; II.M lands with whichever beacon is relit second.

**Entry.** M14 closed.

**Exit criteria (what the player can do).** Archwater is playable start to finish; the tide turns; the Storm Cave and two tide caches open on home; on the second beacon Mote lands, names himself, and every villager reacts.

**Play added.** +4.5 h · **Steps** S-117 - S-130 (22)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 148 | [S-117](steps/M15-M17.md#s-117) | feat: Archwater basalt recipe with a two-state tide (hidden) | [M15-M17](steps/M15-M17.md) | S-096 | M | - |
| 149 | [S-118a](steps/M15-M17.md#s-118a) | feat: Archwater prop kit: basalt columns, kelp, tide pools, floats and the shared kit pieces | [M15-M17](steps/M15-M17.md) | S-117, S-082b | M | - |
| 150 | [S-118b](steps/M15-M17.md#s-118b) | feat: Archwater landmarks: the Great Arch, the Watch Column, the Spouter, the Raft and Rafferty's Mast | [M15-M17](steps/M15-M17.md) | S-118a | M | - |
| 151 | [S-119](steps/M15-M17.md#s-119) | art: Archwater look: terrain layers, cards, loading card, map art and music | [M15-M17](steps/M15-M17.md) | S-117, S-098 | M | - |
| 152 | [S-120a](steps/M15-M17.md#s-120a) | feat: the Raft's people I: the otter rig, seven looks, spots and Rafferty's portrait | [M15-M17](steps/M15-M17.md) | S-118b, S-029b, S-068a | M | - |
| 153 | [S-120b](steps/M15-M17.md#s-120b) | feat: the Raft's people II: Rafferty's chain lines, the rafters' talk, knock lines and the mq-archwater quest data | [M15-M17](steps/M15-M17.md) | S-120a | M | - |
| 154 | [S-121](steps/M15-M17.md#s-121) | feat: Archwater enemies: Tidepool Jelly, Squirt Urchin and Sand Snapper | [M15-M17](steps/M15-M17.md) | S-042, S-118b | M | - |
| 155 | [S-122a](steps/M15-M17.md#s-122a) | feat: the Tide Bell rings tide stones; the water moves and lifts Pip; Archwater's and Duskwick's tide stones | [M15-M17](steps/M15-M17.md) | S-048, S-117, S-037b | M | - |
| 156 | [S-122b](steps/M15-M17.md#s-122b) | feat: the Storm Cave and two rock-pool caches open on home with the Tide Bell | [M15-M17](steps/M15-M17.md) | S-122a | M | - |
| 157 | [S-123](steps/M15-M17.md#s-123) | feat: Archwater finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches | [M15-M17](steps/M15-M17.md) | S-118b, S-122a, S-086b | M | - |
| 158 | [S-124](steps/M15-M17.md#s-124) | feat: the Undertow Grotto rooms 1-7: rooms that flip between two water levels | [M15-M17](steps/M15-M17.md) | S-122a, S-053 | M | - |
| 159 | [S-125](steps/M15-M17.md#s-125) | feat: the Undertow Grotto rooms 8-14: the Tide Bell, tide stones and the way to Old Gloop | [M15-M17](steps/M15-M17.md) | S-124 | M | - |
| 160 | [S-125b](steps/M15-M17.md#s-125b) | feat: Undertow Grotto grows the Sluice Hall and the Sluice-Keeper's Cell: basins B and C become one (depth rule R14) | [M15-M17](steps/M15-M17.md) | S-125, S-060b, S-104b | M | - |
| 161 | [S-126](steps/M15-M17.md#s-126) | feat: Old Gloop, the octopus holding the sea still | [M15-M17](steps/M15-M17.md) | S-125, S-045, S-125b | M | - |
| 162 | [S-127a](steps/M15-M17.md#s-127a) | feat: Archwater's chain on the ground: Rafferty, three pearls and the Undertow door | [M15-M17](steps/M15-M17.md) | S-120b, S-123, S-125, S-037b | M | - |
| 163 | [S-127c](steps/M15-M17.md#s-127c) | feat: Floating the Raft: three winch points round the beached Raft, worked under Squirt Urchin fire | [M15-M17](steps/M15-M17.md) | S-127a, S-121, S-091b | M | - |
| 164 | [S-127d](steps/M15-M17.md#s-127d) | feat: the Undertow's upper rooms open early and exit onto the Tidepool Shelf | [M15-M17](steps/M15-M17.md) | S-127c, S-124 | M | - |
| 165 | [S-127b](steps/M15-M17.md#s-127b) | feat: Archwater's beacon: the tide turns; Archwater opens | [M15-M17](steps/M15-M17.md) | S-127a, S-127c, S-127d, S-126, S-095b, S-030, S-119 | M | - |
| 166 | [S-128](steps/M15-M17.md#s-128) | feat: II.M: the Lamp Thief lands on the second beacon and names himself Mote | [M15-M17](steps/M15-M17.md) | S-127b, S-106b, S-090, S-030, S-033a | M | - |
| 167 | [S-129](steps/M15-M17.md#s-129) | feat: Archwater's three Hollows | [M15-M17](steps/M15-M17.md) | S-123, S-073, S-107 | M | - |
| 168 | [S-129b](steps/M15-M17.md#s-129b) | feat: Archwater's Hollows get their second stage, and The Mirror Pool Hollow becomes a Deep Hollow | [M15-M17](steps/M15-M17.md) | S-129, S-090b | M | - |
| 169 | [S-130](steps/M15-M17.md#s-130) | chore: close M15: the midpoint is documented | [M15-M17](steps/M15-M17.md) | S-128, S-129, S-001, S-125b, S-129b | S | - |

<a id="m16"></a>

## M16 · Archwater side stories and home households I

**Goal.** Four Archwater side stories, two more activities, and three home households open their doors.

**Entry.** M15 closed.

**Exit criteria (what the player can do).** Clover gets safely lost in Archwater, the Raft choir sings, Old Gloop finds his sock (on Frostbun), the Moon Pool reflects; Gloop's Juggling and Lagoon Lights run; Granny Mochi, Hazel and the Quackenbushes have stories.

**Play added.** +3.5 h · **Steps** S-131a - S-137 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 170 | [S-131a](steps/M15-M17.md#s-131a) | feat: side story 23 Clover's Map: chalk arrows on Archwater | [M15-M17](steps/M15-M17.md) | S-127b | M | - |
| 171 | [S-131b](steps/M15-M17.md#s-131b) | feat: side story 24 The Raft Choir, and the Raft cabins interior | [M15-M17](steps/M15-M17.md) | S-131a | M | - |
| 172 | [S-132](steps/M15-M17.md#s-132) | feat: side stories 25 Eight Socks and 26 The Moon Pool | [M15-M17](steps/M15-M17.md) | S-127b, S-126 | M | - |
| 173 | [S-133a](steps/M15-M17.md#s-133a) | feat: Gloop's Juggling and Lagoon Lights | [M15-M17](steps/M15-M17.md) | S-126, S-127b, S-088 | M | - |
| 174 | [S-133b](steps/M15-M17.md#s-133b) | feat: Clover's Dash on Duskwick and Archwater, and Rook's Races part 2 | [M15-M17](steps/M15-M17.md) | S-112, S-113, S-127b | M | - |
| 175 | [S-134](steps/M15-M17.md#s-134) | feat: side story 3 Nothing Is Refundable, part 1: Granny Mochi's cottage | [M15-M17](steps/M15-M17.md) | S-092, S-054 | M | - |
| 176 | [S-135](steps/M15-M17.md#s-135) | feat: side story 5 A Bun for Every Isle: Hazel's bakery and buns | [M15-M17](steps/M15-M17.md) | S-054, S-035, S-078 | M | - |
| 177 | [S-136](steps/M15-M17.md#s-136) | feat: side story 6 The Duck Regatta with the Quackenbushes | [M15-M17](steps/M15-M17.md) | S-112, S-068b | M | - |
| 178 | [S-137](steps/M15-M17.md#s-137) | chore: close M16: brief batch 07 | [M15-M17](steps/M15-M17.md) | S-131a, S-131b, S-132, S-133a, S-133b, S-134, S-135, S-136, S-001 | S | - |

<a id="m17"></a>

## M17 · Threemills; the Tower unlocks

**Goal.** The third isle from the template, with the Thistle Hook, the Granary Vaults and Lady Honksworth; the third beacon unlocks the Lamplighters' Tower.

**Entry.** M16 closed.

**Exit criteria (what the player can do).** All three Act II isles are playable in any order; the Hook reaches three home finds; after the third beacon Granny Wick says the old lamp can wake and the Tower door opens.

**Play added.** +4.5 h · **Steps** S-138 - S-151 (20)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 179 | [S-138](steps/M15-M17.md#s-138) | feat: Threemills downs recipe: farmland, hedgerows, millpond (hidden) | [M15-M17](steps/M15-M17.md) | S-117 | M | - |
| 180 | [S-139a](steps/M15-M17.md#s-139a) | feat: Threemills prop kit: hedgerows, wheat, orchards, haystacks and Haybury's cottages | [M15-M17](steps/M15-M17.md) | S-138, S-082b | M | - |
| 181 | [S-139b](steps/M15-M17.md#s-139b) | feat: Threemills landmarks: Tansy, Thrift and Middle Mill, the Granary, the barn, the Grandmother Apple and the Marsh Lamp | [M15-M17](steps/M15-M17.md) | S-139a | M | - |
| 182 | [S-140](steps/M15-M17.md#s-140) | art: Threemills look: terrain layers, cards, loading card, map art and music | [M15-M17](steps/M15-M17.md) | S-138, S-029b | M | - |
| 183 | [S-141](steps/M15-M17.md#s-141) | feat: Haybury's people: the Hayburys, Goody Gander and Pennywhistle | [M15-M17](steps/M15-M17.md) | S-139b | M | - |
| 184 | [S-142](steps/M15-M17.md#s-142) | feat: Threemills enemies: Field Vole gang, Scarecrowlet and Woolly Ram | [M15-M17](steps/M15-M17.md) | S-042, S-139b | M | - |
| 185 | [S-143a](steps/M15-M17.md#s-143a) | feat: the Thistle Hook grapples to hookblooms; three isle finds reopen | [M15-M17](steps/M15-M17.md) | S-048, S-138, S-123, S-037b | M | - |
| 186 | [S-143b](steps/M15-M17.md#s-143b) | feat: three home hook finds: the Stairfoot route, the Cap Ledge and the Gull's Nest | [M15-M17](steps/M15-M17.md) | S-143a, S-102b | M | - |
| 187 | [S-144](steps/M15-M17.md#s-144) | feat: Threemills finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches | [M15-M17](steps/M15-M17.md) | S-139b, S-141, S-143a, S-086b | M | - |
| 188 | [S-145](steps/M15-M17.md#s-145) | feat: the Granary Vaults rooms 1-6: hay-bale blocks and gear bridges | [M15-M17](steps/M15-M17.md) | S-143a, S-053, S-142 | M | - |
| 189 | [S-146](steps/M15-M17.md#s-146) | feat: the Granary Vaults rooms 7-12: the Thistle Hook and the way to the Warden | [M15-M17](steps/M15-M17.md) | S-145 | M | - |
| 190 | [S-146b](steps/M15-M17.md#s-146b) | feat: The Granary Vaults grow the Thresher Loft, the Brake Room and the Miller's Cupboard: the gears turn by themselves (depth rule R14) | [M15-M17](steps/M15-M17.md) | S-146, S-060b, S-104b | M | - |
| 191 | [S-147](steps/M15-M17.md#s-147) | feat: Lady Honksworth, the exhausted goose who flapped the mill sails by hand | [M15-M17](steps/M15-M17.md) | S-146, S-045, S-146b | M | - |
| 192 | [S-148a](steps/M15-M17.md#s-148a) | feat: Threemills' chain on the ground: the vole gang, the Old Sluice and the hoist | [M15-M17](steps/M15-M17.md) | S-141, S-142, S-144, S-146 | M | - |
| 193 | [S-148c](steps/M15-M17.md#s-148c) | feat: Follow the Honks: trail Lady Honksworth across the hedgerows to the vault entrance | [M15-M17](steps/M15-M17.md) | S-148a, S-091b | M | - |
| 194 | [S-148b](steps/M15-M17.md#s-148b) | feat: Threemills' beacon: the sails turn; Threemills opens; the Tower unlocks | [M15-M17](steps/M15-M17.md) | S-148a, S-148c, S-147, S-095b, S-128, S-030 | M | - |
| 195 | [S-149](steps/M15-M17.md#s-149) | feat: Threemills' three Hollows | [M15-M17](steps/M15-M17.md) | S-144, S-073, S-145, S-107 | M | - |
| 196 | [S-149b](steps/M15-M17.md#s-149b) | feat: Threemills's Hollows get their second stage, and The Millwheel Hollow becomes a Deep Hollow | [M15-M17](steps/M15-M17.md) | S-149, S-090b | M | - |
| 197 | [S-150](steps/M15-M17.md#s-150) | test: all six Act II isle orders reach the Tower | [M15-M17](steps/M15-M17.md) | S-148b, S-108, S-030 | S | - |
| 198 | [S-151](steps/M15-M17.md#s-151) | perf: checkpoint 4: four isles, save size and swap soak; close Threemills | [M15-M17](steps/M15-M17.md) | S-148b, S-149, S-150, S-001, S-146b, S-149b | S | - |

<a id="m18"></a>

## M18 · Threemills side stories and Village Works

**Goal.** Four Threemills side stories, Ribbit's Village Works, two home households, and the home activities.

**Entry.** M17 closed.

**Exit criteria (what the player can do).** Pennywhistle wants a crow friend (Rook obliges), Ribbit sails to Middle Mill, a Thistledown kit stows away, Village Works projects can be funded, Spore Rally and Sledding run.

**Play added.** +3.5 h · **Steps** S-152a - S-159 (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 199 | [S-152a](steps/M18-M20.md#s-152a) | feat: side story 27 Your Honkship, and NPC guides that walk ahead | [M18-M20](steps/M18-M20.md) | S-148b, S-078 | M | - |
| 200 | [S-152b](steps/M18-M20.md#s-152b) | feat: side story 28 Scarecrow Hats | [M18-M20](steps/M18-M20.md) | S-152a | M | - |
| 201 | [S-153a](steps/M18-M20.md#s-153a) | feat: side story 29 The Scarecrow Who Wanted Crows | [M18-M20](steps/M18-M20.md) | S-148b, S-113 | M | - |
| 202 | [S-153b](steps/M18-M20.md#s-153b) | feat: side story 30 Pie Rations | [M18-M20](steps/M18-M20.md) | S-153a, S-148b | M | - |
| 203 | [S-154](steps/M18-M20.md#s-154) | feat: Harvest Cut, Dash on Threemills and Rook's race part 3 | [M18-M20](steps/M18-M20.md) | S-133b, S-148b | M | - |
| 204 | [S-155](steps/M18-M20.md#s-155) | feat: side story 4 The Mayor Goes to Sea: Ribbit's speech on Middle Mill | [M18-M20](steps/M18-M20.md) | S-148b | M | - |
| 205 | [S-156](steps/M18-M20.md#s-156) | feat: side story 8 Little Thistledown: Primrose's cottage and a stowaway kit | [M18-M20](steps/M18-M20.md) | S-054, S-091, S-155 | M | - |
| 206 | [S-157a](steps/M18-M20.md#s-157a) | feat: Village Works: Ribbit's board and the first four projects (clock, bandstand, duck dock, footbridge) | [M18-M20](steps/M18-M20.md) | S-078 | M | - |
| 207 | [S-157b](steps/M18-M20.md#s-157b) | feat: Village Works: the lamp walk, the festival stage, flower boxes and Wenna's swing | [M18-M20](steps/M18-M20.md) | S-157a | M | - |
| 208 | [S-158b](steps/M18-M20.md#s-158b) | feat: Spore Rally with Grumble Shroom | [M18-M20](steps/M18-M20.md) | S-045, S-158a, S-072 | M | - |
| 209 | [S-159](steps/M18-M20.md#s-159) | chore: close M18: brief batch 08 | [M18-M20](steps/M18-M20.md) | S-152a, S-152b, S-153a, S-153b, S-154, S-155, S-156, S-157a, S-157b, S-158b, S-001 | S | - |

<a id="m19"></a>

## M19 · The Lamplighters' Tower and the end of Act II

**Goal.** The Sunglass, Sleeping Acorns everywhere, the Tower dungeon, the Wickwork Moth and Mote taking the Firstlight.

**Entry.** M18 closed.

**Exit criteria (what the player can do).** Pip climbs the Tower, earns the Sunglass and a heart container, calms the Wickwork Moth and kindles the Firstlight; Mote takes it; a ladder of lights hangs in the north-east sky; "End of Act Two". Sleeping Acorns can be woken on every shipped land.

**Play added.** +4 h · **Steps** S-160 - S-166 (12)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 210 | [S-160](steps/M18-M20.md#s-160) | feat: the Sunglass aims a light beam at receivers | [M18-M20](steps/M18-M20.md) | S-048, S-057 | M | - |
| 211 | [S-161a](steps/M18-M20.md#s-161a) | feat: Sleeping Acorns wake with the Sunglass and grow saplings on every shipped land | [M18-M20](steps/M18-M20.md) | S-160, S-071, S-074 | M | - |
| 212 | [S-161b](steps/M18-M20.md#s-161b) | feat: every 25 acorns carves a ring on the Great Tree, with Wenna's thanks and a new thing at Miso's | [M18-M20](steps/M18-M20.md) | S-161a, S-054 | M | - |
| 213 | [S-161c](steps/M18-M20.md#s-161c) | feat: Digby's Acorn Ear chimes near sleeping acorns, and Completion names the regions where the last ones are | [M18-M20](steps/M18-M20.md) | S-161a, S-074, S-033a | M | - |
| 214 | [S-162a](steps/M18-M20.md#s-162a) | feat: dungeon light beams: skylight sources, turning mirrors, receivers, latches and lit hatches, with solver support | [M18-M20](steps/M18-M20.md) | S-160, S-053 | M | - |
| 215 | [S-162b](steps/M18-M20.md#s-162b) | feat: the Lamplighters' Tower floors 1-3: mirrors, the skylight beam and the Sunglass (hidden) | [M18-M20](steps/M18-M20.md) | S-162a | M | - |
| 216 | [S-163](steps/M18-M20.md#s-163) | feat: the Lamplighters' Tower floors 4-5 and the lamp room | [M18-M20](steps/M18-M20.md) | S-162b, S-090b | M | - |
| 217 | [S-163b](steps/M18-M20.md#s-163b) | feat: The Lamplighters' Tower grows the Lens Store, the Shutter Room and the Keeper's Cupboard: a floor goes dark (depth rule R14) | [M18-M20](steps/M18-M20.md) | S-163, S-060b, S-104b | M | - |
| 218 | [S-164](steps/M18-M20.md#s-164) | feat: the Wickwork Moth, the brass guardian of the great lamp | [M18-M20](steps/M18-M20.md) | S-163, S-045, S-163b | M | - |
| 219 | [S-165a](steps/M18-M20.md#s-165a) | feat: chapter 12: the Firstlight is kindled and Mote takes it; End of Act Two | [M18-M20](steps/M18-M20.md) | S-164, S-091, S-148b, S-030 | M | - |
| 220 | [S-165b](steps/M18-M20.md#s-165b) | feat: the small sneeze at home, the Act II card painting and the bridge to chapter 13 | [M18-M20](steps/M18-M20.md) | S-165a, S-030 | S | - |
| 221 | [S-166](steps/M18-M20.md#s-166) | chore: close M19: Act II release notes and DESIGN | [M18-M20](steps/M18-M20.md) | S-165b, S-161b, S-161c, S-001, S-163b | S | - |

<a id="m20"></a>

## M20 · Act II aftercare: Duskwick stories, old beacons, Wenna and the Catchers

**Goal.** Duskwick's four side stories, the four old Lamplighter beacons on home, Catchers in the plaza and Wenna's Act II lines.

**Entry.** M19 closed.

**Exit criteria (what the player can do).** Granny Wick's Library fills with Lamp Logs, Flick builds a clockwork, Kinako sells an ordinary spoon, the four old home beacons glow, and the Catchers visit the plaza.

**Play added.** +2.5 h · **Steps** S-167a - S-173 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 222 | [S-167a](steps/M18-M20.md#s-167a) | feat: Granny Wick's Library, where found Lamp Logs shelve themselves (side story 16) | [M18-M20](steps/M18-M20.md) | S-165a, S-075b, S-054 | M | - |
| 223 | [S-167b](steps/M18-M20.md#s-167b) | feat: side story 15 Moth to a Flame: six sleepy cousins guided home by lantern light | [M18-M20](steps/M18-M20.md) | S-167a | M | - |
| 224 | [S-168a](steps/M18-M20.md#s-168a) | feat: side story 17 The Clockwork Apprentice | [M18-M20](steps/M18-M20.md) | S-165a | M | - |
| 225 | [S-168b](steps/M18-M20.md#s-168b) | feat: side story 18 Kinako's Limited Edition | [M18-M20](steps/M18-M20.md) | S-168a, S-092 | M | - |
| 226 | [S-169](steps/M18-M20.md#s-169) | feat: four old Lamplighter beacons wake on home's landmarks | [M18-M20](steps/M18-M20.md) | S-160, S-075b, S-074 | M | - |
| 227 | [S-170](steps/M18-M20.md#s-170) | feat: the Catchers visit the plaza, and villagers react to Act II | [M18-M20](steps/M18-M20.md) | S-165a, S-012 | M | - |
| 228 | [S-171](steps/M18-M20.md#s-171) | feat: Wenna's Act II lines and side story 14 The Fourth Bough (part 1) | [M18-M20](steps/M18-M20.md) | S-065, S-165a | S | - |
| 229 | [S-172](steps/M18-M20.md#s-172) | feat: side story 13 Shellby's Slow Walk (resumable) | [M18-M20](steps/M18-M20.md) | S-165a, S-152a | M | - |
| 230 | [S-173](steps/M18-M20.md#s-173) | chore: close M20: brief batch 09 | [M18-M20](steps/M18-M20.md) | S-167a, S-167b, S-168a, S-168b, S-169, S-170, S-171, S-172, S-001 | S | - |

<a id="m21"></a>

## M21 · The Rootdeep: the land, the Heart and Lumbra

**Goal.** NPC pathfinding, the cavern recipe, Burrowbottom, the Digging Paws, root-gates, the Rootdeep Heart and Lumbra the Long (the realm stays hidden until chapter 13 ships next milestone).

**Entry.** M20 closed.

**Exit criteria (what the player can do).** The Paws dig soft earth on every shipped land and root-gates link the lands once found; the Rootdeep, its dungeon and Lumbra are complete behind `?realm=rootdeep`.

**Play added.** 0 h visible (+3.5 h shipped with chapter 13) · **Steps** S-174 - S-187 (17)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 231 | [S-174](steps/M21-M23.md#s-174) | feat: NPCs walk paths and keep simple schedules | [M21-M23](steps/M21-M23.md) | S-018, S-030 | M | - |
| 232 | [S-175](steps/M21-M23.md#s-175) | feat: the Rootdeep cavern recipe: walls, low halls and the underlake (hidden) | [M21-M23](steps/M21-M23.md) | S-096, S-050 | M | - |
| 233 | [S-176](steps/M21-M23.md#s-176) | feat: Rootdeep props: the Taproot, glowcaps, geodes and root walls | [M21-M23](steps/M21-M23.md) | S-175 | M | - |
| 234 | [S-177](steps/M21-M23.md#s-177) | art: Rootdeep look, loading card, map art and music | [M21-M23](steps/M21-M23.md) | S-175, S-029b | M | - |
| 235 | [S-178](steps/M21-M23.md#s-178) | feat: Burrowbottom's people: Gran Burrows and the burrowers | [M21-M23](steps/M21-M23.md) | S-176, S-174, S-068a, S-120a | M | - |
| 236 | [S-179](steps/M21-M23.md#s-179) | feat: Rootdeep enemies: Glow Grub, Drip Bat and Pebble Mimic | [M21-M23](steps/M21-M23.md) | S-042, S-176 | M | - |
| 237 | [S-180](steps/M21-M23.md#s-180) | feat: Rootdeep finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches | [M21-M23](steps/M21-M23.md) | S-176, S-048, S-074, S-086b | M | - |
| 238 | [S-181a](steps/M21-M23.md#s-181a) | feat: Digging Paws dig soft earth; buried chests on the Rootdeep and the four isles | [M21-M23](steps/M21-M23.md) | S-048, S-175, S-180, S-037b | M | - |
| 239 | [S-181b](steps/M21-M23.md#s-181b) | feat: home's dig spots: Digby's five rumours, Shellby's old hat and the Undercap hole | [M21-M23](steps/M21-M23.md) | S-181a, S-033a | M | - |
| 240 | [S-182](steps/M21-M23.md#s-182) | feat: root-gates: underground fast travel between lands, ferried by Lumbra | [M21-M23](steps/M21-M23.md) | S-080, S-181a | M | - |
| 241 | [S-183](steps/M21-M23.md#s-183) | feat: the Rootdeep Heart rooms 1-7: Sunglass beams grow root bridges | [M21-M23](steps/M21-M23.md) | S-181a, S-160, S-053, S-178 | M | - |
| 242 | [S-184](steps/M21-M23.md#s-184) | feat: the Rootdeep Heart rooms 8-14: soft earth and the Warden's hall | [M21-M23](steps/M21-M23.md) | S-183 | M | - |
| 243 | [S-184b](steps/M21-M23.md#s-184b) | feat: The Rootdeep Heart grows the Sap Cistern and the Root-Keeper's Nook: the roots hold their breath (depth rule R14) | [M21-M23](steps/M21-M23.md) | S-184, S-060b, S-104b | M | - |
| 244 | [S-185](steps/M21-M23.md#s-185) | feat: Lumbra the Long, the 14 m earthworm who keeps the roots healthy | [M21-M23](steps/M21-M23.md) | S-184b, S-045 | M | - |
| 245 | [S-186](steps/M21-M23.md#s-186) | feat: the Rootdeep's three Hollows and the Rootdeep Dash | [M21-M23](steps/M21-M23.md) | S-180, S-073, S-183, S-181a, S-074 | M | - |
| 246 | [S-186b](steps/M21-M23.md#s-186b) | feat: the Rootdeep's Hollows get their second stage, and The Dark Hollow becomes a Deep Hollow | [M21-M23](steps/M21-M23.md) | S-186, S-090b | M | - |
| 247 | [S-187](steps/M21-M23.md#s-187) | chore: close M21: ARCHITECTURE on cross-realm post-passes | [M21-M23](steps/M21-M23.md) | S-182, S-185, S-186, S-001, S-030, S-186b, S-184b | S | - |

<a id="m22"></a>

## M22 · The Remembered Isle, chapter 13 and Grumble's Undercap

**Goal.** Variant realms, the young cast, memory knots and the first three memories open Act III; the first optional home dungeon and a mid-game soak follow.

**Entry.** M21 closed.

**Exit criteria (what the player can do).** Wenna asks to remember; Digby leads Pip through the Rootdeep; Pip calms Lumbra, wins the Paws and touches the first three memory knots to visit the Remembered Isle (home 100 years ago); the roots show where the Stair Stones fell. Pip can also relight the shroomlets' town under Grumble's Crown.

**Play added.** +6 h · **Steps** S-188 - S-197 (13)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 248 | [S-188](steps/M21-M23.md#s-188) | feat: variant realms reuse a land's geometry with a new skin; the Remembered Isle skeleton | [M21-M23](steps/M21-M23.md) | S-027, S-018 | M | - |
| 249 | [S-189](steps/M21-M23.md#s-189) | feat: the young cast: scaled and recoloured models of Shellby, the Catchers, Granny Wick and Pelagia | [M21-M23](steps/M21-M23.md) | S-188, S-068a, S-120a | M | - |
| 250 | [S-190a](steps/M21-M23.md#s-190a) | feat: memory knots on the Taproot open the Remembered Isle at a memory (runner and memory 1) | [M21-M23](steps/M21-M23.md) | S-188, S-189, S-034, S-176, S-185 | M | - |
| 251 | [S-190b](steps/M21-M23.md#s-190b) | feat: memories 2 and 3, free roam and echoes in every memory, the Remembered acorns and journal replays | [M21-M23](steps/M21-M23.md) | S-190a, S-074 | M | - |
| 252 | [S-190c](steps/M21-M23.md#s-190c) | feat: the vignette runner, the Ladder's path lamps and vignette 1 The Lamp Path in memory 3 | [M21-M23](steps/M21-M23.md) | S-190b, S-030 | M | - |
| 253 | [S-191a](steps/M21-M23.md#s-191a) | feat: chapter 13 Into the Rootdeep, part 1: Digby leads, Gran Burrows, the Heart and Lumbra | [M21-M23](steps/M21-M23.md) | S-190b, S-185, S-182, S-174, S-178, S-033a, S-036 | M | - |
| 254 | [S-191b](steps/M21-M23.md#s-191b) | feat: chapter 13 part 2: the roots remember, root-gates open, the Rootdeep is unhidden | [M21-M23](steps/M21-M23.md) | S-191a, S-190c, S-030 | M | - |
| 255 | [S-192](steps/M21-M23.md#s-192) | feat: side stories 31 Burrowbottom Lamplight and 32 Lumbra's Itch | [M21-M23](steps/M21-M23.md) | S-191b, S-078 | M | - |
| 256 | [S-193](steps/M21-M23.md#s-193) | feat: side story 33 Gran's Pouch, Gran's burrow, and For Spring's golden grove | [M21-M23](steps/M21-M23.md) | S-191b, S-114, S-036 | M | - |
| 257 | [S-194](steps/M21-M23.md#s-194) | feat: Grumble's Undercap: rooms 1-8 under Grumble's Crown | [M21-M23](steps/M21-M23.md) | S-181b, S-057, S-053, S-074 | M | - |
| 258 | [S-195](steps/M21-M23.md#s-195) | feat: side story 11 Grumble's Nephews: relight the shroomlet town | [M21-M23](steps/M21-M23.md) | S-194, S-158b, S-155 | M | - |
| 259 | [S-196](steps/M21-M23.md#s-196) | perf: checkpoint 5: a mid-game soak across every realm and a full save | [M21-M23](steps/M21-M23.md) | S-191b, S-192, S-195, S-151 | M | - |
| 260 | [S-197](steps/M21-M23.md#s-197) | chore: close M22: Act III opening documented, brief batch 10 | [M21-M23](steps/M21-M23.md) | S-191b, S-192, S-193, S-189, S-195, S-196, S-001, S-030 | S | - |

<a id="m23"></a>

## M23 · The Glassway I: sailing and Puffin Post

**Goal.** Free sailing (owner decision 4, with the chart-stop fallback), the shoals realm and chapter 14.

**Entry.** M22 closed; owner decision 4 at its default (free sailing).

**Exit criteria (what the player can do).** Nell sails past the reef; Pip steers the Dandelion freely around 9 islets, sandbars and 3 wrecks; Puffin Post and its people; bottles wash up.

**Play added.** +2 h · **Steps** S-198 - S-205b (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 261 | [S-198](steps/M21-M23.md#s-198) | feat: boat locomotion: steer the Dandelion on the water plane (behind a flag) | [M21-M23](steps/M21-M23.md) | S-021 | M | - |
| 262 | [S-199](steps/M21-M23.md#s-199) | feat: board, dock and remember the boat; save v10 keeps its place | [M21-M23](steps/M21-M23.md) | S-198, S-071 | M | v9 -> v10 |
| 263 | [S-200](steps/M21-M23.md#s-200) | feat: the Glassway shoals recipe: islets, sandbars and sail lanes (hidden) | [M21-M23](steps/M21-M23.md) | S-117, S-198, S-048 | M | - |
| 264 | [S-201a](steps/M21-M23.md#s-201a) | feat: Glassway props: the stilt post office, the Pillar Post, the Shell Stack, piers, buoys and tide stones | [M21-M23](steps/M21-M23.md) | S-200, S-082b | M | - |
| 265 | [S-201b](steps/M21-M23.md#s-201b) | feat: Glassway landmarks: three wrecks, Gull Rock's spiral path, the Sunken Bell's spire and the Snoozing Whale | [M21-M23](steps/M21-M23.md) | S-201a | M | - |
| 266 | [S-202](steps/M21-M23.md#s-202) | art: Glassway look: terrain layers, water clarity, loading card, map art and music | [M21-M23](steps/M21-M23.md) | S-200, S-029b | M | - |
| 267 | [S-203](steps/M21-M23.md#s-203) | feat: chapter 14 Past the Reef: Puffin Post, Postmistress Pell and Mr Whelk | [M21-M23](steps/M21-M23.md) | S-199, S-201b, S-202, S-191b, S-030 | M | - |
| 268 | [S-203b](steps/M21-M23.md#s-203b) | feat: Fog on the Water: sail buoy to buoy by bell sound to reach Puffin Post | [M21-M23](steps/M21-M23.md) | S-203, S-201a, S-091b | M | - |
| 269 | [S-204](steps/M21-M23.md#s-204) | feat: Glassway enemies: Bubble Puffer and Gullgrab | [M21-M23](steps/M21-M23.md) | S-042, S-201b, S-179 | M | - |
| 270 | [S-205](steps/M21-M23.md#s-205) | feat: Glassway finds: chests, keepsakes, acorns, vistas, bottles, Lamp Logs, Hollow doors, benches and the root-gate | [M21-M23](steps/M21-M23.md) | S-201b, S-075b, S-203, S-074 | M | - |
| 271 | [S-205b](steps/M21-M23.md#s-205b) | chore: close M23: the Glassway I documented | [M21-M23](steps/M21-M23.md) | S-198, S-205, S-001, S-030 | S | - |

<a id="m24"></a>

## M24 · The Glassway II: fishing, the Starsong and the Sunken Bell

**Goal.** Fishing, the Starsong, the Sunken Bell dungeon, Pelagia's duel and the Stair Stone count beats.

**Entry.** M23 closed.

**Exit criteria (what the player can do).** Pip fishes with Nell (24 species), plays the Starsong (Dawn, Dusk, Calling), solves the Sunken Bell, wins Pelagia's bell duel and sets the first Stair Stone: a flight of steps rises from the Cairn and memories 4-6 open.

**Play added.** +5 h · **Steps** S-206 - S-213 (13)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 272 | [S-206](steps/M24-M26.md#s-206) | feat: fishing with Nell: cast, a timed Swing and the Fish Log | [M24-M26](steps/M24-M26.md) | S-071, S-068b, S-054, S-033a, S-074 | M | - |
| 273 | [S-207](steps/M24-M26.md#s-207) | feat: 24 fish species and 18 spots across the shipped lands | [M24-M26](steps/M24-M26.md) | S-206, S-029b, S-037b, S-180 | M | - |
| 274 | [S-208](steps/M24-M26.md#s-208) | feat: the Starsong: three tunes for star doors, night and the boat | [M24-M26](steps/M24-M26.md) | S-048, S-199, S-078 | M | - |
| 275 | [S-209](steps/M24-M26.md#s-209) | feat: the Sunken Bell rooms 1-6: three pitches open matching doors | [M24-M26](steps/M24-M26.md) | S-208, S-053 | M | - |
| 276 | [S-210](steps/M24-M26.md#s-210) | feat: the Sunken Bell rooms 7-11: sequences heard elsewhere | [M24-M26](steps/M24-M26.md) | S-209 | M | - |
| 277 | [S-210b](steps/M24-M26.md#s-210b) | feat: The Sunken Bell grows the Carillon Loft, the Bell-Rope Room and the Bellringer's Closet: the chapel's bells swap (depth rule R14) | [M24-M26](steps/M24-M26.md) | S-210, S-060b, S-104b | M | - |
| 278 | [S-211](steps/M24-M26.md#s-211) | feat: Pelagia's bell-order duel: a game of wits, never an attack | [M24-M26](steps/M24-M26.md) | S-210, S-045, S-210b | M | - |
| 279 | [S-212a](steps/M24-M26.md#s-212a) | feat: Stair Stones set at the Cairn raise Starstair flights and open memories by count | [M24-M26](steps/M24-M26.md) | S-211, S-190c, S-095b | M | - |
| 280 | [S-212b](steps/M24-M26.md#s-212b) | feat: memories 4-6: the seed-bearer, Wick's lamp and racing the tide | [M24-M26](steps/M24-M26.md) | S-212a, S-189, S-190c | M | - |
| 281 | [S-212c](steps/M24-M26.md#s-212c) | feat: the Sunken Bell's quest: puffins, the chapel key, low tide, and the ch-bell chapter test | [M24-M26](steps/M24-M26.md) | S-212a, S-211, S-030, S-203 | M | - |
| 282 | [S-212e](steps/M24-M26.md#s-212e) | feat: vignette 2 The Tide Race: run beside young Pelagia's prints in memory 6 | [M24-M26](steps/M24-M26.md) | S-212b, S-190c, S-112 | M | - |
| 283 | [S-212d](steps/M24-M26.md#s-212d) | feat: Mote in the present: a note on the first stone, a figure on the stair, and the crown's pull | [M24-M26](steps/M24-M26.md) | S-212a, S-090b | M | - |
| 284 | [S-213](steps/M24-M26.md#s-213) | chore: close M24: DESIGN on sailing, fishing and stones | [M24-M26](steps/M24-M26.md) | S-207, S-212c, S-212d, S-212e, S-030, S-210b | S | - |

<a id="m25"></a>

## M25 · Glassway stories, the Merry Mabel and Moonmere

**Goal.** The optional wreck dungeon, four Glassway stories, Old Friends, and Moonmere, Mote's mirror-home.

**Entry.** M24 closed.

**Exit criteria (what the player can do).** Pip delivers bottles' letters, helps Mr Whelk, rolls the Snoozing Whale over, calms Bosun Snore on the Merry Mabel, watches Shellby and Pelagia meet again, and walks the moonpath into Moonmere.

**Play added.** +4 h · **Steps** S-214a - S-221 (12)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 285 | [S-214a](steps/M24-M26.md#s-214a) | feat: the Merry Mabel: a tilted wreck dungeon of nine rooms (hidden) | [M24-M26](steps/M24-M26.md) | S-201b, S-143b, S-122b, S-053 | M | - |
| 286 | [S-214b](steps/M24-M26.md#s-214b) | feat: Bosun Snore on the tilted lower deck, and the ship's bell | [M24-M26](steps/M24-M26.md) | S-214a, S-045, S-209 | M | - |
| 287 | [S-215](steps/M24-M26.md#s-215) | feat: side stories 34 Return to Sender and 35 The Collector | [M24-M26](steps/M24-M26.md) | S-203, S-075b, S-078 | M | - |
| 288 | [S-216a](steps/M24-M26.md#s-216a) | feat: side story 36 The Merry Mabel, and the Bell Duel with Pelagia | [M24-M26](steps/M24-M26.md) | S-214b, S-211 | M | - |
| 289 | [S-216b](steps/M24-M26.md#s-216b) | feat: side story 37 The Whale Who Rolls Over | [M24-M26](steps/M24-M26.md) | S-216a | M | - |
| 290 | [S-217](steps/M24-M26.md#s-217) | feat: side story 9 Old Friends: Shellby and Pelagia | [M24-M26](steps/M24-M26.md) | S-212c | M | - |
| 291 | [S-218a](steps/M24-M26.md#s-218a) | feat: Moonmere: the moonpath off Nell's Jetty leads to Mote's mirror-home (hidden) | [M24-M26](steps/M24-M26.md) | S-188, S-208, S-212c | M | - |
| 292 | [S-218b](steps/M24-M26.md#s-218b) | feat: Moonmere's creatures: Hushlings and the silver home species | [M24-M26](steps/M24-M26.md) | S-218a, S-042 | S | - |
| 293 | [S-219](steps/M24-M26.md#s-219) | feat: side story 47 Letters Never Sent and the Mirror Garden | [M24-M26](steps/M24-M26.md) | S-218b, S-033a, S-203 | M | - |
| 294 | [S-220](steps/M24-M26.md#s-220) | feat: the Glassway's two Hollows and its Dash course | [M24-M26](steps/M24-M26.md) | S-205, S-073, S-112, S-074 | M | - |
| 295 | [S-220b](steps/M24-M26.md#s-220b) | feat: the Glassway's Hollows get their second stage, and The Bell Hollow becomes a Deep Hollow | [M24-M26](steps/M24-M26.md) | S-220, S-090b | M | - |
| 296 | [S-221](steps/M24-M26.md#s-221) | chore: close M25: brief batch 11 | [M24-M26](steps/M24-M26.md) | S-215, S-216b, S-217, S-219, S-220, S-001, S-030, S-220b | S | - |

<a id="m26"></a>

## M26 · Kettle Isle: the forge, the Belly and Starsteel

**Goal.** The forge isle, the Ember Sling, the Kettle's Belly, Lady Fumarole, a Stair Stone (twist T5 when it is the second) and the Starsteel Sword.

**Entry.** M25 closed.

**Exit criteria (what the player can do).** Pip calms Lady Fumarole and sets a Stair Stone; the Sling opens the home bell targets and the Snowglobe wall; Scoria forges Starsteel, which cuts thornglass in every land.

**Play added.** +5 h · **Steps** S-222 - S-235 (21)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 297 | [S-222](steps/M24-M26.md#s-222) | feat: Kettle Isle cone recipe: the teakettle volcano and spring terraces (hidden) | [M24-M26](steps/M24-M26.md) | S-138 | M | - |
| 298 | [S-223a](steps/M24-M26.md#s-223a) | feat: Kettle Isle prop kit: forge houses, basins, vents, pipes and the shared pieces | [M24-M26](steps/M24-M26.md) | S-222, S-082b | M | - |
| 299 | [S-223b](steps/M24-M26.md#s-223b) | feat: Kettle Isle landmarks: the Kettle's spout and plume, the Handle, the Hammerwheel, the bathhouse and the Teacup | [M24-M26](steps/M24-M26.md) | S-223a | M | - |
| 300 | [S-224](steps/M24-M26.md#s-224) | art: Kettle Isle look, loading card, map art and music | [M24-M26](steps/M24-M26.md) | S-222, S-029b | M | - |
| 301 | [S-225](steps/M24-M26.md#s-225) | feat: Forgefall's people: Master Scoria, Pitch and Soakley | [M24-M26](steps/M24-M26.md) | S-223b, S-068a | M | - |
| 302 | [S-226](steps/M24-M26.md#s-226) | feat: Kettle enemies: Soot Snuffle, Steam Puff and Ash Moth | [M24-M26](steps/M24-M26.md) | S-042, S-223b | M | - |
| 303 | [S-227a](steps/M24-M26.md#s-227a) | feat: the Ember Sling: ranged ember shots for bell targets, braziers, ice walls and wax plugs | [M24-M26](steps/M24-M26.md) | S-048, S-222 | M | - |
| 304 | [S-227b](steps/M24-M26.md#s-227b) | feat: four landmark bells, the Bell Hollow and the Snowglobe's ice wall on home | [M24-M26](steps/M24-M26.md) | S-227a, S-074 | M | - |
| 305 | [S-228](steps/M24-M26.md#s-228) | feat: Kettle Isle finds: chests, keepsakes, acorns, vistas, Lamp Logs, a bottle, Hollow doors, benches | [M24-M26](steps/M24-M26.md) | S-223b, S-074, S-086b | M | - |
| 306 | [S-229](steps/M24-M26.md#s-229) | feat: the Kettle's Belly rooms 1-7: valves raise and lower platforms | [M24-M26](steps/M24-M26.md) | S-227a, S-053 | M | - |
| 307 | [S-230](steps/M24-M26.md#s-230) | feat: the Kettle's Belly rooms 8-13: braziers at range and wax plugs | [M24-M26](steps/M24-M26.md) | S-229 | M | - |
| 308 | [S-230b](steps/M24-M26.md#s-230b) | feat: The Kettle's Belly grows the Whistle Room, the Pressure Cock and the Gauge Cupboard: the steam slows down (depth rule R14) | [M24-M26](steps/M24-M26.md) | S-230, S-060b, S-104b | M | - |
| 309 | [S-231](steps/M24-M26.md#s-231) | feat: Lady Fumarole, the fire-newt in a bath towel on the spout lid | [M24-M26](steps/M24-M26.md) | S-230b, S-045 | M | - |
| 310 | [S-232a](steps/M24-M26.md#s-232a) | feat: Kettle Isle's main chain: the forges relight and a Stair Stone is set | [M24-M26](steps/M24-M26.md) | S-231, S-225, S-212a, S-030, S-033a | M | - |
| 311 | [S-232b](steps/M24-M26.md#s-232b) | feat: memories 7-9: he comes down, come home, and who would they wake up next to (twist T5) | [M24-M26](steps/M24-M26.md) | S-232a, S-212b, S-190c | M | - |
| 312 | [S-232c](steps/M24-M26.md#s-232c) | feat: The Boil-Over: after Fumarole, Pip relights Forgefall's three forges with the Ember Sling through the steam | [M24-M26](steps/M24-M26.md) | S-232a, S-231, S-227a, S-091b | M | - |
| 313 | [S-233a](steps/M24-M26.md#s-233a) | feat: side story 38 Starsteel: sword level 3, forged by Master Scoria; save v11 | [M24-M26](steps/M24-M26.md) | S-232a, S-013, S-199 | M | **v10 -> v11** |
| 314 | [S-233b](steps/M24-M26.md#s-233b) | feat: thornglass thickets in every shipped land, cut only with Starsteel | [M24-M26](steps/M24-M26.md) | S-233a, S-074 | M | - |
| 315 | [S-234](steps/M24-M26.md#s-234) | feat: Kettle Isle's two Hollows, its Dash course and Rook's race part 4 | [M24-M26](steps/M24-M26.md) | S-228, S-073, S-154 | M | - |
| 316 | [S-234b](steps/M24-M26.md#s-234b) | feat: Kettle Isle's Hollows get their second stage, and The Kettle-Steam Hollow becomes a Deep Hollow | [M24-M26](steps/M24-M26.md) | S-234, S-090b | M | - |
| 317 | [S-235](steps/M24-M26.md#s-235) | chore: close M26: twist T5 documented | [M24-M26](steps/M24-M26.md) | S-233b, S-234, S-232b, S-232c, S-030, S-234b, S-230b | S | - |

<a id="m27"></a>

## M27 · Kettle stories, the Snowglobe and the parcel chain

**Goal.** Kettle side stories and activities, the Snowglobe and Great-Aunt Flurry, the parcel chain, and the twins' peace.

**Entry.** M26 closed.

**Exit criteria (what the player can do).** Pitch wants a star, Soakley's baths settle, Miso meets her supplier, Sling Gallery and Steam Hop run, Frostbun's great-aunt naps in the Snowglobe, the Parcel With No Name pays the Chime Bell, and Miso and Kinako hang a joint sign.

**Play added.** +4.5 h · **Steps** S-236a - S-242 (10)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 318 | [S-236a](steps/M27-M29.md#s-236a) | feat: side story 39 Pitch Wants a Star | [M27-M29](steps/M27-M29.md) | S-232a, S-078 | M | - |
| 319 | [S-236b](steps/M27-M29.md#s-236b) | feat: side story 40 Soakley's Baths | [M27-M29](steps/M27-M29.md) | S-236a, S-078 | M | - |
| 320 | [S-237a](steps/M27-M29.md#s-237a) | feat: side story 41 Miso's Supplier and the Sling Gallery | [M27-M29](steps/M27-M29.md) | S-232b, S-030, S-191a | M | - |
| 321 | [S-237b](steps/M27-M29.md#s-237b) | feat: Steam Hop, gliding up the bathhouse vents | [M27-M29](steps/M27-M29.md) | S-237a, S-102b | S | - |
| 322 | [S-238](steps/M27-M29.md#s-238) | feat: the Snowglobe rooms 1-10 under Frostcap: melting ice and sliding blocks | [M27-M29](steps/M27-M29.md) | S-227b, S-053, S-074 | M | - |
| 323 | [S-239a](steps/M27-M29.md#s-239a) | feat: Great-Aunt Flurry, the Snowglobe's sleeping boss | [M27-M29](steps/M27-M29.md) | S-238, S-045, S-074 | M | - |
| 324 | [S-239b](steps/M27-M29.md#s-239b) | feat: side story 12 Frostbun's Great-Aunt and the Snowdrift trim | [M27-M29](steps/M27-M29.md) | S-239a, S-170, S-078 | M | - |
| 325 | [S-240](steps/M27-M29.md#s-240) | feat: side story 10 The Parcel With No Name and the Chime Bell | [M27-M29](steps/M27-M29.md) | S-232b, S-170, S-161c, S-203 | M | - |
| 326 | [S-241](steps/M27-M29.md#s-241) | feat: side story 3 Nothing Is Refundable, part 2: the twins' joint sign | [M27-M29](steps/M27-M29.md) | S-134, S-237a | S | - |
| 327 | [S-242](steps/M27-M29.md#s-242) | chore: close M27: brief batch 12 | [M27-M29](steps/M27-M29.md) | S-236a, S-236b, S-237a, S-237b, S-238, S-239a, S-239b, S-240, S-241, S-001, S-030, S-191a | S | - |

<a id="m28"></a>

## M28 · Saltglass Flats and the third stone

**Goal.** The desert of the buried Academy, the Ivy Gloves, the Buried Academy, Tutor Scarabelle's exam and the last Stair Stone.

**Entry.** M27 closed.

**Exit criteria (what the player can do).** Pip climbs ivy (including up the Great Tree to a crown balcony), passes the Academy's final exam, sets the last Stair Stone (memories 10-12) and finishes Rook's Races.

**Play added.** +5 h · **Steps** S-243 - S-257 (22)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 328 | [S-243](steps/M27-M29.md#s-243) | feat: Saltglass dunes recipe: dune ridges, salt pans and ruins (hidden) | [M27-M29](steps/M27-M29.md) | S-222 | M | - |
| 329 | [S-244](steps/M27-M29.md#s-244) | feat: Saltglass props: the Academy bell tower, glass sculptures and dig camp | [M27-M29](steps/M27-M29.md) | S-243, S-082b | M | - |
| 330 | [S-245](steps/M27-M29.md#s-245) | art: Saltglass look, loading card, map art and music | [M27-M29](steps/M27-M29.md) | S-243, S-029b | M | - |
| 331 | [S-246](steps/M27-M29.md#s-246) | feat: Sablecamp's people: Sable and the dig crew | [M27-M29](steps/M27-M29.md) | S-244, S-068a | M | - |
| 332 | [S-247](steps/M27-M29.md#s-247) | feat: Saltglass enemies: Sandsnoot, Prickle Pear, Sun Beetle and Dust Puff | [M27-M29](steps/M27-M29.md) | S-041, S-244 | M | - |
| 333 | [S-248a](steps/M27-M29.md#s-248a) | feat: the Ivy Gloves: a climb state on ivy lattices | [M27-M29](steps/M27-M29.md) | S-048, S-243 | M | - |
| 334 | [S-248b](steps/M27-M29.md#s-248b) | feat: three home climbs: the Great Tree to the Crown Balcony, the windmill and the lighthouse | [M27-M29](steps/M27-M29.md) | S-248a, S-078 | M | - |
| 335 | [S-249a](steps/M27-M29.md#s-249a) | feat: Saltglass finds: chests, keepsakes, acorns, vistas, six Lamp Logs, Hollow doors, benches | [M27-M29](steps/M27-M29.md) | S-244, S-074 | M | - |
| 336 | [S-249b](steps/M27-M29.md#s-249b) | feat: Saltglass gate finds, the Lamp Walk and the Dune Chord, and the coverage test | [M27-M29](steps/M27-M29.md) | S-249a, S-248a, S-078, S-086b, S-180 | M | - |
| 337 | [S-250](steps/M27-M29.md#s-250) | feat: the Buried Academy rooms 1-7: sand-flow tiles and nameplate doors | [M27-M29](steps/M27-M29.md) | S-248a, S-053 | M | - |
| 338 | [S-251](steps/M27-M29.md#s-251) | feat: the Buried Academy rooms 8-14: ivy between floors and the exam hall | [M27-M29](steps/M27-M29.md) | S-250, S-001 | M | - |
| 339 | [S-251b](steps/M27-M29.md#s-251b) | feat: The Buried Academy grows the Pump Gallery and the Head Prefect's Study: the sand changes its mind (depth rule R14) | [M27-M29](steps/M27-M29.md) | S-251, S-060b, S-104b | M | - |
| 340 | [S-252](steps/M27-M29.md#s-252) | feat: Tutor Scarabelle's exam, papers 1 and 2: dodging and aiming | [M27-M29](steps/M27-M29.md) | S-251b, S-160, S-246 | M | - |
| 341 | [S-253](steps/M27-M29.md#s-253) | feat: the exam's puzzle paper, the result and the bell's stone | [M27-M29](steps/M27-M29.md) | S-252, S-045 | M | - |
| 342 | [S-254](steps/M27-M29.md#s-254) | feat: Saltglass's main chain: the Academy bell rings and a stone is set | [M27-M29](steps/M27-M29.md) | S-253, S-246, S-212e, S-030 | M | - |
| 343 | [S-254b](steps/M27-M29.md#s-254b) | feat: memories 10-12: the Storm, the stones fall, a letter by lamplight | [M27-M29](steps/M27-M29.md) | S-212a, S-232b | M | - |
| 344 | [S-254c](steps/M27-M29.md#s-254c) | feat: The Lamp Walk joins the main chain: Saltglass's night walk to the Academy door | [M27-M29](steps/M27-M29.md) | S-254, S-249b, S-091b | M | - |
| 345 | [S-254d](steps/M27-M29.md#s-254d) | feat: vignette 4 The Last Lamp: carry the young turtle's lamp-glow to the lighthouse in memory 12 | [M27-M29](steps/M27-M29.md) | S-254b, S-190c, S-212e | M | - |
| 346 | [S-255](steps/M27-M29.md#s-255) | feat: Saltglass's three Hollows, its Dash course and Rook's race finale | [M27-M29](steps/M27-M29.md) | S-249b, S-073, S-234 | M | - |
| 347 | [S-255b](steps/M27-M29.md#s-255b) | feat: Saltglass Flats's Hollows get their second stage, and The Sun-Dial Hollow becomes a Deep Hollow | [M27-M29](steps/M27-M29.md) | S-255, S-090b | M | - |
| 348 | [S-256](steps/M27-M29.md#s-256) | test: all six Stair Stone orders open every memory once | [M27-M29](steps/M27-M29.md) | S-254, S-254b, S-232b, S-030 | S | - |
| 349 | [S-257](steps/M27-M29.md#s-257) | chore: close M28: Act III stones documented | [M27-M29](steps/M27-M29.md) | S-256, S-255, S-254c, S-254d, S-001, S-255b, S-251b | S | - |

<a id="m29"></a>

## M29 · Saltglass stories and the road to the sky

**Goal.** Saltglass's three side stories, Act III reactions and a performance checkpoint before the sky.

**Entry.** M28 closed.

**Exit criteria (what the player can do).** Sable's dig, the Roll Call nameplates, the Exam Retake quiz; villagers and Wenna react to the three stones.

**Play added.** +2 h · **Steps** S-258a - S-261 (5)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 350 | [S-258a](steps/M27-M29.md#s-258a) | feat: the Academy library and side story 42 Sable's Dig | [M27-M29](steps/M27-M29.md) | S-254 | M | - |
| 351 | [S-258b](steps/M27-M29.md#s-258b) | feat: side story 43 Roll Call: nine nameplates and the dawn roll bell | [M27-M29](steps/M27-M29.md) | S-258a | M | - |
| 352 | [S-259](steps/M27-M29.md#s-259) | feat: side story 44 The Exam Retake: a quiz built from gossip the player heard | [M27-M29](steps/M27-M29.md) | S-254, S-258a | M | - |
| 353 | [S-260](steps/M27-M29.md#s-260) | feat: Wenna and the villagers react to Act III | [M27-M29](steps/M27-M29.md) | S-254, S-254b, S-170, S-033a | M | - |
| 354 | [S-261](steps/M27-M29.md#s-261) | perf: checkpoint 6: ten realms and the precache; close Saltglass stories | [M27-M29](steps/M27-M29.md) | S-254, S-258b, S-259, S-260, S-256 | S | - |

<a id="m30"></a>

## M30 · The Starstair, Driftholm and the end of Act III

**Goal.** Climb the restored Starstair to Driftholm, then the Spiral Stair, the chase and Cloudstep.

**Entry.** M29 closed.

**Exit criteria (what the player can do).** Pip climbs the Cairn needle and three floating flights to Driftholm, sees Mote's shelter, scrap lamps and the Tally Wall, herds Nimbles, climbs the Spiral Stair on song platforms and chases Mote to the Spiral Arch; Cloudstep; "End of Act Three".

**Play added.** +4.5 h · **Steps** S-262 - S-273 (14)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 355 | [S-262](steps/M30-M33.md#s-262) | feat: Driftholm floating recipe: one isle, five islets and a cloud floor that bounces | [M30-M33](steps/M30-M33.md) | S-243 | M | - |
| 356 | [S-263](steps/M30-M33.md#s-263) | feat: Driftholm props: the Spiral Arch, scrap lamps, the Tally Wall and the falls | [M30-M33](steps/M30-M33.md) | S-262, S-082b | M | - |
| 357 | [S-264](steps/M30-M33.md#s-264) | feat: the Starstair: from the Cairn needle up three flights to Driftholm | [M30-M33](steps/M30-M33.md) | S-212e, S-143b, S-248b, S-262, S-263 | M | - |
| 358 | [S-265](steps/M30-M33.md#s-265) | art: Driftholm look, loading card, map art and music | [M30-M33](steps/M30-M33.md) | S-262, S-264, S-029b | M | - |
| 359 | [S-266](steps/M30-M33.md#s-266) | feat: Driftholm life: the Nimbles, Nimbus Puffs and Gust Kites | [M30-M33](steps/M30-M33.md) | S-263, S-041, S-174, S-264 | M | - |
| 360 | [S-267a](steps/M30-M33.md#s-267a) | feat: Driftholm finds: chests, keepsakes, acorns, vistas, benches, curios and the Wind-Chime Hollow | [M30-M33](steps/M30-M33.md) | S-266, S-073, S-078, S-086b, S-180 | M | - |
| 361 | [S-267b](steps/M30-M33.md#s-267b) | feat: side stories 45 Mote's Tally and 46 Nimble Herding; the Driftholm Dash | [M30-M33](steps/M30-M33.md) | S-267a, S-112, S-078 | M | - |
| 362 | [S-268](steps/M30-M33.md#s-268) | feat: Cloudstep: a second hop on cloud motes; a sky nook above the Cairn | [M30-M33](steps/M30-M33.md) | S-048, S-262, S-037b | M | - |
| 363 | [S-269](steps/M30-M33.md#s-269) | feat: the Spiral Stair rooms 1-5: Starsong notes make clouds solid | [M30-M33](steps/M30-M33.md) | S-208, S-053, S-263 | M | - |
| 364 | [S-270](steps/M30-M33.md#s-270) | feat: the Spiral Stair rooms 6-10 and the chase course | [M30-M33](steps/M30-M33.md) | S-269, S-268 | M | - |
| 365 | [S-270b](steps/M30-M33.md#s-270b) | feat: The Spiral Stair grows the Wind Loft, the Weathervane and the Kite Closet: the motes start to drift (depth rule R14) | [M30-M33](steps/M30-M33.md) | S-270, S-060b, S-104b | M | - |
| 366 | [S-271](steps/M30-M33.md#s-271) | feat: the chase: keep within 20 m of Mote for 90 s | [M30-M33](steps/M30-M33.md) | S-270, S-090, S-043, S-270b | M | - |
| 367 | [S-272](steps/M30-M33.md#s-272) | feat: chapter 18 the Starstair: Mote pulls his Ladder up; End of Act Three | [M30-M33](steps/M30-M33.md) | S-271, S-264, S-256, S-267b, S-268, S-030 | M | - |
| 368 | [S-273](steps/M30-M33.md#s-273) | chore: close M30: Act III release notes | [M30-M33](steps/M30-M33.md) | S-272, S-001, S-270b | S | - |

<a id="m31"></a>

## M31 · The Starmeadow

**Goal.** The sky of the Starkin: cloud isles, constellation bridges, Old Mother Brightwell and the Twinklings.

**Entry.** M30 closed.

**Exit criteria (what the player can do).** Pip walks the Starmeadow on constellation bridges, meets Old Mother Brightwell, learns given light and twist T6, and the Twinklings join him.

**Play added.** +2 h · **Steps** S-274 - S-279 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 369 | [S-274](steps/M30-M33.md#s-274) | feat: the Starmeadow islands recipe with Cloudstep-only constellation bridges (hidden) | [M30-M33](steps/M30-M33.md) | S-262, S-268 | M | - |
| 370 | [S-275a](steps/M30-M33.md#s-275a) | feat: Starmeadow props: star lanterns, bridge stars, the Starwell, the Cradle, the windlass and the Ladder of Lights | [M30-M33](steps/M30-M33.md) | S-274 | M | - |
| 371 | [S-275b](steps/M30-M33.md#s-275b) | art: the Starmeadow's look, loading card, map art and music | [M30-M33](steps/M30-M33.md) | S-275a, S-029b | M | - |
| 372 | [S-276](steps/M30-M33.md#s-276) | feat: the Starkin: Old Mother Brightwell and the Twinklings | [M30-M33](steps/M30-M33.md) | S-275a, S-174, S-191b, S-068a | M | - |
| 373 | [S-277a](steps/M30-M33.md#s-277a) | feat: tier-3 enemy patterns; Stardust Sprite and Comet Pup | [M30-M33](steps/M30-M33.md) | S-042, S-275a | M | - |
| 374 | [S-277b](steps/M30-M33.md#s-277b) | feat: Moonbeam Turret and Wisp Lantern; the Starmeadow's spawn tables | [M30-M33](steps/M30-M33.md) | S-277a | M | - |
| 375 | [S-278a](steps/M30-M33.md#s-278a) | feat: Starmeadow finds: star lanterns, chests, keepsakes, acorns, vistas, benches and curios | [M30-M33](steps/M30-M33.md) | S-276, S-277b | M | - |
| 376 | [S-278b](steps/M30-M33.md#s-278b) | feat: chapter 19 the Starmeadow: given light and why she sneezed early (T6) | [M30-M33](steps/M30-M33.md) | S-278a, S-030 | M | - |
| 377 | [S-279](steps/M30-M33.md#s-279) | chore: close M31: brief batch 14 | [M30-M33](steps/M30-M33.md) | S-278b, S-001 | S | - |

<a id="m32"></a>

## M32 · The Ladder of Lights, the Crown and the Second Sneeze

**Goal.** The last dungeon, Wenna's crown, and the finale built from the player's save.

**Entry.** M31 closed.

**Exit criteria (what the player can do).** Pip climbs down Mote's Ladder freeing each borrowed light, reaches Wenna's crown, guides Stray Lights home, catches the last spark on a glide, and everyone he helped brings a lantern; Mote climbs home. "End of Act Four"; epilogue free roam.

**Play added.** +5.5 h · **Steps** S-280 - S-287 (9)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 378 | [S-280](steps/M30-M33.md#s-280) | feat: the Ladder of Lights floors 1-6: one floor per borrowed beacon | [M30-M33](steps/M30-M33.md) | S-278b, S-053, S-276, S-030 | M | - |
| 379 | [S-281](steps/M30-M33.md#s-281) | feat: the Ladder of Lights floors 7-11: the little lights Mote gathered | [M30-M33](steps/M30-M33.md) | S-280 | M | - |
| 380 | [S-282](steps/M30-M33.md#s-282) | feat: the Ladder of Lights floors 12-16: every tool together, down into the Crown | [M30-M33](steps/M30-M33.md) | S-281 | M | - |
| 381 | [S-283](steps/M30-M33.md#s-283) | feat: the Crown: Wenna's canopy as walkable boughs | [M30-M33](steps/M30-M33.md) | S-282 | M | - |
| 382 | [S-284](steps/M30-M33.md#s-284) | feat: the Second Sneeze part 1: Stray Lights steered into bough lanterns | [M30-M33](steps/M30-M33.md) | S-283, S-160 | M | - |
| 383 | [S-285](steps/M30-M33.md#s-285) | feat: the Second Sneeze part 2: the Catchers catch, Pip catches the last spark | [M30-M33](steps/M30-M33.md) | S-284, S-102b | M | - |
| 384 | [S-286a](steps/M30-M33.md#s-286a) | feat: the Second Sneeze part 3: given light, a lantern from everyone Pip helped | [M30-M33](steps/M30-M33.md) | S-285, S-045 | M | - |
| 385 | [S-286b](steps/M30-M33.md#s-286b) | feat: the epilogue: home at dawn, the festival, the plushies, and the main ending ships | [M30-M33](steps/M30-M33.md) | S-286a, S-030 | M | - |
| 386 | [S-287](steps/M30-M33.md#s-287) | perf: checkpoint 7: the finale's lights and lantern chain; the main ending ships | [M30-M33](steps/M30-M33.md) | S-286b | S | - |

<a id="m33"></a>

## M33 · The Hundred-Year Night and Guardian Dreams

**Goal.** Chapter 22 (the true ending), its gifts, and ten opt-in Guardian Dreams.

**Entry.** M32 closed.

**Exit criteria (what the player can do).** With 8 bottles and 50 acorns after the main ending, Shellby asks Pip to sit at dusk, the Starkin come down, Shellby reveals the bottle, and Pip throws the 13th letter from the lighthouse; The Little Star and The Planting follow; `[E] Dream · <Name>` opens ten pastel dream rematches.

**Play added.** +4.5 h · **Steps** S-288a - S-296 (11)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 387 | [S-288a](steps/M30-M33.md#s-288a) | feat: the Hundred-Year Night variant realm: lanterns everywhere, falling light and the waltz | [M30-M33](steps/M30-M33.md) | S-188, S-286b | M | - |
| 388 | [S-288b](steps/M30-M33.md#s-288b) | feat: the Hundred-Year Night: everyone Pip met or calmed, in the plaza | [M30-M33](steps/M30-M33.md) | S-288a | M | - |
| 389 | [S-289](steps/M30-M33.md#s-289) | feat: chapter 22: Shellby's letter, the hanky, and Wenna's word to Pip | [M30-M33](steps/M30-M33.md) | S-288b | M | - |
| 390 | [S-290](steps/M30-M33.md#s-290) | feat: Pip writes the 13th letter and throws it from the lighthouse | [M30-M33](steps/M30-M33.md) | S-289, S-030 | M | - |
| 391 | [S-291a](steps/M30-M33.md#s-291a) | feat: side stories 48 The Little Star and 53 The Planting | [M30-M33](steps/M30-M33.md) | S-286b, S-268 | M | - |
| 392 | [S-291b](steps/M30-M33.md#s-291b) | feat: the end of side story 14 The Fourth Bough: the Meadow bough blossoms | [M30-M33](steps/M30-M33.md) | S-290, S-171 | S | - |
| 393 | [S-292](steps/M30-M33.md#s-292) | feat: the Dream framework: pastel 96 m arenas with one twist each | [M30-M33](steps/M30-M33.md) | S-045, S-286b, S-078 | M | - |
| 394 | [S-293](steps/M30-M33.md#s-293) | feat: Dreams of Captain Pinch, Frostbun and Sir Rollo | [M30-M33](steps/M30-M33.md) | S-292 | M | - |
| 395 | [S-294](steps/M30-M33.md#s-294) | feat: Dreams of Mossmantle, Old Gloop and Lady Honksworth | [M30-M33](steps/M30-M33.md) | S-293 | M | - |
| 396 | [S-295](steps/M30-M33.md#s-295) | feat: Dreams of the Wickwork Moth, Lumbra and Lady Fumarole; side story 51 Dream a Little | [M30-M33](steps/M30-M33.md) | S-294, S-078 | M | - |
| 397 | [S-296](steps/M30-M33.md#s-296) | chore: close M33: Dreams documented | [M30-M33](steps/M30-M33.md) | S-295, S-291b, S-001 | S | - |

<a id="m34"></a>

## M34 · The Hundred Lamps, Hoot's Margins and the last gem sinks

**Goal.** The last optional dungeon, Hoot's notebook realm, Nook furnishings, hood trims, the remaining shop stock and plushies, so the economy closes.

**Entry.** M33 closed; owner decision 6 (hood trims) answered after the side-by-side.

**Exit criteria (what the player can do).** Pip descends ten remixed floors to the Three Corners Jamboree, helps Hoot finally be right inside his notebook, furnishes his Nook, picks a hood trim and fills the plushie shelf (16).

**Play added.** +4 h · **Steps** S-297 - S-306 (13)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 398 | [S-297](steps/M34-M35.md#s-297) | feat: the Hundred Lamps floors 1-5: harder remixes of every mechanic | [M34-M35](steps/M34-M35.md) | S-286b, S-053 | M | - |
| 399 | [S-298](steps/M34-M35.md#s-298) | feat: the Hundred Lamps floors 6-9 | [M34-M35](steps/M34-M35.md) | S-297 | M | - |
| 400 | [S-299](steps/M34-M35.md#s-299) | feat: the Three Corners Jamboree and side story 50 | [M34-M35](steps/M34-M35.md) | S-298, S-044, S-074 | M | - |
| 401 | [S-300](steps/M34-M35.md#s-300) | feat: Hoot's Margins: a pencil-and-paper variant of Pinewhistle | [M34-M35](steps/M34-M35.md) | S-188, S-106b | M | - |
| 402 | [S-301a](steps/M34-M35.md#s-301a) | feat: ink-trace puzzles: numbered ink pots ink Hoot's twelve Corrections into the Margins (hidden) | [M34-M35](steps/M34-M35.md) | S-300 | M | - |
| 403 | [S-301b](steps/M34-M35.md#s-301b) | feat: side story 52 Hoot's Last Paper, and the Margins open | [M34-M35](steps/M34-M35.md) | S-301a | M | - |
| 404 | [S-302a](steps/M34-M35.md#s-302a) | feat: Nook furnishings framework, shop sections and every earned gift on display | [M34-M35](steps/M34-M35.md) | S-056b, S-078 | M | - |
| 405 | [S-302b](steps/M34-M35.md#s-302b) | feat: the 24 Nook furnishings, code-built at their fixed spots | [M34-M35](steps/M34-M35.md) | S-302a | M | - |
| 406 | [S-302c](steps/M34-M35.md#s-302c) | art: painted textures and shop icons for the 24 Nook furnishings | [M34-M35](steps/M34-M35.md) | S-302b, S-029b | S | - |
| 407 | [S-303](steps/M34-M35.md#s-303) | feat: hood trims tint the hood in third person (after a side-by-side) | [M34-M35](steps/M34-M35.md) | S-302a | M | - |
| 408 | [S-304](steps/M34-M35.md#s-304) | feat: the last shop stock: Swift Fluff, Sling quick-draw, potion belts 4-5 and the Hundred-Year Hanky | [M34-M35](steps/M34-M35.md) | S-092, S-078 | M | - |
| 409 | [S-305](steps/M34-M35.md#s-305) | feat: all 16 plushies on the Nook shelf | [M34-M35](steps/M34-M35.md) | S-045, S-302b | S | - |
| 410 | [S-306](steps/M34-M35.md#s-306) | chore: close M34: economy closes | [M34-M35](steps/M34-M35.md) | S-303, S-304, S-305, S-299, S-301b, S-302c, S-001, S-030 | S | - |

<a id="m35"></a>

## M35 · Release polish: art refresh, final budgets and the 100 % audit

**Goal.** Phase P14 leftovers and a final proof that the game holds together at 100 %.

**Entry.** M34 closed.

**Exit criteria (what the player can do).** New key art with the steel sword, loading cards for every land, a final performance and precache audit, and a 100 % chapter chain that runs New Game to the true ending.

**Play added.** 0 h (quality) · **Steps** S-307 - S-311 (5)

| # | id | title | step file | depends on | size | save |
|---|---|---|---|---|---|---|
| 411 | [S-307](steps/M34-M35.md#s-307) | art: key art and title painting refreshed with the steel sword | [M34-M35](steps/M34-M35.md) | S-286b, S-029b | M | - |
| 412 | [S-308](steps/M34-M35.md#s-308) | art: loading cards and tips for every land | [M34-M35](steps/M34-M35.md) | S-307, S-029b | M | - |
| 413 | [S-309](steps/M34-M35.md#s-309) | perf: checkpoint 8: final budgets in every realm and the precache | [M34-M35](steps/M34-M35.md) | S-308, S-074, S-196 | M | - |
| 414 | [S-310](steps/M34-M35.md#s-310) | test: the chapter chain proves New Game to the true ending at 100 % | [M34-M35](steps/M34-M35.md) | S-309, S-290, S-295, S-301b, S-030, S-074 | M | - |
| 415 | [S-311](steps/M34-M35.md#s-311) | chore: close M35: DESIGN and ARCHITECTURE describe the finished game | [M34-M35](steps/M34-M35.md) | S-310, S-001 | S | - |

---

## Appendix A: canon coverage (where each canon item is built)

**Lands (overworld).** Duskwick: S-083, S-084a, S-084b, S-085, S-086a, S-086b, S-088, S-089, S-091 · Pinewhistle: S-096, S-097a, S-097b, S-098, S-099a, S-099b, S-100, S-101a, S-101b, S-106a, S-106b · Archwater: S-117, S-118a, S-118b, S-119, S-120a, S-120b, S-121, S-123, S-127a, S-127b · Threemills: S-138, S-139a, S-139b, S-140, S-141, S-142, S-144, S-148a, S-148b · The Rootdeep: S-175, S-176, S-177, S-178, S-179, S-180, S-191a, S-191b · The Glassway: S-200, S-201a, S-201b, S-202, S-203, S-204, S-205, S-205b · Kettle Isle: S-222, S-223a, S-223b, S-224, S-225, S-226, S-228, S-232a, S-232b · Saltglass Flats: S-243, S-244, S-245, S-246, S-247, S-249a, S-249b, S-254, S-254d · Driftholm: S-262, S-263, S-264, S-265, S-266, S-267a, S-267b · The Starmeadow: S-274, S-275a, S-275b, S-276, S-277a, S-277b, S-278a, S-278b · The Crown: S-283

**Variant realms.** Remembered Isle: S-188, S-189, S-190a, S-190b, S-190c · Moonmere: S-218a, S-218b, S-219 · Hundred-Year Night: S-288a, S-288b, S-289, S-290 · Hoot's Margins: S-300, S-301a, S-301b · Guardian Dreams: S-292, S-293, S-294, S-295

**Dungeons.** d1 Under the Roots: S-059, S-060, S-060b, S-061a, S-061b · d2 Whistlehollow: S-103, S-104, S-104b, S-105 · d3 Undertow Grotto: S-124, S-125, S-125b, S-126 · d4 Granary Vaults: S-145, S-146, S-146b, S-147 · d5 Lamplighters' Tower: S-162a, S-162b, S-163, S-163b, S-164 · d6 Rootdeep Heart: S-183, S-184, S-184b, S-185 · d7 Sunken Bell: S-209, S-210, S-210b, S-211 · d8 Kettle's Belly: S-229, S-230, S-230b, S-231 · d9 Buried Academy: S-250, S-251, S-251b, S-252, S-253 · d10 Spiral Stair: S-269, S-270, S-270b, S-271 · d11 Ladder of Lights: S-280, S-281, S-282, S-284, S-285, S-286a, S-286b · o1 Snowglobe: S-238, S-239a, S-239b · o2 Grumble's Undercap: S-194, S-195 · o3 Merry Mabel: S-214a, S-214b · o4 Hundred Lamps: S-297, S-298, S-299 · 24 Hollows: S-073, S-093, S-093b, S-107, S-107b, S-129, S-129b, S-149, S-149b, S-186, S-186b, S-220, S-220b, S-234, S-234b, S-255, S-255b, S-267a, S-267b

**Tools.** Glowbud Lantern: S-057 · Leaf Glider: S-102a, S-102b · Tide Bell: S-122a, S-122b · Thistle Hook: S-143a, S-143b · Sunglass: S-160, S-161a, S-161b, S-161c · Digging Paws: S-181a, S-181b · Starsong: S-208 · Ember Sling: S-227a, S-227b · Ivy Gloves: S-248a, S-248b · Cloudstep: S-268 · the Dandelion: S-068a, S-068b, S-081, S-198, S-199 · Starsteel / thornvine / thornglass: S-013, S-233a, S-233b

**Story beats.** I.1-I.5: S-008, S-009, S-010, S-011, S-005, S-006, S-012 · I.6: S-064, S-065, S-066 · ch7: S-067, S-068a, S-068b · ch8: S-090, S-091 · ch9-11 + II.M: S-106a, S-106b, S-127a, S-127b, S-148a, S-148b, S-128 · ch12: S-165a, S-165b · ch13: S-191a, S-191b · ch14: S-203 · ch15-17: S-212a, S-212b, S-212c, S-212e, S-232a, S-232b, S-254, S-254d, S-254b · ch18: S-264, S-271, S-272 · ch19-21: S-278a, S-278b, S-280, S-283, S-284, S-285, S-286a, S-286b · ch22: S-288a, S-288b, S-289, S-290

**Systems.** Journal, quests, hints: S-032a, S-032b, S-034, S-036, S-037a, S-037b, S-038a, S-038b · Collections and completion: S-071, S-072, S-073, S-074, S-075a, S-075b, S-076, S-161a, S-161b, S-161c · Travel: S-080, S-081, S-182, S-198, S-199, S-264 · Economy: S-078, S-092, S-157a, S-157b, S-302a, S-302b, S-302c, S-303, S-304, S-305 · Activities (12): S-112, S-076, S-206, S-136, S-158b, S-133a, S-133b, S-154, S-216a, S-216b, S-237a, S-237b

## Appendix B: bible anchors cited by steps (the minimum each file must define)

- **art-audio.md**: `home` (S-009), `music-home` (S-010), `brief-template` (S-014+), `palettes` (S-027), `music` (S-028), `bundles` (S-029a+), `ui` (S-037a+), `cards` (S-046), `dungeon-kit` (S-051), `under-roots` (S-062), `horizon` (S-064), `loading-cards` (S-081+), `lamplighter-kit` (S-082a+), `duskwick` (S-085), `pinewhistle` (S-098), `archwater` (S-119), `threemills` (S-140), `rootdeep` (S-177), `young-cast` (S-189), `glassway` (S-202), `fish` (S-207), `kettle` (S-224), `saltglass` (S-245), `driftholm` (S-265), `starmeadow` (S-275a+), `hood-trims` (S-303), `key-art` (S-307)
- **atlas-far.md**: `rootdeep` (S-175+), `glassway` (S-200+), `kettle` (S-222+), `saltglass` (S-243+), `driftholm` (S-262+), `starmeadow` (S-274+), `crown` (S-283)
- **atlas-home.md**: `placeReasons` (S-004), `great-tree` (S-009+), `healed-states` (S-011), `sky` (S-011b+), `placeThorns` (S-013), `placePortals` (S-026), `interiors` (S-054), `pips-nook` (S-056a+), `placeJetty` (S-068a+), `hollows` (S-073), `vistas` (S-076), `puddles-grotto` (S-077), `glide-finds` (S-102a+), `tide-finds` (S-122a+), `hook-finds` (S-143a+), `village-works` (S-157a+), `acorns` (S-161a+), `old-beacons` (S-169), `dig-spots` (S-181a+), `remembered-isle` (S-188+), `star-doors` (S-208), `moonmere` (S-218a+), `bell-targets` (S-227a+), `ivy-finds` (S-248a+), `starstair` (S-264), `sky-nook` (S-268), `hundred-year-night` (S-288a+)
- **atlas-isles.md**: `shared` (S-082a+), `duskwick` (S-083+), `pinewhistle` (S-096+), `archwater` (S-117+), `threemills` (S-138+), `hoots-margins` (S-300)
- **cast.md**: `catchers` (S-006+), `home` (S-012+), `wenna` (S-065), `nell` (S-068a+), `granny-wick` (S-088), `flick` (S-088), `mote` (S-090+), `kinako` (S-092), `elder-nutmeg` (S-099a+), `professor-pinfeather` (S-099a+), `rook` (S-113), `grandpa-dormy` (S-115), `skipper-rafferty` (S-120a+), `granny-mochi` (S-134), `hazel-thimble` (S-135), `the-hayburys` (S-141), `goody-gander` (S-141), `pennywhistle` (S-141), `primrose-thistledown` (S-156), `gran-burrows` (S-178), `young-cast` (S-189), `postmistress-pell` (S-203), `mr-whelk` (S-203), `master-scoria` (S-225), `pitch` (S-225), `soakley` (S-225), `sable` (S-246), `the-nimbles` (S-266), `old-mother-brightwell` (S-276), `the-twinklings` (S-276)
- **charter.md**: `invariants` (S-001), `tone` (S-002a+), `close-out` (S-007+), `budgets` (S-022+)
- **creatures.md**: `boss-grumble` (S-005), `archetypes` (S-040+), `boss-framework` (S-043+), `bestiary` (S-046), `enemy-dimling` (S-058), `boss-rollo` (S-061a+), `enemy-sizzle-beetle` (S-089), `enemy-coco-clonk` (S-089), `enemy-mossling` (S-100), `enemy-pinecone-puff` (S-100), `enemy-bark-beetle` (S-100), `enemy-needle-wasp` (S-100), `boss-mossmantle` (S-105), `enemy-tidepool-jelly` (S-121), `enemy-squirt-urchin` (S-121), `enemy-sand-snapper` (S-121), `boss-gloop` (S-126), `enemy-field-vole` (S-142), `enemy-scarecrowlet` (S-142), `enemy-woolly-ram` (S-142), `boss-honksworth` (S-147), `boss-wickwork-moth` (S-164), `enemy-glow-grub` (S-179), `enemy-drip-bat` (S-179), `enemy-pebble-mimic` (S-179), `boss-lumbra` (S-185), `enemy-bubble-puffer` (S-204), `enemy-gullgrab` (S-204), `boss-pelagia` (S-211), `boss-bosun-snore` (S-214a+), `enemy-hushling` (S-218a+), `enemy-soot-snuffle` (S-226), `enemy-steam-puff` (S-226), `enemy-ash-moth` (S-226), `boss-fumarole` (S-231), `boss-flurry` (S-239a+), `enemy-sandsnoot` (S-247), `enemy-prickle-pear` (S-247), `enemy-sun-beetle` (S-247), `enemy-dust-puff` (S-247), `boss-scarabelle` (S-252+), `enemy-nimbus-puff` (S-266), `enemy-gust-kite` (S-266), `boss-mote-chase` (S-271), `enemy-stardust-sprite` (S-277a+), `enemy-comet-pup` (S-277a+), `enemy-moonbeam-turret` (S-277a+), `enemy-wisp-lantern` (S-277a+), `finale` (S-284+), `dreams` (S-292+), `boss-jamboree` (S-299)
- **dungeons.md**: `format` (S-049+), `kit` (S-051), `entities` (S-052+), `d1` (S-057+), `hollows` (S-073+), `d2` (S-103+), `d3` (S-124+), `d4` (S-145+), `d5` (S-162a+), `d6` (S-183+), `o2` (S-194), `d7` (S-209+), `o3` (S-214a+), `d8` (S-229+), `o1` (S-238), `d9` (S-250+), `d10` (S-269+), `d11` (S-280+), `o4` (S-297+)
- **lore.md**: `myth` (S-008), `bottles` (S-075a+), `lamp-logs` (S-075a+), `memories` (S-190a+), `mote-letters` (S-219), `mem-10` (S-254b), `mem-11` (S-254b), `mem-12` (S-254b), `pip` (S-289)
- **side-content.md**: `ss-07` (S-077), `ss-19` (S-110a+), `ss-20` (S-110a+), `ss-21` (S-111), `ss-22` (S-111), `act-dash` (S-112+), `ss-49` (S-113+), `ss-01` (S-114+), `ss-02` (S-115), `ss-23` (S-131a+), `ss-24` (S-131a+), `ss-25` (S-132), `ss-26` (S-132), `act-juggling` (S-133a+), `act-lagoon-lights` (S-133a+), `ss-03` (S-134+), `ss-05` (S-135), `ss-06` (S-136), `act-regatta` (S-136), `ss-27` (S-152a+), `ss-28` (S-152a+), `ss-29` (S-153a+), `ss-30` (S-153a+), `act-harvest-cut` (S-154), `ss-04` (S-155), `ss-08` (S-156), `act-sledding` (S-158a), `act-spore-rally` (S-158b), `ss-15` (S-167a+), `ss-16` (S-167a+), `ss-17` (S-168a+), `ss-18` (S-168a+), `ss-14` (S-171), `ss-13` (S-172), `ss-31` (S-192), `ss-32` (S-192), `ss-33` (S-193), `ss-11` (S-195), `act-fishing` (S-206+), `ss-34` (S-215), `ss-35` (S-215), `ss-36` (S-216a+), `ss-37` (S-216a+), `act-bell-duel` (S-216a+), `ss-09` (S-217), `ss-47` (S-219), `ss-38` (S-233a+), `ss-39` (S-236a+), `ss-40` (S-236a+), `ss-41` (S-237a+), `act-sling-gallery` (S-237a+), `act-steam-hop` (S-237a+), `ss-12` (S-239a+), `ss-10` (S-240), `ss-42` (S-258a+), `ss-43` (S-258a+), `ss-44` (S-259), `ss-45` (S-267a+), `ss-46` (S-267a+), `ss-48` (S-291a+), `ss-53` (S-291a+), `ss-51` (S-295), `ss-50` (S-299), `ss-52` (S-301a+), `nook` (S-302a+), `plushies` (S-305)
- **story.md**: `I.2` (S-004+), `I.1` (S-008+), `memory-lines` (S-012), `scene-format` (S-034), `act-I` (S-036+), `wenna-lines` (S-065+), `I.6` (S-066), `ch7` (S-067), `I.5` (S-067), `ch8` (S-090+), `motes-traces` (S-090b), `set-pieces` (S-091b+), `ch9-11` (S-106a+), `beacon-1` (S-106a+), `loop-variations` (S-127d+), `II.M` (S-128), `beacon-3` (S-148a+), `ch12` (S-165a+), `act-II-reactions` (S-170), `ch13` (S-190a+), `ch14` (S-203+), `stone-beats` (S-212a+), `act-III` (S-212d), `ch15-17` (S-232a+), `act-III-reactions` (S-260), `ch18` (S-264+), `ch19` (S-278a+), `ch20` (S-280), `ch21` (S-284+), `lantern-chain` (S-286a+), `ch22` (S-289+)
- **systems.md**: `journal` (S-002a+), `save-plan` (S-003+), `gates` (S-013+), `realms` (S-016+), `test-harness` (S-022+), `conditions` (S-025), `portals` (S-026+), `dialogue` (S-032a+), `scenes` (S-034), `items-tools` (S-035+), `quests` (S-036), `hints` (S-038a+), `economy` (S-045+), `abilities` (S-048+), `collectibles` (S-071+), `hearts` (S-072), `completion` (S-074+), `travel` (S-080+), `beacons` (S-095a+), `schedules` (S-174), `boat` (S-198+)

Section 2 of this index also cites `atlas-home#passes` (the table of taken post-pass RNG constants) and `art-audio#style` (the style guide and prompt preamble).

Every anchor is written as an explicit `<a id="..."></a>` immediately before its heading; S-001 adds `tests/docs.test.js`, which fails on a missing one.
