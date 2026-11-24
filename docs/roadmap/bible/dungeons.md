# Dungeons and Hollows

The design reference for every dungeon, optional dungeon, Hollow and the Hundred Lamps in Starseed Isle, "The
Hundred-Year Letter". Implementation steps copy the maps, entity tables and numbers in this file into
`js/realms/dungeons/<id>.js` data. **Copy the data. Never paraphrase it.** If a solver run rejects a map, move the
fewest wall tiles needed to fix it, keep the solution order written here, and record the change in the PR body and
in this file in the same PR.

Order of authority: `CANON-NOW.md` LOCKED items > `CANON.md` > this bible > `INDEX.md` > a step issue.

What this file does **not** own (it links instead):
- Boss moves, HP formulas, phases, handover lines, plushies and rematches: [creatures.md](./creatures.md#boss-framework).
  This file gives each boss's **arena room** (size, tiles, entry, what opens after) only.
- Enemy species stats, tells and models: [creatures.md](./creatures.md#archetypes). This file gives **which species,
  how many, which room and which wave**.
- Tool numbers and gate objects outside dungeons: [systems.md](./systems.md#items-tools),
  [systems.md](./systems.md#gates). Where a number below repeats one from systems.md, systems.md wins.
- Where a dungeon's door sits in its land, and Hollow doors' overworld positions: the atlas files
  ([atlas-home.md](./atlas-home.md#hollows), [atlas-isles.md](./atlas-isles.md), [atlas-far.md](./atlas-far.md)).
- Story beats that start or end inside a dungeon: [story.md](./story.md#ch7) and onward.
- Texture generation pipeline and bundle budgets: [art-audio.md](./art-audio.md#dungeon-kit).
- Engineering invariants, tone and budgets every step restates: [charter.md](./charter.md#invariants),
  [charter.md](./charter.md#tone), [charter.md](./charter.md#budgets).

Contents:
1. [The tile-map format](#format) and [legend](#legend), [reach rules](#reach), [the solver](#solver)
2. [The interior prop kit](#kit) with ART BRIEFs
3. [Puzzle entities](#entities) and [dungeon state](#state)
4. [Common rules](#rules) every dungeon obeys
5. Story dungeons [d1](#d1) · [d2](#d2) · [d3](#d3) · [d4](#d4) · [d5](#d5) · [d6](#d6) · [d7](#d7) · [d8](#d8) ·
   [d9](#d9) · [d10](#d10) · [d11](#d11); 5A [the depth pass (R14)](#depth): annexes, flips, latches, the depth test
6. Optional dungeons [o1](#o1) · [o2](#o2) · [o3](#o3) · [o4 the Hundred Lamps](#o4)
7. [The 24 Hollows](#hollows)
8. [Totals and ledgers](#totals)
9. [Decisions made here](#decisions)

---

<a id="format"></a>
## 1. The tile-map format

Every dungeon and Hollow is plain data in `js/realms/dungeons/<id>.js` (Hollows: `js/realms/hollows/<id>.js`),
compiled by `js/realms/dungeon-compile.js` (ENGINE F21, step S-049) and built into a realm by
`js/realms/recipes/dungeon.js` (F22, S-050). The shape is ENGINE §3.2's, with the additions below.

```js
export default {
  id: 'under_roots', name: 'Under the Roots', kind: 'dungeon',   // 'dungeon' | 'hollow'
  tile: 2,                                  // metres per tile, always 2
  palette: 'under_roots', music: 'under_roots',
  light: { ambient: 0.55, torches: true, sun: false, tod: 0.5 },
  parent: 'home', door: 'nook_stair',       // the overworld portal that leads here (atlas files own its position)
  legend: { /* base legend + this dungeon's extension letters, see below */ },
  levels: {                                 // one entry per level; most dungeons have one
    L1: { at: [0, 0], base: 0, map: [ '#####', '#.@.#', '##X##' ] },
  },
  rooms: [ { id: 'r1', name: 'The Root Stair', level: 'L1', box: [10, 0, 11, 9], dark: false, ceil: 5 } ],
  entities: { 'r1:s1': { kind: 'switch', lights: ['r2:l1', 'r2:l2'] } },
  chests: { 'r4:c1': { gems: 40 } },
  spawns: { 'r6': [ { wave: 1, species: 'dimling', n: 3, at: 'e' } ] },
};
```

Rules of the format:

1. **Tiles are 2 m.** Column 0 is the first character of a map line, row 0 the first line; +x is east (right),
   +z is south (down). A tile at (col, row) has its centre at world `(2·col + 1, 2·row + 1)` plus the level's `at`
   offset in tiles and the realm margin (8 m each side).
2. **Composite maps.** This file draws each level as **one composite map**. Rooms share their border walls; a door
   tile sits in the shared wall. The `rooms[].box` is `[col, row, width, height]` of the room **including** its
   border walls, read from the composite. The compiler slices the composite into rooms (or the data file stores the
   composite and the box list; both are accepted: see [Decisions](#decisions) D2).
3. **Levels.** A level is one walkable layer (ENGINE rule: one walkable level per cell). Multi-floor places (the
   Tower, the Ladder, the Hundred Lamps) use several levels placed side by side on the grid (`at` in tiles) and
   joined by **stair warps** (`^`). Fog (6-60 m) and the room ceiling hide the neighbours. `base` lifts the whole
   level by that many metres (used only for the look of a level seen through a window card; gameplay never crosses
   levels except by `^`).
4. **Heights.** `.` is floor height 0. A digit `1`-`9` is floor at digit × 0.3 m. Walls are 3.2 m above the
   highest floor tile next to them (ENGINE). Each room has a ceiling `over` box at `ceil` metres (default 5; tall
   rooms state theirs).
5. **Ids.** An entity id is `<room>:<glyph><n>`, where n counts that glyph inside the room in reading order
   (left to right, top to bottom), starting at 1. Example: the second `l` read in room r7 is `r7:l2`. A door in a
   shared wall belongs to the room **above it** (horizontal walls) or **left of it** (vertical walls). Tables in this
   file also give each special tile's composite `(col,row)`, which is authoritative if a count ever disagrees.
6. **Rooms are found by flood fill.** Every non-wall, non-door, non-space tile belongs to exactly one room; a room is a
   4-connected region bounded by `#`, door glyphs and spaces. The compiler fails if a `box` does not match its region.
7. **Space** (` `) is void outside the dungeon: no floor, no collider, never walkable, never drawn.
8. **Height of an entity tile.** A tile holding any glyph other than `.`, a digit, `_ ~ w = , ;` or a wall takes the
   most common floor height among its 8 neighbours that are floor tiles (`.` or a digit), ties broken upward. So a
   chest drawn inside a `9` ledge sits on the ledge, and a switch ringed by `2`s sits on the dais.
9. **Doors and heights.** A door tile takes the height of the floor tiles it joins; the two sides of a door are
   always drawn at the same height.
10. **Every `X`** leads to the dungeon's one overworld door (`door` in the data) unless the room notes say otherwise.

<a id="legend"></a>
### 1.1 Base legend (every dungeon and Hollow)

| Glyph | Meaning | Compiles to |
|---|---|---|
| `#` | wall | 3.2 m wall box (merged runs), `occ: true` material |
| ` ` | void | nothing |
| `.` | floor, height 0 | heightfield 0 |
| `1`-`9` | raised floor, digit × 0.3 m | heightfield |
| `_` | pit | heightfield −4 m; respawn rule ([rules](#rules) R4) |
| `~` | deep water | water plane at −0.3 m over a −4 m floor; same respawn as a pit, with a splash |
| `w` | shallow water | heightfield −0.3 m, water plane at −0.1 m; Pip wades (`wadeK` 0.62) |
| `=` | plank bridge | bridge deck at 0 m over a −4 m floor |
| `@` | entry spawn | `W.spawns.entry`; the dizzy wake point ([rules](#rules) R3) |
| `X` | exit door (in a wall) | portal back to `parent` at `door`; prompt `[E] Enter · <overworld name>` |
| `O` | open arch | doorway with no leaf; never closes |
| `D` | door | leaf + collider; opens on its condition in `entities` |
| `L` | locked door | consumes one small key; prompt `[E] Unlock · Door` / `Locked` |
| `B` | boss door | needs the Root Key; prompt `[E] Unlock · Big door` |
| `k` | small key | appears when its condition holds (default: always there) |
| `K` | Root Key chest | big chest; content the Root Key |
| `$` | treasure chest | big ornate chest; content the dungeon's tool or prize |
| `c` | gem chest | small chest, 40 gems (the 48 dungeon chests of CANON §10.3) |
| `&` | map chest | small chest, the dungeon map |
| `%` | Chime Stone chest | small chest, the dungeon's Chime Stone |
| `H` | heart chest | big chest, a heart container (the Tower only) |
| `+` | heart petal | a petal on a root pedestal ([systems.md](./systems.md#hearts)) |
| `*` | gem bag | a 60-gem bag on a root pedestal (Hollows only) |
| `p` | pressure plate | down while Pip or a block stands on it |
| `P` | hold plate | down only while a block (or ice block) stands on it |
| `b` | push-block | 2 m block, slides one tile per push |
| `s` | crystal switch | toggles on a sword hit (0.5 s cooldown) |
| `t` | lit torch | wall torch, always lit; joins the lamp-light pool |
| `l` | unlit wall-lantern | lit by its trigger or `[E] Kindle · Lantern`; once lit, lit for good |
| `r` | reset lever | `[E] Use · Lever`: returns every block of its room to its start tile |
| `e` | enemy spawn point | waves in `spawns` |
| `M` | boss spawn | the boss's start tile (creatures.md owns the fight) |
| `^` | stair warp | 0.35 s fade to the paired `^` in another level or room (`entities` pairs them) |
| `I` | pillar | 1-tile pillar collider (decor and cover) |
| `?` | sign | `[E] Read · Sign`; text in the room notes |
| `!` | beacon or great lamp | the land's beacon in the Warden's room; `[E] Kindle · Beacon` with the Glowbud Lantern after the Warden is calmed ([systems.md](./systems.md#beacons)) |

Extension glyphs (each dungeon declares only the ones it uses, with the meanings in its section): lowercase
`a d f g h i j m n o q u v x y z` and uppercase `A E F G J N Q R S T U V W Y Z`, plus `,` `;` `<` `>` `/` `\` `{`
`}`. An extension glyph means the same thing in every dungeon that uses it **where this file says so in the
[entity table](#entities)**; otherwise its meaning is local to one dungeon and its section says so.

<a id="reach"></a>
### 1.2 Reach rules (what Pip can cross; the solver uses exactly these)

Numbers from `TUNE.move` (run 4.4 m/s, sprint 5.8, jump apex 0.85 m, airtime 0.508 s, airCap 6.2 m/s, roll 2.6 m)
and the tools in CANON §8.2.

| Move | Rule in tiles | Why |
|---|---|---|
| Walk up | rise of 1 digit (0.3 m) per tile | `stepUp` 0.35 m |
| Hop up | rise of 2 digits (0.6 m) | apex 0.85 m |
| Wall | rise of 3+ digits (0.9 m+) | needs a tool or a warp |
| Drop | any fall; no fall damage indoors | - |
| Hop a gap | 1 tile (2 m) of pit or deep water, edge to edge | 3.1 m reach at airCap |
| Roll | never crosses a gap (it stays on the ground) | - |
| Glide a gap (Leaf Glider) | 2 tiles if the far side is ≤ the near side − 1 digit; 3 tiles if ≥ 3 digits lower; 4 tiles if ≥ 5 digits lower; never upward without an updraft | reach = 1.7 + 3 × (0.85 + drop) m, 0.6 m margin |
| Updraft `u` (open) | lifts Pip to `top` (m above its tile, default 3.0) at 5 m/s; from the top he can step or glide to any tile ≤ top height within 1 tile (no Glider) or within the glide rule (Glider) | - |
| Hook (Thistle Hook) | pulls Pip to a hookbloom `h` within 7 tiles (14 m) in a straight line with nothing taller than 1.2 m between; he lands on the tile in front of the bloom facing him | S-143 |
| Climb (Ivy Gloves) | a wall tile marked `i` can be climbed from the tile in front of it to the tile behind it if that tile is ≤ 6 m higher (any digit, or a level's `base` step) | 1.5 m/s |
| Cloudstep | a second hop while within 1.5 m of a cloud mote `n`; crosses 2 tiles of gap or a 3-4 digit rise next to the mote | S-268 |
| Beam (Sunglass) | 9 tiles (18 m) in a straight line from Pip's eye, stops at walls, blocks, pillars and closed doors; reflects off mirrors | S-160 |
| Sling (Ember Sling) | 12 tiles (25 m) line of sight; lights braziers, rings bell targets, melts ice and wax | S-227 |
| Lantern light | radius 3 tiles (6 m; 4.5 tiles with Bright Wick) | S-057 |

<a id="solver"></a>
### 1.3 The solver (S-049; extended by each tool's step)

A state BFS in `bun test` over **(tile region, small keys held, Root Key, switch and lantern states, block
positions, water/steam/gear states, tools owned)**. Tools are added to the state when Pip opens the chest that holds
them; tools Pip owned on entry come from the dungeon's `needsOnEntry` list. It proves, or fails with an exact
message:

1. the boss door and the exit are reachable from `@`;
2. **every chest** (`c & % K $ H`) and every `+ *` can be opened from `@`;
3. no soft-lock: from every reachable state the exit is still reachable (a locked door that uses the only key
   behind itself fails; a block pushed into a corner with no reset lever in its room fails);
4. the number of small keys reachable before each `L` is at least the number of `L` that must be opened before it;
5. the solution in this file's **Solver notes** is one valid path (the test replays it as a script of tile
   targets and actions and checks each step is legal).

Error messages name the room and tile, e.g. `under_roots: r7:c1 (4,21) unreachable; needs lanternLit r7:l1..l4`.

---

<a id="kit"></a>
## 2. The interior prop kit

`js/props-interior.js` (S-051) builds every interior prop as a code-built toon model with `occ: true` materials, all
drawn through `Scenery` instancing by type. A whole dungeon must draw in **≤ 120 calls** (target 40-60) and
**≤ 150 k triangles**. Each prop has a manifest key `int_<name>` with `realm: 'shared'`; a painted GLB the owner adds
later replaces the code model with no code change. Texture keys (`tex_dungeon_*`) are generated in S-051 and owned
by [art-audio.md](./art-audio.md#dungeon-kit); the prompts below are the ones S-051 uses.

**Shared style line for every prompt in this file** (prepend it): "Soft painterly storybook style, gentle rounded
shapes, warm hand-painted texture, cosy and friendly, soft rim light, muted saturated colours, no text, no logos,
original design."

### 2.1 Textures (S-051)

| Key | Size | Prompt (after the style line) | Processing | Fallback |
|---|---|---|---|---|
| `tex_dungeon_stone` | 1024² + 512² webp | "Seamless top-down texture of old rounded cobble stones in warm grey and soft umber, moss in the cracks, even lighting, tileable" | `tools/make_seamless.py --blend 64`, then `_hd`/`_lo` webp q82 | canvas noise: base `#7d7468`, cracks `#4f4840`, moss dots `#6f8f3a` |
| `tex_dungeon_brick` | 1024² + 512² | "Seamless texture of small hand-made bricks in faded terracotta and cream mortar, slightly uneven, soft painted edges, tileable" | same | canvas brick grid `#a4573f` on `#e9dcc3` |
| `tex_dungeon_moss` | 1024² + 512² | "Seamless top-down texture of soft green moss with tiny round leaves and a few pale flowers, tileable" | same | noise `#5f7f34` / `#8fb35a` |
| `tex_dungeon_root` | 1024² + 512² | "Seamless texture of smooth tree-root bark in warm brown with faint glowing amber veins, tileable" | same (S-062 `realm: under_roots`) | stripes `#5a3d2b` / `#ffcf7a` at 10 % |

### 2.2 Kit models

All sizes in metres; tris are the code model's budget. Colours default to the dungeon palette's `stone`, `trim` and
`accent` slots (each dungeon section lists its palette).

| Prop (`int_` key) | Silhouette and size | Materials | Tris | Notes |
|---|---|---|---|---|
| `wall` | 2 × 3.2 × 2 box with a bevelled rounded cap, slight bulge | stone texture, trim cap | 12 | one instanced segment; runs merged as colliders only |
| `wall_corner` | rounded quarter-round post 2 × 3.4 × 2 | stone, trim | 40 | - |
| `arch` | round-topped doorway, 2 m wide opening 2.6 m high, keystone with a carved spiral | stone, keystone accent | 120 | `O` and every door frame |
| `door_leaf` | plank leaf 1.9 × 2.5 × 0.25, two iron bands, a round knob | wood `#7a5232`, iron `#5b5e66` | 60 | slides up 0.6 s (vine-gate animation of `fight.js`) |
| `door_locked` | door leaf + a round brass keyhole plate 0.5 m | + brass `#c9a24a` | 90 | plate pops off and rolls 1 m when unlocked |
| `door_boss` | 2.6 × 3.0 leaf, two half-moons meeting at a big spiral lock 0.9 m | wood, brass, accent glow | 220 | big spiral turns 360° in 1.2 s on unlock |
| `door_glowbud` | a closed flower bud 2.0 × 2.6 filling the arch, petals overlapping, soft gold veins | `#ffcf7a` glow veins on `#6f8f3a` petals | 160 | petals fold out in 0.8 s; see `g` |
| `pillar` | round 0.9 m column 3.2 m, base and cap rings | stone, trim | 64 | `I` |
| `stairs` | 2 × 2 tile of four rounded steps going down into dark, or up into light | stone | 48 | `^` |
| `torch` | wall bracket with a tulip-shaped cup and a round flame sprite | iron, `glow` flame `#ffcf7a` | 30 + sprite | `t`; lamp-light pool |
| `lantern_wall` | round paper-and-brass lantern 0.5 m on a curled bracket; unlit grey-blue, lit warm gold | brass, paper `#f4e6c6`, glow when lit | 70 | `l`; pops a flower of sparks 0.5 s on lighting |
| `brazier` | bowl 0.9 m on three curled legs; cold has grey ash, lit has a round flame | iron, glow | 80 | `y` where used |
| `crate` | 1 × 1 × 1 crate with rounded corners | wood | 24 | decor |
| `barrel` | 0.7 × 1.0 barrel, two bands | wood, iron | 60 | decor |
| `block` | 1.9 m cube, rounded edges, carved spiral on all four sides | stone, spiral accent glow `#ffe9a8` 30 % | 60 | `b`; land-specific skins below |
| `plate` | 1.6 m round stone disc 0.1 m proud, spiral inlay; sinks 0.08 m and glows when down | stone, accent | 40 | `p`; `P` has a square block-shaped inlay |
| `switch` | 0.6 m faceted crystal on a 0.6 m stone stand; blue when off, gold when on | crystal `#9fdcff` / `#ffd36b` glow | 50 | `s` |
| `key_small` | 0.4 m brass key with a leaf-shaped bow, bobbing and turning | brass glow 20 % | 40 | `k` |
| `key_big` | 0.8 m brass key with a spiral bow and a ribbon | brass, ribbon accent | 90 | in `K` |
| `chest_small` | 1.0 × 0.7 × 0.7 domed chest, brass corners, leaf clasp | wood, brass | 90 | `c & %` (map chest has a rolled-paper icon on the lid, Chime Stone a star) |
| `chest_big` | 1.4 × 1.0 × 0.9 domed chest, gold trim, spiral on the lid, soft glow from the seam | wood, gold, glow | 160 | `K $ H` |
| `cracked_floor` | floor tile with painted cracks | decal | 2 | decor / hints |
| `rubble` | three rounded stones 0.3-0.6 m | stone | 60 | decor |
| `lever` | 1 m wooden lever on a round stone base, a ball knob | wood, stone | 50 | `r` |
| `sign_int` | small hanging wooden sign 0.8 × 0.5 on two ropes | wood | 30 | `?` |
| `pedestal_root` | root-wrapped stone stump 0.8 m, holds `+` `*` `k` | root texture, glow | 80 | - |
| `stair_warp` | ring of six small glowing pebbles round the stairs mouth | glow | 30 | `^` hint |

**ART BRIEF (shared kit, owner batch 02):** silhouette: chunky, rounded, slightly squashed shapes, no sharp corners;
size as in the table; palette: per-dungeon `stone`, `trim`, `accent` slots; materials: matte painted albedo, soft
rim, no metalness except a soft brass sheen; poly budget: the tris column ×4 for painted GLBs; pose: static (doors,
chests and levers animate by transform only). Image prompt (for reference sheets, one per prop):
"<style line> Turnaround reference sheet, front, side and three-quarter views, of a [prop description from the
table], cosy fairy-tale dungeon furniture, plain cream background." 3D prompt: "Stylised low-poly game prop,
[prop description], rounded chunky shapes, hand-painted texture, soft colours, cosy storybook style, game-ready,
under [tris×4] triangles, origin at the base centre, metres scale [size]." Fallback: the code-built model above.

---

<a id="entities"></a>
## 3. Puzzle entities

Built in `js/dungeon-mod.js` (ENGINE F23). Part I (S-052): doors, keys, locked and boss doors, plates, map and
Chime Stone. Part II (S-053): crystal switches, push-blocks, reset lever, saving. Every tool's own step adds its gate
entity (listed with the step). All emit `EV.PUZZLE { id, on }` when they change.

| Entity | Glyph | Behaviour (exact) | Step |
|---|---|---|---|
| Door | `D` | Condition one of: `plate:<id>` (open while held), `plates:[ids]` (open while all held), `switch:<id>` (open while on), `clear` (opens when every enemy of the room's last wave has poofed; seals with glowing vines when Pip enters a room with a live wave), `lit:[ids]` (opens when all listed lanterns are lit), `boss` (opens when the room's boss is calmed), `flag:<name>`, `always` (decor door that opens on approach). Doors opened by `clear`, `lit`, `boss` and `flag` stay open for good and are saved; `plate` / `switch` doors follow their trigger live | S-052 |
| Locked door | `L` | `[E] Unlock · Door` consumes one key from `S.dungeons[id].keys`; open for good | S-052 |
| Boss door | `B` | `[E] Unlock · Big door` with the Root Key; the Root Key is not consumed | S-052 |
| Small key | `k` | Condition as for doors (`always` by default). Pickup: item-get beat "You got a small key! It opens one locked door in this dungeon." | S-052 |
| Root Key / treasure / heart / map / Chime Stone chest | `K $ H & %` | `[E] Open · Chest`; item-get beat; saved in `S.dungeons[id].chests` | S-052 |
| Gem chest | `c` | 40 gems; "+40 gems!" | S-052 |
| Pressure plate | `p` | down while Pip (circle 0.32 m) or a block overlaps its tile centre ± 0.8 m | S-052 |
| Hold plate | `P` | down only under a block | S-052 |
| Crystal switch | `s` | sword hit toggles (0.5 s cooldown); a beam or ember hit also toggles; colour blue off / gold on | S-053 |
| Push-block | `b` | Pip pushes into it for 0.35 s → slides 1 tile in 0.3 s if the next tile is floor of the same height, free of blocks, pillars, chests and closed doors; never onto `_ ~ w =`. Blocks are **not** pushable while a wave is live in the room | S-053 |
| Reset lever | `r` | returns every block of its room to its start tile in 0.6 s (blocks fade out and in) | S-053 |
| Wall-lantern | `l` | `[E] Kindle · Lantern` (needs the Glowbud Lantern) or its listed trigger lights it; lit for good, saved | S-057 / S-059 |
| Glowbud door | `g` | A bud in an arch. Opens for good when **(a)** every lantern in its `lit:` list is lit, or **(b)** Pip holds the lit Glowbud Lantern within 1.5 tiles (3 m) of it. Doors marked `lanternOnly` ignore (a) | S-057 / S-059 |
| Updraft knot-hole | `u` | A knot-hole vent. When open, a column 1 tile wide and `top` m tall lifts Pip at 5 m/s; leaves spiral in it. Opened by a plate or switch (live, follows its trigger) | S-103 |
| Hookbloom | `h` | A big purple thistle on a post 2.4 m tall; target of the Thistle Hook within 7 tiles | S-143 / S-146 |
| Mirror | `/` `\` `m` | A brass mirror on a turntable. A sword hit turns it 45° clockwise (as seen from above): `/` → `m`(N-S blocking) → `\` → `m`(E-W blocking) → `/`. `/` and `\` reflect a beam 90°; `m` stops it. The map shows the start state | S-162 |
| Beam source | `S` | Fixed skylight beam, shining in the direction in its entity (`dir: 'E'`) | S-162 |
| Receiver | `R` | Brass sunflower; lit while a beam touches it (beam must enter its tile). Opens doors/plates like a plate (live) unless `latch: true` | S-160 / S-162 |
| Light-root | `j` | A dim root lying in a pit. Beamed for 0.5 s → becomes a bridge deck for **20 s**, glowing; flashes for the last 3 s; then sinks (Pip on it drops and respawns at the last safe tile) | S-183 |
| Soft earth | `d` | Brown mound with a sparkle. `[E] Dig · Soft earth` (Digging Paws): 1.0 s dig, reveals what its entity holds (floor, `^`, chest, key) | S-181 / S-184 |
| Tide floor / tide raft | `,` `;` | A room with a `tide` state has two water levels. Low: `,` dry floor 0, `;` pit. High: `,` deep water, `;` a floating raft deck at 0 | S-124 |
| Tide shell / tide stone | `o` / `Q` | `o` conch switch: sword hit flips its listed rooms' tide (live, 1.5 s rise or fall). `Q` tide stone: only `[E] Ring · Tide stone` with the Tide Bell flips it | S-124 / S-122 |
| Gear-bridge | `G` | Rotating bridge centred on `G` with arms of `len` tiles. Two states: `NS` and `EW`. A crank `y` rotates it 90° in 1.0 s (blocked while Pip stands on it) | S-145 |
| Crank | `y` (d4 only) | `[E] Use · Crank` or a sword hit turns its gear-bridge | S-145 |
| Pitch bell | `x` `Y` `z` | Low, mid and high bells (sword hit rings them; Starsong notes count the same) | S-209 |
| Pitch door | `U` `V` `W` | Opens for good when its pitch (low, mid, high) rings within 6 tiles | S-209 |
| Song door | `T` | Opens for good when its `tune` (a 3-note sequence) is rung on bells or played on the Starsong within 6 tiles | S-210 |
| Steam valve | `v` | `[E] Use · Valve` or an ember hit: toggles its listed steam platforms | S-229 |
| Steam platform | `z` (d8, o4) | A brass plate on a piston. Up = `hi` digit, down = `lo` digit (entity); moves in 1.2 s, carrying Pip | S-229 |
| Cold brazier | `a` | Lit by an ember shot (or the Lantern's Kindle within 1 tile); lit for good; counts like `l` | S-227 / S-230 |
| Wax plug | `f` | A round wax seal filling a pipe mouth or arch; an ember shot melts it in 1.0 s (for good) | S-230 |
| Bell target | `q` | Small brass bell on a post; an ember shot or a beam rings it; acts as a switch | S-227 |
| Sand-flow | `<` `>` `{` `}` | Conveyor of sand moving W, E, N, S at 6 m/s; Pip cannot walk against it (run 4.4, sprint 5.8); hops keep the flow speed | S-250 |
| Ivy lattice | `i` | Climbable wall tile ([reach](#reach)) | S-248 / S-251 |
| Nameplate door | `N` | Brass door with an empty nameplate slot; `[E] Place · Nameplate` with the matching nameplate item (consumed) | S-250 |
| Song cloud | `E` `F` `J` | Rose, gold and sky clouds. Mist (a pit) until its note (low, mid, high) is played on the Starsong; then solid **8 s**, flashing for the last 2 s | S-269 |
| Cloud mote | `n` | A floating puff 1.2 m above its tile; Cloudstep's second hop | S-268 |
| Ice wall | `A` (o1, o4) | Blue glassy slab in a doorway or wall gap; an ember shot melts it in 1.2 s (for good) | S-227 / S-238 |
| Push-ice | `Z` (o1, o4) | Ice block; one push sends it sliding until it hits a wall, block, pillar or another `Z`; stops on `P`; slides over ice floor `{`-free tiles only | S-238 |
| Thornvine | `V` (o2, o3 and o4 only) | Purple bramble filling a doorway; three sword hits (Shiny Sword) cut it for good | S-013 |

Where one glyph has two meanings (for example `V`: the mid pitch door in d7, thornvine in o2, o3 and o4), the
dungeon section says which, and the dungeon's `legend` holds only its own meanings.

<a id="state"></a>
### 3.1 Dungeon state (save)

`S.dungeons[id]` lives in the v8 `dungeons {}` container ([systems.md](./systems.md#save-plan)). Shape (validated
by `normalize`; unknown keys dropped):

```js
{ keys: 0, bigKey: false, map: false, compass: false, done: false,
  open: { 'r2:g1': true },          // doors, lanterns, plugs, ice, dug earth: anything opened for good
  lit: { 'r7:l1': true },           // lanterns and braziers lit (kept apart for the map card's lantern icons)
  blocks: { 'r3:b1': [4, 12] },     // current tile of every moved block (composite col,row)
  state: { 'r9:G1': 'EW', 'tide:A': 'high', 'r4:v1': true },   // rotations, tides, valves, mirrors
  chests: { 'r4:c1': true },
  rooms: { r1: true, r2: true } }   // visited, for the map card
```

Hollows store only `collect.hollow['hollow_<land>_<n>'] = true` (v9; the key is the Hollow's realm id, the only
form S-071's `normalize` keeps; petals are `collect.petal['hollow_<land>_<n>:p<k>']`) plus their block positions in
`S.dungeons['hollow_<id>']` while unsolved.

---

<a id="rules"></a>
## 4. Common rules (every dungeon, every Hollow)

- **R1 Entry.** A dungeon door in the overworld uses `[E] Enter · <Dungeon name>`. The name card shows on first entry
  only: dungeon name on line 1, the land on line 2 (e.g. "Under the Roots" / "beneath the Great Tree").
- **R2 Leaving.** `X` always leads out; leaving and coming back keeps every saved state. Fast travel and benches are
  never available inside (ENGINE F24).
- **R3 Dizzy.** At 0 HP inside a dungeon: "Pip got dizzy!", 1.2 s, then "Pip woke up at the entrance." at `@` with
  full hearts and all puzzle state kept (CANON §8.1). In a boss room, the boss resets to full HP and naps until Pip
  walks back in.
- **R4 Pits and deep water.** Falling into `_` or `~` fades out 0.4 s and puts Pip back on his last safe tile
  (`move.safeEvery` 0.5 s) with **no damage**; SFX `fall_whoops` (pit) or `splash_paddle` (water). A first fall in
  each dungeon shows the hint "Whoops! Pip climbed back out." once.
- **R5 Enemies.** At most 4 alive in a room, at most 2 attacking at once (the shipped rule). Waves listed per room
  respawn only when Pip re-enters the dungeon from outside, never on room changes; a `clear` door that opened stays
  open. Enemies never leave their room. Drops follow the shipped rule (gems 45 %, a heart 15 % when hurt).
- **R6 Lighting.** `dark: true` rooms: ambient 0.08, fog 2-14 m in the realm's dark tint; only lit lanterns,
  torches, glow materials and Pip's Lantern light them. Other rooms: ambient 0.55. The 4-point-light pool takes the
  nearest lit lamps (no extra lights).
- **R7 First person.** Every gate is readable in first person: each puzzle room has its trigger and its result
  **both visible from the room's entry door** or joined by a visible cue (a glowing vein, a chain, a pipe) that runs
  along the floor or wall between them. Every room change plays a 0.4 s sound cue on the result (door: `door_open`;
  lantern: `lantern_pop`; bridge: `bridge_rise`; chest appearing: `chime_up`).
- **R8 Map card.** Without the map: visited rooms only. With the map: every room, doors coloured by kind. With the
  Chime Stone: unopened chests as small stars, the boss room as a spiral, the Root Key as a gold dot. Map card title is the
  dungeon name.
- **R9 Chest counting.** Only `c` chests count toward the "48 dungeon chests" and the Completion row "Dungeon chests"
  per land; `& % K $ H` are story chests and always on the critical path. (See [Decisions](#decisions) D5.)
- **R10 Hints.** Every dungeon has 3 "Ask the Tree" hint pairs (nudge, then plain answer) listed in its section;
  [systems.md](./systems.md#hints) owns the hint UI.
- **R11 Budgets.** ≤ 120 draw calls, ≤ 150 k triangles in any view, far plane 120 m, fog 6-60 m (dark rooms 2-14 m),
  generation ≤ 0.15 s, realm grid = extent + 16 m (48-192 m). Each dungeon's prints fixture
  `tests/fixtures/realm-prints/<id>.json` is written in the PR that first ships it and refreshed only by the PR that
  completes it.
- **R12 Tone.** Nothing in a dungeon is dead, cursed, haunted or hurt. Dark rooms are cosy-dark (amber glow, soft
  drips), never horror-dark; no jump scares, no sudden loud sounds; Dimlings and Hushlings are shy, not scary.
- **R13 Every boss room** is at least 15 × 15 tiles inside (30 m) unless creatures.md asks for another size;
  stepping in seals the door with glowing vines (shipped look); after the handover the vines fall and the room's
  `boss` doors open.
- **R14 Puzzle depth** (CANON §11.1 A2, adopted 2026-11-22 from the playtime review; story dungeons d1-d10). (1) Each
  dungeon averages **≥ 1.6 puzzle beats per counted room** (a beat is one thing the player must work out: a plate, a
  lever order, a beam route, a block push, a tide or valve state). (2) At least **4 compound rooms**: the signature
  mechanic combined with the dungeon's tool, the previous tool or a second entity kind. (3) **One mid-dungeon state
  flip** (a lever, tide, valve, beam source or pump) that changes at least **2 rooms already visited** and forces a
  revisit loop through them in their new state. (4) The room before the boss door is an **"everything you learned"**
  room (≥ 3 action kinds). (5) The solver's depth test reports beats and compound counts per room and fails below these
  thresholds. d1, the first dungeon, needs ≥ 11 rooms, ≥ 12 beats and ≥ 2 compound rooms plus its flip. Each of d2-d10
  grows by 2-3 rooms. From Act III (d6-d10) every combat room runs **two waves** of mixed archetypes at the land's
  pattern tier (CANON §10.3). Counting rules, the annex maps, flips, latches and the depth steps that build them are in
  [§5A](#depth).
- **R15 Hollows have two stages** (CANON §11.1 A3). After stage 1 opens the way, a second lock (stage 2) adds a second
  mechanic or a tool from an earlier land, and the prize sits behind it. One Hollow per Act II-III land is a **Deep
  Hollow**: its existing map is room 1 and two new 11 × 11 rooms follow, 15-20 minutes in all; the last room holds the
  prize, a Lamp Log and a note from the Lamp Thief. Details, maps and the stage-2 line of every Hollow are in
  [§7](#hollows).

---
## 5. Story dungeons

Each section follows the same order: summary table, legend extension, map, rooms, room-by-room entities, enemies,
keys and chests ledger, **solver notes** (the intended solution, replayed by the solver test), Ask the Tree hints,
step split, and art (ART BRIEFs for every dungeon-specific asset, with fallbacks).

<a id="d1"></a>
### d1 Under the Roots

| Field | Value |
|---|---|
| Realm id / file | `under_roots` · `js/realms/dungeons/under_roots.js` |
| Where | beneath the Great Tree, home; entered by the stair in Pip's Nook ([atlas-home.md](./atlas-home.md#pips-nook)) |
| Opens | flag `wennaAwake` (I.6); the Nook stair portal shows only then |
| Chapter | ch7 "Under the Roots" ([story.md](./story.md#ch7)); completing it sets `lanternGot` (in S-067) |
| Needs on entry | nothing (sword level 1 is enough) |
| Rooms · hours | 11 · 1.0 h (9 + the 2-room annex, [§5A](#d1-depth)) |
| Signature mechanic | darkness: glowbud doors and wall-lanterns; the Glowbud Lantern, found in room 5, lights 6 m, opens glowbud doors and shows Dimlings |
| Reward | **Glowbud Lantern** (`$` in r5) |
| Boss | **Sir Rollo** in r8 ([creatures.md](./creatures.md#boss-rollo)) |
| Grid | 31 × 41 tiles (62 × 82 m); realm grid 112 m |
| Palette | stone `#5a3d2b`, trim `#8a5a3c`, accent `#ffcf7a`, moss `#6f8f3a`, dark tint `#1e1610` |
| Light / music | ambient 0.55 (dark rooms 0.08), torches on, sun off · track `under_roots` (soft cello drone, music-box drips, 72 bpm; [art-audio.md](./art-audio.md#under-roots)) |
| Enemies | Dimling (ghost, HP 2) ×5, Jelly Slime ×2, Dozy Bat ×2 |
| Chests | 3 gem `c` · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `g` glowbud door ([entities](#entities)). The `=` tiles in r7 are a **hidden bridge**: pit
until `lit:[r7:l1,r7:l2,r7:l3,r7:l4]`, then root planks rise in 1.0 s (`bridge_rise`).

```map under_roots L1
          #####X#####
          #t...@...t#
          #.........#
          #..?......#
          #.........#
          #I.......I#
          #.........#
          #.........#
###############O###############
#t...r...t#t.......t#t...s...c#
#.&.......#.........#.........#
#...b.....#l...2....#.........#
#.........g...2s2...L.........#
#.........#l...2....#_________#
#...P.k...#.........#l.....s..#
#.........#t.......t#...l...l.#
###############g##########D####
#..__l_..l#%.I...I.c#t.......t#
#K.____...#.........#.........#
#..____...#..e...e..#...111...#
#..====...L....k....g...1$1...#
#..____...#.I..e..I.#...111...#
#c.____...#.........#.........#
#..__l_..l#l.......l#t.......t#
##B############################
#t.................t#t.......t#
#...................#.........#
#...................#...111...#
#...................D...1I1...X
#....P.........P....#...111...#
#...................#.........#
#.........M.........#t.......t#
#...................###########
#...................#
#...................#
#...................#
#.........P.........#
#...................#
#...................#
#t.................t#
#####################
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Root Stair | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `@`(15,1) `t`(19,1) `?`(13,3) `I`(11,5) `I`(19,5) |
| r2 | The Drip Hall | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `t`(19,9) `l`(11,11) `s`(15,12) `l`(11,13) `t`(11,15) `t`(19,15) |
| r3 | The Rolled Tunnel | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `r`(5,9) `t`(9,9) `&`(2,10) `b`(4,11) `P`(4,14) `k`(6,14) |
| r4 | The Echo Gallery | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `s`(25,9) `c`(29,9) `l`(21,14) `s`(27,14) `l`(24,15) `l`(28,15) |
| r5 | The Bud Chamber | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `t`(29,17) `$`(25,20) `t`(21,23) `t`(29,23) |
| r6 | The Dark Root Run | L1 | [10, 16, 11, 9] | yes | 5 | `%`(11,17) `I`(13,17) `I`(17,17) `c`(19,17) `e`(13,19) `e`(17,19) `k`(15,20) `I`(12,21) `e`(15,21) `I`(18,21) `l`(11,23) `l`(19,23) |
| r7 | The Glow Pit | L1 | [0, 16, 11, 9] | yes | 5 | `l`(5,17) `l`(9,17) `K`(1,18) `c`(1,22) `l`(5,23) `l`(9,23) |
| r8 | Sir Rollo's Rolling Hall | L1 | [0, 24, 21, 17] | - | 7 | `t`(1,25) `t`(19,25) `P`(5,29) `P`(15,29) `M`(10,31) `P`(10,36) `t`(1,39) `t`(19,39) |
| r9 | The Heartwood | L1 | [20, 24, 11, 9] | - | 8 | `t`(21,25) `t`(29,25) `I`(25,28) `t`(21,31) `t`(29,31) |

**Room by room.**

- **r1 The Root Stair.** Arrival from the Nook stair (`X` (15,0) leads back up to Pip's Nook). Warm, lit, safe; two
  old root pillars. Sign `?`(13,3): "Lanterns by the Lamplighters. If one goes out, please light it again." Seen
  from `@`: the open arch south (15,8) with dripping light beyond.
- **r2 The Drip Hall.** Dim (not dark). A raised root dais (digit 2, a hop) holds crystal switch `r2:s1` (15,12).
  Hit it: lanterns `r2:l1` (11,11) and `r2:l2` (11,13) light (a gold vein runs along the floor from the dais to each
  lantern, R7), and the glowbud door (10,12) into r3 (`lit:[r2:l1,r2:l2]`) opens. The locked door (20,12) east is
  visible from the arch. The south glowbud door (15,16) is **`lanternOnly`** (shortcut from r6). Enemies: 2 Dozy Bats,
  wave 1 on entry, roosting in the ceiling roots (`spawns` at the two torches).
- **r3 The Rolled Tunnel.** Flattened smooth by Sir Rollo. Push-block `r3:b1` (4,11) pushed **south three times** to
  hold plate `r3:P1` (4,14): small key `r3:k1` (6,14) appears (`plate:r3:P1`, then `always` once picked up). Reset
  lever `r3:r1` (5,9). Map chest `&` (2,10). Enemies: 2 Jelly Slimes wave 1 (not needed to clear).
- **r4 The Echo Gallery.** Entered by the locked door (20,12) with `r3:k1`. A one-tile trench (row 13) crosses the
  room: hop it. Switch `r4:s1` (25,9) lights `r4:l1` (21,14) and `r4:l2` (24,15); switch `r4:s2` (27,14) lights
  `r4:l3` (28,15). Door (26,16) to r5: `lit:[r4:l1,r4:l2,r4:l3]`. Gem chest `r4:c1` (29,9), north-east corner.
  Every sound echoes once (a 0.25 s delayed copy at −8 dB): the room's name.
- **r5 The Bud Chamber.** A round dais (digit 1) and the treasure chest `$` (25,20): the **Glowbud Lantern**. Opening
  it plays scene `ch7_spark` ([story.md](./story.md#ch7)): a gold bud on the chest opens, Wenna's spark settles into
  the Lantern. Item-get: "You got the Glowbud Lantern! Press {tool} to hold it up. It lights the dark, opens glowbud
  doors and can Kindle lanterns." Door (20,20) west is `lanternOnly`.
- **r6 The Dark Root Run.** `dark: true`. Root pillars (13,17), (17,17), (12,21), (18,21). Three Dimlings wave 1 at
  (13,19), (17,19), (15,21), only hittable inside lamplight; when the wave poofs, small key `r6:k1` appears at
  (15,20) (`clear`). Chime Stone chest `%` (11,17); gem chest `r6:c1` (19,17). Two wall-lanterns `r6:l1` (11,23),
  `r6:l2` (19,23) are optional light (no door listens to them). North glowbud door (15,16) back to r2: `lanternOnly`
  (the shortcut). West locked door (10,20).
- **r7 The Glow Pit.** `dark: true`. A pit 4 tiles wide (cols 3-6) splits the room. Two islands (5,17) and (5,23),
  each one hop from the east floor over col 6, each with a wall-lantern (`r7:l1` (5,17), `r7:l3` (5,23)); two more on
  the east wall `r7:l2` (9,17), `r7:l4` (9,23). Kindle all four: the hidden bridge row 20 (3,20)-(6,20) rises. West
  floor: Root Key chest `K` (1,18), gem chest `r7:c1` (1,22), boss door `B` (2,24). Enemies: 2 Dimlings wave 1 drifting
  over the pit (they never block a landing tile).
- **r8 Sir Rollo's Rolling Hall.** Arena 19 × 15 tiles (38 × 30 m), ceiling 7 m, no pillars. Boss spawn `M` (10,31)
  curled asleep. Three **pit-plates** `P` at (5,29), (15,29), (10,36): round grates over shallow pits that only a
  curled Rollo can press (Pip walks over them). Creatures.md owns the fight; the arena gives it the three plates and
  the four walls to bonk. Door (20,28) east: `boss`.
- **r9 The Heartwood.** Ceiling 8 m. The glowing heartwood knot (`I` (25,28), prop `int_heartwood`) on a digit-1
  dais. Entering plays scene `ch7_heartwood` (Wenna explains the beacons; [story.md](./story.md#ch7)). Exit `X`
  (30,28) is a **root lift** up to Pip's Nook; it sets `S.dungeons.under_roots.done` on first use.

**Keys and chests ledger.** Small keys: `r3:k1` → door (20,12); `r6:k1` → door (10,20). Root Key in `K` (1,18) →
boss door (2,24). Chests: `&` (2,10), `r4:c1` (29,9), `$` (25,20), `%` (11,17), `r6:c1` (19,17), `K` (1,18),
`r7:c1` (1,22): 3 gem chests × 40 = 120 gems.

**Solver notes (the intended path).** r1 → r2: hop the dais, hit `r2:s1` → glowbud (10,12) opens → r3: take `&`,
push `b1` S×3 onto `P1`, take `k1` → r2 → unlock (20,12) → r4: hit `s1`, hop the trench, hit `s2` → door (26,16)
opens; take `c1` (hop back over the trench) → r5: open `$` (Lantern) → glowbud (20,20) with the Lantern → r6: poof 3
Dimlings, take `k1`, `%`, `c1` → unlock (10,20) → r7: hop to each island and Kindle 4 lanterns → bridge → `K`, `c1` →
`B` (2,24) → r8: calm Sir Rollo → door (20,28) → r9 → `X`. Shortcut proof: glowbud (15,16) opens from either side once
the Lantern is held, so r6 ↔ r2 makes a loop back to the entrance.

**Ask the Tree hints (nudge / plain).**
1. "That little crystal up on the root looks like it wants a bonk." / "Hop onto the raised root in the Drip Hall and
   swing at the crystal. Both lanterns light and the bud door opens."
2. "The square plate only listens to stone." / "Push the carved block in the Rolled Tunnel south three times, onto
   the square plate. A key pops up beside it."
3. "Four lanterns in the Glow Pit, and two of them are on little islands." / "Hop over the one-tile gaps to both
   islands and Kindle every lantern in the Glow Pit. A bridge grows across."

**Step split.** **Depth step S-060b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d1-depth). S-059 builds r1-r5 (the realm hidden behind `?realm=under_roots` until S-067), the root palette, the
hidden-bridge rule, the prints fixture and the realm-suite entry; the r5 chest gives the Lantern item from S-057.
S-060 adds r6-r9, the Dimling waves (S-058), the Root Key and boss door, and refreshes the prints. S-061 puts Sir
Rollo in r8. S-062 generates the textures and portrait. S-067 wires `ch7_spark`, `ch7_heartwood`, the root-lift exit
and `lanternGot`.

**Art (d1).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Root wall texture | `tex_dungeon_root` (`realm: under_roots`) | prompt in [kit](#kit) §2.1 | make_seamless, 1024/512 webp | canvas stripes |
| Glowroot texture | `tex_glowroot` (`realm: under_roots`) | "<style line> Seamless texture of smooth pale root wood with branching glowing amber veins like gentle lightning, dark umber between, tileable" | make_seamless, 512 webp (emissive map) | glow lines `#ffcf7a` on `#3a2a1f` |
| Heartwood knot | `int_heartwood` | code-built: a 2.2 m tall rounded knot of twisted root, slightly heart-shaped from the front, amber veins that pulse slowly (2.5 s), seven small hanging root-tips | - | the code model is the fallback |
| Hanging roots | `int_root_curtain` | code-built: 6-9 tapering root strands 1-2.5 m hanging from the ceiling, sway 0.3 Hz | - | - |
| Block skin | `int_block_root` | the kit block wrapped with two root bands | - | kit block |
| Drip FX | `fx_drip` | sprite strip 8 frames 64² of a water drop falling and a tiny gold splash ring | `process_strip.py` | a falling white dot |

ART BRIEF `int_heartwood`: silhouette a squat heart-shaped knot of three twisted roots, a soft spiral where they
meet; size 2.2 m tall, 1.8 m wide; palette `#5a3d2b`, `#8a5a3c`, veins `#ffcf7a`, moss tufts `#6f8f3a`; materials
matte bark, emissive veins; poly budget 1,200 tris (code 300); pose static with a 2.5 s vein pulse. Image prompt:
"<style line> A glowing knot of tree roots shaped softly like a heart, amber light in its veins, tufts of moss, in a
cosy underground root chamber, three-quarter view, concept art." 3D prompt: "Stylised low-poly heart-shaped knot of
twisted tree roots with glowing amber veins, moss tufts, hand-painted texture, cosy storybook style, game-ready, under
1,200 triangles, 2.2 m tall, origin at base."

---
<a id="d2"></a>
### d2 Whistlehollow

| Field | Value |
|---|---|
| Realm id / file | `whistlehollow` · `js/realms/dungeons/whistlehollow.js` |
| Where | inside the Whistling Pine, Pinewhistle (Whistle Rise); door in the pine's roots ([atlas-isles.md](./atlas-isles.md#pinewhistle)) |
| Opens | the Pinewhistle local chain's last "people" step ([story.md](./story.md#ch9-11)) sets `pinewhistleDepths`; the root door unseals |
| Needs on entry | Glowbud Lantern |
| Rooms · hours | 15 · 1.5 h (12 + annex 3, [§5A](#d2-depth)) |
| Signature mechanic | updrafts: knot-holes open and close by plates; open ones lift Pip; from room 6 he glides off their tops |
| Reward | **Leaf Glider** (`$` in r6) |
| Boss | **Mossmantle** in r12 ([creatures.md](./creatures.md#boss-mossmantle)); then the beacon |
| Levels | L1 the Roots (`at` [0,0], base 0 m) · L2 the Trunk (`at` [34,0], base 6 m) · L3 the Crown (`at` [0,20], base 14 m) |
| Grid | extent 65 × 47 tiles (130 × 94 m); realm grid 146 m |
| Palette | stone (bark) `#4a3526`, trim (resin) `#c98b4b`, accent (mist) `#e8efe9`, moss `#2f4a3a`, dark tint `#1d2a22` |
| Light / music | ambient 0.55, torches on, shafts of daylight through knot-holes (cards, not lights) · track `whistlehollow` (wind flute over a slow wooden marimba, 84 bpm) |
| Enemies | Mossling ×7, Pinecone Puff ×2, Needle Wasp ×4, Bark Beetle ×2 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `u` updraft knot-hole ([entities](#entities)). In d2 every `p` is a **toggle plate**: each
time Pip steps onto it, every updraft in its `flips` list changes state (open ↔ closed); it stays as left. Updraft
`top` is 3.0 m unless stated.

```map whistlehollow L1
###############################
#t.......t#...9c999s#9&9...9^9#
#.........#...999999#999...999#
#..?......#....u....#.u.....u.#
#.........O.........D.........#
#.I.....I.#.........#....p....#
#....@..^.#.p.......#..e...e..#
#.........#t.......t#t.......t#
#####X#########D###############
          #t.......t#
          #..e...e..#
          #.........#
          #....k....#
          #.ww...ww.#
          #...e.e...#
          #t.......t#
          ###########
```

```map whistlehollow L2
###############################
#t....9999#999__6666#6___...9c#
#.....9999L999__6666#6___...99#
#......u..#999__6666#6___.u...#
#.........#9$9__6666D6___.....#
#..b......#999__6666#6___.....#
#.^.......#999__6666#6___..%..#
#.....P...#999__6666#6___....t#
##########################D####
          #999__...t#t.......t#
          #9K9__....#..e...e..#
          #999__u...#.........#
          #.........D....k....#
          #.........#.........#
          #.......p.#..e...e..#
          #^.......t#^.......t#
          #####################
```

```map whistlehollow L3
#####################
#t66___99c#t.=====.c#
#.66___999#..=___=..#
#.u.___.u.#..=___=..#
#...___...L.==___==.#
#.p.___.p.#..=___=..#
#.^.___...#..=___=..#
#t..___..t#t.===.=.t#
###############B#####
#t.................t#
#...................#
#...................#
#...................#
#....I.........I....#
#...................#
#.........M.........#
#...................#
#...................#
#...................#
#...................#
#...................#
#....I.........I....#
#...................#
#.........!.........#
#...................#
#t.................t#
##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Root Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `I`(2,5) `I`(8,5) `@`(5,6) `^`(8,6) |
| r2 | The Knot Hall | L1 | [10, 0, 11, 9] | - | 7 | `c`(15,1) `s`(19,1) `u`(15,3) `p`(12,6) `t`(11,7) `t`(19,7) |
| r3 | The Sap Cellar | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `t`(19,9) `e`(13,10) `e`(17,10) `k`(15,12) `e`(14,14) `e`(16,14) `t`(11,15) `t`(19,15) |
| r4 | The Twin Drafts | L1 | [20, 0, 11, 9] | - | 7 | `&`(22,1) `^`(28,1) `u`(22,3) `u`(28,3) `p`(25,5) `e`(23,6) `e`(27,6) `t`(21,7) `t`(29,7) |
| r5 | The Resin Gallery | L2 | [0, 0, 11, 9] | - | 7 | `t`(1,1) `u`(7,3) `b`(3,5) `^`(2,6) `P`(6,7) |
| r6 | The Glider Loft | L2 | [10, 0, 11, 9] | - | 7 | `$`(12,4) |
| r7 | The Draft Hall | L2 | [20, 0, 11, 9] | - | 8 | `c`(29,1) `u`(26,3) `%`(27,6) `t`(29,7) |
| r9 | The Whistle Stair | L2 | [10, 8, 11, 9] | - | 7 | `t`(19,9) `K`(12,10) `u`(16,11) `p`(18,14) `^`(11,15) `t`(19,15) |
| r8 | The Wasp Hall | L2 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `t`(29,9) `e`(23,10) `e`(27,10) `k`(25,12) `e`(23,14) `e`(27,14) `^`(21,15) `t`(29,15) |
| r10 | The Needle Loft | L3 | [0, 0, 11, 9] | - | 7 | `t`(1,1) `c`(9,1) `u`(2,3) `u`(8,3) `p`(2,5) `p`(8,5) `^`(2,6) `t`(1,7) `t`(9,7) |
| r11 | The Bough Walk | L3 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `c`(19,1) `t`(11,7) `t`(19,7) |
| r12 | Mossmantle's Hollow | L3 | [0, 8, 21, 19] | - | 12 | `t`(1,9) `t`(19,9) `I`(5,13) `I`(15,13) `M`(10,15) `I`(5,21) `I`(15,21) `!`(10,23) `t`(1,25) `t`(19,25) |

**Stair warps.** L1 r4 `^`(28,1) ↔ L2 r5 `^`(2,6) · L2 r8 `^`(21,15) ↔ L1 r1 `^`(8,6) (the shortcut down) · L2 r9
`^`(11,15) ↔ L3 r10 `^`(2,6).

**Room by room.**

- **r1 The Root Door** (L1). `X` (5,8) to the pine's root door. Sign `?`(3,3): "Up the spiral to the Whistle. Keep
  the knot-holes clear. — L." (the Lamplighters' mark). The shortcut stair `^`(8,6) is sealed by a root curtain until
  Pip first arrives through it from L2 r8 (then it stays open).
- **r2 The Knot Hall** (ceiling 7). Toggle plate `r2:p1` (12,6) flips `r2:u1` (15,3) (starts closed). Ride it to
  the ledge (digit 9, 2.7 m): gem chest `r2:c1` (15,1) and switch `r2:s1` (19,1). Hitting `s1` opens door (20,4)
  **for good** (latching). Door (15,8) south: `always`, the r3 wave seals it.
- **r3 The Sap Cellar.** Resin puddles `w` (sticky shallow water look, same wade rule). Wave 1: Mossling ×3 at
  (13,10), (17,10), (14,14) and Pinecone Puff ×1 at (16,14). When it poofs: small key `r3:k1` (15,12) (`clear`).
- **r4 The Twin Drafts** (ceiling 7). `r4:u1` (22,3) starts open; `r4:u2` (28,3) starts closed; toggle plate
  `r4:p1` (25,5) flips both. Left ledge: map chest `&` (22,1). Right ledge: stair `^`(28,1) up to L2. Wave 1:
  Mossling ×2 at (23,6), (27,6).
- **r5 The Resin Gallery** (L2, ceiling 7). Push-block `r5:b1` (3,5): east ×3, then south ×2 onto hold plate
  `r5:P1` (6,7). While it is held, `r5:u1` (7,3) is open: ride to the ledge and unlock door (10,2) with `r3:k1`. No
  reset lever is needed (the block can always be pulled back by walking round it; the solver checks).
- **r6 The Glider Loft** (ceiling 7). West ledge (9) with treasure chest `$` (12,4): the **Leaf Glider**. Item-get:
  "You got the Leaf Glider! Hold {jump} in the air to glide. Updrafts lift you even higher." A two-tile gap (cols
  14-15) to a lower ledge (digit 6): the first glide. Door (20,4) `always`.
- **r7 The Draft Hall** (ceiling 8). Glide from the entry ledge (6) over the three-tile pit (cols 22-24) to the floor.
  `r7:u1` (26,3) is always open: ride it and glide to the perch (digit 9): gem chest `r7:c1` (29,1). Chime Stone chest `%`
  (27,6). Door (26,8) `always`.
- **r8 The Wasp Hall.** Wave 1: Needle Wasp ×2 at (23,10), (27,10) and Bark Beetle ×2 at (23,14), (27,14). Clear:
  small key `r8:k1` (25,12); door (20,12) to r9 opens (`clear`). Stair `^`(21,15) down to L1 r1 (shortcut).
- **r9 The Whistle Stair** (ceiling 7). Toggle plate `r9:p1` (18,14) opens `r9:u1` (16,11). Ride it and glide west
  over the two-tile pit (cols 14-15) to the ledge (9): Root Key chest `K` (12,10). Stair `^`(11,15) up to L3.
- **r10 The Needle Loft** (L3, ceiling 7). A three-tile pit (cols 4-6) splits the room. `r10:u1` (2,3) starts
  closed, `r10:u2` (8,3) starts open; **both** toggle plates `r10:p1` (2,5) and `r10:p2` (8,5) flip both. West: step
  `p1` (u1 opens), ride to the ledge (6), glide east over the pit. East: step `p2` (u2 opens), ride to the perch (9):
  gem chest `r10:c1` (9,1). Locked door (10,4) with `r8:k1`.
- **r11 The Bough Walk.** Plank boughs `=` round a central pit. Wave 1: Needle Wasp ×2 hovering over the pit (they dive
  along a stripe, shipped tell) and Pinecone Puff ×1 at (19,4). Gem chest `r11:c1` (19,1). Boss door (15,8).
- **r12 Mossmantle's Hollow** (ceiling 12). Arena 19 × 17 tiles. Four bough posts `I` at (5,13), (15,13), (5,21),
  (15,21) carry the boughs Mossmantle hangs from (creatures.md owns how). Boss spawn `M` (10,15). The beacon `!`
  (10,23): after the handover, `[E] Kindle · Beacon` (story beat in [story.md](./story.md#ch9-11): the pine sings
  within 10 s). `X` (10,26) leads to the pine's root door.

**Keys and chests ledger.** `r3:k1` → L (10,2) on L2; `r8:k1` → L (10,4) on L3; Root Key `K` (12,10) L2 → B (15,8)
L3. Gem chests `r2:c1`, `r7:c1`, `r10:c1`, `r11:c1` = 160 gems. Map r4, Chime Stone r7, Glider r6.

**Solver notes.** r1 → r2: `p1`, ride `u1`, take `c1`, hit `s1` → r3: clear wave, `k1` → r2 → r4: ride `u1`, `&`;
`p1`, ride `u2` → `^` → r5: block E3 S2, ride `u1`, unlock (10,2) → r6: `$` (Glider), glide → r7: glide, ride `u1`,
glide to `c1`, `%` → r8: clear, `k1`, `^` shortcut becomes known → r9: `p1`, ride, glide, `K` → `^` → r10: `p1`, ride
`u1`, glide E, `p2`, ride `u2`, `c1`, unlock (10,4) → r11: `c1`, B → r12: calm Mossmantle, Kindle → `X`.

**Ask the Tree hints.**
1. "Some plates open knot-holes, and some close them." / "In the Twin Drafts, ride the open knot-hole first for the
   map, then step on the plate to swap which knot-hole blows."
2. "That block looks like it would fit the square plate." / "In the Resin Gallery, push the block east three times
   and south twice onto the square plate. The knot-hole by the ledge starts blowing."
3. "Knot-holes still lift you while you glide." / "In the Needle Loft, ride the west knot-hole, glide east, then
   step on the east plate and ride the other one up to the chest."

**Step split.** **Depth step S-104b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d2-depth). S-103 builds L1 and L2 rooms r1-r6 (r6's chest gives the Glider from S-102), the updraft entity,
toggle plates, the prints and realm-suite entry. S-104 builds r7-r12, the stair pairs, the boss door and the beacon
tile (the Kindle itself is S-095's interactable), "every chest" solver run, prints refreshed. S-105 puts Mossmantle
in r12.

**Art (d2).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Pine-wood wall texture | `tex_pinewood` (`realm: pinewhistle`) | "<style line> Seamless texture of the inside of a giant pine tree, warm vertical wood grain with soft amber resin drips and small knots, tileable" | make_seamless, 1024/512 webp | vertical stripes `#4a3526` / `#6b4c35` |
| Knot-hole vent | `int_knothole` | code-built: 1.8 m round knot ring flush with the floor, a dark centre; when open, 12 leaf sprites spiral up the column (0.8 rev/s) and a soft whistle loop plays | - | ring + spinning leaf quads |
| Updraft leaves | `fx_leaf_spiral` | sprite sheet 4 × 2 frames 64² of a small pale-green leaf tumbling, transparent | `slice_sheet.py`, webp | a green quad |
| Bough post | `int_bough_post` | code-built: 1 m thick pine trunk post 12 m tall with two short boughs and moss | - | grey cylinder |
| Resin puddle | decal `dec_resin` | 256² transparent painted amber puddle | webp | amber disc |

ART BRIEF `int_knothole`: silhouette a ring-shaped wooden knot with growth rings, slightly raised lip; size 1.8 m
across, 0.15 m tall; palette `#4a3526`, `#c98b4b`, inner dark `#1d2a22`; materials matte wood; tris 300 (code 80);
pose static, leaves animate. Image prompt: "<style line> A round knot-hole in a wooden floor inside a giant pine,
leaves spiralling up out of it on a soft breeze, cosy fantasy interior." 3D prompt: "Stylised low-poly round wooden
knot-hole floor vent, growth rings, raised lip, hand-painted, game-ready, under 300 triangles, 1.8 m wide."

---
<a id="d3"></a>
### d3 Undertow Grotto

| Field | Value |
|---|---|
| Realm id / file | `undertow` · `js/realms/dungeons/undertow.js` |
| Where | sea caves under the Great Arch, Archwater; door at the Tidepool Shelf ([atlas-isles.md](./atlas-isles.md#archwater)) |
| Opens | Archwater's last "people" step sets `archwaterDepths` ([story.md](./story.md#ch9-11)) |
| Needs on entry | Glowbud Lantern |
| Rooms · hours | 16 · 1.5 h (14 + annex 2, [§5A](#d3-depth)) |
| Signature mechanic | tide rooms: each room belongs to a **basin** whose water is low or high; conch shells (rooms 1-7) and tide stones (rung with the Tide Bell, rooms 8-14) flip a basin |
| Reward | **Tide Bell** (`$` in r8) |
| Boss | **Old Gloop** in r14 ([creatures.md](./creatures.md#boss-gloop)); then the arch beacon |
| Grid | 41 × 43 tiles (82 × 86 m); realm grid 102 m |
| Palette | stone (basalt) `#36414f`, trim (pearl) `#e2c9a0`, accent (sea-glass) `#7fd3d0`, kelp `#3d6b4f`, violet `#6b4a8c`, dark tint `#1a2430` |
| Light / music | ambient 0.6, caustic light cards on walls, torches are sea-glass lamps · track `undertow` (plucked strings, slow tide swell every 8 s, 76 bpm) |
| Enemies | Tidepool Jelly ×5, Squirt Urchin ×5, Sand Snapper ×3 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `,` tide floor · `;` tide raft · `o` conch shell (sword hit flips its basin) · `Q` tide stone
(`[E] Ring · Tide stone`, needs the Tide Bell). Low water: `,` is dry floor at 0, `;` is a pit. High water: `,` is
deep water, `;` is a floating raft deck at 0. A tide change takes 1.5 s (water plane tween); it **never strands Pip**:
if his tile becomes water or pit under him, he is lifted to the nearest safe tile in 0.4 s. A block standing on a `,`
tile at high water sits on the bottom with its top 0.6 m above the water: a stepping stone, not pushable until low.

**Basins** (state saved as `state['tide:A']` etc.): **A** = r2, r3, starts low, flipped by `r2:o1` (12,6) and `r3:o1`
(21,1) · **B** = r5, r6, r7, starts high, flipped by `r5:o1` (29,9) and `r7:o1` (9,10) · **C** = r9, r10, r11, starts
high, flipped by `r9:Q1` (15,20) and `r11:Q1` (31,22). Other rooms have no tide.

```map undertow L1
#########################################
#t.......t#..,,,;;..#o,,,,,,,.#t.......c#
#.........#..,&,;;..#.,,,,,,,.#..I...I..#
#..?......#..,,,;;..#.,,,,,,,.#....e....#
X@........O..;;;;;..D.,,,k,,,.D.........#
#.ww...ww.#..,,,;;..#.,,,,,,,.#..e...e..#
#.........#.o,,,;;..#.,,,,,,,.#..I...I..#
#t.......t#t.,,,;;.t#t,,,.,,,t#t.......t#
#########################L#########D#####
#t;;;%;;;t#.,;;;,,,.#,,,,.;;;o#t...s...t#
#.;,,,,,;o#.,;c;,,,.#,,,,,,,,,#.ww.....c#
#.;,,,,,;.#.,;;;,,,.#,,,,,,,,,#.www.....#
#.;,,k,,;.D.,,,;;;;.D.,,,,,,,,#..ww..e..#
#.;,,,,,;.#.,,,,,,,.#,,,,,,,,,#....e....#
#.;;;;;;;.#.,,,,,,,.#,,ww,,,,,#.........#
#t.......t#t,,,,,,,t#t,,,,,,,t#t.......t#
#####D###########################D#######
#t.......t#t,,,,,,,t#t...,,,,t#.,.,;;222#
#.........#.,,,,,,,.#..b.,,,,.#.,,,;;2K2#
#...www...#.,,,,,,,.#....,,,,.#.,,,;;222#
#...w$w...D.;;;Q,,,.L....,,,P.D.;;;;;,,.#
#...www...#.,,,,,,,.#....,,,,.#.,,,,,,,.#
#.........#.,,,,,,,.#.r..,,,,.#Q,,,,,,,.#
#t.......t#t,,,,,,,t#t...,,,,t#t,,,.,,,t#
###################################D#####
          #t...~~~~~~~~~~~...t#t.......t#
          #....~~~~~~~~~~~....#.........#
          #....~~~~~M~~~~~....#..I...I..#
          #.....~~~~~~~~~.....B.........#
          #...................#..I...I..#
          #...................#.......c.#
          #...................#t.......t#
          #...................###########
          #...................#
          #...................#
          #...................#
          #...................#
          #...................#
          #...................#
          #.........!.........#
          #...................#
          #t.................t#
          ##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Sea Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `t`(1,7) `t`(9,7) |
| r2 | The Conch Hall | L1 | [10, 0, 11, 9] | - | 5 | `&`(14,2) `o`(12,6) `t`(11,7) `t`(19,7) |
| r3 | The Tidepool Room | L1 | [20, 0, 11, 9] | - | 5 | `o`(21,1) `k`(25,4) `t`(21,7) `t`(29,7) |
| r4 | The Urchin Gallery | L1 | [30, 0, 11, 9] | - | 5 | `t`(31,1) `c`(39,1) `I`(33,2) `I`(37,2) `e`(35,3) `e`(33,5) `e`(37,5) `I`(33,6) `I`(37,6) `t`(31,7) `t`(39,7) |
| r7 | The Drowned Stair | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `%`(5,9) `t`(9,9) `o`(9,10) `k`(5,12) `t`(1,15) `t`(9,15) |
| r6 | The Snapper Sands | L1 | [10, 8, 11, 9] | - | 5 | `c`(14,10) `t`(11,15) `t`(19,15) |
| r5 | The Kelp Pass | L1 | [20, 8, 11, 9] | - | 5 | `o`(29,9) `t`(21,15) `t`(29,15) |
| r12 | The Kelp Curtain | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `s`(35,9) `t`(39,9) `c`(39,10) `e`(37,12) `e`(35,13) `t`(31,15) `t`(39,15) |
| r8 | The Bell Chamber | L1 | [0, 16, 11, 9] | - | 5 | `t`(1,17) `t`(9,17) `$`(5,20) `t`(1,23) `t`(9,23) |
| r9 | The Stone Basin | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `t`(19,17) `Q`(15,20) `t`(11,23) `t`(19,23) |
| r10 | The Pearl Hall | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `t`(29,17) `b`(23,18) `P`(28,20) `r`(22,22) `t`(21,23) `t`(29,23) |
| r11 | The Echo Cave | L1 | [30, 16, 11, 9] | - | 5 | `K`(38,18) `Q`(31,22) `t`(31,23) `t`(39,23) |
| r13 | Gloop's Larder | L1 | [30, 24, 11, 9] | - | 5 | `t`(31,25) `t`(39,25) `I`(33,27) `I`(37,27) `I`(33,29) `I`(37,29) `c`(38,30) `t`(31,31) `t`(39,31) |
| r14 | The Moon Pool Hollow | L1 | [10, 24, 21, 19] | - | 14 | `t`(11,25) `t`(29,25) `M`(20,27) `!`(20,39) `t`(11,41) `t`(29,41) |

**Room by room.**

- **r1 The Sea Door.** `X` (0,4) to the Tidepool Shelf. Sign `?`(3,3): "When the arch lamp is lit, the sea comes and
  goes on time. When it isn't, ring for it." (Lamplighters).
- **r2 The Conch Hall** (A). Low: the `,` floor (cols 13-15) leads to the map chest `&` (14,2); the raft column
  (cols 16-17) is a 2-tile pit, so the east door cannot be reached. High: the row-4 rafts cross to the east strip and
  door (20,4) (`always`); `&` is cut off by water. Conch `r2:o1` (12,6) flips A.
- **r3 The Tidepool Room** (A). Arriving at high water, only the west strip is dry; hit conch `r3:o1` (21,1). At low
  water, wave 1: Tidepool Jelly ×3 at (23,3), (27,3), (25,6) (they start only once the floor is dry). Clear: small
  key `r3:k1` (25,4). Doors: east (30,4) `always` (reachable at low), south locked (25,8).
- **r4 The Urchin Gallery.** No tide. Four pillars as cover; wave 1: Squirt Urchin ×3 at (35,3), (33,5), (37,5)
  (turrets, they never move). Gem chest `r4:c1` (39,1). South door (35,8) opens only from r12 (switch `r12:s1`).
- **r5 The Kelp Pass** (B, starts high). Arrive on the dry stone (25,9); rafts (26-28,9) lead to conch `r5:o1`
  (29,9). Low water dries the whole room and opens the walk to door (20,12) (`always`).
- **r6 The Snapper Sands** (B). Low water: wave 1 Sand Snapper ×3 at (13,14), (17,14), (17,10); clear opens door
  (10,12) (`clear`). Gem chest `r6:c1` (14,10) sits in a ring of rafts: it can be opened only at **high** water,
  from the raft ring, reached from the east strip along the row-12 rafts (15-18,12). (Optional: flip B from r5 or r7.)
- **r7 The Drowned Stair** (B). A raft ring round a `,` floor. Low: walk in, take small key `r7:k1` (5,12) and the
  Chime Stone chest `%` (5,9) from (5,10). High: walk the raft ring. Conch `r7:o1` (9,10). Door (5,16) south `always`
  (the row-15 floor is dry at both levels).
- **r8 The Bell Chamber.** No tide. A rock in a shallow pool holds the treasure chest `$` (5,20): the **Tide Bell**.
  Item-get: "You got the Tide Bell! Press {tool} beside a tide stone to ring it. Low water, high water: your choice."
  Door (10,20) east: `chest:r8:$1` (opens when the bell is taken).
- **r9 The Stone Basin** (C, starts high). Rafts (12-14,20) lead to tide stone `r9:Q1` (15,20): ring it, the basin
  drains, walk east to locked door (20,20). Wave (at low): Squirt Urchin ×2 at (13,18), (17,22).
- **r10 The Pearl Hall** (C). At low water push block `r10:b1` (23,18) east ×5 to (28,18), then south ×2 onto hold
  plate `r10:P1` (28,20): door (30,20) opens while it is held (`plate`). Reset lever `r10:r1` (22,22). If the basin
  rises mid-push the block becomes a stepping stone until low.
- **r11 The Echo Cave** (C). Root Key chest `K` (38,18) on a shelf (digit 2). High water: the row-20 rafts and the
  raft columns (35-36, 17-20) reach the shelf (hop up 2 digits). Low water: the shelf is cut off by a 2-tile pit,
  and the doors north (33,16) and south (35,24) can be walked to. Tide stone `r11:Q1` (31,22) on the west strip.
  Sounds here repeat twice (echo 0.3 s and 0.6 s).
- **r12 The Kelp Curtain.** No tide. Kelp curtains (decor cards) hang from the ceiling. Wave 1: Tidepool Jelly ×2 at
  (37,12), (35,13). Gem chest `r12:c1` (39,10). Switch `r12:s1` (35,9) opens door (35,8) to r4 for good (the
  shortcut home).
- **r13 Gloop's Larder.** Eight knitted socks drying on two lines (decor), four barrels of pickled kelp. Gem chest
  `r13:c1` (38,30). Boss door (30,28) west.
- **r14 The Moon Pool Hollow** (ceiling 14). Arena 19 × 17 tiles; the deep Moon Pool `~` (cols 15-25, rows 25-28)
  where Old Gloop rests, boss spawn `M` (20,27). The arch beacon `!` (20,39) on the south floor; a shaft of daylight
  from the arch above lights it. After the handover, `[E] Kindle · Beacon` (the tide turns in the overworld within
  10 s, [story.md](./story.md#ch9-11)). `X` (20,42) to the Tidepool Shelf.

**Keys and chests ledger.** `r3:k1` → L (25,8); `r7:k1` → L (20,20); `K` (38,18) → B (30,28). Gem chests `r4:c1`
(39,1), `r6:c1` (14,10), `r12:c1` (39,10), `r13:c1` (38,30) = 160 gems. Map r2, Chime Stone r7, Tide Bell r8.

**Solver notes.** r1 → r2 (A low): `&`; `o1` (A high) → rafts → r3: `o1` (A low), clear, `k1` → r4: `c1` (optional) →
r3 → unlock (25,8) → r5 (B high): rafts, `o1` (B low) → r6: clear → r7: `k1`, `%`; `o1` (B high) → r6 rafts are up
but the west strip is cut off: back to r7, `o1` (B low), cross r6 dry, r5 `o1` from (29,10) (B high), r6 east rafts →
`c1`; r5 `o1` (B low) → r6 → r7 → r8: `$` (Tide Bell) → r9: rafts, ring `Q1` (C low) → unlock (20,20) → r10: block
E5 S2 → r11: ring `Q1` (C high) → rafts → `K`; ring `Q1` (C low) → r12: `c1`, `s1` (shortcut) → r11 → r13: `c1` → B →
r14: calm Old Gloop, Kindle → `X`. The `r6:c1` detour is optional for the exit but required for "every chest".

**Ask the Tree hints.**
1. "Shells by the water remember the tide." / "Swing at the conch shell. The water in this part of the grotto goes up
   or down, and rafts float when it is high."
2. "The chest in the Snapper Sands floats on its own little ring." / "Flip the Kelp Pass conch to high water, then
   walk the rafts from the east side of the Snapper Sands to the chest."
3. "A Root Key on a shelf above the rafts." / "In the Echo Cave, ring the tide stone for high water, ride the rafts to
   the shelf and hop up. Ring it again for low water to leave."

**Step split.** **Depth step S-125b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d3-depth). S-124 builds r1-r7 (basins A and B, conch shells, `,` `;` tiles, the never-strand rule), prints and
realm-suite entry. S-125 builds r8-r14 (the Tide Bell chest; tide stones need S-122's ability), the boss door and the
beacon tile; prints refreshed. S-126 puts Old Gloop in r14.

**Art (d3).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Basalt wall texture | `tex_basalt` (`realm: archwater`) | "<style line> Seamless texture of hexagonal basalt columns seen from the side, cool blue-grey, soft sea-glass highlights, a little barnacle and kelp, tileable" | make_seamless 1024/512 webp | hex canvas `#36414f` / `#4b5768` |
| Caustic light card | `fx_caustics` | 512² transparent painted water-caustic light pattern, soft aqua, loops when scrolled | webp, scroll UV | none (off) |
| Conch shell switch | `int_conch` | code-built: 0.9 m spiral conch on a rock, pearl outside `#e2c9a0`, pink lip `#f4a6a0`; glows aqua for 0.5 s when it flips | - | kit crystal switch tinted pearl |
| Tide stone | `int_tide_stone` | code-built: 1.6 m standing stone with a carved wave spiral and a little bronze bell cup on top; the spiral glows `#7fd3d0` when rung | - | grey box with a spiral decal |
| Raft deck | `int_raft` | code-built: 2 × 2 m raft of five round logs bound with rope, bobs 0.05 m at high water | - | plank deck |
| Kelp curtain | `card_kelp` | 512 × 1024 transparent painted hanging kelp strands, green-gold | webp | green quads |
| Sock line | `int_sock_line` | code-built: rope between two posts with eight small knitted socks in eight colours (`#e66f4f #f2b45a #7fae4b #7fd3d0 #8fa8ff #c9b6ec #ff9fb4 #f4f1ea`) | - | - |

ART BRIEF `int_tide_stone`: silhouette a rounded standing stone a little taller than Pip, a wave spiral carved on the
front, a small bronze bell cup on top; size 1.6 × 0.9 × 0.6 m; palette `#36414f`, `#e2c9a0`, bronze `#b0793a`, glow
`#7fd3d0`; materials matte stone, soft bronze sheen; tris 900 (code 200); pose static, the glow pulses 1 s when rung.
Image prompt: "<style line> A friendly standing stone on a sea-cave floor with a carved wave spiral and a tiny bronze
bell on top, tide pools around it." 3D prompt: "Stylised low-poly standing stone with a carved wave spiral and a small
bronze bell cup on top, hand-painted, game-ready, under 900 triangles, 1.6 m tall."

---
<a id="d4"></a>
### d4 The Granary Vaults

| Field | Value |
|---|---|
| Realm id / file | `granary` · `js/realms/dungeons/granary.js` |
| Where | under Tumble Hill, Threemills; the vault door beside Middle Mill ([atlas-isles.md](./atlas-isles.md#threemills)) |
| Opens | Threemills' last "people" step sets `threemillsDepths` ([story.md](./story.md#ch9-11)) |
| Needs on entry | Glowbud Lantern |
| Rooms · hours | 15 · 1.5 h (12 + annex 3, [§5A](#d4-depth)) |
| Signature mechanic | gears and hay: hay-bale push-blocks that **fill pits**; cranks and hub wheels rotate gear-bridges; hookblooms after room 7 |
| Reward | **Thistle Hook** (`$` in r7) |
| Boss | **Lady Honksworth** in r12 ([creatures.md](./creatures.md#boss-honksworth)); then the granary's sun-lamp beacon |
| Grid | 37 × 41 tiles (74 × 82 m); realm grid 98 m |
| Palette | stone (brick) `#a4573f`, trim (oak) `#7a5232`, accent (straw) `#e7c45a`, iron `#5b5e66`, dark tint `#2a1c14` |
| Light / music | ambient 0.6, dusty light shafts (cards), torches are tin lanterns · track `granary` (fiddle and accordion, slower than the overworld, a ticking gear loop, 96 bpm) |
| Enemies | Field Vole gang ×9 (swarm), Woolly Ram ×2, Scarecrowlet ×3 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `G` gear-bridge hub · `y` crank · `h` hookbloom. In d4 every `b` is a **hay bale**: it pushes
like a block and, pushed onto a `_` tile, drops in and **fills it** (that tile becomes floor at 0 for good, the bale
is used up). The room's reset lever lifts every bale back to its start, including filled ones. **Gear-bridges**: the
pit tiles round a `G` hold arms of `len` tiles that point either north-south (`NS`) or east-west (`EW`); the arm tiles
are a bridge deck in the current state and a pit otherwise. Turning takes 1.0 s. A crank `y` (`[E] Use · Crank` or a
sword hit) turns its listed hub 90°; it will not turn while Pip stands on an **arm**. The hub `G` itself carries a
wheel: standing on it, `[E] Use · Wheel` turns the bridge **with Pip riding** on the hub.

```map granary L1
###############################
#t.......t#t...&...t#.y__c____#
#.........#.........#.._______#
#..?......#..b...P..#.._______#
X@........O.........D..__G____#
#.I.....I.#.........#.._______#
#.........#.........#.._______#
#t.......t#t...r...t#..__.____#
#########################D#####
#t.......t#t.......r#t.......t#
#.......y.#.........#..e...e..#
#.........#..b...b..#.........#
#________.L.........D....k....#
#__c_G____#_________#.e.....e.#
#_________#_________#....e....#
#____.____#t...%...t#t.......t#
#####D#########################
#t....__.t#t.......c#t.....6hc#
#.....__.h#h.______.#......666#
#..$..__..#..__k___.#..e......#
#.....__..D..__.h__.D.........#
#.....__..#..______.#......e..#
#.....__..#..______.#..e......#
#t....__.t#t.......t#t.......t#
###############L#########B###########
#t_______t#t.......t#t.............t#
#._______.#..e...e..#...............#
#._______.#.........#...............#
#K___G___.D.....y...#...............#
#._______.#.e.....e.#...............#
#._______.#.........#.......M.......#
#t_______t#t.......t#...............#
#####################...............#
                    #...............#
                    #...............#
                    #...............#
                    #...............#
                    #.......!.......#
                    #...............#
                    #t.............t#
                    ########X########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Barn Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Bale Room | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `&`(15,1) `t`(19,1) `b`(13,3) `P`(17,3) `t`(11,7) `r`(15,7) `t`(19,7) |
| r3 | The Gear Hall | L1 | [20, 0, 11, 9] | - | 7 | `y`(22,1) `c`(25,1) `G`(25,4) |
| r6 | The Flour Loft | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `y`(8,10) `c`(3,13) `G`(5,13) |
| r5 | The Millstone Room | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `r`(19,9) `b`(13,11) `b`(17,11) `t`(11,15) `%`(15,15) `t`(19,15) |
| r4 | The Vole Hall | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `t`(29,9) `e`(23,10) `e`(27,10) `k`(25,12) `e`(22,13) `e`(28,13) `e`(25,14) `t`(21,15) `t`(29,15) |
| r7 | The Hook Store | L1 | [0, 16, 11, 9] | - | 5 | `t`(1,17) `t`(9,17) `h`(9,18) `$`(3,19) `t`(1,23) `t`(9,23) |
| r8 | The Sack Hall | L1 | [10, 16, 11, 9] | - | 7 | `t`(11,17) `c`(19,17) `h`(11,18) `k`(15,19) `h`(16,20) `t`(11,23) `t`(19,23) |
| r9 | The Sail Room | L1 | [20, 16, 11, 9] | - | 7 | `t`(21,17) `h`(28,17) `c`(29,17) `e`(23,19) `e`(27,21) `e`(23,22) `t`(21,23) `t`(29,23) |
| r10 | The Grain Chute | L1 | [0, 24, 11, 9] | - | 7 | `t`(1,25) `t`(9,25) `K`(1,28) `G`(5,28) `t`(1,31) `t`(9,31) |
| r11 | The Chaff Hall | L1 | [10, 24, 11, 9] | - | 5 | `t`(11,25) `t`(19,25) `e`(13,26) `e`(17,26) `y`(16,28) `e`(12,29) `e`(18,29) `t`(11,31) `t`(19,31) |
| r12 | Lady Honksworth's Mill Floor | L1 | [20, 24, 17, 17] | - | 12 | `t`(21,25) `t`(35,25) `M`(28,30) `!`(28,37) `t`(21,39) `t`(35,39) |

**Gear-bridges:** `r3:G1` (25,4) len 2, starts `NS`, crank `r3:y1` (22,1) · `r6:G1` (5,13) len 1, starts `EW`, crank
`r6:y1` (8,10) · `r10:G1` (5,28) len 3, starts `NS`, crank `r11:y1` (16,28) in the next room (an iron chain runs
along the shared wall at waist height between them, R7).

**Room by room.**

- **r1 The Barn Door.** `X` (0,4) to Middle Mill. Sign `?`(3,3): "Granary Vaults. Bales go where you push them.
  Mind the gears." Two crates and a barrel (decor).
- **r2 The Bale Room.** Hay bale `r2:b1` (13,3) pushed east ×4 onto hold plate `r2:P1` (17,3) holds door (20,4) open
  (`plate`). Map chest `&` (15,1). Reset lever `r2:r1` (15,7).
- **r3 The Gear Hall** (ceiling 7). Crank `y1` turns `G1` from `NS` to `EW`: walk out to the hub. Use the hub wheel
  (`NS`) and go north to gem chest `r3:c1` (25,1) or south to the landing (25,7) and door (25,8) (`always`).
- **r4 The Vole Hall.** Wave 1: Field Vole gang ×5 at (23,10), (27,10), (22,13), (28,13), (25,14) (a swarm: 1 HP each,
  at most 2 nipping at once). Clear: small key `r4:k1` (25,12). Door (20,12) west `always`.
- **r5 The Millstone Room.** A 2-tile pit band (rows 13-14) cuts off the Chime Stone chest `%` (15,15). Fill one column
  with both bales: `r5:b1` (13,11) south ×2 fills (13,13); `r5:b2` (17,11) west ×4 then south ×3 fills (13,14). (The
  mirror solution in column 17 also works.) Reset lever `r5:r1` (19,9). Locked door (10,12) west.
- **r6 The Flour Loft.** Wave 1: Woolly Ram ×2 at (3,10), (7,11) charge along stripes (shipped charger tell) on the
  floor rows 9-11. Crank `y1` (8,10) turns `G1` to `NS`; walk the arm to the hub, wheel to `EW`, take gem chest
  `r6:c2` (3,13) from the west arm; wheel back to `NS`, go south to door (5,16) (`always`).
- **r7 The Hook Store.** Treasure chest `$` (3,19): the **Thistle Hook**. Item-get: "You got the Thistle Hook! Aim at
  a big purple hookbloom and press {tool}. Whoosh!" A 2-tile pit (cols 6-7); hook hookbloom `r7:h1` (9,18) from the
  west floor, land at (8,18), door (10,20) (`always`).
- **r8 The Sack Hall** (ceiling 7). A 6-wide pit with an island: hook `r8:h2` (16,20) from (12,20), land on (15,20),
  take small key `r8:k1` (15,19); hook `r8:h1` (11,18) to return, land at (12,18). Gem chest `r8:c3` (19,17). Doors:
  east (20,20) `always`, south locked (15,24).
- **r9 The Sail Room** (ceiling 7). Wave 1: Scarecrowlet ×3 at (23,19), (27,21), (23,22) (turrets, straw darts on a
  0.6 s glint). A loft (digit 6) in the north-east: hook `r9:h1` (28,17) from below, land on (28,18), gem chest
  `r9:c4` (29,17). Boss door (25,24).
- **r10 The Grain Chute** (ceiling 7). A pit with `G1` (len 3). From r11, the crank turns it to `EW`; cross to the
  Root Key chest `K` (1,28) (open it from the arm tile (2,28)).
- **r11 The Chaff Hall.** Wave 1: Field Vole gang ×4 at (13,26), (17,26), (12,29), (18,29). Crank `r11:y1` (16,28)
  turns `r10:G1`. Door (10,28) west `always`.
- **r12 Lady Honksworth's Mill Floor** (ceiling 12). Arena 15 × 15 tiles. The east wall (col 36) is the **gear
  wall**: a relief of three wooden gears 4, 3 and 2 m across that turn when she charges into it (creatures.md owns
  the charge). Boss spawn `M` (28,30). The granary's sun-lamp beacon `!` (28,37). After the handover, `[E] Kindle ·
  Beacon` (the mill sails turn within 10 s, [story.md](./story.md#ch9-11)). `X` (28,40) to Middle Mill.

**Keys and chests ledger.** `r4:k1` → L (10,12); `r8:k1` → L (15,24); `K` (1,28) → B (25,24). Gem chests `r3:c1`
(25,1), `r6:c2` (3,13), `r8:c3` (19,17), `r9:c4` (29,17) = 160 gems. Map r2, Chime Stone r5, Hook r7.

**Solver notes.** r1 → r2: bale E4, `&` → r3: crank (`EW`), hub, wheel (`NS`), `c1`, south → r4: clear, `k1` → r5:
bales fill column 13, `%` → unlock (10,12) → r6: clear, crank (`NS`), hub, wheel (`EW`), `c2`, wheel (`NS`), south →
r7: `$` (Hook), hook `h1` → r8: hook `h2`, `k1`, hook `h1` back, `c3` → unlock (15,24) → r11: clear, crank → r10: cross,
`K` → r11 → r8 → r9: hook to the loft, `c4` → B → r12: calm Lady Honksworth, Kindle → `X`.

**Ask the Tree hints.**
1. "Bridges on gears like to be turned from the middle, too." / "Use the crank to swing the bridge round, walk to the
   middle, then use the wheel there. The bridge turns with you on it."
2. "Hay is heavier than it looks. Pits are shallower than they look." / "Push both bales into the same column of the
   pit in the Millstone Room. Two bales make a path across."
3. "The chain on the wall goes somewhere." / "The crank in the Chaff Hall turns the bridge in the Grain Chute next
   door. Turn it, then walk across to the Root Key."

**Step split.** **Depth step S-146b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d4-depth). S-145 builds r1-r6 (hay bales with pit fill, gear-bridges, cranks, hub wheels), prints and
realm-suite entry. S-146 builds r7-r12 (the Hook chest uses S-143's ability; hookblooms; the cross-room crank), boss
door, beacon tile; prints refreshed. S-147 puts Lady Honksworth in r12.

**Art (d4).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Brick and beam texture | `tex_granary` (`realm: threemills`) | "<style line> Seamless texture of an old granary wall, warm terracotta bricks with oak beams and a dusting of flour and straw, tileable" | make_seamless 1024/512 | `tex_dungeon_brick` |
| Hay bale | `int_bale` | code-built: 1.9 m rounded hay cube, two twine bands, stray straw quads | - | kit block tinted `#e7c45a` |
| Gear-bridge | `int_gear_bridge` | code-built: an oak hub 1.8 m with an iron gear rim (16 teeth), plank arms 2 m wide per tile, iron edge bands | - | plank deck + grey disc |
| Crank | `int_crank` | code-built: 1 m iron crank handle on a small gearbox post, turns 180° when used | - | lever |
| Hookbloom | `int_hookbloom` | code-built (shared with the overworld gate of S-143): 2.4 m stem with a 0.9 m spiky purple thistle head `#8a4fb0`, leaves `#5f8a4a` | - | purple sphere on a stick |
| Gear wall | `int_gear_wall` | code-built relief: three wooden gears 4, 3, 2 m on the arena's east wall, rotating 30°/s for 2 s when hit | - | flat gear decal |
| Dust shaft | `card_dust_shaft` | 256 × 1024 transparent painted shaft of warm light with floating dust motes | webp | none |

ART BRIEF `int_bale`: silhouette a soft rounded cube of hay with two twine bands and a few stray straws; size 1.9 m;
palette `#e7c45a`, shade `#c9a24a`, twine `#7a5232`; materials matte straw; tris 400 (code 60); pose static, wobbles
0.1 s when pushed. Image prompt: "<style line> A plump hay bale tied with twine in a cosy granary, straw poking out,
warm light." 3D prompt: "Stylised low-poly rounded hay bale cube with two twine bands and stray straws, hand-painted,
game-ready, under 400 triangles, 1.9 m."

---
<a id="d5"></a>
### d5 The Lamplighters' Tower

| Field | Value |
|---|---|
| Realm id / file | `tower` · `js/realms/dungeons/tower.js` |
| Where | the 28 m Lamplighters' Tower on Tower Head, Duskwick ([atlas-isles.md](./atlas-isles.md#duskwick)) |
| Opens | flag `towerOpen` (3rd-beacon beat, [story.md](./story.md#beacon-3)) unseals the door the Wickwork Moth locked |
| Chapter | ch12 ([story.md](./story.md#ch12)) |
| Needs on entry | Glowbud Lantern, and the three Act II tools (none needed inside) |
| Rooms · hours | 13 · 1.75 h (10 + annex 3, [§5A](#d5-depth)) |
| Signature mechanic | beams: brass mirrors (a sword hit turns one 45°) bounce skylight beams into receivers; from floor 3 Pip's own **Sunglass** beam joins in |
| Reward | **Sunglass** (`$` in r5) and a **heart container** (`H` in r9) |
| Boss | **the Wickwork Moth** in r10 ([creatures.md](./creatures.md#boss-wickwork-moth)); then the great lamp (the Firstlight scene) |
| Levels | F1 `at` [0,0] base 0 · F2 `at` [24,0] base 5 m · F3 `at` [48,0] base 10 m · F4 `at` [0,14] base 15 m · F5 `at` [24,14] base 20 m |
| Grid | extent 72 × 31 tiles (144 × 62 m); realm grid 160 m |
| Palette | stone (whitewash) `#efe6d6`, trim (brass) `#c9a24a`, accent (lamp gold) `#f2b45a`, night `#2b2238`, coral `#ff8f7a`, dark tint `#2b2238` |
| Light / music | ambient 0.6 (r4 dark), round windows show the sea and sky (cards); beams are additive gold ribbons 0.25 m wide · track `tower` (dusk marimba slowed, a ticking clockwork bass, 80 bpm) |
| Enemies | Sizzle Beetle ×4, Coco Clonk ×3, Dimling ×5 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure · heart container |
| Keys | 2 small (one opens a locked hatch), 1 big |

**Legend extension:** `S` beam source (fixed skylight; `dir` below) · `R` receiver · `/` `\` mirror · `m` mirror in a
blocking state (`|` or `-`, given below). Mirror cycle on each sword hit: `/` → `|` → `\` → `-` → `/`. Reflection:
`/` turns north→east, east→north, south→west, west→south; `\` turns north→west, west→north, south→east, east→south;
`|` and `-` stop the beam. Beams pass over Pip and enemies (they never block a beam). Receivers are **live** unless
marked latch. A `^` can be a **hatch** with a condition (closed hatch = a wooden trapdoor lid over the stairs).

```map tower F1
#####################
#t.......t#t......^t#
#S...../..#.........#
#.........#..e...e..#
#..?......#.........#
#.........D....k....#
#.........#.........#
#.........#..&...e..#
#......R..#.........#
#t...@...t#t.......t#
#####X###############
```

```map tower F2
#####################
#c...S..Rt#l.......c#
#.........#.........#
#.........#..e...e..#
#.........#.........#
#..../..m.#....e....#
#.........#.........#
#.........D.........#
#.........#.........#
#.^.......#l......^l#
#####################
```

```map tower F3
#####################
#t...R...t#t...%...t#
#.........#.........#
#.........#..e...e..#
#...111...#.........#
#...1$1...L.........#
#...111...#.........#
#.........#..c......#
#.........#.........#
#t......^t#t......^t#
#####################
```

```map tower F4
#####################
#t.......t#R/.I....K#
#...\....S#I........#
#.........#..e...e..#
#.........#.........#
#m........D.........#
#.........#....k....#
#...R.....#..e...e..#
#.........#.........#
#R......^c#t......^t#
#####################
```

```map tower F5
###########################
#R...H...R#t.............t#
#.........#...............#
#/.......m#.......M.......#
#.........#...............#
#.........B...............#
#.........#...............#
#.........#......222......#
#.........#......2!2......#
#.^......S#......222......#
###########...............#
          #...............#
          #...............#
          #...............#
          #...............#
          #t.............t#
          ########X########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Tower Door | F1 | [0, 0, 11, 11] | - | 5 | `t`(1,1) `t`(9,1) `S`(1,2) `/`(7,2) `?`(3,4) `R`(7,8) `t`(1,9) `@`(5,9) `t`(9,9) |
| r2 | The Oil Store | F1 | [10, 0, 11, 11] | - | 5 | `t`(11,1) `^`(18,1) `t`(19,1) `e`(13,3) `e`(17,3) `k`(15,5) `&`(13,7) `e`(17,7) `t`(11,9) `t`(19,9) |
| r3 | The Mirror Gallery | F2 | [0, 0, 11, 11] | - | 5 | `c`(1,1) `S`(5,1) `R`(8,1) `t`(9,1) `/`(5,5) `m`(8,5) `^`(2,9) |
| r4 | The Wick Room | F2 | [10, 0, 11, 11] | yes | 5 | `l`(11,1) `c`(19,1) `e`(13,3) `e`(17,3) `e`(15,5) `l`(11,9) `^`(18,9) `l`(19,9) |
| r5 | The Lens Workshop | F3 | [0, 0, 11, 11] | - | 5 | `t`(1,1) `R`(5,1) `t`(9,1) `$`(5,5) `t`(1,9) `^`(8,9) `t`(9,9) |
| r6 | The Chart Room | F3 | [10, 0, 11, 11] | - | 5 | `t`(11,1) `%`(15,1) `t`(19,1) `e`(13,3) `e`(17,3) `c`(13,7) `t`(11,9) `^`(18,9) `t`(19,9) |
| r7 | The Prism Hall | F4 | [0, 0, 11, 11] | - | 5 | `t`(1,1) `t`(9,1) `\`(4,2) `S`(9,2) `m`(1,5) `R`(4,7) `R`(1,9) `^`(8,9) `c`(9,9) |
| r8 | The Clockwork Room | F4 | [10, 0, 11, 11] | - | 5 | `R`(11,1) `/`(12,1) `I`(14,1) `K`(19,1) `I`(11,2) `e`(13,3) `e`(17,3) `k`(15,6) `e`(13,7) `e`(17,7) `t`(11,9) `^`(18,9) `t`(19,9) |
| r9 | The Gallery Walk | F5 | [0, 0, 11, 11] | - | 5 | `R`(1,1) `H`(5,1) `R`(9,1) `/`(1,3) `m`(9,3) `^`(2,9) `S`(9,9) |
| r10 | The Lamp Room | F5 | [10, 0, 17, 17] | - | 16 | `t`(11,1) `t`(25,1) `M`(18,3) `!`(18,8) `t`(11,15) `t`(25,15) |

**Stair warps.** F1 r2 `^`(18,1) ↔ F2 r3 `^`(2,9) · F2 r4 `^`(18,9) (hatch, `lit:[r4:l1,l2,l3]`) ↔ F3 r6 `^`(18,9) · F3
r5 `^`(8,9) (hatch, `R` `r5:R1` latch) ↔ F4 r7 `^`(8,9) · F4 r8 `^`(18,9) (**locked hatch**, one small key) ↔ F5 r9
`^`(2,9).

**Room by room.**

- **r1 The Tower Door** (F1). `X` (5,10) to Tower Head. Sign `?`(3,4): "Turn the mirrors. Mind the lamp. Do not wind
  the moth. — Wick" (Granny Wick's old note; the Wickwork Moth is her family's automaton). Skylight `r1:S1` (1,2) shines
  **east**; mirror `r1:/1` (7,2) starts `/`: two hits make it `\` and the beam runs south to receiver `r1:R1` (7,8)
  (latch), which opens door (10,5).
- **r2 The Oil Store.** Wave 1: Sizzle Beetle ×2 at (13,3), (17,3), Coco Clonk ×1 at (17,7). Clear: small key
  `r2:k1` (15,5). Map chest `&` (13,7). Stair `^`(18,1) up.
- **r3 The Mirror Gallery** (F2). Skylight `r3:S1` (5,1) shines **south** onto mirror `r3:/1` (5,5) (starts `/`, needs
  `\`: two hits), then east onto mirror `r3:m1` (8,5) (starts `-`, needs `/`: one hit), then north to receiver
  `r3:R1` (8,1) (latch): door (10,7) opens. Gem chest `r3:c1` (1,1).
- **r4 The Wick Room** (dark). Wave 1: Dimling ×3 at (13,3), (17,3), (15,5). Kindle the three wall-lanterns `r4:l1`
  (11,1), `r4:l2` (11,9), `r4:l3` (19,9): the hatch `^`(18,9) opens. Gem chest `r4:c2` (19,1).
- **r5 The Lens Workshop** (F3). Behind locked door (10,5) (`r2:k1`). Treasure chest `$` (5,5) on a dais: the
  **Sunglass**. Item-get: "You got the Sunglass! Hold up the Lantern with {tool} and it shines a beam
  wherever you look. Receivers love it." Beaming receiver `r5:R1` (5,1) (latch) opens the hatch `^`(8,9).
- **r6 The Chart Room.** Arrival from F2. Old sea charts on the walls (decor cards). Wave 1: Coco Clonk ×2 at (13,3),
  (17,3). Chime Stone chest `%` (15,1); gem chest `r6:c3` (13,7). Locked door (10,5) west.
- **r7 The Prism Hall** (F4). Skylight `r7:S1` (9,2) shines **west** onto mirror `r7:\1` (4,2) (starts `\`, needs `/`:
  two hits), then south to receiver `r7:R1` (4,7). Receiver `r7:R2` (1,9) takes Pip's beam (directly, or along row 5
  off mirror `r7:m1` (1,5), which starts `-` and needs `/`: one hit). Door (10,5) opens **for good the first moment
  both receivers are lit together**. Gem chest `r7:c4` (9,9).
- **r8 The Clockwork Room.** Wave 1: Sizzle Beetle ×2 at (13,3), (17,3), Dimling ×2 at (13,7), (17,7). Clear: small
  key `r8:k1` (15,6). Root Key chest `K` (19,1) sits in a brass cage that lifts (latch) when receiver `r8:R1` (11,1)
  is lit: pillars `I` (14,1) and (11,2) block every straight shot, so Pip beams **north up column 12** onto mirror
  `r8:/1` (12,1) (starts `/`, needs `\`: two hits), which turns the beam west into the receiver. Hatch `^`(18,9) is
  locked: it takes `r8:k1`.
- **r9 The Gallery Walk** (F5). Round windows all along the outer wall show Duskwick at dusk. The heart container
  chest `H` (5,1) sits in a brass cage that lifts (latch) the first moment receivers `r9:R1` (1,1) **and** `r9:R2`
  (9,1) are lit together: skylight `r9:S1` (9,9) shines **north** onto `r9:m1` (9,3) (starts `|`, needs `\`: one hit),
  west along row 3 onto `r9:/1` (1,3) (starts `/`, needs `\`: two hits), north into `R1`; Pip beams `R2` himself.
  Item-get: "You found a Heart Container! Your max hearts grew by one, and you feel all warm and full." (shipped
  line). Boss door (10,5).
- **r10 The Lamp Room** (ceiling 16). Arena 15 × 15 tiles. The great lamp `!` (18,8) on a dais (digit 2) in the
  middle: the Wickwork Moth dives at it (creatures.md). Boss spawn `M` (18,3). After the handover, `[E] Kindle ·
  Great lamp` plays scene `ch12_firstlight` and then Mote's arrival ([story.md](./story.md#ch12)). `X` (18,16): the
  balcony stair down to Tower Head (opens after the scene).

**Keys and chests ledger.** `r2:k1` → L (10,5) on F3; `r8:k1` → the locked hatch on F4; `K` (19,1) → B (10,5) on F5.
Gem chests `r3:c1` (1,1), `r4:c2` (19,1), `r6:c3` (13,7), `r7:c4` (9,9) = 160 gems. Map r2, Chime Stone r6, Sunglass r5,
heart container r9.

**Solver notes.** r1: hit `/1` ×2 → R1 → r2: clear, `k1`, `&` → `^` → r3: `/1` ×2, `m1` ×1 → R1; `c1` → r4: clear,
Kindle `l1-l3` → hatch, `c2` → F3 r6: `%`, `c3`, unlock (10,5) → r5: `$` (Sunglass), beam `R1` → hatch → F4 r7: `\1`
×2, beam `R2` → door → `c4` → r8: clear, `k1`; `/1` ×2, beam up column 12 → cage → `K` → unlock hatch → F5 r9: `m1` ×1,
`/1` ×2, beam `R2` → cage → `H` → B → r10: calm the Wickwork Moth, Kindle the great lamp → `X`.

**Ask the Tree hints.**
1. "Mirrors turn a little every time you bonk them." / "Each sword hit turns a mirror an eighth of a turn. Watch where
   the gold beam goes and keep bonking until it reaches the brass sunflower."
2. "Two sunflowers, one beam of yours." / "In the Prism Hall, turn the high mirror so the skylight reaches one
   sunflower, then shine your own beam on the other. Both at once opens the door."
3. "The cage sunflower hides behind pillars." / "In the Clockwork Room, turn the mirror in the corner twice, then
   stand south of it and shine your beam straight up the column."

**Step split.** **Depth step S-163b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d5-depth). S-162 builds F1-F3 (r1-r6): mirrors, sources, receivers, hatches, split levels, Sunglass chest (S-160
gives the ability), prints and realm-suite entry. S-163 builds F4-F5 (r7-r10): cages, the AND-latch, the locked
hatch, heart container, boss door, great-lamp tile; prints refreshed. S-164 puts the Wickwork Moth in r10; S-165
plays chapter 12.

**Art (d5).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Whitewash wall | `tex_tower_wall` (`realm: duskwick`) | "<style line> Seamless texture of a curved whitewashed lighthouse interior wall, warm cream plaster with faint coral stripe and brass rivets, tileable" | make_seamless 1024/512 | `#efe6d6` with a coral band |
| Mirror | `int_mirror` | code-built: 1.2 m round brass-framed mirror on a turntable post, the glass a soft silver-blue `#cfe3ee`; turns 45° in 0.25 s with a click | - | grey disc on a post |
| Beam source | `int_skylight` | code-built: a round brass skylight collar in the ceiling or wall, with a gold light cone card | - | gold quad |
| Receiver | `int_receiver` | code-built: 1.3 m brass sunflower, petals fold shut (grey-brass) and open (gold `#f2b45a`) when lit | - | yellow disc |
| Brass cage | `int_cage` | code-built: 1.6 m dome of brass bars over a chest; lifts 2 m in 0.8 s | - | bars of boxes |
| Great lamp | `int_great_lamp` | code-built: 3 m tall lamp, a round glass lens 1.8 m across in a brass cage on a stone plinth; unlit dark amber, kindled bright gold with a slow-turning beam card | - | gold sphere on a cylinder |
| Beam ribbon | `fx_beam` | 64 × 512 transparent soft gold gradient strip with sparkles, tiles along length | webp | additive yellow quad |
| Window cards | `card_tower_window` | 512² painted round window view of Duskwick at dusk, moths and lit stilt-houses | webp | dusk gradient |

ART BRIEF `int_great_lamp`: silhouette a tall round lighthouse lamp, fat glass lens in a brass cage, spiral finial; size
3.0 m tall, lens 1.8 m; palette brass `#c9a24a`, lens `#ffe9a8` (lit) / `#8a6a3a` (unlit), plinth `#efe6d6`; materials
glass with a soft inner glow, brass sheen, painted stone; tris 2,000 (code 500); pose static, the lit lens turns 20°/s.
Image prompt: "<style line> The great lamp at the top of a cosy old lighthouse, a big round glass lens in a brass cage,
warm gold light, moths fluttering, dusk sky through the windows." 3D prompt: "Stylised low-poly lighthouse lamp with a
round glass lens in a brass cage on a stone plinth, spiral finial, hand-painted, game-ready, under 2,000 triangles,
3 m tall."

---
<a id="d6"></a>
### d6 The Rootdeep Heart

| Field | Value |
|---|---|
| Realm id / file | `rootdeep_heart` · `js/realms/dungeons/rootdeep_heart.js` |
| Where | beneath Glowcap Forest in the Rootdeep, at the foot of the Taproot ([atlas-far.md](./atlas-far.md#rootdeep)) |
| Opens | ch13 step "follow Digby to the Heart" ([story.md](./story.md#ch13)); Digby waits outside the door and does not enter |
| Needs on entry | Glowbud Lantern, Sunglass |
| Rooms · hours | 16 · 1.75 h (14 + annex 2, [§5A](#d6-depth)) |
| Signature mechanic | light-roots: a Sunglass beam grows a dim root lying in a pit into a glowing bridge for **20 s**; soft earth (Digging Paws, found in r8) |
| Reward | **Digging Paws** (`$` in r8) |
| Boss | **Lumbra the Long** in r14 ([creatures.md](./creatures.md#boss-lumbra)) |
| Grid | 41 × 43 tiles (82 × 86 m); realm grid 102 m |
| Palette | stone (root) `#8a5a3c`, trim `#1c1a24`, accent (glow) `#ffcf7a`, teal glow `#7be0c8`, dark tint `#1c1a24` |
| Light / music | ambient 0.45 (r2, r7 dark), glowcap mushrooms as glow props · track `rootdeep_heart` (low cello, slow heartbeat drum at 60 bpm, drips) |
| Enemies | Glow Grub ×8, Drip Bat ×4, Pebble Mimic ×5 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `j` light-root · `d` soft earth · `o` worm hole (r14 only: a ring of loose earth Pip walks
over; Lumbra surfaces through it). A light-root is one **run** of `j` tiles in a straight line; a beam on any of its
tiles for 0.5 s grows the whole run (1.0 s rise, `bridge_rise`), it stays 20 s, flashes for the last 3 s, then sinks.
Soft earth is a 1.2 m mound (solid, blocks beams) until `[E] Dig · Soft earth` (1.0 s); then it is floor, or reveals
what its entity says. Inside this dungeon, soft earth cannot be dug before the Paws are taken.

```map rootdeep_heart L1
#########################################
#t.......t#l..___..&#..__.___t#t.......c#
#.........#...___...#..jj.___.#..e...e..#
#..?......#...___...#..__.___.#.........#
X@........O...jjj...D..__c___.D....k....#
#.I.....I.#...___...#..__.___.#.........#
#.........#.e.___.e.#..__.jjj.#..e...e..#
#t.......t#l..___..l#t.__.___.#t.......t#
#########################L#########D#####
#l.......l#t.......t#.___.....#t...s...t#
#._______.#..e...e..#.___..e..#.........#
#._______.#.........#.___.....#..e......#
#.__k.jjj.D.........D.jjj.....#.........#
#._______.#....%....#.___..e..#......e..#
#._______.#..e......#.___.....#.........#
#l.......l#t.......t#t___....t#t.......t#
#####D##########################D########
#t......#t#t.#.d.#dc#t..___..t#..__K__..#
#.......#.#..#.#.#.d#...___...#..__.__..#
#...111.d.#..d.#....#...___...#..__j__..#
#...1$1.d.D....#.#..L..djjj...D..__j__..#
#...111.d.#.##.#.#d.#...___...#.........#
#.......#.#....d....#...___...#.........#
#t......#t#t...d...t#t..___..t#t...d...t#
###################################D#####
          #t.................t#t.......t#
          #...................#.........#
          #...................#..I...I..#
          #.........o.........B.........#
          #...o...........o...#..I...I..#
          #...................#.......c.#
          #...................#t.......t#
          #.........M.........###########
          #...................#
          #...................#
          #...................#
          #...o...........o...#
          #.........o.........#
          #...................#
          #...................#
          #...................#
          #t.................t#
          ##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Taproot Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Glow Hall | L1 | [10, 0, 11, 9] | yes | 5 | `l`(11,1) `&`(19,1) `j`(14,4) `j`(15,4) `j`(16,4) `e`(12,6) `e`(18,6) `l`(11,7) `l`(19,7) |
| r3 | The Root Bridge | L1 | [20, 0, 11, 9] | - | 5 | `t`(29,1) `j`(23,2) `j`(24,2) `c`(25,4) `j`(26,6) `j`(27,6) `j`(28,6) `t`(21,7) |
| r4 | The Grub Den | L1 | [30, 0, 11, 9] | - | 5 | `t`(31,1) `c`(39,1) `e`(33,2) `e`(37,2) `k`(35,4) `e`(33,6) `e`(37,6) `t`(31,7) `t`(39,7) |
| r7 | The Dark Root Cellar | L1 | [0, 8, 11, 9] | yes | 5 | `l`(1,9) `l`(9,9) `k`(4,12) `j`(6,12) `j`(7,12) `j`(8,12) `l`(1,15) `l`(9,15) |
| r6 | The Pebble Gallery | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `t`(19,9) `e`(13,10) `e`(17,10) `%`(15,13) `e`(13,14) `t`(11,15) `t`(19,15) |
| r5 | The Drip Hall | L1 | [20, 8, 11, 9] | - | 5 | `e`(27,10) `j`(22,12) `j`(23,12) `j`(24,12) `e`(27,13) `t`(21,15) `t`(29,15) |
| r12 | The Root-Gate Hall | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `s`(35,9) `t`(39,9) `e`(33,11) `e`(37,13) `t`(31,15) `t`(39,15) |
| r8 | The Paws Chamber | L1 | [0, 16, 11, 9] | - | 5 | `t`(1,17) `t`(9,17) `d`(8,19) `$`(5,20) `d`(8,20) `d`(8,21) `t`(1,23) `t`(9,23) |
| r9 | The Burrow Maze | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `d`(15,17) `d`(18,17) `c`(19,17) `d`(19,18) `d`(13,19) `d`(18,21) `d`(15,22) `t`(11,23) `d`(15,23) `t`(19,23) |
| r10 | The Lumen Pit | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `t`(29,17) `d`(23,20) `j`(24,20) `j`(25,20) `j`(26,20) `t`(21,23) `t`(29,23) |
| r11 | The Knot Hall | L1 | [30, 16, 11, 9] | - | 5 | `K`(35,17) `j`(35,19) `j`(35,20) `t`(31,23) `d`(35,23) `t`(39,23) |
| r13 | Lumbra's Larder | L1 | [30, 24, 11, 9] | - | 5 | `t`(31,25) `t`(39,25) `I`(33,27) `I`(37,27) `I`(33,29) `I`(37,29) `c`(38,30) `t`(31,31) `t`(39,31) |
| r14 | The Heart Hollow | L1 | [10, 24, 21, 19] | - | 14 | `t`(11,25) `t`(29,25) `o`(20,28) `o`(14,29) `o`(26,29) `M`(20,32) `o`(14,36) `o`(26,36) `o`(20,37) `t`(11,41) `t`(29,41) |

**Room by room.**

- **r1 The Taproot Door.** `X` (0,4) to Glowcap Forest. Sign `?`(3,3) in Digby's big careful letters: "Down here
  nobody can see. So you're just like me. — D." Roots throb gold along the walls every 2 s (the heartbeat).
- **r2 The Glow Hall** (dark). A 3-wide pit (cols 14-16). Light-root `r2:j` (14-16,4): beam it from the west floor,
  cross. Wave 1: Glow Grub ×2 at (12,6), (18,6). Map chest `&` (19,1). Wall-lanterns `r2:l1-l3` (optional light).
- **r3 The Root Bridge.** Root `r3:j1` (23-24,2) to the middle island (col 25); root `r3:j2` (26-28,6) to the east
  floor. Gem chest `r3:c1` (25,4) on the island. Locked door (25,8) south from the island; door (30,4) east.
- **r4 The Grub Den.** Wave 1: Glow Grub ×4 at (33,2), (37,2), (33,6), (37,6) and a Drip Bat from the ceiling. Clear:
  small key `r4:k1` (35,4). Gem chest `r4:c2` (39,1). South door (35,8) opens from r12 only (switch).
- **r5 The Drip Hall.** Arrive on the east floor from the locked door. Root `r5:j` (22-24,12) across the pit to the
  west strip and door (20,12). Wave 1: Drip Bat ×2 at (27,10), (27,13) (swoop on a stripe).
- **r6 The Pebble Gallery.** Wave 1: Pebble Mimic ×3 at (13,10), (17,10), (13,14) (they sit as round pebbles until Pip
  is within 4 m, then hop). Chime Stone chest `%` (15,13). Door (10,12) west `clear`.
- **r7 The Dark Root Cellar** (dark). A pit with an island (4-5,12): beam root `r7:j` (6-8,12) from the east strip,
  cross, take small key `r7:k1` (4,12); the root lasts long enough to walk back (6 tiles, 2.7 s). Wave 1: Glow Grub ×2
  on the strips. Door (5,16) south `always`.
- **r8 The Paws Chamber.** Treasure chest `$` (5,20): the **Digging Paws**. Item-get: "You got the Digging Paws!
  Stand by soft earth and press {interact} to dig. Digby would be proud." A low root wall (col 8) with three soft-earth
  mounds `r8:d1-d3` (8,19)-(8,21): dig any one to reach door (10,20).
- **r9 The Burrow Maze.** Inner root walls and mounds. Column 15 is sealed by walls and mounds (15,17), (15,22),
  (15,23): dig one to cross. Gem chest `r9:c3` (19,17) is walled in by mounds (18,17) and (19,18). Wave 1: Pebble
  Mimic ×2 at (12,18), (18,20). Locked door (20,20) east.
- **r10 The Lumen Pit.** The tip of root `r10:j` (24-26,20) is buried under mound `r10:d1` (23,20): the root will not
  wake until it is dug. Dig, beam, cross to door (30,20). Wave 1: Drip Bat ×2.
- **r11 The Knot Hall.** Root Key chest `K` (35,17) on an island (35,18) at the top of a pit; root `r11:j` (35,19-20)
  runs north to it: beam it from (35,21). Mound `r11:d1` (35,23) blocks the south door (35,24); door (32,16) north to
  r12.
- **r12 The Root-Gate Hall.** A sleeping root-gate arch (decor; the real root-gates are overworld). Switch `r12:s1`
  (35,9) opens door (35,8) to r4 for good (the shortcut out). Wave 1: Glow Grub ×2.
- **r13 Lumbra's Larder.** Heaps of leaf mould and four root pillars. Gem chest `r13:c4` (38,30). Boss door (30,28).
- **r14 The Heart Hollow** (ceiling 14). Arena 19 × 17 tiles with the six worm holes `o` at (20,28), (14,29),
  (26,29), (14,36), (26,36), (20,37). Boss spawn `M` (20,32). After the handover, scene `ch13_heart` (the twelve
  memory knots light on the Taproot; [story.md](./story.md#ch13)). `X` (20,42) to the foot of the Taproot.

**Keys and chests ledger.** `r4:k1` → L (25,8); `r7:k1` → L (20,20); `K` (35,17) → B (30,28). Gem chests `r3:c1`
(25,4), `r4:c2` (39,1), `r9:c3` (19,17), `r13:c4` (38,30) = 160 gems. Map r2, Chime Stone r6, Paws r8.

**Solver notes.** r1 → r2: beam root, `&` → r3: root 1, `c1`, root 2 → r4: clear, `k1`, `c2` → r3 (root 2 back to the
island) → unlock (25,8) → r5: beam, cross → r6: clear, `%` → r7: beam, `k1` → r8: `$` (Paws), dig → r9: dig column
15, dig to `c3` → unlock (20,20) → r10: dig, beam, cross → r11: beam, `K`; door north → r12: `s1` (shortcut) → r11:
dig (35,23) → r13: `c4` → B → r14: calm Lumbra → `X`. The solver models each root as a timed bridge (20 s; every
crossing in this map is ≤ 7 tiles, under 4 s at run speed).

**Ask the Tree hints.**
1. "Sleepy roots in the dark like a little sunshine." / "Shine the Sunglass on the dim root lying in the pit. It grows
   into a bridge for a short while, so cross quickly."
2. "That root in the Lumen Pit is tucked in." / "Dig the soft earth at the edge of the pit first. The root's tip is
   under it; then your beam will wake it."
3. "The key on the high island in the Knot Hall has a root of its own." / "Stand south of the pit in the Knot Hall
   and shine straight north along the short root to reach the Root Key."

**Step split.** **Depth step S-184b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d6-depth). S-183 builds r1-r7 (light-root entity, timed bridge, the solver's timer model), prints and realm-suite
entry. S-184 builds r8-r14 (Paws chest, soft earth inside, worm-hole tiles, boss door); prints refreshed. S-185 puts
Lumbra in r14; S-191 plays ch13.

**Art (d6).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Root cavern wall | `tex_rootwall` (`realm: rootdeep`) | "<style line> Seamless texture of a cavern wall woven from thick tree roots, dark plum-brown with teal and gold glowing threads, tileable" | make_seamless 1024/512 | `tex_dungeon_root` |
| Light-root | `int_light_root` | code-built: a tapering root 0.5 m thick lying in the pit; dim `#5a4a3a`; when woken it rises to floor height, swells to a 1.8 m wide flat-topped root bridge glowing `#ffcf7a` with teal flecks `#7be0c8` | - | plank deck tinted gold |
| Soft earth mound | `int_soft_earth` | code-built (shared with S-181): 1.6 m rounded brown mound `#7a5232` with three twinkling sparkle sprites | - | brown hemisphere |
| Worm hole | `int_worm_hole` | code-built: 2.4 m ring of loose dark earth with small pebbles, a slightly sunken centre | - | dark disc decal |
| Glowcap | `int_glowcap` | code-built: mushroom 0.6-2.0 m, cap `#7be0c8` emissive, stem cream | - | the home glowshroom recoloured |

ART BRIEF `int_light_root`: silhouette a long gnarled root that lifts and flattens into a walkway; size 2 m wide per
tile, 0.5 m thick when dim; palette dim `#5a4a3a`, lit `#ffcf7a`, flecks `#7be0c8`; materials bark with emissive grain;
tris 200 per tile (code 60); pose: dim (lying in the pit) and lit (raised, flat top), 1.0 s blend. Image prompt: "<style
line> A sleepy tree root lying across a dark pit, half of it waking up and glowing gold, forming a bridge, in a warm
underground root cavern with teal mushrooms." 3D prompt: "Stylised low-poly tree root bridge segment, flat walkable top,
glowing gold grain, hand-painted, game-ready, under 200 triangles per 2 m segment."

---
<a id="d7"></a>
### d7 The Sunken Bell

| Field | Value |
|---|---|
| Realm id / file | `sunken_bell` · `js/realms/dungeons/sunken_bell.js` |
| Where | the Lamplighters' sea chapel under Bell Shallows, the Glassway; entered by the door at the top of the 18 m spire at low tide ([atlas-far.md](./atlas-far.md#glassway)) |
| Opens | the Glassway "people" step for the Bell sets `bellDepths` ([story.md](./story.md#ch15-17)) |
| Needs on entry | Glowbud Lantern; any Act II tools (none needed inside) |
| Rooms · hours | 14 · 1.5 h (11 + annex 3, [§5A](#d7-depth)) |
| Signature mechanic | sound: low, mid and high bells open matching pitch doors; brass speaking tubes carry a note to another room; song doors want a three-note tune that is **heard elsewhere** first |
| Reward | **Starsong** (`$` in r7) |
| Encounter | **Pelagia**, a bell-order duel of wits in r11 ([creatures.md](./creatures.md#boss-pelagia)); she gives the Stair Stone (the great bell's clapper) |
| Grid | 31 × 41 tiles (62 × 82 m); realm grid 98 m |
| Palette | stone `#2f7d8c`, trim (sand) `#f5e6c4`, accent (bronze) `#b0793a`, sea-glass `#bfeee6`, dark tint `#173a44` |
| Light / music | ambient 0.6, the air is dry (an air pocket); wavering water-light through high round windows (cards) · track `sunken_bell` (glockenspiel over a soft organ pad; every bell struck plays its pitch in the music's key, G major: low G3, mid B3, high D4) |
| Enemies | Bubble Puffer ×9, Gullgrab ×2 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `x` low bell · `Y` mid bell · `z` high bell · `U` low door · `V` mid door · `W` high door ·
`T` song door · `f` speaking-tube mouth. A sword hit rings a bell (0.4 s cooldown; the note shows as a coloured ring:
low rose `#f4a6c0`, mid gold `#ffd36b`, high sky `#8fd3ff`). A **pitch door** opens for good when its pitch is rung
within 6 tiles of it (by a bell, a tube mouth or, once Pip has it, the Starsong). A **song door** opens for good when
its tune is rung within 6 tiles with no more than 2 s between notes; a wrong note resets the tune with a soft "bonk".
A **speaking tube** joins two mouths: a bell rung within 1 tile of one mouth sounds again out of the other 0.5 s
later. Clams and drips are **heard** (they teach a tune) but never open a door.

**Tunes:** Tune A "the Clam Song" = low, high, mid · Tune B "the Drip Hymn" = mid, mid, high. (These are dungeon
tunes, not the Starsong's own tunes, [systems.md](./systems.md#items-tools).)

```map sunken_bell L1
#####X#########################
#t...@...t#&.......t#t.......t#
#.........#........f#..I.I.I..#
#..?......#....Y....#.........#
#.....x...U.........W....p....#
#.I.....I.#.I.....I.#..e...e..#
#.........#.........#.........#
#t.......t#t.......t#%.......t#
###############V#########D#####
#t.......t#t.......t#t.......t#
#.fz......#..e...e..#.........#
#.........#.........#.x.....z.#
#.........L....k....#....Y....#
#.........#.........#.........#
#..e...e..#....e....#.........#
#c.......t#t.......t#t.......t#
#####T###################T#####
#t.......t#t.......t#t.......t#
#.........#.x.......#..w.w.w..#
#...111...#...Y.....#.........#
#...1$1...T.........L....k....#
#...111...#.z.......#..e...e..#
#.........#.....K.c.#.........#
#t.......t#t.......t#c.......t#
#####W#########################
#t.......t#t.................t#
#.........#...................#
#..e......#...................#
#.........B.........M.........#
#......e..#...................#
#.........#...................#
#c.......t#...................#
###########...................#
          #.....x.......z.....#
          #.........Y.........#
          #...................#
          #...................#
          #...................#
          #...................#
          #t.................t#
          ##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Spire Stair | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `@`(5,1) `t`(9,1) `?`(3,3) `x`(6,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Echo Nave | L1 | [10, 0, 11, 9] | - | 9 | `&`(11,1) `t`(19,1) `f`(19,2) `Y`(15,3) `I`(12,5) `I`(18,5) `t`(11,7) `t`(19,7) |
| r3 | The Clam Choir | L1 | [20, 0, 11, 9] | - | 5 | `t`(21,1) `t`(29,1) `I`(23,2) `I`(25,2) `I`(27,2) `p`(25,4) `e`(23,5) `e`(27,5) `%`(21,7) `t`(29,7) |
| r6 | The Tube Room | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `f`(2,10) `z`(3,10) `e`(3,14) `e`(7,14) `c`(1,15) `t`(9,15) |
| r5 | The Gull Loft | L1 | [10, 8, 11, 9] | - | 8 | `t`(11,9) `t`(19,9) `e`(13,10) `e`(17,10) `k`(15,12) `e`(15,14) `t`(11,15) `t`(19,15) |
| r4 | The Bell Garden | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `t`(29,9) `x`(22,11) `z`(28,11) `Y`(25,12) `t`(21,15) `t`(29,15) |
| r7 | The Starsong Chapel | L1 | [0, 16, 11, 9] | - | 8 | `t`(1,17) `t`(9,17) `$`(5,20) `t`(1,23) `t`(9,23) |
| r8 | The Vestry | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `t`(19,17) `x`(12,18) `Y`(14,19) `z`(12,21) `K`(16,22) `c`(18,22) `t`(11,23) `t`(19,23) |
| r9 | The Choir Stalls | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `t`(29,17) `k`(25,20) `e`(23,21) `e`(27,21) `c`(21,23) `t`(29,23) |
| r10 | The Bell Pit | L1 | [0, 24, 11, 9] | - | 5 | `t`(1,25) `t`(9,25) `e`(3,27) `e`(7,29) `c`(1,31) `t`(9,31) |
| r11 | The Chapel of the Bell | L1 | [10, 24, 21, 17] | - | 18 | `t`(11,25) `t`(29,25) `M`(20,28) `x`(16,33) `z`(24,33) `Y`(20,34) `t`(11,39) `t`(29,39) |

**Room by room.**

- **r1 The Spire Stair.** `X` (5,0) up the spire to Bell Shallows. Sign `?`(3,3): "Ring low to go in. Ring true to go
  on. — the bell-keepers". Low bell `r1:x1` (6,4) opens low door (10,4).
- **r2 The Echo Nave** (ceiling 9). Mid bell `r2:Y1` (15,3) opens mid door (15,8). The high door (20,4) east has no
  bell near it: it opens when the high note comes out of tube mouth `r2:f1` (19,2) (from r6). Map chest `&` (11,1).
- **r3 The Clam Choir.** Three giant clams (`I` (23,2), (25,2), (27,2)). Standing on shell plate `r3:p1` (25,4) makes
  them sing **Tune A** (low, high, mid) with matching coloured rings, then repeat every 6 s while Pip stays. Wave 1:
  Bubble Puffer ×2 at (23,5), (27,5). Chime Stone chest `%` (21,7). Door (25,8) `always`.
- **r4 The Bell Garden.** Bells `r4:x1` (22,11), `r4:Y1` (25,12), `r4:z1` (28,11). Ring Tune A to open song door
  (25,16) south.
- **r5 The Gull Loft** (ceiling 8). Wave 1: Gullgrab ×2 at (13,10), (17,10) (each snatches a gem and drops it when
  bonked), Bubble Puffer ×1 at (15,14). Clear: small key `r5:k1` (15,12). Locked door (10,12) west.
- **r6 The Tube Room.** High bell `r6:z1` (3,10) beside tube mouth `r6:f1` (2,10): ring it and the note comes out in
  r2 and opens the high door there. Wave 1: Bubble Puffer ×2 at (3,14), (7,14). Gem chest `r6:c1` (1,15). Song door
  (5,16) south wants **Tune B** (from the r7 side, with the Starsong; it is the shortcut back).
- **r9 The Choir Stalls.** Three stone basins `w` (23,18), (25,18), (27,18) under drips: every 6 s the drips play
  **Tune B** (mid, mid, high). Small key `r9:k1` (25,20). Wave 1: Bubble Puffer ×2 at (23,21), (27,21). Gem chest
  `r9:c2` (21,23). Locked door (20,20) west.
- **r8 The Vestry.** Bells `r8:x1` (12,18), `r8:Y1` (14,19), `r8:z1` (12,21), all within 6 tiles of song door (10,20):
  ring Tune B. Root Key chest `K` (16,22); gem chest `r8:c3` (18,22). Old Lamplighter robes on hooks (decor).
- **r7 The Starsong Chapel** (ceiling 8). Treasure chest `$` (5,20) on a reading desk dais: the **Starsong**.
  Item-get: "You got the Starsong! A leaf whistle with three notes. Hold {tool} and press {attack}, {jump} or {dash}
  to play low, mid or high." High door (5,24) south: play the high note. Song door (5,16) north: play Tune B.
- **r10 The Bell Pit.** Wave 1: Bubble Puffer ×2 at (3,27), (7,29). Gem chest `r10:c4` (1,31). Boss door (10,28).
- **r11 The Chapel of the Bell** (ceiling 18). The great bell hangs silent from the roof, its clapper the Stair
  Stone. Pelagia's spot `M` (20,28). Duel bells `r11:x1` (16,33), `r11:Y1` (20,34), `r11:z1` (24,33). The duel is
  three rounds (creatures.md). After it, scene `ch_bell_stone` ([story.md](./story.md#ch15-17)): the bell rings
  once, softly. `X` (20,40) back up to the spire.

**Keys and chests ledger.** `r5:k1` → L (10,12); `r9:k1` → L (20,20); `K` (16,22) → B (10,28). Gem chests `r6:c1`
(1,15), `r9:c2` (21,23), `r8:c3` (18,22), `r10:c4` (1,31) = 160 gems. Map r2, Chime Stone r3, Starsong r7.

**Solver notes.** r1: ring `x1` → r2: `&`, ring `Y1` → r5: clear, `k1` → unlock (10,12) → r6: `c1`, ring `z1` (the
tube opens r2's high door) → r2 → r3: plate (hear Tune A), clear, `%` → r4: ring low, high, mid → r9: hear Tune B,
`k1`, `c2` → unlock (20,20) → r8: ring mid, mid, high (`x1` not used), `K`, `c3` → r7: `$` (Starsong), play high → r10:
`c4` → B → r11: the duel → `X`. The solver models notes as events with a 2 s window and tube delays as 0.5 s.

**Ask the Tree hints.**
1. "The high door has no bell near it, but it has a brass ear." / "Find the room with a high bell beside a brass
   tube. Ring it there, and the note comes out by the high door in the Echo Nave."
2. "Clams know a song." / "Stand on the shell in the Clam Choir and listen: low, high, mid. Ring those three bells in
   that order in the Bell Garden."
3. "Drips make music too." / "In the Choir Stalls, the drips play mid, mid, high. Ring that on the bells in the
   Vestry."

**Step split.** **Depth step S-210b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d7-depth). S-209 builds r1-r6 (bells, pitch doors, tubes, the note event), prints and realm-suite entry. S-210
builds r7-r11 (song doors, heard tunes, Starsong chest; S-208 gives the item), prints refreshed. S-211 puts Pelagia's
duel in r11.

**Art (d7).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Chapel stone | `tex_chapel_stone` (`realm: glassway`) | "<style line> Seamless texture of pale sea-washed chapel stone blocks with soft teal water stains and tiny shells in the mortar, tileable" | make_seamless 1024/512 | `tex_dungeon_stone` tinted `#9fc9c4` |
| Pitch bells | `int_bell_low` / `_mid` / `_high` | code-built: bronze bells 1.2 / 0.9 / 0.6 m on wooden frames, each with a coloured ribbon (rose, gold, sky) | - | bronze cones |
| Pitch / song door | `int_door_pitch` | code-built: a round bronze door with one big engraved note (one dot low, two mid, three high) or a three-dot staff (song door); the dots glow when heard | - | kit door leaf + coloured disc |
| Speaking tube | `int_tube` | code-built: brass funnel mouth 0.8 m on a curled pipe that runs along the wall | - | brass cone |
| Giant clam | `int_clam` | code-built: 1.6 m clam with a pearly pink lip that opens to sing (mouth flaps 4 Hz) | - | pink hemisphere |
| Great bell | `int_great_bell` | code-built: 6 m bronze bell hanging from the roof beams, a carved spiral band, the Stair Stone as its clapper (a round pale stone with a glowing spiral) | - | big bronze cone |

ART BRIEF `int_great_bell`: silhouette a classic round-shouldered bell with a wide lip and a spiral band, the clapper a
round glowing stone; size 6 m tall, 5 m across the lip; palette bronze `#b0793a`, verdigris `#7fbfa8`, stone `#e9e2cf`,
glow `#ffe9a8`; materials soft metal sheen, verdigris patches; tris 3,000 (code 600); pose hangs still, swings 4° when
rung. Image prompt: "<style line> A huge old bronze bell hanging silent in a sunken sea chapel, a glowing round stone as
its clapper, soft teal water-light, peaceful." 3D prompt: "Stylised low-poly bronze church-style bell with a spiral
band and a round stone clapper, verdigris, hand-painted, game-ready, under 3,000 triangles, 6 m tall."

---
<a id="d8"></a>
### d8 The Kettle's Belly

| Field | Value |
|---|---|
| Realm id / file | `kettle_belly` · `js/realms/dungeons/kettle_belly.js` |
| Where | inside the Kettle (the 45 m cone), Kettle Isle; door in a lava-tube mouth on The Spout's flank ([atlas-far.md](./atlas-far.md#kettle)) |
| Opens | Kettle Isle's last "people" step sets `kettleDepths` ([story.md](./story.md#ch15-17)) |
| Needs on entry | Glowbud Lantern; Act II tools and the Paws (none needed inside) |
| Rooms · hours | 16 · 1.6 h (13 + annex 3, [§5A](#d8-depth)) |
| Signature mechanic | steam: valves raise and lower brass platforms (2.0 s after the valve turns, so Pip can step on); from r5 the Ember Sling turns valves, lights braziers at range and melts wax plugs |
| Reward | **Ember Sling** (`$` in r5) |
| Boss | **Lady Fumarole** in r13 ([creatures.md](./creatures.md#boss-fumarole)); she hands over the Stair Stone |
| Grid | 41 × 41 tiles (82 × 82 m); realm grid 98 m |
| Palette | stone `#3b3540`, trim (brass) `#c79a4a`, accent (ember) `#e66f4f`, steam `#f4f1ea`, mint `#8fc7a0`, dark tint `#221c24` |
| Light / music | ambient 0.6, warm orange underglow from vents (glow materials) · track `kettle_belly` (brass and steam: tuba ostinato, kettle whistle motif, 92 bpm) |
| Enemies | Soot Snuffle ×5, Steam Puff ×5, Ash Moth ×5 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | 2 small, 1 big |

**Legend extension:** `v` steam valve · `z` steam platform · `a` cold brazier · `f` wax plug (a door glyph here: a
round wax seal in the doorway). A valve toggles its platforms (`[E] Use · Valve` or an ember hit); the platforms move
2.0 s later over 1.2 s, carrying Pip. Platform heights below are `lo → hi` digits (`pit` = sunk −4 m). Braziers
marked **high** hang on the wall at 3 m and can be lit only by an ember.

**Platforms:** `r2:z1-z3` (14-16,4) `pit → 0`, valve `r2:v1` (13,3) · `r3:z1` (25,3) `0 → 9`, valve `r3:v1` (24,3) ·
`r7:z1` (18,11) `0 → 9`, valve `r7:v1` (19,11) · `r7:z2-z3` (14-15,9) `pit → 9`, valve `r7:v2` (15,15) · `r8:z1`
(3,10) `0 → 9`, valve `r8:v1` (8,14) · `r11:z1` (26,18) `0 → 2` and `r11:z2` (27,18) `0 → 4`, both rise for good
when braziers `r11:a1` (22,17) and `r11:a2` (28,23) (both high) are lit.

```map kettle_belly L1
#########################################
#t.......t#...___.e.#...9c9...#t.......t#
#.........#...___...#...999...#..e...e..#
#..?......#..v___...#...vz....#.........#
X@........O...zzz...D.........D....k....#
#.I.....I.#...___...#.........#.........#
#.........#...___...#.........#....e....#
#t.......t#t..___..&#t.......t#t.......t#
###################################L#####
#c9......t#k99zz9999#t.......t#t.......t#
#99z......#999__9999#.._____..#.........#
#.........#.......zv#.._a_a_..#...111...#
#.........D.........D.._____..f...1$1...#
#..e......#..e...e..#.._a_a_..#...111...#
#.......v.#.........#.._____..#.........#
#t.......t#t...v...t#t...%...t#t.......t#
#####f#############################D#####
#t.......t#t.......t#.a.....6K#t...s...t#
#..e...e..#.........#.....zz66#.........#
#.........#...III...#.........#..e...e..#
#.........D...III...L.........D.........#
#....e....#...III...#.........#.........#
#.........#.e.....e.#..e......#.........#
#c.......t#t.......t#t......a.#t......ct#
###############B#########################
          #t.................t#
          #...................#
          #...................#
          #...................#
          #........222........#
          #........2M2........#
          #........222........#
          #...................#
          #...................#
          #...................#
          #...................#
          #...................#
          #...................#
          #...................#
          #t.................t#
          ##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Spout Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Valve Hall | L1 | [10, 0, 11, 9] | - | 5 | `e`(18,1) `v`(13,3) `z`(14,4) `z`(15,4) `z`(16,4) `t`(11,7) `&`(19,7) |
| r3 | The Piston Room | L1 | [20, 0, 11, 9] | - | 7 | `c`(25,1) `v`(24,3) `z`(25,3) `t`(21,7) `t`(29,7) |
| r4 | The Snuffle Hall | L1 | [30, 0, 11, 9] | - | 5 | `t`(31,1) `t`(39,1) `e`(33,2) `e`(37,2) `k`(35,4) `e`(35,6) `t`(31,7) `t`(39,7) |
| r8 | The Wax Works | L1 | [0, 8, 11, 9] | - | 7 | `c`(1,9) `t`(9,9) `z`(3,10) `e`(3,13) `v`(8,14) `t`(1,15) `t`(9,15) |
| r7 | The Steam Lift | L1 | [10, 8, 11, 9] | - | 7 | `k`(11,9) `z`(14,9) `z`(15,9) `z`(18,11) `v`(19,11) `e`(13,13) `e`(17,13) `t`(11,15) `v`(15,15) `t`(19,15) |
| r6 | The Brazier Hall | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `t`(29,9) `a`(24,11) `a`(26,11) `a`(24,13) `a`(26,13) `t`(21,15) `%`(25,15) `t`(29,15) |
| r5 | The Sling Forge | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `t`(39,9) `$`(35,12) `t`(31,15) `t`(39,15) |
| r9 | The Ash Loft | L1 | [0, 16, 11, 9] | - | 8 | `t`(1,17) `t`(9,17) `e`(3,18) `e`(7,18) `e`(5,21) `c`(1,23) `t`(9,23) |
| r10 | The Boiler Room | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `t`(19,17) `I`(14,19) `I`(15,19) `I`(16,19) `I`(14,20) `I`(15,20) `I`(16,20) `I`(14,21) `I`(15,21) `I`(16,21) `e`(12,22) `e`(18,22) `t`(11,23) `t`(19,23) |
| r11 | The Gauge Room | L1 | [20, 16, 11, 9] | - | 7 | `a`(22,17) `K`(29,17) `z`(26,18) `z`(27,18) `e`(23,22) `t`(21,23) `a`(28,23) |
| r12 | The Pressure Room | L1 | [30, 16, 11, 9] | - | 5 | `t`(31,17) `s`(35,17) `t`(39,17) `e`(33,19) `e`(37,19) `t`(31,23) `c`(38,23) `t`(39,23) |
| r13 | Lady Fumarole's Spout | L1 | [10, 24, 21, 17] | - | 16 | `t`(11,25) `t`(29,25) `M`(20,30) `t`(11,39) `t`(29,39) |

**Room by room.**

- **r1 The Spout Door.** `X` (0,4) to The Spout. Sign `?`(3,3) in Master Scoria's square letters: "Valves: turn,
  wait, ride. Kettle: do not poke. — S."
- **r2 The Valve Hall.** Turn `v1` (13,3): two seconds later three platforms rise out of the pit and make a walkway.
  Steam Puff ×1 at (18,1) (turret). Map chest `&` (19,7). Door (20,4) `always`.
- **r3 The Piston Room** (ceiling 7). Turn `v1` (24,3), walk round to the platform `z1` (25,3) (two steps, under
  2 s), ride it up to the ledge: gem chest `r3:c1` (25,1). Door (30,4) `always`.
- **r4 The Snuffle Hall.** Wave 1: Soot Snuffle ×3 at (33,2), (37,2), (35,6) (chargers, puff of soot on the tell).
  Clear: small key `r4:k1` (35,4). Locked door (35,8).
- **r5 The Sling Forge.** Treasure chest `$` (35,12): the **Ember Sling**. Item-get: "You got the Ember Sling! Aim and
  press {tool} to fling a warm ember seed. It lights braziers, melts wax and rings bell targets." The only way on is
  wax door (30,12): melt it. South door (35,16) opens from r12 (shortcut).
- **r6 The Brazier Hall.** Four braziers `r6:a1-a4` stand on stone stumps inside the pit at (24,11), (26,11), (24,13),
  (26,13). Light all four with embers: door (20,12) opens (`lit`). Wave 1: Ash Moth ×2 swooping over the pit. Compass
  chest `%` (25,15).
- **r7 The Steam Lift** (ceiling 7). Turn `v1` (19,11), step onto `z1` (18,11), ride up to the east ledge (9); from
  there fling an ember at `v2` (15,15) on the floor: `z2-z3` rise out of the gap to ledge height; cross to the west
  ledge and take small key `r7:k1` (11,9). Wave 1: Soot Snuffle ×2 at (13,13), (17,13). Door (10,12) `always`.
- **r8 The Wax Works** (ceiling 7). Valve `v1` (8,14) is far from platform `z1` (3,10): stand on the platform and fling
  an ember at the valve. Ride up: gem chest `r8:c3` (1,9). Wave 1: Steam Puff ×1 at (3,13). Wax door (5,16) south.
- **r9 The Ash Loft** (ceiling 8). Wave 1: Ash Moth ×3 at (3,18), (7,18), (5,21). Clear opens door (10,20). Gem chest
  `r9:c2` (1,23).
- **r10 The Boiler Room.** The great boiler (pillars 14-16 × 19-21) hisses. Wave 1: Steam Puff ×2 at (12,22), (18,22).
  Locked door (20,20) east; boss door (15,24) south.
- **r11 The Gauge Room** (ceiling 7). Root Key chest `K` (29,17) on a ledge (digit 6). Light the two high braziers
  with embers: the two platforms rise into steps (2 and 4) up to the ledge. Wave 1: Soot Snuffle ×1 at (23,22).
- **r12 The Pressure Room.** Wave 1: Steam Puff ×2 at (33,19), (37,19). Switch `r12:s1` (35,17) opens door (35,16) to
  r5 for good. Gem chest `r12:c4` (38,23).
- **r13 Lady Fumarole's Spout** (ceiling 16). Arena 19 × 15 tiles. The spout lid (digit 2 dais 3 × 3) where she sits
  in her bath, boss spawn `M` (20,30). After the handover, scene `ch_kettle_stone` ([story.md](./story.md#ch15-17)):
  the Kettle boils over gently into the baths. `X` (20,40) to The Spout.

**Keys and chests ledger.** `r4:k1` → L (35,8); `r7:k1` → L (20,20); `K` (29,17) → B (15,24). Gem chests `r3:c1`
(25,1), `r9:c2` (1,23), `r8:c3` (1,9), `r12:c4` (38,23) = 160 gems. Map r2, Chime Stone r6, Sling r5.

**Solver notes.** r1 → r2: `v1`, cross, `&` → r3: `v1`, ride, `c1` → r4: clear, `k1` → unlock → r5: `$` (Sling), melt
(30,12) → r6: ember ×4, `%` → r7: `v1`, ride, ember `v2`, cross, `k1` → r8: stand on `z1`, ember `v1`, ride, `c3`; melt
(5,16) → r9: clear, `c2` → r10 → unlock (20,20) → r11: ember `a1`, `a2`, climb, `K` → r12: `s1`, `c4` → r11 → r10 → B →
r13: calm Lady Fumarole → `X`. The solver models the 2.0 s valve delay and checks each hand-turned valve has its
platform within 2 tiles of walking.

**Ask the Tree hints.**
1. "Valves are slow on purpose." / "Turn the valve, then hop straight onto the brass platform. It waits two seconds
   before it moves."
2. "Some valves are easier to reach from the platform." / "In the Wax Works, stand on the brass platform and fling an
   ember at the valve across the room. Up you go."
3. "Those braziers in the Gauge Room are hung too high for hands." / "Fling an ember at each of the two high braziers.
   The brass steps rise up to the Root Key."

**Step split.** **Depth step S-230b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d8-depth). S-229 builds r1-r7 (valves with the 2 s delay, steam platforms, wax doors, the Sling chest; S-227 gives
the ability), prints and realm-suite entry. S-230 builds r8-r13 (high braziers, brazier-driven platforms, boss door);
prints refreshed. S-231 puts Lady Fumarole in r13.

**Art (d8).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Volcanic wall | `tex_kettle_rock` (`realm: kettle`) | "<style line> Seamless texture of warm dark volcanic rock with smooth rounded lumps, faint orange glow in the cracks and little brass pipe brackets, tileable" | make_seamless 1024/512 | `#3b3540` noise with `#e66f4f` cracks |
| Steam valve | `int_valve` | code-built: a 0.8 m red-and-brass hand wheel on a pipe post; spins 1 turn when used, puffs steam | - | red torus on a post |
| Steam platform | `int_steam_platform` | code-built: 2 × 2 m riveted brass plate on a fat piston; steam curls from the base while moving | - | brass box |
| Wax plug | `int_wax_plug` | code-built: round creamy wax seal `#f4e3b8` filling an arch, a stamped spiral; melts down in 1.0 s with drips | - | cream disc |
| Brazier (cold/lit) | `int_brazier` (kit) + high wall variant `int_brazier_wall` | kit brazier; wall variant on an iron arm at 3 m | - | kit brazier |
| Steam card | `fx_steam` | sprite sheet 4 × 2 frames 128² of soft white steam puffs, transparent | slice_sheet, webp | white quads |

ART BRIEF `int_steam_platform`: silhouette a squat round-cornered brass plate on a thick piston with rivets and a pressure
gauge; size 2 × 2 m plate, piston 1.2 m wide, travel up to 2.7 m; palette brass `#c79a4a`, iron `#5b5e66`, gauge face
`#f4f1ea`; materials soft metal sheen; tris 600 (code 150); pose static, rises and sinks with steam puffs. Image
prompt: "<style line> A friendly riveted brass lift platform on a steam piston inside a cosy volcano workshop, steam
curling, warm orange glow." 3D prompt: "Stylised low-poly riveted brass platform on a steam piston with a small gauge,
hand-painted, game-ready, under 600 triangles, 2 m square."

---
<a id="d9"></a>
### d9 The Buried Academy

| Field | Value |
|---|---|
| Realm id / file | `buried_academy` · `js/realms/dungeons/buried_academy.js` |
| Where | the Lamplighter Academy under Academy Hill, Saltglass Flats; entered through the half-buried bell tower's top window ([atlas-far.md](./atlas-far.md#saltglass)) |
| Opens | Saltglass's last "people" step sets `academyDepths` ([story.md](./story.md#ch15-17)) |
| Needs on entry | Glowbud Lantern, Sunglass (the exam's aiming paper); Act II tools and the Paws (none needed elsewhere inside) |
| Rooms · hours | 16 · 1.75 h (14 + annex 2, [§5A](#d9-depth)) |
| Signature mechanic | sand-flow tiles slide Pip (6 m/s, no walking against them) and carry blocks; **nameplate doors** take the matching student's nameplate; ivy lattices between floor heights (Ivy Gloves, found in r8) |
| Reward | **Ivy Gloves** (`$` in r8) |
| Encounter | **Tutor Scarabelle**'s exam in r14 ([creatures.md](./creatures.md#boss-scarabelle)); passing earns the Stair Stone (the bell's weight) |
| Grid | 41 × 43 tiles (82 × 86 m); realm grid 102 m |
| Palette | stone (sandstone) `#efe3c8`, trim `#c9a46b`, accent (glass blue) `#8ec9d8`, brick red `#b55d4c`, ivy `#5f8a4a`, dark tint `#3a2f22` |
| Light / music | ambient 0.65, warm light through sand-choked high windows (cards), sand trickles (particles) · track `buried_academy` (a slow school-bell chime over a hand-drum and bowed glass, 70 bpm) |
| Enemies | Sun Beetle ×4, Dust Puff ×5, Sandsnoot ×2, Prickle Pear ×6 |
| Chests | 4 gem · map · Chime Stone · Root Key · treasure |
| Keys | **no small keys**: three nameplates instead, 1 Root Key |

**Legend extension:** `<` `>` `{` `}` sand-flow west, east, north, south · `i` ivy lattice (an in-room wall face) ·
`N` nameplate door · `y` nameplate (a key item named for one door) · `R` receiver (exam hall only). Sand-flow: while
Pip's feet are on a flow tile he moves with it at 6 m/s plus his own input across it; he cannot go against it; a hop
keeps the flow's speed. A **block** pushed onto a flow is carried until it leaves the flow onto the next non-flow tile
(it stops there if that tile is free; otherwise it stops on the last flow tile). Nameplates: **"A. Wick"** (young
Granny Wick), **"Pelagia"** (young Pelagia), **"F. Ashmoth"** (a Lamplighter student of the last class). Each opens one
`N` door: `[E] Place · Nameplate`. They are dungeon items (`S.dungeons.buried_academy.plates`), not saved keys of the
game; after the dungeon, the two named ones also count for side story 43 *Roll Call*
([side-content.md](./side-content.md#ss-43)).

```map buried_academy L1
#####X###################################
#t...@...t#t..}}}..t#t._____.t#t.......t#
#.........#...}}}...#.._____..#..e...e..#
#..?......#...}}}...#..__y__..#.........#
#.........O...}}}...D..>>.>>..N.........#
#.I.....I.#...}}}...#..__.__..#....e....#
#.........#...}}}...#..<<<<<..#.........#
#t.......t#t..___..&#t._____.t#t.......%#
###################################D#####
#t.......t#t.......t#c........#t.e...e.t#
#...111...#..e...e..#......b..N.........#
#...1$1...#.I.....I.#.........#<<<<<<<<<#
#...111...N....y....#P<<<<<<<.#>>>>>>>>>#
###iii#####.I.....I.#.........#<<<<<<<<<#
#999999999#.....e...D.........#>>>>>>>>>#
#999999999#t.......t#t......rt#___.....y#
#####D#############################D#####
#999999999#t......9K#9c9......#t...s...t#
#999999999#......i99#999......#.........#
#.........#.........#.i.......#..e......#
#.........D.........D.........D.........#
#..e...e..#..e...e..#....e....#......e..#
#999i.....#.........#..e...e..#.........#
#c99i....t#t.......t#t.......t#t.......t#
###################################D#####
          #t.................t#t.......t#
          #...................#.........#
          #.........M.........#..I...I..#
          #...R...........R...B.........#
          #...................#..I...I..#
          #...................#.......c.#
          #.......p.p.p.......#t.......t#
          #...................###########
          #.......p.p.p.......#
          #...................#
          #.......p.p.p.......#
          #...................#
          #...................#
          #...R...........R...#
          #...................#
          #...................#
          #t.................t#
          ##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Belfry Stair | L1 | [0, 0, 11, 9] | - | 9 | `t`(1,1) `@`(5,1) `t`(9,1) `?`(3,3) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Sand Hall | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `t`(19,1) `t`(11,7) `&`(19,7) |
| r3 | The Slide Room | L1 | [20, 0, 11, 9] | - | 5 | `t`(21,1) `t`(29,1) `y`(25,3) `t`(21,7) `t`(29,7) |
| r4 | The Hall of Records | L1 | [30, 0, 11, 9] | - | 5 | `t`(31,1) `t`(39,1) `e`(33,2) `e`(37,2) `e`(35,5) `t`(31,7) `%`(39,7) |
| r8 | The Gloves Hall | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `$`(5,11) `i`(3,13) `i`(4,13) `i`(5,13) |
| r7 | The Library Stacks | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `t`(19,9) `e`(13,10) `e`(17,10) `I`(12,11) `I`(18,11) `y`(15,12) `I`(12,13) `I`(18,13) `e`(16,14) `t`(11,15) `t`(19,15) |
| r6 | The Sand Pump Room | L1 | [20, 8, 11, 9] | - | 5 | `c`(21,9) `b`(27,10) `P`(21,12) `t`(21,15) `r`(28,15) `t`(29,15) |
| r5 | The Lecture Hall | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `e`(33,9) `e`(37,9) `t`(39,9) `y`(39,15) |
| r9 | The Ivy Court | L1 | [0, 16, 11, 9] | - | 5 | `e`(3,21) `e`(7,21) `i`(4,22) `c`(1,23) `i`(4,23) `t`(9,23) |
| r10 | The Exam Corridor | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `K`(19,17) `i`(17,18) `e`(13,21) `e`(17,21) `t`(11,23) `t`(19,23) |
| r11 | The Old Gymnasium | L1 | [20, 16, 11, 9] | - | 7 | `c`(22,17) `i`(22,19) `e`(25,21) `e`(23,22) `e`(27,22) `t`(21,23) `t`(29,23) |
| r12 | The Prefects' Room | L1 | [30, 16, 11, 9] | - | 5 | `t`(31,17) `s`(35,17) `t`(39,17) `e`(33,19) `e`(37,21) `t`(31,23) `t`(39,23) |
| r13 | The Bell-Weight Hall | L1 | [30, 24, 11, 9] | - | 5 | `t`(31,25) `t`(39,25) `I`(33,27) `I`(37,27) `I`(33,29) `I`(37,29) `c`(38,30) `t`(31,31) `t`(39,31) |
| r14 | The Exam Hall | L1 | [10, 24, 21, 19] | - | 12 | `t`(11,25) `t`(29,25) `M`(20,27) `R`(14,28) `R`(26,28) `p`(18,31) `p`(20,31) `p`(22,31) `p`(18,33) `p`(20,33) `p`(22,33) `p`(18,35) `p`(20,35) `p`(22,35) `R`(14,38) `R`(26,38) `t`(11,41) `t`(29,41) |

**Room by room.**

- **r1 The Belfry Stair** (ceiling 9). `X` (5,0) up the bell tower to Academy Hill. Sign `?`(3,3): "LAMPLIGHTER
  ACADEMY. Walk in the halls. Sand: also walks in the halls."
- **r2 The Sand Hall.** A 3-wide south-flowing sand river (cols 14-16) empties into a pit (row 7). Step in at the top
  (row 1) and walk east: the drift (about 4 tiles) lands Pip on the east bank. Map chest `&` (19,7). Door (20,4)
  `always`.
- **r3 The Slide Room.** One-way lanes over a pit: lane (23-24,4) east carries Pip onto the island (col 25); lane
  (26-27,4) east carries him off to the east bank; lane (23-27,6) west takes him back. Nameplate **A. Wick** `r3:y1`
  (25,3) on the island desk. Nameplate door (30,4): A. Wick.
- **r4 The Hall of Records.** Wave 1: Sun Beetle ×2 at (33,2), (37,2) (shield front; hit from the side or the chop),
  Dust Puff ×1 at (35,5). Chime Stone chest `%` (39,7). Door (35,8) `clear`.
- **r5 The Lecture Hall.** Four sand lanes (rows 11-14) alternate west, east, west, east; crossing them south drifts
  Pip about 1.4 tiles each way. A pit (31-33,15) catches anyone who starts too far west. Nameplate **Pelagia**
  `r5:y1` (39,15). Wave 1: Prickle Pear ×2 at (33,9), (37,9) (turrets). Nameplate door (30,10): Pelagia. South door
  (35,16) opens from r12.
- **r6 The Sand Pump Room.** Push block `r6:b1` (27,10) south ×2 onto the west-flowing lane (row 12): it rides to hold
  plate `r6:P1` (21,12), which holds door (20,14) open (`plate`). Reset lever `r6:r1` (28,15). Gem chest `r6:c1`
  (21,9).
- **r7 The Library Stacks.** Four bookcase pillars. Wave 1: Dust Puff ×3 at (13,10), (17,10), (16,14) (kiters). Clear:
  nameplate **F. Ashmoth** `r7:y1` (15,12) appears on the reading desk. Nameplate door (10,12): F. Ashmoth.
- **r8 The Gloves Hall.** Treasure chest `$` (5,11): the **Ivy Gloves**. Item-get: "You got the Ivy Gloves! Walk into
  an ivy lattice to climb it." The room's south half is a terrace (digit 9) behind a low wall with ivy `i` (3-5,13):
  climb it to reach door (5,16).
- **r9 The Ivy Court.** Arrive on the terrace (9); drop to the court (0). Wave 1: Sandsnoot ×2 at (3,21), (7,21)
  (burrowers). Ivy `i` (4,22), (4,23) climbs west onto a corner ledge (9): gem chest `r9:c2` (1,23). Door (10,20).
- **r10 The Exam Corridor.** Ivy `i` (17,18) climbs east onto a ledge (9): Root Key chest `K` (19,17). Wave 1: Sun
  Beetle ×2 at (13,21), (17,21). Door (20,20).
- **r11 The Old Gymnasium** (ceiling 7). Ivy `i` (22,19) climbs north onto a ledge (9): gem chest `r11:c3` (22,17).
  Wave 1: Dust Puff ×1 at (25,21), Prickle Pear ×2 at (23,22), (27,22). Door (30,20).
- **r12 The Prefects' Room.** Switch `r12:s1` (35,17) opens door (35,16) to r5 for good (shortcut). Wave 1: Prickle
  Pear ×2 at (33,19), (37,21). Door (35,24) `always`.
- **r13 The Bell-Weight Hall.** A cradle on the floor where the bell's weight once rested (decor). Gem chest `r13:c4`
  (38,30). Boss door (30,28).
- **r14 The Exam Hall** (ceiling 12). Rows of tiny desks along the walls (decor). Tutor Scarabelle's desk `M`
  (20,27). Four receivers `R` (14,28), (26,28), (14,38), (26,38) for the aiming paper; nine tile plates `p` in a 3 ×
  3 grid (18-22, 31-35, every other tile) for the puzzle paper; creatures.md owns the three papers. After the pass,
  scene `ch_academy_stone` ([story.md](./story.md#ch15-17)): the bell rings for the first time in a century. `X`
  (20,42) to Academy Hill.

**Keys and chests ledger.** Nameplates: A. Wick (r3) → N (30,4); Pelagia (r5) → N (30,10); F. Ashmoth (r7) → N
(10,12). `K` (19,17) → B (30,28). Gem chests `r6:c1` (21,9), `r9:c2` (1,23), `r11:c3` (22,17), `r13:c4` (38,30) =
160 gems. Map r2, Chime Stone r4, Gloves r8.

**Solver notes.** r1 → r2: enter the river at row 1, cross, `&` → r3: lane to the island, A. Wick, lane east → N
(30,4) → r4: clear, `%` → r5: cross the lanes from col ≥ 35, Pelagia → N (30,10) → r6: block S2 rides to the plate,
`c1` → r7: clear, F. Ashmoth → N (10,12) → r8: `$` (Gloves), climb → r9: climb, `c2` → r10: climb, `K` → r11: climb,
`c3` → r12: `s1` → r13: `c4` → B → r14: the exam → `X`. The solver treats each flow tile as a forced move and each
lane crossing as a drift of ⌈1.36 × lanes⌉ tiles.

**Ask the Tree hints.**
1. "Sand rivers carry you. Start upstream." / "Step into the sand river at its very top and walk across. It carries
   you down to the far bank before the pit."
2. "Doors here want names, not keys." / "Each brass door has a nameplate slot. Find the student's nameplate in this
   wing and place it."
3. "Sand carries blocks, too." / "In the Sand Pump Room, push the block south onto the sand lane. It rides all the
   way to the square plate."

**Step split.** **Depth step S-251b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d9-depth). S-250 builds r1-r7 (sand-flow tiles and block riding, nameplates and nameplate doors), prints and
realm-suite entry. S-251 builds r8-r14 (Gloves chest, S-248's climb on `i` tiles, the exam hall layout); prints
refreshed. S-252 and S-253 run the exam in r14.

**Art (d9).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Academy wall | `tex_academy` (`realm: saltglass`) | "<style line> Seamless texture of pale sandstone school walls with faded blue tile trim and drifts of fine sand along the bottom, tileable" | make_seamless 1024/512 | `#efe3c8` with a `#8ec9d8` band |
| Sand-flow | `tex_sandflow` | 512² seamless rippled pale sand, ripples across one axis, tileable along the flow | make_seamless, UV-scrolled 3 m/s | `#e4d3a6` stripes |
| Nameplate door | `int_door_nameplate` | code-built: tall brass-studded wooden door with an empty brass plate slot at eye height; the placed plate shows its name as a painted decal | - | kit door + brass rectangle |
| Nameplate (item) | `icon_nameplate` | 128² icon: a small brass plate with engraved letters, transparent | export_sprites | a brass rectangle glyph |
| Ivy lattice | `int_ivy` (shared with S-248) | code-built: wooden trellis on the wall with ivy leaf cards `#5f8a4a` | - | green grid decal |
| Little desks | `int_desk` | code-built: 0.8 m school desk with an inkwell and a slate | - | small box |
| Exam receiver | `int_receiver` (d5 kit) | as d5 | - | - |

ART BRIEF `int_door_nameplate`: silhouette a tall rounded-top wooden door with brass studs and an empty brass nameplate
slot; size 2.0 × 2.8 m; palette wood `#7a5232`, brass `#c9a24a`, plate `#e9d8b0`; materials painted wood, brass sheen;
tris 500 (code 120); pose static, swings open 90° in 0.8 s. Image prompt: "<style line> A tall old school door with
brass studs and an empty brass nameplate slot, sand drifted at its foot, warm light, cosy." 3D prompt: "Stylised
low-poly tall wooden school door with brass studs and a nameplate slot, hand-painted, game-ready, under 500
triangles, 2 × 2.8 m."

---
<a id="d10"></a>
### d10 The Spiral Stair

| Field | Value |
|---|---|
| Realm id / file | `spiral_stair` · `js/realms/dungeons/spiral_stair.js` |
| Where | inside the rock under the Spiral Arch, Arch Rise, Driftholm; the door is in the arch's base ([atlas-far.md](./atlas-far.md#driftholm)) |
| Opens | ch18 after reaching Driftholm and reading the Tally Wall ([story.md](./story.md#ch18)) |
| Needs on entry | Starsong (and every earlier tool; none but the Starsong needed inside) |
| Rooms · hours | 13 · 1.25 h (10 + annex 3, [§5A](#d10-depth)) |
| Signature mechanic | song platforms: each Starsong note makes one colour of cloud solid for **8 s** (low rose, mid gold, high sky); from r6, Cloudstep hops off cloud motes |
| Reward | **Cloudstep** (`$` in r6) |
| Encounter | **Mote**, the chase up The Spiral in r10 ([creatures.md](./creatures.md#boss-mote-chase)); Pip never hits him |
| Grid | 31 × 49 tiles (62 × 98 m); realm grid 114 m |
| Palette | stone (lilac rock) `#c9b6ec`, trim `#f7f2ff`, accent (meadow) `#9bb87a`, rose `#f4a6c0`, gold `#ffd36b`, sky `#8fd3ff`, dark tint `#4a3f66` |
| Light / music | ambient 0.7, open sky through gaps (sky dome visible here, the only dungeon that shows it) · track `spiral_stair` (airy harp, the three Starsong notes woven in, 88 bpm; the chase adds a quick pizzicato layer) |
| Enemies | Nimbus Puff ×4, Gust Kite ×3 |
| Chests | 3 gem · map · Chime Stone · Root Key · treasure |
| Keys | 1 small, 1 big |

**Legend extension:** `E` rose cloud · `F` gold cloud · `J` sky cloud · `n` cloud mote (a puff floating 1.2 m above its
tile). A cloud tile is mist (a pit: "the clouds bounce Pip back", R4) until its note is played anywhere in the room;
then every cloud of that colour in the room is solid for 8 s (re-playing resets the timer), flashing for the last 2 s.
Room r5 is **solo**: playing a note mists the other two colours at once. Cloudstep: one extra hop in the air for each
mote Pip passes within 1.5 m of (each mote once per airtime). Pits here are open sky over a soft cloud floor.

```map spiral_stair L1
#####X#########################
#t...@...t#t._____.&#t._____.t#
#.........#.._____..#.._____..#
#..?......#.._____..#..__c__..#
#.........O..EEEEE..D..FF.FF..#
#.I.....I.#.._____..#..__.__..#
#.........#.._____..#.._____..#
#t.......t#t._____.t#t._____.t#
############################D##
#t.......t#._______.#_______..#
#...111...#k_______.#.JJJJJJ..#
#...1$1...#._______.#._______.#
#...111...L.J.FF.EE.D._______.#
#____n____#._______.#._______.#
#_________#._______.#._______.#
#t.......t#t_______t#%_______t#
#####D#########################
#t.......t#cFFF...4K#t..___..t#
#_________#____...44#..._c_...#
#____n____#____..n..#..._J_...#
#_________#____.....D.........#
#____n____#____.....#..e...e..#
#.........D.........#.........#
#t.......t#t.......t#t.......t#
###############B###############
#3333333333444#.........#
#3333333333344#.........#
#33##########4########..#
#33#66666677#44444444#..#
#33#66666667#44444444#..#
#33#66#####7#######44#..#
#33#66#77777#88888#44#..#
#33#66#77777#88888#44#..#
#33#66#77####8##88#44#..#
#33#66#77#98888#88#44#..#
#33#66#77#99888#88#44#..#
#33#66#77#99X89#88#44#..#
#32#66#77#99999#88#45#.1#
#22#66#77#99999#88#55#11#
#22#66#77#######88#55#11#
#22#66#77777788888#55#11#
#22#66#77777888888#55#11#
#22#66#############55#11#
#22#66555555555555555#11#
#22#66655555555555555#11#
#22###################11#
#22222222222111111111111#
#22222222222211111111111#
#########################
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Arch Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `@`(5,1) `t`(9,1) `?`(3,3) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Rose Steps | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `&`(19,1) `t`(11,7) `t`(19,7) |
| r3 | The Gold Steps | L1 | [20, 0, 11, 9] | - | 5 | `t`(21,1) `t`(29,1) `c`(25,3) `t`(21,7) `t`(29,7) |
| r6 | The Cloudstep Loft | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `$`(5,11) `n`(5,13) `t`(1,15) `t`(9,15) |
| r5 | The Three-Colour Hall | L1 | [10, 8, 11, 9] | - | 5 | `k`(11,10) `t`(11,15) `t`(19,15) |
| r4 | The Sky Steps | L1 | [20, 8, 11, 9] | - | 5 | `%`(21,15) `t`(29,15) |
| r7 | The Mote Garden | L1 | [0, 16, 11, 9] | - | 5 | `t`(1,17) `t`(9,17) `n`(5,19) `n`(5,21) `t`(1,23) `t`(9,23) |
| r8 | The High Meadow Hall | L1 | [10, 16, 11, 9] | - | 5 | `c`(11,17) `K`(19,17) `n`(17,19) `t`(11,23) `t`(19,23) |
| r9 | Mote's Lookout | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `t`(29,17) `c`(25,18) `e`(23,21) `e`(27,21) `t`(21,23) `t`(29,23) |
| r10 | The Spiral | L1 | [0, 24, 25, 25] | - | 10 | `X`(12,36) |

**Room by room.**

- **r1 The Arch Door.** `X` (5,0) to Arch Rise. Sign `?`(3,3) in Mote's small round letters: "KEEP OUT. (Please.)
  — M." Under it, scratched later, smaller: "unless you're her." A dozen scrap lamps (decor) hang unlit.
- **r2 The Rose Steps.** A 5-tile rose path (13-17,4) over open sky: play low, walk across (2.3 s). Map chest `&`
  (19,1).
- **r3 The Gold Steps.** Two gold runs (23-24,4) and (26-27,4) meet a stone island (25,4)-(25,5): gem chest
  `r3:c1` (25,3). Wave 1: Gust Kite ×1 diving across the gap (it pushes, never knocks Pip off: its push is 1 m and
  stops at an edge). Door (28,8).
- **r4 The Sky Steps.** An L path: sky clouds (22-27,10) from the east landing to the west strip. Chime Stone chest `%`
  (21,15). Wave 1: Gust Kite ×1. Door (20,12).
- **r5 The Three-Colour Hall** (solo). Rose (17-18,12), stone (16,12), gold (14-15,12), stone (13,12), sky (12,12):
  play low, cross; play mid on the stone, cross; play high, cross. Small key `r5:k1` (11,10). Wave 1: Nimbus Puff ×2
  (kiters) hovering over the gap. Locked door (10,12).
- **r6 The Cloudstep Loft.** Treasure chest `$` (5,11) on a dais: **Cloudstep**. Item-get: "You got Cloudstep! Hop
  again in mid-air when you pass a cloud mote." A 2-tile gap (rows 13-14) with mote `r6:n1` (5,13): hop, Cloudstep,
  land on row 15. Door (5,16).
- **r7 The Mote Garden.** Four rows of open sky (18-21) with motes `r7:n1` (5,19) and `r7:n2` (5,21): hop off row 17,
  Cloudstep twice, land on row 22. Wave 1: Gust Kite ×1. Door (10,22).
- **r8 The High Meadow Hall.** Gold path (12-14,17) to gem chest `r8:c2` (11,17). Mote `r8:n1` (17,19) beside a ledge
  (digit 4): hop, Cloudstep up onto it, Root Key chest `K` (19,17). Doors: east (20,20), boss door south (15,24).
- **r9 Mote's Lookout.** A little nest of blankets and a hundred-mark tally scratched on the wall (decor; the real
  Tally Wall is outside). Gem chest `r9:c3` (25,18) on a rock in the sky: play high, stand on the sky cloud (25,19),
  open it. Wave 1: Nimbus Puff ×2 at (23,21), (27,21).
- **r10 The Spiral** (ceiling 10, open roof). A square spiral corridor two tiles wide climbing to a plaza in the middle;
  its digits rise along the path (0 at the boss door to 9 in the plaza). In r10 **each digit is 0.6 m and digit
  changes compile as smooth ramps** (17°, walkable), so the climb is 5.4 m. Plugs at local (13,0-1), (11,3-4) and
  (11,6-7) force the whole way round each ring; ring gaps at (12,2), (10,5), (12,8). Path length 175 tiles (350 m).
  The chase spline runs along the corridor centre line in three legs (ring 0, ring 1, ring 2 + plaza): Mote starts
  8 m ahead of Pip at the boss door; a gap over 20 m for 5 s restarts the current leg from its start (never a fail
  screen; creatures.md owns the lights he drops). `X` (12,36) in the plaza: the stair up to the Spiral Arch, where
  scene `ch18_arch` plays ([story.md](./story.md#ch18)).

**Keys and chests ledger.** `r5:k1` → L (10,12); `K` (19,17) → B (15,24). Gem chests `r3:c1` (25,3), `r8:c2` (11,17),
`r9:c3` (25,18) = 120 gems. Map r2, Chime Stone r4, Cloudstep r6.

**Solver notes.** r1 → r2: low, cross, `&` → r3: mid, cross, `c1` → r4: high, cross, `%` → r5: low / mid / high in
turn, `k1` → unlock → r6: `$` (Cloudstep), mote hop → r7: two motes → r8: mid, `c2`; mote up the ledge, `K` → r9: high,
`c3` → r8 → B → r10: the chase → `X`. The solver models a cloud as a bridge open 8 s from its note (each run here is ≤ 6
tiles, under 3 s) and a mote as one extra 2-tile hop or a 3-4 digit rise.

**Ask the Tree hints.**
1. "Clouds here listen for music." / "Hold the Starsong and play a note. Clouds of that colour turn solid for a few
   seconds: low for rose, mid for gold, high for sky."
2. "In the Three-Colour Hall the clouds are jealous." / "Only one colour stays solid at a time there. Play low and
   cross the rose, then play mid on the stone, then high."
3. "The Root Key is just a little too high to hop." / "In the High Meadow Hall, hop next to the cloud mote and hop again
   in the air. Cloudstep lifts you onto the ledge."

**Step split.** **Depth step S-270b** (after the second room step, before the boss step) adds the annex, the flip, the latch and the synthesis in [§5A](#d10-depth). S-269 builds r1-r5 (song clouds, the solo rule; needs S-208's Starsong), prints and realm-suite entry.
S-270 builds r6-r10 (Cloudstep chest from S-268, motes, the spiral room, the chase spline data); prints refreshed.
S-271 runs the chase in r10; S-272 plays the arch scene.

**Art (d10).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Lilac rock | `tex_driftrock` (`realm: driftholm`) | "<style line> Seamless texture of smooth pale lilac stone with soft white veins and tiny moss stars, tileable" | make_seamless 1024/512 | `#c9b6ec` noise |
| Song cloud | `int_song_cloud` | code-built: a 2 × 2 m soft cloud puff (three spheres, flattened top); mist state 25 % opacity drifting, solid state 100 % with a coloured glow (`#f4a6c0` / `#ffd36b` / `#8fd3ff`) | - | coloured translucent box |
| Cloud mote | `int_cloud_mote` (shared with S-268) | code-built: 0.8 m bobbing puff with a white sparkle | - | white sphere |
| Scrap lamp | `int_scrap_lamp` | code-built (shared with the Driftholm kit): 0.4 m lamp made of a jam jar, a bent spoon and string, dim amber | - | small amber sphere |
| Mote's nest | `int_mote_nest` | code-built: a round heap of patched blankets 2 m across with a pillow | - | flattened sphere |

ART BRIEF `int_song_cloud`: silhouette a plump flat-topped cloud cushion; size 2 × 2 × 0.8 m; palette white `#f7f2ff`
with a rose, gold or sky glow; materials soft, translucent edges, inner glow; tris 300 (code 90); pose: mist (wispy,
drifting 0.2 m) and solid (plump, still), 0.3 s blend. Image prompt: "<style line> Three soft cloud stepping-stones
over open sky, one glowing rose, one gold, one sky blue, a little floating island meadow behind." 3D prompt:
"Stylised low-poly cloud cushion platform, flat walkable top, soft glow, hand-painted, game-ready, under 300
triangles, 2 m square."

---
<a id="d11"></a>
### d11 The Ladder of Lights

| Field | Value |
|---|---|
| Realm id / file | `ladder` · `js/realms/dungeons/ladder.js` |
| Where | Mote's Ladder, hanging from The Ladder Foot in the Starmeadow down into Wenna's crown; entered at its top rung ([atlas-far.md](./atlas-far.md#starmeadow)) |
| Opens | ch20 ([story.md](./story.md#ch20)), after Old Mother Brightwell's scene in ch19 |
| Needs on entry | every tool (Lantern, Glider, Tide Bell, Hook, Sunglass, Paws, Starsong, Sling, Gloves, Cloudstep) |
| Floors · hours | 16 · 2.5 h (one room per floor) |
| Signature mechanic | one floor per borrowed light, each using the tool of the place it came from (F2-F5 the four Act II beacons; F6-F11 the little lights Mote gathered over a century), then mixed floors F12-F15; **Twinkling rungs** throughout |
| Reward | none (the finale follows); each freed light streams home and is seen doing so |
| Boss | none inside; F16's exit leads into `crown` and the Second Sneeze ([creatures.md](./creatures.md#finale)) |
| Levels | F1-F16, each 13 × 11 tiles, `at` = [15 × (n−1 mod 4), 13 × floor((n−1)/4)]; `base` = 60 − 4 × n m (visual descent only) |
| Grid | extent 58 × 50 tiles (116 × 100 m); realm grid 132 m |
| Palette | rungs and frame `#141a3a` / `#ffe9a8` / `#8fa8ff`; each floor F2-F11 tints its floor and wall-cards with the palette of the light's home (Duskwick `#2b2238 #f2b45a`, Pinewhistle `#2f4a3a #c98b4b`, Archwater `#36414f #7fd3d0`, Threemills `#e7c45a #7fae4b`, Woods fireflies `#2f4a2a #d8f07a`, Forgefall `#3b3540 #e66f4f`, moonlight `#2a3358 #f6f3d8`, glow-moss `#1c1a24 #7be0c8`, the lighthouse `#ff8f7a #efe6d6`, starlight `#141a3a #ffe9a8`) |
| Light / music | open night sky all round (sky dome on), the floor is a woven lattice of light over a void; music box and choir hum (`ladder`), each freed light adds one chime to the loop |
| Enemies | Dimling ×6, Needle Wasp ×2, Tidepool Jelly ×2, Woolly Ram ×2, Soot Snuffle ×2, Glow Grub ×2, Stardust Sprite ×7, Moonbeam Turret ×1, Comet Pup ×2, Wisp Lantern ×2 |
| Chests | 3 gem (no map, Chime Stone or keys: the Ladder is one way down) |

**Legend extension (d11):** every glyph keeps its meaning from the dungeon that introduced it: `g l` (d1), `u` (d2,
always open here), `Q , ;` (d3), `h` (d4), `/ \ m R` (d5, no fixed sources here), `d` (d6), `E F J n` (d10), `a q f`
(d8 brazier, bell target, wax), `i` (d9). New: `o` **Twinkling rung** and `!` **borrowed light**.
- **Twinkling rung** `o`: a dark rung socket over the void (a pit until lit). Look at it within 8 tiles and press
  `[E] Kindle · Rung`: a Twinkling flies to it and it becomes a glowing rung deck. The three Twinklings light **at most
  3 rungs at once**: kindling a fourth puts out the oldest one Pip is not standing on. Lit rungs have no timer.
- **Borrowed light** `!`: an orb of wound light in a cage of rung-wire. When the floor's condition holds, the cage
  unwinds; `[E] Touch · Borrowed light` frees it: 2 s unwind, then it streams off as a ribbon toward its home (visible
  for 6 s through the Ladder's open sides), `lantern_pop` plus the floor's chime, and the hatch `^` (6,9) below opens.
- Every floor's arrival stair is `^` (6,1) and its way down is the hatch `^` (6,9); F1's top `X` (6,0) leads back to
  The Ladder Foot; F16's `X` (6,10) leads into `crown`. "Dizzy" wakes Pip at F1's `@` with every freed light kept.

```map ladder F1
######X######
#t....@....t#
#...........#
#.....?.....#
#_____o_____#
#_____o_____#
#_____o_____#
#_____o_____#
#_____o_____#
#t....^....t#
#############
```

```map ladder F2
#############
#l....^....l#
#...........#
#.e.......e.#
#...........#
#.....!.....#
#...........#
#.e.......e.#
#...........#
#l....^....l#
#############
```

```map ladder F3
#############
#99999^99999#
#99999999999#
#___________#
#___________#
#...........#
#........999#
#.......u9!9#
#........999#
#.....^.....#
#############
```

```map ladder F4
#############
#.....^.....#
#..Q........#
#,,,,,;,,,,,#
#,,,,,;,,,,,#
#,,,,;!;,,,,#
#,,,,,;,,,,,#
#,,,,,,,,,,,#
#...........#
#.....^.....#
#############
```

```map ladder F5
#############
#.....^.....#
#..e.....e..#
#...........#
#___________#
#___.!______#
#___h_______#
#___________#
#...........#
#.h...^.....#
#############
```

```map ladder F6
#############
#.....^.....#
#...........#
#\..........#
#_..........#
#_....!.....#
#_..........#
#RI.........#
#I..........#
#.....^.....#
#############
```

```map ladder F7
#############
#.....^.....#
#a.........a#
#...........#
#...ddddd...#
#...d.!.d...#
#...ddddd...#
#...........#
#a........dc#
#.....^.....#
#############
```

```map ladder F8
#############
#.....^.....#
#.Q.........#
#,,,,,,,,,,,#
#,,,________#
#...EEFF!___#
#,,,________#
#,,,,,,,,,,,#
#,,,,,,,,,,,#
#.....^.....#
#############
```

```map ladder F9
#############
#.....^.....#
#l.........l#
#...........#
#####iii#####
#99999999999#
#99999!99999#
#99999999999#
#...........#
#l....^....l#
#############
```

```map ladder F10
#############
#.....^.....#
#...........#
#...........#
#___________#
#___________#
#_______9!99#
#_______h999#
#___________#
#c....^.....#
#############
```

```map ladder F11
#############
#.....^.....#
#...........#
#_____o_____#
#_____o_____#
#_____o__444#
#_____._n4!4#
#________444#
#...........#
#.....^.....#
#############
```

```map ladder F12
#############
#.....^.....#
#...........#
#_____o_____#
#_____o_____#
#_____o_____#
#_____._____#
#_____o_____#
#_____o_____#
#.....^.....#
#############
```

```map ladder F13
#############
#.....^.....#
#...........#
#o__________#
#o__________#
#o__________#
#.____.h....#
#_____......#
#_____.....c#
#_____^.....#
#############
```

```map ladder F14
#############
#99999^99999#
#99999999999#
#___________#
#___________#
#___________#
#FFFFFFFFFFF#
#_____o_____#
#_____o_____#
#.....^.....#
#############
```

```map ladder F15
#############
#l....^....l#
#...........#
#q.........q#
#...........#
#.....q.....#
#...........#
#.e.......e.#
#...........#
#l....^....l#
#############
```

```map ladder F16
#############
#t....^....t#
#...........#
#...........#
#...........#
#...........#
#...........#
#...........#
#...........#
#t.........t#
######X######
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| F1 | The Ladder Foot | F1 | [0, 0, 13, 11] | - | 8 | `t`(1,1) `@`(6,1) `t`(11,1) `?`(6,3) `o`(6,4) `o`(6,5) `o`(6,6) `o`(6,7) `o`(6,8) `t`(1,9) `^`(6,9) `t`(11,9) |
| F2 | Wickhaven's Light | F2 | [0, 0, 13, 11] | yes | 8 | `l`(1,1) `^`(6,1) `l`(11,1) `e`(2,3) `e`(10,3) `!`(6,5) `e`(2,7) `e`(10,7) `l`(1,9) `^`(6,9) `l`(11,9) |
| F3 | Whistle Rise's Light | F3 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `u`(8,7) `!`(10,7) `^`(6,9) |
| F4 | The Moon Pool's Light | F4 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `Q`(3,2) `!`(6,5) `^`(6,9) |
| F5 | Tumble Hill's Light | F5 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `e`(3,2) `e`(9,2) `!`(5,5) `h`(4,6) `h`(2,9) `^`(6,9) |
| F6 | The Firefly Jars | F6 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `\`(1,3) `!`(6,5) `R`(1,7) `I`(2,7) `I`(1,8) `^`(6,9) |
| F7 | The Forge Sparks | F7 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `a`(1,2) `a`(11,2) `d`(4,4) `d`(5,4) `d`(6,4) `d`(7,4) `d`(8,4) `d`(4,5) `!`(6,5) `d`(8,5) `d`(4,6) `d`(5,6) `d`(6,6) `d`(7,6) `d`(8,6) `a`(1,8) `d`(10,8) `c`(11,8) `^`(6,9) |
| F8 | The Moon Puddles | F8 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `Q`(2,2) `!`(8,5) `^`(6,9) |
| F9 | The Glow-Moss | F9 | [0, 0, 13, 11] | yes | 8 | `^`(6,1) `l`(1,2) `l`(11,2) `i`(5,4) `i`(6,4) `i`(7,4) `!`(6,6) `l`(1,9) `^`(6,9) `l`(11,9) |
| F10 | The Lighthouse Gleam | F10 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `!`(9,6) `h`(8,7) `c`(1,9) `^`(6,9) |
| F11 | The Star Splinters | F11 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `o`(6,3) `o`(6,4) `o`(6,5) `n`(8,6) `!`(10,6) `^`(6,9) |
| F12 | The Long Rungs | F12 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `o`(6,3) `o`(6,4) `o`(6,5) `o`(6,7) `o`(6,8) `^`(6,9) |
| F13 | The Hook Rungs | F13 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `o`(1,3) `o`(1,4) `o`(1,5) `h`(7,6) `c`(11,8) `^`(6,9) |
| F14 | The Gold Drop | F14 | [0, 0, 13, 11] | - | 8 | `^`(6,1) `o`(6,7) `o`(6,8) `^`(6,9) |
| F15 | The Last Lights | F15 | [0, 0, 13, 11] | yes | 8 | `l`(1,1) `^`(6,1) `l`(11,1) `q`(1,3) `q`(11,3) `q`(6,5) `e`(2,7) `e`(10,7) `l`(1,9) `^`(6,9) `l`(11,9) |
| F16 | The Crown Door | F16 | [0, 0, 13, 11] | - | 8 | `t`(1,1) `^`(6,1) `t`(11,1) `t`(1,9) `t`(11,9) |

**Floor by floor** (light, its home, the condition that opens its cage, then the hatch):

- **F1 The Ladder Foot.** `X` (6,0) to The Ladder Foot; `@` (6,1). Sign `?`(6,3) is a note pinned by Mote: "Going
  down to fetch her. Back by morning. Please don't follow. — M." Five rung sockets (6,4)-(6,8) over the void: kindle
  three, walk, kindle the last two (the first two go out). The Twinklings introduce themselves here (scene
  `ch20_twinklings`, [story.md](./story.md#ch20)).
- **F2 Wickhaven's Light** (Duskwick; dark). Kindle the four wall-lanterns (1,1), (11,1), (1,9), (11,9) with the
  Lantern: the cage opens. Wave: Dimling ×4 at (2,3), (10,3), (2,7), (10,7). The light streams to Duskwick's tower
  window.
- **F3 Whistle Rise's Light** (Pinewhistle). Glide from the arrival terrace (digit 9) over the two-row gap; ride updraft
  `u` (8,7) (always open, top 3.0 m) to the perch (digit 9); the cage opens when Pip stands on the perch. Wave:
  Needle Wasp ×2. The light streams to the Whistling Pine.
- **F4 The Moon Pool's Light** (Archwater). Starts at high water: walk the rafts (6,3)-(6,4) to the light (6,5) (its
  cage opens when the tide stone has been rung once on this floor, so ring `Q` (3,2) twice: low then high). Ring for
  low water to walk to the hatch. Wave: Tidepool Jelly ×2 (at low water). The light streams to the Great Arch.
- **F5 Tumble Hill's Light** (Threemills). Hook `h` (4,6) from the north floor (land on (4,5)); the cage opens when Pip
  lands; free the light; hook `h` (2,9) to land on row 8. Wave: Woolly Ram ×2 at (3,2), (9,2). The light streams to the
  granary on Tumble Hill.
- **F6 The Firefly Jars** (Whispering Woods' fireflies). Turn mirror `/` (1,3) (starts `\`, needs `/`: two hits); shine
  the Sunglass west along row 3: the beam turns south over the pits (1,4)-(1,6) into receiver `R` (1,7) (latch), which
  opens the cage. Pillars (2,7) and (1,8) block straight shots. The fireflies stream to the Woods' fairy rings.
- **F7 The Forge Sparks** (Forgefall). Light the three high braziers `a` (1,2), (11,2), (1,8) with embers: the cage
  opens; dig any mound of the ring (4-8,4-6) to reach the light. Gem chest `F7:c1` (11,8) behind mound (10,8). Wave: Soot
  Snuffle ×2. The sparks stream to Master Scoria's forge.
- **F8 The Moon Puddles** (moonlight from every puddle on the Wide Blue). Ring `Q` (2,2) for low water, walk to the
  landing (1-3,5), play low and mid: rose and gold clouds (4-7,5) carry Pip to the light (8,5). The cage opens when
  both colours are solid together. Moonlight streams up to the sky.
- **F9 The Glow-Moss** (glow-moss from Grumble's Crown; dark). Climb ivy (5-7,4) onto the terrace (digit 9); the cage
  opens when all four wall-lanterns (1,2), (11,2), (1,9), (11,9) are lit. Wave: Dimling ×2, Glow Grub ×2. The moss-light
  streams to Grumble's Crown.
- **F10 The Lighthouse Gleam** (Captain Pinch's lamp). Hook `h` (8,7) from the north floor to the perch (digit 9); the
  cage opens on landing; free the gleam; glide south over row 8 to the floor. Gem chest `F10:c2` (1,9). The gleam
  streams to the lighthouse lamp room.
- **F11 The Star Splinters** (from the Starmeadow). Kindle rungs (6,3)-(6,5) to the stone (6,6); hop east by mote `n`
  (8,6) and Cloudstep up onto the perch (digit 4): the cage opens. Wave: Stardust Sprite ×4 (swarm). The splinters
  stream up to the Starkin. (One splinter stays in Pip's pocket: it pays *Pitch Wants a Star*, ss-39, flag
  `starSplinter`, [side-content.md](./side-content.md#ss-39).)
- **F12 The Long Rungs.** Five sockets (6,3)-(6,5) and (6,7)-(6,8) with a stone (6,6) between: the three-rung limit
  means re-kindling from the stone. Wave: Moonbeam Turret ×1 on the far landing (a slow beam sweep, 0.8 s tell). No light;
  the hatch is open.
- **F13 The Hook Rungs.** Rungs (1,3)-(1,5) down the west edge to a stone (1,6); hook `h` (7,6) six tiles east, land on
  (6,6). Gem chest `F13:c3` (11,8). Wave: Comet Pup ×2 on the east floor.
- **F14 The Gold Drop.** From the arrival terrace (digit 9) play mid and glide south over three rows of void onto the
  gold clouds (row 6); kindle rungs (6,7)-(6,8) before the 8 s run out (or play mid again). Wave: Stardust Sprite ×3.
- **F15 The Last Lights** (dark). Ring the three high bell targets `q` (1,3), (11,3), (6,5) with embers: the hatch
  opens. Wave: Wisp Lantern ×2 (ghost: only hittable in lamplight).
- **F16 The Crown Door.** Blossom drifts up from below. `X` (6,10): the last rung, into the Crown (`crown` realm),
  where ch21 begins. The Ladder's floors stay revisitable from The Ladder Foot until the main ending; after it, the
  Ladder is gone and the realm is closed (its gem chests count as found if opened, otherwise they move to the Crown's
  four boughs, one per bough, so nothing is missable).

**Chests ledger.** `F7:c1` (11,8), `F10:c2` (1,9), `F13:c3` (11,8) = 120 gems. Freed lights set flags
`ladderLight:<n>` 1-10; the solver and the chapter test assert all ten before F16's exit opens.

**Solver notes.** Linear: on each floor the solver proves the light (where present) and the hatch are reachable from
the arrival stair with the tools listed, and that the rung limit never strands Pip (from every reachable state with
three rungs lit, at least one legal kindle leads on). F11 and F13 need the 3-rung rule; F14 the 8 s cloud window (the
glide takes 1.9 s, two rungs 0.9 s).

**Ask the Tree hints.**
1. "The Twinklings can only hold three rungs at a time." / "Kindle three rungs, walk to the last one, then kindle the
   next ones. The rungs behind you go out, and that's fine."
2. "That mirror on the Firefly floor wants to send your beam round a corner." / "Bonk the mirror twice, then shine
   your beam west along its row. It bends down into the sunflower."
3. "The Gold Drop: music first, then jump." / "Play the middle note before you glide off the terrace, so the gold
   clouds are solid when you land."

**Step split.** S-280 builds F1-F6 (rung sockets, borrowed lights, the stream-home effect, the light flags), prints
and realm-suite entry. S-281 builds F7-F11 (mixed-tool floors). S-282 builds F12-F16 and the portal into `crown`;
prints refreshed. The finale itself is S-284-S-286 in the Crown.

**Art (d11).**

| Asset | Key | What to generate / build | Processing | Fallback |
|---|---|---|---|---|
| Ladder lattice floor | `tex_ladder_weave` (`realm: starmeadow`) | "<style line> Seamless texture of a woven floor of soft golden light-threads on deep night blue, like glowing basketwork, tileable" | make_seamless 1024/512 (emissive) | gold grid on `#141a3a` |
| Rung socket / rung | `int_rung` | code-built: a 2 m bar of twisted light, dark `#3a3f66` when empty, lit `#ffe9a8` with a Twinkling perched on it | - | gold box |
| Borrowed light cage | `int_light_cage` | code-built: 1.4 m sphere of glowing light in a loose cage of wound wire-light; tinted by its home palette | - | tinted emissive sphere |
| Light ribbon | `fx_light_stream` | 64 × 1024 transparent painted ribbon of soft light with sparkles, tinted per light | webp | additive quad strip |
| Night-sky cards | `card_ladder_sky` | 2048 × 512 transparent painted ring of distant isles at night seen from high above (Duskwick, Pinewhistle, Archwater, Threemills, the home isle with its Tree), lights coming on one by one in layers | webp, split into 4 tiles | gradient |
| Twinkling | see [cast.md](./cast.md) | - | - | - |

ART BRIEF `int_light_cage`: silhouette a round glowing orb loosely bound by three spiralling bands of light-wire; size
1.4 m orb, 1.8 m with the cage; palette core `#ffe9a8`, bands `#8fa8ff`, tint per home; materials emissive, soft bloom
card behind; tris 500 (code 160); pose: wound (slowly turning 20°/s), unwinding (bands peel off over 2 s). Image
prompt: "<style line> A glowing orb of gathered lamp-light wound in loose spirals of light-thread, floating on a
ladder of light high in a starry night sky." 3D prompt: "Stylised low-poly glowing orb inside a loose spiral cage of
light bands, hand-painted emissive, game-ready, under 500 triangles, 1.8 m."

---
<a id="depth"></a>
## 5A. The depth pass (R14)

Rule [R14](#rules) asks more of every story dungeon d1-d10 than the maps in §5 give on their own: more beats per room,
rooms where two mechanics meet, one mid-dungeon **state flip** that sends the player back through rooms they have
already solved, and a last room before the boss that uses everything. This section adds what is needed, dungeon by
dungeon. Each dungeon gets one **depth step** (`S-<second room step>b`, listed per dungeon) that lands after the
dungeon's second room step and before its boss step. The §5 maps stay as they are until that step: the depth step
copies the annex maps below into the realm, applies the **tile edits** listed here to the §5 map block and to the
realm data in the same PR (the map test then compares against the edited block), and refreshes the prints.

<a id="depth-common"></a>
### 5A.1 Shared pieces

- **Annex levels.** Each dungeon gains an annex: level `LA` (the flip side) and, for d3-d10, level `LB` (the latch
  room). Annex levels are ordinary levels of the same realm, joined to the §5 rooms only by **stair warps** `^`
  (0.35 s fade, decision 1), so no §5 wall moves. A stair warp in a §5 room that leads to an annex not yet built is
  drawn as a **sealed hatch** (a root lid, `Look`: "Sealed tight. Something below is waiting."), so the §5 maps work
  on their own until the depth step lands.
- **The flip.** A lever-like entity (glyph `s` with `flip: '<flag>'` in its entity row) in the last `LA` room. Hitting
  it sets the dungeon flag (saved in `S.dungeons[id].state.flip = true`), plays a 1.5 s rumble with a camera nudge and
  the line from the dungeon's table below, and from then on changes the two named earlier rooms (**Q** and **P**).
  Every change is an **entity-state** change in the room's entity table (no wall moves): a direction, a timer, a
  start state, a new or removed entity. The solver models the flag as one more state bit.
- **The latch.** Every boss door `B` in d2-d10 gains a second bar, **the Warden's latch**: `B` opens on
  `key:K && latch:<id>` (d1: `key:K && plate:r7:P1`). The latch switch is a crystal switch `s` with `latch: true`.
  In d3-d10 it is in `LB`, whose stair hatch sits in room **P** and stays sealed until the flip; in d2 it is in r9.
  So the path is always: pre-boss room **X** → `LA` → flip → back through **Q** and **P** (re-solved in their new
  state) → `LB` latch → back to **X** → `B`. Hitting the latch plays "A bar lifts somewhere far off." (toast
  `dg.latch`) and a distant clunk on the boss door's position (positional, so it points the way).
- **Synthesis in X.** The pre-boss room gets the retrofits listed per dungeon so its solution uses at least three
  action kinds: the signature, the dungeon's own tool and an earlier tool (R14 item 4). Its existing wave becomes
  `clear`-gating for `B`.
- **Fallback.** If the depth test (§5A.12) reports a dungeon under a threshold after the listed changes, the depth step
  adds, in the lowest-beat counted room on the main path, a push-block and a hold plate that keep that room's door
  open (block on a floor tile, plate on a floor tile 2-5 pushes away), repeats until the thresholds hold, and records
  the tiles here in the same PR.

<a id="depth-counts"></a>
### 5A.2 Counting rules (what the depth test measures)

- **Counted rooms**: every room except the entrance room, the boss arena and a post-boss room (d1 r9).
- **A beat** is one action in the solver's intended solution of these kinds: switch or lever hit; plate stepped (a
  toggle plate's step, or a block brought to a hold plate: one beat per block placed); push-block moved to its final
  tile; crank or hub wheel turned; tool used on a gate object (kindle set, ring, hook, beam fill, dig, note or tune,
  ember shot, climb start, Cloudstep hop); mirror set (one per mirror, however many hits); tide or flip toggled; a
  wave that gates something (`clear`). A traversal (ride, glide, raft, timed root or cloud crossing) counts only when
  the solver's graph shows it depends on a state set in the same room. Not beats: chests, picking up keys,
  unlocking with a key, walking, free hops, stairs. A room revisited in a new state counts its new beats again.
- **A compound room** has beats of at least two kinds in one dependency chain inside the room, one of them the
  dungeon's signature or its tool, the other the dungeon's tool, an earlier tool, or a second entity kind (block,
  switch, wave, plate, mirror, bell, valve, flow).
- **Thresholds** (R14): beats ÷ counted rooms ≥ **1.6**; compound rooms ≥ **4**; exactly one flip that changes ≥ 2
  earlier rooms on the path back; the pre-boss room ≥ 3 action kinds. **d1** (the first dungeon) instead needs ≥ 11
  rooms, ≥ 12 beats and ≥ 2 compound rooms, plus its flip.

| Dungeon | Rooms (was) | Counted | Beats needed | Planned beats | Compound rooms (planned) | Flip changes (Q, P) | Depth step |
|---|---|---|---|---|---|---|---|
| d1 Under the Roots | 11 (9) | 8 | ≥ 12 | 14 | r2, r3, r7, r10, r11 | r2, r3 | S-060b |
| d2 Whistlehollow | 15 (12) | 13 | ≥ 21 | 32 | r5, r9, r10, r11, r13, r14, r15 | r10, r9 | S-104b |
| d3 Undertow Grotto | 16 (14) | 14 | ≥ 23 | 27 | r10, r11, r13, r15, r16, r3 | r10, r7 | S-125b |
| d4 The Granary Vaults | 15 (12) | 13 | ≥ 21 | 24 | r5, r6, r8, r9, r13, r14, r15 | r8, r6 | S-146b |
| d5 The Lamplighters' Tower | 13 (10) | 11 | ≥ 18 | 24 | r3, r7, r8, r9, r11, r12, r13 | r8, r7 | S-163b |
| d6 The Rootdeep Heart | 16 (14) | 14 | ≥ 23 | 25 | r3, r10, r11, r13, r15, r16 | r11, r10 | S-184b |
| d7 The Sunken Bell | 14 (11) | 12 | ≥ 20 | 23 | r6, r7, r8, r10, r12, r13, r14 | r7, r8 | S-210b |
| d8 The Kettle's Belly | 16 (13) | 14 | ≥ 23 | 27 | r7, r8, r10, r11, r14, r15, r16 | r8, r7 | S-230b |
| d9 The Buried Academy | 16 (14) | 14 | ≥ 23 | 26 | r5, r6, r9, r13, r15, r16 | r5, r6 | S-251b |
| d10 The Spiral Stair | 13 (10) | 11 | ≥ 18 | 21 | r5, r6, r7, r8, r11, r12, r13 | r7, r6 | S-270b |

"Planned beats" is this file's count by the rules above; the test's count is the one that must pass.

<a id="d1-depth"></a>
### 5A.3 d1 Under the Roots (S-060b)

**Annex `LA` "the Lamplighters' cellars"** (`at` [33,0], base 0 m; grid extent becomes 54 × 41 tiles, realm grid
124 m). Two dark rooms side by side, no door between them; each is reached by its own stair.

```map under_roots LA
#####################
#t...s...t#t...K...t#
#____=____#.........#
#.........#____=____#
#l.......l#l.......l#
#..e...e..#...b.....#
#....e....#......P..#
#^.......t#^.......t#
#####################
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r10 | The Wick Room | LA | [0, 0, 11, 9] | yes | 5 | `s`(5,1) flip · `=`(5,2) · `l`(1,4) `l`(9,4) · `e`(3,5) `e`(7,5) `e`(5,6) · `^`(1,7) |
| r11 | The Oil Cellar | LA | [10, 0, 11, 9] | yes | 5 | `K`(15,1) · `=`(15,3) · `l`(11,4) `l`(19,4) · `b`(14,5) · `P`(17,6) · `^`(11,7) |

- **r10 The Wick Room** (dark). Stair `^`(1,7) ↔ r4 (23,10), a root hatch that opens only in Lantern light
  (`lanternOnly`). Wave: Dimling ×3 (only hittable in lamplight). Kindle `r10:l1`, `r10:l2` and clear the wave: the
  hidden bridge (5,2) rises (`lit:[r10:l1,r10:l2] && clear`). Across it, the **Wick Wheel** `r10:s1` (5,1): the flip
  (`flag ur.wick`), line `dg.ur.flip` "Oil gurgles off through the old pipes, somewhere back the way you came."
  Beats 3 (kindle set, wave, flip); compound (Lantern + wave).
- **r11 The Oil Cellar** (dark). Stair `^`(11,7) ↔ r3 (2,12), a hatch that opens when r3's new lantern is lit. Push
  block `r11:b1` (14,5) east ×3, then south ×1 onto hold plate `r11:P1` (17,6); kindle `r11:l1`, `r11:l2`; the
  bridge (15,3) rises while the plate is held and both lanterns are lit, and stays once Pip is across. **Root Key**
  chest `K` (15,1) (moved here from r7). Beats 2; compound (block + Lantern).

**Tile edits to the §5 map** (`under_roots L1`): r4 (23,10) `.` → `^`; r3 (2,12) `.` → `^`; r3 (9,14) `.` → `l`
(new `r3:l1`); r7 (1,18) `K` → `.`; r7 (8,18) `.` → `P` (`r7:P1`); r7 (8,21) `.` → `b` (`r7:b1`). Update the room
table, the ledger (Root Key now in r11) and the solver notes to match.

**The flip** (`ur.wick`): **Q = r2** — the oil leaves the Drip Hall's lamps: `r2:l1` and `r2:l2` go out and the
glowbud door (10,12) closes until both are kindled again with the Lantern (beat 2 in r2, compound with the crystal
switch). **P = r3** — oil reaches the Rolled Tunnel's dry lamp: new wall-lantern `r3:l1` (9,14) can now be kindled
(before the flip: "The wick is dry."); lit, it opens the hatch (2,12) to r11.

**Synthesis in r7** (the room before the boss): push `r7:b1` (8,21) north ×3 onto `r7:P1` (8,18) (Pip pushes from
(8,22)); kindle the four Glow Pit lanterns (bridge); Dimlings in lamplight; the boss door `B` (2,24) needs `key:K`
(from r11) **and** `plate:r7:P1`.

**Path.** … r5 (Lantern) → r4 → hatch (23,10) → r10 (wave, kindle, Wick Wheel) → r4 → r2 (relight both lanterns) → r3
(kindle `r3:l1`) → hatch (2,12) → r11 (block, kindle, `K`) → r3 → r2 → glowbud (15,16) → r6 (wave, `k1`) → r7 (block,
kindle, bridge) → `B`.

<a id="d2-depth"></a>
### 5A.4 d2 Whistlehollow (S-104b)

**Annex `LA` "the Sap Galleries"** (`at` [34,20], base 10 m; inside the existing extent, realm grid unchanged). Three
rooms; the stair `^`(1,7) ↔ r11 (19,5).

```map whistlehollow LA
###############################
#t..___666#....e..9s#t......9s#
#.u.___666#.......99#.......99#
#...___666#..u...u..#......u..#
#...___666D642......D.........#
#.b.___666#.........#.........#
#.P.___666#..e.p.e..#..b..P...#
#^..___666#t.......t#t.......t#
###############################
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r13 | The Resin Run | LA | [0, 0, 11, 9] | - | 7 | `u`(2,2) · `b`(2,5) · `P`(2,6) · `^`(1,7) |
| r14 | The Wasp Knot | LA | [10, 0, 11, 9] | - | 7 | `e`(15,1) · `s`(19,1) · `u`(13,3) `u`(17,3) · `e`(13,6) `p`(15,6) `e`(17,6) |
| r15 | The Sap Valve | LA | [20, 0, 11, 9] | - | 7 | `s`(29,1) flip · `u`(27,3) · `b`(23,6) · `P`(26,6) |

- **r13 The Resin Run.** Push block `r13:b1` (2,5) south ×1 onto hold plate `r13:P1` (2,6) (Pip pushes from (2,4)):
  knot-hole `r13:u1` (2,2) blows while it is held. Ride it and glide east over the pit to the ledge (digit 6) and the
  door (10,4). Beats 2; compound (block + updraft + glide). Going back, glide west off the ledge.
- **r14 The Wasp Knot.** Steps 6-4-2 down from the door. Wave: Needle Wasp ×2 (13,6), (17,6), Bark Beetle ×1 (15,1).
  `r14:u1` (13,3) starts open, `r14:u2` (17,3) closed; toggle plate `r14:p1` (15,6) flips both. Ride `u2`, land on the
  perch (digit 9), hit switch `r14:s1` (19,1). Door (20,4): `clear && sw:r14:s1`. Beats 3; compound (wave + plate +
  updraft).
- **r15 The Sap Valve.** Push `r15:b1` (23,6) east ×3 onto hold plate `r15:P1` (26,6): `r15:u1` (27,3) blows. Ride it to
  the perch and hit **the Sap Valve** `r15:s1` (29,1): the flip (`wh.sap`), line `dg.wh.flip` "Sap creaks through the
  trunk. Down below, the knot-holes go quiet." Beats 3; compound (block + updraft).

**The flip** (`wh.sap`): **Q = r10** (Needle Loft) — both toggle plates become **hold plates**, both knot-holes close,
and a lump of hardened sap (push-block `r10:b1`) drops at (8,6). Coming in from the east door (10,4): push `r10:b1`
north ×1 onto `r10:p2` (8,5) → `u2` blows → ride to the perch → glide west over the pit → `^`(2,6). **P = r9** (Whistle
Stair) — a new knot-hole `r9:u2` (18,11) blows only after the flip; ride it to a new perch (17,9)-(18,9) and hit **the
Warden's latch** `r9:s1` (18,9). The latch also drains the sap: r10's plates go back to toggles at their start state
(`u1` closed, `u2` open) and the sap lump crumbles, so the way back east is the first visit's solution.

**Tile edits** (`whistlehollow L2`): r9 (17,9) `.` → `9`; r9 (18,9) `.` → `s`; r9 (18,11) `.` → `u`. (`whistlehollow
L3`): r11 (12,5) `.` → `p`; r11 (18,5) `.` → `u`; r11 (19,4) `.` → `9`; r11 (19,5) `.` → `^`; r11 (19,6) `.` → `9`.

**Synthesis in r11** (Bough Walk): `dark: true` (the Lantern lights it); its wave (Needle Wasp ×2, Pinecone Puff ×1)
becomes `clear` for `B`; toggle plate `r11:p1` (12,5) opens knot-hole `r11:u1` (18,5) (starts closed): ride it onto the
perch (19,4)-(19,6) where the annex stair (19,5) sits. `B` (15,8): `key:K && latch:r9:s1 && clear:r11`.

<a id="d3-depth"></a>
### 5A.5 d3 Undertow Grotto (S-125b)

**Annex** (`LA` `at` [43,0], `LB` `at` [43,10], base 0 m; extent 54 × 43, realm grid 124 m). New basin **D** (r15,
starts high, flipped by `r15:Q1`) and **E** (r16, starts low, flipped by `r16:o1`).

```map undertow LA
###########
#t.;;;;;.s#
#.Q;;;;;..#
#..,,,,,..#
#.b,,,,,.P#
#..,,,,,..#
#..;;;;;..#
#^.;;;;;.t#
###########
```

```map undertow LB
###########
#o..;;;.s.#
#...;;;...#
#,,,;;;,,,#
#e..;;;..e#
#...;;;...#
#...;;;...#
#^..;;;..t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r15 | The Sluice Hall | LA | [0, 0, 11, 9] | - | 5 | `s`(9,1) flip · `Q`(2,2) · `b`(2,4) · `P`(9,4) · `^`(1,7) |
| r16 | The Sluice-Keeper's Cell | LB | [0, 0, 11, 9] | - | 5 | `o`(1,1) · `s`(8,1) latch · `e`(1,4) `e`(9,4) · `^`(1,7) |

- **r15 The Sluice Hall** (basin D, starts high). Stair `^`(1,7) ↔ r13 (35,26). Ring `r15:Q1` (2,2) for low water; push
  `r15:b1` (2,4) east ×7 along the dry row 4 onto hold plate `r15:P1` (9,4): the wicket over **the Moon Sluice**
  `r15:s1` (9,1) opens while it is held. Hit it: the flip (`ug.sluice`), line `dg.ug.flip` "The sea pulls at the
  sluice. Two basins sigh and become one." Beats 3; compound (tide stone + block).
- **r16 The Sluice-Keeper's Cell** (basin E, starts low). Stair `^`(1,7) ↔ r7 (5,13). Squirt Urchin ×2 (1,4), (9,4)
  (turrets). Hit conch `r16:o1` (1,1) for high water, cross the rafts (cols 4-6), hit **the Warden's latch**
  `r16:s1` (8,1), whose shell cage opens on `clear`. Beats 3; compound (tide + wave).

**The flip** (`ug.sluice`): basins **B and C become one basin, BC** (state `tide:BC`, starting at C's level): every
conch in r5/r7 and every tide stone in r9/r11 flips r5, r6, r7, r9, r10 and r11 together. **Q = r10** (Pearl Hall) —
the surge washes `r10:b1` back to (23,18) and door (30,20) closes; it must be pushed again (E5, S2) at BC low.
**P = r7** (Drowned Stair) — its pool-floor hatch (5,13) unseals; it opens only at **low** water (the `,` floor is dry),
so Pip has to choose a BC level that gets him through r11, r10 (low), r9 and r7 (low) in one go, or re-flip on the way.

**Tile edits** (`undertow L1`): r13 (35,26) `.` → `^`; r7 (5,13) `,` → `^` (a hatch on a tide-floor tile: usable at
low water only); r13 (31,26) `.` → `Q` (`r13:Q1`).

**Synthesis in r13** (Gloop's Larder): new wave Sand Snapper ×2, Tidepool Jelly ×1 (`clear` for `B`); new tide stone
`r13:Q1` (31,26) works the larder hatch (35,26) (open at its "low", shut at "high"; the larder has no tide tiles); `B`
(30,28): `key:K && latch:r16:s1 && clear:r13`.

<a id="d4-depth"></a>
### 5A.6 d4 The Granary Vaults (S-146b)

**Annex** (`LA` `at` [39,0], `LB` `at` [39,10], base 0 m; extent 60 × 41, realm grid 136 m).

```map granary LA
#####################
#t..___..t#......66s#
#.y.___.b.#......66h#
#...___...#.........#
#..._G_.P.D.........#
#...___...#.e.....e.#
#...___...#.y.......#
#^..___..t#t.......t#
#####################
```

```map granary LB
###########
#t..__...t#
#.b.__..s.#
#...__....#
#.b.__....#
#...__....#
#.e.__..e.#
#^..__...t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r13 | The Thresher Loft | LA | [0, 0, 11, 9] | - | 5 | `y`(2,2) · `b`(8,2) · `G`(5,4) len 3, starts `NS` · `P`(8,4) · `^`(1,7) |
| r14 | The Brake Room | LA | [10, 0, 11, 9] | - | 7 | `s`(19,1) flip · `h`(19,2) · `e`(12,5) `e`(18,5) · `y`(12,6) |
| r15 | The Miller's Cupboard | LB | [0, 0, 11, 9] | - | 5 | `b`(2,2) `b`(2,4) · `s`(8,2) latch · `e`(2,6) `e`(8,6) · `^`(1,7) |

- **r13 The Thresher Loft.** Stair ↔ r9 (29,18). Crank `r13:y1` (2,2) turns `G1` to `EW`: the bridge spans row 4 (cols
  4-6). Across, push bale `r13:b1` (8,2) south ×2 onto hold plate `r13:P1` (8,4): door (10,4) opens while held. Beats 2;
  compound (gear + bale).
- **r14 The Brake Room** (ceiling 7). A sail hangs in front of the hookbloom `r14:h1` (19,2) on the loft (digit 6):
  turn crank `r14:y1` (12,6) to furl it (Scarecrowlet ×2 at (12,5), (18,5) fire straw darts), then hook `h1` onto the
  loft and pull **the Mill Brake** `r14:s1` (19,1): the flip (`gv.brake`), line `dg.gv.flip` "The brake lets go. Far
  off, the old gears start to turn by themselves." Beats 3; compound (crank + hook).
- **r15 The Miller's Cupboard.** Stair ↔ r6 (2,10). A 2-wide pit (cols 4-5). Push bale (2,4) east ×2 (it fills (4,4));
  push bale (2,2) south ×2 to (2,4), then east ×3 (it fills (5,4)); walk across; Field Vole gang ×2; hit **the
  Warden's latch** `r15:s1` (8,2). Beats 3; compound (pit fill + wave).

**The flip** (`gv.brake`): **Q = r8** (Sack Hall) — hookbloom `r8:h2` now rides the sack-line back and forth over the
pit (from (14,20) to (18,20) and back, 1 m/s): fire the Hook when it passes inside 14 m and 25° (a timed hook).
**P = r6** (Flour Loft) — `G1` (5,13) turns by itself, `NS` ↔ `EW` every 4 s; the crank `r6:y1` (8,10) now **freezes**
it for 10 s in its current position. Arriving from r7 (south), wait for `NS`, freeze it, cross to the north floor and
the unsealed stair (2,10).

**Tile edits** (`granary L1`): r9 (29,18) `6` → `^` (on the loft: reached with the Hook); r6 (2,10) `.` → `^`.

**Synthesis in r9** (Sail Room): the Scarecrowlet wave becomes `clear` for `B`; the loft (reached by hooking `h`
(28,17)) now holds the annex stair; a new hay bale `r9:b1` at (23,18) pushed south ×2 onto a new hold plate `r9:P1`
(23,20) is what lowers the loft's ladder-hook (the hookbloom is drawn up out of reach until then). `B` (25,24):
`key:K && latch:r15:s1 && clear:r9`. Extra edits: r9 (23,18) `.` → `b`; r9 (23,20) `.` → `P`.

<a id="d5-depth"></a>
### 5A.7 d5 The Lamplighters' Tower (S-163b)

**Annex** (`LA` `at` [51,14], base 20 m; `LB` `at` [51,24], base 15 m; extent stays 72 wide, rows 33; realm grid 160
m).

```map tower LA
#####################
#S...m...t#....R...t#
#.........#S...m....#
#.e.......#.........#
#........RD........s#
#.........#..e...e..#
#......e..#.........#
#^...R...t#l.......l#
#####################
```

```map tower LB
###########
#S.m.I...t#
#.......R.#
#.........#
#.........#
#..m....R.#
#.......s.#
#^.......t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r11 | The Lens Store | LA | [0, 0, 11, 9] | - | 5 | `S`(1,1) dir E · `m`(5,1) start `|` · `R`(9,4) · `R`(5,7) · `^`(1,7) |
| r12 | The Shutter Room | LA | [10, 0, 11, 9] | - | 5 | `R`(15,1) · `S`(11,2) dir E · `m`(15,2) start `-` · `s`(19,4) flip · `l`(11,7) `l`(19,7) |
| r13 | The Keeper's Cupboard | LB | [0, 0, 11, 9] | - | 5 | `S`(1,1) dir E · `m`(3,1) start `|` · `I`(5,1) · `R`(8,2) · `m`(3,5) start `-` · `R`(8,5) · `s`(8,6) latch · `^`(1,7) |

- **r11 The Lens Store.** Stair ↔ r9 (4,6). One hit turns `m1` (5,1) from `|` to `\`: the skylight beam turns south down
  column 5 into `R1` (5,7). Light `R2` (9,4) with Pip's own Sunglass. Door (10,4): `lit:[r11:R1,r11:R2]`. Beats 2;
  compound (mirror + Sunglass).
- **r12 The Shutter Room.** One hit turns `m1` (15,2) from `-` to `/`: the beam turns north into `R1` (15,1). Kindle
  `l1`, `l2` with the Lantern. The cage over **the Shutter Crank** `r12:s1` (19,4) opens on `lit:[R1] && lit:[l1,l2]`.
  Hit it: the flip (`tw.shutters`), line `dg.tw.flip` "Shutters bang shut a floor below. The skylight there goes
  dark." Beats 3; compound (mirror + Lantern).
- **r13 The Keeper's Cupboard.** Stair ↔ r7 (2,8). Turn `m1` (3,1) to `\` (one hit) and `m2` (3,5) to `\` (three
  hits): the beam goes down column 3 and east along row 5 into `R1` (8,5); light `R2` (8,2) with the Sunglass. The cage
  over **the Warden's latch** `r13:s1` (8,6) opens on both. Beats 4; compound (mirrors + Sunglass).

**The flip** (`tw.shutters`): **Q = r8** (Clockwork Room) — the clockwork stops: the cage over r8's stair `^`(18,9)
closes and opens only while `r8:R1` (11,1) is lit, which now needs Pip's Sunglass bounced off `/1` (12,1). **P = r7**
(Prism Hall) — F4's skylight shutters close, so `r7:S1` (9,2) goes dark: r7's receivers must be lit by Pip's own
beam through `\1` (4,2) and `m1` (1,5), from a new standing spot; the stair (2,8) unseals.

**Tile edits** (`tower F5`): r9 (4,6) `.` → `^`. (`tower F4`): r7 (2,8) `.` → `^`.

**Synthesis in r9** (Gallery Walk): the stair (4,6) is a hatch that opens on `lit:[r9:R1, r9:R2]` (its two existing
receivers, (1,1) and (9,1)) **and** a new wall-lantern `r9:l1` at (8,7) kindled with the Lantern; the heart container
`H` stays. `B` (10,5): `key:K && latch:r13:s1`. Extra edit: `tower F5` (8,7) `.` → `l`.

<a id="d6-depth"></a>
### 5A.8 d6 The Rootdeep Heart (S-184b)

**Annex** (`LA` `at` [43,0], `LB` `at` [43,10], base 0 m; extent 54 × 43, realm grid 124 m).

```map rootdeep_heart LA
###########
#t..____s.#
#...____..#
#...____dd#
#...jjjj..#
#...____..#
#...____..#
#^..____.t#
###########
```

```map rootdeep_heart LB
###########
#t._____s.#
#.._____..#
#.._____..#
#..jjdjj..#
#.._____..#
#.._____..#
#^._____.t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r15 | The Sap Cistern | LA | [0, 0, 11, 9] | - | 5 | `s`(8,1) flip · `d`(8,3) `d`(9,3) · `j`(4-7,4) · `^`(1,7) |
| r16 | The Root-Keeper's Nook | LB | [0, 0, 11, 9] | yes | 5 | `s`(8,1) latch · `j`(3-4,4) · `d`(5,4) · `j`(6-7,4) · `^`(1,7) |

- **r15 The Sap Cistern.** Stair ↔ r13 (35,26). Beam the light-root (4-7,4), cross within 20 s, dig one of the two
  mounds (8,3)/(9,3) to reach **the Sap Valve** `r15:s1` (8,1): the flip (`rh.sap`), line `dg.rh.flip` "The valve
  squeals shut. The roots nearby dim a little, as if holding their breath." Beats 3; compound (beam + dig).
- **r16 The Root-Keeper's Nook** (dark). Stair ↔ r10 (21,22). Beam root 1 (3-4,4); from its east end dig the mound
  (5,4) (1.0 s, inside the 20 s); stand on (5,4), beam root 2 (6-7,4), cross, hit **the Warden's latch** `r16:s1`
  (8,1). Beats 4; compound (beam + dig, timed).

**The flip** (`rh.sap`): **Q = r11** (Knot Hall) — the soft earth at the south door (35,23) regrows (dig again) and
r11's light-root lasts 8 s instead of 20. **P = r10** (Lumen Pit) — its light-root (24-26,20) lasts **8 s** and the
mound (23,20) regrows: coming from the east door, beam the root, run west, dig (23,20) from the root's west end before
it sinks (8 s: 3 tiles ≈ 1.5 s, dig 1.0 s), reach the unsealed stair (21,22).

**Tile edits** (`rootdeep_heart L1`): r13 (35,26) `.` → `^`; r10 (21,22) `.` → `^`.

**Synthesis in r13** (Lumbra's Larder): `dark: true`; new wave Glow Grub ×2, Dimling ×1 (`clear` for `B`); the stair
(35,26) is under roots that part when the new light-root run `r13:j1` (35,27)-(35,28) is beamed (it grows up into a
ramp for 20 s). `B` (30,28): `key:K && latch:r16:s1 && clear:r13`. Extra edits: (35,27) `.` → `j`; (35,28) `.` → `j`.

<a id="d7-depth"></a>
### 5A.9 d7 The Sunken Bell (S-210b)

**Annex** (`LA` `at` [33,0], `LB` `at` [33,10], base 0 m; extent 54 × 41, realm grid 124 m).

```map sunken_bell LA
#####################
#t.x.Y.z.t#........s#
#.........#.x.......#
#....p....#.........#
#.........T........z#
#.........#..e...e..#
#.........#.....Y...#
#^.......t#t.......t#
#####################
```

```map sunken_bell LB
###########
#t......s.#
#......f..#
#.........#
#..e...e..#
#.........#
#.xf......#
#^.......t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r12 | The Carillon Loft | LA | [0, 0, 11, 9] | - | 7 | `x`(3,1) `Y`(5,1) `z`(7,1) · `p`(5,3) · `T`(10,4) · `^`(1,7) |
| r13 | The Bell-Rope Room | LA | [10, 0, 11, 9] | - | 7 | `s`(19,1) flip · `x`(12,2) · `z`(19,4) · `e`(13,5) `e`(17,5) · `Y`(16,6) |
| r14 | The Bellringer's Closet | LB | [0, 0, 11, 9] | - | 5 | `s`(8,1) latch · `f`(7,2) · `e`(3,4) `e`(7,4) · `x`(2,6) · `f`(3,6) · `^`(1,7) |

- **r12 The Carillon Loft.** Stair ↔ r10 (4,26). Step on plate `r12:p1` (5,3): the three bells ring by themselves,
  **high, low, mid** (Tune E, heard here). Song door `T` (10,4) opens to Tune E on the Starsong or on the bells. Beats
  2; compound (plate + song door).
- **r13 The Bell-Rope Room.** Gull wave ×2 (`clear`). The cage over **the Bell Rope** `r13:s1` (19,1) opens when `x`
  (12,2), `Y` (16,6), `z` (19,4) are rung low, mid, high within 3 s (*Dawn*: the bells are too far apart to run, so
  play it on the Starsong or ring one and play two). Pull it: the flip (`sb.rope`), line `dg.sb.flip` "The great rope
  jerks. Every bell in the chapel below rings a wrong note." Beats 3; compound (bells + Starsong + wave).
- **r14 The Bellringer's Closet.** Stair ↔ r8 (18,18). The cage over **the Warden's latch** `r14:s1` (8,1) only listens
  to the speaking tube: ring `x` (2,6) beside tube mouth `f1` (3,6); the low note comes out of `f2` (7,2) beside the
  cage (tube delay 0.5 s). Starsong notes played at the cage do nothing ("It only hears the tube."). Beats 2 + wave 1;
  compound (bell + tube).

**The flip** (`sb.rope`): **Q = r7** (Starsong Chapel) and **P = r8** (Vestry) — every bell in r7 and r8 swaps low ↔
high (`x` rings high, `z` rings low; colours swap with them), and the song door `T` (10,20) between them relocks and now
wants **Tune E** (heard in r12). The unsealed stair is r8 (18,18).

**Tile edits** (`sunken_bell L1`): r10 (4,26) `.` → `^`; r8 (18,18) `.` → `^`.

**Synthesis in r10** (Bell Pit): the stair (4,26) is a hatch that opens to a **mid** note rung within 6 tiles by a
bell or the tube (not the Starsong: "The hatch is deaf to songs."), so Pip rings the mid bell placed at (2,30) (edit
(2,30) `.` → `Y`); the two-enemy wave becomes `clear` for `B`; `B` (10,28): `key:K && latch:r14:s1 && clear:r10`.

<a id="d8-depth"></a>
### 5A.10 d8 The Kettle's Belly (S-230b)

**Annex** (`LA` `at` [43,0], `LB` `at` [43,10], base 0 m; extent 64 × 41, realm grid 144 m). Platform heights `lo →
hi`: r14 `z` pit → 0; r15 `z` 0 → 9; r16 `z` 0 → 9.

```map kettle_belly LA
#####################
#t..___..a#......99s#
#.v.___...#......99v#
#...___...#......z..#
#...zzz...D.........#
#...___...#..e...e..#
#...___...#.........#
#^..___..t#t.......t#
#####################
```

```map kettle_belly LB
###########
#a.....99s#
#.....z999#
#.........#
#.........#
#..e...e..#
#.v.......#
#^.......t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r14 | The Whistle Room | LA | [0, 0, 11, 9] | - | 5 | `a`(9,1) high · `v`(2,2) · `z`(4-6,4) · `^`(1,7) |
| r15 | The Pressure Cock | LA | [10, 0, 11, 9] | - | 7 | `s`(19,1) flip · `v`(19,2) on the ledge · `z`(17,3) · `e`(13,5) `e`(17,5) |
| r16 | The Gauge Cupboard | LB | [0, 0, 11, 9] | - | 7 | `a`(1,1) high · `s`(9,1) latch · `z`(6,2) · `e`(3,5) `e`(7,5) · `v`(2,6) · `^`(1,7) |

- **r14 The Whistle Room.** Stair ↔ r10 (12,18). Turn `v1` (2,2): 2.0 s later the three platforms rise out of the pit
  into a bridge; cross; fling an ember at the high brazier `a1` (9,1): door (10,4) opens (`lit:[r14:a1]`). Beats 3;
  compound (valve + Sling).
- **r15 The Pressure Cock** (ceiling 7). The valve `v1` (19,2) is on the ledge: stand on platform `z1` (17,3) and fling
  an ember at it; 2.0 s later the platform lifts Pip to the ledge (digit 9); turn **the Pressure Cock** `r15:s1` (19,1):
  the flip (`kb.cock`), line `dg.kb.flip` "Pipes knock all through the Belly. Somewhere the steam runs slower now."
  Steam Puff ×2. Beats 3; compound (valve at range + platform).
- **r16 The Gauge Cupboard** (ceiling 7). Stair ↔ r7 (18,9). Light the high brazier `a1` (1,1) with an ember (the cage
  over the latch opens on it); stand on `z1` (6,2), fling an ember at `v1` (2,6), ride up to the ledge and hit **the
  Warden's latch** `r16:s1` (9,1). Beats 4; compound (Sling + valve + platform).

**The flip** (`kb.cock`): **Q = r8** (Wax Works) and **P = r7** (Steam Lift) — every valve in r7 and r8 waits **4.0 s**
instead of 2.0 s, and each platform's rest and raised heights swap (`lo ↔ hi`). r8's raised platform now rests high,
so the old walk-on needs a valve turn first; in r7 the platforms start high and the ledge stair (18,9) is reached by
riding `z` down and back up with the slower valve, using an ember to turn it from the platform.

**Tile edits** (`kettle_belly L1`): r10 (12,18) `.` → `^`; r7 (18,9) `9` → `^` (on the ledge).

**Synthesis in r10** (Boiler Room): the stair (12,18) is a hatch that opens on `lit:[r10:a1]`, a new **high** brazier at
(18,18) (edit `.` → `a`) that only an ember reaches; a new valve `r10:v1` at (14,22) (edit `.` → `v`) raises the
boiler's three pillars' steam caps so the brazier is in line of sight (it is hidden behind steam until then); the wave
becomes `clear` for `B`. `B` (15,24): `key:K && latch:r16:s1 && clear:r10`.

<a id="d9-depth"></a>
### 5A.11 d9 The Buried Academy (S-251b)

**Annex** (`LA` `at` [43,0], `LB` `at` [43,10], base 0 m; extent 54 × 43, realm grid 124 m).

```map buried_academy LA
###########
#t....i99s#
#......999#
#.........#
#.b>>>>>P.#
#..e...e..#
#.........#
#^.......t#
###########
```

```map buried_academy LB
###########
#t........#
#.b}......#
#..}......#
#..}......#
#..>>>>>P.#
#.......s.#
#^.......t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r15 | The Pump Gallery | LA | [0, 0, 11, 9] | - | 7 | `i`(6,1) · `s`(9,1) flip · `b`(2,4) · `>`(3-7,4) · `P`(8,4) · `^`(1,7) |
| r16 | The Head Prefect's Study | LB | [0, 0, 11, 9] | - | 5 | `b`(2,2) · `}`(3,2)-(3,4) · `>`(3-7,5) · `P`(8,5) · `s`(8,6) latch · `^`(1,7) |

- **r15 The Pump Gallery.** Stair ↔ r13 (35,26). Push block `r15:b1` (2,4) east onto the flow: it rides to hold plate
  `r15:P1` (8,4). While it is held, the cage at the foot of the ivy `i` (6,1) is open: climb onto the ledge (digit 9)
  and pull **the Sand Pump** `r15:s1` (9,1): the flip (`ba.pump`), line `dg.ba.flip` "The pump groans. Through the
  walls, the sand changes its mind." Sandsnoot ×2. Beats 3; compound (flow + block + Gloves).
- **r16 The Head Prefect's Study.** Stair ↔ r6 (27,14). Push block `r16:b1` (2,2) east onto the south flow at (3,2): it
  rides south, then east along row 5 onto hold plate `r16:P1` (8,5). The cage over **the Warden's latch** `r16:s1`
  (8,6) opens while the plate is held and the Dust Puff ×2 wave is clear. Beats 3; compound (flow + block + wave).

**The flip** (`ba.pump`): **Q = r5** (Lecture Hall) and **P = r6** (Sand Pump Room) — every sand-flow tile in r5 and r6
reverses (`<` ↔ `>`, `{` ↔ `}`). In r5 the lane crossing that drifted Pip west now drifts him east, so the nameplate
door `N` (30,10) is reached from a different starting column; in r6 the block `r6:b1` rides the reversed row-12 flow
the other way, off its plate `P` (21,12), so it must be pushed round to come back onto it, and the stair (27,14)
unseals.

**Tile edits** (`buried_academy L1`): r13 (35,26) `.` → `^`; r6 (27,14) `.` → `^`.

**Synthesis in r13** (Bell-Weight Hall): the stair (35,26) sits on a small gallery (digit 9 at (34,26), (35,26),
(36,26)) reached by a new ivy face `i` at (35,27); the cage at the ivy's foot opens while new block `r13:b1` (32,30),
pushed east onto a new east flow (33,30)-(36,30), rides onto new hold plate `r13:P1` (37,30) (the gem chest `c` (38,30)
stays). Edits (`buried_academy L1`): (34,26) and (36,26) `.` → `9`; (35,27) `.` → `i`; (32,30) `.` → `b`; (33,30)-(36,30)
`.` → `>`; (37,30) `.` → `P`. The Sandsnoot wave becomes `clear` for `B`. `B` (30,28): `key:K && latch:r16:s1 &&
clear:r13`.

<a id="d10-depth"></a>
### 5A.12 d10 The Spiral Stair (S-270b)

**Annex** (`LA` `at` [33,0], `LB` `at` [33,10], base 0 m; extent 54 × 49, realm grid 124 m). Digits are heights as in
§5 (`4` = 1.2 m, `8` = 2.4 m).

```map spiral_stair LA
#####################
#t..___444#44_____4s#
#...___444#44_____44#
#...___444#44_____44#
#...EEn444D44FFnJJ44#
#...___444#44_____44#
#...___444#44_____44#
#^..___444#44_____44#
#####################
```

```map spiral_stair LB
###########
#t.____88s#
#..____888#
#..____888#
#..___n888#
#..JJJ_...#
#..____...#
#^.____..t#
###########
```

| Room | Name | Level | Box | Dark | Ceil m | Special tiles |
|---|---|---|---|---|---|---|
| r11 | The Wind Loft | LA | [0, 0, 11, 9] | - | 7 | `E`(4-5,4) · `n`(6,4) · `^`(1,7) |
| r12 | The Weathervane | LA | [10, 0, 11, 9] | - | 7 | `s`(19,1) flip · `F`(13-14,4) · `n`(15,4) · `J`(16-17,4) |
| r13 | The Kite Closet | LB | [0, 0, 11, 9] | - | 7 | `s`(9,1) latch · `n`(6,4) · `J`(3-5,5) · `^`(1,7) |

- **r11 The Wind Loft.** Stair ↔ r8 (12,22). Play **low**: the rose clouds (4-5,4) are solid for 8 s; walk out, hop
  off the mote (6,4) with Cloudstep up onto the ledge (digit 4) and the door (10,4). Beats 2; compound (Starsong +
  Cloudstep).
- **r12 The Weathervane.** Play **mid** and **high**: the gold (13-14,4) and sky (16-17,4) clouds are solid together for
  8 s (the mote (15,4) is the stepping place between them); cross and turn **the Weathervane** `r12:s1` (19,1): the flip
  (`ss.vane`), line `dg.ss.flip` "The vane swings round. Below, the little clouds start to drift." Beats 3; compound
  (two notes + mote).
- **r13 The Kite Closet.** Stair ↔ r6 (2,10). Play **high**: walk the sky clouds (3-5,5), hop and Cloudstep off the
  mote (6,4) up onto the ledge (digit 8) and hit **the Warden's latch** `r13:s1` (9,1). Beats 3; compound (note +
  Cloudstep).

**The flip** (`ss.vane`): **Q = r7** (Mote Garden) and **P = r6** (Cloudstep Loft) — every cloud mote in r7 and r6
drifts on a 2-tile track (east 2 tiles, back, 1 tile/s), so each Cloudstep hop is timed to the mote's pass; r6's stair
(2,10) on the north side unseals, reached from the south across the pit by the drifting mote (5,13).

**Tile edits** (`spiral_stair L1`): r8 (12,22) `.` → `^`; r6 (2,10) `.` → `^`.

**Synthesis in r8** (High Meadow Hall): the stair (12,22) is a hatch that opens on a **mid** note while Pip stands on
the gold clouds (12-14,17) (so the note also holds his footing); the Root Key ledge (digit 4) keeps its mote hop; the
wave becomes `clear` for `B`. `B` (15,24): `key:K && latch:r13:s1 && clear:r8`.

<a id="depth-test"></a>
### 5A.13 The depth test

`tests/dungeon-depth.test.js` (added by S-060b, extended by each depth step): for each dungeon whose realm data exists,
run the solver's intended solution (the replay already used by `every chest`) and report a row per room: beats by kind,
compound yes/no, revisit beats; then the dungeon row: counted rooms, beats, beats per counted room, compound rooms,
flip rooms changed (from the entity tables), pre-boss action kinds. It **fails** below the §5A.2 thresholds, names the
dungeon and the rule, and prints the table so the PR can paste it. Dungeons whose depth step has not landed are reported
as `pending` and not failed.

---

## 6. Optional dungeons

<a id="o1"></a>
### o1 The Snowglobe

| Field | Value |
|---|---|
| Realm id / file | `snowglobe` · `js/realms/dungeons/snowglobe.js` |
| Where | under Frostcap Peaks, home, behind the ice wall (post-pass `placeGates`, [atlas-home.md](./atlas-home.md#bell-targets)) |
| Opens | melt the ice wall with the Ember Sling (from S-227); side story 12 *Frostbun's Great-Aunt* ([side-content.md](./side-content.md#ss-12)) |
| Needs on entry | Ember Sling, Glowbud Lantern |
| Rooms · hours | 10 · 1.25 h |
| Signature mechanic | push-ice: one push sends an ice block sliding until it hits something; it stops on a hold plate and **fills a pit** it slides into; the Sling melts ice walls |
| Reward | a **heart petal** (`+` in r10, after Flurry) and Flurry's scarf (hood trim, via ss-12) |
| Boss | **Great-Aunt Flurry** (optional) in r10 ([creatures.md](./creatures.md#boss-flurry)) |
| Grid | 31 × 41 tiles; realm grid 98 m |
| Palette | stone (packed snow) `#cfeaf7`, trim (glass rim) `#e9f6ff`, accent `#9fdcff`, shadow `#5a7fa6`, white `#ffffff`, dark tint `#2c4560` |
| Light / music | ambient 0.75, snow falls upward inside (it is a snowglobe: particles drift up and settle on the ceiling, cards) · track `snowglobe` (celesta and sleigh-bell shakes, 66 bpm, a music-box wind-down at the end of each loop) |
| Enemies | Snowpuff ×8, Dozy Bat ×2 |
| Chests | 2 gem · map · Chime Stone · Root Key |
| Keys | 1 small, 1 big |

**Legend extension:** `Z` push-ice · `A` ice wall (a door glyph here; one ember melts it for good) · `a` brazier
(decor, lights the room). Push-ice slides one push until it hits a wall, pillar, block, chest, closed door or another
`Z`; it stops **on** a `P`; sliding over a `_` it drops in and the tile becomes ice floor for good (the reset lever
lifts it back out).

```map snowglobe L1
###############################
#t.......t#t.......t#t.......&#
#.........#..Z......#..e...e..#
#..?......#.........#.........#
X@........O.........D.........#
#.I.....I.#.........#....e....#
#.........#..P......#.........#
#t.......t#t.....r.t#t.......c#
#########################A#####
#t.......t#%.__....t#t.......t#
#.a.....a.#..__..Z..#..Z...Z.I#
#..e...e..#..__.....#.........#
#.........L..__..Z..D.........#
#.........#..__..I..#.........#
#....e....#..__.....#..P....P.#
#t.......t#t.__..r.t#t...r...k#
#####A#########################
#t.......t#t.......t#t...K...t#
#.Z.......#.........#.........#
#.........#...III...#..e...e..#
#.......P.D...III...A.........#
#.I.......#...III...#.........#
#.........#.e.....e.#.........#
#t...r...t#t.......t#t.......c#
###############B###############
#t.................t#
#...................#
#...................#
#...................#
#...................#
#.........M.........#
#...................#
#...................#
#...................#
#...................#
#...................#
#...................#
#...................#
#.........+.........#
#t.................t#
##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Frost Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Slide Hall | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `t`(19,1) `Z`(13,2) `P`(13,6) `t`(11,7) `r`(17,7) `t`(19,7) |
| r3 | The Icicle Gallery | L1 | [20, 0, 11, 9] | - | 5 | `t`(21,1) `&`(29,1) `e`(23,2) `e`(27,2) `e`(25,5) `t`(21,7) `c`(29,7) |
| r6 | The Brazier Nook | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `a`(2,10) `a`(8,10) `e`(3,11) `e`(7,11) `e`(5,14) `t`(1,15) `t`(9,15) |
| r5 | The Frozen Pond | L1 | [10, 8, 11, 9] | - | 5 | `%`(11,9) `t`(19,9) `Z`(17,10) `Z`(17,12) `I`(17,13) `t`(11,15) `r`(17,15) `t`(19,15) |
| r4 | The Twin Slides | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `t`(29,9) `Z`(23,10) `Z`(27,10) `I`(29,10) `P`(23,14) `P`(28,14) `t`(21,15) `r`(25,15) `k`(29,15) |
| r7 | The Snow Cradle Room | L1 | [0, 16, 11, 9] | - | 5 | `t`(1,17) `t`(9,17) `Z`(2,18) `P`(8,20) `I`(2,21) `t`(1,23) `r`(5,23) `t`(9,23) |
| r8 | The Knitting Room | L1 | [10, 16, 11, 9] | - | 5 | `t`(11,17) `t`(19,17) `I`(14,19) `I`(15,19) `I`(16,19) `I`(14,20) `I`(15,20) `I`(16,20) `I`(14,21) `I`(15,21) `I`(16,21) `e`(12,22) `e`(18,22) `t`(11,23) `t`(19,23) |
| r9 | The Mitten Store | L1 | [20, 16, 11, 9] | - | 5 | `t`(21,17) `K`(25,17) `t`(29,17) `e`(23,19) `e`(27,19) `t`(21,23) `c`(29,23) |
| r10 | Great-Aunt Flurry's Hollow | L1 | [0, 24, 21, 17] | - | 12 | `t`(1,25) `t`(19,25) `M`(10,30) `+`(10,38) `t`(1,39) `t`(19,39) |

**Room by room.** r1 The Frost Door: `X` (0,4); sign `?`(3,3) "Snowglobe. Please shake gently. — F." (Frostbun's
squiggly paw letters). r2 The Slide Hall: push `Z` (13,2) south from (13,1): it stops on `P` (13,6); door (20,4) opens
(`plate`); lever (17,7). r3 The Icicle Gallery: wave Snowpuff ×3 at (23,2), (27,2), (25,5); map `&` (29,1); gem chest
`r3:c1` (29,7); ice wall (25,8) south. r4 The Twin Slides: `Z1` (23,10) south onto `P1` (23,14); `Z2` (27,10) east (it
stops against pillar (29,10) at (28,10)), then south onto `P2` (28,14); door (20,12) opens while both are held; small
key `r4:k1` (29,15); lever (25,15). r5 The Frozen Pond: push `Z1` (17,12) west: it drops into (14,12) and fills it;
push `Z2` (17,10) south (it stops on pillar (17,13) at (17,12)), then west: over the filled tile into (13,12); walk the
ice path to Chime Stone `%` (11,9); locked door (10,12); lever (17,15). r6 The Brazier Nook: two braziers (decor) and wave
Snowpuff ×3 at (3,11), (7,11), (5,14); ice wall (5,16). r7 The Snow Cradle Room: a giant snow cradle (decor; Frostbun
slept in it as a kit); `Z` (2,18) south (stops on pillar (2,21) at (2,20)), then east onto `P` (8,20): door (10,20)
opens; lever (5,23). r8 The Knitting Room: a 6 m ball of sky-blue yarn (the pillars) with two knitting needles; wave
Dozy Bat ×2 at (12,22), (18,22); ice wall (20,20) east; boss door (15,24) south. r9 The Mitten Store: hundreds of
tiny mittens on strings; Root Key chest `K` (25,17); wave Snowpuff ×2; gem chest `r9:c2` (29,23). r10 Great-Aunt
Flurry's Hollow (ceiling 12): arena 19 × 15 tiles, boss spawn `M` (10,30) asleep under a quilt; after the fight the
heart petal `+` (10,38) rises on a snow pedestal; `X` (10,40) to Frostcap.

**Ledger.** `r4:k1` → L (10,12); `K` → B (15,24). Gem chests `r3:c1`, `r9:c2` = 80 gems. Petal 1 (`collect.petal
'snowglobe:1'`).

**Solver notes.** r1 → r2 (Z S) → r3 (`&`, `c1`, melt) → r4 (Z1 S; Z2 E, S; `k1`) → r5 (Z1 W; Z2 S, W; `%`) → unlock →
r6 (melt) → r7 (Z S, E) → r8 (melt) → r9 (`K`, `c2`) → r8 → B → r10. The solver models sliding blocks and pit filling.

**Hints.** 1. "Ice doesn't stop till it bumps into something." / "Push the ice block and it slides all the way. Find
the pillar or plate that will stop it where you need it." 2. "Pits don't mind a bit of ice." / "In the Frozen Pond,
slide both ice blocks into the same row of the pit to make a path." 3. "Ice walls hate embers." / "Fling an ember at
the blue ice wall to melt it."

**Step split.** S-238 builds all ten rooms (push-ice with pit fill, ice walls as doors), prints, realm-suite entry.
S-239 puts Flurry in r10 with the petal and ss-12.

**Art (o1).** `tex_snowglobe` (`realm: home`): "<style line> Seamless texture of soft packed snow walls with a faint
glassy shine and tiny frost sparkles, tileable" (make_seamless 1024/512; fallback `#cfeaf7` noise). `int_push_ice`:
code-built 1.9 m rounded ice cube, `#9fdcff` 70 % opacity with a white frosted rim, a snowflake etched inside (tris
120; fallback kit block tinted). `int_ice_wall`: code-built 2 × 3 m glassy slab with frosted edges; melts in 1.2 s
into a puddle decal (fallback blue box). `int_yarn_ball`: code-built 6 m sky-blue ball of yarn with two wooden needles
(tris 900; fallback blue sphere). ART BRIEF `int_yarn_ball`: silhouette a giant soft ball of wool with loose loops and
two crossed knitting needles; size 6 m; palette `#8fd3ff`, `#5a7fa6`, needles `#c9a46b`; materials fuzzy matte; tris
2,000 painted; pose static, a loose strand sways. Image prompt: "<style line> A giant ball of sky-blue knitting wool
with two wooden needles in a snowy cosy cave, tiny mittens hanging on strings." 3D prompt: "Stylised low-poly giant
yarn ball with loose loops and two knitting needles, hand-painted, game-ready, under 2,000 triangles, 6 m."

---
<a id="o2"></a>
### o2 Grumble's Undercap

| Field | Value |
|---|---|
| Realm id / file | `undercap` · `js/realms/dungeons/undercap.js` |
| Where | under Grumble's Crown, Whispering Woods, home; the entrance is a soft-earth mound between the mushroom's roots (post-pass `placeGates`, [atlas-home.md](./atlas-home.md#dig-spots)) |
| Opens | dig the mound with the Digging Paws (S-181); side story 11 *Grumble's Nephews* ([side-content.md](./side-content.md#ss-11)) |
| Needs on entry | Glowbud Lantern, Digging Paws, Shiny Sword (thornvine) |
| Rooms · hours | 8 · 0.75 h |
| Signature mechanic | Lantern + Paws: dark halls, glowbud doors, digging, and a tiny shroomlet town whose eight night-lights Pip kindles |
| Reward | **Spore Rally** unlocked with Grumble Shroom ([side-content.md](./side-content.md#act-spore-rally)); the shroomlet town lit for good |
| Boss | none |
| Grid | 41 × 19 tiles; realm grid 98 m |
| Palette | stone (cap underside gills) `#4b2f5c`, trim `#7b5a3a`, accent (gold spots) `#e8b84a`, glow `#b6f0a0`, dark tint `#1f1428` |
| Light / music | ambient 0.45 (r3, r4, r6 dark), gills on the ceiling glow faintly · track `undercap` (pizzicato bassoon and woodblocks, Grumble's theme played small, 90 bpm) |
| Enemies | Dimling ×2, Dozy Bat ×2 (none in r6: Shroomlet Town is a town) |
| Chests | 2 gem · map |
| Keys | 1 small (buried) |

**Legend extension:** `g` glowbud door · `l` wall-lantern / night-light · `d` soft earth · `V` thornvine (door glyph
here: three sword hits).

```map undercap L1
#########################################
#t.......t#t...#...t#l.......l#l.......l#
#.........#....#...&#..e...e..#.........#
#..?......#....d....#.........#..I...I..#
X@........O....d....D.........V.........#
#.I.....I.#....d....#.........#..I...I..#
#.........#....#....#.........#.........#
#t.......t#t...#...t#l.......l#l.......l#
###################################g#####
#t.......t#t.......t#l.l...l.l#t.......t#
#...111...#.........#.........#.........#
#...1I1...#..e...e..#.I.....I.#..d...d..#
#...111...g.........D.........L.........#
#.........#.........#....?....#..d...d..#
#.?.......#........d#.........#.........#
#c.......t#t......dc#.I.....I.#t.......t#
#####################.........###########
                    #l.l...l.l#
                    ###########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Cap Door | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Root Tunnel | L1 | [10, 0, 11, 9] | - | 5 | `t`(11,1) `t`(19,1) `&`(19,2) `d`(15,3) `d`(15,4) `d`(15,5) `t`(11,7) `t`(19,7) |
| r3 | The Spore Hall | L1 | [20, 0, 11, 9] | yes | 5 | `l`(21,1) `l`(29,1) `e`(23,2) `e`(27,2) `l`(21,7) `l`(29,7) |
| r4 | Lantern Lane | L1 | [30, 0, 11, 9] | yes | 5 | `l`(31,1) `l`(39,1) `I`(33,3) `I`(37,3) `I`(33,5) `I`(37,5) `l`(31,7) `l`(39,7) |
| r8 | The Cap Chamber | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `I`(5,11) `?`(2,14) `c`(1,15) `t`(9,15) |
| r7 | The Mushroom Cellar | L1 | [10, 8, 11, 9] | - | 5 | `t`(11,9) `t`(19,9) `e`(13,11) `e`(17,11) `d`(19,14) `t`(11,15) `d`(18,15) `c`(19,15) |
| r6 | Shroomlet Town | L1 | [20, 8, 11, 11] | yes | 5 | `l`(21,9) `l`(23,9) `l`(27,9) `l`(29,9) `I`(22,11) `I`(28,11) `?`(25,13) `I`(22,15) `I`(28,15) `l`(21,17) `l`(23,17) `l`(27,17) `l`(29,17) |
| r5 | The Mossy Steps | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `t`(39,9) `d`(33,11) `d`(37,11) `d`(33,13) `d`(37,13) `t`(31,15) `t`(39,15) |

**Room by room.** r1 The Cap Door: `X` (0,4) up through the mound; sign `?`(3,3) "UNDERCAP. Mind the little ones. And
the gills. And your head. — G." r2 The Root Tunnel: an inner root wall (col 15) with three soft-earth mounds (15,3)-(15,5):
dig one; map `&` (19,2); door (20,4) `always`. r3 The Spore Hall (dark): wave Dimling ×2 at (23,2), (27,2); thornvine
door (30,4): three swings. r4 Lantern Lane (dark): Kindle the four lanterns (31,1), (39,1), (31,7), (39,7): glowbud door
(35,8) opens (`lit`). r5 The Mossy Steps: four mounds; the one at (33,11) sparkles twice as much and holds small key
`r5:k1` (the others hold a glowcap each, worth nothing but a smile: "A glowcap. It wiggles."); locked door (30,12).
r6 **Shroomlet Town** (dark, a town: no enemies): four little mushroom houses (pillars) and eight unlit night-lights
`r6:l1-l8` at (21,9), (23,9), (27,9), (29,9), (21,17), (23,17), (27,17), (29,17); Grumble's shroomlet nephews (NPCs,
[cast.md](./cast.md)) peek out of the houses. Sign `?`(25,13): "SHROOMLET TOWN. Lights out at eight. (They went out at
eight and stayed out.)" Kindle all eight: the town glows `#b6f0a0` for good, the nephews come out (ss-11 step; flag
`undercapLit`), and the three night-lights by the Hollow sign on the surface (placeReasons) light too. Door (20,12)
`always`. r7 The Mushroom Cellar: wave Dozy Bat ×2 at (13,11), (17,11); gem chest `r7:c1` (19,15) walled by mounds
(18,15) and (19,14); glowbud door (10,12) `lanternOnly`. r8 The Cap Chamber: Grumble's old throne (a toadstool on a
dais); the Spore Rally board `?`(2,14) ("SPORE RALLY. Bonk the spores back. Best: 0. Grumble says beat that.");
gem chest `r8:c2` (1,15).

**Ledger.** `r5:k1` (buried) → L (30,12). Gem chests `r7:c1`, `r8:c2` = 80 gems. No boss, no Root Key.

**Solver notes.** r1 → r2 (dig, `&`) → r3 (clear optional; cut thornvine) → r4 (Kindle ×4) → r5 (dig (33,11), `k1`) →
unlock → r6 (Kindle ×8) → r7 (dig, `c1`) → r8 (`c2`). Leaving: back through r6-r1.

**Hints.** 1. "Bramble in a doorway: a job for a sword." / "Swing at the purple thornvine three times." 2. "One mound
sparkles more than the others." / "Dig the mound in the Mossy Steps that sparkles the most. The key is in it."
3. "Little houses, little lights." / "Kindle all eight night-lights in Shroomlet Town with the Lantern."

**Step split.** S-194 builds all eight rooms (entrance post-pass on home, prints, realm-suite entry). S-195 adds the
shroomlet NPCs, the town-lit state, the surface night-lights and the Spore Rally unlock.

**Art (o2).** `tex_gills` (`realm: home`): "<style line> Seamless texture of the soft underside of a giant purple
mushroom cap, gentle gill ridges in plum and lilac with tiny gold spores, tileable" (make_seamless 1024/512; fallback
`#4b2f5c` stripes). `int_shroom_house`: code-built 1.6 m mushroom house, cap `#c2563f` with cream spots, a round door,
a tiny window that glows when lit (tris 300; fallback a mushroom from `props.js` scaled). `int_night_light`: code-built
0.5 m acorn-cap lantern on a twig post, unlit grey, lit `#b6f0a0` (tris 60). ART BRIEF `int_shroom_house`: silhouette a
plump red-capped mushroom with a round door and a crooked chimney; size 1.6 m tall; palette cap `#c2563f`, spots
`#f4e3c8`, stem `#f1e6d0`, door `#7b5a3a`; materials soft matte; tris 900 painted; pose static, the window glows when
the town is lit. Image prompt: "<style line> A tiny mushroom-house village under a giant purple mushroom, little round
doors and glowing night-lights, very small and cosy." 3D prompt: "Stylised low-poly mushroom house with a red spotted
cap, round door and crooked chimney, hand-painted, game-ready, under 900 triangles, 1.6 m tall."

---
<a id="o3"></a>
### o3 The Merry Mabel

| Field | Value |
|---|---|
| Realm id / file | `merry_mabel` · `js/realms/dungeons/merry_mabel.js` |
| Where | the wreck of the *Merry Mabel* in Wreck Reach, the Glassway; the gangway is reached from its islet at low tide ([atlas-far.md](./atlas-far.md#glassway)) |
| Opens | side story 36 *The Merry Mabel* ([side-content.md](./side-content.md#ss-36)) unseals the gangway |
| Needs on entry | Thistle Hook, Tide Bell |
| Rooms · hours | 9 · 1.0 h |
| Signature mechanic | a broken ship: a deck that sags in the middle and a lower deck that tilts; the Hook across the holds; the Tide Bell for the bilges |
| Reward | **the ship's bell** (Bosun Snore gives it after the fight; ss-36 takes it to Captain Pinch) |
| Boss | **Bosun Snore** (optional) in r9 ([creatures.md](./creatures.md#boss-bosun-snore)) |
| Grid | 41 × 31 tiles; realm grid 98 m |
| Palette | stone (ship timber) `#5a3d2b`, trim (brass) `#c9a24a`, accent (sail canvas) `#efe2c4`, bilge `#2f6f7a`, dark tint `#22180f` |
| Light / music | ambient 0.55, green sea-light through portholes (cards), creaks every 5 s · track `merry_mabel` (a sea shanty on a wheezy concertina, played very slowly as a lullaby, 72 bpm) |
| Enemies | Snippy Crab ×3, Bubble Puffer ×1 (plus Bosun Snore's three dozing seal deckhands, creatures.md) |
| Chests | 2 gem · map · Root Key |
| Keys | 1 small, 1 big |

**Legend extension:** `h` hookbloom (a thistle growing from a barnacled mast-stump) · `,` `;` tide floor and raft ·
`Q` tide stone. Basins: **A** = r3 (starts high, stone `r3:Q1` (22,2)); **B** = r7 (starts high, stone `r7:Q1`
(18,10)). Digits in r2 and r9 are the sag and the tilt (1 digit per tile, walkable).

```map merry_mabel L1
#########################################
#t.......t#333___333#.,,,,,,,,#.._____..#
#.........#222___222#.Q,,,,,,,#.._____..#
#..?......#111___111#.,,,,,,,,#.._____..#
X@........O...___.h.D.,,,,,,,,D.._____.h#
#.I.....I.#111___111#.,,,,,,,,#.._____..#
#.........#222___222#.,,,,,,,,#.._____..#
#t.......t#t33___33t#.,,,,,,,,#t._____.t#
######################################D##
#t.......t#.,;;;,,,.#t...&...t#t.......t#
#.?.......#.,;K;,,Q.#.........#..e...e..#
#.........#.,;;;,,,.#...III...#.I.I.I.I.#
#.........D.,,,;;;;.L...III...D....k....#
#..III....#.,,,,,,,.#.........#.I.I.I.I.#
#.........#.,,,,,,,.#.........#....e....#
#c.......t#t,,,,,,,t#c.......t#t.......t#
#####B###################################
#t.....112233445566t#
#......1122334455667#
#......1122334455667#
#......1e2233445e667#
#......1122334455667#
#......1122334455667#
#......11223M4455667#
#......1122334455667#
#......1122334455667#
#......1122334455667#
#......11223e4455667#
#......1122334455667#
#t.....112233445566t#
##########X##########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| r1 | The Gangway | L1 | [0, 0, 11, 9] | - | 5 | `t`(1,1) `t`(9,1) `?`(3,3) `@`(1,4) `I`(2,5) `I`(8,5) `t`(1,7) `t`(9,7) |
| r2 | The Main Deck | L1 | [10, 0, 11, 9] | - | 5 | `h`(18,4) `t`(11,7) `t`(19,7) |
| r3 | The Galley | L1 | [20, 0, 11, 9] | - | 5 | `Q`(22,2) |
| r4 | The Cargo Hold | L1 | [30, 0, 11, 9] | - | 7 | `h`(39,4) `t`(31,7) `t`(39,7) |
| r8 | The Captain's Cabin | L1 | [0, 8, 11, 9] | - | 5 | `t`(1,9) `t`(9,9) `?`(2,10) `I`(3,13) `I`(4,13) `I`(5,13) `c`(1,15) `t`(9,15) |
| r7 | The Bilge | L1 | [10, 8, 11, 9] | - | 5 | `K`(14,10) `Q`(18,10) `t`(11,15) `t`(19,15) |
| r6 | The Chart Room | L1 | [20, 8, 11, 9] | - | 5 | `t`(21,9) `&`(25,9) `t`(29,9) `I`(24,11) `I`(25,11) `I`(26,11) `I`(24,12) `I`(25,12) `I`(26,12) `c`(21,15) `t`(29,15) |
| r5 | The Crew Quarters | L1 | [30, 8, 11, 9] | - | 5 | `t`(31,9) `t`(39,9) `e`(33,10) `e`(37,10) `I`(32,11) `I`(34,11) `I`(36,11) `I`(38,11) `k`(35,12) `I`(32,13) `I`(34,13) `I`(36,13) `I`(38,13) `e`(35,14) `t`(31,15) `t`(39,15) |
| r9 | The Lower Deck | L1 | [0, 16, 21, 15] | - | 6 | `t`(1,17) `t`(19,17) `e`(8,20) `e`(16,20) `M`(12,23) `e`(12,27) `t`(1,29) `t`(19,29) |

**Room by room.** r1 The Gangway: `X` (0,4) to the islet; sign `?`(3,3) "MERRY MABEL. Crew: asleep. Visitors: welcome,
quietly." r2 The Main Deck: the deck sags to the middle row; the open cargo hold (cols 14-16) splits it: hook `h`
(18,4) from (13,4), land on (17,4). r3 The Galley (A, high): ring `Q1` (22,2) for low water to walk to door (30,4);
copper pots float when it is high. r4 The Cargo Hold (ceiling 7): a 5-wide hold; hook `h` (39,4) from (32,4), land on
(38,4); door (38,8) south. r5 The Crew Quarters: hammock posts; wave Snippy Crab ×3 at (33,10), (37,10), (35,14)
(the shipped crab, guard and all); clear: small key `r5:k1` (35,12). r6 The Chart Room: map `&` (25,9), gem chest
`r6:c1` (21,15), a chart table with a pencilled route that stops at the reef (decor); locked door (20,12). r7 The
Bilge (B, high): the Root Key chest `K` (14,10) sits in a raft ring: walk the row-12 rafts from the east strip to it;
then ring `Q1` (18,10) for low water and cross to door (10,12); wave Bubble Puffer ×1. r8 The Captain's Cabin: the
ship's log `?`(2,10): "Day 1: set sail with a fine crew. Day 2: crew asleep. Day 3: still asleep. Ship asleep too.
Very peaceful." Gem chest `r8:c2` (1,15); boss door (5,16). r9 The Lower Deck (ceiling 6): arena 19 × 13 tiles, the
floor tilting up to the east (0 to 7); boss spawn `M` (12,23); the three seal deckhands doze at (8,20), (16,20),
(12,27); `X` (10,30) to the islet.

**Ledger.** `r5:k1` → L (20,12); `K` → B (5,16). Gem chests `r6:c1`, `r8:c2` = 80 gems.

**Solver notes.** r1 → r2 (hook) → r3 (ring for low) → r4 (hook) → r5 (clear, `k1`) → r6 (`&`, `c1`) → unlock → r7
(rafts at high, `K`; ring for low, cross) → r8 (`c2`) → B → r9.

**Hints.** 1. "Thistles grow on old masts." / "Aim the Thistle Hook at the purple thistle across the hold." 2. "The
galley is flooded." / "Ring the tide stone in the Galley for low water." 3. "The Root Key floats on its own little ring
of rafts." / "In the Bilge, keep the water high and walk the rafts to the Root Key, then ring for low water to leave."

**Step split.** S-214 builds all nine rooms, Bosun Snore and the ship's-bell reward in one PR (the Mabel is small; if
the PR passes 500 lines, the implementer splits Bosun Snore into its own PR and says so). S-216 wraps it in ss-36.

**Art (o3).** `tex_ship_planks` (`realm: glassway`): "<style line> Seamless texture of old ship deck planks, warm
brown with pale salt stains, small brass nails and a few barnacles, tileable" (make_seamless 1024/512; fallback
`#5a3d2b` stripes). `int_hammock`: code-built canvas hammock between two posts (tris 80). `int_ship_bell`: code-built
0.6 m brass ship's bell on a wooden bracket with a rope pull; ART BRIEF: silhouette a classic ship's bell with a rope
tail; size 0.6 m; palette brass `#c9a24a`, rope `#c9a46b`, bracket `#5a3d2b`; tris 400 painted; pose hangs, swings when
rung. Image prompt: "<style line> An old brass ship's bell on a wooden bracket with a frayed rope pull, a little
barnacled, cosy." 3D prompt: "Stylised low-poly brass ship's bell on a wooden bracket with a rope pull, hand-painted,
game-ready, under 400 triangles, 0.6 m."

---
<a id="o4"></a>
### o4 The Hundred Lamps

| Field | Value |
|---|---|
| Realm id / file | `hundred_lamps` · `js/realms/dungeons/hundred_lamps.js` |
| Where | under Duskwick: a spiral-carved door in the cliff below Tower Head, behind the Wicklings' boathouse ([atlas-isles.md](./atlas-isles.md#duskwick)) |
| Opens | after the main ending (flag `mainEnding`): Granny Wick gives Pip the key-word ("Light's for passing on, dear. Go and pass some.") and the door unseals |
| Needs on entry | every tool |
| Floors · hours | 10 · about 1.5 h (CANON counts it inside the 9 h post-game bucket) |
| Signature mechanic | **ten lamps on every floor**: Kindle all ten to open the hatch down (100 in all; the Jamboree's ten light as its fight goes). Floors F1-F9 remix the ten dungeon mechanics with harder numbers and later-land enemies; **no new rules** |
| Reward | the **last heart petal** (`+` on F9) and a **hood trim** "Lamplighter's Gold" (after the Jamboree, [side-content.md](./side-content.md#ss-50)) |
| Boss | **the Three Corners Jamboree** on F10 ([creatures.md](./creatures.md#boss-jamboree)) |
| Levels | F1-F9 15 × 13 tiles at `at` = [17 × (n−1 mod 3), 15 × floor((n−1)/3)]; F10 23 × 19 at [0, 46]; `base` = −6 × n m (visual only) |
| Grid | extent 49 × 65 tiles (98 × 130 m); realm grid 146 m |
| Palette | stone `#241c30`, trim `#6b4a8c`, accent (lamp gold) `#f2b45a`, teal `#3fa79a`, dark tint `#18121f`; each floor's floor-tint borrows its source dungeon's palette |
| Light / music | ambient 0.35 rising by 0.06 for every lamp lit on the floor (a floor with all ten lit is fully bright) · track `hundred_lamps` (the Duskwick marimba theme slowed down, one bell added per lamp lit on the floor) |
| Enemies | later-land mixes per floor (below), always the shipped rule of at most 2 attacking |
| Chests | 1 gem (F5) · the petal (F9) |
| Keys | none |

**Legend.** Each floor uses the glyphs of the dungeon it remixes, with the same meanings, and o4 stores a **legend
per level** (`levels.Fn.legend`) so `z` can be a steam platform on F8 and a high bell on F7. Every floor: arrival
`^`/`@` (7,1), hatch `^` (7,11) (`lit:` all ten lamps of the floor). A "lamp" is a wall-lantern `l`, a high
brazier `a` (F8) or a high wall-lantern lit by a receiver (F5). F1's `X` (7,0) leads out to Duskwick; F10's `X`
(11,18) too. "Dizzy" wakes Pip at F1 with every lamp kept lit; any floor can be left by `X` from F1 only (the floors
are one-way down until F10).

```map hundred_lamps F1
#######X#######
#l.....@.....l#
#.............#
#_____________#
#_l_._._._._l_#
#_____________#
#_._._l_l_._._#
#_____________#
#_l_._._._._l_#
#_____________#
#.............#
#l.....^.....l#
###############
```

```map hundred_lamps F2
###############
#999...^...999#
#9l9.......9l9#
#999u.....u999#
#9l9.......9l9#
#999..999..999#
#9l9..9l9..9l9#
#999..9l9..999#
#999..999..999#
#999...u...999#
#999.p...p.999#
#999l..^..l999#
###############
```

```map hundred_lamps F3
###############
#......^......#
#Q............#
#,,,,,,.;;;;;;#
#,l,,l,.;l;;l;#
#,,,,,,.;;;;;;#
#,,l,,,.;;;l;;#
#,,,,,,.;;;;;;#
#,l,,l,.;l;;l;#
#,,,,,,.;;;;;;#
#............Q#
#......^......#
###############
```

```map hundred_lamps F4
###############
#l.....^.....l#
#.............#
#_____________#
#l.._______..l#
#...__l____...#
#...___G___...#
#...____l__...#
#l.._______..l#
#_____________#
#.............#
#l.....^.....l#
###############
```

```map hundred_lamps F5
###############
#l.....^.....l#
#.............#
#..\.......R..#
#.............#
#l...I...I...l#
#S.....b.....R#
#l...I...I...l#
#.............#
#..R.......R..#
#.............#
#c.....^...\..#
###############
```

```map hundred_lamps F6
###############
#l.....^.....l#
#.............#
#______j______#
#______j______#
#_l.___.___.l_#
#_..jjj.jjj.._#
#_.l___d___l._#
#______j______#
#______j______#
#...l.........#
#l.....^.....l#
###############
```

```map hundred_lamps F7
###############
#x.....^.....z#
#.............#
#.l...l.l...l.#
#.............#
#....I...I....#
#.l....p....l.#
#....I...I....#
#.............#
#.l...l.l...l.#
#.............#
#Y.....^......#
###############
```

```map hundred_lamps F8
###############
#a.....^.....a#
#.............#
#999.......999#
#9l9z.....z9l9#
#999.......999#
#.............#
#...a.....a...#
#......v......#
#.............#
#....l...l....#
#a.....^.....a#
###############
```

```map hundred_lamps F9
###############
#l.....^.....l#
#..l.......l..#
#>>>>>>>>>>>>>#
#<<<<<<<<<<<<<#
#.___________.#
#.EElFF.JJlEE.#
#.___________.#
#>>>>>>>>>>>>>#
#...l..+..l...#
#9l9i.....i9l9#
#999...^...999#
###############
```

```map hundred_lamps F10
#######################
#l....l....^....l....l#
#.....................#
#.....................#
#.....................#
#.....................#
#.....................#
#.....................#
#..........M..........#
#l...................l#
#.....................#
#.....................#
#.....................#
#.....................#
#.....................#
#.....................#
#.....................#
#l....l.........l....l#
###########X###########
```

| Room | Name | Level | Box [col,row,w,h] | Dark | Ceil m | Special tiles `glyph`(col,row) |
|---|---|---|---|---|---|---|
| F1 | The Dark Floor | F1 | [0, 0, 15, 13] | yes | 8 | `l`(1,1) `@`(7,1) `l`(13,1) `l`(2,4) `l`(12,4) `l`(6,6) `l`(8,6) `l`(2,8) `l`(12,8) `l`(1,11) `^`(7,11) `l`(13,11) |
| F2 | The Draught Floor | F2 | [0, 0, 15, 13] | - | 8 | `^`(7,1) `l`(2,2) `l`(12,2) `u`(4,3) `u`(10,3) `l`(2,4) `l`(12,4) `l`(2,6) `l`(7,6) `l`(12,6) `l`(7,7) `u`(7,9) `p`(5,10) `p`(9,10) `l`(4,11) `^`(7,11) `l`(10,11) |
| F3 | The Tide Floor | F3 | [0, 0, 15, 13] | - | 8 | `^`(7,1) `Q`(1,2) `l`(2,4) `l`(5,4) `l`(9,4) `l`(12,4) `l`(3,6) `l`(11,6) `l`(2,8) `l`(5,8) `l`(9,8) `l`(12,8) `Q`(13,10) `^`(7,11) |
| F4 | The Gear Floor | F4 | [0, 0, 15, 13] | - | 8 | `l`(1,1) `^`(7,1) `l`(13,1) `l`(1,4) `l`(13,4) `l`(6,5) `G`(7,6) `l`(8,7) `l`(1,8) `l`(13,8) `l`(1,11) `^`(7,11) `l`(13,11) |
| F5 | The Mirror Floor | F5 | [0, 0, 15, 13] | - | 8 | `l`(1,1) `^`(7,1) `l`(13,1) `\`(3,3) `R`(11,3) `l`(1,5) `I`(5,5) `I`(9,5) `l`(13,5) `S`(1,6) `b`(7,6) `R`(13,6) `l`(1,7) `I`(5,7) `I`(9,7) `l`(13,7) `R`(3,9) `R`(11,9) `c`(1,11) `^`(7,11) `\`(11,11) |
| F6 | The Root Floor | F6 | [0, 0, 15, 13] | - | 8 | `l`(1,1) `^`(7,1) `l`(13,1) `j`(7,3) `j`(7,4) `l`(2,5) `l`(12,5) `j`(4,6) `j`(5,6) `j`(6,6) `j`(8,6) `j`(9,6) `j`(10,6) `l`(3,7) `d`(7,7) `l`(11,7) `j`(7,8) `j`(7,9) `l`(4,10) `l`(1,11) `^`(7,11) `l`(13,11) |
| F7 | The Bell Floor | F7 | [0, 0, 15, 13] | - | 8 | `x`(1,1) `^`(7,1) `z`(13,1) `l`(2,3) `l`(6,3) `l`(8,3) `l`(12,3) `I`(5,5) `I`(9,5) `l`(2,6) `p`(7,6) `l`(12,6) `I`(5,7) `I`(9,7) `l`(2,9) `l`(6,9) `l`(8,9) `l`(12,9) `Y`(1,11) `^`(7,11) |
| F8 | The Steam Floor | F8 | [0, 0, 15, 13] | - | 8 | `a`(1,1) `^`(7,1) `a`(13,1) `l`(2,4) `z`(4,4) `z`(10,4) `l`(12,4) `a`(4,7) `a`(10,7) `v`(7,8) `l`(5,10) `l`(9,10) `a`(1,11) `^`(7,11) `a`(13,11) |
| F9 | The Sand-and-Cloud Floor | F9 | [0, 0, 15, 13] | - | 8 | `l`(1,1) `^`(7,1) `l`(13,1) `l`(3,2) `l`(11,2) `l`(4,6) `l`(10,6) `l`(4,9) `+`(7,9) `l`(10,9) `l`(2,10) `i`(4,10) `i`(10,10) `l`(12,10) `^`(7,11) |
| F10 | The Jamboree Floor | F10 | [0, 0, 23, 19] | - | 14 | `l`(1,1) `l`(6,1) `^`(11,1) `l`(16,1) `l`(21,1) `M`(11,8) `l`(1,9) `l`(21,9) `l`(1,17) `l`(6,17) `l`(16,17) `l`(21,17) |

**Floor by floor** (remix of, what is harder, the lamps, the enemies):

- **F1 The Dark Floor** (d1 darkness; dark). Single-tile islands in a pit field, one-tile hops between them in the dark.
  Lamps: (1,1), (13,1), (2,4), (12,4), (6,6), (8,6), (2,8), (12,8), (1,11), (13,11). Harder: no wall torches at all;
  Dimling ×4 and Wisp Lantern ×2 drift between the islands (only hittable in lamplight).
- **F2 The Draught Floor** (d2 updrafts). Toggle plates `p` (5,10) flips `u` (4,3) and `u` (10,3) (west starts open);
  `p` (9,10) flips `u` (7,9) (starts closed). Lamps on three high blocks (digit 9) and two on the floor: (2,2), (12,2),
  (2,4), (12,4), (2,6), (7,6), (12,6), (7,7), (4,11), (10,11). Harder: the centre block needs a glide from an updraft
  top (2 tiles); Needle Wasp ×3, Comet Pup ×1.
- **F3 The Tide Floor** (d3 tides). West basin `,` (cols 1-6) and east rafts `;` (cols 8-13) share one tide, flipped
  by `Q` (1,2) or `Q` (13,10); a stone spine (col 7) is always dry. Five lamps can be reached only at low water
  ((2,4), (5,4), (3,6), (2,8), (5,8)) and five only at high water ((9,4), (12,4), (11,6), (9,8), (12,8)). Harder:
  Squirt Urchin ×2 on the spine ends, Tidepool Jelly ×2.
- **F4 The Gear Floor** (d4 gears). Gear-bridge `G` (7,6), len 3, starts `NS`, turned only by its hub wheel (no
  crank). Lamps (1,1), (13,1), (1,4), (13,4), (1,8), (13,8), (1,11), (13,11) and two on posts beside the hub, (6,5)
  and (8,7), kindled from the hub or the arm. Harder: Woolly Ram ×2 on the side platforms (their charge stops at the
  edge, never over it), Field Vole gang ×4 on the north floor.
- **F5 The Mirror Floor** (d5 beams). Six wall-lanterns (1,1), (13,1), (1,5), (13,5), (1,7), (13,7) plus four **high
  lanterns**, one above each receiver: `R` (11,3) via mirror `\` (3,3) (needs `/`: two hits; beam north up column 3),
  `R` (13,6) via the skylight `S` (1,6) once push-block `b` (7,6) is pushed out of row 6, `R` (3,9) directly, `R`
  (11,9) via mirror `\` (11,11) (needs `/`: two hits; beam east along row 11). Gem chest `c` (1,11). Harder: Moonbeam
  Turret ×2, Sun Beetle ×2.
- **F6 The Root Floor** (d6 light-roots). Roots (7,3)-(7,4) to the centre island, (4-6,6) west, (8-10,6) east, (7,8)-(7,9)
  south; soft earth `d` (7,7) blocks the south root and hides the tenth lamp (dig: it is a lamp post). Lamps (1,1),
  (13,1), (2,5), (12,5), (3,7), (11,7), (4,10), (1,11), (13,11) and the dug one. Harder: roots last **12 s** here (not
  20); Drip Bat ×3, Pebble Mimic ×2.
- **F7 The Bell Floor** (d7 sound). Each lamp sits behind a little bronze shutter marked with a pitch; it opens when that
  pitch sounds within 6 tiles and **closes again after 10 s** unless the lamp is kindled. Shutters: (2,3) low, (6,3)
  mid, (8,3) high, (12,3) low, (2,6) Tune C, (12,6) mid, (2,9) high, (6,9) low, (8,9) mid, (12,9) high. **Tune C** "the
  Clam Round" = high, low, high, sung by the two clams (5,5), (9,5) while Pip stands on shell plate `p` (7,6). Bells
  `x` (1,1), `z` (13,1), `Y` (1,11) work as well as the Starsong. Harder: the 10 s close; Stardust Sprite ×4, Gullgrab
  ×1.
- **F8 The Steam Floor** (d8 steam and embers). Six high braziers `a` (1,1), (13,1), (4,7), (10,7), (1,11), (13,11)
  (embers only) and four lanterns: (2,4), (12,4) on the side ledges (digit 9) and (5,10), (9,10). One valve `v` (7,8)
  toggles **both** platforms `z` (4,4) and (10,4) (`0 → 9`): stand on one and sling the valve. Harder: one valve for
  two platforms; Ash Moth ×3, Soot Snuffle ×2.
- **F9 The Sand-and-Cloud Floor** (d9 sand, ivy, nameplates; d10 song clouds). Sand lanes rows 3 (east), 4 (west) and
  8 (east); a cloud bridge (row 6): rose (2-3), lamp post (4,6), gold (5-6), stone (7,6), sky (8-9), lamp post (10,6),
  rose (11-12), **solo** (one colour at a time); ivy `i` (4,10) and (10,10) up onto the corner ledges (digit 9).
  Lamps (1,1), (13,1), (3,2), (11,2), (4,6), (10,6), (4,9), (10,9), (2,10), (12,10). The **heart petal** `+` (7,9)
  rises on a root pedestal when all ten are lit (the 24th petal, `collect.petal 'hundred_lamps:1'`). Harder: lanes and
  solo clouds together; Dust Puff ×2, Sandsnoot ×2, Gust Kite ×1.
- **F10 The Jamboree Floor** (ceiling 14). Arena 21 × 17 tiles. Ten wall-lanterns at (1,1), (6,1), (16,1), (21,1),
  (1,9), (21,9), (1,17), (6,17), (16,17), (21,17) light one by one as the Jamboree goes (creatures.md decides which
  event lights which; the last lights on the win). Boss spawn `M` (11,8) (the three Catchers in a row). After the win:
  the hood trim and side story 50; `X` (11,18) to Duskwick.

**Ledger.** 100 lamps (`S.dungeons.hundred_lamps.lit`, 10 per floor; the Completion page shows "Hundred Lamps n/100"
as part of the o4 row). Gem chest F5 `c` = 40 gems. Heart petal F9.

**Solver notes.** Per floor: every lamp reachable and kindle-able from the arrival with all tools, and the hatch opens
once all ten are lit; F3 checks both tide states; F6 checks every root crossing ≤ 12 s at run speed (longest 4
tiles, 1.9 s); F7 checks each shutter can be opened and its lamp kindled within 10 s from where the pitch is played.

**Hints** (one per floor through Ask the Tree; the plain answer names the lamp the player is missing, read from
the save, e.g. "The last lamp on the Tide Floor is at high water, on the east side.").

**Step split.** S-297 builds F1-F5, S-298 builds F6-F9 with the petal, S-299 builds F10 and the Jamboree with ss-50.

**Art (o4).** `tex_lamp_vault` (`realm: duskwick`): "<style line> Seamless texture of deep plum stone vault walls with
small brass lamp brackets and soft teal moss, warm and calm, tileable" (make_seamless 1024/512; fallback `#241c30`
noise). `int_shutter_lamp`: code-built wall-lantern with a little bronze shutter that slides up (tris 120; fallback
kit lantern). `card_hundred_lamps_title`: 1600 × 900 webp loading card, "<style line> A tall round vault going down and
down, its walls ringed with a hundred small glowing lamps in a spiral, a tiny figure in a leaf-green hood with fox ears
looking down from the top, warm gold and plum." (fallback: dusk gradient with the land name).

---
<a id="hollows"></a>
## 7. The 24 Hollows

A Hollow is a small puzzle cave behind a **spiral-carved door** (on home, behind two fairy rings). It is a
`kind: 'hollow'` realm built by the dungeon recipe from an 11 × 11 tile map (realm grid 48 m), with no map, Chime
Stone, keys or chests. Its prize stands on a root pedestal: a **heart petal** `+` (16 Hollows) or a **60-gem bag** `*`
(8 Hollows). **Every Hollow has two stages** (R15; playtime review: one-step Hollows played in 2-3 minutes and all
24 felt alike):

- **Stage 1** is the puzzle mapped below (it opens the way to the pedestal, as before).
- **Stage 2** adds a second mechanic or a tool from an earlier land, and the prize sits behind it. In an ordinary
  Hollow the prize sits under a **reliquary**: a root cage over the pedestal (entity `reliquary: { when: [...] }` on
  the prize tile; code-built `int_reliquary`, a 1.0 m cage of four curved roots `#6f5a44` with gold buds `#ffe9a8`,
  ≤ 120 tris) that opens in 1.0 s with `chime_up` when its condition holds. Each Hollow's **Stage 2** line below gives
  the entities (all on floor tiles of its map) and the condition. A Hollow never needs a tool from a land Pip cannot
  have reached when its step ships.
- **One Hollow per Act II-III land is a Deep Hollow** (15-20 min): three 11 × 11 rooms side by side joined by doors
  (composite 31 × 11 tiles, realm grid 78 m, same legend). Room 1 is the old one-room puzzle (stage 1) with a door
  (10,1) where its prize stood; room 2 is stage 2; room 3, **the Reading Nook**, holds the prize (25,1), **a Lamp Log**
  on a page pinned to stone (23,3) (the land's highest-numbered found log moves here from its atlas slot; land totals
  unchanged), **a note from the Lamp Thief** in a scrap jam-jar lamp (27,3) (`[E] Read · Note`, Lore entry "A note in
  a Hollow", flag `trace:hollow:<land>`; it never names him; if story.md's traces define the note, its text wins), and
  its own exit `X` (25,10). The eight: Duskwick H03, Pinewhistle H06, Archwater H09, Threemills H12, the Rootdeep H15,
  the Glassway H18, Kettle Isle H20, Saltglass Flats H23.
- **Steps.** Each land's Hollow step builds its Hollows as before; its `b` step (S-093b, S-107b, S-129b, S-149b,
  S-186b, S-220b, S-234b, S-255b) adds stage 2 to the land's ordinary Hollows and rebuilds its Deep Hollow. Home's two
  Hollows get stage 2 in S-093b (with the reliquary); Driftholm's in S-267a.

Rules shared by all 24:

- Door: `[E] Enter · Spiral door` on the isles and far lands, `[E] Enter · Fairy ring` on home's two stumps
  ([systems.md#portal-table](./systems.md#portal-table)) (the atlas files place each door; the solved door glows gold outside afterwards and the
  map shows a gold spiral). No name card; a toast shows the Hollow's name.
- Inside: R3-R7 apply (dizzy wakes Pip at `@`, pits respawn, at most 2 attackers). A Hollow never needs a tool
  from a land Pip cannot have reached when its step ships (the tool column below is the full list).
- Prize: petal item-get "You found a heart petal! Six petals make a whole heart." (systems.md owns the count line);
  gem bag "+60 gems!". Saved as `collect.hollow['hollow_<land>_<n>']` (v9, the Hollow's realm id) plus
  `collect.petal['hollow_<land>_<n>:p1']` for petals.
- Puzzle state (blocks, tides, rotations) is saved in `S.dungeons['hollow_<land>_<n>']` until solved, then dropped.
- Hidden bridges `=` in Hollows rise when the Hollow's condition holds (listed per Hollow) and stay.
- Each Hollow has one Ask the Tree hint pair (nudge = the "Look" line, plain = the solution line below).
- Hollows count toward the Completion row "Hollows" of their land ([systems.md](./systems.md#completion)).

| # | Realm id | Name | Land (step) | Tools | Prize | Dark |
|---|---|---|---|---|---|---|
| 1 | `hollow_home_1` | The Glow-Ring Hollow | home, fairy ring (−36.1, −44.8) (S-073; stage 2: S-093b) | Lantern; stage 2 block | petal | yes |
| 2 | `hollow_home_2` | The Moonring Hollow | home, fairy ring (23.6, −106.9) (S-073; stage 2: S-093b) | Lantern | petal | yes |
| 3 | `hollow_duskwick_1` | The Ember-Sand Hollow **(Deep)** | Duskwick (S-093; Deep: S-093b) | Lantern | petal | yes |
| 4 | `hollow_duskwick_2` | The Coral Shelf Hollow | Duskwick (S-093; stage 2: S-093b) | Lantern | gem bag | - |
| 5 | `hollow_pinewhistle_1` | The Gap Hollow | Pinewhistle (S-107; stage 2: S-107b) | Glider; stage 2 block | petal | - |
| 6 | `hollow_pinewhistle_2` | The Knot-Clock Hollow **(Deep)** | Pinewhistle (S-107; Deep: S-107b) | Glider | petal | - |
| 7 | `hollow_pinewhistle_3` | The Resin Block Hollow | Pinewhistle (S-107; stage 2: S-107b) | Lantern | gem bag | - |
| 8 | `hollow_archwater_1` | The Rockpool Hollow | Archwater (S-129; stage 2: S-129b) | Tide Bell | petal | - |
| 9 | `hollow_archwater_2` | The Mirror Pool Hollow **(Deep)** | Archwater (S-129; Deep: S-129b) | Tide Bell | petal | - |
| 10 | `hollow_archwater_3` | The Barnacle Block Hollow | Archwater (S-129; stage 2: S-129b) | - | gem bag | - |
| 11 | `hollow_threemills_1` | The Thistle Hollow | Threemills (S-149; stage 2: S-149b) | Hook | petal | - |
| 12 | `hollow_threemills_2` | The Millwheel Hollow **(Deep)** | Threemills (S-149; Deep: S-149b) | Hook | gem bag | - |
| 13 | `hollow_threemills_3` | The Haystack Hollow | Threemills (S-149; stage 2: S-149b) | Hook | petal | - |
| 14 | `hollow_rootdeep_1` | The Mole Hollow | the Rootdeep (S-186; stage 2: S-186b) | Paws, Sunglass | gem bag | - |
| 15 | `hollow_rootdeep_2` | The Dark Hollow **(Deep)** | the Rootdeep (S-186; Deep: S-186b) | Lantern, Sunglass, Paws | petal | yes |
| 16 | `hollow_rootdeep_3` | The Sunroot Hollow | the Rootdeep (S-186; stage 2: S-186b) | Sunglass, Paws | petal | - |
| 17 | `hollow_glassway_1` | The Puffin Hollow | the Glassway (S-220; stage 2: S-220b) | Tide Bell, Hook | gem bag | - |
| 18 | `hollow_glassway_2` | The Bell Hollow **(Deep)** | the Glassway (S-220; Deep: S-220b) | Starsong (or bells), Tide Bell | petal | - |
| 19 | `hollow_kettle_1` | The Cinder Hollow | Kettle Isle (S-234; stage 2: S-234b) | Ember Sling, Paws | petal | - |
| 20 | `hollow_kettle_2` | The Kettle-Steam Hollow **(Deep)** | Kettle Isle (S-234; Deep: S-234b) | Ember Sling | gem bag | - |
| 21 | `hollow_saltglass_1` | The Dune Hollow | Saltglass Flats (S-255; stage 2: S-255b) | Sunglass | petal | - |
| 22 | `hollow_saltglass_2` | The Trellis Hollow | Saltglass Flats (S-255; stage 2: S-255b) | Ivy Gloves, Glider, Sunglass | gem bag | - |
| 23 | `hollow_saltglass_3` | The Sun-Dial Hollow **(Deep)** | Saltglass Flats (S-255; Deep: S-255b) | Sunglass | petal | - |
| 24 | `hollow_driftholm_1` | The Wind-Chime Hollow | Driftholm (S-267; stage 2: S-267a) | Starsong, Glider, Ember Sling | petal | - |

Totals: **16 petals, 8 gem bags (480 gems)**, matching CANON §10.3 and §10.4. Time (CANON §11's per-beat model): 16 two-stage Hollows × about 4 min + 8 Deep Hollows × about
16 min ≈ **3.15 h** of real play (the old 3.2 h budget priced 24 one-step rooms that played in 2-3 min each). Per land: home 2 (2 petals) ·
Duskwick 2 (1 + 1) · Pinewhistle 3 (2 + 1) · Archwater 3 (2 + 1) · Threemills 3 (2 + 1) · Rootdeep 3 (2 + 1) ·
Glassway 2 (1 + 1) · Kettle 2 (1 + 1) · Saltglass 3 (2 + 1) · Driftholm 1 (1 + 0) · Starmeadow 0.

<a id="h01"></a>
### H01 The Glow-Ring Hollow

```map hollow_home_1 L1
###########
#....+....#
#.........#
#____=____#
#____=____#
#.........#
#l.......l#
#.........#
#l.......l#
#....@....#
#####X#####
```

Exit `X` (5, 10). Dark; four wall-lanterns on the near side (1,6), (9,6), (1,8), (9,8). Kindle all four: the hidden bridge (5,3)-(5,4) rises across the 2-row pit to the petal (5,1). Wave: Dimling ×2.

**Stage 2:** reliquary over the petal; push-block `b` (3,2) east ×4 onto hold plate `P` (7,2) (Pip pushes from (2,2)); condition `plate`.
Hint: "Light the four lanterns." / "Kindle all four lanterns with the Glowbud Lantern; the root bridge grows to the petal."

<a id="h02"></a>
### H02 The Moonring Hollow

```map hollow_home_2 L1
###########
#....+....#
#.........#
#____=____#
#____=____#
#........r#
#..b......#
#.........#
#......P..#
#l...@...l#
#####X#####
```

Exit `X` (5, 10). Dark; lanterns (1,9), (9,9) light the room (optional). Push block (3,6) east ×4, then south ×2 onto hold plate (7,8): the bridge rises (live, while held). Reset lever (9,5).

**Stage 2:** reliquary over the petal; new wall-lanterns `l` (1,1) and (9,1) on the petal side; kindle both (the bridge is live, so the block stays on the plate while Pip is across); condition `lit:[l3,l4]`.
Hint: "The square plate wants the stone." / "Push the block four times east and twice south onto the square plate; walk the bridge to the petal."

<a id="h03"></a>
### H03 The Ember-Sand Hollow (Deep Hollow)

```map hollow_duskwick_1 L1
###############################
#.........D.........#t...+...t#
#.........#..b...P..#.........#
#____=____#l.......l#..?...?..#
#____=____#____=____#.........#
#.l.....l.#____=____#.........#
#.........#.........#.........#
#..##.##..#..e......#.........#
#.l.....e.#.........#.........#
#....@....#.........D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Dark; low walls (3-4,7) and (6-7,7). Kindle lanterns (2,5), (8,5), (2,8): bridge (5,3)-(5,4) rises. Wave: Dimling ×1 at (8,8), Dimling ×1 near (2,5). The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Wax Cellar** (cols 10-20; stage 2): (dark) push-block (13,2) east ×4 onto hold plate (17,2); kindle wall-lanterns (11,3) and (19,3); the bridge (15,4)-(15,5) rises while the plate is held and both are lit, and stays once Pip is across; Dimling ×1 (13,7); exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 5** on a page pinned to
stone (23,3) (moved here from its atlas slot in Duskwick); the scrap jam-jar lamp with the note (27,3): "Practised here first. Small lights. Jam jars are very forgiving. — M"
(`lore.hollow.duskwick`; Lore "A note in a Hollow"; `trace:hollow:duskwick`); exit `X` (25,10). Built by
S-093b.
Hint: "Three little lights." / "Kindle the three lanterns; the bridge rises to the petal."
Hint (room 2): "Two lights and a weight." / "In the Wax Cellar, push the block onto the square plate and kindle both lanterns; the bridge rises."

<a id="h04"></a>
### H04 The Coral Shelf Hollow

```map hollow_duskwick_2 L1
###########
#....*....#
#.........#
#____=____#
#____=____#
#.........#
#.b.....b.#
#.........#
#..P...P..#
#r...@....#
#####X#####
```

Exit `X` (5, 10). Blocks (2,6) and (8,6); hold plates (3,8) and (7,8): block 1 east ×1, south ×2; block 2 west ×1, south ×2. Bridge rises while both are held. Lever (1,9).

**Stage 2:** reliquary over the gem bag; Dimling ×2 rise on rows 1-2 once the bridge is up (hittable only in Lantern light) and a crystal switch `s` (9,1) sits on a raised root (digit 2, a hop); condition `clear && sw`.
Hint: "Two blocks, two square plates." / "Push each block one step towards the middle, then twice south onto its square plate."

<a id="h05"></a>
### H05 The Gap Hollow

```map hollow_pinewhistle_1 L1
###########
#+.___9999#
#..___9999#
#..___8888#
#..___7777#
#..___6666#
#..___5555#
#..___4444#
#..___3333#
#u.___22@2#
########X##
```

Exit `X` (8, 10). A ramp (digits 2 up to 9, cols 6-9) climbs north beside a 3-wide pit. From the top glide west over the pit to the petal ledge (1,1). Updraft (1,9) (always open, top 3.0 m) lifts Pip back out to glide east onto the ramp.

**Stage 2:** reliquary over the petal; on the west strip push-block `b` (2,5) north ×2 onto hold plate `P` (2,3) (Pip pushes from (2,6)); condition `plate`.
Hint: "High places make long glides." / "Walk up the ramp to the top and glide west across the pit. Ride the updraft to glide back."

<a id="h06"></a>
### H06 The Knot-Clock Hollow (Deep Hollow)

```map hollow_pinewhistle_2 L1
###############################
#...___999D...___666#t...+...t#
#...___999#...___666#.........#
#.u.___999#...___666#..?...?..#
#...______#...___666#.........#
#...______#.u.___666#.........#
#...______#...___666#.........#
#...______#...___666#.........#
#...______#.p.___666#.........#
#.@.______#...___666D.........#
##X######################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (2, 10)). Updraft (2,3) has top 4.0 m and **breathes**: open 3 s, closed 3 s. Ride it while open and glide east over the 3-wide pit onto the ledge (digit 9): petal (8,1). Glide back west to leave. The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Breathing Knots** (cols 10-20; stage 2): Pip drops in at (11,1); toggle plate (12,8) opens knot-hole (12,5) (starts closed); ride it (top 3.0 m) and glide east over the pit onto the ledge (digit 6); the exit door (20,9) on the ledge drops Pip into room 3.
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 7** on a page pinned to
stone (23,3) (moved here from its atlas slot in Pinewhistle); the scrap jam-jar lamp with the note (27,3): "The pine hums when the wind is right. I hummed back. It did not answer. — M"
(`lore.hollow.pinewhistle`; Lore "A note in a Hollow"; `trace:hollow:pinewhistle`); exit `X` (25,10). Built by
S-107b.
Hint: "The knot-hole breathes in and out." / "Wait until the knot-hole is blowing, ride it to the top and glide east to the ledge."
Hint (room 2): "This knot-hole sleeps until you wake it." / "Step on the plate to open the knot-hole, ride it and glide east to the ledge."

<a id="h07"></a>
### H07 The Resin Block Hollow

```map hollow_pinewhistle_3 L1
###########
#....*....#
#____=____#
#____=____#
#....I....#
#.b.....b.#
#....b....#
#.P.....P.#
#....P....#
#r...@....#
#####X#####
```

Exit `X` (5, 10). Three blocks (2,5), (8,5), (5,6); three hold plates (2,7), (8,7), (5,8); each block straight south ×2 (the pillar (5,4) leaves room to push the middle one from (5,5)). All three held: the bridge rises. Lever (1,9).

**Stage 2:** reliquary over the gem bag; wall-lanterns `l` (1,1) and (9,1) beside it; kindle both with the Lantern; condition `lit`.
Hint: "Every block has a plate below it." / "Push each of the three blocks two steps south onto its plate."

<a id="h08"></a>
### H08 The Rockpool Hollow

```map hollow_archwater_1 L1
###########
#Q;;;;;,,,#
#.;,;+;,,,#
#,,,;;;,,,#
#,,,,,,,,,#
#,,,,,,,,,#
#,,,,,,,,,#
#.........#
#.........#
#....@....#
#####X#####
```

Exit `X` (5, 10). Starts at low water. Walk the dry `,` floor to the stone (1,2) and ring tide stone (1,1): high water. Rafts (2,1)-(6,1) and (2,2) lead to the raft ring round the petal (5,2). Ring again for low to walk home.

**Stage 2:** reliquary on the raft ring; a crystal switch `s` on the far tide-floor corner (9,1), reachable only at **low** water; hit it first, then ring for high and ride the rafts; condition `sw`.
Hint: "The petal floats on a raft ring." / "Ring the tide stone in the corner for high water and walk the rafts to the petal."

<a id="h09"></a>
### H09 The Mirror Pool Hollow (Deep Hollow)

```map hollow_archwater_2 L1
###############################
#.........D..,;;;...#t...+...t#
#____=____#..,;;;...#.........#
#____=____#Q.,;;;...#..?...?..#
#.p.....p.#..,;;;...#.........#
#...www...#.b,;;;...#.........#
#...www...#..,;;;...#.........#
#...www...#..,;;;...#.........#
#.p.....p.#..,;;;...#.........#
#....@....#..,;;;...D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Four plates (2,4), (8,4), (2,8), (8,8) round a still pool (4-6,5-7). Looking into the pool shows four stars lighting in order: south-east, north-west, north-east, south-west (they are painted in a hole in the ceiling that only the pool reflects). Step on the plates in that order (a wrong one resets with a soft 'bloop'): the bridge rises. The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Moon Basin** (cols 10-20; stage 2): (its own tide, starts high) ring tide stone (11,3) for low water; push block (12,5) east ×1 onto the dry tide floor (13,5); ring again for high: the block is a stepping stone onto the raft band (cols 14-16) and the dry east strip; exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 9** on a page pinned to
stone (23,3) (moved here from its atlas slot in Archwater); the scrap jam-jar lamp with the note (27,3): "The pool shows the stars the ceiling hides. I came to look at them. Only to look. — M"
(`lore.hollow.archwater`; Lore "A note in a Hollow"; `trace:hollow:archwater`); exit `X` (25,10). Built by
S-129b.
Hint: "The pool remembers something the ceiling hides." / "Look into the pool: step on the plates south-east, north-west, north-east, south-west."
Hint (room 2): "A stepping stone, if the water is up." / "At low water push the block into the channel, ring for high water and hop from the block onto the rafts."

<a id="h10"></a>
### H10 The Barnacle Block Hollow

```map hollow_archwater_3 L1
###########
#....*....#
#____=____#
#____=____#
#.........#
#..b.b.b..#
#.........#
#.P..I..P.#
#.........#
#r...@....#
#####X#####
```

Exit `X` (5, 10). Three barnacle blocks (3,5), (5,5), (7,5); hold plates (2,7), (8,7); pillar (5,7). Block (3,5) west ×1 then south ×2; block (7,5) east ×1 then south ×2. The middle block is spare. Lever (1,9).

**Stage 2:** reliquary over the gem bag; two crystal switches `s` (1,1) and (9,1) must both be hit within 2.0 s of each other (a ticking ring shows the window); condition `sw:both`.
Hint: "Only two plates." / "Push the outer blocks out one step and down two onto the plates; leave the middle one."

<a id="h11"></a>
### H11 The Thistle Hollow

```map hollow_threemills_1 L1
###########
#h^_______#
#+._______#
#___...___#
#___.h.___#
#___...___#
#_________#
#_________#
#.........#
#^...@....#
#####X#####
```

Exit `X` (5, 10). Hook hookbloom (5,4) from (5,8): land on the island (5,5). Hook hookbloom (1,1) from the island: land on (2,2) and take the petal (1,2). Stair warp (2,1) ↔ (1,9) takes Pip back.

**Stage 2:** reliquary over the petal; crank `y` (9,8) on the south floor winds it open (the cage is on a gear); turn it before hooking; condition `crank`.
Hint: "Thistles on islands." / "Hook the thistle on the middle island, then the one in the corner. The little stair takes you back."

<a id="h12"></a>
### H12 The Millwheel Hollow (Deep Hollow)

```map hollow_threemills_2 L1
###############################
#.........D.._____..#t...*...t#
#_______._#.._____..#.........#
#_______._#..__.h_..#..?...?..#
#_______._#.._____..#.........#
#_.__G__._#.._____..#.........#
#_________#..__G__..#.........#
#_________#.._____..#.........#
#.......y.#.._____..#.........#
#....@....#.._____..D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Gear-bridge (5,5), len 2, starts EW; crank (8,8). Crank to NS, walk to the hub, use the wheel (EW), walk east to the alcove column (col 8) and north to the door (10,1) (8,1). The gem bag no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Sail Loft** (cols 10-20; stage 2): hook the hookbloom (16,3) from the west floor and land on the island (15,3)-(16,3); walk the gear-bridge (hub (15,6), length 5, starts `NS`) to its hub, turn the hub wheel to `EW`, walk east; exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the gem bag on its pedestal (25,1); **Lamp Log 11** on a page pinned to
stone (23,3) (moved here from its atlas slot in Threemills); the scrap jam-jar lamp with the note (27,3): "Wheels go round and come back. I would like to come back too, one day. — M"
(`lore.hollow.threemills`; Lore "A note in a Hollow"; `trace:hollow:threemills`); exit `X` (25,10). Built by
S-149b.
Hint: "Turn it, then ride it." / "Crank the bridge round, walk to the middle, turn the wheel, then walk east and north to the bag."
Hint (room 2): "Hook to the island, then turn the bridge under your feet." / "Hook the thistle on the island, walk down the gear-bridge to its middle, turn the wheel and walk east."

<a id="h13"></a>
### H13 The Haystack Hollow

```map hollow_threemills_3 L1
###########
#....+....#
#.........#
#_________#
#_________#
#.........#
#.b..b..b.#
#.........#
#.........#
#r...@....#
#####X#####
```

Exit `X` (5, 10). Bales (2,6), (5,6), (8,6); a 2-row pit (rows 3-4). Push (5,6) north ×2 (fills (5,4)); push (8,6) west ×3 then north ×3 (fills (5,3)). Lever (1,9).

**Stage 2:** reliquary over the petal, hung 3 m up on a sack rope; hook the hookbloom `h` (9,1) on its pulley to lower it; condition `hooked`.
Hint: "Two bales in one column." / "Fill the middle column of the pit with two bales and walk across."

<a id="h14"></a>
### H14 The Mole Hollow

```map hollow_rootdeep_1 L1
###########
#....*....#
###d###d###
#.........#
##d###d####
#.........#
####d###d##
#.........#
#.........#
#....@....#
#####X#####
```

Exit `X` (5, 10). Three root walls (rows 2, 4, 6) each with two soft-earth mounds; dig one in each wall to reach the gem bag (5,1). Wave: Pebble Mimic ×2 at (3,3), (7,5).

**Stage 2:** reliquary over the gem bag with a receiver lock: hold the Sunglass beam on receiver `R` (9,1) for 1.0 s; condition `lit:[R]`.
Hint: "Three walls, three digs." / "Dig one mound in each of the three root walls."

<a id="h15"></a>
### H15 The Dark Hollow (Deep Hollow)

```map hollow_rootdeep_2 L1
###############################
#.........D.._______#t...+...t#
#____=____#.._______#.........#
#____=____#.._______#..?...?..#
#l...I...l#.._______#.........#
#.........#..jjjjjd.#.........#
#..lI.Il..#.._____..#.........#
#.........#.._____..#.........#
#l...I...l#.._____..#.........#
#....@....#.._____..D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Dark; root pillars (5,4), (4,6), (6,6), (5,8). Kindle six lanterns (1,4), (9,4), (3,6), (7,6), (1,8), (9,8): the bridge rises. Wave: Dimling ×3, Drip Bat ×1. The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Root Stair** (cols 10-20; stage 2): (dark) beam the light-root (13-17,5); cross within 20 s; dig the mound (18,5) from the root's east end; exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 18** on a page pinned to
stone (23,3) (moved here from its atlas slot in the Rootdeep); the scrap jam-jar lamp with the note (27,3): "Dark down here. Not cold, though. Someone keeps it warm. I left that alone. — M"
(`lore.hollow.rootdeep`; Lore "A note in a Hollow"; `trace:hollow:rootdeep`); exit `X` (25,10). Built by
S-186b.
Hint: "Six lights in the dark." / "Kindle all six lanterns; the Dimlings are only hittable in the light."
Hint (room 2): "Beam, run, dig." / "Shine the Sunglass on the long root, run across and dig the mound at its far end before the root sinks."

<a id="h16"></a>
### H16 The Sunroot Hollow

```map hollow_rootdeep_3 L1
###########
#....+....#
#____j____#
#____j____#
#____.____#
#____j____#
#____j____#
#____.____#
#.........#
#....@....#
#####X#####
```

Exit `X` (5, 10). Two light-roots in a column: (5,5)-(5,6) from the south floor to the island (5,4), then (5,2)-(5,3) to the petal ledge. Beam each from its south end; each lasts 20 s.

**Stage 2:** the petal sits under a soft-earth mound at (5,1): from the end of the second light-root (5,2), dig it (1.0 s) before the root sinks; condition `dug`.
Hint: "Sleepy roots in a line." / "Shine the Sunglass on the first root, cross, then shine on the second."

<a id="h17"></a>
### H17 The Puffin Hollow

```map hollow_glassway_1 L1
###########
#*;;,,,,,,#
#;;;,,,,,,#
#;;;,,,,,,#
#,,,,,,,,,#
#,,,,,,,,,#
#,,,,,,,,,#
#........Q#
#..b.b....#
#r...@....#
#####X#####
```

Exit `X` (5, 10). The gem bag (1,1) sits in a 2-thick raft ring. At low water push block (3,8) north ×4 to (3,4) and block (5,8) west ×2 then north ×2 to (3,6); ring tide stone (9,7) for high water: the blocks are stepping stones (hop, water gap, hop) to the raft ring. Lever (1,9).

**Stage 2:** reliquary over the gem bag; its lid hangs from a hookbloom `h` on the far wall at (9,1): hook it from the raft ring; condition `hooked`.
Hint: "Blocks make good stepping stones when the water is up." / "At low water push the two blocks into column 3, ring for high water and hop along them to the rafts."

<a id="h18"></a>
### H18 The Bell Hollow (Deep Hollow)

```map hollow_glassway_2 L1
###############################
#.........D..,,,,,,,#t...+...t#
#____=____#Q.,w,w,w,#.........#
#____=____#..,,,,,,,#..?...?..#
#.........#____=____#.........#
#.x..Y..z.#____=____#.........#
#.........#____=____#.........#
#..w.w.w..#.........#.........#
#.........#.x..Y..z.#.........#
#....@....#.........D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Three drips (3,7), (5,7), (7,7) play **Tune D** = low, low, high. Ring it on the bells (2,5) low, (5,5) mid, (8,5) high, or play it on the Starsong: the bridge rises. The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Tide Chimes** (cols 10-20; stage 2): (its own tide, starts high) ring tide stone (11,2) for low water: three drips (14,2), (16,2), (18,2) land on dry stones and play **Tune F** = high, mid, low; play it on the Starsong (the bells (12,8), (15,8), (18,8) are across the pit): the bridge (15,4)-(15,6) rises; exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 21** on a page pinned to
stone (23,3) (moved here from its atlas slot in the Glassway); the scrap jam-jar lamp with the note (27,3): "The drips sang the old tune. I sang it too. Badly. — M"
(`lore.hollow.glassway`; Lore "A note in a Hollow"; `trace:hollow:glassway`); exit `X` (25,10). Built by
S-220b.
Hint: "Drips know a song." / "Listen to the drips: low, low, high. Play it on the bells or the Starsong."
Hint (room 2): "The drips only sing on dry stone." / "Ring the tide stone for low water, listen to the drips (high, mid, low) and play it on the Starsong."

<a id="h19"></a>
### H19 The Cinder Hollow

```map hollow_kettle_1 L1
###########
#....+....#
#____=____#
#____=____#
#a.......a#
#.........#
#....q....#
#.........#
#a.......a#
#....@....#
#####X#####
```

Exit `X` (5, 10). Four high braziers (1,4), (9,4), (1,8), (9,8) and a high bell target (5,6): light all four and ring the bell with embers: the bridge rises. Wave: Ash Moth ×2.

**Stage 2:** the petal sits under a soft-earth mound at (5,1); dig it with the Paws; condition `dug`.
Hint: "Fire up high." / "Fling embers at the four high braziers and the little bell."

<a id="h20"></a>
### H20 The Kettle-Steam Hollow (Deep Hollow)

```map hollow_kettle_2 L1
###############################
#.......99D.._____..#t...*...t#
#.......99#.._____v.#.........#
#.......z.#.._____..#..?...?..#
#.........#.._____..#.........#
#.........#..zzzzz..#.........#
#.........#.._____..#.........#
#.........#.._____..#.........#
#.v.......#.._____..#.........#
#....@....#.._____..f.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Gem bag (9,1) on a ledge (digit 9). Platform (8,3) rises 0 → 9 by valve (2,8), too far to reach in 2 s: stand on the platform and fling an ember at the valve. Wave: Steam Puff ×2. The gem bag no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Boiler Stair** (cols 10-20; stage 2): fling an ember at the valve (18,2) across the pit; 2.0 s later five platforms (13-17,5) rise into a bridge; cross; melt the wax-plug door `f` (20,9) with one ember.
**Room 3 The Reading Nook** (cols 20-30): the gem bag on its pedestal (25,1); **Lamp Log 24** on a page pinned to
stone (23,3) (moved here from its atlas slot in Kettle Isle); the scrap jam-jar lamp with the note (27,3): "Warm enough to sleep. Too warm to stay. Borrowed a little heat. Gave it back. — M"
(`lore.hollow.kettle`; Lore "A note in a Hollow"; `trace:hollow:kettle`); exit `X` (25,10). Built by
S-234b.
Hint: "Some valves are best turned from afar." / "Stand on the brass platform and fling an ember at the valve."
Hint (room 2): "The valve is on the far side. So is the door." / "Fling an ember at the far valve, cross the risen platforms and melt the wax door."

<a id="h21"></a>
### H21 The Dune Hollow

```map hollow_saltglass_1 L1
###########
#....+....#
#.........#
#.........#
#_._______#
#<<<<<<<<<#
#<<<<<<<<<#
#<<<<<<<<<#
#.........#
#....@....#
#####X#####
```

Exit `X` (5, 10). Three west-flowing sand lanes (rows 5-7) and a pit (row 4) with a one-tile bridge (2,4). Crossing the lanes north drifts Pip about 4 tiles west, so start at column 6 to land on the bridge; the petal is at (5,1). Going back, the lanes push Pip against the west wall and he slides down it safely.

**Stage 2:** reliquary over the petal with a receiver lock: hold the Sunglass beam on receiver `R` (9,1) for 1.0 s; condition `lit:[R]`.
Hint: "The sand carries you west as you cross." / "Start crossing the sand lanes from the sixth column from the left. You will land on the narrow bridge."

<a id="h22"></a>
### H22 The Trellis Hollow

```map hollow_saltglass_2 L1
###########
#999___66*#
#999___666#
#999___666#
#999______#
#iii______#
#.........#
#.........#
#.........#
#....@....#
#####X#####
```

Exit `X` (5, 10). Ivy (1-3,5) climbs from the floor onto the west terrace (digit 9). Glide east over the pit (cols 4-6) onto the east ledge (digit 6): gem bag (9,1).

**Stage 2:** reliquary over the gem bag with a receiver lock: receiver `R` on the east ledge at (8,2), lit by the Sunglass from the ledge after the glide; condition `lit:[R]`.
Hint: "Climb, then glide." / "Climb the ivy to the high terrace, then glide east to the lower ledge."

<a id="h23"></a>
### H23 The Sun-Dial Hollow (Deep Hollow)

```map hollow_saltglass_3 L1
###############################
#.........D........R#t...+...t#
#____=____#.b>>>>P..#.........#
#____=____#.........#..?...?..#
#R.I......#________=#.........#
#_........#________=#.........#
#/........#________=#.........#
#.........#.........#.........#
#.........#.........#.........#
#....@....#.........D.........#
#####X###################X#####
```

**Room 1** (cols 0-10; the old map, stage 1; entrance `X` (5, 10)). Receiver (1,4) behind pillar (3,4) over a pit tile (1,5). Mirror (1,6) starts `/`: two hits make it `\`; beam west along row 6 and it turns north into the receiver (latch): the bridge rises. The petal no longer stands
here: the door (10,1) where it stood leads on.
**Room 2 The Dial Court** (cols 10-20; stage 2): push block (12,2) east onto the flow (13-16,2): it rides onto hold plate (17,2); light receiver (19,1) with the Sunglass; the bridge (19,4)-(19,6) rises while both hold; exit door (20,9).
**Room 3 The Reading Nook** (cols 20-30): the petal on its pedestal (25,1); **Lamp Log 30** on a page pinned to
stone (23,3) (moved here from its atlas slot in Saltglass Flats); the scrap jam-jar lamp with the note (27,3): "The sun goes round this dial and never misses a mark. I have missed so many. — M"
(`lore.hollow.saltglass`; Lore "A note in a Hollow"; `trace:hollow:saltglass`); exit `X` (25,10). Built by
S-255b.
Hint: "A sunflower round a corner." / "Bonk the mirror twice, then shine your beam west along its row."
Hint (room 2): "Let the sand carry the block." / "Push the block onto the moving sand so it rides onto the plate, then shine the Sunglass at the receiver."

<a id="h24"></a>
### H24 The Wind-Chime Hollow

```map hollow_driftholm_1 L1
###########
#999...999#
#9+9...999#
#999...999#
#___.u.___#
#___...___#
#___...___#
#___...___#
#___...___#
#....@....#
#####X#####
```

Exit `X` (5, 10). A central column of floor (cols 4-6); the petal ledge (digit 9) in the north-west; pits under it. Updraft (5,4) opens for 6 s when the Starsong plays **low**. Ride it and glide west onto the ledge: petal (2,2).

**Stage 2:** reliquary over the petal; a high brazier `a` on the north-east ledge at (9,1), lit by an ember from the Sling (Kettle Isle); condition `lit:[a]`.
Hint: "The wind here likes low notes." / "Play the low note on the Starsong; the knot-hole blows. Ride it and glide to the ledge."

---

<a id="totals"></a>
## 8. Totals and ledgers

| Dungeon | Realm id | Rooms | Hours | Gem chests | Small keys | Root Key | Tool / prize | Story steps |
|---|---|---|---|---|---|---|---|---|
| d1 Under the Roots | `under_roots` | 11 (9 + 2 annex) | 1.0 | 3 | 2 | yes | Glowbud Lantern | S-059, S-060, S-061, S-060b |
| d2 Whistlehollow | `whistlehollow` | 15 (12 + 3 annex) | 1.5 | 4 | 2 | yes | Leaf Glider | S-103, S-104, S-105, S-104b |
| d3 Undertow Grotto | `undertow` | 16 (14 + 2 annex) | 1.5 | 4 | 2 | yes | Tide Bell | S-124, S-125, S-126, S-125b |
| d4 The Granary Vaults | `granary` | 15 (12 + 3 annex) | 1.5 | 4 | 2 | yes | Thistle Hook | S-145, S-146, S-147, S-146b |
| d5 The Lamplighters' Tower | `tower` | 13 (10 + 3 annex) | 1.75 | 4 | 2 | yes | Sunglass + heart container | S-162, S-163, S-164, S-163b |
| d6 The Rootdeep Heart | `rootdeep_heart` | 16 (14 + 2 annex) | 1.75 | 4 | 2 | yes | Digging Paws | S-183, S-184, S-185, S-184b |
| d7 The Sunken Bell | `sunken_bell` | 14 (11 + 3 annex) | 1.5 | 4 | 2 | yes | Starsong | S-209, S-210, S-211, S-210b |
| d8 The Kettle's Belly | `kettle_belly` | 16 (13 + 3 annex) | 1.6 | 4 | 2 | yes | Ember Sling | S-229, S-230, S-231, S-230b |
| d9 The Buried Academy | `buried_academy` | 16 (14 + 2 annex) | 1.75 | 4 | 0 (3 nameplates) | yes | Ivy Gloves | S-250, S-251, S-252, S-253, S-251b |
| d10 The Spiral Stair | `spiral_stair` | 13 (10 + 3 annex) | 1.25 | 3 | 1 | yes | Cloudstep | S-269, S-270, S-271, S-270b |
| d11 The Ladder of Lights | `ladder` | 16 | 2.0 | 3 | 0 | no | (ten lights home) | S-280, S-281, S-282 |
| o1 The Snowglobe | `snowglobe` | 10 | 1.0 | 2 | 1 | yes | heart petal | S-238, S-239 |
| o2 Grumble's Undercap | `undercap` | 8 | 0.6 | 2 | 1 | no | Spore Rally | S-194, S-195 |
| o3 The Merry Mabel | `merry_mabel` | 9 | 0.75 | 2 | 1 | yes | ship's bell | S-214 |
| o4 The Hundred Lamps | `hundred_lamps` | 10 | 1.25 | 1 | 0 | no | heart petal, hood trim | S-297, S-298, S-299 |
| **Total** | 15 realms | **198** (172 + 26 annex rooms under R14, §5A) | **20.7** (modelled) | **48** | 20 | 12 | | |
| 24 Hollows | `hollow_*` | 24 (8 of them 3-room Deep Hollows) | 3.15 (16 two-stage × 4 min + 8 Deep × 16 min) | 0 | 0 | 0 | 16 petals, 8 × 60 gems | see [§7](#hollows) |

- **Gems:** 48 dungeon chests × 40 = **1,920** and 8 Hollow bags × 60 = **480** (CANON §10.4 ledger lines).
- **Hearts:** the Tower's heart container; petals from 16 Hollows + the Snowglobe + the Hundred Lamps = 18 of the 24
  (the other 6 are activity tiers, [side-content.md](./side-content.md)).
- **Hours** (modelled per CANON §11, review 2026-11-22; the old column priced about one simple beat per room at about
  twice its content): story dungeons d1-d11 come to 17.1 h inside CANON §11's main-story 40 h (d1's two-room
annex adds 0.25 h that CANON §11.1 A2, written for d2-d10, does not list yet), **after** each of
  d2-d10 grows by 2-3 rooms under the depth rule R14 (≥ 1.6 puzzle beats per room, ≥ 4 compound rooms, one mid-dungeon
  state flip that changes 2+ earlier rooms, and a final "everything you learned" room before the boss door; CANON
  §11.1 A2); the act-closer bosses run 120-180 s (A8). o1-o3 (2.35 h) plus the 24 Hollows (3.15 h: every Hollow has a
  two-stage puzzle and one per Act II-III land is a 3-room Deep Hollow, A3) make CANON's 5.5 h optional bucket; the
  Hundred Lamps (1.25 h) sits in the 6.5 h post-game. `tests/hours.test.js` (S-078b) recomputes these from the maps.
- **Enemy species used in dungeons** (ids, creatures.md defines them): home `slime`, `bat`, `crab`, `snowpuff`;
  `dimling`, `mossling`, `pinecone_puff`, `bark_beetle`, `needle_wasp`, `tidepool_jelly`, `squirt_urchin`,
  `sand_snapper`, `field_vole`, `scarecrowlet`, `woolly_ram`, `sizzle_beetle`, `coco_clonk`, `glow_grub`, `drip_bat`,
  `pebble_mimic`, `bubble_puffer`, `gullgrab`, `soot_snuffle`, `steam_puff`, `ash_moth`, `sandsnoot`, `prickle_pear`,
  `sun_beetle`, `dust_puff`, `nimbus_puff`, `gust_kite`, `stardust_sprite`, `comet_pup`, `moonbeam_turret`,
  `wisp_lantern`. (Hushlings live only in Moonmere.)
- **Save:** one `S.dungeons[id]` object per realm id above (v8 container, [§3.1](#state)); Hollows in
  `collect.hollow` (v9). No save version bump comes from this file.
- **Flags this file sets or reads** (the dictionary lives in [systems.md](./systems.md#conditions)): reads `wennaAwake`,
  `pinewhistleDepths`, `archwaterDepths`, `threemillsDepths`, `towerOpen`, `bellDepths`, `kettleDepths`,
  `academyDepths`, `mainEnding`; sets `S.dungeons.<id>.done` on each Warden or boss calmed, `ladderLight:1`-`10`,
  `starSplinter`, `undercapLit`.

<a id="map-test"></a>
### 8.1 The map test

S-049 adds `tests/dungeon-maps.test.js`, which reads every ` ```map <id> <level> ` block in this file (copied into the
repo at `docs/roadmap/bible/dungeons.md` by S-002) and checks: rows padded to equal width; only base-legend glyphs and
that dungeon's declared extension glyphs; every door glyph has a room on each side (or the outside, for `X`); the
flood-fill room count equals this file's room table (annex levels `LA`/`LB` of §5A are counted with their dungeon; a
Deep Hollow's composite counts 3 rooms); gem-chest counts sum to 48 across d1-d11 and o1-o4; 16 `+` and 8
`*` across the Hollows. Each dungeon step then asserts its `js/realms/dungeons/<id>.js` composite is **identical** to
the block here (so the data is copied, not paraphrased).

---

<a id="decisions"></a>
## 9. Decisions made here

CANON leaves these open; this file decides them. Each is final unless the owner or a later CANON edit says otherwise.

1. **Format extensions.** Composite maps per level with room boxes read from them; levels side by side joined by
   `^` stair warps (0.35 s fade), including **hatches** (a `^` with a condition) and one locked hatch (d5). Base glyphs
   added to ENGINE §3.2's example: `O` open arch, `&` map chest, `%` Chime Stone chest, `$` treasure chest, `H` heart chest,
   `+` petal, `*` gem bag, `r` reset lever, `I` pillar, `?` sign, `!` beacon / great lamp / borrowed light, `~` deep
   water, `w` shallow water, `=` plank. `,` is the tide floor here (ENGINE's example used `,` for "floor 1";
   digits replace that). `X` may stand on a floor tile as a stair-portal (d10's plaza). Digits are
   per-tile heights of 0.3 m; d10's r10 alone uses 0.6 m digits with smooth ramps.
2. **Height of entity tiles** = the most common floor height among their 8 neighbours, ties upward.
3. **Pits and deep water** put Pip back on his last safe tile with no damage (no fall damage indoors).
4. **Reach rules** (§1.2): hop gap 1 tile; glide 2/3/4 tiles for drops of 1/3/5 digits; hook 7 tiles; climb ≤ 6 m;
   Cloudstep one extra hop per mote; beam 9 tiles; Sling 12 tiles; Lantern 3 tiles. Pip and enemies never block
   beams.
5. **Chest counting:** only `c` gem chests (40 gems) count toward the 48 and the Completion row; map, Chime Stone, big
   key, treasure and heart chests are story chests. d1-d10 and o1 have map and Chime Stone; o2 and o3 have a map only;
   d11 and o4 have neither.
6. **Enemy respawn:** waves respawn only when Pip re-enters a dungeon from outside; `clear` doors stay open; at most 4
   alive per room.
7. **Glowbud doors** open for good in full lantern light of their listed lanterns, or with the held Lantern within 3 m;
   `lanternOnly` doors need the Lantern.
8. **Toggle plates** (d2): each step flips listed updrafts; plates elsewhere are hold-type.
9. **Hay bales and push-ice fill pits** they are pushed or slide into; reset levers lift them back out.
10. **Tide rules:** basins per room group; conch shells (sword) before the Tide Bell, tide stones after; a tide change
    never strands Pip; a block on a `,` tile at high water is a stepping stone.
11. **Gear-bridges** carry a hub wheel usable while standing on the hub; cranks may sit in a neighbouring room joined by
    a visible chain.
12. **Mirror cycle** `/` → `|` → `\` → `-` per sword hit; receivers live unless latch; AND-latches for two receivers.
13. **Light-roots** last 20 s (12 s on o4 F6); a root can have a buried tip that must be dug first.
14. **Sound rules:** pitch doors open within 6 tiles; song doors need ≤ 2 s between notes; speaking tubes; notes
    coloured low rose `#f4a6c0`, mid gold `#ffd36b`, high sky `#8fd3ff`, pitched G3 / B3 / D4. Dungeon tunes: **A**
    "the Clam Song" low-high-mid, **B** "the Drip Hymn" mid-mid-high, **C** "the Clam Round" high-low-high (o4),
    **D** low-low-high (Bell Hollow). Clams and drips teach tunes but never open doors.
15. **Steam valves** move their platforms 2.0 s after turning; "high" braziers hang at 3 m and take embers only.
16. **Sand-flow** is 6 m/s and carries blocks to the first non-flow tile.
17. **d9 uses nameplates instead of small keys:** "A. Wick", "Pelagia", "F. Ashmoth". **F. Ashmoth** is a new minor
    name (a Lamplighter student of the Academy's last class, never seen); add it to the charter glossary.
18. **Song clouds** stay solid 8 s; **solo** rooms (d10 r5, o4 F9) allow one colour at a time.
19. **Twinkling rungs** (`o`, d11): `[E] Kindle · Rung`, at most 3 lit, no timer.
20. **The Ladder's floors:** F2-F5 the four Act II beacon lights (Wickhaven's window, the Whistling Pine, the Great Arch,
    Tumble Hill's granary); F6-F11 the lights Mote gathered (Woods fireflies, Forgefall sparks, moonlight from
    puddles, Grumble's glow-moss, the lighthouse gleam, star splinters); F12-F15 mixed; F16 the Crown door. The
    Firstlight is **not** freed in the Ladder: it returns to Granny Wick in the finale (CANON §4.6). The star splinter
    for ss-39 is pocketed on F11 (flag `starSplinter`); its handover stays where side-content.md puts it. After the
    main ending the Ladder realm closes and any unopened Ladder chest moves to the Crown's boughs.
21. **The Hundred Lamps' name** is literal: ten lamps per floor, 100 in all; it opens after the main ending from a
    spiral door below Tower Head, with Granny Wick's line "Light's for passing on, dear. Go and pass some."; its levels
    carry per-level legends; its "harder" numbers are 12 s roots (F6), 10 s shutters (F7), one valve for two platforms
    (F8), lanes with solo clouds (F9), and later-land enemy mixes. Its hood trim is named **"Lamplighter's Gold"**.
22. **Hollow prizes per Hollow** as in the §7 table; Hollow tools never exceed what exists when the Hollow's step
    ships. Archwater's "mirror pool" Hollow is a reflection-sequence plate puzzle (no beam mirrors exist before S-162).
23. **Hollow ids** `hollow_<land>_<n>`, files `js/realms/hollows/<land>_<n>.js`, grid 48 m.
24. **Room and sign names** in this file (every room name, sign text and the minor props named in them, e.g. "the
    Clam Choir", Mote's "KEEP OUT. (Please.)" sign) are new canon at the "minor" level; the charter's glossary
    index should list each dungeon file's room names under "dungeons.md".
25. **Item-get lines** for the ten tools are written here as defaults; [systems.md](./systems.md#items-tools) wins on
    control prompts (for example the Starsong's three-note input) if it differs.
26. **o2 entrance** is a soft-earth mound between Grumble's Crown's roots (dug with the Paws); **o3** ships as one
    step (S-214) and may split Bosun Snore into a follow-up PR if over 500 lines.
27. **Story gates read from flags** `pinewhistleDepths`, `archwaterDepths`, `threemillsDepths`, `bellDepths`,
    `kettleDepths`, `academyDepths` (set by each land's last "people" step; story.md and systems.md should adopt these
    names or rename them here in the same PR).
28. **The map test** (§8.1) is added by S-049 and keeps this file and the data in lockstep.
29. **Depth by annex, not by redrawing** (R14, §5A). Each story dungeon's extra rooms are annex levels joined by stair
    warps, so no §5 wall moves and the §5 steps ship unchanged; the flip changes earlier rooms only through entity
    states; the boss door's second bar (the Warden's latch) is what forces the loop back through them. Tile edits to
    the §5 maps are listed per dungeon and applied by its depth step. d1 is included (11 rooms, its own thresholds).
30. **Deep Hollows are composites** (§7): one 31 × 11 map per Deep Hollow replaces the one-room map in the same block
    id; room 3 has its own exit so nothing is backtracked. Each Deep Hollow takes the land's highest-numbered found Lamp
    Log; ordinary Hollows put the prize under a reliquary.
