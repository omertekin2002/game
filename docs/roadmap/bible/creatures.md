# Creatures: enemies, bosses, Dreams and the finale

The design reference for everything Pip swings at, dodges, answers, chases or calms. Implementation steps cite the
anchors below (`creatures#enemy-mossling`, `creatures#boss-gloop`, ...). Written against `CANON.md` (§7, §9, §10.3,
§10.4, §13) and `CANON-NOW.md` §2.4-2.5 at `main` `b79d73d`. Order of authority: CANON-NOW LOCKED items >
CANON.md > this file > a step issue. Where this file had to decide something CANON leaves open, the decision is listed
in [Decisions made here](#decisions).

What this file does **not** own: where a land's regions are (atlas files: [atlas-home](./atlas-home.md),
[atlas-isles](./atlas-isles.md), [atlas-far](./atlas-far.md)); dungeon rooms and the boss room's tile map
([dungeons](./dungeons.md)); character looks outside combat, portraits' wider use and schedules ([cast](./cast.md));
story scenes around a fight ([story](./story.md)); side-story steps and activity tiers
([side-content](./side-content.md)); save versions, flags and the economy ledger ([systems](./systems.md)); the style
preamble and manifest naming ([art-audio](./art-audio.md#style)); tone rules ([charter](./charter.md#tone)).

Contents: 1 [Shared rules](#rules) · 2 [Archetypes](#archetypes) · 3 [Bestiary](#bestiary) ·
4 [Spawn tables](#spawn-tables) · 5 [The 32 species](#species) · 6 [Boss framework](#boss-framework) ·
7 [The Catchers](#catchers) · 8 [Story bosses](#story-bosses) · 9 [Optional bosses](#optional-bosses) ·
10 [The finale](#finale) · 11 [Guardian Dreams](#dreams) · 12 [The Three Corners Jamboree](#boss-jamboree) ·
13 [Balance and tests](#balance) · 14 [Asset index](#asset-index) · [Decisions made here](#decisions)

---

<a id="rules"></a>
## 1. Shared rules (every creature, every land)

<a id="units"></a>
### Units and the damage table

- **HP is in half-hearts.** A heart is 2 HP. Every hit Pip takes is **1 HP (half a heart)**, from every enemy and every
  boss, in every act (CANON §7). Later lands are harder through patterns, never through bigger hits.
- **Pip's damage per swing** (chain A forehand, B backhand, C overhead chop):

| Sword | `S.swordLevel` | A | B | C | Reach (m) | Notes |
|---|---|---|---|---|---|---|
| Wooden (LOCKED) | 1 | 1 | 1 | 2 | 1.6 | start |
| Shiny (LOCKED) | 2 | 2 | 2 | 3 | 2.0 | Miso, 150 gems; cuts thornvine |
| Starsteel | 3 | 3 | 3 | 4 | 2.2 | Scoria's side story ([ss-38](./side-content.md#ss-38)); cuts thornglass |

- **Enemy HP bands** (CANON §7): Interlude 2, Act II lands 3-5, Act III lands 4-7, Act IV 5-8. A swarm's band applies
  to the whole group, not to one member.
- **Tokens.** At most **2** enemies in a wind-up or attack at once (`TUNE.actors.tokens = 2`, KEEP). A swarm holds one
  token for the whole group. A boss fight counts as one threat source; a boss move list never has more than **two
  threats live at once** (a "threat" is one drawn telegraph that can still deal damage).
- **Caps.** `CFG.maxEnemies` 8 alive (KEEP); a region `max` is at most 7; towns are 0.

<a id="telegraphs"></a>
### Telegraphs (the one idiom)

Every attack that can hurt is **drawn on the ground or in the air at least 0.55 s before it can deal damage**, and
the drawing matches the damage volume exactly (KEEP). Colours are KEEP from `TUNE.actors`:

| Colour | Hex | Means |
|---|---|---|
| Coral | `#ff7a4a` (`danger`) | will hurt |
| Cream | `#fff3d8` (`dangerEdge`) | the bright top edge of a danger shape |
| Gold | `#ffd34a` (`chance`) | an opening: free hits, the HUD shows "Now!" |
| Glint | `#fff3a0` | a projectile that can be swatted back or popped |

Shapes, used by enemies and bosses alike (the boss framework names them in `move.telegraph`):

| Shape | Drawn as | Pip's answer |
|---|---|---|
| `ring` | an expanding ring with a 0.45 m light wall (`ringWall`) | hop (feet above 0.30 m) or roll through |
| `stripe` | a lane from the attacker to its end point, locks `stripeLock` 0.4 s before the attacker goes | step or roll out sideways |
| `disc` | a filled circle under the target with a light pillar and a falling whistle | run out before it lands |
| `circles` | 1-7 small discs (r 0.9-1.4 m) where things will fall | stand between them |
| `fan` | 5 or 7 thin coral lines from the mouth, 60° spread, shown for the wind-up | step between lines or swat the glint ones |
| `reticle` | a ground ring that shrinks onto a lob's landing point (KEEP snowpuff) | step off it |
| `zone` | a rectangle or disc with chevrons; damage or push | leave it, or (push) brace by walking against it |
| `beam` | a sweeping stripe that turns about its source; cover casts a cream shadow wedge | stand in the shadow wedge or hop a low beam |
| `mound` | a moving dirt hump plus a positional rumble (burrowers) | keep moving; the ring comes before the bite |

**First-person rules** (the eye is 0.88 m up with a ~100° view): an attacker outside the view **announces** first
(`announce` 0.7 s, its wind-up then 0.25 s longer, KEEP); every wind-up has a sound with a pitch rise; every ground
shape reaches at least 0.5 m into the lower edge of the view from 3 m away (so circles at Pip's feet are seen without
looking down); ghosts and burrowers have a sound before they have a shape.

<a id="poof"></a>
### Poof, dizzy, drops

- Enemies never die: at 0 HP they **poof** (a puff of the species' poof colour, a soft "fwup", 6-10 confetti motes)
  and leave a drop. Bestiary text says "poofed", never "killed" (the event stays `EV.KILL` in code).
- Pip at 0 HP is **dizzy** and wakes by the Great Tree (overworld) or at the dungeon entrance with puzzle state kept
  (CANON §8.1). In a boss fight the boss is at full HP again and naps; a Dream wakes Pip beside the napping boss.
- **Drops** (KEEP numbers for the six home species): gems 45 % (values per species, below), a heart 15 % only while
  Pip is hurt. New species use **gem tiers**: tier 1 = 1 or 3 gems, tier 2 = 3 or 5, tier 3 = 5. The economy rule
  (≈ 15 gems per hour from drops, [systems#economy](./systems.md#economy)) holds with Act II species on tier 1, Act III
  on tier 2, Act IV on tier 3.

<a id="safe-zones"></a>
### Safe zones

Never any enemy (CANON §7, §13 Always 1): Sprout Village, Wickhaven, Acornet Hollow, the Raft, Haybury, Burrowbottom,
Puffin Post, Forgefall, Sablecamp, Mote's Meadow, **Brightwell's Rest** (decided here), every interior, the
Remembered Isle, the Hundred-Year Night, the Crown outside the finale. Spawning code checks the region `max` (0) and
also refuses any spawn point within 12 m of a town region's edge.

---

<a id="archetypes"></a>
## 2. The archetype framework

ENGINE F17 (step S-040) moves the six shipped behaviours into `js/ai/<archetype>.js` modules registered in
`js/ai/index.js`, behaviour-identical (the `wp4` and `wp5` suites are the net). S-041 adds burrower, shield, splitter
and kiter; S-042 adds swarm, turret, mimic and ghost. A species is then data plus a model:

```js
// js/data.js (or js/realms/<id>/enemies.js for realm species; same shape)
ENEMY.sizzle_beetle = {
  name: 'Sizzle Beetle',          // HUD and bestiary name
  archetype: 'charger',           // key in js/ai/index.js
  hp: 4, r: 0.46, flying: false,  // r = hurt / contact radius (m)
  emerge: 'ground',               // ground | sky | bush | sand | water | fade | still (turrets, mimics)
  gems: 1,                        // gem tier (1, 2, 3); KEEP species keep their old values
  poof: 0xffb36b,                 // poof puff colour
  realm: 'duskwick',            // asset bundle tag; home species: 'home'
  params: { windup: 0.65, speed: 7.5, dur: 0.8, reach: 6.8, guard: false, turnMid: false },
  model: 'sizzle_beetle',         // manifest model key; code-built rig is the fallback (enemyDef case)
  card: 'card_sizzle_beetle',     // bestiary card (ui key)
  lore: '...', tip: '...',        // bestiary text (Hoot's note, Clover's crayon)
};
```

Every AI module exports `{ id, defaults, init(e), update(e, dt, ctx), telegraph(e) }`. `params` override `defaults`
key by key. A module may not read another species' id: everything species-specific is a param. Every module draws
its telegraph through `fx-ground.js` (KEEP) and asks `ctx.token()` before a wind-up.

<a id="archetype-table"></a>
### The fourteen archetypes

Numbers are the defaults; a species may change them inside the "allowed" range only. "Lead" = time from the first
drawn warning to the first moment damage is possible; it is ≥ 0.55 s in every row.

| Archetype | Ships in | Behaviour | Default params | Lead | Allowed range | Counterplay | Opening |
|---|---|---|---|---|---|---|---|
| `hopper` | S-040 (slime) | hops after Pip; crouch, then an attack hop | crouch 0.40, harmGate 0.15, hopSpeed 4.4, hopT 0.46, reach 2.7, rest 0.9 | 0.55 | crouch 0.40-0.70 | sidestep the hop | lands 0.4 s |
| `shooter` | S-040 (mushroom) | wanders, puffs a slow poppable shot | windup 0.55, range 11, shotSpeed 3.2, poppable true | 0.55 | windup 0.55-0.80 | pop the shot, close in | after a puff 0.8 s |
| `swooper` | S-040 (bat) | flutters high, rises, swoops | rise 0.60, swoopSpeed 8.5, swoopT 0.55, reach 5.3, alt 2.1 | 0.60 | rise 0.60-0.80 | step aside, swing as it climbs | climbs back 0.7 s |
| `diver` | S-040 (bee) | hovers, rears back, dives in a line | aim 0.70, diveSpeed 9, diveT 0.45, reach 4.6, alt 1.5 | 0.70 | aim 0.60-0.90 | step aside | sticks 0.5 s after a miss |
| `charger` | S-040 (crab) | raises claws, charges along a stripe | windup 0.65, speed 7, dur 0.85, reach 6.6, guard true (crab only) | 0.65 | windup 0.60-0.90 | step out of the stripe | wall or rock bonk 1.0 s |
| `lobber` | S-040 (snowpuff) | floats at range, lobs flat arcs | windup 0.60, range 12, snowK 8, flight 0.45-1.1, volley 1 | 0.60 + flight | volley 1-3 | step off the reticle | none (close in) |
| `burrower` | S-041 | travels as a dirt mound, surfaces under where Pip stood | moundSpeed 3.0, ring r 1.3, tell 0.75 (locks 0.25 before), popDmg 1, exposed 1.4, dive 0.4, reach 8 | 0.75 | tell 0.70-0.95 | keep moving | exposed 1.4 s (gold) |
| `shield` | S-041 | faces Pip behind a guard (±60°); short bash | turn 120°/s, bashWind 0.65, bash 1.8 m in 0.25 s, guardArc 60, stagger 1.0 | 0.65 | turn 90-150 | circle behind, or C chop breaks the guard | stagger 1.0 s |
| `splitter` | S-041 | on poof splits into children | childType (a hopper species), n 2, childHp 1, childEmerge 0.7 (harmless) | as its own attack | n 2-3 | poof it in the open | - |
| `kiter` | S-041 | keeps 6-10 m away, retreats slower than Pip runs, throws | band [6, 10], retreat 3.2, throwWind 0.60, shotSpeed 9 (straight) or lob, volley 1, cornerT 0.5, dizzy 1.6 | 0.60 | retreat 2.6-3.6 | herd it into a wall | cornered: dizzy 1.6 s |
| `swarm` | S-042 | 3-6 members orbit a centre that trails Pip at 5 m; one member at a time darts | members 4, orbitR 2.5, dartWind 0.60, dartSpeed 7, dartT 0.4, memberHp 1, oneToken true | 0.60 | members 3-6 | swing at the darter as it returns | darter rests 0.6 s |
| `turret` | S-042 | stationary; turns toward Pip; aims a drawn stripe, then fires | turn 90°/s, aim 0.80 (stripe drawn; locks 0.30 before), shot 10 m/s, burst 1, reload 1.2, range 14 | 0.80 | aim 0.70-1.00 | step out of the stripe, walk in during reload | reload 1.2 s (gold) |
| `mimic` | S-042 | sits disguised; springs when Pip comes close | notice 2.5, spring 0.8 (shudder + "?"), bite 2.2 m with wind 0.60, bites 3 then tired 1.5, gems 5 sure | 0.80 then 0.60 | - | step back from the shudder | tired 1.5 s |
| `ghost` | S-042 | drifts; hittable only inside light; bumps | drift 1.2, alpha 0.25 unlit / 1.0 lit, bumpWind 0.65, bump 3 m in 0.3 s, shyBack 1.0 m when first lit | 0.65 | bumpWind 0.60-0.80 | raise the Lantern, then swing | shy 0.4 s on first light |

Archetype details that every implementer needs:

- **burrower.** Underground it cannot be targeted or hit; lock-on skips it; its mound is drawn (a 0.8 m dirt hump
  moving at `moundSpeed`, leaving a 2 s trail) and a positional rumble plays from 14 m. The ring is placed where Pip's
  feet are at tell start and **does not follow him**. It never surfaces on a bridge deck, water or a dungeon pit; it
  never travels under a town edge. Sand and soft earth only (`W.ground.soft` or a sand splat ≥ 0.5).
- **shield.** A hit inside the guard arc clinks (`stopClink`, no damage, KEEP crab feel); the C chop breaks the guard
  from any side (stagger 1.0 s); a hit from behind always lands. The bash's stripe is 1.8 m long and as wide as the
  body plus Pip's radius plus 0.15 m.
- **splitter.** Children emerge from the poof point with 0.7 s of harmless emerge (C16 KEEP), spread 1.2 m apart,
  and take their own token turns. Children never split and do not count against the region `max` (they count against
  `maxEnemies`; if that is full, they are not spawned).
- **kiter.** It retreats along walkable ground, never off a ledge. "Cornered" = its retreat has been blocked by a
  wall, cliff, water or arena edge for `cornerT`; it sits dizzy (gold) for `dizzy`. Ember Sling hits from range
  always land.
- **swarm.** The group is one entity for tokens, caps and the bestiary (one "poofed" per group, at the last member);
  members are individually hittable. Only the member that glows is about to dart. With `tier ≥ 2` two members may
  dart in sequence 0.5 s apart, still under the one token (the second one's glow starts before the first dart ends,
  so both are drawn ≥ 0.55 s ahead).
- **turret.** Turrets are placed (anchors from the atlas or the dungeon map), not rolled, and never respawn inside
  the same visit. They are always hittable; the reload is the safe window.
- **mimic.** Mimics stand only in mimic slots the atlas or dungeon map names; **never** in place of a real chest, a
  counted collectible or a key. The Chime Bell ignores them; the Lantern makes their eyes glint (a hint). A poofed
  mimic leaves its disguise behind as a harmless prop.
- **ghost.** "Light" = inside the Glowbud Lantern's radius around Pip (6 m, 9 m with Bright Wick) while it is raised,
  inside 4 m of a lit wall-lantern or brazier, inside a moon-lantern's 5 m (Moonmere), or touched by the Sunglass
  beam (lit for 2 s). Unlit swings pass through with a soft whiff (no hit-stop). Unlit ghosts still telegraph and
  still bump. Ghosts never pass through walls.

<a id="tiers"></a>
### Pattern tiers (harder by pattern, never by damage)

`params.tier` (default 1) adds one pattern per tier; the species entry says which. The menu:

| Archetype | Tier 2 (Act III lands) | Tier 3 (Act IV) |
|---|---|---|
| hopper | a second hop follows 0.5 s after landing (its own 0.55 s crouch) | lands with a small ring (r 2.0, hop it) |
| swooper | the swoop curves once (the stripe bends, redrawn 0.55 s before the bend) | two passes |
| diver | re-aims once after a miss (new line, 0.6 s) | dives in pairs with a partner, 0.8 s apart |
| charger | turns once mid-charge (new stripe drawn 0.55 s before the turn) | leaves a 2 s ember stripe (zone) behind |
| lobber / kiter | volley 2 | volley 3 in a fan |
| burrower | surfaces twice in a row | its pop leaves a ring (r 2.2) |
| shield | bash, then a second bash | bash pushes a small ring |
| turret | burst 2 (0.35 s apart, same stripe) | the stripe sweeps 30° during aim |
| swarm | two darters in sequence | darters leave a sparkle trail zone 1 s |
| ghost | splits into two halves at half HP | blinks 3 m once per bump (fade 0.3, reappear with a new tell) |

---

<a id="bestiary"></a>
## 3. The Bestiary (Hoot's Field Notes, Bestiary tab)

ENGINE F26, step S-046. **53 entries: 38 enemies (the 6 home species + the 32 below) and 15 bosses** (Grumble
Shroom, Captain Pinch, Frostbun, Sir Rollo, Mossmantle, Old Gloop, Lady Honksworth, the Wickwork Moth, Lumbra the
Long, Pelagia, Lady Fumarole, Tutor Scarabelle, Mote, Great-Aunt Flurry, Bosun Snore). The Second Sneeze, the Dream
versions, the Jamboree and the Moonmere silver variants are not separate entries.

- Save: `S.bestiary = { <id>: { seen: n, poofed: n } }` for enemies and `{ <bossId>: { seen: 1, calmed: n } }` for
  bosses (the save shape lives in [systems#save-plan](./systems.md#save-plan)). `seen` counts first targeting
  acquire or a 6 m approach; `poofed` counts `EV.KILL` (a swarm counts once per group); `calmed` counts first wins and
  rematch wins. Silver Moonmere variants count toward their home species.
- **The row counts an entry when it is poofed (enemy) or calmed / met (boss)**. Mote and Pelagia and Tutor Scarabelle
  count on the encounter's end, since none of them is "poofed".
- Page layout: the painted card (384 × 384), the name, the land(s) as small chips, **Hoot's note** (the lore: kind,
  cheerful and often wrong), **Clover's crayon** (the real tip, in a hand-drawn font, added only after the first
  poof), and counts "Seen 12 · Poofed 9". Before first sight the entry is a silhouette with "???".
- Card art: `card_<id>` for enemies and `card_boss_<short>` for bosses, 384 × 384 webp, q 82, ≤ 45 KB, painted
  vignette on a cream paper ground (`#f6efdc`) with a soft torn edge; realm-tagged; the canvas fallback draws the
  species' main colour as a blob with two dot eyes on the same paper ground and the name in the journal font.
- Card image prompt pattern (the preamble is [art-audio#style](./art-audio.md#style), written `[STYLE]` below):
  `[STYLE] A bestiary card illustration on cream paper with a soft torn edge, a single <creature description>,
  three-quarter view, centred, gentle rim light, no text, no border lines, square.` Every species below gives its
  `<creature description>`.
- The nine shipped cards (S-046) use these notes:

| Id | Hoot's note | Clover's crayon |
|---|---|---|
| `slime` | "The Jelly Slime is a pudding that escaped. Note: do not eat." | "It crouches before it hops. Step aside!" |
| `mushroom` | "Grumpy Shroomlets are Grumble Shroom's nephews. Or cousins. Possibly both." | "Pop the spore with your sword." |
| `bat` | "Dozy Bats sleep by day and also by night. Remarkable." | "When it rises up, it's going to swoop." |
| `bee` | "Buzzy Bees hum in B flat. I have checked." | "It leans back before it dives. Sidestep." |
| `crab` | "Snippy Crabs are extremely polite under the claws." | "Claws block the front. Use the big chop!" |
| `snowpuff` | "Snowpuffs are clouds that were left out overnight." | "Watch the ring on the ground, then step off it." |
| `woods` (card `card_boss_grumble`) | "Grumble Shroom. Grumpy, crowned, warm-hearted. Hat may be too small (unconfirmed)." | "Hop the glowing ring!" |
| `shores` (card `card_boss_pinch`) | "Captain Pinch. A skipper without a ship. Has a lamp instead, which is cleverer." | "The stripe shows where he'll charge." |
| `peaks` (card `card_boss_frostbun`) | "Frostbun. Largest bun on record. Do not attempt to measure." | "Run out of the circle when the whistle starts." |

---

<a id="spawn-tables"></a>
## 4. Spawn tables by land

The atlas files list species ids per region; **these weights and caps are the definition**, and the atlas must copy
them exactly. `[id, weight]` pairs as in `REGIONS[].enemies` (KEEP shape). Placed species (turrets, mimics) are
listed with "placed" and their counts; the atlas or dungeon map holds the anchors.

| Land · region | Rolled `[id, weight]` | Placed | `max` |
|---|---|---|---|
| **home** (KEEP) | Woods `mushroom 4, bat 3, slime 3`; Peaks `snowpuff 1`; Shores `crab 1`; Meadow `bee 3, slime 4` | - | 7/6/6/6 |
| home, dark places (Puddle's Grotto, Storm Cave, fairy-ring Hollows, Undercap) | `dimling 1` | - | 3 |
| **Under the Roots** (d1) | per map `e` tiles | Dimlings | room ≤ 3 |
| **Duskwick** · Wickhaven | none (town) | - | 0 |
| Duskwick · Ember Sands | `sizzle_beetle 4, coco_clonk 2` | - | 6 |
| Duskwick · Coral Steps | `coco_clonk 3, sizzle_beetle 2` | - | 5 |
| Duskwick · Tower Head | `sizzle_beetle 2, coco_clonk 2` | - | 5 |
| Duskwick · sea caves (dark) | `dimling 1` | - | 3 |
| **Pinewhistle** · Acornet Hollow | none (town) | - | 0 |
| Pinewhistle · Misthollow Ravines | `mossling 3, needle_wasp 3, pinecone_puff 2` | - | 6 |
| Pinewhistle · Sawmill Run | `bark_beetle 3, mossling 3, pinecone_puff 2` | - | 6 |
| Pinewhistle · Whistle Rise | `needle_wasp 3, pinecone_puff 3, bark_beetle 2` | - | 6 |
| **Archwater** · The Raft | none (town) | - | 0 |
| Archwater · Basalt Stairs | `sand_snapper 2, tidepool_jelly 2` | squirt_urchin × 6 | 5 |
| Archwater · Tidepool Shelf | `tidepool_jelly 4` | squirt_urchin × 4 | 5 |
| Archwater · Kelp Shallows | `tidepool_jelly 3, sand_snapper 3` | - | 6 |
| **Threemills** · Haybury | none (town) | - | 0 |
| Threemills · Tumble Hill | `woolly_ram 3, field_vole 2` | scarecrowlet × 4 | 5 |
| Threemills · Orchard Rows | `field_vole 3` | scarecrowlet × 6 | 5 |
| Threemills · Millpond Marsh | `field_vole 3, woolly_ram 2` | - | 5 |
| **Rootdeep** · Burrowbottom | none (town) | - | 0 |
| Rootdeep · Glowcap Forest | `glow_grub 4, drip_bat 3` | - | 6 |
| Rootdeep · The Underlake | `drip_bat 3, glow_grub 2, dimling 2` | - | 6 |
| Rootdeep · Geode Galleries | `drip_bat 3, glow_grub 2` | pebble_mimic × 5 | 6 |
| **Glassway** · Puffin Post | none (town) | - | 0 |
| Glassway · The Sandbars (low tide only) | `gullgrab 3, crab 2` | - | 5 |
| Glassway · Wreck Reach | `bubble_puffer 3, gullgrab 2` | - | 5 |
| Glassway · Bell Shallows | `bubble_puffer 3, gullgrab 2` | - | 5 |
| Glassway · while sailing | `gullgrab 1` (snatches only; a bonk from the boat is a swing) | - | 2 |
| **Kettle Isle** · Forgefall | none (town) | - | 0 |
| Kettle · Bathhouse Terraces (outer terraces only) | `ash_moth 2` | steam_puff × 5 (by vents) | 4 |
| Kettle · Ash Beach | `soot_snuffle 4, ash_moth 2` | - | 6 |
| Kettle · The Spout | `soot_snuffle 3, ash_moth 3` | steam_puff × 4 | 6 |
| **Saltglass** · Sablecamp | none (town) | - | 0 |
| Saltglass · The Glass Dunes | `sandsnoot 3, dust_puff 3` | - | 6 |
| Saltglass · The Salt Pans | `sun_beetle 3, dust_puff 2` | prickle_pear × 4 | 6 |
| Saltglass · Academy Hill | `sun_beetle 2, sandsnoot 2` | prickle_pear × 6 | 6 |
| **Driftholm** · Mote's Meadow | none (town) | - | 0 |
| Driftholm · The Falls | `gust_kite 3, nimbus_puff 2` | - | 5 |
| Driftholm · Nimble Downs | `nimbus_puff 3` | - | 4 |
| Driftholm · Arch Rise | `gust_kite 3, nimbus_puff 3` | - | 6 |
| **Starmeadow** · The Lower Lanterns | `stardust_sprite 3, wisp_lantern 2` | - | 6 |
| Starmeadow · Constellation Bridges | `comet_pup 3, stardust_sprite 2` | moonbeam_turret × 6 | 6 |
| Starmeadow · Brightwell's Rest | none (safe, decided here) | - | 0 |
| Starmeadow · The Ladder Foot | `comet_pup 2, wisp_lantern 3` | moonbeam_turret × 4 | 6 |
| **Moonmere** · Sprout Village | none (town) | - | 0 |
| Moonmere · Woods / Peaks / Shores / Meadow | home tables with each id → `<id>_silver`, plus `hushling 3` | - | home caps |

Night rule (KEEP for bats): `bat` +6 at night in the Woods and 3 in the Meadow. New night rules: `drip_bat` +2 at
night is meaningless underground (Rootdeep has no day), so none; `ash_moth` +3 at night on Ash Beach; `wisp_lantern`
always. Dungeon spawns come only from `e` tiles in [dungeons](./dungeons.md#format), which name a species id per tile;
dungeons may use any species of their land plus `dimling`.

---

<a id="species"></a>
## 5. The 32 species

<a id="model-rules"></a>
### Model rules for every species (read once)

- **Code-built rig** (the shipping model): a case in `js/models.js enemyDef('<id>')` built from spheres, capsules,
  cones and boxes with `js/toon.js` materials, drawn through `instRig` (KEEP). At most 6 materials and **1,200
  triangles** per species; 60-90 lines including AI params and render hooks (ENGINE §6.3).
- **Owner GLB** (later, no code change): manifest `models.<id>` `{ src: 'assets/realms/<realm>/models/<id>.glb',
  height }`, normalised to 1 unit tall, origin bottom-centre, facing +Z, **≤ 4,000 tris**, one 512² painted texture.
  `makeModel('<id>')` already falls back to the rig.
- **Animation** is whole-body (no skeleton needed, works for a GLB too): idle bob, notice hop with "!" (KEEP), wind-up
  lean / rise / swell (`TUNE.actors.lean`, `rise`, `swell`), the attack itself, recover, hurt squash (0.12 s), poof.
  The wind-up also runs the rim flash (`rimFlash` toward `rimColor`, or the species' own vivid hue when coral turns it
  muddy, as KEEP for slime and bee).
- **3D prompt pattern** for the owner: `A cute chunky toy-like <creature>, soft rounded forms, hand-painted toon
  texture, colours <palette>, storybook style, game-ready low-poly under 4k triangles, neutral standing pose facing
  forward, no base, plain background.`
- **Card prompt** pattern: see [Bestiary](#bestiary). Each entry gives the `<creature description>` once and both
  prompts reuse it.
- Every species step adds: the `ENEMY` entry, the rig, the card (generated through a GPT Sol subagent with Codex's
  image tool, processed to 384² webp with `tools/export_sprites.py`, keyed `card_<id>` with `realm`), the spawn table
  row (section 4), and **one in-page test**: spawn with `G.debug.actors.spawn('<id>')`, assert the telegraph is drawn
  ≥ 0.55 s before the first damage frame, assert a poof at 0 HP and a bestiary count.

Each entry: id · archetype · HP · radius · movement · emerge · gem tier · poof colour · realm · step.

<a id="enemy-dimling"></a>
### Dimling

`dimling` · **ghost** · HP **2** · r 0.40 · floats 0.4-1.2 m up · emerge `fade` · gems 1 · poof `#ffd98a` · realm
`home` (shared by every dark place) · S-058.

- **Where:** Under the Roots (map tiles), home dark places, Duskwick sea caves, the Underlake, any "dark mouth" cave.
- **Behaviour:** drifts toward Pip at 1.2 m/s, wobbling; at 3 m it **swells and its face brightens for 0.65 s with a
  rising glass-chime**, then bumps 3 m in 0.3 s. Unlit it is 25 % opaque and swings whiff through it. The first time
  light touches it, it flinches back 1.0 m with a squeak (0.4 s) and stays hittable while lit.
- **Params:** `{ drift: 1.2, bumpWind: 0.65, bump: 3, bumpT: 0.3, shyBack: 1.0, tier: 1 }`.
- **Answer:** raise the Lantern (tool), then two wooden-sword swings.
- **Model:** a 0.6 m teardrop of soft lilac-grey (sphere + cone tail), a round paler face disc, two dot eyes, and an
  unlit wick tuft on top that **lights gold as it poofs** (it was only looking for a light).
- **ART BRIEF:** silhouette a soft upside-down teardrop with a wick tuft; height 0.6 m; palette body `#b9b3d6`, face
  `#ece8ff`, eyes `#2a2440`, wick `#8a86b0` (lit `#ffd98a`); materials toon, body 0.85 alpha with a fresnel rim;
  animation bob 0.15 m at 0.6 Hz, tail sway; poly 500 code / 2,000 GLB. Card description: *a shy lilac-grey wisp
  shaped like a soft teardrop, round pale face with two dot eyes, a little unlit candle wick on its head, peeking out
  of the dark with a lantern glow touching it.*
- **Bestiary:** Hoot: "Dimlings are made of the dark, and they are afraid of the dark. I have not worked out how."
  Clover: "Hold up the Lantern. Then you can bonk them."

<a id="enemy-sizzle-beetle"></a>
### Sizzle Beetle

`sizzle_beetle` · **charger** · HP **4** · r 0.46 · ground · emerge `sand` · gems 1 · poof `#ffb36b` · `duskwick` · S-089.

- **Where:** Duskwick Ember Sands (4), Coral Steps (2), Tower Head (2).
- **Behaviour:** scuttles; at ≤ 6.8 m it digs in its back feet, **its belly glows brighter and hisses for 0.65 s**,
  the stripe locks at 0.25 s before it goes; charges 7.5 m/s for 0.8 s. No claw guard. Hitting a rock, wall or palm
  flips it on its back, legs waving, for **1.2 s** (gold); a clean miss leaves it cooling 0.6 s.
- **Params:** `{ windup: 0.65, speed: 7.5, dur: 0.8, reach: 6.8, guard: false, bonkOpen: 1.2, tier: 1 }`.
- **Answer:** step out, ideally with a rock behind you.
- **Model:** a dome shell (half sphere) black-violet with a gold rim line, a small head with two cream highlight eyes,
  six stubby capsule legs, and a warm glowing belly disc.
- **ART BRIEF:** silhouette a round dome beetle low to the ground; 0.55 m tall, 0.9 m long; palette shell `#2b2238`,
  rim `#f2b45a`, belly glow `#ff8f4a`, legs `#4a3a50`, eye highlights `#fff3d8`; materials glossy toon shell,
  emissive belly; animation leg patter, wind-up glow pulse, flipped-on-back wiggle; poly 900 / 3,000. Card: *a round
  black-and-gold dome beetle with a softly glowing ember-orange belly, little stubby legs, standing on warm black sand
  with a curl of steam.*
- **Bestiary:** Hoot: "The Sizzle Beetle warms its tummy on hot sand to keep its eggs cosy. It has no eggs. It just
  likes it." Clover: "Make it charge into a rock. Then it's upside down!"

<a id="enemy-coco-clonk"></a>
### Coco Clonk

`coco_clonk` · **lobber** · HP **3** · r 0.40 · ground (hops between palm bases) · emerge `bush` (drops from a palm) ·
gems 1 · poof `#f3d7b0` · `duskwick` · S-089.

- **Where:** Coral Steps (3), Ember Sands (2), Tower Head (2).
- **Behaviour:** sits 8-12 m away under a palm, **lifts a coconut over its head and wobbles for 0.60 s**, then lobs a
  flat arc onto a shrinking reticle (KEEP snowpuff idiom, flight `clamp(d / 8, 0.45, 1.1)`). If Pip comes within 3 m
  it hops back 2 m (0.5 s) before its next throw. The coconut lands, cracks into two harmless halves.
- **Params:** `{ windup: 0.60, range: 12, volley: 1, hopBack: 2, tier: 1 }`.
- **Answer:** step off the reticle and close in; it has no guard.
- **Model:** a round tan monkey body, a cream face disc, round ears, a coconut-shell helmet with a teal palm-leaf tuft.
- **ART BRIEF:** silhouette a ball-shaped little monkey wearing half a coconut as a helmet; 0.7 m; palette fur
  `#b07a4a`, face `#f3d7b0`, helmet `#6b4a2e`, leaf `#3fa79a`, eyes `#2a2440`; materials toon, fuzzy rim; animation
  coconut raise, throw, hop-back; poly 900 / 3,000. Card: *a round little tan monkey with a cream face, wearing half a
  coconut shell as a helmet with a teal leaf on top, holding a coconut overhead under a palm.*
- **Bestiary:** Hoot: "Coco Clonks wear coconuts as hats because the sun is very bright. Very sensible." Clover:
  "Step off the circle. The coconut lands right in it."

<a id="enemy-mossling"></a>
### Mossling

`mossling` · **hopper** · HP **3** · r 0.42 · ground · emerge `ground` · gems 1 · poof `#a8d86a` · `pinewhistle` · S-100.

- **Where:** Misthollow Ravines (3), Sawmill Run (3).
- **Behaviour:** bounces after Pip; **squashes flat for 0.45 s with a creak of moss**, harmful only after 0.15 s in
  the air (lead 0.60 s); hop 4.6 m/s, reach 2.9 m; rests 0.9 s after landing.
- **Params:** `{ crouch: 0.45, harmGate: 0.15, hopSpeed: 4.6, hopT: 0.46, reach: 2.9, rest: 0.9, tier: 1 }`.
- **Model:** a mossy sphere, two leaf feet, a two-leaf sprout (not Pip's shape: three leaves, curled), dot eyes.
- **ART BRIEF:** silhouette a fuzzy green ball with a curly three-leaf sprout; 0.5 m; palette moss `#6f9a4a`, shade
  `#4f7d3a`, sprout `#a8d86a`, eyes `#2a2440`; materials toon with a fuzz noise; animation squash-and-stretch; poly
  600 / 2,000. Card: *a round fuzzy moss ball with leaf feet and a curly three-leaf sprout, mid-bounce on a pine-needle
  path.*
- **Bestiary:** Hoot: "A Mossling is a very small hill that learned to hop." Clover: "It squishes down before it
  jumps."

<a id="enemy-pinecone-puff"></a>
### Pinecone Puff

`pinecone_puff` · **splitter** · HP **4** · r 0.44 · ground · emerge `bush` · gems 1 · poof `#e8efe9` · `pinewhistle` ·
S-100. Children: **Pinelet** (`pinelet`, hopper, HP 1, r 0.25, crouch 0.55, hop 4.0 m/s, reach 2.2; not a bestiary
entry, counted under its parent).

- **Where:** Whistle Rise (3), Misthollow (2), Sawmill Run (2).
- **Behaviour:** its own attack is a **tip-and-roll**: it rocks back for 0.65 s (a stripe 4 m long drawn from it),
  then rolls the stripe at 6 m/s. At 0 HP it pops into **2 Pinelets** that spend 0.7 s emerging (harmless) then hop.
- **Params:** `{ attack: 'roll', rollWind: 0.65, rollLen: 4, rollSpeed: 6, childType: 'pinelet', n: 2, tier: 1 }`.
- **Answer:** poof it where you have room; a C chop poofs a Pinelet before it lands.
- **Model:** a fat pinecone (stacked cone rings) with a puff of white seed-fluff on top and dot eyes; Pinelets are
  0.3 m copies without fluff.
- **ART BRIEF:** silhouette a chubby pinecone with a fluffy top; 0.6 m; palette scales `#8a5a34`, tips `#c98b4b`, fluff
  `#e8efe9`, eyes `#2a2440`; materials toon, scales as stepped rings; animation rock-back, roll, pop; poly 1,000 /
  3,000. Card: *a chubby pinecone creature with a soft white puff of seed-fluff on its head, two tiny pinecone babies
  peeking from behind it.*
- **Bestiary:** Hoot: "Pinecone Puffs are pinecones that refuse to grow into pines. Relatable." Clover: "It pops into
  two little ones! Bonk them before they hop."

<a id="enemy-bark-beetle"></a>
### Bark Beetle

`bark_beetle` · **shield** · HP **5** · r 0.48 · ground · emerge `ground` · gems 1 · poof `#a7c49a` · `pinewhistle` · S-100.

- **Where:** Sawmill Run (3), Whistle Rise (2).
- **Behaviour:** turns to face Pip (120°/s) behind a curl of bark; **raises the bark and stamps twice over 0.65 s**,
  then bashes 1.8 m along a drawn stripe. Front hits clink; the C chop breaks the guard (stagger 1.0 s); hits from
  behind always land.
- **Params:** `{ turn: 120, bashWind: 0.65, bash: 1.8, guardArc: 60, stagger: 1.0, tier: 1 }`.
- **Model:** a round dark-green beetle carrying a curved bark shield (a bent box with lichen dots) on its front legs.
- **ART BRIEF:** silhouette a beetle hiding behind a big curl of bark; 0.7 m; palette bark `#7a5a3e`, lichen `#a7c49a`,
  body `#3c4a3a`, eye highlights `#f2e6c9`; materials toon, bark with painted grain; animation shield raise, stamp,
  stagger wobble; poly 1,000 / 3,500. Card: *a round dark-green beetle peeking over a big curved shield of pine bark
  dotted with lichen, in a misty pine forest.*
- **Bestiary:** Hoot: "The Bark Beetle carries its front door everywhere. A great traveller." Clover: "Go round the
  back, or use the big chop."

<a id="enemy-needle-wasp"></a>
### Needle Wasp

`needle_wasp` · **diver** · HP **3** · r 0.36 · flying (1.5 m) · emerge `bush` · gems 1 · poof `#e8c25a` · `pinewhistle` ·
S-100.

- **Where:** Misthollow (3), Whistle Rise (3).
- **Behaviour:** hovers, **rears back with a rising whine for 0.70 s**, then dives in a straight line at 9.5 m/s for
  0.45 s (reach 4.8). After a miss its needle sticks in the ground or a trunk for 0.5 s (gold).
- **Params:** `{ aim: 0.70, diveSpeed: 9.5, diveT: 0.45, reach: 4.8, stick: 0.5, tier: 1 }`.
- **Model:** a round striped body, two translucent wings, a long green pine-needle nose (it pokes, it never stings).
- **ART BRIEF:** silhouette a round bug with a long thin needle nose; 0.45 m body, 0.6 m wingspan; palette body
  `#e8c25a`, stripes `#2f4a3a`, wings `#e8efe9` at 0.5 alpha, needle `#6a8a5a`; materials toon, wing alpha cards;
  animation wing flutter 12 Hz, rear-back, dive, stuck wiggle; poly 700 / 2,500. Card: *a round yellow-and-pine-green
  striped wasp with a long pine-needle nose and see-through wings, hovering among pine branches, friendly face.*
- **Bestiary:** Hoot: "Needle Wasps knit. I have no proof, but look at them." Clover: "It leans back, then zooms.
  Step sideways!"

<a id="enemy-tidepool-jelly"></a>
### Tidepool Jelly

`tidepool_jelly` · **hopper** · HP **3** · r 0.42 · ground (and shallows) · emerge `water` · gems 1 · poof `#bfeee6` ·
`archwater` · S-121.

- **Where:** Tidepool Shelf (4), Kelp Shallows (3), Basalt Stairs (2).
- **Behaviour:** as the Mossling, with **a wobble and a bloop for 0.45 s**; landing in water throws a splash that is
  cosmetic only.
- **Params:** `{ crouch: 0.45, harmGate: 0.15, hopSpeed: 4.4, hopT: 0.46, reach: 2.8, rest: 1.0, tier: 1 }`.
- **Model:** a translucent teal dome with a darker core and a coral starfish stuck on top.
- **ART BRIEF:** silhouette a jelly dome with a starfish hat; 0.55 m; palette body `#7fd3d0` at 0.8 alpha, core
  `#4fb0b0`, starfish `#f29a7a`, eyes `#2a2440`; materials toon with transmission look faked by fresnel; animation
  wobble; poly 600 / 2,000. Card: *a translucent teal jelly blob with a small coral starfish on its head, sitting in a
  rock pool with sunlight dancing through it.*
- **Bestiary:** Hoot: "Tidepool Jellies are what the sea makes when it is bored." Clover: "Same as a slime. Squish,
  then hop!"

<a id="enemy-squirt-urchin"></a>
### Squirt Urchin

`squirt_urchin` · **turret** · HP **4** · r 0.40 · stationary · emerge `still` · gems 1 · poof `#f2e6ff` · `archwater` ·
S-121. Placed: Basalt Stairs × 6, Tidepool Shelf × 4.

- **Behaviour:** turns at 90°/s; **puffs up its spines and draws a coral stripe toward Pip for 0.80 s** (locks 0.30 s
  before), squirts one water bead at 10 m/s, range 14 m; reloads 1.2 s (gold, spines flat).
- **Params:** `{ turn: 90, aim: 0.80, lock: 0.30, shot: 10, burst: 1, reload: 1.2, range: 14, tier: 1 }`.
- **Model:** a purple sphere with cone spines with pale tips, two eyes, a little spout on top.
- **ART BRIEF:** silhouette a spiky ball with a spout; 0.5 m; palette spines `#6b4a8c`, body `#8f6ab0`, tips `#f2e6ff`,
  eyes `#2a2440`; materials toon; animation spine puff, squirt recoil, flat reload; poly 1,100 / 3,000. Card: *a
  round purple sea urchin with soft pale-tipped spines and a tiny spout, squirting a droplet from a basalt rock pool.*
- **Bestiary:** Hoot: "Squirt Urchins are the sea's way of saying 'no, thank you'." Clover: "After it squirts it
  has to refill. Run in then!"

<a id="enemy-sand-snapper"></a>
### Sand Snapper

`sand_snapper` · **burrower** · HP **5** · r 0.46 · ground / under sand · emerge `sand` · gems 1 · poof `#f29a9a` ·
`archwater` · S-121.

- **Where:** Kelp Shallows (3), Basalt Stairs (2, sand patches only).
- **Behaviour:** a mound runs toward Pip at 3.0 m/s with a rumble; within 8 m a **1.3 m ring appears where Pip's feet
  are and the sand bubbles for 0.75 s**; it snaps up through the ring; then sits open-mouthed and exposed for 1.4 s
  (gold) before diving (0.4 s).
- **Params:** `{ moundSpeed: 3.0, ringR: 1.3, tell: 0.75, lock: 0.25, exposed: 1.4, dive: 0.4, reach: 8, tier: 1 }`.
- **Model:** a flat ridged clam with two stalk eyes on top and a pink inside.
- **ART BRIEF:** silhouette a big ridged clam with stalk eyes; 0.5 m tall, 0.8 m wide; palette shell `#e2c9a0`, ridges
  `#c9a878`, inside `#f29a9a`, eyes `#2a2440`; materials toon; animation snap open, clack; poly 900 / 3,000. Card: *a
  sandy ridged clam with two curious stalk eyes popping up out of wet sand, shell open to show a soft pink inside.*
- **Bestiary:** Hoot: "The Sand Snapper is a clam who wanted to be a crab. It is working on it." Clover: "Keep
  walking when you hear the rumble, then bonk it when it pops up!"

<a id="enemy-field-vole"></a>
### Field Vole gang

`field_vole` · **swarm** (ground) · 4 members × HP **1** (group 4) · member r 0.22 · ground · emerge `bush` · gems 1
(per group) · poof `#ecd9b8` · `threemills` · S-142.

- **Where:** Orchard Rows (3), Millpond Marsh (3), Tumble Hill (2).
- **Behaviour:** four voles scurry in a 2.5 m circle around a point that trails Pip at 5 m. One member **stands up,
  squeaks and shines for 0.60 s**, then nibble-lunges at 6 m/s for 0.4 s; rests 0.6 s when it is back in the circle.
  One token for the whole gang.
- **Params:** `{ members: 4, orbitR: 2.5, dartWind: 0.60, dartSpeed: 6, dartT: 0.4, memberHp: 1, flying: false,
  tier: 1 }`.
- **Model:** four 0.25 m brown capsule-mice with cream bellies, pink round ears, and a wheat stalk in each mouth.
- **ART BRIEF:** silhouette tiny round voles; 0.25 m each; palette fur `#a8805a`, belly `#ecd9b8`, ears `#e8a0a0`,
  wheat `#e7c45a`, eyes `#2a2440`; materials toon; animation scurry, stand-up shine; poly 300 each (1,200 group) /
  1,000 each. Card: *a gang of four tiny round field voles with wheat stalks in their mouths, one standing up proudly
  and shining, in a golden wheat field.*
- **Bestiary:** Hoot: "The Field Vole gang has a leader. I do not know which one. Neither do they." Clover: "Only the
  shiny one is about to jump. Hit that one!"

<a id="enemy-scarecrowlet"></a>
### Scarecrowlet

`scarecrowlet` · **turret** · HP **4** · r 0.40 · stationary on a post · emerge `still` · gems 1 · poof `#e7c45a` ·
`threemills` · S-142. Placed: Orchard Rows × 6, Tumble Hill × 4.

- **Behaviour:** swivels on its post (90°/s); **points one stick arm at Pip and a coral stripe draws for 0.80 s**,
  throws one seed puff (10 m/s); reloads 1.2 s (gold, arms droop).
- **Params:** `{ turn: 90, aim: 0.80, lock: 0.30, shot: 10, burst: 1, reload: 1.2, range: 13, tier: 1 }`.
- **Model:** a small sack-headed scarecrow with a red felt hat, straw tufts, a green patch and button eyes, on a
  post. Pennywhistle ([cast](./cast.md#pennywhistle)) is a full-size scarecrow and a friend, never an enemy; the
  Scarecrowlet is half his height, rounder and clearly a different shape.
- **ART BRIEF:** silhouette a little round scarecrow on a stick; 1.1 m incl. post; palette sacking `#d8c08a`, hat
  `#c2563f`, straw `#e7c45a`, patch `#7fae4b`, eyes `#2a2440`; materials toon; animation swivel, point, droop; poly
  900 / 3,000. Card: *a small round scarecrow on a post with a sack face, button eyes, red felt hat and straw tufts,
  pointing a twig arm across an apple orchard.*
- **Bestiary:** Hoot: "Scarecrowlets are scarecrows still in school." Clover: "It points before it throws. Then it
  has to reload."

<a id="enemy-woolly-ram"></a>
### Woolly Ram

`woolly_ram` · **charger** · HP **5** · r 0.52 · ground · emerge `ground` · gems 1 · poof `#f4eee0` · `threemills` ·
S-142.

- **Where:** Tumble Hill (3), Millpond Marsh (2).
- **Behaviour:** paws the ground, **head down, wool puffing up for 0.70 s**, stripe locks 0.25 s before; charges 7.5 m/s
  for 0.9 s. A hedge, wall or fence stops it and its wool snags for **1.4 s** (gold).
- **Params:** `{ windup: 0.70, speed: 7.5, dur: 0.9, reach: 7.0, guard: false, bonkOpen: 1.4, tier: 1 }`.
- **Model:** a cloud of white wool spheres, a dark round face, curled horns (torus segments), four short legs.
- **ART BRIEF:** silhouette a round wool cloud with curly horns; 1.0 m; palette wool `#f4eee0`, face `#5a4a44`, horns
  `#c9a87a`, hooves `#3b3540`; materials toon, wool as clustered spheres; animation paw, charge, snagged wiggle; poly
  1,200 / 4,000. Card: *a very fluffy round ram, mostly wool, with curly horns and a determined little face, pawing
  at a grassy hillside under a windmill.*
- **Bestiary:** Hoot: "The Woolly Ram is mostly wool. Inside, there is a bit more wool." Clover: "Let it run into a
  hedge. It gets stuck!"

<a id="enemy-glow-grub"></a>
### Glow Grub

`glow_grub` · **hopper** · HP **4** · r 0.40 · ground · emerge `ground` · gems 2 · poof `#ffcf7a` · `rootdeep` · S-179.

- **Where:** Glowcap Forest (4), Underlake (2), Geode Galleries (2).
- **Behaviour:** tier 2: hop as the Mossling (crouch 0.50), then **a second hop 0.5 s after landing, with its own
  0.55 s crouch and brighter glow**. It lights 2 m around itself (it counts as light for Dimlings).
- **Params:** `{ crouch: 0.50, harmGate: 0.15, hopSpeed: 4.6, hopT: 0.46, reach: 2.9, rest: 1.0, tier: 2,
  secondCrouch: 0.55, light: 2 }`.
- **Model:** a plump segmented grub (four spheres) glowing from inside, cream with honey bands.
- **ART BRIEF:** silhouette a soft caterpillar-grub; 0.45 m; palette body `#f0e6b0`, glow `#ffcf7a`, bands `#c9a86a`,
  eyes `#2a2440`; materials emissive toon; animation inch-squash, double hop; poly 600 / 2,000. Card: *a plump soft
  grub glowing warm honey-gold from inside, sitting on a glowing root in a dark cavern.*
- **Bestiary:** Hoot: "Glow Grubs are tiny lamps that got bored of standing still." Clover: "It hops twice. Wait for
  the second one!"

<a id="enemy-drip-bat"></a>
### Drip Bat

`drip_bat` · **swooper** · HP **4** · r 0.38 · flying (2.1 m) · emerge `sky` (drops from the ceiling) · gems 2 · poof
`#a9e6ff` · `rootdeep` · S-179.

- **Where:** Glowcap Forest (3), Underlake (3), Geode Galleries (3).
- **Behaviour:** tier 2: rises with **a drip-drip sound for 0.60 s**, then swoops 8.5 m/s for 0.55 s; the stripe
  **bends once**, and the bent part is redrawn 0.55 s before the bend. Climbs back 0.7 s (gold-ish window: hittable
  by an upward look).
- **Params:** `{ rise: 0.60, swoopSpeed: 8.5, swoopT: 0.55, reach: 5.3, alt: 2.1, tier: 2, bend: 35 }`.
- **Model:** a round blue-grey fluff ball, two teal-edged wings, a single water drop hanging from its nose.
- **ART BRIEF:** silhouette a fluffy round bat with a drop on its nose; 0.4 m body, 0.9 m span; palette fur `#4a5a7a`,
  wing edge `#7be0c8`, drop `#a9e6ff`, eyes `#2a2440`; materials toon, emissive wing edge; animation flap 8 Hz; poly
  700 / 2,500. Card: *a round blue-grey cave bat with glowing teal wing edges and a single water drop on its nose,
  hanging upside down from a glowing root.*
- **Bestiary:** Hoot: "The Drip Bat sleeps upside down so the drips run off its nose. Clever." Clover: "Watch the line
  on the floor. It bends!"

<a id="enemy-pebble-mimic"></a>
### Pebble Mimic

`pebble_mimic` · **mimic** · HP **6** · r 0.44 · ground · emerge `still` · gems 5 (sure) · poof `#b89cf0` · `rootdeep` ·
S-179. Placed: Geode Galleries × 5; dungeon maps may name more.

- **Disguise:** a sparkly geode cluster on a pebble pile, the same size as the real gem clusters of the Galleries
  (which are scenery). Tell before it springs: the crystals **tremble and chime for 0.8 s and a "?" pops**, once Pip
  is within 2.5 m. The Lantern makes two eyes glint in the pile from 6 m.
- **Fight:** bites 2.2 m with a 0.60 s gape (stripe); after three bites it pants, tired, 1.5 s (gold). Never stands
  in a real chest's slot.
- **Params:** `{ notice: 2.5, spring: 0.8, biteWind: 0.60, bite: 2.2, bites: 3, tired: 1.5, gems: 5, tier: 2 }`.
- **Model:** a pebble mound (squashed spheres) with three crystal prisms on top; when awake, the mound lifts on four
  stumpy legs and shows a mouth line.
- **ART BRIEF:** silhouette a pebble pile with crystals that stands up; 0.6 m; palette stone `#8a7a8a`, crystals
  `#b89cf0` and `#7be0c8`, eyes `#2a2440`; materials toon stone, crystals emissive 0.3; animation tremble, stand,
  gape, pant; poly 1,000 / 3,000. Card: *a pile of round pebbles crowned with lilac and teal crystals that has just
  stood up on stumpy legs, looking surprised, in a sparkling geode cave.*
- **Bestiary:** Hoot: "Pebble Mimics pretend to be treasure because they would like to be admired. Admire them,
  then." Clover: "If the sparkles wiggle, step back!"

<a id="enemy-bubble-puffer"></a>
### Bubble Puffer

`bubble_puffer` · **kiter** · HP **5** · r 0.45 · floats 1.2 m over water or sand · emerge `water` · gems 2 · poof
`#bfeee6` · `glassway` · S-204.

- **Where:** Wreck Reach (3), Bell Shallows (3), Sandbars (via waves, 0).
- **Behaviour:** keeps 6-10 m away, retreats at 3.0 m/s; **puffs its cheeks for 0.60 s** and blows **two** bubbles
  (tier 2, 0.4 s apart) in straight lines at 8 m/s; a bubble is a glint shot and pops on a sword hit. Blocked by a
  rock, wreck or the shore for 0.5 s: it **puffs up round and dizzy for 1.6 s** (gold).
- **Params:** `{ band: [6, 10], retreat: 3.0, throwWind: 0.60, shotSpeed: 8, volley: 2, cornerT: 0.5, dizzy: 1.6,
  tier: 2 }`.
- **Model:** a cream oval fish with teal spots, little fins, rosy cheeks; puffed state is a sphere with soft spines.
- **ART BRIEF:** silhouette a floating round pufferfish; 0.6 m (0.9 m puffed); palette body `#f5e6c4`, spots
  `#2f7d8c`, fins `#bfeee6`, cheeks `#ff9f8f`, eyes `#2a2440`; materials toon; animation fin flutter, cheek puff,
  dizzy spin; poly 800 / 2,500. Card: *a cream pufferfish with teal spots floating in the air above glass-clear
  shallows, cheeks puffed to blow a big round bubble.*
- **Bestiary:** Hoot: "The Bubble Puffer is a fish that wanted to see the sky. It is taking it slowly." Clover:
  "Chase it into a rock. It gets dizzy!"

<a id="enemy-gullgrab"></a>
### Gullgrab

`gullgrab` · **diver** · HP **4** · r 0.40 · flying (2.5 m) · emerge `sky` · gems 2 · poof `#f7f7f2` · `glassway` · S-204.

- **Where:** Sandbars (3), Wreck Reach (2), Bell Shallows (2); 1 while sailing.
- **Behaviour:** tier 2 diver: **flaps up and caws for 0.70 s**, dives 9 m/s; after a miss it re-aims once (a new line
  drawn 0.6 s). A hit costs Pip half a heart **and snatches 3 gems** (never more than Pip has; shown as 3 gems in its
  beak). Bonked while carrying, it drops them plus 2. If it leaves (despawn) still carrying, the gems come back at once
  with the toast "The Gullgrab dropped your gems. Rude!" Gems are never lost.
- **Params:** `{ aim: 0.70, diveSpeed: 9, diveT: 0.45, reach: 5.0, alt: 2.5, tier: 2, snatch: 3, bonus: 2 }`.
- **Model:** a plump white gull with grey wingtips, a yellow beak and a teal neckerchief.
- **ART BRIEF:** silhouette a round gull in a neckerchief; 0.5 m body, 1.1 m span; palette white `#f7f7f2`, wingtips
  `#5a6a7a`, beak `#f2b43d`, kerchief `#2f7d8c`, eyes `#2a2440`; materials toon; animation glide, flap-up, dive, gem
  in beak; poly 900 / 3,000. Card: *a plump cheeky white seagull in a teal neckerchief, holding a shiny gem in its
  beak, flying over a sandbar.*
- **Bestiary:** Hoot: "Gullgrabs collect shiny things to decorate their nests. Their taste is excellent." Clover:
  "Bonk it and it drops your gems."

<a id="enemy-soot-snuffle"></a>
### Soot Snuffle

`soot_snuffle` · **charger** · HP **6** · r 0.46 · ground · emerge `ground` (out of ash) · gems 2 · poof `#d8d0c8` ·
`kettle` · S-226.

- **Where:** Ash Beach (4), The Spout (3).
- **Behaviour:** tier 2: **snuffles, sparks fizz from its snout for 0.70 s**, charges 7.5 m/s for 0.9 s; it turns
  once mid-charge (up to 45°), and the new leg of the stripe is drawn 0.55 s before the turn. A wall or rock stops it
  sneezing for 1.2 s (gold).
- **Params:** `{ windup: 0.70, speed: 7.5, dur: 0.9, reach: 7.0, guard: false, bonkOpen: 1.2, tier: 2, turnMax: 45 }`.
- **Model:** a round charcoal fluff ball with a pink-orange snout, cream eyes and spark flecks.
- **ART BRIEF:** silhouette a fluffy soot ball with a snout; 0.6 m; palette fluff `#3b3540`, snout `#e66f4f`, sparks
  `#f4d1a6`, eye whites `#fff3d8`, pupils `#2a2440`; materials toon fuzz, emissive sparks; animation snuffle, charge,
  sneeze; poly 800 / 2,500. Card: *a round fluffy charcoal-grey soot creature with a pink snout, sneezing a few tiny
  sparks, on warm black sand.*
- **Bestiary:** Hoot: "Soot Snuffles sneeze sparks. Bless them." Clover: "It turns once! Watch the new line."

<a id="enemy-steam-puff"></a>
### Steam Puff

`steam_puff` · **turret** · HP **5** · r 0.44 · stationary on a vent · emerge `still` · gems 2 · poof `#f4f0ea` · `kettle` ·
S-226. Placed: Bathhouse Terraces × 5, The Spout × 4.

- **Behaviour:** tier 2: **its lid rattles and a coral stripe draws for 0.80 s**; two steam jets 0.35 s apart down the
  same stripe (each a moving puff at 10 m/s); reload 1.2 s (gold, lid open).
- **Params:** `{ turn: 90, aim: 0.80, lock: 0.30, shot: 10, burst: 2, burstGap: 0.35, reload: 1.2, range: 12, tier: 2 }`.
- **Model:** a small round cloud shaped like a kettle with a lid knob and rosy cheeks, sitting on a vent ring.
- **ART BRIEF:** silhouette a kettle-shaped cloud; 0.7 m; palette cloud `#f4f0ea`, lid `#8fc7a0`, cheeks `#e66f4f`,
  vent `#3b3540`; materials toon, soft; animation lid rattle, puff recoil; poly 700 / 2,500. Card: *a little round
  cloud shaped like a teakettle with a lid knob and rosy cheeks, sitting on a steaming vent, puffing out a jet of
  steam.*
- **Bestiary:** Hoot: "Steam Puffs are the Kettle's hiccups." Clover: "Two puffs, then it rests. Go!"

<a id="enemy-ash-moth"></a>
### Ash Moth

`ash_moth` · **swooper** · HP **4** · r 0.36 · flying (2.0 m) · emerge `sky` · gems 2 · poof `#d8d0c8` · `kettle` · S-226.

- **Where:** Ash Beach (2, +3 at night), The Spout (3), Bathhouse Terraces (2).
- **Behaviour:** tier 2 swooper exactly as the Drip Bat (bending stripe), with **a dusty wing-rustle and eyespots
  glowing for 0.60 s**.
- **Params:** `{ rise: 0.60, swoopSpeed: 8.5, swoopT: 0.55, reach: 5.3, alt: 2.0, tier: 2, bend: 35 }`.
- **Model:** a round grey fuzzy body, broad soft wings with two orange eyespots; a wild animal, no clothes (the
  Wicklings are people; the Ash Moth must never look like one: no face mask, no clothes, no lamp).
- **ART BRIEF:** silhouette a fat fuzzy moth; 0.35 m body, 0.9 m span; palette wings `#9a9098`, eyespots `#e66f4f`, fuzz
  `#d8d0c8`, eyes `#2a2440`; materials toon fuzz; animation flutter, eyespot glow; poly 700 / 2,500. Card: *a fat
  fuzzy grey moth with two soft orange eyespots on its wings, fluttering over warm ash with a volcano behind.*
- **Bestiary:** Hoot: "Ash Moths are no relation to the Wicklings, who would like that written down." Clover: "Its
  line bends. Step out late."

<a id="enemy-sandsnoot"></a>
### Sandsnoot

`sandsnoot` · **burrower** · HP **6** · r 0.46 · under sand · emerge `sand` · gems 2 · poof `#e8b88a` · `saltglass` · S-247.

- **Where:** Glass Dunes (3), Academy Hill (2).
- **Behaviour:** tier 2 burrower: as the Sand Snapper (ring r 1.3, tell **0.75 s with a sniffing snout poking up**),
  but it surfaces **twice in a row**, the second ring placed where Pip is when the first pop ends (its own 0.75 s);
  exposed 1.4 s after the second (gold).
- **Params:** `{ moundSpeed: 3.2, ringR: 1.3, tell: 0.75, lock: 0.25, exposed: 1.4, dive: 0.4, reach: 8, tier: 2,
  pops: 2 }`.
- **Model:** a round sandy body, a long soft snout, big ears with brick-red insides.
- **ART BRIEF:** silhouette a round desert critter with a long snout and big ears; 0.6 m; palette fur `#c9a46b`, snout
  `#e8b88a`, inner ears `#b55d4c`, eyes `#2a2440`; materials toon; animation sniff, pop, dive; poly 900 / 3,000.
  Card: *a round sandy desert creature with a long soft snout and big ears popping up out of pale dunes, sniffing the
  air.*
- **Bestiary:** Hoot: "The Sandsnoot can smell a biscuit through ten metres of sand." Clover: "It pops up twice!
  Keep moving."

<a id="enemy-prickle-pear"></a>
### Prickle Pear

`prickle_pear` · **turret** · HP **5** · r 0.46 · stationary · emerge `still` · gems 2 · poof `#f08fb8` · `saltglass` ·
S-247. Placed: Salt Pans × 4, Academy Hill × 6.

- **Behaviour:** tier 2: **its flower opens and a coral stripe draws for 0.80 s**; two soft prickles 0.35 s apart down
  the stripe (10 m/s); reload 1.2 s (gold, flower closed).
- **Params:** `{ turn: 90, aim: 0.80, lock: 0.30, shot: 10, burst: 2, burstGap: 0.35, reload: 1.2, range: 13, tier: 2 }`.
- **Model:** a round pad cactus with two little pad arms, a pink flower on top, cream prickle dots.
- **ART BRIEF:** silhouette a round cactus with a flower crown; 0.9 m; palette pad `#8fae6a`, shade `#6b8a4a`, flower
  `#f08fb8`, prickles `#fff3d8`, eyes `#2a2440`; materials toon; animation flower open, recoil; poly 900 / 3,000.
  Card: *a round friendly cactus with two stubby pad arms and a pink flower on its head, in a pale salt desert.*
- **Bestiary:** Hoot: "Prickle Pears are very huggable, from a distance." Clover: "It reloads after two. Run in!"

<a id="enemy-sun-beetle"></a>
### Sun Beetle

`sun_beetle` · **shield** · HP **7** · r 0.50 · ground · emerge `sand` · gems 2 · poof `#f2c14e` · `saltglass` · S-247.

- **Where:** Salt Pans (3), Academy Hill (2).
- **Behaviour:** tier 2 shield: **polishes its sun-disc shield and it flashes for 0.65 s**, bashes 1.8 m, then a second
  bash after its own 0.55 s flash. Guard ±60°; C chop breaks it (stagger 1.0 s).
- **Params:** `{ turn: 110, bashWind: 0.65, bash: 1.8, guardArc: 60, stagger: 1.0, tier: 2, secondWind: 0.55 }`.
- **Model:** an amber scarab carrying a round polished gold disc in front.
- **ART BRIEF:** silhouette a scarab holding up a round sun disc; 0.8 m; palette shell `#c9873a`, disc `#f2c14e`, body
  `#5a3a2a`, eye highlights `#fff3d8`; materials toon, disc with a specular toon band; animation polish, flash, bash;
  poly 1,000 / 3,500. Card: *an amber scarab beetle proudly holding up a polished round golden disc like a shield,
  standing on bright salt flats.*
- **Bestiary:** Hoot: "The Sun Beetle polishes its shield every morning. Vanity or hygiene? Further study needed."
  Clover: "Go behind it. It bashes twice!"

<a id="enemy-dust-puff"></a>
### Dust Puff

`dust_puff` · **kiter** · HP **5** · r 0.45 · floats 0.6 m · emerge `sand` · gems 2 · poof `#efe3c8` · `saltglass` · S-247.

- **Where:** Glass Dunes (3), Salt Pans (2).
- **Behaviour:** tier 2 kiter (as the Bubble Puffer): **spins faster with a whoosh for 0.60 s**, throws two sand clods
  (lobbed onto reticles); cornered → dizzy 1.6 s.
- **Params:** `{ band: [6, 10], retreat: 3.2, throwWind: 0.60, lob: true, volley: 2, cornerT: 0.5, dizzy: 1.6, tier: 2 }`.
- **Model:** a little whirlwind (stacked tori, spinning) with two eyes and a crown of three blue pebbles.
- **ART BRIEF:** silhouette a small spinning dust devil with eyes; 0.8 m; palette sand `#efe3c8`, swirl `#c9a46b`,
  pebbles `#8ec9d8`, eyes `#2a2440`; materials toon, alpha swirl cards; animation spin, wobble, dizzy; poly 600 /
  2,000. Card: *a tiny friendly dust devil of pale sand with two round eyes and three blue pebbles circling its top,
  whirling over glassy dunes.*
- **Bestiary:** Hoot: "Dust Puffs are tidying the desert, one corner at a time." Clover: "Chase it into a wall. It
  gets dizzy."

<a id="enemy-nimbus-puff"></a>
### Nimbus Puff

`nimbus_puff` · **kiter** · HP **6** · r 0.48 · floats 1.4 m · emerge `sky` · gems 2 · poof `#c9c6d8` · `driftholm` · S-266.

- **Where:** Nimble Downs (3), Arch Rise (3), The Falls (2).
- **Behaviour:** tier 2 kiter: **grumbles and darkens for 0.60 s**, throws two straight raindrops (8 m/s). A cliff edge
  counts as a wall: it will not retreat off an edge, so herding it to an edge corners it (dizzy 1.6 s).
- **Params:** `{ band: [6, 10], retreat: 3.0, throwWind: 0.60, shotSpeed: 8, volley: 2, cornerT: 0.5, dizzy: 1.6,
  tier: 2, edgeIsWall: true }`.
- **Model:** a small grey raincloud with a frown that turns into a surprised "o" when dizzy. It must read as different
  from the Nimbles ([cast](./cast.md#the-nimbles)), which are white and round with smiles: the Puff is grey, flatter,
  and drips.
- **ART BRIEF:** silhouette a flat grumpy raincloud; 0.8 m; palette cloud `#c9c6d8`, belly `#9a96b0`, drops `#8fa8ff`,
  eyes `#2a2440`; materials toon; animation drift, darken, drip; poly 600 / 2,000. Card: *a small grumpy grey
  raincloud with a frown, dripping a few blue raindrops over a lilac sky meadow.*
- **Bestiary:** Hoot: "Nimbus Puffs are the Nimbles' cousins. The Nimbles do not mention them." Clover: "Push it to a
  wall or an edge. It gets dizzy."

<a id="enemy-gust-kite"></a>
### Gust Kite

`gust_kite` · **diver** · HP **5** · r 0.42 · flying (2.5 m) · emerge `sky` · gems 2 · poof `#f7f2ff` · `driftholm` · S-266.

- **Where:** The Falls (3), Arch Rise (3).
- **Behaviour:** tier 2 diver: **its ribbon tail snaps taut and it tilts back for 0.70 s**, dives 9.5 m/s; after a miss
  it re-aims once (0.6 s). Its dive pushes a 1 m gust (cosmetic). Never dives Pip off an edge: it does not start a
  dive when Pip stands within 1.5 m of an edge.
- **Params:** `{ aim: 0.70, diveSpeed: 9.5, diveT: 0.45, reach: 5.0, alt: 2.5, tier: 2, edgeSafe: 1.5 }`.
- **Model:** a diamond kite body (flattened octahedron) with two eyes, a ribbon tail of three bows.
- **ART BRIEF:** silhouette a diamond kite with a bow tail; 0.9 m span; palette body `#c9b6ec`, edges `#f7f2ff`, bows
  `#9bb87a`, eyes `#2a2440`; materials toon, tail as a ribbon strip; animation flutter, snap taut, dive; poly 500 /
  2,000. Card: *a lilac diamond-shaped kite creature with two cheerful eyes and a ribbon tail of green bows, swooping
  over a cloud waterfall.*
- **Bestiary:** Hoot: "Nobody flies the Gust Kites. They fly themselves." Clover: "It dives, then tries again. Two
  sidesteps!"

<a id="enemy-stardust-sprite"></a>
### Stardust Sprite

`stardust_sprite` · **swarm** (flying) · 5 members × HP **1** (group 5) · member r 0.18 · flying (1.4 m) · emerge `sky` ·
gems 3 · poof `#ffe9a8` · `starmeadow` · S-277.

- **Where:** Lower Lanterns (3), Constellation Bridges (2).
- **Behaviour:** tier 3 swarm: five motes orbit 2.5 m; **a member brightens and chimes for 0.60 s**, darts 7 m/s for
  0.4 s; two darters in sequence 0.5 s apart under one token; each darter leaves a 1 s sparkle trail (a thin zone,
  half a heart if Pip walks through it within that second, drawn the moment it appears).
- **Params:** `{ members: 5, orbitR: 2.5, dartWind: 0.60, dartSpeed: 7, dartT: 0.4, memberHp: 1, tier: 3, trail: 1.0 }`.
- **Model:** five tiny five-point stars with round faces and soft blue halos.
- **ART BRIEF:** silhouette tiny round stars; 0.25 m each; palette body `#ffe9a8`, halo `#8fa8ff`, eyes `#141a3a`;
  materials emissive toon + additive halo sprite; animation twinkle orbit; poly 200 each / 800 each. Card: *five tiny
  round golden star sprites with sleepy happy faces and soft blue halos, swirling over a deep blue sky with
  constellation lines.*
- **Bestiary:** Hoot: "Stardust Sprites are what is left over when a star is made. They do not think of themselves as
  leftovers." Clover: "Hit the glowing one when it comes back."

<a id="enemy-comet-pup"></a>
### Comet Pup

`comet_pup` · **charger** · HP **7** · r 0.48 · ground (bridges and isles) · emerge `sky` · gems 3 · poof `#ffe9a8` ·
`starmeadow` · S-277.

- **Where:** Constellation Bridges (3), Ladder Foot (2).
- **Behaviour:** tier 3 charger: **wags, crouches, tail blazing for 0.70 s**, charges 7.5 m/s for 0.9 s, turns once
  (new leg drawn 0.55 s ahead), and leaves its path as a sparkle zone for 2 s (drawn as it forms; half a heart to
  walk in). Never charges along a bridge toward an open side: on a constellation bridge it charges only along the
  bridge. A pillar or wall stops it, dizzy 1.2 s (gold).
- **Params:** `{ windup: 0.70, speed: 7.5, dur: 0.9, reach: 7.0, guard: false, bonkOpen: 1.2, tier: 3, turnMax: 45,
  trail: 2.0 }`.
- **Model:** a round periwinkle puppy body, floppy ears, a long tapering golden comet tail.
- **ART BRIEF:** silhouette a round puppy with a comet tail; 0.7 m tall, 1.6 m with tail; palette body `#8fa8ff`, tail
  `#ffe9a8`, ears `#f7f2ff`, nose `#141a3a`; materials toon, tail additive; animation wag, crouch, charge; poly 900 /
  3,000. Card: *a round periwinkle-blue puppy with floppy white ears and a long sparkling golden comet tail, bounding
  across a starry bridge.*
- **Bestiary:** Hoot: "Comet Pups chase things. Pip is a thing." Clover: "Don't stand on its sparkly trail."

<a id="enemy-moonbeam-turret"></a>
### Moonbeam Turret

`moonbeam_turret` · **turret** · HP **6** · r 0.46 · stationary · emerge `still` · gems 3 · poof `#f6f3d8` · `starmeadow` ·
S-277. Placed: Constellation Bridges × 6, Ladder Foot × 4.

- **Behaviour:** tier 3: **the crescent glows and its stripe draws for 0.90 s, sweeping 30° toward where Pip is
  going** during the aim (the lock at 0.30 s fixes it); a burst of 2 moonbeams 0.35 s apart; reload 1.2 s (gold).
- **Params:** `{ turn: 90, aim: 0.90, lock: 0.30, shot: 11, burst: 2, burstGap: 0.35, reload: 1.2, range: 14, tier: 3,
  sweep: 30 }`.
- **Model:** a crescent-moon lamp with a sleepy face on a slim navy post.
- **ART BRIEF:** silhouette a crescent moon on a stick; 1.2 m; palette crescent `#f6f3d8`, post `#141a3a`, glow
  `#ffe9a8`, eyes `#2a2440`; materials emissive toon; animation glow, recoil; poly 600 / 2,000. Card: *a crescent
  moon lamp with a sleepy little face on a slender navy post, glowing gold over a cloud island at night.*
- **Bestiary:** Hoot: "The Moonbeam Turret is a lighthouse for very small ships." Clover: "Its line sweeps. Go where
  it's been."

<a id="enemy-wisp-lantern"></a>
### Wisp Lantern

`wisp_lantern` · **ghost** · HP **6** · r 0.42 · floats 1.0-1.8 m · emerge `fade` · gems 3 · poof `#8fa8ff` ·
`starmeadow` · S-277.

- **Where:** Lower Lanterns (2), Ladder Foot (3); always out (no night rule needed).
- **Behaviour:** tier 3 ghost: hittable only in light (the Lantern; the Starmeadow's own lamps count, 4 m); **its
  paper glows and it rustles for 0.65 s**, bumps 3 m; once per bump it may blink 3 m sideways (fades 0.3 s, reappears
  with a fresh 0.65 s tell). At half HP (tier 2 rule kept) it splits into two 3-HP halves.
- **Params:** `{ drift: 1.2, bumpWind: 0.65, bump: 3, bumpT: 0.3, tier: 3, blink: 3, split: true }`.
- **Model:** a round paper lantern with a navy frame and a little blue wisp face inside.
- **ART BRIEF:** silhouette a round paper lantern with a face glowing inside; 0.6 m; palette paper `#ffe9a8` at 0.8
  alpha, frame `#6a5a8a`, wisp `#8fa8ff`; materials emissive toon; animation sway, blink fade; poly 500 / 2,000. Card:
  *a round paper lantern floating on its own with a small shy blue wisp face glowing inside, drifting among cloud
  islands under gold stars.*
- **Bestiary:** Hoot: "Wisp Lanterns wandered off from a very old party and are still looking for the music." Clover:
  "Lantern up, then bonk."

<a id="enemy-hushling"></a>
### Hushling

`hushling` · **ghost** · HP **4** · r 0.44 · floats 0.3-1.0 m · emerge `fade` · gems 2 · poof `#f6f3d8` (moon dust) ·
`moonmere` · S-218.

- **Where:** Moonmere Woods, Peaks, Shores and Meadow (3 each, beside the silver variants).
- **Behaviour:** tier 2 ghost: hittable in light (the Lantern or within 5 m of any of Moonmere's 12 moon-lanterns once
  lit); **goes "shh" and swells for 0.65 s**, bumps 3 m; at half HP splits into two halves of 2 HP.
- **Params:** `{ drift: 1.1, bumpWind: 0.65, bump: 3, bumpT: 0.3, tier: 2, split: true }`.
- **Model:** a soft navy blob with a silver rim light, two moon-cream eyes and a finger-to-lips shape (a small capsule).
- **ART BRIEF:** silhouette a soft shadow blob with one tiny arm raised to its mouth; 0.7 m; palette body `#2a3358`,
  rim `#cfd8ee`, eyes `#f6f3d8`; materials toon at 0.8 alpha with a silver fresnel; animation sway, "shh", split;
  poly 500 / 2,000. Card: *a soft navy shadow creature with a silver outline and moon-cream eyes, holding a little
  finger to its lips, in a silver moonlit garden.*
- **Bestiary:** Hoot: "Hushlings say 'shh' to everything, including me." Clover: "Moon-lanterns or your Lantern. Then
  they're bonkable."

<a id="silver-variants"></a>
### Moonmere silver variants (not separate entries)

`slime_silver`, `mushroom_silver`, `bat_silver`, `bee_silver`, `crab_silver`, `snowpuff_silver`: the home species with
the **same params and tells, HP +1**, gem tier 2, material swap only (main colour → `#cfd8ee`, shade → `#2a3358`,
accents → `#f6f3d8`), poof into moon dust `#f6f3d8`. No new rig and no new card: the home card gains a silver
"Moonmere" stamp once one is poofed. They count toward their home species' bestiary entry.

---

<a id="boss-framework"></a>
## 6. The boss framework

ENGINE F18-F19, steps S-043 (defs, phases, move runner; Grumble Shroom ported), S-044 (Pinch and Frostbun ported;
arenas from realm anchors; HP by count) and S-045 (handover, plushie and rematch as def data). The three ports are
**behaviour-identical**: `wp5` and the rematch playthrough steps stay green and `G.debug.actors.boss(name)` keeps
its move names (`stomp`, `spores`, `summon`, `charge`, `bubbles`, `snap`, `leap`, `throw`, `slide`).

<a id="boss-def"></a>
### The def

```js
// js/boss/defs.js (one file per boss under js/boss/<id>.js once there are more than three)
BOSS_DEFS['pinewhistle.mossmantle'] = {
  id: 'pinewhistle.mossmantle',     // S.bosses key; the three Catchers keep 'woods', 'shores', 'peaks'
  name: 'Mossmantle', title: 'Hoarse Warden of the Whistling Pine',   // the intro name card
  kind: 'bout',                     // bout | puzzle | wits | exam | chase | catch (see the table below)
  model: 'boss_mossmantle', height: 3.6, r: 1.4,                      // manifest key; hurt / body radius (m)
  keepOut: 1.9, room: 2.9,          // FP: closest eye distance; personal space (TUNE.actors KEEP meaning)
  hp: { base: 74, perCalmed: 8, group: 'act2Wardens' },               // or a number
  enrageAt: 0.5,                    // first fight; rematch uses rematch.enrage
  enrageAt2: null,                  // act closers and Act III Wardens: 0.33 (second escalation + arena change)
  arenaChange: null,                // with enrageAt2: the id of the arena change the runner plays (see each boss)
  cool: [1.6, 2.6],                 // s between a recover and the next tell
  arena: { anchor: 'mossmantle', r: 13, shape: 'round', seal: 'vines', wallBonk: true },
  phases: [
    { below: 1.0, table: [['swing', 40], ['cones', 35], ['doze', 25]] },
    { below: 0.5, table: [['swing', 35], ['cones', 30], ['hum', 20], ['doze', 15]] },
  ],
  moves: {                          // wind = drawn tell length (≥ 0.55); act = active time; recover; open = gold time
    swing: { telegraph: 'stripe', wind: 0.9, act: 1.2, recover: 0.6, open: 0, dmg: 1, threats: 1 },
    // ...
  },
  handover: { lines: ['...', '...', '...'], reward: { flag: 'beacon_pinewhistle_open' }, sit: 'dizzy' },
  after: { realm: 'pinewhistle', anchor: 'whistlingPineBough', talk: ['...'] },
  plushie: { id: 'plush_mossmantle', name: 'Mossmantle plushie', price: 100, desc: '...', got: '...' },
  rematch: { hpK: 1.25, enrage: 0.75, gems: 60, verb: 'Wake' },
  dream: { id: 'dream_mossmantle', twist: 'halfSpeed' },             // null when the boss has no Dream
  bestiary: { card: 'card_boss_mossmantle', lore: '...', tip: '...' },
};
```

<a id="encounter-kinds"></a>
### Encounter kinds

CANON §9.1: fourteen story encounters, varied in kind. The `kind` picks the runner; all kinds share intro, seal,
dizzy-reset and handover.

| Kind | Runner | Bar shows | Ends when | Bosses |
|---|---|---|---|---|
| `bout` | move runner (phases, moves, openings, shrug) | HP | HP 0 | Catchers, Mossmantle, Honksworth, Wickwork Moth, Lumbra, Fumarole, Flurry, Bosun Snore |
| `puzzle` | move runner + a puzzle state (pit-plates; tide stones) | HP (Rollo); "Arms let go n/8" (Gloop) | HP 0; all 8 arms let go | Sir Rollo, Old Gloop |
| `wits` | sequence runner (rounds of notes) | "Round 1/3" | 3 rounds answered | Pelagia |
| `exam` | paper runner (3 papers, each its own script) | "Paper 1/3" | 3 papers handed in | Tutor Scarabelle |
| `chase` | leash runner (legs, distance) | a distance string | 3 legs done | Mote |
| `catch` | finale runner (3 parts) | "Lanterns lit" | part 3 Given Light | the Second Sneeze |

<a id="boss-grammar"></a>
### Grammar every bout obeys (KEEP from the guardians, now a test)

1. **Telegraph ≥ 0.55 s**, matching the damage volume; boss wind-ups have the whole-body lean / rise / swell (KEEP),
   a sound and a ground shape.
2. **At most two threats live at once** (a lingering zone counts as one).
3. **Openings the boss causes itself**: every move table has at least one move that ends in a gold opening (`open >
   0`) without needing a tool; a tool may *also* cause one. The HUD says "Now!" (KEEP).
4. **Shrug** (KEEP `TUNE.actors.shrug`): a string of hits worth ≥ 3 damage outside an opening is shrugged off; Pip is
   shoved out, no damage. Openings are where damage piles up.
5. **One escalation** at `enrageAt` (half health in a first fight, 75 % in a rematch): `speedK` 1.4 (KEEP), shorter
   cool, the second phase table; no new form, no heal. **Act closers and Act III Wardens** (the Wickwork Moth, Lumbra,
   Lady Fumarole) add a **second escalation** at `enrageAt2` = 33 % HP (rematch: 40 %): a third phase table, cool × 0.85,
   and **one arena change** (`arenaChange`, announced 2 s ahead by a sound and a drawn edge, never during a live tell).
   Still no new form, no heal, at most two threats (a lingering arena hazard counts as one).
6. **Every hit Pip takes is 1 HP.** Passive contact never hurts (`passiveContact: false`, KEEP): the boss shoves at
   `TUNE.actors.shove` 5.5 m/s.
7. **Dizzy is kind**: Pip wakes outside (overworld: by the Tree; dungeon: at the entrance with puzzle state kept;
   Dream: beside the napping boss); the boss is at full HP and naps; the vines or boss door reopen.
8. **Never a timer that fails.** Chase legs restart; exam papers restart; wrong notes splash.

<a id="hp-formula"></a>
### HP by count, rematches and rewards

- `hp(def, S)`: a number, or `base + perCalmed × (bosses of def.hp.group already calmed, not counting this one)`.
  The one group is `act2Wardens = ['pinewhistle.mossmantle', 'archwater.gloop', 'threemills.honksworth']`, so
  Mossmantle and Honksworth have **74** if met first, **82** second, **90** third, in any order (raised from CANON
  §9.1's 56 / 62 / 68 for the 60-120 s Warden target, [balance](#balance-targets)). Old Gloop is a puzzle-boss with no
  HP: he still counts as a calmed Warden for the others, and his own scaling is the gold window (2.5 / 2.2 / 1.9 s by
  Wardens calmed before him).
- `hpMax(def)`: the HP with the whole group calmed (90 for the Wardens; the number otherwise). **Rematch HP =
  round(hpK × hpMax)**, enraged from 75 %, the same moves and wind-ups (KEEP rule).
- First rematch win: **60 gems once** for every new boss (`S.rematches[id]`), **40 for the three Catchers (KEEP)**.
  The Rematches row counts 14: 3 Catchers + 11 new (Rollo, Mossmantle, Gloop, Honksworth, Wickwork Moth, Lumbra,
  Pelagia's Bell Duel, Fumarole, Scarabelle's Resit, Flurry, Bosun Snore). Mote and the Second Sneeze have none.
- **When a boss naps.** Catchers: KEEP (after the bloom, `S.ending`). Every other boss: once its handover scene has
  played and Pip has left that realm once. A napping boss shows `[E] Wake · <Name>` at its **after spot**; if the
  after spot is not its arena, Wake plays the rematch card ("Mossmantle · Rematch") and loads the arena realm through
  the portal system, then returns Pip to the after spot (win or dizzy).
- **Plushies**: Miso stocks a boss's plushie once that boss is calmed and the shop is bought out (KEEP rule,
  generalised in S-045); new ones cost **100 gems** (the three KEEP ones stay 80). Mote's plushie stocks after the
  main ending. Full stock rules and the non-boss plushies (Wenna, Nell, a duck) live in
  [side-content#plushies](./side-content.md#plushies).

<a id="intro-handover"></a>
### Intro, handover and afterwards

- **Intro** (KEEP flow): stepping into the arena seals it (glowing vines outdoors; the boss door drops in a dungeon);
  2.4 s intro with the camera drawn to the boss and the **name card** `Name` over `Title`.
- **Handover** (replaces the old burst, S-005): on the last hit the boss sits down dizzy (lean back 20°, three stars
  circling its head for 1.5 s, a soft descending chime), the music drops to its land's calm layer, and three lines
  play in the dialogue box with the boss's portrait. The reward is held out (a Starseed, a Stair Stone, the beacon's
  key light, a heart container) and taken with the item-get beat. The boss stays awake with `[E] Talk · <Name>` in the
  arena until Pip leaves the realm, then moves to its after spot.
- Line rules: ≤ 220 characters, the boss's tic in every line, no apology for "attacking" (they were doing a job).

---

<a id="catchers"></a>
## 7. The Catchers (home guardians; LOCKED stats, deepened)

The three shipped guardians keep every number, move, wind-up and line in CANON-NOW §2.4. What is new: the def form
(S-043, S-044), the handover scenes (S-005, S-006; lines in CANON §4.2), their reason props
([atlas-home#placeReasons](./atlas-home.md#placeReasons)), their Dreams, their catch in the finale and the Jamboree.

<a id="boss-grumble"></a>
### Grumble Shroom

`woods` · bout · **48 HP** (rematch 60) · arena Grumble Shroom's Hollow (−3.2, −114), r 14 m · GLB `boss_shroom` 3.2 m
(KEEP, never replaced) · title "Grumpy Guardian of the Whispering Woods" · S-005, S-043.

| Move (KEEP name) | Tell | Shape | Numbers (KEEP) | Opening |
|---|---|---|---|---|
| `stomp` | crouch, pre-ring light wall at r + 0.2 | ring | ring 6.5 m/s (× 1.2 enraged), height 0.9; enraged echo ring 0.6 s later with its own 0.3 s hop tell | lands tired: gold |
| `spores` | puffs cheeks | fan | 5 spores (7 enraged) | - |
| `summon` | waves arms | - | two Grumpy Shroomlets (2 HP) only while fewer than `minions` 1 are about | - |

Weights `stomp 45, spores 35, summon 20` (KEEP); cool 1.8-2.8 s. **Handover** (CANON §4.2): "Hmph. Fine. FINE. Take
it." / "The little ones were scared of the dark, you know. Since she went droopy, the woods stopped glowing. That
seed lit them right up." / "Bring it home. Tell her Grumble kept it warm." Reward: the Woods Starseed. **After:**
naps in the Hollow; side story [ss-11](./side-content.md#ss-11) and [act-spore-rally](./side-content.md#act-spore-rally).
**Plushie** `plush_woods` (KEEP, 80). **Rematch** KEEP (60 HP, 75 %, 40 gems). **Dream:** [rings roll inward](#dream-grumble).
**Finale:** catches the Woods Starseed at his corner: "Got it!" **Jamboree:** goes first.

<a id="boss-pinch"></a>
### Captain Pinch

`shores` · bout · **48 HP** (rematch 60) · arena Captain Pinch's Cove (26, 142), r 14 m · GLB `boss_crab` 2.6 m (KEEP) ·
title "Snippy Skipper of the Sunny Shores" · S-006, S-044.

| Move | Tell | Shape | Numbers (KEEP) | Opening |
|---|---|---|---|---|
| `charge` | stripe, locks 0.4 s before | stripe | width 2·(r + Pip r + 0.15) | wall bonk, stunned 1.2 s: gold |
| `bubbles` | claws up | fan / volley | 6 (9 enraged, all at once, `bubbleEnraged` 1.6) | - |
| `snap` | 0.75 s wind-up, aim locks 0.5 s before | stripe | claws 1.9 m ahead, half-width 1.3, lunge 11 m/s 0.28 s | - |

Weights `charge 42, bubbles 33, snap 40 if Pip within 4.5 m else 15` (KEEP); cool 1.4-2.2 s. **Handover:** "Belay
that! ...Aye, aye. Ye've a kind hand, I'll give ye that." / "My lamp went dark the night she wilted, and Nell
Pelliwick's boat is still out past the reef. A skipper doesn't let a lamp go out with a boat at sea." / "Take it to
the Tree. She'll want a light to come home by." Reward: the Sea Starseed. **After:** naps in the Cove; the lamp burns
by day until Nell is home (I.6); receives the Merry Mabel's bell ([Bosun Snore](#boss-bosun-snore)); climbs the
lighthouse with Pip in ch22. **Plushie** `plush_shores` (KEEP). **Rematch** KEEP. **Dream:** [the tilting deck](#dream-pinch).
**Finale:** "Caught one, lad!" **Jamboree:** goes second.

<a id="boss-frostbun"></a>
### Frostbun

`peaks` · bout · **50 HP** (rematch 63) · arena Frostbun's Summit (114, −19), r 14 m · GLB `boss_frost` 3.4 m (KEEP) ·
title "Chilly Champion of Frostcap Peaks" · S-006, S-044.

| Move | Tell | Shape | Numbers (KEEP) | Opening |
|---|---|---|---|---|
| `leap` | light pillar r 1.2 m, h 8, falling whistle | disc r 2.9 | enraged: snowballs burst on landing | lands: gold |
| `throw` | 0.6 s wind-up | fan | 5 snowballs (7 enraged) | - |
| `slide` | 0.6 s wind-up | stripe | 10 m/s (× √enrage) for 1.4 s; arena wall bonk | 0.8 s gold |

Weights `leap 42, throw 33, slide 25` (KEEP); cool 1.5-2.4 s. **Handover:** "Brrr-rrr... no. Mine." / "It was
shivering when it landed. Seeds catch cold. Everyone knows that. I hugged it all night." / "You will keep it warm?
Promise? ...Hop to it, then." Reward: the Frost Starseed. **After:** naps on the Summit; one of Eight Socks' missing
socks is on Frostbun ([ss-25](./side-content.md#ss-25)); runs [act-sledding](./side-content.md#act-sledding);
sends Pip to Great-Aunt Flurry ([ss-12](./side-content.md#ss-12)). **Plushie** `plush_peaks` (KEEP). **Rematch**
KEEP. **Dream:** [the ice floor](#dream-frostbun). **Finale:** "Mine! ...I mean, here." **Jamboree:** goes third.

---

<a id="story-bosses"></a>
## 8. Story bosses

Model rules for every boss: code-built toon rig in `js/boss/<id>.js` or `js/models.js` (≤ 6,000 tris, ≤ 8
materials, whole-body tells, no skeleton required); owner GLB later through `models.boss_<short>` (≤ 12,000 tris, one
1024² painted texture, normalised to 1 unit tall, origin bottom-centre, facing +Z). Each boss step generates a
**portrait** (512², webp ≤ 60 KB, `portrait_<short>`, painted head-and-shoulders on a soft vignette, three
expressions in one 3-frame strip: calm, dizzy, smiling; sliced with `tools/process_strip.py`) and a **bestiary card**
`card_boss_<short>` (384²). The portrait prompt is the card description with "head-and-shoulders portrait, soft
vignette, three expressions side by side: calm, dizzy with stars, smiling". Character looks outside combat are in
[cast](./cast.md); if a size or colour disagrees, CANON's number wins and both files are fixed.

<a id="boss-rollo"></a>
### Sir Rollo

`home.rollo` · **puzzle-boss** · **44 HP** · dungeon 1 Under the Roots, last room ([dungeons#d1](./dungeons.md#d1)) ·
title "Tunnel-Flattener of Under the Roots" · S-061. A pill-bug who has rolled the root tunnels flat for forty years
"because nobody told me to stop".

**Arena.** A rectangular root hall 20 × 14 m, walls of packed earth and roots (a wall bonk anywhere), floor lit by
four wall-lanterns Pip lit on the way in; two **pit-plates** (round recessed plates r 1.2 m, 0.4 m deep) at (−6, 0) and
(6, 0) from the room centre; the boss door south.

| Move | Tell | Shape | Wind | Active | Recover / opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `roll` | curls up, rocks back, a gravel crunch; stripe from him to the far wall, locks 0.4 s before | stripe (width 2.4 + 0.64 + 0.3) | 0.8 | 8 m/s to the wall | wall bonk: uncurls dizzy **1.2 s** gold | 45 / 40 |
| `pebbles` | rears up and stamps; dust falls from the ceiling | circles × 3 r 1.0 (5 in P2), never on Pip's spot in P1, one on Pip in P2 | 1.0 | fall 0.3 | 0.8 | 35 / 30 |
| `sulk` | at 75 %, 50 % and 25 % HP: "Hmph. Not coming out." Curls into a ball, no attacks | - | - | until plated or 12 s | - | forced |

**The puzzle.** While sulking he is a **knockable ball**: each sword hit knocks him 3 m along Pip's swing direction
(C chop 5 m), with a cream arrow drawn on the floor showing where the next hit sends him. Knocked into either
pit-plate he drops in with a clunk, the plate clicks, roots tighten round him, and he pops out **dizzy for 3.0 s**
(gold, all hits count, no shrug). If 12 s pass without a plate, he uncurls grumbling and the fight goes on (no
penalty; the next sulk comes at the next threshold). P2 at 50 %: cool 1.2-2.0 s instead of 1.6-2.6 s; pebbles 5.

**Handover.** "Oh. Ohh. Am I upside down? I'm upside down." / "Forty years I've rolled these tunnels flat. Nobody told
me to stop, so I didn't." / "You're telling me to stop? Oh, thank goodness. My knees. All fourteen of them." Reward:
the root door to the bottom chamber opens (where Wenna explains the beacons, [story#ch7](./story.md#ch7)).

**After.** Rolls Digby's tunnels at Digby's request (a cutscene beat in [ss-01](./side-content.md#ss-01)); races in
Clover's Dash ([act-dash](./side-content.md#act-dash)); naps in his hall. Talk: "Rolling is fine. Rolling for no
reason was the problem." **Plushie** `plush_rollo` · "Sir Rollo plushie" · 100 · "Curls up when hugged. Uncurls for
snacks." · got "A Sir Rollo plushie! Roll it gently~ Mrrow~". **Rematch** 55 HP (1.25 × 44), sulks at 75/50/25 % as
before, 60 gems. **Dream:** [two Rollos](#dream-rollo).

**ART BRIEF.** Silhouette: a long dome of overlapping armour bands with a small head and two feelers; curls into a
perfect ball 1.6 m across. Size 2.4 m long, 1.3 m tall. Palette bands `#5d7391`, band edges `#f1e4c3`, underside
`#c9b9a0`, legs `#3f4f66`, eyes `#2a2440`, a tiny knight's plume `#c2563f` on his head (he is "Sir"). Materials toon,
armour bands as 7 scaled half-tori. Animation: walk (leg ripple), curl (0.4 s), roll, dizzy uncurl, sulk ball. Poly
4,000 code / 10,000 GLB. Card: *a big gentle slate-blue pill-bug with cream-edged armour bands, tiny feelers and a
little red plume like a knight's, in a root tunnel lit by lanterns.* 3D prompt: *a cute chunky giant pill-bug
knight, slate-blue armour bands with cream edges, small round head, two feelers, a tiny red plume, hand-painted toon
texture, game-ready low-poly under 12k triangles, neutral pose facing forward.* Bestiary: Hoot: "Sir Rollo was
knighted by nobody, which is the hardest way." Clover: "When he sulks, knock him into the round plate!"

Balance: careful bot with the wooden sword ≥ 90 % in 45-90 s losing ≤ 3 hearts; with the Shiny Sword under 60 s.

<a id="boss-mossmantle"></a>
### Mossmantle

`pinewhistle.mossmantle` · bout · **74 + 8 per Warden calmed** (74 / 82 / 90) · dungeon 2 Whistlehollow, the crown
chamber inside the Whistling Pine ([dungeons#d2](./dungeons.md#d2)) · title "Hoarse Warden of the Whistling Pine" ·
S-105. A moss-covered sloth who has hummed the pine's song for nine days so the Acornet squirrels could sleep.

**Arena.** Round, r 13 m, the hollow heart of the pine with the dark beacon above. Three horizontal **boughs** cross
the chamber 4.5 m up, at 0°, 60° and 120°. Mossmantle hangs from one bough at a time and moves between them by a slow
hand-over-hand climb (2.5 s, no threat, he says "mmm...").

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `swing` | sways back with a long branch creak | stripe under his bough, 12 m × 2.4 m | 0.9 | 1.2 (one pass) | - | 40 / 35 |
| `cones` | shakes the bough, needles drift down | circles × 3 r 1.2 along the bough (5 in P2) | 1.0 | fall 0.3 | - | 35 / 30 |
| `doze` | his head nods, a snore bubble grows | - | - | - | **2.5 s gold** (1.8 s in P2): he hangs low, head at 1.4 m | 25 / 15 |
| `hum` (P2) | deep breath, the chamber walls glow green | ring 3.5 m/s from under him, height 0.6 | 0.9 | to r 13 | - | 0 / 20 |

After every `swing` he is 70 % likely to `doze` next (the slapstick opening). The Leaf Glider is found earlier in the
dungeon: gliding off a bough-height ledge onto his back during a doze is a bonus C chop with ×2 knockback (no extra
damage). P2 at 50 %: `speedK` 1.4, cool 1.2-2.0 s.

**Handover.** "Mmm... hmm... oh. Was I... asleep again?" / "Nine days I hummed her song. The pine forgot it when the
light went out, and the little squirrels can't sleep without it." / "Light her lamp, little one. Then she can sing...
and I can... mmm... rest." Reward: `[E] Kindle · Beacon` opens at the pine's top ([story#ch9-11](./story.md#ch9-11)).

**After.** Hangs from a bough of the Whistling Pine on Whistle Rise and hums duets with it at dusk. Talk: "She sings
the high part. I do the... mmm... low part." **Plushie** `plush_mossmantle` · 100 · "Soft as moss. Slower than moss."
· got "A Mossmantle plushie! He's already asleep~ Mrrow~". **Rematch** 113 HP (1.25 × 90), 60 gems. **Dream:**
[half speed](#dream-mossmantle).

**ART BRIEF.** Silhouette: a long-armed shaggy sloth hanging by hooked hands, fern fronds sprouting from his back, a
pale face mask with a sleepy smile. 3.6 m hanging length. Palette fur `#8a7a5e`, moss `#6f9a4a`, ferns `#4f7d3a`, face
`#e8d8b4`, eye patches `#5a4a3a`, claws `#f2e6c9`. Materials toon fur with clumped moss spheres. Animation: hang idle
sway, swing, climb, doze (head droop, snore bubble scale 0.2 → 0.8), hum breath. Poly 5,000 / 12,000. Card: *a huge
gentle moss-covered sloth hanging from a pine bough by long arms, ferns growing on his back, a sleepy contented smile,
inside a hollow tree glowing green.* 3D prompt: *a cute chunky giant sloth covered in moss and little ferns, long
arms with blunt hooked hands, pale face mask, sleepy smile, hanging pose, hand-painted toon texture, low-poly under
12k triangles.* Bestiary: Hoot: "Mossmantle has been asleep for most of history and missed none of it." Clover: "He
falls asleep after he swings. That's your turn!"

<a id="boss-gloop"></a>
### Old Gloop

`archwater.gloop` · **puzzle** · **no HP: "Arms let go 0/8"** · dungeon 3 Undertow Grotto, the Moon Pool cave under the
Great Arch ([dungeons#d3](./dungeons.md#d3)) · title "Eight-Socked Warden of the Great Arch" · S-126. A purple
octopus in eight mismatched knitted socks holding the sea still so the Raft does not tip. Act II's one puzzle-boss:
the player wins by reading the arena, not by wearing down a number.

**Arena.** A round cave, r 13 m: Gloop in a central pool r 4 m; Pip on a 5 m-wide stone ring around it; the cave wall
beyond. **Eight tide stones** (1.4 m) stand round the **pool's rim**, evenly spaced (stone 1 at the west, numbered
round the rim; where the arena puts the pool off-centre, the step's map gives the eight rim tiles), each carved with one
sock's colour **and** pattern. Each of Gloop's eight arms is wrapped round its own stone: the arm in sock
n holds stone n. That grip is what holds the sea still.

**Socks** (arm order 1-8, colour = its stripe): 1 red `#e0574f`, 2 orange `#f29a45`, 3 yellow `#f2d14e`, 4 green
`#7fc25a`, 5 teal `#3fa7a0`, 6 blue `#5a8ee0`, 7 pink `#f08fb8`, 8 cream-striped `#f3e6c8`. Each sock also has a
pattern (stripes, dots, zigzag, hearts, stars, checks, plain, Fair Isle) so colour is never the only cue; each stone
also has its own pitch (a C-major scale, stone 1 lowest) so sound alone works too.

**The puzzle.** One tide stone at a time is **lit**: it glows its sock colour, its carved pattern shines, and it chimes
its pitch every 2 s (the HUD shows a small swatch of the lit sock beside "Arms let go n/8"). The arm holding the lit
stone is the only one that will let go. Pip makes it let go by striking that arm during an **opening** (gold, "Now!"):
- **Ring the lit stone** with the Tide Bell (3 m): the tide tugs that arm; it lifts out of the water onto the ring,
  wiggling, gold for **2.5 s** (2.2 s if one other Warden is calmed, 1.9 s if two).
- Or **dodge its sweep**: when the lit stone's arm sweeps and misses, it slaps the cave wall and sticks, gold 1.5 s.
- Or **bat an urchin back** (`juggle`): a bonked Gloop is dazed 2.0 s and the lit stone's arm flops onto the ring, gold.
One sword hit on the matching arm in an opening = that arm **lets go**: it uncurls from its stone with a soft "plop",
the stone's light goes out and the sea in that eighth of the pool rises a little (cosmetic), and the next stone lights
after 1.5 s. Striking any other arm (or the right arm outside an opening) is a tickle: "Tickles, dearie!", the
shrug shove, no effect. Ringing an unlit stone just chimes.

**Order.** The lighting order is a permutation of 1-8 drawn from `new RNG(fightSeed)` at the intro (shown only by the
stones, never written); a dizzy reset re-draws it and restores the arms already let go (the fight restarts from 0/8,
rule 7). **P2 at 4/8:** two stones light at once (either order; both chime), and `double` joins the table.

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `sweep` | one arm rises, its sock glows and wiggles, a wet slap sound | stripe radial from the pool, 9 m × 1.6 m, coral with the sock's colour as its edge | 0.8 | 0.5 | if Pip was not in it, the arm slaps the cave wall and **sticks 1.5 s gold** (counts only if it is a lit stone's arm) | 45 / 35 |
| `ink` | a **gulp** sound, then he swells for **1.2 s** (CANON) | disc r 4 m on Pip's spot | 1.2 | lands 0.2 | the ink lingers 4 s as a dark zone (no damage after landing; no sweep crosses it; a lit stone inside the ink still chimes) | 20 / 20 |
| `juggle` | juggles three urchins, humming | reticles × 3, lobbed 1.0 s apart | 0.8 each | flight 0.9 | each urchin glints in its last 0.3 s: a swing then bats it back; a returned urchin dazes him: the lit arm flops, **2.0 s gold** | 35 / 30 |
| `double` (P2) | two arms rise one after the other | two sweeps 0.6 s apart (2 threats) | 0.8 + 0.6 | 0.5 each | as sweep | 0 / 15 |

A sweep only ever comes from an arm that has not let go; after 6/8 only lit arms sweep. Swept arms never cross a stone
that is lit (Pip can always reach a lit stone without standing in a live stripe). Debug: `G.debug.actors.boss('gloop')
.lit()` returns the lit stone numbers; `.letGo(n)` releases arm n.

**Handover.** "Oh! Oh my. Eight arms, dearie, and not one of them could catch you." / "When the arch light went out the
tide stopped where it was. If I let go, the sea would rush back all at once and tip the Raft right over." / "You
light the arch, and I'll let the sea go gently. One arm at a time, dearie." Reward: `Kindle · Beacon` on the arch.

**After.** In the Moon Pool under the Great Arch; runs [act-juggling](./side-content.md#act-juggling); owner of
[ss-25 Eight Socks](./side-content.md#ss-25) (his eighth sock is missing: it is on Frostbun; until it
is returned his eighth arm wears a tea cosy, cream `#f3e6c8` with a bobble). Talk: "Eight socks, dearie. Well.
Seven and a tea cosy." **Plushie** `plush_gloop` · 100 · "Eight arms, eight socks, endless hugs." · got "An Old Gloop
plushie! I counted the socks twice~". **Rematch** "Arms let go 0/8" with two stones lit from the start, a 1.6 s gold
window and the P2 table throughout, 60 gems. **Dream:** [eight arms](#dream-gloop).

**ART BRIEF.** Silhouette: a big round purple head-body with drooping eyelids, eight curling arms each in a different
knitted sock. 4 m tall with arms raised. Palette skin `#8a5cc0`, belly `#b89ce0`, suckers `#f2d8f0`, eyes `#2a2440`
with lids `#6b4a8c`, socks as listed. Materials toon, socks with a knit normal-free painted stripe texture (canvas
generated). Animation: idle arm curl, arm raise, slap, stuck wiggle, gulp swell, juggle. Poly 6,000 / 12,000. Card:
*a big kindly purple octopus with sleepy eyelids wearing eight mismatched hand-knitted socks on its arms, juggling
three sea urchins in a moonlit sea cave pool.* 3D prompt: *a cute chunky purple octopus, round head, sleepy kind eyes,
eight arms each wearing a different colourful knitted sock, hand-painted toon texture, low-poly under 12k triangles,
arms relaxed.* Tide stones (`int_tide_stone_sock`, code-built, 8 recolours): a 1.4 m rounded standing stone `#7a8a96`
with a carved sock pattern inlay in the sock's colour, glow 0.0 → 0.8 when lit; ≤ 120 tris each; image prompt for its
decal: "<style line> A carved sock-pattern relief on a smooth sea stone, eight variants: stripes, dots, zigzag, hearts,
stars, checks, plain, Fair Isle, each glowing softly in its colour" (8 × 256² decals, webp; fallback canvas pattern).
Bestiary: Hoot: "Old Gloop is the only octopus I know who darns." Clover: "Watch which stone glows. That sock's arm
lets go when you bonk it!"

<a id="boss-honksworth"></a>
### Lady Honksworth

`threemills.honksworth` · bout · **74 + 8 per Warden calmed** · dungeon 4 the Granary Vaults, the gear hall under
Middle Mill ([dungeons#d4](./dungeons.md#d4)) · title "Her Honkship, Warden of Tumble Hill" · S-147. A very large,
very proud goose who flapped the mill sails by hand so nobody went hungry.

**Arena.** Square 24 × 24 m, straw floor, the north wall one giant wooden **gear wall** (the bonk target), hay bales
(push-blocks) in the four corners, four **hookblooms** on the rafters 5 m up (the Thistle Hook is found in this
dungeon).

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `honk` | rears back, beak open, a ring of light at her feet, a long inhale | ring 7 m/s to r 12, height 0.3: hop it | 0.7 | ~1.7 | - | 35 / 25 |
| `charge` | lowers her neck, wings out, stripe locks 0.4 s before | stripe to the far wall | 0.8 | 9 m/s | into the gear wall: **bonk, stunned 1.5 s gold** (hay drops cosmetically); into another wall 0.8 s | 40 / 35 |
| `feathers` | fluffs up, rustle | fan × 5 (7 in P2) | 0.6 | 8 m/s | - | 25 / 20 |
| `doublehonk` (P2) | two inhales | two rings 0.6 s apart | 0.7 | - | - | 0 / 20 |

The Hook: from a rafter hookbloom Pip can drop on her during a `charge` wind-up → she flinches and charges the gear
wall regardless of where Pip was (a guaranteed bonk). P2 at 50 %: `speedK` 1.4, cool 1.2-2.0 s.

**Handover.** "HONK! ...Honk. Oh, goodness. Do excuse me." / "The mills stopped, so I flapped the sails myself. Day and
night. Someone had to. One cannot have a hungry Haybury." / "Light the sun-lamp, dear child. And do address me as Your
Honkship. I have earned it this week." Reward: `Kindle · Beacon` (the granary's sun-lamp).

**After.** On Tumble Hill by Middle Mill; hosts the Harvest Festival; runs [act-harvest-cut](./side-content.md#act-harvest-cut);
owner of [ss-27 Your Honkship](./side-content.md#ss-27). Talk: "Your Honkship. Yes. Thank you. Carry on." **Plushie**
`plush_honksworth` · 100 · "Comes with a removable bonnet. Do not remove the bonnet." · got "A Lady Honksworth plushie!
It honks if you squeeze it~". **Rematch** 113 HP, 60 gems. **Dream:** [goslings copy her](#dream-honksworth).

**ART BRIEF.** Silhouette: a huge round white goose, long proud neck, a frilled lilac bonnet tied with a pink ribbon
bow. 3.2 m to the bonnet top. Palette feathers `#f7f4ee`, shade `#d8d4cc`, beak and feet `#f2a03d`, bonnet `#b79ad8`,
ribbon `#e86a8a`, eyes `#2a2440`. Materials toon, bonnet frill as a ruffled torus. Animation: strut, rear and honk
(neck stretch 1.3×), charge, bonk wobble with bonnet askew, feather fluff. Poly 5,000 / 12,000. Card: *a very large,
very proud white goose wearing a frilly lilac bonnet with a pink ribbon, mid-honk, in a granary full of golden hay
and wooden gears.* 3D prompt: *a cute chunky giant white goose with a long proud neck, frilly lilac bonnet with a pink
bow, orange beak and feet, hand-painted toon texture, low-poly under 12k triangles, standing proudly.* Bestiary: Hoot:
"Lady Honksworth outranks me. She has told me so." Clover: "Hop the honk! Then make her charge the big gear."

<a id="boss-wickwork-moth"></a>
### The Wickwork Moth

`duskwick.wickwork` · bout · **120 HP** (act closer: second escalation at 33 %) · dungeon 5 the Lamplighters' Tower, the lamp room on floor 5
([dungeons#d5](./dungeons.md#d5)) · title "Brass Keeper of the Great Lamp" · S-164. A brass-and-paper Lamplighter
automaton still following its two instructions; it locked the Tower from inside when the keepers stopped coming.

**Arena.** Round, r 11 m, glass walls with the sea beyond, the **great lamp** in the centre (a brass cage pillar r 1.5
m, 3 m tall). The lamp is cover: it casts a **cream shadow wedge** away from the Moth whenever a beam is live. The
Moth flies 3-6 m up and circles at 4 m/s between moves.

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `lens` | its lens brightens with a rising whirr; the sweep lane and its arc arrow draw | beam 0.5 m high sweeping 120° over 1.6 s: hop it as it passes, or stand in the lamp's shadow wedge | 0.8 | 1.6 | - | 40 / 30 |
| `gust` | wings fold back, paper rustle, chevrons draw | zone 6 × 11 m from the Moth: push 4 m/s for 1.5 s, **no damage**; never pushes toward an open hazard | 0.8 | 1.5 | - | 25 / 20 |
| `dive` | climbs to 6 m with a ticking that speeds up; a stripe from it through Pip's spot to the lamp | stripe 2.2 m wide (it always lines up so the lamp is behind Pip) | 1.0 | 12 m/s | a miss crashes it into the lamp's cage: **stuck 2.0 s gold** | 35 / 30 |
| `combo` (P2) | gust chevrons, then the dive ticking | gust then dive (2 threats) | 0.8 + 1.0 | - | as dive | 0 / 20 |

**The Sunglass** (found on floor 3): holding its beam on the Moth's lens for 0.5 s during a `lens` wind-up dazzles it:
the beam is cancelled, it spins down to 2 m, **1.5 s gold**. P2 at 50 %: its chest plate swings open showing the gears
(cosmetic), `lens` sweeps there and back (2 × 120°, 3.2 s), cool 1.2-2.0 s.

**P3 at 33 % (arena change `shutters`).** A ratchet clank and the eight window shutters round the lamp floor swing open
over 2 s (drawn: a gold edge along each open window first). Sea light pours in and two brass **rail mirrors** at 90° and
270° throw two **mirror beams** across the floor: each a 0.5 m-high lane, 22 m long, turning slowly round the lamp at
15°/s (one lingering hazard, so it counts as one threat; hop it or stand in the lamp's shadow wedge, which now also
falls away from each mirror). The table becomes `lens` 35, `dive` 40, `gust` 25 (no `combo` while the mirror beams
live, so live threats stay ≤ 2); cool × 0.85. The Sunglass gains a use: holding it on a rail mirror for 0.5 s turns that
mirror's beam onto the Moth, dazzling it like the lens (1.5 s gold), once per mirror per 10 s.

**Handover.** "Tick. Tick. Keeper... not present. Lamp... guarded." / "Instruction one: keep the lamp lit. Instruction
two: let no one by but a Lamplighter. ...You carry her light. Instruction two: satisfied." / "Proceed, Lamplighter.
Tick." Reward: a **heart container** held out in its brass claws (CANON §8.1); then `Kindle · the Great Lamp`
([story#ch12](./story.md#ch12)). It sits down in the lamp room; Granny Wick rewinds it in the epilogue of ch12.

**After.** Perches on the lamp room's rail and polishes the lens. Talk: "Tick. Lamp: lit. Keeper: present. Moth:
content. Tick." **Plushie** `plush_wickwork` · 100 · "Wind-up key not included. Purrs anyway." · got "A Wickwork Moth
plushie! Tick, tick, mrrow~". **Rematch** 150 HP, 60 gems. **Dream:** [mirrored beams](#dream-wickwork).

**ART BRIEF.** Silhouette: a round brass body with a big single lens for a face, two pairs of broad paper wings on
brass ribs, six thin legs, a wind-up key on its back. 4 m wingspan, body 1.6 m. Palette brass `#c9a14a`, dark brass
`#8a6a2a`, paper `#f4ead2`, ink spirals on the wings `#3b3244` (the Spiral, the Lamplighters' sign), lens glow
`#ffd98a`, key `#b9853f`. Materials: toon metal with a specular band, paper wings alpha 0.95 with painted spirals
(generated 512² texture, canvas fallback draws the spiral). Animation: hover wing beat 3 Hz, lens whirr, dive, stuck
shudder with steam puffs, dazzled spin. Poly 5,000 / 12,000. Card: *a gentle brass-and-paper clockwork moth with one
big glowing lens for a face and paper wings painted with ink spirals, hovering beside a great lighthouse lamp.* 3D
prompt: *a cute chunky clockwork moth automaton, round brass body, one big round glowing lens face, four broad paper
wings on brass ribs with ink spiral patterns, wind-up key on its back, hand-painted toon texture, low-poly under 12k
triangles.* Bestiary: Hoot: "The Wickwork Moth runs on springs and good manners." Clover: "Make it dive at you, then
step aside. It bonks the lamp!"

<a id="boss-lumbra"></a>
### Lumbra the Long

`rootdeep.lumbra` · bout · **128 HP** (opens Act III: second escalation at 33 %) · dungeon 6 the Rootdeep Heart, the bottom chamber
([dungeons#d6](./dungeons.md#d6)) · title "Root-Keeper of the Rootdeep" · S-185. A 14 m earthworm in tiny glasses who
has been rushing round the dimmed roots trying to keep them warm.

**Arena.** Round, r 18 m; **six holes** (r 1.2 m) at radius 9 m, at 0°, 60°, ... 300°; each hole has a ring of
**soft earth** (Digging Paws, found in this dungeon); the glowing Heart root (r 2 m) in the centre. Up to 9 m of her
shows at once.

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `surface` | one hole's dirt shakes, a positional rumble (sound first) | ring r 1.6 on the hole | 0.9 | burst 0.3 | - | forced before every other move |
| `arc` | she leans toward another hole; the lane between the two holes draws | stripe hole-to-hole, 2.2 m wide; damage only while she lands (0.6 s) | 0.8 | 0.6 | her middle stays arched over the floor, glasses slipping: **2.5 s gold** | 50 / 40 |
| `spray` | she shakes her head, clods gather | fan × 5 (7 in P2), 8 m/s | 0.6 | - | - | 50 / 40 |
| `doublearc` (P2) | as arc, the second lane drawn as the first ends | two arcs in a row | 0.8 + 0.6 | - | after the second arc: 2.5 s gold | 0 / 20 |

**The Paws.** While she is up at a hole after a `spray`, `[E] Dig · Soft earth` on that hole's rim (1.0 s dig) pops
her fully out, wobbling: **2.0 s gold**. P2 at 50 %: cool 1.0-1.8 s, `surface` tell stays 0.9 s.

**P3 at 33 % (arena change `holes`).** She burrows under for 3 s (a long rumble circling the ring; no threat). Holes 2
(60°) and 5 (240°) **collapse**, filling with loose soil (they become plain soft earth, a dig there finds 5 gems once);
two **new holes** open at radius 13 m at 150° and 330°, each drawn as a shaking dirt ring 2 s before it opens. Arcs
between a ring hole and a new outer hole are longer (lanes up to 15 m) and the middle stays up **3.0 s gold** after them.
Table: `arc` 45, `spray` 35, `doublearc` 20; cool × 0.85.

**Handover.** "Oh dear, oh dear. My glasses. Has anyone seen my... ah. Thank you, dear." / "The roots went dim and I've
been rushing round all of them, trying to keep them warm. I didn't mean to block the way. I just couldn't stop." /
"Go on, little lamp. After this, I'll carry you anywhere the roots go." Reward: the Heart relights; root-gates open
([story#ch13](./story.md#ch13)).

**After.** Ferries Pip between root-gates (the root-gate fast travel uses her as its ride; prompt `Enter · Root-gate`,
no new verb). Owner of [ss-32 Lumbra's Itch](./side-content.md#ss-32). Talk: "Hold on to the third band. That's the
comfy one." **Plushie** `plush_lumbra` · 100 · "Fourteen metres of cuddle, folded small." · got "A Lumbra plushie! The
glasses are stitched on, so they never fall off~". **Rematch** 160 HP, 60 gems. **Dream:** [moving holes](#dream-lumbra).

**ART BRIEF.** Silhouette: a long soft segmented worm with a rounded head, tiny round wire glasses and a kind smile.
Length 14 m, body 1.1 m thick. Palette skin `#c98b7d`, bands `#b0706a`, belly `#e8b5a8`, glasses wire `#3b3540`,
lenses `#cfefff`, cheeks `#e8807a`. Materials toon, segments as 24 spheres on a spline, glasses as two torus rings.
Animation: spline wave, burst, arc, head shake, glasses slip and catch. Poly 6,000 / 12,000. Card: *a very long gentle
pink-brown earthworm wearing tiny round glasses, smiling kindly, curving through glowing roots in a warm underground
cavern.* 3D prompt: *a cute chunky giant earthworm, soft pink-brown segments, rounded head, tiny round wire glasses,
kind smile, hand-painted toon texture, low-poly under 12k triangles, body in a gentle S-curve.* Bestiary: Hoot:
"Lumbra the Long. Measured her twice. Got two different answers. Both very long." Clover: "After she jumps hole to
hole, her middle stays up. Bonk it!"

<a id="boss-pelagia"></a>
### Pelagia

`glassway.pelagia` · **wits** · no HP · dungeon 7 the Sunken Bell, the chapel floor (raised with the Tide Bell)
([dungeons#d7](./dungeons.md#d7)) · title "Silent Warden of the Sunken Bell" · S-211. An ancient sea turtle, young
Shellby's best friend, who has kept the bell silent because the last time it rang the Ladder broke.

**Arena.** Round chapel floor, r 10 m, ankle-deep water on the outer 2 m (cosmetic). Pelagia lies on the north side
with a bronze bell on her shell. **Three chapel bells** stand on posts 4 m from the centre at 210°, 270° and 330°
(west, south, east of Pip's start). Each is struck with the sword (any swing, `[E] Ring · Bell` also works):

| Bell | Pitch | Colour | Shape on the bell and above it |
|---|---|---|---|
| Low | G3 | teal `#3fa7a0` | a shell |
| Mid | C4 | gold `#f2c14e` | a star |
| High | E4 | coral `#ff8f7a` | a moon |

**The duel.** Three rounds. Pelagia rocks and rings her shell bell once per note (0.8 s per note); the matching chapel
bell glows its colour, plays its pitch and floats its shape. Then Pip answers by striking the bells in the same order.
No time limit. `[E] Ring · Pelagia` asks her to play the round again (no cost).

| Round | Sequence |
|---|---|
| 1 | low, high, mid |
| 2 | mid, mid, low, high |
| 3 | high, low, mid, low, high |

A wrong note: she sighs, slaps a flipper on the water, and a **splash disc r 1.5 m draws under Pip with a 0.8 s tell**
(half a heart if he stays; CANON); then she plays the same round again. Wrong notes never end the duel. If Pip goes
dizzy (unlikely) he wakes at the chapel door with the round count kept. Between rounds she says one line: R1 done
"Hm. Lucky."; R2 done "...Not lucky. Again."; R3 done (below).

**Handover.** "...That was the old chapel's call. Nobody has rung it right in a hundred years." / "The last time this
bell rang, the Ladder broke. I thought if it never rang again, nothing else would. Silly old shell." / "Take the
clapper, little one. You ring like Shellby did. Tell him the beach is still there." Reward: the **Stair Stone** (the
bell's clapper). Sets the Bell Duel hook.

**After.** Rests in the raised chapel; hosts [act-bell-duel](./side-content.md#act-bell-duel); with Shellby in
[ss-09 Old Friends](./side-content.md#ss-09). Talk: "Shellby still talks too much, I expect. Good." **Plushie**
`plush_pelagia` · 100 · "A shell to hide in, a bell to ring." · got "A Pelagia plushie! The little bell really
jingles~". **Rematch:** the Bell Duel's first win (5 rounds, sequences of 4-7 notes, defined in side-content) pays the
60 gems and counts in the Rematches row. No Dream.

**ART BRIEF.** Silhouette: a long, low, ancient sea turtle with a high-domed barnacled shell and a bronze bell fixed to
its top. 3 m long, 1.6 m tall. Palette shell `#6e8f6a`, shell plates `#557355`, barnacles `#d8d0bf`, skin `#9db8a0`,
bell `#b9853f`, eyes `#2a2440` with heavy kind lids. Materials toon, shell plates as painted hex decal (generated
512²; canvas fallback draws plates). Animation: breathe, rock-and-ring, flipper slap, slow smile. Poly 5,000 /
12,000. Card: *an ancient gentle sea turtle with a barnacled green shell and a small bronze bell on top, eyes half
closed, resting in a sunken stone chapel with light through the water.* 3D prompt: *a cute chunky ancient sea turtle,
high-domed green shell with barnacles, a small bronze bell mounted on the shell, kind heavy-lidded eyes,
hand-painted toon texture, low-poly under 12k triangles, resting pose.* Bestiary: Hoot: "Pelagia remembers
everything, which she says is a nuisance." Clover: "Listen first. Shell, star, moon!"

<a id="boss-fumarole"></a>
### Lady Fumarole

`kettle.fumarole` · bout · **136 HP** (Act III Warden: second escalation at 33 %) · dungeon 8 the Kettle's Belly, the spout chamber ([dungeons#d8](./dungeons.md#d8)) ·
title "Warden of the Kettle (in a Towel)" · S-231. A giant fire-newt in a bath towel sitting in her bath on the spout
lid, because the Stair Stone fell into the spout and keeps the Kettle simmering instead of boiling over.

**Arena.** Round, r 13 m. Her bath (r 4 m, rim 0.6 m) on the spout lid in the centre; **six steam vents** in the floor
at radius 8 m; four cold **braziers** against the wall (the Ember Sling, found in room 5, lights them; lit braziers
give the arena a warm glow, cosmetic).

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `flop` | she rises out of the bath with a sizzle and a falling whistle; light pillar | disc r 3.0 on Pip | 1.0 | lands 0.2 | she must re-tie her towel: **1.8 s gold** | 40 / 35 |
| `pebbles` | stirs the bath, pebbles glow | fan × 5 (7 in P2), 8 m/s | 0.6 | - | - | 30 / 25 |
| `steam` | three vents bubble and hiss | circles × 3 r 1.3 at vents (5 in P2, one at Pip's vent-nearest spot) | 1.0 | pillars 1.2 | - | 30 / 25 |
| `doubleflop` (P2) | two rises | two flops, the second disc drawn as the first lands | 1.0 + 0.8 | - | towel slips right off: **2.4 s gold** | 0 / 15 |

**The Sling.** An ember shot that hits her while she is up for a `flop` makes her drop early, flustered, towel
slipping: **2.2 s gold**. P2 at 50 %: `speedK` 1.4, cool 1.2-2.0 s.

**P3 at 33 % (arena change `bath`).** "Ooh, too hot! More water, darling!" She pulls the bath plug the wrong way: the
bath water **rises one step** and overflows. A teal edge line is drawn at r 8 m 2 s ahead, then the floor from the bath
rim to r 8 m floods 0.3 m (wading × 0.62, `wadeK`, KEEP) for the rest of the fight; the three inner vents under the
flood only bubble (harmless), so `steam` uses the three outer vents only (and the one nearest Pip if it is outside the
flood). Her `flop` now lands with a splash ring r 4.5 (the disc grows, the wind stays 1.0 s). Table: `flop` 40,
`pebbles` 25, `steam` 20, `doubleflop` 15; cool × 0.85. Lit braziers now also warm a 2 m dry circle each (four safe
islands on the flooded floor).

**Handover.** "Ooh! Ooh, that's chilly. Is a window open? Fetch me my other towel, darling." / "That stone fell straight
into the spout and keeps the Kettle at a simmer. Pull it out with nowhere for the heat to go, and the whole isle boils
over." / "But you've opened the vents and lit the forges. The heat has somewhere to be now. Here, darling. Mind, it's
warm." Reward: the **Stair Stone**.

**After.** The hottest pool at Soakley's bathhouse, every day ([ss-40](./side-content.md#ss-40)). Talk: "Hotter,
darling. No, hotter. Perfect." **Plushie** `plush_fumarole` · 100 · "Warm to hold. Towel included." · got "A Lady
Fumarole plushie! Still a little toasty~". **Rematch** 170 HP, 60 gems. **Dream:** [rising bath water](#dream-fumarole).

**ART BRIEF.** Silhouette: a big round orange newt sitting upright in a bath, a striped towel round her middle and a
towel turban on her head. 3.4 m sitting. Palette skin `#e66f4f`, belly `#f4c27a`, spots `#ffb347`, towel `#f4f0e6`
with stripes `#8fc7a0`, eyes `#2a2440`, cheeks `#ff8f7a`. Materials toon, skin with a soft wet specular band.
Animation: lounge, rise, flop, towel re-tie (the opening), stir. Poly 5,500 / 12,000. Card: *a big round orange
fire-newt lounging in a steaming bath, wearing a green-striped towel and a towel turban, looking pleased with herself,
in a warm volcanic cave.* 3D prompt: *a cute chunky giant orange newt with yellow spots, sitting upright, wearing a
striped bath towel and a towel turban, hand-painted toon texture, low-poly under 12k triangles.* Bestiary: Hoot: "Lady
Fumarole has never been cold. She says so, often, while cold." Clover: "After she flops she has to fix her towel.
Go!"

<a id="boss-scarabelle"></a>
### Tutor Scarabelle

`saltglass.scarabelle` · **exam** · no HP · dungeon 9 the Buried Academy, the Great Hall
([dungeons#d9](./dungeons.md#d9)) · title "Examiner of the Lamplighter Academy" · S-252 (papers 1-2), S-253 (paper 3,
result). An hourglass beetle who keeps the school standing for students who may yet come; the Stair Stone is the
bell's weight, and she gives it only to someone who passes the final exam.

**Arena.** The Great Hall, 24 × 24 m, a sand floor laid over a **6 × 6 grid of 4 m tiles** (columns A-F west to east,
rows 1-6 north to south), her lectern and a 2 m hourglass on the north side, eight **light receivers** on the walls
(two per wall, at 1.5 m and 3.5 m high), ivy lattices to a gallery (the Ivy Gloves are found in this dungeon). A paper
that goes wrong never fails: a dizzy Pip restarts **that paper**, never the exam. Between papers she turns the
hourglass (3 s) and says "Paper two. Begin when ready." Pip begins by talking to her.

**Paper 1, Dodging** (45 s, the hourglass runs; her sand is the pattern). Fixed script, at most two threats:

| Time (s) | Pattern |
|---|---|
| 0-15 | a sand ring every 2.5 s from the lectern (7 m/s, height 0.3): hop or roll |
| 15-30 | row stripes: a whole tile row (4 m wide, 24 m long) draws 0.8 s, then sand slides across; two rows at once at most, never adjacent |
| 30-45 | falling sand: circles × 3 r 1.2 on tile centres, 1.0 s tell, every 2 s |

Grade by hits taken: A 0-1, B 2-4, C 5 or more. The grade is cosmetic (the certificate in the journal's Items tab
reads it); every grade passes.

**Paper 2, Aiming.** She opens the receivers' shutters two at a time (a bell ding; each stays open 6 s). Pip lights an
open receiver by holding the Sunglass beam on it for 0.5 s. A shutter that closes unlit reopens later. All 8 lit ends
**round 1**. A slow sand ring rolls out every 5 s (one threat) so Pip keeps moving. **Round 2** (her escalation; "Now,
from the gallery."): the shutters close, then open two at a time again for **4.5 s** each and need **0.8 s** of beam;
the four high receivers (3.5 m) can only be seen over the hourglass from the ivy gallery, so Pip climbs; the sand ring
comes every 3.5 s. All 8 lit again ends the paper.

**Length.** Papers 1-3 with the 3 s hourglass turns are built to run **120-180 s** for a careful bot (paper 1 fixed at
45 s, paper 2 about 50-75 s over two rounds, paper 3 about 25-45 s); her "second escalation" is paper 2's round 2 and
her arena change is paper 3's slick-sand floor ([balance](#balance-targets)).

**Paper 3, Puzzle: "What does a Lamplighter do?"** The floor turns to slick sand: once Pip steps in a direction (snapped
to the grid) he slides tile to tile until the next tile is a stone block (`#`) or the wall. Three **answer tiles** stop
him when he enters them: **L** (a lamp glyph), **H** (an open hand), **S** (a stair). The start mat `@` also stops
him. The answer is **light, give, climb**: stand on L, then H, then S. A wrong-order answer tile plays a soft "not yet"
note and does nothing. Holding Use for 1 s anywhere on the grid rings her hand-bell and returns Pip to `@` (no cost).

```
     A B C D E F        (row 1 = north, by the lectern)
  1  . . # . S .
  2  . # . . . .
  3  L . . # . #
  4  . . . . . .
  5  # . H . # .
  6  . . . @ . .        (Pip enters on @, D6)
```

Solution (9 slides, verified by a breadth-first solver; every reachable tile can still reach every answer tile, so it
cannot soft-lock): N → D4, W → A4, N → A3 (**L**); E → C3, S → C5 (**H**); N → C2, E → F2, N → F1, W → E1 (**S**). The
dungeon solver (F21) re-checks this grid as an entity of the boss room.

**Handover.** "Pencils down. ...Well, well. A full paper, and such tidy handwriting." / "My students went home a hundred
years ago. Someone must keep the school standing, in case one comes back. And look. One did." / "The bell's stone is
yours, Lamplighter. You have passed. Mind the bell on your way out." Reward: the **Stair Stone**.

**After.** At her lectern; sets [ss-44 The Exam Retake](./side-content.md#ss-44) (the gossip quiz, a side story) and
offers the **Resit** through Talk ("Resit the final exam?"): paper 1 runs 60 s with tier-2 patterns (double rings,
stripes 0.7 s tells kept ≥ 0.55), paper 2 lights 12 receivers three at a time, paper 3 uses the resit grid below; the
first pass pays 60 gems and counts in the Rematches row. Talk: "Attendance: one. Excellent." **Plushie**
`plush_scarabelle` · 100 · "Comes with a tiny hourglass. Do turn it." · got "A Tutor Scarabelle plushie! She's
marking my stitches~". No Dream.

Resit grid (10 slides; solution N → D5, N → D3, W → C3 (**L**); W → B3, S → B6, E → D6, N → D5 (**H**); S → D6, E → E6,
N → E1 (**S**); soft-lock free):

```
     A B C D E F
  1  . # . . S .
  2  . . . # . .
  3  # . L . . .
  4  . . . . . #
  5  . . # H . .
  6  # . . @ . #
```

**ART BRIEF.** Silhouette: a beetle whose body is pinched in the middle like an hourglass, standing upright, round
spectacles, a small mortarboard with a gold tassel, holding a little hourglass. 2.2 m. Palette shell `#c9873a`, glass
belly panel `#d9eef2` with sand `#e8c98a`, legs `#5a3a2a`, spectacles `#3b3540`, mortarboard `#2f2a3a`, tassel
`#f2c14e`. Materials toon, the waist panel alpha 0.6 with animated sand (a scrolling texture; fallback a plain sand
colour). Animation: lectern tap, turn hourglass, peer over spectacles, nod. Poly 4,500 / 12,000. Card: *a tall
dignified beetle with an hourglass-shaped body full of trickling sand, round spectacles and a tiny mortarboard with a
gold tassel, standing at a lectern in a sandy old school hall.* 3D prompt: *a cute chunky upright beetle teacher,
body shaped like an hourglass with sand inside, round spectacles, tiny graduation cap with gold tassel, holding a
small hourglass, hand-painted toon texture, low-poly under 12k triangles.* Bestiary: Hoot: "Tutor Scarabelle failed
me once. I was not enrolled." Clover: "Lamp, hand, stair. Light, give, climb!"

<a id="boss-mote-chase"></a>
### Mote: the chase

`driftholm.mote` · **chase** · no HP · dungeon 10 the Spiral Stair, the outer stair ([dungeons#d10](./dungeons.md#d10)) ·
card "Mote · The Spiral Stair" (no title) · S-271. Pip never hits Mote (CANON §13). Mote's look, voice and arc are in
[cast#mote](./cast.md#mote).

**Course.** A spiral stair ramp 4 m wide round the rock's outside, climbing 60 m in three **legs** of about 30 s each,
each ending at a landing (a checkpoint). Leg 2 crosses one cloud gap made solid by a Starsong note (the dungeon's
song platforms: the matching colour of cloud stays solid 8 s); leg 3 crosses two.

**Rules.**
- Mote runs ahead at **4.2 m/s**; if the gap is under 8 m he speeds to 5.2 m/s; over 16 m he slows to 3.4 m/s and
  looks back. Pip runs 4.4 and sprints 5.8 (KEEP), so a careful player keeps up without sprinting.
- **Leash 20 m**: over 20 m for **5 s** and the leg restarts at its landing with a soft fade ("Mote waits at the
  turn, then runs again."). Never a fail screen; no hearts lost from a restart.
- Mote is not targetable (lock-on skips him); a swing passes through his cloak with a soft chime.
- HUD: the boss bar becomes a **string of five lanterns**: 5 lit under 6 m, then one fewer per 3.5 m; past 20 m all
  five blink coral and count down the 5 s.

| Hazard | Tell | Shape | Wind | Notes |
|---|---|---|---|---|
| `drop` | a light falls from his cloak with a bell-tinkle | circles r 1.4 on the ramp ahead of Pip, 2 at most | 0.9 | each half a heart |
| `trail` | his cloak sweeps, a coral line across the ramp | stripe across the full 4 m, 1.2 m deep | 0.8 | hop it (feet ≥ 0.30) or wait |

Leg 3 is the hardest: drops and trails alternate with no gap longer than 2 s; never more than two live.

**Lines** (barks, no stop): leg 1 start "Don't follow me!"; leg 1 middle "Go home, little sprout. You have one."; leg
2 start "Why are you still here?"; any restart "...You're still coming?"; leg 3 "Stop. Please. I'm so close." At the
Spiral Arch he turns (CANON): "You saw it, didn't you. In her roots. ...She'd have come with me if it weren't for all
of you." He pulls his Ladder up through the arch. Reward: **Cloudstep** (story beat, [story#ch18](./story.md#ch18)).

**Model (combat-relevant only).** CANON §14: a code-built emissive figure: a capsule body of soft starlight `#fff3c4`, a
hooded cloak shell `#3a3f7a` patched with lilac `#c9b6ec` and stitched `#f7f2ff`, two dot eyes `#2a2440`, an additive
glow sprite `#ffe9a8` (r 1.2 m). 1.1 m tall. Running pose: a float-glide with the cloak streaming (no legs needed).
The full ART BRIEF and portrait are in [cast#mote](./cast.md#mote). **Plushie** `plush_mote` · 100 · stocked after the
main ending · "Glows a little in the dark. Very little. Be patient." · got "A Mote plushie! He's warmer than he looks~".
No rematch, no Dream. Bestiary (counted at the end of the chase): Hoot: "The Lamp Thief. Amended: Mote. Not a thief.
A brother. I have crossed out three pages." Clover: "Keep up with him. You can't bonk him, and you shouldn't."

---

<a id="optional-bosses"></a>
## 9. Optional bosses

<a id="boss-flurry"></a>
### Great-Aunt Flurry

`home.flurry` · bout · **90 HP** · optional dungeon o1 the Snowglobe, under Frostcap ([dungeons#o1](./dungeons.md#o1)) ·
title "Snoozing Matriarch of the Snowglobe" · S-239, with [ss-12 Frostbun's Great-Aunt](./side-content.md#ss-12).
Frostbun's huge aunt, asleep since the big snow, keeping the globe cold so the snowflakes keep.

**Arena.** Round, r 15 m, inside a glass dome (the globe's wall is the bonk); a snow floor with two ice patches
(cosmetic); icicles hang from the dome.

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `avalanche` | she tucks into a giant snowball, a deep rumble, stripe locks 0.4 s before | stripe 3.2 m wide across the dome | 0.9 | 7 m/s | bonks the glass: unrolls dazed **1.6 s gold** | 45 / 35 |
| `icicles` | a huge yawn; icicles crack overhead | circles × 5 r 1.0 (7 in P2) | 1.0 | fall 0.3 | - | 40 / 35 |
| `nap` | at 50 % HP, once: she sits, says "five more minutes", snores | - | - | - | **6 s gold, no shrug** | forced at 50 % |
| `doubleroll` (P2, "cross") | as avalanche, a second stripe drawn as the first roll ends | two rolls | 0.9 + 0.7 | - | after the second: 1.6 s gold | 0 / 30 |

**The Sling.** An ember shot at an icicle during its 1.0 s tell melts it (that circle vanishes). After the nap she
wakes **cross**: `speedK` 1.4, cool 1.0-1.8 s, the P2 table.

**Handover.** "Mmf. Who's poking me? ...Oh. A small one." / "Frostbun sent you? That dear bun. I've been asleep since
the big snow, keeping the globe cold so the snowflakes keep." / "Here. I knitted while I dreamt. It's a scarf. It may
be rather long." Reward: a **heart petal** (CANON §8.1) and the **scarf hood trim** unlock
([art-audio#hood-trims](./art-audio.md#hood-trims)).

**After.** Naps in the Snowglobe, knitting in her sleep. Talk: "Zzz... purl one... zzz." **No plushie** (decided
here: she is not one of the 16). **Rematch** 113 HP, 60 gems. No Dream.

**ART BRIEF.** Silhouette: Frostbun's shape, much larger and rounder, with a long drooping nightcap and knitting
needles. 5.0 m. Palette fur `#f8fbff`, shade `#dfe9f5`, ice crystals `#bfe3ff`, nose `#f5a3b5`, nightcap `#7fa8d8`
with pom `#f8fbff`, scarf stripes `#e0574f` / `#f8fbff`, needles `#c9a87a`. **Fallback model: the `boss_frost` GLB
scaled to 5.0 m with a `#f0f4ff` tint, plus a code-built nightcap (cone + pom sphere) and a scarf ribbon** (allowed:
it reuses an existing GLB without replacing it). Animation: tuck-and-roll (whole-body squash to a sphere), yawn, nap
(slow rise and fall), cross wake. Poly 1,000 extra code / 12,000 GLB. Card: *an enormous fluffy white yeti-bunny
grandmother in a long blue nightcap, dozing with knitting needles and a very long red-and-white scarf, inside a giant
snow globe.* 3D prompt: *a cute chunky enormous fluffy white yeti-bunny, icy crystal ears, long blue nightcap,
holding knitting needles and a long striped scarf, sleepy face, hand-painted toon texture, low-poly under 12k
triangles.* Bestiary: Hoot: "Great-Aunt Flurry: the source of all snow, according to Frostbun. I am not arguing."
Clover: "She naps halfway. Free bonks! Then she's cross."

<a id="boss-bosun-snore"></a>
### Bosun Snore

`glassway.snore` · bout · **80 HP** · optional dungeon o3 the Merry Mabel, the lower deck ([dungeons#o3](./dungeons.md#o3)) ·
title "Sleeping Bosun of the Merry Mabel" · S-214, with [ss-36 The Merry Mabel](./side-content.md#ss-36). A walrus who
ran aground in the last big storm and decided to rest his eyes until the tide came in, two summers ago.

**Arena.** A deck 20 × 12 m tilted **8° to starboard** (down toward the east rail); three dozing **seal deckhands** lie
at fixed spots (4, 0), (−4, 3) and (0, −4) from the deck centre. They are scenery, not enemies: they cannot be hit and
never attack.

| Move | Tell | Shape | Wind | Active | Opening | Weights P1 / P2 |
|---|---|---|---|---|---|---|
| `sleeproll` | a long snort, he rocks twice | stripe from him downhill to the low rail through Pip's line; a seal in the lane shows a gold "!" | 1.0 | 5 m/s | hits the rail: none (he sleeps on); **rolls into a seal**: the seal wakes with a honk and Snore wakes flustered, **2.5 s gold** | 50 / 40 |
| `snore` | an inhale whistle, his moustache lifts | ring 4 m/s to r 8, height 0.5 | 0.9 | - | - | 50 / 35 |
| `doublesnore` (P2) | two inhales | two rings 0.6 s apart | 0.9 | - | - | 0 / 25 |

**Escalation** at 50 %: the deck creaks, lanterns swing for 2 s (warning), and the tilt flips to **8° to port**: rolls
now run west. Pip on the tilted deck slides 0.5 m/s downhill when standing still (decided here; walking cancels it).
Cool 1.2-2.0 s.

**Handover.** "SNRRK... wha? Who's on watch? ...Nobody's on watch." / "We ran aground in the last big storm, and I
thought, I'll just rest my eyes till the tide comes in. That was two summers ago." / "The bell? Take it to that crab
with the hat. A ship's bell ought to ring somewhere." Reward: **the ship's bell** for Captain Pinch (hung at the
lighthouse; Pinch: "Belay my tears, that's a fine bell.").

**After.** Awake at last, mending the Mabel with his deckhands. Talk: "Tide's in. Well. Tide was in. Some time ago."
**No plushie** (decided here). **Rematch** 100 HP (1.25 × 80), 60 gems, the deck tilts as before. No Dream.

**ART BRIEF.** Silhouette: a huge round walrus lying on his side, big white moustache whiskers, two tusks, a navy
bosun's cap with a gold rope band, a bosun's whistle on a cord. 3.0 m long, 1.8 m tall. Palette skin `#8b6a55`, shade
`#a8866e`, tusks and whiskers `#f3ead8`, cap `#2c3e63`, band `#f2c14e`, whistle `#c9a14a`, eyes `#2a2440` (closed
arcs). Materials toon. Animation: breathe, snort-and-rock, roll (whole-body tumble), flustered sit-up. Poly 5,000 /
12,000. Card: *a huge round sleepy walrus in a navy bosun's cap with a gold band, white moustache, snoring on a tilted
old ship's deck with three little seals dozing nearby.* 3D prompt: *a cute chunky giant walrus sailor, navy bosun's
cap with gold rope band, white whiskers, two tusks, whistle on a cord, eyes closed sleeping, lying on its side,
hand-painted toon texture, low-poly under 12k triangles.* Seal deckhands: `seal_deckhand` 1.0 m, grey `#9aa4ad`, belly
`#d8dde2`, a striped knitted hat `#2f7d8c` / `#f3e6c8`; 500 tris, three instances. Bestiary: Hoot: "Bosun Snore has
slept through two storms and a tea party. Mine." Clover: "Make him roll into a seal. They wake him up!"

---

<a id="finale"></a>
## 10. The finale: the Second Sneeze

`crown.sneeze` · **catch** · no HP · the Crown (Wenna's canopy, 128 m interior-scale realm, [atlas-far#crown](./atlas-far.md#crown))
· chapter 21 ([story#ch21](./story.md#ch21)) · S-284 (part 1), S-285 (part 2), S-286 (part 3 with the lantern chain).
**Mote is never hit**, and nothing in the finale can fail (CANON §9.3, §13).

**Arena.** The **heart** platform at the top of the trunk (r 6 m) and four **boughs** (N, E, S, W), each a walkable
bough deck 3 m wide and 24 m long rising 2 m toward its tip, with its **bough lantern** (a big glass lantern on a hook,
1.6 m) 18 m out. Boughs join only at the heart. Mote hovers 12 m above the heart at the foot of his Ladder; Wenna's
face is on the trunk below the heart, seen from any bough tip looking back. Falling off a bough: the blossom catches
Pip and sets him back on the heart (no damage).

<a id="finale-1"></a>
### Part 1: Stray Lights (about 2 minutes)

- Borrowed lights fall from Mote's cloak **one every 2.4 s** (every 1.8 s once 12 lanterns' worth are lit), never more
  than **two falling at once**. Each falls for **1.6 s**; its landing spot is drawn the whole time as a circle r 1.2 m
  with a **gold fill and a coral rim** (a catchable thing that would bump Pip if it landed on him: half a heart).
  Lights fall on the bough Pip stands on or a neighbouring one (on the heart: any bough's inner third).
- **Steer:** hold the Sunglass beam on a falling light for **0.3 s**: it turns all gold, stops falling, and drifts
  along its bough into that bough's lantern (from the heart: into the nearest lantern that is not full). Each lantern
  takes **6**; 24 in all.
- An unsteered light lands, makes a little puddle of light for 3 s and floats back up to Mote's cloak. Nothing is
  lost; it falls again later.
- Bar: **"Lanterns lit 0/24"** with four lantern icons that fill by sixes. A full lantern blazes and its bough
  blossoms. Dizzy (only from bumps): Pip wakes on the heart; lit lights stay lit (CANON §13 Always 7).
- Mote's lines while it runs (barks): at 6 "Stop! Those are mine. ...I mean. I borrowed them."; at 12 "Why are you
  putting them in her lanterns?"; at 18 "...She's glowing."; at 24 silence, then the Ladder pulls.

<a id="finale-2"></a>
### Part 2: The Sneeze (about 1 minute)

1. The Ladder tugs; a low rumble; the camera (FP: the view is drawn, input paused 4 s) turns to Wenna's face, which
   **scrunches for 2 s** (the same wind-up as her sleepy face since I.6). She sneezes: a cream push wave (no damage)
   and blossom everywhere.
2. **Three-way cut-in** (3 s): the three Starseeds fly from the pedestal; the Catchers catch them at their corners:
   Grumble "Got it!" / Frostbun "Mine! ...I mean, here." / Pinch "Caught one, lad!" (CANON).
3. **The last spark** (Mote's own light) falls past the crown. Pip stands at the north bough tip; the prompt shows
   `{jump}`. He hops and glides (Leaf Glider, hold Hop): a **12 s glide** down a curve marked by **8 blossom rings**
   (r 2.5 m). Within 6 m of the next ring, steering gets a gentle 30 % pull toward its centre. The spark (r 1.5 m catch
   radius) waits past ring 8.
4. **A miss loops the glide** (fade 0.4 s, back on the bough tip, the spark falls again). Rings are guidance, not
   checkpoints. There is no fail state, no timer and no damage.
5. Caught: "✿ Caught!"; Pip lands on the heart holding the spark (first person: a glowing star in the left hand, the
   sword lowered).

<a id="finale-3"></a>
### Part 3: Given Light (about 3 minutes, no pressure)

- Mote lands on the heart. `[E] Give · Lantern` (Give is a charter verb). Pip gives the Lantern's light and the
  spark. No attacks, no enemies, nothing can hurt Pip; the only inputs are walking, looking and the one Give.
- The **save-built lantern chain** ([story#lantern-chain](./story.md#lantern-chain)) brings everyone Pip helped along
  the boughs with one lantern each; the Ladder rebuilds in gold; the goodbye lines and the main ending card are in
  story.md. The eighth crown lantern lights.
- Test (S-286): a scripted run reaches the card; a run that misses the spark twice still reaches it; HP never drops
  in part 3.

---

<a id="dreams"></a>
## 11. Guardian Dreams (post-game, ten)

CANON §9.2; steps S-292 (framework + Grumble), S-293 (Pinch, Frostbun, Rollo), S-294 (Mossmantle, Gloop, Honksworth),
S-295 (Wickwork Moth, Lumbra, Fumarole + [ss-51 Dream a Little](./side-content.md#ss-51)).

<a id="dream-framework"></a>
### The framework

- **Realm kind** `dream`, ids `dream_<short>`, built by the dungeon recipe on a **96 m** grid: the boss's own arena
  (same radius and features) remade in pastel at the centre, the rest a soft cloud floor with giant flowers and
  floating stepping stones (decoration only, no colliders beyond the arena edge, which is a ring of pastel vines).
  Fog 40-120 m, the boss's palette swapped for the dream palette below.
- **Entry:** after the main ending (flag `ch21`; the flag name is owned by [systems#conditions](./systems.md#conditions)),
  a **dream pillow** (a 0.6 m pastel cloud pillow, prop `dream_pillow`) lies beside each of the ten bosses where it
  naps (its after spot). `[E] Dream · <Name>` (Dream is a charter verb). Card: "Grumble Shroom's Dream".
- **Fight:** the boss's def with `dream.twist` applied as a hook in the move runner; HP = its **Dream table HP** (decision 20); enraged
  from 75 %; every telegraph rule still holds (a twist may make things faster or add a source, never shorten a tell
  below 0.55 s, never put three threats live).
- **Win:** the dream boss yawns ("What a nice dream."), and Pip wakes beside the pillow. **First clear: 60 gems and the
  dream plushie variant** (`plush_dream_<short>`: the boss's plushie in a pastel nightcap, set on the Nook's plushie
  shelf; it counts in the **Dreams** row, not the Plushies row). Repeat clears give nothing and change nothing.
- **Dizzy:** Pip wakes beside the pillow ("What a funny dream."). No loss.
- Music: the boss's fight theme at 0.85 × tempo with a music-box lead ([art-audio#music](./art-audio.md#music)).
- `S.dreams = { <short>: true }` for first clears (save shape in [systems#save-plan](./systems.md#save-plan)).

| Dream | Id | Twist (rule) | Palette | Boss HP | Step |
|---|---|---|---|---|---|
| <a id="dream-grumble"></a>Grumble Shroom | `dream_grumble` | **Rings roll inward**: every stomp ring starts at the arena wall (r 14) and closes to the centre at 6.5 m/s (× 1.2 enraged); its light wall is drawn at the wall 0.6 s before it moves; the enraged echo ring also comes inward, 0.6 s later | lavender `#d9c8f0`, mint `#c8f0dc`, butter `#fff1b8` | 60 | S-292 |
| <a id="dream-pinch"></a>Captain Pinch | `dream_pinch` | **A tilting deck**: the arena is a ship deck 28 × 16 m tilting ±8° on a 6 s sine; a swinging lantern and a HUD tilt arrow lead the tilt by 1 s; Pip standing still slides 0.8 m/s downhill; Pinch's charge runs × 1.25 downhill and × 0.8 uphill; bubbles drift 1 m/s downhill | peach `#ffd6c2`, sky `#c8e4ff`, cream `#fff6e0` | 60 | S-293 |
| <a id="dream-frostbun"></a>Frostbun | `dream_frostbun` | **Ice floor**: Pip's accel 38 → 9 m/s² and decel 30 → 4; a roll keeps its momentum; sliding into the wall is harmless; Frostbun's belly slide lasts until a wall (no 1.4 s cap) | ice pink `#f8d8e8`, pale blue `#d8ecff`, snow `#fbfbff` | 63 | S-293 |
| <a id="dream-rollo"></a>Sir Rollo | `dream_rollo` | **Two Rollos**, 30 HP each, one shared attack token (only one rolls at a time); four pit-plates; each sulks once at half its own HP; both must be calmed | lilac-blue `#c8d4f0`, apricot `#ffe0c0`, cream `#fff8e8` | 2 × 30 | S-293 |
| <a id="dream-mossmantle"></a>Mossmantle | `dream_mossmantle` | **Half speed except Pip**: every boss and projectile time × 2 (so every tell ≥ 1.1 s), but he runs two moves at once (two threats live) and dozes only 1.5 s | moss `#d0ecc0`, peach `#ffe4cc`, sky `#e0ecff` | 85 | S-294 |
| <a id="dream-gloop"></a>Old Gloop | `dream_gloop` | **Eight arms, one tell each**: eight floating arms round the wall (r 12), each in its sock with its own glow and its own pitch (0.8 s tell), each still holding its tide stone; the lit stone is shown **only by its pitch** (no glow: listen for it; the HUD swatch is the deaf-friendly twin); at most two arms active at once; Gloop in the pool only juggles (a returned urchin still flops the lit arm 2.0 s) | lilac `#e4d4f8`, aqua `#ccf4f0`, pink `#ffd8e8` | "Arms let go 0/8", two lit at once | S-294 |
| <a id="dream-honksworth"></a>Lady Honksworth | `dream_honksworth` | **Goslings copy her moves late**: three goslings (unhittable, giggling) take turns copying each move 1.0 s later, smaller (HONK ring r 6, charge 5 m, fan of 3); one gosling at a time, so live threats stay ≤ 2 | butter `#fff0b8`, rose `#ffd0dc`, mint `#d8f4e0` | 85 | S-294 |
| <a id="dream-wickwork"></a>The Wickwork Moth | `dream_wickwork` | **Mirrored beams**: every lens sweep has a mirror sweep reflected across the arena's centre line, drawn at the same moment (the two count as its two threats, so no gust or dive overlaps a sweep); two mirror pillars (r 1.0) add shadow wedges | brass `#f4e0b0`, sky `#d8e8ff`, paper `#fffaf0` | 90 | S-295 |
| <a id="dream-lumbra"></a>Lumbra the Long | `dream_lumbra` | **Holes move**: the six holes drift round the ring at 1.2 m/s, each a moving dirt mound with its own soft chime; a hole stops moving for its 0.9 s surface tell | rose `#f8d0d0`, sand `#f8ecd0`, lilac `#e0d8f8` | 95 | S-295 |
| <a id="dream-fumarole"></a>Lady Fumarole | `dream_fumarole` | **Rising bath water**: at 75 %, 50 % and 25 % HP the floor floods one ring further in (outer ring first), announced 2 s ahead by bubbles and a teal edge line; flooded floor slows Pip × 0.62 (`wadeK`, KEEP); four dry islands r 2.5 remain at the end | coral `#ffd8c8`, mint `#d0f0e0`, cream `#fff4e0` | 105 | S-295 |

Dream plushie variants need no new model: the plushie icon gets a nightcap overlay and a pastel tint (canvas
fallback). The dream versions of the bosses are the same rigs with a pastel material tint toward the dream's first
palette colour (35 % lerp) and a floating "z" sprite.

---

<a id="boss-jamboree"></a>
## 12. The Three Corners Jamboree

`o4.jamboree` · bout (tag-team) · floor 10 of the Hundred Lamps ([dungeons#o4](./dungeons.md#o4)) · S-299, with
[ss-50](./side-content.md#ss-50). The three Catchers, rested and wide awake, in a row "on one set of hearts" (CANON
§9.2).

**Arena.** Round, r 16 m, three **corner alcoves** at 90°, 210° and 330° (a glowing fairy ring for Grumble, a stretch
of lighthouse rail for Pinch, a snowdrift for Frostbun), where each Catcher waits and cheers when not fighting.

**Rules.**
- One set of hearts: no heal between Catchers; drops are off; potions from the belt work as usual.
- **Order: Grumble Shroom → Captain Pinch → Frostbun.** Each uses his KEEP move list and numbers with **first-fight HP
  (48 / 48 / 50)**, enraged from **75 %**, cool × 0.85. Calming one: he hops back to his alcove (3 s, no threats),
  the next jumps in with a small name card (1.5 s, no camera intro).
- **Finale, "Three Corners"** (30 s): all three step out; they take turns, one move each in rotation (cool 1.0 s; the
  only overlap is Grumble's echo ring, still ≤ 2 threats). The bar reads **"Jamboree!"** and fills over the 30 s. It
  ends with all three sitting down, dizzy and laughing.
- Dizzy: Pip wakes at floor 10's landing; the Jamboree restarts from Grumble.
- Lines: start: Grumble "Hmph. Three of us. That's fair." / Pinch "Ahoy! No holdin' back this time, lad." / Frostbun
  "Brrr. Jamboree. Fun." End: Grumble "...Fine. FINE. That was fun." / Pinch "Three cheers for the little skipper!" /
  Frostbun "Again. Tomorrow. Promise?"
- **Reward (first clear):** the **Three Corners hood trim** (`trim_corners`, [art-audio#hood-trims](./art-audio.md#hood-trims))
  and completion of ss-50. No gems from the fight itself (the side story pays). Replays always open, no reward.
- Balance: careful bot with Starsteel and 14 hearts wins ≥ 90 % in 150-240 s losing ≤ 6 hearts; never-dodging ≤ 30 %.

---

<a id="balance"></a>
## 13. Balance and tests

<a id="balance-targets"></a>
### Targets

Bots are the WP5 round-3 set (careful: reads every tell, hits in openings; casual: reacts 0.25 s late; never-dodging:
mashes). Careful ≥ 90 % wins losing **≤ 3 hearts**; never-dodging ≤ 50 % and never downed before 15 s. The time
window is **split by weight of the fight** (playtime review; widens CANON §9.1's single 45-90 s): Sir Rollo keeps
**45-90 s**; the Act II Wardens **60-120 s**; the **act closers and Act III Wardens** (the Wickwork Moth closing Act
II, Lumbra opening Act III, Lady Fumarole, and Tutor Scarabelle's three papers combined) **120-180 s**, each bout with
its second escalation at 33 % and its arena change. The Catchers keep their LOCKED targets (25-60 s, ≤ 2 HP). Each
balance test fixes the loadout a player is expected to have at that point:

| Encounter | Hearts | Sword | Tools in hand | Careful time |
|---|---|---|---|---|
| Sir Rollo | 4 | wooden | Lantern | 45-90 s |
| Mossmantle / Honksworth (74, 82, 90) | 5 | Shiny | Lantern + own tool | 60-120 s, at 90 HP too |
| Old Gloop (8 arms; 2.5 / 2.2 / 1.9 s windows) | 5 | Shiny | Lantern + Tide Bell | 60-120 s at every window |
| Wickwork Moth (120 HP; 2nd escalation 33 %, shutters open) | 6 | Shiny | + Sunglass | 120-180 s |
| Lumbra (128 HP; 2nd escalation 33 %, holes move) | 7 | Shiny | + Paws | 120-180 s |
| Lady Fumarole (136 HP; 2nd escalation 33 %, bath rises) | 8 | Shiny | + Sling | 120-180 s |
| Tutor Scarabelle (papers 1-3 combined) | 8 | Shiny | + Sunglass, Gloves | 120-180 s |
| Great-Aunt Flurry | 8 | Shiny | + Sling | 60-120 s (optional) |
| Bosun Snore | 8 | Shiny | + Hook, Tide Bell | 60-120 s (optional) |
| Rematches | as above + 2 | Shiny | same | ≤ 1.3 × the first fight |
| Dreams | 12 | Starsteel | all | 60-120 s |
| Jamboree | 14 | Starsteel | all | 150-240 s |

Each bout also passes with the **wooden sword** for a careful bot in ≤ 180 s, or ≤ 300 s for the 120-180 s
encounters (nothing requires a sword upgrade).

<a id="tests"></a>
### What the tests assert

- **Unit (`tests/creatures.test.js`, S-040 onward):** every `ENEMY` entry names a registered archetype; its HP sits in
  its land's band (section 1); its params sit in the archetype's allowed range; computed lead (first warning to first
  damage) ≥ 0.55 s; every species has `card`, `lore`, `tip`, `realm`. Every boss def: each damaging move has `wind ≥
  0.55` and `threats ≤ 2`; at least one move has `open > 0` without a tool; `hp(def, S)` gives 74 / 82 / 90 across the
  Warden group in all six orders; plushie price 100 (new) or 80 (KEEP); rematch gems 60 (new) or 40 (KEEP). Spawn
  tables: town regions `max 0`; every `max ≤ 7`; every id in an atlas region list exists in `ENEMY` (and the reverse
  for this file's table).
- **In-page, per species:** spawn, see the telegraph drawn ≥ 0.55 s before the first damage frame, poof at 0 HP,
  bestiary count +1. Ghosts: a swing whiffs unlit and lands lit. Mimics: never in a chest slot (map check). Gullgrab:
  gems return on despawn.
- **In-page, per boss:** intro card text, each move fires through `G.debug.actors.boss(name)`, the gold opening sets
  `boss.opening`, the escalation at `enrageAt` (and, where set, the second at `enrageAt2` with its arena change),
  the handover's three lines and reward, the Talk prompt after, the
  rematch HP. Wits: correct round passes, a wrong note draws the 0.8 s splash and repeats the round. Exam: each paper
  completes; a dizzy restarts only that paper; the two grids pass a breadth-first solver. Chase: a bot that stays close
  finishes; a bot that stops triggers the 5 s countdown and a leg restart, never a fail screen.
- **Finale:** 24 steers end part 1; a missed spark loops; part 3 takes no damage.
- **Dreams:** each twist hook is active (ring direction inward, deck tilt angle, floor friction, two Rollos, time × 2,
  eight arms, gosling echoes, mirror beam, moving holes, flood stages) and first-clear rewards are given once.

---

<a id="asset-index"></a>
## 14. Asset index (this file's keys)

All keys carry a `realm` tag; every one has a procedural or canvas fallback (rig, tinted blob card, initials
portrait). Sizes: cards 384² webp ≤ 45 KB; portraits 3-frame strips 1536 × 512 webp ≤ 120 KB (sliced to 512²);
plushie icons 128² into the shared icon atlas. Generated through a GPT Sol subagent with Codex's image tool (or a
Gemini model), processed with `tools/export_sprites.py` / `tools/process_strip.py`. Owner GLBs are optional drop-ins.

| Realm bundle | Models (code rig now, GLB later) | Cards | Portraits | Icons |
|---|---|---|---|---|
| `home` | `dimling`, `boss_rollo`, `boss_flurry` (falls back to `boss_frost` scaled), `dream_pillow` | `card_dimling`, `card_boss_rollo`, `card_boss_flurry`, the 9 shipped (`card_slime` ... `card_boss_frostbun`) | `portrait_rollo`, `portrait_flurry` | `plush_rollo`, `plush_dream_*` overlays |
| `duskwick` | `sizzle_beetle`, `coco_clonk`, `boss_wickwork` | 2 + `card_boss_wickwork` | `portrait_wickwork` | `plush_wickwork` |
| `pinewhistle` | `mossling`, `pinecone_puff` (+ `pinelet`), `bark_beetle`, `needle_wasp`, `boss_mossmantle` | 4 + 1 | `portrait_mossmantle` | `plush_mossmantle` |
| `archwater` | `tidepool_jelly`, `squirt_urchin`, `sand_snapper`, `boss_gloop` | 3 + 1 | `portrait_gloop` | `plush_gloop` |
| `threemills` | `field_vole`, `scarecrowlet`, `woolly_ram`, `boss_honksworth` | 3 + 1 | `portrait_honksworth` | `plush_honksworth` |
| `rootdeep` | `glow_grub`, `drip_bat`, `pebble_mimic`, `boss_lumbra` | 3 + 1 | `portrait_lumbra` | `plush_lumbra` |
| `glassway` | `bubble_puffer`, `gullgrab`, `boss_pelagia`, `boss_snore`, `seal_deckhand` | 2 + 2 | `portrait_pelagia`, `portrait_snore` | `plush_pelagia` |
| `kettle` | `soot_snuffle`, `steam_puff`, `ash_moth`, `boss_fumarole` | 3 + 1 | `portrait_fumarole` | `plush_fumarole` |
| `saltglass` | `sandsnoot`, `prickle_pear`, `sun_beetle`, `dust_puff`, `boss_scarabelle` | 4 + 1 | `portrait_scarabelle` | `plush_scarabelle` |
| `driftholm` | `nimbus_puff`, `gust_kite`, Mote's rig (owned by [cast#mote](./cast.md#mote)) | 2 + `card_boss_mote` | (cast) | `plush_mote` |
| `starmeadow` | `stardust_sprite`, `comet_pup`, `moonbeam_turret`, `wisp_lantern` | 4 | - | - |
| `moonmere` | `hushling` (silver variants are material swaps) | 1 | - | - |

Bundle cost: about 3-6 cards (≤ 270 KB) and 1-2 portraits (≤ 240 KB) per realm, well inside the 2.5 MB realm budget.
Owner GLB briefs from this file (32 species, 12 new bosses, `seal_deckhand`, `dream_pillow`) are indexed in
[art-audio](./art-audio.md#brief-template).

---

<a id="decisions"></a>
## Decisions made here

1. **Boss ids** are `<land>.<name>`: `home.rollo`, `pinewhistle.mossmantle`, `archwater.gloop`,
   `threemills.honksworth`, `duskwick.wickwork`, `rootdeep.lumbra`, `glassway.pelagia`, `kettle.fumarole`,
   `saltglass.scarabelle`, `driftholm.mote`, `home.flurry`, `glassway.snore`, `crown.sneeze`, `o4.jamboree`; the three
   Catchers keep `woods`, `shores`, `peaks`. systems.md's save plan should use these keys.
2. **Enemy HP** per species as listed (Dimling 2; Act II 3-5; Act III 4-7; Act IV 5-7 within CANON's 5-8). Swarms'
   bands apply to the whole group (voles 4 × 1, sprites 5 × 1).
3. **Gem tiers** for drops: tier 1 in the Interlude and Act II lands, tier 2 in Act III lands and Moonmere, tier 3 in
   the Starmeadow; mimics always drop 5.
4. **Pattern tiers** (section 2) are how later lands get harder; the menu per archetype is defined here.
5. **Glassway Sandbars** also roll the home **Snippy Crab** (weight 2), giving the Glassway three species; the
   Gullgrab can appear while sailing (max 2).
6. **Brightwell's Rest** in the Starmeadow is a safe zone (Starkin home), added to CANON's town list.
7. **Pinelets** (the Pinecone Puff's children) and the **Moonmere silver variants** are not bestiary entries, keeping
   the count at 38 + 15.
8. **Gullgrab** snatches 3 gems, which always come back (bonk: +2 bonus; despawn: returned with a toast).
9. **Ghost light sources**: the Lantern radius, lit wall-lanterns and braziers (4 m), Moonmere moon-lanterns (5 m), the
   Starmeadow's lamps (4 m), Glow Grubs (2 m), a Sunglass touch (2 s).
10. **Plushies**: 100 gems for new bosses; **Great-Aunt Flurry and Bosun Snore get no plushie** (CANON's 16 lists
    neither); their rewards are the scarf trim and the ship's bell. Dream plushie variants count in the Dreams row,
    not the Plushies row.
11. **Rematch timing and place**: non-Catcher bosses nap once their handover has played and Pip has left the realm;
    Wake is offered at the boss's after spot and loads its arena if that is elsewhere. Rematch HP uses the full Warden
    value (90 → 113). First rematch win 60 gems (Catchers keep 40).
12. **Pelagia's rematch** is the Bell Duel's first win; **Scarabelle's** is a Resit offered through Talk (harder
    papers, the second grid); both count in the Rematches row (14 in all).
13. **Handover rewards**: Act II Wardens unlock `Kindle · Beacon`; the Wickwork Moth hands over the heart container;
    Act III Wardens hand over the Stair Stones; Rollo opens the bottom chamber; Lumbra relights the Heart.
14. **Boss titles** (name cards) for all twelve new bosses, and every handover line not quoted in CANON.
15. **All arena geometry and numbers** (sizes, holes, boughs, bells, receivers, vents, seal spots) are defined here;
    dungeons.md's boss-room maps must match them.
16. **Pelagia's bell notes** (G3 / C4 / E4, shell / star / moon) and the three round sequences.
17. **Scarabelle's exam**: the three paper scripts, the grade (cosmetic, A/B/C, shown on a certificate in the
    journal's Items tab), the hand-bell reset, and both slide-puzzle grids with their verified solutions.
18. **Mote's chase**: three legs of about 30 s, adaptive speed (3.4 / 4.2 / 5.2 m/s), the lantern-string distance HUD
    and the bark lines.
19. **Finale part 1** numbers: a light every 2.4 s (1.8 s after 12), a 1.6 s fall, a 0.3 s Sunglass lock, 6 per
    lantern; unsteered lights return to the cloak; part 2's glide has 8 rings with a 30 % steering pull.
20. **Dreams**: entered from a **dream pillow** prop beside each napping boss (so the Wake prompt stays unique); Dream
    HP is the value in the Dream table (it no longer equals rematch HP after the boss-weight change, item 25; Dreams
    keep their own 60-120 s target with Starsteel); Rollo's Dream uses two 30-HP Rollos.
21. **Jamboree**: first-fight HP per Catcher, enraged from 75 %, cool × 0.85, a 30 s "Three Corners" finale, the
    Three Corners hood trim, no gems from the fight.
22. **Bosun Snore's tilted deck** slides a standing Pip 0.5 m/s; the three seal deckhands are scenery whose wake-up
    is his opening.
23. **Great-Aunt Flurry's fallback model** reuses the `boss_frost` GLB scaled to 5.0 m (not a replacement).
24. **Bestiary voice**: Hoot's note (lore, often wrong) plus Clover's crayon (the true tip, shown after the first poof).

25. **Boss weight (playtime review).** Balance time windows are split: Rollo 45-90 s; Act II Wardens 60-120 s (Warden HP
    74 / 82 / 90, rematch 113); act closers and Act III Wardens 120-180 s with a second escalation at 33 % and one
    arena change (Wickwork Moth 120 HP / `shutters`, Lumbra 128 / `holes`, Fumarole 136 / `bath`; rematches 150 / 160 /
    170); Scarabelle's papers combined 120-180 s. Old Gloop is a `puzzle` boss ("Arms let go n/8", tide stones show the
    order), so Act II has a bout, a puzzle, a bout and a bout. These override CANON §9.1's single 45-90 s target and
    CANON's "56+" for Gloop; CANON's owner should fold them in at the next CANON edit.
