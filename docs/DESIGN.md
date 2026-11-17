# Starseed Isle — design & technical spec (3D)

A cute, cozy, open-world **3D** action-adventure (classic "zelda-like" genre) for the browser, built with
Three.js. Fully original setting, characters and names.

## Pitch
The Great Tree at the heart of **Starseed Isle** has lost its three **Starseeds**. Three grumpy guardians
are hoarding them in three corners of the isle. **Pip** — a tiny kid in a leaf-green, fox-eared hood with a
sprout on top and a wooden sword — sets off to bring them home. Any order, anywhere: the whole island is
open from the first second.

## Look & feel
Toy-like, storybook diorama. Chunky rounded low-poly shapes, soft toon shading (3–4 step ramp), bold
dark-brown inverted-hull outlines on characters and key props (matches the 2D art in `assets/sprites/`,
which is the visual reference for every character/prop — open the PNGs and match their shapes/colours),
warm pastel palette, soft shadows, light fog, sky gradient, gentle day/night. Juicy feedback everywhere:
squash & stretch, hit-stop, camera shake, particles, bouncy UI.

## Tech rules (hard requirements)
- **Three.js r187, vendored** at `vendor/three/` (do not use a CDN). Load with an import map:
  `"three": "./vendor/three/build/three.module.js"`, `"three/addons/": "./vendor/three/examples/jsm/"`.
  Available addons: `loaders/GLTFLoader.js`, `utils/*` (BufferGeometryUtils, SkeletonUtils…),
  `postprocessing/*`, `shaders/*`, `math/*`, `objects/*`, `geometries/*`, `curves/*`,
  `libs/meshopt_decoder.module.js`.
- Native ES modules, **no build step, no runtime deps**. The game is served over HTTP
  (`bun run start` → zero-dependency static server `tools/serve.mjs` on port 8080; `python3 -m http.server`
  also works). README must say so.
- `js/audio.js` is an existing **classic script** that sets `window.G.audio` (interface below). Load it with a
  normal `<script>` before the module entry point. Guard every call so a missing/broken audio module never
  crashes the game.
- `assets/manifest.js` (classic script, `window.ASSET_MANIFEST`) is owned by the art pipeline — read it,
  don't edit it. Every key may be missing → the game must still run (procedural fallback).
- WebGL2 renderer, `outputColorSpace = SRGB`, ACES or AgX tone mapping (keep colours pastel, not washed
  out), pixel ratio `min(devicePixelRatio, 1.75)` on the default High graphics preset (Medium caps it at 1.25,
  Low at 1 with no shadows and thinner decoration; `qualityProfile` in `js/settings.js`). 60 fps target on a MacBook: instancing for repeated props,
  merged static geometry, chunked frustum culling, one shadow-casting directional light whose shadow camera
  follows the player tightly, draw calls ideally < 300.
- Fixed-timestep simulation (1/60 s accumulator, clamp big gaps), render every animation frame.

## Assets available (see `assets/manifest.js`)
- `models` — GLB files, **normalised by the pipeline: origin at bottom-centre (feet), facing +Z, exactly
  1 unit tall**. Each entry has `height` (in-game metres) — scale uniformly by it. Textured; convert their
  materials to the toon look (keep the base colour `map`) and add outlines. Keys: `hero`,
  `boss_shroom`, `boss_crab`, `boss_frost`, `great_tree` (sleeping), `great_tree_bloom` (after the
  ending — swap between the two; same trunk), `npc_turtle` (Elder Shellby), `npc_cat` (Miso). More may
  appear later (other `npc_*`, enemy keys) — always prefer a model key over the procedural version when it
  exists.
- `sprites` — 2D PNGs. Use them for **UI** (hearts `heart`/`heart_empty`, `coin`, `potion`,
  `heart_container`, `seed_forest|frost|sea`, `sword_wood|shiny`), **dialogue portraits** (`npc_*`, `hero_down`,
  `boss_*`) and as the **design reference** for procedural 3D models.
- `textures` — seamless 512px tiles: `grass`, `forest`, `meadow`, `sand`, `snow`, `dirt`, `water`, `rock`
  (rock may arrive slightly later). Use for terrain splatting and water.
- `ui.title` — title-screen key art (16:9 JPG). `ui.icon` — favicon.
- Font: `assets/fonts/Fredoka.ttf` (@font-face) with rounded system fallbacks.
- `_old2d/` — a cancelled, unfinished 2D canvas version of this same game (world gen, dialogue text,
  enemy/boss behaviours, UI). Mine it for reusable logic/content, then **delete `_old2d/`** when done.

## Procedural models (everything without a GLB)
Build cute, chunky models from primitives (spheres, capsules, cones, cylinders, lathe/tube geometry,
deformed icospheres) with toon materials, faces made of glossy black eye spheres + white highlight dots +
pink blush discs. Match the 2D sprite designs:
- **Enemies**: slime (squishy translucent green blob + leaf), mushroom (red cap with cream spots, stubby
  legs, angry brows), bat (purple, big ears, flapping wings), bee (fuzzy striped ball, buzzing wings),
  crab (orange, raised claw, eye stalks), snowpuff (fluffy cloud of white spheres + ice crystal on top).
- **NPCs**: Mayor Ribbit (frog, top hat, monocle, red bow tie), Clover (cream bunny, flower crown, pink scarf),
  Elder Shellby (turtle, mossy shell, white beard, walking stick), Miso (orange tabby cat, green apron),
  Professor Hoot (brown owl, round glasses, grad cap, book), Digby (mole, yellow miner helmet with lamp,
  shovel).
- **Bosses fallback** (if GLB missing): Grumble Shroom (huge purple/gold mushroom king, crown, moustache),
  Captain Pinch (giant red crab, pirate hat), Frostbun (giant white snow-bunny yeti, icy ears).
- **Nature** (instanced): round trees (trunk + clustered canopy blobs), pines (stacked cones), snowy pines,
  palms (curved segmented trunk + leaf fans), bushes (blob clusters, cuttable), rocks & boulders
  (flat-shaded deformed icospheres, mossy tops), stumps, flower patches, grass tufts (wind sway in the
  vertex shader), glowing teal mushrooms (night glow), shells/starfish.
- **Village**: cottages with a red mushroom roof with white spots / a blue tiled roof, Miso's shop (cat-ear
  roof + striped awning + paw sign), well, signposts, treasure chest (hinged lid that opens), clay pots
  (breakable), picket fences, lamp posts (warm light at night), the Starseed pedestal (three star sockets),
  wooden bridges, and the **Great Tree** — huge twisted trunk with a kind sleepy face, sparse droopy canopy;
  after the ending it blooms (lush canopy, pink/white blossoms, three glowing seeds, open smiling eyes).

## World (1 unit = 1 metre; Pip ≈ 1.0 m tall)
- Island ≈ 300 × 300 m heightfield (e.g. 1 m grid, chunked meshes), surrounded by an endless sea plane.
  Deterministic generation from a fixed seed (seed stored in the save).
- Village plaza at the centre with the Great Tree. Regions by direction with noise-perturbed borders:
  - **Sprout Village** (centre, radius ~30 m): grass, dirt plaza, Great Tree + pedestal, 4–5 cottages, shop,
    well, lamps, fences, flowers, a small pond. **Safe zone, no enemies.**
  - **Whispering Woods** (north): `forest` ground, dense trees with winding walkable gaps, glowing
    mushrooms, stumps. Enemies: mushroom, bat, slime. Boss arena near the north coast.
  - **Frostcap Peaks** (east): higher snowy hills/mountains (`snow`, `rock` on steep slopes), snowy pines,
    boulders. Enemies: snowpuff. Boss arena on a plateau near the east coast.
  - **Sunny Shores** (south): wide beaches sloping into turquoise shallows, palms, shells, rocks, a couple
    of islets linked by bridges. Enemies: crab. Boss arena on a sandy peninsula.
  - **Bloom Meadow** (west): `meadow` ground, flowers, bushes, ponds, rolling hills. Enemies: bee, slime.
    Secrets & chests, no boss.
- A river (carved below sea level, so the sea plane fills it) runs from the Woods down the east side to the
  sea; ponds/lakes in the Meadow. Wooden bridges where paths cross water.
- **Dirt paths** wind from the plaza to each arena entrance and into the Meadow (stamped into the terrain
  splat, slightly flattened). Keep ~3 m around paths clear of solid props.
- Terrain shading: splat blend of the textures by region/slope/height/path (world-space UVs, repeat every
  ~6–8 m, blend noise so borders look organic), steep slopes → `rock`, beaches → `sand`, peaks → `snow`.
  Slopes steeper than ~40° block movement (cliffs).
- **Water**: animated shader — two scrolling `water` texture layers, depth-tinted (shallow turquoise near
  shore → deeper teal), white foam band at the shoreline (use a heightmap DataTexture), sparkles, gentle
  vertex waves. Pip can't enter water deeper than ~0.4 m (soft push-back).
- **Boss arenas**: ~28 m round clearings ringed by solid props with one entrance on the path. Entering
  starts the boss (camera eases to frame it, name card); a magical glowing vine wall seals the entrance
  until victory. Victory: big burst, the Starseed floats out → pick up → fanfare + dialogue.
- **Chests**: 4 heart-container chests in hidden-ish spots (Meadow grove, Shores islet, Peaks nook, Woods
  hidden glade) + ~10 coin chests. **Reachability**: BFS on a walkability grid from the spawn; carve a path
  to anything important that isn't reachable; assert in debug mode.
- Scatter decorative non-colliding grass/flowers/pebbles/shells densely near the camera (instanced).

## Camera & controls
- Third-person 3/4 overhead follow camera: default pitch ~50°, distance ~11 m, FOV ~40°, smooth follow
  with slight look-ahead; orbit yaw with **Q / E**, mouse drag, or right stick; zoom with the wheel
  (clamped). Movement is camera-relative. Keep the camera above the terrain; fade (dither or opacity) trees
  and props that block the view of Pip.
- Move: **WASD / arrow keys / left stick**. Attack: **J / Space / left click / pad A**. Dash-roll:
  **K / Shift / pad B**. Interact: **F / Enter / pad X** — and attack also interacts when a "!" prompt is
  shown. Potion: **R / pad Y**. Map: **M / Tab / pad Back**. Pause: **Esc / P / pad Start**.
  Touch devices: virtual stick + A/B buttons + drag to orbit.

## Player (Pip)
- Move ~5 m/s with smooth accel/decel; rotates smoothly to face movement. Procedural animation on the
  static GLB: walk bob + waddle tilt + slight forward lean, dust puffs, squash on landing/dash end, idle
  breathing scale, blink-free.
- **Sword**: 0.3 s swing — quick body twist + lunge, a crescent slash-trail mesh (additive, fading) in a
  ~140° arc in front, reach ~1.6 m (shiny sword ~2 m, golden trail + sparkles), 1 dmg (shiny 2). Knockback,
  cuts grass/bushes, breaks pots, hit-stop (50 ms) + small shake.
- **Dash/roll**: 0.2 s burst, i-frames, 0.55 s cooldown, dust.
- Hearts in half-heart units: start 3 hearts (6 HP), max 10. Hurt → knockback, 1 s blink i-frames, red
  flash vignette, shake. 0 HP → "Pip got dizzy!" → fade → respawn at the Great Tree with full hearts, coins
  kept, unbeaten bosses reset.
- Pickups (coins = sparkle gems, hearts) pop out with a bounce, magnet within ~2.5 m, despawn after 12 s.
- **Potion** (R): heal to full, max carry 3.

## Enemies (procedural models, HP, behaviour) — contact damage 1 (half heart)
- **slime** 2 HP: hops toward the player within ~10 m (squash before hop, stretch in air).
- **mushroom** 3 HP: wanders, stops, puffs a slow spore projectile every ~2.5 s.
- **bat** 1 HP: flies ~1.5 m up, sine flutter, periodic swoop.
- **bee** 2 HP: hovers in zig-zags, telegraphed dive (pause + wing blur).
- **crab** 3 HP: scuttles sideways, then charges; clinks off the raised claw from the front while charging.
- **snowpuff** 2 HP: floats, keeps distance, throws snowballs every ~2 s.
- All: white hit flash, knockback, 0.25 s i-frames, death poof + drops (coin 45%, heart 15% if hurt),
  idle bob/breathing, face the player. Region spawn tables, ≤ ~8 active near the player, spawn out of view
  (≥ 14 m away), never in the village, despawn when far. More bats at night.

## Bosses (GLB if present, HP bar at the bottom with name, contact damage 2)
- **Grumble Shroom** (Woods, 24 HP): waddles at you; (a) stomp → expanding ground shockwave ring you must
  dash through / jump-roll, (b) 5-way spore spread, (c) summons 2 mushrooms. Faster < 50%.
- **Captain Pinch** (Shores, 24 HP): sidesteps; (a) telegraphed charge across the arena (stunned 1.2 s if he
  hits the arena edge — free hits), (b) bubble volley, (c) claw-snap lunge.
- **Frostbun** (Peaks, 26 HP): (a) big leap landing on a shadow telegraph at your position + snow burst,
  (b) snowball spread, (c) belly slide. Faster < 50%.
- Hit: white flash, tiny knockback, 0.15 s i-frames. Defeat: shake, flash sequence, star burst, Starseed.

## NPCs, dialogue, shop, ending
- **Elder Shellby** (turtle) by the Great Tree — intro story on new game (auto-starts after fade-in), then
  progress-aware hints. **Mayor Ribbit** (frog) in the plaza. **Miso** (cat) at the shop — shop menu.
  **Clover** (bunny) near the south road — Shores hints (Captain Pinch's charge weakness). **Professor Hoot**
  (owl) at the Woods edge — "dash through Grumble Shroom's shockwave!". **Digby** (mole) in the Meadow —
  Frostbun's shadow + hidden heart chests. Villagers idle/wander gently and turn to face Pip when talked
  to; lines change with Starseeds collected/placed. Signposts at crossroads.
- **Shop (Miso)**: Potion 25 gems (max 3), Heart Container 120 (once), Shiny Sword 150 (once).
- **Ending**: at the pedestal, carried Starseeds are placed one by one (glow + sound). All three → camera
  eases to the Great Tree, it blooms (swap to bloom state + petal/sparkle particles), music `ending`,
  centred card "✿ Starseed Isle is blooming again! ✿ — Thanks for playing", then free roam continues. Save.

## UI (HTML/CSS overlay above the canvas — cozy look: cream panels, brown rounded borders, soft shadows,
Fredoka font; use the 2D sprites for icons)
- Top-left: heart rows; gems + potions counters. Top-centre: 3 Starseed slots (empty / collected / placed).
- Top-right: round minimap (pre-rendered top-down terrain colours, player arrow rotated with camera-facing,
  Great Tree icon, boss markers → ticks when beaten). **M / Tab**: full-screen map with region names.
- Region banner on entering a region. Floating "!" prompt over interactables.
- Dialogue box: bottom, typewriter text, name tag, sprite portrait, bounce arrow; `talk` blip every few chars.
- Title screen: `ui.title` art, logo "Starseed Isle", "New Adventure" / "Continue" (if save), gentle
  particles. Pause menu: Resume, Controls, Settings (volumes, camera sensitivity /
  invert, reduced motion, graphics Low / Medium / High), Sound on/off, Save & Quit. Controls card on first start.
- Loading screen with a progress bar while GLBs/textures load.

## Atmosphere
- Day/night: 8 real minutes per day, start mid-morning; sun direction/colour, hemisphere colours, fog and
  sky gradient animate (dawn pink, day blue, dusk amber, night deep blue — never too dark). Night: a soft
  light around Pip, lamp lights, glowing mushrooms, fireflies.
- Ambient particles per region (instanced/Points): falling leaves (Woods), snowflakes (Peaks), butterflies
  & petals (Meadow), sea sparkles + gull shadows (Shores), dandelion fluff (Village). Grass/trees sway.

## Save
`localStorage['starseed-isle-save-v2']` (try/catch) — autosave every 30 s + key events. Stores seed, player
pos, hp, maxHp, coins, potions, swordLevel, seeds collected/placed, opened chests, bosses defeated, heart
containers taken, ending seen, time of day, visited regions.

The schema lives in `js/save.js` (pure, unit-tested in `tests/save.test.js`). Every save carries a `v` field,
`SAVE_VERSION` (currently 2); the version comes from `v`, not from the storage key, which stays
`starseed-isle-save-v2`. Loading runs `loadSave(raw, seed)`: `migrate` applies the `MIGRATIONS[n]` steps
(version n → n + 1) up to `SAVE_VERSION` and rejects non-objects, saves without `seed`, saves newer than
`SAVE_VERSION` or with no migration path; then `normalize` fills missing fields from `freshState` and
clamps or coerces the rest (hp 1..maxHp, maxHp ≤ `CFG.maxHp`, potions ≤ `CFG.potionMax`, coins ≥ 0,
swordLevel 1 or 2, map fields always plain objects, position finite or null). A rejected save is treated
as no save. To change the layout: bump `SAVE_VERSION`, add a `MIGRATIONS[old]` step and a test for it.

## Audio interface (`js/audio.js`, already implemented)
```js
G.audio.init()        // call on first user gesture (it also self-installs gesture listeners)
G.audio.sfx(name)     // swing hit enemyDie hurt coin heart chest dash talk menu select cancel bossHit bossDie
                      // seed fanfare bush pot stomp shoot splash bubble snow potion buy error death door
                      // place bloom step
G.audio.music(track)  // title village meadow woods peaks shores boss ending | null
G.audio.setMuted(b); G.audio.muted; G.audio.toggleMute()
```

## Debug (`?debug=1` or backtick)
FPS + draw calls, collider gizmos, region/coords, 1–5 teleport (village/woods/peaks/shores/meadow),
G +100 gems, H heal, B teleport to the nearest unbeaten boss arena entrance; `window.G.debug` helpers
(`teleport(x,z)`, `giveSeeds()`, `setTime(h)`, `killBoss()`).
