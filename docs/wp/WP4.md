# WP4 — Combat, targeting and encounter rules

What WP4 changed, the interfaces other packages build on, and what in `docs/ARCHITECTURE.md` is no longer true.
Files: `js/combat.js`, `js/targeting.js` (module `wp4-targeting`), `js/interact.js`, `js/spawn.js`, `TUNE.combat`
(`js/tune.js`), `js/debug/tests/wp4.js`, this file. Outside them: one foreign edit in `js/debug/tests.js` (below).

## 1. The sword (combat.js)

`swordTest(hb, s)` is still a pure per-step test from the eye (`game.swingState(dt)` from `view.aim()` and the sim feet
`player.pos`, so it works unchanged in the air once WP3's jump lands). The rules (all numbers in `TUNE.combat`):

| Rule | Value |
|---|---|
| Horizontal (A/B) | the target's **edges** `[θ − w, θ + w]` (`w = atan(r/d)`) meet the bearing swept this step; sweep ±`arc` 55° in `sweepAB` 36–136 ms, easeOutCubic (A right → left, B mirrored). Feel §8.2 / RULINGS (the foundation used the centre bearing) |
| Horizontal (C) | edges within ±`arcC` 35° |
| Vertical (A/B) | the target's elevation interval seen from the eye meets `[pitch − bandDown 50°, pitch + bandUp 16°]` (replaces the arch metric band). A bat at altitude 2.1, 1.5 m away needs ≥ 15.5° of look-up |
| Vertical (C) | the chop sweep `pitch + chopUp 45° → pitch + chopDown −50°` (easeInQuad, `sweepC` 80–160 ms) crosses it (feel §8.2: the overhead finisher reaches above the screen edge by design) |
| Reach | surface `d ≤ reach + r`; 3D eye → nearest point ≤ `reach + r + reachSlack 0.3` |
| Vertical reach (new, `vReach`) | never a target wholly above `eye + reachUp 1.4`; a flyer / projectile never wholly below `feet − reachDown 0.45`. A **walking critter** (`hb.ground`, `walksOnGround(e)`: slime, mushroom, crab **and the snowpuff**, which floats but walks; WP5 may declare `def.ground`) never across a **wall-sized terrain step** (`hb.wall = game.wallBetween(swing start, target)`: along the line, every `wallStep` 0.1 m, the terrain rises or drops ≥ `wallRise` 0.9 m over stretches steeper than `wallGrade` 1.0, **or** (round 2) the two points differ by ≥ `wallRise` and ≥ `wallUnw` 0.3 m of that is over a **bank** whose smoothed slope is ≥ `wallSlope` 0.9 — clearly past the 0.84 walk limit: WP9's peaks summit bank at (98, −41) rises 1.46 m at grade 0.9 then 1.4, slope up to 1.16, so only 0.56 m of it was steeper than 1:1 and slimes / crabs / snowpuffs above or below it were hit; a band just over the limit, which Pip slides around (the woods slope, ≤ 0.89), stays a steep slope; bridge decks and deep water never count), and its base (`hb.base`, the hop removed) within `groundSlack 0.35 + walkK 1.0·d` of Pip's ground (at most `groundUp` 1.5 up), `d` from the swing start. Pip's ground is `feet − (player.alt ?? 0)`, taken as the lower (up) / higher (down) of now and the **swing start** (`s.gnd`, `s.gnd0`, recorded on `EV.SWING`), so the lunge never climbs into range and a jump never adds reach to a ledge. No hits up or down a wall; a steep **walkable** slope still hits |
| Line of sight (new) | the target is hit when the ray from the eye to **any** of its sample points is clear: the contact point, its left / right edge at that height (`losEdge` 0.75·r off its centre line), and its upper part (80 % of its height, when that is above the contact point). Each ray: terrain sampled every `losStep` 0.2 m, collider cylinders up to their body tops (`W.probeSegment`), but **trees by their trunk** (`trunkR(c)`: `tree_round` 0.56·r, `tree_pine` / `tree_snow` 0.5·r, `tree_palm` 0.6·r, or a declared `los` radius in the collider decl), not their movement radius. A cuttable's own collider is ignored |
| Bubble | `d < bubble 0.45 + bubbleR 0.5·r` at body height (feet −0.2…+1.6): hit in any direction |
| After the sweep | only the bubble hits (feel §8.3 f9–f11) |
| Magnetism (new) | `aimAssist` off 0° / low 10° / high 20° (25° on touch); auto = mouse/keyboard low, pad high, touch 25°. Widens the horizontal test toward **one** enemy per swing (within `reach + magReach 0.6`, inside the same vertical rules (`vReach`) and band, nearest edge outside the sweep by ≤ the magnetism); the lock-on target first and with at least `lockMag` 15° (unless assist is off). Never moves the camera. The same table in TP (RULINGS' canonical magnetism wins over feel §10.7's ±40° / reach + 1.5 m) |
| C | +`dmgC` 1 damage, `knockC` 9 m/s (A/B 6.5), breaks the crab guard (unchanged plumbing) |
| Knockback (new) | `Enemy.hit` / `Boss.hit` get **Pip's position** as the source (as in the foundation, so the crab's guard cone still faces Pip and only C breaks it). After a `'hit'` / `'dead'` the enemy's `knock` vector is re-aimed along `knockAim` 0.65 of the aim + 0.35 away from Pip (a target behind Pip: straight away), keeping the strength `Enemy.hit` gave it. Bosses keep their own small push away from Pip |
| Hit-stop | unchanged: enemy 3, boss 4, kill 4, clink 2, hurt 4 whole steps, max not sum |
| Contact feedback | FP: **one punch, WP1's** (`view.feel` punches on `EV.HIT`, once per swing, comfort-scaled: A / B yaw 0.6° along the sweep + FOV −1.5, C pitch −1.2° + FOV −3, a boss hit yaw 0.9° / FOV −2.5 per feel §8.4 through `p.kind === 'boss'`); combat adds **no** `view.kick` / `fovPunch` of its own (round 2: both fired, so every FP hit punched ≈ twice the spec — yaw 0.89°, FOV −2.44, plus a pitch dip A / B should not have — and the combat half ignored "Speed effects Off"); without `view.feel` the old 0.22 shake; TP: shake 0.15; kill / clink trauma 0.15 (feel §8.4). FP sparks never spawn inside `fxNear` 0.6 m of the eye |
| HUD fields (C5) | `hudFields(e)`: `hp` clamped ≥ 0 after every hit, `maxHp` (= `def.hp`) and `name` (`'Slime'`…, bosses `def.name`) filled in **only when missing** (WP5's own values win); run on spawn, on hit, on lock and every step for every enemy |

Exports: `swordTest`, `vReach(hb, s)`, `walksOnGround(e)`, `trunkR(collider)`, `sweepAt(kind, t)`, `sweepT(kind, a)`
(inverse: attackT at bearing a), `chopAt(t)`, `chopT(p)`, `hudFields(e)`. New Game methods: `magnetDeg()`, `magnetFor(s)`,
`knockDir(s, hb)`, `swordLos(s, p, self, hb)` (any clear sample ray), `losRay(s, p, self)` (one ray), `groundFields(hb,
s, e)`, `wallBetween(ax, az, bx, bz)`, `noteSwingStart(id)`, `fxPoint(s, p)`, `hitPunch(kind, boss)`. `swingState`
also returns `id` (swingId), `mag` (0), `gnd` / `gnd0` (Pip's ground now / at the swing start).
`swordTest` writes `s.contactT` (the attackT at which the blade met the target: A its right edge, B its left edge, C its
top; the bubble: this step) — **WP2: freeze the viewmodel at this pose during the hit-stop (feel §8.3 contact pose)**.

### Events (additive payload fields)
| Event | Payload now |
|---|---|
| `EV.HIT` | `{ kind, swing, swingId, x, y, z, dmg, target, killed, contactT, knockX, knockZ, magnet }` (`knock*` / `magnet` on enemy and boss hits) |
| `EV.CLINK` | `{ x, y, z, target, kind, swingId, contactT }` |
| `EV.KILL` | `{ type, x, y, z, swing ('A'\|'B'\|'C' of the killing blow, or null), target }` |
| `EV.LOCK` | `{ target, prev }` — now emitted (WP4) on every lock / unlock / switch / hand-over |

## 2. Lock-on (targeting.js, contract C1)

| | |
|---|---|
| Inputs | `lockOn` (Q / MMB / R3) toggles; `lockHold` (RMB / LT) locks while held. `settings.lockMode = 'hold'` makes Q / R3 hold-to-lock too (MMB stays a toggle: input.js keeps no held state for it) |
| Acquire | emerged (`spawnT ≥ 0.5`, not `emerging`), living enemies ≤ `lockRange` 18 m from Pip inside ±`lockCone` 45° of the **crosshair ray** (angles from `lockEye()`: FP the eye, **TP the camera**) with terrain LOS from Pip's eye (`lockLosN` 6 samples); score = 3D angle° + `lockDistW` 1.5·m. TP fallback: the nearest ≤ `lockNear` 6 m, anywhere when WP1 frames the lock (`lockFramed()`), else only within ±`lockFreeDeg` 70° of the camera. **In a boss fight one press always locks the boss** (arch accept 6) |
| Lock point | `game.lockPoint(t, out?)` → Vector3: enemy hurt-volume centre (`lockPt.enemy` 0.5), boss at `lockPt.boss` 0.45 of its hurt volume. WP1 frames / eases to it, WP6 can draw the reticle there |
| Lifetime | breaks beyond `lockBreak` 22 m (never the fight boss), after `lockLosT` 1.0 s without LOS, in FP after the look stays > `lockOffDeg` 40° off it for `lockOffT` 0.35 s (TP **without** WP1's framing: > `lockFreeDeg` 70° off the camera, so Pip never faces a target far off screen), on the button / hold release, on `EV.DOWN`, `EV.RESPAWN`, `EV.FIGHT_END` (boss), session start, title. Waits (no timers) while not `game.playing` |
| Dead target | hands over to the best candidate within `lockRetarget` 8 m and ±`lockRetargetDeg` 60°, else unlocks |
| Switch | Pressing lock again while another candidate is ≥ `lockSwitchDeg` 10° nearer the crosshair switches to it (else unlocks), in FP and TP. TP **only when `lockFramed()`** (WP1's `view.feel.lockOn` exists and `lockTurnsCamera` is on, so mouse X / the stick no longer turn the camera): a mouse flick ≥ `lockFlick` 45 counts within 0.12 s, or a **horizontal** stick flick (its horizontal part crosses `lockFlickPad` 0.85 while ≥ `lockFlickHoriz` 2 × its vertical part) switches to the nearest candidate on that side (0.25 s cooldown); without the framing there are no flicks (a camera pan never switches). `game.switchLock(dir)` (+1 left, −1 right) for others |
| Auto-lock | `EV.BOSS_FIGHT` → `settings.autoLockBosses`: on → lock the boss; auto → only when the last device is pad / touch; off → never |
| Intent hook (TP) | while locked: `it.bodyYaw = it.faceYaw =` bearing to the lock point, `it.facePitch` = elevation from Pip's eye (±60°): the body faces it, every swing latches at it (so a locked bat at 2.1 m is hit with the camera level). **While WP1 frames the lock (`lockFramed()`) the stick is read relative to Pip → target** (round 2): WP1's framing yaw is the pivot → target bearing plus a shoulder parallax that grows near the target (46–64° at 1 m), so a camera-relative W turned tangential close in and Pip orbited the target at ≈ 250°/s with the camera spinning along. Now W walks at the target and **stops at contact** (the part of the stick toward it fades out over the last `lockStop` 0.3 m before the bodies touch: enemies are not solid for Pip), S backs off, A / D circle it at a steady radius (the strafe leans in by the half-step chord angle) and never faster than `lockOrbit` 150°/s around it (full speed at contact was ≈ 300°/s). Unframed (`lockTurnsCamera` off) the wish stays camera-relative. FP: nothing (the look is the aim; WP1 eases the view) |
| Output | `view.lockOn(t)` (sets `view.lockTarget`, calls `view.feel.lockOn`), `EV.LOCK { target, prev }`; `hudFields` on the target |

Game methods: `lockPoint, lockEye, lockFramed, lockLos, lockValid, lockCandidates(o) (o.nearCone new), pickLock(exclude),
lockS() (state), setLock(t, src), releaseLock(), switchLock(dir), updateLock(input, dt), lockAngle(t), lockFlick(L),
lockIntent(it, canAct), autoLockBoss(), touchAutoFace()`. Sounds: none called; WP5 plays `lockOn` / `lockOff` from
`EV.LOCK` (C8).

**Aim friction** (feel §3.3, look mod): pad / touch look (never while the mouse moved) × `friction` 0.6 while the
crosshair ray (from `lockEye()`: TP the camera) is within `frictionDeg` 5° of a living enemy's lock point within
`frictionRange` 12 m of Pip; off with `aimAssist off`.

**Touch auto-face** (feel §8.7): at a swing start (`EV.SWING`), touch as the last device, `aimAssist` high or auto, FP,
not locked and no other look assist running: the view turns (`view.faceTo`, yaw only, any look input cancels it) toward
the best emerged enemy within ±`faceDeg` 30° and `faceRange` 4 m (LOS), at a peak of `faceSpeed` 360°/s (≤ 30°). The FP
blade follows the view, so the sweep lands on it. Not in TP: the TP swing latches its aim at the start, so a later camera
turn would not move the blade; TP keeps the 25° touch magnetism.

## 3. Crosshair interaction (targeting.js)

Unchanged shape (`game.findTarget()` → `{ o, kind, px, py, pz, R, range, x, y, z, h, ang, dist, verb, name, label }`)
plus `key: '{interact}'` (C7 token for WP6's glyph; the label itself stays `'Talk · Elder Shellby'`). Changes:
tolerance `clamp(atan(R/d) + tolAdd 6°, tolMin 8°, tolCap 25°)` × `touchTol` 1.6 on touch (was capped at 15°);
LOS now also tests collider cylinders (`W.probeSegment`), ignoring the target's own collider and anything whose top is
below the higher of **Pip's eye** (feet + 0.88, also in TP, never the camera's height) and the aim point (counters,
fences, pots and rocks up to Pip's eye: he talks / reaches over them; WP9's Miso-behind-the-counter keeps working); the 150 ms hysteresis
grace only holds while the look is within `keepGrace` 35° of the target (a snap turn drops it at once, so E never talks
to something behind the view). The pedestal's name is `'Starseed Pedestal'`. Attack never interacts (unchanged).

## 4. Encounters (spawn.js; C16)

- View cone = look yaw ± (hFOV/2 + `coneAdd` 15°), measured from the **render camera** in TP (`coneOrigin(game)`), from
  Pip in FP. `inViewCone(game, x, z, addDeg)` keeps its signature.
- Spawns never land inside the cone closer than `spawnClear` 24 m: a bearing inside the cone is pushed out to 24–30 m;
  bearings are weighted `spawnFwdW` 2:1 toward ±`spawnFwdDeg` 70° of the movement direction (else the look).
- Every spawn calls `enemy.emerge(kind)`: `'bush'` (slime / mushroom / bee placed at the edge of a bush within
  `bushSnap` 3 m, on Pip's side), `'sky'` (bat, bee), `'water'` (crab within 2 m of water), else `'ground'`.
- Despawn only out of the cone (+`despawnCone` 10°) beyond `CFG.despawnDist` 44 m, or anywhere beyond `despawnFar` 70 m.
- Regrowth only out of the cone beyond `regrowNear` 20 m, or anywhere beyond `regrowFar` 90 m (was 12 / 45).
- `trySpawnEnemy(game)` returns the new Enemy (or null); the old second argument is ignored.

## 5. interact.js

Every function and event name is unchanged (`gameplayInput, faceSubject, drinkPotion, collect, itemGet, sessionIntro,
clearHeldItem, interact, talkTo, buy, openChest, usePedestal`). New: a sim-time scheduler `game.later(sec, fn, cancel)`
/ `tickLater(dt)` (run by the `wp4-targeting` module's `afterStep`, so it holds under menus and the shop) /
`clearLater()` (session start, title; calls each job's `cancel`). The chest's 420 ms lid beat moved from `setTimeout`
onto it (feel §9.3: a pause during the beat no longer lets it run out). **`S.chests[id]` is set when the reward is
granted, at the end of the beat** (not at `EV.CHEST_OPEN`); during the beat the chest carries `chest._opening` and is not
offered again. A beat that never finishes (Save & Quit during it: `game.leaving`, or a session change) grants nothing and
leaves the chest closed in the save, so a heart container can never be saved as taken without its max-heart bonus.

## 6. TUNE.combat keys

Kept: `swingAB swingC cRest winAB winC sweepAB sweepC chainAt chainGap buffer dashCancel moveK lungeK lunge lungeSoft
lungeC lungeNear lungeCone knockAB knockC dmgC arc arcC chopUp chopDown bubble bubbleR reachSlack tpConverge stopEnemy
stopBoss stopKill stopClink stopHurt aimPts npcRange rangeAdd tolAdd tolCap keepDeg keepDist keepT beatDeg tpNear
tpNearDeg spawnClear coneAdd despawnCone despawnFar regrowNear regrowFar`.
New: `knockAim, bandUp, bandDown, reachUp, reachDown, groundUp, groundSlack, walkK, wallGrade, wallRise, wallStep,
losStep, losEdge, mag {off, low, high, touch}, magReach, lockMag, traumaKill, traumaClink, shakeTPHit,
fxNear, tolMin, touchTol, keepGrace, lockRange, lockCone, lockNear, lockDistW, lockBossBonus, lockLosN, lockBreak,
lockLosT, lockOffDeg, lockOffT, lockRetarget, lockRetargetDeg, lockSwitchDeg, lockFlick, lockFlickT, lockFlickCD,
lockFlickPad, lockFlickHoriz, lockFreeDeg, lockPt {enemy, boss}, friction, frictionDeg, frictionRange, faceDeg,
faceRange, faceSpeed, spawnFar, spawnNear, spawnRing, spawnFwdDeg, spawnFwdW, bushSnap`.
Round 2: new `wallUnw` 0.3, `wallSlope` 0.9 (the bank rule), `lockStop` 0.3, `lockOrbit` 150; removed `punch`, `punchBoss` (the FP punch is WP1's `TUNE.view.punch`). Removed (unused elsewhere): `band, bandPitch, bandLevel, levelBand` (the arch metric band). Changed: `tolCap` 15 → 25,
`regrowNear` 12 → 20, `regrowFar` 45 → 90. No `CFG` key changed.

Settings read live: `aimAssist`, `lockMode`, `lockTurnsCamera` (TP flick switching), `autoLockBosses`, `sens`.
No new setting keys.

## 7. Debug and tests

- `G.debug.lockOn(target | null | undefined)` (undefined: pick like a press) → `lockInfo()`; `G.debug.lockInfo()` →
  `{ target, boss, src, dist, point, ang, losT, offT }`; `G.debug.lockCandidates()`. `G.debug.aim()` unchanged
  (whole-sweep `swordTest`, no LOS / magnetism / terrain wall).
- `wp4` (in `'all'`, 39 tests ≈ 8 s): R6 subset per type, the raised bat (A/B: miss at 0/10/14°, hit at 17/25/35°), never
  whiffing on a slime under the crosshair (0.7–2.0 m, A/B/C), wall heights (synthetic), **real peaks cliffs ≥ 1.45 m for
  slime / mushroom / crab / snowpuff, up and down, A and C, with the real lunge** (+ 0.5 m steps still hit), **the steep
  walkable downhill slope at woods (−58, −37)**, LOS (post, ridge, 25 cm lip), **trunk LOS on real woods trees (beside:
  hit, wholly behind: miss)**, magnetism per setting (T31), C guard break / knockback magnitude and direction, **the crab
  guard with Pip as the hit source (windup φ × θ table, charge at 80–88° with 10° magnetism: never damage)**, event
  payloads + HUD fields, T25 connect frame and contact time, T26 sweep order, airborne `swordTest`, TP locked bat, lock-on
  (toggle, hold, lockMode hold, breaks — **round 2: FP look > 40° away for 0.35 s breaks, held or released; a released look-away inside 40° is
  eased back and kept; lockTurnsCamera off: nothing eases; round 3: after a break nothing turns the view** —, dead hand-over, FP press-switch, TP flick with simulated WP1 framing,
  **TP with WP1's real framing: a slow pan keeps, a flick switches, the near fallback locks anywhere; lockTurnsCamera off:
  a 90°/s pan keeps the target, no lock behind the camera, unlock > 70° off camera**, **horizontal-only pad flicks**, **TP
  pick and friction from the camera**, TP intent — **round 2: WP1 frames the target and Pip** —, **TP lock movement (W
  stops at contact without orbiting, D at contact ≤ lockOrbit, S backs off, D circles at a steady radius)**, bosses +
  auto-lock), **contact feedback (one FP punch: combat never kicks / punches the FOV; Speed effects off: no punch; TP
  trauma)**, **the bank rule (a synthetic 1.46 m rock bank is a wall; walkable / near-limit / 0.5 m: not)**, aim friction,
  interaction (T40, T41 / accept 2, accept 3, collider LOS + low counter, **TP LOS allowance from Pip's eye — round 2: the
  post on the TP crosshair ray (WP1's shoulder puts it 0.4 m beside the Pip–Shellby line), and the FP case**, TP fallback), spawner (accept 4,
  emerge on every spawn), despawn (accept 5), regrowth, the chest beat on sim time, **the cancelled chest beat**, **touch
  auto-face**. Tests use `withFraming(view, fn)` to simulate WP1's `view.feel.lockOn`.
- `wp4-matrix` (heavy, ≈ 20 s): arch accept 1 (6 types × 4 distances × 9 bearings × 3 pitches × A/B/C + the raised bat at
  3 distances × 5 pitches = 1758 cells) against `SPEC` (the rules above restated in degrees, no sweep / steps; walking
  critters by `walksOnGround`); the lead's matrix (type × front / side ±60° / behind / above level + looking / below level
  + looking / wall above / wall below × A/B/C).

## 8. What in ARCHITECTURE.md is no longer true

- §10 Sword: add `hb.ground` / `hb.wall` / `hb.base`, `s.mag`, `s.contactT`, `s.gnd` / `s.gnd0`; the vertical band is
  angular (`bandUp / bandDown`), not the arch metric band; target edges count horizontally; LOS (any of the sample rays,
  trees by trunk) and vertical reach (`vReach`, terrain walls) apply (§1 above). `Enemy.hit` / `Boss.hit` still get
  Pip's position as the source; WP4 re-aims `enemy.knock` afterwards.
- §10 Interaction: `findTarget` also returns `key`; the tolerance cap is 25° (touch × 1.6); LOS includes colliders
  (those below Pip's eye or the aim point excepted). `S.chests[id]` is set at the end of the lid beat, not at
  `EV.CHEST_OPEN`.
- §5 events: `EV.LOCK` is emitted (WP4); HIT / CLINK / KILL payload additions (§1 above).
- §2 file map: `spawn.js` is the full eye-level spawner (not "minimal view-cone rules"); `interact.js` owns the sim-time
  scheduler; `targeting.js` owns lock-on and aim friction.
- §6 extension points: the `intent` hook is used by `wp4-targeting` for TP lock-on; `view.lookMods` has two WP4 mods
  (an observer unshifted to the front, aim friction appended).
- §16 TUNE.combat holds the keys of §6 here; §17 debug gains `lockOn / lockInfo / lockCandidates`.
- §18: `combat-basic` "A … misses it at ±105° and behind" (was ±70°; see foreign edit).

## 9. Before / after (foundation build on :8791 vs WP4 on :8804)

`G.debug.aim()` whole-sweep test, 1.5 m unless noted (A / C):

| Cell | Foundation | WP4 |
|---|---|---|
| bat altitude 2.1, pitch 0 / 5 / 10 / 15 / 20 / 25 | A: miss miss **hit** hit hit hit | A: miss miss miss miss hit hit (threshold 15.5°) |
| bat altitude 2.1 @ 1.9 m, pitch 0 / 5 / 10 | A: miss miss hit | A: miss miss hit |
| slime @ 1.4 m, bearing 60 / 65 / 70 / 75 | A: miss ×4 | A: hit hit hit miss (edges, feel T27) |
| slime 1.6 m below the feet, pitch −45 | A hit, C hit | miss, miss |
| slime 2.6 m above the feet, pitch +45 | A hit, C hit | miss, miss |
| slime under the crosshair @ 0.8 / 1.8 m | hit | hit |

Spawns (150 forced, woods, FP, standing; `spawn-before-after.png`): in view 11 % → 42 %, of which closer than 24 m 0 → 0;
forward ±70° 18 % → 58 %; behind (> 90°) 65 % → 32 %.

Review round 1 fixes (reviewers' scripts re-run on :8804; "WP4 r0" = this package before the fixes):

| Check | Foundation | WP4 r0 | WP4 now |
|---|---|---|---|
| slime beside a real pine, centre line inside the collider, in view (4 set-ups, real swing A) | 4 / 4 hit | 0 / 4 | 3 / 4 (the 4th: eye inside a pine skirt, slime not visible) |
| woods Monte Carlo, slime centre visible, 150 samples: whiffs | 0 | 4 | 2, both with Pip teleported inside a rock / trunk collider (pushed 2.5 m away by the swing) |
| 8 real peaks cliffs 1.50–1.94 m, 6 types × A/B/C × up / down: hits on walking critters | – | 97 (slime 17, mushroom 18, crab 18, snowpuff 44) | 0 (flyers in the air above / below the edge stay hittable, as the raised bat) |
| the same cliffs, slime / snowpuff, real lunge and no lunge | – | slime 5 / 8 with lunge, snowpuff 8 / 8 | 0 / 8 everywhere |
| island-wide sweep, slime under the crosshair 0.9–1.9 m (FP A / FP C / TP A) | 600 / 600 / 400 | 599 / 599 / 399 | 600 / 600 / 400 |
| crab facing Pip, windup φ × θ (49 cells, A, assist off) | clink in-sweep | 6 damaging hits | 49 clinks |
| crab charging, 85° / 88° off the aim, auto + mouse | miss | hit, hit | clink, clink |
| TP lock pick, crosshair on A, B 0.7 m to its left (3 / 5 / 8 m) | – | B ×3 | A ×3 (and A with B right) |
| TP pad friction, crosshair on a slime at 3 / 5 m | – | off, off | on, on |
| TP lock (no WP1), 90° / 180°/s pan, or 20°/s at sens 0.25 | – | switches | keeps the target |
| TP stick (±0.03…0.1, −0.95), (0.05, +0.95) with the framing | – | switches | no switch |
| TP lock press, only enemy 4 m behind the camera (no WP1) | – | locks, Pip moonwalks | no lock |
| heart chest, pause one frame into the beat → Save & Quit, 10 fps | – | saved open, maxHp 6 (heart lost) | saved closed, maxHp 6 (reopenable) |

## 10. Known issues / deviations

- C (the overhead chop) reaches 45° above the crosshair (feel §8.2), so a C hits the risen bat with the camera level;
  the arch's "bat at 2.1 hit only with pitch ≥ 15°" holds for A and B. Deliberate: the chop visibly comes down from
  above the screen.
- The arch vertical band (±0.75 m around the aim ray, joined with the body band when level) is replaced by the angular
  band of feel §8.2 with a tighter top (16°), plus the vertical-reach and ledge rules.
- Merged with WP1 (round 2): in FP the lock breaks when the view is > 40° off the target for 0.35 s, whether look
  input holds it there or the player let go: WP1's soft lock never pulls a look back out of that break zone (no rubber
  band). A released look-away inside 40° is eased back and kept. With "Lock-on turns the camera" off there is no
  framing or easing at all; in TP a lock breaks > 70° off the camera, nothing behind the
  camera is locked, there are no flick switches and the TP stick stays camera-relative. With the framing, a mouse pan
  under 45 counts / 0.12 s keeps the target and a flick switches it (mouse X only flicks in a TP lock, by design).
- WP1's TP framing swings the camera once (≈ 57°) as Pip walks in on a locked enemy (its shoulder parallax keeps the
  target on the crosshair; at 1 m it is 46–64° off the pivot → target bearing); fading that term out at close range is
  WP1's call (lockon.js).
- TP flick switching reads raw mouse X / the stick while locked; it runs only when WP1's `view.feel.lockOn` exists and
  `lockTurnsCamera` is on (WP1 then stops mouse X and the stick from turning the camera in a TP lock, feel §10.8).
  Integration check after the WP1 merge: a TP lock plus a slow mouse movement below 45 counts / 0.12 s keeps the target,
  a quick flick switches it (with WP1, mouse X only flicks, by design).
- Feel §10.7 TP magnetism (±40° of the aim, reach + 1.5 m) is not built: RULINGS fixes one magnetism table
  (0/10/20/25°) for both views; the TP whole-island sweep hits 400 / 400. Touch auto-face (feel §8.7) runs in FP only (the
  TP swing latches its aim at the start, so turning the camera would not move the blade).
- Flyers (bat, bee) are not walkers: the terrain-wall rule does not apply to them; one hovering over a cliff edge within
  the eye-relative reach (bottom ≤ eye + 1.4 m) is hit when aimed at, like the raised bat.
- Walls are detected on the terrain heightfield; a critter on top of a prop (not possible for enemies today) would only
  meet the `groundUp` / walkable-slope limit.
- Target-relative dash (feel §8.8) is not done (the dash direction lives in player.js, WP3).
- The F viewmodel stub lags the sweep by ≈ 0.16 W on the first sweep frame and freezes on the step-end pose, not
  `contactT` (WP2's swing presentation).
- `fight.js` `endFight` during the intro leaves Pip `'frozen'` (only reachable from debug / scripts; WP5).
