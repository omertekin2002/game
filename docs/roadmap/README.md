# docs/roadmap: the plan for Starseed Isle, "The Hundred-Year Letter"

This folder is the complete plan that turns today's 3-hour Starseed Isle into an **80-120 hour storied open world**,
and the rulebook for building it. It is written for the build pipeline's agents: the **plan job** that files one
`agent:improvement` issue per turn, and the **implement job** that builds that issue as one PR into
`agent/improvements`. The owner adopted it as the vision's Direction on 2026-11-21 (vision issue #1, Owner
directives). Nothing here needs a new account, key, paid service or GUI.

**Read in this order:** this README → [`INDEX.md`](INDEX.md) (the ordered step list) → the step's own section in
[`steps/`](#files) → the bible anchors that section links → [`CANON.md`](CANON.md) only when a fact is in doubt.

<a id="contents"></a>

**Contents:** [The target game](#target) · [Files](#files) · [Order of authority](#authority) ·
[Plan protocol](#plan-protocol) · [The vision issue](#vision) · [Implement protocol](#implement-protocol) ·
[Invariants](#invariants) · [Art and the owner's brief batches](#art) · [Milestones](#milestones) ·
[Hour budget](#hours) · [Keeping it true](#keeping)

---

<a id="target"></a>

## 1. The target game (one page)

**Premise.** Every hundred years the Great Tree, **Wenna**, sneezes, and nobody remembers why. This time Pip, a small
boy in a leaf-green fox-eared hood, carries her three Starseeds home (the shipped game), and she wakes up properly for
the first time in a century. Her first words are "thank you". Her next are "Pip, look. Someone is putting out the
lights." Across the sea the lamps of the neighbouring isles go dark one by one, and a streak of light climbs to the
floating isle in the north-east sky. The "Lamp Thief" is **Mote**, Wenna's little brother: a star who came down a
hundred years ago to bring his sister home and has been stranded on that sky isle ever since. He is not wrong that
she is tired; he is wrong about what she wants. Pip relights the isles with Wenna's own light, learns the true history
from her roots, rebuilds the old stair to the sky, and in the end everyone Pip helped gives Mote a lantern so he can
climb home. The true ending reveals who wrote the bottle Pip found on day one.

**Theme.** Light is something you give, not something you take; family is whoever keeps you. Emotional arc: wonder →
worry → understanding → letting go → belonging. Gentle throughout: enemies poof, Pip gets dizzy, bosses sit down and
talk, nothing earned is taken back, nothing is missable ([tone charter](bible/charter.md#tone)).

**Structure.** Four acts with counts **3 · 3+1 · 3 · 1**, then a true ending. Free order inside every act, fixed
order between acts. Plot lines are keyed to counts (seeds home, beacons lit, stones set), so every order reads as
written. Every success changes the world within 10 s, where it was earned and in the Great Tree's crown.

| Act | Chapters | What the player does | Main-path hours (CANON §4.1) |
|---|---|---|---|
| I · The Sneeze | 1-6 | the shipped game, deepened: guardians with kind reasons who hand the seeds over, the myth in instalments, the bloom; Wenna wakes | 4.0 |
| Interlude · Under the Roots | 7 | Pip's Nook, the first dungeon, the Glowbud Lantern, Nell's Jetty and the boat *Dandelion* | 1.25 |
| II · The Dimming | 8-12 | Duskwick first; Pinewhistle, Archwater and Threemills in any order (people → dungeon → Warden → kindle the beacon); Mote named at the midpoint; the Lamplighters' Tower, where Mote takes the Firstlight | 13.5 |
| III · The Remembering | 13-18 | the Rootdeep under home and twelve playable memories; the Glassway by free sailing; three Stair Stones (Sunken Bell, Kettle Isle, Saltglass Flats) in any order; the Starstair to Driftholm and a chase up the Spiral Stair | 17.25 |
| IV · The Lantern Sky | 19-21 | the Starmeadow and the Starkin; the Ladder of Lights; the Crown and the Second Sneeze (Mote is never hit) | 4.0 |
| Post | 22 | the Hundred-Year Night (true ending), 10 Guardian Dreams, the Hundred Lamps, Hoot's Margins, The Planting, 100 % | in post-game |

**Scale.** 10 new overworld lands plus the frozen home island: **1.29 km² of walkable land, 25 times today's island**
(Duskwick, Pinewhistle, Archwater, Threemills, the Rootdeep, the Glassway, Kettle Isle, Saltglass Flats, Driftholm,
the Starmeadow), the Crown, 5 variant realms (the Remembered Isle, Moonmere, the Hundred-Year Night, Hoot's Margins,
10 Guardian Dreams), and interiors. Every land follows the home grammar: 4 regions with name cards, a landmark visible
from each region's entry, a keepsake behind every landmark, a safe village, 4-6 Lamplighter benches, a root-gate, and
at least one point of interest per 1,250 m², proved by a generator test over every 40 × 40 m cell. **15 dungeons**
(11 story, 4 optional) and **24 Hollows** (8 of them 3-room Deep Hollows), all text tile maps proved soft-lock free by
a solver. **10 tools** (Lantern, Glider, Tide Bell, Hook, Sunglass, Digging Paws, Starsong, Ember Sling, Ivy Gloves,
Cloudstep) plus the boat. **32 new enemy species**, 14 story encounters, about **50 named characters**, **53 side
stories**, **12 activities**, **10 collectible kinds** with a home for each, **14 hearts**, and a journal (Professor
Hoot's Field Notes: Quests, Items, Bestiary, Lore, Map, Completion).

**Hours** (modelled, CANON §11): **main story 40 h**, main + most side stories about 62 h, **100 % about 95 h**
(band 84-112). Exploring every land fully takes 28-34 h; just setting foot in every region and seeing every landmark
once takes 10-12 h. `tools/hours.mjs` and `tests/hours.test.js` (S-078b) prove the figure from the content tables.

**Build.** 415 steps in 35 milestones, from `main` at `b79d73d` (save v6). Engine first (realms,
saves, story systems, combat and dungeon frameworks), then lands in story order. Main stays releasable after every
PR: unbuilt isles are fog banks on the chart ("Nell won't risk the fog yet."), unfinished realms stay `hidden: true`,
and an act card ships only with the content behind it. Main story complete at M32, true ending at M33, 100 % at M34,
polish in M35.

---

<a id="files"></a>

## 2. Files

| Path | What it is | Lands in |
|---|---|---|
| `README.md` | this file: the target game, both protocols, invariants, art process, milestones, hours | S-001 |
| [`INDEX.md`](INDEX.md) | **the ordered step list**: protocol summary (§1), invariants (§2), save versions (§3), test infrastructure (§4), step sizes (§5), pacing (§6), owner decisions (§7), bible map (§8), the milestone overview, one table per milestone (# · id · title · step file · depends on · size · save), canon coverage, bible anchors. Generated | S-001 |
| [`CANON.md`](CANON.md) | the decided canon: premise, glossary, cosmology, every act and beat, the atlas, cast arcs, enemies, dungeons, bosses, side content, hours (§11), pacing rules (§12), tone (§13), build order (§14), owner decisions (§15). "CANON §n" anywhere means its section n | S-001 |
| [`CANON-NOW.md`](CANON-NOW.md) | what the shipped game already says and does; its LOCKED items outrank everything. "CANON-NOW section n" | S-001 |
| `tools/` | the index generator: `build-step-index.sh` (rebuild + check), `build-index.py`, `step-index-src.py` (milestone texts, `check`), `step-index-head.md` (INDEX's text above the tables), `coverage.py` (Appendix A) | S-001 |
| [`bible/charter.md`](bible/charter.md) | tone charter, voice rules, the UI verb list, naming and originality rules, the glossary index, the invariants block, budgets, the close-out checklist | S-001 |
| [`bible/lore.md`](bible/lore.md) | cosmology, true timeline, twists T1-T7, full texts of the myth, 12 bottle letters, 30 Lamp Logs, Mote's 12 unsent letters, 7 night stories, 12 memory scenes | S-001 |
| [`bible/story.md`](bible/story.md) | acts, chapters 1-22, every beat id and flag, scene scripts, count-keyed line matrices, act cards, both endings | S-001 |
| [`bible/cast.md`](bible/cast.md) | about 50 characters: species, size, palette, look, tic, homes, schedules, arcs, portrait prompts, ART BRIEFs | S-001 |
| [`bible/atlas-home.md`](bible/atlas-home.md) | the frozen home island: every post-pass and its RNG constants (`#passes`), the Great Tree crown, home interiors, home variants, tool-gated home finds | S-002a |
| [`bible/atlas-isles.md`](bible/atlas-isles.md) | Duskwick, Pinewhistle, Archwater, Threemills, Hoot's Margins and the Lamplighter kit, per land: seed, grid, recipe, palette, regions, POIs, collectibles, enemies, interiors, prop kit with ART BRIEFs, coverage plan | S-002a |
| [`bible/atlas-far.md`](bible/atlas-far.md) | the Rootdeep, Glassway, Kettle Isle, Saltglass Flats, Driftholm, Starmeadow and Crown on the same template; travel geography | S-002a |
| [`bible/dungeons.md`](bible/dungeons.md) | tile-map format and legend, the interior kit, puzzle entities, every dungeon room by room, the 24 Hollows, the Hundred Lamps | S-002a |
| [`bible/creatures.md`](bible/creatures.md) | the archetype framework, 32 enemy species, the boss framework and every boss, Dreams, the finale, the Jamboree | S-002a |
| [`bible/systems.md`](bible/systems.md) | realms, portals, the save plan, conditions and flags, dialogue, scenes, quests, journal, items and tools, travel, collectibles, hearts, completion, economy, test harness | S-002a |
| [`bible/side-content.md`](bible/side-content.md) | the 53 side stories (`ss-01` … `ss-53`), the 12 activities, Nook furnishings, plushies, Village Works | S-002a |
| [`bible/art-audio.md`](bible/art-audio.md) | style guide and image-prompt preamble (`#style`, `#preamble`), processing pipeline, manifest keys, per-realm asset lists, PWA bundles, the ART BRIEF template, music and SFX | S-002a |
| `steps/M01-M04.md` … `steps/M13-M14.md` | issue-ready step specs, M01-M14 (each `### S-xxx` section is one issue body; each file also has milestone notes, conventions, bible reconciliations and Index changes) | S-002b |
| `steps/M15-M17.md` … `steps/M34-M35.md` | the same for M15-M35 | S-002c |
| `progress.md` | dated close-out entries: steps done, perf numbers, precache and save size, modelled hours | S-007 |
| `briefs/batch-NN.md` | the 15 ART BRIEF batches for the owner | S-014 onward |
| `hours.json` | modelled hours per milestone, written by `tools/hours.mjs` | S-078b |

The eleven step files: [M01-M04](steps/M01-M04.md), [M05-M08](steps/M05-M08.md), [M09-M12](steps/M09-M12.md),
[M13-M14](steps/M13-M14.md), [M15-M17](steps/M15-M17.md), [M18-M20](steps/M18-M20.md), [M21-M23](steps/M21-M23.md),
[M24-M26](steps/M24-M26.md), [M27-M29](steps/M27-M29.md), [M30-M33](steps/M30-M33.md), [M34-M35](steps/M34-M35.md).

<a id="authority"></a>

## 3. Order of authority

[`CANON-NOW.md`](CANON-NOW.md) LOCKED items > [`CANON.md`](CANON.md) > the **Bible reconciliations** rows in
`steps/*.md` (for the topics they name, until the named close-out edits the losing file) > the bible (`bible/*.md`) >
the `INDEX.md` row > the issue. A step file's reconciliation table deliberately overrides the bible file it names; any
other contradiction between a step and the bible is a bug in the step. When two bible files disagree, the file that
**defines** the thing wins ([glossary index](bible/charter.md#glossary)). Older text that says `STEP-INDEX` means
`INDEX.md`.

---

<a id="plan-protocol"></a>

## 4. The step protocol for plan jobs

The owner chose this direction. **No council is needed to pick or shape a step**: the steps are the plan, and filing
the next one is the next slice of the Direction (plan.md, "the next slice of a direction already chosen"). The council
is only for product questions a step leaves open.

**Each plan turn:**

1. **Broken things first** (plan.md priority 1): failing CI on `main` or the stack, bugs, security. If there are any,
   file that fix instead of a step, and stop.
2. **Handed-back questions.** If an implement job closed a step's issue as *not planned* with a 🤖 product question,
   settle it with the council (plan.md "The council"), record the `🤖 Council:` comment, update the step file's
   section in the same PR that builds it (or note the answer in the re-filed issue's `## Why` under
   `Council: <link>`), and re-file the step as a new issue. If the owner closed a step's issue or rejected it in an
   umbrella PR, do not re-file it: record that in the vision Log and file the next step.
3. **Pick the step.** Take the row of [`INDEX.md`](INDEX.md) with the **lowest #** that
   - has no issue yet: `gh issue list --repo omertekin2002/game --state all --search "S-xxx in:title" --json number,title,state`
     and check that no returned title ends in `(S-xxx)` exactly;
   - has every dependency in its "depends on" column either **merged on `main`** (its issue is closed as completed)
     or **stacked on `agent/improvements`** (its issue has the label `agent:stacked`). A dependency on a split id
     (`S-029`) means its last part (`S-029b`); INDEX already shows the resolved ids.

   The # order is the filing order (INDEX §1.8 reorders M05 before M03-M04) and a topological order of the
   dependencies, so normally the next row is simply the next #. Never file past an act-card step (S-067, S-165a,
   S-165b, S-272, S-286a, S-286b) while it is unfiled. A row may be filed out of order only when every lower row is
   blocked, and only if no file or debug hook its text names comes from a step that is not yet stacked.
4. **File it**, exactly:
   - **Title:** the step heading's text after `S-xxx · `, then a space and the id in brackets:
     `### S-024 · feat: save v8 adds …` → `feat: save v8 adds … (S-024)`.
   - **Label:** `agent:improvement`.
   - **Body:** the step's whole `### S-xxx` section from its step file, **pasted verbatim**, with these mechanical
     changes only: the `#### Why`, `#### What`, `#### Acceptance criteria`, `#### Verification plan`,
     `#### Out of scope` and `#### Risk & rollback` headings become `##`; the `#### Assets` block moves inside
     `## What` as `### Assets`; the header line (`Milestone Mxx · Depends on: … · Size: … · Save: …`) goes at the top
     of `## Why`; relative links (`../bible/x.md#a`, `#anchor`) become absolute
     `https://github.com/omertekin2002/game/blob/main/docs/roadmap/...` links once the files are on `main` (before
     S-002c lands, leave them relative). The first two lines of `## Why` are:
     ```
     Vision: #1 — **Mxx · <milestone title>**
     Roadmap: docs/roadmap/INDEX.md S-xxx (docs/roadmap/steps/<file>.md)
     ```
     Never rewrite, shorten or "improve" the spec. If something in it is plainly wrong against the code (a renamed
     function, a moved line number), keep the text and add a 🤖 comment on the new issue with the correction.
   - Every body fits the 65,536-character issue limit (the largest section is about 15 KB).
5. **Update the vision issue** (#1): add the issue number to that milestone's `Work:` list in the Roadmap (keep
   `[partial]` on the item until the milestone's last step is filed), and append a Log line:
   `- YYYY-MM-DD: filed #n (S-xxx: <title>) for **Mxx · <title>**.`
6. **Finish** as plan.md step 5 says (`--filed <n>`).

**If a step turns out too big** (more than about 500 changed lines, data included, or more than one session), the
plan job files its first slice only: title `… (S-xxxa)`, the What cut to that slice, the rest listed under
`## Out of scope` as "S-xxxb". **The PR that ships the slice also edits the step file**: it replaces the
`### S-xxx` section with `### S-xxxa` and `### S-xxxb` sections (each with its own `<a id>`, header line and six
sections; `b` depends on `a`) and runs `sh docs/roadmap/tools/build-step-index.sh` so INDEX gains both rows. The
plan job then files `S-xxxb` as the next row. Ids are never renumbered. An implementer who discovers the size
mid-build does the same: ship `a`, add the sections, hand the rest back in a 🤖 comment.

**Never** file an `agent:decision` issue for a product question in these docs (INDEX §7: the CANON §15 defaults stand
unless the vision's Owner decisions or directives say otherwise). `agent:decision` stays for credentials, spending,
irreversible actions and personal content.

<a id="vision"></a>

## 5. The vision issue

The vision body is capped at 65,536 characters, so it only points here. Its **Direction** says the game is being
built as the 80-120 h storied open world in `docs/roadmap/`, set by the Owner directive of 2026-11-21. Its
**Roadmap** has one ordered item per milestone, in filing order (M01, M02, M05, M03, M04, M06 … M35), each:

```
N. **Mxx · <milestone title>** [agent-feasible]: <goal in one or two sentences>. Steps S-aaa..S-bbb in docs/roadmap/steps/<file>.md. Work: #n, #m.
```

plus one first item for leftovers outside the milestones (accessibility polish, housekeeping). The pump adds status
badges and the `✅ Done — ` marker; agents never write them. When a milestone's item is marked done, the plan job
moves one line about it into **Where it is today** (with the modelled hours from `progress.md` once S-078b has
landed) and drops it from the Roadmap. Close-out steps refresh "Where it is today" with the milestone's numbers.

---

<a id="implement-protocol"></a>

## 6. The protocol for implement jobs

1. **Follow the step's `## What` exactly**, item by item, and meet every acceptance criterion. Respect `## Out of
   scope`. The step names files, functions, line numbers (checked on `main` at `b79d73d`), RNG constants, save keys,
   text ids and test names on purpose: use them. Modules created by earlier steps are found by grep, not by guess
   (`grep -rn "export function generateRealm" js/`).
2. **Read every bible anchor the step links** (header line and body) before writing code, plus the step file's
   **Conventions** section and the milestone notes above the step. Text lines, numbers, palettes, prompts and tile maps
   come from the bible verbatim.
3. **Ambiguity.** If the step and its links leave a design question open, follow, in this order: the step file's
   **Bible reconciliations**, the bible file's **Decisions made here** section, then `CANON.md`. If it is still open,
   make the **smallest reasonable call** inside the step's scope that keeps the tone charter and the invariants,
   record it in the PR body under "Decisions made in this PR", and add one dated line to the owning bible file's
   "Decisions made here" section in the same PR. Only a question that would change the Direction or the step's goal is
   handed back (close the issue as *not planned* with a 🤖 comment, as the runbook says).
4. **Docs in the same PR.** Update `docs/DESIGN.md` (player-facing behaviour), `docs/ARCHITECTURE.md` (modules,
   save fields, hooks, post-pass constants) and the root `README.md` (controls, debug hooks, test commands) for what
   the PR changes. Close-out steps add the milestone's `progress.md` entry and its art brief batch.
5. **Tick nothing manually.** Do not edit INDEX.md status, the vision's badges or Done markers: the pump tracks status
   from issues and PRs. Edit a step file only to split a step (see the plan protocol) or when the step itself says so.
   After any step-file edit, run `sh docs/roadmap/tools/build-step-index.sh` and commit the regenerated INDEX.md.
6. **Verify** with the step's `## Verification plan` plus `bun test`, one heavy job at a time (one browser, one full
   suite) on the 12 GB machine. Every realm step runs its in-page `realm` suite; every quest step its chapter test.
7. **PR body:** what and why, the exact verification commands and results, risk and rollback, `Refs #n`, the stacked
   line, every ART BRIEF the PR introduces (template below), and "Decisions made in this PR" if any.

<a id="invariants"></a>

## 7. Invariants every step keeps

Each issue pastes the [invariants block](bible/charter.md#invariants-block) into its acceptance criteria, keeping the
lines that apply. In short:

- **Frozen home island.** `generateWorld(7151)` never changes; `tests/fixtures/world-prints.json` stays
  byte-identical. New home content is a **post-pass on its own `new RNG(7151 * k + c)` stream** following the
  `placeShells` rules (nearest-walkable around a named anchor, nothing added to other lists, `W.walk / W.reach`
  restored, a world test on seeds 1-40). Taken constants: [`bible/atlas-home.md#passes`](bible/atlas-home.md#passes).
  Each new realm's `tests/fixtures/realm-prints/<id>.json` is frozen in the PR that first generates it; after the realm
  is unhidden only post-passes add to it.
- **One save slot, migrations only.** Every schema change bumps `SAVE_VERSION` with a `MIGRATIONS[n]` step, tests
  from every older version and the `-bak` copy. The plan: v7 S-003 (`flags`), v8 S-024 (realm and content
  containers), v9 S-071 (collections; `maxHp` clamp 32), v10 S-199 (boat), v11 S-233a (Starsteel). Each bump depends on
  the previous one. Data that fits `flags`, `items`, `quests`, `collect` or the per-id maps never bumps the version.
  Content ids are namespaced `<realm>:<id>`. No v6 field moves or changes meaning.
- **Budgets per view, both cameras.** 60 fps target; main pass ≤ 200 draw calls, total ≤ 300, hard cap 350;
  ≤ 1.3 M triangles; 300 m far plane with fog outdoors (120 m in dungeons); realm generation ≤ 1.2 s on desktop;
  ≤ 24 instanced prop types and ≤ 12 new material programs per realm; core precache ≤ 30 MB, each realm bundle
  ≤ 2.5 MB without GLBs, lazy-loaded per realm. 8 perf checkpoints (S-047, S-087, S-109, S-151, S-196, S-261, S-287,
  S-309) measure them.
- **Hidden until whole.** A realm stays `hidden: true` (reachable only by `?realm=` and `G.debug.realm`) until the step
  that ships its main quest.
- **Assets are optional.** Every manifest key may be missing and has a procedural or canvas fallback and a `realm` tag
  when it belongs to one realm; `?noassets=all` still renders. **Pip's GLB is never replaced.**
- **Original IP only.** Never copy or imitate another game's names, characters, art, levels or story; generated
  images are original; briefs never name another game, studio or artist ([naming rules](bible/charter.md#originality)).
- **Tone charter** ([`bible/charter.md#tone`](bible/charter.md#tone)): towns spawn no enemies; enemies poof; Pip gets
  dizzy and never speaks; Pip never hits Mote; every attack is drawn at least 0.55 s ahead, at most two attackers at
  once; nothing earned is taken back; nothing is missable; no timed fail state; lines ≤ 220 characters; `~` only in
  Miso's speech; `{tokens}` for controls; ✿ for good news.
- **Releasable after every PR.** Prefer flags and parallel modules to big-bang swaps; CI stays green (`bun test`,
  `test:smoke`, `test:pwa`, `test:opening`, `test:playthrough`, the in-page suites, and from S-030 the chapter groups).
- **Machine.** One heavy job at a time on the 12 GB machine. No new accounts, API keys, paid services or GUI steps.

<a id="art"></a>

## 8. Art: what agents generate, and the owner's brief batches

**2D is generated inside the step that needs it.** Implementation agents cannot use paid or accounted generators,
but they can generate images: start a GPT Sol subagent through the T3 orchestrator's `delegate_task` and ask it to use
Codex's built-in `image_gen.imagegen` tool (Gemini through Antigravity can also generate images). Every asset spec in
a step says what to generate (the exact prompt, which always starts with the
[style preamble](bible/art-audio.md#preamble): soft painterly storybook style, original), size, transparency and
frames; how to process it (`tools/make_seamless.py` for tiling textures, `tools/slice_sheet.py`,
`tools/process_strip.py`, `tools/export_sprites.py`); the manifest key in `assets/manifest.js` (with its `realm` tag);
and the procedural fallback. Output is webp at sensible sizes, loaded lazily per realm so the PWA precache stays inside
its budget. Character portraits, sprites, billboard cards (foliage, sky, horizon, effects), seamless textures, UI
icons, map art, key art and loading cards are all made this way, and turnaround or concept sheets are generated as
references for code-built models. The owner prefers the soft painterly generated look over code-built for characters.

**3D is code-built, with an ART BRIEF.** Image generation cannot make GLBs, so every new 3D thing ships as a
procedural toon model in the existing style (`js/models.js`, `js/props.js`, `js/toon.js`), or reuses and recolours a
shipped GLB (the young cast and Kinako reuse the five character GLBs), and may use generated images as textures and
decals. Each one gets an ART BRIEF in its PR, in the [template](bible/art-audio.md#brief-template): what and where,
silhouette, size in m, palette hexes, materials, poly budget, pose and named nodes, the code fallback, an image prompt
and a 3D prompt.

**The owner's batch process.** At 15 close-outs (S-014, S-063, S-079, S-094, S-109, S-116, S-137, S-159, S-173, S-197,
S-221, S-242, S-261, S-279, S-306) the briefs of that stretch are collected into `docs/roadmap/briefs/batch-NN.md`.
Briefs only, no generation. Whenever the owner wants, they:

1. open the batch file and paste each brief's **3D prompt** (and its image prompt or the PR's reference sheet as the
   image input) into a 3D generator of their choice;
2. export a GLB per brief, single mesh, under the brief's triangle budget, feet at the origin, facing +Z, with the
   named nodes the brief lists;
3. drop the file into `assets/` and fill the brief's manifest key (with `height` and `realm`) in `assets/manifest.js`,
   or ask an agent to do that step;
4. run `node tools/normalize_glb.mjs` and the in-page view the brief names; the code fallback stays as the fallback.

No code change is needed for a GLB to replace its procedural model. Choosing to run a batch, and which generator to
use, is the owner's call and never blocks a step.

---

<a id="milestones"></a>

## 9. Milestones

The **#** column is the filing order ([INDEX](INDEX.md) has one table per milestone). "Play added" is the milestone's
budget, written before the 2026-11-22 playtime model; the model (CANON §11) puts the finished game at about 95 h for
100 % and 40 h for the main story. From S-078b, close-outs record modelled hours and the vision quotes those.

| Milestone | Act | Title | Steps | # | Count | Step file | Play added | Cumulative play (h) |
|---|---|---|---|---|---|---|---|---|
| [M01](INDEX.md#m01) | I | Canon in the repo; the Catchers hand over | S-001 - S-007 | 1-9 | 9 | [M01-M04](steps/M01-M04.md) | +0.3 h (Act I 3.0 -> 3.3 h) | 3.3 |
| [M02](INDEX.md#m02) | I | Act I deepened | S-008 - S-015 | 10-18 | 9 | [M01-M04](steps/M01-M04.md) | +0.7 h (Act I -> 4.0 h) | 4.0 |
| [M03](INDEX.md#m03) | engine | Realm engine I: many lands, one at a time | S-016 - S-023 | 33-40 | 8 | [M01-M04](steps/M01-M04.md) | 0 h | 4.0 |
| [M04](INDEX.md#m04) | engine | Realm engine II: saves, conditions, portals, palettes, bundles, chapters | S-024 - S-031 | 19-47 | 9 | [M01-M04](steps/M01-M04.md) | 0 h | 4.0 |
| [M05](INDEX.md#m05) | engine | Story systems: dialogue, scenes, items, quests and Hoot's Field Notes | S-032a - S-039 | 21-32 | 12 | [M05-M08](steps/M05-M08.md) | 0 h (quality of life) | 4.0 |
| [M06](INDEX.md#m06) | engine | Combat frameworks: archetypes, bosses, bestiary | S-040 - S-047 | 48-55 | 8 | [M05-M08](steps/M05-M08.md) | 0 h | 4.0 |
| [M07](INDEX.md#m07) | engine | Abilities and the dungeon engine | S-048 - S-158a | 56-64 | 9 | [M05-M08](steps/M05-M08.md), [M18-M20](steps/M18-M20.md) | 0 h | 4.0 |
| [M08](INDEX.md#m08) | Interlude | The Interlude I: Pip's Nook and Under the Roots | S-056a - S-063 | 65-75 | 11 | [M05-M08](steps/M05-M08.md) | 0 h visible (+3 h built, shipped in M09) | 4.0 |
| [M09](INDEX.md#m09) | Interlude | The Interlude II: Wenna wakes (Act I's turn ships) | S-064 - S-070 | 76-83 | 8 | [M09-M12](steps/M09-M12.md) | +3 h (Interlude 2.0 h + home finds) | 7.0 |
| [M10](INDEX.md#m10) | II | Collections, hearts and the Completion page | S-071 - S-079 | 84-94 | 11 | [M09-M12](steps/M09-M12.md) | +1 h | 8.0 |
| [M11](INDEX.md#m11) | II | Travel and the Duskwick land | S-080 - S-087 | 95-105 | 11 | [M09-M12](steps/M09-M12.md) | 0 h visible | 8.0 |
| [M12](INDEX.md#m12) | II | Duskwick and chapter 8: Act II opens | S-088 - S-094 | 106-115 | 10 | [M09-M12](steps/M09-M12.md) | +2 h | 10.0 |
| [M13](INDEX.md#m13) | II | Pinewhistle: the first isle (land template) | S-095a - S-109 | 116-139 | 24 | [M13-M14](steps/M13-M14.md) | +5 h | 15.0 |
| [M14](INDEX.md#m14) | II | Pinewhistle side stories, Rook and the first home stories | S-110a - S-116 | 140-147 | 8 | [M13-M14](steps/M13-M14.md) | +3 h | 18.0 |
| [M15](INDEX.md#m15) | II | Archwater and the midpoint | S-117 - S-130 | 148-169 | 22 | [M15-M17](steps/M15-M17.md) | +4.5 h | 22.5 |
| [M16](INDEX.md#m16) | II | Archwater side stories and home households I | S-131a - S-137 | 170-178 | 9 | [M15-M17](steps/M15-M17.md) | +3.5 h | 26.0 |
| [M17](INDEX.md#m17) | II | Threemills; the Tower unlocks | S-138 - S-151 | 179-198 | 20 | [M15-M17](steps/M15-M17.md) | +4.5 h | 30.5 |
| [M18](INDEX.md#m18) | II | Threemills side stories and Village Works | S-152a - S-159 | 199-209 | 11 | [M18-M20](steps/M18-M20.md) | +3.5 h | 34.0 |
| [M19](INDEX.md#m19) | II | The Lamplighters' Tower and the end of Act II | S-160 - S-166 | 210-221 | 12 | [M18-M20](steps/M18-M20.md) | +4 h | 38.0 |
| [M20](INDEX.md#m20) | II | Act II aftercare: Duskwick stories, old beacons, Wenna and the Catchers | S-167a - S-173 | 222-230 | 9 | [M18-M20](steps/M18-M20.md) | +2.5 h | 40.5 |
| [M21](INDEX.md#m21) | III | The Rootdeep: the land, the Heart and Lumbra | S-174 - S-187 | 231-247 | 17 | [M21-M23](steps/M21-M23.md) | 0 h visible (+3.5 h shipped with chapter 13) | 40.5 |
| [M22](INDEX.md#m22) | III | The Remembered Isle, chapter 13 and Grumble's Undercap | S-188 - S-197 | 248-260 | 13 | [M21-M23](steps/M21-M23.md) | +6 h | 46.5 |
| [M23](INDEX.md#m23) | III | The Glassway I: sailing and Puffin Post | S-198 - S-205b | 261-271 | 11 | [M21-M23](steps/M21-M23.md) | +2 h | 48.5 |
| [M24](INDEX.md#m24) | III | The Glassway II: fishing, the Starsong and the Sunken Bell | S-206 - S-213 | 272-284 | 13 | [M24-M26](steps/M24-M26.md) | +5 h | 53.5 |
| [M25](INDEX.md#m25) | III | Glassway stories, the Merry Mabel and Moonmere | S-214a - S-221 | 285-296 | 12 | [M24-M26](steps/M24-M26.md) | +4 h | 57.5 |
| [M26](INDEX.md#m26) | III | Kettle Isle: the forge, the Belly and Starsteel | S-222 - S-235 | 297-317 | 21 | [M24-M26](steps/M24-M26.md) | +5 h | 62.5 |
| [M27](INDEX.md#m27) | III | Kettle stories, the Snowglobe and the parcel chain | S-236a - S-242 | 318-327 | 10 | [M27-M29](steps/M27-M29.md) | +4.5 h | 67.0 |
| [M28](INDEX.md#m28) | III | Saltglass Flats and the third stone | S-243 - S-257 | 328-349 | 22 | [M27-M29](steps/M27-M29.md) | +5 h | 72.0 |
| [M29](INDEX.md#m29) | III | Saltglass stories and the road to the sky | S-258a - S-261 | 350-354 | 5 | [M27-M29](steps/M27-M29.md) | +2 h | 74.0 |
| [M30](INDEX.md#m30) | III | The Starstair, Driftholm and the end of Act III | S-262 - S-273 | 355-368 | 14 | [M30-M33](steps/M30-M33.md) | +4.5 h | 78.5 |
| [M31](INDEX.md#m31) | IV | The Starmeadow | S-274 - S-279 | 369-377 | 9 | [M30-M33](steps/M30-M33.md) | +2 h | 80.5 |
| [M32](INDEX.md#m32) | IV | The Ladder of Lights, the Crown and the Second Sneeze | S-280 - S-287 | 378-386 | 9 | [M30-M33](steps/M30-M33.md) | +5.5 h | 86.0 |
| [M33](INDEX.md#m33) | post | The Hundred-Year Night and Guardian Dreams | S-288a - S-296 | 387-397 | 11 | [M30-M33](steps/M30-M33.md) | +4.5 h | 90.5 |
| [M34](INDEX.md#m34) | post | The Hundred Lamps, Hoot's Margins and the last gem sinks | S-297 - S-306 | 398-410 | 13 | [M34-M35](steps/M34-M35.md) | +4 h | 94.5 |
| [M35](INDEX.md#m35) | polish | Release polish: art refresh, final budgets and the 100 % audit | S-307 - S-311 | 411-415 | 5 | [M34-M35](steps/M34-M35.md) | 0 h (quality) | 94.5 |

<a id="hours"></a>

## 10. Hour budget (CANON §11, modelled)

Buckets do not overlap; a careful first-time player. Per-beat model: simple puzzle beat 3 min, compound puzzle 6 min,
combat wave 1.5 min, story boss with one retry 4-5 min, act-closer boss 6-8 min, 1 min per room for walking and
pickups, a scene at its length × 1.2, an overworld quest step 5-10 min.

| Bucket | Contents | Hours |
|---|---|---|
| Main story incl. story dungeons | Act I 4.0 · Interlude 1.25 · Act II 13.5 (Duskwick + ch8 with *The Lamp Round* 1.25; three isles 3.25 each: people steps, Mote's trace, the land's set piece, a deepened dungeon, Warden and kindle; the Tower 2.5) · Act III 17.25 (Rootdeep + Heart + memories 1-3 played 3.5, Glassway + Sunken Bell + memories 4-6 3.5, Kettle + memories 7-9 3.25, Saltglass 3.5, Starstair + Spiral Stair + memories 10-12 3.0, present-day Mote 0.5) · Act IV 4.0 (Starmeadow 1.0, the Ladder of Lights 2.0, the Crown and the Second Sneeze 0.5, travel 0.5) | **40.0** |
| Side stories | 53, at the per-story minutes in `bible/side-content.md#index` | **16.5** |
| Optional dungeons and Hollows | Snowglobe 1.0, Undercap 0.6, Merry Mabel 0.75, 16 two-stage Hollows × 4 min 1.05, 8 Deep Hollows × 16 min 2.1 | **5.5** |
| Exploration beyond the path | every region card and landmark, the ~40 re-opened home finds, Moonmere (vistas counted under Activities) | **12.0** |
| Collectible hunting beyond exploration | the last acorns, keepsakes, bottles, Lamp Logs | **7.0** |
| Activities to top tier | 11 × 30 min + Vista Sketches 0.75 + fishing's 24 species beyond its tier run 0.75 | **7.0** |
| Post-game | ch22 0.75, 10 Dreams × ~5 min 0.85, the Hundred Lamps 1.25, Hoot's Margins 0.75, The Planting 0.5, 100 % mop-up 2.4 | **6.5** |
| **Total (100 %)** | | **≈ 95** (band 84-112) |

| Profile | Hours |
|---|---|
| Main story only | **40** (35-45) |
| Main story + true ending | ~46 |
| Main + most side stories | ~62 |
| 100 % (every tracker row, true ending, post-game) | **95** (84-112) |
| Setting foot in every region, seeing every landmark once | 10-12 |
| Exploring every land fully (every point of interest) | 28-34 |

**The model is a test.** `tests/hours.test.js` (S-078b) fails if an act's modelled main path is outside ±20 % of the
table or the planned 100 % is under 90 h. If it models under 95 h, CANON §11 names the two levers: one 6-room optional
mini-dungeon per Act II land (+0.75 h each), and 2-room Dream arenas (+1.5 h). The depth additions A1-A8 (CANON §11.1:
deeper dungeons, two-stage and Deep Hollows, one set piece per land, Mote's traces, present-day Mote, playable
memories, longer act-closer bosses) are already in the steps.

<a id="keeping"></a>

## 11. Keeping it true

- `sh docs/roadmap/tools/build-step-index.sh` regenerates INDEX.md and fails if INDEX.md and the step files' headings
  disagree, a dependency names no step, or the order is not dependency-safe. Run it after any step-file edit and
  commit the result; `tests/docs.test.js` (S-001, S-002a-c) checks anchors, CANON references and the generator.
- Each milestone's close-out step copies that milestone's **Bible reconciliations** into the bible file that lost,
  updates DESIGN.md and ARCHITECTURE.md, adds the `progress.md` entry, writes the art brief batch when one is due, and
  runs the full local suite ([close-out checklist](bible/charter.md#close-out)).
- A doc edit that changes an anchor keeps `bun test tests/docs.test.js` green.
