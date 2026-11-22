# Story: acts, chapters, beats and scenes

The main story of Starseed Isle, "The Hundred-Year Letter", as implementation agents build it: every beat id, the
flags each beat sets, the scene scripts in the scene-step format, the count-keyed line matrices, the act cards, both
endings and the save-built lantern chain. It follows `CANON.md` §4 exactly; where this file had to decide
something CANON leaves open, the decision is listed at the end under [Decisions made here](#decisions).

What lives elsewhere (link, never copy):
- Lore texts (myth, Bottle Chain letters, Lamp Logs, memory scenes 1-12, Mote's letters, Dormy's stories):
  [lore.md](./lore.md#myth), [lore.md#memories](./lore.md#memories), [lore.md#bottles](./lore.md#bottles).
- Who people are (look, size, palette, tic, schedule, portraits, model briefs): [cast.md](./cast.md).
- Boss fights, sit-down handover lines of the Wardens, the finale's combat numbers: [creatures.md](./creatures.md).
- Dungeon rooms, keys and puzzles: [dungeons.md](./dungeons.md). Places and coordinates: [atlas-home.md](./atlas-home.md),
  [atlas-isles.md](./atlas-isles.md), [atlas-far.md](./atlas-far.md).
- Side stories ss-01 … ss-53 and activities: [side-content.md](./side-content.md).
- The scene runner, dialogue picker, quest engine, journal and condition grammar: [systems.md](./systems.md#scenes).
- Tone, voice and invariants: [charter.md](./charter.md#tone). Every line here obeys it: at most 220 characters,
  `~` only in Miso's speech, `!!` only in Kinako's, ✿ for good news, Pip never speaks, "cozy" in-game.

---

<a id="conventions"></a>
## How to use this file

- **Beat ids** (`I.2`, `II.M`, `beacon-2`, `stone-beats`, `ch13`) are what step issues cite. Each beat below has:
  *Trigger* (condition string, [systems.md#conditions](./systems.md#conditions)), *Sets* (flags and items),
  *Scenes* (script ids), *Lines*, *World change* (what the player sees within 10 s), *End state* (what the chapter
  test asserts) and *Hints* (the `[nudge, answer]` pair for "Ask the Tree").
- **Plot is keyed to counts, character lines to places** (CANON §12 rule 7). Beats that depend on order read the
  order number stored in the flag value (below), never which isle or seed it was, unless the beat is about that place.
- **Text ids.** Every line shown here becomes a text-table entry. Id pattern: `<realm>.<group>.<key>.<n>`, for
  example `home.scene.i6.03`, `home.npc.shellby.inst.2`, `home.wenna.w17`. The English in this file is the text; the
  step that ships it copies it into `js/text/en/<realm>.js` verbatim. Where this file prints a line in quotes, the
  quotes are not part of the text.
- **Speaker labels.** The dialogue frame shows the speaker's name. Wenna's frame reads "The Great Tree" until
  Shellby names her in I.6, then "Wenna" for the rest of the game. Mote's frame reads "The Lamp Thief" until II.M,
  then "Mote".

<a id="flags"></a>
## Story flags and counts

All story state lives in `S.flags` (save v7, [systems.md#save-plan](./systems.md#save-plan)). Values are `true` or
a finite number. Shipped v6 fields keep their meaning: `S.seeds.<id>` (0 none, 1 carried, 2 placed), `S.bosses`,
`S.ending` (the bloom happened). Order-carrying flags store the order number, so one flag answers both "is it done"
and "which one was it".

| Flag | Value | Set by | Meaning |
|---|---|---|---|
| `calm:woods`, `calm:peaks`, `calm:shores` | 1-3 (order) | I.2-I.4 handover | that Catcher was calmed, and in which order |
| `handover:<id>` | true | I.2-I.4 | handover scene played (first win only) |
| `seen:<lineId>` | true | dialogue `once` | a once-line was shown |
| `inst:1` … `inst:3` | true | Shellby | myth instalment heard ([#shellby-instalments](#shellby-instalments)) |
| `bloom` | true | I.5 | mirror of `S.ending`, set by the v7 migration for bloomed saves and by I.5 |
| `wennaAwake` | true | I.6 | Wenna speaks; root door shows |
| `nellHome` | true | I.6 | Nell is home; lighthouse day-burn stops |
| `lanternGot` | true | ch7 | the Glowbud Lantern is Pip's |
| `rolloCalm` | true | ch7 | Sir Rollo calmed |
| `jettyOpen` | true | ch7 | Ribbit opened Nell's Jetty; `[E] Sail · the Dandelion` |
| `ch8` | true | ch8 | Granny Wick gave the Chart; three isles on the chart |
| `thiefSeen` | true | ch8 | the Lamp Thief glimpse played |
| `beacon:pinewhistle`, `beacon:archwater`, `beacon:threemills` | 1-3 (order) | ch9-11 kindle | that isle's beacon relit, and in which order |
| `beacon:duskwick` | 4 | ch12 | the Tower's great lamp kindled |
| `moteNamed` | true | II.M | the Lamp Thief named himself |
| `towerOpen` | true | beacon-3 | the Tower door unlocks |
| `act2done` | true | ch12 | Mote took the Firstlight; the Ladder hangs in the NE sky |
| `sneeze2` | true | ch12 home beat | the small sneeze played at home |
| `ch13` | true | ch13 start | Wenna asked Pip to go down |
| `lumbraCalm` | true | ch13 | Lumbra calmed |
| `mem:1` … `mem:12` | true | memory knots | that memory was watched (start of the scene is enough) |
| `stoneSites` | true | ch13 end | the roots showed the three stone sites |
| `ch14` | true | ch14 | Past the Reef: the Glassway is open |
| `stone:bell`, `stone:kettle`, `stone:saltglass` | 1-3 (order) | ch15-17 set at the Cairn | that Stair Stone set, and in which order |
| `stoneHeld:<site>` | true | ch15-17 Warden | Pip carries that stone (cleared when set) |
| `ch18` | true | ch18 | Pip reached Driftholm |
| `act3done` | true | ch18 end | Mote pulled his Ladder up |
| `ch19` | true | ch19 | Brightwell told the old way (T6) |
| `freed:duskwick` … `freed:threemills` | true | ch20 | that borrowed light streamed home |
| `ch20` | true | ch20 end | Pip reached the Crown |
| `mainEnding` | true | ch21 | the lights are home |
| `epilogueTalk` | true | ch21 epilogue scene | Wenna told Pip what is left |
| `ch22Invite` | true | ch22 | Shellby asked Pip to sit at dusk |
| `trueEnding` | true | ch22 | the 13th letter is thrown |
| `letter:1`, `letter:2`, `letter:3` | phrase number | ch22 | the three phrases Pip picked ([#letter-phrases](#letter-phrases)) |
| `crownShow` | 0-8 | any crown lantern beat | the crown count last shown on arrival at home ([#crown-show](#crown-show)) |
| `mem:<npc>:<act>` | true | memory lines | that villager's memory line for that act was shown |
| `met:<npc>` | true | first Talk | used by the lantern chain |

Derived counts (pure functions in `js/cond.js`, never stored):

| Count | Formula | Range |
|---|---|---|
| `seeds` | number of `S.seeds.*` equal to 2 | 0-3 |
| `beacons` | number of `beacon:*` flags set | 0-4 |
| `stones` | number of `stone:*` flags set | 0-3 |
| `lanterns` (crown lanterns lit) | `beacons + stones + (mainEnding ? 1 : 0)` | 0-8 |
| `memories` | number of `mem:1..12` set | 0-12 |
| `act` | 1 until `wennaAwake`; 2 from `lanternGot`; 3 from `act2done`; 4 from `act3done`; 5 from `mainEnding` | 1-5 |

The `act` number (with the Interlude counted inside act 2 from `lanternGot`, and inside act 1 before it) is what
"once per act" lines key on. The flag-key validator must accept capital letters: see Decisions.

<a id="scene-format"></a>
## Scene script format

Scenes are data in `js/content/scenes/<realm>.js`, run by `js/scenes.js` (pure: ordering, flags, skip) with the
runtime in `js/cutscenes.js`. [systems.md#scenes](./systems.md#scenes) owns the runner; this section owns the shape
the story writes in.

```js
// js/content/scenes/home.js
export default [{
  id: 'i6-wenna-wakes',            // stable; seen flag `scene:<id>`; replay key in the journal Lore tab
  realm: 'home',
  title: 'Wenna Wakes',            // Lore tab label (Hoot's Field Notes)
  start: 'auto',                   // 'auto' | 'talk:<npc>' | 'event:<EV>' | 'enter:<anchor>' | 'call'
  when: ['flag:bloomDusk', '!flag:wennaAwake', 'tod:duskOrNight', 'region:village', 'calm'],
  cast: { wenna: 'w:greatTree', shellby: 'npc:shellby' },
  skippable: true, replay: true,
  steps: [
    { fade: 'out', dur: 0.4 },
    { shot: 'two', at: 'w:greatTree.face', from: 'pip', dur: 0 },
    { fade: 'in', dur: 0.6 },
    { say: 'wenna', t: 'home.scene.i6.01', text: '...Pip. Little Pip. I can see you.' },
    { emit: 'sky.windowsOut', isle: 'pinewhistle', go: true },
    { wait: 1.2 },
    { flag: 'nellHome' },
    { pose: 'shellby', anim: 'lookUp', face: 'w:greatTree.face' },
  ],
  after: ['set:wennaAwake', 'quest:ch7.start'],
}];
```

**Step kinds** (exactly seven; anything else is an `emit`):

| Step | Fields | Blocks until |
|---|---|---|
| `shot` | `shot` preset, `at` (look target), `from` (camera anchor, optional), `dur` (blend s), `ease` | the blend ends |
| `say` | `say` (speaker id or `'card'`), `t` (text id), `text` (English, for review), `frame` (`'default'` / `'wenna'` / `'letter'`), `wait` (`'confirm'` default, or seconds) | confirm, or the seconds |
| `wait` | `wait` (seconds) | the time |
| `flag` | `flag` (name, or `{ name: value }`) | immediately |
| `emit` | `emit` (event name) plus its arguments | immediately (events never block) |
| `fade` | `fade` (`'out'` black, `'white'`, `'in'`), `dur` | the fade ends |
| `pose` | `pose` (actor id), `anim`, `face` (anchor, optional), `move` (anchor, optional: walk there at 1.6 m/s) | the walk ends, or immediately for a pose |

Any step may carry `go: true` (start it and continue at once without waiting).

**Anchors** used by `at`, `from`, `face`, `move`: `pip`, `pip.head`, `npc:<id>`, `boss:<id>`, `actor:<id>` (a scene
actor spawned with `emit: 'spawn'`), `w:<named anchor>` from the realm's `W` (`w:pedestal`, `w:greatTree`,
`w:greatTree.face` = trunk point at 7.5 m height facing south, `w:greatTree.crown` = 15 m, `w:landmark:<id>`,
`w:jetty`, `w:cairn.needle`), `sky:<card>` (`sky:isle_a` … `sky:isle_f`, `sky:skyIsle`, `sky:ladder`), and literal
`xyz:x,y,z`.

**Shot presets:** `two` (over Pip's shoulder at the speaker, 2.4 m behind, 1.4 m up), `over` (over the speaker's
shoulder at Pip), `look` (from `pip.head` toward `at`, first-person framing), `wide` (14 m back, 6 m up, both in
frame), `crane` (rises from `from` to `at` over `dur`), `orbit` (circles `at` at the current radius; `deg` field),
`pov` (exactly the player's first-person camera, viewmodel visible), `hold` (keep the current camera).

**Events** the runtime handles: `sky.windowsOut {isle}`, `sky.windowsOn {isle}`, `sky.streak {from, to}`,
`sky.ladder {show}`, `sky.flight {n}`, `fx.<name> {at}`, `sfx.<id>`, `music {track, layer}`, `toast {t, text}`,
`card {id}` ([#act-cards](#act-cards)), `item {id}` (the shipped item-get beat), `spawn {actor, model, at}`,
`despawn {actor}`, `light {id, on}`, `crown {n}`, `quest {id, step}`, `face {who, state}` (Wenna's face: `sleepy`,
`awake`, `scrunch`, `smile`, `sad`), `chain {}` (the lantern chain, [#lantern-chain](#lantern-chain)).

**Rules every scene follows** (the unit tests in S-034 check the first four):
1. **Skip-safe.** Holding `{interact}` for 0.8 s skips. On skip the runner applies every `flag` step not yet run and
   then `after`, in order, so a skipped scene leaves exactly the save state of a watched one.
2. **Replayable.** `replay: true` scenes are listed in the journal's Lore tab once seen; a replay runs with flags
   and `after` disabled and restores Pip where he stood.
3. **Never mid-fight.** `when` always includes `calm` (no enemy within 24 m, no boss fight, no modal open). An
   `auto` scene whose `when` becomes true during a fight waits.
4. **Never more than 90 s** unskipped, except the finale's Given Light (180 s) and ch22 (150 s).
5. **First person.** At scene start the runner remembers the view mode, shows Pip's GLB for every shot except `pov`
   (and `look`, which hides it), and restores the view and a yaw facing `endFace` (default: the main speaker) at the
   end. In `pov` shots the viewmodel shows what Pip holds (a Starseed, the Lantern, a Stair Stone, a parade lantern).
6. **Sound for what the camera may not see.** Every world change a scene causes off-camera has a `sfx` (a window
   going out: soft "pff" chime, `sfx.lightOut`; the Lamp Thief: a rising glass trill, `sfx.mote`; the crown lantern:
   a bell tone, `sfx.crown`), so a player looking elsewhere in an ambient beat still hears it.
7. **Ambient beats are not scenes.** Crown lanterns lighting, a region healing and islander visits are world beats:
   a sound, a toast and the change itself, no camera. Only the beats named "Scene" below take the camera.
8. **Lines.** Every `say` is one dialogue box (≤ 220 characters). A speaker never says more than four boxes in a row.
9. **Table scenes.** Most scenes below are written as tables for review. Converting one is mechanical: each numbered
   row is one `say` step (speaker, the row's text, text id `<realm>.scene.<sceneId>.<nn>`); each row marked `-` is the
   staging written in it, as `shot`, `pose`, `emit`, `fade` or `wait` steps in the same order; the paragraph after the
   table gives `after`. Scenes printed as code are already in the format.

<a id="crown-show"></a>
### The crown show on arrival home

Crown lanterns can light while Pip is on another isle (only one realm is loaded). On every arrival at home, if
`lanterns > crownShow`, the scene `crown-show` plays: `shot crane from w:pedestal at w:greatTree.crown dur 2.5`,
`emit crown {n: lanterns}` lights the new lantern(s) one per 0.8 s with `sfx.crown`, toast "✿ The Great Tree's
crown: {n} of 8 lanterns lit", `flag {crownShow: lanterns}`. 6 s, skippable, not replayable. On the isle where the
lantern was earned, the kindle scene shows only the toast.

---

<a id="act-cards"></a>
## Act cards

All cards use the shipped ending overlay (`ui.endingEl`: title `.et`, subtitle `.es`, extra `.ex`), its painted art
slot `.eart`, and "Press any button to continue." (touch: "Tap to continue."). Each card ships only in the same release
as the content behind it (CANON §14). Art briefs: [#art](#art).

| Card id | When | `.et` | `.es` | `.ex` | Art key |
|---|---|---|---|---|---|
| `act1-shipped` | I.5 until ch7 ships (today's card, unchanged) | ✿ Starseed Isle is blooming again! ✿ | Thanks for playing | The isle is yours to explore. | `ending_art` (shipped) |
| `act1` | I.5, from the release with ch7 (S-067) | ✿ Starseed Isle is blooming again! ✿ | End of Act One · The Sneeze | But far across the water, the lights are going out... | `ending_art` (shipped) |
| `act2` | ch12, end of the Tower scene | End of Act Two · The Dimming | The Ladder is going up. | (none) | `card_act2` |
| `act3` | ch18, end of the arch scene | End of Act Three · The Remembering | Above the clouds, the stars are waiting. | (none) | `card_act3` |
| `act4` | ch21, end of Given Light | ✿ The lights are home ✿ | End of Act Four · The Lantern Sky | Mote's star is the new one, just above the Tree. | `card_act4` |
| `true` | ch22, after the bottle | ✿ To whoever finds this ✿ | Thank you for playing. | The Night is yours whenever you sit with Shellby. | `card_true` |

**Chapter banners.** Each chapter from 7 on opens with the region-card banner (the shipped name-card component):
big line "Chapter 7", small line the chapter title. Shown once at the chapter's first step, 3.0 s, never during a
scene. Titles: 7 Under the Roots · 8 Duskwick · 9-11 the isle's name (Pinewhistle, Archwater, Threemills; the
number is the order the player arrives: the first isle reached after ch8 is Chapter 9) · 12 The Lamplighters' Tower ·
13 Into the Rootdeep · 14 Past the Reef · 15-17 The Sunken Bell, Kettle Isle, Saltglass Flats (numbered by arrival
order) · 18 The Starstair · 19 The Starmeadow · 20 The Ladder of Lights · 21 The Second Sneeze · 22 The Hundred-Year
Night. Act I keeps no banners (its region cards already do the job).

---
<a id="act-I"></a>
## Act I: The Sneeze (chapters 1-6, home, 4.0 h)

Every shipped line, placement and fight stays (CANON-NOW §9). Act I gains reasons, instalments, handovers, healed
regions, boughs, music layers, memory lines and its turn (I.6). Emotional target: **wonder**.

### Main quest data: "The Sneeze"

Quest `q:sneeze` (kind `main`, realm `home`), the journal's first entry. The compass texts of today are unchanged:
the quest engine's `objective()` returns the shipped strings while this quest is active, so `test:playthrough` reads
the same words.

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 `talk` | `S.introDone` | Elder Shellby has news about the Great Tree. | Somebody by the Tree is waiting for you, dear. | Talk to Elder Shellby beside the pedestal. Press {interact} when you're close. |
| 1 `seeds` | `seeds>=3` | Bring the three Starseeds home to the pedestal ({n} of 3). | Three guardians, three corners. Which corner haven't you been to? | Grumble Shroom is north in the Woods, Frostbun east past the river bridge, Captain Pinch south past the lighthouse. Your compass points to the nearest. |
| 2 `bloom` | `flag:bloom` | Watch the Great Tree bloom. | You're holding all three. Where do they go? | Walk up to the pedestal under the Tree and press {interact} to place each Starseed. |
| 3 `dusk` | `flag:wennaAwake` | Visit the Great Tree at dusk. | She's been sleepy all day. Maybe evening suits her. | Be in Sprout Village when the sky turns orange. Wait by the Tree if you like. |

Before the ch7 release ships, step 3 does not exist and the quest completes at the bloom (the shipped game).

<a id="I.1"></a>
### I.1 The Morning After (KEEP)

*Trigger:* New Adventure. *Sets:* `S.introDone` (shipped). *Hours:* 0.2.

Shellby's three intro pages stay word for word. A fourth box is added after page 3 (S-008):

> "The guardians are older than they look. Be gentle, and they'll be gentle back." (`home.npc.shellby.intro.4`)

Everything else in I.1 (signpost, compass, coach marks, first region card) is shipped.

<a id="I.2"></a><a id="I.3"></a><a id="I.4"></a>
### I.2-I.4 The Woods, Frost and Sea Starseeds (DEEPEN, any order)

*Trigger:* `S.introDone`. *Sets:* `calm:<id>` = order (1-3), `handover:<id>`, the shipped `S.bosses.<id>` and
`S.seeds.<id> = 1`. *Hours:* 3.0 for the three. Beat ids: I.2 = Woods (Grumble Shroom, boss id `woods`), I.3 = Frost
(Frostbun, `peaks`), I.4 = Sea (Captain Pinch, `shores`).

**Before the fight (seen, never told).** One post-pass, `placeReasons` (S-004,
[atlas-home.md#placeReasons](./atlas-home.md#placeReasons)), puts each Catcher's reason beside its arena:

| Catcher | Props seen before the fight | `[E] Look` text on the main prop (≤ 1 box) |
|---|---|---|
| Grumble Shroom | the three fairy rings near the Hollow are dark; three little unlit night-lights in a row by the Hollow sign | "Three tiny night-lights, none of them lit. Somebody small must sleep near here." |
| Captain Pinch | the lamp room dark by day; a spyglass on the gallery pointing out to sea; a chalk tally of nights on the lighthouse door | "Chalk marks on the door, one for every night. Somebody is counting." |
| Frostbun | a tiny knitted scarf on a rock; a snow nest shaped like a cradle | "A little nest of snow, smoothed round like a cradle. It's still warm in the middle." |

**The handover scene (first win only).** Replaces today's victory burst. The shipped seed pick-up fanfare stays as
the scene's last step. One script per Catcher, identical in shape:

```js
{ id: 'handover-woods', realm: 'home', title: 'Grumble Kept It Warm',
  start: 'event:BOSS_DEFEATED', when: ['boss:woods', '!flag:handover:woods'],
  cast: { grumble: 'boss:woods' }, skippable: true, replay: true,
  steps: [
    { shot: 'wide', at: 'boss:woods', dur: 0.6 },
    { pose: 'grumble', anim: 'sitDizzy' },             // sits down; five dizzy stars circle for 1.0 s
    { emit: 'fx.dizzyStars', at: 'boss:woods', go: true },
    { emit: 'sfx.bossSit' },
    { wait: 1.0 },
    { shot: 'two', at: 'boss:woods', from: 'pip', dur: 0.5 },
    { say: 'grumble', t: 'home.handover.woods.1', text: 'Hmph. Fine. FINE. Take it.' },
    { say: 'grumble', t: 'home.handover.woods.2', text: 'The little ones were scared of the dark, you know. Since she went droopy, the woods stopped glowing. That seed lit them right up.' },
    { pose: 'grumble', anim: 'holdOut' },              // the Starseed floats up out of the cap into both hands
    { say: 'grumble', t: 'home.handover.woods.3', text: 'Bring it home. Tell her Grumble kept it warm.' },
    { shot: 'pov', dur: 0.4 },
    { flag: { 'calm:woods': 'next' } },                // 'next' = 1 + number of calm:* already set
    { emit: 'item', id: 'seed:woods' },                // shipped fanfare; S.seeds.woods = 1
  ],
  after: ['set:handover:woods'] }
```

| Boss id | Speaker | Line 1 | Line 2 | Line 3 |
|---|---|---|---|---|
| `woods` | Grumble Shroom | Hmph. Fine. FINE. Take it. | The little ones were scared of the dark, you know. Since she went droopy, the woods stopped glowing. That seed lit them right up. | Bring it home. Tell her Grumble kept it warm. |
| `shores` | Captain Pinch | Belay that! ...Aye, aye. Ye've a kind hand, I'll give ye that. | My lamp went dark the night she wilted, and Nell Pelliwick's boat is still out past the reef. A skipper doesn't let a lamp go out with a boat at sea. | Take it to the Tree. She'll want a light to come home by. |
| `peaks` | Frostbun | Brrr-rrr... no. Mine. | It was shivering when it landed. Seeds catch cold. Everyone knows that. I hugged it all night. | You will keep it warm? Promise? ...Hop to it, then. |

Voices from here on: Pinch "ye / aye / belay"; Grumble short grumbles; Frostbun short sleepy sentences, rolled r's.

**After the handover, until the bloom**, the Catcher stays sitting, awake, in its open arena (the vines drop) with
`[E] Talk · <Name>`. It speaks the first line that holds:

| Catcher | Its seed placed (`S.seeds.<id> == 2`) | Otherwise |
|---|---|---|
| Grumble Shroom | Look. They glow on their own again. I am still grumpy. On principle. | Still here. Don't make a thing of it. / The little ones keep asking where the glow went. I told them a kind hand has it. Hmph. |
| Captain Pinch | The lamp's burnin' by day an' all now. Won't stop till Nell's home, an' neither will I. | I'm restin' me claws, is all. Ye go on. / Keep an eye on the sea for me, would ye? Look for a little lantern. |
| Frostbun | Can feel the spring from up here. Warrrm. Good seed. | Mmm. Sleepy now. / You are keeping it warm? Good. Good little bun. |

At the bloom they go back to napping in their arenas and the shipped rematch flow takes over unchanged.

<a id="healed-regions"></a>
**When the seed is placed** (place-keyed world change, within 10 s, sound + no camera; S-011,
[atlas-home.md#healed-states](./atlas-home.md#healed-states)):

| Seed placed | Change in its region | Sound |
|---|---|---|
| Woods | the three fairy rings glow brighter for good; glow-moss creeps over Grumble's Crown's root flare; the three night-lights light | `sfx.glowUp` (soft rising chime) |
| Sea | the lighthouse lamp burns by day as well as by night until `nellHome` | `sfx.lampOn` |
| Frost | a warm spring steams beside the Summit (steam card, pond prop); the Cairn crystal hums at night (`sfx.cairnHum`, audible within 40 m) | `sfx.springBubble` |

At the pedestal, on each placement (count-keyed, any order):
- **Boughs.** The Great Tree's bough facing that seed's region blossoms (Woods bough north, Peaks bough east, Shores
  bough south; the Meadow bough, west, stays in leaf until side story 14, [side-content.md#ss-14](./side-content.md#ss-14)).
  Visual only, child meshes, no collider ([atlas-home.md#great-tree](./atlas-home.md#great-tree)).
- **Music.** The village theme gains one instrument layer per seed placed (1: a plucked harp line, 2: a soft flute
  countermelody, 3: a hand-drum heartbeat); [art-audio.md#music-home](./art-audio.md#music-home) holds the notes.
- **Ribbit** keeps his shipped count lines (1 "I hereby declare a holiday! ...Right after the other two.", 2 "I have
  been practising my victory croak. RIBBIT! ...It needs work.", 3 "I want to see the Tree bloom before my nap.").

<a id="shellby-instalments"></a>
### Shellby's instalments (the myth, told in pieces)

Each instalment is one box, prepended once to Shellby's shipped lines for the matching state, marked `inst:n`.
Keyed to how many seeds are home, never to which. Any instalment the player missed is told after the bloom, one per
Talk, in order, using the post-bloom wording where one exists. The Lore tab lists every instalment heard (S-038).

| Key | Condition | Line |
|---|---|---|
| `inst:1` | `seeds==1` | Do you know why she sneezes, dear? The old songs say she came down from the sky, long ago. Every hundred years she misses it, and she sneezes her light up toward the stars, like a letter. *Still here,* it says. |
| `inst:2` | `seeds==2` | The guardians aren't thieves, little sprout. They're catchers. They catch what flies so the sky doesn't keep it, and they hold it one night for a kind hand. I think they just got... attached. |
| `inst:3` | `seeds<3` and all three carried or placed | Last time she sneezed, someone very small carried her seeds home. Smaller than you, even. ...Well. Go on, then. |
| `inst:3` (post-bloom wording) | `flag:bloom` and `!inst:3` | Last time she sneezed, someone very small carried her seeds home. Smaller than you, even. ...Well. Never mind me. |

T1 fires at `inst:1`, T2 at `inst:2`; `inst:3` is the first plant for the true ending (T7). Shellby's lines for
later acts are in the reaction tables ([#act-II-reactions](#act-II-reactions), [#act-III-reactions](#act-III-reactions),
[#act-IV-reactions](#act-IV-reactions)).

<a id="act-I-sky"></a>
### A light on the sky isle (Act I, from the first night)

*Trigger:* none; it is ambient. On one night in three (`dayIndex % 3 === 0`, the first night of a New Game included),
between 21:00 and 04:00, a single small light drifts across the shipped north-east sky-isle card
([atlas-home.md#sky](./atlas-home.md#sky), "Mote's light (early)"). Nothing explains it. Hoot notices it once, at night
after the first seed is placed: "Hoo. A star that moves. Stars do not move. I have written to myself about it."
(`seen:hoot.star`). Shellby's instalments say nothing of it, which keeps T7 clean. II.M names the light; from then on it
shows two nights in three. Built by S-011b; S-128 changes only the frequency.

<a id="I.5"></a>
### I.5 The Bloom (KEEP)

*Trigger:* the third seed placed (shipped). *Sets:* `S.ending` (shipped), `bloom`. *Hours:* 0.2.

The bloom cutscene is unchanged except for one addition: the three Catchers stand at the plaza edge, watching. They
are scene actors (their shipped GLBs, idle pose `watchHappy`), spawned at fade-out and despawned at the card; the
real bosses stay in their arenas. Marks (nearest walkable cell, at least 3 m from any collider, facing the Tree):

| Actor | Mark (x, z) | Pose at the bloom moment |
|---|---|---|
| Grumble Shroom | (−9, −2) | arms crossed, then one small clap |
| Frostbun | (11, 4) | ears up, a happy hop |
| Captain Pinch | (−8, 18) | doffs his hat |

The card is `act1-shipped` until the ch7 release, then `act1` ([#act-cards](#act-cards)). In the same PR that
switches the card (S-067), `test:playthrough`, `test:opening` and the ending-art caption are updated (owner
decision 7).

<a id="I.6"></a>
### I.6 Wenna Wakes (NEW, chapter 6)

*Trigger:* flag `bloomDusk` (set the first time the clock crosses into dusk after the bloom card closes, or at once
when a bloomed save is Continued at dusk or night) and Pip is in Sprout Village and `calm`. If Pip is elsewhere, the
scene starts the moment he enters the village at dusk or night. It cannot be missed: the compass reads
"Visit the Great Tree at dusk" until it plays. *Sets:* `nellHome`, `wennaAwake`. *Starts:* quest `q:ch7`. *Hours:* 0.1.

**Scene `i6-wenna-wakes`** (about 75 s; replayable):

```js
steps: [
  { fade: 'out', dur: 0.4 },
  { emit: 'warp', who: 'pip', at: 'xyz:0,0,10.5', face: 'w:greatTree.face' },
  { emit: 'face', who: 'wenna', state: 'awake' },
  { shot: 'two', at: 'w:greatTree.face', from: 'pip', dur: 0 },
  { fade: 'in', dur: 0.8 },
  { emit: 'sfx.leafRustle' },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.01', text: '...Pip. Little Pip. I can see you.' },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.02', text: 'Thank you for bringing my light home. I was so tired I had forgotten how to wake up.' },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.03', text: 'Oh. Pip, look. Out there, on the water.' },
  { emit: 'sky.windowsOn', isle: 'near4', go: true },        // a, b, c, d night windows glow
  { shot: 'crane', from: 'w:pedestal', at: 'sky:isle_d', dur: 3.0 },   // camera rises to (0, 32, 0), faces WSW
  { wait: 1.2 },
  { emit: 'sky.windowsOut', isle: 'threemills' }, { emit: 'sfx.lightOut' },
  { emit: 'sky.streak', from: 'sky:isle_d', to: 'sky:skyIsle', go: true },
  { shot: 'orbit', at: 'sky:isle_a', dur: 3.0 },             // clockwise to N-NW
  { emit: 'sky.windowsOut', isle: 'pinewhistle' }, { emit: 'sfx.lightOut' },
  { emit: 'sky.streak', from: 'sky:isle_a', to: 'sky:skyIsle', go: true },
  { shot: 'orbit', at: 'sky:isle_b', dur: 3.5 },             // past the sky isle (NE) to E-SE
  { emit: 'sky.windowsOut', isle: 'archwater' }, { emit: 'sfx.lightOut' },
  { emit: 'sky.streak', from: 'sky:isle_b', to: 'sky:skyIsle', go: true },
  { shot: 'orbit', at: 'sky:isle_c', dur: 2.5 },             // S-SE: the stone tower's window, held
  { wait: 2.0 },
  { emit: 'sky.windowsOut', isle: 'duskwick' }, { emit: 'sfx.lightOut' },
  { emit: 'sky.streak', from: 'sky:isle_c', to: 'sky:skyIsle', bright: true, go: true },
  { emit: 'sfx.mote' },
  { shot: 'look', at: 'sky:skyIsle', from: 'xyz:0,32,0', dur: 3.0 },   // follow the bright streak to the NE
  { emit: 'fx.skyGlint', at: 'sky:skyIsle' },
  { wait: 1.5 },
  { shot: 'look', at: 'w:landmark:lighthouse', from: 'xyz:0,32,0', dur: 2.5 },
  { emit: 'spawn', actor: 'dandelionFar', model: 'boat_far', at: 'xyz:60,0,200' },
  { emit: 'actor.path', actor: 'dandelionFar', to: 'xyz:-10,0,132', s: 7.0, go: true },
  { emit: 'sfx.boatBell' },
  { wait: 5.0 },
  { flag: 'nellHome' },
  { emit: 'toast', t: 'home.toast.nellHome', text: '✿ Nell is home! The lighthouse brought her in.' },
  { fade: 'out', dur: 0.3 },
  { emit: 'despawn', actor: 'dandelionFar' },
  { pose: 'shellby', anim: 'walk', move: 'xyz:-2.5,0,9.8', face: 'w:greatTree.face', go: true },
  { shot: 'wide', at: 'w:greatTree.face', dur: 0 },
  { fade: 'in', dur: 0.5 },
  { say: 'shellby', t: 'home.scene.i6.04', text: 'Hello, Wenna, dear. It\'s been a long time.' },
  { emit: 'label', who: 'wenna', name: 'Wenna' },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.05', text: 'Shellby? Oh, look at you. You got old.' },
  { say: 'shellby', t: 'home.scene.i6.06', text: 'That\'s what happens, dear. Some of us can\'t sneeze it off.' },
  { shot: 'two', at: 'w:greatTree.face', from: 'pip', dur: 0.6 },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.07', text: 'Someone is putting out the lights. I don\'t know who. Will you find out for me?' },
  { emit: 'sfx.rootCreak' },
  { shot: 'wide', at: 'w:rootDoor', from: 'xyz:0,3,-17', dur: 1.2 },
  { emit: 'fx.rootDoorOpen', at: 'w:rootDoor' }, { emit: 'light', id: 'rootDoor', on: true },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.i6.08', text: 'There. A door in my roots, on the north side. It goes down to your room, little Pip, and further than that. Come and see.' },
],
after: ['set:wennaAwake', 'quest:q:ch7.start'],
endFace: 'w:rootDoor'
```

**World after I.6:** the lighthouse stops burning by day; Nell's door note reads "Back! ...Told you. — N."; Nell
stands at her cottage door by day ([cast.md#nell](./cast.md#nell)); the Dandelion is moored at the jetty anchor
beside three old posts (the jetty itself is built at the end of ch7); the four near horizon cards keep their windows
dark at night; the root door shows (`placeRootDoor`, [atlas-home.md#pips-nook](./atlas-home.md#pips-nook)). Compass:
"Under the Roots". T3 fires here.

**Nell's lines between I.6 and the jetty:** "Pelliwick. Out past the reef longer than I meant. Pinch kept his lamp
burning the whole time, bless his shell." / "The *Dandelion*'s sound. Her lamp's not. Nobody sails the Wide Blue at
night without a lamp, and the nights are getting darker out there."

**Act I end state** (chapter fixture `act1-end`): `S.ending`, `bloom`, `wennaAwake`, `nellHome`, three `calm:*`,
three `handover:*`, `q:sneeze` done, `q:ch7` at step 0, `lanterns == 0`.

---

<a id="ch7"></a>
## Interlude: Under the Roots (chapter 7, 2.0 h)

*Trigger:* `wennaAwake`. *Sets:* `lanternGot`, `rolloCalm`, `jettyOpen`. Emotional target: wonder turning to
purpose. The act card `act1` and I.6 ship in the same release as this chapter (CANON §14).

Quest `q:ch7` "Under the Roots":

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | entered the Nook | Go through the root door on the Great Tree's north side. | She said north. Walk round her trunk. | The root door is on the far side of the Great Tree from the pedestal. Walk up and press {interact}. |
| 1 | `lanternGot` | Find what's glowing Under the Roots. | Follow the little lights in the walls. | Take the stair down from your Nook and keep going deeper. The glowing bud is in the middle rooms. |
| 2 | `rolloCalm` | Find out what keeps rolling the tunnels flat. | Listen for the rumbling. | Sir Rollo is in the big round room at the bottom. Hop his rolls and hit him when he's curled and stuck. |
| 3 | `scene:ch7-wenna-bottom` | Hear what the Great Tree has to say. | She's listening, down at the very bottom. | Walk into the glowing root chamber past Sir Rollo. |
| 4 | talked to Nell with the Lantern | Show Nell your Lantern. | Who needed a lamp to sail at night? | Nell Pelliwick stands at her cottage door by day, east of the Tree. Talk to her. |
| 5 | `jettyOpen` | Meet Mayor Ribbit at the beach below the lighthouse. | There's a speech happening. Speeches always happen. | Go south past the lighthouse to the old posts on the beach. Mayor Ribbit is waiting there. |

**The Nook (step 0).** First entry plays `ch7-nook` (12 s): Pip's room in the roots, bed, window, four empty
shelves. Wenna, off-screen, frame `wenna`: "Your room's grown, little sprout. I had more space than I knew." Then
"There's a stair at the back. Mind the steps. I never did get round to steps." ([atlas-home.md#pips-nook](./atlas-home.md#pips-nook)).

**The Glowbud Lantern (step 1).** Scene `ch7-lantern`, played at the bud room of Under the Roots
([dungeons.md#d1](./dungeons.md#d1)). Steps: shot `look` at the bud on the wall root; Wenna (off-screen): "It's dark
down here, isn't it? I never minded. But you're not a root." / "Hold still. This might tickle." `fx.sparkDown` (a
gold spark runs down the root into the bud, 1.2 s, `sfx.sparkle`), the bud opens; `emit item lantern` with the text
"You got the Glowbud Lantern! It glows with the Great Tree's own light. Hold it up with {tool}." Then Wenna: "A
little of me, in a bud. It lights the dark. I think it can do more than that. We'll see." Flag `lanternGot`.

**Sir Rollo (step 2).** The fight and his sit-down lines: [creatures.md#boss-rollo](./creatures.md#boss-rollo).
After the sit-down, one story line he says on every later Talk until the jetty: "Forty years of rolling, and all
anybody had to say was 'stop'. ...Nobody did, you know. Not once." After `jettyOpen`: "I'm rolling Digby's tunnels
now. He asked nicely. Nobody's ever asked nicely."

**Wenna at the bottom (step 3).** Scene `ch7-wenna-bottom` (45 s) in the root chamber, the last room. The chamber's
walls are Wenna's great roots, faintly gold; one root runs off into the dark marked with a spiral.

| # | Speaker | Line |
|---|---|---|
| 1 | Wenna | Down here is where I'm most me. Can you feel it hum? |
| 2 | Wenna | Every isle out there has a beacon, Pip. Each one burns with a little of my light. It runs out along my roots, under the sea. |
| 3 | Wenna | Tonight they went out. Not blown out. Taken. Someone gathered them up, very carefully. |
| 4 | Wenna | Your Lantern holds my light. Hold it to a dark beacon and the beacon will catch again. ...I think. I'm fairly sure. |
| 5 | Wenna | You'll need a boat. Nell needs a lamp to sail at night. Pip, I think you're holding one. |

`emit fx.rootGlow` runs gold along the spiral root as she says line 2. A root lift (`[E] Use · Root Lift`) carries Pip
back to the Nook. On return, `ch7-keepsakes` (6 s): the four shipped keepsakes found so far appear on the Keepsake
Hollow shelves, toast "✿ Your keepsakes found a home in the Nook". Unfound ones appear when found from now on.

**Nell (step 4).** Talk with the Lantern: "Now *that's* a lamp. Clip it on the mast and we'll see the reef from a mile
off." / "I'll need a jetty, mind. The old one washed out before you were born. Ribbit's been 'about to build it' for
years." Ribbit's next Talk sends Pip to the beach.

**The jetty (step 5).** Scene `ch7-jetty` (40 s) at the jetty anchor (−14, 126) below the lighthouse. Ribbit, Nell,
Clover and the five Quackenbush ducks stand on the sand; Captain Pinch watches from the lighthouse gallery when his
handover is done (always true by now).

| # | Speaker | Line |
|---|---|---|
| 1 | Mayor Ribbit | Citizens! Ducks! Small frog in the well, if you can hear me! Ahem. |
| 2 | Mayor Ribbit | Today, on behalf of the town treasury, the town, and the treasury... |
| 3 | Mayor Ribbit | I hereby declare this jetty... jettied. RIBBIT! |
| 4 | Nell Pelliwick | It's a jetty, Mayor. ...It's a good jetty. Hop aboard, Pip. |

At line 3: `fade white 0.3`, the jetty planks appear (the `placeJetty` built state), `sfx.croak`, the ducks quack in
a ripple (`sfx.duckRipple`). `after: ['set:jettyOpen']`. `[E] Sail · the Dandelion` now works at the jetty
([systems.md#travel](./systems.md#travel)).

**Before Duskwick ships**, every isle on the chart is a fog bank and Nell says "Nell won't risk the fog yet." as a
toast; the compass reads "The isle is blooming ✿". From the Duskwick release on, the compass reads "Sail to
Duskwick" and the chart shows Duskwick clear.

*End state* (`ch7-end`): `lanternGot`, `rolloCalm`, `jettyOpen`, item `lantern`, `q:ch7` done, `q:ch8` active.

---
<a id="act-II"></a>
## Act II: The Dimming (chapters 8-12, 16.5 h)

Duskwick first, the three isles in any order, the Tower last. Count: 3 beacons + the Tower. Emotional target:
**worry**, worn in sunshine (dim isles are sunny by day; what is missing is a sound, a rhythm or a glow).

<a id="ch8"></a>
### Chapter 8: Duskwick (fixed, 2.0 h)

*Trigger:* `jettyOpen` and Duskwick shipped. *Sets:* `thiefSeen`, `ch8`. *Gives:* item `chart` (the Lamplighter's
Chart), Lamp Log 1 ([lore.md#lamp-logs](./lore.md#lamp-logs)). Place: [atlas-isles.md#duskwick](./atlas-isles.md#duskwick).

Quest `q:ch8` "Duskwick":

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | arrived in Duskwick | Sail to Duskwick. | Nell knows the way. | Talk to Nell at the jetty and pick Duskwick on the chart. |
| 1 | talked to Granny Wick | Find out why Wickhaven is so sleepy. | The moths all point the same way when they yawn. | Granny Wick lives at the top of the stilt town in Wickhaven, under the biggest lamp. |
| 2 | tried the Tower door | Visit the Lamplighters' Tower. | It's the tallest thing on the isle. | Walk north-east to Tower Head and try the door. |
| 3 | `thiefSeen` | Climb the Tower's outside stair. | The door won't open, but the stair goes up. | Follow the stone stair that winds round the outside of the Tower. |
| 4 | `ch8` | Tell Granny Wick what you saw. | Someone old will want to hear this. | Go back to Granny Wick in Wickhaven. |

**Arrival (step 0).** The chart sailing card (4-6 s, [systems.md#travel](./systems.md#travel)), then Duskwick's jetty.
Wickhaven's moths droop on their stilt decks, half asleep in bright sunshine; the town lamps are dark. Region card
"Wickhaven · Stilts, moths and lamplight". Flick ([cast.md#flick](./cast.md#flick)) is the first moth awake: "Oh!
A visitor! Nobody visits. Great-Granny will want to see you. She wants to see everybody. She can't see very well."

**Granny Wick (step 1).** Scene `ch8-granny` (60 s) in her library-house:

| # | Speaker | Line |
|---|---|---|
| 1 | Granny Wick | A little one in a green hood. With a light in his hand. ...Oh, my. That's *her* light, isn't it? |
| 2 | Granny Wick | I've kept the Tower window lit for a hundred years, dear. It went out the night your Tree bloomed. All of them did. |
| 3 | Granny Wick | Every beacon holds a share of her light. Each isle keeps its rhythm by it: the songs, the tides, the harvest. |
| 4 | Granny Wick | Somebody is collecting them. Somebody who knows exactly where to look. |
| 5 | Granny Wick | Take this. The old Lamplighters' chart. And this, the first page of our logbook. Read it when you're somewhere cozy. |

`emit item chart` ("You got the Lamplighter's Chart! The isles of the Wide Blue, drawn by the Lamplighters. Open it
with {map}."), `emit item log:1`. The chart shows Pinewhistle, Archwater and Threemills clear (or as fog banks if
not shipped). Granny Wick's tic and look: [cast.md#granny-wick](./cast.md#granny-wick).

**The Tower door (step 2).** `[E] Knock · Tower Door`: "Locked. From the inside. Something in there is ticking." Toast
nothing; the quest advances.

**The glimpse (step 3).** Walk-in trigger at the stair's top landing (20 m up). Scene `ch8-thief` (14 s):

```js
steps: [
  { emit: 'sfx.mote' },
  { emit: 'spawn', actor: 'thief', model: 'mote', at: 'w:tower.gallery', state: 'cloaked' },
  { shot: 'look', at: 'actor:thief', dur: 0.5 },
  { wait: 0.8 },
  { pose: 'thief', anim: 'startle' },
  { emit: 'actor.path', actor: 'thief', to: 'xyz:+0,+60,+0', s: 2.5, go: true },   // straight up from the gallery
  { shot: 'look', at: 'actor:thief', dur: 2.5 },
  { emit: 'sky.streak', from: 'actor:thief', to: 'sky:skyIsle', go: true },
  { emit: 'despawn', actor: 'thief' },
  { say: 'card', t: 'cc.scene.thief.1', text: 'A little cloaked light, and then nothing. It went straight up.', wait: 2.5 },
],
after: ['set:thiefSeen', 'journal:thief']   // journal Bestiary/People entry "the Lamp Thief"
```

Mote's model: [cast.md#mote](./cast.md#mote) (code-built emissive figure; state `cloaked` hides his face).

**Back to Granny Wick (step 4).** "Straight up, you say? Then somebody knows the way up. Nobody's known the way up in a
hundred years." / "The Tower can wait; whoever locked it isn't coming out today. Wake the other isles first, dear. Three
lights should be enough to wake the old lamp." Flag `ch8`. Compass: "Relight a beacon" (nearest of the three isles on
the chart). Granny Wick's later lines: [#act-II-reactions](#act-II-reactions).

*End state* (`ch8-end`): `ch8`, `thiefSeen`, items `chart`, `log:1`, `q:ch8` done, three isle quests offered.

<a id="ch9-11"></a>
### Chapters 9-11: Pinewhistle, Archwater, Threemills (any order, 4.0 h each)

Every isle runs the same backbone, varied by a set piece on each land and two changed loops ([#set-pieces](#set-pieces),
[#loop-variations](#loop-variations)): **the people** (one main step per region, 3-4 steps, opening the dungeon),
**the depths** (the dungeon and its tool, [dungeons.md](./dungeons.md)), **the Warden** (calmed at the beacon in the
dungeon's last room, then `[E] Kindle · Beacon`). The chapter number is the order of arrival (banner "Chapter 9" for
the first isle visited after ch8). A critical path needs only the Lantern and the isle's own tool (pacing rule 6).

**Quest template** `q:<isle>` (steps are data; text per isle below):

| Step | Done when | Kind |
|---|---|---|
| 0 | arrived | arrive at the jetty |
| 1-3 | per-isle event | the people (one per non-village region, in a fixed order on that isle) |
| 4 | tool item | the depths (tool found inside the dungeon) |
| 5 | Warden calmed | the Warden ([creatures.md](./creatures.md) holds the fight and the sit-down lines) |
| 6 | `beacon:<isle>` | `[E] Kindle · Beacon` |

| Isle | Step 1 | Step 2 | Step 3 | Dungeon · tool · Warden |
|---|---|---|---|---|
| **Pinewhistle** ([atlas](./atlas-isles.md#pinewhistle)) | **Acornet Hollow:** Elder Nutmeg: the squirrels can't sleep since the pine went quiet; they hoard Wenna's sleepy acorns "for safekeeping". Journal: "Find out why the Whistling Pine went quiet." | **Sawmill Run:** a log jams the mill wheel; Pip cuts the lashing ropes (three `[E] Use` knots) and the saws run, cutting planks for the ravine bridge. Journal: "Get the sawmill running." | **Misthollow Ravines:** Pip crosses the new bridge to Whistle Rise; the pine's root door is a glowbud door (Lantern). Professor Pinfeather has measured the pine's silence "to three decimal places". Journal: "Cross the ravines to the Whistling Pine." | Whistlehollow · Leaf Glider · Mossmantle |
| **Archwater** ([atlas](./atlas-isles.md#archwater)) | **The Raft:** Skipper Rafferty: the Raft is beached because the tide is stuck low; "it follows the arch's light, see, and the arch's light is gone". Journal: "Find out why the tide won't turn." | **Basalt Stairs:** the Raft's anchor chain is snagged high on the columns; Pip hops up the column steps and frees the winch (`[E] Use · Winch`) so the Raft won't drag when the tide comes. Journal: "Free the Raft's anchor chain." | **Kelp Shallows:** Pip cuts a path through the kelp (cuttables) at low water to the grotto mouth under the Great Arch; it is dark (Lantern). Journal: "Find a way under the Great Arch." | Undertow Grotto · Tide Bell · Old Gloop |
| **Threemills** ([atlas](./atlas-isles.md#threemills)) | **Haybury:** Ma Haybury: the mills stopped, the wheat stays green, pies are rationed; "Her Honkship hasn't come down off the hill in days." Journal: "Find out why the mills stopped." | **Tumble Hill:** Lady Honksworth flaps a mill's sails by hand and honks Pip away; Goody Gander explains the granary's sun-lamp is gone and gives Pip the vault key. Journal: "Ask about the granary." | **Millpond Marsh:** Pip turns the sluice wheel (`[E] Use · Sluice`) to drain the flooded vault steps; Honksworth storms past: "If ANYONE is going near my sun-lamp, it is ME." Journal: "Open the Granary Vaults." | the Granary Vaults · Thistle Hook · Lady Honksworth |

Pinewhistle has four regions, so its fourth region (Whistle Rise) is where the dungeon is; the same holds for
Archwater (the Tidepool Shelf, reached through the Undertow's early rooms, is on the main path: [#loop-variations](#loop-variations)) and Threemills (Orchard Rows is optional). Hints for steps 1-3
are the journal text as the nudge and the region plus the verb as the answer (for example "Sawmill Run is down the
stream east of Acornet Hollow. Walk up to the knots on the jammed log and press {interact}."); each isle's step adds
the exact pair to its quest data.

<a id="set-pieces"></a>
**Main-path set pieces (one per land, 15-25 minutes, no fail state).** The people steps are single interactions, so
each land also has one set piece on its main path, outside its dungeon. Each is a `before` sub-objective of an existing
quest step (S-091b adds the field), so no saved step index ever shifts.

| Land | Set piece | What the player does | Before step | Step |
|---|---|---|---|---|
| Duskwick | **The Lamp Round** | relights Wickhaven's eight stilt lamps with the Lantern along the deck walk; each wakes the nearest moths; the eighth opens Granny Wick's door | `meet` (ch8) | S-091b |
| Pinewhistle | **The Night Crossing** | after Mossy Span, mist fills Misthollow at dusk; Pip follows six Acornets' whistles, by firefly-jar light, to the root door; Dimlings in two fog pockets | `door` | S-106c |
| Archwater | **Floating the Raft** | works three winches round the beached Raft (6 s of cranking each) to haul it level onto log rollers, under telegraphed Squirt Urchin fire | `pearls` | S-127c |
| Threemills | **Follow the Honks** | at dusk follows Lady Honksworth (walking ahead) across the hedgerows, clearing six hedge gaps, to her vault under the hay | `hoist` | S-148c |
| The Rootdeep | Digby's walk | (already built in S-191a) | - | S-191a |
| The Glassway | **Fog on the Water** | sails through a sea fog by sound, bell buoy to bell buoy, past the hidden Teeth, scooping two lost mailbags, to Puffin Post | `post` (ch14) | S-203b |
| Kettle Isle | **The Boil-Over** | after Lady Fumarole, the Kettle boils over; Pip relights three shuttered forges in Forgefall with the Ember Sling through the steam | `place` | S-232c |
| Saltglass Flats | **The Lamp Walk at dusk** | kindles the twelve practice lamps of the students' old road (each lights a student's nameplate); only then does the Academy admit him | `enrol` | S-254c |

<a id="loop-variations"></a>
**Two loops that break the template.** Six land loops in a row would otherwise share one shape (people → dungeon →
Warden → token).
- **Archwater: the dungeon starts early** (S-127d). Once the Raft is level, a wicket in the pearl door opens the
  Undertow Grotto's first four rooms; room 4 exits onto the Tidepool Shelf by a new Shelf Mouth, and the Shelf becomes
  the main way to the Pool Pearl. The rest of the dungeon stays sealed until the three pearls.
- **Kettle Isle: the token comes after the overworld** (S-232c). Lady Fumarole does not hand the stone over in the
  Belly. Cooling her leaves the heat nowhere to go, the Kettle boils over, and she gives the stone at the bathhouse
  only after Pip has relit Forgefall's three forges with the Ember Sling.

<a id="motes-traces"></a>
**Mote's traces (Act II).** At each isle's dark beacon, outside the dungeon by the beacon's overworld base, a scorched
spiral and a scrap lamp (a jam jar with a wire handle, 0.25 m, its wick cold) hold a note. The note is chosen by the
beacon count when Pip reads it, never by the isle, so the notes read in order in every isle order (S-090b):

| Read with | Note |
|---|---|
| 0 beacons | "Borrowed: one light. I will give it back. I always mean to. — M" |
| 1 beacon (note 1 read) | "You lit one again. Why? She needs it more than you. — M" |
| 2+ beacons (after II.M) | the first unread of the two above, else "An empty jam jar. It's still a little warm." |
| the Tower's lamp-room door, ch12, before the fight | "Only one more. The oldest one. Then she can rest. — M" |

Places: Pinewhistle by the root door (S-106a), Archwater by the pearl door under the Great Arch (S-127a), Threemills on
the Granary's south apron by the hay heap (S-148a), the Tower lamp-room door (S-163). Every read note becomes a Lore
entry "A note signed M"; nothing is missable.

<a id="kindle"></a>
**The kindle scene** `kindle-<isle>` (30 s; replayable), after the Warden's sit-down:

```js
steps: [
  { shot: 'two', at: 'w:beacon', from: 'pip', dur: 0.6 },
  { shot: 'pov', dur: 0.4 },                                   // the Lantern held up in the viewmodel
  { emit: 'fx.kindle', at: 'w:beacon' }, { emit: 'sfx.kindle' },
  { emit: 'light', id: 'beacon', on: true },
  { flag: { 'beacon:<isle>': 'next' } },
  { shot: 'crane', from: 'w:beacon', at: 'w:landmark', dur: 3.0 },
  { emit: 'rhythm.<isle>' },                                     // the isle's change, within 10 s (table below)
  { wait: 2.5 },
  { shot: 'two', at: 'boss:<warden>', from: 'pip', dur: 0.6 },
  { say: '<warden>', t: '<isle>.kindle.1', text: '...' },
  { say: '<warden>', t: '<isle>.kindle.2', text: '...' },
  { emit: 'sfx.crown' },
  { emit: 'toast', t: 'home.toast.crown', text: '✿ A lantern lit in the Great Tree\'s crown' },
],
after: ['quest:<isle>.done', 'visit:<islander>']
```

| Isle | `rhythm` change (within 10 s, stays for good) | Warden line 1 | Warden line 2 | Islander who visits the plaza (evenings, from now on) |
|---|---|---|---|---|
| Pinewhistle | the Whistling Pine sings: wind tone through its spiral knot-holes, the isle's music returns; squirrels curl up asleep on boughs | Mossmantle: Ohhh. Listen to that. I can stop humming now. ...I can stop humming now, can't I? | Mossmantle: The squirrels will sleep tonight. So will I. For about a week, I should think. | Elder Nutmeg (by the pedestal, swapping acorn gossip with Digby) |
| Archwater | the tide turns: the tide flag flips to high over 8 s, the Raft floats and bobs, the Moon Pool fills and shines | Old Gloop: Eight arms, nine days. I can let go now? ...Oh, that's lovely. Oh, my elbows. | Old Gloop: The Raft's afloat. Rafferty will sing about it. I'm so sorry in advance. | Skipper Rafferty (on the jetty, singing, badly) |
| Threemills | the sails turn on all three mills; the wheat field patchwork shifts from green to gold over 10 s; chimney smoke from Haybury | Lady Honksworth: The sails! THE SAILS! I am not crying. Geese do not cry. It is the wind. | Lady Honksworth: You may call me Your Honkship. Once. Out of gratitude. Do not let it go to your hood. | Ma Haybury (with a basket of pies by Miso's counter) |

On the isle where the beacon was relit, the horizon card for that isle regains its lit window at night everywhere
(`sky.windowsOn`, [atlas-home.md#sky](./atlas-home.md#sky)). The crown lantern lights at home and is shown on the
next arrival home ([#crown-show](#crown-show)). After the scene, the count beat for the new `beacons` value fires.

<a id="beacon-1"></a>
### Beacon 1: the first light back

*Trigger:* `beacons==1` (after the first kindle scene, on the next Talk with Granny Wick or on the next arrival home,
whichever comes first; both play once). *Sets:* nothing new (the crown lantern is `lanterns`).

- **Granny Wick reads Lamp Log 2 aloud over the chart** (scene `beacon1-log`, 40 s, at her table; the log's text:
  [lore.md#lamp-logs](./lore.md#lamp-logs)). Her frame line before it: "One light back on the water. Sit down, dear.
  I'll read you the next page. My eyes are bad, but I know it by heart." Gives item `log:2`. If Pip goes home first,
  Wick's scene waits for his next visit to Duskwick; it is never skipped.
- **Hoot starts his star count** (first Talk at home after `beacons>=1`, once): "Four thousand and twelve stars this year.
  Last year, four thousand and nineteen. Hoo. Either I've miscounted, or someone is pocketing stars." / "I've never
  miscounted. Well. Once. Twice. Let's say never."
- **The first crown lantern** lights (crown show at home).

<a id="beacon-2"></a><a id="II.M"></a>
### Beacon 2 / II.M: The Lamp Thief has a name (the midpoint)

*Trigger:* the kindle scene that sets `beacons==2` ends. Plays on that isle, at its beacon, immediately (Pip is
already there). *Sets:* `moteNamed`. Twist **T4**. Mote is never hit: no fight, no prompt to attack (Pip's attack input
is disabled inside the scene as in every scene).

Scene `iim-mote-named` (80 s; replayable):

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | `sfx.mote`; the Lamp Thief drops out of the sky and lands on the relit beacon's rim, cloak flickering; the beacon's light leans toward him and he pushes it away with both hands |
| 1 | The Lamp Thief | You. Green hood. You keep *lighting* them. | `face`-state `cross`; his glow pulses on every word |
| 2 | The Lamp Thief | Do you know how long it took me to gather that one? Do you know how far up I live? | |
| 3 | The Lamp Thief | ...Fine. Fine. My name is Mote. She's my sister. Your Tree. | frame label changes to "Mote" (`label`) |
| 4 | Mote | She fell. I came to bring her home. I have been stuck on a rock in the sky for a hundred years, counting lights. | the camera turns to the NE sky; `sky:skyIsle` |
| 5 | Mote | I'm not stealing. I'm *borrowing*. Like your guardians did. | back on Mote; he lifts the hood: two dot eyes, a small worried mouth |
| 6 | Mote | She's burning herself out down there, and none of you can see it. That bloom was the brightest thing in a hundred years. Bright things burn. | |
| 7 | Mote | Keep your light. I'll find another. ...I always do. | he rises straight up; `sky.streak` to the sky isle; `sfx.mote` fades |

`after: ['set:moteNamed', 'journal:mote']`: the journal entry "the Lamp Thief" becomes "Mote"; every villager gains a
line ([#act-II-reactions](#act-II-reactions)); from now on, on one night in three (seeded by day number), a single
moving light drifts on the sky isle card (`sky.moteLight`; it has shown one night in three since the first night,
[#act-I-sky](#act-I-sky), and now shows two nights in three). Mote's lines name no isle, so the scene reads the same
on all three (chapter tests run both Pine→Arch and Arch→Pine orders).

<a id="beacon-3"></a>
### Beacon 3: the Tower wakes

*Trigger:* `beacons==3` (the third kindle scene ends). *Sets:* `towerOpen`.

- On the isle: toast "✿ Three lights on the water. Granny Wick will want to know."
- Granny Wick, next Talk (scene `beacon3-wick`, 20 s): "Three lights. That's enough to wake the old lamp." / "The
  Tower door opened by itself this morning. Ticking's stopped too. Something up there is waiting for you, dear." The
  Tower door's lock state clears (`towerOpen`). Compass: "The Lamplighters' Tower".

<a id="ch12"></a>
### Chapter 12: The Lamplighters' Tower (fixed, 2.5 h)

*Trigger:* `towerOpen`. *Sets:* `beacon:duskwick` (4), `act2done`, later `sneeze2`. *Gives:* `sunglass`, a heart
container (the dungeon's). Dungeon: [dungeons.md#d5](./dungeons.md#d5); boss the Wickwork Moth:
[creatures.md#boss-wickwork](./creatures.md#boss-wickwork).

Quest `q:ch12` steps: 0 enter the Tower · 1 find the Sunglass (floor 3) · 2 calm the Wickwork Moth · 3 kindle the
great lamp · 4 (scene) · 5 go home. Hints: "Mirrors turn when you hit them. Where does the light want to go?" / "Hit
each mirror until the beam reaches the round glass receiver on the wall; the door beside it opens."

**Scene `ch12-firstlight`** (90 s), on the lamp floor after the Wickwork Moth sits down. Granny Wick arrives by the
Tower lift (she rewinds the Moth's key with a fond pat).

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | `pov`: Pip holds the Lantern to the great lamp's wick; `fx.kindle`; the lamp catches; then inside the lens a crystal ember wakes and blazes white-gold (`fx.firstlight`), the whole floor washed in light, `sfx.firstlight` (a held choir chord) |
| 1 | Granny Wick | Oh. Oh, my. The Firstlight. Lit from the very first Starseed, long before me. I never thought I'd see it wake. |
| 2 | Granny Wick | My grandmother said it was the oldest light on the Wide Blue. It could carry a ship home from the edge of the world. |
| - | - | - | `sfx.mote`; Mote drops onto the gallery rail outside the lamp room, dim, his glow thin |
| 3 | Mote | Give it to me. Please. It's the only one strong enough. |
| 4 | Granny Wick | No, dear. Light's not for keeping. It's for passing on. You know that. They taught you that, up there. |
| 5 | Mote | I *am* passing it on. To her. Before she burns out. |
| 6 | Mote | ...I'm sorry. I'm sorry, Granny Wick. |
| - | - | - | Mote reaches through the lens; the Firstlight ember lifts out into his hands; he cries sparks (`fx.sparkTears`); he climbs straight up into the NE sky; `sky.streak` bright; the lamp keeps burning with Pip's ordinary flame |
| 7 | Granny Wick | ...He remembered my name. A hundred years, and he remembered my name. |
| 8 | Granny Wick | The lamp's still lit, dear. Your flame. Nothing you lit has gone out. Go home. Tell your Tree. |
| - | - | - | `shot look at sky:ladder`: a thin ladder of lights now hangs in the north-east sky (`sky.ladder {show: true}`) |

`after: ['set:act2done', 'card:act2']`. The card `act2` shows. `beacon:duskwick` was set at the kindle (so the
crown lantern for the Tower stays lit: nothing earned is taken back); crown lanterns: 4 of 8. From now on the Ladder
billboard shows in the NE sky of every realm ([atlas-home.md#sky](./atlas-home.md#sky)).

**The small sneeze at home** (scene `ch12-sneeze`, 35 s; first arrival home after `act2done`, any time of day):
Wenna's face scrunches (2 s, the same wind-up the finale uses), a small sneeze: `fx.leafDrop` makes every tree on the
isle drop one leaf (one falling-leaf particle per tree instance, capped at 400), `sfx.sneezeSmall`, three villagers
say "Bless you!" over each other (Ribbit, Miso "Bless you~", Clover). Then:

| # | Speaker | Line |
|---|---|---|
| 1 | Wenna | Oh. Excuse me. That was a little one. ...That was a little one, wasn't it? |
| 2 | Wenna | Something tugged. Far up. Like someone pulling a thread out of a jumper. |
| 3 | Wenna | Pip. There's something I've forgotten. It's down in my roots. I can feel the shape of it, but not what it is. |
| 4 | Wenna | And I'd like to see my brother. I'd like to say it properly this time. ...Will you go down for me? Digby knows the way. |

`after: ['set:sneeze2', 'set:ch13', 'quest:q:ch13.start']`. Compass: "Digby · Meadow Windmill".

*Act II end state* (`ch12-end`): `beacons==4`, `moteNamed`, `towerOpen`, `act2done`, items `glider`, `tidebell`,
`hook`, `sunglass`, `lanterns==4`.

<a id="act-II-reactions"></a>
### Act II reactions (villagers, Catchers, Granny Wick)

Each line is the villager's top line from its beat until the next beat replaces it (dialogue priority 50); memory
lines (priority 60, once per act) and side-story lines (70) outrank it. Beats in order: **ch7** (`lanternGot`),
**ch8**, **b1** (`beacons==1`), **IIM** (`moteNamed`), **b3** (`beacons==3`), **A2** (`act2done`).

| Who | ch7 | ch8 | b1 | IIM (one new line each, S-128) | b3 | A2 |
|---|---|---|---|---|---|---|
| Elder Shellby | A spark of her, in a bud. I saw one of those once. ...A long time ago, dear. | Granny Wick! Is she still... well, of course she is. Moths are stubborn. Give her my best. | One light back on the water. When I was small you could count the beacons from the lighthouse. Every one of them. | ...Mote. Oh, dear. | He was such a bright little thing. Ask me again another time, dear. I'm not ready. | Don't worry about the leaves, little sprout. Trees have plenty. |
| Mayor Ribbit | A lantern from the Tree herself! I shall have it added to the town crest. We have a town crest now. | A whole other isle! With moths! I hereby declare them our friends. Pending paperwork. | Croak! A light on the horizon! I've had a telescope installed. It's a jam jar. | A sky boy taking our lights? Not on my watch. I don't have a watch. I'll get one. | Three lights! I've written a speech. It's eleven pages. You may be busy. | A ladder in the sky? Is it ours? Can we tax it? I'm joking. Mostly. |
| Miso | That Lantern's not for sale, is it? ...Pity. I'd have given you a fair price~ | Duskwick? My brother sails those waters. If you see a boat covered in junk, don't buy anything~ | Business is brighter already! Literally. I sold three sunhats~ | A little star, stealing lamps... Hmph. Even I give receipts~ | Three beacons! Purr-fect. I'm stocking lamp oil, just in case~ | That ladder's very rude. Blocking my view of the sky, and not even paying rent~ |
| Clover | You went UNDER the Tree? Was it dark? Were there bugs? Was one of them huge? I knew it! | A whole new isle! Can you draw me a map? A little one? On anything? | I saw it! From my windowsill! A tiny light, way out there! | A star with a name? That's the best thing I've ever heard. And also the worst? | Three! Three lights! I'm counting them every night. My mum says that's not a hobby. | A ladder to the sky. I'm going to climb it. I'm not allowed to climb it. |
| Professor Hoot | A glowbud! Notoriously rare. I have written about them extensively. I have never seen one. | Moth folk! Lamplighters! My paper on them was thought to be fiction. By me, mostly. | (the star count, [#beacon-1](#beacon-1)) | Mote. A Starkin, then. Fascinating. Distressing. Mostly fascinating. I'll put it in the Field Notes. | My star count is down another seven. I've checked my spectacles. They are fine. | The ladder appears in every direction I face. Wait. No. Just the one. I need a nap. |
| Digby | A lantern? I'll take your word it's bright. Smells nice, though. Like her blossom. | Moths, is it? Soft things. I bumped into one once. Very polite about it. | Felt that one in the roots. A little hum, far off. Like a kettle in another house. | A brother. Huh. Never could see family resemblances. Can hear 'em, though. | The roots are humming louder. Three hums now. I'd call that a chord. | She's asking for me? Down there? ...Well. Down there's the one place I'm the best at. |
| Nell Pelliwick | Lamp's on the mast. She's ready when you are. | Granny Wick waved at us from the jetty. Or swatted a fly. Hard to say with moths. | That's a proper light. I steered by it on the way home. | A star that borrows lights. I've known sailors like that. Borrow a rope, never give it back. | Three lights out there. The sea feels less big. | Ladder or no ladder, the *Dandelion* goes where you need. |

**Granny Wick** (Duskwick) has her own lines in the same columns: ch8 "Sit down, dear, sit. Mind the moth on the
chair; that's Flick's cousin." · b1 (Lamp Log 2 scene) · IIM "Mote. So it is him. I was twelve the night he came down
the Ladder. He was the brightest thing I ever saw." · b3 (scene) · A2 "I'm all right, dear. I'm a hundred and twelve.
I've been sad before. It passes, like weather."

**The Catchers in the plaza** (S-170). From `moteNamed`, the three Catchers spend evenings (18:00-22:00 game time) at
the plaza edge marks of the bloom ([#I.5](#I.5)), talkable; by day they nap in their arenas as before (rematches
unchanged). Their lines, first true wins:

| Catcher | after `act2done` | after `moteNamed` |
|---|---|---|
| Grumble Shroom | A ladder. In the sky. Nobody asked for a ladder. Hmph. | A star, borrowing. Hmph. We borrowed. We gave it back. That's the difference. |
| Captain Pinch | That ladder's no place for a lad. Ye go careful, aye? | Borrowin', he calls it. Aye, I've said that. Once. Felt rotten after. |
| Frostbun | Ladder's cold up there. Bring a scarrrf. | Little star sounds lonely. Lonely things grab. Bun knows. |

---
<a id="act-III"></a>
## Act III: The Remembering (chapters 13-18, 18.5 h)

The Rootdeep first, the three Stair Stones in any order, the Starstair last. Count: 3 stones. Emotional target:
**understanding**. The history is told by the memory knots (texts: [lore.md#memories](./lore.md#memories)); this
section owns when they open and what they set.

<a id="ch13"></a>
### Chapter 13: Into the Rootdeep (fixed, 3.5 h + memories 1-3)

*Trigger:* `ch13` (set by the small-sneeze scene). *Sets:* `lumbraCalm`, `mem:1`-`mem:3`, `stoneSites`, root-gate
flags on every isle visited ([systems.md#travel](./systems.md#travel)). *Gives:* `mitts`. Places:
[atlas-far.md#rootdeep](./atlas-far.md#rootdeep), dungeon [dungeons.md#d6](./dungeons.md#d6), boss
[creatures.md#boss-lumbra](./creatures.md#boss-lumbra).

Quest `q:ch13` "Into the Rootdeep":

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | talked to Digby | Find Digby. | He's never far from the windmill. | Digby stands by the Meadow Windmill in Bloom Meadow, west of the village. |
| 1 | entered the root-gate | Open the root-gate under the windmill. | Something under the windmill wants a light. | Walk round the windmill's footing to the root arch and hold up the Lantern with {tool}, then press {interact}. |
| 2 | reached Burrowbottom | Follow Digby through the dark. | He knows the way. Stay close and listen. | Walk behind Digby. If you lose him, follow his voice; he waits at every turning. |
| 3 | talked to Gran Burrows | Meet Digby's Gran. | Someone in Burrowbottom has been expecting you. | Gran Burrows sits outside the round door with the lamp, in the middle of Burrowbottom. |
| 4 | `mitts` | Find a way into the Rootdeep Heart. | Some earth down here is softer than the rest. | Enter the Heart past the Underlake. The Digging Paws are in its middle rooms; dig the sparkly brown mounds with {tool}. |
| 5 | `lumbraCalm` | Calm whatever is curled round the Heart. | It's very long. It's very sulky. | Lumbra surfaces from the ringed holes; wait for the ring, dodge the dirt, hit him while he's up. |
| 6 | `mem:1`-`mem:3` | Touch the memory knots on the Taproot (3). | They glow when they're ready. | Walk up to each glowing knot on the great Taproot and press {interact}. |
| 7 | `stoneSites` | Listen to the roots. | She has something to show you. | Stand by the Taproot after the three memories. |

**Digby leads** (step 2). He walks ahead at 1.6 m/s using the schedule path system
([systems.md#schedules](./systems.md#schedules)), waits at each marker until Pip is within 6 m, and says one line per
marker (place-keyed). Only Digby jokes about his sight (tone charter):

| Marker | Line |
|---|---|
| gate | Down here, you're the one squinting. Welcome to my world. It's very nice. Bit damp. |
| fork 1 | Left here. Smells like left. |
| drip | Mind the drip. That one's been dripping since I was a pup. Same drip. I call him Gerald. |
| dark hall | Something's flapping. Your lamp'll show it. I'll stand very still and be brave. |
| mushrooms | You know what's funny? Up top, everyone tells me where things are. Down here I get to tell you. |
| town edge | Burrowbottom's just ahead. Gran will say I've grown. I haven't. She says it anyway. |

**Gran Burrows** (step 3): "There's my Digby. You've grown." / Digby: "I haven't, Gran." / "You have. Sideways." /
"And you're the little sprout. Has he shown you his seed pouch yet? No? He will. When he's ready." Then: "The roots
went dim a hundred years back, and dim again this year. Something pulls at them. Go to the Heart. Lumbra won't like it.
Lumbra doesn't like anything. Except me." Digby stays in Burrowbottom from here ("This is as far as I go. Lumbra and me
don't get on. He thinks I'm a root.").

**Memory knots** (step 6). Twelve knots ring the Taproot; knots 1-3 glow from `lumbraCalm`. `[E] Touch · Memory`
loads the Remembered Isle at that memory ([atlas-home.md#remembered](./atlas-home.md#remembered)); the scene script
and placed young cast are in [lore.md#memories](./lore.md#memories). Each sets `mem:<n>` at its first step, and
returns Pip to the knot. Knots stay touchable for ever (tone rule 8).

**The roots remember** (step 7). Scene `ch13-roots` (50 s) at the Taproot, Wenna's voice through the wood:

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Wenna | I remember the Lamplighters. I remember a little light falling onto the rock in the sky. ...I don't remember why it hurts. | |
| 2 | Wenna | Look. My roots still know where things fell. | three roots flare gold and the light runs off along them in three directions; `shot crane` up the Taproot |
| 3 | Wenna | Three stones from the old stair. They fell in the storm. One in the shallows, where a bell lies. One in a mountain that boils. One under an old school. | the chart gains three marks: Bell Shallows, the Kettle, the Academy |
| 4 | Wenna | If they were set back on the Cairn, the stair might stand again. And then... then I could see him. | |
| 5 | Wenna | Nell will have to sail past the reef. Tell her I said she's brave. She'll pretend she knew. | |

`after: ['set:stoneSites', 'rootgates:visited', 'quest:q:ch14.start', 'quest:q:remember.start']`. Root-gates open
on home and on every isle already visited (fast travel; Lumbra ferries Pip between them).

*End state* (`ch13-end`): `lumbraCalm`, `mem:1-3`, `stoneSites`, item `mitts`, `q:ch14` and `q:remember` active.

<a id="ch14"></a>
### Chapter 14: Past the Reef (1.0 h, inside the Glassway's 3.5 h)

*Trigger:* `stoneSites`. *Sets:* `ch14`. Place: [atlas-far.md#glassway](./atlas-far.md#glassway). Travel mode (free
sailing or the chart-stop fallback): [systems.md#travel](./systems.md#travel).

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | talked to Nell | Ask Nell to sail past the reef. | Who's brave? Nell's brave. | Talk to Nell at the jetty. |
| 1 | entered the Glassway | Sail into the Glassway. | The water past the reef is glass-clear. | Pick "Past the Reef" on the chart, or sail south-west from the jetty. |
| 2 | talked to Pell | Find the post office on stilts. | Puffins like tidy places. | Puffin Post stands on stilts in the north of the Glassway; moor at its slipway. |
| 3 | bottle picked up | Pick up the bottle on Puffin Post's beach. | Something's bobbing by the slipway. | The bottle glints on the sand by the slipway. Press {interact}. |
| 4 | met Kinako | Visit the floating bazaar. | You'll hear it before you see it. | Kinako's Floating Bazaar is moored beside Puffin Post this week. |
| 5 | `ch14` | Ask Pell about the far buoys. | Pell knows every route. | Talk to Postmistress Pell again. |

Nell, step 0: "Past the reef? Haven't sailed it since the storm. ...Did she say I was brave? Well. I knew that. Hold
the Lantern high." Pell, step 2: "Puffin Post! Letters in, letters out, no parcels over a puffin's weight. You'll be
the hooded one. The Tree's been sending us her regards through the roots, very faintly. Took us ages to read." Step 3
is Glassway bottle 1 ([lore.md#bottles](./lore.md#bottles)): Pell reads it and opens side story 34 *Return to Sender*
([side-content.md#ss-34](./side-content.md#ss-34)). Kinako, step 4: "A CUSTOMER!! Welcome to the Floating Bazaar!! Everything
is limited edition!! Even the limited editions!!" Pell, step 5: "Buoys, dear. Red to Kettle Isle, white to Saltglass.
And the bell's out there in the shallows, if you've a mind to listen." `after: ['set:ch14']`; the chart shows Kettle
Isle and Saltglass Flats; on the home sky, horizon cards e and f lose their fog ([atlas-home.md#sky](./atlas-home.md#sky)).

<a id="ch15-17"></a>
### Chapters 15-17: the three Stair Stones (any order)

Each place runs the same loop as Act II: the people (3 steps), the depths (dungeon and tool), the Warden, then the
**stone** (item `stone:<site>`, flag `stoneHeld:<site>`), carried home and set at the Cairn. Critical paths may use
any Act II tool and the Paws, never another Act III tool (pacing rule 6). The chapter number is the arrival order.

| Place | Step 1 | Step 2 | Step 3 | Dungeon · tool · Warden · encounter |
|---|---|---|---|---|
| **The Sunken Bell** (Glassway, 3.5 h with ch14) | **The Sandbars:** Pell's puffins say the old bell's spire shows at low tide; Pip rings the Tide Bell at the Sandbars' tide stone to hold the tide low. Journal: "Hold the tide low." | **Wreck Reach:** in the smallest of the three wrecks, a dark hold (Lantern) keeps the Lamplighters' chapel key, carved with a spiral. Journal: "Find the chapel key." | **Bell Shallows:** at low tide Pip wades to the spire and unlocks the chapel door. Journal: "Open the Sunken Bell." | the Sunken Bell ([d7](./dungeons.md#d7)) · Starsong · Pelagia · a bell-order duel (wits; she never attacks) |
| **Kettle Isle** (3.5 h) | **Forgefall:** Master Scoria: the forges are out, "the Kettle won't boil, it just sulks". Journal: "Find out why the forges went out." | **Bathhouse Terraces:** Soakley, calm as a puddle: the baths swing between cold and scalding; Lady Fumarole sits on the spout lid "and won't be moved, dear, not even for towels". Journal: "Visit the bathhouse." | **Ash Beach:** the lava-tube mouth into the Kettle's Belly is dark (Lantern). Journal: "Go into the Kettle." | the Kettle's Belly ([d8](./dungeons.md#d8)) · Ember Sling · Lady Fumarole · a bout |
| **Saltglass Flats** (4.0 h) | **Sablecamp:** Sable: the Lamplighter Academy is buried to its bell tower; "pottery, Pip, POTTERY, a whole school of it". Journal: "Find the Lamplighter Academy." | **The Glass Dunes:** Pip digs out the Academy's roof hatch (Paws, soft sand). Journal: "Dig down to the Academy." | **Academy Hill:** Pip rings the tower's hand-bell; a dry voice from below: "Enrolment is OPEN." Journal: "Enrol." | the Buried Academy ([d9](./dungeons.md#d9)) · Ivy Gloves · Tutor Scarabelle · an exam in three papers |

**The stone is given** (scene `stone-give-<site>`, 25 s, after the Warden's sit-down lines in
[creatures.md](./creatures.md); on Kettle Isle at the bathhouse after The Boil-Over instead,
[#loop-variations](#loop-variations)). `emit item stone:<site>` with "You got a Stair Stone! One of the three keystones of
the old Starstair. Set it at the Summit Crystal Cairn." Lines:

| Site | Line 1 | Line 2 |
|---|---|---|
| bell | Pelagia: Take the clapper, little one. It's a Stair Stone, you know. It's been ringing nothing for a hundred years. | Pelagia: Tell Shellby... no. I'll tell him myself. It's time I swam over. |
| kettle | Lady Fumarole: Fine. FINE. The forges are hot again, the heat has somewhere to go. Take your rock. | Lady Fumarole: Mind, it's warm. Everything here is warm. That's rather the point of us. |
| saltglass | Tutor Scarabelle: Final exam: passed. Grade: acceptable. That is the highest grade I give. | Tutor Scarabelle: The bell's weight is yours, as is the custom. Ring for the Academy now and then. So it remembers it's a school. |

The bell site has a **third line** after line 2, the first of three signposts to Moonmere
([side-content.md#ss-47](./side-content.md#ss-47)): Pelagia: "On a still night, play the Calling at the end of a jetty. The moon lays a path for those who call. Someone up there walks it."

The isle's change within 10 s: the Sunken Bell rings once across the Glassway (`sfx.bigBell`, the spire's lamp
lights); the Kettle boils over gently into a steam plume and Forgefall's chimneys light; the Academy bell rings and
Sablecamp's kites go up. Compass from here: "Set the Stair Stone · the Cairn".

<a id="stone-beats"></a>
### Stone beats: setting a stone at the Cairn

*Trigger:* `[E] Place · Stair Stone` at the Summit Crystal Cairn's foot (three spiral-carved sockets,
[atlas-home.md#starstair](./atlas-home.md#starstair)) while `stoneHeld:<site>`. *Sets:* `stone:<site>` = order,
clears `stoneHeld:<site>`. Scene `stone-set` (25 s; replayable):

```js
steps: [
  { shot: 'pov', dur: 0.3 },                          // the stone held out in the viewmodel
  { emit: 'fx.stoneSet', at: 'w:cairn.socket' }, { emit: 'sfx.stoneSet' },
  { flag: { 'stone:<site>': 'next' } },
  { shot: 'crane', from: 'w:cairn', at: 'w:cairn.needle', dur: 2.5 },
  { emit: 'sky.flight', n: '<stones>' },             // flight n rises from the needle, 2.5 s, visible from every realm
  { emit: 'sfx.crown' }, { emit: 'crown', n: '<lanterns>' },
  { say: 'wenna', frame: 'wenna', t: 'home.scene.stone.<stones>', text: '(table below)' },
  { emit: 'toast', t: 'home.toast.knots', text: '✿ Three memory knots glow on the Taproot' },
],
after: ['quest:q:remember.next']
```

Wenna can speak anywhere on the home isle ("anywhere my roots go"), so her line plays at the Cairn.

| `stones` after setting | Wenna's line | Memory knots that open | Twist |
|---|---|---|---|
| 1 | I felt that. Like a step under a foot I'd forgotten I had. | 4-6 (young Shellby earns the seeds from three younger Catchers; young Granny Wick; young Shellby and young Pelagia racing on the beach) | - |
| 2 | Two flights. I can almost see the top. Go down to my roots, Pip. There's something I need you to see. | 7-9 (Mote comes down the Ladder; he asks; Wenna chooses to stay: "Who would they wake up next to?") | **T5** |
| 3 | Three. The stair is whole. ...Go and see the last of it first. Then go up. | 10-12 (the Storm breaks the Ladder, seen from far away; the stones fall; a young turtle writes a letter by lamplight) | plant for T7 |

Quest `q:remember` "The Remembering" (main) has one step per memory triple: "Watch the memories at the Taproot
(4-6)" and so on, each opening when its stone count is reached. Chapter 18 starts only when `stones==3` **and**
`memories==12`, so every player has seen T5 and the letter-writing memory before Mote says "You saw it" at the arch.

**Coming back from a memory triple** (one-time Wenna lines at the Taproot, frame `wenna`): after memory 6, "Small
Shellby, in that hat. Oh, I'd forgotten the hat."; after memory 9, "I chose. I remember now. I'm sorry I forgot. It
was the most important thing I ever did."; after memory 12, "...Who was he writing to, I wonder." (The game never says
the writer is Shellby; only the handwriting matches the shipped bottle.)

<a id="mote-present"></a>
### Mote in the present (Act III, count-keyed)

From the Firstlight theft to the ch18 chase, Mote would otherwise appear only in memories of a hundred years ago. Three
present-day beats keep him close, keyed to the stone count, never to which stone (S-212d):

1. **After `stones == 1`**: a scrap lamp sits on the set socket's rim with a note: "A stair. For her? Or for me?
   ...Either way, it will take you too long. — M".
2. **After `stones == 2`**, the first night at home at 21:00 or later near the Cairn: scene `stone2-mote` (40 s). Mote
   stands on flight 2, dim, looking at the Tree. Wenna (frame `wenna`): "Mote?" Mote: "...Don't." He streaks away to the
   sky isle; no fight. Sets `moteSeenStair`.
3. **From `act2done`**, at night on home, `fx.leafPull` draws leaves upward out of the Great Tree's crown toward the sky
   isle, 20 × (1 + stones) particles, so the Ladder's pull visibly grows. It only drifts leaves; nothing is taken back.

Reactions (once each): Shellby (with his s2 row, `stones >= 1`): "Leaves going up, at night. Trees don't do that,
dear. Not on their own."; after `moteSeenStair`: "You saw him on the stair. ...Then he's still close. That's
something. Close is something." The Catchers' evening rows after `moteSeenStair`: Grumble "Hmph. Little light on the
stair last night. Didn't come down. Didn't take anything. Hmph."; Pinch "Aye, I saw him from the lighthouse. Stood on
yer stair like a lad on a dock with no boat."; Frostbun "...Saw him. Cold up there. He looked... cold."

<a id="ch18"></a>
### Chapter 18: The Starstair (fixed, 2.5 h)

*Trigger:* `stones==3` and `memories==12`. *Sets:* `ch18`, `act3done`. *Gives:* `cloudstep`. Places:
[atlas-far.md#driftholm](./atlas-far.md#driftholm), dungeon [dungeons.md#d10](./dungeons.md#d10), chase
[creatures.md#boss-mote-chase](./creatures.md#boss-mote-chase).

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | stood on the first flight | Climb the Cairn's needle. | The needle was too steep. Was. | Hook the purple thistle on the needle with {tool}, or climb the ivy with the Gloves, then step onto the floating stair. |
| 1 | `ch18` | Climb the Starstair to the sky isle. | Don't look down. Or do; it's lovely. | Keep climbing the three flights; the clouds bounce you back if you slip. |
| 2 | looked at the Tally Wall | Find out who lives on Driftholm. | Someone has been counting. | The Tally Wall is in Mote's Meadow, beside the patched shelter. |
| 3 | entered the Spiral Stair | Follow Mote up the Spiral Stair. | Up, always up. | The stair door is in the rock under the Spiral Arch, at Arch Rise. |
| 4 | chase won | Keep up with Mote. | Stay close; dodge the circles. | Stay within 20 m of Mote for 90 seconds. Roll through the stripes, step out of the circles. |
| 5 | `act3done` | Reach the Spiral Arch. | He's waiting. | Walk to Mote under the arch. |

**Arrival** (scene `ch18-arrive`, 30 s): Pip steps off the third flight onto lilac grass; region card "Mote's Meadow ·
Someone lives here"; `shot wide` over a patched shelter of cloud-cloth and an old sail, a hundred little scrap lamps
on sticks, unlit, and a long pale wall of marks; nobody home; `sfx.wind`, a harp phrase. Flag `ch18`.
Look texts: Tally Wall: "Marks in rows of ten. Hundreds of rows. Every tenth mark has a tiny note beside it." (the
notes are side story 45, [side-content.md#ss-45](./side-content.md#ss-45)); shelter: "A shelter stitched from
cloud-cloth and a sail. Inside, a hundred little lamps made of scraps, and one empty hook where a big one would go."

**The arch** (scene `ch18-arch`, 70 s), after the chase, under the Spiral Arch:

| # | Speaker | Line | Staging |
|---|---|---|---|
| 1 | Mote | You saw it, didn't you. In her roots. | he stands under the arch, the Firstlight glowing in his chest; his own light thin |
| 2 | Mote | I know she chose. I was there. I heard her say it. I just didn't believe her. | |
| 3 | Mote | ...She'd have come with me if it weren't for all of you. | he looks past Pip, down at the isles far below |
| 4 | Mote | I'm not angry. I'm not. I'm just a hundred years tired, green hood. | |
| 5 | Mote | It's nearly finished. When it's done, she won't have to choose. | he lifts both hands; the Ladder of Lights, hanging from the arch, winds up through the spiral into the sky (`sky.ladder {up: true}`, 4 s); the arch's spiral lights gold |
| - | - | - | the Nimbles puff out from behind the arch rocks, bump round Pip, and one tucks itself into his hood: `emit item cloudstep` ("You got the Cloudstep! A puff of Nimble cloud in your hood. Hop again in the air when a cloud mote is near.") |

`after: ['set:act3done', 'card:act3']`. Crown lanterns: 7 of 8 (3 beacons + the Tower + 3 stones). The Spiral Arch
becomes a portal to the Starmeadow (`[E] Enter · the Spiral Arch`).

<a id="act-III-reactions"></a>
### Act III reactions

Beats: **C13** (`stoneSites`), **ch14**, **s1/s2/s3** (`stones` 1-3; Shellby's three columns key to memories 6, 9 and
12 watched instead), **A3** (`act3done`). After memory 12 Shellby gets quieter: his A3 line is preceded by a silent
box ("...") on the first Talk.

| Who | C13 | ch14 | s1 | s2 | s3 | A3 |
|---|---|---|---|---|---|---|
| Elder Shellby | The roots remember everything, they say. I hope they're kind about it. | Past the reef! I haven't been past the reef since... well. Since I had a better shell. | A too-big hat, you say? Hmph. Hats were bigger then. | She chose us, you know. I always hoped she had. | Sit a moment, dear. No need to talk. | Tell him an old turtle says hello. He won't remember me. I was very small, and he was very bright. |
| Mayor Ribbit | Into the roots! I'd go with you, but my legs are ceremonial. | Past the reef. Deep water. Very deep. I'm fine. I'm sitting down. | A stair in the sky, over my town! I'm putting up a sign: "Mind the sky." | Two flights! I tried the first step. I'm not discussing it. | A whole stair! When you come back down there will be a parade. There's always a parade. | The ladder's gone up out of sight. Good. It was making the ducks nervous. |
| Miso | Down in the dark again? I've a lamp you could buy. You've a better one. Fine~ | If you see Kinako out there, tell him nothing. Actually, tell him his sign is crooked~ | Stair stones! Are they shiny? Could I sell them? No? Just asking~ | Two flights of stairs and still no lift. Typical~ | Three! I'm stitching commemorative hankies. Very limited edition~ | That star boy owes me for every lamp he took. I'll send him a bill~ |
| Clover | Underground! With Digby! Did he get lost? Did YOU get lost? Did you get lost TOGETHER? | Past the reef! I'm painting the reef on my map. It's a squiggle. | There are STAIRS in the SKY. I'm not allowed to climb those either. | I counted the steps. I lost count at forty. Twice. | Can you see the top? Is there a top? Tell me there's a top! | When you go up, wave. I'll be on my windowsill. I'll wave back even if I can't see you. |
| Professor Hoot | Memory knots! My paper on them was rejected for being too poetic. By me. | Puffins run a post office? Hoo! I've sent them six letters. They've sent back six bills. | A floating stair! I've revised my paper on gravity. It's shorter now. | Pinfeather claims to have predicted the second flight. I'd have remembered. I remember everything. Mostly. | Field Notes now has a chapter titled "Up". | Driftholm! Is it fluffy? Field Notes demand to know if it is fluffy. |
| Digby | You did all right down there. You only walked into three walls. That's my record too. | Sea air. Smells like salt and somebody else's lunch. | Felt a stone settle. Like a tooth going back in. Only nicer. | The roots are restless. Like they're trying to remember a tune. | Gran wrote. Says the roots are humming the old stair-song. Says I hum it wrong. | Up, is it? I'll stay down here. Somebody's got to keep the bottom of things tidy. |
| Nell Pelliwick | Roots, is it? Give me water any day. At least water tells you it's wet. | Hold the Lantern high, Pip. Past the reef the water's so clear you can see your worries. | Funny thing, a stone from the sea going up into the sky. | The tides past the reef are calmer since that stair went up. Or I'm getting better. | Three flights, three stones. I'll sail you anywhere but up, mind. | Can't sail to the sky. I asked a gull. Gull didn't know either. |

Catchers (evenings at the plaza), after `act3done`: Grumble "Up there? Bring him down for tea. Or don't. Hmph. ...Do."
· Pinch "Three stones set. That's a sailor's work, lad. Proper." · Frostbun "Stairs are cold. Hop quick. Come back."

---
<a id="act-IV"></a>
## Act IV: The Lantern Sky (chapters 19-21, 5.5 h)

Fixed order. One place, one night, one Ladder. No new tool: the act recombines the ten (pacing rule 1). Emotional
target: **letting go**. Pip never hits Mote; his attack input is disabled within 12 m of Mote in Act IV.

<a id="ch19"></a>
### Chapter 19: The Starmeadow (1.0 h)

*Trigger:* `act3done`. *Sets:* `ch19`. Place: [atlas-far.md#starmeadow](./atlas-far.md#starmeadow); cast
[cast.md#old-mother-brightwell](./cast.md#old-mother-brightwell), [cast.md#the-twinklings](./cast.md#the-twinklings).

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | entered the Starmeadow | Step through the Spiral Arch. | The arch is a door now. | Walk to the Spiral Arch on Driftholm and press {interact}. |
| 1 | reached Brightwell's Rest | Cross the constellation bridges. | Stars make good stepping stones, if you hop twice. | Hop toward a cloud mote and hop again in the air to Cloudstep across. Follow the brightest bridge. |
| 2 | `ch19` | Speak with the eldest star. | She's very big and very slow. You can't miss her. | Old Mother Brightwell rests at Brightwell's Rest, the largest cloud isle. |
| 3 | reached the Ladder Foot | Go to the foot of Mote's Ladder. | The Twinklings know the way. | Follow the three Twinklings to the Ladder Foot. |

Scene `ch19-brightwell` (85 s; replayable). T6 fires at line 6.

| # | Speaker | Line |
|---|---|---|
| 1 | Old Mother Brightwell | A small one. From below. With her light in a bud. ...Hello, little lantern-bearer. |
| 2 | Old Mother Brightwell | We have missed Mote for a hundred years. We cannot go down to fetch him. Below the clouds we grow dim and heavy, as she did. |
| 3 | Old Mother Brightwell | Listen. There is an old way. When she sneezes her letter, the sky may answer with a ladder of given light. |
| 4 | Old Mother Brightwell | Light handed freely, from one to another. It harms nobody. It holds for one night. One night is enough to say goodbye, or hello. |
| 5 | Old Mother Brightwell | Mote built his ladder from taken light. Taken light pulls. It pulls at whatever it was taken from. |
| 6 | Old Mother Brightwell | That is why she sneezed early, little one. A hundred years of his gathering, tugging at her. He woke her himself, and does not know it. |
| 7 | Old Mother Brightwell | Take the Twinklings. They are small, and they are brave, and they will light where you point. |

The Twinklings chime in a three-note rising arpeggio (`sfx.twinkle`) and circle Pip; for Act IV they follow at 2 m
and light the Ladder's rungs where Pip points (the `tool` action with no tool equipped, or a Look at a dark rung).

<a id="ch20"></a>
### Chapter 20: The Ladder of Lights (2.5 h)

*Trigger:* `ch19` and reached the Ladder Foot. *Sets:* `freed:<isle>` ×4, `ch20`. Dungeon:
[dungeons.md#d11](./dungeons.md#d11) (16 rooms, climbed downward from the Starmeadow into Wenna's crown). Four floors
are borrowed beacons, one each for Duskwick (the tower window light taken on the bloom night), Pinewhistle,
Archwater and Threemills, each themed on its isle and solved with that isle's tool; the dungeon file fixes their order.

**Freeing a light** (scene `free-<isle>`, 12 s, at the end of its floor): the borrowed light unwinds from the Ladder's
rail as a ribbon and streams to the horizon; `shot look` follows it; that isle's horizon card flares gold at its
window (`sky.windowsGold {isle}`) and stays gold for good; on that isle its beacon now burns gold (both lights);
toast "✿ <Isle>'s light is going home". A card line (`say card`, 2.5 s):

| Isle | Card line |
|---|---|
| Duskwick | The light remembers a window, and an old moth reading by it. It goes home in a hurry. |
| Pinewhistle | The light remembers the pine's song. It goes home humming. |
| Archwater | The light remembers the moon on the pool. It goes home with the tide. |
| Threemills | The light remembers warm bread and turning sails. It goes home for supper. |

Mote's voice calls up the Ladder after each free (count-keyed, non-blocking caption, 3 s):

| Freed | Mote |
|---|---|
| 1 | Don't! That one took me a month! |
| 2 | Green hood, stop. You don't understand. |
| 3 | She's tired. Can't you see how tired she is? |
| 4 | ...That was the last one. That was everything I had. |

Floors 7-11 are the little lights Mote gathered (one tool each, dungeons.md#d11); floors 12-16 use every tool together and end at a portal down into `crown`. Flag `ch20` on entering the Crown.

<a id="ch21"></a>
### Chapter 21: The Second Sneeze (finale, 1.0 h)

*Trigger:* `ch20`. *Sets:* `mainEnding`, `epilogueTalk`. Place: [atlas-far.md#crown](./atlas-far.md#crown). Combat
numbers (lights, circles, ring spacing): [creatures.md#finale](./creatures.md#finale). Three phases; dizzy in the Crown
restarts the current phase with progress kept (no phase can be failed out of).

**Opening** (scene `ch21-crown`, 45 s): Pip drops from the Ladder's last rung onto the North Bough. The Crown: four
great boughs, blossom, four dark bough lanterns. Mote sits at the top of the trunk where his Ladder is wound round the
crown, the Firstlight in his chest, his cloak bulging with borrowed sparks; the Ladder pulls at the crown (leaves
stream upward, `fx.leafPull`). Wenna's voice comes from everywhere (frame `wenna`).

| # | Speaker | Line |
|---|---|---|
| 1 | Mote | You came down my ladder. Of course you did. You climb everything. |
| 2 | Wenna | Mote. Little star. Look at you. |
| 3 | Mote | Don't. Don't say it kindly. I can't do this if you say it kindly. |
| 4 | Mote | Everything I took is still in my cloak, and it's falling out. I can't hold it all. I can't hold any of it. |
| 5 | Wenna | Pip, the lights are falling. Catch them in my lanterns before they're lost. |

**Phase 1, Stray Lights** (about 2 min): sparks fall from Mote's cloak onto telegraphed circles across the four
boughs; Pip aims the Sunglass to steer each into a bough lantern, 6 per bough, 24 in all. The boss bar reads
"Lanterns lit" (0/24), never HP. Barks (non-modal captions, 2.5 s) at 6, 12 and 18 lit: Wenna "That's one bough.
Oh, that's warm." · Mote "Stop helping. ...Why are you helping?" · Wenna "Nearly there, little sprout."

**Phase 2, The Sneeze** (about 1 min). Scene `ch21-sneeze`:

```js
steps: [
  { shot: 'wide', at: 'w:crown.centre', dur: 0.5 },
  { emit: 'face', who: 'wenna', state: 'scrunch' }, { emit: 'sfx.sneezeWind' },      // the 2 s wind-up from her sleepy face
  { say: 'wenna', frame: 'wenna', t: 'crown.sneeze.1', text: 'Oh. Oh, no. Oh, I think I\'m going to—', wait: 2.0 },
  { emit: 'fx.sneezeBig' }, { emit: 'sfx.sneezeBig' },
  { emit: 'fx.seedsUp' },                              // three coloured streaks shoot up through the canopy
  { emit: 'cutin', ids: ['cutin_catch_woods', 'cutin_catch_peaks', 'cutin_catch_shores'], s: 3.6 },
  { say: 'grumble', t: 'crown.sneeze.2', text: 'Got it!', wait: 1.2 },
  { say: 'frostbun', t: 'crown.sneeze.3', text: 'Mine! ...I mean, here.', wait: 1.2 },
  { say: 'pinch', t: 'crown.sneeze.4', text: 'Caught one, lad!', wait: 1.2 },
  { emit: 'fx.lastSpark', at: 'actor:mote' },          // Mote's own light slips out and falls past the crown
  { say: 'mote', t: 'crown.sneeze.5', text: 'No. No, that\'s mine, that\'s *me*—', wait: 1.5 },
  { say: 'wenna', frame: 'wenna', t: 'crown.sneeze.6', text: 'Pip! Catch him!', wait: 1.0 },
],
after: ['finale:glide']
```

Then the glide (play, not scene): Pip leaps off the bough's end and glides 12 s through blossom rings after the
falling spark; reaching the last ring catches it in the Lantern (`pov`: the spark nestles in the bud). A miss loops the
glide from the bough's end; it cannot fail. The three cut-in panels are painted art ([#art](#art)); the Catchers
stand at their corners of the home isle, far below, so they are never loaded as models here.

**Phase 3, Given Light** (about 3 min, no pressure). Mote sits on the West Bough, dim, almost out. Pip walks up;
prompt `[E] Give · Lantern` (attack disabled). Scene `ch21-given` (up to 180 s; replayable):

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | `pov`: Pip holds out the Lantern; the caught spark lifts out of the bud and back into Mote; he brightens a little |
| 1 | Mote | You... gave it back. You could have kept it. Nobody gives anything back. |
| 2 | Wenna | That's given light, Mote. That's the old way. Look. |
| - | - | - | `emit chain`: the save-built lantern chain ([#lantern-chain](#lantern-chain)); each lantern rises and becomes a rung of a new ladder, gold and quiet, climbing from the crown toward the Starmeadow, where the Starkin light its top rungs |
| 3 | Mote | All of them? For me? I took their lights. |
| 4 | Granny Wick | And now they're giving you one each, dear. That's the difference. Light's not for keeping. |
| - | - | - | Mote takes the Firstlight from his chest and puts it in Granny Wick's hands; it settles there, small and white-gold |
| 5 | Mote | I remembered your name. For a hundred years, I remembered your name. |
| 6 | Wenna | I'm still here, Mote. |
| 7 | Mote | Every hundred years, then? |
| 8 | Wenna | Every hundred years. Keep a hanky handy. |
| - | - | - | Mote laughs (a run of bells), hugs the trunk, and climbs the gold ladder; he gets brighter with every rung; at the top he becomes a new star just above the Tree; `crown {n: 8}`, `sfx.crown` held; the gold ladder fades rung by rung from the bottom |

`after: ['set:mainEnding', 'card:act4']`. The card `act4` shows.

**Epilogue scene** `ch21-epilogue` (40 s), straight after the card: home, dawn, Pip by the pedestal. The three
Catchers walk in from their corners and set the three Starseeds back in their sockets, one each (`pose holdOut`,
`fx.seedSet` ×3). Then:

| # | Speaker | Line |
|---|---|---|
| 1 | Wenna | Good morning, little sprout. Look up tonight. There's a new star, just above me. He'll be watching. |
| 2 | Wenna | Everyone's lights are home. You can rest now. Or not. I know you. |
| 3 | Wenna | There are bottles still out on the water, and some of my acorns are still snoring. Hoot's notes will tell you where. |
| 4 | Wenna | And Shellby wants a word, some evening. Whenever you're ready. |

`after: ['set:epilogueTalk', 'quest:q:night.start']`. The journal shows "The Hundred-Year Night: bottles {b} of 8,
acorns {a} of 50" ([#ch22](#ch22)).

**The epilogue state** (stays until and after ch22): every beacon burns gold on every isle; horizon cards a-f lit gold
at night; a new bright star sits 4° from the zenith straight above the Great Tree in every realm (`sky.moteStar`);
Sprout Village keeps festival dressing (bunting, paper lanterns on every lamp, a little stage by the signpost) and
Ribbit hosts the festival every evening 18:00-22:00 ([side-content.md](./side-content.md) for its activities);
the Catchers sit at the plaza edge every evening; music: the ending theme by day, the festival waltz by night. Compass:
"The lights are home ✿" (or "Elder Shellby · Sit at dusk" once ch22's threshold is met).

*End state* (`ch21-end`): `freed:*` ×4, `ch20`, `mainEnding`, `epilogueTalk`, `lanterns==8`, `q:night` active.

<a id="lantern-chain"></a>
### The save-built lantern chain

Built when `ch21-given` reaches `emit chain`, from the save, by a pure function `chainList(S)` (unit-tested on the
fixtures `ch21-start-min` and `ch21-start-full`). Rules:
1. **Order:** the waves below, top to bottom; inside a wave, the table order. Granny Wick is always last.
2. **Who:** every *core* bearer whose `met:<npc>` flag is set (all are on the main path, so a main-path save has all
   of them), plus every *earned* bearer whose condition holds. Minimum 32 lanterns, maximum 46.
3. **Staging:** bearers arrive in waves of up to 6, one per bough in rotation (N, E, S, W, N, E), walk 6 m along the
   bough, hold up a parade lantern (the shipped `lantern` prop, lit), say one caption (non-modal, 2.4 s), and the
   lantern floats up to become the next rung (`fx.rungRise`, 0.8 s, `sfx.rung` rising a semitone per rung, wrapping
   every octave). A wave takes 16 s; waves overlap by 4 s. At most **12 bearer models** are visible at once: a bearer
   walks back 10 m after giving and despawns behind a blossom puff. Holding `{interact}` plays the chain at 4× speed;
   skipping the scene skips the whole chain (flags are unaffected).
4. **Budget:** worst case (46 bearers, 47 rungs including Pip's) is checked in S-287 against 200 main-pass draw
   calls: rungs are one instanced mesh; bearers reuse their shipped or code-built models.
5. A bearer whose model is not yet built (a land shipped after this step) is skipped by `chainList` until it exists
   (each NPC def has `model` or is absent).

| Wave | Bearer | Kind · condition | Caption |
|---|---|---|---|
| 1 | Elder Shellby | core | For the little star. From an old turtle who remembers him. |
| 1 | Mayor Ribbit | core | On behalf of the town, the treasury, and the ducks! |
| 1 | Miso | core | Free of charge. Don't get used to it~ |
| 1 | Clover | core | I made mine myself! It's a bit wonky. That's on purpose. |
| 1 | Professor Hoot | core | For the record: given freely. I've written it down. |
| 1 | Digby | core | Can't see it. Can feel it's warm. That'll do. |
| 2 | Nell Pelliwick | core | Every boat needs a lamp to get home by. So does every star. |
| 2 | Grumble Shroom | core | Hmph. Here. Kept it warm. |
| 2 | Captain Pinch | core | A light to come home by, lad. Aye. |
| 2 | Frostbun | core | Warm one. For the cold way up. |
| 2 | Sir Rollo | core | Rolled it all the way here. Didn't stop once. Nobody told me to. |
| 2 | Kinako | core | Limited edition!! One of one!! Free!! |
| 3 | Elder Nutmeg | core | An acorn's worth of light. Given back, for safekeeping. |
| 3 | Mossmantle | core | Hmmmmm. That means "goodbye" in pine. |
| 3 | Skipper Rafferty | core | I'd sing you off, star, but the others asked me not to. |
| 3 | Old Gloop | core | Eight lanterns would be showing off. Here's one. |
| 3 | Lady Honksworth | core | From Her Honkship. Do try to be grateful. |
| 3 | Goody Gander | core | And one from the sensible sister. |
| 4 | Ma Haybury | core | From all eight of us. The kits each held it a bit. |
| 4 | The Wickwork Moth | core | (The Wickwork Moth clicks, very gently.) |
| 4 | Gran Burrows | core | Mind your head on the way up, little light. |
| 4 | Lumbra the Long | core | From the bottom of everything. Quite literally. |
| 4 | Postmistress Pell | core | Special delivery. No stamp required, just this once. |
| 4 | Pelagia | core | For the boy who came down the Ladder. We remember you. |
| 5 | Master Scoria | core | Forged the hook it hangs on. Couldn't forge the light. Nobody can. |
| 5 | Soakley | core | Calmly given. Calmly. There you go. |
| 5 | Lady Fumarole | core | Warm from the bath. Do not ask how. |
| 5 | Sable | core | I found the lantern in the dig. The light's mine. Was mine. Yours now. |
| 5 | Tutor Scarabelle | core | Given light: correct answer. Full marks. |
| 5 | The Nimbles | core | (The Nimbles puff, all together.) |
| 6 | Grandpa Dormy | earned · ss-02 done | I stayed awake for this. Don't tell anyone. |
| 6 | Hazel Thimble | earned · ss-05 done | There's a bun in the lantern. For the trip. |
| 6 | Granny Mochi | earned · ss-03 done | From the oldest cat on the isle to the youngest star in the sky. |
| 6 | Primrose Thistledown and the kits | earned · ss-08 done | Four little paws held this. And mine. Gently! |
| 6 | Puddle | earned · ss-07 done | (Puddle waves. The lantern waves too.) |
| 6 | The Quackenbushes | earned · ss-06 done | Quack! (That was the whole speech.) |
| 7 | Grumble's nephews | earned · ss-11 done | We're not scared of the dark. We just like lanterns. |
| 7 | Great-Aunt Flurry | earned · ss-12 done | Knitted you a cosy for it. Snnnk. |
| 7 | Professor Pinfeather | earned · ss-20 done | A precisely measured quantity of light. You are welcome. |
| 7 | Pennywhistle | earned · ss-29 done | My crow friend helped carry it. Well. He watched. |
| 7 | Rook | earned · any part of ss-49 done | Race you to the top! ...Fine. You go first. This once. |
| 7 | Mr Whelk | earned · ss-35 done | A rare shell with a light in it. The rarest thing I own. |
| 8 | Bosun Snore | earned · ss-36 done | Zzz... (He hands it over in his sleep.) |
| 8 | Pitch | earned · ss-39 started | One day I'll forge you a star. Today, a lantern. |
| 8 | Flick | core | Great-Granny's coming. She's slow. She says that's dignified. |
| 8 | Granny Wick | core, always last | (no caption: she speaks line 4 of the scene) |

When Pitch gives his lantern and ss-39 is active, Mote presses a star splinter into his hands (caption "Mote gives
Pitch a tiny star splinter.") and ss-39 completes ([side-content.md#ss-39](./side-content.md#ss-39)).

<a id="act-IV-reactions"></a>
### Epilogue reactions (main ending onward)

Default top lines from `mainEnding` (priority 50) until `trueEnding`; after it, the second line where given.

| Who | After the main ending | After the true ending |
|---|---|---|
| Elder Shellby | Every hundred years. I'll be a very old turtle next time. ...I'll be there, mind. | (ch22 invite lines until then) Keep the hanky handy, dear. She still sneezes on Tuesdays. |
| Mayor Ribbit | The festival continues until further notice! I am the further notice. I'm not giving it. | A letter in a bottle! From our town! I've declared it the official town letter. |
| Miso | Mote's star doesn't pay rent either. Nobody in the sky pays rent~ | You threw a bottle in the sea. Littering. Romantic littering. I'll allow it~ |
| Clover | I'm painting the new chart! Every isle! Mote's star is a dot. A very important dot. | My chart's finished! It's on the Nook wall now. Look for the dot. |
| Professor Hoot | Field Notes, final chapter: "Home." It's short. It's my favourite. | My star count is up by one. Exactly one. I have never been so happy to be right. |
| Digby | Gran says the whole Rootdeep's warm again. She sends her love. And a scarf. It's itchy. | Shellby told me about the letter. I'd have written mine in mud. Mud lasts. |
| Nell Pelliwick | All the lights are home. The sea's never looked so friendly. | Saw your bottle bob out past the reef this morning. Heading somewhere nice. |
| Granny Wick | The Firstlight's back in the tower. I sit by it and read. It's very good for my eyes. | Next Night I'll be two hundred and twelve. I intend to be very rude about it. |
| Grumble Shroom | Caught a seed. Gave it back. Twice now. Hmph. I'm good at this. | Night was nice. Don't tell anyone I said nice. |
| Captain Pinch | Every lamp lit, every boat home. That's all a skipper wants, lad. | That bottle had a good arm behind it. Aye. |
| Frostbun | Caught one. Warm one. Gave it back. Good bun. | Snow tastes like stars tonight. Mmm. |

No epilogue line implies that anyone will be gone by the next Night (tone charter: no death by implication); the old
characters joke about being older, never about not being there.

---
<a id="ch22"></a>
## Chapter 22: The Hundred-Year Night (true ending, post-game)

*Threshold:* `mainEnding` **and** at least **8 of 12** Bottle Chain letters found (the shipped bottle counts) **and**
at least **50 of 100** Sleeping Acorns awake. Never "all". *Sets:* `ch22Invite`, `trueEnding`, `letter:1-3`.
*Gives:* item `hanky` (Shellby's hanky). Variant realm: [atlas-home.md#hundred-year-night](./atlas-home.md#hundred-year-night).
Lore: [lore.md#pip](./lore.md#pip), [lore.md#bottles](./lore.md#bottles). Emotional target: **belonging**. T7 fires.

Quest `q:night` "The Hundred-Year Night" (main, post-game):

| Step | Done when | Journal text | Hint nudge | Hint answer |
|---|---|---|---|---|
| 0 | threshold met | Find more bottles and wake more acorns (bottles {b} of 8 · acorns {a} of 50). | Hoot's notes list the shores you haven't combed. | Bottles bob on shores across the Wide Blue; four are in the Glassway. Acorns snore within 10 m; wake them with the Sunglass. |
| 1 | `ch22Invite` | Elder Shellby wants a word. | He's on his bench by the Tree. | Talk to Elder Shellby by the pedestal. |
| 2 | sat at dusk | Sit with Shellby at dusk. | Evening is his favourite time. | At dusk, walk to Shellby's bench and press {interact} to sit. With the Starsong you can play Dusk to bring evening sooner. |
| 3 | letter written | Write a letter. | Three things worth knowing. | Pick three lines for your letter, then press {interact} to seal it. |
| 4 | `trueEnding` | Send it out to sea from the lighthouse. | Pinch knows the best spot. | Climb to the lighthouse gallery with Captain Pinch and give the bottle to the sea. |

**Before the threshold**, Shellby's Talk (once, then as the second box of his epilogue line): "Not yet, dear. There
are letters still bobbing out there, and acorns still snoring. Eight letters and fifty acorns, and then come and
sit with me." **At the threshold**, his next Talk: "There you are. Sit with me at dusk, would you? By the Tree. I've
something to tell you. It's been a hundred years in the telling." Flag `ch22Invite`. Shellby's bench
(`[E] Sit · Bench`) sits beside his spot by the altar ([atlas-home.md#shellbys-bench](./atlas-home.md#shellbys-bench)).

**Scene `ch22-night`** (about 150 s; replayable from Shellby's bench afterwards). Starts on `[E] Sit · Bench` at
dusk or night with `ch22Invite`. Fade; the realm swaps to `night`; Pip sits beside Shellby.

| # | Speaker | Line | Staging |
|---|---|---|---|
| - | - | - | `shot wide` over the plaza: lanterns everywhere, light falling like slow rain; a gold given-light ladder lowers from the zenith to the crown; the Starkin glide down it as soft round lights and settle on the roofs |
| 1 | Elder Shellby | There they are. Look up, dear. | |
| 2 | Wenna | The Hundred-Year Night. They come down when the ladder's given. Just for tonight. | |
| - | - | - | `sfx.mote`; Mote drops onto the pedestal step, bright gold now, cloak patched with new stars |
| 3 | Mote | Green hood! Look at me. I'm *bright*. I'd forgotten I could be this bright. | |
| 4 | Mote | I'm only allowed till morning. I counted. Don't worry. I'm very good at counting. | every Catcher and Warden stands round the plaza (the `night` realm places them) |
| 5 | Elder Shellby | I wrote that letter, you know. The bottle. I was about your size. | `shot two` on Shellby; he does not look at Pip, he looks at the Tree |
| 6 | Elder Shellby | I carried her seeds home that night, in a hat too big for me. And then I wrote to whoever came next. | |
| 7 | Elder Shellby | ...It was your turn, dear. | |
| - | - | - | `emit item hanky`: "You got Shellby's Hanky! Old, soft, and embroidered with a spiral. Keep it handy." |
| 8 | Elder Shellby | Every hundred years. Keep a hanky handy. I always meant that to be advice, you know. Not a joke. | |
| 9 | Wenna | Pip. Every hundred years someone small decides to go. This time it was you. I'm so glad it was you. | Wenna's one line about Pip himself (CANON §3.4, §15.9: no origin story is told) |
| 10 | Wenna | That's all. That's the whole story. It's a good one. | |
| 11 | Elder Shellby | Now. Your turn to write one. I brought paper. | the letter UI opens ([#letter-phrases](#letter-phrases)) |
| - | - | - | fade; `warp` to the lighthouse gallery; Captain Pinch beside Pip; the sea silver under the new star |
| 12 | Captain Pinch | Up ye come, lad. Mind the rail. Best throwin' spot on the isle, this. | |
| 13 | Captain Pinch | Give it a good toss. The sea knows the way. | prompt `[E] Give · The Sea`; `pov`: the bottle arcs out, lands, bobs, and drifts down the moonpath |
| 14 | Captain Pinch | ...Aye. That'll reach somebody. | |

`after: ['set:trueEnding', 'card:true']`. The card `true` shows. Free roam resumes in the `night` realm until dawn,
then home's epilogue state. From now on `[E] Sit · Bench` at Shellby's bench at dusk or night offers "Sit until the
Night comes?" and loads the `night` realm (tone rule 8). The 13th letter is added to the journal's Lore tab as
"Letter 13" with the three picked phrases.

<a id="letter-phrases"></a>
### The 13th letter

The letter UI is a parchment card (pad, keyboard and touch; [systems.md#journal](./systems.md#journal) owns the
widget). Fixed opening: "To whoever finds this:". Fixed closing: "Keep a hanky handy. — P." Between them, three
phrases the player picks, in the order picked, from a list of at most 8: every phrase whose condition holds, the
conditional ones first in table order, then the always-available ones. Always at least 6 choices. Picks are stored as
numbers: `letter:1`, `letter:2`, `letter:3` = phrase number. The letter text is shown, never spoken.

| # | Condition | Phrase |
|---|---|---|
| 1 | always | The Great Tree's name is Wenna, and she likes being thanked. |
| 2 | always | The guardians are catchers. Be gentle, and they'll be gentle back. |
| 3 | always | There's a new star just above the Tree. Wave at it. |
| 4 | always | Light's not for keeping. It's for passing on. |
| 5 | always | Everybody on this isle keeps everybody. They'll keep you too. |
| 6 | always | If you get dizzy, you'll wake up by the Tree. No harm done. |
| 7 | all 3 Catcher rematches won | The guardians love a rematch. Wake them gently. |
| 8 | ss-01 done | The golden grove in the Meadow was planted by touch. Smell it in spring. |
| 9 | ss-09 done | Two old friends raced on the beach again. The turtle won. Probably. |
| 10 | 100 acorns awake | Every acorn is awake. Listen: they've stopped snoring. |
| 11 | 12 bottles found | There are twelve letters older than this one. Find them all. |
| 12 | 30 vistas | Hoot's board has every view on it. The best one is from the crown. |
| 13 | ss-38 done | Master Scoria forges the best swords on the Wide Blue. Ask nicely. |
| 14 | ss-03 done | Miso and Kinako share a shop sign now. Don't mention the twenty years. |
| 15 | every Dash course gold | Clover's courses are faster than they look. Roll everywhere. |
| 16 | ss-45 done | Someone counted a hundred years of nights on a rock in the sky. Visit him. |
| 17 | ss-47 done | A star wrote letters he never sent. They were lovely. |
| 18 | all 5 parts of ss-49 done | A crow called Rook will race you. Let him win once. |
| 19 | ss-14 done | The fourth bough blossomed last. It was waiting for everyone. |
| 20 | ss-53 done | There's a little tree where the new seed went. Say hello to it. |
| 21 | 24 Hollows | Every spiral door has a cave behind it. All of them are worth it. |
| 22 | 16 plushies | Miso's plushies are worth every gem. Don't tell her. |
| 23 | 16 fish species | Nell's fish tank has a fish in it nobody can name. |
| 24 | 10 Dreams | The guardians dream about rematches. So do the Wardens. |

---

<a id="wenna-lines"></a>
## Wenna's pedestal lines (60)

After `wennaAwake`, `[E] Talk · Wenna` at the pedestal (when Pip carries no seed) shows one line in the `wenna` frame.
**Pick rule:** the lowest-numbered unseen line of the current stage (then `seen:w<n>`); when the stage's lines are all
seen, the next one in rotation. Lines of a stage the player has moved past are not shown later (the Lore tab keeps a
"Wenna said" list of every line heard). The side-story lines w58-w60 outrank the stage once, the first Talk after
their condition holds. Wenna also voices "Ask the Tree" from `wennaAwake` on (before that, Shellby does).

Steps that ship them: w1-w12 S-065 · w13-w28 S-171 · w29-w44 S-260 · w45-w60 S-291.

| Stage | Condition | # | Line |
|---|---|---|---|
| S1 | `wennaAwake` and `!lanternGot` | w1 | Hello again, little Pip. I'm still awake. I keep checking. |
| | | w2 | The door's on my north side. I hope it isn't too creaky. I've never had a door before. |
| | | w3 | I can feel every footstep on the isle. Yours are the quick little ones. |
| | | w4 | Your room is in my roots, you know. You moved in when you were this high. You used to kick in your sleep. |
| S2 | `lanternGot` and `!ch8` | w5 | How does the Lantern feel? Warm? Good. It's supposed to feel like a hand on your shoulder. |
| | | w6 | Nell's boat creaks when she's happy. Listen next time you sail. Boats talk too, a bit. |
| | | w7 | There's an isle past the lighthouse with a stone tower. Someone old lives there. Someone who remembers me. |
| | | w8 | Don't be frightened of the dark beacons. They're not broken. They're only empty. |
| S3 | `ch8` and `beacons==0` | w9 | Granny Wick! She was a little girl the last time I was properly awake. She used to wave at me from the tower. |
| | | w10 | The Lamplighters drew that chart. They drew me on it too, see? The tree in the middle. Not bad, for moths. |
| | | w11 | Something went up past the tower, you said? Up. Hm. Up is a long way. |
| | | w12 | Three isles, three lights. Go in any order you like. I'd start with the one that sounds nicest. |
| S4 | `beacons==1` | w13 | I felt it catch! Like someone lighting a candle in the next room. |
| | | w14 | My light's out there again, a little. It's strange, being in two places. I'm getting used to it. |
| | | w15 | Did the isle sound different afterwards? They always do. Every isle has its own rhythm. |
| | | w16 | Hoot's counting the stars again. Tell him he isn't miscounting. Don't tell him why. I don't know why yet. |
| S5 | `beacons==2` (`moteNamed`) | w17 | ...Mote. He said Mote? He's here? He's been up there all this time? |
| | | w18 | He was the littlest after me. He used to sing too loud. Everyone pretended to mind. |
| | | w19 | A hundred years on a rock in the sky. Oh, Mote. Oh, little star. |
| | | w20 | He isn't bad, Pip. He's lonely. Lonely things grab. I know. I grabbed this rock once, and never let go. |
| S6 | `beacons==3` | w21 | Three lights. The sea feels warm again, all the way out. |
| | | w22 | The old tower lamp was lit from my very first seed. I remember it going up the cliff in a moth's arms. |
| | | w23 | Be careful in that tower. And be kind to whatever's in there. It's probably only lonely too. |
| | | w24 | If you see Mote... tell him I'm awake. Tell him I'm all right. |
| S7 | `act2done` and `!stoneSites` | w25 | He took it. The old light. I felt it go, like a stitch pulled loose. |
| | | w26 | There's a ladder in the sky now, made of everyone's light. He's building it for me. He thinks I want to go. |
| | | w27 | I've forgotten something down there. Digby will help. He's never minded the dark. He says it's just Tuesday. |
| | | w28 | Mind my roots, little sprout. They're very old, and some of them are ticklish. |
| S8 | `stoneSites` and `stones==0` | w29 | My roots showed you where the stones fell. Three stones from the old stair. They've been lost so long. |
| | | w30 | Past the reef the sea goes shallow and glassy. I used to listen to it. It sounds like someone humming. |
| | | w31 | The Lamplighters on the Cairn, in the memory. I'd forgotten how small they were. Small, and so busy. |
| | | w32 | The stair started at the Cairn's needle. Frostbun sits right under it. I don't think Frostbun knows. |
| S9 | `stones==1` | w33 | One flight, up off the needle. I can feel it there, like a step I'd forgotten I had. |
| | | w34 | Small Shellby, in that hat. Don't mention the hat to him. He was very proud of the hat. |
| | | w35 | Pelagia and Shellby used to race on my beach. She always won. He always asked for a rematch. |
| | | w36 | Two more stones. Take your time. They've waited a hundred years; they can wait till after lunch. |
| S10 | `stones==2` | w37 | I chose. He asked me to come home, and I said no, and it broke his heart a little. |
| | | w38 | It broke mine too. But who would they wake up next to, Pip? Who would you have woken up next to? |
| | | w39 | He thinks I'm stuck here. I'm not stuck. I'm rooted. It's different. It's the best thing I ever did. |
| | | w40 | One more stone. Then he and I can talk properly. I've had a hundred years to think of what to say. |
| S11 | `stones==3` and `!act3done` | w41 | The stair is whole. ...He's up there, isn't he? At the top. |
| | | w42 | The storm, the stones falling, and someone small writing by lamplight. I wonder who he was writing to. |
| | | w43 | Go gently up there. It's his home, even if it's only a rock. Knock first. |
| | | w44 | Take the Hook, and the Gloves, and a snack. Hazel's buns travel well. |
| S12 | `act3done` and `!mainEnding` | w45 | He's pulled his ladder up into the stars. I can feel it from here, like a hand on my crown. |
| | | w46 | The Starkin will know what to do. They're slow, but they're never wrong. That's what being old is, mostly. |
| | | w47 | Pip, whatever happens up there, I'm still here. I'm not going anywhere. That's the whole point of me. |
| S13 | `mainEnding` and `!trueEnding` | w48 | Good evening, little sprout. Did you see his star? Just above me. He blinks at me. I blink back. |
| | | w49 | Every hundred years he'll come down a given ladder. I'll have a sneeze ready. |
| | | w50 | Everyone's lights are home. Listen. Can you hear the pine from here? No? I can. |
| | | w51 | Thank you, Pip. I don't think I said it properly. Thank you. There. Properly. |
| | | w52 | My acorns are still snoring out on the isles. Wake a few more. They grow up so fast. |
| | | w53 | Shellby sits on his bench every evening now. I think he's waiting for you. Whenever you're ready. |
| S14 | `trueEnding` | w54 | You wrote a lovely letter. I read it over your shoulder. Trees can do that, a bit. |
| | | w55 | Somebody, in a hundred years, will find it, and come and say hello. Isn't that nice? |
| | | w56 | Shellby's hanky suits you. Keep it handy. I've a sneeze in me somewhere still. |
| | | w57 | You can visit the Night whenever you like. Sit with Shellby. They'll all come down. |
| side | ss-14 done | w58 | My fourth bough. It was waiting for everyone to come home. Now it's blooming. Look. |
| side | ss-53 done | w59 | My new little seed is growing where you put it. I can feel it. It's a bit cheeky. |
| side | every region card on every land visited | w60 | You've been everywhere, haven't you? I can feel your footsteps on every isle. Thank you for visiting all of me. |

<a id="memory-lines"></a>
## Villager memory lines (once per act)

Tone rule 10: villagers name specific things this player did, once per act. Each of the six villagers has, per act,
an ordered list of save facts; on the first Talk in that act (dialogue priority 60, before the beat line), the first
fact that holds is spoken once and flags `mem:<npc>:<act>`. The last row of each list is a default that always holds,
so every villager says exactly one memory line per act. Act numbers: [#flags](#flags). S-012 ships the Act I rows
(P0, before the act counter exists: Act I = `!wennaAwake`); later rows ship with S-170 (Act II), S-260 (Act III) and
S-291 (act 5, the epilogue). Act IV (the sky chapters) has no villager memory lines; Pip is not home.

**Act I** (facts: `calm:<id>==1` first Catcher calmed; `shells` errand done; keepsakes found; plushies; Shiny Sword)

| Who | Fact → line |
|---|---|
| Elder Shellby | `calm:peaks==1` → You went to Frostbun first? Brave. I'd have started with the one that doesn't sit on you. · `calm:woods==1` → Grumble first! Good thinking. Get the grumpiest one out of the way, that's what I always say. · `calm:shores==1` → Pinch first? He'll be proud. He likes being first. Don't tell the others. · default → You're getting brown from all that sun, little sprout. It suits you. |
| Mayor Ribbit | shells done → Clover tells me you found all five rainbow shells. I'm having a certificate made. On a leaf. · keepsakes ≥ 2 → Hoot says you've been poking round the backs of things. Very civic. Very nosy. I approve. · default → You calmed a guardian before lunch! I've never calmed anything before lunch. Not even myself. |
| Miso | plushies ≥ 1 → How's your plushie? Have you named it? You should name it. Not something silly~ · `swordLevel==2` → That Shiny Sword suits you. Swish swish~ Still no refunds, though. · default → You're my best customer. You're also my only customer under a metre tall~ |
| Clover | shells done → My shells glow every sunset now. Every single one. Because of you! · `S.bosses.shores` → You beat Captain Pinch! Was his hat too small? Tell me his hat was too small. · default → You're an explorer now. Real explorers write things down. I'll lend you a pencil. |
| Professor Hoot | `S.bosses.woods` → My paper on your gentle defeat of Grumble Shroom has been very well received. By me. · keepsakes ≥ 2 → You've found some of the old keepsakes! Each one's a footnote to history. I adore a footnote. · default → I've started a notebook just about you. It's mostly question marks. Good ones. |
| Digby | keepsakes ≥ 1 → Found one of the round-the-back things, did you? Told you. Tall things keep secrets. · `S.bosses.peaks` → Frostbun sat on my roof again. Said you hop well. High praise, from a bun. · default → You walk like somebody with somewhere to be. I can hear it. Good for you. |

**Act II** (facts: which isle was relit first (`beacon:<isle>==1`); side stories; Dash; vistas; acorns)

| Who | Fact → line |
|---|---|
| Elder Shellby | `beacon:pinewhistle==1` → Pinewhistle first. Did the pine sing for you? It used to sing me to sleep on clear nights. · `beacon:archwater==1` → Archwater first! Did you see the arch? We used to call it the sea's front door. · `beacon:threemills==1` → Threemills first. Did they give you pie? They always give you pie. It's a rule. · default → You've been sailing. You smell of salt and adventure. Mostly salt. |
| Mayor Ribbit | ss-04 done → I went to sea. On a boat. In deep water. I am a changed frog. Please don't make me do it again. · default → You're on the town crest now. It's a small hood. Next to a large frog. |
| Miso | ss-18 done → Kinako sold you a spoon. An ordinary spoon. Limited edition. Mrrow. Give it here, I'll polish it~ · default → All over the Wide Blue, and you still come back to my shop. That's loyalty~ |
| Clover | any Dash gold → You got gold on one of my courses! I've moved it to the hard list. · default → I'm making a map of everywhere you go. It's mostly arrows. |
| Professor Hoot | vistas ≥ 5 → Five vistas sketched! My board is filling up. Some of the sketches are even the right way up. · default → Field Notes, chapter two: "Pip Goes to Sea." I'm told it's gripping. |
| Digby | acorns ≥ 10 → Ten acorns awake! I can hear them yawning in the roots. Like popcorn, only slower. · default → Things smell different since you started sailing. Saltier. Braver. |

**Act III** (facts: side stories; which stone was set first)

| Who | Fact → line |
|---|---|
| Elder Shellby | ss-09 done → Pelagia came to visit. She beat me in a race. I let her. I've been letting her for a hundred years. · `stone:bell==1` → You found the Sunken Bell first. Did it ring? I'd have liked to hear it ring. · default → You've got that look, dear. The one people get when they've seen something old. |
| Mayor Ribbit | plushies ≥ 8 → Miso says you've bought half her stock. Our economy thanks you. I've no idea what that means. · default → Three far isles! I've had a bigger map made. It's on two tablecloths. |
| Miso | ss-41 done → You met Master Scoria! Isn't he lovely? Don't tell him I said so. Prices would go up~ · default → Kettle Isle forges the swords I sell. So you've been in my warehouse. Behave~ |
| Clover | ss-23 done → I got lost on purpose! And you found me! That's what a real map is for, I think. · default → The Glassway has sandbars you can walk on! I'm going when I'm older. Or taller. |
| Professor Hoot | ss-20 done → Pinfeather and I have agreed to disagree. Pinfeather is wrong, but very politely. · default → My star count's been holding steady. Remarkable. Something up there is waiting. |
| Digby | ss-33 done → Gran says you found her pouch-stitching in the meadow. She's very pleased. I'm very embarrassed. Both at once. · default → The roots hum the old stair-song now. I hum it wrong. Gran says so. |

**Epilogue, act 5** (facts: completion milestones)

| Who | Fact → line |
|---|---|
| Elder Shellby | ss-13 every walk done → We walked to every isle, you and I. Slowly. Best walk I've had in a century. · default → I sat on my bench last night and counted stars. One more than before. You know which. |
| Mayor Ribbit | parade done → The parade lanterns glowed all through the night of the sneeze! I'm told. I was under a table. · default → I've declared you a Hero of the Town. It comes with a ribbon. The ribbon is the whole prize. |
| Miso | 16 plushies → Every plushie, sold. To you. I've nothing left to stitch. I'll stitch *you* next~ · default → Kinako and I are speaking again. Mostly about prices. It's a start~ |
| Clover | every Dash gold → Gold on every course! I'm painting it on the chart. Big gold stars. · default → When I'm grown I'm sailing to every isle you went to. In the same order. With snacks. |
| Professor Hoot | bestiary complete → The Bestiary is complete. I've no more creatures to describe. I may describe you. · default → Pinfeather has asked to read my Field Notes. I said yes. I've never been so frightened. |
| Digby | acorns ≥ 75 → Seventy-five acorns awake. The roots sound like a choir now. A sleepy choir. · default → I can smell spring coming, and it isn't even spring. That's your doing, a bit. |

---
<a id="beat-index"></a>
## Beat index (for the planner)

| Beat | Chapter · title | Count key | Sets | Main-path hours | Steps (INDEX) |
|---|---|---|---|---|---|
| I.1 | 1 · The Morning After | - | `introDone` | 0.2 | S-008 |
| I.2 / I.3 / I.4 | 2-4 · Woods, Frost, Sea Starseeds | seeds 1-3 | `calm:*`, `handover:*` | 3.0 | S-004, S-005, S-006, S-009-S-012 |
| I.5 | 5 · The Bloom | seeds 3 | `bloom` | 0.2 | S-006, S-067 (card) |
| I.6 | 6 · Wenna Wakes | - | `nellHome`, `wennaAwake` | 0.1 (+0.5 home finds) | S-064-S-066 |
| ch7 | 7 · Under the Roots | - | `lanternGot`, `rolloCalm`, `jettyOpen` | 2.0 | S-067, S-068 |
| act-I-sky | (Act I) · a light on the sky isle | night, 1 in 3 | `seen:hoot.star` | - | S-011b |
| ch8 | 8 · Duskwick | - | `thiefSeen`, `ch8`, `cc.lampRound` | 2.0 (incl. The Lamp Round) | S-090, S-091, S-091b |
| motes-traces | (ch9-12) · notes signed M | beacons 0-2 | `seen:mote-note-1..3` | 0.2 | S-090b, S-106a, S-127a, S-148a, S-163 |
| set-pieces | one per land | - | per land | 2.5 | S-091b, S-106c, S-127c, S-148c, S-203b, S-232c, S-254c |
| ch9-11 | 9-11 · the three isles | beacons 1-3 | `beacon:<isle>` | 12.0 | S-106, S-127, S-148 |
| beacon-1 | (in ch9-11) | beacons 1 | - | - | S-106 |
| II.M / beacon-2 | (in ch9-11) | beacons 2 | `moteNamed` | - | S-128 |
| beacon-3 | (in ch9-11) | beacons 3 | `towerOpen` | - | S-148 |
| ch12 | 12 · The Lamplighters' Tower | beacons 4 | `act2done`, `sneeze2`, `ch13` | 2.5 | S-165 |
| ch13 | 13 · Into the Rootdeep | - | `lumbraCalm`, `mem:1-3`, `stoneSites` | 3.5 | S-190, S-191 |
| ch14 | 14 · Past the Reef | - | `ch14` | (in the Glassway's 3.5) | S-203 |
| ch15-17 | 15-17 · the three Stair Stones | stones 1-3 | `stone:<site>` | 11.0 | S-212, S-232, S-254 |
| stone-beats | (in ch15-17) | stones 1-3 | `mem:4-12` (on watching) | 1.5 (memories) | S-212 |
| mote-present | (in ch15-17) | stones 1-2, `act2done` | `moteSeenStair` | 0.3 | S-212d |
| ch18 | 18 · The Starstair | stones 3 + memories 12 | `ch18`, `act3done` | 2.5 | S-264, S-271, S-272 |
| ch19 | 19 · The Starmeadow | - | `ch19` | 1.0 | S-278 |
| ch20 | 20 · The Ladder of Lights | freed 1-4 | `freed:*`, `ch20` | 2.5 | S-280-S-282 |
| ch21 | 21 · The Second Sneeze | lanterns 8 | `mainEnding`, `epilogueTalk` | 1.0 + 1.0 (the Crown) | S-283-S-286 |
| ch22 | 22 · The Hundred-Year Night | bottles ≥ 8, acorns ≥ 50 | `ch22Invite`, `trueEnding`, `letter:1-3` | 1.0 | S-288-S-290 |

Main path: Act I 4.0 + Interlude 1.25 + Act II 13.5 + Act III 17.25 + Act IV 4.0 = **40 h** (CANON §11, modelled; it
includes the depth additions of CANON §11.1: deepened dungeons, set pieces, Mote's traces, playable memories).

---

<a id="art"></a>
## Art for the story's own assets

Character looks and models are in [cast.md](./cast.md); props placed in the world are in the atlas files. This file
owns the assets only scenes use: act-card paintings, finale cut-ins, the Wenna frame, story items and scene effects.
Every image follows the style preamble in [art-audio.md#style](./art-audio.md#style) (the prompts below start with
its short form: *"Soft painterly storybook illustration, gentle gouache and watercolour texture, warm rim light,
rounded shapes, cozy pastel palette, no text, no logos, no letters, original characters only."*). Generated in the step
that needs them (a GPT Sol or Gemini subagent with its image tool), saved as webp, added to `assets/manifest.js` with
`realm` and `deferred: true` so they load with the realm that shows them, never in the core precache. Every key has
the fallback listed; `?noassets=all` must still show every card and scene. 3D items follow the ART BRIEF template in
[art-audio.md#brief-template](./art-audio.md#brief-template).

### Act-card paintings (4)

Format for all four: 1600 × 900 px, opaque webp, quality 80, ≤ 200 KB each; composition leaves the lower-middle third
calm (the card panel sits there); characters small in frame, faces readable but simple. Fallback: the shipped
`ending_art` painting with a colour-graded CSS overlay per card (act2 `#2b2238` at 35 %, act3 `#c9b6ec` at 30 %,
act4 `#141a3a` at 30 %, true `#2a3358` at 35 %).

| Key · realm tag | Shown | Image prompt (after the preamble) |
|---|---|---|
| `card_act2` · `duskwick` | ch12 | A tall stacked-stone lighthouse tower on a palm headland at dusk, its great lamp glowing warm gold; far above it in the north-east sky a thin ladder made of small floating lights climbs toward a tiny floating island; a very old moon moth in a shawl leans on the lamp-room rail looking up; purple and gold sky, calm sea, gentle melancholy, wide landscape. |
| `card_act3` · `driftholm` | ch18 | A floating lilac meadow island above a sea of clouds; a broken stone arch carved with a spiral glows gold; a ladder of small lights winds up through the arch and away into a starry deep-blue sky; a tiny child in a leaf-green fox-eared hood stands at the arch's foot, seen from behind, with small round cloud creatures around his feet. |
| `card_act4` · `crown` | ch21 | An enormous gentle tree at night with a soft sleepy-smiling face in its trunk and a spiral on its brow, its crown full of pink-gold blossom and paper lanterns; one new bright star directly above the crown; a faint golden ladder fading upward; tiny silhouettes of villagers holding lanterns on the branches. |
| `card_true` · `night` | ch22 | A cream-and-coral striped lighthouse on a rock at night under a starry sky; a small glass bottle with a rolled letter bobbing on a silver moonpath on calm water; on a bench below a huge tree in the distance, an old turtle and a tiny hooded child sit side by side, seen from behind; lanterns everywhere, soft falling lights like slow rain. |

### Finale cut-in panels (3)

Shown together for 3.6 s in phase 2 (three vertical panels side by side; on a phone, stacked). 640 × 900 px each,
opaque webp, ≤ 90 KB each, realm tag `crown`. Fallback: a canvas panel in the Starseed's colour (`#8be07a`, `#9fdcff`,
`#ff9f8f`) with the Starseed sprite and the speaker's name in the dialogue font. Draw the Catchers from their shipped
GLB looks (CANON-NOW §2.4) so the panels match the models; generate one reference turnaround from a screenshot of each
GLB first and pass it to the image tool.

| Key | Prompt (after the preamble) |
|---|---|
| `cutin_catch_woods` | A grumpy round purple mushroom guardian with golden spots, a tiny gold crown and a white moustache, leaping in a forest at night to catch a glowing green leaf-shaped star in both stubby hands, mid-air, determined frown, motion lines of leaves, vertical panel. |
| `cutin_catch_peaks` | A huge fluffy white yeti-bunny with icicle-tipped ears and blue paw pads stretching up on a snowy peak at night to catch a glowing pale-blue snowflake-shaped star, eyes squeezed shut, snow flying, vertical panel. |
| `cutin_catch_shores` | A big red crab in a small navy skipper's hat with an anchor badge, on a beach beside a striped lighthouse at night, catching a glowing coral-pink shell-shaped star in one claw and saluting with the other, vertical panel. |

### The Wenna dialogue frame

CSS, no image required: the shipped dialogue panel with a 3 px border `#e8c66a`, inner glow `0 0 18px #ffe9a8`
at 45 %, background `#fff8e6` at 92 % (dark theme `#3a3020` at 92 %), name plate `#b8894a` on `#fff1c9`, text
`#4a3a22`. Optional painted corner ornament `ui_frame_wenna_corner` (128 × 128 px, transparent webp, ≤ 12 KB, core
precache): "a small curl of golden leaves and one blossom, painted, transparent background". Fallback: no ornament.

### Story items (2D icons and 3D held props)

Icons: 128 × 128 px transparent webp, ≤ 10 KB, the same look as the shipped `icon_*` set; fallback a canvas circle
in the item's main colour with its initial glyph.

| Item | Icon key · prompt | Held prop (code-built, `js/props.js`) and ART BRIEF |
|---|---|---|
| Shellby's Hanky (`hanky`) | `icon_hanky` · "a soft folded cream handkerchief with a small leaf-green spiral embroidered in one corner, slightly worn, on a transparent background" | **Silhouette:** a folded square cloth, one corner hanging. **Size:** 0.30 × 0.30 m flat, 0.18 m folded. **Palette:** cloth `#f3e3c3`, embroidery `#7aa63a`, hem `#e2cfa6`. **Materials:** toon cloth, one `MeshToonMaterial`, the spiral as a 64 px canvas decal. **Poly budget:** ≤ 120 tris. **Pose:** held in Pip's left hand in `pov`, waved once in the item-get beat. **3D prompt:** "a small folded cream handkerchief with a green spiral embroidered in one corner, soft cloth folds, stylised toon look, game prop". |
| The 13th letter in its bottle (`letter13`) | `icon_letter13` · "a small clear glass bottle with a cork, a rolled cream letter tied with a green ribbon inside, transparent background" | **Silhouette:** the shipped keepsake bottle with a green ribbon. **Size:** 0.26 m tall. **Palette:** glass `#bfeee6` at 45 % opacity, cork `#b8894a`, paper `#f5e6c4`, ribbon `#8fbf45`. **Materials:** reuse the shipped bottle model from `js/props.js` plus a ribbon torus; one transparent material. **Poly budget:** ≤ 300 tris. **Pose:** held in `pov` at the gallery rail; thrown along a 1.2 s arc. **3D prompt:** "a small corked glass message bottle with a rolled letter and a green ribbon inside, stylised toon game prop". |
| The Firstlight (`firstlight`, scene actor only; Granny Wick keeps it) | none | **Silhouette:** a faceted ember-crystal inside a halo. **Size:** 0.25 m crystal, 1.2 m additive halo sprite. **Palette:** core `#ffffff`, body `#fff1b8`, halo `#ffd36b` → transparent. **Materials:** icosahedron (detail 1) with emissive toon material + one additive billboard (`fx_firstlight`, below). **Poly budget:** ≤ 80 tris. **Animation:** slow 0.2 Hz pulse of halo scale 0.9-1.1, 6 °/s spin. **3D prompt:** "a small glowing white-gold crystal ember, faceted, radiant, stylised, game VFX prop". |
| The gold given-light Ladder (scene actor) | none | **Silhouette:** two thin gold rails with rungs that are paper lanterns. **Size:** 0.9 m wide, rung spacing 0.6 m, up to 47 rungs (28 m) then a fade into the sky card. **Palette:** rails `#e8c66a`, lantern paper `#fff1c9` → `#f2b45a` when lit. **Materials:** rails as two thin cylinders (8 sides), rungs as one `InstancedMesh` of the shipped parade-lantern geometry, emissive. **Poly budget:** rails ≤ 200 tris, ≤ 180 tris per lantern instance, 1 draw call for all rungs. **Animation:** each rung fades in over 0.8 s as its lantern arrives; whole ladder fades rung by rung from the bottom at the end. **3D prompt:** "a delicate golden rope ladder whose rungs are glowing paper lanterns, rising into a starry sky, stylised toon". |
| The Dandelion, far (`boat_far` sprite, I.6 only) | `boat_far` · 256 × 256 px transparent webp, ≤ 16 KB, realm `home`: "a tiny sailing boat seen from far away at night, one small triangular sail, a warm lantern glowing at the masthead, a soft light reflection on dark water, transparent background" | Billboard only (no model). Fallback: a 6 px warm dot `#ffd36b` with a 24 px additive glow, bobbing 0.3 m. |

### Scene effects (sprites)

All additive billboards, transparent webp, ≤ 20 KB each, core precache unless tagged. Fallback for each: a canvas
radial gradient in the listed colours.

| Key | Size | Prompt (after the preamble) | Used by |
|---|---|---|---|
| `fx_streak` | 64 × 512 | "a thin vertical streak of soft golden light with a bright head and a fading tail, on black, for additive blending" | I.6 window streaks, ch8 glimpse, II.M, ch12 |
| `fx_firstlight` | 256 × 256 | "a round soft white-gold glow with a bright core and gentle rays, on black, for additive blending" | ch12, ch21, ch22 |
| `fx_spark_tears` | 128 × 128, 4 frames strip | "four frames of tiny golden sparks falling like tears and fading, on black, for additive blending" (process with `tools/process_strip.py`) | ch12 |
| `fx_leaf_single` | 64 × 64 | "one small green leaf, slightly curled, soft shading, transparent background" | ch12 small sneeze (reuses the shipped falling-leaf particle if one exists) |
| `fx_blossom_ring` | 256 × 256, realm `crown` | "a ring made of pink-gold blossoms and tiny lights, seen face on, transparent centre and background" | ch21 glide rings |

---

<a id="decisions"></a>
## Decisions made here

1. **Flag keys may contain capital letters.** CANON's flags are camelCase (`wennaAwake`, `moteNamed`, `act2done`),
   but S-003's validator regex is `/^[a-z0-9:_.-]{1,48}$/`, which would drop them. The regex must be
   `/^[A-Za-z0-9:_.-]{1,48}$/` (S-003 adopts it; systems.md#save-plan should state it).
2. **Order-carrying flags.** `calm:<id>`, `beacon:<isle>` and `stone:<site>` store the order number (1-4) rather than
   `true`; counts are the number of keys set. A `flag` step value `'next'` means "1 + the number of keys with the same
   prefix already set".
3. **New flags** not named in CANON: `bloom`, `bloomDusk`, `handover:<id>`, `inst:1-3`, `rolloCalm`, `jettyOpen`,
   `thiefSeen`, `sneeze2`, `lumbraCalm`, `mem:1-12`, `stoneSites`, `stoneHeld:<site>`, `ch19`, `ch20`, `freed:<isle>`,
   `epilogueTalk`, `ch22Invite`, `trueEnding`, `letter:1-3`, `crownShow`, `mem:<npc>:<act>`, `met:<npc>`.
4. **The scene format** uses exactly the seven step kinds S-034 names; everything else (cards, sky changes, items,
   spawns, warps, actor paths, labels, cut-ins, the chain) is an `emit` event. Added `go: true` for non-blocking
   steps and the skip rule "apply every remaining `flag` step, then `after`".
5. **Wenna's name on screen.** Her frame reads "The Great Tree" until Shellby greets her by name in I.6 ("Hello,
   Wenna, dear. It's been a long time."), which also plants T7. Three new I.6 lines (Shellby ×2, Wenna ×1) and a
   closing Wenna line about the root door were added to CANON's I.6 lines.
6. **I.6 timing.** It waits for the first dusk transition after the bloom card closes (so a bloom at dusk does not
   chain straight into I.6), or plays at once on Continue of a bloomed save at dusk or night.
7. **I.6 lights-out order:** Threemills, Pinewhistle, Archwater, Duskwick (CANON fixes only Duskwick last);
   chosen so a clockwise orbit from WSW passes the NE sky isle before the last window.
8. **Shellby's page-3 line** is a fourth intro box, as S-008 says, not a later Talk. Missed instalments are told after
   the bloom, with a post-bloom wording for instalment 3.
9. **The Catchers at the bloom** are scene actors at fixed plaza marks (−9, −2), (11, 4), (−8, 18) (nearest walkable),
   not the bosses moved; the same marks are their evening plaza spots from `moteNamed`.
10. **Chapter banners** for chapters 7-22 reuse the region name-card component; chapters 9-11 and 15-17 are numbered
    by arrival order.
11. **Main-quest people steps** for every isle and stone site (three steps each) were written here, region by region,
    with NPCs from CANON; the atlas and dungeon files place their objects.
12. **Who visits the plaza** after each Act II beacon: Elder Nutmeg, Skipper Rafferty, Ma Haybury.
13. **Crown lanterns earned away from home** are shown by a 6 s `crown-show` scene on the next arrival home.
14. **Beacon 1's Lamp Log 2 reading** waits for Pip's next visit to Duskwick if he goes home first.
15. **The Firstlight** is a crystal ember inside the tower lens; Pip's kindle lights the ordinary flame and wakes it;
    Mote takes only the ember, so the tower stays lit. In ch21 Mote hands it to Granny Wick, who arrives last in the
    lantern chain.
16. **Ladder floors** free four borrowed lights: Duskwick's tower-window light (taken on the bloom night),
    Pinewhistle, Archwater, Threemills; freed beacons burn gold for good and their horizon windows turn gold.
17. **The given lantern.** Pip's `Give · Lantern` returns the caught last spark (Mote's own light) from the Glowbud
    Lantern; Pip keeps the tool. Bearers carry the shipped parade-lantern prop.
18. **Lantern chain:** 30 core bearers + Flick + Granny Wick (always, Wick last) and 14 earned bearers gated by side
    stories; 6 per wave; at most 12 bearer models visible; 4× fast-forward on hold.
19. **ch18 requires all 12 memories**, not just 3 stones, so T5 and the letter memory always precede Mote's "You saw
    it". A main quest `q:remember` carries the memory steps.
20. **Cloudstep** is given by the Nimbles at the Spiral Arch after the chase (the Spiral Stair's reward).
21. **Wenna speaks anywhere on the home isle** ("anywhere my roots go") and in the Rootdeep and the Crown; elsewhere
    she is silent.
22. **Wenna's 60 lines** are split into 14 stages plus 3 side-story lines; lines of a stage already passed are not
    shown later (the Lore tab lists the ones heard).
23. **The throw verb** is `[E] Give · The Sea` (Give is on the charter's verb list; "Throw" is not).
24. **The 13th letter** has a fixed opening "To whoever finds this:" and closing "Keep a hanky handy. — P.", 24
    phrases (6 always available), and shows at most 8 choices.
25. **No epilogue line implies a future absence** (Granny Wick jokes about turning 212 instead).
26. **Card art keys** `card_act2`, `card_act3`, `card_act4`, `card_true` are lazy, realm-tagged and fall back to the
    shipped `ending_art` with a colour overlay.
27. **Act IV attack lock:** Pip's attack input is disabled within 12 m of Mote throughout Act IV (Pip never hits Mote).
28. **Before the true-ending threshold**, Shellby states the numbers plainly (8 letters, 50 acorns) and the journal
    shows both counts.
