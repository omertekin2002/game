# Atlas: the four Act II isles and Hoot's Margins

Part of the game bible (`docs/roadmap/bible/`). This file owns the **places** of Act II: Duskwick, Pinewhistle,
Archwater and Threemills, the post-game variant realm Hoot's Margins, and the **shared Lamplighter kit** every land
uses. For each land it gives the id, seed, grid, recipe numbers, palette, regions and card subtitles, landmarks,
jetty, benches, root-gate, every point of interest with an anchor, keepsake texts, collectible placements and counts,
enemy tables (ids only), interiors, music and ambience notes, the prop kit with an ART BRIEF per asset, and the
40 × 40 m coverage proof plan.

It does **not** own: dungeon rooms (`./dungeons.md`), enemy and boss stats (`./creatures.md`), dialogue beats and
chapter scripts (`./story.md`), side-story steps and activity rules (`./side-content.md`), character looks
(`./cast.md`), lore texts (`./lore.md`), system numbers (`./systems.md`), the style preamble, terrain-texture prompts
and music note data (`./art-audio.md`), or the chart layout and the far lands (`./atlas-far.md`). Order of authority:
`CANON-NOW` LOCKED > `CANON.md` > this bible > `INDEX.md` > a step issue.

Steps that cite this file: S-082 (`#shared`); S-083, S-084, S-086, S-088, S-091, S-093 (`#duskwick`); S-096, S-097,
S-099, S-101, S-107 (`#pinewhistle`); S-117, S-118, S-120, S-123, S-129 (`#archwater`); S-138, S-139, S-141, S-144,
S-149 (`#threemills`); S-300 (`#hoots-margins`).

---

<a id="conventions"></a>

## Conventions used in this file

**Coordinates.** Metres. `x` east, `z` south, so north is `−z` (same as home). `(0, 0)` is the centre of the realm's
grid; the grid runs from `−size/2` to `+size/2`. `h` is terrain height above the realm's sea level (for a realm with a
tide, above **high** water). Bearings are compass degrees clockwise from north: `θ = atan2(x, −z)`.

**Anchors.** "`(x, z) r R`" means: the placement pass picks the nearest valid 1 m cell to `(x, z)` within `R` metres
(default `R = 12`); among the five nearest valid cells it chooses with its own RNG. Valid = walkable, reachable from
the jetty spawn in the state named (for example "low tide"), slope < 0.5, not on a path band (`pathD ≥ 2.5`) unless
the entry says "on path", ≥ 2.5 m from any chest, interactable or NPC spot, and outside every arena ring. The unit
test asserts each placed find lies within `R` of its anchor; if a regenerated recipe ever moves the ground so an
anchor has no valid cell, the test fails loudly instead of silently relocating the find.

**Ids.** Every new find is namespaced `<realm>:<kind>-<n>` (`duskwick:chest-3`, `archwater:acorn-7`) and lives in
the existing per-id maps (`chests`, `secrets`) or the v9 `collect` maps (`./systems.md#collectibles`). Keepsakes use a
word id (`duskwick:keep-wick`). Enemy ids are the snake-case keys `./creatures.md` defines; this file lists ids only.

**Walkability.** Unchanged engine rule (`js/world-collide.js` `walkable`): a cell is walkable if it is a bridge deck,
or `h ≥ waterY − 0.4` and slope < 0.84. Pip's hop apex is 0.85 m, so any step taller than 0.85 m needs a ramp, stair
or tool. For realms with a tide, `waterY` is `0` at high water and `−1.4` at low water (`./systems.md#gates`).

**Act II tool rule.** An Act II isle's critical path needs only the Glowbud Lantern and the isle's own tool. Every find
gated by another tool is optional and is listed in that land's gate table, so the progression solver (S-108) can
prove it.

**State columns.** "Visible" says when a thing exists: `always`, a flag (`ch8`, `beacons>=1`, `towerOpen`,
`act2done`, `mainEnding`), or a tool (`ability:hook`). Things that only change look list both states.

<a id="passes"></a>

### Post-pass RNG streams (isle realms)

Each land's recipe stages (terrain, regions, paths, kit props, scatter) are frozen by
`tests/fixtures/realm-prints/<id>.json` in the milestone that builds the land. Everything placed afterwards is a
post-pass on its own stream, following the `placeShells` rules (reads a fresh walk and reach, adds only to its own
list, restores `W.walk / W.reach`). The four isles use the same `(k, c)` table; the seeds differ, so the streams
differ.

| Pass | Stream | Writes | Step |
|---|---|---|---|
| `placeIsleBenches` | `new RNG(seed * 71 + 1)` | `W.waystones` | finds step (S-086, S-101, S-123, S-144) |
| `placeIsleChests` | `seed * 71 + 3` | `W.chests` (namespaced ids) | finds step |
| `placeIsleKeepsakes` | `seed * 71 + 5` | `W.secrets` | finds step |
| `placeIsleAcorns` | `seed * 71 + 7` | `W.acorns` | finds step |
| `placeIsleVistas` | `seed * 71 + 9` | `W.vistas` | finds step |
| `placeIsleBottle` | `seed * 71 + 11` | `W.bottles` | finds step |
| `placeIsleLogs` | `seed * 71 + 13` | `W.logs` | finds step |
| `placeIsleHollowDoors` | `seed * 71 + 15` | `W.portals` (kind `hollow`) | finds step |
| `placeIsleRootGate` | `seed * 71 + 17` | `W.rootGates` (sealed stub) | finds step |
| `placeIsleSites` | `seed * 71 + 19` | `W.sites` (named natural features, quest props) | finds step |
| `placeIsleCurios` | `seed * 71 + 21` | `W.curios` (Look / Read texts) | finds step |
| `placeIsleGates` | `seed * 71 + 23` | gate objects for later tools (`W.gates`) | finds step; extra entries in later tool steps |
| `placeIsleFill` | `seed * 71 + 29` | `W.curios` (coverage fill only; runs last) | finds step |
| `placeIsleFishing` | `seed * 73 + 1` | `W.fishSpots` | S-206 |
| `placeIsleDash` | `seed * 73 + 3` | `W.courses` | S-112, S-133, S-154 |
| `placeIsleRook` | `seed * 73 + 5` | `W.courses` (kind `rook`) | S-113, S-133, S-154 |
| `placeIsleStories` | `seed * 73 + 7` | `W.storyMarks` | each side-story step |
| `placeIsleThornglass` | `seed * 73 + 9` | `W.gates` (kind `thornglass`) | S-233 |
| `placeIsleNight` | `seed * 73 + 11` | `W.gates` (kind `stardoor`) | S-208 |
| `placeBuried` (isles only) | `seed * 73 + 13` | `W.gates` (kind `soft_earth`) when an isle's finds step left no mound record | S-181 |
| `placeMarginsInk` | `seed * 79 + 1` | `W.inkTraces` (Hoot's Margins only) | S-301 |

**Isle post-pass RNG table (the `seed * 73 + c` family).** Taken: `placeIsleFishing` (73, 1), `placeIsleDash` (73, 3),
`placeIsleRook` (73, 5), `placeIsleStories` (73, 7), `placeIsleThornglass` (73, 9), `placeIsleNight` (73, 11),
`placeBuried` (73, 13). Rule: a new isle pass takes the **next free c** (odd, so 15 is next), adds its row here in the
same PR, and never reuses a taken pair. Far realms keep their own `placeBuried` stream (73, 5) in
`./atlas-far.md#far-passes`, because no far realm runs `placeIsleRook`.

Home-island stream constants are listed in `./atlas-home.md#passes`; they are a different seed (7151) and never
collide with these.

<a id="poi-rule"></a>

### What counts as a point of interest

CANON §5.1 asks for at least one point of interest (POI) per 1,250 m² of land. A POI is one of:

| Kind | Examples | Interaction |
|---|---|---|
| find | chest, keepsake, Sleeping Acorn, vista, bottle, Lamp Log, Hollow door, bench, root-gate, heart-petal source | a reward or a mark |
| landmark | the four per land | seen from far; keepsake round the back |
| person | an NPC's day spot | `Talk` |
| site | a named natural or built feature with its own look: a pool, a bridge, a stack, a ruin, a waterfall, a wreck of a cart | walk to it; often a Look line |
| curio | a small thing with a `Look` or `Read` line and no reward: a sign, a carving, an abandoned toy | text |
| gate | a tool gate visible before the tool (hookbloom, tide stone, soft earth, thornglass) | a promise |
| activity | a Dash start post, a Rook race start, a fishing spot, an activity owner's post | play |
| story mark | where a side story happens or leaves its mark | journal |

Each land's POI table below adds up these kinds. A thing is counted once even if it is two kinds.

<a id="coverage-rule"></a>

### The 40 × 40 m coverage proof (shared rule and test)

Pure module `js/realms/coverage.js` (no Three.js), used by `tests/realm-coverage.test.js` for every overworld realm:

1. Lay a 40 m grid from `(−size/2, −size/2)`. A **land cell** is one in which at least 160 m² (10 %) of its 1 m
   cells are reachable land (`W.reach` = 1). Realms with a tide are tested in both states; a cell is a land cell if it
   is one in either state, and it must pass in every state in which it is one.
2. A land cell **passes** if any of:
   - **find**: a POI anchor of kind find, landmark, person, site, curio, gate, activity or story mark lies inside it;
   - **view**: the cell holds a **high point** (its highest reachable cell is ≥ 2 m above the highest reachable cell
     of each of its 8 neighbours) **or** a bench or vista within 60 m of the cell centre has an unoccluded heightfield
     ray (eye height 1.5 m, target 1.0 m above ground) to some reachable cell of it;
   - **path**: a path band cell (`pathD < 1.5`) lies in it **and** walking that path network from that cell reaches a
     POI anchor within 80 m of path length.
3. The fill pass `placeIsleFill` runs last and puts one curio (from the land's fill pool) at the most central valid
   cell of every land cell that still fails. The test **fails if the fill pass had to fill more than 12 %** of land
   cells: that means the recipe or the authored finds are too thin, and the step must add authored content instead.
4. The test prints `landCells, passFind, passView, passPath, filled` per realm and state; the finds step records them
   in its PR and `docs/roadmap/progress.md`.

<a id="sightlines"></a>

### First-person rules for every isle

Every isle is played first-person by default, so the land itself must guide.

- **Sightline corridors.** From each region-entry point (listed per land) and each bench, the region's landmark top
  must be visible. The test casts a heightfield ray from eye height 1.5 m to the landmark's top; trees do not block
  the ray in the test, so the recipe clears trees and tall props from a **6 m wide corridor** along each listed
  sightline (scatter reservation, not a path).
- **Landmark fog cap.** Landmarks keep the home rule: fog never exceeds 0.45 on a landmark (`TUNE.atmo` landmark cap).
  Every landmark top in this file is within 290 m of its region's entry points, inside the 300 m far plane.
- **Sound before sight.** Every hidden collectible has a sound or glint cue (acorn snore within 10 m, keepsake twinkle
  within 6 m, Lamp Log spiral chime within 8 m, bottle glint on shores). Each isle also has one **positional landmark
  sound** that changes when its beacon is kindled (listed per land), so the change is heard even facing away.
- **Held things.** The Lantern, Tide Bell and Thistle Hook show in Pip's hand in first person
  (`./systems.md#items-tools`); this file only places the gate objects they answer.
- **Ledges.** Hop apex is 0.85 m. Any find on a ledge that is not a tool gate has a ramp, steps or a bridge to it.

---

<a id="shared"></a>

## The shared Lamplighter kit

Built in S-082 and used by every land, including the far lands in `./atlas-far.md`. All pieces are code-built toon
models in `js/props.js` style (`js/toon.js` materials, ink hull for hero pieces), each with a manifest key so a
painted GLB can replace it later with no code change. Prefix every image prompt with the style preamble in
`./art-audio.md#style`. Generated images are original and never imitate another game's art.

**Kit palette.** Lamplighter limestone `#d9cdb4` (shadow `#a89a80`), moss `#7f9a5a`, weathered brass `#b08a45`
(dark `#6e5530`), moth-glass (unlit) `#6b6478`, lamp glow `#ffd27a` (core `#fff1c4`), spiral inlay `#c9a24a`,
rope `#c9b48a`, old plank `#9b7b56`.

**The Spiral.** One repeated sign: a right-handed spiral of 2.5 turns ending in a short outward tick, carved or
inlaid on every bench, beacon, ruin, Hollow door, root-gate and Lamp Log niche. In-world it means "the way home"; to
the player, "this connects to somewhere". It is never used on anything that does not connect or hold a find.

<a id="kit-bench"></a>

### Lamplighter bench (`kit_bench`)

The fast-travel waystone (`[E] Sit · Bench`, `./systems.md#travel`). 4-6 per land.

- **Silhouette:** a low stone bench with a tall back slab; the back slab's top is a half-disc with the Spiral carved
  through it so sky shows through the spiral; two moth-wing armrests.
- **Size:** 1.8 m long, seat 0.45 m high, 0.55 m deep; back slab top 1.35 m.
- **Palette:** limestone `#d9cdb4`, moss patches `#7f9a5a` on the seat corners, spiral inlay `#c9a24a`; marked state
  adds emissive `#ffd27a` (intensity 1.4) on the inlay and a 0.6 m additive glow sprite.
- **Materials:** toon stone (2 tones), toon moss, emissive inlay (only when marked).
- **Poly budget:** ≤ 420 tris; LOD proxy ≤ 120.
- **Pose / animation:** static; on first `Sit` the inlay fills from the centre outward over 0.8 s with a soft chime.
- **Collider:** box 1.8 × 0.55 at the seat; the back slab is part of it.
- **Fallback:** boxes + a cylinder-slab back with the spiral as a 256² decal (`kit_spiral`) or, with no assets, a
  canvas-drawn spiral.
- **Image prompt (reference sheet, 1024², opaque):** "a small weathered limestone bench with a tall rounded back
  slab, a spiral carved right through the back so sky shows through it, armrests shaped like folded moth wings, soft
  moss on the corners, a faint golden glow in the spiral grooves, front and three-quarter views on a plain warm
  paper background".
- **3D prompt:** "stylised low-poly stone bench, 1.8 m long, tall half-disc back slab with a pierced spiral, moth-wing
  armrests, moss patches, hand-painted texture, soft toon shading, game-ready, origin at bottom centre, facing +Z".

<a id="kit-beacon"></a>

### Lamplighter beacon lamp (`kit_beacon`)

The lamp cage every isle's beacon wears on its landmark (the pine crown, the arch keystone, the granary cupola; the
Tower's great lamp is a 2.4× scaled variant). Kindling happens at the beacon's heart in the dungeon's last room
(`./dungeons.md`); the overworld cage switches state when `beacon:<realm>` is set (`./systems.md#beacons`).

- **Silhouette:** an eight-sided brass cage with a pointed cap and a spiral finial, round moth-glass panes, a short
  stone plinth.
- **Size:** 1.6 m tall, 1.0 m across (default); scales 0.8-2.4.
- **Palette:** brass `#b08a45` / `#6e5530`; panes dark `#6b6478` at 0.55 opacity; lit panes `#ffd27a` emissive 2.2
  with core `#fff1c4`; plinth limestone `#d9cdb4`.
- **Materials:** toon metal, transparent glass (dark state), emissive glass (lit state); lit state adds a 6 m additive
  glow sprite (`fx_beacon_glow`, generated 256² radial webp) and claims one of the 4 pooled point lights only while
  Pip is within 40 m.
- **Poly budget:** ≤ 900 tris.
- **Pose / animation:** lit: the glow breathes ±8 % over 3 s; kindling: panes light one by one clockwise over 1.2 s,
  then the glow sprite blooms from 0 to full over 0.6 s.
- **Fallback:** cylinder cage of 8 thin boxes + cone cap; glow from a canvas radial gradient.
- **Image prompt (glow sprite, 256², transparent):** "soft round warm-gold lamp glow, bright creamy centre fading to
  transparent edges, gentle painterly bloom, no hard rim".
- **Image prompt (reference sheet, 1024², opaque):** "an old eight-sided brass lantern cage with round smoky lilac
  glass panes, a pointed cap topped by a small brass spiral, on a short limestone plinth, shown unlit and lit side by
  side, warm painterly storybook style".
- **3D prompt:** "stylised brass lighthouse lamp cage, eight sides, round panes, pointed cap with spiral finial,
  limestone plinth, 1.6 m tall, toon shading, two material states (dark glass, glowing glass)".

<a id="kit-ruins"></a>

### Lamplighter ruins (`kit_ruin_pillar`, `kit_ruin_arch`, `kit_ruin_lampstump`, `kit_ruin_ring`)

Stamps the recipes drop at listed sites so every land shows the Lamplighters were there. One instanced type each.

| Key | Silhouette and size | Tris | Notes |
|---|---|---|---|
| `kit_ruin_pillar` | a fluted limestone pillar snapped at 1.2-3.2 m (three heights by instance scale), the Spiral carved at 1 m, 0.7 m across | ≤ 260 | collider circle r 0.45 |
| `kit_ruin_arch` | half of a small arch: one 2.8 m post and a curved lintel stub, 2.2 m wide | ≤ 320 | collider on the post only |
| `kit_ruin_lampstump` | a waist-high (1.1 m) square lamp-stand with an empty brass hook bent over the top | ≤ 180 | a common curio host |
| `kit_ruin_ring` | a ring of 8 tilted kerb stones, 3.4 m across, a cracked round slab in the middle with the Spiral (an old beacon base) | ≤ 400 | walkable; the centre slab hosts Lamp Log niches and night finds |

- **Palette:** limestone `#d9cdb4` / `#a89a80`, moss `#7f9a5a`, brass `#6e5530` (old).
- **Fallback:** boxes and cylinders in the same colours.
- **Image prompt (reference sheet, 1024², opaque):** "four mossy limestone ruins from an old order of lamp keepers:
  a snapped fluted pillar with a carved spiral, half a small arch, a waist-high lamp stand with a bent empty brass
  hook, a ring of tilted kerb stones round a cracked slab carved with a spiral; soft painterly storybook style".
- **3D prompt:** "set of four stylised low-poly limestone ruin pieces with carved spirals and moss, toon shaded,
  game-ready, each origin at bottom centre".

<a id="kit-spiral"></a>

### The Spiral decal (`kit_spiral`)

- **Generate:** 256² webp with alpha. Prompt: "a single hand-carved spiral glyph, two and a half turns, ending in a
  short outward tick, chiselled into pale stone with soft golden light in the groove, centred, transparent background
  outside the stone chip". Process: trim, centre, export 256² and 128² (`tools/export_sprites.py`).
- **Use:** decal on ruins, Hollow doors and log niches; the HUD's Lamp Log cue icon (`./art-audio.md#ui`).
- **Fallback:** canvas `arc` spiral, stroke `#c9a24a`, 6 px.

<a id="kit-log-niche"></a>

### Lamp Log niche (`kit_log_niche`)

Where a placed Lamp Log waits: a little stone lamp niche in a rock, wall or ruin with a rolled page in it.

- **Silhouette:** a 0.6 m tall arched niche with a stub of candle and a rolled, ribbon-tied page; the Spiral on the
  keystone.
- **Size:** 0.6 × 0.45 × 0.35 m; mounted at 0.6-1.2 m height.
- **Palette:** limestone, page `#efe3c8`, ribbon `#b55d4c`, candle stub `#f4e6c0`.
- **Cue:** while unread, the Spiral glows faintly (emissive `#ffd27a` 0.6) and chimes three soft notes when Pip is
  within 8 m (once per approach).
- **Prompt:** `[E] Read · Lamp Log`. Text by number in `./lore.md#lamp-logs`.
- **Poly budget:** ≤ 200 tris. **Fallback:** box niche + cylinder page.
- **Image prompt (reference, 512², opaque):** "a small arched stone niche in a mossy wall holding a candle stub and a
  rolled parchment tied with a red ribbon, a tiny spiral carved on the keystone glowing faintly gold".
- **3D prompt:** "tiny stylised stone wall niche with candle stub and rolled scroll, spiral keystone, toon shaded".

<a id="kit-hollow-door"></a>

### Hollow door (`kit_hollow_door`)

The overworld entrance to each Hollow (one-room puzzle cave, `./dungeons.md#hollows`). `[E] Enter · Spiral door` ([systems.md#portal-table](./systems.md#portal-table)); a toast shows the Hollow's name on entry.

- **Silhouette:** a round stone door 2.0 m across set into a rock face or bank, the Spiral carved across its whole
  face, a moth-wing knocker; when the Hollow is cleared a small lamp above the door lights.
- **Size:** door 2.0 m diameter, frame 2.6 m; the rock-face host is the recipe's terrain.
- **Palette:** limestone `#d9cdb4`, spiral `#c9a24a`, knocker brass `#b08a45`, cleared lamp `#ffd27a`.
- **Poly budget:** ≤ 500 tris. **Fallback:** disc + ring + decal.
- **Image prompt (reference, 1024², opaque):** "a round stone door set into a grassy bank, its whole face carved with
  one big spiral, a small brass knocker shaped like a moth, a tiny unlit lamp above the frame, painterly storybook".
- **3D prompt:** "stylised round stone door 2 m across with a full-face carved spiral, moth-shaped knocker, small lamp
  bracket above, set in a stone frame, toon shaded".

<a id="kit-root-gate"></a>

### Root-gate (`kit_rootgate`)

One per land (`./systems.md#travel`). Wenna's longest roots surface on every isle (CANON §3.3); the root-gate is a knot
in one of them with a spiral-carved door. Placed as a sealed stub in each land's finds step; opened by chapter 13
(visited isles) or the Digging Paws (sealed ones), S-182.

- **Silhouette:** a great root breaks the ground in a 12 m long arch (2.8 m high at the top) and dives back down; at
  the knot where it dives, an oval door 1.4 × 2.2 m of root bark with the Spiral; sealed state: a plug of packed
  earth with small stones; open state: the door glows faintly amber from inside.
- **Size:** root arch 12 × 2.8 m, 1.4 m thick; door 1.4 × 2.2 m.
- **Palette:** root bark `#8a5a3c` (dark `#5e3c28`), root-glow `#ffcf7a`, packed earth `#7a5a3e`, stones `#a89a80`.
- **Materials:** toon bark, emissive glow strip along the root's underside (open state only).
- **Poly budget:** ≤ 1,400 tris (root ≤ 1,000, door ≤ 400). **Collider:** two circles at the root's ends, the arch is
  walk-under (`y0 ≥ 1.0`).
- **Bearing rule:** the root arch's long axis points at the home island's bearing from that land (table in
  [Neighbours on the horizon](#horizon)), so an attentive player sees the roots all lead home.
- **Fallback:** a bent tube (`TubeGeometry` on a 3-point curve) and an ellipse door.
- **Image prompt (reference, 1024², opaque):** "an enormous old tree root breaking out of the grass in a low arch and
  diving back into the ground, at the knot an oval door of bark carved with a spiral, a faint warm amber glow at the
  seams, shown sealed with packed earth and open with glow".
- **3D prompt:** "stylised giant tree root arch 12 m long rising out of the ground, oval bark door at one end with a
  spiral carving, two states, toon shading".

<a id="kit-jetty"></a>

### Jetty kit (`kit_jetty_plank`, `kit_jetty_post`, `kit_bollard`, `kit_jetty_lamp`)

Every land's arrival. The jetty deck is a bridge deck in the recipe (walkable at any water level), built from 4 m
plank segments; posts every 4 m each side; a bollard where the *Dandelion* ties up; a Lamplighter lamp post at the
landward end. `[E] Sail · the Dandelion` sits on the bollard (`./systems.md#travel`).

- **Sizes:** deck segment 4 × 2.4 m (Wickhaven and the Raft use 3.0 m wide), deck top 1.2 m above high water;
  posts 0.3 m round, 1.0 m above deck; bollard 0.5 m tall; lamp post 2.6 m.
- **Palette:** old plank `#9b7b56` (gaps `#5e4a34`), rope `#c9b48a`, iron `#4a4a52`, lamp `kit_beacon` at 0.4 scale.
- **Poly budget:** plank ≤ 60, post ≤ 40, bollard ≤ 80, lamp post ≤ 300.
- **Fallback:** boxes and cylinders (home's `placeJetty` uses the same pieces; `./atlas-home.md#placeJetty`).
- **3D prompt:** "modular stylised wooden jetty pieces: 4 m plank deck, round post, iron bollard with rope, small
  brass lamp post, toon shading".

<a id="kit-vista"></a>

### Hoot's vista post (`kit_vista`)

Each vista (`[E] Sketch · Vista`; rules in `./systems.md#collectibles`, the activity tiers in `./side-content.md`).

- **Silhouette:** a little wooden easel 1.3 m tall with a blank card pinned to it and a painted owl-face stamp at the
  top; after sketching, the card shows the painted vista thumbnail.
- **Palette:** wood `#9b7b56`, card `#f4efe2`, owl stamp `#7a5a3e` and `#e8c46a`.
- **Poly budget:** ≤ 160 tris. **Fallback:** three boxes + a plane.
- Vista paintings: one 512 × 320 webp per vista, generated in that land's art step from the vista's caption and view
  (prompt pattern in `./art-audio.md#ui`); fallback: a canvas render of the minimap crop.

<a id="kit-thornglass"></a>

### Thornglass thicket (`kit_thornglass`)

The Starsteel gate (`./systems.md#gates`): optional thickets in every land, cut only with the Starsteel Sword.

- **Silhouette:** a knee-to-shoulder-high (1.4 m) tangle of glassy, pale-teal thorn stems, 2.5-4 m across, faintly
  ringing when Pip walks near; cut: shatters into soft sparkles (poof), leaves a stump ring.
- **Palette:** glass stems `#9fd6cf` (core `#e8fbf7`), base `#5d7f7a`; sparkle `#ffffff`.
- **Materials:** toon glass (fresnel rim), no transparency sort (opaque toon with rim light).
- **Poly budget:** ≤ 700 tris per thicket. **Collider:** circle of the thicket's radius until cut.
- **Fallback:** a cluster of 14 thin cones in `#9fd6cf`.
- **3D prompt:** "stylised thicket of glassy pale-teal thorny stems, 1.4 m tall, 3 m across, crystalline but soft,
  toon shading with rim light".

<a id="kit-curio"></a>

### Curios

A curio is any `Look` or `Read` interactable with one or two lines and no reward. It reuses a prop that already exists
(`kit_ruin_*`, `sign`, `pot`, a land prop) plus a text id. Curios are cheap POIs and the coverage fill pool. Each land
lists its curio types with every line. Prompt labels follow the home keepsake style ("Look · Something carved").

<a id="horizon"></a>

### Neighbours on the horizon (from each isle)

Each isle's sky shows painted cards of its neighbours at fixed bearings, consistent with home's six horizon cards
(Duskwick S-SE, Pinewhistle N-NW, Archwater E-SE, Threemills W-SW of home). The chart itself is
the chart section of `./atlas-far.md`; card art is `./art-audio.md#horizon`. Bearings below assume that chart; if `atlas-far.md`
changes the chart, recompute with `θ = atan2(Δx, −Δz)`.

| From | Home (Great Tree card, crown lanterns glow by count at night) | Other cards |
|---|---|---|
| Duskwick | 337.5° (N-NW) | Archwater 45° (NE); Threemills 292.5° (W-NW); Pinewhistle hidden behind home; sky isle NE |
| Pinewhistle | 157.5° (S-SE) | Archwater 135° (SE); Threemills 202.5° (S-SW); Duskwick hidden behind home; sky isle NE |
| Archwater | 292.5° (W-NW) | Duskwick 225° (SW); Pinewhistle 315° (NW); Kettle Isle 29° (fogged until `act2done`); sky isle NE |
| Threemills | 67.5° (E-NE) | Pinewhistle 22.5° (N-NE); Duskwick 112.5° (E-SE); Saltglass Flats 164° (fogged until `act2done`); sky isle NE |

Every isle's card of another isle shows that isle's beacon window lit at night once its beacon is kindled (same flag
as home's horizon cards). From `act2done`, the Ladder billboard hangs in the north-east sky of every isle.

---

<a id="duskwick"></a>

## Duskwick

The palm isle with the stone tower, south-south-east of home. Act II's hub: the moth town of Wickhaven on stilts over a
lagoon, the last Lamplighter, the Lamplighters' Tower (dungeon 5, end of Act II) and, after the main ending, the
Hundred Lamps under the headland. First visited in chapter 8 (`./story.md#ch8`). Dim state: sunny by day, but at
night Wickhaven's lanterns are half lit and the moths are drowsy; the Tower's window is dark.

<a id="duskwick-card"></a>

### Duskwick: identity card

| Field | Value |
|---|---|
| id | `duskwick` |
| Kind · grid · seed | overworld · 448 m (half 224) · `40211` |
| Land | ≈ 0.08 km² (test band: 74,000-86,000 m² reachable at high water) |
| Recipe | `lagoon` (`js/realms/recipes/lagoon.js`) |
| Palette · music | `duskwick` · `duskwick` (dusk marimba) |
| Unlock | chart sailing from Nell's Jetty after `lanternGot` (ch7); realm `hidden: true` until S-091 sets `ch8` |
| Spawns | `jetty` (−8, 128) facing 0°; `tower` (124, −104) facing 225° (dungeon 5 exit); `rootgate` (52, −104) facing 157°; `vault` (146, −134) facing 200° (Hundred Lamps exit) |
| Tide | two-state from S-122: `tide:duskwick` (default high); one tide stone at the lagoon mouth |
| Steps | S-083 recipe · S-084 props · S-085 art · S-086 finds · S-087 perf · S-088 people · S-089 enemies · S-090 Lamp Thief glimpse · S-091 ch8 · S-092 Kinako · S-093 Hollows · S-133 Dash and Lagoon Lights · S-162-S-165 Tower · S-167/S-168 side stories · S-297-S-299 Hundred Lamps |

<a id="duskwick-recipe"></a>

### Duskwick: the `lagoon` recipe

All numbers are targets the recipe step tests (prints, reachability, `genMs ≤ 1.2 s`). `θ` = bearing from `(0, 0)`.

1. **Outline.** Shore radius `r(θ) = 168 + 10·fbm(θ; 3 octaves, 3 cycles per turn) + 30·max(0, cos(θ − 45°))^10`, so
   the NE headland reaches r ≈ 198. Shore profile: `h` falls from 1.2 at `r − 8` to −0.4 at `r`, to −6 at `r + 30`.
   Beaches (sand layer) wherever slope < 0.15 within 14 m of the shore.
2. **Candle Knoll.** Dome at (18, −28), peak 16 m, radius 64 m: `h = 16·(1 − (d/64)²)²` plus 1.5 m fbm.
3. **Tower Head.** Flat plateau `h = 14` at (112, −112), radius 42, blended into the knoll by a **saddle** 10 m wide
   from (66, −72) (h 6) to (92, −94) (h 14). Cliffs (slope 1.1-1.6) on the plateau's seaward arc, bearings 330°-120°
   around the plateau centre. Two sea stacks off it: **Gull Stack** (160, −98), r 5, top h 20; **Lantern Stack**
   (98, −176), r 6, flat top h 8.
4. **Lagoon.** Ellipse centre (−8, 92), `rx 74`, `rz 58`. Floor by normalised ellipse radius `e`: `e` 0.80-1.00 →
   h −0.3 (wading rim); `e` 0.40-0.80 → h −1.0 (the **lagoon flats**, walkable only at low tide); `e < 0.40` → h −2.4
   (the **Deep Lamp Pool**, always water). **Mouth channel** from (−8, 150) to (−8, 182), 26 m wide, h −2.6. Two
   rows of breakwater boulders (**the Mouth Rocks**) line the channel at x = −24 and x = +8, z 150-176.
5. **Ember Sands (west).** A dune band 40 m wide inside the west shore, h 0.6-4, directional noise along 20°
   (wavelength 30 m). **Hot pools:** six flat basins at h 2.0-3.5 centred (−118, −52) within r 18 (radii 3, 3.5, 4,
   4, 4.5, 5 m; floor 0.3 m below rim; steam cards). **The Three Chimneys:** basalt stacks in the surf at
   (−152, −22) top 18 m, (−160, −8) top 14 m, (−145, −2) top 11 m; radii 5, 4, 3.5; slope > 1.5 (unclimbable).
   **Sizzle Sands Tube:** a lava-tube tunnel 4 m wide, 3.2 m high (ceiling `over` boxes), from a mouth at
   (−62, −40) on the knoll's west flank 26 m west to a dark chamber at (−86, −58) (dark zone, Dimlings).
6. **Coral Steps (east).** Bearings 70°-175°: four terraces concentric to the shore at h 12, 9, 6, 3 m, each 12-16
   m wide, risers ≥ 2.6 m (cliff slope); three ramp cuts 3 m wide on every riser at bearings 85°, 120°, 160°. The
   lowest shelf (the **Reef Shelf**) sits at h 0.4-1.0 with 22 tide-pool decals. **The Coral Cupboard:** a sea cave
   4 m deep in the 3 m riser at (168, 96).
7. **Paths** (2.4 m, `duskwick_path` layer): **P1** north shore head (−8, 30) → (40, −20) → saddle (66, −72) →
   Tower door (121, −119); **P2** north shore head → (−64, 28) → hot pools (−112, −46) → (−140, −14); **P3** east
   shore head (68, 88) → (64, 36) → top terrace (120, 30) → ramps → Reef Shelf (160, 90); **P4** spur from P1 at
   (40, −20) to the knoll summit (18, −28); **P5 the Old Shore Walk**, a faint path (half-strength splat, 1.8 m)
   round the north coast: Chimneys (−140, −14) → (−120, −90) → (−60, −140) → root-gate (52, −112) → saddle. Lamp-stand
   curios line P5 every ~45 m (it was the Lamplighters' night round).
8. **The Vault Stair.** A cliff stair cut down the plateau's north face from (138, −128) h 14 to the **Vault door**
   (146, −140) h 1.2, six straight flights, 1.6 m wide; its top is closed by a Lamplighter lattice gate whose collider
   is `active` until `mainEnding` (the Hundred Lamps, S-297). The door itself is visible from the reef and the
   Lantern Stack from day one (a promise).

<a id="duskwick-wickhaven"></a>

### Duskwick: Wickhaven (the town on stilts)

All decks are recipe bridge decks at h 1.6 (walkable at any tide), 3.0 m boardwalks with rope rails.

| Piece | Where | Size | Notes |
|---|---|---|---|
| Wick Square | centre (−8, 88) | 28 × 20 m | over the Deep Lamp Pool; the Wick Mast at (−8, 86) |
| North boardwalk | (−8, 78) → north shore head (−8, 30) | 48 m | P1 starts at its head |
| West boardwalk | (−22, 90) → west shore head (−84, 92) | 62 m | P2 branch |
| East boardwalk | (6, 90) → east shore head (68, 88) | 62 m | P3 starts at its head |
| The jetty | Wick Square south edge (−8, 98) → (−8, 140) | 42 m | bollard (−6, 140); the *Dandelion* moors at (−4, 136), bow north |
| Bazaar pier | (12, 96) → (20, 112) | 18 m | Kinako's Floating Bazaar moors at (24, 114) (S-092) |
| The Long House | deck (−34, 108), house 14 × 10 m | joined to Wick Square's SW corner by a 10 m plank | Granny Wick's Library (interior); door (−34, 101) |
| Stilt houses (8) | W1 (−36, 80), W2 (−52, 102), W3 (−66, 80), N1 (6, 60), N2 (−22, 52), E1 (22, 102), E2 (38, 78), E3 (52, 104) | house 6 × 6 m on an 8 × 8 m deck, 4 m plank to the nearest boardwalk | door Knock lines below |
| Moth lantern strings | between the mast top and 8 rail posts round the square; along every boardwalk every 8 m | `duskwick_moth_lantern` | dim state: 1 in 3 lit at night; restored (`act2done`): all lit, gentle sway |

From the spawn on the jetty the player sees, straight ahead, the Wick Mast and the square; to the right of the mast,
over the knoll's shoulder at bearing ≈ 28°, the Tower (289 m to its top, inside the far plane); a sightline corridor
keeps palms off that line.

<a id="duskwick-regions"></a>

### Duskwick: regions and cards

Region rule: **Wickhaven** = the lagoon, the mouth channel's shores and every land cell within 26 m of the lagoon
ellipse; otherwise by bearing: **Tower Head** [315°, 70°), **Coral Steps** [70°, 175°), **Ember Sands** [175°, 315°).
Region weights blend over 12 m (`W.regions` order below = region index).

| # | id | Card (name · subtitle) | Entry point (sightline source) | Music layer · ambience | Enemies `[[id, weight]]` · max |
|---|---|---|---|---|---|
| 0 | `wickhaven` | **Wickhaven** · "Stilts, moths and lamplight" | jetty spawn (−8, 128) | town · `lagoon` (lapping, wing rustle, wind chimes) | `[]` · 0 (safe zone) |
| 1 | `towerhead` | **Tower Head** · "The last light" | P1 at (44, −40) | high · `cliffwind` (wind, gulls, far surf) | `[['coco_clonk', 3], ['sizzle_beetle', 2]]` · 5 |
| 2 | `coralsteps` | **Coral Steps** · "Mind the coral" | P3 at (64, 36) | bright · `reef` (surf on coral, clicks, drips) | `[['sizzle_beetle', 3], ['coco_clonk', 2]]` · 6 |
| 3 | `embersands` | **Ember Sands** · "Black sand, warm toes" | P2 at (−64, 28) | warm · `hotpools` (bubbling, hiss, palms) | `[['sizzle_beetle', 4], ['coco_clonk', 3]]` · 6 |
| - | dark zones | Sizzle Sands Tube, the Coral Cupboard | - | - | `[['dimling', 1]]` · 3 (only while dark; `./creatures.md#enemy-dimling`) |

<a id="duskwick-landmarks"></a>

### Duskwick: landmarks

| Region | Landmark | Base | Height (top above sea) | Seen from | Keepsake behind it |
|---|---|---|---|---|---|
| Tower Head | **the Lamplighters' Tower** | (126, −124), plateau h 14 | 28 m (42) | jetty, north shore head, Coral top terrace, every bench | `duskwick:keep-wick` |
| Wickhaven | **the Wick Mast** | (−8, 86) on Wick Square | 16 m (17.6) | jetty, all three shore heads | `duskwick:keep-lantern` |
| Ember Sands | **the Three Chimneys** | (−152, −22) (tallest) | 18 m (18) | P2 entry (−64, 28), Knoll Bench | `duskwick:keep-pebble` |
| Coral Steps | **the Old Fan** | (136, 40), top terrace h 12 | 15 m (27) | P3 entry (64, 36), Fan Bench, the reef | `duskwick:keep-hook` |

**The Tower, outside.** A round stacked-stone tower, 9 m across at the base tapering to 6 m, one round window 1.4 m
across at 18 m on the south-west face, a glass lamp room 3.5 m tall at the top holding the great lamp (`kit_beacon`
at 2.4×), a conical slate cap with the Spiral finial. **The outer stair**: six straight flights of bridge deck
(1.2 m wide, rope rail), each ~7 m long and 3 m high, wrapping the south and west faces from the door to the
**window ledge** (a 3 × 2.4 m balcony at h 32 under the window). The door (121, −119) faces 225°; it shows a brass
gear-lock with a moth face: `Look · A locked door` → "The door is locked from the inside. Something behind it is
ticking." It becomes `[E] Enter · the Lamplighters' Tower` at `towerOpen` (`./story.md#beacon-3`), portal to dungeon
5 (`./dungeons.md#d5`).

**Tower states.** Before ch8 (seen only on home's horizon card c): window lit at night. From ch8: window dark, lamp
room dark. Chapter 8's glimpse (S-090): when Pip reaches the fourth flight (h 26), a cloaked light on the window
ledge rises over the cap and streaks away north-east (`./story.md#ch8`). From ch12: the lamp room burns with the
ordinary flame Pip kindled (warm `#ffd27a`, beam sweeping every 12 s) and Granny Wick's window is lit again each
night. From `mainEnding`: the Firstlight is back; the lamp room's core turns white-gold `#fff1c4`, the beam doubles
in length, and on the horizon card of every other land Duskwick's window is the brightest light at night.

**The Wick Mast.** A 16 m mast of lashed driftwood poles with three crossbars, a rope ladder up the north face to
the first crossbar (3.2 m, decorative; not climbable), strings of moth lanterns from the top to the square's rails.
Before ch12 the top lantern is dark; at `act2done` it lights first and the strings light down from it over 4 s.

**The Three Chimneys.** Three black basalt sea stacks in the surf, each with a thin steam plume from its top (the
hot pools' vents run under them); the plumes are the region's far-visible cue.

**The Old Fan.** A 15 m pink sea-fan coral left high and dry on the top terrace when the sea was higher; a lattice
of branching fronds in one plane, facing south-east, so from the north it reads as a thin pink line and from the
east as a huge fan. A line of empty brass lamp hooks runs from its foot along the terrace edge (site: the Lamp
Hooks).

<a id="duskwick-keepsakes"></a>

### Duskwick: keepsakes (4 × 25 gems; round the back of each landmark)

| id | Anchor | Prompt | Line 1 | Line 2 |
|---|---|---|---|---|
| `duskwick:keep-wick` | seaward (NE) side of the Tower base, between tower and cliff rim (131, −130) r 4 | `Look · Something waxy` | "A stub of very old candle-wick, coiled in a crack at the foot of the Tower. It smells faintly of honey." | "Wound round it is a paper band, inked small: 'Lamp one, night one. Lit from the first seed. Pass it on.'" |
| `duskwick:keep-lantern` | north side of the Wick Mast's foot, under the bottom ladder rung (−8, 82) r 2, on deck | `Look · Something papery` | "A tiny paper lantern, folded from a page of sums, tucked under the bottom rung of the mast." | "Inside, in big careful letters: 'WICK, AGE 12. I WILL BE A LAMPLIGHTER. I WILL.'" |
| `duskwick:keep-pebble` | seaward side between the stacks, on sand dry at high water (−156, −15) r 4 | `Look · Something warm` | "A smooth black pebble, still warm, wedged between the stacks where the steam comes up." | "Painted on it in gold: a little tree, a wavy line, and an arrow pointing north-north-west. Somebody was marking the way home." |
| `duskwick:keep-hook` | east (seaward) side of the Old Fan's foot (142, 44) r 4 | `Look · Something brass` | "A brass lamp hook, the kind the Lamplighters hung their lamps on, grown right into the coral." | "There are dozens of empty hooks along these steps. Long ago, somebody took every lamp down at once, all in one night." |

**Fifth line** (shown on Duskwick's shelf in the Keepsake Hollow once all four are found): "A wick, a paper lantern,
a warm pebble and an empty hook. Duskwick used to light the way for everyone. It still remembers how."

These agree with CANON: Granny Wick was 12 on the night of the Ladder (§3.3), the Firstlight was lit from the first
Starseed (§2.1), the Lamplighters spent nearly every lamp on the Ladder (§3.3), and home lies N-NW of Duskwick.

<a id="duskwick-finds"></a>

### Duskwick: collectibles and finds (S-086)

Counts (CANON §10.3): **6 acorns · 4 keepsakes · 2 Hollows · 2 vistas · 10 chests · 1 bottle · 5 Lamp Logs**, plus 5
benches and 1 root-gate stub. Chests hold 30 gems each.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `chest-4` holds the Wickhaven Lantern String (`nook:lantern-string`), `chest-6` the Candle Gold hood trim (`trim_candle`), `chest-7` the "Lit Tower" Field Notes sticker (`sticker_duskwick`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests**

| id | Region · spot | Anchor | Gate | Visible |
|---|---|---|---|---|
| `chest-1` | Ember Sands · the Black Cove behind the Chimneys | (−138, −34) r 10 | none | always |
| `chest-2` | Ember Sands · the dark chamber at the end of the Sizzle Sands Tube | (−86, −58) r 5 | Lantern (dark zone) | always |
| `chest-3` | Coral Steps · inside the Coral Cupboard sea cave | (168, 96) r 4 | Lantern (dark zone) | always |
| `chest-4` | Tower Head · centre of the Candle Knoll ruin ring | (20, −32) r 6 | none | always |
| `chest-5` | Wickhaven · lagoon flats under the west decks | (−46, 112) r 6 | Tide Bell: ring the Mouth Rocks tide stone (low tide) | `ability:tide` (the chest is visible through the water from the boardwalk from ch8) |
| `chest-6` | Tower Head · top of Gull Stack | (160, −98) r 3 | Thistle Hook: hookbloom on Gull Stack, hooked from the plateau rim at (148, −100) | always (hookbloom visible) |
| `chest-7` | Tower Head · Lantern Stack top | (98, −176) r 4 | Leaf Glider from the Tower window ledge (h 32; 72 m glide range at 6 m/s forward, 2 m/s fall; the stack is 58 m away) | always |
| `chest-8` | Coral Steps · soft earth on the 6 m terrace | (150, 70) r 8 | Digging Paws | soft-earth mound always |
| `chest-9` | Ember Sands · soft earth beside the hot pools | (−104, −66) r 8 | Digging Paws | soft-earth mound always |
| `chest-10` | Coral Steps · behind thornglass at the north end of the top terrace | (120, 4) r 8 | Starsteel Sword | thornglass from S-233 (`placeIsleThornglass`); the chest is placed in S-086 behind a temporary coral-rock collider that S-233 swaps for the thicket |

**Sleeping Acorns** (snore within 10 m; woken with the Sunglass from `act2done`; each grows a sapling where it lay)

| id | Spot | Anchor |
|---|---|---|
| `acorn-1` | Candle Knoll, between the roots of the old palm by the summit ring | (12, −24) r 8 |
| `acorn-2` | Ember Sands, in a warm crack of the largest hot-pool rim | (−124, −46) r 6 |
| `acorn-3` | Wickhaven, in the flower box on house N2's deck (on deck) | (−20, 56) r 3 |
| `acorn-4` | Coral Steps, among coral shrubs on the 9 m terrace | (156, 20) r 8 |
| `acorn-5` | Tower Head, under the root-gate's root arch | (52, −108) r 5 |
| `acorn-6` | Tower Head, on the saddle beside the half arch | (82, −84) r 6 |

**Vistas** (`[E] Sketch · Vista`)

| id | Name | Spot | Looks at | Hoot's caption |
|---|---|---|---|---|
| `vista-1` | The Last Light | the Tower window ledge (120, −118), h 32 | the whole isle, the lagoon, home's Great Tree N-NW | "Duskwick from the Tower ledge. The lagoon is the shape of a bean. Or a kidney. Or a slightly disappointed moon." |
| `vista-2` | Steam and Stacks | Ember Sands dune top (−110, −8) r 8 | the Chimneys at dusk | "The Three Chimneys at sunset. I counted them four times and got three every time, which I find suspicious." |

**Bottle** `duskwick:bottle`: Ember Sands shore, bobbing at the waterline (−170, 30) r 10 (on sand within 3 m of
water). Letter: Bottle Chain letter 3 (`./lore.md#bottles`; see [Decisions](#decisions)).

**Lamp Logs** (5): `log-1` given by Granny Wick in ch8 (Long House door); `log-2` given at the first-beacon beat when
she reads it over the chart (`./story.md#beacon-1`); placed niches (`kit_log_niche`): `log-3` the Tower base, west
wall, (118, −126) r 3; `log-4` Ember Sands, the hot-pool terrace wall (−112, −58) r 6; `log-5` Coral Steps, behind a
star door on the Reef Shelf (170, 80) r 8 (Starsong, night only, S-208). Default numbers 1-5 (text in
`./lore.md#lamp-logs`).

**Hollow doors** (`kit_hollow_door`; rooms in `./dungeons.md#hollows`): `hollow-1` Ember Sands, in a dune bank
(−96, 4) r 8, the Lantern Hollow (dark-room puzzle); `hollow-2` Coral Steps, in the 9 m riser (128, 92) r 8, the
push-block Hollow. Names come from `./dungeons.md#hollows`.

**Benches** (`kit_bench`): `bench-1` Jetty Bench, Wick Square south rail (−2, 97) on deck; `bench-2` Knoll Bench,
Candle Knoll summit (24, −26); `bench-3` Tower Bench, saddle top (80, −88); `bench-4` Pool Bench, hot pools
(−108, −44); `bench-5` Fan Bench, top terrace (126, 30). Each sees its region's landmark.

**Root-gate** `duskwick:rootgate`: Tower Head's north plain (52, −112) r 6; root arch axis on bearing 337.5° (toward
home). Sealed stub until ch13 (`./systems.md#travel`).

<a id="duskwick-gates"></a>

### Duskwick: gate table (for the progression solver)

| Gate object | Where | Tool | Opens |
|---|---|---|---|
| dark zone | Sizzle Sands Tube; the Coral Cupboard | Lantern | chest-2, chest-3, `hollow-1` puzzle |
| tide stone | the Mouth Rocks, west row (−24, 156) | Tide Bell | lagoon flats (chest-5); low tide also lets Pip walk under the decks |
| hookbloom | Gull Stack top | Thistle Hook | chest-6 |
| glide gap | Tower window ledge → Lantern Stack | Leaf Glider (the ledge is open from ch8) | chest-7 |
| soft earth × 2 | 6 m terrace; hot pools | Digging Paws | chest-8, chest-9 |
| thornglass | top terrace north end | Starsteel Sword | chest-10 |
| star door | Reef Shelf | Starsong (night) | log-5 |
| Tower door | (121, −119) | `towerOpen` (3 beacons) | dungeon 5 |
| Vault gate | top of the Vault Stair | `mainEnding` | the Hundred Lamps (`./dungeons.md#o4`) |
| sealed root-gate | (52, −112) | ch13 or Digging Paws | root-gate travel |

Critical path (ch8, then ch12) needs only the Lantern; the Tower's own Sunglass is found inside it.

<a id="duskwick-poi"></a>

### Duskwick: points of interest

**Named sites** (`placeIsleSites`; each a `Look` line where marked):

| Site | Where | Look line |
|---|---|---|
| the Deep Lamp Pool | lagoon centre under Wick Square | - |
| Wick Square | (−8, 88) | - |
| the Hot Pools | (−118, −52) | "HOT POOLS. Toes first. Then the rest of you. — the Wicklings" (sign) |
| the Sizzle Sands Tube | mouth (−62, −40) | "A tunnel of glassy black rock. It's warm, and very, very dark." |
| the Black Cove | (−138, −34) | - |
| the Coco Grove | 14 palms round (−90, 40) | - |
| Candle Knoll ring | (20, −32) | (old beacon base, `kit_ruin_ring`) |
| the Saddle Arch | (84, −86) | (`kit_ruin_arch`) |
| Gull Stack | (160, −98) | "A tall rock full of gulls. One of them is sitting on something shiny and pretending it isn't." |
| Lantern Stack | (98, −176) | - |
| the Coral Cupboard | (168, 96) | - |
| the Reef Shelf | (160, 90) | - |
| the Lamp Hooks | top terrace edge (124, 20) → (148, 60), a hook every 2 m | - |
| the Mouth Rocks | (−24..8, 150-176) | - |
| the Vault door | (146, −140) | "A round stone door at the foot of the cliff, carved with a hundred little lamps. Every one is dark." |

**Curio types** (`placeIsleCurios`; reused props; count and anchors):

| Type | Prop | Count · anchors | Prompt · lines |
|---|---|---|---|
| Empty lamp-stand | `kit_ruin_lampstump` | 6 along P5 the Old Shore Walk, every ~45 m from (−140, −30) to (40, −118) | `Look · An empty lamp-stand` · "An old lamp-stand with an empty brass hook. The stone round the hook is worn smooth, as if somebody touched it every night for a very long time." |
| Chalk moth | chalk decal on a deck or rock | 3: north shore head (−4, 32), east shore head (70, 84), hot pools (−100, −40) | `Read · A chalk drawing` · "A chalk moth holding a lantern. Underneath, in wobbly letters: 'WICKHAVEN. MIND THE GAPS. MIND THE LAMPS. MIND YOUR NAN.'" |
| Coconut stash | `duskwick_coconut_pile` | 3 in the Coco Grove and on Tower Head (−84, 46), (−98, 30), (70, −130) | `Look · A pile of coconuts` · "A neat pile of coconuts, every one with a tooth mark. Somebody has been counting them." |
| Moth kite | kite card in a palm | 2: (−60, −10), (150, 0) | `Look · A kite` · "A paper kite shaped like a moth, stuck in the palm. Its string is tied in a very small, very determined bow." |
| Warm-toe sign | `sign` | 2: Ember Sands entry (−64, 22), Black Cove (−130, −30) | `Read · A sign` · "BLACK SAND IS WARM SAND. Walk quickly and look like you meant to." |

Fill pool for `placeIsleFill` (if needed): empty lamp-stand, moth kite.

**People** (S-088, S-092; looks in `./cast.md`): Granny Wick (`./cast.md#granny-wick`) day at the Long House door
(−34, 101), dusk at the Tower foot (124, −104); Flick (`./cast.md#flick`) on Wick Square by the mast (−4, 84); six
Wicklings at (−16, 82), (0, 94), (−50, 92), (40, 90), (−8, 50) and soaking in the hot pools (−116, −48); Kinako
(`./cast.md#kinako`) on the bazaar pier (20, 108) when the Bazaar is docked.

**Activities and story marks:** Clover's Dash course start post at the north shore head (−2, 34) (route below);
Lagoon Lights float point on Wick Square's north rail (−8, 79) (`./side-content.md#act-lagoon-lights`); fishing spots
(S-206) `fish-1` Wick Square west rail over the Deep Lamp Pool (−20, 88), `fish-2` the Reef Shelf (172, 88);
ss-15 *Moth to a Flame*: six sleepy-moth spots at (−120, −90), (−60, −138), (30, −60), (150, −40), (176, 60),
(−166, 20), each a moth asleep on a lamp-stand or rock, guided home to Wick Square at night with the Lantern
(`./side-content.md#ss-15`); ss-16 and ss-17 in the Library; ss-18 the spoon at Kinako's pier; ss-08 the stowaway kit
hides in the Bazaar's crates (22, 110); ss-13 Shellby's spot on Duskwick: the Jetty Bench.

**Clover's Dash, Duskwick** (S-133; rules in `./side-content.md#act-dash`): start (−2, 34) → ring gates at
(30, −10), (60, −60), (84, −88), (60, −112), (0, −120), (−60, −120), (−112, −70), (−110, −30), (−70, 20) → finish
back at the start. ≈ 640 m on P1, P5 and P2; tiers 75 s / 90 s / 110 s.

**POI count.** Finds 39 (4 landmarks, 10 chests, 4 keepsakes, 6 acorns, 2 vistas, 1 bottle, 3 placed logs, 2 Hollow
doors, 5 benches, 1 root-gate, 1 jetty) + sites 15 + curios 16 + gates not already counted 4 (tide stone, hookbloom,
Tower door, Vault door) = **74 at the finds step**; with people (9), activities (4) and story marks (7) **94**.
Required at 80,000 m²: 64.

<a id="duskwick-interiors"></a>

### Duskwick: interiors and doors

**Granny Wick's Library** (`duskwick_library`, interior realm, 48 m grid, S-167; no enemies). Door portal on the
Long House (−34, 101): `[E] Enter · Granny Wick's Library`. Rooms: the **Reading Room** (12 × 10 m): a spiral
bookcase with 30 numbered slots where found Lamp Logs shelve themselves in number order (each shelved log is
`Read`-able again), Granny Wick's chair facing a round window that frames the Tower; the **Map Table** (the original
Lamplighter's Chart, a `Look` that opens the World map tab); the **loft** (ladder-stair): Flick's workshop for ss-17
(a half-built clockwork moth, gears in jars). Night spot for Granny Wick: her chair.

**Stilt-house doors** (`Knock`; one line each, the second line from `act2done`):

| House | Before `act2done` | From `act2done` |
|---|---|---|
| W1 | "A sleepy voice: 'Mmf. Is it lamp time? ...It isn't. Wake me when it's lamp time.'" | "'It's lamp time! It's ALWAYS lamp time now!'" |
| W2 | A note on the door: "Gone to look at the dark. Back when it's lighter." | A new note: "Back. It's lighter. ✿" |
| W3 | "Three small moths peek out, blink at you, and close the door very, very slowly." | "Three small moths peek out and wave all their arms at once." |
| N1 | "'If you're selling candles, we have candles. If you're selling light... oh. You're a boy.'" | "'Oh, it's you! Come back any time. Bring the light.'" |
| N2 | The door is painted with a moth in a crown: "Queen of Wickhaven (it's a game)." | Under it, fresh paint: "and Pip (honorary)." |
| E1 | "Snoring. Then a different, smaller snoring." | "Humming. Then a different, smaller humming." |
| E2 | "'Granny Wick says not to open the door to strangers. You've got ears on your hood. Still not opening it.'" | "'Granny Wick says you're allowed. ...I'm still not opening it. It sticks.'" |
| E3 | A sign: "Wick-and-Wax Repairs. Closed until there's something worth lighting." | "Wick-and-Wax Repairs. OPEN. Mind the drips." |

<a id="duskwick-beacon"></a>

### Duskwick: the beacon and what changes

Duskwick's beacon is the Tower's great lamp. It is kindled at the end of chapter 12 (dungeon 5, `./story.md#ch12`),
not in the Act II isle loop. Within 10 s of kindling: the lamp room lights and its beam starts sweeping; the Wick
Mast's top lantern lights and the strings light down from it; every Wickling idles awake (wing-stretch); the music
gains its restored layer; home's crown lantern 4 lights. Mote then takes the Firstlight (scene); the ordinary flame
stays (CANON §4.4). Positional landmark sound: the Tower's lamp-room hum (a soft two-note chime every 12 s with the
beam), audible within 220 m from ch12.

<a id="duskwick-palette"></a>

### Duskwick: palette (`W.palette.duskwick`)

| Slot | Day | Dusk | Night |
|---|---|---|---|
| Sky top · horizon | `#6fb3d6` · `#f6dcb0` | `#2b2238` · `#ff8f7a` | `#141228` · `#2b2238` |
| Fog colour · near/far (m) | `#cfe3e0` · 90/270 | `#d9a08a` · 80/260 | `#2b2238` · 60/240 |
| Sun / moon · hemisphere sky/ground | sun `#fff0d0` · `#bfe0ea` / `#6a4a3a` | sun `#ffb27a` | moon `#cfd8ee` · `#3a3456` / `#1c1626` |
| Water shallow · deep · lagoon tint | `#3fa79a` · `#1f5f6e` · `#5cc6b4` | | |
| Window and lamp glow | `#f2b45a` | | |

Terrain layer slots (7; textures and prompts in `./art-audio.md#duskwick`): grass → `duskwick_grass` (sun-dried
palm grass), forest → `duskwick_leaf` (palm litter), meadow → `duskwick_bloom` (coral-pink flower turf), sand →
`duskwick_goldsand`, snow → `duskwick_blacksand` (black sand with gold flecks; footstep sound remapped to `sand`),
dirt → `duskwick_path`, rock → `duskwick_basalt`. Fallback: home layers tinted by the four CANON hexes
`#2b2238 #f2b45a #ff8f7a #3fa79a`.

<a id="duskwick-music"></a>

### Duskwick: music and ambience notes

Track `duskwick` (note data in `./art-audio.md#duskwick`): warm dusk marimba, 84 bpm, D major pentatonic, 16-bar
loop; the motif rises four notes and holds the fifth "like a lamp being lifted". **Dim state** (ch8 to ch12):
marimba alone, and the fourth bar of every phrase drops its final note (the missing light). **Restored** (`act2done`):
the dropped note returns, soft bells double the melody, a shaker and a warm pad enter. Region layers: Wickhaven adds
wind chimes; Tower Head drops to marimba and low pad; Coral Steps adds a pizzicato counter-line; Ember Sands adds a
slow hand-drum. Ambience beds: `lagoon` (lapping, paper-wing rustle, chimes), `cliffwind`, `reef`, `hotpools`
(bubbling, hiss, palm creak). Night: crickets, and from ch12 the Tower chime.

<a id="duskwick-kit"></a>

### Duskwick: prop kit and ART BRIEFs (S-084)

Instanced types (≤ 24): palm (reused `tree_palm`, recoloured trunk `#7a5a3e`, leaves `#3fa79a`), basalt rock (reused
`rock`, `#3b3540`), coral bush (reused `bush`, flowers `#ff8f7a`), coral shrub, small coral fan, driftwood, grass card,
flower card, shell deco, stilt house, moth lantern string, lamp-hook post, hot-pool rim, coconut pile, jetty post,
pot, `kit_bench`, `kit_ruin_pillar`, `kit_ruin_lampstump`, `kit_ruin_ring`, `kit_ruin_arch`, `kit_log_niche` = **22**.
Unique meshes: the Tower, the Wick Mast, the Three Chimneys, the Old Fan, the Long House, the Bazaar boat, Hollow
doors, the root-gate. New material programs: coral, basalt, moth-glass emissive, brass, limestone, plank, steam
(additive), lagoon water tint = **8** (≤ 12).

Prefix every image prompt with `./art-audio.md#style`. Manifest keys carry `realm: 'duskwick'`.

<a id="brief-duskwick-tower"></a>

**`duskwick_tower`: the Lamplighters' Tower (exterior).** Silhouette: a tall round stacked-stone tower tapering
gently, one round window two-thirds up, a glass lamp room and a cone cap with a spiral finial; an outer stair of
straight wooden flights wraps its lower half. Size: 28 m tall, base 9 m, top 6 m. Palette: stone `#d9cdb4` with
`#a89a80` mortar shadows, moss `#7f9a5a` at the base, slate cap `#4a4458`, brass `#b08a45`, lamp `#ffd27a`, stair
wood `#9b7b56`. Materials: toon stone, toon slate, emissive glass (lamp room, window), ink hull. Poly budget: ≤ 7,000
tris (LOD proxy ≤ 600 at > 120 m). Pose/animation: static; lamp beam (additive cone, 60 m) sweeps 360° every 12 s when
lit. Fallback: stacked cylinders with a cone cap, a ring of emissive glass, the stair as boxes. Image prompt
(turnaround reference, 1536 × 1024, opaque): "a tall round lighthouse-like tower of pale stacked stones on a grassy
headland, one round window two-thirds up, a glass lamp room at the top with an old brass lamp inside, a slate cone
roof topped by a small brass spiral, a wooden outside stair of straight flights wrapping the lower half, soft moss at
the base, warm evening light; front, side and back views". 3D prompt: "stylised stone tower 28 m tall, tapering round
body of stacked stones, one round window, glass lamp room with brass frame, slate cone cap with spiral finial, outer
wooden stair flights wrapping the lower half, hand-painted toon texture, origin at base centre".

<a id="brief-duskwick-wick-mast"></a>

**`duskwick_wick_mast`: the Wick Mast.** Silhouette: a tall mast of three lashed driftwood poles, three crossbars,
a rope ladder at the bottom, strings of lanterns fanning down from the top like a maypole. Size: 16 m, foot 1.4 m.
Palette: driftwood `#b8a080` / `#7a6450`, rope `#c9b48a`, lantern paper `#f6e6c4`, lantern glow `#f2b45a`.
Materials: toon wood; lantern strings are the `duskwick_moth_lantern` instances. Poly ≤ 1,800. Animation: none
(the lanterns sway). Fallback: three thin cylinders, three box crossbars. Image prompt (reference, 1024², opaque):
"a tall mast of three silvery driftwood poles lashed with rope, three crossbars, strings of small paper moth-shaped
lanterns fanning down from the top to a wooden square on stilts over a turquoise lagoon, dusk". 3D prompt: "stylised
16 m driftwood mast, three lashed poles, three crossbars, rope ladder at the base, attachment points for lantern
strings, toon shading".

<a id="brief-duskwick-chimneys"></a>

**`duskwick_chimney`: basalt sea stack (×3, one type).** Silhouette: a chunky black hexagonal-column stack, ragged
top, a thin steam plume. Size: 11-18 m tall (instance scale), r 3.5-5 m. Palette: basalt `#3b3540` / `#24212a`, wet
base `#1c1a20`, gold mineral streaks `#f2b45a`, steam `#ffffff` at 0.5. Materials: toon rock; steam is an additive
card (`duskwick_steam`, generated 256 × 512 webp alpha, 4-frame strip via `tools/process_strip.py`). Poly ≤ 900
each. Fallback: a stack of three hexagonal prisms; steam from `fx_atlas` puff. Image prompt (steam strip, 4 frames,
256 × 512 each, transparent): "a soft rising wisp of white steam, painterly, four frames of gentle drift, transparent
background". 3D prompt: "stylised black basalt sea stack made of hexagonal columns, 18 m tall, ragged top, gold
mineral streaks, toon shading".

<a id="brief-duskwick-old-fan"></a>

**`duskwick_old_fan`: the Old Fan.** Silhouette: one enormous flat sea-fan coral, a lattice of branching pink
fronds in a single plane on a short thick stalk. Size: 15 m tall, 13 m wide, 1.2 m deep. Palette: coral `#ff8f7a`,
tips `#ffd0c0`, stalk `#c8604f`, barnacles `#efe3c8`. Materials: toon coral; the lattice is alpha-tested cards
(`duskwick_fan_card`, generated 1024² webp alpha) on a 3D trunk-and-branch frame. Poly ≤ 2,400 (+ 6 cards).
Animation: none. Collider: stalk circle r 1.4. Fallback: a branching tube tree in one plane (12 tubes). Image
prompt (fan card, 1024², transparent): "a single huge pink sea-fan coral seen face-on, delicate branching lattice of
fronds, pale tips, painterly, transparent background". 3D prompt: "stylised giant flat sea-fan coral 15 m tall on a
thick stalk, branching lattice, pink, toon shading".

<a id="brief-duskwick-stilt-house"></a>

**`duskwick_stilt_house`: Wickling stilt house.** Silhouette: a small round-shouldered cabin on eight thin stilts,
a peaked thatch roof with two long curled tips like moth antennae, round door, round window, a lantern hook by the
door. Size: house 6 × 6 m, roof peak 6.5 m above deck, stilts 2 m below deck. Palette: planks `#c9a27a`, thatch
`#e2c38a`, trim `#2b2238`, door `#3fa79a`, window glow `#f2b45a`. Materials: toon wood, toon thatch, emissive window.
Poly ≤ 1,600. Fallback: box + cone roof + two curved tubes. Image prompt (reference, 1024², opaque): "a tiny round
wooden cabin on thin stilts over a turquoise lagoon, peaked straw roof with two long curling tips like moth antennae,
round teal door, round glowing window, a paper lantern by the door". 3D prompt: "stylised stilt cabin 6 × 6 m with
antenna-tipped thatch roof, round door and window, eight thin stilts, toon shading".

<a id="brief-duskwick-long-house"></a>

**`duskwick_long_house`: the Long House (Granny Wick's Library, exterior).** Silhouette: a long two-storey stilt
house with a round tower-window end facing the Tower, bookshelf-patterned shutters, a small loft dormer with a
chimney. Size: 14 × 10 m, 9 m tall. Palette: as the stilt house plus `#b55d4c` shutters. Poly ≤ 3,200. Fallback:
two boxes and a cylinder end. Image prompt: "a long two-storey wooden house on stilts over a lagoon, one rounded end
with a big round window, red shutters painted with little books, a loft dormer with a crooked chimney, lantern light
inside". 3D prompt: "stylised two-storey stilt house 14 × 10 m with a round window end and loft dormer, toon shading".

<a id="brief-duskwick-moth-lantern"></a>

**`duskwick_moth_lantern`: moth lantern string (instanced per lantern).** A paper lantern folded like a resting
moth, wings down, 0.35 m. Palette: paper `#f6e6c4`, wing veins `#c9a27a`, glow `#f2b45a`. Poly ≤ 60. Animation:
sway ±6° (vertex shader, no per-instance CPU). Fallback: an octahedron with emissive. Image prompt (icon/reference,
512², transparent): "a small paper lantern folded into the shape of a resting moth, wings down, warm light inside".
3D prompt: "tiny stylised paper moth lantern, 0.35 m, emissive core".

<a id="brief-duskwick-coral"></a>

**`duskwick_coral_shrub` and `duskwick_coral_small`: coral shrubs.** Rounded knobbly bushes of coral (0.6-1.4 m)
and small fans (0.8 m) on the terraces and reef. Palette: `#ff8f7a`, `#ffb38a`, `#e8708a`, lagoon accents `#3fa79a`.
Poly ≤ 220 / ≤ 140; LOD at 38-48 m. Fallback: icosphere clusters. 3D prompt: "stylised knobbly coral shrub, pink and
peach, 1 m, toon shading".

<a id="brief-duskwick-small"></a>

**Small props.** `duskwick_hot_pool_rim` (ring of black stones round a basin, r 3-5 by scale, ≤ 300 tris,
`#3b3540` with a steam card); `duskwick_lamp_hook_post` (a 1.4 m brass hook on a stone stub, ≤ 120 tris);
`duskwick_coconut_pile` (pyramid of 10 coconuts `#7a5a3e`, ≤ 200 tris); `duskwick_driftwood` (bleached log
2-4 m, `#c8b8a0`, ≤ 120 tris); `duskwick_bazaar_boat` (Kinako's Floating Bazaar: a wide round-bellied sailing barge
12 × 5 m with a striped awning `#e8c46a` / `#b55d4c`, crates and a hand-painted sign "Kinako's Floating Bazaar —
limited edition!!", ≤ 3,500 tris; if `./cast.md#kinako` also briefs the boat, cast.md wins). Each: fallback from
primitives in the listed colours; 3D prompt "stylised <thing>, toon shading, game-ready".

<a id="duskwick-coverage"></a>

### Duskwick: 40 × 40 m coverage plan

Grid 12 × 12 cells (448 m). Expected **≈ 62 land cells** at high water, ≈ 66 at low (the lagoon flats add 4).

| Area | Cells (approx.) | Passes by |
|---|---|---|
| Wickhaven decks and lagoon rim | 10 | finds (houses, mast, benches, people) and path |
| Candle Knoll and the saddle | 9 | finds (ring, chest-4, acorns, bench-2/3) and view (summit high point) |
| Tower Head plateau and north plain | 9 | finds (Tower, keepsake, root-gate, log-3) and path (P1) |
| Ember Sands dunes and pools | 12 | finds (pools, chests, bottle, Hollow, curios) and path (P2) |
| Coral Steps terraces and reef | 12 | finds (Fan, Lamp Hooks, chests, acorn, Hollow) and path (P3) |
| North coast (θ 300°-20°, r 120-170) | 7 | path P5 with six lamp-stand curios; root-gate |
| South-east beach by the mouth (θ 150°-175°) | 3 | the Mouth Rocks site, tide stone, fishing spot (later) |

Expected result: find ≈ 44, view ≈ 8, path ≈ 10, **fill 0-3 (≤ 12 % = 7)**. If the fill passes 7, add lamp-stands to P5
or a curio cluster on the south-east beach; never raise the fill cap. Low-tide state: the four flats cells pass by
chest-5 and the view from Wick Square (bench-1 within 60 m).

---

<a id="pinewhistle"></a>

## Pinewhistle

The pine isle north-north-west of home, and the **land template's vertical slice** (M13): two long ridges, a misty
ravine of rope bridges between them, a sawmill on the stream, the Acornet squirrels' town and, on the high north-east
end, the Whistling Pine. Dim state: the pine is silent, the mist hangs thick in the ravine, and the squirrels yawn
and cannot sleep. Restored: the pine sings, the mist thins, the town sleeps soundly at night.

<a id="pinewhistle-card"></a>

### Pinewhistle: identity card

| Field | Value |
|---|---|
| id | `pinewhistle` |
| Kind · grid · seed | overworld · 576 m (half 288) · `40223` |
| Land | ≈ 0.15 km² (test band: 138,000-162,000 m² reachable) |
| Recipe | `ridges` (`js/realms/recipes/ridges.js`) |
| Palette · music | `pinewhistle` · `pinewhistle` (wind flute) |
| Unlock | chart, after `ch8`; `hidden: true` until S-106 |
| Spawns | `jetty` (116, 140) facing 0° (the pine is dead ahead); `pine` (110, −106) facing 200° (Whistlehollow exit); `rootgate` (−146, 46) facing 157° |
| Tide | none |
| Steps | S-096 recipe · S-097 props · S-098 art · S-099 people · S-100 enemies · S-101 finds · S-102 Glider and home glide finds · S-103-S-105 Whistlehollow and Mossmantle · S-106 main chain · S-107 Hollows · S-110-S-113 side stories, Dash, Rook 1 · S-300/S-301 (as Hoot's Margins) |

<a id="pinewhistle-recipe"></a>

### Pinewhistle: the `ridges` recipe

Local frame: `u = (x − z)/√2` (toward NE), `v = (x + z)/√2` (toward SE); back to world: `x = (u + v)/√2`,
`z = (v − u)/√2`.

1. **Outline.** Ellipse in `(u, v)` with semi-axes 252 (u) × 192 (v), radius noise ±14 m (fbm, 4 cycles per turn).
   Max `|x|`, `|z|` ≈ 227, leaving ≥ 60 m of sea inside the grid. Shore drop as Duskwick's.
2. **Ridge A (north-west).** Crest line `v = −62 + 10·sin(u/70)`; crest height `22 + 16·smoothstep(60, 170, u)` (22 m in
   the south-west, 38 m where it joins Whistle Rise); gaussian cross-section σ 28 m.
3. **Ridge B (south-east).** Crest line `v = 56 + 8·sin(u/55 + 1)`; crest height `18 + 10·smoothstep(40, 150, u)`; σ 26 m.
4. **Whistle Rise.** Summit dome at (120, −120) (u ≈ 170, v ≈ 0), peak h 38, radius 55, joining both ridges; north
   face cliffs (slope > 1.0) on bearings 330°-60° around the summit.
5. **Central valley and ravine.** Valley base between the ridges falls from h 8 at u = 100 to h 1 at the south-west
   mouth. For `u ∈ [−60, 120]` the stream cuts a **ravine** 18-26 m wide with walls ≥ 8 m (slope > 0.9); the ravine
   floor is h 4-8. Five ramp notches 3 m wide let the floor path climb out: at u = −55, −5, 45, 85, 118.
6. **Spur ravines.** Four side ravines on the NW flank (v < −80) running NW to the coast at u = −120, −40, 40, 110,
   each 12 m deep and 14 m wide.
7. **Stream.** Spline: spring (95, −105) → (60, −60) → (21, −21) → (−20, 20) → (−55, 62) → (−71, 85) → (−110, 125) →
   mouth (−165, 165). Width 3-6 m, bed 0.4 m below banks (h ≥ −0.4, wadeable). **Upper Fall** at (60, −60) (4 m drop)
   with a dark grotto behind it; **Lower Fall** at (−20, 20) (3 m drop). A **mill pond** basin r 14 at (−92, 74).
8. **Rope bridges** (bridge decks 2.0 m wide, rope rails, sag 4 % of length; posts `pinewhistle_bridge_post`):

| Bridge | Centre | Length · axis | Deck h | Crosses |
|---|---|---|---|---|
| **the Long Bridge** | trestle (21, −21) | 64 m · 135°/315° (from (−1, −44) to (44, 1)) | 19 | the central ravine (Misthollow landmark) |
| Mossy Span | (−28, 28) | 28 m · 135°/315° | 10 | the ravine at u = −40 (broken until quest step 3) |
| Twin Planks | (67, −67) | 30 m · 135°/315° | 21 | the ravine at u = 95 |
| Fern Bridge | (−164, 6) | 18 m · 45°/225° | 12 | spur ravine u = −120 |
| Owl Bridge | (−108, −51) | 18 m · 45°/225° | 13 | spur ravine u = −40 |
| Hush Bridge | (−51, −108) | 18 m · 45°/225° | 14 | spur ravine u = 40 |
| Last Bridge | (−1, −157) | 20 m · 45°/225° | 15 | spur ravine u = 110 |
| Mill footbridge | (−66, 80) | 8 m (planks) | 3.5 | the stream at the sawmill |

9. **Paths** (2.2 m, `pinewhistle_path`): **Q1** jetty (120, 149) → Acornet square (92, 120) → **Acorn Pass**
   (54, 26), h 18 on Ridge B → the Long Bridge → its NW end (−1, −44) → Ridge A crest trail → (78, −134) → the pine
   (120, −120). **Q2** Acornet square → (20, 120) → (−40, 100) → sawmill (−71, 85). **Q3 the Mist Path** along the
   ravine floor: sawmill → Lower Fall (−20, 20) → under the Long Bridge → Upper Fall (60, −60) → spring (95, −105) →
   pine (south-west approach). **Q4 the Flank Trail** along v ≈ −112 from the Long Bridge's NW end across the four spur
   bridges to the Fern Cove (−180, 30). **Q5** the Rise loop (r 40 round the summit).
10. **Scatter.** Dense pines (target 1,050 trees on 0.15 km², ~0.007 per m², tall pines 18-26 m on the ridges),
    ferns, mossy rocks, bluebells in glades. Sightline corridors (6 m) from each entry point and bench to its
    landmark are kept clear of trees.

<a id="pinewhistle-regions"></a>

### Pinewhistle: regions and cards

Region rule (in `u, v`): **Whistle Rise** if `u ≥ 125` or within 70 m of the pine; else **Acornet Hollow** if
`v ≥ 64`; else **Sawmill Run** if `u < −45`; else **Misthollow Ravines**. Blend 12 m.

| # | id | Card | Entry point | Music layer · ambience | Enemies · max |
|---|---|---|---|---|---|
| 0 | `acornet` | **Acornet Hollow** · "Mind your acorns" | jetty spawn (116, 140) | town · `pines_town` (wind in needles, chatter, tiny doors) | `[]` · 0 (safe zone) |
| 1 | `misthollow` | **Misthollow Ravines** · "Rope bridges ahead" | Acorn Pass (54, 26) | mist · `mist` (muffled water, drips, rope creak) | `[['mossling', 3], ['pinecone_puff', 2], ['needle_wasp', 2]]` · 6 |
| 2 | `sawmill` | **Sawmill Run** · "Listen for the saws" | Q2 at (20, 118) | mill · `sawmill` (wheel creak, stream, woodpecker taps) | `[['bark_beetle', 3], ['mossling', 2], ['pinecone_puff', 2]]` · 6 |
| 3 | `whistlerise` | **Whistle Rise** · "Where the pine sings" | Q1 crest trail at (78, −134) | high · `pines_high` (gusts, the pine) | `[['needle_wasp', 3], ['bark_beetle', 2], ['pinecone_puff', 2]]` · 6 |
| - | dark zone | the grotto behind the Upper Fall | - | - | `[['dimling', 1]]` · 2 |

**Mist.** Misthollow overrides the fog: dim state near 25 m / far 140 m, colour `#e8efe9`; restored (`beacon:pinewhistle`)
60 / 220 m, lerped over 8 s. Landmarks keep the 0.45 fog cap, so the pine and the trestle top always show.

<a id="pinewhistle-landmarks"></a>

### Pinewhistle: landmarks

| Region | Landmark | Base | Height (top above sea) | Seen from | Keepsake |
|---|---|---|---|---|---|
| Whistle Rise | **the Whistling Pine** | (120, −120), h 38 | 34 m (72) | the whole isle; jetty at 260 m (ray clears Ridge B by 27 m) | `pinewhistle:keep-whistle` |
| Misthollow Ravines | **the Long Bridge Trestle** | (21, −21), ravine floor h 6 | 19 m (25): timber trestle 13 m to the deck + a 6 m pulley house and lamp pole | Acorn Pass, Fall Bench, both bridge ends | `pinewhistle:keep-tag` |
| Sawmill Run | **the Whistle Stack** | (−71, 85), h 3 | 18 m (21) | Q2 entry (97 m), Mill Bench | `pinewhistle:keep-music` |
| Acornet Hollow | **the Hoard Oak** | (84, 112), h 5 | 24 m (29) | jetty, Acorn Pass | `pinewhistle:keep-ledger` |

**The Whistling Pine.** A colossal pine on the summit, its trunk 3.2 m across at the base, with **knot-holes in a
spiral** up the trunk (13 holes, 0.4-0.7 m, one every ~2.4 m, turning 2.5 times: the Spiral, again). A crown **lamp
cradle** of woven branches at 30 m holds the beacon (`kit_beacon` 1.2×). At its roots on the south-west face, a
**root door** 2 m tall between two buttress roots with **four hip-height knot-holes** round it (quest step 4). Inside
is Whistlehollow (dungeon 2, `./dungeons.md#d2`). Dim: knot-holes dark, silent. Restored: knot-holes glow amber
`#f2b45a` in a spiral from the bottom up over 6 s, then the pine sings: a three-note chord (E3-B3-E4, wind-flute
timbre) swelling every 12 s, positional, audible to 260 m.

**The Long Bridge Trestle.** A tall timber trestle of crossed beams standing in the ravine, holding the Long Bridge's
middle; on the deck above it, a little pulley house with a lamp pole (`kit_ruin_lampstump` on a pole, unlit). The
Lamplighters and the Acornets built it together (keepsake).

**The Whistle Stack.** The sawmill's tall timber tower beside the waterwheel (wheel 9 m across), with five brass
saw-whistles on a gallery at 14 m (reached by an inside stair; a vista and ss-22 spot) and a weather vane shaped like
a saw. The sawmill shed (16 × 10 m) has an open front with a big circular saw (static).

**The Hoard Oak.** A vast, hollow oak (crown 22 m across), its trunk riddled with little round doors and rope ladders;
the Acornets' store and Elder Nutmeg's hall. Its crown is lit with tiny lanterns at night once the pine sings.

<a id="pinewhistle-keepsakes"></a>

### Pinewhistle: keepsakes (4 × 25 gems)

| id | Anchor | Prompt | Line 1 | Line 2 |
|---|---|---|---|---|
| `pinewhistle:keep-whistle` | NE (back) side of the pine's trunk, between two roots (128, −130) r 4 | `Look · Something whistling` | "A little wooden whistle carved like a pinecone, wedged in the bark round the back of the pine. When the wind blows, it plays one note." | "Carved on it: 'For the pine, so it is never the only one singing.'" |
| `pinewhistle:keep-tag` | NW foot of the trestle on the ravine floor (14, −28) r 4 | `Look · Something knotted` | "A rope tag knotted to the bottom of the trestle, faded to the colour of moss." | "Stitched into it: 'Built by the Lamplighters and the Acornets, together. Mind the third plank.' The third plank is new." |
| `pinewhistle:keep-music` | west (back) side of the Whistle Stack (−77, 88) r 4 | `Look · Something papery` | "A page of music sealed in a jar, the notes drawn as tiny pinecones." | "Its title: 'Whistling Pine, evening tune. Three notes. The Great Tree on the big isle hums the low one.'" |
| `pinewhistle:keep-ledger` | north (back) side of the Hoard Oak, in a knot (84, 100) r 4 | `Look · Something scratched` | "A tiny ledger in squirrel-scratch, hidden in a knot at the back of the oak." | "'Acorns kept: 4,012. Acorns from the Big Tree, kept safe for her till she wakes: 3. Acorns eaten by mistake: we do not talk about it.'" |

**Fifth line:** "A whistle, a rope tag, a page of music and a very small ledger. Pinewhistle has always kept things
for other people. Mostly songs. Sometimes acorns."

<a id="pinewhistle-finds"></a>

### Pinewhistle: collectibles and finds (S-101)

Counts: **10 acorns · 4 keepsakes · 3 Hollows · 3 vistas · 14 chests · 1 bottle · 2 Lamp Logs**, plus 5 benches and the
root-gate stub.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `chest-6` holds the Whistle Clock (`nook:whistle-clock`), `chest-9` the Pine Mist hood trim (`trim_pinemist`), `chest-11` the "Lookout Pine" sticker (`sticker_pinewhistle`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (30 gems each)

| id | Region · spot | Anchor | Gate |
|---|---|---|---|
| `chest-1` | Acornet Hollow · east cliff path above the sea | (150, 90) r 10 | none |
| `chest-2` | Acornet Hollow · Acorn Pass, by a ruin pillar | (50, 32) r 8 | none |
| `chest-3` | Sawmill Run · behind the log pile at the mill | (−84, 96) r 8 | none |
| `chest-4` | Sawmill Run · stream-mouth beach | (−150, 150) r 10 | none |
| `chest-5` | Misthollow · ravine floor under the Long Bridge | (16, −12) r 6 | none |
| `chest-6` | Misthollow · Fern Cove at the end of the Flank Trail | (−180, 30) r 10 | none |
| `chest-7` | Whistle Rise · grotto behind the Upper Fall | (62, −66) r 4 | Lantern (dark zone) |
| `chest-8` | Misthollow · **Fern Ledge** on the ravine's NW wall, h 14 | (50, −52) r 3 | Leaf Glider from Twin Planks (21 m deck, 24 m gap) |
| `chest-9` | Whistle Rise · **the Crow's Shelf**, h 52, above the north cliff | (140, −150) r 3 | Leaf Glider + the north-cliff updraft column (138, −140) |
| `chest-10` | Sawmill Run · **the Log Raft**, a moored log island in the mill pond | (−100, 70) r 3 | Leaf Glider from the Whistle Stack gallery (h 17, 30 m) |
| `chest-11` | Acornet Hollow · **the Lookout Pine** platform, 20 m up | (110, 70) r 2 | Thistle Hook (hookbloom on the platform rim) |
| `chest-12` | Misthollow · soft earth beyond Owl Bridge | (−118, −60) r 8 | Digging Paws |
| `chest-13` | Sawmill Run · soft earth in the logging camp | (−130, 60) r 8 | Digging Paws |
| `chest-14` | Whistle Rise · north slope, behind thornglass | (150, −170) r 8 | Starsteel Sword (S-233) |

**Sleeping Acorns.** `acorn-1` by the pine's root door (104, −104) r 6; `acorn-2` ravine floor by the Lower Fall
(−16, 24) r 6; `acorn-3` in the sawdust heap at the mill (−78, 76) r 6; `acorn-4` under the Debating Stump (70, 100)
r 6; `acorn-5` at Hush Bridge's far end (−44, −116) r 6; `acorn-6` on the Crow's Shelf (140, −150) r 3 (Glider);
`acorn-7`, `acorn-8`, `acorn-9` **in the Acornets' hoard** inside the Hoard Oak until ss-19 *The Acorn Hoard*
(`./side-content.md#ss-19`) completes; then the Acornets replant them at three spots marked with tiny acorn flags:
(30, 110), (60, −10), (170, −60), each r 6; `acorn-10` behind a **star door** in the ruin ring on Whistle Rise's west
shoulder (80, −140) r 6 (Starsong, night).

**Vistas**

| id | Name | Spot | Hoot's caption |
|---|---|---|---|
| `vista-1` | Over the Long Bridge | Acorn Pass (52, 28) r 6 | "The Long Bridge from Acorn Pass. The mist is not 'spooky'. It is wet air. I have tested this by standing in it." |
| `vista-2` | The Pine from Below | ravine floor by the Upper Fall (56, −54) r 6 | "The Whistling Pine, from the bottom of everything. It is either thirty-four metres or very tall. I ran out of string." |
| `vista-3` | Sawmill Evening | the Whistle Stack gallery (−71, 85), h 17 | "The sawmill pond at dusk. A woodpecker assures me the wheel goes round. I am reserving judgement." |

**Bottle** `pinewhistle:bottle`: stream-mouth beach (−168, 160) r 10. Bottle Chain letter 5.

**Lamp Logs:** `log-6` in the ruin ring niche on Whistle Rise's west shoulder (82, −136) r 4; `log-7` at the Flank
Trail ruin beyond Hush Bridge (−56, −126) r 6. Default numbers 6 and 7.

**Hollow doors** (S-107): `hollow-1` glide-gap Hollow, Owl spur ravine wall (−100, −40) r 8; `hollow-2`
updraft-timing Hollow, Whistle Rise south face (100, −90) r 8; `hollow-3` push-block Hollow, bank by the log flume
(−120, 110) r 8.

**Benches:** `bench-1` Jetty Bench (112, 140); `bench-2` Pass Bench (56, 24); `bench-3` Mill Bench (−60, 96);
`bench-4` Fall Bench, ravine floor (−8, 14); `bench-5` Rise Bench (108, −100).

**Root-gate** `pinewhistle:rootgate`: Sawmill Run's NW coastal plain (−150, 40) r 6, root arch on bearing 157.5°.

<a id="pinewhistle-chain"></a>

### Pinewhistle: the local chain on the ground (S-099, S-106)

The people → depths → Warden loop (CANON §4.4). Dialogue and beat flags are `./story.md#ch9-11`; this table is the
physical side. Steps 2 and 3 may be done in either order; step 4 needs both.

| Step | Region | What is there | Pip does | Sets |
|---|---|---|---|---|
| 1 | Acornet Hollow | Elder Nutmeg at the Hoard Oak door (80, 118) | Talk: the pine went silent, Mossmantle went up the Rise nine days ago, "the pine's door only opens to its own tune" | `pw:step1` |
| 2 | Sawmill Run | the waterwheel (−74, 82) jammed by three wedged logs (`Look · A jammed wheel`) | Swing each log twice; the wheel turns; the Whistle Stack plays the pine's three-note tune once (the player hears the order low-high-middle) | `pw:wheel` |
| 3 | Misthollow | Mossy Span hangs broken from its NW anchor; two loose pegs at the SE anchor (−36, 34); Professor Pinfeather stranded on the far side | Swing both pegs; the span snaps taut; Pinfeather crosses and gives **the knot-hole score** (key item `pinewhistle:score`) | `pw:score` |
| 4 | Whistle Rise | the root door's four knot-holes, numbered in the score as 2-4-1-3 | Hit the holes in score order (each whistles one note; wrong order hisses and resets after 1 s) | `pw:door`; `[E] Enter · Whistlehollow` |

After Mossmantle is calmed and the beacon kindled (`beacon:pinewhistle`), Mossmantle sits on **Mossmantle's Bough**
(132, −108), a low bent bough by the pine, humming along with it (`./cast.md`, `./creatures.md#boss-mossmantle`).

<a id="pinewhistle-gates"></a>

### Pinewhistle: gate table

| Gate | Where | Tool | Opens |
|---|---|---|---|
| dark zone | grotto behind the Upper Fall | Lantern | chest-7 |
| glide gap | Twin Planks → Fern Ledge | Leaf Glider | chest-8 |
| updraft column | Whistle Rise north cliff (138, −140), 18 m column | Leaf Glider | chest-9, acorn-6 |
| updraft column | Upper Fall spray (62, −58), lifts from the ravine floor to Twin Planks | Leaf Glider | a shortcut out of the ravine |
| glide gap | Whistle Stack gallery → the Log Raft | Leaf Glider | chest-10 |
| hookbloom | Lookout Pine platform rim (110, 70), 20 m up | Thistle Hook | chest-11 |
| soft earth × 2 | beyond Owl Bridge; logging camp | Digging Paws | chest-12, chest-13 |
| thornglass | Whistle Rise north slope | Starsteel | chest-14 |
| star door | Rise ruin ring | Starsong (night) | acorn-10 |
| root door | the pine | quest step 4 | Whistlehollow |

The critical path needs the Lantern (the Whistlehollow rooms, `./dungeons.md#d2`) and, inside, the Glider.

<a id="pinewhistle-poi"></a>

### Pinewhistle: points of interest

**Sites:** the Upper Fall (60, −60); the Lower Fall (−20, 20); the Spring (95, −105); Mossy Span; Twin Planks; Fern,
Owl, Hush and Last Bridges; the mill pond (−92, 74); the Log Flume (logging camp (−130, 60) → mill (−80, 82), a
raised timber trough on trestles, decorative); the Logging Camp (−130, 60); Acorn Pass (54, 26); the Debating Stump
(70, 100), a huge flat stump with three tiers of tiny seats; the Lookout Pine (110, 70); the Crow's Shelf
(140, −150); Mossmantle's Bough (132, −108); the Fog Pockets (three side hollows of the ravine where mist pools:
(−12, 40), (30, −4), (70, −76)); the Stream Mouth (−165, 165); Fern Cove (−180, 30); Hush Cove (−50, −170); the Sap
Pool (−40, −20), a small amber pool in a pine stand (`Look` "Pine sap, pooled and set like amber. A beetle is stuck in
it, looking embarrassed."); Echo Rock (−80, −90) (`Look` "Say something to the rock. ...Well. The rock heard you."); the
Hollow Log (150, −90), a fallen giant pine you can walk through; the Bluebell Glade (−20, 80). **25 sites.**

**Curio types:**

| Type | Prop | Count · anchors | Prompt · lines |
|---|---|---|---|
| Acorn store door | `pinewhistle_store_door` on a trunk | 8: round Acornet Hollow and along Q1/Q2 within 120 m of the Hoard Oak, ≥ 25 m apart | `Look · A tiny door` · one of: "A tiny door in the trunk. A sign says 'STORE 14. FULL.' Underneath, smaller: 'ALSO FULL.'" / "A tiny door with a tiny padlock. The padlock is an acorn." / "A tiny door. From inside comes the sound of someone counting, very quietly." |
| Trail post | `pinewhistle_trail_post` | 6 along Q3 and Q4, every ~70 m | `Read · A trail post` · "MIST PATH. Keep the water on your left going up and on your right going down. If it's on neither side, sit down and wait for a squirrel." |
| Pecked diagram | decal on a pine trunk | 4: (40, 90), (−30, 60), (90, −40), (−80, −20) | `Look · A carving` · "Somebody has pecked a very neat diagram into this trunk: a pine, an arrow, and the word 'WRONG' next to a drawing of an owl." |
| Sawmill sign | `sign` | 2 at the mill: (−58, 90), (−90, 100) | `Read · A sign` · "SAWMILL. Listen for the saws. If you can't hear the saws, the saws can't hear you either." |
| Empty lamp-stand | `kit_ruin_lampstump` | 6 along the Flank Trail Q4, every ~40 m | `Look · An empty lamp-stand` (Duskwick's line) |
| Pinecone cairn | stacked stones + pinecone | 6 on ridge crests: (−60, −80), (0, −90), (60, −110), (−100, 20), (20, 60), (130, 20) | `Look · A little cairn` · "Somebody balanced a pinecone on top of a stack of stones. It's been here long enough to grow moss. Nobody has dared take it off." |

Fill pool: pinecone cairn, trail post.

**People** (S-099): Elder Nutmeg (`./cast.md#elder-nutmeg`) at the Hoard Oak door (80, 118); Professor Pinfeather
(`./cast.md#professor-pinfeather`) at the Debating Stump (70, 100) after quest step 3 (before it, stranded at
(−22, 22)); six Acornets round the square (92, 120), (100, 108), (76, 128), (110, 126), (60, 112), (88, 96); two
woodpecker carpenters at the sawmill (−66, 90), (−80, 80); Mossmantle at his Bough after the calm; Rook at Acorn Pass
during his race (S-113). **12.**

**Activities and story marks:** Clover's Dash course (S-112): start at the Jetty Bench (112, 140) → gates (60, 128),
(0, 116), (−50, 98), (−66, 80), (−28, 28) over Mossy Span, (−8, 14), (54, 26) → finish (92, 120); ≈ 560 m; tiers
80 s / 95 s / 120 s. **Rook's Races part 1** (S-113, `./side-content.md#ss-49`): Pass Bench (56, 24) → the Long Bridge →
Ridge A crest trail → the pine's root door (114, −112); 420 m; Rook's ghost time 70 s. Fishing (S-206): `fish-1` the
mill pond (−92, 66), `fish-2` the stream mouth (−158, 158). ss-19: the Hoard Oak and the three acorn-flag spots;
ss-20: the Debating Stump; ss-21 *Lost in the Mist*: one Acornet kit in each Fog Pocket, found by their giggles (positional,
within 20 m); ss-22: the five whistles on the Whistle Stack gallery; ss-13: Shellby's spot is the middle of the Long
Bridge.

**POI count:** finds 45 (4 landmarks, 14 chests, 4 keepsakes, 7 placed acorns, 3 vistas, 1 bottle, 2 logs, 3 Hollow
doors, 5 benches, root-gate, jetty) + sites 25 + curios 32 + gates 4 (2 updrafts, hookbloom, root door) + quest props 2
(jammed wheel, loose pegs) = **108 at the finds step**; with people (12) **120** at unhide (S-106); with activities and
story marks **135**. Required at 150,000 m²: 120.

<a id="pinewhistle-interiors"></a>

### Pinewhistle: interiors and doors

No interior realms. Whistlehollow (`./dungeons.md#d2`) is the only way inside anything. Doors (`Knock`; second line
from `beacon:pinewhistle`):

| Door | Before | After |
|---|---|---|
| Hoard Oak, main | A sign: "HOARD. Authorised squirrels only. Unauthorised squirrels: also only." | (same) |
| Treehouse A (100, 108) | "'We're not asleep! We CAN'T sleep! That's the whole problem!'" | "Zzz. (A very contented zzz.)" |
| Treehouse B (76, 128) | A kit's voice: "'Is the pine singing yet?' ...'Is it singing NOW?'" | "'IT'S SINGING! Shh. Listen.'" |
| Treehouse C (110, 126) | "Someone inside is humming the pine's tune, badly, to help." | "Someone inside is humming along with the pine, slightly behind." |
| Pinfeather's study, a pecked hollow in a pine (64, 104) | A note: "Professor Pinfeather is IN. She is also BUSY. She is also RIGHT." | (same) |

<a id="pinewhistle-beacon"></a>

### Pinewhistle: the beacon and what changes

Beacon: the crown lamp in the pine's lamp cradle (30 m). Kindled at its heart in Whistlehollow's last room
(`./dungeons.md#d2`); Pip exits to spawn `pine`. Within 10 s of `beacon:pinewhistle`: the knot-holes glow up the
spiral (6 s), the crown lamp lights, the pine sings (first chord at 6 s), the Misthollow mist starts thinning (8 s),
the music switches to its restored layer, home's next crown lantern lights and horizon card a gets its night window
(`./story.md#beacon-1`). The plaza visitor is an Acornet kit (`./cast.md`).

<a id="pinewhistle-palette"></a>

### Pinewhistle: palette (`W.palette.pinewhistle`)

| Slot | Day | Dusk | Night |
|---|---|---|---|
| Sky top · horizon | `#8fbfd8` · `#e8efe9` | `#3a4a6a` · `#c98b4b` | `#121a24` · `#2f4a3a` |
| Fog colour · near/far | `#dfe8e2` · 100/280 | `#b89a7a` · 90/260 | `#1e2a2a` · 60/240 |
| Sun / moon · hemisphere | sun `#fff6e0` · `#cfe0d8` / `#3a3020` | sun `#ffc08a` | moon `#d8e0ee` · `#2a3440` / `#141a18` |
| Water shallow · deep | `#6fa89a` · `#2a5a5a` | | |
| Window glow | `#f2b45a` | | |

Terrain slots (`./art-audio.md#pinewhistle`): grass → `pinewhistle_moss`, forest → `pinewhistle_needles`, meadow →
`pinewhistle_fern`, sand → `pinewhistle_shingle`, snow → `pinewhistle_sawdust` (sound `dirt`), dirt →
`pinewhistle_path`, rock → `pinewhistle_granite`. Fallback tint hexes `#2f4a3a #8fae9a #c98b4b #e8efe9`.

<a id="pinewhistle-music"></a>

### Pinewhistle: music and ambience notes

Track `pinewhistle`: wind flute, 72 bpm, E dorian, 16 bars. **Dim:** flute alone; each phrase ends on a held breath
with no answer. **Restored:** the pine's E-B-E answer enters every 4 bars as a soft organ-like drone, plus pizzicato
strings and a woodblock. Layers: Acornet Hollow adds a plucked "tiny-door" ostinato; Misthollow mutes the flute and
adds a rain-stick; Sawmill Run adds saw-rasp on beats 2 and 4 and the whistle motif (the same three notes as the
pine); Whistle Rise adds wind gusts. Ambience beds: `pines_town`, `mist`, `sawmill`, `pines_high`.

<a id="pinewhistle-kit"></a>

### Pinewhistle: prop kit and ART BRIEFs (S-097)

Instanced types (≤ 24): pine (reused `tree_pine`, recoloured `#2f4a3a`), tall pine, fir sapling, oak (reused
`tree_round`, recoloured), fern, mossy rock (reused `rock`), stump (reused), log pile, bridge post, treehouse, store
door, trail post, sawdust heap, pinecone deco, grass card, flower card (bluebells `#6f7fd0`), lantern (Acornet,
reused `lamp`), jetty post, pot, `kit_bench`, `kit_ruin_pillar`, `kit_ruin_lampstump`, `kit_ruin_ring`,
`kit_log_niche` = **24**. Unique meshes: the Whistling Pine, the trestle and pulley house, the sawmill (shed, wheel,
stack), the Hoard Oak, the Log Raft, Hollow doors, root-gate. New material programs: needles, bark, moss, brass,
amber knot-glow (emissive), rope, plank, mist card = **8**.

<a id="brief-pinewhistle-pine"></a>

**`pinewhistle_whistling_pine`: the Whistling Pine.** Silhouette: a colossal, slightly leaning pine with layered
drooping boughs, a spiral of round knot-holes winding up the trunk, a woven-branch lamp cradle near the top, two
buttress roots framing a door. Size: 34 m tall, trunk 3.2 m at base, crown 16 m across. Palette: bark `#6e4a32` /
`#c98b4b` highlights, needles `#2f4a3a` / `#4f6e52`, knot-holes dark `#2a1e16` → lit `#f2b45a`, lamp `kit_beacon`,
moss `#7f9a5a`. Materials: toon bark, needle cards on bough frames, emissive knot-hole discs (13), ink hull. Poly
budget: ≤ 9,000 tris (LOD proxy ≤ 900). Animation: bough sway ±2° (vertex); knot-hole glow sequence. Collider: trunk
circle r 1.8 + root circles. Fallback: a tall cone stack with dark disc decals in a spiral. Image prompt (turnaround,
1536 × 1024, opaque): "a colossal old pine tree on a hilltop, layered drooping boughs, round knot-holes spiralling up
its trunk two and a half times, a woven-branch cradle near the top holding an old brass lantern, a round door between
two buttress roots, soft mist below; front, side and back views". 3D prompt: "stylised giant pine 34 m tall, spiral of
13 knot-holes on the trunk, woven lamp cradle at 30 m, root door between buttress roots, hand-painted toon texture,
origin at base".

<a id="brief-pinewhistle-trestle"></a>

**`pinewhistle_trestle`: the Long Bridge Trestle.** Silhouette: a tall X-braced timber tower in a ravine with a
small pulley house and lamp pole on top where the rope bridge passes. Size: 13 m to the deck, 19 m to the lamp top,
footprint 6 × 4 m. Palette: timber `#8a6a48` / `#5e4a34`, rope `#c9b48a`, pulley house roof `#c98b4b`, moss
`#7f9a5a`. Poly ≤ 2,600. Fallback: boxes and crossed thin boxes. Image prompt: "a tall wooden trestle tower of
crossed beams standing in a misty ravine, holding up the middle of a long rope bridge, a little pulley house with a
lamp pole on top, moss on the lower beams". 3D prompt: "stylised timber trestle 13 m tall with X bracing, pulley house
and lamp pole above a bridge deck, toon shading".

<a id="brief-pinewhistle-sawmill"></a>

**`pinewhistle_sawmill`: sawmill, waterwheel and Whistle Stack.** Silhouette: an open-fronted timber shed with a big
round saw, a 9 m undershot waterwheel on the stream side, and a tall square timber tower with a gallery of five brass
whistles and a saw-shaped vane. Size: shed 16 × 10 × 7 m; wheel 9 m; stack 18 m. Palette: timber `#9b7b56`, roof
shingles `#5e4a34`, brass `#b08a45`, saw steel `#b8c0c8`, sawdust `#e2c38a`. Animation: wheel turns 0.4 rad/s once
quest step 2 is done (before: still). Poly ≤ 5,500 total. Fallback: boxes, a cylinder wheel with box paddles. Image
prompt: "a cosy timber sawmill on a forest stream, an open shed with a big round saw, a large wooden waterwheel, a tall
square tower with a gallery of five brass whistles and a weather vane shaped like a saw blade, pines around". 3D
prompt: "stylised sawmill set: open shed, 9 m waterwheel (separate mesh for rotation), 18 m whistle tower with
gallery, toon shading".

<a id="brief-pinewhistle-oak"></a>

**`pinewhistle_hoard_oak`: the Hoard Oak.** Silhouette: an enormous broad oak, trunk riddled with small round doors
and windows, rope ladders, tiny balconies; lanterns in the crown. Size: 24 m tall, crown 22 m, trunk 4 m. Palette: bark
`#7a5a3e`, leaves `#6f8f4a` / `#8fae5a`, doors `#c98b4b`, lantern `#f2b45a`. Poly ≤ 7,000 (LOD ≤ 800). Fallback:
cylinder trunk + three icosphere canopy clumps + door decals. Image prompt: "an enormous old oak tree that squirrels
live in, its trunk dotted with little round doors and windows, rope ladders and tiny balconies, small lanterns in the
branches, warm afternoon light". 3D prompt: "stylised giant oak 24 m with squirrel-town details: round doors,
balconies, ladders, toon shading".

<a id="brief-pinewhistle-small"></a>

**Smaller Pinewhistle props.** `pinewhistle_tall_pine` (18-26 m pine, narrow, ≤ 400 tris, LOD ≤ 120);
`pinewhistle_treehouse` (a round hut wrapped round a trunk at 3-6 m with a ladder, 4 m across, ≤ 900 tris, door
`#c98b4b`); `pinewhistle_bridge_post` (a 2.4 m post pair with rope wraps, ≤ 120 tris; deck planks are a
`pinewhistle_planks` texture on the bridge mesh); `pinewhistle_store_door` (a 0.4 m round door with a tiny acorn
padlock, decal-backed, ≤ 60 tris); `pinewhistle_trail_post` (1.3 m post with a pinecone sign, ≤ 90 tris);
`pinewhistle_log_pile` (stacked logs 3 × 2 m, ≤ 260 tris); `pinewhistle_sawdust` (low golden mound, ≤ 80 tris);
`pinewhistle_log_raft` (8 × 5 m lashed logs with a mooring post, ≤ 400 tris). Palette from the land hexes. Fallbacks
from primitives. 3D prompts: "stylised <thing>, Pinewhistle pine-forest set, toon shading, game-ready".

<a id="pinewhistle-coverage"></a>

### Pinewhistle: 40 × 40 m coverage plan

Grid 15 × 15 cells (576 m). Expected **≈ 108 land cells**.

| Area | Cells | Passes by |
|---|---|---|
| Acornet Hollow (SE flank) | 22 | finds, people, curios (store doors), path Q1/Q2 |
| Central ravine (Misthollow) | 20 | path Q3, bridges, Fog Pockets, chest-5, Fall Bench view |
| NW flank and spur ravines | 22 | path Q4 with lamp-stands, four bridges, Hollow, chest-12, coves |
| Sawmill Run and the SW tip | 22 | the mill, chests, bottle, root-gate, flume, camp |
| Whistle Rise | 16 | the pine (high point), Crow's Shelf, ruin ring, Hollow Log, cairns |
| Far SE coast north of Acornet (u 60-120, v 120-190) | 6 | the Lookout Pine, chest-1, cairn (130, 20) |

Expected: find ≈ 74, view ≈ 14, path ≈ 16, **fill 0-4 (cap 12 % = 13)**. Weakest cells: the NE coast past Last Bridge;
if they fail, extend Q4 to Last Bridge's far side with two more lamp-stands rather than relying on fill.

---

<a id="archwater"></a>

## Archwater

The rock isle east-south-east of home: a stepped plateau of hexagonal basalt columns, tide flats, tide pools, kelp
shallows, sea caves, the otters' floating village (the Raft) and the Great Arch over the Moon Pool. Its signature is a
**two-state tide**. Dim state: the arch lamp is dark and the tide is stuck at low water, so the Raft sits beached and
tilted on the mud; sunny, but the sea is silent and nothing spouts. Restored: the tide turns and comes in, the Raft
floats level, the Spouter spouts, kelp sways.

<a id="archwater-card"></a>

### Archwater: identity card

| Field | Value |
|---|---|
| id | `archwater` |
| Kind · grid · seed | overworld · 512 m (half 256) · `40231` |
| Land | ≈ 0.11 km² at low water (test band 100,000-120,000 m²); ≈ 0.10 km² at high water |
| Recipe | `basalt` (`js/realms/recipes/basalt.js`) |
| Palette · music | `archwater` · `archwater` (plucked strings) |
| Unlock | chart, after `ch8`; `hidden: true` until S-127 |
| Spawns | `jetty` (−206, 12) facing 90°; `grotto` (128, −62) facing 270° (Undertow Grotto exit); `rootgate` (−56, 104) facing 292° |
| Tide | flag `tide:archwater` ∈ {`low`, `high`}; stuck `low` until `beacon:archwater`, which sets `high`; afterwards the Tide Bell at any of the five tide stones toggles it. `waterY`: high 0, low −1.4 |
| Steps | S-117 recipe · S-118 props · S-119 art · S-120 people · S-121 enemies · S-122 Tide Bell and home tide finds · S-123 finds · S-124-S-126 Undertow Grotto and Old Gloop · S-127 main chain · S-128 II.M (if second) · S-129 Hollows · S-131-S-133 side stories, Juggling, Dash, Rook 2 |

<a id="archwater-recipe"></a>

### Archwater: the `basalt` recipe

1. **Outline.** High-water shore radius `176 + 16·fbm(θ; 3 octaves, 4 cycles)`. **The Raft bay**: an ellipse at
   (−178, 10), `rx 46`, `rz 56`, open to the west, floor h −1.0 (mud at low water, 1 m deep at high).
2. **Tide flats.** Outside the high-water shore a flats band falls from h −0.2 at the shore to −1.3 at 18 m out, then
   to −4 beyond. On bearings 20°-110° (Kelp Shallows) the band is 48 m wide. At low water (`waterY −1.4`) every flats
   cell is walkable (`h ≥ −1.8`); at high water only cells with `h ≥ −0.4` are.
3. **The plateau.** Centre (−20, −50). `base = 30·(1 − d/150)^1.3 + fbm(4 m)`, quantised to 2.4 m terraces
   (`h = 2.4·floor(base/2.4)`); terrace risers > 0.85 m are cliffs with hexagon-column stamps
   (`archwater_column`). Paths cut **column stairs** (ramps of 0.6 m steps) through every riser they cross. Top
   terrace h 30.
4. **The Watch Column.** A freestanding hexagonal column at (−20, −60) on the top terrace, 24 m tall, 7 m across, with
   an **outer stair** of eight straight bridge-deck flights (1.2 m, 3 m rise each) wrapping it to a top platform
   (r 3.5, h 54) holding a dark Lamplighter lamp cage (`kit_beacon` 0.8×).
5. **The Great Arch and the Moon Pool.** Arch legs at (130, −70) (west leg on the plateau edge, ground h 6) and
   (170, −70) (east leg on **the East Stack**, r 9, top h 6, a ramp of fallen columns on its west side down to the
   flats); span 40 m, underside crown 22 m, top 26 m; a flat walkable crown deck 10 m long, 3 m wide at h 26 from
   x 145 to 155. **The Moon Pool**: a round basin r 12 at (150, −70), floor h −2.0 (always water). **The Spire
   Stack**: a sheer slim stack at (196, −84), r 4, top h 6 (unclimbable at any tide).
6. **Undertow Grotto door.** A pearl door (three sockets) on a ledge at (134, −64), h 1.2, in the west leg's base,
   facing east over the pool; a stair from the plateau edge (122, −58) reaches it. Reachable at both tides.
7. **Tidepool Shelf.** Bearings 110°-230°, a low rock shelf h 0.2-1.6 with 40 tide-pool decals and 12 real pool
   basins (r 2-4, floor −0.6), **the Great Tidepool** (r 7, floor −2.0, at (50, 130), three drain slots in its rim),
   and **the Spouter**: a rock dome r 10, top h 12, at (90, 120), with a blowhole and a Lamplighter tide post (4 m,
   painted rings) on top.
8. **Kelp Shallows.** The wide east flats: kelp beds (`archwater_kelp`, swaying when submerged) and **the Kelp Maze**,
   a 36 × 36 m maze of 1.6 m kelp walls on the flats centred (190, 10) (walkable at low water only). Sea caves in the
   NE cliff: **Gull Cave** (110, −140) and **Echo Cave** (60, −170), each 10 m deep, dark.
9. **The Pool Steps.** A sea-fed basalt pool on the NW lowland at (−120, −110), r 14, floor −1.6, holding six
   **pumice pontoons** (hexagonal floating column tops, bridge decks whose height follows the water: +0.2 above
   `waterY`) that make stepping stones to a column top (−128, −118) h 1.6 only at high water.
10. **Paths** (2.4 m, `archwater_path`): **W1** landing → Raft → bay north shore (−176, −52) → column stairs →
    the top terrace → the Watch Column. **W2** top terrace → east edge (100, −50) → the grotto stair (122, −58).
    **W3** top terrace → south terraces → Tidepool Shelf (40, 80) → the Spouter → the Great Tidepool. **W4** the Raft's
    south shore → Tidepool Shelf west (−60, 110). **W5** the NW lowland loop: bay north shore → Pool Steps → Hex Maze
    edge → North Bench (−80, −150). All paths stay at h ≥ 0.2, so they work at both tides.

<a id="archwater-raft"></a>

### Archwater: the Raft (the town)

Fourteen log rafts lashed together in the bay, 60 × 44 m, centre (−168, 10). Each raft is a bridge deck with two
heights: **low water** deck top h −0.2 (sitting on the mud, drawn tilted up to 4°; walk height level per raft) and
**high water** deck top h +0.6, level and gently bobbing (±0.05 m visual only). Rafts join by 1.2 m rope-and-plank
gaps (walkable). **The landing**: a fixed pier on posts from the rafts' west edge (−195, 12) to (−222, 12), deck h 1.2,
joined to the rafts by a 6 m hinged gangway (slope 0.23 at low, 0.10 at high). The *Dandelion* moors at (−218, 16).
Seven cabins (5 × 4 m) on the rafts; the **main raft** at (−166, 6) carries Rafferty's Mast and the door to the Raft
cabins interior (−162, 2).

When the tide changes, any Pip standing on a cell that stops being walkable is lifted to the nearest walkable cell
with a 0.4 s fade and no damage (`./systems.md#gates`); NPCs and enemies on flats re-path or poof quietly.

<a id="archwater-regions"></a>

### Archwater: regions and cards

Region rule: **The Raft** = the bay and land within 40 m of the bay ellipse and the landing; else **Basalt Stairs** if
high-water `h ≥ 8`; else by bearing: **Kelp Shallows** [20°, 110°) (including the arch, the stacks and the Moon Pool),
**Tidepool Shelf** [110°, 230°), and **Basalt Stairs** [230°, 20°) (the NW boulder lowland).

| # | id | Card | Entry point | Music layer · ambience | Enemies · max |
|---|---|---|---|---|---|
| 0 | `raft` | **The Raft** · "Mind the gap" | jetty spawn (−206, 12) | town · `raft` (rope creak, otter chatter, gulls) | `[]` · 0 (safe zone) |
| 1 | `basalt` | **Basalt Stairs** · "Hexagons everywhere" | W1 at the bay north shore (−176, −52) | stone · `basalt` (wind over columns, tap echoes) | `[['squirt_urchin', 3], ['tidepool_jelly', 3]]` · 6 |
| 2 | `tidepool` | **Tidepool Shelf** · "Low tide, high hopes" | W3 at (40, 80) | glassy · `tidepool` (drips, pops, crabs clicking) | `[['tidepool_jelly', 4], ['squirt_urchin', 2], ['sand_snapper', 2]]` · 6 |
| 3 | `kelp` | **Kelp Shallows** · "Squelchy" | W2 at the east edge (100, −50) | deep · `kelp` (low water: squelch and pop; high water: swell on stone) | `[['sand_snapper', 4], ['tidepool_jelly', 2]]` · 6 |
| - | dark zones | Gull Cave, Echo Cave | - | - | `[['dimling', 1]]` · 2 |

Enemies spawn only on cells walkable in the current tide state.

<a id="archwater-landmarks"></a>

### Archwater: landmarks

| Region | Landmark | Base | Height (top above sea) | Seen from | Keepsake |
|---|---|---|---|---|---|
| Kelp Shallows | **the Great Arch** over the Moon Pool | legs (130, −70) and (170, −70) | 26 m tall, 40 m span (26) | east edge entry (50 m), Arch Bench, the Watch Column top | `archwater:keep-ring` |
| Basalt Stairs | **the Watch Column** | (−20, −60), top terrace h 30 | 24 m (54) | jetty spawn (199 m; ray clears the terraces by ≥ 12 m), every bench | `archwater:keep-lens` |
| Tidepool Shelf | **the Spouter** | (90, 120) | 12 m dome + 4 m tide post (16) | W3 entry (60 m), Spout Bench | `archwater:keep-shanty` |
| The Raft | **Rafferty's Mast** | (−166, 6) on the main raft | 18 m above deck (17.8 low, 18.6 high) | jetty spawn | `archwater:keep-oar` |

**The Great Arch.** A natural sea arch of stacked dark basalt columns, its span curving over the Moon Pool, barnacles
and kelp hanging from the underside, a Lamplighter lamp cage (`kit_beacon` 1.4×) bolted to the keystone. Dim: the
lamp is dark and the pool is grey. Restored: the lamp lights, a soft beam falls straight down onto the Moon Pool,
which glows `#bff4f0` at night.

**The Spouter.** A rounded rock dome with a blowhole: at high water it spouts a 10 m plume every 8 s (spout card
strip, a whoosh); at low water it only breathes a faint hiss. The tide post on top shows the water level by painted
rings.

**Rafferty's Mast.** A tall raft mast with a crow's nest, a long pennant `#6b4a8c`, and bunting strung to the
cabins; tilted with the raft at low water, upright at high.

<a id="archwater-keepsakes"></a>

### Archwater: keepsakes (4 × 25 gems)

| id | Anchor | Prompt | Line 1 | Line 2 |
|---|---|---|---|---|
| `archwater:keep-ring` | the East Stack's top, behind the east leg (172, −72) r 3 (low water on foot; high water via the Tide Bell) | `Look · Something bronze` | "A bronze ring marked with tide lines, set into the rock at the foot of the arch's far leg." | "Engraved round it: 'When the arch lamp burns, the sea remembers when to come and when to go.'" |
| `archwater:keep-lens` | north (back) side of the Watch Column's base (−20, −68) r 4 | `Look · Something glinting` | "A cracked glass lens from an old spyglass, tucked behind the column's base." | "Scratched on its brass rim: 'From the top you can see five isles and one in the sky. We kept a lamp up here for the one in the sky.'" |
| `archwater:keep-shanty` | sea (back) side of the Spouter (90, 134) r 4, dry at both tides | `Look · Something painted` | "A scrap of oilcloth tucked into a crack in the Spouter, with words painted on it." | "'When the arch is lit and the tide comes home, the Raft sails out and the singers roam.' The tune is written underneath. It looks hard to sing." |
| `archwater:keep-oar` | north side of Rafferty's Mast step, on the main raft (−166, 0) r 2 (on deck) | `Look · Something small` | "A tiny oar, carved for a very small paddler, wedged under the mast step." | "Burned into the blade: 'R.' And a row of little lines up the handle, like somebody measuring how much they'd grown." |

**Fifth line:** "A tide ring, a lens, a song and a little oar. Archwater keeps time by the tide, and the tide keeps
time by the light."

<a id="archwater-finds"></a>

### Archwater: collectibles and finds (S-123)

Counts: **9 acorns · 4 keepsakes · 3 Hollows · 3 vistas · 12 chests · 1 bottle · 2 Lamp Logs**, plus 5 benches and the
root-gate stub. The coverage and reach tests run in both tide states; each find lists the state it needs.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `chest-2` holds the Raft Hammock (`nook:hammock`), `chest-10` the Tidepool Teal hood trim (`trim_tidepool`), `chest-7` the "Sea Arch" sticker (`sticker_archwater`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (30 gems each)

| id | Spot | Anchor | Needs |
|---|---|---|---|
| `chest-1` | Basalt Stairs · the Hex Maze of column stumps north of the top terrace | (−40, −120) r 10 | - |
| `chest-2` | Basalt Stairs · the Watch Column's fifth-flight landing (h 45) | (−14, −56) on deck | - |
| `chest-3` | The Raft · on the bay mud under the net-shed raft | (−190, 40) r 6 | low water |
| `chest-4` | Tidepool Shelf · rock nook west of the Spouter | (60, 140) r 10 | - |
| `chest-5` | Kelp Shallows · back of Gull Cave | (110, −140) r 4 | Lantern (dark) |
| `chest-6` | Kelp Shallows · a dead end of the Kelp Maze | (200, 22) r 4 | low water |
| `chest-7` | Tidepool Shelf · **Barnacle Ledge**, 1.4 m above a floating log that rises with the tide | (20, 170) r 4 | high water (the log deck is h −0.6 at low, +0.8 at high) |
| `chest-8` | Basalt Stairs · column top in the Pool Steps | (−128, −118) r 2 | high water (pumice pontoons) |
| `chest-9` | Kelp Shallows · top of the Spire Stack | (196, −84) r 2 | Leaf Glider from the arch crown (h 26, 48 m, 60 m range) |
| `chest-10` | Kelp Shallows · the arch's crown deck | (150, −70) on deck, h 26 | Thistle Hook: hookbloom on the west shoulder (140, −70) h 22, hooked from the west leg top (132, −70) h 14; then the keystone hookbloom (150, −70) h 27 |
| `chest-11` | Tidepool Shelf · soft earth in the sandy cove | (−40, 160) r 8 | Digging Paws |
| `chest-12` | Basalt Stairs · soft earth on the top terrace's east end | (10, −20) r 8 | Digging Paws |

**Sleeping Acorns:** `acorn-1` in a flowerpot on the main raft (−170, 14) on deck; `acorn-2` in an empty hexagon
socket on the third terrace (−60, −30) r 8; `acorn-3` at the Watch Column's west foot (−30, −58) r 4; `acorn-4` in
the kelp on the flats (178, 30) r 8 (low water); `acorn-5` on the Moon Pool's dry rim (138, −84) r 4; `acorn-6` in a
dry tide pool (40, 150) r 8; `acorn-7` at the Spouter's foot (100, 112) r 4; `acorn-8` behind **thornglass** on the
NW lowland (−150, −70) r 8 (Starsteel); `acorn-9` behind a **star door** on the arch's west leg shoulder (132, −74)
h 14 r 3 (Starsong, night).

**Vistas**

| id | Name | Spot | Hoot's caption |
|---|---|---|---|
| `vista-1` | Five Isles and One in the Sky | Watch Column top (−20, −60), h 54 | "From the Watch Column you can see five isles and one in the sky. I counted six. Then I counted again and got five and a cloud." |
| `vista-2` | Under the Arch | Moon Pool west rim (136, −66) | "The Great Arch from underneath. Twenty-six metres tall. I measured it by lying down and guessing." |
| `vista-3` | The Raft at Sunset | plateau west edge above the bay (−110, 10) r 6 | "The Raft at sunset. It is either a village that floats or a boat that has made a great many friends." |

**Bottle** `archwater:bottle`: Tidepool Shelf's south-west beach (−80, 160) r 10, above high water. Bottle Chain
letter 7.

**Lamp Logs:** `log-8` in the lamp cage niche on the Watch Column's top platform (−18, −62), h 54; `log-9` at the back
of Echo Cave (60, −170) r 4 (Lantern, dark). Default numbers 8 and 9.

**Hollow doors** (S-129): `hollow-1` tide Hollow, on a ledge h 0.6 in the Kelp Shallows cliff (90, −120) r 8 (door
reachable at both tides); `hollow-2` mirror-pool Hollow, second terrace (−80, 20) r 8; `hollow-3` push-block Hollow,
Tidepool Shelf (0, 120) r 8.

**Benches:** `bench-1` Landing Bench (−204, 20) on the pier; `bench-2` Stair Bench by the Watch Column (−6, −44);
`bench-3` Arch Bench on the east edge (112, −60); `bench-4` Spout Bench (70, 104); `bench-5` North Bench on the NW
lowland (−80, −150).

**Root-gate** `archwater:rootgate`: Tidepool Shelf west (−60, 110) r 6, root arch on bearing 292.5°.

**Tide stones** (gate objects placed in S-122, dormant until `ability:tide`): `tide-1` bay north shore (−176, −52);
`tide-2` Pool Steps rim (−112, −104); `tide-3` top of the grotto stair (124, −60); `tide-4` beside the Spouter
(100, 108); `tide-5` the plateau's east foot (120, 20). All on cells walkable at both tides.

<a id="archwater-chain"></a>

### Archwater: the local chain on the ground (S-120, S-127)

Dialogue in `./story.md#ch9-11`. Steps 2-4 in any order; the door needs all three pearls. Everything is done at low
water (the tide is stuck).

| Step | Region | What is there | Pip does | Sets |
|---|---|---|---|---|
| 1 | The Raft | Skipper Rafferty on the main raft (−164, 10) | Talk: the arch lamp went out, the tide stuck, the Raft beached; "the Undertow door's got three pearl sockets, and we've not had a pearl between us since my granddad"; he points out the three | `aw:step1` |
| 2 | Basalt Stairs | the **Sky Pearl** in the dark lamp cage on the Watch Column's top | climb the outer stair (8 flights), `Pick up` | `aw:pearl-sky` |
| 3 | Tidepool Shelf | the **Pool Pearl** at the bottom of the Great Tidepool (50, 130); three 1 m basalt plugs on the rim | push each plug into a drain slot; the pool drains in 3 s; `Pick up` | `aw:pearl-pool` |
| 4 | Kelp Shallows | the **Kelp Pearl** at the Kelp Maze's centre (190, 10), Sand Snappers in the maze | find the centre, `Pick up` | `aw:pearl-kelp` |
| 5 | Kelp Shallows | the pearl door (134, −64) | `[E] Place · Pearls` | `aw:door`; `[E] Enter · the Undertow Grotto` |

After Old Gloop is calmed (`./creatures.md#boss-gloop`) he lives in the Moon Pool (an NPC in the water, talked to
from the rim at (138, −70)) and runs Gloop's Juggling from there.

<a id="archwater-gates"></a>

### Archwater: gate table

| Gate | Where | Tool or state | Opens |
|---|---|---|---|
| dark zone | Gull Cave, Echo Cave | Lantern | chest-5, log-9 |
| low water | flats, bay mud, Kelp Maze | `tide:archwater = low` (stuck low before the beacon; the Tide Bell after) | chest-3, chest-6, acorn-4, East Stack (keepsake) |
| high water | floating log, pumice pontoons | `tide:archwater = high` | chest-7, chest-8 |
| tide stones × 5 | listed above | Tide Bell | toggling the tide |
| glide gap | arch crown → Spire Stack | Leaf Glider | chest-9 |
| hookblooms × 2 | the arch's west shoulder and keystone | Thistle Hook | chest-10, the arch crown |
| soft earth × 2 | sandy cove; top terrace | Digging Paws | chest-11, chest-12 |
| thornglass | NW lowland | Starsteel | acorn-8 |
| star door | arch west-leg shoulder | Starsong (night) | acorn-9 |
| pearl door | grotto ledge | three pearls | Undertow Grotto |

<a id="archwater-poi"></a>

### Archwater: points of interest

**Sites:** the Moon Pool; the East Stack; the Spire Stack; the Hex Maze (−40, −120), a field of column stumps 0.6-2 m
in a maze pattern; the Pool Steps (−120, −110); the Great Tidepool (50, 130); the Kelp Maze (190, 10); the bay mud;
Gull Cave; Echo Cave; the Basalt Beach (NW boulder shore, (−150, −100)); Barnacle Ledge (20, 170); the Landing; the
Urchin Garden (a pool of purple urchins on the shelf, (−20, 140), `Look` "A pool full of purple urchins, all facing the
same way, like an audience."); the Column Stairs (the main stair on W1, (−130, −40)); the Blow-Crack (a hissing crack
on the shelf that puffs at high water, (130, 90)). **16 sites.**

**Curio types:**

| Type | Prop | Count · anchors | Prompt · lines |
|---|---|---|---|
| Tide chalk | chalk decal on a column face | 4: (−150, −30), (−60, −80), (60, 60), (110, −30) | `Read · Chalk marks` · "Chalk tide marks on the rock: HIGH. HIGHER. 'TOO HIGH, RAFFERTY.' And one at the very top that just says 'SORRY.'" |
| Empty lamp-stand | `kit_ruin_lampstump` | 4 along the plateau rim on W1/W2 | the shared line |
| Counted hexagons | decal | 3 on terrace treads: (−70, −60), (−10, −90), (30, −40) | `Look · A carved number` · "Somebody has carved a number into each hexagon of this step. They got to 212 and then, it seems, had lunch." |
| Glass float | `archwater_float` wedged in rocks | 4: (−120, −150), (150, 60), (−100, 140), (170, −120) | `Look · A glass float` · "A green glass fishing float wedged in the rocks. Someone painted a tiny otter face on it, smiling bravely." |
| Gull sign | `sign` | 2: the landing (−214, 6), Gull Cave mouth (106, −132) | `Read · A sign` · "GULLS: PLEASE DO NOT EAT THE SIGNS. — The Raft" |

Fill pool: glass float, counted hexagons.

**People** (S-120): Skipper Rafferty (`./cast.md#skipper-rafferty`) on the main raft (−164, 10); six rafters at
(−180, 0), (−150, 20), (−172, 30), (−146, −6), (−196, 18) and fishing off the landing (−216, 8); Old Gloop in the Moon
Pool after the calm; Clover during ss-23; Rook during his race. **10.**

**Activities and story marks:** Gloop's Juggling post on the Moon Pool rim (130, −56) (`./side-content.md#act-juggling`);
Clover's Dash course (S-133): start the Landing Bench (−200, 20) → gates (−150, −30), (−90, −40), (−30, −40), (40, −50),
(100, −40), (90, 40), (80, 100), (0, 110), (−80, 90) → finish (−196, 24), all on tide-safe paths; ≈ 760 m; tiers
85 s / 100 s / 125 s. **Rook's Races part 2** (S-133): Stair Bench (−6, −44) → Arch Bench (112, −60) → the grotto stair
top (124, −60) → W3 → the Spouter (90, 120); 380 m; ghost 62 s. Fishing (S-206): `fish-1` the landing's end
(−220, 12), `fish-2` the Moon Pool rim (140, −60) (night: moon fish). ss-23 *Clover's Map*: eight chalk arrows through
the Hex Maze from (−60, −100) to **Clover's Nook** (−150, −90), where she sits on a column with a sandwich; ss-24 *The
Raft Choir*: five shanty-verse tide pools at (20, 140), (50, 150), (−10, 160), (110, 140), (70, 160); ss-25 *Eight
Socks*: Gloop at the Moon Pool; ss-26 *The Moon Pool*: the pool's night reflection state; ss-13: Shellby's spot is
the Moon Pool's west rim.

**POI count:** finds 45 (4 landmarks, 12 chests, 4 keepsakes, 9 acorns, 3 vistas, 1 bottle, 2 logs, 3 Hollow doors, 5
benches, root-gate, jetty) + sites 16 + curios 17 + gates 8 (5 tide stones, 2 hookblooms, pearl door) + quest props 2
(tidepool plugs, the Watch Column cage) = **88 at the finds step**; with people **98**. Required at 110,000 m²: 88.

<a id="archwater-interiors"></a>

### Archwater: interiors and doors

**The Raft cabins** (`archwater_cabins`, interior realm, 48 m grid, first needed by ss-24 in S-131; no enemies):
door on the main raft (−162, 2), `[E] Enter · the Raft cabins`. Three rooms: **Rafferty's cabin** (charts, a hammock,
a framed drawing of the arch lit), **the Choir Loft** (benches, a squeezebox, shanty sheets; ss-24's scene), **the Net
Shed** (nets, floats, a Lamplighter tide chart on the wall: `Look` "Tide times, a hundred years old, every one marked
'arch lamp lit'."). Other cabin doors (`Knock`; second line from `beacon:archwater`):

| Cabin | Before | After |
|---|---|---|
| (−180, 0) | "'Mind the tilt! Everything in here has slid to one end. Including us.'" | "'We're level! I'd forgotten what level felt like!'" |
| (−150, 20) | "A rafter, upside down in a hammock: 'Can't fish, can't float, can't sleep. Can count clouds. Seventeen.'" | A note: "Gone fishing! (Literally! At last!)" |
| (−172, 30) | A note: "Choir practice cancelled. Nothing to sing about." | A note: "Choir practice: every night. Earplugs: free." |
| (−146, −6) | "'If it's about the smell, it's the kelp. If it's about the noise, it's Rafferty.'" | (same) |
| (−190, 24) | "A small otter opens the door, hands you a pebble, and closes it again." | "A small otter opens the door, hands you a shell, and closes it again." |

<a id="archwater-beacon"></a>

### Archwater: the beacon and what changes

Beacon: the keystone lamp cage on the Great Arch. Kindled at its heart in the Undertow Grotto's last room, under the
arch (`./dungeons.md#d3`); Pip exits to spawn `grotto`. Within 10 s of `beacon:archwater`: the keystone lamp lights
and its beam falls on the Moon Pool (1 s); `tide:archwater` becomes `high` and `waterY` lerps −1.4 → 0 over 8 s; the
Raft decks lift and level; the first Spouter plume at 6 s; kelp starts swaying; gulls return to the ambience; the
music modulates to its restored key; home's crown lantern lights and horizon card b gets its night window. The plaza
visitor is a rafter (`./cast.md`). Positional landmark sound: the Spouter's whoosh every 8 s (audible 200 m) and a low
hum from the lit arch.

<a id="archwater-palette"></a>

### Archwater: palette (`W.palette.archwater`)

| Slot | Day | Dusk | Night |
|---|---|---|---|
| Sky top · horizon | `#86c3dc` · `#e2ecee` | `#36414f` · `#e2a07a` | `#10141e` · `#36414f` |
| Fog colour · near/far | `#d6e6ea` · 100/280 | `#a58aa0` · 90/260 | `#1c2230` · 60/240 |
| Sun / moon · hemisphere | sun `#fff4e0` · `#cfe4ea` / `#3a3a44` | sun `#ffb88a` | moon `#d0dcf0` · `#2a3450` / `#12141c` |
| Water shallow · deep · Moon Pool glow | `#7fd3d0` · `#2a5a6e` · `#bff4f0` | | |
| Accent (urchins, pennant) | `#6b4a8c` | | |

Terrain slots (`./art-audio.md#archwater`): grass → `archwater_seaturf`, forest → `archwater_lichen`, meadow →
`archwater_thrift` (sea pinks), sand → `archwater_wetsand`, snow → `archwater_mudflat` (sound `dirt`), dirt →
`archwater_path`, rock → `archwater_basalt` (hexagon tops). Fallback tint hexes `#36414f #7fd3d0 #e2c9a0 #6b4a8c`.

<a id="archwater-music"></a>

### Archwater: music and ambience notes

Track `archwater`: plucked strings (harp and nylon guitar), 92 bpm. **Dim:** A minor; a harp ostinato with no bass,
and each phrase stops a beat early, like a held breath. **Restored:** modulates to C major; bass, a swell pad and a
soft tide drum on beats 1 and 4 enter. Layers: the Raft adds a wordless hummed choir (after ss-24, a squeezebox);
Basalt Stairs adds hollow wood-block taps; Tidepool Shelf adds glassy harmonics; Kelp Shallows adds low muted plucks.
Ambience beds switch with the tide: low (`drip`, popping kelp, clicking) and high (swell on columns, Spouter, gulls).

<a id="archwater-kit"></a>

### Archwater: prop kit and ART BRIEFs (S-118)

Instanced types (≤ 24): hex column (riser stamp, 3 heights), hex stump (maze), basalt boulder (reused `rock`,
`#36414f`), kelp, kelp wall, sea-thrift tuft, urchin cluster, barnacle rock, tide-pool rim, driftwood, raft deck piece,
raft cabin, barrel-and-crate stack, net rack, pumice pontoon, glass float, grass card, flower card (thrift `#e89ab0`),
shell deco, jetty post, `kit_bench`, `kit_ruin_pillar`, `kit_ruin_lampstump`, `kit_log_niche` = **24**. Unique: the
Great Arch, the Watch Column and stair, the Spouter, Rafferty's Mast, the East and Spire Stacks, the floating log,
the pearl door, Hollow doors, root-gate. New material programs: basalt, wet basalt (high-water darkening by a uniform),
kelp (sway), barnacle, rope, plank, Moon Pool glow, spout (additive) = **8**.

<a id="brief-archwater-arch"></a>

**`archwater_great_arch`: the Great Arch.** Silhouette: a massive natural sea arch of stacked dark hexagonal columns,
a smooth curve 40 m across, one leg on the cliff edge and one on a sea stack, barnacles and kelp fringe under the span,
a small brass lamp cage on the keystone, a flat walkable crown. Size: 26 m tall, 40 m span, 8 m thick. Palette: basalt
`#36414f` / `#252d38`, wet band `#1c222c`, barnacles `#e2c9a0`, kelp `#4a6a3a`, lamp `kit_beacon`. Materials: toon
basalt (column-face texture `archwater_columns_face`, generated 1024² seamless), kelp cards, ink hull. Poly ≤ 8,000
(LOD ≤ 800). Collider: the two legs; the crown deck is a bridge deck. Fallback: a half-torus of hexagonal prisms on two
prism legs. Image prompt (turnaround, 1536 × 1024, opaque): "a huge natural sea arch made of stacked dark hexagonal
basalt columns, one leg on a grassy cliff edge and one on a sea stack, a round pool of pale turquoise water beneath
it, barnacles and kelp under the span, a tiny old brass lamp cage on the keystone; front and side views". 3D prompt:
"stylised basalt sea arch 26 m tall, 40 m span, built from hexagonal columns, flat crown, lamp bracket on the
keystone, hand-painted toon texture".

<a id="brief-archwater-column"></a>

**`archwater_watch_column`: the Watch Column.** Silhouette: one tall freestanding hexagonal basalt column with a
wooden stair of straight flights wrapping it and a small railed platform on top with a lamp cage. Size: 24 m tall,
7 m across. Palette: basalt as above, stair wood `#9b7b56`, rail rope `#c9b48a`, lamp brass `#b08a45`. Poly ≤ 3,000.
Fallback: a hexagonal prism, box flights, a cylinder platform. Image prompt: "a single very tall hexagonal basalt
column standing on a stepped rocky plateau, a wooden stair of straight flights wrapping round it up to a small railed
platform with an old brass lamp on top, sea all around". 3D prompt: "stylised hexagonal basalt pillar 24 m with
wrapping wooden stair flights and a railed top platform, toon shading".

<a id="brief-archwater-spouter"></a>

**`archwater_spouter`: the Spouter.** Silhouette: a smooth rounded rock dome with a dark blowhole and a striped tide
post on top; spout plume. Size: dome r 10, 12 m tall; post 4 m. Palette: rock `#5a5f6a`, wet `#3a3f48`, post rings
`#f4efe2` / `#6b4a8c`, spout `#ffffff`. Spout: additive card strip `archwater_spout` (generated, 6 frames, 256 × 512,
transparent: "a burst of white sea spray shooting upward from a blowhole, painterly, six frames"). Poly ≤ 1,600.
Fallback: a hemisphere, a cylinder post; spout from `fx_atlas`. 3D prompt: "stylised rounded sea rock dome with
blowhole and a striped tide post on top, toon shading".

<a id="brief-archwater-raft"></a>

**`archwater_raft` (deck piece), `archwater_raft_cabin`, `archwater_mast`: the Raft.** Silhouette: chunky lashed
log rafts with plank tops; small round-roofed cabins with porthole windows and stovepipes; a tall mast with a crow's
nest. Sizes: raft piece 8 × 6 m, 0.8 m thick; cabin 5 × 4 × 4 m; mast 18 m. Palette: logs `#8a6a48`, planks
`#b89a74`, roofs `#6b4a8c` and `#3f8a88`, portholes `#f2b45a` glow, pennant `#6b4a8c`, bunting `#e2c9a0` / `#7fd3d0`.
Poly: raft ≤ 300, cabin ≤ 1,100, mast ≤ 900. Fallback: boxes, cylinders. Image prompt (reference, 1024², opaque): "a
cosy floating village of lashed log rafts in a rocky bay, little round-roofed cabins with portholes and stovepipes,
rope bridges between rafts, a tall mast with a crow's nest and bunting, otters' fishing nets drying". 3D prompt:
"modular stylised raft village pieces: 8 × 6 m log raft, small cabin, 18 m mast with crow's nest, toon shading".

<a id="brief-archwater-small"></a>

**Smaller Archwater props.** `archwater_column` (hexagon column stamp for risers, 0.9 m across, heights 2.4/4.8/7.2 m
by scale, ≤ 60 tris, top face uses `archwater_basalt`); `archwater_stump` (hexagon stump 0.6-2 m for the Hex Maze,
≤ 40 tris); `archwater_kelp` (cluster of 5 ribbon cards 1.6 m, `#4a6a3a` / `#7a8a3a`, sway in the shader only when
submerged, ≤ 40 tris); `archwater_kelp_wall` (a 4 m long, 1.6 m tall kelp hedge piece with a collider rail, ≤ 120
tris); `archwater_urchin` (purple `#6b4a8c` spiky ball cluster, ≤ 120 tris); `archwater_pumice` (pale `#d8d0c0`
porous hexagon slab 2.4 m across, a bridge deck that follows `waterY + 0.2`, ≤ 60 tris); `archwater_float` (green
glass ball in a rope net, 0.4 m, ≤ 80 tris); `archwater_pearl_door` (round basalt door 2.4 m with three shell sockets
that glow `#bff4f0` when filled, ≤ 600 tris); `archwater_log` (the floating log for Barnacle Ledge, 6 m, ≤ 120 tris).
Fallbacks from primitives in the listed colours. 3D prompt pattern: "stylised <thing>, basalt-and-tide-pool set, toon
shading, game-ready".

<a id="archwater-coverage"></a>

### Archwater: 40 × 40 m coverage plan

Grid 13 × 13 cells (512 m). Expected **≈ 76 land cells at high water, ≈ 86 at low** (the flats add ≈ 10, most of them
in Kelp Shallows).

| Area | Cells | Passes by |
|---|---|---|
| The Raft and the bay | 8 | town, finds, path W1 |
| Plateau terraces | 22 | the Column (high point), chests, acorns, Hollow, Hex Maze, path W1/W2/W3 |
| NW lowland | 10 | Pool Steps, North Bench view, path W5, thornglass, floats |
| Tidepool Shelf | 20 | Spouter, Great Tidepool, chests, bottle, root-gate, Hollow, story pools |
| Kelp Shallows (land) | 12 | the arch, Moon Pool, caves, Arch Bench view |
| Kelp flats (low water only) | ≈ 10 | Kelp Maze, chest-6, acorn-4, the East Stack, floats |

Expected per state: find ≈ 56, view ≈ 10, path ≈ 12, **fill 0-4 (cap 12 % ≈ 9 at high, 10 at low)**. Cells that are
land only at low water must pass at low; if the outer east flats fail, place glass-float curios on them (they stay as
"stranded" floats, still visible at high water through the water).

---

<a id="threemills"></a>

## Threemills

The farm isle west-south-west of home: rolling chalk downs cut into wheat squares by hedgerows, apple orchards in the
north, a reedy millpond in the south, the mouse village of Haybury on the east coast, and Tumble Hill in the middle
with its three windmills and the round granary. Dim state: a bright, breezy day, but the sails stand still, the wheat
stays green, the granary's glass cupola is dark and the Hayburys are rationing pies. Restored: the sails turn, the
wheat goes gold, chimneys smoke, and there is a festival.

<a id="threemills-card"></a>

### Threemills: identity card

| Field | Value |
|---|---|
| id | `threemills` |
| Kind · grid · seed | overworld · 576 m (half 288) · `40237` |
| Land | ≈ 0.16 km² (test band 148,000-172,000 m²) |
| Recipe | `downs` (`js/realms/recipes/downs.js`) |
| Palette · music | `threemills` · `threemills` (fiddle and accordion) |
| Unlock | chart, after `ch8`; `hidden: true` until S-148 |
| Spawns | `jetty` (204, −18) facing 267° (Middle Mill dead ahead); `granary` (0, 44) facing 180° (Granary Vaults exit); `rootgate` (94, −144) facing 67° |
| Tide | two-state from S-122: `tide:threemills` (default high); one tide stone at the Old Sluice House; the coast is mostly low cliff, so low water mainly drains the millpond |
| Steps | S-138 recipe · S-139 props · S-140 art · S-141 people · S-142 enemies · S-143 Thistle Hook and home hook finds · S-144 finds · S-145-S-147 Granary Vaults and Lady Honksworth · S-148 main chain, Tower unlock · S-149 Hollows · S-152-S-155 side stories, Harvest Cut, Dash, Rook 3, The Mayor Goes to Sea |

<a id="threemills-recipe"></a>

### Threemills: the `downs` recipe

1. **Outline.** Shore radius `226 + 14·fbm(θ; 4 cycles)`. North coast (bearings 300°-60°): low chalk cliffs 3-5 m
   (slope > 1.0, white `threemills_chalkcliff`); south and east: beaches.
2. **Rolling downs.** `h = 4 + 6·fbm(x/90, z/90; 3 octaves)` inland, easing to 1 m at the beaches.
3. **Tumble Hill.** Added dome at (0, −8): `+30·(1 − (d/88)²)²`; summit h ≈ 35. Three spurs: west shoulder to
   **Tansy Mill** (−32, 10), ground h 27; east shoulder to **Thrift Mill** (30, 14), h 26; summit **Middle Mill**
   (0, −8), h 35. **The Granary** on the south face at (0, 30), h 24.8, with the **Hoist House** at (12, 34).
4. **The millpond.** Basin ellipse at (−70, 120), `rx 62`, `rz 40`, floor −1.6 in the middle third, −0.6 near the rim;
   it reaches the sea by a 10 m channel from (−70, 160) to the south coast (−70, 226). **Heron Island** (−60, 112), r 6,
   top h 1.0. The marsh round its west and south: reed beds on wet ground h 0.2-0.6.
5. **Boardwalks** (bridge decks, 2 m, h 1.4): **B1** Old Sluice House (−6, 118) → along the pond's south edge →
   junction (−60, 150); **B2** junction → the Marsh Lamp's ring platform (r 4, around (−104, 136)); **B3** junction →
   north-west through the reeds → the reed island (−150, 120). The **Old Sluice House** (8 × 6 m stone house with a
   small waterwheel, dark cellar) stands on the pond's east outlet at (−6, 118).
6. **Fields and hedgerows.** A field grid of ~55 m cells rotated 12°, jittered ±8 m (its own stream `seed * 7 + 19`);
   70 % of cell edges carry a **hedgerow**: 1.4 m tall, 1.2 m thick, collider rails (unhoppable; Pip's hop is 0.85 m);
   every hedge has ≥ 2 **stiles** (2 m gaps with a step) and a **field gate** where a path crosses. Field ground: 45 %
   wheat (deco cards, green until `beacon:threemills`), 20 % barley, 15 % clover pasture, 20 % fallow. Every enclosed
   field ≥ 1,600 m² that has no other POI gets one **field feature** (a site): a ring of 3-5 haystacks, a hay-bale stack,
   a sunflower patch, an old cart, or a lone round tree; ≈ 24 in all.
7. **Orchards.** Eight orchard blocks in Orchard Rows (each ≈ 50 × 40 m), apple trees in rows 8 m apart along 12°;
   **the Grandmother Apple** at (−40, −140), h 8.
8. **Haybury.** East coast, centre (150, 10): eight thatched cottages, **Ma Haybury's Pie Shop** (open counter),
   **the Weathercock Barn** (160, −20), **the Festival Green** (140, 30), kitchen gardens. **The jetty**: deck from
   the shore (206, −20) 26 m east to (232, −24); bollard at the end; the *Dandelion* moors at (228, −18).
9. **Paths** (2.4 m, rutted `threemills_lane`): **R1** jetty → Festival Green → west lane (100, 40) → (60, 40) →
   switchback up Tumble Hill's south face → the Granary → **R5** the summit lane (Tansy → Middle → Thrift → Granary).
   **R2** Haybury north lane: green → (150, −60) → (110, −120) → (40, −140) → the Grandmother Apple. **R3** Tumble Hill's
   west foot (−70, 0) → (−50, 60) → the Old Sluice House. **R4 the Long Lane** (hedge-lined both sides): (−120, −60) →
   (−150, 0) → (−140, 90) → the reed island. **R6** orchard cross-lane: the Grandmother Apple → (−80, −90) →
   (−120, −60).
10. **Sightlines.** Rolling ground and hedges hide little, but orchards do: the recipe keeps a 6 m tree-free corridor
    from each orchard block's centre toward Middle Mill.

<a id="threemills-regions"></a>

### Threemills: regions and cards

Region rule: **Haybury** if `x ≥ 118` and `|z| < 110`; else **Tumble Hill** if within 92 m of (0, 0); else by bearing:
**Orchard Rows** [285°, 135°) (north and the eastern fields), **Millpond Marsh** [135°, 285°) (south and the western
sheep downs).

| # | id | Card | Entry point | Music layer · ambience | Enemies · max |
|---|---|---|---|---|---|
| 0 | `haybury` | **Haybury** · "Pies cooling" | jetty spawn (204, −18) | village · `farm` (cart creak, chatter, larks) | `[]` · 0 (safe zone) |
| 1 | `tumblehill` | **Tumble Hill** · "Three mills, one hill" | R1 at the hill's south foot (60, 40) | hill · `hilltop` (wind, mill creak) | `[['woolly_ram', 2], ['scarecrowlet', 2], ['field_vole', 2]]` · 5 |
| 2 | `orchard` | **Orchard Rows** · "Apples, always apples" | R2 at (110, −120) | orchard · `orchard` (bees, leaves, a dropped apple) | `[['field_vole', 4], ['scarecrowlet', 3]]` · 6 |
| 3 | `millpond` | **Millpond Marsh** · "Boots optional" | R3 at (−50, 60) | marsh · `marsh` (reeds, frogs, water) | `[['woolly_ram', 3], ['field_vole', 2], ['scarecrowlet', 1]]` · 6 |
| - | dark zones | the Cider Cave, the Old Sluice House cellar | - | - | `[['dimling', 1]]` · 2 |

<a id="threemills-landmarks"></a>

### Threemills: landmarks

| Region | Landmark | Base | Height (top above sea) | Seen from | Keepsake |
|---|---|---|---|---|---|
| Tumble Hill | **Tansy, Thrift and Middle Mill** | Middle (0, −8) h 35; Tansy (−32, 10) h 27; Thrift (30, 14) h 26 | Middle 22 m (57); Tansy and Thrift 18 m (45, 44) | the whole isle; jetty at 204 m | `threemills:keep-wheat` (Middle Mill) |
| Haybury | **the Weathercock Barn** | (160, −20), h 5 | 16 m barn + 3 m copper weathercock (24) | jetty, the Green | `threemills:keep-cutter` |
| Orchard Rows | **the Grandmother Apple** | (−40, −140), h 8 | 18 m (26) | R2 entry (150 m), Orchard Bench | `threemills:keep-swing` |
| Millpond Marsh | **the Marsh Lamp** | (−104, 136), in the pond | 15 m (15) | R3 entry (90 m), Pond Bench | `threemills:keep-wicks` |

**The three mills.** Tower mills with conical caps and four lattice sails. **Middle Mill**: white chalk-plaster
`#f2efe6`, sky-blue trim `#a7d3f0`, sails 18 m across, a gallery round the cap at 14 m reached by an inside stair
(Goody Gander's mill; vista-1; ss-04's speech spot). **Tansy Mill**: ochre `#e7c45a`, cream sails 16 m. **Thrift
Mill**: barn red `#c2563f`, cream sails 16 m, a cap gallery at 12 m reachable only by the Thistle Hook (chest-8).
Dim: sails still, brakes on. Restored: sails turn (0 → 0.5 rad/s over 5 s, each mill a third of a turn out of phase).

**The Granary.** A round stone granary 10 m across, 12 m tall, a glass **cupola** 3.5 m on top holding the
**sun-lamp** (the Threemills beacon, `kit_beacon` 1.6× inside the glass). Its south cellar door (0, 36) leads to the
Granary Vaults (dungeon 4, `./dungeons.md#d4`); until quest step 4 a **hay avalanche** (a 6 m heap with a collider)
buries it. The Hoist House beside it holds a crane arm over the heap.

**The Weathercock Barn.** A tall red barn with a white-trimmed loft door and a big copper weathercock that turns with
the realm's wind direction. **The Grandmother Apple.** A huge, gnarled, very old apple tree, wider than tall, its
lowest bough propped on a stone crutch, apples all year. **The Marsh Lamp.** A Lamplighter lamp tower on four iron
stilts in the millpond: an open iron frame, a stone lamp room with a dark `kit_beacon`, a ring platform at its foot
joined to boardwalk B2; it stays dark (it is a ruin; only the granary is the beacon) until `mainEnding`, when the
Hayburys light it for the festival.

<a id="threemills-keepsakes"></a>

### Threemills: keepsakes (4 × 25 gems)

| id | Anchor | Prompt | Line 1 | Line 2 |
|---|---|---|---|---|
| `threemills:keep-wheat` | Middle Mill's north (back) doorframe (0, −18) r 4 | `Look · Something golden` | "A single ear of wheat, pressed flat and golden, tucked into the mill's north doorframe." | "The paper round it says: 'From the year the sun-lamp was first lit. Summer, kept for winter. Don't eat it, it's history.'" |
| `threemills:keep-cutter` | east (seaward, back) wall of the Weathercock Barn (168, −20) r 4 | `Look · Something tin` | "A tin biscuit cutter shaped like a lantern, hanging on a nail at the back of the barn." | "Scratched inside: 'Harvest Festival. Lamp biscuits for the Lamplighters, who come every autumn to light the granary.' The last date is a hundred years ago." |
| `threemills:keep-swing` | north (back) side of the Grandmother Apple, in the roots (−40, −150) r 4 | `Look · Something wooden` | "An old wooden swing seat, its ropes long gone, propped in the roots of the apple tree." | "Carved underneath: 'Goody + Honky, best sisters. (Honky pushed too hard.)'" |
| `threemills:keep-wicks` | the Marsh Lamp's south ring platform (−104, 141) r 2 (on deck) | `Look · Something tucked away` | "A tin of spare wicks, tucked under the Marsh Lamp's platform. Every wick is trimmed, and not one has been used." | "The lid says: 'For when they come back.'" |

**Fifth line:** "A wheat-ear, a biscuit cutter, a swing and a tin of wicks. Threemills was always ready for visitors.
It still is."

<a id="threemills-finds"></a>

### Threemills: collectibles and finds (S-144)

Counts: **10 acorns · 4 keepsakes · 3 Hollows · 3 vistas · 14 chests · 1 bottle · 2 Lamp Logs**, plus 6 benches and the
root-gate stub. Tested at both tide states from S-122 (low water exposes the pond floor and a little beach).

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `chest-5` holds the Haybury Rocking Chair (`nook:rocking-chair`), `chest-9` the Poppy Red hood trim (`trim_poppy`), `chest-8` the "Three Mills" sticker (`sticker_threemills`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (30 gems each)

| id | Spot | Anchor | Gate |
|---|---|---|---|
| `chest-1` | Orchard Rows · under a ladder in orchard block 3 | (−80, −90) r 10 | - |
| `chest-2` | Orchard Rows · a hedge corner above the north cliffs | (40, −170) r 10 | - |
| `chest-3` | Haybury's back field · the Ring Stones (`kit_ruin_ring`) | (190, 70) r 4 | Starsong star door (night) |
| `chest-4` | Millpond Marsh · the reed island at the end of B3 | (−150, 120) r 8 | - |
| `chest-5` | Tumble Hill · behind Tansy Mill | (−48, 18) r 8 | - |
| `chest-6` | Millpond Marsh · the Old Sluice House cellar | (−6, 122) r 3 | Lantern (dark) |
| `chest-7` | Orchard Rows · back of the Cider Cave in a chalk bank | (−150, −70) r 4 | Lantern (dark) |
| `chest-8` | Tumble Hill · Thrift Mill's cap gallery, h 38 | (30, 14) on the gallery | Thistle Hook (hookbloom on the cap, hooked from the summit lane (24, 4)) |
| `chest-9` | Orchard Rows · the Grandmother Apple's high bough, h 24 | (−36, −136) on the bough | Thistle Hook (hookbloom on the bough tip) |
| `chest-10` | Millpond Marsh · Heron Island | (−60, 112) r 3 | Leaf Glider from Middle Mill's gallery (h 49, 134 m, 144 m range) **or** low water (walk the pond floor) |
| `chest-11` | Millpond Marsh · the Sunk Cart on the pond floor | (−110, 118) r 6 | Tide Bell (low water) |
| `chest-12` | Millpond Marsh · soft earth in a fallow field on the sheep downs | (−150, −10) r 8 | Digging Paws |
| `chest-13` | Tumble Hill · soft earth at the east foot | (70, −30) r 8 | Digging Paws |
| `chest-14` | Millpond Marsh · a Long Lane hedge gap choked with thornglass | (−120, 40) r 8 | Starsteel |

**Sleeping Acorns:** `acorn-1` in a bird box on an apple tree (−100, −110) r 6; `acorn-2` in the Grandmother Apple's
west roots (−52, −138) r 4; `acorn-3` on Middle Mill's door step (6, −2) r 4; `acorn-4` beside the Hoist House
(16, 38) r 4; `acorn-5` in a coot's nest on boardwalk B1 (−40, 140) on deck; `acorn-6` on a reed bank (−150, 70) r 8;
`acorn-7` in a furrow of Pennywhistle's field (104, 56) r 6; `acorn-8` in the north-east wheat (120, −120) r 8;
`acorn-9` on the south beach (−20, 210) r 10; `acorn-10` on the pond floor (−80, 100) r 6 (low water).

**Vistas**

| id | Name | Spot | Hoot's caption |
|---|---|---|---|
| `vista-1` | Three Mills, One Hill | Middle Mill's gallery (0, −8), h 49 | "Threemills from the top of Middle Mill. Every field is a different square. Somebody has been very tidy for a very long time." |
| `vista-2` | Apple Rows | the orchard ridge (−80, −160) r 8 | "The orchard rows. I tried to count the apples and fell asleep at three hundred. An honest day's work." |
| `vista-3` | The Marsh Lamp at Dusk | B1/B2 junction (−60, 150) on deck | "The Marsh Lamp at dusk. It has not been lit for a hundred years and still looks as if it might be, any minute." |

**Bottle** `threemills:bottle`: south beach (40, 220) r 10. Bottle Chain letter 9.

**Lamp Logs:** `log-10` in a niche at the Marsh Lamp's base, on the ring platform (−100, 132) on deck; `log-11` at the
Stone Stile ruin on the Long Lane (−130, 0) r 6. Default numbers 10 and 11.

**Hollow doors** (S-149): `hollow-1` hook Hollow, in the north chalk bank (−20, −200) r 8; `hollow-2` gear Hollow,
Tumble Hill's west flank (−70, −30) r 8; `hollow-3` hay Hollow, a bank by the haystacks (96, 104) r 8.

**Benches** (6): `bench-1` Jetty Bench (204, −10); `bench-2` Green Bench (142, 36); `bench-3` Mill Bench on the summit
lane (−12, −4); `bench-4` Orchard Bench (−60, −120); `bench-5` Pond Bench (−20, 110); `bench-6` Long Lane Bench
(−150, 30).

**Root-gate** `threemills:rootgate`: Orchard Rows' north-east (90, −150) r 6, root arch on bearing 67.5°.

**Tide stone** (S-122): `tide-1` on the Old Sluice House's step (−6, 112).

<a id="threemills-chain"></a>

### Threemills: the local chain on the ground (S-141, S-148)

Dialogue in `./story.md#ch9-11`. Steps 2 and 3 in either order; step 4 needs both.

| Step | Region | What is there | Pip does | Sets |
|---|---|---|---|---|
| 1 | Haybury | the Hayburys at the Pie Shop (148, 14); Goody Gander in the queue | Talk: the sails stopped, the sun-lamp went out, pies are rationed; "Her Honkship" flaps the sails by hand at night; the Granary door is buried in hay, the hoist that lifts it runs off the Old Sluice, and the Hoist House key went off with the vole gang | `tm:step1` |
| 2 | Orchard Rows | the **Field Vole den** in orchard block 5 (−20, −100): a hollow under a hedge with a stolen-goods pile | calm three waves of 4 Field Voles; they drop **the Hoist Key** (key item `threemills:hoist-key`) | `tm:key` |
| 3 | Millpond Marsh | the Old Sluice House (−6, 118), dark inside, three sluice wheels | light it with the Lantern; Swing the wheels so their creaks rise in pitch (low, middle, high; the order is drawn in chalk as one, two and three mill sails); the sluice opens and the little waterwheel turns | `tm:sluice` |
| 4 | Tumble Hill | the Hoist House (12, 34) | `[E] Unlock · Hoist House`, then `[E] Use · Hoist`: the crane lifts the hay off the cellar door in 3 s | `tm:door`; `[E] Enter · the Granary Vaults` |

After Lady Honksworth is calmed (`./creatures.md#boss-honksworth`) she stands on the summit lane by Middle Mill by day
and hosts the Festival Green on festival nights.

<a id="threemills-gates"></a>

### Threemills: gate table

| Gate | Where | Tool | Opens |
|---|---|---|---|
| dark zone | Old Sluice cellar, Cider Cave | Lantern | chest-6, chest-7, quest step 3 |
| hookbloom | Thrift Mill cap | Thistle Hook | chest-8 |
| hookbloom | Grandmother Apple bough tip | Thistle Hook | chest-9 |
| glide gap | Middle Mill gallery → Heron Island | Leaf Glider (or low water) | chest-10 |
| tide stone | Old Sluice House | Tide Bell | low water: chest-11, acorn-10, chest-10 on foot |
| soft earth × 2 | sheep downs; Tumble Hill east foot | Digging Paws | chest-12, chest-13 |
| thornglass | Long Lane hedge gap | Starsteel | chest-14 |
| star door | the Ring Stones | Starsong (night) | chest-3 |
| hay avalanche | Granary cellar door | quest step 4 | Granary Vaults |

<a id="threemills-poi"></a>

### Threemills: points of interest

**Sites:** the Granary; the Hoist House; the Old Sluice House; the millpond; Heron Island; the reed beds; the
boardwalks; the Cider Cave (−150, −70); the Festival Green; the Ring Stones (190, 70); the North Chalk Cliffs; the Long
Lane; the Stone Stile (−130, 0); Pennywhistle's Field (100, 60); the Sheep Downs (open downland, (−180, −40)); the
Haystacks (60, 80); the Old Cart in a hedge (−60, −40); the Windbreak Copse (−180, 60); the Vole Den (−20, −100);
plus ≈ 24 field features. **≈ 43 sites.**

**Curio types:**

| Type | Prop | Count · anchors | Prompt · lines |
|---|---|---|---|
| Stile sign | `sign` on a stile | 6 on stiles along R2, R4 and R6 | `Read · A sign` · one of: "PLEASE CLOSE THE GATE. (There is no gate. Please close it anyway.)" / "Public footpath. Private sheep." |
| Empty scarecrow pole | `threemills_scarecrow_pole` | 4 in fields (S-152's hats return to these): (−100, −40), (40, −110), (−130, 70), (80, 120) | `Look · An empty scarecrow pole` · "An empty scarecrow pole with a hat-shaped space on top where a hat used to be." |
| Licked pie dish | `pot` (dish variant) on a fence post | 3: (60, 40), (−70, 0), (110, −120) | `Look · A pie dish` · "A pie dish, licked spotless, left on a fence post. A Haybury thank-you note is tucked underneath." |
| Empty lamp-stand | `kit_ruin_lampstump` | 4 along the Long Lane | the shared line |
| Mouse milestone | `threemills_milestone` | 5 along R1, R2, R3 | `Read · A tiny milestone` · "HAYBURY 1 MILE. (Mouse miles.)" |

Fill pool: mouse milestone, empty scarecrow pole.

**People** (S-141): Ma Haybury at the Pie Shop counter (148, 14); Pa Haybury in the kitchen gardens (130, −10); six
Haybury kits round the Green (`./cast.md#the-hayburys`); Goody Gander (`./cast.md#goody-gander`) at Middle Mill's door
(0, −2) (step 1: at the Pie Shop); Pennywhistle (`./cast.md#pennywhistle`) in his field (100, 60); Lady Honksworth
after the calm; Rook during his race and ss-29. **13.**

**Activities and story marks:** the Harvest Cut field (`./side-content.md#act-harvest-cut`): the 40 × 40 m wheat square
on Tumble Hill's south slope centred (40, 70), timed by Middle Mill's sail; Clover's Dash course (S-154): start the
Green Bench (142, 36) → gates (100, 40), (60, 40), (−20, 60), (−6, 110), (−70, 60), (−130, 0), (−100, −90),
(−40, −120), (40, −110), (110, −40) → finish (142, 36); ≈ 900 m; tiers 110 s / 130 s / 160 s. **Rook's Races part 3**
(S-154): the Weathercock Barn (160, −20) → R1 → up Middle Mill's inside stair to the gallery; 260 m; ghost 48 s. Fishing
(S-206): `fish-1` the pond's east bank by the sluice (−14, 110), `fish-2` the channel mouth (−70, 220). ss-27 *Your
Honkship*: the Festival Green; ss-28 *Scarecrow Hats*: five hats at the Grandmother Apple's low bough (−44, −132), the
Marsh Lamp boardwalk (−90, 140), Middle Mill's sail tip (grabbed as it sweeps low past the gallery), the north orchard
(60, −150) and the Haystacks (60, 80); ss-29: Pennywhistle's Field; ss-30 *Pie Rations*: delivery spots per
`./side-content.md#ss-30`; ss-04 *The Mayor Goes to Sea*: Ribbit's speech on Middle Mill's gallery; ss-13: Shellby's
spot is the Mill Bench.

**POI count:** finds 50 (4 landmarks, 14 chests, 4 keepsakes, 10 acorns, 3 vistas, 1 bottle, 2 logs, 3 Hollow doors,
6 benches, root-gate, jetty) + sites ≈ 43 + curios 22 + gates 4 (2 hookblooms, tide stone, hay avalanche) + quest
props 2 (vole den, sluice wheels) = **≈ 121 at the finds step**; with people **134**. Required at 160,000 m²: 128 (the
finds step's own count is checked against 128 once people land in S-141; the S-144 PR records both numbers).

<a id="threemills-interiors"></a>

### Threemills: interiors and doors

No interior realms. Haybury doors (`Knock`; second line from `beacon:threemills`):

| Door | Before | After |
|---|---|---|
| Cottage 1 (156, 30) | "'Pies are rationed! One slice each and no looking sad at the window.'" | "'Pies are NOT rationed! Take two! Take three! Take the dish!'" |
| Cottage 2 (168, 4) | Six tiny voices: "'WHO IS IT?' ...'IT'S A BOY.' ...'A BOY WITH EARS.'" | Six tiny voices: "'IT'S PIP!' The door stays shut. Lots of giggling." |
| Cottage 3 (138, −8) | A note: "Gone to watch Her Honkship flap. Back when she stops." | A note: "Gone to the Harvest Festival. Back when the pies run out (never)." |
| Cottage 4 (174, 40) | "'The wheat's still green, the mill's still still, and my tail's still cold. Go away, nicely.'" | "'The wheat's gold! Come in! ...Actually, the floor's all flour. Stay out, nicely.'" |
| Cottage 5 (126, 52) | A sign: "SCARECROW REPAIRS. Hats sold separately." | (same) |
| Cottage 6 (180, −36) | "Snoring that sounds a lot like a small windmill." | "Snoring that sounds a lot like a windmill that's very pleased with itself." |

<a id="threemills-beacon"></a>

### Threemills: the beacon and what changes

Beacon: the sun-lamp in the Granary's cupola. Kindled at its heart in the Granary Vaults' last room under the Granary
(`./dungeons.md#d4`); Pip exits to spawn `granary`. Within 10 s of `beacon:threemills`: the cupola lights gold and
throws a soft 40 m beam straight up (1 s); the three mills release their brakes and their sails spin up (5 s); the
wheat goes from green `#8fbf4a` to gold `#e7c45a`, spreading outward from Tumble Hill at 30 m/s (done by 8 s
everywhere in view); Haybury's chimneys smoke; the music becomes the jig; home's crown lantern lights and horizon card
d's windows glow at night. If this is the third beacon, `towerOpen` follows (`./story.md#beacon-3`). The plaza visitor
is a Haybury kit. Positional landmark sound: the mills' creak-and-whoosh in a three-beat pattern (audible 250 m).

<a id="threemills-palette"></a>

### Threemills: palette (`W.palette.threemills`)

| Slot | Day | Dusk | Night |
|---|---|---|---|
| Sky top · horizon | `#a7d3f0` · `#f4ead0` | `#5a6aa0` · `#e7a05a` | `#141c30` · `#2a3450` |
| Fog colour · near/far | `#e8eef0` · 110/290 | `#d9b08a` · 90/270 | `#20283a` · 60/240 |
| Sun / moon · hemisphere | sun `#fff8e0` · `#d8e8f0` / `#5a4a2a` | sun `#ffc078` | moon `#dce4f4` · `#2a3450` / `#161a20` |
| Water shallow · deep · millpond tint | `#7fb8b0` · `#3a6a7a` · `#8ab89a` | | |
| Wheat (dim → restored) | `#8fbf4a` → `#e7c45a` | | |

Terrain slots (`./art-audio.md#threemills`): grass → `threemills_pasture`, forest → `threemills_hedgebank`, meadow →
`threemills_field` (tilled furrows), sand → `threemills_beach`, snow → `threemills_chalk` (sound `dirt`), dirt →
`threemills_lane`, rock → `threemills_chalkcliff`. Fallback tint hexes `#e7c45a #7fae4b #c2563f #a7d3f0`.

<a id="threemills-music"></a>

### Threemills: music and ambience notes

Track `threemills`: fiddle and accordion. **Dim:** a slow 3/4 air at 76 bpm, accordion alone; the fiddle comes in for
two bars a loop, patient and a bit hungry. **Restored:** a 6/8 jig at 116 bpm in G major, fiddle lead, accordion
chords, frame drum and spoons. Layers: Haybury adds a tin whistle counter-line; Tumble Hill puts a mill-creak on the
off-beat; Orchard Rows adds plucked strings and birdsong; Millpond Marsh adds a low accordion drone and frog croaks on
the bar line. Ambience beds: `farm`, `hilltop`, `orchard`, `marsh`.

<a id="threemills-kit"></a>

### Threemills: prop kit and ART BRIEFs (S-139)

Instanced types (≤ 24): apple tree (reused `tree_round` + apple cluster, leaves `#7fae4b`, apples `#c2563f`), round tree
(reused), hedgerow segment, stile, field gate, wheat card, barley card, sunflower (reused flower card), haystack, hay
bale, fence (reused `fence`), scarecrow pole, cart, thatched cottage, reed card, boardwalk post, lily pad, milestone,
grass card, `kit_bench`, `kit_ruin_pillar`, `kit_ruin_lampstump`, `kit_ruin_ring`, `kit_log_niche` = **24**. Unique:
the three mills (one model, three skins; sails a separate mesh), the Granary and Hoist House, the Weathercock Barn,
the Grandmother Apple, the Marsh Lamp, the Pie Shop, the Old Sluice House, Hollow doors, root-gate. New material
programs: thatch, chalk plaster, hedge, wheat (colour uniform lerp), cupola glass, iron, reed, millpond tint = **8**.

<a id="brief-threemills-mill"></a>

**`threemills_mill`: windmill (three skins).** Silhouette: a tapering round tower mill with a boat-shaped conical cap,
four lattice sails on a hub, a small gallery round the cap, a door and two windows. Size: Middle 22 m (sails 18 m),
Tansy and Thrift 18 m (sails 16 m); base 7 m across. Palette: Middle `#f2efe6` + `#a7d3f0`; Tansy `#e7c45a` + `#7a5a3e`;
Thrift `#c2563f` + `#f4efe2`; cap shingles `#5e4a34`; sails frame `#8a6a48`, sail cloth `#f4ead0`. Materials: toon
plaster, toon shingle, sail cloth (double-sided). Poly ≤ 4,000 each (sails ≤ 600 as a separate rotating mesh). Fallback:
cylinder + cone + four thin boxes. Image prompt (turnaround, 1536 × 1024, opaque): "three cosy tower windmills on one
round grassy hill, one white with sky-blue trim, one ochre yellow, one barn red, each with a pointed cap, four lattice
sails with cream cloth and a little gallery round the cap; front and side views". 3D prompt: "stylised tower windmill
22 m with conical cap, four lattice sails as a separate mesh, cap gallery, door and windows, toon shading, three colour
variants".

<a id="brief-threemills-granary"></a>

**`threemills_granary`: the Granary and the sun-lamp cupola.** Silhouette: a squat round stone granary on staddle
stones with a conical roof crowned by a glass lantern cupola; a hoist house with a timber crane arm beside it. Size:
10 m across, 12 m + 3.5 m cupola; hoist house 5 × 4 × 6 m, arm 7 m. Palette: stone `#d9cdb4`, roof `#5e4a34`, cupola
glass `#fff1c4` lit / `#6b6478` dark, iron `#4a4a52`, hay `#e7c45a`. Animation: crane arm swing and lift (quest step
4). Poly ≤ 3,600. Fallback: cylinder, cone, small glass cylinder; box hoist. Image prompt: "a round stone granary on
mushroom-shaped staddle stones on a hillside, a cone roof topped by a glass lantern cupola glowing like a little sun,
a wooden hoist house with a crane arm beside it, a big heap of hay against the cellar door". 3D prompt: "stylised round
granary 10 m with glass cupola lamp, staddle stones, separate hoist house with crane arm, toon shading".

<a id="brief-threemills-others"></a>

**`threemills_barn`: the Weathercock Barn.** A tall red gambrel-roofed barn `#c2563f` with white trim `#f4efe2`, a loft
door, a copper weathercock `#b87a4a` (green patina `#6fa08a`) that turns to the wind. 16 m + 3 m; ≤ 2,800 tris.
Image prompt: "a tall red barn with white trim, a hay loft door, and a big copper weathercock on the roof ridge, mice
for scale". 3D prompt: "stylised red gambrel barn 16 m with copper weathercock (separate mesh), toon shading".

**`threemills_grandmother_apple`: the Grandmother Apple.** A huge, wide, gnarled apple tree, 18 m tall and 24 m across,
its lowest bough resting on a stone crutch, red apples, a little bird box. Bark `#6e5236`, leaves `#7fae4b` / `#9fc45a`,
apples `#c2563f`. ≤ 6,000 tris (LOD ≤ 700). Image prompt: "an enormous old apple tree, wider than it is tall, gnarled
trunk, one long low bough propped on a stone crutch, full of red apples, in an orchard of smaller trees". 3D prompt:
"stylised giant gnarled apple tree 18 m, wide crown, low propped bough, toon shading".

**`threemills_marsh_lamp`: the Marsh Lamp.** An open iron-frame tower on four stilts in a reedy pond, a small stone
lamp room on top with a dark brass lamp, a ring platform at the waterline. 15 m; iron `#4a4a52`, stone `#d9cdb4`, rust
`#8a5a3c`. ≤ 2,200 tris. Image prompt: "an old iron lamp tower standing on four stilts in a reedy millpond at dusk, a
small stone lamp room on top with a dark brass lamp, a wooden boardwalk leading to a ring platform at its feet". 3D
prompt: "stylised iron stilt lamp tower 15 m with stone lamp room and ring platform, toon shading".

**`threemills_cottage`: Haybury cottage.** A small round-walled thatched cottage at mouse scale for its residents but
human-door size for play (3.5 m tall at the ridge), thatch `#e2c38a`, walls `#f4efe2`, door `#c2563f`, flower boxes.
≤ 1,000 tris. **`threemills_pie_shop`**: the same with a striped awning `#e7c45a` / `#c2563f` and an open counter
of pies; ≤ 1,600 tris. **`threemills_sluice_house`**: an 8 × 6 m stone house with a small side waterwheel and three
iron sluice wheels inside; ≤ 2,000 tris. Image prompt (sheet): "a cosy mouse village of round thatched cottages with
flower boxes, a pie shop with a striped awning and pies cooling on the counter, an old stone sluice house with a little
waterwheel by a reedy pond".

**Small props.** `threemills_hedgerow` (a 4 m hedge segment 1.4 × 1.2 m, leaves `#5f8f3a` with hawthorn flowers
`#f4efe2`, ≤ 160 tris, collider rail; LOD to a box at 40 m); `threemills_stile` (two-step wooden stile, ≤ 120);
`threemills_gate` (five-bar gate, ≤ 140); `threemills_wheat` (deco card cluster 1 m, colour from the wheat uniform);
`threemills_barley`; `threemills_haystack` (domed 3 m stack `#e7c45a`, ≤ 200); `threemills_bale` (≤ 60);
`threemills_scarecrow_pole` (a 2.2 m cross with a straw tuft, ≤ 100); `threemills_cart` (old hay cart, ≤ 500);
`threemills_reed` (reed card cluster); `threemills_boardwalk_post`; `threemills_lilypad`; `threemills_milestone`
(a 0.4 m stone with carved letters, ≤ 60). Fallbacks from primitives in the land's hexes. 3D prompt pattern: "stylised
<thing>, cosy farmland set, toon shading, game-ready".

<a id="threemills-coverage"></a>

### Threemills: 40 × 40 m coverage plan

Grid 15 × 15 cells (576 m). Expected **≈ 118 land cells** (low water adds ≈ 2 for the pond floor).

| Area | Cells | Passes by |
|---|---|---|
| Haybury and the east fields | 14 | town, finds, people, R1 |
| Tumble Hill | 20 | mills (high point), Granary, chests, acorns, Hollow, R1/R5 |
| Orchard Rows (north and east fields) | 38 | orchard blocks, field features, chests, R2/R6, milestones, root-gate |
| Millpond Marsh and the sheep downs | 40 | pond, boardwalks, Marsh Lamp, Sheep Downs, Long Lane, field features |
| North chalk coast | 6 | cliffs view, Hollow, chest-2 |

Expected: find ≈ 86, view ≈ 10, path ≈ 18, **fill 0-6 (cap 12 % = 14)**. Farmland is the risk: a big fallow field off
every path passes only by its field feature, so the recipe's field-feature rule is what keeps fill low; if fill exceeds
the cap, lower the field-feature size threshold from 1,600 m² to 1,200 m² (recipe change, same milestone) rather than
adding fill.

---

<a id="hoots-margins"></a>

## Hoot's Margins

Post-game. Professor Hoot's Field Notes, walked into: **Pinewhistle as Hoot sketched it**, on paper, in ink and
pencil, full of his cheerful mistakes. Pip fixes twelve of them ("Hoot's Corrections") by tracing their dotted
outlines with the sword, and each fix reveals a page of *Hoot's Last Paper* (ss-52, `./side-content.md#ss-52`), the
one where he is finally right. A small, bright, funny place: no enemies, no night, no hurry.

<a id="margins-card"></a>

### Hoot's Margins: identity card

| Field | Value |
|---|---|
| id | `margins` |
| Kind | variant of `pinewhistle` (ENGINE §2.1): **same seed `40223`, same recipe, same geometry**; prints equal Pinewhistle's (`tests/fixtures/realm-prints/margins.json` must deep-equal `pinewhistle.json` on placements, `H` and `reg`) |
| Unlock | `mainEnding`; entered from Hoot's study at home (`./atlas-home.md#interiors`): `[E] Enter · Hoot's Margins` at his open notebook. `hidden: true` until S-300 |
| Spawns | `page` (116, 140) facing 0° (Pinewhistle's jetty spawn); `eraser` = `page` |
| Exit | **the Eraser Door** at the spawn (a giant pink eraser standing on end with a door drawn on it): `[E] Enter · Hoot's study` |
| Time of day | frozen at 11:00 (no night; benches absent, so no Starsong time change) |
| Enemies | none (every region `max: 0`) |
| Post-passes | the Pinewhistle find passes do **not** run; only `placeMarginsInk` (`seed * 79 + 1`) and the doodle spots |
| Steps | S-300 realm (palette, remap, music, spawn, exit, doodles) · S-301 ink-trace puzzles and ss-52 |

<a id="margins-look"></a>

### Hoot's Margins: the look

- **Palette** (`W.palette.margins`): paper `#f4efe2`, paper shadow `#e9e1cf`, ink `#2b2b33`, pencil `#8a8a92`, Hoot's
  highlighter `#f2d35c`, red correction ink `#c8553d`, watercolour wash blue `#9fc3d6` (water), wash green `#b8d0a0`
  (meadows). Sky: a flat paper gradient `#f4efe2` → `#e9e1cf` with a drawn sun doodle billboard
  (`margins_sun`) where the sun would be; no clouds but four drawn cloud doodles. Fog `#efe8d8` near 120 / far 290.
  Hemisphere `#ffffff` / `#d8d0c0`; shadows tinted `#8a8a92` at 0.35.
- **Water.** The sea plane is the page margin: paper colour with faint ruled lines (`margins_ruled` on the water
  material) and a watercolour wash edge `#9fc3d6` along the shore. Walkability is unchanged.
- **Terrain slots:** grass → `margins_paper`, forest → `margins_hatch` (cross-hatching), meadow → `margins_stipple`,
  sand → `margins_ruled`, snow → `margins_smudge` (graphite smudge; sound `dirt`), dirt → `margins_ink` (a dashed ink
  line, so every path reads as a drawn route), rock → `margins_rockhatch`. Generated 1024² seamless webp
  (`tools/make_seamless.py`); fallback: canvas-drawn paper with procedural hatching.
- **Scatter remap** (variant data, ENGINE §2.1): `tree_pine` and tall pine → `margins_pine_card` (two crossed
  alpha cards of an ink pine); oak → `margins_oak_card`; fern and bush → `margins_scribble_bush`; grass card →
  `margins_hatch_card`; flower card → `margins_doodle_flower`; rocks, stumps, bridges, buildings and every landmark
  keep their meshes but use the **sketch material** (paper-white fill, ink hull at 1.5× the normal width, a screen-space
  pencil-hatch texture in shadowed areas).
- **Region cards** (same four regions, music `margins`, ambience `paper`):

| # | Card | Region |
|---|---|---|
| 0 | **Acornet Hollow** · "Not to scale" | as Pinewhistle |
| 1 | **Misthollow Ravines** · "Ink still wet" | as Pinewhistle |
| 2 | **Sawmill Run** · "See footnote 3" | as Pinewhistle |
| 3 | **Whistle Rise** · "First draft" | as Pinewhistle |

- **Landmarks:** the four Pinewhistle landmarks in the sketch material; the Whistling Pine has a drawn measuring tape
  hanging down its trunk with "34 m?" in red ink.
- **Music** `margins`: pencil percussion (pencil taps for the beat, an eraser squeak as the off-beat, a page-turn
  swish every 8 bars), a bassoon melody (Hoot's theme, playful, 96 bpm, F major) and a music-box counter-melody that
  quotes the Pinewhistle flute motif. Ambience `paper`: soft scratching and distant page turns. Each Correction
  completed adds a short ink-swoosh sting.

<a id="margins-corrections"></a>

### Hoot's Margins: the twelve Corrections (ink-trace puzzles, S-301)

**The mechanic.** At each Correction a **dotted outline** of something Hoot forgot or drew wrong (a bridge, a stair,
a ledge) waits beside 3-6 **ink pots** (`margins_inkpot`, 0.6 m, hit targets) with red-ink numerals floating above
them. Swing the pots in number order: each hit pot's numeral turns into a red tick. Wrong order: the pots smudge with a
pencil-scratch and reset after 1.2 s (no damage, no penalty). When the last pot is hit, the outline inks in from the
near end over 1.5 s and becomes a solid, walkable deck **for good** (`margins:ink-<n>`). Each inked deck is a bridge
deck prepared by `placeMarginsInk` with `active: false` until its flag is set (bridge decks gain an `active` flag read
by `bridgeAt`, the same idea as the collider `active` toggle). At the deck's far end a little **lectern**
(`margins_lectern`) holds a page: `[E] Read · Page <n>` (text in `./side-content.md#ss-52`). Pots are always on the
near side; nothing is ever unreachable before its outline is inked.

| # | Correction (page title) | Region · where (Pinewhistle coordinates) | Inked thing | Pots |
|---|---|---|---|---|
| 1 | "The Jetty Was Longer" | Acornet · jetty end (128, 157) | a 14 m pier extension out over the margin to a drawn rock islet (138, 168) | 3 on the jetty |
| 2 | "The Oak Has a Stair" | Acornet · the Hoard Oak (84, 112) | a stair of 4 flights to the first bough platform (+8 m) | 4 round the roots |
| 3 | "Up, Not Under" | Misthollow · the Long Bridge's middle (21, −21) | a stair from the deck up to the trestle's lamp-top (h 25) | 4 on the deck |
| 4 | "The Fall Has a Ledge" | Misthollow · the Upper Fall (60, −60) | a ledge stair from the ravine floor to Twin Planks' deck (h 21) | 3 on the floor |
| 5 | "The Mist Is Wet Air" | Misthollow · ravine at u = 60, centre (42, −42) | a new 26 m footbridge across the ravine | 5 on the SE rim |
| 6 | "Spur Ravines Are Not Bottomless" | Misthollow · Owl Bridge (−108, −51) | a ladder-stair down into the Owl spur ravine to a drawn grotto | 3 on the bridge's south end |
| 7 | "The Wheel Goes Round" | Sawmill · the mill pond (−92, 74) | stepping planks across the pond to the Log Raft (−100, 70) | 4 on the bank |
| 8 | "Footnote 3" | Sawmill · the Whistle Stack (−71, 85) | an upper gallery stair 8 m above the real gallery | 5 on the real gallery |
| 9 | "Logs Float" | Sawmill · the stream mouth (−165, 165) | a log bridge to a drawn sandbar (−182, 178) | 3 on the beach |
| 10 | "The Pine Is Thirty-Four Metres" | Whistle Rise · the pine (120, −120) | a spiral ink stair round the trunk to the lamp cradle (+30 m): the highest point in the Margins | 6 round the root door |
| 11 | "Owls Can Count" | Whistle Rise · summit → the Crow's Shelf (140, −150) | a 22 m bridge from the summit to the Shelf | 4 on the summit |
| 12 | "Stars Are Not Missing" | Whistle Rise · (100, −140) | an ink stair up into the sky to a drawn star platform 20 m above the summit, the last page | 6 on the summit; the outline appears only when 1-11 are inked |

Hours: ≈ 1.25 h (12 × 5 min plus walking). Correction 12's page is Hoot's final paper; ss-52 completes when it is read.
The pots' order is always readable from the numerals; Ask the Tree's hint for a stuck Correction is its pot order.

<a id="margins-doodles"></a>

### Hoot's Margins: the doodles

Four friendly, talkable **doodles**: Hoot's sketches of folk he met, drawn a bit wrong. Each is a paper-cutout
billboard NPC (`margins_doodle_<id>`, generated 512 × 768 webp with alpha, flat-shaded card that turns to face Pip)
with two lines. They are drawings, not the real characters, and say so.

| Doodle | Spot | Lines |
|---|---|---|
| Doodle Ribbit | Acornet square (92, 120) | "I have a moustache in this one. I've never had a moustache. ...It's quite distinguished, actually." / "Professor Hoot drew me in a hurry. My left leg is just a scribble. I'm making do." |
| Doodle Nutmeg | the Hoard Oak door (80, 118) | "According to the professor, I am a circle. With a tail. I have opinions about this." / "The acorns in this drawing are labelled 'probably acorns'. They are acorns." |
| Doodle Pinfeather | Mossy Span's SE end (−36, 34) | "The label under me says 'woodpecker?' With a question mark. The question mark is the rudest part." / "I'm an owl in this drawing. Professor Hoot thinks everybody is an owl, deep down." |
| Doodle Mossmantle | Mossmantle's Bough (132, −108) | "I'm drawn asleep. That's fair. That's very fair." / "He wrote 'hums (badly)' next to me. Hums well, thank you. Hums beautifully." |

Image prompt pattern (each, 512 × 768, transparent): "a quick, affectionate pen-and-ink doodle with light pencil
shading of <subject>, drawn slightly wrong in a funny way (<the wrong detail>), on transparent background, like a
sketch in a naturalist's notebook". Subjects: "a frog mayor in a sash" (wrong detail: a curly moustache); "an elder
squirrel" (drawn as a near-perfect circle with a tail); "a woodpecker professor in spectacles" (drawn like an owl, with
'woodpecker?' written underneath); "a mossy sloth hanging from a bough, asleep" (with 'hums (badly)' written beside
it). Fallback: a canvas card with the name in ink and a simple outline.

<a id="margins-kit"></a>

### Hoot's Margins: assets and ART BRIEFs (S-300, S-301)

New material programs: sketch, ink card, paper water = **3**. Bundle: 7 terrain layers (≈ 700 KB), cards and doodles
(≈ 900 KB), well under 2.5 MB.

| Key | What | Generate · process | Fallback |
|---|---|---|---|
| `margins_pine_card`, `margins_oak_card` | ink trees, cross-hatched, 1024 × 2048 webp alpha | "a pen-and-ink drawing of a tall pine (or a broad oak), cross-hatched shading, on transparent background, naturalist's sketchbook style"; trim with `tools/export_sprites.py` | the original tree mesh in the sketch material |
| `margins_scribble_bush`, `margins_hatch_card`, `margins_doodle_flower` | small ink cards 512² alpha | "a loose pen scribble of a bush / a patch of hatched grass strokes / a tiny doodled flower, transparent background" | crossed planes with canvas strokes |
| `margins_paper`, `margins_hatch`, `margins_stipple`, `margins_ruled`, `margins_smudge`, `margins_ink`, `margins_rockhatch` | terrain 1024² / 512² seamless webp | "seamless texture of cream drawing paper with <plain fibre / pen cross-hatching / ink stippling / faint blue ruled lines / graphite smudges / a dashed ink line / hatched stone>"; `tools/make_seamless.py` | canvas procedural paper |
| `margins_sun` | drawn sun doodle 512² alpha | "a cheerful doodled sun with a smiley face and wobbly rays, pen and highlighter yellow, transparent background" | yellow canvas circle |
| `margins_inkpot` (3D) | a round ink pot 0.6 m with a red numeral above (numeral is a canvas sprite) | brief below | cylinder + sphere |
| `margins_lectern` (3D) | a little wooden lectern 1.1 m with a page | brief below | box + plane |
| `margins_eraser_door` (3D) | a 3 m pink eraser standing on end, a door drawn on it | brief below | pink box + drawn-door decal |

**`margins_inkpot`.** Silhouette: a squat round glass ink pot with a cork, ink splashed round its foot. Size 0.6 m tall,
0.5 m across. Palette: glass `#2b2b33` (ink-filled), cork `#c9a27a`, splash `#2b2b33`, hit tick `#c8553d`. Poly ≤ 200.
Animation: a hit makes it hop 0.1 m and splash an ink-drop card. 3D prompt: "stylised big round ink pot with cork, ink
splash at the base, toon shading with heavy ink outline".

**`margins_lectern`.** A small slanted wooden lectern with one page held by a pebble. 1.1 m; wood `#9b7b56`, page
`#f4efe2`. Poly ≤ 180. 3D prompt: "stylised small wooden lectern with a single page, sketch style".

**`margins_eraser_door`.** A huge pink eraser standing on end, worn at the corners, a door drawn on its face in pencil,
pencil-shaving crumbs round it. 3 × 1.6 × 1.0 m; `#f2a0a8`, pencil `#8a8a92`. Poly ≤ 120. 3D prompt: "stylised giant
pink rubber eraser standing upright with a door drawn on it in pencil, toon shading".

<a id="margins-tests"></a>

### Hoot's Margins: what the tests check (instead of the coverage rule)

Hoot's Margins is a puzzle variant with no finds, so the 40 × 40 m coverage rule does not apply to it (decision
below). Its tests: (1) prints equal Pinewhistle's; (2) every Correction's pots, near deck end and lectern are reachable
from `page` with no inked decks; (3) after each `margins:ink-<n>`, the inked deck is walkable end to end and its
lectern reachable; (4) Correction 12's outline and pots exist only when 1-11 are set; (5) the realm suite enters and
leaves the Margins once with no leaks, draw calls and triangles within budget at four views (the sketch material's
thicker ink hull is the cost to watch); (6) `?noassets=all` renders it with canvas paper and the original meshes.

---

<a id="isle-totals"></a>

## Isle totals (cross-check with CANON §10.3)

| Land | Acorns | Keepsakes | Hollows | Vistas | Chests | Bottles | Lamp Logs | Benches | Root-gate | Land km² | POIs (min) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Duskwick | 6 | 4 | 2 | 2 | 10 | 1 | 5 (2 given) | 5 | 1 | 0.08 | 64 |
| Pinewhistle | 10 (3 in the hoard) | 4 | 3 | 3 | 14 | 1 | 2 | 5 | 1 | 0.15 | 120 |
| Archwater | 9 | 4 | 3 | 3 | 12 | 1 | 2 | 5 | 1 | 0.11 | 88 |
| Threemills | 10 | 4 | 3 | 3 | 14 | 1 | 2 | 6 | 1 | 0.16 | 128 |
| **Four isles** | **35** | **16** | **11** | **11** | **50** | **4** | **11** | **21** | **4** | **0.50** | |

These match CANON §10.3 for all four isles. Chest gems: 38 × 30 = 1,140 (12 of the 50 are prize chests); keepsake gems 16 × 25 = 400 (both part of
the ledger in `./systems.md#economy`). Gated finds by tool across the four isles (for the progression solver and pacing
rule 5): Lantern dark zones 7; Leaf Glider 6 (plus Threemills chest-10, which low water also opens); Tide Bell 3
(Duskwick chest-5, Threemills chest-11 and acorn-10) plus Archwater's four low-water finds whenever its tide is high;
high water 2; Thistle Hook 5; Digging Paws 8; Starsteel 4; Starsong 4. Each Act II tool re-opens exactly three finds on
the two sibling isles and Duskwick: Glider (Duskwick chest-7, Archwater chest-9, Threemills chest-10), Tide Bell
(Duskwick chest-5, Threemills chest-11, acorn-10), Thistle Hook (Duskwick chest-6, Pinewhistle chest-11,
Archwater chest-10), on top of the home finds in `./atlas-home.md`.

---

<a id="decisions"></a>

## Decisions made here

CANON leaves these open; this file decides them. Each is a default a later step may revisit only by editing this file.

1. **Four landmarks per isle**, one per region, with names: Duskwick (the Lamplighters' Tower, the Wick Mast, the
   Three Chimneys, the Old Fan); Pinewhistle (the Whistling Pine, the Long Bridge Trestle, the Whistle Stack, the Hoard
   Oak); Archwater (the Great Arch, the Watch Column, the Spouter, Rafferty's Mast); Threemills (Tansy, Thrift and
   Middle Mill, the Weathercock Barn, the Grandmother Apple, the Marsh Lamp). Middle Mill is 22 m, Tansy and Thrift
   18 m.
2. **Every recipe number, coordinate, region rule, path, bridge and anchor** in this file, including the region rules
   by bearing, height and the Pinewhistle `(u, v)` frame, and the jetty, spawn and root-gate positions.
3. **Post-pass RNG streams for isles**: `seed * 71 + c` (finds), `seed * 73 + c` (later passes), `seed * 79 + 1`
   (Margins ink), listed in [the stream table](#passes).
4. **POI definition and the coverage test**: a land cell is ≥ 160 m² reachable; pass by find, view (high point ≥ 2 m
   above all neighbours, or a bench or vista within 60 m with line of sight) or path (a POI within 80 m along it); the
   fill pass may fill at most 12 % of land cells; tide realms are tested in both states.
5. **Beacon geometry**: each isle's beacon is a `kit_beacon` cage on its landmark (the pine's crown cradle, the arch
   keystone, the granary cupola's sun-lamp; the Tower's great lamp for Duskwick), switched by `beacon:<realm>`;
   kindling happens at a heart in the dungeon's last room, after which Pip exits at a named spawn.
6. **Two-state tide everywhere a tide stone exists**: `waterY` 0 / −1.4. Duskwick and Threemills get one tide stone
   each (lagoon mouth, Old Sluice House) from S-122 and are tested in both states; Archwater is stuck low until its
   beacon. Pip is lifted to the nearest walkable cell with a 0.4 s fade if the tide floods his cell.
7. **Lamp Log default numbers**: Duskwick 1-5 (1 given in ch8, 2 given at the first-beacon beat, 3-5 placed),
   Pinewhistle 6-7, Archwater 8-9, Threemills 10-11. `./lore.md#lamp-logs` owns the texts; if lore.md numbers the
   logs differently, the placement ids here (`<realm>:log-n`) are renumbered to match in the same PR.
8. **Bottle Chain letter defaults** (1 = oldest, 12 = the shipped bottle): Duskwick 3, Pinewhistle 5, Archwater 7,
   Threemills 9. `./atlas-far.md` places the other seven; if the two files collide, `./lore.md#bottles` settles it.
9. **Benches**: Threemills has 6, the other isles 5.
10. **The local quest chains** (4 steps each, one per region) and their physical props: Pinewhistle's jammed wheel,
    loose pegs, knot-hole score (order 2-4-1-3) and root door; Archwater's three pearls and pearl door; Threemills' vole
    den, Hoist Key, sluice wheels and hay avalanche. `./story.md#ch9-11` owns the dialogue and wins on any conflict.
11. **Three of Pinewhistle's ten acorns sit in the Acornets' hoard** until ss-19, then are replanted at three flagged
    spots.
12. **One star door (Starsong night find) per isle**: Duskwick log-5, Pinewhistle acorn-10, Archwater acorn-9,
    Threemills chest-3. **One thornglass per isle**: Duskwick chest-10, Pinewhistle chest-14, Archwater acorn-8,
    Threemills chest-14. Duskwick's chest-10 ships in S-086 behind a temporary rock collider that S-233 swaps for the
    thicket.
13. **Two buried (Digging Paws) chests per isle**, inside each isle's chest count.
14. **Interiors**: only Granny Wick's Library (the Long House in Wickhaven, `duskwick_library`) and the Raft cabins
    (`archwater_cabins`) are interior realms; Pinewhistle and Threemills have `Knock` doors only. The Library holds the
    30-slot Lamp Log bookcase and Flick's loft workshop.
15. **Granny Wick's place and habit**: she lives in Wickhaven's Long House and goes to the Tower's foot at dusk.
16. **The Tower's outer stair** (six straight flights to a window ledge at h 32) is walkable from ch8; the Lamp Thief
    glimpse happens there; the ledge is vista-1 and the launch point for chest-7.
17. **The Hundred Lamps entrance** is the Vault door at the foot of Tower Head's north cliff, reached by the Vault
    Stair whose gate opens at `mainEnding`.
18. **Root-gates** sit in a surfaced root of Wenna's whose arch points at home's bearing from that isle.
19. **The Marsh Lamp** is an unlit Lamplighter ruin (not the beacon) until the main ending's festival.
20. **Manifest key naming**: `<realm>_<thing>` for land assets, `kit_<thing>` for the shared kit
    (`./art-audio.md` may rename; keys stay one-to-one).
21. **Hoot's Margins**: no enemies, always 11:00, no benches, no tracker row group (ss-52 is its only tracker entry),
    twelve Corrections as listed, four doodles, the Eraser Door exit, inked decks as bridge decks with an `active`
    flag, and an exemption from the coverage rule in favour of the tests in [its test list](#margins-tests).
22. **Fishing spots**: two per Act II isle (8 of CANON's 18; `./atlas-far.md` places the other 10).
23. **Rook's Races parts 1-3** run on Pinewhistle, Archwater and Threemills with the routes and ghost times given;
    **Clover's Dash** routes and tier times for the four isles as given.
24. **Shellby's Slow Walk spots**: the Jetty Bench (Duskwick), the Long Bridge's middle (Pinewhistle), the Moon Pool's
    west rim (Archwater), the Mill Bench (Threemills).
25. **Horizon bearings** between isles, derived from home's card bearings at equal chart distance (Kettle and
    Saltglass at 1.6×); the chart section of `./atlas-far.md` wins if it lays the chart out differently.
26. **New lore in keepsakes**: Granny Wick's paper lantern from age 12; the pine's evening tune whose low note Wenna
    hums; the Acornets keeping three of Wenna's acorns for her; Archwater's tide answering the arch lamp; Rafferty's
    childhood oar; Goody and "Honky" as girls; Threemills' lamp biscuits for the Lamplighters' autumn visit; the Marsh
    Lamp's unused wicks. All are past tense and consistent with CANON §3.
27. **Plaza visitors** after each beacon: an Acornet kit, a rafter and a Haybury kit (named in `./cast.md`).
28. **Kinako's Floating Bazaar** moors at Duskwick's bazaar pier (24, 114); its boat brief is here unless
    `./cast.md#kinako` supplies one.
29. **Vista names and Hoot's captions** for all eleven isle vistas.
30. **Wickhaven, Acornet Hollow, the Raft and Haybury door lines** (each with a restored-state second line).
