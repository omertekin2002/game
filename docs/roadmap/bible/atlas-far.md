# Atlas: the deep, the sea and the sky

The design reference for every land Pip reaches after Act II: **the Rootdeep** (below), **the Glassway**, **Kettle
Isle** and **Saltglass Flats** (the far Wide Blue), **Driftholm**, **the Starmeadow** and **the Crown** (above), plus
the travel geography that joins them to home: the Lamplighter's Chart, the buoys and sail lanes, the root-gate spurs
and the Starstair. Written 2026-11-21 from `CANON.md` §5 and the step rows of `INDEX.md` (M21-M32).

**Scope.** This file owns places: layouts, recipes, coordinates, region cards, landmarks, points of interest,
collectible placements, keepsake and curio texts, signs, interiors, prop kits with ART BRIEFs, music notes and the
coverage proof plan for each land. It does **not** own:

- travel *systems* (chart UI, boat physics, bench and root-gate rules): [systems.md#travel](./systems.md#travel),
  [systems.md#boat](./systems.md#boat);
- enemy and boss definitions: [creatures.md](./creatures.md) (the spawn tables below are copied from
  [creatures.md#spawn-tables](./creatures.md#spawn-tables), which wins);
- dungeon and Hollow interiors: [dungeons.md](./dungeons.md) (this file places their doors);
- people: [cast.md](./cast.md) (this file gives their spots' coordinates);
- dialogue, beats and side-story steps: [story.md](./story.md), [side-content.md](./side-content.md);
- lore texts (bottles, Lamp Logs, memories): [lore.md](./lore.md) (this file places them);
- textures, loading cards, music note data: [art-audio.md](./art-audio.md);
- home-island content, including the Starstair's home end: [atlas-home.md](./atlas-home.md);
- the shared Lamplighter kit (bench, root-gate knot, Hollow door, vista post, Lamp Log lectern, jetty):
  [atlas-isles.md#shared](./atlas-isles.md#shared).

**Order of authority.** `CANON-NOW.md` LOCKED > `CANON.md` > this file > a step issue. Where a sibling bible file
defines something this file also mentions (an enemy id, a spawn weight, a line of dialogue), the sibling wins and
this file is the bug.

---

<a id="how-to-read"></a>
## How to read a land section

<a id="conventions"></a>
### Conventions

- **Coordinates** are realm metres, origin at the realm grid's centre, **x east, z south (north is −z)**, y up, as on
  the home island. A realm of grid `G` spans `−G/2 … +G/2` on both axes.
- **Bearings** are compass degrees, clockwise from north. A point at bearing θ and range r is
  `x = r·sin θ`, `z = −r·cos θ`.
- **Anchors.** Every position below is an *anchor*. Generators place the real thing **nearest-walkable around the
  anchor**, within the search radius given (default 12 m), on reachable ground, exactly like `placeShells` on home.
  A step never hard-codes a final coordinate from this file into a test; tests assert "within the radius of the
  anchor" and "reachable".
- **Named anchors** for scene scripts (`w:<name>` in [story.md#scene-format](./story.md#scene-format)) are listed in
  each land's *Named anchors* table. Steps add them to `W.anchors` in the recipe or post-pass that creates the thing.
- **Ids.** Realm content ids are `<realm>:<id>` (save rule, [systems.md#save-plan](./systems.md#save-plan)).
  NPC spot ids are `<realm>.<name>` ([cast.md#spots-and-schedules](./cast.md)). Dungeon `door` ids are bare and
  unique per realm.
- **Region cards** use the shipped format: name on line 1, subtitle on line 2.
- **Prompts** use the verb list in [charter.md#verbs](./charter.md): `Enter`, `Sail`, `Sit`, `Ring`, `Dig`, `Hook`,
  `Climb`, `Touch`, `Kindle`, `Give`, `Fish`, `Sketch`, `Unlock`, plus the shipped `Look`, `Open`, `Read`, `Talk`,
  `Use`. Tools with no target (Sunglass beam, Ember Sling, Starsong, Tide Bell) show no pill.
- **"Gate"** after a find names the tool it needs. A find with no gate is reachable on the land's first visit with
  the tools the progression solver says Pip has there.

<a id="template"></a>
### The land template (every section below, in this order)

1. **Card**: id, kind, grid, seed, land km², recipe, palette, unlock, connection, hours, steps.
2. **Shape and recipe**: the generator's layout in numbers (centres, radii, heights, noise), and its stage order.
3. **Regions**: card name, subtitle, extent rule, landmark, entry points, `REGIONS`-shaped row.
4. **Arrival, benches and gates**: spawns, jetty or landing, Lamplighter benches, the root-gate.
5. **Named anchors** for scenes.
6. **Points of interest**: the budget table (kind, count, rule) that must reach one per 1,250 m² of land, then
   every placed find with its id, anchor, gate and note.
7. **Keepsakes**: four texts (label, name, two lines) and the fifth line that appears when all four are found.
8. **Curios**: one-line `Look` texts (no reward; they are views and stories).
9. **Enemies**: copied from creatures.md; placed-species anchors.
10. **People and spots**: spot ids with coordinates; who stands where, when.
11. **Interiors, dungeon and Hollow doors**.
12. **World states**: what changes, when, and where it is seen.
13. **Music and ambience** notes (note data lives in art-audio.md).
14. **Prop kit** with an ART BRIEF per new model (template: [art-audio.md#brief-template](./art-audio.md#brief-template)).
15. **Coverage proof**: the 40 × 40 m cell test's expectations.
16. **Step map**: which `S-` step builds what.

<a id="brief-format"></a>
### ART BRIEF format used here

Every brief below follows [art-audio.md#brief-template](./art-audio.md#brief-template), compressed to one block:

> **`manifest_key`** · *Silhouette* · **Size** (m) · **Palette** (hex) · **Materials** (toon.js names) · **Tris**
> (code-built budget / painted-GLB budget) · **Pose/anim** · **Fallback** (what js/props.js builds when the key is
> missing) · **Image prompt** (appended to the `#style` preamble; for a concept sheet or texture) · **3D prompt**
> (for the owner's later painted-GLB batch).

"PREAMBLE" means the image-prompt preamble in [art-audio.md#style](./art-audio.md#style). Every image is original,
generated inside the step that needs it (a GPT Sol subagent with `image_gen.imagegen`, or a Gemini model),
processed with `tools/make_seamless.py`, `slice_sheet.py`, `process_strip.py` or `export_sprites.py`, saved as webp
and registered with a `realm` tag. Every 3D model ships code-built in the toon style; the painted GLB is the owner's
later drop-in through the same manifest key. Glow parts use the `glow` / `nightGlow` toon inputs, never real lights
(the 4-light lamp pool picks the nearest lamps).

<a id="far-passes"></a>
### Post-pass RNG streams for the far realms

Every far realm is frozen by `tests/fixtures/realm-prints/<id>.json` in the step that first generates it; that
milestone's later steps may refresh it; after the unhide step only post-passes add content. Each post-pass draws from
its own stream `new RNG(seed * k + c)` (the realm's seed), restores `W.walk / W.reach`, adds nothing to other lists,
and is proved by a realm test on that realm's seed plus seeds 1-20 of the same recipe.

| Pass | `k`, `c` | Adds | Step that adds it per land |
|---|---|---|---|
| recipe stages | 7·3, 13·5, 17·3, 31·17 (as home) | terrain, scatter, paths, gem trails | the recipe step |
| `placeFinds` | 71, 3 | chests, keepsakes, acorns, vistas, Lamp Logs, bottles, Hollow doors, benches, curios, NPC spots | the land's "finds" step |
| `placeBuried` | 73, 5 | soft-earth mounds and buried chests (Digging Paws) | S-181 for the Rootdeep; the finds step for later lands |
| `placeThornglass` | 79, 7 | thornglass thickets (Starsteel) | S-233 for the Rootdeep, Glassway and Kettle; the finds step for later lands |
| `placeFishSpots` | 83, 9 | ripple spots | S-207 for the Rootdeep and Glassway; the finds step for later lands |
| `placeNightFinds` | 89, 11 | star doors and night-only finds (Starsong) | the finds step of each far land that has them (the Rootdeep has no night and none) |
| `placeSideMarks` | 107, 19 | props owned by a side story (lamps to relight, itch spots, dig spots, nameplates) | the side story's step |
| `placeStates` | 109, 21 | healed-state props swapped in by flag (no new collision on paths) | the land's main-chain step |
| `placeSetPiece` | 109, 23 | a main-path set piece's temporary props (the Glassway's fog bells, the Teeth and the mailbags; Kettle's forge targets) | S-203b (Glassway), S-232c (Kettle) |

These are per-realm streams, so they never collide with the home constants in
[atlas-home.md#passes](./atlas-home.md#passes). If [atlas-isles.md#shared](./atlas-isles.md#shared) fixes a
different shared table for all non-home realms, that table wins and these rows are renumbered to it.

<a id="poi-kinds"></a>
### What counts as a point of interest

CANON §5.1 asks for one point of interest per 1,250 m² of land and a generator test that every 40 × 40 m cell of land
holds a find, a view or a path to one. The coverage test (`tests/coverage.test.js`, added with the first far land's
finds step if the isles have not added it) counts these anchor kinds: chest (including buried), keepsake, acorn,
vista post, Lamp Log, bottle, Hollow door, dungeon door, bench, root-gate, jetty or docking spot, buoy, NPC spot, fish
spot, thornglass thicket, gate find (a hookbloom, ivy lattice, cloud mote route, glide ledge, receiver or brazier that
leads to something), side-story mark, activity start, landmark, and **curio** (a `Look · <thing>` with one line and
no reward). Gem trails and enemies never count.

**The cell test.** For every 40 × 40 m cell holding at least 200 m² of walkable, reachable land (at the realm's
default state; for the Glassway, at both tides, taking the union), the cell passes if **any** of:
(a) a counted anchor lies inside it; (b) the cell holds a path or trail cell (`pathD < 2`) and a counted anchor lies
within 60 m path distance; (c) from the cell's highest walkable point a landmark top is in line of sight within the
realm's fog far distance (ray against `W.H` and box colliders). The test prints failing cells as `(cx, cz)` and fails
on any. Each land section gives its expected cell count so a broken recipe shows up as a count change.

---

<a id="travel-geography"></a>
## Travel geography

How the far lands sit around home. The rules of each way of travelling (prompts, costs, when fast travel is
allowed) live in [systems.md#travel](./systems.md#travel); this section is where things are.

<a id="realm-graph"></a>
### The realm graph

```
                    THE STARMEADOW (above, ch19) ──[Ladder of Lights, d11]──> THE CROWN (ch20-21)
                           ^  Spiral Arch (act3done)
                       DRIFTHOLM (ch18)
                           ^  the Starstair: Cairn needle ↔ Stair Landing (3 stones)
  PINEWHISTLE  ARCHWATER  STARSEED ISLE  THREEMILLS  DUSKWICK        (chart sailing, ch7-ch8)
                               │ Nell's Jetty
                               v  past the reef (ch14)
                         THE GLASSWAY ──Kettle buoy──> KETTLE ISLE
                               └──────Saltglass buoy──> SALTGLASS FLATS
  root-gates under every Wide Blue land ── THE ROOTDEEP (ch13) ── memory knots ──> THE REMEMBERED ISLE
```

The Rootdeep lies **directly under home**: the Taproot stands under the Great Tree, and the root-gate spurs run out
along the same bearings the isles have on the chart, so the underground map and the sea chart agree.

<a id="chart"></a>
### The Lamplighter's Chart (layout)

The chart is a painted parchment, 1024 × 1024 px (`ui_chart_wideblue`, generated in S-080; canvas fallback draws the
same layout as circles and labels). North is up. Home is the centre `(512, 512)`. A land's button sits at
`x = 512 + r·sin θ`, `y = 512 − r·cos θ` (px), where θ is its bearing from home. The bearings are the ones the
horizon cards already face (CANON §5.3), so what Pip sees from the Great Tree is what the chart shows.

| Land | Bearing | r (px) | Button (px) | Horizon card from home | Shown on the chart |
|---|---|---|---|---|---|
| Starseed Isle | - | 0 | (512, 512) | - | always |
| Pinewhistle | 337.5° (N-NW) | 230 | (424, 300) | `horizon_isle_a` | from `ch8` |
| Kettle Isle | 67.5° (E-NE) | 400 | (882, 359) | `horizon_isle_e` | fog bank "Nell won't risk the fog yet." until `ch14`, then a button once the Kettle buoy has been used once |
| Archwater | 112.5° (E-SE) | 230 | (724, 600) | `horizon_isle_b` | from `ch8` |
| Duskwick | 157.5° (S-SE) | 230 | (600, 724) | `horizon_isle_c` | from `lanternGot` |
| Saltglass Flats | 202.5° (S-SW) | 400 | (359, 882) | `horizon_isle_f` | as Kettle Isle, with the Saltglass buoy |
| Threemills | 247.5° (W-SW) | 230 | (300, 600) | `horizon_isle_d` | from `ch8` |
| The Glassway | 180° (band) | 300-460 | button "Beyond the Reef" at (512, 852) | - | a dotted reef ring (r 300 px) from `ch8`; the band beyond it in fog until `ch13`; "Beyond the Reef" button from `ch14` |
| Driftholm | 45° (NE, sky) | 420 | (809, 215), drawn on a cloud | `sky_isle` | painted from the start; a dotted stair from the Cairn to it appears per Stair Stone (1-3 dots-and-steps segments); a button only from `ch18` ("Climb the Starstair from the Cairn" is the label, not a sail) |

- **The reef** is a painted ring of foam at r 300 px. Sailing past it is the `ch14` beat.
- **The Glassway band** is drawn as clear green-blue water from bearing 60° clockwise to 215° between r 300 and
  460 px, with its nine islets as dots and three buoys as tiny striped marks. Kettle Isle sits at its north-east end,
  Saltglass Flats at its south-west end.
- **Tabs** (map card): **The Wide Blue** (this chart), **Under** (the Rootdeep, `ui_chart_under`, from `ch13`: the
  Taproot at the centre and eight spurs at the same bearings, each spur ending in a root-gate icon that lights once
  opened), **Above** (Driftholm and the Starmeadow, `ui_chart_above`, from `ch18`). Each realm's own land map
  (the per-realm canvas) opens from its button.
- **Fog** on the chart is the one in-world sign of an unbuilt or locked land (INDEX §2, "Hidden until whole").
  A land whose realm is still `hidden: true` stays a fog bank whatever the flags say.

<a id="sailing-geography"></a>
### Chart sailing and the far crossing

- **From a jetty** (`[E] Sail · the Dandelion`): the chart opens; any lit button can be picked; a 4-6 s painted
  sailing card plays; Pip arrives at that land's jetty spawn. From `ch14` the chart also offers "Beyond the Reef",
  which arrives in the Glassway at its `north` spawn **aboard the Dandelion** (free sailing), or at the Post Rock dock
  in the chart-stop fallback.
- **Kettle Isle and Saltglass Flats** are first reached only through their Glassway buoy, so the player sails the
  Glassway at least once each way. After a buoy has been used once (`S.travel['glassway:buoy-kettle']`), that isle's
  chart button lights and later trips can go straight from any jetty.
- **Sailing cards** (art-audio.md#loading-cards): `card_sail_near` (the four near isles), `card_sail_reef` (past the
  reef: the foam ring, Nell pointing), `card_sail_far` (a steaming cone on one card, a pale shore with a bell tower on
  the other: two variants `_kettle` and `_saltglass`).

<a id="buoys"></a>
### Buoys and sail lanes (in the Glassway)

All buoys are in the Glassway realm; positions are Glassway coordinates. Buoy prompts open nothing but their own
crossing.

| Buoy | Anchor | Prompt (from the boat, within 6 m) | Leads to |
|---|---|---|---|
| `glassway:buoy-home` | (0, −300) | `[E] Sail · Starseed Isle` | the chart (any lit land; default selection Starseed Isle) |
| `glassway:buoy-kettle` | (308, −150) | `[E] Sail · Kettle Isle` | `kettle` spawn `jetty`, card `card_sail_far_kettle` |
| `glassway:buoy-saltglass` | (−250, 250) | `[E] Sail · Saltglass Flats` | `saltglass` spawn `jetty`, card `card_sail_far_saltglass` |

Harbour buoys are 3.2 m tall, coral and cream striped, with a lit lamp on top (a Lamplighter spiral on the lamp
cage). Lane buoys are 1.4 m, white with one coral band, every 40 m along a lane, unlit by day, a small `nightGlow` at
night. Lanes are guidance, not rails: the boat may go anywhere the water is deep enough
([#glassway-tide](#glassway-tide)).

| Lane | Waypoints (Glassway coords) | Open at |
|---|---|---|
| North Lane | (0, −296) → (0, −282) the Post Rock north pier | both tides |
| Wreck Lane | (0, −296) → (90, −285) → (235, −215) → (308, −150) the Kettle buoy | both tides |
| Shell Lane | (0, −296) → (−110, −285) → (−265, −205) → (−300, −60) → (−295, 120) → (−250, 250) the Saltglass buoy | both tides (it stays in deep water west of the Sandbars) |
| Bell Lane | (95, −190) off Post Rock's east dock → (60, −60) → (0, 0) the Glass → (0, 135) the Bell Islet pier | both tides (the Glass is a 2.4 m shelf: 1.0 m of water at low tide) |
| The Bar Cut | the Tern Tuft pier → across sandbar B2 → the Whelk's Spit pier | high tide only (a shortcut over the bars; at low tide Pip walks it instead) |

<a id="root-gate-network"></a>
### The root-gate network

One root-gate per Wide Blue land, opened from both sides (Digging Paws on the surface side; Lumbra ferries between
opened gates after `lumbraCalm`). In the Rootdeep each gate is the far end of a **spur**, a root tunnel on its land's
chart bearing. Surface positions for the four near isles and home are in their atlas files; the far lands' gates are
in their sections below.

| Gate id | Rootdeep spur end (Rootdeep coords) | Surface end | Opens |
|---|---|---|---|
| `gate-home` | (−118, −58) top of the Windmill Stair (no spur: Burrowbottom's back stair) | home, under the Meadow Windmill ([atlas-home.md#placePortals](./atlas-home.md#placePortals)) | `ch13` (from home) |
| `gate-pinewhistle` | (−100, −242) (a nook past glade A) | Pinewhistle ([atlas-isles.md#pinewhistle](./atlas-isles.md#pinewhistle)) | `ch13` end (visited isles) |
| `gate-kettle` | (231, −96) | Kettle Isle, the Handle Arch foot ([#kettle-arrival](#kettle-arrival)) | Paws on the surface side, after first arrival |
| `gate-archwater` | (231, 96) | Archwater | `ch13` end |
| `gate-duskwick` | (96, 231) | Duskwick | `ch13` end |
| `gate-glassway` | (0, 250) | Glassway, Spiral Skerry ([#glassway-arrival](#glassway-arrival)) | Paws on the surface side, after `ch14` |
| `gate-saltglass` | (−96, 231) | Saltglass Flats, the Acacia Root ([#saltglass-arrival](#saltglass-arrival)) | Paws on the surface side, after first arrival |
| `gate-threemills` | (−231, 96) | Threemills | `ch13` end |

Driftholm, the Starmeadow and the Crown have **no root-gate**: they are not on Wenna's roots. Their fast travel is
their benches, and the Starstair.

<a id="starstair-route"></a>
### The Starstair (route)

The home end (the Cairn needle climb and the three flights as they hang in home's sky) belongs to
[atlas-home.md#starstair](./atlas-home.md#starstair). The route as a whole:

| Piece | Where | When | What the player does |
|---|---|---|---|
| The needle summit | home, Summit Crystal Cairn (100, −48), top ledge | Hook route from the Thistle Hook on (a home Hook find, Act II); ivy route with the Gloves | stands at `w:cairn.needle` |
| Flight 1 | 22 floating steps rising from the needle toward bearing 45° | 1st stone set | seen from every realm as `sky.flight {n: 1}` |
| Flight 2 | 22 more steps, continuing up and north-east | 2nd stone set | `sky.flight {n: 2}` |
| Flight 3 | the last 22 steps to a cloud bank under Driftholm | 3rd stone set | `sky.flight {n: 3}`; the stair is now whole |
| The climb | `[E] Climb · the Starstair` at the needle's first floating step | 3 stones set | portal to `driftholm` spawn `stair`; loading card `card_starstair` (Pip on a floating step, home small below, Driftholm's arch above) |
| The Stair Landing | Driftholm (−100, 80) | from `ch18` | `[E] Climb · the Starstair` back down: portal to home `cairn-needle` spawn |
| The Spiral Arch | Driftholm, Arch Rise top (95, −20), y ≈ 100 | `act3done` | `[E] Enter · the Spiral Arch` → `starmeadow` spawn `arch` |
| The Arch Gate | the Starmeadow (−220, 200) | from `ch19` | `[E] Enter · the Spiral Arch` → `driftholm` spawn `arch` |
| The Ladder | the Starmeadow, Windlass Isle (150, −120) | `ch19` | `[E] Climb · the Ladder of Lights` → dungeon d11 → the Crown |

Seen from each place: from home the stair climbs to the painted sky isle in the north-east; from Driftholm the stair
falls away to the south-west into cloud, home's Great Tree small and far on the ground card below; from the
Starmeadow, Driftholm is a lilac shape far below to the south-west, and the Ladder of Lights hangs in the north-east.

---
<a id="rootdeep"></a>
## The Rootdeep

The layer below: Wenna's roots under the sea floor, warm, dark and glowing, with Digby's family living in its
western burrows. The Taproot stands exactly under the Great Tree, and eight root spurs run out to the Wide Blue lands
along their chart bearings. Act III opens here (chapter 13): Digby leads, Lumbra is calmed in the Rootdeep Heart, the
Digging Paws are won and the memory knots wake.

<a id="rootdeep-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `rootdeep` · overworld, cavern (no sky, no sun, no day/night) |
| Grid · seed · land | 576 m · 40241 · 0.15 km² (realm test asserts 0.14-0.16) |
| Recipe | `js/realms/recipes/cavern.js` (`cavern`) |
| Palette | void `#1c1a24`, root-glow `#ffcf7a`, glow-moss `#7be0c8`, root `#8a5a3c`; fog `#1c1a24` near 10 m, far 90 m |
| Light | `light.tod` frozen at 22:00; hemisphere sky `#3a2f4a`, ground `#2a1e18`, intensity 0.45; no sun shadow; lamp pool from glow props |
| Unlock · connection | `act2done`; the root-gate under home's Meadow Windmill opens in ch13 (`ch13`); `hidden: true` until S-191 |
| Hours | main path 3.5 h (incl. the Heart and memories 1-3 is 1.5 h more, CANON §11); full exploration about 3 h |
| Built by | S-175 recipe, S-176 props, S-177 art, S-178 people, S-179 enemies, S-180 finds, S-181 Paws, S-182 root-gates, S-183-S-185 the Heart and Lumbra, S-186 Hollows, S-190 knots, S-191 ch13 (unhide), S-192-S-193 side stories |

<a id="rootdeep-shape"></a>
### Shape and recipe

The generator fills the grid with rock (`H = 30`, not walkable) and carves chambers, tunnels and spurs out of it.
Every carved floor is walkable unless it is water. Stage order: `layout` → `rock` → `carve` → `floors` → `lake` →
`causeways` → `spurs` → `ceilings` → `regions` → `scatter` → `trails` → `reach` → `splat` → `colliders` → `anchors`.

| Piece | Numbers |
|---|---|
| **Underlake Hall** | disc centre (0, 0) r 110. Lake: disc r 72, surface y 0, bed y −3 (deep: not walkable, no swimming). Taproot island: disc r 20, floor y 1.5. Shore ring r 72-110: floor y 1-4 (noise amp 1.5, wavelength 40 m) |
| Causeways | three root causeways 5 m wide, top y 1.2, from the island edge to the shore at bearings 0°, 90°, 270°; root-log edging both sides (visual, no collider) |
| The Drip Gate | the lake's spillway at bearing 180°, r 72-110, 20 m wide, water y −0.4 (deep); six stepping roots across it in a row at 2.6 m spacing (1.0 m hop gaps), tops y 0.6 |
| **Burrowbottom** | ellipse centre (−165, −5), rx 85, rz 70; three terraces: upper (z < −25) y 9, middle y 6, lower (z > 15) y 3; ramps 4 m wide at x = −150 and x = −190 between terraces. Ceiling `over` box at y 13 over the whole ellipse ("Mind your head") |
| Burrow Tunnel | (−110, 0) → (−82, 0) into the hall, 10 m wide, `over` ceiling at y 8 |
| Windmill Stair | stone-and-root stair, 4 m wide, from the upper terrace (−132, −44) up to the gate-home landing (−118, −58) at y 14; `over` ceiling 3 m above each step |
| **Glowcap Forest** | annular sector bearings 295°-65°, r 105-250; floor y 2-14 (two-octave noise, amp 6, wavelengths 60 m and 18 m); three flat glades r 14 at (−60, −160), (60, −170), (0, −228); open to the hall along r 105 between bearings 330° and 30°; no ceiling collider (roof card at y 34) |
| **Geode Galleries** | five chambers: G1 (147, −85) r 40 y 4; G2 (140, 0) r 48 y 2; G3 (220, −10) r 36 y 6; G4 (147, 85) r 40 y 3; G5 (205, 125) r 34 y 5. Tunnels 8 m wide, `over` ceilings at 7 m: hall east causeway shore (110, 0) → G2; G2 → G1; G2 → G3; G2 → G4; G4 → G5. G1 opens into Glowcap's eastern end (no tunnel). A crevasse 7 m wide, 4 m deep, with a ramp out at its north end, crosses G3 north-south at x = 228 |
| **Drip Bay** | the outflow from the Drip Gate south to (0, 240): a channel 28 m wide (water y −0.4, deep) with banks 22 m wide either side (floor y 0.5-3); grottos (discs r 15) at (−40, 170), (40, 190), (−40, 222). (The walk-through drip curtain hiding c07 is on the hall's west shore, not here.) |
| **Spurs** | eight tunnels 8 m wide, `over` ceiling at 6 m, floors rising 0-6 m, each ending in a gate room (disc r 8) at the spur end listed in [#root-gate-network](#root-gate-network). Branch points: Pinewhistle from Glowcap glade A (spur end pushed to (−100, −242), a 15 m nook); Kettle from G3; Archwater from G5; Duskwick from the Drip Bay east bank at (25, 200); Glassway at the Drip Bay's south end; Saltglass from the west bank at (−25, 210); Threemills from Burrowbottom's lower terrace at (−200, 40) |
| Walls | carved edges blend over 4 m into rock at 60-80° (root-wall stamps hide the seam); rock above the carve is `H = 30` |
| Roof | great halls (Underlake, Glowcap, Geode galleries) have no ceiling collider; a dark rooty roof card at y 34 with glow-root decals is drawn over them. Low halls (Burrowbottom, tunnels, spurs) have `over` boxes |
| Water plane | sized `max(1000, 576 + 600)`; tinted `#14303a`, glow-moss reflections; no tide |

Land budget (target 0.15 km²): Underlake shore, island and causeways ≈ 24 k m²; Burrowbottom ≈ 19 k; Glowcap ≈ 58 k;
Geode galleries and tunnels ≈ 28 k; Drip Bay ≈ 8 k; spurs and gate rooms ≈ 7 k. Sum ≈ 144 k m².

<a id="rootdeep-regions"></a>
### Regions

| id | Card | Extent rule | Landmark (anchor, height) | Entry points (landmark must be visible from each) | `REGIONS` row |
|---|---|---|---|---|---|
| `burrowbottom` | **Burrowbottom** / "Mind your head" | the Burrowbottom ellipse, the Burrow Tunnel, the Windmill Stair and the Threemills spur | **the Great Burrow Lamp** (−165, −5), 11 m | Windmill Stair landing (−118, −58); tunnel mouth (−110, 0) | music `rootdeep`, layer `town`; ambient `market`; enemies [] ; max 0 |
| `glowcap` | **Glowcap Forest** / "Mushrooms the size of houses" | the Glowcap sector and the Pinewhistle spur | **the Grandmother Cap** (0, −180), 22 m | the north shore mouth (0, −110); G1's west edge (110, −110) | music `rootdeep`, layer `glow`; ambient `glowfizz`; enemies per creatures.md |
| `underlake` | **The Underlake** / "Very quiet water" | r < 110 from (0, 0), Drip Bay, and the Duskwick, Glassway and Saltglass spurs | **the Taproot** (0, 0), 60 m | every causeway foot; the Drip Gate | music `rootdeep`, layer `lake`; ambient `drips` |
| `geode` | **Geode Galleries** / "Sparkly" | G1-G5, their tunnels, and the Kettle and Archwater spurs | **the Sun Geode** (140, 0), 14 m | the east tunnel mouth (110, 0) | music `rootdeep`, layer `geode`; ambient `drips` |

Glow landmarks use the landmark fog cap (fog never above 0.45 on them), so the Taproot and the Grandmother Cap read
through the 90 m fog as soft glowing shapes: the cavern's answer to the first-person rule that landmarks do the
navigating.

<a id="rootdeep-arrival"></a>
### Arrival, benches and gates

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn from home | `home` | (−118, −58), facing 225° | top of the Windmill Stair; the Great Burrow Lamp is in view, down and to the left |
| Memory return spawn | `taproot` | (0, −22), facing 180° | north causeway foot; used when a memory ends |
| Heart exit spawn | `heart` | (0, 13), facing 180° | outside the Heart door |
| Gate spawns | `gate-<land>` | each spur's gate room centre, facing back down the spur | one per row of [#root-gate-network](#root-gate-network) |
| Bench | `rootdeep:bench-burrow` | (−165, 14) | Burrowbottom middle terrace square |
| Bench | `rootdeep:bench-glade` | (−60, −160) | Glowcap glade A |
| Bench | `rootdeep:bench-taproot` | (12, −10) | Taproot island, facing the Taproot |
| Bench | `rootdeep:bench-geode` | (128, 14) | G2, facing the Sun Geode |
| Bench | `rootdeep:bench-drip` | (22, 150) | Drip Bay east bank |
| Root-gates | `rootdeep:gate-*` | the eight spur ends | knot prop from [atlas-isles.md#shared](./atlas-isles.md#shared); the Rootdeep side of every gate is open from `lumbraCalm`; travelling needs the far side opened too |

The Starsong's Dusk and Dawn do nothing at Rootdeep benches (no day here); the bench says so once: "No sky down here.
The roots keep their own time."

<a id="rootdeep-anchors"></a>
### Named anchors

| Anchor | Position | Used by |
|---|---|---|
| `w:taproot` | (0, 0), y 0 | ch13, memory scenes, finale echo |
| `w:taproot.face` | (0, −9), y 6, facing north | ch13 Wenna's voice ("down in my roots") |
| `w:taproot.knot1` … `knot12` | bearing 15° + 30°·(n−1), r 6.6, y 2.2 | `[E] Touch · Memory` |
| `w:heartDoor` | (0, 9.5), facing 180° | ch13, the Heart |
| `w:burrowLamp` | (−165, −5), y 9 | ss-31 |
| `w:gran` | (−180, −32) | ch13 meeting Gran Burrows |
| `w:vein.bell`, `w:vein.kettle`, `w:vein.saltglass` | Taproot base → (0, 250), (231, −96), (−96, 231) | `stoneSites` beat: the three veins light |

<a id="rootdeep-pois"></a>
### Points of interest

Target: 144,000 / 1,250 = **116**. Budget:

| Kind | Count | Rule |
|---|---|---|
| Overworld chests (30 gems each) | 12 | listed below; c09 is buried (Paws) |
| Keepsakes | 4 | round the back of each landmark |
| Sleeping Acorns | 9 | listed below |
| Vista posts | 2 | listed below |
| Lamp Logs | 3 | listed below |
| Hollow doors · dungeon door | 3 · 1 | listed below |
| Benches · root-gates | 5 · 8 | above |
| Memory knots | 12 | on the Taproot |
| NPC spots | 9 | [#rootdeep-people](#rootdeep-people) |
| Fish spots | 2 | S-207 pass |
| Dash start | 1 | Burrowbottom square |
| Thornglass thickets | 4 | S-233 pass |
| Gate finds | 8 | 1 glowbud door, 1 dark pocket, 1 glide ledge, 1 light-root crossing, 2 hookblooms (c11 and the G1 high ledge), 1 ivy lattice, 1 soft-earth mound |
| Side-story marks | 18 | 12 burrow lamps (ss-31), 6 itch spots (ss-32) |
| Landmarks | 4 | above |
| Curios | 16 | [#rootdeep-curios](#rootdeep-curios) |
| **Total** | **122** | |

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `c01` holds the Glowcap Night-Lamp (`nook:glowcap-lamp`), `c10` the Moonmoth Lilac hood trim (`trim_moonmoth`), `c05` the "Grandmother Cap" sticker (`sticker_rootdeep`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (`rootdeep:c01` … `c12`, 30 gems each; search radius 8 m):

| id | Region | Anchor | Gate | Note |
|---|---|---|---|---|
| c01 | Burrowbottom | (−182, −42) | - | upper terrace, the nook behind Gran's house |
| c02 | Burrowbottom | (−205, 32) | - | lower terrace, the end of the mushroom cellar row |
| c03 | Glowcap | (−75, −172) | - | glade A, under a fallen glowcap |
| c04 | Glowcap | (−150, −150) | Lantern | a dark pocket behind a glowbud door in the west wall |
| c05 | Glowcap | (45, −205) | Leaf Glider | a cap-top ledge 6 m up, glided to from the Grandmother Cap's lower shelf (a 9 m gap) |
| c06 | Underlake | (6, −62) | - | the north causeway's lip, by the water |
| c07 | Underlake | (−95, 40) | - | behind the west-shore drip curtain |
| c08 | Underlake | (−40, 170) | - | Drip Bay west grotto |
| c09 | Underlake | (30, 215) | Digging Paws | buried in the Drip Bay east bank (a soft-earth mound; the Paws come from the Heart, so it is a same-visit return) |
| c10 | Geode | (236, −20) | Sunglass | across G3's crevasse on a light-root that grows into a bridge for 20 s when beamed |
| c11 | Geode | (160, 105) | Thistle Hook | G4 wall ledge 7 m up, a hookbloom above it |
| c12 | Geode | (215, 140) | Ivy Gloves | G5, top of an ivy lattice on a geode face (an Act III return) |

**Sleeping Acorns** (`rootdeep:acorn-1` … `9`; snore within 10 m; woken with the Sunglass):
(−150, 0) Burrowbottom middle terrace flower box · (60, −170) glade B · (−20, −140) among cap roots · (−98, −228)
Pinewhistle spur nook · (−10, 12) Taproot island · (−100, −20) west shore · (40, 190) Drip Bay east grotto ·
(152, −98) G1 · (140, 75) G4.

**Vista posts** (`[E] Sketch · Vista`): `rootdeep:vista-roots` "The Roots of Everything" at (−14, 6) on the island,
looking up the Taproot into the dark; `rootdeep:vista-sun` "The Sun in the Rock" at (125, −20), G2's west ledge,
facing the Sun Geode.

**Lamp Logs** (`rootdeep:log-1` … `3`, spiral-glyph lecterns; which page each holds is set in
[lore.md#lamp-logs](./lore.md#lamp-logs)): log-1 the Lamplighters' waystation alcove carved in Burrowbottom's upper
terrace wall (−140, −42); log-2 a Lamplighter scaffold remnant on the island's east side (16, 4); log-3 an old survey
camp in G1 (a rusted lamp hook, a three-legged stool) (162, −100).

**Hollow doors and the dungeon** (spiral-carved doors; interiors in [dungeons.md#hollows](./dungeons.md#hollows)):

| Door id | Anchor | Leads to | Gate to reach the door |
|---|---|---|---|
| `heart_door` | (0, 9.5), the Taproot's south root door | d6 the Rootdeep Heart ([dungeons.md#d6](./dungeons.md#d6)) | - |
| `hollow_rootdeep_dig` | (−40, 226), Drip Bay south-west grotto | the dig Hollow | - (Paws inside) |
| `hollow_rootdeep_dark` | (98, −226), Glowcap's east wall | the dark Hollow | Lantern |
| `hollow_rootdeep_beam` | (240, 22), G3's east wall | the beam Hollow | Sunglass (the door's receiver) |

**Fish spots** (S-207, `placeFishSpots`): `rootdeep:fish-1` north shore (−30, −80), still water; `rootdeep:fish-2`
Drip Bay (−12, 185), running water. Species tables in [side-content.md#act-fishing](./side-content.md#act-fishing).

**Thornglass** (S-233, `placeThornglass`): (−120, −120) Glowcap west, (90, −135) Glowcap east, (170, 40) the G2-G4
tunnel's side nook, (−215, −10) Burrowbottom's far west lamp-lit corner. What each guards is set in
[systems.md#gates](./systems.md#gates).

**Rootdeep Dash** ([side-content.md#act-dash](./side-content.md#act-dash)): start at the Burrowbottom square
(−165, 14), checkpoints (−120, 0) tunnel, (−95, −40) west shore, (−40, −95) north shore, (0, −60) north causeway,
finish at the Taproot bench (12, −10). About 330 m.

<a id="rootdeep-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `rootdeep:k-lamp` | Great Burrow Lamp, north side (−165, −22) | "Something brassy" · Little brass oil can |
| `rootdeep:k-cap` | Grandmother Cap, north side (0, −198) | "Something glowing" · Glowcap spore print |
| `rootdeep:k-taproot` | the Taproot, north face (0, −10) | "Something tucked away" · Knitting needle |
| `rootdeep:k-geode` | the Sun Geode, east side (158, 0) | "Something sparkly" · Stub of chalk |

Lines (verb `Look`, 25 gems each, as the shipped keepsakes):

- **Little brass oil can.** "A little brass oil can on a hook behind the great lamp, polished thin at the handle where
  a paw has held it for years." / "Stamped on the bottom: a spiral, and 'Lamplighters' issue. Return to the Tower.'
  Somebody never did, and kept the lamp lit instead."
- **Glowcap spore print.** "A spore print pressed on a flat stone behind the Grandmother Cap. It still glows, a faint
  green-blue star." / "Scratched beside it: 'Everything down here grew from somebody's leftover light. Be kind to the
  mushrooms.'"
- **Knitting needle.** "A wooden knitting needle wedged in the bark on the Taproot's north side, three rows of green
  wool still on it." / "The wool is the exact green of Pip's hood. Someone sat right here once, knitting, so the Tree
  could listen."
- **Stub of chalk.** "A stub of white chalk behind the Sun Geode. On the rock above it, a chalk arrow pointing up and
  a number: 25,000." / "'Steps from here to the stars, give or take. We counted twice.' The handwriting is careful.
  The sum underneath is wrong."

**Fifth line** (toast and Lore entry when all four are found): "✿ The Rootdeep's keepsakes: the Lamplighters came
down here too. They oiled the lamps, counted the stairs and kept her company in the dark."

<a id="rootdeep-curios"></a>
### Curios (`Look`, no reward)

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · A very old root | (−70, 60) | "This root is wider than a cottage and warm as a teapot. It hums when you lean on it." |
| 2 | Look · Mole carving | (−190, 5) | "Carved low on the wall, at mole height: 'DIGBY WOZ ERE. Probably. Could not see.'" |
| 3 | Look · A patient drip | (60, 80) | "Drip. ...Drip. ...Drip. It has been dripping into the same little cup of stone for a very long time." |
| 4 | Look · Heart-shaped moss | (−30, −200) | "A patch of glow-moss in the shape of a heart. Either the moss is sweet on someone, or a mole was bored." |
| 5 | Look · Upside-down puddle | (100, −60) | "Water beads on the ceiling here and never falls. It is waiting for something. Possibly a sneeze." |
| 6 | Look · Lost button | (−150, 40) | "A brass button the size of a pancake. Whoever lost it was much bigger than a mole. Or wore very big coats." |
| 7 | Look · Root-glow pulse | (−60, −30) | "The glow in this root moves slowly toward the Taproot, like a heartbeat, but sleepier." |
| 8 | Look · A snoring stone | (200, −40) | "This stone snores. It is not an acorn. It is not a Pebble Mimic. It is just a stone with a cold, probably." |
| 9 | Look · Lamplighter hook | (130, −110) | "An iron hook in the rock, spiral-stamped. A lamp hung here once to light the way for someone small." |
| 10 | Look · Mushroom ring | (90, −200) | "Seven tiny glowcaps in a ring, all leaning inward, like they are sharing a secret." |
| 11 | Look · Fish shadows | (−20, −95) | "Pale fish drift under the surface. They have never seen the sun and seem completely fine about it." |
| 12 | Look · Market sign | (−140, 28) | "'BURROWBOTTOM MARKET. Worms (spoken to, not eaten). Tea. Lamp wicks. Gossip, free.'" |
| 13 | Look · Root map | (−125, −35) | "Someone painted the roots on this wall as a map. Eight lines go out from a big dot. One says 'home', underlined." |
| 14 | Look · Geode window | (190, 110) | "Through a crack in the geode you can see another geode. Through that one, another. It is geodes all the way." |
| 15 | Look · A soft spot | (−230, 90) | "The rock here is warm and smells faintly of hay. Somewhere up there, a long way off, is a farm." |
| 16 | Look · Wish pebbles | (10, 230) | "A pile of smooth pebbles, each with a little scratch-drawn star. The burrowers' wishes, sent along the roots." |

<a id="rootdeep-enemies"></a>
### Enemies

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables) (that file wins):

| Region | Rolled | Placed | max |
|---|---|---|---|
| Burrowbottom | none (town) | - | 0 |
| Glowcap Forest | `glow_grub 4, drip_bat 3` | - | 6 |
| The Underlake | `drip_bat 3, glow_grub 2, dimling 2` | - | 6 |
| Geode Galleries | `drip_bat 3, glow_grub 2` | `pebble_mimic` × 5 | 6 |

Pebble Mimic anchors (they sit as rocks until Pip is within 4 m): (135, −80) G1, (150, 15) G2, (212, −2) G3,
(140, 95) G4, (198, 118) G5. None within 12 m of a chest, so a mimic is never mistaken for one. No spawn point within
12 m of Burrowbottom's edge (creatures.md rule) or on the Taproot island.

<a id="rootdeep-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `rootdeep.gran` | (−180, −32) | Gran Burrows at her doorstep, all hours ([cast.md#gran-burrows](./cast.md#gran-burrows)) |
| `rootdeep.market-1` … `3` | (−158, 22), (−146, 26), (−134, 22) | three burrower stall-keepers (cast.md names them); always open |
| `rootdeep.lamp` | (−160, 4) | a burrower lamp-tender; ss-31's giver |
| `rootdeep.stair` | (−128, −44) | Digby waits here in ch13 until Pip arrives |
| `rootdeep.taproot` | (−6, −16) | Digby during the rest of ch13 and afterwards on visits "listening to her" |
| `rootdeep.lumbra` | (0, 238) | Lumbra's resting coil in Drip Bay after `lumbraCalm`; her head rises at any opened gate room when Pip uses it |
| `rootdeep.ferry-<land>` | each gate room centre + 3 m | Lumbra's talk point for the ferry (`[E] Talk · Lumbra the Long`) |

Digby's ch13 walk (F27 pathfinding, walks ahead of Pip, waits within 12 m): `rootdeep.stair` → (−150, −20) →
`rootdeep.gran` (the meeting) → `rootdeep.lamp` → (−115, 0) the tunnel → (−50, 0) the west causeway →
`rootdeep.taproot`.

<a id="rootdeep-interiors"></a>
### Interiors

| id | Door | Size · rooms | Holds |
|---|---|---|---|
| `int_gran_burrows` | Gran's round door (−183, −36), `[E] Enter · Gran's burrow` | 48 m · 2 rooms (parlour, sewing nook) | ss-33 Gran's Pouch; the "For Spring" thread basket; a photo-painting of young Digby with a helmet too big for him |

<a id="rootdeep-states"></a>
### World states

| Condition | Change (within 10 s, where it is seen) |
|---|---|
| before `lumbraCalm` | root walls glow at 0.35 of full, the Taproot's spiral grain at 0.4, Burrowbottom's 12 small lamps dim; ambience adds a slow creak |
| `lumbraCalm` | over 8 s the root glow ramps to 1.0 across the realm, outward from the Heart door; the Taproot's grain brightens bottom to top; knots 1-3 light |
| `stoneSites` | three veins of light run along the floor from the Taproot to `gate-glassway`, `gate-kettle` and `gate-saltglass`, pulsing `#ffcf7a` once every 2 s |
| `stone:<site>` | that vein turns steady gold `#fff1b8`; knots for the count light (4-6 at 1 stone, 7-9 at 2, 10-12 at 3) |
| memory knot states | dark (not yet open) · pulsing (open, unwatched) · steady (watched, `mem:n`) |
| ss-31 done | the 12 burrow lamps burn; the Great Burrow Lamp gains a ring of small lamps; burrowers have a lamp line |
| `mainEnding` | slow gold motes drift down the Taproot's sides every few seconds ("a little starlight came home") |

<a id="rootdeep-music"></a>
### Music and ambience

Track `rootdeep` (note data in [art-audio.md#rootdeep](./art-audio.md#rootdeep)): a low cello drone in D, 60 bpm,
long bowed notes. Layers by region: `town` adds a plucked bass and a little kitchen tune on a mandolin-like pluck
at 84 bpm (Burrowbottom); `glow` adds a celesta shimmer every 8 bars; `lake` drops to the drone alone and lets single
drips through at random 1.5-3.5 s; `geode` adds a glass-harmonica arpeggio in fifths. Ambience beds: `drips`,
`earthhum` (a 40 Hz warmth under everything), `market` (mole chatter and teacups), `glowfizz` (soft spores).
Lumbra moving far off: a slow low rumble, never louder than the music.

<a id="rootdeep-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (23 of 24): `rootdeep_knot`, `rootdeep_glowcap`, `rootdeep_root_arch`, `rootdeep_root_wall`,
`rootdeep_geode`, `rootdeep_burrow_door`, `rootdeep_stall`, `rootdeep_lamp_post`, `rootdeep_stalactite`,
`rootdeep_root_log`, `rootdeep_glowmoss`, `rootdeep_vein`, plus shared: bench, root-gate knot, Hollow door, vista
post, lectern, soft-earth mound, hookbloom, ivy lattice, thornglass, light-root, glowbud door. Single meshes (not
instanced): the Taproot, the Grandmother Cap, the Sun Geode, the Great Burrow Lamp. New material programs (7 of 12):
glow bark, glow cap, geode crystal, moss decal, lamp glass, wet rock, vein strip.

> **`rootdeep_taproot`** · a straight, slightly twisting column of pale-gold wood with deep root buttresses at the
> foot, glowing grain in one slow spiral up the trunk, vanishing into the dark · **60 m** tall, r 6 m (r 9 at the
> buttress flare) · bark `#8a5a3c`, grain glow `#ffcf7a`, buttress moss `#7be0c8` · glow bark (grain as an emissive
> mask), wet rock base · 1,800 tris code-built / 12 k painted · static; the grain glow breathes ±10 % over 6 s ·
> **Fallback:** a 24-sided tapered cylinder with six box buttresses and an emissive spiral strip ·
> **Image:** PREAMBLE + "concept sheet of an enormous ancient tree root rising like a column through a dark cavern,
> pale gold bark with a softly glowing spiral grain, mossy buttress roots, twelve small glowing knots around its base,
> front and three-quarter views, plain dark background" · **3D:** "stylised toon tree root column 60 m, gold bark,
> emissive spiral grain, buttress roots, 12 knot bulges at 2 m height, low-poly painterly, game-ready".

> **`rootdeep_knot`** · a round burl on the bark like a closed eye, a spiral carved in it · 0.9 m across · bark
> `#8a5a3c`, glow `#ffcf7a` (pulsing) / `#fff1b8` (steady) · glow bark · 80 / 600 · three states: dark, pulse
> (0.6 s in, 0.6 s out), steady · **Fallback:** a flattened sphere with an emissive spiral decal ·
> **Image:** PREAMBLE + "a round wooden burl on a tree trunk carved with a soft spiral, glowing warm gold from inside,
> three states side by side: dark, glowing, bright" · **3D:** "toon wooden burl with carved spiral, emissive inner
> glow, 0.9 m".

> **`rootdeep_glowcap`** · a fat, friendly mushroom with a domed cap, freckles that glow, a stout stalk · scaled
> 3 / 7 / 12 m (one mesh) · cap `#2f6b66`, freckles and gills `#7be0c8`, stalk `#e8dcc8` · glow cap · 260 / 2 k ·
> caps sway 1° over 5 s · **Fallback:** a hemisphere on a cylinder with emissive dots ·
> **Image:** PREAMBLE + "giant friendly glowing mushrooms in a dark cave, teal caps with glowing freckles, cream
> stalks, three sizes, turnaround sheet" · **3D:** "toon giant mushroom, teal cap with emissive freckles, glowing
> gills, cream stalk, 12 m".

> **`rootdeep_grandmother_cap`** · the oldest glowcap: a wide, slightly lopsided cap with a lower shelf fungus like a
> balcony, a doorway-sized gap in the stalk, moss beard · **22 m** tall, cap 18 m wide · cap `#245a57`, glow
> `#7be0c8`, stalk `#efe2cc`, shelf `#c9a46b` · glow cap · 900 / 6 k · slow 2 % breathing glow · **Fallback:** a
> scaled `rootdeep_glowcap` with a box shelf at 9 m · **Image:** PREAMBLE + "a grandmotherly giant mushroom in a
> glowing cave forest, lopsided teal cap, a balcony-like shelf fungus, a mossy beard, soft green-blue light" ·
> **3D:** "toon giant mushroom 22 m, wide lopsided cap, shelf fungus ledge at 9 m, emissive gills".

> **`rootdeep_root_arch`** · a thick root looping over a tunnel like a doorway · 8-10 m span, 6 m high · root
> `#8a5a3c`, glow vein `#ffcf7a` · glow bark · 220 / 1.5 k · static · **Fallback:** a half torus with a tube
> radius of 0.8 m · **Image:** PREAMBLE + "a thick glowing tree root arching over a cave tunnel like a doorway" ·
> **3D:** "toon root arch, 9 m span, emissive veins".

> **`rootdeep_root_wall`** · a panel of tangled roots pressed into rock, used to hide carve seams · 6 × 8 m, 1.5 m
> deep · `#6b4a32`, `#8a5a3c`, moss `#7be0c8` · glow bark + wet rock · 180 / 1.2 k · static; the 6 itch-spot
> variants carry a dry flaky decal `#c2a98a` · **Fallback:** three crossed cylinders on a box ·
> **Image:** seamless texture, PREAMBLE + "tangled tree roots pressed into dark rock, faint glowing veins, tileable,
> 1024 px" (processed with `make_seamless.py`) · **3D:** "toon root-wall panel 6 × 8 m".

> **`rootdeep_geode`** · a split rock egg lined with crystals · 1 / 2.5 / 5 m (one mesh scaled) · shell `#5a4a5e`,
> crystals `#b8a0ff` and `#7be0c8` · geode crystal (toon with a fresnel rim) · 300 / 2 k · crystals twinkle (a uv
> sparkle) · **Fallback:** a half icosphere with inward cones · **Image:** PREAMBLE + "cute split geodes with lilac
> and teal crystals in a dark cave, three sizes" · **3D:** "toon split geode, lilac and teal crystals".

> **`rootdeep_sun_geode`** · a huge upright geode broken open like a door, its inside glowing gold as if a little sun
> were asleep in it · **14 m** · shell `#4a3c48`, crystals `#ffcf7a` / `#fff1b8` · geode crystal · 1,100 / 8 k ·
> inner glow pulses slowly (8 s) · **Fallback:** a scaled `rootdeep_geode` with a gold emissive inner material ·
> **Image:** PREAMBLE + "a giant geode standing upright in a cave, split open, golden crystals glowing like a sleeping
> sun inside, a little explorer for scale" · **3D:** "toon giant upright split geode 14 m, emissive gold crystals".

> **`rootdeep_burrow_lamp`** (the Great Burrow Lamp) · a root arch with a cottage-sized lantern hanging from it: a
> round brass cage with a spiral on top, warm glass panes · arch **11 m**, lamp 3 m · brass `#b8894a`, glass
> `#ffcf7a`, root `#8a5a3c` · lamp glass + glow bark · 700 / 5 k · the lamp sways 2° over 7 s · **Fallback:** a half
> torus and a cylinder lantern with emissive panes · **Image:** PREAMBLE + "an enormous friendly brass lantern hanging
> from a tree-root arch over a cosy underground mole village" · **3D:** "toon brass lantern 3 m hanging from a root
> arch 11 m, spiral finial".

> **`rootdeep_burrow_door`** · a round wooden door set in an earth wall, a little step, a tiny window with a lit
> curtain, a boot scraper · door 1.4 m, façade 3 × 2.2 m · door `#c2563f` / `#3fa79a` / `#e7c45a` (three tints),
> frame `#8a5a3c`, window `#ffcf7a` · toon wood + lamp glass · 160 / 1 k · static · **Fallback:** a disc door on a box
> frame with an emissive square · **Image:** PREAMBLE + "three round mole-burrow doors in earth walls, painted red,
> teal and yellow, tiny lit windows, cosy" · **3D:** "toon round burrow door façade 3 × 2.2 m".

> **`rootdeep_stall`** · a mole market stall: a mushroom-cap awning on two root posts, a counter with jars ·
> 2.6 × 1.6 × 2.4 m · awning `#c2563f` with cream spots, counter `#8a5a3c`, jars `#7be0c8` · toon wood · 240 / 1.5 k ·
> static · **Fallback:** box counter with a hemisphere awning · **Image:** PREAMBLE + "an underground market stall with
> a red spotted mushroom-cap awning, glowing jars, mole-sized" · **3D:** "toon market stall 2.6 m, mushroom awning".

> **`rootdeep_lamp_post`** · a short crooked post with a little brass lamp, a spiral on the cap · 1.8 m · post
> `#6b4a32`, lamp `#b8894a`, glass `#ffcf7a` (lit) / `#4a3c48` (dim) · lamp glass · 90 / 600 · two states (dim,
> lit) · **Fallback:** a cylinder and a small emissive box · **Image:** PREAMBLE + "a small crooked lamp post with a
> brass lantern, lit and unlit versions" · **3D:** "toon crooked lamp post 1.8 m".

> **`rootdeep_stalactite`** · a soft rounded drip-stone, a bead of glowing water at its tip · 1-4 m · `#5a4a5e`,
> tip `#7be0c8` · wet rock · 60 / 400 · the tip bead drips every 3-6 s (a tiny particle) · **Fallback:** a cone ·
> **Image:** n/a (texture shared with the rock layer) · **3D:** "toon stalactite 3 m, glowing drip tip".

> **`rootdeep_root_log`** · a smooth root lying in the water, used for causeway edging and the Drip Gate stepping
> roots · 1.2 × 4 m (scaled) · `#8a5a3c`, moss `#7be0c8` · glow bark · 80 / 500 · static · **Fallback:** a capsule.

> **`rootdeep_glowmoss`** · a decal carpet of glowing moss for floors and walls · 4 × 4 m quad · `#7be0c8` on
> transparent · moss decal · 2 / - · glow breathes ±15 % over 9 s · **Image:** PREAMBLE + "top-down sprite of a patch
> of soft glowing teal moss, transparent background, 512 px, four variants on one sheet" (sliced with
> `slice_sheet.py`) · **Fallback:** a canvas-drawn radial teal blob.

> **`rootdeep_vein`** · a narrow strip of light running along the floor like a vein in a leaf · 1 m wide strips,
> 6 m long, chained · `#ffcf7a` pulsing / `#fff1b8` steady · vein strip (additive) · 2 per strip · pulse travels away
> from the Taproot at 8 m/s · **Fallback:** an emissive plane strip (no texture needed).

<a id="rootdeep-coverage"></a>
### Coverage proof

The grid is 15 × 15 cells of 40 m (the last row and column are 16 m and ignored). Expected land cells (≥ 200 m²
walkable): **118-132**. Cells most at risk: the Glowcap sector's outer band (r 200-250), covered by the Pinewhistle
spur nook, glade C and curios 4 and 10; the spurs, covered by their gate rooms; Drip Bay's south end, covered by the
dig Hollow and curio 16. The test records the exact count in `tests/fixtures/realm-prints/rootdeep.json`.

<a id="rootdeep-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-175 | Card, Shape and recipe, Regions; prints |
| S-176 | Taproot, knots (inert), glowcaps, Grandmother Cap, Sun Geode, Burrow Lamp, root arches and walls, geodes, stalactites, root logs, moss, veins (off); the ART BRIEFs above |
| S-177 | terrain layers, roof card, loading card, map art (`ui_chart_under` too), track `rootdeep` |
| S-178 | spots `rootdeep.gran`, `market-*`, `lamp`; burrow doors, stalls, lamp posts; `int_gran_burrows` door (interior may be S-193) |
| S-179 | enemies and the five mimic anchors |
| S-180 | chests c01-c08, c10-c12, keepsakes, acorns, vistas, Lamp Logs, Hollow doors, benches, curios; the coverage test |
| S-181 | c09 and its soft-earth mound (`placeBuried`) |
| S-182 | the eight gate rooms' knots and `gate-*` spawns |
| S-183-S-185 | `heart_door`; the `lumbraCalm` glow state; Lumbra's spots |
| S-186 | the three Hollow interiors; the Rootdeep Dash route |
| S-190-S-191 | knot states, `w:taproot.*` anchors, Digby's walk, `stoneSites` veins; unhide |
| S-192 | ss-31 lamps, ss-32 itch spots (`placeSideMarks`) |
| S-207, S-233 | fish spots; thornglass |

---
<a id="glassway"></a>
## The Glassway

The sea beyond the reef, made into a land: glass-clear shallows over pale sand, nine islets, sandbars that only
exist at low tide, three wrecks, a post office on stilts, a whale who is an island, and the spire of the Lamplighters'
sunken sea chapel. Pip steers the *Dandelion* freely here (owner decision 4; chart-stop fallback below). The Glassway
is chapter 14 and the site of the first Stair Stone that most players find (the Sunken Bell), and it is the harbour
for Kettle Isle and Saltglass Flats.

<a id="glassway-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `glassway` · overworld, sea |
| Grid · seed · land | 640 m · 40253 · 0.10 km² of land (islets ≈ 0.087 at high tide; sandbars and wider beaches add ≈ 0.013 at low tide); ≈ 0.30 km² sailable |
| Recipe | `js/realms/recipes/shoals.js` (`shoals`) |
| Palette | shallows `#bfeee6`, sandbar `#f5e6c4`, deep `#2f7d8c`; buoy coral `#ff8f7a`, foam `#f4fbfb`; fog `#cfeef5` near 120 m, far 300 m |
| Light | outdoor day/night as home |
| Unlock · connection | `ch14`; "Beyond the Reef" on the chart from Nell's Jetty; `hidden: true` until S-203 |
| Hours | ch14 + the Sunken Bell 3.5 h main; Glassway stories, the Merry Mabel and Moonmere's approach ≈ 4 h; fishing on top |
| Built by | S-198-S-199 boat, S-200 recipe, S-201 props, S-202 art, S-203 ch14 (unhide), S-204 enemies, S-205 finds, S-207 fish, S-208 star door, S-209-S-212 the Sunken Bell, S-214-S-217 stories, S-220 Hollows and Dash |

<a id="glassway-shape"></a>
### Shape and recipe

| Piece | Numbers |
|---|---|
| Sea floor | deep water y −6 everywhere by default; a **shelf** at y −2.4 within 25 m of every islet shore and over **the Glass**, a disc r 60 around (0, 0); reef heads (round rocks, tops y −0.2 to 1.0) scattered by Poisson discs (min spacing 18 m) on shelves only, never in a lane |
| Islets | the nine below, at fixed centres (authored, not random). Shape: a radial-noise blob (radius ±18 %, 9 lobes), a beach ring 10 m wide sloping from y 0.4 to −1.6, then the top rising to the given height (noise amp 1.2 m, wavelength 30 m). Poisson discs place only reef heads, drift logs and kelp |
| **Tide** | two sea levels: **high** y 0.0, **low** y −1.4. The realm flag `glassway.tide` is `0` (high, default) or `1` (low). `W.walk` is precomputed for both states (`walkHigh`, `walkLow`); colliders do not change; the water plane animates between levels over 4 s |
| Sandbars | crests at y −0.9: under 0.9 m of water at high tide (the boat crosses; Pip cannot walk), 0.5 m above water at low tide (Pip walks; the boat runs aground). Four bars, each a spline 12-14 m wide (below) |
| Boat rule | the *Dandelion* needs 0.7 m of water. At low tide the shelf has 1.0 m (sailable), sandbars and beaches do not |
| Docking spots | one wooden pier per islet, its end in water at least 1.0 m deep at low tide; the boat moors there; prompts per [systems.md#boat](./systems.md#boat) |
| Water plane | 1,240 m square (`max(1000, 640 + 600)`); shallows tint by depth: `#bfeee6` at 0-1 m, `#7fd3d0` at 2.4 m, `#2f7d8c` at 6 m; sand visible through it |
| Prints | `tests/fixtures/realm-prints/glassway.json` stores both tide states' walk counts and reachability |

**Islets** (centre, size, top height, region, contents in short):

| # | Islet · id | Centre | Size | Top y | Region | Holds |
|---|---|---|---|---|---|---|
| 1 | **Post Rock** · `post` | (0, −190) | r 80 | 6 | Puffin Post | the stilt post office over a south bight, the Pillar Post, Kinako's mooring, the north pier |
| 2 | **Tern Tuft** · `tern` | (−175, −110) | r 62 | 9 | The Sandbars | a grassy dune top, tern nests, a Lamplighter cairn |
| 3 | **Whelk's Spit** · `spit` | capsule (−250, −20) → (−215, 120) | 40 m wide | 4 | The Sandbars | Mr Whelk's shell shop, the Shell Stack |
| 4 | **Kelp Knoll** · `kelp` | (−120, 150) | r 50 | 5 | The Sandbars | kelp beds, the tide Hollow |
| 5 | **Gull Rock** · `gull` | (170, −150) | r 40 (a 15 m-wide stack rising from a skirt) | 22 | Wreck Reach | a spiral ledge path to the top, gull colony, the *Wobbly Gull* stuck at y 8 |
| 6 | **Mabel Rock** · `mabel` | (225, 20) | r 66 | 7 | Wreck Reach | the *Merry Mabel* on her side, the *Biscuit Tin* in the shallows west of it |
| 7 | **Spiral Skerry** · `skerry` | (120, 150) | r 40 | 6 | Wreck Reach | a Lamplighter ruin ring, the bell Hollow, the root-gate |
| 8 | **Bell Islet** · `bell` | (0, 200) | r 58 | 5 | Bell Shallows | the chapel steps, the walkway to the spire |
| 9 | **Hummock** (the Snoozing Whale) · `whale` | (−125, 255), long axis 70° | 60 × 26 m | 5.5 | Bell Shallows | a sleeping whale whose back is an islet: a prop with a deck top, not terrain; two states (below) |

**Sandbars** (walkable at low tide only): B1 Post Rock ↔ Tern Tuft (−70, −175) → (−120, −140), 12 m; B2 Tern Tuft ↔
Whelk's Spit (−200, −60) → (−235, −30), 14 m; B3 Whelk's Spit ↔ Kelp Knoll (−210, 120) → (−165, 140), 12 m; B4 Kelp
Knoll ↔ Hummock (−120, 200) → (−125, 235), 12 m.

**The Sunken Bell's spire** stands in the water at (0, 285): an 18 m stone spire above low water (top y 16.6),
a spiral carved round it, a belfry window, a door at its foot whose sill is at y −0.5. A stone walkway 4 m wide
(top y −0.6, so exposed only at low tide) runs from Bell Islet's south shore (0, 258) to the door.

**Wrecks**: the *Merry Mabel* (a three-masted cargo ship, 34 m, on her starboard side on Mabel Rock's south shore,
masts reaching north-west over the islet, the main mast tip 20 m up); the *Biscuit Tin* (a tin-roofed barge, 16 m,
sunk upright in the shallows at (160, 60), deck at y −1.0: dry at low tide); the *Wobbly Gull* (a little sloop, 9 m,
wedged on Gull Rock's east ledge at y 8).

<a id="glassway-tide"></a>
### The tide

- Pip flips the tide by ringing the **Tide Bell** (tool, no pill) within 4 m of a **tide stone**. The whole realm
  changes over 4 s; toasts "✿ The tide goes out" / "✿ The tide comes in". The state is saved in `S.flags`
  (`glassway.tide`) and kept across visits.
- **Tide stones** (6): Post Rock (−30, −250), Tern Tuft (−150, −60), Whelk's Spit (−225, 90), Kelp Knoll (−80, 128),
  Mabel Rock (170, 20), Bell Islet (30, 240). Every docking spot is within 30 m of one, except Gull Rock, Spiral
  Skerry and Hummock, whose piers are deep at both tides.
- **No soft-lock:** every pier end has ≥ 1.0 m of water at low tide; the boat can reach every pier from the home buoy
  at either tide (the progression solver checks both states); the Starsong's *Calling* brings the *Dandelion* to the
  nearest pier; and Pip standing on a sandbar when the tide comes in is lifted to the nearest dry ground with a fade
  ("✿ Nell fished Pip out. 'Mind the tide!'").
- Tide-gated content is never on the critical path before the Tide Bell is owned (it is an Act II tool).

<a id="glassway-regions"></a>
### Regions

Each land cell belongs to its islet's region; open water belongs to the region of the nearest islet.

| id | Card | Islets | Landmark (anchor, height) | Entry (landmark visible from) | `REGIONS` row |
|---|---|---|---|---|---|
| `puffinpost` | **Puffin Post** / "Stamps required" | Post Rock | **the Pillar Post** (0, −178), 12 m stilt lookout painted like a post box | the home buoy (0, −300); the north pier | music `glassway`, layer `post`; ambient `sea`; enemies []; max 0 |
| `sandbars` | **The Sandbars** / "Walkable at low tide" | Tern Tuft, Whelk's Spit, Kelp Knoll, B1-B4 | **the Shell Stack** (−232, 30), 12 m | Tern Tuft pier; B1's west end | layer `bars`; ambient `sea` |
| `wreckreach` | **Wreck Reach** / "Three wrecks, no waiting" | Gull Rock, Mabel Rock, Spiral Skerry | **the Merry Mabel** (235, 45), masts 20 m | the Wreck Lane at (235, −215); Mabel Rock pier | layer `wrecks`; ambient `rigging` |
| `bellshallows` | **Bell Shallows** / "Listen" | Bell Islet, Hummock, the spire | **the Sunken Bell's spire** (0, 285), 18 m above low water | the Bell Lane at (0, 120); Bell Islet pier | layer `bell`; ambient `sea` |

<a id="glassway-arrival"></a>
### Arrival, benches, buoys and the root-gate

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn from the chart | `north` | (0, −292) aboard the *Dandelion*, facing 180° | the Pillar Post and the Glass straight ahead |
| Spawn (fallback, and when leaving an interior) | `post` | Post Rock north pier (0, −268) | chart-stop fallback arrival |
| Spawns from the far isles | `buoy-kettle`, `buoy-saltglass` | beside each buoy, aboard | |
| Piers (docking spots) | `glassway:pier-<islet>` | Post Rock (0, −268) N · Tern Tuft (−175, −170) N · Whelk's Spit (−270, 40) W · Kelp Knoll (−75, 140) E · Gull Rock (210, −150) E · Mabel Rock (200, −45) N · Spiral Skerry (85, 130) W · Bell Islet (0, 140) N · Hummock (−150, 270) at his tail | chart-stop fallback: these nine are the stops |
| Buoys | `glassway:buoy-*` | [#buoys](#buoys) | |
| Benches | `glassway:bench-post` (−10, −200) · `-tern` (−165, −100) · `-spit` (−220, 40) · `-mabel` (205, 0) · `-bell` (10, 180) | | five, one per region plus the Spit |
| Root-gate | `glassway:gate` | Spiral Skerry (110, 140), a root rising through the ruin ring | opened with the Paws from this side; links to the Rootdeep's Drip Bay end |

**Chart-stop fallback** (`REALMS.glassway.sail = 'chart'`, built into S-199): no boat locomotion; `[E] Sail · the
Dandelion` at any pier opens a Glassway sub-chart of the nine piers and three buoys; a 2 s card per hop. Content that
needs the boat itself (the Gullgrab "while sailing" table, fishing from the boat) is skipped; nothing on the critical
path needs it. About 3 h of play is lost (CANON §5.4).

<a id="glassway-anchors"></a>
### Named anchors

`w:pillarPost` (0, −178) · `w:postCounter` (5, −182) · `w:shellStack` (−232, 30) · `w:mabel` (235, 45) ·
`w:spire` (0, 285), `w:spire.top` y 16.6 · `w:bellDoor` (0, 278) · `w:hummock` (−125, 255) · `w:glass` (0, 0) ·
`w:buoyKettle`, `w:buoySaltglass`, `w:buoyHome` (as [#buoys](#buoys)).

<a id="glassway-pois"></a>
### Points of interest

Target: 100,000 / 1,250 = **80**. Budget: chests 12 · keepsakes 4 · acorns 8 · vistas 3 · bottles 4 · Lamp Logs 3 ·
Hollow doors 2 · dungeon doors 2 · benches 5 · root-gate 1 · piers 9 · buoys 3 · tide stones 6 · fish spots 4 · NPC
spots 7 · Dash start 1 · thornglass 3 · gate finds 4 (Mabel mast hookbloom, Gull Rock glide ledge, Skerry star door,
Bell Islet soft earth) · side-story marks 2 (Hummock's roll spot, the post office's sorting rack) · landmarks 4 ·
curios 12 · **total 99**.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `c06` holds the Sea-glass Wind Chime (`nook:wind-chime`), `c11` the Starlight Blue hood trim (`trim_starlight`), `c08` the "Spiral Skerry" sticker (`sticker_glassway`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (`glassway:c01` … `c12`, 30 gems each):

| id | Anchor | Gate | Note |
|---|---|---|---|
| c01 | (6, −160) | low tide | under the post office stilts, on the bight's sand |
| c02 | (−180, −125) | - | Tern Tuft dune top, among the nests (the terns sit on it; they move politely) |
| c03 | (−212, 122) | - | Whelk's Spit tip, behind driftwood |
| c04 | (−90, 165) | low tide | Kelp Knoll, a tide pool in the kelp bed |
| c05 | (−215, −48) | low tide | a half-buried crate in the middle of sandbar B2 |
| c06 | (185, −135), y 8 | - | the *Wobbly Gull*'s cabin on Gull Rock's ledge |
| c07 | (160, 60) | low tide | the *Biscuit Tin*'s deck |
| c08 | (120, 150) | Starsong (*Dusk* at night opens the star door in the ruin ring) | Spiral Skerry |
| c09 | (20, 190) | Digging Paws | buried by the chapel steps |
| c10 | (−125, 240) | ss-37 (Hummock rolled) | the Barnacle Garden on his flank |
| c11 | (240, 40), y 17 | Thistle Hook | the *Merry Mabel*'s crow's nest (a hookbloom grows from the mast top) |
| c12 | (155, −172), y 12 | Leaf Glider | a ledge across a 10 m gap from Gull Rock's spiral path |

**Sleeping Acorns** (`glassway:acorn-1` … `8`): (−20, −215) Post Rock garden · (−160, −95) Tern Tuft · (−225, 70)
Whelk's Spit · (−130, 130) Kelp Knoll · (175, −160) Gull Rock ledge · (205, −15) Mabel Rock · (110, 160) Spiral Skerry
· (−20, 210) Bell Islet.

**Bottles** (`glassway:bottle-1` … `4`; which century's letter each holds is set in
[lore.md#bottles](./lore.md#bottles); bob and glint at the tideline): Tern Tuft north beach (−175, −172) · Whelk's
Spit tip (−205, 128) · Gull Rock's south-east foot (200, −182) · against Hummock's flank (−95, 255). The Last Big Storm
two summers ago left them here; Postmistress Pell delivers their letters in ss-34.

**Lamp Logs** (`glassway:log-1` … `3`): the Lamplighter cairn on Tern Tuft (−170, −110) · inside the ruin ring on
Spiral Skerry (130, 140) · the top chapel step on Bell Islet (0, 175).

**Vista posts**: `glassway:vista-wideblue` "All of the Wide Blue" on Gull Rock's top (170, −150), y 22: home's Great
Tree to the north, the Kettle's plume to the east, the Academy tower's tip to the south-west · `glassway:vista-tide`
"The Sandbars at Low Tide" on Tern Tuft's dune top (−175, −120) · `glassway:vista-bell` "The Bell in the Water" on
Bell Islet's south shore (0, 255).

**Doors**: `bell_door` (0, 278), the spire's foot, low tide → d7 the Sunken Bell ([dungeons.md#d7](./dungeons.md#d7))
· `mabel_breach` (215, 55), a hull breach above the waterline at low tide → o3 the Merry Mabel
([dungeons.md#o3](./dungeons.md#o3)) · `hollow_glassway_tide` (−140, 178), Kelp Knoll's south cave mouth, low tide ·
`hollow_glassway_bell` (130, 165), Spiral Skerry's ruin ring.

**Fish spots** (S-207): Post Rock north pier (0, −270) "harbour" · Bell Islet north pier (0, 138) "the Glass" · Kelp
Knoll's kelp edge (−90, 150) "kelp" · the *Merry Mabel*'s shadow (200, 80) "wreck".

**Glassway Dash** (S-220, low tide only): start at the Post Rock bench (−10, −200) → B1 → Tern Tuft (−165, −100) → B2
→ finish at the Shell Stack (−232, 30). About 360 m.

**Thornglass** (S-233): Tern Tuft (−200, −140) · Mabel Rock (250, −20) · Bell Islet (−35, 200).

<a id="glassway-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `glassway:k-stamp` | the Pillar Post, south stilt platform (0, −172) | "Something stamped" · Very old stamp |
| `glassway:k-ribbon` | the Shell Stack, west side (−240, 36) | "Something on a ribbon" · Drilled shell on a ribbon |
| `glassway:k-plate` | the *Merry Mabel*, the hull's far side (240, 30) | "Something brass" · Ship's builder's plate |
| `glassway:k-tassel` | the spire, back ledge at low tide (0, 292) | "Something ringing" · Bell-rope tassel |

- **Very old stamp.** "A postage stamp stuck to the back of the Pillar Post, faded almost white. It shows a tower
  with one lit window." / "The price printed on it is 'one candle'. Postmistress Pell says they stopped printing
  those before her grandmother hatched."
- **Drilled shell on a ribbon.** "A little shell with a hole drilled through it, on a faded ribbon, hanging behind
  the Shell Stack." / "Painted inside in a child's hand: 'Fastest on the beach: Pelagia. Second fastest: Shellby.
  (Rematch tomorrow.)'"
- **Ship's builder's plate.** "A brass plate on the far side of the *Merry Mabel*'s hull: 'Built at Forgefall.
  Launched with a song.'" / "Someone has scratched underneath, more recently: 'Sank with a snore. Still snoring.'"
- **Bell-rope tassel.** "A tassel of bell-rope caught on the spire's back ledge, salt-stiff, braided gold and
  sea-blue." / "Lamplighter rope. The chapel bell rang every night once, so boats on the Glassway knew which way was
  home."

**Fifth line**: "✿ The Glassway's keepsakes: a stamp, a race, a ship and a bell. The sea keeps everything people send
across it, and gives most of it back."

<a id="glassway-curios"></a>
### Curios

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · Rule board | (−15, −178) | "PUFFIN POST RULES. 1. Stamps required. 2. No eating the post. 3. Wet letters will be dried, eventually." |
| 2 | Look · Tern nest | (−190, −110) | "A tern glares at you from her nest. It is a very small glare, but she means every bit of it." |
| 3 | Look · Glass-clear water | (0, −40) | "The water here is so clear you can count the ripples on the sand below. Forty-two. Forty-three. Lost count." |
| 4 | Look · Shell price list | (−226, 46) | "Whelk's Shells. Common: free. Uncommon: a smile. Rare: 'We'll talk.' Very rare: 'Not for sale. Rare. Very rare.'" |
| 5 | Look · Gull graffiti | (165, −140) | "The gulls have arranged pebbles to spell 'MINE'. The ones who spelled it are arguing about whose idea it was." |
| 6 | Look · Ship's figurehead | (250, 50) | "The *Merry Mabel*'s figurehead: a smiling walrus in a bonnet. Someone has tucked a flower behind his ear." |
| 7 | Look · Biscuit tins | (158, 58) | "A stack of tins on the barge, all empty, all labelled 'BISCUITS'. A crab inside one says nothing, suspiciously." |
| 8 | Look · Whale breath | (−110, 248) | "A warm, fishy puff rises from Hummock's blowhole every twelve seconds. Regular as a clock. A smelly clock." |
| 9 | Look · Ruin ring | (115, 145) | "Seven standing stones in a ring, each carved with a spiral. The eighth lies flat, as if it got tired." |
| 10 | Look · Kelp forest | (−100, 170) | "At low tide the kelp lies flat like brown ribbons. At high tide it stands up and waves at the boats." |
| 11 | Look · Chapel steps | (0, 168) | "Worn stone steps lead down into the water and keep going. Someone built a chapel here, then the sea had it." |
| 12 | Look · Message rope | (−8, −262) | "Bottles hang from a rope under the pier, labelled 'UNCLAIMED'. Pell checks them every morning, just in case." |

<a id="glassway-enemies"></a>
### Enemies

| Region | Rolled | Placed | max |
|---|---|---|---|
| Puffin Post | none (town) | - | 0 |
| The Sandbars (low tide only) | `gullgrab 3, crab 2` | - | 5 |
| Wreck Reach | `bubble_puffer 3, gullgrab 2` | - | 5 |
| Bell Shallows | `bubble_puffer 3, gullgrab 2` | - | 5 |
| while sailing | `gullgrab 1` (snatches only; a bonk from the boat is a swing) | - | 2 |

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables). Spawns on land only (Bubble Puffers hover over
shelf water within 10 m of a shore); never on Hummock, never within 12 m of Post Rock's shore.

<a id="glassway-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `glassway.pell` | (5, −182) | Postmistress Pell at the post office counter, 07:00-19:00; at the sorting rack indoors otherwise |
| `glassway.clerk-1`, `clerk-2` | (−8, −186), (14, −190) | two puffin clerks (cast.md names them) |
| `glassway.whelk` | (−225, 40) | Mr Whelk at his shop door, all day; indoors at night |
| `glassway.kinako` | (34, −196) | Kinako's Floating Bazaar moored at Post Rock's east dock on the days [cast.md#kinako](./cast.md#kinako) gives |
| `glassway.pelagia` | (0, 245) | Pelagia on Bell Islet's south shore after her duel (and for the Bell Duel) |
| `glassway.nell` | aboard the *Dandelion* | Nell at the tiller whenever Pip is on the water; on the moored pier otherwise |
| `glassway.hummock` | (−125, 255) | Hummock's talk point at his head, `[E] Talk · Hummock` ("(from below)") |

<a id="glassway-interiors"></a>
### Interiors

| id | Door | Size · rooms | Holds |
|---|---|---|---|
| `int_puffin_post` | (0, −186), the post office door | 48 m · 2 rooms (counter hall, sorting room with pigeonholes to the ceiling) | ss-34 Return to Sender; the bottles' letters board |
| `int_whelk_shop` | (−228, 44) | 48 m · 1 room (shelves of shells, a velvet cushion for the rarest) | ss-35 The Collector |

<a id="glassway-states"></a>
### World states

| Condition | Change |
|---|---|
| `glassway.tide` | the sea level, sandbars, low-tide doors and chests (above) |
| `ch14` | Puffin Post's flag goes up; Pell's first line; bottles appear on the tidelines |
| `stone:bell` | the spire's bell rings once each dusk at 19:00 (a bright "ting" heard across the Glassway), a lamp burns in the belfry window at night, and Pelagia stays on Bell Islet's south shore |
| ss-36 done | the *Merry Mabel*'s bell is gone from her mast (it hangs at Pinch's lighthouse at home) |
| ss-37 done | Hummock rolled onto his side: his flank is a gentle slope, the Barnacle Garden shows, his blowhole puffs a little rainbow once a minute |
| `mainEnding` | the lane buoys' lamps burn gold at night |

<a id="glassway-music"></a>
### Music and ambience

Track `glassway` ([art-audio.md#glassway](./art-audio.md#glassway)): glockenspiel lead in G, 96 bpm, plucked bass,
brushed snare. Layers: `post` adds a squeezebox pad (Puffin Post), `bars` thins to glockenspiel and wind,
`wrecks` adds a low marimba and slow creaks, `bell` replaces the snare with three soft bell tones (the duel's three
pitches, so the player learns them), `sail` adds a shaker rhythm while the boat moves faster than 3 m/s. Ambience:
`sea` (shipped), `gulls`, `rigging`, `whale` (a 12 s breath cycle near Hummock).

<a id="glassway-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (20 of 24): `glassway_buoy_harbour`, `glassway_buoy_lane`, `glassway_pier`, `glassway_tide_stone`,
`glassway_kelp`, `glassway_reef_head`, `glassway_tern_nest`, `glassway_driftwood`, `glassway_shell_big`, plus shared:
bench, root-gate knot, Hollow door, vista post, lectern, soft-earth mound, hookbloom, star door, thornglass, bottle
(from S-075), and the bazaar boat if [atlas-isles.md#shared](./atlas-isles.md#shared) defines it there. Single meshes:
the post office with the Pillar Post, the Shell Stack, the *Merry Mabel*, the *Biscuit Tin*, the *Wobbly Gull*, the
spire, Hummock. New materials (5 of 12): wet sand, clear water edge foam, barnacle, tin, bell bronze.

> **`glassway_post_office`** · a two-storey timber post office on tall stilts over a sandy bight, a ramp up from the
> beach, a round window, pigeonhole shutters, and **the Pillar Post**: a 12 m lookout tower painted like a post box
> with a slot, a flag and a lamp · footprint 14 × 10 m, tower 12 m · coral `#ff8f7a`, cream `#f5e6c4`, timber
> `#8a6a4a`, roof `#2f7d8c` · toon wood + lamp glass · 1,600 / 10 k · flag flutters; lamp on at night · **Fallback:**
> stacked boxes on cylinder stilts and a coral cylinder tower · **Image:** PREAMBLE + "a cosy timber post office on
> stilts over clear shallow sea, a tall coral-and-cream lookout tower shaped like a post box with a slot and a flag,
> puffins on the railings" · **3D:** "toon stilt post office 14 × 10 m with 12 m post-box lookout tower".

> **`glassway_shell_stack`** · a leaning tower of giant shells stacked by Mr Whelk: a conch at the base, scallops,
> a spiral whelk on top · **12 m** · cream `#f5e6c4`, pink `#ff9f8f`, sand `#e2c9a0`, pearl `#f1e6dc` · toon +
> pearl rim · 900 / 6 k · static · **Fallback:** five scaled spheres and cones in a leaning stack · **Image:**
> PREAMBLE + "a whimsical leaning tower of giant seashells on a sandy spit, a tiny hermit crab's shop at its foot" ·
> **3D:** "toon tower of stacked giant shells 12 m, slight lean".

> **`glassway_merry_mabel`** · a plump three-masted cargo ship lying on her side on rocks, sails furled and torn,
> barnacles below the waterline, a walrus figurehead in a bonnet, a hull breach on the south side · **34 m** long,
> masts to 20 m · hull `#8a5a3c`, stripe `#ff8f7a`, sails `#f3e3c3`, barnacle `#c9c2b0` · toon wood + barnacle · 2,400
> / 15 k · rigging sways in wind · **Fallback:** a long rounded box hull tilted 70° with three cylinder masts ·
> **Image:** PREAMBLE + "a friendly old cargo ship lying on its side on a rocky islet in clear shallow water, walrus
> figurehead with a bonnet, three masts, gulls" · **3D:** "toon three-masted ship 34 m lying on its side, hull breach,
> walrus figurehead".

> **`glassway_biscuit_tin`** · a squat barge with a corrugated tin cabin, sunk upright, deck awash · 16 × 6 m ·
> tin `#c9c2b0`, hull `#3b3540`, rust `#c2563f` · tin + toon wood · 500 / 3 k · **Fallback:** box hull and a half
> cylinder cabin · **Image:** PREAMBLE + "a sunken tin-roofed barge in clear shallow water at low tide, biscuit tins on
> deck" · **3D:** "toon sunken barge 16 m with tin cabin".

> **`glassway_wobbly_gull`** · a little sloop wedged on a rock ledge, one mast, a patched sail, a round cabin
> door · 9 m · hull `#3fa79a`, sail `#f3e3c3`, trim `#f2b45a` · toon wood · 400 / 2.5 k · **Fallback:** a boat hull
> box and one mast · **Image:** PREAMBLE + "a small teal sloop stuck on a high rock ledge, patched sail, seagulls on
> the boom" · **3D:** "toon sloop 9 m wedged on a ledge".

> **`glassway_spire`** · a slim stone spire rising from the sea, a spiral carved round it, an arched belfry window
> near the top with a bronze bell inside, a door at its foot, seaweed and barnacles up to the high-water line ·
> **18 m** above low water · stone `#d8cfc0`, spiral `#ffcf7a` (glows after `stone:bell`), bell `#b8894a`, weed
> `#4f6b4a` · toon stone + bell bronze · 900 / 6 k · bell swings on the dusk ring · **Fallback:** a tapered octagonal
> prism with a box belfry · **Image:** PREAMBLE + "a slender stone chapel spire rising out of clear turquoise sea,
> spiral carving, a bronze bell in the belfry window, seaweed at its foot, peaceful" · **3D:** "toon stone spire 18 m
> with belfry and bell, spiral carving, door at sea level".

> **`glassway_hummock`** · a huge, peaceful sleeping whale whose back is a grassy islet: a tuft of sea-grass, two
> barnacle patches, a blowhole, a little smile; rolled state shows a pale ribbed belly and one flipper up · **60 ×
> 26 m**, back 5.5 m above water · skin `#5d7d8c`, belly `#e9e1d0`, grass `#9bb87a`, barnacles `#c9c2b0` · toon +
> barnacle · 2,000 / 12 k · breathing rise ±0.15 m over 12 s, blowhole puff · **Fallback:** a squashed ellipsoid with
> a box deck and an emissive-free face decal · **Image:** PREAMBLE + "a giant sleeping whale floating in clear shallow
> sea with a grassy little island on its back, smiling in its sleep; second pose rolled onto its side showing a
> barnacle garden" · **3D:** "toon sleeping whale 60 m with grassy back, two poses: upright and rolled on its side".

> **`glassway_buoy_harbour`** · a striped harbour buoy with a lit lamp cage and a spiral on the cage · 3.2 m ·
> `#ff8f7a` / `#f4fbfb`, lamp `#ffcf7a` · toon + lamp glass · 220 / 1 k · bobs ±0.2 m over 3 s · **Fallback:**
> cone + cylinder with an emissive box.

> **`glassway_buoy_lane`** · a small white buoy with one coral band · 1.4 m · `#f4fbfb`, `#ff8f7a` · toon · 80 / 400 ·
> bobs; `nightGlow` tip · **Fallback:** a capsule.

> **`glassway_pier`** · a short wooden pier on posts with a rope rail and a mooring post · 4 × 14 m · `#8a6a4a`,
> rope `#e2c9a0` · toon wood · 200 / 1.2 k · static · **Fallback:** a box deck on cylinders.

> **`glassway_tide_stone`** · a round standing stone with a wave carved in a spiral, a bronze ring set in it that
> rings when the Tide Bell sounds · 1.6 m · stone `#d8cfc0`, ring `#b8894a`, carving `#7fd3d0` (glows while ringing)
> · toon stone + bell bronze · 160 / 800 · ring glow 1 s pulse on use · **Fallback:** a cylinder with a torus ring ·
> **Image:** PREAMBLE + "a round standing stone carved with a spiral wave and a bronze ring, on a sandy beach".

> **`glassway_kelp`** · a clump of kelp ribbons; two poses (lying flat at low tide, standing at high tide) · 1-3 m
> · `#4f6b4a`, `#7fae4b` · toon, double-sided · 60 / 300 · sways · **Fallback:** three crossed quads.

> **`glassway_reef_head`**, **`glassway_tern_nest`**, **`glassway_driftwood`**, **`glassway_shell_big`** · round
> coral-pink rock heads (1-4 m, `#e2c9a0` / `#ff9f8f`, 80 tris), a grass-ringed nest with three speckled eggs
> (0.6 m, 60 tris), a bleached log (3 m, `#d8cfc0`, 60 tris), a giant scallop half-buried in sand (1.5 m, 120 tris).
> **Fallback:** spheres, a torus, a capsule, a half disc. **Image:** one sheet, PREAMBLE + "beach props sheet: coral
> rock heads, a tern nest with speckled eggs, bleached driftwood, a giant scallop shell, isolated on plain background".

<a id="glassway-coverage"></a>
### Coverage proof

16 × 16 cells of 40 m. Land cells (union of both tides, ≥ 200 m²): **expected 64-80** (islets cover 1-6 cells each;
sandbars add thin cells). Cells most at risk: sandbar middles (covered by c05, the Dash route and path cells) and
Whelk's Spit's long middle (the shop, the Stack, curio 4, a bench). The test runs once per tide state for (a) and
(b), and on the union for (c). Open-water cells are not tested, but the progression solver proves every pier and
buoy reachable by boat at both tides.

<a id="glassway-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-198-S-199 | boat; piers as docking spots; the fallback sub-chart |
| S-200 | Shape and recipe, tide states, sandbars, lanes, buoys (Kettle and Saltglass fogged), regions; prints for both tides |
| S-201 | post office and Pillar Post, wrecks (the *Mabel* sealed), Gull Rock path, Hummock (back state), the spire, buoys, piers, tide stones, kelp and the small props |
| S-202 | terrain layers, water tints, loading card, map art, track `glassway` |
| S-203 | spots for Pell, clerks, Whelk, Kinako; interiors' doors; `ch14`; unhide |
| S-204 | enemy tables |
| S-205 | chests (c08-c10 inert until their tools and flags), keepsakes, acorns, vistas, bottles, logs, Hollow doors, benches, curios; coverage |
| S-207 · S-208 | fish spots · the Skerry star door |
| S-209-S-212 | `bell_door`; `stone:bell` state; Pelagia's spot |
| S-214, S-216 | `mabel_breach`; Hummock's rolled state; ss-36 bell removal |
| S-220 | the two Hollows; the Glassway Dash |
| S-233 | thornglass |

---
<a id="kettle"></a>
## Kettle Isle

A warm volcano shaped like a teakettle: a smooth cone with a spout ridge venting steam to the east and a rock arch
on its west flank for a handle. Hot springs fill terraces of bath basins on the south flank, warm black sand rings the
east, and Forgefall's smiths (who forge every sword Miso sells) work by a warm waterfall in the west. A Stair Stone
fell into the spout in the Storm a hundred years ago and keeps the Kettle simmering instead of boiling over; Lady
Fumarole sits in her bath on the lid and will not let anyone touch it until the heat has somewhere else to go.

<a id="kettle-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `kettle` · overworld |
| Grid · seed · land | 512 m · 40261 · 0.12 km² |
| Recipe | `js/realms/recipes/cone.js` (`cone`) |
| Palette | basalt `#3b3540`, ember `#e66f4f`, warm sand `#f4d1a6`, fern `#8fc7a0`; steam `#f4f0ec`; fog `#e9ddd4` near 90 m, far 300 m |
| Light | outdoor day/night as home; a warm rim light from below at night near the springs (glow materials) |
| Unlock · connection | `ch14`; the Glassway's Kettle buoy (first trip), then the chart; `hidden: true` until S-232 |
| Hours | 3.5 h main (people, the Belly, Fumarole); stories and activities ≈ 4.5 h (M27) |
| Built by | S-222 recipe, S-223 props, S-224 art, S-225 people, S-226 enemies, S-227 Sling (home targets), S-228 finds, S-229-S-231 the Belly and Fumarole, S-232 main chain (unhide), S-233 Starsteel, S-234 Hollows and Dash, S-236-S-237 stories |

<a id="kettle-shape"></a>
### Shape and recipe

| Piece | Numbers |
|---|---|
| Island | ellipse centre (0, 0), rx 205, rz 185, coastline noise ±12 % (wavelength 70 m), beach ring 10 m; land ≈ 0.12 km² |
| **The Kettle** | cone centre (20, −10), base r 115, summit y 45, a smooth concave profile; above y 30 the flank is steeper than walkable except on the spout ridge path. The **lid**: a flat disc r 12 at y 45 with a 1 m rim (the boss arena, reached only through the Belly until `stone:kettle`) |
| **The Spout** | a ridge from the cone's east flank at y 32 running east to **the Spout Mouth** at (115, −15), y 28: a round opening 10 m across venting a steam column east over Ash Beach. A path 5 m wide climbs from Ash Beach (y 2) up the north-east flank in four switchbacks to the ridge and along it to the Mouth |
| **The Handle** | a natural rock arch on the west flank from (−85, −45) to (−85, 25), apex y 26, an opening 18 m high and 20 m wide beneath; walkable under; its top reached only by Hook |
| **Bathhouse Terraces** | five flat terraces cut into the south flank across bearings 150°-230°, at y 6, 10, 14, 18, 22, each 10 m deep, joined by stone stairs at bearings 165° and 215°; spring basins (flat pools 0.5 m deep, wadeable) on each terrace |
| **Forgefall** | a west-coast shelf, floor y 4-8, centre (−150, −40). A warm stream (spline (−40, 70) → (−110, −20) → (−120, −55)) falls 8 m over **the Forge Ledge** at (−120, −55) and runs to the sea at (−200, −60) |
| **Ash Beach** | black sand on the east and south-east coast (bearings 40°-150°), tide pools, the **Teacup** stack in the shallows at (185, 115) joined to the beach by a rock causeway (top y 0.4) |
| Lava tubes | old, cool and dark: (1) the Belly mouth on the spout ridge's south side (90, 5), y 24; (2) the sling Hollow's mouth on Ash Beach (130, 140); (3) a shoulder tube from the top terrace (40, 60), y 22, to the switchbacks (75, 0), y 26: a dark shortcut (Lantern) |
| Jetty | west shore (−205, −20), facing 247° |

<a id="kettle-regions"></a>
### Regions

| id | Card | Extent rule | Landmark (anchor, height) | Entry | `REGIONS` row |
|---|---|---|---|---|---|
| `forgefall` | **Forgefall** / "Mind the sparks" | x < −70, and the jetty | **the Hammerwheel** (−125, −65), 14 m water wheel driving trip hammers | the jetty (−195, −20) | music `kettle`, layer `forge`; ambient `forge`; enemies []; max 0 |
| `terraces` | **Bathhouse Terraces** / "Towels provided" | bearings 150°-250° from the cone centre, y < 24, plus the south coast | **Soakley's Bathhouse** (−10, 95), 12 m copper dome | the Forgefall road at (−70, 60); the beach path at (60, 120) | layer `bath`; ambient `steam` |
| `ashbeach` | **Ash Beach** / "Warm sand, warmer feet" | bearings 40°-150°, y < 12, plus the Teacup | **the Teacup** (185, 115), 16 m sea stack shaped like a cup | the beach path at (60, 120); the switchback foot (130, −30) | layer `beach`; ambient `sea` |
| `spout` | **The Spout** / "Still a little steamy" | everything else: the cone above the terraces, the spout ridge, the Handle, the north coast | **the Kettle** (20, −10), 45 m, with its plume | the Handle's underpass (−85, −10); the switchback foot | layer `spout`; ambient `steam` |

<a id="kettle-arrival"></a>
### Arrival, benches and the root-gate

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn | `jetty` | (−195, −20), facing 67° | the Hammerwheel left, the Kettle's plume ahead |
| Spawns | `belly` (90, 12) outside the Belly mouth · `lid` (20, −10) y 45 · `gate` (−78, −4) | | |
| Benches | `kettle:bench-forge` (−150, −30) · `-terrace` (−5, 70) · `-beach` (150, 60) · `-switchback` (95, −40) · `-handle` (−95, 30) | | five |
| Root-gate | `kettle:gate` | (−80, −10), the Handle's west foot, a root rising through old lava | opened with the Paws from this side |
| Ladder to the lid | `kettle:lid-ladder` | from the Belly's lid exit down to the spout ridge (70, −5) | appears with `stoneHeld:kettle`; `[E] Climb · Ladder` |

<a id="kettle-anchors"></a>
### Named anchors

`w:kettle` (20, −10), `w:kettle.lid` y 45 · `w:spoutMouth` (115, −15) y 28 · `w:hammerwheel` (−125, −65) ·
`w:forge` (−152, −50) · `w:bathhouse` (−10, 95) · `w:teacup` (185, 115) · `w:bellyMouth` (90, 5) · `w:handle`
(−85, −10) y 26.

<a id="kettle-pois"></a>
### Points of interest

Target: 120,000 / 1,250 = **96**. Budget: chests 12 · keepsakes 4 · acorns 9 · vistas 3 · Lamp Logs 3 · bottle 1 ·
Hollow doors 2 · dungeon door 1 · benches 5 · root-gate 1 · jetty 1 · NPC spots 8 · fish spot 1 · Dash start 1 ·
thornglass 4 · Steam Hop vents 8 · Sling Gallery start 1 · bath basins 5 (ss-40) · gate finds 5 (dark tube, Handle
hookbloom, Spoon Point glide, two cold braziers) · landmarks 4 · curios 14 · **total 98**.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `c04` holds the Copper Kettle Stove (`nook:kettle-stove`), `c10` the Ember Rust hood trim (`trim_ember`), `c07` the "Teacup" sticker (`sticker_kettle`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (`kettle:c01` … `c12`, 30 gems each):

| id | Anchor | Gate | Note |
|---|---|---|---|
| c01 | (−130, −72) | - | the Hammerwheel's pit, behind the paddles |
| c02 | (−165, −55), y 12 | Ember Sling | a hatch on the shelf above the forge row opens when both cold braziers on the Forge Ledge are lit from below |
| c03 | (−40, 120) | - | the bottom terrace's basin rim |
| c04 | (15, 80) | - | behind the bathhouse boiler |
| c05 | (55, 35) | Lantern | halfway along the dark shoulder tube |
| c06 | (120, 110) | - | Ash Beach tide-pool cove |
| c07 | (185, 115), y 16 | Leaf Glider | the Teacup's rim, glided to from **Spoon Point** (150, 70), y 26, on the spout ridge's south flank (35 m) |
| c08 | (100, 150) | Digging Paws | buried in warm black sand |
| c09 | (100, −50) | - | an alcove on the third switchback |
| c10 | (112, −22), y 28 | - | the Spout Mouth's lip (steam puffs push gently every 6 s; harmless) |
| c11 | (−85, −10), y 26 | Thistle Hook | on top of the Handle (hookbloom on its crown) |
| c12 | (60, −140), y 12 | Ivy Gloves | a north-coast cliff shelf up an ivy lattice (an Act III return) |

**Sleeping Acorns** (`kettle:acorn-1` … `9`): (−140, −20) Forgefall garden · (−110, 40) the Handle's foot ·
(−30, 100) middle terrace · (30, 110) lower terrace · (130, 40) Ash Beach dunes · (160, 130) Ash Beach south ·
(80, −70) switchbacks · (−20, −110) the Kettle's north foot · (60, 20), y 18 a cone-flank ledge.

**Lamp Logs**: `kettle:log-1` the Lampwright's Bench in Forgefall (−158, −45), where Lamplighter lamps were cast ·
`log-2` a niche on the spout ridge (70, −5), y 28 · `log-3` inside the Teacup's hollow (185, 115).

**Vistas**: `kettle:vista-spout` "The Spout Lets Off Steam" (110, −15), y 28 · `kettle:vista-handle` "Through the
Handle" on the Handle's top (−85, −10), y 26 (Hook) · `kettle:vista-teacup` "Tea for the Sea" on the Teacup's rim
(185, 115), y 16 (Glider).

**Doors**: `belly_mouth` (90, 5), y 24 → d8 the Kettle's Belly ([dungeons.md#d8](./dungeons.md#d8)); its last room
opens on the lid · `hollow_kettle_sling` (130, 140) Ash Beach tube · `hollow_kettle_steam` (60, 75) a steam grotto
under the top terrace. Interiors below.

**Bottle**: `kettle:bottle-1` on the Ash Beach tideline (190, 40).

**Fish spot**: Forgefall pier (−210, −50), "warm water".

**Activities**: Steam Hop ([side-content.md#act-steam-hop](./side-content.md#act-steam-hop)), eight vents up the
terraces at (−50, 110), (−35, 100), (−20, 92), (−5, 86), (10, 82), (25, 80), (40, 84), (52, 92), start sign at the
bathhouse; Sling Gallery ([side-content.md#act-sling-gallery](./side-content.md#act-sling-gallery)), start in the
forge yard (−150, −50), targets on the Forge Ledge cliff. Soakley's Baths (ss-40) uses the five basins at (−55, 115),
(−20, 105), (10, 100), (35, 100), (55, 108).

**Kettle Dash** (S-234): the jetty (−195, −20) → under the Handle (−85, −10) → the terraces' west stair (−60, 95) →
the beach path (60, 120) → finish at the Teacup causeway (165, 105). About 430 m.

**Thornglass** (S-233): (−175, 10) · (−5, 125) · (170, 20) · (40, −140).

<a id="kettle-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `kettle:k-mould` | the Hammerwheel, east side (−112, −78) | "Something warm" · Lamp-cage mould |
| `kettle:k-towel` | Soakley's Bathhouse, north side (−10, 80) | "Something folded" · Very old towel |
| `kettle:k-spoon` | the Teacup, seaward side (195, 125) | "Something shiny" · Tiny tin spoon |
| `kettle:k-pebble` | the Kettle, north foot (20, −120) | "Something glassy" · Star-scorched pebble |

- **Lamp-cage mould.** "A clay mould wedged behind the Hammerwheel, the shape of a little lamp cage with a spiral on
  top." / "Every Lamplighter lamp on the Wide Blue was cast in one like it. The last was poured before Master Scoria's
  grandmother was a cub."
- **Very old towel.** "A folded towel on a hook behind the bathhouse, embroidered with a moth and the word
  'RESERVED'." / "Soakley says it has been reserved for a hundred years. 'No rush,' he says. 'They might still come.'"
- **Tiny tin spoon.** "A tiny tin spoon stuck upright in the sand behind the Teacup, as if someone had been stirring
  the sea." / "Engraved on the handle: 'LIMITED EDITION!!' It is exactly like every other spoon you have ever seen."
- **Star-scorched pebble.** "A pebble on the Kettle's north foot, glassy on one side, as if something very bright
  landed near it long ago." / "It is still faintly warm. Up the slope, a scorched line points straight at the spout."

**Fifth line**: "✿ Kettle Isle's keepsakes: lamps were born here, baths were saved, and something bright fell into the
Kettle on the night of the Storm."

<a id="kettle-curios"></a>
### Curios

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · Forge rota | (−146, −36) | "FORGE ROTA. Mon: swords. Tue: swords. Wed: swords. Thu: lamps (one day). Fri: swords. Sat: bath. Sun: bath." |
| 2 | Look · Sword rack | (−158, −60) | "A rack of plain swords, each stamped with a paw print. Miso's shop sells them as 'hand-picked'. They are." |
| 3 | Look · Warm waterfall | (−118, −52) | "The Forge Ledge falls are warm enough to stand under. A smith is doing exactly that, eyes closed, humming." |
| 4 | Look · Towel line | (−30, 108) | "Fluffy towels hang drying in the steam. They never quite dry. Nobody here minds at all." |
| 5 | Look · Bath rules | (0, 88) | "SOAKLEY'S BATHS. Rule 1: no rush. Rule 2: see rule 1. Rule 3: towels provided. Rule 4: no splashing newts." |
| 6 | Look · Copper pipes | (20, 92) | "Copper pipes carry spring water into the bathhouse. They gurgle like someone humming with a mouthful of tea." |
| 7 | Look · Footprints | (140, 80) | "Footprints in the black sand go from the sea to a deck chair and back. Ten times. Someone could not decide." |
| 8 | Look · Steam fern | (70, 60) | "Ferns here grow in the steam and curl up shyly when it stops. Right now they are very uncurled." |
| 9 | Look · Lava ripples | (100, −30) | "Old lava, cooled into ripples like spilled porridge. It has been sitting still for a very long time." |
| 10 | Look · Plume | (125, −20) | "The plume from the spout is warm and smells of minerals and, faintly, of toast." |
| 11 | Look · Scorch line | (40, −90) | "A long dark streak runs up the Kettle's side, as if something bright skidded here and kept going." |
| 12 | Look · Handle carving | (−90, 20) | "Spirals are carved round the Handle's foot, and under one: 'Kettle's on. — the Lamplighters'." |
| 13 | Look · Tea stall sign | (−130, −30) | "'Forgefall Tea. Brewed on the Kettle itself. Strength: VERY.' A tiny cup is chained to the counter." |
| 14 | Look · Sea glass | (175, 70) | "Sea glass in every colour of a lamp's window. The beach is full of tiny broken lanterns, smoothed by the tide." |

<a id="kettle-enemies"></a>
### Enemies

| Region | Rolled | Placed | max |
|---|---|---|---|
| Forgefall | none (town) | - | 0 |
| Bathhouse Terraces (outer terraces only) | `ash_moth 2` | `steam_puff` × 5 (by vents) | 4 |
| Ash Beach | `soot_snuffle 4, ash_moth 2` | - | 6 |
| The Spout | `soot_snuffle 3, ash_moth 3` | `steam_puff` × 4 | 6 |

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables). `ash_moth` +3 at night on Ash Beach. Steam Puff
anchors: terraces (−70, 125), (65, 115), (−60, 80), (70, 95), (45, 60) (outer terrace ends only, never on the Steam
Hop line); the Spout (60, −40), (85, −60), (100, 0), (40, −75) along the switchbacks, each ≥ 8 m off the path's centre.
The bathhouse's inner terraces (bearings 175°-205°) and the five ss-40 basins never spawn.

<a id="kettle-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `kettle.scoria` | (−152, −50) | Master Scoria at the anvil, 07:00-18:00; at the tea stall after |
| `kettle.pitch` | (−148, −46) | Pitch beside him; in the forge interior at night |
| `kettle.smith-1`, `smith-2` | (−160, −40), (−140, −58) | two forge hands (cast.md names them) |
| `kettle.soakley` | (−10, 82) | Soakley at the bathhouse door, all day; in the great bath at night |
| `kettle.fumarole` | (55, 108) | Lady Fumarole in the hottest basin after she is calmed (a regular) |
| `kettle.tea` | (−130, −30) | the tea stall (Scoria evenings; a smith by day) |
| `kettle.miso` | (−145, −35) | Miso during ss-41 Miso's Supplier, and on visits after |

<a id="kettle-interiors"></a>
### Interiors

| id | Door | Size · rooms | Holds |
|---|---|---|---|
| `int_scoria_forge` | (−155, −58) | 64 m · 2 rooms (forge hall, the cooling room with the sword racks) | ss-38 Starsteel; ss-39 Pitch's corner |
| `int_bathhouse` | (−10, 85) | 64 m · 3 rooms (changing room, the great bath, the boiler room) | ss-40 Soakley's Baths; the "RESERVED" peg; the bath-towel Nook prize |

<a id="kettle-states"></a>
### World states

| Condition | Change |
|---|---|
| before Fumarole is calmed | the baths swing between cold and scalding every 40 s (steam blue-white ↔ orange-white, ripples fast); the forges are dark, the Hammerwheel still; the plume puffs unevenly and the Kettle grumbles every 20-40 s (a low rumble, a little dust fall on the switchbacks) |
| `stoneHeld:kettle` | within 10 s: the plume steadies; forges relight one by one (glow, sparks, hammer sfx), the Hammerwheel turns; the baths settle to a steady warm steam; the lid ladder appears. From then on **the Kettle whistles** two notes on every in-game hour, heard across the isle |
| ss-38 done | the forge window flashes blue-white once each night |
| ss-40 done | Soakley's towel line gains a striped towel; the bath steam has a faint rose tint |
| `mainEnding` | the hourly whistle plays three notes |

<a id="kettle-music"></a>
### Music and ambience

Track `kettle` ([art-audio.md#kettle](./art-audio.md#kettle)): brass and steam: a tuba bass and a muted trumpet melody
in F, 92 bpm, a hiss-and-clink percussion. Layers: `forge` adds anvil clinks on beats 2 and 4 (only after the forges
relight), `bath` slows to a warm flugelhorn pad, `beach` adds a marimba, `spout` drops to a low brass drone. Before
Fumarole is calmed every layer has a slightly sour wobble on the long notes; after, the whistle's two notes are the
track's last two. Ambience: `steam`, `forge`, `sea`.

<a id="kettle-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (21 of 24): `kettle_forge_house`, `kettle_basin_rim`, `kettle_vent`, `kettle_brazier`, `kettle_pipe`,
`kettle_towel_line`, `kettle_black_rock`, `kettle_fern`, `kettle_tube_mouth`, `kettle_sword_rack`, `kettle_deckchair`,
plus shared: bench, root-gate knot, Hollow door, vista post, lectern, soft-earth mound, hookbloom, ivy lattice,
thornglass, bottle. Single meshes: the spout rim and plume, the Handle arch, the Hammerwheel, the bathhouse, the
Teacup. The cone itself is terrain. New materials (6 of 12): basalt, black sand, copper, steam (soft additive), forge
glow, wet tile. If [atlas-isles.md#shared](./atlas-isles.md#shared) defines the cold brazier as a shared gate object,
use it instead of `kettle_brazier`.

> **`kettle_spout`** · the Spout Mouth: a thick round stone lip like a kettle's spout end, soot-dark inside, a
> steam column rising from it · lip 10 m across; plume billboard 8 × 40 m · basalt `#3b3540`, soot `#2a2228`, steam
> `#f4f0ec` · basalt + steam · 600 / 4 k · plume billboard animates (uv scroll 0.3/s); the whistle puff on the hour
> (a 2 s burst, 2× size) · **Fallback:** a torus segment and a canvas-drawn soft white plume ·
> **Image:** PREAMBLE + "a volcano shaped like a teakettle on a small island, a spout ridge letting off a gentle steam
> plume, a rock arch handle on its side, hot-spring terraces, black sand beach" (concept, also the loading card's
> reference) and "a soft white steam plume sprite, transparent, 512 × 2048, 8-frame strip" (`process_strip.py`) ·
> **3D:** "toon stone spout mouth 10 m, sooty inside".

> **`kettle_handle`** · a smooth looping rock arch on the volcano's side, like a kettle handle; ferns at its feet,
> spirals carved at the base, a hookbloom on its crown · span 70 m (z −45 to 25), apex 26 m · basalt `#3b3540`, fern
> `#8fc7a0`, carving `#f4d1a6` · basalt · 900 / 6 k · static · **Fallback:** a half torus with a box cross-section,
> tube r 5 m · **Image:** PREAMBLE + "a huge smooth natural rock arch on a volcano flank, shaped like a teakettle
> handle, ferns at its feet" · **3D:** "toon rock arch 70 m span 26 m apex".

> **`kettle_hammerwheel`** · a big timber water wheel at the foot of a warm waterfall, its axle driving three trip
> hammers over anvils under a little roof · wheel **14 m** across · timber `#8a5a3c`, iron `#3b3540`, glow `#e66f4f`
> (anvils after relight) · toon wood + forge glow · 1,200 / 8 k · the wheel turns 6 rpm after relight; hammers drop
> in turn · **Fallback:** a cylinder wheel with box paddles and three box hammers ·
> **Image:** PREAMBLE + "a big wooden water wheel under a warm waterfall turning three trip hammers in an open forge
> shed, sparks, a bear smith" · **3D:** "toon water wheel 14 m with three trip hammers".

> **`kettle_bathhouse`** · a round timber bathhouse with a green-copper dome, wide eaves, steam from the roof vent,
> towel lines, a bench out front · **12 m** to the dome top, 16 m across · timber `#c98b4b`, copper `#8fc7a0`, trim
> `#e66f4f` · toon wood + copper + steam · 1,400 / 9 k · steam vent puffs · **Fallback:** a cylinder drum with a
> hemisphere dome · **Image:** PREAMBLE + "a round cosy timber bathhouse with a green copper dome on hot-spring
> terraces, towels drying in the steam, a calm capybara at the door" · **3D:** "toon round bathhouse 16 m wide,
> copper dome 12 m".

> **`kettle_teacup`** · a squat basalt sea stack whose top is hollowed like a cup, with a rock loop on one side like
> a handle; seawater in the cup · **16 m** · basalt `#3b3540`, rim moss `#8fc7a0`, water `#7fd3d0` · basalt · 700 /
> 4 k · static · **Fallback:** a lathe cup profile and a half torus handle · **Image:** PREAMBLE + "a basalt sea
> stack shaped like a giant teacup with a handle, standing in shallow water off a black sand beach" ·
> **3D:** "toon basalt sea stack 16 m shaped like a teacup".

> **`kettle_forge_house`** · a stone forge shed with a wide chimney, an open front, an anvil, a water trough ·
> 7 × 6 × 6 m · stone `#5a4a48`, roof `#c2563f`, glow `#e66f4f` (after relight) · toon stone + forge glow · 500 /
> 3 k · two states (dark, lit with spark particles) · **Fallback:** box shed, box chimney, emissive box hearth.

> **`kettle_basin_rim`** · a stone rim for a spring basin, smooth and worn, a little step · 4-8 m across (scaled) ·
> `#d8cfc0`, water `#7fd3d0` · wet tile · 120 / 800 · steam over the water: three states (cold blue-white, warm,
> scalding orange-white) · **Fallback:** a torus ring on a disc.

> **`kettle_vent`** · a crack in the rock with a ring of pale crust, puffing steam on a beat · 1.5 m · `#3b3540`,
> crust `#f4d1a6` · basalt + steam · 60 / 300 · puff every 2.4 s (Steam Hop vents lift Pip 3 m when puffing) ·
> **Fallback:** a flat disc and the steam sprite.

> **`kettle_brazier`** · a squat iron brazier on three legs, a spiral on the bowl, cold (grey ash) or lit · 1.2 m ·
> iron `#3b3540`, ember `#e66f4f` · forge glow · 120 / 700 · lit: flame sprite · **Fallback:** a cylinder bowl on
> three thin cylinders.

> **`kettle_pipe`**, **`kettle_towel_line`**, **`kettle_black_rock`**, **`kettle_fern`**, **`kettle_tube_mouth`**,
> **`kettle_sword_rack`**, **`kettle_deckchair`** · copper pipe runs (2 m segments, `#8fc7a0`, 40 tris), a rope
> between posts with three towels (`#f4d1a6`, `#e66f4f`, `#8fc7a0`, 80 tris), rounded black rocks (1-3 m, 60 tris),
> curling ferns (1 m, 80 tris), a lava-tube mouth (a stone hood 6 m wide, dark inside, 300 tris), a rack of six plain
> swords (1.5 m, 120 tris), a striped deck chair (1 m, 80 tris). **Fallback:** cylinders, boxes, spheres.
> **Image:** one sheet, PREAMBLE + "volcanic spa island props: copper pipes, a towel line, black rocks, curled ferns,
> a lava-tube mouth, a sword rack, a striped deck chair, isolated".

<a id="kettle-coverage"></a>
### Coverage proof

13 × 13 cells of 40 m (last row and column 32 m). Land cells (≥ 200 m²): **expected 80-92**. Cells most at risk: the
steep cone above y 30 (counted only where walkable: the spout ridge path, covered by c09, c10, log-2, the vista and
the switchback bench) and the north coast (acorn 8, the pebble keepsake, c12, thornglass 4, curio 11).

<a id="kettle-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-222 | Shape and recipe, regions; prints |
| S-223 | spout and plume, Handle, Hammerwheel, bathhouse, Teacup, forge houses, basins, vents, pipes, small props; troubled states |
| S-224 | terrain layers, loading card, map art, track `kettle` |
| S-225 | spots for Scoria, Pitch, smiths, Soakley, tea; interior doors |
| S-226 | enemy tables and Steam Puff anchors |
| S-227 | brazier gate object; c02's hatch |
| S-228 | chests (c12 inert until the Gloves), keepsakes, acorns, vistas, logs, bottle, Hollow doors, benches, curios; coverage |
| S-229-S-231 | `belly_mouth`, the lid, Fumarole's spot |
| S-232 | the calmed state, the whistle, the lid ladder; unhide |
| S-233 · S-234 | thornglass; ss-38 forge flash · the Hollows; the Kettle Dash |
| S-236-S-237 | basins for ss-40, Steam Hop vents, Sling Gallery targets, Miso's spot |

---
<a id="saltglass"></a>
## Saltglass Flats

A pale salt desert, the biggest far land: singing glass dunes to the west, mirror-bright salt pans to the east, a dig
camp by the jetty, and in the middle, on a low hill, the bell tower of the Lamplighter Academy standing out of the
sand. The rest of the school is under it. Its last students left a century ago; Tutor Scarabelle still keeps the
school for students who may yet come, and the third Stair Stone is the weight of its bell.

<a id="saltglass-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `saltglass` · overworld |
| Grid · seed · land | 640 m · 40277 · 0.20 km² |
| Recipe | `js/realms/recipes/dunes.js` (`dunes`) |
| Palette | salt `#efe3c8`, dune `#c9a46b`, glass `#8ec9d8`, clay `#b55d4c`; fog `#f3ead8` near 140 m, far 300 m (a bright haze, never dark) |
| Light | outdoor day/night; noon is very bright (bloom on the pans), night is deep blue with the glass faintly lit |
| Unlock · connection | `ch14`; the Glassway's Saltglass buoy (first trip), then the chart; `hidden: true` until S-254 |
| Hours | 4.0 h main (people, the Buried Academy, the exam); stories ≈ 2 h (M29) |
| Built by | S-243 recipe, S-244 props, S-245 art, S-246 people, S-247 enemies, S-248 Ivy Gloves (home climbs), S-249 finds, S-250-S-253 the Buried Academy and the exam, S-254 main chain (unhide), S-255 Hollows, Dash and Rook's finale, S-258-S-259 stories |

<a id="saltglass-shape"></a>
### Shape and recipe

| Piece | Numbers |
|---|---|
| Island | ellipse centre (0, 0), rx 280, rz 230, coastline noise ±8 % (wavelength 90 m), beach ring 12 m of pale sand |
| **Academy Hill** | a smooth hill centred (−20, 40), r 90, top y 14 (cosine profile). The bell tower stands on the top; ruin stamps (roofs, wall tops, columns) poke out of the slopes; Dormitory Row (eight half-buried cottages) runs along the west slope from (−85, 85) to (−40, 60) |
| **The Glass Dunes** | bearings 200°-30° (through west and north) from (0, 0), outside Academy Hill: dune ridges by directional noise, wind from the west, crests running north-south, wavelength 45 m, height 4-14 m, lee faces steeper (≤ 32°, all walkable); 16 glass sculptures; the Glass Organ on a high dune at (−200, −60) |
| **The Salt Pans** | bearings 30°-200° outside Academy Hill and Sablecamp: flat y 1.0 ± 0.1, a hexagonal crust splat, low salt ridges 0.3 m between pans (walkable), the Mirage Well (a spring pool r 9) at (120, 40); the Practice Beacon at (150, 110) |
| **Sablecamp** | a flat shelf centred (110, −160), r 70, y 3: tents, dig trenches 1 m deep (with ramps), a finds table, the Windcatcher |
| **The Lamp Walk** | the students' old road, a flagstone path 3 m wide: the jetty (100, −215) → (110, −160) → (70, −110) → (40, −70) → the Academy gate (20, −35); twelve practice lamp posts every 17 m from (95, −195) |
| Jetty | north-east shore (100, −222), facing 22° (home lies that way) |
| Ruin stamps | 30-40 stamps by Poisson discs (min 14 m) on Academy Hill and the dune foot around it: roof ridges, wall tops with arched windows, broken columns; each a static collider |
| The Drift Door | a sand drift ramp on the tower's north face from the hill top up to a door at y 18 (4 m above the hilltop) |

<a id="saltglass-regions"></a>
### Regions

| id | Card | Extent rule | Landmark (anchor, height) | Entry | `REGIONS` row |
|---|---|---|---|---|---|
| `sablecamp` | **Sablecamp** / "Brush, don't dig" | r < 70 from (110, −160), and the jetty | **the Windcatcher** (125, −150), 10 m striped canvas tower | the jetty (100, −215) | music `saltglass`, layer `camp`; ambient `wind`; enemies []; max 0 |
| `dunes` | **The Glass Dunes** / "Wind-polished" | bearings 200°-30° outside the hill and the camp | **the Glass Organ** (−200, −60), 18 m | the Lamp Walk at (40, −70); the hill's west foot (−110, 40) | layer `dunes`; ambient `glasswind` |
| `pans` | **The Salt Pans** / "Very bright" | bearings 30°-200° outside the hill and the camp | **the Practice Beacon** (150, 110), 16 m stacked salt blocks | the Lamp Walk at (70, −110); the hill's east foot (70, 40) | layer `pans`; ambient `wind` |
| `academy` | **Academy Hill** / "Mind the bell" | r < 90 from (−20, 40) | **the Academy bell tower** (−20, 40), 26 m above the hilltop (top y 40) | the Academy gate (20, −35) | layer `academy`; ambient `wind` |

The bell tower is the realm's tallest thing and is visible from every land cell (the dunes are at most 14 m and the
tower's top is at y 40): the first-person compass of the Flats.

<a id="saltglass-arrival"></a>
### Arrival, benches and the root-gate

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn | `jetty` | (100, −215), facing 202° | the Windcatcher ahead-left, the bell tower beyond |
| Spawns | `drift` (−20, 24) outside the Drift Door · `gate` (−40, 118) | | |
| Benches | `saltglass:bench-camp` (105, −150) · `-walk` (55, −90) · `-gate` (15, −25) · `-organ` (−185, −40) · `-well` (125, 30) · `-dorms` (−70, 90) | | six |
| Root-gate | `saltglass:gate` | (−40, 125), **the Acacia Root**: a petrified acacia at the hill's south foot whose root is one of Wenna's | opened with the Paws from this side |

<a id="saltglass-anchors"></a>
### Named anchors

`w:belltower` (−20, 40), `w:belltower.bell` y 36 · `w:driftDoor` (−20, 32) y 18 · `w:academyGate` (20, −35) ·
`w:glassOrgan` (−200, −60) · `w:practiceBeacon` (150, 110) · `w:windcatcher` (125, −150) · `w:findsTable`
(112, −158) · `w:mirageWell` (120, 40) · `w:dorms` (−60, 72).

<a id="saltglass-pois"></a>
### Points of interest

Target: 200,000 / 1,250 = **160**. Budget: chests 16 · keepsakes 4 · acorns 11 · vistas 3 · Lamp Logs 6 · bottle 1 ·
Hollow doors 3 · dungeon door 1 · benches 6 · root-gate 1 · jetty 1 · NPC spots 8 · fish spot 1 · Dash start 1 ·
thornglass 5 · brush spots 12 (ss-42) · nameplates 8 (ss-43) · glass sculptures 16 · Sunglass receivers 6 · ivy
lattices 6 · practice lamps 12 · landmarks 4 · curios 28 · **total 160**.

**Prize chests** (CANON §10.4; [systems.md#economy](./systems.md#economy)): `c13` holds the Saltglass Hourglass (`nook:hourglass`), `c03` the Dune Sand hood trim (`trim_dune`), `c04` the "Academy Bell" sticker (`sticker_saltglass`). Every other chest holds 30 gems. The finds step that places these chests gives the prize with its own item-get instead of the gem toast.

**Chests** (`saltglass:c01` … `c16`, 30 gems each):

| id | Anchor | Gate | Note |
|---|---|---|---|
| c01 | (115, −165) | - | under the finds table's tarp |
| c02 | (95, −140) | Digging Paws | buried in a dig trench |
| c03 | (25, −40) | Lantern, night | the Lamp Walk chest: rises at the Academy gate when all 12 practice lamps are kindled at night (`Kindle · Lamp`); the Starsong's *Dusk* makes night |
| c04 | (−195, −45) | puzzle | the Dune Chord: strike four glass sculptures in the order scratched on a potsherd at Sablecamp (curio 3) and a chest rises from the sand at the Organ's foot |
| c05 | (−150, −150) | - | a dune crest in the north |
| c06 | (−230, 60) | - | a wind-scooped hollow in the west |
| c07 | (−240, −110), y 10 | Leaf Glider | a glass shelf, glided to from the Glass Organ's ledge (y 18, 50 m) |
| c08 | (120, 50) | - | the Mirage Well's south rim |
| c09 | (60, 170) | - | a salt cave in a pan edge |
| c10 | (150, 110), y 16 | Thistle Hook | the Practice Beacon's top ledge |
| c11 | (200, 60) | Sunglass | a salt-block door that slides open when its receiver is beamed |
| c12 | (−85, 85) | - | the last cottage of Dormitory Row |
| c13 | (−10, 75) | - | the old exam garden behind the tower |
| c14 | (−20, 40), y 36 | Ivy Gloves | the belfry ledge (the Gloves are this land's reward: a same-visit return) |
| c15 | (−45, 105) | Ember Sling | a cellar door sealed with a wax plug |
| c16 | (−265, 10) | Starsong | a star door in the far west dunes |

**Sleeping Acorns** (`saltglass:acorn-1` … `11`): (130, −175) Sablecamp · (70, −105) the Lamp Walk · (−120, −100)
north dunes · (−210, −150) far north dunes · (−250, 40) west dunes · (−160, 120) south-west dunes · (100, 80) pans ·
(180, 150) pans east · (40, 190) south pans · (−60, 20) Academy Hill north-west · (10, 95) Academy Hill south.

**Lamp Logs** (six, the Academy's): `saltglass:log-1` the Lamp Walk's first stone (98, −205) · `log-2` Dormitory Row
(−60, 70) · `log-3` the Practice Beacon's foot (145, 100) · `log-4` the Glass Organ's base (−190, −55) · `log-5`
Sable's finds table (112, −158), dug up and labelled "PAPER? (Ask an expert)" · `log-6` the Drift Door's lintel
(−20, 30), y 19.

**Vistas**: `saltglass:vista-shine` "The Flats Shine" on the Practice Beacon (150, 110), y 16 (Hook) ·
`saltglass:vista-wind` "Wind Music" on the Organ's dune (−170, −70), y 14 · `saltglass:vista-school` "The Whole
School" in the belfry (−20, 40), y 36 (Ivy).

**Doors**: `drift_door` (−20, 32), y 18 → d9 the Buried Academy ([dungeons.md#d9](./dungeons.md#d9)) ·
`hollow_saltglass_sand` (−240, −120) a dune cave · `hollow_saltglass_beam` (200, 150) a salt-block hut on the pans ·
`hollow_saltglass_ivy` (−95, 30) a ruined classroom roof on the hill's west slope.

**Bottle**: `saltglass:bottle-1` on the north shore (60, −228). **Fish spot**: the Mirage Well (118, 45), "spring".

**Side-story marks** (`placeSideMarks`): ss-42 Sable's Dig, 12 brush spots ("Brush, don't dig"), 6 round Sablecamp's
trenches within 40 m of (110, −150) and 6 on the hill's skirts at r 85-95 from (−20, 40) · ss-43 Roll Call, 8
nameplates, one on each Dormitory Row cottage door.

**Gate finds**: 16 glass sculptures (in a loose spiral round the Glass Organ, 25-90 m from it; each chimes its own
note when struck); 6 Sunglass receivers (c11's door, the Practice Beacon's crown, the beam Hollow's door, three on
Academy ruins that light their arched windows); 6 ivy lattices (the bell tower's south face, a Dormitory Row chimney,
two ruin walls, the Windcatcher's mast, the Organ's back); 12 practice lamps along the Lamp Walk.

**Saltglass Dash** (S-255): Sablecamp (105, −150) → the Lamp Walk → the Academy gate (20, −35) → round the hill's
north foot (−90, −10) → finish at the Glass Organ (−185, −40). About 430 m.

**Thornglass**: (−130, −40) · (−260, 100) · (90, 130) · (−90, 120) · (160, −120).

<a id="saltglass-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `saltglass:k-badge` | the Windcatcher, east side (138, −160) | "Something dusty" · First-year badge |
| `saltglass:k-fork` | the Glass Organ, west side (−215, −65) | "Something singing" · Brass tuning fork |
| `saltglass:k-paper` | the Practice Beacon, south side (160, 122) | "Something scorched" · Singed exam paper |
| `saltglass:k-bookmark` | the bell tower, south face (−20, 52) | "Something stitched" · Moth-wing bookmark |

- **First-year badge.** "A tin badge in the sand behind the Windcatcher: a moth on a lamp, and 'ACADEMY · FIRST
  YEAR'." / "Sable found it the day she arrived and has been looking for its owner ever since. She suspects they are
  quite old by now."
- **Brass tuning fork.** "A brass tuning fork pushed into the sand behind the Glass Organ, humming the same note as
  the biggest pipe." / "A scratched note: 'If the lamp can sing, the boats can hear it in the fog.' Students tuned
  their lamp-bells here."
- **Singed exam paper.** "A corner of exam paper, singed brown, held down by a salt block behind the Practice
  Beacon." / "'Q4: Why do we give light away? A: Because it's better company than keeping it.' A big red tick. 'See
  me. — S.'"
- **Moth-wing bookmark.** "A bookmark stitched like a moth's wing, tucked in a crack on the bell tower's south face."
  / "Embroidered very small: 'W., age 12. Top marks in lamp-trimming. Bottom marks in sitting still.'"

**Fifth line**: "✿ Saltglass's keepsakes: the Academy's last students were young once. One of them still keeps a
window lit."

<a id="saltglass-curios"></a>
### Curios

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · Camp notice | (108, −170) | "SABLECAMP. Brush, don't dig. Label everything. If it's a pot, shout. If it's a rock, shout quieter." |
| 2 | Look · Labelled rock | (120, −150) | "A rock with a label: 'POT (probably)'. A second label underneath: 'Rock (definitely). — S.'" |
| 3 | Look · Potsherd | (100, −165) | "A potsherd scratched with four little glass pillars, numbered: tall, short, leaning, cracked." |
| 4 | Look · Windcatcher | (128, −146) | "The Windcatcher turns the breeze down into the tents. It is the only cool spot for miles. Sable naps under it." |
| 5 | Look · Lamp Walk stone | (85, −180) | "Flagstones worn smooth in two lines. Generations of students walked this road with a lamp in each paw." |
| 6 | Look · Practice lamp | (60, −95) | "A lamp post with a brass plate: 'Light me properly. Trim, then flame. — Class of the Long Summer.'" |
| 7 | Look · Academy gate | (20, −42) | "An iron gate with nothing on either side of it. Everything around it went under the sand. The gate stayed." |
| 8 | Look · Roof in the sand | (−40, 10) | "The top of a classroom roof, chimney and all, sticking out of the sand like a hat." |
| 9 | Look · Arched window | (0, 80) | "An arched window at ground level. Inside, sand fills a classroom to the top of the desks." |
| 10 | Look · Broken column | (−70, 40) | "A column with spirals carved round it, snapped in two. The top half lies nearby, looking embarrassed." |
| 11 | Look · Timetable | (−30, 15) | "A carved timetable: 'Dawn: wicks. Noon: lenses. Dusk: lighting. Night: lighting, again, properly.'" |
| 12 | Look · Desk | (10, 60) | "A school desk half buried, initials carved in the lid. Someone named 'P' was here. Someone named 'W' was too." |
| 13 | Look · Dorm cottage | (−60, 65) | "A tiny dormitory cottage, roof deep in sand. A sock is still drying on the windowsill. It is very dry now." |
| 14 | Look · Exam bell rope | (−18, 34) | "A rope hangs from the tower to the ground, knotted every metre. A sign: 'NOT for leaving early.'" |
| 15 | Look · Singing glass | (−170, −30) | "Wind-polished glass pillars, warm in the sun. When the wind blows they hum, all slightly out of tune." |
| 16 | Look · Glass in the dune | (−120, −120) | "A ridge of glass melted into the sand, smooth as ice. Something very hot touched here once. It's cool now." |
| 17 | Look · Footprints | (−200, 10) | "Small tracks cross the dune and stop. Then start again ten metres on. Something here likes to dive." |
| 18 | Look · Wind ripples | (−150, 90) | "Ripples in the sand, perfectly even, like a page of lined paper waiting for an answer." |
| 19 | Look · Lost lens | (−90, −60) | "A brass lens the size of a dinner plate. Through it, the bell tower looks very close and slightly surprised." |
| 20 | Look · Salt crust | (90, 60) | "The crust cracks into neat hexagons. Each one crunches a slightly different note under Pip's boots." |
| 21 | Look · Mirage | (160, 40) | "Shimmering over the pans: a little island with a steaming hill. Kettle Isle? Or a mirage? Both, probably." |
| 22 | Look · Salt blocks | (140, 95) | "Salt blocks cut square and stacked. Each has a student's mark. One has a tiny drawing of a moth." |
| 23 | Look · Spring | (115, 35) | "The Mirage Well's water is fresh, not salty. Nobody knows why. The jerboas think it is very rude to ask." |
| 24 | Look · Bright | (60, 140) | "It is very bright out here. Even the shadows look like they would like a hat." |
| 25 | Look · Prickle patch | (190, 120) | "A patch of round prickly plants, all facing the sun. They are doing their best." |
| 26 | Look · Old boathouse | (215, 40) | "A boathouse with no water near it. The sea went away a long time ago. The boathouse is still waiting." |
| 27 | Look · Acacia | (−45, 130) | "A petrified acacia, stone from root to twig. Its biggest root goes down, and down, and hums." |
| 28 | Look · Shore glass | (40, −225) | "Glass pebbles on the shore, every one with a dent where a thumb fits. Someone used them to count lamps." |

<a id="saltglass-enemies"></a>
### Enemies

| Region | Rolled | Placed | max |
|---|---|---|---|
| Sablecamp | none (town) | - | 0 |
| The Glass Dunes | `sandsnoot 3, dust_puff 3` | - | 6 |
| The Salt Pans | `sun_beetle 3, dust_puff 2` | `prickle_pear` × 4 | 6 |
| Academy Hill | `sun_beetle 2, sandsnoot 2` | `prickle_pear` × 6 | 6 |

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables). Prickle Pear anchors: pans (95, 120), (170, 80),
(60, 150), (200, 120) (curio 25's patch is decoration, not a turret); Academy Hill (−60, 0), (30, 30), (−80, 60),
(0, 95), (−40, 85), (25, 70), each ≥ 10 m from the Lamp Walk, the Drift Door ramp and every nameplate.

<a id="saltglass-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `saltglass.sable` | (112, −162) | Sable at the finds table 06:00-12:00 and 16:00-20:00; napping under the Windcatcher 12:00-16:00 |
| `saltglass.crew-1` … `3` | (90, −145), (100, −130), (125, −140) | the dig crew (cast.md names them), in the trenches by day |
| `saltglass.cook` | (130, −165) | the camp cook at the stewpot |
| `saltglass.scarabelle` | (−10, 70) | Tutor Scarabelle in the exam garden after her exam; before it she is inside the Academy only |
| `saltglass.rook` | (−180, −50) | Rook for race part 5 (ss-49) |
| `saltglass.library` | inside `int_academy_library` | Sable's workroom desk (evenings) |

<a id="saltglass-interiors"></a>
### Interiors

| id | Door | Size · rooms | Holds |
|---|---|---|---|
| `int_academy_library` | the Library Dig, a dug-out doorway on the hill's east slope (30, 50) | 64 m · 2 rooms (reading room, card catalogue) | Sable's workroom; the Roll Call board (ss-43); the Exam Retake desk (ss-44) |

<a id="saltglass-states"></a>
### World states

| Condition | Change |
|---|---|
| before the exam | the bell hangs silent; the Academy's ruin windows are dark at night |
| `stoneHeld:saltglass` | within 10 s the bell rings three times (heard across the Flats), then rings once at noon and once at dusk every day; the 16 glass sculptures hum a chord at noon; ruin windows glow at night |
| c03 solved | the Lamp Walk's 12 lamps burn every night for good |
| ss-42 done | a "MUSEUM" tent at Sablecamp with Sable's labelled finds |
| ss-43 done | the eight nameplates are polished and readable; one says "W." and one says "P." |
| `mainEnding` | at dusk one practice lamp lights itself first, then the rest follow, in order |

<a id="saltglass-music"></a>
### Music and ambience

Track `saltglass` ([art-audio.md#saltglass](./art-audio.md#saltglass)): still and old: a solo reed melody over a
sustained glass-harmonica drone in A minor (resolving to A major after the stone), 70 bpm, sparse. Layers: `camp`
adds a hand drum and plucked strings; `dunes` adds wind-chime glass tones (the sculptures' notes); `pans` adds a high
shimmering pad; `academy` adds a slow bell every 8 bars (after the stone, the real bell's tone). Ambience: `wind`,
`glasswind` (soft hums rising and falling with gusts).

<a id="saltglass-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (22 of 24): `saltglass_ruin_roof`, `saltglass_ruin_wall`, `saltglass_column`, `saltglass_dorm`,
`saltglass_glass`, `saltglass_tent`, `saltglass_trench`, `saltglass_lamp_post`, `saltglass_salt_block`,
`saltglass_prickle`, `saltglass_nameplate`, plus shared: bench, root-gate knot, Hollow door, vista post, lectern,
soft-earth mound, hookbloom, ivy lattice, receiver, star door, thornglass. Single meshes: the bell tower, the Glass
Organ, the Practice Beacon, the Windcatcher, the finds table, the Mirage Well, the Acacia Root. New materials (6 of
12): salt crust, sun-bleached stone, wind glass (fresnel + soft refraction look), canvas, brass, petrified wood.

> **`saltglass_belltower`** · a square sandstone bell tower with a pointed copper cap, an arched open belfry with a
> great bronze bell, a moth-and-lamp emblem, spirals round the cornice, a door 4 m up on a sand drift, ivy on the
> south face · **26 m** above the hilltop, 7 × 7 m · stone `#e8d9b8`, trim `#b55d4c`, cap `#8ec9d8` (verdigris),
> bell `#b8894a` · sun-bleached stone + brass · 1,500 / 10 k · bell swings on rings · **Fallback:** a box shaft, a
> pyramid cap and a box belfry with a cylinder bell · **Image:** PREAMBLE + "a half-buried old school bell tower
> standing out of a pale salt desert, sandstone with a verdigris copper cap, a big bronze bell, a moth-and-lamp emblem,
> a sand drift reaching a door halfway up" · **3D:** "toon sandstone bell tower 26 m with verdigris cap, open belfry,
> bronze bell, door 4 m up".

> **`saltglass_glass_organ`** · a cluster of wind-polished glass pipes of many heights growing from a dune crest,
> pale blue-green, sun glinting · **18 m** tallest, cluster 10 m wide · glass `#8ec9d8`, base sand `#c9a46b` · wind
> glass · 900 / 6 k · pipes hum (audio), a slow glint sweeps · **Fallback:** 14 cylinders of varied heights with the
> glass material · **Image:** PREAMBLE + "a cluster of tall wind-polished glass pipes like an organ on a desert dune,
> pale blue-green, singing in the wind" · **3D:** "toon glass pipe cluster 18 m".

> **`saltglass_practice_beacon`** · a tower of square salt blocks stacked by students, slightly crooked, a stone lamp
> cradle on top with a Sunglass receiver, chalk marks · **16 m** · salt `#efe3c8`, shadow `#d8c8a8`, cradle `#b55d4c`,
> receiver `#ffcf7a` · salt crust · 600 / 4 k · receiver glows when beamed · **Fallback:** 9 stacked boxes with a
> small offset each · **Image:** PREAMBLE + "a slightly crooked tower of stacked white salt blocks on bright salt
> flats, a little lamp cradle on top" · **3D:** "toon tower of stacked salt blocks 16 m".

> **`saltglass_windcatcher`** · a tall timber mast with a striped canvas scoop that turns to the breeze, ropes to
> the tents · **10 m** · canvas `#b55d4c` / `#efe3c8` stripes, timber `#8a6a4a` · canvas · 400 / 2.5 k · scoop yaws
> slowly · **Fallback:** a cylinder mast and a curved quad scoop.

> **`saltglass_glass`** · a single wind-polished glass pillar, smooth and leaning, three shapes (tall, short,
> leaning) and a cracked one · 2-5 m · `#8ec9d8`, inner `#cfeef5` · wind glass · 80 / 500 · chimes (glow pulse) when
> struck · **Fallback:** a capsule with the glass material.

> **`saltglass_ruin_roof`**, **`saltglass_ruin_wall`**, **`saltglass_column`**, **`saltglass_dorm`** · a tiled roof
> ridge with a chimney poking out of sand (6 m, `#b55d4c`, 200 tris), a wall top with an arched window (5 m, stone
> `#e8d9b8`, 160 tris; windows glow `#ffcf7a` at night after the stone), a spiral-carved broken column (4 m, 120 tris),
> a tiny dormitory cottage buried to its eaves (4 × 3 m, 260 tris, a door with a nameplate) · sun-bleached stone ·
> **Fallback:** boxes, prisms and cylinders · **Image:** one sheet, PREAMBLE + "ruins of a gentle old school half
> buried in pale sand: roof ridges with chimneys, wall tops with arched windows, spiral-carved columns, a tiny
> dormitory cottage, isolated".

> **`saltglass_tent`**, **`saltglass_trench`**, **`saltglass_finds_table`** · a striped dig-camp tent (4 × 3 m,
> canvas `#efe3c8` / `#b55d4c`, 160 tris), a dig trench frame of planks and string (6 × 2 m, 60 tris), a trestle table
> of labelled finds under a tarp (3 m, 300 tris) · canvas + brass · **Fallback:** prisms and boxes ·
> **Image:** PREAMBLE + "an archaeology dig camp in a salt desert: striped tents, string-lined trenches, a table of
> labelled pots and rocks".

> **`saltglass_lamp_post`** · a slim stone post with a brass lamp and a little plate, unlit or lit · 2.2 m · stone
> `#e8d9b8`, brass `#b8894a`, glass `#ffcf7a` · brass + lamp glass · 100 / 600 · `Kindle · Lamp` · **Fallback:** a
> cylinder and an emissive box.

> **`saltglass_salt_block`**, **`saltglass_prickle`**, **`saltglass_nameplate`** · a cut salt block (1 m, 12 tris),
> a round prickly plant facing the sun (0.8 m, 120 tris, `#7fae4b` with pink flowers `#ff9f8f`), a brass nameplate on
> a door (0.4 m, 8 tris, text decal) · **Fallback:** a box, a sphere with cone spikes, a plane.

<a id="saltglass-coverage"></a>
### Coverage proof

16 × 16 cells of 40 m. Land cells (≥ 200 m²): **expected 140-156**. Cells most at risk: the dune troughs in the far
west and north (covered by the 16 sculptures' spiral, c05, c06, c16, acorns 3-5, thornglass and curios 16-19) and the
empty south pans (c09, acorn 9, curio 24). The bell tower's line of sight helps (c) in most cells; the test still
requires (a) or (b) for at least 70 % of cells so the Flats never feel empty.

<a id="saltglass-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-243 | Shape and recipe, regions, the Lamp Walk path, ruin stamps; prints |
| S-244 | the bell tower (silent), Glass Organ, Practice Beacon, Windcatcher, glass sculptures, ruins, dorms, camp props, lamp posts |
| S-245 | terrain layers (salt crust splat), loading card, map art, track `saltglass` |
| S-246 | spots for Sable, crew, cook; the library door |
| S-247 | enemy tables and Prickle Pear anchors |
| S-249 | chests (c14-c16 inert until their tools), keepsakes, acorns, vistas, six Lamp Logs, Hollow doors, benches, receivers, ivy lattices, curios, the c03 and c04 puzzles; coverage |
| S-250-S-253 | `drift_door`; Scarabelle's spot |
| S-254 | the bell states; unhide |
| S-255 | the three Hollows; the Saltglass Dash; Rook's spot |
| S-258-S-259 | brush spots, nameplates, the museum tent |

---
<a id="driftholm"></a>
## Driftholm

The painted sky isle from home's north-east sky, made walkable: a lilac meadow on a floating rock, broken spiral
arches, stepping stones over nothing, a waterfall pouring off the edge into cloud, and the Wide Blue painted far
below. The top step of the Starstair. Mote has lived here for a hundred years: his patched shelter, his hundred
little scrap lamps and his Tally Wall are the first things Pip sees, so the antagonist's case is in his own place
before the player judges him (charter Always 5). Chapter 18 ends here with the chase up the Spiral Stair.

<a id="driftholm-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `driftholm` · overworld, floating |
| Grid · seed · land | 448 m · 40283 · 0.07 km² |
| Recipe | `js/realms/recipes/floating.js` (`floating`) |
| Palette | lilac `#c9b6ec`, cloud `#f7f2ff`, moss `#9bb87a`; sky `#a9c8f0` → `#f2e8ff` at the horizon; fog `#efe6fa` near 150 m, far 300 m |
| Light | outdoor day/night; the sun is higher and whiter than home's; at night the stars are close and bright |
| Unlock · connection | three Stair Stones set; `[E] Climb · the Starstair` at home's needle (ch18); `hidden: true` until S-272 |
| Hours | the Starstair climb, Driftholm and the Spiral Stair 2.5 h main; side stories and finds ≈ 2 h |
| Built by | S-262 recipe, S-263 props, S-264 the Starstair, S-265 art, S-266 Nimbles and enemies, S-267 finds and ss-45/46, S-268 Cloudstep, S-269-S-271 the Spiral Stair and the chase, S-272 ch18 (unhide) |

<a id="driftholm-shape"></a>
### Shape and recipe

| Piece | Numbers |
|---|---|
| **Main isle** | a blob centred (−10, 0), r 138 (radial noise ±15 %, 7 lobes), top y 56-70 (gentle hills, amp 5, wavelength 60 m); cliffs drop 40 m to a rounded underside (a single rock mesh with hanging roots, not walkable) |
| **Arch Rise** | a rock spire on the main isle's east side, base centred (95, −20), r 22, rising from y 64 to a plateau at y 100 (r 16). A prop mesh with a cylinder collider, not terrain; the plateau is a deck on top. Its inside is the Spiral Stair (d10, a separate realm). After `act3done` **the Outer Stair** unfurls: 40 floating steps spiralling round the spire from (112, −5) up to the plateau |
| **Islets** | Brookstone (−165, −105) r 30, top y 66 · Hushstone (40, −170) r 26, top y 64 · Kiteknoll (170, −100) r 26, top y 74 · Puffholm (130, 110) r 34, top y 56 · the Lookout (−120, 150) r 22, top y 52 |
| Links | main ↔ Brookstone: six floating stepping stones (r 1.5 m, 4.5 m apart, tops y 64) · main ↔ Hushstone: the Hanging Roots, a root bridge deck 3 m wide from (30, −132) · main ↔ Puffholm: a plank bridge 8 m · main → the Lookout: a 26 m glide (Leaf Glider, y 60 → 52) and back by a bounce cloud · Arch Rise plateau → Kiteknoll: a 68 m glide (y 100 → 77) and back by a bounce cloud (or cloud motes with Cloudstep) |
| **Falling** | below y 30 the cloud floor catches Pip: a 0.3 s fade, Pip is placed at his last safe ledge, toast "Boing! The clouds bounce Pip back." No damage, no dizzy |
| Cloud floor | instanced cloud puffs (billboards 20-40 m) at y 18-24 with gaps; below the gaps, **the ground card**: a 900 m disc at y −120 painted with the Wide Blue from above (home in the middle, the four near isles, the Glassway's green band), fog-exempt like a landmark |
| The Long Fall | the spring pond (10, −80), r 12, feeds a stream north to the main isle's edge at (10, −135), where it pours 60 m down into the clouds (a waterfall sheet and a mist billboard) |
| Water plane | none (the pond and stream are local water meshes) |

<a id="driftholm-regions"></a>
### Regions

| id | Card | Extent rule | Landmark (anchor, height) | Entry | `REGIONS` row |
|---|---|---|---|---|---|
| `motesmeadow` | **Mote's Meadow** / "Someone lives here" | the main isle except the three below | **the Scrap Beacon** (−40, 10), 9 m: a pole of stacked scrap lamps | the Stair Landing (−100, 80) | music `driftholm`, layer `meadow`; ambient `breeze`; enemies []; max 0 |
| `falls` | **The Falls** / "Mind the edge" | main isle with z < −60 and x < 50, Brookstone, Hushstone | **the Long Fall** and **Rainbow Rock** (25, −125), 12 m beside it | the meadow path at (−20, −55) | layer `falls`; ambient `falls` |
| `nimbledowns` | **Nimble Downs** / "Fluffy" | main isle with x ≥ 0 and z ≥ 10, Puffholm, the Lookout | **the Puff Tree** (60, 70), 14 m, its canopy a cloud | the meadow path at (0, 30) | layer `downs`; ambient `breeze` |
| `archrise` | **Arch Rise** / "The way up" | main isle with x ≥ 50 and −60 ≤ z < 10, the spire, Kiteknoll | **the Spiral Arch** (95, −20) on the plateau, top y 124 | the meadow path at (40, −15) | layer `arch`; ambient `breeze` |

<a id="driftholm-arrival"></a>
### Arrival, benches and ways out

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn | `stair` | (−95, 72), facing 45° | the Scrap Beacon and Mote's shelter ahead, the Spiral Arch on its spire behind them |
| Spawns | `arch` (95, −12) on the plateau, facing 225° · `spiral` (66, −20) outside the Spiral Stair door | | |
| The Stair Landing | `driftholm:landing` | (−100, 80), the south-west lip; the Starstair's last flight falls away south-west into cloud | `[E] Climb · the Starstair` → home `cairn-needle` |
| Benches | `driftholm:bench-landing` (−90, 82) · `-meadow` (−25, 20) · `-fold` (80, 60) · `-arch` (60, −10) | | four |
| Root-gate | none | | Driftholm is not on Wenna's roots |

<a id="driftholm-anchors"></a>
### Named anchors

`w:landing` (−100, 80) · `w:shelter` (−40, −10) · `w:tally` (−30, −35), facing 180° · `w:scrapBeacon` (−40, 10) ·
`w:spiralDoor` (73, −20) · `w:spiralArch` (95, −20), y 100 · `w:spiralArch.top` y 124 · `w:longFall` (10, −135) ·
`w:puffTree` (60, 70) · `sky:ground` (the ground card's centre, for looking down at home).

<a id="driftholm-pois"></a>
### Points of interest

Target: 70,000 / 1,250 = **56**. Budget: chests 8 · keepsakes 4 · acorns 6 · vistas 2 · Hollow door 1 · dungeon door
1 · benches 4 · the Stair Landing 1 · NPC spots 6 · fish spot 1 · Dash start 1 · Tally notes 10 (ss-45) · the Nimble
Fold and 6 stray Nimbles (ss-46) · bounce clouds 2 · glide ledges 2 · cloud mote routes 3 · hookbloom 1 · thornglass 2
· landmarks 4 · curios 10 · **total 77**.

**Chests** (`driftholm:c01` … `c08`, 30 gems each):

| id | Anchor | Gate | Note |
|---|---|---|---|
| c01 | (−50, −5) | - | by the shelter, a crate chest Mote has labelled "FOR VISITORS (nobody yet)" |
| c02 | (15, −132), y 56 | - | a ledge behind the Long Fall's curtain |
| c03 | (−175, −110) | - | Brookstone, at the stepping stones' far end |
| c04 | (40, −185) | - | Hushstone, past the Hanging Roots |
| c05 | (60, 70), y 72 | - | in the Puff Tree's cloud canopy (the bounce cloud at its foot) |
| c06 | (135, 120) | - | Puffholm |
| c07 | (−125, 160) | Leaf Glider | the Lookout |
| c08 | (175, −105) | Leaf Glider from the plateau (after `act3done`), or Cloudstep motes | Kiteknoll |

**Sleeping Acorns** (`driftholm:acorn-1` … `6`): (−70, 40) the meadow · (−20, −90) by the spring pond · (−160, −95)
Brookstone · (80, 40) Nimble Downs · (−115, 145) the Lookout · (60, −40) the foot of Arch Rise.

**Vistas**: `driftholm:vista-below` "The Wide Blue from Above" on the Lookout (−120, 155): home's Great Tree tiny on
the ground card, the four near isles round it · `driftholm:vista-fall` "The Long Fall" on Brookstone's east lip
(−140, −110), facing the falls.

**Doors**: `spiral_door` (73, −20), y 64, a spiral-carved door in the spire's west foot → d10 the Spiral Stair
([dungeons.md#d10](./dungeons.md#d10)); its last room and the chase end on the plateau · `hollow_driftholm_cloud`
(45, −180), Hushstone's broken arch.

**Fish spot**: the spring pond (10, −80), "cloud fish".

**Side-story marks**: ss-45 Mote's Tally: ten `[E] Read · Tally note` points along the Tally Wall, x −37 to −23 at
1.5 m spacing, z −34, y 61 (texts in [side-content.md#ss-45](./side-content.md#ss-45)) · ss-46 Nimble Herding: the
**Nimble Fold**, a ring of cloud hedges at (70, 50), r 10, and six strays at Brookstone (−170, −100), Hushstone
(45, −165), Puffholm (125, 105), the Lookout (−118, 155), the spring pond (5, −85), the foot of Arch Rise (70, −45).

**Gate finds**: bounce clouds at the Lookout (−115, 145) (back up to the main isle) and the Puff Tree's foot (60, 62)
(up to c05) · glide ledges: the Lookout's launch (−100, 120) and the plateau's north-east edge (105, −32) · cloud
mote routes (Cloudstep): the Long Fall's lip up to Rainbow Rock's top (curio 9), Kiteknoll back to the main isle, the
Lookout back up · a hookbloom on Rainbow Rock's crown (an early way up, Hook).

**Driftholm Dash** (S-267, the tenth and last course): the Stair Landing (−90, 82) → the meadow (−25, 20) → past the
Puff Tree (50, 60) → the plank bridge → finish on Puffholm (130, 110). About 300 m.

**Thornglass**: (−90, −40) · (100, 60).

**Scrap lamps**: one hundred `driftholm_scrap_lamp` props in a 55 m radius round (−40, 0), min spacing 3 m, never on
the path; recipe stage, not finds. Each is made of found things (a thimble, a snail shell, a cracked bottle, a
teacup); they glow softly every night.

<a id="driftholm-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `driftholm:k-jar` | the Scrap Beacon, east side (−32, 10) | "Something buzzing" · Jar with one firefly |
| `driftholm:k-boat` | Rainbow Rock, behind it (35, −135) | "Something papery" · Paper boat |
| `driftholm:k-whistle` | the Puff Tree, north side (60, 58) | "Something fluffy" · Little brass whistle |
| `driftholm:k-pebble` | the Spiral Arch, back step on the plateau (100, −28), y 100 | "Something scratched" · Tally pebble |

- **Jar with one firefly.** "A jam jar behind the Scrap Beacon with a single firefly inside, and the lid left loose so
  it can leave whenever it likes." / "The label says 'FORTY-TWO'. The firefly seems to like it here. It has not left."
- **Paper boat.** "A folded paper boat caught in a crack behind Rainbow Rock, soaked and dried many times." /
  "Written on its sail, very small: 'To Wenna. Floating down. Love, M.' It never got past the edge."
- **Little brass whistle.** "A little brass whistle in the Puff Tree's roots, stamped with a spiral." / "It toots
  exactly like a Nimble. The Nimbles toot back at it, politely, every time."
- **Tally pebble.** "A pebble on the arch's back step, scratched with a hundred tiny tallies in a spiral." / "Under
  it, a scrap of cloth: 'Every day I come up here and look down. She is always there. That helps.'"

**Fifth line**: "✿ Driftholm's keepsakes: for a hundred years someone up here counted, saved, wrote and waited, and
never once forgot which way was down."

<a id="driftholm-curios"></a>
### Curios

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · Scrap lamp | (−55, 15) | "A lamp made from a teacup, a thimble and a lot of patience. It is not bright. It is trying very hard." |
| 2 | Look · Shelter | (−38, −6) | "Sailcloth patches sewn with star-thread over a broken Lamplighter lamp frame. Small, tidy, lonely." |
| 3 | Look · Moon-puddle jar | (−48, −15) | "A jar of puddle water with the moon in it. In daylight it is just a jar of water. At night it isn't." |
| 4 | Look · Spark tin | (−44, 2) | "A biscuit tin of sparks, carefully sorted by size. The smallest are labelled 'babies'." |
| 5 | Look · Looking spot | (−105, 95) | "A flat stone at the edge, worn smooth, facing down toward the Wide Blue. Someone sat here a lot." |
| 6 | Look · Broken arch | (−20, 40) | "Half of a spiral arch, the other half long gone over the edge. The spiral still points the way home." |
| 7 | Look · Stepping stones | (−150, −95) | "The stepping stones float, bob, and wait for you. They have very good manners for rocks." |
| 8 | Look · Cloud edge | (60, −90) | "The clouds below are so thick you could bounce on them. You can. Please don't do it on purpose." |
| 9 | Look · Rainbow Rock | (25, −125), y 68 | "Spray from the Long Fall paints a rainbow on this rock every sunny afternoon. It never misses a day." |
| 10 | Look · Nimble nap | (95, 85) | "A Nimble asleep in the grass, going 'toot... toot...' very softly. Do not wake it. It is perfect." |

<a id="driftholm-enemies"></a>
### Enemies

| Region | Rolled | Placed | max |
|---|---|---|---|
| Mote's Meadow | none (town) | - | 0 |
| The Falls | `gust_kite 3, nimbus_puff 2` | - | 5 |
| Nimble Downs | `nimbus_puff 3` | - | 4 |
| Arch Rise | `gust_kite 3, nimbus_puff 3` | - | 6 |

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables). No spawn within 12 m of a cliff edge (a push near
an edge is never used against Pip), on a stepping stone, on a bridge, or within 12 m of the meadow.

<a id="driftholm-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `driftholm.mote` | (−42, −14) | Mote at his shelter on arrival in ch18 (then the scene sends him to the Spiral Stair); empty after `act3done` |
| `driftholm.elder` | (58, 66) | an elder Nimble under the Puff Tree (cast.md#the-nimbles) |
| `driftholm.nimble-1` … `4` | (75, 45), (90, 70), (110, 90), (65, 95) | Nimbles in Nimble Downs, wandering within 12 m |

After `act3done` the shelter door holds a note (`[E] Read · Note`); its text is in
[story.md#ch18](./story.md#ch18).

<a id="driftholm-interiors"></a>
### Interiors

None. Mote's shelter is open-sided; it is dressing, read through curios 2-4 and the Tally Wall.

<a id="driftholm-states"></a>
### World states

| Condition | Change |
|---|---|
| `ch18` arrival | Mote at the shelter; the scrap lamps lit even by day ("he never turns them off") |
| `act3done` | the Outer Stair unfurls round the spire (40 steps, one every 0.1 s, within 10 s of the card); the Spiral Arch's carving glows `#ffe9a8`; Mote's shelter is empty and the note appears; the scrap lamps glow only at night |
| ss-46 done | the six strays sleep in the Fold; all Nimbles toot when Pip passes |
| `mainEnding` | the scrap lamps glow gold every night; Mote's new star hangs directly above the Spiral Arch |

<a id="driftholm-music"></a>
### Music and ambience

Track `driftholm` ([art-audio.md#driftholm](./art-audio.md#driftholm)): an airy harp in E♭ Lydian, 80 bpm, a breathy
flute pad. Layers: `meadow` adds a toy music box playing **Mote's counting motif** (four notes rising, then the
same four again a step higher: one-two-three-four), `falls` adds harp glissandi and water, `downs` adds soft woodwind
"toots" answering the harp, `arch` adds a wordless choir hum that the Starmeadow's track picks up. Ambience: `breeze`,
`falls`, the scrap lamps' faint tinkling.

<a id="driftholm-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (15 of 24): `driftholm_scrap_lamp`, `driftholm_cloud_hedge`, `driftholm_stepping_stone`,
`driftholm_bounce`, `driftholm_lilac`, `driftholm_pillar`, `driftholm_roots`, `driftholm_cloud_puff`,
`driftholm_bridge`, plus shared: bench, Hollow door, vista post, hookbloom, cloud mote, thornglass. Single meshes:
the Spiral Arch, the Arch Rise spire, the shelter, the Tally Wall decal, the Scrap Beacon, the Puff Tree, the Long
Fall, the isle underside, the ground card. New materials (6 of 12): lilac grass, cloud (soft, rim-lit), floating
stone, waterfall sheet, ground card (fog-exempt), star-thread (emissive stitch).

> **`driftholm_spiral_arch`** · the ruined stone arch from the painted sky isle: two curved legs meeting in a
> keystone, a deep spiral carved across the face, cracks and lilac vines, standing on a round plateau · **24 m**
> high, 14 m span · stone `#d9cfe6`, spiral `#ffe9a8` (glows after `act3done`), vines `#c9b6ec` · floating stone ·
> 900 / 6 k · after `act3done` the spiral's glow travels inward over 4 s, loop · **Fallback:** two box legs and a
> half-torus top with an emissive spiral decal · **Image:** PREAMBLE + "a tall ruined stone arch carved with a big
> spiral, on a little floating rock plateau above the clouds, lilac vines, soft golden light in the spiral" (and the
> shipped `sky_isle` painting is its reference, read-only) · **3D:** "toon ruined stone arch 24 m with spiral carving,
> emissive spiral".

> **`driftholm_spire`** · Arch Rise: a tall rounded rock pillar, pale and layered, roots and lilac in its cracks, a
> spiral door at the foot, the plateau on top; after `act3done` a spiral of floating steps round it · **36 m**
> (y 64 → 100), r 22 at the base, 16 at the top · `#d9cfe6`, `#b8a6d0`, moss `#9bb87a` · floating stone · 1,200 /
> 8 k · the Outer Stair's steps rise one by one · **Fallback:** a tapered cylinder with box steps.

> **`driftholm_shelter`** · a small lean-to of mismatched sailcloth patches, stitched with glowing thread, over the
> bent frame of a big old Lamplighter lamp; a cushion, a teacup, a stack of jars · 4 × 3 × 2.5 m · patches `#f3e3c3`,
> `#c9b6ec`, `#8ec9d8`, `#ff9f8f`; thread `#ffe9a8` · canvas + star-thread · 500 / 3 k · patches flutter ·
> **Fallback:** a tilted quad roof on a half-torus frame · **Image:** PREAMBLE + "a tiny patched sailcloth shelter on a
> floating meadow, stitched with glowing star thread over the frame of an old brass lamp, jars of fireflies around it,
> tender and a little lonely" · **3D:** "toon patchwork lean-to shelter 4 m over a lamp frame".

> **`driftholm_tally`** · the Tally Wall: a 14 × 3 m pale rock face covered in tally marks in bundles of five, in
> lines and spirals, with ten little scratched notes · decal sheet 2048 × 512 (generated, alpha) on a rock mesh ·
> marks `#5a4a70` on `#d9cfe6` · decal · 2 + rock 200 · static · **Fallback:** a canvas texture drawing rows of
> five-bar tallies procedurally (the count is the point, not the art) · **Image:** PREAMBLE + "a pale rock wall
> covered edge to edge in neat hand-scratched tally marks in bundles of five, some lines curling into spirals, ten
> tiny scratched notes between them, flat front view, 4:1".

> **`driftholm_scrap_beacon`** · a crooked pole of lashed driftwood with scrap lamps tied all the way up, a big
> jam-jar lamp at the top · **9 m** · wood `#8a6a4a`, lamps `#ffe9a8`, `#ff9f8f`, `#8ec9d8` · lamp glass · 500 / 3 k
> · the lamps twinkle out of step · **Fallback:** a cylinder pole with 12 emissive spheres.

> **`driftholm_scrap_lamp`** · a little lamp made of found things: four variants on one mesh atlas (teacup, thimble
> cluster, snail shell, cracked bottle), each with a soft light inside · 0.3-0.6 m · glass `#ffe9a8`, bodies `#f3e3c3`
> / `#c9b6ec` / `#b8894a` · lamp glass · 40 each / 200 · `nightGlow`; gold after `mainEnding` · **Fallback:** an
> emissive sphere on a cylinder · **Image:** PREAMBLE + "four tiny handmade lamps made from a teacup, thimbles, a snail
> shell and a cracked bottle, each glowing softly, isolated".

> **`driftholm_puff_tree`** · a smooth pale trunk with a round canopy that is a cloud, sometimes drifting a little off
> the branches and back · **14 m** · trunk `#e8dcc8`, canopy `#f7f2ff`, shade `#c9b6ec` · cloud + toon bark · 700 /
> 4 k · canopy bobs ±0.4 m over 8 s · **Fallback:** a cylinder trunk with clustered spheres in the cloud material.

> **`driftholm_long_fall`** · a waterfall sheet 6 m wide pouring 60 m off the edge into cloud, a mist billboard at
> the lip, a rainbow decal on Rainbow Rock in sunny afternoons · waterfall sheet (uv scroll) · **Fallback:** a scrolling
> semi-transparent plane · **Image:** PREAMBLE + "a waterfall pouring off the edge of a floating island into soft
> clouds far below, a rainbow in the spray".

> **`driftholm_ground`** · the ground card: the Wide Blue seen from very high: home island in the middle with the
> Great Tree, four near isles at their bearings, a pale green band to the south, wisps of cloud · 2048 × 2048 painted,
> fog-exempt · **Fallback:** a canvas disc in sea blue with five green blobs and a tiny dark tree · **Image:** PREAMBLE
> + "looking straight down from very high above a turquoise sea: a small round island with a great tree at its
> centre, four smaller islands around it, a pale green band of shallows to the south, thin clouds drifting, painterly
> map-like view".

> **`driftholm_cloud_hedge`**, **`driftholm_stepping_stone`**, **`driftholm_bounce`**, **`driftholm_lilac`**,
> **`driftholm_pillar`**, **`driftholm_roots`**, **`driftholm_cloud_puff`**, **`driftholm_bridge`** · a waist-high
> hedge of cloud (2 m, 80 tris), a flat floating stone with roots trailing (r 1.5 m, 80 tris, bobs ±0.1 m), a round
> cushion cloud that launches Pip 9 m up (2.5 m, 120 tris, squashes on use), lilac flower clumps (0.6 m, 40 tris), a
> broken spiral-carved pillar (3 m, 100 tris), hanging roots under ledges (4 m, 60 tris, sway), a cloud floor puff
> billboard (20-40 m), and the bridge decks (the Hanging Roots: woven roots; the plank bridge: planks and rope; 3 m
> wide). **Fallback:** spheres, discs, cylinders and quads. **Image:** one sheet, PREAMBLE + "floating sky island
> props: cloud hedges, floating stepping stones with trailing roots, a cushion cloud, lilac flowers, a broken
> spiral pillar, hanging roots, a woven root bridge, isolated".

<a id="driftholm-coverage"></a>
### Coverage proof

12 × 12 cells of 40 m (last 8 m ignored). Land cells (≥ 200 m²): **expected 48-58**. Cells most at risk: the
main isle's southern rim between the Stair Landing and the plank bridge (the Dash route, curio 5, acorn 1) and the
islets' single cells (each holds a chest or a stray Nimble). Arch Rise's plateau cell counts only after `act3done`;
the test runs the post-`act3done` state as well.

<a id="driftholm-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-262 | Shape and recipe, islets and links, falling rule, cloud floor, regions; prints |
| S-263 | Spiral Arch (portal inert), spire, shelter, Tally Wall, Scrap Beacon, scrap lamps, Puff Tree, the Long Fall; ART BRIEFs |
| S-264 | the climb portal from home and the Stair Landing's return |
| S-265 | terrain layers, ground card, loading card, map art (`ui_chart_above`), track `driftholm` |
| S-266 | Nimble spots, enemy tables |
| S-267 | chests, keepsakes, acorns, vistas, the Hollow door, benches, curios, Tally notes, the Fold and strays, the Dash; coverage |
| S-268 | cloud mote routes |
| S-269-S-271 | `spiral_door`; the plateau as the chase's end |
| S-272 | the `act3done` state, the Outer Stair, the shelter note; unhide |

---
<a id="starmeadow"></a>
## The Starmeadow

The Lantern Sky's lowest meadow: twelve cloud isles under a deep blue night that never ends, joined by bridges of
stars that hold Pip up because he has the Cloudstep. The Starkin live here, dim and shy since they cannot come down
without going heavy; Old Mother Brightwell rests in a crescent cradle of cloud; and in the north-east, Mote's Ladder
of Lights hangs from his windlass, wound from every borrowed beacon, and runs down through a hole in the clouds into
Wenna's crown. Chapter 19 happens here (given light, twist T6), and chapter 20 starts at the Ladder.

<a id="starmeadow-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `starmeadow` · overworld, sky |
| Grid · seed · land | 640 m · 40289 · 0.10 km² |
| Recipe | `js/realms/recipes/islands.js` (`islands`) |
| Palette | night `#141a3a`, star `#ffe9a8`, haze `#8fa8ff`; cloud tops `#d8dcf5` with `#8fa8ff` shade; fog `#1c2450` near 120 m, far 300 m |
| Light | always night (`light.tod` frozen at 23:30); a large soft moon low in the south-west, stars as big as coins; isles lit by glow materials; a cool hemisphere `#8fa8ff` / `#141a3a` at 0.6 |
| Unlock · connection | `act3done`; `[E] Enter · the Spiral Arch` on Driftholm's plateau; `hidden: true` until S-278 |
| Hours | ch19 ≈ 1.5 h; full exploration ≈ 1 h; the Ladder (d11) is counted in Act IV's 5.5 h |
| Built by | S-274 recipe, S-275 props and look, S-276 the Starkin, S-277 enemies, S-278 ch19 and finds (unhide), S-280 the Ladder's door |

<a id="starmeadow-shape"></a>
### Shape and recipe

| Piece | Numbers |
|---|---|
| Cloud isles | twelve, each a soft rounded cloud-top blob (radial noise ±12 %, 6 lobes) with a flat-ish walkable top (amp 1.5 m, wavelength 25 m) and a billowing cloud underside mesh; listed below |
| **Constellation bridges** | eleven bridge decks 2.5 m wide made of star nodes (one every 6 m) joined by light strips; each slopes evenly between its two isles' rims. They exist only while Pip has `cloudstep` (he always does here; the rule keeps the solver honest). Stepping on a node plays a soft bell note |
| Below | a cloud sea at y −30 (instanced billboards); falling below y −20: "Boing! The clouds bounce Pip back." to the last safe ledge, no damage |
| Sky | star dome with the Starkin's four constellations drawn in brighter stars over their isles (the Snail, the Sleepy Cat, the Teapot, the Long Worm); Driftholm a lilac shape far below to the south-west (a sky card); after `act2done` home's sky shows the Ladder as `sky:ladder`; here the Ladder is real |
| **The Ladder of Lights** | hangs from Mote's windlass on Windlass Isle (170, −150): a rope ladder of light 3 m wide, rungs every 0.8 m, rising 80 m above the isle into the dark and running down through a cloud hole (r 6) beside the isle. Within 250 m it is a mesh; beyond, the `sky:ladder` billboard draws it (the 300 m far plane would otherwise clip it), crossfading over 230-260 m |

**Isles** (centre, radius, top y, region):

| # | Isle · id | Centre | r | Top y | Region | Holds |
|---|---|---|---|---|---|---|
| 1 | **Arch Gate** · `archgate` | (−230, 220) | 50 | 0 | Lower Lanterns | the arrival arch (a 12 m twin of the Spiral Arch), 3 star lanterns |
| 2 | **Lanternfold** · `lanternfold` | (−130, 110) | 68 | 6 | Lower Lanterns | the Lantern Stack, 6 star lanterns |
| 3 | **Dimwhistle** · `dimwhistle` | (−265, 60) | 42 | 10 | Lower Lanterns | 3 star lanterns, a Starkin nest |
| 4 | **the Snail** · `snail` | (−20, 50) | 37 | 14 | Constellation Bridges | the Snail's head star |
| 5 | **the Sleepy Cat** · `cat` | (60, −40) | 40 | 18 | Constellation Bridges | the Starwell |
| 6 | **the Teapot** · `teapot` | (150, 40) | 35 | 16 | Constellation Bridges | a cloud "spout" climbed by cloud motes |
| 7 | **the Long Worm** · `worm` | (20, 160) | 37 | 12 | Constellation Bridges | a star door (Sunglass) |
| 8 | **Brightwell's Rest** · `rest` | (−130, −140) | 87 | 22 | Brightwell's Rest | the Cradle, Old Mother Brightwell |
| 9 | **Hushnest** · `hushnest` | (−260, −230) | 45 | 20 | Brightwell's Rest | the Starkin nests |
| 10 | **Twinkle Steps** · `steps` | (0, −190) | 45 | 26 | Brightwell's Rest | terraced cloud steps where the Twinklings play |
| 11 | **Windlass Isle** · `windlass` | (170, −150) | 62 | 30 | The Ladder Foot | Mote's windlass, the Ladder |
| 12 | **Far Lantern** · `farlantern` | (265, −250) | 42 | 36 | The Ladder Foot | the last lantern, a vista |

**Bridges**: Arch Gate–Lanternfold (31 m) · Dimwhistle–Lanternfold (34 m) · Lanternfold–Snail (20 m) · Snail–Sleepy
Cat (43 m) · Snail–Long Worm (43 m) · Sleepy Cat–Teapot (45 m) · Sleepy Cat–Twinkle Steps (76 m) · Twinkle
Steps–Brightwell's Rest (7 m) · Brightwell's Rest–Hushnest (26 m) · Sleepy Cat–Windlass Isle (53 m) · Windlass
Isle–Far Lantern (34 m). Every isle is reachable; the solver proves it with `cloudstep` and with no other Act III tool.

Land: the isles' tops sum to ≈ 0.10 km² (the realm test asserts 0.09-0.11; bridges are not counted).

<a id="starmeadow-regions"></a>
### Regions

CANON names the regions without subtitles; these are decided here.

| id | Card | Isles | Landmark (anchor, height) | Entry | `REGIONS` row |
|---|---|---|---|---|---|
| `lowerlanterns` | **The Lower Lanterns** / "Waiting to be lit" | 1-3 | **the Lantern Stack** (−130, 110), 16 m: a tower of dim star lanterns | the arrival arch (−225, 205) | music `starmeadow`, layer `lanterns`; ambient `starhum`; enemies per creatures.md |
| `bridges` | **Constellation Bridges** / "Step on the stars" | 4-7 | **the Starwell** (60, −40), a 12 m ring of light standing on the Sleepy Cat | the Lanternfold–Snail bridge | layer `bridges` |
| `rest` | **Brightwell's Rest** / "Speak softly" | 8-10 | **the Cradle** (−130, −140), a 15 m crescent of cloud with Old Mother Brightwell in it | the Twinkle Steps bridge | layer `rest`; enemies []; max 0 (safe, creatures.md) |
| `ladderfoot` | **The Ladder Foot** / "Hold on tight" | 11-12 | **the Ladder of Lights** and the windlass (170, −150) | the Sleepy Cat–Windlass bridge | layer `ladder` |

<a id="starmeadow-arrival"></a>
### Arrival, benches and ways out

| Thing | id | Anchor | Notes |
|---|---|---|---|
| Spawn | `arch` | (−225, 205), facing 45° | the Lantern Stack ahead, the Ladder's light far off to the right |
| The arrival arch | `starmeadow:arch` | (−235, 225) | `[E] Enter · the Spiral Arch` → Driftholm `arch` |
| The Ladder | `ladder_top` | (180, −140), y 30 | `[E] Climb · the Ladder of Lights` → d11 ([dungeons.md#d11](./dungeons.md#d11)); from `ch19` |
| Benches | `starmeadow:bench-arch` (−215, 195) · `-snail` (−10, 45) · `-rest` (−110, −120) · `-windlass` (150, −130) | | four |
| Root-gate | none | | |

<a id="starmeadow-anchors"></a>
### Named anchors

`w:arrivalArch` (−235, 225) · `w:lanternStack` (−130, 110) · `w:starwell` (60, −40) · `w:cradle` (−130, −140),
`w:brightwell` (−130, −146), y 26 (her face) · `w:windlass` (170, −150) · `w:ladderTop` (180, −140), y 30 ·
`w:ladder.high` (180, −140), y 110 · `w:cloudHole` (190, −160) · `sky:driftholm`.

<a id="starmeadow-pois"></a>
### Points of interest

Target: 100,000 / 1,250 = **80**. Budget: chests 10 · keepsakes 4 · acorns 6 · vistas 2 · benches 4 · the arrival
arch 1 · the Ladder door 1 · NPC spots 12 · star lanterns 12 · constellation heads 4 · cloud mote routes 4 · Sunglass
receivers 4 · thornglass 2 · landmarks 4 · curios 14 · **total 84**.

**Chests** (`starmeadow:c01` … `c10`, 30 gems each):

| id | Anchor | Gate | Note |
|---|---|---|---|
| c01 | (−245, 235) | - | behind the arrival arch |
| c02 | (−130, 125) | Lantern | the Lantern Stack's foot: opens when all 12 star lanterns are kindled |
| c03 | (−275, 50) | - | Dimwhistle's far rim |
| c04 | (−35, 65) | - | the Snail's coil |
| c05 | (25, 175) | Sunglass | the Long Worm's star door (beam its receiver) |
| c06 | (160, 50), y 26 | Cloudstep | the top of the Teapot's cloud spout, by cloud motes |
| c07 | (−265, −235) | - | Hushnest, among the nests (the Starkin there are asleep; tiptoe) |
| c08 | (0, −205), y 34 | Thistle Hook | Twinkle Steps' top cloud |
| c09 | (190, −165) | - | Windlass Isle, past the turrets |
| c10 | (270, −260) | Ember Sling | Far Lantern: ring the bell target hung on the last lantern |

**Sleeping Acorns** (`starmeadow:acorn-1` … `6`; acorns that sneezed too high and were caught by Starkin): (−210, 240)
Arch Gate · (−150, 90) Lanternfold · (70, −25) the Sleepy Cat · (−160, −160) Brightwell's Rest · (135, 30) the
Teapot · (255, −240) Far Lantern.

**Vistas**: `starmeadow:vista-below` "Everything Below" at the Starwell's rim (60, −55): looking down through the
ring at the Wide Blue (the ground card again, smaller, with Driftholm's shape in the foreground) ·
`starmeadow:vista-ladder` "The Ladder of Lights" on Far Lantern's top (265, −250), y 44 (cloud motes).

**Star lanterns** (`starmeadow:lantern-1` … `12`, `Kindle · Lantern`): Arch Gate (−220, 200), (−240, 210),
(−205, 230) · Lanternfold (−110, 95), (−150, 95), (−100, 130), (−160, 130), (−125, 80), (−135, 145) · Dimwhistle
(−255, 45), (−280, 75), (−250, 75). Each lit lantern wakes one Starkin who drifts out and stays near it. Optional;
[story.md#ch19](./story.md#ch19) may point at them.

**Gate finds**: constellation heads (a bright star node on each of isles 4-7; `Look` shows the constellation drawn in
the sky) · cloud mote routes: the Teapot's spout (c06), the Teapot → Windlass Isle shortcut, the Long Worm's tail loop,
Far Lantern's top (the vista) · Sunglass receivers: the Long Worm's star door, the Lantern Stack's crown (lights it
fully once c02 is open), the Starwell's ring (brightens it), the windlass's brake (a curio).

**Thornglass**: (−20, 30) on the Snail · (−270, −215) Hushnest.

<a id="starmeadow-keepsakes"></a>
### Keepsakes

| id | Landmark · anchor | Label · name |
|---|---|---|
| `starmeadow:k-trimmer` | the Lantern Stack, south side (−130, 95) | "Something bright" · Wick trimmers |
| `starmeadow:k-spectacles` | the Starwell, back of the ring (60, −58) | "Something shiny" · Little round spectacles |
| `starmeadow:k-cap` | the Cradle, behind it (−130, −165) | "Something knitted" · Star-shaped cap |
| `starmeadow:k-spool` | the windlass, back side (190, −135) | "Something wound" · Spool of thread |

- **Wick trimmers.** "A tiny pair of wick-trimming scissors behind the Lantern Stack, bright as new." / "Engraved:
  'For the Starkin's lanterns. With love from the Lamplighters, who could reach them once.'"
- **Little round spectacles.** "A pair of little round spectacles on the Starwell's rim, lenses polished with
  stardust." / "The Starkin lend them to each other for looking down. Through them, Sprout Village's bunting is clear
  as anything."
- **Star-shaped cap.** "A knitted cap in the shape of a star, far too small for anyone here, tucked behind the
  Cradle." / "Old Mother Brightwell knitted it for the littlest one, a very long time ago. It was never needed. She
  kept it anyway."
- **Spool of thread.** "A spool of plain cotton thread behind the windlass, almost used up." / "Mote's handwriting
  on the label: 'Enough for one more rung. Then I'll ask her again.'"

**Fifth line**: "✿ The Starmeadow's keepsakes: the stars kept scissors, spectacles, a little hat and a lot of hope.
They missed her too."

<a id="starmeadow-curios"></a>
### Curios

| # | Pill | Anchor | Line |
|---|---|---|---|
| 1 | Look · Arrival arch | (−232, 215) | "The same spiral as on Driftholm's arch, but smaller, and facing the other way. Coming and going." |
| 2 | Look · Dim lantern | (−118, 118) | "A star lantern, cold and grey. Something inside it is fast asleep and would like to be asked nicely." |
| 3 | Look · Starkin nest | (−262, 68) | "A round nest of cloud, still warm. A Starkin slept here and left a little glow in the shape of itself." |
| 4 | Look · Star node | (−75, 80) | "Each star in the bridge hums its own note. Walk quickly and they play a tune. Walk slowly and it's a lullaby." |
| 5 | Look · Snail's head | (−20, 40) | "The Snail. The Starkin named it after a snail they watched cross a garden wall. It took all summer." |
| 6 | Look · Sleepy Cat | (55, −30) | "The Sleepy Cat. 'An old cat on a windowsill,' a Starkin explains. 'She never once looked up. We loved her.'" |
| 7 | Look · Teapot | (145, 35) | "The Teapot. Drawn from a steaming hill shaped like one. 'We could smell the toast from here,' they say." |
| 8 | Look · Long Worm | (15, 150) | "The Long Worm. 'Someone very long and very polite lives under the sea. We drew him so he'd have a picture.'" |
| 9 | Look · The Starwell | (60, −30) | "A ring of light standing on its edge. Look through it and the sky is underneath you. Hold on to something." |
| 10 | Look · Cradle | (−120, −130) | "A crescent of cloud, soft as a pillow. Old Mother Brightwell fills most of it. She is humming." |
| 11 | Look · Twinkle Steps | (−10, −175) | "Cloud steps, each a little higher. Three small lights are playing hop-and-giggle on them." |
| 12 | Look · Windlass | (165, −140) | "A huge spool wound with ribbons of borrowed light: gold, green, sea-blue, wheat-yellow. They all want to go home." |
| 13 | Look · Brake lever | (176, −158) | "A brake on the windlass, tied down with a hair ribbon and a knot that says 'please don't'." |
| 14 | Look · Cloud hole | (192, −166) | "Through the hole in the clouds the Ladder runs down and down, and at the bottom, very small, are blossoms." |

<a id="starmeadow-enemies"></a>
### Enemies

| Region | Rolled | Placed | max |
|---|---|---|---|
| The Lower Lanterns | `stardust_sprite 3, wisp_lantern 2` | - | 6 |
| Constellation Bridges | `comet_pup 3, stardust_sprite 2` | `moonbeam_turret` × 6 | 6 |
| Brightwell's Rest | none (safe) | - | 0 |
| The Ladder Foot | `comet_pup 2, wisp_lantern 3` | `moonbeam_turret` × 4 | 6 |

Copied from [creatures.md#spawn-tables](./creatures.md#spawn-tables); `wisp_lantern` always (it is always night).
Spawns only on isle tops, never on a bridge or within 10 m of a bridge end (no push off a bridge). Moonbeam Turret
anchors: the Snail (−5, 70), (−40, 30) · the Sleepy Cat (80, −60), (40, −20) · the Teapot (165, 25) · the Long Worm
(40, 165) · Windlass Isle (150, −175), (200, −130), (140, −120) · Far Lantern (250, −235). Each sweeps a stripe
across its isle's top, never across a bridge.

<a id="starmeadow-people"></a>
### People and spots

| Spot id | Anchor | Who and when |
|---|---|---|
| `starmeadow.brightwell` | (−130, −146), y 22 | Old Mother Brightwell in the Cradle, always ([cast.md#old-mother-brightwell](./cast.md#old-mother-brightwell)); `talkAt` 3.5 m in front of her face |
| `starmeadow.twinkling-1` … `3` | (−110, −115), (−105, −125), (−115, −110) | the Twinklings' home spots; during Act IV they walk ahead of Pip as helpers (F27) ([cast.md#the-twinklings](./cast.md#the-twinklings)) |
| `starmeadow.starkin-1` … `8` | Hushnest (−250, −220), (−270, −240), (−245, −245); Twinkle Steps (10, −185), (−15, −200); Lanternfold (−120, 100), (−140, 120); Dimwhistle (−262, 62) | Starkin (dim and still until the lantern near them is kindled, or until `mainEnding`) |
| `starmeadow.mote` | (−115, −150), y 22 | Mote beside Brightwell after `mainEnding` (he is home; he visits home on the Hundred-Year Night) |
| `starmeadow.littlestar` | (5, −200) | the shy fourth Twinkling for ss-48 after `mainEnding` ([side-content.md#ss-48](./side-content.md#ss-48)) |

<a id="starmeadow-interiors"></a>
### Interiors

None.

<a id="starmeadow-states"></a>
### World states

| Condition | Change |
|---|---|
| `ch19` arrival | the Starkin are dim and hidden in nests; the windlass creaks every 6 s as the Ladder pulls; the Ladder's lights flicker in the borrowed colours |
| each star lantern kindled | its Starkin drifts out and brightens |
| `ch19` (given light told) | the Twinklings light and leave the Cradle with Pip; the Ladder door opens |
| `freed:<isle>` (ch20) | that colour's ribbon unwinds from the windlass and a streak of that colour crosses the sky toward its isle |
| `mainEnding` | the Ladder of Lights is gone and the windlass stands still and empty; every Starkin is lit; Mote is at the Cradle; the cloud hole closes into a ring of blossom-pink cloud |

<a id="starmeadow-music"></a>
### Music and ambience

Track `starmeadow` ([art-audio.md#starmeadow](./art-audio.md#starmeadow)): a music box and a wordless choir hum in C,
66 bpm, celesta sparkles, the Driftholm choir picked up. Layers: `lanterns` (music box alone, slow), `bridges`
(the bridge nodes' bell notes are pentatonic in C and always in key with the track), `rest` (a lullaby variant, the
choir swelling: Brightwell's lullaby), `ladder` (the music box detuned a quarter tone and pulling, a low string drone;
it resolves after `mainEnding`). Ambience: `starhum` (a soft chord that breathes), the windlass creak.

<a id="starmeadow-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (14 of 24): `starmeadow_lantern`, `starmeadow_node`, `starmeadow_nest`, `starmeadow_cloud_step`,
`starmeadow_starflower`, `starmeadow_cloud_puff`, `starmeadow_isle_under`, plus shared: bench, vista post, hookbloom,
cloud mote, receiver, bell target, thornglass. The arrival arch reuses `driftholm_spiral_arch` at 0.5 scale. Single
meshes: the Lantern Stack, the Starwell, the Cradle, the windlass, the Ladder of Lights. New materials (6 of 12):
night cloud (rim-lit), star glass, light strip (additive), Starkin glow (shared with cast.md's `starkin` rig), ribbon
light (animated hue), star dome.

> **`starmeadow_ladder`** · a rope ladder made of light: two long glowing ribbons with rungs every 0.8 m, each rung a
> bead of a different borrowed colour (Duskwick gold `#f2b45a`, Pinewhistle green `#8fae9a`, Archwater sea-blue
> `#7fd3d0`, Threemills wheat `#e7c45a`), hanging from the windlass up into the dark and down through the cloud hole
> · 3 m wide, 80 m up + 40 m visible down · additive ribbon light · 2 strips + instanced rungs (≈ 150 rungs, 1 call)
> · rungs shimmer; the whole ladder sways 0.5° over 10 s; tension pulse every 6 s (with the creak) · **Fallback:** two
> emissive planes and instanced emissive boxes · **Image:** PREAMBLE + "a long rope ladder made entirely of soft glowing
> light hanging in a deep blue starry sky above clouds, each rung a different warm colour" (also the `sky:ladder`
> billboard source, 512 × 2048, alpha) · **3D:** "toon light ladder, two glowing ribbons with coloured bead rungs".

> **`starmeadow_windlass`** · a big wooden windlass with a star-iron frame and a spool wound with ribbons of light,
> a crank handle, a brake lever tied with a hair ribbon · 8 × 5 × 6 m · wood `#8a6a4a`, frame `#8fa8ff`, ribbons in
> the four borrowed colours · toon wood + ribbon light · 900 / 6 k · spool creaks a few degrees on the tension pulse;
> ribbons unwind per `freed:*` · **Fallback:** a cylinder spool on box trestles · **Image:** PREAMBLE + "a large wooden
> windlass on a cloud island at night, its spool wound with ribbons of glowing coloured light, a crank, a brake tied
> with a ribbon".

> **`starmeadow_lantern_stack`** · a tower of round star lanterns stacked like paper lanterns, dim grey until lit,
> each a soft globe with a star-iron cap · **16 m** · globes `#ffe9a8` lit / `#5a6080` dim, caps `#8fa8ff` · star
> glass · 700 / 4 k · globes light bottom to top as lanterns are kindled (12 steps) · **Fallback:** 9 stacked emissive
> spheres with box caps.

> **`starmeadow_lantern`** · a single star lantern on a short cloud post · 1.6 m · as above · star glass · 80 / 500
> · `Kindle · Lantern` · **Fallback:** an emissive sphere on a cylinder.

> **`starmeadow_starwell`** · a perfect ring of light standing on edge on a cloud isle; through it, the world below
> (a small ground-card view) · ring **12 m** across, band 0.8 m · `#ffe9a8`, inner haze `#8fa8ff` · ribbon light ·
> 120 + a portal-view quad · ring turns slowly (1 turn per 40 s) · **Fallback:** an emissive torus and a canvas disc
> of the sea · **Image:** PREAMBLE + "a standing ring of golden light on a cloud at night; through the ring, far
> below, a turquoise sea with tiny islands".

> **`starmeadow_cradle`** · a crescent moon of soft cloud lying on its back like a cradle, big enough to hold a 6 m
> Starkin, with a star-quilt · **15 m** long, 6 m high at the horns · cloud `#d8dcf5`, shade `#8fa8ff`, quilt
> `#ffe9a8` / `#c9b6ec` patches · night cloud · 800 / 5 k · rocks gently (1° over 9 s) · **Fallback:** a half torus of
> cloud material · **Image:** PREAMBLE + "a crescent-moon-shaped cradle made of soft cloud on a sky island at night, a
> huge gentle glowing star creature resting in it under a patchwork star quilt".

> **`starmeadow_node`** · a bridge star: a five-pointed soft star 0.8 m across set into a light-strip deck ·
> `#ffe9a8` · star glass + light strip · 20 per node, strips 2 per segment · pulses when stepped on (bell note) ·
> **Fallback:** an emissive octahedron and a plane.

> **`starmeadow_nest`**, **`starmeadow_cloud_step`**, **`starmeadow_starflower`**, **`starmeadow_cloud_puff`**,
> **`starmeadow_isle_under`** · a round cloud nest (2 m, 100 tris), a terraced cloud step block (4 × 2 m, 80 tris),
> small five-petal flowers that glow (0.3 m, 30 tris, `#ffe9a8`, `#8fa8ff`), cloud-sea billboards, an isle underside
> billow mesh scaled per isle (300 tris). **Fallback:** spheres, boxes and quads. **Image:** one sheet, PREAMBLE + "sky
> meadow props at night: a cloud nest, terraced cloud steps, small glowing star flowers, cloud billows, isolated".

<a id="starmeadow-coverage"></a>
### Coverage proof

16 × 16 cells of 40 m. Land cells (≥ 200 m² of isle top): **expected 60-74**. Every isle holds at least one counted
anchor in each of its cells by construction (lanterns, nodes' ends, chests, Starkin spots); bridge cells are path
cells and pass by rule (b). The two big isles (Brightwell's Rest, Lanternfold) are the cells to watch.

<a id="starmeadow-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-274 | Shape and recipe, isles, bridges, falling rule, regions; prints |
| S-275 | Lantern Stack, Starwell, Cradle, windlass, the Ladder (mesh and sky billboard), lanterns, nodes, nests, flowers; terrain and sky, loading card, map art, track `starmeadow` |
| S-276 | Brightwell's and the Twinklings' spots; Starkin spots |
| S-277 | enemy tables and turret anchors |
| S-278 | chests, keepsakes, acorns, vistas, benches, curios, receivers, motes; ch19 states; unhide |
| S-280 | `ladder_top`; `freed:*` ribbons |
| S-286 | the `mainEnding` state; Mote's spot |

---

<a id="crown"></a>
## The Crown

Wenna's canopy as a small, walkable realm: a hub at the top of her trunk and four great boughs, North, East, South
and West, reaching out over the village, hung with blossom and with one big lantern at each bough's tip. Pip arrives
here at the bottom of Mote's Ladder (chapter 20's end); the Second Sneeze plays out on these boughs (chapter 21); and
afterwards the lanterns everyone brought stay hanging here for good.

<a id="crown-card"></a>
### Card

| Field | Value |
|---|---|
| id · kind | `crown` · interior-scale realm (dungeon recipe with bough decks; outdoors light) |
| Grid | 128 m (half 64); no seed-driven terrain (authored decks); `tests/fixtures/realm-prints/crown.json` freezes decks and anchors |
| Palette | blossom `#ffc8dc`, leaf `#8be07a`, bark `#8a5a3c`, lantern `#ffe9a8`, night `#141a3a`; fog `#2a2850` near 40 m, far 120 m |
| Light | night (finale); after `mainEnding`, the realm follows home's clock when revisited |
| Unlock · connection | `ch20`: the last floor of d11 portals here; after `mainEnding`, `[E] Climb · the Crown` at home's crown balcony ([atlas-home.md#ivy-finds](./atlas-home.md#ivy-finds)) |
| Hours | the finale ≈ 6 min of play inside Act IV's 5.5 h; revisits are short |
| Built by | S-283 the realm, S-284-S-286 the finale on it ([creatures.md#finale](./creatures.md#finale)), S-287 the lantern budget |

<a id="crown-shape"></a>
### Shape

| Piece | Numbers |
|---|---|
| **The Crook** | the hub: a bark platform r 10 at y 0 where the four boughs leave the trunk; the trunk goes on down below (not walkable) and the **leader**, a central upright branch, rises 12 m above the Crook (not walkable; the Ladder's foot touches its top) |
| **Boughs** | four bough decks (bridge decks), 48 m long from r 10 to r 58 on bearings 0°, 90°, 180°, 270°; 6 m wide at the base, 3.5 m at the tip; tip heights N y +8, E y −4, S y +2, W y +5 (a gentle even slope); each ends in a tip platform r 5 with a **bough lantern** (2.5 m cage) |
| Twigs | two side twigs per bough (2 m wide, 10-14 m long) at 40 % and 70 % of its length, alternating sides, each ending in a blossom cluster |
| The perch | a high twig over the North bough at (−20, −50), y 20, reached only in the Sneeze phase (the scene places Pip) |
| Leaves | instanced leaf-cluster billboards round every bough and above (a soft roof with gaps to the sky) |
| Below | a painted card of Sprout Village's plaza seen from the crown at y −60 (fog-exempt); falling below y −14: "The leaves catch Pip." He is placed back on the Crook; no damage |
| Rails | knee-high bark rails along both sides of each bough's first 30 m (visual and low colliders; the outer 18 m are open for the glide and the lanterns) |

<a id="crown-anchors"></a>
### Named anchors and spawns

| Anchor / spawn | Position | Used by |
|---|---|---|
| spawn `ladder` | (0, −4), facing 180° | arrival from d11 |
| spawn `balcony` | (−12, 0), facing 90° | revisits from home's crown balcony (West bough base) |
| `w:crook` | (0, 0), y 0 | scenes |
| `w:leader` | (0, 0), y 12 | the Ladder's foot; Mote's goodbye |
| `w:bough.n` / `.e` / `.s` / `.w` | bough mid-points at r 34 | Stray Lights telegraphs |
| `w:lantern.n` (0, −58, 9.5) · `.e` (58, 0, −2.5) · `.s` (0, 58, 3.5) · `.w` (−58, 0, 6.5) | the bough lanterns (cage centres) | Stray Lights targets; crown-lantern links |
| `w:perch` | (−20, −50), y 20 | the Sneeze glide start |
| `w:ring1` … `w:ring8` | (−12, −50, 18), (−3, −47, 15), (6, −42, 12), (15, −36, 9), (24, −29, 6), (33, −21, 3), (41, −12, 0), (48, −4, −3) | the glide's blossom rings (each 6 m across) |
| `w:landing` | the East tip platform (56, 2), y −4 | glide end |
| `w:hooks` | 64 lantern hooks (below) | the lantern chain |

**The glide** (geometry for [creatures.md#finale](./creatures.md#finale), which may move rings but must keep the
course flyable): about 75 m from the perch to the East tip through eight rings spaced ≈ 10 m, each 3 m lower than the
last. At the Leaf Glider's 6 m/s forward and 2 m/s fall that is ≈ 12.5 s and a 25 m drop (y 20 → −4): the "12 s glide"
in CANON §9.3. The rings sit on the mid-line between the two glide speeds' sink rates (0.33 m per metre at 6 m/s,
0.27 at Swift Fluff's 7.5 m/s), so at 6 m across every ring is passable at either speed (the worst miss, at ring 8, is
2.7 m off centre). A missed ring loops the glide from the perch; it cannot fail.

<a id="crown-hooks"></a>
### The lantern chain hooks

64 hooks, 16 per bough, at 3 m spacing from r 12 to r 57, alternating left and right of the deck at rail height plus
1.2 m. The chain fills North, then East, South, West, from the Crook outward, in the order
[story.md#lantern-chain](./story.md#lantern-chain) builds from the save. One instanced mesh (`crown_hook_lantern`),
one draw call; each lantern's tint comes from the giver's home land (home `#ffe9a8`, Duskwick `#f2b45a`,
Pinewhistle `#8fae9a`, Archwater `#7fd3d0`, Threemills `#e7c45a`, Rootdeep `#ffcf7a`, Glassway `#bfeee6`, Kettle
`#e66f4f`, Saltglass `#8ec9d8`, sky `#c9b6ec`). If the list is longer than 64, the extra givers' lanterns are carried
in the crowd scene only; S-287 measures the 64-lantern worst case. The lit chain is saved (`S.flags`) and stays on
the boughs on every revisit.

<a id="crown-states"></a>
### World states

| Condition | Change |
|---|---|
| `ch20` arrival | night; the four bough lanterns dark; Mote's Ladder runs from the sky down to the leader's top, pulling (boughs sway 1°) |
| Stray Lights (finale part 1) | each bough lantern fills in six steps as lights are steered in |
| the Sneeze (part 2) | blossom bursts on all four boughs; the eight rings appear for the glide |
| Given Light (part 3) | the hooks fill with lanterns; the Ladder turns gold and lifts away |
| `mainEnding` | the bough lanterns burn every night; the blossom stays; the chain's lanterns stay lit; on a revisit by day the lanterns rest dark and the boughs are full of leaves and birdsong |

<a id="crown-music"></a>
### Music and ambience

The ending theme (art-audio owns the track `crown`): the village theme slowed to a waltz, then the full ensemble of
every land's lead instrument (marimba, wind flute, plucked strings, fiddle, cello, glockenspiel, brass, reed, harp,
music box) entering one by one as the lantern chain fills. Ambience: leaves, a soft wind, later the village far below.

<a id="crown-kit"></a>
### Prop kit and ART BRIEFs

Instanced types (9): `crown_leaves`, `crown_blossom`, `crown_twig`, `crown_rail`, `crown_hook_lantern`, `crown_ring`,
plus the shared bench (one on the Crook after `mainEnding`) and the bough deck type. The South tip holds one
post-game curio, `Look · The village below` ("Every roof, every lantern, and the pedestal right in the middle. From
up here the village looks like it is holding its breath."), which becomes a vista post only if Decision 25 changes. Single meshes: the Crook and trunk
top, the leader, the four bough lanterns, the plaza card.

> **`crown_bough`** · a broad, gently curving branch with bark ridges, moss, and a flat walking top · 48 m long,
> 6 → 3.5 m wide · bark `#8a5a3c`, moss `#7fae4b` · toon bark · 600 each / 4 k · sways 0.5° (1° while the Ladder
> pulls) · **Fallback:** a tapered box deck with a half-cylinder underside · **Image:** seamless bark-top texture,
> PREAMBLE + "the top of a huge friendly tree branch seen from above, bark ridges, soft moss, tileable" ·
> **3D:** "toon tree bough 48 m long, walkable top".

> **`crown_lantern`** (bough lantern) · a big round lantern cage of woven twigs with a spiral at its crown, hung from
> a hook at a bough's tip · 2.5 m · twigs `#8a5a3c`, light `#ffe9a8` in six fill steps · lamp glass · 400 / 2.5 k ·
> fill steps light from the bottom up · **Fallback:** an icosphere cage of cylinders around an emissive sphere ·
> **Image:** PREAMBLE + "a large round lantern woven from living twigs, hung at the tip of a blossoming tree branch at
> night, glowing warm gold" · **3D:** "toon woven-twig lantern 2.5 m with spiral crown".

> **`crown_hook_lantern`** · a small paper-and-twig lantern on a curl of twig, tinted per giver · 0.5 m · tint per
> land (above) · lamp glass · 40 / 200 · sways out of step · **Fallback:** an emissive sphere on a torus hook.

> **`crown_ring`** · a ring of blossom 6 m across, petals drifting off it · `#ffc8dc` with `#fff1b8` centres ·
> 120 / - · glows brighter as Pip nears; bursts into petals when passed · **Fallback:** an emissive torus with a
> petal sprite.

> **`crown_leaves`**, **`crown_blossom`**, **`crown_twig`**, **`crown_rail`** · leaf-cluster billboards (4-8 m,
> `#8be07a` / `#5fbf5a`), blossom clusters (2-3 m, `#ffc8dc` / `#ff9fbf`), side twig decks (2 m wide), knee-high bark
> rails · **Fallback:** quads, spheres and boxes · **Image:** one sheet, PREAMBLE + "painted leaf clusters and pink
> blossom clusters for a giant friendly tree's canopy, transparent background, 6 variants each" (`slice_sheet.py`).

> **`crown_plaza_card`** · Sprout Village's plaza from 20 m above at night: the pedestal, the cobbles, the cottages'
> lit windows, bunting, tiny figures gathered · 1024 × 1024, fog-exempt · **Fallback:** a canvas disc with a cobble
> pattern and warm dots · **Image:** PREAMBLE + "looking straight down from a tree's crown at night onto a cosy village
> plaza with a stone pedestal, lanterns, bunting and a small crowd holding lanterns" (original; never copies the
> shipped key art).

<a id="crown-steps"></a>
### Step map

| Step | Builds from this section |
|---|---|
| S-283 | the Crook, boughs, twigs, rails, leaves, blossom, bough lanterns (dark), the plaza card, falling rule, spawns, anchors; prints |
| S-284 | lantern fill steps |
| S-285 | perch, rings, landing |
| S-286 | the 64 hooks and the chain; the `mainEnding` state; the revisit portal from home's balcony |
| S-287 | the 64-lantern worst case on budget |

---
<a id="far-counts"></a>
## Counts check (against CANON §10.3)

A unit test in each land's finds step compares its placed anchors with this table, and `js/realms/stats.js` (F25)
reads the same numbers for the Completion page.

| Land | Acorns | Keepsakes | Hollows | Vistas | Overworld chests | Bottles | Lamp Logs | Benches | Fish spots | Curios | POIs (target) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| The Rootdeep | 9 | 4 | 3 | 2 | 12 | 0 | 3 | 5 | 2 | 16 | 122 (116) |
| The Glassway | 8 | 4 | 2 | 3 | 12 | 4 | 3 | 5 | 4 | 12 | 99 (80) |
| Kettle Isle | 9 | 4 | 2 | 3 | 12 | 1 | 3 | 5 | 1 | 14 | 98 (96) |
| Saltglass Flats | 11 | 4 | 3 | 3 | 16 | 1 | 6 | 6 | 1 | 28 | 160 (160) |
| Driftholm | 6 | 4 | 1 | 2 | 8 | 0 | 0 | 4 | 1 | 10 | 77 (56) |
| The Starmeadow | 6 | 4 | 0 | 2 | 10 | 0 | 0 | 4 | 0 | 14 | 84 (80) |
| The Crown | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 (post-game) | 0 | 1 (post-game) | interior: no coverage test |
| **Far total** | **49** | **24** | **11** | **15** | **70** | **6** | **15** | **30** | **9** | **95** | |

CANON §10.3 lists 2 vistas for the Starmeadow and none for the Crown; the Crown's post-game vista
(`crown:vista-village`) is the 31st vista only if [systems.md#collectibles](./systems.md#collectibles) agrees to raise
the count to 31. Until then it is a plain `Look` curio, not a Sketch post. (See Decisions.)

---

<a id="decisions"></a>
## Decisions made here

CANON leaves these open; this file decides them. A later owner decision or a sibling file that owns the topic may
override any of them.

1. **The Rootdeep lies directly under home.** The Taproot stands under the Great Tree; the eight root-gate spurs run
   out on the same bearings as the chart, so the Under tab and the sea chart agree.
2. **Chart layout**: a 1024 px parchment, home at the centre, near isles at r 230 px, far isles at r 400 px, the
   Glassway as a band from bearing 60° to 215° between r 300 and 460 px beyond a reef ring at 300 px, Driftholm on a
   cloud at bearing 45°, r 420 px. Three tabs: The Wide Blue, Under (from `ch13`), Above (from `ch18`).
3. **Kettle Isle and Saltglass Flats are first reached only by their Glassway buoys**; after a buoy is used once, that
   isle's chart button lights for direct trips from any jetty. The home buoy opens the chart.
4. **No root-gate on Driftholm, the Starmeadow or the Crown**: CANON §5.1's "one root-gate per land" applies to the
   Wide Blue lands; the sky is not on Wenna's roots.
5. **Post-pass RNG streams for far realms** (`placeFinds` 71·3, `placeBuried` 73·5, `placeThornglass` 79·7,
   `placeFishSpots` 83·9, `placeNightFinds` 89·11, `placeSideMarks` 107·19, `placeStates` 109·21), per realm seed;
   renumbered if atlas-isles.md fixes a shared table first.
6. **Points of interest** include **curios**: a `Look · <thing>` with one line, no reward, no tracker row. They make
   up the CANON §5.1 density (one per 1,250 m²) without adding gem sources to the ledger.
7. **The coverage cell test**: cells with ≥ 200 m² of walkable, reachable land pass on (a) an anchor inside, (b) a
   path cell plus an anchor within 60 m of path, or (c) a landmark in line of sight within the fog far distance; on
   Saltglass at least 70 % of cells must pass on (a) or (b). The Glassway runs it per tide and on the union.
8. **Every far overworld chest holds 30 gems** (the ledger's flat rate); dungeon and Hollow chests are dungeons.md's.
9. **Bottle and Lamp Log slots** are placed here by id; which century's letter or which numbered page each slot holds
   is lore.md's to assign.
10. **The Glassway's tide**: high y 0.0, low y −1.4; sandbar crests at −0.9; the *Dandelion* needs 0.7 m; the tide
    changes only when Pip rings the Tide Bell at one of six tide stones (default high, saved); every pier is deep at
    both tides; a Pip caught on a bar by the incoming tide is lifted ashore ("Nell fished Pip out. 'Mind the tide!'").
11. **The Glassway's islets are authored at fixed centres**; Poisson discs (CANON's recipe sketch) place only reef
    heads, drift logs and kelp, so the islets, piers and lanes can be tested by name.
12. **Glassway names**: Post Rock, Tern Tuft, Whelk's Spit, Kelp Knoll, Gull Rock, Mabel Rock, Spiral Skerry, Bell
    Islet; the wrecks *Biscuit Tin* and *Wobbly Gull*; the Pillar Post; the Shell Stack; the Glass; the four sandbars
    B1-B4; the North, Wreck, Shell and Bell Lanes. The Snoozing Whale is **Hummock** (cast.md's name).
13. **The Rootdeep has no day**: `light.tod` frozen at 22:00; the Starsong's Dusk and Dawn do nothing there and a
    bench says so; no night-only finds there.
14. **Rootdeep geography**: Burrowbottom (west, three terraces under a 13 m ceiling, "Mind your head"), Glowcap
    Forest (north), the Underlake with the Taproot island and three causeways (centre), Drip Bay (south), Geode
    Galleries G1-G5 (east); region landmarks the Great Burrow Lamp (11 m), the Grandmother Cap (22 m), the Taproot
    (60 m) and the Sun Geode (14 m); the Heart's door in the Taproot's south face; the twelve memory knots at y 2.2
    on bearings 15° + 30°·n.
15. **The stone-site veins**: at `stoneSites` three floor veins light from the Taproot to the Glassway, Kettle and
    Saltglass spurs, pulsing until that stone is set, then steady gold.
16. **Kettle Isle geography**: the Spout Mouth faces east over Ash Beach; the Handle Arch on the west flank (root-gate
    at its foot); the lid is reached only through the Belly until `stoneHeld:kettle`, then by a ladder; region
    landmarks the Hammerwheel, Soakley's Bathhouse and the Teacup sea stack; Spoon Point as the glide launch.
17. **The Kettle whistles** two notes every in-game hour once Lady Fumarole is calmed (three after `mainEnding`): its
    healed state heard from anywhere on the isle.
18. **Saltglass geography**: Sablecamp by the north-east jetty; the Lamp Walk with twelve practice lamps (c03); the
    Glass Organ (18 m), the Practice Beacon (16 m), the Windcatcher (10 m); Dormitory Row with the eight Roll Call
    nameplates; the Drift Door 4 m up the bell tower's north face; the Acacia Root as the root-gate; the Library Dig as
    the door to `int_academy_library`; after the stone the bell rings at noon and dusk and the glass sculptures hum
    a chord at noon.
19. **Driftholm geography**: the main isle and five islets (Brookstone, Hushstone, Kiteknoll, Puffholm, the Lookout)
    with stepping stones, the Hanging Roots, a plank bridge, two glides and two bounce clouds; Arch Rise as a 36 m
    spire with the Spiral Arch on its plateau at y 100; the Outer Stair unfurls at `act3done`; the Stair Landing on
    the south-west lip; landmarks the Scrap Beacon, the Long Fall with Rainbow Rock, the Puff Tree; one hundred scrap
    lamps; the Tally Wall's ten notes at x −37 to −23; a note on Mote's door after `act3done` (text in story.md).
20. **Falling off a sky realm** never hurts: "Boing! The clouds bounce Pip back." (Driftholm, the Starmeadow); "The
    leaves catch Pip." (the Crown).
21. **Starmeadow region subtitles** (CANON gives none): "Waiting to be lit", "Step on the stars", "Speak softly", "Hold
    on tight". Isle names: Arch Gate, Lanternfold, Dimwhistle, the Snail, the Sleepy Cat, the Teapot, the Long Worm,
    Brightwell's Rest, Hushnest, Twinkle Steps, Windlass Isle, Far Lantern. The Starkin's four constellations are the
    Snail, the Sleepy Cat, the Teapot and the Long Worm, named after things they watched below. Landmarks the Lantern
    Stack, the Starwell, the Cradle and the Ladder.
22. **The Ladder of Lights** beyond 250 m is drawn as the `sky:ladder` billboard (crossfade 230-260 m), so it reads
    from the arrival arch despite the 300 m far plane; its rungs carry the four borrowed beacons' colours.
23. **After `mainEnding` Mote lives at the Cradle** beside Old Mother Brightwell, reachable through Driftholm's arch;
    the windlass stands empty and the cloud hole closes into a ring of blossom.
24. **The Crown**: a hub (the Crook) and four 48 m boughs with tip lanterns; the Sneeze glide course is eight 6 m
    blossom rings from a perch over the North bough to the East tip (≈ 75 m, ≈ 12.5 s); the lantern chain has
    **64 hooks** (16 per bough), tinted by the giver's land, kept for good; the Crown is revisitable after
    `mainEnding` from home's crown balcony (`[E] Climb · the Crown`).
25. **The Crown's vista** (`crown:vista-village`) stays a plain curio unless systems.md raises the vista count to 31.
26. **Fish spots in the far lands**: Rootdeep 2, Glassway 4, Kettle 1, Saltglass 1, Driftholm 1 (9 of the 18; the rest
    are home's and the isles').
27. **Hollow kinds by door**: Rootdeep dig, dark, beam; Glassway tide, bell; Kettle sling, steam; Saltglass sand,
    beam, ivy; Driftholm cloud (contents in dungeons.md).
28. **Dungeon door ids**: `heart_door`, `bell_door` (low tide), `mabel_breach` (low tide), `belly_mouth`,
    `drift_door`, `spiral_door`, `ladder_top`.
29. **The Starstair route**: 22 floating steps per flight; `[E] Climb · the Starstair` at the needle's first floating
    step once all three are up; the return from Driftholm's Stair Landing to home's `cairn-needle` spawn.
30. **The chart-stop fallback** for the Glassway is a sub-chart of its nine piers and three buoys with a 2 s card per
    hop.
31. **What thornglass guards** in the far lands is left to systems.md#gates; this file only places the thickets.
32. **Sleeping Acorns in the sky**: the Starmeadow's six are acorns "that sneezed too high" and were caught by Starkin.
33. **Keepsake texts** for all 24 far keepsakes and their six fifth lines, and every curio line, are written here
    (lines ≤ 220 characters, no `~`, Pip never speaks).
