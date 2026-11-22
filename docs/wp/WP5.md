# WP5: actors, telegraphs and positional audio

What this package changed, for folding into `docs/ARCHITECTURE.md` after the merges. Everything a player sees or hears
of an attack now reads from a 0.88 m eye with a 100° view. Colour code: coral (`TUNE.actors.danger` #ff7a4a) = danger,
cream (#fff3d8) = the bright top edge, gold (#ffd34a) = an opening. There is no boss scale-up.

## Files

| File | Change |
|---|---|
| `js/entities.js` | enemy AI: longer wind-ups, attacks only within reach (`TA.reach`), attack tokens, off-screen announce, alert, contact rules, emerge (C16), hp / maxHp / name (C5), `telegraph()` / `hint()` / `offView()` exports; projectiles: blob shadows, trails, flat snowball throws, landing reticle, whistle, all poppable |
| `js/bosses.js` | wind-up tells (lean / rise / swell, coral pulse, glints), openings (gold pulse + sparkles, `boss.opening`), exact telegraphs (stomp glow at the feet, charge / snap / slide stripes), personal space (`boss.room`), landing separation, echo-ring fix, Pinch snap / bubble wind-ups, Frostbun disc (rim wall) + pillar + whistle, slide stops at the wall, `forceAtk` (debug) |
| `js/fight.js` | rings advance in the fixed step (`fx.ground.stepRings`), jumpable (`(player.alt ?? 0) > 0.30`), `EV.TELEGRAPH` kind `ring` + a one-time `EV.HINT` per ring; intro flow and C15 events unchanged |
| `js/fx-ground.js` | the telegraph kit (below); the old `disc` / `line` / `remove` / `update` / `clear` kept |
| `js/npcs.js` | eye contact, wave, face Pip while talking, back-hop when too close |
| `js/audio.js` | positional engine, event claims, emitters, ambience beds, heartbeat, ducking, limiter, offline render, ~90 new sounds; music engine unchanged |
| `js/audio-bus.js` (new) | the event-driven audio layer (C8) |
| `js/actors-mod.js` | module `wp5-actors`: binds the audio layer, the ear every frame, debug helpers |
| `js/tune.js` | `TUNE.actors` filled (only inside its own block; the group's header line is the original) |
| `js/data.js` | `ENEMY` entries gained `name` and `emerge` (only the `ENEMY` block); round 3: `BOSSES` hp 24 / 24 / 26 → 48 / 48 / 50 |
| `js/debug/tests/wp5.js` | suites `wp5` (22 tests in round 1, 32 after rounds 2–3) and `wp5-heavy` (3, round 3: 4) |

No file outside the WP5 list was edited in round 1. Round 2 (integration fixes, below) made two one-line edits outside
it: `js/game.js` `dynamicColliders` (the boss collider stays while the boss dies and uses `boss.colliderR`) and the boot
warm-up list in `js/main.js` (the sprite telegraphs `alert` / `glint` / `aura` are warmed with the ground telegraphs).

## Telegraph contract (C3)

`EV.TELEGRAPH { kind, x, y, z, t, source }` is emitted when a wind-up starts. `t` is the time in seconds until the
attack can first hurt. Extra fields:
- `announce: true, offView: true`: the off-view early warning, `TA.announce` (0.7 s) before the wind-up;
- `offView: true`: a wind-up that followed an announce;
- `ring`: the ring handle, for a shockwave that just spawned (`t` = time until its band reaches Pip).

Kinds: enemies use `lunge` (slime, bat, bee), `shot` (mushroom, snowpuff) and `charge` (crab). Bosses use `slam`
(Shroom stomp), `shot` (spores, bubbles, throw), `summon`, `charge` (Pinch charge, Frostbun slide), `lunge` (Pinch
snap), `leap` (Frostbun) and `ring` (a spawned ring or the echo warning). `source` is the Enemy or Boss.

An enemy only starts an attack (token, telegraph, wind-up) when Pip is within `TA.reach[type]` of it, about the farthest
its attack can land on a standing Pip: slime 2.7, bat 5.3, bee 4.6, crab 6.6 m (hop / swoop / dive / charge distance +
contact radius); the shooters keep their old ranges (mushroom 11, snowpuff 12). Further out it closes in first (a far
slime does plain approach hops with no token, telegraph or chirp, landing about 1.7 m short of Pip). So with Pip
standing still every TELEGRAPH starts where the attack can reach him (test `C3: an enemy telegraphs only within its
reach`); a Pip who moves away during the announce / wind-up can of course leave the reach.

Helpers exported from `entities.js`: `telegraph(source, kind, x, y, z, t, extra?)`, `offView(x, z, y?)` (off the
screen: behind the camera or past `TA.offEdge` (0.95) of the half-width, through `view.worldToScreen`, so it follows the
FOV, the aspect and the view mode; without a projecting view, further than `TA.offView` from the look yaw) and
`hint(id, text)` (`EV.HINT` once per page load per id, C18; `hintReset(id)` for tests). Hint ids: `wp5-ring` (at the
Shroom's stomp crouch, about 1.75 s before a ring can reach Pip; `addShockwave` keeps it as a fallback for any other ring),
`wp5-stripe` (Pinch's charge), `wp5-snap` (Pinch's snap: "His claws will snap along the glowing stripe: step sideways out
of it!") and `wp5-leap`. Their text uses `{jump}` / `{dash}` tokens (C7). `enemy.inReach(d)`, `enemy.offView()` (judged
at the middle of its body).

## Enemies (`entities.js`)

- **Wind-ups** (`TA.windup`, seconds; before → after): slime crouch 0.24 → 0.40, mushroom puff 0.42 → 0.55, bat rise
  0.35 → 0.60, bee aim 0.55 → 0.70, crab windup 0.50 → 0.65, snowpuff windup 0.40 → 0.60. A slime's attack hop can
  hurt only after it has been airborne `slimeHopGate` (0.15 s).
- **Tells:** a soft coral halo behind the enemy for the whole wind-up (`fx.ground.aura`: an elliptical glow pushed
  0.3 m away from the camera so the body hides its middle; it reads at any range, whatever the enemy's colour, and is
  never a crisp ring, so it cannot pass for a UI / lock-on reticle or show a cut where it meets the ground). There is
  also a body pulse toward light coral (`rimColor`), or for the olive slime and the yellow bee toward a vivid version of
  their own hue (`rimColors`; coral or cream turned them muddy / grey), a glint at the business end when the wind-up
  starts, and an exaggerated pose: the mushroom cap swells ×1.4, the bat folds its wings and tips back, the
  bee rears back, the crab raises and opens its claws, and the snowpuff lifts a snowball overhead.
- **Alert:** the first time an enemy is within `notice` (13 m) of Pip, it shows a '!' pop (fx_atlas cell `alert`,
  with a drawn fallback), plays a positional `alert` chirp and pauses for 0.35 s. It forgets Pip beyond `forget`
  (17 m) after 3 s.
- **Attack tokens:** at most `TA.tokens` (2) living enemies hold a token. A token covers the announce, the wind-up and
  the attack. An enemy that is refused a token retries after 0.25 to 0.5 s; a refused active slime sometimes hops
  sideways around Pip, without causing damage. `enemy.token` (bool) and `enemy.attacking` (getter: in a wind-up or an
  attack).
- **Off-view announce:** a source off the screen (`offView()`, above) first enters state `announce` for 0.7 s
  (TELEGRAPH with `announce: true`, positional `announce` chirp). Its wind-up is then 0.25 s longer. An off-view bat
  keeps orbiting for up to `batWait` (1.5 s) to start its swoop from inside the view.
- **Contact:** Pip's body `[feet, feet + 1.0]` must overlap the hurtbox vertically. Only attacks hurt: a slime attack
  hop (after the gate), a swooping bat, a diving bee and a charging crab. Any other contact bumps the enemy away.
  `TA.passiveContact` (default false) brings back the old rule that any touch hurts (a difficulty knob).
- **Flinch:** a sword hit cancels a slime's hop or crouch, a bat's / bee's attack (as before) and a snowpuff's throw
  wind-up (new), and gives the token back.
- **C5:** `enemy.hp`, `enemy.maxHp` and `enemy.name` (from `ENEMY[type].name`).
- **C16 emerge(kind):** `'ground' | 'sky' | 'water' | 'bush'`; anything else, including the foundation spawner's
  `'spawn'`, maps to `ENEMY[type].emerge`. Lasts `TA.emerge` (0.7 s). While it runs the enemy has no AI and no
  contact, and it cannot be hit in the first half. Kinds: slime bubbles up from a green puddle band, crab digs out
  (sand burst), mushroom sprouts (scale-in + stars), bat drops from 3.2 m with leaves, snowpuff spins down out of a
  20-flake swirl, bee pops out with leaves; water rises with a splash. Each plays a positional `emerge_<kind>` sound.
  `enemy.emerging`, `enemy.emergeKind`.
- **Projectiles:** `blob(out)` gives a ground shadow that shrinks with height. Each projectile trails soft puffs.
  `poppable` now defaults to true for every kind, so snowballs can be popped too. New options: `target: { x, y, z, T }`
  adds a landing reticle (a coral ring with a 0.4 m light band, shrinking 1.0 → 0.3 m over `T`, removed with the
  ball), and `whistle: true` adds a whistle emitter that follows the ball. Snowpuff throws are flat: flight time
  `clamp(d / 8, 0.45, 1.1)`, aimed at Pip's chest, apex ≲ 1.6 m over the eye. In Frostbun's fan only the aimed ball
  gets the reticle and the whistle; the others read by their shadows. Contact uses the same vertical overlap, so a
  jump clears ground-skimming shots.

## Bosses (`bosses.js`)

- `boss.name`, `boss.maxHp`, `boss.hp` (C5); `boss.opening` (bool: stunned, or recovering after a stomp, landing or
  slide; the HUD's "Now!" tag). Openings pulse gold at 3 Hz with gold sparkles at belly height, `TA.sparkleHz` (3) per
  second of sim time, spawned in the fixed step (not per rendered frame, so the rate and the seeded RNG do not depend
  on the frame rate).
- **Personal space (FP melee):** passive contact pushes Pip out to `boss.room` (`TA.room`: Shroom 2.55, Pinch 2.65,
  Frostbun 2.75 m from the centre, each within wooden-sword reach r + 1.6 − 0.2), also while the boss dies (its 2.2 s of
  bursts: a Pip still holding forward used to walk to 0.04 m of its centre, inside the body), and a walking boss stops
  `TA.roomWalk` (0.25 m) further out. Holding forward into a boss therefore parks the FP eye there, and the swing
  still lands. Measured (FOV 100, 16:9, holding forward, ray grid): screen covered by the boss Shroom 36 %, Pinch
  24–28 %, Frostbun 35–41 % (before: 68 %, 46–50 %, 82 %); at the peak of a tell stomp crouch 34 % (81 %), leap crouch
  44 % (85 %), throw 27 %, snap 18 %; eye to mesh ≥ 1.48 m (0.67 m). The whole face and the floor at its feet stay in
  view. The Shroom keeps its room during the stomp hop too (no walking under it). With Pip close, a tell's forward
  lean, swell and crouch widening shrink to `TA.tellNear[1]` (35 %) at the room, full `TA.tellNear[0]` (1.5 m) further
  out.
- **Wind-up tell:** `TELL[state]` gives a lean (± `TA.lean` 16°, in the boss frame: `root.rotation.order = 'YXZ'`),
  a rise (0.2 m) and an x/z swell (+10%). There is also a coral pulse and glints (Shroom: cap; Pinch: both claws;
  Frostbun: ears).
- **Wind-ups:** Pinch snap 0.42 → `snapWind` 0.60. Pinch bubbles get a new `bubbleWind` 0.60; enraged, the volley
  lasts 1.6 s, so all 9 bubbles fly. Frostbun throw 0.5 → 0.6 and slide 0.5 → 0.6. The others are unchanged.
- **Stomp glow:** from the Shroom's crouch to its landing a light wall (`fx.ground.band`, `boss.pre`) glows round its
  feet at r + `TA.preRing[0]` (half-width 0.25, 0.6 m tall), brightening and pulsing faster toward the landing; the
  ring takes over at the landing (the glow fades in 0.15 s). It is in view from right beside the body.
- **Keep-out (round 2):** `boss.keepOut` (`TA.keepOut`: Shroom 1.55, Pinch 1.7, Frostbun 1.85 m) is the closest Pip's
  centre (the FP eye) ever gets to the boss's: the body's reach at 0.5–1.2 m height (GLB models 1.34 / 1.46 / 1.64 m) plus
  the near plane's corner. `separate()` steps the boss off Pip to it, the leap lands its body `keepOut + 0.1` from Pip, and
  `game.dynamicColliders` gives the body a collider of radius `boss.colliderR` (= keepOut − Pip r; it was r × 0.85, which let
  the eye 1.47 m into Frostbun's 1.64 m fur), kept until the boss is gone (it used to drop at the first frame of dying).
- **Shrug (round 2, balance; round 3 below):** damage worth `TA.shrug.hits` (3) taken in a row outside an opening (gaps under
  `TA.shrug.gap`, 1.2 s) make the boss shrug Pip off while it is free to act (walking, or a recover that is not an
  opening): a no-damage shove of at least `TA.shrug.v` (7 m/s) for `TA.shrug.t` (0.3 s), out of sword reach (about 4.4 m),
  a stretch, a `hup` and a dust puff, and its next attack comes within `TA.shrug.cool` (0.5 s), but never sooner than
  `TA.shrug.rest` (1.2 s) after its walk began, so its tell starts while Pip has the whole body in view. A shrug that ends
  a recover starts that walk with a fresh cool (`rand(TA.cool[id])`); round 2 kept the spent cool (≤ 0) there, so the
  next attack began the same step: a Pip who swung through a snap met the next snap 1.05 s after the first. Hits during
  an opening (`boss.opening`, the HUD's "Now!") are never counted: that is where a long string lands. `TA.shrug.wind` (1)
  hits while the boss winds up or attacks (`boss.busy`: not walking, recovering or stunned) land, then it shoves Pip off
  the same way (dust, no stretch or `hup`, the attack goes on), so tells are read from outside sword reach. `boss.combo`,
  `boss.windHits`, `boss.walkAt`, `boss.shrugT`, `boss.busy`.
- **Balance (round 3, lead ruling):** measured with three scripted players (`S/agents/r3-actors/combat/bot3.mjs`; real
  input path, manual clock, full health 6 HP, wooden sword, 6 fights per boss per view per player): *careful* (answers 90 %
  of tells after 0.35 s with the taught move, sidesteps and pops shots, clears the Shroom's minions, swings only in
  openings and between attacks, no potions), *casual* (answers 60 % after 0.5 s, swings whenever in reach, drinks one of 2
  potions at ≤ 2 HP), *masher* (holds forward and swings, never dodges or drinks). Targets: careful wins ≥ 90 %, loses ≤ 2
  HP in the median fight, 25–60 s; casual wins ≥ 75 %; masher wins ≤ 50 % and is never downed before 15 s. Levers:
  boss HP 24 / 24 / 26 → 48 / 48 / 50 (`BOSSES`), every big attack takes 1 HP (`TA.bossDmg`; round 2: 2), the Shroom's
  cadence `TA.cool.woods` 1.6–2.6 → 1.8–2.8 s, its summon only while no Shroomlet is about (`TA.minions` 2 → 1) and
  Shroomlets with 2 HP (`TA.minionHp`), the shrug's `rest` and `wind` above. Results (FP / TP, 6 fights each):

  | | careful: wins, median HP lost, median fight (range) | casual: wins | masher: wins, earliest down |
  |---|---|---|---|
  | Grumble Shroom | 6/6, 0.5 / 1, 45 s (38–53) / 37 s (28–58) | 6/6 / 6/6 | 0/6 / 0/6, 17.8 s / 20.0 s |
  | Captain Pinch | 6/6, 1 / 1, 43 s (36–47) / 51 s (38–55) | 6/6 / 6/6 | 2/6 / 0/6, 25.7 s / 24.0 s |
  | Frostbun | 6/6, 1.5 / 1, 42 s (38–46) / 46 s (41–49) | 6/6 / 6/6 | 0/6 / 0/6, 20.2 s / 20.0 s |

  The same bots on the round-2 build (FP, 4 fights each): careful 12/12 but fights of 17 / 22 / 25 s; the masher won
  3/4, 1/4 and 3/4 and was downed as early as 10.3 / 6.8 / 13.8 s.
- **Pinch snap stripe:** the snap lunges `TA.snap[2]` (11) m/s for `TA.snap[3]` (0.28) s and hurts Pip's centre within
  `TA.snap[1]` (1.3 m, the old radius) of the snap line, from Pinch's start point out to his travel so far +
  `TA.snap[0]` (1.9) + 1.3 m. The wind-up (`TA.snapWind`, 0.75 s; round 1: 0.6) draws exactly that rectangle as a stripe
  (`fx.ground.stripe` with `end: true`: a crisp far edge + end wall), `boss.snapLen(yaw)` long (6.13 m in the open), 2.6 m
  wide. It aims at Pip and locks `TA.snapLock` (0.5 s; round 1: 0.2) before the snap with the charge's flash and click,
  so a strafe begun 0.2–0.3 s after the telegraph leaves the stripe (round 1: only a sideways roll did; measured: strafe
  safe at 0.2 / 0.3 s, hurt at 0.4 s; a sideways or backward roll safe at 0.2–0.4 s; back-pedalling cannot outrun the
  6.1 m stripe). (It used to draw a 1.62 m circle 1.9 m ahead while the hit circle rode the lunge out to about 6.6 m.)
- **Frostbun slide:** the stripe is `boss.slideLen(yaw)` long (the path to the wall or to the slide's end + touchR, with
  a crisp end), and the arena wall now ends the slide with a bonk and an opening (`TA.slide[2]`, 0.8 s) instead of a
  bounce along a path no stripe showed.
- **Shockwave (fight.js + fx-ground):** the ring radius is advanced in the fixed step. The light wall (two 0.45 m
  walls plus a floor band, one draw call) is drawn over `[r − width, r + width]`, widened by the interpolation gap, so
  the picture always covers the band the hit test uses this frame. A ring cannot hurt Pip while
  `(player.alt ?? 0) > TA.ringJump` (0.30, C2). Each ring has a positional `rumble` emitter that rides the point of
  the ring nearest the ear.
- **Echo-ring bug fixed:** the enraged Shroom's echo is counted down in `update` whatever the state, so it fires 0.6 s
  after the stomp (measured 0.600 s). It also has its own hop tell and a `ring` TELEGRAPH 0.3 s before.
- **Pinch charge stripe:** width `2 × touchR` = 2 × (r + Pip r + `stripePad`) = 4.04 m, exactly the charge contact
  width. Length runs from Pinch to where the arena wall stops him, plus `touchR`. Edge walls are 0.4 m. It tracks Pip
  until `stripeLock` (0.4 s) before the charge, then locks with an alpha ×2 flash and a `chargeLock` click.
- **Frostbun leap:** from the crouch, the full 2.9 m disc (`fx.ground.zone`, fill alpha 0.3 → 0.66) sits under Pip,
  with a 0.5 m light wall on its rim (`TA.zoneWall`; from inside it the edge reads at eye level all round, at any FOV),
  a rim-lit sky pillar (r 1.2 m, 8 m tall; from inside it a faint coral veil, `TA.pillarIn`) and a `leapWhistle`
  emitter that follows the boss. The disc tracks Pip until 30% of the
  air time, then locks, and its fill grows inward to the landing. The landing hurts inside the disc. Outside the boss
  body a jump clears it. If Pip stands near the centre, the body lands touching him rather than around the FP eye.
  The landing leaves a crack decal (`fx_crack`, falling back to a ring band).
- **Contact:** only `charge` (Pinch) and `slide` (Frostbun) hurt on contact (within `touchR`, `TA.bossDmg.rush`), **once per rush**
  (`boss.rushHurt`, reset by `set()`), and the rush bowls Pip sideways out of its path (`rushHit`: the knock goes mostly
  out of the path, then his outward speed is held at ≥ 1.4 × `TA.shove` while he is within `touchR`), so the rush carries
  on past him to the wall and its bonk / opening. (Round 1 ran `separate()` during the rush: every step put the boss back
  in front of Pip, the rush never passed him and hurt again each time the 1 s i-frames ran out: one Pinch charge took 6 HP.)
  Outside those rushes, Pip inside `boss.room` gets a no-damage shove out to it (`TA.shove` 5.5 m/s, applied as a
  velocity). When Pip ends up inside a boss's keep-out (`separate()`, not during a rush), the boss steps off him instead
  of the collider snapping the FP eye sideways.
- **Damage:** the stomp's ring `TA.bossDmg.ring`, a charge / slide `.rush`, the snap `.snap`, Frostbun's landing `.leap`
  (all 1 HP since round 3; 2 before), every projectile 1.
- Helpers: `boss.touchR`, `boss.room`, `boss.keepOut`, `boss.colliderR`, `boss.busy`, `boss.shrug(wind)`, `boss.rushHit(pl, d)`, `boss.runTo(yaw)`, `boss.rushTo(yaw, speed, secs)`, `boss.snapLen(yaw)`,
  `boss.slideLen(yaw)`, `boss.clearTells()`, `boss.windUp(state, dur, kind, t)`, `boss.forceAtk` (the next
  `pickAttack` returns it; debug only).

## Telegraph kit (`fx-ground.js`, `G.fx.ground`)

Every item is `{ kind, active, life, m, … }`, is removed with `remove(it)`, and its meshes carry
`userData.cull = { dist: Infinity }` (C10).

| Method | |
|---|---|
| `shockwave(x, y, z, o)` → `{ r, prevR, width, speed, max, cx, cy, cz }` | the light-wall ring; advance it with `stepRings(dt)` from a fixed step |
| `band(x, y, z, { r, w, h, color, edge, wallA, floorA, top })` | the same shader at a set radius (reticles, puddles) |
| `stripe(x, y, z, ang, len, width, { wall, color, end })` | charge / snap / slide path; `it.flash` 0..1; uniforms `uWidth`, `uLen`, `uEnd` (crisp end + end wall) |
| `zone(x, y, z, r, { wall, pillar, pillarR, pillarH, color })`, `moveZone(it, x, y, z)` | landing disc (`it.fill` 0..1) + rim light wall (`it.rim`) + pillar (inside veil) |
| `crack(x, y, z, size, life)` | landing decal |
| `alert(target, h)`, `aura(target, { h, size, sizeY, back, dur, color, until })`, `glint(x, y, z, { color, size, life })` | sprites (the aura is a soft halo). The '!' pops share one material per texture (`userData.shared`, never disposed); main.js warms all three at boot (kept by `perfMod.keepPrograms`), so the first '!' compiles nothing |
| `disc`, `line` (old), `count(kind)` | |

## Positional audio (`audio.js`, `audio-bus.js`)

API (all guarded; `?noaudio=1` installs a stub with the same functions):
- `G.audio.sfx(name, { x, y, z, vol, rate, pan, dur, bus, at })` (`at`: a start time on the audio clock up to 1 s ahead). A world point gives pan, distance gain and a behind-you
  low-pass. Distance gain is `ref / max(ref, d)` with ref 2.5 m, faded smoothly to 0 at max (45 m), and the sound is
  skipped below 0.03. The low-pass is 18 kHz in front and 1.4 kHz directly behind, times the distance factor.
  `core.js sfx(name, opts)` already forwards the options.
- `G.audio.play(name, o)` is the same without the claim filter; `G.audio.listener(x, y, z, yaw)`;
  `G.audio.place(x, y, z)` → `{ pan, gain, lp, dist, front, behind }`.
- `G.audio.emitter(name, o)` → `{ set(x, y, z), stop(), alive }` (at most 6 live).
- `G.audio.ambience(id | null, { night })`, `heartbeat(k, { period, lead })`, `duck(k)`, `claim(names)`, `defer(names)`,
  `config(TUNE.actors.audio)`, `setVolumes({ music, sfx, amb })`, `render(what, o, { sec, sr, listener, bed })`
  (an OfflineAudioContext through the real bus graph) and `info()` (incl. `now` (the audio clock), `heart` and
  `heartBeat: { period, lead, last: [{ n, perf, at, ahead }] }`, the last scheduled beats).
- Bus graph: music → duck → compressor; sfx → compressor; ambience → compressor; compressor → master → a limiter at
  −3 dB.

**Event-driven (C8).** `audio-bus.js` subscribes to:
- `step` → `step_<surface>` (water = `step_wade`; foot pan ±0.15; every step);
- `jump` → `jump`;
- `land` → `landHeavy` above 8 m/s, `land` above 3 m/s, else a soft step;
- `swing` → `swingA` / `swingB` / `swingC` (+ `swingSparkle` for the shiny sword);
- `hit` → positional `hit` + `squish` (enemy), `bossHit`, `pop` / `bubble` (projectile), `bush` / `pot` / `leaves`
  (cut);
- `clink` → `clink`;
- `kill` → `enemyDie`;
- `hurt` → `hurt`;
- `down` → `death`;
- `dashStart` → `dash`;
- `collect` → `pickupGem` / `heart` / `seed`;
- `potion` → `potion`;
- `itemGet` → `fanfare`;
- `chestOpen` → positional `chest`;
- `viewMode` → `viewSwitch`;
- `lock` → `lockOn` / `lockOff`;
- `telegraph` → `windup_<enemy type>` or a boss cue (`windSlam`, `windShot`, `windCharge`, `windLunge`, `windLeap`,
  `windSummon`, `windRing`), or `announce` for an off-view warning;
- `shockwave` → a `rumble` emitter riding the ring;
- `bossIntro` → `bossIntro`;
- `region` → the ambience bed;
- `modal` → ducks music to 0.45 in dialogue and 0.7 in the shop;
- `title` → everything off (and the cached heartbeat level reset, so Continue at low hp starts it again);
- `session` → the heartbeat level is re-sent on the next step;
- settings `musicVol` / `sfxVol` / `ambVol` are read live (C17).

Every handler claims the old direct-call names for that frame. For example, `sfx('swing')` next to `EV.SWING`, or
`sfx('hit')` next to `EV.HIT`, is dropped, and calls that come before their event in the same task are deferred to a
microtask and then checked. A package that still calls the old name therefore never doubles the event-driven sound.
Claimable names: `step splash jump land landHeavy swing hit bossHit bubble snow pop bush pot enemyDie hurt dash coin
heart seed fanfare potion chest death`.

**Sound names.** The old names all still work: `swing hit enemyDie hurt coin heart chest dash talk menu select cancel
bossHit bossDie seed fanfare bush pot stomp shoot splash bubble snow potion buy error death door place bloom step`.

New names:

| Group | Names |
|---|---|
| Steps, jump and land | `step_grass step_dirt step_sand step_snow step_wood step_stone step_wade jump land landHeavy` |
| Sword | `swingA swingB swingC swingSparkle clink` |
| Hits and pickups | `squish pop tink` |
| Enemy cues | `alert announce boing swoop zip scuttle throw whistle` |
| Enemy wind-ups | `windup_slime windup_mushroom windup_bat windup_bee windup_crab windup_snowpuff` |
| Emerge | `emerge_ground emerge_sky emerge_bush emerge_water` |
| Boss wind-ups | `windSlam windShot windCharge windLunge windLeap windSummon windRing` |
| Boss actions and impacts | `chargeLock snap hup leapWhistle summon rumble slide bonk bossPop bossIntro` |
| Lock-on and view | `lockOn lockOff viewSwitch` |
| UI | `uiMove uiTick uiOpen uiClose uiTab uiSlider` |
| Pickups and cues | `pickupGem coach waypoint shoulder eyelid whoosh sparkle creak splashBig leaves bell` |
| NPCs and low health | `hello heartbeat` |
| Ambience one-shots | `ambBird ambCricket ambGull ambOwl ambChime ambTinkle` |

Aliases: `lock`→`lockOn`, `unlock`→`lockOff`, `uiHover`→`uiMove`, `uiSelect`→`select`, `uiBack`→`cancel`,
`itemGet`→`fanfare`, `landSoft`→`land`.

**Ambience beds:** village, woods, peaks, shores and meadow. Each is filtered-noise wind with slow gusts; the shore
adds wave swells. Soft one-shots play by day or night. Measured bed peaks (offline, 5 s): village −26.4, woods −23.7,
peaks −22.1, shores −20.0, meadow −27.4 dBFS.

**Low health:** a soft "bum-bum" (64 / 56 Hz, −24 dBFS peak) on the HUD's beat (lead ruling: one period for sound and
HUD): period `TUNE.hud.beat` (0.9 s) and the HUD's own phase, i.e. beat n starts at (n + 0.15) × 0.9 s of
`performance.now()` (`ui.beatPhase()`; the pulse of the hearts and the red vignette peaks at 0.25), mapped onto the
audio clock and scheduled up to 0.18 s ahead. It follows the HUD's thresholds whatever maxHp is: soft
(`TA.audio.heartSoft`, 0.35 → volume 0.71) at hp 2 with the low pulse, full at hp ≤ 1 (crit); never while dizzy. Measured
in page: 3 scheduled beats 0.900 s apart, each at HUD phase 0.150. (Round 1: every 1.05 − 0.3 k s, 0.75 s at half a
heart, on its own clock, from hp ≤ max(2, 25 % of maxHp): at maxHp 20 it started at hp 5 with no HUD pulse at all.)

**Measured (offline, `audio-measure.json`):**
- Listener at the origin facing +Z. A source at the screen-left gives pan −0.9 and an RMS L/R ratio of 12.7×.
- Distance gain (RMS of `hit`) is 1, 1, 0.5, 0.25, 0.125 and 0.083 at 1, 2.5, 5, 10, 20 and 30 m; silent from 40 m
  (below 0.03).
- Directly behind, the low-pass is at 1342 Hz (17 250 Hz in front). The high-frequency share of `step_sand` drops from
  0.34 to 0.16 and of `swingA` from 0.078 to 0.035.
- The 14 loudest sounds stacked at 1 m peak at −1.07 dBFS (no clipping). Every sound at 1 m stays under 0 dBFS (heavy
  suite).
- Peaks at 2.5 m: footsteps −33 to −39 dBFS (wading −27), swings A/B −34 and C −25, hit −25, enemy wind-up cues −22 to
  −31, boss cues −22 to −30, alert −22, fanfare −6.7 (the loudest).

## NPCs (`npcs.js`)

`npc.look` (0..1) and `npc.lookYaw`. Within `npcLook` (4 m) the head turns toward Pip, clamped to ±60°; the GLB
villagers (Shellby, Miso) have no head node, so their whole body turns slowly instead. Wanderers stop to look. Inside
`npcWave` (2.6 m) a villager waves once (`npc.waveT`, right arm up and swinging, or a little bob for the GLBs) with a
positional `hello`. The wave re-arms after Pip leaves the look range. The body faces Pip inside 2.6 m and while
talking. When a talk starts closer than `npcBackHop` (1.1 m), a wandering villager hops back to 1.35 m (`npc.backHop`).
A stay-at-home villager (wander 0: Miso) never hops (round 2): WP9's shop counter keeps Pip at least 1.25 m from her
(walking up from the front or the sides), and her spot overlaps the counter's and the shop's colliders, so a hop
resolved against them ejected her 1.7 m and the old "stuck: this is home now" rule stranded her there. Anything that
moves her anyway walks her straight back to her spot at `npcHome` (0.9 m/s, only Pip standing in the way makes her
wait), facing Pip while he is close, then she turns back to her spot's facing (`npc.homeRot`).

## TUNE.actors

`danger dangerEdge chance glint windup{} slimeHopGate reach{} tokens tokenRetry offEdge offView announce announceAdd
batWait notice forget forgetT alertLife alertH alertSize glintLife glintSize rimFlash rimHz rimCalm dieCalm rimColor rimColors{}
passiveContact bodyH emerge snowK snowT reticle reticleH ringJump ringWall stripePad stripeLock stripeWall
frostDisc pillarR pillarH zoneWall pillarIn snapWind bubbleWind throwWind slideWind snap[] snapLock slide[]
bubbleEnraged shove room{} roomWalk keepOut{} shrug{ hits gap v t cool rest wind } bossDmg{ ring rush snap leap } cool{}
minions minionHp lean rise swell tellNear[] preRing[] sparkleHz
echoWarn npcLook npcWave npcBackHop npcHome audio{ ref max minGain lpFront lpBehind panK heartSoft }` (`shoveOut` was
replaced by `room`; round 2 removed `ringRumble` (read by nobody: the ring's `rumble` emitter already rides the point
of the ring nearest the ear) and `audio.lowHp` (the heartbeat follows the HUD's hp ≤ 2 / ≤ 1), and added `keepOut`,
`shrug`, `audio.heartSoft`; `snapWind` 0.6 → 0.75, `snapLock` 0.2 → 0.5). Round 3 added `shrug.rest` (1.2), `shrug.wind`
(1), `bossDmg` (all 1; the 2s were hard-coded), `cool` (the hard-coded cadences; woods 1.6–2.6 → 1.8–2.8), `minions` (1; the
hard-coded 2) and `minionHp` (2).

## Debug helpers

`G.debug.actors`:
- `tokens()`;
- `telegraphs(n)`;
- `attack(e?)`: make an enemy start its attack now;
- `boss(name)`: woods `stomp|spores|summon`, shores `charge|bubbles|snap`, peaks `leap|throw|slide`;
- `ring(speed)`;
- `stage(type, { dist, rel, state: 'wind', alt })`.

`G.debug.audio`: `info()`, `place(x, y, z)`, `render(what, o, R)`, `last()` (the bus's last event → sound
decisions), `clear()`, `names()`.

## Tests (`js/debug/tests/wp5.js`)

`wp5` (22, about 15 s): C5 fields; wind-ups and the TELEGRAPH lead per type; telegraphs only within reach (far starts
ahead and behind for each type) and every melee attack landing from reach − 0.15 m; off-view = off the screen at the
half-FOV ± a few degrees; off-view announce; tokens over 20 s; vertical contact; C16 emerge; projectile shadows and
reticle; the ring band ⊇ hit band plus a jump that clears it; Pinch stripe = contact width (1.9 m off the line is hit,
2.15 m is missed); Frostbun disc + rim wall (2.4 m inside is hit, 3.3 m outside is not); passive shove to the room and
the echo timing; Pinch snap stripe = its hit area (just inside the end / side: hurt; just outside: safe; the old
circle's blind spot 4.8 m ahead: hurt and drawn); Frostbun slide stops at the wall without a bounce and a short slide's
stripe end is exact; FP melee (each boss parks a forward-holding Pip at its room, the swing lands, no damage; the
stomp glow at the feet hands over to the ring); opening sparkles at 30 / 60 / 120 fps; NPC eye contact / wave / face /
back-hop, and Miso back on her spot after three close talks; pan, gain and low-pass maths; offline L/R and no-clip;
event-driven sounds and claims; ducking, heartbeat (incl. title → back in play at the same low hp), beds and junk
arguments.

Round 2 regression checks (in `wp5`, names start with `r2:`): a dying boss keeps its body (Pip holding forward stays at
its room for the whole death, its collider stays); `TA.keepOut` covers each model at 0.5–1.2 m (raycast) and the collider
(AI frozen) and Frostbun's landing keep Pip there; a charge / slide hurts once and carries on past Pip (Pinch from 3 / 6
m, Frostbun from 3 / 6 m: 2 HP, still standing, the rush passes him); the snap: standing still is hurt, a strafe either
way after 0.3 s is safe, and it has its hint; three hits in a row outside an opening are shrugged off (Pip out of reach,
the next attack within 0.6 s) while five in an opening are not (since the lead's round-3 edit the shrug counts damage: a
string worth ≥ `TA.shrug.hits` = 3, i.e. the third wooden hit A 1 · B 1 · C 2, or the second Shiny hit 2 · 2 · 3); the ring hint comes with the slam telegraph ≥ 1 s before
the ring; the heartbeat (levels 0 / 0 / soft / 1 at hp 5 / 3 / 2 / 1 of 20, period `TUNE.hud.beat`, and with a running
audio context each scheduled beat at HUD phase 0.15 ± 0.004, one per period, each placed from a clock pairing at most
0.2 s old). The NPC test now checks Miso against the
merged shop: talks from the closest spot Pip can walk to leave her on her spot, no hop even from 0.75 m, and displaced
0.5 m she walks straight back and turns to her spot's facing.

Round 3 checks (names start with `r3`): a shrug that ends a recover answers ≥ max(`shrug.cool`, `shrug.rest`) later
(round 2: 0 s, the spent cool), per boss; a hit during a wind-up (stomp crouch, snap wind-up, throw wind-up) lands, then
Pip is shoved out of sword reach and the attack goes on; the ring, the snap and the landing take `TA.bossDmg` (the rush in
the r2 rush test); and in `wp5-heavy` a player who never dodges is not downed before 15 s by any boss and no boss falls
to it in under 15 s (2 seeds per boss).

`wp5-heavy` (4, about 60 s): the 60 s 6-enemy token script, the telegraph-lead matrix (each type in view and
behind, 10 s each), the level of every sound, and the r3 masher check above.

Measured telegraph lead (the worst hit after its latest telegraph, Pip standing still), in view / behind: slime 0.567
/ 0.567, mushroom 0.567 / 0.80, bat 1.217 / 0.967, bee 0.917 / 0.767, crab 1.05 / 1.05, snowpuff 1.267 / 1.517 s. For
the 6-enemy scripts, the most attacking at once was 2 (all 6 enemies attacked in turn). With Pip standing among 6
mixed enemies for 40 s, the farthest telegraph per type was slime 2.7, bee 3.0, bat 4.0, crab 4.4, mushroom 5.2 m (the
round-1 build telegraphed slimes from up to 13.8 m).

## What in ARCHITECTURE.md is no longer true

- §5: `TELEGRAPH` is emitted now (payload above). `HINT` is emitted by WP5 (`wp5-*` ids).
- §10: `Enemy.emerge(kind)` animates and is no longer a no-op. `Projectile.blob` returns a shadow. Enemies carry
  `maxHp`, `name`, `token`, `attacking`, `noticed` and `emerging`.
- §14: the `sfx` options are used (positional). `G.audio` has the API above.
- §16: `TUNE.actors` is filled.
- Fight rings: they are advanced by the fight's fixed step (`fx.ground.stepRings`), not by `GroundFX.update`, and a
  jump clears them.
- Contact rules (enemies and bosses), snowballs now poppable, and the Pinch / Frostbun wind-up timings are as listed
  above.

## Text for WP9 (NPC hint dialogue in `data.js` is WP9's; WP5 supplies the strings)

- Clover, Pinch: "When the sand under him glows, that is his charge path! Step sideways out of the stripe and he will
  bonk the arena wall. Dizzy crab, free hits!"
- Clover, crabs: "Little crabs glow and raise their claws before they charge. Sidestep, then bonk them while they
  catch their breath!"
- Hoot, Shroom: "When he stomps, a glowing ring rolls outward. Hop over it with {jump}, or roll right through it with
  {dash}! Hoo!"
- Digby, Frostbun: "Frostbun loves to hop. If a glowing circle blooms around your feet and something whistles
  overhead, LOOK UP, then dash out quick!"

## Deviations

- **Arch acceptance 4 (pan sign).** "A source at (−5, 0, 0) facing +Z has pan < −0.5" assumes the opposite
  handedness. In this game's convention, facing +Z the screen's right is −X (`rightXZ(0) = (−1, 0)`), so (−5, 0, 0)
  is on screen-right and pans to +0.9. The test asserts the screen-matching sign: screen-left < −0.5 and screen-right
  > 0.5, checked against `view.worldToScreen`.
- **Passive enemy contact** no longer hurts by default (`TA.passiveContact` false). This was needed so that every
  damage has a telegraph ≥ 0.55 s before it (the slime gate covers its 0.40 s crouch).
- **Landing separation** moves the boss off Pip rather than pushing Pip, because `game.dynamicColliders` (game.js) is
  outside WP5. The FP eye no longer snaps.
- **Snowball reticles** are drawn only for the aimed ball of a fan; five overlapping reticles were unreadable.
- **Enemy attack ranges** (balance): bat 8 → 5.3 m, bee 7 → 4.6 m, crab 7 → 6.6 m, and a slime attacks only within
  2.7 m (it used to hop-attack from any distance once it noticed Pip). Each is the farthest its attack can land, so a
  telegraph (and an off-view announce chirp) always means a real threat (C3: `t` = seconds until it can hit).
- **Boss personal space** (feel): passive contact keeps Pip at `TA.room` (2.55–2.75 m) instead of r + 0.5
  (1.85–2.05 m), and walking bosses stop 0.25 m outside it, so FP melee happens where the tells are visible.
- **Pinch snap** (balance): the hit test is the drawn stripe (a rectangle, Pip's centre within 1.3 m of the line, from
  his start out to the claws' reach). The old swept circle's rounded far corners are gone; the radius stays the base
  1.3 m (the round-1 WP5 build had made it 1.3 + Pip r, which is reverted). The aim now locks 0.2 s before the snap.
- **Frostbun slide** (balance): stops at the arena wall with a bonk and a 0.8 s opening instead of bouncing on.
- **Flinch** (balance): a sword hit now cancels a snowpuff's throw wind-up, and a slime's crouch as well as its hop
  (WP5's crouch is 0.40 s, so this is the window to interrupt it).
- **Round 2 (integration):** the boss shrug, once-per-rush contact, the snap timing (0.75 / 0.5 s), the keep-out and
  the dying body above are balance / feel fixes from the merged playtest.
- **Round 3 (lead ruling on boss balance):** boss HP is doubled (48 / 48 / 50; RULINGS' "boss HP unchanged" referred to
  the sword chain, and the round-3 ruling lists HP among the knobs) and every big boss attack takes half a heart instead of
  a whole one; see Balance above for why both were needed (a non-dodger had to survive ≥ 15 s yet lose the race). The low-health
  heartbeat follows the HUD (lead ruling). Miso no longer back-hops (the shop counter does that job).

## Round 4 (final gate)

- **Drops in first person** (`entities.js` `Pickup`, `TUNE.actors.drops`): a kill at sword reach launched its gem / heart
  (vy 4–6 m/s, any direction) up through the eye line and the magnet pulled it to Pip's chest, just under the lens: a
  270–530 px diamond on the crosshair for 10+ frames on about half of all kills. In FP a gem / heart now flies away from
  Pip within ±`awayDeg` 60° at `speed` 1.5–2.5 m/s, its vy capped at `vyMax` 3.5 (a chest's own fountain keeps its vy),
  and the magnet pulls to his feet + `magnetY` 0.15 m with the height closing `magnetYK` 2 × faster than the distance. TP
  is unchanged. Frame traces (`S/agents/r4-fix/drop.mjs`, 8 kills at 0.9–1.7 m): nearest to the eye 0.95 m (was 0.45),
  within 1.5 m always ≥ 0.26 m under the eye line (was 0.1–0.3 m over it). Test (wp5): "r4 first person: a drop at sword
  reach …" (16 seeds: never within 0.8 m of the eye, ≥ 0.15 m under the eye line within 1.5 m; TP vy still 4–6).
- **Boss name card on the intro's clock** (`fight.js`): the card was shown and hidden by wall-clock timers while a pause
  (Esc) or a hidden tab held the intro, so it came and went behind the pause menu and the rest of the intro had none.
  `startFight` sets `fight.card = 0`; `updateFight` shows it at `fight.t ≥ TUNE.hud.bossCardDelay` (`ui.showBossCard(…,
  true, 0)`: no extra delay) and the intro's end hides it, as before. Test (wp6): "r4 boss card on the intro's own clock …".
- Comments: `bosses.js` (header, `shrug()`) and the Shrug paragraph above now say what the code counts — damage worth ≥
  `TA.shrug.hits` taken in a row outside an opening (the third wooden hit, the second Shiny one). RULINGS' "Boss HP
  unchanged" line is superseded by the round-3 ruling (Deviations above); RULINGS is not part of the repository.
