# CANON-NOW — what Starseed Isle already says (audit of main @ b79d73d, 2026-11-21)

Purpose: everything a writer or implementation agent must stay consistent with before adding lore, regions, realms or
side stories. Sources read: `docs/DESIGN.md`, `README.md`, `js/data.js` (all text), `js/interact.js`, `js/cutscenes.js`,
`js/ui.js`, `js/hud/nav.js`, `js/targeting.js`, `js/bosses.js`, `js/completion.js`, `js/world.js`, `js/props.js`,
`js/models.js`, `js/sky.js`, `assets/manifest.js`, the painted sprites/key art in `assets/`, and a read-only dump of
`generateWorld(7151)` (positions below are seed 7151, rounded to 0.1 m).

Status words used here:
- **LOCKED** = must not change (shipped text players have read, save keys, frozen placements, the owner's art calls).
- **EXTEND** = keep, and new content may add to it.
- **SOFT** = thin or placeholder; safe to rewrite or deepen as long as the listed constraints hold.

---

## 0. Ground rules already in force

| Rule | Where it lives | Status |
|---|---|---|
| Original IP only: setting, characters, names and art are original; never imitate another game | DESIGN §preamble, owner brief | LOCKED |
| Tone: "kind and gentle. Enemies 'poof', Pip gets 'dizzy', nobody is hurt for real." Regular enemies easy on purpose; bosses "ask for some respect without being hard" | DESIGN §1 | LOCKED |
| Sprout Village is safe: no enemy ever spawns there (`REGIONS[0].enemies: []`, `max: 0`) | data.js, DESIGN §7 | LOCKED |
| Danger is telegraphed: every attack has a coral halo, pulse, glint and pose, ≥ 0.55 s before it can hurt; at most two attackers at once | DESIGN §7 | LOCKED |
| Danger is opt-in at the edge: boss arenas are sealed rings at path ends; rematches start only on "Wake", never by walking in | DESIGN §8 | LOCKED |
| Failure is soft: at 0 HP "Pip got dizzy!", wakes by the Great Tree, full hearts, gems kept, no harm | DESIGN §6, combat.js | LOCKED |
| The whole island is open from the first second; any order | DESIGN §1 | EXTEND (new realms may gate, the home isle must not) |
| Home island generation (seed 7151) is frozen: `tests/fixtures/world-prints.json`; new home content only via post-passes on their own RNG (`placeShells`, `placeLanterns`, `placeSecrets`) | world.js, ARCHITECTURE | LOCKED |
| One save slot, `SAVE_KEY = 'starseed-isle-save-v2'`, schema `SAVE_VERSION` 6 with `MIGRATIONS[n]` | data.js, save.js | LOCKED |
| Pip's GLB (`assets/models/hero.glb`, split arm `armR`, steel one-piece sword) must not be replaced; the owner prefers the soft painterly generated look for characters over code-built | owner memory, PR #24/#28 | LOCKED |
| "No quest log: the tracker's Errands chip is the only UI" | DESIGN §9 | SOFT (owner's new 80–120 h direction needs a journal; this sentence is the one to retire) |
| Research tone charter (REPORT §12.2 #28): village never unsafe; nothing dies; every guardian seen content after the bloom; sadness only in the past tense; any hard thing is opt-in; nothing in a night/memory state is missable; no errand/secret gates the first ending. Skip on purpose: late-revealed dark power, "it was all a dream", an interrupting companion | research REPORT §12 | EXTEND (adopt as the written charter) |

Spelling and voice in shipped text: British spellings in UI/settings ("colour", "Centre", "practising"), but the
in-game word is **"cozy"** (title subtitle "a cozy little adventure", sign "Population: cozy", door line "cozy fire").
Exclamation-friendly, short sentences, gentle puns, tildes (`~`) only in Miso's speech, `✿` as the game's flourish
glyph in notes/toasts/the ending card, `{tokens}` (`{interact}`, `{jump}`, `{dash}`, `{attack}`, `{map}`) for controls
inside lines. Pip never speaks; he is "he/him" in docs and lines. Villagers address him as "Pip", "little Pip",
"dear", "little sprout".

---

## 1. Premise and timeline (as stated in game)

- **Inciting event** (Shellby's intro, page 1): "Last night the Great Tree sneezed. A big, sad, leafy sneeze... and
  its three Starseeds went flying!" The game starts the morning after (new game at time of day 0.4, mid-morning).
- **The theft** (page 2): "Three grumpy guardians scooped them up: Grumble Shroom in the Whispering Woods up north,
  Frostbun in the Frostcap Peaks to the east, and Captain Pinch on the Sunny Shores to the south." DESIGN §1 says they
  are "hoarding" them. **No reason is ever given for why they keep them.**
- **Stakes** (page 3): "Without its Starseeds the Tree is wilting. Bring them home to this old pedestal, in any order
  you like. Off you sprout!" The Tree has a **sleepy face** (closed arcs, blush) while wilting and a **droopy moss
  canopy**; after the bloom it has an **awake face** (open eyes with white glints, bigger smile) and pink/gold blossoms.
- **Placing**: each Starseed flies from Pip's hand into one of **three star-shaped sockets** on the altar
  ("A mossy stone pedestal with three little star-shaped sockets."). After one or two: "The Great Tree rustles happily
  and perks up a little! N more Starseeds to go."
- **Ending**: with all three, the view looks up the trunk, the tree blooms, the camera cranes around the crown, card:
  "✿ Starseed Isle is blooming again! ✿ / Thanks for playing / The isle is yours to explore. Press any button to
  continue." (touch: "Tap to continue."). Free roam continues; village music becomes the ending theme; compass reads
  "The isle is blooming ✿". Pedestal afterwards: "The three Starseeds hum happily in their sockets. The Great Tree is
  thriving!"
- **Recurring time marker: "a hundred years".** The bottle: "the Great Tree sneezes about once every hundred years."
  Shellby (all rematches won): the guardians "say it was the most fun they have had in a hundred years."
  So: the sneeze is cyclical, someone in the past knew it, and the guardians are at least ~100 years old.

Status: the sneeze, three seeds, three guardians, three sockets and the bloom are **LOCKED** (the ending art, key art,
tests and the playthrough suite depend on them). "Thanks for playing" and "The isle is yours to explore" are **SOFT**:
at 80–120 h the bloom becomes the close of the first act, and this card is the text to rewrite.

---

## 2. Characters

### 2.1 Pip (player)
- "A tiny kid in a leaf-green, fox-eared hood with a little steel sword." ~1 m tall; FP eye 0.88 m. Sprite/GLB:
  leaf-green hood with fox ears and **a two-leaf sprout on top of the hood**, brown bangs, cream tunic, brown belt
  with gold buckle, green capelet with a leaf clasp, boots. Palette in the code fallback: greens `#7aa63a` / `#8fbf45`,
  skin `#ffdcbf`, cream `#f3e3c3`, brown `#7a4a2e`, sprout `#8fd14f`.
- Starter sword: plain steel blade since 2026-11 (code/balance still say "wooden": `CFG.reachWood`; the title painting
  `title_fp_v2.jpg` still shows a wooden sword). Shiny Sword (`swordLevel` 2): gold guard, blue grip, pink pommel,
  "Double damage, longer reach, extra sparkly."
- Silent protagonist. Loading tip: "Pip's shadow has fox ears. Look down on a sunny day."
- Never dies: "Pip got dizzy!" → "Pip woke up by the Great Tree." The Tree is where he always wakes.
- Status: look and GLB **LOCKED**; backstory **SOFT/empty** (nothing says where he came from, who his family is, or why
  villagers call him "sprout").

### 2.2 Villagers (6) — spots on seed 7151, speech style, representative lines

| Who | Species / look | Spot (x, z) | Role | Voice |
|---|---|---|---|---|
| **Elder Shellby** (`npc_turtle`, GLB) | old turtle, mossy shell with little mushrooms, long white beard and brows, leaf-green robe, crook staff with a leaf | (−3.8, 6.4), by the altar | intro, progress hints, post-bloom pointer to rematches | warm grandparent: "dear", "little Pip", "little sprout"; calm, encouraging, practical directions |
| **Mayor Ribbit** (`npc_frog`) | frog in a maroon coat with gold buttons, red bow, **gold monocle**, brown **top hat** with red band | (−11, 3.5), plaza | names the four landmarks; count-keyed cheer; bloom parade | pompous-sweet civic booster; "Ribbit!", "Croak.", "I hereby declare...", "Mayor's orders!"; running gag: his **victory croak** doesn't work until the parade |
| **Miso** (`npc_cat`, GLB) | orange tabby, happy closed eyes `^^`, cream bandana, green apron with a sprout emblem | (13.2, 13.0), behind her counter at Miso's Shop (15, 14) | shop, plushies | merchant cat: "Mrrow~", "purr", tildes, cat puns ("Purr-fect", "Brr-illiant"); "nothing is refundable" |
| **Clover** (`npc_bunny`) | cream bunny, flower crown (pink/white/yellow), pink scarf, satchel | (0.7, 56.0), Shores path | Captain Pinch tips; rainbow-shell errand | excited kid, best-friend energy: "I knew it!", "Best. Summer. Ever!" |
| **Professor Hoot** (`npc_owl`) | brown owl, round gold spectacles, purple academic gown, **grad cap** with gold tassel, carries a green book | (4.3, −61.6), Woods path | Grumble Shroom tips | scholar: "Hoo-hoo!", "Remarkable! Simply remarkable!"; writes papers about Pip |
| **Digby** (`npc_mole`) | mole miner, yellow **helmet with lamp**, blue overalls, belt pouch, shovel; nearly blind | (−103.1, −3.3), by the Meadow Windmill | Frostbun tips; heart-chest hints; landmark-keepsake hint | shy, self-deprecating blind jokes: "Did not see you there. Did not see much of anything, honestly."; "Digby's the name, digging's the game." |

Representative lines (verbatim; see `js/data.js` NPCS for every branch):

- **Shellby**: "Lost? Turn around until you see the Great Tree over the treetops, and walk toward it. It always brings
  you home" · "If you get bonked, Miso sells potions. And if you ever get dizzy out there, you will wake up right here
  by the Tree. No harm done." · after the bloom: "Look at her bloom... Thank you, Pip. You are the bravest little
  sprout on the whole isle." (**Shellby calls the Great Tree "her"**) · "The guardians are napping in their arenas
  again. Wake one if you fancy a friendly rematch!"
- **Ribbit**: "Ribbit! Welcome, welcome! Mayor Ribbit, at your service. Best lily pad in town, ask anyone." · "And
  west, a windmill turns over Bloom Meadow. **No guardian there, just flowers and secrets. Lots of secrets.** Croak." ·
  count-keyed: 1 seed "I hereby declare a holiday! ...Right after the other two." / 2 "I have been practising my victory
  croak. RIBBIT! ...It needs work." / 3 "I want to see the Tree bloom before my nap." · parade done: "RIBBIT! Still
  works. I have been croaking all day. The ducks are jealous." (ducks exist on the isle, offscreen) · gems "from the
  town treasury".
- **Miso**: "Mrrow~ Welcome to Miso's! Everything on the counter is shiny and nothing is refundable." · after bloom:
  "The whole isle smells like blossoms now. Business is blooming too!" · plushies: "I stitched little plushies of the
  guardians **you calmed down**. Soft as a sunny nap, and only 80 gems each~" · shop UI: "What catches your eye?",
  "Sold out! Only one of those, sorry~", "Your pockets are full of potions already!", "Not enough gems, little sprout.
  Mrrow...", purchases "A potion! Bottoms up, later." / "Max hearts +1! Purr-fect." / "The Shiny Sword! Swish swish~".
  Shop door sign: "Miso's Shop. Ring the cat for service." The cat is Miso.
- **Clover**: "he charges in a straight line like a runaway cart!" · "I bet he is only grumpy because his hat is too
  small." · "After the last big storm, five rainbow shells washed up on the Shores." · "My rainbow shells are lined up
  on my windowsill. They glow pink when the sun goes down!" (**Clover has a home with a windowsill** — not placed) ·
  rematch: "He says it was a friendly match. He is already practising for the next one!"
- **Hoot**: "Professor Hoot, scholar of the Whispering Woods." · "HOP right over it with {jump}, or roll straight
  through with {dash}! Hoo!" · "I shall write a paper: 'On the Gentle Defeat of Grumble Shroom', by Pip." · sequel
  "Grumble Shroom, Once More, With Feeling" — "He asked me to mention he was only warming up."
- **Digby**: "my tunnels rumble near four heart-shaped treasures" · "Every tall thing on this isle keeps something
  tucked round its back. Digby's dug near all of them." · "Some of those have been waiting a long, long time for
  somebody." · "Little treasure chests like to hide where the paths cannot see them... I would look there. If I could
  see." · "Bushes hide gems sometimes. And sometimes they just hide more bushes." · Frostbun "sat on my roof for a while.
  Comfy, I suppose." (**Digby has a roof/home and tunnels**.)

Status: names, species, looks, voices **LOCKED**. Every villager is **EXTEND** (each has only 1 errand at most; Miso,
Hoot, Digby, Shellby have none; none has a personal story).

### 2.3 Unseen residents (implied, never shown) — EXTEND
`DOOR_LINES` on the five cottages (doors at (−14.1,−12.3), (13.3,−14.1), (−15.9,11.5), (21.5,−5.4), (−22.5,−2.7)):
1. "The door is locked. Someone inside is snoring very softly. Through the window you can see a cozy fire."
2. "A note on the door: 'Gone fishing. Back... eventually.'"
3. "Mmm, it smells like cinnamon buns in there. The door is locked, sadly."
4. "Knock knock! ...Nobody answers. A cat yawns at you through the window."
5. "A tiny sign: 'Please wipe your paws.' The door is locked."
Plus the **well frog** at (9, −7.5): "You peek into the well. A tiny frog on a lily pad waves back at you." "...You wave
back. It feels like the polite thing to do." And Ribbit's jealous **ducks**. That is five-plus villagers already
promised by text: a sleeper, a fisher who is away, a baker, a second cat, a tidy paw-wiper.

### 2.4 Guardians (3 bosses)

| Guardian | Title (name card) | Region / arena (x, z), r 14 m | HP (rematch) | Look | Sign at arena |
|---|---|---|---|---|---|
| **Grumble Shroom** (`boss_shroom`, GLB 3.2 m) | "Grumpy Guardian of the Whispering Woods" | Grumble Shroom's Hollow (−3.2, −114) | 48 (60) | purple cap with golden spots, small **gold crown**, moss, a baby shroom on the cap, white moustache and beard, stubby body | "Grumble Shroom's Hollow — NO VISITORS. This means you. (And you.)" |
| **Captain Pinch** (`boss_crab`, GLB 2.6 m) | "Snippy Skipper of the Sunny Shores" | Captain Pinch's Cove (26, 142) | 48 (60) | giant red crab, barnacles, small navy **pirate/skipper hat with an anchor badge** | "Captain Pinch's Cove — Trespassers will be pinched!" |
| **Frostbun** (`boss_frost`, GLB 3.4 m) | "Chilly Champion of Frostcap Peaks" | Frostbun's Summit (114, −19) | 50 (63) | giant fluffy white yeti-bunny, icicle-tipped ears, ice-crystal shoulders, frosty breath, blue paw pads | "Frostbun's Summit — Beware of bun." |

Moves (DESIGN §8; all big attacks draw their exact danger zone; each hit = half a heart; after stomp / wall-bonk /
landing / slide the boss pulses gold and the bar says "Now!"; three damage in a row outside an opening → harmless shrug;
enraged below 50 % HP, rematch from 75 %):
- **Grumble Shroom**: stomp → a glowing ring rolls out (hop over / roll through; enraged: echo ring 0.6 s later); fan of
  5 spores (7 enraged); summons two Grumpy Shroomlets (2 HP) when none is about. Hint: "A glowing ring! Hop over it with
  {jump} or roll through it with {dash}."
- **Captain Pinch**: charge along a glowing stripe that locks 0.4 s before he goes → bonks the wall, stunned 1.2 s;
  bubble volley (6, 9 enraged); claw snap along a stripe (0.75 s wind-up). Hints: "The glowing stripe is his charge
  path: step out of it!" · "His claws will snap along the glowing stripe: step sideways out of it!"
- **Frostbun**: leap onto a glowing 2.9 m disc around Pip with a light pillar and a whistle overhead (roll out, or be
  airborne on landing; enraged: snowballs burst on landing); fan of 5 snowballs (7 enraged); belly slide along a stripe
  ending in a wall bonk and a 0.8 s opening. Hint: "Something big is coming down! Run out of the glowing circle!"
- Fight flow: stepping in seals the entrance with **glowing vines**, 2.4 s intro (name card, camera on the boss);
  victory: a burst, the Starseed floats out, pick-up fanfare. Rematch card "Grumble Shroom · Rematch"; prompt
  `[E] Wake · Grumble Shroom`; first win per guardian 40 gems once; toast "✿ Rematch won: Captain Pinch!".
- Balance targets (LOCKED as a reference): careful player wins ≥ 90 % in 25–60 s losing ≤ 2 HP; casual ≥ 75 %;
  never-dodging ≤ 50 % and never downed before 15 s.

**Guardian motives — what the text actually commits to (and nothing more):**
- They are called **guardians** (a role word, not a villain word), "grumpy", and they "scooped up" / are "hoarding" the
  seeds. Nothing says why.
- Pip "calms" them (Miso), wins "a gentle defeat" (Hoot); afterwards they **nap in their arenas**, enjoy rematches
  ("the most fun they have had in a hundred years"), and are sociable: Pinch "is already practising for the next one";
  Grumble "was only warming up"; Frostbun hopped to Digby's tunnels to concede "fair and square" and sat on his roof.
- Clover's guess "only grumpy because his hat is too small" is a child's opinion, not fact.
- The bottle: "The crabs are friendlier than they look."
- Their arena signs are territorial jokes (privacy, "Beware of bun").

→ **SOFT: the "why" is safe to write.** Constraints for any rewrite: (1) they must have taken the seeds within a night
and been grumpy about giving them back; (2) they are ≥ ~100 years old and were around at the last sneeze; (3) they are
genuinely friendly after being calmed; (4) "guardian" should end up meaning a real duty; (5) never retcon them into
villains or into being controlled by a dark power (tone charter: no late dark reveal). The research recommends giving
each a kind reason (e.g. keeping a seed safe/warm/company per an old duty) told after the fight.

### 2.5 Enemies (6) — "poof", never die

| Enemy (HUD name) | id | HP | Where (spawn weight) | Behaviour (reach, wind-up) | Emerges from |
|---|---|---|---|---|---|
| Jelly Slime | slime | 2 | Woods 3, Meadow 4 | hops after Pip; crouch then attack hop (2.7 m, 0.40 s) | ground |
| Grumpy Shroomlet | mushroom | 3 | Woods 4 | wanders, puffs a slow poppable spore (11 m, 0.55 s) | ground |
| Dozy Bat | bat | 1 | Woods 3 (+6 at night); Meadow at night (3) | flutters high, rises, swoops (5.3 m, 0.60 s) | sky |
| Buzzy Bee | bee | 2 | Meadow 3 | hovers, rears back, dives (4.6 m, 0.70 s) | bush |
| Snippy Crab | crab | 3 | Shores (only) | raises claws, charges (6.6 m, 0.65 s); claws guard the front, only the C chop breaks through | ground |
| Snowpuff | snowpuff | 2 | Peaks (only) | floats at range, throws flat snowballs (12 m, 0.60 s) | sky |

Caps: Woods 7, Peaks 6, Shores 6, Meadow 6, Village 0; global `maxEnemies` 8; spawn ≥ 14 m away (never inside view
closer than 24 m), despawn at 44 m. First notice: a "!" and a chirp. Drops: gems 45 % (worth 1/1/3/3/5), a heart 15 %
when Pip is hurt. Looks (sprites): slime = green jelly with a leaf on top; shroomlet = red-capped grumpy mushroom; bat =
purple, sleepy-cute; bee = round fuzzy yellow; crab = orange with big eyestalks; snowpuff = white cloud puff with an ice
crystal on top. Status: **LOCKED** stats/tells for the home isle; new realms add new species in the same idiom.

---

## 3. Places

Coordinates: x east, z south (**north is −z**). The island is 360 m across (≈ −180 … +180), in a turquoise sea; far
plane 300 m with fog. Region cards on arrival read **name + subtitle**.

| Region | Card subtitle | Where | Ground | Landmark (pos, height) | Music / ambience |
|---|---|---|---|---|---|
| **Sprout Village** | "Home of the Great Tree" | centre, paved plaza r 16 m | cobble plaza, cottages, shop | **The Great Tree** (0, −1.5), 19.8 m, tallest thing on the isle | village / dandelion fluff |
| **Whispering Woods** | "Mind the mushrooms" | north | forest floor, dense trees, 3 clearings, fairy rings | **Grumble's Crown** (10, −131), 21 m: giant purple mushroom with golden spots and a little golden crown, baby mushrooms and moss on its root flare; stands behind the Hollow | woods / falling leaves, light shafts |
| **Frostcap Peaks** | "Bring a scarf!" | east, over the river | snowy hills, rock, cliffs, snowy pines, boulders | **Summit Crystal Cairn** (100, −48), 15 m: five stacked snow-capped stones crowned with a frost-blue crystal cluster, two rings of blue and white diamond **pennant garlands** (someone built and decorated it) | peaks / snowfall, breath puffs |
| **Sunny Shores** | "Sand, sea and snippy crabs" | south | beaches, shallows, palms, shells, two islets with bridges | **Pinch's Lighthouse** (8.5, 117), 18 m: cream and coral stripes, gallery, gold lamp room, coral cap, door, portholes, life ring, **crab-shell sign by the door**; beam sweeps at night | shores / sea sparkles, gulls |
| **Bloom Meadow** | "Flowers, ponds and secrets" | west | meadow, flowers, bushes, ponds, sunflower ring | **Meadow Windmill** (−108.1, −6.6), 15 m, sails turning | meadow / butterflies, pollen |

Named / notable spots (seed 7151):
- **Village**: Great Tree (0, −1.5); **altar/pedestal** (0, 7.3) — "this old pedestal", 1.05 m stone lectern on a brick
  ring, slab with three gold-rimmed star sockets; spawn (0, 13); **signpost** at the plaza's south edge (4, 17.5): "A
  signpost with four arrows, one for each corner of the isle." + the four region lines; village sign "Sprout Village —
  Home of the Great Tree. Population: cozy."; **Miso's Shop** (15, 14) with a green/cream striped awning, outdoor
  counter, paw sign; five cottages (house_a (−16,−14), house_b (15,−16), house_a (−18,13), house_b (24,−6), house_a
  (−25,−3)) with lit windows and painted room cards; **well with a frog** (9, −7.5); 17 lamps (plaza ring, paths, bridge
  ends); bunting; parade lanterns (after errand) at (−3.8,14), (8.3,14.5), (13,7.7), (−29.3,2.2); a small pond (−13, 25).
- **Paths**: dirt paths from the plaza to each arena and into the meadow; waymarker posts every 30 m (9) with arrow
  boards; edge stones near the village and bridges.
- **River**: rises at a pond in the north-east woods edge (37, −78), runs south down the east side, into the sea in the
  south-east (≈ 150, 140). Crossed by the **Peaks bridge** (36.9,6.8)–(54.7,2.2). The compass routes "Bridge to
  Frostbun" while the river lies between.
- **Woods**: Grumble Shroom's Hollow (arena, −3.2, −114); three **clearings** joined to the path by winding game trails,
  each with a stump ringed by glowing mushrooms (**fairy rings**): (−36.1,−44.8), (23.6,−106.9), (−16.9,−86.7); the
  **hidden glade** (−36.7, −71.9) holding a heart chest; ponds (37,−78), (−48.9,−37.4).
- **Peaks**: Frostbun's Summit (114, −19); "a nook behind the Peaks boulders" heart chest (75.2, −21.7); cairn on the
  highest ground, its needle summit too steep to climb.
- **Shores**: Captain Pinch's Cove (26, 142) at the very end of the south path, "just past the striped lighthouse";
  **islet 1** (−40, 139) and **islet 2** (−60, 151, "off the western beach", reads as Meadow on the region map) joined by
  bridges islet1 / islet2; heart chest on islet 2 (−59.5, 152.2).
- **Meadow**: "a ring of tall sunflowers" heart chest (−98.5, 27.3); ponds (−70.6, 21.8) r 7.5, (−94.1, −29.2); Digby by
  the windmill. Ribbit: "No guardian there."
- **Gem chests** (10, 10–20 gems each, 150 total on 7151) "8–40 m off the paths": (−41.5,−96.1), (29.3,−61.5),
  (38.2,61.1), (50.2,41.5), (−29.5,32.8), (−35.3,73.9), (−113.5,−33.1), (−113.5,−10.6), (−69.3,−32.5), (15.2,−24.7).
- **Sky** (`js/sky.js`, painted billboards, one draw): sun and moon arcing east → south → west (moon rides low); 18
  cumulus + 6 cirrus; **four painted horizon isles** around the sea at 760 m; **one floating sky isle** far in the
  **north-east** (azimuth 2.3 rad, 900 m out, 135 m up, hazy). Stars at night. Painted content (see §6 hooks):
  - `sky_isle`: a floating rock island with a big leafy tree, a **ruined stone arch carved with a spiral**, broken
    pillars, stepping stones, lilac flowers, hanging roots/vines and a **waterfall pouring off the edge into cloud**.
  - `horizon_isle_a`: a pine-forested hill isle. `_b`: a rocky isle with a **natural sea arch**. `_c`: a palm isle
    with flowering shrubs and **a stacked-stone tower with a lit, glowing window**. `_d`: rolling hills with **three
    windmills** and round trees.
- **Key art**: title painting shows the Great Tree with a **spiral on its brow** and a sleeping face, lanterns hanging
  in its crown, shelf fungi on the trunk, the three Starseeds streaking across the sky as shooting stars (green leaf
  star, blue snowflake star, pink shell star), Grumble's Crown left, peaks with the crystal right, the lighthouse on a
  rock in the sea. Ending painting: Tree awake and smiling with pink blossoms and lanterns, the three seeds glowing on
  the altar steps, all six villagers celebrating, a red mushroom-cap cottage and a blue-roof cottage.

Status: every home-island name and placement **LOCKED**. Landmark heights and silhouettes **LOCKED** (they are the
navigation system; research: "the land is the progress bar").

---

## 4. Items, collectables, numbers

| Thing | Numbers | Text |
|---|---|---|
| Hearts | HP in half hearts; start 3 hearts (6 HP); reachable today 8 hearts (4 heart chests + 1 shop); code cap `CFG.maxHp` 20 (10 hearts) — room for exactly 2 more containers | "You found a Heart Container!" "Your max hearts grew by one, and you feel all warm and full." |
| Damage | every enemy attack, projectile and big boss attack = half a heart; 1 s i-frames | — |
| Potion | 25 gems, carry 3, refills every heart (R) | "Heals every heart. Carry up to 3." / "No potions! Miso sells them." / "Already full of hearts!" / feed "Refreshed! ♥ full" |
| Gems (currency; UI word "gems", save field `coins`) | pickups worth 1/3/5, magnet 2.5 m, vanish after 12 s; enemy drop 45 % | "+N gems!" |
| Starter sword | A/B 1 dmg, C 2; reach 1.6 m | — |
| Shiny Sword | 150 gems, once; A/B 2, C 3; reach 2.0 m | "Double damage, longer reach, extra sparkly." |
| Heart Container (shop) | 120 gems, once | "+1 max heart. Only one in stock!" |
| Plushies (3) | 80 each, once each; stocked once heart + sword sold and its guardian beaten; sit on Miso's counter | "Squishy, and only a little grumpy. Stitched by Miso." / "Felt claws and a tiny hat. Only pinches hugs." / "Cool to the touch, warm to the heart." |
| Starseeds (3) | Woods Starseed `#8be07a` (leaf star), Frost Starseed `#9fdcff` (snowflake star), Sea Starseed `#ff9f8f` (shell star) | "You got the Woods Starseed!" "Bring it to the pedestal by the Great Tree. N more to find!" / "That's all three! Hurry back to the Great Tree!" |
| Chests | 14 on 7151: 4 heart chests (`hc_meadow`, `hc_shores`, `hc_peaks`, `hc_woods`) + 10 gem chests | — |
| Cuttables | bushes (regrow 180 s), tall grass (120 s), pots (240 s) may hide pickups | — |
| Errand items | 5 rainbow shells (`shell1`–`shell5`, glowing, rainbow-striped), 4 paper parade lanterns (`lantern1`–`lantern4`, cream → amber) | "Rainbow shell 2/5", "Parade lantern 2/4" |
| Landmark keepsakes | 4 × 25 gems once | see §5 |
| Rematches | 3 × 40 gems once | — |
| Errand rewards | Clover 50, Ribbit 50 | — |

Gem economy today: fixed sources 150 (chests) + 100 (keepsakes) + 100 (errands) + 120 (rematches) = 470, plus drops
and cuttables; one-time sinks 120 + 150 + 240 = 510, plus potions. Day length 480 s (8 min); autosave 30 s.

---

## 5. Lore already in the text (keepsakes and errands)

`SECRETS` (one per region landmark, round the back, away from the path; no marker; twinkles within 6 m; prompt hides
the name). Positions on 7151 in brackets. **LOCKED text — new lore must agree with every sentence.**

1. **Glowing acorn** (`acorn`, Grumble's Crown, (11.6, −134.5)), "Look · Something glowing":
   "A little acorn, glowing softly, tucked in a hollow of the giant mushroom's roots." /
   "Long ago, the Great Tree dropped acorns like this one all over the isle. This one never quite fell asleep."
2. **Humming crystal stone** (`stone`, Summit Crystal Cairn, (109.4, −45.5)), "Look · Something humming":
   "A loose crystal stone that rolled down from the cairn, humming a slow, sleepy tune. It sounds a lot like the
   Starseeds do." / Scratched on its back, very small: **"We carried the first Starseed up here to see the stars. It
   liked them."**
3. **Message in a bottle** (`bottle`, Pinch's Lighthouse sea side, (7.2, 119.7)), "Open · A bottle", stays opened:
   "...The paper inside is salty and curled." / **"To whoever finds this: the Great Tree sneezes about once every
   hundred years. Keep a hanky handy. P.S. The crabs are friendlier than they look."**
4. **Tiny seed pouch** (`pouch`, Meadow Windmill footing, (−111.3, −6.8)), "Look · A tiny pouch":
   "...The stitching says 'For Spring'." / **"The seeds inside are the same gold as the Great Tree's blossoms. Someone
   has been planting little bits of the Tree all over the meadow."**

Digby frames them: "Every tall thing on this isle keeps something tucked round its back." → after all four: "You found
what every tall thing on this isle was keeping? ... Some of those have been waiting a long, long time for somebody."

Errands (`ERRANDS`): Clover's **Rainbow shells** (after Pinch; 5 on the Shores: by the lighthouse (8.6,106.8), islet 1
(−42.9,136.8), islet 2 (−63.3,152), outside the cove (14.5,124.1), beside the beach path (21.3,112); "After the last big
storm, five rainbow shells washed up"; reward 50) and Mayor Ribbit's **Bloom parade** (after the ending; lead him past 4
lanterns, he follows; walking within 2.5 m with him within 6 m lights one; reward 50; lanterns stay lit for good).

---

## 6. UI vocabulary (LOCKED words; new systems reuse them)

- Prompt pill: `[E] Verb · Name` — verbs in use: **Talk**, **Shop** (Miso), **Read** (signs), **Knock** (doors),
  **Open** (chests, the bottle), **Peek** (well), **Pick up** (shells), **Wake** (napping guardian), **Look** (pedestal
  without seeds, keepsakes), **Place** (pedestal with a seed), **Use** (default). Keepsake labels "Something glowing",
  "Something humming", "A bottle", "A tiny pouch".
- Health / failure: "Pip got dizzy!" (with five ✦ stars), "Pip woke up by the Great Tree.", hearts, "half a heart",
  dizzy, bonked, "poof" (enemy defeat), "calmed" (guardian), "gentle defeat", "friendly rematch", "napping".
- Boss: name card + title; boss bar tag **"Now!"**; vines seal the arena.
- Feed / toasts (`✿` = good news note): "✿ Saved", "Welcome back, Pip!", "✿ Find 5 rainbow shells on the Sunny
  Shores", "✿ That's all 5! Bring them to Clover", "✿ Errand done: Rainbow shells", "✿ Lead Mayor Ribbit past the 4
  parade lanterns", "✿ All 4 lanterns lit! Mayor Ribbit hops home", "✿ Rematch won: Frostbun!", "Secret found 1/4",
  "Controller ready ✿", "Mouse look: hold the right button and drag".
- Compass / objective: "Find the Starseeds · Grumble Shroom", "N to go · …", "Bridge to Frostbun" (short "Bridge"),
  "Bring the Starseed home" / "Bring the Starseeds home" (short "Altar"), "Pick up the Woods Starseed", "The isle is
  blooming ✿". Controls card goal: "Find the three Starseeds and bring them home to the altar under the Great Tree."
- Map: parchment card titled "Starseed Isle"; legend **Great Tree, Guardian, Miso's shop, Chest found, Your marker**;
  click drops a marker the compass follows.
- Pause menu: **Resume, Settings, Controls, Map, Chat log, Save & Quit**; title: **"Starseed Isle" / "a cozy little
  adventure"**, buttons **New Adventure, Continue, Settings**, "This will replace your saved adventure. Press again to
  start fresh!"; noscript "Starseed Isle needs JavaScript and WebGL2 to bloom."
- Loading tips: "Look at something and press {interact} to talk or read." · "Your compass knows where the next guardian
  is." · "Hop over shockwave rings!" · "Pip's shadow has fox ears. Look down on a sunny day." · "Keep swinging: the
  third hit of a combo is a big chop." · "Lost? Open the map with {map} and drop a marker."
- Moves as named to players: **Swing** (3-hit combo, the third a big **chop**), **Hop**, **Roll** (hold to
  **sprint**), **Lock on**, **Potion**, **View**.

## 7. Completion tracker (`js/completion.js`) — EXTEND

Rows in order (key / label / icon): `chests` Chests / `hearts` Heart containers / `guardians` Guardians / `regions`
Regions / `seeds` Starseeds home / `errands` Errands / `plushies` Plushies / `rematches` Rematches / `secrets` Secrets.
Totals on 7151: 14 / 5 / 3 / 5 / 3 / 2 / 3 / 3 / 4. Percentage = distinct things found, floor, 100 only when every row
is full; "★ 100%"; full chip green with ✓. Pure, read-only over the save; counts only ids that exist in the world.
At the new scale this becomes per-realm/per-category and needs a journal behind it.

---

## 8. Open hooks (what existing text promises and new content can pay off)

Ranked by strength (how much the text already invites it, and how well it fits the 80–120 h expansion).

1. **The hundred-year sneeze is a cycle, and someone prepared for it.** The bottle (a letter "to whoever finds this")
   and Shellby's "hundred years" put a previous sneeze ~100 years ago. Payoffs: who wrote the bottle (a past keeper /
   lighthouse keeper / an earlier "Pip"); what happened last time; Elder Shellby is a turtle and may be old enough to
   remember it (he calls the pedestal "this old pedestal"); the next sneeze as a late-game event.
2. **Starseeds came from the stars, and there was a "first" one.** "We carried the first Starseed up here to see the
   stars. It liked them." + the seeds hum, are star-shaped and in the title art fall as shooting stars. Implies: more
   than three Starseeds have existed; a "we" (a people) built and decorated the Cairn; the sky matters. Payoff: a star
   / sky realm, a constellation collection, an origin myth told in fragments.
3. **The floating sky isle (NE) with a spiral-carved stone arch and a waterfall into cloud** — already painted and
   visible from the home isle. The spiral matches the **spiral on the Great Tree's brow** in the key art. Strongest
   visual hook for a portal / sky world; the arch reads as a gate. It sits 900 m out and 135 m up: reaching it is a
   natural late milestone.
4. **The four painted horizon isles are neighbours.** A pine isle, a rocky sea-arch isle, a palm isle with a **lit
   stone tower** (someone lives there), a hill isle with **three windmills** (farmers like the Meadow's). Payoff:
   sea travel (Captain Pinch is a **Skipper** with a skipper's hat; there is a **lighthouse** whose beam guides ships
   at night; a villager has "Gone fishing. Back... eventually."); an archipelago map extension.
5. **The Great Tree's sleeping acorns are all over the isle.** "dropped acorns like this one all over the isle. This
   one never quite fell asleep." Payoff: a wake-the-acorns collection that grows saplings (land-as-progress-bar),
   each sapling a small fast-travel or bloom point. The Tree is "her" and has a face that sleeps and wakes — she can
   speak or dream.
6. **Someone is secretly planting bits of the Tree "For Spring" in the meadow.** An unseen gardener (no villager claims
   it). Payoff: a Meadow side story and a reveal of the gardener; golden sprouts appearing over time; why the Meadow is
   the one region with **no guardian and no Starseed** ("No guardian there, just flowers and secrets. Lots of
   secrets."). Keep the Meadow guardian-free on the home isle or make any Meadow "guardian" a reveal that honours
   Ribbit's line.
7. **"Every tall thing on this isle keeps something tucked round its back" ... "waiting a long, long time for
   somebody."** A rule the game can keep: every new landmark in every new realm hides one keepsake behind it, and the
   keepsakes were left on purpose for a successor (the bottle is addressed "to whoever finds this").
8. **The guardians are "guardians" and centenarians.** Their role word, their age, and their warmth after the fight
   invite a kind reason (they guard seeds when the Tree sneezes, as an old duty they took too literally / forgot to end).
   Each can get a personal story, a home, and a late role (e.g. escorting Pip to new realms).
9. **Digby's tunnels run under the isle** ("my tunnels rumble near four heart-shaped treasures"; Frostbun visits his
   tunnels). Plus the **well** with a frog going down into the plaza and the Great Tree's roots. Payoff: an
   underground layer / root dungeons ("Under the Roots" was the research's strongest single candidate).
10. **Village residents already exist offscreen**: the sleeper by the fire, the fisher who is away, the cinnamon-bun
    baker, a second cat, the "wipe your paws" household, the well frog, the ducks, Clover's house with the windowsill,
    Digby's roof. Five cottages = five households to meet, each a side-story owner.
11. **Storms come from the sea** ("After the last big storm, five rainbow shells washed up"; rainbow shells glow pink at
    sundown). Payoff: weather events, things washing up, a storm-side realm, a shell collection.
12. **Professor Hoot writes papers** ("On the Gentle Defeat of Grumble Shroom", a sequel). Payoff: Hoot's library /
    bestiary / journal voice; the field-notes journal can be framed as Hoot's.
13. **Mayor Ribbit's town treasury, holidays and parades.** He "hereby declares a holiday"; festivals as recurring
    post-act events; the ducks.
14. **Miso stitches and stocks shiny things** ("nothing is refundable"): where does she get swords and heart
    containers? A trader who sails in; plushie lines for every new guardian.
15. **Pip is a "sprout"** with a two-leaf sprout on his hood, always wakes by the Tree. Gentle identity hook (Pip has a
    bond with the Tree). Use carefully: the research says no late-revealed dark power and no chosen-one twist that
    shrinks the villagers; keep it warm and small (e.g. the Tree has looked after him since he was little).
16. **Night already has content**: lighthouse beam, glowing mushrooms, fireflies, stars, bats in the Meadow at night,
    rainbow shells glowing pink at sunset. Payoff: night-only events and creatures (never missable, per the charter).
17. **The river's source pond** in the north-east of the Woods (37, −78) and the river mouth in the south-east; the
    peaks' **needle summit too steep to climb**. Payoff: climbing/vertical traversal later; a source spring story.
18. **Glowing-vine arena seals and fairy rings**: the vines that seal arenas and the three mushroom fairy rings are
    unexplained magic — natural portal candidates into small pocket dungeons.

## 9. What may be rewritten vs what must stay

**Must stay (LOCKED):**
- All names: Pip, the six villagers, the three guardians and their titles, six enemy names, five regions and their
  card subtitles, four landmark names, the three arena names and signs, Starseed names/colours/shapes, Miso's Shop,
  the altar/pedestal with three star sockets, the Great Tree (19.8 m, "her", sleepy → awake face).
- Every shipped line in `SECRETS`, `ERRANDS`, `PLUSHIES`, `SHOP`, `DOOR_LINES`, `SIGNS` (new lines may be added; these
  may not be contradicted).
- The sneeze → three seeds → three guardians → bloom spine; the bloom as a real, satisfying ending of its arc.
- The tone rules in §0; Sprout Village safe; telegraphs ≥ 0.55 s; dizzy instead of death; opt-in hard content.
- Home island geometry and placements (seed 7151), save key, the existing save fields and their meanings.
- Pip's GLB and look; the painterly sprite style of the cast.
- UI words in §6.

**Safe to rewrite / deepen (SOFT):**
- **Guardian motives** — currently only "grumpy" and "hoarding"; give each a kind, specific reason consistent with §2.4.
- **Shellby's intro** — may gain context (the hundred-year cycle, what a guardian is) as long as pages 1–3's facts hold;
  any new page must keep the first-run flow short.
- **The ending card** ("Thanks for playing", "The isle is yours to explore") — becomes an act break.
- **Ribbit's "No guardian there"** — true for the home isle; keep it true or pay it off as a deliberate reveal.
- **"No quest log"** design line — replace with a journal (the 80–120 h scale needs one).
- **Pip's background**, the Tree's voice, who "we" (cairn) and the bottle writer are, who plants the meadow seeds —
  all unwritten; write them, but no dark-power or dream twist.
- **Post-bloom villager lines** — every villager can gain new count-keyed lines (the established pattern: lines keyed
  to seeds found/placed, bosses beaten, errands, keepsakes).
- **Title/key art wooden sword** — outdated against the steel starter; refresh when key art is regenerated.
- **Completion tracker rows and %** — extend per realm; keep the rule "100 % only when every row is full".

**Known inconsistencies to fix or respect:**
- Starter sword: steel in canon and model; code/tests/balance notes still say "wooden"; title art shows wood.
- Islet 2 holds Shores content (shell, heart chest) but reads as Meadow on the region map.
- "cosy" (docs) vs "cozy" (in-game text): in-game text uses **cozy**.
- Pip's pronoun is "he" in docs and lines; keep it.
