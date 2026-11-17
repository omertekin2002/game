# WP9: world and content at eye level

Owner files: `js/world.js`, `js/world-const.js` (unchanged), `js/props.js`, `js/models.js` (unchanged),
`js/world-mod.js` (module `wp9-world`), `TUNE.world` in `js/tune.js`, NPC dialogue / `SIGNS` / `DOOR_LINES` in
`js/data.js`, `js/debug/tests/wp9.js`, this file. **No edits outside these files** (no foreign edits; the pose table
in `js/debug/debug.js` still fits the re-laid plaza, see §5).

The package was built in two sittings: the first engineer laid out most of it; the second finished, reviewed and
reworked it (landmark skyline, cairn, trails, shop sides, crown silhouette, tests, docs). Review round 1 (22 findings)
was fixed in a third sitting; §8 lists what changed and why.

## 1. What a player sees now

- **Great Tree, 19.8 m** (`W.greatTree.scaleHeight`, ×2.2 of the 9 m GLB). The procedural fallback (no GLB) is built
  at the same height. A crown extension hangs off the tree group (`scenery.greatTree.group`), shaped as **one dome**:
  ~13 olive side/back pads that sit lower and smaller the further they are to the side (no "bear ears"), 4 top pads, a
  3-lobe crest over the face and one central top lobe, the crown's highest point (≈ 1.0 H). The hanging leaf cards
  (`gt_foliage_card` and `_b`, one 512² canvas, alpha-tested, swaying) are single cards facing out from the trunk with
  a little random yaw, tinted toward the canopy's olive green (they read as drooping leaves, not ochre grape bunches);
  one per 12° bearing along the GLB canopy's measured rim (face sector clear) and two of every three pads. 12 lanterns
  (10 under the rim, 2 at the back), red mushrooms and moss between the roots. The GLB's **second face** (north side,
  measured: eyes ≈ 0.39 H, mouth ≈ 0.34 H, |x| < 1.8 m) is under a moss mantle (25 pads just outside the outermost bark
  vertex of each patch), three rows of foliage curtain cards and ivy: walking round the tree you meet a mossy trunk. At
  night the lanterns glow (halos share `game.halos.uScale`). After the ending the pads swap to a lush blossoming variant.
- **Plaza re-layout.** Plaza radius 16 m (flattened 18–24 m, paved disc ≈ 13.5 m, `W.plazaMask`). The altar sits at
  (0, 7.3), just south of the root tips; spawn (0, 13) faces the tree, so the first view is the tree's face with the
  crown above the frame: you look up. Plaza lamps stand on a 16 m ring. Shellby stands beside the altar, Ribbit moved
  out of the root mound. Bunting runs from the four plaza lamps up to the trunk and between neighbouring lamps
  (2.2–6 m), never across the tree's face in the spawn view: a south lamp's trunk end goes round to the side of the
  trunk (≥ 75° off the face) and there is no lamp-to-lamp string across the south. The multi-arm signpost stands at the
  plaza's south edge and reads from every side (no front half-plane: its arms are painted on both faces). The paved
  disc carries no grass, pebbles or flowers (scatter skips every cell where `W.plazaMask` > 0.3).
- **Altar** (`pedestal` prop): socket surface at 1.05 m. A brick ring and a stone column carry a slab tilted 0.68 rad
  (39°) toward the south approach; a darker recessed panel holds three gold-rimmed star sockets, each with a pulsing
  glow star that hides once its Starseed is placed; a leaf crest runs along the slab's high edge. Its collider is a
  **circle of r `TW.pedestalR` (1.02 m)** round the brick ring and the slab corners (the mesh is ≈ 1.0 m out in Pip's
  body band at every bearing): Pip stops 1.34 m from the centre from every side, the FP eye 0.32 m clear of the slab (r2).
- **Region landmarks** (one per region, own RNG stream, colliders declared through `addProp(…, { collider })`,
  `userData.cull = { dist: Infinity }`, `userData.landmark = id`). Their materials cap the fog at
  `TUNE.world.landmarkFogCap` (0.45, art §4.5), so their colours read on the skyline at any distance; each has a
  night glow (spots, crystal, lamp room, windows):
  - *Grumble's Crown* (woods), 21 m: a giant purple mushroom with gold spots and a little gold crown, behind the woods
    arena, **≥ 0.42 rad off the boss in both intro views** (W.shots camera and the entrance; it shares Grumble's purple
    and gold): placed after scatter where its own path sees it best (`skyScore`, real trees), trees inside its stem ring
    are taken out. Baby mushrooms and moss sit on its root flare, inside the collider ring.
  - *Summit Crystal Cairn* (peaks), 15 m: five snow-capped stones and a frost-blue crystal cluster, with two rings of
    blue / white pennant garlands wrapped round the stack. It stands on the highest terrain cell (100, −48) that is
    ≥ 12 m off the path, ≥ 22 m from a chest and ≥ 7 m from any reservation (the heart-chest nook walkway), whose
    needle tip is rounded off into a small cap (`flattenDisc`, r 2.4 m) so no stone overhangs thin air. (The first
    version had a pennant rope to a post that floated in the air off the summit; removed.)
  - *Pinch's Lighthouse* (shores), 18 m (authored at 16 m, scaled uniformly): cream and coral stripes (seven 1.55 m
    bands, hard-edged: the tower lathe has a ring at every stripe edge and each face takes one colour), a gallery and a
    glowing lamp room; its night beam is two additive 70 m cones sweeping at 0.2 rad/s. **It stands on the beach by
    Pinch's cove** (seed 7151: (8.5, 117), 8 m off the shores path, 30 m from the arena centre), chosen after scatter as
    the coastal spot (signed coast distance ≤ 14 m, 8–40 m off the path) its path sees best, ≥ 0.6 rad off Pinch in
    the intro views. Deviation from art §4.5 ("on islet 2"): on the islet it read only from ~1 of 6 path frames (palms,
    88–141 m), so the shores had no skyline; islet 2 is the fallback when no spot qualifies.
  - *Meadow Windmill* (meadow), 15 m (authored at 13 m, scaled uniformly): an octagonal tower with four canvas sails
    turning at 0.35 rad/s, west of Digby.
  - Skyline check (`G.debug.wp9.losLandmarks()`, every 4th sample of the landmark's own path ≥ 20 m away). `reads`: the
    rays to 0.95 H and 0.6 H are both clear and that span is ≥ 40 px tall at 1080p — tree 0.73 (all paths), woods 0.61,
    peaks 0.75, meadow 0.53, shores 0.87. `path` (any clear ray to 0.8 H, the old metric): 0.85 / 0.78 / 0.79 / 0.79 /
    1.0.
- **Village at eye level.** Every house and the shop is dressed on all four sides:
  - Low windows (centre 1.1–1.2 m, sill ≈ 0.75 m) carry `interiors` room cards (fireplace, kitchen, bedroom,
    library), dimmed by day and emissive at night. The shop now has a window with a flower box on each side too.
  - Stone steps reach the ground; each door has a plaque.
  - Backs: woodpile, barrels and a laundry line with pastel cloths; sides: flower boxes and ivy.
  - The shop has an outdoor counter, top **0.57 m** (`SHOP_COUNTER.top`), with Miso behind it under the green / cream
    awning (8 stripes of 0.375 m, one box segment and one colour per face, each running on into its valance scallop)
    and a kitchen window behind her. The goods stand at the two ends (bread and a honey jar left, a potion row and
    the shiny sword right, a basket of apples on the left crate), so the middle metre in front of Miso is clear: from
    the 0.88 m FP eye her whole face shows over the counter at 1.6 / 2.4 / 3.5 m (95–97 % of her face pixels; the old
    0.7 m counter with goods in front showed only her eyes or ears).
  - House B's east diagonal brace sits on the window-free half of the wall (it used to run into the side window).
  - The well rim is at 0.62 m and the water at 0.42 m; a frog on a lily pad turns toward Pip and waves on
    `EV.INTERACT { kind: 'well' }`. Its two posts stand on the rim and carry a pitched roof up to the ridge beam (r3).
- **Signs you can read.** Board text comes from CanvasTexture atlases (text 512², icons 256²; Fredoka once
  `document.fonts` has it, region icons from `ui_icons` with drawn fallbacks): the signpost (4 arrow arms, text on both
  faces, each pointing down its path), the village sign and the three arena signs (post moved behind the board), and
  the waymarker plaques (region icon on both faces).
- **Regions.**
  - Pine skirts raised: lowest underside 1.95·s m (≥ 1.55 m at the smallest scale), bare trunk under it, lit-looking
    underside; declared `{ h: 6.1, cam: 1.9 }`.
  - Woods: 3 clearings (6.5–9 m) with grassy, flowery floors (the splat swaps forest floor for grass / meadow) and a
    stump ringed by 9 glowing mushrooms (a fairy ring, magical at night). Each is joined to the woods path by a
    **winding game trail** (two bends, spline-sampled every 0.6 m, never into a boss ring, the bend that meets the
    fewest props wins) that is drawn as a narrow dirt line in the splat and kept free of trees by scatter; two stones
    mark where each trail leaves the path.
  - Waymarker posts every 30 m along the four paths (a rejected slot slides up to ±8 m along the path, then tries the
    other side; slope ≤ 0.75): seed 7151 has 9 (woods 30 / 60, peaks 22 / 60, shores 30 / 60 / 90, meadow 30 / 60),
    then the arena sign. Path-edge stones line both edges within 45 m of the plaza and 14 m around every bridge end.
  - Path lamps every 18 m from 16 to 62 m (none on or beside a bridge), a pair at the ends of the river bridge. All 17
    lamps are drawn by world-mod.js as one island-wide instanced mesh + outline (2 draw calls, never culled):
    `PROP_KIND` (props.js) has no `lamp` any more, so scatter.js skips them.
  - Meadow heart chest: a ring of tall sunflowers (1.35–1.75 m) with a gap toward the nearest path.
  - Arena edge rings at the fight clamp radius (`a.ring.R = a.r + 0.02`, where Pip's body stops): mossy stones and
    glowshrooms (woods), grey snow-capped stones with ice shards (peaks), sandstone and shells (shores). **Every stone
    outside the entrance gap is a low collider** (kind `arenaring`, r 0.27), so outside a fight Pip enters only through
    the entrance and never walks through a stone (walking at the ring from outside stops him 0.5 m out). On the seeds
    where the foundation's only way to a target (a heart-chest nook) crossed a ring, `openRings` opens that ring where the
    old way crossed it (±0.3 rad, no colliders, no stones) before any corridor is carved. The entrance segment rises on
    `EV.BOSS_INTRO` / `EV.BOSS_FIGHT` and sinks on `EV.FIGHT_END` (hidden, not drawn, while sunk).
- **Coin chests** (ids `coin_0…coin_9` unchanged) are placed after scatter, 8–40 m from the nearest path (true distance
  field) in a flat clear pocket **that Pip can already walk to** (a BFS of the walk grid before they are placed); the spot
  least visible from path points within 30 m wins (eye 0.9 m → chest 0.55 m through terrain, trees, boulders and
  houses). Own RNG stream. Seed 7151: 14.0–39.2 m off-path, 9 of 10 invisible from the paths within 30 m.

## 2. Interfaces (C6 and the rest of `W`)

| Field | Shape / meaning |
|---|---|
| `W.pedestal` | `{ x, z, y (ground), top: 1.05 (m above y of the socket surface), tilt: 0.68 (rad, slab normal (0, cos, sin) toward +Z), r: 1.06, sockets: [{ x, y, z }] }`. Socket i at x + (i − 1)·0.58, y + top, z + 0.05 (what cutscenes.js uses today) |
| `W.greatTree` | `{ x, z, y (base), height: 19.8, scaleHeight: 19.8 }` (`scenery.greatTree.height` agrees, GLB or fallback) |
| `W.landmarks` | `[{ id, name, region, x, z, y, height, rot, prop? }]`: `great_tree` (village, 19.8), `woods` (21), `peaks` (15), `shores` (18), `meadow` (15). `prop` is the collider prop (not on the tree row). Every landmark stands in its own region (the lighthouse on the shores beach). Rows are pushed in placement order: tree, peaks, meadow, then woods and shores (placed after scatter) |
| `W.shots` | camera hints `{ pos: [x,y,z], look: [x,y,z] }`: `place` (low 3/4 on the altar, trunk behind), `ending` (look up the trunk), `endingCrane` (pull back to frame the crown and village), `spawn` (first look up at the crown), `bossIntro.{woods,peaks,shores}` (from inside the entrance onto the boss). All rendered and checked (`r2/h.jpg`) |
| `W.plazaMask` | `Float32Array(N·N)` (splat indexing `k = j·N + i`): 1 on the paved plaza (r ≈ 13.5 m, ±1.2 m noisy edge), for WP8's cobble splat |
| `W.pathF`, `W.pathFAt(x, z)` | true distance to the nearest path sample everywhere (two-pass 5×5 chamfer). `pathD` stays the rasterised field |
| `W.trailD` | `Float32Array(N·N)`: m to the nearest woods-trail sample within 4 cells, 99 elsewhere (scatter + splat) |
| `W.woodsGaps` | `{ clearings: [{ x, z, r, ring: { x, z } }], trails: [[{ x, z }, …]] }` (trails spline-sampled every 0.6 m, clearing → path); `W.inWoodsGap(x, z, w)` |
| `W.signpost` | `{ x, z, y, rot, arms: [{ id, name, yaw, y }], prop }`; its `interact` entry (`signpost: true`) has no `prop` on purpose (readable from every side) |
| `W.waymarkers` | `[{ x, z, y, rot (path tangent), region, prop, d (m along the path) }]` |
| `W.arenas[id].ring` | `{ R (a.r + 0.02), n (stones), gap (rad, entrance half-width), open: [bearings opened by openRings] }` |
| `W.skyPick` | placement record of the post-scatter landmarks (`woods { v, removed }`, `shores { v }`) |
| `W.skyScore(x, z, y0, H, pts)`, `W.introOff(arena)` | the skyline score and the boss-intro angle rule both placement and tests use |
| `W.edgeStones` | `[{ x, y, z, s, rot, k }]` (drawn instanced by world-mod.js; no collision) |
| `W.coinPicks` | `[{ id, pathD, visible }]` (placement record) |
| `W.genT` | per-phase generation ms (`terrain, shape, pathField, places, scatter, coins (skyline landmarks, coins, path dressing), reach, splat`) |
| `W.rootRAt(ang)` | root-mound radius toward a bearing (0 = +Z), from `TUNE.world.rootR` |
| `W.nookOk(p, side)` | generation only (r3): would the peaks heart-chest nook at path point `p` on `side` stay open without a carved corridor (§10). Draws nothing, leaves the terrain as it found it |
| unchanged shapes | `W.arenas` (+`entAng`, `entrance`, `outside`), `W.shop { x, z, y, rot }`, `W.spawn`, `W.plaza { x, z, r, h }` (r is now 16), `W.lamps` (props with `rot`), `W.npcSpots`, `W.houses` (+`n`), `W.chests` |

New prop types and collider kinds (WP3: all declared, nothing baked from `COLLIDER_H` defaults):
- `lm_mushroom` r 3.29 h 21 cam 11.55, `lm_cairn` r 2.75 h 15, `lm_lighthouse` r 2.36 h 18, `lm_windmill` r 2.65 h 15,
  eye = r + 0.2 each. Radii come from `props.js LANDMARK_R[id](H)` (the model's widest part between 0.5 and 1.5 m plus
  a margin; checked by the suite). Drawn by world-mod.js, so scatter skips them (not in `PROP_KIND`).
- `signpost` r 0.22 h 2.3, `waymarker` r 0.16 h 1.25 (drawn by world-mod.js, one instanced mesh island-wide),
  `sunflower` r 0.14 h 1.55 (scatter-instanced as `PROP_KIND` `bush`).
- Collider kind `arenaring`: one per edge-ring stone, r 0.27, `decl { h: 0.45, cam: 0.45, eye: 0.3 }`, `arena: id`.
- `pedestal`: `{ r: TW.pedestalR (1.02), h: 1.35, eye: 1.15 }`, a circle (r2: the round mesh was declared as a 0.92 × 0.52
  box, which WP3 keeps exact, so Pip walked 0.48 m into it from the north and south).
- `tree_pine` / `tree_snow`: `DECL` in world.js gives every one `{ h: 6.1, cam: 1.9 }` (raised skirts).
- Collider kind `gtroot`: the Great Tree root mound, 24 bearings × 1–4 circles of r 1.1, `decl { h: 2.4, cam: 2.4,
  eyeAdd: 0.2 }`. The tree core stays kind `tree`: r 4.2 from world.js, which `fitTreeColliders` shrinks to its 3.4 m cap
  once the GLB is built (no gap: the `gtroot` ring starts at 2.7 m); the fallback tree keeps 4.2.
- Collider kind `counter`: the shop counter and its end crates, `decl { h: 0.82, cam: 0.82, eye: 0.5 }`.
- Collider kind `dressing`: house back dressing (woodpile, barrels, laundry posts; `HOUSE_DRESSING`), `decl { h,
  eyeAdd: 0.12 }`; inside today's footprint circles, so they stay solid when WP3 fits boxes to the houses.

props.js exports for others: `ALTAR`, `WELL`, `SIGN_BOARD`, `WAYMARK_PLAQUE`, `HOUSE_WINDOWS`, `HOUSE_DRESSING`, `SHOP_COUNTER`,
`LANDMARK_R`, `landmarkParts(id, H)` → `{ main, spin?, lamp?, beam? }`, `waymarkerModel()`; `greatTreeParts()` builds at
`TUNE.world.treeH` and returns `height`.

Module `wp9-world` (js/world-mod.js):
- `attach`: builds everything; each builder is wrapped (a failure is recorded in `stats.<name>Error`, never breaks boot).
- `onSession(isNew)`: old-save repair. A Continue whose saved position is now inside a collider (static or dynamic) or
  unwalkable moves Pip to the nearest free spot within 14 m (else to the spawn) and records `moved`.
- `beforeCamera`: animation (windmill, beam, socket pulse and fill state, frog, arena gates, bloom swap). Each animator
  runs in its own try / catch: one that throws is dropped (`stats.animError`, one `console.warn` with `?debug=1`) and
  the rest keep running. The socket pulse writes toon.js's internal `mat.userData.glowK` only while it exists (WP7 owns
  toon.js). The frog is not drawn beyond 30 m (its C10 distance).
- **C10 culling (r2).** Two kinds of objects, two rules:
  - `cullTag(o, dist, fade)`: an object that stands at its own origin (a group placed where it stands: the arena rings
    130 m, the frog 30 m; landmarks, crown and lamps `Infinity`). Only `o` carries the distance; its children are tagged
    `{ dist: Infinity }` (never tracked on their own: they ride on the group's visibility and fade), and an instanced
    mesh is always tagged `Infinity` (WP7: no instanced mesh in the generic culler).
  - `spanCull(o, pts, dist, gate?)`: a mesh built in **world coordinates** (its origin is the world origin, not where
    it stands): WP7's culler measured such meshes from the plaza and its scale fade shrank them toward it. It is tagged
    `{ dist: Infinity }` (never in the generic culler) and the module's **`afterCamera`** hook draws it only while the
    camera is within `dist` of its *nearest* part (`pts = [x, z, …]`) and `gate()` agrees; `G.debug.perf.cull(false)`
    (`scenery.cullOff`) draws them all. Used by: edge stones 70 m (no fade), waymarker posts and plaques 90 m, sign
    boards 120 m (from every board and the signpost), the signpost 90 m, window cards 110 m (from every house and the
    shop), bunting 90 m, light pools 120 m (gate: night), socket glows 60 m. A world-space mesh never gets a fade.
- Event subscriptions: `EV.INTERACT` (well), `EV.BOSS_INTRO` / `EV.BOSS_FIGHT` / `EV.FIGHT_END` (arena gates).
- No new events, no sounds, no settings.
- Materials: `capFog(mat, cap)` (module-local) patches only the landmark material and its own outline material (new
  program key `…|fogcap`); if another package rewrites `ShaderChunk.fog_fragment` so the pattern no longer matches, the
  material is simply left uncapped. Arena rings use their own uncapped material.

`TUNE.world` keys: `treeH`, `rootR[12]`, `plazaR`, `plazaFlat[2]`, `pedestalZ`, `pedestalTop`, `pedestalTilt`, `pedestalR`,
`socketDX`, `spawnZ`, `lampR`, `lampEvery`, `lampFrom`, `lampTo`, `waymarkEvery`, `edgeStoneR`, `edgeStoneGap[2]`,
`edgeStoneOff`, `coinPathD[2]`, `landmarkH{woods 21, peaks 15, shores 18, meadow 15}`, `landmarkFogCap` (0.45),
`crownLobes`, `crownCards`, `lanterns`, `socketPulse`, `windmillSpin`, `beamSpin`, `signPx`.

Debug (`G.debug.wp9`):
- `info()`: gen ms per phase, carved, unreachable, lamps (and how many stand on bridges), coin picks, counts, landmarks,
  crown parts, build stats, old-save move.
- `objects()`: the module's scene objects (now with `lamps`; `crown` has `lobeList`, `mantle`; `buntingStrings`).
- `signInk()`: sign atlas coverage (headless non-blank check).
- `losCrown({ step = 8, h = 0.9 })`: the world mapper's Great Tree metric (walkable grid points ≥ 15 m away).
- `losLandmarks({ h = 0.8, step = 4, px = 40 })`: per landmark `{ path, reads, n }` (see §1).

## 3. Text (C7 tokens)

Every NPC line, `SIGNS` entry and `DOOR_LINES` entry was rewritten for eye level: no screen arrows, compass words and
landmarks you can see, tokens `{interact}`, `{attack}`, `{jump}`, `{dash}` (WP6 formats them; without WP6 the raw token
shows).
- **Shellby** teaches the Great Tree as "the tallest thing on the whole isle", the compass ("your compass up top knows
  the way home too"), the pedestal and the signpost.
- **Ribbit** names the four landmarks. **Hoot**: "HOP right over it with {jump}, or roll straight through with {dash}"
  (shockwave). **Clover**: "Follow this path south to the sea. Captain Pinch's cove is at its very end, just past the
  striped lighthouse on the beach" (true now: from her spot both lie ahead, the lighthouse nearer, ≈ 0.16 rad apart);
  a glowing stripe — "sidestep out of it, or {dash} sideways" (Pinch's charge); the crab guard breaks on "a big third
  swing" (the C chop). **Digby**: "When a pillar of light shoots up around you and something whistles overhead, LOOK
  UP! Then roll out of the glowing circle with {dash}" (Frostbun, WP5's sky pillar); he also names the sunflower ring
  and "the little islet off the western beach", and hints that chests hide where paths cannot see them.
- `SIGNS.peaks`: "East over the river bridge, toward the crystal twinkling on the summit" (a direction: the summit is
  not reachable). `SIGNS.shores`: "South to the sea and the striped lighthouse" (now where the path goes).
- The dialogue says **pedestal** like the crosshair prompt ("Look · Pedestal", targeting.js) and interact.js (WP4) and
  the controls card (ui.js, WP6). The model looks like an altar; renaming the word is a later, all-package decision.

## 4. Generation (deterministic per seed; `world.unreachable.length === 0`, carved 0)

Order: `layout, baseTerrain, flattenAreas, makePaths, carveWater, stampPaths, detail, computeSlope, computeRegions,
pathField, placeVillage, placeArenas, placeSpecial, placeLandmarks, placeWoodsGaps, placeArenaRings, scatter,
placeSkyline, placeCoins, placePathDressing, reachability (+ openRings), computeSlope, computeSplat, buildColliderHash,
publishAnchors`. WP9's own placement uses its own RNG streams (`seed·13+5` landmarks, `seed·17+3` woods gaps,
`seed·31+17` coins, `seed·7+11` dressing) or none.

**The main stream draws exactly what the foundation drew (the scatter shadow).** Every draw the foundation made before
and during scatter is made in the same order with the same values: the 12 old lamp rotations, the old flower-ring deco
and bush rotations, the old coin-chest loop (now a ghost: same draws, its chests kept as ghost reservations and
colliders), the plaza flower draws (positions moved out to the new plaza edge), and in `scatter()` every decision that
decides what is drawn uses the foundation's state: its terrain before WP9's summit cap (`fnd.H / fnd.S`), its
reservations (`reserveCircle(…, t)`: 0 shared, 1 WP9 only, 2 the foundation's only = ghost; `fReserved`), its solids
and colliders (`solidBits` / `collBits`: WP9's own carry `wp9`, the foundation's removed ones are ghosts in `_gh` /
`fnd.cols`). WP9 then gives its own verdict on each prop the foundation placed (its reservations, props, colliders,
woods trails and clearings, the paved plaza): a rejected prop becomes a ghost so the rest stays in step; WP9 never adds
a prop where the foundation had none, and decoration it adds (clearing floors) takes scale / rotation from a position
hash. Result for seed 7151: 1277 of WP9's 1280 scatter-type props are the foundation's, at the same position with the
same rotation (the 3 others are the clearing stumps); the 52 it leaves out are its deliberate gaps (44 woods trails,
clearings and the mushroom's stem ring, 1 summit, 7 windmill / sunflower ring). Seeds 42 and 31337 behave the same, and
the decoration stream ends identical. Goldens need re-baselining only where WP9 changed things on purpose.
`baseTerrain` skips the inland noise for sea / beach cells and the village noise where its weight is 0 (bit-exact).
During scatter `isReserved` (pad ≤ 0) and `collBits` use 8 m grids built once (nothing is reserved or collided-with
added while it runs).

Carving: 0 corridors on 335 seeds (1–330, 42, 99, 1234, 7151, 31337; r3). Four rules keep it so: the cairn keeps clear of
the heart-chest nook and its walkway, coin chests go only into pockets Pip can already reach, `openRings` opens an arena
ring where the foundation's only way to a target crossed it, and the peaks heart-chest nook is only placed where
`nookOk` says it stays open (r3, §10).

## 5. What in docs/ARCHITECTURE.md is no longer true

- §9: the Great Tree's colliders are a `tree` core plus a `gtroot` ring (not 5 ring `tree` circles). New collider
  kinds `gtroot`, `counter`, `dressing`, `arenaring`, all with `decl`. The pedestal is declared as a circle (r 1.02). Pines declare
  `h 6.1 / cam 1.9` (the `COLLIDER_H.tree_pine` comment "(1.6 after WP9)" is 1.9, declared per prop). Landmarks are
  declared per prop (`lm_*`).
- §6 "WP9 sets `scaleHeight`": set (19.8); the procedural fallback is built at that height too.
- §17 poses: `spawn` / `village` / `plaza-*` are now at (0, 13), `tree` at (0, 17); all still valid (no table edit).
  `hilltop` stays at (84.5, 32.5) (the cairn summit is not reachable).
- §2: waymarkers and lamps are not instanced by scatter.js (world-mod.js draws each as one island-wide instanced mesh;
  `PROP_KIND` has no `lamp`). `PROP_KIND` gained `sunflower`.
- §4 of the world map / arch: the altar is at z 7.3 (not art's 9.5): (0, 9.5) and z = 9 stay free for the
  foundation suites. The lighthouse is on the shores beach, not islet 2 (§1).

## 6. Before / after (seed 7151)

| Metric | Foundation | WP9 |
|---|---|---|
| world gen, cold boot in a fresh browser (4 alternating pairs, load average 6–9) | 407, 407, 522, 789 ms | 431, 480, 508, 584 ms |
| world gen, warm (min of 3 per page, same 4 pages) | 247–312 ms | 207–444 ms (wp9-heavy notes both, cold and warm) |
| unreachable / carved (84 seeds) | 0 / 0 (seed 52: 3) | 0 / 0 (seed 52: the same 3) |
| foundation scatter props kept in place (type, position, rotation) | — | 1277 of 1329 (all of WP9's but 3 clearing stumps) |
| Great Tree height / crown top LOS from walkable points ≥ 15 m | 9 m / 37 % | 19.8 m / 55 % (15–40 m 94 %, 40–80 m 66 %, 80–120 m 45 %, 120 m+ 44 %) |
| landmark reads from its own path (`reads`) | none | 0.53–0.87 (see §1) |
| Miso's face over the counter, FP eye 1.6 / 2.4 / 3.5 m | 100 % (no counter) | 96 / 95 / 96 % |
| coin chests: path distance | 4.8–7.4 m | 14.0–39.2 m (9 of 10 invisible from the paths within 30 m) |
| props / trees (woods trees) | 1592 / 931 (591) | 1577 / 881 (544: trails, clearings, the mushroom's stem ring) |
| lamps / on a bridge / draw calls | 12 / 1 / 2 per 40 m chunk | 17 / 0 / 2 island-wide |
| whole scene vs foundation, main pass, 36 FP views (9 poses × 4), noon, enemies hidden (wp9-heavy) | — | median +14 calls / +10 k tris; max +35 calls (arena-woods-1) / +51 k tris (hilltop-1) |
| the same, reviewer's sweep (1920×1080, main pass / full frame with shadows) | — | main max +39 / +50 k, full max +39 / +109 k; no view over +40 / +150 k |
| module objects only (incl. lamps), on vs off | — | max 34 calls / 105 k tris |
| asset triangles (incl. outline) | house_a 5.3 k, house_b 3.8 k, shop 4.9 k, pedestal 1.9 k | 9.7 k, 6.7 k, ≈ 9 k, 4.7 k (within budget above; not split out) |

## 7. Integration notes (merge order WP7, WP3, WP1, WP2, WP4, WP6, WP5, WP8, WP9)

- **WP3 × world.js `generate()` tail**: WP3 may add buildRails / OBB registration at the end of `generate()`. At the
  WP9 merge keep WP9's tail (`placeSkyline(); placeCoins(); placePathDressing(); lap('coins'); reachability(); …
  computeSplat(); buildColliderHash(); publishAnchors(); lap('splat')`), put WP3's call next to `buildColliderHash()`,
  before `publishAnchors()`, and keep `lap('splat')` last. WP3's house-circle → OBB change keeps working: the house
  dressing colliders (`dressing`) sit inside the old footprint circles.
- **WP7 × props.js `PROP_KIND`**: no `lamp` entry (world-mod.js draws lamps). If WP7 rewrites scatter.js chunking it must
  not re-add lamps; `W.lamps` is unchanged for halos / pools / sky. Crown parts, landmarks and lamps carry
  `userData.cull { dist: Infinity }`; the frog hides itself beyond 30 m (same as its C10 tag). The socket pulse reads
  `mat.userData.glowK` (toon.js internal) only while it exists. **WP7's generic culler measures from an object's origin**
  (`matrixWorld` translation): no module object it tracks is built in world coordinates (§2 "C10 culling"); the same
  applied to WP8's woods light shafts (`atmo.js`, world-space instances at the origin): tagged `{ dist: Infinity }` in r2
  (one draw call, only drawn in the morning shaft hours).
- **WP4 / WP6**: no rename needed: the dialogue says "pedestal" again, like the prompt and the controls card. The
  signpost's interact entry has no `prop` (WP4's `frontOk` therefore allows every side).
- **WP1**: `W.shots.bossIntro.*` unchanged; both landmarks that share the boss's colours stay ≥ 0.42 / 0.6 rad off the
  boss from that camera and from the entrance.
- **WP5 bosses**: arena edge-ring stones are colliders now (kind `arenaring`, r 0.27 at `a.r + 0.02`); a charge into the
  edge meets the stones about 0.3 m before the old clamp radius.

## 8. Review round 1: what changed

Miso's counter (lower, goods at the ends); the scatter shadow (foundation trees back in place, carving 0 on the seeds
the review listed); lamps as one instanced mesh and sunk gates not drawn (whole-scene cost within +40 / +150 k at every
view); lighthouse to the beach by the cove (LOS-scored), Clover / Digby / peaks sign rewritten; arena rings solid
(+ `openRings`); woods mushroom off the boss in the intro (LOS-scored after scatter); crown as one dome with greener
single leaf cards; moss mantle over the second face; bunting clear of the face; plaza paving bare; waymarkers slide
along the path; signpost readable from every side; crown parts cull-tagged; guarded animators; house B brace; cairn
clear of the nook; coins only in reachable pockets. Tests added for each (wp9: Miso's face rendered, signpost sides,
paving, waymarker spacing, ring colliders, animators, crown dome, bunting, intro offsets, Clover's hint geometry,
foundation props kept; wp9-heavy: `reads` skyline with a 40 px span, cold boot genMs, carving on 8 seeds, whole scene
vs the foundation per view (assets and `?noassets=all` baselines)).

Known issues: the house and shop dressing is not split into a separately culled mesh (triangles stay within budget);
the leaf-card art itself still has a bunch shape (tinted and thinned, not repainted); `openRings` leaves a visible gap
in a ring on the seeds that need it (none of the default seed's rings open).

## 9. Integration round 2: what changed

- **C10 seam (WP7's culler).** The island-wide meshes built in world coordinates (edge stones, waymarker posts and
  plaques, sign boards, light pools, window cards, bunting, signpost, socket glows) were tagged with finite
  `userData.cull` distances; WP7 measures from the object's origin, which was the plaza for all of them: the farthest
  waymarker (114 m out) vanished with Pip 3 m from it, every waymarker beyond 93 m from the plaza, the stones by the bridge
  approaches, and between 60 and 70 m the edge-stone fade scaled all 196 stones about the plaza. Now `spanCull` (§2):
  none of them is in the generic culler, each is drawn while any part of it is within its distance. WP7's own test
  "no instanced mesh in the generic culler" passes. Foreign edit: `atmo.js` shafts `{ dist: Infinity }` (§7).
- **Altar collider** (lead ruling "sized to what the eye sees"): a circle r 1.02 (`TW.pedestalR`) instead of the
  0.92 × 0.52 box: Pip stops 1.34 m from the centre from every side (was 0.84 from the north / south, the FP eye inside
  the slab).
- **Bridge mouths.** The islet-1 rock (foundation spot (−2.5, +2) off the islet's centre) stood 0.29 m from the islet-2
  bridge's deck end and made a 0.64 m-wide wedge with WP3's rail end post: an approach at 35° stopped dead. It now turns
  round the islet centre (steps of 0.25 rad) to the first spot ≥ 1.5 m clear of every bridge (seed 7151: (−41.24, 141.95));
  the foundation's spot stays a ghost for the scatter shadow and the main stream draws the same numbers. Every deck end
  is clear of solids by 1.5 m on seed 7151 and the 8 heavy seeds; WP3's bridge-mouth test now has 0 "wedge" exemptions.
- **Stripes.** The lighthouse's per-vertex stripe colours sat on a 5-point lathe (one soft coral band mid-tower) and the
  awning was one box segment (a green → cream gradient). `faceColor(b, fn)` (props.js, module-local) recolours a GB part
  per triangle at its centroid; the tower lathe has a ring at every stripe edge and the awning box 8 segments.
  The brick / checker colorFns on the well, the altar ring, the lighthouse base and the house plinths have the same
  per-vertex limit; at eye level they read as plain two-tone stone (looked at, not changed).
- Tests (`wp9`): "altar collider: a circle round the mesh …" (mesh band radius vs collider, S / SE / E / SW walks,
  eye clearance), "C10 seam: …" (no module instanced mesh or world-origin object in WP7's culler; drawn at full scale
  beside the farthest waymarker / edge stone / sign and a stone in the old fade band; stones not drawn ≥ 75 m from all
  of them), "bridge mouths: …" (no solid within 1.5 m of a deck end; every ±35° approach ends on the deck), "the striped
  lighthouse and the shop awning …" (one colour per face, alternating bands). `wp9-heavy` "other seeds" also checks the
  bridge mouths. Each of these fails on the round-1 merge and passes here.

## 10. Round 3 (verify and finish): what changed

- **Round-2 fixes checked together in the merged build**: C10 (`spanCull` meshes are never in WP7's culler; WP7's own
  "spread" rule now only meets the three arena-ring groups, which stand at their own origin and are hidden once the
  camera is 133 m outside their bounding sphere; nothing beside Pip vanishes, nothing is scaled), the altar circle (stops 1.34 m from every side),
  the stripes and the islet-2 bridge mouth all hold.
- **Peaks heart-chest nook, no carved corridor on any seed.** The merged build carved on 12 of 335 seeds, all at this
  nook: beside the peaks arena (25, 87, 111, 169) the arena dressing that `placeArenas` put down first, with WP3's exact
  boulder footprint, closed the walkway; on a steep stretch of the path (52, 89, 103, 121, 145, 224, 227, 259) the
  walkway's flat discs (`p.h + 0.3` over r 1.8 + 2.5 m) cut the path itself, so the sign and the peaks arena were carved
  back too. `placeSpecial` now takes a candidate only when `nookOk(p, side)` passes: on a local 1 m walk grid (the slope
  limit of `buildWalk`) over the terrain with the walkway and nook flattened exactly as placed, the solids placed so far
  and the nook's boulder wall (r 1.75 + 0.25, its lobe at any yaw), restricted to the path's, walkway's and nook's own
  ground (no detour scatter could fill later), the path still runs through ±10 samples and the nook joins it. It draws
  nothing and restores `H`, `S`, `flatF`, so a seed whose first candidate passes is generated bit for bit as before
  (7151, 42, 1234, 31337 and 298 of the 335 seeds are identical; 37 seeds get another nook, and with it another main
  stream). Cost 3.6 ms per candidate, 4 ms per seed on average.
- **The well** (`props.js well()`): the roof panels were tilted the wrong way (a V under the ridge beam, with a narrower
  second panel in the same plane z-fighting through each) and the posts ran down through the stone wall and poked out of
  it as two pointed stakes in front of the rim at eye level. Now a pitched roof meets the ridge beam (2.78 m), the posts
  stand on the rim torus and reach the roof.
- Tests (`wp9`): "peaks heart-chest nook: no seed needs a carved corridor …" (seeds 25 and 52 carve 0, chest and arena
  reached; the shipping seed keeps its nook at (75.2, −21.7)), "well: a pitched roof …" (ridge above the eaves, posts
  from the rim). `wp9-heavy` "other seeds" also generates the 12 seeds above. Both new tests fail on the round-2 merge.
