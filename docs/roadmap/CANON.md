# CANON: Starseed Isle, "The Hundred-Year Letter"

The single source of truth for the 80-120 hour game. Written 2026-11-21 against `main` at `b79d73d` by the lead
designer, merging `proposal-myth.md`, `proposal-world.md` and `proposal-systems.md`. Every later writer (roadmap,
step issues, dialogue, art briefs) follows this file. Where this file and a proposal disagree, this file wins. Where
this file and `CANON-NOW.md` LOCKED items disagree, CANON-NOW wins and this file is the bug.

Rules of the file: names are final unless the owner overrides them (§15). Numbers are targets a step can test.
"KEEP" = shipped and unchanged; "DEEPEN" = shipped, gains scenes or lines; "NEW" = new.

---

## 0. Scoring the three proposals

Scores 1-10. "Hours" = whether 80-120 h for 100 % is credible from what is actually specified.

| Criterion | Myth ("The Hundred-Year Letter") | World ("The Seven Lights") | Systems ("The Hundred-Year Round") |
|---|---|---|---|
| Story richness and emotional power | **9**: an antagonist with a face and a case (Mote), a sibling reunion, a finale built from the player's save, the bottle-writer reveal on a LOCKED villager | 7: Mothmere is sympathetic but mostly offstage; seven trees dilute the focus | 7: Juniper and the "Gone fishing" payoff are strong; the antagonist is absent for 3 acts |
| Originality | 8: falling-star-tree, catchers' rule, given-light ladder | 8: the Starloom, the horizon as a scoreboard, the rule of three per isle | 6: a fox carrier risks reading as another game's fox hero; "Hearthtree" is generic; shrinking is a known trope |
| Exploration depth | 7: 0.98 km², 20-26 h map | **9**: six layers, the sea as a land, 0.85 km² + variants | **9**: 1.35 km², 30-35 h map with a stated calibration |
| Coherence of world + story + systems | **9**: every hook in CANON-NOW §8 answered; each ability reopens home | 7: strong atlas, story spread thin over 7 trees and 300 years | 8: counts, tools and pacing rules interlock; the myth is thinner |
| Cosy-tone fit | 9 | 9 | 8 (a 200 HP finale on the person you came to rescue) |
| Feasibility on this engine and pipeline | 7: ~180 PRs, no swimming, cheap travel | 6: boat locomotion + bubble walking + 13 lands + 7 dreams | 5: ~270 PRs, 14 tools incl. shrinking, 15 dungeons |
| 80-120 h credible | 8 (101 h, budget a little optimistic on 9 dungeons) | 8 (106 h) | **9** (106 h, buckets sum exactly, pacing rules) |
| **Total / 70** | **57** | 54 | 52 |

**Decision.** Myth is the spine: its cosmology, its antagonist, its cast and its endings. Grafted on top:
- From **Systems**: the hour-first budget and pacing rules (§12), act counts and count-keyed beats with a whole-game
  progress bar in the Great Tree's crown (8 lanterns), the **Stair Stones** and two far isles (Kettle Isle,
  Saltglass Flats), the Ember Sling and Ivy Gloves, thornvine gates, "Ask the Tree" hints, scale-by-count boss HP,
  the parcel chain and Chime Bell, the Snowglobe and the Merry Mabel optional dungeons, The Planting, the rule that the
  act-break card ships only with the dungeon behind it.
- From **World**: the six horizon cards as real neighbours (the horizon is a scoreboard), **Under the Roots** as the
  first dungeon and the **Glowbud Lantern** that carries Wenna's light (it is how Pip rekindles beacons), the
  people / depths / Warden three-step loop on every isle, the sea as a land of islets (the Glassway), a reflection
  realm (Moonmere, repurposed as Mote's mirror-home), Starsteel at a forge isle that supplies Miso, Rook the rival.
- **Cut** on purpose: swimming and bubble-walking (2-3 PRs each, ENGINE §4), shrinking, a 300-year backstory, seven
  sister trees, a fox carrier, a time-travel realm of a second land, 15 story dungeons (kept: 11 story dungeons + 4
  optional).
- **Renamed** from Myth: the Starfield → **the Starmeadow** (an existing game's title), Mother Halo → **Old Mother
  Brightwell** (same reason), Leafwing → **Leaf Glider**, Digby's Old Diggings → **Under the Roots** (Digby keeps the
  Rootdeep chapter).

---

## 1. The game in one page

Every hundred years the Great Tree sneezes, and nobody remembers why. This time a small boy in a fox-eared hood
carries her three Starseeds home, and the Tree wakes up properly for the first time in a century. Her first words are
"thank you". Her next words are "Pip, look. Someone is putting out the lights." Across the sea, one by one, the lamps
of the neighbouring isles go dark, and a streak of light climbs toward the floating isle in the north-east sky.

The thief is **Mote**, the Tree's little brother, a star who came down a hundred years ago to bring his sister home
and has been stranded on that floating isle ever since. He is not wrong that she is tired. He is wrong about what she
wants. Pip relights the isles with his sister's own light, learns the history from the roots, rebuilds the old stair
to the sky, and in the end everybody Pip helped gives Mote a lantern so he can climb home. "Every hundred years,
then?" "Every hundred years. Keep a hanky handy." The true ending reveals who wrote the bottle Pip found on day one.

**Theme:** light is something you give, not something you take; family is whoever keeps you.
**Emotional arc:** wonder (Act I) → worry (Act II) → understanding (Act III) → letting go (Act IV) → belonging (true ending).
**Shape:** four acts with counts **3 · 3+1 · 3 · 1**, then a true ending. Free order inside every act, fixed order
between acts. Every success changes the world within 10 s, where it was earned and in the Great Tree's crown.

| Profile | Hours |
|---|---|
| Main story only | **40 h** (35-45) |
| Main + most side stories | **~62 h** |
| 100 % (every tracker row, true ending, post-game) | **95 h** (84-112) |
| Seeing every region card and landmark once | 10-12 h |
| Exploring the whole map (every point of interest) | **28-34 h** |

---

## 2. Glossary (every proper name)

All names are original to this project. "(LOCKED)" marks shipped names that may not change. Writers add a name here
in the same PR that first uses it.

### 2.1 Cosmos, peoples, events

| Name | Definition |
|---|---|
| **The Lantern Sky** | The layer above: where the stars live. Realms: Driftholm, the Starmeadow |
| **The Wide Blue** | The sea and its isles, the middle layer. The word villagers use for "the world" |
| **The Rootdeep** | The layer below: Wenna's roots under the sea floor, reaching every isle; warm, dark, glowing. Also the realm of that name |
| **Starkin** | The star folk: singing lights with soft round faces. A Starkin near the ground grows dim and heavy and cannot fly up on its own |
| **Wenna** | The Great Tree's true name (LOCKED: the Great Tree, 19.8 m, "her"). The littlest Starkin, who fell, was caught by the sea and rooted. Only the oldest characters use the name |
| **Mote** | Wenna's little brother, a Starkin; the antagonist, called "the Lamp Thief" until II.M. Stranded on Driftholm for 100 years; "borrows" the isles' beacon light to build a Ladder |
| **Lamplighters** | Moon-moth folk who kept a beacon on every isle and built the Cairn, the Starstair and the Academy. The "we" on the humming stone. Now nearly gone |
| **Catchers of the Corners** | The three guardians' real office (LOCKED names: Grumble Shroom, Captain Pinch, Frostbun) |
| **The Catchers' Rule** | "Catch what flies. Keep it one night. Give it only to a kind hand." Set by the Lamplighters |
| **Wardens** | Keepers of a beacon or a Stair Stone on other isles; the same old office as the Catchers, held by other creatures |
| **The Sneeze** | Once a century Wenna sneezes three Starseeds skyward: a letter to the sky that says "still here". Not an illness |
| **The Second Sneeze** | The finale's sneeze, which everyone is ready for |
| **The Bottle Chain** | Twelve letters "to whoever finds this", one per century, each by that century's child seed-bearer. The shipped bottle (LOCKED text) is the newest |
| **Seed-bearer** | The child who carries the Starseeds home after a sneeze. By tradition, whoever bothers to go |
| **The Starstair** | The Lamplighters' floating stone stair from the Summit Crystal Cairn's needle to Driftholm. Broken 100 years ago |
| **Stair Stones** | The Starstair's three keystones. They fell into the far Wide Blue in the storm. Act III's count |
| **The Ladder of Lights** | (1) The Lamplighters' ladder of lamps, built 100 years ago from the Starstair so Mote could come down; broken in the storm. (2) Mote's new ladder, wound from borrowed beacon light; the last dungeon |
| **Beacons** | One lamp per isle, each holding a share of Wenna's light carried out along her roots. Each isle's rhythm hangs on it. Act II's count |
| **The Firstlight** | The flame in the Lamplighters' Tower's great lamp, lit from the very first Starseed. Mote takes it at the end of Act II |
| **Given light** | The Lamplighters' old way: light handed freely to someone, which harms nobody and holds a ladder for one night |
| **The Storm** | The great storm of 100 years ago that broke the Ladder and the Starstair |
| **The Last Big Storm** | The sea storm two summers ago (LOCKED line: rainbow shells) that also scattered the Bottle Chain onto the Glassway |
| **The Spiral** | The one repeated sign: on Wenna's brow, the Driftholm arch, every Lamplighter bench, beacon and ruin. Means "the way home"; to players, "this connects to somewhere" |
| **Memory knots** | Twelve glowing knots on the Taproot; touching one opens the Remembered Isle at that memory |
| **Crown lanterns** | Eight dark lanterns in Wenna's crown, one lit per beacon relit, Stair Stone set and the finale. The whole-game progress bar |
| **The Hundred-Year Night** | The true-ending night when the Starkin come down; also its variant realm |

### 2.2 Characters

Home (Starseed Isle):

| Name | Definition |
|---|---|
| **Pip** (LOCKED) | Silent hero, ~1 m, leaf-green fox-eared hood with a two-leaf sprout, steel sword. An ordinary Sprout Village kid the whole village had a hand in bringing up; his den in Wenna's roots became Pip's Nook (§3.4) |
| **Elder Shellby** (LOCKED) | Old turtle. Teller of the myth in instalments. Secretly the last seed-bearer, who wrote the shipped bottle |
| **Mayor Ribbit** (LOCKED) | Frog mayor; afraid of deep water; opens the jetty, runs Village Works and the festivals |
| **Miso** (LOCKED) | Cat shopkeeper; in a twenty-year sulk with her twin Kinako; stitches the plushies |
| **Clover** (LOCKED) | Bunny kid explorer; becomes the isles' map-maker |
| **Professor Hoot** (LOCKED) | Owl scholar, cheerfully wrong; the journal is his *Field Notes* |
| **Digby** (LOCKED) | Near-blind mole; the secret "For Spring" gardener; leads Pip through the Rootdeep |
| **Grandpa Dormy** | Dormouse in the snoring cottage; awake 21:00-23:00; tells one lore story per night |
| **Nell Pelliwick** | Pelican sailor, the "Gone fishing" cottage; skipper of the *Dandelion*; fishing teacher |
| **Hazel Thimble** | Hedgehog baker, the cinnamon-bun cottage; buns are a cheap half-heal |
| **Granny Mochi** | Very old fluffy cat, the yawning-cat cottage; Miso and Kinako's grandmother |
| **Primrose Thistledown** | Clover's mum, the "Please wipe your paws" cottage, with four tiny kits (Bramble, Sorrel, Clem and Dot) |
| **Puddle** | The tiny well frog (LOCKED: he waves); Ribbit's nephew; lives in Puddle's Grotto |
| **The Quackenbushes** | Five ducks, jealous of Ribbit's croak (LOCKED: "the ducks are jealous") |
| **Kinako** | Miso's twin brother; sails Kinako's Floating Bazaar between isles; everything is "limited edition!!" |
| **Rook** | Young crow treasure-hunter; comic rival who races Pip in five lands |
| **Great-Aunt Flurry** | Frostbun's huge snoozing aunt in the Snowglobe (optional boss) |

Guardians (LOCKED names and titles): **Grumble Shroom**, **Captain Pinch**, **Frostbun**, plus Grumble's shroomlet
nephews (the little ones who fear the dark).

Act II:

| Name | Definition |
|---|---|
| **Granny Wick** | Moon moth, 112, the last Lamplighter; keeps the tower window lit; "Light's not for keeping, dear. It's for passing on." |
| **Flick** | A young Wickling moth, Granny Wick's great-grandchild and would-be apprentice |
| **The Wicklings** | The moth folk of Wickhaven, drowsy without their beacon |
| **The Wickwork Moth** | A brass-and-paper Lamplighter automaton that guards the Tower's lamp (Warden) |
| **Elder Nutmeg** | Head of the Acornet squirrel clan of Pinewhistle; hoards acorns "for safekeeping" |
| **Professor Pinfeather** | Woodpecker scholar, Hoot's rival; always right, never fun |
| **Mossmantle** | Moss-covered sloth, Warden of the Whistling Pine |
| **Skipper Rafferty** | Otter captain of the Raft; loud, loyal, terrible singer |
| **Old Gloop** | Purple octopus in eight mismatched knitted socks, Warden of the Great Arch |
| **Lady Honksworth** | Very large, very proud goose, Warden of Tumble Hill; "Your Honkship" |
| **Goody Gander** | Lady Honksworth's patient sister, the miller |
| **The Hayburys** | The mouse farming family of Haybury (Ma, Pa and six kits) |
| **Pennywhistle** | A scarecrow who woke up a century ago and wants a crow friend |

Act III and the sky:

| Name | Definition |
|---|---|
| **Gran Burrows** | Digby's grandmother in Burrowbottom; stitched the "For Spring" pouch; sees perfectly and finds his jokes awful |
| **Lumbra the Long** | 14 m earthworm with tiny glasses who keeps the roots healthy (Rootdeep Warden) |
| **Postmistress Pell** | Puffin who runs Puffin Post and delivers found bottles' letters |
| **Mr Whelk** | Hermit-crab collector of rare shells |
| **Pelagia** | Ancient sea turtle, young Shellby's best friend, Warden of the Sunken Bell |
| **Bosun Snore** | Snoozing walrus aboard the Merry Mabel (optional boss) |
| **Master Scoria** | Honey-coloured bear smith of Forgefall; forged every sword Miso sells |
| **Pitch** | Scoria's little newt apprentice who wants to forge "a star, a real one" |
| **Soakley** | Capybara who runs the Kettle Isle bathhouse; utterly calm in every crisis |
| **Lady Fumarole** | Giant fire-newt in a bath towel, Warden of the Kettle |
| **Sable** | Jerboa archaeologist of Sablecamp, over-excited about pottery |
| **Tutor Scarabelle** | Hourglass beetle who still sets the Lamplighter Academy's final exam (Warden) |
| **The Nimbles** | Round cloud creatures of Driftholm |
| **Old Mother Brightwell** | The eldest Starkin, huge and slow; explains given light |
| **The Twinklings** | Three small Starkin who light ladder rungs where Pip points (Act IV helpers); a shy fourth appears post-game |

### 2.3 Places

Lands (realms) are defined in §5. Region card names (card subtitle in quotes, the shipped format):

| Land | Regions |
|---|---|
| Starseed Isle (LOCKED) | Sprout Village, Whispering Woods, Frostcap Peaks, Sunny Shores, Bloom Meadow |
| Duskwick | **Wickhaven** "Stilts, moths and lamplight" · **Ember Sands** "Black sand, warm toes" · **Coral Steps** "Mind the coral" · **Tower Head** "The last light" |
| Pinewhistle | **Acornet Hollow** "Mind your acorns" · **Misthollow Ravines** "Rope bridges ahead" · **Sawmill Run** "Listen for the saws" · **Whistle Rise** "Where the pine sings" |
| Archwater | **The Raft** "Mind the gap" · **Basalt Stairs** "Hexagons everywhere" · **Tidepool Shelf** "Low tide, high hopes" · **Kelp Shallows** "Squelchy" |
| Threemills | **Haybury** "Pies cooling" · **Tumble Hill** "Three mills, one hill" · **Orchard Rows** "Apples, always apples" · **Millpond Marsh** "Boots optional" |
| The Rootdeep | **Burrowbottom** "Mind your head" · **Glowcap Forest** "Mushrooms the size of houses" · **The Underlake** "Very quiet water" · **Geode Galleries** "Sparkly" |
| The Glassway | **Puffin Post** "Stamps required" · **The Sandbars** "Walkable at low tide" · **Wreck Reach** "Three wrecks, no waiting" · **Bell Shallows** "Listen" |
| Kettle Isle | **Forgefall** "Mind the sparks" · **Bathhouse Terraces** "Towels provided" · **Ash Beach** "Warm sand, warmer feet" · **The Spout** "Still a little steamy" |
| Saltglass Flats | **Sablecamp** "Brush, don't dig" · **The Glass Dunes** "Wind-polished" · **The Salt Pans** "Very bright" · **Academy Hill** "Mind the bell" |
| Driftholm | **Mote's Meadow** "Someone lives here" · **The Falls** "Mind the edge" · **Nimble Downs** "Fluffy" · **Arch Rise** "The way up" |
| The Starmeadow | **The Lower Lanterns** · **Constellation Bridges** · **Brightwell's Rest** · **The Ladder Foot** |

Named sites: **Pip's Nook** (Pip's room in Wenna's roots, the collection home) and its **Keepsake Hollow**;
**Under the Roots** (first dungeon); **Nell's Jetty** (Sunny Shores); **Puddle's Grotto** (under the well);
**Grumble's Undercap**, **the Snowglobe**, **the Storm Cave**, **the Bell Hollow** (home optional sites);
**Hoot's Board** (plaza vista board); **Lamplighter benches** (waystones, 4-6 per land); **root-gates** (one per land,
underground fast travel); **the Lamplighters' Tower**; **Granny Wick's Library**; **the Whistling
Pine**; **Whistlehollow**; **the Great Arch** and its **Moon Pool**; **the Undertow Grotto**; **Tansy Mill,
Thrift Mill, Middle Mill** (Tumble Hill); **the Granary Vaults**; **the Taproot**; **the Rootdeep Heart**;
**the Sunken Bell**; **Gull Rock**; **the Snoozing Whale** (an islet that is a sleeping whale); **the Merry Mabel**
(wreck); **Kinako's Floating Bazaar**; **the Kettle**; **the Kettle's Belly**;
**the Lamplighter Academy**; **the Buried Academy**; **the Spiral Arch**; **the Spiral Stair**; **Mote's Tally Wall**; **the Crown** (Wenna's canopy) with its **North, East, South
and West Boughs**; **the Hundred Lamps**; **the Mirror Garden** (Moonmere).

Variant realms: **the Remembered Isle**, **Moonmere**, **the Hundred-Year Night**, **Hoot's Margins**, **Guardian
Dreams**. Small dungeons: **Hollows** (24 one-room puzzle caves behind spiral-carved doors).

### 2.4 Items, tools, collectibles, systems

| Name | Definition |
|---|---|
| **Starseeds** (LOCKED) | Woods (leaf star `#8be07a`), Frost (snowflake `#9fdcff`), Sea (shell `#ff9f8f`) |
| **The *Dandelion*** | Nell's boat. Chart travel in Act II, sailed freely in the Glassway from Act III |
| **Lamplighter's Chart** | The world map; Granny Wick gives it; Clover's painted chart replaces it in the epilogue |
| **Glowbud Lantern** | Tool 1: carries Wenna's light; lights 6 m; kindles beacons |
| **Leaf Glider** | Tool 2: glide |
| **Tide Bell** | Tool 3: raises or lowers water at tide stones |
| **Thistle Hook** | Tool 4: grapple to hookblooms |
| **Sunglass** | Tool 5: aimed light beam; wakes Sleeping Acorns |
| **Digging Paws** | Tool 6: dig soft earth, open root-gates (ability id `dig`, item id `mitts`; renamed from "Burrow Mitts" for originality, review 2026-11-22) |
| **Starsong** | Tool 7: three-note leaf whistle with three tunes, **Dawn**, **Dusk**, **Calling** |
| **Ember Sling** | Tool 8: ranged ember-seed shot |
| **Ivy Gloves** | Tool 9: climb ivy lattices |
| **Cloudstep** | Tool 10: second hop on cloud motes |
| **Shiny Sword** (LOCKED) / **Starsteel Sword** | Sword levels 2 and 3 (Starsteel: Scoria's side story) |
| **Sleeping Acorns** | 100 acorns of Wenna, woken with the Sunglass; each grows a sapling |
| **Keepsakes** (LOCKED kind) | 44 two-line lore objects, one behind every landmark |
| **Lamp Logs** | 30 pages of the Lamplighters' logbook |
| **Heart petals** | 24; every 6 make a heart (§10.3) |
| **Root Key** | The one key per dungeon that opens the boss door (code field `bigKey` unchanged) |
| **Chime Stone** | The dungeon item that shows unopened chests as stars on the map card (code field `compass` unchanged; the HUD objective compass is a different, shipped thing) |
| **Heart Container** (LOCKED, shipped) | +1 max heart: Miso's (shipped), the Tower's, Kinako's. The shipped name stays; §15.10 |
| **Field Notes stickers** | 8 cosmetic journal stamps, one per Act II-III land, found in chests (§10.4); item kind `sticker`, stored in `items` |
| **Vistas** | 30 of Hoot's sketch spots |
| **Fish Log** | Nell's record of 24 fish species |
| **Plushies** (LOCKED kind) | Miso's stitched guardians; 16 in all |
| **Hoot's Field Notes** | The journal (Quests, Items, Bestiary, Lore, Map tabs) |
| **Ask the Tree** | Opt-in hint button in the journal; two strengths (nudge, then plain answer) |
| **Chime Bell** | Late finder: chimes faster near an unopened chest or unfound keepsake within 30 m |
| **Village Works** | Ribbit's gem-funded village projects |
| **Bright Wick, Swift Fluff, Sling quick-draw** | Kinako's upgrades: Lantern radius 6 → 9 m; glide 6 → 7.5 m/s; Sling draw time halved |
| **Hood trims** | Cosmetic tints of the hood material in third person (never replaces Pip's GLB) |
| **Miso's Hundred-Year Hanky** | A 1,000-gem joke item, "limited edition~" |
| **Shellby's hanky** | The real one, spiral-embroidered, given in the true ending |

Enemies and bosses are named in §7 and §9.

---

## 3. Cosmology, history and the truth of the Starseeds

### 3.1 The myth in one breath (Lamp Log 1; Shellby tells a short form in Act I)

> Before the isles there was only the Wide Blue below and the Lantern Sky above, and nothing in between but wind.
> The Starkin sang to each other across the dark. The littlest of them wanted to know what the sea sounded like.
> So she leaned down to listen. She leaned too far, and she fell.
> The sea caught her. It pushed up a little rock for her to land on, and she put down roots so she would not fall any further.
> She grew, and she grew, and she became the Great Tree. Her light went into her seeds.
> Every hundred years she misses the singing, and she sneezes three Starseeds up toward the sky. It is a letter. It says: *still here.*
> The corners of the isle catch the seeds so the sky does not keep them, because the Tree needs her light to live.
> And someone carries them home.

Told once in one breath, complicated once (Act III: she did not stay because she was stuck; she chose to).

### 3.2 What the Starseeds are

A Starseed is a piece of Wenna's own starlight, grown into a seed. Three exist at a time; they hum (LOCKED: the
crystal stone "sounds a lot like the Starseeds do"). At a sneeze they fly up as a letter to the sky. If the sky
"kept" them, Wenna would fade, which is why the Catchers exist. Back in the pedestal's star sockets they feed her light
out along her roots to every beacon in the Wide Blue. That is the link between Act I and everything after: the
beacons on the other isles burn with Wenna's light, so when Mote borrows a beacon he is pulling, thinly, on her.

### 3.3 The true timeline

| When | What happened | Where the player learns it |
|---|---|---|
| Thousands of years ago | Wenna falls and roots. The four horizon isles rise where her longest roots surface | Lamp Log 1, Shellby (Act I) |
| Long ago | Islanders arrive by sea. The Lamplighters keep a beacon on every isle, build the Starstair from the Cairn's needle to Driftholm (a floating step that never fell), train at the Academy on Saltglass Flats, and carry the first Starseed up the Cairn "to see the stars. It liked them." (LOCKED) | Keepsake, Lamp Logs, Saltglass |
| Every century | A sneeze; the Catchers catch; a child seed-bearer earns each seed in a gentle bout, carries them home and writes a bottle "to whoever finds this": the Bottle Chain | Bottles, Shellby |
| 100 years ago | Mote answers the letter for the first time. He comes down to Driftholm, the lowest he can reach on his own light. The Lamplighters spend nearly every lamp they own building the Ladder of Lights from the Starstair so he can come down to her. He asks Wenna to come home: given light could lift her up, but her roots would sleep and the isle would lose its Tree. She chooses to stay: *"I can't go. Who would they wake up next to?"* Mote climbs back to argue once more. That night the Storm breaks the Ladder and knocks the three Stair Stones into the far sea; Mote is stranded on Driftholm. The seeds of that sneeze are carried home by a small turtle, **Shellby**, who writes the newest bottle and hides it at the lighthouse | Remembered Isle memories (Act III), true ending |
| The century since | The Lamplighters, lamps spent, grow few; their children move away. Granny Wick (12 on the night of the Ladder) keeps the last lit window. The Catchers grow old and half forget the Rule. Mote counts lights on Driftholm and gathers what he can reach: fireflies, sparks, the moon on puddles. His gathering tugs, very slightly, at Wenna | Tally Wall, Starmeadow |
| The night before day one | Wenna sneezes early (Mote's tug). The Catchers catch the seeds and, half asleep, keep them for their own kind reasons (§4.2) | Act I scenes |
| Day one onward | The game. Wenna's bloom is the brightest light the Wide Blue has seen in 100 years; Mote, watching, believes she is burning out and starts borrowing the beacons to build a new Ladder fast | Act I end |

Nothing in this history is a dark power, a curse, a death or a dream. Every sad thing is in the past tense.

### 3.4 Pip

An ordinary Sprout Village kid, and the whole village has had a hand in bringing him up. Shellby knitted the
fox-eared hood and sewed on the two-leaf sprout "so the Tree would know you"; Miso sold him his first sword at a
discount she still denies; Hazel has fed him cinnamon buns since before he could reach the counter. When he was small
he made a den in a hollow between Wenna's roots and would not sleep anywhere else, so Shellby put a door on it: that is
Pip's Nook. That is why everyone calls him "little sprout" and why he wakes by the Tree when he gets dizzy: it is the
place he thinks of as home. No foundling story, no prophecy, no bloodline, no chosen one: he is the one who bothered to
go. (The earlier "found asleep in the roots as a baby" origin was dropped on 2026-11-22 because, with a green-hooded
sword hero and a talking great tree, it read too close to another game's premise; §15.9.)

### 3.5 Answers to every open hook (CANON-NOW §8)

| Hook | Answer |
|---|---|
| The bottle "to whoever finds this" | Young Shellby, 100 years ago (true ending). Eleven older bottles wash up across the Wide Blue |
| "We carried the first Starseed up here" | The Lamplighters; the Cairn is where each letter is shown to the sky, and the foot of the Starstair |
| The sky isle and its spiral arch | Driftholm, the top step of the Starstair; Mote's home for 100 years |
| The four painted horizon isles (six cards) | Duskwick (lit tower), Pinewhistle (pines), Archwater (sea arch), Threemills (windmills); the two repeat cards become Kettle Isle and Saltglass Flats (§5.3) |
| Acorns that "never quite fell asleep" | Wenna's Sleeping Acorns, 100 across all lands, woken with the Sunglass |
| The "For Spring" gardener | **Digby**, planting by touch so there will be a spring he can smell; Gran Burrows stitched the pouch. Ribbit's "No guardian there" stays true for ever |
| Digby's tunnels, the well, the roots | Ways into the Rootdeep (root-gates) |
| The five cottages | Grandpa Dormy, Nell Pelliwick ("Gone fishing" pays off at the end of Act I), Hazel Thimble, Granny Mochi, the Thistledowns |
| The ducks | The Quackenbushes |
| "The last big storm" | Two summers ago; it scattered the Bottle Chain onto the Glassway |
| Hoot's papers | The journal is his *Field Notes*; post-game Hoot's Margins |
| Miso's stock | Swords from Master Scoria on Kettle Isle, carried by Kinako |
| Glowing vines and fairy rings | Lamplighter craft: vines answer a Catcher; fairy rings are Hollow doors (Lantern) |
| The needle summit "too steep to climb" | Climbed with the Thistle Hook in Act III; the Starstair starts there |

---

## 4. Story: acts, chapters and beats

### 4.1 Shape and unlocks

Beat ids (`I.1`, `II.M`) are what step issues cite. Flags are `S.flags` keys (save v7); a step adds the flag it sets.
Plot beats are keyed to **counts** (seeds home, beacons relit, stones set), character lines to **places**, so every
free order reads as written. Each act ends with a change visible from the village.

| Act | Title | Chapters | Count | Order | Main-path hours |
|---|---|---|---|---|---|
| I | The Sneeze | 1-6 | 3 Starseeds | free | 4.0 |
| Interlude | Under the Roots | 7 | - | fixed | 1.25 |
| II | The Dimming | 8-12 | 3 beacons + the Tower | Duskwick first, three isles in any order, the Tower last | 13.5 |
| III | The Remembering | 13-18 | 3 Stair Stones | the Rootdeep first, three stones in any order, the Starstair last | 17.25 |
| IV | The Lantern Sky | 19-21 | 1 Ladder | fixed | 4.0 |
| Post | The Hundred-Year Night | 22 | thresholds | after the main ending | (in post-game) |

### 4.2 Act I: The Sneeze (home; KEEP + DEEPEN)

Every shipped line, placement and fight stays. Additions:

1. **I.1 The Morning After** (KEEP). One new Shellby line after page 3: "The guardians are older than they look. Be
   gentle, and they'll be gentle back."
2. **I.2-I.4 The Woods, Frost and Sea Starseeds** (DEEPEN, any order). Each guardian's kind reason is **visible
   before the fight** (two or three props by its arena, placed by one post-pass on its own RNG) and **told after it**
   in a handing-over scene that replaces the burst: on the last hit the guardian sits down dizzy, says three lines and
   holds out the seed; it stays awake and talkable in its arena until the bloom, then naps (rematches unchanged).

| Catcher | Seen before | Handing-over lines | Its region changes when the seed is placed |
|---|---|---|---|
| Grumble Shroom | the three fairy rings near the Hollow are dark; three little unlit night-lights by the Hollow sign | "Hmph. Fine. FINE. Take it." / "The little ones were scared of the dark, you know. Since she went droopy, the woods stopped glowing. That seed lit them right up." / "Bring it home. Tell her Grumble kept it warm." | fairy rings glow brighter for good; glow-moss on Grumble's Crown |
| Captain Pinch | the lamp room dark by day; a spyglass on the gallery pointing out to sea; a chalk tally of nights on the door | "Belay that! ...Aye, aye. Ye've a kind hand, I'll give ye that." / "My lamp went dark the night she wilted, and Nell Pelliwick's boat is still out past the reef. A skipper doesn't let a lamp go out with a boat at sea." / "Take it to the Tree. She'll want a light to come home by." | the lamp burns by day as well as night until Nell is home |
| Frostbun | a tiny knitted scarf on a rock; a snow nest shaped like a cradle | "Brrr-rrr... no. Mine." / "It was shivering when it landed. Seeds catch cold. Everyone knows that. I hugged it all night." / "You will keep it warm? Promise? ...Hop to it, then." | a warm spring steams beside the Summit; the Cairn crystal hums at night |

   Voices from now on: Pinch "ye / aye / belay"; Grumble short grumbles; Frostbun short sleepy sentences, rolled r's.
   **Count beats** (whichever seed): Wenna's matching bough blossoms (three boughs face the three regions; the fourth,
   toward the Meadow, is always in leaf); the village music gains one instrument layer; Shellby's instalments:
   - 1 home: "Do you know why she sneezes, dear? The old songs say she came down from the sky, long ago. Every hundred
     years she misses it, and she sneezes her light up toward the stars, like a letter. *Still here,* it says."
   - 2 home: "The guardians aren't thieves, little sprout. They're catchers. They catch what flies so the sky doesn't
     keep it, and they hold it one night for a kind hand. I think they just got... attached."
   - 3 in hand: "Last time she sneezed, someone very small carried her seeds home. Smaller than you, even. ...Well. Go
     on, then." (true-ending plant). Ribbit's shipped count lines stay.
3. **I.5 The Bloom** (KEEP). The cutscene is unchanged except that the three guardians now stand at the plaza edge.
   The card becomes (only in the same release as chapter 7, §14): "✿ Starseed Isle is blooming again! ✿ / End of Act
   One · The Sneeze / But far across the water, the lights are going out... / Press any button to continue."
4. **I.6 Wenna Wakes** (NEW, flag `wennaAwake`). Starts at the first dusk after the bloom when Pip is in the village
   (or on Continue after dusk); cannot be missed. The awake face speaks in a soft-gold dialogue frame: "...Pip. Little
   Pip. I can see you." / "Thank you for bringing my light home. I was so tired I had forgotten how to wake up." / "Oh.
   Pip, look. Out there, on the water." The camera turns to the horizon: the four near isles' cards have lit windows (a
   night glow overlay); one by one they go out, Duskwick's tower last; a streak of light climbs to the sky isle.
   Then a lantern rounds the lighthouse beam: **Nell comes home** (toast "✿ Nell is home! The lighthouse brought her
   in."; the "Gone fishing" note becomes "Back! ...Told you. — N."). Wenna: "Someone is putting out the lights. I don't
   know who. Will you find out for me?" A root door opens on the Tree's north side. Compass: "Under the Roots".

### 4.3 Interlude: Under the Roots (chapter 7)

**7 Under the Roots** (flag `lanternGot`). Through Pip's Nook (his room, now opened wider: "Your room's grown, little
sprout.") a stair leads down into **Under the Roots** (dungeon 1). Wenna puts a spark of herself into a bud: Pip earns
the **Glowbud Lantern** and calms **Sir Rollo**, the pill-bug who has been rolling the root tunnels flat for forty
years "because nobody told me to stop". At the bottom, Wenna explains the beacons: each burns with
her light, and her light in the Lantern can rekindle a dark one. Nell needs a lamp to sail at night: the Lantern is it.
Ribbit opens **Nell's Jetty** ("I hereby declare this jetty... jettied."). The *Dandelion* sails. Compass: "Sail to
Duskwick". The Nook's **Keepsake Hollow** opens: the four found keepsakes appear on shelves.

### 4.4 Act II: The Dimming (chapters 8-12)

**8 Duskwick** (fixed, `ch8`). Wickhaven sits dim on its stilts; the moths are drowsy. **Granny Wick** has kept the
tower window lit for a century, and it went out the night of the bloom. She explains: each beacon holds a share of
Wenna's light, and each isle's rhythm hangs on it. "Somebody is collecting them. Somebody who knows exactly where to
look." She gives the **Lamplighter's Chart** (world map; the other three isles appear) and Lamp Log 1. The Tower is
locked from inside (the Wickwork Moth). On the tower stair Pip glimpses a cloaked light that flees upward: first sight
of "the Lamp Thief".

**9-11 The three isles, any order.** Every isle runs the same loop (World's rule of three, made into a test):
1. **The people**: arrive at the jetty, meet the people and their trouble, do the local quest chain (one main step per
   region, 3-4 steps) that opens the dungeon.
2. **The depths**: the dungeon and its tool (§8).
3. **The Warden**: calm the Warden at the beacon (the dungeon's last room), then `[E] Kindle · Beacon` with the
   Lantern. The isle's rhythm restarts within 10 s, a crown lantern lights at home, the isle's horizon card gets its
   lit window back at night, and one islander visits the plaza.

| Isle | Trouble | Warden and kind reason | Tool | When kindled |
|---|---|---|---|---|
| **Pinewhistle** | the Whistling Pine fell silent; the Acornet squirrels cannot sleep, and they are hoarding sleepy acorns | **Mossmantle** has hummed the pine's song himself for nine days so the squirrels could sleep; too hoarse to stop anyone gently | Leaf Glider | the pine sings again |
| **Archwater** | the arch beacon over the Moon Pool went dark and the tide, which follows its light, is stuck at low water; the Raft is beached | **Old Gloop** has held the sea in place with all eight arms so the Raft does not tip over | Tide Bell | the tide turns |
| **Threemills** | the mills stand still, the wheat stays green, the granary's sun-lamp is gone | **Lady Honksworth** has flapped the mill sails by hand so nobody goes hungry; exhausted and therefore extremely loud | Thistle Hook | the sails turn |

Count beats (whichever isle):
- **After the 1st beacon**: Granny Wick reads Lamp Log 2 aloud over the chart; the first crown lantern lights; Hoot
  starts his star count ("Four thousand and twelve stars this year. Last year, four thousand and nineteen.").
- **After the 2nd (II.M, the midpoint, flag `moteNamed`)**: on the isle where the second beacon is relit, the Lamp
  Thief does not flee. He lands on the beacon, cross and flickering, and talks. He gives his name; the Tree is his
  sister; "She fell. I came to bring her home. I have been stuck on a rock in the sky for a hundred years, counting
  lights." And: "I'm not stealing. I'm *borrowing*. Like your guardians did." He takes nothing and leaves. The journal
  entry becomes "Mote"; every villager gains a line (Shellby goes very quiet: "...Mote. Oh, dear."). From now on some
  nights a single moving light shows on the sky isle.
- **After the 3rd**: the Tower unlocks; Granny Wick: "Three lights. That's enough to wake the old lamp."

**12 The Lamplighters' Tower** (fixed, dungeon 5). Light-beam mirrors on five floors; the **Wickwork Moth** at the top;
reward the **Sunglass**. Pip kindles the great lamp: the **Firstlight**, the oldest light on the Wide Blue. Then Mote
comes. He doesn't fight; he asks: "Give it to me. Please. It's the only one strong enough." Granny Wick says no. Mote
takes the Firstlight, crying sparks, and climbs straight up into the north-east sky. The tower still burns with the
ordinary flame Pip kindled (nothing earned is taken back: its crown lantern stays lit). That night at home Wenna
sneezes, a small one, and every tree drops one leaf. From every realm a thin **ladder of lights** now hangs in the
north-east sky. Card: "End of Act Two · The Dimming / The Ladder is going up." Count of crown lanterns: 4 of 8.

### 4.5 Act III: The Remembering (chapters 13-18)

**13 Into the Rootdeep** (fixed, `ch13`). Wenna is frightened: "There is something I've forgotten. It's down in my
roots. And I'd like to see my brother. I'd like to say it properly this time." Through Digby's tunnels (a root-gate
under the Meadow Windmill, Lantern), Digby leads, because down there nobody can see and he never could. Burrowbottom;
Gran Burrows; the dimmed roots; the **Rootdeep Heart** (dungeon 6), **Lumbra the Long**, the **Digging Paws**. The
twelve memory knots appear on the Taproot; **memories 1-3** open (the Lamplighters on the Cairn; Mote falling to
Driftholm as a streak of light; the Ladder being built). The roots show where the Stair Stones fell: one in the Bell
Shallows, one in the Kettle, one under the Academy. Root-gates open on every isle visited so far (fast travel).

**14 Past the Reef** (`ch14`). Nell can now sail beyond the reef by the Lantern's light: the **Glassway** opens as a
sailed realm (free sailing, §5.4). Puffin Post, the first washed-up bottle, Kinako's bazaar.

**15-17 The three Stair Stones, any order.** Each is a full land loop (people, depths, Warden):

| Place | Trouble | Warden and kind reason | Tool | Encounter kind |
|---|---|---|---|---|
| **The Sunken Bell** (the Glassway) | the Lamplighters' sea chapel sank in the Storm; its bell has never rung since | **Pelagia** keeps the bell silent, because the last time it rang the Ladder broke; the Stair Stone is its clapper | Starsong | a game of wits: a bell-order duel, she never attacks; "You ring like Shellby did." |
| **Kettle Isle** | the Kettle grumbles; the baths swing between cold and scalding; the forges are out | **Lady Fumarole** sits in her bath on the spout lid: the Stair Stone fell into the spout and keeps the Kettle simmering instead of boiling over, and she won't let anyone touch it until the heat has somewhere else to go | Ember Sling | a bout |
| **Saltglass Flats** | the Lamplighter Academy is buried to its bell tower; its last students left a century ago | **Tutor Scarabelle** keeps the school standing for students who may yet come; the Stair Stone is the bell's weight, and she won't give it to anyone who hasn't passed the final exam | Ivy Gloves | an exam in three papers: dodge, aim (Sunglass at receivers), puzzle-in-arena |

Count beats: each stone, set into the Summit Crystal Cairn, raises one flight of floating steps from the needle
(visible from every realm), lights a crown lantern, and opens three more memory knots:
- **1st stone → memories 4-6**: young Shellby (a tiny turtle in a too-big hat) earns the seeds from three younger
  Catchers (a smaller, cheerful Grumble; a Pinch with no hat yet; a Frostbun the size of a rabbit); young Granny Wick;
  young Shellby and young Pelagia racing on the beach.
- **2nd stone → memories 7-9 (twist T5)**: Mote comes down the Ladder; he asks; Wenna chooses to stay. "Who would they
  wake up next to?"
- **3rd stone → memories 10-12**: the Storm breaks the Ladder (seen from far away; Mote's light still visible on
  Driftholm; nobody hurt); the stones fall; a young turtle writes a letter by lamplight and rolls it into a bottle.
  The game does not say it is Shellby; only the handwriting matches.

**18 The Starstair** (fixed, `ch18`). Pip climbs the Cairn's needle (Thistle Hook; ivy route with the Gloves) and the
restored Starstair to **Driftholm**: a floating meadow, Mote's patched shelter, a hundred little scrap lamps, and the
**Tally Wall** (a hundred years of marks). The **Spiral Stair** (dungeon 10) climbs through the rock; its encounter is
a **chase**: Mote runs up dropping lights behind him (telegraphed circles and stripes), Pip keeps within 20 m for 90 s.
At the Spiral Arch he turns: "You saw it, didn't you. In her roots. ...She'd have come with me if it weren't for all of
you." He pulls his Ladder up through the arch into the sky. Reward: **Cloudstep**. Card: "End of Act Three · The
Remembering / Above the clouds, the stars are waiting."

### 4.6 Act IV: The Lantern Sky (chapters 19-21)

**19 The Starmeadow** (`ch19`). Through the Spiral Arch: cloud islands joined by constellation bridges (walkable with
Cloudstep). The Starkin have missed Mote for a century and cannot come down to fetch him without going dim. **Old
Mother Brightwell** tells the old way: when Wenna sneezes her letter, the sky may answer with a ladder of **given**
light, which stays up one night and harms no one. **Twist T6**: Mote's century of gathering tugged at Wenna's light;
that is why she sneezed early on day one. The **Twinklings** join for this act and light rungs where Pip points.

**20 The Ladder of Lights** (dungeon 11). Mote has wound every borrowed light into a Ladder and lowered it from the
Starmeadow into Wenna's crown; it pulls at her. Pip climbs it downward, one floor per borrowed beacon (themed on its
isle, using that isle's tool), and frees each light, which streams home to its isle (seen from the Ladder landing on
the horizon).

**21 The Second Sneeze** (finale in the Crown; §9.3). Stray Lights → The Sneeze (the three Catchers catch the seeds at
their corners; Pip catches the last spark on a glide) → Given Light: `[E] Give · Lantern`, then everyone Pip helped
arrives along the boughs with one lantern each, the list read from the save. Wenna: "I'm still here." Mote: "Every
hundred years, then?" Wenna: "Every hundred years. Keep a hanky handy." He climbs home; the Firstlight comes back to
Granny Wick first. The eighth crown lantern lights. **Main ending card**: "✿ The lights are home ✿ / End of Act Four ·
The Lantern Sky / Mote's star is the new one, just above the Tree. / Press any button to continue." Free roam
continues in the epilogue state; a short scene tells the player plainly what is left ("Shellby wants a word, some
evening. Whenever you're ready.").

### 4.7 Chapter 22: The Hundred-Year Night (true ending)

Opens after the main ending **and** at least **8 of 12** bottles **and** **50 of 100** Sleeping Acorns awake (a
threshold, never "all"). Shellby asks Pip to sit with him by the Tree at dusk. Home becomes **the Hundred-Year Night**
(variant realm): the Starkin come down for one night on a given-light ladder; Mote visits, brighter; every Catcher and
Warden is in the plaza. Shellby: "I wrote that letter, you know. The bottle. I was about your size. ...It was your
turn, dear." He gives Pip his spiral-embroidered hanky. Wenna says her one line about Pip: "Every hundred years someone
small decides to go. This time it was you. I'm so glad it was you." Pip writes the 13th letter (the
player picks three phrases from a short list built from the save), climbs the lighthouse with Pinch and throws it out
to sea. Card: "✿ To whoever finds this ✿ / Thank you for playing." The Night stays revisitable from Shellby's bench.

### 4.8 Twists in order

| Id | Twist | Fires |
|---|---|---|
| T1 | The sneeze is a letter, not an illness | Act I, 1 seed home |
| T2 | The guardians are catchers with a duty | Act I, 2 seeds home |
| T3 | Waking the Tree woke something else: the lights go out | I.6 |
| T4 | The Lamp Thief is Mote, her brother, "borrowing" like the guardians did | II.M |
| T5 | Wenna chose to stay | 2nd Stair Stone |
| T6 | Mote's gathering caused the early sneeze | ch19 |
| T7 | Shellby was the last seed-bearer and wrote the bottle | ch22 |

No late-revealed dark power, no corruption, no "it was a dream", no death, no betrayal by a friend.

---

## 5. The atlas

### 5.1 Rules for every land

ENGINE §2: one realm loaded at a time (plus its resident parent); overworld grid ≤ 640 m; interiors and dungeons
48-192 m; generation ≤ 1.2 s desktop; ≤ 24 instanced prop types and ≤ 12 new material programs per realm; every realm
frozen by `tests/fixtures/realm-prints/<id>.json` in the PR that ships it; later content only through post-passes on
their own RNG. Every overworld follows the home grammar: 4 regions with name cards, one landmark per region visible from
the region's entry, one keepsake round the back of every landmark, one village region with no enemies, a jetty or
arrival spawn, 4-6 Lamplighter benches, one root-gate, at least one point of interest per 1,250 m² of land, and a
generator test that proves it (every 40 × 40 m cell of land holds a find, a view or a path to one).

### 5.2 Every land

Seeds are fixed per realm. "Land" = walkable km². Palettes are the starting `W.palette` and art prompts.

| id | Name | Kind · grid · land | Biome, mood, palette | Landmark (height) | Connection · unlock | Generator recipe sketch |
|---|---|---|---|---|---|---|
| `home` | **Starseed Isle** | overworld · 360 m · 0.050 | as shipped | the Great Tree (19.8 m) + 8 crown lanterns | start | KEEP `generateWorld(7151)`; new content only by post-passes (§5.3) |
| `duskwick` | **Duskwick** | overworld · 448 m · 0.08 · seed 40211 | warm palm isle, black-and-gold sand, coral shrubs, hot pools, moth town on stilts; dusk marimba; `#2b2238` `#f2b45a` `#ff8f7a` `#3fa79a` | the Lamplighters' Tower (28 m) | chart · `lanternGot` | `lagoon`: ring island r≈170 m with a south lagoon (stilt decks as bridge decks), NE headland for the tower, 4 sectors |
| `pinewhistle` | **Pinewhistle** | overworld · 576 m · 0.15 · seed 40223 | steep pine hills, misty ravines, rope bridges, a sawmill stream; wind flute; `#2f4a3a` `#8fae9a` `#c98b4b` `#e8efe9` | the Whistling Pine (34 m, knot-holes in a spiral) | chart · `ch8` | `ridges`: two NE-SW ridges, ravines between, bridge decks across, dense pine scatter, stream spline |
| `archwater` | **Archwater** | overworld · 512 m · 0.11 · seed 40231 | basalt columns, tide pools, kelp shallows, sea caves, a raft village; plucked strings; `#36414f` `#7fd3d0` `#e2c9a0` `#6b4a8c` | the Great Arch (26 m tall, 40 m span) over the Moon Pool | chart · `ch8` | `basalt`: stepped column plateau, tide flats as a two-state water level (flag), raft as a bridge deck |
| `threemills` | **Threemills** | overworld · 576 m · 0.16 · seed 40237 | rolling farmland, wheat squares, orchards, hedgerows, millpond; fiddle and accordion; `#e7c45a` `#7fae4b` `#c2563f` `#a7d3f0` | Tumble Hill with Tansy, Thrift and Middle Mill (22 m) | chart · `ch8` | `downs`: low rolling noise, hedgerow splines as colliders, field patchwork splat |
| `rootdeep` | **The Rootdeep** | cavern · 576 m · 0.15 · seed 40241 | glowing root walls, mushroom forests, an underground lake, geodes; low cello, drips; `#1c1a24` `#ffcf7a` `#7be0c8` `#8a5a3c` | the Taproot (60 m column of glowing wood) | root-gate under the Meadow Windmill · `act2done` | `cavern`: void palette, walls to 30 m, fog 10-90 m, ceiling `over` boxes in low halls, glow materials, root-gate spurs at the edge |
| `glassway` | **The Glassway** | sea · 640 m · 0.10 land + ~0.30 sailable · seed 40253 | glass-clear shallows, sandbars, 9 islets, 3 wrecks, a stilt post office; glockenspiel; `#bfeee6` `#f5e6c4` `#2f7d8c` | the Sunken Bell's spire (18 m above low tide) | sail from Nell's Jetty · `ch13` | `shoals`: islets by Poisson discs, sandbars walkable only while the tide flag is low, sail lanes, harbour buoys to Kettle and Saltglass |
| `kettle` | **Kettle Isle** | overworld · 512 m · 0.12 · seed 40261 | a teakettle-shaped volcano, hot springs, warm black sand, a forge town; brass and steam; `#3b3540` `#e66f4f` `#f4d1a6` `#8fc7a0` | the Kettle (45 m cone, steam spout) | Glassway buoy · `ch14` | `cone`: central cone with a terraced flank, spring basins as flat pools, lava-tube mouths as dungeon portals |
| `saltglass` | **Saltglass Flats** | overworld · 640 m · 0.20 · seed 40277 | pale salt desert, singing glass dunes, salt pans, the half-buried Lamplighter Academy; still, old; `#efe3c8` `#c9a46b` `#8ec9d8` `#b55d4c` | the Academy bell tower (26 m) | Glassway buoy · `ch14` | `dunes`: dune ridges by directional noise, flat pans, ruin stamps, glass-sculpture scatter |
| `driftholm` | **Driftholm** | floating · 448 m · 0.07 · seed 40283 | the painted sky isle made walkable: lilac meadow, broken spiral arches, waterfalls into cloud; airy harp; `#c9b6ec` `#f7f2ff` `#9bb87a` | the Spiral Arch (24 m) | the Starstair · 3 stones | `floating`: one main isle + 5 islets on a cloud floor (falling = "the clouds bounce Pip back" to the last ledge), painted archipelago ground card far below |
| `starmeadow` | **The Starmeadow** | sky · 640 m · 0.10 · seed 40289 | cloud islands, constellation bridges, deep blue and gold; music box and choir hum; `#141a3a` `#ffe9a8` `#8fa8ff` | the Ladder of Lights (80 m into view) | the Spiral Arch · `act3done` | `islands`: 12 cloud isles; constellation bridges are bridge decks that exist only with Cloudstep |
| `crown` | **The Crown** | interior-scale · 128 m | Wenna's canopy as walkable boughs, lanterns, blossom; ending theme | four bough lanterns | the Ladder · ch20 | dungeon recipe with bough decks |
| `remembered` | **The Remembered Isle** | variant of `home` | home 100 years ago, sepia and gold, Lamplighter beacons on every landmark, scaffolds, music-box theme; `#e9d8b0` `#b8894a` `#6f5a44` | the Tree with Lamplighter scaffolds | memory knots · ch13 | same seed and geometry; palette, scatter remap, a memory post-pass of props and young cast; no enemies |
| `moonmere` | **Moonmere** | variant of `home` | the home isle as Mote imagined it from the sky, silver and still; `#cfd8ee` `#2a3358` `#f6f3d8` | the Moon Tree (Wenna's shape in silver, hung with scrap lamps) | Starsong *Calling* on the moonpath off Nell's Jetty at night · after the Sunken Bell | variant; 12 moon-lanterns, the Mirror Garden, Mote's unsent letters; Hushlings |
| `night` | **The Hundred-Year Night** | variant of `home` | home at night, falling-light rain, lanterns everywhere, festival waltz | the Tree with Mote's star above | Shellby's bench · ch22 | variant; festival props; everyone placed |
| `margins` | **Hoot's Margins** | variant of `pinewhistle` | inside Hoot's notebook: paper ground, ink-line trees, pencil percussion | the Whistling Pine, sketched | Hoot's study · post-game | variant; ink-trace puzzles (trace a dotted bridge with the sword) |
| `dream_*` | **Guardian Dreams** (10) | dungeon recipe · 96 m arenas | each boss's dream of its arena in pastel | its arena | `Dream · <Name>` at a napping boss · post-game | one twist each (§9.2) |
| interiors | 5 cottages, Pip's Nook, Miso's back room, Granny Wick's Library, Raft cabins, Burrowbottom homes, Scoria's forge, the Academy library | 48-64 m | - | - | doors become portals (ENGINE §3.3) | interior recipe; never enemies |
| `hollow_*` | **Hollows** (24) | 48-64 m | one puzzle room each, spiral-carved door | - | per land (§10) | dungeon recipe |

**Totals.** New unique overworld land **1.24 km²** (25 times the home island); with home, **1.29 km²**; plus about
0.30 km² of re-dressed variant land and about 0.12 km² of dungeon, Hollow and interior floor.

### 5.3 Home island changes (all post-passes on their own RNG; prints byte-identical)

Each pass follows `placeShells` rules: own `new RNG(7151 * k + c)` stream, nearest-walkable placement around a named
anchor, nothing added to other lists, `W.walk / W.reach` restored, a world test on seeds 1-40.

| Pass | What it adds | When visible |
|---|---|---|
| `placeReasons` | the Catchers' reason props (dark fairy-ring night-lights, spyglass and tally, scarf and snow cradle) and their healed states | Act I |
| `placeRootDoor` | the root door to Pip's Nook on the Tree's north side (anchor (0, −8)) | I.6 |
| `placeJetty` | Nell's Jetty (anchor (−14, 126)) and the moonpath start | ch7 / Moonmere |
| `placeGates` | ~40 tool-gated finds (§8.2), 12 Sleeping Acorns, 4 old Lamplighter beacons at the landmarks, 2 fairy-ring Hollow doors, the Storm Cave, the Bell Hollow, the Snowglobe ice wall, the Undercap entrance | as tools arrive |
| `placePortals` | root-gate under the Meadow Windmill; well → Puddle's Grotto; cottage doors become portals once each resident is met | ch7 onward |
| sky (not in prints) | six horizon cards re-pointed to fixed bearings: Duskwick S-SE (card c), Pinewhistle N-NW (a), Archwater E-SE (b), Threemills W-SW (d), Kettle Isle E-NE (new card `horizon_isle_e`, fogged until Act II ends), Saltglass Flats S-SW (new `horizon_isle_f`, fogged); each gets a night-window glow tied to its flag; the sky isle stays NE; the Ladder billboard appears at Act II end; the Starstair flights rise from the Cairn per stone | per beat |
| Great Tree model | 8 crown lanterns (child meshes, no collider), three blossoming boughs | per beat |

Home's full-completion time rises from about 2-3 h to about 6 h.

### 5.4 Travel

| Way | Unlock | Rule |
|---|---|---|
| **Chart sailing** | ch7 | `[E] Sail · the Dandelion` at any jetty opens the chart; pick an isle; a 4-6 s painted sailing card (also the loading card) |
| **Free sailing** | ch14 | inside the Glassway only: a boat locomotion state on the water plane (ENGINE: 2-3 PRs). **Fallback if it slips:** the Glassway becomes chart stops at its islets, costing about 3 h of play |
| **Lamplighter benches** | ch8 | `[E] Sit · Bench` marks it; fast travel between found benches, never inside dungeons or fights; with the Starsong a bench also turns day to night |
| **Root-gates** | ch13 | one per land, opened from both sides; underground fast travel; Lumbra ferries between them |
| **The Starstair** | ch18 | the Cairn needle ↔ Driftholm; the Spiral Arch ↔ the Starmeadow |
| **Memory knots** | ch13 | `[E] Touch · Memory` at the Taproot |

---

## 6. Cast arcs

| Who | Arc and beats |
|---|---|
| Elder Shellby | keeps a kind secret: instalments (Act I), quiet at Mote's name (II.M), "Old Friends" with Pelagia (Act III), the hanky (ch22) |
| Mayor Ribbit | a frog afraid of deep water: opens the jetty (ch7), "The Mayor Goes to Sea" (speech on Middle Mill), Village Works, hosts the ending festival |
| Miso | the twins' twenty-year sulk: "Nothing Is Refundable", Granny Mochi brokers peace, a joint shop sign |
| Clover | wants to be an explorer: "Clover's Map" (Archwater, safely lost, chalk arrows), runs Clover's Dash, paints the epilogue chart |
| Professor Hoot | cheerfully wrong: Field Notes, star count clue, rivalry with Pinfeather, Hoot's Margins and a final paper that is finally right |
| Digby | the one who can't see leads where nobody can: For Spring, the Rootdeep chapter, Gran Burrows |
| The Catchers | handing-over scenes, plaza visits after II.M, catch the seeds in the finale, rematches and Dreams |
| Nell Pelliwick | home at I.6; ferries Pip; Fish Log; her cottage holds the fish tank |
| Granny Wick | last Lamplighter; the Firstlight taken from her hands and returned first in the ending |
| Mote | antagonist with a case shown in his own places (Tally Wall, scrap lamps, Moonmere) before the player judges him; never hit by Pip; goes home in the finale; visits in ch22 |
| Wenna | speaks from I.6; gentle, tired, funny when rested; ~60 count-keyed lines at the pedestal; voice of "Ask the Tree" |

**No travelling companion** (a follower is unseen in first person). Chapter partners walk ahead or beside for one
chapter only: Digby (ch13), young Shellby (seen in memories), the Twinklings (Act IV). Nell is transport. The journal
and "Ask the Tree" are the hint system.

---

## 7. Enemies (32 new species; all "poof"; same telegraph idiom)

Archetypes from ENGINE §4 (F17). 3-4 per land; towns (Sprout Village, Wickhaven, Acornet Hollow, the Raft, Haybury,
Burrowbottom, Puffin Post, Forgefall, Sablecamp, Mote's Meadow) never spawn enemies. HP: Act II 3-5, Act III 4-7,
Act IV 5-8. Every hit Pip takes stays half a heart; later lands are harder through patterns, never bigger hits.

| Land | Species (archetype) |
|---|---|
| Under the Roots / dark places | Dimling (ghost: only hittable in lamplight) |
| Duskwick | Sizzle Beetle (charger), Coco Clonk (lobber), Dimling |
| Pinewhistle | Mossling (hopper), Pinecone Puff (splitter), Bark Beetle (shield), Needle Wasp (diver) |
| Archwater | Tidepool Jelly (hopper), Squirt Urchin (turret), Sand Snapper (burrower) |
| Threemills | Field Vole gang (swarm), Scarecrowlet (turret), Woolly Ram (charger) |
| The Rootdeep | Glow Grub (hopper), Drip Bat (swooper), Pebble Mimic (mimic) |
| The Glassway | Bubble Puffer (kiter), Gullgrab (diver; snatches a gem, drops it when bonked) |
| Kettle Isle | Soot Snuffle (charger), Steam Puff (turret), Ash Moth (swooper) |
| Saltglass Flats | Sandsnoot (burrower), Prickle Pear (turret), Sun Beetle (shield), Dust Puff (kiter) |
| Driftholm | Nimbus Puff (kiter), Gust Kite (diver) |
| The Starmeadow | Stardust Sprite (swarm), Comet Pup (charger), Moonbeam Turret (turret), Wisp Lantern (ghost) |
| Moonmere | Hushling (ghost) + silver palette swaps of the six home species |

---

## 8. Dungeons, tools and the gate map

### 8.1 Dungeons

Every dungeon is a text tile map compiled by `dungeon-compile.js` and proved soft-lock free by its solver (F21). Inside
a dungeon "dizzy" wakes Pip at its entrance with puzzle state kept.

| # | Dungeon | Land | Rooms · modelled hours (§11; +2-3 rooms under R14, §11.1 A2) | Signature mechanic | Reward | Boss |
|---|---|---|---|---|---|---|
| 1 | **Under the Roots** | home | 9 · 0.75 | darkness: glowbud doors and wall-lanterns; the Lantern (found mid-way) lights 6 m and shows Dimlings | Glowbud Lantern | Sir Rollo |
| 2 | **Whistlehollow** | Pinewhistle | 12 (+2-3) · 1.5 | updrafts: knot-holes open and close by plates; open ones lift Pip, later glided | Leaf Glider | Mossmantle |
| 3 | **Undertow Grotto** | Archwater | 14 (+2-3) · 1.5 | tide rooms: tide stones flip a room between two water levels (alternate floor states per tile) | Tide Bell | Old Gloop |
| 4 | **The Granary Vaults** | Threemills | 12 (+2-3) · 1.5 | gears and hay: hay-bale push-blocks; cranks rotate gear-bridges; hook posts | Thistle Hook | Lady Honksworth |
| 5 | **The Lamplighters' Tower** | Duskwick | 10 (+2-3) · 1.75 | beams: mirrors (hit to turn 45°) bounce a skylight beam into receivers; Sunglass from floor 3 | Sunglass + heart container | the Wickwork Moth |
| 6 | **The Rootdeep Heart** | Rootdeep | 14 (+2-3) · 1.75 | light-roots: Sunglass beams grow dim roots into bridges for 20 s; soft earth (Paws found inside) | Digging Paws | Lumbra the Long |
| 7 | **The Sunken Bell** | Glassway | 11 (+2-3) · 1.5 | sound: three bell pitches open matching doors; short sequences heard elsewhere | Starsong | Pelagia (wits) |
| 8 | **The Kettle's Belly** | Kettle Isle | 13 (+2-3) · 1.6 | steam: valves raise and lower platforms; Ember Sling (room 5) lights braziers at range and melts wax plugs | Ember Sling | Lady Fumarole |
| 9 | **The Buried Academy** | Saltglass | 14 (+2-3) · 1.75 | sand-flow tiles slide Pip; ivy lattices between floors; nameplate doors | Ivy Gloves | Tutor Scarabelle (exam) |
| 10 | **The Spiral Stair** | Driftholm | 10 (+2-3) · 1.25 | song platforms: each Starsong note makes one colour of cloud solid for 8 s | Cloudstep | Mote (chase) |
| 11 | **The Ladder of Lights** | Starmeadow → Crown | 16 · 2.0 | one floor per borrowed beacon, each using that isle's tool, then all together | - | the Second Sneeze |
| o1 | **The Snowglobe** | home, under Frostcap | 10 · 1.0 | Ember melts ice; push-ice blocks slide until they hit | a heart petal | Great-Aunt Flurry |
| o2 | **Grumble's Undercap** | home, under Grumble's Crown | 8 · 0.6 | Lantern + Paws; a tiny shroomlet town to relight | Spore Rally unlock | none |
| o3 | **The Merry Mabel** | Glassway wreck | 9 · 0.75 | tilted decks, Hook across holds, Tide Bell bilges | the ship's bell for Pinch | Bosun Snore |
| o4 | **The Hundred Lamps** | under Duskwick, post-game | 10 floors · 1.25 | harder remixes of all ten mechanics, no new rules | last heart petal, a hood trim | the Three Corners Jamboree |

### 8.2 Tools and what each opens

Used with the rebindable `tool` action (F14; default `T`, pad D-pad up), except the Glider (hold Hop in the air) and
the Gloves (walk into ivy). Each gate object has one clear look. Act II isles' critical paths need only the Lantern
and their own tool; Act III places' critical paths may use any Act II tool and the Paws, never another Act III tool;
the progression solver (F20) proves every order. Swords: Shiny (LOCKED, 150 gems) cuts **thornvine** (purple bramble);
Starsteel (Scoria, sword level 3: 3/3/4, reach 2.2 m) cuts **thornglass** (optional thickets in every land).

| Tool | Gate object | Home finds (post-pass) | Elsewhere |
|---|---|---|---|
| Glowbud Lantern (6 m light, kindles) | glowbud doors, dark mouths, Dimlings | Puddle's Grotto, 2 fairy-ring Hollows | all beacons; Rootdeep; dark caves everywhere |
| Leaf Glider (fall 2 m/s, 6 m/s forward) | gaps over 4 m, updraft columns | lighthouse gallery → islet 2 sea stack; Peaks ridge → a Woods ledge; Tree balcony → plaza | Pinewhistle ravines, Driftholm |
| Tide Bell | tide stones | the Storm Cave (Shores islets), 2 tide caches | Archwater, Glassway sandbars, Duskwick lagoon floor |
| Thistle Hook (14 m) | hookblooms (big purple thistles) | Cairn needle summit (Starstair foot), Grumble's Crown cap top, lighthouse roof | Pinewhistle high pines, Archwater arch top |
| Sunglass | light receivers, Sleeping Acorns | 12 acorns; 4 old Lamplighter beacons (a Lamp Log each) | every acorn seen so far |
| Digging Paws | soft earth (brown sparkle mound), sealed root-gates | 5 dig spots (Digby's rumours), Undercap tunnel | 2-3 buried chests per land |
| Starsong (*Dawn*, *Dusk*, *Calling*) | star doors, night-only finds, the moonpath | 4 star doors at the keepsake spots, Moonmere | night finds on every isle; calls the *Dandelion* |
| Ember Sling (25 m) | bell targets, cold braziers, ice walls | 4 bell targets on the landmarks (all four ring → the Bell Hollow), the Snowglobe ice wall | Saltglass, Driftholm, Starmeadow |
| Ivy Gloves (1.5 m/s) | ivy lattices | Great Tree trunk to a crown balcony (vista), windmill wall, lighthouse wall | Saltglass, Driftholm cliffs |
| Cloudstep | cloud motes | a sky nook above the Cairn | Starmeadow bridges |

About 40 home finds in all. Swimming, bubble-walking and shrinking are out of scope.

---

## 9. Bosses

### 9.1 The roster (all calmed, none harmed, all stay; story bosses get a plushie and a `Wake` rematch; Flurry and Bosun Snore get a rematch only)

Boss framework F18-F19. Grammar for every one: danger drawn on the ground ≥ 0.55 s ahead, at most two threats at once,
openings the boss causes itself ("Now!"), one escalation at half health, dizzy-not-dead. Scale by count: each Act II
Warden has 56 HP + 6 per Warden already calmed. Balance target per new boss: careful player wins ≥ 90 % in 45-90 s
losing ≤ 3 hearts; never-dodging ≤ 50 %. **Act-closer bosses** (the Wickwork Moth, Lumbra, Lady Fumarole, Tutor
Scarabelle) have a second escalation at 33 % health and one arena change, and their target is **120-180 s** (§11.1 A8).

| Boss | Where | HP | Signature moves | Afterwards |
|---|---|---|---|---|
| Grumble Shroom, Captain Pinch, Frostbun | home | 48/48/50 (KEEP) | KEEP | handing-over; catch the seeds in ch21; Dreams |
| **Sir Rollo** (pill-bug, 2.4 m, slate blue, cream bands) | Under the Roots | 44 | rolls along a stripe and bonks the wall; curls up and is knocked into a pit-plate (puzzle-boss); ceiling pebbles on circles | rolls Digby's tunnels; races in Clover's Dash |
| **Mossmantle** (sloth, 3.6 m, hangs from boughs) | Whistlehollow | 56+ | slow swing on a stripe; pinecone drops (1.0 s circles); dozes off mid-fight (the opening) | hums duets with the pine |
| **Old Gloop** (octopus, 4 m, eight socks) | Undertow Grotto | 56+ | arm sweeps one at a time, numbered by sock colour; an ink cloud always announced by a gulp and a 1.2 s swell; urchins Pip bats back | runs Gloop's Juggling |
| **Lady Honksworth** (goose, 3.2 m, bonnet) | Granary Vaults | 56+ | HONK ring (hop it); wing charge into the gear wall; feather fan 5/7 | hosts the Harvest Festival |
| **The Wickwork Moth** (brass automaton, 4 m span) | the Tower | 72 | sweeping lens beams; wing-gust push zone; dives at the lamp (opening when it misses) | Granny Wick rewinds it |
| **Lumbra the Long** (earthworm, 14 m) | Rootdeep Heart | 76 | surfaces from one of six holes (ring on the hole); body-arc stripe; dirt-spray fan | ferries Pip between root-gates |
| **Pelagia** (sea turtle, 3 m, bell on her shell) | the Sunken Bell | - | wits: she rings a sequence, Pip answers on three bells, three rounds; wrong notes splash (half a heart, 0.8 s tell) but never end it | "Old Friends"; Bell Duel |
| **Lady Fumarole** (fire-newt, towel) | the Kettle's Belly | 84 | belly-flop disc; hot-pebble fan; steam pillars; slips on her towel (opening) | Soakley's bathhouse regular |
| **Tutor Scarabelle** (hourglass beetle) | the Buried Academy | - | an exam: a dodging paper (sand patterns), an aiming paper (Sunglass receivers), a puzzle paper (arena tiles) | sets the Exam Retake |
| **Mote** (chase) | the Spiral Stair | - | falling lights (circles), cloak-trail stripes; stay within 20 m for 90 s | Act III end |
| **The Second Sneeze** | the Crown | - | §9.3 | main ending |
| **Great-Aunt Flurry** (optional) | the Snowglobe | 90 | avalanche roll; icicle rain on circles; a nap at 50 % (free hits, then cross) | knits Pip a scarf |
| **Bosun Snore** (optional) | the Merry Mabel | 80 | sleep-rolls across the tilted deck; snore bubbles (rings); three dozing seal deckhands | gives up the ship's bell |

Fourteen story encounters, varied in kind: 9 bouts, a puzzle-boss, a wits duel, an exam, a chase and a catch.

### 9.2 Post-game: Guardian Dreams (10) and the Hundred Lamps

`Dream · <Name>` at a napping boss enters a 96 m pastel arena with one twist: Grumble (rings roll in reverse), Pinch
(a tilting ship deck), Frostbun (ice floor, Pip slides), Sir Rollo (two Rollos), Mossmantle (everything half speed
except Pip), Gloop (eight arms, one tell each), Honksworth (goslings copy her moves late), Wickwork Moth (mirrored
beams), Lumbra (holes move), Lady Fumarole (rising bath water). First clear: 60 gems and a dream plushie variant.
The Hundred Lamps' floor 10 is **the Three Corners Jamboree**: the three Catchers in a row on one set of hearts.

### 9.3 The finale: The Second Sneeze (Mote is never hit)

1. **Stray Lights** (~2 min): borrowed lights fall from Mote's cloak on telegraphed circles across four boughs; Pip
   aims the Sunglass to steer each into a bough lantern (6 each). The bar reads "Lanterns lit", not HP.
2. **The Sneeze** (~1 min): Wenna's face scrunches (a 2 s wind-up the player knows from her sleepy face); the three
   Starseeds fly; a three-way cut-in shows the Catchers catching them ("Got it!" / "Mine! ...I mean, here." / "Caught
   one, lad!"); the last spark, Mote's own light, falls past the crown and Pip catches it on a 12 s glide through
   blossom rings. A miss loops the glide; it cannot fail.
3. **Given Light** (~3 min, no pressure): `Give · Lantern`; the save-built lantern chain; the gold Ladder; goodbye.

---

## 10. Side stories, activities, collectibles, economy, completion

### 10.1 Side stories (53; each a journal quest with one owner, no fail state, a mark left in the world)

- **Home (14):** 1 *For Spring* (Digby; a golden grove grows in the Meadow) ·
  2 *The Long Nap* (Dormy) · 3 *Nothing Is Refundable* (Miso,
  Kinako, Granny Mochi) · 4 *The Mayor Goes to Sea* (Ribbit to Middle Mill) · 5 *A Bun for Every Isle*
  (Hazel) · 6 *The Duck Regatta* (Quackenbushes) · 7 *Puddle's Grotto* (Puddle) · 8 *Little Thistledown* (a kit stows away to Duskwick) · 9 *Old Friends* (Shellby and Pelagia) · 10 *The
  Parcel With No Name* (a chain through 6 villagers, 3 Catchers, 3 isle folk; pays the Chime Bell) ·
  11 *Grumble's Nephews* · 12 *Frostbun's Great-Aunt* (the Snowglobe) ·
  13 *Shellby's Slow Walk* (resumable) · 14 *The Fourth Bough* (Wenna).
- **Duskwick (4):** 15 *Moth to a Flame* · 16 *Granny Wick's Library* (Lamp
  Logs) · 17 *The Clockwork Apprentice* (Flick) · 18 *Kinako's Limited Edition*
  (the same ordinary spoon from every isle).
- **Pinewhistle (4):** 19 *The Acorn Hoard* · 20 *Peer Review* (Hoot vs Pinfeather) · 21 *Lost in the Mist* · 22 *The Sawmill Song*.
- **Archwater (4):** 23 *Clover's Map* · 24 *The Raft Choir* · 25 *Eight Socks* (the missing sock
  is on Frostbun) · 26 *The Moon Pool*.
- **Threemills (4):** 27 *Your Honkship* · 28 *Scarecrow Hats* · 29 *The Scarecrow Who Wanted Crows* (Pennywhistle
  meets Rook) · 30 *Pie Rations*.
- **Rootdeep (3):** 31 *Burrowbottom Lamplight* · 32 *Lumbra's Itch* · 33 *Gran's Pouch* (ties to For Spring).
- **Glassway (4):** 34 *Return to Sender* (bottles' letters delivered) · 35 *The Collector* (Mr Whelk) · 36 *The Merry
  Mabel* · 37 *The Whale Who Rolls Over*.
- **Kettle Isle (4):** 38 *Starsteel* (Scoria) · 39 *Pitch Wants a Star* (paid in ch21 with a star splinter) ·
  40 *Soakley's Baths* · 41 *Miso's Supplier*.
- **Saltglass (3):** 42 *Sable's Dig* · 43 *Roll Call* (nameplates of young Granny Wick and young Pelagia) · 44 *The
  Exam Retake* (a quiz whose answers are gossip the player heard).
- **Sky and Moonmere (4):** 45 *Mote's Tally* (every tenth mark has a note: "Day 3,650: talked to a cloud. It didn't
  answer.") · 46 *Nimble Herding* · 47 *Letters Never Sent* (Moonmere: Mote's twelve letters to Wenna) · 48 *The Little
  Star* (the shy fourth Twinkling, after the ending).
- **Across lands (1):** 49 *Rook's Races* (five parts).
- **Post-game (4):** 50 *The Three Corners Jamboree* · 51 *Dream a Little* (all ten Dreams) · 52 *Hoot's Last Paper*
  (Hoot's Margins) · 53 *The Planting* (Wenna's new seed; Pip picks one of four home spots; a sapling stands there for
  good: a choice with no wrong answer).

### 10.2 Activities (12; each owned, built from existing verbs, paid in tiers with the useful prize first)

| Activity | Owner | Verbs | Tier 1 / 2 / 3 |
|---|---|---|---|
| Clover's Dash (one course per overworld, 10) | Clover | sprint, roll, hop | heart petal (gold on all) / gems / a ribbon on her windowsill |
| Vista Sketches (30) | Hoot | Look | a Field Notes chapter per 10 / gems / a print for the Nook |
| Fishing (24 species, 18 spots) | Nell | `Fish`, a timed Swing | heart petal at 16 species / rod charm / the fish tank |
| Duck Regatta | Quackenbushes | walk, hop | 40 gems / duck plushie / praise |
| Spore Rally (10, 20, 30 hits) | Grumble Shroom | Swing | heart petal / gems / a plushie hat |
| Sledding | Frostbun | roll down a run | gems / a plaza board time / praise |
| Gloop's Juggling | Old Gloop | Swing urchins back | heart petal at 50 / gems / praise |
| Harvest Cut | Lady Honksworth | Swing, timed by a sail | gems / a festival sash / praise |
| Lagoon Lights | the Wicklings | place a lantern at night | a postcard (viewing only) |
| Bell Duel | Pelagia | three bells | gems / a bell for the Nook / praise |
| Sling Gallery | Master Scoria | Ember Sling | heart petal / quick-draw discount / praise |
| Steam Hop | Soakley | glide, hop on vents | heart petal / bath towel for the Nook / praise |

### 10.3 Collectibles (10 kinds; each has a job, a cue, a count per land and a home)

| Kind | Count (needed) | Job | Cue | Home |
|---|---|---|---|---|
| Story tokens | 3 Starseeds + 4 beacons + 3 Stair Stones + 1 Ladder | headline | compass | pedestal; crown lanterns |
| Sleeping Acorns | 100 (50 for ch22) | restoration | soft snore within 10 m | saplings where found; a ring carved on the Tree per 25 (Miso stocks a new item at 25/50/75/100) |
| Keepsakes | 44 (4 KEEP + 40) | lore | twinkle within 6 m (KEEP) | the Keepsake Hollow; each land's four join into a fifth line |
| Bottle Chain | 12 (8 for ch22) | story | bob and glint on shores | the lighthouse lamp-room shelf |
| Lamp Logs | 30 | myth in pieces | spiral glyph | Granny Wick's Library |
| Heart petals | 24 (16 Hollows, 6 activities, the Snowglobe, the Hundred Lamps) | +1 heart per 6 | pink glint | hearts |
| Vistas | 30 | catalogue | Hoot's sign | Hoot's Board |
| Fish | 24 | activity | ripples | Nell's tank |
| Plushies | 16 (3 KEEP + Rollo, Mossmantle, Gloop, Honksworth, Wickwork Moth, Lumbra, Pelagia, Fumarole, Scarabelle, Mote, Wenna, Nell, a duck) | gem sink | - | Pip's Nook |
| Bestiary | 38 enemies + 15 bosses | catalogue | automatic | journal |

Per land (new content): acorns / keepsakes / Hollows / vistas / overworld chests / bottles / Lamp Logs:
home 12/0/2/4/0/0/4 (plus the 4 shipped keepsakes, 14 shipped chests and the shipped bottle) ·
Duskwick 6/4/2/2/10/1/5 · Pinewhistle 10/4/3/3/14/1/2 · Archwater 9/4/3/3/12/1/2 · Threemills 10/4/3/3/14/1/2 ·
Rootdeep 9/4/3/2/12/0/3 · Glassway 8/4/2/3/12/4/3 · Kettle 9/4/2/3/12/1/3 · Saltglass 11/4/3/3/16/1/6 ·
Driftholm 6/4/1/2/8/0/0 · Starmeadow 6/4/0/2/10/0/0 · Remembered 4/0/0/0/0/0/0 · Moonmere 0/0/0/0/0/1/0.
Totals: 100 acorns, 44 keepsakes, 24 Hollows, 30 vistas (4 home + 26), 134 overworld chests (14 + 120), 12 bottles,
30 Lamp Logs. Plus 48 dungeon chests.

**Hearts:** start 3; today 8 reachable (3 + 5); + the Tower's container + Kinako's container (300 gems) + 24 petals
(4, one per 6 petals) = **14** (`CFG.maxHp` 20 → 28, two HUD rows of 7; check at 1080p and phone width). Every hit
stays half a heart; from Act III, dungeon combat rooms run two waves of mixed archetypes at their land's pattern tier
so 14 hearts still feel the fights. (Was 16 hearts with 4 petals each; changed 2026-11-22 because a 16-heart Pip
cannot be threatened by tier-2/3 patterns. The owner may restore 16 at S-072: §15.3.)

### 10.4 Economy (gems stay the only currency; save field `coins` LOCKED)

| Fixed sources | Gems | One-time sinks | Gems |
|---|---|---|---|
| Home today | 470 | Home today | 510 |
| 96 new overworld gem chests × 30 (24 of the 120 hold a prize instead, below) | 2,880 | 13 new plushies × 100 | 1,300 |
| 48 dungeon chests × 40 | 1,920 | 16 bought Nook furnishings × 80 (8 more are found) | 1,280 |
| 40 new keepsakes × 25 | 1,000 | Ribbit's Village Works, 8 × 250 | 2,000 |
| 53 side stories × ~35 | 1,855 | *Dandelion* sail, lamp, bell | 600 |
| Activity tiers | 1,000 | Potion belt 4 and 5 (300 + 600) | 900 |
| 11 new first rematch / duel wins × 60 | 660 | Kinako: heart container 300, Bright Wick 400, Swift Fluff 400, Sling quick-draw 300 | 1,400 |
| 8 Hollow gem bags × 60 | 480 | Starsteel forging | 600 |
| 10 Dream first clears × 60 | 600 | hood trims (none sold; all are found or earned) | 0 |
| | | Miso's Hundred-Year Hanky | 1,000 |
| **Total** | **10,865** | **Total** | **9,590** |

Rule (a unit test sums the content tables): fixed sources ≥ 105 % of one-time sinks (now 10,865 / 9,590 = 113 %;
systems.md adds the 60-gem thornvine caches). Drops (~15 gems per hour) pay for potions (25) and buns (10, half a heart).

**Prize chests.** In each of the eight Act II-III overworlds (Duskwick, Pinewhistle, Archwater, Threemills, the
Rootdeep, the Glassway, Kettle Isle, Saltglass Flats) three chests hold a unique prize instead of 30 gems: that land's
Nook furnishing (the eight land pieces Kinako used to sell: lantern string, whistle clock, hammock, rocking chair,
glowcap lamp, wind chime, kettle stove, hourglass), that land's hood trim (Candle Gold, Pine Mist, Tidepool Teal, Poppy
Red, Moonmoth Lilac, Starlight Blue, Ember Rust, Dune Sand; a found trim is worn free in S-303), and that land's Field
Notes sticker. 24 chests in all; the chest ids are in each land's finds table (atlas-isles, atlas-far). The other two
trims are earned: Snowdrift (ss-12) and Three Corners (the Jamboree).

### 10.5 Completion

The tracker becomes Hoot's Field Notes' **Completion** page: one row group per land (chests, keepsakes, acorns,
Hollows, vistas, region cards, benches) plus game-wide rows (story tokens, side stories, activities, plushies,
bestiary, bottles, Lamp Logs, fish, rematches, Dreams). Totals come from `js/realms/stats.js` (F25). 100 % only when
every row is full (CANON-NOW §7 rule kept). Neither ending ever needs a row to be full.

---

## 11. Hour budget

Buckets do not overlap. Careful first-time player. **Modelled, not hoped for** (review 2026-11-22): every value comes
from a per-beat model of the content as specified (simple puzzle beat 3 min, compound puzzle 6 min, combat wave 1.5
min, story boss with one retry 4-5 min, act-closer boss 6-8 min, 1 min per room for walking and pickups, a scene at its
length × 1.2, an overworld quest step 5-10 min). The earlier table (46.5 h main, 105 h total) priced dungeons, Hollows,
memories and isle chains at about twice their content; it modelled at about 80 h. The values below include the depth
additions of §11.1.

| Bucket | Contents | Hours |
|---|---|---|
| Main story incl. story dungeons | Act I 4.0 · Interlude 1.25 · Act II 13.5 (Duskwick + ch8 with *The Lamp Round* 1.25; three isles 3.25 each: people steps, Mote's trace, the land's set piece, a deepened dungeon, Warden and kindle; the Tower 2.5) · Act III 17.25 (Rootdeep + Heart + memories 1-3 played 3.5, Glassway + Sunken Bell + memories 4-6 3.5, Kettle + memories 7-9 3.25, Saltglass 3.5, Starstair + Spiral Stair + memories 10-12 3.0, present-day Mote 0.5) · Act IV 4.0 (Starmeadow 1.0, the Ladder of Lights 2.0, the Crown and the Second Sneeze 0.5, travel 0.5) | **40.0** |
| Side stories | 53, at the per-story minutes in side-content.md#index | **16.5** |
| Optional dungeons and Hollows | Snowglobe 1.0, Undercap 0.6, Merry Mabel 0.75, 16 two-stage Hollows × 4 min 1.05, 8 Deep Hollows × 16 min 2.1 | **5.5** |
| Exploration beyond the path | every region card and landmark, the ~40 re-opened home finds, Moonmere (vistas are counted once, under Activities) | **12.0** |
| Collectible hunting beyond exploration | the last acorns, keepsakes, bottles, Lamp Logs | **7.0** |
| Activities to top tier | 11 × 30 min + Vista Sketches 0.75 (30 posts × ~1.5 min, plus the tier walks) + fishing's 24 species beyond its tier run 0.75 | **7.0** |
| Post-game | ch22 0.75, 10 Dreams × ~5 min 0.85, the Hundred Lamps 1.25, Hoot's Margins 0.75, The Planting 0.5, 100 % mop-up 2.4 | **6.5** |
| **Total (100 %)** | | **≈ 95** (band 84-112: ±12 % player speed, plus the two levers below if the model calls for them) |

**Main story only: 40 h. Main plus true ending: ~46 h.**

**The model is a test.** `tools/hours.mjs` and `tests/hours.test.js` (S-078b) sum modelled minutes from the content
tables (dungeon maps by beats per room, quest steps, scene lengths, side-story minutes, activity tiers, POI counts). The
test fails if an act's modelled main path is outside ±20 % of this table, or if the modelled 100 % for the full planned
table is under 90 h. Every close-out records the modelled hours in `progress.md`. **If `tests/hours.test.js` models
less than 95 h, add one 6-room optional mini-dungeon per Act II land (+0.75 h each, two steps each, reusing that land's
dungeon kit) and make the 10 Dreams 2-room arenas, a 4-minute pastel puzzle room built from that boss's dungeon
mechanic before the fight (+1.5 h, scope added to S-292-S-295, split if over 500 lines).**

<a id="depth"></a>

### 11.1 Depth additions (adopted 2026-11-22 from the playtime review; each is built by the named steps)

| # | Addition | Rule | Steps | Hours |
|---|---|---|---|---|
| A1 | Playtime model | the test above | S-078b | 0 (proof) |
| A2 | **Dungeon depth rule R14** | each story dungeon d2-d10 has ≥ 1.6 puzzle beats per room, ≥ 4 compound rooms (two mechanics interacting, or a multi-step sequence), one mid-dungeon **state flip** that changes 2+ earlier rooms (a revisit loop), and a final **"everything you learned"** room before the boss door; each grows by 2-3 rooms | S-104b, S-125b, S-146b, S-163b, S-184b, S-210b, S-230b, S-251b, S-270b (each lands before its dungeon's boss step) | +6.5 |
| A3 | **Real Hollows + 8 Deep Hollows** | every Hollow has a two-stage puzzle: stage 2 (after the first prize-bridge rises, a second lock appears) adds the land's earlier tool or a second mechanic; one Hollow per Act II-III land becomes a 3-room **Deep Hollow** (its existing map is room 1, two new rooms follow, 15-20 min) holding a Lamp Log slot or a Mote trace on its last pedestal next to the prize | S-093b, S-107b, S-129b, S-149b, S-186b, S-220b, S-234b, S-255b | +2.5 |
| A4 | **One main-path set piece per land** (15-25 min, no fail state) | Duskwick *The Lamp Round* · Pinewhistle *The Night Crossing* · Archwater *Floating the Raft* · Threemills *Follow the Honks* · Rootdeep: Digby's walk (already built, S-191a) · Glassway *Fog on the Water* · Kettle *The Boil-Over* · Saltglass *The Lamp Walk at Dusk* (S-249b's Lamp Walk joins the main path) | S-091b, S-106c, S-127c, S-148c, S-203b, S-232c, S-254c | +2.5 |
| A5 | **Mote's traces in Act II** | at each isle's dark beacon a scorched spiral and a scrap lamp with a note, keyed to the beacon count so the three notes read in order whatever the isle order; the third note sets up the Firstlight theft | S-090b (prop + note runner) + one data row each in S-106a, S-127a, S-148a | +0.2 |
| A6 | **Present-day Mote in Act III** | stone 1: a scrap lamp and note on the Cairn socket; stone 2: a 40 s night scene at the Cairn (Mote on flight 2; Wenna says his name; he leaves without a word); from `act2done` the crown's leaves stream upward at night (`fx.leafPull`), stronger per stone | S-212d | +0.3 |
| A7 | **Playable memories** | the Remembered Isle is free-roam between each memory group's scenes, with 3 Look-able echoes per memory and one playable vignette per group (follow the first lamps up the Cairn; race young Pelagia's footprints; walk Mote's light down the Ladder's lamps as they light; carry the turtle's lamp to the lighthouse through the far-off storm); nothing changes the past | the vignette runner and vignette 1 S-190c; vignette 2 S-212e; vignette 3 inside S-232b; vignette 4 S-254d; the echoes inside S-190b, S-212b, S-232b and S-254b (memories 10-12) | +1.5 |
| A8 | **Act-closer bosses 2-3 min** | the Wickwork Moth, Lumbra, Lady Fumarole and Tutor Scarabelle get a second escalation at 33 % and one arena change; balance target 120-180 s | scope added to S-164, S-185, S-231, S-253 and creatures.md#boss-framework | +0.3 |

**The map alone.** Calibration: a careful player walks all of today's island (0.05 km²) and finds its 14 chests and
4 keepsakes in 70-90 min, about 27 h per km² at home density. The game has 1.29 km² of overworld land, so about
35 h at home density; ability gates double back over about a quarter of it, and sailing and the cavern slow travel.
Working figure: **28-34 h to explore every land fully** (about 10 h of it overlaps the main path), and **10-12 h just
to set foot in every region and see every landmark once**. The per-land generator test (§5.1) keeps that time full.

---

## 12. Pacing rules every content step obeys

1. A new tool at least every 5 h of story play through Act III (10 tools + the boat); Act IV adds none and recombines them.
2. A dungeon at least every 4.5 h of story play; never two dungeons back to back without a land between.
3. A boss or big scene opens and closes every act; never a fetch.
4. A visible world change within 10 s of every success, where it was earned and in the crown.
5. Every land re-opens at least 3 finds in earlier lands; every tool opens at least 1 home find.
6. Free order inside an act, fixed order between acts; a critical path never needs a tool from a sibling land.
7. Count-keyed plot lines, place-keyed character lines; at most 4 × 4 hand-written combinations per act.
8. Every main quest has a chapter test; every land a prints fixture, a solver pass and a `realm` suite entry.

---

## 13. Tone charter

**How dark it may get:** a brother stranded for a hundred years; a people grown few and moved away; a ladder broken in
a storm; a lamp taken from an old moth's hands; a goodbye. Sad only in the past tense or in a goodbye; scared for one
night at most; tired but never hurt.

**Always:**
1. Sprout Village and every town are safe zones: no enemy, ever.
2. Everything that fights is calmed: enemies poof, Pip gets dizzy, bosses sit down and talk and stay friendly.
3. Every attack is drawn ≥ 0.55 s ahead; at most two attackers at once; bosses cause their own openings.
4. Hard things are opt-in: rematches, Dreams, the Hundred Lamps, gold tiers, Flurry, Bosun Snore.
5. The antagonist's case is visible in his own places before the player judges him; Pip never hits Mote.
6. Melancholy wears sunshine: dim isles are sunny by day; what is missing is a sound, a rhythm or a glow.
7. Restoration never reverts; nothing earned is taken back.
8. Nothing is missable: night content returns every night (and the Starsong makes night); memory knots, Moonmere and
   the Hundred-Year Night are revisitable; one-time scenes replay from the journal.
9. No side story, collectible or activity gates the main ending; the true ending asks for thresholds, never "all".
10. Humour in every chapter, sad ones included; villagers name specific things this player did, once per act.

**Never:** death on screen or by implication, graves or ghosts of the dead; a dark power, corruption or possession;
"it was all a dream"; betrayal by a friend; a chosen-one prophecy; peril to a child; jump scares or horror lighting;
a hurt or starving animal; a timed fail state; mockery of Digby's sight by anyone but Digby; Pip speaking.

**Voice (KEEP):** in-game "cozy"; ✿ for good news; `~` only in Miso's speech (Kinako uses `!!`); Pip is "he";
`{tokens}` for controls; lines ≤ 220 characters; each new NPC has one verbal tic readable in one line. New prompt
verbs in the `[E] Verb · Name` pill: **Enter, Sail, Sit, Ring, Dig, Hook, Climb, Touch, Kindle, Give, Dream, Fish,
Sketch, Unlock**.

---

## 14. Build order principle

Engineering first, then lands in story order, so main is releasable after every PR and every phase ends at a point the
owner could ship. Unbuilt places wait in-world: an unbuilt isle is a fog bank on the chart ("Nell won't risk the fog
yet."); an act card ships only in the same release as the content behind it (the "End of Act One" card and I.6 land
with Under the Roots, never before). Unfinished realms stay `hidden: true` behind `?realm=`.

| Phase | Contents | ≈ PRs | Ships to players |
|---|---|---|---|
| **P0 Act I deepened** (no engine work) | `docs/` canon + tone charter, reason props post-pass, three handing-over scenes, count-keyed Shellby and bough blossoms, music layers, region changes, villager memory lines, thornvine post-pass | 10 | a storied Act I with the shipped ending card |
| **P1 Foundations** | ENGINE F1-F12 (hygiene, grid size, realms, teardown ×2, swap, save v7, conditions, portals, palette, lazy bundles, chapter harness) | 12 | nothing visible |
| **P2 Story systems** | F13-F16 (text tables, dialogue, items, quests, journal as Hoot's Field Notes; retire "No quest log"), F17-F19 (enemy and boss frameworks) | 7 | the journal |
| **P3 Interlude** | F20-F23 (abilities + solver, dungeon compiler, dungeon recipe, puzzles), Pip's Nook + Keepsake Hollow, Under the Roots + Sir Rollo + Lantern, I.6 Wenna Wakes + horizon glow, new act card | 13 | Act I's turn and the first dungeon |
| **P4 Duskwick** | F24 (chart, benches, per-realm map), chart sailing card, Duskwick recipe, kit, Wicklings, Granny Wick, ch8 | 11 | Act II opens |
| **P5 Pinewhistle** (the land template's vertical slice; the Glider is the cheapest tool) | recipe + prints, kit + art, palette + music, NPCs, enemies, Whistlehollow ×2, Mossmantle, Glider + home gates, quest + chapter test, side stories, collectibles post-pass, unhide | 13 | first isle |
| **P6 Archwater, Threemills** | the same template; II.M lands with whichever ships second | 26 | three isles |
| **P7 The Tower and Act II end** | dungeon 5, Wickwork Moth, Sunglass + acorn waking everywhere, Ladder billboard, F25 completion v2, F26 bestiary | 8 | Act II complete |
| **P8 Rootdeep + Remembered Isle** | cavern recipe, Burrowbottom, root-gates, dungeon 6, Lumbra, Paws; the variant realm, young-cast recolours, memory scenes 1-12 as data | 18 | ch13 |
| **P9 Glassway** | boat locomotion (2-3, fallback chart stops), shoals recipe, Puffin Post, bottles, fishing, the Sunken Bell, Pelagia, Starsong, the Merry Mabel | 15 | ch14 + first stone |
| **P10 Kettle Isle, Saltglass Flats** | the land template twice; Starstair flights per stone | 26 | Act III stones |
| **P11 The sky** | Starstair climb, Driftholm, Spiral Stair chase, Cloudstep, Moonmere | 15 | Act III complete |
| **P12 Finale** | Starmeadow, Starkin, the Ladder dungeon, the Crown, the Second Sneeze, save-built lantern chain, epilogue state | 14 | main ending |
| **P13 Post-game** | the Night + ch22, 10 Dreams, the Hundred Lamps, Hoot's Margins, The Planting, Snowglobe, Undercap | 20 | 100 % |
| **P14 Polish (interleaved)** | F27 schedules, F28 audio registration, key art refresh (steel sword), loading cards, music tracks | 8 | - |
| **Total** | | **≈ 311 numbered steps** (≈ 415 issues after the step files' splits and the 2026-11-22 depth additions; ≈ 52 umbrella merges at 8 per stack). The phase PR counts above are the original estimates; the Totals line of `docs/roadmap/INDEX.md` is generated from the step files and is the exact count | |

Every step restates: home prints byte-identical (post-passes only); each new realm's prints frozen in the PR that
ships it; one `SAVE_VERSION` bump + `MIGRATIONS[n]` + test per schema change; every asset key has a procedural
fallback and a `realm` tag; realm bundle ≤ 2.5 MB; generation ≤ 1.2 s desktop; main pass ≤ 200 draw calls (350 hard
cap), ≤ 1.3 M tris, 300 m far plane with fog (120 m in dungeons); `bun test` and the step's in-page suite pass locally,
one heavy job at a time. **Art:** generated painterly portraits and turnaround sheets as references; code-built toon models with an ART
BRIEF so painted GLBs drop in later through the manifest. Pip's GLB
is never replaced; young Shellby and the young Catchers are the existing models scaled and recoloured; Mote is a
code-built emissive figure (capsule body, cloak shell, two dot eyes, additive glow sprite).

---

## 15. Owner decisions (defaults are what this file assumes)

1. **The load-bearing names**: Wenna, Mote, Starkin, Lamplighters, the six land names. Settle before P4 (at the latest
   S-064, the first name on screen; S-080 creates the realm id). The first Act II land was renamed **Candlecove →
   Duskwick** (realm id `duskwick`, keys `duskwick_*`, flags `beacon:duskwick`) on 2026-11-22, because "Candlecove" is
   nearly the name of "Candle Cove", a well-known horror story, which breaks both the originality rule and the tone
   charter. Default: Duskwick. If the owner prefers another name, one docs commit before S-064 replaces `Duskwick` /
   `duskwick` / `DUSKWICK` across docs/roadmap/ (nothing in js/ uses it before S-080).
2. **Shellby wrote the bottle** (recasts a LOCKED villager's past without contradicting a shipped line). Default: yes.
3. **Heart cap 14** (6 petals per heart, `CFG.maxHp` 28, two HUD rows of 7). Default: yes, checked at 1080p and phone
   width. The owner may restore 16 hearts (4 petals per heart, `maxHp` 32, rows of 8) at S-072; the cost is that
   combat stops mattering from mid-Act III (§10.3).
4. **Free sailing in the Glassway** (2-3 PRs) vs. chart stops (−3 h). Default: free sailing, with the fallback ready.
5. **Fishing** as one owned activity (no inventory). Default: yes.
6. **Hood trims** tinting the existing GLB, shown side by side first. Default: yes.
7. **The Act I card rewrite** (touches `test:playthrough` and the ending art caption). Default: in P3.
8. **Scope**: ≈ 311 numbered steps, ≈ 415 issues, ≈ 52 umbrella merges (exact counts: INDEX Totals). P0 alone already makes the shipped game a better first
   act if the rest pauses.
9. **Pip's origin.** Default: **drop** the foundling origin (found as a baby asleep in the Tree's roots): with a
   green-hooded sword hero and a talking great tree it reproduces another game's premise. Pip is an ordinary village
   kid whose den in the roots became his room (§3.4); Wenna's one ch22 line is "Every hundred years someone small
   decides to go. This time it was you. I'm so glad it was you." Settle before S-289.
10. **Item names.** Default: the new dungeon and tool names are original (**Digging Paws**, **Root Key**, **Chime
   Stone**; code ids `mitts`, `bigKey`, `compass` unchanged). The shipped **Heart Container** keeps its name (LOCKED,
   shipped in `js/data.js` and the Completion row); the owner may rename it to "Heart Seed" in one step that also updates
   `test:playthrough` texts. Settle before S-052.
