# Starseed Isle — game design

A cute, cosy open-world action adventure for the browser, played in first person, with an over-the-shoulder
third-person view one key away. Everything (setting, characters, names, art) is original. The numbers below are the ones
in the code; `docs/ARCHITECTURE.md` says where each lives, and the detail files in `docs/wp/` say how they were tuned.

## 1. Pitch

The Great Tree at the heart of Starseed Isle has lost its three Starseeds. Three grumpy guardians are hoarding them in
three corners of the island. Pip, a tiny kid in a leaf-green, fox-eared hood with a wooden sword, sets off to bring them
home. Any order, anywhere: the whole island is open from the first second. Return a Starseed to the pedestal by the
Great Tree; with all three home, the tree blooms, the ending plays, and free roaming continues.

Tone: kind and gentle. Enemies "poof", Pip gets "dizzy", nobody is hurt for real. Regular enemies are easy on purpose;
the three bosses ask for some respect without being hard.

## 2. Look

A toy-like storybook diorama seen from a 1 m tall hero's eye: chunky rounded low-poly shapes, soft toon shading, bold
dark-brown ink outlines, a warm pastel palette, painted skies and clouds, light fog that tints the distance, and a gentle
day / night cycle. The world is dressed for eye level: houses with lit windows and room cards, readable signs, a
landmark above the trees in every region, grass and flowers as painted cards around your feet, fine grain, pebbles and a
twinkle of sparkle on the ground within a few metres. Feedback is juicy but soft: hit-stop, small camera punches, dust,
sparkles, bouncy UI.

## 3. The two views

**First person (the default).** The camera is Pip's eye, 0.88 m above his feet. Field of view 100° horizontal at 16:9
(≈ 67.7° vertical), adjustable 80–115°; wider and narrower screens keep the horizontal angle (Hor+), and a narrow screen
keeps at least 70° horizontal up to a 100° vertical cap. Pitch ±85°. Mouse look is raw: 0.0022 rad per count at
sensitivity 1, no smoothing, applied before the simulation steps (no added latency). Pip's hands and sword are drawn in
their own pass (a 54° vertical camera) at the lower right; the blade crosses the crosshair in the very frame the sword
hits. Look down past −35° and his boots fade into view.

FP camera feel: a head bob of ≈ 2.3 cm peak to peak at a full stride, a slight roll into strafes (0.8°), a landing dip on
a spring (≈ 7 cm after a full jump), a dip, lean and +8° FOV kick on a roll, +4° FOV while sprinting, a short directional
flinch when hurt, one small punch per sword hit, and a trauma shake that is rotation only (at most 2.2° / 1.6° / 2.4°
pitch / yaw / roll). The FOV narrows a little in dialogue (−6°), item-get (−8°) and the boss intro (−10°) and opens +3°
in a boss fight. On uneven ground the eye height is smoothed; left / right and forward never are, so the aim stays
rigid. None of these effects move the aim.

**Third person.** The camera sits level with Pip, over his right shoulder: pivot 1.12 m above his feet, shoulder offset
0.80 m, boom 2.6 m (mouse wheel 1.8–4.5 m), default pitch −4°, field of view 90° horizontal (≈ 58.7° vertical),
adjustable 75–100°, pitch −55° … +50°. Pip fills about a third of the screen height on desktop and landscape phones
(about a fifth in portrait) and stands left of the crosshair, which the sword and interaction aim through. X swaps the
shoulder (Settings also offer centred). The camera is a spring arm: it slides round trunks and posts, rides over low
rocks and fences, stays out of tree crowns and inside a sealed boss arena, comes in until it can see Pip, and drops a
little on a short arm so his feet stay on screen. When it closes in, Pip dithers out (below 0.9 m of arm) and hides
(below 0.45 m); his shadow stays. A tree right beside or behind the camera dissolves its canopy and keeps its trunk;
the tree Pip walks up to or looks up at, and a palm's high fronds, stay whole. While
exploring, Pip turns to run where you push; a swing snaps him to the crosshair; locked on, he faces the target and
strafes.

**Switching.** V (pad RB, touch View) switches at any time, also in dialogue: the camera glides between eye and shoulder
in 0.35 s with the same orientation, and the FOV blends. The view is a setting, not part of the save. Phones held upright
start in third person (with a one-time tip to turn sideways for first person); everything else starts in first person.

## 4. Moving

| Move | Feel |
|---|---|
| Run | 4.4 m/s; in first person strafing is × 0.95 and backpedalling × 0.80; wading × 0.62. Acceleration 38 m/s², braking 30 m/s² |
| Roll | Shift / K (pad B, touch Roll): 0.2 s burst with i-frames (invulnerability frames), 0.55 s cooldown. No direction held in first person = a backstep |
| Sprint | keep holding the roll button after the roll: 5.8 m/s within ±50° of the look; ends on release, a sharp turn, wading or a swing. Pad L3 toggles it |
| Hop | Space (pad A, touch Hop): apex 0.85 m, a tap hops lower, 0.10 s coyote time after a ledge, a press up to 0.12 s early is buffered; air control 14 m/s² up to 6.2 m/s |
| Standing on things | stumps, rocks up to 0.75 m and bridge decks; never pots, chests or the pedestal. Jumping never reaches anywhere walking can't, there is no fall damage, and steep cliffs and deep water stop you |

## 5. Controls

Every on-screen text shows the keys of the device you used last.

| Action | Keyboard + mouse | Gamepad | Touch |
|---|---|---|---|
| Look | mouse (or the arrow keys with "Arrow keys look around") | right stick | drag anywhere outside the stick and buttons |
| Move | W A S D / arrow keys | left stick | floating stick, left side (right side when left-handed) |
| Swing (A → B → C chain) | left button / J | X / RT | Swing |
| Hop | Space | A | Hop |
| Roll, hold to sprint | Shift / K | B (L3 toggles sprint) | Roll |
| Talk, read, open | E / F / Enter | Y | Use (shows the verb) or a quick tap |
| Lock-on | Q / middle button toggle, hold right button | R3 toggle, hold LT | Lock (shown near enemies) |
| Potion | R | LB / D-pad ↓ | Potion |
| First ↔ third person | V | RB / D-pad ↑ | View |
| Shoulder swap · camera distance (third person) | X · mouse wheel | D-pad ← → | — |
| Map | M / Tab | Back | Map |
| Pause | Esc / P | Start | Pause |
| Menus | ↑↓ choose, ←→ change, Enter / E / Space confirm, Esc back | stick / D-pad, A confirm, B back, LB / RB tabs | tap |
| Dialogue | left button, E / F / Enter, Space advance | A, X or Y advance | tap anywhere |

Pointer lock captures the mouse for play, dialogue and cutscenes and releases it for menus, the shop, the map and the
title. Losing it in free play opens the pause menu; during dialogue or a cutscene a "Click to play" veil (touch: "Tap to
play") asks for a click instead. Without pointer lock, hold the right button and drag to look. On touch the controls
hide in dialogue, menus and cinematics.

## 6. Combat

- **The sword chain.** A forehand (right → left), B backhand (left → right), C overhead chop. A and B take 0.30 s, C
  0.40 s; press again during a swing to chain. Damage: wooden sword 1 per A / B, 2 for C; Shiny Sword 2 / 3. C knocks
  harder and breaks a crab's guard. You keep moving at 55 % while swinging, with a short lunge. No block or parry.
- **What a swing hits.** A 3D volume from the eye: A / B sweep ±55° across the aim, C chops ±35° from high above the
  crosshair to well below it. Reach 1.6 m (Shiny Sword 2.0 m) to the target's edge. A walking critter on a ledge above or
  below you is out of reach; one right against you is hit in any direction. Swing assist ("magnetism") bends the hit test
  toward one nearby enemy by 0° / 10° / 20° (off / low / high; 25° on touch; auto = mouse low, pad high, touch 25°). It
  never moves the camera.
- **Hit-stop.** The world freezes for whole frames on contact: 3 on an enemy, 4 on a boss or a kill, 2 on a clink, 4 when
  Pip is hurt. The mouse look stays live during a freeze.
- **Lock-on.** Q / middle button / R3 locks the best enemy near the crosshair (within 18 m); press again to switch or
  unlock, or hold the right button / LT. In a boss fight one press always locks the boss; with a pad or touch the boss is
  locked automatically when the fight starts (Setting "Lock on to bosses by itself"). First person: a soft lock that eases
  the view toward the target only while you leave the look alone, and lets go if you look more than 40° away. Third
  person: the camera frames the target and Pip, Pip faces it, W walks to it and stops, A / D circle it, and a mouse or
  stick flick switches targets. "Lock-on turns the camera" off keeps the marker without any camera behaviour.
- **Hearts.** Health is counted in half hearts: Pip starts with 3 hearts (6 HP) and can reach 8 (four heart-container
  chests and one from the shop). An enemy attack or a projectile takes half a heart; so does every big boss attack.
  Being hurt gives 1 s of invulnerability. At 0, "Pip got dizzy!": he wakes up by the Great Tree with full hearts, his
  gems kept, the fight reset, the nearby enemies gone and 1.5 s of grace.
- **Potions** (R): refill every heart; carry up to 3.

## 7. Enemies

Enemies telegraph every attack: a soft coral halo, a body pulse, a glint and an exaggerated pose for the whole wind-up,
at least 0.55 s before anything can hurt. They only start an attack when Pip is within reach of it, and at most two
attack at once. The first time one notices Pip it shows a "!" and chirps. An attacker off the screen chirps 0.7 s early
and its wind-up runs longer, and the HUD points to it. Touching an enemy that is not attacking only bumps it away. New
enemies appear ahead of you but never inside your view closer than 24 m, emerging from the ground, a bush, the water or
the sky; never in the village. Drops: gems 45 %, a heart 15 % when Pip is hurt.

| Enemy | Where | HP | What it does (attack reach, wind-up) |
|---|---|---|---|
| Jelly Slime | woods, meadow | 2 | hops after Pip; a crouch, then an attack hop (2.7 m, 0.40 s) |
| Grumpy Shroomlet | woods | 3 | wanders and puffs a slow spore you can pop (11 m, 0.55 s) |
| Dozy Bat | woods; also the meadow at night | 1 | flutters high, rises, swoops (5.3 m, 0.60 s); A and B need a look up at a bat in the air, the C chop reaches it from level |
| Buzzy Bee | meadow | 2 | hovers, rears back, dives (4.6 m, 0.70 s) |
| Snippy Crab | shores | 3 | raises its claws and charges (6.6 m, 0.65 s); the claws guard its front during the wind-up and charge, and only the C chop breaks through |
| Snowpuff | peaks | 2 | floats at a distance and throws flat snowballs (12 m, 0.60 s) |

A sword hit interrupts a slime's crouch or hop, a bat's or bee's attack and a snowpuff's throw.

## 8. Bosses

Each guardian sleeps in a round arena (28 m across) at the end of its region's path. Stepping in seals the entrance with
glowing vines and plays a 2.4 s introduction (name card, the camera on the boss); then the fight. Bosses tower over a
1 m hero at eye level, so they keep their distance: passive contact gently pushes Pip back to 2.55–2.75 m, still within
sword reach, so the whole face and the floor at its feet stay in view. The big attacks (ring, charge, snap, leap, slide)
draw their exact danger zone on the ground; each takes half a heart, projectiles too. After the stomp, a charge into the
wall, a landing or a slide the boss is open: it pulses gold and the boss bar says "Now!"; that is where long strings of
hits land. Outside an opening, hits worth 3 damage in a row (the
third wooden-sword hit, the second with the Shiny Sword) make it shrug Pip off (a harmless shove out of reach) and
answer with an attack, never sooner than 1.2 s after it starts walking; a hit while it winds up lands, then it shoves
Pip off and finishes the attack. Below half health a boss is enraged: faster, with bigger volleys. Victory: a burst,
the Starseed floats out, pick it up for a fanfare.

| Boss | Region, HP | Attacks |
|---|---|---|
| Grumble Shroom | Whispering Woods, 48 | stomp: a glow at its feet from the crouch, then a ring rolls outward — hop over it or roll through it (enraged: an echo ring 0.6 s later); a fan of 5 spores (7 enraged); summons two Grumpy Shroomlets (2 HP) only when none is about |
| Captain Pinch | Sunny Shores, 48 | charge along a glowing stripe that locks 0.4 s before he goes; sidestep and he bonks the arena wall, stunned for 1.2 s (free hits); a bubble volley (6, 9 enraged); a claw snap along a stripe (0.75 s wind-up, aim locked 0.5 s before) |
| Frostbun | Frostcap Peaks, 50 | a leap onto a glowing disc around Pip, with a light pillar and a whistle overhead — roll out of the disc, or be in the air when it lands (enraged: snowballs burst out on landing); a fan of 5 snowballs (7 enraged), the aimed one with a landing reticle; a belly slide along a stripe that ends at the wall with a bonk and a 0.8 s opening |

Balance targets (scripted players, wooden sword, full health, both views): a careful player (dodges 90 % of tells, swings
in openings, no potions) wins ≥ 90 %, loses ≤ 2 HP in the median fight, in 25–60 s; a casual player (reacts slower, dodges
about 60 %, drinks a potion) wins ≥ 75 %; a player who never dodges wins ≤ 50 % and is never downed before 15 s.
Measured on the current build: careful wins every fight in 37–55 s losing 1–2 HP, casual wins every fight, never-dodging
wins 2 of 45 and is never downed before 17 s. With the Shiny Sword, careful fights take 25–36 s and the never-dodging
player wins about two in three. The wooden sword is the balance reference.

## 9. People, places to poke, and the ending

- **Interaction** is aimed: look at someone or something and press E / F / Enter (pad Y, touch Use or a tap). The prompt
  reads `[E] Talk · Mayor Ribbit`. Attack never interacts. In third person a nearby target in front of Pip also counts.
- **Dialogue** pauses the world. In first person the view eases onto the speaker's face and the portrait hides (their real
  face is in view; a speaker more than 3.5 m away, like Elder Shellby at the wake-up, keeps it); in third person the
  camera cuts to a two-shot that keeps the speaker's face clear of Pip, and the portrait shows. Lines use the device's keys.
- **Villagers**: Elder Shellby (turtle, by the pedestal; the intro and hints), Mayor Ribbit (frog; names the landmarks),
  Miso (cat; runs the shop), Clover (bunny; Captain Pinch tips), Professor Hoot (owl; Grumble Shroom tips), Digby (mole;
  Frostbun tips and hidden heart chests). They look at Pip, wave when he comes close and step back if he stands too
  close (Miso stays behind her counter).
- **Shop (Miso)**: Potion 25 gems (carry 3), Heart Container 120 (once), Shiny Sword 150 (once: double damage, longer
  reach, sparkly). In first person the purchase is held up in Pip's paws.
- **Chests**: 4 heart-container chests (a ring of sunflowers in the meadow, the islet off the western beach, a nook
  behind the peaks boulders, a hidden glade in the woods) and 10 gem chests hidden 8–40 m off the paths. A gem chest
  spills gems; a heart container (like a Starseed) is raised in Pip's paws in first person or over his head in third
  person while its line plays.
- **Pickups**: gems (worth 1, 3 or 5) and hearts (one heart) pop out, drift to Pip within 2.5 m and vanish after 12 s.
  In first person they pop out away from Pip and low, and drift in at his feet, never up past the eye.
  Bushes, pots and tall grass can be cut and sometimes hide them; they grow back out of view.
- **Pedestal and ending**: at the altar by the Great Tree each carried Starseed flies into its star socket. With all
  three, the view looks up the trunk, the tree blooms, the camera cranes up and around it, and the card "✿ Starseed Isle
  is blooming again! ✿ — Thanks for playing" appears. Free roaming continues; the village music becomes the ending theme.

## 10. HUD and menus

The HUD is HTML over the canvas in a cream-and-brown storybook style (Fredoka, rounded panels, soft shadows), with
generated icons that each have a drawn fallback.

- **Crosshair** (dot, dot + ring or off; three sizes; cream or yellow): a ring on a target, coral petals with an enemy in
  reach, cream ticks on a hit, a gold star on a kill. The prompt pill sits under it in first person and above the target's
  head in third person (never on Pip).
- **Top left**: hearts (rows of five on narrow windows), gems, potions and the pickup feed.
- **Top centre**: a compass ribbon (the next guardian — by way of its bridge while the river lies between — or the altar
  while you carry a Starseed, with its distance; the
  Great Tree, the shop, landmarks and your map marker; the goal, the marker and the tree stay pinned at its edge when
  behind you), the seed tray and the objective line, the boss bar during fights, the region card on arrival.
- **Top right** (desktop): a minimap that turns with you, or north-up, or off. Phones show the compass only.
- **Danger and targets**: damage petals point at whoever hit Pip; coral chevrons at the screen edge warn of wind-ups off
  screen, with a "look up" caret for threats above; gold corners frame the locked enemy (off screen: a reticle at the
  edge with an arrow the way to turn); small heart pips show the health of the locked, aimed or last-hit enemy. At low
  health a rose vignette and the hearts beat together on one 0.9 s clock, with a soft heartbeat sound.
- **Boss**: a lower-third name card during the intro (in third person it moves aside if Pip stands under it; in first
  person the sword is lowered out of the shot; a pause holds the card with the intro), then the boss bar with its "Now!"
  tag. The region card and the boss card never share the screen.
- **Hints**: first-run coach marks (look around, walk, then swing, hop or roll) advance when you do the thing, in any
  order (a step already done is skipped); later hints (for example how to beat a ring) queue one at a time. In a boss
  fight only the fight's own hints show (on a phone in first person at the top, under the boss bar); others wait.
- **Dialogue**: a box at the bottom with a typewriter, a name tag and, when it applies, a portrait.
- **Menus** (the world pauses and the mouse is released): Pause (Resume, Settings, Controls, Map, Chat log, Save & Quit);
  Settings (tabs View, Controls, Sound, Comfort, built from the settings list; the device in use first); a controls
  reference per device; a parchment map where a click or tap drops a marker the compass follows; the shop over a dimmed
  backdrop. Everything works with mouse, keyboard, gamepad and touch.
- **Title and loading**: painted key art, a loading card with rotating tips, an ending card over its own art.
- **Phones**: fixed layouts for landscape (first person) and portrait (third person, controls in a deck at the bottom),
  within the safe-area insets.

## 11. The island

A deterministic 360 m island (seed 7151 by default) in a turquoise sea. Every important place can be reached on foot;
the world generator checks it.

| Region | Where | Ground and dressing | Enemies | Landmark |
|---|---|---|---|---|
| Sprout Village | centre | paved plaza (16 m) with the Great Tree (19.8 m) and the pedestal, cottages and Miso's shop with lit windows, a well with a frog, lamps, bunting, a signpost that reads from every side | none (safe) | the Great Tree, the tallest thing on the isle |
| Whispering Woods | north | forest floor, dense trees, three clearings joined to the path by winding trails, a fairy ring of glowing mushrooms | slime, mushroom, bat | Grumble's Crown, a giant purple mushroom (21 m) behind the woods arena |
| Frostcap Peaks | east, over the river | snowy hills, rock and cliffs, snowy pines, boulders | snowpuff | Summit Crystal Cairn (15 m) on the highest point |
| Sunny Shores | south | beaches, shallows, palms, shells, islets with bridges | crab | Pinch's Lighthouse (18 m), striped, on the beach by his cove |
| Bloom Meadow | west | meadow, flowers, bushes, ponds, a sunflower ring | bee, slime | Meadow Windmill (15 m), sails turning |

Dirt paths run from the plaza to each arena and into the meadow, with waymarker posts every 30 m, edge stones near the
village and lamps along the first stretch. A river runs down the east side to the sea, crossed by wooden bridges.

## 12. Atmosphere and sound

- A day lasts 8 real minutes; a new game starts mid-morning. Sun, sky, fog and light colours change through dawn, day,
  dusk and night (never too dark). At night: the moon low over the horizon, stars, lamp pools, a soft light around Pip,
  fireflies, glowing windows and mushrooms, the lighthouse beam.
- The sky is painted: billboard clouds, sun and moon, horizon isles and a floating sky isle. Fog takes the sky's colour,
  differs per region (thicker in the woods, closer in boss arenas) and never hides the Great Tree or the landmarks.
- Ambience per region around the camera: falling leaves and morning light shafts in the woods, snowfall and breath puffs
  in the peaks, butterflies and pollen in the meadow, sea sparkles and gulls on the shores, dandelion fluff in the village.
  Water has shore foam, glints and wading ripples; feet leave prints in sand and snow.
- Sound is positional (direction, distance and a muffled sound behind you), with footsteps per surface, three swing
  sounds, a wind-up cue for every enemy and boss attack, region ambience beds, music per region and for bosses, music
  ducking in dialogue and the shop, and separate music, effects and ambience volumes.

## 13. Accessibility and comfort

| Setting (Settings tab) | What it does |
|---|---|
| Field of view, first and third person (View) | 80–115° and 75–100° horizontal |
| Third-person shoulder (View) | right, left or centre (X swaps) |
| Crosshair, size, colour; HUD size; minimap (View) | dot / dot + ring / off; small / medium / large; cream / bright yellow; 80–120 %; turns with you / north up / off |
| Graphics quality; dynamic resolution (View) | auto / low / high (low: lower resolution, no near grass, smaller shadow map, smaller textures); on / off |
| Mouse sensitivity, invert, raw input (Controls) | 0.25–4 ×; up / down inverted; pointer lock without OS acceleration |
| Arrow keys look around (Controls) | the arrow keys turn the view (WASD still walks); hidden on a touch-only screen |
| Controller look speed, invert, stick response (Controls) | 0.5–2 ×; linear / smooth / precise |
| Touch look sensitivity, left-handed buttons (Controls) | 0.5–2 ×; mirrors the stick and buttons |
| Swing assist, lock-on button, lock-on turns the camera, lock on to bosses by itself (Controls · Sword) | magnetism off / low / high / auto; press or hold; on / off; auto (pad and touch) / on / off |
| Camera drifts behind Pip, Pip faces where you look (Controls · Third person) | with a pad or touch the camera eases behind Pip while he runs (never near enemies); Pip strafes instead of turning |
| Music, effects, ambience; mute (Sound) | 0–100 % each |
| Motion comfort (Comfort) | one switch for a calm camera: no head bob, no roll, no FOV pulses or speed lines, no dizzy wobble; shake × 0.25, dips smaller. On by default when the system asks for reduced motion |
| Head bob, camera shake, speed effects, camera roll (Comfort) | each 0–100 % (roll on / off) |
| Look at whoever is talking; text speed (Comfort) | the view eases to the speaker in first person; slow / normal / fast typewriter |

Settings are stored per device, separate from the save, and survive a new game.

## 14. Performance budgets

| Budget (1920×1080, integrated GPU of the development laptop) | Target | Measured on the current build |
|---|---|---|
| Frame rate, worst eye-level view | ≥ 60 fps | 60 fps in all 72 sweep views (36 per view mode) |
| Main-pass GPU time | ≤ 8.5 ms median, ≤ 11 ms 90th percentile | median view 5.6 ms (first person) / 6.2 ms (third person); worst view 7.9 ms, worst 90th percentile 8.8 ms |
| Draw calls (+ viewmodel + shadow) | ≤ 350 | ≤ 223 |
| Triangles | ≤ 1.3 M | ≤ 1.19 M |
| HUD CPU per frame | ≤ 0.3 ms (95th percentile) | in-page test `wp6` |
| Viewmodel pass GPU | ≤ 0.3 ms at rest and swinging | in-page test `wp2-heavy` |
| First-sight shader hitches | none: every shader is compiled before the title | in-page test `wp7-hitch` |

How it holds: a 300 m far plane with fog full before it, distance culling and tree LOD, a near-grass radius of 20 m, one
2048² shadow map in a box ahead of the eye, point lights only at night, a device-pixel-ratio cap per quality (auto 1.5,
low 1.0, high 2.0) and dynamic resolution of the main pass between 0.70 and 1.0. No post-processing.

## 15. Save

One save slot in the browser (`starseed-isle-save-v2`): autosave every 30 s outside fights and at key moments (seeds,
chests, purchases, defeats). It keeps the island seed, Pip's place and look, hearts, gems, potions, sword, Starseeds
(found and placed), chests, defeated bosses, the shop heart, the ending, the time of day, visited regions and your map
marker. Continue resumes there; Save & Quit returns to the title.

The schema lives in `js/save.js` (pure, unit-tested in `tests/save.test.js`). Every save carries a `v` field,
`SAVE_VERSION` (currently 2); the version comes from `v`, not from the storage key, which stays
`starseed-isle-save-v2`. Loading runs `loadSave(raw, seed)`: `migrate` applies the `MIGRATIONS[n]` steps
(version n → n + 1) up to `SAVE_VERSION` and rejects non-objects, saves without `seed`, saves newer than
`SAVE_VERSION` or with no migration path; then `normalize` fills missing fields from `freshState` and
clamps or coerces the rest (hp 1..maxHp, maxHp ≤ `CFG.maxHp`, potions ≤ `CFG.potionMax`, coins ≥ 0,
swordLevel 1 or 2, map fields always plain objects, position finite or null). A rejected save is treated
as no save. To change the layout: bump `SAVE_VERSION`, add a `MIGRATIONS[old]` step and a test for it.

The first-person build adds two optional fields without a version bump (`normalize` keeps unknown fields): `pitch`,
the look angle, which `Game.startSession` restores clamped; and `controlsV`, the version of the controls card the
player has seen. A save whose `controlsV` is older than `CONTROLS_V` (`js/game.js`) shows the controls card once more.
