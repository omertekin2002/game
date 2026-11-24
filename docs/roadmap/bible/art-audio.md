# Art and audio

The game bible's art and audio file. It owns the look and the sound of Starseed Isle: the style guide and the
image-prompt preamble, the processing pipeline, manifest key naming, every per-realm asset list (size, prompt,
processing, key, fallback), the PWA bundle budgets, the ART BRIEF template and the index of owner GLB briefs, key art,
act cards and loading cards, every music track and ambience bed as note data, and the SFX bank.

It does **not** own character looks (`./cast.md`), enemy and boss looks (`./creatures.md`), prop lists and placements
(`./atlas-home.md`, `./atlas-isles.md`, `./atlas-far.md`), dungeon layouts (`./dungeons.md`) or the tone rules
(`./charter.md#tone`). Where an asset depicts something defined elsewhere, this file gives the format, size, key,
prompt template and fallback, and the subject line of the prompt is copied from the defining file.

Order of authority: `CANON-NOW.md` LOCKED items > `CANON.md` > this bible > `INDEX.md` > a step issue.
Written 2026-11-21 against `main` at `b79d73d` (save v6, Three.js r187, manifest at `assets/manifest.js`, audio at
`js/audio.js`).

**How a step uses this file.** An `art:` step (or a `feat:` step with an "Art:" clause) finds its section below, copies
the asset rows into the issue's `## What`, generates each image with the prompt given (preamble + kind suffix +
subject), processes it with the commands given, adds the manifest key, and proves the fallback with
`?noassets=all`. A music step copies the track's data block verbatim into the realm module's `addTrack` call. Never
paraphrase prompts, hexes or note data: copy them.

---

## Contents

1. [Style guide](#style) · [prompt preamble](#preamble) · [kind suffixes](#kinds) · [first-person art rules](#fp-art)
2. [Processing pipeline](#pipeline) · [prompt log and references](#art-log)
3. [Manifest key naming](#keys)
4. [PWA bundles and budgets](#bundles)
5. [Palettes per realm](#palettes)
6. [ART BRIEF template](#brief-template) · [owner GLB brief index](#brief-index)
7. [UI art: journal, icons, frames](#ui) · [bestiary cards](#cards) · [portraits](#portraits)
8. [Home island art](#home) · [sky and horizon](#horizon) · [hood trims](#hood-trims) · [young cast](#young-cast)
9. [Shared kits](#kits): [dungeon kit](#dungeon-kit) · [Lamplighter kit](#lamplighter-kit) · [Under the Roots](#under-roots)
10. Lands: [Duskwick](#duskwick) · [Pinewhistle](#pinewhistle) · [Archwater](#archwater) ·
    [Threemills](#threemills) · [the Rootdeep](#rootdeep) · [the Glassway](#glassway) · [Kettle Isle](#kettle) ·
    [Saltglass Flats](#saltglass) · [Driftholm](#driftholm) · [the Starmeadow](#starmeadow) · [the Crown](#crown) ·
    [variant realms](#variants) · [dungeon textures](#dungeon-textures) · [fish](#fish)
11. [Key art, act cards and loading cards](#key-art) · [loading cards](#loading-cards)
12. [Music](#music): [format](#music-format) · [new voices](#voices) · [track register](#tracks) ·
    [home layers](#music-home) · [all track data](#track-data)
13. [Ambience](#ambience)
14. [SFX](#sfx) · [NPC voices](#npc-voices) · [stings](#stings)
15. [Acceptance criteria every art or audio step copies](#art-step-checklist)
16. [Decisions made here](#decisions)

---

<a id="style"></a>

## 1. Style guide

The game is **a toy-like storybook diorama seen from a 1 m tall hero's eye** (DESIGN §2, LOCKED): chunky rounded
low-poly shapes, soft toon shading, bold dark-brown ink outlines, a warm pastel palette, painted skies and clouds,
light fog that tints the distance. Painted 2D art (cards, sprites, portraits, key art) is a **soft painterly storybook
illustration**: gouache-and-coloured-pencil feel, warm light, rounded friendly shapes, gentle texture, no hard
photographic detail. The shipped `assets/ui/title_fp_v2.jpg`, the six `cloud_*` cards and the four `horizon_isle_*`
cards are the reference set: every new painted asset must sit beside them without looking like a different game.

### Ten rules

1. **Round and soft.** No sharp spikes, no thin blades, no jagged silhouettes. Rocks are pebbles grown large; trees are
   lollipops, cones and puffs; buildings lean a little and have round doors.
2. **Warm pastel, never grey.** Shadows are lilac or warm brown (`#6f5a44`, `#7a6670`, `#5f70bf` at night), never
   black or neutral grey. The darkest value in any painting is the ink brown `#3a2a20`.
3. **Ink outline on things, not on air.** Characters, props and icons carry a soft dark-brown outline (`#3a2a20`,
   2-4 px at 512 px). Sky, fog, clouds, distant isles and effects have none.
4. **One light, low and gold.** Key light from the upper left at about 40 degrees, warm (`#fff1dc` by day,
   `#ffc890` at golden hour); a cool fill from the sky. Night is blue-lilac (`#1c2a63` to `#3d4c8f`) with warm
   lamp pools (`#ffd98a`).
5. **Melancholy wears sunshine** (`./charter.md#always` A6). A dimmed or sad place is still sunny and coloured. What
   is missing is a glow, a sound or a rhythm. No desaturated, grey or dead palette anywhere; the wilting Great Tree
   stays the darkest visual state in the game.
6. **Faces are kind.** Every creature has round eyes with a highlight, small mouths, blush dots where it suits.
   Enemies look grumpy, sleepy or mischievous, never scary. No teeth shown except as a single cartoon fang on a few
   comic species; no claws drawn sharp.
7. **Readable at eye level.** Pip's eye is 0.88 m up. Everything is designed to read from below and at 5-40 m:
   big shapes first, detail only inside the silhouette. Landmarks read as one clean silhouette against the sky.
8. **Each land owns four colours.** Its swatch (four hexes, [§5](#palettes)) appears in every painting of that land:
   the dominant ground, the accent, the light and the shadow.
9. **The Spiral is the only repeated symbol.** A simple three-turn spiral, clockwise from the centre, drawn as a soft
   inlaid line. It marks Lamplighter work, Wenna's brow, Driftholm's arch and every "this connects somewhere" thing.
   No other glyph language, runes or text in paintings.
10. **Original, always.** Never imitate another game's characters, logos, creature designs, UI frames or locations.
    Prompts never name another game, studio, film or artist. A generated image that resembles a known character is
    discarded and regenerated with a changed subject line.

### Colour anchors (LOCKED or shipped)

| Use | Hex | Source |
|---|---|---|
| Ink outline, darkest value | `#3a2a20` | shipped toon outlines |
| Pip's hood (leaf green) | as in `hero.glb` (sampled ≈ `#8aa83c`-`#9cb84a`) | LOCKED GLB |
| Woods Starseed | `#8be07a` | LOCKED `SEEDS.woods.css` |
| Frost Starseed | `#9fdcff` | LOCKED |
| Sea Starseed | `#ff9f8f` | LOCKED |
| UI cream | `#fdf6e3` | shipped `--cream` |
| UI brown text | `#5a3e2b` | shipped |
| Telegraph coral | `#ff7a6b` | shipped coral halo |
| Lamp glow | `#ffd98a` | shipped lamp pools |
| Day sky top / horizon | `#5aaef2` / `#d4f0fc` | `js/sky.js` KEYS |
| Night sky top / horizon | `#1c2a63` / `#3d4c8f` | `js/sky.js` KEYS |
| Wenna's light (crown lanterns, given light) | `#ffe9a8` core, `#f2b45a` rim | this file |
| Mote's light | `#f7f2ff` core, `#c9b6ec` rim | this file |
| Lamplighter brass | `#c9a24a` | this file ([§9.2](#lamplighter-kit)) |

<a id="preamble"></a>

### 1.1 The image-prompt preamble

Every image prompt is three parts joined by a blank line: **preamble + kind suffix + subject**. The preamble is
copied exactly:

> Original artwork for a cosy storybook 3D adventure game. Soft painterly illustration, gouache and coloured-pencil
> texture, warm golden light from the upper left, gentle lilac shadows, rounded friendly shapes, chunky toy-like
> proportions, a warm pastel palette, soft dark-brown ink outlines on characters and objects only, calm and kind
> mood. No text, no letters, no logos, no watermark, no signature, no frame, no photorealism, no harsh black shadows,
> no sharp spikes, nothing scary. Do not imitate any existing game, film, studio or artist.

The subject always ends with the land's swatch: "Palette: <4 hexes from §5>." For a character, the subject is the
"Look" line from `./cast.md` (or "Model brief" from `./creatures.md`) copied verbatim, plus its palette hexes.

<a id="kinds"></a>

### 1.2 Kind suffixes

| Kind | Suffix (copied after the preamble) | Generate at | Ship at | Alpha |
|---|---|---|---|---|
| `tile` (seamless terrain or wall) | "A flat top-down texture swatch filling the whole square edge to edge, even lighting, no perspective, no horizon, no single focal object, no vignette, small repeating detail about one tenth of the image wide, suitable for seamless tiling." | 1024² | 1024² `_hd` + 512² `lo` | no |
| `card` (billboard: foliage, sky, effect) | "A single isolated element centred on a plain flat pure white background, soft edges, generous empty margin, no ground shadow, no other objects." | 1024² or 1024×512 | per row | yes (white keyed) |
| `horizon` (distant isle) | "A far-away island silhouette seen from sea level across 2 km of water, hazy and pale, low contrast, blue-lilac atmospheric haze, no outline, the island sits on a flat horizon line along the bottom edge, plain white background above." | 2048×614 | 1024×307 | yes |
| `portrait` | "Head-and-shoulders character portrait, three-quarter view facing left, friendly expression, soft round background disc in the palette's light colour fading to white at the edges, centred, the character fills 70 % of the height." | 1024² | 512² | no |
| `sheet` (turnaround reference) | "Character turnaround sheet: front, three-quarter, side and back views of the same character standing in a neutral pose, evenly spaced on one row, same scale, plain white background, flat even lighting." | 2048×1024 | docs only | no |
| `icon` | "A single small game icon of one object, centred, bold simple shape readable at 32 pixels, thick soft dark-brown outline, two-tone shading, plain pure white background, no shadow." | 1024² | 128² (cell) | yes |
| `card-beast` (bestiary) | "A storybook field-guide painting of one creature in its home, the creature centred and filling 60 % of the frame, soft vignette background of its land, friendly pose." | 1024² | 384² | no |
| `loading` | "A wide painted landscape vista, cinematic composition with a clear focal landmark on a third line, soft depth haze, room at the bottom fifth for a line of text (keep it calm and empty)." | 1792×1024 | 1600×900 | no |
| `map` | "A hand-painted storybook map of one island seen from directly above, parchment-coloured sea around it, soft painted terrain colours, small painted icons of landmarks only, no lettering, no compass rose, no grid." | 1024² | 1024² | no |
| `sketch` (Hoot's vista) | "A loose pencil-and-watercolour sketch on cream paper, a naturalist's field-notebook page, light washes of colour, visible pencil lines, unfinished edges fading to the paper." | 1024×576 | 512×288 | no |
| `decal` | "A single flat motif painted as if inlaid in stone, centred, symmetric where possible, on a plain pure white background, no perspective." | 1024² | 256² | yes |
| `sheet-items` (many icons in one image) | "A grid sheet of N separate small game icons, each centred in its own equal cell with wide white gaps between cells, same scale and lighting, plain pure white background." | 2048×1366 (6×4) | cells | yes |

<a id="fp-art"></a>

### 1.3 First-person art rules

- **Landmarks** carry the region from its entry: each landmark is painted on its land's loading card and map, and
  its 3D silhouette is tall and unique (no two landmarks in a land share a silhouette class: tower, tree, arch,
  cone, mills, bell spire).
- **Held items read from the lower right.** Every tool's viewmodel shape is tested at 54 degrees vertical FOV: the
  silhouette must be recognisable from 25 % of its length (the tip or the head), because the hand hides the rest.
  Each tool's ART BRIEF (`./systems.md#items-tools` owns the numbers) names its "tip read": the Lantern's glowing bud,
  the Glider's leaf edge, the Bell's rim, the Hook's thistle head, the Sunglass lens, the Paws' claws, the Starsong
  leaf, the Sling's cup, the Gloves' green cuffs, Cloudstep's puff anklet (seen when looking down past -35 degrees).
- **Sound has a visual twin** (`./charter.md#first-person` rule 5): every cue in [§14](#sfx) marked "cue" names its
  visual twin, and every visual twin painted here (the "z" puff, the chime pulse) is listed in [§7](#ui).
- **No art below the eye that matters.** Floor decals that carry meaning (spiral doors, soft earth, plates) are at
  least 1.2 m across so they read at a 2 m stand-off looking down 30 degrees.

---

<a id="pipeline"></a>

## 2. Processing pipeline

All generation happens inside the step that needs the asset. Implementation agents generate images by starting a
GPT Sol subagent through the T3 orchestrator's `delegate_task` tool and asking it to call Codex's built-in
`image_gen.imagegen` tool with the full prompt (preamble + suffix + subject); a Gemini model in T3 (Antigravity) is
the fallback generator. Ask for the "Generate at" size in the table above, PNG output. No paid service, account,
API key or GUI tool is used.

Raw generations are saved outside the repo in the job's scratch folder, never committed. Only processed files land
under `assets/`. Every processing script runs with `python3 -I` (isolated mode), as the tool headers say.

### 2.1 Recipes per kind

**Seamless tile (terrain, walls).**

```sh
python3 -I tools/make_seamless.py raw/<name>.png assets/realms/<realm>/<key>_hd.png --size 1024 --band 0.22
python3 -I tools/make_seamless.py raw/<name>.png assets/realms/<realm>/<key>_hd_lo.png --size 512 --band 0.22
python3 -I -c "import sys;from PIL import Image;[Image.open(p).convert('RGB').save(p[:-4]+'.webp',quality=82,method=6) for p in sys.argv[1:]]" assets/realms/<realm>/<key>_hd.png assets/realms/<realm>/<key>_hd_lo.png
rm assets/realms/<realm>/<key>_hd.png assets/realms/<realm>/<key>_hd_lo.png
```

Check: tile the result 3×3 in a contact image and look for a visible seam or a repeating blotch; if the eye finds a
repeat in the 3×3, regenerate with "smaller, more even detail" added to the subject. Targets: `_hd` ≤ 110 KB,
`_hd_lo` ≤ 40 KB (raise `quality` down to 74 to meet them; never below 70).

**Billboard card with alpha (foliage, sky, effect, horizon, decal).** The generators return a white background.
Key it out and trim with `slice_sheet.py` (one blob in, one part out), then size with `export_sprites.py`:

```sh
python3 -I tools/slice_sheet.py raw/<name>.png work/<name>/ --alpha 40 --down 4 --grow 3 --min 2000
python3 -I tools/export_sprites.py work/<name>/ work/<name>/out part_00=<key>:<target height px>
python3 -I -c "import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],quality=85,method=6)" work/<name>/out/<key>.png assets/realms/<realm>/<key>.webp
```

`slice_sheet.py` reads alpha. When the raw image has an opaque white background, first convert white to alpha
with the white-key one-liner (soft: alpha = 255 × clamp((765 − (r+g+b)) / 60, 0, 1), RGB un-premultiplied toward the
paint colour):

```sh
python3 -I -c "
import sys,numpy as np;from PIL import Image
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
k=np.clip((765-a.sum(2))/60.0,0,1)
rgb=np.clip((a-255*(1-k[...,None]))/np.maximum(k[...,None],1e-3),0,255)
Image.fromarray(np.dstack([rgb,k*255]).astype(np.uint8),'RGBA').save(sys.argv[2])" raw/<name>.png raw/<name>_a.png
```

Feed `raw/<name>_a.png` to `slice_sheet.py`. Horizon cards and sky cards skip `export_sprites.py` and are resized to
their exact ship size with Pillow (`Image.resize(size, Image.LANCZOS)`) so their aspect stays fixed.

**Sheet of many icons or parts (icons, fish, decals, Tally Wall marks).** White-key, then `slice_sheet.py` (parts are
numbered row by row), check `_contact.png`, then `export_sprites.py` with one mapping per part at the cell height,
then pack them into an atlas with `tools/pack_atlas.py` ([§2.2](#pack-atlas)).

**Animation strip (effects with frames, the Mote glow pulse, beacon flame).** Generate a grid sheet of N frames
(suffix "a grid of N animation frames of the same element, equal cells, left to right then top to bottom"), then:

```sh
python3 -I tools/process_strip.py raw/<name>_a.png work/<key>.png --fw <cell w> --fh <cell h> --frames N --height <px> --alpha 40
```

The manifest entry is `{ src, frames: N, fps }` (the existing sprite-strip shape).

**Opaque painting (portrait, loading card, act card, map, key art, bestiary card, sketch).** Resize with Lanczos to
the ship size and save: portraits, cards, maps and sketches as webp quality 82; loading cards and act cards as webp
quality 80; title and ending key art as jpg quality 86 (the shipped format). Every loading card also gets a `lo`
at 960×540.

**Turnaround reference sheet.** Never shipped: saved as `docs/art/ref/<key>.webp` (1600×800, quality 80). `docs/`
is outside `SITE_FILES` in `tools/build-pages.mjs`, so it never reaches the precache.

<a id="pack-atlas"></a>

### 2.2 The atlas packer (new tool, added by S-037)

`tools/pack_atlas.py OUT.webp OUT.json CELL_W CELL_H COLS name=path ...` (about 60 lines, Pillow and json only):
lays the named images row by row into equal cells (each centred in its cell, never scaled up), writes the webp at
quality 85 and the JSON in the shipped atlas format `{ "cells": { name: {x, y, w, h} }, "size": [W, H] }` (the
format of `assets/textures/ui_icons.json`). A unit test in `tests/assets.test.js` packs three 8 px images and checks
the JSON. `--append OLD.json` keeps existing cells in place and adds new ones after them, so an atlas grows without
moving a cell other code reads.

<a id="art-log"></a>

### 2.3 Prompt log and references

Every art step appends one row per asset to `docs/art/prompts.md` (created by the first art step, S-009):
`| key | step | generator | prompt (full text) | processing commands | date |`. The log is how the owner reruns a
prompt later. Reference sheets live in `docs/art/ref/`. The owner GLB briefs live in `docs/roadmap/briefs/batch-NN.md`
([§6](#brief-template)).

### 2.4 Fallbacks (every key, no exceptions)

The engine already tolerates any missing key (`assets/manifest.js` header; `Assets.tex(key, ...fallbacks, { make })`
never returns null). Every new key names its fallback in its row below, one of:

| Fallback code | Meaning |
|---|---|
| `F-home:<key>` | the matching shipped home asset (e.g. a realm's grass layer falls back to `grass_hd`) |
| `F-flat:<hex>` | a 4×4 canvas of one colour (terrain, walls) |
| `F-canvas:<recipe>` | a canvas drawing at boot: the recipe is given in the row (e.g. "cream card, land swatch band, landmark silhouette from the map polygon") |
| `F-mesh` | the code-built model is the fallback (every 3D thing) |
| `F-glyph:<char>` | a Fredoka glyph on a cream disc (icons) |
| `F-none` | the element is simply not drawn (decorative only: a sky card, a sparkle) |

`?noassets=all` must render every realm with only fallbacks; the realm suite's fixed views run once with it.

---

<a id="keys"></a>

## 3. Manifest key naming

Keys are lowercase `snake_case`, unique across all manifest sections. The engine reads them by name; renaming a
shipped key is never allowed (the shipped keys in `assets/manifest.js` are LOCKED).

| Kind | Pattern | Section | Example |
|---|---|---|---|
| Terrain layer | `<realm>_<layer>_hd` (+ `lo`) | `textures` | `duskwick_sand_hd` |
| Wall / interior tile | `wall_<set>_hd` (+ `lo`) | `textures` | `wall_rootwood_hd` |
| Billboard card | `<realm>_card_<name>` | `billboards` | `pinewhistle_card_fern` |
| Shared card | `card_fx_<name>` or `sky_<name>` | `billboards` | `sky_ladder` |
| Horizon isle | `horizon_isle_<a-f>` (+ `_night`) | `billboards` | `horizon_isle_e` |
| Decal | `decal_<name>` | `billboards` | `decal_spiral` |
| Portrait | `portrait_<castId>` | `ui` | `portrait_granny_wick` |
| Bestiary card | `card_<enemyOrBossId>` | `ui` | `card_sizzle_beetle` |
| Loading card | `load_<realm>` (+ `lo`) | `ui` | `load_kettle` |
| Map art | `map_<realm>` | `ui` | `map_saltglass` |
| Vista sketch | `sketch_<realm>_<n>` | `ui` | `sketch_home_2` |
| Act card | `actcard_<1-4 or true>` | `ui` | `actcard_2` |
| Icon atlas | `icons_<set>` + JSON | `ui` | `icons_items` |
| Model (GLB slot) | `npc_<castId>`, `boss_<id>`, `enemy_<id>`, `prop_<realm>_<id>`, `kit_<id>`, `tool_<id>` | `models` | `boss_gloop` |
| Reference sheet | `docs/art/ref/<key>.webp` | not in the manifest | |

The existing GLB keys keep their names: `hero`, `boss_shroom`, `boss_crab`, `boss_frost`, `great_tree`,
`great_tree_bloom`, `npc_turtle`, `npc_cat`.

**Model slots exist before the GLB does.** For every code-built 3D thing, the step adds a manifest `models` entry
**commented out** with its height, e.g. `// boss_gloop: { src: 'assets/realms/archwater/boss_gloop.glb', height: 4.0 },`.
The code calls `Assets.makeModel(key)` first and builds the procedural rig when it returns null (the shipped pattern).
The owner uncomments the line when the painted GLB lands. GLBs go through `tools/normalize_glb.mjs` (origin at the feet,
facing +Z, exactly 1 unit tall) before they are committed.

**Realm tag.** Every entry that belongs to one realm carries `realm: '<realmId>'` and its file sits under
`assets/realms/<realmId>/`. Entries with no `realm` are core (precached at install). Dungeon and Hollow realms tag
their parent land (`realm: 'pinewhistle'` for Whistlehollow) except `under_roots`, which has its own tiny bundle,
and the post-game dungeons, which tag `postgame`.

---

<a id="bundles"></a>

## 4. PWA bundles and budgets

Slice R7 (S-029) splits the precache. **Core** = engine, `vendor/three`, fonts, every untagged manifest entry (home
island, UI, shared kits, travelling cast portraits, icons). **Bundles** = one per realm tag, cached by the service
worker when the player first discovers that realm's portal (a chart entry unlocks, a root-gate is seen, a door is
found) and at entry at the latest.

### 4.1 Hard limits (a build check, S-029)

| Thing | Limit | Check |
|---|---|---|
| Core precache | ≤ 30.0 MB | `tools/build-pages.mjs` sums `PRECACHE` and fails above it |
| One realm bundle without GLBs | ≤ 2.5 MB | same, per `BUNDLES[id]` |
| One realm bundle with owner GLBs | ≤ 4.0 MB | same, when any `.glb` is in it |
| One texture | ≤ 1024² (except key art and loading cards) | `tests/assets.test.js` reads image headers |
| Painted webp card / portrait | ≤ 150 KB / ≤ 60 KB | `tests/assets.test.js` |
| Terrain `_hd` / `lo` | ≤ 110 KB / ≤ 40 KB | `tests/assets.test.js` |
| Loading card / map art | ≤ 200 KB / ≤ 200 KB | `tests/assets.test.js` |
| Owner GLB | ≤ 700 KB, ≤ 12,000 tris (characters ≤ 8,000) | `tests/assets.test.js` when present |

`tests/assets.test.js` (added by S-029) walks the manifest and fails on: a missing file for an uncommented key, a
file in `assets/` no key references, a key with a realm file but no `realm` tag (or the reverse), a size over its
limit, or a key with no fallback named in `js/realms/fallbacks.js` (a table `{ key: 'F-...' }` mirroring §2.4).

### 4.2 Core growth plan (today ≈ 26 MB total site)

| Addition | KB | Step(s) |
|---|---|---|
| Home art (blossom, crown, horizon e/f, night windows, fog bank, ladder and starstair sky cards, decals) | 620 | S-009, S-064, S-165, S-264 |
| Icon atlases (items 48, collectibles 16, journal 16, fish 24) | 420 | S-037, S-057+, S-207 |
| Journal paper, tabs, frames, completion art | 260 | S-037, S-074 |
| Core portraits (24 home and travelling cast × 55) | 1,320 | per cast step |
| Home bestiary cards (6 enemies + 3 Catchers + Mote + Rollo) × 35 | 385 | S-046, S-058, S-090 |
| Act cards 4 + true ending × 180 | 900 | S-067, S-165, S-272, S-286, S-290 |
| Chart art (Lamplighter's and Clover's) + sailing card | 560 | S-080, S-081, S-286 |
| Home vista sketches 4 × 45 | 180 | S-076 |
| Key art refresh (new title + ending) | 620 | S-307 |
| Removed: `assets/ui/title.jpg` and `assets/ui/title_fp.jpg` (superseded since WP1) | −929 | S-307 |
| **Net core growth** | **≈ 4,336** | |

That lands core at about 30.3 MB, so S-307 also measures the `sprites` section (6.4 MB of PNG today): every sprite
the code loads only as a DOM image (find them with `grep -rn "Assets.images\|sprites\." js/`) is re-saved as lossless
webp under the same key with a `.webp` path (lossless keeps the trimmed alpha exact; expect ≈ −25 %). If core still exceeds 30 MB at checkpoint 6 (S-261), the lever is to move
core portraits of cast who appear in only one land into that land's bundle.

### 4.3 Per-realm bundle budget (KB)

| Realm | Terrain 7 × (110 + 40) | Cards | Portraits | Beast cards | Loading + lo | Map | Sketches | Other | Total |
|---|---|---|---|---|---|---|---|---|---|
| `under_roots` | 2 walls × 150 = 300 | 2 × 60 | 1 (Rollo) 55 | in core | 150 + 50 | - | - | 60 | ≈ 735 |
| `duskwick` | 1,050 | 5 × 90 | 4 × 55 | 2 × 35 | 260 | 180 | 2 × 45 | 120 | ≈ 2,440 |
| `pinewhistle` | 1,050 | 5 × 90 | 4 × 55 | 5 × 35 | 260 | 180 | 3 × 45 | 40 | ≈ 2,510 → drop 1 card → 2,420 |
| `archwater` | 1,050 | 5 × 90 | 3 × 55 | 4 × 35 | 260 | 180 | 3 × 45 | 60 | ≈ 2,440 |
| `threemills` | 1,050 | 5 × 90 | 5 × 55 | 4 × 35 | 260 | 180 | 3 × 45 | 0 | ≈ 2,490 |
| `rootdeep` | 1,050 | 4 × 90 | 3 × 55 | 4 × 35 | 260 | 180 | 2 × 45 | 120 | ≈ 2,365 |
| `glassway` | 1,050 | 5 × 90 | 4 × 55 | 3 × 35 | 260 | 180 | 3 × 45 | 40 | ≈ 2,440 |
| `kettle` | 1,050 | 5 × 90 | 4 × 55 | 4 × 35 | 260 | 180 | 3 × 45 | 0 | ≈ 2,435 |
| `saltglass` | 1,050 | 5 × 90 | 2 × 55 | 5 × 35 | 260 | 180 | 3 × 45 | 40 | ≈ 2,400 |
| `driftholm` | 1,050 | 5 × 90 | 1 × 55 | 2 × 35 | 260 | 180 | 2 × 45 | 200 | ≈ 2,355 |
| `starmeadow` | 1,050 | 5 × 90 | 2 × 55 | 4 × 35 | 260 | 180 | 2 × 45 | 120 | ≈ 2,400 |
| `crown` | 3 walls × 150 = 450 | 3 × 90 | - | - | 260 | - | - | 120 | ≈ 1,100 |
| `remembered` | grade only, 0 | 2 × 90 | young cast 0 (recolours) | - | 260 | - | - | 0 | ≈ 440 |
| `moonmere` | grade only, 0 | 3 × 90 | - | 1 × 35 | 260 | - | - | 150 (letters paper) | ≈ 715 |
| `night` | 0 | 3 × 90 | - | - | 260 | - | - | 0 | ≈ 530 |
| `margins` | 2 paper tiles × 150 = 300 | 3 × 90 | - | - | 260 | - | - | 0 | ≈ 830 |
| `postgame` (Dreams, Hundred Lamps, Snowglobe, Undercap, Mabel) | 6 walls × 150 = 900 | 4 × 90 | 3 × 55 | 2 × 35 | 260 | - | - | 0 | ≈ 1,755 |

"Other" = realm decals, effect strips and the land's prop textures. A step whose bundle comes out over 2.5 MB drops
the lowest-value card (a duplicate foliage variant) first, then lowers webp quality to 76, never the terrain `lo`.

---

<a id="palettes"></a>

## 5. Palettes per realm

S-027 (ENGINE F10/R8) gives every realm a `W.palette`. Home's palette is today's `TUNE.atmo.fog` and `js/sky.js`
`KEYS` / `CLOUD` / `WATER_DEEP` and must deep-equal them (unit test). Every other realm states only what differs.

### 5.1 The palette object

```js
palette: {
  swatch: ['#2b2238', '#f2b45a', '#ff8f7a', '#3fa79a'],  // ground-shadow, light, accent, water/foliage: used in prompts
  sky: { day: [top, hor], gold: hor, dusk: [top, hor], night: [top, hor] }, // overrides on js/sky.js KEYS (see 5.2)
  skyFixed: null,               // or an hour (0-24): the sky ignores the clock (Rootdeep, Starmeadow, Night)
  cloud: { day: hex, dusk: hex, night: hex },             // overrides on CLOUD
  fog: { <regionId>: [near, far, tintHex, tintK], arena: [26, 150] }, // TUNE.atmo.fog shape, one per region
  water: { deep: hex, shallow: hex, foam: hex },          // buildWater colours; null = no water plane
  layers: ['<k0>', '<k1>', '<k2>', '<k3>', '<k4>', '<k5>', '<k6>'], // the 7 splat slots (grass, forest, meadow, sand, snow, dirt, rock roles)
  cliff: '<key>',               // cliff_hd replacement on faces ≥ 50 degrees
  grade: null,                  // or { sat, tint, k }: the shared uGrade uniform (variants only, 5.4)
  music: '<track>', ambience: { <regionId>: '<bed>' },
  dim: { sound, rhythm, glow }, // what is missing while the land's beacon or stone is dark (charter A6)
}
```

### 5.2 How the sky overrides apply

`skyFrom(KEYS, o)` (S-027) copies home's nine `KEYS` rows and replaces only the colours: `day` → rows 7.6 and 16.4
(top, horizon); `gold` → the horizon of row 16.9; `dusk` → rows 6.0 and 18.0 (top, horizon); `night` → rows 0.0, 4.8,
19.5 (top, horizon; 19.5 uses the mix of dusk and night) and 24.0. Sun colour, intensities and hemisphere colours stay
home's unless a realm lists `hemi: [sky, ground, intensity]`. Cloud tints apply to the `CLOUD` rows by the same day /
dusk / night split.

### 5.3 The realms

Terrain layer keys are written without the `_hd` suffix; each is a seamless tile per [§2.1](#pipeline), fallback
`F-home:` the home layer in the same slot.

| Realm | Swatch | Sky day (top / hor) · gold · dusk · night | Clouds d / du / n | Water deep / shallow / foam |
|---|---|---|---|---|
| `home` | (shipped) | shipped `KEYS` | shipped `CLOUD` | `#1b86c8` / shipped / shipped |
| `duskwick` | `#2b2238` `#f2b45a` `#ff8f7a` `#3fa79a` | `#6fb3e8`/`#ffe6c2` · `#ffc27a` · `#5a4a9a`/`#ff9f7a` · `#2b2238`/`#4a3560` | `#fff4e6` / `#ffc8b0` / `#6a5a8a` | `#1f8f95` / `#3fa79a` / `#fff4e0` |
| `pinewhistle` | `#2f4a3a` `#e8efe9` `#c98b4b` `#8fae9a` | `#7fb0d8`/`#e8efe9` · `#f3dcb0` · `#6a74a8`/`#e9b9a0` · `#1e2a44`/`#3b4a6a` | `#ffffff` / `#f6d8c8` / `#7a86b4` | `#2c6f7a` / `#6fa8a0` / `#eef3f0` |
| `archwater` | `#36414f` `#e2c9a0` `#6b4a8c` `#7fd3d0` | `#68a9d9`/`#d9f1ee` · `#f0d6b0` · `#5b4f93`/`#c99ac0` · `#1d2340`/`#3a3a6b` | `#ffffff` / `#e8c8dc` / `#6e6aa4` | `#1d6f86` / `#7fd3d0` / `#f4fbfa` |
| `threemills` | `#7fae4b` `#e7c45a` `#c2563f` `#a7d3f0` | `#5aaef2`/`#e2f2fb` · `#ffe2a0` · `#7484cc`/`#ffc890` · shipped | shipped | `#2f86b8` / `#a7d3f0` / shipped |
| `rootdeep` | `#1c1a24` `#ffcf7a` `#7be0c8` `#8a5a3c` | `skyFixed: 0`, all rows `#14121b`/`#241f2e`; `hemi: ['#7be0c8', '#8a5a3c', 1.1]` | none (no sky cards) | `#10202a` / `#2f6f6a` / `#9fe8d6` (the Underlake) |
| `glassway` | `#2f7d8c` `#f5e6c4` `#ffb48a` `#bfeee6` | `#66b8e8`/`#e6faf6` · `#fde8c0` · `#6a80c4`/`#ffc4a8` · `#18264f`/`#36477e` | `#ffffff` / `#ffd8c8` / `#7d89c4` | `#2f7d8c` / `#bfeee6` / `#ffffff` |
| `kettle` | `#3b3540` `#f4d1a6` `#e66f4f` `#8fc7a0` | `#74a6d4`/`#f4e2cc` · `#ffcf9a` · `#6a5a9c`/`#ff9a7a` · `#221e30`/`#4a3448` | `#f6f0ea` / `#ffc0a8` / `#6a5a84` | `#2a6a78` / `#8fc7a0` / `#f8f2ea` |
| `saltglass` | `#c9a46b` `#efe3c8` `#b55d4c` `#8ec9d8` | `#6fb0e0`/`#f6efe0` · `#ffd9a0` · `#6d6aa8`/`#f0a888` · `#1e2444`/`#3e4470` | `#ffffff` / `#ffd0b8` / `#7480b8` | `#3a8fa8` / `#8ec9d8` / `#ffffff` |
| `driftholm` | `#9bb87a` `#f7f2ff` `#c9b6ec` `#8fb4f0` | `#8fb4f0`/`#f7f2ff` · `#ffe0c8` · `#8a74c8`/`#ffc0d0` · `#241f4a`/`#4a3f7a` | `#ffffff` / `#ffd6e4` / `#8a80c8` | null (cloud floor card instead) |
| `starmeadow` | `#141a3a` `#ffe9a8` `#8fa8ff` `#2a3470` | `skyFixed: 23`, top `#141a3a`, hor `#2a3470`; `hemi: ['#8fa8ff', '#2a3470', 1.35]` | `#8f9ad8` (all) | null |
| `crown` | `#6f5a44` `#ffe9a8` `#f6c6d8` `#9cb84a` | `skyFixed: 19.2` (home dusk) | shipped dusk | null |

Fog per region `[near, far, tint, tintK]` and the seven layers:

| Realm | Fog per region | Layers (slots 0-6) · cliff |
|---|---|---|
| `duskwick` | `wickhaven [30, 230, #f6e2c0, .12]` · `ember_sands [34, 250, #f2d6b8, .18]` · `coral_steps [32, 245, #e9f2ee, .15]` · `tower_head [36, 262, #f4e8d8, .12]` | `duskwick_palmgrass`, `duskwick_jungle`, `duskwick_blossom`, `duskwick_goldsand`, `duskwick_coral`, `duskwick_redearth`, `duskwick_basalt` · `duskwick_cliff` |
| `pinewhistle` | `acornet_hollow [26, 210, #e8efe9, .20]` · `misthollow_ravines [14, 150, #dfe8e4, .55]` · `sawmill_run [24, 200, #e4ebe0, .25]` · `whistle_rise [34, 255, #eef3f0, .20]` | `pinewhistle_moss`, `pinewhistle_needles`, `pinewhistle_heather`, `pinewhistle_gravel`, `pinewhistle_rime`, `pinewhistle_loam`, `pinewhistle_granite` · `pinewhistle_cliff` |
| `archwater` | `the_raft [32, 240, #eef6f4, .12]` · `basalt_stairs [30, 240, #dfe6ea, .20]` · `tidepool_shelf [34, 255, #e8f4f2, .15]` · `kelp_shallows [28, 220, #d6efe6, .25]` | `archwater_saltturf`, `archwater_kelpmat`, `archwater_thrift`, `archwater_sand`, `archwater_tideflat`, `archwater_shingle`, `archwater_hextop` · `archwater_columns` |
| `threemills` | `haybury [32, 240, #f6ecd0, .10]` · `tumble_hill [36, 262, #f4efd8, .12]` · `orchard_rows [28, 225, #eef0d0, .18]` · `millpond_marsh [24, 200, #dfeedd, .30]` | `threemills_pasture`, `threemills_orchard`, `threemills_wheat`, `threemills_pondsand`, `threemills_chalk`, `threemills_furrow`, `threemills_flint` · home `cliff_hd` |
| `rootdeep` | `burrowbottom [12, 90, #3a2f3a, .35]` · `glowcap_forest [10, 80, #2e4a46, .45]` · `the_underlake [14, 90, #1f3340, .40]` · `geode_galleries [10, 70, #3a2a48, .35]` · `arena [10, 70]` | `rootdeep_loam`, `rootdeep_mycel`, `rootdeep_glowmoss`, `rootdeep_lakesand`, `rootdeep_geode`, `rootdeep_rootfloor`, `rootdeep_cavestone` · `rootdeep_rootwall` |
| `glassway` | `puffin_post [36, 262, #eef8f6, .10]` · `the_sandbars [36, 262, #f4f0e0, .12]` · `wreck_reach [30, 240, #e4eeee, .20]` · `bell_shallows [32, 250, #e8f6f4, .15]` | `glassway_dunegrass`, `glassway_scrub`, `glassway_seapink`, `glassway_shellsand`, `glassway_wetsand`, `glassway_shingle`, `glassway_barnacle` · `archwater_columns` |
| `kettle` | `forgefall [26, 215, #e8d8cc, .22]` · `bathhouse_terraces [24, 210, #f2ece6, .35]` · `ash_beach [32, 240, #e6dcd2, .18]` · `the_spout [22, 200, #ece4e0, .30]` | `kettle_fernturf`, `kettle_ashwood`, `kettle_heath`, `kettle_blacksand`, `kettle_ash`, `kettle_cinder`, `kettle_tuff` · `kettle_cliff` |
| `saltglass` | `sablecamp [36, 262, #f8f0e0, .10]` · `the_glass_dunes [34, 262, #f6ecd8, .15]` · `the_salt_pans [40, 270, #fbf7f0, .20]` · `academy_hill [32, 250, #f2e8d6, .12]` | `saltglass_saltbush`, `saltglass_oasis`, `saltglass_bloom`, `saltglass_dune`, `saltglass_salt`, `saltglass_hardpan`, `saltglass_sandstone` · `saltglass_cliff` |
| `driftholm` | `motes_meadow [36, 262, #f4eefc, .12]` · `the_falls [28, 230, #eef0fa, .25]` · `nimble_downs [34, 255, #f7f2ff, .18]` · `arch_rise [36, 262, #efe8fa, .12]` | `driftholm_lilacgrass`, `driftholm_cloudmoss`, `driftholm_starflower`, `driftholm_dust`, `driftholm_wisp`, `driftholm_ochrepath`, `driftholm_skystone` · `driftholm_skystone` |
| `starmeadow` | `the_lower_lanterns [30, 240, #2a3470, .30]` · `constellation_bridges [36, 262, #1e2656, .20]` · `brightwells_rest [30, 240, #3a3a7a, .25]` · `the_ladder_foot [34, 255, #2a3470, .20]` | `starmeadow_cloudturf`, `starmeadow_nebula`, `starmeadow_stardust`, `starmeadow_silver`, `starmeadow_frostlight`, `starmeadow_goldpath`, `starmeadow_moonstone` · `starmeadow_moonstone` |
| `crown` | `crown [20, 128, #f6e6d0, .20]` | dungeon recipe walls ([§10.11](#crown)) |

Region ids are the snake_case of the region names in CANON §2.3; the atlas files own the regions themselves.

### 5.4 Variant grades

Variants reuse their parent's geometry and textures (CANON §5.2) and change mood through `palette.grade`: one shared
uniform `U.uGrade = vec4(tint.rgb, k)` plus `U.uGradeSat` read by `toonMat`, the terrain splat program, the water and
the sky sprite batch (one uniform each, **no new programs**; S-188 adds it with home values `k = 0`, `sat = 1`, which
is a no-op and keeps home pixels identical). The grade is `rgb = mix(rgb, luma(rgb) * tint, k)` then saturation
`mix(luma, rgb, sat)`.

| Variant | Parent | Grade `{ sat, tint, k }` | Sky | Fog (all regions) | Notes |
|---|---|---|---|---|---|
| `remembered` | home | `{ sat: 0.55, tint: '#e9d8b0', k: 0.45 }` | day `#c9b07a`/`#f2e2bc`, clock runs | `[30, 230, #e9d8b0, .35]` | sepia and gold, never grey: the grade keeps 55 % saturation so the meadow stays green-gold (charter A6) |
| `moonmere` | home | `{ sat: 0.35, tint: '#cfd8ee', k: 0.55 }` | `skyFixed: 23`, top `#2a3358`, hor `#cfd8ee` | `[24, 220, #cfd8ee, .40]` | silver and still; water `#2a3358` / `#cfd8ee`, glint ×2 |
| `night` | home | `{ sat: 0.9, tint: '#ffe9a8', k: 0.12 }` | `skyFixed: 22` | home night fog | falling-light rain card; lanterns everywhere |
| `margins` | pinewhistle | `{ sat: 0.0, tint: '#f4ecd8', k: 0.85 }` | `skyFixed: 12`, top `#f4ecd8`, hor `#fbf7ee` | `[30, 230, #f4ecd8, .50]` | paper world: layers swapped to `margins_paper` and `margins_hatch`; outline px × 1.4 |
| `dream_*` | its boss arena | `{ sat: 0.75, tint: '#f3d8f0', k: 0.30 }` | `skyFixed: 17` (golden hour), clouds `#ffd8f0` | arena `[24, 140, #f6e0f0, .40]` | pastel dream; floating `card_fx_dreambubble` cards |

### 5.5 The "dim" states (charter A6: never a grey palette)

The palette does **not** change while a land is dim. The dim state is the absence of one sound, one rhythm and one
glow, restored within 10 s of the beat (`./story.md#ch9-11`):

| Land | Missing sound | Missing rhythm | Missing glow |
|---|---|---|---|
| Duskwick (dim until the Tower lamp is kindled in `ch12`) | the marimba (`lead2`, [§12.3](#tracks)); `ambMoth` at 30 % | moth lantern strings do not sway | Tower lamp card and stilt-house window cards unlit |
| Pinewhistle | the windflute (`lead2`); the Whistling Pine's song (`pinewhistle_rise` `tones` off) | sawmill `ambSaw` one-shots off | knot-hole glow off |
| Archwater | the harp (`lead2`); wave bed at half gain, no `ambBuoyBell` | tide level frozen low | arch beacon over the Moon Pool dark |
| Threemills | the fiddle (`lead2`); mill creak `ambMill` off | sail rotation 0 rad/s | granary sun-lamp dark |
| Rootdeep | the cello (`lead2`); the bed's `drone` at 30 %, no cello `tones` | root pulse emissive animation stopped | root glow emissive at 35 % |
| Glassway | the glockenspiel (`lead2`); the Sunken Bell's distant toll (`tones` off) | tide flag animation slow | lighthouse buoy lamps unlit |
| Kettle | the brass (`lead2`); forge `ambAnvil` at 40 % | baths' steam puffs irregular (every 4-11 s instead of 3 s) | forge windows unlit |
| Saltglass | the bell (`lead2`); the singing dunes (`ambGlassChime` off) | Academy bell silent | Academy windows unlit |
| Driftholm | (never dim: Mote's home) | | |

---

<a id="brief-template"></a>

## 6. The ART BRIEF template

Every code-built 3D thing ships with an ART BRIEF: in the PR description when it is built, and collected into the
milestone's `docs/roadmap/briefs/batch-NN.md` at close-out (batches at S-014, S-063, S-079, S-094, S-109, S-116,
S-137, S-159, S-173, S-197, S-221, S-242, S-261, S-279, S-306). The owner batch-generates painted GLBs from the
briefs with a 3D generator of their choice and drops them in through the manifest with no code change.

Copy this block exactly and fill every field. A brief with an empty field fails review.

```md
### ART BRIEF: <Display name> (`<manifest key>`)

- **What and where:** <one line: what it is, which land/realm, which step builds the code version>
- **Silhouette:** <the read in one sentence from 20 m in first person; the 2-3 primitive shapes it is made of>
- **Size:** <height × width × depth in m>; manifest `height: <m>` (the GLB is normalised to 1 unit, the engine scales)
- **Palette:** <3-6 hexes with what each colours> (outline `#3a2a20` is drawn by the engine; never paint it on)
- **Materials:** <toon base + which parts are emissive (hex, intensity), transparent, or vertex-coloured>; one
  texture atlas ≤ 1024², no PBR maps, no normal map
- **Poly budget:** <tris> (characters ≤ 8,000; bosses ≤ 12,000; props ≤ 2,500; instanced scatter ≤ 600)
- **Pose / animation:** <rest pose for the GLB (T- or A-pose for characters, feet on the ground, facing +Z); the
  engine's procedural animation it must survive: bob, squash, tilt, part spin, look-at>
- **Named nodes:** <node names the code animates, e.g. `armR`, `lid`, `sail`; "none" for a single mesh>
- **Code fallback:** `<file>:<function>` (<primitive count>, <tris>)
- **Image prompt:** <preamble + `sheet` suffix + subject; the subject is the cast/creature/atlas look line + palette>
- **3D prompt:** "<one paragraph: stylised low-poly toy figure/prop, soft rounded forms, hand-painted texture, the
  silhouette, size proportions, colours by hex, pose, 'single mesh, game-ready, under N triangles, no base, no
  text'>"
- **Acceptance:** drops in through `<key>` at `height` <m>; `tools/normalize_glb.mjs` passes; the in-page view at
  <view> stays within draw-call and triangle budgets; side-by-side screenshot with the code version in the PR.
```

**Rules for briefs.**
- Pip's GLB (`hero`) is never re-briefed or replaced. Hood trims tint it ([§8.3](#hood-trims)).
- The five shipped character GLBs (`boss_shroom`, `boss_crab`, `boss_frost`, `npc_turtle`, `npc_cat`) are reused
  scaled and recoloured for the young cast and Kinako; they get no new brief.
- A brief never names another game, studio or artist. 3D prompts say "original character".
- The 3D prompt always ends: "Original design. Single mesh, game-ready, under <N> triangles, feet at the origin,
  facing forward, no base plate, no text."

### 6.1 A filled example

### ART BRIEF: Lamplighter bench (`kit_bench`)

- **What and where:** the waystone bench of every land, 4-6 per land; code version in S-082 (`js/props-lamplighter.js`).
- **Silhouette:** a low curved stone seat with a lamp post rising from its left arm and a spiral inlaid in the backrest;
  reads as "a bench with a little lamp" from 20 m.
- **Size:** 1.0 m tall to the lamp top × 1.6 m wide × 0.6 m deep; `height: 1.0`.
- **Palette:** seat and back `#d9d2c3` (pale moonstone), spiral inlay `#7fb6c9`, post and lamp cage `#c9a24a` (brass),
  lamp glass `#ffd98a` (emissive when found), moss tufts `#8fae6a`.
- **Materials:** toon base; lamp glass emissive `#ffd98a` at 1.6 after `[E] Sit · Bench` marks it, 0 before.
- **Poly budget:** 900 tris.
- **Pose / animation:** static; the lamp glass node fades its emissive in over 0.6 s.
- **Named nodes:** `lamp` (the glass).
- **Code fallback:** `js/props-lamplighter.js:benchParts` (7 primitives, ≈ 640 tris).
- **Image prompt:** preamble + `sheet` + "A small curved stone garden bench of pale moonstone with a slim brass lamp post
  rising from its left armrest, a three-turn spiral inlaid in pale blue on the backrest, little tufts of moss at the
  feet. Palette: #d9d2c3 #7fb6c9 #c9a24a #ffd98a."
- **3D prompt:** "Stylised low-poly toy prop, soft rounded forms, hand-painted texture: a small curved pale moonstone
  bench (#d9d2c3), 1.6 m wide, a slim brass (#c9a24a) lamp post rising from the left armrest ending in a round glass
  lamp (#ffd98a), a three-turn spiral inlaid in pale blue (#7fb6c9) on the backrest, moss tufts at the feet. Original
  design. Single mesh, game-ready, under 900 triangles, feet at the origin, facing forward, no base plate, no text."
- **Acceptance:** drops in through `kit_bench` at `height: 1.0`; normalise passes; the Duskwick jetty view stays in
  budget; side-by-side in the PR.

<a id="brief-index"></a>

### 6.2 The index of owner GLB briefs

Every 3D asset that gets a brief, its manifest key, the file that defines its look (the brief's subject line comes
from there), the step that builds the code version and the batch that collects the brief. Heights are the manifest
`height` (m). "Rig" = the code version reuses a shared rig and the GLB may too.

**Home and Act I (batches 01-03)**

| Key | Thing | Height | Look defined in | Code step | Batch |
|---|---|---|---|---|---|
| `prop_home_reason_rings` | Grumble's three unlit night-lights | 0.45 | `./atlas-home.md#placeReasons` | S-004 | 01 |
| `prop_home_spyglass` | Pinch's spyglass on a tripod + chalk tally board | 1.2 | `./atlas-home.md#placeReasons` | S-004 | 01 |
| `prop_home_snow_cradle` | Frostbun's snow cradle + knitted scarf | 0.6 | `./atlas-home.md#placeReasons` | S-004 | 01 |
| `prop_home_bough_blossom` | a blossom cluster (child mesh of the Tree) | 1.6 | [§8.1](#home) | S-009 | 01 |
| `prop_home_thornvine` | thornvine bramble (purple) | 1.4 | `./atlas-home.md#placeThorns` | S-013 | 01 |
| `prop_home_glowmoss` | glow-moss pad on Grumble's Crown | 0.2 | [§8.1](#home) | S-011 | 01 |
| `tool_lantern` | Glowbud Lantern (held) | 0.35 | `./systems.md#items-tools` | S-057 | 02 |
| `boss_rollo` | Sir Rollo, pill-bug | 2.4 | `./creatures.md#boss-rollo` | S-061 | 02 |
| `enemy_dimling` | Dimling | 0.7 | `./creatures.md#enemy-dimling` | S-058 | 02 |
| `prop_nook_*` | Pip's Nook furniture (bed, shelf, lamp, rug, Keepsake Hollow shelves) | per item | `./atlas-home.md#pips-nook` | S-056 | 02 |
| `npc_nell` | Nell Pelliwick, pelican | 1.3 | `./cast.md#nell` | S-068 | 03 |
| `npc_puddle` | Puddle, tiny frog | 0.35 | `./cast.md#home` | S-077 | 03 |
| `kit_spiral_door` | spiral-carved Hollow door | 2.2 | [§9.2](#lamplighter-kit) | S-073 | 03 |
| `prop_home_vista_post` | Hoot's vista post | 1.3 | [§8.1](#home) | S-076 | 03 |
| `prop_home_hoots_board` | Hoot's Board on the plaza | 2.0 | [§8.1](#home) | S-076 | 03 |
| `prop_home_jetty` | Nell's Jetty + the *Dandelion* | 2.8 (boat mast) | `./atlas-home.md#placeJetty` | S-068 | 03 |
| `npc_dormy`, `npc_hazel`, `npc_mochi`, `npc_primrose`, `npc_kit`, `npc_duck` | home cottagers | 0.6-1.1 | `./cast.md#home` | S-115, S-134-S-136, S-156 | 06-08 |
| `npc_kinako` | Kinako (reuse `npc_cat` GLB recoloured until his own) | 1.1 | `./cast.md#kinako` | S-092 | 04 |
| `prop_bazaar_boat` | Kinako's Floating Bazaar | 3.6 | `./cast.md#kinako` | S-092 | 04 |
| `npc_rook` | Rook, crow | 0.9 | `./cast.md#rook` | S-113 | 06 |
| `npc_mote` | Mote (emissive figure) | 1.1 | `./cast.md#mote` | S-090 | 04 |

**Shared kits (batch 04 for the S-082 pieces; each gate object in the batch that closes its tool's milestone)**: `kit_bench`, `kit_beacon` (dark and lit), `kit_ruin_arch`, `kit_ruin_pillar`,
`kit_ruin_wall`, `kit_rootgate`, `kit_hookbloom`, `kit_tidestone`, `kit_receiver`, `kit_soft_earth`, `kit_star_door`,
`kit_bell_target`, `kit_ivy_lattice`, `kit_cloud_mote`, `kit_thornglass`, `kit_acorn_sleeping`, `kit_sapling`,
`kit_bottle`, `kit_keepsake_case`, `kit_chest_lamplighter` — looks in [§9.2](#lamplighter-kit) (Lamplighter pieces)
and `./systems.md#gates` (gate objects); heights there.

**Act II lands (batches 04-09)**

| Key | Thing | Height | Look defined in | Code step | Batch |
|---|---|---|---|---|---|
| `npc_granny_wick`, `npc_flick`, `npc_wickling` (rig) | Wickhaven moths | 1.0 / 0.6 / 0.7 | `./cast.md#granny-wick`, `#flick` | S-088 | 04 |
| `enemy_sizzle_beetle`, `enemy_coco_clonk` | Duskwick enemies | 0.6 / 0.8 | `./creatures.md` | S-089 | 04 |
| `prop_duskwick_*` | Duskwick prop kit (stilt house, palm, coral shrub, hot pool rim, moth lamp, tower) | per atlas | `./atlas-isles.md#duskwick` | S-084, S-086 | 04 |
| `npc_nutmeg`, `npc_acornet` (rig), `npc_pinfeather` | Pinewhistle folk | 0.7 / 0.5 / 0.8 | `./cast.md#elder-nutmeg`, `#professor-pinfeather` | S-099 | 05 |
| `enemy_mossling`, `enemy_pinecone_puff`, `enemy_bark_beetle`, `enemy_needle_wasp` | Pinewhistle enemies | 0.5-0.9 | `./creatures.md` | S-100 | 05 |
| `boss_mossmantle` | Mossmantle | 3.6 | `./creatures.md#boss-mossmantle` | S-105 | 05 |
| `prop_pinewhistle_*` | Pinewhistle kit (big pine, rope bridge, sawmill, Whistling Pine) | per atlas | `./atlas-isles.md#pinewhistle` | S-097 | 05 |
| `tool_glider` | Leaf Glider | 1.4 span | `./systems.md#items-tools` | S-102 | 05 |
| `npc_rafferty`, `npc_rafter` (rig) | the Raft's otters | 1.0 / 0.9 | `./cast.md#skipper-rafferty` | S-120 | 07 |
| `enemy_tidepool_jelly`, `enemy_squirt_urchin`, `enemy_sand_snapper` | Archwater enemies | 0.5-0.8 | `./creatures.md` | S-121 | 07 |
| `boss_gloop` | Old Gloop | 4.0 | `./creatures.md#boss-gloop` | S-126 | 07 |
| `tool_tide_bell` | Tide Bell | 0.3 | `./systems.md#items-tools` | S-122 | 07 |
| `prop_archwater_*` | Archwater kit (basalt column set, raft deck, Great Arch) | per atlas | `./atlas-isles.md#archwater` | S-118 | 07 |
| `npc_haybury` (rig), `npc_gander`, `npc_pennywhistle` | Threemills folk | 0.5 / 1.6 / 1.7 | `./cast.md#the-hayburys`, `#goody-gander`, `#pennywhistle` | S-141 | 08 |
| `enemy_field_vole`, `enemy_scarecrowlet`, `enemy_woolly_ram` | Threemills enemies | 0.35-1.0 | `./creatures.md` | S-142 | 08 |
| `boss_honksworth` | Lady Honksworth | 3.2 | `./creatures.md#boss-honksworth` | S-147 | 08 |
| `tool_hook` | Thistle Hook | 0.6 | `./systems.md#items-tools` | S-143 | 08 |
| `prop_threemills_*` | Threemills kit (mills ×3, hedgerow, haystack, orchard tree) | per atlas | `./atlas-isles.md#threemills` | S-139 | 08 |
| `boss_wickwork_moth` | the Wickwork Moth | 4.0 span | `./creatures.md#boss-wickwork-moth` | S-164 | 09 |
| `tool_sunglass` | Sunglass | 0.3 | `./systems.md#items-tools` | S-160 | 09 |

**Act III and the sky (batches 10-15)**

| Key | Thing | Height | Look defined in | Code step | Batch |
|---|---|---|---|---|---|
| `npc_gran_burrows`, `npc_burrower` (rig = Digby's) | Burrowbottom moles | 0.8 | `./cast.md#gran-burrows` | S-178 | 10 |
| `enemy_glow_grub`, `enemy_drip_bat`, `enemy_pebble_mimic` | Rootdeep enemies | 0.4-0.7 | `./creatures.md` | S-179 | 10 |
| `boss_lumbra` | Lumbra the Long (segmented: `seg0`-`seg11` nodes) | 14 m long, 2.2 tall | `./creatures.md#boss-lumbra` | S-185 | 10 |
| `tool_mitts` | Digging Paws | 0.25 | `./systems.md#items-tools` | S-181 | 10 |
| `npc_young_shellby`, `npc_young_pelagia`, `npc_young_wick` | young cast (recolours + one code-built) | per [§8.4](#young-cast) | `./cast.md#young-cast` | S-189 | 10 |
| `npc_pell`, `npc_whelk` | Puffin Post folk | 0.8 / 0.6 | `./cast.md#postmistress-pell`, `#mr-whelk` | S-203 | 11 |
| `enemy_bubble_puffer`, `enemy_gullgrab` | Glassway enemies | 0.6 / 0.9 | `./creatures.md` | S-204 | 11 |
| `boss_pelagia` | Pelagia | 3.0 | `./creatures.md#boss-pelagia` | S-211 | 11 |
| `boss_bosun_snore` | Bosun Snore | 2.4 | `./creatures.md#boss-bosun-snore` | S-214 | 11 |
| `tool_starsong` | Starsong leaf whistle | 0.15 | `./systems.md#items-tools` | S-208 | 11 |
| `prop_glassway_*` | Glassway kit (post office stilts, buoy, wreck hulls ×3, Sunken Bell spire, Snoozing Whale) | per atlas | `./atlas-far.md#glassway` | S-201 | 11 |
| `npc_scoria`, `npc_pitch`, `npc_soakley` | Forgefall folk | 1.9 / 0.5 / 1.0 | `./cast.md#master-scoria`, `#pitch`, `#soakley` | S-225 | 12 |
| `enemy_soot_snuffle`, `enemy_steam_puff`, `enemy_ash_moth` | Kettle enemies | 0.5-0.8 | `./creatures.md` | S-226 | 12 |
| `boss_fumarole` | Lady Fumarole | 3.4 | `./creatures.md#boss-fumarole` | S-231 | 12 |
| `boss_flurry` | Great-Aunt Flurry | 5.0 | `./creatures.md#boss-flurry` | S-239 | 12 |
| `tool_sling` | Ember Sling | 0.4 | `./systems.md#items-tools` | S-227 | 12 |
| `prop_kettle_*` | Kettle kit (forge house, bath terrace, steam vent, the Kettle cone) | per atlas | `./atlas-far.md#kettle` | S-223 | 12 |
| `npc_sable`, `npc_dig_crew` (rig) | Sablecamp jerboas | 0.6 | `./cast.md#sable` | S-246 | 13 |
| `enemy_sandsnoot`, `enemy_prickle_pear`, `enemy_sun_beetle`, `enemy_dust_puff` | Saltglass enemies | 0.4-0.9 | `./creatures.md` | S-247 | 13 |
| `boss_scarabelle` | Tutor Scarabelle | 2.2 | `./creatures.md#boss-scarabelle` | S-252 | 13 |
| `tool_gloves`, `sword_starsteel` | Ivy Gloves, Starsteel Sword | 0.2 / 0.9 | `./systems.md#items-tools` | S-248, S-233 | 13 |
| `prop_saltglass_*` | Saltglass kit (dune glass sculptures, salt pan stamps, Academy) | per atlas | `./atlas-far.md#saltglass` | S-244 | 13 |
| `npc_nimble` (rig) | the Nimbles | 0.6 | `./cast.md#the-nimbles` | S-266 | 14 |
| `enemy_nimbus_puff`, `enemy_gust_kite` | Driftholm enemies | 0.7 / 1.0 | `./creatures.md` | S-266 | 14 |
| `prop_driftholm_*` | Driftholm kit (Spiral Arch, shelter, scrap lamps, Tally Wall) | per atlas | `./atlas-far.md#driftholm` | S-263 | 14 |
| `tool_cloudstep` | Cloudstep anklet | 0.1 | `./systems.md#items-tools` | S-268 | 14 |
| `npc_brightwell`, `npc_twinkling` (rig) | Starkin | 6.0 / 0.5 | `./cast.md#old-mother-brightwell`, `#the-twinklings` | S-276 | 15 |
| `enemy_stardust_sprite`, `enemy_comet_pup`, `enemy_moonbeam_turret`, `enemy_wisp_lantern` | Starmeadow enemies | 0.4-1.2 | `./creatures.md` | S-277 | 15 |
| `prop_starmeadow_*`, `prop_crown_*` | star lanterns, bridge glyph posts, the Ladder segments, bough lanterns | per atlas | `./atlas-far.md#starmeadow`, `#crown` | S-275, S-283 | 15 |
| `enemy_hushling` | Hushling | 0.8 | `./creatures.md#enemy-hushling` | S-218 | 11 |
| `npc_great_tree_face` | none: the Tree's awake face is a texture swap on `great_tree` ([§8.1](#home)) | - | - | S-065 | - |

The NPC cast not listed above (home villagers) already have shipped code rigs or GLBs; their briefs are in
`./cast.md` and collected into the batch of the step that first touches them.

---

<a id="ui"></a>

## 7. UI art: journal, icons, frames

The HUD stays HTML over the canvas in the shipped cream-and-brown storybook style (Fredoka, rounded panels, soft
shadows; `--cream #fdf6e3`, brown text `#5a3e2b`). New UI is built from CSS plus the painted pieces below. Every
painted UI piece is core (no realm tag) unless marked.

### 7.1 Hoot's Field Notes (the journal, S-037 onward)

| Key | What | Size | Prompt subject (after preamble + kind suffix) | Fallback |
|---|---|---|---|---|
| `ui_paper` (shipped) | the page background | shipped | - | shipped |
| `ui_journal_cover` | the notebook's open-spread frame: a worn green cloth cover with an owl-feather bookmark, seen flat from above, the two cream pages blank | 1536×1024 webp ≤ 160 KB (key-art exception) | kind `map`-like flat painting: "An open naturalist's field notebook seen flat from directly above, two blank cream pages, a worn leaf-green cloth cover edge around them, a brown owl feather as a bookmark ribbon, a pencil tucked in the spine. Palette: #fdf6e3 #8aa83c #5a3e2b #c98b4b." | `F-canvas`: CSS two-page spread, `--cream` pages, `#8aa83c` 18 px border radius 14 |
| `icons_journal` | atlas of 12 cells, 128²: `tab_quests` (a quill on a list), `tab_items` (a satchel), `tab_bestiary` (a paw print in a magnifier), `tab_lore` (an open old book with a spiral), `tab_map` (a folded map), `tab_completion` (a ribboned rosette), `ask_tree` (a small tree with a speech-leaf), `nudge` (one leaf), `answer` (two leaves), `letters` (a rolled letter with a ribbon), `memories` (a glowing knot), `replay` (a little film of three frames drawn as leaves) | 768×256 webp ≤ 70 KB | kind `sheet-items` with N = 12: the twelve objects listed, in that order, "Palette: #8aa83c #c98b4b #fdf6e3 #ffd98a." | `F-glyph`: ✎ ◆ ♞ ❦ ⌖ ✿ ✲ · ‥ ✉ ✺ ↺ |
| `ui_letter_paper` | the paper for Bottle Chain letters, Lamp Logs and the 13th letter | 768×1024 webp ≤ 90 KB | kind `tile`-like but not seamless: "A single sheet of old cream letter paper, soft deckled edges, faint water stain at one corner, a tiny spiral watermark in the centre, seen flat. Palette: #f6ecd2 #d9c49a #7fb6c9." | `F-canvas`: `#f6ecd2` with a 2 px `#d9c49a` inset border |
| `ui_letter_moon` (`realm: moonmere`) | Mote's unsent letters | 768×1024 webp ≤ 90 KB | "A single sheet of silvery-blue night paper with soft deckled edges, tiny painted star specks, faint folds, seen flat. Palette: #cfd8ee #2a3358 #f6f3d8." | `F-canvas`: `#cfd8ee`, 2 px `#2a3358` border |
| `ui_logpage` | Lamp Log page (Lamplighter logbook) | 768×1024 webp ≤ 90 KB | "A single ruled logbook page with a brass-cornered binding edge on the left, faint moth-wing watermark in the centre, seen flat. Palette: #efe6d0 #c9a24a #7fb6c9." | `F-canvas`: `#efe6d0`, ruled lines `#d9cba8` every 28 px |

### 7.2 Icon atlases

All icons: kind `icon`, generated as a `sheet-items` grid, sliced, exported at 120 px tall (128 cell with the
2 px pad), packed with `tools/pack_atlas.py` at 128² cells, ≤ 6 KB per cell after webp. Fallback `F-glyph` per
cell. Subjects use the hex anchors in [§1](#style).

**`icons_items`** (8 × 6 cells, 1024×768 webp ≤ 260 KB; one sheet per row of 8, generated in the step that first
needs that row, appended with `--append`):

| Row | Cells (key = cell name) | First step |
|---|---|---|
| 1 Tools I | `lantern` (round green bud lamp glowing gold `#ffd98a`), `glider` (a broad curled leaf `#9cb84a` with a twig grip), `tide_bell` (a small sea-green bell `#3fa79a` with a shell clapper), `hook` (a purple thistle head `#8a5a9c` on a coil of twine), `sunglass` (a round brass lens `#c9a24a` with a sunburst glint), `mitts` (a pair of brown digging mitts `#8a5a3c` with pale claws), `starsong` (a leaf whistle `#8be07a` with three tiny stars), `sling` (a wooden Y-sling with a glowing ember seed `#e66f4f`) | S-057 (lantern), the rest at each tool step |
| 2 Tools II and swords | `gloves` (green ivy gloves `#6f9a3c` with leaf cuffs), `cloudstep` (a fluffy cloud anklet `#f7f2ff`), `sword_wood` (shipped look), `sword_shiny` (shipped look), `sword_starsteel` (a short sword with a pale blue-white blade `#d8e8ff` and a tiny star in the guard), `rod` (a bamboo fishing rod with a red float), `chart` (a rolled parchment chart tied with blue ribbon), `chart_clover` (a painted chart with a bunny-paw stamp) | S-068 / S-080 |
| 3 Story items | `stone_bell` (a round grey keystone with a spiral `#7fb6c9`), `stone_kettle` (the same keystone, warm `#e66f4f` glow), `stone_academy` (the same, sand-gold `#c9a46b`), `firstlight` (a tiny flame in a glass drop `#ffe9a8`), `star_splinter` (a sliver of starlight `#f7f2ff`), `new_seed` (a fourth Starseed, pale gold `#ffe9a8`, leaf-star shape), `parcel` (a brown paper parcel with string and no label), `chime_bell` (a small brass hand bell with a ribbon) | S-165 / S-212 / S-240 |
| 4 Keys and dungeon | `key_small` (a little brass key with a leaf bow), `key_boss` (the Root Key: a brass key whose bow is a twist of tree root curled into a spiral), `map_dungeon` (a folded paper map), `compass` (the Chime Stone: a smooth round blue-grey pebble with a tiny brass bell set into it and a soft star-shaped glow), `ships_bell` (a ship's bell, polished `#c9a24a`), `hanky_miso` (a frilly pink hanky with a "limited edition" rosette, no text), `hanky_shellby` (a soft cream hanky with a blue spiral embroidered), `bun` (a cinnamon bun) | S-052 / S-214 / S-289 |
| 5 Upgrades and goods | `bright_wick` (a lantern wick with a big glow), `swift_fluff` (a dandelion fluff with motion lines), `quick_draw` (a sling with two ember seeds), `heart_container` (shipped look), `potion` (shipped look), `trim` (a swatch of hood cloth folded with a leaf pin), `furnishing` (a tiny armchair), `plushie` (a stitched round plush with button eyes) | S-092 / S-302 |
| 6 Spare | 8 empty cells for later steps | - |

**`icons_collect`** (8 × 2 cells, 1024×256 webp ≤ 90 KB, S-071): `acorn` (a sleeping acorn with a tiny nightcap),
`keepsake` (a small wooden keepsake box with a twinkle), `bottle` (a corked glass bottle with a rolled letter),
`lamp_log` (a small brass-cornered book with a moth on it), `petal` (one pink heart-shaped petal `#f6a6c0`),
`vista` (Hoot's sketch pad with a pencil), `fish` (a round cartoon fish `#7fd3d0`), `plushie_shelf` (three plushies
on a shelf), `hollow` (a spiral-carved round door), `region` (a little flag on a hill), `bench` (the Lamplighter
bench), `chest` (shipped chest look), `gem_bag` (a cloth pouch of gems), `crown_lantern` (a round paper lantern
glowing `#ffe9a8`), `beacon` (a stone beacon with a flame), `dream` (a closed sleepy eye with a pastel bubble).

**`icons_hud`** (8 × 2, 1024×256 webp ≤ 70 KB, S-080): `chime` (three curved sound lines around a bell: the Chime
Bell's visual twin), `zpuff` (a soft "z" cloud: the acorn snore's twin; also a world billboard
`card_fx_zpuff`), `marker_bench`, `marker_rootgate` (a round root door), `marker_beacon` (a flame on a pillar),
`marker_stone` (a keystone), `marker_dungeon` (an arched door), `marker_jetty` (a little boat), `marker_hollow`,
`marker_memory` (a glowing knot), `marker_star_door` (a door with a star), `marker_quest` (a gold leaf), `boat`
(the *Dandelion* from above), `tool_ring` (a cream ring frame for the HUD tool slot), `lock` (a padlock with a
leaf), `fog` (a puff of grey-lilac fog for unbuilt isles on the chart).

**`icons_lands`** (8 × 2, 1024×256 webp ≤ 80 KB, S-074): one painted roundel per land for the Completion page and
chart: `home` (the Great Tree), `duskwick` (the Tower), `pinewhistle` (the Whistling Pine), `archwater` (the
Great Arch), `threemills` (three mills on a hill), `rootdeep` (the Taproot), `glassway` (the bell spire in shallows),
`kettle` (the kettle-shaped volcano), `saltglass` (the Academy bell tower in dunes), `driftholm` (the Spiral Arch on a
floating isle), `starmeadow` (a ladder of lights), `crown` (lanterns in a canopy), `remembered` (the Tree in sepia),
`moonmere` (the Moon Tree), `night` (the Tree under a new star), `margins` (a sketched pine).

### 7.3 Dialogue frames (CSS, no images)

| Frame | Used for | Panel | Border | Name tag | Extra |
|---|---|---|---|---|---|
| default (shipped) | everyone | `--cream` | shipped | shipped | - |
| `frame-wenna` | Wenna, Ask the Tree | `#fff6dc` | 3 px `#e9c46a`, outer glow `0 0 18px #ffe9a8` | `#f2b45a` text on `#fffaf0` | a slow 4 s gold shimmer on the border (off with Motion comfort) |
| `frame-mote` | Mote | `#2a3358` with `#f6f3d8` text | 3 px `#c9b6ec`, glow `0 0 16px #f7f2ff` | `#c9b6ec` | tiny star specks (CSS radial gradients) |
| `frame-memory` | memory scenes, young cast | `#f2e2bc` | 3 px `#b8894a`, inner vignette | `#6f5a44` | text in `#6f5a44` |
| `frame-letter` | bottles, Lamp Logs, the 13th letter | `ui_letter_paper` / `ui_logpage` | none | none | Fredoka 1.15× size, `#5a3e2b`, 32 px margins |

Contrast check: every frame's body text meets 4.5:1 (S-037's `hud.audit()` gains a contrast assertion for the frames).

### 7.4 Charts and maps

| Key | What | Size | Prompt subject | Fallback |
|---|---|---|---|---|
| `chart_world` | the Lamplighter's Chart: the Wide Blue from above, home in the centre, the four near isles at their compass bearings (Pinewhistle N-NW, Archwater E-SE, Duskwick S-SE, Threemills W-SW), Kettle Isle E-NE and Saltglass Flats S-SW farther out, the Glassway's islets as a scatter between home and the far two, the sky isle as a faint painted shape in the NE corner; spirals at each isle | 1536×1024 webp ≤ 260 KB (exception) | kind `map`: "An old sea chart of a small archipelago painted on cream parchment, a big central island with one great tree, four smaller islands around it at north-north-west, east-south-east, south-south-east and west-south-west, two farther islands at east-north-east and south-south-west, a scatter of tiny islets between, a faint floating island in the north-east corner, small pale-blue spiral marks on each island, soft sea washes. Palette: #f6ecd2 #7fb6c9 #c9a24a #8aa83c." | `F-canvas`: nodes and links (ENGINE §5, S-080) |
| `chart_clover` (S-286, epilogue) | Clover's painted chart: the same geography in bright crayon-and-watercolour, little drawings of the friends at each isle, a bunny-paw stamp | 1536×1024 webp ≤ 280 KB | "A child's bright watercolour-and-crayon map of the same archipelago, cheerful wobbly coastlines, tiny drawings of a lighthouse, a tall pine, a sea arch, three windmills, a volcano shaped like a kettle, a bell tower in dunes, a floating island with an arch, a ladder of little lights in the sky, a small paw-print stamp in a corner. Palette: #ffd98a #8be07a #7fd3d0 #ff9f8f." | `chart_world` |
| `map_<realm>` | per-land map art behind the This-land map card | 1024² webp ≤ 200 KB | per land section | `F-canvas`: today's `buildMapCanvas(W)` |

---

<a id="cards"></a>

### 7.5 Bestiary cards

Kind `card-beast`, 384² webp ≤ 40 KB, key `card_<id>` (ids from `./creatures.md`; the shipped enemy ids for the
six home species). The journal shows each in a CSS frame (cream mat, 3 px `#5a3e2b` rounded border, name tag);
the image itself has no frame. Background: a soft vignette of the creature's home land in that land's swatch.
Fallback `F-canvas`: the land swatch's light colour disc with the creature's shipped sprite (home) or a silhouette
drawn from its procedural model's bounding primitives (new species) in its main hex.

**Bundle rule.** Home species, the three Catchers, Sir Rollo, Mote and the Dimling are core. Every other card
carries its land's realm tag; the journal requests its bundle when the Bestiary tab opens and shows the fallback
until it arrives.

**The nine cards of S-046** (subjects; preamble + `card-beast` suffix before each):

| Key | Subject |
|---|---|
| `card_slime` | "A round lime-green jelly slime `#8cc63f` with a single green leaf on top, big shiny eyes and rosy cheeks, smiling, sitting in short meadow grass with daisies. Palette: #8cc63f #f4e9c4 #ff9f8f #5aaef2." |
| `card_mushroom` | "A small grumpy mushroom creature with a red cap with cream spots `#d9483b`, a cream stalk body, frowning eyebrows and stubby feet, standing on mossy woodland floor under ferns. Palette: #d9483b #f4e2c8 #9cc79a #6f5a44." |
| `card_bat` | "A sleepy purple bat `#7a5aa8` with big pink-lined ears and soft wings spread, tiny fang, half-closed happy eyes, hanging in front of a misty mountain dusk. Palette: #7a5aa8 #f6b6c8 #e6eef8 #3d4c8f." |
| `card_bee` | "A fuzzy round yellow-and-brown striped bee `#f2c43a` with small white wings and curly antennae, cheerful, hovering over pink and white meadow flowers. Palette: #f2c43a #5a3e2b #f6a6c0 #f4e9c4." |
| `card_crab` | "A small orange crab `#f08a3c` with one big raised claw, eyes on stalks, a determined little grin, on warm sand by gentle surf. Palette: #f08a3c #f6e6c4 #7fd3d0 #ffffff." |
| `card_snowpuff` | "A round white snow-cloud puff with a tiny ice crystal crown `#9fdcff`, puffed cheeks and a cross little frown, floating over snowy peaks. Palette: #ffffff #9fdcff #e6eef8 #5f70bf." |
| `card_boss_shroom` | "Grumble Shroom: a large old mushroom guardian with a purple cap with yellow spots `#7a4a8c`, a tiny gold crown, a big white moustache and beard, mossy shoulders, grumpy but kind eyes, standing by a fairy ring in deep woods at dusk with three little night-lights. Palette: #7a4a8c #f2c43a #f4e2c8 #9cc79a." |
| `card_boss_crab` | "Captain Pinch: a big red crab `#d9483b` in a small navy pirate captain's hat with an anchor badge, barnacles on the shell, one claw raised in salute, on a rocky shore under a lighthouse. Palette: #d9483b #2f3f6a #f6e6c4 #7fd3d0." |
| `card_boss_frost` | "Frostbun: a huge fluffy white rabbit guardian with icicle-tipped ears `#ffffff`, pale blue ice crystals in the fur `#9fdcff`, a cross sleepy face with a frosty breath puff, sitting in a snow nest on a mountain summit. Palette: #ffffff #9fdcff #e6eef8 #f6b6c8." |

Every later card is generated in its species step (S-058, S-089, S-100, S-121, S-142, S-179, S-204, S-218, S-226,
S-247, S-266, S-277) and its boss step, subject = the creature's "Model brief" line in `./creatures.md` + "in its home
in <land>, <one land detail from §10>" + the land swatch. Mote's card (`card_mote`, S-090) shows him as a soft
cloaked light on a scrap-lamp-lit meadow at night; it is filed under "Friends", never "Bestiary" enemies, and has no
poof count (`./charter.md#always` A5).

<a id="portraits"></a>

### 7.6 Portraits

Kind `portrait`, 512² webp ≤ 60 KB, key `portrait_<castId>` (`castId` = the id in `./cast.md`), shown at 160 px
(dialogue name plate) and 256 px (journal People list). Subject = the cast "Look" line + palette hexes.
Fallback `F-canvas`: a disc in the character's first palette hex with the shipped sprite (`npc_*`) if one exists,
else the initial letter in Fredoka. A portrait is generated in the step that first puts the character on screen;
a turnaround `sheet` is generated alongside for every character that gets a code-built model, saved to
`docs/art/ref/`.

**Core portraits** (no realm tag; they appear in many places): Elder Shellby, Mayor Ribbit, Miso, Clover, Professor
Hoot, Digby, Grandpa Dormy, Nell Pelliwick, Hazel Thimble, Granny Mochi, Primrose Thistledown, Puddle, a
Quackenbush, Kinako, Rook, Grumble Shroom, Captain Pinch, Frostbun, Wenna (her face, awake, in a soft-gold disc),
Mote, Granny Wick, Sir Rollo, Lumbra the Long (he ferries everywhere), Pelagia. **24 × 55 KB.**

**Realm portraits** (tagged with the land they live in): Flick (duskwick); Elder Nutmeg, Professor Pinfeather,
Mossmantle (pinewhistle); Skipper Rafferty, Old Gloop (archwater); Ma Haybury, Goody Gander, Lady Honksworth,
Pennywhistle (threemills); the Wickwork Moth (duskwick); Gran Burrows (rootdeep); Postmistress Pell, Mr Whelk,
Bosun Snore (glassway); Master Scoria, Pitch, Soakley, Lady Fumarole (kettle); Sable, Tutor Scarabelle (saltglass);
a Nimble (driftholm); Old Mother Brightwell, a Twinkling (starmeadow); Great-Aunt Flurry (postgame).

**Wenna's two faces.** `great_tree` (GLB) carries the sleepy face. The awake face (I.6) is a decal swap: generate
`decal_wenna_awake` (kind `decal`, 512² with alpha): "The gentle face of a giant old tree carved softly in its bark:
eyes open and kind, a small smile, rosy knots for cheeks, a three-turn spiral on the brow, painted as part of warm
brown bark. Palette: #8a5a3c #6f5a44 #f6b6a0 #ffe9a8." The decal is projected on the trunk face area (code in S-065;
fallback `F-none`: the sleepy face stays).

---

<a id="home"></a>

## 8. Home island art

Starseed Isle's art stays as shipped; every addition is a post-pass prop or a sky element (`./atlas-home.md` owns the
placements). All rows here are core.

### 8.1 Home additions

| Key | What | Size / format | Prompt subject (preamble + kind suffix first) | Processing | Fallback | Step |
|---|---|---|---|---|---|---|
| `tree_blossom_cluster` | one blossom cluster card, instanced on the three seed boughs (12 cards per bough, crossed pairs) | 256² webp alpha ≤ 30 KB | `card`: "A round cluster of soft pink and cream five-petal blossoms with a few fresh green leaves, painted loosely, glowing faintly at the centre. Palette: #f6c6d8 #fff1e6 #9cb84a #ffe9a8." | white-key → slice → export 252 px | `F-canvas`: three overlapping `#f6c6d8` circles with `#fff1e6` centres | S-009 |
| `card_fx_glowmoss` | glow-moss tuft on Grumble's Crown and the fairy rings (night emissive) | 256×128 webp alpha ≤ 20 KB | `card`: "A low tuft of soft moss with tiny glowing teal-green specks, seen from the side. Palette: #7be0c8 #4a7a5a #c8ffe8." | as above, 124 px | `F-canvas`: `#7be0c8` ellipse | S-011 |
| `decal_snow_cradle` | the hollow in Frostbun's snow nest | 256² webp alpha ≤ 20 KB | `decal`: "A small round hollow pressed in soft snow shaped like a cradle, blue shadows inside. Palette: #ffffff #cfe6ff #9fdcff." | white-key on light blue: generate on `#ff00ff` magenta instead of white and key magenta | `F-mesh` | S-004 |
| `card_fx_crown_lantern` | the glow sprite of each crown lantern when lit | 128² webp alpha ≤ 8 KB | `card`: "A soft round glow of warm golden light with a brighter core, no object, just light. Palette: #ffe9a8 #f2b45a." | white-key, additive | `F-canvas`: radial gradient `#ffe9a8` → 0 | S-095 |
| `decal_tree_ring` | the ring carved on the Tree per 25 acorns | 512×128 webp alpha ≤ 20 KB | `decal`: "A thin carved band of tiny leaves and acorns running around in a horizontal strip, cut softly into tree bark. Palette: #6f5a44 #8a5a3c #f2c43a." | white-key | `F-none` | S-161 |
| `kit_sapling` texture | the sapling's leaf card | 256² webp alpha ≤ 25 KB | `card`: "A young sapling's top: a small fan of fresh bright leaves on a thin twig. Palette: #9cb84a #c8e07a #6f5a44." | as above | `F-canvas` | S-161 |
| `card_fx_zpuff` | the "z" snore puff over a Sleeping Acorn (visual twin of the snore) | 128² webp alpha ≤ 8 KB | `card`: "A tiny soft cloud puff shaped like a lowercase letter z drawn as a cloud, cream with a lilac shadow." (the one allowed letter shape: it is a cloud, not text) | white-key | `F-glyph:z` billboard | S-161 |
| `sketch_home_1`-`_4` | Hoot's four home vista sketches | 512×288 webp ≤ 45 KB each | `sketch`: the vista's view (subjects in `./atlas-home.md#vistas`) + "Palette: #f4e9c4 #8aa83c #5aaef2 #f6a6c0." | resize | `F-canvas`: cream card with the vista's name in Fredoka | S-076 |
| `prop_home_hoots_board` texture | the board's cork face | 512×256 webp ≤ 40 KB | `tile`-like: "A cork pinboard surface with a few brass pins and paper corners, flat." | make_seamless 512 | `F-flat:#c98b4b` | S-076 |
| `ui_wenna_glow` | soft-gold full-screen vignette when Wenna speaks | 1024×576 webp alpha ≤ 40 KB | `card`: "A soft golden light vignette: transparent centre, warm gold glow toward the edges and corners." | white-key inverted (key the centre) | CSS radial gradient | S-065 |

**The four boughs** (S-009) are code: each bough is a child mesh of the Great Tree with 12 crossed blossom cards
(`tree_blossom_cluster`, instanced, one draw call for all 36 cards). The Meadow bough's cards use `gt_foliage_card_b`
(always in leaf). **Crown lanterns** (S-095): 8 code-built paper lanterns (sphere 0.5 m, `#fff1e6` paper, emissive
`#ffe9a8` at 0 unlit / 2.2 lit) hung under the crown at the bearings in `./atlas-home.md#great-tree`, each with one
`card_fx_crown_lantern` additive card; one instanced draw for all 8 bodies.

<a id="horizon"></a>

### 8.2 Sky and horizon (S-064, S-165, S-264)

The six horizon cards are real neighbours. The shipped cards a-d stay byte-identical; S-064 re-points them and
adds e and f. One sprite batch draws all sky cards (the shipped single draw call is kept). The bearings below are
the CANON §5.3 compass points as degrees; if `./atlas-home.md#sky` gives exact bearings, that file wins.

| Key | Isle | Bearing (from the Tree, 0 = N, clockwise) | Size | Prompt subject (`horizon` kind) | Fallback |
|---|---|---|---|---|---|
| `horizon_isle_a` (shipped) | Pinewhistle | 330 degrees (N-NW) | 1024×307 | shipped | `F-none` |
| `horizon_isle_b` (shipped) | Archwater | 115 degrees (E-SE) | 1024×307 | shipped | `F-none` |
| `horizon_isle_c` (shipped) | Duskwick | 155 degrees (S-SE) | 1024×307 | shipped (the lit tower) | `F-none` |
| `horizon_isle_d` (shipped) | Threemills | 245 degrees (W-SW) | 1024×307 | shipped | `F-none` |
| `horizon_isle_e` | Kettle Isle | 65 degrees (E-NE) | 1024×307 webp ≤ 60 KB | "A far-away volcanic island shaped like a round teakettle, a single soft plume of white steam from its spout-like peak, a few dark trees on its terraced flank, black sand at its foot. Palette: #3b3540 #e66f4f #f4d1a6 #8fc7a0." | `F-none` |
| `horizon_isle_f` | Saltglass Flats | 200 degrees (S-SW) | 1024×307 webp ≤ 60 KB | "A far-away long flat pale desert island with low wind-shaped dunes, a single half-buried old bell tower standing up in the middle, a few glints of glass in the sand. Palette: #efe3c8 #c9a46b #8ec9d8 #b55d4c." | `F-none` |
| `horizon_night_windows` | the night glow overlay | 512×128 webp alpha ≤ 15 KB, 4 cells of 128×128 | `sheet-items` N = 4: "four soft glows: a single warm window glow, a cluster of three tiny window glows, a lighthouse lamp glow with a faint beam, a round soft beacon glow. Palette: #ffd98a #f2b45a." | white-key → slice → pack | `F-canvas`: radial `#ffd98a` |
| `horizon_fogbank` | the fog bank that veils an isle not yet reachable | 1024×307 webp alpha ≤ 40 KB | `horizon`: "a low soft bank of lilac-grey sea fog lying on the horizon line, no island visible." | white-key | draw the isle card at 25 % alpha |
| `sky_ladder` (S-165) | Mote's Ladder of Lights hanging in the NE sky | 256×1024 webp alpha ≤ 50 KB, additive | `card`: "A tall thin vertical ladder made of small floating lights, each rung a soft glowing dot pair, getting fainter toward the top, slight sway. Palette: #f7f2ff #c9b6ec #ffe9a8." | white-key; drawn additive; height = 40 degrees of sky | `F-canvas`: 24 dot pairs on a line |
| `sky_starstair` (S-264) | the Starstair flights seen from other realms | 512×512 webp alpha ≤ 50 KB, 3 cells (1, 2, 3 flights) stacked vertically | `sheet-items` N = 3: "a floating stone stair in the sky rising toward a small floating island: one flight / two flights / three flights of pale stone steps with spiral marks, seen from far away." | slice → pack | `F-none` |
| `sky_isle` (shipped) | Driftholm, NE | shipped | shipped | `F-none` |
| `sky_mote_star` (S-286) | Mote's new star above the Tree (epilogue onward) | 128² webp alpha ≤ 8 KB | `card`: "a single small bright star with soft four-point rays, lilac-white." | white-key, additive | `F-canvas` |

**Night windows.** Each card lists window points as `(u, v)` in card space; at night (`sky.night ≥ 0.5`) a
`horizon_night_windows` cell is drawn at each point when the isle's flag says lit, in the same sprite batch. Points:
a (Pinewhistle) `[(0.52, 0.38)]` cell 4 (the singing pine's beacon); b (Archwater) `[(0.47, 0.55)]` cell 4;
c (Duskwick) `[(0.69, 0.30)]` cell 3 (the tower), `[(0.30, 0.70), (0.42, 0.72)]` cell 2 (Wickhaven);
d (Threemills) `[(0.35, 0.60), (0.62, 0.58)]` cell 1; e (Kettle) `[(0.55, 0.40)]` cell 1 (Forgefall);
f (Saltglass) `[(0.50, 0.28)]` cell 1 (the Academy). Flags per isle are in `./atlas-home.md#sky`. Before I.6 all
windows are lit (they go out during the I.6 scene); after I.6 each lights when its beacon or stone beat fires.
**Fog:** cards e and f are drawn at 25 % with `horizon_fogbank` over them until `act2done`.

<a id="hood-trims"></a>

### 8.3 Hood trims (S-303; owner decision 6)

`hero.glb` has one mesh (`body`), one material and one 1024² texture in which the hood, tunic and sprout are all
green. A trim must tint **only the hood**, never replace the GLB. Method:

1. `tools/make_hood_mask.py` (new, S-303, ≈ 50 lines) extracts the GLB's embedded texture and writes
   `hero_hood_mask` (256² greyscale webp ≤ 12 KB): 1 where the texel's hue is 60-110 degrees and saturation ≥ 0.35
   (the green cloth), 0 elsewhere, blurred 2 px.
2. In third person only, the hero material gets an `onBeforeCompile` patch (one uniform set, compiled at warm-up):
   `tintK = mask(uv) × smoothstep(0.66, 0.72, yObj) × (1 − smoothstep(0.93, 0.97, yObj))`, where `yObj` is the
   vertex's object-space height over the model height (the hood starts at the neck, the sprout above 0.93 stays leaf
   green). Colour = `mix(base, luma(base) × 1.6 × trim, tintK)`.
3. First person never shows the hood (the viewmodel is the arm): the patch is skipped in the viewmodel pass.

| Trim id | Name | Hex | Where found (none is sold; systems.md#economy prize chests) |
|---|---|---|---|
| `trim_candle` | Candle Gold | `#f2b45a` | Duskwick `chest-6` |
| `trim_pinemist` | Pine Mist | `#8fae9a` | Pinewhistle `chest-9` |
| `trim_tidepool` | Tidepool Teal | `#7fd3d0` | Archwater `chest-10` |
| `trim_poppy` | Poppy Red | `#c2563f` | Threemills `chest-9` |
| `trim_moonmoth` | Moonmoth Lilac | `#c9b6ec` | Rootdeep `c10` |
| `trim_starlight` | Starlight Blue | `#8fa8ff` | Glassway `c11` |
| `trim_ember` | Ember Rust | `#c46a3a` | Kettle `c10` |
| `trim_dune` | Dune Sand | `#d8b27a` | Saltglass `c03` |
| `trim_snowdrift` | Snowdrift | `#dfeaf6` | ss-12 (Flurry's scarf) |
| `trim_corners` | Three Corners | see creatures.md (the Jamboree) | the Hundred Lamps floor 10 |

The PR shows the eight land trims side by side with the untrimmed hood in third person at the plaza at 10 h and at the
lighthouse at 20 h, for the owner's decision. Fallback: no mask → no tint (the trim item still exists).

<a id="young-cast"></a>

### 8.4 The young cast (S-189; memory scenes)

Looks are in `./cast.md#young-cast`. The art method, so Pip's GLB and every shipped GLB stay untouched:

| Young character | Source | Scale (× shipped height) | Tint method | Extra code-built parts |
|---|---|---|---|---|
| Young Shellby | `npc_turtle` GLB | 0.62 (≈ 0.71 m) | material colour × `#e8f0d0` (lighter, younger shell), no texture change | a too-big brown felt hat (cone + brim, `#8a5a3c`, band `#7fb6c9`), 0.35 m wide, slips 5 degrees each step |
| Young Grumble | `boss_shroom` GLB | 0.45 (≈ 1.44 m) | × `#ffe0f0` (a brighter, pinker cap); the beard is baked into the texture and stays | none |
| Young Pinch | `boss_crab` GLB | 0.55 | × `#ffd8c8`; the hat is baked in the texture, so a sea-green bandana mesh (`#3fa79a`) is placed over it to read "no captain's hat yet" | bandana (squashed torus + knot) |
| Young Frostbun | `boss_frost` GLB | 0.26 (≈ 0.9 m, "the size of a rabbit") | × `#f4f8ff` | none |
| Young Granny Wick | moth rig (S-088) | 0.6 | rig colours: wings `#f6efe0` with `#c9a24a` dots, body `#e6d8c0` | a satchel of lamp wicks |
| Young Pelagia | code-built (S-189) | 1.2 m | own palette in `./cast.md#young-cast` | full code model + ART BRIEF `npc_young_pelagia` |

All young cast are drawn with the `remembered` grade like the rest of the memory realm ([§5.4](#palettes)).

---

<a id="kits"></a>

## 9. Shared kits

<a id="dungeon-kit"></a>

### 9.1 The dungeon kit (S-051)

`js/props-interior.js` builds the interior kit in code (wall segment, corner, arch, door leaf, locked door, boss door,
pillar, stairs, torch bracket, brazier, crate, barrel, push-block, plate, crystal switch, keys, cracked floor,
rubble; `./dungeons.md#kit` owns the list and sizes). Art gives it three base wall sets and the shared cards. Walls
are triplanar-free: a box face uses world-space UVs at 2 m per tile (one texture repeat per 2 m of wall), so any wall
length tiles evenly.

| Key | What | Size | Prompt subject (`tile` kind) | Fallback |
|---|---|---|---|---|
| `wall_stone_hd` (+ `lo`) | rounded grey-lilac fieldstone wall, soft mortar | 1024 / 512 webp | "Rounded soft fieldstones of warm grey and lilac fitted in a wall with pale mortar, gentle moss in a few cracks. Palette: #b8b0b8 #8f8598 #d9d2c3 #8fae6a." | `F-flat:#a8a0ac` |
| `wall_brick_hd` (+ `lo`) | warm rounded old brick | 1024 / 512 webp | "Old rounded bricks in warm terracotta and honey colours, uneven soft edges, pale mortar. Palette: #c98b4b #b5674c #e8c89a #6f5a44." | `F-flat:#b97a52` |
| `wall_moss_hd` (+ `lo`) | moss-covered stone (floors and walls) | 1024 / 512 webp | "Stone floor thickly covered with soft green moss and tiny clover, a few flat stones peeking through. Palette: #6f9a4a #8fae6a #b8b0b8 #4a6a3a." | `F-flat:#7a9a5a` |
| `card_fx_torchflame` | torch and brazier flame strip | 6 frames × 128×256, webp alpha ≤ 40 KB | `card` + strip: "a soft rounded cartoon flame, warm orange and gold, six animation frames of a gentle flicker" | `process_strip.py --fw 128 --fh 256 --frames 6 --height 252`; manifest `{ frames: 6, fps: 10 }` | `F-canvas`: two layered teardrops `#f2b45a`/`#ffe9a8` |
| `card_fx_dust` | floating dust motes in dungeon light shafts | 128² webp alpha ≤ 6 KB | `card`: "a few soft round floating dust specks of light" | white-key | `F-none` |
| `decal_plate` | pressure plate top (also tinted per dungeon) | 256² webp alpha ≤ 20 KB | `decal`: "a round stone pressure plate with a raised leaf emblem, seen from above. Palette: #d9d2c3 #8fae6a #7fb6c9." | white-key | `F-mesh` |
| `decal_crack` | cracked floor (bombable is not a mechanic; it is "dig" with the Paws) | shipped `fx_crack` reused | - | - | shipped |

Budget: a test dungeon built from the kit stays ≤ 120 draw calls (S-051's check). The kit's materials are 4
programs (wall, floor, prop, emissive) shared by every dungeon; per-dungeon looks change textures, never programs.

<a id="lamplighter-kit"></a>

### 9.2 The Lamplighter kit (S-082)

The Lamplighters were moon-moth folk; their work is pale moonstone, brass and spiral inlay, gently rounded, slightly
leaning, always with a lamp. It is the same kit on every isle (`./atlas-isles.md#shared` places it).

**Kit palette:** moonstone `#d9d2c3`, moonstone shadow `#b3a996`, brass `#c9a24a`, brass dark `#8f7034`, spiral
inlay `#7fb6c9`, lamp glow `#ffd98a`, moss `#8fae6a`.

| Key | Thing | Size (m) | Silhouette | Lit / dark states | Code fallback tris | Brief batch |
|---|---|---|---|---|---|---|
| `kit_bench` | waystone bench | 1.0 × 1.6 × 0.6 | curved seat with a lamp post on the left arm | lamp emissive 0 → 1.6 when found | 640 | 04 ([§6.1](#brief-template)) |
| `kit_beacon` | an isle's beacon: a round moonstone pillar with a brass cage and a big glass lamp | 4.2 tall, 1.4 wide | stubby lighthouse-pillar with a bulb top, spiral band at mid height | dark: lamp `#8f8598`, no light; lit: `#ffd98a` emissive 2.4 + one pooled point light (from the 4-light pool) + `card_fx_beacon_flame` | 1,400 | 04 |
| `kit_old_beacon` | the four old Lamplighter beacons on home landmarks | 1.6 tall | a small version of `kit_beacon`, mossy | dark → lit with the Sunglass | 700 | 09 |
| `kit_ruin_arch` | broken spiral arch | 3.2 × 2.6 × 0.6 | an arch with its right top missing | static | 500 | 04 |
| `kit_ruin_pillar` | leaning pillar stub | 1.8 × 0.6 | round pillar with a broken top and a spiral band | static | 260 | 04 |
| `kit_ruin_wall` | low wall run with a lamp niche | 1.2 × 3.0 × 0.5 | low wall, a round niche | niche lamp lit at night | 300 | 04 |
| `kit_rootgate` | root-gate door: a round door of woven roots in a stone ring | 2.4 diameter | a round root-weave door with a spiral at its centre | sealed: roots closed, `#8a5a3c`; open: roots part, glow `#ffcf7a` behind | 900 | 10 |
| `kit_star_door` | star door (Starsong) | 2.2 × 1.4 | an arched moonstone door with a five-point star inlay | star glows when the right tune plays | 600 | 11 |
| `kit_keepsake_case` | the little case behind every landmark | 0.5 | a brass-cornered moonstone box with a glass lid | twinkle (shipped) | 200 | 04 |
| `kit_chest_lamplighter` | overworld chest outside home | 0.7 | the shipped chest silhouette with brass corners and a spiral lock plate | shipped open anim | reuses chest code | 04 |
| `kit_spiral_door` | Hollow door | 2.2 × 1.6 | a round stone door set in a hillside, a big spiral carved across it | spiral glows `#7fb6c9` when found | 600 | 03 |

| Key | What | Size | Prompt subject | Processing | Fallback |
|---|---|---|---|---|---|
| `decal_spiral` | the Spiral glyph (inlay on every kit piece, map and decal) | 256² webp alpha ≤ 12 KB | `decal`: "A simple three-turn spiral, clockwise from the centre, drawn as a smooth soft pale-blue inlaid line of even width, nothing else. Palette: #7fb6c9 #d9d2c3." | white-key → export 252 px | `F-canvas`: an Archimedean spiral, 3 turns, 10 px line `#7fb6c9` |
| `kit_moonstone_hd` (+ `lo`) | moonstone surface for all kit pieces | 512 / 256 webp | `tile`: "Smooth pale moonstone with faint milky veins and tiny sparkles, very soft. Palette: #d9d2c3 #b3a996 #f2ede4." | make_seamless 512 and 256 | `F-flat:#d9d2c3` |
| `card_fx_beacon_flame` | a beacon's flame | 8 frames × 256×256 strip, ≤ 70 KB | `card` + strip: "a round soft golden lamp flame inside a glow, eight frames of a slow breathing pulse. Palette: #ffd98a #f2b45a #fff6dc." | `process_strip.py --fw 256 --fh 256 --frames 8 --height 252`, fps 8 | `F-canvas` radial gradient |
| `card_fx_kindle` | the kindle burst when `[E] Kindle` lands | 512² webp alpha ≤ 40 KB | `card`: "a soft starburst of golden sparks and small leaves spiralling outward" | white-key, additive | shipped `fx_raysburst` |

<a id="under-roots"></a>

### 9.3 Under the Roots (dungeon 1, S-062; bundle `under_roots`)

| Key | What | Size | Prompt subject | Fallback |
|---|---|---|---|---|
| `wall_rootwood_hd` (+ `lo`) | the root-tunnel walls: packed earth threaded with warm root | 1024 / 512 webp | `tile`: "Packed warm brown earth threaded with smooth twisting tree roots, a few small pebbles and pale rootlets. Palette: #8a5a3c #6f4a32 #c98b4b #3a2a20." | `F-flat:#7a5038` |
| `wall_glowroot_hd` (+ `lo`) | glowing roots (emissive map is the texture's luminance above 0.7) | 1024 / 512 webp | `tile`: "Smooth tree roots woven together with thin veins of soft golden light running along them, dark warm earth between. Palette: #6f4a32 #ffcf7a #ffe9a8 #3a2a20." | `F-flat:#8a5a3c` with emissive 0 |
| `decal_glowbud_door` | the glowbud door face | 512² webp alpha ≤ 40 KB | `decal`: "A round wooden door made of curled roots with a big closed flower bud at its centre, petals tight shut. Palette: #8a5a3c #9cb84a #ffd98a." | `F-mesh` |
| `portrait_rollo` | Sir Rollo | 512² | portrait of `./creatures.md#boss-rollo` look | `F-canvas` |
| `docs/art/ref/boss_rollo.webp` | turnaround (docs only) | 1600×800 | `sheet` of the same | - |
| `card_dimling` | Dimling bestiary card (core) | 384² | `card-beast` of `./creatures.md#enemy-dimling` look "in a dark root tunnel lit by a single glowbud" | `F-canvas` |
| `icons_items:lantern` | Lantern icon | atlas cell | row 1 of [§7.2](#ui) | `F-glyph:✺` |
| `load_under_roots` | loading card | 1600×900 + 960×540 | `loading`: "A warm underground tunnel of woven tree roots lit by small glowing buds, a narrow stair curling down into golden light, a tiny round door at the bottom. Palette: #8a5a3c #ffcf7a #9cb84a #3a2a20." | `F-home:loading_bg` |

Music: `under_roots` ([§12.5](#track-data)). Ambience: `under_roots` bed ([§13.2](#ambience)).

---

## 10. Lands

Every land section has the same parts: the bundle, the seven terrain layers, billboard cards, the loading card and
map art, sketches, portraits and bestiary cards (keys only; looks are in `./cast.md` and `./creatures.md`), decals,
then music and ambience. Terrain prompts all use the `tile` suffix; every terrain row's fallback is `F-home:` the home
layer in the same slot (grass, forest, meadow, sand, snow, dirt, rock) and the cliff falls back to `cliff_hd`.
Sizes: terrain 1024 + 512 webp; cards ≤ 1024 on the long side, ≤ 120 KB; loading card 1600×900 ≤ 200 KB + `lo`
960×540; map 1024² ≤ 200 KB; sketches 512×288 ≤ 45 KB.

<a id="duskwick"></a>

### 10.1 Duskwick (`realm: duskwick`, S-085)

Swatch `#2b2238` `#f2b45a` `#ff8f7a` `#3fa79a`. A warm palm isle at dusk, black-and-gold sand, coral shrubs, hot pools,
a moth town on stilts, the Lamplighters' Tower on the NE headland.

| Slot | Key | Subject |
|---|---|---|
| grass | `duskwick_palmgrass` | "Short soft tropical grass with a few fallen palm fronds and tiny orange flowers. Palette: #6fa04a #9cc85a #f2b45a #3fa79a." |
| forest | `duskwick_jungle` | "Shady jungle floor of broad dark leaves, ferns and fallen coconut husks. Palette: #3f6a4a #2f4a3a #8a6a3c #3fa79a." |
| meadow | `duskwick_blossom` | "Low turf covered with coral-pink and gold tropical blossoms. Palette: #ff8f7a #f2b45a #6fa04a #fff1e6." |
| sand | `duskwick_goldsand` | "Swirled black and gold volcanic sand with tiny shell fragments. Palette: #2b2238 #f2b45a #8a7458 #fff1e6." |
| snow | `duskwick_coral` | "Pale coral rubble and bleached-pink coral pebbles on sand, soft and rounded. Palette: #f6d6c8 #ff8f7a #f2e6d6 #c9a48a." |
| dirt | `duskwick_redearth` | "Warm red-orange packed earth path with small round stones. Palette: #b5674c #c98b4b #8a5a3c #e8c89a." |
| rock | `duskwick_basalt` | "Dark warm purple-brown volcanic rock with rounded bubbles and gold lichen spots. Palette: #3b3040 #5a4a5a #f2b45a #2b2238." |
| cliff | `duskwick_cliff` | "Layered dark volcanic cliff face with warm gold bands and hanging vines, seen straight on. Palette: #3b3040 #6a5068 #f2b45a #3fa79a." |

| Key | What | Size | Subject (`card` kind) |
|---|---|---|---|
| `duskwick_card_palmfrond` | grass card cell: palm sprouts and frond tips | 1024×512 atlas of 4 cells (`sprout`, `frond`, `beachgrass`, `coralflower`) | `sheet-items` N = 4: "four low ground plants: a palm sprout, a single fallen palm frond tip, a tuft of beach grass, a coral-pink flower cluster. Palette: #6fa04a #9cc85a #ff8f7a #f2b45a." |
| `duskwick_card_lagoonglow` | lagoon bioluminescent ripples at night (Lagoon Lights activity) | 512² webp alpha | "a soft ring of tiny teal glowing specks on water, seen from above. Palette: #7be0c8 #3fa79a." |
| `duskwick_card_moth` | Wicklings' ambient moths (particles) | 256² 4-frame strip | "a small round cream moth with soft gold-dotted wings, four frames of wing flutter. Palette: #f6efe0 #c9a24a #ffd98a." |
| `duskwick_card_steam` | hot pool steam | 512² webp alpha | "a soft rising curl of white steam, fading at the top" |
| `duskwick_card_lantern_string` | strings of moth lanterns between stilts | 1024×256 webp alpha | "a drooping string of small round paper lanterns glowing warm gold, seen from the side" |

- **Loading card** `load_duskwick`: "Dusk over a small warm palm island: wooden stilt houses with round lit windows over a calm lagoon, strings of little lanterns, black-and-gold sand, coral shrubs, and on a headland a tall pale stone lamp tower with a dark lamp at its top. Palette: #2b2238 #f2b45a #ff8f7a #3fa79a."
- **Map** `map_duskwick`: "A ring-shaped palm island with a lagoon opening to the south, stilt houses on the lagoon, a headland tower in the north-east, black sand beaches. Palette: #2b2238 #f2b45a #ff8f7a #3fa79a."
- **Sketches** `sketch_duskwick_1`-`_2` (subjects in `./atlas-isles.md#duskwick`).
- **Portraits:** `portrait_flick`, `portrait_wickwork_moth` (plus core Granny Wick, Kinako, Mote). Turnarounds for the moth rig and the Wickwork Moth in `docs/art/ref/`.
- **Bestiary cards:** `card_sizzle_beetle`, `card_coco_clonk` (`card_dimling` is core).
- **Tower interior** (dungeon 5) textures: see [§10.13](#dungeon-textures).
- **Music** `duskwick` (dusk marimba), **ambience** `duskwick_town` (Wickhaven) and `duskwick_shore` (the other three regions).

<a id="pinewhistle"></a>

### 10.2 Pinewhistle (`realm: pinewhistle`, S-098)

Swatch `#2f4a3a` `#e8efe9` `#c98b4b` `#8fae9a`. Steep pine hills, misty ravines, rope bridges, a sawmill stream, the
Whistling Pine (34 m, knot-holes in a spiral).

| Slot | Key | Subject |
|---|---|---|
| grass | `pinewhistle_moss` | "Springy green hill moss and short grass with tiny white star flowers. Palette: #5a8a5a #8fae9a #e8efe9 #2f4a3a." |
| forest | `pinewhistle_needles` | "A soft carpet of fallen rust-brown pine needles with small pinecones. Palette: #c98b4b #8a5a3c #5a6a4a #2f4a3a." |
| meadow | `pinewhistle_heather` | "Low lilac heather and green bilberry leaves on a hillside. Palette: #a88ab8 #6a8a6a #8fae9a #e8efe9." |
| sand | `pinewhistle_gravel` | "Rounded grey-green stream gravel with a few wet pebbles. Palette: #a8b0a8 #8fae9a #6a7a6a #e8efe9." |
| snow | `pinewhistle_rime` | "Frosty rime on short grass on a high ridge, pale and sparkling. Palette: #e8efe9 #cfe0dc #8fae9a #ffffff." |
| dirt | `pinewhistle_loam` | "Dark soft forest loam path with roots and a few needles. Palette: #6f4a32 #8a5a3c #4a3a2a #c98b4b." |
| rock | `pinewhistle_granite` | "Rounded speckled grey granite with green-grey lichen. Palette: #9a9a98 #b8b8b0 #7a8a7a #e8efe9." |
| cliff | `pinewhistle_cliff` | "A tall mossy granite ravine wall with ferns in ledges, seen straight on. Palette: #8a8a88 #5a7a5a #8fae9a #2f4a3a." |

| Key | What | Size | Subject |
|---|---|---|---|
| `pinewhistle_card_ground` | 4-cell grass atlas (`fern`, `bilberry`, `startuft`, `mushroomring`) | 1024×512 | `sheet-items` N = 4: "a curled fern, a bilberry bush with blue berries, a tuft of grass with white star flowers, a tiny ring of brown mushrooms. Palette: #5a8a5a #8fae9a #6a7ab8 #c98b4b." |
| `pinewhistle_card_mist` | ravine mist bank (drifting cards at Misthollow) | 1024×256 alpha | "a long soft horizontal band of pale morning mist" |
| `pinewhistle_card_sawdust` | sawmill sawdust puffs | 256² 4-frame strip | "a small puff of golden sawdust, four frames dispersing" |
| `pinewhistle_card_pinecone_glow` | knot-hole glow (the pine sings) | 256² alpha | "a soft round pale-green glow" |
| `pinewhistle_card_bridge_rope` | rope bridge rope texture (alpha cutout) | 512×64 | "a twisted hemp rope, straight, seen from the side" |

- **Loading** `load_pinewhistle`: "Steep green hills covered in tall rounded pine trees, misty ravines crossed by little rope bridges, a sawmill by a stream, and on the highest hill one enormous pine with round knot-holes spiralling up its trunk. Palette: #2f4a3a #e8efe9 #c98b4b #8fae9a."
- **Map** `map_pinewhistle`: "An island of two long ridges running north-east to south-west with misty ravines between, a winding stream with a sawmill, a giant pine on the northern rise. Palette: #2f4a3a #e8efe9 #c98b4b #8fae9a."
- **Sketches** `sketch_pinewhistle_1`-`_3`. **Portraits:** `portrait_nutmeg`, `portrait_pinfeather`, `portrait_mossmantle`.
- **Bestiary:** `card_mossling`, `card_pinecone_puff`, `card_bark_beetle`, `card_needle_wasp`, `card_boss_mossmantle`.
- **Music** `pinewhistle` (wind flute); **ambience** `pinewhistle_hollow` (Acornet Hollow), `pinewhistle_ravine` (Misthollow, Sawmill Run), `pinewhistle_rise` (Whistle Rise; carries `pine_song`).

<a id="archwater"></a>

### 10.3 Archwater (`realm: archwater`, S-119)

Swatch `#36414f` `#e2c9a0` `#6b4a8c` `#7fd3d0`. Basalt columns, tide pools, kelp shallows, sea caves, the Raft
village, the Great Arch (26 m, 40 m span) over the Moon Pool.

| Slot | Key | Subject |
|---|---|---|
| grass | `archwater_saltturf` | "Short salt-meadow turf with tiny sea-pink thrift flowers. Palette: #7a9a6a #9ab88a #f6a6c0 #e2c9a0." |
| forest | `archwater_kelpmat` | "Wet glossy mats of brown and olive kelp on sand. Palette: #6a5a3a #8a7a3a #4a4a2a #7fd3d0." |
| meadow | `archwater_thrift` | "Dense cushions of pink sea thrift flowers on turf. Palette: #f6a6c0 #c87aa0 #7a9a6a #e2c9a0." |
| sand | `archwater_sand` | "Pale warm beach sand with ripple marks and tiny purple shells. Palette: #e2c9a0 #f2e2c0 #6b4a8c #c9b08a." |
| snow | `archwater_tideflat` | "Shiny wet rippled tide-flat sand with small pools reflecting the sky. Palette: #c9b89a #a8c8c8 #7fd3d0 #e2c9a0." |
| dirt | `archwater_shingle` | "Rounded grey and purple pebbles of a shingle beach. Palette: #8a8a98 #6b4a8c #b8b0b8 #36414f." |
| rock | `archwater_hextop` | "Tops of dark hexagonal basalt columns seen from above, rounded edges, a little barnacle and moss. Palette: #36414f #4a5568 #7fd3d0 #e2c9a0." |
| cliff | `archwater_columns` | "A cliff of tall dark hexagonal basalt columns side by side, softly rounded, seen straight on. Palette: #36414f #4a5568 #6b4a8c #7fd3d0." |

| Key | What | Size | Subject |
|---|---|---|---|
| `archwater_card_ground` | 4 cells (`thrift`, `kelpfrond`, `anemone`, `seaholly`) | 1024×512 | `sheet-items` N = 4: "a cushion of pink thrift, an upright kelp frond, a soft round purple sea anemone, a blue-green sea holly. Palette: #f6a6c0 #8a7a3a #6b4a8c #7fd3d0." |
| `archwater_card_spray` | wave spray at the column foot | 512² 4-frame strip | "a soft white burst of sea spray, four frames" |
| `archwater_card_moonpool` | Moon Pool shimmer (beacon lit) | 512² alpha | "a soft round shimmer of silvery-teal light on water seen from above" |
| `archwater_card_bubbles` | tide-pool bubbles | 128² alpha | "a few small round bubbles" |
| `archwater_card_bunting` | the Raft's bunting | 1024×128 alpha | "a string of small triangular cloth flags in teal, purple and sand colours" |

- **Loading** `load_archwater`: "A coast of dark hexagonal basalt columns stepping down into clear teal shallows, tide pools, a little raft village of wooden huts tied together, and a huge natural stone sea arch standing over a round still pool. Palette: #36414f #e2c9a0 #6b4a8c #7fd3d0."
- **Map** `map_archwater`: "A stepped basalt island with tide flats along its south shore, a raft village moored in a bay, a great sea arch over a round pool on the east side, kelp shallows to the west. Palette: #36414f #e2c9a0 #6b4a8c #7fd3d0."
- **Sketches** `sketch_archwater_1`-`_3`. **Portraits:** `portrait_rafferty`, `portrait_gloop`.
- **Bestiary:** `card_tidepool_jelly`, `card_squirt_urchin`, `card_sand_snapper`, `card_boss_gloop`.
- **Music** `archwater` (plucked strings); **ambience** `archwater_raft`, `archwater_coast`.

<a id="threemills"></a>

### 10.4 Threemills (`realm: threemills`, S-140)

Swatch `#7fae4b` `#e7c45a` `#c2563f` `#a7d3f0`. Rolling farmland, wheat squares, orchards, hedgerows, a millpond,
Tumble Hill with Tansy, Thrift and Middle Mill (22 m).

| Slot | Key | Subject |
|---|---|---|
| grass | `threemills_pasture` | "Lush short pasture grass with clover and buttercups. Palette: #7fae4b #9cc85a #e7c45a #ffffff." |
| forest | `threemills_orchard` | "Orchard floor of short grass, fallen apple leaves and a few red windfall apples. Palette: #6a9a4a #c2563f #c9a04a #8a6a3c." |
| meadow | `threemills_wheat` | "Golden wheat stubble rows seen from above, soft and warm. Palette: #e7c45a #d9a84a #f2dc8a #9a8a4a." |
| sand | `threemills_pondsand` | "Soft pale pond-edge sand with reeds' shadows and tiny snail shells. Palette: #e2d2a8 #c9b88a #a7d3f0 #7fae4b." |
| snow | `threemills_chalk` | "A white chalky farm track with flint pebbles and grass edges. Palette: #f2eee0 #d9d2c0 #7fae4b #8a8a88." |
| dirt | `threemills_furrow` | "Ploughed brown furrows in neat soft rows. Palette: #8a5a3c #a87048 #6f4a32 #c98b4b." |
| rock | `threemills_flint` | "Rounded grey flint and sandstone field stones. Palette: #a8a098 #c9b89a #8a8a88 #7fae4b." |
| cliff | `cliff_hd` (home) | - |

| Key | What | Size | Subject |
|---|---|---|---|
| `threemills_card_ground` | 4 cells (`poppy`, `wheatstalk`, `cornflower`, `cowparsley`) | 1024×512 | `sheet-items` N = 4: "a red poppy, a golden wheat stalk tuft, a blue cornflower, a white cow-parsley umbel. Palette: #c2563f #e7c45a #6a8ad8 #ffffff." |
| `threemills_card_chaff` | chaff and seed fluff (Harvest Cut, sails turning) | 256² 4-frame strip | "small golden chaff flakes drifting, four frames" |
| `threemills_card_hedge` | hedgerow top card (near hedges) | 1024×256 alpha | "the rounded top of a green hedgerow with white blossom" |
| `threemills_card_apples` | apple-tree crown overlay card | 512² alpha | "a round apple-tree crown with red apples" |
| `threemills_card_reeds` | millpond reeds | 512² alpha | "a clump of tall reeds and a bulrush" |

- **Loading** `load_threemills`: "Rolling golden and green farmland in patchwork squares, hedgerows, an orchard, a millpond with reeds, and on a round hill three windmills with still sails. Palette: #7fae4b #e7c45a #c2563f #a7d3f0."
- **Map** `map_threemills`: "A gently rolling farm island in patchwork fields, a village of thatched cottages, an orchard in rows, a marshy millpond, three windmills on a hill. Palette: #7fae4b #e7c45a #c2563f #a7d3f0."
- **Sketches** `sketch_threemills_1`-`_3`. **Portraits:** `portrait_ma_haybury`, `portrait_gander`, `portrait_honksworth`, `portrait_pennywhistle`.
- **Bestiary:** `card_field_vole`, `card_scarecrowlet`, `card_woolly_ram`, `card_boss_honksworth`.
- **Music** `threemills` (fiddle and accordion); **ambience** `threemills_farm`, `threemills_marsh`.

<a id="rootdeep"></a>

### 10.5 The Rootdeep (`realm: rootdeep`, S-177)

Swatch `#1c1a24` `#ffcf7a` `#7be0c8` `#8a5a3c`. Glowing root walls, mushroom forests, the Underlake, geodes, the
Taproot (60 m). The cavern is warm and dark, never black: every frame keeps glow in view (rule: at least one
emissive source within 25 m of any walkable cell, checked by the coverage test as a "view").

| Slot | Key | Subject |
|---|---|---|
| grass | `rootdeep_loam` | "Dark soft cave loam with tiny glowing amber specks. Palette: #2a2230 #3a2f3a #ffcf7a #8a5a3c." |
| forest | `rootdeep_mycel` | "A soft white-lilac web of mycelium threads over dark earth. Palette: #d8cce8 #8a7a9a #2a2230 #7be0c8." |
| meadow | `rootdeep_glowmoss` | "Cushions of teal glow moss with brighter specks. Palette: #2e6a60 #7be0c8 #c8ffe8 #1c1a24." |
| sand | `rootdeep_lakesand` | "Fine dark-blue lake shore sand with tiny glowing pebbles. Palette: #2a3440 #3a4a58 #7be0c8 #ffcf7a." |
| snow | `rootdeep_geode` | "Lavender and lilac crystal crust like the inside of a geode, soft facets. Palette: #8a6ab8 #b8a0e0 #e8dcff #3a2a48." |
| dirt | `rootdeep_rootfloor` | "A floor of flattened smooth roots worn into a path. Palette: #8a5a3c #6f4a32 #c98b4b #ffcf7a." |
| rock | `rootdeep_cavestone` | "Rounded dark cave stone with warm brown veins. Palette: #3a3040 #4a3a48 #8a5a3c #1c1a24." |
| cliff | `rootdeep_rootwall` | = `wall_glowroot_hd` reused | - |

| Key | What | Size | Subject |
|---|---|---|---|
| `rootdeep_card_ground` | 4 cells (`glowcap`, `rootlet`, `crystal`, `drip`) | 1024×512 | `sheet-items` N = 4: "a small glowing teal mushroom, a curling pale rootlet, a small lilac crystal cluster, a hanging water drip with a glow. Palette: #7be0c8 #d8cce8 #b8a0e0 #ffcf7a." |
| `rootdeep_card_spores` | floating glowing spores (ambient particles) | 128² alpha | "a few tiny soft glowing teal dots" |
| `rootdeep_card_memoryknot` | memory-knot glow (Taproot) | 512² 8-frame strip | "a knot of glowing roots pulsing softly gold, eight frames" |
| `rootdeep_card_lakeglow` | Underlake surface shimmer | 512² alpha | "soft teal ripples of light seen from above" |

- **Loading** `load_rootdeep`: "A vast warm underground cavern: an enormous glowing tree-root column rising out of sight, mushrooms as big as houses glowing teal, a still underground lake, little round burrow doors with lamps, everything lit by soft gold and teal glow. Palette: #1c1a24 #ffcf7a #7be0c8 #8a5a3c."
- **Map** `map_rootdeep`: "A cave system seen from above as a painted map: a central glowing root column, a mushroom forest, an underground lake, crystal galleries, a burrow village; dark warm rock between. Palette: #1c1a24 #ffcf7a #7be0c8 #8a5a3c."
- **Sketches** `sketch_rootdeep_1`-`_2`. **Portraits:** `portrait_gran_burrows` (Lumbra is core).
- **Bestiary:** `card_glow_grub`, `card_drip_bat`, `card_pebble_mimic`, `card_boss_lumbra`.
- **Music** `rootdeep` (low cello, drips); **ambience** `rootdeep_burrow`, `rootdeep_cavern`.

<a id="glassway"></a>

### 10.6 The Glassway (`realm: glassway`, S-202)

Swatch `#2f7d8c` `#f5e6c4` `#ffb48a` `#bfeee6`. Glass-clear shallows, sandbars, 9 islets, 3 wrecks, a stilt post
office, the Sunken Bell's spire (18 m above low tide). Water tints are the most important art here: the shallows read
as glass over sand.

| Slot | Key | Subject |
|---|---|---|
| grass | `glassway_dunegrass` | "Tufts of pale marram grass on sand. Palette: #a8c88a #d8e8b0 #f5e6c4 #2f7d8c." |
| forest | `glassway_scrub` | "Low silver-green coastal scrub with orange sea-buckthorn berries. Palette: #8aa88a #b8c8a8 #ffb48a #6a7a6a." |
| meadow | `glassway_seapink` | "Sea-pink and white sea-campion flowers on short turf. Palette: #f6a6c0 #ffffff #8aa88a #f5e6c4." |
| sand | `glassway_shellsand` | "Bright cream sand dotted with tiny pink and white shells. Palette: #f5e6c4 #fff4e0 #ffb48a #e2d2b0." |
| snow | `glassway_wetsand` | "Glistening wet sandbar sand with ripple marks and thin water sheen. Palette: #d8d0b8 #bfeee6 #e8e0c8 #a8c8c0." |
| dirt | `glassway_shingle` | "Smooth white and grey shingle pebbles. Palette: #e8e8e0 #b8b8b0 #d8d0c0 #8a9a98." |
| rock | `glassway_barnacle` | "Rounded sea rock with barnacles, limpets and green weed. Palette: #8a9a98 #a8b0a8 #6a8a6a #f5e6c4." |
| cliff | `archwater_columns` (shared, carried in this bundle as a copy) | - |

| Key | What | Size | Subject |
|---|---|---|---|
| `glassway_card_ground` | 4 cells (`marram`, `campion`, `starfish`, `seaweed`) | 1024×512 | `sheet-items` N = 4: "a tuft of marram grass, a white sea-campion, an orange starfish, a ribbon of green seaweed. Palette: #a8c88a #ffffff #ffb48a #6a9a6a." |
| `glassway_card_bottle_glint` | a washed-up bottle's glint (visual twin of its bob sound) | 128² 4-frame strip | "a small four-point sparkle, four frames" |
| `glassway_card_buoy_light` | buoy lamp glow | 128² alpha | "a soft round warm glow" |
| `glassway_card_bow_wave` | the *Dandelion*'s bow wave and wake | 512×256 6-frame strip | "a soft white curl of bow wave and foam, six frames" |
| `glassway_card_whale_spout` | the Snoozing Whale's sleepy spout | 256×512 4-frame | "a gentle soft fountain of water spray, four frames" |

- **Water** (`palette.water`): deep `#2f7d8c`, shallow `#bfeee6`; S-202 adds a `clarity` value 0.85 (shallow floor
  visible to 3 m depth) to the water uniform set.
- **Loading** `load_glassway`: "A sea of glass-clear turquoise shallows over pale sand, sandbars and tiny islets with a few palms, three old shipwrecks resting in the shallows, a little post office on stilts with a red roof, and a stone bell spire rising from the water. Palette: #2f7d8c #f5e6c4 #ffb48a #bfeee6."
- **Map** `map_glassway`: "A wide shallow sea seen from above with nine little islets, sandbars, three wrecks, a stilt post office, a bell spire, and channels marked by buoys leading east-north-east and south-south-west. Palette: #2f7d8c #f5e6c4 #ffb48a #bfeee6."
- **Sketches** `sketch_glassway_1`-`_3`. **Portraits:** `portrait_pell`, `portrait_whelk`, `portrait_bosun_snore` (Pelagia core).
- **Bestiary:** `card_bubble_puffer`, `card_gullgrab`, `card_boss_pelagia`, `card_boss_bosun_snore`.
- **Music** `glassway` (glockenspiel), `sailing` while the boat is moving; **ambience** `glassway_sea`, `glassway_post`.

<a id="kettle"></a>

### 10.7 Kettle Isle (`realm: kettle`, S-224)

Swatch `#3b3540` `#f4d1a6` `#e66f4f` `#8fc7a0`. A teakettle-shaped volcano (45 m), hot springs, warm black sand, the
forge town of Forgefall, the bathhouse terraces. Warm and steamy, never threatening: no lava glow, only ember-warm
light and steam.

| Slot | Key | Subject |
|---|---|---|
| grass | `kettle_fernturf` | "Short bright fern turf on warm volcanic soil. Palette: #7aa86a #9cc88a #8fc7a0 #3b3540." |
| forest | `kettle_ashwood` | "Woodland floor of grey ash, fern fronds and small twigs. Palette: #8a8a88 #6a8a5a #c9b89a #3b3540." |
| meadow | `kettle_heath` | "Low heath with tiny yellow and orange flowers on dark soil. Palette: #e7c45a #e66f4f #6a8a5a #3b3540." |
| sand | `kettle_blacksand` | "Smooth warm black sand with a few glossy pebbles. Palette: #3b3540 #4a4450 #f4d1a6 #2a2430." |
| snow | `kettle_ash` | "Soft pale grey ash drifts with tiny glints. Palette: #c8c4c0 #e0dcd8 #a8a4a0 #f4d1a6." |
| dirt | `kettle_cinder` | "A path of rounded red cinder gravel. Palette: #b5674c #8a4a3a #e66f4f #3b3540." |
| rock | `kettle_tuff` | "Rounded purple-brown volcanic tuff with small holes. Palette: #6a5060 #5a4450 #8a6a70 #3b3540." |
| cliff | `kettle_cliff` | "A terraced warm volcanic cliff with soft orange and purple bands and fern ledges. Palette: #6a5060 #b5674c #8fc7a0 #3b3540." |

| Key | What | Size | Subject |
|---|---|---|---|
| `kettle_card_ground` | 4 cells (`fern`, `heathflower`, `sulphurpuff`, `kettleweed`) | 1024×512 | `sheet-items` N = 4: "a curled bright fern, an orange heath flower clump, a little yellow mineral crust, a round teal spring weed. Palette: #9cc88a #e66f4f #e7c45a #8fc7a0." |
| `kettle_card_steam` | steam column (spout, vents, baths) | 512×1024 6-frame strip | "a soft column of white steam rising and curling, six frames" |
| `kettle_card_sparks` | forge sparks | 256² 4-frame strip | "a small burst of warm orange sparks, four frames" |
| `kettle_card_bathbubbles` | bath bubbles | 128² alpha | "a few round soft bubbles" |
| `kettle_card_ember` | Ember Sling projectile glow | 128² alpha | "a small round glowing ember seed with a soft orange glow" |

- **Loading** `load_kettle`: "A round volcanic island shaped like a teakettle with a spout-shaped peak puffing soft steam, terraced hot-spring baths with towels drying, a little forge town with glowing windows, warm black sand. Palette: #3b3540 #f4d1a6 #e66f4f #8fc7a0."
- **Map** `map_kettle`: "A round volcanic cone island with a spout peak, terraced baths on one flank, a forge town, black sand beaches and lava-tube cave mouths. Palette: #3b3540 #f4d1a6 #e66f4f #8fc7a0."
- **Sketches** `sketch_kettle_1`-`_3`. **Portraits:** `portrait_scoria`, `portrait_pitch`, `portrait_soakley`, `portrait_fumarole`.
- **Bestiary:** `card_soot_snuffle`, `card_steam_puff`, `card_ash_moth`, `card_boss_fumarole`.
- **Music** `kettle` (brass and steam); **ambience** `kettle_forge`, `kettle_baths`, `kettle_coast`.

<a id="saltglass"></a>

### 10.8 Saltglass Flats (`realm: saltglass`, S-245)

Swatch `#c9a46b` `#efe3c8` `#b55d4c` `#8ec9d8`. Pale salt desert, singing glass dunes, salt pans, the half-buried
Lamplighter Academy (bell tower 26 m). Still and old, bright and kind: the oldest Lamplighter place, so the kit's
moonstone appears here weathered warm.

| Slot | Key | Subject |
|---|---|---|
| grass | `saltglass_saltbush` | "Sparse silver-green saltbush clumps on pale sand. Palette: #a8b89a #c8d0b8 #efe3c8 #c9a46b." |
| forest | `saltglass_oasis` | "Oasis ground of date-palm litter, green grass and damp sand. Palette: #7aa86a #c9a46b #8a6a3c #8ec9d8." |
| meadow | `saltglass_bloom` | "Pale sand with scattered tiny desert flowers in rust-red and white. Palette: #efe3c8 #b55d4c #ffffff #c9a46b." |
| sand | `saltglass_dune` | "Smooth wind-rippled pale gold dune sand with a few glassy glints. Palette: #e8d4a8 #c9a46b #f6ecd2 #8ec9d8." |
| snow | `saltglass_salt` | "A bright white salt-pan crust cracked into soft hexagons. Palette: #fbf7f0 #e8e2d8 #c8c0b0 #8ec9d8." |
| dirt | `saltglass_hardpan` | "Cracked warm clay hardpan. Palette: #c99a6b #b5845a #e2c49a #b55d4c." |
| rock | `saltglass_sandstone` | "Rounded layered honey and rust sandstone. Palette: #d9b080 #b5745a #e8c89a #b55d4c." |
| cliff | `saltglass_cliff` | "A soft wind-carved sandstone cliff with rounded bands of honey, rust and cream. Palette: #d9b080 #b55d4c #efe3c8 #c9a46b." |

| Key | What | Size | Subject |
|---|---|---|---|
| `saltglass_card_ground` | 4 cells (`saltbush`, `desertflower`, `glassshard`, `datepalmsprout`) | 1024×512 | `sheet-items` N = 4: "a silver saltbush, a small rust-red desert flower, a smooth rounded piece of sea-green glass standing in sand, a date-palm sprout. Palette: #a8b89a #b55d4c #8ec9d8 #7aa86a." |
| `saltglass_card_shimmer` | heat shimmer over the salt pans | 1024×256 alpha | "a soft horizontal band of wavy transparent heat shimmer" |
| `saltglass_card_sandflow` | sand-flow tile streaks (dungeon 9, also dunes) | 512² 6-frame strip | "soft streams of sand sliding, six frames" |
| `saltglass_card_glassglint` | dune glass glints (visual twin of the singing dunes) | 128² 4-frame | "a small rainbow glint sparkle, four frames" |
| `decal_nameplate` | Academy nameplate doors (dungeon 9, Roll Call) | 512×128 alpha | `decal`: "a small oval brass nameplate with a blank centre and a spiral at each end" |

- **Loading** `load_saltglass`: "A bright still desert of pale dunes and white salt pans under a wide sky, smooth glass sculptures glinting in the sand, an archaeology camp of striped tents, and an old stone bell tower rising out of the sand, the rest of its building buried. Palette: #c9a46b #efe3c8 #b55d4c #8ec9d8."
- **Map** `map_saltglass`: "A long flat desert island of dunes and salt pans, a tent camp, a hill with a half-buried school and its bell tower, an oasis. Palette: #c9a46b #efe3c8 #b55d4c #8ec9d8."
- **Sketches** `sketch_saltglass_1`-`_3`. **Portraits:** `portrait_sable`, `portrait_scarabelle`.
- **Bestiary:** `card_sandsnoot`, `card_prickle_pear`, `card_sun_beetle`, `card_dust_puff`, `card_boss_scarabelle`.
- **Music** `saltglass` (still, old), `exam` for the exam; **ambience** `saltglass_camp`, `saltglass_dunes`.

<a id="driftholm"></a>

### 10.9 Driftholm (`realm: driftholm`, S-265)

Swatch `#9bb87a` `#f7f2ff` `#c9b6ec` `#8fb4f0`. The painted sky isle made walkable: a lilac meadow, broken spiral
arches, waterfalls into cloud, Mote's patched shelter and a hundred little scrap lamps, the Tally Wall, the Spiral
Arch (24 m).

| Slot | Key | Subject |
|---|---|---|
| grass | `driftholm_lilacgrass` | "Soft meadow grass with a lilac tint and tiny white clover. Palette: #9bb87a #b8c8a0 #c9b6ec #f7f2ff." |
| forest | `driftholm_cloudmoss` | "Puffy cushions of pale cloud-like moss. Palette: #e8e4f4 #c9b6ec #9bb87a #f7f2ff." |
| meadow | `driftholm_starflower` | "Turf full of small five-pointed pale yellow star flowers. Palette: #ffe9a8 #9bb87a #f7f2ff #c9b6ec." |
| sand | `driftholm_dust` | "Fine pale lilac dust with tiny sparkles. Palette: #e8e0f0 #d0c4e4 #f7f2ff #c9b6ec." |
| snow | `driftholm_wisp` | "Wisps of cloud lying on the ground, soft white over lilac. Palette: #ffffff #f7f2ff #d8d0ec #c9b6ec." |
| dirt | `driftholm_ochrepath` | "A soft pale ochre footpath worn in meadow. Palette: #d8c49a #c9b08a #9bb87a #f7f2ff." |
| rock | `driftholm_skystone` | "Rounded lavender-grey sky stone with pale veins. Palette: #a8a0c0 #c0b8d8 #8f88a8 #f7f2ff." |
| cliff | `driftholm_skystone` | - |

| Key | What | Size | Subject |
|---|---|---|---|
| `driftholm_card_ground` | 4 cells (`starflower`, `cloudtuft`, `lilacgrass`, `scraplamp_glow`) | 1024×512 | `sheet-items` N = 4: "a small pale star flower, a tuft of cloud moss, a lilac grass tuft, a tiny warm lamp glow. Palette: #ffe9a8 #f7f2ff #c9b6ec #ffd98a." |
| `driftholm_cloudfloor` | the cloud floor seen below the isle (huge horizontal card, tiled) | 1024² webp, seamless, ≤ 120 KB | `tile`: "the top of a soft sea of clouds seen from above, white and lilac. Palette: #ffffff #f7f2ff #d8d0ec #c9b6ec." |
| `driftholm_archipelago` | the painted archipelago far below (seen through cloud gaps) | 1024² webp ≤ 120 KB | `map`-like: "the whole archipelago seen from very high above through thin cloud, tiny islands in a blue sea, the great tree island in the centre." |
| `driftholm_card_falls` | waterfall into cloud | 256×1024 6-frame strip | "a slender soft waterfall dissolving into mist at the bottom, six frames" |
| `decal_tally` | the Tally Wall marks (S-263) | 1024×512 alpha, 8 cells | `sheet-items` N = 8: "chalk tally marks in groups of five drawn by a small hand: 1, 2, 5, 10, 25, 50 groups, a little doodle of a cloud with a face, a doodle of a tree with a face." |

- **Loading** `load_driftholm`: "A small floating island high above a sea of clouds: a lilac meadow, a patched little shelter made of sailcloth and driftwood, a hundred tiny mismatched lamps hung everywhere, waterfalls spilling off the edge into cloud, and a tall broken stone arch with a spiral on its keystone. Palette: #9bb87a #f7f2ff #c9b6ec #8fb4f0."
- **Map** `map_driftholm`: "A floating island and five small islets above clouds, a meadow with a shelter, waterfalls at the edges, a tall arch on a rise. Palette: #9bb87a #f7f2ff #c9b6ec #8fb4f0."
- **Sketches** `sketch_driftholm_1`-`_2`. **Portraits:** `portrait_nimble`.
- **Bestiary:** `card_nimbus_puff`, `card_gust_kite`.
- **Music** `driftholm` (airy harp), `chase` in the Spiral Stair; **ambience** `driftholm_meadow`, `driftholm_edge`.

<a id="starmeadow"></a>

### 10.10 The Starmeadow (`realm: starmeadow`, S-275)

Swatch `#141a3a` `#ffe9a8` `#8fa8ff` `#2a3470`. Cloud islands joined by constellation bridges, deep blue and gold,
the Ladder of Lights (80 m into view). Always night; never scary: the deep blue is full of warm gold light.

| Slot | Key | Subject |
|---|---|---|
| grass | `starmeadow_cloudturf` | "The soft top of a cloud like turf, pale blue-white with gold specks. Palette: #c8d4ff #e8ecff #ffe9a8 #8fa8ff." |
| forest | `starmeadow_nebula` | "Swirling soft violet and blue cloud ground. Palette: #6a6ab8 #8fa8ff #2a3470 #c9b6ec." |
| meadow | `starmeadow_stardust` | "Deep blue ground strewn with tiny gold star specks. Palette: #2a3470 #3a4490 #ffe9a8 #f2b45a." |
| sand | `starmeadow_silver` | "Fine silver dust with soft glints. Palette: #c0c8e0 #e0e4f0 #8fa8ff #ffffff." |
| snow | `starmeadow_frostlight` | "Pale frosty light lying on cloud, white-blue. Palette: #ffffff #dce4ff #8fa8ff #ffe9a8." |
| dirt | `starmeadow_goldpath` | "A path of soft glowing gold dust. Palette: #f2b45a #ffe9a8 #c9a24a #2a3470." |
| rock | `starmeadow_moonstone` | "Rounded pale moonstone with a faint blue glow. Palette: #d8dcf0 #b0b8d8 #8fa8ff #141a3a." |
| cliff | `starmeadow_moonstone` | - |

| Key | What | Size | Subject |
|---|---|---|---|
| `starmeadow_card_ground` | 4 cells (`starbloom`, `goldtuft`, `cloudpuff`, `twinkle`) | 1024×512 | `sheet-items` N = 4: "a five-pointed glowing star flower, a tuft of gold grass, a small cloud puff, a tiny twinkle. Palette: #ffe9a8 #f2b45a #e8ecff #8fa8ff." |
| `starmeadow_card_bridge` | constellation bridge dots and lines | 512×128 alpha | "a line of soft glowing dots joined by faint thin light lines" |
| `starmeadow_card_ladderrung` | a Ladder rung light | 256² 8-frame strip | "a soft pair of glowing light dots pulsing, eight frames. Palette: #f7f2ff #ffe9a8" |
| `starmeadow_sky_stars` | dense star dome (replaces `stars` here) | 1024² webp alpha ≤ 40 KB | `tile`: "dense soft painted stars of many sizes on transparent" (seamless) |
| `starmeadow_card_starkin_glow` | Starkin aura | 256² alpha | "a soft round warm white glow" |

- **Loading** `load_starmeadow`: "Soft floating cloud islands in a deep blue night joined by bridges of linked star-lights, small round friendly star folk glowing gold, warm lanterns everywhere, and a long ladder of lights hanging down out of the sky toward a giant tree far below. Palette: #141a3a #ffe9a8 #8fa8ff #2a3470."
- **Map** `map_starmeadow`: "Twelve cloud islands in a dark blue sky joined by dotted star-line bridges, a big resting star on one, the foot of a ladder of lights on another. Palette: #141a3a #ffe9a8 #8fa8ff #2a3470."
- **Sketches** `sketch_starmeadow_1`-`_2`. **Portraits:** `portrait_brightwell`, `portrait_twinkling`.
- **Bestiary:** `card_stardust_sprite`, `card_comet_pup`, `card_moonbeam_turret`, `card_wisp_lantern`.
- **Music** `starmeadow` (music box, choir hum), `ladder` in dungeon 11; **ambience** `starmeadow_isles`.

<a id="crown"></a>

### 10.11 The Crown (`realm: crown`, S-283)

Wenna's canopy as walkable boughs at dusk: bark, blossom, leaves and the four bough lanterns.

| Key | What | Size | Subject | Fallback |
|---|---|---|---|---|
| `wall_crownbark_hd` (+ `lo`) | bough walking surface and trunk | 1024 / 512 | `tile`: "Warm smooth tree bark with soft ridges and a little moss, seen flat. Palette: #8a5a3c #a87048 #6f5a44 #9cb84a." | `F-home:dirt_hd` |
| `wall_crownleaf_hd` (+ `lo`) | leaf mats between boughs | 1024 / 512 | `tile`: "A dense mat of overlapping round leaves, fresh green and gold-lit. Palette: #9cb84a #7a9a3c #c8e07a #ffe9a8." | `F-home:grass_hd` |
| `crown_card_blossom_drift` | drifting blossom petals | 256² 6-frame | "a few soft pink petals drifting, six frames" | `F-none` |
| `crown_card_ring` | glide rings for the last-spark catch (finale) | 512² alpha | "a soft ring of blossoms and light" | `F-canvas` torus of dots |
| `load_crown` | loading card | 1600×900 | "Inside the crown of a giant gentle tree at dusk, wide boughs like paths, lanterns hanging, pink blossom drifting, a ladder of lights coming down through the leaves from the night sky. Palette: #6f5a44 #ffe9a8 #f6c6d8 #9cb84a." | `F-home:loading_bg` |

Music: `sneeze` (phases 1-2), `given_light` (phase 3), `ending` (KEEP) on the card.

<a id="variants"></a>

### 10.12 Variant realms

Variants add cards and a loading card; their ground is the parent's, graded ([§5.4](#palettes)).

| Realm | Key | What | Subject |
|---|---|---|---|
| `remembered` | `load_remembered` | loading card | "The same small island with its great tree a hundred years ago, painted in warm sepia and gold like an old storybook: wooden scaffolds and little stone lamp towers on every hill, moth-folk carrying lamps, a stone stair rising from the mountain toward a floating island. Palette: #e9d8b0 #b8894a #6f5a44 #ffd98a." |
| `remembered` | `remembered_card_scaffold` | scaffold and lamp-string card | "a wooden scaffold with a string of lamps, sepia tones" |
| `remembered` | `remembered_card_dust` | warm memory motes | "a few soft gold motes of light" |
| `moonmere` | `load_moonmere` | loading card | "The same island as a silver dream seen by moonlight: a great tree of silver hung with small mismatched lamps, a still mirror-smooth sea with a path of moonlight across it, a garden of mirrors. Palette: #cfd8ee #2a3358 #f6f3d8 #c9b6ec." |
| `moonmere` | `moonmere_card_moonpath` | the moonpath on the sea | "a long soft path of silver moonlight across still water, narrowing to the horizon" |
| `moonmere` | `moonmere_card_mirror` | Mirror Garden glint | "a soft silver glint on an oval mirror" |
| `moonmere` | `card_hushling` | bestiary card | `card-beast` of `./creatures.md#enemy-hushling` |
| `night` | `load_night` | loading card | "The island at night with lanterns everywhere, soft falling lights like warm rain from a ladder of light in the sky, friends of every shape gathered round the great tree, one new star above it. Palette: #1c2a63 #ffe9a8 #f2b45a #c9b6ec." |
| `night` | `night_card_fallinglight` | falling-light rain | 128×512 4-frame strip: "a soft falling streak of warm light, four frames" |
| `night` | `night_card_festival_lantern` | festival lantern strings | "a string of round paper lanterns in many soft colours glowing" |
| `margins` | `margins_paper_hd` (+ `lo`) | paper ground | `tile`: "cream sketchbook paper with faint pencil grain. Palette: #f4ecd8 #e8dcc0 #c8b89a." |
| `margins` | `margins_hatch_hd` (+ `lo`) | hatched ground (rock/forest slots) | `tile`: "soft pencil cross-hatching on cream paper" |
| `margins` | `margins_card_inktree` | ink-line tree card | "a pine tree drawn in loose ink lines with a light wash" |
| `margins` | `load_margins` | loading card | "A sketchbook page come to life: a hilly island of pines drawn in pencil and ink on cream paper, a giant pine sketched on the highest hill, a dotted line for a bridge, an owl's handwriting-free doodles in the margins. Palette: #f4ecd8 #5a3e2b #8fae9a #c98b4b." |
| `dream_*` | `card_fx_dreambubble` | floating dream bubbles | "a soft pastel iridescent bubble" |
| `dream_*` | `load_dreams` | loading card (one for all ten) | "A guardian's arena seen as a pastel dream: soft pink and lilac light, floating bubbles, a sleepy friendly giant mushroom, crab and snow bunny napping at the edges. Palette: #f3d8f0 #c9b6ec #ffe9a8 #9fdcff." |

<a id="dungeon-textures"></a>

### 10.13 Dungeon textures

Each dungeon swaps the kit's wall textures, never its programs. Two sets per dungeon at 512 + 256 webp (dungeon
spaces are small; walls are seen within 20 m), ≤ 60 KB + 20 KB each, tagged with the dungeon's land bundle.

| Dungeon | Keys | Subjects (`tile`) |
|---|---|---|
| d2 Whistlehollow | `wall_pinebark`, `wall_knothole` | "Thick rounded pine bark, warm rust-brown" · "Smooth pale heartwood with round knot-holes glowing faint green" |
| d3 Undertow Grotto | `wall_wetbasalt`, `wall_kelpstone` | "Wet dark hexagonal basalt with teal reflections" · "Sea-cave stone with draped kelp and barnacles" |
| d4 Granary Vaults | `wall_granaryplank`, `wall_hay` | "Warm honey wooden planks of a barn with iron nails" · "Packed golden hay bale surface" |
| d5 Lamplighters' Tower | `wall_towerstone`, `wall_brasspanel` | "Pale moonstone tower blocks with spiral inlay" · "Riveted brass panels with moth-wing etching" |
| d6 Rootdeep Heart | `wall_glowroot` (shared), `wall_geode` | (shared) · "Inside of a giant geode, lilac crystals" |
| d7 Sunken Bell | `wall_bellstone`, `wall_coralstone` | "Sea-chapel stone with barnacles and a faint spiral frieze" · "Pink and cream coral-crusted stone" |
| d8 Kettle's Belly | `wall_forgebrick`, `wall_pipe` | "Sooty warm fire-brick" · "Copper pipes and valves on a dark wall" |
| d9 Buried Academy | `wall_academytile`, `wall_sandstone` | "Pale blue-and-cream glazed school tiles with a spiral border" · "Layered honey sandstone with sand drifts" |
| d10 Spiral Stair | `wall_cloudstone`, `wall_skyglass` | "Lavender sky stone with spiral carvings" · "Pale translucent lilac glass" |
| d11 Ladder of Lights | `wall_starglass`, (each floor reuses its isle's pair) | "Deep blue glass full of tiny gold stars" |
| o1 Snowglobe | `wall_ice`, `wall_snowbrick` | "Clear blue ice with trapped bubbles" · "Rounded snow bricks" |
| o2 Grumble's Undercap | `wall_mushroomflesh`, `wall_gill` | "Soft cream mushroom flesh" · "Pink-lilac mushroom gills in soft rows" |
| o3 Merry Mabel | `planks_hd` (shipped) + `wall_shiphull` | "Old ship hull boards, tilted, barnacles" |
| o4 Hundred Lamps | reuses all of the above per floor | - |
| Hollows | `wall_stone` / `wall_moss` (kit) + the land's rock layer | - |

<a id="fish"></a>

### 10.14 Fish (S-207)

24 species (names, lands, times and rarities in `./side-content.md#act-fishing`). Art: one `icons_fish` atlas,
6 × 4 cells of 128², 768×512 webp ≤ 120 KB, core. Generated as **two** sheets of 12 (a 4 × 3 grid each, 2048×1536)
in the species order of `./side-content.md#act-fishing`. Subject: "a grid sheet of 12 separate small round cute
cartoon fish icons, side view facing left, each a different species: <the 12 'Look' lines in order>. Palette per
fish as listed." Process: white-key → `slice_sheet.py` (12 parts, check `_contact.png` order) → `export_sprites.py`
at 120 px → `pack_atlas.py --append` with cell names = fish ids. Nell's fish tank in her cottage shows the caught
species as the same icons on small cards swimming (one instanced draw). Fallback `F-canvas`: a round fish shape
in the species' first hex.

---

<a id="key-art"></a>

## 11. Key art, act cards and loading cards

### 11.1 Key art (S-307)

Pip's look is unchanged (the LOCKED GLB: leaf-green fox-eared hood with a two-leaf sprout); only the sword changes
from wood to the shipped steel one. `title_fp_v2.jpg` stays as the fallback; `title.jpg` and `title_fp.jpg` are
removed with the manifest keys `title` and `title_fp` (nothing reads them once `title_fp_v3` exists; S-307 greps to
prove it). The PR shows old and new side by side.

| Key | Size | Prompt subject (preamble + `loading` suffix, minus the text-room clause) | Fallback |
|---|---|---|---|
| `title_fp_v3` (`eager: true`) | 1920×1080 jpg q86 ≤ 320 KB | "First-person view from a small child's eye height in a sunny storybook village: a wide dirt path leads to a giant gentle old tree with a sleeping face and a spiral on its brow, little lanterns hanging in its crown, a stone pedestal with three star-shaped sockets before it, round cottages with mushroom and blue roofs, a well, fences and flowers, forested hills and a snowy peak with a crystal at its top on the right, a lighthouse on a sea stack, three small glowing stars (green leaf-star, pale blue snowflake-star, coral shell-star) streaking across the upper right sky. In the lower right corner the child's own hand in a leaf-green sleeve and brown leather cuff holds up a short simple steel sword with a rounded brown grip. Palette: #5aaef2 #8aa83c #8a5a3c #ffd98a." | `title_fp_v2` |
| `ending_art_v2` | 1920×1080 jpg q86 ≤ 300 KB | "A small child in a leaf-green hood with little fox ears and a two-leaf sprout on top, seen from behind, a short steel sword on his back, standing on a cobbled plaza looking up at a giant tree in full pink-and-cream blossom glowing softly, three star-seeds shining in a stone pedestal, villagers (a turtle elder, a frog mayor, a cat shopkeeper, a bunny, an owl, a mole) cheering at the edges, and at the edge of the plaza three big friendly guardians: a bearded mushroom, a crab in a captain's hat, a huge fluffy snow rabbit. Petals drifting. Palette: #f6c6d8 #ffe9a8 #8aa83c #5aaef2." | `ending_art` |

<a id="act-cards"></a>

### 11.2 Act cards

Shown behind the act card text (`./story.md` owns the card text). 1600×900 webp q80 ≤ 200 KB, core.
The Act One card keeps the shipped `ending_art` (then `ending_art_v2`).

| Key | Act | Prompt subject (`loading` kind) | Step |
|---|---|---|---|
| `actcard_2` | End of Act Two · The Dimming | "Night over a calm sea seen from a small island's shore: on the horizon little islands with lit windows, and in the north-east sky a thin ladder of small lights climbing toward a faint floating island; one tree leaf drifting down in the foreground. Palette: #1c2a63 #3d4c8f #f7f2ff #ffd98a." | S-165 |
| `actcard_3` | End of Act Three · The Remembering | "A floating stone stair of three flights rising from a mountain needle through soft clouds to a floating meadow island with a broken spiral arch; above the clouds the stars are bright and close. Palette: #c9b6ec #f7f2ff #141a3a #ffe9a8." | S-272 |
| `actcard_4` | End of Act Four · The Lantern Sky | "A giant gentle tree at night in full blossom with eight glowing paper lanterns in its crown, a ladder of golden light going up from it into the sky, and one new small star shining just above the tree. Tiny figures holding lanterns stand all along its boughs. Palette: #1c2a63 #ffe9a8 #f6c6d8 #c9b6ec." | S-286 |
| `actcard_true` | To whoever finds this | "A corked glass bottle with a rolled letter inside floating on a calm moonlit sea, a lighthouse beam sweeping behind it, a sky full of soft stars. Palette: #1c2a63 #cfd8ee #ffd98a #f6ecd2." | S-290 |

<a id="loading-cards"></a>

### 11.3 Loading cards

Every realm swap shows a painted loading card (S-021 card UI, `ui.setLoading`), 0.3-4 s, with one rotating tip in the
bottom fifth (cream text, 2 px brown shadow). Key `load_<realm>`, 1600×900 webp q80 ≤ 200 KB, plus `lo` 960×540
≤ 70 KB for phones and quality low. Card art is in each land's section; fallback `F-home:loading_bg`. Dungeons and
Hollows use their land's card; interiors use no card (a 0.3 s fade). The chart sailing card `load_sailing` (S-081)
is core and doubles as the loading card of any sea crossing:

`load_sailing`: "A little sailing boat with a dandelion-yellow sail and a pelican at the tiller crossing a calm
sparkling sea toward a palm island on the horizon, gulls overhead, a small boy in a green hood at the bow. Palette:
#5aaef2 #ffd98a #f6ecd2 #3fa79a."

| Card | Step | Card | Step | Card | Step |
|---|---|---|---|---|---|
| `load_under_roots` | S-062 | `load_rootdeep` | S-177 | `load_crown` | S-283 |
| `load_sailing` | S-081 | `load_glassway` | S-202 | `load_remembered` | S-188 (or S-308) |
| `load_duskwick` | S-085 | `load_kettle` | S-224 | `load_moonmere` | S-218 (or S-308) |
| `load_pinewhistle` | S-098 | `load_saltglass` | S-245 | `load_night` | S-288 (or S-308) |
| `load_archwater` | S-119 | `load_driftholm` | S-265 | `load_margins` | S-300 (or S-308) |
| `load_threemills` | S-140 | `load_starmeadow` | S-275 | `load_dreams` | S-292 (or S-308) |

S-308 sweeps any card still missing and adds the tips table `js/text/en/tips.js` (`{ realm: [tip, ...] }`): four
tips per land, each ≤ 120 characters, `{tokens}` as in `./charter.md#tokens`, voice as `./charter.md#voice`. The
tips are written in S-308 from the land's rules in `./systems.md` (a tip says what a tool opens there, where the
bench is, or a villager's gossip); they never spoil a puzzle solution or a twist.

---

<a id="music"></a>

## 12. Music

All music is procedural note data played by `js/audio.js` (no audio files, no precache cost). The shipped tracks
`title`, `village`, `meadow`, `woods`, `peaks`, `shores`, `boss`, `ending` are kept; `village` gains layers. New
tracks are written below in the exact `TRACKS` grammar so a step pastes them.

<a id="music-format"></a>

### 12.1 The track grammar (shipped) and its extensions

Shipped (`js/audio.js` above `TRACKS`): `bpm`, `bpb` (beats per bar), `sp` (steps per bar; step = 60 / bpm × bpb /
sp s), `swing`, `rev`, `delay { beats, fb, mix }`, `chords` (one per bar, cycling; qualities **only** `''`, `m`,
`7`, `maj7`, `m7`, `dim`, `sus`: any other suffix silently becomes major), `melody` (one string per bar, tokens
`Note[:steps]` or `-[:steps]`, steps must sum to `sp`), `lead` / `leadVol`, `lead2` / `lead2Vol` (doubles the
melody), `bass { pat, voice, vol }` (`r t f o .`), `comp { pat, voice, vol, oct, strum, dur }` (`1-5`, `c`, `.`),
`pad { voice, vol }`, `perc [{ pat, vol }]` (`k s h x t .`), `sparkle`.

Extensions (S-010 adds the first three in `js/audio.js`; S-028 adds the rest with `addTrack`):

| Field | Meaning |
|---|---|
| `counter { voice, vol, melody: [...] }` | a second, independent melody line (same token grammar, its own bars) |
| `arp2 { pat, voice, vol, oct }` | a second accompaniment line with the `comp` grammar |
| `layers { <part>: minLevel }` | parts (`lead`, `lead2`, `sparkle`, `bass`, `comp`, `arp2`, `counter`, `pad`, `perc`) play only while `G.audio.layer() ≥ minLevel`; parts not listed always play. `G.audio.layer(n)` sets the level (0-9) live, at the next bar; a track starts at its `startLayer` (default 9) |
| `transpose` | semitones added to every pitch at compile (melody, counter, bass, comp, arp2, pad) |
| `from: '<track>'` | a variant: copy that track's data, then apply the fields below |
| `voices { lead?, lead2?, bass?, comp?, arp2?, pad?, counter? }` | variant only: swap the voice name of a part, keep its pattern |
| `drop [parts]` | variant only: remove parts |
| `add { pad?, perc?, comp?, arp2? }` | variant only: add parts (full objects) |
| top-level `bpm`, `swing`, `rev`, `delay`, `sparkle`, `leadVol`, `lead2`, `lead2Vol`, `layers`, `startLayer`, `transpose` | variant only: override (`lead2` adds a doubling voice to a track that had none) |

Transposition never takes the bass below MIDI 36 (C2): a bass note under it is raised an octave at compile.

`G.audio.addTrack(name, def)` validates: every bar's steps sum to `sp` (a unit test runs the validator over every
track in this file), every chord quality is in the list, every voice and perc letter exists, `from` names a known
track. `G.audio.addAmbience(name, bed)` validates its event names. A realm registers its tracks in its module's
`onRealm` hook; `W.palette.music` and `W.regions[i].music` pick the track (a region's own `music` wins, as today).

<a id="voices"></a>

### 12.2 New voices and percussion (S-028, `js/audio.js` `V` and `PERC`)

Each is written in the shipped `T()` / `N()` vocabulary (oscillator and noise helpers) and lives next to the
shipped voices. A voice costs nothing until a track uses it.

```js
// V additions
marimba: function (D, t, f, dur, v) {           // Duskwick: warm wooden mallet
  T({ dest: D, t: t, f: f, d: 0.45, v: 0.26 * v, a: 0.002 });
  T({ dest: D, t: t, f: f * 4, d: 0.07, v: 0.06 * v, a: 0.001 });
  T({ dest: D, t: t, f: f * 10, d: 0.02, v: 0.015 * v, a: 0.001 });
},
windflute: function (D, t, f, dur, v) {         // Pinewhistle: breathy wooden flute
  var d = dur + 0.18, h = Math.max(0.1, dur);
  T({ dest: D, t: t, f: f, d: d, h: h, a: 0.09, v: 0.22 * v, vib: [4.6, f * 0.006] });
  N({ dest: D, t: t, d: d, v: 0.05 * v, a: 0.08, type: 'bandpass', f: f * 1.5, q: 6 });
},
fiddle: function (D, t, f, dur, v) {            // Threemills: bowed, light vibrato
  var d = dur + 0.06, h = dur * 0.85;
  T({ dest: D, t: t, f: f, type: 'sawtooth', d: d, h: h, a: 0.035, v: 0.09 * v, lp: 2400, q: 1.2, vib: [5.8, f * 0.005] });
  T({ dest: D, t: t, f: f, type: 'triangle', d: d, h: h, a: 0.03, v: 0.1 * v });
},
accordion: function (D, t, f, dur, v) {         // Threemills, the Night: reedy chord voice
  var d = dur + 0.05, h = dur * 0.95;
  T({ dest: D, t: t, f: f, type: 'square', detune: -6, d: d, h: h, a: 0.03, v: 0.05 * v, lp: 1800 });
  T({ dest: D, t: t, f: f, type: 'square', detune: 6, d: d, h: h, a: 0.03, v: 0.05 * v, lp: 1800 });
},
cello: function (D, t, f, dur, v) {             // the Rootdeep: low bowed warmth
  var d = dur + 0.25, h = Math.max(0.15, dur);
  T({ dest: D, t: t, f: f, type: 'sawtooth', d: d, h: h, a: 0.12, v: 0.12 * v, lp: 900, q: 0.9, vib: [5, f * 0.006] });
  T({ dest: D, t: t, f: f, d: d, h: h, a: 0.1, v: 0.14 * v });
},
musicbox: function (D, t, f, dur, v) {          // the Starmeadow, the Remembered Isle, Moonmere
  T({ dest: D, t: t, f: f, d: 0.9, v: 0.15 * v, a: 0.002 });
  T({ dest: D, t: t, f: f * 3.01, d: 0.25, v: 0.04 * v, a: 0.001 });
  T({ dest: D, t: t + 0.004, f: f * 2, d: 0.4, v: 0.03 * v, a: 0.002 });
},
choir: function (D, t, f, dur, v) {             // pad voice: a soft "ooh"
  var d = dur + 1.0, h = dur;
  T({ dest: D, t: t, f: f, type: 'sawtooth', d: d, h: h, a: 0.7, v: 0.035 * v, lp: 900, q: 4 });
  T({ dest: D, t: t, f: f * 1.002, type: 'triangle', d: d, h: h, a: 0.6, v: 0.05 * v, vib: [4.2, f * 0.004] });
},
brass: function (D, t, f, dur, v) {             // Kettle Isle: soft round horn with a "bwah" opening
  var d = dur + 0.08, h = dur * 0.9;
  T({ dest: D, t: t, f: f, type: 'sawtooth', d: d, h: h, a: 0.04, v: 0.11 * v, lp: 700, lp1: 1900, q: 1.4 });
  T({ dest: D, t: t, f: f * 0.5, d: d, h: h, a: 0.05, v: 0.06 * v });
},

// PERC additions (letters must not collide with k s h x t)
w: function (D, t, v) { T({ dest: D, t: t, f: 1050, f1: 900, d: 0.06, v: 0.22 * v, type: 'triangle', a: 0.001 }); N({ dest: D, t: t, d: 0.02, v: 0.06 * v, type: 'bandpass', f: 2200, q: 3 }); }, // woodblock
a: function (D, t, v) { T({ dest: D, t: t, f: 2489, d: 0.35, v: 0.07 * v, a: 0.001 }); T({ dest: D, t: t, f: 3720, d: 0.2, v: 0.04 * v, a: 0.001 }); N({ dest: D, t: t, d: 0.015, v: 0.08 * v, type: 'highpass', f: 4000 }); }, // anvil tink
p: function (D, t, v) { N({ dest: D, t: t, d: 0.35, v: 0.12 * v, a: 0.05, type: 'highpass', f: 2500 }); },   // steam puff
d: function (D, t, v) { T({ dest: D, t: t, f: 1400, f1: 2600, d: 0.07, v: 0.12 * v, a: 0.002 }); },          // drip
c: function (D, t, v) { N({ dest: D, t: t, d: 0.012, v: 0.18 * v, type: 'bandpass', f: 3500, q: 4 }); T({ dest: D, t: t, f: 1800, d: 0.02, v: 0.05 * v, type: 'triangle', a: 0.001 }); }, // pencil click
e: function (D, t, v) { N({ dest: D, t: t, d: 0.18, v: 0.07 * v, a: 0.03, type: 'bandpass', f: 1400, f1: 900, q: 1.2 }); }, // eraser scrub
```

<a id="tracks"></a>

### 12.3 The track register

Leitmotifs: **Wenna** = a rising 5-1-3 (in F: C-F-A), **Mote** = the same falling (in D minor: A-F-D). They meet in
`given_light`, where her motif rises in the flute while his falls in the glockenspiel a beat later.

| Track | Plays | Key · meter · bpm | Lead / signature (`lead2`) | Registered in | Step |
|---|---|---|---|---|---|
| `village` (DEEPEN) | Sprout Village | C · 4/4 · 112 | pluck; layers +comp, +harp arp, +flute counter | `js/audio.js` | S-010 |
| `wenna` | I.6, pedestal talks, Ask the Tree (soft, ducked) | F · 3/4 · 66 | bell | `js/audio.js` | S-065 |
| `nook` | Pip's Nook, cottages, every interior | G · 4/4 · 80 | harp | `js/audio.js` | S-054 |
| `under_roots` | dungeon 1 | E minor · 4/4 · 70 | bell | `js/audio.js` | S-059 |
| `hollow` | all 24 Hollows | A minor · 4/4 · 90 | harp | `js/audio.js` | S-073 |
| `depths` (+ variants) | dungeons 2-9, o1-o4 | C minor · 4/4 · 88 | bell (per variant) | `js/audio.js` | S-103 |
| `warden` (+ variants) | Warden bouts | `boss` variant · 138 | pluck + glock | `js/audio.js` | S-105 |
| `sailing` | chart sailing card, free sailing | D · 6/8 feel (3/4) · 100 | uke | `js/audio.js` | S-081 |
| `mote` | II.M, Tally Wall, Mote's scenes | D minor · 4/4 · 84 | glock | `js/audio.js` | S-128 |
| `duskwick` | Duskwick | Bb · 4/4 · 96 | pluck / **marimba** | `js/realms/duskwick.js` | S-085 |
| `pinewhistle` | Pinewhistle | E minor · 4/4 · 84 | pluck / **windflute** | realm module | S-098 |
| `archwater` | Archwater | G mixolydian · 4/4 · 100 | pluck / **harp** | realm module | S-119 |
| `threemills` | Threemills | D · 6/8 · 112 | pluck / **fiddle** | realm module | S-140 |
| `tower` | dungeon 5 | `depths` variant | bell + marimba | realm module | S-162 |
| `rootdeep` | the Rootdeep | A minor · 4/4 · 72 | pluck / **cello** | realm module | S-177 |
| `remembered` | the Remembered Isle | `village` variant · 92 | musicbox | realm module | S-188 |
| `glassway` | the Glassway | E · 4/4 · 108 | pluck / **glock** | realm module | S-202 |
| `hush` | Pelagia's bell duel, the Bell Duel activity | A minor · pad only · 60 | none | realm module | S-211 |
| `moonmere` | Moonmere | `mote` variant · 70 | musicbox | realm module | S-218 |
| `kettle` | Kettle Isle | F · 4/4 · 104 | pluck / **brass** | realm module | S-224 |
| `saltglass` | Saltglass Flats | D dorian · 4/4 · 60 | flute / **bell** | realm module | S-245 |
| `exam` | Tutor Scarabelle's exam | A minor · 4/4 · 116 | pluck, tick-tock | realm module | S-252 |
| `driftholm` | Driftholm | D · 3/4 · 78 | harp | realm module | S-265 |
| `chase` | the Spiral Stair chase | D minor · 4/4 · 140 | glock + pluck | realm module | S-271 |
| `starmeadow` | the Starmeadow | Eb · 3/4 · 70 | musicbox, choir pad | realm module | S-275 |
| `ladder` (+ 4 floor variants) | dungeon 11 | Eb · 4/4 · 96 | glock, choir | realm module | S-280 |
| `sneeze` | finale phases 1-2 | F · 4/4 · 120 | bell + flute | realm module | S-284 |
| `given_light` | finale phase 3 | F · 4/4 · 72 | flute; glock counter | realm module | S-286 |
| `night` | the Hundred-Year Night | Eb · 3/4 waltz · 150 | fiddle, accordion | realm module | S-288 |
| `dream` | Guardian Dreams | `boss` variant · 126 | musicbox | realm module | S-292 |
| `margins` | Hoot's Margins | C · 4/4 · 100 | pluck, pencil perc | realm module | S-300 |
| `ending` (KEEP) | main ending card, true ending card | shipped | shipped | `js/audio.js` | - |

**Dim lands.** Every Act II and III land track sets `layers: { lead2: 1 }` and starts at layer 0 while the land is
dim, so its signature voice is missing; the realm module calls `G.audio.layer(1)` within 10 s of the beacon or stone
beat (and on entry when the flag is already set). Driftholm and the Starmeadow are never dim.

<a id="music-home"></a>

### 12.4 Home: the village theme gains a layer per Starseed (S-010)

The shipped `village` track gets three layers keyed to the **count** of Starseeds placed (`./story.md#I.2`), never to
which seed. Level = number of seeds in the pedestal (0-3); after the bloom (`S.ending`), level 3 for good. The ending
theme is unchanged. The added data (merged into the shipped `village` object; nothing shipped is deleted):

```js
// added to TRACKS.village
layers: { comp: 1, arp2: 2, counter: 3, sparkle: 3 },
arp2: { pat: '1 3 2 4 3 2 1 3', voice: 'harp', vol: 0.32, oct: 1 },
counter: {
  voice: 'flute', vol: 0.55,
  melody: [
    'G4:6 E4:2', 'D5:4 B4:4', 'C5:6 A4:2', 'A4:4 C5:4',
    'G4:4 C5:4', 'B4:6 D5:2', 'C5:4 A4:4', 'B4:4 D5:2 G4:2',
    'E5:4 C5:4', 'B4:6 G4:2', 'A4:4 C5:2 F5:2', 'E5:4 G4:4',
    'F4:4 A4:4', 'G4:6 E4:2', 'F4:4 A4:2 D5:2', 'D5:4 B4:2 G4:2'
  ]
},
```

| Seeds placed | What plays |
|---|---|
| 0 | pluck melody, soft bass, the `k . x . t . x .` shaker |
| 1 | + the shipped `stab` off-beat chords |
| 2 | + a harp arpeggio |
| 3 / bloomed | + the flute countermelody and the glockenspiel sparkle |

`G.debug.audio.layer()` returns the level; S-010's in-page check loads the 0-, 1-, 2- and 3-seed fixtures and reads
it (0, 1, 2, 3). The other home region tracks (`woods`, `peaks`, `shores`, `meadow`) are unchanged.

<a id="track-data"></a>

### 12.5 All new track data

Paste each block into `TRACKS` (core tracks) or into the realm module's `G.audio.addTrack(name, def)`.

```js
wenna: {   // Wenna's theme: rising 5-1-3
  bpm: 66, bpb: 3, sp: 6, swing: 0, rev: 0.42, delay: { beats: 1, fb: 0.3, mix: 0.22 },
  chords: 'F C Dm Bb F Am Bb C',
  melody: ['C5:2 F5:2 A5:2', 'G5:4 E5:2', 'F5:2 A5:2 D6:2', 'C6:3 Bb5:1 F5:2',
           'A5:2 C6:2 F6:2', 'E6:4 C6:2', 'D6:2 C6:2 Bb5:2', 'G5:2 E5:2 C5:2'],
  lead: 'bell', leadVol: 0.85,
  bass: { pat: 'r . . . . .', voice: 'bassSoft', vol: 0.6 },
  comp: { pat: '1 2 3 4 3 2', voice: 'harp', vol: 0.35, oct: 1 },
  pad: { voice: 'pad', vol: 0.6 }, sparkle: true
},
mote: {    // Mote's theme: the same motif falling
  bpm: 84, bpb: 4, sp: 8, swing: 0, rev: 0.4, delay: { beats: 0.75, fb: 0.4, mix: 0.3 },
  chords: 'Dm Am Bb F Gm Dm Bb A',
  melody: ['A5:2 F5:2 D5:4', 'E5:2 C5:2 A4:4', 'F5:2 D5:2 Bb4:2 D5:2', 'C6:4 A5:4',
           'Bb5:2 G5:2 D5:4', 'A5:2 F5:2 D5:2 F5:2', 'D6:3 C6:1 Bb5:4', 'C#6:4 E5:2 -:2'],
  lead: 'glock', leadVol: 1,
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.7 },
  comp: { pat: '1 . 3 . 2 . 3 .', voice: 'pluck', vol: 0.3, oct: 0 },
  pad: { voice: 'pad', vol: 0.7 }, sparkle: false
},
nook: {
  bpm: 80, bpb: 4, sp: 8, swing: 0.1, rev: 0.3,
  chords: 'G Em C D G Bm C D',
  melody: ['D5:2 G5:2 B5:4', 'G5:2 E5:2 B4:4', 'C5:2 E5:2 G5:2 E5:2', 'F#5:4 A5:2 D5:2',
           'B5:2 D6:2 G6:4', 'F#6:2 D6:2 B5:4', 'E6:2 C6:2 G5:2 E5:2', 'D5:4 F#5:2 A5:2'],
  lead: 'harp', leadVol: 1,
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.7 },
  comp: { pat: '. 3 . 2 . 3 . 4', voice: 'glock', vol: 0.25, oct: 1 },
  pad: { voice: 'pad', vol: 0.45 }, sparkle: true
},
under_roots: {
  bpm: 70, bpb: 4, sp: 8, swing: 0, rev: 0.5, delay: { beats: 1.5, fb: 0.4, mix: 0.3 },
  chords: 'Em C Am B Em G Am B',
  melody: ['E5:3 G5:1 B5:4', 'C6:2 B5:2 G5:4', 'A5:3 C6:1 E6:4', 'D#6:4 B5:2 -:2',
           'G5:2 B5:2 E6:4', 'D6:3 B5:1 G5:4', 'C6:2 A5:2 E5:4', 'F#5:4 D#5:2 -:2'],
  lead: 'bell', leadVol: 0.8,
  bass: { pat: 'r . . . . . . .', voice: 'bassSoft', vol: 0.75 },
  comp: { pat: '1 . . 3 . . 2 .', voice: 'harp', vol: 0.3, oct: 1 },
  pad: { voice: 'pad', vol: 0.8 },
  perc: [{ pat: 'd . . . . . d .', vol: 0.3 }], sparkle: false
},
hollow: {
  bpm: 90, bpb: 4, sp: 8, swing: 0, rev: 0.45, delay: { beats: 0.75, fb: 0.35, mix: 0.25 },
  chords: 'Am F G Em Am F G E',
  melody: ['E5:2 A5:2 C6:4', 'C6:2 A5:2 F5:4', 'D5:2 G5:2 B5:4', 'B5:2 G5:2 E5:4',
           'A5:2 C6:2 E6:4', 'F6:2 C6:2 A5:4', 'G5:2 B5:2 D6:4', 'G#5:4 B5:2 -:2'],
  lead: 'harp', leadVol: 1,
  bass: { pat: 'r . . . r . . .', voice: 'bassSoft', vol: 0.6 },
  comp: { pat: '1 . . . 3 . . .', voice: 'glock', vol: 0.3, oct: 1 },
  pad: { voice: 'pad', vol: 0.45 }, sparkle: false
},
depths: {  // the shared dungeon track; every story dungeon is a variant
  bpm: 88, bpb: 4, sp: 8, swing: 0, rev: 0.45, delay: { beats: 0.75, fb: 0.35, mix: 0.25 },
  chords: 'Cm Ab Eb Bb Cm Fm G G7',
  melody: ['G5:3 Eb5:1 C5:4', 'C6:3 Ab5:1 Eb5:4', 'Bb5:2 G5:2 Eb6:4', 'D6:4 F5:2 -:2',
           'Eb6:2 D6:2 C6:4', 'F5:2 Ab5:2 C6:4', 'B5:2 D6:2 G6:4', 'F6:2 D6:2 B5:2 -:2'],
  lead: 'bell', leadVol: 0.85,
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.75 },
  comp: { pat: '1 . 3 . 2 . 3 .', voice: 'harp', vol: 0.3, oct: 1 },
  pad: { voice: 'pad', vol: 0.6 },
  perc: [{ pat: 'k . . . . . x .', vol: 0.3 }], sparkle: false
},
whistlehollow:  { from: 'depths', transpose: 2,  voices: { lead: 'windflute' } },
undertow:       { from: 'depths', transpose: -3, voices: { lead: 'pluck' }, delay: { beats: 0.75, fb: 0.5, mix: 0.45 } },
granary:        { from: 'depths', transpose: 0,  voices: { lead: 'fiddle' }, bpm: 100 },
tower:          { from: 'depths', transpose: 2,  add: { pad: { voice: 'choir', vol: 0.5 } }, lead2: 'marimba', lead2Vol: 0.5 },
rootdeep_heart: { from: 'depths', transpose: -12, voices: { lead: 'cello' } },
kettles_belly:  { from: 'depths', transpose: 5,  voices: { lead: 'brass' }, add: { perc: [{ pat: 'k . . . p . a .', vol: 0.35 }] } },
buried_academy: { from: 'depths', transpose: -2, voices: { lead: 'flute' }, add: { perc: [{ pat: 't . t . t . t .', vol: 0.3 }] } },
snowglobe:      { from: 'depths', transpose: 2,  voices: { lead: 'glock' } },
undercap:       { from: 'depths', transpose: -5, voices: { lead: 'bell' } },
merry_mabel:    { from: 'depths', transpose: 0,  voices: { lead: 'uke', comp: 'strum' }, swing: 0.25 },
hundred_lamps:  { from: 'depths', transpose: 0,  add: { pad: { voice: 'choir', vol: 0.55 } } },

warden:         { from: 'boss', bpm: 138, voices: { lead: 'pluck', bass: 'bassSoft' }, lead2: 'glock', lead2Vol: 0.4 },
warden_rollo:   { from: 'warden', voices: { lead: 'bell' } },
warden_mossmantle: { from: 'warden', voices: { lead: 'windflute' } },
warden_gloop:   { from: 'warden', voices: { lead: 'pluck' }, swing: 0.15 },
warden_honksworth: { from: 'warden', voices: { lead: 'fiddle' } },
warden_wickwork: { from: 'warden', voices: { lead: 'marimba' } },
warden_lumbra:  { from: 'warden', voices: { lead: 'cello' }, transpose: -12 },
warden_fumarole: { from: 'warden', voices: { lead: 'brass' } },
warden_flurry:  { from: 'warden', voices: { lead: 'glock' }, transpose: 2 },
warden_bosun:   { from: 'warden', voices: { lead: 'uke' }, swing: 0.2 },
dream:          { from: 'boss', bpm: 126, voices: { lead: 'musicbox', bass: 'bassSoft' }, add: { pad: { voice: 'choir', vol: 0.5 } } },

sailing: {
  bpm: 100, bpb: 3, sp: 6, swing: 0, rev: 0.25,
  chords: 'D G A D Bm G A D',
  melody: ['A5:2 F#5:1 A5:1 D6:2', 'B5:2 G5:1 B5:1 D6:2', 'C#6:2 E6:2 A5:2', 'D6:4 -:2',
           'F#5:2 B5:2 D6:2', 'D6:2 B5:2 G5:2', 'E5:2 A5:2 C#6:2', 'D6:4 A5:2'],
  lead: 'uke', leadVol: 1,
  bass: { pat: 'r . . f . .', voice: 'bassSoft', vol: 0.8 },
  comp: { pat: '. c . c . c', voice: 'strum', vol: 0.55, oct: 1, strum: 0.014 },
  perc: [{ pat: 'x . x x . x', vol: 0.3 }], sparkle: true
},

duskwick: {
  bpm: 96, bpb: 4, sp: 8, swing: 0.2, rev: 0.3,
  chords: 'Bb Gm Eb F Bb Dm Eb F Gm Eb Bb F Eb F Bb Bb',
  melody: [
    'D5:1 F5:1 Bb5:2 F5:1 D5:1 F5:2', 'D5:1 G5:1 Bb5:2 A5:1 G5:1 D5:2',
    'Eb5:1 G5:1 Bb5:2 G5:2 Eb5:2', 'F5:2 A5:2 C6:3 -:1',
    'D6:1 C6:1 Bb5:2 F5:2 D5:2', 'F5:1 A5:1 D6:2 C6:1 A5:1 F5:2',
    'G5:2 Bb5:2 Eb6:2 D6:1 C6:1', 'C6:4 A5:2 -:2',
    'Bb5:1 D6:1 G6:2 F6:1 D6:1 Bb5:2', 'G5:2 Bb5:1 Eb6:1 D6:2 Bb5:2',
    'F5:1 Bb5:1 D6:2 F6:2 D6:2', 'C6:2 A5:2 F5:2 -:2',
    'Eb6:2 D6:1 C6:1 Bb5:2 G5:2', 'A5:2 C6:2 F6:2 Eb6:2',
    'D6:3 C6:1 Bb5:4', 'F5:2 D5:2 Bb4:2 -:2'
  ],
  lead: 'pluck', leadVol: 0.7, lead2: 'marimba', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . f r . f .', voice: 'bassSoft', vol: 0.85 },
  comp: { pat: '1 . 3 . 2 . 3 .', voice: 'harp', vol: 0.35, oct: 1 },
  pad: { voice: 'pad', vol: 0.4 },
  perc: [{ pat: '. . x . . . x .', vol: 0.35 }, { pat: 'w . . w . . w .', vol: 0.3 }], sparkle: true
},

pinewhistle: {
  bpm: 84, bpb: 4, sp: 8, swing: 0, rev: 0.4, delay: { beats: 0.75, fb: 0.35, mix: 0.25 },
  chords: 'Em C G D Em Am B B C G Am Em C D Em Em',
  melody: [
    'B4:2 E5:2 G5:3 F#5:1', 'E5:2 G5:2 C6:4', 'B5:3 A5:1 G5:2 D5:2', 'F#5:4 A5:2 D5:2',
    'E5:2 G5:2 B5:2 E6:2', 'C6:3 B5:1 A5:4', 'B5:2 D#6:2 F#6:4', 'F#6:2 D#6:2 B5:2 -:2',
    'E6:3 D6:1 C6:2 G5:2', 'D6:2 B5:2 G5:4', 'A5:2 C6:2 E6:4', 'E6:2 B5:2 G5:2 E5:2',
    'G5:2 C6:2 E6:3 D6:1', 'D6:2 A5:2 F#5:4', 'G5:3 F#5:1 E5:4', 'B4:4 -:4'
  ],
  lead: 'pluck', leadVol: 0.65, lead2: 'windflute', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.8 },
  comp: { pat: '1 3 5 3 4 3 2 3', voice: 'harp', vol: 0.3, oct: 1 },
  pad: { voice: 'pad', vol: 0.55 }, sparkle: false
},

archwater: {
  bpm: 100, bpb: 4, sp: 8, swing: 0.15, rev: 0.28,
  chords: 'G F C G Em C D D G F C G C D G G',
  melody: [
    'D5:1 G5:1 B5:2 A5:1 G5:1 D5:2', 'C5:1 F5:1 A5:2 G5:1 F5:1 C5:2',
    'E5:2 G5:2 C6:2 G5:2', 'B5:2 D6:2 G5:4',
    'G5:1 B5:1 E6:2 D6:1 B5:1 G5:2', 'E5:2 G5:1 C6:1 E6:4',
    'F#5:2 A5:2 D6:2 C6:2', 'A5:4 F#5:2 -:2',
    'G5:1 B5:1 D6:2 G6:2 D6:2', 'F6:2 C6:2 A5:4',
    'G5:2 C6:1 E6:1 G6:2 E6:2', 'D6:2 B5:2 G5:4',
    'E6:3 D6:1 C6:2 G5:2', 'A5:2 D6:2 F#6:2 A6:2',
    'G6:3 D6:1 B5:4', 'G5:4 -:4'
  ],
  lead: 'pluck', leadVol: 0.8, lead2: 'harp', lead2Vol: 0.8, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . f r . f .', voice: 'bassSoft', vol: 0.85 },
  comp: { pat: 'c . . c . c . .', voice: 'strum', vol: 0.5, oct: 1, strum: 0.016 },
  perc: [{ pat: 'k . . . k . . .', vol: 0.35 }, { pat: '. x . x . x . x', vol: 0.3 }], sparkle: true
},

threemills: {   // 6/8 jig: bpb 2, sp 6
  bpm: 112, bpb: 2, sp: 6, swing: 0, rev: 0.2,
  chords: 'D G D A D G A7 D Bm G D A G A D D',
  melody: [
    'A5:1 F#5:1 A5:1 D6:2 A5:1', 'B5:1 G5:1 B5:1 D6:2 B5:1', 'A5:1 F#5:1 D5:1 F#5:2 A5:1', 'E5:2 C#5:1 E5:3',
    'F#5:1 A5:1 D6:1 F#6:2 E6:1', 'D6:1 B5:1 G5:1 B5:2 D6:1', 'C#6:1 E6:1 A6:1 G6:2 E6:1', 'D6:3 -:3',
    'F#6:1 D6:1 B5:1 D6:2 F#6:1', 'G6:1 D6:1 B5:1 G5:3', 'A5:1 D6:1 F#6:1 A6:2 F#6:1', 'E6:1 C#6:1 A5:1 E5:3',
    'B5:1 D6:1 G6:1 F#6:2 E6:1', 'C#6:1 E6:1 A5:1 C#6:2 E6:1', 'D6:1 A5:1 F#5:1 A5:2 F#5:1', 'D5:3 -:3'
  ],
  lead: 'pluck', leadVol: 0.6, lead2: 'fiddle', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . f . .', voice: 'bassSoft', vol: 0.85 },
  comp: { pat: '. c c . c c', voice: 'accordion', vol: 0.55, oct: 1 },
  perc: [{ pat: 'k . . x . x', vol: 0.4 }], sparkle: false
},

rootdeep: {
  bpm: 72, bpb: 4, sp: 8, swing: 0, rev: 0.55, delay: { beats: 1.5, fb: 0.4, mix: 0.3 },
  chords: 'Am F C G Am F E7 E Dm Am F C Dm F E E',
  melody: [
    'A3:3 C4:1 E4:4', 'F4:3 E4:1 C4:4', 'E4:2 G4:2 C5:4', 'B4:3 A4:1 G4:4',
    'C5:2 B4:2 A4:4', 'A4:2 C5:2 F5:4', 'E5:4 D5:2 B4:2', 'G#4:4 -:4',
    'D4:2 F4:2 A4:4', 'C5:3 B4:1 A4:4', 'F4:2 A4:2 C5:2 A4:2', 'G4:4 E4:4',
    'F4:2 A4:2 D5:4', 'C5:3 A4:1 F4:4', 'B4:4 G#4:2 E4:2', 'E4:4 -:4'
  ],
  lead: 'pluck', leadVol: 0.6, lead2: 'cello', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . . . . . .', voice: 'bassSoft', vol: 0.7 },
  comp: { pat: '. . 3 . . . 5 .', voice: 'glock', vol: 0.22, oct: 2 },
  pad: { voice: 'pad', vol: 0.75 },
  perc: [{ pat: 'd . . . . . . .', vol: 0.3 }, { pat: '. . . . . d . .', vol: 0.18 }], sparkle: true
},

remembered: { from: 'village', bpm: 92, voices: { lead: 'musicbox', comp: 'harp' }, drop: ['perc'], add: { pad: { voice: 'pad', vol: 0.5 } }, rev: 0.4, sparkle: false, startLayer: 3 },

glassway: {
  bpm: 108, bpb: 4, sp: 8, swing: 0.18, rev: 0.3,
  chords: 'E C#m A B E G#m A B C#m A E B A B7 E E',
  melody: [
    'B5:1 E6:1 G#6:2 F#6:1 E6:1 B5:2', 'C#6:1 E6:1 G#6:2 E6:2 C#6:2',
    'A5:2 C#6:2 E6:2 C#6:2', 'D#6:2 F#6:2 B6:3 -:1',
    'G#6:1 F#6:1 E6:2 B5:2 G#5:2', 'B5:1 D#6:1 G#6:2 F#6:1 D#6:1 B5:2',
    'C#6:2 E6:2 A6:2 G#6:1 F#6:1', 'F#6:4 D#6:2 -:2',
    'E6:1 G#6:1 C#7:2 B6:1 G#6:1 E6:2', 'C#6:2 E6:1 A6:1 G#6:2 E6:2',
    'B5:1 E6:1 G#6:2 B6:2 G#6:2', 'F#6:2 D#6:2 B5:4',
    'A6:2 G#6:1 F#6:1 E6:2 C#6:2', 'D#6:2 F#6:2 A6:2 F#6:2',
    'G#6:3 F#6:1 E6:4', 'B5:2 G#5:2 E5:2 -:2'
  ],
  lead: 'pluck', leadVol: 0.7, lead2: 'glock', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . f r . f .', voice: 'bassSoft', vol: 0.8 },
  comp: { pat: 'c . c . . c . c', voice: 'strum', vol: 0.5, oct: 1, strum: 0.014 },
  perc: [{ pat: 'x x . x x x . x', vol: 0.3 }], sparkle: false
},

hush: {   // pad only: the bells must be heard
  bpm: 60, bpb: 4, sp: 8, swing: 0, rev: 0.6,
  chords: 'Am F C G',
  melody: ['-:8', '-:8', '-:8', '-:8'],
  lead: 'bell', leadVol: 0,
  pad: { voice: 'choir', vol: 0.6 }, sparkle: false
},

moonmere: { from: 'mote', bpm: 70, voices: { lead: 'musicbox' }, add: { pad: { voice: 'choir', vol: 0.55 } }, delay: { beats: 1, fb: 0.5, mix: 0.4 } },

kettle: {
  bpm: 104, bpb: 4, sp: 8, swing: 0.1, rev: 0.25,
  chords: 'F Bb C F Dm Bb C7 C F Bb Gm C Dm Bb C F',
  melody: [
    'C5:2 F5:2 A5:3 G5:1', 'F5:2 D5:2 Bb4:4', 'C5:1 E5:1 G5:2 C6:2 G5:2', 'A5:4 F5:2 -:2',
    'D5:2 F5:2 A5:2 D6:2', 'C6:3 Bb5:1 F5:4', 'E5:2 G5:2 C6:2 Bb5:2', 'G5:4 -:4',
    'A5:1 C6:1 F6:2 E6:1 C6:1 A5:2', 'D6:2 F6:2 Bb5:4', 'G5:2 Bb5:2 D6:3 C6:1', 'E6:4 C6:2 G5:2',
    'F5:2 A5:2 D6:4', 'F6:3 D6:1 Bb5:4', 'G5:2 C6:2 E6:2 G6:2', 'F6:4 -:4'
  ],
  lead: 'pluck', leadVol: 0.6, lead2: 'brass', lead2Vol: 1, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . f r . f .', voice: 'bassSoft', vol: 0.9 },
  comp: { pat: '. c . c . c . c', voice: 'stab', vol: 0.7, oct: 1 },
  perc: [{ pat: 'k . . . k . . .', vol: 0.45 }, { pat: '. . a . . . a .', vol: 0.3 }, { pat: 'p . . . . . . .', vol: 0.25 }], sparkle: false
},

saltglass: {
  bpm: 60, bpb: 4, sp: 8, swing: 0, rev: 0.55, delay: { beats: 1.5, fb: 0.4, mix: 0.35 },
  chords: 'Dm C Bb C Dm F G Am Dm C Bb F Gm Am Dm Dm',
  melody: [
    'A5:6 F5:2', 'G5:4 E5:4', 'F5:6 D5:2', 'E5:8',
    'D5:2 F5:2 A5:4', 'C6:6 A5:2', 'B5:4 D6:4', 'C6:6 -:2',
    'D6:4 A5:4', 'G5:4 E5:2 C5:2', 'D5:4 F5:4', 'A5:8',
    'Bb5:4 G5:4', 'C6:2 B5:2 A5:4', 'F5:4 E5:2 D5:2', 'D5:8'
  ],
  lead: 'flute', leadVol: 0.9, lead2: 'bell', lead2Vol: 0.35, layers: { lead2: 1 }, startLayer: 0,
  bass: { pat: 'r . . . . . . .', voice: 'bassSoft', vol: 0.55 },
  comp: { pat: '1 . . . 3 . . .', voice: 'harp', vol: 0.25, oct: 1 },
  pad: { voice: 'pad', vol: 0.7 }, sparkle: false
},

exam: {
  bpm: 116, bpb: 4, sp: 8, swing: 0, rev: 0.2,
  chords: 'Am Dm E Am F Dm E7 E',
  melody: ['A5:1 C6:1 E6:1 C6:1 A5:2 E5:2', 'D6:1 F6:1 A6:1 F6:1 D6:2 A5:2',
           'G#5:1 B5:1 E6:1 B5:1 G#5:2 E5:2', 'A5:2 C6:2 A5:4',
           'C6:1 F6:1 A6:1 F6:1 C6:2 A5:2', 'F5:1 A5:1 D6:1 A5:1 F5:2 D5:2',
           'B5:2 D6:2 E6:2 G#6:2', 'E6:4 -:4'],
  lead: 'pluck', leadVol: 1,
  bass: { pat: 'r . r . f . r .', voice: 'bassSoft', vol: 0.8 },
  comp: { pat: '. 3 . 3 . 3 . 3', voice: 'harp', vol: 0.3, oct: 1 },
  perc: [{ pat: 't . t . t . t .', vol: 0.5 }, { pat: 'w . . . . . . .', vol: 0.3 }], sparkle: false
},

driftholm: {
  bpm: 78, bpb: 3, sp: 6, swing: 0, rev: 0.5, delay: { beats: 1, fb: 0.35, mix: 0.3 },
  chords: 'D A Bm G D F#m G A Bm G D A G A D D',
  melody: [
    'A5:2 F#5:2 D5:2', 'E5:2 C#5:2 A4:2', 'D5:2 F#5:2 B5:2', 'D6:4 B5:2',
    'A5:2 D6:2 F#6:2', 'E6:2 C#6:2 A5:2', 'B5:2 D6:2 G6:2', 'E6:4 -:2',
    'F#6:2 D6:2 B5:2', 'D6:2 B5:2 G5:2', 'F#5:2 A5:2 D6:2', 'C#6:4 A5:2',
    'B5:2 G5:2 D5:2', 'C#5:2 E5:2 A5:2', 'F#5:4 E5:2', 'D5:6'
  ],
  lead: 'harp', leadVol: 1, lead2: 'flute', lead2Vol: 0.35,
  bass: { pat: 'r . . . . .', voice: 'bassSoft', vol: 0.6 },
  comp: { pat: '1 3 5 4 3 2', voice: 'harp', vol: 0.3, oct: 1 },
  pad: { voice: 'pad', vol: 0.55 }, sparkle: true
},

chase: {   // Mote runs; Pip keeps up. Bright, never menacing
  bpm: 140, bpb: 4, sp: 16, swing: 0, rev: 0.2,
  chords: 'Dm Bb C A Dm Bb Gm A7',
  melody: [
    'A5:2 F5:2 D5:2 F5:2 A5:2 D6:2 C6:2 A5:2', 'Bb5:2 F5:2 D5:2 F5:2 Bb5:4 D6:4',
    'C6:2 G5:2 E5:2 G5:2 C6:2 E6:2 G6:4', 'E6:2 C#6:2 A5:2 C#6:2 E6:4 -:4',
    'D6:2 A5:2 F5:2 A5:2 D6:2 F6:2 A6:4', 'F6:2 D6:2 Bb5:2 D6:2 F6:4 D6:4',
    'G5:2 Bb5:2 D6:2 G6:2 F6:2 D6:2 Bb5:4', 'A5:2 C#6:2 E6:2 A6:2 G6:2 E6:2 C#6:4'
  ],
  lead: 'glock', leadVol: 1, lead2: 'pluck', lead2Vol: 0.5,
  bass: { pat: 'r . . . r . . . f . . . r . . .', voice: 'bassSoft', vol: 0.85 },
  comp: { pat: '. . c . . . c . . . c . . . c .', voice: 'stab', vol: 0.6, oct: 1 },
  perc: [{ pat: 'k . . . x . . . k . k . x . . .', vol: 0.5 }, { pat: 'h . h . h . h . h . h . h . h .', vol: 0.35 }], sparkle: false
},

starmeadow: {
  bpm: 70, bpb: 3, sp: 6, swing: 0, rev: 0.55, delay: { beats: 1, fb: 0.4, mix: 0.3 },
  chords: 'Eb Cm Ab Bb Eb Gm Ab Bb Cm Ab Eb Bb Ab Bb Eb Eb',
  melody: [
    'Bb5:2 Eb6:2 G6:2', 'G6:4 Eb6:2', 'C6:2 Eb6:2 Ab6:2', 'F6:4 D6:2',
    'Eb6:2 G6:2 Bb6:2', 'Bb6:4 G6:2', 'Ab6:2 G6:2 F6:2', 'F6:6',
    'Eb6:2 G6:2 C7:2', 'C7:4 Ab6:2', 'G6:2 Bb6:2 Eb7:2', 'D7:4 Bb6:2',
    'C7:2 Ab6:2 Eb6:2', 'D6:2 F6:2 Bb6:2', 'G6:4 F6:2', 'Eb6:6'
  ],
  lead: 'musicbox', leadVol: 1,
  bass: { pat: 'r . . . . .', voice: 'bassSoft', vol: 0.55 },
  comp: { pat: '1 . 3 . 5 .', voice: 'harp', vol: 0.25, oct: 1 },
  pad: { voice: 'choir', vol: 0.8 }, sparkle: false
},

ladder: {
  bpm: 96, bpb: 4, sp: 8, swing: 0, rev: 0.4, delay: { beats: 0.75, fb: 0.35, mix: 0.25 },
  chords: 'Eb Bb Cm Ab Eb Bb Ab Bb',
  melody: ['Bb5:2 Eb6:2 G6:4', 'F6:2 D6:2 Bb5:4', 'G6:2 Eb6:2 C6:4', 'Ab5:2 C6:2 Eb6:4',
           'G6:3 F6:1 Eb6:4', 'D6:2 F6:2 Bb6:4', 'C7:2 Ab6:2 Eb6:2 C6:2', 'D6:4 F6:2 -:2'],
  lead: 'glock', leadVol: 1,
  bass: { pat: 'r . . f r . . f', voice: 'bassSoft', vol: 0.8 },
  comp: { pat: '1 3 2 3 1 3 2 3', voice: 'harp', vol: 0.3, oct: 1 },
  pad: { voice: 'choir', vol: 0.6 },
  perc: [{ pat: 'k . x . k . x .', vol: 0.35 }], sparkle: false
},
ladder_duskwick:  { from: 'ladder', voices: { lead: 'marimba' } },
ladder_pinewhistle: { from: 'ladder', voices: { lead: 'windflute' } },
ladder_archwater:   { from: 'ladder', voices: { lead: 'harp' } },
ladder_threemills:  { from: 'ladder', voices: { lead: 'fiddle' } },

sneeze: {
  bpm: 120, bpb: 4, sp: 8, swing: 0, rev: 0.3,
  chords: 'F C Dm Bb F Am Bb C',
  melody: ['C5:1 F5:1 A5:2 C6:2 A5:2', 'G5:1 C6:1 E6:2 G6:2 E6:2', 'F5:1 A5:1 D6:2 F6:2 D6:2', 'D6:2 C6:2 Bb5:2 F5:2',
           'A5:1 C6:1 F6:2 A6:2 F6:2', 'E6:2 C6:2 A5:2 C6:2', 'Bb5:2 D6:2 F6:2 D6:2', 'C6:2 E6:2 G6:4'],
  lead: 'bell', leadVol: 0.9, lead2: 'flute', lead2Vol: 0.6,
  bass: { pat: 'r . f . r . f .', voice: 'bassSoft', vol: 0.9 },
  comp: { pat: 'c . c . . c . c', voice: 'strum', vol: 0.5, oct: 1, strum: 0.012 },
  perc: [{ pat: 'k . x . t . x .', vol: 0.45 }], sparkle: true
},

given_light: {
  bpm: 72, bpb: 4, sp: 8, swing: 0, rev: 0.5, delay: { beats: 0.75, fb: 0.3, mix: 0.25 },
  chords: 'F Dm Bb C F Am Bb C',
  melody: ['C5:2 F5:2 A5:4', 'A5:2 D6:2 F6:4', 'F6:3 D6:1 Bb5:4', 'C6:4 E6:2 G6:2',
           'A6:4 F6:4', 'E6:3 C6:1 A5:4', 'D6:2 F6:2 Bb6:2 A6:2', 'G6:4 -:4'],
  lead: 'flute', leadVol: 1,
  counter: { voice: 'glock', vol: 0.6, melody: [
    '-:4 C6:1 A5:1 F5:2', '-:4 D6:1 A5:1 F5:2', '-:4 F6:1 D6:1 Bb5:2', '-:4 G6:1 E6:1 C6:2',
    '-:4 C7:1 A6:1 F6:2', '-:4 E6:1 C6:1 A5:2', '-:4 D6:1 Bb5:1 F5:2', '-:4 E6:1 C6:1 G5:2'] },
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.75 },
  comp: { pat: '1 2 3 4 5 4 3 2', voice: 'harp', vol: 0.35, oct: 1 },
  pad: { voice: 'choir', vol: 0.75 }, sparkle: true
},

night: {   // the Hundred-Year Night waltz
  bpm: 150, bpb: 3, sp: 6, swing: 0, rev: 0.3,
  chords: 'Eb Bb Cm Ab Eb Bb Ab Bb Cm Gm Ab Eb Ab Bb Eb Eb',
  melody: [
    'G5:2 Bb5:2 Eb6:2', 'D6:4 F5:2', 'Eb6:2 G6:2 C6:2', 'C6:4 Ab5:2',
    'Bb5:2 Eb6:2 G6:2', 'F6:4 D6:2', 'Eb6:2 C6:2 Ab5:2', 'Bb5:6',
    'G5:2 C6:2 Eb6:2', 'D6:4 Bb5:2', 'C6:2 Eb6:2 Ab6:2', 'G6:4 Eb6:2',
    'Ab6:2 G6:2 F6:2', 'F6:2 D6:2 Bb5:2', 'Eb6:4 G5:2', 'Eb6:6'
  ],
  lead: 'fiddle', leadVol: 1, lead2: 'musicbox', lead2Vol: 0.35,
  bass: { pat: 'r . . . . .', voice: 'bassSoft', vol: 0.85 },
  comp: { pat: '. . c . c .', voice: 'accordion', vol: 0.5, oct: 1 },
  perc: [{ pat: 'k . . . x .', vol: 0.3 }], sparkle: true
},

margins: {
  bpm: 100, bpb: 4, sp: 8, swing: 0.12, rev: 0.2,
  chords: 'C Am F G C Am Dm G',
  melody: ['C5:1 E5:1 G5:1 E5:1 C6:2 G5:2', 'A5:1 C6:1 E6:1 C6:1 A5:2 E5:2',
           'F5:1 A5:1 C6:1 A5:1 F6:2 C6:2', 'G5:1 B5:1 D6:1 B5:1 G5:4',
           'E6:1 D6:1 C6:1 B5:1 C6:2 G5:2', 'C6:1 B5:1 A5:1 G5:1 A5:2 E5:2',
           'D5:1 F5:1 A5:1 D6:1 F6:2 D6:2', 'B5:2 G5:2 D5:4'],
  lead: 'pluck', leadVol: 1,
  bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.7 },
  comp: { pat: '. 3 . 2 . 3 . 4', voice: 'glock', vol: 0.25, oct: 1 },
  perc: [{ pat: 'c . c c . c . c', vol: 0.5 }, { pat: '. . . . e . . .', vol: 0.35 }], sparkle: false
},
```

**Which track plays where.** Each realm's `W.palette.music` is its land track. Regions override only where named:
Wickhaven, Acornet Hollow, the Raft, Haybury, Burrowbottom, Puffin Post, Forgefall, Sablecamp and Mote's Meadow use
their land track (towns share it; the village feel comes from the ambience bed). Dungeons set their own track on
entry; bosses switch to their `warden_*` track at the intro and back after the handover; story scenes may name a
track (`wenna`, `mote`) and restore the previous track when they end. Music ducks in dialogue and the shop as shipped.

---

<a id="ambience"></a>

## 13. Ambience

### 13.1 The bed format (shipped) and its extensions

Shipped `BEDS` entries (`js/audio.js`): `wind: [bandpass Hz, Q, gain, gust LFO depth]`, `waves: [lowpass Hz, gain]`,
`ev: [[oneShotName, ratePerSecond, when]]` with `when` 0 = day only, 1 = night only, -1 = always. S-028's
`addAmbience(name, bed)` adds two optional layers:

| Field | Meaning |
|---|---|
| `drone: [Hz, gain, lowpassHz]` | a sine + a triangle an octave up, lowpassed, with a 0.05 Hz swell of ±30 %: caves, the Kettle's rumble, the sky's hum |
| `tones: { voice, notes: [midi...], every: [minS, maxS], vol, when }` | a music voice plays one random note of the set every `every` seconds on the ambience bus: the Whistling Pine's song, the singing dunes, Starkin humming. Off when the land is dim if `dim: true` |
| `dim: { <key>: 0..1 }` | multipliers applied while the land is dim; a key is a layer (`wind`, `waves`, `drone`, `tones`), `ev` (every one-shot's rate) or one one-shot's name (its rate), e.g. `{ waves: 0.5, tones: 0, ambMill: 0 }` |

New one-shots (added to the SFX bank next to `ambBird`, each with a `LIM` entry `[2, 0.4]` and `LOW_PRI`):

```js
ambMoth:      function (t) { N({ t: t, d: 0.18, v: 0.03, a: 0.02, type: 'bandpass', f: 900, q: 1.5 }); N({ t: t + 0.06, d: 0.16, v: 0.025, a: 0.02, type: 'bandpass', f: 1100, q: 1.5 }); return 0.3; },
ambSaw:       function (t) { for (var i = 0; i < 2; i++) T({ t: t + i * 0.7, f: 180, f1: 220, d: 0.6, v: 0.025, type: 'sawtooth', lp: 900, vib: [9, 12] }); return 1.4; },
ambDrip:      function (t) { T({ t: t, f: 1400 * rv(0.2), f1: 2600, d: 0.08, v: 0.05, a: 0.002, rev: 0.5 }); return 0.2; },
ambBubble:    function (t) { T({ t: t, f: 400 * rv(0.2), f1: 900, d: 0.08, v: 0.04 }); return 0.1; },
ambSteam:     function (t) { N({ t: t, d: 0.9, v: 0.05, a: 0.2, type: 'highpass', f: 2400 }); return 1.0; },
ambAnvil:     function (t) { for (var i = 0; i < 3; i++) T({ t: t + i * 0.45, f: 2489, d: 0.5, v: 0.03, a: 0.001, rev: 0.4 }); return 1.5; },
ambGlassChime: function (t) { var n = [1318.5, 1568, 1975.5, 2349]; T({ t: t, f: n[(rnd() * 4) | 0], d: 2.0, a: 0.3, v: 0.03, vib: [3, 4], rev: 0.5 }); return 2.1; },
ambBuoyBell:  function (t) { bell(t, 784, 1.8, 0.25, null, 0.4); bell(t + 0.9, 784, 1.6, 0.2, null, 0.4); return 2.6; },
ambMill:      function (t) { T({ t: t, f: 150, f1: 210, d: 0.7, v: 0.03, type: 'sawtooth', lp: 600, vib: [7, 8] }); return 0.8; },
ambBaa:       function (t) { var p = rv(0.1); T({ t: t, f: 420 * p, f1: 380 * p, d: 0.5, v: 0.035, type: 'sawtooth', lp: 1400, vib: [18, 25] }); return 0.6; },
ambQuack:     function (t) { for (var i = 0; i < 2; i++) T({ t: t + i * 0.16, f: 700, f1: 500, d: 0.12, v: 0.03, type: 'sawtooth', lp: 1500 }); return 0.4; },
ambWhale:     function (t) { T({ t: t, f: 180, f1: 320, fd: 1.2, d: 2.2, v: 0.04, a: 0.4, vib: [2, 6], rev: 0.6 }); return 2.4; },
ambCloud:     function (t) { N({ t: t, d: 1.2, v: 0.03, a: 0.5, type: 'lowpass', f: 900, f1: 500 }); return 1.3; },
ambTwinkle:   function (t) { var n = [1568, 2093, 2637]; for (var i = 0; i < 3; i++) T({ t: t + i * 0.11, f: n[(rnd() * 3) | 0], d: 0.3, v: 0.02, a: 0.002, rev: 0.4 }); return 0.6; },
ambPencil:    function (t) { N({ t: t, d: 0.4, v: 0.03, a: 0.05, type: 'bandpass', f: 3000, q: 2 }); return 0.45; },
ambPage:      function (t) { N({ t: t, d: 0.3, v: 0.04, a: 0.04, type: 'bandpass', f: 1800, f1: 4000, q: 0.8 }); return 0.35; },
ambFrog:      function (t) { for (var i = 0; i < 2; i++) T({ t: t + i * 0.2, f: 240, f1: 200, d: 0.15, v: 0.03, type: 'square', lp: 800 }); return 0.5; },
ambWaterfall: function (t) { N({ t: t, d: 2.0, v: 0.04, a: 0.6, type: 'bandpass', f: 1200, q: 0.5 }); return 2.0; },
```

### 13.2 Beds per realm and region

| Bed | Used in | Data |
|---|---|---|
| `under_roots` | dungeon 1 | `{ drone: [55, 0.05, 300], ev: [['ambDrip', 0.25, -1]] }` |
| `nook` | Pip's Nook, cottages | `{ wind: [400, 0.5, 0.012, 0.008], ev: [['ambCricket', 0.15, 1]] }` (a faint outside breeze) |
| `dungeon` | dungeons 2-9 default | `{ drone: [62, 0.04, 280], ev: [['ambDrip', 0.12, -1]] }` |
| `duskwick_town` | Wickhaven | `{ waves: [480, 0.07], wind: [520, 0.6, 0.03, 0.02], ev: [['ambMoth', 0.3, 1], ['ambBird', 0.2, 0], ['ambChime', 0.03, -1]], dim: { ev: 0.3 } }` |
| `duskwick_shore` | Ember Sands, Coral Steps, Tower Head | `{ waves: [520, 0.1], wind: [450, 0.6, 0.04, 0.03], ev: [['ambGull', 0.08, 0], ['ambCricket', 0.3, 1], ['ambBubble', 0.1, -1]] }` |
| `pinewhistle_hollow` | Acornet Hollow | `{ wind: [800, 0.8, 0.05, 0.04], ev: [['ambBird', 0.35, 0], ['ambOwl', 0.05, 1], ['ambCricket', 0.3, 1]] }` |
| `pinewhistle_ravine` | Misthollow Ravines, Sawmill Run | `{ wind: [1000, 0.9, 0.07, 0.05], ev: [['ambSaw', 0.04, 0], ['ambBird', 0.15, 0], ['ambDrip', 0.05, -1]], dim: { ev: 0.5 } }` |
| `pinewhistle_rise` | Whistle Rise | `{ wind: [700, 1.1, 0.09, 0.06], tones: { voice: 'windflute', notes: [76, 79, 81, 84, 86], every: [2.5, 5], vol: 0.35, when: -1 }, dim: { tones: 0 } }` (the pine's song: silent while dim) |
| `archwater_raft` | the Raft | `{ waves: [520, 0.12], wind: [420, 0.6, 0.03, 0.02], ev: [['ambGull', 0.12, 0], ['ambBuoyBell', 0.02, -1], ['ambCricket', 0.2, 1]], dim: { waves: 0.5, ev: 0.5 } }` |
| `archwater_coast` | Basalt Stairs, Tidepool Shelf, Kelp Shallows | `{ waves: [560, 0.13], wind: [600, 0.8, 0.05, 0.04], ev: [['ambGull', 0.08, 0], ['ambBubble', 0.15, -1]], dim: { waves: 0.5 } }` |
| `threemills_farm` | Haybury, Tumble Hill, Orchard Rows | `{ wind: [650, 0.7, 0.045, 0.03], ev: [['ambBird', 0.4, 0], ['ambBaa', 0.04, 0], ['ambMill', 0.08, -1], ['ambCricket', 0.6, 1]], dim: { ambMill: 0 } }` |
| `threemills_marsh` | Millpond Marsh | `{ wind: [500, 0.6, 0.03, 0.02], ev: [['ambQuack', 0.06, 0], ['ambFrog', 0.2, 1], ['ambBubble', 0.1, -1]] }` |
| `rootdeep_burrow` | Burrowbottom | `{ drone: [65, 0.035, 300], ev: [['ambDrip', 0.15, -1], ['ambChime', 0.02, -1]] }` |
| `rootdeep_cavern` | Glowcap Forest, the Underlake, Geode Galleries | `{ drone: [49, 0.06, 260], ev: [['ambDrip', 0.3, -1], ['ambTinkle', 0.06, -1]], tones: { voice: 'cello', notes: [45, 52, 57], every: [6, 12], vol: 0.25, when: -1 }, dim: { drone: 0.3, tones: 0 } }` |
| `glassway_sea` | the Sandbars, Wreck Reach, Bell Shallows, open water | `{ waves: [600, 0.12], wind: [500, 0.7, 0.05, 0.035], ev: [['ambGull', 0.1, 0], ['ambBuoyBell', 0.03, -1], ['ambWhale', 0.01, -1]], tones: { voice: 'bell', notes: [55], every: [20, 40], vol: 0.3, when: -1 }, dim: { tones: 0 } }` (the Sunken Bell's distant toll once its stone is set) |
| `glassway_post` | Puffin Post | `{ waves: [520, 0.09], wind: [450, 0.6, 0.03, 0.02], ev: [['ambGull', 0.15, 0], ['ambPage', 0.05, 0]] }` |
| `kettle_forge` | Forgefall | `{ drone: [70, 0.03, 320], wind: [500, 0.6, 0.03, 0.02], ev: [['ambAnvil', 0.08, 0], ['ambSteam', 0.1, -1]], dim: { ev: 0.4 } }` |
| `kettle_baths` | Bathhouse Terraces, the Spout | `{ drone: [58, 0.04, 260], ev: [['ambSteam', 0.33, -1], ['ambBubble', 0.25, -1]] }` |
| `kettle_coast` | Ash Beach | `{ waves: [500, 0.11], wind: [550, 0.7, 0.04, 0.03], ev: [['ambGull', 0.06, 0], ['ambSteam', 0.05, -1]] }` |
| `saltglass_camp` | Sablecamp, Academy Hill | `{ wind: [900, 1.0, 0.05, 0.04], ev: [['ambPage', 0.04, 0], ['ambCricket', 0.25, 1]] }` |
| `saltglass_dunes` | the Glass Dunes, the Salt Pans | `{ wind: [1100, 1.2, 0.08, 0.06], ev: [['ambGlassChime', 0.12, -1]], dim: { ev: 0 } }` (the dunes sing only once the Academy stone is set) |
| `driftholm_meadow` | Mote's Meadow, Nimble Downs, Arch Rise | `{ wind: [750, 0.8, 0.05, 0.04], ev: [['ambCloud', 0.1, -1], ['ambTwinkle', 0.05, 1], ['ambBird', 0.1, 0]] }` |
| `driftholm_edge` | the Falls | `{ wind: [900, 1.0, 0.08, 0.05], ev: [['ambWaterfall', 0.4, -1], ['ambCloud', 0.15, -1]] }` |
| `starmeadow_isles` | every Starmeadow region | `{ drone: [98, 0.02, 600], wind: [800, 0.8, 0.03, 0.02], ev: [['ambTwinkle', 0.3, -1]], tones: { voice: 'choir', notes: [67, 71, 74, 79], every: [4, 8], vol: 0.3, when: -1 } }` |
| `crown` | the Crown | `{ wind: [700, 0.8, 0.05, 0.04], ev: [['leaves', 0.2, -1], ['ambTwinkle', 0.1, -1]] }` |
| `remembered` | the Remembered Isle | home beds by region with `ev` rates × 0.6 and `ambChime` × 3 (a variant of each shipped bed: `remembered_<region>`) |
| `moonmere` | Moonmere | `{ waves: [400, 0.05], wind: [500, 0.5, 0.02, 0.01], ev: [['ambTwinkle', 0.12, -1], ['ambOwl', 0.03, -1]] }` |
| `night` | the Hundred-Year Night | home `village` bed + `ev: [['ambTwinkle', 0.25, -1]]` |
| `margins` | Hoot's Margins | `{ wind: [600, 0.6, 0.02, 0.01], ev: [['ambPencil', 0.15, -1], ['ambPage', 0.05, -1]] }` |
| `dream` | Guardian Dreams | `{ drone: [110, 0.015, 800], ev: [['ambTwinkle', 0.2, -1], ['ambChime', 0.05, -1]] }` |

The shipped home beds (`village`, `woods`, `peaks`, `shores`, `meadow`) are unchanged, with one addition after the
bloom: the `village` bed's `ambChime` rate rises from 0.04 to 0.06 (the crown lanterns' chimes) once the first crown
lantern is lit (S-095).

---

<a id="sfx"></a>

## 14. SFX

All SFX are procedural recipes in the SFX bank of `js/audio.js` (shipped style: a function of `t` returning its
length), played through `G.audio.sfx(name, { x, y, z })` for anything in the world (pan, distance gain, the
behind-you low-pass). Every SFX marked **cue** has a visual twin (`./charter.md#first-person` rule 5), named in the
last column. `LIM` entries default to `[3, 0.05]`.

### 14.1 Tools

| Name | When | Recipe | Visual twin |
|---|---|---|---|
| `lanternOn` / `lanternOff` | tool toggle | on: `T({f: 660, f1: 990, d: 0.18, v: 0.1, type: 'triangle'})` + `sparkle`; off: the reverse sweep, no sparkle | bud opens / closes in hand |
| `kindle` | `[E] Kindle` lands | `bell(t, 523, 1.2, 0.5)`, `bell(t+0.12, 784, 1.4, 0.45)`, `bell(t+0.24, 1047, 1.8, 0.4)` + `N({d: 0.5, v: 0.06, type: 'bandpass', f: 3000, f1: 6000})` | `card_fx_kindle` burst |
| `glideOpen` | Glider opens | `N({d: 0.25, v: 0.12, a: 0.02, type: 'bandpass', f: 600, f1: 1800})` + `T({f: 300, f1: 500, d: 0.15, v: 0.05, type: 'triangle'})` | leaf unfurls above |
| `glideWind` (loop emitter) | while gliding | emitter: bandpass noise 900 Hz, Q 0.7, gain 0.04 × speed / 6 | leaf edge flutter |
| `tideRing` | Tide Bell rung | `bell(t, 392, 2.4, 0.7)` + `splashBig` 0.4 s later | water level animates |
| `hookFire` / `hookAttach` / `hookReel` | Thistle Hook | fire: `T({f: 900, f1: 300, d: 0.2, v: 0.08, type: 'sawtooth', lp: 1800})`; attach: `T({f: 220, f1: 160, d: 0.1, v: 0.15})` + `pop`; reel: emitter of `T` ticks at 14 Hz, 1200 Hz, v 0.03 | twine line drawn |
| `sunglassHum` (emitter) | beam held | sine 880 Hz + 1320 Hz at 0.02, vibrato 3 Hz; +6 dB when on a receiver | beam visible; reticle turns gold on target (cue) |
| `receiverLit` | a receiver fills | `bell(t, 1319, 1.0, 0.5)` + `sparkle` | receiver glows |
| `dig` | Digging Paws | `N({d: 0.2, v: 0.2, type: 'lowpass', f: 700, f1: 250})` × 2 at 0.18 s | dirt puff (`fx_crack` reused) |
| `starsongNote1/2/3` | the three notes (low, mid, high) | `V.windflute` at MIDI 72 / 76 / 79, 0.45 s | leaf in hand tilts; note glyph puff |
| `tuneDawn` / `tuneDusk` / `tuneCalling` | a tune completes | Dawn: 72-76-79-84; Dusk: 79-76-72-67; Calling: 72-79-76-84, each on `windflute`, 0.25 s per note, then `sparkle` | sky shift / boat horn / moonpath |
| `slingDraw` / `slingShot` / `emberHit` | Ember Sling | draw: `creak` at rate 1.2; shot: `T({f: 500, f1: 1200, d: 0.12, v: 0.1, type: 'triangle'})` + `whoosh`; hit: `pop` + `N({d: 0.3, v: 0.08, type: 'highpass', f: 2000})` | ember glow trail |
| `ivyGrab` | each Gloves climb step | `leaves` at v × 0.7 | hands on lattice |
| `cloudPuff` | Cloudstep second hop | `N({d: 0.3, v: 0.08, a: 0.02, type: 'lowpass', f: 1200, f1: 400})` + `T({f: 520, f1: 780, d: 0.12, v: 0.05, type: 'triangle'})` | puff under the feet |
| `swordStarsteel` | Starsteel swing (replaces `swingSparkle` notes) | `swingA/B/C` + `T({f: 2637, d: 0.2, v: 0.03})` | blade glint |

### 14.2 Puzzles and dungeons

| Name | Recipe | Visual twin |
|---|---|---|
| `plateDown` / `plateUp` | `T({f: 180, f1: 120, d: 0.12, v: 0.2})` + `N({d: 0.06, v: 0.1, type: 'lowpass', f: 600})` / pitch reversed | plate sinks 4 cm |
| `doorOpen` (stone) | `rumble` 0.8 s + `T({f: 110, f1: 90, d: 0.8, v: 0.1})` | door slides |
| `doorLocked` | `error` at v × 0.6 + `T({f: 1400, d: 0.05, v: 0.08, type: 'square', lp: 2000})` | lock plate glints |
| `keyGet` | `fanfare` short form: `bell` 1047, 1319, 1568 at 0.08 s | key held up |
| `bossDoor` | `bossIntro` first 0.6 s + `rumble` | spiral door glows |
| `pushScrape` (emitter) | bandpass noise 400 Hz, Q 1.2, 0.05 while a block moves | block moves |
| `mirrorTurn` | `T({f: 600, f1: 680, d: 0.08, v: 0.1, type: 'triangle'})` + `clink` | mirror turns 45° |
| `gearCrank` | `ambMill` at rate 2 + `tink` × 3 | gear bridge turns |
| `valve` | `ambSteam` at v × 2 + `T({f: 300, f1: 200, d: 0.3, v: 0.06, type: 'sawtooth', lp: 900})` | platform moves |
| `floodRise` / `floodFall` | `splashBig` + `N({d: 1.5, v: 0.08, type: 'lowpass', f: 400, f1: 900})` / reversed sweep | water plane moves |
| `bellLow` / `bellMid` / `bellHigh` | Sunken Bell pitches: `bell(t, 392 / 523 / 659, 2.2, 0.8)` | bell swings |
| `sandFlow` (emitter) | bandpass noise 2500 Hz, Q 0.8, 0.03 on sand-flow tiles | sand streaks |
| `rootGrow` | `T({f: 120, f1: 240, d: 0.6, v: 0.1, type: 'triangle', vib: [6, 8]})` + `leaves` | root bridge grows |
| `cloudSolid` | `T({f: 880, d: 0.5, v: 0.05})` + `ambCloud` | cloud colour brightens |

### 14.3 World, progress and collectibles

| Name | Recipe | Visual twin |
|---|---|---|
| `benchSit` | `T({f: 220, f1: 180, d: 0.15, v: 0.12})` + `bell(t+0.1, 1568, 0.8, 0.3)` | bench lamp lights |
| `rootgate` | `rumble` 1.2 s + `rootGrow` | roots part |
| `acornSnore` (**cue**, emitter within 10 m) | `T({f: 140, f1: 110, d: 0.9, v: 0.05, a: 0.4, type: 'triangle', vib: [3, 6]})` every 2.4 s | `card_fx_zpuff` above the acorn |
| `acornWake` | `T({f: 400, f1: 800, d: 0.2, v: 0.1, type: 'triangle'})` (a yawn) + `sparkle` | sapling sprouts |
| `saplingGrow` | `rootGrow` at rate 1.5 + `leaves` | sapling scales up over 1.2 s |
| `bottleBob` (**cue**, emitter within 15 m of a washed-up bottle) | `bubble` at 0.4 every 1.8 s + `tink` | `glassway_card_bottle_glint` |
| `chimeBell` (**cue**, within 30 m) | `bell(t, 2093, 0.6, 0.25)`; interval 3.0 s at 30 m to 0.6 s at 2 m | HUD `icons_hud:chime` pulses at the same rate |
| `keepsakeTwinkle` (shipped cue) | unchanged | shipped twinkle |
| `vistaSketch` | `ambPencil` × 2 + `ambPage` | the sketch card appears |
| `memoryTouch` | `bell` 523 / 659 / 784 / 1047 arpeggio, slow attack, rev 0.6 | screen warms to sepia |
| `questStep` | `bell(t, 1319, 0.8, 0.4)` + `bell(t+0.1, 1760, 1.0, 0.4)` | toast |
| `journalOpen` / `journalTab` / `journalClose` | `ambPage` / `uiTab` / `ambPage` at rate 0.8 | notebook animates |
| `askTree` | `sting_wenna` ([§14.6](#stings)) at v × 0.6 | soft-gold frame |
| `sailStart` / `sailFlap` (emitter) | `whoosh` + `creak`; flap: noise 1500 Hz, 0.04, modulated by speed | sail fills |
| `bowWave` (emitter) | lowpass noise 700 Hz, 0.03-0.09 by speed | `glassway_card_bow_wave` |
| `fishCast` / `fishBite` (**cue**) / `fishReel` / `fishCatch` | cast: `whoosh` + `splash`; bite: `T({f: 900, d: 0.05, v: 0.1})` × 2 + `bubble`; reel: `T` ticks 18 Hz; catch: `splashBig` + `pickupGem` | bite: the float dips and a "!" puff |
| `beaconLit` (distant, played at the isle's bearing from home) | `bell(t, 262, 3, 0.4, null, 0.6)` | horizon window lights |

### 14.4 Creatures and bosses

New species and bosses reuse the shipped telegraph family (`windup_*`, `alert`, `swoop`, `rumble`, `bonk`, `pop`,
`bossPop`, `bossIntro`) so the "this is about to hurt" language stays one language. Each species row in
`./creatures.md` names its wind-up; these are the new wind-ups it may name:

| Name | For | Recipe |
|---|---|---|
| `windup_charge` | chargers (Sizzle Beetle, Woolly Ram, Soot Snuffle, Comet Pup) | `T({f: 200, f1: 320, d: dur, v: 0.08, type: 'sawtooth', lp: 900})` + 3 hoof/foot taps (`tink` at 0.15 s) |
| `windup_lob` | lobbers and turrets (Coco Clonk, Squirt Urchin, Scarecrowlet, Steam Puff, Prickle Pear, Moonbeam Turret) | `T({f: 260, f1: 520, d: dur, v: 0.07, type: 'triangle', vib: [10, 20]})` ending in `pop` |
| `windup_burrow` | burrowers (Sand Snapper, Sandsnoot) | `N({d: dur, v: 0.1, type: 'lowpass', f: 300, f1: 900})` + `emerge_ground` at the end |
| `windup_dive` | divers and swoopers (Needle Wasp, Gullgrab, Drip Bat, Ash Moth, Gust Kite) | `swoop` with `whistle` over the last 0.3 s |
| `windup_split` | splitters (Pinecone Puff) | `windup_mushroom` at rate 1.2 + `pop` × 2 |
| `windup_swarm` | swarms (Field Vole gang, Stardust Sprite) | 4 × `squish` at 0.08 s, rising pitch |
| `windup_ghost` | ghosts (Dimling, Hushling, Wisp Lantern) | `T({f: 600, f1: 400, d: dur, v: 0.04, vib: [6, 30], rev: 0.5})` |
| `honkRing` | Lady Honksworth's HONK | `T({f: 330, f1: 280, d: 0.5, v: 0.18, type: 'sawtooth', lp: 1500, vib: [25, 20]})` |
| `inkGulp` | Old Gloop's ink tell (the gulp before the 1.2 s swell) | `T({f: 160, f1: 90, d: 0.3, v: 0.15})` + `bubble` × 3 |
| `lensSweep` | Wickwork Moth beam | `sunglassHum` at rate 0.7 with a 2 Hz wobble |
| `wormSurface` | Lumbra's hole ring | `rumble` 0.8 + `emerge_ground` |
| `bellySplash` | Lady Fumarole's belly-flop disc | `splashBig` + `landHeavy` |
| `examBell` | Tutor Scarabelle's paper start / end | `bell(t, 880, 1.5, 0.6)` × 2 |
| `moteDrop` | a falling light in the chase / Stray Lights | `T({f: 2093, f1: 1047, d: 0.55, v: 0.06})` + `sparkle` (the circle is the visual twin) |
| `snoreBubble` | Bosun Snore's rings | `T({f: 90, f1: 70, d: 0.8, v: 0.12, vib: [8, 10]})` |
| `avalanche` | Great-Aunt Flurry's roll | `rumble` + `snow` × 4 |
| `calmed` | any boss sits down dizzy (replaces `bossDie` for calmed Wardens) | `bossPop` at v × 0.6 + `T({f: 600, f1: 300, d: 0.6, v: 0.08, type: 'triangle'})` (a big sigh) + `sparkle` |

<a id="npc-voices"></a>

### 14.5 NPC voices

Dialogue blips (the shipped `talk` sfx) take a `voice` option: `{ f, type, f1k, vib }` = base Hz, oscillator type,
end-pitch ratio, vibrato. One blip per 2-3 characters, as shipped. The voices (by species; each named NPC may add
±10 % on `f` in `./cast.md`):

| Species | f (Hz) | type | f1k | vib | Who |
|---|---|---|---|---|---|
| turtle | 220 | triangle | 0.9 | [5, 4] | Shellby, Pelagia (190) |
| frog | 300 | square (lp 1200) | 0.8 | - | Ribbit, Puddle (520) |
| cat | 620 | triangle | 1.15 | - | Miso, Kinako (650, `!!` speeds blips × 1.3), Granny Mochi (480) |
| bunny | 760 | sine | 1.1 | - | Clover, Primrose (680), kits (900) |
| owl | 340 | triangle | 0.85 | [6, 6] | Hoot |
| mole | 260 | sine | 0.95 | - | Digby, Gran Burrows (240) |
| dormouse | 700 | sine | 0.9 | [4, 10] | Dormy (sleepy: blips × 0.7) |
| pelican | 380 | sawtooth (lp 1400) | 0.9 | - | Nell |
| hedgehog | 560 | triangle | 1.0 | - | Hazel |
| duck | 480 | sawtooth (lp 1500) | 0.75 | - | Quackenbushes |
| crow | 420 | sawtooth (lp 1800) | 1.2 | - | Rook |
| moth | 900 | sine | 1.05 | [7, 15] | Granny Wick (760), Flick (1000), Wicklings |
| squirrel | 820 | triangle | 1.2 | - | Nutmeg (700), Acornets |
| woodpecker | 640 | square (lp 2000) | 1.0 | - | Pinfeather (each blip doubled 40 ms apart) |
| sloth | 180 | triangle | 0.85 | [3, 5] | Mossmantle (blips × 0.6) |
| otter | 520 | triangle | 1.1 | - | Rafferty |
| octopus | 260 | sine | 0.8 | [5, 12] | Old Gloop |
| goose | 440 | sawtooth (lp 1300) | 0.85 | [20, 12] | Lady Honksworth (louder × 1.5), Goody Gander (× 1.0) |
| mouse | 980 | sine | 1.1 | - | Hayburys |
| scarecrow | 300 | triangle | 1.0 | - | Pennywhistle (a straw rustle `N` 3 kHz under each blip) |
| pill-bug | 240 | triangle | 0.95 | - | Sir Rollo |
| worm | 140 | sine | 0.9 | [3, 6] | Lumbra |
| puffin | 600 | triangle | 1.1 | - | Pell |
| hermit crab | 700 | square (lp 1600) | 1.0 | - | Whelk |
| walrus | 160 | sawtooth (lp 900) | 0.9 | - | Bosun Snore |
| bear | 170 | triangle | 0.9 | - | Scoria |
| newt | 760 | sine | 1.15 | - | Pitch, Lady Fumarole (300) |
| capybara | 230 | sine | 1.0 | - | Soakley (blips × 0.6, never faster) |
| jerboa | 1100 | sine | 1.2 | - | Sable (× 1.4 when excited) |
| beetle | 500 | square (lp 1400) | 1.0 | - | Scarabelle |
| cloud | 640 | sine | 1.0 | [4, 30] | Nimbles |
| star | 1047 (C6) | bell | 1.0 | - | Starkin: each blip a `bell` at a pentatonic note; Brightwell at 523 |
| Wenna | 392 (G4) | bell + choir pad under the line | 1.0 | - | Wenna: soft bell blips on the F-major pentatonic, every 4 characters |
| Mote | 1175 (D6) | glock | 0.95 | - | Mote: glock blips on the D-minor pentatonic, falling |

<a id="stings"></a>

### 14.6 Stings

Short music phrases that duck the track by 60 % for their length. Format: `{ voice, step: seconds, notes: [[midi,
startStep, lenSteps], ...] }`, played on the music bus through `G.audio.sting(name)` (S-028).

| Sting | When | Data |
|---|---|---|
| `sting_wenna` | Wenna speaks first in a scene; Ask the Tree | `{ voice: 'bell', step: 0.22, notes: [[72, 0, 2], [77, 2, 2], [81, 4, 4]] }` |
| `sting_mote` | Mote appears | `{ voice: 'glock', step: 0.2, notes: [[81, 0, 2], [77, 2, 2], [74, 4, 4]] }` |
| `sting_beacon` | a beacon kindled | `{ voice: 'bell', step: 0.16, notes: [[60, 0, 2], [64, 2, 2], [67, 4, 2], [72, 6, 6], [76, 6, 6]] }` |
| `sting_stone` | a Stair Stone set | `{ voice: 'musicbox', step: 0.18, notes: [[67, 0, 2], [72, 2, 2], [76, 4, 2], [79, 6, 2], [84, 8, 8]] }` |
| `sting_lantern` | a crown lantern lights | `{ voice: 'glock', step: 0.14, notes: [[84, 0, 2], [88, 2, 2], [91, 4, 6]] }` |
| `sting_memory` | a memory opens | `{ voice: 'musicbox', step: 0.25, notes: [[72, 0, 2], [76, 2, 2], [79, 4, 2], [77, 6, 2], [76, 8, 6]] }` |
| `sting_side` | a side story completes | `{ voice: 'pluck', step: 0.12, notes: [[72, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 4]] }` |
| `sting_found` | a collectible of a new kind is found the first time | `{ voice: 'glock', step: 0.1, notes: [[79, 0, 1], [84, 1, 3]] }` |
| `sting_act` | an act card appears | the first two bars of `ending` at 0.8 × bpm |
| `sting_tool` | a new tool is held up | shipped `fanfare` (unchanged) |

---

<a id="art-step-checklist"></a>

## 15. Acceptance criteria every art or audio step copies

- Every generated image was made with the full prompt (preamble + kind suffix + subject) from this file, and a row
  per asset was appended to `docs/art/prompts.md`.
- Every new manifest key follows [§3](#keys), sits under `assets/realms/<id>/` with `realm: '<id>'` when it belongs to
  one realm, and has its fallback registered in `js/realms/fallbacks.js`.
- `bun test` passes, including `tests/assets.test.js` (sizes, tags, orphans, fallbacks) and the track validator.
- `npm run test:smoke` passes, and the smoke variant with `?noassets=all` renders the touched realm.
- `tools/build-pages.mjs` passes: core precache ≤ 30 MB, the touched bundle ≤ 2.5 MB (numbers quoted in the PR).
- The realm suite's fixed views for the touched realm stay within the per-view budgets in both cameras.
- For music: `G.debug.audio.current()` names the expected track on entry, `G.debug.audio.layer()` reads the expected
  level for the fixture, and an offline render (`G.audio.render`) of 8 bars is non-silent and does not clip.
- The PR shows a screenshot (or a side-by-side for any replacement) at the land's loading card, one region entry in
  first person, and the map card.
- Pip's GLB is untouched (`git diff --stat assets/models/hero.glb` is empty).
- No generated image resembles another game's character, logo or location; prompts name no other game, studio,
  film or artist.

---

<a id="decisions"></a>

## Decisions made here

CANON leaves these open; this file decides them. Each can be overridden by the owner or by an earlier-authority
file without touching anything else.

1. **Prompt structure**: every image prompt is preamble + kind suffix + subject, and the preamble text in
   [§1.1](#preamble) is fixed.
2. **Generation sizes and ship sizes per kind** ([§1.2](#kinds)): portraits 512², bestiary cards 384², icons 128²
   cells, loading cards 1600×900 (+ 960×540 `lo`), maps 1024², sketches 512×288, terrain 1024 + 512 webp.
3. **White-key processing**: generators return white backgrounds; a soft white-to-alpha one-liner runs before
   `slice_sheet.py`; snow and white subjects are generated on magenta instead.
4. **New tools**: `tools/pack_atlas.py` (S-037) and `tools/make_hood_mask.py` (S-303); `tests/assets.test.js` and
   `js/realms/fallbacks.js` (S-029).
5. **Raw generations are never committed**; the full prompt and commands go to `docs/art/prompts.md`; reference
   turnarounds go to `docs/art/ref/` (outside the precache).
6. **Manifest key naming** ([§3](#keys)), including `card_<id>` for bestiary cards, `actcard_*` for act cards,
   `load_<realm>` for loading cards, and commented-out `models` entries as GLB slots before the GLB exists.
7. **Per-asset size limits** ([§4.1](#bundles)): terrain `_hd` ≤ 110 KB and `lo` ≤ 40 KB, portraits ≤ 60 KB, cards
   ≤ 150 KB, loading cards and maps ≤ 200 KB, owner GLBs ≤ 700 KB and ≤ 12,000 tris (characters ≤ 8,000).
8. **Core precache headroom**: S-307 removes `title.jpg` and `title_fp.jpg` (and their keys) and re-saves DOM-only
   sprites as lossless webp, to keep core ≤ 30 MB; the next lever is moving single-land portraits into bundles.
9. **Bestiary cards and realm portraits load from their land's bundle** when the journal opens; home, travelling and
   recurring cast (24 portraits) and home species cards are core.
10. **All realm palettes** in [§5.3](#palettes) (sky overrides, cloud tints, water, fog per region, the seven layer
    keys) and the `skyFrom` override rule; the Rootdeep and the Starmeadow use a fixed-hour sky.
11. **Variant moods through one grade uniform** (`U.uGrade`, `U.uGradeSat`, no new programs), with the grade values per
    variant in [§5.4](#palettes); home's grade is a no-op.
12. **Dim lands lose their track's signature voice** (`lead2` at layer 0) plus one ambience element, never colour;
    Duskwick stays dim until the Tower lamp is kindled in `ch12`.
13. **Horizon bearings** as degrees (Pinewhistle 330, Archwater 115, Duskwick 155, Threemills 245, Kettle 65,
    Saltglass 200) and the night-window points per card, unless `./atlas-home.md#sky` says otherwise.
14. **Hood trims tint the hood only** through a texture-space hue mask times a height band (sprout excluded), third
    person only; the six trim names and hexes in [§8.3](#hood-trims).
15. **Young cast scales and tints** per [§8.4](#young-cast), including a sea-green bandana over young Pinch's baked-in
    hat.
16. **Lamplighter kit palette and piece list** ([§9.2](#lamplighter-kit)), and the ART BRIEF example `kit_bench`.
17. **Music grammar extensions**: `counter`, `arp2`, `layers` / `startLayer` / `G.audio.layer`, `transpose` (bass
    floor MIDI 36), variants (`from`, `voices`, `drop`, `add`), stings, ambience `drone` / `tones` / `dim`.
18. **Eight new voices** (marimba, windflute, fiddle, accordion, cello, musicbox, choir, brass) and **six new
    percussion letters** (`w a p d c e`), with their exact synth recipes.
19. **Leitmotifs**: Wenna rising 5-1-3, Mote falling; both in `given_light`.
20. **The village layers are count-keyed**: 0 seeds = melody, bass, shaker; +stabs; +harp arpeggio; +flute
    countermelody and sparkle at 3 seeds and after the bloom. At 0 seeds the shipped stabs and sparkle are held back.
21. **One shared dungeon track** (`depths`) with per-dungeon variants, one Warden track (`warden`) with per-Warden lead
    voices, `hush` for the bell duel, `exam` for Scarabelle, `chase` for Mote; the Jamboree keeps the shipped `boss`.
22. **Every track's note data** in [§12.5](#track-data) (keys, tempos, chords, melodies).
23. **Ambience beds per region** and the 18 new ambience one-shots ([§13](#ambience)).
24. **SFX recipes** for tools, puzzles, world progress, creature wind-ups and the calmed-boss sigh; NPC voice blips
    per species; stings ([§14](#sfx)).
25. **Act card art**: Act One keeps `ending_art` (then `ending_art_v2`); new `actcard_2`, `actcard_3`, `actcard_4`,
    `actcard_true`; S-307's new title `title_fp_v3` is `eager`, with `title_fp_v2` as its fallback.
26. **Loading-card tips**: four per land, ≤ 120 characters, written in S-308 in `js/text/en/tips.js`; never a puzzle
    solution or a twist.
27. **Glassway water clarity** 0.85 (floor visible to 3 m) as a new water uniform in S-202.
28. **Rootdeep glow rule**: at least one emissive source within 25 m of every walkable cell, proved by the coverage test.
29. **Mote's bestiary entry** sits under a "Friends" heading with no poof count.
