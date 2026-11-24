# Cast: every named character

Every named character in *Starseed Isle: The Hundred-Year Letter*: who they are, what they look like, how they talk,
where they stand in every land and at every hour, what happens to them across the four acts, which side stories they
own, and the art an implementation step makes for them (a painted portrait, a reference sheet, a code-built toon model,
and an ART BRIEF so the owner can batch-generate a painted GLB later and drop it in through the manifest with no code
change).

Order of authority: `CANON-NOW.md` LOCKED items > `CANON.md` > this file > a step issue. Shipped names, looks,
voices and home-island spots are LOCKED and are restated here, never changed.

What this file does **not** hold:
- Boss moves, HP, telegraphs, arenas and plushie stats: [creatures.md](./creatures.md) (e.g.
  [creatures.md#boss-rollo](./creatures.md#boss-rollo)). This file owns every boss's *look, voice, model and life
  after the fight*.
- Scene scripts, handover lines, count-keyed line matrices and memory lines: [story.md](./story.md).
- Side-story steps, dialogue and rewards: [side-content.md](./side-content.md) (`#ss-01` to `#ss-53`, `#act-*`).
- Lore texts (Dormy's night stories, the bottles, the memories): [lore.md](./lore.md).
- Interiors, post-passes and exact home anchors other than NPC spots: [atlas-home.md](./atlas-home.md); land layouts:
  [atlas-isles.md](./atlas-isles.md), [atlas-far.md](./atlas-far.md).
- The style preamble, processing pipeline and bundle budgets: [art-audio.md](./art-audio.md#style),
  [art-audio.md#brief-template](./art-audio.md#brief-template).
- Tone, voice and reserved speech markers: [charter.md#tone](./charter.md#tone),
  [charter.md#reserved-markers](./charter.md#reserved-markers).

Headings match the anchors that `INDEX.md` cites (`cast#home`, `cast#catchers`, `cast#nell`, `cast#young-cast`,
...). Do not rename a heading without updating every link (S-001's docs test fails on a dead anchor).

---

## Conventions

### Entry template

Every character entry uses these fields, in this order. A step copies the fields it needs into its issue verbatim.

| Field | Meaning |
|---|---|
| **id** | The NPC id used by `npcDef(id)`, dialogue tables (`npc: '<id>'`), schedules and text ids (`<realm>.npc.<id>.*`). Lower case, no spaces. LOCKED for the six shipped villagers |
| **Species · height** | Height in metres, feet to the top of the head (ears and hats included, noted). Pip is 1.0 m; FP eye 0.88 m |
| **Palette** | Role → hex. The first three hexes are the silhouette colours a thumbnail must read by |
| **Look** | What the model and portrait show, and what reads in first person from 2.5 m at eye height 0.88 m |
| **Voice** | Speech shape and the one **tic** (marker), plus at most three signature lines. Full dialogue lives in story.md and side-content.md |
| **Sound cue** | The ambient sound that lets a player find them by ear, with its visual twin (charter first-person rule 5) |
| **Spots** | Spot ids per land (`W.npcSpots` keys) and where each is |
| **Schedule** | F27 rows `[fromHour, spotId, activity]` (activities: `stand`, `wander:<r m>`, `sit`, `work`, `sing`, `watch`, `doze`, `sleep`, `indoors`) |
| **Arc** | What changes for them in each act |
| **Owns** | Side stories and activities they give (links). "Appears in" lists the ones they only take part in |
| **Portrait** | Manifest key, file path, realm tag, and the image prompt |
| **Model** | The code-built rig used today, and the ART BRIEF for the owner's GLB |

### Portraits (one per named character, two to four for Wenna and Mote)

- **Use:** the dialogue frame shows the speaker's portrait at the frame's left when the key is loaded; otherwise the
  frame shows the name only (shipped look). Journal People entries reuse it. Systems: [systems.md#dialogue](./systems.md#dialogue).
- **Generate:** 1024 × 1024, transparent background, through a GPT Sol subagent (Codex `image_gen.imagegen`) or a
  Gemini model. If the tool returns an opaque image, regenerate on a flat `#ff00ff` field and remove that colour
  (PIL: alpha 0 where the pixel is within 40 of `#ff00ff`, then a 1 px alpha erode) before processing.
- **Process:** save the raw as `part_00.png` in a scratch folder, then
  `python3 -I tools/export_sprites.py <scratch> <scratch>/out part_00=portrait_<id>:480` (trims, keeps aspect, pads
  2 px), paste centred on a transparent 512 × 512 canvas, and save as webp quality 82 (PIL `save(..., 'WEBP',
  quality=82, method=6)`). Target ≤ 60 KB; drop to quality 75 if larger.
- **Files and keys:** home and travelling cast (no realm tag, core precache): `assets/portraits/<id>.webp`, key
  `portrait_<id>`. Land cast: `assets/realms/<realm>/portraits/<id>.webp`, key `portrait_<id>` with
  `realm: '<realm>'`. Fallback for every key: no image, name only.
- **Prompt shape:** the house preamble from [art-audio.md#style](./art-audio.md#style), then the character prompt given
  in each entry, then the framing suffix below. If the preamble is not yet written, use this one verbatim:

> *House preamble:* Soft painterly storybook illustration for a cosy children's 3D adventure game, gouache and
> watercolour texture with visible soft brush strokes, warm gentle light with a soft rim light, rounded chunky
> shapes, oversized head and small body, clean readable silhouette, saturated-but-soft palette, friendly expression,
> an original character design, no text, no logo, no border.
>
> *Portrait suffix:* Head-and-shoulders bust, three-quarter view turned slightly to the left, eyes toward the viewer,
> centred with an 8 % margin, fully transparent background.

- **Reference sheets** (not shipped): each character's step also generates a turnaround with the same preamble plus
  *"Character turnaround reference sheet: front, three-quarter, side and back views in one row, full body, neutral
  standing pose, flat light grey background, the same scale in every view, 2048 × 1024."* It is saved as
  `docs/art/refs/<id>_turnaround.webp` (docs only, never under `assets/`, so never precached) and is linked from the
  GLB brief. Generated art must be original: never name or imitate another game, film or brand in a prompt.

### Models

- **Code-built first.** Every character ships as a procedural toon rig in `js/models.js` (the shipped `npcDef` style:
  `GB` primitives `lathe / sphere / cone / cyl / torus / capsule / rbox / box / tube`, outlined toon material, `INK`
  `#2a1a12` for eyes and mouths, rig parts `body`, `head`, `armL`, `armR`, `extra`). The animation code only moves
  those parts (idle bob, head turn to Pip, arm wave on talk), so a static GLB also works.
- **Rig families, data-driven.** To keep each NPC step under ~500 changed lines, a new character is a **look record**
  (`NPC_LOOKS[id] = { rig, h, pal: {...}, acc: [...] }` in `js/content/looks.js`) read by one `npcDef` case per rig
  family below. A family is built once (its first user's step) and every later user is data only.
- **GLB drop-in.** Every entry names a manifest key (`npc_<id>` for people, `boss_<id>` for Wardens and bosses) with a
  `height`. `makeModel(key)` uses the GLB when it is in the manifest and loaded, and the code rig otherwise. GLB
  requirements for the owner: feet at y = 0, facing +Z, metres, one root; optional child nodes named `head`, `armL`,
  `armR` are animated if present; ≤ 6,000 tris and one 1024² texture for people (≤ 450 KB), ≤ 12,000 tris and one
  1024² texture for Wardens (≤ 700 KB), ≤ 2,500 tris for small folk under 0.6 m.
- **ART BRIEF** fields follow [art-audio.md#brief-template](./art-audio.md#brief-template). In this file each brief
  gives: silhouette, size, palette, materials, pose and animation, poly budget, a 2D prompt (the turnaround), a 3D
  prompt, and the procedural fallback. The 3D prompt always starts with this preamble:

> *3D preamble:* Stylised toon game character for a cosy children's adventure, chunky rounded proportions, big head,
> hand-painted texture with soft gradients, no fine detail smaller than 2 cm, clean silhouette, single watertight mesh,
> neutral standing pose facing forward, feet on the ground plane.

#### Rig families

| Rig | Built in | From | Parts and parameters | Users |
|---|---|---|---|---|
| `frog` | shipped | `npcDef('ribbit')` | lathe coat, sphere head with top eyes; hat, monocle optional | Mayor Ribbit, Puddle |
| `bunny` | shipped | `npcDef('clover')` | lathe body, long capsule ears, scarf torus | Clover, Primrose, the four kits |
| `turtle` | shipped | `npcDef('shellby')` | lathe robe, shell sphere, beard cone optional | Elder Shellby (code fallback), young Shellby |
| `cat` | shipped | `npcDef('miso')` | lathe body + apron, striped tail tube, cone ears | Miso (fallback), Kinako, Granny Mochi |
| `owl` | shipped | `npcDef('hoot')` | round body, gown cone, wing arms | Professor Hoot |
| `mole` | shipped | `npcDef('digby')` | lathe overalls, round head, pink nose | Digby, Gran Burrows, the burrowers |
| `moth` | S-088 | new | round fuzzy body, collar ruff torus, two wing pairs as thin `rbox` plates on `armL/armR` (flap = arm rotation), feathery antennae (two `tube`s with 5 cone barbs), wing tails optional | Granny Wick, Flick, the Wicklings, the Lamplighters, young Granny Wick |
| `bird` | S-068 | new | pear body, head sphere, beak (cone or lathe pouch), wing arms, webbed or twig feet; params `beak: 'pouch'|'cone'|'chisel'|'flat'|'parrot'` | Nell (pouch), Pinfeather (chisel), Rook (cone), Postmistress Pell (parrot), the Quackenbushes and Goody Gander (flat) |
| `rodent` | S-099 | new | lathe body, round head, round or long ears, tail `tube` with a fluff option; params `ears`, `tail: 'bush'|'thin'|'tuft'|'none'`, `spines` (cone shell for a hedgehog) | Elder Nutmeg and the Acornets, Grandpa Dormy, Hazel Thimble, the Hayburys, Sable, Soakley (no tail, wide body) |
| `otter` | S-120 | new | long lathe body, small round ears, thick tapered tail tube, whisker boxes | Skipper Rafferty, the rafters, Bosun Snore's seals (no ears, flipper arms) |
| `bear` | S-225 | new | wide lathe body, round ears, short arms, apron | Master Scoria |
| `newt` | S-225 | new | upright lathe body, wide flat head, long tail tube, spotted `colorFn` | Pitch; Lady Fumarole at boss scale |
| `starkin` | S-090 | new | emissive capsule body (`glow: 1`), soft round face disc with two dot eyes, additive glow sprite, optional cloak shell | Mote, the Twinklings, Old Mother Brightwell |
| `nimble` | S-266 | new | 5-7 merged spheres, dot eyes, two stub feet | the Nimbles |
| one-offs | each step | new | own case | Pennywhistle, Mr Whelk, Tutor Scarabelle, Sir Rollo, the Wickwork Moth, Lumbra, Pelagia, Old Gloop, Lady Honksworth, Mossmantle, Great-Aunt Flurry, Bosun Snore |

### Size chart

| Height | Who |
|---|---|
| 0.12-0.3 m | Puddle (0.12 m at the well, the same model in his grotto) |
| 0.35-0.6 m | Dot, Clem, Sorrel, Bramble, the Haybury kits, the shroomlet nephews, Pitch, Flick, the Twinklings, Mr Whelk, the Quackenbush ducklings |
| 0.6-0.95 m | Grandpa Dormy, Hazel Thimble, Sable, Rook, Postmistress Pell, Granny Mochi (stooped), Elder Nutmeg, Granny Wick, Professor Pinfeather, the Wicklings, the Hayburys, the Nimbles, the adult ducks |
| 0.95-1.2 m | Pip (1.0), Mote (1.0, hovers 0.2 m up), the six villagers, Primrose, Kinako, Gran Burrows, Skipper Rafferty, Soakley |
| 1.2-2.0 m | Nell (1.35), Goody Gander (1.4), Pennywhistle (1.8), Master Scoria (1.9) |
| 2.0-4.5 m | Tutor Scarabelle (2.2), Sir Rollo (2.4), Bosun Snore (2.4), Captain Pinch (2.6), Pelagia (3.0), Grumble Shroom (3.2), Lady Honksworth (3.2), Frostbun (3.4), Mossmantle (3.6), Old Gloop (4.0), the Wickwork Moth (4.0 span), Lady Fumarole (4.4) |
| 5 m and up | Great-Aunt Flurry (5.2), Old Mother Brightwell (6.0), Lumbra the Long (14 long), Hummock (an islet), Wenna (19.8) |

First-person rule for big characters: the talk point is in front of the face, and the talk camera tilts up to the face
(no roll). Any character taller than 2.5 m gets a `talkAt` offset in its look record (a point 2.5-4 m in front of
its face), so the prompt pill appears where the player is looking.

### Spots and schedules

- **Spot ids** are `<realm>.<name>` and become `W.npcSpots` anchors. Home spots are given here as coordinates (seed
  7151, x east, z south, north is −z; placed nearest-walkable by a home post-pass on its own RNG). Spots on other
  lands are named here by place; the atlas files give their coordinates. If an atlas file places a spot under a
  different name, its coordinate wins and the id here becomes an alias.
- **Schedules** run from F27 ([systems.md#schedules](./systems.md#schedules)). Hours are the in-game clock `S.tod`.
- **Act I is frozen.** The six shipped villagers stay on their shipped spots at every hour until the flag
  `wennaAwake` (I.6), so `test:playthrough` and the shipped tests see exactly today's world. Their schedules start
  after it.
- **Indoors fallback.** A schedule row `indoors` places the NPC inside its interior. If that interior is not built
  yet, or a quest step currently points at this NPC, the NPC stands at its door spot instead. Nothing is missable
  (charter Always 8): the journal's People tab always says where each person is right now.
- **Night content repeats every night**, and a bench with the Starsong turns day to night, so night-only people (Grandpa
  Dormy) are never missable.

### Voice summary (new speech markers to reserve)

Each tic below is new and must be added to [charter.md#reserved-markers](./charter.md#reserved-markers) in the PR that
first ships the character. Shipped markers are listed there already.

| Character | Marker (reserved) |
|---|---|
| Wenna | notices one small thing about Pip in most lines ("You have a leaf in your hood."); often opens with "Oh." (not lint-reserved: other speakers may say "Oh") |
| Grandpa Dormy | a yawn inside the sentence: "...hwaaah..." |
| Nell Pelliwick | "...eventually." at the end of a promise; fish as units ("two mackerels' time") |
| Hazel Thimble | baking measures: "a pinch of", "a cup of", "proved and ready" |
| Granny Mochi | "Mm-hm." and calls everyone "kitten" |
| Primrose Thistledown | counting her kits: "One, two, three... four. Good." |
| Puddle | "(tiny voice)" stage direction before every line; a tiny "ribbit" once |
| The Quackenbushes | five ducks finishing one sentence, one word or phrase each, then "Quack." |
| Rook | "Called it!" |
| Granny Wick | "Hm. Hm." while she pinches out and relights a candle |
| Flick | "Can I light it?" |
| The Wicklings | yawns: "...mmh..." (drowsy until the Tower is lit, then "Bright, bright!") |
| The Wickwork Moth | "Tik. Tik." before a line; recites rules by number ("Rule the first: keep the lamp.") until rewound |
| Elder Nutmeg | "For safekeeping!" |
| Professor Pinfeather | "Tok." before a correction |
| Mossmantle | very slow sentences with "...mm..." between words |
| Skipper Rafferty | bursts into song mid-line, marked "(sings)": "(sings) Oh the Raft, the Raft, she floats when she oughtn't..." |
| Old Gloop | "Blub." and counting on arms ("arm three agrees") |
| Goody Gander | "There, there." |
| The Hayburys | Pa Barley: "Right as rain."; Ma Poppy: "Mind the pies." |
| Pennywhistle | three whistled notes "Fwee-fwoo-fwee." and "Pardon my straw." |
| Gran Burrows | "Heard it." (after any of Digby's jokes) |
| Lumbra the Long | "Mmm, loamy." and sentences joined with "and-so-on" |
| Postmistress Pell | "Stamped!" |
| Mr Whelk | "Rare. Very rare." |
| Pelagia | pairs of words; "Ting." |
| Bosun Snore | "...zzzrk..." inside the line |
| Hummock | "(from below)" stage direction, slow "mmmrrr" |
| Master Scoria | one-word verdicts: "Good." "Again." "Clang." |
| Pitch | "Hot hot hot!" |
| Soakley | "No rush." |
| Lady Fumarole | "Darling." and a steam sigh "Hffff." |
| Sable | "A POT! ...Oh. A rock." pattern |
| Tutor Scarabelle | "Pencils down." and "Time!" |
| Mote | counting what he has: "Forty-one fireflies, three sparks..." |
| The Nimbles | no words: "(toot)", "(toot toot)" |
| Old Mother Brightwell | ends with "...little light." |
| The Twinklings | speak as one, in rhyming pairs |

---

<a id="home"></a>
## Home

The people of Starseed Isle. Spots are seed-7151 coordinates. LOCKED spots are the shipped ones; every other home spot
is new and is placed by the home post-pass `placePortals` / `placeNpcSpots` on its own RNG (see
[atlas-home.md#passes](./atlas-home.md#passes)), nearest walkable to the anchor given, never moving a shipped thing.

| id | Name | Species · h | Day spot | Lives | Owns |
|---|---|---|---|---|---|
| `hero` | Pip | island kid · 1.0 | (player) | Pip's Nook | - |
| `wenna` | Wenna, the Great Tree | Starkin rooted as a tree · 19.8 | pedestal (0, 7.3) | the plaza | ss-14, ss-53 |
| `shellby` | Elder Shellby | turtle · 1.15 | (−3.8, 6.4) LOCKED | his bench | ss-09, ss-13 |
| `ribbit` | Mayor Ribbit | frog · 1.15 | (−11, 3.5) LOCKED | the village pond | ss-04, ss-10, Village Works |
| `miso` | Miso | cat · 1.1 | (13.2, 13.0) LOCKED | Miso's back room | ss-03, ss-41, plushies |
| `clover` | Clover | bunny · 1.0 (1.2 with ears) | (0.7, 56.0) LOCKED | cottage 5 | ss-23, Clover's Dash |
| `hoot` | Professor Hoot | owl · 1.1 | (4.3, −61.6) LOCKED | Hoot's study | ss-52, Vista Sketches |
| `digby` | Digby | mole · 1.0 | (−103.1, −3.3) LOCKED | his burrow by the windmill | ss-01 |
| `dormy` | Grandpa Dormy | dormouse · 0.7 | cottage 1 | cottage 1 | ss-02, ss-51 |
| `nell` | Nell Pelliwick | pelican · 1.35 | Nell's Jetty | cottage 2 | Fishing |
| `hazel` | Hazel Thimble | hedgehog · 0.8 | cottage 3 | cottage 3 | ss-05 |
| `mochi` | Granny Mochi | cat · 0.9 | cottage 4 | cottage 4 | (ss-03 broker) |
| `primrose` | Primrose Thistledown | bunny · 1.05 | cottage 5 | cottage 5 | ss-08 |
| `puddle` | Puddle | frog · 0.12 | the well (9, −7.5) | Puddle's Grotto | ss-07 |
| `ducks` | the Quackenbushes | ducks · 0.45-0.7 | Meadow pond | Meadow pond | ss-06, Duck Regatta |
| `kinako` | Kinako | cat · 1.1 | Kinako's Floating Bazaar | the bazaar boat | ss-18 |
| `rook` | Rook | crow · 0.85 | travelling | a nest on Gull Rock (Glassway) | ss-49 |

Cottage doors (LOCKED door lines stay until each resident is met; then the door becomes a portal, `placePortals`):
cottage 1 house_a (−16, −14), door (−14.1, −12.3), Dormy · cottage 2 house_b (15, −16), door (13.3, −14.1), Nell ·
cottage 3 house_a (−18, 13), door (−15.9, 11.5), Hazel · cottage 4 house_b (24, −6), door (21.5, −5.4), Granny
Mochi · cottage 5 house_a (−25, −3), door (−22.5, −2.7), the Thistledowns.

### Pip

- **id** `hero` (player, not an NPC). **Species · height** an ordinary island kid · 1.0 m; FP eye 0.88 m. He.
- **Palette (LOCKED, code fallback):** hood greens `#7aa63a` / `#8fbf45`, skin `#ffdcbf`, tunic cream `#f3e3c3`,
  belt brown `#7a4a2e`, sprout `#8fd14f`, buckle gold `#f5c040`.
- **Look (LOCKED):** leaf-green fox-eared hood with a two-leaf sprout on top, brown bangs, cream tunic, brown belt
  with a gold buckle, green capelet with a leaf clasp, boots, steel one-piece sword (split arm `armR`). Shiny Sword:
  gold guard, blue grip, pink pommel. Starsteel Sword (sword level 3, [ss-38](./side-content.md#ss-38)): pale
  blue-white blade `#dfefff` with a faint gold spiral etched near the guard `#f2c94c`, guard of dark bronze `#6b4a2e`.
- **Voice:** none. Pip never speaks (charter). He writes once: the 13th letter (ch22).
- **What people call him:** "Pip", "little Pip", "dear", "little sprout" (Shellby, "dear" + "little sprout"), "lad"
  (Captain Pinch only), "sprout" (any villager), "kitten" (Granny Mochi only), "young lamplighter" (Granny Wick, from
  the first beacon), "rival" (Rook only), "student" (Tutor Scarabelle only), "little light" (Brightwell only).
- **Background:** an ordinary Sprout Village kid the whole village had a hand in bringing up; Shellby knitted the hood
  and sewed on the sprout "so the Tree would know you"; Miso sold him his first sword at a discount she still denies;
  Hazel feeds him buns. His den in a hollow of Wenna's roots became Pip's Nook ([lore.md#pip](./lore.md#pip)). No
  foundling story, parents or prophecy is ever told (CANON §15.9).
- **Home:** Pip's Nook, his room in Wenna's roots ([atlas-home.md#pips-nook](./atlas-home.md#pips-nook)). He wakes by
  the Tree when he gets dizzy.
- **Model (LOCKED):** `assets/models/hero.glb`, never replaced, never regenerated. **Hood trims** tint only the hood
  material in third person ([art-audio.md#hood-trims](./art-audio.md#hood-trims)); shown side by side to the owner first.
- **Portrait:** none is generated for dialogue (Pip never speaks). The journal's cover and the save card use a render
  of the GLB (an in-page snapshot), not a generated image, so the owner's art stays the only Pip.

<a id="wenna"></a>
### Wenna

- **id** `wenna`. **Species · height** the littlest Starkin, fallen, caught by the sea and rooted; the Great Tree,
  19.8 m (LOCKED). She. Only the oldest characters say "Wenna" (charter: who may say which name); UI always says "the
  Great Tree".
- **Palette:** bark `#8a5a3c` / `#6b4a33`, leaf `#7aa63a` / `#9bd46a`, blossom pink `#f7b6c8` / `#ffd9e4`, spiral and
  awake eyes soft gold `#ffe9a8`, dialogue frame gold `#f2c94c` on cream `#fff8e6`, cheek blush `#f4a6a6`.
- **Look:** the shipped Great Tree GLB (`great_tree.glb`, `great_tree_bloom.glb`) with a **face** on the south side of
  the trunk, facing the pedestal: a spiral on her brow (LOCKED from the key art), two closed crescent eyes, a small
  mouth, faint blush. Awake, her eyes open as soft gold ovals with a white catch-light. The face is a decal (a curved
  plane child mesh, no collider, prints unchanged), centred on the trunk's south side at about one-sixth of the tree's
  height (≈ 3.3 m), 2.4 m wide, set 2 cm proud of the bark; the step measures the trunk radius there.
- **Face states (decal textures):** `sleep` (Act I and night after bedtime), `awake` (default after `wennaAwake`),
  `scrunch` (the sneeze wind-up: eyes squeezed, nose wrinkled; shown 2 s before every sneeze so the player learns it),
  `smile` (count beats, blossom, endings), `tired` (half-open eyes; Act II end to ch21 while the Ladder pulls at her).
- **Voice:** gentle, tired, funny when rested; asks, never commands ("Will you find out for me?"). Tic: opens a thought
  with "Oh." and notices one small thing about Pip. Signature lines (CANON): "...Pip. Little Pip. I can see you." /
  "Someone is putting out the lights. I don't know who. Will you find out for me?" / "I'm still here." Her ~60
  pedestal lines are in [story.md#wenna-lines](./story.md#wenna-lines). She voices Ask the Tree after `wennaAwake`.
- **Sound cue:** a low two-note hum when Pip is within 12 m of the pedestal after `wennaAwake`, with a soft gold
  shimmer on the face decal (visual twin).
- **Spots:** `home.pedestal` (0, 7.3): `[E] Talk · the Great Tree` at any hour after `wennaAwake`. In the Crown
  (ch20-21) her voice comes from the four bough lanterns. In the Hundred-Year Night she speaks from the pedestal.
- **Schedule:** none (a tree). Face state by hour: 06-21 `awake`, 21-06 `sleep` (talking at night wakes her: first
  line "Oh. Is it morning? ...No. Hello anyway.").
- **Arc:** Act I asleep (sneeze, bloom) → I.6 wakes and asks Pip to find out who is putting out the lights → Act II
  worries, counts beacons with him; small sneeze at Act II end → Act III frightened of what she has forgotten; asks to
  see her brother "properly this time"; the memories show she *chose* to stay (T5) → Act IV the Ladder pulls at her;
  the Second Sneeze; "Every hundred years. Keep a hanky handy." → ch22 Wenna says her one line about Pip ("This time it was you.").
- **Owns:** [ss-14 The Fourth Bough](./side-content.md#ss-14), [ss-53 The Planting](./side-content.md#ss-53).
  Appears in: every main chapter from I.6.
- **Portrait:** `portrait_wenna`, `assets/portraits/wenna.webp`, core. Prompt: *"The friendly face of an ancient
  gentle tree, seen close: warm brown bark with soft moss, a glowing pale-gold spiral carved on her brow, two kind
  soft-gold eyes with white catch-lights, a small warm smile, faint pink blush, pink blossom sprigs and tiny hanging
  lanterns at the frame's top edge, feminine and grandmotherly but young-hearted."*
- **Face decals:** one generated 2 × 2 sheet, 1024 × 1024, transparent: *"Four painted facial expressions for the same
  gentle tree face on bark, arranged in a 2 × 2 grid, each face alone on transparent background, each with a pale-gold
  spiral on the brow: top-left asleep with closed crescent eyes and a tiny smile; top-right awake with soft gold oval
  eyes and a warm smile; bottom-left scrunched up about to sneeze, eyes squeezed and nose wrinkled; bottom-right
  beaming, eyes closed in happy arcs, blushing."* Plus one extra 512² for `tired` (*"half-open drowsy soft-gold eyes,
  a small tired smile"*). Slice with `python3 -I tools/slice_sheet.py sheet.png <dir>` and export each at 512² webp:
  keys `wenna_face_sleep`, `wenna_face_awake`, `wenna_face_scrunch`, `wenna_face_smile`, `wenna_face_tired` (core).
  **Fallback:** a canvas-drawn face: two `INK` arcs (closed eyes) or two gold ovals, a small arc mouth, a gold spiral
  drawn as an Archimedean curve (3 turns, 0.5 m), two pink blush ellipses.
- **ART BRIEF `great_tree_face` (owner):** the owner may later paint the face into a `great_tree_awake.glb`; until
  then the decal is the face. Silhouette unchanged (LOCKED); the face region must stay a smooth 2.4 × 1.8 m bark patch
  so decals sit flat. No new GLB is required by any step.

### Elder Shellby

- **id** `shellby` (LOCKED). **Turtle · 1.15 m** (GLB `npc_turtle`, height 1.15). He. About 110 years old.
- **Palette:** skin `#a8b860`, shell moss `#7aa63a`, shell brown `#8a6a3a`, shell rim `#6a4a28`, robe leaf green
  (GLB) / cream `#f0e2c0` (code fallback), beard and brows `#faf6ec`, staff `#8a5a30`, staff leaf `#7cc048`.
  Hanky (ch22): cream `#fff8e6` with a gold spiral `#f2c94c` in one corner and a green leaf hem `#7aa63a`.
- **Look (LOCKED):** old turtle, mossy shell with little mushrooms, long white beard and brows, leaf-green robe, crook
  staff with a leaf. From ch22 the hanky pokes out of his robe pocket (a 0.08 m cream `rbox` on the GLB root).
- **Voice (LOCKED):** warm grandparent; "dear" + "little sprout" together is his marker; calm, practical directions.
  New: "My house is on my back, dear." (why he has no cottage). Goes very quiet at Mote's name ("...Mote. Oh, dear.").
- **Sound cue:** a slow wooden *tock* of his staff every 3 s while he walks (Slow Walk), a small leaf flutter on the
  staff as the visual twin.
- **Spots:** `home.shellby_altar` (−3.8, 6.4) LOCKED · `home.shellby_bench` = the Sprout Village Lamplighter bench,
  anchor (−6, 10) · in memories 4-6 and 10-12 as young Shellby ([#young-cast](#young-cast)) · Glassway, the Sunken
  Bell's ledge with Pelagia during and after [ss-09](./side-content.md#ss-09) (spot `glassway.bell_ledge`, 18:00-20:00
  only, once ss-09 is complete) · the Hundred-Year Night: on his bench.
- **Schedule (after `wennaAwake`):** `[[7,'home.shellby_altar','stand'],[18,'home.shellby_bench','sit'],
  [22,'home.shellby_bench','doze']]`. He never goes indoors. Dozing he still talks (sleepy first line: "Mm? Oh, it's
  you, little sprout.").
- **Arc:** keeps a kind secret. Act I tells the myth in instalments (lines in [story.md](./story.md)); I.1 gains "The
  guardians are older than they look. Be gentle, and they'll be gentle back." Act II: very quiet at II.M. Act III:
  memories show a tiny turtle in a too-big hat earning the seeds; "Old Friends" with Pelagia, his best friend from that
  summer, who he has not visited in eighty years because he was "too slow to sail". After memory 12 he is quieter
  (S-260). ch22: "I wrote that letter, you know. The bottle. I was about your size. ...It was your turn, dear." Gives
  Pip his hanky. The Night stays revisitable from his bench.
- **Owns:** [ss-09 Old Friends](./side-content.md#ss-09), [ss-13 Shellby's Slow Walk](./side-content.md#ss-13).
  Appears in: ss-10, ch22, Ask the Tree (voice until `wennaAwake`).
- **Portrait:** `portrait_shellby`, core. *"A very old, kind turtle grandfather with a mossy green-and-brown shell
  sprouting tiny mushrooms, a long flowing white beard and bushy white eyebrows, soft olive skin, a leaf-green robe,
  holding a wooden crook staff with a single green leaf, gentle closed-eye smile, rosy cheeks."*
- **Model:** GLB `npc_turtle` exists (keep). Code fallback `npcDef('shellby')` (shipped). No new brief.

### Mayor Ribbit

- **id** `ribbit` (LOCKED). **Frog · 1.15 m** (to the top-hat crown). He.
- **Palette (code):** skin `#8cbf4a`, belly `#f4e8b0`, coat maroon `#8a2f2a`, bow `#d83a3a`, buttons and monocle gold
  `#f5c040`, top hat `#4a3028` with a red band `#d83a3a`, blush `#ff9f9f`. Sea-sick green for ss-04: `#b8d070`.
- **Look (LOCKED):** frog in a maroon coat with gold buttons, red bow, gold monocle, brown top hat with a red band.
  For [ss-04](./side-content.md#ss-04) he adds a striped life ring `#ffffff` / `#d83a3a` round his middle (an `extra`
  torus, 0.32 m) and keeps it on for the rest of the game "just in case".
- **Voice (LOCKED):** pompous-sweet civic booster; markers "Ribbit!", "Croak.", "I hereby declare...". Afraid of deep
  water, which he admits only to Pip, in ss-04. Ch7 speech: "I hereby declare this jetty... jettied."
- **Sound cue:** a short practice croak every 20-40 s by day, a throat-bubble puff as the visual twin.
- **Spots:** `home.ribbit_plaza` (−11, 3.5) LOCKED · `home.ribbit_pad` the village pond bank, anchor (−13, 25)
  ("Best lily pad in town", LOCKED line, now literal: a lily pad prop 0.9 m wide on the pond) · Nell's Jetty
  (`home.jetty`, anchor (−14, 126)) for the ch7 speech only · Threemills, the top of Middle Mill
  (`threemills.middle_mill_top`) during and after ss-04 at 12:00-14:00 on festival days · the Crown (ch21 lantern
  chain) · the ending festival (plaza).
- **Schedule (after `wennaAwake`):** `[[7,'home.ribbit_plaza','wander:4'],[19,'home.ribbit_pad','sit'],
  [23,'home.ribbit_pad','sleep']]`.
- **Arc:** a frog afraid of deep water who runs an island in the sea. Opens the jetty (ch7); runs **Village Works**
  (8 projects × 250 gems, [atlas-home.md#village-works](./atlas-home.md#village-works)); "The Mayor Goes to Sea"
  (sails to Threemills, sick the whole way, gives the best speech of his life from Middle Mill); hosts the act-end
  festivals and the ending festival; his victory croak still works (LOCKED).
- **Owns:** [ss-04 The Mayor Goes to Sea](./side-content.md#ss-04), [ss-10 The Parcel With No Name](./side-content.md#ss-10)
  (the parcel arrives at the Mayor's "lost property office": a crate by his plaza spot). Village Works.
- **Portrait:** `portrait_ribbit`, core. *"A round, proud, cheerful green frog mayor with big golden eyes, a gold
  monocle on one eye, a tall brown top hat with a red band, a maroon frock coat with shiny gold buttons, a red bow at
  the throat, cream belly, rosy cheeks, chest puffed out mid-announcement."*
- **ART BRIEF `npc_frog` (owner GLB, batch 03):** silhouette: wide pear body, eyes on top of the head, tall top hat (a
  hat is a third of his height). 1.15 m. Palette above. Materials: matte skin, felt hat, wool coat, metal-gold monocle
  and buttons (flat colour, no metalness). Pose: standing, chest out, one hand on the coat lapel. Anim nodes `head`,
  `armL`, `armR`. ≤ 6,000 tris, one 1024² texture. 2D: the portrait prompt as a turnaround. 3D: *"[3D preamble] a
  plump green frog mayor, eyes on top of his head, maroon frock coat with gold buttons, red bow tie, gold monocle,
  tall brown top hat with a red band, cream belly, short frog legs with wide feet, 1.15 m tall including the hat."*
  Fallback: shipped `npcDef('ribbit')`.

### Miso

- **id** `miso` (LOCKED). **Cat · 1.1 m** (GLB `npc_cat`). She. Twin sister of Kinako; granddaughter of Granny Mochi.
- **Palette (code):** orange tabby `#f5a050` with stripes `#d9783a`, cream `#fff0d8`, apron green `#6f8f3a`, sprout
  emblem gold `#f5c040`, bandana cream `#fff3e0`, inner ears `#ffb8c0`.
- **Look (LOCKED):** orange tabby, happy closed eyes `^^`, cream bandana, green apron with a sprout emblem. A sewing
  needle with green thread is tucked in her bandana from M08 (when plushies of new characters start).
- **Voice (LOCKED):** "Mrrow~", "purr", tildes, cat puns; "nothing is refundable". `~` is hers alone.
- **Sound cue:** a purr loop within 6 m of the counter, a little paw-wave as the twin.
- **Spots:** `home.miso_counter` (13.2, 13.0) LOCKED · `home.miso_backroom` (interior "Miso's back room", door at the
  shop's rear; plushie shelves and her sewing table) · Kettle Isle, Forgefall, Scoria's forge door
  (`kettle.forge_door`), once, during [ss-41](./side-content.md#ss-41).
- **Schedule (after `wennaAwake`):** `[[7,'home.miso_counter','work'],[20,'home.miso_backroom','indoors'],
  [23,'home.miso_backroom','sleep']]`. The shop opens from the counter at every hour: at night a bell on the counter
  reads `[E] Shop · Ring the cat` and she comes out (shipped sign "Ring the cat for service").
- **Stock she adds over the game:** plushies (16 in all, 100 gems each for new ones;
  [side-content.md#plushies](./side-content.md#plushies)); 6 hood trims × 80 gems (she stitches them); Miso's
  Hundred-Year Hanky (1,000 gems, "limited edition~", a joke on her brother); new stock at 25 / 50 / 75 / 100 Sleeping
  Acorns ([systems.md#collectibles](./systems.md#collectibles)).
- **Arc:** a shopkeeper in a twenty-year sulk with her twin. The sulk began over whose name goes first on the shop sign;
  Kinako sailed off with the bazaar and they have written to each other only through Granny Mochi since. "Nothing Is
  Refundable" (Kinako tries to return a sword through Pip; Granny Mochi brokers peace) ends with a joint shop sign:
  "Miso & Kinako's — Nothing is refundable." "Miso's Supplier" shows her swords come from Master Scoria.
- **Owns:** [ss-03 Nothing Is Refundable](./side-content.md#ss-03) (with Kinako and Granny Mochi),
  [ss-41 Miso's Supplier](./side-content.md#ss-41), plushies. Appears in: ss-10, ss-18, ss-38.
- **Portrait:** `portrait_miso`, core. *"A cheerful orange tabby cat shopkeeper with happy closed upside-down-U eyes,
  a cream bandana tied over her head with a sewing needle tucked in it, a green apron with a little golden sprout
  emblem, cream muzzle and chest, pink inner ears, a sly little smile, one paw raised in a wave."*
- **Model:** GLB `npc_cat` exists (keep). Fallback shipped `npcDef('miso')`.

### Clover

- **id** `clover` (LOCKED). **Bunny · 1.0 m (1.2 m with ears).** She. Primrose Thistledown's eldest.
- **Palette (code):** fur `#fff1dc`, body `#f6e6c4`, scarf `#f59aa8`, satchel `#a86a3a`, inner ears `#f8b8c0`,
  flower crown `#ff8fa8` / `#ffffff` / `#ffd85a` with leaves `#7cc048`. Map-maker additions (from Archwater): a chalk
  stick `#f4f1ea` behind one ear, a rolled chart `#e9d8b0` in the satchel.
- **Look (LOCKED):** cream bunny, flower crown, pink scarf, satchel.
- **Voice (LOCKED):** excited kid, best-friend energy: "I knew it!", "Best. Summer. Ever!"
- **Sound cue:** a quick pencil-scratch while she sketches maps, a paper flutter as the twin.
- **Spots:** `home.clover_path` (0.7, 56.0) LOCKED · `home.thistledown_door` (−22.5, −2.7), windowsill with the
  rainbow shells (LOCKED line) · Archwater during [ss-23](./side-content.md#ss-23): first `archwater.jetty`, then
  "safely lost" at `archwater.chalk_end` (Kelp Shallows), then home · every overworld's Dash start post
  (`<realm>.dash_post`): a painted board with her portrait and chalk times; she stands there in person only at home.
- **Schedule (after `wennaAwake`):** `[[8,'home.clover_path','wander:6'],[17,'home.thistledown_door','sit'],
  [20,'home.thistledown_door','indoors']]`.
- **Arc:** wants to be an explorer. Act II: stows her own map into Pip's travels; "Clover's Map" (she follows to
  Archwater, gets safely lost, leaves chalk arrows Pip follows). Runs Clover's Dash (one course per overworld, 10).
  Epilogue: paints the Lamplighter's Chart anew; her painted chart replaces it.
- **Owns:** [ss-23 Clover's Map](./side-content.md#ss-23), [act-dash Clover's Dash](./side-content.md#act-dash).
  Appears in: ss-08 (it's her little brother), ss-10.
- **Portrait:** `portrait_clover`, core. *"An excited cream-white bunny girl with long upright ears with pink insides,
  a flower crown of pink, white and yellow blossoms, a pink knitted scarf, a brown leather satchel strap across her
  chest, a chalk stick tucked behind one ear, wide sparkling eyes, open-mouthed grin."*
- **ART BRIEF `npc_bunny` (owner GLB, batch 03):** silhouette: small round body, big round head, two long ears (40 %
  of her height). 1.2 m with ears. Matte fur, knit scarf, leather satchel, soft petal crown. Pose: leaning forward
  on her toes. ≤ 6,000 tris. 3D: *"[3D preamble] an excited cream bunny girl, long upright ears with pink insides,
  flower crown of pink, white and yellow flowers, pink knitted scarf, brown satchel at her hip, 1.2 m tall including
  ears."* Fallback: shipped `npcDef('clover')`.

### Professor Hoot

- **id** `hoot` (LOCKED). **Owl · 1.1 m** (to the cap). He.
- **Palette (code):** feathers `#8a5a3a`, face disc `#f0d8b0`, gown purple `#6a3a5a`, feet and beak `#f5a040`,
  spectacles gold `#f5c040`, cap `#3a2a2a` with a gold tassel, book green `#5a7a3a`.
- **Look (LOCKED):** brown owl, round gold spectacles, purple academic gown, grad cap with gold tassel, green book (his
  Field Notes). From Act II the book bristles with paper slips (white `#f4f1ea` tabs on the `armR` book).
- **Voice (LOCKED):** "Hoo-hoo!", "Remarkable! Simply remarkable!"; cheerfully wrong in the margins, the journal body
  correct (charter). The star count is his: "Four thousand and twelve stars this year. Last year, four thousand and
  nineteen."
- **Sound cue:** "hoo" every 30 s at night; his tassel swings as the twin.
- **Spots:** `home.hoot_woods` (4.3, −61.6) LOCKED · `home.hoot_board` beside Hoot's Board on the plaza
  ([atlas-home.md#vistas](./atlas-home.md#vistas)) · `home.hoot_cairn` the Summit Crystal Cairn foot, anchor
  (94, −44), for the star count · `home.hoot_study` (interior, door on the nearest round tree to his Woods spot; the
  entrance to Hoot's Margins post-game) · Pinewhistle, Acornet Hollow lecture stump (`pinewhistle.lecture_stump`)
  during [ss-20](./side-content.md#ss-20).
- **Schedule (after `wennaAwake`):** `[[8,'home.hoot_woods','work'],[16,'home.hoot_board','stand'],
  [21,'home.hoot_cairn','watch'],[2,'home.hoot_study','indoors']]`.
- **Arc:** a scholar who is wrong about almost everything, cheerfully. His *Field Notes* are the journal. After the
  first beacon he starts the star count (a clue that lights are being taken). Rivalry with Professor Pinfeather (Peer
  Review). Post-game, Hoot's Margins (a walk inside his notebook) and a final paper that is, at last, right.
- **Owns:** [ss-52 Hoot's Last Paper](./side-content.md#ss-52), Vista Sketches (30). Appears in: ss-20, ss-10.
- **Portrait:** `portrait_hoot`, core. *"A plump brown owl professor with round gold spectacles over big amber eyes, a
  cream face disc, a purple academic gown, a black graduation cap with a gold tassel, holding a green notebook stuffed
  with paper slips, beak open mid-'hoo', delighted and slightly wrong."*
- **ART BRIEF `npc_owl` (owner GLB, batch 03):** silhouette: an egg with a square cap. 1.1 m. Feathers soft-painted,
  gown matte cloth. Pose: wing tucking the book under one arm, the other wing raised to make a point. ≤ 6,000 tris.
  3D: *"[3D preamble] a round brown owl professor in a purple academic gown and black graduation cap with a gold
  tassel, round gold spectacles, cream face, holding a green notebook, 1.1 m tall."* Fallback: shipped `npcDef('hoot')`.

### Digby

- **id** `digby` (LOCKED). **Mole · 1.0 m.** He. Nearly blind; only Digby jokes about his sight (charter Never).
- **Palette (code):** fur `#7a5240`, muzzle `#c8a080`, nose pink `#f0a0a0`, overalls `#4a6a9a` with straps `#3a5a8a`,
  helmet `#f5c030`, lamp `#fff4b0`, belt `#8a5a30`, shovel `#a0a0a8`. The "For Spring" pouch: patched green felt
  `#6f8f3a` with gold stitching `#f2c94c` (Gran Burrows's work), hung on his belt from ss-01.
- **Look (LOCKED):** mole miner, yellow helmet with a lamp, blue overalls, belt pouch, shovel.
- **Voice (LOCKED):** shy, self-deprecating sight jokes; "Did not see you there. Did not see much of anything,
  honestly."; "Digby's the name, digging's the game."
- **Sound cue:** soft digging (*shff, shff*) near his spot; dirt puffs as the twin.
- **Spots:** `home.digby_mill` (−103.1, −3.3) LOCKED · `home.digby_burrow` (his burrow mouth beside the windmill; the
  root-gate is beneath it, ch13) · `home.for_spring` the For Spring planting patch, anchor (−85, 10) in the Meadow ·
  ch13 partner through the Rootdeep (walks 2-8 m ahead, charter first-person rule 4) · Rootdeep, Burrowbottom, Gran
  Burrows's door (`rootdeep.gran_door`) after ch13.
- **Schedule (after `wennaAwake`):** `[[7,'home.digby_mill','work'],[19,'home.digby_burrow','indoors'],
  [22,'home.for_spring','work'],[23,'home.digby_burrow','sleep']]`. Before ss-01 is started, the 22:00 row shows him
  planting with his back to the path; walking up to him then starts ss-01 ("Oh! Nobody's supposed to... can you keep
  a secret?"). That is how the unseen gardener is found.
- **Arc:** the one who can't see leads where nobody can. For Spring (he plants by touch so there will be a spring he
  can smell; Ribbit's "No guardian there" stays true); ch13 leads Pip into the Rootdeep, where nobody can see and he
  never could ("Finally, a place where everyone's as lost as me. Follow my voice."); Gran Burrows; Gran's Pouch.
- **Owns:** [ss-01 For Spring](./side-content.md#ss-01). Appears in: ss-33, ss-10, ch13.
- **Portrait:** `portrait_digby`, core. *"A shy, chubby brown mole miner with tiny squinting eyes, a big pink nose, a
  yellow mining helmet with a glowing lamp, blue overalls with brass buttons, a small green felt pouch with gold
  stitching on his belt, holding a little shovel, bashful smile."*
- **ART BRIEF `npc_mole` (owner GLB, batch 03):** silhouette: a round potato with a helmet dome and a shovel. 1.0 m.
  Velvet fur, glossy helmet (flat paint), glowing lamp (emissive `#fff4b0`). Pose: shovel over one shoulder. ≤ 6,000
  tris. 3D: *"[3D preamble] a chubby brown mole miner, tiny eyes, big pink nose, yellow mining helmet with a lamp,
  blue overalls, a shovel, a green felt pouch on his belt, 1.0 m tall."* Fallback: shipped `npcDef('digby')`.

<a id="grandpa-dormy"></a>
### Grandpa Dormy

- **id** `dormy`. **Dormouse · 0.7 m** (0.85 m with nightcap). He. Very old; the snoring cottage (cottage 1).
- **Palette:** fur golden brown `#c98b4b`, belly cream `#f6e6c4`, tail fluff `#d9a86a`, nightcap indigo `#3a3f7a` with a
  star pompom `#ffe9a8`, patchwork dressing gown `#8fae9a` / `#e7c45a` / `#c2563f` squares, slippers `#6b4a8c`,
  candle holder brass `#c99a4a`, flame `#ffcf7a`.
- **Look:** small and round with a huge fluffy tail he wears wrapped round his shoulders like a scarf, droopy
  half-closed eyes, a long indigo nightcap with a star pompom, patchwork dressing gown, purple slippers, a brass candle
  holder. In first person the candle flame is the thing you see first through the window.
- **Voice:** sleepy and kind, tells stories. Tic: a yawn inside the sentence ("Once upon a... hwaaah... time, little
  one."). He calls Pip "little one". He knows a great deal and remembers it only after dark.
- **Sound cue:** the LOCKED soft snore through cottage 1's door all day; at 21:00 the snore stops with a snort and his
  window brightens (visual twin).
- **Spots:** `home.dormy_door` (−14.1, −12.3) · `home.dormy_chair` (cottage 1 interior, armchair by the fire).
- **Schedule:** `[[0,'home.dormy_chair','sleep'],[21,'home.dormy_chair','sit'],[23,'home.dormy_chair','sleep']]`.
  He is awake **21:00-23:00** only. Before cottage 1's interior ships (S-115), he talks through the door at those
  hours (the door line becomes "Come in, come in. Mind the rug... hwaaah.").
- **Arc:** tells one lore story per night, seven in all ([lore.md](./lore.md), Dormy's night stories), each opening only
  after the beat that makes it safe to hear. The Long Nap: he has tried for a hundred years to stay awake until
  midnight to see the Starkin wave back, and Pip helps him (ss-02). Post-game he owns the Guardian Dreams quest,
  because nobody knows more about naps.
- **Owns:** [ss-02 The Long Nap](./side-content.md#ss-02), [ss-51 Dream a Little](./side-content.md#ss-51).
  Appears in: ss-10.
- **Portrait:** `portrait_dormy`, core. *"A tiny elderly dormouse grandfather with golden-brown fur and droopy sleepy
  eyes, a huge fluffy tail wrapped round his shoulders like a scarf, a long indigo nightcap with a pale gold star
  pompom, a patchwork dressing gown, holding a brass candle holder with a small warm flame, mid-yawn."*
- **ART BRIEF `npc_dormy` (owner GLB, batch 06):** silhouette: a pear with a curl of tail over the shoulders and a
  drooping cap. 0.85 m. Soft fur, quilted gown, emissive flame `#ffcf7a`. Pose: seated in an armchair (the GLB is
  seated; the code rig sits on `sit`). ≤ 5,000 tris. 3D: *"[3D preamble] a tiny old dormouse in a patchwork dressing
  gown and long indigo nightcap with a star pompom, huge fluffy tail wrapped round his shoulders, holding a candle,
  sitting, 0.85 m tall standing."* Fallback: `rodent` rig, `ears: round`, `tail: bush` (a 7-segment `tube` 0.5 m,
  radius 0.09, laid over the shoulders), nightcap `cone` 0.35 m bent with a `torus` curl, `extra` candle (`cyl` +
  glowing `sphere` with `glow: 1`).

<a id="nell"></a>
### Nell

- **id** `nell`. **Nell Pelliwick, pelican · 1.35 m.** She. The "Gone fishing" cottage (cottage 2); skipper of the
  *Dandelion*; fishing teacher.
- **Palette:** feathers white `#f7f4ec`, wing tips grey `#8f97a3`, bill peach `#f2b48a` with a pouch `#f6c9a4`, feet
  orange `#f29b38`, rain hat mustard `#e2b33c`, jumper teal `#3fa79a` with a dandelion patch `#f2c94c`, scarf
  `#c2563f`.
- **Look:** a tall, calm pelican with a long peach bill and a big pouch, a mustard rain hat with a wide back brim, a
  chunky teal fisherman's jumper with a yellow dandelion patch on the chest, a red scarf, a fishing rod across her back.
  In first person the hat and the bill pouch read from 30 m along the jetty.
- **Voice:** dry, unhurried, sure of the sea. Tic: "...eventually." at the end of a promise, fish as units of time
  ("Back in two mackerels."). Calls Pip "Pip" or "first mate". Signature: "Back! ...Told you." (her note's LOCKED
  payoff is "Back! ...Told you. — N.").
- **Sound cue:** a reel's click-whirr at the jetty by day; a ripple ring under her line as the twin.
- **Spots:** `home.jetty` Nell's Jetty, anchor (−14, 126) · `home.nell_door` (13.3, −14.1) · `home.nell_tank` (cottage
  2 interior: the fish tank, her logbook) · aboard the *Dandelion* at every jetty while chart-sailing and at the tiller
  while free-sailing the Glassway (seen in third person; in first person her hat and bill show at the bottom-right of
  the view while sailing) · each land's jetty (`<realm>.jetty`) whenever Pip arrived there by boat.
- **Schedule (after `nellHome`):** `[[5,'home.jetty','work'],[18,'home.nell_tank','indoors'],[22,'home.nell_tank','sleep']]`.
  `[E] Sail · the Dandelion` works at any hour from any jetty: Nell is "always aboard when you need her".
- **Arc:** out past the reef when Wenna wilted; Captain Pinch kept the lighthouse lamp lit for her; she comes home at I.6
  on the lighthouse beam (toast "✿ Nell is home! The lighthouse brought her in."). Needs a lamp to sail at night: the
  Glowbud Lantern is it (ch7). Ferries Pip through Act II; sails past the reef by the Lantern's light (ch14). Teaches
  fishing; her tank fills with the player's catches. Brings a lantern to the chain in ch21 (always, as she is story).
- **Owns:** [act-fishing Fishing](./side-content.md#act-fishing) (24 species, 18 spots; tiers heart petal at 16 /
  rod charm / the tank). Appears in: ss-06, ss-10, ss-36, ss-37.
- **Portrait:** `portrait_nell`, core. *"A tall, calm white pelican sailor woman with a long peach bill and soft pouch,
  a mustard-yellow rain hat with a wide back brim, a chunky teal fisherman's jumper with a little yellow dandelion
  patch, a red knitted scarf, a fishing rod over her shoulder, a dry knowing half-smile."*
- **ART BRIEF `npc_nell` (owner GLB, batch 03):** silhouette: tall teardrop body, long horizontal bill (0.45 m) and
  a wide hat brim. 1.35 m. Feathers soft-painted, knit jumper, oilcloth hat. Pose: standing, one wing on the rod strap.
  ≤ 6,000 tris. 3D: *"[3D preamble] a tall white pelican sailor, long peach bill with a pouch, mustard rain hat,
  chunky teal jumper with a dandelion patch, red scarf, fishing rod on her back, 1.35 m tall."* Fallback: `bird` rig
  with `beak: 'pouch'` (lathe bill 0.45 m + scaled sphere pouch), hat as a `cyl` crown + flattened `sphere` brim, rod as
  an `extra` `cyl` 1.2 m.

<a id="hazel-thimble"></a>
### Hazel Thimble

- **id** `hazel`. **Hedgehog · 0.8 m.** She. The cinnamon-bun cottage (cottage 3). She fed Pip as a baby.
- **Palette:** spines `#8a6a4a` tipped `#e8d6b8`, face `#f2dcc0`, nose `#3a2a20`, apron rose `#e88a8a` with a white
  trim `#ffffff`, kerchief white `#fff8e6`, oven mitt `#c2563f`, flour dust `#fffaf0`.
- **Look:** a round hedgehog with flour-dusted spines, a white kerchief, a rose apron with a bun-shaped pocket, one red
  oven mitt. A tray of three buns in her hands at the stall.
- **Voice:** brisk, warm, feeds everyone. Tic: baking measures ("A pinch of patience, a cup of courage, and a bun.").
  Calls Pip "sprout".
- **Sound cue:** an oven timer *ding* every 45 s by day; a puff of flour from the window as the twin.
- **Spots:** `home.hazel_door` (−15.9, 11.5) · `home.hazel_stall` (a bun stall by her door, anchor (−13, 9.5)) ·
  `home.hazel_oven` (interior).
- **Schedule:** `[[5,'home.hazel_oven','indoors'],[10,'home.hazel_stall','work'],[17,'home.hazel_stall','wander:3'],
  [21,'home.hazel_oven','sleep']]`. Buns: `[E] Shop · Hazel's buns` at the stall, 10 gems, heal half a heart.
- **Arc:** "A Bun for Every Isle": she bakes one isle's ingredient into a bun for someone on that isle; the list grows
  as lands ship. The ending festival's cake is hers.
- **Owns:** [ss-05 A Bun for Every Isle](./side-content.md#ss-05). Appears in: ss-10, ss-30 (Ma Haybury's pie
  rivalry).
- **Portrait:** `portrait_hazel`, core. *"A round, rosy hedgehog baker woman with flour-dusted brown spines with cream
  tips, a white kerchief, a rose-pink apron with a bun-shaped pocket, one red oven mitt, holding a tray of three
  cinnamon buns, a busy cheerful smile."*
- **ART BRIEF `npc_hazel` (owner GLB, batch 07):** silhouette: a spiky dome with a small face. 0.8 m. Spines as one
  painted shell with tufted edges (no per-spine geometry). Pose: holding the tray. ≤ 5,000 tris. 3D: *"[3D preamble]
  a round hedgehog baker, flour-dusted spines, white kerchief, rose apron, one red oven mitt, holding a tray of
  cinnamon buns, 0.8 m tall."* Fallback: `rodent` rig with `spines: true` (a half-`sphere` shell over the back with 24
  small `cone`s), `tail: none`, `extra` tray (`box`) with three `torus` buns `#c98b4b`.

<a id="granny-mochi"></a>
### Granny Mochi

- **id** `mochi`. **Very old fluffy cat · 0.9 m** (stooped; 1.0 m upright). She. The yawning-cat cottage (cottage
  4). Grandmother of Miso and Kinako. May say "Wenna".
- **Palette:** long fur cream-white `#f8f1e4` with pale ginger patches `#f2c79a`, grey muzzle `#c9c2b8`, shawl lilac
  `#b8a6d0`, spectacles silver `#c0c4cc`, knitting yarn `#e88a8a`, cushion `#6f8f3a`.
- **Look:** a very fluffy, very old cat with a wide cloud of fur, half-closed eyes behind tiny round spectacles, a lilac
  shawl, always knitting something pink. Sits in a window armchair (the LOCKED "cat yawns at you through the window").
- **Voice:** slow, amused, misses nothing. Tic: "Mm-hm." and calls everyone "kitten". Knows the trade winds, so she
  always knows where Kinako's bazaar is today: "Mm-hm. My grandson's at Archwater today, kitten. The other one."
- **Sound cue:** knitting needles clicking within 8 m; a ball of yarn rolling on the sill as the twin.
- **Spots:** `home.mochi_door` (21.5, −5.4) · `home.mochi_window` (interior armchair by the window) · `home.mochi_step`
  (her doorstep, sunning).
- **Schedule:** `[[7,'home.mochi_window','sit'],[10,'home.mochi_step','doze'],[13,'home.mochi_window','sit'],
  [22,'home.mochi_window','sleep']]`.
- **Arc:** the patient broker of a twenty-year sulk. In ss-03 she reads each twin's letter "out loud, with the rude
  bits left out" and sets the reconciliation at the plaza. At the ending festival she sits between them.
- **Owns:** none alone; she runs the middle of [ss-03](./side-content.md#ss-03). The bazaar's location line is her
  service from S-092.
- **Portrait:** `portrait_mochi`, core. *"A very old, very fluffy cream-white cat grandmother with pale ginger patches
  and a grey muzzle, tiny round silver spectacles, sleepy amused half-closed eyes, a lilac knitted shawl, knitting
  something pink, a knowing smile."*
- **ART BRIEF `npc_mochi` (owner GLB, batch 07):** silhouette: a fur cloud with ears, seated. 0.9 m seated. Fluffy
  fur as soft painted lobes. Pose: seated, knitting. ≤ 5,000 tris. 3D: *"[3D preamble] a very old fluffy cream cat
  grandmother, grey muzzle, tiny round spectacles, lilac shawl, knitting pink yarn, sitting, 0.9 m tall."* Fallback:
  `cat` rig, palette above, body lathe widened × 1.3, spectacles two `torus`es, shawl a `torus` + cone drape.

<a id="primrose-thistledown"></a>
### Primrose Thistledown

- **id** `primrose`. **Bunny · 1.05 m (1.3 m with ears).** She. Clover's mum; "Please wipe your paws" (cottage 5).
- **Palette:** fur fawn `#e8d2b0`, inner ears `#f8b8c0`, apron gingham `#7fae4b` / `#ffffff`, dress `#f2c94c`, broom
  straw `#e7c45a` and handle `#8a5a30`.
- **Look:** a tidy bunny mum in a yellow dress and a green gingham apron, a broom always in hand, ears tied back with a
  green ribbon.
- **Voice:** busy, loving, counting. Tic: "One, two, three... four. Good." Calls Pip "sweetpea" ("dear" is kept for the very old, charter).
- **Sound cue:** broom swishes on the doorstep; a little dust cloud as the twin.
- **Spots:** `home.thistledown_door` (−22.5, −2.7) · interior (cottage 5) · Duskwick, Wickhaven jetty
  (`duskwick.jetty`) during [ss-08](./side-content.md#ss-08).
- **Schedule:** `[[7,'home.thistledown_door','work'],[12,'home.thistledown_door','indoors'],[15,'home.thistledown_door','work'],
  [20,'home.thistledown_door','indoors']]`.
- **The kits** (ids `kit_bramble`, `kit_sorrel`, `kit_clem`, `kit_dot`; `bunny` rig scaled 0.38-0.5, Primrose's
  palette with one scarf colour each; no portraits except Clem):
  - **Bramble** (0.5 m, scarf `#c2563f`): the eldest kit, bossy, races Pip to the door. Tic: "Bet I'm faster."
  - **Sorrel** (0.46 m, scarf `#3fa79a`): reads Hoot's papers and corrects them. Tic: "Actually..."
  - **Clem** (0.42 m, scarf `#f2b45a`): the adventurous one who stows away to Duskwick in ss-08 (in a crate on the
    *Dandelion*). Tic: "I wasn't hiding. I was exploring quietly." Portrait `portrait_kit_clem`: *"A tiny fawn bunny
    kit with an orange scarf, peeking out of a wooden crate with a guilty grin."*
  - **Dot** (0.38 m, scarf `#f59aa8`): the smallest; says only "Dot!" and follows Pip within 3 m when he is near the
    cottage (ahead or beside, never behind: charter rule 4).
  - Kit schedule: by the cottage door 08-19 (`wander:5`), indoors after.
- **Arc:** a mum who counts four kits and gets three. ss-08 ends with Clem home and a lamp-moth sticker on the
  cottage door.
- **Owns:** [ss-08 Little Thistledown](./side-content.md#ss-08). Appears in: ss-10, ss-23.
- **Portrait:** `portrait_primrose`, core. *"A kind, busy fawn bunny mother with long ears tied back by a green ribbon,
  a yellow dress and a green gingham apron, holding a straw broom, counting on her fingers with a fond tired smile."*
- **ART BRIEF `npc_primrose` (owner GLB, batch 08):** silhouette: Clover's shape, taller, with a broom. 1.3 m with
  ears. ≤ 6,000 tris; kits ≤ 2,500 each as a separate `npc_kit` GLB with four texture variants. 3D: *"[3D preamble] a
  fawn bunny mother in a yellow dress and green gingham apron, ears tied back with a green ribbon, holding a straw
  broom, 1.3 m tall including ears."* Fallback: `bunny` rig.

### Puddle

- **id** `puddle`. **Tiny well frog · 0.12 m.** He. Ribbit's nephew. LOCKED: "A tiny frog on a lily pad waves back
  at you."
- **Palette:** skin `#9bd46a`, belly `#f4e8b0`, acorn-cap hat `#8a5a30`, lily pad `#3f8f5a` with a pink flower
  `#f7b6c8`.
- **Look:** a frog the size of a teacup on a lily pad, wearing an acorn cap as a hat, waving. In his grotto he stands
  on a mushroom stool so his face is at 0.5 m; the talk camera dips to him.
- **Voice:** tiny and proud. Tic: every line starts with "(tiny voice)"; he may say a tiny "ribbit" once (charter).
  Calls Pip "big friend".
- **Sound cue:** a high tiny *plip* from the well every 20 s; a ripple ring on the water as the twin.
- **Spots:** `home.well` (9, −7.5) LOCKED (seen by `[E] Peek · the well`) · `home.puddle_grotto` (Puddle's Grotto
  under the well, [atlas-home.md#puddles-grotto](./atlas-home.md#puddles-grotto), a Lantern gate).
- **Schedule:** none (always in the well by day, in the grotto from 20:00; the well peek line at night: "The lily pad
  is empty. A tiny light glows far below.").
- **Arc:** a tiny frog who has been keeping a secret garden of glowcaps under the village. Opens his grotto to Pip once
  Pip has the Lantern; the grotto is a home-island find and one of Ribbit's fondest worries.
- **Owns:** [ss-07 Puddle's Grotto](./side-content.md#ss-07).
- **Portrait:** `portrait_puddle`, core. *"A tiny bright green frog wearing an acorn cap as a hat, sitting on a round
  lily pad with a pink flower, waving one little hand, very proud, big shiny eyes."*
- **ART BRIEF `npc_puddle` (owner GLB, batch 03):** 0.12 m on a 0.4 m lily pad. ≤ 1,500 tris. 3D: *"[3D preamble]
  a tiny green frog in an acorn-cap hat on a lily pad with a pink flower, waving, 12 cm tall."* Fallback: `frog` rig
  scaled 0.1, no coat or top hat, an acorn cap (`sphere` half + `cyl` stem), lily pad a flat `cyl` with a wedge cut.

### The Quackenbushes

- **id** `ducks` (group; members `duck_dabble`, `duck_dilly`, `duck_dally`, `duck_quilliam`, `duck_bobbin`). **Five
  ducks · 0.45-0.7 m.** LOCKED: "The ducks are jealous" of Ribbit's croak.
- **Palette:** white ducks `#f7f4ec` with bills `#f29b38`; Admiral Dabble's paper hat `#f4f1ea` with a red stripe
  `#c2563f`; Dilly and Dally ribbons `#f59aa8` / `#8fb8ff`; Quilliam's bow tie `#6b4a8c`; Bobbin is a yellow duckling
  `#f6d860`.
- **Members:** **Admiral Dabble** (eldest drake, 0.7 m, folded paper admiral's hat, runs the Regatta) · **Dilly** and
  **Dally** (twins, 0.6 m, always together) · **Quilliam** (0.62 m, the serious one, practises croaking) · **Bobbin**
  (duckling, 0.45 m).
- **Voice:** the five finish one sentence between them, one phrase each, then all say "Quack." ("We have..." "...been
  practising..." "...a croak." "Qroak." "Quack."). Their practice croak "Qroak." is never as good as Ribbit's.
- **Sound cue:** a chorus of quacks over the Meadow pond; ripples in a V behind them as the twin.
- **Spots:** `home.duck_pond` the Meadow pond (−70.6, 21.8), r 7.5 · the plaza at Act-end festivals (`home.plaza_edge_w`
  anchor (−14, −2)).
- **Schedule:** `[[6,'home.duck_pond','wander:6'],[20,'home.duck_pond','sleep']]` (asleep on the water in a ring).
- **Arc:** five ducks jealous of a frog. The Duck Regatta makes them champions of something; at the ending festival
  they sing backing "quacks" to Ribbit's victory croak and are, briefly, not jealous.
- **Owns:** [ss-06 The Duck Regatta](./side-content.md#ss-06), [act-regatta Duck Regatta](./side-content.md#act-regatta)
  (tiers 40 gems / duck plushie / gold duck trophy). One plushie: "a duck" (Admiral Dabble).
- **Portrait:** `portrait_ducks` (one group portrait, core). *"Five white ducks crowded together: an elderly drake in a
  folded paper admiral's hat at the front, twin ducks with pink and blue ribbons, a serious duck in a purple bow tie,
  and a small yellow duckling on top, all with beaks open in a chorus."*
- **ART BRIEF `npc_duck` (owner GLB, batch 07):** one duck mesh, ≤ 1,500 tris, 0.6 m, five texture variants and an
  accessory slot. 3D: *"[3D preamble] a round white cartoon duck with an orange bill and feet, 0.6 m tall."*
  Fallback: `bird` rig with `beak: 'flat'`, scaled per member, accessories as `extra` parts.

<a id="kinako"></a>
### Kinako

- **id** `kinako`. **Cat · 1.1 m.** He. Miso's twin brother. Sails **Kinako's Floating Bazaar**.
- **Palette:** fur sandy-beige `#e2c79a` with toffee stripes `#b8894a`, muzzle cream `#fff0d8`, waistcoat purple
  `#6b4a8c` with gold trim `#f5c040`, neckerchief teal `#3fa79a`, captain's cap `#2b2238` with a gold "K" badge,
  badges (many) `#ff8f7a` / `#7fd3d0` / `#f2c94c`.
- **Look:** Miso's shape in sandy beige, wide-open eyes (where Miso's are closed), a flashy purple waistcoat covered in
  pin badges, a teal neckerchief, a small dark captain's cap. Holds up one item at a time to the light.
- **Voice:** a salesman who loves his stock. Marker `!!` and "limited edition!!" are his alone (charter). Calls Pip
  "valued customer!!". "Everything on this boat is limited edition!! ...There's only one of each, you see."
- **Sound cue:** a brass bazaar bell clanging when the boat is in a land (heard across a harbour); a striped bunting
  flag on the mast as the twin, visible from 200 m.
- **Spots:** `<realm>.bazaar` (the bazaar mooring by each land's jetty; Glassway: by Puffin Post) · the home plaza at
  the end of ss-03 and at the ending festival.
- **Schedule:** the bazaar docks in one unlocked land per in-game day. Rule: on the first day a land is unlocked it docks
  there; afterwards it rotates through unlocked lands in chart order, one per day (06:00 change). Granny Mochi and the
  journal map always show today's dock. While a quest needs him, he stays put.
- **Stock:** heart container 300; Bright Wick 400 (Lantern 6 → 9 m); Swift Fluff 400 (glide 6 → 7.5 m/s); Sling
  quick-draw 300; "the same ordinary spoon from every isle" (ss-18). Ledger: [systems.md#economy](./systems.md#economy).
- **Arc:** the brother who sailed off. Twenty years ago the twins argued over whose name went first on the shop sign;
  he took the bazaar and left. ss-03 ends with the joint sign; at the ending festival he docks at home for good on
  festival days.
- **Owns:** [ss-18 Kinako's Limited Edition](./side-content.md#ss-18). Appears in: ss-03, ss-41.
- **Portrait:** `portrait_kinako`, core. *"A sandy-beige tabby cat merchant with toffee stripes and wide sparkling eyes,
  a flashy purple waistcoat with gold trim covered in colourful pin badges, a teal neckerchief, a small dark captain's
  cap with a gold K badge, holding up a shiny spoon like a treasure, huge salesman grin."*
- **ART BRIEF `npc_kinako` (owner GLB, batch 04):** silhouette: Miso's, with a cap and a waistcoat flare. 1.1 m.
  ≤ 6,000 tris. 3D: *"[3D preamble] a sandy-beige tabby cat merchant, wide eyes, purple waistcoat with gold trim and
  pin badges, teal neckerchief, small captain's cap, 1.1 m tall."* Fallback: `cat` rig, open eyes (`face()` helper),
  waistcoat lathe, cap `cyl`. The **bazaar boat** prop brief is in [atlas-isles.md#shared](./atlas-isles.md#shared).

<a id="rook"></a>
### Rook

- **id** `rook`. **Young crow · 0.85 m.** He. A treasure-hunter and Pip's comic rival in five lands.
- **Palette:** feathers blue-black `#2a2f45` with a sheen `#4a5a8a`, beak and feet `#3a3a3a`, goggles brass `#c99a4a`
  with lenses `#8ec9d8`, neckerchief red `#d94a3a`, satchel patched `#8a6a4a` / `#c98b4b`, bottle-cap badges
  `#f2c94c`.
- **Look:** a scruffy young crow with aviator goggles pushed up on his head, a red neckerchief, a patched satchel
  clinking with bottle caps, one feather that sticks up.
- **Voice:** quick, boastful, secretly lonely. Tic: "Called it!" (even when he didn't). Calls Pip "rival".
- **Sound cue:** a *caw* and a clatter of bottle caps when he lands near Pip; a dropped bottle cap glints as the twin.
- **Spots and races (ss-49, five parts, in this order as lands ship):** 1 Pinewhistle `pinewhistle.rook_start`
  (Whistle Rise) · 2 Archwater `archwater.rook_start` (Basalt Stairs) · 3 Threemills `threemills.rook_start` (Tumble
  Hill, where he meets Pennywhistle, ss-29) · 4 Saltglass Flats `saltglass.rook_start` (the Glass Dunes) · 5 Driftholm
  `driftholm.rook_start` (Arch Rise). Home: a nest of bottle caps on Gull Rock in the Glassway (`glassway.rook_nest`); on
  festival days he perches on Hoot's Board at home.
- **Schedule:** at the current race start 08-18; otherwise on his nest. After part 3 he spends 17-19 with Pennywhistle
  in Threemills (`threemills.pennywhistle_field`).
- **Arc:** wants glory and a trophy shelf; learns a friend is better than a trophy (Pennywhistle, who wanted a crow
  friend for a century). Part 5 ends with him giving Pip his best bottle cap. Brings a lantern to the ch21 chain if
  part 3 is done.
- **Owns:** [ss-49 Rook's Races](./side-content.md#ss-49). Appears in: ss-29.
- **Portrait:** `portrait_rook`, core. *"A scruffy, cheeky young crow with blue-black feathers and one feather sticking
  up, brass aviator goggles pushed up on his head, a red neckerchief, a patched satchel with bottle caps, a smug
  confident grin, one wing pointing at the viewer."*
- **ART BRIEF `npc_rook` (owner GLB, batch 06):** silhouette: a teardrop with goggles and a tuft. 0.85 m. ≤ 5,000
  tris. Anim: a hop-run cycle is welcome (he races) but not required: the code rig bobs along a spline. 3D: *"[3D
  preamble] a scruffy young crow treasure-hunter, blue-black feathers, brass goggles on his head, red neckerchief,
  patched satchel, 0.85 m tall."* Fallback: `bird` rig, `beak: 'cone'`, goggles two `torus` + `cyl` lenses.

---

<a id="catchers"></a>
## Catchers

The three guardians are the **Catchers of the Corners** (LOCKED names, titles, models, arenas, fights). Their duty is
the Catchers' Rule: "Catch what flies. Keep it one night. Give it only to a kind hand." They are well over a hundred
years old, were the Catchers at the last sneeze (memories 4-6 show them younger), half forgot the Rule, and kept the
seeds for their own kind reasons. They may say "Wenna". Fights: [creatures.md#boss-grumble](./creatures.md#boss-grumble)
and the shipped `js/bosses.js`. Handover scenes: [story.md](./story.md) (I.2-I.4).

### Grumble Shroom

- **id** `grumble` (boss key `boss_shroom`, GLB 3.2 m, LOCKED). Title "Grumpy Guardian of the Whispering Woods". He.
- **Palette (reference hexes for derived art; the GLB is the truth):** cap purple `#8a5cc0`, cap shade `#5e3c8c`,
  spots and crown gold `#f2c44e`, stem `#f0e0c0`, moustache and beard `#f6f1e6`, moss `#7aa63a`, baby shroom on the
  cap `#e85a5a` with white spots.
- **Look (LOCKED):** purple cap with golden spots, small gold crown, moss, a baby shroom on the cap, white moustache and
  beard, stubby body. After the seed is placed: faint glow-moss `#9be8b0` (`glow: 0.4`) on Grumble's Crown and on his
  cap rim (healed state, [atlas-home.md#healed-states](./atlas-home.md#healed-states)).
- **Voice:** short grumbles; marker "Hmph". Handover: "Hmph. Fine. FINE. Take it." / "The little ones were scared of the
  dark, you know. Since she went droopy, the woods stopped glowing. That seed lit them right up." / "Bring it home.
  Tell her Grumble kept it warm."
- **Kind reason (seen before the fight):** the three fairy rings near the Hollow are dark; three little unlit
  night-lights by the Hollow sign (`placeReasons`).
- **The nephews** (`shroomlet_button`, `shroomlet_chanty`, `shroomlet_puff`; 0.5 m each; the shipped shroomlet
  look recoloured friendly: caps `#e85a5a` / `#f2b45a` / `#c9b6ec`, faces with open `face()` eyes, no spore attack):
  **Button** (bravest, holds the night-light), **Chanty** (asks questions), **Puff** (hides under his own cap). Scared
  of the dark; after the Woods seed they play round the glowing fairy rings at dusk (18-21). In
  [ss-11](./side-content.md#ss-11) they get lost in the Undercap and Pip relights their town ([dungeons.md#o2](./dungeons.md#o2)).
  They are never enemies and never use the enemy `mushroom` id.
- **Owns:** [ss-11 Grumble's Nephews](./side-content.md#ss-11), [act-spore-rally Spore Rally](./side-content.md#act-spore-rally)
  (10 / 20 / 30 hits; heart petal / gems / a plushie hat), and is the spokes-shroom of
  [ss-50 The Three Corners Jamboree](./side-content.md#ss-50). Appears in: ss-10, ch21, ch22.
- **Portrait:** `portrait_grumble`, core. *"A grumpy but secretly soft-hearted giant purple mushroom guardian with a
  golden-spotted cap, a tiny gold crown, a baby red mushroom sprouting on his cap, a big white moustache and beard,
  moss on his stubby stem body, arms folded, one eyebrow raised, trying not to smile."*
- **Model:** GLB `boss_shroom` (keep). No new brief.

### Captain Pinch

- **id** `pinch` (boss key `boss_crab`, GLB 2.6 m, LOCKED). Title "Snippy Skipper of the Sunny Shores". He.
- **Palette (reference):** shell red `#e0503a`, shell shade `#a83428`, barnacles `#e8e0d0`, hat navy `#2a3a6a`, anchor
  badge gold `#f5c040`, eyes black on stalks `#2a1a12`. The ship's bell (from o3): bronze `#b8894a`.
- **Look (LOCKED):** giant red crab with barnacles and a small navy skipper's hat with an anchor badge. After
  [ss-36](./side-content.md#ss-36) the Merry Mabel's bell hangs in Pinch's Lighthouse gallery (a prop, atlas-home).
- **Voice:** marker "ye", "aye", "belay", and "lad" for Pip. Handover: "Belay that! ...Aye, aye. Ye've a kind hand,
  I'll give ye that." / "My lamp went dark the night she wilted, and Nell Pelliwick's boat is still out past the reef.
  A skipper doesn't let a lamp go out with a boat at sea." / "Take it to the Tree. She'll want a light to come home by."
- **Kind reason (seen before):** the lamp room dark by day; a spyglass on the gallery pointing out to sea; a chalk tally
  of nights on the door. The lamp burns by day as well as night until `nellHome`.
- **Spots after Act I:** keeps Pinch's Lighthouse. From `nellHome` he and Nell trade sea stories at the jetty
  17-18 on even days (`home.jetty`). ch22: climbs the lighthouse with Pip to throw the 13th letter.
- **Owns:** [ss-36 The Merry Mabel](./side-content.md#ss-36) (the ship's bell is for him). Appears in: ss-10, ch21,
  ch22.
- **Portrait:** `portrait_pinch`, core. *"A big friendly-gruff red crab sea captain covered in little barnacles,
  wearing a small navy skipper's hat with a gold anchor badge, eyes on stalks, one claw raised in a salute, a proud
  stubborn grin."*
- **Model:** GLB `boss_crab` (keep).

### Frostbun

- **id** `frostbun` (boss key `boss_frost`, GLB 3.4 m, LOCKED). Title "Chilly Champion of Frostcap Peaks". He (LOCKED: Digby's shipped line "Then he sat on my roof").
- **Palette (reference):** fur white `#f7fbff`, fur shade `#d6e6f2`, icicle ear tips `#bfe6ff`, ice crystals on the
  shoulders `#9fdcff`, paw pads `#8fc8f0`, the tiny knitted scarf `#e88a8a` with white stripes, Gloop's missing sock
  (orange stripes `#f2994a` / `#fff3e0`) worn as an ear-warmer until ss-25.
- **Look (LOCKED):** giant fluffy white yeti-bunny, icicle-tipped ears, ice-crystal shoulders, frosty breath, blue paw
  pads. New, Act II: an orange striped sock on one ear "for warmth" (Old Gloop's missing eighth sock; returned in
  ss-25, after which he wears a scarf Great-Aunt Flurry knits him).
- **Voice:** short sleepy sentences, rolled r's ("Brrr-rrr... no. Mine."). Handover: "Brrr-rrr... no. Mine." / "It was
  shivering when it landed. Seeds catch cold. Everyone knows that. I hugged it all night." / "You will keep it warm?
  Promise? ...Hop to it, then."
- **Kind reason (seen before):** a tiny knitted scarf on a rock; a snow nest shaped like a cradle.
- **Owns:** [ss-12 Frostbun's Great-Aunt](./side-content.md#ss-12) (the Snowglobe),
  [act-sledding Sledding](./side-content.md#act-sledding). Appears in: ss-25, ss-10, ch21, ch22.
- **Portrait:** `portrait_frostbun`, core. *"A huge, soft, sleepy white yeti-bunny with long ears tipped with little
  icicles, pale blue ice crystals on his shoulders, blue paw pads, a striped orange sock worn on one ear, frosty breath
  puffs, half-closed dreamy eyes, a tiny shy smile."*
- **Model:** GLB `boss_frost` (keep). The sock is an `extra` child mesh (a `tube` cuff 0.25 m on the left ear bone or
  the head node, tinted `#f2994a`), shown while the flag for ss-25 is not done.

### The Catchers after Act I

How the three behave at every point after their fight. One row per state; the step that ships the state is in brackets.

| State (condition) | Where they are | What they do | Talk |
|---|---|---|---|
| Before the fight | arena | the shipped fight; reason props visible beforehand (S-004) | sign only |
| Handed over, before `bloom` | arena, sitting | awake, dizzy-sitting pose (S-005, S-006) | `[E] Talk · <Name>`: lines from story.md |
| `bloom` set | arena | the shipped nap; `[E] Wake · <Name>` rematch (LOCKED) | Talk while awake after a rematch |
| Bloom cutscene | plaza edge | stand and watch (S-006) | - |
| `wennaAwake` to `moteNamed` | arena, napping by day | nap 07-18; 18-21 awake and sitting at the arena edge | Talk 18-21 |
| `moteNamed` onward (S-170) | plaza edge 18-21; arena otherwise | evenings at the plaza: Grumble `home.plaza_edge_n` anchor (−9, −10); Frostbun `home.plaza_edge_e` anchor (13, −2); Pinch `home.plaza_edge_s` anchor (−6, 17); nearest walkable, ≥ 3 m from every other NPC spot and the spawn (0, 13) | Talk at the plaza; one memory line per act each |
| Act III memories 4-6 | the Remembered Isle | younger selves ([#young-cast](#young-cast)) | scripted |
| ch21 The Second Sneeze | each at its own corner (arena), seen in a three-way cut-in | catch the three Starseeds: "Got it!" (Grumble) / "Mine! ...I mean, here." (Frostbun) / "Caught one, lad!" (Pinch) | scripted |
| ch21 lantern chain | the Crown boughs | each brings a lantern (always: story characters) | scripted |
| `mainEnding` onward | plaza 18-21, arena otherwise | napping by day; Rematch and, post-game, `[E] Dream · <Name>` ([creatures.md#dreams](./creatures.md#dreams)) | Talk |
| ch22 Hundred-Year Night | the plaza, with every Warden | celebrating | scripted + Talk |
| The Hundred Lamps floor 10 | o4 | the Three Corners Jamboree ([creatures.md#boss-jamboree](./creatures.md#boss-jamboree)) | handover-style lines |

Schedule rows from `moteNamed`: `[[7,'<arena>','doze'],[18,'home.plaza_edge_<x>','sit'],[21,'<arena>','sleep']]`. A
rematch is offered only at the arena (LOCKED: "Wake", never by walking in). Their GLBs at the plaza are 2.6-3.4 m;
each gets a `talkAt` offset of 2.8 m toward the plaza centre.

### Great-Aunt Flurry

- **id** `flurry` (boss key `boss_flurry`). **Yeti-bunny · 5.2 m.** She. Frostbun's huge snoozing aunt, asleep in the
  Snowglobe under Frostcap ([dungeons.md#o1](./dungeons.md#o1), [creatures.md#boss-flurry](./creatures.md#boss-flurry)).
- **Palette:** fur white `#fbfdff` with lavender-grey ear tips `#b8b4d0`, shawl knitted rose `#e88a8a` and cream
  `#fff3e0`, nightcap frost blue `#9fdcff` with a white pompom, knitting needles `#c99a4a`.
- **Look:** Frostbun's shape doubled and rounder, a rose knitted shawl, a frost-blue nightcap, knitting needles stuck in
  the shawl. Snores frost clouds.
- **Voice:** grand and drowsy; tic: drifts off mid-sentence and wakes with "...where was I? Ah." Rolled r's like her
  nephew. "Rrr. Visitors. In MY day visitors brought biscuits."
- **Afterwards:** awake and talkable in the Snowglobe; knits Pip a scarf (a cosmetic shown in third person, and in a
  Frostbun line); visits the ch22 plaza.
- **Portrait:** `portrait_flurry` (realm `home`). *"An enormous, elderly, very fluffy white yeti-bunny great-aunt with
  lavender-grey ear tips, a rose-and-cream knitted shawl with knitting needles stuck in it, a frost-blue nightcap with
  a white pompom, sleepy grand expression, a puff of frosty snore."*
- **ART BRIEF `boss_flurry` (owner GLB, batch 12):** silhouette: a huge soft dome with two tall ears. 5.2 m. Soft fur
  lobes, knitted shawl texture. Pose: sitting upright, then a curled nap pose (two GLBs or one with a `head` node). ≤
  12,000 tris. 3D: *"[3D preamble] an enormous elderly white yeti-bunny with lavender ear tips, rose knitted shawl,
  frost-blue nightcap, 5.2 m tall."* Fallback: `boss_frost` GLB scaled 1.53 with the shawl and cap as `extra` code
  meshes; if the GLB is missing, the shipped `bossDef('frost')` scaled the same way.

### Sir Rollo

- **id** `rollo` (boss key `boss_rollo`). **Pill-bug · 2.4 m long (1.4 m tall uncurled), 1.6 m ball curled.** He.
  Under the Roots ([dungeons.md#d1](./dungeons.md#d1), [creatures.md#boss-rollo](./creatures.md#boss-rollo)).
- **Palette (CANON):** plates slate blue `#5d6f8f` / `#7487a8`, cream bands `#efe3c8`, belly `#c9bfae`, legs
  `#3a4458`, antennae `#3a4458`, a dented tin helmet `#a0a0a8` with a red plume `#c2563f`.
- **Look:** a big, round, armoured pill-bug with cream bands between slate-blue plates, fourteen little legs, two long
  antennae, and a dented tin knight's helmet with a red plume (his "knighthood" is self-awarded). Curls into a perfect
  ball.
- **Voice:** formal and dizzy. Tic: "Sir Rollo, at your... oof." (he starts introductions and falls over). His reason:
  he has rolled the root tunnels flat for forty years "because nobody told me to stop".
- **Afterwards:** rolls Digby's tunnels flat on purpose (Digby is delighted); a racer in Clover's Dash at home (a
  rolling ghost on the course); plushie; Wake rematch; Dream (two Rollos).
- **Portrait:** `portrait_rollo` (realm `under_roots`). *"A big round friendly pill-bug knight with slate-blue armour
  plates and cream bands, lots of tiny legs, two long antennae, a dented tin knight's helmet with a red plume, dizzy
  swirly eyes, a proud little smile."*
- **ART BRIEF `boss_rollo` (owner GLB, batch 02):** silhouette: a segmented loaf with a plume; and a ball. 2.4 m long.
  Matte chitin plates, tin helmet. Poses: walking and curled (two GLBs `boss_rollo` and `boss_rollo_ball`, or one with
  a `curl` morph). ≤ 10,000 tris. 3D: *"[3D preamble] a big round pill-bug knight with seven slate-blue armour plates
  and cream bands, fourteen little legs, two antennae, a dented tin helmet with a red plume, 2.4 m long."* Fallback:
  seven `lathe` half-rings along z with alternating `#5d6f8f` / `#7487a8`, `torus` cream bands, 14 `capsule` legs, a
  `sphere` head with the helmet (`sphere` half + `cone` plume); curled = one `sphere` r 0.8 with a `colorFn` band
  pattern.

---

## Duskwick

Land: [atlas-isles.md#duskwick](./atlas-isles.md#duskwick). Palette `#2b2238` `#f2b45a` `#ff8f7a` `#3fa79a`. The
Wicklings are moon-moth folk; all use the `moth` rig (S-088) and realm tag `duskwick`.

<a id="granny-wick"></a>
### Granny Wick

- **id** `wick`. **Moon moth · 0.95 m** (antennae to 1.1 m). She. 112 years old; the last Lamplighter; 12 on the night
  of the Ladder. May say "Wenna".
- **Palette:** wings pale mint `#cfeedd` with lilac eyespots `#b8a6e0` ringed in gold `#f2b45a`, long wing tails
  `#a8d8c0`, body fluff cream `#fff4e0`, collar ruff white `#ffffff`, shawl plum `#5a3d6b`, spectacles gold `#f2c94c`,
  lamplighter's pole brass `#c99a4a` with a tiny lamp `#ffcf7a`, candle `#fff8e6`.
- **Look:** a small, very old moon moth with big pale-mint wings folded like a cloak, long trailing wing tails that
  brush the floor, a white fluffy collar, feathery antennae, round gold spectacles, a plum shawl, and a brass
  lamplighter's pole taller than she is with a tiny lit lamp on the hook. In first person the lamp on the pole is the
  marker: it is the only warm light in dim Wickhaven before the Tower is lit.
- **Voice:** dry humour, unhurried, kind. Tic: "Hm. Hm." while she pinches out her candle and relights it. "dear" is
  allowed for her. Calls Pip "young lamplighter" from the first beacon. Signature: "Light's not for keeping, dear.
  It's for passing on." / "Somebody is collecting them. Somebody who knows exactly where to look."
- **Sound cue:** a match strike and a soft *fwup* of a candle every 30 s; a brightening glow in her window as the twin.
- **Spots:** `duskwick.library` Granny Wick's Library, the ground floor of the Lamplighters' Tower on Tower Head (her
  home; its window is "the tower window" she kept lit for a century; the stair door up is locked from inside until
  `towerOpen`) · `duskwick.tower_step` the Tower Head step outside her door · the Tower's lamp room (ch12 scene) ·
  the Crown (ch21: the Firstlight returns to her first) · home plaza at the ending festival and ch22.
- **Schedule:** `[[7,'duskwick.library','work'],[18,'duskwick.tower_step','watch'],[21,'duskwick.library','sit'],
  [1,'duskwick.library','sleep']]`.
- **Arc:** the last lit window. ch8 explains the beacons, gives the Lamplighter's Chart and Lamp Log 1; reads Lamp Log
  2 over the chart after the first beacon; "Three lights. That's enough to wake the old lamp." In ch12 Mote takes the
  Firstlight from her hands while she says no; she does not blame him ("He cried. Thieves don't cry, dear. Lost
  children do."). Rewinds the Wickwork Moth. Receives the Firstlight back first in ch21. Gives Flick her old pole in the
  epilogue (the first apprentice in a century).
- **Owns:** [ss-16 Granny Wick's Library](./side-content.md#ss-16) (the Lamp Logs: shelf of 30). Appears in: ss-17,
  ss-43 (her nameplate, Roll Call), ch8, ch12, ch21, ch22.
- **Portrait:** `portrait_wick` (realm `duskwick`). *"A tiny, very old moon moth grandmother with large pale mint
  wings with lilac eyespots ringed in gold folded around her like a cloak, a fluffy white collar, feathery antennae,
  round gold spectacles, a plum shawl, holding a tall brass lamplighter's pole with a tiny glowing lamp, a dry fond
  smile."*
- **ART BRIEF `npc_wick` (owner GLB, batch 04):** silhouette: a cloak of two wide wings with long tails, feathery
  antennae and a pole taller than her. 0.95 m (1.1 m with antennae; pole 1.4 m). Wings thin painted planes with soft
  alpha edges; fluff as lobes; emissive lamp. Pose: standing, wings folded, pole held upright. ≤ 6,000 tris. 3D: *"[3D
  preamble] a tiny old moon moth grandmother, pale mint wings with lilac eyespots and long trailing tails folded like a
  cloak, white fluffy collar, feathery antennae, round gold spectacles, plum shawl, holding a tall brass lamplighter's
  pole with a small lamp, 0.95 m tall."* Fallback: `moth` rig with `tails: true`, spectacles two `torus`es, pole `extra`
  (`cyl` 1.4 m + a `torus` hook + a glowing `sphere`).

<a id="flick"></a>
### Flick

- **id** `flick`. **Young Wickling moth · 0.55 m.** She. Granny Wick's great-grandchild; would-be apprentice.
- **Palette:** wings orange-gold `#f2b45a` with coral eyespots `#ff8f7a`, fluff cream `#fff4e0`, a too-big
  lamplighter's cap `#2b2238` with a brass badge `#c99a4a`, toy pole `#8a5a30` with a paper lantern `#ff8f7a`.
- **Look:** small, fuzzy, wide-awake when everyone else is drowsy, a lamplighter's cap that slides over her eyes, a toy
  pole with a paper lantern. Always slightly in motion (wings flutter on `armL/armR` at 3 Hz).
- **Voice:** eager. Tic: "Can I light it?" (about anything). Calls Pip "Pip-the-lighter".
- **Sound cue:** a fast wing-flutter buzz near her; flickers of her paper lantern as the twin.
- **Spots:** `duskwick.wickhaven_square` (Wickhaven's centre deck) by day · `duskwick.library` evenings with
  Granny Wick · the Tower (ss-17, with the Wickwork Moth) · home plaza as the Duskwick visitor after the Tower is lit
  (see [#plaza-visitors](#plaza-visitors)).
- **Schedule:** `[[8,'duskwick.wickhaven_square','wander:8'],[17,'duskwick.library','sit'],[21,'duskwick.library','sleep']]`.
- **Arc:** wants to be a Lamplighter when there is nothing left to light. Helps rewind and befriend the Wickwork Moth
  (ss-17). Gets Granny Wick's old pole in the epilogue. Brings a lantern to ch21 (always: she is story-adjacent to
  Granny Wick).
- **Owns:** [ss-17 The Clockwork Apprentice](./side-content.md#ss-17). Appears in: ss-15, act-lagoon-lights.
- **Portrait:** `portrait_flick` (realm `duskwick`). *"A small, fuzzy, wide-eyed young moth girl with orange-gold
  wings with coral eyespots, a lamplighter's cap far too big for her sliding over one eye, holding a toy pole with a
  paper lantern, bursting with excitement."*
- **ART BRIEF `npc_flick` (batch 04):** 0.55 m. ≤ 2,500 tris. 3D: *"[3D preamble] a small fuzzy young moth with
  orange-gold wings and coral eyespots, oversized dark lamplighter's cap, holding a toy pole with a paper lantern,
  0.55 m tall."* Fallback: `moth` rig scaled 0.58, no tails, cap `cyl`, toy pole `extra`.

### The Wicklings

- **id** group `wicklings`; named members `wickling_taper`, `wickling_mallow`, `wickling_dimmity`; unnamed extras
  `wickling_1`...`wickling_6` (recolours). **Moon moths · 0.6-0.85 m.**
- **Palette:** dusk wings `#8f7aa8`, `#c9a46b`, `#7fb3a8`, `#d9a0a0` (one per extra), fluff `#f3e6d0`, aprons and caps
  in `#2b2238` / `#3fa79a`. Drowsy state: eyes half-closed, wings drooping 20°.
- **Members:** **Taper** (0.8 m, lamp-oil seller, owns ss-15), **Mallow** (0.75 m, poles the stilt-town punt; owns Lagoon
  Lights), **Dimmity** (0.7 m, gossip; knows every rumour and tells Pip where the Thief was seen).
- **Voice:** drowsy until the Tower is lit. Tic: yawns ("...mmh..."); after `beacon:duskwick`, "Bright, bright!"
- **Sound cue:** soft moth hum in Wickhaven; dusty glints when a wing moves.
- **Spots:** Wickhaven decks (`duskwick.wickhaven_*` from the atlas); Wickhaven is a town: no enemies ever.
- **Schedule:** drowsy idle on decks 08-20; after `beacon:duskwick` they light lanterns at 19:00 and dance on the
  lagoon decks 20-22.
- **Owns:** Taper: [ss-15 Moth to a Flame](./side-content.md#ss-15); Mallow:
  [act-lagoon-lights Lagoon Lights](./side-content.md#act-lagoon-lights).
- **Portraits:** `portrait_wickling_taper`, `portrait_wickling_mallow`, `portrait_wickling_dimmity` (realm
  `duskwick`). Taper: *"A drowsy plump moth shopkeeper with dusty lilac wings, an oil-stained apron and a small oil
  can."* Mallow: *"A lanky gentle moth with sand-gold wings in a teal cap, leaning on a punt pole."* Dimmity: *"A small
  chatty moth with sea-green wings and a knowing whisper, one hand cupped to her mouth."*
- **ART BRIEF `npc_wickling` (batch 04):** one moth mesh 0.75 m, ≤ 3,500 tris, four texture variants, cap and apron
  as toggled sub-meshes. Fallback: `moth` rig recolours.

### The Wickwork Moth

- **id** `wickwork` (boss key `boss_wickwork`). **Brass-and-paper automaton moth · 4.0 m wingspan, 2.2 m tall.** It
  (and "she" to Flick). Warden of the Lamplighters' Tower's great lamp
  ([creatures.md#boss-wickwork-moth](./creatures.md#boss-wickwork-moth), [dungeons.md#d5](./dungeons.md#d5)).
- **Palette:** brass `#c99a4a` and dark brass `#8a6a3a`, rivets `#6b4a2e`, paper wings `#f3ead2` with an ink spiral
  `#2b2238` and ink rule-lines, lens eyes `#ffe9a8` (emissive), a winding key `#c99a4a` on its back.
- **Look:** a Lamplighter machine: a brass body like a lantern housing, two great paper wings on brass ribs painted
  with the spiral, two big round lens eyes that glow, a winding key turning slowly on its back. It ticks.
- **Voice:** formal Lamplighter rules. Tic: "Tik. Tik." before a line; recites rules by number until rewound ("Rule the
  first: keep the lamp. Rule the second: let no one take it."). After Granny Wick rewinds it: "Tik. Rule the third,
  forgotten until now: pass it on."
- **Afterwards:** stands beside the great lamp, gentle; Flick's friend (ss-17); plushie; Wake rematch; Dream (mirrored
  beams).
- **Portrait:** `portrait_wickwork` (realm `duskwick`). *"A big gentle clockwork moth made of polished brass and
  painted paper, its paper wings decorated with an ink spiral, two round glowing lantern-lens eyes, a winding key on
  its back, rivets and little gears, dignified and a bit old-fashioned."*
- **ART BRIEF `boss_wickwork` (owner GLB, batch 09):** silhouette: a lantern with two huge rectangular-rounded
  wings. 4.0 m span. Brass flat-painted (no metalness map), paper wings with alpha-free painted texture, emissive eyes.
  Pose: hovering, wings half-open. Nodes `wingL`, `wingR` optional (flap). ≤ 12,000 tris. 3D: *"[3D preamble] a large
  clockwork moth automaton, polished brass lantern-like body, two big paper wings on brass ribs painted with an ink
  spiral, two round glowing lens eyes, a winding key on its back, 4 m wingspan."* Fallback: `lathe` brass body, two
  `rbox` wing plates (0.02 m thick) on `armL/armR`, two glowing `sphere` eyes, `extra` key (`torus` + `cyl`) rotating
  in `update`.

---

## Pinewhistle

Land: [atlas-isles.md#pinewhistle](./atlas-isles.md#pinewhistle). Palette `#2f4a3a` `#8fae9a` `#c98b4b` `#e8efe9`.
Realm tag `pinewhistle`. The `rodent` and `bird` rigs ship here (S-099) if not already built.

<a id="elder-nutmeg"></a>
### Elder Nutmeg

- **id** `nutmeg`. **Squirrel · 0.9 m** (1.1 m with tail curl). He. Head of the Acornet clan of Acornet Hollow.
- **Palette:** fur ginger `#c98b4b` with a grey muzzle `#b9b2a8`, belly cream `#f3e6d0`, bushy tail `#d9a06a`, acorn-cap
  hat `#8a5a30`, waistcoat pine green `#2f4a3a` with bulging pockets `#3f5f4a`, acorn buttons `#c98b4b`.
- **Look:** an elderly squirrel with a grey muzzle, an acorn cap worn as a hat, a green waistcoat whose pockets bulge
  with acorns, a magnificent tail curled over his head.
- **Voice:** fussy and generous. Tic: "For safekeeping!" (pockets anything handed to him mid-conversation).
- **Sound cue:** acorns clacking in his pockets; one drops and rolls as the twin.
- **Spots:** `pinewhistle.nutmeg_hollow` (the clan's hollow-stump hall in Acornet Hollow).
- **Schedule:** `[[7,'pinewhistle.nutmeg_hollow','work'],[19,'pinewhistle.nutmeg_hollow','indoors']]`. Before the pine
  sings, the Acornets are awake all night (pacing 22-04), because nobody can sleep.
- **Arc:** hoards sleepy acorns because the clan cannot sleep without the pine's song; after the beacon, gives them back
  (The Acorn Hoard: some are Wenna's Sleeping Acorns). Plaza visit: no (Pinfeather visits instead).
- **The Acornets** (`acornet_cobnut`, `acornet_filbert`, `acornet_pecan`, extras `acornet_1..4`; `rodent` rig
  0.55-0.75 m, tails `bush`, recolours `#b8734a`, `#c98b4b`, `#9a6a4a`, scarves `#8fae9a` / `#c2563f`): **Cobnut** (a
  scout who gets lost in the mist; owns ss-21), **Filbert** (carpenter of the rope bridges), **Pecan** (a kit who
  collects pine cones).
- **Owns:** [ss-19 The Acorn Hoard](./side-content.md#ss-19); Cobnut owns [ss-21 Lost in the Mist](./side-content.md#ss-21).
- **Portrait:** `portrait_nutmeg` (realm `pinewhistle`). *"An elderly ginger squirrel clan elder with a grey muzzle, an
  acorn cap worn as a hat, a pine-green waistcoat with pockets bulging with acorns, a huge bushy tail curled over his
  head, fussy but kind, holding up one acorn."* Cobnut: `portrait_acornet_cobnut`: *"A small young ginger squirrel
  scout with a red scarf and a too-big compass, looking slightly lost but brave."*
- **ART BRIEF `npc_nutmeg` (batch 05):** silhouette: a seated pear under a giant question-mark tail. 1.1 m with tail.
  ≤ 5,000 tris. 3D: *"[3D preamble] an elderly ginger squirrel with a grey muzzle, acorn-cap hat, green waistcoat with
  bulging pockets, huge bushy tail curled over his head, 1.1 m tall."* Fallback: `rodent` rig, `tail: bush` (a 9-node
  `tube` 0.9 m arching over the head, radius 0.12), cap half-`sphere` + stem `cyl`. Acornets: `npc_acornet`, ≤ 3,000
  tris, four texture variants (batch 06).

<a id="professor-pinfeather"></a>
### Professor Pinfeather

- **id** `pinfeather`. **Woodpecker · 0.95 m** (crest to 1.05 m). He. Hoot's academic rival; always right, never fun.
- **Palette:** black `#22242a`, white `#f4f1ea`, red crest `#d8402f`, beak slate `#5a5f6a`, tweed jacket `#8f7a5a` with
  elbow patches `#5a4a3a`, pince-nez `#c0c4cc`, notebook `#2f4a3a`.
- **Look:** a crisp black-and-white woodpecker with a red crest, a tweed jacket with elbow patches, pince-nez on a
  long chisel beak, a neat notebook, a pencil behind the crest.
- **Voice:** precise and dry. Tic: "Tok." before a correction ("Tok. Four thousand and *nine*, Hoot."). Calls Pip
  "young Pip". Every correction he makes is true.
- **Sound cue:** a woodpecker *tok-tok-tok* on a trunk every 25 s; bark chips as the twin.
- **Spots:** `pinewhistle.lecture_stump` (Acornet Hollow) · home plaza as the Pinewhistle visitor after
  `beacon:pinewhistle` (arguing with Hoot at `home.hoot_board` 16-18).
- **Schedule:** `[[8,'pinewhistle.lecture_stump','work'],[18,'pinewhistle.lecture_stump','indoors']]`.
- **Arc:** a rival who is right but lonely; Peer Review ends with the two professors co-signing a paper, each
  correcting the other's footnotes. Brings a lantern to ch21 if ss-20 is done.
- **Owns:** [ss-20 Peer Review](./side-content.md#ss-20) (Hoot appears).
- **Portrait:** `portrait_pinfeather` (realm `pinewhistle`). *"A crisp, precise black-and-white woodpecker professor
  with a bright red crest, pince-nez on a long beak, a tweed jacket with elbow patches, a pencil behind his crest,
  one eyebrow raised in polite disagreement."*
- **ART BRIEF `npc_pinfeather` (batch 05):** 1.05 m. ≤ 5,000 tris. 3D: *"[3D preamble] a black-and-white woodpecker
  professor with a red crest, pince-nez, tweed jacket with elbow patches, holding a notebook, 1.05 m tall."* Fallback:
  `bird` rig, `beak: 'chisel'`, crest a flattened `cone` fan.

### Mossmantle

- **id** `mossmantle` (boss key `boss_mossmantle`). **Sloth · 3.6 m** (hanging length). He. Warden of the Whistling
  Pine ([creatures.md#boss-mossmantle](./creatures.md#boss-mossmantle), [dungeons.md#d2](./dungeons.md#d2)).
- **Palette:** fur warm grey-brown `#9a8468`, face mask cream `#e8dcc4` with dark eye patches `#5a4a3a`, moss mantle
  `#6f8f5a` / `#8fae6a`, tiny flowers `#f7b6c8` / `#ffffff`, claws `#4a3a2a`.
- **Look:** a huge, gentle sloth wrapped in a cloak of living moss with tiny flowers, hanging upside-down from a bough
  by long claws, a sleepy smiling face mask with dark eye patches. Hoarse.
- **Voice:** very slow. Tic: "...mm..." between words. Kind reason: he hummed the pine's song himself for nine days so
  the squirrels could sleep, and is too hoarse to stop anyone gently. "I... mm... was... the song."
- **Afterwards:** hangs beside the Whistling Pine and hums duets with it at dusk (18-20); owns the Sawmill Song (the
  saws of Sawmill Run keep time with his hum); plushie; rematch; Dream (half speed except Pip).
- **Owns:** [ss-22 The Sawmill Song](./side-content.md#ss-22).
- **Portrait:** `portrait_mossmantle` (realm `pinewhistle`). *"A huge gentle sloth hanging upside-down from a pine
  bough, wrapped in a cloak of soft green moss with tiny pink and white flowers, a cream face with dark eye patches
  and a sleepy content smile, long curved claws, very relaxed."*
- **ART BRIEF `boss_mossmantle` (owner GLB, batch 05):** silhouette: a long hanging teardrop of moss with arms up.
  3.6 m. Moss as clumped lobes, fur painted. Poses: hanging (default) and sitting (handover). ≤ 12,000 tris. 3D: *"[3D
  preamble] a huge gentle sloth hanging from a branch, cloak of green moss with tiny flowers, cream face with dark eye
  patches, long claws, 3.6 m long."* Fallback: `capsule` body 0.9 × 2.4 m, moss `sphere` lobes (`colorFn` two greens),
  arm `capsule`s up to the bough anchor, `face()` with closed eyes.

---

## Archwater

Land: [atlas-isles.md#archwater](./atlas-isles.md#archwater). Palette `#36414f` `#7fd3d0` `#e2c9a0` `#6b4a8c`. Realm
tag `archwater`.

<a id="skipper-rafferty"></a>
### Skipper Rafferty

- **id** `rafferty`. **Otter · 1.15 m.** He. Captain of the Raft; loud, loyal, terrible singer.
- **Palette:** fur `#6b4a33`, belly and face `#ead7b8`, nose `#2a1a12`, patched coat slate `#36414f` with brass buttons
  `#c99a4a` and patches `#7fd3d0` / `#e2c9a0`, red bobble hat `#c2563f`, accordion `#6b4a8c` / `#f3ead2`.
- **Look:** a sturdy otter in a patched slate sea-coat and a red bobble hat, a squeezebox accordion on a strap,
  whiskers that bristle when he sings.
- **Voice:** booming and fond. Tic: bursts into song mid-line, marked "(sings)": "(sings) Oh the Raft, the Raft, she
  floats when she oughtn't..." Calls Pip "matey".
- **Sound cue:** off-key accordion wheezes across the Raft; the Raft's bunting jiggles as the twin.
- **Spots:** `archwater.raft_deck` (the Raft's centre deck) · `archwater.raft_cabin` (interior: Raft cabins) · home
  plaza as the Archwater visitor after `beacon:archwater` (singing by the pedestal 17-19).
- **Schedule:** `[[7,'archwater.raft_deck','work'],[19,'archwater.raft_deck','sing'],[22,'archwater.raft_cabin','sleep']]`.
- **The rafters** (`otter` rig, 0.7-1.05 m): **Marina** (net mender, calm; scarf `#7fd3d0`), **Spratt** (an otter kid
  who dives for shells; 0.6 m), **Old Bilge** (the cook; apron `#e2c9a0`; "Soup's on!" at 12:00 and 18:00).
- **Arc:** his Raft is beached by the stuck tide; after the beacon the tide turns and the Raft floats. The Raft Choir
  gives him the singers he never had (they are no better).
- **Owns:** [ss-24 The Raft Choir](./side-content.md#ss-24). Appears in: ss-23 (Clover's chalk arrows start at his
  deck).
- **Portrait:** `portrait_rafferty` (realm `archwater`). *"A sturdy, booming otter sea captain in a patched slate-blue
  sea coat with brass buttons, a red woolly bobble hat, an accordion on a strap, whiskers bristling, mouth wide open
  mid-song."*
- **ART BRIEF `npc_rafferty` (batch 07):** 1.15 m. ≤ 6,000 tris. 3D: *"[3D preamble] a sturdy otter sea captain,
  patched slate sea coat with brass buttons, red bobble hat, accordion on a strap, 1.15 m tall."* Fallback: `otter` rig,
  accordion `extra` (two `rbox` ends + a ribbed `cyl`). Rafters: `npc_rafter` ≤ 3,500 tris, three textures.

### Old Gloop

- **id** `gloop` (boss key `boss_gloop`). **Octopus · 4.0 m** (arm span 6 m). She. Warden of the Great Arch
  ([creatures.md#boss-gloop](./creatures.md#boss-gloop), [dungeons.md#d3](./dungeons.md#d3)).
- **Palette:** skin purple `#6b4a8c` with lighter suckers `#c9b6ec`, eyes gold `#f2c94c`, blush `#f59aa8`. **Socks, by
  arm number** (the boss tells use this numbering): 1 coral `#ff8f7a`, 2 sunflower `#f2c94c`, 3 mint `#7fd3d0`, 4 sky
  `#8fb8ff`, 5 rose `#f59aa8`, 6 lime `#9bd46a`, 7 lilac `#c9b6ec`, 8 orange-striped `#f2994a` / `#fff3e0` (missing: on
  Frostbun's ear; until ss-25 arm 8 wears a tied-on grey-blue dish-cloth `#9aa7b4` so its tell still has a colour).
- **Look:** a big, round, purple grandmotherly octopus with kind gold eyes and eight knitted socks, one per arm, all
  different.
- **Voice:** warm and burbly. Tic: "Blub." and counting on arms ("Arm three agrees. Arm five is not sure."). Kind
  reason: she has held the sea in place with all eight arms so the beached Raft does not tip over.
- **Afterwards:** lives in the Moon Pool under the Arch; runs Gloop's Juggling; owns Eight Socks and The Moon Pool;
  plushie; rematch; Dream (eight arms, one tell each).
- **Owns:** [ss-25 Eight Socks](./side-content.md#ss-25), [ss-26 The Moon Pool](./side-content.md#ss-26),
  [act-juggling Gloop's Juggling](./side-content.md#act-juggling).
- **Portrait:** `portrait_gloop` (realm `archwater`). *"A big round friendly purple octopus grandmother with kind gold
  eyes and pink cheeks, each of her curling arms wearing a different colourful knitted sock (coral, yellow, mint, sky
  blue, pink, lime, lilac) and one arm wrapped in a grey-blue dish-cloth, waving three arms at once."*
- **ART BRIEF `boss_gloop` (owner GLB, batch 07):** silhouette: a dome on eight curling arms. 4.0 m tall. Arms as
  separate nodes `arm1`..`arm8` (sock texture regions per arm) so the tell can tint one. ≤ 12,000 tris. 3D: *"[3D
  preamble] a big round purple octopus grandmother, kind gold eyes, eight curling arms each in a different colourful
  knitted sock, 4 m tall."* Fallback: `sphere` mantle, 8 `tube` arms (6 segments) with sock `tube` sleeves in the arm
  colours, `face()` with open eyes.

---

## Threemills

Land: [atlas-isles.md#threemills](./atlas-isles.md#threemills). Palette `#e7c45a` `#7fae4b` `#c2563f` `#a7d3f0`. Realm
tag `threemills`.

### Lady Honksworth

- **id** `honksworth` (boss key `boss_honksworth`). **Goose · 3.2 m.** She. Warden of Tumble Hill; "Your Honkship"
  ([creatures.md#boss-honksworth](./creatures.md#boss-honksworth), [dungeons.md#d4](./dungeons.md#d4)).
- **Palette:** feathers white `#f7f4ec` with grey-buff wing tips `#cfc4b0`, bill and feet orange `#f29b38`, straw bonnet
  `#e7c45a` with a poppy-red ribbon `#c2563f`, pearl necklace `#f4f1ea`.
- **Look:** a very large, very proud white goose in a straw bonnet with a red ribbon and a string of pearls, chest
  puffed, beak up. Exhausted (feathers ruffled) until the mills turn.
- **Voice:** grand. Marker "HONK" and "Your Honkship" (said to her). Tic: a capital "HONK." then a polite whisper.
  Kind reason: she has flapped the mill sails by hand so nobody goes hungry, and is exhausted and therefore extremely
  loud.
- **Afterwards:** hosts the Harvest Festival on Tumble Hill; owns Your Honkship; runs Harvest Cut; plushie; rematch;
  Dream (goslings copy her late).
- **Owns:** [ss-27 Your Honkship](./side-content.md#ss-27), [act-harvest-cut Harvest Cut](./side-content.md#act-harvest-cut).
- **Portrait:** `portrait_honksworth` (realm `threemills`). *"A very large, very proud white goose lady with an orange
  beak, a straw bonnet with a poppy-red ribbon, a string of pearls, chest puffed out and beak raised high, slightly
  ruffled and very dignified."*
- **ART BRIEF `boss_honksworth` (owner GLB, batch 08):** silhouette: an S-neck over a big teardrop, bonnet on top.
  3.2 m. ≤ 12,000 tris. Node `head` (the neck bends in moves). 3D: *"[3D preamble] a very large proud white goose in a
  straw bonnet with a red ribbon and pearls, 3.2 m tall."* Fallback: `bird` rig `beak: 'flat'` scaled 4.6 with a
  `tube` neck, bonnet `cyl` + `torus`.

<a id="goody-gander"></a>
### Goody Gander

- **id** `gander`. **Grey goose · 1.4 m.** She. Lady Honksworth's patient sister; the miller of Thrift Mill.
- **Palette:** feathers grey-brown `#a59d92` with a white face band `#f4f1ea`, bill `#f29b38`, flour-dusted apron
  `#f3ead2`, miller's cap `#7fae4b`, flour sack `#e2c9a0`.
- **Look:** a sensible grey goose in a flour-dusted apron and a green miller's cap, a sack of flour under one wing.
- **Voice:** soothing. Tic: "There, there." (to everyone, including her sister).
- **Spots:** `threemills.thrift_mill` (Thrift Mill door on Tumble Hill) · home plaza as the Threemills visitor after
  `beacon:threemills` (brings flour to Hazel's stall 10-12).
- **Schedule:** `[[6,'threemills.thrift_mill','work'],[19,'threemills.thrift_mill','indoors']]`.
- **Arc:** has spent her life calming a loud sister; at the Harvest Festival her sister thanks her in public (a one-line
  beat in ss-27).
- **Owns:** none (appears in ss-27, ss-05, ss-10).
- **Portrait:** `portrait_gander` (realm `threemills`). *"A calm, sensible grey goose miller with a white face band, a
  flour-dusted cream apron and a green miller's cap, a sack of flour under one wing, a patient soothing smile."*
- **ART BRIEF `npc_gander` (batch 08):** 1.4 m. ≤ 5,000 tris. 3D: *"[3D preamble] a calm grey goose miller in a
  flour-dusted apron and green cap, carrying a flour sack, 1.4 m tall."* Fallback: `bird` rig `beak: 'flat'`.

<a id="the-hayburys"></a>
### The Hayburys

- **id** group `hayburys`: `haybury_poppy` (Ma), `haybury_barley` (Pa), kits `haybury_oat`, `haybury_rye`,
  `haybury_millet`, `haybury_spelt`, `haybury_bran`, `haybury_wheatley`. **Field mice · adults 0.75 m, kits 0.35-0.45
  m.** The farming family of Haybury.
- **Palette:** fur fawn `#c9a27a`, ears pink `#f4b3b0`; Ma Poppy's gingham apron `#c2563f` / `#ffffff` and headscarf
  `#e7c45a`; Pa Barley's blue dungarees `#5d7fa8` and straw hat `#e7c45a`; kits' smocks in `#7fae4b`, `#a7d3f0`,
  `#e7c45a`, `#f59aa8`, `#c9b6ec`, `#ff8f7a`.
- **Look:** round-eared field mice; Ma with a pie dish, Pa with a pitchfork, six kits in a row of coloured smocks.
- **Voice:** Pa Barley: "Right as rain." Ma Poppy: "Mind the pies." The kits giggle in a cascade (never a line each).
- **Spots:** `threemills.haybury_porch` (their farmhouse porch in Haybury) · `threemills.orchard_rows` (Pa, 08-16) ·
  Haybury is a town: no enemies.
- **Schedule:** Ma `[[6,'threemills.haybury_porch','work'],[20,'threemills.haybury_porch','indoors']]`; Pa
  `[[6,'threemills.orchard_rows','work'],[17,'threemills.haybury_porch','sit'],[20,'threemills.haybury_porch','indoors']]`.
- **Arc:** a family rationing pies because the wheat will not ripen; the Harvest Festival ends the rationing.
- **Owns:** Ma Poppy owns [ss-30 Pie Rations](./side-content.md#ss-30). Appear in: ss-27, ss-28.
- **Portraits:** `portrait_haybury_poppy`: *"A plump, warm field-mouse farmer's wife with round pink ears, a yellow
  headscarf and red gingham apron, holding a steaming pie dish."* `portrait_haybury_barley`: *"A cheerful field-mouse
  farmer in blue dungarees and a straw hat, leaning on a pitchfork, a stalk of wheat in his mouth."* (realm
  `threemills`).
- **ART BRIEF `npc_haybury` (batch 08):** one mouse mesh at 0.75 m (≤ 4,000 tris) with two textures, one kit mesh at
  0.4 m (≤ 2,000 tris) with six smock textures. Fallback: `rodent` rig, `ears: round` large, `tail: thin`.

<a id="pennywhistle"></a>
### Pennywhistle

- **id** `pennywhistle`. **Scarecrow · 1.8 m.** He. Woke up a century ago and wants a crow friend.
- **Palette:** burlap face `#d9c193` with stitched smile `#5a4a3a`, button eyes `#3a2a20`, straw `#e7c45a`, patched coat
  `#7fae4b` with patches `#c2563f` / `#a7d3f0`, floppy hat `#8a6a4a`, a brass button heart `#f2b45a` that glows softly
  `#ffcf7a`.
- **Look:** a friendly scarecrow with a round burlap face, a stitched smile, two shiny button eyes, a floppy hat, a
  patched green coat leaking straw, and one brass button on his chest that glows softly. He stands on a pole in the
  field by day and steps down to talk. Daylight only reads: never shot in dark or eerie light (tone).
- **Why he is awake:** on the night of the Storm a Lamplighter sheltering in the field gave him the spare spark from a
  beacon lamp, pressed into a brass button ("given light"); he woke the next morning. Told by him in ss-28 as a happy
  memory.
- **Voice:** very polite. Tic: whistles three notes, "Fwee-fwoo-fwee.", before he speaks, and "Pardon my straw."
- **Sound cue:** the three-note whistle every 30 s; straw wisps blowing off him as the twin.
- **Spots:** `threemills.pennywhistle_field` (a wheat square below Tumble Hill).
- **Schedule:** `[[6,'threemills.pennywhistle_field','stand'],[17,'threemills.pennywhistle_field','sit'],
  [21,'threemills.pennywhistle_field','doze']]`. After ss-29, Rook sits on his hat 17-19.
- **Arc:** a scarecrow who frightens away the only friends he wants. Scarecrow Hats (he collects hats from every isle to
  look less scary); The Scarecrow Who Wanted Crows (Rook, who is not scared of anything, becomes his friend).
- **Owns:** [ss-28 Scarecrow Hats](./side-content.md#ss-28), [ss-29 The Scarecrow Who Wanted Crows](./side-content.md#ss-29).
- **Portrait:** `portrait_pennywhistle` (realm `threemills`). *"A friendly, gentle scarecrow in bright daylight with a
  round burlap face, a stitched smile, two shiny button eyes, a floppy brown hat, a patched green coat with straw
  poking out, one softly glowing brass button on his chest, tipping his hat politely, wheat field behind."*
- **ART BRIEF `npc_pennywhistle` (batch 08):** silhouette: a tall cross with a floppy hat. 1.8 m. Burlap and straw
  painted textures, emissive button. ≤ 5,000 tris. 3D: *"[3D preamble] a friendly scarecrow with a round burlap face
  and stitched smile, button eyes, floppy brown hat, patched green coat with straw, a small glowing brass button on
  his chest, 1.8 m tall."* Fallback: `sphere` head with `colorFn` burlap weave, stitched mouth `torus` arc, `rbox` coat,
  `capsule` arms straight out, straw tufts as yellow `cone` clusters, glowing `cyl` button (`glow: 0.6`).

---

## The Rootdeep

Land: [atlas-far.md#rootdeep](./atlas-far.md#rootdeep). Palette `#1c1a24` `#ffcf7a` `#7be0c8` `#8a5a3c`. Realm tag
`rootdeep`. Burrowbottom is a town: no enemies. Everyone down here lights their own way, so every NPC carries a glow
(a `glow: 0.6` part) that reads in the dark from 20 m.

<a id="gran-burrows"></a>
### Gran Burrows

- **id** `gran_burrows`. **Mole · 0.95 m.** She. Digby's grandmother; sees perfectly; finds his jokes awful; stitched
  the "For Spring" pouch. May say "Wenna".
- **Palette:** fur grey-brown `#6e5a4e`, muzzle `#c8a890`, nose `#f0a0a0`, shawl lilac `#b8a6d0`, apron `#8a5a3c`,
  reading glasses on a chain `#f2c94c`, glowcap lantern `#7be0c8`, thread `#6f8f3a` / `#f2c94c`.
- **Look:** Digby's shape, older and sharper-eyed (she has open, bright eyes), a lilac shawl, reading glasses on a
  chain she uses only for stitching, a little glowcap lantern on a hook.
- **Voice:** brisk and loving. Tic: "Heard it." (after any of Digby's jokes, before he finishes).
- **Sound cue:** a thimble tapping on a needle; her glowcap lantern swings as the twin.
- **Spots:** `rootdeep.gran_door` (her burrow door in Burrowbottom) · interior (Burrowbottom homes).
- **Schedule:** `[[7,'rootdeep.gran_door','work'],[19,'rootdeep.gran_door','indoors']]` (the Rootdeep has no sun; its
  clock still runs, and glowcaps dim 21-06).
- **Arc:** the grandmother who sent a near-blind grandson up to the surface to plant a spring "he could smell". Owns
  Burrowbottom Lamplight (the burrows' lamps dimmed with the roots) and Gran's Pouch (she mends the For Spring pouch and
  tells Pip why she made it).
- **The burrowers** (`mole` rig recolours, 0.8-1.0 m): **Teasel** (Digby's cousin, a tunneller), **Loam** (a mole who
  keeps glow-grubs as pets, not enemies), **Spud** (a kit who wants to see the sky).
- **Owns:** [ss-31 Burrowbottom Lamplight](./side-content.md#ss-31), [ss-33 Gran's Pouch](./side-content.md#ss-33).
  Appears in: ss-01, ch13.
- **Portrait:** `portrait_gran_burrows` (realm `rootdeep`). *"A sharp-eyed, loving old grey-brown mole grandmother with
  bright open eyes, a pink nose, a lilac shawl, reading glasses on a gold chain, holding a needle and green thread, a
  small glowing teal mushroom lantern beside her, unimpressed but fond."*
- **ART BRIEF `npc_gran_burrows` (batch 10):** 0.95 m. ≤ 5,000 tris. 3D: *"[3D preamble] an old grey-brown mole
  grandmother with bright eyes, lilac shawl, reading glasses on a chain, a small glowing mushroom lantern, 0.95 m
  tall."* Fallback: `mole` rig, no helmet, open `face()` eyes, shawl `torus`, lantern `extra`.

### Lumbra the Long

- **id** `lumbra` (boss key `boss_lumbra`). **Earthworm · 14 m long, body 1.2 m thick.** She. Rootdeep Warden; keeps
  the roots healthy ([creatures.md#boss-lumbra](./creatures.md#boss-lumbra), [dungeons.md#d6](./dungeons.md#d6)). May
  say "Wenna".
- **Palette:** body rose-earth `#c98a7a` with segment rings `#b06f62`, saddle band `#e0a090`, tiny round glasses
  `#f2c94c`, a moss scarf `#6f8f5a` at the "neck", glowing soil specks `#ffcf7a`.
- **Look:** an enormous, gentle earthworm with tiny round gold glasses perched where a nose would be, a short moss
  scarf, and soft segment rings. Only the front 4-6 m ever shows above ground at once.
- **Voice:** long and kind. Tic: "Mmm, loamy." and sentences joined with "and-so-on" ("The roots are tired and-so-on
  and the light is thin and-so-on, mmm, loamy.").
- **Afterwards:** ferries Pip between root-gates (`[E] Enter · Lumbra's ferry` at any open root-gate: a 4 s riding card,
  the same as the root-gate fast travel); owns Lumbra's Itch; plushie; rematch; Dream (holes move).
- **Owns:** [ss-32 Lumbra's Itch](./side-content.md#ss-32).
- **Portrait:** `portrait_lumbra` (realm `rootdeep`). *"The friendly face end of an enormous rosy earthworm peeking out
  of warm glowing soil, tiny round gold glasses, a short mossy scarf, soft segment rings, a gentle closed-mouth smile."*
- **ART BRIEF `boss_lumbra` (owner GLB, batch 10):** silhouette: a fat curving tube with glasses. 14 m; built as 12
  segment nodes `seg0`..`seg11` (head = `seg0`) so code can lay it on a spline. ≤ 12,000 tris. 3D: *"[3D preamble] an
  enormous gentle rosy earthworm in 12 segments, tiny round gold glasses, short moss scarf, 14 m long."* Fallback: 12
  `sphere`s r 0.6 on a spline, ring `torus`es between, head with `face()` and two `torus` lenses.

---

## The Glassway

Land: [atlas-far.md#glassway](./atlas-far.md#glassway). Palette `#bfeee6` `#f5e6c4` `#2f7d8c`. Realm tag `glassway`.
Puffin Post is a town: no enemies.

<a id="postmistress-pell"></a>
### Postmistress Pell

- **id** `pell`. **Puffin · 0.8 m.** She. Runs Puffin Post, the stilt post office; delivers found bottles' letters.
- **Palette:** back black `#22242a`, face and belly white `#f4f1ea`, beak orange `#f28a3a` with a blue-grey band
  `#7a8aa0` and yellow edge `#f2c94c`, feet `#f29b38`, postal cap and satchel teal `#2f7d8c` with a brass badge
  `#c99a4a`, rubber stamp `#c2563f`.
- **Look:** a neat little puffin with a striped parrot-like beak, a teal postal cap and satchel, a big rubber stamp.
- **Voice:** brisk, fussy about stamps. Tic: "Stamped!" Calls Pip "sender".
- **Sound cue:** a stamp *thunk* every 15 s; a puff of ink dust as the twin.
- **Spots:** `glassway.post_counter` (Puffin Post counter) · home plaza mailbox (`home.mailbox`, anchor (8, 18)) once a
  week, 09-10 on day % 7 == 0, after ch14.
- **Schedule:** `[[6,'glassway.post_counter','work'],[20,'glassway.post_counter','indoors']]`.
- **Arc:** a postmistress with a sack of letters nobody could deliver: the Bottle Chain letters wash up; Return to Sender
  delivers each to the descendant or place it was meant for.
- **Owns:** [ss-34 Return to Sender](./side-content.md#ss-34). Appears in: ss-10.
- **Portrait:** `portrait_pell` (realm `glassway`). *"A neat, brisk little puffin postmistress with a black back and white
  face, a striped orange, yellow and blue-grey beak, a teal postal cap with a brass badge and a teal satchel, holding
  up a big rubber stamp."*
- **ART BRIEF `npc_pell` (batch 11):** 0.8 m. ≤ 4,000 tris. 3D: *"[3D preamble] a neat puffin postmistress with a
  striped beak, teal postal cap and satchel, holding a rubber stamp, 0.8 m tall."* Fallback: `bird` rig `beak:
  'parrot'` (a tall flat `lathe` with `colorFn` bands).

<a id="mr-whelk"></a>
### Mr Whelk

- **id** `whelk`. **Hermit crab · 0.6 m** (with shell). He. Collector of rare shells.
- **Palette:** crab body coral `#f28a6a`, claws `#e0603a`, eyes `#2a1a12`, shell a blue-and-white porcelain teapot
  `#f5f7fb` with cobalt flowers `#3a6fb0`, jeweller's loupe brass `#c99a4a`.
- **Look:** a small coral hermit crab living in a blue-and-white porcelain teapot (spout at the back, lid as a hat), a
  jeweller's loupe in one eye.
- **Voice:** reverent about shells. Tic: "Rare. Very rare." (said of everything, including ordinary pebbles).
- **Spots:** `glassway.whelk_shop` (a shell stall on a sandbar islet, reachable at low tide or by boat).
- **Schedule:** `[[8,'glassway.whelk_shop','work'],[18,'glassway.whelk_shop','indoors']]` (indoors = inside the teapot).
- **Owns:** [ss-35 The Collector](./side-content.md#ss-35).
- **Portrait:** `portrait_whelk` (realm `glassway`). *"A small coral-red hermit crab gentleman living in a blue-and-white
  porcelain teapot with the lid worn like a hat, a brass jeweller's loupe in one eye, holding up a tiny spiral shell
  with great reverence."*
- **ART BRIEF `npc_whelk` (batch 11):** 0.6 m. ≤ 3,000 tris. 3D: *"[3D preamble] a small coral hermit crab living in
  a blue-and-white porcelain teapot, lid as a hat, jeweller's loupe, 0.6 m tall."* Fallback: `lathe` teapot body
  (`colorFn` cobalt dots), `cyl` spout, `sphere` lid; crab parts from the shipped `crab` enemy model scaled 0.6 with
  friendly eyes.

### Pelagia

- **id** `pelagia` (boss key `boss_pelagia`). **Ancient sea turtle · 3.0 m long, 1.6 m tall.** She. Young Shellby's best
  friend; Warden of the Sunken Bell ([creatures.md#boss-pelagia](./creatures.md#boss-pelagia),
  [dungeons.md#d7](./dungeons.md#d7)). May say "Wenna".
- **Palette:** shell sea-green `#3f7f6a` with plates `#5f9f86`, barnacles `#e8e0d0`, skin `#9fb8a0`, a small bronze bell
  on her shell `#b8894a`, a faded ribbon on one flipper `#e88a8a` (young Shellby tied it on 100 years ago), eyes
  `#2a1a12`.
- **Look:** a huge, slow, wise sea turtle with a barnacled sea-green shell, a little bronze bell fixed on top, a faded
  pink ribbon round one front flipper.
- **Voice:** few words. Tic: pairs of words ("Old friend.", "Ring true."), and "Ting." when amused. Kind reason: she keeps
  the bell silent, because the last time it rang the Ladder broke; the Stair Stone is its clapper. "You ring like
  Shellby did."
- **Afterwards:** stays at the Bell Shallows; Bell Duel; Old Friends ends with Shellby visiting her ledge at dusk; plaza
  visitor in ch22 (in the harbour, her head over the jetty).
- **Owns:** [act-bell-duel Bell Duel](./side-content.md#act-bell-duel). Co-stars in [ss-09](./side-content.md#ss-09)
  (Shellby owns it).
- **Portrait:** `portrait_pelagia` (realm `glassway`). *"A huge, ancient, wise sea turtle with a barnacled sea-green
  shell, a small bronze bell fixed on top of her shell, a faded pink ribbon tied round one front flipper, kind deep
  eyes, a slow gentle smile, sunlit shallow water."*
- **ART BRIEF `boss_pelagia` (owner GLB, batch 11):** silhouette: a broad dome with four flippers and a bell knob. 3.0
  m. ≤ 12,000 tris. 3D: *"[3D preamble] a huge ancient sea turtle, barnacled sea-green shell with a small bronze bell on
  top, faded pink ribbon on one flipper, 3 m long."* Fallback: `sphere` shell (sz 0.55, `colorFn` plates), four
  flattened `capsule` flippers, `sphere` head with `face()`, bell `lathe`.

### Bosun Snore

- **id** `snore` (boss key `boss_snore`). **Walrus · 2.4 m.** He. Snoozes aboard the wreck of the Merry Mabel (optional
  boss; [dungeons.md#o3](./dungeons.md#o3), [creatures.md#boss-bosun-snore](./creatures.md#boss-bosun-snore)).
- **Palette:** skin `#b8866a`, whiskers `#f3ead2`, tusks `#fff8e6`, striped jersey `#2a3a6a` / `#f4f1ea`, woolly hat
  `#c2563f`, bosun's whistle `#c99a4a`.
- **Look:** a vast sleepy walrus in a navy-and-white striped jersey and a red woolly hat, tusks, bushy whiskers, a
  brass bosun's whistle on a cord.
- **Voice:** tic: "...zzzrk..." inside the line ("Mine... zzzrk... the bell's mine... zzzrk... finders keepers.").
- **Deckhands:** three dozing seals **Doze**, **Drowse** and **Nod** (`otter` rig without ears, flipper arms, 0.9 m,
  grey `#8f97a3`, striped caps). They wake one at a time in the fight (creatures.md) and are never hurt.
- **Afterwards:** gives up the ship's bell for Pinch; moves to the Puffin Post pier and naps there; Dream: none.
- **Portrait:** `portrait_snore` (realm `glassway`). *"A vast sleepy walrus sailor in a navy-and-white striped jersey
  and a red woolly hat, big tusks, bushy whiskers, a brass whistle on a cord, eyes closed mid-snore with a little
  bubble from his nose."*
- **ART BRIEF `boss_snore` (owner GLB, batch 11):** 2.4 m. ≤ 10,000 tris. 3D: *"[3D preamble] a vast sleepy walrus
  sailor, striped jersey, red woolly hat, tusks, whiskers, brass whistle, 2.4 m long."* Fallback: large `lathe` body,
  `cone` tusks, `rbox` jersey bands via `colorFn`.

### Hummock

- **id** `hummock`. **The Snoozing Whale · about 40 m long** (an islet of the Glassway). She. Asleep for most of a
  century with a meadow, a palm and a picnic bench on her back.
- **Palette:** skin blue-grey `#5a7a8c` with a pale belly line `#c9dbe0`, barnacle clusters `#e8e0d0`, closed eye lid
  `#4a6470`, spout mist `#f4fbff`.
- **Look:** only her back (the islet) and, at the water's edge, one huge closed eye (2 m) and a slow spout every 40 s.
  The islet itself is atlas geometry ([atlas-far.md#glassway](./atlas-far.md#glassway)); this file owns the eye and
  spout props and her voice.
- **Voice:** heard, not seen talking. Tic: lines start "(from below)" and are slow ("(from below) Mmmrrr... itchy...").
  She wants to roll over, but people picnic on her back.
- **Owns:** [ss-37 The Whale Who Rolls Over](./side-content.md#ss-37).
- **Portrait:** `portrait_hummock` (realm `glassway`). *"The gentle closed eye of an enormous sleeping blue-grey whale at
  the waterline, long eyelashes, barnacles, a tiny grassy islet with a palm tree on her back, a puff of mist from her
  spout, peaceful."*
- **ART BRIEF `prop_hummock_eye` (batch 11):** the eye is a 2 m lidded half-`sphere` set into the islet edge with a
  blink every 12 s; the spout an additive mist sprite `fx_spout` (generated 256² webp, alpha). ≤ 800 tris.

---

## Kettle Isle

Land: [atlas-far.md#kettle](./atlas-far.md#kettle). Palette `#3b3540` `#e66f4f` `#f4d1a6` `#8fc7a0`. Realm tag `kettle`.
Forgefall is a town: no enemies.

<a id="master-scoria"></a>
### Master Scoria

- **id** `scoria`. **Bear · 1.9 m.** He. The smith of Forgefall; forged every sword Miso sells.
- **Palette:** fur honey `#d9a441` with a cream muzzle `#f4d1a6`, nose `#3a2a20`, leather apron `#6b4a2e`, goggles
  `#c99a4a` with smoked lenses `#3b3540`, hammer head `#8f97a3`, forge glow `#e66f4f`.
- **Look:** a big honey-coloured bear in a scorched leather apron, goggles up on his brow, a hammer in one paw, soot on
  his nose.
- **Voice:** few words. Tic: one-word verdicts ("Good." "Again." "Clang."). Calls Pip "smallsmith".
- **Sound cue:** an anvil *clang* every 4 s while the forges burn; sparks as the twin (after the stone is set; before,
  silence and cold forges, CANON: "the forges are out").
- **Spots:** `kettle.forge_door` (Scoria's forge, Forgefall) · interior (Scoria's forge).
- **Schedule:** `[[6,'kettle.forge_door','work'],[20,'kettle.forge_door','indoors']]`.
- **Arc:** a smith with cold forges; after the Kettle's stone he relights them; Starsteel (600 gems, [systems.md#economy](./systems.md#economy)) forges
  sword level 3 (3/3/4, reach 2.2 m; cuts thornglass); Miso's Supplier reveals the twins' supply chain. Runs the Sling
  Gallery.
- **Owns:** [ss-38 Starsteel](./side-content.md#ss-38), [act-sling-gallery Sling Gallery](./side-content.md#act-sling-gallery).
  Appears in: ss-39, ss-41.
- **Portrait:** `portrait_scoria` (realm `kettle`). *"A big, quiet honey-coloured bear blacksmith with a cream muzzle and
  soot on his nose, a scorched leather apron, brass goggles pushed up on his brow, a hammer in one paw, warm forge
  light on one side of his face."*
- **ART BRIEF `npc_scoria` (batch 12):** 1.9 m. ≤ 6,000 tris. 3D: *"[3D preamble] a big honey-coloured bear blacksmith
  in a leather apron, goggles on his brow, holding a hammer, 1.9 m tall."* Fallback: `bear` rig.

<a id="pitch"></a>
### Pitch

- **id** `pitch`. **Newt · 0.5 m.** She. Scoria's little apprentice who wants to forge "a star, a real one".
- **Palette:** skin orange-red `#e66f4f` with yellow spots `#f2c94c`, belly `#f4d1a6`, tiny welding goggles `#8fc7a0`,
  apron `#6b4a2e`, soot `#3b3540`.
- **Look:** a tiny eager newt with yellow spots, oversized green-lensed goggles, a mini apron, soot smudges, tongs
  taller than she is.
- **Voice:** tic: "Hot hot hot!" Calls Pip "Pip-pip".
- **Spots:** `kettle.forge_door` (beside Scoria) · home plaza as the Kettle visitor after `stone:kettle` (09-12 at Miso's
  counter, "studying the merchandise").
- **Schedule:** `[[7,'kettle.forge_door','work'],[19,'kettle.forge_door','indoors']]`.
- **Arc:** paid in ch21 with a star splinter (from the Second Sneeze) that she forges into a tiny star pendant; she gives
  it to Mote in ch22.
- **Owns:** [ss-39 Pitch Wants a Star](./side-content.md#ss-39).
- **Portrait:** `portrait_pitch` (realm `kettle`). *"A tiny eager orange-red newt girl with yellow spots, oversized
  green-lensed welding goggles, a little leather apron, soot smudges on her cheeks, holding tongs taller than herself,
  beaming."*
- **ART BRIEF `npc_pitch` (batch 12):** 0.5 m. ≤ 2,500 tris. Fallback: `newt` rig scaled 0.5.

<a id="soakley"></a>
### Soakley

- **id** `soakley`. **Capybara · 1.0 m.** He. Runs the Kettle Isle bathhouse; utterly calm in every crisis.
- **Palette:** fur `#9b7a56`, muzzle `#7a5a3e`, towel on the head white `#ffffff` with a teal stripe `#8fc7a0`, robe
  `#f4d1a6`, a small orange on his head when off duty `#f29b38`.
- **Look:** a round, square-snouted capybara with half-closed contented eyes, a folded towel on his head, a bath robe.
- **Voice:** tic: "No rush." Everything is "lovely". Never alarmed, even when the baths swing from cold to scalding.
- **Sound cue:** water lapping and a slow contented sigh; steam curls as the twin.
- **Spots:** `kettle.bath_desk` (the bathhouse desk, Bathhouse Terraces) · `kettle.bath_pool` (soaking 18-21).
- **Schedule:** `[[7,'kettle.bath_desk','work'],[18,'kettle.bath_pool','sit'],[22,'kettle.bath_desk','sleep']]`.
- **Arc:** keeps calm until the baths settle; after the stone, Lady Fumarole becomes his best regular. Runs Steam Hop.
- **Owns:** [ss-40 Soakley's Baths](./side-content.md#ss-40), [act-steam-hop Steam Hop](./side-content.md#act-steam-hop).
- **Portrait:** `portrait_soakley` (realm `kettle`). *"A round, utterly calm capybara with half-closed contented eyes, a
  folded white towel with a teal stripe on his head, a cream bath robe, steam drifting past, the most relaxed smile in
  the world."*
- **ART BRIEF `npc_soakley` (batch 12):** 1.0 m. ≤ 4,000 tris. Fallback: `rodent` rig, `tail: none`, body lathe ×
  1.4 wide, square snout `rbox`, towel `rbox`.

### Lady Fumarole

- **id** `fumarole` (boss key `boss_fumarole`). **Giant fire-newt · 4.4 m.** She. Warden of the Kettle
  ([creatures.md#boss-fumarole](./creatures.md#boss-fumarole), [dungeons.md#d8](./dungeons.md#d8)).
- **Palette:** skin ember red `#e66f4f` with glowing specks `#ffcf7a` (emissive 0.3), belly `#f4d1a6`, bath towel
  pink-and-cream stripes `#e88a8a` / `#f4d1a6`, towel turban `#8fc7a0`, a rubber duck `#f2c94c`.
- **Look:** a huge glamorous fire-newt wrapped in a striped bath towel with a towel turban, a rubber duck tucked under one
  arm, glowing specks on her skin.
- **Voice:** tic: "Darling." and a steam sigh "Hffff." Kind reason: the Stair Stone fell into the spout and keeps the
  Kettle simmering instead of boiling over; she won't let anyone touch it until the heat has somewhere else to go.
- **Afterwards:** Soakley's bathhouse regular (in `kettle.bath_pool` 14-18); plushie; rematch; Dream (rising bath
  water).
- **Portrait:** `portrait_fumarole` (realm `kettle`). *"A huge glamorous ember-red fire-newt lady with glowing golden
  specks, wrapped in a pink-and-cream striped bath towel with a mint towel turban, a yellow rubber duck under one arm,
  steam rising, a theatrical sigh."*
- **ART BRIEF `boss_fumarole` (owner GLB, batch 12):** 4.4 m. ≤ 12,000 tris; emissive specks in the texture's alpha or
  a second emissive map. 3D: *"[3D preamble] a huge glamorous fire-newt in a striped bath towel and towel turban,
  glowing specks, rubber duck under one arm, 4.4 m tall."* Fallback: `newt` rig scaled 8.8, towel `lathe`.

---

## Saltglass Flats

Land: [atlas-far.md#saltglass](./atlas-far.md#saltglass). Palette `#efe3c8` `#c9a46b` `#8ec9d8` `#b55d4c`. Realm tag
`saltglass`. Sablecamp is a town: no enemies.

<a id="sable"></a>
### Sable

- **id** `sable`. **Jerboa · 0.7 m (1.0 m with ears).** She. Archaeologist of Sablecamp; over-excited about pottery.
- **Palette:** fur sand `#e2c79a` with a white belly `#fff8e6`, ears pink `#f4b3b0`, tail tuft `#3b3540` / `#ffffff`,
  pith helmet `#efe3c8` with a band `#b55d4c`, khaki shirt `#c9a46b`, brush `#8a5a30`, notebook `#8ec9d8`.
- **Look:** a tiny big-eared jerboa on long hind legs, a pith helmet, a khaki shirt with many pockets, a dusting brush,
  a long tufted tail.
- **Voice:** tic: the find-then-deflate pattern ("A POT! ...Oh. A rock. A lovely rock."). Calls Pip "colleague".
- **Sound cue:** brush swishes on stone; a puff of sand as the twin.
- **Spots:** `saltglass.sable_tent` (Sablecamp) · `saltglass.dig_site` (her current trench, moves per ss-42 step).
- **Schedule:** `[[6,'saltglass.dig_site','work'],[12,'saltglass.sable_tent','sit'],[14,'saltglass.dig_site','work'],
  [19,'saltglass.sable_tent','indoors']]`.
- **The dig crew:** **Grit** (a tortoise, 0.6 m, sifts sand very slowly; `turtle` rig no beard, sun hat `#efe3c8`) and
  **Quill** (a porcupine note-taker, 0.7 m, `rodent` rig with `spines`, spectacles).
- **Arc:** finds the Buried Academy and, in Sable's Dig, a real pot at last (it is a Lamplighter lamp). Plaza visitor
  after `stone:saltglass`.
- **Owns:** [ss-42 Sable's Dig](./side-content.md#ss-42). Appears in: ss-43.
- **Portrait:** `portrait_sable` (realm `saltglass`). *"A tiny, over-excited sand-coloured jerboa archaeologist with
  huge pink ears, a pith helmet with a red band, a khaki shirt with many pockets, holding a dusting brush and a
  cracked pottery shard, eyes shining."*
- **ART BRIEF `npc_sable` (batch 13):** 1.0 m with ears. ≤ 4,000 tris. Fallback: `rodent` rig, `ears: long`, `tail:
  tuft`, long hind-leg `capsule`s.

### Tutor Scarabelle

- **id** `scarabelle` (boss key `boss_scarabelle`). **Hourglass beetle · 2.2 m.** She. Still sets the Lamplighter
  Academy's final exam; Warden ([creatures.md#boss-scarabelle](./creatures.md#boss-scarabelle),
  [dungeons.md#d9](./dungeons.md#d9)). May say "Wenna". Calls Pip "student".
- **Palette:** shell two glass bulbs `#d8eef2` (alpha 0.7) with flowing sand `#c9a46b`, brass frame `#b55d4c` / `#c99a4a`,
  legs `#3b3540`, a teacher's pointer `#8a5a30`, a ribbon-bound bell at her collar `#c99a4a`.
- **Look:** a tall, upright beetle whose wing case is an hourglass: two glass bulbs in a brass frame with real sand
  running down (a particle stream). Half-moon reading lenses, a teacher's pointer. When time is up she turns herself
  over, and the sand runs the other way.
- **Voice:** tic: "Pencils down." and "Time!" Kind reason: keeps the school standing for students who may yet come; the
  Stair Stone is the bell's weight, given only to someone who has passed the final exam.
- **Afterwards:** sets the Exam Retake (a quiz from gossip the player heard), Roll Call (nameplates of young Granny
  Wick and young Pelagia); stays at the Academy; plushie; no Dream (her encounter is an exam).
- **Owns:** [ss-43 Roll Call](./side-content.md#ss-43), [ss-44 The Exam Retake](./side-content.md#ss-44).
- **Portrait:** `portrait_scarabelle` (realm `saltglass`). *"A tall, dignified beetle schoolteacher whose back is a
  brass-framed hourglass with golden sand flowing inside, half-moon reading lenses, holding a wooden pointer, a small
  bell tied with ribbon at her collar, strict but secretly proud."*
- **ART BRIEF `boss_scarabelle` (owner GLB, batch 13):** silhouette: an hourglass on six legs. 2.2 m. Glass as an
  alpha material (one material), sand as a separate inner mesh node `sand` the code animates. ≤ 12,000 tris. 3D: *"[3D
  preamble] a tall beetle schoolteacher whose back is a brass-framed hourglass with sand inside, half-moon lenses,
  wooden pointer, 2.2 m tall."* Fallback: two `lathe` glass bulbs (`opacity 0.6`), brass `cyl` frame, sand cones
  scaled by time, six `capsule` legs, `face()` with lenses.

---

## The sky

Driftholm ([atlas-far.md#driftholm](./atlas-far.md#driftholm), palette `#c9b6ec` `#f7f2ff` `#9bb87a`, realm tag
`driftholm`) and the Starmeadow ([atlas-far.md#starmeadow](./atlas-far.md#starmeadow), palette `#141a3a` `#ffe9a8`
`#8fa8ff`, realm tag `starmeadow`). Mote's Meadow is a town: no enemies. All Starkin use the `starkin` rig: emissive
toon body (`glow: 1`, never lit by scene lights), a soft round face disc, two dot eyes, an additive glow sprite
(`fx_starkin_glow`, generated 256² webp, alpha, core). They hover; they cast no shadow. In first person a Starkin is
also a light source: each carries one `PointLight`-free fake glow (a ground decal `fx_glow_pool`, additive, r = height),
so the per-view light budget is unchanged.

<a id="mote"></a>
### Mote

- **id** `mote` (manifest `npc_mote`). **Starkin · 1.0 m, hovering 0.2 m above the ground.** He. Wenna's little
  brother; the antagonist; "the Lamp Thief" until `moteNamed` (charter: who may say which name). Pip never hits him.
- **Palette:** light core pale gold `#fff2c4`, glow `#ffcf7a`, face disc cream-gold `#fff8e6`, dot eyes `#2a1a12`,
  worried mouth `#c98b4b`; cloak deep navy-violet `#2a3358` with patches of sea-glass `#7fd3d0`, lilac `#c9b6ec`, faded
  sailcloth `#e9d8b0` and moth-wing scraps `#cfeedd`; firefly jars `#f2c94c` (emissive); a cracked beacon lens worn as a
  brooch `#ffe9a8` with a dark crack line `#8a6a3a`; tears are sparks `#ffe9a8`.
- **Look:** a child-sized figure of soft pale-gold light inside a patched cloak stitched from everything he has gathered
  in a hundred years: sea-glass, sailcloth, moth-wing scraps, three tiny firefly jars dangling from the hem, and a
  cracked beacon lens pinned at his throat like a brooch. His face is a soft round glow with two dot eyes and a small
  worried mouth. No feet: the cloak's hem trails into a wisp. When upset his light flickers (emissive intensity
  0.6-1.0 at 9 Hz for 0.8 s); when he cries, sparks fall. Holding borrowed light, his cloak glows from inside the
  pocket where he keeps it.
- **States (the model and the portrait):** `cloaked` (the Lamp Thief: hood up, face hidden in shadow except two eye
  glints; ch8-II.M), `open` (hood down, from II.M), `bright` (after the ending: no cloak patches lit, light core
  `#ffffff` with glow `#ffe9a8`, a small star pendant from Pitch in ch22).
- **Voice:** quick, earnest, a little sharp, never cruel; talks to himself; dry jokes. Tic: counting what he has
  ("Forty-one fireflies, three lighthouse sparks, one moon on a puddle. Not enough. Never enough."). He calls Pip
  "the seed-bearer" until ch21, then "Pip". Signature lines (CANON): "I'm not stealing. I'm *borrowing*. Like your
  guardians did." / "Give it to me. Please. It's the only one strong enough." / "You saw it, didn't you. In her roots.
  ...She'd have come with me if it weren't for all of you." / "Every hundred years, then?"
- **Sound cue:** a faint music-box tinkle that rises in pitch as he gets closer; his glow pool on the ground as the
  twin. In a chase the tinkle is louder when Pip is within 20 m (the chase rule).
- **Where he is, by beat:**

| Beat | Where | What |
|---|---|---|
| ch8 (`thiefSeen`) | Duskwick, the tower stair | a cloaked light flees upward (S-090) |
| Act II glimpses | each isle at its first night after arrival, high on its landmark | a moving light that leaves when Pip comes within 40 m |
| II.M (`moteNamed`) | on the second relit beacon's lamp | lands, cross and flickering, talks, takes nothing, leaves |
| after II.M | Driftholm (seen from home) | some nights (one in three) a single moving light on the sky isle |
| ch12 (`act2done`) | the Tower's lamp room | asks for the Firstlight; Granny Wick says no; he takes it, crying sparks, and climbs into the NE sky |
| ch18 | Driftholm, then the Spiral Stair | the chase (creatures.md#boss-mote-chase); at the Spiral Arch he pulls his Ladder up |
| ch19-20 | the Starmeadow, the Ladder | seen above, winding lights |
| ch21 | the Crown | the Second Sneeze; Given Light; goes home |
| `mainEnding` onward | his star, the new one just above the Tree (a sky billboard, atlas-home) | - |
| ch22 | the home plaza in the Hundred-Year Night | visits, brighter; Talk; Pitch gives him her star pendant |
| post-game | Moonmere (his imagined home) has his letters, not him; Driftholm keeps his Tally Wall | - |

- **His places (his case, shown before the player judges him; tone Always 5):** the Tally Wall on Driftholm (a hundred
  years of marks; every tenth mark has a note, ss-45), a hundred scrap lamps in Mote's Meadow, his patched shelter,
  Moonmere and the twelve unsent letters ([lore.md#mote-letters](./lore.md#mote-letters), ss-47).
- **Arc:** came down a hundred years ago to bring his sister home; stranded on Driftholm when the Storm broke the Ladder;
  has counted lights ever since; believes the bloom means she is burning out and borrows the beacons to build a Ladder
  fast; is wrong only about what she wants; learns from the memories and Brightwell that given light holds a ladder
  for one night and harms no one; climbs home on everyone's lanterns; comes back for the Hundred-Year Night. "Every
  hundred years, then?" "Every hundred years. Keep a hanky handy."
- **Owns:** [ss-45 Mote's Tally](./side-content.md#ss-45), [ss-47 Letters Never Sent](./side-content.md#ss-47).
  Appears in: ss-39, ss-48, ch8-ch22.
- **Portraits** (realm none, core; one sheet, 2 × 2, 1024², sliced): `portrait_mote_cloaked`, `portrait_mote`,
  `portrait_mote_cross`, `portrait_mote_bright`. Prompt: *"Four portraits of the same small star-child made of soft
  pale-gold light, with a round glowing face, two small dark dot eyes and a tiny worried mouth, wearing a patched
  navy-violet cloak stitched from sea-glass, sailcloth and moth-wing scraps, with three tiny firefly jars hanging from
  the hem and a cracked glass lens pinned at his throat like a brooch, each alone on transparent background in a 2 × 2
  grid: top-left hood up, face hidden in shadow except two glinting eyes; top-right hood down, earnest and a little
  sad; bottom-left cross and flickering, sparks falling like tears; bottom-right glowing bright white-gold and smiling,
  cloak glowing softly."*
- **Glow sprite:** `fx_mote_glow` (256² webp, alpha): *"a soft round pale-gold glow with a faint warm halo, additive,
  centred, transparent background"*. **Fallback** for every Mote key: a canvas radial gradient `#fff2c4` → transparent.
- **ART BRIEF `npc_mote` (owner GLB, batch 14):** silhouette: a small rounded cone of cloak under a round glowing head,
  hood optional, a trailing wisp instead of feet, three tiny jars at the hem. 1.0 m (+0.2 m hover). Materials: emissive
  body and face (unlit), cloak a painted patchwork texture (unlit-friendly, soft), jars emissive. Nodes `head`,
  `armL`, `armR`, `hood` (hideable). ≤ 5,000 tris. 2D: the turnaround with the house preamble. 3D: *"[3D preamble] a
  small star-child made of soft pale-gold light with a round glowing face, two dot eyes and a tiny mouth, inside a
  patched navy-violet cloak of sea-glass, sailcloth and moth-wing scraps with a hood, three tiny glowing jars at the
  hem, a cracked glass lens brooch, no feet (the cloak trails into a wisp), 1.0 m tall."* **Procedural (CANON §14):**
  capsule body (`glow: 1`, `#fff2c4`), a cloak shell (`lathe` open cone, `colorFn` patch grid of the cloak hexes, back
  faces rendered), a hood (half `sphere` shell, toggled), face disc (`cyl` 0.02 thick, `#fff8e6`), two `INK` dot eyes,
  a small mouth `torus` arc, three `cyl` jars (`glow: 1`, `#f2c94c`), the brooch (`cyl` `#ffe9a8` + a dark `box` crack),
  and the additive glow sprite at the chest. Flicker and spark tears are code (a pooled sprite emitter, ≤ 24 sprites).

<a id="the-nimbles"></a>
### The Nimbles

- **id** group `nimbles`; named `nimble_fluffington` (the one Mote named and talked to); extras `nimble_1..8`. **Round
  cloud creatures · 0.6-1.2 m.**
- **Palette:** white `#f7f2ff`, lilac shade `#c9b6ec`, dot eyes `#2a1a12`, cheeks `#f7b6c8`, Fluffington's tiny scarf
  `#9bb87a` (knitted by Mote from a sail thread).
- **Look:** puffy round clouds with two dot eyes, pink cheeks and two stub feet; they drift and bounce.
- **Voice:** no words. Tic: "(toot)", "(toot toot)". Mote's Tally Wall note: "Day 3,650: talked to a cloud. It didn't
  answer." Fluffington is that cloud; in ss-46 it answers, once, with a toot.
- **Spots:** Nimble Downs (`driftholm.nimble_downs`, herds drifting `wander:20`); Fluffington at `driftholm.motes_shelter`.
- **Owns:** [ss-46 Nimble Herding](./side-content.md#ss-46) (Fluffington).
- **Portrait:** `portrait_nimble_fluffington` (realm `driftholm`). *"A small round puffy white cloud creature with lilac
  shading, two dot eyes, pink cheeks, two stubby feet and a tiny green knitted scarf, bouncing happily."*
- **ART BRIEF `npc_nimble` (batch 14):** 0.6-1.2 m (one mesh, scaled). ≤ 1,500 tris. Fallback: `nimble` rig (6 merged
  `sphere`s, `face()` dot eyes).

<a id="old-mother-brightwell"></a>
### Old Mother Brightwell

- **id** `brightwell`. **Starkin · 6.0 m.** She. The eldest Starkin, huge and slow; explains given light. May say
  "Wenna". Calls Pip "little light".
- **Palette:** body soft gold `#ffe9a8` (emissive), aura blue `#8fa8ff`, face disc `#fff8e6`, dot eyes `#141a3a`, a
  shawl of tiny star points `#ffffff` on `#2a3358`.
- **Look:** a vast, round, gently glowing Starkin grandmother resting on a cloud island, her face a soft disc with two
  sleepy dot eyes and a slow smile, a shawl that looks like a piece of the night sky with stars in it.
- **Voice:** very slow and warm. Tic: lines end "...little light." Teaches the old way: when Wenna sneezes her letter, the
  sky may answer with a ladder of given light, which stays up one night and harms no one; reveals T6 in ch19.
- **Spots:** `starmeadow.brightwells_rest` (Brightwell's Rest). In the Hundred-Year Night she is seen descending the
  given-light ladder (a sky shot, no talk).
- **Portrait:** `portrait_brightwell` (realm `starmeadow`). *"A vast, round, gently glowing star grandmother made of soft
  gold light, a round face with two sleepy dark dot eyes and a slow kind smile, a shawl like a piece of the night sky
  full of tiny stars, resting on a cloud, deep blue sky."*
- **ART BRIEF `npc_brightwell` (batch 14):** 6.0 m, seated. ≤ 6,000 tris, unlit material. 3D: *"[3D preamble] a vast
  round star grandmother made of soft glowing gold light, round face with dot eyes, starry night-sky shawl, seated, 6 m
  tall."* Fallback: `starkin` rig scaled 6, shawl a `lathe` shell with a `colorFn` star sprinkle. `talkAt` 4 m in front
  of her face.

<a id="the-twinklings"></a>
### The Twinklings

- **id** group `twinklings`: `twinkling_glim`, `twinkling_lumen`, `twinkling_twink`, and the shy fourth
  `twinkling_peep`. **Small Starkin · 0.45 m.** They (as a group).
- **Palette:** Glim gold `#ffe9a8`, Lumen blue `#8fa8ff`, Twink rose `#ffb8c8`, Peep lilac `#c9b6ec`; face discs
  `#fff8e6`, dot eyes `#141a3a`.
- **Look:** three small round glowing Starkin, each a different colour, bobbing in a row; Peep is smaller (0.35 m) and
  half-hidden behind a cloud.
- **Voice:** they speak as one, in rhyming pairs ("You point, we glow. / Up the rungs we go!"). Peep says only
  one word per line.
- **Behaviour (Act IV chapter partners, F27):** they fly 2-8 m ahead of Pip inside the view cone (charter rule 4); when
  Pip aims at a dark rung and presses `{tool}` (or `{interact}` on a rung marker), the nearest Twinkling flies to it and
  lights it in 1.2 s. They never fight and cannot be hurt. They go home after ch21.
- **Spots:** `starmeadow.lower_lanterns` (met in ch19); the Ladder floors (ch20); Peep after the ending at
  `starmeadow.brightwells_rest`, behind Brightwell.
- **Owns:** Peep owns [ss-48 The Little Star](./side-content.md#ss-48) (post-game).
- **Portraits:** `portrait_twinklings` (group, realm `starmeadow`): *"Three small round glowing star children in a row,
  gold, pale blue and rose, each with a round soft face, two dot eyes and a cheerful smile, bobbing in a deep blue
  sky."* `portrait_twinkling_peep`: *"A tiny shy lilac glowing star child peeking out from behind a small cloud, two dot
  eyes, a nervous little smile."*
- **ART BRIEF `npc_twinkling` (batch 14):** 0.45 m, ≤ 800 tris, unlit, four tints. Fallback: `starkin` rig scaled
  0.45.

---

<a id="young-cast"></a>
## Young cast

Who appears in the twelve memories on the Remembered Isle ([lore.md#memories](./lore.md#memories),
[atlas-home.md#remembered-isle](./atlas-home.md#remembered-isle)), a hundred years ago. CANON §14: young Shellby and
the young Catchers are the existing models **scaled and recoloured**; Pip's GLB is never touched. All young-cast keys
carry `realm: 'remembered'`. Built in S-189; art in [art-audio.md#young-cast](./art-audio.md#young-cast). The
Remembered Isle palette is sepia and gold (`#e9d8b0` `#b8894a` `#6f5a44`); every young-cast model takes a 25 % warm
sepia tint on top of its own colours (a `mix(color, #e9d8b0, 0.25)` in the look record), so memory people read as
memory.

| id | Who (memories) | How it is built | Size | Look and palette | Voice in memories |
|---|---|---|---|---|---|
| `young_shellby` | a tiny turtle in a too-big hat (4-6, 10-12) | `turtle` code rig (`npcDef('shellby')` variant): no beard, no brows, no staff; the GLB is not used because its beard cannot be hidden | 0.55 m (rig × 0.48) | skin brighter `#b8d070`; shell all moss `#7aa63a` with no mushrooms; robe cream `#f0e2c0`; a straw sun hat 0.5 m wide `#e7c45a` with a green leaf `#7cc048`, tipped over his eyes; a satchel `#a86a3a` | says "dear" to nobody yet; tic: "S-slowly does it." (he is the slowest runner on the beach) |
| `young_grumble` | a smaller, cheerful Grumble (4-6) | `boss_shroom` GLB × 0.5; materials multiplied toward a lighter, warmer cap; if the GLB has a separable crown node (check node names), hide it; otherwise keep it | 1.6 m | cap lighter `#b08ae0`, no baby shroom (hide the node if separable), beard short (a code `extra` cone does not replace the GLB beard) | laughs a lot: "Ha! Catch! Got it!" |
| `young_pinch` | a Pinch with no hat yet (4-6) | `boss_crab` GLB × 0.55 with the hat node hidden if separable; else the shipped code `bossDef('crab')` without its hat | 1.4 m | shell brighter `#f0705a`, no barnacles (code fallback) | "Aye, aye! ...Is that how skippers talk?" |
| `young_frostbun` | a Frostbun the size of a rabbit (4-6) | `boss_frost` GLB × 0.18 | 0.6 m | as now, ice crystals tiny | three sleepy words a line, rolled r's already |
| `young_wick` | young Granny Wick, aged 12 (5, 9) | `moth` rig × 0.62 | 0.6 m | wings brighter mint `#dff8ea`, eyespots `#c9b6ec`, no spectacles, no shawl, a hair ribbon `#ff8f7a`, a toy pole | "Can I light it?" (Flick's tic is inherited: Flick says it because Granny Wick told her she used to) |
| `young_pelagia` | young Pelagia, racing young Shellby on the beach (6) | `boss_pelagia` code rig × 0.35 (the GLB if present, scaled) | 1.0 m long | shell `#5f9f86`, no barnacles, no bell; the pink ribbon `#e88a8a` is tied on during memory 6 | "Race you! ...Again!" |
| `lamplighter_*` | the Lamplighters (1, 3, 7-9, 10) | `moth` rig recolours, 0.8-1.0 m | 0.8-1.0 m | moon-moth wings in pale mint, gold and lilac; long navy coats `#2b2238` with brass buttons; each carries a lamplighter's pole with a lit lamp; the spiral embroidered on every coat back `#f2c94c` | names and lines are in lore.md |
| `mote` | Mote, unchanged (2, 7-11) | `npc_mote` | 1.0 m | `open` state, slightly brighter (he had more light then) | as now, less sharp |

Young-cast portraits (realm `remembered`): `portrait_young_shellby` (*"A tiny young turtle boy with bright green skin
and a mossy shell, a straw sun hat far too big for him tipping over his eyes, a cream robe and a little satchel, sepia
storybook memory tones, determined little smile."*), `portrait_young_wick` (*"A 12-year-old moon moth girl with bright
mint wings with lilac eyespots, a coral hair ribbon, holding a toy lamplighter's pole, sepia memory tones, eager."*),
`portrait_young_pelagia` (*"A young sea turtle girl with a smooth sea-green shell and a pink ribbon on one flipper,
splashing in sunny shallows, sepia memory tones, laughing."*). The young Catchers reuse their adult portraits with a
sepia filter applied at runtime (CSS `filter: sepia(0.35)` on the dialogue portrait) rather than new images. The
memory scene's speaker name shows "Young Shellby" only in ch22 and in the journal after `trueEnding`; before that it
shows "A young turtle" (charter: Shellby as the bottle-writer is never stated before ch22).

**ART BRIEF `npc_young_shellby` (owner GLB, batch 10):** silhouette: a small dome shell under an enormous flat hat
(the hat as wide as he is tall). 0.55 m. ≤ 2,500 tris. 3D: *"[3D preamble] a tiny young turtle boy, bright green skin,
mossy shell, cream robe, a huge straw sun hat with a green leaf tipped over his eyes, a little satchel, 0.55 m tall."*

---

<a id="plaza-visitors"></a>

## Plaza visitors and cross-land appearances

When an isle's beacon is kindled or a Stair Stone is set, "one islander visits the plaza" (CANON §4.4). The visitor
arrives the next morning at 08:00 and keeps a daily plaza slot for the rest of the game.

| Trigger | Visitor | Home plaza spot (anchor) | Hours | What they do |
|---|---|---|---|---|
| `beacon:pinewhistle` | Professor Pinfeather | `home.hoot_board` (beside Hoot's Board) | 16-18 | argues with Hoot |
| `beacon:archwater` | Skipper Rafferty | `home.plaza_edge_sw` (−9, 12) | 17-19 | sings near the pedestal |
| `beacon:threemills` | Goody Gander | `home.hazel_stall` (−13, 9.5) | 10-12 | brings flour to Hazel |
| `beacon:duskwick` (the Tower) | Flick | `home.pedestal_side` (4, 9) | 09-12 | asks Wenna if she can light her |
| `stone:bell` | Pelagia | `home.jetty` (her head over the jetty edge) | 18-20 | visits Shellby (after ss-09 also at the bell ledge) |
| `stone:kettle` | Pitch | `home.miso_counter_side` (11, 15) | 09-12 | studies Miso's merchandise |
| `stone:saltglass` | Sable | `home.great_tree_root_w` (−6, −4) | 13-16 | "digs" politely at the roots with a brush |
| `moteNamed` | the three Catchers | plaza edges (see [#the-catchers-after-act-i](#the-catchers-after-act-i)) | 18-21 | sit and talk |
| `mainEnding` (festival days: every 7th day) | Kinako's bazaar | `home.jetty` | all day | docks at home |

All anchors are placed nearest walkable, ≥ 3 m from every other NPC spot and from the spawn (0, 13). The ending
festival, the act-end festivals and the ch22 Night put **everyone met** (`met:<npc>`) in the plaza by the rules in
[story.md](./story.md) (festival layout and the lantern chain list are story's).

---

## Side stories and activities by owner

One owner per side story. Where CANON names the owner, it is copied; where it does not, the owner is decided here
(see Decisions). Steps, dialogue and rewards are in [side-content.md](./side-content.md).

| ss | Title | Owner | Also appears |
|---|---|---|---|
| 01 | For Spring | Digby | Gran Burrows |
| 02 | The Long Nap | Grandpa Dormy | - |
| 03 | Nothing Is Refundable | Miso | Kinako, Granny Mochi |
| 04 | The Mayor Goes to Sea | Mayor Ribbit | Nell, Goody Gander |
| 05 | A Bun for Every Isle | Hazel Thimble | one person per isle |
| 06 | The Duck Regatta | the Quackenbushes (Admiral Dabble) | Mayor Ribbit |
| 07 | Puddle's Grotto | Puddle | Mayor Ribbit |
| 08 | Little Thistledown | Primrose Thistledown | Clem, the Wicklings |
| 09 | Old Friends | Elder Shellby | Pelagia |
| 10 | The Parcel With No Name | Mayor Ribbit | 6 villagers, 3 Catchers, 3 isle folk |
| 11 | Grumble's Nephews | Grumble Shroom | Button, Chanty, Puff |
| 12 | Frostbun's Great-Aunt | Frostbun | Great-Aunt Flurry |
| 13 | Shellby's Slow Walk | Elder Shellby | - |
| 14 | The Fourth Bough | Wenna | - |
| 15 | Moth to a Flame | Taper (Wickling) | Flick |
| 16 | Granny Wick's Library | Granny Wick | - |
| 17 | The Clockwork Apprentice | Flick | the Wickwork Moth, Granny Wick |
| 18 | Kinako's Limited Edition | Kinako | one person per isle |
| 19 | The Acorn Hoard | Elder Nutmeg | the Acornets |
| 20 | Peer Review | Professor Pinfeather | Professor Hoot |
| 21 | Lost in the Mist | Cobnut (Acornet) | Mossmantle |
| 22 | The Sawmill Song | Mossmantle | Filbert |
| 23 | Clover's Map | Clover | Skipper Rafferty |
| 24 | The Raft Choir | Skipper Rafferty | the rafters |
| 25 | Eight Socks | Old Gloop | Frostbun |
| 26 | The Moon Pool | Old Gloop | Professor Hoot |
| 27 | Your Honkship | Lady Honksworth | Goody Gander |
| 28 | Scarecrow Hats | Pennywhistle | one hat per isle |
| 29 | The Scarecrow Who Wanted Crows | Pennywhistle | Rook |
| 30 | Pie Rations | Ma Poppy Haybury | Hazel Thimble |
| 31 | Burrowbottom Lamplight | Gran Burrows | the burrowers |
| 32 | Lumbra's Itch | Lumbra the Long | - |
| 33 | Gran's Pouch | Gran Burrows | Digby |
| 34 | Return to Sender | Postmistress Pell | bottle recipients |
| 35 | The Collector | Mr Whelk | - |
| 36 | The Merry Mabel | Captain Pinch | Bosun Snore |
| 37 | The Whale Who Rolls Over | Hummock | Postmistress Pell |
| 38 | Starsteel | Master Scoria | - |
| 39 | Pitch Wants a Star | Pitch | Mote (ch22) |
| 40 | Soakley's Baths | Soakley | Lady Fumarole |
| 41 | Miso's Supplier | Miso | Master Scoria, Kinako |
| 42 | Sable's Dig | Sable | Grit, Quill |
| 43 | Roll Call | Tutor Scarabelle | Granny Wick, Pelagia |
| 44 | The Exam Retake | Tutor Scarabelle | - |
| 45 | Mote's Tally | Mote | - |
| 46 | Nimble Herding | Fluffington (the Nimbles) | - |
| 47 | Letters Never Sent | Mote | - |
| 48 | The Little Star | Peep (Twinkling) | Old Mother Brightwell |
| 49 | Rook's Races | Rook | Pennywhistle |
| 50 | The Three Corners Jamboree | Grumble Shroom (for the Catchers) | Captain Pinch, Frostbun |
| 51 | Dream a Little | Grandpa Dormy | every napping boss |
| 52 | Hoot's Last Paper | Professor Hoot | Professor Pinfeather |
| 53 | The Planting | Wenna | - |

Activities: Clover's Dash (Clover), Vista Sketches (Hoot), Fishing (Nell), Duck Regatta (the Quackenbushes), Spore
Rally (Grumble Shroom), Sledding (Frostbun), Gloop's Juggling (Old Gloop), Harvest Cut (Lady Honksworth), Lagoon Lights
(Mallow, for the Wicklings), Bell Duel (Pelagia), Sling Gallery (Master Scoria), Steam Hop (Soakley).

---

## Art by brief batch

Which batch file (`docs/roadmap/briefs/batch-NN.md`, written by the close-out steps) carries each character's owner GLB
brief. The brief text is the one in this file; the batch copies it.

| Batch | Characters |
|---|---|
| 02 | Sir Rollo |
| 03 | Nell, Puddle, and the shipped villagers' GLB briefs (Ribbit, Clover, Hoot, Digby) |
| 04 | Granny Wick, Flick, the Wicklings, Kinako, Mote (cloaked state first look) |
| 05 | Elder Nutmeg, Professor Pinfeather, Mossmantle |
| 06 | Rook, Grandpa Dormy, the Acornets |
| 07 | Skipper Rafferty and the rafters, Old Gloop, Granny Mochi, Hazel Thimble, the Quackenbushes |
| 08 | Lady Honksworth, Goody Gander, the Hayburys, Pennywhistle, Primrose and the kits |
| 09 | the Wickwork Moth |
| 10 | Gran Burrows and the burrowers, Lumbra the Long, the young cast |
| 11 | Postmistress Pell, Mr Whelk, Pelagia, Bosun Snore and the seals, Hummock's eye |
| 12 | Master Scoria, Pitch, Soakley, Lady Fumarole, Great-Aunt Flurry |
| 13 | Sable, Grit, Quill, Tutor Scarabelle |
| 14 | Mote (final), the Nimbles, Old Mother Brightwell, the Twinklings |
| 15 | the shroomlet nephews (Undercap), festival outfits for the Night |

Portraits are generated in the step that ships the character (they are needed for the dialogue frame), never deferred
to a batch.

---

## Decisions made here

CANON leaves these open; this file decides them. A later owner decision overrides any of them.

1. **Heading anchors** follow INDEX's `cast#...` links exactly (`### Nell`, `### Mote`, `## Catchers`, `## Home`,
   `## Young cast`), so the full names appear in the first line of the entry, not the heading.
2. **Data-driven looks:** new characters are look records (`NPC_LOOKS`) read by one `npcDef` case per rig family; the
   rig families and the step that builds each are listed in [#rig-families](#rig-families).
3. **Portraits:** 512² webp with alpha, ≤ 60 KB, key `portrait_<id>`, core for home and travelling cast, realm-tagged
   otherwise; the dialogue frame shows one when present. Wenna and Mote get face-state sheets. No generated Pip portrait
   (the GLB render is used).
4. **GLB keys and budgets:** `npc_<id>` / `boss_<id>`; people ≤ 6,000 tris and ≤ 450 KB, Wardens ≤ 12,000 tris and ≤
   700 KB, small folk ≤ 2,500 tris; optional `head`/`armL`/`armR` nodes.
5. **The six shipped villagers keep their shipped spots at every hour until `wennaAwake`**, so Act I and its tests do
   not change; schedules start after it.
6. **Frostbun is "he"** (Digby's shipped line); Great-Aunt Flurry is his aunt.
7. **Shellby has no cottage** ("My house is on my back, dear."); his evening spot is the Sprout Village Lamplighter
   bench, anchor (−6, 10), which is also "Shellby's bench" for ch22.
8. **Ribbit lives on a lily pad on the village pond** (anchor (−13, 25)), making the shipped "Best lily pad in town"
   literal; the Quackenbushes live on the Meadow pond (−70.6, 21.8).
9. **Hoot's study** is an interior behind a round door on the nearest round tree to his Woods spot (4.3, −61.6), placed
   by `placePortals`; it is the entrance to Hoot's Margins. Hoot counts stars at the Cairn foot (94, −44) at night.
10. **Digby's night planting** (22:00-23:00) is how the player discovers the "For Spring" gardener and starts ss-01.
11. **Miso and Kinako's sulk** began twenty years ago over whose name goes first on the shop sign; it ends with
    "Miso & Kinako's — Nothing is refundable." Miso stitches and sells the 6 hood trims.
12. **Kinako's bazaar rotation:** docks in a newly unlocked land on its first day, then one unlocked land per day in
    chart order; Granny Mochi and the journal map show where; it stays put while a quest needs it; at home every 7th day
    after the ending.
13. **Named minor cast** (all original): the kits Bramble, Sorrel, Clem (the stowaway), Dot; the ducks Admiral Dabble,
    Dilly, Dally, Quilliam, Bobbin; the shroomlet nephews Button, Chanty, Puff; the Wicklings Taper, Mallow, Dimmity;
    the Acornets Cobnut, Filbert, Pecan; the rafters Marina, Spratt, Old Bilge; the Hayburys Ma Poppy, Pa Barley and
    kits Oat, Rye, Millet, Spelt, Bran, Wheatley; the burrowers Teasel, Loam, Spud; the seals Doze, Drowse, Nod; the dig
    crew Grit and Quill; the Nimble Fluffington; the Twinklings Glim, Lumen, Twink and the shy fourth Peep; the Snoozing
    Whale Hummock. Add each to the glossary ([charter.md](./charter.md)) in the PR that first uses it.
14. **Side-story owners** not named by CANON: ss-10 Ribbit, ss-11 Grumble, ss-12 Frostbun, ss-14 Wenna, ss-15 Taper,
    ss-16 Granny Wick, ss-17 Flick, ss-18 Kinako, ss-19 Nutmeg, ss-20 Pinfeather, ss-21 Cobnut, ss-22 Mossmantle,
    ss-24 Rafferty, ss-25 and ss-26 Gloop, ss-27 Honksworth, ss-28 and ss-29 Pennywhistle, ss-30 Ma Poppy, ss-31 and
    ss-33 Gran Burrows, ss-32 Lumbra, ss-34 Pell, ss-35 Whelk, ss-36 Pinch, ss-37 Hummock, ss-38 Scoria, ss-39 Pitch,
    ss-40 Soakley, ss-42 Sable, ss-43 and ss-44 Scarabelle, ss-45 and ss-47 Mote, ss-46 Fluffington, ss-48 Peep, ss-50
    Grumble (for the three), ss-51 Grandpa Dormy.
15. **Old Gloop's sock colours** are numbered 1-8 for the boss tells; arm 8's sock is the one on Frostbun's ear, and a
    grey-blue dish-cloth stands in until ss-25.
16. **Pennywhistle woke** from a beacon spark a sheltering Lamplighter pressed into a brass button on the night of the
    Storm (given light); told as a happy memory, in daylight.
17. **Granny Wick's Library is the ground floor of the Lamplighters' Tower** (her home; "the tower window"); the stair
    door up is the locked one.
18. **Plaza visitors:** Pinfeather (Pinewhistle), Rafferty (Archwater), Goody Gander (Threemills), Flick (the Tower),
    Pelagia (the Bell), Pitch (the Kettle), Sable (Saltglass), with the hours and anchors in
    [#plaza-visitors](#plaza-visitors). The Catchers' plaza anchors are (−9, −10), (13, −2) and (−6, 17).
19. **Rook's five race lands:** Pinewhistle, Archwater, Threemills, Saltglass Flats, Driftholm; his nest is on Gull
    Rock in the Glassway.
20. **Pitch forges the ch21 star splinter into a pendant and gives it to Mote in ch22**; Mote's `bright` state wears it.
21. **Mote's form names** `cloaked` / `open` / `bright`; he calls Pip "the seed-bearer" until ch21; after II.M he is
    seen on Driftholm one night in three.
22. **New speech markers** (table in [#voice-summary-new-speech-markers-to-reserve](#voice-summary-new-speech-markers-to-reserve)),
    including parenthesised stage directions as tics for Puddle "(tiny voice)", Hummock "(from below)", the Nimbles
    "(toot)" and Rafferty "(sings)". The charter must reserve them.
23. **Nicknames for Pip:** "lad" (Pinch), "kitten" (Mochi), "little one" (Dormy), "first mate" (Nell), "young
    lamplighter" (Granny Wick), "Pip-the-lighter" (Flick), "rival" (Rook), "young Pip" (Pinfeather), "matey"
    (Rafferty), "big friend" (Puddle), "sender" (Pell), "smallsmith" (Scoria), "Pip-pip" (Pitch), "colleague" (Sable),
    "student" (Scarabelle), "valued customer!!" (Kinako), "the seed-bearer" then "Pip" (Mote), "little light"
    (Brightwell).
24. **Young cast build:** young Shellby uses the code turtle rig (the GLB beard cannot be hidden); the young Catchers are
    their GLBs scaled (× 0.5, × 0.55, × 0.18) with hat/crown nodes hidden only if separable; all young-cast models get
    a 25 % sepia tint; their memory speaker names stay descriptive until ch22.
25. **Starkin lighting:** unlit emissive materials plus an additive ground glow decal, never real point lights, to keep
    the per-view budgets.
26. **Big characters** (> 2.5 m) get a `talkAt` offset so the first-person prompt pill sits where the player looks.
27. **Night-only Dormy** talks through his door at 21:00-23:00 until his interior ships.
28. **Lantern-chain hints** in entries here ("brings a lantern if ...") are suggestions; the authoritative list and its
    save conditions are [story.md#lantern-chain](./story.md#lantern-chain).
29. **Primrose calls Pip "sweetpea"**, keeping "dear" for the very old (charter reserved markers).
30. **Home NPC-spot anchors added here** (all nearest walkable, own-RNG post-pass, prints unchanged): Shellby's bench
    (−6, 10), Ribbit's pad (−13, 25), Hoot's Cairn spot (94, −44), Digby's For Spring patch (−85, 10), Hazel's stall
    (−13, 9.5), the mailbox (8, 18), the Catchers' plaza edges (−9, −10) / (13, −2) / (−6, 17), visitor spots (−9, 12),
    (4, 9), (11, 15), (−6, −4), the festival duck spot (−14, −2). atlas-home.md lists them in its pass table and may
    nudge a coordinate by ≤ 2 m if a prop already sits there.
31. **Act II glimpses of the Lamp Thief:** on each isle's first night after Pip arrives, a moving light sits high on the
    landmark and leaves when Pip comes within 40 m (no scene, no line), so the thief is felt between ch8 and II.M.
