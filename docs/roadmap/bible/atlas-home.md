# Atlas: Starseed Isle and its variants

The home island, everything added to it after `main` at `b79d73d`, its rooms, and the three realms that reuse its
ground. Implementation agents build from this file. Authority: `CANON-NOW.md` LOCKED items > `CANON.md` > this
bible > `INDEX.md` > a step issue. Dungeons under home (Under the Roots, the Snowglobe, Grumble's Undercap, the two
fairy-ring Hollows' rooms) live in [dungeons.md](./dungeons.md); this file only places their doors. Character looks
live in [cast.md](./cast.md), lore texts in [lore.md](./lore.md), beats in [story.md](./story.md), side-story steps in
[side-content.md](./side-content.md), numbers for tools and gates in [systems.md](./systems.md), style and prompt
preamble in [art-audio.md](./art-audio.md#style).

## Conventions

- **Coordinates.** World metres, seed 7151. `x` east, `z` south, so **north is −z**. `Y` is world height; `h` is
  terrain height at a point (`W.hAt`). Positions copied from the generator are rounded to 0.1 m.
- **Bearings.** A compass bearing `θ` (degrees, 0 = north, clockwise) converts to the sky code's azimuth as
  `az = π − θ·π/180` (the sky places a sprite at `(sin az · R, y, cos az · R)`). Example: north-east 48° → `az` 2.30,
  the shipped sky isle.
- **Ids.** Every new home thing has a stable id `home:<id>` used in saves (`S.flags`, `S.collect`, per-id maps). Ids
  never change once shipped. Lists inside a pass are **append-only**: a later step adds entries at the end and never
  reorders, so earlier RNG draws are unchanged.
- **Flags** named here are `S.flags` keys (save v7+). Story flags (`wennaAwake`, `lanternGot`, `ch8`, `moteNamed`,
  `act2done`, `ch13`, `act3done`, `mainEnding`, `ch22`) are defined in [story.md](./story.md); this file only reads
  them. Find flags are `find:home:<id>`.
- **Prompts** use the shipped pill `[E] Verb · Name` and only the CANON verb list (Talk, Shop, Read, Knock, Open,
  Peek, Pick up, Wake, Look, Place, Use, Enter, Sail, Sit, Ring, Dig, Hook, Climb, Touch, Kindle, Give, Dream, Fish,
  Sketch, Unlock).
- **ART BRIEF blocks** follow [art-audio.md#brief-template](./art-audio.md#brief-template). "Prompt" lines start
  after the style preamble in [art-audio.md#style](./art-audio.md#style) (prepend it verbatim). Every brief names
  its code-built fallback; the fallback ships first, the painted GLB or image drops in through `assets/manifest.js`
  with no code change. Pip's GLB is never touched.

### The frozen home island (reference, LOCKED)

| Thing | Where (x, z) | Notes |
|---|---|---|
| Plaza | centre (0, 0), r 16, `h` 2.3 | Sprout Village; no enemy ever |
| The Great Tree | (0, −1.5), base Y 2.3, 19.8 m | face toward +z (south, the pedestal) |
| Pedestal | (0, 7.3) | three star sockets |
| Spawn / wake point | (0, 13) | |
| Signpost | (4, 17.5) | |
| Miso's Shop | (15, 14); door sign (14.1, 11.2) | |
| Well (Puddle) | (9, −7.5) | |
| Cottages 1-5 | house (−16, −14) door (−14.1, −12.3) · (15, −16) door (13.3, −14.1) · (−18, 13) door (−15.9, 11.5) · (24, −6) door (21.5, −5.4) · (−25, −3) door (−22.5, −2.7) | residents: Dormy, Nell, Hazel, Granny Mochi, the Thistledowns |
| Village pond | (−13, 25), r 4.2 | becomes the duck pond |
| Grumble's Crown | (10, −131), base Y 2.0, 21 m | arena (−3.2, −114) r 14; sign (0.7, −89.5) |
| Summit Crystal Cairn | (100, −48), base Y 23.3, 15 m, on an unclimbable needle | arena (114, −19) r 14 |
| Pinch's Lighthouse | (8.5, 117), base Y 0.8, 18 m; gallery deck Y ≈ 13.9 | arena (26, 142) r 14 |
| Meadow Windmill | (−108.1, −6.6), base Y 3.8, 15 m | Digby (−103.1, −3.3) |
| Fairy-ring clearings | (−36.1, −44.8) r 6.7 · (23.6, −106.9) r 7.4 · (−16.9, −86.7) r 7.9 | each a stump in a ring of glowing mushrooms |
| Hidden glade | (−36.7, −71.9) | heart chest `hc_woods` |
| Islets | islet 1 (−40, 139) r 8.5 · islet 2 (−60, 151) r 7 | bridges from the Shores |
| River | source pond (37, −78) → mouth (150, 140) | Peaks bridge (36.9, 6.8)–(54.7, 2.2) |
| Ponds | (37, −78) r 5.5 · (−70.6, 21.8) r 7.5 · (−94.1, −29.2) r 5.5 · (−48.9, −37.4) r 4.5 | |

Terrain notes measured on seed 7151 (probe in `ground/probe-home/`): the Woods and Meadow are low (Y 2-4); the Peaks
plateau east of the river is Y 11-18 and its north-west quarter around the Cairn is steep rock nobody can walk; the
Cairn's flat top is about 4 × 4 m at Y 23; walkable Peaks ground reaches Y 10 at about (77, −43); the Shores are Y 0-2
with walkable shallows to about z 132 south of the lighthouse; every land cell is reachable today (`W.unreachable`
empty).

---

<a id="passes"></a>
## 1. Post-passes and the RNG table

### 1.1 Rules every home pass obeys

1. **Own stream.** Each pass draws only from `new RNG(7151 * k + c)` with its own `(k, c)` from the table below.
   A pass that needs no randomness (pure scan, like `placeSecrets`) still reserves a row.
2. **Runs after everything.** Passes run at the end of `World.generate()` after `placeSecrets`, in the table's order,
   each guarded by `o.<passName> !== false` so a test can build the world without it.
3. **Touches nothing it does not own.** A pass adds nothing to `props`, `deco`, `colliders`, `reserved`,
   `interact`, `chests`, `npcSpots`, `bridges` or any other generator list. It writes only its own list
   (`W.reasons`, `W.thorns`, ...) and puts `W.walk / W.reach` back. Reachability comes from the shared
   `postReach()` (S-016) computed once from the generator's colliders.
4. **Clear of everything earlier.** Its `ok(x, z)` rejects spots within the listed margins of every earlier pass's
   items (and of chests, interactables, NPC spots, shells, parade lanterns, keepsakes), never the other way round, so
   adding a pass can never move an earlier one.
5. **Nearest valid to a named anchor.** Placement = 160 random tries in the anchor's ring, then a 0.5 m scan of the
   ring nearest the centre (the `placeShells` fallback), then the ring doubled. Positions are stored rounded to
   0.001 m, exactly as tested.
6. **Never reads the save.** Placement is a pure function of the seed. What the player sees is decided at runtime
   from `S.flags` (a hidden item still has its position).
7. **Post-solids and post-decks.** Items that must block Pip or carry him declare `solid: { r }` or
   `solid: { hx, hz, h, rot }` and `deck: { ax, az, bx, bz, w, h0, h1 }` in their own record. `js/world-post.js`
   `attachPost(W)` (added by S-004, the first pass with a solid) appends them to `W.colliders` and `W.bridges`
   **after** `generateWorld` returns, rehashes once, and keeps `c.active` for gates that open. The prints test and
   every "changes nothing else" test run on the world before `attachPost`. A pass's own reachability proof uses a
   walk grid with every earlier pass's solids stamped in.
8. **Portals** are records on a pass item (`portal: { id, to: { realm, spawn }, how: 'use'|'walk', needs }`).
   `W.portals` is assembled at the end of `generate()` from every pass in table order (S-026).
9. **Tests per pass** (in `tests/world.test.js`, seeds 1-40, the SLOW group): (a) `generateWorld(seed)` and
   `generateWorld(seed, { <pass>: false })` have equal `placementPrint`, `fingerprint`, `walk`, `reach` and
   `unreachable`; (b) the pass's list has the documented ids in order; (c) every item obeys its `ok()`; (d) items
   meant to be walked to are reachable in the post-solid walk grid; items meant to be **unreachable on foot**
   (decks for the Glider, Hook, Gloves or Cloudstep) are proven unreachable on foot and reachable with their tool by
   the progression solver's tool model (S-048: glide covers `3 × drop − 1` m horizontally; hook 14 m line with
   line of sight; ivy any height on a lattice face; Cloudstep one extra 0.85 m hop off a mote within 4 m).
9a. **The shared world cache** (S-004 creates `tests/lib/world-cache.js`, S-016 extends it). Rule 9 per pass on seeds
   1-40 would cost about 20 s per pass (80 generations) and push `bun test` past 10 minutes once the table is full.
   So: `worldAll(seed)` and `worldNone(seed)` (`generateWorld(seed, { postPasses: false })`) are generated once per
   seed per test process; one test proves (a) for **all passes at once** on seeds 1-40 (equal `placementPrint`,
   `fingerprint`, `walk`, `reach`, `unreachable`), and one test checks each pass's list on seeds 1-40 against
   `tests/fixtures/postpass-prints.json` (a pass adds its key when it lands; earlier keys never change). (b)-(d) run
   on `worldAll(seed)`. The **per-pass** with/without comparison (`{ <pass>: false }`) runs only on seeds 7151, 1, 2,
   3 and 42. Wherever a step says "seeds 1-40 with and without the pass" or "the four home-pass tests on seeds 1-40",
   it means this form. `tests/world.test.js` stays under 60 s.
10. **Prints.** `tests/fixtures/world-prints.json` stays byte-identical in every step.

### 1.2 The table (every stream on the home island)

`k` and `c` were checked: no two streams collide for any seed from 1 to 200 except the generator's own pair at seed 1
(landmarks and path dressing, shipped). A new pass takes the next free row; append, never renumber.

| # | Stream / pass | `new RNG(7151 * k + c)` | Step | Writes | Visible when |
|---|---|---|---|---|---|
| g1 | World main (`this.rng`) | 7, 3 | shipped | terrain, layout | always |
| g2 | landmarks | 13, 5 | shipped | `landmarks` | always |
| g3 | woods gaps (clearings, trails) | 17, 3 | shipped | `woodsGaps` | always |
| g4 | coins (gem chests) | 31, 17 | shipped | `chests` coin_* | always |
| g5 | path dressing (waymarkers) | 7, 11 | shipped | `waymarkers`, `edgeStones` | always |
| g6 | `placeShells` | 41, 29 | shipped | `shells` | errand |
| g7 | `placeLanterns` | 53, 7 | shipped | `lanterns` | errand |
| g8 | `placeSecrets` | none (scan) | shipped | `secrets` | always |
| 1 | `placeReasons` | 67, 13 | S-004 | `reasons` | Act I ([#placeReasons](#placeReasons)) |
| 2 | `placeThorns` | 71, 17 | S-013 | `thorns` | always ([#placeThorns](#placeThorns)) |
| 3 | `placePortals` | 61, 11 | S-026 | `portalAnchors` | per flag ([#placePortals](#placePortals)) |
| 4 | `placeRootDoor` | 73, 19 | S-056 | `rootDoor` | `wennaAwake` ([#pips-nook](#pips-nook)) |
| 5 | `placeJetty` | 79, 23 | S-068 | `jetty` | `wennaAwake` ([#placeJetty](#placeJetty)) |
| 6 | `placeSpots` | 83, 29 | S-068 | `spots` (new NPC outdoor spots) | per NPC ([#spots](#spots)) |
| 7 | `placeHollowDoors` | 89, 31 | S-073 | `hollowDoors` | Lantern ([#hollows](#hollows)) |
| 8 | `placeVistas` | 97, 37 | S-076 | `vistas`, `hootsBoard` | always ([#vistas](#vistas)) |
| 9 | `placeBenches` | 101, 41 | S-082 | `benches` | always ([#benches](#benches)) |
| 10 | `placeGlideFinds` | 103, 43 | S-102 | `glideFinds` | Glider ([#glide-finds](#glide-finds)) |
| 11 | `placeCourses` | 107, 47 | S-112 (+S-136, S-158) | `courses` | per activity ([#courses](#courses)) |
| 12 | `placeGrove` | 109, 53 | S-114 (+S-193) | `grove` | ss-01 flags ([#grove](#grove)) |
| 13 | `placeTideFinds` | 113, 59 | S-122 | `tideFinds` | Tide Bell ([#tide-finds](#tide-finds)) |
| 14 | `placeHookFinds` | 127, 61 | S-143 | `hookFinds` | Hook ([#hook-finds](#hook-finds)) |
| 15 | `placeVillageWorks` | 131, 67 | S-157 | `works` | per project ([#village-works](#village-works)) |
| 16 | `placeAcorns` | 137, 71 | S-161 (+S-268) | `acorns` | always ([#acorns](#acorns)) |
| 17 | `placeOldBeacons` | 139, 73 | S-169 | `oldBeacons` | always ([#old-beacons](#old-beacons)) |
| 18 | `placeDigSpots` | 149, 79 | S-181 | `digSpots` | always (mound) ([#dig-spots](#dig-spots)) |
| 19 | `placeFishSpots` | 151, 83 | S-207 | `fishSpots` | always ([#fish-spots](#fish-spots)) |
| 20 | `placeStarDoors` | 157, 89 | S-208 | `starDoors` | always ([#star-doors](#star-doors)) |
| 21 | `placeBellTargets` | 163, 97 | S-227 | `bellTargets`, `bellHollow`, `snowglobeWall` | always ([#bell-targets](#bell-targets)) |
| 22 | `placeThornglass` | 167, 101 | S-233 | `thornglass` | always ([#thornglass](#thornglass)) |
| 23 | `placeIvyFinds` | 173, 103 | S-248 | `ivyFinds` | always ([#ivy-finds](#ivy-finds)) |
| 24 | `placeStarstair` | 179, 107 | S-264 | `starstair` | `ch18` ([#starstair](#starstair)) |
| 25 | `placeSkyNook` | 181, 109 | S-268 | `skyNook` | Cloudstep ([#sky-nook](#sky-nook)) |
| 26 | `placePlanting` | 191, 113 | S-291 | `planting` | ss-53 ([#planting](#planting)) |
| v1 | Remembered Isle variant pass | 193, 127 | S-188, S-190 | `remembered.*` | in that realm ([#remembered-isle](#remembered-isle)) |
| v1s | Remembered Isle: memory 12's far-storm flicker schedule (runtime only, no placements) | 241, 179 | S-254d | none | in that realm ([lore.md#vignette-last-lamp](./lore.md#vignette-last-lamp)) |
| v2 | Moonmere variant pass | 197, 131 | S-218 | `moonmere.*` | in that realm ([#moonmere](#moonmere)) |
| v3 | Hundred-Year Night variant pass | 199, 137 | S-288 | `night.*` | in that realm ([#hundred-year-night](#hundred-year-night)) |
| 27 | `placeSlowWalk` | 211, 139 | S-172 | `slowWalk` | ss-13 ([side-content#ss-13](./side-content.md#ss-13)) |
| 28 | `placeStoneRing` (no draws) | 223, 151 | S-212a | `stoneRing` | `stoneSites` |
| 29 | `placeLetterboxes` | 227, 157 | S-215 | `letterboxes` | ss-34 copy held or delivered ([side-content#ss-34](./side-content.md#ss-34)) |
| - | next free | 229, 163 | - | - | - |

Notes. CANON §5.3 names one `placeGates` pass for every tool find; it is split into rows 10, 13, 14, 16-18, 20-23 and
25 so each tool step ships its own pass in one PR. The sky, the Great Tree's boughs and crown lanterns and the
Starstair flights are meshes attached to existing objects and use no generator RNG; they are not in prints.

### 1.3 Placement helper used below

`near(anchor, r0, r1, rule)` means: nearest valid spot to `anchor` in the ring `r0..r1` m by rule 5, where valid is
the pass's `ok()`. Unless a section says otherwise `ok()` = dry ground (`hAt > 0.3`), walkable, slope < 0.5, off the
path band (`pathDAt ≥ 2.2`), off bridges, outside every arena and its 5 m ring, ≥ 1.0 m from solids and colliders,
≥ 2.5 m from chests, interactables and NPC spots, ≥ 2 m from every earlier pass item, reachable.

---

## 2. Act I, deepened

<a id="placeReasons"></a>
### placeReasons: the Catchers' kind reasons, seen before the fight (S-004)

Pass row 1, `new RNG(7151 * 67 + 13)`. Each guardian's reason is visible by its arena before the fight (beats in
[story.md#I.2](./story.md#I.2)). Writes `W.reasons = [{ id, kind, x, y, z, rot, attach? }]` in this order:

| id | What | Placement | Collider |
|---|---|---|---|
| `home:reason-grumble-1..3` | three unlit shroomlet night-lights in a row, 1.2 m apart, beside the Hollow sign | `near((0.7, −89.5), 1.5, 3.5)` for the middle one, on the side of the sign away from the path centreline; the other two at ±1.2 m along the sign's facing; each must pass `ok()` with `pathDAt ≥ 1.2` | none |
| `home:reason-rings` | the three fairy rings near the Hollow, dark | no draws: the indices of the `glowshroom` deco within `r + 1.0` of each clearing centre ((−36.1, −44.8), (23.6, −106.9), (−16.9, −86.7)), stored as `rings: [[i...], [i...], [i...]]` | none |
| `home:reason-pinch-spyglass` | a brass spyglass on a tripod on the lighthouse gallery, pointing out to sea at bearing 200° (toward the reef where Nell's boat is) | `attach: 'shores'`, model-space (0.0, 13.15 m, gallery rail at r 1.3 m on bearing 200°); no world draw | none |
| `home:reason-pinch-tally` | a chalk tally of nights on the lighthouse door: 37 marks in groups of five | `attach: 'shores'`, decal on the door face (model-space z 1.6, y 1.2-1.9 m) | none |
| `home:reason-frost-scarf` | a tiny knitted scarf draped on a knee-high rock | rock at `near((92, −22), 0, 6)`; at least 20 m from the arena centre (114, −19) | rock `solid: { r: 0.5 }` |
| `home:reason-frost-cradle` | a snow nest shaped like a cradle, 1.4 × 0.9 m | `near((93, −13), 1.5, 6)`, ≥ 20 m from the arena centre, ≥ 2.5 m from the sign (88.7, −13.2) | none (0.25 m tall, walk-over) |

Runtime: the ring shrooms are drawn as their own `InstancedMesh` (same geometry and count, so `deco.length` and
prints are unchanged) with a uniform `uGlow`: **0.15** (dark, before the Woods Starseed is placed), **1.6** after it.
The night-lights stay unlit (grey cap, no glow) until side story 11 relights them (S-195, [side-content.md#ss-11](./side-content.md#ss-11)).

Test: world.test seeds 1-40 rule 9 (a)-(d); in-page `wp9` view counts the 3 night-lights and the scarf by the arenas.

**ART BRIEF `reason_nightlight`** · a toadstool-shaped glass night-light on a twig stake · 0.42 m tall, cap 0.22 m ·
`#b9a6c8` cap glass (unlit), `#ffd27a` (lit), `#8a5a32` stake, `#f4ead8` stem · toon, cap uses `glow` 0 → 0.9 ·
static; lit state pulses 0.9-1.0 at 0.5 Hz · ≤ 120 tris · Prompt: "a tiny toadstool-shaped glass night-light on a
twig stake, made for very small mushroom children, unlit and a little dusty, soft painterly storybook style,
isolated on white" · 3D: "stylised low-poly toadstool lantern on a twig stake, rounded glass cap, hand-painted
texture, 120 tris" · Fallback: `cyl` stake + half-sphere cap in `js/props.js` `nightLight(lit)`.

**ART BRIEF `reason_spyglass`** · brass telescope on a wooden tripod, tilted 6° down toward the sea · 0.7 m tall,
tube 0.55 m · `#c9a14a` brass, `#6e4526` wood, `#2a3a5a` lens rim · toon metal (spec off) · static · ≤ 160 tris ·
Prompt: "a small brass spyglass on a wooden tripod pointing out to sea, sea-weathered, cosy storybook style" ·
3D: "low-poly brass telescope on a three-leg wooden tripod, 160 tris" · Fallback: `cyl` tube + three `box` legs.

**ART BRIEF `reason_tally`** (image) · chalk tally marks on painted wood, 37 marks in groups of five with a little
crab doodle · 256 × 256 webp, alpha · Prompt: "white chalk tally marks scratched on a blue-painted wooden door, 37
marks in groups of five, a tiny doodle of a crab beside them, painterly, transparent background" · Fallback: a
canvas texture drawing the strokes.

**ART BRIEF `reason_scarf`** · a hand-knitted scarf, sky-blue with white stripes and a pom-pom fringe, folded over a
round grey rock · rock 0.7 m wide, scarf 1.1 m long · `#9fdcff`, `#ffffff`, rock `#a8a096` · toon, scarf flutters
(vertex sway 0.05 m, 0.4 Hz) · ≤ 220 tris · Prompt: "a tiny hand-knitted sky-blue striped scarf with a pom-pom
fringe draped over a snowy round rock, cosy storybook style" · 3D: "low-poly snowy rock with a knitted scarf draped
over it, 220 tris" · Fallback: `ico` rock + bent `box` strip with stripe vertex colours.

**ART BRIEF `reason_cradle`** · an oval nest of packed snow with raised rounded edges like a cradle, a hollow
exactly the size of a Starseed in the middle · 1.4 × 0.9 × 0.25 m · `#f6faff`, shade `#dde6ee`, hollow `#cfe8ff` ·
toon snow · static · ≤ 200 tris · Prompt: "a little oval cradle shaped from packed snow with soft rounded walls and a
small star-shaped hollow in the middle, cosy storybook style" · 3D: "low-poly snow cradle, 200 tris" · Fallback:
flattened `lathe` ring + inner disc.

<a id="healed-states"></a>
### Healed states: each region changes when its Starseed is placed (S-011)

Conditions read `S.seeds` (the shipped field). Every change happens within 10 s of the Place beat and never reverts.

| Region | Before the seed is placed | After it is placed | Mesh / audio |
|---|---|---|---|
| Whispering Woods | ring shrooms `uGlow` 0.15; Grumble's Crown as shipped | ring shrooms 1.6 for good; **glow-moss** patches on Grumble's Crown (12 patches on the stem flare and cap underside, emissive `#9be86a`, night `glow` 0.8, day 0.3) | `heal_glowmoss`, one merged mesh attached to the landmark group |
| Sunny Shores | lamp-room cylinder `glow` 0.1 by day (dark); the beam still sweeps at night as shipped | lamp `glow` 0.8 by day and the beam also sweeps by day at 35 % opacity **until** `nellHome`; after `nellHome` exactly the shipped behaviour; the door tally gains a 38th mark, a chalk heart and "HOME!" | lamp material uniform; tally decal swap |
| Frostcap Peaks | the Cairn crystal as shipped | a **warm spring** steams at `near((96, −6), 0, 8)` (≥ 20 m from the arena centre): a 1.2 m water disc 0.2 m deep, walkable (wade), a steam emitter (24 particles, 1 draw), six snow-melt flowers; at night the Cairn crystal pulses `glow` 0.7-1.0 at 0.25 Hz and a 3D hum loop `cairnHum` plays within 40 m | `heal_spring` (warm spring position is stored by `placeReasons` as `home:heal-spring`, appended entry) |

**ART BRIEF `heal_glowmoss`** · flat cushions of soft green moss with tiny round glowing spores · patches 0.4-1.1 m ·
`#7aa63a` moss, `#9be86a` glow, `#fff3a0` spore dots · toon + `glow` · static, spore dots twinkle by vertex colour ·
≤ 600 tris for all 12 · Prompt: "soft cushions of bright green glow-moss with tiny luminous spores on a giant purple
mushroom stem, night, cosy storybook style" · Fallback: flattened `sphere` patches.

**ART BRIEF `heal_spring`** · a round warm pool rimmed with dark wet stones and snow-melt crocuses, wisps of steam ·
pool r 1.2 m, rim r 1.6 m · `#7fd3d0` water, `#5a5a66` stones, `#c9a6ff` and `#fff3a0` crocuses · toon water uses the
shipped water material · steam rises 1.5 m and fades, 24 particles · ≤ 400 tris · Prompt: "a small round steaming
warm spring in the snow, wet dark rim stones, tiny purple and yellow crocuses poking through melting snow, cosy
storybook style" · Fallback: `lathe` rim + disc + `ico` stones.

<a id="placeThorns"></a>
### placeThorns: thornvine brambles the Shiny Sword cuts (S-013)

Pass row 2, `new RNG(7151 * 71 + 17)`. Four rings of purple **thornvine** each hide a small gem cache. A cut is a
flag `thorn:home:<id>` and never regrows.

| id | Region | Anchor `near(a, 0, 14)` | Cache | Note |
|---|---|---|---|---|
| `home:thorn-woods` | Whispering Woods | (−22, −60) | 15 gems | in sight of the Woods path |
| `home:thorn-peaks` | Frostcap Peaks | (85, 30) | 15 gems | on the plateau east of the river |
| `home:thorn-shores` | Sunny Shores | (30, 95) | 15 gems | among the palms |
| `home:thorn-meadow` | Bloom Meadow | (−80, 40) | 15 gems | by the hedge of bushes |

Rules: `ok()` plus a clear disc of r 2.4 m (the ring) and ≥ 6 m from chests. The ring is `solid: { r: 1.9 }` with the
cache (a small cloth pouch on a stump, interactable `[E] Open · Gem pouch`) at its centre. A hit with `swordLevel ≥ 2`
withers the ring in 0.6 s (purple petals puff, no "poof" sound) and sets the flag; with the starter sword the hit
bounces and the feed says "Too tough for this sword." Economy +60 ([systems.md#economy](./systems.md#economy)).

**ART BRIEF `thornvine_ring`** · a knee-high ring of twisting purple bramble with curled thorns and a few dusky
flowers, a clear gap of nothing (it is closed all round) · outer r 1.9 m, 1.1 m tall · `#5a2a6a` stems, `#b05ab8`
thorns, `#e8a8f0` flowers, `#3a6a2a` leaves · toon · idle sway 0.02 m; wither: scale Y 1 → 0 in 0.6 s · ≤ 700 tris ·
Prompt: "a ring of twisting purple bramble with curly thorns and a few dusky pink flowers, magical but friendly, cosy
storybook style, isolated" · 3D: "low-poly circular bramble hedge, purple vines with curled thorns, 700 tris" ·
Fallback: 18 `tube` arcs with `cone` thorns. The same prop (one geometry) is the thornvine gate in every land
([systems.md#gates](./systems.md#gates)).

---

<a id="great-tree"></a>
## 3. The Great Tree: boughs, crown lanterns, rings and balconies

Everything here is a child of the Great Tree group in `Scenery.buildGreatTree` (`js/scatter.js`), works on both the
GLB and the procedural tree, has **no collider** (except the two balcony decks, which are post-decks), and leaves
prints unchanged. Positions are tree-local: origin at the trunk base (0, Y 2.2, −1.5), `H` = the tree's built height
(19.8 m), azimuth `az` as in Conventions. The face looks toward +z (az 0).

### The four boughs (S-009; Meadow bough ends in S-291)

| Bough | Faces | `az` | Tree-local position of the cluster | Blossoms when | Blossom colour |
|---|---|---|---|---|---|
| North (Woods) | Whispering Woods | π | (0, 0.64H, −0.36H) = (0, 12.7, −7.1) | the Woods Starseed is placed | pink `#ffb0c8`, white `#ffffff` |
| East (Peaks) | Frostcap Peaks | π/2 | (7.1, 12.7, 0) | the Frost Starseed is placed | pale blue-white `#dff2ff`, pink `#ffd0e0` |
| South (Shores) | Sunny Shores | 0 | (0, 12.7, 7.1) | the Sea Starseed is placed | coral `#ffb2a2`, white |
| West (Meadow) | Bloom Meadow | −π/2 | (−7.1, 12.7, 0) | side story 14 ends (S-291) | gold `#ffe9a8`, cream `#fff6e2` (the "For Spring" gold) |

Each bough is one short branch (`tube` from r 0.20H to 0.38H, radius 0.32 m, bark `#8a5a32`) carrying a leaf tuft
(state `leaf`) or a blossom cluster (state `blossom`): 14 camera-facing alpha cards of `tree_blossom_cluster`
(256 × 256 webp, [art-audio.md#home](./art-audio.md#home)) in a 1.4 m ball, one `InstancedMesh` for all four boughs
(1 draw). Blossoming plays once: cards scale 0 → 1 over 1.5 s with 12 falling petals, within 10 s of the Place beat.
After the bloom the GLB canopy blossoms everywhere; the boughs stay as bigger clusters just outside the canopy
silhouette so the Meadow bough still reads as "in leaf" until S-291.

**ART BRIEF `tree_bough`** · a stout curving branch ending in a round puff of blossom (or of leaves) · 3.6 m long,
cluster 1.4 m · bark `#6e4526`/`#a8723e`, leaves `#5aa03a`/`#a8dc5a`, blossom per the table · toon, cards alpha-
tested · sway 0.03 rad at 0.3 Hz · ≤ 300 tris per bough + 14 cards · Prompt (for the card): "a round cluster of soft
pink cherry-like blossoms with a few leaves, seen from the side, painterly storybook style, transparent background" ·
3D: "stylised low-poly tree branch with a round blossom puff, 300 tris" · Fallback: `tube` + `sphere` puff with
blossom vertex colours (no texture).

<a id="crown-lanterns"></a>
### The eight crown lanterns (S-095; the whole-game progress bar)

Eight paper-and-wood Lamplighter lanterns hang under the canopy on 0.8 m cords, each on the side of the crown that
faces the place that lights it, so from the plaza at night a lit lantern points at a lit horizon. Ring: radius 0.31H
(6.1 m), cord top at 0.58H (11.5 m), lantern centre 0.54H (10.7 m). One `InstancedMesh` for the eight lanterns and one
for their additive halo sprites (2 draws). No point lights (the shipped 4-light pool is not used).

| Slot | Lit by (flag, names per [systems.md#conditions](./systems.md#conditions)) | Bearing θ | `az` | Light colour |
|---|---|---|---|---|
| L1 | Pinewhistle's beacon kindled | 330° | −2.618 | mint `#b8f0c8` |
| L2 | Archwater's beacon kindled | 112.5° | 1.178 | sea-glass `#8ff0e8` |
| L3 | Threemills' beacon kindled | 247.5° | −1.178 | wheat `#ffe27a` |
| L4 | the Tower's great lamp kindled (`ch12`) | 157.5° | 0.393 | candle gold `#ffcf6a` |
| L5 | the Sunken Bell's Stair Stone set | 292.5° | −1.963 | bell blue `#9fd8ff` |
| L6 | Kettle Isle's Stair Stone set | 67.5° | 1.963 | ember `#ff9a6a` |
| L7 | Saltglass Flats' Stair Stone set | 202.5° | −0.393 | salt white `#f4f0dc` |
| L8 | the finale (`mainEnding`) | 22.5° | 2.749 | starlight `#fff4c8` |

The count condition `lanterns` = number of lit slots (CANON: 4 after Act II, 7 after Act III, 8 at the end). Unlit:
glass `#4a3a2a` at `glow` 0.05, halo hidden. Lighting: the first time a newly lit slot is within the camera frustum
at home (flag `crownSeen:<slot>`), it plays a 1.2 s bloom (scale 1 → 1.25 → 1, halo 0 → 1) with a soft chime; if
Pip is home when it is earned, that happens within 10 s. Lit lanterns glow `glow` 0.9 at night and 0.35 by day.

**ART BRIEF `crown_lantern`** · hexagonal paper lantern in a dark wooden frame, spiral cut-outs in the paper, a little
leaf-shaped cap, hanging from a cord · 0.55 m tall, 0.34 m across · frame `#5a3a24`, paper `#f6e6c8` (lit tint per
slot), spiral cut-outs show the light · toon; paper `glow` · sways 2° at 0.5 Hz · ≤ 180 tris · Prompt: "a hexagonal
paper lantern in a dark wooden frame with spiral shapes cut into the paper, a tiny leaf-shaped cap, glowing warm gold,
hanging from a cord, cosy storybook style, transparent background" · 3D: "low-poly hexagonal paper lantern with
wooden frame and spiral cut-outs, 180 tris" · Fallback: hexagonal `cyl` + `box` frame posts + `cone` cap.

### Acorn rings (S-161)

For every 25 Sleeping Acorns woken (game-wide count), one ring is carved round the trunk, low enough to see from the
plaza: ring 1 at 1.0 m above the root flare top (tree-local y 1.6), then 1.9, 2.2, 2.5. Each ring is a thin band
(0.08 m) of spiral-and-leaf carving lit `glow` 0.5 in gold `#ffe9a8`, made as a decal strip wrapped at the trunk's
radius at that height (radius from `TW.rootR`-style table `TW.trunkR`, measured once on the GLB and the fallback).
When a ring appears, Miso's stock gains an item (systems). 1 draw for all four.

### The two balconies (post-decks)

| Balcony | Where (tree-local) | Reached by | Step | Used by |
|---|---|---|---|---|
| **Nook Balcony** | an arc deck on the east-south-east side of the trunk, `az` 1.0 to 1.8, from `TW.trunkR(9.0) + 0.1` to that + 2.0 m, deck top at 9.0 m (Y 11.2); wooden planks on root brackets, a root railing with one opening toward the plaza | the Lookout stair inside Pip's Nook ([#pips-nook](#pips-nook)) | S-102 | the Blossom Run ([#glide-finds](#glide-finds)) |
| **Crown Balcony** | a round deck nest on the west side, `az` −1.9 to −1.2, 2.4 m deep, deck top at 10.5 m (Y 12.7), at least 1.0 m under the lowest foliage on that bearing on both the GLB and the fallback (measured in the PR; lower in 0.5 m steps until true) | the ivy lattice on the trunk's west face ([#ivy-finds](#ivy-finds)) | S-248 | vista `home:v4` |

Both are `deck` records from `placeGlideFinds` and `placeIvyFinds` (their rows in [#passes](#passes)); neither is
visible before its step's flag condition (`ability:glide` shows the Nook Balcony's door from inside only; the
balcony itself is always rendered once its step ships, it simply cannot be reached).

### Other Tree states (owned elsewhere, listed so nobody double-builds them)

- Sleepy and awake faces: shipped. Wenna's dialogue frame and line table: [story.md#wenna-lines](./story.md#wenna-lines).
- The small sneeze at `ch12` (every tree drops one leaf): FX in [story.md#ch12](./story.md#ch12).
- The root door and the Nook: [#pips-nook](#pips-nook). The Ladder's foot in the crown during Act IV: [#sky](#sky).

<a id="sky"></a>
## 4. The sky and the horizon (S-064, later beats)

All painted sky things stay in the one `SkySprites` draw (`js/sky.js`). Data lives in a new table `SKY_HOME` in
`js/sky-home.js` (pure): cards, windows, states, read each frame from `S.flags`.

### Horizon cards: fixed bearings

R 760 m, y 0, `flip` 1 for all six (the random sector placement of today is replaced by this table; the sky isle is
unchanged at `az` 2.30, R 900, y 135, w 92).

| Card key | Land | Bearing θ | `az` | Width (m) | Night windows (u, v, size on the card, 0-1) | Fog until |
|---|---|---|---|---|---|---|
| `horizon_isle_a` (shipped) | Pinewhistle | 330° | 3.665 | 190 | the pine's knot-holes: (0.52, 0.30, 0.03), (0.55, 0.42, 0.03), (0.50, 0.55, 0.03) | - |
| `horizon_isle_b` (shipped) | Archwater | 112.5° | 1.178 | 165 | the arch beacon: (0.47, 0.28, 0.05) | - |
| `horizon_isle_c` (shipped) | Duskwick | 157.5° | 0.393 | 140 | the tower window: measured on the shipped painting (lit spot) | - |
| `horizon_isle_d` (shipped) | Threemills | 247.5° | −1.178 | 190 | mill windows: one per windmill, measured on the painting | - |
| `horizon_isle_e` (new) | Kettle Isle | 67.5° | 1.963 | 165 | forge glow at the cone's foot (0.38, 0.78, 0.06); spout glow (0.50, 0.08, 0.04) | `act2done` |
| `horizon_isle_f` (new) | Saltglass Flats | 202.5° | −0.393 | 210 | Academy bell-tower window (0.62, 0.40, 0.03) | `act2done` |

Pinewhistle sits at 330°, not 337.5°, so the card stays 0.52 rad clear of the plaza-to-Tree line the shipped code
protects (`az` π ± 0.32). A window offset marked "measured" is read off the painting in the PR and recorded in
`SKY_HOME`. Fogged cards draw with `haze` 0.95 (a pale silhouette in mist); after `act2done` `haze` 0.5 as today.

Night windows: each window is an extra quad in the sprite buffer using one soft glow sprite `horizon_window`
(64 × 64 webp), additive, tint `#ffd98a`, visible from dusk to dawn when its card's state is `lit`:

| Card | Before `wennaAwake` | From I.6 | Lit again when |
|---|---|---|---|
| a, b, d | lit | dark | its beacon is kindled |
| c | lit (Granny Wick's window) | dark (goes out last in I.6) | `ch12` (the Tower kindled) |
| e, f | fogged, dark | fogged, dark | its Stair Stone is set |

The I.6 scene drives a per-card `winT` 1 → 0 one card at a time, order a, d, b, c, 0.8 s apart
([story.md#I.6](./story.md#I.6)).

**ART BRIEF `horizon_isle_e`** (image) · a distant teakettle-shaped volcano isle: a round cone with a spout-like
side vent breathing a thin curl of steam, terraced flanks, a little forge town at its foot with warm chimneys,
black-sand beach · 896 × 448 webp, alpha, isle sits on the bottom edge, hazy blue distance · palette `#3b3540`
`#e66f4f` `#f4d1a6` `#8fc7a0` · Prompt: "a distant small volcanic island shaped a little like a teakettle, a gentle
steam curl from a side vent, terraced green flanks, tiny warm-lit forge village at its foot, seen across the sea from
far away, soft atmospheric haze, painterly storybook style, transparent background above the waterline" · Fallback:
none drawn (the shipped rule: no stand-in for painted isles).

**ART BRIEF `horizon_isle_f`** (image) · a long pale low isle of salt dunes with glinting glass ridges and a
half-buried bell tower standing up out of the sand · 896 × 448 webp, alpha · `#efe3c8` `#c9a46b` `#8ec9d8` `#b55d4c`
· Prompt: "a distant flat island of pale salt dunes with glinting glassy ridges and an old half-buried stone bell
tower poking out of the sand, seen across the sea from far away, hazy, painterly storybook style, transparent
background above the waterline" · Fallback: none drawn.

**ART BRIEF `horizon_window`** (image) · a soft round warm glow with a faint four-point twinkle · 64 × 64 webp,
alpha · `#ffd98a` core fading to transparent · Fallback: a canvas radial gradient.

### The sky isle, the Ladder and Mote's star

| State | Condition | What shows | Draw |
|---|---|---|---|
| Mote's light (early) | from New Game until `moteNamed`, at night (21:00-04:00), one night in three (`dayIndex % 3 === 0`, the first night included; S-011b) | the same glow, waypoints and speed as the row below; Hoot remarks on it once ([story.md#act-I-sky](./story.md#act-I-sky)) | in the sky buffer |
| Mote's light | `moteNamed` and not `mainEnding`, at night, two nights in three (`(dayIndex * 7 + 3) % 3 !== 0`) | a 6 m additive glow (`horizon_window`, tint `#fff0b0`) drifting along three waypoints on the sky isle's rim at 0.03 sprite-widths per second | in the sky buffer |
| Scrap lamps | `ch18` or later | 12 tiny steady glows (2 m) scattered over the sky isle's meadow at night | sky buffer |
| The Ladder (far) | `act2done` until `ch19` | `sky_ladder` billboard at `az` 2.40, R 900, from y 0 up to y 420, width 6 m, a ribbon of lamp-lights shimmering upward at 0.1 Hz | sky buffer |
| The Ladder's foot | `ch19` until `mainEnding` | a world-space column of camera-facing quads (the same `sky_ladder` texture) centred on the Tree (0, −1.5) from Y 24 to Y 260, fogged; canopy leaves drift upward around it (40 particles) | 1 draw + particles |
| Mote's star | `mainEnding` | a star 1.6× the size of others at bearing 0°, elevation 58° (just above the Tree from the pedestal), warm white `#fff4c8`, twinkle 0.3 Hz, night only | star layer |

**ART BRIEF `sky_ladder`** (image) · a tall thin ladder made of small round lamp-lights strung on two gold threads,
glowing warm, fading at both ends · 128 × 1024 webp, alpha, tiles vertically · `#ffe9a8`, `#ffcf6a`, threads
`#f5c040` · Prompt: "a very tall thin ladder made of tiny round glowing lamps strung on two golden threads, softly
glowing against the night, painterly storybook style, transparent background, vertically tileable" · Fallback: a
canvas texture with two lines and evenly spaced radial-gradient dots.

---

<a id="placePortals"></a>
## 5. Ways in and out: portals, the jetty, NPC spots

### placePortals and the master portal list (S-026 and later)

Pass row 3, `new RNG(7151 * 61 + 11)`. Its own entries are anchored on things that already exist, so only the
root-gate draws. Entries are append-only (index = order below). Portals owned by other passes are listed too so this
table is the one place to see every way off the home overworld. Before its condition holds a portal is not offered
and the shipped interaction (Peek, Knock) plays unchanged.

| # | Portal id | Owner pass | Anchor | Prompt | To realm · spawn | Needs | Step |
|---|---|---|---|---|---|---|---|
| 1 | `home:portal-well` | placePortals | the well (9, −7.5) | `[E] Enter · Puddle's Grotto` (first time also: "The tiny frog waves. This time it waves you down.") | `home_grotto` · `entry` | `item:lantern` | S-077 |
| 2 | `home:portal-cottage-1` | placePortals | door (−14.1, −12.3) | `[E] Enter · Grandpa Dormy's Cottage` | `home_cottage_1` · `entry` | `met:dormy` | S-115 |
| 3 | `home:portal-cottage-2` | placePortals | door (13.3, −14.1) | `[E] Enter · Nell's Cottage` | `home_cottage_2` · `entry` | `met:nell` | S-206 |
| 4 | `home:portal-cottage-3` | placePortals | door (−15.9, 11.5) | `[E] Enter · Hazel's Bakery` | `home_cottage_3` · `entry` | `met:hazel` | S-135 |
| 5 | `home:portal-cottage-4` | placePortals | door (21.5, −5.4) | `[E] Enter · Granny Mochi's Cottage` | `home_cottage_4` · `entry` | `met:mochi` | S-134 |
| 6 | `home:portal-cottage-5` | placePortals | door (−22.5, −2.7) | `[E] Enter · The Thistledown Burrow` | `home_cottage_5` · `entry` | `met:primrose` | S-156 |
| 7 | `home:portal-lighthouse` | placePortals | lighthouse door, model-space z 1.52 → world (8.5, 118.7), faces south | `[E] Enter · Pinch's Lighthouse` | `home_lighthouse` · `entry` | `lanternGot` | S-075 |
| 8 | `home:portal-miso-back` | placePortals | Miso's shop door (14.1, 11.2) | `[E] Enter · Back room` | `home_miso_back` · `entry` | side story 3 at its last step | M27 step that finishes ss-03 |
| 9 | `home:portal-rootgate` | placePortals | root arch beside the Meadow Windmill: `near(windmill + 7 m on bearing 315°, 0, 5)` (behind the mill, away from its door and from Digby) | `[E] Enter · Root-gate` | `rootdeep` · `home_gate` | `act2done` | S-182 (ch13 uses it from S-191) |
| 10 | (reserved) | placePortals | Hoot's study, only if [atlas-isles.md#hoots-margins](./atlas-isles.md#hoots-margins) puts it on home | - | - | - | S-300 |
| - | `home:portal-nook` | placeRootDoor | root door (0, −8) | `[E] Enter · Pip's Nook` | `home_nook` · `entry` | `wennaAwake` | S-056 |
| - | `home:portal-hollow-1`, `-2` | placeHollowDoors | two fairy-ring stumps | `[E] Enter · Fairy ring` | `hollow_home_1/2` · `entry` | `item:lantern` | S-073 |
| - | `home:portal-storm-cave` | placeTideFinds | cave mouth between the islets | `[E] Enter · The Storm Cave` | `home_storm_cave` · `entry` | `home:stormLow` (tide stone rung) | S-122 |
| - | `home:portal-undercap` | placeDigSpots | dug hole at Grumble's Crown | walk-in | `undercap` · `entry` | `find:home:dig-undercap` | S-181 (dungeon S-194) |
| - | `home:portal-snowglobe` | placeBellTargets | ice wall mouth, Peaks | walk-in | `snowglobe` · `entry` | `find:home:ice-wall` | S-227 (dungeon S-238) |
| - | `home:portal-bell-hollow` | placeBellTargets | Bell Mound door, Meadow | `[E] Enter · The Bell Hollow` | `home_bell_hollow` · `entry` | all four landmark bells rung | S-227 |
| - | `home:portal-moonpath` | placeJetty | far end of the moonpath | walk-in | `moonmere` · `moonpath` | moonpath open tonight | S-218 |
| - | `home:portal-starstair` | placeStarstair | Stairfoot platform on the Cairn | `[E] Climb · The Starstair` | `driftholm` · `stair_top` | `ch18` started | S-264 |
| - | `home:portal-night` | placeBenches | Shellby's Bench | `[E] Sit · Shellby's Bench` then a choice | `night` · `bench` | `ch22` done | S-288 |
| - | `home:portal-sail` | placeJetty | mooring post | `[E] Sail · the Dandelion` | chart | `lanternGot` | S-068 / S-081 |

Exit spawns: each portal record also stores its return spawn in `W.spawns` (`nook_door`, `well`, `cottage_1..5`,
`lighthouse_door`, `lighthouse_lookout`, `miso_back`, `rootgate`, `jetty_end`, `hollow_1`, `hollow_2`,
`storm_cave`, `undercap`, `snowglobe`, `bell_hollow`, `stairfoot`, `bench_1..5`, `nook_balcony`): the walkable,
reachable point 1.5 m out from the portal on its facing side. Cottage door lines change once the door opens: the
shipped line stays the **first** knock's text, then the portal prompt replaces Knock. Meeting each resident
(`met:*` flags) is written in [side-content.md](./side-content.md) for that side story; the doorstep rules are:

| Cottage | How Pip meets the resident at the door |
|---|---|
| 1 Dormy | Knock between 21:00 and 23:00: "Oh! A visitor. I only lock it when I'm asleep, which is mostly. Come in, come in." |
| 2 Nell | talk to Nell on the jetty after I.6 (S-068) |
| 3 Hazel | Knock any morning 06:00-11:00 after `wennaAwake`: "Buns aren't ready. ...Fine, they're ready. Come in before they're gone." |
| 4 Granny Mochi | Knock after `ch8`; she is met when Miso first mentions her (side story 3) |
| 5 Primrose | `[E] Use · Doormat` once ("You wipe your paws. Very, very thoroughly."), then Knock |

**ART BRIEF `cottage_doormat`** · a woven reed doormat with a stitched paw print · 0.9 × 0.55 m · `#c9a06a`, paw
`#7a4a2e` · flat, 12 tris · Prompt: "a small woven reed doormat with a stitched brown paw print, top view, painterly,
transparent background" · Fallback: a `box` with a canvas paw texture.

<a id="placeJetty"></a>
### placeJetty: Nell's Jetty, the Dandelion and the moonpath (S-068; moonpath S-218)

Pass row 5, `new RNG(7151 * 79 + 23)`. Anchor (−14, 126): dry sand south of the village, west of the lighthouse.

- **Root**: `near((−14, 126), 0, 6)` with `ok()` plus: the 26 m run due south (bearing 180°) from the root crosses
  no bridge, chest, interactable or arena ring, stays ≥ 6 m from the lighthouse collider and ≥ 2 m from every
  collider, and its last 6 m are over water deeper than −1.2 m. On seed 7151 the root lands within 1 m of the anchor.
- **Deck**: `deck { ax: root.x, az: root.z, bx: root.x, bz: root.z + 22, w: 2.4, h0: 1.3, h1: 1.3 }` (deck top Y 1.3)
  plus an end platform `deck` 4 × 4 m centred 2 m past the run's end (the T-head). Pilings every 3 m on both sides;
  the ones standing in walkable shallows are `solid: { r: 0.18 }`.
- **Mooring post** at the T-head's east corner: a post with a lantern hook and a rope; the interactable
  `[E] Sail · the Dandelion` (chart travel, [systems.md#travel](./systems.md#travel)). Before `lanternGot` the post
  reads `[E] Read · Mooring post`: "Nell's mooring. A note: 'Back... eventually. No sailing without a lamp. — N.'"
- **The *Dandelion*** moored on the T-head's east side, bow south, no collider (boarding is the Sail prompt). Its
  model and brief live with the boat in [systems.md#boat](./systems.md#boat); here it is placed only.
- **Spots**: Nell's day spot on the deck 3 m short of the T-head (`home:spot-nell-jetty`, written by `placeSpots`);
  the Shores bench `home:bench-4` at the root ([#benches](#benches)); the fish spot `home:fish-jetty` off the T-head
  ([#fish-spots](#fish-spots)).
- **The moonpath** (appended entry, S-218): a 2.0 m wide, 27 m long `deck` from the T-head's south edge due south
  (stops at z ≤ 176), deck top Y 0.15 (just above the sea), `active: false` by default. It turns active from the
  moment the Starsong's *Calling* is played on the T-head at night after the Sunken Bell is done, until the next dawn.
  It renders as a shimmering silver ribbon of moonlight (`moonpath_strip`, additive, scrolling). Walking off its far
  end (a 3 m walk-in trigger) enters Moonmere. Feed on opening: "✿ The moon lays a path on the water."

Visible: the jetty, post and boat appear with `wennaAwake` (Nell comes home in I.6 and ties up that night); before
that the post-deck is inactive and not drawn.

**ART BRIEF `home_jetty`** · a plain sun-bleached plank jetty on round pilings with rope rails, a T-head with two
bollards and a crate of nets · deck 2.4 m wide, 22 m + 4 × 4 m head, 1.3 m above sea · `#c8a878` planks, `#8a6a48`
pilings, `#e8dcc0` rope, crate `#a87a48` · toon wood · static; rope sags · ≤ 2,400 tris all · Prompt: "a small
sun-bleached wooden jetty on round pilings with rope rails and a T-shaped end, nets in a crate, turquoise shallow
water, cosy storybook style" · 3D: "low-poly wooden pier with T-head, rope rail, 2400 tris" · Fallback: `box` planks
(one per 0.45 m, as `bridgeGeo`) + `cyl` pilings.

**ART BRIEF `moonpath_strip`** (image) · a ribbon of rippled silver moonlight on dark water, glittering · 256 × 1024
webp, alpha, tiles along its length · `#f6f3d8`, `#cfd8ee` · Prompt: "a narrow ribbon of glittering silver moonlight
reflected on calm night water, top view, tileable lengthwise, painterly, transparent background" · Fallback: canvas
noise stripes in the two colours.

<a id="spots"></a>
### placeSpots: outdoor spots for new home NPCs (S-068 and later)

Pass row 6, `new RNG(7151 * 83 + 29)`. NPC outdoor positions for schedules ([systems.md#schedules](./systems.md#schedules))
and visits. `near()` is around the anchor; plaza spots use bearings from the plaza centre (0, 0) with
`ok()` + `pathDAt ≥ 2.2` + ≥ 3 m from every other spot + not on the z = 9 line within |x| < 14 (the playthrough test
line, as `placeLanterns`).

| id | Anchor / rule | Used by | Step |
|---|---|---|---|
| `home:spot-nell-jetty` | on the jetty deck, 3 m short of the T-head | Nell, day | S-068 |
| `home:spot-nell-door` | `near(cottage 2 door + 2 m out, 0, 3)` | Nell, evenings | S-068 |
| `home:spot-puddle-rim` | the well rim, 0.9 m from the well centre on bearing 200° (a perch, not a ground spot) | Puddle, sunny afternoons after side story 7 | S-077 |
| `home:spot-dormy-step` | `near(cottage 1 door + 1.5 m out, 0, 2)` | Dormy, 22:00-23:00 when the sky is clear | S-115 |
| `home:spot-hazel-stall` | `near((−19, 9), 1, 4)` | Hazel's bun stall, 07:00-11:00 | S-135 |
| `home:spot-mochi-step` | `near(cottage 4 door + 1.5 m out, 0, 2)` | Granny Mochi, sunny afternoons | S-134 |
| `home:spot-ducks-1..5` | five points on a circle r 2.4 m round the pond centre (−13, 25), on the water | the Quackenbushes | S-136 |
| `home:spot-kits-1..4` | `near((−28, 6), 0, 6)`, four spots ≥ 1.5 m apart | Bramble, Sorrel, Clem, Dot | S-156 |
| `home:spot-grumble-eve` | plaza ring bearing 330°, r 17-21 | Grumble Shroom, evenings after `moteNamed` | S-170 |
| `home:spot-pinch-eve` | bearing 200°, r 17-21 | Captain Pinch, evenings after `moteNamed` | S-170 |
| `home:spot-frostbun-eve` | bearing 75°, r 17-21 | Frostbun, evenings after `moteNamed` | S-170 |
| `home:spot-visit-pinewhistle` | bearing 300°, r 12-15 | an Acornet visitor | S-106 |
| `home:spot-visit-archwater` | bearing 120°, r 12-15 | a rafter | S-127 |
| `home:spot-visit-threemills` | bearing 240°, r 12-15 | a Haybury | S-148 |
| `home:spot-visit-duskwick` | bearing 150°, r 12-15 | Flick | S-165 |
| `home:spot-visit-rootdeep` | bearing 270°, r 12-15 | Gran Burrows | S-191 |
| `home:spot-visit-glassway` | bearing 200°, r 12-15 | Postmistress Pell | S-212 |
| `home:spot-visit-kettle` | bearing 60°, r 12-15 | Pitch | S-232 |
| `home:spot-visit-saltglass` | bearing 215°, r 12-15 | Sable | S-254 |
| `home:spot-visit-driftholm` | bearing 40°, r 12-15 | a Nimble | S-272 |
| `home:spot-visit-starmeadow` | bearing 20°, r 12-15 | a Twinkling | S-286 |

Rule for the visit spots (CANON §4.4 "one islander visits the plaza"): the visitor stands there from the step that
relights or completes that land, 08:00-20:00, for good. Who exactly is in [cast.md](./cast.md).

---

<a id="interiors"></a>
## 6. Home interiors (S-054 and the steps listed)

Shared rules for every home interior: realm `kind: 'interior'` compiled from the tile format in
[dungeons.md#format](./dungeons.md#format) (2 m tiles, ENGINE legend `#` wall, `.` floor, `_` pit or water,
`D` open doorway, `@` entry spawn, `X` exit back to the overworld, `^` stairs to a linked room or realm, `c` chest or
pickup, `t` lamp), plus three home letters: `w` wall with a painted window card, `u` a door to an overworld deck
spawn, `O` a solid one-tile prop. Grid 48 m. Overworld stays resident (fade < 100 ms back). No enemies
(`regions[0].max = 0`). Palette `home_interior`: ambient `#ffe9c8`, hemisphere sky `#fff2dc` ground `#6e4526`, fog
`#2a1e16` near 6 m far 60 m, time frozen at the outside time of day for window cards. Lamps (`t` and lamp props) feed
the shipped 4-light pool. Music: the village theme through a 1.2 kHz low-pass at −6 dB plus a room ambience. A name
card shows on first entry only. Furniture comes from one code-built kit (`js/props-interior-home.js`, ≤ 24 instanced
types per realm). Every interior gets a prints fixture in its step.

<a id="pips-nook"></a>
### Pip's Nook and the Keepsake Hollow (S-056; Lookout S-102; furnishings S-302; plushies S-305)

**The root door (`placeRootDoor`, pass row 4, `new RNG(7151 * 73 + 19)`).** Anchor (0, −8), the Great Tree's north
side, facing north (bearing 0°). The door is set into the root mound: its sill sits at the mound's surface; the pass
only jitters it ≤ 0.6 m along the mound (draws: 2) to the nearest spot where the 1.5 m apron in front is `ok()`.
Not drawn until `wennaAwake`; the I.6 scene opens it ([story.md#I.6](./story.md#I.6)). Spawn `nook_door` on the apron.

**ART BRIEF `root_door`** · a round-topped wooden door grown into a big root, leaf-green paint, a knocker shaped like a
two-leaf sprout, a round window with a warm light behind it, little root steps · door 1.6 × 1.1 m, root frame 2.6 m
· `#7aa63a` door, `#8fd14f` sprout knocker, `#6e4526` root, window `#ffe7a0` · toon; window `nightGlow` 0.6 · opens
by swinging inward 0.8 s · ≤ 500 tris · Prompt: "a small round-topped leaf-green wooden door set into the huge root of
a friendly giant tree, a brass knocker shaped like a two-leaf sprout, round glowing window, tiny root steps, cosy
storybook style" · 3D: "low-poly door grown into a tree root, round top, sprout knocker, 500 tris" · Fallback:
`rbox` door + `tube` root arch + `cyl` window.

**Layout** (`home_nook`, card "Pip's Nook" / "Home sweet roots"). Room n1 at `at: [0, 0]`, room n2 at `at: [9, 0]`,
linked n1 `D` (8, 3) ↔ n2 `D` (0, 3).

```
n1 Pip's room          n2 Keepsake Hollow
###w#w###              #######
#.......#              #.....#
#.......#              #.....#
#.......D              D.....#
#.......#              #.....#
#.......#              #.....#
#^..@..u#              #######
####X####
```

- `X` (4, 7): back out through the root door to `nook_door`.
- `^` (1, 6): the stair down to Under the Roots (`under_roots` · `entry`, needs `wennaAwake`); after ch7 it stays
  open as the way back into the dungeon.
- `u` (7, 6): the **Lookout stair** to the Nook Balcony (`nook_balcony` spawn); added in S-102, drawn as a little
  root door; before S-102 the tile is plain wall.
- `w` (3, 0) and (5, 0): knot-hole windows showing `nook_window` (the Woods path, day and night cards).
- Lights: two glowroot sconces on the west and east walls, `#ffcf8a`. Ambience: soft creaks and a slow heartbeat-like
  root hum at −24 dB.

Fixed displays (always there; contents appear as earned):

| Display | Tile / wall | Holds |
|---|---|---|
| Pip's bed | floor (1, 1)-(1, 2) along the west wall | - (Use: "Not sleepy. Too much to do.") |
| Plushie cabinet | north wall (4, 0), 2 m wide, 4 shelves × 4 | the 16 plushies ([side-content.md#plushies](./side-content.md#plushies)) in purchase order |
| Desk | floor (6, 1)-(7, 1) | Hoot's print frame above it on wall (7, 0) (Vista Sketches tier 3) |
| Bell hook | east wall (8, 4) | the Bell Duel bell (tier 2) |
| Towel rail | east wall (8, 5) | Soakley's bath towel (Steam Hop tier 2) |
| Hat stand | floor (7, 5) | Shellby's old hat ([#dig-spots](#dig-spots)) |
| Hanky frame | west wall (0, 3) | Shellby's hanky after ch22 |
| Keepsake shelves (n2) | north wall (1..4, 0), east wall (6, 1..4), south wall (2..4, 6) | 11 shelves × 4 niches = 44 keepsakes |

Keepsake shelves in order: north: Starseed Isle, Duskwick, Pinewhistle, Archwater; east: Threemills, the Rootdeep,
the Glassway, Kettle Isle; south: Saltglass Flats, Driftholm, the Starmeadow. A found keepsake sits in its niche as
its own small model (the shipped `secretModel` kinds for home); an unfound niche shows a faint dotted outline. When a
land's four are found its brass plaque lights and `[E] Read · Plaque` shows that land's fifth line (the other lands'
lines are in their atlas files). **Starseed Isle's fifth line:** "Something kept awake, something carried up,
something written down, something planted. That is how a home is kept."

Furnishing spots (24; items and prices in [side-content.md#nook](./side-content.md#nook)). Class: F floor 1 tile,
R rug decal, W wall, C ceiling hang.

| Spot | Room (c, r) | Class | Spot | Room (c, r) | Class |
|---|---|---|---|---|---|
| f01 | n1 (2, 1) | F | f13 | n1 west wall (0, 2) | W |
| f02 | n1 (3, 1) | F | f14 | n1 west wall (0, 5) | W |
| f03 | n1 (5, 1) | F | f15 | n1 east wall (8, 1) | W |
| f04 | n1 (7, 2) | F | f16 | n1 east wall (8, 2) | W |
| f05 | n1 (1, 3) | F | f17 | n1 south wall (2, 7) | W |
| f06 | n1 (1, 4) | F | f18 | n1 south wall (6, 7) | W |
| f07 | n1 (7, 4) | F | f19 | n1 north wall (1, 0) | W |
| f08 | n1 (1, 5) | F | f20 | n1 ceiling over (2, 2) | C |
| f09 | n1 (2, 5) | F | f21 | n1 ceiling over (6, 3) | C |
| f10 | n1 (6, 5) | F | f22 | n2 (1, 5) | F |
| f11 | n1 (3, 2)-(5, 4) | R | f23 | n2 (5, 5) | F |
| f12 | n1 (5, 5) | F | f24 | n2 ceiling over (3, 3) | C |

Walkway rule: column 4 from `@` to the windows, row 3 to the doorway and the tiles next to `^`, `u` and `X` stay
clear (the compiler test checks no F spot sits on them).

**ART BRIEF `nook_kit`** (set) · a round root-walled room: roots as ribs, warm packed-earth floor, glowroot sconces;
Pip's small bed with a patchwork quilt in leaf greens; a tall wooden plushie cabinet; a little desk; keepsake shelves
carved into the roots with brass plaques · bed 1.2 × 2.2 m, cabinet 2.0 × 2.4 m, shelf 2.0 × 1.6 m · `#6e4526`
`#a8723e` wood, `#7aa63a` `#8fd14f` `#f3e3c3` quilt, `#ffcf8a` glow, `#c9a14a` brass · toon, `occ: true` walls ·
static · ≤ 6,000 tris for the room set · Prompt (concept sheet, reference only): "concept art of a cosy child's
bedroom hollowed inside the roots of a giant friendly tree, round root walls, a small bed with a leaf-green patchwork
quilt, a cabinet full of plush toys, shelves carved into roots holding little keepsakes, warm lantern light,
storybook style" · Window card `nook_window`: 512 × 512 webp, "a forest path seen through a round knot-hole window,
day" and a night version · Fallback: kit boxes, cylinders and lathes in `props-interior-home.js`.

### The five cottages

Template map (house-sized interior; cottages 1-4):

```
#w###w#
#.....#
#.....#
#.....#
#..@..#
###X###
```

The Thistledown Burrow adds Clover's room east through a doorway at (6, 2):

```
main        Clover's room (at: [7, 0])
#w###w#     ##w##
#.....#     #...#
#.....D     D...#
#.....#     #...#
#..@..#     #####
###X###
```

| Cottage | Interior id · card | Fixed pieces (tile) | NPC spot | Displays and side-story hooks |
|---|---|---|---|---|
| 1 | `home_cottage_1` · "Grandpa Dormy's Cottage" / "Shh. Mostly." | fireplace on north wall (3, 0) with the "cozy fire"; armchair (2, 2); four-poster bed (5, 1)-(5, 2); story rug (2..4, 3) | armchair (21:00-23:00), bed otherwise | bookshelf (1, 1) "Dormy's Night Stories": 7 spines light as heard ([side-content.md#ss-02](./side-content.md#ss-02), texts [lore.md](./lore.md)) |
| 2 | `home_cottage_2` · "Nell's Cottage" / "Smells of the sea" | hammock (4, 1)-(5, 1); net-and-float wall; chart table (2, 2) | chart table (evenings) | the **fish tank** on the west wall (1, 2)-(1, 3), empty frame until Fishing tier 3; the **Fish Log board** (24 slots) on the east wall ([side-content.md#act-fishing](./side-content.md#act-fishing)) |
| 3 | `home_cottage_3` · "Hazel's Bakery" / "Mind the flour" | brick oven (3, 0); counter across (1..5, 2) as a solid row with a gap at (5, 2); flour sacks | behind the counter | `[E] Shop · Hazel` (buns, [systems.md#items-tools](./systems.md#items-tools)); the **bun rack** shows one bun type per isle delivered ([side-content.md#ss-05](./side-content.md#ss-05)) |
| 4 | `home_cottage_4` · "Granny Mochi's Cottage" / "Sunny spot taken" | window seat under (1, 0) with a sunbeam; knitting basket; letter desk (4, 1) | window seat | a painting of two kittens (Miso and Kinako, small) on the east wall; the letter desk holds the twins' letters ([side-content.md#ss-03](./side-content.md#ss-03)) |
| 5 | `home_cottage_5` · "The Thistledown Burrow" / "Paws wiped?" | four tiny beds in a row (1..4, 1); long table (2..4, 3); growth chart on the west wall | table | Clover's room: her **windowsill** (window `w` (2, 0)) holds the 5 rainbow shells if her errand is done (glow pink at sundown, the shipped line) and one Dash ribbon per gold course ([side-content.md#act-dash](./side-content.md#act-dash)) |

**ART BRIEF `cottage_kit`** (set) · cosy cottage furniture in chunky rounded shapes: fireplace, armchair, four-poster,
hammock, bakery oven and counter, window seat, tiny beds, tables, shelves, rugs, a fish tank · each piece ≤ 600 tris,
room set ≤ 5,000 · `#a8723e` `#c08850` wood, `#d9783a` brick, `#f3e3c3` cloth, accents per resident (Dormy `#8a7ab8`,
Nell `#3f8ab0`, Hazel `#e8a050`, Mochi `#f2b45a`, Thistledown `#f0b8c8`) · toon · static (fire flickers `glow`
0.6-0.9) · Prompt (concept, reference only): "concept sheet of cosy storybook cottage interiors for small animal
villagers: a dormouse's fireside room, a pelican sailor's net-hung room with a fish tank, a hedgehog's bakery, an
old cat's sunny window seat, a rabbit family's room with tiny beds" · Fallback: the kit in `props-interior-home.js`.

<a id="puddles-grotto"></a>
### Puddle's Grotto, under the well (S-077)

`home_grotto`, card "Puddle's Grotto" / "Drip, drip, splash". Three rooms: g1 at `[0, 0]`, g2 at `[−1, 6]`, g3 at
`[0, 14]`. Every room is dark (ambient 0.25) until the Lantern lights it; Dimlings do not spawn here (an interior).

```
g1 Bucket Landing    g2 Lily Pond       g3 Puddle's Pool
#######              ####D####          ###D###
#..X..#              #t.....t#          #.....#
#..@..#              #.......#          #._P_.#
#t...t#              #__SSS__#          #.___.#
#.....#              #__SSS__#          #..c..#
###D###              #c......#          #######
                     #.......#
                     ####D####
```

- g1 `X` (3, 1): `[E] Climb · Bucket rope` back up to the `well` spawn. `D` (3, 5) is a curtain of sleeping glowbuds:
  it opens for good when the lit Lantern comes within 3 m. The two `t` are wall lamps Pip can `Kindle`.
- g2: the pond rows are water (`_`; stepping in is a splash, Pip reappears at the north door, no harm). `S` are **shy
  stones**: under water until both `t` lamps are kindled, then they rise 0.6 s and stay up (Puddle's line, side
  story). `c` (1, 5) is Puddle's **lost lily pad** (key item for [side-content.md#ss-07](./side-content.md#ss-07)).
- g3: `P` is Puddle's spot on his lily-pad throne in the pool; `c` (3, 4) is the chest with **1 heart petal**, which
  opens when side story 7 is done. Solver: exit and chest reachable from the entry with the Lantern.

**ART BRIEF `grotto_kit`** (set) · a small wet cave of smooth blue-grey rock, drips, ferns, a pool with lily pads,
glowbud curtains (strings of closed pale buds), round shy stepping stones with sleepy faces carved faintly ·
stones 1.6 m, lily pads 0.8-2 m · `#4a5a6a` `#7a8a9a` rock, `#3fa79a` water, `#6aae3a` pads, `#f6f3d8` buds (lit
`#ffe7a0`) · toon; buds `glow` 0 → 0.8 · stones rise 0.6 s · room set ≤ 4,000 tris · Prompt (concept): "a tiny
friendly grotto under a village well, smooth blue-grey rock, a still pool with lily pads, curtains of sleeping pale
glowing buds, round stepping stones peeking out of the water, lantern light, storybook style" · Fallback: kit pieces.

<a id="lighthouse"></a>
### Pinch's Lighthouse inside (S-075; Lookout S-102; the 13th letter S-290)

`home_lighthouse`, card "Pinch's Lighthouse" / "Mind the stairs". Two rooms at different floor heights linked by
`^` stairs (a fade, ENGINE one-level rule).

```
l1 Keeper's Room     l2 Lamp Room
###w###              #######
#.....#              #.....#
#...^.#              #.....#
#.....#              u..O..#
#.....#              #.....#
#..@..#              #.^...#
###X###              #######
```

- l1: Pinch's old hammock, a ship in a bottle, a coil of rope, the chalk tally is on the outside door only. `X` to
  `lighthouse_door`. `^` (4, 2) ↔ l2 `^` (2, 5).
- l2: `O` (3, 3) is the great lamp (solid, `glow` follows the outside lamp state). The **bottle shelf** spans the
  north wall: 12 slots in two rows of six; the shipped bottle sits in slot 12 from S-075 on (save migration sets
  bottle `home:12`); others appear as found ([lore.md#bottles](./lore.md#bottles)). `u` (0, 3), from S-102: the
  door to **Pinch's Lookout**.

**Pinch's Lookout** (a post-deck written by `placeGlideFinds`): a 3.0 × 2.6 m plank platform bolted to the gallery on
bearing 225° (south-west, toward the jetty), deck top at the gallery deck (Y 14.0 on seed 7151: base 0.8 + 1.125 ×
11.73), rope rail on three sides with the outer side open. Spawn `lighthouse_lookout` on it; `[E] Enter · Lamp Room`
at its door. In ch22 Pip and Pinch throw the 13th letter from here ([story.md#ch22](./story.md#ch22)).

**ART BRIEF `lighthouse_inside`** (set) · a round stone keeper's room with a hammock and a ship in a bottle; a lamp
room with a big faceted gold lamp and a curved shelf of bottles; a plank lookout platform with rope rail outside ·
lamp 1.6 m, shelf 2.4 m, lookout 3.0 × 2.6 m · `#fff6e2` `#ff7a6a` walls, `#ffe08a` lamp, `#5a3a24` wood, bottles
`#9fd8c8` glass · toon · lamp rotates 0.2 rad/s · set ≤ 4,500 tris · Prompt (concept): "inside a small striped
lighthouse: a round keeper's room with a hammock, and a lamp room with a big golden lamp and a curved shelf of old
message bottles, storybook style" · Fallback: kit pieces + the shipped lamp colours.

### Miso's back room (the step that finishes side story 3)

`home_miso_back`, card "Miso's Back Room" / "Staff only (and Pip)".

```
#######
#.....#
#.....#
#..@..#
###X###
```

A stitching table (2, 1)-(3, 1) with a half-finished plushie, patterns pinned on the walls (one per plushie sold),
bolts of fabric, a sewing dummy, the bundle of the twins' letters, and the new sign that ends side story 3: it is hung
**under** the shipped "Miso's Shop" sign outside and reads "...and Kinako's (limited edition!!)". The shop's name
does not change. ART: reuse `cottage_kit` pieces; the sign is a `box` with a canvas lettering texture.

---

<a id="finds"></a>
## 7. The tool-gated home finds

CANON §8.2: every tool re-opens at least one home find. These are the places on home a player cannot finish on day
one. Each find is a flag `find:home:<id>` (or a collectible id) and counts on the home Completion group's
**Tool finds** row (see Decisions). Gate objects (hookbloom, soft-earth mound, cloud mote, ivy lattice, bell target,
ice wall, tide stone, star door, glowbud door, thornvine, thornglass) have one look each, defined with their numbers
in [systems.md#gates](./systems.md#gates); this file places them.

### Master list (45 finds + 4 thornvine + 2 thornglass)

| Tool | Finds on home | Rewards |
|---|---|---|
| Glowbud Lantern | Puddle's Grotto; Hollow 1; Hollow 2 | heart petal ×3 |
| Leaf Glider | the Blossom Run; Tern Stack; the Old Stump | 20 gems ×3, acorns a07, a02 |
| Tide Bell | the Storm Cave; tide cache 1; tide cache 2 | acorn a08, 30 gems, fish spot; 25 ×2 |
| Thistle Hook | the Stairfoot route (First Ledge); the Cap Ledge; the Gull's Nest | 20 gems, Starstair foot; acorn a03; 25 gems |
| Sunglass | 12 Sleeping Acorns (5 open, 7 behind other gates); 4 old beacons | saplings; Lamp Logs ×4 |
| Digging Paws | 5 dig spots; the Undercap entrance | acorn a11, 25 + 25 + 20 gems, Shellby's old hat; optional dungeon o2 |
| Starsong | 4 star doors; the moonpath | acorn a05, 30 ×3; Moonmere |
| Ember Sling | the Bell Hollow (behind 4 landmark bells); the Snowglobe ice wall | 60 gems + Lore entry; optional dungeon o1 |
| Ivy Gloves | Great Tree trunk → Crown Balcony; windmill wall; lighthouse wall | vista v4; 25; 25 |
| Cloudstep | the sky nook above the Cairn | acorn a06, 40 gems |
| Shiny Sword | 4 thornvine caches ([#placeThorns](#placeThorns)) | 15 ×4 |
| Starsteel Sword | 2 thornglass thickets | 30 ×2 |

New fixed gem sources on home (for [systems.md#economy](./systems.md#economy)): thornvine 60, glide 60, tide 80,
hook 45, dig 70, star doors 90, Bell Hollow 60, thornglass 60, ivy 50, sky nook 40 = **615 gems**.

<a id="hollows"></a>
### Lantern: the two fairy-ring Hollows (S-073; pass row 7 `placeHollowDoors`, `new RNG(7151 * 89 + 31)`)

Two of the three Woods fairy rings hide Hollow doors in their centre stumps: ring (−16.9, −86.7) → `hollow_home_1`,
ring (23.6, −106.9) → `hollow_home_2`. The third ring (−36.1, −44.8) stays a plain ring (it is a Planting spot,
[#planting](#planting)). The door is a spiral-carved bark panel on the stump's side facing the ring's game trail (the
only draw: which of the two trail-facing quarters when both are clear). When the lit Lantern is within 6 m the
spiral glows; within 3 m the panel slides open in 0.8 s and stays open (flag `find:home:hollow-<n>`). Prompt
`[E] Enter · Fairy ring` ([systems.md#portal-table](./systems.md#portal-table)). Rooms, puzzle and heart petal: [dungeons.md#hollows](./dungeons.md#hollows). Spawns
`hollow_1`, `hollow_2` on the ring floor in front of each stump.

<a id="glide-finds"></a>
### Leaf Glider (S-102; pass row 10 `placeGlideFinds`, `new RNG(7151 * 103 + 43)`)

The pass also writes the **Nook Balcony** deck ([#great-tree](#great-tree)) and **Pinch's Lookout** deck
([#lighthouse](#lighthouse)), the two launch points. Glide model for every check: 6 m/s forward, 2 m/s fall, so
reach = `3 × drop − 1` m.

| id | Launch | Target | Placement rule | Reward |
|---|---|---|---|---|
| `home:blossom-run` | Nook Balcony (Y 11.2) | five blossom rings ending over the plaza's east side | ring i (1-5) centre at the balcony's outer edge + 4.5·i m on bearing 110°, Y = 11.2 − 1.5·i; ring radius 1.4 m; each ring ≥ 1.6 m from every collider (if one fails, the whole line turns in 5° steps up to ±30°) | flying through all five in one glide drops a 20-gem pouch on the pedestal steps; repeatable for fun, paid once |
| `home:tern-stack` | Pinch's Lookout (Y 14.0) | **Tern Stack**, a rock pillar with a flat top | centre `near(lookout edge + 20 m on bearing 225°, 0, 5)` in shallows or sea (`h < 0.2`), ≥ 6 m from the jetty deck and the moonpath line, ≥ 8 m from arena rings and islets, walkable shallows within 4 m (so Pip can step down); `solid: { r: 2.0 }`, top `deck` 3 × 3 m at Y 4.6; glide check from the lookout edge | acorn a07 (placed by row 16) + 20-gem pouch |
| `home:old-stump` | the highest reachable Peaks cell with Y ≥ 9 within 30 m of the Woods boundary on the Peaks' north-west flank (seed 7151: about (77, −43), Y 10) | **the Old Stump**, a giant hollow stump in the Woods with a shelf-fungus top | Woods region, base `h ≤ 4`, centre 6-9 m from the launch toward the Woods; 4.0 m tall, `solid: { r: 2.6 }`, top `deck` 3.4 × 3.4 m at base + 4.0; launch Y − deck Y ≥ 2.5; glide check; no walkable cell with Y ≥ deck Y − 0.85 within 2.5 m of the deck edge | acorn a02 (row 16) + 20-gem pouch |

Blossom rings show only with `ability:glide`. Tern Stack and the Old Stump are always there (a puzzle to look at).

**ART BRIEF `tern_stack`** · a tall rounded sea stack of banded sandy rock with a grassy flat top, a few nesting terns,
barnacles at the waterline · 2.0 m radius, top 4.6 m above the sea · `#d8b890` `#b8946a` bands, `#7aa63a` top,
terns `#ffffff`/`#2a2a2a`, barnacles `#e8e0d0` · toon · terns bob · ≤ 800 tris · Prompt: "a small rounded sea stack of
banded sandy rock with a grassy flat top and a few white terns, barnacles at the waterline, turquoise shallows, cosy
storybook style" · 3D: "low-poly sea stack pillar with grassy flat top, 800 tris" · Fallback: stacked `ico` + `cyl`
top disc.

**ART BRIEF `old_stump`** · a huge old hollow tree stump, mossy, with a wide shelf fungus on top like a table and a
little door-shaped hole at its base (no door) · r 2.6 m, 4.0 m tall · `#6e4526` bark, `#a8723e` cut rings,
`#e8c48a` fungus, `#7aa63a` moss · toon · static · ≤ 900 tris · Prompt: "an enormous old mossy tree stump with a wide
cream shelf fungus growing on top like a little table, a hollow at its base, in a sunny forest, cosy storybook
style" · 3D: "low-poly giant tree stump with shelf fungus top, 900 tris" · Fallback: `lathe` stump + flattened
`sphere` fungus.

**ART BRIEF `blossom_ring`** · a floating wreath of pink and white blossoms with a soft glow, like a hoop · 1.4 m
radius · `#ffb0c8` `#ffffff` `#ffd040` centres · toon + `glow` 0.3; petals drift; passing through bursts petals ·
≤ 300 tris + 1 petal emitter · Fallback: `torus` with blossom vertex colours. The same ring is reused by the finale
glide ([creatures.md#finale](./creatures.md#finale)).

**ART BRIEF `lookout_deck`** · a small plank balcony bolted to a lighthouse gallery, rope rail on three sides, a coil
of rope and a bucket · 3.0 × 2.6 m · `#c8a878` planks, `#5a3a24` brackets, `#e8dcc0` rope · toon · ≤ 400 tris ·
Fallback: `box` planks + `cyl` posts. The **Nook Balcony** uses the same plank kit with root brackets
(`#6e4526`) instead of iron.

<a id="tide-finds"></a>
### Tide Bell (S-122; pass row 13 `placeTideFinds`, `new RNG(7151 * 113 + 59)`)

| id | What | Placement rule | Reward |
|---|---|---|---|
| `home:storm-cave` | **The Storm Cave**: a weathered rock outcrop (7 m wide, 5 m tall, `solid` box) beside the islet-2 bridge with an arched mouth facing the bridge deck; a **tide stone** on islet 1 | outcrop centre `near(midpoint of the islet-2 bridge + 5 m on its south side, 0, 4)` in water, mouth within 1.5 m of the deck edge; tide stone `near(islet 1 centre, 2, 6)` | inside: acorn a08, a 30-gem clam chest, fish spot `home:fish-cave` |
| `home:tide-cache-1` | a rock-pool basin (9 rocks in a ring r 2.6 m, `solid: { r: 2.9 }`) full of water hiding a clam cache; a tide stone 3 m away | `near((−30, 110), 0, 12)`, Shores region, sand | 25 gems |
| `home:tide-cache-2` | the same | `near((60, 100), 0, 12)`, Shores region, sand, ≥ 6 m from the river | 25 gems |

Ringing a tide stone (`[E] Ring · Tide stone` with the Tide Bell) plays the low-tide chord. For the caches: the pool
water drops 1.2 s and one rock rolls aside (its part of the ring collider turns inactive). For the cave: flag
`home:stormLow`, the sea filling the mouth sinks and `[E] Enter · The Storm Cave` appears on the bridge. Both stay so
for good (restoration never reverts). Before: Look at the mouth: "The cave mouth is full of sea. The tide is in."

The Storm Cave (`home_storm_cave`, card "The Storm Cave" / "Only at low tide"):

```
####X####
#...@...#
#.......#
#.__.__.#
#.__.__.#
#a..c..f#
#########
```

`a` acorn a08 on a dry ledge, `c` the clam chest (30 gems), `f` the fish spot facing the two pools (`_`). Walls hung
with old storm-washed things (a Lamplighter oar with a spiral carved on the blade; Look: "An old oar with a spiral on
the blade. Washed in by some storm or other."). Lit by bioluminescent pools (ambient 0.45, `#7be0c8`).

**ART BRIEF `storm_cave_mouth`** · a grey-green weathered rock outcrop with a round arched cave mouth, kelp at the
waterline, a few shells · 7 × 5 m · `#6a7a76` `#8a9a8a` rock, `#3a6a4a` kelp · toon · the water plug lowers 1.2 s ·
≤ 1,000 tris · Prompt: "a weathered grey-green sea rock with a round arched cave mouth at the waterline, kelp and
shells, between two tiny sandy islets, cosy storybook style" · Fallback: `ico` rocks + a dark `cyl` mouth.

**ART BRIEF `tide_pool_cache`** · a ring of rounded beach rocks holding a pool of clear water, a clam-shell box on the
bottom · ring r 2.6 m · `#a8a096` rocks, `#7fd3d0` water, `#ff9f8f` clam · toon · ≤ 700 tris · Fallback: `ico`
rocks + disc.

<a id="hook-finds"></a>
### Thistle Hook (S-143; pass row 14 `placeHookFinds`, `new RNG(7151 * 127 + 61)`)

Hook model: a 14 m line from Pip's eye to the hookbloom with clear line of sight; Pip lands on the deck beside it.

| id | Route | Placement rule | Reward |
|---|---|---|---|
| `home:stairfoot-route` | the Cairn needle: hookbloom H1 on a rock outcrop → **First Ledge** deck → hookbloom H2 on the rim of **the Stairfoot** → the Stairfoot platform | the Stairfoot: a 4 × 3 m Lamplighter stone platform on the summit's east side, centre 4.4 m from the cairn centre on bearing 60°, deck top = summit `h` + 0.1 (seed 7151 about Y 23.4), with a broken stair stub (three steps rising into the air toward bearing 48°); First Ledge: 2.5 × 2.0 m deck on the needle's south-east face, ≤ 12 m line from H2 with sight; H1 beside the First Ledge, ≤ 13 m line from a reachable Peaks plateau cell (seed 7151 about (110, −32), Y 13) | 20-gem pouch on the First Ledge; the Stairfoot itself ([#starstair](#starstair)) |
| `home:cap-ledge` | Grumble's Crown: hookbloom C1 on a shelf fungus half way up the stem → **Stem Shelf** deck → hookbloom C2 on the cap's rim → **the Cap Ledge** | Stem Shelf: 2.2 × 1.6 m deck at Y = base + 0.45H (≈ Y 11.5) on the stem's south-west side (toward the Hollow), C1 reachable from the ground within 12 m line; Cap Ledge: 2.4 × 1.8 m moss deck on the cap rim's top at r = cap radius − 0.6 m, same bearing, Y = base + 0.72H; C2 at its edge, ≤ 10 m line from the Stem Shelf with sight past the rim | acorn a03 (row 16); the best view of the Woods |
| `home:gulls-nest` | from Pinch's Lookout, hookbloom G1 on the lamp-room roof's shoulder → **the Gull's Nest** | a woven nest deck 1.6 × 1.6 m on the coral cone's south-west shoulder, Y ≈ 16.2 (base 0.8 + 1.125 × 13.7); G1 at its rim, ≤ 6 m line from the Lookout | a gull's stash: 25-gem pouch ("Shiny things. A gull's whole collection. The gull looks proud.") |

The Stairfoot is inert until `ch18`: `[E] Look · Old steps`: "Old stone steps climb three steps into the air and
stop. Someone was going somewhere." Hookblooms show from S-143 for everyone (they are just big purple thistles).

**ART BRIEF `stairfoot`** · a weathered pale stone platform jutting from a snowy summit, a spiral carved in its floor,
three steps rising from its far edge into the air and stopping, a small iron ring for lamps · 4 × 3 m, stub 1.6 m
high · `#cfc8bc` `#a8a096` stone, spiral inlay `#8fd8ff`, frost `#f6faff` · toon; spiral `glow` 0.2 (0.8 from
`ch18`) · ≤ 900 tris · Prompt: "an old pale stone platform on a snowy mountain summit beside a crystal cairn, a
spiral carved into its floor, three stone steps that rise from its edge into the air and stop, cosy storybook style"
· 3D: "low-poly stone platform with a spiral carving and a broken floating stair stub, 900 tris" · Fallback: `box`
slab + three `box` steps + a canvas spiral decal.

<a id="dig-spots"></a>
### Digging Paws (S-181; pass row 18 `placeDigSpots`, `new RNG(7151 * 149 + 79)`)

Soft-earth mounds (`[E] Dig · Soft earth`). Visible always (a brown mound with a faint sparkle); before the Paws:
Look "Soft earth. Too packed for paws." After S-181, Digby gives one rumour per talk until all five are heard.

| id | Placement | Digby's rumour (≤ 220) | Reward |
|---|---|---|---|
| `home:dig-windmill` | exactly on acorn a11 (row 16: the windmill's west side, `r + 3` m) | "Something under my windmill snores. Not me. I checked." | acorn a11 |
| `home:dig-glade` | `near(glade (−36.7, −71.9), 4, 9)`, ≥ 3 m from the heart chest | "There's a hollow in the Woods where the soil goes soft as pudding. I'd know. I fell in." | 25-gem pouch |
| `home:dig-peaks` | `near(hc_peaks (75.2, −21.7), 4, 10)` | "Behind the big boulders on the Peaks, the snow's warm underneath. Warm snow is suspicious." | 25-gem pouch |
| `home:dig-dune` | `near((−20, 110), 0, 12)`, Shores sand | "The sand by the islet bridge jingles when you walk on it. Something down there is jingling back." | 20-gem pouch |
| `home:dig-bench` | `near(Shellby's Bench + 2.5 m behind it, 0, 3)` | "Right behind Shellby's bench, the ground sounds hollow. I knocked. Nobody answered. Very rude ground." | **Shellby's old hat** (key item; shown on the Nook hat stand) |
| `home:dig-undercap` | `near(Grumble's Crown centre + (r + 2.5) m on bearing 250°, 0, 3)` (no rumour; Grumble mentions it in side story 11) | - | a root hole: walk-in portal to `undercap` ([dungeons.md#o2](./dungeons.md#o2)) |

Shellby, the first talk after the hat is found: "Oh my. Where did you... I wondered where that went. It never fit me
either, dear. Keep it." (It is the too-big hat young Shellby wears in memory 4, which the player sees later.)

**ART BRIEF `shellby_hat`** · a small floppy explorer's hat, much too big for a small turtle, faded green felt with a
leaf pinned to the band · 0.5 m across · `#5a8a3a` felt, `#c9a06a` band, leaf `#8fd14f` · toon · ≤ 200 tris ·
Prompt: "a small faded green felt explorer's hat with a leaf pinned to the band, a bit dented, cosy storybook style,
isolated" · Fallback: `cyl` brim + `sphere` crown.

<a id="star-doors"></a>
### Starsong (S-208; pass row 20 `placeStarDoors`, `new RNG(7151 * 157 + 89)`)

One star door at each landmark keepsake: a round stone disc (1.4 m) with seven star-shaped holes in a spiral, set flush
into the landmark's base on the keepsake's angle (`W.secrets[i].rot`), so the shipped keepsake stands in front of it.
No draws except a ±0.2 m jitter of the disc's height to sit on the base. Position helper `starDoorSpot(landmark)` is
pure and shared with `placeAcorns` (row 16). The door opens when the Starsong's **Calling** is played within 4 m at
night (21:00-04:00; the Starsong's Dusk at a bench makes night); the disc rolls aside in 1.0 s and stays open
(flag `find:home:stardoor-<landmark>`). Behind each: a 1 m alcove.

| Door | Alcove holds |
|---|---|
| `woods` (Grumble's Crown) | 30-gem pouch |
| `peaks` (the Cairn's east foot) | acorn a05 (its snore is heard through the closed door) |
| `shores` (the lighthouse's sea side) | 30-gem pouch |
| `meadow` (the windmill footing) | 30-gem pouch |

**ART BRIEF `star_door`** · a round pale stone disc set into a wall, seven little star-shaped holes in a spiral that
glow faintly blue at night · 1.4 m across, 0.25 m thick · `#cfc8bc` stone, holes `#9fd8ff` · toon; holes `nightGlow`
0.5, flare to 1.0 for the 1.0 s roll · ≤ 160 tris · Prompt: "a round stone door disc with seven star-shaped holes
arranged in a spiral, glowing faint blue, set into the base of a tower, cosy storybook style" · Fallback: `cyl` disc
+ 7 small emissive star decals (canvas).

<a id="bell-targets"></a>
### Ember Sling (S-227; pass row 21 `placeBellTargets`, `new RNG(7151 * 163 + 97)`)

**Four landmark bells.** A small bronze Lamplighter bell on an iron bracket on each landmark at Y = base + 0.45H, on
the side facing that region's path so it is seen while walking in. Hit with an Ember Sling shot (25 m) it rings and
stays rung (flag `bell:home:<landmark>`). Pitches: Woods C4, Peaks G4, Shores E4, Meadow D4. The Cairn's bell must
be within 25 m and in sight of a reachable cell (seed 7151: the east foot). When all four are rung (any order): a
deep chord across the isle and the toast "✿ Four bells! Something in the Meadow answers."

**The Bell Mound and the Bell Hollow.** A grassy mound (7 m wide, 2.5 m tall, `solid: { r: 3.2 }`) at
`near((−84, −20), 0, 12)`, Meadow region, with a spiral-carved door on the side facing the Meadow path. Closed until
the four bells ring, then `[E] Enter · The Bell Hollow` (`home_bell_hollow`, card "The Bell Hollow" / "Four bells,
one tune"):

```
####N####
#.......#
#.......#
#.......#
W...o...E
#.......#
#...c...#
#...@...#
####X#S##
```

Four bells hang on the walls (`N` Woods carving, `E` Peaks, `S` Shores, `W` Meadow), 6-8 m from the middle; `o` is a
plaque stand: `[E] Read · Plaque`: "Ring us as the sun walks." Solution: **E, S, W, N** (the sun rises in the east,
walks south, sets west; north is the night). A wrong bell chimes and all four reset after 2 s (no harm). Solved: the
chest `c` rises (60 gems) and the Lore tab gains "The Bell Signal" ([lore.md](./lore.md): four bells rung east to north
meant "a boat is home"). Solver: chest reachable.

**The Snowglobe ice wall.** An ice slab (3.2 × 2.6 m) sealing a cave mouth in a rock arch on a Peaks slope face:
`near(arena (114, −19), 26-44 m ring, any bearing)`, Peaks region, a cell whose uphill neighbour within 2 m is ≥ 3 m
higher (so the arch sits in a face), facing a reachable approach, ≥ 5 m outside the arena ring. Three Ember Sling hits
melt it (each hit shrinks it a third, steam puffs; flag `find:home:ice-wall`), then a walk-in portal to `snowglobe`
([dungeons.md#o1](./dungeons.md#o1)). Before: Look "A wall of very old ice. Something big is snoring behind it."

**ART BRIEF `landmark_bell`** · a small bronze bell with a spiral on its waist hanging from a curly iron bracket ·
0.6 m bell, 1.0 m bracket · `#c9a14a` `#8a6a30` bronze, `#3a3a3a` iron · toon metal · swings 20° for 1.5 s when rung ·
≤ 220 tris · Fallback: `lathe` bell + `tube` bracket.

**ART BRIEF `bell_mound`** · a round grassy mound with flowers on top and a small round spiral-carved wooden door in
its side, two stones for steps · 7 m wide, 2.5 m tall · `#7fae4b` grass, `#ffd0e0` flowers, door `#8a5a32` with
`#f5c040` spiral · toon · ≤ 900 tris · Prompt: "a round grassy hillock with wildflowers on top and a small round
wooden door with a golden spiral carved on it, in a sunny flower meadow, cosy storybook style" · Fallback: flattened
`sphere` + `cyl` door.

**ART BRIEF `ice_wall`** · a slab of old blue ice filling a rough stone arch, bubbles frozen inside, frost at the edges
· 3.2 × 2.6 m in a 4.4 × 3.6 m arch · `#9fdcff` `#cfe8ff` ice, `#a8a096` stone · toon, ice `glow` 0.15 · melts in
three steps · ≤ 600 tris · Fallback: `box` slab (transparent blue) in `ico` stones.

<a id="thornglass"></a>
### Starsteel: thornglass (S-233; pass row 22 `placeThornglass`, `new RNG(7151 * 167 + 101)`)

| id | Placement | Cache |
|---|---|---|
| `home:thornglass-woods` | `near((−20, −118), 0, 12)`, Woods region (the north beach behind the Hollow) | 30 gems |
| `home:thornglass-meadow` | `near((−118, 20), 0, 12)`, Meadow region (the west coast) | 30 gems |

A thicket ring like thornvine (`solid: { r: 1.9 }`) of glassy blue-violet thorn crystals; only `swordLevel 3` cuts it
(it shatters into sparkles that fade; flag `thorn:home:<id>`); lower swords: "Too tough for this sword." Prop look
in [systems.md#gates](./systems.md#gates).

<a id="ivy-finds"></a>
### Ivy Gloves (S-248; pass row 23 `placeIvyFinds`, `new RNG(7151 * 173 + 103)`)

| id | Lattice | Top | Reward |
|---|---|---|---|
| `home:ivy-tree` | a 1.4 m wide ivy strip on the Great Tree's west face (`az` −1.55), from the root flare to the Crown Balcony | the **Crown Balcony** deck ([#great-tree](#great-tree)) | vista `home:v4` |
| `home:ivy-windmill` | a strip up the windmill tower's north face (away from the sails), base to a ledge under the cap | 1.6 × 1.2 m ledge deck at base + 9.0 m (Y ≈ 12.8), view west over the sea | 25-gem pouch |
| `home:ivy-lighthouse` | a strip up the lighthouse's south face beside the portholes, from the sand to the gallery, with a porthole ledge on the way | porthole ledge 1.2 × 1.0 m at the upper porthole (Y ≈ 8.3); the strip continues to Pinch's Lookout (a second way up) | a tin box: 25 gems and a note "Pinch's emergency biscuits. Do NOT eat. — P." (the biscuits stay) |

Climb 1.5 m/s on the lattice face (systems). The ivy is drawn from S-248 for everyone.

<a id="sky-nook"></a>
### Cloudstep: the sky nook (S-268; pass row 25 `placeSkyNook`, `new RNG(7151 * 181 + 109)`)

From the Stairfoot's north-east edge, three **cloud motes** in a line on bearing 48° (toward the sky isle), 3.6 m
apart, tops at Stairfoot Y + 1.2, + 2.0, + 2.8; then **the sky nook**: a cloud-puff `deck` 3 × 3 m at Stairfoot Y +
3.2, 14 m from the Stairfoot edge. A mote gives one extra 0.85 m hop within 4 m (systems). Motes bob ±0.2 m at
0.3 Hz. Reward: acorn a06 and a 40-gem pouch. From the nook Pip sees all three Starstair flights side-on.

**ART BRIEF `sky_nook`** · a flat-topped fluffy cloud with a few tiny star-flowers growing in it · 3 × 3 m top,
1.2 m thick · `#f7f2ff` `#c9b6ec` cloud, flowers `#ffe9a8` · toon cloud, soft edges · bobs 0.1 m · ≤ 500 tris ·
Prompt: "a small fluffy flat-topped cloud you could sit on, a few tiny glowing star-flowers growing in it, high above
a snowy summit, cosy storybook style" · Fallback: clustered `sphere` puffs with a flat top deck.

---

## 8. Collections, benches, activities and village dressing

<a id="acorns"></a>
### Sleeping Acorns on home (S-161; a06 in S-268; pass row 16 `placeAcorns`, `new RNG(7151 * 137 + 71)`)

Twelve acorns (`S.collect.acorn['home:aNN']`). Cue: a soft snore loop audible within 10 m and a tiny "z" sprite
within 6 m (works in first person with no on-screen marker). Wake: hold the Sunglass beam on it for 1.5 s → it
uncurls, yawns and grows a **sapling** (scale 0 → 1 in 2 s) that stays for good. Positions that depend on later passes
use pure helpers so this pass never waits for them.

| id | Region | Placement | Gate |
|---|---|---|---|
| a01 | Woods | `near(glade (−36.7, −71.9), 3, 10)`, ≥ 3 m from the heart chest | open |
| a02 | Woods | on the Old Stump deck (row 10) | Glider |
| a03 | Woods | on the Cap Ledge (row 14) | Hook |
| a04 | Peaks | `near((88, 10), 0, 12)`, Peaks plateau | open |
| a05 | Peaks | the Cairn star door's alcove, `starDoorSpot('peaks')` | Starsong |
| a06 | Peaks | the sky nook deck centre, `skyNookSpot()` (appended in S-268) | Cloudstep |
| a07 | Shores | Tern Stack top (row 10) | Glider |
| a08 | Shores | inside the Storm Cave (`realm: home_storm_cave`, tile `a`) | Tide Bell |
| a09 | Shores | `near(islet 2 (−60, 151), 0, 5)`, ≥ 2.5 m from the chest and shell 3 | open |
| a10 | Meadow | `near(sunflower ring (−98.5, 27.3), 3, 9)`, ≥ 2.5 m from the chest | open |
| a11 | Meadow | windmill west side, `near(windmill + (r + 3) m on bearing 270°, 0, 3)`; buried (the dig mound sits on it) | Paws |
| a12 | Village | `near(village pond (−13, 25), 5, 9)`, in the reeds on land | open |

**ART BRIEF `acorn_sleeping`** · a plump acorn with a little cap, eyes closed, a tiny snore bubble · 0.25 m ·
`#c08850` body, `#7a5a30` cap, blush `#ff9f9f` · toon · breathes (scale 1-1.04 at 0.3 Hz); wakes with a yawn ·
≤ 120 tris · Prompt: "a plump sleeping acorn with a little cap, eyes closed, rosy cheeks, a tiny snore bubble,
cute storybook style, transparent background" · Fallback: `sphere` + `lathe` cap. **`acorn_sapling`** · a young tree
1.2 m tall with two big leaves and one small gold bud, bark `#8a5a32`, leaves `#7aa63a`/`#a8dc5a`, bud `#ffe9a8`,
≤ 200 tris, sways 0.04 rad; fallback `cyl` + two flattened `sphere` leaves. Both are shared with every land.

<a id="old-beacons"></a>
### The four old Lamplighter beacons (S-169; pass row 17 `placeOldBeacons`, `new RNG(7151 * 139 + 73)`)

A ruined beacon stands near each landmark: a 1.4 m stone plinth with a cracked lamp cage on top and a spiral-etched
crystal **receiver** on its face. Placement: `near(landmark + (r + 6) m on the bearing toward the Great Tree, 0, 6)`;
for the Cairn (unreachable on that side) the bearing is toward its keepsake and the ring widens to `r + 20`. Hold the
Sunglass beam on the receiver 1.0 s: the lamp lights soft gold for good, a drawer slides out of the plinth and a
**Lamp Log** pops up (`home:log1` Woods, `home:log2` Peaks, `home:log3` Shores, `home:log4` Meadow; texts are the
four home logs in [lore.md#lamp-logs](./lore.md#lamp-logs)). In the Remembered Isle the same four beacons stand whole
and lit on the landmarks' tops. Model: the ruined variant of the beacon in the shared Lamplighter kit
([atlas-isles.md#shared](./atlas-isles.md#shared)), `solid: { r: 0.7 }`.

<a id="vistas"></a>
### Vistas and Hoot's Board (S-076; pass row 8 `placeVistas`, `new RNG(7151 * 97 + 37)`)

**Hoot's Board**: a corkboard on two posts (2.2 × 1.4 m, `solid` box 2.2 × 0.4) at the plaza edge, bearing 300°,
r 13-17. `[E] Read · Hoot's Board` shows the sketches pinned so far (30 slots, 6 × 5) and Hoot's caption for the
next chapter. A **vista post** is Hoot's little signpost with an owl-eye icon; standing within 1.5 m with the view
inside ±20° yaw and ±15° pitch of the target offers `[E] Sketch · <view>`.

| id | Name (prompt label) | Post placement | Look at | Reach |
|---|---|---|---|---|
| `home:v1` | The Isle from the Bridge | `near(Peaks bridge east end (54.7, 2.2) + 3 m east, 0, 4)` | the Great Tree, pitch +6° | open |
| `home:v2` | The Lighthouse from Islet 1 | `near(islet 1 (−40, 139), 0, 5)` | Pinch's Lighthouse, pitch +8° | open |
| `home:v3` | Where the River Starts | `near(source pond (37, −78) south edge, 6, 9)` | down the river toward the Peaks bridge, pitch −4° | open |
| `home:v4` | From Wenna's Crown | the Crown Balcony (row 23 deck; the post is placed by S-248, the vista's data ships in S-076) | west over the Meadow to the sea, pitch −10° | Ivy Gloves |

Sketch images (512 × 512 webp, a pencil-and-wash sketch on Hoot's notebook paper, canvas fallback = the camera frame
drawn through an ink-outline shader into a canvas):
- v1: "a loose pencil-and-watercolour field sketch of a small island village seen from a wooden bridge, a giant
  friendly tree in the middle, notebook paper with a tiny owl doodle in the corner"
- v2: "a pencil-and-watercolour field sketch of a striped cream-and-coral lighthouse on a beach seen from a tiny
  islet, notebook paper"
- v3: "a pencil-and-watercolour field sketch of a small forest pond where a stream begins and winds away toward snowy
  hills, notebook paper"
- v4: "a pencil-and-watercolour field sketch looking down from high in a great tree over a flower meadow with a
  windmill and the sea beyond, notebook paper"

**ART BRIEF `hoots_board`** · a wooden corkboard on two posts with a little roof, pinned sketches and a brass owl
knob · 2.2 × 1.4 m board, 2.3 m tall · `#a8723e` wood, `#c9a06a` cork, `#c9a14a` brass · toon · ≤ 300 tris ·
Fallback: `box` board + posts. **`vista_post`** · a short post with a round sign painted with an owl eye, 1.3 m,
`#6e4526`, sign `#f6e6c8` with `#5a3a24` ink, ≤ 80 tris; fallback `cyl` + disc with a canvas eye. Shared with every
land.

<a id="benches"></a>
### Home benches (S-082; pass row 9 `placeBenches`, `new RNG(7151 * 101 + 41)`)

Lamplighter benches (`[E] Sit · Bench`, fast travel, with the Starsong also Dawn/Dusk). Model in the shared kit
([atlas-isles.md#shared](./atlas-isles.md#shared)). Each faces its listed view.

| id | Name | Placement | Faces |
|---|---|---|---|
| `home:bench-1` | **Shellby's Bench** | `near((−6.5, 9.5), 0, 3)`, plaza, off the z = 9 test line by ≥ 1.2 m | the Great Tree |
| `home:bench-2` | the Woods bench | `near(Hoot's spot (4.3, −61.6) + 4 m east, 2, 6)` | the Woods path |
| `home:bench-3` | the Peaks bench | `near(Peaks bridge east end + 6 m, 2, 8)` | the river |
| `home:bench-4` | the Shores bench | `near(jetty root + 3 m north, 0, 4)` | the jetty and the sea |
| `home:bench-5` | the Meadow bench | `near(windmill + (r + 5) m on bearing 150°, 0, 5)` | the windmill |

Shellby's Bench also carries `home:portal-night` after `ch22` ([#hundred-year-night](#hundred-year-night)).

<a id="courses"></a>
### Activity courses (pass row 11 `placeCourses`, `new RNG(7151 * 107 + 47)`; append-only)

Rules and tiers live in [side-content.md](./side-content.md); this is geometry.

| id | Activity | Step | Geometry |
|---|---|---|---|
| `home:course-dash` | Clover's Dash, home course | S-112 | start post at the plaza edge, bearing 260°, r 17-20; 10 ring gates (r 1.6 m, 2.4 m tall arches of ribbon) along the Meadow path, each 6-10 m off the path alternately left and right, ≥ 9 m apart; finish post by `home:bench-5`; length ≈ 115 m; par gold 38 s, silver 50 s |
| `home:course-regatta` | the Duck Regatta | S-136 | start at the jetty root; 8 buoy flags in walkable shallows (`h` −0.4 to 0.2) along the beach westward, ≥ 8 m apart; finish at the islet-1 bridge foot; the ducks' guide line 6 m further out to sea |
| `home:course-sled` | Sledding with Frostbun | S-158 | start = the highest reachable Peaks cell within 25 m of (125, 0) outside the arena ring; the run follows the steepest walkable descent for 120-160 m; 8 flag gates every ~15 m; finish board at the bottom |

Spore Rally uses Grumble Shroom's arena (no placement). **ART BRIEF `course_gate`** · a ribbon-wrapped hoop of bent
willow on two pegs, a pennant on top · 3.2 m wide, 2.4 m tall · ribbons `#ffb0c8` `#9fdcff` `#ffe27a` · toon ·
pennant flutters · ≤ 150 tris · fallback `torus` + `cone` pennant. Buoys and sled flags reuse it scaled.

<a id="fish-spots"></a>
### Fish spots (S-207; pass row 19 `placeFishSpots`, `new RNG(7151 * 151 + 83)`)

| id | Where | Placement |
|---|---|---|
| `home:fish-jetty` | off the jetty's T-head | the T-head's south edge, facing south |
| `home:fish-woods` | the river's source pond (37, −78) | `near(pond edge, 0, 3)` on its north-west shore |
| `home:fish-meadow` | the big Meadow pond (−70.6, 21.8) | `near(pond edge, 0, 3)` on its south shore |
| `home:fish-cave` | the Storm Cave pools | interior tile `f` |

A spot is a ripple ring on the water (`[E] Fish`); species tables in [side-content.md#act-fishing](./side-content.md#act-fishing).

<a id="grove"></a>
### For Spring: the golden sprouts and the golden grove (S-114, S-193; pass row 12 `placeGrove`, `new RNG(7151 * 109 + 53)`)

Grove centre G = `near((−84, 12), 0, 15)` with a clear disc of r 7 m (no solids, chests, ponds, paths within it).
Nine spots on a circle r 5 m round G (each nudged ≤ 1 m to pass `ok()`), plus G itself.

| Flag (side story 1) | What shows |
|---|---|
| ss-01 part 1 done (S-114) | nine **golden sprouts** (0.4 m, gold leaves) on the circle |
| ss-01 done, after side story 33 (S-193) | the sprouts are nine **golden saplings** (2.2 m); a **golden tree** (4.5 m) stands at G with gold leaves and cream blossom; a little sign at its foot: `[E] Read · Sign`: "For Spring. — D." |

**ART BRIEF `golden_tree`** · a young round-crowned tree with gold leaves and cream blossoms, the same gold as the
Great Tree's blossoms · 4.5 m (saplings 2.2 m, sprouts 0.4 m share the look) · `#ffe9a8` `#f5c040` leaves, `#fff6e2`
blossom, `#a8723e` bark · toon, leaves `glow` 0.15 · sway 0.03 rad · ≤ 900 tris (sapling 300, sprout 60) · Prompt:
"a young round tree with shining gold leaves and cream blossoms in a sunny flower meadow, cosy storybook style" ·
Fallback: `cyl` trunk + `sphere` crowns.

<a id="village-works"></a>
### Ribbit's Village Works (S-157; pass row 15 `placeVillageWorks`, `new RNG(7151 * 131 + 67)`)

Eight projects, 250 gems each, funded at the **Village Works board** (`near(plaza bearing 60°, r 14-17)`, the same
board model as Hoot's in blue paint; `[E] Read · Village Works`). Funding sets `works:<id>`; the build appears at once
with a ribbon and the toast "✿ Village Works: <name> is open!", then Ribbit's line on next talk.

| id | Name | Placement | Size and parts | Ribbit (≤ 220) |
|---|---|---|---|---|
| `bandstand` | The Bandstand | plaza edge bearing 240°, r 18-23, clear disc r 3.2 | octagonal wooden bandstand 6 m wide, 4.5 m tall, `deck` 0.6 m up with two steps, roof `over`; the ducks sing there 18:00-20:00 | "I hereby declare this bandstand... banded. Stood. Bandstood. Ribbit!" |
| `duckdock` | The Duck Pond Dock | village pond (−13, 25) north rim | a 1.2 × 4 m `deck` into the pond and a little duck house | "A dock for the ducks. They asked very loudly." |
| `bridge` | The Ribbit Bridge | the river crossing nearest (49, −17) on the river spline | footbridge `deck` w 2.2 m, length = river width + 4 m, arched 0.6 m; joins the Woods side to the Peaks' north | "I shall name it the Ribbit Bridge. Nobody else suggested a name. I checked. Twice." |
| `lanternrow` | Lantern Row | one paper lantern by each cottage door and by each of the 9 waymarkers (anchored, no draws) | 14 lanterns lit at night | "Every cottage gets a lantern! Now nobody can say they couldn't find their own door. Looking at you, Dormy." |
| `stage` | The Festival Stage | plaza edge bearing 130°, r 20-25, clear 5 × 4 m | a stage `deck` 5 × 4 m, 0.8 m up, steps, bunting; used by the ending festival and the Hundred-Year Night | "A stage! For speeches. Mostly mine. Croak." |
| `swing` | The Meadow Swing | `near(sunflower ring (−98.5, 27.3), 8, 16)`, next to a round tree | a rope swing; `[E] Sit · Swing` sways Pip gently | "I tested the swing myself. It is very safe. My hat is still up that tree." |
| `starplatform` | Hoot's Star Platform | `near((112, 20), 0, 12)`, Peaks plateau, ≥ 5 m outside the arena ring | round timber platform 4 m, `deck` 0.5 m up, a brass telescope: at night `[E] Look · Telescope` shows a painted close-up of the sky isle (later the Ladder, then Mote's star) | "Professor Hoot says he can count the stars better from up there. I said, count them for the town treasury." |
| `hut` | The Warming Hut | beside the sled run's start, `near(course-sled start, 4, 10)` | a tiny log hut with a covered porch and a stove (`solid` box); standing on the porch: "Toasty." | "A warm hut at the top of the Peaks. Frostbun says it's too warm. Everyone else says it's perfect." |

**ART BRIEF `works_kit`** (set) · storybook village builds in fresh-cut timber with Sprout Village's cream and green
trim: an octagonal bandstand, a duck dock and duck house, an arched footbridge, paper lanterns on posts, a bunting
stage, a rope swing, a round star-gazing platform with a brass telescope, a tiny log hut with a stove · bandstand
≤ 1,500 tris, others ≤ 800 each · `#c08850` `#e8c890` timber, `#7aa63a` `#f3e3c3` trim, `#ffb0c8` bunting ·
toon · lanterns `nightGlow` 0.7 · Prompt (concept): "concept sheet of small cosy village builds for a storybook
island: an octagonal wooden bandstand, a tiny duck dock with a duck house, an arched wooden footbridge, a festival
stage with bunting, a rope swing, a round star-gazing platform with a brass telescope, a little log warming hut" ·
Fallback: kit pieces in `js/props.js`; telescope views `telescope_view_isle|ladder|star` (1024 × 576 webp, painted
close-ups; canvas fallback: the sky sprite scaled up).

<a id="planting"></a>
### The Planting (S-291; pass row 26 `placePlanting`, `new RNG(7151 * 191 + 113)`)

Side story 53: Wenna's new seed goes to one of four home spots; the player picks; no wrong answer
([side-content.md#ss-53](./side-content.md#ss-53)). During the choice each spot shows a faint gold seed-glow.

| id | Spot | Placement |
|---|---|---|
| `p1` | by the golden grove | `near(G + 9 m on bearing 90°, 0, 4)` |
| `p2` | the first fairy ring | `near(clearing (−36.1, −44.8), 2.5, 4)` beside its stump |
| `p3` | by the warm spring | `near(home:heal-spring + 3 m, 0, 3)` |
| `p4` | by Nell's Jetty | `near(jetty root + 6 m east, 0, 4)` |

The chosen spot (`planting:<1-4>`) grows **Wenna's Seedling**: 2.4 m, silver-green bark `#b8c8a8`, two-tone leaves
`#a8dc5a`/`#fff6e2`, one lantern-shaped bud that glows at night. ≤ 400 tris; fallback `cyl` + `sphere` crown.

---

<a id="starstair"></a>
## 9. The Starstair foot (S-143 inert, S-212 flights, S-264 climb; pass row 24 `placeStarstair`, `new RNG(7151 * 179 + 107)`)

The Stairfoot platform and the hook route to it come from row 14 ([#hook-finds](#hook-finds)). Row 24 adds:

- **The ivy route** (S-264): an ivy lattice from a reachable Peaks plateau cell up the needle's south face to the
  Stairfoot's edge (the Gloves' alternative to the two hooks; it ships with S-264 even though the Gloves come in
  S-248, so either tool order works).
- **The climb portal** (S-264): at the stair stub, `[E] Climb · The Starstair` (needs `ch18` started) fades to
  `driftholm` · `stair_top` ([atlas-far.md#driftholm](./atlas-far.md#driftholm)). Return spawn `stairfoot`.
- **The flights** (S-212, one per Stair Stone; meshes, not decks, not in prints): flight k (1-3) is nine floating stone
  slabs (2.4 × 1.2 × 0.35 m) rising 1.35 m per step along bearing 48° from the stub top; flight 2 starts 3 m past
  flight 1's last slab, flight 3 likewise, so the top slab is about Y 23.4 + 3 × 12.2 + 2 × 1.4 ≈ Y 63, pointing at
  the sky isle. Each slab bobs 0.1 m at 0.25 Hz (phase by index) with edge trim `#ffe9a8` at `glow` 0.5. Flight k
  appears when `stones ≥ k`: it rises from below the summit in 4 s while the camera (if Pip is home) is offered a
  look. Seen from other realms as the `sky_starstair` sprite under the sky isle ([art-audio.md](./art-audio.md)).
- At `ch18` the Stairfoot's spiral lights (`glow` 0.8) and a soft beam (additive column, 0.6 m wide) joins the top
  slab to the sky isle, visible from everywhere on home; it stays for good.

**ART BRIEF `star_slab`** · a floating slab of pale Lamplighter stone with rounded edges, a spiral inlaid on top, a
faint gold rim of light underneath · 2.4 × 1.2 × 0.35 m · `#cfc8bc` stone, `#ffe9a8` rim, spiral `#8fd8ff` · toon ·
bobs · ≤ 60 tris (27 slabs, one instanced draw) · Prompt: "a floating slab of pale stone with soft rounded edges and a
spiral inlaid on top, a faint golden glow underneath, part of a stair into the sky, cosy storybook style" ·
Fallback: `rbox` slab.

---

## 10. Home variant realms

Variant realms reuse `generateWorld(7151)` (same prints as home, unit-tested) with a new skin and their own variant
pass (rows v1-v3). Home post-passes still run (their items exist); the variant decides which to show. ENGINE §2.1.

<a id="remembered-isle"></a>
### The Remembered Isle (`remembered`; skeleton S-188, memories S-190 onward)

Home a hundred years ago, in Wenna's memory. Entered only from the memory knots on the Taproot in the Rootdeep
([atlas-far.md#rootdeep](./atlas-far.md#rootdeep)); `[E] Touch · Memory`. No enemies anywhere; nobody can be hurt;
dizzy cannot happen (no attacks exist).

**Skin.** Palette sky top `#d9c49a`, horizon `#f2e4c0`, fog `#e9d8b0` (near 60 m, far 280 m), sun `#ffd9a0`,
hemisphere sky `#fff0d0` ground `#6f5a44`, water `#b8a06a` deep to `#e2c9a0` shallow; a realm tint uniform `uTint`
`#e9d8b0` at 0.35 over every toon material (no new terrain textures); music: the music-box village theme
([art-audio.md](./art-audio.md)). Scatter: unchanged. Hidden in this realm: every home post-pass item (rows
1-29) except the Stairfoot (shown whole, it was new then) and the old beacons (shown whole on
the landmark tops, below), plus the shop, bunting and parade lanterns. Cottage roofs swap to thatch `#c9a46b`.

**Variant pass v1** (`new RNG(7151 * 193 + 127)`) adds:
- **Scaffolds** round the Great Tree: three timber rings at tree-local 4, 8 and 12 m with ladders between (no
  collider; seen, not climbed), lamps hanging from them.
- **Whole beacons**: the four old beacons ([#old-beacons](#old-beacons)) stand whole and lit on top of each landmark
  (on the Cairn's crystal, the lighthouse cap, the Crown's crown, the windmill cap) as a lamp cage glowing
  `#ffcf6a`.
- **The intact Starstair**: all three flights plus a fourth into the sky, glowing, from the Stairfoot.
- **The Lamplighter market**: six moth-folk stalls (awnings, lamps for sale) in a ring on the plaza at r 10-14,
  bearings 30° to 330° every 60°, each nudged to `ok()`.
- **Lamp posts** at the nine waymarkers.
- **Four Remembered acorns** `remembered:a01-a04`: `near(plaza stall 1, 2, 5)`; `near(clearing (−36.1, −44.8), 2, 6)`;
  `near(memory 6 finish line, 2, 6)`; `near(windmill + (r + 4) m on bearing 90°, 0, 4)`. Woken with the Sunglass
  as on home.

**Memories** (texts [lore.md#memories](./lore.md#memories), beats [story.md#ch13](./story.md#ch13) and
[story.md#stone-beats](./story.md#stone-beats), cast looks [cast.md#young-cast](./cast.md#young-cast)). Each memory is
a scene script played in this realm from its spawn; afterwards the player may walk freely in that memory's state
until they touch the gold mote (`[E] Touch · Memory`) to return to the Taproot. Each memory also places three echoes
across the isle, and memories 3, 6, 7 and 12 carry the four vignettes (The Lamp Path, The Tide Race, Down the Ladder,
The Last Lamp); placements and rules are in [lore.md#memory-play](./lore.md#memory-play),
[lore.md#memory-echoes](./lore.md#memory-echoes) and [lore.md#memory-vignettes](./lore.md#memory-vignettes), which win
over the table below (R30).

| Id | Memory | Spawn | Time | Who is placed (positions) | What Pip does |
|---|---|---|---|---|---|
| m01 | The Lamplighters on the Cairn | the Stairfoot | 21:00 | five Lamplighters on the first flight carrying a Starseed, singing | watches; may walk the Stairfoot |
| m02 | A streak to the sky isle | plaza, by the pedestal | 22:00 | Lamplighters at the stalls pointing NE; Wenna's young face turns | looks NE: a streak of light falls onto the sky isle |
| m03 | Building the Ladder | Peaks plateau below the Stairfoot route | 17:00 | moth-folk on a lamp-hung scaffold ladder climbing from the Stairfoot into the sky; young Granny Wick (12) passing lamps up | follows the lamp chain up to the Stairfoot |
| m04 | Young Shellby and the three Catchers | three short vignettes (20 s each, a fade between): Grumble's arena, Pinch's cove, Frostbun's summit | 09:00 | young Shellby (walks ahead); a small cheerful Grumble; a Pinch with no hat; a rabbit-sized Frostbun, each in its arena centre | walks behind Shellby; each Catcher hands a seed over after a bow |
| m05 | Young Granny Wick | plaza stall 3 | 19:00 | young Wick lighting the six plaza lamps one by one along a route | may follow her lamp to lamp |
| m06 | The race on the beach | Shores beach, by the islet-1 bridge foot | 15:00 | young Shellby and young Pelagia racing to the lighthouse door (90 m) | may race too; nobody loses |
| m07 | Mote comes down | plaza | 23:00 | the Ladder of Lights complete from the sky into the crown; Mote descends and lands by the pedestal | watches from the plaza |
| m08 | He asks | pedestal | 23:10 | Mote at the pedestal facing the Tree | listens |
| m09 | "Who would they wake up next to?" | pedestal | 23:20 | Mote; Wenna; villagers' lit windows | watches Mote climb back up |
| m10 | The storm, from far away | Shores beach | 02:00, storm (rain, wind, no lightning flashes) | everyone indoors (lit windows); the Ladder far off over the Peaks breaking into falling lamps; Mote's light still glowing on the sky isle | watches; the scene says nobody was hurt |
| m11 | The stones fall | the Cairn's east foot | 02:30 | three lights fall out to sea at bearings 292.5°, 67.5° and 202.5° (where crown lanterns L5-L7 hang) | watches |
| m12 | A letter by lamplight | the lighthouse's sea side, at the shipped bottle keepsake spot | 05:00 | a young turtle writing by a lamp on the lighthouse step, then rolling the letter into a bottle and tucking it among the rocks | watches; the game never names him |

**ART BRIEF `remembered_kit`** (set) · timber scaffold rings with ladders and hanging lamps; moth-folk market stalls
with patched awnings; whole Lamplighter beacon cages; lamp posts · scaffold ≤ 2,000 tris, stall ≤ 500, cage ≤ 200 ·
`#b8894a` timber, `#e9d8b0` canvas, `#6f5a44` ink, lamps `#ffcf6a` · toon + `uTint` · Prompt (concept, reference
only): "concept painting of a small island village a hundred years ago in warm sepia and gold, moth-folk lamplighters'
market stalls around a giant friendly tree wrapped in timber scaffolds with hanging lamps, a stone stair floating up
from a snowy summit into the sky, storybook style" · Fallback: kit boxes and cylinders.

<a id="moonmere"></a>
### Moonmere (`moonmere`; S-218, letters S-219)

The home isle as Mote imagined it from the sky for a hundred years: silver, still, a little bit wrong. Opened by the
moonpath off Nell's Jetty ([#placeJetty](#placeJetty)) after the Sunken Bell is done. Spawn `moonpath` on Moonmere's
jetty T-head; the far end of Moonmere's moonpath (a walk-in trigger) leads back to home `jetty_end` at any time.
Dizzy wakes Pip at the Moon Tree.

**Skin.** Always night (time frozen at 00:30). Sky top `#2a3358`, horizon `#5a6a9a`, fog `#3a4670` (near 40 m, far
220 m), moon light `#f6f3d8` at 0.9 and the moon disc 2.5× size, low in the south; hemisphere sky `#cfd8ee` ground
`#2a3358`; `uTint` `#cfd8ee` at 0.5; water `#1e2848` with bright glitter; round-tree leaves and palm fronds silver-white;
flowers swapped to pale bell-flowers; drifting silver motes instead of fireflies. Music: a slow celesta village theme.

**Slightly wrong, as seen from far above** (variant pass v2, `new RNG(7151 * 197 + 131)`): every cottage wears the
same roof; the windmill has six sails; the signpost has one extra arm pointing straight up that reads "HOME"; the
lighthouse's stripes run the wrong way round. No NPCs.

**The Moon Tree**: the Great Tree in silver (`#e8eef8` bark tint, leaves `#cfd8ee`, `glow` 0.3), eyes closed, hung
with 40 **scrap lamps** (jam jars, tin cans, a teapot, a colander, a lantern with a cracked pane), one instanced draw.

**Twelve moon-lanterns** (silver lanterns on posts, unlit; `[E] Kindle · Moon-lantern` with the Lantern; counter toast
"Moon-lanterns 5/12"), anchored: the moonpath landing; the plaza signpost; one in front of each landmark (4); one
at each arena's gate (3); one in each fairy ring (3). Each is `near(anchor, 0, 4)` by `ok()`. All twelve lit → the
Mirror Garden wakes (toast "✿ The mirrors are shining.").

**The Mirror Garden** (plaza): 12 oval standing mirrors (1.6 m) in silver frames on a ring r 11 m round the Moon Tree's
trunk (0, −1.5), every 30° from bearing 15°, each nudged ≤ 1 m to clear the pedestal. Each holds one of Mote's twelve
unsent letters ([lore.md#mote-letters](./lore.md#mote-letters)): `[E] Read · Mirror` (side story 47,
[side-content.md#ss-47](./side-content.md#ss-47)). Before the garden wakes: Look "A mirror. It only shows the moon."

**The bottle**: `moonmere:bottle` on islet 2's beach, `near(islet 2, 0, 5)` (which of the twelve:
[lore.md#bottles](./lore.md#bottles)).

**Enemies** (village region none, as on home): Hushlings ([creatures.md#enemy-hushling](./creatures.md#enemy-hushling))
and silver swaps of the six home species (+1 HP each, same tells). Weights: Woods Hushling 3, silver slime 3, silver
shroomlet 2, silver bat 2; Peaks Hushling 2, silver snowpuff 3; Shores Hushling 2, silver crab 3; Meadow Hushling 3,
silver bee 2, silver bat 2. Caps as home (7 / 6 / 6 / 6).

**ART BRIEF `moon_tree_lamps`** · scrap lamps made from jam jars, tin cans, a teapot and a colander, each with a little
light inside, hung on string · 0.2-0.4 m · `#cfd8ee` tin, `#9fd8c8` glass, light `#f6f3d8` · toon + `glow` 0.8 · sway
· ≤ 80 tris each · Prompt: "a set of small homemade lamps made from jam jars, tin cans, a teapot and a colander,
softly glowing silver-white, hanging from strings, cosy storybook style, transparent background" · Fallback: `cyl`
jars with emissive cores.

**ART BRIEF `moon_lantern`** · a slim silver lantern on a curly silver post, crescent-moon finial · 1.8 m · `#e8eef8`
`#8a96b8`, light `#f6f3d8` · toon · ≤ 200 tris · Fallback: `cyl` post + `box` cage. **`mirror_plinth`** · an oval
standing mirror in a silver vine frame · 1.6 m · frame `#cfd8ee`, glass reflecting a painted moonlit sky
(`mirror_face`, 256 × 512 webp) · ≤ 150 tris · fallback: frame `torus` + a flat emissive glass.

<a id="hundred-year-night"></a>
### The Hundred-Year Night (`night`; S-288, ch22 S-289-S-290)

Home at night on the true-ending night: the Starkin come down a ladder of given light, everybody is in the plaza.
Entered first by the ch22 scene ([story.md#ch22](./story.md#ch22)); afterwards from Shellby's Bench:
`[E] Sit · Shellby's Bench` → "Wait for the Hundred-Year Night?" (Yes / Not now). In the Night, sitting on the same
bench offers "Go home to the morning?" → home at 07:00. No enemies anywhere. Nothing to collect (no tracker rows).

**Skin.** Time frozen at 22:00. Sky top `#141a3a`, horizon `#3a3f78`, fog `#2a3158` (near 50 m, far 260 m), stars 1.5×,
Mote's star 2.5× and visible; warm lantern light everywhere. **Falling-light rain**: 400 soft gold motes (`#ffe9a8`)
falling at 0.6 m/s within 40 m of Pip, one draw. **The given-light ladder**: the Ladder's-foot column in gold
(`night_ladder`, the `sky_ladder` texture tinted `#ffe9a8`) from the sky down to the plaza's north edge (0, −14).
Music: the festival waltz ([art-audio.md](./art-audio.md)).

**Variant pass v3** (`new RNG(7151 * 199 + 137)`) adds festival dressing: eight lantern strings from the Tree's lower
branches to the plaza ring; a paper lantern by every cottage door (the Lantern Row positions, whether or not it was
funded); Hazel's bun stall and Miso and Kinako's joint stall at the plaza edge (bearings 100° and 250°, r 16-19); a
ring of flowers for dancing (r 6 m round (0, 10), drawn as deco, walkable); the Festival Stage (if `works:stage`,
the built one; otherwise a temporary stage at the same spot).

**Everyone placed** (plaza ring round the Tree's centre (0, −1.5); `near(bearing, r)` with ≥ 2.5 m between people;
a character shows only if the player has met or calmed them, so the list is built from the save like the lantern
chain):

| Who | Bearing, r | Who | Bearing, r |
|---|---|---|---|
| Elder Shellby | on Shellby's Bench | Mote (brighter) | at the ladder's foot (0, −14) |
| Mayor Ribbit | on the stage, else bearing 130°, r 18 | Granny Wick, holding the Firstlight | by the pedestal |
| Miso and Kinako | at their stall | Hazel | at her stall |
| Clover, Primrose and the kits | in the dancing ring | Professor Hoot | 160°, 12 |
| Digby and Gran Burrows | 280°, 13 | Nell and Grandpa Dormy (awake for once) | 230°, 14 |
| Puddle | on the well rim | the Quackenbushes | the duck pond |
| Grumble Shroom (and nephews) | 330°, 13 | Captain Pinch | 200°, 13 |
| Frostbun | 75°, 13 | Sir Rollo | 20°, 14 |
| Mossmantle | hanging from a lantern string at 280°, r 9 | Old Gloop, in a washtub | 120°, 14 |
| Lady Honksworth | 150°, 15 | the Wickwork Moth | perched on the East bough |
| Lumbra the Long | coiled outside the plaza's north edge, head up at 350°, r 19 | Pelagia | 240°, 15 |
| Lady Fumarole, in a portable bath | 100°, 15 | Tutor Scarabelle | 60°, 13 |
| Great-Aunt Flurry (if calmed) | 45°, 20 | Bosun Snore (if calmed) | 215°, 20, asleep |
| the Twinklings (and the shy fourth after side story 48) | floating over the dancing ring | Old Mother Brightwell | a huge soft glow high above the ladder |

**Budget rule** (the Night is the busiest view in the game): at most 16 full NPC models within 25 m of the camera;
everyone farther is drawn as their painted portrait card ([cast.md](./cast.md)) in one instanced billboard mesh. The
realm suite checks the four Night views (plaza from the pedestal, plaza from the bench, from the ladder's foot, from
the lighthouse Lookout) at ≤ 200 main-pass draw calls and ≤ 1.3 M triangles in both cameras.

**The 13th letter** (S-290): Pinch waits at the lighthouse door; `[E] Talk · Captain Pinch` → the lighthouse interior
in night palette → Pinch's Lookout, where Pip throws the bottle (scene, [story.md#ch22](./story.md#ch22)).

**ART BRIEF `night_festival_kit`** (set) · strings of round paper lanterns in warm colours, two festival food stalls
with striped awnings (buns; plushies and "limited edition" trinkets), a ring of flowers, a small temporary stage ·
lanterns ≤ 60 tris each (instanced), stall ≤ 600 · `#ffcf6a` `#ffb0c8` `#9fdcff` `#ffe27a` lanterns, awnings `#7aa63a`
/`#f3e3c3` and `#f2b45a`/`#fff6e2` · toon, lanterns `glow` 0.9 · sway · Prompt (concept): "a cosy island village
plaza on a magical festival night, strings of round paper lanterns, two little food stalls, everyone gathered round
a giant friendly tree, a golden ladder of light coming down from the stars, soft falling golden lights, storybook
style" · Fallback: kit pieces.

---

## 11. Step map (what each step takes from this file)

| Step | Sections |
|---|---|
| S-004 | [#passes](#passes) rules 1-10, `attachPost`; [#placeReasons](#placeReasons) |
| S-009, S-095, S-161 (rings) | [#great-tree](#great-tree) boughs, [crown lanterns](#crown-lanterns), acorn rings |
| S-011 | [#healed-states](#healed-states) |
| S-013 | [#placeThorns](#placeThorns) |
| S-026, S-054 | [#placePortals](#placePortals), [#interiors](#interiors) shared rules |
| S-056 | [#pips-nook](#pips-nook) (root door, layout, displays) |
| S-064, S-066, S-128, S-165, S-212, S-278, S-286 | [#sky](#sky) (cards, windows, Mote's light, Ladder, Mote's star) |
| S-068 | [#placeJetty](#placeJetty), [#spots](#spots) |
| S-073 | [#hollows](#hollows) |
| S-075 | [#lighthouse](#lighthouse) (interior, bottle shelf) |
| S-076 | [#vistas](#vistas) |
| S-077 | [#puddles-grotto](#puddles-grotto) |
| S-082 | [#benches](#benches) |
| S-102 | [#glide-finds](#glide-finds), Nook Balcony, Pinch's Lookout |
| S-112, S-136, S-158 | [#courses](#courses) |
| S-114, S-193 | [#grove](#grove) |
| S-115, S-134, S-135, S-156, S-206 | the five cottages in [#interiors](#interiors) |
| S-122 | [#tide-finds](#tide-finds) |
| S-143 | [#hook-finds](#hook-finds) |
| S-157 | [#village-works](#village-works) |
| S-161, S-268 | [#acorns](#acorns) |
| S-169 | [#old-beacons](#old-beacons) |
| S-181, S-194 | [#dig-spots](#dig-spots) |
| S-188, S-190 | [#remembered-isle](#remembered-isle) |
| S-207 | [#fish-spots](#fish-spots) |
| S-208 | [#star-doors](#star-doors) |
| S-218, S-219 | [#moonmere](#moonmere), the moonpath in [#placeJetty](#placeJetty) |
| S-227, S-238 | [#bell-targets](#bell-targets) |
| S-233 | [#thornglass](#thornglass) |
| S-248 | [#ivy-finds](#ivy-finds), Crown Balcony |
| S-264 | [#starstair](#starstair) |
| S-268 | [#sky-nook](#sky-nook) |
| S-288, S-290 | [#hundred-year-night](#hundred-year-night) |
| S-291 | [#planting](#planting), the West bough in [#great-tree](#great-tree) |
| S-302, S-305 | furnishing spots and plushie cabinet in [#pips-nook](#pips-nook) |

## Decisions made here

CANON left these open; this file decides them. Writers of the other bible files should adopt or raise them.

1. **Pass split and constants.** CANON §5.3's single `placeGates` becomes one pass per tool (rows 10-25), and every
   new home stream has a fixed `(k, c)` in [#passes](#passes); none collides with another for seeds 1-200.
2. **Post-solids and post-decks** are attached by `attachPost(W)` after `generateWorld` returns, so prints and the
   "changes nothing else" tests see the world without them; `W.portals` is assembled from per-pass portal records.
3. **Crown lanterns** are keyed to their source and hang on the crown's side facing it (slots L1-L8 with bearings);
   the Sunken Bell slot (292.5°) and the finale slot (22.5°) are slot choices, not geography claims.
4. **Horizon bearings**: Pinewhistle 330° (not 337.5°, to stay clear of the plaza-to-Tree line), fixed card widths,
   one shared `horizon_window` glow sprite; fogged cards use `haze` 0.95.
5. **Mote's light** shows two nights in three after II.M; **Mote's star** sits at bearing 0°, elevation 58°; the
   Ladder's foot stands over the Tree from `ch19` until the main ending.
6. **Tern Stack** stands off the lighthouse, not by islet 2: islet 2 is ~94 m from the gallery and a glide from
   Y 14 reaches ~27 m.
7. **"Tree balcony → plaza"** is the Nook Balcony (reached from inside the Nook from S-102) plus the Blossom Run's five
   rings, because no ground cell on home is unreachable and the Gloves come much later.
8. **Crown Balcony** sits under the canopy at tree-local 10.5 m; vista v4's data ships in S-076, its post in S-248.
9. **Pinch's Lighthouse interior** (keeper's room, lamp room, bottle shelf) is built in S-075 (S-075b if the PR runs
   long), opens at `lanternGot`; **Pinch's Lookout** deck ships in S-102.
10. **Grumble's Crown hook find** is the Cap Ledge on the cap rim via a Stem Shelf (two hooks), not the dome's top.
11. **The Gull's Nest** (lighthouse roof shoulder, hooked from the Lookout) is the lighthouse-roof hook find.
12. **The Stairfoot** is a Lamplighter platform 4.4 m from the cairn on bearing 60°, reached by two hooks (S-143);
    an ivy route is added in S-264 so either tool order reaches it.
13. **The Old Stump** is 4.0 m tall because the highest reachable Peaks ground near the Woods is about Y 10.
14. **Home acorns**: a01-a12 as listed (5 open, 7 behind other tools); a06 is appended in S-268.
15. **Home tool finds pay in gem pouches** (615 gems in all), since CANON gives home no new chests, and the home
    Completion group gains a **"Tool finds" row (45)**; [systems.md#completion](./systems.md#completion) and
    [systems.md#economy](./systems.md#economy) should add both.
16. **Puddle's Grotto's heart petal** (S-077) would make 25 petals; to keep 24, one non-home Hollow should hold a gem
    bag instead of a petal ([dungeons.md#hollows](./dungeons.md#hollows)).
17. **The Bell Hollow** is in a Meadow mound; its puzzle answer is E, S, W, N ("Ring us as the sun walks."); reward
    60 gems and the Lore entry "The Bell Signal"; bell pitches C4/G4/E4/D4.
18. **Star doors** open with *Calling* at night; alcoves hold acorn a05 and three 30-gem pouches.
19. **Dig spots**: five rumours in Digby's voice; the bench spot yields **Shellby's old hat** (young Shellby's
    too-big hat from memory 4), shown on the Nook hat stand, with Shellby's one line.
20. **Thornvine** (4) and **thornglass** (2) anchors and caches as listed.
21. **Home benches** (5) ship with the shared kit in S-082; **Shellby's Bench** is the Hundred-Year Night's door.
22. **Vistas** v1-v4 as listed; **Village Works**' eight projects, placements and Ribbit's lines as listed.
23. **Cottage meetings**: Dormy by a night knock, Hazel by a morning knock, Primrose after wiping paws on the doormat;
    Nell's cottage interior ships with fishing (S-206). The first knock keeps the shipped line.
24. **Miso's back room** opens at the end of side story 3; the joint sign hangs **under** the LOCKED "Miso's Shop"
    sign and does not rename the shop.
25. **Starseed Isle's fifth keepsake line**: "Something kept awake, something carried up, something written down,
    something planted. That is how a home is kept."
26. **Pip's Nook** layout (two rooms), the keepsake shelf order (lands in the order they open), 24 furnishing spot
    positions and classes, and three extra interior tile letters (`w`, `u`, `O`).
27. **Remembered Isle**: memory spawns, times and placements as tabled; m04 is three vignettes; m11's stones fall
    toward the bearings of crown lanterns L5-L7; four Remembered acorns placed.
28. **Moonmere** is "slightly wrong" (same roofs, six sails, an "HOME" arm pointing up, stripes reversed), always
    00:30; moon-lantern anchors; the Mirror Garden ring r 11 m; silver swaps are +1 HP.
29. **Hundred-Year Night**: everyone's plaza positions; only met or calmed characters appear; a 16-model LOD budget
    with portrait cards beyond 25 m; exit by sitting on Shellby's Bench again.
30. **Shores before the Sea Starseed**: only the daytime lamp is dark; the shipped night beam keeps sweeping.
31. **Fairy-ring shrooms** are drawn as their own instanced mesh (same count) so their glow can be dark, shipped or
    healed without touching prints.
32. **The moonpath** is a toggled post-deck strip on the water, active from *Calling* until dawn.
33. **Courses**: Dash par times 38 s / 50 s, regatta along the Shores shallows, sled run by steepest descent from
    near (125, 0) (rules stay with [side-content.md](./side-content.md)).
34. **Golden grove** centre near (−84, 12); **Planting** spots p1-p4 as listed.
35. **Visitor spots**: one per land on the plaza ring at fixed bearings, occupied from the step that completes the
    land, 08:00-20:00.
