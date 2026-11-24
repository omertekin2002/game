# Side stories and activities

Part of the game bible for Starseed Isle, "The Hundred-Year Letter". This file owns the 53 side stories
(`ss-01` to `ss-53`), the 12 activities (`act-*`), Pip's Nook furnishings and gifts, the 16 plushies and Ribbit's
Village Works projects. It follows CANON §10 (the canon copy S-001 lands under `docs/roadmap/`). Main-story beats, flags and scenes live in [story.md](./story.md); characters' looks and models in
[cast.md](./cast.md); lore texts in [lore.md](./lore.md); places and post-passes in [atlas-home.md](./atlas-home.md),
[atlas-isles.md](./atlas-isles.md) and [atlas-far.md](./atlas-far.md); bosses in [creatures.md](./creatures.md);
dungeons in [dungeons.md](./dungeons.md); conditions, items, the quest engine and the economy ledger in
[systems.md](./systems.md); style, prompt preamble and asset pipeline in [art-audio.md](./art-audio.md).

Order of authority: `CANON-NOW` LOCKED items > `CANON.md` > this bible > `INDEX.md` > an issue.

---

<a id="rules"></a>
## 1. Rules every side story and activity obeys

1. **One owner.** Every side story and activity has exactly one owner, a named character who gives it, tracks it
   in their lines, and pays it. The owner is who the journal names.
2. **No fail state.** Nothing can be failed, lost or missed. A dropped item returns to where it came from; a missed
   timing tries again at once; a race lost is offered again by the same character with a new line.
3. **A mark in the world.** Every completed side story changes something the player can see or hear, at the place
   where it was earned, **within 10 s** of the last step (pacing rule 4). Marks never revert.
4. **Never gates the main story.** No side story, activity or collectible is a condition of any main beat or of the
   main ending. Chapter 22 asks only for thresholds of bottles and acorns ([story.md#ch22](./story.md#ch22)).
5. **Grows as lands ship.** A step that names a land that is not built yet stays hidden in the journal ("Somewhere
   past the fog...") and is skipped by `objective()`; it appears the day its land ships. A story whose remaining steps
   all wait on unbuilt lands shows "To be continued ✿" instead of a step.
6. **Night content returns every night.** Every `tod:night` step can be done on any night. Day length is 480 s; night
   is 21:00-05:00 game time. From the Starsong (S-208) a bench turns day to night.
7. **Tone.** [charter.md#tone](./charter.md#tone): towns never spawn enemies; children are never in peril (a "lost"
   kit is always somewhere safe and knows it); nobody is hurt, hungry or ill; humour in every story. Lines are
   ≤ 220 characters; `~` only in Miso's speech; `!!` only in Kinako's; Pip never speaks (he nods, waves, holds things
   out). `{tokens}` for controls.
8. **Replays.** Every scene a side story plays is replayable from its journal entry (`Replay ✿`), per tone rule 8.
9. **Rewards.** Gems paid by side stories sum to **1,855** (CANON §10.4); activity tiers sum to **1,000**; the six
   activity heart petals are part of the 24 (CANON §10.3). The tables in §7 are what `tests/economy.test.js` sums.
10. **First person first.** The player usually sees nothing of Pip, so every story gives its cue by **sound and a
    thing in the world** (a giggle, a chime, a glow, a held item in the view-model), never by Pip's body. Held items
    use the view-model slot that the Lantern uses ([systems.md#items-tools](./systems.md#items-tools)).

<a id="data-shape"></a>
## 2. How a side story is built (data shape)

Every side story is one entry in `js/content/quests/<realm>.js` read by `js/quests.js` (ENGINE F15). Lines live in
`js/text/en/side-<realm>.js` by id; dialogue entries in `js/content/dialogue/<realm>.js` (F13). Example, the first
two steps of `ss-07`:

```js
{ id: 'ss-07', realm: 'home', kind: 'side', owner: 'puddle', title: 'side.ss07.title',
  unlock: ['flag:lanternGot'],
  steps: [
    { id: 'peek',  text: 'side.ss07.s1', done: 'flag:ss07.peeked', on: 'TALK_END' },
    { id: 'light', text: 'side.ss07.s2', done: 'count:ss07.lamps>=4', on: 'PUZZLE' },
  ],
  reward: ['gems:+30', 'set:ss07.done'], mark: 'ss07.mark', minutes: 20 }
```

- **Quest id** = the side story id (`ss-07`); flags it sets are `ss07.<name>` (no hyphen, short ids, CANON save-size
  rule). The completion flag is always `ss<NN>.done`; the world mark reads it.
- **Counts** (`count:ss07.lamps>=4`) are numeric flags (`S.flags` allows finite numbers).
- **Steps** advance on the named event (`TALK_END`, `ITEM_GET`, `KILL`, `CHEST_OPEN`, `REALM`, `PUZZLE`,
  `BOSS_DEFEATED`) when `done` holds; several may be "any order" (a step with `parallel: true` lists sub-goals).
- **Text keys**: `side.ssNN.title`, `side.ssNN.sK` (journal step K), `side.ssNN.open` and `side.ssNN.done` (journal
  summaries), `side.ssNN.<speaker>.<n>` (lines). Every line written below is the exact text for its key.
- **Journal voice.** The journal is Hoot's *Field Notes*, so summaries are in Hoot's voice: confident, kind and
  often wrong. Step texts are plain imperative lines (they are what the objective line shows).

<a id="conditions"></a>
## 3. Conditions used in this file

The condition grammar and the flag dictionary are [systems.md#conditions](./systems.md#conditions). This file uses
these names; if systems.md spells one differently, systems.md wins and the meaning column is what is meant.

| Condition | Meaning | Set by |
|---|---|---|
| `bloom` | the Act I bloom has played (save field `ending`, LOCKED) | I.5 |
| `flag:wennaAwake` | I.6 played; Nell is home | I.6 |
| `flag:lanternGot` | chapter 7 done: the Lantern, the jetty, cottage doors open once residents are met | ch7 |
| `flag:ch8` | Duskwick's chapter done, Kinako's bazaar has docked once | ch8 |
| `flag:beacon.<isle>` | that isle's beacon kindled (`pinewhistle`, `archwater`, `threemills`) | ch9-11 |
| `flag:moteNamed` | II.M | 2nd beacon |
| `flag:act2done` | the Tower, end of Act II | ch12 |
| `flag:ch13`, `flag:ch14` | Rootdeep done; Glassway open | ch13, ch14 |
| `flag:stone.<id>` | that Stair Stone set (`bell`, `kettle`, `academy`) | ch15-17 |
| `flag:act3done` | the Spiral Stair, end of Act III | ch18 |
| `flag:mainEnding` | the Second Sneeze; main ending card shown | ch21 |
| `flag:ch22` | the Hundred-Year Night played | ch22 |
| `ability:<id>` | a tool owned: `lantern`, `glide`, `tidebell`, `hook`, `sunglass`, `mitts`, `starsong`, `sling`, `gloves`, `cloudstep` | tool steps |
| `boss:<id>` | that boss calmed (the existing `bosses` map); ids are creatures.md's boss def ids: `rollo`, `mossmantle`, `gloop`, `honksworth`, `wickwork`, `lumbra`, `pelagia`, `fumarole`, `scarabelle`, `flurry`, `snore` | boss defs |
| `met:<npc>` | the player has talked to that NPC once (`seen:` flag of their first entry) | dialogue |
| `realm:<id>.visited` | Pip has stood in that realm | realms |
| `tod:night`, `tod:21-23` | time-of-day window (game hours) | clock |
| `secret:<id>` | a keepsake found (existing `secrets` map, e.g. `secret:pouch`) | keepsakes |

---

<a id="index"></a>
## 4. Side story index

| Id | Title | Owner | Land | Unlock (short) | Gems | Min | Build step |
|---|---|---|---|---|---|---|---|
| [ss-01](#ss-01) | For Spring | Digby | home | `secret:pouch` + `bloom` | 35 | 25 | S-114, S-193 |
| [ss-02](#ss-02) | The Long Nap | Grandpa Dormy | home | `flag:lanternGot` | 35 | 25 | S-115 |
| [ss-03](#ss-03) | Nothing Is Refundable | Miso | home, Duskwick, Kettle | `flag:ch8` | 40 | 25 | S-134, S-241 |
| [ss-04](#ss-04) | The Mayor Goes to Sea | Mayor Ribbit | home → Threemills | `flag:beacon.threemills` | 35 | 25 | S-155 |
| [ss-05](#ss-05) | A Bun for Every Isle | Hazel Thimble | every land | `flag:lanternGot` | 60 | 35 | S-135 (grows) |
| [ss-06](#ss-06) | The Duck Regatta | the Quackenbushes | home | `bloom` | 25 | 15 | S-136 |
| [ss-07](#ss-07) | Puddle's Grotto | Puddle | home | `flag:lanternGot` | 30 | 20 | S-077 |
| [ss-08](#ss-08) | Little Thistledown | Primrose Thistledown | home → Duskwick | `flag:ch8` | 30 | 20 | S-156 |
| [ss-09](#ss-09) | Old Friends | Elder Shellby | home → Glassway | `boss:pelagia` | 40 | 25 | S-217 |
| [ss-10](#ss-10) | The Parcel With No Name | Postmistress Pell | many | `flag:moteNamed` + `realm:kettle.visited` | 20 | 35 | S-240 |
| [ss-11](#ss-11) | Grumble's Nephews | Grumble Shroom | home (Undercap) | `flag:ch13` + `ability:mitts` | 40 | 20 | S-195 |
| [ss-12](#ss-12) | Frostbun's Great-Aunt | Frostbun | home (Snowglobe) | `ability:sling` | 40 | 15 | S-239b |
| [ss-13](#ss-13) | Shellby's Slow Walk | Elder Shellby | home + 5 isles | `flag:act2done` | 35 | 30 | S-172 |
| [ss-14](#ss-14) | The Fourth Bough | Wenna | home | `flag:act2done` | 40 | 20 | S-171, S-291 |
| [ss-15](#ss-15) | Moth to a Flame | Flick | Duskwick | `flag:act2done` | 35 | 20 | S-167 |
| [ss-16](#ss-16) | Granny Wick's Library | Granny Wick | Duskwick | `flag:act2done` | 45 | 15 | S-167 |
| [ss-17](#ss-17) | The Clockwork Apprentice | Flick | Duskwick, Threemills | `boss:wickwork` | 35 | 20 | S-168a |
| [ss-18](#ss-18) | Kinako's Limited Edition | Kinako | 8 lands | `flag:act2done` | 40 | 25 | S-168b (grows) |
| [ss-19](#ss-19) | The Acorn Hoard | Elder Nutmeg | Pinewhistle | `realm:pinewhistle.visited` | 35 | 20 | S-110 |
| [ss-20](#ss-20) | Peer Review | Professor Hoot | Pinewhistle | `flag:beacon.pinewhistle` | 30 | 20 | S-110 |
| [ss-21](#ss-21) | Lost in the Mist | Elder Nutmeg | Pinewhistle | `met:nutmeg` | 30 | 15 | S-111 |
| [ss-22](#ss-22) | The Sawmill Song | Foreman Knock | Pinewhistle | `flag:beacon.pinewhistle` | 35 | 20 | S-111 |
| [ss-23](#ss-23) | Clover's Map | Clover | home → Archwater | `realm:archwater.visited` | 35 | 20 | S-131 |
| [ss-24](#ss-24) | The Raft Choir | Skipper Rafferty | Archwater | `flag:beacon.archwater` | 35 | 20 | S-131 |
| [ss-25](#ss-25) | Eight Socks | Old Gloop | Archwater → home | `boss:gloop` | 30 | 15 | S-132 |
| [ss-26](#ss-26) | The Moon Pool | Nana Kelp | Archwater | `ability:tidebell` | 35 | 20 | S-132 |
| [ss-27](#ss-27) | Your Honkship | Lady Honksworth | Threemills | `boss:honksworth` | 35 | 20 | S-152 |
| [ss-28](#ss-28) | Scarecrow Hats | Pa Haybury | Threemills | `realm:threemills.visited` | 30 | 20 | S-152 |
| [ss-29](#ss-29) | The Scarecrow Who Wanted Crows | Pennywhistle | Threemills | `met:pennywhistle` + `met:rook` | 30 | 15 | S-153a |
| [ss-30](#ss-30) | Pie Rations | Ma Haybury | Threemills | `flag:beacon.threemills` | 30 | 15 | S-153b |
| [ss-31](#ss-31) | Burrowbottom Lamplight | Gran Burrows | Rootdeep | `flag:ch13` | 35 | 20 | S-192 |
| [ss-32](#ss-32) | Lumbra's Itch | Lumbra the Long | Rootdeep | `boss:lumbra` | 35 | 15 | S-192 |
| [ss-33](#ss-33) | Gran's Pouch | Gran Burrows | Rootdeep | `quest:ss-01>=3` + `flag:ch13` | 30 | 15 | S-193 |
| [ss-34](#ss-34) | Return to Sender | Postmistress Pell | many | `flag:ch14` | 55 | 25 | S-215 |
| [ss-35](#ss-35) | The Collector | Mr Whelk | Glassway, home | `flag:ch14` | 35 | 20 | S-215 |
| [ss-36](#ss-36) | The Merry Mabel | Captain Pinch | home → Glassway | `flag:ch14` + `ability:hook` | 40 | 15 | S-216 |
| [ss-37](#ss-37) | The Whale Who Rolls Over | the Snoozing Whale | Glassway | `ability:tidebell` + `flag:ch14` | 35 | 20 | S-216 |
| [ss-38](#ss-38) | Starsteel | Master Scoria | Kettle Isle | `flag:stone.kettle` | 0 + sword | 20 | S-233 |
| [ss-39](#ss-39) | Pitch Wants a Star | Pitch | Kettle Isle | `realm:kettle.visited` | 40 | 15 | S-236a |
| [ss-40](#ss-40) | Soakley's Baths | Soakley | Kettle Isle | `ability:sling` | 35 | 20 | S-236b |
| [ss-41](#ss-41) | Miso's Supplier | Miso | home → Kettle Isle | `realm:kettle.visited` + `quest:ss-03>=3` | 30 | 15 | S-237 |
| [ss-42](#ss-42) | Sable's Dig | Sable | Saltglass | `realm:saltglass.visited` + `ability:mitts` | 35 | 20 | S-258 |
| [ss-43](#ss-43) | Roll Call | Tutor Scarabelle | Saltglass | `flag:stone.academy` | 35 | 20 | S-258 |
| [ss-44](#ss-44) | The Exam Retake | Tutor Scarabelle | Saltglass | `flag:stone.academy` | 35 | 15 | S-259 |
| [ss-45](#ss-45) | Mote's Tally | (Mote, absent) | Driftholm | `realm:driftholm.visited` | 30 | 15 | S-267 |
| [ss-46](#ss-46) | Nimble Herding | Old Puffwick | Driftholm | `ability:cloudstep` | 35 | 20 | S-267 |
| [ss-47](#ss-47) | Letters Never Sent | (Mote, absent) | Moonmere | `flag:stone:bell` | 30 | 20 | S-219 |
| [ss-48](#ss-48) | The Little Star | the Twinklings | Starmeadow → home | `flag:mainEnding` | 35 | 20 | S-291 |
| [ss-49](#ss-49) | Rook's Races | Rook | 5 isles | `realm:pinewhistle.visited` | 40 | 35 | S-113, S-133, S-154, S-234, S-255 |
| [ss-50](#ss-50) | The Three Corners Jamboree | the Catchers | Duskwick (o4) | `flag:mainEnding` | 40 | 15 | S-299 |
| [ss-51](#ss-51) | Dream a Little | Grandpa Dormy | home + dreams | `flag:mainEnding` | 40 | 15 | S-295 |
| [ss-52](#ss-52) | Hoot's Last Paper | Professor Hoot | Hoot's Margins | `flag:mainEnding` | 40 | 20 | S-301b |
| [ss-53](#ss-53) | The Planting | Wenna | home | `flag:mainEnding` | 40 | 10 | S-291 |
| | **Total** | | | | **1,855** | **1,060** | |

The minutes are a careful player's time for the story's own steps, not counting the dungeons or bosses it wraps
(those are in CANON §11's dungeon and main buckets): **1,060 min ≈ 17.7 h** against CANON's 17.5 h (within ±5 %).

---

## 5. The side stories

Each entry: owner, land, build step, unlock, reward, time; the premise; the steps (step id, objective text, what
completes it); the key lines (exact text, keyed `side.ssNN.<speaker>.<n>`); the world mark; the journal summaries
(open / done); and any assets, which are briefed in [§11](#briefs). Character models and portraits are
[cast.md](./cast.md)'s; this file only names who speaks.

<a id="side-home"></a>
### Home (Starseed Isle): ss-01 to ss-14

<a id="ss-01"></a>
#### ss-01 For Spring

**Owner** [Digby](./cast.md#digby) · **Land** home, Bloom Meadow · **Build** S-114 (steps 1-3), S-193 (steps 4-5) ·
**Unlock** `secret:pouch` and `bloom` · **Reward** 15 gems at step 3, 20 gems at step 5 · **Time** 25 min

The "For Spring" pouch (LOCKED keepsake) was Digby's. He plants bits of the Tree by touch so there will be a spring he
can smell from his door. Ribbit's "No guardian there, just flowers and secrets" stays true: the secret is Digby.

1. `ask` · "Ask Digby about the 'For Spring' pouch" · talk to Digby while `secret:pouch` is set.
2. `trail` · "Follow the golden sprouts across the Meadow (n/6)" · `[E] Look · A golden sprout` at each of 6 sprouts
   (post-pass `placeSproutTrail`, [§12](#passes-needed)); each glows brighter once looked at. The sixth stands at the
   bare patch beside the Meadow pond at (−94.1, −29.2).
3. `plant` · "Plant the last seed with Digby at the bare patch" · Digby walks there (he is waiting at the patch when
   Pip arrives; no escort). `[E] Place · Golden seed`. A seventh sprout pops up in a puff of gold petals. Part 1 ends:
   the journal shows "To be continued ✿" until [ss-33](#ss-33) is done.
4. `pouch` · "Bring Gran's new pouch to Digby" · after `ss33.done`; talk to Digby with the key item `pouch_spring2`.
5. `grove` · "Plant the grove with Digby" · `[E] Place · Golden seed` at 7 soft-earth rings around the bare patch
   (any order). As the seventh goes in, 7 saplings grow over 6 s into the **Golden Grove**.

Key lines:
- `digby.1` "Ah. You found the pouch. ...Yes. That's mine. Don't tell Ribbit, he'll want to cut a ribbon."
- `digby.2` "I plant by touch. The gold ones smell like her blossoms. I'd like a spring I can smell from my own door."
- `digby.3` "Follow the little gold ones. I can't see them, but I know where I put them. Mostly."
- `digby.4` (step 3) "There. Seven. Seven's a good number for a garden. Gran always said so. ...Gran says a lot of things."
- `digby.5` (step 4) "That's Gran's stitching. 'For Spring (and Summer).' She thinks of everything. Even summer."
- `digby.6` (done) "Can you smell that, Pip? That's spring. Right on time. ...Don't tell me what it looks like. I want to guess."
- `ribbit.1` (after done) "A grove! In my Meadow! And nobody asked for a permit. Croak. ...I suppose I shall allow it."

World mark: part 1, the six sprouts glow gold at dusk for good. Part 2, the **Golden Grove**: 7 saplings, 2.4-3.2 m,
gold-blossomed, dropping gold petals; a little wooden sign "For Spring. — D." Digby stands in the grove from 06:00 to
09:00 every morning.

Journal: open "Somebody has been planting bits of the Great Tree in the Meadow. My theory: a very small, very tidy
bear. I shall investigate." / done "It was Digby! I was nearly right. He is small and tidy. The grove smells
remarkable."

<a id="ss-02"></a>
#### ss-02 The Long Nap

**Owner** [Grandpa Dormy](./cast.md#grandpa-dormy) · **Land** home, cottage 1 (door at (−14.1, −12.3)) · **Build**
S-115 · **Unlock** `flag:lanternGot` · **Reward** 35 gems · **Time** 25 min

The snoring cottage. Dormy is awake only from 21:00 to 23:00 and tells one story a night (the seven texts are
[lore.md#dormy-stories](./lore.md#dormy-stories)). He has wanted, for ninety years, to stay up late enough to see a
little light he once saw wandering on the sky isle.

1. `knock` · "Knock on the snoring cottage at night (21:00-23:00)" · `[E] Knock · Cottage` in the window; the door
   opens. Outside the window the existing LOCKED door line plays.
2. `stories` · "Hear three of Grandpa Dormy's stories (n/3)" · one per night; `[E] Talk · Grandpa Dormy` plays the
   next story. Stories 4-7 stay available after the quest (a "Stories heard n/7" line in the journal; Lore tab).
3. `wake` · "Find three things to keep Dormy awake (n/3)" · parallel, any order:
   - **Moth-bean tea** from Granny Wick (Duskwick; she makes it for night lamp-watches);
   - a **nod-whistle** from the Acornet kits (Pinewhistle; a toy whistle that toots when its wearer nods);
   - a **crunchy apple** from Orchard Rows (Threemills; `[E] Pick up · Crunchy apple` under the tallest tree).
4. `watch` · "Sit up with Dormy past midnight" · after `flag:moteNamed`, between 21:00 and 23:00: `[E] Sit · Porch
   bench`. A 20 s scene: the clock skips to 00:30, the nod-whistle toots twice, Dormy points; a single moving light
   crosses the sky isle (the II.M light).

Key lines:
- `dormy.1` "Eh? Oh! A visitor. Sit, sit. I'm awake. I'm very awake. ...What time is it? Never mind. Story?"
- `dormy.2` "Every night I mean to stay up till midnight. Every night the fire says 'nap'. The fire is very persuasive."
- `dormy.3` (asks) "Tea that keeps a moth up, a whistle that tells on a nodding head, and something too crunchy to sleep through. That should do it."
- `dormy.4` (scene) "There. That little light, wandering about up there. I saw it the night of the big storm, when I was a lad. Nobody believed me."
- `dormy.5` (scene) "Somebody's been up there a long time, I think. Counting, by the look of it. ...Goodnight, Pip. Thank you for staying up with an old mouse."

World mark: a knitted blanket on Dormy's porch bench; his window stays lit until midnight every night; he gives Pip a
"stayed up past midnight" wave when they pass at night.

Journal: open "Grandpa Dormy has not seen midnight in ninety years. I have not seen it either. It is overrated." /
done "Dormy saw his light again. He says it was counting. Lights cannot count. I am checking."

<a id="ss-03"></a>
#### ss-03 Nothing Is Refundable

**Owner** [Miso](./cast.md#miso) (with [Kinako](./cast.md#kinako) and [Granny Mochi](./cast.md#granny-mochi)) ·
**Land** home (cottage 4 at (21.5, −5.4)), Duskwick (the bazaar) · **Build** S-134 (steps 1-3), S-241 (steps 4-5)
· **Unlock** `flag:ch8` and `met:kinako` · **Reward** 15 gems at step 3, 25 gems at step 5 · **Time** 25 min

Miso and her twin Kinako have sulked for twenty years. As kittens they painted one shop sign together, "MISO &
KINAKO"; on opening day Kinako sailed off to see the isles and Miso opened alone. She sawed the sign in half.

1. `box` · "Take Kinako's 'defective' sword back to Miso" · Kinako hands over a long box (key item `kinako_box`).
2. `refused` · "Miso won't take it. Ask Granny Mochi" · Miso refuses; `[E] Knock · Cottage` at cottage 4, then talk.
3. `letter` · "Carry Granny Mochi's letter to Kinako" · key item `mochi_letter`; Kinako reads it. Part 1 ends.
4. `halves` · "Bring Kinako's half of the sign to Miso" · after `ss41.done` ([ss-41](#ss-41)); key item
   `sign_kinako` ("& KINAKO"). Miso fetches her half ("MISO &") from under the counter.
5. `sign` · "Watch the twins hang the sign" · 15 s scene at Miso's Shop at the next dusk; Granny Mochi watches from
   a stool.

Key lines:
- `kinako.1` "Return this to my sister!! It's DEFECTIVE!! Not nearly shiny enough!! ...Don't tell her I said 'sister'."
- `miso.1` "Mrrow~ Nothing is refundable. Especially not to him~ He can keep his box."
- `mochi.1` "Twenty years over one opening day. Cats. ...I've raised a lot of cats, Pip, and every one of them sulks."
- `mochi.2` "Take him this. Don't read it. ...You can read it a little."
- `kinako.2` (letter) "...She kept the sign? The one we painted? ...She KEPT it?!"
- `miso.2` (halves) "He kept his half too? ...Silly cat~ Silly, silly cat."
- `miso.3` (scene) "Fine~ He can have half the sign. The smaller half~"
- `kinako.3` (scene) "It's the SAME size!! It's ALWAYS been the same size!!"
- `mochi.3` (scene) "There. Now I can nap."

World mark: the joined board "MISO & KINAKO" hangs under the LOCKED "Miso's Shop" sign (the shop's name is
unchanged); from then on Kinako's Floating Bazaar docks at Nell's Jetty from 18:00 to 21:00 every evening.

Journal: open "Two cats, one sulk, twenty years. The literature on cat sulks is vast and unread." / done "The twins
share a sign. Granny Mochi napped immediately. Case closed, and also the shop, at six."

<a id="ss-04"></a>
#### ss-04 The Mayor Goes to Sea

**Owner** [Mayor Ribbit](./cast.md#mayor-ribbit) · **Land** home → Threemills (Middle Mill on Tumble Hill) · **Build**
S-155 · **Unlock** `flag:beacon.threemills` · **Reward** 35 gems · **Time** 25 min

Ribbit is afraid of deep water and has never been to sea. Threemills' bread fed the isles for a century, and he has
decided that someone must say thank you properly, from the top of a windmill.

1. `announce` · "Hear Mayor Ribbit's announcement" · talk to Ribbit on the plaza.
2. `calm` · "Find three calming tips for Ribbit (n/3)" · parallel: talk to Nell ("Look at the horizon"), Puddle (if
   `ss07.done`, otherwise Shellby: "Count your breaths in fives"), and Hazel (a ginger bun, key item `ginger_bun`).
3. `sail` · "Sail with Ribbit to Threemills" · `[E] Sail · the Dandelion` with Ribbit aboard; the sailing card
   caption becomes "Mayor Ribbit is very green. (Greener.)".
4. `climb` · "Lead Ribbit up Tumble Hill to Middle Mill" · Ribbit follows using the parade rule (Pip within 2.5 m of
   a waypoint with Ribbit within 6 m); three rest stops at hill benches, each with one line.
5. `speech` · "Hear the speech" · 25 s scene on Middle Mill's gallery to the Hayburys, Goody Gander and Lady
   Honksworth.

Key lines:
- `ribbit.1` "Pip! I have decided to go to sea. ...I have also decided to be very brave about it. Croak."
- `ribbit.2` "The sea is very deep, you know. All the way down. I checked."
- `nell.1` "Tell him to look at the horizon. It never moves. That's what it's for."
- `ribbit.3` (stop 3) "Is it much further? Not that I mind. Mayors don't mind. Mayors ask on behalf of their legs."
- `ribbit.4` (speech) "Friends of Threemills! I have crossed the deep, wide, extremely wet sea to say: your bread is excellent."
- `ribbit.5` (speech) "And so is your courage. You kept the isles fed for a hundred years. Sprout Village thanks you. Ribbit."
- `honksworth.1` (speech) "HONK. ...That means 'well said'. Write it down."
- `ribbit.6` (home, after) "I have been to sea, Pip. I did not enjoy it. I would do it again. Croak."

World mark: a brass plaque on Middle Mill's door, "Mayor Ribbit spoke here (bravely)"; a Threemills wheat-sheaf flag
joins the bunting on Sprout Village plaza.

Journal: open "The Mayor will cross the sea. The Mayor cannot swim. The Mayor is a frog. I have questions." / done
"Ribbit gave the speech of his life from a windmill. He was green throughout. Frogs often are."

<a id="ss-05"></a>
#### ss-05 A Bun for Every Isle

**Owner** [Hazel Thimble](./cast.md#hazel-thimble) · **Land** home (cottage 3 at (−15.9, 11.5)) and every other
land · **Build** S-135; each delivery ships with its land's side-story step · **Unlock** `flag:lanternGot` ·
**Reward** 3 gems per delivery (30) + 30 gems at the end · **Time** 35 min (spread over the game)

Hazel bakes the cinnamon buns (a consumable: 10 gems, heals half a heart; numbers in
[systems.md#items-tools](./systems.md#items-tools)). She wants to bake one bun with something from every isle in it,
for the festival after the ending.

1. `meet` · "Visit the cinnamon-bun cottage" · `[E] Knock · Cottage`, talk to Hazel. Her bun counter opens.
2. `deliver` · "Deliver a bun to someone on every isle (n/10)" · parallel; key item `bun_parcel` (Hazel restocks it
   free each time one is delivered). Each recipient gives back one ingredient (key items, shown in the Items tab):

| Land | Recipient | Ingredient given back |
|---|---|---|
| Duskwick | Granny Wick | moth-bean flour |
| Pinewhistle | Elder Nutmeg | pine-nut butter |
| Archwater | Skipper Rafferty | sea salt from the Raft's pans |
| Threemills | Goody Gander | stone-ground wheat |
| The Rootdeep | Gran Burrows | glowcap sugar |
| The Glassway | Postmistress Pell | a stamp (for luck; not an ingredient, "but it's sticky") |
| Kettle Isle | Master Scoria | ember-baked cinnamon |
| Saltglass Flats | Sable | a "very old raisin" (it is from last week) |
| Driftholm | Mote's doorstep (nobody home) | none: Pip leaves the bun on the step |
| The Starmeadow | Old Mother Brightwell | starlight icing |

3. `bake` · "Bring the ingredients to Hazel" · needs 9 ingredients and the Driftholm delivery. 10 s scene: the oven
   glows and a bun the size of a cushion cools on her sill.

Key lines:
- `hazel.1` "Come in, come in, mind the flour! A bun's half a heart, dear. Ten gems. A cuddle's free."
- `hazel.2` "I'd like to bake one bun with every isle in it. For the festival. One day. When everyone's home."
- `hazel.3` (Driftholm, read by the journal step) "Nobody home? Leave it on the step, dear. Everybody comes home to a bun eventually."
- `hazel.4` (done) "Flour from the moths, salt from the otters, sugar from the moles, icing from the stars. ...It tastes like everyone."
- Hook for [story.md#ch22](./story.md#ch22) (optional line, set flag `ss05.moteBun`): Mote, "Somebody left a bun on my step. Best thing I'd eaten in a hundred years."

World mark: Hazel's windowsill shows one small bun per delivered isle (10 slots, filled as delivered); at the end the
giant **Every-Isle Bun** sits on the sill under a glass dome, and the plaza festival table shows it in the
lantern-chain scene and the Hundred-Year Night.

Journal: open "Hazel wants a bun with every isle in it. Scientifically, that is a very large bun." / done "It tastes
like everyone. I had two slices, for science."

<a id="ss-06"></a>
#### ss-06 The Duck Regatta

**Owner** the Quackenbushes ([cast.md#the-quackenbushes](./cast.md#the-quackenbushes)): Grandpa Pondsworth, the
twins Dilly and Dally, Wigeon and little Quill · **Land** home, the village pond at (−13, 25) · **Build** S-136 ·
**Unlock** `bloom` · **Reward** 25 gems · **Time** 15 min

The ducks have been jealous of Ribbit's croak since the parade (LOCKED: "The ducks are jealous"). They want an event
of their own.

1. `meet` · "Meet the Quackenbushes at the village pond" · talk to Grandpa Pondsworth.
2. `race` · "Herd the ducks through the Regatta course" · finish [act-regatta](#act-regatta) once at any time.
3. `starter` · "Ask Mayor Ribbit to be the starter" · talk to Ribbit; he agrees to croak the start.

Key lines:
- `pondsworth.1` "Quack. The Mayor has a croak. We have a regatta. Well, we will. Once you help."
- `quill.1` "I'm the fastest! ...I'm the smallest. Same thing, nearly."
- `ribbit.1` "A starter's croak? For the ducks? ...It would be my civic duty. CROAK. Was that loud enough? It was, wasn't it."
- `pondsworth.2` (done) "A croak to start a duck race. Ridiculous. Wonderful. Same time next year."

World mark: six painted regatta buoys on the pond; from then on Ribbit stands on the pond bank at the start of every
regatta and croaks "three, two, one, CROAK".

Journal: open "The ducks wish to race. Ducks do not race. Ducks bob. I stand corrected (by a duck)." / done "Ribbit
starts the regatta now. The ducks have forgiven his croak. Mostly."

<a id="ss-07"></a>
#### ss-07 Puddle's Grotto

**Owner** [Puddle](./cast.md#puddle) (the well frog, LOCKED "he waves") · **Land** home, the well at (9, −7.5) →
Puddle's Grotto interior ([atlas-home.md#puddles-grotto](./atlas-home.md#puddles-grotto)) · **Build** S-077 ·
**Unlock** `flag:lanternGot` · **Reward** 30 gems · **Time** 20 min

Puddle is Ribbit's nephew. Under the well is a little grotto he has lived in alone since it went dark; his lily pad
drifted off into the dark side-pool and he won't go after it.

1. `peek` · "Peek into the well with the Lantern" · `[E] Peek · Well` now plays "Puddle waves. Then he points down,
   very seriously."; a ladder appears; `[E] Enter · Well`.
2. `light` · "Light Puddle's grotto (n/4)" · `[E] Kindle · Wall lantern` at 4 glowbud wall-lanterns.
3. `pad` · "Find Puddle's lily pad" · through a glowbud door into the side-pool; the lily pad floats by the far wall;
   `[E] Pick up · Lily pad`. The Lantern shows two Dimlings (the only enemies, in the side-pool only; the grotto's
   main room is a safe zone).
4. `return` · "Give Puddle his lily pad" · `[E] Give · Lily pad`.

Key lines (Puddle speaks in small whispers ending "...ribbit."):
- `puddle.1` "Oh! Hello. You waved back, once. ...Nobody waves back. ...ribbit."
- `puddle.2` "It's very dark down here. Uncle Ribbit says frogs don't mind the dark. Uncle Ribbit sleeps with a lamp. ...ribbit."
- `puddle.3` (done) "My lily pad! It's the best one. It's got a notch where I sit. ...Thank you, Pip. ...RIBBIT. Oh. That was loud."
- `ribbit.1` (after) "My nephew croaked! A real croak! He gets it from me. Croak. ...Don't tell him it took me forty years."

World mark: the four wall-lanterns stay lit; Puddle's lily pad sits under a shaft of light from the well; at the top,
`[E] Peek · Well` now shows "Puddle is sitting on his favourite lily pad, in the light. He waves twice." The well's
water glows faintly gold at night.

Journal: open "A frog lives in the well. The frog waves. I have written a short paper on the wave." / done "The well
is lit. The frog croaked. My paper on the wave is now a paper on the croak."

Note: INDEX S-077 lists "1 heart petal" as this story's reward. CANON §10.3 fixes the 24 petals (16 Hollows,
6 activities, the Snowglobe, the Hundred Lamps), so ss-07 pays gems; see [Decisions](#decisions).

<a id="ss-08"></a>
#### ss-08 Little Thistledown

**Owner** [Primrose Thistledown](./cast.md#primrose-thistledown) · **Land** home (cottage 5 at (−22.5, −2.7)) →
Duskwick (Wickhaven) · **Build** S-156 · **Unlock** `flag:ch8` · **Reward** 30 gems · **Time** 20 min

Clover's littlest sister, Dot, has stowed away on the *Dandelion* to see the moths. She is perfectly safe in
Wickhaven, a town (no enemies), helping Granny Wick polish lamps, and very pleased with herself.

1. `count` · "Primrose is one kit short" · `[E] Knock · Cottage`; talk to Primrose.
2. `find` · "Find Dot on Duskwick" · Dot is on Granny Wick's porch in Wickhaven; a giggle plays within 25 m.
3. `home` · "Bring Dot home" · Dot follows (parade rule, within 6 m) to the jetty; `[E] Sail · the Dandelion`; she
   hops off at Nell's Jetty and runs home on her own.
4. `report` · "Hear Dot's report" · talk to Primrose with Dot back.

Key lines:
- `primrose.1` "Bramble, Sorrel, Clem... Clem, Sorrel, Bramble... Pip, I'm one short. It's Dot. It's always Dot."
- `primrose.2` "She'll be somewhere sensible. She's always somewhere sensible, eventually. Nell said the moths have lamps..."
- `wick.1` "Is she yours? She's been helping me polish. Fine work. Terrible at sitting still. I like her."
- `dot.1` "I'm not lost! I'm VISITING. The moths have tiny lamps and a lady who is a HUNDRED AND TWELVE."
- `dot.2` (report) "Mum! I polished a lamp a hundred years old! It said thank you! ...It didn't. But it looked like it."
- `primrose.3` "Please wipe your paws, Dot. ...All of them. Thank you, Pip. Here, for the fare."

World mark: Dot's crayon drawing of a moth with a lamp is pinned to the Thistledowns' door under the LOCKED "Please
wipe your paws" sign; Dot appears on the plaza by day holding a paper moth on a stick.

Journal: open "A small bunny has gone to sea. Bunnies do not sail. This one does, apparently." / done "Dot is home.
She has opinions about moths now. Strong ones."

<a id="ss-09"></a>
#### ss-09 Old Friends

**Owner** [Elder Shellby](./cast.md#elder-shellby) (with [Pelagia](./cast.md#pelagia)) · **Land** home → the
Glassway (a Bell Shallows sandbar) · **Build** S-217 · **Unlock** `boss:pelagia` (the Sunken Bell duel won)
· **Reward** 40 gems · **Time** 25 min

Young Shellby and young Pelagia raced on the beach a hundred years ago (memory 6, [lore.md#memories](./lore.md#memories)).
They have not seen each other since the Storm. Shellby has not been in a boat for eighty years.

1. `ask` · "Pelagia asks after an old friend" · talk to Pelagia after her duel.
2. `tell` · "Tell Elder Shellby" · talk to Shellby by the pedestal.
3. `sail` · "Sail Shellby out to the Bell Shallows" · `[E] Sail · the Dandelion` with Shellby aboard (Nell: "Room for
   an old shell? Always."). Free sailing or chart stop per [systems.md#boat](./systems.md#boat).
4. `race` · "Watch the slow race on the sandbar" · at low tide on the sandbar marked by two shells; a 40 s scene that
   mirrors memory 6 shot for shot: the two old turtles walk the 30 m sandbar side by side; Pip may walk with them.
   Nobody is told who won.

Key lines:
- `pelagia.1` "You ring like Shellby did. Is he... is the old shell still about? Does he still wear that hat?"
- `shellby.1` "Pelagia. Oh, my. Oh, my dear. ...I haven't been in a boat in eighty years, little sprout."
- `shellby.2` "Ask Nell if she has room for an old shell. And don't tell Pelagia I said 'old'."
- `pelagia.2` (race) "Ready? Same as always. Down to the water and back."
- `shellby.3` (race) "She always won."
- `pelagia.3` (race) "I always let you think I let you win."
- `shellby.4` (home, after) "Pelagia got me back in a boat. Now I'd like to see everything. Will you walk with me sometime?"

World mark: two shells stand together at the end of the sandbar, one big and one small with a moss tuft; on home,
Pelagia's head shows in the shallows off the lighthouse rocks from 17:00 to 19:00 (talkable from the beach). Line
`shellby.4` opens the island legs of [ss-13](#ss-13).

Journal: open "Pelagia remembers a turtle in a too-big hat. I know only one turtle. His hat is a reasonable size
now." / done "They raced. Nobody won. Both of them say they did."

<a id="ss-10"></a>
#### ss-10 The Parcel With No Name

**Owner** [Postmistress Pell](./cast.md#postmistress-pell) · **Land** the Glassway, Duskwick, home, Kettle Isle ·
**Build** S-240 · **Unlock** `flag:moteNamed` (the Catchers visit the plaza) and `realm:kettle.visited` · **Reward**
20 gems and the **Chime Bell** · **Time** 35 min

A small brown-paper parcel has sat on Puffin Post's dead-letter shelf for a hundred years, tied with Lamplighter
twine, addressed only "For the one who finds things". Nobody will open a parcel that isn't theirs, so it goes hand to
hand: six villagers, three Catchers, three isle folk, and back to the one person nobody asked.

1. `parcel` · "Ask about the parcel with no name" · Pell gives key item `parcel_noname`.
2. `chain` · "Find who the parcel belongs to (n/12)" · strictly in this order; each holder's line names the next
   (the journal step text names the next holder too):

| # | Holder | Where | Their line (`<holder>.parcel`) |
|---|---|---|---|
| 1 | Postmistress Pell | Puffin Post | "No name, no stamp, no return address. A hundred years on my shelf. Stamps required, normally. I made an exception." |
| 2 | Granny Wick | Wickhaven | "Lamplighter twine. Not my knot, though. That's a turtle's knot. Slow and careful." |
| 3 | Elder Shellby | the pedestal | "My knot? Goodness. I tied a lot of parcels when I was small. Not this one, I think. Ribbit keeps the village post." |
| 4 | Mayor Ribbit | the plaza | "No stamp! Highly irregular. Croak. The paper is from Miso's counter, though. I'd know that paper anywhere." |
| 5 | Miso | Miso's Shop | "Mrrow~ My paper. From before I was born, so not my parcel~ Clover borrows my string. Ask her~" |
| 6 | Clover | the Shores path | "It RATTLES! No, it CHIMES! Hoot will know what chimes. Hoot knows everything. Except when he doesn't." |
| 7 | Professor Hoot | the Woods path | "It chimes at approximately... I have no idea. Digby hears better than any of us. Ask Digby." |
| 8 | Digby | the windmill | "That's a bell. A little one. It wants to find something, by the sound. Grumble collects bells, doesn't he?" |
| 9 | Grumble Shroom | plaza edge, evenings | "Hmph. Not mine. I collect MOSS. Ask the crab." |
| 10 | Captain Pinch | plaza edge, evenings | "Aye, it's no ship's chime. Ask the bun, lad. She sleeps on everything; she'll know a bell by its warmth." |
| 11 | Frostbun | plaza edge, evenings | "Warm. It wants to be opened. ...By the one who finds things. Forge mark on the clasp. Bear's mark." |
| 12 | Master Scoria | Forgefall | "That's my granny's mark. An order for 'whoever goes looking', a hundred years back. Never collected. ...Open it, little one." |

3. `open` · "Open the parcel" · `[E] Open · Parcel` at Scoria's anvil; item-get: the **Chime Bell** ("Chimes faster
   near anything still waiting to be found within 30 m": chests, keepsakes, sleeping acorns, bottles and Lamp Logs,
   [systems.md#items-tools](./systems.md#items-tools)).

Key lines (after opening):
- `scoria.2` "'For the one who finds things.' Well. Who else has been finding things all over the Wide Blue?"
- `pell.2` (back at Puffin Post) "Delivered! A hundred years late and exactly on time. Stamp, please. ...Fine. Exception."
- `frostbun.2` (plaza, after) "Told you. Warm. ...You find things. Everyone says."

World mark: Pell's dead-letter shelf is empty and carries a sign "All letters delivered ✿"; the parcel's twine is
tied in a bow on Pip's Nook shelf (gift `nook_gift_twine`).

Journal: open "A parcel with no name. Twelve people declined to open it. I declined twice." / done "It was for the
one who finds things. That is Pip. We all agreed, which has never happened before."

<a id="ss-11"></a>
#### ss-11 Grumble's Nephews

**Owner** [Grumble Shroom](./cast.md#catchers) · **Land** home, Grumble's Undercap (dungeon o2,
[dungeons.md#o2](./dungeons.md#o2)) · **Build** S-195 · **Unlock** `flag:ch13` and `ability:mitts` · **Reward** 40
gems; the Spore Rally's third tier opens ([act-spore-rally](#act-spore-rally)) · **Time** 20 min (plus the dungeon)

Grumble's kind reason in Act I was the little ones' fear of the dark. The three unlit night-lights by the Hollow sign
(`placeReasons`) belong to the shroomlet town under his Crown, which has been dark since the Tree went droopy.

1. `ask` · "Grumble asks a favour" · talk to Grumble in his Hollow (after the bloom he naps; `[E] Talk` wakes him
   for talk only, `[E] Wake` stays the rematch).
2. `enter` · "Dig into Grumble's Undercap" · `[E] Dig · Soft earth` at the Crown's root flare; enter o2.
3. `relight` · "Relight the shroomlet town (n/6)" · `[E] Kindle · Shroom lamp` at 6 lamps in o2's town room.
4. `nightlights` · "Light the three night-lights by the Hollow sign" · `[E] Kindle · Night-light` × 3 on the surface.

Key lines:
- `grumble.1` "The little ones' night-lights. Under my Crown. They went out years back. Hmph. Don't make a fuss."
- `grumble.2` "And don't tell them I asked. I have a reputation. It is GRUMPY."
- `shroomlet.1` (town) "It's the hood! The hood came! Uncle Grumble said a hood might come!"
- `grumble.3` (done) "...They're asleep. All of them. First bedtime in a hundred years with nobody crying. Hmph. Good."
- `grumble.4` "Spore Rally. Thirty. In front of the nephews. Now they'll be watching, I'll do it properly."

World mark: the three night-lights by the Hollow sign glow every night; six tiny shroomlets sit in a row on the
Hollow sign at dusk, and the Undercap's town glows warm through its soft-earth entrance.

Journal: open "Grumble Shroom has asked for a favour. Grumble Shroom does not ask for favours. Note the date." / done
"The nephews sleep. Grumble pretends not to care. He has said 'Hmph' eleven times today, all of them happy."

<a id="ss-12"></a>
#### ss-12 Frostbun's Great-Aunt

**Owner** [Frostbun](./cast.md#catchers) · **Land** home, the Snowglobe under Frostcap (dungeon o1,
[dungeons.md#o1](./dungeons.md#o1)) · **Build** S-239b (Flurry herself: S-239a) · **Unlock** `ability:sling` · **Reward** 40 gems; Flurry
knits Pip a scarf: the hood trim **Snowdrift** unlocks free ([art-audio.md#hood-trims](./art-audio.md#hood-trims)) ·
**Time** 15 min (plus the dungeon and boss)

Great-Aunt Flurry went down for a nap under the snow "before Frostbun was a medium bun" and hasn't come up.

1. `ask` · "Frostbun is worried about Great-Aunt Flurry" · talk to Frostbun at the Summit.
2. `melt` · "Melt the Snowglobe's ice wall" · Ember Sling at the ice wall (post-pass `placeGates`).
3. `reach` · "Find Great-Aunt Flurry in the Snowglobe" · reach o1's last room.
4. `calm` · "Calm Great-Aunt Flurry" · the optional boss ([creatures.md#boss-flurry](./creatures.md#boss-flurry)).
5. `news` · "Tell Frostbun" · talk to Frostbun; Flurry is already beside her.

Key lines:
- `frostbun.1` "Aunt Flurry. Sleeping. Too long. Under the snow. ...Wake her? Gently. She's grumpy before tea."
- `flurry.1` (after the boss) "Little Frostbun sent you? Little Frostbun! Is she still little? Don't answer. She'll always be little."
- `flurry.2` "You've got a cold neck, dear. Hold still." (item-get: Snowdrift trim) "There. Knitted it while I was dozing."
- `frostbun.2` (done) "Aunt Flurry. Here. Awake. ...She called me a medium bun. I'm a LARGE bun. ...Thank you."

World mark: from then on two buns sit on Frostbun's Summit, the huge one knitting; the Snowglobe's dome glows pale blue
at night, visible from the plaza. If [ss-25](#ss-25) is done, Flurry knits Frostbun her own ear-warmer (the borrowed
sock is not missed).

Journal: open "Frostbun has an aunt. The aunt is larger than Frostbun. I did not think that was possible." / done
"Flurry is awake and knitting. She knitted me a warmer for my spectacles. It is too warm. I wear it anyway."

<a id="ss-13"></a>
#### ss-13 Shellby's Slow Walk

**Owner** [Elder Shellby](./cast.md#elder-shellby) · **Land** home (4 legs), then Duskwick, Pinewhistle,
Archwater, Threemills and Kettle Isle (1 leg each) · **Build** S-172 (home legs; each isle leg is a data row added
when that isle ships or by S-217 for the isles) · **Unlock** `flag:act2done` (home legs); `ss09.done` (isle legs) ·
**Reward** 35 gems at the end · **Time** 30 min (resumable)

Shellby asks Pip to walk with him, slowly, to the places he remembers. It is resumable: stop anywhere, carry on later.

Rules: Shellby walks at **1.2 m/s**; if Pip is more than 8 m away he stops and waits (no prompt, no fail). `[E] Talk ·
Shellby` mid-walk offers "Shall we stop here and carry on tomorrow?"; yes saves the leg's progress
(`ss13.leg`, `ss13.wp`), and Shellby is found next time at the last waypoint reached. Each leg ends at a spot where he
sits and says two lines; a small spiral-carved shell is left there (the mark).

| Leg | From → to | Shellby's two lines at the end |
|---|---|---|
| 1 | pedestal → Grumble's Crown | "Grumble was a smaller mushroom when I was small. Cheerful, too. Grumpiness comes with the crown, I think." / "He let me win. Don't tell him I know." |
| 2 | pedestal → Summit Crystal Cairn | "We used to sit here and count the steps of the old stair. You can't see them now. You could, once." / "Mind the wind, little sprout." |
| 3 | pedestal → Pinch's Lighthouse | "Pinch had no hat then. He wanted one so badly. I think he's had it on ever since." / "There's a shelf in that lamp room I know very well." |
| 4 | pedestal → Meadow Windmill | "The Meadow never had a guardian. It had me, some summers. I wasn't very fierce." / "Digby's grove smells lovely. Tell him I said." |
| 5 | Duskwick jetty → the Tower's foot | "Wick was twelve. She carried lamps twice her size. She still does, in her way." / "Light's not for keeping. She told me that first." |
| 6 | Pinewhistle jetty → the Whistling Pine | "I heard this pine sing once, from the sea. I thought it was the wind showing off." / "It's good to hear it again." |
| 7 | Archwater jetty → the Moon Pool | "Pelagia and I watched the moon land in that pool. Or we said we did. We were very small." / "Some things you remember the way you want them." |
| 8 | Threemills jetty → Tansy Mill | "Their bread got us through the long winter after the Storm. Every loaf with a little sail stamped on top." / "Thank them for me, will you? I never did." |
| 9 | Kettle Isle jetty → the Bathhouse Terraces | "My knees have waited a hundred years for this bath." / "Thank you for walking slowly with me, little sprout. Most people don't." |

World mark: a spiral-carved shell at each of the 9 leg ends (each also counts as a place Shellby mentions in later
lines); at the end, Shellby's bench by the pedestal gets a second, smaller cushion: Pip's seat for chapter 22.

Journal: open "Elder Shellby walks at 1.2 metres per second. I measured. He says it is the correct speed for
remembering." / done "Nine walks. Nine shells. Shellby says the second cushion is for 'whoever sits with him'. It is
Pip-sized."

<a id="ss-14"></a>
#### ss-14 The Fourth Bough

**Owner** [Wenna](./cast.md#wenna) · **Land** home, the Great Tree's west bough (over the Meadow) · **Build** S-171
(steps 1-2), S-291 (steps 3-4) · **Unlock** `flag:act2done` · **Reward** 40 gems · **Time** 20 min

Three of Wenna's boughs blossomed when the three Starseeds came home; the fourth, facing the Meadow, has only ever
been in leaf (CANON §4.2). She does not know what it is waiting for.

1. `ask` · "Ask Digby about the fourth bough" · Wenna's pedestal line opens the quest; talk to Digby.
2. `sprout` · "Bring a golden sprout to the foot of the fourth bough" · needs `ss01.done` part 1 (step 3); Digby gives
   key item `golden_sprout`; `[E] Place · Golden sprout` at the root under the west bough. The bough's leaves gain
   gold edges.
3. `lantern` · "Hang a lantern on the fourth bough" · after `flag:mainEnding`: Granny Wick gives a lantern from the
   lantern chain (key item `chain_lantern`); `[E] Place · Lantern` at the west bough's balcony (reached by the Ivy
   Gloves route, [atlas-home.md#ivy-finds](./atlas-home.md#ivy-finds)).
4. `bloom` · "Sit under the fourth bough at dawn" · after `flag:ch22`: `[E] Sit · Fourth bough` between 05:00 and
   07:00; a 15 s scene: the bough blossoms white and gold.

Key lines:
- `wenna.1` "My west bough never blossoms. It's waiting for something. I don't remember what. That happens, at my age."
- `digby.1` "That bough's over the Meadow. The Meadow's never had a guardian. Maybe it never had a seed, either."
- `wenna.2` (step 2) "Oh, that tickles. Gold at the edges. It likes that. It's still waiting, though."
- `wenna.3` (step 3) "A lantern from everyone. It's warmer. It's still waiting. ...So am I, a little."
- `wenna.4` (step 4) "Oh, there it goes. I think it was waiting for you to know where you came from. Silly bough. Clever bough."

World mark: the west bough in white-and-gold blossom for good (a fourth bough state on the Great Tree model,
[atlas-home.md#great-tree](./atlas-home.md#great-tree)); a blossom window opens in Pip's Nook's west wall
([§8](#nook)).

Journal: open "The Tree has a bough that will not blossom. I have recommended patience. The Tree says she has had a
great deal of patience." / done "The fourth bough blossomed when Pip knew where he came from. I knew all along. (I
did not.)"

<a id="side-duskwick"></a>
### Duskwick: ss-15 to ss-18

<a id="ss-15"></a>
#### ss-15 Moth to a Flame

**Owner** [Flick](./cast.md#flick) · **Land** Duskwick (Wickhaven, Ember Sands, Coral Steps) · **Build** S-167 ·
**Unlock** `flag:act2done` · **Reward** 35 gems · **Time** 20 min

Six young Wicklings dozed off on the beach and the reef at dusk and now drift toward any light but home.

1. `ask` · "Flick's six sleepy cousins" · talk to Flick in Wickhaven.
2. `guide` · "Guide the dozing moths home with the Lantern at night (n/6)" · `tod:night`. A dozing moth wakes when the
   Lantern is within 6 m and follows the Lantern's light (2.2 m/s, keeps 2 m behind); it settles when Pip stands
   within 3 m of its own porch lamp (each porch lamp shows the moth's wing colour). If Pip moves more than 12 m
   ahead, the moth sits down where it is and waits. Positions: 2 on Ember Sands, 2 on the Coral Steps, 1 on the
   Tower Head path, 1 on the lagoon stilt deck.
3. `report` · "Tell Flick" · talk.

Key lines:
- `flick.1` "My cousins fell asleep on the sand again. They'll follow any light. Last week one followed a crab."
- `flick.2` "Your Lantern's the brightest thing on the beach. They'll follow you home. Probably. Mind the crab."
- `flick.3` (done) "Six cousins, six porches. You're better at this than me. Don't tell Granny Wick. She'll make you an apprentice."

World mark: the six porch lamps burn every night; the six cousins sleep in a row on a washing line across the
lagoon deck, swaying.

Journal: open "Moths follow lights. Pip has a light. I see no problems." / done "Six moths home. One crab
disappointed. Science marches on."

<a id="ss-16"></a>
#### ss-16 Granny Wick's Library

**Owner** [Granny Wick](./cast.md#granny-wick) · **Land** Duskwick, Granny Wick's Library (a Wickhaven interior,
[atlas-isles.md#duskwick](./atlas-isles.md#duskwick)) · **Build** S-167 · **Unlock** `flag:act2done` ·
**Reward** 15 gems per 10 Lamp Logs (45) · **Time** 15 min (the logs themselves are collectibles)

The Lamplighters' logbook was thirty pages; the Storm blew them across the Wide Blue. Every Lamp Log Pip has found
(and finds later) shelves itself here (texts: [lore.md#lamp-logs](./lore.md#lamp-logs)). Counts per land are
CANON §10.3 (home 4, Duskwick 5 including Log 1 from Granny Wick in ch8, Pinewhistle 2, Archwater 2, Threemills 2,
Rootdeep 3, Glassway 3, Kettle 3, Saltglass 6).

1. `open` · "Visit Granny Wick's Library" · `[E] Enter · Library`; the shelf shows every log found so far.
2. `ten` · "Return 10 Lamp Logs" · `collect.log` count ≥ 10, then talk.
3. `twenty` · "Return 20 Lamp Logs" · ≥ 20, talk.
4. `thirty` · "Return all 30 Lamp Logs" · = 30, talk; she reads Log 30 aloud (a 30 s scene at the reading lamp).

Key lines:
- `wick.1` "Thirty pages, blown all over the Wide Blue the night of the Storm. Bring me what you find, dear. The shelf remembers."
- `wick.2` (10) "Ten. The early pages. Lots of lamp oil and complaining. They were very young."
- `wick.3` (20) "Twenty. Here's where they built the Ladder. I helped carry. I was twelve. I dropped one."
- `wick.4` (30) "All thirty. The last page is mine, you know. I wrote it the morning after. I'd like to read it to someone."

World mark: the library's reading lamp burns all night; the logbook lies complete on its stand; Wicklings sit on
the steps outside to listen at 20:00.

Journal: open "Granny Wick is missing thirty pages. I am missing several of my own. We have bonded." / done "The
logbook is whole. The last page is in Granny Wick's hand. She read it slowly. I did not take notes."

<a id="ss-17"></a>
#### ss-17 The Clockwork Apprentice

**Owner** [Flick](./cast.md#flick) · **Land** Duskwick (the Tower), Threemills · **Build** S-168a · **Unlock**
`boss:wickwork` · **Reward** 35 gems · **Time** 20 min

Calmed and rewound by Granny Wick, the Wickwork Moth is missing three brass gears and can only flap one wing. Flick
wants to fix it and be a real apprentice.

1. `ask` · "Flick wants to fix the Wickwork Moth" · talk to Flick at the Tower's foot.
2. `gears` · "Find three brass gears (n/3)" · parallel: (a) in a tidepool on the Coral Steps, visible at the bottom
   (`[E] Pick up · Brass gear`); (b) on Tower floor 2, behind the mirror that now stands aside; (c) on Threemills:
   Goody Gander has been using one as a pie crimper (talk; she swaps it for a plain fork).
3. `fit` · "Bring the gears to Flick" · 15 s scene: Flick fits them; the Moth flies one lap of the Tower.

Key lines:
- `flick.1` "It's only got one wing going. It flies in circles. Very small circles. I want to fix it. Properly."
- `gander.1` "This? It crimps a lovely pie edge. Brass, is it? ...Oh, all right. I'll use a fork like everybody else."
- `wick.1` (done) "Well. That's an apprentice, then. Here, child. Your first lamp. Don't drop it. I did."

World mark: the Wickwork Moth flies a lap of the Tower every dusk; Flick wears a tiny brass lamp on a cord.

Journal: open "A brass moth with one wing. A young moth with two. I predict a partnership." / done "Flick is an
apprentice. The Wickwork Moth flies in large circles now. Progress."

<a id="ss-18"></a>
#### ss-18 Kinako's Limited Edition

**Owner** [Kinako](./cast.md#kinako) · **Land** 8 lands · **Build** S-168b (the quest and the first rows); each
further row ships with its land · **Unlock** `flag:act2done` · **Reward** 40 gems and the gift
`nook_gift_spoon` · **Time** 25 min (spread)

Kinako wants "one-of-a-kind treasures" from every isle for his bazaar. Every one is the same ordinary wooden spoon.

1. `ask` · "Kinako wants a limited edition from every isle" · talk at the bazaar.
2. `spoons` · "Collect Kinako's 'limited editions' (n/8)" · parallel; talk to each holder:

| Land | Holder | What they call it |
|---|---|---|
| Duskwick | Flick | "my paint-stirrer" |
| Pinewhistle | Elder Nutmeg | "the acorn-soup ladle of the Acornet clan" |
| Archwater | Skipper Rafferty | "my choir baton" |
| Threemills | Ma Haybury | "the jam spoon" |
| The Rootdeep | Gran Burrows | "my stirring stick" |
| The Glassway | Mr Whelk | "a rare spoon-shell, very rare" |
| Kettle Isle | Soakley | "the bath-tea spoon" |
| Saltglass Flats | Sable | "a Lamplighter ceremonial artefact" (it is stamped "last Tuesday") |

3. `set` · "Bring the set to Kinako" · 10 s scene: eight spoons on a velvet rack.

Key lines:
- `kinako.1` "Treasures!! One from every isle!! Each one UNIQUE!! I'll pay in gems!! Eventually!!"
- `kinako.2` (set) "A COMPLETE SET!! Eight limited editions!! ...They're all the same spoon, aren't they."
- `kinako.3` "...Still limited!! There are only EIGHT!! Here, take one. Limited edition of one!!"

World mark: a spoon rack with eight identical spoons on the bazaar's counter, each with a handwritten label; Pip's
Nook gets the ninth spoon on a tiny stand.

Journal: open "Kinako collects rare treasures. He showed me one. It was a spoon." / done "Eight spoons. All the same.
Kinako calls this 'a collection'. I call it 'a drawer'."

<a id="side-pinewhistle"></a>
### Pinewhistle: ss-19 to ss-22

<a id="ss-19"></a>
#### ss-19 The Acorn Hoard

**Owner** [Elder Nutmeg](./cast.md#elder-nutmeg) · **Land** Pinewhistle (Acornet Hollow, Misthollow Ravines) ·
**Build** S-110 · **Unlock** `realm:pinewhistle.visited` · **Reward** 35 gems · **Time** 20 min

The Acornet clan keeps everything "for safekeeping", acorns most of all. Since the pine fell silent, nobody sleeps,
and the hoard has grown into five stuffed tree hollows.

1. `meet` · "Meet Elder Nutmeg's hoard" · talk.
2. `holes` · "Answer the hoard kits' riddles (n/5)" · at each of 5 hollows (2 in Acornet Hollow, 3 in the Ravines'
   edge pines) a kit pokes out and asks a riddle; three small things lie at the foot of the trunk and Pip answers by
   `[E] Offer · <thing>`. The right one swaps for an acorn and the kit's note (and 1 gem-bag pickup); a wrong one gets
   a giggle ("Nope! Try another.") and nothing is lost. Riddles:
   1. Pecan: "I have scales but I never sing. I fall but I'm never hurt. I'm the best thing in my hole. What am I?" Answer: the pinecone (also by the hole: feather, pebble).
   2. Filbert: "I'm tied but I'm not a shoe. I'm the reason nobody gets in, me included. What am I?" Answer: the knotted string (also by the hole: leaf, acorn cap).
   3. Cobnut: "I always point north, unless I'm upside down. Then I point at my toes. What am I?" Answer: the little compass (also by the hole: spoon, twig).
   4. Twig: "I'm round and brown and I snore in tune. Shh. What am I?" Answer: the sleepy acorn (also by the hole: mushroom, berry).
   5. Burr: "Prickly outside, sleepy inside. Like me before breakfast. What am I?" Answer: the chestnut burr (also by the hole: pine needle, snail shell).
3. `plant` · "Plant one acorn with a kit" · at the plaza ring of Acornet Hollow, `[E] Place · Acorn`; it sprouts in a
   puff of leaves.
4. `persuade` · "Show Elder Nutmeg the sprout" · talk.

Key lines:
- `nutmeg.1` "Safekeeping! Everything's safer kept. Especially acorns. Especially the ones that snore."
- `nutmeg.2` "The snoring ones we leave be. We don't wake snoring things. Rude."
- `nutmeg.3` (done) "...It's still kept. Just in the ground. Safekeeping with leaves. ...Fine. Plant the lot. We keep one each."

World mark: a ring of 12 young pine-and-oak saplings round the Acornet Hollow plaza, each with a tiny name tag; the
snoring acorns are left where they lie (they are the land's Sleeping Acorns, woken later with the Sunglass).

Journal: open "Squirrels hoard. Hoarding is safekeeping with anxiety." / done "Twelve saplings. Each squirrel kept
one acorn. In a pocket. For safekeeping."

<a id="ss-20"></a>
#### ss-20 Peer Review

**Owner** [Professor Hoot](./cast.md#professor-hoot) (with [Professor Pinfeather](./cast.md#professor-pinfeather)) ·
**Land** Pinewhistle (Whistle Rise) · **Build** S-110 · **Unlock** `flag:beacon.pinewhistle` (Hoot sails over "on
sabbatical" and stands by Pinfeather's study until `ss20.done`) · **Reward** 30 gems · **Time** 20 min

Two scholars, one argument: are owls or woodpeckers louder? They both lose, to a sloth.

1. `argue` · "Hear the two professors' argument" · talk to either.
2. `posts` · "Stand at the listening posts while Hoot hoots (n/3)" · three listening posts (painted brass horns on
   stakes) at 10, 20 and 40 m from a chalk cross; at each, `[E] Look · Listening post` while Hoot hoots; the post's
   leaf flag lifts to a height (the "reading"); a sound cue plays at the right volume for the distance.
3. `pecks` · "Do the same while Pinfeather drums (n/3)".
4. `hum` · "Ask Mossmantle to hum" · after `boss:mossmantle`; the 40 m post's flag shoots straight up.
5. `verdict` · "Deliver the verdict" · talk to both.

Key lines:
- `hoot.1` "Owls are louder. Obviously. Hoo! ...Pinfeather disagrees, which is how I know I'm right."
- `pinfeather.1` "Woodpeckers are louder. Measurably. I have measured. I have also measured Hoot. He's fluffy."
- `mossmantle.1` "Hmmmmmmmmm. ...Was that all right? I've been practising for nine days."
- `pinfeather.2` (verdict) "Conclusive. The sloth won."
- `hoot.2` (verdict) "Inconclusive! We shall co-author the paper. 'On Loudness, Mostly Wrong.' My name first."

World mark: the three listening posts stay on Whistle Rise; the joint paper is pinned on both Pinfeather's door and
Hoot's Board at home.

Journal: open "Pinfeather says woodpeckers are louder. Pinfeather is wrong. I shall prove it with posts." / done "The
sloth won. Pinfeather and I agree for the first time. We both find this upsetting."

<a id="ss-21"></a>
#### ss-21 Lost in the Mist

**Owner** [Elder Nutmeg](./cast.md#elder-nutmeg) · **Land** Pinewhistle (Misthollow Ravines) · **Build** S-111 ·
**Unlock** `met:nutmeg` · **Reward** 30 gems · **Time** 15 min

Three kits, Twig, Burr and Nibs, are playing hide-and-seek in the ravine mist. They are not lost; they are very good
at hiding and very bad at being quiet.

1. `ask` · "Three kits are hiding in the Misthollow mist" · talk to Nutmeg (morning, 06:00-11:00, when the mist
   is thickest; at other times she sends Pip anyway and the mist volume is set thick for the quest).
2. `find` · "Find Twig, Burr and Nibs by their giggles (n/3)" · each kit giggles every 4 s from its hiding place;
   the giggle is a positional sound audible within 30 m (it pans in first person). Hiding places: under the fern
   bank at the north rope bridge's west end; inside a hollow log on the ravine floor; on a ledge reached by the
   second rope bridge. Found = `[E] Talk · <kit>`; each kit then runs home on its own.
3. `home` · "Tell Elder Nutmeg" · talk.

Key lines:
- `nutmeg.1` "Lost? They're not lost. They're hiding. In the mist. Very well. ...Too well. Fetch them for supper?"
- `twig.1` "You found me! How?! ...Was it the giggling. It was the giggling."
- `nutmeg.2` (done) "All three. Here, for your trouble. And they've an idea, apparently. Bells. On everything."

World mark: the kits hang little brass bells on all four rope bridges; they tinkle in the wind and play a soft
positional chime that marks each bridge in the mist (a real navigation aid).

Journal: open "Three kits are lost in the mist. Nutmeg says they are not lost. Nutmeg says it very firmly." / done
"Bells on every bridge now. The mist sounds lovely. Finding one's way is optional but easier."

<a id="ss-22"></a>
#### ss-22 The Sawmill Song

**Owner** Foreman Knock (a woodpecker, the sawmill's foreman; [cast.md#foreman-knock](./cast.md#foreman-knock)) ·
**Land** Pinewhistle (Sawmill Run) · **Build** S-111 · **Unlock** `flag:beacon.pinewhistle` · **Reward** 35 gems ·
**Time** 20 min

The sawmill's four steam saw-whistles went out of tune while the pine was silent; now they jangle against it.

1. `ask` · "The saw-whistles are out of tune" · talk to Foreman Knock.
2. `tune` · "Retune the four saw-whistles (n/4)" · each whistle has a brass pitch-wheel with 5 notches; Swing it to
   step one notch (wraps). The Whistling Pine sings its 4-note phrase every 20 s; the right notch is the one whose
   pitch matches that whistle's note. Visual cue for players without sound: a leaf pennant on the whistle stands
   straight up only on the right notch. Answers (notch from the start position): whistle 1 → +2, 2 → +4, 3 → +1,
   4 → +3.
3. `song` · "Hear the Sawmill Song" · 20 s scene: whistles and pine in harmony; Mossmantle hums along from the rise.

Key lines:
- `knock.1` "Tap-tap. Listen to that. Four whistles, four different opinions. The pine's back and they're arguing with it."
- `knock.2` "Give the wheels a knock. Not too hard. They're older than me. Most things are."
- `knock.3` (done) "Tap-tap-TAP. Now that's a mill. Same time every hour, we'll play her song back to her."

World mark: on every game hour the sawmill whistles play the pine's phrase; the Sawmill Run region music gains a
woodblock layer.

Journal: open "The sawmill is out of tune. I did not know sawmills had tunes. I did not ask." / done "The sawmill
plays the pine's song every hour. I set my watch by it. My watch is wrong in a new way."

<a id="side-archwater"></a>
### Archwater: ss-23 to ss-26

<a id="ss-23"></a>
#### ss-23 Clover's Map

**Owner** [Clover](./cast.md#clover) · **Land** home → Archwater (the Raft, Basalt Stairs, Tidepool Shelf) ·
**Build** S-131 · **Unlock** `realm:archwater.visited` · **Reward** 35 gems · **Time** 20 min

Clover wants to be an explorer. She comes along to Archwater, runs ahead, and leaves chalk arrows. She is not lost at
all.

1. `ask` · "Clover wants to come exploring" · talk to Clover at home.
2. `sail` · "Sail to Archwater with Clover" · she is aboard; on landing she dashes off.
3. `arrows` · "Follow Clover's chalk arrows (n/12)" · 12 chalk arrows on basalt from the Raft up the Basalt Stairs to
   the Tidepool Shelf; each `[E] Look · Chalk arrow` ticks it (they can be followed without looking). Arrow 8 sits
   on a column top, chalked "SHORTCUT! —C.", and points at arrow 9 on a lower column about 14 m away with no way up:
   only a **Leaf Glider** glide follows Clover's way (the walking route round the columns still reaches Clover).
4. `find` · "Find Clover" · she is sitting on a basalt column above the tidepools, drawing.
5. `map` · "Bring Clover's map home" · key item `clover_map_1`; give it to her at her house (Thistledown cottage).

Key lines:
- `clover.1` "Take me with you? I'll make a map! A proper one! With a compass rose! I'll draw the rose first."
- `clover.2` (found) "Lost? I'm not lost. I know EXACTLY where I am. I'm here! I just don't know where here is yet. It's on the map now."
- `clover.3` (home) "My first map! It's a bit wonky. The sea's wonky, though. I'm going to draw every isle. Every single one."

World mark: the 12 chalk arrows stay, pointing to Archwater's landmarks (a navigation aid); Clover's map is pinned
above her windowsill beside the LOCKED rainbow shells; from now on each land's map card in the journal shows a little
"drawn by Clover" corner stamp once she has visited it in a later line (cosmetic; [systems.md#journal](./systems.md#journal)).

Journal: open "Clover has gone exploring. Alone. With chalk. I trust the chalk." / done "Clover made a map. It is
better than mine. I have decided this is because she is younger."

<a id="ss-24"></a>
#### ss-24 The Raft Choir

**Owner** [Skipper Rafferty](./cast.md#skipper-rafferty) · **Land** Archwater (the Raft, Tidepool Shelf) · **Build**
S-131 · **Unlock** `flag:beacon.archwater` (the tide cycles again) · **Reward** 35 gems · **Time** 20 min

Rafferty has a choir of otters and no song; the old shanty's five verses are carved on driftwood boards in the
tidepools, readable only at low tide.

1. `ask` · "Rafferty's choir needs a song" · talk.
2. `verses` · "Find the five shanty verses at low tide (n/5)" · `[E] Read · Driftwood verse` in 5 tidepools on the
   Tidepool Shelf; at high tide the boards are under water and the prompt reads "Under the water. Come back at low
   tide." (The Tide Bell can lower the tide at the shelf's tide stone.)
3. `ring` · "Ring the verses back to the choir (n/5)" · each board carries a three-note phrase carved as three
   coloured notches (low `#5a6ad8`, mid `#f2c45a`, high `#ff8fb0`); Field Notes copies the phrase when the board is
   read. At the Raft's mast hang three bells (low, mid, high; Swing rings one, no Starsong needed). Ring the five
   phrases in verse order: v1 low-high-low, v2 mid-mid-high, v3 high-low-mid, v4 low-mid-mid, v5 high-high-low. A
   right phrase and the choir sings that verse (4 s); a wrong note is a soft clonk and Rafferty: "(sings) Nearly! From
   the top of that verse, matey!" (only that verse restarts).
4. `sing` · "Hear the Raft Choir at dusk" · 25 s scene on the Raft at 18:00-20:00; a sung music layer.

The shanty, "The Wide Blue Round" (each board's text, `side.ss24.verse.<n>`):
1. "Oh, the tide goes out and the tide comes in, and the Raft goes up and down, so hold your hat and hold your fish and never mind the frown!"
2. "There's a lamp on the hill and a light on the sea and a moth to keep it bright; so row, my lads, by the wick and the lamp, and we'll all be home tonight!"
3. "Oh, the arch is tall and the pool is round, and the moon comes down to swim; so sing it low for the old moon's sake, and leave a bit of room for him!"
4. "The squirrels sing in the singing pine, the geese up on the hill; the otters sing on the Wide Blue Raft, and the otters always will!"
5. "So round and round the Wide Blue goes, from the morning to the night; and every isle's a lantern, and every lantern's light!"

Key lines:
- `rafferty.1` "We've got the voices! Well, I've got A voice. It's loud. Loud counts. Find us a song, little 'un!"
- `rafferty.2` (scene) "AND EVERY LANTERN'S LIIIIGHT! ...Was I flat? I felt flat. I felt GLORIOUS."

World mark: the choir sings verse 5 on the Raft every dusk (an ambient layer heard within 60 m); the five driftwood
boards are hung on the Raft's mast.

Journal: open "Otters wish to sing. Otters can sing. One otter cannot. He is the captain." / done "The Raft sings
every dusk. Rafferty is flat. Nobody minds. I hummed."

<a id="ss-25"></a>
#### ss-25 Eight Socks

**Owner** [Old Gloop](./cast.md#old-gloop) · **Land** Archwater → home (Frostbun's Summit) · **Build** S-132 ·
**Unlock** `boss:gloop` · **Reward** 30 gems · **Time** 15 min

Old Gloop wears eight mismatched knitted socks. The eighth, blue-and-white, went missing the week the beacon went dark:
a gull took it north, and it ended up on Frostbun.

1. `ask` · "Old Gloop has only seven socks" · talk to Gloop at the Moon Pool.
2. `clue` · "Ask Skipper Rafferty about the sock" · talk ("A gull had it. Flew north. Way north.").
3. `find` · "Find the blue-and-white sock" · Frostbun is wearing it as an ear-warmer on her Summit (a sock mesh on her
   left ear, visible from 30 m); talk to her.
4. `return` · "Return the sock to Old Gloop" · `[E] Give · Sock`.

Key lines:
- `gloop.1` "Seven socks. It's the cold arm that's bare. Always the cold arm. Number eight. Blue and white. Hand-knitted."
- `frostbun.1` "It was on a gull. The gull was cold. ...Now I'm cold. Fine. Take it. ...It smelled of sea."
- `gloop.2` (done) "Eight! Eight is the right number. Everything's the right number now. Even the sea feels warmer."

World mark: Gloop's model shows the eighth sock (the sock set's arm 8 turns from bare to blue-and-white); Frostbun's
ear stays bare until [ss-12](#ss-12)'s ear-warmer.

Journal: open "An octopus has lost a sock. I have lost many socks. It is a universal story." / done "The sock was on a
bun. The octopus is complete. I have checked my own drawers. Nothing."

<a id="ss-26"></a>
#### ss-26 The Moon Pool

**Owner** Nana Kelp (the Raft's oldest otter; [cast.md#nana-kelp](./cast.md#nana-kelp)) · **Land** Archwater (the
Great Arch and its Moon Pool) · **Build** S-132 · **Unlock** `ability:tidebell` · **Reward** 35 gems · **Time** 20 min

The otters say that before the beacon went dark, the moon "came down to swim" in the Moon Pool at midnight. Since the
tide came back the pool fills to the wrong height.

1. `ask` · "Nana Kelp misses the moon in the pool" · talk on the Raft.
2. `stones` · "Set the three tide stones round the Moon Pool" · three tide stones (A west, B north, C east) each set
   high or low with the Tide Bell (`[E] Ring · Tide stone`). The pool's water line must sit on the carved moon line;
   only **A high, B low, C high** does it (B low drains the north channel; A and C high fill from both sides). Any
   other setting shows the water above or below the line; there is no penalty.
3. `midnight` · "Watch the Moon Pool at midnight" · `tod:23.5-0.5`; `[E] Sit · Pool's edge` (a stone seat); 20 s
   scene: the moon's reflection settles in the exact centre; otters float on their backs; Gloop hums.

Key lines:
- `kelp.1` "When I was a pup, the moon came down to swim in that pool at midnight. Now the water's never the right height."
- `kelp.2` "Three stones. My granny knew the order. I only remember it rhymed. Something about the middle being low."
- `kelp.3` (scene) "There she is. Hello, moon. ...Thank you, little one. Now go to bed. It's very late."

World mark: every night from 23:00 to 01:00 the Moon Pool shows the full moon's reflection at its centre with a ring
of floating lily lights; three otters float there.

Journal: open "The otters claim the moon swims. The moon is in the sky. I have pointed this out. Nobody listened." /
done "I watched. The moon swam. I have no further remarks."

<a id="side-threemills"></a>
### Threemills: ss-27 to ss-30

<a id="ss-27"></a>
#### ss-27 Your Honkship

**Owner** [Lady Honksworth](./cast.md#lady-honksworth) · **Land** Threemills (Haybury, Tumble Hill) · **Build** S-152 ·
**Unlock** `boss:honksworth` · **Reward** 35 gems · **Time** 20 min

Lady Honksworth hosts the Harvest Festival and requires a herald. Pip cannot speak, so she gives him a horn.

1. `ask` · "Lady Honksworth requires a herald" · talk; item-get key item `herald_horn` ("A brass horn. One note.
   Very loud.").
2. `announce` · "Announce Her Honkship to four households (n/4)" · at four Haybury doors, `[E] Use · Herald's horn`;
   each household answers with one line.
3. `procession` · "Lead the procession up Tumble Hill" · Honksworth follows by the parade rule past 4 wheat-sheaf posts.
4. `festival` · "Open the Harvest Festival" · `[E] Use · Herald's horn` at the top; 20 s scene.

Key lines:
- `honksworth.1` "A HERALD! Every festival needs a herald. You have a very heraldic hood. You'll do."
- `pa.1` (door) "Coming, Your Honkship! ...She knows we're coming. She knows every year. She likes the horn."
- `gander.1` (scene) "She's been practising that walk for a week. Don't tell her you could tell."
- `honksworth.2` (scene) "I declare the Harvest Festival OPEN. HONK. ...That one was for joy."

World mark: festival bunting on Tumble Hill and a banner "By Order of Her Honkship" over Haybury's lane; on any day the
Harvest Cut is played, the festival tables are out.

Journal: open "Lady Honksworth wants a herald. Pip is silent. I suggested a horn. I am a genius." / done "The
festival is open. The horn was very loud. I was standing next to it."

<a id="ss-28"></a>
#### ss-28 Scarecrow Hats

**Owner** Pa Haybury ([cast.md#the-hayburys](./cast.md#the-hayburys)) · **Land** Threemills · **Build** S-152 ·
**Unlock** `realm:threemills.visited` · **Reward** 30 gems · **Time** 20 min

Five scarecrows, five hats, one rude wind.

1. `ask` · "The scarecrows' hats blew away" · talk to Pa Haybury.
2. `hats` · "Find the five scarecrow hats (n/5)" · parallel: (a) caught on Thrift Mill's sail tip: Thistle Hook to the
   sail's hookbloom, or wait until the sail swings low (every 12 s); (b) on a lily pad in Millpond Marsh: hop across
   three pads; (c) on a Woolly Ram's horn in the hedgerows: bonk the ram and it drops the hat before it poofs;
   (d) in the tallest apple tree in Orchard Rows: Swing the trunk to shake it down; (e) on Pennywhistle, who is
   wearing two.
3. `return` · "Put each hat back on its scarecrow (n/5)" · `[E] Give · Hat` at each field scarecrow.

Key lines:
- `pa.1` "Five scarecrows, five hats, one very rude wind. The crows aren't scared of a scarecrow with no hat. Nobody is."
- `pennywhistle.1` "Two hats? Is that wrong? I thought it was twice as scary. ...Here. The blue one suits you better."
- `pa.2` (done) "There. Proper scarecrows again. Bit scruffy. Like me. Here's for your trouble."

World mark: all five field scarecrows wear their hats; a small crow perches on each hat at dawn (they are not scared).

Journal: open "Scarecrows without hats are just crows' coat-racks. A hat is everything." / done "Five hats. The crows
now sit on the hats. Pa Haybury says that counts."

<a id="ss-29"></a>
#### ss-29 The Scarecrow Who Wanted Crows

**Owner** [Pennywhistle](./cast.md#pennywhistle) · **Land** Threemills (Orchard Rows) · **Build** S-153a · **Unlock**
`met:pennywhistle` and `met:rook` · **Reward** 30 gems · **Time** 15 min

Pennywhistle woke up a hundred years ago and has wanted a crow friend ever since. Crows leave in a hurry. Rook is a
crow.

1. `ask` · "Pennywhistle is lonely" · talk.
2. `rook` · "Ask Rook to visit Pennywhistle" · talk to Rook at his current race start (any land); he agrees.
3. `sunflower` · "Find Pennywhistle a sunflower to hold" · `[E] Pick up · Sunflower` at the sunflower edge of Orchard
   Rows; `[E] Give · Sunflower`.
4. `meet` · "Introduce them at dusk" · 18:00-20:00; 20 s scene: Rook lands on Pennywhistle's arm.

Key lines:
- `pennywhistle.1` "Every crow I've ever met left in a hurry. I think it's the face. I've tried smiling. It's painted on, so."
- `rook.1` "A scarecrow wants a CROW? That's the weirdest treasure I've ever heard of. ...I'm in."
- `pennywhistle.2` (scene) "Hello. I'm Pennywhistle. I'm a scarecrow. I'm sorry."
- `rook.2` (scene) "Good perch. Terrible jokes?" / `pennywhistle.3` "The worst." / `rook.3` "Perfect."

World mark: Rook perches on Pennywhistle's arm every dusk; a crow's nest of sticks and one shiny button sits on
Pennywhistle's hat.

Journal: open "A scarecrow wants a crow. This is like a lighthouse wanting a ship. Which, now I write it, makes
sense." / done "Rook sits on Pennywhistle every evening. They tell terrible jokes. I have written some down."

<a id="ss-30"></a>
#### ss-30 Pie Rations

**Owner** Ma Haybury ([cast.md#the-hayburys](./cast.md#the-hayburys)) · **Land** Threemills · **Build** S-153b ·
**Unlock** `flag:beacon.threemills` (the sun-lamp is back and the wheat ripens) · **Reward** 30 gems · **Time** 15 min

The first pies since the sails stopped. Ma Haybury wants one in every paw on the isle, still warm.

1. `ask` · "Ma Haybury's first pies" · talk; item `pie_stack` (6 pies, shown held in the view-model).
2. `deliver` · "Deliver the pies (n/6)" · parallel, `[E] Give · Pie` to: Goody Gander at Middle Mill; Lady
   Honksworth on Tumble Hill; Pennywhistle in Orchard Rows (he holds it proudly); Pa Haybury in the wheat squares;
   the six kits on the millpond bank (one pie for six); Rook if met (else the Middle Mill miller-mouse). Rolling or a
   bonk tips the top pie off; it "goes back to the oven" (Ma has it ready again, no loss) and the count stays.
3. `dish` · "Return the pie dish to Ma Haybury" · talk.

Key lines:
- `ma.1` "Six pies. Warm ones. Don't roll, dear, pies don't roll. Well. They do. That's the trouble."
- `honksworth.1` "A pie! For me? ...I shall have two. One for me and one for my dignity."
- `ma.2` (done) "Everybody fed? Good. That's what the sun-lamp's for. Bread, pies and a full table. Here, for your legs."

World mark: a long table in Haybury's lane with the family eating together every dusk; pies steaming on six
windowsills.

Journal: open "Pies are dangerous to carry. I have studied this from the floor." / done "Six pies, six homes. Lady
Honksworth had two. I had a crumb. It was a very good crumb."

<a id="side-rootdeep"></a>
### The Rootdeep: ss-31 to ss-33

<a id="ss-31"></a>
#### ss-31 Burrowbottom Lamplight

**Owner** [Gran Burrows](./cast.md#gran-burrows) · **Land** the Rootdeep (Burrowbottom) · **Build** S-192 · **Unlock**
`flag:ch13` · **Reward** 35 gems · **Time** 20 min

Burrowbottom's twelve lamps burn on root-light; when Wenna's roots dimmed, so did the mole town.

1. `ask` · "Burrowbottom is dim" · talk to Gran Burrows.
2. `kindle` · "Light all three lamp rows (n/3)" · `[E] Kindle · Root lamp`; 8 at street height, 2 on chimney
   tops (Leaf Glider from the Lookout Root), 2 on the high root arch (Thistle Hook). The 12 lamps sit on **3 circuits**
   of 4 in a row (old root-wiring): kindling a lamp toggles it and its row neighbours (a lit lamp goes out). Row A: four
   street lamps; row B: chimney 1, street, street, chimney 2; row C: arch 1, street, street, arch 2. From all dark, each
   row is solved by kindling its **two end lamps** (the middle two light themselves), so the glide and the hook are
   still needed. Every state is solvable (1 × 4 lights-out is invertible); no reset needed. Hints: "Each lamp tugs at
   its neighbours." / "On each row, kindle only the two end lamps. If a lamp is lit already, kindling it puts it out." 
3. `report` · "Tell Gran Burrows" · talk; 15 s supper scene.

Key lines:
- `gran.1` "The roots dimmed and our lamps with them. Twelve lamps. Moles don't need much light. We do like a little."
- `gran.2` (done) "There. Burrowbottom's bright again. Digby will smell the supper from up top and pretend he came by chance."

World mark: Burrowbottom lit warm amber; a long supper table in the main tunnel with the moles at it every evening.

Journal: open "A town of moles in the dark. They say they do not mind. They have lamps. They mind." / done "Twelve
lamps. The moles had supper. Gran Burrows says I am 'a very loud owl'. Fair."

<a id="ss-32"></a>
#### ss-32 Lumbra's Itch

**Owner** [Lumbra the Long](./cast.md#lumbra-the-long) · **Land** the Rootdeep (Glowcap Forest) · **Build** S-192 ·
**Unlock** `boss:lumbra` · **Reward** 35 gems · **Time** 15 min

Four stones are stuck between Lumbra's rings and he has no arms.

1. `ask` · "Lumbra has an itch" · talk at the Glowcap root-gate (where he ferries).
2. `stones` · "Dig out the four stones in Lumbra's rings (n/4)" · Lumbra lies along the Glowcap tunnel (14 m); four
   soft-earth mounds on his back; `[E] Dig · Soft earth` (Digging Paws) at each.
3. `scratch` · "Scratch the last itch" · one gentle Swing at the itchy ring near his head (it glows pink); Swing does
   no damage to friendly NPCs.

Key lines:
- `lumbra.1` "Four stones. Stuck between my rings. I can't reach. I have no arms. This is the trouble with being a worm."
- `lumbra.2` (done) "Ohhhh. Oh, that's the spot. ...Thank you. A hundred years of root-keeping and nobody ever scratched."

World mark: Lumbra naps curled in the Underlake shallows between ferry trips; a contented sigh plays every 30 s within
20 m; the four stones are stacked by the tunnel into a tiny cairn.

Journal: open "Earthworms itch. This has not been studied. I shall study it. From a distance." / done "Lumbra is
scratched. He sighed for an hour. I timed it."

<a id="ss-33"></a>
#### ss-33 Gran's Pouch

**Owner** [Gran Burrows](./cast.md#gran-burrows) · **Land** the Rootdeep (Burrowbottom, Glowcap Forest) · **Build**
S-193 · **Unlock** `quest:ss-01>=3` (For Spring part 1 done) and `flag:ch13` · **Reward** 30 gems · **Time** 15 min

Gran Burrows stitched the "For Spring" pouch when Digby went up top. She'll stitch a new one if Pip finds what goes in
it.

1. `show` · "Show Gran Burrows the 'For Spring' pouch" · talk (the LOCKED keepsake is in the Keepsake Hollow; talking
   is enough).
2. `seeds` · "Gather three root-blossom seeds (n/3)" · three glowing seeds in Glowcap Forest, visible only in Lantern
   light; `[E] Pick up · Root-blossom seed`.
3. `stitch` · "Gran stitches a new pouch" · talk; item-get key item `pouch_spring2` ("For Spring (and Summer)").
   This opens [ss-01](#ss-01) step 4.

Key lines:
- `gran.1` "That's my stitching! Made it for Digby when he went up top. I told him: plant something you can smell."
- `gran.2` "Root-blossom seeds. They glow, and they smell of honey. He'll know them by the honey. That's the point."
- `gran.3` (done) "'For Spring (and Summer).' I added summer. He'll want summer next. He always wants the next thing."

World mark: Gran's sewing chair by her door with a lit lamp and, on the wall, a framed root-bark picture of Digby in
his first helmet.

Journal: open "Gran Burrows recognised the pouch at once. Mothers and grandmothers always do." / done "A new pouch.
Summer added. Gran says Digby 'wants the next thing'. So do I. It is called curiosity."

<a id="side-glassway"></a>
### The Glassway: ss-34 to ss-37

<a id="ss-34"></a>
#### ss-34 Return to Sender

**Owner** [Postmistress Pell](./cast.md#postmistress-pell) · **Land** the Glassway (Puffin Post) and the 11
destinations below · **Build** S-215 · **Unlock** `flag:ch14` · **Reward** 5 gems per letter delivered (55) ·
**Time** 25 min (beyond finding the bottles)

Every Bottle Chain letter (texts in [lore.md#bottles](./lore.md#bottles)) goes to the lighthouse shelf when found. Pell
says every letter deserves to arrive somewhere: she copies each one, and Pip carries the copy to the place the letter
talks about, where a little letterbox appears.

1. `ask` · "Pell wants every letter delivered" · talk at Puffin Post with at least one bottle found.
2. `deliver` · "Deliver the bottle letters (n/11)" · for each found bottle, Pell gives key item `letter_copy_<n>`;
   `[E] Give · Letter` at its destination's letterbox spot (a 0.9 m post that appears when the copy is in hand):

| Bottle | Destination (each letter's text names its place) |
|---|---|
| 1 (oldest) | the Summit Crystal Cairn (home) |
| 2 | Grumble's Crown (home) |
| 3 | Pinch's Lighthouse door (home) |
| 4 | the Meadow Windmill (home) |
| 5 | the well (home) |
| 6 | the pedestal (home) |
| 7 | the Lamplighters' Tower foot (Duskwick) |
| 8 | the Whistling Pine (Pinewhistle) |
| 9 | the Great Arch (Archwater) |
| 10 | Tansy Mill (Threemills) |
| 11 | the Academy bell tower (Saltglass Flats) |
| 12 (the shipped one, Shellby's) | already delivered: "It found you. That's delivery." |

Key lines:
- `pell.1` "Every letter deserves to arrive. Even ones addressed 'to whoever'. Whoever is somewhere. Usually."
- `pell.2` (each delivery, cycles through 3) "Delivered ✿ Stamp?" / "Delivered! I'll mark the ledger." / "Another one home."
- `pell.3` (11) "Eleven letters, eleven letterboxes. A thousand years of post, delivered. I need a sit down."

World mark: a small painted letterbox at each destination with the letter's year carved on it; Pell's ledger at
Puffin Post shows a gold star per delivery.

Journal: open "Pell delivers letters to places that cannot read. I asked why. She said, 'Manners.'" / done "Eleven
letterboxes across the Wide Blue. I have started writing to them. No replies yet."

<a id="ss-35"></a>
#### ss-35 The Collector

**Owner** [Mr Whelk](./cast.md#mr-whelk) · **Land** the Glassway (islets), home (Captain Pinch's Cove) · **Build**
S-215 · **Unlock** `flag:ch14` · **Reward** 35 gems · **Time** 20 min

Mr Whelk, a hermit crab, has outgrown his shell and will trade his whole rare-shell list for a bigger one.

1. `ask` · "Mr Whelk has outgrown his shell" · talk at his shell stall on Puffin Post's boardwalk.
2. `shells` · "Find six rare shells (n/6)" · `[E] Pick up · Rare shell`: the **spiral conch** (Gull Rock), **glass
   cowrie** (a Sandbars bar, low tide only), **moon scallop** (the Snoozing Whale islet, night), **bell whelk** (Bell
   Shallows islet), **star limpet** (Wreck Reach, on the second wreck's keel), **sunset tellin** (Puffin Post's own
   beach at 18:00-20:00, when it glows). The **cowrie** and the **limpet** are not lying there: a Gullgrab with the
   shell in its beak circles each spot (it has taken a fancy to it); bonk it and it drops the shell, which lands as the
   pickup. A Gullgrab that flies off comes back to circle the spot on the next visit.
3. `trade` · "Ask around for a big empty shell" · Mr Whelk sends Pip home: Captain Pinch moulted, long ago.
4. `pinch` · "Fetch Captain Pinch's old shell" · talk to Pinch; key item `pinch_old_shell`.
5. `move` · "Bring the shell to Mr Whelk" · 10 s scene: he moves in.

Key lines:
- `whelk.1` "Too small. Pinches at the elbows. I'll trade my whole collection for a roomier home. Rare shells only."
- `pinch.1` "Me old shell? Aye, I outgrew it the year I got me hat. It's in the cove. Take it, lad. It's had a good life."
- `whelk.2` (done) "Roomy! Red! A lighthouse painted on the side! ...Is that a crab's name inside? 'Pinch, age 6.' Charming."

World mark: Mr Whelk lives in Pinch's old red shell (with a child's painted lighthouse on it); his stall displays the
six rare shells under glass.

Journal: open "A hermit crab seeks a home. Rare shells are the price. I offered him my hat. Declined." / done "He
lives in Captain Pinch's childhood shell. Pinch wrote his name inside it, age six. Pinch denies this."

<a id="ss-36"></a>
#### ss-36 The Merry Mabel

**Owner** [Captain Pinch](./cast.md#catchers) · **Land** home → the Glassway (Wreck Reach; dungeon o3,
[dungeons.md#o3](./dungeons.md#o3)) · **Build** S-216 · **Unlock** `flag:ch14` and `ability:hook` · **Reward** 40
gems · **Time** 15 min (plus the dungeon and Bosun Snore)

The *Merry Mabel* was Pinch's first ship as a young crab. She went down in the Storm a hundred years ago with nobody
aboard; the Last Big Storm two summers ago rolled the wreck into Wreck Reach, where Bosun Snore has been asleep on her
deck ever since.

1. `ask` · "Captain Pinch remembers the *Merry Mabel*" · talk to Pinch (plaza edge in the evening, or his cove).
2. `wreck` · "Explore the *Merry Mabel*" · `[E] Enter · the Merry Mabel` at Wreck Reach.
3. `bosun` · "Calm Bosun Snore" · ([creatures.md#boss-bosun-snore](./creatures.md#boss-bosun-snore)); the ship's bell
   drops into Pip's hands (key item `mabel_bell`).
4. `bell` · "Bring the *Merry Mabel*'s bell to Captain Pinch" · `[E] Give · Ship's bell` at the lighthouse door.

Key lines:
- `pinch.1` "The *Merry Mabel*. Me first ship. Went down in the great storm, a hundred year back. Nobody aboard, mind."
- `pinch.2` "Her bell's still down there, I'd wager. A skipper misses his bell more than his boat. Don't ask me why."
- `pinch.3` (done) "Belay that... there's salt in me eye. Aye. Aye, that's her. Thank ye, lad. She'll ring at dusk."

World mark: the *Merry Mabel*'s bell hangs on the lighthouse gallery and rings three times at 19:00 every day (heard
across the Shores); Bosun Snore dozes on the Glassway's Gull Rock afterwards.

Journal: open "A crab had a ship. The ship had a bell. The bell is under the sea. I see a pattern." / done "The bell
rings at dusk. Pinch claims the salt is from the sea air. Pinch lives at the beach. Interesting."

<a id="ss-37"></a>
#### ss-37 The Whale Who Rolls Over

**Owner** the Snoozing Whale (an islet that is a sleeping whale; [cast.md#the-snoozing-whale](./cast.md#the-snoozing-whale))
· **Land** the Glassway · **Build** S-216 · **Unlock** `flag:ch14` and `ability:tidebell` · **Reward** 35 gems ·
**Time** 20 min

The whale has slept on her left side for a hundred years and has pins and needles. She would roll over, but three gull
families nest on her back.

1. `listen` · "The Snoozing Whale talks in her sleep" · `[E] Talk · the Snoozing Whale` at her blowhole stone.
2. `nests` · "Move the three gull nests to Gull Rock (n/3)" · each nest is a carried item (held in the view-model;
   rolling sets it down safely where Pip stands, then `[E] Pick up · Nest` again); `[E] Place · Nest` on Gull Rock's
   three ledges. The gulls are friendly seabirds, not Gullgrabs.
3. `tide` · "Raise the tide at the whale's tide stone" · `[E] Ring · Tide stone`.
4. `roll` · "Watch the whale roll over" · 12 s scene: the islet rolls (a post-pass state swap of the islet's two
   prop sets and its collider set, by flag `ss37.rolled`).

Key lines:
- `whale.1` "Mmmm... pins and needles... left fin... can't roll... birds... mmm."
- `whale.2` (done) "Ahhhh. ...Much better. Goodnight, little one. Wake me in another hundred years. Or don't."

World mark: the islet is now right-side-up: a new beach and a sheltered cove where the story's 35-gem reward waits
as a gem bag (`[E] Open · Gem bag`); no chest or fish spot is added (those counts are fixed); the gulls wheel over Gull
Rock.

Journal: open "An island is a whale. The whale is asleep. The whale has pins and needles. All three facts are new." /
done "The whale rolled over. I felt the wave from Puffin Post. Pell's stamps blew away. Worth it."

<a id="side-kettle"></a>
### Kettle Isle: ss-38 to ss-41

<a id="ss-38"></a>
#### ss-38 Starsteel

**Owner** [Master Scoria](./cast.md#master-scoria) · **Land** Kettle Isle (Forgefall, Ash Beach, the Spout) ·
**Build** S-233 (save v11) · **Unlock** `flag:stone.kettle` · **Reward** the **Starsteel Sword** (`swordLevel` 3:
damage 3/3/4, reach 2.2 m; cuts **thornglass**); forging costs **600 gems** (a CANON §10.4 sink) · **Time** 20 min

Scoria forged every sword Miso sells and never one for a hero. Starsteel is star-metal that fell in the Storm.

1. `ask` · "Master Scoria's offer" · talk at the forge.
2. `shards` · "Find three starsteel shards (n/3)" · parallel: (a) buried on Ash Beach, a soft-earth mound with a
   blue sparkle (`[E] Dig · Soft earth`); (b) stuck high on the Spout's rim: Ember Sling hits it and it drops;
   (c) in the Kettle's Belly's "starsteel" chest (one of its dungeon chests, contents reassigned by
   [dungeons.md#d8](./dungeons.md#d8)).
3. `pay` · "Pay for the forging (600 gems)" · talk; the shop-style confirm reuses the shop UI ("Not enough gems,
   little sprout." style refusal from Scoria: "Six hundred. For the coal. Come back when you've the coal.").
4. `forge` · "Watch the Starsteel Sword forged" · 25 s scene: hammer rhythm (music cue), Pitch on the bellows;
   item-get "The Starsteel Sword! Cuts thornglass, reaches further, hums a little."

Key lines:
- `scoria.1` "I forged every sword Miso sells. Never forged one for a hero. Bring me starsteel and I'll put that right."
- `scoria.2` "Six hundred gems. For the coal. I'd do it for free, but the coal won't."
- `scoria.3` (done) "There. Starsteel. It'll cut thornglass and it'll hum when it's happy. Mind you keep it happy."
- `miso.1` (home, after) "Mrrow~ Is that a Scoria? A STARSTEEL Scoria? ...I'm not jealous. I'm a shopkeeper. It's different~"

World mark: the sword in the view-model takes the Starsteel look (a material tint and an emissive edge on the sword
mesh only; `hero.glb` is untouched, [art-audio.md#hood-trims](./art-audio.md#hood-trims) for the tint rule); Scoria's
forge displays the empty starsteel mould on its wall.

Journal: open "Scoria will forge a star-sword for six hundred gems. I asked for a star-pencil. He said no." / done
"The Starsteel Sword hums. Scoria says it is happy. I say it is resonance. We are both right."

<a id="ss-39"></a>
#### ss-39 Pitch Wants a Star

**Owner** [Pitch](./cast.md#pitch) · **Land** Kettle Isle (Forgefall) · **Build** S-236a (steps 1-3); step 4's star
splinter is handed over in ch21 ([story.md#ch21](./story.md#ch21)), so S-236a builds step 4 as data gated on
`flag:mainEnding` · **Unlock** `realm:kettle.visited` · **Reward** 40 gems · **Time** 15 min

Pitch, Scoria's little newt apprentice, wants to forge "a star, a real one".

1. `ask` · "Pitch wants to forge a star" · talk.
2. `hot` · "Bring Pitch the hottest things on the isle (n/2)" · an ember from the Kettle's rim (`[E] Pick up ·
   Ember`, carried in a clay pot) and a bath pebble from Lady Fumarole (talk to her after she is calmed; before
   that, Soakley has a spare).
3. `try` · "Watch Pitch try" · 12 s scene: the "star" comes out as a glowing lump. Pitch asks Pip to bring a real bit
   of star one day; Pip nods (Pip's nod is shown as a small camera dip). Sets `ss39.promise`.
4. `splinter` · "Bring Pitch a star splinter" · after `flag:mainEnding` (the splinter is key item `star_splinter`
   from ch21); `[E] Give · Star splinter`; 15 s scene.

Key lines:
- `pitch.1` "A star! A real one! Scoria says you can't forge a star. Scoria's never TRIED."
- `pitch.2` (try) "It's... a potato. A glowing potato. ...You'll bring me a real bit of star one day? Nod if yes. ...You nodded!"
- `pitch.3` (done) "A star. A real one. In my hands. I'm going to need a bigger anvil. And a hat. A star-forging hat."

World mark: a tiny forged star pendant hangs over Forgefall's gate and glows gold at night; the "glowing potato"
sits on Scoria's shelf with a label "Pitch's first star".

Journal: open "Pitch intends to forge a star. Stars are not forged. I have not said so. Pitch is very determined." /
done "Pitch forged a star. I have revised several papers."

<a id="ss-40"></a>
#### ss-40 Soakley's Baths

**Owner** [Soakley](./cast.md#soakley) · **Land** Kettle Isle (Bathhouse Terraces) · **Build** S-236b · **Unlock**
`ability:sling` · **Reward** 35 gems · **Time** 20 min

Since the Kettle started grumbling, the five baths run cold, scalding, cold, scalding and lukewarm.

1. `ask` · "Soakley's baths are all wrong" · talk.
2. `baths` · "Set all five baths to just right" · each bath has a frog-shaped gauge (blue cold / green right / red
   hot), a valve (Swing to turn: open, half, shut) and a brazier (Ember Sling lights it; Swing on the bell-cap puts it
   out). Baths 2 and 3 share a pipe: bath 2's valve also feeds bath 3. Solution: **1** brazier lit, valve half;
   **2** brazier out, valve shut; **3** brazier lit, valve open; **4** brazier out, valve half; **5** brazier lit,
   valve half. A gauge turns green within 2 s of a right setting.
3. `soak` · "Sit in a bath" · `[E] Sit · Bath`; 10 s: steam fills the view, the music softens, hearts refill.

Key lines:
- `soakley.1` "Cold, scalding, cold, scalding, lukewarm. Lukewarm is the worst. Nobody complains about lukewarm. That's how you know."
- `soakley.2` (done) "There. Now you know what calm is for. It's for baths."

World mark: steam rises from all five baths; capybaras and a visiting Wickling or two soak in them all day; sitting
in any bath refills hearts once per visit (a free full heal, the same as Wenna's wake point; it is not an economy
source).

Journal: open "Five baths, five temperatures, none of them right. Soakley is unbothered. Soakley is always
unbothered." / done "The baths are right. I sat in one. I took no notes. This is a first."

<a id="ss-41"></a>
#### ss-41 Miso's Supplier

**Owner** [Miso](./cast.md#miso) · **Land** home → Kettle Isle (Forgefall) · **Build** S-237 · **Unlock**
`realm:kettle.visited` and `quest:ss-03>=3` (Nothing Is Refundable part 1 done) · **Reward** 30 gems · **Time** 15 min

Twenty years Miso has sold Scoria's swords and never met the bear. Kinako always said he was "very busy".

1. `ask` · "Miso wants to meet her supplier" · talk at the shop.
2. `sail` · "Sail Miso to Kettle Isle" · Miso aboard (her counter shows a sign "Back soon~").
3. `meet` · "Introduce Miso to Master Scoria" · walk her to the forge (she follows by the parade rule); 20 s scene.

Key lines:
- `miso.1` "Twenty years I've sold Scoria's swords and never met the bear~ Kinako always says he's 'very busy'. Mrrow."
- `scoria.1` "Your brother? Pays me full price. Sells to you at cost. Has done for twenty years. Told me not to tell. I'm terrible at not telling."
- `miso.2` "...At cost? Twenty years? ...That silly cat~ That silly, silly cat~"

World mark: Miso's counter gets a small stamped card "Forged at Forgefall ✿"; Scoria's forge wall shows a framed
receipt, "Sword no. 1, sold to Miso, twenty years ago". This opens [ss-03](#ss-03) part 2.

Journal: open "Miso has never met her supplier. I have never met my publisher. We have bonded." / done "Kinako sold
her swords at cost for twenty years. Miso said 'silly cat' nine times. I counted fondly."

<a id="side-saltglass"></a>
### Saltglass Flats: ss-42 to ss-44

<a id="ss-42"></a>
#### ss-42 Sable's Dig

**Owner** [Sable](./cast.md#sable) · **Land** Saltglass Flats (Sablecamp, the Glass Dunes, Academy Hill) · **Build**
S-258 · **Unlock** `realm:saltglass.visited` and `ability:mitts` · **Reward** 35 gems · **Time** 20 min

Sable, a jerboa archaeologist, brushes instead of digs. She has six marked dig sites and very strong opinions.

1. `ask` · "Sable has found a pot (probably)" · talk.
2. `brush` · "Brush the six dig sites (n/6)" · `[E] Dig · Dig site` with a **hold** of 2 s (a gentle brush: the Paws
   variant); letting go keeps progress. Finds: a chalk slate, a student's lamp, a bell clapper (not the stone), a lunch
   tin, a moth-wing quill, a spiral floor tile.
3. `show` · "Show Sable the finds" · talk; she labels each wrongly; if `flag:stone.academy`, Tutor Scarabelle adds a
   correction line per find.

Key lines:
- `sable.1` "A POT! Lamplighter! Probably! Possibly a hat! Brush, don't dig. Digging is for moles. No offence to moles."
- `sable.2` (lunch tin) "A ceremonial vessel for... sacred sandwiches!" / `scarabelle.1` "It is a lunch tin. It was Glim's. He never finished his crusts."
- `sable.3` (done) "Six finds! A museum! Well. A tent. A museum-shaped tent."

World mark: a display tent at Sablecamp with the six finds on stands, each with Sable's label and, if corrected,
Scarabelle's sticky note underneath.

Journal: open "Sable brushes sand off old things. I brush crumbs off old papers. Kindred spirits." / done "Six finds.
Sable's labels are wrong. Scarabelle's notes are right. I have adopted Sable's."

<a id="ss-43"></a>
#### ss-43 Roll Call

**Owner** [Tutor Scarabelle](./cast.md#tutor-scarabelle) · **Land** Saltglass Flats (the Buried Academy, Academy
Hill) · **Build** S-258 · **Unlock** `flag:stone.academy` · **Reward** 35 gems · **Time** 20 min

Scarabelle calls the roll every dawn. Nobody has answered in a hundred years. The nine student nameplates are
scattered through the Academy.

1. `ask` · "Tutor Scarabelle calls the roll" · talk at dawn (05:00-08:00) or any time after the first visit.
2. `plates` · "Find the nine student nameplates (n/9)" · `[E] Pick up · Nameplate`: four in the Buried Academy's
   cleared rooms (open after the exam), three on Academy Hill under sand drifts (`[E] Dig · Dig site` hold), two behind
   ivy lattices (Ivy Gloves).
3. `hang` · "Hang the nameplates on the classroom hooks" · `[E] Place · Nameplate` × 9.
4. `roll` · "Answer the roll for two old students" · next dawn scene: Scarabelle reads all nine; at "Wick" and
   "Pelagia" Pip rings the roll bell (`[E] Ring · Roll bell`).

The nine nameplates (`side.ss43.plate.<n>`): "Wick, first year, lamps" · "Pelagia, first year, bells (late)" ·
"Tallow, second year, wicks" · "Glim, second year, crusts" · "Lanthorn, third year, mirrors" · "Brightfern, third
year, songs" · "Quill, first year, logbook" · "Ashwing, second year, beacons" · "Nettle, first year, stairs".

Key lines:
- `scarabelle.1` "Roll call. Nobody has answered in a hundred years. I call it anyway. A school is a school."
- `scarabelle.2` (roll) "Wick? ...Present. Pelagia? ...Present. Well. That's two. Two is a class."
- `wick.1` (Duskwick, after) "She still calls the roll? Tell her I'm present. Tell her I did my homework. I didn't."

World mark: nine nameplates on the classroom hooks; the roll bell rings at dawn across Academy Hill; Granny Wick and
Pelagia each gain one line about school.

Journal: open "A beetle calls a roll nobody answers. I would answer. I was never asked." / done "Two answered,
through Pip. Scarabelle marked them present. She marked me 'visiting'. I accept."

<a id="ss-44"></a>
#### ss-44 The Exam Retake

**Owner** [Tutor Scarabelle](./cast.md#tutor-scarabelle) · **Land** Saltglass Flats (the Academy library) · **Build**
S-259 · **Unlock** `flag:stone.academy` · **Reward** 35 gems and the gift `nook_gift_certificate` · **Time** 15 min

A quiz whose answers are gossip the player has heard. Always passable.

1. `ask` · "Scarabelle offers a retake" · talk.
2. `quiz` · "Answer ten questions" · ten questions drawn from the bank below, only from rows whose `heard` condition
   holds (the `seen:` flag of the line that told it); if fewer than ten qualify, the free rows (marked "free", whose
   answer is in the question) fill the rest. Three options per question, shuffled. A wrong answer shows the
   correction and the same question again; the quiz cannot be failed.
3. `grade` · "Collect your certificate" · talk; item-get gift "Certificate of Lamplighting (Honorary)".

| # | Question | Answer | Wrong options | Heard |
|---|---|---|---|---|
| 1 | What does Miso say is never refundable? | Anything on the counter | Swords only; Potions after noon | Miso's first line (LOCKED) |
| 2 | Why did Grumble Shroom keep the Woods Starseed? | The little ones were scared of the dark | His hat was too small; He liked the colour | Grumble's handover |
| 3 | What does Frostbun say seeds catch? | Cold | Fleas; Feelings | Frostbun's handover |
| 4 | Whose boat was still out past the reef? | Nell Pelliwick's | Ribbit's; Kinako's | Pinch's handover |
| 5 | What is the Mayor afraid of? | Deep water | Ducks; Hats | `ss-04` or Ribbit's jetty line |
| 6 | What does Granny Wick say light is for? | Passing on | Keeping; Reading | Granny Wick, ch8 |
| 7 | How many socks does Old Gloop wear? | Eight | Six; Seventy | Gloop's first line |
| 8 | What did Mossmantle do for nine days? | Hummed the pine's song | Slept; Counted acorns | Mossmantle's handover |
| 9 | Who flapped the mill sails by hand? | Lady Honksworth | Goody Gander; Pa Haybury | Honksworth's handover |
| 10 | What does Dormy want to stay up to see? | A little light on the sky isle | The sunrise; A comet | `ss-02` |
| 11 | What did the bottle say to keep handy? | A hanky | A lantern; A snack | the shipped bottle (LOCKED) |
| 12 | Who wrote "For Spring" on the pouch? | Gran Burrows | Digby; Hazel | `ss-33` |
| 13 | What did Kinako collect from every isle? | The same spoon | Rare shells; Stamps | `ss-18` |
| 14 | What does Lumbra lack, for scratching? | Arms | Patience; Glasses | `ss-32` |
| 15 | What did Pitch's first star look like? | A potato | A star; A spoon | `ss-39` |
| 16 | How many letters did Pell deliver? | Eleven | Twelve; Three | `ss-34` |
| 17 | What colour is the Woods Starseed? (free: "It's leaf-green.") | Green | Blue; Pink | free |
| 18 | Where does Pip wake when he gets dizzy? (free: "By the Great Tree, as everyone knows.") | By the Great Tree | In a bath; On the Raft | free |
| 19 | What does the village sign say the population is? (free: "Cozy, it says.") | Cozy | Seven; Busy | free |
| 20 | Who runs Puffin Post? (free: "The puffin, naturally.") | Postmistress Pell | Mr Whelk; Rook | free |

Key lines:
- `scarabelle.1` "Everyone deserves a second exam. Most people deserve a third. Sit. Pencils are optional; you haven't got one."
- `scarabelle.2` (grade) "I grade on effort. Yours was visible. A-plus. The 'plus' is for listening to people."

World mark: the certificate hangs on Pip's Nook wall; the Academy library's slate board shows "RETAKE: PASSED ✿".

Journal: open "Scarabelle sets an exam on gossip. I have been preparing my whole life." / done "Pip passed. The
exam was about listening. I would have failed. I talk."

<a id="side-sky"></a>
### The sky and Moonmere: ss-45 to ss-48

<a id="ss-45"></a>
#### ss-45 Mote's Tally

**Owner** none present: Mote's own wall speaks for him ([cast.md#mote](./cast.md#mote)); the journal credits "Mote"
· **Land** Driftholm (Mote's Meadow, the Tally Wall) · **Build** S-267 · **Unlock** `realm:driftholm.visited` ·
**Reward** 30 gems (Hoot pays, for the copy) · **Time** 15 min

A hundred years of marks, one per day; every tenth mark has a note scratched beside it. Twelve readable patches are
spaced along the 40 m wall. Reading them is how the player meets Mote's case in his own place (tone rule 5).

1. `read` · "Read the notes on the Tally Wall (n/12)" · `[E] Read · Tally marks` at 12 patches.
2. `mark` · "Add a mark of your own" · `[E] Touch · Tally Wall` at the wall's end: Pip scratches a little two-leaf
   sprout.
3. `copy` · "Tell Hoot about the wall" · talk to Hoot (home or Pinewhistle).

The twelve notes (`side.ss45.note.<n>`, in Mote's voice):
1. "Day 1. Missed the step. Only by a little. Will try again tomorrow."
2. "Day 10. The clouds here are very soft. I have named one. It does not answer to it."
3. "Day 100. Lit a firefly lamp. She'll see it. She's very good at seeing."
4. "Day 365. A whole year. I counted her lights from up here: four thousand and some. She's doing all right without me. Hmph."
5. "Day 1,000. Made a hat out of a cloud. It left."
6. "Day 3,650: talked to a cloud. It didn't answer."
7. "Day 5,000. Caught the moon on a puddle. Kept it in a jar. It was gone by morning. Fair enough."
8. "Day 10,000. I think the old stair is still down there. I can hear it hum on still nights."
9. "Day 18,250. Fifty years. I made the lamps into a little town. The lamps and I are the whole town."
10. "Day 25,000. She looks tired. She looks so tired. Somebody should take her home."
11. "Day 36,000. Nearly a hundred. I've gathered enough little lights to make one big one. Almost."
12. "Day 36,500. She bloomed. Brightest thing I've ever seen. Too bright. She's burning out. I have to be quick."

Key line:
- `hoot.1` "Every day for a hundred years? ...That is not a thief's handwriting, Pip. That is a very lonely scholar's."

World mark: Pip's sprout mark stays at the end of the wall (and appears there in the Hundred-Year Night's Driftholm
glimpse if story.md uses it); the Lore tab gains "Mote's Tally".

Journal: open "A wall of marks. I have counted some. I stopped at four hundred. Somebody did not stop." / done "Thirty-
six thousand five hundred marks. Pip added one. I copied twelve notes. I have not felt like writing a joke here."

<a id="ss-46"></a>
#### ss-46 Nimble Herding

**Owner** Old Puffwick (the eldest Nimble; [cast.md#the-nimbles](./cast.md#the-nimbles)) · **Land** Driftholm
(Nimble Downs and islets) · **Build** S-267 · **Unlock** `ability:cloudstep` · **Reward** 35 gems · **Time** 20 min

A gust scattered eight young Nimbles across Driftholm's islets.

1. `ask` · "The Nimbles have drifted" · talk.
2. `herd` · "Herd the drifted Nimbles home (n/8)" · a Nimble drifts away from Pip at 1.5 m/s when he walks within
   3 m, in the direction Pip is facing; it bounces off ledges and never falls (clouds bounce it back). Four are on the
   main isle, four on islets reached by Cloudstep; a Nimble on an islet floats across a gap only when nudged toward a
   cloud mote line. Each counts when it enters the fold (a ring of 10 cloud fence-posts on Nimble Downs).
3. `count` · "Let Old Puffwick count them" · talk.

Key lines:
- `puffwick.1` "Wind came. We went. Some of us went further. Fetch them? Walk at them. They don't like being walked at. That's the trick."
- `puffwick.2` (done) "Eight! All fluffed. Here, they want to thank you. They'll be very bouncy about it."

World mark: the Nimbles settle in the fold and form four soft cloud mounds on Nimble Downs that bounce Pip 4 m up
(new traversal shortcuts to two Driftholm ledges, listed in [atlas-far.md#driftholm](./atlas-far.md#driftholm)).

Journal: open "Clouds that are animals. Animals that are clouds. I have stopped asking which." / done "The Nimbles
are home and bouncy. I bounced. Undignified. Excellent."

<a id="ss-47"></a>
#### ss-47 Letters Never Sent

**Owner** none present: Mote's letters ([lore.md#mote-letters](./lore.md#mote-letters)); journal credits "Mote" ·
**Land** Moonmere (the Mirror Garden, the Moon Tree) · **Build** S-219 · **Unlock** `flag:stone:bell` (step 0 points the way) ·
**Reward** 30 gems (found tucked in the last letter, "for the post") · **Time** 20 min

Moonmere is the home isle as Mote imagined it from the sky. He wrote twelve letters to his sister and never sent
them; each sits folded inside one of the twelve moon-lanterns.

0. `moonpath` · "Walk the moonpath" · done on `realm:moonmere.visited`. Hints: nudge "The moon lays a path for those who call." / answer "At night, stand at the end of Nell's Jetty and play the Calling (mid, high, mid) with {tool}."
1. `garden` · "Find the Mirror Garden" · walk in (the garden is the Moonmere POI behind the Moon Tree).
2. `letters` · "Read the twelve unsent letters (n/12)" · `[E] Kindle · Moon-lantern` at each of the 12 moon-lanterns
   (Lantern needed); the lantern opens and `[E] Read · Letter` shows the text.
3. `tree` · "Sit under the Moon Tree" · `[E] Sit · Moon Tree` after all twelve; 15 s: the silver leaves chime; a
   single star crosses Moonmere's sky.

Key line (journal only; Mote is never met here):
- `hoot.1` (journal) "Twelve letters to his sister, all unsent. I have written many unsent letters. Mine were to publishers. His are better."

Signposts (Moonmere is the core of Mote's case, tone rule 5, so three things point at it; all built in S-219):
1. **Pelagia**, a third stone-give line after line 2 of `stone-give-bell` ([story.md#ch15-17](./story.md#ch15-17)):
   "On a still night, play the Calling at the end of a jetty. The moon lays a path for those who call. Someone up there walks it." She repeats it as her talk line while `flag:stone:bell` and `!realm:moonmere.visited`.
2. **Nell**, at her jetty each night (21:00-04:59) while `flag:stone:bell` and `!realm:moonmere.visited`:
   "Moon's on the water tonight. Lamplighters used to sing to it from here."
3. **Step 0** above: the quest shows in Field Notes as soon as `stone:bell` is set, with its Ask-the-Tree hints.

World mark: the 12 moon-lanterns stay lit in Moonmere; at home, a silver lantern buoy glows each night at the start of
the moonpath off Nell's Jetty.

Journal: open "Moonmere is the isle, reflected, by someone who missed it. I do not know how I know that. I know
it." / done "Twelve letters. I shall not quote them. Some things are not for Field Notes."

<a id="ss-48"></a>
#### ss-48 The Little Star

**Owner** [the Twinklings](./cast.md#the-twinklings) · **Land** the Starmeadow → Driftholm → home · **Build** S-291 ·
**Unlock** `flag:mainEnding` · **Reward** 35 gems · **Time** 20 min

There were four Twinklings. The littlest, the Little Star, is shy of the ground and hides.

1. `ask` · "The Twinklings are one short" · talk to the three at Brightwell's Rest.
2. `seek` · "Find the Little Star (n/4)" · she hides in four places in turn and flees to the next when found (a 2 s
   streak of light Pip can follow by eye): a constellation bridge's far end (Starmeadow) → a scrap lamp in Mote's
   shelter (Driftholm) → the sky nook above the Cairn (home, Cloudstep;
   [atlas-home.md#sky-nook](./atlas-home.md#sky-nook)) → Pip's Nook, in the window.
3. `stay` · "Let the Little Star choose" · in the Nook, `[E] Talk · the Little Star`; she stays.

Key lines:
- `twinkling.1` "There were four of us. The littlest hides. She's shy of the ground. The ground is very... down."
- `star.1` (Nook) "...It's warm here. It smells like bread and moss. Can I stay? I'll be very small. I'm good at small."

World mark: the Little Star floats in Pip's Nook as a soft night-light (a point light, radius 4 m, warm gold, at night
only; part of the Nook's light budget, [§8](#nook)); at night she drifts to Pip's window when he is within 10 m.

Journal: open "A shy star. Stars are not shy. I have been wrong about stars all game." / done "She chose Pip's Nook.
I would too. It has the best moss."

<a id="side-across"></a>
### Across lands: ss-49

<a id="ss-49"></a>
#### ss-49 Rook's Races

**Owner** [Rook](./cast.md#rook) · **Land** Pinewhistle, Archwater, Threemills, Kettle Isle, Saltglass Flats ·
**Build** S-113 (part 1 and the race framework), S-133 (part 2), S-154 (part 3), S-234 (part 4), S-255 (part 5) ·
**Unlock** `realm:pinewhistle.visited` (part 1; each later part unlocks when its land is visited and the previous part
is won) · **Reward** 8 gems per race won (40) and Rook's feather (gift `nook_gift_feather`) after part 5 · **Time**
35 min

Rook, a young crow treasure-hunter, races Pip to each land's best "treasure". He flies a fixed spline (a ghost:
no collisions); Pip runs. Rook's time is the scripted careful-bot time × **1.15**, so a player who sprints, rolls and
uses the land's tool well wins. Losing costs nothing; Rook offers a rematch at once.

| Part | Land | Start → finish | Route length | Tools on the best line | Rook's line at the finish (if Pip wins) |
|---|---|---|---|---|---|
| 1 | Pinewhistle | Acornet Hollow plaza → the Whistling Pine's knot-hole platform | about 380 m | Leaf Glider over two ravines | "You glided! Nobody said you could glide! ...Fine. Finders keepers. You found it first." |
| 2 | Archwater | the Raft → the Moon Pool's arch stair | about 420 m | Tide Bell (lower the flats) | "You made the SEA move. That's cheating. ...That's brilliant. It's cheating." |
| 3 | Threemills | Haybury lane → Tansy Mill's cap | about 450 m | Thistle Hook to the mill cap | "You hooked a WINDMILL. I'm writing that down. In my 'unfair' book." |
| 4 | Kettle Isle | Forgefall gate → the Kettle's rim | about 500 m | Leaf Glider on steam vents | "Steam vents?! I was going to use those! ...I was going to think of using those." |
| 5 | Saltglass Flats | Sablecamp → the Academy bell tower top | about 520 m | Ivy Gloves up the tower | "Five for five. ...You're the best treasure-hunter on the Wide Blue. Don't tell anyone I said. Here." (the feather) |

Each part: step `raceN` · "Race Rook to <finish>" · `[E] Talk · Rook` at the start; a 3-2-1 count; the race ends
when Pip touches the finish post. Rook's lose line (any part, cycles): "Ha! Rematch? Go on. I'll even pretend to
stretch." / "Finders keepers! ...Again?"

World mark: at each finish Pip won, Rook plants a small flag: "Pip was here first. —R. (grudgingly)"; Rook appears in
the lantern chain ([story.md#lantern-chain](./story.md#lantern-chain)) when `ss49.done`.

Journal: open "Rook races to treasures. Rook calls everything treasure. I respect the enthusiasm." / done "Five
races. Rook gave Pip a feather. Rook says it is 'not a big deal'. Rook polished it first."

<a id="side-post"></a>
### Post-game: ss-50 to ss-53

<a id="ss-50"></a>
#### ss-50 The Three Corners Jamboree

**Owner** the Catchers ([cast.md#catchers](./cast.md#catchers)) · **Land** home (plaza) → Duskwick (the Hundred
Lamps, dungeon o4, [dungeons.md#o4](./dungeons.md#o4)) · **Build** S-299 · **Unlock** `flag:mainEnding` · **Reward**
40 gems and the gift `nook_gift_portrait` (the dungeon's own reward, a heart petal and a hood trim, is o4's) ·
**Time** 15 min (plus the dungeon)

1. `ask` · "The Catchers have a plan" · talk to any Catcher at the plaza edge in the evening.
2. `climb` · "Reach floor 10 of the Hundred Lamps" · `dungeons.o4` floor 10 reached.
3. `win` · "Win the Three Corners Jamboree" · [creatures.md#boss-jamboree](./creatures.md#boss-jamboree).

Key lines:
- `grumble.1` "Hmph. One at a time is boring." / `pinch.1` "Aye, we fancy a jamboree, lad." / `frostbun.1` "All three. One go. ...Fun."
- `pinch.2` (done) "Three corners and one wee hood. Best fun in a hundred year. We'll want a portrait."

World mark: the three Catchers nap in a heap at floor 10's arena after; a painted group portrait (the three Catchers
and Pip's hood) hangs in Pip's Nook.

Journal: open "The Catchers want to fight Pip all at once, for fun. I have read the word 'fun' four times." / done
"Pip won. The Catchers want a rematch. They always want a rematch. It is how they say 'thank you'."

<a id="ss-51"></a>
#### ss-51 Dream a Little

**Owner** [Grandpa Dormy](./cast.md#grandpa-dormy) (the isle's expert on naps) · **Land** home + the ten Guardian
Dreams ([creatures.md#dreams](./creatures.md#dreams)) · **Build** S-295 (S-292-S-294 build the Dreams) · **Unlock**
`flag:mainEnding` · **Reward** 40 gems and the gift `nook_gift_mobile` · **Time** 15 min (beyond the Dreams)

1. `ask` · "Grandpa Dormy knows about dreams" · talk (21:00-23:00).
2. `three` · "Dream with three napping bosses" · `collect.dream` count ≥ 3.
3. `six` · "Dream with six" · ≥ 6.
4. `ten` · "Dream with all ten" · = 10; talk to Dormy.

Key lines:
- `dormy.1` "Napping bosses dream, you know. Everyone does. Say 'Dream' nicely at one and you'll see what they see."
- `dormy.2` (done) "All ten? You've seen more dreams than I've had naps. ...No, that's not true. Nobody has. Here."

World mark: a dream mobile (ten pastel felt moons, one per Dream) turns slowly over Pip's Nook bed; each Dream's
pastel plushie variant sits on the Nook shelf (see [§9](#plushies)).

Journal: open "Bosses dream. I wish to know what of. Dormy says, 'Go and see.' He then fell asleep." / done "Ten
dreams. Gloop dreams of more socks. Grumble dreams of quiet. I dream of footnotes."

<a id="ss-52"></a>
#### ss-52 Hoot's Last Paper

**Owner** [Professor Hoot](./cast.md#professor-hoot) · **Land** home (Hoot's study) → Hoot's Margins
([atlas-isles.md#hoots-margins](./atlas-isles.md#hoots-margins)) · **Build** S-301b (the ink-trace mechanic: S-301a) · **Unlock** `flag:mainEnding` ·
**Reward** 40 gems and the gift `nook_gift_paper` · **Time** 20 min (the Margins' exploration is in CANON's
post-game bucket)

Hoot's final paper is about Pip. He has lost its five conclusions inside his own notebook.

1. `ask` · "Hoot's final paper" · talk to Hoot in his study.
2. `enter` · "Enter Hoot's Margins" · `[E] Enter · Notebook` on his desk.
3. `trace` · "Trace the ink bridges (n/8)" · 8 ink-trace puzzles: follow a dotted line with sword Swings in order
   (each dot struck within 1.5 s of the last); a solid ink bridge appears.
4. `conclusions` · "Find Hoot's five lost conclusions (n/5)" · `[E] Pick up · Conclusion` (paper scraps).
5. `read` · "Hear the paper read" · 20 s scene on Hoot's Board.

The five conclusions (`side.ss52.c.<n>`): "1. Pip is small. (Correct.)" · "2. Pip is brave. (Correct, though he
would not say so. He would not say anything.)" · "3. Pip finds things. (Correct. Ask anyone.)" · "4. Pip gives
things back. (Correct, and rarer.)" · "5. Pip is kind. (Checked twice. Correct.)"

Key lines:
- `hoot.1` "My final paper! On Pip! Five conclusions. I've lost all five. Inside my notebook. Don't ask how."
- `hoot.2` (scene) "'On Pip', by Professor Hoot. For the first time in my career, every conclusion is correct. I'm as surprised as you."

World mark: the paper hangs on Hoot's Board with a gold star; a printed copy hangs in Pip's Nook; Pinfeather sends a
note ("Correct. Annoyingly.") pinned beside it.

Journal: open "My final paper. I am not nervous. I have simply misplaced it inside myself." / done "Five
conclusions. All correct. Pinfeather agrees. I shall frame his note."

<a id="ss-53"></a>
#### ss-53 The Planting

**Owner** [Wenna](./cast.md#wenna) · **Land** home · **Build** S-291 · **Unlock** `flag:mainEnding` · **Reward** 40
gems · **Time** 10 min

Wenna has made a seed: not a sneeze seed, a planting one. Pip chooses where it grows. There is no wrong answer.

1. `ask` · "Wenna has a seed" · pedestal line; item-get key item `wenna_seed`.
2. `choose` · "Find the seed a home (choose one of four spots)" · four soft-earth rings with a faint gold shimmer
   appear (post-pass `placePlanting`, [§12](#passes-needed)); `[E] Place · Wenna's seed` at one sets
   `ss53.spot` = 1-4 and hides the other three for good:
   1. the Woods clearing with the fairy ring at (−36.1, −44.8);
   2. the warm spring beside the Summit (Act I healed state);
   3. the lighthouse rock beside Pinch's Lighthouse;
   4. the sunflower ring in Bloom Meadow at (−98.5, 27.3).
3. `grow` · "Watch it grow" · 8 s: a sapling grows to 6 m.

Key lines (`wenna.1`, then one of four by spot):
- `wenna.1` "I made a seed. Not a sneeze one. A planting one. Will you find it a home? Anywhere you like. You know the isle best."
- spot 1 "The woods. Grumble will pretend to mind. He'll water it every morning."
- spot 2 "By the warm spring. Frostbun will keep it company. She keeps everything company."
- spot 3 "By the lighthouse. It'll see every boat come home. That's a good job for a tree."
- spot 4 "In the sunflowers. Digby will smell it before anyone sees it. I like that best. ...I like them all best."

World mark: a young tree, 6 m, with Wenna's blossom colours and a little two-leaf sprout at its crown like Pip's
hood, at the chosen spot, for good; its spot gains one villager line per resident nearby.

Journal: open "The Tree has made a seed for planting. I suggested my study. She suggested Pip." / done "A new tree
stands where Pip chose. It has a sprout on top. I have drawn it eleven times."

---

<a id="activities"></a>
## 6. The twelve activities

Each activity is owned, built only from verbs Pip already has (Swing, Hop, Roll/sprint, Look, the tools), repeatable
at any time after it opens, and paid in tiers: each tier pays **once**, the first time its threshold is met. Best
scores and times live in `S.collect` or numeric flags, never a new save field. No activity has a fail state: a run
that goes wrong simply ends and can be started again at once. During any timed run the realm's enemy spawner is paused
(spawn cap 0) and resumes when the run ends.

| Id | Activity | Owner | Where | Opens | Build |
|---|---|---|---|---|---|
| [act-dash](#act-dash) | Clover's Dash | Clover | one course per overworld (10) | `bloom` (home course) | S-112 + per land |
| [act-vistas](#act-vistas) | Vista Sketches | Professor Hoot | 30 vista posts | `bloom` | S-076 + per land |
| [act-fishing](#act-fishing) | Fishing | Nell Pelliwick | 18 spots, 24 species | `flag:wennaAwake` | S-206, S-207 + per land |
| [act-regatta](#act-regatta) | Duck Regatta | the Quackenbushes | home village pond | `bloom` | S-136 |
| [act-spore-rally](#act-spore-rally) | Spore Rally | Grumble Shroom | Grumble Shroom's Hollow | `bloom` | S-158 |
| [act-sledding](#act-sledding) | Sledding | Frostbun | Frostcap Peaks | `bloom` | S-158 |
| [act-juggling](#act-juggling) | Gloop's Juggling | Old Gloop | Archwater, the Moon Pool | `boss:gloop` | S-133 |
| [act-harvest-cut](#act-harvest-cut) | Harvest Cut | Lady Honksworth | Threemills, Tumble Hill | `boss:honksworth` | S-154 |
| [act-lagoon-lights](#act-lagoon-lights) | Lagoon Lights | the Wicklings (Flick) | Duskwick lagoon | `flag:ch8` | S-133 |
| [act-bell-duel](#act-bell-duel) | Bell Duel | Pelagia | the Glassway, the Sunken Bell | `boss:pelagia` | S-216 |
| [act-sling-gallery](#act-sling-gallery) | Sling Gallery | Master Scoria | Kettle Isle, Forgefall yard | `ability:sling` | S-237 |
| [act-steam-hop](#act-steam-hop) | Steam Hop | Soakley | Kettle Isle, the Spout | `ability:glide` + `realm:kettle.visited` | S-237 |

<a id="act-dash"></a>
### act-dash Clover's Dash

**Owner** [Clover](./cast.md#clover) · **Verbs** sprint, roll, hop, plus each land's tool · **Save** `collect.dash`:
`'dash:<realm>'` → best time in tenths of a second (integer 1-36000) · **Build** S-112 (framework, home and Pinewhistle), S-133 (Duskwick, Archwater),
S-154 (Threemills), S-220 (the Glassway), S-234 (Kettle), S-255 (Saltglass), S-267 (Driftholm); the Rootdeep course
has no step in INDEX and is added to S-192 (see [Decisions](#decisions)).

Rules:
- A **Dash post** (Clover's painted flag on a post) starts the course: `[E] Use · Clover's Dash` shows the best time
  and the three medal times, then a 3-2-1 chime. The timer shows top-centre (`m:ss.t`).
- **Ring gates**: painted wooden hoops 2.4 m across with ribbon tails, numbered, passed in order. The next ring glows;
  a skipped ring blinks and every later ring stays dim until it is passed. The run ends at the finish post.
- Leaving the course by more than 30 m, or `[E]` at the start post, ends the run with no result. Getting dizzy is
  impossible during a run (no enemies, no hazards on the line).
- **Medals** from the course's par `P` (the careful-bot time recorded by the course's in-page test): gold ≤ 1.10 P,
  silver ≤ 1.30 P, bronze ≤ 1.60 P.

Tiers (CANON §10.2): **per course** first bronze 15 gems, first silver 20 gems, first gold a ribbon on Clover's
windowsill (10 ribbon slots, one colour per land); **gold on all ten courses**: a heart petal. Gems: 10 × 35 = 350.

| Course | Land | Start → finish | Rings | ≈ Length | Tool on the fast line |
|---|---|---|---|---|---|
| 1 | home | the plaza signpost → the Meadow Windmill | 10 | 260 m | none |
| 2 | Pinewhistle | Acornet Hollow → Sawmill Run's yard | 12 | 340 m | Leaf Glider (one ravine) |
| 3 | Duskwick | Wickhaven's stilt decks → Coral Steps | 12 | 320 m | none |
| 4 | Archwater | the top of the Basalt Stairs → the Raft | 12 | 300 m | Tide Bell (one stone, optional) |
| 5 | Threemills | Haybury lane → round the millpond → Tumble Hill | 14 | 420 m | Thistle Hook (one hedge gap) |
| 6 | the Rootdeep | Burrowbottom gate → Glowcap Forest → Underlake shore | 12 | 300 m | Lantern (dark stretch) |
| 7 | the Glassway | Puffin Post → along the Sandbars (low tide only) | 10 | 360 m | Tide Bell |
| 8 | Kettle Isle | Ash Beach → the Bathhouse Terraces | 12 | 340 m | Leaf Glider (one vent) |
| 9 | Saltglass Flats | Sablecamp → across the Glass Dunes → Academy Hill | 14 | 460 m | none |
| 10 | Driftholm | Mote's Meadow → three islets → Arch Rise | 12 | 300 m | Cloudstep |

Lines: `clover.dash.1` "Ready? I'll count. Three, two, one, GO! ...I said go! Why are you still here?" ·
`clover.dash.2` (gold) "GOLD! That's a ribbon for my windowsill. Next to the shells. The shells are jealous." ·
`clover.dash.3` (all gold) "Ten golds! You're the fastest explorer on the Wide Blue! Second fastest. I'm practising."

<a id="act-vistas"></a>
### act-vistas Vista Sketches

**Owner** [Professor Hoot](./cast.md#professor-hoot) · **Verbs** Look (`[E] Sketch · <view>`) · **Save**
`collect.vista` · **Build** S-076 (system, Hoot's Board, the 4 home vistas), each land's finds step (its vistas)

Rules: a **vista post** (a small easel with Hoot's owl sign) stands where a view opens. `[E] Sketch · <view name>`
turns the camera to the post's fixed bearing, holds 3 s while the view cross-fades to its painted sketch (a generated
512 px webp per vista; canvas fallback: the live frame posterised to 6 tones with a pencil-line edge pass), and pins it
to **Hoot's Board** on the plaza. The view names, bearings and placements are the atlas files'
([atlas-home.md#vistas](./atlas-home.md#vistas) and each land). Counts (CANON §10.3): home 4, Duskwick 2,
Pinewhistle 3, Archwater 3, Threemills 3, Rootdeep 2, Glassway 3, Kettle 3, Saltglass 3, Driftholm 2, Starmeadow 2.

Tiers: **every 10 sketches** a Field Notes chapter (10: "I. Near Shores", 20: "II. High Places", 30: "III. Far
Lights", each a Lore page of Hoot's prose); **each sketch** 5 gems (150 in all); **all 30** a framed print of all
thirty sketches for Pip's Nook (gift `nook_gift_print`). S-076 builds the gems and the three pages generically;
S-302a hangs the print. The pages' prose (one text id each, `lore.vista.ch1`..`ch3`):
I. Near Shores "Chapter I: Near Shores. Ten views, all within a good flap of home. A view, I have decided, is a place that agrees to hold still while you look at it." · II. High Places "Chapter II: High Places. Twenty views. Pip climbs; I stay below and imagine. From up high, the paths must look like doodles. I suspect the Lamplighters doodled them." · III. Far Lights "Chapter III: Far Lights. Thirty views, and a small light far off in every one: a beacon, a window, a star. The Wide Blue is mostly water, Pip. Lights hold it together."

Lines: `hoot.vista.1` "A view! Sketch it, Pip, and I'll pin it up. I'll add the wrong caption myself." · `hoot.vista.2`
(30) "Thirty views. The whole Wide Blue on one board. I have run out of pins. I have used a fork."

<a id="act-fishing"></a>
### act-fishing Fishing

**Owner** [Nell Pelliwick](./cast.md#nell) · **Verbs** `[E] Fish`, a timed Swing · **Save** `collect.fish`:
`'<species>' → biggest size in cm` · **Build** S-206 (mechanic, Fish Log, Nell's tank, tiers), S-207 (species,
spots on shipped lands, painted icons, [art-audio.md#fish](./art-audio.md#fish)); spots on later lands ship in their
finds steps

Rules:
- Talk to Nell after I.6: item-get key item **Nell's spare rod**. No bait, no inventory, no fish to carry: every catch
  is logged and let go ("Back you go.").
- A **fish spot** shows a 3 m ring of ripples and plays a soft plop within 15 m. `[E] Fish · Ripples` casts (0.8 s);
  the rod shows in the view-model; the float sits in the ripples.
- After 2-8 s (with 0-2 nibbles: the float bobs, no splash, nothing to do) comes the **bite**: the float dips, a
  splash, a "!" glint over it and a pad rumble. **Swing within 0.6 s** (0.45 s for rare species) to land it. Too early
  or too late: "It got away!"; the ripples fade for 10 s and come back. Nothing is lost.
- A catch shows a card: icon, name, size (rolled in the species' range), Nell's line for that species. New species add
  to the **Fish Log** (a journal page) and to Nell's tank in her cottage.
- Species at a spot are filtered by time window (dawn 05-08, day 08-18, dusk 18-21, night 21-05) and tide (the
  Archwater and Glassway tide flag); among eligible species, weights are common 60, uncommon 30, rare 10.

Tiers: **16 species** a heart petal; **20 species** a rod charm (a leaf-shaped float, cosmetic, shown on the rod);
**24 species** a small fish tank for Pip's Nook (gift `nook_gift_tank`) that shows every species caught.

The 18 spots: home `h1` village pond (−13, 25), `h2` the Woods source pond (37, −78), `h3` the lighthouse rocks;
Duskwick `c1` the lagoon stilt deck, `c2` the Ember Sands hot-pool outflow; Pinewhistle `p1` the sawmill stream,
`p2` a Misthollow ravine pool; Archwater `a1` the Moon Pool rim, `a2` Kelp Shallows; Threemills `t1` the millpond,
`t2` the Orchard Rows brook; Rootdeep `r1` the Underlake; Glassway `g1` Puffin Post pier, `g2` Bell Shallows, `g3` a
Sandbars channel; Kettle `k1` the cooling pool below the Bathhouse Terraces; Saltglass `s1` the Salt Pans oasis;
Driftholm `d1` the Falls pool. Exact positions are each atlas's.

| # | Species | Spot | When | Rarity | Size cm | Colours | Nell's line |
|---|---|---|---|---|---|---|---|
| 1 | Puddle Minnow | h1 | any | common | 4-7 | `#9fc7a8` `#e8efe9` | "Tiny. Proud of it, though." |
| 2 | Blossom Carp | h1 | day | uncommon | 30-45 | `#ffb3c7` `#f2c94c` | "Been in that pond since before the bloom. Pinker now." |
| 3 | Crownfin | h2 | dawn | rare | 20-28 | `#7a4fa0` `#f2c94c` | "Gold spots, like Grumble's Crown. Don't tell him. He'll want it." |
| 4 | Lighthouse Goby | h3 | night | common | 8-12 | `#f3e3c3` `#ff8f7a` | "Stripy as the lighthouse. Comes out when the lamp does." |
| 5 | Whiskerdown | h1 | 00-03 | rare | 60-80 | `#6f6a62` `#b9b2a6` | "Old Whiskerdown! My gran tried for him. So did I. Well done, you." |
| 6 | Ember Snapper | c2 | dusk | uncommon | 25-35 | `#e66f4f` `#2b2238` | "Likes warm water. Like me. Like everyone, really." |
| 7 | Lantern Tetra | c1 | night | common | 3-5 | `#ffd76a` `#3fa79a` | "Glows. The moths think it's a lamp. It isn't. Don't tell them." |
| 8 | Pinecone Trout | p1 | day | common | 25-40 | `#8a6a3c` `#c98b4b` | "Scales like a pinecone. Smells like one too, oddly." |
| 9 | Mist Char | p2 | dawn | uncommon | 30-45 | `#c9d6d9` `#8fae9a` | "You find it in the mist. You find everything in the mist, eventually." |
| 10 | Mooneye | a1 | night, high tide | rare | 20-30 | `#e8edf5` `#6b4a8c` | "The otters say it swims with the moon. I say it swims with the tide." |
| 11 | Kelp Wrasse | a2 | day, low tide | common | 18-26 | `#3f8a5a` `#7fd3d0` | "Hides in the kelp. Badly." |
| 12 | Basalt Blenny | a2 | any | uncommon | 8-12 | `#36414f` `#7fd3d0` | "Sits on the hexagons. Thinks it's a hexagon." |
| 13 | Millpond Bream | t1 | day | common | 30-45 | `#c9a46b` `#a7d3f0` | "Fat on breadcrumbs. Threemills feeds everyone. Even the fish." |
| 14 | Wheatfin Roach | t2 | day | uncommon | 15-22 | `#e7c45a` `#7fae4b` | "Gold fins, like the wheat. Only bites when the sails are turning." |
| 15 | Glow Gudgeon | r1 | any | common | 10-15 | `#7be0c8` `#1c1a24` | "Glows in the dark. Very handy down there." |
| 16 | Paleglass Cavefish | r1 | any | rare | 12-18 | `#e9f2f0` `#ffcf7a` | "You can see right through it. Digby says it smells like cucumber." |
| 17 | Glass Herring | g1 | day | common | 15-20 | `#bfeee6` `#2f7d8c` | "Clear as the water it lives in. Nearly missed it." |
| 18 | Bellfish | g2 | any | uncommon | 20-30 | `#c98b4b` `#f5e6c4` | "Rings when you land it. Listen. ...There." |
| 19 | Sandbar Flounder | g3 | low tide | common | 25-35 | `#e2c9a0` `#f5e6c4` | "Flat as a sandbar. Lies on one and pretends." |
| 20 | Puffin Sprat | g1 | dawn | uncommon | 6-9 | `#2f7d8c` `#ff9a3c` | "The puffins love these. Pell says don't tell the puffins." |
| 21 | Warmwater Loach | k1 | any | common | 10-16 | `#f4d1a6` `#8fc7a0` | "Lives in bathwater. Lucky thing." |
| 22 | Salt Pan Pupfish | s1 | day | uncommon | 3-5 | `#8ec9d8` `#efe3c8` | "Smallest fish I know. Bravest, too. Lives in a desert." |
| 23 | Cloud Koi | d1 | day | uncommon | 40-60 | `#f7f2ff` `#c9b6ec` | "A fish in the sky. I've stopped asking questions." |
| 24 | Skyfin | d1 | night | rare | 30-40 | `#141a3a` `#ffe9a8` | "Speckled like the stars. That's the last one, Pip. That's all of them." |

Rarity split: 10 common, 9 uncommon, 5 rare. Fish ids are `fish:<slug>` (for example `fish:puddle-minnow`).

Lines: `nell.fish.1` "Here. My spare rod. Watch the float, not the fish. When it dips, swing. Don't think. Thinking scares them." ·
`nell.fish.2` (16) "Sixteen kinds! Here, a petal from my window box. Don't ask why I keep petals. Sailors are like that."

<a id="act-regatta"></a>
### act-regatta Duck Regatta

**Owner** the Quackenbushes · **Verbs** walk, hop · **Save** flag `act.regatta.best` (ms) · **Build** S-136

Rules: six floating gates (painted wooden arches with duck flags, 1.8 m wide) round the village pond at (−13, 25) and
its bank, numbered. The five ducks follow Pip when he walks within 4 m (they keep a loose V 1.5-3 m behind); a **Hop**
makes every duck within 4 m flap 2 m forward. A gate counts when all five ducks have passed through it; the next gate
then glows. Ribbit croaks the start (after [ss-06](#ss-06)); before that Grandpa Pondsworth quacks it.

Tiers: **under 120 s** 40 gems; **under 90 s** the Quackenbushes give Miso their pattern and the **duck plushie**
goes on sale ([§9](#plushies)); **under 70 s** a **gold duck** trophy for Pip's Nook (gift `nook_gift_duck`); the ducks make Pip
"an honorary Quackenbush" and quack at him whenever he passes the pond.

Lines: `pondsworth.regatta.1` "All five through every gate, mind. We're a family. We finish together. Mostly at once."

<a id="act-spore-rally"></a>
### act-spore-rally Spore Rally

**Owner** [Grumble Shroom](./cast.md#catchers) · **Verbs** Swing · **Save** flag `act.spore.best` (hits) · **Build**
S-158; tier 3 opens with [ss-11](#ss-11)

Rules: talk to Grumble in his Hollow (`[E] Talk`, not `Wake`). He puffs one big soft spore (0.9 m, glowing gold),
which drifts down at 1.2 m/s with a 0.6 m/s sideways wander. Any Swing that touches it within 2 m bats it up 4 m; each
bat is one hit. A ground shadow shows where it will land. When it touches the ground the run ends (it pops into
harmless sparkles). Count on screen. Every 10 hits it drifts 10 % faster.

Tiers: **10 hits** a heart petal; **20 hits** 80 gems; **30 hits** (needs `ss11.done`: "In front of the nephews") a
plushie hat: a tiny mushroom-cap hat appears on every plushie on the Nook shelf.

Lines: `grumble.spore.1` "Keep it up. Don't let it land. If it lands, you lose. Nobody loses. Hmph. You know what I mean."

<a id="act-sledding"></a>
### act-sledding Sledding

**Owner** [Frostbun](./cast.md#catchers) · **Verbs** roll · **Save** flag `act.sled.best` (ms) · **Build** S-158

Rules: a marked **sled run** (a 280 m snow strip with blue flag poles) from the snowfield below Frostbun's Summit down
toward the Peaks bridge; post-pass `placeSledRun` ([§12](#passes-needed)). Talk to Frostbun at the top: she lends a
tea-tray (shown under Pip in third person; in first person the view lowers 0.3 m). On the run, Roll has no cooldown,
chains, and moves at 1.5× roll speed; steering is the move stick. Eight flag gates (pass between the poles; a missed
gate adds 2 s). The run ends at the bottom post.

Tiers: **finish under par × 1.4** 80 gems; **under par × 1.15** Pip's time is chalked on the **Sledding Times** board
on the plaza under Frostbun's; **under par × 1.0** a **sled plaque** for Pip's Nook with his best time burnt in (gift
`nook_gift_sled_plaque`) and a word from Frostbun.

Lines: `frostbun.sled.1` "Tray. Hill. Down. ...That's all of it." · `frostbun.sled.2` (top tier) "Fast. Faster than me.
Hmph. ...Proud."

<a id="act-juggling"></a>
### act-juggling Gloop's Juggling

**Owner** [Old Gloop](./cast.md#old-gloop) · **Verbs** Swing · **Save** flag `act.juggle.best` (catches) · **Build** S-133

Rules: at the Moon Pool, Old Gloop tosses **knitted practice urchins** (soft, harmless) from his eight arms; each toss
is announced by its arm lifting, with the sock colour glowing 0.8 s before (the same tell idiom as his boss fight). A
Swing that meets an urchin within 2 m sends it back to the arm it came from: one catch. An urchin that lands on the
ground is a drop; the round ends after **3 drops**. Toss rate starts at one per 1.6 s and speeds up 5 % every 10
catches; from 30 catches two arms may toss at once (never three).

Tiers: **50 catches** in one round a heart petal; **75** 80 gems; **100** a **sock trophy** for Pip's Nook (one of Gloop's
knitted socks on a little stand, gift `nook_gift_sock`), and Gloop wears a tiny knitted crown for a day.

Lines: `gloop.juggle.1` "Eight arms, one juggler. I need a second. Catch and swing back. Gently. They're knitted."

<a id="act-harvest-cut"></a>
### act-harvest-cut Harvest Cut

**Owner** [Lady Honksworth](./cast.md#lady-honksworth) · **Verbs** Swing, timed · **Save** flag `act.harvest.best` ·
**Build** S-154

Rules: a 40-square wheat plot below Middle Mill. Middle Mill's sail sweeps a shadow across the plot once every 1.2 s;
the square under the shadow glows. A Swing at a glowing square within 0.25 s of the shadow is an **on-beat cut**
(sheaf pops up with a chime); a Swing off the beat still cuts but scores nothing. A round is 40 squares (Pip walks the
rows; the shadow follows the next uncut square). Score = on-beat cuts.

Tiers: **20 on-beat** 120 gems; **30** a **festival sash** for Pip's Nook wall (gift `nook_gift_sash`); **38** a **sheaf medal**
for Pip's Nook (gift `nook_gift_sheaf`), and Lady Honksworth declares a "Pip Day".

Lines: `honksworth.harvest.1` "Cut when the sail says cut. Not before. Not after. The sail is never wrong. I am never wrong."

<a id="act-lagoon-lights"></a>
### act-lagoon-lights Lagoon Lights

**Owner** the Wicklings (Flick speaks for them) · **Verbs** place · **Save** flag `act.lagoon.done` · **Build** S-133

Rules: at night (`tod:night`) on Duskwick's lagoon deck, Flick hands Pip 12 paper lantern floats one at a time;
`[E] Place · Lantern float` at 12 marked water steps along the deck. When all 12 float, a 30 s viewing scene plays
(free look, the lanterns drift out across the lagoon, the Wicklings hum). Repeatable every night.

Tier: the first time, a **postcard** of the lagoon lights (viewing only; it pins to the Nook's postcard board and the
Lore tab). No gems; nothing else.

Lines: `flick.lagoon.1` "One for every lamp that ever lit the Wide Blue. We lost count, so it's twelve. Twelve is nice."

<a id="act-bell-duel"></a>
### act-bell-duel Bell Duel

**Owner** [Pelagia](./cast.md#pelagia) · **Verbs** Ring (three bells) · **Save** flag `act.bell.best` (set) ·
**Build** S-216

Rules: three bells (low, middle, high; each its own colour and pitch) on the Sunken Bell's top deck. Pelagia rings a
sequence; Pip answers with `[E] Ring · <bell>`. Each set is three rounds; each round adds one note. A wrong note
splashes harmless water (no damage in the activity, unlike the story duel) and replays the same round. Set A: rounds
of 3, 4, 5 notes; set B: 5, 6, 7; set C: 7, 8, 9. Accessibility: each bell lights as it rings, so the sequence can be
followed by eye alone.

Tiers: **set A** 100 gems; **set B** a small bronze bell for Pip's Nook (gift `nook_gift_bell`; it rings when Pip
walks past); **set C** a **bell charm** for Pip's Nook (a tiny silver bell on a ribbon, gift
`nook_gift_bellcharm`) and Pelagia's grudging praise.

Lines: `pelagia.duel.1` "Shellby always rang the low one too early. Don't ring it too early. ...Or do. It made me laugh."

<a id="act-sling-gallery"></a>
### act-sling-gallery Sling Gallery

**Owner** [Master Scoria](./cast.md#master-scoria) · **Verbs** Ember Sling · **Save** flag `act.sling.best` (points) ·
**Build** S-237

Rules: Forgefall's back yard; 60 s rounds; painted tin stars slide on rails at 10-25 m (1 point), small tin moons pop
up for 1.5 s (2 points), and one golden bell crosses the yard top once per round (5 points). A target hit swings down
with a clang. Missed shots cost nothing.

Tiers: **25 points** a heart petal; **40 points** a discount: Kinako's Sling quick-draw costs 150 instead of 300;
**55 points** a **sling-shot medal** for Pip's Nook (gift `nook_gift_slingmedal`).

Lines: `scoria.sling.1` "Stars, moons and the bell. The bell's hardest. I made it hard. I'm proud of that."

<a id="act-steam-hop"></a>
### act-steam-hop Steam Hop

**Owner** [Soakley](./cast.md#soakley) · **Verbs** glide, hop · **Save** flag `act.steam.best` (ms) · **Build** S-237

Rules: from the bottom of the Spout's terraced side, climb by gliding on **steam vents** to the bell at the top. Vents
puff on a fixed rhythm (on 2.0 s, off 1.0 s, each vent offset); a puffing vent lifts a gliding Pip 5 m. 12 vents. A
fall lands Pip on the last terrace he stood on; the timer keeps running.

Tiers: **under 90 s** a heart petal; **under 70 s** a bath towel for Pip's Nook (gift `nook_gift_towel`, hung on a
peg); **under 55 s** a **towel ribbon** for Pip's Nook (a blue rosette, gift `nook_gift_ribbon`).

Lines: `soakley.steam.1` "Ride the steam to the bell. Take your time. Or don't. The bell will wait. Bells are good at waiting."

---

<a id="ledger"></a>
## 7. Reward ledger (what the economy test sums)

`tests/economy.test.js` ([systems.md#economy](./systems.md#economy)) reads these numbers from the content tables, not
from this file; this table is what the tables must contain.

| Source | Gems | Detail |
|---|---|---|
| 53 side stories | **1,855** | per story in [§4](#index) (ss-38 pays the sword, not gems) |
| Activity tiers | **1,000** | Dash 350 (10 courses × (15 + 20)), Vistas 150 (30 × 5), Regatta 40, Spore Rally 80, Sledding 80, Gloop's Juggling 80, Harvest Cut 120, Bell Duel 100; Fishing, Lagoon Lights, Sling Gallery and Steam Hop pay no gems |
| Heart petals from activities | 6 petals | Dash (gold on all 10), Fishing (16 species), Spore Rally (10 hits), Gloop's Juggling (50), Sling Gallery (25 points), Steam Hop (under 90 s) |

| Sink in this file | Gems | Detail |
|---|---|---|
| 24 Nook furnishings | **1,920** | 24 × 80 ([§8](#nook)) |
| 13 new plushies | **1,300** | 13 × 100 ([§9](#plushies)); the 3 shipped plushies (3 × 80) are in "home today" |
| Village Works | **2,000** | 8 × 250 ([§10](#village-works)) |
| Starsteel forging | **600** | [ss-38](#ss-38) |

Items and unlocks this file hands out (definitions in [systems.md#items-tools](./systems.md#items-tools)): the Chime
Bell (ss-10), the Starsteel Sword (ss-38), the Snowdrift hood trim (ss-12, free; it is not one of the six 80-gem
trims), Nell's spare rod (act-fishing), the herald's horn (ss-27, key item, kept as a keepsake of the festival), the
Sling quick-draw discount (act-sling-gallery). Key items used inside a story are removed from the Items tab when the
story ends, except the horn and the rod.

---

<a id="nook"></a>
## 8. Pip's Nook: furnishings and gifts

Pip's Nook is his room in Wenna's roots (the interior, its doors, the stair down to Under the Roots and the Keepsake
Hollow next door are [atlas-home.md#pips-nook](./atlas-home.md#pips-nook)). It is the home for collections. It opens
in chapter 7 with a plain moss bed, a round west window and three empty shelves.

**Rules.**
- 24 **furnishings**: 16 bought once for 80 gems from Miso (12, home-made) or Kinako (4, "limited edition!!"), and 8
  **found**, one in a prize chest on each Act II-III land (#13-#20 below; CANON §10.4, systems.md#economy's prize-chest
  table). Each is a key item `nook:<slug>` in `S.items`; owning it shows it at its fixed slot the next time the Nook
  is built (or at once if Pip is inside, with a soft poof). No arranging, no moving: fixed slots keep it testable.
- Miso's twelve are in stock from `flag:lanternGot`. Kinako's four (#21-#24): each appears in his stock once its land
  is visited (`realm:<id>.visited`), at whichever jetty the bazaar is docked. A found piece's item-get line is its
  sale line with "LIMITED!!" replaced by "Found it!" (Kinako, met later: "You FOUND one?! That's my stock!! ...Keep it!!").
- **Gifts** are earned, not bought, and also have fixed slots. They never cost gems.
- Budget: the Nook is an interior realm; with every furnishing and gift present it stays ≤ 120 draw calls and
  ≤ 150 k triangles, ≤ 6 point lights (the Little Star counts as one); textures ≤ 512 px webp.
- Default slot plan (room-local metres, x east, z south, origin at the room centre; the room is a circle of radius
  5.0 m, ceiling 3.2 m; the entrance is north at (0, −4.8), the stair down is east at (4.6, 0), the Keepsake Hollow
  arch is south at (0, 4.8), the window is west at (−4.9, 0)). atlas-home may move a slot; the slot names are
  stable. A 1.2 m clear path must join the entrance, the stair, the arch and the centre.

<a id="nook-furnishings"></a>
### The 24 furnishings

| # | Id | Name | Seller (unlock) | Slot (x, z, y) | Size m | Palette | Sale line (≤ 220) |
|---|---|---|---|---|---|---|---|
| 1 | `nook:quilt` | Patchwork Quilt | Miso | bed (−3.0, −2.6) | 1.6 × 0.9 | `#e9a6a0` `#f3e3c3` `#7aa63a` | "Every patch is from something I couldn't sell~ That makes it priceless. It's 80 gems." |
| 2 | `nook:leaf-rug` | Leaf Rug | Miso | rug (0, 0.3) | Ø 2.4 | `#8fbf45` `#5e8a2f` | "A rug shaped like a leaf. For feet that like leaves~" |
| 3 | `nook:acorn-lamp` | Acorn Lamp | Miso | bedside (−1.6, −3.8) | 0.6 tall | `#b8894a` `#ffd76a` | "Glows like a sleepy acorn. Doesn't snore. Mostly~" |
| 4 | `nook:stools` | Mushroom Stools (pair) | Miso | table (1.4, 0.9) | 0.45 tall | `#c2563f` `#f3e3c3` | "Red caps, white spots. Not Grumble's cousins. I asked~" |
| 5 | `nook:tea-table` | Teapot Table | Miso | table (1.4, 0.9) | Ø 0.7 | `#a8744f` `#9fc7a8` | "A table with a teapot. Tea not included. Tea never included~" |
| 6 | `nook:book-shelf` | Picture-Book Shelf | Miso | wall NE (3.4, −2.8) | 1.6 tall | `#7a4a2e` + book spines | "Picture books. Hoot wrote one. It has no pictures. I put it at the back~" |
| 7 | `nook:cushions` | Cushion Pile | Miso | SW floor (−2.4, 3.2) | 1.0 × 1.0 | `#ffb3c7` `#a7d3f0` `#e7c45a` | "For sitting, napping, or hiding under. Purr-fect for all three~" |
| 8 | `nook:window-box` | Daisy Window Box | Miso | window sill (−4.4, 0, 1.1) | 1.0 × 0.25 | `#f7f7f0` `#f2c94c` `#7fae4b` | "Daisies for your window. They face the light, like you~" |
| 9 | `nook:sprout-paper` | Sprout Wallpaper | Miso | walls (texture) | - | `#e8efe9` `#8fd14f` | "Little sprouts all over. Like you, but flatter~" |
| 10 | `nook:star-mobile` | Star Mobile | Miso | ceiling (0, −0.5, 2.6) | Ø 0.8 | `#ffe9a8` `#8fa8ff` | "Five felt stars. I stitched one extra in case one wanders off~" |
| 11 | `nook:desk` | Little Writing Desk | Miso | wall SE (2.8, 3.0) | 1.0 × 0.5 | `#a8744f` `#f3e3c3` | "For writing letters to whoever. You'll want one, I think~" |
| 12 | `nook:toy-chest` | Toy Chest | Miso | foot of bed (−1.6, −1.6) | 0.8 × 0.5 | `#3fa79a` `#f2c94c` | "For toys. Or gems. Or toys made of gems. Nothing is refundable~" |
| 13 | `nook:lantern-string` | Wickhaven Lantern String | found: Duskwick `chest-4` | ceiling ring (r 4.2, y 2.7) | 12 lanterns Ø 0.2 | `#f2b45a` `#ff8f7a` | "Moth-made!! Every lantern hand-folded!! By moths!! LIMITED!!" |
| 14 | `nook:whistle-clock` | Whistle Clock | found: Pinewhistle `chest-6` | wall NNW (−1.2, −4.85, 2.0) | 0.6 tall | `#2f4a3a` `#c98b4b` | "It WHISTLES on the hour!! Like the pine!! Only smaller and slightly flat!!" |
| 15 | `nook:hammock` | Raft Hammock | found: Archwater `chest-2` | west (−3.6, 1.6, 0.6) | 2.0 long | `#7fd3d0` `#e2c9a0` | "Otter-knotted!! Sways by itself if you hum!! Results may vary!!" |
| 16 | `nook:rocking-chair` | Haybury Rocking Chair | found: Threemills `chest-5` | south (−1.2, 3.6) | 1.0 tall | `#c2563f` `#e7c45a` | "Mouse-made!! Rocks!! Only rocks a LITTLE!! Mice are careful!!" |
| 17 | `nook:glowcap-lamp` | Glowcap Night-Lamp | found: Rootdeep `c01` | desk top (2.8, 3.0, 0.8) | 0.35 tall | `#7be0c8` `#1c1a24` | "A mushroom that glows!! Mole-approved!! They can't see it!! They LOVE it!!" |
| 18 | `nook:wind-chime` | Sea-glass Wind Chime | found: Glassway `c06` | window (−4.7, −0.6, 2.2) | 0.6 long | `#bfeee6` `#2f7d8c` | "Real sea glass!! From the REAL sea!! Chimes when the door opens!!" |
| 19 | `nook:kettle-stove` | Copper Kettle Stove | found: Kettle `c04` | NE floor (2.2, −3.8) | 0.9 tall | `#c98b4b` `#3b3540` `#e66f4f` | "Forged at Forgefall!! Keeps a kettle warm!! The kettle is extra!! The kettle is included!!" |
| 20 | `nook:hourglass` | Saltglass Hourglass | found: Saltglass `c13` | east floor (3.8, 1.8) | 1.0 tall | `#efe3c8` `#c9a46b` | "Academy sand!! It measures exactly one nap!! Turn it over for another!!" |
| 21 | `nook:beanbag` | Cloud Beanbag | Kinako (Driftholm) | south (1.4, 3.6) | 1.0 × 1.0 | `#f7f2ff` `#c9b6ec` | "Stuffed with REAL cloud!! Well, fluff!! Cloud-adjacent!!" |
| 22 | `nook:star-ceiling` | Constellation Ceiling | Kinako (Starmeadow) | ceiling (texture + glow dots) | - | `#141a3a` `#ffe9a8` | "The stars!! On your ceiling!! I'm told they're ACCURATE!! I didn't check!!" |
| 23 | `nook:letter-rack` | Puffin Post Letter Rack | Kinako (Glassway) | wall ENE (4.4, −1.6, 1.4) | 0.6 × 0.4 | `#2f7d8c` `#ff9a3c` | "Official Puffin Post!! For letters!! Pell says it's not official!! It's official!!" |
| 24 | `nook:globe` | Lamplighter's Globe | Kinako (Duskwick) | rug edge (−1.4, 1.4) | 0.9 tall | `#2b2238` `#f2b45a` `#7fd3d0` | "The whole Wide Blue on a stand!! Spins!! Mind your fingers!! LIMITED EDITION!!" |

Each furnishing's model is code-built from primitives in `js/props.js` style (toon material, outline) with one
generated painted texture (512 px webp) for its fabric, wood or paper; the procedural fallback is the same model in
flat palette colours. Prompts and budgets: [§11](#briefs-nook).

<a id="nook-gifts"></a>
### Gifts (earned, never bought)

| Gift id | From | Slot (x, z, y) | What it is |
|---|---|---|---|
| `nook_gift_twine` | ss-10 | shelf 1 | the parcel's twine, tied in a bow |
| `nook_gift_spoon` | ss-18 | shelf 1 | Kinako's ninth spoon on a stand, label "Limited edition of one" |
| `nook_gift_certificate` | ss-44 | wall W-SW frame (−4.0, 2.6, 1.8) | "Certificate of Lamplighting (Honorary)" |
| `nook_gift_feather` | ss-49 | shelf 1 | Rook's black feather in a jar |
| `nook_gift_portrait` | ss-50 | wall N frame (1.6, −4.7, 1.9) | the Catchers and Pip's hood, painted |
| `nook_gift_mobile` | ss-51 | over the bed (−3.0, −2.6, 2.4) | ten pastel felt moons |
| `nook_gift_paper` | ss-52 | wall NE frame (3.0, −3.6, 1.9) | "On Pip, by Professor Hoot", with a gold star |
| `nook_gift_print` | act-vistas (30) | wall SE frame (3.6, 2.6, 1.9) | thirty sketches in one frame |
| `nook_gift_tank` | act-fishing (24) | stand (−3.4, −0.6) | a small tank showing every species caught |
| `nook_gift_sash` | act-harvest-cut (30) | wall S peg (−0.8, 4.6, 1.6) | the festival sash |
| `nook_gift_bell` | act-bell-duel (set B) | arch top (0, 4.7, 2.6) | a bronze bell that rings as Pip walks under it |
| `nook_gift_towel` | act-steam-hop (70 s) | wall S peg (0.8, 4.6, 1.6) | a folded striped bath towel on a peg |
| `nook_gift_postcard` | act-lagoon-lights | postcard board, wall SSW (−2.0, 4.4, 1.5) | the lagoon postcard |
| `nook_gift_duck` | act-regatta (70 s) | trophy stand (atlas-home spot f08), place 1 | a gold rubber duck, 0.15 m |
| `nook_gift_sled_plaque` | act-sledding (par × 1.0) | trophy stand f08, place 2 | a little wooden sled plaque with Pip's best time |
| `nook_gift_sock` | act-juggling (100) | trophy stand f08, place 3 | one of Gloop's knitted socks on a brass stand |
| `nook_gift_sheaf` | act-harvest-cut (38) | trophy stand f08, place 4 | a wheat-sheaf medal on a red ribbon |
| `nook_gift_bellcharm` | act-bell-duel (set C) | trophy stand f08, place 5 | a tiny silver bell on a teal ribbon |
| `nook_gift_slingmedal` | act-sling-gallery (55) | trophy stand f08, place 6 | a copper medal stamped with a sling-shot |
| `nook_gift_ribbon` | act-steam-hop (55 s) | trophy stand f08, place 7 | a blue rosette ribbon with a tiny towel charm |

The **trophy stand** is a fixed three-step wooden stand (`#a8744f`, 1.2 m wide, 1.0 m tall) on spot f08; each top
tier of an activity puts one trophy on it. No economy change: the trophies replace "praise" tiers.
| the Little Star | ss-48 | floating, centre (0, 0, 2.2) | a night-light (point light, r 4 m, `#ffe9a8`) |
| the blossom window | ss-14 | the west window | the round window widens and fills with white-and-gold blossom |
| plushie shelves | §9 | wall E-SE (4.3, 2.2), three shelves 1.6 m long | the 13 new plushies, 3 loan cards, 10 dream variants |

---

<a id="plushies"></a>
## 9. Plushies

Miso stitches a plushie of everyone Pip has calmed, and a few he has simply been kind to. **16 count** for the
Plushies row (CANON §10.3): the three shipped guardian plushies (LOCKED: 80 gems, Miso's counter, `S.plushies`) and
13 new ones at 100 gems.

**Rules.**
- Stock rule (generalising the LOCKED one, S-045): a plushie is on sale at Miso's when the shop is bought out (the
  Heart Container and the Shiny Sword sold, LOCKED) **and** its condition below holds. One of each, once.
- Display: the three shipped plushies stay on **Miso's counter** for ever (her LOCKED lines say so). The 13 new ones go
  to the **plushie shelves in Pip's Nook**; the shelf keeps three little cards, "On loan to Miso's counter ✿", where the
  guardians would sit.
- Save: `S.plushies[<key>] = true`, keys namespaced `<realm>:<id>` for new ones; the three shipped keep `woods`,
  `shores`, `peaks`. Boss keys follow [creatures.md](./creatures.md) boss ids; if creatures.md spells one differently,
  creatures.md wins.
- Model: the character's own code-built model, uniformly scaled to fit a 0.32 m tall × 0.30 m wide box (the shipped
  `PLUSHIE_SIZE` fit), with a **felt** material (the toon material with the generated seamless felt texture
  `side_felt` multiplied in, specular off, outline kept). Fallback: the shipped toon blob in the character's main colour.
- Shop icon: a painted plushie portrait (128 px webp, transparent), `icon_plush_<id>`; fallback the character's
  portrait icon or a ♡.
- Miso's new line once the Nook is open: `miso.plush.nook` "Your new plushies go home to your Nook, little sprout. My
  counter's full of grumpy ones already~"

| # | Key | Plushie | Price | On sale when | Shop description (`desc`) | Got line (`got`) |
|---|---|---|---|---|---|---|
| 1 | `woods` | Grumble Shroom | 80 | LOCKED | LOCKED | LOCKED |
| 2 | `shores` | Captain Pinch | 80 | LOCKED | LOCKED | LOCKED |
| 3 | `peaks` | Frostbun | 80 | LOCKED | LOCKED | LOCKED |
| 4 | `roots:rollo` | Sir Rollo | 100 | `boss:rollo` | "Rolls off the shelf if you look away. Stitched by Miso." | "A Sir Rollo plushie! He's curled up. He'll uncurl when he trusts you~" |
| 5 | `pinewhistle:mossmantle` | Mossmantle | 100 | `boss:mossmantle` | "Hangs from anything. Looks like it hums. It doesn't. It would, though." | "A Mossmantle plushie! Slow to arrive, quick to cuddle~" |
| 6 | `archwater:gloop` | Old Gloop | 100 | `boss:gloop` | "Eight tiny socks, all different. Granny Mochi knitted them. She insisted." | "An Old Gloop plushie! Eight socks, no cold arms~" |
| 7 | `threemills:honksworth` | Lady Honksworth | 100 | `boss:honksworth` | "Felt bonnet. Very loud expression." | "A Lady Honksworth plushie! Honk-tastic~" |
| 8 | `duskwick:wickwork` | the Wickwork Moth | 100 | `boss:wickwork` | "Brass-coloured felt and paper wings. Does not tick. Pretends to." | "A Wickwork Moth plushie! Wind it up with a hug~" |
| 9 | `rootdeep:lumbra` | Lumbra the Long | 100 | `boss:lumbra` | "Very long. Comes folded. Tiny felt glasses." | "A Lumbra plushie! I ran out of felt twice~" |
| 10 | `glassway:pelagia` | Pelagia | 100 | `boss:pelagia` | "A little bell on her shell. It rings when you hug her." | "A Pelagia plushie! Ding-dong, purr-purr~" |
| 11 | `kettle:fumarole` | Lady Fumarole | 100 | `boss:fumarole` | "Wrapped in a felt bath towel. Looks warm. Is felt." | "A Lady Fumarole plushie! Fresh from the bath~" |
| 12 | `saltglass:scarabelle` | Tutor Scarabelle | 100 | `boss:scarabelle` | "Hourglass back with real sand. Don't shake her. She'll mark you late." | "A Tutor Scarabelle plushie! Top marks~" |
| 13 | `sky:mote` | Mote | 100 | `flag:mainEnding` | "Soft gold felt and two stitched eyes. Glows a little in the dark. On purpose." | "A Mote plushie! He looks happier on a shelf than on a ladder~" |
| 14 | `home:wenna` | Wenna | 100 | `flag:mainEnding` | "A little tree with a sleepy face and three felt seeds in her crown." | "A Wenna plushie! Keep a hanky handy~" |
| 15 | `home:nell` | Nell Pelliwick | 100 | `flag:mainEnding` | "A pelican in a sailor's cap with a felt fish. The fish is not for sale." | "A Nell plushie! Back... eventually~" |
| 16 | `home:duck` | a Quackenbush | 100 | act-regatta tier 2 | "One duck. Stands for all five. They argued about which." | "A Quackenbush plushie! Quack-purr~" |

**Dream variants (not counted, not sold).** The first clear of each Guardian Dream (CANON §9.2) puts a **pastel**
variant of that boss's plushie on the Nook's third shelf (keys `dream:<boss>`): Grumble Shroom, Captain Pinch,
Frostbun, Sir Rollo, Mossmantle, Old Gloop, Lady Honksworth, the Wickwork Moth, Lumbra, Lady Fumarole. Same model and
felt, tinted toward the Dream palette ([creatures.md#dreams](./creatures.md#dreams)), with a small felt moon stitched
on. Plushie hats (act-spore-rally tier 3) sit on every plushie on all three shelves.

---

<a id="village-works"></a>
## 10. Ribbit's Village Works

Mayor Ribbit's gem-funded projects: eight permanent improvements to Sprout Village and the home isle, 250 gems each,
in any order. Props, anchors and post-pass are [atlas-home.md#village-works](./atlas-home.md#village-works) (one pass,
each project a flag-gated prop set); this section owns the list, the costs, the effects and the lines.

**Rules.**
- A **Village Works board** stands on the plaza beside Hoot's Board from `flag:lanternGot` (S-157). `[E] Read ·
  Village Works` lists the eight projects with a painted sketch each and "Funded ✿" on the done ones.
- Funding: `[E] Talk · Mayor Ribbit` → "Village Works" → pick a project → confirm "250 gems from the town treasury...
  from you, I mean." Refusal when short: "The treasury is... resting. Come back with 250 gems. Croak."
- The project appears **within 10 s** in a puff of sawdust confetti with the toast "✿ Village Works: <name> is built!"
  and Ribbit's "I hereby declare..." line. Flags `vw.<slug>`. Never reverts.
- No project is needed by anything else. Each gives a small, real convenience or a sound, so funding one is a reward.

| # | Flag | Project | What appears | What it does | Ribbit's line |
|---|---|---|---|---|---|
| 1 | `vw.clock` | The Plaza Clock | a 4 m green clock post at the plaza's north edge | shows the game hour (helps Dormy's 21:00-23:00 and every night step); chimes on the hour | "I hereby declare it... o'clock! Whatever o'clock it is. The clock will tell you. That's its job." |
| 2 | `vw.bandstand` | The Bandstand | a round white bandstand at the plaza's south-west | evenings 18:00-21:00 the Quackenbushes play (after ss-06); the village music gains a brass layer | "I hereby declare this bandstand... banded! Standed. It's open." |
| 3 | `vw.dock` | The Duck Pond Dock | a little wooden dock on the village pond | the regatta starts from it; a bench at its end (`[E] Sit · Dock`) | "I hereby declare this dock... ducked. The ducks approve. I asked them. Twice." |
| 4 | `vw.footbridge` | The Peaks Footbridge | a second, narrow footbridge over the river north of the Peaks bridge (exact span: atlas-home) | a shortcut from the Woods path to the Peaks | "I hereby declare this bridge... bridged! You may now cross the river without going all the way round. Progress!" |
| 5 | `vw.lampwalk` | The Lighthouse Lamp Walk | 10 lamp posts along the south path to the lighthouse | lit 19:00-06:00; a lit path to the Shores at night | "I hereby declare this walk... lamped. Walk it at night. That's the point. Croak." |
| 6 | `vw.stage` | The Festival Stage | a wooden stage with bunting at the plaza's west edge | hosts the ending festival and the Hundred-Year Night scenes; replays Ribbit's speeches from the journal | "I hereby declare this stage... staged. I shall give speeches on it. Many. You have been warned." |
| 7 | `vw.flowers` | Flower Boxes and Bunting | flower boxes under every cottage window; a second line of bunting; "Very" painted above "Population: cozy" | the village sign reads "Population: very cozy" | "I hereby declare this village... very cozy. It was cozy. Now it's VERY. Write that down, Hoot." |
| 8 | `vw.swing` | Wenna's Swing | a rope swing on the Great Tree's low south bough | `[E] Sit · Swing`: a gentle rocking camera for as long as Pip likes; one Wenna line per act | "I hereby declare this swing... swung. ...Is she all right with it? She says it tickles. Good." |

Wenna's swing lines (`wenna.swing.<act>`): Act II "Higher! ...No, that's high enough. I'm very old." · Act III
"Shellby used to sit there. He was smaller then. So was I, a bit." · Act IV / post-game "I like it when you swing. It
feels like the wind came to visit."

---

<a id="briefs"></a>
## 11. Art briefs for the assets in this file

Characters (models and portraits) are briefed in [cast.md](./cast.md); land prop kits in the atlas files; the
template, style guide and image-prompt **preamble** in [art-audio.md#brief-template](./art-audio.md#brief-template) and
[art-audio.md#style](./art-audio.md#style). Every brief below follows that template in compact form.

**How to read a row.**
- **Image prompt**: the subject text only. The full prompt is the art-audio preamble + this text + the size and
  transparency given in the row's "Out" column. All art is original; never imitate another game's characters or art.
- **3D prompt** (for the owner's later GLB batch): `"<Name>: <silhouette>, about <size> m, colours <palette>,
  hand-painted toon storybook prop, soft rounded chunky shapes, no text, under <tris> triangles, one mesh, origin at the
  base centre, facing +z"`. Fill it from the row.
- **Build** is the code-built model the step ships now (toon material plus outline, `js/props.js` style) and doubles as
  the procedural fallback; "tex" means one generated texture multiplied onto it, which falls back to the flat palette.
- **Key** is the manifest key; every key carries `realm` (the land it belongs to; `home` for the Nook) and is lazy per
  realm. Processing: textures through `tools/make_seamless.py`, sprite sheets through `tools/slice_sheet.py`, icon
  strips through `tools/process_strip.py` and `tools/export_sprites.py`, saved as webp.
- **Budget**: the images in this file add about 2.4 MB in all, spread over the realm bundles (≤ 0.3 MB per land plus
  ≤ 1.2 MB for the home bundle's Nook and plushie icons), inside each realm's 2.5 MB cap.

<a id="briefs-props"></a>
### 11.1 Side-story props and held items

| Key | Silhouette · size m · pose | Palette | Build (tris) | Image prompt (subject) | Out |
|---|---|---|---|---|---|
| `prop_golden_sprout` | two-leaf sprout on a thin stem · 0.35 · upright, leaves open | `#f2c94c` `#7fae4b` | 2 leaf planes + cylinder, emissive 0.3 at dusk (60) | "a tiny golden two-leaf sprout glowing softly in grass, close-up" | icon 128 px, transparent |
| `prop_golden_sapling` | young round-crowned tree, gold blossoms · 2.4-3.2 | `#ffd76a` `#ffb3c7` `#8a5a3c` | trunk cylinder + 3 blossom spheres, petal particles (400) | "a young storybook tree covered in gold blossom, petals drifting" | card 512 px, transparent (far LOD) |
| `prop_dormy_blanket` | knitted blanket over a porch bench · 1.2 | `#c2563f` `#f3e3c3` | draped box (40) + tex | "a hand-knitted red and cream checked blanket, seamless knit texture" | tex 256 px, seamless |
| `prop_twin_sign` | carved board "MISO & KINAKO", sawn and rejoined with a brass strip · 1.6 × 0.4 | `#a8744f` `#f2b45a` `#7aa63a` | box + decal (24) | "a carved wooden shop sign reading MISO & KINAKO, sawn in half and mended with brass, painted sprout and wave motifs" | decal 512 × 128, opaque |
| `prop_every_isle_bun` | cushion-sized cinnamon bun under a glass dome · 0.6 | `#c98b4b` `#f7f2ff` | torus spiral + dome (300) | "a giant cinnamon bun with star-dusted icing under a glass dome" | icon 128 px |
| `prop_lily_pad` | notched lily pad · Ø 0.5 | `#7fae4b` `#a8d07a` | disc with notch (24) | "a single round lily pad with a little notch, top view" | tex 256 px, transparent |
| `prop_dot_drawing` | child's crayon moth drawing pinned to a door · 0.3 | `#ffd76a` `#8fa8ff` | plane | "a child's crayon drawing of a smiling moth holding a lamp, on rough paper" | decal 256 px |
| `prop_spiral_shell` | small spiral-carved shell marker · 0.25 | `#f3e3c3` `#b8894a` | lathe shell (120) + spiral decal | "a small cream seashell carved with a spiral, sitting on grass" | icon 128 px |
| `item_parcel` | brown-paper parcel with twine bow · 0.3 | `#c9a46b` `#f3e3c3` | box + bow (60), held | "a small brown-paper parcel tied with cream twine, label reading 'For the one who finds things'" | icon 128 px |
| `item_chime_bell` | palm-sized brass hand bell with a spiral on its waist · 0.12 | `#e2b04a` `#7a4a2e` | lathe bell (150), held, sways when near a find | "a small brass bell with a spiral engraved round its waist and a leather loop" | icon 128 px |
| `prop_brass_gear` | toothed brass gear · Ø 0.2 | `#d4a24c` | extruded gear (96) | "a small brass clockwork gear, warm shine" | icon 128 px |
| `item_spoon` | plain wooden spoon · 0.25 | `#c99a63` | lathe (40) | "an ordinary wooden spoon with a tiny price tag that says LIMITED" | icon 128 px |
| `prop_hoard_hole` | tree hollow stuffed with acorns · 0.5 | `#7a4a2e` `#c98b4b` | hollow decal on trunk + acorn instances (80) | "a tree hollow overflowing with acorns, cosy" | decal 256 px |
| `prop_listening_post` | brass ear-trumpet on a stake with a leaf flag · 1.4 | `#d4a24c` `#7aa63a` | cone + stake + flag plane (80) | "a brass listening horn on a wooden stake with a little green leaf flag" | icon 128 px |
| `prop_bridge_bell` | tiny brass bell on a string · 0.08 | `#d4a24c` | 6 per bridge, instanced (30 each) | (no image) | - |
| `prop_saw_whistle` | steam whistle with a pitch wheel and a pennant · 0.8 | `#c98b4b` `#3b3540` `#e8efe9` | cylinder + wheel + pennant (140) | "a brass steam whistle with a notched pitch wheel and a small cloth pennant" | icon 128 px |
| `prop_chalk_arrow` | chalk arrow on rock · 0.6 | `#f7f7f0` | decal | "a child's chalk arrow drawn on dark stone, with a tiny star" | decal 256 px, transparent |
| `prop_verse_board` | carved driftwood board · 0.8 × 0.3 | `#b8a07a` `#6b4a8c` | box + text decal (12) | "a weathered driftwood plank carved with a few lines of a sea song" | decal 512 × 128 |
| `item_sock` | blue-and-white knitted sock · 0.4 | `#3d6fb5` `#f7f7f0` | bent tube (60); also the 8th sock on Gloop's model and on Frostbun's ear | "a long blue and white striped hand-knitted sock" | icon 128 px |
| `item_herald_horn` | straight brass horn with a pennant · 0.5 | `#d4a24c` `#c2563f` | cone + tube (80), held | "a straight brass herald's horn with a red pennant showing a goose" | icon 128 px |
| `prop_scarecrow_hat` | five floppy hats (straw, blue, red, green, patch) · 0.4 | `#e7c45a` `#3d6fb5` `#c2563f` | cone + brim (50) × 5 tints | "five floppy scarecrow hats in different colours, one with a patch" | sheet 5 × 128 px |
| `item_pie_stack` | stack of six pies, held · 0.4 | `#c98b4b` `#8a2f3a` | 6 short cylinders (120) | "a wobbly stack of six fruit pies with lattice tops, steaming" | icon 128 px |
| `item_root_seed` | glowing seed · 0.06 | `#7be0c8` | sphere + glow sprite | "a small seed glowing mint green in the dark" | icon 128 px |
| `prop_letterbox` | painted post letterbox with a year carved on it · 0.9 | `#2f7d8c` `#ff9a3c` | box on post (40) | "a little teal letterbox on a post with a puffin painted on it" | icon 128 px |
| `item_rare_shells` | six shells: spiral conch, glass cowrie, moon scallop, bell whelk, star limpet, sunset tellin · 0.1-0.2 | per shell | lathe/disc (40-120 each) | "six rare seashells in a row: a spiral conch, a clear glass cowrie, a silver moon scallop, a bell-shaped whelk, a star limpet, a sunset-striped tellin" | sheet 6 × 128 px |
| `prop_pinch_old_shell` | empty red crab shell with a child's painted lighthouse · 0.9 | `#d2463a` `#f3e3c3` | dome + legs stubs (300) | "an empty red crab shell with a child's painting of a lighthouse on it" | decal 256 px |
| `item_mabel_bell` | ship's bell with a rope · 0.4 | `#c98b4b` `#7a4a2e` | lathe (200); later hung on the gallery | "an old brass ship's bell with a frayed rope, barnacles, the name MERRY MABEL" | icon 128 px |
| `item_gull_nest` | twig nest with three speckled eggs · 0.45 | `#a8744f` `#e8edf5` | torus + 3 spheres (90), held | "a round twig seabird nest with three speckled eggs" | icon 128 px |
| `item_starsteel_shard` | blue-white crystal metal shard · 0.2 | `#cfe6ff` `#8fa8ff` | faceted (40), emissive | "a shard of blue-white star metal, faceted, glowing faintly" | icon 128 px |
| `tint_starsteel` | Pip's sword mesh tint and edge glow | `#cfe6ff` edge `#ffe9a8` | material only on the sword mesh of `hero.glb` (GLB file untouched) | (no image; side-by-side screenshot in the PR) | - |
| `prop_star_pendant` | five-point forged star on a chain · 0.3 | `#ffd76a` | extruded star (40), emissive at night | "a small hand-forged gold star pendant hanging from a chain" | icon 128 px |
| `prop_glowing_potato` | lumpy glowing ingot · 0.15 | `#ffb04a` | noise sphere (80) | (no image) | - |
| `prop_bath_gauge` | frog-shaped thermometer gauge · 0.5 | `#8fc7a0` + dial | box + dial decal (40) | "a brass frog-shaped bath thermometer with a blue, green and red dial" | decal 256 px |
| `prop_dig_finds` | six finds: chalk slate, student lamp, bell clapper, lunch tin, moth-wing quill, spiral tile · 0.1-0.3 | per find | primitives (30-100 each) | "six old school artefacts on a cloth: a chalk slate, a small lamp, a bell clapper, a lunch tin, a feather quill, a tile with a spiral" | sheet 6 × 128 px |
| `prop_nameplate` | brass-edged wooden nameplate · 0.3 × 0.08 | `#c9a46b` `#3b3540` | box + text decal | "a small brass-edged wooden nameplate with a hook hole" | decal 256 × 64 |
| `prop_tally_notes` | scratched notes on pale rock (12 decals) · 0.5 each | `#efe8ff` `#6b5a8c` | decals; text is the line | (no image; text rendered to canvas) | canvas |
| `prop_fold_post` | fluffy cloud fence post · 1.0 | `#f7f2ff` | 3 spheres (60) | (no image) | - |
| `fx_little_star` | small soft star with a face · 0.2 | `#ffe9a8` | sprite + point light | "a tiny shy smiling star, soft glow, round face" | sprite 128 px, transparent |
| `prop_rook_flag` | small black pennant on a stick, crow sketch · 0.5 | `#2a2a33` `#f7f7f0` | plane + stick (12) | "a little black pennant with a white crow doodle and the words 'Pip was here first'" | decal 256 px |
| `item_conclusion` | torn notebook scrap · 0.2 | `#f7f2e0` `#3b3540` | plane | "a torn scrap of notebook paper with neat owl handwriting" | icon 128 px |
| `item_wenna_seed` | gold seed with a tiny sprout · 0.08 | `#ffd76a` `#8fd14f` | sphere + leaf (40), held | "a glowing golden seed with a tiny two-leaf sprout" | icon 128 px |
| `prop_planting_tree` | young tree with Wenna's blossom and a two-leaf sprout at the crown · 6.0 | `#ffb3c7` `#ffd76a` `#8a5a3c` `#8fd14f` | trunk + 5 crown spheres + sprout (900) | "a young storybook tree in pink and gold blossom with a little two-leaf sprout on top" | card 512 px |

<a id="briefs-activities"></a>
### 11.2 Activity props

| Key | Silhouette · size m | Palette | Build (tris) | Image prompt (subject) | Out |
|---|---|---|---|---|---|
| `prop_dash_post` | post with Clover's flag (flower and rabbit ears) · 1.6 | `#ffb3c7` `#f3e3c3` `#7a4a2e` | post + flag plane (40) | "a wooden post with a pink flag painted with a flower and two bunny ears" | decal 256 px |
| `prop_dash_ring` | painted wooden hoop with ribbon tails · Ø 2.4 | per land accent + `#f3e3c3` | torus 24 seg + 2 ribbons (300); numbered decal | "a painted wooden hoop with fluttering ribbons, storybook style" | icon 128 px |
| `prop_dash_ribbon` | prize ribbon rosette · 0.12 | one colour per land | disc + 2 tails (40) | "a prize ribbon rosette" (10 tints in code) | icon 128 px |
| `prop_vista_post` | small easel with an owl sign · 1.2 | `#7a4a2e` `#6b4a8c` `#e2b04a` | easel + sign (60) | "a small wooden easel with a round sign showing an owl in spectacles" | icon 128 px |
| `sketch_<vista>` | one per vista (30) | pencil and wash | - | "a loose pencil and watercolour sketch of <the vista's view, from its atlas entry>, on cream paper, hand-lettered caption" | 512 × 320, opaque |
| `item_rod` | bamboo rod with a reel, held · 1.6 | `#c9a46b` `#3fa79a` | view-model (200) | "a small bamboo fishing rod with a teal reel" | icon 128 px |
| `prop_float` | red-and-white float; leaf-shaped charm at tier 2 · 0.08 | `#d2463a` `#f7f7f0` / `#8fbf45` | sphere / leaf (40) | (no image) | - |
| `fx_ripples` | ring ripples · Ø 3 | water tint | animated ring sprite | "soft concentric water ripples, top view" | sprite 256 px, transparent |
| `icon_fish_sheet` | 24 fish, side view | per §6 table | - | "a sheet of 24 cute storybook fish in side view on a plain background, each distinct, colours as listed" (one prompt per row of 6 using the table's names and colours) | 4 sheets of 6 × 128 px |
| `prop_regatta_gate` | painted wooden arch on floats with a duck flag · 1.8 wide | `#f2c94c` `#3fa79a` | 2 posts + arch + float (120) | "a little floating wooden arch with a yellow duck flag" | icon 128 px |
| `fx_spore_ball` | big soft glowing spore · Ø 0.9 | `#f2c94c` `#fff1b8` | sphere + fuzz sprite | "a big soft glowing golden spore puff" | sprite 256 px |
| `prop_tea_tray` | round tin tea-tray · Ø 0.8 | `#9fdcff` `#f7f7f0` | disc (32) | (no image) | - |
| `prop_sled_flag` | blue pennant pole · 1.8 | `#3d6fb5` `#f7f7f0` | pole + flag (16), 16 instances | (no image) | - |
| `prop_sled_board` | "Sledding Times" chalkboard · 1.2 | `#3b3540` `#f7f7f0` | board + canvas text (12) | "a small wooden chalkboard titled Sledding Times with a bunny doodle" | decal 256 px |
| `prop_knit_urchin` | round knitted urchin with soft spikes · Ø 0.35 | `#6b4a8c` `#ff8f7a` | icosphere + cones (120) | "a round knitted sea urchin toy with soft yarn spikes" | tex 128 px |
| `prop_wheat_square` | 1 m square of wheat (cut / uncut) | `#e7c45a` `#c9a46b` | instanced grass card (8 per square) | "a tuft of ripe golden wheat, side view" | card 256 px, transparent |
| `prop_lantern_float` | folded paper lantern on a leaf raft · 0.3 | `#ffd76a` `#ff8f7a` | box + leaf (30), emissive | "a folded paper lantern floating on a leaf, glowing warm" | icon 128 px |
| `prop_duel_bells` | three hanging bells low / mid / high · 0.6 / 0.45 / 0.3 | `#c98b4b` `#7fd3d0` `#ffd76a` | lathe (150 each) | "three bronze bells of different sizes hanging from a driftwood beam" | icon 128 px |
| `prop_tin_targets` | tin star, tin moon, golden bell on rails · 0.4 | `#cfd8ee` `#ffd76a` | extruded shapes (40 each) | "painted tin fairground targets: a star, a crescent moon and a small golden bell" | sheet 3 × 128 px |
| `prop_steam_vent` | stone ring with a brass grate · Ø 1.2 | `#3b3540` `#c98b4b` | ring + grate (90) + steam sprite | "a round stone steam vent with a brass grate, puffing white steam" | sprite 256 px |

<a id="briefs-nook"></a>
### 11.3 Nook furnishings and gifts

All 24 furnishings: **Build** from primitives at the size and palette in [§8](#nook-furnishings), under **400
triangles** each (the hammock, stove and globe under 600), one tex each; **Key** `nook_<slug>` (texture) and
`icon_nook_<slug>` (shop icon, 128 px transparent). Shop icon prompt: "<Name>, a single piece of cosy storybook
furniture, three-quarter view, <palette words>". Texture prompts:

| Slug | Texture prompt (seamless unless noted) |
|---|---|
| quilt | "a patchwork quilt of faded pink, cream and leaf-green squares with visible stitches" |
| leaf-rug | "a woven rug in the shape of a big green leaf, top view, with vein stitching" (not seamless, transparent edge) |
| acorn-lamp | "a warm glowing acorn-shaped paper lampshade, pattern of tiny leaves" |
| stools | "red toadstool cap with white spots, soft painted texture" |
| tea-table | "a round wooden table top with a painted teapot ring stain, warm oak" |
| book-shelf | "rows of picture-book spines in soft colours with hand-lettered titles" (not seamless) |
| cushions | "three plump cushions in pink, sky blue and wheat yellow, one with a star" (not seamless) |
| window-box | "a wooden window box full of white and yellow daisies" (not seamless, transparent) |
| sprout-paper | "cream wallpaper with a repeating pattern of tiny green two-leaf sprouts" |
| star-mobile | "five soft felt stars on threads" (not seamless, transparent) |
| desk | "a small writing desk top with an inkwell ring and doodles, warm wood" |
| toy-chest | "a teal painted toy chest with gold star stencils" |
| lantern-string | "a string of folded paper lanterns in amber and coral" (not seamless, transparent) |
| whistle-clock | "a pine-green clock face with a little whistle instead of a cuckoo door" (not seamless) |
| hammock | "a woven rope hammock net in sea-green and sand" |
| rocking-chair | "a red painted rocking chair with a wheat-sheaf carving" (not seamless) |
| glowcap-lamp | "a glowing mint-green mushroom lamp with spots of light" (not seamless) |
| wind-chime | "pieces of frosted sea glass on strings, teal and pale aqua" (not seamless, transparent) |
| kettle-stove | "a hammered copper surface with rivets, warm glow" |
| hourglass | "an hourglass of pale wood and glass filled with salt-white sand" (not seamless) |
| beanbag | "a fluffy cloud-white fabric with lilac stitching" |
| star-ceiling | "a deep blue night sky painted with gold constellations and small stars" |
| letter-rack | "a teal wooden letter rack with a painted puffin" (not seamless) |
| globe | "a globe of a small island sea with painted isles, a lighthouse and a tree, aged paper" (not seamless; the map shows only this game's isles) |

Gifts: certificate, paper, portrait and print are framed 2D images (512 px, opaque) in the same painterly style:
- `nook_gift_certificate`: "an ornate school certificate with a spiral seal reading 'Certificate of Lamplighting
  (Honorary)', beetle-shaped wax stamp".
- `nook_gift_paper`: "a handwritten owl's paper titled 'On Pip', five numbered conclusions, a gold star sticker".
- `nook_gift_portrait`: "a cosy painted group portrait of a purple mushroom with a tiny gold crown, a red crab in a
  navy skipper's hat, a big white fluffy yeti-bunny with icicle ears, and a small child in a leaf-green fox-eared hood
  seen from behind" (the three Catchers' LOCKED looks; Pip from behind keeps his GLB look untouched).
- `nook_gift_print`: generated by compositing the 30 `sketch_<vista>` images in a 6 × 5 grid at build time (no new
  prompt).
- `nook_gift_postcard`: "a postcard of paper lanterns floating on a dark lagoon below a lit stone tower and stilt
  houses".

<a id="briefs-plushies"></a>
### 11.4 Plushies

- `side_felt`: seamless felt texture, 256 px. Prompt: "close-up of soft wool felt fabric with a faint running-stitch
  seam, neutral light grey so it can be tinted". Multiplied into each plushie's toon material; fallback flat colour.
- `icon_plush_<id>` (13 new + 10 dream variants): prompt "a small hand-stitched felt plushie of <the character's
  look from cast.md>, button eyes, visible stitches, sitting, three-quarter view", 128 px, transparent. Dream variants
  add "in soft pastel colours with a tiny felt moon stitched on".
- **3D prompt** for the owner's batch: "a felt plushie of <character>, sitting, 0.3 m tall, chunky stitched seams,
  button eyes, soft toon storybook shading, under 1,500 triangles". The code-built plushie (the scaled character model)
  ships now.

---

<a id="passes-needed"></a>
## 12. Post-passes and placements this file needs

Home post-passes follow the `placeShells` rules (own `new RNG(7151 * k + c)` stream, nearest-walkable around the named
anchor, nothing added to other lists, `W.walk / W.reach` restored, a world test on seeds 1-40). Their constants are
assigned in [atlas-home.md#passes](./atlas-home.md#passes): take the next free ones in the step that ships the pass.
Props in other lands go in that land's finds or side-story post-pass ([atlas-isles.md](./atlas-isles.md),
[atlas-far.md](./atlas-far.md)).

| Pass | Step | Anchor | Contents | Visible when |
|---|---|---|---|---|
| `placeSproutTrail` | S-114 | the Meadow pond (−94.1, −29.2) | 6 golden sprouts spaced 12-25 m apart leading from the windmill (−108.1, −6.6) to the pond; the bare patch; the 7 grove rings (S-193 adds their saplings by flag) | `ss01` started; grove at `ss01.done` |
| `placeRegatta` | S-136 | the village pond (−13, 25) | 6 floating gates round the pond and bank; the start buoy | `bloom` |
| `placeSledRun` | S-158 | the snowfield below Frostbun's Summit (114, −19), heading west-south-west | 280 m run strip (a ground decal and a speed-boost surface tag, no collider change), 8 gate pairs, top and bottom posts, the Sledding Times board on the plaza | `bloom` |
| `placeDashHome` | S-112 | the plaza signpost (4, 17.5) | the Dash post and 10 rings to the Meadow Windmill along paths and meadow | `bloom` |
| `placeSlowWalk` | S-172 | the four landmarks | 4 spiral-shell markers (one per landmark, 3 m off its main path) and Shellby's waypoints (walkable path points, 6-10 per leg) | per leg done |
| `placeLetterboxes` | S-215 | the six home destinations of [ss-34](#ss-34) | 6 letterbox posts, 2-4 m from each landmark's path side | per delivery |
| `placePlanting` | S-291 | the four spots of [ss-53](#ss-53) | 4 soft-earth rings with gold shimmer; the planted tree at the chosen one | `ss53` started; tree by `ss53.spot` |
| Village Works | S-157 | [atlas-home.md#village-works](./atlas-home.md#village-works) | the 8 project prop sets | per `vw.*` flag |
| Nook slots | S-302, S-305 | [atlas-home.md#pips-nook](./atlas-home.md#pips-nook) | furnishings, gifts, shelves (interior realm: fixed slots, no RNG) | per item |

---

<a id="decisions"></a>
## 13. Decisions made here

CANON leaves these open; this file decides them. A later owner call or a CANON edit overrides any of them.

1. **ss-07 pays 30 gems, not a heart petal.** INDEX S-077 says "1 heart petal"; CANON §10.3 fixes all 24 petals
   (16 Hollows, 6 activities, the Snowglobe, the Hundred Lamps), so S-077 is the bug.
2. **Clover's Dash heart petal is for gold on all ten courses** (CANON's "(gold on all)"); per course, bronze pays 15
   gems, silver 20 gems, gold a windowsill ribbon. The Dash's petal is the one late petal among the six.
3. **Ten Dash courses** include a **Rootdeep** course; INDEX has no step for it, so it is added to S-192 (or a
   split S-192b).
4. **The duck plushie stays a 100-gem sink**: the Regatta's tier 2 gives Miso the pattern, so the CANON ledger's
   13 × 100 holds.
5. **Spore Rally opens after the bloom** (S-158, M18); the Undercap ([ss-11](#ss-11)) unlocks its third tier
   (CANON o2's "Spore Rally unlock" read as "the full Spore Rally").
6. **The three shipped plushies stay on Miso's counter** (her LOCKED lines); the 13 new ones live on the Nook shelves
   with three "On loan" cards; ten pastel **dream variants** (not counted, not sold) join them.
7. **Snowdrift** (Flurry's scarf, ss-12) is a free hood trim on top of the six 80-gem trims.
8. **Village Works projects**: Plaza Clock, Bandstand, Duck Pond Dock, Peaks Footbridge, Lighthouse Lamp Walk,
   Festival Stage, Flower Boxes and Bunting, Wenna's Swing; all eight open from `flag:lanternGot`, any order.
9. **Nook furnishings**: 12 from Miso (open at chapter 7), 12 from Kinako (one per land visited); fixed slots in a
   5 m round room; the default slot plan in §8 holds unless atlas-home moves a slot.
10. **New minor names** (add to [charter.md](./charter.md)'s glossary index, defined in cast.md if it lists them):
    the Quackenbushes Grandpa Pondsworth, Dilly, Dally, Wigeon and Quill; the Acornet kits Twig, Burr and Nibs;
    Foreman Knock (woodpecker, the sawmill); Nana Kelp (eldest otter of the Raft); Old Puffwick (eldest Nimble); the
    Little Star (the fourth Twinkling); Ma and Pa Haybury; Dot (named in CANON); the Academy students Tallow, Glim,
    Lanthorn, Brightfern, Quill, Ashwing and Nettle (nameplates only; "Quill" the student and "Quill" the duckling are
    a deliberate small joke, Scarabelle: "Different Quill."); the fish names in §6; the Every-Isle Bun; the Golden Grove;
    the *Wide Blue Round* (the Raft's shanty).
11. **Bottle destinations** for [ss-34](#ss-34): bottles 1-11 go to the places in its table; [lore.md#bottles](./lore.md#bottles)
    should name each destination in that letter's text. If lore.md names other places, lore.md's places win and the
    letterbox posts move.
12. **Shellby's island legs** of the Slow Walk ([ss-13](#ss-13)) wait for Old Friends ([ss-09](#ss-09)), because
    Shellby "hasn't been in a boat in eighty years" until Pelagia gets him sailing.
13. **The Fourth Bough** ([ss-14](#ss-14)) completes after chapter 22 (it is about Pip knowing where he came from); it
    never gates either ending.
14. **The Long Nap**'s payoff is the II.M moving light on the sky isle, so its last step waits for `flag:moteNamed`.
15. **Fishing**: 18 spots and 24 species as tabled in §6; catch-and-release, no inventory; time windows dawn 05-08,
    day 08-18, dusk 18-21, night 21-05; rarity weights 60/30/10; a 0.6 s bite window (0.45 s for rare).
16. **Activity gem tiers** sum to exactly 1,000 as listed in §7; Fishing, Lagoon Lights, Sling Gallery and Steam Hop
    pay no gems (CANON lists none).
17. **Bell Duel as an activity does no damage** (practice); only Pelagia's story duel splashes for half a heart.
18. **Hot baths heal** (ss-40 mark): sitting in a Kettle bath refills hearts once per visit; it is a convenience, not
    an economy source.
19. **Mote never appears in his own side stories** (ss-45, ss-47): his case is told by his wall and his letters; the
    journal credits him as owner.
20. **Conditions and flag names** in §3 and the `ssNN.*` flag scheme are this file's; systems.md's dictionary wins on
    spelling.

<a id="cross-anchors"></a>
## 14. Anchors this file links in other bible files

For S-001's docs test and the other writers: every anchor below must exist (as `<a id>` before its heading) in the
named file. Minor characters first named here (Foreman Knock, Nana Kelp, the Snoozing Whale) need a short cast.md
entry with an ART BRIEF.

- `art-audio.md`: `brief-template`, `fish`, `hood-trims`, `style`
- `atlas-far.md`: `driftholm`
- `atlas-home.md`: `great-tree`, `ivy-finds`, `passes`, `pips-nook`, `puddles-grotto`, `sky-nook`, `village-works`, `vistas`
- `atlas-isles.md`: `duskwick`, `hoots-margins`
- `cast.md`: `catchers`, `clover`, `digby`, `elder-nutmeg`, `elder-shellby`, `flick`, `foreman-knock`, `gran-burrows`, `grandpa-dormy`, `granny-mochi`, `granny-wick`, `hazel-thimble`, `kinako`, `lady-honksworth`, `lumbra-the-long`, `master-scoria`, `mayor-ribbit`, `miso`, `mote`, `mr-whelk`, `nana-kelp`, `nell`, `old-gloop`, `pelagia`, `pennywhistle`, `pitch`, `postmistress-pell`, `primrose-thistledown`, `professor-hoot`, `professor-pinfeather`, `puddle`, `rook`, `sable`, `skipper-rafferty`, `soakley`, `the-hayburys`, `the-nimbles`, `the-quackenbushes`, `the-snoozing-whale`, `the-twinklings`, `tutor-scarabelle`, `wenna`
- `charter.md`: `tone`
- `creatures.md`: `boss-bosun-snore`, `boss-flurry`, `boss-jamboree`, `dreams`
- `dungeons.md`: `d8`, `o1`, `o2`, `o3`, `o4`
- `lore.md`: `bottles`, `dormy-stories`, `lamp-logs`, `memories`, `mote-letters`
- `story.md`: `ch21`, `ch22`, `lantern-chain`
- `systems.md`: `boat`, `conditions`, `economy`, `items-tools`, `journal`
