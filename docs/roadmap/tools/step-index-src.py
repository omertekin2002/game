# Source for INDEX.md. Run: sh build-step-index.sh (or: python3 step-index-src.py check | head | overview | body | anchors | issues | keys | json)
# Steps are written with symbolic keys; numbers S-001.. and dependency ids are computed, so steps can be moved freely.
import json, sys

M = []  # milestones

def ms(title, goal, entry, exit_, hours, steps):
    M.append(dict(title=title, goal=goal, entry=entry, exit=exit_, hours=hours, steps=steps))

def s(key, title, scope, deps='', size='M', save='-', refs='', id=None, suffix=''):
    # id: an explicit lettered id (e.g. 'S-078b') for a step added after numbering froze; it takes no number.
    # suffix: a letter appended to the computed id of an existing row that was split (e.g. S-158 -> S-158b).
    return dict(key=key, title=title, scope=scope, deps=[d for d in deps.split() if d], size=size, save=save, refs=refs, fixed=id, suffix=suffix)

# ---------------------------------------------------------------- PHASE A: Act I deepened, no engine work
ms('Canon in the repo; the Catchers hand over',
   'Put the roadmap and bible in the repo, add the generic flags map (save v7), and give the three guardians their kind reasons and sit-down handing-over scenes.',
   'main at b79d73d, save v6, all CI green.',
   'The player sees each Catcher\'s reason beside its arena before the fight, and after the last hit the guardian sits down, explains, and hands the seed over; it stays talkable until the bloom. docs/roadmap/ holds the bible.',
   '+0.3 h (Act I 3.0 -> 3.3 h)',
   [
    s('docs1', 'docs: the roadmap index and the story bible live in docs/roadmap/',
      'Copy README (how to use the roadmap, order of authority, the roadmap as the vision Direction, invariants block, issue template), INDEX.md, CANON.md, CANON-NOW.md, the index generator (tools/), bible/charter.md, lore.md, story.md, cast.md from the research folder; add tests/docs.test.js that every `bible/<file>#<anchor>` link in INDEX.md resolves to an explicit anchor and every CANON / CANON-NOW section reference resolves.',
      '', 'S', '-', 'charter#invariants; all'),
    s('docs2', 'docs: the rest of the game bible lands and DESIGN.md retires "No quest log"',
      'Add bible/atlas-home, atlas-isles, atlas-far, dungeons, creatures, systems, side-content, art-audio; DESIGN.md section 9 replaces "No quest log" with a pointer to the journal plan (systems#journal); README links docs/roadmap/.',
      'docs1', 'S', '-', 'systems#journal; charter#tone'),
    s('save7', 'feat: save v7 adds a generic flags map, backed up before any migration',
      'SAVE_VERSION 7, MIGRATIONS[6] adds `flags: {}`; normalize keeps values that are true or finite numbers with keys matching /^[A-Za-z0-9:_.-]{1,48}$/ (CANON flags are camelCase: wennaAwake, moteNamed, act2done); MIGRATIONS[6] also sets flags.bloom when the shipped ending was seen and calm:<id> / handover:<id> for each guardian already beaten (reconciliation R2); game.js copies the raw save to `starseed-isle-save-v2-bak` before migrating; save.test v6->v7 keeps every field; fixture tests/fixtures/saves/v6-bloomed.json Continues in test:smoke. Also Act I fixtures tests/fixtures/saves/act1-{fresh,1seed,2seed,3carried,bloomed}.json and debug hooks G.debug.loadSave(obj), G.debug.flags.get/set, G.debug.scene.skip() for later Act I steps.',
      '', 'M', 'v7', 'systems#save-plan'),
    s('reasons', 'feat: the Catchers\' kind reasons are visible beside their arenas',
      'Home post-pass `placeReasons` on `new RNG(7151 * 67 + 13)` (placeShells rules): three unlit night-lights by the Hollow sign; spyglass on the lighthouse gallery and a chalk tally decal on its door; a knitted scarf on a rock and a snow cradle by the Summit. Props in js/props.js with ART BRIEFs; world.test seeds 1-40 proves nothing else moves; world-prints byte-identical.',
      'save7', 'M', '-', 'atlas-home#placeReasons; story#I.2'),
    s('handover1', 'feat: Grumble Shroom sits down and hands the Woods Starseed over',
      'First win only: replace the burst with a handover scene (dizzy sit pose, three lines from data, seed held out, item-get beat). The guardian stays awake with `[E] Talk · Grumble Shroom` in its arena until `S.ending`, then naps (rematch flow unchanged). Update test:playthrough and the wp5 suite.',
      'save7', 'M', '-', 'story#I.2; creatures#boss-grumble'),
    s('handover2', 'feat: Captain Pinch and Frostbun hand over their Starseeds with their own reasons',
      'Handover data and post-fight talk lines for both (Pinch: ye/aye/belay; Frostbun: short sleepy sentences, rolled r\'s); in the bloom cutscene the three guardians stand at the plaza edge. Playthrough asserts all three scenes.',
      'handover1', 'S', '-', 'story#I.2; cast#catchers'),
    s('closeM01', 'chore: close M01: DESIGN and ARCHITECTURE record the handover and the flags map',
      'DESIGN section 8 (kind reasons, handover), ARCHITECTURE (save v7, post-pass list with RNG constants); run bun test, test:smoke, test:opening, test:playthrough, wp5; record the perf snapshot (unchanged) in docs/roadmap/progress.md.',
      'handover2 reasons docs2', 'S', '-', 'charter#close-out'),
   ])

ms('Act I deepened',
   'Finish phase P0: count-keyed myth instalments, blossoming boughs, music layers, healed regions, villager memory lines and thornvine caches. Still the shipped ending card.',
   '{PREV} closed.',
   'Act I reads as a story: Shellby tells the myth in three instalments keyed to seeds home, a bough blossoms and a music layer joins per seed, each region heals visibly, villagers mention things this player did, and the Shiny Sword cuts four thornvine caches.',
   '+0.7 h (Act I -> 4.0 h)',
   [
    s('shellby', 'feat: Shellby tells the myth in count-keyed instalments',
      'New line after intro page 3; instalments at 1 seed home, 2 home, 3 in hand (T1, T2 and the true-ending plant), each once via the `inst:1`, `inst:2`, `inst:3` flags; Ribbit\'s count lines unchanged; data.test checks <= 220 chars and known {tokens}.',
      'save7', 'S', '-', 'story#I.1; lore#myth'),
    s('boughs', 'feat: one bough of the Great Tree blossoms for each Starseed home',
      'greatTreeParts gains four named boughs (toward Woods, Peaks, Shores blossom on their seed; the Meadow bough is always in leaf) as child meshes with no collider (prints unchanged). Art: generate `tree_blossom_cluster` (painted blossom cluster, 256x256 webp, alpha), canvas fallback. In-page check counts lit boughs per fixture.',
      'save7', 'M', '-', 'atlas-home#great-tree; art-audio#home'),
    s('layers', 'feat: the village theme gains one instrument layer per Starseed home',
      'js/audio.js village track split into a base plus three layers keyed to seeds placed; ending theme unchanged; in-page audio check reads the active layer count per fixture.',
      'save7', 'S', '-', 'art-audio#music-home'),
    s('heal', 'feat: each guardian\'s region heals visibly when its Starseed is placed',
      'Fairy rings brighter for good and glow-moss on Grumble\'s Crown; the lighthouse lamp burns by day until flag `nellHome`; warm-spring steam by the Summit and a night hum at the Cairn. Uses placeReasons anchors; visual states switch on `S.seeds`.',
      'reasons boughs', 'M', '-', 'story#I.2; atlas-home#healed-states'),
    s('skylight', 'feat: a moving light on the sky isle, from the first night',
      'On one night in three (seeded by day number) a single small light drifts across the shipped NE sky-isle card (`sky.moteLight`, 19:48-04:36, 90 s crossing); Hoot\'s once-only Act I line at night after 1 seed home; S-128 later changes only its frequency. In-page sky check per fixture.',
      'save7', 'S', '-', 'story#I.1; atlas-home#sky', id='S-011b'),
    s('memlines', 'feat: villagers remember specific things this player did',
      'A memory-line table for the six villagers keyed to save facts (first guardian calmed, shells, parade, keepsakes, rematches, plushies), shown once per act via flags; tone rule 10; lint for length and tokens.',
      'save7', 'S', '-', 'story#memory-lines; cast#home'),
    s('thorns', 'feat: thornvine brambles the Shiny Sword cuts guard four small home caches',
      'Home post-pass `placeThorns` on `new RNG(7151 * 71 + 17)`; purple bramble prop (code-built, ART BRIEF); cuttable only at swordLevel >= 2 (others get "Too tough for this sword."); cut state `gate:home:thorn-<region>` flags (cache chests `home:thorn-<region>` in S.chests; 3 hits, 0.8 s wither); 4 caches x 15 gems (economy +60); Miso hint line after the sword sells; world.test seeds 1-40.',
      'save7 reasons', 'M', '-', 'atlas-home#placeThorns; systems#gates'),
    s('brief01', 'docs: art brief batch 01 (Act I deepened) for the owner',
      'docs/roadmap/briefs/batch-01.md: reason props, bough blossoms, thornvine, glow-moss, snow cradle: silhouette, size m, palette hexes, materials, poly budget, pose, image prompt, 3D prompt, manifest key. No generation.',
      'reasons boughs thorns', 'S', '-', 'art-audio#brief-template'),
    s('closeM02', 'chore: close M02: Act I deepened is documented and asserted end to end',
      'test:playthrough asserts instalments, blossoms, handovers and healed states; DESIGN "Act I" section; economy ledger in docs updated; progress.md entry.',
      'shellby layers heal skylight memlines thorns brief01', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- PHASE B: foundations
ms('Realm engine I: many lands, one at a time',
   'ENGINE F1-F6: per-instance grid size, a realm registry with a debug sandbox, teardown and an in-page realm swap. Nothing player-visible.',
   '{PREV} closed (or in parallel: these steps do not touch Act I content).',
   'A debug-only sandbox realm loads through `?realm=sandbox` and `G.debug.realm()`; home <-> sandbox swaps 3x with no leaks; home prints unchanged.',
   '0 h',
   [
    s('F1', 'perf: post-passes share one walk+BFS and generation-only arrays are dropped',
      'ENGINE F1: `postReach()` helper computed once after the collider hash and passed to placeShells/placeLanterns/placeSecrets/placeReasons/placeThorns; null RW, pathH, flatF, trailD, D at the end of generate() behind a test that reruns every post-pass first; `W.genT` per pass.',
      '', 'M', '-', 'systems#realms'),
    s('F2', 'refactor: the World reads its grid size from the instance, with alias-safe hash keys',
      'ENGINE F2/R1: world.js, world-collide.js, terrain.js, scatter.js use `this.size/half/n`; keys `(a + 1024) * 4096 + (b + 1024)`; water plane `max(1000, size + 600)`; minimap canvas `size` px; tests generate 64 m and 640 m test grids; genMs for 7151 within 10 %.',
      'F1', 'M', '-', 'systems#realms'),
    s('F3', 'feat: realm registry, generateRealm and a 96 m debug sandbox realm',
      'ENGINE F3/R2: js/realms/index.js (REALMS, generateRealm, `hidden` flag), RealmWorld base, js/realms/recipes/sandbox.js; boot reads `?realm=`; unit: generateRealm(\'home\') prints equal generateWorld(7151); sandbox deterministic and fully reachable. If S-024 has landed (M05 is filed before M03, section 1.8), replace js/save.js `KNOWN_REALMS` with the registry ids.',
      'F2', 'M', '-', 'systems#realms'),
    s('F4', 'refactor: terrain, water and scenery dispose and rebuild cleanly',
      'ENGINE F4/R3a: dispose() for terrain group, water, Scenery and its buildings/chests/errand/keepsake groups; in-page leak test: build/dispose/rebuild x3, renderer.info.memory back to baseline +-2.',
      'F3', 'M', '-', 'systems#realms'),
    s('F5', 'refactor: world-bound modules rebuild through an onWorld hook',
      'ENGINE F5/R3b: `onWorld(W, prev)` in HOOKS (js/modules.js); wp9-world, wp8-atmo, perf/grass, Halos, NPCs, vines, cuttables rebuild from a new W; null-safe W.pedestal/W.greatTree reads; wp8 + wp9 suites green, modErrs empty.',
      'F4', 'M', '-', 'systems#realms'),
    s('F6', 'feat: in-page realm swap with fade, loading card and a resident parent realm',
      'ENGINE F6/R4: js/realms/manager.js RealmManager.enter(id, spawn), EV.REALM, G.debug.realm(id, spawn), two-realm resident cache, `mode = \'reload\'` fallback; in-page home <-> sandbox x3, Pip on walkable ground, home prints equal after return, swap time logged.',
      'F5', 'M', '-', 'systems#realms'),
    s('realmsuite', 'test: an in-page realm suite and CI job gate every realm on leaks and budgets',
      'js/debug/tests/realm.js + ci.yml matrix entry `realm`: enter/leave every non-home realm in REALMS, leak check, spawn and portal exits walkable, no modErrs, palette applied, draw calls <= 200 main / tris <= 1.3 M at 4 fixed views per realm (data in REALMS[id].views).',
      'F6', 'M', '-', 'systems#test-harness; charter#budgets'),
    s('closeM03', 'chore: close M03: ARCHITECTURE gains a "Realms" chapter',
      'Document the realm contract (W.realm/size/spawns/portals/regions/palette), teardown rules and the resident set; record genMs and swap times in progress.md.',
      'realmsuite', 'S', '-', 'charter#close-out'),
   ])

ms('Realm engine II: saves, conditions, portals, palettes, bundles, chapters',
   'ENGINE F7-F12 and F28: the save holds realm and content state, content is gated by a tested condition language, portals exist, each realm has its own look and music and its own PWA bundle, and chapters are tested one by one.',
   '{PREV} closed.',
   'A hidden portal post-pass exists on home; the sandbox has its own fog and music; Continue resumes in the saved realm; a sandbox "chapter" runs in CI. Players see no change.',
   '0 h',
   [
    s('save8', 'feat: save v8 adds realm position and generic content containers',
      'ENGINE F7/R5: SAVE_VERSION 8, MIGRATIONS[7] adds `realm {id:\'home\'}`, `items {}`, `quests {}`, `abilities {}`, `travel {}`, `bestiary {}`, `dungeons {}`; normalize is shape-only: it keeps every key matching `^[a-z0-9_]+(:[a-z0-9_.-]+)*$` (<= 64 chars) and checks only value shapes, never a content registry (registries serve the S-025 lint), so unknown or renamed ids never delete progress and S-024 needs no realm engine (filed before M03, section 1.8); a malformed realm id -> home; S-021 does the realm save and Continue; new realms namespace chest/secret ids `<realm>:<id>` inside existing maps; tests v6->v8 and v7->v8; v7 fixture Continues in smoke.',
      'save7', 'M', 'v8', 'systems#save-plan'),
    s('cond', 'feat: a condition and effect language with a content lint',
      'ENGINE F8: js/cond.js `test(S, cond)` (flag, !flag, quest>=, item, seeds>=, beacons>=, stones>=, realm visited, ability, tod) and `apply(S, effects)` (set, give, gems); tests/content.test.js skeleton that fails on unknown ids; unit tests for every operator.',
      'save8', 'M', '-', 'systems#conditions'),
    s('portals', 'feat: portals and walk-in triggers, unlocked by flags, with a home post-pass',
      'ENGINE F9/R6: W.portals, interactable kind `portal` (`[E] Enter · <name>`), walk-in triggers; home post-pass `placePortals` on `new RNG(7151 * 61 + 11)` (none visible until their flag); world.test seeds 1-40; in-page Use enters the sandbox and returns.',
      'F6 cond', 'M', '-', 'systems#portals; atlas-home#placePortals'),
    s('palette', 'feat: per-realm palette and region tables drive fog, sky, terrain and water',
      'ENGINE F10/R8: W.palette (fog table, sky stops, sun/moon, hemisphere, 7 terrain layer keys with home fallback, water colours, music/ambience names) and W.regions replace global REGIONS lookups in game, spawn, ambient, atmo, ui, notify, debug; home palette deep-equals today\'s TUNE; wp8 green; sandbox fog differs.',
      'F6', 'M', '-', 'systems#realms; art-audio#palettes'),
    s('F28', 'feat: realms register their own music and ambience at load',
      'ENGINE F28: G.audio.addTrack(name, def) / addAmbience(name, def); a realm module registers its track data; in-page audio check: entering the sandbox switches the track and returning restores the village theme with its seed layers.',
      'palette', 'S', '-', 'art-audio#music'),
    s('bundles', 'feat: realm assets load lazily from per-realm PWA bundles',
      'ENGINE F11/R7: manifest entries may carry `realm`; Assets.loadRealm/unloadRealm; tools/build-pages.mjs writes PRECACHE (core <= 30 MB) plus BUNDLES; sw caches a bundle on portal discovery; tests/pwa.test.js partition + integrity; tests/pwa.mjs offline replay of a bundle realm.',
      'F3', 'M', '-', 'art-audio#bundles'),
    s('chapters', 'test: chapter playthroughs run from save fixtures, in grouped CI jobs',
      'ENGINE F12: tests/chapter.mjs <id> loads tests/fixtures/saves/<id>-start.json, drives beats with G.debug.realm/warp/flags/killBoss and asserts tests/fixtures/chapters/<id>.json end state; `ch0` aliases today\'s playthrough; a sandbox chapter proves the harness; unit test checks chapter N end == N+1 start on shared fields.',
      'F6 save8', 'M', '-', 'systems#test-harness'),
    s('closeM04', 'chore: close M04: ARCHITECTURE documents saves, conditions, portals, palettes and bundles',
      'ARCHITECTURE sections for v8 fields and id namespacing, the condition grammar, portals, palettes, bundles and the chapter harness; progress.md perf/precache snapshot.',
      'portals F28 bundles chapters', 'S', '-', 'charter#close-out'),
   ])

ms('Story systems: dialogue, scenes, items, quests and Hoot\'s Field Notes',
   'ENGINE F13-F16 plus a scene-script runner and "Ask the Tree": everything a 100-hour story needs to be written as data and tracked in a journal.',
   '{PREV} closed.',
   'Players get Hoot\'s Field Notes (L / pad map tab) with Quests, Items and Lore tabs; Act I and the two errands appear as quests; one-time scenes replay from Lore; "Ask the Tree" gives a nudge then a plain answer.',
   '0 h (quality of life)',
   [
    s('F13', 'feat: text tables and data-driven dialogue with a fallback to lines(S)',
      'ENGINE F13: js/text/en/<realm>.js and t(id, vars); js/dialogue.js pick(npcId, S, ctx) over `{id, npc, when, lines, set, once, priority}`; interact.talkTo asks pick first; lint: every line id exists, <= 220 chars, known {tokens}; no `from \'...\'` text in strings (Pages build regex).',
      'cond', 'M', '-', 'systems#dialogue'),
    s('homelines', 'refactor: the six villagers\' lines move into dialogue tables word for word',
      'Port NPCS lines(S) for Shellby, Ribbit, Miso, Clover, Hoot, Digby plus M02 instalments and memory lines into js/content/dialogue/home.js; a test replays every fixture in tests/fixtures/saves through old and new pickers and asserts identical lines.',
      'F13 memlines shellby', 'M', '-', 'systems#dialogue; cast#home'),
    s('scenes', 'feat: data-driven scene scripts with skip and replay',
      'js/scenes.js pure runner over steps {shot, say, wait, flag, emit, fade, pose}; runtime in cutscenes.js; the handover scene ported to it; skip with {interact} hold; `replay(id)` API; unit tests for ordering and flags; wp5 handover tests unchanged.',
      'F13 handover2', 'M', '-', 'systems#scenes; story#scene-format'),
    s('F14', 'feat: items and key items, with a rebindable tool action',
      'ENGINE F14: js/items.js ITEMS + give/take/has/count over S.items; item-get beat reuse; `tool` action in KEY_ACTIONS (T) and PAD_ACTIONS (D-pad up); keys.test and padbinds.test cover it; Controls settings list it.',
      'cond', 'M', '-', 'systems#items-tools'),
    s('F15', 'feat: quests drive the objective line; Act I and the errands become quests',
      'ENGINE F15: js/quests.js QUESTS, advance(S, event), active, objective; module listens to TALK_END, ITEM_GET, KILL, CHEST_OPEN, REALM, PUZZLE, BOSS_DEFEATED; hud/nav objective() reads quests first; main quest "The Sneeze" as data; errands as read-only adapters over S.errands; compass texts unchanged in test:playthrough.',
      'F13 F14', 'M', '-', 'systems#quests; story#act-I'),
    s('F16', 'feat: Hoot\'s Field Notes journal with Quests and Items tabs',
      'ENGINE F16: js/hud/journal.js modal; pause-menu entry "Field Notes"; `journal` action (L); on pads a tab of the map card; keyboard, pad and touch navigation; G.debug.hud.audit() clean at 1080p and phone width; in-page test.',
      'F15', 'M', '-', 'systems#journal; art-audio#ui'),
    s('lore', 'feat: a Lore tab with scene replays, and "Ask the Tree" hints',
      'Journal Lore tab: the 4 keepsakes (text locked), instalments heard, and one-time scenes (handovers, later every story scene) replayable via scenes.replay (tone rule 8); plus "Ask the Tree": each quest step gains `hint: [nudge, answer]` text ids, a journal button gives the nudge then the plain answer (Shellby voices it until `wennaAwake`), lint fails a main-quest step without hints; in-page test.',
      'F16 scenes', 'M', '-', 'systems#journal; systems#hints; charter#tone'),
    s('closeM05', 'chore: close M05: DESIGN replaces "No quest log" with the Field Notes chapter',
      'DESIGN section 9 rewritten (journal, hints, replay); ARCHITECTURE: text tables, dialogue, scenes, items, quests; content lint in CI; progress.md.',
      'homelines lore', 'S', '-', 'charter#close-out'),
   ])

ms('Combat frameworks: archetypes, bosses, bestiary',
   'ENGINE F17-F19 and F26: enemies and bosses become data plus small AI modules, so 32 species and 16 bosses can be added one PR at a time.',
   '{PREV} closed (F17 has no deps and may be pulled earlier when the stack has room).',
   'Players see a Bestiary tab with painted cards for the six home enemies and the three guardians; combat is unchanged.',
   '0 h',
   [
    s('F17', 'refactor: enemy AI moves into an archetype registry, behaviour unchanged',
      'ENGINE F17: js/ai/{hopper,shooter,swooper,diver,charger,lobber}.js registered in js/ai/index.js; ENEMY[type] = {archetype, params, model}; wp4 + wp5 suites unchanged.',
      '', 'M', '-', 'creatures#archetypes'),
    s('arch1', 'feat: burrower, shield, splitter and kiter archetypes',
      'Four AI modules with telegraphs >= 0.55 s, half-heart hits, params as data; sandbox test species spawned by G.debug.actors.spawn; in-page test per archetype (tell drawn before damage, poof).',
      'F17 F3', 'M', '-', 'creatures#archetypes'),
    s('arch2', 'feat: swarm, turret, mimic and ghost archetypes',
      'Swarm shares one attack token (3-6 flyers), turret rotates a drawn telegraph, mimic hides as a chest, ghost is hittable only inside a light radius (hook for the Lantern); sandbox tests as above.',
      'arch1', 'M', '-', 'creatures#archetypes'),
    s('F18', 'refactor: boss framework with defs, phases and a move runner; Grumble Shroom ported',
      'ENGINE F18: js/boss/defs.js and a move runner generalising pickAttack/aiShroom; move names for G.debug.actors.boss stay; wp5 and rematch steps green.',
      'F17', 'M', '-', 'creatures#boss-framework'),
    s('F19', 'refactor: Captain Pinch and Frostbun ported; arenas come from realm anchors; HP scales by count',
      'ENGINE F19; arenas from W.arenas not SEED_ORDER; `hp(def, S)` helper (base + perCalmed x Wardens calmed) for Act II Wardens; balance tests unchanged for the three guardians.',
      'F18', 'M', '-', 'creatures#boss-framework'),
    s('calm', 'feat: handover, plushie and Wake rematch are boss-def data for any boss',
      'def.handover (lines, seed or reward), def.plushie and def.rematch; PLUSHIES and REMATCH tables and normalize accept any registered boss id; Miso\'s stock rule generalised; save unchanged (maps already keyed by id).',
      'F19 scenes', 'S', '-', 'creatures#boss-framework; systems#economy'),
    s('F26', 'feat: a Bestiary tab with seen and poofed counts and painted cards',
      'ENGINE F26: ENEMY/boss lore fields, S.bestiary counts on KILL and first sight; journal tab; art: generate 9 painted cards (6 enemies, 3 guardians, 384x384 webp, `card_<id>`), canvas fallback; in-page tab test.',
      'F16 F17', 'M', '-', 'creatures#bestiary; art-audio#cards'),
    s('perf1', 'perf: checkpoint 1: combat and journal budgets on home; close M06',
      'Measure the four WP7 views plus three boss fights and the journal open: draw calls, tris, frame time; fix regressions; record in progress.md and the DESIGN performance table; ARCHITECTURE: how to add a species (data + AI file + model + bestiary card) and a boss (def, moves, phases, arena, handover).',
      'F26 calm', 'S', '-', 'charter#budgets'),
   ])

ms('Abilities and the dungeon engine',
   'ENGINE F20-F23: abilities with gate objects and a progression solver, the dungeon compiler and solver, the dungeon realm recipe, an interior kit and puzzle entities.',
   '{PREV} closed.',
   'A sandbox test dungeon and a test cottage interior run end to end headlessly; players see no change.',
   '0 h',
   [
    s('F20', 'feat: abilities, world gate objects and a progression solver',
      'ENGINE F20: js/abilities.js, js/progress-graph.js over realms/portals/gates `needs`; player.mods hooks (gravityK, airCap); gate objects registry (thornvine, glowbud door, gap, tide stone, hookbloom, receiver, soft earth, star door, bell target, ivy, cloud mote); solver fixture pass + soft-lock fail cases; sandbox glide gate in-page.',
      'portals F14', 'M', '-', 'systems#abilities; systems#gates'),
    s('F21', 'feat: a dungeon text-map compiler and lock-and-key solver',
      'ENGINE F21: js/realms/dungeon-compile.js (pure): rooms -> heightfield, merged wall boxes, ceilings, doors, entities; state BFS over keys, Root Key, switches, blocks; bun test on 3 fixture layouts incl. a deliberately soft-locked one.',
      '', 'M', '-', 'dungeons#format'),
    s('F22', 'feat: dungeon realm recipe with room camera and light profile',
      'ENGINE F22: js/realms/recipes/dungeon.js builds a World from compiled data; TUNE.view.interior (boom 1.9 m, pitch -12, ceiling cap), far 120 m, fog 6-60 m, frozen tod, sun off; prints of a test dungeon; in-page: TP camera never leaves the room.',
      'F21 F6 palette', 'M', '-', 'dungeons#format; systems#realms'),
    s('kit', 'feat: an instanced interior prop kit with stone, brick and moss textures',
      'js/props-interior.js: wall segment, corner, arch, door leaf, locked door, boss door, pillar, stairs, torch bracket, brazier, crate, barrel, push-block, plate, crystal switch, keys, cracked floor, rubble; occ materials. Art: 3 seamless textures (stone, brick, moss; 1024 + 512 webp via tools/make_seamless.py). Test dungeon <= 120 draw calls.',
      'F22', 'M', '-', 'dungeons#kit; art-audio#dungeon-kit'),
    s('F23a', 'feat: puzzle entities I: doors, keys, locked and boss doors, plates, map and Chime Stone',
      'ENGINE F23 part 1 in js/dungeon-mod.js; state in S.dungeons[id]; `[E] Unlock`; EV.PUZZLE; map/Chime Stone chests reveal rooms on the map card; in-page puzzle test in the test dungeon.',
      'kit', 'M', '-', 'dungeons#entities'),
    s('F23b', 'feat: puzzle entities II: crystal switches, push-blocks and a reset lever, saved',
      'Switch hit test (EV.HIT kind switch, 0.5 s cooldown), 2 m push-blocks with saved grid positions, a per-room reset lever; save/Continue keeps puzzle state; solver models blocks.',
      'F23a', 'M', '-', 'dungeons#entities'),
    s('interiors', 'feat: house doors can become portals into small interior realms',
      'Interior recipe (kind interior, 1-3 rooms, no enemies, regions[0].max 0), overworld stays resident (fade < 100 ms back); DOOR_LINES doors gain optional `to`; a sandbox cottage test; prints for the interior.',
      'F22 portals', 'M', '-', 'atlas-home#interiors; systems#portals'),
    s('sled', 'feat: Sledding with Frostbun: a home activity on the Peaks with a plaza time board',
      'Split from S-158 and pulled into M07 as its player-visible step (section 1.9): Frostbun offers sled runs after her handover; tiers and the plaza board per side-content#act-sledding; needs only S-045\'s calm data.',
      'calm', 'M', '-', 'side-content#act-sledding', id='S-158a'),
    s('closeM07', 'chore: close M07: ARCHITECTURE gains the dungeon authoring guide',
      'Tile legend, entity table, solver errors and how to read them, interior rules, camera profile; progress.md with test-dungeon budgets.',
      'F20 F23b interiors', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- PHASE C: the Interlude
ms('The Interlude I: Pip\'s Nook and Under the Roots',
   'Build the first dungeon and its tool behind a hidden root door: Pip\'s Nook, the Glowbud Lantern, Dimlings, Under the Roots and Sir Rollo.',
   '{PREV} closed.',
   'Under the Roots is complete and solver-proven but reachable only via `?realm=` until M09 opens the root door.',
   '0 h visible (+3 h built, shipped in M09)',
   [
    s('nook', 'feat: Pip\'s Nook and its Keepsake Hollow behind a root door in the Great Tree',
      'Home post-pass `placeRootDoor` (anchor (0, -8), own RNG) shows the door only with flag `wennaAwake`; Nook interior realm with bed, window, four shelves; the shipped keepsakes appear on Keepsake Hollow shelves; a stair portal down (to `under_roots`, needs `wennaAwake`).',
      'interiors', 'M', '-', 'atlas-home#pips-nook'),
    s('lantern', 'feat: the Glowbud Lantern lights 6 m, kindles things and reveals ghosts',
      'Item + ability `lantern`; held light uses the point-light pool (no new lights); interactable verb `Kindle`; glowbud doors gate object; ghost archetype hook reads lantern radius; tool action toggles it; HUD icon (generated 128 px icon, fallback glyph).',
      'F20 arch2', 'M', '-', 'systems#items-tools; dungeons#d1'),
    s('dimling', 'feat: Dimlings, the shy ghosts of dark places',
      'Species on the ghost archetype (HP 2, drift + tell 0.6 s), code-built model with ART BRIEF, bestiary card (generated), spawn table for dark rooms.',
      'lantern', 'S', '-', 'creatures#enemy-dimling'),
    s('utr1', 'feat: Under the Roots rooms 1-5: darkness, glowbud doors and wall-lanterns',
      'js/realms/dungeons/under_roots.js rooms 1-5 (hidden realm), root-wall palette, glow materials; solver passes; realm prints fixture; realm suite entry.',
      'nook kit F23b', 'M', '-', 'dungeons#d1'),
    s('utr2', 'feat: Under the Roots rooms 6-9: the Lantern chest, the Root Key and the boss door',
      'Rooms 6-9, Lantern found mid-way (room 5 chest opens room 6 dark route), 3 chests x 40 gems, boss door; solver: every chest openable; prints refreshed in the same PR.',
      'utr1 dimling', 'M', '-', 'dungeons#d1'),
    s('rollo', 'feat: Sir Rollo, the pill-bug who rolls the tunnels flat (puzzle boss)',
      'Boss def (44 HP; roll stripe and wall bonk; curl-up knocked into a pit-plate; ceiling pebbles on circles), code-built model (2.4 m, slate blue, cream bands) with ART BRIEF, handover lines, plushie, Wake rematch; balance test (careful >= 90 % in 45-90 s).',
      'utr2 calm', 'M', '-', 'creatures#boss-rollo; dungeons#d1'),
    s('artI', 'art: Under the Roots and Sir Rollo painted assets',
      'Generate: root-wall and glowroot seamless textures (1024/512 webp), Sir Rollo portrait (512 webp) and turnaround reference sheet (docs only), Lantern icon, Dimling card; manifest keys with `realm: under_roots`; ?noassets=all smoke still renders.',
      'rollo', 'S', '-', 'art-audio#under-roots'),
    s('closeM08', 'chore: close M08: the first dungeon is documented with brief batch 02',
      'DESIGN dungeon chapter; docs/roadmap/briefs/batch-02.md (Rollo GLB, Dimling, Nook furniture, Lantern); progress.md budgets for the dungeon.',
      'artI', 'S', '-', 'charter#close-out; art-audio#brief-template'),
   ])

ms('The Interlude II: Wenna wakes (Act I\'s turn ships)',
   'Wake the Tree, show the lights going out, bring Nell home, open the root door and the jetty, and turn the ending card into an act break, all in one release with the dungeon behind it.',
   '{PREV} closed; owner decision 7 (act card rewrite) at its default.',
   'After the bloom, at dusk, Wenna speaks; the horizon lights go out; Nell comes home; Pip goes down through his Nook into Under the Roots, earns the Lantern, calms Sir Rollo and opens Nell\'s Jetty. The chart shows fog banks ("Nell won\'t risk the fog yet").',
   '+3 h (Interlude 2.0 h + home finds)',
   [
    s('horizon', 'feat: horizon isle cards point at fixed bearings, with night windows and fog banks',
      'js/sky.js: cards a-d re-pointed (Pinewhistle N-NW, Archwater E-SE, Duskwick S-SE, Threemills W-SW); new cards `horizon_isle_e` (Kettle, E-NE) and `_f` (Saltglass, S-SW) generated as painted webp, fogged until their flag; a night-window glow overlay per card tied to flags; one draw call kept.',
      'cond', 'M', '-', 'atlas-home#sky; art-audio#horizon'),
    s('wennaVoice', 'feat: Wenna speaks at the pedestal in a soft-gold frame with count-keyed lines',
      'Dialogue frame variant `wenna`; pedestal Talk after `wennaAwake`; the first 12 of ~60 lines (Interlude and early Act II), keyed to counts; Ask the Tree switches to Wenna\'s voice.',
      'F13 lore', 'S', '-', 'story#wenna-lines; cast#wenna'),
    s('I6', 'feat: I.6 Wenna Wakes: the lights go out and Nell comes home',
      'Scene script at the first dusk after the bloom in the village (or Continue after dusk): awake face lines, camera to horizon, windows go out one by one (Duskwick last), streak to the sky isle, Nell\'s lantern rounds the lighthouse beam (`nellHome`, door note "Back! ...Told you. -- N."), root door opens; flag `wennaAwake`; compass "Under the Roots".',
      'horizon wennaVoice scenes nook', 'M', '-', 'story#I.6'),
    s('ch7', 'feat: chapter 7 Under the Roots: Wenna explains the beacons and the Lantern',
      'Quest "Under the Roots" (steps: enter the Nook, find the Lantern, calm Sir Rollo, hear Wenna at the bottom); `lanternGot`; Keepsake Hollow opens; the bloom card becomes "End of Act One" (story#I.5, owner decision 7) in this same PR, with test:playthrough, test:opening and the ending art caption updated; chapter test ch7 with fixtures.',
      'I6 rollo F15', 'M', '-', 'story#ch7; story#I.5; dungeons#d1'),
    s('jetty', 'feat: Nell Pelliwick and Nell\'s Jetty: the Dandelion is ready to sail',
      'Home post-pass `placeJetty` (anchor (-14, 126), own RNG); Nell (pelican) code-built NPC with ART BRIEF + generated portrait; Ribbit\'s "jettied" speech; `[E] Sail · the Dandelion` opens a chart where every isle is a fog bank ("Nell won\'t risk the fog yet."); compass "Sail to Duskwick" waits for M12.',
      'ch7 portals', 'M', '-', 'atlas-home#placeJetty; cast#nell'),
    s('chI', 'test: chapter tests ch1-ch6 cover Act I in any seed order',
      'Chapter fixtures for ch1-ch6 (seeds in 3 orders, bloom, I.6), chain unit test, CI matrix entries; test:playthrough stays as ch0.',
      'ch7 chapters', 'M', '-', 'systems#test-harness; story#act-I'),
    s('closeM09', 'chore: close M09: Act I + Interlude release notes, DESIGN gains the act structure',
      'DESIGN "Acts" chapter (counts 3 / 3+1 / 3 / 1, free order rules), CHANGELOG/README play summary, progress.md hours and budgets.',
      'chI jetty', 'S', '-', 'charter#close-out'),
   ])

ms('Collections, hearts and the Completion page',
   'The collectible kinds the whole game uses get their save maps, homes and tracker rows before the first new land: heart petals and 14 hearts, Hollows, Lamp Logs, the Bottle Chain, Vistas, and completion v2.',
   '{PREV} closed.',
   'On home the player can open two fairy-ring Hollows with the Lantern for heart petals, sketch 4 vistas for Hoot\'s Board, visit Puddle\'s Grotto, and read a per-land Completion page.',
   '+1 h',
   [
    s('save9', 'feat: save v9 adds collect maps for the new collectible kinds',
      'SAVE_VERSION 9, MIGRATIONS[8] adds `collect: {acorn:{}, bottle:{}, log:{}, petal:{}, vista:{}, fish:{}, hollow:{}, dash:{}, dream:{}}` (namespaced ids); the shipped bottle keepsake also sets bottle `home:12` on migrate; the `maxHp` clamp widens 20 -> 32 inside this bump (section 3 clamp-widening rule); tests v6/v7/v8 -> v9.',
      'save8', 'S', 'v9', 'systems#save-plan; systems#collectibles'),
    s('hearts', 'feat: heart petals make a heart per four, and the HUD shows up to 16 hearts in two rows',
      'Uses the 32 cap S-071 set; petal pickup (pink glint) and "Heart petal 3/4" toast; two rows of 8; HUD audit at 1080p and phone width; owner decision 3 default.',
      'save9', 'M', '-', 'systems#hearts'),
    s('hollows', 'feat: Hollows: one-room puzzle caves behind spiral doors; two open on home',
      'Hollow = dungeon-recipe realm kind with a single room; spiral-carved door prop; the two home fairy-ring Hollows (Lantern) each with a heart petal; `collect.hollow`; solver per Hollow.',
      'save9 lantern F23b', 'M', '-', 'dungeons#hollows; atlas-home#hollows'),
    s('F25', 'feat: Completion v2: Field Notes groups rows by land from a generated stats file',
      'ENGINE F25: tools/realm-stats.mjs writes js/realms/stats.js; Completion page row groups per land (chests, keepsakes, acorns, Hollows, vistas, regions, benches) and game-wide rows; "100 % only when every row is full" kept; unit test: stale stats fail.',
      'save9 F16', 'M', '-', 'systems#completion'),
    s('logs', 'feat: Lamp Logs and the Bottle Chain are collectibles with homes',
      'Lamp Log pickup (spiral glyph) and bottle pickup (bob and glint); text from lore.md; the lighthouse lamp-room shelf shows found bottles (home post-pass dressing); Lore tab sections; the shipped bottle is #12 of 12.',
      'save9 lore', 'M', '-', 'lore#bottles; lore#lamp-logs'),
    s('vistas', 'feat: Vistas: sketch Hoot\'s spots and pin them to Hoot\'s Board',
      '`[E] Sketch · <view>` at vista posts; generated painted sketch per vista (512 webp) with a canvas fallback; Hoot\'s Board on the plaza (post-pass); the 4 home vistas; a Field Notes chapter per 10.',
      'save9', 'M', '-', 'systems#collectibles; atlas-home#vistas'),
    s('puddle', 'feat: Puddle\'s Grotto under the well (side story 7)',
      'Well becomes a portal with the Lantern; grotto interior with Puddle (tiny frog, Ribbit\'s nephew); side story 7 steps; 1 heart petal; Ribbit line.',
      'hollows interiors', 'M', '-', 'side-content#ss-07; atlas-home#puddles-grotto'),
    s('econ', 'test: the economy ledger sums content tables and keeps sources >= 105 % of sinks',
      'js/content/economy.js derived from chests, keepsakes, side stories, activities, rematches, shops; unit test fails if fixed sources < 1.05 x one-time sinks for content shipped so far and for the full planned table.',
      'F25', 'S', '-', 'systems#economy'),
    s('hours', 'test: a playtime model sums modelled hours from the content tables',
      'tools/hours.mjs (pure) models hours from dungeon map blocks and room entity tables, quest step tables, scene durations, side-content minutes, activity tiers and atlas POI counts (simple puzzle beat 3 min, compound beat 6, combat wave 1.5, story boss 4.5, room traverse 1, scene seconds x 1.2, overworld quest step 5-10 min by path length at 3.5 m/s plus 1 min per Talk, off-path find 2.5 min); tests/hours.test.js fails if any act\'s main path is outside +-20 % of CANON section 11 or the full planned table models under 90 h at 100 %; regenerates the overview\'s play columns.',
      'econ F21 F15', 'M', '-', 'systems#test-harness; charter#close-out', id='S-078b'),
    s('closeM10', 'chore: close M10: collectibles chapter in DESIGN, brief batch 03',
      'DESIGN collectibles table (kind, job, cue, home); briefs/batch-03.md (Nell, Puddle, horizon cards e/f, spiral door, vista posts, Hoot\'s Board); progress.md.',
      'hearts hollows logs vistas puddle econ hours', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- PHASE D: Act II
ms('Travel and the Duskwick land',
   'ENGINE F24 travel (chart, benches, fast travel, per-land map), chart sailing, a shared Lamplighter kit and the Duskwick overworld (hidden).',
   '{PREV} closed; owner decision 1 (load-bearing names) answered or at its default.',
   'Duskwick generates, passes prints, solver and the 40 x 40 m coverage test, and is fully dressed, but stays hidden until M12.',
   '0 h visible',
   [
    s('F24', 'feat: per-land map card, the Lamplighter\'s Chart, benches and fast travel',
      'ENGINE F24: js/travel.js, W.waystones (benches), `[E] Sit · Bench` marks it, S.travel; map card tabs This land / World (chart art with a canvas node fallback); travel only outside fights and dungeons; in-page sandbox bench test.',
      'F6 portals', 'M', '-', 'systems#travel'),
    s('sailing', 'feat: chart sailing on the Dandelion with a painted sailing card',
      'Pick an unlocked isle on the chart; 4-6 s painted sailing card (generated 1600x900 webp; doubles as loading card); arrive at that land\'s jetty spawn; fog banks for unbuilt or locked isles.',
      'F24 jetty', 'M', '-', 'systems#travel; art-audio#loading-cards'),
    s('lampkit', 'feat: a shared Lamplighter kit: benches, beacons, ruins and the spiral glyph',
      'Code-built bench, beacon (dark and lit states), ruin stamps, spiral glyph decal (generated), keepsake twinkle reuse; ART BRIEFs; used by every land.',
      'F24', 'M', '-', 'art-audio#lamplighter-kit; atlas-isles#shared'),
    s('ccRecipe', 'feat: Duskwick lagoon recipe: terrain, regions and name cards (hidden)',
      'js/realms/recipes/lagoon.js: ring island r ~170 m in a 448 m grid, seed 40211, south lagoon, NE headland, 4 sectors (Wickhaven, Ember Sands, Coral Steps, Tower Head) with cards; `hidden: true`; tests/fixtures/realm-prints/duskwick.json; reachability; genMs <= 1.2 s.',
      'palette F3', 'M', '-', 'atlas-isles#duskwick'),
    s('ccKit', 'feat: Duskwick props: coral shrubs, stilt decks, hot pools and the Lamplighters\' Tower',
      'Palm reuse/recolour, coral shrub, stilt-deck bridge decks, hot-pool basins, black-sand splat; Tower exterior 28 m (door portal stub to dungeon 5, sealed); <= 24 instanced types; ART BRIEFs; prints refreshed.',
      'ccRecipe lampkit', 'M', '-', 'atlas-isles#duskwick'),
    s('ccArt', 'art: Duskwick look: terrain layers, palette, sky, loading card, map art and music',
      'Generate 7 terrain layers (`duskwick_*` 1024/512 webp, seamless), loading card, map art; palette hexes #2b2238 #f2b45a #ff8f7a #3fa79a; track `duskwick` (dusk marimba) + ambience as audio data; bundle <= 2.5 MB.',
      'ccRecipe bundles F28', 'M', '-', 'art-audio#duskwick'),
    s('ccFinds', 'feat: Duskwick finds: chests, keepsakes, acorns, vistas, a bottle, Lamp Logs and benches',
      'Post-pass per atlas counts (10 chests, 4 keepsakes with text, 6 sleeping acorns, 2 vistas, 1 bottle, 5 Lamp Logs, 2 Hollow doors, 5 benches, root-gate stub sealed); coverage test: every 40 x 40 m land cell holds a find, a view or a path to one.',
      'ccKit logs vistas', 'M', '-', 'atlas-isles#duskwick; systems#collectibles'),
    s('perf2', 'perf: checkpoint 2: the first overworld realm meets every budget',
      'Duskwick genMs, swap time, draw calls/tris at its 4 views in both cameras, bundle size; fix what fails; record in progress.md.',
      'ccFinds ccArt', 'S', '-', 'charter#budgets'),
   ])

ms('Duskwick and chapter 8: Act II opens',
   'People, enemies and the first sight of the Lamp Thief; chapter 8 unhides Duskwick and gives the Chart.',
   '{PREV} closed.',
   'Pip sails to Duskwick, meets Granny Wick and the drowsy Wicklings, gets the Chart and Lamp Log 1, glimpses the Lamp Thief on the tower stair, and meets Kinako\'s Floating Bazaar. Pinewhistle, Archwater and Threemills show as fog banks until their lands ship.',
   '+2 h',
   [
    s('wicks', 'feat: Wickhaven\'s people: Granny Wick, Flick and the drowsy Wicklings',
      'Code-built moth NPCs (shared rig, 3 recolours) with ART BRIEFs; generated portraits for Granny Wick and Flick; dialogue tables keyed to `ch8`, beacons count; drowsy idle; Wickhaven has no enemies.',
      'ccFinds F13', 'M', '-', 'cast#granny-wick; cast#flick; atlas-isles#duskwick'),
    s('ccEnemies', 'feat: Duskwick enemies: Sizzle Beetle and Coco Clonk',
      'Charger and lobber species (HP 3-5), code-built models with ART BRIEFs, bestiary cards (generated), region spawn tables; Dimlings in dark caves.',
      'arch2 ccFinds', 'M', '-', 'creatures#enemy-sizzle-beetle; creatures#enemy-coco-clonk'),
    s('mote', 'feat: Mote\'s emissive figure and the Lamp Thief glimpse on the tower stair',
      'Code-built Mote (capsule body, cloak shell, two dot eyes, additive glow sprite, generated glow sprite) with ART BRIEF; scene: a cloaked light flees upward; journal entry "the Lamp Thief".',
      'scenes ccKit', 'M', '-', 'cast#mote; story#ch8'),
    s('traces', 'feat: Mote\'s traces: a scrap lamp and a note signed M by each dark beacon',
      'Code-built scrap lamp (jam jar, wire handle, 0.25 m) and scorched spiral decal; a note runner keyed to the beacons count (0, 1; gone after II.M) with a Read verb and journal Lore entries; the Tower lamp-room note read in ch12; isle placements are one row each in S-106a, S-127a, S-148a.',
      'mote scenes lore', 'M', '-', 'story#motes-traces; cast#mote', id='S-090b'),
    s('ch8', 'feat: chapter 8 Duskwick: the Chart, Lamp Log 1 and the locked Tower; Duskwick opens',
      'Quest per story#ch8; Granny Wick gives the Lamplighter\'s Chart (item) and Lamp Log 1; `ch8`; chart lists Pinewhistle/Archwater/Threemills (fog banks until built); unhide Duskwick; horizon card c night window rules; chapter test ch8.',
      'wicks mote sailing', 'M', '-', 'story#ch8'),
    s('lampround', 'feat: The Lamp Round: Pip relights Wickhaven\'s eight stilt lamps so the moths wake and Granny Wick\'s door opens',
      'Main-path set piece inside ch8 step `meet` (a `before` sub-objective, no step index shifts): eight stilt lamps along the deck walk, kindled with the Lantern; each wakes the nearest moths; the last opens the Long House door; adds the quest `before` field; ch8 chapter test updated.',
      'ch8', 'M', '-', 'story#set-pieces; story#ch8', id='S-091b'),
    s('kinako', 'feat: Kinako\'s Floating Bazaar docks at Duskwick',
      'Kinako (cat, Miso\'s twin, "!!" tic) NPC with ART BRIEF + portrait; bazaar boat prop; shop: heart container 300, Bright Wick 400 (Lantern 6 -> 9 m), more stock appears per tool owned; economy ledger updated.',
      'ch8 econ', 'M', '-', 'cast#kinako; systems#economy'),
    s('ccHollows', 'feat: Duskwick\'s two Hollows',
      'Two Hollow layouts from dungeons#hollows (Lantern and push-block puzzles), each a heart petal or gem bag; solver; tracker rows.',
      'hollows ccFinds', 'M', '-', 'dungeons#hollows'),
    s('closeM12', 'chore: close M12: Act II opening documented, brief batch 04',
      'DESIGN Act II overview; briefs/batch-04.md (Wicklings, Granny Wick, Flick, Kinako, bazaar boat, Mote, Tower, Sizzle Beetle, Coco Clonk); progress.md.',
      'ch8 lampround traces kinako ccHollows ccEnemies', 'S', '-', 'charter#close-out'),
   ])

ms('Pinewhistle: the first isle (land template)',
   'The land-template vertical slice: beacons and crown lanterns, the Pinewhistle overworld, its people and enemies, the Leaf Glider, Whistlehollow, Mossmantle and the full people -> depths -> Warden loop.',
   '{PREV} closed.',
   'Pip sails to Pinewhistle, helps the Acornets, glides through Whistlehollow, calms Mossmantle and kindles the beacon: the pine sings, crown lantern 1 of 8 lights, Granny Wick reads Lamp Log 2, Hoot starts his star count, and the Glider reaches three new home finds.',
   '+5 h',
   [
    s('beacons', 'feat: beacons can be kindled, and eight crown lanterns on the Great Tree keep score',
      'Beacon interactable `[E] Kindle · Beacon` (needs lantern); EV.BEACON; `beacons` count condition; 8 crown lantern child meshes in the Tree (no collider, prints unchanged) lit by `lanterns` count; plaza islander visit hook; in-page test with fixtures.',
      'lampkit lantern', 'M', '-', 'systems#beacons; atlas-home#great-tree'),
    s('pwRecipe', 'feat: Pinewhistle ridges recipe: terrain, ravines, regions (hidden)',
      'recipes/ridges.js, 576 m, seed 40223: two NE-SW ridges, ravines, stream spline, 4 regions (Acornet Hollow, Misthollow Ravines, Sawmill Run, Whistle Rise); prints fixture; genMs <= 1.2 s.',
      'ccRecipe', 'M', '-', 'atlas-isles#pinewhistle'),
    s('pwKit', 'feat: Pinewhistle props: rope bridges, sawmill and the Whistling Pine',
      'Pine recolours, rope-bridge decks across ravines, sawmill + wheel, acorn stores; Whistling Pine landmark 34 m with spiral knot-holes; dungeon portal at its roots (sealed); ART BRIEFs; prints refreshed.',
      'pwRecipe', 'M', '-', 'atlas-isles#pinewhistle'),
    s('pwArt', 'art: Pinewhistle look, loading card, map art and music',
      'Generate 7 terrain layers, loading card, map art; palette #2f4a3a #8fae9a #c98b4b #e8efe9; track `pinewhistle` (wind flute) + ambience; bundle <= 2.5 MB.',
      'pwRecipe', 'M', '-', 'art-audio#pinewhistle'),
    s('pwPeople', 'feat: Acornet Hollow\'s people: Elder Nutmeg, Professor Pinfeather and the Acornets',
      'Squirrel and woodpecker NPCs (code-built, ART BRIEFs, portraits generated for named ones); dialogue tables; local quest steps 1-2 of the Pinewhistle chain as data (not yet startable).',
      'pwKit F15', 'M', '-', 'cast#elder-nutmeg; cast#professor-pinfeather'),
    s('pwEnemies', 'feat: Pinewhistle enemies: Mossling, Pinecone Puff, Bark Beetle and Needle Wasp',
      'Four species (archetypes per creatures.md), code-built models with ART BRIEFs, generated bestiary cards, region spawn tables; one in-page test per species (tell >= 0.55 s before damage, poof).',
      'arch1 pwKit', 'M', '-', 'creatures#enemy-mossling; creatures#enemy-pinecone-puff; creatures#enemy-bark-beetle; creatures#enemy-needle-wasp'),
    s('pwFinds', 'feat: Pinewhistle finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (14 chests, 4 keepsakes, 10 acorns, 3 vistas, 1 bottle, 2 Lamp Logs, 3 Hollow doors, 5 benches, root-gate stub); coverage test; re-opens >= 3 finds elsewhere listed in atlas (pacing rule 5).',
      'pwKit', 'M', '-', 'atlas-isles#pinewhistle'),
    s('glider', 'feat: the Leaf Glider: glide by holding Hop, ride updrafts; three home glide finds',
      'Ability `glide` (fall 2 m/s, 6 m/s forward) via player.mods; updraft column gate; home post-pass for the 3 glide finds (lighthouse gallery -> islet 2 sea stack, Peaks ridge -> Woods ledge, Tree balcony -> plaza); world.test; in-page glide test.',
      'F20 beacons', 'M', '-', 'systems#items-tools; atlas-home#glide-finds'),
    s('wh1', 'feat: Whistlehollow rooms 1-6: knot-hole updrafts switched by plates',
      'dungeons/whistlehollow.js rooms 1-6; updraft entities toggled by plates; solver; prints; realm suite entry.',
      'glider F23b', 'M', '-', 'dungeons#d2'),
    s('wh2', 'feat: Whistlehollow rooms 7-12: the Glider chest and the climb to the Warden',
      'Rooms 7-12; Glider found in room 6 chest; gliding gaps; 4 chests; boss door; solver incl. "every chest".',
      'wh1', 'M', '-', 'dungeons#d2'),
    s('mossmantle', 'feat: Mossmantle, the hoarse sloth who hummed the pine\'s song',
      'Boss def (56 + 6 per Warden calmed; swing stripe, pinecone circles 1.0 s, dozes mid-fight as the opening), code-built model 3.6 m with ART BRIEF + portrait, handover, plushie, Wake rematch; balance test.',
      'wh2 calm', 'M', '-', 'creatures#boss-mossmantle'),
    s('pwQuest', 'feat: Pinewhistle\'s main chain and the first beacon; Pinewhistle opens',
      'Quest (people, depths, Warden, Kindle) per story#ch9-11; the pine sings within 10 s, crown lantern, horizon card a night window, an Acornet visits the plaza; 1st-beacon count beat (Granny Wick reads Lamp Log 2; Hoot\'s star count); unhide; chapter test ch-pinewhistle.',
      'mossmantle pwPeople beacons', 'M', '-', 'story#ch9-11; story#beacon-1'),
    s('nightX', 'feat: The Night Crossing: after Mossy Span, Pip follows the Acornets\' whistles across misty Misthollow',
      'Main-path set piece filed between S-106a and S-106b (Pinewhistle still hidden): a `before` sub-objective of the next step (no index shift); mist fills Misthollow; six whistle waypoints by Lantern light; Dimlings in two fog pockets; no fail.',
      'pwQuest', 'M', '-', 'story#set-pieces; story#ch9-11', id='S-106c'),
    s('pwHollows', 'feat: Pinewhistle\'s three Hollows',
      'Three Hollows (glide gap, updraft timing, push-block), 2 petals + 1 gem bag; solver; tracker.',
      'pwFinds hollows glider', 'M', '-', 'dungeons#hollows'),
    s('solverAll', 'test: the progression solver walks the whole realm graph in bun test',
      'Graph built from REALMS, portals, gates and quest unlocks; proves every shipped land completes from a fresh save and lists what each ability opens; fails on a sibling-tool dependency (pacing rule 6).',
      'pwQuest', 'S', '-', 'systems#abilities'),
    s('perf3', 'perf: checkpoint 3: the land template meets every budget; close Pinewhistle',
      'Pine-heavy views, bridges, dungeon rooms; both cameras; phone-class estimate from genMs; fix and record; DESIGN "A land" chapter (people -> depths -> Warden loop, coverage rule, counts per land); briefs/batch-05.md (Pinewhistle cast, enemies, Mossmantle, Whistling Pine GLB).',
      'pwQuest nightX pwHollows', 'S', '-', 'charter#budgets'),
   ])

ms('Pinewhistle side stories, Rook and the first home stories',
   'Side content that makes Pinewhistle and home feel lived in: four Pinewhistle stories, Clover\'s Dash, Rook\'s Races, For Spring and The Long Nap.',
   '{PREV} closed.',
   'Four Pinewhistle side stories, two Dash courses, Rook\'s first race, Digby\'s "For Spring" (part 1) and Grandpa Dormy\'s nightly stories are playable.',
   '+3 h',
   [
    s('ss19', 'feat: side stories 19 The Acorn Hoard and 20 Peer Review',
      'Two journal side quests per side-content (owners Elder Nutmeg, Hoot vs Pinfeather), no fail state, a world mark each, rewards per economy; quest lint.',
      'pwQuest', 'M', '-', 'side-content#ss-19; side-content#ss-20'),
    s('ss21', 'feat: side stories 21 Lost in the Mist and 22 The Sawmill Song',
      'Two side quests; mist ravine route and sawmill rhythm prop states; rewards.',
      'pwQuest', 'M', '-', 'side-content#ss-21; side-content#ss-22'),
    s('dash', 'feat: Clover\'s Dash: timed courses with tiered prizes, on home and Pinewhistle',
      'Course framework (ring gates, start post, best time in collect.dash, tiers: heart petal / gems / a ribbon on Clover\'s windowsill); home and Pinewhistle courses; Clover owns it.',
      'save9 pwQuest', 'M', '-', 'side-content#act-dash'),
    s('rook', 'feat: Rook the crow and Rook\'s Races part 1',
      'Rook code-built NPC (ART BRIEF + portrait), race ghost on a spline, part 1 in Pinewhistle; side story 49 scaffold (5 parts).',
      'dash', 'M', '-', 'cast#rook; side-content#ss-49'),
    s('ss01a', 'feat: side story 1 For Spring, part 1: Digby\'s secret planting',
      'Digby admits the pouch; golden sprouts appear in the Meadow by flag via a post-pass; part 2 waits for Gran\'s Pouch (ss-33).',
      'homelines', 'M', '-', 'side-content#ss-01'),
    s('ss02', 'feat: side story 2 The Long Nap: Grandpa Dormy\'s cottage and one story a night',
      'Cottage 1 becomes an interior; Dormy (dormouse) awake 21:00-23:00, tells one lore story per night (7) from lore.md; ART BRIEF + portrait.',
      'interiors F13', 'M', '-', 'side-content#ss-02; cast#grandpa-dormy'),
    s('closeM15', 'chore: close M15: brief batch 05 and side-content notes',
      'briefs/batch-06.md (Rook, Dormy, Acornet extras, Dash posts); DESIGN side-story rules; progress.md.',
      'ss19 ss21 rook ss01a ss02', 'S', '-', 'charter#close-out'),
   ])

ms('Archwater and the midpoint',
   'The second isle from the template, with a two-state tide, the Tide Bell, Undertow Grotto and Old Gloop; II.M lands with whichever beacon is relit second.',
   '{PREV} closed.',
   'Archwater is playable start to finish; the tide turns; the Storm Cave and two tide caches open on home; on the second beacon Mote lands, names himself, and every villager reacts.',
   '+4.5 h',
   [
    s('awRecipe', 'feat: Archwater basalt recipe with a two-state tide (hidden)',
      'recipes/basalt.js, 512 m, seed 40231: stepped column plateau, tide flats whose walkable state follows flag `tide:archwater` (both states printed), regions The Raft, Basalt Stairs, Tidepool Shelf, Kelp Shallows; prints both states.',
      'pwRecipe', 'M', '-', 'atlas-isles#archwater'),
    s('awKit', 'feat: Archwater props: basalt columns, kelp, tide pools, the Raft and the Great Arch',
      'Column stamps, kelp, pool rims, Raft as bridge decks, Great Arch 26 m / 40 m span over the Moon Pool with its beacon; sealed grotto portal; ART BRIEFs.',
      'awRecipe lampkit', 'M', '-', 'atlas-isles#archwater'),
    s('awArt', 'art: Archwater look, loading card, map art and music',
      'Terrain layers, loading card, map art; palette #36414f #7fd3d0 #e2c9a0 #6b4a8c; track `archwater` (plucked strings).',
      'awRecipe', 'M', '-', 'art-audio#archwater'),
    s('awPeople', 'feat: the Raft\'s people: Skipper Rafferty and the rafters',
      'Otter NPCs (shared rig, recolours), Rafferty portrait, dialogue tables; local quest steps as data.',
      'awKit', 'M', '-', 'cast#skipper-rafferty'),
    s('awEnemies', 'feat: Archwater enemies: Tidepool Jelly, Squirt Urchin and Sand Snapper',
      'Hopper, turret and burrower species, models, cards, spawn tables.',
      'arch2 awKit', 'M', '-', 'creatures#enemy-tidepool-jelly; creatures#enemy-squirt-urchin; creatures#enemy-sand-snapper'),
    s('tideBell', 'feat: the Tide Bell rings tide stones; the Storm Cave and two tide caches open on home',
      'Ability `tide`; tide-stone gate flips a realm or dungeon water flag; home post-pass for the Storm Cave (Shores islets) and 2 tide caches; world.test; in-page test.',
      'F20 awRecipe', 'M', '-', 'systems#items-tools; atlas-home#tide-finds'),
    s('awFinds', 'feat: Archwater finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (12 / 4 / 9 / 3 / 1 / 2 / 3 Hollows / benches); coverage test in both tide states.',
      'awKit', 'M', '-', 'atlas-isles#archwater'),
    s('ug1', 'feat: Undertow Grotto rooms 1-7: rooms that flip between two water levels',
      'dungeons/undertow.js rooms 1-7; per-tile alternate floor states toggled by tide stones; solver over water states.',
      'tideBell F23b', 'M', '-', 'dungeons#d3'),
    s('ug2', 'feat: Undertow Grotto rooms 8-14 and the way to Old Gloop',
      'Rooms 8-14, Tide Bell chest, 4 chests, boss door; solver.',
      'ug1', 'M', '-', 'dungeons#d3'),
    s('gloop', 'feat: Old Gloop, the octopus holding the sea still',
      'Boss def (56+; sock-coloured arm sweeps one at a time, ink cloud with a gulp and 1.2 s swell, urchins batted back), model 4 m with eight knitted socks, ART BRIEF + portrait, handover, plushie, rematch; balance test.',
      'ug2 calm', 'M', '-', 'creatures#boss-gloop'),
    s('awQuest', 'feat: Archwater\'s main chain: the tide turns; Archwater opens',
      'Quest per story#ch9-11; tide flag flips within 10 s; crown lantern; horizon card b window; a rafter visits the plaza; unhide; chapter test.',
      'gloop awPeople beacons', 'M', '-', 'story#ch9-11'),
    s('raft', 'feat: Floating the Raft: three winch points round the beached Raft, worked under Squirt Urchin fire',
      'Main-path set piece filed between S-127a and S-127b (Archwater still hidden): a `before` sub-objective of the next step (no index shift); three winches crank the Raft onto rollers while urchins on the stacks fire telegraphed squirts; no fail.',
      'awQuest', 'M', '-', 'story#set-pieces; story#ch9-11', id='S-127c'),
    s('undertowEarly', 'feat: the Undertow\'s upper rooms open early and exit onto the Tidepool Shelf',
      'Archwater\'s loop variation, filed between S-127a and S-127b: the pearl door\'s wicket opens r1-r4 at people step 2; r4 gains an exit to a Shelf Mouth by the Great Tidepool, which becomes the main path to the Pool Pearl; the r4->r8 door stays shut until three pearls; dungeon solver updated.',
      'raft', 'M', '-', 'story#loop-variations; dungeons#d3', id='S-127d'),
    s('IIM', 'feat: II.M: the Lamp Thief lands on the second beacon and names himself Mote',
      'Scene on whichever isle is relit second (`beacons == 2`), `moteNamed`; journal entry renamed "Mote"; one new line for every villager (Shellby: "...Mote. Oh, dear."); a moving light on the sky isle some nights; chapter tests for both orders (Pine->Arch, Arch->Pine).',
      'awQuest raft undertowEarly pwQuest mote', 'M', '-', 'story#II.M'),
    s('awHollows', 'feat: Archwater\'s three Hollows',
      'Three Hollows (tide, mirror pool, push-block); petals/gem bag; solver.',
      'awFinds hollows', 'M', '-', 'dungeons#hollows'),
    s('closeM17', 'chore: close M17: the midpoint is documented',
      'DESIGN Act II count beats; story progress in progress.md; Lore tab lists replayable II.M.',
      'IIM awHollows', 'S', '-', 'charter#close-out'),
   ])

ms('Archwater side stories and home households I',
   'Four Archwater side stories, two more activities, and three home households open their doors.',
   '{PREV} closed.',
   'Clover gets safely lost in Archwater, the Raft choir sings, Old Gloop finds his sock (on Frostbun), the Moon Pool reflects; Gloop\'s Juggling and Lagoon Lights run; Granny Mochi, Hazel and the Quackenbushes have stories.',
   '+3.5 h',
   [
    s('ss23', 'feat: side stories 23 Clover\'s Map and 24 The Raft Choir',
      'Two side quests; chalk-arrow props; choir sing scene; rewards.',
      'awQuest', 'M', '-', 'side-content#ss-23; side-content#ss-24'),
    s('ss25', 'feat: side stories 25 Eight Socks and 26 The Moon Pool',
      'The missing sock is on Frostbun (home); Moon Pool night reflection state; rewards.',
      'awQuest', 'M', '-', 'side-content#ss-25; side-content#ss-26'),
    s('actAw', 'feat: Gloop\'s Juggling and Lagoon Lights, plus Dash courses and Rook\'s race on Duskwick and Archwater',
      'Two activities per side-content (tiers), Dash courses for Duskwick and Archwater, Rook part 2.',
      'dash rook awQuest', 'M', '-', 'side-content#act-juggling; side-content#act-lagoon-lights; side-content#act-dash'),
    s('ss03a', 'feat: side story 3 Nothing Is Refundable, part 1: Granny Mochi\'s cottage',
      'Cottage 4 interior; Granny Mochi (very old fluffy cat) brokers the twins\' first letter; part 2 comes with the Kettle side stories (M27).',
      'kinako interiors', 'M', '-', 'side-content#ss-03; cast#granny-mochi'),
    s('ss05', 'feat: side story 5 A Bun for Every Isle: Hazel\'s cottage and buns',
      'Cottage 3 interior; Hazel Thimble (hedgehog baker); buns 10 gems heal half a heart (consumable item); deliver a bun to one person per isle (grows as isles ship).',
      'interiors F14', 'M', '-', 'side-content#ss-05; cast#hazel-thimble'),
    s('ss06', 'feat: side story 6 The Duck Regatta with the Quackenbushes',
      'Five ducks NPCs; regatta course on the home pond/shore; activity tiers (40 gems / duck plushie / praise).',
      'dash', 'M', '-', 'side-content#ss-06; side-content#act-regatta'),
    s('closeM18', 'chore: close M18: brief batch 06',
      'briefs/batch-06.md (Archwater cast, Gloop GLB, Raft, Great Arch, enemies, Mochi, Hazel, ducks); progress.md.',
      'ss23 ss25 actAw ss03a ss05 ss06', 'S', '-', 'charter#close-out'),
   ])

ms('Threemills; the Tower unlocks',
   'The third isle from the template, with the Thistle Hook, the Granary Vaults and Lady Honksworth; the third beacon unlocks the Lamplighters\' Tower.',
   '{PREV} closed.',
   'All three Act II isles are playable in any order; the Hook reaches three home finds; after the third beacon Granny Wick says the old lamp can wake and the Tower door opens.',
   '+4.5 h',
   [
    s('tmRecipe', 'feat: Threemills downs recipe: farmland, hedgerows, millpond (hidden)',
      'recipes/downs.js, 576 m, seed 40237: rolling noise, hedgerow spline colliders, field patchwork splat; regions Haybury, Tumble Hill, Orchard Rows, Millpond Marsh; prints.',
      'awRecipe', 'M', '-', 'atlas-isles#threemills'),
    s('tmKit', 'feat: Threemills props: Tansy, Thrift and Middle Mill on Tumble Hill, orchards and wheat',
      'Three windmills 22 m (sails static until kindled), wheat-square deco, apple trees, hedgerows, granary exterior with sealed portal; ART BRIEFs.',
      'tmRecipe lampkit', 'M', '-', 'atlas-isles#threemills'),
    s('tmArt', 'art: Threemills look, loading card, map art and music',
      'Terrain layers, loading card, map art; palette #e7c45a #7fae4b #c2563f #a7d3f0; track `threemills` (fiddle and accordion).',
      'tmRecipe', 'M', '-', 'art-audio#threemills'),
    s('tmPeople', 'feat: Haybury\'s people: the Hayburys, Goody Gander and Pennywhistle',
      'Mouse family (shared rig), goose miller, scarecrow; portraits for named; dialogue tables; local quest steps.',
      'tmKit', 'M', '-', 'cast#the-hayburys; cast#goody-gander; cast#pennywhistle'),
    s('tmEnemies', 'feat: Threemills enemies: Field Vole gang, Scarecrowlet and Woolly Ram',
      'Swarm, turret and charger species, models, cards, spawn tables.',
      'arch2 tmKit', 'M', '-', 'creatures#enemy-field-vole; creatures#enemy-scarecrowlet; creatures#enemy-woolly-ram'),
    s('hook', 'feat: the Thistle Hook grapples to hookblooms; three home hook finds',
      'Ability `hook` (14 m pull along a line, LOS check), hookbloom gate prop; home post-pass: Cairn needle summit ledge (Starstair foot, inert), Grumble\'s Crown cap top, lighthouse roof; world.test; in-page test.',
      'F20 tmRecipe', 'M', '-', 'systems#items-tools; atlas-home#hook-finds'),
    s('tmFinds', 'feat: Threemills finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (14 / 4 / 10 / 3 / 1 / 2 / 3 Hollows / benches); coverage test.',
      'tmKit', 'M', '-', 'atlas-isles#threemills'),
    s('gv1', 'feat: the Granary Vaults rooms 1-6: hay-bale blocks and gear bridges',
      'dungeons/granary.js rooms 1-6; crank-rotated gear-bridge entity; solver.',
      'hook F23b', 'M', '-', 'dungeons#d4'),
    s('gv2', 'feat: the Granary Vaults rooms 7-12: hook posts and the way to the Warden',
      'Rooms 7-12, Hook chest, 4 chests, boss door; solver.',
      'gv1', 'M', '-', 'dungeons#d4'),
    s('honks', 'feat: Lady Honksworth, the exhausted goose who flapped the mill sails by hand',
      'Boss def (56+; HONK ring, wing charge into the gear wall, feather fan 5/7), model 3.2 m with bonnet, ART BRIEF + portrait, handover, plushie, rematch; balance test.',
      'gv2 calm', 'M', '-', 'creatures#boss-honksworth'),
    s('tmQuest', 'feat: Threemills\' main chain: the sails turn; Threemills opens; the Tower unlocks',
      'Quest; sails turn within 10 s; crown lantern; horizon card d window; a Haybury visits; 3rd-beacon beat opens the Tower door (`towerOpen`); unhide; chapter test.',
      'honks tmPeople beacons IIM', 'M', '-', 'story#ch9-11; story#beacon-3'),
    s('followHonks', 'feat: Follow the Honks: trail Lady Honksworth across the hedgerows to the vault entrance',
      'Main-path set piece filed between S-148a and S-148b (Threemills still hidden): a `before` sub-objective of the next step (no index shift); ships js/npc-guide.js (moved here from S-152a, which reuses it); Honksworth leads a 6-stop hedgerow route at 1.4 m/s; no fail.',
      'tmQuest', 'M', '-', 'story#set-pieces; story#ch9-11', id='S-148c'),
    s('tmHollows', 'feat: Threemills\' three Hollows',
      'Three Hollows (hook, gear, hay); petals/gem bag; solver.',
      'tmFinds hollows', 'M', '-', 'dungeons#hollows'),
    s('actII3', 'test: all six Act II isle orders reach the Tower',
      'Chapter fixtures for the 6 permutations (compressed via warps), assert crown lanterns 3, moteNamed once, Tower open; solver run.',
      'tmQuest solverAll', 'S', '-', 'systems#test-harness'),
    s('perf4', 'perf: checkpoint 4: four isles, save size and swap soak; close Threemills',
      'Swap through all shipped realms 10x in-page: leaks, swap time, save size; budgets per view; fix and record; DESIGN Act II isles table.',
      'tmQuest followHonks', 'S', '-', 'charter#budgets'),
   ])

ms('Threemills side stories and Village Works',
   'Four Threemills side stories, Ribbit\'s Village Works, two home households, and the home activities.',
   '{PREV} closed.',
   'Pennywhistle wants a crow friend (Rook obliges), Ribbit sails to Middle Mill, a Thistledown kit stows away, Village Works projects can be funded, Spore Rally and Sledding run.',
   '+3.5 h',
   [
    s('ss27', 'feat: side stories 27 Your Honkship and 28 Scarecrow Hats',
      'Two side quests; rewards.',
      'tmQuest', 'M', '-', 'side-content#ss-27; side-content#ss-28'),
    s('ss29', 'feat: side stories 29 The Scarecrow Who Wanted Crows and 30 Pie Rations',
      'Pennywhistle meets Rook; pie delivery; rewards.',
      'tmQuest rook', 'M', '-', 'side-content#ss-29; side-content#ss-30'),
    s('actTm', 'feat: Harvest Cut, Dash on Threemills and Rook\'s race part 3',
      'Harvest Cut activity (swing timed by a sail; tiers); Dash course; Rook part 3.',
      'actAw tmQuest', 'M', '-', 'side-content#act-harvest-cut'),
    s('ss04', 'feat: side story 4 The Mayor Goes to Sea: Ribbit\'s speech on Middle Mill',
      'Ribbit (afraid of deep water) sails with Nell; speech scene on Middle Mill; reward.',
      'tmQuest', 'M', '-', 'side-content#ss-04'),
    s('ss08', 'feat: side story 8 Little Thistledown: Primrose\'s cottage and a stowaway kit',
      'Cottage 5 interior; Primrose and four kits; a kit stows away to Duskwick; fetch and return.',
      'interiors ch8', 'M', '-', 'side-content#ss-08; cast#primrose-thistledown'),
    s('works', 'feat: Village Works: fund Ribbit\'s eight village projects with gems',
      'Eight projects x 250 gems (data), each a flag that shows a home post-pass prop set (bandstand, duck pond dock, etc.); board on the plaza; economy test.',
      'econ', 'M', '-', 'systems#economy; atlas-home#village-works'),
    s('actHome', 'feat: Spore Rally with Grumble Shroom',
      'One home activity with tiers (Spore Rally 10/20/30 hits); Sledding shipped early as S-158a (M07).',
      'calm', 'M', '-', 'side-content#act-spore-rally', suffix='b'),
    s('closeM21', 'chore: close M21: brief batch 07',
      'briefs/batch-07.md (Threemills cast, Honksworth GLB, mills, enemies, Thistledowns, Village Works props); progress.md.',
      'ss27 ss29 actTm ss04 ss08 works actHome', 'S', '-', 'charter#close-out'),
   ])

ms('The Lamplighters\' Tower and the end of Act II',
   'The Sunglass, Sleeping Acorns everywhere, the Tower dungeon, the Wickwork Moth and Mote taking the Firstlight.',
   '{PREV} closed.',
   'Pip climbs the Tower, earns the Sunglass and a heart container, calms the Wickwork Moth and kindles the Firstlight; Mote takes it; a ladder of lights hangs in the north-east sky; "End of Act Two". Sleeping Acorns can be woken on every shipped land.',
   '+4 h',
   [
    s('sunglass', 'feat: the Sunglass aims a light beam at receivers',
      'Ability `sunglass` (aimed beam from the held lantern, 18 m, hits receivers and mirrors); receiver gate prop; in-page aim test in both cameras.',
      'F20 lantern', 'M', '-', 'systems#items-tools'),
    s('acorns', 'feat: Sleeping Acorns wake with the Sunglass and grow saplings',
      'Acorn snore cue within 10 m; wake -> sapling prop (home post-pass for 12 home acorns, own RNG); ring carved on the Tree per 25; Miso stocks a new item at 25/50/75/100; tracker rows.',
      'sunglass save9', 'M', '-', 'systems#collectibles; atlas-home#acorns'),
    s('tower1', 'feat: the Lamplighters\' Tower floors 1-3: mirrors and the skylight beam',
      'dungeons/tower.js floors 1-3 as split levels; mirrors turn 45 deg on a hit; receivers open doors; Sunglass found on floor 3; solver.',
      'sunglass F23b', 'M', '-', 'dungeons#d5'),
    s('tower2', 'feat: the Lamplighters\' Tower floors 4-5 and the lamp room',
      'Floors 4-5, heart container chest, boss door; solver.',
      'tower1', 'M', '-', 'dungeons#d5'),
    s('wickwork', 'feat: the Wickwork Moth, the brass guardian of the great lamp',
      'Boss def (72 HP; lens-beam sweeps, wing-gust push zone, dives at the lamp with an opening on a miss), model 4 m span, ART BRIEF + portrait, handover, plushie, rematch; Granny Wick rewinds it after.',
      'tower2 calm', 'M', '-', 'creatures#boss-wickwork-moth'),
    s('ch12', 'feat: chapter 12: the Firstlight is kindled and Mote takes it; End of Act Two',
      'Scene per story#ch12; crown lantern 4 stays lit; small sneeze drops one leaf per tree; Ladder billboard in the NE sky of every realm (flag `act2done`); Act II card; chapter test ch12.',
      'wickwork ch8 tmQuest', 'M', '-', 'story#ch12'),
    s('closeM22', 'chore: close M22: Act II release notes and DESIGN',
      'DESIGN Act II complete; README hours; progress.md.',
      'ch12 acorns', 'S', '-', 'charter#close-out'),
   ])

ms('Act II aftercare: Duskwick stories, old beacons, Wenna and the Catchers',
   'Duskwick\'s four side stories, the four old Lamplighter beacons on home, Catchers in the plaza and Wenna\'s Act II lines.',
   '{PREV} closed.',
   'Granny Wick\'s Library fills with Lamp Logs, Flick builds a clockwork, Kinako sells an ordinary spoon, the four old home beacons glow, and the Catchers visit the plaza.',
   '+2.5 h',
   [
    s('ss15', 'feat: side stories 15 Moth to a Flame and 16 Granny Wick\'s Library',
      'Two side quests; Library interior in Wickhaven where found Lamp Logs shelve themselves.',
      'ch12 logs interiors', 'M', '-', 'side-content#ss-15; side-content#ss-16'),
    s('ss17', 'feat: side stories 17 The Clockwork Apprentice and 18 Kinako\'s Limited Edition',
      'Flick\'s automaton; the same spoon from every isle (grows as isles ship).',
      'ch12 kinako', 'M', '-', 'side-content#ss-17; side-content#ss-18'),
    s('oldBeacons', 'feat: four old Lamplighter beacons wake on home\'s landmarks',
      'Home post-pass places 4 beacon ruins at the landmarks; the Sunglass wakes each (receiver), each gives a Lamp Log; world.test.',
      'sunglass logs', 'M', '-', 'atlas-home#old-beacons'),
    s('catchersPlaza', 'feat: the Catchers visit the plaza, and villagers react to Act II',
      'After moteNamed the three Catchers spend evenings at the plaza edge (talkable); villager lines for act2done; memory lines once for Act II.',
      'ch12 memlines', 'M', '-', 'story#act-II-reactions; cast#catchers'),
    s('wennaII', 'feat: Wenna\'s Act II lines and side story 14 The Fourth Bough (part 1)',
      'Next 16 pedestal lines keyed to beacons/moteNamed; The Fourth Bough opens (the Meadow bough waits for something).',
      'wennaVoice ch12', 'S', '-', 'story#wenna-lines; side-content#ss-14'),
    s('ss13', 'feat: side story 13 Shellby\'s Slow Walk (resumable)',
      'Walk with Shellby to a spot per land as they ship; resumes; scenes replay.',
      'ch12', 'M', '-', 'side-content#ss-13'),
    s('closeM23', 'chore: close M23: brief batch 08',
      'briefs/batch-08.md (Tower interior, Wickwork Moth GLB, Library, acorn saplings, old beacons); progress.md.',
      'ss15 ss17 oldBeacons catchersPlaza wennaII ss13', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- PHASE E: Act III
ms('The Rootdeep: the land, the Heart and Lumbra',
   'NPC pathfinding, the cavern recipe, Burrowbottom, the Digging Paws, root-gates, the Rootdeep Heart and Lumbra the Long (the realm stays hidden until chapter 13 ships next milestone).',
   '{PREV} closed.',
   'The Paws dig soft earth on every shipped land and root-gates link the lands once found; the Rootdeep, its dungeon and Lumbra are complete behind `?realm=rootdeep`.',
   '0 h visible (+3.5 h shipped with chapter 13)',
   [
    s('F27', 'feat: NPCs walk paths and keep simple schedules',
      'ENGINE F27: js/pathfind.js A* on W.walk (8-neighbour, string-pulled, queue 1 per frame), js/schedule.js; an NPC reaches its evening spot in-page; unit A* fixtures.',
      'F3', 'M', '-', 'systems#schedules'),
    s('rdRecipe', 'feat: the Rootdeep cavern recipe: walls, low halls and the underlake (hidden)',
      'recipes/cavern.js, 576 m, seed 40241: void palette, walls to 30 m, ceiling `over` boxes in low halls, fog 10-90 m, regions Burrowbottom, Glowcap Forest, The Underlake, Geode Galleries; prints.',
      'pwRecipe F22', 'M', '-', 'atlas-far#rootdeep'),
    s('rdKit', 'feat: Rootdeep props: the Taproot, glowcaps, geodes and root walls',
      'Taproot 60 m glowing column with 12 knot sockets (inert), house-size mushrooms, geode clusters, root-wall stamps; glow materials; ART BRIEFs.',
      'rdRecipe', 'M', '-', 'atlas-far#rootdeep'),
    s('rdArt', 'art: Rootdeep look, loading card, map art and music',
      'Terrain layers, loading card, map art; palette #1c1a24 #ffcf7a #7be0c8 #8a5a3c; track `rootdeep` (low cello, drips).',
      'rdRecipe', 'M', '-', 'art-audio#rootdeep'),
    s('rdPeople', 'feat: Burrowbottom\'s people: Gran Burrows and the burrowers',
      'Mole NPCs (Digby\'s rig recoloured), Gran Burrows portrait; dialogue tables.',
      'rdKit', 'M', '-', 'cast#gran-burrows'),
    s('rdEnemies', 'feat: Rootdeep enemies: Glow Grub, Drip Bat and Pebble Mimic',
      'Hopper, swooper and mimic species, models, cards, spawn tables.',
      'arch2 rdKit', 'M', '-', 'creatures#enemy-glow-grub; creatures#enemy-drip-bat; creatures#enemy-pebble-mimic'),
    s('rdFinds', 'feat: Rootdeep finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (12 / 4 / 9 / 2 / 0 / 3 / 3 Hollows / benches); coverage test.',
      'rdKit', 'M', '-', 'atlas-far#rootdeep'),
    s('mitts', 'feat: Digging Paws dig soft earth; buried chests on every shipped land',
      'Ability `dig`; soft-earth mound gate; home post-pass 5 dig spots (Digby\'s rumours) and per-realm post-passes for 2-3 buried chests on Duskwick, Pinewhistle, Archwater, Threemills (each own RNG; realm prints unchanged); world tests.',
      'F20 rdRecipe', 'M', '-', 'systems#items-tools; atlas-home#dig-spots'),
    s('rootgates', 'feat: root-gates: underground fast travel between lands, ferried by Lumbra',
      'One root-gate per land (stub positions from each land\'s finds step), opened from both sides; travel menu entry; Meadow Windmill root-gate on home via placePortals; S.travel; in-page.',
      'F24 mitts', 'M', '-', 'systems#travel'),
    s('rh1', 'feat: the Rootdeep Heart rooms 1-7: Sunglass beams grow root bridges',
      'dungeons/rootdeep_heart.js rooms 1-7; light-root entity becomes a bridge deck for 20 s when beamed; solver.',
      'mitts sunglass F23b', 'M', '-', 'dungeons#d6'),
    s('rh2', 'feat: the Rootdeep Heart rooms 8-14: soft earth and the Warden\'s hall',
      'Rooms 8-14, Paws chest, 4 chests, boss door; solver.',
      'rh1', 'M', '-', 'dungeons#d6'),
    s('lumbra', 'feat: Lumbra the Long, the 14 m earthworm who keeps the roots healthy',
      'Boss def (76 HP; surfaces from one of six holes with a ring, body-arc stripe, dirt-spray fan), model, ART BRIEF + portrait, handover, plushie, rematch; afterwards ferries at root-gates.',
      'rh2 calm', 'M', '-', 'creatures#boss-lumbra'),
    s('rdHollows', 'feat: the Rootdeep\'s three Hollows',
      'Three Hollows (dig, dark, beam); petals/gem bag; solver; the Rootdeep Dash course.',
      'rdFinds hollows', 'M', '-', 'dungeons#hollows'),
    s('closeM25', 'chore: close M25: ARCHITECTURE on cross-realm post-passes',
      'How later tools add finds to earlier lands without moving prints; progress.md.',
      'rootgates lumbra rdHollows', 'S', '-', 'charter#close-out'),
   ])

ms('The Remembered Isle, chapter 13 and Grumble\'s Undercap',
   'Variant realms, the young cast, memory knots and the first three memories open Act III; the first optional home dungeon and a mid-game soak follow.',
   '{PREV} closed.',
   'Wenna asks to remember; Digby leads Pip through the Rootdeep; Pip calms Lumbra, wins the Paws and touches the first three memory knots to visit the Remembered Isle (home 100 years ago); the roots show where the Stair Stones fell. Pip can also relight the shroomlets\' town under Grumble\'s Crown.',
   '+6 h',
   [
    s('variant', 'feat: variant realms reuse a land\'s geometry with a new skin',
      'REALMS kind `variant` of a parent: same seed and generator (prints equal the parent), palette, scatter type remap, enemy table, NPC set, music, plus a variant post-pass; `remembered` skeleton (sepia/gold #e9d8b0 #b8894a #6f5a44, no enemies); unit test prints equality.',
      'palette F3', 'M', '-', 'systems#realms; atlas-home#remembered-isle'),
    s('young', 'feat: the young cast: scaled and recoloured models of Shellby, the Catchers, Granny Wick and Pelagia',
      'Existing GLBs/rigs scaled and recoloured (young Shellby in a too-big hat; smaller cheerful Grumble; hatless Pinch; rabbit-size Frostbun; young Granny Wick; young Pelagia code-built); ART BRIEFs; Pip GLB untouched.',
      'variant', 'M', '-', 'cast#young-cast; art-audio#young-cast'),
    s('knots', 'feat: memory knots on the Taproot open the Remembered Isle at a memory',
      '`[E] Touch · Memory` at 12 knots (lit by count); memory = variant realm + scene script + placed young cast; memory scenes are data in js/content/memories.js; revisitable; the Remembered Isle\'s 4 Sleeping Acorns.',
      'variant scenes rdKit', 'M', '-', 'lore#memories; story#ch13'),
    s('ch13', 'feat: chapter 13 Into the Rootdeep: Digby leads, Lumbra is calmed, memories 1-3',
      'Quest per story#ch13 (`act2done` -> Meadow Windmill root-gate); Digby walks ahead via F27; memories 1-3; roots reveal the three stone sites; root-gates open on visited isles; `ch13`; unhide Rootdeep; chapter test.',
      'knots lumbra rootgates F27', 'M', '-', 'story#ch13'),
    s('ss31', 'feat: side stories 31 Burrowbottom Lamplight and 32 Lumbra\'s Itch',
      'Two side quests; lamp relight in Burrowbottom; Lumbra scratch route.',
      'ch13', 'M', '-', 'side-content#ss-31; side-content#ss-32'),
    s('ss33', 'feat: side story 33 Gran\'s Pouch, and For Spring\'s golden grove',
      'Gran Burrows stitched the pouch; finishes ss-01: a golden grove grows in the Meadow (post-pass by flag).',
      'ch13 ss01a', 'M', '-', 'side-content#ss-33; side-content#ss-01'),
    s('undercap1', 'feat: Grumble\'s Undercap: rooms 1-8 under Grumble\'s Crown',
      'Optional dungeon o2 (Lantern + Paws) via home post-pass entrance; 8 rooms; solver; no boss.',
      'mitts lantern F23b', 'M', '-', 'dungeons#o2'),
    s('ss11', 'feat: side story 11 Grumble\'s Nephews: relight the shroomlet town',
      'Shroomlet NPCs, night-lights relit (the props from placeReasons find their purpose), Spore Rally unlock; reward.',
      'undercap1 actHome', 'M', '-', 'side-content#ss-11'),
    s('perf5', 'perf: checkpoint 5: a mid-game soak across every realm and a full save',
      'Fixture at Act III start with every flag set; in-page swap soak 20x; save size < 80 KB; budgets; memory under 12 GB machine rules; fix and record.',
      'ch13', 'M', '-', 'charter#budgets'),
    s('closeM26', 'chore: close M26: Act III opening documented, brief batch 09',
      'DESIGN Act III overview, variant realms; briefs/batch-09.md (Rootdeep cast, Lumbra GLB, Taproot, young cast, Remembered Isle props); progress.md.',
      'ch13 ss31 ss33 young ss11 perf5', 'S', '-', 'charter#close-out'),
   ])

ms('The Glassway I: sailing and Puffin Post',
   'Free sailing (owner decision 4, with the chart-stop fallback), the shoals realm and chapter 14.',
   '{PREV} closed; owner decision 4 at its default (free sailing).',
   'Nell sails past the reef; Pip steers the Dandelion freely around 9 islets, sandbars and 3 wrecks; Puffin Post and its people; bottles wash up.',
   '+2 h',
   [
    s('boat1', 'feat: boat locomotion: steer the Dandelion on the water plane (behind a flag)',
      'Third locomotion state: on-water steering (speed 0-9 m/s, turn rate, bob), FP/TP camera profile, collision against islet shores via the collider hash; sandbox water realm test; flag `boat` off by default.',
      'F6', 'M', '-', 'systems#boat'),
    s('boat2', 'feat: board, dock and remember the boat; save v10 keeps its place',
      'SAVE_VERSION 10, MIGRATIONS[9] adds `boat: {realm, x, z, heading}`; `[E] Sail` boards at jetties and buoys, docking spots; Starsong-call stub; the chart-stop fallback switch (REALMS.glassway.sail = \'chart\'); tests.',
      'boat1 save9', 'M', 'v10', 'systems#boat; systems#save-plan'),
    s('gwRecipe', 'feat: the Glassway shoals recipe: islets, sandbars and sail lanes (hidden)',
      'recipes/shoals.js, 640 m, seed 40253: fixed authored islets (atlas-far, reconciliation R32; not Poisson discs), sandbars walkable only at low tide flag, sail lanes, buoys to Kettle and Saltglass (fogged), regions Puffin Post, The Sandbars, Wreck Reach, Bell Shallows; prints both tide states.',
      'awRecipe boat1', 'M', '-', 'atlas-far#glassway'),
    s('gwKit', 'feat: Glassway props: stilt post office, wrecks, Gull Rock, the Snoozing Whale and the Bell spire',
      'Kit per atlas; three wreck stamps (one is the Merry Mabel, sealed); Sunken Bell spire 18 m; ART BRIEFs.',
      'gwRecipe lampkit', 'M', '-', 'atlas-far#glassway'),
    s('gwArt', 'art: Glassway look, loading card, map art and music',
      'Terrain layers, water tints, loading card, map art; palette #bfeee6 #f5e6c4 #2f7d8c; track `glassway` (glockenspiel).',
      'gwRecipe', 'M', '-', 'art-audio#glassway'),
    s('ch14', 'feat: chapter 14 Past the Reef: Puffin Post, Postmistress Pell and Mr Whelk',
      'Puffin and hermit-crab NPCs with portraits; Kinako\'s bazaar stop; `ch14`; free sailing on (or chart stops by fallback); unhide; chapter test.',
      'boat2 gwKit ch13', 'M', '-', 'story#ch14; cast#postmistress-pell; cast#mr-whelk'),
    s('fogBells', 'feat: Fog on the Water: sail buoy to buoy by bell sound to reach Puffin Post',
      'Main-path set piece in ch14 (a `before` sub-objective of the post step, no index shift): a fog bank covers the reef lane; five bell buoys ring in order; Pip steers by sound and the bell sprite\'s pulse; drifting wrong only loops back; no fail; the chart-stop fallback plays it as a guided card.',
      'ch14', 'M', '-', 'story#set-pieces; story#ch14', id='S-203b'),
    s('gwEnemies', 'feat: Glassway enemies: Bubble Puffer and Gullgrab',
      'Kiter and diver species (Gullgrab snatches up to 3 gems and drops them when bonked, R35), models, cards, spawn tables.',
      'arch2 gwKit', 'M', '-', 'creatures#enemy-bubble-puffer; creatures#enemy-gullgrab'),
    s('gwFinds', 'feat: Glassway finds: chests, keepsakes, acorns, vistas, four bottles, Lamp Logs, Hollow doors',
      'Post-pass per atlas counts (12 / 4 / 8 / 3 / 4 bottles / 3 / 2 Hollows / benches on islets); coverage over land cells.',
      'gwKit logs', 'M', '-', 'atlas-far#glassway'),
   ])

ms('The Glassway II: fishing, the Starsong and the Sunken Bell',
   'Fishing, the Starsong, the Sunken Bell dungeon, Pelagia\'s duel and the Stair Stone count beats.',
   '{PREV} closed.',
   'Pip fishes with Nell (24 species), plays the Starsong (Dawn, Dusk, Calling), solves the Sunken Bell, wins Pelagia\'s bell duel and sets the first Stair Stone: a flight of steps rises from the Cairn and memories 4-6 open.',
   '+5 h',
   [
    s('fish1', 'feat: fishing with Nell: cast, a timed Swing and the Fish Log',
      '`[E] Fish` at ripple spots; timed Swing minigame; Fish Log in the journal; Nell\'s tank in her cottage (interior); tiers (heart petal at 16 species / rod charm / the tank).',
      'save9 jetty interiors', 'M', '-', 'side-content#act-fishing'),
    s('fish2', 'feat: 24 fish species and 18 spots across the shipped lands',
      'Species data (rarity by land, time, tide); spots via per-realm post-passes; painted fish icons generated (atlas sheet sliced with tools/slice_sheet.py).',
      'fish1', 'M', '-', 'side-content#act-fishing; art-audio#fish'),
    s('starsong', 'feat: the Starsong: three tunes for star doors, night and the boat',
      'Item `starsong` with tunes Dawn, Dusk, Calling (3-note input on Swing/Hop/Roll); star door gate; at a bench Dusk/Dawn sets night/day; Calling summons the Dandelion; home: 4 star doors at keepsake spots (post-pass).',
      'F20 boat2', 'M', '-', 'systems#items-tools; atlas-home#star-doors'),
    s('bell1', 'feat: the Sunken Bell rooms 1-6: three pitches open matching doors',
      'dungeons/sunken_bell.js rooms 1-6; pitch bells and pitch doors; solver.',
      'starsong F23b', 'M', '-', 'dungeons#d7'),
    s('bell2', 'feat: the Sunken Bell rooms 7-11: sequences heard elsewhere',
      'Rooms 7-11, Starsong chest, chests, the chapel; solver.',
      'bell1', 'M', '-', 'dungeons#d7'),
    s('pelagia', 'feat: Pelagia\'s bell-order duel: a game of wits, never an attack',
      'Wits encounter: she rings, Pip answers on three bells, 3 rounds; wrong notes splash half a heart with a 0.8 s tell; cannot end the duel; model 3 m with bell, ART BRIEF + portrait; plushie; Bell Duel rematch hook.',
      'bell2 calm', 'M', '-', 'creatures#boss-pelagia'),
    s('stones', 'feat: Stair Stones set at the Cairn raise Starstair flights and open memories by count',
      'Count beat framework: set a stone -> a floating flight rises from the Cairn needle (visible from every realm), crown lantern, memories 4-6 for the 1st (data for 7-9, 10-12 by count); Sunken Bell quest done; chapter test ch-bell.',
      'pelagia knots beacons', 'M', '-', 'story#stone-beats; lore#memories'),
    s('moteNow', 'feat: Mote in the present: a note on the first stone, a figure on the stair, and the crown\'s pull',
      'Count-keyed present-day beats: a scrap lamp and note on the set socket after stones==1; scene stone2-mote (40 s) at the Cairn on the first home night at 21:00+ after stones==2 (flag moteSeenStair); fx.leafPull in the crown at night from act2done with 20 x (1 + stones) particles; Shellby and Catcher reactions.',
      'stones traces', 'M', '-', 'story#stone-beats; story#act-III', id='S-212d'),
    s('closeM29', 'chore: close M29: DESIGN on sailing, fishing and stones',
      'DESIGN sections; progress.md; Lore tab lists memories 4-6.',
      'fish2 stones moteNow', 'S', '-', 'charter#close-out'),
   ])

ms('Glassway stories, the Merry Mabel and Moonmere',
   'The optional wreck dungeon, four Glassway stories, Old Friends, and Moonmere, Mote\'s mirror-home.',
   '{PREV} closed.',
   'Pip delivers bottles\' letters, helps Mr Whelk, rolls the Snoozing Whale over, calms Bosun Snore on the Merry Mabel, watches Shellby and Pelagia meet again, and walks the moonpath into Moonmere.',
   '+4 h',
   [
    s('mabel', 'feat: the Merry Mabel: a tilted wreck dungeon and Bosun Snore',
      'Optional dungeon o3 (9 rooms; tilted decks, Hook across holds, Tide Bell bilges) and Bosun Snore (80 HP; sleep-rolls, snore-bubble rings, three dozing seal deckhands), ship\'s bell reward; solver; balance test.',
      'gwKit hook tideBell calm', 'M', '-', 'dungeons#o3; creatures#boss-bosun-snore'),
    s('ss34', 'feat: side stories 34 Return to Sender and 35 The Collector',
      'Pell delivers found bottles\' letters (rewards per bottle); Mr Whelk\'s shell list.',
      'ch14 logs', 'M', '-', 'side-content#ss-34; side-content#ss-35'),
    s('ss36', 'feat: side stories 36 The Merry Mabel and 37 The Whale Who Rolls Over, and the Bell Duel',
      'Mabel story wraps o3 (bell to Pinch); the whale islet rolls by flag (post-pass state); Bell Duel activity with Pelagia (tiers).',
      'mabel pelagia', 'M', '-', 'side-content#ss-36; side-content#ss-37; side-content#act-bell-duel'),
    s('ss09', 'feat: side story 9 Old Friends: Shellby and Pelagia',
      'Shellby sails out; a beach scene that mirrors memory 6; replayable.',
      'stones', 'M', '-', 'side-content#ss-09'),
    s('moonmere', 'feat: Moonmere: the moonpath off Nell\'s Jetty leads to Mote\'s mirror-home',
      'Variant of home (#cfd8ee #2a3358 #f6f3d8), opened by the Starsong Calling on the moonpath at night after the Sunken Bell; the Moon Tree; 12 moon-lanterns; 1 bottle; Hushlings (ghost) + silver swaps of the six home species; prints equal home.',
      'variant starsong stones', 'M', '-', 'atlas-home#moonmere; creatures#enemy-hushling'),
    s('ss47', 'feat: side story 47 Letters Never Sent and the Mirror Garden',
      'Mote\'s twelve unsent letters to Wenna in the Mirror Garden; Lore entries.',
      'moonmere', 'M', '-', 'side-content#ss-47; lore#mote-letters'),
    s('gwHollows', 'feat: the Glassway\'s two Hollows and its Dash course',
      'Two Hollows (tide, bell); Dash course over sandbars at low tide.',
      'gwFinds hollows dash', 'M', '-', 'dungeons#hollows; side-content#act-dash'),
    s('closeM30', 'chore: close M30: brief batch 10',
      'briefs/batch-10.md (Glassway cast, Pelagia GLB, Bosun Snore, Mabel, whale, Moonmere, Hushling, Dandelion GLB); progress.md.',
      'ss34 ss36 ss09 ss47 gwHollows', 'S', '-', 'charter#close-out'),
   ])

ms('Kettle Isle: the forge, the Belly and Starsteel',
   'The forge isle, the Ember Sling, the Kettle\'s Belly, Lady Fumarole, a Stair Stone (twist T5 when it is the second) and the Starsteel Sword.',
   '{PREV} closed.',
   'Pip calms Lady Fumarole and sets a Stair Stone; the Sling opens the home bell targets and the Snowglobe wall; Scoria forges Starsteel, which cuts thornglass in every land.',
   '+5 h',
   [
    s('kiRecipe', 'feat: Kettle Isle cone recipe: the teakettle volcano and spring terraces (hidden)',
      'recipes/cone.js, 512 m, seed 40261: central cone, terraced flank, spring basins, lava-tube mouths as portals; regions Forgefall, Bathhouse Terraces, Ash Beach, The Spout; prints.',
      'tmRecipe', 'M', '-', 'atlas-far#kettle'),
    s('kiKit', 'feat: Kettle Isle props: the Kettle, forges, bathhouse and steam vents',
      'Kettle cone landmark 45 m with steam spout, forge town, bathhouse terraces, vents; ART BRIEFs.',
      'kiRecipe lampkit', 'M', '-', 'atlas-far#kettle'),
    s('kiArt', 'art: Kettle Isle look, loading card, map art and music',
      'Terrain layers, loading card, map art; palette #3b3540 #e66f4f #f4d1a6 #8fc7a0; track `kettle` (brass and steam).',
      'kiRecipe', 'M', '-', 'art-audio#kettle'),
    s('kiPeople', 'feat: Forgefall\'s people: Master Scoria, Pitch and Soakley',
      'Bear smith, newt apprentice, capybara bath-keeper; portraits; dialogue tables; Miso supply hook.',
      'kiKit', 'M', '-', 'cast#master-scoria; cast#pitch; cast#soakley'),
    s('kiEnemies', 'feat: Kettle enemies: Soot Snuffle, Steam Puff and Ash Moth',
      'Charger, turret and swooper species, models, cards, spawn tables.',
      'arch2 kiKit', 'M', '-', 'creatures#enemy-soot-snuffle; creatures#enemy-steam-puff; creatures#enemy-ash-moth'),
    s('sling', 'feat: the Ember Sling: ranged ember shots for bell targets, braziers and ice walls',
      'Item `sling` (25 m, aim in both cameras); bell target, cold brazier and ice wall gates; home post-pass: 4 bell targets on the landmarks (all four -> the Bell Hollow), Snowglobe ice wall; world.test.',
      'F20 kiRecipe', 'M', '-', 'systems#items-tools; atlas-home#bell-targets'),
    s('kiFinds', 'feat: Kettle Isle finds: chests, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (12 / 4 / 9 / 3 / 1 / 3 / 2 Hollows / benches); coverage test.',
      'kiKit', 'M', '-', 'atlas-far#kettle'),
    s('kb1', 'feat: the Kettle\'s Belly rooms 1-7: valves raise and lower platforms',
      'dungeons/kettle_belly.js rooms 1-7; steam valve platforms; solver.',
      'sling F23b', 'M', '-', 'dungeons#d8'),
    s('kb2', 'feat: the Kettle\'s Belly rooms 8-13: braziers at range and wax plugs',
      'Rooms 8-13, Sling chest (room 5), chests, boss door; solver.',
      'kb1', 'M', '-', 'dungeons#d8'),
    s('fumarole', 'feat: Lady Fumarole, the fire-newt in a bath towel on the spout lid',
      'Boss def (84 HP; belly-flop disc, hot-pebble fan, steam pillars, slips on her towel as the opening), model, ART BRIEF + portrait, handover (the stone), plushie, rematch; balance test.',
      'kb2 calm', 'M', '-', 'creatures#boss-fumarole'),
    s('kiQuest', 'feat: Kettle Isle\'s main chain: the forges relight and a Stair Stone is set',
      'Quest per story#ch15-17; stone count beat (memories 7-9 when it is the 2nd stone, T5); unhide; chapter test both as 1st and 2nd stone.',
      'fumarole kiPeople stones', 'M', '-', 'story#ch15-17'),
    s('boil', 'feat: The Boil-Over: after Fumarole, Pip relights Forgefall\'s three forges with the Ember Sling through the steam',
      'Kettle\'s set piece and loop variation (a `before` sub-objective of step `place`, no index shift): the Kettle boils over, steam fills Forgefall; three cold forges lit by Sling shots from the street; Lady Fumarole hands the stone over at the bathhouse; no fail.',
      'kiQuest sling', 'M', '-', 'story#set-pieces; story#loop-variations; story#ch15-17', id='S-232c'),
    s('starsteel', 'feat: side story 38 Starsteel: sword level 3 and thornglass thickets; save v11',
      'SAVE_VERSION 11, MIGRATIONS[10] (swordLevel may be 3; normalize clamps to 3); Starsteel 3/3/4, reach 2.2 m, 600 gems forging; thornglass gate + per-realm post-passes in every shipped land; tests.',
      'kiQuest thorns boat2', 'M', 'v11', 'side-content#ss-38; systems#items-tools'),
    s('kiHollows', 'feat: Kettle Isle\'s two Hollows, its Dash course and Rook\'s race part 4',
      'Two Hollows (sling, steam); Dash course; Rook part 4.',
      'kiFinds hollows actTm', 'M', '-', 'dungeons#hollows; side-content#ss-49'),
    s('closeM32', 'chore: close M32: twist T5 documented',
      'DESIGN Act III stones; progress.md.',
      'starsteel kiHollows kiQuest boil', 'S', '-', 'charter#close-out'),
   ])

ms('Kettle stories, the Snowglobe and the parcel chain',
   'Kettle side stories and activities, the Snowglobe and Great-Aunt Flurry, the parcel chain, and the twins\' peace.',
   '{PREV} closed.',
   'Pitch wants a star, Soakley\'s baths settle, Miso meets her supplier, Sling Gallery and Steam Hop run, Frostbun\'s great-aunt naps in the Snowglobe, the Parcel With No Name pays the Chime Bell, and Miso and Kinako hang a joint sign.',
   '+4.5 h',
   [
    s('ss39', 'feat: side stories 39 Pitch Wants a Star and 40 Soakley\'s Baths',
      'Pitch\'s wish (paid off in ch21 with a star splinter: flag only now); bath temperatures puzzle.',
      'kiQuest', 'M', '-', 'side-content#ss-39; side-content#ss-40'),
    s('ss41', 'feat: side story 41 Miso\'s Supplier, Sling Gallery and Steam Hop',
      'Miso visits Forgefall; two activities with tiers.',
      'kiQuest', 'M', '-', 'side-content#ss-41; side-content#act-sling-gallery; side-content#act-steam-hop'),
    s('snow1', 'feat: the Snowglobe rooms 1-10 under Frostcap: melting ice and sliding blocks',
      'Optional dungeon o1 behind the ice wall; push-ice blocks slide until they hit; Ember melts ice; solver.',
      'sling F23b', 'M', '-', 'dungeons#o1'),
    s('flurry', 'feat: Great-Aunt Flurry and side story 12 Frostbun\'s Great-Aunt',
      'Optional boss (90 HP; avalanche roll, icicle rain on circles, nap at 50 %), model, ART BRIEF, heart petal, knits Pip a scarf (hood trim unlock).',
      'snow1 calm', 'M', '-', 'creatures#boss-flurry; side-content#ss-12'),
    s('ss10', 'feat: side story 10 The Parcel With No Name and the Chime Bell',
      'Chain through 6 villagers, 3 Catchers, 3 isle folk; reward Chime Bell (chimes faster near an unopened chest or unfound keepsake within 30 m).',
      'kiQuest catchersPlaza', 'M', '-', 'side-content#ss-10; systems#items-tools'),
    s('ss03b', 'feat: side story 3 Nothing Is Refundable, part 2: the twins\' joint sign',
      'Miso and Kinako make peace; joint shop sign prop; Granny Mochi line.',
      'ss03a ss41', 'S', '-', 'side-content#ss-03'),
    s('closeM33', 'chore: close M33: brief batch 11',
      'briefs/batch-11.md (Kettle cast, Fumarole GLB, Kettle, Snowglobe, Flurry, Chime Bell); progress.md.',
      'ss39 flurry ss10 ss03b', 'S', '-', 'charter#close-out'),
   ])

ms('Saltglass Flats and the third stone',
   'The desert of the buried Academy, the Ivy Gloves, the Buried Academy, Tutor Scarabelle\'s exam and the last Stair Stone.',
   '{PREV} closed.',
   'Pip climbs ivy (including up the Great Tree to a crown balcony), passes the Academy\'s final exam, sets the last Stair Stone (memories 10-12) and finishes Rook\'s Races.',
   '+5 h',
   [
    s('sgRecipe', 'feat: Saltglass dunes recipe: dune ridges, salt pans and ruins (hidden)',
      'recipes/dunes.js, 640 m, seed 40277: directional dune noise, flat pans, ruin stamps; regions Sablecamp, The Glass Dunes, The Salt Pans, Academy Hill; prints.',
      'kiRecipe', 'M', '-', 'atlas-far#saltglass'),
    s('sgKit', 'feat: Saltglass props: the Academy bell tower, glass sculptures and dig camp',
      'Academy bell tower 26 m (half buried), singing glass sculptures, dig-camp tents; ART BRIEFs.',
      'sgRecipe lampkit', 'M', '-', 'atlas-far#saltglass'),
    s('sgArt', 'art: Saltglass look, loading card, map art and music',
      'Terrain layers, loading card, map art; palette #efe3c8 #c9a46b #8ec9d8 #b55d4c; track `saltglass` (still, old).',
      'sgRecipe', 'M', '-', 'art-audio#saltglass'),
    s('sgPeople', 'feat: Sablecamp\'s people: Sable and the dig crew',
      'Jerboa archaeologist and crew; portraits; dialogue tables.',
      'sgKit', 'M', '-', 'cast#sable'),
    s('sgEnemies', 'feat: Saltglass enemies: Sandsnoot, Prickle Pear, Sun Beetle and Dust Puff',
      'Four species (archetypes per creatures.md), code-built models with ART BRIEFs, generated bestiary cards, region spawn tables; one in-page test per species (tell >= 0.55 s before damage, poof).',
      'arch1 sgKit', 'M', '-', 'creatures#enemy-sandsnoot; creatures#enemy-prickle-pear; creatures#enemy-sun-beetle; creatures#enemy-dust-puff'),
    s('gloves', 'feat: the Ivy Gloves climb ivy lattices; three home climbs',
      'Ability `climb` (1.5 m/s on lattice faces, walk into ivy); home post-pass: Great Tree trunk to a crown balcony (vista), windmill wall, lighthouse wall; world.test; in-page climb test.',
      'F20 sgRecipe', 'M', '-', 'systems#items-tools; atlas-home#ivy-finds'),
    s('sgFinds', 'feat: Saltglass finds: chests, keepsakes, acorns, vistas, six Lamp Logs, Hollow doors, benches',
      'Post-pass per atlas counts (16 / 4 / 11 / 3 / 1 / 6 / 3 Hollows / benches); coverage test.',
      'sgKit', 'M', '-', 'atlas-far#saltglass'),
    s('ba1', 'feat: the Buried Academy rooms 1-7: sand-flow tiles and nameplate doors',
      'dungeons/buried_academy.js rooms 1-7; sand-flow tiles slide Pip; nameplate doors; solver.',
      'gloves F23b', 'M', '-', 'dungeons#d9'),
    s('ba2', 'feat: the Buried Academy rooms 8-14: ivy between floors and the exam hall',
      'Rooms 8-14, Gloves chest, chests, exam hall; solver.',
      'ba1', 'M', '-', 'dungeons#d9'),
    s('exam1', 'feat: Tutor Scarabelle\'s exam, papers 1 and 2: dodging and aiming',
      'Exam encounter type: paper 1 sand patterns (dodge), paper 2 Sunglass receivers (aim); model (hourglass beetle), ART BRIEF + portrait.',
      'ba2 sunglass', 'M', '-', 'creatures#boss-scarabelle'),
    s('exam2', 'feat: the exam\'s puzzle paper, the result and the bell\'s stone',
      'Paper 3 arena tiles puzzle; pass -> handover (stone); plushie; Exam Retake hook.',
      'exam1 calm', 'M', '-', 'creatures#boss-scarabelle'),
    s('sgQuest', 'feat: Saltglass\'s main chain: the Academy bell rings and a stone is set',
      'Quest; stone count beat (memories 10-12 when it is the 3rd); unhide; chapter test.',
      'exam2 sgPeople stones', 'M', '-', 'story#ch15-17'),
    s('mem1012', 'feat: memories 10-12: the Storm, the stones fall, a letter by lamplight',
      'Memory scripts 10-12 verbatim from lore (spawns, hours, staging, lines) in the S-190a runner; Remembered Isle storm dressing (rain, the stair going dark, drifting and gone); mem:10-12 flags and mq-remember done; journal replays; in-page check that each plays and sets its flag.',
      'stones kiQuest', 'M', '-', 'lore#mem-10; lore#mem-11; lore#mem-12; atlas-home#remembered-isle', id='S-254b'),
    s('lampWalk', 'feat: The Lamp Walk joins the main chain: Saltglass\'s night walk to the Academy door',
      'Promotes S-249b\'s Lamp Walk into mq-saltglass as a `before` sub-objective of the dungeon step (no index shift): walk the lamp line at night with the Lantern; each lamp lit wakes a nameplate; the Academy door opens on the last; no fail.',
      'sgQuest sgFinds', 'M', '-', 'story#set-pieces; story#ch15-17', id='S-254c'),
    s('sgHollows', 'feat: Saltglass\'s three Hollows, its Dash course and Rook\'s race finale',
      'Three Hollows; Dash course; Rook part 5 (ss-49 done).',
      'sgFinds hollows kiHollows', 'M', '-', 'dungeons#hollows; side-content#ss-49'),
    s('actIII3', 'test: all six Stair Stone orders open every memory once',
      'Chapter fixtures for 6 orders; memories 4-12 each once; flights 3; crown lanterns 7.',
      'sgQuest mem1012 kiQuest', 'S', '-', 'systems#test-harness'),
    s('closeM35', 'chore: close M35: Act III stones documented',
      'DESIGN; progress.md hours.',
      'actIII3 sgHollows lampWalk', 'S', '-', 'charter#close-out'),
   ])

ms('Saltglass stories and the road to the sky',
   'Saltglass\'s three side stories, Act III reactions and a performance checkpoint before the sky.',
   '{PREV} closed.',
   'Sable\'s dig, the Roll Call nameplates, the Exam Retake quiz; villagers and Wenna react to the three stones.',
   '+2 h',
   [
    s('ss42', 'feat: side stories 42 Sable\'s Dig and 43 Roll Call',
      'Brush-don\'t-dig spots (Paws variant); nameplates of young Granny Wick and young Pelagia.',
      'sgQuest', 'M', '-', 'side-content#ss-42; side-content#ss-43'),
    s('ss44', 'feat: side story 44 The Exam Retake: a quiz built from gossip the player heard',
      'Questions drawn from `seen:` dialogue flags; always passable.',
      'sgQuest', 'M', '-', 'side-content#ss-44'),
    s('wennaIII', 'feat: Wenna and the villagers react to Act III',
      'Next 16 pedestal lines; memory lines once for Act III; Shellby quieter after memory 12.',
      'sgQuest catchersPlaza', 'S', '-', 'story#wenna-lines; story#act-III-reactions'),
    s('perf6', 'perf: checkpoint 6: ten realms and the precache; close Saltglass stories',
      'Soak and budgets across every shipped realm; core precache <= 30 MB, each bundle <= 2.5 MB; fix and record; briefs/batch-12.md (Saltglass cast, Scarabelle GLB, Academy, enemies).',
      'sgQuest', 'S', '-', 'charter#budgets'),
   ])

ms('The Starstair, Driftholm and the end of Act III',
   'Climb the restored Starstair to Driftholm, then the Spiral Stair, the chase and Cloudstep.',
   '{PREV} closed.',
   'Pip climbs the Cairn needle and three floating flights to Driftholm, sees Mote\'s shelter, scrap lamps and the Tally Wall, herds Nimbles, climbs the Spiral Stair on song platforms and chases Mote to the Spiral Arch; Cloudstep; "End of Act Three".',
   '+4.5 h',
   [
    s('dhRecipe', 'feat: Driftholm floating recipe: one isle, five islets and a cloud floor that bounces',
      'recipes/floating.js, 448 m, seed 40283; falling = "the clouds bounce Pip back" to the last ledge; painted archipelago ground card below; regions Mote\'s Meadow, The Falls, Nimble Downs, Arch Rise; prints.',
      'sgRecipe', 'M', '-', 'atlas-far#driftholm'),
    s('dhKit', 'feat: Driftholm props: the Spiral Arch, scrap lamps, the Tally Wall and the falls',
      'Spiral Arch 24 m (dungeon 10 portal), Mote\'s shelter, scrap lamps, Tally Wall decal sheet (generated), waterfalls into cloud; ART BRIEFs.',
      'dhRecipe lampkit', 'M', '-', 'atlas-far#driftholm'),
    s('starstair', 'feat: the Starstair: from the Cairn needle up three flights to Driftholm',
      'Hook and ivy route up the needle (home post-pass completes the inert ledge); the three flights become a climb portal to `driftholm`; scene at the top; flag `ch18`.',
      'stones hook gloves dhRecipe dhKit', 'M', '-', 'story#ch18; atlas-home#starstair'),
    s('dhArt', 'art: Driftholm look, loading card, map art and music',
      'Terrain layers, cloud floor card, loading card, map art; palette #c9b6ec #f7f2ff #9bb87a; track `driftholm` (airy harp).',
      'dhRecipe', 'M', '-', 'art-audio#driftholm'),
    s('dhLife', 'feat: Driftholm life: the Nimbles, Nimbus Puffs and Gust Kites',
      'Nimble NPCs (round cloud creatures), kiter and diver enemy species, cards, spawn tables (Mote\'s Meadow is a town: no enemies).',
      'dhKit arch1', 'M', '-', 'cast#the-nimbles; creatures#enemy-nimbus-puff; creatures#enemy-gust-kite'),
    s('dhFinds', 'feat: Driftholm finds and side stories 45 Mote\'s Tally and 46 Nimble Herding',
      'Post-pass per atlas counts (8 / 4 / 6 / 2 / 1 Hollow / benches); the Tally Wall notes; herding activity-quest; the Driftholm Dash course (10th and last).',
      'dhLife', 'M', '-', 'atlas-far#driftholm; side-content#ss-45; side-content#ss-46'),
    s('cloudstep', 'feat: Cloudstep: a second hop on cloud motes; a sky nook above the Cairn',
      'Ability `cloudstep`; cloud mote gate; home post-pass sky nook; in-page test.',
      'F20 dhRecipe', 'M', '-', 'systems#items-tools; atlas-home#sky-nook'),
    s('ss1', 'feat: the Spiral Stair rooms 1-5: Starsong notes make clouds solid',
      'dungeons/spiral_stair.js rooms 1-5; coloured cloud platforms solid 8 s per note; solver.',
      'starsong F23b dhKit', 'M', '-', 'dungeons#d10'),
    s('ss2', 'feat: the Spiral Stair rooms 6-10 and the chase course',
      'Rooms 6-10; Cloudstep chest; chase spline; solver.',
      'ss1 cloudstep', 'M', '-', 'dungeons#d10'),
    s('chase', 'feat: the chase: keep within 20 m of Mote for 90 s',
      'Chase encounter type (falling-light circles, cloak-trail stripes; a gap > 20 m for 5 s restarts the leg, never a fail screen); Mote never hit; balance test.',
      'ss2 mote', 'M', '-', 'creatures#boss-mote-chase'),
    s('ch18', 'feat: chapter 18 the Starstair: Mote pulls his Ladder up; End of Act Three',
      'Scene at the Spiral Arch; `act3done`; Act III card; crown lantern count 7; chapter test ch18.',
      'chase starstair actIII3', 'M', '-', 'story#ch18'),
    s('closeM38', 'chore: close M38: Act III release notes',
      'DESIGN Act III complete; README hours; progress.md.',
      'ch18', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- PHASE F: Act IV
ms('The Starmeadow',
   'The sky of the Starkin: cloud isles, constellation bridges, Old Mother Brightwell and the Twinklings.',
   '{PREV} closed.',
   'Pip walks the Starmeadow on constellation bridges, meets Old Mother Brightwell, learns given light and twist T6, and the Twinklings join him.',
   '+2 h',
   [
    s('smRecipe', 'feat: the Starmeadow islands recipe with Cloudstep-only constellation bridges (hidden)',
      'recipes/islands.js, 640 m, seed 40289: 12 cloud isles, bridge decks that exist only with `cloudstep`; regions The Lower Lanterns, Constellation Bridges, Brightwell\'s Rest, The Ladder Foot; prints.',
      'dhRecipe cloudstep', 'M', '-', 'atlas-far#starmeadow'),
    s('smKit', 'feat: Starmeadow props and look: star lanterns, bridges and the Ladder of Lights',
      'Kit (star lanterns, bridge glyphs), the Ladder 80 m into view; generated layers, loading card, map art; palette #141a3a #ffe9a8 #8fa8ff; track `starmeadow` (music box, choir hum).',
      'smRecipe', 'M', '-', 'atlas-far#starmeadow; art-audio#starmeadow'),
    s('starkin', 'feat: the Starkin: Old Mother Brightwell and the Twinklings',
      'Code-built Starkin (round soft faces, emissive), Brightwell huge and slow; three Twinklings that light rungs where Pip points (helper behaviour via F27); portraits; ART BRIEFs.',
      'smKit F27', 'M', '-', 'cast#old-mother-brightwell; cast#the-twinklings'),
    s('smEnemies', 'feat: Starmeadow enemies: Stardust Sprite, Comet Pup, Moonbeam Turret and Wisp Lantern',
      'Four species (archetypes per creatures.md), code-built models with ART BRIEFs, generated bestiary cards, region spawn tables; one in-page test per species (tell >= 0.55 s before damage, poof).',
      'arch2 smKit', 'M', '-', 'creatures#enemy-stardust-sprite; creatures#enemy-comet-pup; creatures#enemy-moonbeam-turret; creatures#enemy-wisp-lantern'),
    s('ch19', 'feat: chapter 19 the Starmeadow: given light and why she sneezed early (T6)',
      'Quest per story#ch19; finds post-pass (10 / 4 / 6 / 2 / benches); unhide; chapter test.',
      'starkin smEnemies', 'M', '-', 'story#ch19; atlas-far#starmeadow'),
    s('closeM39', 'chore: close M39: brief batch 13',
      'briefs/batch-13.md (Driftholm, Mote GLB, Starkin, Brightwell, Twinklings, sky enemies); progress.md.',
      'ch19', 'S', '-', 'charter#close-out'),
   ])

ms('The Ladder of Lights, the Crown and the Second Sneeze',
   'The last dungeon, Wenna\'s crown, and the finale built from the player\'s save.',
   '{PREV} closed.',
   'Pip climbs down Mote\'s Ladder freeing each borrowed light, reaches Wenna\'s crown, guides Stray Lights home, catches the last spark on a glide, and everyone he helped brings a lantern; Mote climbs home. "End of Act Four"; epilogue free roam.',
   '+5.5 h',
   [
    s('lad1', 'feat: the Ladder of Lights floors 1-6: one floor per borrowed beacon',
      'dungeons/ladder.js floors for Duskwick, Pinewhistle, Archwater, Threemills (each uses that isle\'s tool); freed lights stream home on the horizon; solver.',
      'ch19 F23b', 'M', '-', 'dungeons#d11; story#ch20'),
    s('lad2', 'feat: the Ladder of Lights floors 7-11: the little lights Mote gathered',
      'Mixed-tool floors; solver.',
      'lad1', 'M', '-', 'dungeons#d11'),
    s('lad3', 'feat: the Ladder of Lights floors 12-16: every tool together, down into the Crown',
      'Final floors; portal into `crown`; solver.',
      'lad2', 'M', '-', 'dungeons#d11'),
    s('crown', 'feat: the Crown: Wenna\'s canopy as walkable boughs',
      '128 m interior-scale realm with bough decks, four bough lanterns, blossom; ending theme.',
      'lad3', 'M', '-', 'atlas-far#crown'),
    s('fin1', 'feat: the Second Sneeze part 1: Stray Lights steered into bough lanterns',
      'Sunglass steering of falling lights on telegraphed circles across four boughs, 6 each; bar "Lanterns lit".',
      'crown sunglass', 'M', '-', 'story#ch21; creatures#finale'),
    s('fin2', 'feat: the Second Sneeze part 2: the Catchers catch, Pip catches the last spark',
      '2 s wind-up, three-way cut-in, 12 s glide through blossom rings that loops on a miss and cannot fail.',
      'fin1 glider', 'M', '-', 'story#ch21; creatures#finale'),
    s('fin3', 'feat: the Second Sneeze part 3: given light, a lantern from everyone Pip helped',
      '`[E] Give · Lantern`; the lantern chain list built from the save (quests done, NPCs met); Mote\'s goodbye; Firstlight to Granny Wick first; crown lantern 8; main ending card; epilogue state; plushies Mote, Wenna, Nell, a duck; chapter tests ch20-21.',
      'fin2 calm', 'M', '-', 'story#ch21; story#lantern-chain'),
    s('perf7', 'perf: checkpoint 7: the finale\'s lights and lantern chain; the main ending ships',
      'Worst-case lantern count from a 100 % fixture; draw calls/tris; fix and record; DESIGN main ending; README play summary; progress.md hours (main story 46.5 h target).',
      'fin3', 'S', '-', 'charter#budgets'),
   ])

# ---------------------------------------------------------------- PHASE G: post-game
ms('The Hundred-Year Night and Guardian Dreams',
   'Chapter 22 (the true ending), its gifts, and ten opt-in Guardian Dreams.',
   '{PREV} closed.',
   'With 8 bottles and 50 acorns after the main ending, Shellby asks Pip to sit at dusk, the Starkin come down, Shellby reveals the bottle, and Pip throws the 13th letter from the lighthouse; The Little Star and The Planting follow; `[E] Dream · <Name>` opens ten pastel dream rematches.',
   '+4.5 h',
   [
    s('night', 'feat: the Hundred-Year Night variant realm: lanterns everywhere and everyone placed',
      'Variant of home (festival props, falling-light rain, waltz track), every Catcher and Warden placed in the plaza, Mote brighter; revisitable from Shellby\'s bench.',
      'variant fin3', 'M', '-', 'atlas-home#hundred-year-night'),
    s('ch22', 'feat: chapter 22: Shellby\'s letter, the hanky, and Wenna\'s word to Pip',
      'Threshold `bottles>=8 & acorns>=50 & mainEnding`; scene per story#ch22; Shellby\'s hanky item; flags.',
      'night', 'M', '-', 'story#ch22; lore#pip'),
    s('letter', 'feat: Pip writes the 13th letter and throws it from the lighthouse',
      'Pick 3 phrases from a list built from the save (UI in pad, keyboard, touch); climb with Pinch; card "To whoever finds this"; Lore entry; chapter test ch22.',
      'ch22', 'M', '-', 'story#ch22; lore#bottles'),
    s('ss48', 'feat: side stories 48 The Little Star, 53 The Planting and the end of 14 The Fourth Bough',
      'The shy fourth Twinkling; Wenna\'s new seed planted at one of four home spots (post-pass by choice flag; no wrong answer); the Meadow bough blossoms (ss-14 ends) and Wenna\'s last 16 lines.',
      'fin3', 'M', '-', 'side-content#ss-48; side-content#ss-53'),
    s('dreams', 'feat: the Dream framework: pastel 96 m arenas with one twist each',
      'Dream realm kind (dungeon recipe arena), `Dream` verb at napping bosses after the main ending, twist hooks in the boss def, collect.dream, rewards; Grumble Shroom dream (rings roll in reverse).',
      'calm fin3', 'M', '-', 'creatures#dreams'),
    s('dreams2', 'feat: Dreams of Captain Pinch, Frostbun and Sir Rollo',
      'Tilting deck; ice floor slide; two Rollos.',
      'dreams', 'M', '-', 'creatures#dreams'),
    s('dreams3', 'feat: Dreams of Mossmantle, Old Gloop and Lady Honksworth',
      'Half speed except Pip; eight arms one tell each; goslings copy late.',
      'dreams2', 'M', '-', 'creatures#dreams'),
    s('dreams4', 'feat: Dreams of the Wickwork Moth, Lumbra and Lady Fumarole; side story 51 Dream a Little',
      'Mirrored beams; moving holes; rising bath water; tracker row and ss-51.',
      'dreams3', 'M', '-', 'creatures#dreams; side-content#ss-51'),
    s('closeM42', 'chore: close M42: Dreams documented',
      'DESIGN post-game; progress.md.',
      'dreams4', 'S', '-', 'charter#close-out'),
   ])

ms('The Hundred Lamps, Hoot\'s Margins and the last gem sinks',
   'The last optional dungeon, Hoot\'s notebook realm, Nook furnishings, hood trims, the remaining shop stock and plushies, so the economy closes.',
   '{PREV} closed; owner decision 6 (hood trims) answered after the side-by-side.',
   'Pip descends ten remixed floors to the Three Corners Jamboree, helps Hoot finally be right inside his notebook, furnishes his Nook, picks a hood trim and fills the plushie shelf (16).',
   '+4 h',
   [
    s('lamps1', 'feat: the Hundred Lamps floors 1-5: harder remixes of every mechanic',
      'Optional dungeon o4 under Duskwick; floors 1-5; solver.',
      'fin3 F23b', 'M', '-', 'dungeons#o4'),
    s('lamps2', 'feat: the Hundred Lamps floors 6-9',
      'Floors 6-9; last heart petal; solver.',
      'lamps1', 'M', '-', 'dungeons#o4'),
    s('jamboree', 'feat: the Three Corners Jamboree and side story 50',
      'Floor 10: the three Catchers in a row on one set of hearts; hood trim reward; ss-50.',
      'lamps2 F19', 'M', '-', 'creatures#boss-jamboree; side-content#ss-50'),
    s('margins', 'feat: Hoot\'s Margins: a pencil-and-paper variant of Pinewhistle',
      'Variant of pinewhistle (paper ground, ink-line trees, pencil percussion), entered from Hoot\'s study after the main ending; prints equal Pinewhistle.',
      'variant pwQuest', 'M', '-', 'atlas-isles#hoots-margins'),
    s('ss52', 'feat: ink-trace puzzles and side story 52 Hoot\'s Last Paper',
      'Trace a dotted bridge with the sword to make it walkable; Hoot\'s final paper, finally right.',
      'margins', 'M', '-', 'side-content#ss-52'),
    s('furnish', 'feat: 24 Nook furnishings from Miso and Kinako',
      'Furniture items (80 gems each) placed at fixed Nook spots; generated painted textures; economy test.',
      'nook econ', 'M', '-', 'side-content#nook; systems#economy'),
    s('trims', 'feat: hood trims tint the hood in third person (after a side-by-side)',
      '6 trims x 80 gems; material tint only on the hood mesh of hero.glb (GLB untouched); side-by-side screenshots in the PR for owner decision 6.',
      'furnish', 'M', '-', 'systems#economy; art-audio#hood-trims'),
    s('stock', 'feat: the last shop stock: Swift Fluff, Sling quick-draw, potion belts 4-5 and the Hundred-Year Hanky',
      'Kinako upgrades, potion belt sizes (CFG.potionMax by item), Miso\'s 1,000-gem joke item; economy test at the full table.',
      'kinako econ', 'M', '-', 'systems#economy'),
    s('plushies', 'feat: all 16 plushies on the Nook shelf',
      'Remaining plushies (Nell, a duck, Mote, Wenna) and the shelf display; tracker row.',
      'calm furnish', 'S', '-', 'side-content#plushies'),
    s('closeM44', 'chore: close M44: economy closes',
      'Economy ledger final (sources >= 105 % of sinks); DESIGN economy and post-game; briefs/batch-14.md (Hundred Lamps, Jamboree, Margins ink style, Dream palettes, Night festival props, Nook furniture); progress.md.',
      'trims stock plushies jamboree ss52', 'S', '-', 'charter#close-out'),
   ])

ms('Release polish: art refresh, final budgets and the 100 % audit',
   'Phase P14 leftovers and a final proof that the game holds together at 100 %.',
   '{PREV} closed.',
   'New key art with the steel sword, loading cards for every land, a final performance and precache audit, and a 100 % chapter chain that runs New Game to the true ending.',
   '0 h (quality)',
   [
    s('keyart', 'art: key art and title painting refreshed with the steel sword',
      'Generate a new title painting and ending painting (Pip\'s look unchanged, steel sword); old files kept as fallback; manifest swap; side-by-side in the PR.',
      'fin3', 'M', '-', 'art-audio#key-art'),
    s('cards', 'art: loading cards and tips for every land',
      'One painted loading card per realm missing one, tips per realm (text tables).',
      'keyart', 'M', '-', 'art-audio#loading-cards'),
    s('perf8', 'perf: checkpoint 8: final budgets in every realm and the precache',
      'Every realm\'s 4 views in both cameras; core precache <= 30 MB; bundles; save size at 100 %; fix and record.',
      'cards', 'M', '-', 'charter#budgets'),
    s('chain100', 'test: the chapter chain proves New Game to the true ending at 100 %',
      'Unit chain check across every chapter fixture; tracker reaches 100 % on the final fixture; Completion rows match js/realms/stats.js.',
      'perf8 letter dreams4 ss52', 'M', '-', 'systems#test-harness; systems#completion'),
    s('closeM45', 'chore: close M45: DESIGN and ARCHITECTURE describe the finished game',
      'Final docs pass; hours per bucket vs CANON section 11; progress.md final.',
      'chain100', 'S', '-', 'charter#close-out'),
   ])

# ---------------------------------------------------------------- render
keys = {}
n = 0
for mi, m in enumerate(M):
    m['id'] = f'M{mi+1:02d}'
    for st in m['steps']:
        if st['fixed']:
            st['id'] = st['fixed']
        else:
            n += 1
            st['id'] = f'S-{n:03d}' + st['suffix']
        if st['key'] in keys:
            raise SystemExit('dup key ' + st['key'])
        keys[st['key']] = st['id']
pos = {}
for m in M:
    for st in m['steps']:
        pos[st['key']] = len(pos)
for m in M:
    for st in m['steps']:
        for d in st['deps']:
            if d not in keys:
                raise SystemExit(f"{st['key']}: unknown dep {d}")
            if pos[d] >= pos[st['key']]:
                raise SystemExit(f"{st['key']} ({st['id']}): dep {d} ({keys[d]}) is not listed earlier")

import re as _re
bn = 0
for mi, m in enumerate(M):
    m['entry'] = m['entry'].replace('{PREV}', M[mi-1]['id'] if mi else 'nothing')
    for st in m['steps']:
        st['title'] = _re.sub(r'close M\d\d', 'close ' + m['id'], st['title'])
        st['scope'] = _re.sub(r'close M\d\d', 'close ' + m['id'], st['scope'])
        if _re.search(r'batch-\d\d', st['scope']):
            bn += 1
            st['scope'] = _re.sub(r'batch-\d\d[a-z]?', f'batch-{bn:02d}', st['scope'])
            st['title'] = _re.sub(r'batch \d\d', f'batch {bn:02d}', st['title'])
# ---------------------------------------------------------------- issue rows from the step files (review 2026-11-22)
# The index lists one row per issue. Ids, titles, dependencies, sizes and saves come from the step files' own
# `### S-xxx · <title>` headings and the `Milestone Mxx · Depends on: ... · Size: ... · Save: ...` line under each,
# so the index can never drift from the specs. Milestone texts, scope and bible refs come from the rows above.
# Steps dir: docs/roadmap/steps (repo: this file is docs/roadmap/tools/) or ../docs-roadmap/steps (research canon/).
import os as _os, glob as _glob
_HERE = _os.path.dirname(_os.path.abspath(__file__))
STEPS_DIR = next((d for d in (_os.path.join(_HERE, '..', 'steps'), _os.path.join(_HERE, '..', 'docs-roadmap', 'steps'))
                  if _os.path.isdir(d)), None)

def _parse_steps(d):
    secs = []
    for f in sorted(_glob.glob(_os.path.join(d, 'M*.md'))):
        lines = open(f, encoding='utf-8').read().split('\n')
        i = 0
        while i < len(lines):
            mm = _re.match(r'^### (S-\d{3}[a-z]?) · (.*)$', lines[i])
            if not mm:
                i += 1; continue
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            hdr = []
            while j < len(lines) and lines[j].strip() and not lines[j].startswith('#'):
                hdr.append(lines[j].strip()); j += 1
            h = ' '.join(hdr)
            ms_ = _re.search(r'Milestone (M\d\d)', h)
            dm = _re.search(r'Depends on:\s*(.*?)\s*·\s*Size:', h)
            sz = _re.search(r'Size:\s*([SML])\b', h)
            sv = _re.search(r'Save:\s*(.*?)\s*·', h)
            save = sv.group(1).strip() if sv else 'none'
            secs.append(dict(id=mm.group(1), title=mm.group(2).strip(), file=_os.path.basename(f), line=i + 1,
                             ms=ms_.group(1) if ms_ else None,
                             deps=_re.findall(r'S-\d{3}[a-z]?', dm.group(1)) if dm else None,
                             size=sz.group(1) if sz else None,
                             save='-' if save.lower().startswith('none') else save.replace('→', '->')))
            i = j
    return secs

def _expand():
    """Returns (issues, problems). issues: list of dicts in index order, each with the src row it belongs to."""
    problems, notes = [], []
    if not STEPS_DIR:
        return None, ['no steps directory found next to the index source'], notes
    secs = _parse_steps(STEPS_DIR)
    by_id = {}
    for s_ in secs:
        if s_['id'] in by_id:
            problems.append(f"duplicate step id {s_['id']} ({by_id[s_['id']]['file']} and {s_['file']})")
        by_id[s_['id']] = s_
        if not s_['ms'] or s_['deps'] is None or not s_['size']:
            problems.append(f"{s_['id']} ({s_['file']}:{s_['line']}): header line lacks Milestone / Depends on / Size")
    src = {}
    for m in M:
        for st in m['steps']:
            src[st['id']] = (m, st)
    base = lambda i: i[:5]
    claimed, rows_of = {}, {}
    for sid, (m, st) in src.items():
        own = [s_ for s_ in secs if s_['id'] == sid]
        parts = [s_ for s_ in secs if s_['id'] != sid and base(s_['id']) == sid and s_['id'] not in src]
        rows = own + parts
        if not rows:
            problems.append(f"{sid} ({st['key']}): no '### {sid} · ' section in the step files")
        for s_ in rows:
            claimed[s_['id']] = sid
        rows_of[sid] = rows
    for s_ in secs:
        if s_['id'] not in claimed:
            problems.append(f"{s_['id']} ({s_['file']}:{s_['line']}): no index row for its base id {base(s_['id'])}")
    def last_part(d):
        if d in by_id:
            return d
        rs = rows_of.get(d) or []
        if not rs:  # an id that became lettered source rows (S-158 -> S-158a, S-158b): its last lettered row
            sib = [i for i in src if base(i) == d]
            rs = [r for i in sib for r in rows_of.get(i, [])]
        return rs[-1]['id'] if rs else None
    issues = []
    mids = [m['id'] for m in M]
    for m in M:
        for st in m['steps']:
            rows = rows_of.get(st['id']) or []
            split = rows and rows[0]['id'] != st['id']
            for k, s_ in enumerate(rows):
                if s_['id'] == st['id']:
                    scope = st['scope']
                elif split:
                    scope = (f"Part {s_['id'][5:]} of {st['id']} (spec in steps/{s_['file']}). " + (f"The row's whole scope: {st['scope']}" if k == 0 else ''))
                else:
                    scope = f"Added beside {st['id']} in review (spec in steps/{s_['file']})."
                deps = []
                for d in (s_['deps'] or []):
                    r = last_part(d)
                    if not r:
                        problems.append(f"{s_['id']}: dependency {d} names no step")
                    elif r != s_['id'] and r not in deps:
                        deps.append(r)
                msx = s_['ms'] or m['id']
                if msx != m['id']:
                    notes.append(f"{s_['id']}: header says {msx}, index row {st['id']} is in {m['id']} (listed under {msx})")
                if msx not in mids:
                    problems.append(f"{s_['id']}: unknown milestone {msx}")
                    msx = m['id']
                if s_['title'] != st['title'] and s_['id'] == st['id']:
                    notes.append(f"{s_['id']}: title differs from the source row (the step file's title is used)")
                issues.append(dict(id=s_['id'], title=s_['title'], scope=scope, deps=deps, size=s_['size'] or st['size'],
                                   save=s_['save'] if s_['save'] else st['save'], refs=st['refs'], ms=msx, row=st['id'],
                                   key=st['key'], file=s_['file'], order=(mids.index(msx), secs.index(s_))))
    issues.sort(key=lambda r: r['order'])
    # cycle check
    g = {r['id']: r['deps'] for r in issues}
    state = {}
    def visit(u, stack):
        if state.get(u) == 1:
            problems.append('dependency cycle: ' + ' -> '.join(stack + [u])); return
        if state.get(u) == 2: return
        state[u] = 1
        for v in g.get(u, []): visit(v, stack + [u])
        state[u] = 2
    for u in g: visit(u, [])
    return issues, problems, notes

ISSUES, PROBLEMS, NOTES = _expand()
if ISSUES:
    for m in M:
        m['issues'] = [r for r in ISSUES if r['ms'] == m['id']]
    KEY_ISSUES = {}
    for r in ISSUES:
        KEY_ISSUES.setdefault(r['key'], []).append(r['id'])
else:
    for m in M:
        m['issues'] = [dict(id=st['id'], title=st['title'], scope=st['scope'], deps=[keys[d] for d in st['deps']],
                            size=st['size'], save=st['save'], refs=st['refs'], ms=m['id'], row=st['id'], key=st['key'])
                       for st in m['steps']]
    KEY_ISSUES = {k: [v] for k, v in keys.items()}
N_ROWS = sum(len(m['steps']) for m in M)
N_ISSUES = sum(len(m['issues']) for m in M)
N_MERGES = -(-N_ISSUES // 8)
cmd = sys.argv[1] if len(sys.argv) > 1 else ''
if cmd == 'check':
    for p in PROBLEMS: print('ERROR', p)
    if '-v' in sys.argv:
        for p in NOTES: print('note ', p)
    print(f'{N_ROWS} index rows, {N_ISSUES} issues, {len(PROBLEMS)} problems, {len(NOTES)} notes (-v lists them)')
    raise SystemExit(1 if PROBLEMS else 0)
if PROBLEMS and cmd in ('body', 'overview', 'head', 'json', 'issues'):
    print(f'WARNING: {len(PROBLEMS)} problems between the step files and the index source; '
          'run: python3 step-index-src.py check', file=sys.stderr)
if cmd == 'issues':
    print(json.dumps(KEY_ISSUES))
    raise SystemExit
if cmd == 'head':
    dung = sys.argv[2] if len(sys.argv) > 2 else '?'
    t = open(_os.path.join(_HERE, 'step-index-head.md'), encoding='utf-8').read()
    t = (t.replace('{{ROWS}}', str(N_ROWS)).replace('{{ISSUES}}', str(N_ISSUES)).replace('{{MERGES}}', str(N_MERGES))
          .replace('{{SPLITS}}', str(N_ISSUES - N_ROWS)).replace('{{DUNGEON_ISSUES}}', dung))
    sys.stdout.write(t)
    raise SystemExit

if len(sys.argv) > 1 and sys.argv[1] == 'keys':
    print(json.dumps(keys))
    raise SystemExit
if len(sys.argv) > 1 and sys.argv[1] == 'json':
    out = dict(totalSteps=n, rows=N_ROWS, issues=N_ISSUES, merges=N_MERGES,
               milestones=[dict(id=m['id'], title=m['title'], goal=m['goal'],
               firstStep=m['issues'][0]['id'], lastStep=m['issues'][-1]['id'], steps=len(m['issues'])) for m in M])
    print(json.dumps(out, indent=1))
    raise SystemExit
if len(sys.argv) > 1 and sys.argv[1] == 'body':
    for m in M:
        print(f"## {m['id']} · {m['title']}\n")
        print(f"**Goal.** {m['goal']}\n")
        print(f"**Entry.** {m['entry']}\n")
        print(f"**Exit (what the player can do).** {m['exit']}\n")
        print(f"**Play added.** {m['hours']} · **Issues** {m['issues'][0]['id']} - {m['issues'][-1]['id']} ({len(m['issues'])}, in filing order)\n")
        print('| id | title | scope | depends on | size | save | bible refs |')
        print('|---|---|---|---|---|---|---|')
        for st in m['issues']:
            deps = ', '.join(st['deps']) or '-'
            cell = lambda x: x.replace('|', '\\|')
            print(f"| {st['id']} | {cell(st['title'])} | {cell(st['scope'])} | {deps} | {st['size']} | {st['save']} | {cell(st['refs'])} |")
        print()
    raise SystemExit
if len(sys.argv) > 1 and sys.argv[1] == 'overview':
    cum = 3.0
    print('| Milestone | Title | Issues | Count | Play added | Cumulative play (h) |')
    print('|---|---|---|---|---|---|')
    for m in M:
        mm = _re.match(r'\+([0-9.]+) h', m['hours'])
        cum += float(mm.group(1)) if mm else 0
        print(f"| [{m['id']}](#{m['id'].lower()}) | {m['title']} | {m['issues'][0]['id']} - {m['issues'][-1]['id']} | {len(m['issues'])} | {m['hours']} | {cum:.1f} |")
    raise SystemExit
if len(sys.argv) > 1 and sys.argv[1] == 'anchors':
    from collections import defaultdict
    A = defaultdict(lambda: defaultdict(list))
    for m in M:
        for st in m['issues']:
            for part in st['refs'].split(';'):
                part = part.strip()
                mm = _re.match(r'([a-z0-9-]+)#([A-Za-z0-9._-]+)$', part)
                if mm: A[mm.group(1)][mm.group(2)].append(st['id'])
    for f in sorted(A):
        items = ', '.join(f"`{a}` ({A[f][a][0]}{'+' if len(A[f][a])>1 else ''})" for a in sorted(A[f], key=lambda a: A[f][a][0]))
        print(f"- **{f}.md**: {items}")
    raise SystemExit
print(n)
