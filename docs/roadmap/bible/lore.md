# Lore: cosmology, history and every lore text

The deep truth of Starseed Isle, "The Hundred-Year Letter", and the full text of every piece of written or told lore
the player can find: the myth, the twelve Bottle Chain letters, the thirty Lamp Logs, Mote's twelve unsent letters,
Grandpa Dormy's seven night stories and the twelve memory scenes of the Remembered Isle. Written 2026-11-21 from
`CANON.md` §2-§4 and `CANON-NOW.md` §1, §5 and §8. Where this file had to decide something CANON leaves
open, the decision is listed at the end under [Decisions made here](#decisions).

**Order of authority.** CANON-NOW LOCKED lines > CANON > this file for everything it defines (the cosmology, the
timeline, Pip's origin, the twists and the lore texts). The shipped keepsake texts (CANON-NOW §5) are quoted here
only to show agreement; they never change.

What lives elsewhere (link, never copy):
- Beats, triggers, scene scripts and flags: [story.md](./story.md) (the scene-step format is
  [story.md#scene-format](./story.md#scene-format); Shellby's instalments are
  [story.md#shellby-instalments](./story.md#shellby-instalments); the 13th letter's phrases are
  [story.md#letter-phrases](./story.md#letter-phrases)).
- Who people are (look, size, palette, tic, portrait, model brief): [cast.md](./cast.md), including the young cast
  of the memories ([cast.md#young-cast](./cast.md#young-cast)).
- Where a bottle, log niche, letter or knot physically stands: [atlas-home.md](./atlas-home.md),
  [atlas-isles.md](./atlas-isles.md), [atlas-far.md](./atlas-far.md). This file says which numbered text belongs to
  which land; the atlas files place it.
- Save keys, the journal's Lore tab and the dialogue frames: [systems.md](./systems.md) (`collect.bottle` and
  `collect.log` keys are `<realm>:<global number>`; frames `memory` and `letter`).
- Side stories that deliver lore (ss-02 The Long Nap, ss-16 Granny Wick's Library, ss-34 Return to Sender, ss-45
  Mote's Tally, ss-47 Letters Never Sent): [side-content.md](./side-content.md).
- Tone, voice, name rules and invariants: [charter.md](./charter.md#tone). Who may say "Wenna", "Mote" and
  "Starkin", and from when: [charter.md](./charter.md) ("Who may say which name").

---

<a id="rules"></a>

## How implementers use this file

1. **Copy, never paraphrase.** Every text in a quote block below is shipped word for word. Italics marked with
   `*...*` render as italics in the `letter` and `memory` frames; nothing else is markup.
2. **Text ids.** Lore texts live in `js/text/en/lore.js` (core; about 30 KB of text, loaded lazily on first open of
   the journal or the first lore pickup). Memory-scene lines live in `js/text/en/remembered.js` (realm `remembered`).
   Ids:

   | Text | Id pattern | Example |
   |---|---|---|
   | Myth (8 sentences) | `lore.myth.<1-8>` | `lore.myth.3` |
   | Bottle letter body / signature / heading | `lore.bottle.<1-12>.body` / `.sign` / `.head` | `lore.bottle.4.sign` |
   | Lamp Log title / body / signature | `lore.log.<1-30>.title` / `.body` / `.sign` | `lore.log.17.body` |
   | Mote's letter heading / body | `lore.mote.<1-12>.head` / `.body` | `lore.mote.7.body` |
   | Dormy's story lines | `lore.dormy.<1-7>.<nn>` | `lore.dormy.5.03` |
   | Memory scene lines | `rm.mem<nn>.<nn>`; Look lines `rm.mem<nn>.look.<actor>.<n>` | `rm.mem09.04` |
   | Wenna's return line after a memory | `rd.wenna.mem<nn>` | `rd.wenna.mem09` |

3. **Length limits** (the content lint in S-025 checks them): every spoken line and every memory line ≤ 220
   characters (the dialogue box); a bottle body ≤ 450; a Lamp Log body ≤ 560; a Mote letter body ≤ 640; a Dormy story
   is 5-7 lines of ≤ 220. Letters and logs show in the `letter` frame ([systems.md](./systems.md), aged paper
   `#f3e7c9`, ink `#3d2f22`) as one scrollable page, never split into dialogue boxes.
4. **Hands.** Each letter-writer has a "hand": an ink colour plus a CSS style (slant, size, letter-spacing) applied to
   the `letter` frame. No font files are added (no runtime deps); hands use the system serif and cursive stacks
   with transforms. The hand of each bottle is in [the bottle table](#bottle-table). The hand `hand_shellby` is used
   on exactly three texts (bottle 12, the letter seen in memory 12 and the card in Pip's Nook,
   [#nook-card](#nook-card)), which is how "only the handwriting matches" is built.
5. **Spoilers.** Every text below carries a spoiler class (see [the spoiler ladder](#spoiler-ladder)). A step that
   places a text in a land must check that the land's earliest reachable beat is at or after the text's class.
6. **First person.** Reading is a full-screen paper card (the `letter` frame), never a 3D object held up to the
   camera. Every pickup has a sound cue that works without looking (listed per channel), and the HUD toast names the
   channel and number ("✿ Lamp Log 14 of 30").

<a id="spoiler-ladder"></a>

### The spoiler ladder

What a text may reveal depends on the earliest beat at which a player can read it.

| Class | Earliest reader | May say | Must not say |
|---|---|---|---|
| **A** | Act I or early Act II (home before `lanternGot`, Duskwick from `ch8`, the three isles before II.M) | the myth; that the Tree fell from the sky; Lamplighters, beacons, Catchers, the Starstair, the Firstlight; that "a small light" lives on the sky isle | that the Tree has a brother; the name Mote; anything about the Ladder of a hundred years ago; T5-T7 |
| **B** | after II.M (`moteNamed`): home old beacons (Sunglass, ch12), the Rootdeep (ch13), the Glassway, Kettle Isle, Saltglass (ch14) | Mote's name; that he is her brother; that he came down a hundred years ago; that the Lamplighters built the Ladder for him; that it broke in the Storm | **T5** (that she chose to stay, or that she refused), **T6** (that his gathering caused the early sneeze), **T7** (who wrote bottle 12) |
| **C** | after the 2nd Stair Stone (T5 has fired) | T5 | T6, T7 |
| **D** | after ch22 | everything | - |

Hints are allowed in any class if they do not state the twist: the shipped bottle, a too-big hat, a turtle who is
frightened of crabs, a light that flickers when Mote gathers. The **memory scenes** carry T5 (memory 9) at their own
gate (`stones>=2`) and carry the T7 hint (memory 12) at `stones>=3`; Shellby states T7 only in ch22.

---

<a id="cosmology"></a>

## Cosmology

The world has three layers and one sign. Nothing in it is a dark power, a curse or a death. Every sad thing in it is in
the past tense or in a goodbye.

| Layer | Name | What it is | Realms |
|---|---|---|---|
| Above | **The Lantern Sky** | where the Starkin live and sing | Driftholm (its lowest step), the Starmeadow |
| Middle | **The Wide Blue** | the sea and its isles; "the world" to everyone who lives there | home, Duskwick, Pinewhistle, Archwater, Threemills, the Glassway, Kettle Isle, Saltglass Flats |
| Below | **The Rootdeep** | Wenna's roots under the sea floor, reaching every isle; warm, dark, glowing; they remember | the Rootdeep, the Remembered Isle (a memory the roots keep) |

Two reflections sit beside the layers and are not layers themselves: **Moonmere** (the home isle's reflection on a
still moonlit sea, [#moonmere-lore](#moonmere-lore)) and **Hoot's Margins** (a notebook, not a place in the world;
[atlas-isles.md](./atlas-isles.md)).

<a id="lantern-sky"></a>

### The Lantern Sky

- The layer above the Wide Blue, "where the stars live". Its floor is a sea of high cloud; on it float cloud islands
  joined by constellation bridges (the Starmeadow). The Starkin call it simply "up".
- Sound carries slowly up there. A Starkin song can take a year to finish, and an answer can take a century. This is
  why nobody on the Wide Blue ever heard the sky answer a sneeze before Mote: the Starkin had been singing back the
  whole time, too slowly and too high to hear.
- Its lowest point is **Driftholm**, a piece of the sky's own floor that drifted low and never fell (the "step of sky"
  in the Lamp Logs; the painted `sky_isle` card, north-east, 900 m out, 135 m up). Driftholm is as low as a Starkin can
  come on its own light. Below it, a Starkin needs a ladder of light.
- Its highest visible point from the Wide Blue is the Starmeadow's Ladder Foot. The Lamplighters never reached it.

<a id="wide-blue"></a>

### The Wide Blue

- The turquoise sea and everything on it. Villagers say "the Wide Blue" the way other folk say "the world".
- **How the isles rose.** When Wenna rooted, her roots went down through the rock and spread under the sea floor.
  Wherever one of her longest roots came up for air, the sea floor rose with it and an isle stood up: Duskwick,
  Pinewhistle, Archwater and Threemills (the four painted horizon isles), and later Kettle Isle (where a root met the
  warm deep and the rock came up hot) and Saltglass Flats (where a root lies just under a dried-out lagoon). Every
  isle is, very far down, holding her hand.
- **The Glassway** is the shallow ring of sea between the isles, over her widest roots. It is glass-clear because the
  roots under its sand glow faintly at night and keep the water still.
- **The Slow Ring** is the current that circles the Wide Blue once every few years. A bottle thrown off the home
  lighthouse rocks rides it round all the isles and comes back, sooner or later. It is how the Bottle Chain travels
  ([#bottles](#bottles)).
- **The wind** on Starseed Isle blows from the west, off the open water, almost always. A sneeze therefore carries the
  Starseeds north, east and south, which is why there are Catchers in the Woods, the Peaks and the Shores and none in
  Bloom Meadow; what drifts west is Wenna's blossom fluff, which only ever wants to grow. (This is why the Meadow has
  "no guardian there, just flowers and secrets", and why Digby plants there.)
- Beyond the outer isles the charts stop. The Lamplighters' grown children "moved to bigger towns across the sea";
  nobody in the game goes there and no text describes it.

<a id="rootdeep"></a>

### The Rootdeep

- The layer below: Wenna's roots, running under the sea floor to every isle. Down there it is warm, dark and full of
  soft root-glow and mushroom forests. The brighter way along a root is always the way home (toward the Taproot under
  the Great Tree).
- **The roots remember.** Every footstep, song and storm above a root is felt in it. Lay a hand (or a wing) on a big
  root and you can feel the last thing that happened above it.
- **Memory knots.** When something matters very much to her, Wenna ties it in a knot on the **Taproot**, the 60 m
  column of glowing wood under the Great Tree, "the way you'd tie a string round your finger". Twelve knots hold the
  season of the Ladder, a hundred years ago. She did not lose them; she *put them down*, the way you put down
  something heavy, so she could sleep. That is the "something I've forgotten" of ch12-ch13. Touching a knot opens
  **the Remembered Isle** at that memory ([#memories](#memories)).
- **Root-gates** are the Lamplighters' doors where a root meets an isle. They silt up; the Digging Paws dig them clear.
- **Lumbra the Long** eats old worn-out roots so new ones can grow. It is a real job and a kind one
  ([cast.md](./cast.md)).
- **Burrowbottom** is the mole town in a root-hollow; moles have lived down there, and come up through the tunnels to
  Starseed Isle, for at least nine hundred years (bottle 4).

<a id="starkin"></a>

### Starkin

- The star folk: singing lights with soft round faces. Sizes range from the Twinklings (about 0.4 m) to Old Mother
  Brightwell (6 m). They are kind, slow and long-lived; they count in centuries.
- **Light is their body.** A Starkin is light wearing a shape. Near the ground that light spreads into everything
  close by, like warmth out of a cup, so a Starkin who comes low grows dim and heavy and cannot fly back up on its own.
  That is the one rule of the cosmology and everything else follows from it:
  - Wenna fell, poured her light into the rock and the sea, and became a tree (her light is now in her seeds, her
    roots, her acorns and every beacon).
  - The Starkin above cannot come down to fetch anyone without going dim themselves.
  - Mote could come no lower than Driftholm on his own light, and after a hundred years there he is too dim to fly
    home.
  - A ladder of light lets a Starkin walk below Driftholm without going dim: each lamp feeds him as he steps on it.
- **Given light lifts them** ([#given-light](#given-light)): a ladder of freely given light can carry a Starkin up as
  well as down.
- Starkin names are single soft words. The ones in the game: Wenna, Mote, Old Mother Brightwell, the three Twinklings
  and the shy fourth ([cast.md](./cast.md)).

<a id="wenna"></a>

### Wenna (the Great Tree)

- The littlest Starkin. She wanted to hear what the sea sounded like, leaned too far and fell; the sea caught her,
  pushed up a rock for her, and she rooted so she would not fall any further. She grew into the Great Tree (19.8 m,
  LOCKED, "her").
- **The spiral on her brow** (LOCKED, title art) is the shape her fall left: she spun as she fell, and the sea caught
  her in a whirl. The Lamplighters copied the sign from her brow ([#spiral](#spiral)).
- **Her light** lives in her seeds, roots and acorns. Carried out along her roots, it burns in every beacon on the Wide
  Blue, so the beacons are, thinly, her.
- **Her tiredness.** She has been tired since the night of the Storm, a hundred years ago: grief, and a long thin pull
  on her light from Mote's gathering (T6). "I was so tired I had forgotten how to wake up."
- **Her name** is said only by the oldest characters ([charter.md](./charter.md), "Who may say which name").

<a id="mote-lore"></a>

### Mote (in the cosmology)

- Wenna's little brother, a Starkin. Character, look and voice: [cast.md](./cast.md). Here: what he is able to do.
- He answered her letter a hundred years ago, the first Starkin ever to try, and came down to Driftholm on his own
  light. He walked lower only on the Lamplighters' Ladder of Lights. Since the Storm he has been stranded on Driftholm,
  too dim to fly up and unwilling to go home without her.
- **What he can reach.** On his own: Driftholm, its clouds (which bounce him back up), and Moonmere by the moonpath
  (reflected light weighs nothing, so he can walk down it without dimming, [#moonmere-lore](#moonmere-lore)). On
  borrowed light: anywhere, for as long as it lasts. Every trip burns some of it, so each theft makes the next one
  necessary.
- **His gathering.** For a century he has gathered every light he could reach: fireflies, sparks off the lighthouse,
  the moon on puddles, a spark from Granny Wick's window on cold nights. Light leans toward its kin; whenever his
  little store grew, Wenna's own light leaned toward it, the way a plant leans toward a window. Over a hundred years
  the lean became a pull, and on the night before day one she sneezed early (**T6**, told in ch19 by Old Mother
  Brightwell). He never knew.
- **Rule:** Pip never hits Mote. Every encounter with him is a chase, a conversation or a catch.

<a id="starseeds"></a>

### The Starseeds

- A Starseed is a piece of Wenna's own starlight grown into a seed. Three exist at a time (Woods `#8be07a` leaf star,
  Frost `#9fdcff` snowflake star, Sea `#ff9f8f` shell star; LOCKED). They hum (LOCKED: the crystal stone "sounds a lot
  like the Starseeds do"); moles find them by the humming (bottle 4).
- In the pedestal's three star sockets they feed her light out along her roots to every beacon. If the sky "kept"
  them, she would fade, which is why the Catchers exist.
- **The first Starseed.** Long ago she had only one seed, which hummed in her crown "like a kettle about to sing".
  The Lamplighters carried it up the Summit Crystal Cairn to see the stars (LOCKED: "We carried the first Starseed up
  here to see the stars. It liked them."). The stars sang back, very far and very slow, and she heard her family for
  the first time since she fell. Before giving it back the Lamplighters lit one lamp from it: the
  [Firstlight](#firstlight). After that night she grew three seeds instead of one, and a hundred years later she
  sneezed them at the sky for the first time.

<a id="sneeze"></a>

### The Sneeze

- About once every hundred years (LOCKED: the bottle) Wenna misses the singing and sneezes her three Starseeds
  straight up toward the sky. It is a **letter**: the Starkin read the three lights rising, and the message is
  *still here*. It is not an illness (**T1**).
- The letter is the flight itself. The Lamplighters used to climb the Cairn on sneeze nights with every lamp raised so
  the sky would see the letter go up from the place where the first Starseed saw the stars. The Cairn is "where each
  letter is shown to the sky".
- The seeds must come down again, or she fades. The Catchers catch them; a child carries them home.
- Sneezes come on the hundredth midsummer, give or take a few weeks. The one on the night before day one came early,
  because of Mote's pull (T6). The small sneeze at the end of Act II and the Second Sneeze of the finale are caused
  by Mote's Ladder pulling at her ([story.md#ch12](./story.md#ch12), [story.md#ch21](./story.md#ch21)).

<a id="catchers"></a>

### The Catchers of the Corners

- The three guardians' real office (LOCKED names Grumble Shroom, Captain Pinch, Frostbun). A Catcher stands at a corner
  the wind blows toward (the Woods to the north, the Peaks to the east, the Shores to the south), catches whatever flies
  at a sneeze, and hands it on by the Rule. "Guardian" is the villagers' word for it; it is a real duty (**T2**).
- **The test of a kind hand** is the gentle bout. A Catcher blusters; the child who swings and swings gets nowhere
  (the shipped "harmless shrug" after three hits outside an opening); the child who waits, watches and swings only
  when the Catcher stops to breathe ("Now!") wins. "Patience is the kindest thing a hand can do." (Lamp Log 8.)
- **History of the office.** The Lamplighters appointed the first Catchers after the first sneeze, about 1,400 years
  ago, when one seed nearly reached the sky. Catchers serve for centuries and choose their own successors.
  - Before the present three: an old **badger** in the Woods (he hummed when pleased), a **snow goat** in the Peaks
    (she knew every way up the mountain, told you all of them and ate hats), and a grey **seal** on the Shores (fair,
    fishy, threw pies to the gulls). They are never named in any text.
  - Two hundred years ago the old three made their last catch and retired; they chose three young ones "who are very
    young and very keen" (bottle 11).
  - **A hundred years ago the present three made their first catch ever**, and the first kind hand they tested was a
    tiny turtle in a too-big hat (memory 4). This game's catch is only their second. After a century with nothing to
    catch they had half forgotten the Rule, which is how they came to keep the seeds for their own kind reasons
    ([story.md#I.2](./story.md#I.2)).
  - Hence the LOCKED line that the rematches were "the most fun they have had in a hundred years".
- The present three's look a hundred years ago: a smaller, cheerful Grumble; a Pinch with no hat yet; a Frostbun the
  size of a rabbit ([cast.md#young-cast](./cast.md#young-cast)). Pinch's hat arrives in memory 6 as a folded paper one;
  the real skipper's hat came later.

<a id="catchers-rule"></a>

### The Catchers' Rule

> Catch what flies. Keep it one night. Give it only to a kind hand.

Set by the Lamplighters about 1,400 years ago (Lamp Log 6). "One night" is a minimum, not a deadline: the seed waits
with its Catcher until a kind hand comes. When the Catchers asked how to tell a kind hand, the Lamplighters said
"you'll know". The Rule is quoted word for word by Shellby (instalment 2, in his own words), by Lamp Log 6 and by the
Catchers themselves; never reworded.

<a id="seed-bearer"></a>

### Seed-bearers

- The child who carries the Starseeds home after a sneeze. Nobody chooses the seed-bearer: every century the grown-ups
  say "someone ought to go", and while they are saying it a child goes. "By tradition, whoever bothers to go."
- Seed-bearers come from any isle and any family. The twelve who wrote letters are listed in
  [the bottle table](#bottle-table); before 1,200 years ago seed-bearers wrote nothing down.
- **The custom of the letter.** On the first calm night after the seeds are home, the seed-bearer writes a letter
  "to whoever finds this" for the next child and throws it off the lighthouse rocks into the Slow Ring. That is the
  Bottle Chain ([#bottles](#bottles)). The thirteenth seed-bearer is Pip.
- Seed-bearers are never heroes in the texts. Their letters are about snacks, hankies, crabs and bedtimes.

<a id="wardens"></a>

### Wardens

- The same old office as the Catchers, only longer: on isles where the Lamplighters could not stay all year, they asked
  a good creature to keep the beacon. A Warden "keeps the light, keeps the folk, and keeps a door shut to anyone who
  would take the light without asking. Wardens are stubborn. That is the job." (Lamp Log 16.)
- The Wardens of the game: Mossmantle (the Whistling Pine), Old Gloop (the Great Arch), Lady Honksworth (Tumble Hill),
  the Wickwork Moth (the Tower; a Lamplighter automaton, the only Warden that is a made thing), Lumbra the Long (the
  Rootdeep Heart), Pelagia (the Sunken Bell), Lady Fumarole (the Kettle), Tutor Scarabelle (the Academy). Each one is
  found doing the job too hard, alone, for a kind reason ([story.md#ch9-11](./story.md#ch9-11),
  [creatures.md](./creatures.md)).

<a id="lamplighters"></a>

### The Lamplighters

- **Who.** Moon-moth folk (the Wicklings of Wickhaven are their descendants and cousins). They are the "we" on the
  humming crystal stone (LOCKED). Granny Wick, 112, is the last; Flick wants to be the next.
- **What they did.** Kept a beacon on every isle so boats could cross the Wide Blue at night; carried the first
  Starseed up the Cairn; lit the Firstlight and every lamp from it; set the Catchers' Rule; built the Starstair, the
  Lamplighters' Tower on Duskwick, the sea chapel and its bell in the Glassway, the root-gates, the benches, and the
  Academy on Saltglass Flats; and, a hundred years ago, the Ladder of Lights.
- **Their craft, still working.** The glowing vines that seal the Catchers' arenas answer a Catcher and nobody else;
  the fairy rings in the Whispering Woods are doors to Hollows and open to a lamp; the benches face home; the spiral
  marks everything that connects to somewhere.
- **Naming lamps.** Every Lamplighter child is given one lamp at her naming, lit from the Firstlight. It is the one
  thing a Lamplighter owns. A lamp lit once is never relit from anything but the Firstlight.
- **Sayings.** "Light's not for keeping. It's for passing on." (Granny Wick learned it from her mother, Keeper Tallow;
  memory 5.) "Light lit from light is not less lit." "Leave a lamp in the window for them."
- **The Lamplighters' Book.** Their logbook, kept in the Tower for fifteen centuries, written by many keepers. After
  the Storm, with lamps spent and families leaving, Keeper Tallow and young Wick unbound it and sent each page to the
  place it was about, "so every light knows its story". Those pages are the thirty Lamp Logs
  ([#lamp-logs](#lamp-logs)); Granny Wick wants them home (ss-16).
- **Why they grew few.** Every lamp they owned burned out on the Ladder; a Lamplighter without a lamp is just a moth
  who stays up late. Their children grew up and moved "to bigger towns across the sea". Nobody was hurt and nobody was
  driven away. The game always says this kindly and in the past tense.
- **Keepers named in the texts** (head Lamplighters of the Tower, oldest first): Keeper Taper, Keeper Sconce, Keeper
  Glim, Keeper Chandry, Keeper Lanthorn, Keeper Snuffwell, Keeper Tallow (Granny Wick's mother, keeper a hundred years
  ago). Then Wick, who was twelve and never took the title.

<a id="beacons-lore"></a>

### Beacons

- One lamp per isle, each holding a share of Wenna's light brought up her roots to that isle's end and held in a lamp.
  "Light the lamp and the isle remembers its rhythm: the pine sings, the tide turns, the sails go round. Let it go dark
  and the isle forgets, a little at a time." (Lamp Log 2.)
- Because a beacon is her light, the Glowbud Lantern (a spark of her in a bud) can rekindle a dark one, and Mote can
  borrow one. Numbers, states and the crown lanterns: [systems.md#beacons](./systems.md#beacons).
- Starseed Isle had four small beacons of its own on its landmarks (the Cairn, Grumble's Crown, the lighthouse roof, the
  Meadow Windmill), dark for a hundred years; the Sunglass wakes them (S-169), and each gives a Lamp Log.

<a id="firstlight"></a>

### The Firstlight

- The flame in the great lamp at the top of the Lamplighters' Tower, lit from the very first Starseed and carried
  across the water in a clay pot. Every Lamplighter lamp was lit from it. "The oldest light on the Wide Blue."
- After the Storm it burned low, banked like an ember deep in the lens; young Wick lit the tower's one window from it
  every night for a hundred years. On the night of the bloom Mote took Duskwick's beacon light (the window went out)
  but could not find the banked Firstlight. When Pip kindles the great lamp with three beacons relit, the Firstlight
  wakes and blazes, and Mote takes it ("It's the only one strong enough"). Pip's ordinary flame stays lit. In the
  finale the Firstlight comes home to Granny Wick first.

<a id="given-light"></a>

### Given light

The Lamplighters' old way, and the answer of the whole game.

| Kind | What happens | Example |
|---|---|---|
| **Given light** | hold your lamp to someone else's and both burn; nothing is lost | lighting a neighbour's lamp; the lantern chain in the finale |
| **A ladder of given light** | every lamp hung on it burns all it has in one night, holding a Starkin up (or down); it harms nobody, and it holds for one night only | the Lamplighters' Ladder (each night needed fresh lamps); the gold Ladder Mote climbs home on |
| **Taken light** | lift a flame out of its lamp and carry it off, and the place it came from goes dark | Mote's borrowing: the pine stops singing, the tide sticks, the mills stop |

- "Light lit from light is not less lit." Given light never leaves anyone dark.
- A ladder of given light can lift a Starkin home. It could even have lifted Wenna, roots and all; but her roots would
  sleep and the isle would lose its Tree. That was Mote's offer, and she said no (T5).
- **The Hundred-Year Night** ([story.md#ch22](./story.md#ch22)) is the night a whole people gives light at once: the
  Starkin come down a ladder of given light for one night, visit, and go home at dawn, and nobody grows dim.

<a id="spiral"></a>

### The Spiral

- The one repeated sign of the cosmology. It is on Wenna's brow (LOCKED key art), carved on Driftholm's arch (LOCKED
  `sky_isle` card), and on every Lamplighter beacon, bench, ruin, Hollow door, root-gate and Lamp Log niche.
- **Meaning.** "The way home": start anywhere on a spiral and follow it round and you come to the middle. To players it
  means "this connects to somewhere". The geometry is fixed by the kit ([atlas-isles.md#kit-spiral](./atlas-isles.md#kit-spiral):
  right-handed, 2.5 turns, a short outward tick).
- **Benches face home.** Every Lamplighter bench faces the bearing of Starseed Isle, even where the isle cannot be
  seen (Lamp Log 9). A player who sits and looks straight ahead is looking toward the Great Tree.
- Rule for every writer and builder: the spiral is never used on anything that does not connect or hold a find, and it
  never means a curse, a portal to anywhere bad, or a warning.

<a id="starstair"></a>

### The Starstair

- The Lamplighters' floating stone stair from the needle of the Summit Crystal Cairn to Driftholm, built about 1,350
  years ago so they could sing to the Starkin from closer up. Three flights of 22 floating steps (66 in all;
  [atlas-far.md#starstair-route](./atlas-far.md#starstair-route)).
- The flights float; they hang on **three keystones**, the Stair Stones ([#stair-stones](#stair-stones)).
- It was whole for over twelve centuries. A pelican seed-bearer climbed it six hundred years ago "and the stars looked
  close enough to borrow" (bottle 7). Grandpa Dormy's gran saw it as a girl.
- In the Storm a hundred years ago the keystones were knocked loose and the flights drifted apart into the high cloud,
  out of sight; they came down "soft as feathers" and nobody was hurt. Setting a stone at the Cairn calls one flight
  back. With all three set, Pip climbs it to Driftholm (ch18).

<a id="stair-stones"></a>

### The Stair Stones

- The Starstair's three keystones: pale, egg-shaped, the size of a pumpkin, humming like the Starseeds but lower. Each
  holds up one flight. "Take one out and the flights it holds settle gently away. We tested this. Twice. By accident."
  (Lamp Log 26.)
- In the Storm they arced over the sea like shooting stars (memory 11) and came down in three far places, where each was
  put to a kind use by a Warden:
  - one in the Bell Shallows, where the sinking sea chapel's bell swallowed it; it became the bell's clapper (Pelagia);
  - one into the Kettle's spout, where it keeps the Kettle simmering instead of boiling over (Lady Fumarole);
  - one onto the Academy's bell tower on Saltglass Flats, where it became the bell's weight (Tutor Scarabelle).
- The roots show Pip where they fell (ch13). The look and the beats: [story.md#stone-beats](./story.md#stone-beats).

<a id="ladder-of-lights"></a>

### The Ladder of Lights

Two ladders share the name.

1. **The Lamplighters' Ladder** (a hundred years ago). A lamp on every step of the Starstair (66), two on each of the
   two landings between flights (4), and a line of lamps from the foot of the Cairn's needle down the Peaks, over the
   river and along the path to the plaza, one every metre or so (142): **212 lamps a night**. Built over five nights
   with lamps carried from every isle. It stood for seven nights while brother and sister talked; each night burned all
   212 lamps out and needed fresh ones (1,484). On the eighth night the Lamplighters hung their very last lamps on the
   Starstair alone (66), so Mote could come down and ask once more, and the Storm blew them out before he could.
   1,550 lamps in all: every lamp the Lamplighters owned, young Wick's naming lamp among the first night's.
2. **Mote's Ladder** (Acts II-IV). Wound from borrowed beacon light and, at the end of Act II, the Firstlight. It hangs
   in the north-east sky from every realm, then is lowered from the Starmeadow into Wenna's crown, where it pulls at
   her. It is taken light, not given, which is why it hurts the isles. Pip climbs it downward (dungeon 11,
   [dungeons.md#d11](./dungeons.md#d11)) and frees each light home.
3. **The gold Ladder** of the finale is the third, made of the lanterns everyone gives: the first ladder of given
   light in a century, and the one Mote climbs home on.

<a id="acorns-lore"></a>

### Sleeping Acorns

- Wenna drops acorns everywhere her roots reach, each a little of her waiting for a spring. With her light thin for a
  century, they fell asleep where they lay (LOCKED: "This one never quite fell asleep."). A beam of gathered sunlight
  (the Sunglass) wakes one; it grows a sapling. One hundred across the Wide Blue; counts and placements:
  [systems.md](./systems.md), atlas files.
- The Acornet squirrels of Pinewhistle call them "sleepy acorns" and hoard them "for safekeeping" because sleepy folk
  belong together.

<a id="moonmere-lore"></a>

### Moonmere and the moonpath

- On still nights the moon lays a path of light on the sea. Reflected light weighs nothing, so a Starkin can walk down a
  moonpath from the sky without growing dim, but only on the reflection, and only to the reflection.
- At the foot of the moonpath off Starseed Isle lies **Moonmere**: the isle's reflection, silver and still, exactly the
  home isle as Mote has seen it from above for a hundred years. Mote found the way in his seventh year on Driftholm
  (his letter 5) and made it a second home: he hung scrap lamps on the **Moon Tree** (Wenna's reflection, the only
  version of her he could sit beside), planted the **Mirror Garden**, and left his letters there because he had no
  other way to post them.
- Living things can walk the moonpath only with the Lamplighters' *Calling* tune holding it steady (the Starsong;
  [systems.md](./systems.md)). Moonmere is a reflection, not a dream: nothing there is undone when Pip leaves.

<a id="storms"></a>

### The two storms

- **The Storm** (a hundred years ago, night 13 of the Ladder season): a great sea storm out of the west. It blew out the
  last lamps of the Ladder, knocked the three keystones into the far sea, rang the sea chapel's bell once as the chapel
  sank in the Bell Shallows, and left Mote stranded on Driftholm. Nobody was hurt. Seen in memories 10-11 from far away.
- **The Last Big Storm** (two summers ago; LOCKED: "After the last big storm, five rainbow shells washed up on the
  Shores"): an ordinary big storm that broke the Slow Ring for a season and threw the Bottle Chain's drifting bottles up
  on sandbars, islets and far shores all over the Wide Blue. That is why eleven old bottles can now be found
  ([#bottles](#bottles)).

---

<a id="timeline"></a>

## Timeline

"Years ago" counts back from day one. Exact numbers are for writers; in player-facing text the far past is always
"long ago", "thousands of years", or the century a letter names.

| Years ago | What happened | Where the player learns it |
|---|---|---|
| ~4,000 ("thousands") | Wenna leans too far, falls and is caught by the sea; a rock rises; she roots and grows. Her longest roots raise the isles. | the myth (Lamp Log 1; Shellby, Act I; Dormy 1) |
| ~2,000 | The first islanders arrive by sea and settle round the Tree. | Dormy 2 |
| ~1,600 | The moon-moth Lamplighters cross the water and keep a beacon on every isle. | Lamp Logs 2, 10 |
| ~1,500 | The Lamplighters carry the first Starseed up the Cairn; the stars sing back; she hears them. The Firstlight is lit and carried to the new Tower on Duskwick. The Lamplighters' Book begins (Keeper Taper). | Lamp Logs 3, 4; the humming stone (LOCKED) |
| ~1,400 | The first sneeze: three seeds, straight up; one nearly reaches the sky. The Catchers' Rule and the first Catchers. The first seed-bearer carries them home. | Lamp Logs 5, 6, 8 |
| ~1,350 | The Starstair is built to Driftholm, with three keystones. | Lamp Logs 26, 27; Dormy 4 |
| ~1,300 | The Academy is founded on Saltglass Flats; the sea chapel and its bell in the Glassway. | Lamp Logs 24, 25 |
| 1,200 | Oona, a moth apprentice, writes the first bottle. The custom of the Slow Ring begins soon after. | bottle 1; Lamp Logs 22, 23 |
| 1,100 → 200 | Ten more sneezes, ten more seed-bearers, ten more bottles (bottles 2-11). The old Catchers serve; Forgefall's smiths forge the Lamplighters' hooks and bells. | bottles 2-11; Lamp Logs 16-18 |
| 200 | The old Catchers (badger, goat, seal) make their last catch and retire; three young ones are chosen. | bottle 11; Dormy 3 |
| 112 | Granny Wick is born on Duskwick (Keeper Tallow's daughter). | Granny Wick |
| ~110 | Elder Shellby is born on Starseed Isle. | cast.md |
| **100: the Ladder season** | **Night 0:** the sneeze; the young Catchers' first catch; a star falls onto Driftholm in answer (memories 1-2). **Day 1:** the Lamplighters climb the Starstair and meet Mote; they begin carrying lamps from every isle (memory 3, that evening). **Day 2:** a tiny turtle in a too-big hat carries the seeds home (memory 4). **Nights 1-5:** lamps are carried from every isle and hung. **Day 5:** a race on the beach (memory 6). **Night 6:** young Wick hangs her naming lamp on the last hook and the Ladder is lit (memory 5); Mote walks down (memory 7). **Nights 6-12:** seven nights of talk (memory 8). **Night 12:** Wenna chooses to stay (memory 9). **Night 13:** the last lamps; the Storm; the keystones fall; the chapel sinks; Mote is stranded (memories 10-11). **Night 14:** the turtle writes the bottle and hides it at the lighthouse (memory 12). | the memories (Act III); Lamp Logs 29-30; Mote's letter 1 |
| 99 | Keeper Tallow and Wick unbind the Lamplighters' Book and send its pages out. The Academy's last students leave; the sand starts to cover it. | Lamp Log 30; Saltglass |
| 99 → 1 | Wick keeps the Tower window lit from the banked Firstlight. The Lamplighters grow few and their children move away. The Catchers nap and half forget the Rule. Wenna sleeps more. Mote counts, gathers, finds Moonmere (year 7), writes letters, keeps the Tally Wall. | Mote's letters; Tally Wall (ss-45); Dormy 5 |
| ~20 | Miso and Kinako's sulk begins. | cast.md |
| 2 (summers) | The Last Big Storm scatters the Bottle Chain and washes up five rainbow shells. | Clover (LOCKED); Puffin Post |
| the night before day one | Wenna sneezes early (Mote's pull). The Catchers catch the seeds and, half asleep, keep them for their own kind reasons. | Act I; T6 in ch19 |
| day one → | The game. The bloom is the brightest light in a hundred years; Mote, watching, believes she is burning out, and that night starts borrowing the beacons. | Act I end; Mote's letter 12 |

<a id="pip"></a>

## Pip

- **Who he is.** An ordinary Sprout Village kid, and the whole village has had a hand in bringing him up: Shellby
  knitted the fox-eared hood and sewed on the two-leaf sprout "so the Tree would know you"; Miso sold him his first
  sword at a discount she still denies; Hazel has fed him cinnamon buns since before he could reach the counter. When
  he was small he made a den in a hollow between Wenna's roots and would not sleep anywhere else, so Shellby put a door
  on it: that is Pip's Nook. That is why everyone calls him "little sprout", and why he always wakes by the Tree when he
  gets dizzy: it is the place he thinks of as home, and she is looking after him. (CANON §3.4, §15.9: the earlier
  foundling origin is dropped; no origin story is told anywhere.)
- **The one line**, said once, in ch22, in Wenna's voice ([story.md#ch22](./story.md#ch22)):

  > Every hundred years someone small decides to go. This time it was you. I'm so glad it was you.

- **What is never said or implied, anywhere, ever:** that Pip is a Starkin, a fallen star, a seed of the Tree, a
  Lamplighter's child, Mote's anything, a foundling, or the subject of a prophecy; his parents or where they are; his
  age in years. He is the one who bothered to go. Villagers may say that he has always lived here and that the Tree is fond of him.
- **What the player can find before ch22** (none of it states the origin): his Nook is in her roots; the hood has a
  sprout; Shellby's card in the Nook ([#nook-card](#nook-card)); Wenna's "Oh. You have a leaf in your hood."

<a id="nook-card"></a>

### Shellby's card in Pip's Nook

A folded card on the Nook's windowsill, readable from ch7 (`[E] Read · A card`), in `hand_shellby`. It is the
handwriting the player can compare with bottle 12 and memory 12. Placement: [atlas-home.md](./atlas-home.md) (Pip's
Nook). Text (class A, it says nothing about the bottle):

> For our little sprout.
> The hood is so the Tree will always know you.
> Keep it on in the rain.
> — S.

---

<a id="twists"></a>

## Twists

Seven reveals, in order. Each one re-reads what came before and was planted at least twice before it fires. No twist
is a dark power, a corruption, "it was a dream", a death, or a friend's betrayal.

| Id | Twist | Fires (beat) | Told by | Planted before by | Re-reads |
|---|---|---|---|---|---|
| **T1** | The sneeze is a letter, not an illness | Act I, 1 seed home (`inst:1`) | Shellby | the title art (seeds fly *up*); the humming stone (LOCKED) | why the seeds fly upward; "still here" |
| **T2** | The guardians are Catchers with a duty | Act I, 2 seeds home (`inst:2`) | Shellby; the handing-over scenes | "guardian" as a role word; the reason props by each arena; Shellby I.1 "older than they look" | the "gentle defeat"; Miso's "calmed" |
| **T3** | Waking the Tree woke something else: the lights go out | I.6 | Wenna | the lit window on horizon card c; Pinch's dark lamp | the bloom stops being the end |
| **T4** | The Lamp Thief is Mote, her brother, "borrowing" like the guardians did | II.M (2nd beacon) | Mote | the tower-stair glimpse (ch8); Dormy 5 (a little light that counts); the Catchers' kind keeping in Act I | every dark beacon becomes a lonely act, not a cruel one |
| **T5** | Wenna chose to stay | 2nd Stair Stone (memory 9) | Wenna, in memory | Mote's letters (he insists she was kept); Lamp Log 30 ("She's still here"); Mote at the midpoint: "She fell" | Mote's whole plan is a rescue nobody asked for; the myth's "so she would not fall any further" |
| **T6** | Mote's gathering caused the early sneeze | ch19 | Old Mother Brightwell | Mote's letter 7 ("Every time I gather a little, you flicker"); Wenna at ch12 ("Something tugged. Far up."); Hoot's star count | the inciting incident of the whole game |
| **T7** | Shellby was the last seed-bearer and wrote the bottle | ch22 | Shellby | the shipped bottle (unsigned, LOCKED); instalment 3 ("Smaller than you, even"); memory 4 (the too-big hat); memory 12 (the hand); Dormy 7 (a seed-bearer frightened of crabs); Pelagia's "You ring like Shellby did"; the Nook card's hand | his calm in Act I; "this old pedestal"; "most fun in a hundred years"; why the bottle was at the lighthouse and not in the sea |

**How the myth is "complicated once".** The myth says she "put down roots so she would not fall any further" (true, once).
After memory 9, Wenna's return line ([#mem-09](#mem-09)) adds the second reason: she keeps them now because of the
people. The myth's text never changes; the player's reading of it does.

---

<a id="myth"></a>

## The myth

The creation myth, in the one-breath form. This is **Lamp Log 1** ("The Song of the Sea-Caught Star", copied from the
old song by Keeper Taper), given by Granny Wick in ch8, and the canonical text every other lore line agrees with. It is
told once in one breath and complicated once (T5). Text ids `lore.myth.1`-`lore.myth.8`, one per line; the Lore tab
shows them as one page under the heading "The Myth", and Lamp Log 1 shows the same eight lines.

> Before the isles there was only the Wide Blue below and the Lantern Sky above, and nothing in between but wind.
> The Starkin sang to each other across the dark. The littlest of them wanted to know what the sea sounded like.
> So she leaned down to listen. She leaned too far, and she fell.
> The sea caught her. It pushed up a little rock for her to land on, and she put down roots so she would not fall any further.
> She grew, and she grew, and she became the Great Tree. Her light went into her seeds.
> Every hundred years she misses the singing, and she sneezes three Starseeds up toward the sky. It is a letter. It says: *still here.*
> The corners of the isle catch the seeds so the sky does not keep them, because the Tree needs her light to live.
> And someone carries them home.

**Spoiler class A.** The word "Starkin" appears here; per the charter, characters say it only after the beat that
explains them, but the myth may print it from ch8 because it *is* that explanation for a reader.

<a id="myth-tellings"></a>

### Who tells it, and how

| Telling | Where | Text | Covers |
|---|---|---|---|
| Shellby's instalments (Act I, count-keyed) | the pedestal | [story.md#shellby-instalments](./story.md#shellby-instalments) (`inst:1`, `inst:2`, `inst:3`) | `inst:1` = lines 1-6 in his words (T1); `inst:2` = line 7 and the Rule (T2); `inst:3` = line 8 and the plant for T7 |
| Lamp Log 1 | Granny Wick, ch8 | the eight lines above | all of it |
| Grandpa Dormy, story 1 | his cottage, night | [#dormy-1](#dormy-1) | a folk version with two charming mistakes and one true clue |
| Wenna's return line after memory 9 | the Taproot | [#mem-09](#mem-09) | the complication: why she keeps her roots now |
| The Hundred-Year Night | ch22 | [story.md#ch22](./story.md#ch22) | the myth's last line comes true for Pip |

<a id="myth-plates"></a>

### The myth strip (optional art)

One painted strip for the top of the Lore tab's Myth page and Lamp Log 1's card: four panels, left to right. Spec and
prompt in [#lore-assets](#lore-assets) (`ui_myth_strip`). Fallback: no image; the parchment page with a gold spiral
drawn in the corner.

1. A tiny pale-gold star with a round face leaning out from a row of singing stars over a dark sea.
2. The star falling in a spiral trail; the sea lifting a wave like two cupped hands.
3. A sapling on a small rock, a soft spiral on its trunk, roots spreading down into turquoise water.
4. A great tree on a green isle sneezing three little lights (green leaf star, blue snowflake star, pink shell star)
   up toward a band of faint stars.

<a id="keepsake-agreement"></a>

### How the four shipped keepsakes fit (LOCKED texts, no change)

| Keepsake | LOCKED text says | What it is in the cosmology | Paid off in |
|---|---|---|---|
| Glowing acorn (Grumble's Crown) | "the Great Tree dropped acorns like this one all over the isle. This one never quite fell asleep." | a Sleeping Acorn that stayed awake because it lay by the Woods beacon's old glow | [#acorns-lore](#acorns-lore); the 100 Sleeping Acorns |
| Humming crystal stone (the Cairn) | "It sounds a lot like the Starseeds do." / "We carried the first Starseed up here to see the stars. It liked them." | a chip of the Cairn's crystal that sat beside the first Starseed that night and still hums its tune; "we" are the Lamplighters, who scratched the line on it | Lamp Log 3; [#starseeds](#starseeds) |
| Message in a bottle (the lighthouse) | "To whoever finds this: the Great Tree sneezes about once every hundred years. Keep a hanky handy. P.S. The crabs are friendlier than they look." | bottle 12 of the Bottle Chain, the only unsigned one, written by young Shellby and hidden in the rocks because he was too small to throw it into the Slow Ring | [#bottle-12](#bottle-12); T7 in ch22 |
| Tiny seed pouch (the Windmill) | "'For Spring'" / "Someone has been planting little bits of the Tree all over the meadow." | Digby's pouch, stitched by Gran Burrows; the seeds are Wenna's blossom fluff, which drifts west on the wind | [#wide-blue](#wide-blue) (the wind); ss-01, ss-33 |

---

<a id="bottles"></a>

## The Bottle Chain

Twelve letters "to whoever finds this", one per century, each written by that century's child seed-bearer and thrown
into the Slow Ring from the home lighthouse rocks, except the newest, which never went into the sea. Every letter is
signed except the newest. Each reads the letters before it if it found any, so the chain has running jokes: snacks,
hankies, and a frog's croak.

- **Collect key** `collect.bottle['<realm>:<n>']` with `n` the global number below ([systems.md](./systems.md)).
- **Pickup.** A bottle bobs and glints at the waterline or lies in sand (the `kit_bottle` model,
  [art-audio.md](./art-audio.md)). Prompt `[E] Open · A bottle` (the shipped verb and label). Sound: a glass clink and
  a small wave wash on approach within 6 m; on open, a cork pop and paper rustle. Toast "✿ A letter from the Bottle
  Chain! (n of 12)". The card shows `.head`, then `.body`, then `.sign`, in the writer's hand.
- **Home.** Found bottles stand on the shelf in the lighthouse lamp room ([atlas-home.md](./atlas-home.md)); the Lore
  tab lists them in number order with empty numbered slots for the missing ones.
- **Return to Sender** (ss-34): Postmistress Pell copies each found letter and Pip carries the copy to the place the
  letter names; the destinations are in [side-content.md#ss-34](./side-content.md#ss-34) (bottle 1 the Cairn, 2
  Grumble's Crown, 3 the lighthouse door, 4 the Meadow Windmill, 5 the well, 6 the pedestal, 7 the Tower's foot, 8 the
  Whistling Pine, 9 the Great Arch, 10 Tansy Mill, 11 the Academy bell tower), and every letter below names its place.
  The "Family today" column is lore only: villagers may mention the ancestor once the letter is found (optional
  flavour lines, never required).
- **Spoilers.** All twelve are class A by content (every writer lived before Mote came, except Shellby, whose letter is
  LOCKED). Placement only has to respect when each land opens.

<a id="bottle-table"></a>

| # | Years ago | Writer | Species | From | Found in (land) | Key | Hand: ink, style | Paper | Family today |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1,200 | **Oona**, 8½ | moon moth, Lamplighter apprentice | Duskwick | Duskwick | `duskwick:1` | `#5b4a7a`, small, upright, very neat | `#ece0c2` | Granny Wick |
| 2 | 1,100 | **Millet** | field mouse | Haybury, Threemills | Threemills | `threemills:2` | `#6b4a2e`, tiny, tightly spaced | `#ede2c5` | the Hayburys |
| 3 | 1,000 | **Fen** | otter | the Raft, Archwater | Archwater | `archwater:3` | `#2f6f6a`, wavy baseline (±2 px) | `#eee3c6` | Skipper Rafferty |
| 4 | 900 | **Loam** | mole | Burrowbottom | the Glassway | `glassway:4` | `#3a3a3a`, 1.3 × size, uneven letters (random ±3° per word) | `#eee4c8` | Gran Burrows |
| 5 | 800 | **Conker** | red squirrel | Acornet Hollow, Pinewhistle | Pinewhistle | `pinewhistle:5` | `#8a4b2a`, fast, 12° slant | `#efe5c9` | Elder Nutmeg |
| 6 | 700 | **Tuppence** | dormouse | Sprout Village | Saltglass Flats | `saltglass:6` | `#3a3f7a`, each line drifts down 1° | `#f0e6cb` | Grandpa Dormy |
| 7 | 600 | **Sandy Pelliwick** | pelican | Sunny Shores | the Glassway | `glassway:7` | `#2a3f6b`, big loops, 1.15 × size | `#f0e7cc` | Nell Pelliwick |
| 8 | 500 | **Quill Thimble** | hedgehog | the bun cottage | the Glassway | `glassway:8` | `#7a4a2a`, round and plump | `#f1e8ce` | Hazel Thimble |
| 9 | 400 | **Mallow Thistledown** | bunny | the burrow by the pond | Kettle Isle | `kettle:9` | `#8a5060`, very neat, wide letter-spacing | `#f2e9cf` | Primrose Thistledown |
| 10 | 300 | **Croakley** | frog | the lily pad by the plaza | the Glassway | `glassway:10` | `#3f6b2a`, bouncy baseline (alternate words ±3 px) | `#f2eacf` | Mayor Ribbit |
| 11 | 200 | **Yuzu** | cat | the shop with the striped awning | Moonmere | `moonmere:11` | `#9a5a2a`, curly, a flourish on every capital | `#f3ebd1` | Granny Mochi (and Miso and Kinako, who argue over it) |
| 12 | 100 | *(unsigned)* young Shellby | turtle | Sprout Village | home (LOCKED: the lighthouse sea side) | `home:12` | `hand_shellby`: `#4a6a3a`, small, careful, rounded, 4° upward slant | `#f3e7c9` | (nobody: it is already home) |

Counts by land agree with CANON §10.3: Duskwick 1, Pinewhistle 1, Archwater 1, Threemills 1, Glassway 4, Kettle 1,
Saltglass 1, Moonmere 1, home 1 (shipped) = 12. Bottle 11 is the one Mote found at the foot of the moonpath and kept,
unopened, in the Mirror Garden (his letter 8).

<a id="bottle-1"></a>

### Bottle 1: Oona

- **Head:** Bottle 1 · about twelve hundred years old
- **Body:**

> To whoever finds this: I am Oona, and I carried the seeds home this time. First I took them up the tall stones in the east to show the stars, like the Keepers do. Keeper Glim says to write it down so the next one knows it can be done. It can be done! The Catchers are big, but they stop to breathe, and that is when you go. The Tree said thank you. Out loud.

- **Sign:** — Oona, aged eight and a half, apprentice, Duskwick

<a id="bottle-2"></a>

### Bottle 2: Millet

- **Head:** Bottle 2 · about eleven hundred years old
- **Body:**

> To whoever finds this: there was a letter before mine, so now there are two, which makes it a tradition. I came over from Threemills on my uncle's grain boat, and nobody else would go, so I went. Bring a snack. I ate mine under the giant mushroom in the woods, and the Catcher let me. The seeds are heavier than they look, and the walk home is long.

- **Sign:** — Millet, of Haybury, who is a mouse

<a id="bottle-3"></a>

### Bottle 3: Fen

- **Head:** Bottle 3 · about a thousand years old
- **Body:**

> To whoever finds this: hello from the year the tide came up to the bakery. The Shore Catcher is a seal. She smells of fish, but she is fair. Go round the back of the lighthouse; the rocks at the front are slippy. I read two letters before I wrote this one. I hope you get to read three.

- **Sign:** — Fen, otter, of the Raft

<a id="bottle-4"></a>

### Bottle 4: Loam

- **Head:** Bottle 4 · about nine hundred years old
- **Body:**

> To whoever finds this: sorry about the writing. Moles write by feel. I came up out of the tunnels by the windmill in the west and found the seeds by their humming, so if you lose your way, stand still and listen. She sneezes very big, by the way. I was standing right underneath. Bring a hanky.

- **Sign:** — Loam, of Burrowbottom

Note: Loam's joke about his own writing is Digby-family self-deprecation by a mole (charter: only moles joke about
moles' sight). This letter starts the chain's hanky joke.

<a id="bottle-5"></a>

### Bottle 5: Conker

- **Head:** Bottle 5 · about eight hundred years old
- **Body:**

> To whoever finds this: Squirrel's honour, I did not keep any of the seeds, not even for a little while, even though they are the shiniest things I have ever seen. I washed my paws in the village well first. There is a frog in it who waves. The Woods Catcher is a badger, and he hums when he is pleased. Make him hum. Also bring a hanky. Loam was right.

- **Sign:** — Conker, of the Acornet clan, Pinewhistle

<a id="bottle-6"></a>

### Bottle 6: Tuppence

- **Head:** Bottle 6 · about seven hundred years old
- **Body:**

> To whoever finds this: I nearly didn't go because it was past my bedtime. Go anyway. You can sleep after. The Peaks Catcher is a goat who knows every way up the mountain and will tell you all of them. Afterwards I fell asleep on the Tree's roots by the old pedestal, and she hummed me a song with no words. Best nap of my life.

- **Sign:** — Tuppence, Sprout Village

<a id="bottle-7"></a>

### Bottle 7: Sandy Pelliwick

- **Head:** Bottle 7 · about six hundred years old
- **Body:**

> To whoever finds this: I flew. I know that's cheating. I was at the moths' Tower on Duskwick when the seeds went up, and it's a long way. The Catchers said flying was fine as long as I walked the last bit, so I walked the last bit. Afterwards we climbed the floating stair to the step of sky. The stars looked close enough to borrow.

- **Sign:** — Sandy Pelliwick, Sunny Shores

<a id="bottle-8"></a>

### Bottle 8: Quill Thimble

- **Head:** Bottle 8 · about five hundred years old
- **Body:**

> To whoever finds this: I baked each Catcher a pie to say thank you, from the recipe the squirrels sing under the whistling pine. The badger ate his. The goat ate hers, and the plate. The seal threw hers to the gulls when she thought I wasn't looking. Two out of three is still good. Hanky: yes. Pie: optional.

- **Sign:** — Quill Thimble, the bun cottage

<a id="bottle-9"></a>

### Bottle 9: Mallow Thistledown

- **Head:** Bottle 9 · about four hundred years old
- **Body:**

> To whoever finds this: Mum said to wipe my paws before I held the seeds, so I did, and the Peaks Catcher said it was the politest thing she had ever seen. Be polite. It works on everybody, even goats. Next we're sailing to see the great arch on the rock isle. I'm putting a clean hanky in this bottle in case you forgot yours.

- **Sign:** — Mallow Thistledown, the burrow by the pond

The hanky is long gone (Pell: "Stamped! ...No hanky, I'm afraid. The sea keeps those.").

<a id="bottle-10"></a>

### Bottle 10: Croakley

- **Head:** Bottle 10 · about three hundred years old
- **Body:**

> To whoever finds this: I practised a victory croak the whole way home, and when I got there it came out as a squeak. Everyone clapped anyway. Next summer I'll practise on top of Tansy Mill, where nobody can hear. The seal is very old now. She says the next catch might be somebody else's job. Keep your hanky handy and your croak warm.

- **Sign:** — Croakley, the lily pad by the plaza

<a id="bottle-11"></a>

### Bottle 11: Yuzu

- **Head:** Bottle 11 · about two hundred years old
- **Body:**

> To whoever finds this: the old Catchers have all retired, the badger and the goat and the seal, and they've picked three new ones who are very young and very keen. Be gentle with them. They've never done it before. I sold the badger my best ribbon for the road. No refunds. Now I'm off to the Academy on the bright flats to learn bells.

- **Sign:** — Yuzu, the shop with the striped awning

<a id="bottle-12"></a>

### Bottle 12: (unsigned)

- **Head:** Bottle 12 · about a hundred years old
- **Body (LOCKED, shipped in `js/data.js` SECRETS; the keepsake's first line "...The paper inside is salty and
  curled." stays the keepsake's):**

> To whoever finds this: the Great Tree sneezes about once every hundred years. Keep a hanky handy. P.S. The crabs are friendlier than they look.

- **Sign:** none. This is the only unsigned letter in the chain, and the Lore tab shows its writer as "?" until
  `trueEnding`, then "Elder Shellby, aged about ten". In memory 12 the young turtle stops before signing:
  "Whoever finds it won't need my name. They'll need a hanky."
- It never went into the sea: he was too small to throw it past the rocks, so he tucked it into them on the lighthouse's
  sea side (LOCKED position (7.2, 119.7)), where it waited a hundred years for Pip.

<a id="letter-13"></a>

### The thirteenth letter (Pip's)

Written in ch22. The scene, the phrase lists and their conditions are [story.md#ch22](./story.md#ch22) and
[story.md#letter-phrases](./story.md#letter-phrases); this section fixes only how the letter looks and reads.

- **Frame:** `To whoever finds this:` + phrase 1 + ` ` + phrase 2 + ` P.S. ` + phrase 3. No signature: under the text
  Pip draws a two-leaf sprout (a small inline image, `ui_sprout_sign`, or the fallback glyph ✿ in `#5f8f2f`). He signs
  the way Shellby didn't, without a name.
- **Hand:** `hand_pip`: ink `#5f8f2f` (hood green), 1.2 × size, upright, a little wobbly (each word rotated by a
  seeded ±1.5°). Paper `#f6edd6`.
- **Bottle:** green glass, the cork tied with a twist of hood-green yarn `#7aa63a`. Pinch throws it far out into the
  Slow Ring from the lighthouse ([story.md#ch22](./story.md#ch22)). It is never found again in the game. The Lore tab
  shows it as "Bottle 13 · this year" after `trueEnding`.
- **Rules for its phrases** (for story.md): each phrase ≤ 90 characters, in a child's plain words, specific to
  something this player did; at least one phrase in each group is always available; no phrase states a twist the
  player has not seen; none quotes a villager's catchphrase except as a deliberate echo of the chain (snacks, hankies,
  crabs, croaks).

---
<a id="lamp-logs"></a>

## Lamp Logs

Thirty pages of the Lamplighters' Book, the logbook the head Lamplighters kept in the Tower for fifteen centuries. After
the Storm, Keeper Tallow and young Wick unbound it and sent each page to the place it was about, "so every light knows
its story" ([#lamplighters](#lamplighters)). That is why each land's pages are about that land. The page numbers are
the Book's own order, by subject, not by date; each page is signed by the keeper who wrote it.

- **Collect key** `collect.log['<realm>:<n>']` ([systems.md](./systems.md)); items `log:1` and `log:2` for the two
  pages Granny Wick hands over ([story.md#ch8](./story.md#ch8), [story.md#beacon-1](./story.md#beacon-1)).
- **Pickup.** A rolled page in a Lamp Log niche (`kit_log_niche`, [atlas-isles.md#kit-log-niche](./atlas-isles.md#kit-log-niche));
  prompt `[E] Read · Lamp Log`; the niche's spiral chimes three soft notes within 8 m (once per approach). Toast
  "✿ Lamp Log n of 30". The card shows `.title`, `.body`, `.sign` in the `letter` frame, ink `#3d2f22` on `#f3e7c9`,
  upright print (Lamplighters write like printers; no hand style).
- **Home.** Granny Wick's Library in Wickhaven ([side-content.md#ss-16](./side-content.md#ss-16)): each found page
  appears on its shelf slot. The Lore tab lists all thirty by number with empty numbered slots.
- **Voice.** Plain and practical, a little dry, kind. Present tense for how things work; past tense for what happened.
  No page states T5, T6 or T7.

<a id="log-table"></a>

| # | Title | Keeper | Land | How found | Key | Class |
|---|---|---|---|---|---|---|
| 1 | The Song of the Sea-Caught Star | Taper (copied) | Duskwick | given by Granny Wick, ch8 | `duskwick:1` | A |
| 2 | What a Beacon Is | Taper | Duskwick | given by Granny Wick at `beacon-1` | `duskwick:2` | A |
| 3 | The First Starseed | Taper | home | the old beacon on the Summit Crystal Cairn (Sunglass) | `home:3` | B |
| 4 | The Firstlight | Taper | Duskwick | niche at the Tower's foot | `duskwick:4` | A |
| 5 | Three Seeds | Sconce | Pinewhistle | niche on Whistle Rise | `pinewhistle:5` | A |
| 6 | The Catchers' Rule | Sconce | Archwater | niche on the Basalt Stairs | `archwater:6` | A |
| 7 | No Catcher in the West | Sconce | home | the old beacon on the Meadow Windmill (Sunglass) | `home:7` | B |
| 8 | A Kind Hand | Glim | Threemills | niche on Tumble Hill | `threemills:8` | A |
| 9 | The Spiral | Glim | Duskwick | niche on a ruin ring at Ember Sands | `duskwick:9` | A |
| 10 | Wickhaven | Chandry | Duskwick | niche under the stilts at Wickhaven | `duskwick:10` | A |
| 11 | The Whistling Pine | Glim | Pinewhistle | niche in Misthollow Ravines | `pinewhistle:11` | A |
| 12 | The Moon Pool | Chandry | Archwater | niche at the Tidepool Shelf | `archwater:12` | A |
| 13 | The Granary Lamp | Chandry | Threemills | niche in Orchard Rows | `threemills:13` | A |
| 14 | The Woods Light | Lanthorn | home | the old beacon on Grumble's Crown (Sunglass) | `home:14` | B |
| 15 | The Shore Light | Lanthorn | home | the old beacon on the lighthouse roof (Sunglass) | `home:15` | B |
| 16 | Wardens | Lanthorn | Kettle Isle | niche at the Bathhouse Terraces | `kettle:16` | B |
| 17 | Forgefall | Lanthorn | Kettle Isle | niche at Forgefall | `kettle:17` | B |
| 18 | The Kettle Breathes | Snuffwell | Kettle Isle | niche at the Spout | `kettle:18` | B |
| 19 | Roots | Snuffwell | the Rootdeep | niche at a root-gate spur | `rootdeep:19` | B |
| 20 | The Roots Remember | Snuffwell | the Rootdeep | niche near the Taproot | `rootdeep:20` | B |
| 21 | The Root-Keeper | Snuffwell | the Rootdeep | niche in the Geode Galleries | `rootdeep:21` | B |
| 22 | The First Letter | Glim | the Glassway | niche at Puffin Post | `glassway:22` | B |
| 23 | The Slow Ring | Chandry | the Glassway | niche on Gull Rock | `glassway:23` | B |
| 24 | The Sea Chapel | Lanthorn | the Glassway | niche in Bell Shallows (low tide) | `glassway:24` | B |
| 25 | The Academy | Lanthorn | Saltglass Flats | niche at Sablecamp | `saltglass:25` | B |
| 26 | The Starstair | Sconce | Saltglass Flats | niche on Academy Hill | `saltglass:26` | B |
| 27 | A Step of Sky | Sconce | Saltglass Flats | niche in the Glass Dunes | `saltglass:27` | B |
| 28 | Given Light | Glim | Saltglass Flats | niche in the Salt Pans | `saltglass:28` | B |
| 29 | The Answering Star | Tallow | Saltglass Flats | twin niches in the open porch of the Academy bell tower, Academy Hill (outside the dungeon) | `saltglass:29` | B |
| 30 | The Last Page | Wick | Saltglass Flats | the second of the twin porch niches, beside 29 | `saltglass:30` | B |

Counts by land agree with CANON §10.3 (home 4, Duskwick 5, Pinewhistle 2, Archwater 2, Threemills 2, Rootdeep 3,
Glassway 3, Kettle 3, Saltglass 6 = 30). Duskwick's five are two given pages (1, 2) and three placed niches (4, 9,
10), so the Duskwick finds post-pass places **three** niches. The "How found" region is a target for the atlas
files; exact coordinates are theirs.

<a id="log-1"></a>

### Lamp Log 1: The Song of the Sea-Caught Star

- **Body:** the eight lines of [the myth](#myth) (`lore.myth.1`-`lore.myth.8`; the only body over 560 characters).
- **Sign:** — copied from the old song by Keeper Taper

<a id="log-2"></a>

### Lamp Log 2: What a Beacon Is

> A beacon is not a fire we made. It is a share of her light, brought up her roots to the end of each isle and held in a lamp. Light the lamp and the isle remembers its rhythm: the pine sings, the tide turns, the sails go round. Let it go dark and the isle forgets, a little at a time. Keep it lit. If it goes out, light it again from her. Nothing else will do.

— Keeper Taper

<a id="log-3"></a>

### Lamp Log 3: The First Starseed

> She had one seed then, only one, and it hummed in her crown like a kettle about to sing. We carried it up the tall stones in the east to see the stars. It liked them. The stars sang back, very far and very slow, and she heard them for the first time since she fell. Nobody slept. Before we came down I scratched it on a loose stone, so the stones would remember.

— Keeper Taper

<a id="log-4"></a>

### Lamp Log 4: The Firstlight

> Before we gave the seed back, we lit one lamp from it and carried the flame home across the water in a clay pot. It burns now in the great lamp at the top of our Tower. Every lamp we own is lit from it, and every child's naming lamp. We call it the Firstlight. Do not let it go out. If it ever burns low, do not poke it. Wake it gently, with more light.

— Keeper Taper

<a id="log-5"></a>

### Lamp Log 5: Three Seeds

> After the stars sang, she grew three seeds instead of one. A hundred years later she sneezed them straight up into the night, all three, as if she were throwing a letter as high as she could. We watched from the tall stones. One very nearly reached the sky. We think the sky would have kept it, and that she would have been the dimmer for it. Something must be done.

— Keeper Sconce

<a id="log-6"></a>

### Lamp Log 6: The Catchers' Rule

> We have asked three good creatures to stand at the three corners the wind blows toward: the woods, the peaks and the shore. When she sneezes, they catch. The rule we gave them: Catch what flies. Keep it one night. Give it only to a kind hand. They asked how they would know a kind hand. We said: you'll know.

— Keeper Sconce

<a id="log-7"></a>

### Lamp Log 7: No Catcher in the West

> Someone asked why there is no Catcher in the west. The wind on her isle comes from the west, always, off the open water, and a sneeze goes where the wind goes: north, east and south. What drifts west is her blossom fluff, and her fluff only ever wants to grow. Leave the west to the flowers, and to whoever is kind enough to plant them.

— Keeper Sconce

<a id="log-8"></a>

### Lamp Log 8: A Kind Hand

> How a Catcher tests a hand: a little bout, all bluster and no harm. The child who swings and swings gets nowhere. The child who waits, and watches, and swings only when the Catcher stops to breathe, wins. Patience is the kindest thing a hand can do. We do not choose the child. Every century the grown-ups say someone ought to go, and a child goes instead.

— Keeper Glim

<a id="log-9"></a>

### Lamp Log 9: The Spiral

> We carve the spiral on every beacon, bench and doorstep we make. We took it from her brow. It means the way home: start anywhere on it, follow it round, and you come to the middle. Our benches always face her, even on isles where you cannot see her over the sea. If you are ever lost, find a spiral and sit down. Then look straight ahead.

— Keeper Glim

<a id="log-10"></a>

### Lamp Log 10: Wickhaven

> We build Wickhaven on stilts because the tide comes up to say hello twice a day, and moths do not care for wet feet. Every house has one window that faces the Tower. If you can see the Tower's light from your bed, you are home. Leave a lamp in your own window too. Somebody out on the water may be looking for theirs.

— Keeper Chandry

<a id="log-11"></a>

### Lamp Log 11: The Whistling Pine

> The pine on the north isle has knot-holes in a spiral, and while its beacon burns the wind finds every one and the whole hill sings. The squirrels sleep to it. When it goes quiet they do not sleep, and squirrels who cannot sleep start hoarding. Its Warden is a slow fellow who can hum the whole song himself if he must. He should never have to.

— Keeper Glim

<a id="log-12"></a>

### Lamp Log 12: The Moon Pool

> Under the great arch on the rock isle lies a round pool that holds the beacon's light like a moon. The tide follows that light in and out. Put the light out and the tide will stick wherever it was. The otters moor their raft to the arch and trust the tide to be sensible. The Warden there has eight arms and has promised to use all of them if she has to.

— Keeper Chandry

<a id="log-13"></a>

### Lamp Log 13: The Granary Lamp

> Every summer the farm isle fills a lamp with sunshine and hangs it from the beacon over the granary. It keeps the wheat ripening through the grey months. If it ever goes out, the Warden of the hill will try to turn all three mills by herself. Tell her not to. She will not listen. Geese do not.

— Keeper Chandry

<a id="log-14"></a>

### Lamp Log 14: The Woods Light

> On her isle the woods glow because her light runs close under them. We set a small beacon on the great mushroom to help it along. The vines that close round a Catcher's ring are our craft: they answer a Catcher and nobody else. The rings of glowing mushrooms are doors, and they open to a lamp. The little ones in there are afraid of the dark. Keep it glowing.

— Keeper Lanthorn

<a id="log-15"></a>

### Lamp Log 15: The Shore Light

> The striped tower on the south shore is a lamp for boats, not one of our beacons, but we keep a small light on its roof all the same. Whoever keeps the shore keeps a light for anyone at sea. It is the oldest manners there are. If a boat is out late, leave the lamp burning by day as well. Nobody minds.

— Keeper Lanthorn

<a id="log-16"></a>

### Lamp Log 16: Wardens

> On isles where we cannot stay all year, we ask a good creature to keep the beacon for us. We call them Wardens. It is the same office as a Catcher, only longer. A Warden keeps the light, keeps the folk, and keeps a door shut to anyone who would take the light without asking. Wardens are stubborn. That is the job.

— Keeper Lanthorn

<a id="log-17"></a>

### Lamp Log 17: Forgefall

> The bears of the kettle isle forge our lamp-hooks, our chains and our bells. Their best smith says the hottest fire on the Wide Blue is not the mountain but a star-splinter, and that a blade cooled in starlight would cut glass. We told him not to go looking for star-splinters. He went looking. He has not found one. He says he will.

— Keeper Lanthorn

<a id="log-18"></a>

### Lamp Log 18: The Kettle Breathes

> The kettle isle's mountain simmers. It needs to boil over a little every year, or it grumbles for weeks. The spout lets the steam out. Never block it, not even to keep something safe. The bathhouse folk always know when it is about to puff, by the taste of their tea. Ask them. They will offer you a towel. Accept the towel.

— Keeper Snuffwell

<a id="log-19"></a>

### Lamp Log 19: Roots

> Her roots run under the sea floor to every isle we know, and each isle stands where one of her longest roots comes up for air. Down there the roots glow. A Lamplighter who drops her lamp in the deep can still find her way: the brighter way is always home. We built a gate wherever a root meets an isle. If one silts up, dig it out. Gently. It is her.

— Keeper Snuffwell

<a id="log-20"></a>

### Lamp Log 20: The Roots Remember

> Lay your wing on a big root and you can feel what happened above it: a footstep, a song, a storm. The roots remember everything. When something matters very much to her, she ties it in a knot on the great root under her, the Taproot, the way you would tie a string round your finger. We do not touch the knots. They are hers.

— Keeper Snuffwell

<a id="log-21"></a>

### Lamp Log 21: The Root-Keeper

> There is a worm down here as long as a street, who eats her old worn-out roots so the new ones can grow. Do not be frightened. The worm is very polite and wears spectacles, has never once been on time, and has never once been wrong about a root. If the worm curls up round something and will not move, there is a good reason. Ask what it is.

— Keeper Snuffwell

<a id="log-22"></a>

### Lamp Log 22: The First Letter

> This century's seed-bearer, a moth girl of eight named Oona, wrote a letter after the seeds came home and put it in a bottle, addressed to whoever finds this. She said the next child should know that someone had done it before. We think this is a very good idea, and we have told the next one to do the same.

— Keeper Glim

<a id="log-23"></a>

### Lamp Log 23: The Slow Ring

> The custom now is that the seed-bearer throws the letter off the lighthouse rocks on the first calm night. The sea round the isles turns in a slow ring, once every few years, and a bottle that goes in comes round again, sooner or later, to whoever needs it. If a bottle turns up on your shore, read it. It was written for you as much as anyone.

— Keeper Chandry

<a id="log-24"></a>

### Lamp Log 24: The Sea Chapel

> In the shallows between the isles we have built a little chapel round a bell. Ring it, and every Lamplighter on the Wide Blue knows to look up: the stair is open, a letter is going, the sky is listening. It rings in three notes, one for each seed. Our children learn the tune before they learn to read. Soft at dawn, low at dusk, bright to call a boat.

— Keeper Lanthorn

<a id="log-25"></a>

### Lamp Log 25: The Academy

> On the bright flats in the south-west we keep our school. Students learn lamps, knots, tides, bells, roots and patience. The final exam has three papers: dodging, aiming and thinking. The Tutor sets all three and has never once been late with the bell. Hardly anybody passes the first time. Nobody minds. You may sit it again next year.

— Keeper Lanthorn

<a id="log-26"></a>

### Lamp Log 26: The Starstair

> We have built a stair from the needle of the tall stones in the east up to the step of sky. Three flights of twenty-two steps, and every step floats. Three keystones share the weight, each holding up one flight. Take a keystone out and the flight it holds drifts gently away, and comes back when the stone goes home. We tested this. Twice. By accident.

— Keeper Sconce

<a id="log-27"></a>

### Lamp Log 27: A Step of Sky

> The floating isle in the north-east is not rock from the sea. It is a piece of the sky's own floor that drifted low and never fell. Stand on it and you are as near the Starkin as anyone on the Wide Blue will ever be. It is also as low as one of them can come on its own light. We have left a lamp up there, in case. Nobody has come. We keep it lit anyway.

— Keeper Sconce

<a id="log-28"></a>

### Lamp Log 28: Given Light

> Hold your lamp to someone else's and both burn. That is given light, and light lit from light is not less lit. A ladder of given light is another thing: every lamp hung on it burns all it has in one night, holding a star up or down. It harms nobody, and it is spent by morning. Taken light is worst of all. Lift a flame from its lamp and carry it off, and the place it came from goes dark. We never take.

— Keeper Glim

<a id="log-29"></a>

### Lamp Log 29: The Answering Star

> After this century's sneeze, someone answered. A small light fell onto the step of sky and stayed. We climbed up this morning. He is her little brother, and his name is Mote. He cannot come any lower on his own. We are going to hang a lamp on every step of the stair and all the way down to her, so he can walk to her on light. It will take every lamp we have. Nobody has argued.

— Keeper Tallow

<a id="log-30"></a>

### Lamp Log 30: The Last Page

> Mum is busy counting what's left, so I am writing this. The Ladder stood seven nights. They talked. We didn't listen; it wasn't ours to hear. Last night the storm blew out the last lamps and knocked the keystones into the sea, and the stair went away. He's safe up on his rock. She's still here. We have no lamps left, mine neither, so I'll keep the Tower window lit from what's left of the Firstlight. Someone should.

— Wick, aged twelve

---
<a id="mote-letters"></a>

## Mote's letters

Twelve letters Mote wrote to Wenna over a hundred years on Driftholm and could never send. From his seventh year he
carried them down the moonpath and left them in the Mirror Garden in Moonmere, beside the Moon Tree, the only Wenna he
could sit next to ([#moonmere-lore](#moonmere-lore)). Pip reads them in side story ss-47 *Letters Never Sent*
([side-content.md#ss-47](./side-content.md#ss-47)).

- **Where.** One letter folded inside each of Moonmere's 12 moon-lanterns, letter n in lantern n (lantern numbering
  and coordinates: [atlas-home.md](./atlas-home.md), Moonmere). As [ss-47](./side-content.md#ss-47) runs it:
  `[E] Kindle · Moon-lantern` with the Lantern, the lantern opens, and the letter, folded into a little paper boat
  (`prop_moonmere_letter`, [#lore-assets](#lore-assets)), sits on its base plate: `[E] Read · Letter`. Sound: one
  soft high bell with a shimmer when Pip comes within 6 m of a lantern whose letter is unread.
- **Card.** `letter` frame on Mote's paper (`moonmere_paper`, lilac-silver `#e6e3f4`), ink `#3b4f9a`, hand
  `hand_mote`: quick, slanted forward 10°, every number underlined. Heading (`.head`) top right in the same hand.
- **Save.** Read state as flags `moteLetter:<n>` (no version bump; [systems.md](./systems.md) flag families). Why
  inside lanterns: Mote hung twelve of his scrap lamps in the Mirror Garden and posted each letter into one, "so
  they'll have a light to be read by" (letter 9).
- **Spoilers.** Class B: Moonmere opens after the Sunken Bell's stone, which may be the first stone. No letter states
  T5 or T6. Mote writes his own belief (that she is kept, that the isle is using her up), which T5 later overturns;
  letter 7 plants T6 without stating it. The player may read them in any order; each stands alone.
- **Voice.** Quick, earnest, a little sharp, never cruel; counts things ([cast.md](./cast.md)). Each opens "Wenna,"
  and closes "— Mote". Never self-pity for more than one sentence before a joke or a plan.

<a id="mote-letter-1"></a>

### Mote's letter 1 · Night 1

> Wenna, The ladder's gone. One thousand five hundred and fifty lamps, that's what the moths spent on me. I counted. The storm blew out the last sixty-six. I'm on the step of sky. I'm not hurt. I'm stuck, and I'm wet, and I'm cross. The moths will build another ladder. Moths always build things. Then I'll come down and we'll finish talking. — Mote

<a id="mote-letter-2"></a>

### Mote's letter 2 · Night 40

> Wenna, Nobody has built a ladder. I watch the stone tower every night. One window, lit. Just one. I think the moths have run out of lamps. Is that my fault? Don't answer that. I'll find my own light. How hard can it be. — Mote

<a id="mote-letter-3"></a>

### Mote's letter 3 · Night 365

> Wenna, A whole year. I made a lamp from a seed husk and nineteen fireflies who said they didn't mind. It lasted till morning. I'm keeping a tally on the big rock so I don't lose count. You always said I'd lose count. I haven't. Three hundred and sixty-five. — Mote

<a id="mote-letter-4"></a>

### Mote's letter 4 · Year 3

> Wenna, I tried to come down on my own again. I got as far as the clouds under my rock and went so dim I couldn't see my own hands. The clouds bounced me back up. They're very kind clouds. Round, and they toot. I've named some of them. I won't tell you the names. They're private. — Mote

<a id="mote-letter-5"></a>

### Mote's letter 5 · Year 7

> Wenna, I've found a way down! On still nights the moon lays a path on the sea, and reflected light weighs nothing, so I can walk it all the way to the bottom. There's an isle down there just like yours, only silver and quiet, and you're in the middle of it. Not really you. You don't talk. But I can sit next to you. It's close. — Mote

<a id="mote-letter-6"></a>

### Mote's letter 6 · Year 12

> Wenna, Things I can see from up here: your crown, the striped lighthouse, the windmill, four isles, one tower window. Things I can't see: you, properly. You sleep a lot now. More than you used to. Are you tired? You can tell me. I'm very far away and I won't tell anyone. — Mote

<a id="mote-letter-7"></a>

### Mote's letter 7 · Year 25

> Wenna, Tonight I had enough light to reach the windmill's shadow on the sea before I had to go back up. Forty-one fireflies, three lighthouse sparks, one moon on a puddle. Not enough. Never enough. Funny thing: every time I gather a little, you flicker. I can see it from here. I don't know why you would. — Mote

<a id="mote-letter-8"></a>

### Mote's letter 8 · Year 40

> Wenna, A bottle came bobbing down the moonpath. It said "to whoever finds this", and I nearly opened it, but I don't think I'm a whoever. I think I'm a someone who's waiting. So I've put it in the garden by your silver self, safe. If it's meant for somebody, they'll come. — Mote

(This is bottle 11, Yuzu's, which Pip finds in the Mirror Garden: `moonmere:11`.)

<a id="mote-letter-9"></a>

### Mote's letter 9 · Year 58

> Wenna, I've made a hundred lamps now, out of scraps. One is a thimble. One is a snail shell. They're not very good. I keep most of them on my rock, and I've hung twelve on your silver self down here, so at least one of you is properly lit. I post my letters into them, so they'll have a light to be read by. I talk to her. She doesn't sneeze. She doesn't say much, either. — Mote

<a id="mote-letter-10"></a>

### Mote's letter 10 · Year 77

> Wenna, The tower window is still lit. One window, seventy-seven years. Whoever keeps it is as stubborn as me. I think it's the little one who hung her own lamp on the ladder. I'd never tell her I noticed. On cold nights I borrow one spark from it. Just one. She'd never miss it. — Mote

<a id="mote-letter-11"></a>

### Mote's letter 11 · Year 99

> Wenna, You're dimmer this year. I'm sure of it. I counted your lit leaves at midsummer: fewer than last year. The isle is using you up, the way a lamp uses up its oil, and you're too kind to say so. They'll never let you go. So next time you sneeze I'll answer properly, and I'll bring you home before you run out. — Mote

<a id="mote-letter-12"></a>

### Mote's letter 12 · Night 36,447

> Wenna, You sneezed early. Then a little boy in a green hood carried your seeds home, and you bloomed brighter than I have ever seen you. Lamps do that when the oil's nearly gone. I've watched a hundred of mine do it. I'm not waiting any more. Every isle has a beacon with your light in it. I'll borrow them, just for a while, like your catchers do, and build a ladder strong enough for both of us. I'll give it all back. — Mote, 36,447

(Written the night of the bloom. The count is nights since the Storm: a hundred years is about 36,525 nights, and the
sneeze came about eleven weeks early.)

---

<a id="dormy-stories"></a>

## Grandpa Dormy's night stories

Seven folk tales Grandpa Dormy tells in cottage 1 between 21:00 and 23:00 ([cast.md](./cast.md), Grandpa Dormy;
[side-content.md#ss-02](./side-content.md#ss-02) *The Long Nap*). They are the lore as the village remembers it:
mostly right, a little muddled, and each with one true clue the player can later check. He calls Pip "little one" and
yawns inside his sentences ("...hwaaah...", his reserved marker).

- **Which story.** On the first Talk of a night, Dormy tells the lowest-numbered untold story whose gate holds, all its
  lines in order (one dialogue box each; at most four in a row before a 0.6 s pause beat, per the scene rules), then
  sets `seen:dormy.<n>`. One new story per night (flag `dormyNight` = the day number it was told). With no new story
  available he retells the last one he told, opening "Did I tell you this one? I did? ...hwaaah... It's a good one."
- **Gates** (each opens only after the beat that makes it safe and meaningful; [systems.md#conditions](./systems.md#conditions)):

| # | Title | Gate | True clue | Muddle |
|---|---|---|---|---|
| 1 | How the Sea Caught a Star | `flag:lanternGot` | she fell because she leaned to listen to the sea | "about the size of a cheese" |
| 2 | The Moths Who Kept the Lights | `flag:ch8` | the first light came over the water in a clay pot (Lamp Log 4) | the saying was "something about gravy" |
| 3 | The Three Who Catch | `flag:lanternGot` | the old Catchers were a badger, a goat and a seal; the new ones are young (bottle 11) | a mushroom "catching stars" |
| 4 | The Stair That Went Up | `flag:ch8` | three stones held the stair up; put them back (Act III) | it went away "like a tired old dog" |
| 5 | The Little Light Who Counts | `flag:thiefSeen` | a single light on the sky isle counts the lamps (T4 plant) | he never reaches the end |
| 6 | The Night the Sea Rang | `flag:act2done` | the sea chapel's bell rang once and sank; a turtle guards it (the Sunken Bell) | "busy storm" |
| 7 | The Smallest Seed-Bearer | `flag:ch13` | the smallest seed-bearer wore a too-big hat and was frightened of crabs (T7 plant) | he dozes off before the name |

Dormy's family wrote bottle 6 (Tuppence, his ancestor). Once bottle 6 is found, his first Talk that night opens with
one line (`lore.dormy.tuppence`): "Tuppence! My great-great-great... hwaaah... a lot of greats. Well. That explains
why we all nap so well."

<a id="dormy-1"></a>

### Dormy 1: How the Sea Caught a Star

1. Sit, sit, little one. Mind the cat. There's no cat. Mind it anyway. Tonight: how the sea caught a star.
2. Long, long ago, before toast, the stars lived up top and the sea lived down below, and they didn't talk much. Different interests.
3. One little star wanted to hear what the sea sounded like. So she leaned. And she leaned. And... hwaaah... you know what happens when you lean. Right off.
4. And the sea, bless it, put out its hands, which are waves, and caught her, and pushed up a rock so she'd have somewhere to sit.
5. She was so glad not to be falling that she grew roots, to be sure of it, and grew and grew until she was our Tree. My gran said she landed about the size of a cheese.
6. That's why the Tree hums, you know. She's still listening to the sea. Or the sea's listening to her. One of those... hwaaah... off you go.

<a id="dormy-2"></a>

### Dormy 2: The Moths Who Kept the Lights

1. Folk think moths fly at lamps because they're silly. Not a bit of it, little one. They're keeping the lamps company. Lamps get lonely.
2. Long ago the moon moths came over the water with one little light in a clay pot, and they put a lamp on every isle so boats could find their way at night.
3. Lamplighters, they called themselves. Every lamp they ever lit came from that one in the pot. Hundreds and hundreds of years, and they never once let it go out.
4. My grandad sailed to their isle as a lad. Said the whole town stood on stilts, and every window looked at one tall tower. Like sunflowers. Lit ones.
5. They had a saying. Light's not for... no. Light's for... hwaaah... something about passing things on. Gravy, possibly.
6. Where did they all go? Somewhere with more lamps, I expect. Pass me my nightcap. I'm wearing it? So I am.

<a id="dormy-3"></a>

### Dormy 3: The Three Who Catch

1. Tonight's a proper one, little one. When the Tree sneezes, the seeds fly up, and something has to catch them, or the sky would keep them.
2. So there are three catchers, at three corners. In my gran's day it was a badger, a goat and a seal. Very old. Very serious. The goat ate Gran's hat.
3. Then the old ones retired, all at once, and three young ones took over. All bounce and no sense. One of them's a mushroom! A mushroom, catching stars.
4. The rule is: catch what flies, keep it one night, give it only to a kind hand. Simple. Even a mushroom can manage that... hwaaah... mostly.
5. Mind you, a hundred years is a long time between catches. You'd forget a rule. I forget where my slippers are, and I'm wearing them.

<a id="dormy-4"></a>

### Dormy 4: The Stair That Went Up

1. My gran saw this, so it's true. There used to be a stair from the tall stones in the east right up into the sky.
2. Not a stair on the ground. A floating one. Flights of steps hanging in the air like washing on a line, all the way up to that little isle you see on clear days.
3. The moths built it, to sing to the stars from closer up. Three big stones held it up, Gran said. Take one away and its steps float off, soft as dandelion fluff.
4. Then one stormy night the stair went away. All of it. Gran said it went gently, like a tired old dog lying down by the fire.
5. Nobody was hurt. Gran was very clear about that. She said it about six times. She was a careful sort of gran.
6. If you ever find those three stones, put them back, little one. Gran would like that... hwaaah... I'm awake. I'm awake.

<a id="dormy-5"></a>

### Dormy 5: The Little Light Who Counts

1. This one's a bit sad, little one, but it ends all right. I think. I've never got to the end. I always nod off.
2. Up on the little isle in the sky there lives a little light. Some nights you can see it. Just the one, moving about.
3. And it counts. Every night it counts the lamps on all the isles. One, two, three... all the way round the Wide Blue, and then it starts again.
4. My mother said it was waiting for somebody. She said if you wave at it, it counts you too.
5. And one night, so the story goes, it counted all the lamps, and there weren't enough, and so it... it... hwaaah...
6. ...Hm? Oh. Wave at it, that's the main thing. Night night, little one.

<a id="dormy-6"></a>

### Dormy 6: The Night the Sea Rang

1. When I was a wee thing, tucked up in bed, there was a storm so big the sea rang like a bell. I remember being cross I wasn't allowed to look.
2. Well. A bell did ring. The moths had a bell out in the shallows, in a little stone chapel, and that night it rang once, all on its own, and then never again.
3. My mother said the chapel's still out there under the water, and on very low tides the top of it pokes up like a thumb.
4. And there's a turtle out there who won't let anybody ring it. Won't even let you whistle near it. Can't blame her... hwaaah... some sounds you don't want twice.
5. Same storm took the stair away, you know. Busy storm. Storms usually are. Nobody hurt, mind. Not one.

<a id="dormy-7"></a>

### Dormy 7: The Smallest Seed-Bearer

1. Every hundred years the Tree sneezes and somebody carries her seeds home. Never a hero, little one. Never a grown-up. Always some little one who bothered.
2. The grown-ups always say "someone ought to go". And while they're saying it, off goes a child. Every time. You'd think they'd learn.
3. The smallest one ever was no bigger than a teapot, in a hat three sizes too big. I'd have seen him myself, but I was asleep. I'm usually asleep.
4. And he was frightened of crabs. Properly frightened. And he went to the crab corner anyway. That's brave, that is. Being frightened and going.
5. His name was... now, what was his name... it's on the tip of my... hwaaah...
6. ...Hm? You're still here. You know, you look a bit like a seed-bearer yourself, little one. Something about the hood.

---
<a id="memories"></a>

## Memories

Twelve memories Wenna tied in knots on the Taproot during the Ladder season, a hundred years ago. Touching a lit knot
(`[E] Touch · Memory`, [systems.md](./systems.md) portal `rootdeep:knot1..12`) carries Pip into **the Remembered
Isle** (realm `remembered`: home's geometry, sepia and gold, Lamplighter beacons lit on every landmark, scaffolds on the
Tree; dressing in [atlas-home.md](./atlas-home.md)) at that memory's place and hour. Pip walks through the past and comes
back knowing. He never changes it.

Every memory is **played, not only watched**: after its scene the Remembered Isle stays open to walk until Pip touches
the gold mote ([#memory-play](#memory-play)); each memory leaves three **echoes** to find and Look at
([#memory-echoes](#memory-echoes)); and each group of three has one **vignette**, a stretch Pip plays with his own feet
while the past plays at his pace ([#memory-vignettes](#memory-vignettes)). Pip still changes nothing: the lamps light,
the prints show and the lights move as he walks, but everything that happens is what happened.

<a id="memory-rules"></a>

### Rules for every memory

- **Groups and gates** (the knot opens when its count holds; [story.md#stone-beats](./story.md#stone-beats)):

  | Knots | Group | Opens | Knot glow | Music (box theme variant) |
  |---|---|---|---|---|
  | 1-3 | The sky answers | `flag:lumbraCalm` (in ch13, after Lumbra) | sky gold `#ffe9a8` | music box, slow, with a faint high choir hum |
  | 4-6 | The children | `stones>=1` | leaf `#8be07a` | music box, bright, with pizzicato |
  | 7-9 | Brother and sister | `stones>=2` (T5 at 9) | lilac `#c9b6ec` | music box, very slow, solo |
  | 10-12 | The Storm | `stones>=3` | sea `#7fd3d0` | music box under soft rain, then alone |

  Within a group the memories can be watched in any order; each stands alone. A closed knot is dark wood `#4a3a2a`
  with a faint pulse; an open, unwatched knot glows its group colour and thrums every 1.6 s (audible within 12 m,
  `sfx.knotThrum`); a watched knot glows steadily and smaller.
- **Entering.** Fade to warm white (0.6 s), a small card in the `memory` frame for 2 s ("Memory 4 · The Seed-Bearer"),
  fade in at the memory's spawn facing its stated direction. The memory's script starts on arrival (`start: 'auto'`,
  `when: ['calm']`).
- **Pip is not there.** Nobody looks at him, speaks to him or steps aside for him (NPC look-at is off in this realm).
  He casts no shadow here (player shadow off in `remembered`), which is how a player knows it is a memory. No enemies,
  no damage, no gems, no chests. Tools work (the Sunglass wakes the Remembered Isle's four Sleeping Acorns).
- **Look.** Every figure in a memory has `[E] Look · <label>` (the shipped verb), which shows one of its Look lines
  (in order, then the last one repeats) in the `memory` frame. Look lines are what the figure is saying to someone
  else at that moment, never to Pip.
- **Frame and labels.** Every line is shown in the `memory` frame (`#e9d8b0` / `#b8894a` / ink `#4a3a2a`). Labels:
  "Keeper Tallow", "Young Wick", "A Lamplighter", "A villager", "Young Pelagia", "Young Grumble", "Young Pinch",
  "Young Frostbun", "Mote", "Wenna", and **"A young turtle"** for young Shellby in every memory until `trueEnding`,
  then "Young Shellby" (journal replays included), as [cast.md#young-cast](./cast.md#young-cast) rules. No line in any
  memory says the name "Shellby"; the player recognises him by the too-big hat.
- **First person.** Every scene speaker either stands within 8 m of the scene's spot (the spawn, or **Scene at** where a
  vignette comes first), inside the default view cone, or the step
  before the line is a `shot` to them (`two` or `look`). Every event off camera has a sound: the sneeze
  (`sfx.sneezeBig`), a falling star (`sfx.starFall`, a descending glass chime), lamps lighting (`sfx.lampOn`, a soft
  tick per lamp, at most 8 per second), lamps going out (`sfx.lightOut`), stones loosening (`sfx.stoneHum`), the far
  bell (`sfx.seaBell`, one low note with a long tail).
- **Leaving.** After the memory's last scene (or, for memory 6, after its vignette), a gold mote rises at the scene's
  spot (for memories 3, 7 and 12, where the scene played, not the vignette start; for memory 6, at the finish ring by
  the lighthouse door) and stays: `[E] Touch · Memory` on it
  returns Pip to the Taproot. The pause menu also gains "Leave memory" in this realm. On return, Wenna's return line
  plays once (`rd.wenna.memNN`, `wenna` frame, voiced from the Taproot). The flag `mem:<n>` is set at the memory's first
  step ([story.md#flags](./story.md#flags): starting it is enough).
- **Revisiting.** Every memory can be replayed from its knot and from the journal's Lore tab, forever (tone rule 8).
  Replays set no flags.
- **Length.** Each memory's scene is at most 90 s unskipped, except memory 4, which is five chained scenes of at
  most 60 s each joined by fades. Skip works per scene (skip-safe as in [story.md#scene-format](./story.md#scene-format))
  and per vignette (skipping a vignette places Pip at its end and starts what follows it). The time a memory takes is
  mostly the player's own: the vignette, the free roam and the echoes ([#memory-hours](#memory-hours)).
- **Data.** `js/content/memories.js` holds, per memory: `{ id, knot, group, title, when, tod, spawn, face, cast[],
  dressing[], scenes[], echoes[], vignette? }` (`echoes` from S-190b, `vignette` from S-190c); scenes use the seven step
  kinds of [story.md#scene-format](./story.md#scene-format), plus two memory-only events the S-190 runner adds:
  `memory.place {at, face}` (move Pip during a fade) and `memory.lamps {set, from, to, on, rate}` (switch a run of
  instanced Ladder lamps). Coordinates below are home coordinates (x east, z south); "near (x, z)" means the nearest
  walkable point.
- **Ladder lamp sets** (decision 8's 212): set `stair` = the lamps on stair steps 1-66 (flights 1-3; S-188's `stair`
  set addresses the steps); set `landing` = 4 landing lamps (two on each of the first two landings); set `path` = 142
  lamps (S-190c) along the polyline P0 the needle's foot (97, −50) → P1 (77, −43) → P2 (60, −14) → P3 the Peaks bridge's
  east end (54.7, 2.2) → P4 its west end (36.9, 6.8) → P5 (16, 9) → P6 beside the pedestal (4, 9.5), evenly spaced by
  arc length (about 0.87 m), numbered from P0 (lamp 1) to P6 (lamp 142), each 1.2 m to the polyline's left (north or
  west) side and nudged to the nearest walkable cell within 3 m. Lamps 1-84 lie between the needle's foot and the
  bridge's east end. If a polyline point is not walkable on seed 7151, the step that builds the set moves it to the
  nearest walkable cell within 10 m and records the move here.
- **Cast models.** Young cast and the Lamplighters (`lamplighter_*`) per [cast.md#young-cast](./cast.md#young-cast)
  (young Shellby, young Pelagia, young Wick, the three young Catchers, Mote slightly brighter). Keeper Tallow and the
  villagers: [#memory-extras](#memory-extras). Wenna: the Great Tree face decals ([cast.md](./cast.md), Wenna),
  `awake` by default.

<a id="memory-play"></a>

### Playing a memory: free roam

- When the last scene ends (for memory 6, when its vignette ends), control returns and the **whole Remembered Isle is
  open to walk** in that memory's state (its time, weather, cast and dressing) until Pip touches the gold mote or picks
  "Leave memory". Scene figures stay where the scene left them and keep their Look lines; nothing new is said to Pip.
- The mote has a compass marker ("Back to the Taproot") and a soft pull sound within 20 m. The Remembered acorns
  (S-190b) can be woken in any memory.
- No enemies, no damage, no gems, no chests, no time limit; the memory's `tod` stays frozen.

<a id="memory-echoes"></a>

### Echoes

- Each memory places **three echoes**: memory figures elsewhere on the isle, each replaying one small moment of that
  night on a 4 s gesture loop (the rig's idle plus one pose, listed per memory). They appear when free roam starts.
- **Look rule** (the same as for scene figures): `[E] Look · <label>` shows the echo's one line in the `memory` frame.
  The line is said to someone else in that moment, never to Pip, never names "Shellby", ≤ 220 characters.
- **How they read:** the figure's own model in the memory grade with a gold rim (fresnel `#ffe9a8` at 0.5; opaque, so
  no transparency cost) and one shared gold sparkle sprite above it until it has been Looked at. Sound twin: a faint
  two-note chime (`sfx.echoChime`) every 3 s within 15 m.
- **Placement:** 25-160 m from the scene's spot, at least 20 m from each other and from the mote, on walkable ground
  (`near(x, z, 0, 4)`); never inside a scene figure's 8 m staging circle.
- **State:** Looking sets `seen:echo:mNN.k` (k = 1-3) in the generic flags map (save v7; no version bump). The journal's
  Lore → Memories row shows "Echoes k/3" beside the memory. Echoes are not completion items (they never gate
  anything); a memory replay shows all three again.
- **Budget:** echoes reuse the memory's rigs (young cast, Lamplighters, villagers); a memory's cast plus echoes stays
  ≤ 16 rigged figures and within the view budgets.

<a id="memory-vignettes"></a>

### Vignettes (one per group)

A vignette is a stretch of play inside a memory where **the past plays at Pip's pace**: lamps light ahead of him,
prints show in front of him, a light walks just ahead of him. It is playback that follows what happened; Pip never
makes anything happen that did not. No timer, no fail state, no damage; skippable; replays include it.

| Group | Memory | Vignette | When | Mode | From → to | About | Built in |
|---|---|---|---|---|---|---|---|
| 1 | 3 | **The Lamp Path** | before the scene | `lead` (a lamp run) | the Peaks bridge's east end → the needle's foot | 75 m, 3 min | S-190c |
| 2 | 6 | **The Tide Race** | after the scene | `course` (S-112's Dash rings, `timer: false`) | the sand line → the lighthouse door | 4 min | S-212e |
| 3 | 7 | **Down the Ladder** | before the scene | `lead` (a moving light) | the needle's foot → beside the pedestal | 125 m, 4 min | S-232b |
| 4 | 12 | **The Last Lamp** | before the scene | `carry` (a held glow) | the plaza → the lighthouse rocks | 110 m, 5 min | S-254d |

- **`lead` (lamps):** the next lamp in the run lights (`sfx.lampOn`) when Pip is within 9 m of the last lit one, so the
  light is always about three lamps ahead of him; if he walks off, the run waits.
- **`lead` (a light):** the light moves along its polyline at Pip's speed (capped at 5 m/s), keeping 4-10 m ahead of
  him; it stops and pulses when he is more than 14 m behind, and it never hurries if he gets ahead.
- **`course`:** S-112's ring-gate course with `timer: false`: no start countdown, no best time, no prize; rings light in
  order; passing one reveals the prints to the next.
- **`carry`:** Pip holds a glow in the viewmodel's left hand (third person: in both hands); while carrying he walks and
  runs but cannot dash, jump higher than a hop (0.3 m) or swing. `[E] Set down` (or entering water deeper than 0.5 m)
  leaves the glow floating where he stood until he picks it up again (`[E] Carry · <label>`); nothing is ever lost.
- **Overheard lines** (memory frame, labelled, positional sound from where the speaker is) fire once each at a marked
  point; like every memory line they are said to someone else.
- **Skip:** places Pip at the vignette's end; a following scene starts, or the mote rises. The test harness's
  `scene.skip` inside `remembered` finishes the whole memory (`G.debug.memory.skip()`, S-190c).

<a id="memory-hours"></a>

### What the memories add up to

Priced at 1.5 h ([story.md](./story.md) stone-beats row, CANON section 11). Model: twelve scenes with cards and return
lines about 28 min; four vignettes about 16 min; 36 echoes spread 25-160 m from each scene, walked to and read, about
40 min; free roam and the four Remembered acorns about 6 min. Total about 1.5 h (scenes alone were about 25 min).

<a id="memory-extras"></a>

### Figures who appear only in memories

| Figure | Model | Height | Palette | Look |
|---|---|---|---|---|
| **Keeper Tallow** | `moth` rig (cast.md rig families), as a `lamplighter_*` with extras | 1.0 m | wings dusk lilac `#b9a6d8` with cream eyespots `#f3e6c8`, the Lamplighters' navy coat `#2b2238` with brass buttons, a keeper's brass chain of office `#c9a24a`, lamp glow `#ffd27a` | Granny Wick's mother: a tall, tidy moth in the Lamplighters' long navy coat (spiral on the back), a brass chain of office and a long-handled lamp; antennae combed straight |
| **A Lamplighter** | `lamplighter_*` ([cast.md#young-cast](./cast.md#young-cast)) | 0.8-1.0 m | as cast.md | as cast.md; in memory 3 some carry lamp crates (`prop_remembered_kit` node `crate`) |
| **A villager** (4 variants) | shipped NPC rigs recoloured toward the memory grade (a frog, a duck, a hedgehog, a rabbit) | as their kind | the memory grade (`#e9d8b0` / `#b8894a` / `#6f5a44`) | ordinary islanders of a hundred years ago; never named |

Mote in memories is `npc_mote` slightly brighter (cast.md). If his cloak patches are a separate decal or node, hide
them in memories: the patches came later, in his hundred years of gathering. In memories 1-3 he is only a light on
`sky:skyIsle`.

<a id="mem-01"></a>

### Memory 1 · The Letter Goes Up

- **Knot** 1 · **When** night 0 of the Ladder season, 22:00 · **Spawn** near (92, −44), the Cairn's west slope,
  facing west toward the Great Tree · **Cast** Keeper Tallow (97, −46), young Wick beside her, five Lamplighters in a
  ring round the Cairn's foot, lamps raised · **Dressing** the whole Starstair floating over the needle (all three
  flights, `sky.flight {n: 3}` at memory start, no lamps on it yet), the Cairn crystal glowing, home's four old
  beacons lit.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Keeper Tallow | Lamps up, everyone. High as you can. She's going to sneeze any moment, and the sky should see it go. | the Lamplighters raise lamps; a soft hum |
| 2 | Young Wick | How do you know it's tonight? | |
| 3 | Keeper Tallow | Because she's been sniffling since teatime. Hush now. Watch the Tree. | `shot look at w:greatTree.crown` |
| - | - | - | `sfx.sneezeBig` from the west; three lights (green `#8be07a`, blue `#9fdcff`, pink `#ff9f8f`) streak up from the crown, arc high and fall north, east and south; three sparkles mark the catches (the Woods, the Peaks Summit, the Shores) |
| 4 | Keeper Tallow | There it goes. *Still here,* she says. Still here. | |
| 5 | A Lamplighter | Woods caught! Shore caught! ...Peaks? | `shot two at` the Summit (114, −19) |
| 6 | Young Frostbun | Caught it! It's cold. Brrr-rr. I'll warm it up. | a small white figure on the Summit holds up a blue light |
| 7 | Keeper Tallow | Three for three. Good catchers, the new ones. Now we wait for a kind hand. | the lamps lower |

- **Look:** A Lamplighter: "Mind the third stone. It wobbles." / A Lamplighter: "My arms are tired. Is it rude to hold
  a lamp with your feet?" / Young Wick: "One day I'll hold the big lamp." / Keeper Tallow: "Fourteen hundred years, and
  she's never once missed."
- **Return line (Wenna):** "Oh. I remember that night. I always sneeze better with an audience."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem01.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A villager | near (6, 16), the plaza edge, facing the Tree | holds a hanky up, ready | She's sniffling again. Hankies out, everyone. Last time she sneezed it blew my hat into the pond. |
  | 2 | A Lamplighter | near (45, 4.5), on the Peaks bridge | holds a lamp out toward the Cairn | Bridge lamp lit, Keeper! ...She can't hear me. She's on a mountain. I'll tell her in the morning. |
  | 3 | Young Grumble | near (−3.2, −110), at his arena's south edge | arms out, bouncing on his toes | Ready. Steady. ...Is it now? Is it now? It's not now. |

<a id="mem-02"></a>

### Memory 2 · Someone Answers

- **Knot** 2 · **When** night 0, 23:30 · **Spawn** near (95, −46), facing north-east · **Cast** as memory 1 · **Dressing**
  as memory 1; stars overhead.

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | a high faint chord; one star leaves its place in the north-east sky and falls slowly (5 s) in a gold streak onto Driftholm (`sky.streak {to: 'sky:skyIsle'}`, `sfx.starFall`); the sky isle glows softly |
| 1 | A Lamplighter | Keeper. Keeper! Something's falling. | |
| 2 | Keeper Tallow | ...It's landed on the step of sky. Oh, my stars. Someone answered. | `shot look at sky:skyIsle` |
| 3 | Young Wick | Nobody ever answers. You said. Hundreds and hundreds of years, and nobody. | |
| 4 | Keeper Tallow | I did say that. Fetch the long lamps, Wick. We're going up the stair in the morning. | |
| 5 | A Lamplighter | Is it coming down? | |
| 6 | Keeper Tallow | It can't. Not that far. Not on its own light. | |
| 7 | Wenna | ...Mote? | her voice faint, from far to the west; the Lamplighters all turn to look at the Tree |

- **Look:** A Lamplighter: "Do you think it's lonely up there?" / Young Wick: "I'm waving. Just in case."
- **Return line (Wenna):** "Oh, Pip. That was him. My little brother. He was always the first to try things."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem02.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A villager | near (−14.1, −11), cottage 1's door, in a nightcap | points north-east | Did you see that? A star went the wrong way. Up isn't the wrong way. Down is. It went down. |
  | 2 | Young Pinch | near (24, 136), the cove's north rocks, holding the pink light | looks up at the sky isle | Somethin's landed on the sky rock. Not my business. ...It's a bit my business. I'm curious. |
  | 3 | A Lamplighter | near (−104, −2), by the windmill, writing on a slate | writes, then looks up | Write it in the log: half past eleven, one star, landed. Spelling of "landed" optional. |

<a id="mem-03"></a>

### Memory 3 · The First Lamps

- **Knot** 3 · **When** day 1, 19:30 (dusk) · **Spawn** near (57.7, 1.5), 3 m east of the Peaks bridge's east end, facing
  east up the path (the vignette below) · **Scene at** near (97, −50), the foot of the needle, facing up the first
  flight · **Cast** Keeper Tallow at the needle's foot, young Wick, five Lamplighters carrying crates of lamps up the
  Peaks path and up the first flight · **Dressing** six lamp crates stacked by the needle; the first flight's lower
  steps get lamps one by one (`memory.lamps {set: 'stair', from: 1, to: 22, on: true, rate: 2}`).

<a id="vignette-lamp-path"></a>

**Vignette 1 · The Lamp Path** (group 1, before the scene; `lead`, a lamp run). The Lamplighters lit a guide line up
the mountain path at dusk to carry the crates by. `path` lamps 84 → 1 (the bridge's east end to the needle's foot)
start unlit; each lights when Pip is within 9 m of the last lit one, and "A Lamplighter" (a moth carrying a long hook)
flutters ahead to land beside each lamp as it lights (0.4 s hop). Three overheard lines, once each:

| At | Speaker (where) | Line |
|---|---|---|
| lamp 70 | A Lamplighter (ahead, on the path) | Mind the crates on the bend! Lamps first, then crates, then tea. |
| lamp 40 | A Lamplighter (behind, on the bridge) | Wait for me! I've got the long hooks! Nobody can hang anything without the long hooks! |
| lamp 10 | Young Wick (ahead, at the needle's foot) | They're coming! I can see the lamps coming up the hill! |

Ends when lamp 1 is lit and Pip is within 6 m of (97, −50): the scene starts. Skip: Pip placed at (97, −50) facing
45°, lamps 1-84 lit. About 75 m and 3 min.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Keeper Tallow | One lamp a step. Two on each landing. Then a line of them down the mountain and all the way to her. He walks on light, not stone. | |
| 2 | A Lamplighter | That's every lamp from Duskwick. The pine isle's coming tomorrow, and the farm isle after. | sets down a crate |
| 3 | Keeper Tallow | Then it's every lamp from everywhere. Hang them. | |
| 4 | Young Wick | Mine too? | holds up her small lamp |
| 5 | Keeper Tallow | Not yours, Wick. That's your naming lamp. You keep yours. | |
| 6 | Young Wick | ...Hm. | she looks up the stair (the origin of Granny Wick's "Hm. Hm.") |
| 7 | A Lamplighter | He's at the top! He's waving! He's very small! | `shot look at sky:skyIsle`: a tiny gold figure under Driftholm |

- **Look:** A Lamplighter: "Forty more crates on the jetty. Mind your wings." / A Lamplighter: "He told me his name.
  Mote. He said it twice, in case I forgot." / Young Wick: "Can I light it? Can I light the next one?"
- **Return line (Wenna):** "They gave him every lamp they had, and they never said a word about it. That's
  Lamplighters for you."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem03.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A Lamplighter | near (−20, 122), the landing beach, beside a stack of crates | counts crates, tapping each | Crate forty-one. Crate forty-two. Who packed this one? It's all wicks. Just wicks. |
  | 2 | Young Wick | near plaza stall 3, under its high lamp hook | stretches up on tiptoe, then hops | If I stand on the crate, and the crate stands on the other crate... Hm. |
  | 3 | A villager | near (15, 14), where Miso's shop will be, sitting on a step | eats from a bowl in the dark | The moths took every candle in the village. I'm not cross. I'm eating my supper in the dark, but I'm not cross. |

<a id="mem-04"></a>

### Memory 4 · The Seed-Bearer

- **Knot** 4 · **When** day 2, 09:00 · Five chained scenes joined by 0.6 s fades (`memory.place` moves Pip during each
  fade) · **Cast** young Shellby (too-big hat), two Lamplighters, two villagers, young Grumble, young Frostbun, young
  Pinch (no hat), Wenna.

**4a · The plaza.** Spawn near (0, 13), facing the pedestal. Lamplighters and villagers hurry across the plaza with lamp
crates.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | A Lamplighter | Two days, and nobody's gone for the seeds! Someone ought to go. | |
| 2 | A villager | Someone ought to. Absolutely. Someone. | |
| - | - | - | young Shellby walks past them toward the north path, stops, comes back for a lamp, sets off again |
| 3 | A young turtle | I'll go. I'm not busy. I'm never busy. I'm small. | |

**4b · Grumble Shroom's Hollow.** Pip placed near (−3, −104), facing the arena (−3.2, −114). Young Grumble (half size,
cheerful, no grumble yet) holds a green light.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 4 | Young Grumble | Ho! A kind hand? Let's see it, then! Ready? Steady? Bonk! | a tiny ring rolls out; young Shellby hops it, then stands and waits |
| 5 | Young Grumble | Ha! You waited! Nobody waits! Here. Tell her it was me who caught it. Me! | he sits down giggling and holds out the seed |

**4c · Frostbun's Summit.** Pip placed near (106, −19), facing the Summit (114, −19). Young Frostbun (rabbit-sized)
holds a blue light wrapped in a tiny knitted scarf.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 6 | Young Frostbun | Mine. ...You're very small. Are you cold? I'm cold. Brrr-rr. Here. Keep it warm. | he hands over the seed, scarf and all |

**4d · Captain Pinch's Cove.** Pip placed near (22, 132), facing the cove (26, 142). Young Shellby peeks round a rock,
shaking; young Pinch (smaller, no hat) holds a pink light.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 7 | A young turtle | You're... you're a crab. A big one. I'm frightened of crabs. | |
| 8 | Young Pinch | Aye, I get that a lot. Ye came anyway, though. That's a kind hand, that is. Here ye go, lad. | |
| 9 | A young turtle | ...You're friendlier than you look. | |
| 10 | Young Pinch | Aye. Don't tell anyone. I'm meant to be fearsome. I haven't even got a hat. | |

**4e · The pedestal.** Pip placed near (0, 12), facing the Tree. Young Shellby places three seeds (three soft *thunks*,
the shipped placing sound); Wenna's face `smile`; a few blossoms open (memory grade).

| # | Speaker | Line | Staging |
|---|---|---|---|
| 11 | Wenna | Thank you, little one. You came all the way round my isle with my light in your pockets. | |
| 12 | A young turtle | It was heavy. I should have brought a snack. | the hat slips over his eyes |

- **Look:** A Lamplighter (4a, 4e): "That's the smallest seed-bearer I've ever seen." / A villager (4a, 4e): "Has he got a
  hat on, or has the hat got him on?"
- **Return line (Wenna):** "He was so frightened of the crab corner. He went to it last. And he went."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem04.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A villager | near (0, −30), where the north path leaves the plaza | looks north, shading their eyes | A turtle went past with a lamp and a very determined face. I said good morning. He said "Busy." |
  | 2 | Young Grumble | near (−3.2, −110), at his arena | turns an empty paw over, pleased | I gave it to a kind hand! First try! ...Do I get a badge? Somebody should make badges. |
  | 3 | Young Frostbun | near (110, −21), below the Summit, sitting | knits with two twigs | Knitting a new scarf. The old one went on a journey. Brrr-rr. |

<a id="mem-05"></a>

### Memory 5 · Wick's Lamp

- **Knot** 5 · **When** night 6, 20:30 (dusk, the first night of the Ladder) · **Spawn** near (97, −50), the needle's
  foot, facing up the stair · **Cast** Keeper Tallow, young Wick, five Lamplighters · **Dressing** every step and
  landing hung with unlit lamps except one empty hook on the first landing; the path line of lamps runs down the
  mountain toward the village, unlit.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | A Lamplighter | That's all of them. Every crate, every isle. ...And there's still one empty hook on the first landing. | `shot look at` the first landing |
| 2 | Keeper Tallow | One hook. We'll have to leave it. He can hop one step. | |
| - | - | - | young Wick flutters up the first flight with her naming lamp and hangs it on the empty hook |
| 3 | Young Wick | There. Now it's every lamp. | |
| - | - | - | the Ladder lights from her lamp outward: up the three flights to Driftholm and down the mountain along the path toward the village (`memory.lamps` all sets, rate 8, `sfx.lampOn`) |
| 4 | Keeper Tallow | Wick. That was your naming lamp. | |
| 5 | Young Wick | It's for passing on. You said. Light's not for keeping. | |
| 6 | Keeper Tallow | ...I did say that, didn't I. Come down, love. Come down and watch it. | `shot wide`: the whole Ladder lit from the Cairn to the sky isle |

- **Look:** A Lamplighter: "Look at that. I'll bet they can see it from the farm isle." / Young Wick: "Hm. Hm."
- **Return line (Wenna):** "Oh, little Wick. She never told me that lamp was hers. She's still keeping a light for
  somebody, isn't she?"
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem05.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A villager | near (21.5, −4), cottage 4's step | beckons toward the door | Wake the little ones. No, all of them. They'll want to say they saw it. |
  | 2 | A Lamplighter | near (10, 110), at the lighthouse foot | looks up toward the Cairn, wings folded | From down here it looks like a necklace. A really long one. For a giant. A tidy giant. |
  | 3 | Young Pinch | near (24, 136), the cove's north rocks, in the paper hat | arms crossed, then uncrossed | Every lamp from every isle, and not one for my lighthouse. ...I'm not jealous. A bit. |

<a id="mem-06"></a>

### Memory 6 · Racing the Tide

- **Knot** 6 · **When** day 5, 16:00 · **Spawn** on the Sunny Shores beach, near the east foot of the islet-1 bridge,
  facing east along the waterline toward the lighthouse (8.5, 117) · **Cast** young Shellby (hat), young Pelagia in
  the shallows, young Pinch at the lighthouse door wearing a folded paper hat · **Dressing** late sun, gulls, a sand
  line drawn at the start.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Young Pelagia | Race you! Race you! Last one to the lighthouse is a barnacle! Go! | they race along the waterline: Pelagia in the shallows at 1.4 m/s, Shellby on the sand at 1.2 m/s; Pip can walk along with them |
| 2 | A young turtle | S-slowly does it! That's not fair! You've got flippers! I've got feet! Little ones! | the hat blows off; he runs back for it |
| 3 | Young Pinch | Pelagia wins! By a hat! ...Little 'un, ye've lost yer hat again. | at the lighthouse door |
| 4 | A young turtle | It's a big hat. It's for growing into. | |
| 5 | Young Pelagia | When I'm big, big, I'll ring the sea bell. Ting! Everyone will hear it, all the way round the Wide Blue. | |
| 6 | A young turtle | When I'm big, I'm going to be very wise. And have a beard. | |
| 7 | Young Pinch | And I'm going to have a proper hat. Not a paper one. A skipper's hat, with an anchor on it. | |
| 8 | A young turtle | Here. A ribbon for the winner. It was on my hat. The hat won't miss it. | he ties the pink ribbon `#e88a8a` round young Pelagia's flipper (the faded ribbon adult Pelagia still wears) |

<a id="vignette-tide-race"></a>

**Vignette 2 · The Tide Race** (group 2, after the scene; `course`). After line 8: a 0.6 s fade, `memory.place` back to
the spawn's sand line facing east, and a 2 s card in the `memory` frame: "Every afternoon that summer." Ten S-112 ring
gates (`timer: false`, no countdown, no best time, no prize) run along the waterline from the sand line to the
lighthouse door, evenly spaced, each at the nearest cell with `h` −0.4 to 0.2 within 6 m of its point, ≥ 4 m apart.
Young Pelagia is not shown: her **flipper prints** (`decal_prints_flipper`) appear in the shallows three at a time
between ring k and ring k + 1 when Pip passes ring k, so he always runs beside her track; a line of small round
**turtle prints** (`decal_prints_turtle`) runs on the sand beside it, and between rings 5 and 6 it turns back to a
hat-shaped scuff and comes on again. Three overheard lines, once each:

| At | Speaker (where) | Line |
|---|---|---|
| ring 3 | Young Pelagia (ahead, in the shallows) | Keep up, keep up! The tide's winning and it hasn't even got legs! |
| ring 6 | A young turtle (behind, on the sand) | I've stopped! I'm not stopping! I'm just... resting my hat! |
| ring 9 | Young Pinch (at the lighthouse door) | Nearly there! Mind the crab hole! ...That's my crab hole. Mind it anyway. |

Ring 10 is at the lighthouse door: a wave runs up and the prints fade over 2 s; nobody wins, nobody loses; the gold
mote rises there and free roam starts. Skip: Pip placed at the door, mote up. About 4 min.

- **Look:** Young Pelagia: "Ting." / Young Pinch: "I folded it from a moth's old chart. Don't tell the moths."
- **Return line (Wenna):** "Those two. Every afternoon that summer, racing the tide past my roots. She always won. He
  always lost the hat."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem06.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | Young Pelagia | near islet 1 (−40, 139), in the shallows on its south side | flips water at the gulls | Next year I'll race the gulls. Gulls cheat. They fly. |
  | 2 | A villager | near (−10, 125), on the beach under a parasol | sits back in a deckchair | Those two again. Every afternoon. I've started bringing a chair. |
  | 3 | A young turtle | near the village pond (−13, 21), on its north rim | turns the big hat round in his hands | The hat looks better without the ribbon. ...No it doesn't. Oh well. |

<a id="mem-07"></a>

### Memory 7 · He Comes Down

- **Knot** 7 · **When** night 6, 22:30 · **Spawn** near (95, −52), the needle's foot, facing up the stair (the vignette
  below) · **Scene at** near (4, 10), the plaza's south-east, facing east along the path to the Peaks bridge ·
  **Cast** Mote (memory variant), Wenna, Keeper Tallow, five Lamplighters and four villagers along the plaza edge ·
  **Dressing** the whole Ladder lit (stair, landings and the path line from the east into the plaza, ending beside the
  pedestal); every window dark but one.

<a id="vignette-down-the-ladder"></a>

**Vignette 3 · Down the Ladder** (group 3, before the scene; `lead`, a moving light). The whole Ladder is lit (sets
`stair`, `landing`, `path`). A 3 s `shot look` up the stair shows a small gold light (a 0.6 m glow sprite) at the top
of flight 3; it comes down the stair lamp by lamp (`stair` 66 → 1, then the landings; each lamp brightens to 1.4 as he
steps on it and settles back) in 10 s while Pip stands at the foot. Then control returns and the light walks the `path`
lamps 1 → 142 just ahead of Pip (4-10 m ahead, waiting when he is more than 14 m behind), down the mountain, over the
Peaks bridge and into the plaza. Three overheard lines, once each:

| At | Speaker (where) | Line |
|---|---|---|
| path lamp 20 | A Lamplighter (ahead, on the bridge) | He's coming! He's actually coming! Somebody tell the Keeper! ...Keeper, he's coming! |
| path lamp 84 | Mote (the light, to himself) | A hundred and fifty-four. A hundred and fifty-five. Don't look down. There isn't a down. |
| path lamp 120 | Keeper Tallow (at the plaza edge) | Lamps steady, everyone. Let him come. |

Ends when the light reaches lamp 142 with Pip within 10 m: the scene starts where he stands. Skip: Pip placed near
(4, 10) facing east, the light on lamp 142. About 125 m and 4 min.

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | (played as the vignette) the small gold light stops on the last lamp beside the pedestal and blooms into Mote (0.4 s); `shot two at npc:mote` |
| 1 | Mote | Two hundred and twelve lamps. I counted every one, all the way down. ...Wenna. It's me. | |
| 2 | Wenna | Oh. Little Mote. Look at you. You came all the way down. | face `smile` |
| 3 | Mote | You've got leaves. You've got a *face*. You've got... is that a frog in your roots? | |
| 4 | Wenna | Several. And ducks. They're very loud. I love them. | |
| 5 | Keeper Tallow | Come away, everyone. Leave them be. This isn't ours to hear. | the Lamplighters and villagers walk off the plaza |
| 6 | Mote | Fourteen letters I've watched you send. Fourteen. This time I came. Everybody misses you, Wenna. The singing's wrong without you. | |
| 7 | Wenna | I've heard it, Mote. Every time. I've heard you all. | |

- **Look:** Mote: "Don't look at my feet. I'm standing on a lamp. It's very undignified." / A Lamplighter (at the plaza
  edge, walking away slowly): "Not ours to hear. ...I'm not listening. I'm just walking very slowly."
- **Return line (Wenna):** "He came all the way down. Nobody had ever done that for me. Not in all the long time."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem07.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A Lamplighter | near (57, 2), the Peaks bridge's east end | inspects a lamp, taps it | Two hundred and twelve lamps. He stepped on every one. Not one cracked. Good lamps. |
  | 2 | A villager | near (−22.5, −4), cottage 5's window | peers out, then pulls the curtain | Is that a star in the plaza? Talking to the Tree? I'm going back to bed. I'm dreaming. |
  | 3 | Young Wick | near (96, −48), the needle's foot | looks up the stair | He walked down on my lamp. My lamp. Hm. Hm. |

<a id="mem-08"></a>

### Memory 8 · Come Home

- **Knot** 8 · **When** night 9 (the fourth night of talk), 22:00 · **Spawn** near (4, 12), facing the pedestal ·
  **Cast** Mote sitting on a lamp on the pedestal step, Wenna · **Dressing** as memory 7, plaza empty.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Mote | I've worked it out. A ladder of given light can lift a star. It could lift you. All of you, roots and all. | |
| 2 | Wenna | And the isle? | |
| 3 | Mote | ...It would manage. Isles do. It managed before you. | |
| 4 | Wenna | Before me it was a rock, Mote, with nothing on it but wind. | |
| 5 | Mote | Then it'll be a rock with nice memories. Come home. You're tired. I can see it. You've been holding this whole sea up for longer than anyone should. | |
| 6 | Wenna | Let me think. Give me a few nights. | face `tired` |
| 7 | Mote | I'll count them. | |

- **Look:** Mote: "Night four. Not that I'm counting."
- **Return line (Wenna):** "He wasn't wrong, you know. I was tired. I still am, a little. He was only wrong about what
  would help."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem08.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | Keeper Tallow | near (95, −47), the needle's foot, with a slate of sums | frowns at the slate, rubs a line out | Lift a whole tree. Roots and all. ...The sums say yes. I wish they didn't. |
  | 2 | A Lamplighter | near (−104, −2), by the windmill | yawns, lamp drooping | Fourth night of talking. Lamps need oil. The moon needs to set. I need a nap. |
  | 3 | A villager | near the village pond (−13, 21), feeding ducks | scatters crumbs | The Tree's been quiet all week. When she's quiet, I'm quiet. That's the rule. |

<a id="mem-09"></a>

### Memory 9 · Who Would They Wake Up Next To?

**Twist T5.** Opens with `stones>=2`; this is the scene the second stone's beat names
([story.md#stone-beats](./story.md#stone-beats)).

- **Knot** 9 · **When** night 12 (the seventh night of talk), 23:00 · **Spawn** near (4, 12), facing the pedestal ·
  **Cast** Mote, Wenna · **Dressing** as memory 8; a few cottage windows lit, the sleeping village; one duck asleep on
  the pedestal ring.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Mote | Seven nights. That's a few. ...Well? | |
| 2 | Wenna | I can't go, Mote. | |
| 3 | Mote | You *can*. The ladder will hold. The moths have done the sums. | |
| 4 | Wenna | I know it would hold. I mean I won't. | |
| 5 | Wenna | Every morning they wake up, and the first thing they see is me. The little ones climb my roots. The old ones nap in my shade. I can't go. Who would they wake up next to? | `shot look at w:greatTree.face` |
| 6 | Mote | Me. You'd wake up next to me. | |
| 7 | Wenna | I know, little star. I'm sorry. I chose this. I'd choose it again. | face `sad` |
| 8 | Mote | Then I'll come back tomorrow night and ask again. And the night after that. I can count higher than you can stay. | he steps onto the lamp line and walks east; his light climbs the Starstair to the sky isle |
| 9 | Wenna | ...Goodnight, Mote. | |

- **Look:** none (the plaza is empty but for the sleeping duck: `[E] Look · A duck`: "Zzz.").
- **Return line (Wenna), the myth complicated once:** "The old song says I put down roots so I wouldn't fall any
  further. That was true, once. I keep them now for a different reason. You're one of the reasons, Pip."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem09.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A villager | near (−15.9, 10), cottage 3's open window, asleep on the sill | snores, shifts | Zzz... morning, Tree... five more minutes... Zzz. |
  | 2 | Young Pinch | near (9, 115), the lighthouse door, a lamp in his claw | hangs the lamp on its hook | Lamp's lit. Somebody up there might want to see a light tonight. |
  | 3 | A Lamplighter | near (96, −48), the needle's foot | turns the bottom lamp down low, not out | He'll be back tomorrow night. He always is. I'll leave the bottom one on. |

<a id="mem-10"></a>

### Memory 10 · The Storm

- **Knot** 10 · **When** night 13, 23:30 · **Spawn** near (0, −8), under the Great Tree's north roots, facing east toward
  the Cairn · **Cast** Keeper Tallow, young Wick, three Lamplighters, young Shellby, two villagers, all sheltering
  under the roots · **Dressing** rain (particles), wind sway on every tree, a soft distant rumble (no flashes); only the
  Starstair's 66 lamps are lit (the eighth night); the path line is dark.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | A Lamplighter | That's the last of them on the stair. Sixty-six lamps. He said he'd come down at moonrise. | |
| 2 | Young Wick | Will they hold? In this wind? | |
| 3 | Keeper Tallow | They're Lamplighter lamps, love. They'll hold till they can't. | |
| - | - | - | the top lamps go out one by one in the wind (`memory.lamps {set: 'stair', from: 66, to: 1, on: false, rate: 3}`, `sfx.lightOut` each); on the sky isle a single small light stays lit; `shot look at sky:skyIsle` |
| 4 | A young turtle | They're going out. All of them. ...Is he all right? | |
| 5 | Keeper Tallow | Look. There. Up on his rock. He's safe, love. He's just... up there. | |
| 6 | Wenna | Stay under my roots, all of you. Close together. It's only wind. It's only wind. | the rain softens |

- **Look:** A Lamplighter: "My whiskers are soaked. Do moths have whiskers? Mine are soaked." / A young turtle: "I'm not
  scared. My shell's waterproof."
- **Return line (Wenna):** "I held them all under my roots that night and told them it was only wind. It was only
  wind. There was just a great deal of it."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem10.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A Lamplighter | near (10, 110), the lighthouse foot, shielding a lamp | cups both wings round the lamp | Hold, little lamp. Hold. ...Good. Good lamp. |
  | 2 | A villager | near (13.3, −13), cottage 2's doorway | pulls a shutter closed | Shutters shut, ducks inside, kettle on. That's all a storm gets from me. |
  | 3 | Young Frostbun | near (110, −21), below the Summit, in the wind | holds his ears down | The wind took my scarf. Then the wind took my other scarf. Brrr-rr. |

<a id="mem-11"></a>

### Memory 11 · Three Stones Fall

- **Knot** 11 · **When** night 13, 23:50 · **Spawn** near (10, 112), by the lighthouse door, facing north-east toward the
  Cairn · **Cast** young Pinch (paper hat) in the lighthouse doorway with a lamp, two Lamplighters, young Pelagia in the
  shallows in the lee of the lighthouse rocks · **Dressing** rain easing; the Starstair's flights faintly visible over
  the Cairn, dark.

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | the flights sway; `sfx.stoneHum`; three pale lights shake loose from the stair one after another and arc over the sea like slow shooting stars: one east-north-east, one south-south-west, one south; each drops past the horizon with a far, soft chime; the flights drift up and apart into the cloud and are gone |
| 1 | A Lamplighter | The keystones! The stair's coming loose! | |
| 2 | Young Pinch | There goes my hat. ...There go three somethings. Bigger than hats. | the paper hat blows away |
| 3 | A Lamplighter | It's all right. It's going up, not down. It's just... drifting away. Soft as fluff. | |
| - | - | - | far to the south, one bell note rings out over the water and stops (`sfx.seaBell`) |
| 4 | Young Pelagia | That's the sea bell. Who's ringing it? Nobody, nobody's out there. | |
| 5 | Young Pinch | Come in out of the wet, little 'un. Lamp's still lit in here. Lamp's always lit in here. | |

- **Look:** Young Pinch: "I'll get a proper hat. A proper one. With an anchor." / A Lamplighter: "Three stones, three
  ways. We'll never find them all."
- **Return line (Wenna):** "My roots felt each one land. One in the shallows. One in something hot. One under sand.
  I've been holding those three places ever since."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem11.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A Lamplighter | near (57, 2), the Peaks bridge's east end, with a chart | points out to sea three times | One went that way. And one that way. And one... that way. I'll draw it on the chart before I forget. |
  | 2 | Young Grumble | near (−3.2, −110), at his arena, peeking from behind a stump | hides, peeks, hides | Something big went over. Big and humming. I hid. Hiding is brave if you do it properly. |
  | 3 | A villager | near (3, 14), by the pedestal, barefoot | stands very still, toes in the grass | Her roots are humming. I can feel it in my feet. Feet don't lie. |

<a id="mem-12"></a>

### Memory 12 · To Whoever Finds This

The T7 hint. The memory never names the turtle; only the hand matches ([#rules](#rules), `hand_shellby`).

- **Knot** 12 · **When** night 14, 21:00, calm and clear · **Spawn** near (0, 13), the plaza's wake point, facing south
  (the vignette below) · **Scene at** near (6, 115), the lighthouse's sea-side rocks, facing the LOCKED bottle spot
  (7.2, 119.7) · **Cast** a young turtle (the young-Shellby model, label "A young
  turtle") sitting on a rock with a small lamp and a slate on his knees · **Dressing** stars; the sea glassy; on the sky
  isle a single tiny light.

<a id="vignette-last-lamp"></a>

**Vignette 4 · The Last Lamp** (group 4, before the scene; `carry`). Every Ladder lamp is dark; cottage windows are lit.
On the pedestal step sits a small lamp-glow (`#ffd27a`, 0.15 m, where the young turtle set his lamp down to tie his
hat): `[E] Carry · A lamp's glow`. Carried, it lights a 6 m circle, and in that circle Pip sees a line of small round
turtle prints (`decal_prints_turtle`, one pair every 1.5 m) going south: down the path, onto the Shores and along the
beach to the lighthouse rocks. Far out at sea the last of the Storm is going away: a cloud bank on the southern horizon
(bearings 150°-210°, 240-280 m out, drifting south 0.5 m/s) flickers pale `#cfd8ff`, one soft pulse every 3-6 s (memory
RNG), 0.4 s up and 0.8 s down, luminance change ≤ 0.12, never two pulses within 2 s; its sound twin is a far rumble
(`sfx.thunderFar`, −30 dB) 2 s after each pulse. Two overheard lines, once each:

| At | Speaker (where) | Line |
|---|---|---|
| leaving the plaza, near (0, 25) | A villager (from a lit window) | Is that the little one, out with his lamp at this hour? ...Leave him be. He's got somewhere to be. |
| the top of the beach, near (5, 95) | A Lamplighter (at the lighthouse door) | Storm's going out to sea. Good riddance. Take your wind with you. |

Ends when Pip, carrying the glow, is within 3 m of (6, 115): the glow floats from his hand into the young turtle's small
lamp as he fades in on his rock with the slate (1 s), and the scene starts. If Pip arrives without it, the rocks stay
empty and the compass points back to the glow. Skip: Pip placed at (6, 115) facing the bottle spot, the scene starts.
About 110 m and 5 min.

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | A young turtle | To whoever finds this... | `shot two` over his shoulder; then the `letter` frame shows bottle 12's text in `hand_shellby`, writing itself on word by word (40 characters a second) |
| 2 | A young turtle | Keep a hanky handy. ...That's good advice. That's very good advice. | |
| 3 | A young turtle | P.S. The crabs are friendlier than they look. | he lifts the pen to sign, and stops |
| 4 | A young turtle | Whoever finds it won't need my name. They'll need a hanky. | he rolls the letter into a bottle and corks it |
| - | - | - | he throws it with all his might: it plops into the rock pool a metre away. He fishes it out |
| 5 | A young turtle | ...Too small. Next time, maybe. | he tucks the bottle into the rocks at (7.2, 119.7) and pats it twice |
| 6 | A young turtle | Goodnight, Wenna's brother. Somebody will come. Somebody always does. | he looks up at the sky isle, then walks home up the beach with his lamp; the hat slips over his eyes once |

- **Look:** none.
- **Return line (Wenna):** "That bottle waited in those rocks for a hundred years. I felt it there, every tide.
  Waiting for somebody."
- **Echoes** (`echoes`, [#memory-echoes](#memory-echoes); text ids `rm.mem12.echo.<k>`):

  | k | Label | Where | Gesture | Line |
  |---|---|---|---|---|
  | 1 | A Lamplighter | near (57, 2), the Peaks bridge's east end, packing a crate | lifts a lamp, puts it back | We'll take the stair lamps down tomorrow. ...No. Leave the bottom one. Just in case. |
  | 2 | Keeper Tallow | near (95, −47), the needle's foot | sits on a crate, looking up | Night fourteen. No light coming down. ...Sit with me a while, Wick. We'll watch anyway. |
  | 3 | Young Pelagia | near islet 1 (−40, 139), in the shallows | floats on her back, looking at the sky isle | When I'm big, big, I'll ring the sea bell for him. Ting. So he knows we're still down here. |
- After this memory Shellby is quieter ([story.md](./story.md), S-260). Nobody comments on the handwriting; the player
  may compare it in the Lore tab, where bottle 12, memory 12's letter and the Nook card share `hand_shellby`.

---
<a id="lore-assets"></a>

## Lore assets

Only the things this file owns. The bottle model (`kit_bottle`), the Lamp Log niche (`kit_log_niche`), the spiral decal
(`kit_spiral`), the Taproot itself, Moonmere's moon-lanterns and the journal's paper and icon atlases are owned by
[art-audio.md](./art-audio.md), [atlas-isles.md](./atlas-isles.md) and [atlas-far.md](./atlas-far.md). Every image
prompt below is the art-audio preamble ([art-audio.md#preamble](./art-audio.md#preamble)) + the kind suffix
([art-audio.md#kinds](./art-audio.md#kinds)) + the subject given here. Every generated image is original and never
imitates another game's art. Briefs use the template in [art-audio.md#brief-template](./art-audio.md#brief-template).

| Key | What | Section · realm | Size shipped | Built in | Fallback |
|---|---|---|---|---|---|
| `moonmere_paper` | Mote's letter paper | `ui` · `moonmere` | 768 × 1024 webp, opaque, ≈ 120 KB | S-219 | flat `#e6e3f4` with a 2 px `#c9c3e6` border |
| `ui_myth_strip` (optional) | the myth's four panels | `ui` · core | 2048 × 512 webp, ≈ 110 KB | S-075, only if the core budget check passes | the parchment page with a canvas spiral |
| `ui_sprout_sign` | Pip's drawn signature | `ui` · `night` | 128² webp, alpha | S-290 | the glyph ✿ in `#5f8f2f` |
| `prop_moonmere_letter` | Mote's letter: a folded paper boat inside a moon-lantern | `models` slot · `moonmere` | code-built | S-219 | itself (code-built) |
| `prop_rootdeep_knot` | a memory knot on the Taproot | `models` slot · `rootdeep` | code-built | S-190 | itself |
| `prop_remembered_ladder_lamp` | a Ladder lamp (instanced) | `models` slot · `remembered` | code-built | S-190 | itself |
| `prop_remembered_kit` | memory hand props: lamp crate, slate, paper hat | `models` slot · `remembered` | code-built | S-190 | itself |
| `icon_hanky` (cell in `icons_items`) | Shellby's hanky item icon | `ui` atlas · core | 128² cell | S-289 | canvas: cream square, gold spiral corner |
| `fx_echo_sparkle` | the gold sparkle over an un-Looked echo (one shared sprite) | `fx` · `remembered` | 128² webp, alpha, 4-frame strip, ≈ 12 KB | S-190b | canvas: a 4-point star `#ffe9a8` with a soft radial glow |
| `decal_prints_turtle` | small round turtle prints (a pair per cell) and one hat-scuff cell | `decals` · `remembered` | 512 × 256 webp, alpha, 2 cells, ≈ 30 KB | S-212e | canvas: two `#6f5a44` ovals at 0.35 alpha; the scuff a soft arc |
| `decal_prints_flipper` | young Pelagia's flipper prints in wet sand | `decals` · `remembered` | 256² webp, alpha, ≈ 18 KB | S-212e | canvas: a `#6f5a44` teardrop fan at 0.35 alpha |
| `fx_mote_light` | Mote's light walking down the Ladder in vignette 3 | `fx` · `remembered` | 256² webp, alpha, ≈ 14 KB | S-232b | canvas: radial gradient `#fff1c4` → `#ffd27a` → transparent, 2 px white core |
| `fx_lamp_glow` | the carried lamp-glow of vignette 4 | `fx` · `remembered` | 128² webp, alpha, ≈ 8 KB | S-254d | canvas: radial gradient `#fff1c4` → `#ffd27a` → transparent |
| `sky_storm_bank` | the far storm going away in vignette 4 | `sky` · `remembered` | 1024 × 256 webp, alpha, x-seamless, ≈ 60 KB | S-254d | canvas band: gradient `#565d7a` → transparent with three soft lumps |

<a id="asset-moonmere-paper"></a>

### `moonmere_paper` (Mote's letter paper)

- **Kind:** `tile`-like single sheet (use the `card` suffix but ask for the sheet to fill the frame edge to edge).
- **Subject prompt:** "A single sheet of soft handmade paper pressed from cloud fibres, pale lilac-silver, faintly
  luminous, with a few tiny pressed star-flower petals caught in it near the edges and soft deckled edges, filling the
  whole frame, lit evenly from the front, no writing. Palette: #e6e3f4 #c9c3e6 #f6f3d8 #8fa8ff."
- **Process:** crop to 3:4, resize 768 × 1024, webp q80 (`tools/export_sprites.py --no-trim`).
- **Use:** background of the `letter` frame when the text is a Mote letter; ink `#3b4f9a`.

<a id="asset-myth-strip"></a>

### `ui_myth_strip` (optional)

- **Subject prompt (kind `loading`, but 4:1):** "A wide storybook frieze in four equal panels separated by thin painted
  vine borders, read left to right: (1) a row of small round-faced singing stars over a dark blue sea, the littlest
  pale-gold star leaning out to listen; (2) the little star falling in a soft spiral trail while the sea lifts a wave
  shaped like two cupped hands; (3) a young sapling on a small rock in turquoise water, a soft gold spiral on its trunk,
  roots spreading down into the sea; (4) a great friendly tree on a green isle with three small lights, a green leaf
  star, a pale blue snowflake star and a pink shell star, rising from its crown toward faint stars. Palette: #141a3a
  #ffe9a8 #7fd3d0 #8be07a #9fdcff #ff9f8f."
- **Generate** 2048 × 512 (or 1792 × 1024 and crop), webp q78. **Gate:** ship only if the core precache check (S-029)
  stays under budget with it; otherwise leave the key out (the fallback is the design, not a placeholder).

<a id="asset-sprout-sign"></a>

### `ui_sprout_sign`

- **Subject prompt (kind `icon`):** "A child's quick ink doodle of a tiny two-leaf sprout growing from a little curl,
  drawn in leaf-green ink with a slightly wobbly line. Palette: #5f8f2f #7aa63a."
- **Process:** key white to alpha, trim, export 128² webp.

<a id="brief-moonmere-letter"></a>

### ART BRIEF: Mote's letter (`prop_moonmere_letter`)

- **What and where:** one of Mote's twelve unsent letters, folded into a paper boat and posted inside a moon-lantern
  in Moonmere's Mirror Garden, revealed on the lantern's base plate when it opens; built in S-219.
- **Silhouette:** from 3 m (it is only seen inside an open lantern), a small pale paper boat glowing faintly; a hull
  wedge with a triangle sail.
- **Size:** 0.18 × 0.14 × 0.08 m (length × height × width); manifest `height: 0.14`.
- **Palette:** paper `#e6e3f4`, paper fold shadow `#c9c3e6`, a single ink stroke on the sail `#3b4f9a`.
- **Materials:** toon base; the paper emissive `#f6f3d8` at 0.25 (unread) and 0.08 (read); no transparency.
- **Poly budget:** 96 tris (two folded hull planes and a triangular sail, double-sided).
- **Pose / animation:** rests on the lantern's base plate; the engine bobs it 5 mm at 0.5 Hz while unread.
- **Named nodes:** none (single mesh).
- **Code fallback:** `js/props.js:moteLetter()` (2 folded planes + 1 triangle, 96 tris).
- **Image prompt:** preamble + `sheet` suffix + "a small folded paper boat made from pale lilac paper with one blue ink
  word-stroke on its sail, faintly glowing, shown from front, three-quarter, side and above. Palette: #e6e3f4 #c9c3e6
  #3b4f9a #f6f3d8."
- **3D prompt:** "A stylised low-poly paper boat folded from pale lilac paper (#e6e3f4) with a single blue ink stroke
  (#3b4f9a) on its triangular sail, soft rounded toy-like forms, hand-painted paper texture. Original design. Single
  mesh, game-ready, under 120 triangles, feet at the origin, facing forward, no base plate, no text."
- **Acceptance:** drops in through `prop_moonmere_letter` at `height` 0.14; `tools/normalize_glb.mjs` passes; side-by-side
  screenshot in the PR.

<a id="brief-knot"></a>

### ART BRIEF: Memory knot (`prop_rootdeep_knot`)

- **What and where:** one of the twelve memory knots on the Taproot in the Rootdeep, sitting in the sockets atlas-far
  places (S-176); lit and made touchable in S-190.
- **Silhouette:** from 20 m, a glowing knot of root, like a loop of rope tied once round the trunk; a torus knot
  flattened against the bark.
- **Size:** 1.2 × 1.2 × 0.5 m; manifest `height: 1.2`.
- **Palette:** root wood `#8a5a3c`, wood shadow `#4a3a2a`, glow by group: `#ffe9a8` (1-3), `#8be07a` (4-6), `#c9b6ec`
  (7-9), `#7fd3d0` (10-12).
- **Materials:** toon base wood; an inner emissive core (a thinner torus knot inside, emissive group colour at 0.0
  closed, 1.2 open-unwatched with a 1.6 s pulse 0.8-1.4, 0.7 watched). One additive glow sprite (reuse the shared glow
  card) scaled 2.0 m when open.
- **Poly budget:** 900 tris (outer knot 640, core 260); 12 instances = 10.8 k tris, 2 draw calls (instanced).
- **Pose / animation:** static; the engine pulses the core's emissive and scales the glow sprite.
- **Named nodes:** `knot`, `core`.
- **Code fallback:** `js/props.js:memoryKnot()` (`TorusKnotGeometry(0.42, 0.11, 64, 8, 2, 3)` squashed to 0.5 depth +
  a thinner inner copy).
- **Image prompt:** preamble + `sheet` suffix + "a single knot tied in a living tree root, the root wood warm brown,
  softly glowing from inside with pale gold light, shown front, three-quarter, side and back, as if tied round a great
  trunk. Palette: #8a5a3c #4a3a2a #ffe9a8."
- **3D prompt:** "A stylised low-poly knot of living tree root (#8a5a3c), one loose overhand loop flattened against a
  trunk, glowing softly from inside (#ffe9a8), hand-painted bark texture, soft rounded forms. Original design. Single
  mesh, game-ready, under 900 triangles, feet at the origin, facing forward, no base plate, no text."
- **Acceptance:** drops in through `prop_rootdeep_knot` at `height` 1.2; the Taproot view stays within budget;
  side-by-side screenshot in the PR.

<a id="brief-ladder-lamp"></a>

### ART BRIEF: Ladder lamp (`prop_remembered_ladder_lamp`)

- **What and where:** the Lamplighters' lamp hung on every step of the Starstair and along the path in the memories
  (up to 212 instances); built in S-190.
- **Silhouette:** from 20 m, a small round glass lantern hanging from a bent brass hook; a sphere under a hook.
- **Size:** 0.5 × 0.22 × 0.22 m (hook post 0.5 m, glass globe 0.18 m across); manifest `height: 0.5`.
- **Palette:** brass `#c9a24a`, dark brass `#6e5530`, glass unlit `#6b6478`, glass lit `#ffd27a`, core `#fff1c4`.
- **Materials:** toon brass; the globe emissive `#ffd27a` at 1.0 lit, 0.0 unlit (one instance attribute, so one draw
  call for all lamps); a shared additive glow sprite instance per lit lamp (second draw call).
- **Poly budget:** 110 tris (globe 64, cap 16, hook 30); 212 instances ≈ 23 k tris, 2 draw calls.
- **Pose / animation:** static; the engine sways it ±4° in memory 10's wind and toggles `lit`.
- **Named nodes:** none (single mesh; the globe is a vertex-colour region the shader lights).
- **Code fallback:** `js/props.js:ladderLamp()` (sphere + cone cap + tube hook, 110 tris).
- **Image prompt:** preamble + `sheet` suffix + "a small round glass lantern with a brass cap hanging from a bent brass
  hook on a short post, glowing warm gold, shown front, three-quarter, side and back. Palette: #c9a24a #6e5530 #ffd27a
  #fff1c4."
- **3D prompt:** "A stylised low-poly small round glass lantern (#ffd27a glow) with a little brass cap (#c9a24a),
  hanging from a bent brass hook on a short post, soft toy-like proportions, hand-painted texture. Original design.
  Single mesh, game-ready, under 120 triangles, feet at the origin, facing forward, no base plate, no text."
- **Acceptance:** drops in through the key at `height` 0.5; memory 5's wide shot (all 212 lit) stays ≤ 200 main-pass
  draw calls and ≤ 1.3 M tris.

<a id="brief-memory-kit"></a>

### ART BRIEF: Memory hand props (`prop_remembered_kit`)

- **What and where:** three small props for the memories, one GLB with three named nodes; built in S-190.
- **Silhouette:** a wooden lamp crate with six globes peeking out (memory 3); a lap slate with a sheet of paper
  (memory 12); a folded paper skipper's hat (memory 6, young Pinch).
- **Size:** crate 0.5 × 0.6 × 0.4 m; slate 0.3 × 0.02 × 0.22 m; hat 0.3 × 0.14 × 0.2 m; manifest `height: 0.5`.
- **Palette:** plank `#9b7b56`, rope `#c9b48a`, globes `#ffd27a`, slate `#4a4a52`, paper `#f3e7c9`, hat paper `#e9d8b0`
  with faint chart lines `#b8894a`.
- **Materials:** toon; crate globes emissive `#ffd27a` 0.4.
- **Poly budget:** 600 tris total (crate 320, slate 40, hat 240).
- **Pose / animation:** static; the hat is parented to young Pinch's head and blown away in memory 11 (engine tween).
- **Named nodes:** `crate`, `slate`, `hat`.
- **Code fallback:** `js/props.js:memoryKit(part)` (boxes, spheres and a folded-plane hat).
- **Image prompt:** preamble + `sheet` suffix + "three small props on one row: a wooden crate of six round glass
  lanterns padded with rope, a little lap slate with a sheet of paper on it, and a folded paper skipper's hat made from
  an old sea chart. Palette: #9b7b56 #c9b48a #ffd27a #4a4a52 #f3e7c9."
- **3D prompt:** "Three stylised low-poly props as separate named parts: a wooden crate (#9b7b56) holding six glowing
  round lanterns (#ffd27a), a small lap slate (#4a4a52) with paper (#f3e7c9), and a folded paper skipper's hat made of
  old chart paper (#e9d8b0), soft rounded toy-like forms, hand-painted texture. Original design. Single mesh, game-ready,
  under 600 triangles, feet at the origin, facing forward, no base plate, no text."
- **Acceptance:** drops in through the key; parts found by node name; side-by-side screenshot in the PR.

<a id="asset-hanky-icon"></a>

### `icon_hanky` (Shellby's hanky)

- **Subject prompt (kind `icon`):** "A small folded cream cotton handkerchief with a green leaf hem and a gold spiral
  embroidered in one corner. Palette: #fff8e6 #7aa63a #f2c94c."
- **Item text** (owned here because it is a lore object; the item entry is [systems.md](./systems.md)): name
  "Shellby's hanky"; description "Cream cotton, a leaf hem, a gold spiral in the corner. Older than it looks. Keep it
  handy."

---

<a id="names"></a>

## Names introduced in this file

Add each to [charter.md](./charter.md)'s glossary in the PR that first ships it (charter "Adding a name"). All are
original to this project.

| Name | Kind | First shipped by | Defined at |
|---|---|---|---|
| Oona | bottle 1 writer, moon moth | S-086 (Duskwick finds) | [#bottle-1](#bottle-1) |
| Millet | bottle 2 writer, field mouse | S-144 | [#bottle-2](#bottle-2) |
| Fen | bottle 3 writer, otter | S-123 | [#bottle-3](#bottle-3) |
| Loam | bottle 4 writer, mole | S-205 | [#bottle-4](#bottle-4) |
| Conker | bottle 5 writer, squirrel | S-101 | [#bottle-5](#bottle-5) |
| Tuppence | bottle 6 writer, dormouse | S-249 | [#bottle-6](#bottle-6) |
| Sandy Pelliwick | bottle 7 writer, pelican | S-205 | [#bottle-7](#bottle-7) |
| Quill Thimble | bottle 8 writer, hedgehog | S-205 | [#bottle-8](#bottle-8) |
| Mallow Thistledown | bottle 9 writer, bunny | S-228 | [#bottle-9](#bottle-9) |
| Croakley | bottle 10 writer, frog | S-205 | [#bottle-10](#bottle-10) |
| Yuzu | bottle 11 writer, cat | S-218 | [#bottle-11](#bottle-11) |
| Keeper Taper, Keeper Sconce, Keeper Glim, Keeper Chandry, Keeper Lanthorn, Keeper Snuffwell | head Lamplighters who signed Lamp Logs | S-091 (Taper), then with their logs | [#lamplighters](#lamplighters), [#log-table](#log-table) |
| Keeper Tallow | Granny Wick's mother, keeper a hundred years ago | S-190 (memory 1) or the step that ships log 29 | [#memory-extras](#memory-extras) |
| the Lamplighters' Book | the logbook the Lamp Logs come from | S-091 | [#lamplighters](#lamplighters) |
| naming lamp | a Lamplighter child's one lamp | S-091 (log 4) | [#lamplighters](#lamplighters) |
| the Slow Ring | the current round the Wide Blue | S-205 (log 23) | [#wide-blue](#wide-blue) |
| the step of sky | the Lamplighters' name for Driftholm | S-091 (log 27 text; any earlier bottle 7) | [#lantern-sky](#lantern-sky) |

---

<a id="decisions"></a>

## Decisions made here

CANON leaves these open; this file decides them. Each can be overridden by the owner; the file that changes one updates
this list.

1. **Dates.** Wenna fell about 4,000 years ago (texts say "thousands"); islanders came ~2,000; the Lamplighters
   ~1,600; the first Starseed and the Firstlight ~1,500; the first sneeze, the Catchers' Rule and the first Catchers
   ~1,400; the Starstair ~1,350; the Academy and the sea chapel ~1,300; the first bottle 1,200 years ago.
2. **The first Starseed.** Wenna had one seed before the Lamplighters came. After the stars sang back on the Cairn she
   grew three, and sneezed them a hundred years later for the first time. Fourteen sneezes before this one.
3. **The wind** on Starseed Isle blows from the west: it is why the Catchers stand north, east and south, why the
   Meadow has no Catcher, and why Wenna's blossom fluff (Digby's "For Spring" seeds) drifts west.
4. **The Spiral's origin:** the shape her fall left on her brow; the Lamplighters copied it. **Every Lamplighter bench
   faces Starseed Isle's bearing** (an atlas rule to apply to `kit_bench` rotation).
5. **The Catchers' history:** previous Catchers were an unnamed badger, snow goat and grey seal; the present three were
   chosen 200 years ago and made their **first catch 100 years ago** (young Shellby was their first kind hand); this
   game's catch is their second. "Keep it one night" is a minimum.
6. **The Starkin light rule:** a Starkin's light spreads into everything near the ground, so it dims and grows heavy;
   a ladder of light feeds a Starkin step by step.
7. **Given light in three kinds:** lamp-to-lamp (free), a ladder of given light (each lamp spent in one night, harms
   nobody), taken light (leaves the source dark).
8. **The Ladder's numbers:** 212 lamps a night (66 stair steps + 4 landing lamps + 142 path lamps), seven nights, then
   66 more on the eighth = 1,550 lamps, every lamp the Lamplighters owned.
9. **The Ladder season, day by day:** sneeze and answer night 0; lamps carried nights 1-5; seeds home day 2; Ladder lit
   night 6; seven nights of talk (6-12); the choice night 12; the Storm night 13; the bottle night 14. Memory numbers
   follow the CANON groups, so memory 6 (day 5) comes before memory 5 (night 6) in time.
10. **Mote's position in the Ladder season:** he met the Lamplighters on Driftholm on day 1; he climbed back up after
    night 12 meaning to ask again; the Storm came on night 13 before he could.
11. **Naming lamps**; young Wick hung hers on the last empty hook and it lit the first night's Ladder. Her saying
    "Light's not for keeping. It's for passing on." comes from her mother, Keeper Tallow (a new lore-only character).
12. **The Lamplighters' Book:** Tallow and Wick unbound it after the Storm and sent each page to the place it describes;
    Lamp Logs are numbered by subject, not date; seven keeper names (Taper, Sconce, Glim, Chandry, Lanthorn,
    Snuffwell, Tallow) plus Wick.
13. **Lamp Log placement:** the land and region of all 30 ([#log-table](#log-table)); Duskwick's five = logs 1 and 2
    given by Granny Wick + three placed niches (so the Duskwick finds post-pass places **three**); logs 29-30 sit in
    twin niches in the Academy bell tower's open porch, outside the dungeon.
14. **The Bottle Chain's writers**, species, homes, lands, hands and today's families ([#bottle-table](#bottle-table)).
    Each letter names the place side-content's ss-34 delivers it to. Bottle 11 is in Moonmere because Mote found it
    and kept it unopened.
15. **Bottle 12 is the only unsigned letter**, which is why its writer is a mystery; young Shellby was too small to throw
    it into the Slow Ring and hid it in the lighthouse rocks.
16. **The chain's running jokes:** "bring a hanky" starts with Loam (bottle 4) and becomes Shellby's "Keep a hanky
    handy"; snacks (bottle 2, memory 4); the frog's failed victory croak (bottle 10, Ribbit's ancestor).
17. **The Slow Ring**, the current that circles the Wide Blue every few years, carries the bottles; the custom is to
    throw from the home lighthouse rocks; the Last Big Storm broke it for a season and scattered the bottles.
18. **Moonmere's mechanism:** reflected light weighs nothing, so a Starkin can walk down a moonpath into the reflection
    without dimming; Mote found it in year 7; living things need the *Calling* tune to hold the moonpath.
19. **Mote's letters:** dates (Night 1, Night 40, Night 365, Years 3, 7, 12, 25, 40, 58, 77, 99, Night 36,447), one
    folded into each moon-lantern (n ↔ n, as ss-47 runs it), read flags `moteLetter:<n>`; the sneeze on the night before day one came about
    eleven weeks early.
20. **T6's mechanism:** light leans toward its kin; Mote's gathered store drew Wenna's light toward it like a plant to a
    window, and over a century the lean became a pull. Mote also borrowed one spark at a time from Wick's window.
21. **The Firstlight was banked**, not lit, for a century; Mote took Duskwick's beacon (the window) on the bloom night
    but could not find the banked Firstlight; Pip's kindling woke it.
22. **The Stair Stones** are pale, egg-shaped and pumpkin-sized, and hum low; when knocked loose, the flights "drifted up
    and apart into the cloud" (nothing crashed). The Storm rang the sea chapel's bell once as the chapel sank.
23. **Memory knots:** Wenna "put them down" to sleep; group colours; the thrum; return lines; Pip casts no shadow and
    is unseen in memories; `[E] Look` lines; two memory-only runner events (`memory.place`, `memory.lamps`); memory 4
    is five chained scenes; no memory line says "Shellby" (label "A young turtle" until `trueEnding`, as cast.md
    rules); young Shellby tied young Pelagia's pink ribbon in memory 6. Memories are played, not only watched: free
    roam until the gold mote, three echoes each (36 in all, `seen:echo:mNN.k`), and one vignette per group (The Lamp
    Path, The Tide Race, Down the Ladder, The Last Lamp), all playback at Pip's pace that changes nothing.
24. **Figures only in memories:** Keeper Tallow (a lore-only Lamplighter) and four villager variants as recolours
    ([#memory-extras](#memory-extras)); Mote's patches are hidden in memories where they are separable.
25. **Dormy:** story gates and the one-new-story-a-night rule; he was a small child on the night of the Storm; bottle 6
    (Tuppence) is his family's.
26. **Hands** are CSS styles over system fonts (no font files); `hand_shellby` is used on exactly three texts, including
    a **new readable card in Pip's Nook** ([#nook-card](#nook-card); atlas-home places it).
27. **The thirteenth letter's look:** no name, a drawn sprout, `hand_pip`, a green bottle with hood-green yarn; listed
    in the Lore tab as bottle 13 after `trueEnding`. Its phrases stay in story.md.
28. **Text ids and limits:** `lore.*`, `rm.mem*`, `rd.wenna.mem*`; lore text in `js/text/en/lore.js` (core, lazy);
    bodies ≤ 450 (bottles), ≤ 560 (logs), ≤ 640 (Mote's letters); spoken lines ≤ 220.
29. **The spoiler ladder** (classes A-D) as the placement check for every lore text.
30. **Ages and storms:** Shellby was about ten in the Ladder season, Wick twelve; Pip's age is never stated, and the
    storm he was found in is neither the Storm nor the Last Big Storm.
31. **The isles' origin:** each isle rose where one of Wenna's longest roots surfaced (Kettle Isle on a root that met the
    warm deep; Saltglass on a root under a dried lagoon); the Glassway is clear because roots glow under its sand.
32. **Sneezes come on the hundredth midsummer**, give or take a few weeks; the Hundred-Year Night is the night a whole
    people gives light at once.
33. **New flags** for [systems.md](./systems.md)'s dictionary: `moteLetter:<n>` (read), `dormyNight` (day number of the
    last new story), and `seen:dormy.<n>`. No save version bump.
