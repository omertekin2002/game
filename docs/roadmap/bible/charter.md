# Charter: tone, voice, names and invariants

The rulebook every writer and every implementation step obeys. It owns **how** Starseed Isle is written, named and
built, and never **what** is in it: no story beat, place, character sheet or content number is defined here. Content
lives in the other bible files, and this file links to them.

Written 2026-11-21 against `main` at `b79d73d` (save v6), from `CANON.md` §13-§14, `CANON-NOW.md` §0, §6
and §9, `ground/ENGINE.md` §5-§7, `INDEX.md` §1-§5, the shipped `docs/DESIGN.md` §10, §13-§15, and the genre
study (`research/genre-study/REPORT.md` §4.3, §6.7, §9.5, §10.4, §12.2 #28 and #30).

<a id="how-to-use"></a>

## How to use this file

**Order of authority.** `docs/roadmap/CANON-NOW.md` LOCKED items > `docs/roadmap/CANON.md` > the
reconciliation rows in `docs/roadmap/steps/*.md` (for the topics they name, until the named close-out edits the losing
file) > the game bible (`docs/roadmap/bible/*.md`, this file included) > the `docs/roadmap/INDEX.md` row > a step
issue. A step file's "Bible reconciliations" table deliberately overrides the bible file it names until its close-out
folds the choice back in; any other contradiction between a step and the bible is a bug in the step. When two bible files disagree on a fact, the file that **defines** the thing wins (see the
[glossary index](#glossary)). When a bible file breaks a rule in this charter, the charter wins and the other file is
fixed in the same PR that notices it.

**What steps cite.** Four anchors are cited by steps and are enforced by `tests/docs.test.js` (S-001):

| Anchor | Cited by | What a step does with it |
|---|---|---|
| [`#invariants`](#invariants) | S-001, and restated in every issue | Copies the [invariants block](#invariants-block) into `## Acceptance criteria`, keeping the lines that apply |
| [`#tone`](#tone) | S-002 and every content step | Runs the [tone review checklist](#tone-check) on all new player-facing text and behaviour |
| [`#budgets`](#budgets) | S-022, the 8 perf checkpoints, every realm step | Measures the [per-view budgets](#budgets) at the realm's fixed views in both cameras |
| [`#close-out`](#close-out) | Every `chore: close Mxx` step | Follows the [close-out checklist](#close-out) item by item |

**Words used here.** "Player-facing text" is any string a player can see or hear in the shipped game: dialogue, signs,
notes, letters, toasts, cards, prompts, menus, journal pages, bestiary cards, loading tips and item text. "Docs" are
files under `docs/` and code comments. Rules about tone and voice bind player-facing text and are advice for docs.
"Must" is a test or a review blocker; "should" is a default that a PR may break only with a stated reason.

---

<a id="tone"></a>

## Tone charter

The game is kind and gentle (LOCKED, DESIGN §1): "Enemies 'poof', Pip gets 'dizzy', nobody is hurt for real." The
expanded story adds a stranded brother, a fading people and a goodbye, and this charter is what keeps those beats warm.
The model is the "cosy sandwich" (REPORT §4.3): danger lives at the edges and is chosen, so home feels warmer. Gentle
never means eventless: every act opens and closes on a boss or a big scene (CANON §12, rule 3).

<a id="how-dark"></a>

### How dark it may get

The ceiling, verbatim from CANON §13: **a brother stranded for a hundred years; a people grown few and moved away; a
ladder broken in a storm; a lamp taken from an old moth's hands; a goodbye.** In one line: **sad only in the past tense
or in a goodbye; scared for one night at most; tired but never hurt.**

What is allowed at that ceiling, as a writer's test:

| Feeling | Allowed form | Not allowed |
|---|---|---|
| Sadness | Something that already happened (a storm, a long wait, people who moved away), or a goodbye where both sides are fine | A loss happening now to someone the player loves; a sad thing the story never resolves |
| Fear | A little fear of the dark, always answered with light within the same scene; worry about a friend who turns out fine | Threat to a child, a pursuer that hurts, a scare built to make the player jump |
| Loneliness | Waiting, a long absence, counting days (Mote's Tally Wall) | Despair, giving up on life, anything that reads as self-harm |
| Conflict | Someone who made a wrong choice for a kind reason, and says so | A villain with no reason, a betrayal by a friend |
| Tiredness | Sleepy, dim, droopy, hoarse, worn out from helping | Sick, dying, starving, injured |

<a id="always"></a>

### Always

Ten rules. Each has what it means in practice and how a step proves it. The ids `A1`-`A10` are what a PR description and
a review cite.

**A1. Sprout Village and every town are safe zones: no enemy, ever.**
- The towns are listed per land in the atlas files (each land's village region); CANON §7 names them. Every interior
  (cottages, shops, libraries, homes) is also a safe zone, and so is Pip's Nook.
- In data: a town region has `enemies: []` and `max: 0`, as Sprout Village does today (`REGIONS[0]`, LOCKED).
- An enemy chasing Pip stops at a town region's edge and wanders back; no projectile, telegraph or boss move may land
  inside a town region.
- Proof: a content-lint unit test fails when any realm's town or interior region has a non-zero `max` or a non-empty
  enemy table; the realm suite spawns at each town spawn and asserts zero enemies within the region after 30 s.

**A2. Everything that fights is calmed, not beaten.**
- Enemies **poof** (sparkles, a soft sound, a gem maybe) and never leave a body. Pip gets **dizzy** and wakes by the
  Great Tree, or at the entrance inside a dungeon, with full hearts and gems kept (LOCKED, DESIGN §6).
- Every boss, Warden and Catcher ends a first fight by sitting down dizzy, talking, and staying friendly and talkable
  where it lives. It is "calmed", never "defeated" (the LOCKED "gentle defeat" in Hoot's paper title is the only use of
  that word).
- Proof: every boss def in `creatures.md` names a handover scene and post-fight talk lines; content lint fails a boss
  def without both.

**A3. Danger is drawn, slow and few.**
- Every attack shows its exact danger zone at least **0.55 s** before it can hurt (coral halo, pulse, glint and pose,
  LOCKED). At most **two** attackers wind up or attack at once. Every hit Pip takes is **half a heart**; later lands
  are harder through patterns, never bigger hits.
- Bosses cause their own openings (a bonk, a slip, a doze) and the boss bar says **"Now!"**.
- Proof: a unit test over every enemy and boss move def asserts `windup >= 0.55` and damage `== 1` (one half-heart);
  the boss balance test (INDEX §4) runs for every new boss.

**A4. Hard things are opt-in.**
- Optional: rematches (`Wake`), Guardian Dreams (`Dream`), the Hundred Lamps, activity gold tiers, Great-Aunt Flurry,
  Bosun Snore. Each starts only on a prompt the player chose, never by walking in (LOCKED for rematches).
- The critical path never holds a sudden spike: every story boss meets the balance target (a careful player wins
  at least 90 % of attempts losing no more than 3 hearts, in the boss's time window: 45-90 s for Sir Rollo, 60-120 s
  for the Act II Wardens, 120-180 s for the act closers and Act III Wardens;
  [creatures.md#balance-targets](./creatures.md#balance-targets)).
- Proof: the boss balance test; the progression solver marks every opt-in encounter as `optional: true`, and no
  main-quest step depends on one.

**A5. The antagonist has a case, and Pip never hits him.**
- Mote's case (the Tally Wall, the scrap lamps, Moonmere's letters) is visible in his own places before the player is
  asked to judge him. He is never a target: no hurtbox, no lock-on, no damage number, no HP bar.
- His encounters are a chase and a catch (`creatures.md#boss-mote-chase`, `creatures.md#finale`), never a bout.
- Proof: the Mote entity is created with `hittable: false` and `lockable: false`; an in-page test swings at him and
  asserts no hit event.

**A6. Melancholy wears sunshine.**
- A dimmed isle is still sunny by day. What is missing is a **sound** (the pine stops singing), a **rhythm** (the
  tide, the mill sails) or a **glow** (a beacon, a lit window), never colour or life.
- No desaturated, grey or dead-looking palette anywhere. The shipped wilting Great Tree (droopy moss, sleepy face) is
  the darkest visual state in the game and stays so.
- Proof: each realm's palette in `art-audio.md#palettes` has its "dim" state documented as a sound/rhythm/glow change;
  review compares a screenshot of the dim and restored states side by side in the PR.

**A7. Restoration never reverts; nothing earned is taken back.**
- A relit beacon, a set Stair Stone, a woken acorn, a lit crown lantern, a healed region and every item stay for good.
  When Mote takes the Firstlight, the Tower keeps the ordinary flame Pip kindled and its crown lantern stays lit.
- Proof: flags marked `restore: true` in the flag dictionary (`systems.md#conditions`) may only go from unset to set;
  a unit test runs every scene's effects over a full-progress save and asserts no `restore` flag, item or collectible
  is cleared.

**A8. Nothing is missable.**
- Night content returns every night, and the Starsong's *Dusk* tune makes night at a bench. Memory knots, Moonmere and
  the Hundred-Year Night stay revisitable. Every one-time scene replays from the journal's Lore tab.
- No collectible, side story, activity tier or bestiary entry can be locked out by an earlier choice or by finishing
  the main story. The Planting is a choice with no wrong answer and no lost content.
- Proof: the progression solver runs again on the post-ending state and reaches every collectible id; content lint
  fails a scene without `replay: true` unless it is on the short list of interactive scenes in `systems.md#scenes`.

**A9. No side content gates the main ending; the true ending asks for thresholds, never "all".**
- The main ending needs only main-quest steps. The true ending's thresholds are set in `story.md#ch22`; they are always
  "N of M" with N clearly below M.
- Proof: the progression solver proves the main ending from a save with zero side stories, zero activities and zero
  optional collectibles.

**A10. Humour in every chapter, and villagers remember this player.**
- Every chapter, sad ones included, has at least one line written to make the player smile (a pun, a running gag, a
  character being gloriously themselves).
- Once per act, each villager gains one line naming something this player actually did, read from the save (place-keyed
  character lines; count-keyed plot lines, CANON §12 rule 7). See [memory line rules](#memory-line-rules).
- Proof: the chapter's step lists its humour line(s) in the PR description; content lint checks each villager has one
  `act-<n>` memory line per shipped act.

<a id="never"></a>

### Never

Each item names what to do instead. The ids `N1`-`N16` are what reviews cite.

| Id | Never | Do instead |
|---|---|---|
| N1 | Death on screen or by implication; anyone killed; a body, a grave, a funeral, an epitaph | People "moved away", "grew few", "went home"; enemies poof; the Lamplighters' fading is told as children moving away |
| N2 | Ghosts or spirits of the dead; haunting | The `ghost` enemy archetype is a code word only. In player-facing text Dimlings, Hushlings and Wisp Lanterns are shy lights or puffs of dusk that show in lamplight, alive and silly |
| N3 | A dark power, corruption, possession, a curse, mind control, a "something behind it all" | Every trouble has a person with a kind reason (a Catcher, a Warden, Mote) or weather (the Storm) |
| N4 | "It was all a dream" | Dreams are named as dreams from the start (Guardian Dreams) and never retcon events |
| N5 | Betrayal by a friend | Disagreement out loud, then making up (Miso and Kinako's sulk) |
| N6 | A chosen-one prophecy, a bloodline, a destiny | Pip is "the one who bothered to go" (`lore.md#pip`) |
| N7 | Peril to a child (Pip, Clover, the Thistledown kits, Flick, Pitch, Puddle, the shroomlets, the young cast in memories) | A child is "lost" happily (drawing chalk arrows) and always fine; danger never targets a child NPC |
| N8 | Jump scares, horror lighting, screen-shaking stingers, pitch-black rooms | Dark rooms are a warm dim with the Lantern's circle (see [dark places](#dark-places)) |
| N9 | A hurt, sick, trapped or starving animal | Creatures are tired, sleepy, hoarse, grumpy or stuck in a funny way |
| N10 | A timed fail state (a countdown that ends in "you failed") | Timed things are races or chases that restart in place, cost nothing, and use "Again?" instead of "fail" |
| N11 | Mockery of Digby's sight by anyone but Digby | Digby jokes about it himself (LOCKED voice); others help without comment |
| N12 | Pip speaking | See [Pip](#pip-voice) |
| N13 | The village or any town attacked, threatened or unsafe | Trouble happens away from towns or as a missing sound, rhythm or glow |
| N14 | A villain with no reason, or a guardian, Warden or keeper who is not friendly afterwards | Every boss sits down, explains, and stays (A2) |
| N15 | A travelling companion that follows Pip (unseen in first person, and interrupts) | Chapter partners walk ahead or beside for one chapter only (CANON §6) |
| N16 | Real-world harm themes: weapons beyond Pip's sword and sling, blood, poison, fire that burns someone, alcohol, gambling with real stakes, real-money anything | Heat is "toasty", hits are bonks and splashes, the sling shoots ember-seeds at targets and enemies only |

<a id="gentle-words"></a>

### Gentle words

Player-facing text uses the left column. Content lint (`tests/content.test.js`, S-025) fails on the words in the
"lint fails on" column, matched as whole words, case-insensitive, outside an allow-list of LOCKED shipped strings.

| Use | Instead of | Lint fails on |
|---|---|---|
| poof, poofed, popped back home | kill, killed, die, died, dead, destroy, slay | `kill`, `killed`, `die`, `died`, `dies`, `dead`, `death`, `slay`, `slain`, `murder` |
| dizzy, bonked, wobbly, woke up by the Great Tree | fainted, knocked out, game over, you died | `game over`, `knocked out` |
| calmed, sat down, napping, friendly rematch, gentle bout | defeated, beaten up, crushed | `defeated`, `crushed` (the LOCKED "gentle defeat" is allow-listed) |
| tired, dim, sleepy, droopy, hoarse | sick, ill, dying, wounded | `dying`, `wounded`, `wound`, `injured`, `blood`, `bleed`, `poison`, `poisoned` |
| moved away, grew few, went home, a long time ago | passed away, lost (of people), perished | `perished`, `passed away`, `grave`, `funeral`, `corpse`, `skeleton` |
| borrowed, took, kept (of light) | drained, consumed, devoured | `devour`, `devoured`, `drain`, `drained` |
| the dark, a dim cave, a shy light | darkness (as a force), evil, shadow creature, curse | `evil`, `curse`, `cursed`, `corrupt`, `corrupted`, `corruption`, `possessed`, `haunted`, `ghost`, `ghosts`, `spirit of`, `doom`, `demon` |
| toasty, very warm, too hot to touch | burn, burned, scorched | `burn`, `burned`, `burnt`, `scorched` |
| splash, nip, bonk, puff, swish | stab, slash, wound, hurt (as a verb on a character) | `stab`, `stabbed`, `slash` |
| "Again?", "So close!", "One more go?" | failed, you lose, mission failed | `failed`, `you lose` |

"Lamp Thief" and "thief" are allowed: villagers use them before II.M and are gently wrong. "Scared of the dark" is
allowed once per scene when the same scene answers it with light. "Hurt" is allowed only in "nobody is hurt" phrasing.

<a id="sad-beats"></a>

### Writing sad, scary and dark beats

1. **Past tense or goodbye.** A sad fact is told as history ("the Ladder broke in the Storm") or happens as a goodbye
   where both sides are fine ("Every hundred years, then?"). Never as a present threat.
2. **One teller, one feeling.** A sad beat has one speaker carrying it and at most three lines of it before something
   warm (a joke, a kindness, a visible change in the world).
3. **Show the person's case first.** Before the player meets a sad or difficult character in a scene, at least one
   place shows why they feel that way (the Catchers' reason props, Mote's Tally Wall).
4. **The world answers within 10 s.** Every success changes the world where it was earned and in the Great Tree's
   crown within 10 s (CANON §1, §12 rule 4).
5. **No cliffhanger on a threat.** An act card may end on a mystery ("the lights are going out") but never on a
   threat to a named character.
6. **Memories are warm.** The twelve memory scenes are seen, not lived: no enemies, no damage, no fail, a music-box
   theme. The Storm is "seen from far away; nobody hurt".

<a id="dark-places"></a>

### Dark places and night

- Dark rooms read as a warm dim, never black. Without the Lantern a dark room's ambient light is at least 40 % of the
  dungeon light profile's ambient (ENGINE §3.2: `ambient: 0.55`, so at least 0.22), walls and floor edges stay readable,
  and exits glow. With the Lantern, a 6 m warm circle (9 m with Bright Wick) lights fully.
- Proof for every dark room or cavern realm: an in-page check captures one frame with the Lantern off at the room's
  entrance and asserts the mean sRGB luminance of the frame is at least 0.10, and that the exit marker is on screen
  or on the compass.
- Night is pretty, not scary: stars, fireflies, lit windows, glowing mushrooms. Night-only enemies follow the same
  telegraph rules as day ones. No sound sting announces an enemy at night; the shipped "!" and chirp are the cue.

<a id="humour"></a>

### Humour

- **Kinds that fit:** gentle puns ("I hereby declare this jetty... jettied."), running gags (Ribbit's croak, Miso's
  "nothing is refundable", Hoot being cheerfully wrong), characters being exactly themselves, small physical comedy
  (a boss slipping on its towel), deadpan narration ("It feels like the polite thing to do.").
- **Kinds that don't fit:** humour at a character's body, sight, size or age (Digby jokes about his own sight only);
  sarcasm aimed at the player; jokes about real people, places, brands, politics or religion; anything that needs a
  meme or another game to land.
- **Jokes outrank menace** in every boss intro: a boss's name card, intro and first line read as a character, not a
  threat (shipped signs: "Beware of bun.").

<a id="tone-combat"></a>

### Bosses, Wardens and enemies

- A boss fight is framed as a bout, a test, a game or a misunderstanding, and the boss has a kind reason the player
  can see before and hear after (CANON §4.2 grammar: seen before, told after).
- Boss moves are named for what they look like (a belly-flop, a HONK ring, an ink cloud), never for harm.
- Enemies are critters in the way, not foes: their bestiary card says what they like, where they nap and one silly
  fact. A bestiary card never says "dangerous", "deadly" or "vicious".
- After the first win a boss stays where it lives, awake and talkable until its act ends, then naps with a `Wake`
  rematch (and later a `Dream`). It never disappears, leaves in anger or is captured.

<a id="tone-mote"></a>

### Writing Mote and Wenna

- **Mote** is called "the Lamp Thief" by others until `moteNamed`. He is cross, lonely, funny in a dry way, and wrong
  only about what his sister wants. He cries sparks, not tears of despair. He never threatens anyone, never hurts
  anyone, and takes nothing from a person by force: the Firstlight scene is him pleading, Granny Wick saying no, and
  him taking it and fleeing in tears (CANON §4.4), never a struggle.
- **Wenna** is gentle, tired, and funny when rested. She never commands Pip; she asks ("Will you find out for me?").
  She is never in danger in the present tense: the Ladder "pulls at her" and she is tired, never dying.
- Neither is ever described as a god, a spirit or a power. They are Starkin: family.

<a id="tone-check"></a>

### Tone review checklist

Every content PR copies this list into its description and ticks it. A reviewer may block on any unticked item.

- [ ] No new enemy can spawn in, chase into or hit inside a town or interior (A1).
- [ ] Every new thing that fights poofs or sits down and stays friendly; Pip only ever gets dizzy (A2).
- [ ] Every new attack has a drawn danger zone at least 0.55 s ahead and deals half a heart; at most two attackers at
      once (A3).
- [ ] Anything hard that this PR adds is opt-in behind a prompt (A4).
- [ ] Mote is not hittable, lockable or damaged anywhere (A5).
- [ ] Dim states change a sound, rhythm or glow, not the palette's warmth (A6).
- [ ] Nothing this PR does can clear a restoration flag, item or collectible (A7).
- [ ] Every new scene replays from the journal; every new collectible stays reachable after the ending (A8).
- [ ] No new side content is needed for the main ending (A9).
- [ ] At least one line in this chapter is there to make the player smile (A10).
- [ ] `bun test` content lint passes: no gentle-words violations, every line at most 220 characters, tokens valid.
- [ ] None of N1-N16 appears, including in bestiary cards, signs and loading tips.

---

<a id="voice"></a>

## Voice rules

<a id="spelling"></a>

### Spelling, case and punctuation

- **British spelling** in UI, settings and player-facing text ("colour", "centre", "practising", "favourite"),
  **except the in-game word "cozy"** (LOCKED: "a cozy little adventure", "Population: cozy"). Docs may write "cosy".
- **Sentence case** for everything except proper names and the prompt pill's verb and name (`Talk · Mayor Ribbit`).
  Titles of side stories, Hollows, chapters and cards use title case for the main words (*The Parcel With No Name*).
- **Short sentences.** Exclamation marks are welcome; at most one per sentence; never "?!".
- **Ellipsis** is three full stops `...` with no spaces before and one after when the sentence continues
  (`"Hmph. Fine. FINE. Take it."`, `"...Aye, aye."`). Never the single `…` character in player-facing text (the shipped
  text uses `...`).
- **Quotes inside a line** are single quotes: `A note on the door: 'Gone fishing. Back... eventually.'`. Double quotes
  are only the data string's delimiters.
- **Dashes.** A spaced em dash `—` only in sign titles, as shipped ("Grumble Shroom's Hollow — NO VISITORS."). In
  dialogue use a full stop or an ellipsis instead.
- **Capitals for shouting** only for single words or very short bursts ("FINE.", "RIBBIT!", "HONK!"), at most once
  per line.
- **Numbers** in dialogue are words up to ten ("three Starseeds"), digits after ("forty years", except in counts the
  UI shows: "Rainbow shell 2/5"). Big comic numbers are spelled out ("Four thousand and twelve stars").
- **Pronouns.** Pip is "he". The Great Tree is "her" (LOCKED). Mote is "he". The Starkin and the Twinklings are "they"
  as a group.

<a id="line-length"></a>

### Line length and pacing

- **Every line is at most 220 characters** after token substitution with the longest glyph label (content lint).
- **Talk branches** (an NPC's ambient lines) are 1-3 lines per branch.
- **Story scenes** run at most 8 lines before the player gets control back or the camera cuts to a new shot, and at
  most 30 lines in all. A longer scene is split into two scenes with a moment of control between them.
- **Handover scenes** are exactly three lines from the boss, then the item beat (CANON §4.2 grammar).
- **Act cards** have at most four lines, the last being "Press any button to continue." ("Tap to continue." on
  touch, as shipped).
- **Letters and logs** (Bottle Chain, Lamp Logs, Mote's letters) may run longer: they are read on a page in the
  journal, at most 600 characters each, in paragraphs of at most 220 characters.
- **Loading tips** are one sentence, at most 100 characters.

<a id="tokens"></a>

### Control tokens

Controls are never written as keys ("press E"). They are `{tokens}` that `js/hud/keys.js` `fmtKeys` turns into the
current device's glyph (keycap, pad button or touch chip).

| Token | Action | Status |
|---|---|---|
| `{interact}` (alias `{use}`) | interact / Use | shipped |
| `{jump}` (alias `{hop}`) | Hop | shipped |
| `{dash}` (alias `{roll}`) | Roll (hold to sprint) | shipped |
| `{attack}` (alias `{swing}`) | Swing | shipped |
| `{lock}` (alias `{lockon}`) | Lock on | shipped |
| `{potion}` | Potion | shipped |
| `{view}` | View | shipped |
| `{shoulder}` | Swap shoulder | shipped |
| `{map}` | Map | shipped |
| `{pause}`, `{move}`, `{look}`, `{sprint}` | Pause, move, look, sprint | shipped |
| `{tool}` | the rebindable tool action (default `T`, pad D-pad up) | NEW in the abilities step (F14) |
| `{journal}` | open Hoot's Field Notes | NEW in the journal step (F16) |

Rules: a new rebindable action adds its token to `GLYPHS` and to the content lint's known-token list in the same PR
that adds the action. A line names a control only where the player needs it right then; flavour lines never name
controls. An unknown token is a lint failure.

<a id="glyphs"></a>

### Glyphs and symbols

| Glyph | Means | Where |
|---|---|---|
| `✿` | good news, a celebration | toasts ("✿ Saved"), notes, the act and ending cards (LOCKED usage); never in dialogue except a celebratory card line |
| `~` | Miso's purr | **only** in Miso's speech (LOCKED); no other character, no UI |
| `!!` | Kinako's excitement | **only** in Kinako's speech; no other character uses a double exclamation mark |
| `✦` | dizzy stars | the dizzy card only (five of them, LOCKED) |
| `★` | completion | "★ 100%" (LOCKED) and the Completion page only |
| `♥` | hearts | feed lines about hearts ("Refreshed! ♥ full", shipped) |
| `·` | separator | the prompt pill (`Talk · Elder Shellby`), card titles ("End of Act Two · The Dimming"), rematch and Dream titles |
| `N/M` | progress count | "Secret found 1/4", "Rainbow shell 2/5" (shipped format, no spaces) |

No emoji in player-facing text. No other decorative glyphs without a charter PR.

<a id="pip-voice"></a>

### Pip

- **Pip never speaks.** No dialogue line is attributed to Pip, no dialogue choice puts words in his mouth, and no
  other character quotes him ("Pip says...").
- Narration may describe a small action in the second person, present tense, as shipped: "...You wave back. It feels
  like the polite thing to do." It never describes his thoughts at length or his feelings as fact beyond one short
  clause.
- Pip **writes** once: the 13th letter in chapter 22, built by the player from phrases (`story.md#ch22`). The phrases
  are the player's choice and are written as a letter, never as speech.
- Characters address Pip as "Pip", "little Pip", "dear" or "little sprout" (LOCKED forms); new characters use "Pip",
  their own tic ("lad" for Pinch), or a respectful nickname set in `cast.md`. Nobody calls him "hero" or "chosen".

<a id="reserved-markers"></a>

### Reserved speech markers

A speech marker belongs to one character. Content lint fails a line that uses a reserved marker under another
speaker. Full voices are in `cast.md`; this table only reserves the markers.

| Marker | Owner | Status |
|---|---|---|
| `~` anywhere; "Mrrow", "purr", cat puns ("Purr-fect") | Miso | LOCKED |
| `!!`; "limited edition" | Kinako | CANON |
| "Ribbit!", "Croak.", "I hereby declare" | Mayor Ribbit | LOCKED (Puddle may say a tiny "ribbit" once, as his nephew) |
| "Hoo", "Hoo-hoo!", "Remarkable!" | Professor Hoot | LOCKED |
| "Did not see you there"-style sight jokes; "Digby's the name" | Digby | LOCKED |
| "dear" + "little sprout" together | Elder Shellby | LOCKED ("dear" alone is shared with Granny Wick and the very old) |
| "ye", "aye", "belay", "lad" | Captain Pinch | CANON |
| "Hmph", short grumbles | Grumble Shroom | CANON |
| rolled r's ("Brrr-rrr"), short sleepy sentences | Frostbun | CANON |
| "HONK", "Your Honkship" (said to her) | Lady Honksworth | CANON |

New characters get one marker each (see [verbal tics](#tics)) and add it here in the same PR.

<a id="tics"></a>

### Writing a verbal tic

- One tic per new named character, readable in one line, and it must survive being read 50 times. Good tic kinds: a
  word they over-use, a sentence shape (Frostbun's short sentences), a sound (Honksworth), a habit of counting
  (Hoot's star count), a catchphrase about their job.
- A tic is never an accent that mocks a real-world group, a speech impediment played for laughs, or a slur-adjacent
  word.
- The tic shows in at least half of the character's lines and never in more than one place per line.
- `cast.md` records each tic; [reserved markers](#reserved-markers) records any that would collide.

<a id="name-use"></a>

### Who may say which name

Some names are earned. Before the beat that reveals one, every speaker and every UI string uses the descriptor.

| Name | Before | Who may say it, and from when |
|---|---|---|
| **Wenna** | "the Great Tree", "the Tree", "her" | Only the oldest characters say "Wenna": Elder Shellby, Granny Wick, Pelagia, Mote, Old Mother Brightwell, the Starkin (the Twinklings included), the three Catchers, Lumbra the Long, Tutor Scarabelle. Everyone else and every UI string (compass, journal headings, prompts) says "the Great Tree" for the whole game. The journal's Lore tab may use "Wenna" in a quoted line once the player has heard it |
| **Mote** | "the Lamp Thief", "a cloaked light", "someone" | From the flag `moteNamed` (II.M) everyone may say it; the journal entry renames from "The Lamp Thief" to "Mote" at that flag |
| **Starkin** | "the stars", "star folk" | After the beat that first explains them (`lore.md`, `story.md`) |
| **Lamplighters** | "the old lamp-keepers", "we" (the humming stone) | From chapter 8 (Granny Wick) |
| Shellby as the bottle-writer | "a young turtle", "someone very small" | Never stated in UI or by another character before chapter 22; only Shellby says it, in chapter 22 |
| Pip's origin | nothing | Never told: no foundling story, parents or prophecy (CANON §15.9). Wenna's one line about Pip is in chapter 22 (`lore.md#pip`) |

<a id="narration"></a>

### Narration, signs, notes and letters

- **Narration** (prompt results, peeks, knocks, chest text) is second person, present tense, at most two sentences per
  page: "You peek into the well. A tiny frog on a lily pad waves back at you."
- **Signs** start with the place's name, then a joke or a rule: "Captain Pinch's Cove — Trespassers will be pinched!"
- **Notes on doors and boards** are in the writer's voice inside single quotes.
- **Letters** (the Bottle Chain, Mote's letters) open with a greeting in the writer's voice, are signed or initialled,
  and fit the [letter length rule](#line-length). The twelve bottles open "To whoever finds this" (the LOCKED shipped
  bottle's form).
- **Item text** ("You got the X!") is one line of what it is and one line of what it does, with a token if the player
  must press something: "Double damage, longer reach, extra sparkly." (shipped Shiny Sword).

<a id="toasts"></a>

### Toasts, feed and objective lines

- Good news toasts start with `✿ ` and end without a full stop unless they are two sentences: "✿ Errand done: Rainbow
  shells", "✿ Nell is home! The lighthouse brought her in."
- Counts use `N/M` (shipped "Secret found 1/4"). Gems: "+N gems!" (shipped).
- The compass objective is at most 32 characters, imperative or a place name: "Under the Roots", "Sail to Duskwick"
  (CANON), "Bring the Starseed home" (shipped). Its short form (pinned at the ribbon edge) is one word: "Altar",
  "Bridge" (shipped).
- Quest step titles in the journal are imperative and name the person or place: "Ask Granny Wick about the tower".

<a id="cards-format"></a>

### Cards: region, boss, act and loading

| Card | Format | Rule |
|---|---|---|
| Region card | **Name** + subtitle in quotes | Subtitle at most 30 characters, a cosy joke or warning ("Bring a scarf!", "Mind the coral"). Defined per land in the atlas files |
| Boss name card | **Name** + title | Title follows the shipped alliterative shape "*Adjective Role* of the *Place*" ("Snippy Skipper of the Sunny Shores"); titles are defined in `creatures.md` |
| Rematch / Dream card | "Name · Rematch", "Name · Dream" | shipped format, middle dot |
| Act card | ✿ line / "End of Act N · Title" / one line / "Press any button to continue." | At most four lines; ships only in the same release as the content behind it (CANON §14); text in `story.md` |
| Loading card | painted card + one rotating tip | Tips follow [line length](#line-length); per-realm art in `art-audio.md#loading-cards` |

<a id="journal-voice"></a>

### Hoot's Field Notes and Ask the Tree

- The journal is Professor Hoot's *Field Notes*. Its headings, quest steps and counts are **plain and correct** (the
  player relies on them). Hoot's personality lives in a margin note per entry, where he may be cheerfully wrong
  ("Frostbun: probably a cloud. Hoo!"), always followed by the true fact in the entry body.
- **Ask the Tree** gives two strengths, a nudge then a plain answer. The nudge names a direction or a person; the
  answer names the place and the action ("Hook the purple thistle above the lighthouse door with {tool}."). Shellby
  voices it until `wennaAwake`, then the Great Tree does. Hints are never sarcastic, never say "obviously", and never
  cost anything.

<a id="memory-line-rules"></a>

### Villager memory lines

- Once per act, each villager gains one line naming something this player did, read from the save: a guardian calmed
  first, a keepsake found, a side story finished, a plushie bought. The line picks from at most four save facts
  (CANON §12 rule 7: at most 4 x 4 hand-written combinations per act).
- A memory line never names something the player has not done, never scolds the player for what they skipped, and
  never compares the player with other players.

---

<a id="first-person"></a>

## First-person rules

Starseed Isle is played in first person by default (FP eye 0.88 m), with an over-the-shoulder view on `{view}`. Every
case study in the genre research was third-person, top-down or 2D (REPORT §6.7), so these rules adjust their advice.
Every step that adds a place, an item, a companion or a cue checks them.

1. **Landmarks do the navigation.** Every region has one landmark visible from the region's entry, and fog never hides
   a landmark (landmark fog is capped at 0.45, as shipped). A new landmark's step proves it with a screenshot from the
   region entry in first person.
2. **Held items are the character animation.** Every tool has a first-person viewmodel (shown in the hand or at the
   screen's lower edge) and a third-person model on Pip. A tool that is "used" with no visible hand change is a bug.
3. **Worn rewards need a second place to show.** Hood trims, the Starsteel Sword and the Lantern show in third person,
   in Pip's shadow (the shipped "fox ears" shadow), and in at least one villager line.
4. **Followers walk ahead or beside.** A chapter partner (Digby in ch13, the Twinklings in Act IV) stays inside the
   first-person view cone (within 40° of the view direction and 2-8 m ahead) whenever Pip is moving toward the goal.
   Nobody trails behind Pip.
5. **Every sound cue has a visual twin.** The acorn's snore shows a "z" puff; the Chime Bell's chime pulses a HUD
   icon; an enemy's notice is the shipped "!" plus chirp; off-screen wind-ups show the shipped coral chevrons. A muted
   player can find everything.
6. **Jumps forgive.** New gaps, hookbloom swings, glides and cloud motes use the shipped hop leniency and never require
   a jump judged on a ledge Pip cannot see in first person: either the landing is in view at take-off or a marker
   (a glow, a flag) shows it.
7. **Prompts sit under the crosshair** in first person and above the target in third person (shipped). A new
   interaction that needs a precise aim (Sunglass at a receiver, Sling at a bell target) shows a reticle state change
   on target.
8. **Scenes look at the speaker.** Story scenes use the shipped "look at whoever is talking" camera and respect the
   Motion comfort setting: no camera roll or shake in a scene when Motion comfort is on.

---

<a id="verbs"></a>

## The UI verb list

<a id="pill"></a>

### The prompt pill

Format: `[key] Verb · Name`. `[key]` is the glyph of the action that performs it (interact for most; the `tool` action
for tool verbs). `Verb` is one capitalised imperative word ("Pick up" is the only two-word verb, LOCKED). `Name` is the
target's proper name, or a lower-case descriptor for something not yet known ("Something glowing", "A bottle",
LOCKED). The pill is at most 32 characters including the separator.

<a id="verbs-shipped"></a>

### Shipped verbs (LOCKED)

| Verb | Target | Example |
|---|---|---|
| Talk | a character | `Talk · Mayor Ribbit` |
| Shop | Miso's counter (and later Kinako's bazaar) | `Shop · Miso` |
| Read | a sign, a board, a note | `Read · Signpost` |
| Knock | a locked door | `Knock · Door` |
| Open | a chest, a bottle | `Open · A bottle` |
| Peek | the well | `Peek · Well` |
| Pick up | an errand item | `Pick up · Rainbow shell` |
| Wake | a napping boss (starts a rematch) | `Wake · Grumble Shroom` |
| Look | a keepsake, the empty pedestal | `Look · Something glowing` |
| Place | the pedestal with a seed in hand | `Place · Starseed` |
| Use | anything without a better verb | `Use · Lever` |

<a id="verbs-new"></a>

### New verbs (CANON §13)

| Verb | Key | Target and meaning | Example |
|---|---|---|---|
| Enter | interact | a portal: a door that leads to an interior, a dungeon mouth, a Hollow's spiral door, a root-gate, the Spiral Arch | `Enter · Under the Roots` |
| Sail | interact | a jetty or the *Dandelion*: opens the chart | `Sail · the Dandelion` |
| Sit | interact | a Lamplighter bench (marks it; fast travel from found benches); Shellby's bench in the epilogue | `Sit · Bench` |
| Ring | interact | a bell Pip rings by hand (the Sunken Bell's bells, the Bell Duel) | `Ring · Low bell` |
| Dig | tool (Digging Paws) | soft earth | `Dig · Soft earth` |
| Hook | tool (Thistle Hook) | a hookbloom in reach (14 m) | `Hook · Hookbloom` |
| Climb | interact | a ladder, rope or the Starstair's first step; ivy needs no key (walk in) and shows the pill with no key glyph | `Climb · Ivy` |
| Touch | interact | a memory knot on the Taproot | `Touch · Memory` |
| Kindle | interact | a dark beacon, brazier or lantern with the Glowbud Lantern held | `Kindle · Beacon` |
| Give | interact | handing something over in a scene (the finale's lantern, a parcel) | `Give · Lantern` |
| Dream | interact | a napping boss whose Dream is open (post-game) | `Dream · Frostbun` |
| Fish | interact | a fishing spot (ripples) | `Fish · Ripples` |
| Sketch | interact | one of Hoot's vista posts | `Sketch · Vista` |
| Unlock | interact | a locked door with its key in Pip's pocket | `Unlock · Door` |

Tools with no target (the Sunglass beam, the Ember Sling, the Starsong tunes) do not show a pill: they show a reticle
state and, for the Starsong, the tune name in the objective line while it plays.

<a id="verbs-rules"></a>

### Adding a verb

A new verb needs a PR that edits this table, `js/interact.js`'s verb set and the content lint's verb list together.
Before adding one, reuse: `Use` covers levers, cranks and valves; `Open` covers gates that are not locked. The list
is capped at 30 verbs (25 today).

<a id="ui-words"></a>

### Status words, move names and menu names

- **Status words (LOCKED, reuse them):** poof, dizzy, bonked, calmed, gentle defeat, friendly rematch, napping, "Now!",
  half a heart, "Pip got dizzy!", "Pip woke up by the Great Tree.".
- **New status words:** kindled (a beacon), relit (an isle), set (a Stair Stone), woken (a Sleeping Acorn), lit (a
  crown lantern), found (a bench), opened (a root-gate). Each is past tense and used in toasts: "✿ Beacon kindled!".
- **Move names (LOCKED):** Swing (three-hit combo, the third a big chop), Hop, Roll (hold to sprint), Lock on, Potion,
  View. New: **Tool** (the rebindable action, Settings label "Tool"), **Glide** (hold Hop in the air with the Leaf
  Glider).
- **Menus:** Pause keeps Resume, Settings, Controls, Map, Chat log, Save & Quit (LOCKED) and gains **Field Notes**.
  Field Notes tabs: **Quests, Items, Bestiary, Lore, Map, Completion**, and the **Ask the Tree** button. The world map
  is the **Chart** ("Lamplighter's Chart" in item text). Title screen buttons stay New Adventure, Continue, Settings.

---

<a id="naming"></a>

## Naming and originality

<a id="originality"></a>

### Originality rules

Starseed Isle is original IP (LOCKED, DESIGN preamble). These rules apply to every name, line, image, model, level and
tune that enters the repo, whoever or whatever made it.

1. **Never copy another game, film, show or book**: no names, characters, creatures, items, places, levels, puzzles,
   plots, quotes, logos, UI layouts, melodies or art taken from or imitating an existing work. Patterns (a hub,
   a glider, a lock-and-key dungeon, a fishing log) are fine; their specific expressions are not.
2. **No name that is the title, hero, villain, signature place or signature item of a well-known work.** CANON already
   renamed three for this reason: the Starfield became **the Starmeadow**, Mother Halo became **Old Mother
   Brightwell**, and Leafwing became the **Leaf Glider**. A fox carrier and a shrinking mechanic were cut partly for
   reading as other games' signatures (CANON §0).
3. **No real people, companies, brands, products, places or trademarks** in names or lines (no real towns, no real
   sweets brands, no celebrities). Generic real things are fine (cinnamon buns, pelicans, windmills).
4. **Image generation prompts never name another game, studio, franchise, artist or living illustrator**, and never
   say "in the style of" anything but this game's own style preamble (`art-audio.md#style`). A generated image that
   resembles an existing character is discarded, not edited.
5. **Music is composed as note data** (`js/audio.js` `TRACKS`); never transcribe or paraphrase an existing melody, and
   never reuse a known jingle's rhythm and contour together.
6. **Puzzles and dungeons** are designed from this game's mechanics (`dungeons.md`); a room that recreates a
   recognisable room from another game is redesigned.
7. **3D prompts in ART BRIEFs** describe silhouette, size, palette and materials only, never "like <character>".

<a id="name-check"></a>

### Checking a new name

Every new proper name goes through these checks before it is merged. The PR description lists the name and ticks
each check.

1. **Collision in this project.** `grep -rni "<name>"` over `docs/` and `js/` finds no other meaning, and the
   [glossary index](#glossary) and [retired names](#retired) do not hold it or a near-identical spelling (one letter
   apart, or the same sound).
2. **Collision outside.** If the agent has a web-search tool, it searches `"<name>" game`, `"<name>" character` and
   `"<name>"` alone, and rejects the name if a top result is a known game, film, show, book or brand whose title,
   character, place or item uses it. Without a search tool, the PR marks the name "originality unchecked" and the
   reviewer checks it.
3. **Plain-English test.** The name reads aloud easily for a child, has at most four syllables per word (Pelliwick,
   Quackenbushes are the ceiling), and does not contain a real-world slur, insult or adult meaning in English.
4. **House style.** It follows the [house style](#name-style) for its kind.
5. **Glossary.** It is added to the [glossary index](#glossary) in the same PR, with its defining file.

<a id="retired"></a>

### Retired names

Names from the three proposals that CANON did not adopt. They must not be reused for anything, so that old drafts in
`research/` can never be mistaken for canon. A writer who needs one of these ideas uses the CANON name in the right
column.

| Retired | Use instead |
|---|---|
| the Starfield; Mother Halo; Leafwing | the Starmeadow; Old Mother Brightwell; the Leaf Glider (originality renames) |
| Digby's Old Diggings; the Tree House; Digby's Lamp; Firefly Lantern | Under the Roots; Pip's Nook; the Glowbud Lantern |
| Juniper; the Round; Hearthtree, Hearthseed, Hearthkeepers; Tree Bed; Seed Satchel | Mote, the Sneeze; the Great Tree (Wenna); the Lamplighters; (no equivalent) |
| Bloomblade; Stoneburrs; Seed-Sling; Vine Tether, Tether Vine | the Starsteel Sword and thornglass; the Ember Sling; the Thistle Hook |
| Digging Paws; Dandelion Glider; Dusk Whistle; Frost Mittens; Sleepy Acorns | the Digging Paws; the Leaf Glider; the Starsong (*Dusk*); (cut); the Sleeping Acorns |
| Mothmere; the Starloom; Kindlers; the Seven Lights | Mote; (cut); the Lamplighters; the Hundred-Year Letter |
| Mumblemire; Hushwater; the Far Hush; Lumen Key; Gullarch; Threemill Downs; Cloudmere; the Orchard Above; the Orchard Gate | (cut); the Glassway; the Glassway; Duskwick; Archwater; Threemills; Driftholm; the Starmeadow; the Spiral Arch |
| Yesteryear Isle; Ringtime; the Drowse; Mirrormere; the Paper Pines; the Tree's Dream | the Remembered Isle; the Remembered Isle; Guardian Dreams; Moonmere; Hoot's Margins; Guardian Dreams |
| Old Knobble; Queen Wormwell; Bellwether; Mother Bellwether; Gale | Sir Rollo; Lumbra the Long; Lady Honksworth; Lady Honksworth; Mote (chase) |
| the Rootways; Rootknot, Root Knot; Wayroots | the Rootdeep and root-gates; memory knots; root-gates |
| Shellboat; Postmaster Pell; Postmistress Puffin; Old Nib | the *Dandelion*; Postmistress Pell; Postmistress Pell; Granny Wick (the chart) |
| Granny Peppercorn; Ottoline; Tock; Hushwing; Wisplets | (cut) |

<a id="name-style"></a>

### House style per kind

| Kind | Shape | Shipped or CANON examples | Avoid |
|---|---|---|---|
| Villager | an honorific or plain first name + a soft, food-, plant- or sound-based name | Elder Shellby, Mayor Ribbit, Miso, Hazel Thimble, Nell Pelliwick | human surnames that read as real families; names over 4 syllables a word |
| Family | "the" + plural surname | the Quackenbushes, the Hayburys, the Thistledowns | |
| Honorifics in use | Elder, Mayor, Professor, Grandpa, Granny, Gran, Great-Aunt, Skipper, Captain, Lady, Goody, Master, Tutor, Postmistress, Bosun, Sir, Mr, Old Mother, Old | | new honorifics without a charter PR; military or royal ranks beyond Captain, Lady and Sir |
| Boss title | alliterative "*Adjective Role* of the *Place*" | "Chilly Champion of Frostcap Peaks" | menace words (Dread, Doom, Terror) |
| Enemy species | two words, cute descriptor + creature, at most 16 characters | Jelly Slime, Dozy Bat, Sizzle Beetle, Coco Clonk | scary words, "Lord", "King", "Dark" |
| Land | one compound English word or "X Isle"/"X Flats" | Duskwick, Pinewhistle, Kettle Isle, Saltglass Flats | invented-language names, apostrophes |
| Region | two words, a place noun + a describing word, plus a card subtitle | Wickhaven "Stilts, moths and lamplight" | |
| Landmark | "the" + a describing name of the object | the Whistling Pine, the Great Arch | |
| Dungeon | "the" or "Under" + a plain place phrase | Under the Roots, the Granary Vaults, the Kettle's Belly | "Temple", "Dungeon", "Lair", "Crypt" |
| Tool | material or plant + object noun | Glowbud Lantern, Thistle Hook, Ember Sling | "magic", "cursed", "legendary", weapon nouns beyond sword and sling |
| Side story | a storybook-chapter title, at most 32 characters, title case | *Nothing Is Refundable*, *The Long Nap* | puns that need explaining |
| Activity | the owner's game in plain words | Clover's Dash, Bell Duel, Steam Hop | |
| Collectible kind | a plural plain noun | Sleeping Acorns, Lamp Logs, heart petals | |

<a id="ids"></a>

### Ids, keys and anchors

Ids live in saves, tests and links, so they never change once shipped. A display name may be fixed later; an id may
not.

| Thing | Format | Examples |
|---|---|---|
| Realm id | lower case, one word, `[a-z_]+`, at most 16 characters | `home`, `duskwick`, `rootdeep`, `dream_frostbun`, `hollow_cc1` |
| Content id inside a realm | `<realm>:<id>` with `<id>` in `[a-z0-9_]+`; home content keeps its shipped unprefixed ids | `pinewhistle:chest_07`, `glassway:bottle_3` |
| Story flag | camelCase noun or past participle, at most 24 characters | `wennaAwake`, `lanternGot`, `moteNamed`, `act2done`, `ch8` |
| Flag family | lower-case prefix + `:` + id | `seen:<scene>`, `thorn:<id>`, `talk:<npc>:<n>` |
| Side story | `ss-01` to `ss-53` (two digits) | `ss-07` |
| Activity | `act-<kebab>` | `act-dash`, `act-bell-duel` |
| Dungeon | `d1`-`d11`, `o1`-`o4` | `d5` |
| Beat | as in `story.md`: `I.1`-`I.6`, `II.M`, `ch7`-`ch22`, `beacon-1`-`beacon-3` | `II.M` |
| Manifest key | `snake_case`, realm-prefixed for realm assets, owned by `art-audio.md` | `duskwick_sand`, `portrait_granny_wick` |
| Text id | `<realm or system>.<owner>.<n>` in `js/text/en/*.js` | `home.shellby.inst1` |
| Bible anchor | explicit `<a id="...">` before the heading; kebab-case of the name with a leading "The" dropped and apostrophes removed; cast families keep `the-` | `granny-wick`, `the-hayburys`, `lamplighters-tower` |

Every save key a step adds matches `^[A-Za-z0-9:_.-]{1,48}$` (save `normalize` drops anything else).

<a id="adding-names"></a>

### Adding a name

1. Pass the [checks](#name-check).
2. Define it in the one bible file that owns its kind (see the [glossary index](#glossary) headings).
3. Add a row to the glossary index here, in the same PR.
4. If it changes a name CANON lists, stop: CANON names are final unless the owner overrides them (CANON §15). File an
   `agent:decision` issue instead.

<a id="locked-names"></a>

### LOCKED names

These shipped names may never change (CANON-NOW §9): Pip; Elder Shellby, Mayor Ribbit, Miso, Clover, Professor Hoot,
Digby; Grumble Shroom ("Grumpy Guardian of the Whispering Woods"), Captain Pinch ("Snippy Skipper of the Sunny Shores"),
Frostbun ("Chilly Champion of Frostcap Peaks"); Jelly Slime, Grumpy Shroomlet, Dozy Bat, Buzzy Bee, Snippy Crab,
Snowpuff; Sprout Village, Whispering Woods, Frostcap Peaks, Sunny Shores, Bloom Meadow and their card subtitles; the
Great Tree, Grumble's Crown, Summit Crystal Cairn, Pinch's Lighthouse, Meadow Windmill; Grumble Shroom's Hollow,
Captain Pinch's Cove, Frostbun's Summit; the Woods, Frost and Sea Starseeds; Miso's Shop; the pedestal; Starseed Isle;
the Shiny Sword; the save key `starseed-isle-save-v2` and every v6 field name.

---

<a id="glossary"></a>

## Master glossary index

Every proper name in the game, and the one file that **defines** it. Other files mention a name and link here or to
the definition; they never redefine it. Status: **L** = LOCKED shipped name; **C** = CANON name, not yet built.
Links whose anchor is cited by a step (INDEX Appendix B) are enforced from S-001; the others follow the
[anchor convention](#ids) and are enforced when the docs test is extended to this file (see
[decisions](#decisions)). If a link here fails, the defining file adds the anchor; this table is not changed to fit.

<a id="glossary-cosmos"></a>

### Cosmos, peoples, events and history

| Name | Kind | St. | Defined in |
|---|---|---|---|
| The Lantern Sky | the layer above, where the stars live | C | [lore.md#lantern-sky](./lore.md#lantern-sky) |
| The Wide Blue | the sea and its isles; "the world" | C | [lore.md#wide-blue](./lore.md#wide-blue) |
| The Rootdeep (layer) | the layer below: Wenna's roots | C | [lore.md#rootdeep](./lore.md#rootdeep) (the realm: [atlas-far.md#rootdeep](./atlas-far.md#rootdeep)) |
| Starkin | the star folk | C | [lore.md#starkin](./lore.md#starkin) |
| Lamplighters | moon-moth folk who kept the beacons | C | [lore.md#lamplighters](./lore.md#lamplighters) |
| Catchers of the Corners | the three guardians' office | C | [lore.md#catchers](./lore.md#catchers) (the characters: [cast.md#catchers](./cast.md#catchers)) |
| The Catchers' Rule | "Catch what flies. Keep it one night. Give it only to a kind hand." | C | [lore.md#catchers-rule](./lore.md#catchers-rule) |
| Wardens | keepers of a beacon or Stair Stone | C | [lore.md#wardens](./lore.md#wardens) |
| The Sneeze | Wenna's hundred-year letter to the sky | C | [lore.md#myth](./lore.md#myth) |
| The Second Sneeze | the finale's sneeze | C | [story.md#ch21](./story.md#ch21) (encounter: [creatures.md#finale](./creatures.md#finale)) |
| The Bottle Chain | twelve letters, one per century | C | [lore.md#bottles](./lore.md#bottles) |
| Seed-bearer | the child who carries the seeds home | C | [lore.md#seed-bearer](./lore.md#seed-bearer) |
| The Starstair | the floating stone stair to Driftholm | C | [lore.md#starstair](./lore.md#starstair) (place: [atlas-home.md#starstair](./atlas-home.md#starstair)) |
| Stair Stones | the Starstair's three keystones | C | [lore.md#stair-stones](./lore.md#stair-stones) (beats: [story.md#stone-beats](./story.md#stone-beats)) |
| The Ladder of Lights | the old ladder and Mote's new one | C | [lore.md#ladder-of-lights](./lore.md#ladder-of-lights) (dungeon: [dungeons.md#d11](./dungeons.md#d11)) |
| Beacons | one lamp per isle | C | [systems.md#beacons](./systems.md#beacons) |
| The Firstlight | the Tower's oldest flame | C | [lore.md#firstlight](./lore.md#firstlight) |
| Given light | light handed freely; holds a ladder one night | C | [lore.md#given-light](./lore.md#given-light) |
| The Storm | the storm 100 years ago | C | [lore.md#timeline](./lore.md#timeline) |
| The Last Big Storm | the sea storm two summers ago | L | [lore.md#timeline](./lore.md#timeline) |
| The Spiral | the sign for "the way home" | C | [lore.md#spiral](./lore.md#spiral) |
| Memory knots | twelve knots on the Taproot | C | [lore.md#memories](./lore.md#memories) |
| Crown lanterns | eight lanterns in the crown; the progress bar | C | [systems.md#beacons](./systems.md#beacons) (model: [atlas-home.md#great-tree](./atlas-home.md#great-tree)) |
| The Hundred-Year Night | the true-ending night and its realm | C | [story.md#ch22](./story.md#ch22) (realm: [atlas-home.md#hundred-year-night](./atlas-home.md#hundred-year-night)) |
| Twists T1-T7 | the seven reveals | C | [lore.md#twists](./lore.md#twists) |
| The Acornets | the squirrel clan of Pinewhistle | C | [cast.md#elder-nutmeg](./cast.md#elder-nutmeg) |

<a id="glossary-cast"></a>

### Characters

| Name | Kind | St. | Defined in |
|---|---|---|---|
| Pip | the hero | L | [cast.md#pip](./cast.md#pip); origin [lore.md#pip](./lore.md#pip) |
| Wenna (the Great Tree) | the Tree's true name; a Starkin | L (the Great Tree) / C (Wenna) | [cast.md#wenna](./cast.md#wenna) |
| Mote ("the Lamp Thief") | Wenna's brother; the antagonist | C | [cast.md#mote](./cast.md#mote) |
| Elder Shellby | old turtle; the myth's teller | L | [cast.md#elder-shellby](./cast.md#elder-shellby) |
| Mayor Ribbit | frog mayor | L | [cast.md#mayor-ribbit](./cast.md#mayor-ribbit) |
| Miso | cat shopkeeper | L | [cast.md#miso](./cast.md#miso) |
| Clover | bunny explorer | L | [cast.md#clover](./cast.md#clover) |
| Professor Hoot | owl scholar | L | [cast.md#professor-hoot](./cast.md#professor-hoot) |
| Digby | near-blind mole | L | [cast.md#digby](./cast.md#digby) |
| Grandpa Dormy | dormouse storyteller | C | [cast.md#grandpa-dormy](./cast.md#grandpa-dormy) |
| Nell Pelliwick | pelican sailor | C | [cast.md#nell](./cast.md#nell) |
| Hazel Thimble | hedgehog baker | C | [cast.md#hazel-thimble](./cast.md#hazel-thimble) |
| Granny Mochi | Miso and Kinako's grandmother | C | [cast.md#granny-mochi](./cast.md#granny-mochi) |
| Primrose Thistledown; Bramble, Sorrel, Clem, Dot | Clover's mum and the four kits | C | [cast.md#primrose-thistledown](./cast.md#primrose-thistledown) |
| Puddle | the well frog | L (the frog) / C (name) | [cast.md#puddle](./cast.md#puddle) |
| The Quackenbushes | five ducks | L (the ducks) / C (name) | [cast.md#the-quackenbushes](./cast.md#the-quackenbushes) |
| Kinako | Miso's twin; the bazaar | C | [cast.md#kinako](./cast.md#kinako) |
| Rook | crow rival | C | [cast.md#rook](./cast.md#rook) |
| Grumble Shroom | Catcher of the Woods | L | [cast.md#catchers](./cast.md#catchers); fight [creatures.md#boss-grumble](./creatures.md#boss-grumble) |
| Captain Pinch | Catcher of the Shores | L | [cast.md#catchers](./cast.md#catchers); fight [creatures.md#boss-pinch](./creatures.md#boss-pinch) |
| Frostbun | Catcher of the Peaks | L | [cast.md#catchers](./cast.md#catchers); fight [creatures.md#boss-frostbun](./creatures.md#boss-frostbun) |
| The shroomlet nephews | Grumble's little ones | C | [cast.md#catchers](./cast.md#catchers) |
| Great-Aunt Flurry | Frostbun's aunt | C | [cast.md#great-aunt-flurry](./cast.md#great-aunt-flurry); fight [creatures.md#boss-flurry](./creatures.md#boss-flurry) |
| Sir Rollo | pill-bug of Under the Roots | C | [cast.md#sir-rollo](./cast.md#sir-rollo); fight [creatures.md#boss-rollo](./creatures.md#boss-rollo) |
| Granny Wick | the last Lamplighter | C | [cast.md#granny-wick](./cast.md#granny-wick) |
| Flick | Wickling apprentice | C | [cast.md#flick](./cast.md#flick) |
| The Wicklings | moth folk of Wickhaven | C | [cast.md#the-wicklings](./cast.md#the-wicklings) |
| The Wickwork Moth | Tower automaton (Warden) | C | [creatures.md#boss-wickwork-moth](./creatures.md#boss-wickwork-moth) |
| Elder Nutmeg | Acornet clan head | C | [cast.md#elder-nutmeg](./cast.md#elder-nutmeg) |
| Professor Pinfeather | woodpecker scholar | C | [cast.md#professor-pinfeather](./cast.md#professor-pinfeather) |
| Mossmantle | sloth Warden of the Whistling Pine | C | [cast.md#mossmantle](./cast.md#mossmantle); fight [creatures.md#boss-mossmantle](./creatures.md#boss-mossmantle) |
| Skipper Rafferty | otter captain of the Raft | C | [cast.md#skipper-rafferty](./cast.md#skipper-rafferty) |
| Old Gloop | octopus Warden of the Great Arch | C | [cast.md#old-gloop](./cast.md#old-gloop); fight [creatures.md#boss-gloop](./creatures.md#boss-gloop) |
| Lady Honksworth | goose Warden of Tumble Hill | C | [cast.md#lady-honksworth](./cast.md#lady-honksworth); fight [creatures.md#boss-honksworth](./creatures.md#boss-honksworth) |
| Goody Gander | the miller | C | [cast.md#goody-gander](./cast.md#goody-gander) |
| The Hayburys | mouse farmers | C | [cast.md#the-hayburys](./cast.md#the-hayburys) |
| Pennywhistle | the scarecrow | C | [cast.md#pennywhistle](./cast.md#pennywhistle) |
| Gran Burrows | Digby's grandmother | C | [cast.md#gran-burrows](./cast.md#gran-burrows) |
| Lumbra the Long | earthworm Warden | C | [cast.md#lumbra-the-long](./cast.md#lumbra-the-long); fight [creatures.md#boss-lumbra](./creatures.md#boss-lumbra) |
| Postmistress Pell | puffin of Puffin Post | C | [cast.md#postmistress-pell](./cast.md#postmistress-pell) |
| Mr Whelk | hermit-crab collector | C | [cast.md#mr-whelk](./cast.md#mr-whelk) |
| Pelagia | sea turtle Warden of the Sunken Bell | C | [cast.md#pelagia](./cast.md#pelagia); duel [creatures.md#boss-pelagia](./creatures.md#boss-pelagia) |
| Bosun Snore | walrus of the Merry Mabel | C | [cast.md#bosun-snore](./cast.md#bosun-snore); fight [creatures.md#boss-bosun-snore](./creatures.md#boss-bosun-snore) |
| Master Scoria | bear smith | C | [cast.md#master-scoria](./cast.md#master-scoria) |
| Pitch | newt apprentice | C | [cast.md#pitch](./cast.md#pitch) |
| Soakley | capybara of the bathhouse | C | [cast.md#soakley](./cast.md#soakley) |
| Lady Fumarole | fire-newt Warden of the Kettle | C | [cast.md#lady-fumarole](./cast.md#lady-fumarole); fight [creatures.md#boss-fumarole](./creatures.md#boss-fumarole) |
| Sable | jerboa archaeologist | C | [cast.md#sable](./cast.md#sable) |
| Tutor Scarabelle | hourglass beetle Warden | C | [cast.md#tutor-scarabelle](./cast.md#tutor-scarabelle); exam [creatures.md#boss-scarabelle](./creatures.md#boss-scarabelle) |
| The Nimbles | cloud creatures of Driftholm | C | [cast.md#the-nimbles](./cast.md#the-nimbles) |
| Old Mother Brightwell | the eldest Starkin | C | [cast.md#old-mother-brightwell](./cast.md#old-mother-brightwell) |
| The Twinklings (and the shy fourth) | three small Starkin helpers | C | [cast.md#the-twinklings](./cast.md#the-twinklings) |
| The young cast | young Shellby, young Granny Wick, young Pelagia, the young Catchers (memories) | C | [cast.md#young-cast](./cast.md#young-cast) |

<a id="glossary-lands"></a>

### Lands, regions and realms

| Name | Kind | St. | Defined in |
|---|---|---|---|
| Starseed Isle (`home`) | home overworld | L | [atlas-home.md](./atlas-home.md) |
| Sprout Village, Whispering Woods, Frostcap Peaks, Sunny Shores, Bloom Meadow | home regions | L | [atlas-home.md](./atlas-home.md); shipped in `js/data.js` `REGIONS` |
| Duskwick (`duskwick`); Wickhaven, Ember Sands, Coral Steps, Tower Head | land; regions | C | [atlas-isles.md#duskwick](./atlas-isles.md#duskwick) |
| Pinewhistle (`pinewhistle`); Acornet Hollow, Misthollow Ravines, Sawmill Run, Whistle Rise | land; regions | C | [atlas-isles.md#pinewhistle](./atlas-isles.md#pinewhistle) |
| Archwater (`archwater`); the Raft, Basalt Stairs, Tidepool Shelf, Kelp Shallows | land; regions | C | [atlas-isles.md#archwater](./atlas-isles.md#archwater) |
| Threemills (`threemills`); Haybury, Tumble Hill, Orchard Rows, Millpond Marsh | land; regions | C | [atlas-isles.md#threemills](./atlas-isles.md#threemills) |
| The Rootdeep (`rootdeep`); Burrowbottom, Glowcap Forest, the Underlake, Geode Galleries | cavern; regions | C | [atlas-far.md#rootdeep](./atlas-far.md#rootdeep) |
| The Glassway (`glassway`); Puffin Post, the Sandbars, Wreck Reach, Bell Shallows | sea; regions | C | [atlas-far.md#glassway](./atlas-far.md#glassway) |
| Kettle Isle (`kettle`); Forgefall, Bathhouse Terraces, Ash Beach, the Spout | land; regions | C | [atlas-far.md#kettle](./atlas-far.md#kettle) |
| Saltglass Flats (`saltglass`); Sablecamp, the Glass Dunes, the Salt Pans, Academy Hill | land; regions | C | [atlas-far.md#saltglass](./atlas-far.md#saltglass) |
| Driftholm (`driftholm`); Mote's Meadow, the Falls, Nimble Downs, Arch Rise | sky isle; regions | C | [atlas-far.md#driftholm](./atlas-far.md#driftholm) |
| The Starmeadow (`starmeadow`); the Lower Lanterns, Constellation Bridges, Brightwell's Rest, the Ladder Foot | sky; regions | C | [atlas-far.md#starmeadow](./atlas-far.md#starmeadow) |
| The Crown (`crown`); the North, East, South and West Boughs | Wenna's canopy | C | [atlas-far.md#crown](./atlas-far.md#crown) |
| The Remembered Isle (`remembered`) | home 100 years ago | C | [atlas-home.md#remembered-isle](./atlas-home.md#remembered-isle) |
| Moonmere (`moonmere`); the Mirror Garden; the Moon Tree; the moonpath | Mote's mirror-home | C | [atlas-home.md#moonmere](./atlas-home.md#moonmere) |
| The Hundred-Year Night (`night`) | true-ending variant | C | [atlas-home.md#hundred-year-night](./atlas-home.md#hundred-year-night) |
| Hoot's Margins (`margins`) | inside Hoot's notebook | C | [atlas-isles.md#hoots-margins](./atlas-isles.md#hoots-margins) |
| Guardian Dreams (`dream_*`) | ten pastel boss arenas | C | [creatures.md#dreams](./creatures.md#dreams) |
| Hollows (`hollow_*`) | 24 one-room puzzle caves | C | [dungeons.md#hollows](./dungeons.md#hollows) |
| The Lamplighter's Chart (travel geography, buoys) | the world map | C | [atlas-far.md#travel-geography](./atlas-far.md#travel-geography); system [systems.md#travel](./systems.md#travel) |

<a id="glossary-sites"></a>

### Named sites

| Name | Land | St. | Defined in |
|---|---|---|---|
| The Great Tree (19.8 m), the pedestal and its three star sockets | home | L | [atlas-home.md#great-tree](./atlas-home.md#great-tree) |
| Grumble's Crown, Summit Crystal Cairn, Pinch's Lighthouse, Meadow Windmill | home landmarks | L | [atlas-home.md](./atlas-home.md) |
| Grumble Shroom's Hollow, Captain Pinch's Cove, Frostbun's Summit | home arenas | L | [atlas-home.md](./atlas-home.md) |
| Miso's Shop; the signpost; the well; the hidden glade; the fairy rings; islet 1 and islet 2; the Peaks bridge | home sites | L | [atlas-home.md](./atlas-home.md) |
| Pip's Nook and the Keepsake Hollow | home interior | C | [atlas-home.md#pips-nook](./atlas-home.md#pips-nook) |
| Nell's Jetty | home | C | [atlas-home.md#placeJetty](./atlas-home.md#placeJetty) |
| Puddle's Grotto | home, under the well | C | [atlas-home.md#puddles-grotto](./atlas-home.md#puddles-grotto) |
| The Storm Cave; the Bell Hollow; the sky nook | home finds | C | [atlas-home.md#tide-finds](./atlas-home.md#tide-finds); [#bell-targets](./atlas-home.md#bell-targets); [#sky-nook](./atlas-home.md#sky-nook) |
| Hoot's Board | plaza vista board | C | [atlas-home.md#vistas](./atlas-home.md#vistas) |
| Shellby's bench | the Night's entrance | C | [atlas-home.md#hundred-year-night](./atlas-home.md#hundred-year-night) |
| The golden grove (*For Spring*) | Bloom Meadow | C | [side-content.md#ss-01](./side-content.md#ss-01) |
| Lamplighter benches; root-gates | every land | C | [systems.md#travel](./systems.md#travel); kit [atlas-isles.md#shared](./atlas-isles.md#shared) |
| The Lamplighters' Tower; Granny Wick's Library | Duskwick | C | [atlas-isles.md#duskwick](./atlas-isles.md#duskwick) |
| The Whistling Pine | Pinewhistle | C | [atlas-isles.md#pinewhistle](./atlas-isles.md#pinewhistle) |
| The Great Arch and its Moon Pool | Archwater | C | [atlas-isles.md#archwater](./atlas-isles.md#archwater) |
| Tansy Mill, Thrift Mill, Middle Mill | Threemills | C | [atlas-isles.md#threemills](./atlas-isles.md#threemills) |
| The Taproot; the Rootdeep Heart (landmark side) | Rootdeep | C | [atlas-far.md#rootdeep](./atlas-far.md#rootdeep) |
| Gull Rock; the Snoozing Whale; the Merry Mabel (wreck); Kinako's Floating Bazaar | Glassway | C | [atlas-far.md#glassway](./atlas-far.md#glassway) |
| The Kettle | Kettle Isle | C | [atlas-far.md#kettle](./atlas-far.md#kettle) |
| The Lamplighter Academy | Saltglass | C | [atlas-far.md#saltglass](./atlas-far.md#saltglass) |
| The Spiral Arch; Mote's Tally Wall; Mote's shelter | Driftholm | C | [atlas-far.md#driftholm](./atlas-far.md#driftholm) |

<a id="glossary-dungeons"></a>

### Dungeons and encounters

| Name | Id | St. | Defined in |
|---|---|---|---|
| Under the Roots | d1 | C | [dungeons.md#d1](./dungeons.md#d1) |
| Whistlehollow | d2 | C | [dungeons.md#d2](./dungeons.md#d2) |
| The Undertow Grotto | d3 | C | [dungeons.md#d3](./dungeons.md#d3) |
| The Granary Vaults | d4 | C | [dungeons.md#d4](./dungeons.md#d4) |
| The Lamplighters' Tower (dungeon) | d5 | C | [dungeons.md#d5](./dungeons.md#d5) |
| The Rootdeep Heart | d6 | C | [dungeons.md#d6](./dungeons.md#d6) |
| The Sunken Bell | d7 | C | [dungeons.md#d7](./dungeons.md#d7) |
| The Kettle's Belly | d8 | C | [dungeons.md#d8](./dungeons.md#d8) |
| The Buried Academy | d9 | C | [dungeons.md#d9](./dungeons.md#d9) |
| The Spiral Stair | d10 | C | [dungeons.md#d10](./dungeons.md#d10) |
| The Ladder of Lights | d11 | C | [dungeons.md#d11](./dungeons.md#d11) |
| The Snowglobe | o1 | C | [dungeons.md#o1](./dungeons.md#o1) |
| Grumble's Undercap | o2 | C | [dungeons.md#o2](./dungeons.md#o2) |
| The Merry Mabel | o3 | C | [dungeons.md#o3](./dungeons.md#o3) |
| The Hundred Lamps | o4 | C | [dungeons.md#o4](./dungeons.md#o4) |
| The Three Corners Jamboree | Hundred Lamps floor 10 | C | [creatures.md#boss-jamboree](./creatures.md#boss-jamboree) |
| The Second Sneeze (Stray Lights, The Sneeze, Given Light) | finale | C | [creatures.md#finale](./creatures.md#finale) |

<a id="glossary-items"></a>

### Items, tools, gate objects and collectibles

| Name | Kind | St. | Defined in |
|---|---|---|---|
| Woods, Frost and Sea Starseeds | story tokens | L | [systems.md#items-tools](./systems.md#items-tools); shipped `js/data.js` |
| Potion; Heart Container; gems | shipped items and currency (save field `coins`) | L | [systems.md#items-tools](./systems.md#items-tools); [#economy](./systems.md#economy) |
| Shiny Sword; Starsteel Sword | sword levels 2 and 3 | L / C | [systems.md#items-tools](./systems.md#items-tools); [side-content.md#ss-38](./side-content.md#ss-38) |
| Rainbow shells; parade lanterns | shipped errand items | L | shipped `js/data.js` `ERRANDS` |
| Glowing acorn, Humming crystal stone, Message in a bottle, Tiny seed pouch | the four shipped keepsakes | L | shipped `js/data.js` `SECRETS`; lore [lore.md#myth](./lore.md#myth) |
| The *Dandelion* | Nell's boat | C | [systems.md#boat](./systems.md#boat) |
| Lamplighter's Chart | the world map item | C | [systems.md#travel](./systems.md#travel) |
| Glowbud Lantern, Leaf Glider, Tide Bell, Thistle Hook, Sunglass, Digging Paws, Starsong (*Dawn*, *Dusk*, *Calling*), Ember Sling, Ivy Gloves, Cloudstep | tools 1-10 | C | [systems.md#items-tools](./systems.md#items-tools); [#abilities](./systems.md#abilities) |
| thornvine; thornglass; glowbud doors; updraft columns; tide stones; hookblooms; light receivers; soft earth; star doors; bell targets; ivy lattices; cloud motes; spiral doors; fairy-ring doors | gate objects | C | [systems.md#gates](./systems.md#gates) |
| Sleeping Acorns; saplings | 100 collectibles and what they grow | C | [systems.md#collectibles](./systems.md#collectibles); home placements [atlas-home.md#acorns](./atlas-home.md#acorns) |
| Keepsakes | 44 two-line lore objects | L (kind) | [systems.md#collectibles](./systems.md#collectibles); texts in the atlas files |
| Lamp Logs | 30 logbook pages | C | [lore.md#lamp-logs](./lore.md#lamp-logs) |
| Bottles (the Bottle Chain) | 12 letters | C | [lore.md#bottles](./lore.md#bottles) |
| Mote's unsent letters | 12 letters in Moonmere | C | [lore.md#mote-letters](./lore.md#mote-letters) |
| Dormy's night stories | 7 stories | C | [lore.md#dormy-stories](./lore.md#dormy-stories) |
| Heart petals | 24; four make a heart | C | [systems.md#hearts](./systems.md#hearts) |
| Vistas | 30 sketch spots | C | [systems.md#collectibles](./systems.md#collectibles) |
| Fish Log | 24 species | C | [side-content.md#act-fishing](./side-content.md#act-fishing) |
| Plushies | 16 stitched guardians | L (kind) | [side-content.md#plushies](./side-content.md#plushies) |
| Nook furnishings | 24 | C | [side-content.md#nook](./side-content.md#nook) |
| Village Works | Ribbit's projects | C | [side-content.md#village-works](./side-content.md#village-works); props [atlas-home.md#village-works](./atlas-home.md#village-works) |
| Acorn Ear | Digby's ear-trumpet, an acorn-only finder from `act2done` | C | [systems.md#items-tools](./systems.md#items-tools) (S-161c) |
| Chime Bell | late finder | C | [systems.md#items-tools](./systems.md#items-tools) (earned in [side-content.md#ss-10](./side-content.md#ss-10)) |
| Bright Wick, Swift Fluff, Sling quick-draw | Kinako's upgrades | C | [systems.md#items-tools](./systems.md#items-tools) |
| Hood trims | cosmetic tints of the hood | C | [systems.md#items-tools](./systems.md#items-tools); art [art-audio.md#hood-trims](./art-audio.md#hood-trims) |
| Miso's Hundred-Year Hanky; Shellby's hanky | joke item; true-ending gift | C | [systems.md#items-tools](./systems.md#items-tools); [story.md#ch22](./story.md#ch22) |
| Star splinter; the ship's bell; dream plushie variants | rewards | C | [side-content.md#ss-39](./side-content.md#ss-39); [#ss-36](./side-content.md#ss-36); [creatures.md#dreams](./creatures.md#dreams) |

<a id="glossary-systems"></a>

### Systems and UI names

| Name | Kind | St. | Defined in |
|---|---|---|---|
| Hoot's Field Notes (Quests, Items, Bestiary, Lore, Map, Completion) | the journal | C | [systems.md#journal](./systems.md#journal) |
| Ask the Tree | opt-in hints | C | [systems.md#hints](./systems.md#hints) |
| The Completion page | the tracker, v2 | C | [systems.md#completion](./systems.md#completion) |
| The Bestiary | 38 enemies + 15 bosses | C | [creatures.md#bestiary](./creatures.md#bestiary) |
| Realms, portals, variants | engine | C | [systems.md#realms](./systems.md#realms); [#portals](./systems.md#portals) |
| Chart sailing, free sailing, benches, root-gates | travel | C | [systems.md#travel](./systems.md#travel); [#boat](./systems.md#boat) |

<a id="glossary-enemies"></a>

### Enemies (38) and bosses (15)

All link to `creatures.md`. Shipped six (L): [Jelly Slime](./creatures.md#enemy-jelly-slime),
[Grumpy Shroomlet](./creatures.md#enemy-grumpy-shroomlet), [Dozy Bat](./creatures.md#enemy-dozy-bat),
[Buzzy Bee](./creatures.md#enemy-buzzy-bee), [Snippy Crab](./creatures.md#enemy-snippy-crab),
[Snowpuff](./creatures.md#enemy-snowpuff).

New 32 (C): [Dimling](./creatures.md#enemy-dimling) · [Sizzle Beetle](./creatures.md#enemy-sizzle-beetle) ·
[Coco Clonk](./creatures.md#enemy-coco-clonk) · [Mossling](./creatures.md#enemy-mossling) ·
[Pinecone Puff](./creatures.md#enemy-pinecone-puff) · [Bark Beetle](./creatures.md#enemy-bark-beetle) ·
[Needle Wasp](./creatures.md#enemy-needle-wasp) · [Tidepool Jelly](./creatures.md#enemy-tidepool-jelly) ·
[Squirt Urchin](./creatures.md#enemy-squirt-urchin) · [Sand Snapper](./creatures.md#enemy-sand-snapper) ·
[Field Vole](./creatures.md#enemy-field-vole) · [Scarecrowlet](./creatures.md#enemy-scarecrowlet) ·
[Woolly Ram](./creatures.md#enemy-woolly-ram) · [Glow Grub](./creatures.md#enemy-glow-grub) ·
[Drip Bat](./creatures.md#enemy-drip-bat) · [Pebble Mimic](./creatures.md#enemy-pebble-mimic) ·
[Bubble Puffer](./creatures.md#enemy-bubble-puffer) · [Gullgrab](./creatures.md#enemy-gullgrab) ·
[Soot Snuffle](./creatures.md#enemy-soot-snuffle) · [Steam Puff](./creatures.md#enemy-steam-puff) ·
[Ash Moth](./creatures.md#enemy-ash-moth) · [Sandsnoot](./creatures.md#enemy-sandsnoot) ·
[Prickle Pear](./creatures.md#enemy-prickle-pear) · [Sun Beetle](./creatures.md#enemy-sun-beetle) ·
[Dust Puff](./creatures.md#enemy-dust-puff) · [Nimbus Puff](./creatures.md#enemy-nimbus-puff) ·
[Gust Kite](./creatures.md#enemy-gust-kite) · [Stardust Sprite](./creatures.md#enemy-stardust-sprite) ·
[Comet Pup](./creatures.md#enemy-comet-pup) · [Moonbeam Turret](./creatures.md#enemy-moonbeam-turret) ·
[Wisp Lantern](./creatures.md#enemy-wisp-lantern) · [Hushling](./creatures.md#enemy-hushling).

Bosses (15 bestiary entries): [Grumble Shroom](./creatures.md#boss-grumble) ·
[Captain Pinch](./creatures.md#boss-pinch) · [Frostbun](./creatures.md#boss-frostbun) ·
[Sir Rollo](./creatures.md#boss-rollo) · [Mossmantle](./creatures.md#boss-mossmantle) ·
[Old Gloop](./creatures.md#boss-gloop) · [Lady Honksworth](./creatures.md#boss-honksworth) ·
[the Wickwork Moth](./creatures.md#boss-wickwork-moth) · [Lumbra the Long](./creatures.md#boss-lumbra) ·
[Pelagia](./creatures.md#boss-pelagia) · [Lady Fumarole](./creatures.md#boss-fumarole) ·
[Tutor Scarabelle](./creatures.md#boss-scarabelle) · [Mote (the chase)](./creatures.md#boss-mote-chase) ·
[Great-Aunt Flurry](./creatures.md#boss-flurry) · [Bosun Snore](./creatures.md#boss-bosun-snore).
Archetype words (charger, lobber, hopper, splitter, shield, diver, turret, burrower, swarm, swooper, mimic, kiter,
ghost) are code terms defined in [creatures.md#archetypes](./creatures.md#archetypes) and never appear in
player-facing text.

<a id="glossary-story"></a>

### Acts, chapters and beats

| Name | Id | Defined in |
|---|---|---|
| Act I · The Sneeze (The Morning After, the three Starseeds, The Bloom, Wenna Wakes) | I.1-I.6 | [story.md#act-I](./story.md#act-I); [#I.1](./story.md#I.1), [#I.2](./story.md#I.2), [#I.5](./story.md#I.5), [#I.6](./story.md#I.6) |
| The Interlude · Under the Roots | ch7 | [story.md#ch7](./story.md#ch7) |
| Act II · The Dimming (Duskwick; the three isles; the midpoint; the Lamplighters' Tower) | ch8-ch12, beacon-1-3, II.M | [story.md#ch8](./story.md#ch8), [#ch9-11](./story.md#ch9-11), [#II.M](./story.md#II.M), [#ch12](./story.md#ch12) |
| Act III · The Remembering (Into the Rootdeep, Past the Reef, the three Stair Stones, the Starstair) | ch13-ch18 | [story.md#ch13](./story.md#ch13), [#ch14](./story.md#ch14), [#ch15-17](./story.md#ch15-17), [#ch18](./story.md#ch18) |
| Act IV · The Lantern Sky (the Starmeadow, the Ladder of Lights, the Second Sneeze) | ch19-ch21 | [story.md#ch19](./story.md#ch19), [#ch20](./story.md#ch20), [#ch21](./story.md#ch21) |
| Chapter 22 · The Hundred-Year Night (true ending) | ch22 | [story.md#ch22](./story.md#ch22) |
| The save-built lantern chain | ch21 | [story.md#lantern-chain](./story.md#lantern-chain) |

<a id="glossary-side"></a>

### Side stories (53) and activities (12)

All in `side-content.md`, anchored `ss-01` to `ss-53` and `act-*`.

| Land | Side stories |
|---|---|
| Home | [ss-01 *For Spring*](./side-content.md#ss-01) · [ss-02 *The Long Nap*](./side-content.md#ss-02) · [ss-03 *Nothing Is Refundable*](./side-content.md#ss-03) · [ss-04 *The Mayor Goes to Sea*](./side-content.md#ss-04) · [ss-05 *A Bun for Every Isle*](./side-content.md#ss-05) · [ss-06 *The Duck Regatta*](./side-content.md#ss-06) · [ss-07 *Puddle's Grotto*](./side-content.md#ss-07) · [ss-08 *Little Thistledown*](./side-content.md#ss-08) · [ss-09 *Old Friends*](./side-content.md#ss-09) · [ss-10 *The Parcel With No Name*](./side-content.md#ss-10) · [ss-11 *Grumble's Nephews*](./side-content.md#ss-11) · [ss-12 *Frostbun's Great-Aunt*](./side-content.md#ss-12) · [ss-13 *Shellby's Slow Walk*](./side-content.md#ss-13) · [ss-14 *The Fourth Bough*](./side-content.md#ss-14) |
| Duskwick | [ss-15 *Moth to a Flame*](./side-content.md#ss-15) · [ss-16 *Granny Wick's Library*](./side-content.md#ss-16) · [ss-17 *The Clockwork Apprentice*](./side-content.md#ss-17) · [ss-18 *Kinako's Limited Edition*](./side-content.md#ss-18) |
| Pinewhistle | [ss-19 *The Acorn Hoard*](./side-content.md#ss-19) · [ss-20 *Peer Review*](./side-content.md#ss-20) · [ss-21 *Lost in the Mist*](./side-content.md#ss-21) · [ss-22 *The Sawmill Song*](./side-content.md#ss-22) |
| Archwater | [ss-23 *Clover's Map*](./side-content.md#ss-23) · [ss-24 *The Raft Choir*](./side-content.md#ss-24) · [ss-25 *Eight Socks*](./side-content.md#ss-25) · [ss-26 *The Moon Pool*](./side-content.md#ss-26) |
| Threemills | [ss-27 *Your Honkship*](./side-content.md#ss-27) · [ss-28 *Scarecrow Hats*](./side-content.md#ss-28) · [ss-29 *The Scarecrow Who Wanted Crows*](./side-content.md#ss-29) · [ss-30 *Pie Rations*](./side-content.md#ss-30) |
| Rootdeep | [ss-31 *Burrowbottom Lamplight*](./side-content.md#ss-31) · [ss-32 *Lumbra's Itch*](./side-content.md#ss-32) · [ss-33 *Gran's Pouch*](./side-content.md#ss-33) |
| Glassway | [ss-34 *Return to Sender*](./side-content.md#ss-34) · [ss-35 *The Collector*](./side-content.md#ss-35) · [ss-36 *The Merry Mabel*](./side-content.md#ss-36) · [ss-37 *The Whale Who Rolls Over*](./side-content.md#ss-37) |
| Kettle Isle | [ss-38 *Starsteel*](./side-content.md#ss-38) · [ss-39 *Pitch Wants a Star*](./side-content.md#ss-39) · [ss-40 *Soakley's Baths*](./side-content.md#ss-40) · [ss-41 *Miso's Supplier*](./side-content.md#ss-41) |
| Saltglass | [ss-42 *Sable's Dig*](./side-content.md#ss-42) · [ss-43 *Roll Call*](./side-content.md#ss-43) · [ss-44 *The Exam Retake*](./side-content.md#ss-44) |
| Sky and Moonmere | [ss-45 *Mote's Tally*](./side-content.md#ss-45) · [ss-46 *Nimble Herding*](./side-content.md#ss-46) · [ss-47 *Letters Never Sent*](./side-content.md#ss-47) · [ss-48 *The Little Star*](./side-content.md#ss-48) |
| Across lands | [ss-49 *Rook's Races*](./side-content.md#ss-49) |
| Post-game | [ss-50 *The Three Corners Jamboree*](./side-content.md#ss-50) · [ss-51 *Dream a Little*](./side-content.md#ss-51) · [ss-52 *Hoot's Last Paper*](./side-content.md#ss-52) · [ss-53 *The Planting*](./side-content.md#ss-53) |

Activities: [Clover's Dash](./side-content.md#act-dash) · [Vista Sketches](./side-content.md#act-vistas) ·
[Fishing](./side-content.md#act-fishing) · [Duck Regatta](./side-content.md#act-regatta) ·
[Spore Rally](./side-content.md#act-spore-rally) · [Sledding](./side-content.md#act-sledding) ·
[Gloop's Juggling](./side-content.md#act-juggling) · [Harvest Cut](./side-content.md#act-harvest-cut) (and the
Harvest Festival) · [Lagoon Lights](./side-content.md#act-lagoon-lights) · [Bell Duel](./side-content.md#act-bell-duel)
· [Sling Gallery](./side-content.md#act-sling-gallery) · [Steam Hop](./side-content.md#act-steam-hop).

---

<a id="invariants"></a>

## Engineering invariants

Every step issue restates these in `## Acceptance criteria` (INDEX §1.3 and §2). They protect three things the
owner cannot easily repair: shipped saves, the frozen home island, and a game that is releasable after every PR.

<a id="invariants-block"></a>

### The block to copy

Copy the block, delete the lines that cannot apply to the step (a docs step drops the budget lines), and keep the
rest word for word. Each line is a checkable acceptance criterion.

```markdown
### Invariants (docs/roadmap/bible/charter.md#invariants)
- [ ] Frozen home island: `tests/fixtures/world-prints.json` is byte-identical. Any new home content is a post-pass on
      its own `new RNG(7151 * k + c)` stream (constants listed in bible/atlas-home.md#passes) following the
      `placeShells` rules: nearest-walkable placement around a named anchor, nothing added to other lists,
      `W.walk / W.reach` restored, a world test on seeds 1-40.
- [ ] Frozen realms: a realm generated for the first time in this PR writes `tests/fixtures/realm-prints/<id>.json`;
      an already-unhidden realm's prints are unchanged (later content only through post-passes).
- [ ] Hidden until whole: an unfinished realm stays `hidden: true` (reachable only via `?realm=` and
      `G.debug.realm`); unbuilt isles show as fog banks on the chart; no act card ships before the content behind it.
- [ ] One save slot: any schema change bumps `SAVE_VERSION`, adds `MIGRATIONS[n]` and tests from every older version,
      keeps the `starseed-isle-save-v2-bak` copy, and moves or redefines no v6 field. New ids are `<realm>:<id>`.
      Data that fits `flags`, `items`, `quests`, `collect` or an existing per-id map does not bump the version.
- [ ] Budgets per view, both cameras (charter.md#budgets): main pass <= 200 draw calls, total <= 300 (hard cap 350);
      <= 1.3 M triangles; 60 fps target; 300 m far plane with fog outdoors, 120 m in dungeons; realm generation
      <= 1.2 s desktop; <= 24 instanced prop types and <= 12 new material programs per realm.
- [ ] Precache: core <= 30 MB; each realm bundle <= 2.5 MB without GLBs; `node tools/build-pages.mjs` passes.
- [ ] Assets: every new manifest key has a procedural or canvas fallback and a `realm` tag if it belongs to one realm;
      `?noassets=all` still renders. Painted art is original, in the style of bible/art-audio.md#style, processed with
      the repo tools, saved as webp. New 3D is code-built with an ART BRIEF in the PR. Pip's GLB is not replaced.
- [ ] Tone (charter.md#tone): towns spawn no enemies; enemies poof; Pip gets dizzy; Pip never hits Mote; every attack
      is drawn >= 0.55 s ahead; nothing earned is taken back; nothing is missable; lines <= 220 characters; `~` only in
      Miso's speech; Pip never speaks.
- [ ] Original IP only: no other game's names, characters, art, levels, music or story.
- [ ] Machine: `bun test` and this step's in-page suite pass locally, one heavy job at a time (one browser, one full
      suite); CI stays green; the PR is under ~500 changed lines excluding generated files, fixtures and lockfiles.
```

<a id="invariants-detail"></a>

### What each invariant means and how to prove it

| Invariant | Why it exists | Proof a reviewer accepts |
|---|---|---|
| Frozen home island | Shipped saves store chest, secret and shell ids by position; players know the island; every test fixture depends on seed 7151 | `bun test tests/world.test.js` passes with `world-prints.json` untouched (`git diff --stat tests/fixtures/world-prints.json` is empty); the new pass has its own RNG constant, registered in `atlas-home.md#passes`, and a seeds 1-40 test |
| Post-pass rules | A pass that touches shared lists or leaves `W.walk` changed moves later placements on other seeds | the pass returns its own list only; a test asserts `W.walk` and `W.reach` checksums before and after the pass are equal |
| Frozen realms | Saves store `<realm>:<id>` keys; later steps rely on placements | `tests/fixtures/realm-prints/<id>.json` exists from the realm's first PR; a diff to it appears only in steps of the same build milestone, before the realm is unhidden |
| Hidden until whole | `main` must be releasable after every PR; a half-built realm must not be reachable by players | the realm def has `hidden: true`; the chart shows "Nell won't risk the fog yet."; the unhiding step is the one that ships the main quest and its chapter test |
| Act cards with content | A card that promises content that is not there breaks trust | the card's text lands in the same PR or the same umbrella as the chapter behind it (S-067, S-165, S-272, S-286 are the card steps) |
| One save slot | There is no second slot to fall back on; a bad migration loses a player's whole game | `bun test tests/save.test.js` covers vN-1 → vN and every older fixture; `test:smoke` Continues a v6 fixture; the bump is listed in `systems.md#save-plan` (v7-v11 only, unless a decision adds one) |
| Budgets | 60 fps on the development laptop's integrated GPU; phones are the floor | the `realm` in-page suite (from S-022) at the realm's 4 fixed views; the PR body lists the numbers |
| Precache | First install size and offline play | `node tools/build-pages.mjs` (its `checkPwa` fails on a stray file) and `bun run test:pwa` |
| Asset fallbacks | Generated art may be missing, late or not yet cached; owner GLBs come later | `?noassets=all` smoke variant renders; content lint lists every key a realm names and its fallback |
| Pip's GLB | The owner's call (CANON-NOW §0) | `git diff --stat assets/models/hero.glb` is empty; hood trims tint the material only |
| Tone | The game's identity | the [tone review checklist](#tone-check) in the PR body; content lint |
| Original IP | Legal and identity | the [name checks](#name-check) in the PR body for every new name; prompts in the PR follow the style preamble |
| Machine | 12 GB RAM; a software-rendered browser takes 4-5 GB | run `free -h` first; run suites one after another, never in parallel; stop every browser and server started |

<a id="invariants-dont"></a>

### Things no step may do, whatever its issue says

- Change `generateWorld(7151)`'s output, its RNG call order, or any `CFG` value that generation reads.
- Rename or remove a v6 save field, change the save key, or change what a saved id means.
- Replace `assets/models/hero.glb` or change Pip's look beyond a hood-material tint.
- Change a LOCKED line of text (`SECRETS`, `ERRANDS`, `PLUSHIES`, `SHOP`, `DOOR_LINES`, `SIGNS`, the intro pages) or a
  [LOCKED name](#locked-names). New lines may be added beside them.
- Put an enemy in a town, make a hard encounter mandatory, or make anything missable.
- Raise a budget in this file without an `agent:decision` issue answered by the owner.
- Ship a step that leaves `main` unplayable from New Game to the current furthest shipped chapter.

---

<a id="budgets"></a>

## Per-view budgets

These are the numbers a step measures and a perf checkpoint enforces. They come from ENGINE §6 and DESIGN §14 and
are measured at 1920 x 1080 on the development laptop (AMD Ryzen 7 5700U, integrated GPU) unless a row says otherwise.
"View" means one fixed camera position and direction, measured in **both** first person and third person.

<a id="budgets-runtime"></a>

### Runtime, per view

| Budget | Target | Hard limit | How it is measured |
|---|---|---|---|
| Frame rate | 60 fps at the worst eye-level view | - | heavy local perf sweep (not in CI) |
| Draw calls, main pass | <= 200 | - | `renderer.info.render.calls` for the main pass, in-page `realm` suite |
| Draw calls, total (main + viewmodel + shadow) | <= 300 | **350** | same, summed over passes |
| Triangles, main pass | <= 1.0 M | - | `renderer.info.render.triangles` |
| Triangles, total | <= 1.3 M | **1.3 M** | same, summed |
| Main-pass GPU time | <= 8.5 ms median, <= 11 ms 90th percentile | - | heavy local suite only; GPU time is not gated in CI (software WebGL is not deterministic in time) |
| HUD CPU per frame | <= 0.3 ms (95th percentile) | - | in-page `wp6`-style check, extended to the journal and chart |
| Viewmodel pass GPU | <= 0.3 ms at rest and swinging, with any tool held | - | in-page `wp2-heavy`-style check |
| First-sight shader hitches | none: every program compiled in the title or realm warm-up | - | in-page `wp7-hitch`-style check per realm |
| Far plane, overworld | 300 m with fog full before it; landmarks' fog capped at 0.45 | - | realm def + `realm` suite palette check |
| Far plane, dungeon and interior | 120 m; fog near 6 m, far 60 m in the realm's dark tint | - | dungeon recipe def |
| Draw calls, one dungeon room | < 120 total | - | F22's in-page test |
| Point lights | the shipped pool of 4 + Pip's light; never one light per torch | - | code review; material program count |
| Enemies alive | `CFG.maxEnemies` 8; region `max` <= 7; towns 0 | - | content lint |
| Attackers at once | <= 2 winding up or attacking | - | attack-token test (`TA.tokens`) |

<a id="budgets-realm"></a>

### Per realm

| Budget | Limit | How it is measured |
|---|---|---|
| Overworld grid | <= 640 m | realm def; unit test |
| Dungeon, Hollow and interior grid | 48-192 m | dungeon compiler |
| Generation time | <= 1.2 s desktop (`W.genMs`, reported in the PR) | `bun test` prints test and the PR body |
| Realm swap (overworld to overworld) | <= 1.5 s with software WebGL in the in-page test; leaving an interior to its resident parent < 100 ms | `realm` suite swap timing |
| Resident realms | at most 2 (the active one and its parent overworld) | `realm` suite leak check (`renderer.info.memory` back to baseline after leaving) |
| Instanced prop types | <= 24 | realm def lint |
| New material programs | <= 12 | warm-up count logged by the realm suite |
| Terrain splat layers | 7 (the shipped shader's slots; a realm swaps textures, not shaders) | realm def lint |
| Fixed views | exactly 4 per realm in `REALMS[id].views`, chosen to include the densest view, the landmark view, the town and the widest vista | realm def lint |
| Coverage | every 40 x 40 m cell of land holds a find, a view or a path to one; at least one point of interest per 1,250 m² of land | the land's coverage test in `bun test` |

<a id="budgets-assets"></a>

### Assets and precache

| Budget | Limit |
|---|---|
| Core precache (engine, home assets, UI, fonts) | <= 30 MB (about 26 MB today) |
| One realm bundle under `assets/realms/<id>/` | <= 2.5 MB without GLBs; <= 4 MB once owner GLBs land |
| Any texture | <= 1024² (key art is the only exception) |
| Terrain layer | `_hd` 1024² + `_lo` 512², webp, about 120 KB + 40 KB, made seamless with `tools/make_seamless.py` |
| Painted billboard card (sky, foliage, effect) | webp with alpha, <= 150 KB |
| NPC portrait | 512², webp, <= 60 KB |
| Loading card painting | 1600 x 900 webp, <= 200 KB |
| Map art | 1024², webp, <= 200 KB |
| Formats | webp q80-85 for anything painted; jpg only for opaque terrain where webp is not smaller; png only for pixel UI |

The asset list per realm, its prompts and its fallbacks live in `art-audio.md#bundles`; this table only sets limits.

<a id="budgets-save"></a>

### Save, tests and machine

| Budget | Limit |
|---|---|
| Save size at 100 % | <= 80 KB (localStorage allows 5 MB); checked at perf checkpoint 5 (S-196) and 8 (S-309) |
| Flag key length | <= 48 characters, `^[A-Za-z0-9:_.-]{1,48}$` |
| `bun test` wall time | <= 3 min locally |
| One in-page or chapter CI job | <= 15 min; shard it (`suite:k/n`) when it grows past that (existing jobs are capped at 25 min) |
| PR size | under ~500 changed lines excluding generated images, fixtures and lockfiles; dialogue tables count, so a text-heavy step splits (INDEX §1.6, §5) |
| Machine | 12 GB RAM: check `free -h` first; one heavy job at a time (one browser, one full suite, one build); measure browser memory by its cgroup's `memory.current`, never by summing RSS |

<a id="budgets-over"></a>

### When a view is over budget

Fix in this order, and record what was done in the PR body and `docs/roadmap/progress.md`:

1. **Cull**: tighten `userData.cull = { dist, fade }` for small props and deco (shipped classes: deco 35 m, glow 60 m,
   small 90 m).
2. **Instance or merge**: a prop placed more than 8 times becomes an instanced type; static dressing in a room merges
   into one mesh per material.
3. **LOD**: trees and heavy props swap to a proxy of at most 180 triangles beyond 38-48 m (`js/perf/lod.js`).
4. **Fewer types**: fold two similar prop types into one with a per-instance tint.
5. **Shadows**: limit full-model shadow casting to 20 m (`shadowFullR`) for the new types.
6. **Move the view's content**, never the budget. Lowering the far plane or thickening fog on an overworld below the
   300 m / 0.45-landmark rule is not a fix.

<a id="budgets-checkpoints"></a>

### Perf checkpoints

Each checkpoint measures every shipped realm's fixed views in both cameras, fixes what fails, and records the numbers
in `docs/roadmap/progress.md` and the DESIGN performance table.

| # | Step | What it measures |
|---|---|---|
| 1 | S-047 | combat (three boss fights) and the journal open on home; the four WP7 views |
| 2 | S-087 | the first overworld realm (Duskwick): genMs, swap time, views, bundle size |
| 3 | S-109 | the land template (Pinewhistle): pine-heavy views, bridges, dungeon rooms, phone-class estimate from genMs |
| 4 | S-151 | four isles: a 10x swap soak through every shipped realm, leaks, save size |
| 5 | S-196 | mid-game soak across every realm (20x) and a full save at the start of Act III; save < 80 KB |
| 6 | S-261 | ten realms and the precache: core <= 30 MB, every bundle <= 2.5 MB |
| 7 | S-287 | the finale's lights and lantern chain from a 100 % fixture (worst-case lantern count) |
| 8 | S-309 | final: every realm's 4 views in both cameras, the precache, save size at 100 % |

---

<a id="close-out"></a>

## Close-out checklist

Two kinds of step end a milestone: `chore: close Mxx` and `perf: checkpoint n` (when it closes one). Both follow this
list. Ordinary steps follow the [per-PR checklist](#pr-checklist).

<a id="pr-checklist"></a>

### Every PR

- [ ] The issue's six sections are met: Why, What, Acceptance criteria, Verification plan, Out of scope, Risk &
      rollback. Nothing listed under "Out of scope" is in the diff.
- [ ] The [invariants block](#invariants-block) lines that apply are ticked in the PR body.
- [ ] The [tone review checklist](#tone-check) is ticked for any player-facing text or behaviour.
- [ ] Every new proper name passed the [name checks](#name-check) and has a [glossary](#glossary) row.
- [ ] Every new line is in a `js/text/en/*.js` table (from F13), at most 220 characters, tokens valid; `bun test`
      content lint passes.
- [ ] Every new 3D thing has an ART BRIEF in the PR following `art-audio.md#brief-template`; every new image has its
      prompt, processing command, manifest key and fallback listed.
- [ ] The PR body lists the exact verification commands run and their results, the step id
      (`Roadmap: docs/roadmap/INDEX.md S-xxx`), and the numbers for any budget the step touches.
- [ ] Under ~500 changed lines excluding generated files; if not, ship part `a` and hand back the rest (INDEX
      §1.6).
- [ ] Every browser, dev server and watcher started for the step is stopped.

<a id="close-out-milestone"></a>

### Milestone close-out (`chore: close Mxx`)

Do these in order. The close-out PR is small (docs and records); it never carries feature code.

1. **Check the milestone is whole.** Every step S-aaa to S-bbb of the milestone is stacked or merged (the vision's
   Work list shows each as `📦 stacked` or merged). Split steps (`S-xxxa`, `S-xxxb`) count only when every part is in.
2. **Run the milestone's local suite, one `agentctl heavy` command per line**, after `free -h` shows at least 6 GB
   available. `agentctl heavy` kills any single command after 45 minutes (`heavyTimeoutMinutes`), and by M20 the
   whole matrix (about 17 in-page shards plus 20-30 chapters) takes hours, so the close-out never runs it in one
   command or one session:
   1. `agentctl heavy --job <job> -- bun test`
   2. `agentctl heavy --job <job> -- sh -c 'node tools/build-pages.mjs && bun run test:pwa'`
   3. `agentctl heavy --job <job> -- bun run test:smoke` (and the `?noassets=all` variant once it exists, as its own
      command)
   4. `agentctl heavy --job <job> -- bun run test:playthrough`
   5. `agentctl heavy --job <job> -- node tests/inpage.mjs <suite>` for **only** the in-page suites (or shards) the
      milestone's steps added or touched, one command each (the steps' Verification plans name them)
   6. `agentctl heavy --job <job> -- node tests/chapter.mjs <id>` for **only** the chapters the milestone added or
      touched, one command each, in story order (from S-030)
   Record pass counts and wall times per command. **The full matrix** (every in-page suite and shard in
   `.github/workflows/ci.yml`, `test:opening`, every shipped chapter) **is gated by CI**: wait on the close-out PR with
   `agentctl pr-wait` and paste its check results into the PR body. If pr-wait lists checks under `notStarted`, run
   those suites locally, again one `agentctl heavy` command per suite or chapter, possibly across more than one
   session, and say so in a 🤖 PR comment (RUNBOOK). A failure is fixed in this PR only if it is a docs or fixture
   error; otherwise file it as a bug step and do not close the milestone. **Wherever a step says "the full local
   suite" or lists "every in-page suite" / "every chapter", it means this item:** the milestone's own suites and
   chapters locally, one heavy command each, and the rest through CI.
3. **Update the design docs** for what landed: `docs/DESIGN.md` (player-facing rules, numbers, the section the
   milestone's close-out row names) and `docs/ARCHITECTURE.md` (contracts, modules, save versions, post-pass list with
   RNG constants, how to add one of the new things).
4. **Write the progress entry** in `docs/roadmap/progress.md` using the [template](#progress-template).
5. **Write the art brief batch** when the milestone schedules one (`docs/roadmap/briefs/batch-NN.md`; batches at
   S-014, S-063, S-079, S-094, S-109, S-116, S-137, S-159, S-173, S-197, S-221, S-242, S-261, S-279, S-306): one brief
   per code-built model of the milestone, each following `art-audio.md#brief-template` (silhouette, size in m, palette
   hexes, materials, poly budget, pose, image prompt, 3D prompt, manifest key, the fallback it replaces).
6. **Audit names and tone across the milestone's diff**: every new proper name has a glossary row and a definition in
   its bible file; `bun test` content lint is green; spot-read ten new lines aloud against the [voice rules](#voice).
7. **Check the hours.** From S-078b on, run `node tools/hours.mjs` and record the **modelled** hours per bucket (main
   path per act, side stories, activities, exploration, dungeons) and the cumulative total in the progress entry; the
   vision's "Where it is today" quotes this modelled figure, never the budget. Compare it with the milestone's "Play
   added" in INDEX (regenerated from the model by S-078b) and with CANON §11. A gap above 25 % is noted in the
   progress entry and the vision Log, and `bun test tests/hours.test.js` must stay green (each act's main path within
   ±20 % of CANON §11; the full planned table ≥ 90 h at 100 %). Before S-078b, estimate from a careful playthrough
   (the chapter tests' scripted time is a floor, not the estimate) and say it is an estimate.
8. **Check the release state**: every realm not yet whole is still `hidden: true`; no act card is ahead of its
   content; New Game → furthest shipped chapter → Continue works (chapter chain).
9. **Docs test**: `bun test tests/docs.test.js` passes (every bible anchor cited by INDEX resolves).
10. **PR body**: the milestone id and title, the steps closed, the suite results, the progress entry pasted, and any
    deviation (fallbacks used, steps split, owner decisions applied).

<a id="close-out-perf"></a>

### Perf checkpoint close-out (`perf: checkpoint n`)

Everything in the milestone close-out, plus:

1. Measure every shipped realm's 4 fixed views in **both** cameras: draw calls (main, total), triangles (main,
   total), and locally the main-pass GPU median and 90th percentile.
2. Measure genMs per realm and swap time per realm pair the checkpoint names.
3. Measure the precache: core MB and every bundle's MB (`node tools/build-pages.mjs` output).
4. Measure the save size of the checkpoint's fixture (and the 100 % fixture from checkpoint 5 on).
5. Fix every number over its [budget](#budgets) in [the order given](#budgets-over), in this PR if under ~500 lines,
   otherwise as the next step with the over-budget view named.
6. Update the DESIGN §14 performance table with the new worst view.

<a id="progress-template"></a>

### `progress.md` entry template

```markdown
## 2027-MM-DD · Mxx <milestone title> closed (S-aaa - S-bbb)

- Steps: S-aaa #<issue> (PR #<n>), ... ; splits: S-xxxa/S-xxxb; fallbacks used: none | <which>
- Hours: +x.x h this milestone; cumulative yy.y h; INDEX target zz.z h; CANON §11 bucket(s): <names>
- Realms: shipped <ids>; still hidden <ids>
- Budgets (worst view per realm, FP / TP): calls main a/b, total c/d; tris main e M/f M, total g M/h M; genMs <id> n ms;
  swap <from>-><to> n ms
- Precache: core n.n MB; bundles <id> n.n MB, ...
- Save: vN; fixture <name> n KB
- Tests: bun test n pass (n s); smoke, pwa, opening, playthrough pass; in-page <suites> pass; chapters <ids> pass
- Art: briefs/batch-NN.md (n briefs) | none scheduled; assets added n (n KB)
- Notes: owner decisions applied (#n), tone or name issues fixed, anything the next milestone must know
```

<a id="close-out-vision"></a>

### After the close-out PR stacks

The implement job appends its usual Log line to the vision issue (implement playbook step 9). For a close-out, the
Log line also names the milestone: `YYYY-MM-DD closed Mxx <title> via PR #<n> (S-aaa - S-bbb)`. The next plan turn
moves the milestone's Roadmap item to "Where it is today" once the umbrella merges.

---

<a id="decisions"></a>

## Decisions made here

CANON leaves these open; this file decides them. Each is a default the owner may override.

1. **Gentle-words lint.** The exact fail list in [gentle words](#gentle-words) is enforced by `tests/content.test.js`
   (S-025) with an allow-list for LOCKED shipped strings ("gentle defeat") and for "hurt" only in "nobody is hurt"
   phrasing. "Lamp Thief"/"thief" are allowed.
2. **The `ghost` archetype is a code word only**; Dimlings, Hushlings and Wisp Lanterns are written as shy lights or
   puffs of dusk, never ghosts or spirits (N2).
3. **Dark rooms**: ambient at least 40 % of the dungeon profile (0.22 against ENGINE's 0.55) without the Lantern; an
   in-page check asserts a mean frame luminance of at least 0.10 at each dark room's entrance with the Lantern off.
4. **Town leash**: an enemy that chases Pip to a town region's edge stops and wanders back; no projectile or boss move
   lands inside a town region (A1).
5. **Who may say "Wenna"**: Shellby, Granny Wick, Pelagia, Mote, Old Mother Brightwell, the Starkin (Twinklings
   included), the three Catchers, Lumbra the Long and Tutor Scarabelle. UI strings say "the Great Tree" for the whole
   game.
6. **Spoiler-safe names**: the [name-use table](#name-use) (Mote only from `moteNamed`; Shellby's authorship never
   stated before ch22; Pip's origin never told; Wenna's one line about Pip only in ch22).
7. **Text lengths**: talk branches 1-3 lines; scenes at most 8 lines before control or a camera cut and 30 in all;
   letters and logs at most 600 characters in paragraphs of at most 220; loading tips at most 100 characters; compass
   objective at most 32; region subtitle at most 30; prompt pill at most 32; act cards at most 4 lines. In the
   220-character line check each `{token}` counts as 8 characters.
8. **Punctuation**: `...` not `…`; single quotes inside lines; spaced em dash only in sign titles; no "?!"; dialogue
   numbers in words up to ten.
9. **`!!` is reserved to Kinako**, as `~` is to Miso; the [reserved markers](#reserved-markers) table is enforced by
   content lint per speaker.
10. **New control tokens**: `{tool}` (added with the tool action in F14) and `{journal}` (added with the journal in
    F16).
11. **Verb keys**: Dig and Hook show the `tool` key; Climb on ivy shows no key (walk in); the Sunglass, Ember Sling and
    Starsong show a reticle or tune name, not a pill; the verb list is capped at 30 (25 after CANON's 14).
12. **Menus**: the pause menu gains **Field Notes**; its tabs are Quests, Items, Bestiary, Lore, Map and
    **Completion** (CANON §10.5 puts the Completion page in the Field Notes), plus the Ask the Tree button.
13. **New status words**: kindled, relit, set, woken, lit, found, opened.
14. **Flag keys accept upper case.** CANON's story flags are camelCase (`wennaAwake`, `lanternGot`, `moteNamed`), so
    S-003's `normalize` must use `^[A-Za-z0-9:_.-]{1,48}$`, not the lower-case-only pattern in INDEX's S-003
    row. `systems.md#save-plan` should match.
15. **Id formats**: realm ids `[a-z_]+` at most 16 characters; text ids `<realm or system>.<owner>.<n>`; anchors
    kebab-case with a leading "The" dropped, except cast families that keep `the-` (as INDEX Appendix B already
    does).
16. **Glossary link enforcement**: S-002 (when the rest of the bible lands) extends `tests/docs.test.js` to every link
    in `charter.md`'s glossary; a missing anchor is fixed by adding it to the defining file, never by editing the
    glossary to fit.
17. **Retired names**: the [retired list](#retired) may not be reused for anything.
18. **Name rules**: at most four syllables per word; the honorific list in [house style](#name-style) is closed
    without a charter PR; boss titles keep the shipped alliterative "Adjective Role of the Place" shape.
19. **Followers**: a chapter partner stays within 40° of the view direction and 2-8 m ahead while Pip moves toward
    the goal.
20. **Worn rewards** show in third person, in Pip's shadow where the shape allows, and in at least one villager line.
21. **Mote is built `hittable: false`, `lockable: false`**, with an in-page test that swings at him.
22. **Damage test**: every enemy and boss move def asserts a wind-up of at least 0.55 s and damage of exactly one
    half-heart.
23. **Losing a race, chase or activity** uses "Again?", "So close!" or "One more go?"; never "failed".
24. **Close-out order**: the local suite runs in the order of [step 2](#close-out-milestone) after `free -h`
    shows at least 6 GB available, one `agentctl heavy` command per suite or chapter (45-minute cap each), limited to
    what the milestone added or touched; the full in-page and chapter matrix is gated by CI through `agentctl pr-wait`; an hours gap above 25 % against INDEX is recorded in `progress.md` and the
    vision Log.
25. **Budget changes** need an owner-answered `agent:decision` issue; a perf fix never lowers the far plane or
    thickens overworld fog.
26. **Prop instancing threshold**: a prop placed more than 8 times in a realm becomes an instanced type.
27. **Fixed views**: each realm's 4 views are the densest view, the landmark view, the town and the widest vista.
28. **Restoration flags are marked** `restore: true` in the flag dictionary (`systems.md#conditions`), and a unit test
    proves no scene effect clears one (A7).
29. **Scenes replay by default**: every scene def carries `replay: true` unless it is on the short list of interactive
    scenes kept in `systems.md#scenes`; content lint enforces it (A8).
30. **Memory-line lint**: content lint checks that every villager has one `act-<n>` memory line for each shipped act
    (A10).
