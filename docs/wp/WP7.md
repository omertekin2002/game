# WP7 — Rendering core and performance (as built)

Owner files: `js/toon.js`, `js/scatter.js`, `js/fx.js`, `js/perf/perf.js` (module `wp7-perf`), `js/perf/lod.js`,
`js/perf/grass.js`, the renderer-setup block of `js/main.js`, `TUNE.perf` (`js/tune.js`), `js/debug/tests/wp7.js`.
No edit outside these files.

## 1. What a player gets

- **Distance culling without pops.** Instanced scenery is packed per frame-cone and distance class on the CPU; deco
  (grass, flowers, fern, tall grass, pebbles, shells) shrinks to nothing over 25–35 m, glowing deco (glowshrooms,
  crystals) over 50–60 m, small props (bush, rock, stump, pot, fence, sign, pedestal) over 80–90 m (vertex scale in the
  shader, the same XZ distance the CPU uses). Boulders, lamps, the well, buildings, bridges and the Great Tree are never
  culled by distance.
- **Tree LOD with crossfade.** Every tree type (and heavy props: bush, stump, pot, glowshroom) has a generated proxy
  built from fitted primitives (`js/perf/lod.js`): canopy lobes → icosahedra, pine tiers → cones, trunks → frusta,
  palm fronds → flat diamonds, boards → boxes, smooth primitive normals and the nearest source vertex colour, plus its
  **own pixel outline hull**, so a forest 300 m away still reads as outlined toon trees. Full model + hull up to 48 m,
  proxy + hull from 38 m, complementary Bayer dither over 38–48 m. Round tree 1526 + 1454 hull triangles → 172 + 172.
- **Shadow casters**: inside the sun's light box a full model casts its own shadow up to 20 m from the camera, beyond
  that (and behind the view, where nothing is drawn) its proxy casts on a shadow-only layer — shadow pass −0.5 to −1 ms
  in the woods with no visible change (`sheet-shadows.jpg`).
- **Clip-space pixel outlines** (`outlineMat` px mode): far lines keep a constant pixel width at 1080p scaled by the pass
  height (`TUNE.perf.outline.*.px`: characters 3.0, props 2.3, trees 2.7, big 2.8 px; the scale never drops under 0.75,
  so a 585 px phone buffer still gets 0.75 × the 1080p width), thinned × 0.7 from 10 to 40 m. **Near the eye a line is
  never thinner than the foundation's world-space ink** (`outline.*.w`, 0.75 × the foundation widths: characters
  16.5 mm, trees 34 mm, …, projected), capped at `outlineCap` 8 px at 1080p: Pip in TP, NPCs at talk distance (≈ 8 px at
  1.3 m), bosses at 2 m, near rocks / bushes / pine tier creases keep a bold toon line. Ramped in over 0.40–1.0 m view
  depth (hull fragments nearer than 0.40 m are discarded), faded out over each kind's far band (props 40–55 m,
  characters 70–85 m, big 90–130 m) — except LOD layers, whose proxies carry their own hull. Hulls are never decimated.
- **Eye inside a crown**: every instanced hull (trees, palms, bushes, rocks, …) carries its model's radial profile (max
  distance from the trunk axis per 12 height bands, `radialProfile`); while the camera is inside that profile + 0.45 m
  (`outlineInside`) the instance's hull is not drawn at all. FP in a pine's lowest tier, the TP camera behind Pip inside a
  tier, the eye in a bush: the tier / bush reads as see-through leaves (its faces are back-facing from inside, NEAR_FADE
  dithers the near ones) instead of a screen of outline brown. A bush 1.3 m away keeps its outline.
- **NEAR_FADE dither** on every `toonMat` (default on): fragments nearer than 0.32 m dither out, gone at 0.10 m;
  swaying foliage above its sway base uses 0.22–0.60 m. Bushes or canopies against the eye read as see-through leaves.
- **Near-field grass cards** (`js/perf/grass.js`): crossed quads from `grass_cards` (+ `flower_cards`) in 5 m tiles
  around the camera (radius 20 m, shrunk over 16–20 m; cards that cannot reach 20 m before the next refill are not drawn), density from the splat under each clump (meadow 9 / village
  grass 6 / woods 5 per m², flowers 1.2 / 0.4 / 0.25, none on paths, bridges, sand, snow, dirt, rock or in colliders),
  0.16–0.45 m tall, toon-lit with the terrain ramp, wind sway + Pip push, plain alpha test 0.5 (alpha-to-coverage left a
  pale 1-px stipple on every blade edge on this GPU path) with the atlas's paler rim darkened toward the blade colour.
  **Tinted to the ground**: per splat layer the card tint is the terrain texture's average colour over the cards' (so a
  card at 85 % of its height is the colour of the ground it grows from: dark under the woods canopy, no lime layer at
  night). Cut by the sword's 3D swing volume (≤ 10 clippings bursts and one `sfx('leaves')` per swing), regrow after
  40–70 s out of view. Tiles are generated within 0.6 ms per
  frame (nearer than 10 m at once). Fallback without the card texture (`?noassets`): the grass-tuft mesh at 0.6× within
  15 m. Under 120 k triangles, 2 draw calls.
- **Particles** (`js/fx.js`): the painted `fx_atlas` (16 cells by name from its JSON; the procedural canvas atlas stays
  for SOFT / DOT and replaces each painted cell when the art is missing), near fade (alpha → 0 under 0.35–0.9 m view
  depth), screen-size cap (≤ 0.16 × buffer height within 2 m, ≤ 0.25 beyond). Halos ≤ 1.6 m and faded under 3 m.
- **Night-only point lights** (−0.9 ms by day): every Point / Spot light is `visible = false` while `sky.night < 0.02`
  (hysteresis 0.012); both light sets are compiled and drawn at boot.
- **Warm-up of every shader variant** (`perf.warmup`, called from `main.js`): each mesh is drawn once per light set with
  frustum culling off and every layer on (proxies, hulls, near grass, shadow-only casters, bosses in their arenas, the
  ground telegraphs), so programs, shadow-depth variants and every geometry / texture upload exist before the title;
  plus the dynamic-resolution quad. Instanced meshes draw one instance and the view a 16 px corner (programs and uploads
  do not depend on either), so the GPU is not left chewing on full-island frames when the title comes up (title → first
  measured fps: 0.55 s, was 5–11 s); the loading bar moves between the two light sets. The LOD side and the instance
  fade are uniforms, not defines: **67 programs** after boot in WP7's own copy (was 90; the foundation 31 — every
  program exists once per point-light set); **144** at the title in the merged build after the r2 fixes (120 before them,
  plus 3–6 compiled again and again during play). The warm enemies, bosses and telegraphs are then removed through their
  owners' own `remove()` with `Material.dispose` held (`perf.keepPrograms`), so their programs stay alive and whatever WP5
  adds to them is cleaned up by WP5's code. A tour of all regions × 4 directions, FP and TP, at 12 / 21 / 6.5 / 18 h, all
  six enemy types by day and night, kills, the three boss intros and fights compiles **0** new programs (r2, merged build).
- **r2 (merged build): what the warm-up missed and now covers.**
  - WP5's pop-ups are a material per use, disposed by their owner, so each first sight recompiled them (the sprite
    program at nearly every glint / aura of a boss fight): main.js now warms one '!' alert, glint, aura, crack decal,
    zone (+ rim + pillar) and stripe next to the shockwave / disc / line, all kept through `keepPrograms`.
  - **Shadow-depth variants**: three copies every caster's `map` onto its shared depth material even without an alpha
    test (the depth shader never reads it then) and re-picks that material's program only when the instancing flags flip
    between two casters, so which variant a frame needs depended on the draw order (Pip's GLB body after an instanced
    layer compiled a "depth + map" program at the first hilltop view and the first boss intro, in both light sets). The
    wp7-perf `renderBufferDirect` wrapper drops the map / alphaMap of a depth or distance material without an alpha test
    (no visual change), and `warmDepth()` draws, per light set, casters on layer 30 (seen only by the sun's shadow
    camera, only during the warm-up) that flip instancing / instance colour once per side (front / back / double): all
    9 depth variants exist at boot, whatever order the scene draws its casters in (19 depth programs incl. the Great Tree
    cards' alpha-tested clone; was 7).
  - The late-added gulls / light shafts (wp8-atmo `lateInit`, at the title) are compiled for both light sets (the lamps
    are still on at dawn while the gulls fly).
- **Resolution policy**: the canvas DPR is the cap per `settings.quality` (auto 1.5, low 1.0, high 2.0). **Dynamic
  resolution 0.70–1.0 scales only the main pass**: below 1 the world is drawn into the lower-left w·k × h·k of the canvas
  (outline px, particle sizes and the TP occluder circle follow that size), copied into a texture and stretched over the
  canvas with one quad (bilinear); the viewmodel / item-get passes then draw at full size. A step is just the next pass's
  size: nothing is re-allocated (CPU 0.3 ms, no frame-time change: `out/dyn-trace.json`), so the controller follows arch
  §9.2-7: GPU timer p75 of the main pass every 30 timed frames (rAF time without the extension), one window over 11.5 ms →
  −0.05, four windows under 8.5 ms → +0.05, at most one step per 0.5 s, one step per decision. Off with
  `settings.dynRes = false`, under the manual clock and while `G.debug.perf` samples.
- **Quality** `low`: DPR 1.0, no near grass, 1024² shadow map (lo textures: `assets.js`); `auto` / `high`: 2048².
- **Far plane 300 m** (RULINGS).
- **r3: canopy cutaway (third person).** A scatter tree (pine, snowy pine, round tree, palm) whose axis is within its canopy
  radius + 1.2 m of the camera in the ground plane (and whose top is above the camera) is Bayer-dithered out above its
  canopy base; it comes back over the next 0.8 m (`TUNE.perf.cutaway.band` [1.2, 2.0], per instance: its own origin and
  scale), so nothing pops. The trunk stays (bark is told apart by its vertex colour: red > 1.2 × green; the hull keeps the
  trunk's ink inside the kept trunk radius), the tree keeps its whole shadow (the depth pass never runs the toon
  material). Driven by the render camera's distance from the FP eye (`U.uCutK`, 0 → 1 over 0.2–1.2 m: off at the eye in FP,
  rising through the V blend in ≈ 7 frames, on in TP and shots away from the eye); FP keeps the near fade. Before: Pip
  pressed against a pine put the flat underside of its lowest tier over 25–45 % of the frame (`agents/r3-render/out/cut-v3-a.jpg`,
  `cut-v2-b.jpg`; the lead's `tp-hilltop.png`: the slab is gone in `agents/r3-render/out/tour-r3-tp-hilltop.png`).
  Walking through the woods in TP the canopies of the trees the camera passes dissolve over ≈ 0.2 s and come back behind
  it (`agents/r3-render/out/walk-woods-ab.jpg`). Trees 3 m or more beyond their canopy radius (the lead's `tp-peaks.png`, `tp-meadow.png`
  corners) are ordinary trees in view and are not cut.
- **r3: the boot warm-up also builds WP3's footprint mesh** (it was made on the first print on sand / snow, so its Lambert
  program compiled at the first print in play and again at the first one at night: measured on the merged tree, `agents/r3-render/out/p-play.txt`).
  Boot: 150 programs at the title (144 after r2; + the cutaway's toon and hull variants and the footprints, each per light set).

## 2. Interfaces (new or changed)

### `js/toon.js`
| | |
|---|---|
| `U.uRes` (Vector2), `U.uPxK`, `U.uPassK` | size of the pass being drawn, its px scale (height / 1080, floored at `outlinePxKMin` 0.75 × passK) and the main pass's dynamic-resolution scale (1 except inside a scaled main pass); kept current by `setBufferSize(w, h, passK = 1)` (wp7-perf: resize, quality, around a scaled main pass) |
| `U.uOlCap`, `U.uNearFade`, `U.uNearFadeF`, `U.uOlNear`, `U.uOlThin` | shared values from `TUNE.perf` |
| `toonMat(o)` new options | **C11** `nearFade` (default `true`; `false` = off — the viewmodel passes it; `[a, b]` = own band in m), `px` (accepted; recorded as `material.userData.px`; every shared outline is pixel-width), `instFade: [a, b]` (instanced: scale to 0 by camera XZ distance), `lod: 0 \| 1` + `lodBand: [a, b]` (instanced Bayer crossfade: 0 = the full model fades out, 1 = the proxy fades in). Both are uniforms (no program variant). `material.userData.instFade / lodBand` are the live uniforms. Program key flags: `g s p o m n` only |
| `outlineMat(o)` new options | `px` (px width at 1080p, or `true` = derived from `width`; without it the old world-space mode, used by the viewmodel), `w` (px mode: near floor, metres projected, capped at `outlineCap` px), `far: [a, b]`, `lodBand` + `lod: 0 \| 1`, `instFade` (the hull shrinks with its model) — all uniforms. `userData.px / far / lodBand / instFade / prof / profY`. (`hideNear` is gone: replaced by the profile) |
| `radialProfile(geo) → { y0, y1, r: Float32Array(12) }`, `setHullProfile(mat, prof)` | an instanced hull material gets its model's radial profile: no hull while the eye is inside it + `outlineInside` m (scatter does it for every layer; one material per layer, same program) |
| `sharedOutline(kind)` | pixel-width, widths, near floors and far bands from `TUNE.perf.outline` |
| r3 `toonMat({ cut })`, `outlineMat({ cut })` | `cut = [canopy base, canopy radius, kept trunk radius, top]` (instanced trees): define `CUTAWAY` (program key flag `c`; +1 toon and +1 hull program per light set), uniform `uCut` (`material.userData.cut`) |
| r3 `U.uCutK`, `U.uCutBand` | cutaway amount (0 at the eye … 1 off it; set every frame by wp7-perf `afterCamera`) and its distance band beyond a tree's canopy radius (`TUNE.perf.cutaway.band`) |
| `outlineGeometry(parts)` | unchanged from the foundation: smooth-normal hull, **no decimation** (clustering pulled hulls inside the model: dark ticks on Pip's hood, NPC lines lost at talk distance) |

### `js/scatter.js`
- r3: a tree layer (`cls 'tree'`) carries `L.cut = [canopy base, canopy radius, kept trunk radius, top]` (model units,
  `canopyCut(geo)`: the lowest / farthest non-bark vertex, the bark inside the canopy band ≤ 0.45 m, the bounding top); its
  full model and its hull get it as `toonMat({ cut })` / `outlineMat({ cut })` (one material per tree type). Proxies and
  shadow-only casters have none.
- Every layer's full-model hull has its own outline material with that model's radial profile (eye-in-crown test).
- One layer per prop type instead of one InstancedMesh per (type, 40 m chunk). `Scenery.layers[]`, each `L = { type,
  kind, cls ('tree'|'deco'|'glow'|'small'|'big'), n, items, m0 (full model), ol0 (its hull, own instance buffer), m1
  (proxy), olP (proxy hull, shares m1's buffer), ms (shadow-only casters, layer 4), range, band, slot0/slot1/slotO/slotS
  (item → slot), … }`.
- **Stable ids changed shape**: `p._inst = { L, k }` (was `{ mesh, i }`). `hide(p)` / `show(p, { grow })` keep their
  signatures; `hide` zeroes the item's current slots at once, `show` re-packs it on the next cull. Nothing outside
  scatter used `_inst`.
- `cull(view, force)` (called by wp7-perf every frame; re-packs a layer when the camera moved 1 m, turned by half the
  cone margin, or the sun's shadow box moved), `setBase(on)` (A/B base: everything packed as full models, no fades /
  LOD / outline distance fade), `stats()`, `cullOff`.
- `export const LAYER_SHADOW = 4` — shadow-only casters behind the view (the sun's shadow camera has the layer enabled
  by wp7-perf; the view never draws it). `util.LAYER` does not list it (foreign file).
- `buildGreatTree` / `buildBridges` set `userData.cull = { dist: Infinity }` on their groups.

### `js/perf/perf.js` (module `wp7-perf`)
- Hooks: `attach` (far plane, near grass, light scan, quality, a wrapper around `renderer.render` for the main scene drawn
  to the canvas: GPU timer + the scaled main pass below dyn 1), `afterCamera` (view cone + light box → `scenery.cull`,
  lights, C10 culler, grass), `afterStep` (grass cut), `afterRender` (timer poll, dynamic resolution), `onResize`,
  `onTitle`.
- `renderBufferDirect` is wrapped too (r2): a MeshDepth / MeshDistance material without an alpha test (or alpha hash)
  loses its `map` / `alphaMap` before the draw (they only feed the alpha test), so its program key no longer depends on
  which caster happened to trigger a re-pick. `warmDepth() → { group, dispose() }` (the warm-up's depth-variant casters).
- `export function dprFor(quality)`; `async warmup(renderer, scene, camera, between?)` (`between(lightsOn)` runs after
  each light set; main.js moves the loading bar there); `keepPrograms(fn) → n` (runs owners' teardown with
  `Material.dispose` held; the materials go into `keep`); `keep` (array of kept materials, never drawn again);
  `setDyn(k)` (main pass scale, no canvas work); `pass` (`[w, h]` of the last scaled main pass, null at 1); `up` (the
  stretch quad: `{ mat, scene, cam, tex }`).
- **C10 generic culler**: every `Object3D` in the scene, at any depth, with `userData.cull = { dist, fade }` is hidden
  beyond `dist` (`Infinity` = never); with `fade > 0` it shrinks (scale × k, the owner's own scale kept as the base; a
  scale the owner changes meanwhile becomes the new base) over the last `fade` metres. Direct children of
  `scenery.root` without it are classified by bounding radius (≤ 0.6 m → 60 m, ≤ 2.5 m → 110 m, larger → never) and
  only hidden (beyond dist + 3 m, no scale change). Instanced meshes are never touched unless they carry
  `userData.cull`. **Spread-out objects (r2)**: one whose bounds reach farther than `TUNE.perf.objSpread` (6 m) from its
  origin is measured by the nearest point of its bounding sphere and only hidden, never scale-faded (WP9 keeps every lamp /
  edge stone / waymarker / sign board of the island in one instanced or merged mesh with its origin at the island centre:
  by the origin, all of them shrank toward the centre and vanished 60–120 m out, also the ones beside Pip). **Visibility**: a tracked object's `visible` becomes an accessor (`get` = the owner's value and not
  culled, `set` = the owner's value), so the culler never writes the owner's flag: an object the owner hides — also
  while it is culled — stays hidden until the owner shows it. An object that leaves the scene (or the culler) gets its
  own scale back. Re-scan every 2 s (new objects are picked up by then).

### `js/fx.js`
- `SHAPE` gains the painted cells `PUFF 4, SPARKLE 5, STAR5 6, PETAL 7, LEAFP 8, SNOW 9, DROP 10, IMPACT 11, SMOKE 12,
  HEART 13, ALERT 14, CHIPS 15, SHARD 16, CLIP 17, RING 18, STREAK 19` (SOFT 0, STAR 1, LEAF 2, DOT 3 unchanged; STAR is
  drawn as the painted sparkle when the atlas is there). Without the atlas each painted cell falls back to its closest
  procedural cell. A later `fx_atlas` (quality raised, lo → full) is swapped in through `Assets.onTex`.
- `FX.clippings(x, y, z, n, colors)` (grass cut). Every existing function keeps its signature; dust / sparks / poof /
  leaves / shards / splash / snowBurst / burst / petals use the painted cells and slightly smaller sizes.
- Particle shader: near fade `TUNE.perf.pNear`, size cap `pCapNear / pCapFar`. Halos: `TUNE.perf.haloNear / haloMax`.

### `js/main.js` (renderer-setup block)
- `renderer.setPixelRatio(dprFor(settings.quality))` (was `min(dpr, 1.75)`), camera far `TUNE.perf.far` (300, was
  1400), warm-up list + three bosses + one shockwave / disc / line / crack / alert / glint / aura / zone / stripe (r2;
  each in try / catch), `await perfMod.warmup(…)` (replaces
  the foundation's `compileAsync` + render), then `perfMod.keepPrograms(() => { e.remove(); b.remove();
  fx.ground.remove(it); })`.
- `game.state = 'boot'` at the start of the warm-up block: the Game is constructed in `'title'`, and the boot yields to the
  browser (loading bar) before `showTitle()`; test drivers that wait for `'title'` (the harness, `newGame` scripts) used to
  start mid-boot (the 'all' suite's `fps` flake, and with a yielding warm-up `game.runFrame` did not exist yet).

## 3. TUNE, settings, sounds, events, debug

- **`TUNE.perf`**: `far, cull{deco, decoFade, glow, glowFade, small, smallFade, big}, lodBand [38, 48], lodTris 180,
  lod{small, glow, big} [start, end, tris], lodMin, lodMinTotal, coneMargin, coneMarginDeco, repackMove, nearAll,
  shadowPad, shadowFullR, outline{char, prop, propOcc, big, tree, bush}{px, w, far}, outlineCap, outlinePxKMin,
  outlineInside, outlineNear, outlineThin, nearFade, nearFadeFoliage, objCull, objScanEvery, dprCap{auto, low, high},
  dynMin 0.70, dynStep 0.05, dynHi 11.5, dynLo 8.5, dynEvery 30, dynHiWins 1, dynLoWins 4, dynGap 0.5, shadowLow,
  shadowHigh, grass{…, clipFx, alphaTest, groundMatch, tintMid}, pNear, pCapNear, pCapFar, haloNear, haloMax`, `objSpread`
  (r2: 6 m). Removed in
  the fix round: `hullMax`, `dynCalm`, `dynForce`.
- **Settings read live** (C17): `quality` (DPR cap, near grass, shadow map size), `dynRes`. No new keys.
- **Sounds**: `sfx('leaves', { x, y, z, vol })` once per sword swing that cuts near grass (a C8 name).
- **Events**: none emitted or consumed.
- **Debug** (`G.debug.perf` keeps the foundation's sampler function and gains): `perf.state()` → `{ dpr (the canvas),
  dyn, dynHold, pass ([w, h] of the scaled main pass or null), quality, lights, lightsForced, nLights, view {full, half,
  cone, box}, cullOff, scatter (per-layer packed counts), objs {tracked, hidden}, grass {on, cards, tiles, cached, grass,
  flowers, blades, cuts, sfx, tris}, ms {cull, obj, grass}, far, timer }`, `perf.cull(on = true)` (false = A/B base),
  `perf.dyn(k?)` (k: main pass scale held, also under the manual clock, until `dyn(null)`), `perf.lights(on?)` (the set
  is held until `lights(null)`), `perf.grass(on?)`, `perf.repack()`.
- r3 **`TUNE.perf.cutaway`** `{ band: [1.2, 2.0], on: [0.2, 1.2] }` (m beyond a tree's canopy radius: full cut / back; camera
  distance from the eye over which it switches on).
- r3 tests: new `wp7` test **canopy cutaway** (a pine drawn alone with its layer materials: under the lowest tier only the
  trunk is left, beside the rim the canopy is gone, the trunk keeps its coverage, half-way through the band partly
  dithered, beyond the band and from above the top untouched, `uCutK` 0 in FP and rising to 1 without a jump through the V
  blend, no cutaway in the shadow pass); **warm-up covers what play makes later** also prints footprints on sand and snow
  by day and night (0 new programs); **stable ids** is independent of test order: whatever earlier suites cut grows back
  first, so the candidates are always every cuttable in a fixed order (asserted), and a pick the random approach cannot
  cut is tried from two more sides (the 50 cuts are unchanged).
- **Suites** (`js/debug/tests/wp7.js`): `wp7` (in `'all'`, 21 tests since r3, 20 since r2: C10 (incl. owner-hidden while culled;
  r2: a spread-out instanced mesh stays drawn at its own size beside Pip 100 m from its origin; only owner-tagged
  instanced meshes are tracked, never a scatter layer / hull / near grass — the old "no instanced mesh at all" encoded a
  copy without WP9), **r2: the warm-up covers what play makes later** (WP5 pop-ups made and disposed twice by day and
  night, dawn with the lamps on and the gulls out, a mapped caster drawn after an instanced one in the shadow pass: 0 new
  programs), stable ids (r2: 20 candidates per kind in a fixed order for the 50 cuts, the regrowth checked on the picks
  that were cut, regrown from 4 spots facing both ways), C11,
  visibility audit over 48 random views, LOD bands, proxy silhouettes, shadow casters, 50 cuts with stable ids, night
  lights + dual warm-up + `perf.lights(true)` holding, warm-up tour, resolution (canvas untouched, a step is free, the
  stretched 0.8 frame matches the full one, one step per decision), quality low, near grass (one `leaves` per swing),
  particles, **eye inside a pine tier / round crown / bush: no hull flood** (and the flood is seen with the profile off),
  **outline widths** (char ≥ 6 px at 1.3 m, ≈ 2–3 px at 30 m, phone px floor), **no decimated hull** (Pip, NPCs, props),
  **warm-up teardown** (kept materials drawn by nothing, a disposed-while-held program stays), far plane / helpers),
  heavy `wp7-hitch` (first night, first enemy of each type, view switches, resolution steps 1 → 0.7 → 1 while walking and
  turning, first boss intro: CPU frame ≤ 50 ms and 0 new programs; run it first in a fresh page) and heavy `wp7-sweep` (`run('wp7-sweep', { modes, locs, dirs, ms, reps, settle, time, gate })`: per view
  calls / tris split main · shadow · viewmodel, real-frame GPU min of medians, render-only GPU bench `benchGpu`).

## 4. What in ARCHITECTURE.md is no longer true

- §2 file map: add `js/perf/lod.js`, `js/perf/grass.js` (WP7).
- §6 "`toonMat` accepts and ignores `nearFade` and `px` until WP7 implements them": implemented (§2 above).
- §14/§17: `G.debug.perf` is also a namespace (state, cull, dyn, lights, grass, repack).
- §16: `TUNE.perf` is no longer empty.
- §18: suites `wp7`, `wp7-hitch`, `wp7-sweep`.
- §3 / §12: `G.game.state` is `'boot'` from the warm-up until `showTitle()` (before: `'title'` from the Game constructor
  on, while the boot was still running). Anything waiting for the title now waits for the real one.
- §3: below dynamic-resolution 1 the main pass (`renderer.render(game.scene, camera)` to the canvas) is drawn into the
  lower-left part of the canvas and stretched over it (one extra quad draw + a framebuffer copy); `renderer.getPixelRatio()`
  is the quality cap, not the dynamic scale.
- Render facts from `maps/render.md` that no longer hold: camera far 1400 → 300; per-chunk scatter meshes → per-type
  layers with CPU packing; `p._inst = { mesh, i }` → `{ L, k }`; view-space outline extrusion → clip-space px with a near
  world-width floor; DPR cap 1.75 → per quality; the 5 point lights are hidden by day; particle sizes are capped and
  near-faded; layer 4 is used.
- §19: "`G.debug.perf` and the sweep measure one repetition per view" — `wp7-sweep` takes the minimum of 3 medians and a
  render-only bench.
- §3 / §6 (r2): `renderer.renderBufferDirect` is wrapped by wp7-perf (depth / distance materials without an alpha test
  lose their map); layer 30 is used by the boot warm-up only (the sun's shadow camera enables it for the warm-up).

## 5. Notes for the merge (other packages)

- **C10 consumers (WP5, WP8, WP9)**: put `userData.cull = { dist, fade }` on what you add (landmarks `{ dist: Infinity }`).
  Props added through `W.addProp` with a `PROP_KIND` are instanced by scatter automatically: their class comes from the
  kind and bounding radius, a heavy layer (model > 400 triangles and > 20 k in total) gets a proxy + hull, LOD band per
  class. Nothing to do.
- **C11 consumers**: `toonMat` near-fades by default. Pass `nearFade: false` only for things drawn in their own pass at
  the eye (the viewmodel does). A material that must not show its inside at the eye needs nothing.
- **WP5**: `Enemy.remove()` disposes the enemy's materials, which releases shared programs when the last user goes (the
  slime's see-through body was recompiled at every first slime). The boot warm-up now tears its enemies, bosses and
  ground telegraphs down with **your own** `remove()` / `fx.ground.remove(it)` (whatever you add — alerts, walls, shadows —
  you clean up), inside `perfMod.keepPrograms(…)`, which holds `Material.dispose` for that call and keeps the materials.
  If WP5 adds a material variant per enemy state (e.g. a transparent emerge), make one exist at boot (main.js's warm list
  constructs every type once) so it is warmed and kept the same way. The `fx.ground.*` warm calls are in try / catch.
- **WP8**: the 300 m far plane clips the old 3D cloud ring (170–330 m) and anything else on the sky until WP8's sky layer
  lands (RULINGS). The near grass reads `W.splatA / splatB / splatK / pathDAt / slopeAt / hAt / nearColliders /
  bridgeAt`; if the splat layout changes it falls back to `W.surfaceAt(x, z) === 'grass'`. The culler reads the sun's
  shadow box from `sky.sun.position / target / shadow.camera` (ortho left/right/top/bottom) every frame, so a moved or
  enlarged box (WP8's E 36 ahead of the eye) is followed automatically. Point lights WP8 adds are toggled with the
  night set unless they carry `userData.alwaysOn`.
- **WP2**: the viewmodel already passes `nearFade: false`. Pip's body in TP also gets NEAR_FADE under 0.32 m (on top
  of `view.bodyFade`).
- **WP9**: a bigger Great Tree (×2.2) is a non-instanced group with `userData.cull = { dist: Infinity }` — keep it.
  Village dressing as instanced props is cheapest; as groups, give them `userData.cull`.
  r2: `userData.cull` culls an object as a whole. An island-wide instanced or merged mesh (lamps, edge stones,
  waymarkers, sign boards) is now culled by its nearest point and never shrunk, so it is effectively always drawn; for a
  per-instance distance fade use `toonMat({ instFade: [a, b] })` / `outlineMat({ instFade })` on its materials (each
  instance scales to 0 by its own camera distance, as the scatter deco does).
- `renderer.render` is wrapped by wp7-perf (GPU timer + the scaled main pass, main scene to the canvas only, never nested
  with `game.gpuT`); another package that wraps it too should call through.
- **Dynamic resolution and other passes (WP2, WP8)**: passes drawn after the main pass (viewmodel, item-get) draw at full
  size on top of the stretched image — nothing to do. Anything that must be part of the scaled world image has to be in
  `game.scene` (arch §9.2-4 puts the sky-layer objects there); a separate pass drawn to the canvas *before* the main scene
  would be covered by the stretched quad below dyn 1. Inside the main pass `U.uRes / uPxK / uPassK` describe the scaled
  pass and `U.uOccC / uOccR` are scaled with it; a shader of the main scene that uses `gl_FragCoord` positions should
  take them from `U.uRes`, not the canvas size.

## 6. Before / after (1920×1080, noon pinned, uncapped, 9 locations × 4 directions incl. the 3 arena fights, FP and TP)

How it was measured (the GPU was shared with 3–4 other agents' browsers the whole time, load average 9–17 on 16 threads,
so absolute milliseconds are inflated and noisy; counts are exact):
- **calls / tris before**: the foundation `sweep` suite in the untouched copy (`agents/r1-WP7-build/sweep-before.json`,
  whole frame: main + shadow + viewmodel). **After**: `wp7-sweep` on the final code (whole frame, and main · shadow split).
- **GPU bench**: the same render-only method on both builds in back-to-back runs (`n/bench.mjs`: 24 synchronous main
  passes = shadow + world, TIME_ELAPSED queries, 3 repetitions, minimum p50 and its p90), foundation on port 8791 vs
  this copy on 8807. **Real-frame GPU**: the foundation sweep's `gpuMain` (often missing: disjoint queries on a shared
  GPU); after: not recorded per view (the sweep's real-frame samples were all disjoint in this run).

Summary: worst view **776 → 188 draw calls** (main ≤ 167, shadow ≤ 36), **4.16 M → 1.12 M triangles** (main ≤ 1.04 M),
same-method GPU bench worst view **15.1 → 8.75 ms p50**, median view × 0.69 (FP) / × 0.72 (TP). Over the 8.5 ms p50 /
11 ms p90 budget in this contended run: only `arena-woods-S` (FP 8.45 / 11.6, TP 8.75 / 10.2).

| view | calls before → after (main · shadow) | tris before → after (main), M | GPU bench p50 / p90 ms before → after | real-frame GPU p50 before → after |
|---|---|---|---|---|
| fp village-S | 318 → 134 (96 · 36) | 1.61 → 0.61 (0.52) | 7.7/8.7 → 4.8/5.1 | 6.9 → – |
| fp village-E | 331 → 133 (96 · 35) | 1.53 → 0.64 (0.55) | 7.9/9.2 → 6.3/6.7 | 7.1 → – |
| fp village-N | 397 → 143 (108 · 33) | 2.77 → 0.74 (0.66) | 13.1/13.6 → 7.2/7.6 | 11.2 → – |
| fp village-W | 326 → 148 (112 · 34) | 2.26 → 0.67 (0.58) | 9.9/10.2 → 6.9/7.4 | 8.9 → – |
| fp woods-S | 591 → 173 (147 · 24) | 3.13 → 0.96 (0.89) | 10.8/11.7 → 6.0/6.2 | 10.3 → – |
| fp woods-E | 296 → 107 (81 · 24) | 1.70 → 0.74 (0.68) | 8.2/8.7 → 7.9/8.2 | 9.6 → – |
| fp woods-N | 171 → 90 (60 · 28) | 1.71 → 0.73 (0.66) | 10.0/10.3 → 6.5/6.7 | – → – |
| fp woods-W | 300 → 103 (77 · 24) | 2.48 → 0.81 (0.74) | 9.9/10.4 → 7.0/7.5 | – → – |
| fp peaks-S | 316 → 110 (88 · 20) | 1.17 → 0.39 (0.37) | 6.2/6.5 → 4.3/4.5 | 5.8 → – |
| fp peaks-E | 132 → 69 (48 · 19) | 0.40 → 0.29 (0.26) | 5.0/5.5 → 4.4/4.5 | 4.4 → – |
| fp peaks-N | 283 → 103 (80 · 21) | 1.76 → 0.51 (0.48) | 8.2/9.2 → 5.3/5.5 | 7.1 → – |
| fp peaks-W | 569 → 178 (157 · 19) | 3.40 → 0.71 (0.68) | 11.9/13.0 → 6.3/6.5 | 14.5 → – |
| fp shores-S | 163 → 88 (63 · 23) | 0.82 → 0.47 (0.43) | 5.7/5.9 → 4.5/4.7 | – → – |
| fp shores-E | 240 → 82 (63 · 17) | 1.00 → 0.50 (0.46) | 6.4/6.7 → 4.9/5.4 | 8.1 → – |
| fp shores-N | 641 → 173 (150 · 21) | 3.82 → 0.87 (0.83) | 13.9/14.7 → 7.6/8.7 | 12.9 → – |
| fp shores-W | 253 → 104 (77 · 25) | 1.71 → 0.57 (0.52) | 7.7/8.0 → 4.5/4.7 | – → – |
| fp meadow-S | 257 → 97 (67 · 28) | 1.57 → 0.62 (0.57) | 7.8/8.2 → 7.5/7.9 | 9.5 → – |
| fp meadow-E | 660 → 180 (153 · 25) | 3.72 → 1.01 (0.97) | 13.0/13.7 → 8.2/9.1 | 13.7 → – |
| fp meadow-N | 276 → 91 (65 · 24) | 2.45 → 0.71 (0.67) | 9.8/10.2 → 7.9/9.1 | – → – |
| fp meadow-W | 113 → 80 (51 · 27) | 0.83 → 0.46 (0.42) | 5.8/6.4 → 6.3/6.5 | – → – |
| fp hilltop-S | 197 → 76 (63 · 11) | 0.74 → 0.29 (0.27) | 6.3/6.8 → 3.8/4.2 | – → – |
| fp hilltop-E | 93 → 49 (35 · 12) | 0.26 → 0.22 (0.19) | 4.8/5.5 → 3.7/4.1 | – → – |
| fp hilltop-N | 377 → 106 (90 · 14) | 2.20 → 0.49 (0.47) | 8.7/9.3 → 5.0/5.7 | – → – |
| fp hilltop-W | 618 → 176 (160 · 14) | 3.30 → 0.65 (0.63) | 14.1/15.2 → 7.7/10.4 | 17.9 → – |
| fp arena-woods-S | 725 → 185 (162 · 21) | 3.97 → 1.12 (1.04) | 13.8/14.3 → 8.4/11.6 | – → – |
| fp arena-woods-E | 258 → 86 (62 · 22) | 1.64 → 0.69 (0.62) | 9.6/9.9 → 7.8/8.0 | – → – |
| fp arena-woods-N | 89 → 53 (35 · 16) | 1.07 → 0.45 (0.39) | 7.5/7.8 → 5.7/6.0 | – → – |
| fp arena-woods-W | 245 → 93 (70 · 21) | 2.14 → 0.70 (0.64) | 8.8/9.5 → 6.9/7.1 | – → – |
| fp arena-peaks-S | 282 → 79 (64 · 13) | 1.11 → 0.37 (0.33) | 7.0/7.5 → 4.0/4.4 | – → – |
| fp arena-peaks-E | 64 → 48 (34 · 12) | 0.31 → 0.23 (0.18) | 4.8/5.3 → 3.6/4.0 | 5.4 → – |
| fp arena-peaks-N | 195 → 70 (55 · 13) | 1.30 → 0.38 (0.34) | 6.6/8.6 → 4.2/4.5 | – → – |
| fp arena-peaks-W | 701 → 178 (163 · 13) | 3.95 → 0.74 (0.69) | 12.0/13.0 → 5.4/5.6 | 13.4 → – |
| fp arena-shores-S | 61 → 38 (21 · 15) | 0.45 → 0.27 (0.21) | 4.3/4.8 → 3.4/3.6 | 3.8 → – |
| fp arena-shores-E | 129 → 64 (46 · 16) | 0.61 → 0.35 (0.29) | 4.6/5.1 → 3.5/3.8 | 4.5 → – |
| fp arena-shores-N | 776 → 172 (152 · 18) | 4.16 → 0.89 (0.83) | 14.4/14.9 → 6.8/7.7 | 12.4 → – |
| fp arena-shores-W | 233 → 92 (73 · 17) | 1.40 → 0.48 (0.41) | 7.3/8.5 → 5.0/5.3 | – → – |
| tp village-S | 313 → 129 (93 · 36) | 1.59 → 0.59 (0.50) | 8.2/9.3 → 6.8/7.2 | 8.1 → – |
| tp village-E | 323 → 134 (99 · 35) | 1.41 → 0.63 (0.55) | 9.9/10.5 → 6.7/7.3 | 8.0 → – |
| tp village-N | 398 → 145 (112 · 33) | 2.81 → 0.74 (0.65) | 14.4/15.1 → 8.0/8.9 | 15.3 → – |
| tp village-W | 320 → 151 (117 · 34) | 2.14 → 0.65 (0.57) | 9.5/9.9 → 6.5/6.9 | – → – |
| tp woods-S | 574 → 172 (148 · 24) | 3.09 → 0.98 (0.91) | 10.8/11.3 → 7.6/8.5 | 13.0 → – |
| tp woods-E | 291 → 107 (81 · 26) | 1.69 → 0.75 (0.69) | 9.2/9.5 → 8.1/8.5 | 9.4 → – |
| tp woods-N | 164 → 80 (56 · 24) | 1.71 → 0.74 (0.67) | 10.0/10.1 → 7.9/8.1 | – → – |
| tp woods-W | 296 → 109 (80 · 29) | 2.43 → 0.81 (0.74) | 10.5/10.7 → 7.4/7.6 | – → – |
| tp peaks-S | 314 → 107 (85 · 22) | 1.18 → 0.40 (0.37) | 7.2/7.7 → 5.1/5.4 | 9.2 → – |
| tp peaks-E | 134 → 69 (50 · 19) | 0.43 → 0.30 (0.28) | 5.8/5.9 → 4.8/5.1 | 6.4 → – |
| tp peaks-N | 269 → 94 (71 · 23) | 1.76 → 0.50 (0.47) | 8.1/8.8 → 6.0/6.3 | – → – |
| tp peaks-W | 533 → 172 (152 · 20) | 3.11 → 0.69 (0.67) | 11.4/11.6 → 6.1/6.5 | 13.4 → – |
| tp shores-S | 163 → 99 (75 · 24) | 0.82 → 0.49 (0.45) | 6.1/6.3 → 5.3/5.8 | 7.0 → – |
| tp shores-E | 219 → 82 (66 · 16) | 0.99 → 0.51 (0.48) | 7.3/7.6 → 5.5/6.5 | 8.4 → – |
| tp shores-N | 652 → 163 (147 · 16) | 3.82 → 0.85 (0.81) | 13.7/15.8 → 7.8/8.8 | 15.3 → – |
| tp shores-W | 244 → 102 (77 · 25) | 1.61 → 0.57 (0.53) | 8.6/9.0 → 5.3/5.4 | – → – |
| tp meadow-S | 253 → 98 (73 · 25) | 1.54 → 0.64 (0.60) | 8.7/9.3 → 7.4/7.6 | 7.9 → – |
| tp meadow-E | 633 → 171 (145 · 26) | 3.66 → 0.99 (0.94) | 11.8/12.4 → 8.0/8.4 | 14.0 → – |
| tp meadow-N | 269 → 91 (65 · 26) | 2.52 → 0.72 (0.68) | 10.0/10.4 → 8.1/8.4 | – → – |
| tp meadow-W | 116 → 84 (56 · 28) | 0.86 → 0.50 (0.45) | 6.6/6.8 → 7.0/7.4 | – → – |
| tp hilltop-S | 171 → 68 (56 · 12) | 0.71 → 0.28 (0.26) | 5.9/6.2 → 4.4/4.6 | – → – |
| tp hilltop-E | 92 → 49 (37 · 12) | 0.28 → 0.23 (0.20) | 4.9/5.2 → 3.8/4.0 | – → – |
| tp hilltop-N | 343 → 98 (85 · 13) | 2.05 → 0.49 (0.47) | 10.6/10.8 → 6.0/6.2 | 12.0 → – |
| tp hilltop-W | 602 → 165 (152 · 13) | 3.25 → 0.64 (0.62) | 12.9/13.4 → 6.9/7.4 | 15.8 → – |
| tp arena-woods-S | 713 → 188 (167 · 21) | 3.95 → 1.11 (1.04) | 13.2/14.1 → 8.8/10.2 | 12.8 → – |
| tp arena-woods-E | 232 → 86 (64 · 22) | 1.61 → 0.69 (0.62) | 9.9/10.5 → 7.3/7.7 | 9.5 → – |
| tp arena-woods-N | 95 → 59 (43 · 16) | 1.11 → 0.49 (0.43) | 6.9/7.0 → 6.1/6.4 | – → – |
| tp arena-woods-W | 225 → 93 (72 · 21) | 2.03 → 0.72 (0.65) | 8.9/10.0 → 7.2/7.9 | 8.6 → – |
| tp arena-peaks-S | 265 → 80 (67 · 13) | 1.01 → 0.37 (0.33) | 7.1/7.4 → 5.0/5.2 | 5.9 → – |
| tp arena-peaks-E | 72 → 52 (40 · 12) | 0.36 → 0.25 (0.20) | 5.0/5.2 → 4.1/4.5 | 4.4 → – |
| tp arena-peaks-N | 184 → 68 (55 · 13) | 1.18 → 0.39 (0.34) | 7.0/7.2 → 4.1/4.5 | 6.3 → – |
| tp arena-peaks-W | 683 → 176 (163 · 13) | 3.92 → 0.74 (0.69) | 11.2/11.9 → 5.2/6.0 | 11.1 → – |
| tp arena-shores-S | 67 → 42 (27 · 15) | 0.48 → 0.29 (0.23) | 4.7/5.0 → 3.4/3.8 | 4.9 → – |
| tp arena-shores-E | 109 → 66 (50 · 16) | 0.58 → 0.36 (0.30) | 5.8/6.2 → 4.2/4.7 | 5.8 → – |
| tp arena-shores-N | 755 → 173 (155 · 18) | 4.10 → 0.89 (0.82) | 15.1/16.5 → 8.2/8.9 | 15.7 → – |
| tp arena-shores-W | 210 → 85 (67 · 18) | 1.37 → 0.46 (0.40) | 8.6/8.9 → 5.4/5.9 | – → – |

## 7. Evidence (scratch: `S/agents/r1-WP7-build/`)

- `n/sheet-look3.jpg`, `n/sheet-look4.jpg`: foundation vs this copy, the same 8 views (FP / TP, noon and 21:30).
- `n/crop2.jpg`: the far forest, foundation / first convex-hull proxies (palms broken, pale crowns) / final proxies with
  their own outline. `n/gal4.jpg`, `n/gal5.jpg`: full model vs proxy per type at 18 / 35 / 45 / 60 m.
- `n/walk-{woods,meadow,shores}.jpg`, `n/walktp-{woods,meadow}.jpg`: scripted 10 s walks along the paths (manual clock,
  a frame every 0.25 s), culled | base (`G.debug.perf.cull(false)`: everything at full detail) | difference.
  `n/walk-*-stats.txt`: pixels that differ culled vs base (mean 0.2–1.1 %, max 1.9 %, all of it at the far tree line
  and in random dust puffs) and a pop metric (change between consecutive frames that the base walk does not share: flat,
  no spike).
- `n/sheet-shadows.jpg`: tree shadows culled vs base at 16:36.
- `n/sheet-noassets.jpg`: `?noassets=all` (grass-tuft fallback, canvas particles) and the phone viewport.
- `n/trace-final.json`: 12 s real-time sprint village → woods with a fast 180° turn every 2 s at 1080p: CPU frame p50
  8.6 / p99 18.8 / max 24.9 ms, 0 frames over 25 ms, wp7 cull ≤ 3.3 ms, grass ≤ 2.6 ms, 0 new programs (rAF intervals
  are dominated by the shared GPU).
- `n/bench-{found,mine}-{fp,tp}.json`, `n/sweep-after-*.json`, `sweep-before.json`, `n/table.md`.
- Fix round 1 (`S/agents/r1-WP7-fix-r1/out/`): `ab-pine.jpg` (FP at 1.6 / 1.0 / 0.6 m from a pine trunk and the TP camera
  inside a tier: foundation | now), `ab-chars.jpg` + `crop-pip.jpg` (Pip TP boom 1.8 / 3.0, Miso, Shellby, Clover at
  1.3 m), `ab-props.jpg` (bush at 1.3 / 0.9 m / eye inside, tree, rock, both bosses at 2 m), `ab-env.jpg` + `crop-peaks.jpg`
  (woods, peaks, village, night: tier creases), `crop-grass2.jpg` (foundation | before the fix | now: night stipple gone,
  cards in the ground's colour), `fringe.jpg` (alpha-to-coverage isolated as the stipple's cause), `dyn-trace.json` +
  `dyn-sheet.jpg` + `dyn3.jpg` (steps while walking: 16.6–16.8 ms frames, canvas unchanged; 0.7 vs 1.0 incl. the TP
  occluder circle and particles), `sweep-after-fix.json` (56 views, gate pass: worst main 165 calls / 1.09 M tris),
  `bench-*.json` (TP heavy views, worst 8.76 ms p50 vs the foundation's 15.76 on a GPU shared with another agent),
  `progs-8807.json`, `sheet-play.jpg`, `sheet-port.jpg`, `out/play/*.txt` (FP, TP, `?noassets=all` both, phone landscape
  and portrait: 0 errors).

## 8. Known issues, deviations and cuts

- **GPU budget not proven on an idle machine**: every measurement ran with 3–4 other browsers on the GPU. Same-method
  worst view 8.75 ms p50 (`arena-woods-S`), budget 8.5.
- **Deviations from arch §9.2**: tree LOD band 38–48 m (arch 45–55) and proxies ≤ 180 triangles (arch ≤ 150), both
  because the fitted proxies hold up close and trees are the largest GPU cost; proxies keep an outline hull to the far
  plane (arch: no hulls beyond 55 m) because without it the far forest read pale and sparse; near grass radius 20 m.
- Deviation from arch §9.2-7 (dynamic resolution): it scales the main pass, not the DPR (the canvas is allocated once at
  the quality's cap; re-allocating it cost 75–530 ms of main thread per step here, which is why the first build had to
  defer steps to calm frames, and stacked deferred steps into one 1.0 → 0.7 jump). Its numbers are arch's (±0.05,
  ≥ 0.5 s apart, p75 > 11.5 ms down, < 8.5 ms up) except that a window is 30 *timed* frames = 60 frames (the GPU timer
  measures every other frame; queries cannot overlap), so "up after 120 frames" is 4 windows = 240 frames.
- Deviation from arch §6.4 (outline width): pixel-constant only beyond a few metres; near the eye the foundation's world
  width (× 0.75) is the floor, capped at 8 px at 1080p, after the review found the 2.3–2.8 px line unreadable on near
  characters, bosses and props (the art bar).
- Boot: 67 programs (foundation 31) because every program exists once per point-light set (arch §9.2-6 pre-compiles both
  at boot; three.js keys even light-free shader materials by the light count). Navigation → title was 8.8–10.9 s against
  the foundation's 3.9–8.6 s on the loaded machine; the multi-second frozen first frame after the title is gone.
- Grass cards use a plain alpha test (no alpha-to-coverage): slightly harder edges, no stipple.
- The old 3D cloud ring (sky.js, 170–330 m) is partly beyond the 300 m far plane until WP8's sky layer replaces it.
- Cut: `surf_detail` near-detail on props (optional in the brief).
- A ground telegraph or enemy material variant created later than boot (WP5) and disposed when its owner goes would
  compile again at its next first sight (see §5). r2: WP5's alert / glint / aura / crack / zone / stripe are warmed and kept by main.js; a new kind
  added later needs a line there too.
- r2: a new shadow caster type that is skinned or morphed (none today) would add depth variants `warmDepth` does not draw.
- r3: the canopy cutaway cuts every scatter tree within its radius + 1.2 m of the TP camera, which includes a tree Pip
  walks right beside (the camera is 2.6 m behind him): its canopy dissolves and its bare trunk (with its flat top, 2.3–2.5 m)
  stays. In a static frame inside the 0.8 m band a canopy shows the 4 × 4 Bayer stipple of the game's other dithers.
- r3: a lazily created material in another package (built on first use and never in the scene at boot, like WP3's
  footprints were) still compiles at first sight; the play tour `agents/r3-render/p-play.js` (walks on sand / snow,
  wading, dash, jump, swing, hurt, potion, item-get and place cutscenes, day and night, FP and TP) finds none now.

## 9. Round 4 (final gate)

- **Canopy cutaway: beside or behind the camera only** (`toon.js` `CUT_VERT`, uniforms `U.uCutFwd` (view forward x, z;
  Pip's depth along it), `U.uCutDepth`, `U.uCutHigh`; `perf.afterCamera` sets `uCutFwd` while `uCutK > 0`; `TUNE.perf.cutaway`
  `depth` [−0.75, −0.15], `depthMin` 1.0, `high` [1.4, 1.9]): the amount is now also × (1 − smoothstep(depth band around
  Pip's depth, the tree axis's depth)) × (1 − smoothstep(high, canopy base − camera y)). The TP camera 2.6 m behind Pip
  put the tree he walks up to inside the band (a round tree 0.6–0.9 m ahead: 0.60 cut, a screen door; a palm to 1.6 m:
  1.0) and a palm looked up at lost its fronds. Now a tree at or past Pip's depth keeps its crown, and so does one whose
  canopy base is ≥ 1.9 m over the camera (palms ≈ 2.3 m; pines and round trees 0.2–1.2 m on flat ground). The bands are
  narrow on purpose: a crown inside one is part-dithered. Walking past a tree 1.6 m to the side it dissolves over 7
  frames (round tree) / 18 (pine), at most 0.18 per frame (`S/agents/r4-fix/pass.mjs`, `pass-round.jpg`): no pop. Evidence: `S/agents/r4-fix/cut-sheet.jpg`
  (faced round tree / pine / palm at 0.6–3 m; palm and round tree looked up at, TP vs FP), `cut2-sheet.jpg` (r3 vs r4 in
  the r3 views and 8 spots with a tree beside the camera: identical except trees at Pip's depth, now whole). Test (wp7,
  the r3 cutaway test): the faced tree untouched, the same tree short of Pip cut, a crown 2.3 m over the camera untouched.
- **Lost WebGL context** (`debug/gpu-timer.js`, `perf.contextLost / contextRestored`): the timer listens on the canvas —
  lost: open and pending queries forgotten (never deleted), nothing timed (`ok` false); restored: the extension fetched
  again (`restored` counts); `poll()` drops a query whose availability reads null; `dispose()` removes the listeners. perf
  pauses dynamic resolution while lost and starts over at 1 on restore. `S/agents/r4-fix/ctx2.mjs` (a player build, a real
  `WEBGL_lose_context`): pending stayed at 2 (was 103 → 823), 0 WebGL warnings (was 257), dyn back to 1. Test (wp7):
  "r4 lost WebGL context …" (a stand-in context: lost, restored, a stale query; perf's reset).
