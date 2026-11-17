# WP8 — Atmosphere: sky, fog, terrain, water, shadows, ambient

What WP8 adds or changes, for folding into `docs/ARCHITECTURE.md` after the merge. Files owned: `js/sky.js`,
`js/terrain.js`, `js/ambient.js`, `js/assets.js`, `assets/manifest.js` (unchanged), `js/atmo.js` (module `wp8-atmo`),
`TUNE.atmo`, `js/debug/tests/wp8.js`, this file. One foreign edit: `js/game.js` (below).

## 1. What a player sees

- **Sky layer behind the world.** Gradient dome (top / horizon / haze band / far sea below the horizon / sun and moon
  glow), the `stars` texture at night (stereographic projection from the zenith, plus sparse procedural stars; r2: only
  on a darkened sky — night × (1 − smoothstep over `starsLum` of the zenith's displayed luminance), so none at 5.5–6.5 h /
  18–18.5 h when the sky is still light and sunlit although night is 0.16–0.72 there, full from ≈ 19.5 h), painted
  `sun` and `moon` billboards, 18 cumulus (`cloud_a,b,c,d,f`, 520–680 m out, tinted by the hour, drifting) + 6 cirrus
  (`cloud_e`), 6 `horizon_isle_a…d` on the sea horizon at 760 m (none on the spawn → Great Tree line), one `sky_isle` far
  in the north-east. The old 22-instance 3D puff-cloud ring is gone. The moon rides low (17°–32°) so it sits in an
  eye-level view; on the sea it makes a shimmer on the near water under it (at that height its reflection lands a few
  metres out: there is no moon path to the horizon). The painted sun sets into the horizon at dusk / dawn while the
  light stays ≥ 23° high (toon shading stays readable). The dome is drawn last of the opaque world (depth 1), so only
  the pixels where sky shows are shaded.
- **Fog / aerial perspective.** Radial-distance fog whose colour is the dome colour in the fragment's own direction (the
  same GLSL the dome draws), so fogged land, sea and sky meet with no seam (measured ≤ 6/255, §6). Per-region near / far
  and a mid-distance tint (`TUNE.atmo.fog`), dusk ×0.9 / night ×0.78, boss arenas close in, blended over ≈ 3 s and
  snapped on teleports. Fog is full before the 300 m far plane (by 230–262 m by day, capped at 270 m: §4). The fog
  chunk's last line keeps three's own mix text, so per-material patches that rewrite it (WP9's `capFog`) still apply.
- **Landmark fog caps.** The Great Tree (cap 0.30) and every `W.landmarks` entry (cap 0.45) stay readable across the
  island: a position-based cap in the shared fog chunk (no per-material work for WP9), released into the fog over
  262–292 m so nothing pops at the far plane.
- **Terrain.** HD textures (`*_hd`) arrive after the title and are uploaded while the title shows; anisotropy 16 (GPU
  cap) on desktop, 4 on phones / low; a near-detail layer (the dominant layer again at 4× frequency, 4–10 m, one
  trilinear fetch at a 2:1-anisotropy mip level, reusing the dominant layer's splat sample as its reference); top-3
  splat weights (faint layers dropped); **r2: rock and snow side-projected on steep faces** (from normal y 0.86 ≈ 31° to
  full at 0.62 ≈ 52°, within 32 m of the eye, a sharp two-axis blend: ≤ 2 fetches per layer there; top-down they stretched
  1.7–2.2× down the fall line on the peaks' 50–60° faces right at Pip's feet, whose smoothed slope field reads only ≈ 30°,
  a brown / white smear in both views), the near detail **after** the cliff layer (the cliff used to replace it at the
  feet) and × `detailSteep` 2 on rock / snow (their art is soft and large-scale); `cliff_hd` projected from the side on faces ≥ ≈ 50° where rock is the ground
  layer (never over grass), stretched 2.4× along the face so the stone rows read as strata / ledges (10 m vertical
  period), softened toward its mean, snow on its ledges above 10–16 m (the peaks); `rock_hd` at ≈ 1 m stones;
  `cobble_hd` on the village plaza (a noisy disc of `W.plaza.r` around `W.plaza`, only on the dirt / sand there, only once
  the cobble art is resident; where it covers the ground fully the ground layers, near detail and cliff are not fetched);
  `planks_hd` available via `Assets.tex('planks')`. Quality low / phones: no near detail and no cliff layer; lowering the
  quality while playing swaps the resident HD terrain / water to their `lo` files.
  **r3: near-ground grain.** Within 2.2 m of the camera (gone by 4.2 m, `TUNE.atmo.grain`) the ground gets a boot-generated
  256² grain texture (`grainTexture()`: per-texel grain over a soft value noise, lit pebbles with a contact shadow on a
  jittered grid, sparse sparkle texels, a mottle channel; no asset, so `?noassets` has it too), fetched twice at unrelated
  scales and rotations (0.85 m and 1.38 m tiles, 37° apart: no visible repeat) and applied as a luminance change of the
  colour already there, so it takes the surface's tint: fine grain on soil, sand, rock and the forest floor, pebbles on
  dirt and rock (in patches), a sparkle on snow and a little on sand whose phase follows the view direction (it twinkles as
  you move). Steep faces take the side projection's axis. At the feet the fine contrast rises 43 % (mean |Laplacian|
  5.2 → 7.4 on the shores path, wp8 test); the art itself is 8–15 mm a texel there against ≈ 1.2 mm a pixel (the soft
  smear of the r2 finding). Off on quality low / phones with the near detail (`terrainGrain` feature switch). Crops:
  `agents/r3-render/out/grain-v1-a.jpg` (peaks rock / snow, FP and TP), `grain-v1-b.jpg` (plaza, dirt paths, meadow).
  **r3: the terrain is drawn after the other opaque objects** (each chunk `renderOrder` 1; the dome stays last at 1e6):
  wherever grass cards, ferns, props, trees, Pip or enemies cover the ground, the early depth test now skips the splat
  shader. Same picture (≤ 0.001 % of pixels differ, depth ties at contact edges; wp8 test, `orderdiff.mjs` 14 views);
  TP arena-woods facing S during the fight −1.3 to −1.8 ms GPU at 1080p (same page, interleaved, load ≈ 10).
- **Water** (art §6). Fresnel toward the sky colours (capped near the eye, free toward the horizon); sun / moon glint =
  the tight reflection (art exponent 220) + a wider path that only the water art's sparkles pick up, soft-clamped into
  what is left below white (a low sun lays a sparkling path, never a white wash: ≤ 0.1 % clipped pixels at 17–18 h from
  the south beach, it was 3.5–6 %); the far sea fading into the dome's far-sea band; `fx_foam` lace only inside the shore
  foam band and gone within ≈ 0.3 m of depth (open shallows show the water art, not lace holes); wading ripples (a ring
  per step in water, a slow ring while standing in it, one on landing), view-path alpha.
- **Shadows.** One 2048² map (1024² on quality low), box half-size 24 m centred 14 m ahead of the eye
  (`view.shadowFocus()`, the ground from 10 m behind to 38 m ahead), texel-snapped in light space; trees 25–35 m ahead
  cast onto the ground in the centre of the view: 30 m ahead the box reaches ≈ ±18–41 m sideways depending on the sun
  (tested ≥ ±10 m), so trees at the far sides of a 100° view (±36 m there) can miss their shadow (reviewer count: 65 % of
  the trees 25–35 m ahead across the whole view, 100 % within ±10 m of its centre).
- **Night.** Moon + halo, stars, moonlit thinner clouds, dark-indigo isles, lamp pools (sky.js), Pip's night light
  1.6 m over his feet (0.72 m over the FP eye) at the foundation's strength (no hot spot on doors / signs at talk
  distance; WP2's viewmodel copies it unchanged), fireflies (everywhere but the peaks, which sparkle). Night ground
  luminance at 22:00 in the village: 113 with the base art (`?noassets=hd`; the foundation 116), 138 with the HD art;
  night / noon 0.71 / 0.77 against the foundation's 0.69.
- **Ambient** (art §4.5 / §8), all spawned in a view-relative volume (eye + view × 10 m, radius 14 m, nothing within
  1.5 m of the eye; heights relative to the eye or the ground under the point): woods leaves and dust motes in the light
  shafts, peaks snowfall + FP breath puffs, meadow butterflies and pollen, village fluff, sea sparkles, fireflies at night,
  ending petals. Six procedural gulls circle the shores by day (they replace the top-down gull-shadow sprites). Woods
  light shafts: up to 10 soft additive beams (7 in this world) of light falling out of round tree crowns beside the woods
  path: each runs down the 9 h sun ray from just inside a crown's underside to the ground and is gone before the crown,
  so it is never drawn against the open sky; shown only while the sun shines along that ray (morning; off by ≈ 13 h and
  at night). Dust motes drift in their lit lower part. The woods' hemisphere ground colour is lifted 8 % (shaded forest
  floor stays green).

## 2. Interfaces

### `js/sky.js`
| Export | |
|---|---|
| `Sky` | as before (`hemi`, `sun`, `sunDir`, `lampLights`, `pipLight`, `night`, `skyTop`, `horizon`, `fogColor`, `dome`, `domeMat` (r2: `uniforms.uStars` = the stars' visibility, set by `update`), `shadowExtent`, `update(h, focus, camera, lamps, dt, time, shadowFocus)`) plus: `sunVis` / `moonVis` (visible sun / moon directions), `sunK` / `moonK` (0..1 above the horizon), `fogNear / fogFar / fogTint / fogTintK` (targets wp8-atmo writes, `update` applies), `out` (displayed colours: `top, hor, haze, sea, tint, glow, cloud, isle`), `waterLight` (the water's lit colour), `sprites` (SkySprites: `atlas { tex, cells, size }`, `list`, `u` uniforms, `mat`, `mesh`, `count(kind)`), `shadowCenter`, `shadowAhead`, `atmoOn` (false = fog falls back to `scene.fog.color`), `setShadowQuality(q)`, `upload(renderer)` (uploads + binds the star field and the sprite atlas held back at boot), `uploaded` (getter) |
| `ATMO` | `{ A, B, CA, CB }`: plain `{ elements: Float32Array(16) }` mat4 uniforms shared by reference with every fogged material: `atmoSkyA/B` (dome colours, haze, far sea, region tint, sun / moon; `B[7]` the lowest active landmark cap, below which the chunk skips the cap test), `atmoCapA/B` (8 landmark cylinders: `x, z, r + cap, y0`) |
| `ATMO_GLSL` | GLSL `vec3 atmoSky(vec3 dir)`: the dome colour in a direction (displayed values) |
| `displayed(color, out)` | a linear colour as the renderer shows it (ACES × exposure + sRGB) |
| `fogCap(obj, cap, scene)` | per-material cap (`material.defines.FOG_CAP`) on an object's own materials (not shared ones, not ShaderMaterials); `cap null` removes it → materials changed |
| `buildSkyAtlas()` | packs the sky billboards (procedural sun / moon / clouds when missing, no stand-in isles) into one 2048 × 1024 canvas texture → `{ tex, cells, size }` |
| `nightAmount(h)` | unchanged |
| `sunLightDir(h, out?)` | the sun light's direction (toward the sun) at a daytime hour, as `update` sets `sunDir` (the woods shafts bake their tilt from it) |
| removed | `sky.clouds`, `sky.cloudData`, `buildClouds()`, `updateClouds()`, the dome's `uTop / uHor / uSunDir / uSunCol` |

**Fog chunks.** `sky.js` replaces three's `fog_pars_vertex`, `fog_vertex`, `fog_pars_fragment`, `fog_fragment` at import
(before any compile) and adds `atmoSkyA/B` + `atmoCapA/B` to `UniformsLib.fog` and every `ShaderLib` entry with
`fogColor`. `vFogDepth` is now the **radial** distance; a `vFogDir` varying carries the world-space view offset. A custom
`ShaderMaterial` with `fog: true` keeps working as before (merge `UniformsLib.fog`, define `mvPosition` before
`#include <fog_vertex>`); created after `sky.js` is evaluated it gets the dome-coloured fog and the caps, otherwise it falls
back to `fogColor` (the horizon). Fog still mixes after `colorspace_fragment` (output space), as in three. The chunk ends
with `{ vec3 fogColor = fogC; gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor ); }` (a block-local
colour): that is the only occurrence of three's mix text, so a patch that rewrites it (WP9 `capFog`) works (tested).
**Known limit:** a hand-rolled fog shader that declares `varying float vFogDepth` itself and does not include
`<fog_pars_vertex>` fails to link (`vFogDir` missing). No package in this round does that (grep of WP1–WP9: every custom
fog shader includes `<fog_pars_vertex>` + `<fog_vertex>`).

### `js/terrain.js`
`buildTerrain(W, scene) → { group, material }` (material `userData.uniforms`: `tGrass … tRock, tCliff, tCobble, tNoise`,
`uPlaza (x, z, r, on)`, `uDetail (near, far, amount, plaza edge)`, `uCliff (ny full, ny start, vertical period,
horizontal stretch)`, `uCliffSnow (snow from, full at (m), contrast kept)`, `uRock (scale, soften)`, r2: `uSide (ny start,
ny full, near-detail gain on rock / snow, max distance)`, r3: `tGrain`, `uGrain (near, far, amount, m per tile)`; program key `terrainSplat6`; every chunk `renderOrder` 1 (r3)), `watchTerrainTextures(mat) → off` (swaps slots on `Assets.onTex` and uploads the arrival), `TERRAIN_LAYERS`,
`HMIN / HMAX`, `heightTexture(W)`, `buildWater(W, scene) → { mesh, material }` (mesh `name: 'water'`, 1000 m plane, uniforms
`uLight, uSunCol, uSunVis, uSunGlint, uMoonVis, uMoonGlint, uFres, uRip[8], uRipK, tFoam, uHasFoam, tWater, tHeight`),
`buildMapCanvas`, `noiseTexture`, `getNoiseTex` (unchanged), r3: `grainTexture(size = 256)`, `getGrainTex()` (shared).

### `js/atmo.js` — module `wp8-atmo`
Hooks: `attach` (camera far = `TUNE.atmo.far`; builds gulls + shafts; caps; ripple listeners; `G.debug.atmo`), `onTitle`
(records `titleAt`; 80 ms later `lateInit`: `sky.upload`, adds + compiles gulls / shafts for both point-light sets (r2:
the lamps are still on at dawn while the gulls fly) — all outside the boot-to-title
time), `onSession` (fog snap, caps, plaza from `W.plaza`), `beforeCamera` (lateInit fallback, cap refresh when
`W.landmarks` / `W.greatTree` change, region / time fog targets and blend), `afterCamera` (woods hemisphere lift, water
light / glints / idle ripple — **moved here from `game.render`** —, gulls, shafts). Fields: `fog { near, far, tint, tintK,
woods }`, `feat`, `capList`, `titleAt`, `lateDone`, `gulls`, `shafts`. Sets `game.atmoShafts` (the shaft mesh;
`userData.spots` = `[x, y, z (ground), width, axis x, y, z, length]` per beam, `userData.axis` the baked sun ray; ambient.js
spawns its motes along them). Export `shaftSpots(W, axis)`. On `settings.quality` it re-applies `features({})` (no near
detail / cliff on low or phones).

### `js/ambient.js`
`game.ambPoint(lo, hi, rel = 'eye' | 'ground') → { x, y, z, g } | null` (a random point of the view volume; null within
`ambClear` of the eye). `updateAmbient(dt)` spawns through `fx.norm / fx.add` with option keys `x y z vx vy vz life size
size1 color alpha shape vr sway wander flutter drag tag fadeIn floor` and `SHAPE.LEAF / DOT / SOFT / STAR` (with numeric
fallbacks 2 / 3 / 0 / 1 if WP7 renames them).

### `js/assets.js`
`Assets.maxAniso` = `min(TUNE.atmo.aniso (16) | anisoLow (4) on lowRes, GPU max)`, re-evaluated with the quality policy
(was a fixed cap of 8); every resident texture follows a change (re-uploaded once). Lowering the quality while playing
(HD no longer allowed) replaces every resident full `_hd` texture by its `lo` file and announces it through `onTex` (the
terrain and water swap their slots); the full files are not disposed. New: `Assets.deferredAt` (performance.now() of the
first `loadDeferred`), `Assets.arrivals[key]` (r2: the **first** arrival time of each texture through it; a quality
change that swaps it to its lo file and back re-announces it through `onTex` but no longer moves it — wp7's quality
test made the 'HD within 5 s of the title' check read 24–100 s in 'all').

### Events, contracts, settings, sounds
- Consumes `EV.STEP` (`surface: 'water'` → ripple), `EV.LAND` (C2; a ripple when `player.wading`), `view.shadowFocus()`,
  C6 `W.greatTree { x, z, y, height | scaleHeight }`, `W.landmarks [{ x, z, height, r?, y?, fogCap? }]`, `W.plaza`,
  `W.arenas`, `W.islets`, `W.paths.woods`, `game.fight`. Sets C10 `userData.cull` on what it adds (dome, sprites, gulls:
  `Infinity`; shafts: 120).
- Settings read live: `quality` (shadow map 2048 / 1024, anisotropy and HD / lo through the loader). No new settings, no
  events emitted, no sounds.

### `TUNE.atmo`
`far` 300; `fog { village, woods, peaks, shores, meadow: [near, far, tint, tintK], arena: [near, far] }`; `woodsHemi`;
`fogDusk, fogNight, fogBlend`; `capFade [262, 292]`, `capTree` 0.30, `capLandmark` 0.45, `capTreeR` 9, `capY0` 1.2;
`hazeK, hazeNightK`; `clouds` 18, `cirrus` 6, `isles` 6; `sunSize, sunDusk, moonSize, skyR`; `starTile`, `starsLum [0.30, 0.50]` (r2); `lightMinEl`
0.40; `moonEl [0.30, 0.56]`; `shadowE` 24, `shadowAhead` 14, `shadowMap` 2048, `shadowMapLow` 1024, `shadowFar` 95,
`shadowDist` 60; `pipUp` 1.6, `pipI` 4.5, `pipRange` 7, `pipDecay` 1.5 (the foundation's light); `aniso` 16, `anisoLow` 4;
`detailNear, detailFar, detailAmt`; `cliffNy [0.66, 0.5], cliffPeriod 10, cliffStretch 2.4, cliffSnow [10, 16], cliffSoft
0.6`; `rockScale, rockSoft 0.15`; r2: `sideNy [0.86, 0.62]`, `sideFar` 32, `detailSteep` 2; r3: `grain { near 2.2, far 4.2, amt 1, tile 0.85 }`; `plazaEdge`; `fresnelMax, glint, glintPow 220, foamTile`; `ripples` 8, `rippleLife,
rippleSpeed`; `ambAhead` 10, `ambR` 14, `ambClear` 1.5; `gulls` 6, `shafts` 10, `shaftK 0.4, shaftHour 9, shaftIn 0.5,
shaftTop 0.9`.

### Debug — `G.debug.atmo`
`info()` (far, fog, night, sun / moon, shadow box, sprite counts + atlas, terrain slots, plaza, anisotropy, caps, upload
state, features), `caps()` (the cap cylinders), `applyCaps()`, `fogCap(obj, cap)`, `ripple(x, z, k)`, `snapFog()`,
`features(patch)` (switch `fogAtmo, caps, shadowAhead, terrainDetail, terrainCliff, terrainSide (r2; off on low / phones
with the cliff layer), terrainGrain (r3; off on low / phones), terrainPlaza, sprites, water, gulls, shafts` at runtime for attribution and before / after captures; returns the state).

### Tests — `js/debug/tests/wp8.js`
`wp8` (in `'all'`, 17 tests): sky layer (far 300, depth-1 sky, dome after the opaque world, one sprite draw, puff ring
gone, 2048 × 1024 atlas, upload after the title, moon 5°–33°), fog chunk + per-material cap, **a WP9-style `capFog`
patch compiles and caps the fog** (three's mix text occurs once), position caps (Great Tree; a simulated `W.landmarks`
entry reads through 170 m of fog), horizon seam ≤ 6/255 at 4 hours × 3 sea vistas, shadow box (25–35 m ahead ± 10 m
inside, lateral reach 30 m ahead ≥ 10 m, centre 14 m ahead, light-space snap, sub-texel stability, depth range), terrain
HD slots / anisotropy / cliff / cobble / planks, HD arrival ≤ 5 s after the title, water glints + ripples, view-relative
ambient volume (FP + TP), region fog blend + snap + far < far plane, **night ground night / noon ≥ 0.62 (any art) and
≥ 110 with HD**, **Pip's light over the eye: a wall 2 m ahead at 21:30 has no hot spot (centre ≤ 1.25 × its sides) and
its intensity is night × pipI**, **every light shaft ends inside a round crown; on at 9 h, off at 15 h / 22 h**, **a 17.6 h
sun on the sea clips ≤ 0.5 % of the water to white; foam lace only inside the shore band**, **quality low while playing
swaps the HD terrain to lo, drops anisotropy, turns detail / cliff off, and back on raise**, atlas with every billboard
missing. `wp8-perf` (heavy): package calls / triangles per feature (deterministic, 5 views × noon / 17 h) against the
lead's budget; GPU (a timer query per render, interleaved): package (features on − off) ≤ 1.0 ms asserted, terrain pass
(on − terrain hidden) reported.

r2 (merged build; `wp8` has 19 tests):
- The two fog-cap tests look from a view whose 170 m line of sight to the block is clear (`clearShot`: yaws from the
  prepare pose in 10° steps, then open poses; raycast to the block centre ± 3 m). From WP9's spawn the old fixed yaw + 90°
  looked into a village house 17 m away, and every read was the house's wall. They now fail with "block occluded" when
  the unfogged block is not at its pixel, and **measure the fog factor itself**: the block is drawn red and green through
  the same fog and unfogged, and the fog colour cancels in the difference. Measured: plain 0.79, WP9-style capFog patch
  0.15 (its cap), W.landmarks position cap 0.450 (capLandmark). The k-gain thresholds are unchanged (> 40; > 50 and > 70).
  "Removed again" compares with W.landmarks as it was, which holds WP9's four in the merged game.
- New: **stars only on a darkened sky** (uStars 0 at 5.5–6.5 h / 18–18.5 h, > 0.9 at night) and **steep faces**. A 60°
  rock face drawn head-on: with the side projection the texture's vertical/horizontal correlation length is 0.44, top-down
  0.78 (expected 1.15× vs 2× stretch); the check needs > 1.4× apart.
- The quality test asserts that the arrival times are not moved by a low → back cycle. It used to restore them.
- `wp8-perf` holds `game.gpuT` around its timer queries, so wp7-perf's main-pass timer stands aside: TIME_ELAPSED queries
  cannot nest, and every render had logged beginQuery / endQuery errors. It also asserts no GL error around them.

r3 (`wp8` has 21 tests):
- New **near-ground grain**: the texture is a 256² tileable mipmapped data texture made at boot; on (amount 1, gone by
  ≈ 4.2 m); FP on the shores path looking down, the fine contrast at the feet rises > 15 % with it (measured 43 %) and the
  rows beyond 15 m do not change.
- New **terrain drawn after the other opaque objects**: every chunk at renderOrder 1, the dome still after it; the same
  frame drawn with the terrain first and last differs in ≤ 0.05 % of the pixels (measured 0.0002–0.0004 %).
- The quality test also checks that quality low turns the grain off and raising it turns it back on.

## 3. What in ARCHITECTURE.md is no longer true
- §3: after `sky.update(…)` there is no "water tint" in `game.render` any more; the water light / glints are set in
  `wp8-atmo.afterCamera`.
- §7: `shadowFocus()` — "sky ignores it until WP8": the sky now centres the shadow box on it (14 m along the view).
- §12 / §14: "lowering it downloads nothing and keeps what is resident" — lowering the quality to low now swaps every
  resident full `_hd` texture to its `lo` file (announced through `onTex`) and all resident textures follow the new
  anisotropy. `textures` anisotropy is `TUNE.atmo.aniso` (16, GPU-capped; 4 on phones / low), not 8. `Assets.deferredAt /
  arrivals` are new.
- §13 stays true: Pip's glow (`sky.pipLight`) is still 0.72 m over the FP eye at `night × 4.5` (sword at 21:00 −35 % vs
  noon, the foundation −36 %).
- §16: `TUNE.atmo` holds the keys above.
- §17: `G.debug.atmo` is new.
- §19: "game.js still holds the water light tint" — removed (foreign edit below).
- `main.js` still creates the camera with far 1400; `wp8-atmo.attach` sets `TUNE.atmo.far` (300). The sky is drawn
  behind the world by depth (see §4), not by a second camera; the dome now has `renderOrder` 1e6 (last of the opaque
  objects), the sprites −9 (first of the transparent).

## 4. Deviations from the proposals / RULINGS (as built)
- **Sky "own layer / camera"**: the sky objects live in the main scene but write depth 1 (`gl_Position.z = w`), never
  write depth and never fog; the dome draws after the opaque world (only sky pixels shaded), the sprites first of the
  transparent; the world (far 300 m) always covers them. Same picture as a separate sky camera, one pass fewer. The
  sprites' virtual distances (520–900 m) are kept in the shader.
- **Fog full by ≤ 270 m, far plane 300 m** (arch §15.2: full by ≤ 230 m, far plane 320 m; RULINGS: far plane 300 m): the
  daytime fog far distances are 235 (meadow), 255 (peaks) and 262 m (shores), capped at far plane − 30 = 270 m, so the
  coast / peaks vistas keep their depth; everything is fully fogged before the 300 m cut (the horizon seam test, ≤ 6/255).
- **Woods light shafts**: art §4.5 asks for 10 m cards in clearings at alpha 0.16; here they hang under round crowns
  beside the woods path (a beam in a clearing rose into the open sky and read as a searchlight), additive strength 0.4
  over a narrower soft profile, morning only (baked along the 9 h sun ray).
- **Quality low / phones**: no near-detail layer and no cliff layer (cost); the plaza cobble stays (where it covers the
  ground it is cheaper than the splat it replaces).
- **Shadow box E 24 m, 14 m ahead** (arch: E 36, 0.6 E ahead): covers 25–35 m ahead ± 6 m (tested), 2.3 cm texels
  instead of 3.5 cm, and keeps the package inside the lead's call budget (E 36 / 28 put 30–45 extra casters in the
  shadow pass in the village). The light sits 60 m up the sun ray, far 95 m (every caster ≤ 20 m tall is kept: the
  light never drops below 23°).
- **Night light**: kept where the foundation had it, 0.72 m over the eye at the foundation's strength (art §7: 2 m ahead of
  the eye, 0.6 m down). Any light ahead of the eye paints a hot spot on doors / signs / chests at talk distance, and WP2's
  viewmodel copies this light (ARCHITECTURE §13).
- **Moon arc lowered** to 17°–32° (art keeps the sun's arc): otherwise the moon is above an eye-level FP view all night.
- **Cut (nice-to-have / outside the owned files)**: woods morning height-mist, seed constellations, milky band, sunshower,
  owl-eye blinks, peaks wind sheets, the enemies' +0.15 night rim (toon.js / actors), chimney smoke.

## 5. Foreign edit
`js/game.js` `render()` (≈ line 448): the three water-tint lines after `this.sky.update(…)` replaced by the comment
`// WP8: the water's light / reflections / glints moved to the wp8-atmo module (afterCamera)`, and the then-unused
`const _c = new THREE.Color();` at the bottom removed. Nothing else outside the owned files.

## 6. Numbers (before = foundation build on :8791, after = WP8; 1920 × 1080 unless noted)
Evidence: build round `S/agents/r1-WP8-build/r2/`; review round (r1 fixes) `S/agents/r1-WP8-fix-r1/` (contact sheets
`shaft-c.jpg`, `shaft-walk2.jpg`, `shaft-d.jpg`, `look-ab3.jpg`, `water-a.jpg`, `ground-ab2.jpg`, `door-sheet.jpg`,
`phone-a.jpg`; scripts `gpulean.mjs`, `gpuattr.mjs`, `p-terr.js`, `night.mjs`, `shafts.mjs`). Counts are deterministic.
GPU: the rAF sampling of `G.debug.perf` drops most timer samples on this shared GPU, so the GPU numbers below come from a
TIME_ELAPSED query around each `renderer.render` of the main scene (shadow pass included), waited for one by one, with
the configurations interleaved in the same page (medians of 30–60 samples); whole-frame numbers of two builds come from
separate pages, so compare them as ranges.

| What | Before | After |
|---|---|---|
| `sweep` FP, 36 views at noon: draw calls median / max | 277 / 776 | 282 / 787 (per view Δ median +6, max +18) |
| `sweep` FP: triangles median / max | 1.67 M / 4.16 M | 1.57 M / 4.14 M (Δ median −63 k, max +92 k) |
| `sweep` TP: draw calls median / max | 267 / 755 | 273.5 / 766 (Δ median +7.5, max +19) |
| `sweep` TP: triangles median / max | 1.61 M / 4.10 M | 1.54 M / 4.07 M (Δ median −65 k, max +88 k) |
| Views over the lead's package budget (25 calls / 60 k tris) | — | calls: none; triangles: 3 per mode in this sweep (peaks N +85 k, meadow E +92 k, peaks W +63 k); the reviewers' FP sweep found 5 of 36 (also arena-peaks S +76 k, W +63 k). All shadow casters ahead of the eye (§7) |
| `wp8-perf` (5 views × 12 h / 17 h, all features vs off) | — | calls +3 … +14, triangles −35 k … +80 k raw, ≤ +41 k net of the removed puff ring (38 808 tris) |
| GPU, village FP noon looking north: the package's features (on − off, same page) | — | review round: +3.2 … +4.8 ms (reviewer, `G.debug.perf`); now +0.0 … +0.55 ms (final shader: 0.03, 0.34; `wp8-perf` 0.54, meadow 0.16) |
| … of which terrain detail + cliff + plaza | — | review round ≈ 2.8 ms; now ≤ 0.1 ms (on − all three off; and with their code removed) |
| … of which the dome-coloured fog / the dome | — | 0.93 / 0.38 ms → 0.13 / 0.06 ms (pow-free `atmoSky`, cap test skipped below the lowest cap; dome drawn after the opaque world) |
| GPU, village FP noon: whole main pass (separate pages, alternating builds) | 12.96, 13.00, 13.73, 13.84 ms | 13.27, 14.10 ms (final shader; ≈ +0.3 … +1.1) |
| GPU terrain pass (on − terrain hidden, water hidden in both) village / meadow | 1.35 / 0.86 ms | 2.58 / 2.45 ms (`wp8-perf`: 2.32 / 2.16) — over arch accept 3 (1.5 ms), §7 |
| Main pass alone (village FP noon, first engineer's count) | 340 calls | 341 calls; the puff ring (38 808 tris) and the 1800 m / 180² water plane are gone |
| Sky layer | 1 dome + 22-instance puff ring (38 808 tris) | 1 dome + 1 sprite draw (33 quads) |
| Shadow box | E 22 m around Pip, far 160 | E 24 m centred 14 m ahead, light 60 m up the ray, far 95; 30 m ahead it reaches 18–41 m sideways (meadow 16.9 h) |
| Horizon seam, 4 hours × 3 sea vistas (720p) | a hard sea / sky line and the water plane's edge are visible | worst ≤ 6/255 (test; 5.3 measured) |
| Night ground luminance, village 22:00, FP pitch −0.25 (720p) | 116 (noon 169, ratio 0.69) | HD art 138 (noon 180, 0.77); base art (`?noassets=hd`) 113 (noon 159, 0.71); review round: 117 HD / 93 base |
| Pip's light: a door at 21:30 in FP, centre vs corner luminance | 94.6 / 93.2 | review round 208 / 90 (hot spot); now 92.7 / 91.6, 95.8 / 91.9; a white wall 2 m ahead: centre 201, left 197, 0.5 m up 206 |
| Viewmodel sword at 21:00 vs noon (smoke suite metric) | 80.9 / 127.3 (−36 %) | review round 54.7 / 126.1 (−57 %); now 81.7 / 126.1 (−35 %) |
| Clipped-white water pixels, south beach facing the sun 17.3 / 17.6 h | 0 % | review round 3.5 / 6.1 %; now ≤ 0.1 % (sparkling path, contact sheet `water-a.jpg`) |
| HD textures after the title (11 keys, local server) | — | all in 28–164 ms after the title, uploaded during the title |
| Boot → title (alternating fresh contexts) | 9 loads median 3941 ms; 8 loads 2495 ms | 9 loads 3797 ms; 8 loads 2838 ms. Paired median over 17 pairs +197 ms (spread ±1 s); not re-measured in the review round (the shaft spots are now chosen at attach from ≈ 1 700 colliders; not timed) |

Debug flag: `?atmofog=0` keeps three's own fog chunks (attribution only; the water reflection is wrong then).

## 7. Known issues (after the review round, r1)
- **Triangle budget (60 k) exceeded in 3–5 views per mode** by the forward shadow box: peaks N, peaks W, meadow E (FP and
  TP, up to +89 k; the reviewers' sweeps found 3 per mode, and 5 of 36 FP views with arena-peaks S / W). Cause: the shadow
  casters are scatter.js chunk InstancedMeshes (bounding radius 20–32 m) that are culled all-or-nothing against the
  shadow camera, so a box shifted 14 m ahead pulls in whole extra chunks whose instances are mostly > 25 m away (probe:
  meadow E at noon, ≈ 364 k of the ≈ 404 k triangles in the shadow frustum's chunk meshes sit in chunks centred > 25 m from the eye). Not fixable inside WP8's files;
  WP7's culler (per-instance / finer shadow-caster culling or shadow LODs) removes it. Calls stay inside the budget.
- **Terrain pass** (arch accept 3, ≤ 1.5 ms): ≈ 2.3–2.6 ms at 1080p in the village / meadow (on − terrain hidden, water
  hidden in both) against the foundation's ≈ 1.3 ms. The package's own terrain features (near detail, cliff, plaza)
  cost ≈ 0.1 ms now; the difference is the HD art itself (1024² layers, anisotropy 16; anisotropy 8 saves ≈ 0.1 ms, the
  base 512² art ≈ 0.3 ms). The lead decides whether HD stays on desktop at this cost.
- **Hand-rolled fog shaders** that declare `vFogDepth` themselves without `<fog_pars_vertex>` fail to link (`vFogDir`); none
  exists in WP1–WP9 (grep), see §2.
- r2: **the ground within ≈ 1.2 m of the eye stays soft** on the peaks (and anywhere): rock is 15 mm per texel (15.6 m
  tile), snow 8.5 mm, against ≈ 1.2 mm per pixel at 1 m at 1080p. The painted art is soft too: the 4× near-detail sample
  has stones, but only ±5–15 % luminance contrast. The side projection removes the fall-line streaks, and stones read from
  ≈ 2 m. Crisper ground at the feet needs a high-frequency detail texture (`surf_detail` exists in the manifest, unused).
  That is a new layer, not part of this round.
- r2: **side projection cost**. terrainSide on − off, same page, interleaved, 1080p, load ≈ 4: +0.15–0.7 ms where steep
  faces fill the frame at the feet (whole pass 3–4.8 ms), +0.06–0.5 ms in the heavy peaks / vista views (8 ms). The
  wp8-perf package figure (features on − off, terrainSide on in both) measured 1.08–1.34 ms at load ≈ 10 and 1.31–2.46 at
  load ≈ 21, against ≤ 1.0 asserted. Before r2 its samples were corrupted by the nested queries. Not judged on this shared
  machine; for the lead's idle re-run.
