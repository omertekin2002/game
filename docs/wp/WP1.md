# WP1 — Camera feel and cinematics (as built)

What WP1 adds to the view system, for the lead to fold into `docs/ARCHITECTURE.md` after the merges. Everything plugs into
the ViewController through its extension points (`view.feel`, `addPoseMod`, `addLookMod`) and the event bus:
`view.js`, `game.js`, `fight.js` and `interact.js` are untouched (no foreign edits).

## Files

| File | Contents |
|---|---|
| `js/view/feel.js` | module `wp1-feel` (already registered in `modules.js`): wires everything below, sets `view.feel`, `view.speedFx`, registers `G.debug.cam.*` |
| `js/view/comfort.js` (new) | `Comfort`: live scale factors from the settings `headBob shake speedFx cameraRoll reduceMotion dialogueLookAt lockTurnsCamera` |
| `js/view/rig-fp.js` | `RigFP` (+ `onSnap` hook; r2 part 3: critically damped grounded eye-y, re-seeded on landing), `Spring` (damped spring, 480 Hz substeps), `FeelFP` (the FP layer stack) |
| `js/view/rig-tp.js` | `RigTP`: the full spring arm (below) |
| `js/view/lockon.js` (new) | `LockCam`: the lock-on camera (C1) |
| `js/view/shots.js` | `Shots` (+ `move`, `snapIn`), `shotIn(sec)` / `shotOut(sec)`, `Lids` (eyelid overlay), `Cine` (dialogue, item-get, boss intro, dizzy / death, wake-up, `fitShot`) |
| `js/view/shake.js` | unchanged (trauma model per RULINGS) |
| `js/cutscenes.js` | `anchors(game)` (C6 with fallbacks), FP-first pedestal and ending staging, render-side seed flight and crane |
| `js/tune.js` | `TUNE.view` only |
| `js/debug/tests/wp1.js` | suites `wp1` (34 tests, in `'all'`) and `wp1-heavy` (7 tests, heavy) |

## FP feel layers (`FeelFP`, feel §6.1 order, every render frame through one pose mod)

```
eye.xz += right·bobX                               eye.y += bobY + land + dashDip + kick.eye     (held during hit-stop)
yaw    += kick.yaw + punch.yaw                     pitch += bobNod + landNod + dashNod + kick.pitch + punch.pitch
roll   += strafeRoll + bobRoll + dashRoll + kick.roll  (|roll| ≤ rollCap 6°)
fov    += sprint + dash + punch + fovPunch pulses + context  (clamped to base −14 … +10, vertical degrees)
```
then the trauma shake (view.js) and the shot blend. The look yaw / pitch (aim) never change. FP-only layers are weighted by
`(1 − ease(blend))·(1 − shotW)`, so they fade through a V switch or a shot.

- Head bob: phase = the feel module's own stride phase (`bp0 / bp1`, interpolated between the last two steps). It
  advances by the player's `walkPhase` progress and is phase-locked to it (footfall = bob minimum, checked in the suite),
  but it never runs backwards: `player.js` decays `walkPhase` × 0.9 a step whenever Pip is not walking in `normal` /
  `frozen` (swinging, dashing, stopping), and a bob read straight from it juddered at up to 13.9 mm / 0.56° a frame. While
  the stride does not advance (`bobOn` false) the phase holds and the amplitude eases out (λ 10); once the bob has faded
  (amp × headBob < 0.08) it re-locks to the stride by whole cycles. Amplitude `min(1, speed/4.4)` (sprint ×1.2, airborne
  → 0 at λ 20, wading ×1.4), × `headBob`. 2.28 cm vertical p2p at full stride, 2.0 cm lateral, 0.7° roll.
- Strafe roll 0.8° × lateral/4.4 (λ 8). Landing spring ω 16 ζ 0.6 on `EV.LAND { impact }` above 2 m/s:
  impact 7.38 → 0.071 m dip at 67 ms, 6.5 mm overshoot, < 2 mm at 0.5 s. Dash (`EV.DASH_START / DASH_END`): eye dip
  0.10 m, lean roll 4° toward the dash side, nod 3° (backstep: tilt up 2°), FOV +8 (TP +3), never a somersault. Hurt
  (`EV.HURT.rel`): spring ω 22 ζ 0.65, roll 3.5° away from the source at 50 ms, pitch 3°·cos(rel), yaw 1.5°, recovered by
  0.4 s. Sword contact (`EV.HIT`, once per swing): A/B yaw ±0.6° along the sweep + FOV −1.5, C pitch −1.2° + FOV −3; a
  boss hit `punch.yawBoss` 0.9° / `punch.fovBoss` −2.5 (feel §8.4; r3: TUNE keys, rig-fp.js read them with inline
  defaults). A killing blow is a hit: it gets the same punch, and combat.js adds feel §8.4's kill trauma 0.15 (≈ 0.04°
  of shake, a texture under the punch; r3 ruling of the view-fp engineer: the kill keeps its punch, or the last blow
  would feel weaker than any other).
  Sprint FOV +4 from `player.sprint` (speed 4.7 → 5.6 m/s ramps it in).
- Comfort: `headBob` scales the bob; `speedFx` scales FOV pulses, dash lean / nod and punches; `cameraRoll` off removes
  every roll; **`reduceMotion`**: no bob, no roll of any kind, no FOV pulses, no dizzy topple / wobble / TP orbit, shake
  × 0.25, eye dips × 0.35. Context FOV channels (dialogue −6, item −8, boss intro −10, ending +8, pedestal −6, boss fight
  +3) stay on: they are slow tweens. (Ending +8 follows art §11, not feel §6.7's −12: see Deviations.)

## TP rig (`RigTP`, RULINGS TP camera)

Framing picked from contact sheets (last round: 4 sets × village / woods path / slope / wall,
`agents/r1-WP1-build/r2/tp-framing-candidates-4x4.jpg`):

| set | pivot / shoulder / boom / pitch | Pip height | crosshair clearance | camera over feet | horizon |
|---|---|---|---|---|---|
| RULINGS start | 1.20 / 0.55 / 3.0 / −6° | 28 % | 0.37 m | 1.52 m | 0.41 H |
| **picked** | **1.12 / 0.80 / 2.6 / −4°** | **33 %** at x 0.35 W | **0.51 m** (slope 0.43) | **1.30 m** | **0.44 H** |

Every render frame:
1. pivot (xz λ 16, y λ 10, ramp-exact `follow` since r2 part 3; + lock pivot, − dizzy drop, − 50 % of `player.alt`), boom = wheel length
   (× `narrow` on a narrow screen, ≥ `tpNarrowMin`) × pitch rule
   (looking up × (1 − 0.35·smoothstep(0, 50°)), down × (1 + 0.12·…)) + lock boom.
2. Slide: when the boom (or the shoulder leg) is blocked, lateral offsets (`tpSlide`: further out 0.55 / 0.8 / 1.1, over
   the other shoulder −2 / −2.6; r2 dropped the centre −1 and the narrow −1.6, which parked Pip under the crosshair) are
   scored by clear boom − 0.7·|move| − an under-the-crosshair cost (a real lateral — after the side leg and the arm's
   offset scale — under `tpSlideCentreW` 0.8 shoulders = 0.64 m costs up to `tpSlideCentre` 1.5 m of arm: RULINGS' 0.35 m
   ray clearance needs ≈ 0.64 m) − an edge penalty (Pip's centre past NDC −0.5 = 0.25 W at the arm the offset would get,
   without the offset scale, costs 2.5 m per NDC unit), eased at λ 4, ≤ 2.4 m/s; through the band under the crosshair
   (|side| < 0.8) on the way over the other shoulder it crosses at `tpSlideCross` 7 m/s (≈ 0.18 s). A wall on the
   shoulder side swings the camera over the other shoulder. The scoring is a method (`slideScore`), debug scores are
   recorded only with `view.tp.dbg = true`.
3. Side leg (terrain room + colliders): pull-in on a spring (ω `tpLegW`) toward the soft probe's target, the hard probe
   immediate (r2 part 3), slow release (`legF`). It keeps `tpSideRoom` over the terrain
   but only `tpLowSide` 0.1 m over a low collider's top (r2: a fence or chest at Pip's side folded the shoulder into the
   crosshair).
4. Boom: low colliders (top + `tpProbe` ≤ pivot + `tpLowTop` 0.7: rocks, stumps, fences, chests) are part of the camera
   floor (ground hug, framing-capped) — **only those the hug can ride over on this boom** (r2, `pruneLow`): the boom
   reaches a collider's near edge at length s; the rotating lift that clears it is (top − y(s))·L / s and must fit
   `hugMax(L)`; one beside Pip (s ≤ 0.05) stays floor while its top + probe ≤ pivot + `tpLowSide`. The others (the
   1.35 m altar, a sign or a boulder right behind Pip) are walls again: the arm stops at their face or the slide steps
   round them (they used to fold the arm to `tpArmMin` with the 0.6 m hug added: Pip hidden, 1.5–2.3 m pops). A wall
   verdict needs a 25 % margin to ride again next frame (`walls`), so a sweeping boom does not flip it. **Thin trunks and posts** (`tree_*`, `lamp`, `sign`, r ≤ 1.0) that cross the boom between Pip and a
   camera already behind them do not pull the arm in: the camera stays (≥ 0.30 m from the trunk) and the occluder dither
   shows Pip through the trunk. A trunk beyond the camera stops the release in front of it, so the camera never passes
   through one. Everything else pulls in at once.
   The release is capped at `tpArmGrow`·dt·boom per frame explicitly (arch #2), also when L > boom (looking down ×1.12,
   lock boom).
5. Canopies: the camera point is kept out of tree crowns / pine skirts (pine tiers and round crowns modelled from each
   collider's `camTop` and `prop.s`), eased in (λ 30, ≤ 14 m/s); a crown that already holds the shoulder point (Pip under
   a low pine skirt) is ignored. The first frame after a snap is exact (no easing). A canopy pull-in along a boom that
   crossed a trunk is re-probed as the camera (pass = the new arm), so it stops in front of the trunk instead of inside it
   (the first frame after a snap used to end 0.12–0.20 m inside a round tree, then pop 0.8 m).
6. The ground-hug lift is re-probed: a lift that would raise the camera into a collider on higher ground (a house on a
   rise) shortens the arm along the lifted boom.
7. Arena fence: while a boss arena's vine gate stands (`game.vines[id].k > 0.05`; it is no collider), feel.js sets
   `view.tp.fence = { x, z, r: arena.r + gate.r (0.4), ang: entAng, half: 0.36, soft: 0.3, top: arena.h + 3.5, open }` (the
   fight's own arena first). Inside the gate's span the camera point keeps within r + 0.4 (opening out quadratically over
   0.3 rad past the span's edges, free above `top`); r2: it pulls in eased like the framing (it is no collider), and
   `open` (a locked boss lifted > `lock.liftAt`, Frostbun's leap) lets the long lock boom pass the gate for the jump — the
   vines are below the boss and dither around Pip; it closes again, eased, when the boss lands. Nothing while the
   shoulder is outside the arena.
8. Offset scale (r2): a short arm brings the camera in sideways toward Pip's own line at once (`armK`, slow release):
   `offScale(off, arm)` keeps Pip's centre within `tpOffEdge` 0.5 NDC of the middle (≈ off · arm / 1.6). The boom is
   probed from the side leg's shoulder (no feedback, no deadlock); the sideways move stops short of anything in its way
   and keeps above the camera floor. `sideK = legF · armK` (view.freezeAim and lockon read it). (Pip used to sit at
   0.06–0.12 W, or off the screen, against a house or a trunk.)
9. `RigTP.bodyFade(arm)` (C12): 0 under 0.45 m, 1 over 0.9 m (unchanged band). `view.bodyFade` (r2) =
   `min(bodyFade(camera ↔ eye distance), bodyFade(arm) in settled TP)` in every pose, so the V blend and a shot leaving
   the eye dither Pip in and out (the blend drew a solid hood over 22 % of the screen); view.js also writes it to Pip's
   dither uniform (`pl.fadeU`) in the same frame (Player.render runs before the camera).
10. Feet drop (r3, `feetDrop`): a short arm (≥ 1.2 m fully, fading out toward 0.9 m) lowers the camera point (≤ 0.55 m,
   eased) so Pip's feet stay inside NDC −0.9; it is part of the crosshair ray's height (see Round 3).

## Lock-on camera (`LockCam`, C1)

`view.lockOn(t)` → `view.feel.lockOn(t)` → `LockCam.set(t)`; `view.lockTarget` is also re-read every frame (self-healing).
Lock point: enemy = hurtbox centre, boss = hurtbox bottom + 0.45·height (height smoothed at ω 6 while it lifts).
- FP soft: eases only after 0.15 s with no mouse / touch / stick input, ω 9, 4° dead zone, ≤ 240°/s; any input wins.
  r2: never from WP4's break zone (yaw > `TUNE.combat.lockOffDeg` 40° off the target: a deliberate look-away stays put and
  targeting.js releases the lock after `lockOffT`; it used to be dragged back 20–40° first, then stranded); a boss lifted
  > `lock.fpLiftAt` 0.5 m is eased toward in yaw but the pitch never above `lock.fpLiftPitch` 10° (a look the player raised
  is held): Frostbun's landing disc stays on screen (it was off for the whole 1 s air time, the view at 64°).
- Both views (r2): no ease / framing while `game.playing` is false or Pip is in the item state (dialogue, signs,
  item-get, menus, cutscenes): the camera waits like WP4's lock (a held lock turned the view 48–66° off the speaker).
- TP framing: yaw springs (ω 8) to the bearing that puts the target on the crosshair ray (shoulder offset included), pitch to
  the elevation − 6° (−25…+30°), widened so the lock point stays under the top edge and Pip's feet over the bottom edge;
  boom +0.6 m (enemies), bosses 4.2 m with the pivot +0.35 m. While a boss is lifted > 2 m (Frostbun's leap lands on
  Pip, so it is right above him): boom +2.0 m, pitch cap 44°, pitch spring 14, and the boss's real hurtbox middle (not
  the smoothed lock point, which trails a 0.6 s leap by metres) must stay under the top edge; when the boss's middle and
  Pip's feet cannot share the frame, the middle wins, then Pip's head (his feet leave first; the landing disc still
  shows). Live fight, AI on, strafing: boss middle on screen in 123–140 of 168 lifted frames (3 leaps), its bottom and
  Pip's head in all (`wp1-heavy` starts a leap whenever the AI has walked 0.75 s, so it always measures three).
- While locked in TP, mouse / stick deltas do not turn the camera. `L.inDyaw / L.inDpitch` (for WP4's target switching)
  are set by `feel.look` at the start of every look-mod pass to this frame's raw `dyaw / dpitch`, locked or not (they
  used to be written only while TP-locked and then stayed stale).
- `lockTurnsCamera` off: no camera behaviour (WP4 still marks the target).
- r3: for a non-boss target the shoulder-parallax term of the TP yaw is taken at ≥ `tpLockParD` 3 m (no 57° swing walking
  in); while a locked boss is lifted > `liftAt` the rig may lift the long boom `tpLockLiftHug` 1.0 m more (no arm fold
  looking up at Frostbun's leap).

## Cinematics (`Cine`, `cutscenes.js`)

| beat | FP | TP | hand-back |
|---|---|---|---|
| new game | eyelids closed under the fade, view up +30° into the tree; lids open as the fade clears; the intro talk eases down to Shellby over 1.4 s | same | — |
| respawn | lids closed, view +25°; open as the fade clears, the look eases down over 1.0 s | same | — |
| dialogue (`TALK_START/END`) | `faceTo` the face (0.82·height) at 42 % from the top in 0.35 s (or at 0.65 of the free band above the open dialogue box when that is higher: 844×390 phone → 0.28 H, box top 0.53 H), FOV −6, soft limits ±25° / ±15° (spring ω 8, outward input × 0.25), eye backs off (camera only) to ≥ 1.8 m from the speaker | two-shot 3.4 m from the midpoint, 1.15 m up, 32° off the perpendicular toward Pip's back (speaker's face visible, Pip left / speaker right), FOV 70° h at 16:9 (43° v), fitted every frame (Pip's head / chest and the speaker's face / head top inside 0.18–0.82 W (`talk.fitX` 0.64), ≤ 9 m back, else the FOV widens) and vertically into the band above the dialogue box (r2: ≥ `talk.bandMin` 0.9 NDC tall; the shot tilts down so the band's middle holds them). r2: chosen at the start of the talk from candidates (`TWO_SHOTS`: either side, 0.9 m higher, 0.7× nearer, and an over-the-shoulder shot (r2 part 2: at any distance, `talk.otsNear` extra under `talk.otsDist` 4.5 m; see below) `otsBack` 1.7 m behind Pip, `otsSide` 0.75 m off his right, `otsH` 1.35 m up): the speaker's face (and Pip's head) must be in the camera's sight (`W.probeSegment`; the altar hid Shellby in the intro), then Pip-left, then the plain shot; re-picked when the chosen one loses sight for 0.5 s | TP: look from Pip to the speaker, 0.45 s blend |
| item-get (`ITEM_GET/DONE`) | FOV −8, no shot | front 3/4 shot 2.6 m ahead, 0.6 m aside, 1.3 m up, FOV 82° h, fitted to Pip with the item raised | blend out; the look never changes |
| boss intro (`BOSS_INTRO`, `BOSS_FIGHT`) | in the eye (fight.js tracks the boss), FOV −10, +4 FOV punch at 0.6 s | moving over-the-shoulder push-in (2.4 → 1.9 m back, 1.0 m aside (less on a narrow screen), 1.15 m up), FOV 82° h, fitted to Pip, replacing fight.js's static shot (same priority 2) | crosshair on the boss face (TP through the rig's crosshair ray), blend 0.5 s. **V to FP mid-intro**: WP1 tracks the boss in the eye for the rest of the intro only (hold = 2.4 s − fight time, retargeted every frame) and at the hand-back snaps the look onto the face (`lookAtPoint`), which ends that locked assist (fight.js's own FP branch does not run: its shot token is stale) |
| pedestal (`startPlace`) | locked `faceTo` 0.15 m above the slab (sockets low in the frame, the tree's face clear), FOV −6, seeds leave the hand and arc into the sockets; seeds sit at scale 0.65, 0.04 m into the slab | shot from the altar toward Pip · 5.0 m, off his left · 1.8 m, 1.7 m up, FOV 79° h (`W.shots.place` when given); r2: fitted either way (Pip's head / feet and the slab inside ±0.72 / ±0.85 NDC: WP9's pose cut him at 1.04 on 16:9 and −0.95 on a portrait phone) | TP: face the pedestal, blend 0.6 s |
| ending (`startEnding`) | look up the trunk from the eye (+35°, FOV +8, 1.4 s), bloom at 1.8 s, crane from the eye (snap-in shot) up and around the tree to **`W.shots.endingCrane`** (r2; WP9's 10.9 m-high anchor, looking at its `look`) or, without it, 40° around to 0.85·H at 1.6·H radius, FOV → 79° h, card at 6.5 s; on close the lids blink and you are back at the altar facing the tree +15°. The crane moves in polar form around the tree (radius, bearing, height eased apart) to either end. `W.shots.ending` (WP9's ground-level look-up) is not used: the look-up stays in the eye (FP) / beside Pip (TP). (r1 craned to `W.shots.ending` and stayed 1 m over the plaza.) | the look-up is a short shot 1.2 m behind, 1.4 m beside and 2.0 m above Pip's feet (FOV 90° h), not the raw TP pose behind his hood; the crane starts from it | eyelid blink (under it: setLook + snap) |
| dizzy (`DOWN`) | wobble ±8° 3 Hz → topple (roll 72°, eye 0.28 m, look +18°) → bounce → slow drift; lids close with the respawn fade | pivot drops 0.6 m, slow 20° orbit, trauma | respawn wake-up |

Comfort: no wobble / roll / orbit; the FP death is a gentle sink to 0.5 m.
TP shot FOVs are stored as horizontal degrees at 16:9 and converted with the view's `vFovFor` (Hor+, ≥ 70° horizontal up to
a 100° vertical cap), so a portrait phone (the TP default there) widens them like gameplay: 390×844 → 100° v / 57.7° h
(the two-shot used to be 20° h with Pip off-screen). `Cine.fitShot` backs the camera off along its own ray until the
subjects fit, then `safe()` keeps it out of terrain / colliders, and if that pulled it in the FOV widens (≤ `fitVMax`).
Moving parts are posed per render frame: the ending crane advances by render time in `renderCutscene → moveCrane` (dt 0
while the pause menu or shop is open) and a flying seed is posed from its flight time interpolated to the frame (alpha), so
neither stair-steps above 60 Hz (144 Hz crane: 0 still frames mid-crane, was 301 of 505).
World anchors (C6): `anchors(game)` reads `W.pedestal { x, z, y, top, sockets? }`, `W.greatTree { x, z, y, height }`,
`W.shots.{ place, endingCrane } = { pos: [x,y,z], look: [x,y,z] }` (meanings: `place` = the TP seed-placing camera, fitted;
`endingCrane` = where the ending crane ends; `ending` / `spawn` / `bossIntro` are not read); missing fields fall back to `W.plaza.h`, `W.ground`,
`scenery.greatTree.height`, a 3-socket row across the altar top.

## Interfaces added or changed

Round 2 (integration): `RigTP` `pruneLow(p, back, L)`, `offScale(off, arm)`, fields `legF`, `armK` (`sideK = legF · armK`),
`walls` (low colliders made walls this frame), `fence.open`; `Cine.boxTopNdc()`, `Cine.sees(pos, q, nearA, nearB)`,
`Cine.twoShot(out, pick)` (talk fields `pick`, `sight`); (r3: the wp1-feel `punchesHits` flag is gone: combat.js hitPunch does
nothing in FP whenever `view.feel` exists, and WP1's punch on EV.HIT is the one FP contact punch), `recenter(L)` (look mod),
`intent(it, canAct)` (module hook), `lookIdle`.
Settings now read: `tpAutoRecenter` (pad / touch: after `recenter.idle` 2.5 s without look input while Pip runs, the yaw
eases toward his travel at ≤ 40°/s, a quarter of that running sideways; never locked, with an enemy within 10 m, in
dialogue / shots, backpedalling, or with the next setting on) and `tpBodyFacesCamera` (TP: `it.bodyYaw = lookYaw`: the body
faces the look and the wish strafes; a lock-on still faces the target).

- `view.feel` = the `wp1-feel` module object: `kick(pitchDeg, yawDeg, rollDeg, eyeM)`, `fovPunch(deltaV, in, hold, out)`,
  `lockOn(target)`, plus `fp` (FeelFP), `lock` (LockCam), `cine` (Cine), `comfort` (Comfort). `view.kick / fovPunch /
  lockOn` are live now.
- **`view.speedFx`** (C9): 0…1 every render frame (`max(dash FOV envelope, sprint × 0.35)` × the speedFx comfort factor, 0
  under reduce-motion and during shots); 0 on the title.
- `view.fp.onSnap` (set by wp1-feel: `view.snap()` resets the feel springs).
- `view.tp` fields set by wp1-feel: `lockBoom / lockPivot` (targets, eased to `lockB / lockP`), `pivotDrop` (dizzy),
  `airDrop` (jump follow), `fence` (arena keep-in or null), `aspect` (camera aspect, for the slide's edge penalty).
  Read-only: `sideBase, slideAdj, slideTo, side, sideK, lift, collide, passed, canopy, fenced, tanH, trees, low, lowSet`,
  `info()`; `dbg` (true: record the slide `scores`). Methods: `pitchK(p)`, `passable(c)`, `inCanopy(c, q)`,
  `canopyLen(p, d, len)`, `canopyAt(p, d, a, list)`, `fenceR(x, y, z)`, `fenceOut(p, d, a)`, `fenceLen(p, d, len)`,
  `slideScore(W, p, right, back, L, base, cz, o)`, `sideRoom(W, p, right, off, t)`.
- `Shots.set({ …, snapIn })` (a shot that starts at the camera snaps in and then travels), `Shots.move(token, pos, look,
  quat, fov)`; exports `shotIn(sec)`, `shotOut(sec)`, `Lids`, `Cine`. `Cine.shotFov(hDeg)` (horizontal at 16:9 → vertical
  for this aspect), `Cine.fitShot(look, cam, pts, v, mx, my, maxD, from, out) → { pos, fov, k }`, `Cine.faceAt()` (FP
  dialogue face height from the open box).
- wp1-feel: `bp0 / bp1 / bobOn` (bob stride phase), `syncBob()`, `fence()`.
- `cutscenes.js` exports `anchors(game)`; `CutsceneMixin.seedLaunch(out)`, `seedAt(cur, t, out)`,
  `renderCutscene(alpha, dt)` (called by wp1-feel's `beforeCamera`), `moveCrane(dt)`, `updateEnding(dt)`. Cutscene objects
  carry `A` (anchors, read once), the ending also `lookShot` (TP look-up) and `fov0 / fov1` (crane FOV ends).
- DOM: `#wp1-eyelids` (two `#2a1a12` rounded panels, `pointer-events:none`), inserted right after `#crosshair` in `#ui`
  (r2 part 2; above the fade, HUD, dialogue, title and crosshair, under the veil / loading / menus / touch controls). Read: `ui.dlgEl.offsetTop /
  offsetHeight` (WP6 owns the box; a layout change there moves the FP dialogue framing with it).
- Look mods: `L.inDyaw / L.inDpitch` = this frame's raw look input, set every frame by `feel.look` (for target switching).

Events: none new. Consumed: `LAND` (impact), `DASH_START / DASH_END`, `HURT` (rel), `HIT` (swing kind), `TALK_START /
TALK_END`, `ITEM_GET / ITEM_DONE`, `BOSS_INTRO / BOSS_FIGHT / FIGHT_END`, `CUTSCENE_END`, `DOWN`, `RESPAWN`. `JUMP` is only
emitted by the debug helper (no take-off layer: feel §6 has none). Fields read: `player.grounded, vy, alt, sprint,
walkPhase, vel, state, wading, swingId, facing`, `game.fight.phase / id / t`, `game.vines[id].k` (fight.js's gate
state), `world.arenas[id] { x, z, r, h, entAng }`, `game.cutscene`, `game.trans`, `ui.menu / shop / dlgEl`, NPC `pos,
height, hop`, boss `pos, arena, height, lift, hurtbox()`. `T.intro.len` (2.4) must match fight.js's intro length.

Sounds (C8 names, silent until WP5): `eyelid` (lids open: vol 0.7; close: vol 0.5 rate 0.85), `whoosh` (the ending crane
leaves the eye). Existing: `seed`, `place`, `bloom` (cutscenes).

Settings read live (no new keys): `headBob, shake, speedFx, cameraRoll, reduceMotion, dialogueLookAt, lockTurnsCamera`
(+ the view's own).

## TUNE.view

Round 2: `tpSlide [0.55, 0.8, 1.1, −1, −1.6, −2, −2.6] → [0.55, 0.8, 1.1, −2, −2.6]`, `tpSlideCentre 0.8 → 1.5`,
`tpSlideCentreW 0.6 → 0.8`; new `tpSlideCross 7`, `tpOffEdge 0.5`, `tpLowSide 0.1`, `lock.fpLiftAt 0.5`, `lock.fpLiftPitch 10`,
`recenter { idle 2.5, speed 1.5, rate 1.5, max 40, side 0.25, near 10, back 135 }`, `talk.fitX 0.76 → 0.64`, new
`talk.bandMin 0.9, otsDist 4.5, otsBack 1.7, otsSide 0.75, otsH 1.35`.

Changed: `tpPivot 1.20 → 1.12`, `tpShoulder 0.55 → 0.80`, `tpBoom 3.0 → 2.6`, `tpPitch −6 → −4`, `tpPivotXZ 14 → 16`.
New: `tpPivotCenter, tpAirFollow, tpUpShort, tpDownLong, tpProbe, tpSoftProbe, tpLowTop, tpSlide, tpSlideCost,
tpSlideCentre, tpSlideCentreW, tpSlideEdge, tpSlideEdgeCost, tpSlideRate, tpSlideSpeed, tpPassR, tpPassGap, tpCanopyPad,
tpCanopyPull, tpCanopyPullMax, tpArmGrow, gate{ r, half, soft, top }, fitVMax, comfortShake, comfortDip, bob{},
strafeRoll, strafeRef, strafeLambda, rollCap, land{}, kick{}, hurt{}, dash{}, punch{}, sprintFov, sprintLambda,
sprintMin, sprintFull, sprintSpeedFx, fovMin, fovMax, ctx{}, lock{}, talk{}, item{}, intro{}, dizzy{}, eyelids{}, wake{},
place{}, ending{}`. `introShot / introIn / introOut` stay (fight.js reads them).

Review round 1 changes inside those groups: `tpSlide` gains 0.8; `ctx.ending 6 → 8`; `lock.liftBoom 1.0 → 2.0`, new
`lock.liftPitchHi 44, lock.liftPitch 14`; TP shot FOVs renamed to horizontal-at-16:9 keys: `talk.shotFov 42 →
talk.shotFovH 70`, `item.fov 52 → item.fovH 82`, `intro.fov 52 → intro.fovH 82` (same vertical FOV at 16:9, ±1°); new
`talk.faceFree 0.65, talk.nameTab 40, talk.fitX 0.76, talk.fitY 0.85, talk.shotMax 9, intro.fitX 0.8, intro.len 2.4,
place.seedScale 0.65, place.seat −0.04, place.fpLook 0.15, place.fovH 79, ending.tpBack 1.2, ending.tpSide 1.4,
ending.tpUp 2.0, ending.tpFovH 90, ending.craneFovH 79`; `place.tpBack 4.0 → 5.0`, `place.tpUp 1.4 → 1.7` (now absolute
height over the pedestal ground, was + 0.9), `place.tpSide` now on Pip's left.

## Debug (`G.debug.cam.*`, merged into the `G.debug.cam()` function)

`feel()` (comfort, FP layer state, speedFx, lock, cine), `land(impact = 7.4, surface)` / `jump()` (simulate C2),
`kick(p, y, r, eye)`, `fovPunch(d, in, hold, out)`, `trace(n, dt, each)` (frame-exact camera samples, manual clock),
`sample()`, `tune(patch)` (live `TUNE.view` patch, returns the old values), `framing()` (renders Pip's layer off-screen:
`{ pipH, pipTop, pipBottom, pipCx, clearM, camH, horizonY, armLen, … }`), `lockOn(target)`, `eyelids(k)`.

## What in ARCHITECTURE.md is no longer true

- §7 TP rig paragraph: numbers are now 1.12 / 0.80 / 2.6 / −4° (centre 1.45); the arm also slides, crosses thin trunks,
  keeps out of canopies, rides over low colliders and re-probes its ground-hug lift (see above). "a collider may pull the
  arm below tpArmMin" still holds.
- §7 `feel`: "null in F" → the wp1-feel module object; `kick / fovPunch / lockOn` are no longer no-ops.
- §7 FP rig: the layer stack lives in `FeelFP` (rig-fp.js) and reaches the eye through `M.eye`. r2 part 3:
  `RigFP.update(feet, dt, frozen, grounded, off, W, simT)` — the grounded eye-y smoothing is a critically damped spring
  (`TUNE.view.eyeW` 14), not λ 20 up / 26 down, and touchdown re-seeds it (exact until the render feet reach the ground).
- §7 `applyLook`: touch is `0.0050 / 0.0042 × touchSens × (1 + smoothstep(400, 1600, finger px/s))` rad/px (r2 part 3).
- §7 TP rig: the pivot follows the feet ramp-exactly (lag v/λ at any frame time); the side leg's pull-in is a spring toward
  the soft probe's target (the hard probe immediate), not "pull-in at once"; the boom shortens on narrow screens (≥ 1.8 m).
- §6 overlay order: `#wp1-eyelids` sits right after `#crosshair`.
- §16: `TUNE.view` holds far more (list above). §17: `G.debug.cam.*` helpers.
- §18: suites `wp1` / `wp1-heavy`.
- §19 (new deviation): fight.js still builds its static TP intro shot; on `EV.BOSS_INTRO` WP1 replaces it with a moving
  shot of the same priority, so fight.js's later `clearShot(f.shot)` is a stale-token no-op and WP1 hands back on
  `CUTSCENE_END` / `BOSS_FIGHT` (also after a V switch to FP mid-intro, where fight.js's FP branch is skipped for the same
  reason). The static shot and `introShot / introIn / introOut` can go when WP5 next edits fight.js.

## Deviations (for the lead to rule)

- **Ending FOV +8 (art §11: 70 → 78), not feel §6.7's −12 (70 → 58).** The WP1 brief stages cinematics per art §11, which
  gives this beat in full (pitch +35°, FOV 70 → 78, crane spline, card at 6.5 s), and a narrower view from the altar
  would crop the crown even at today's 9 m tree (at WP9's 19.8 m tree the crown top is ≈ 75° up from the altar). The first
  engineer had +6 unreported; it is now art's number and listed here. Feel's −12 is one TUNE value (`ctx.ending: -12`).
- **Lift boom +2.0 m (feel §10.8: +1.0 m).** At Frostbun's 6.5 m apex right above Pip, +1.0 m cannot hold the boss's middle
  and Pip's head in one 58.7° frame (needs ≈ 51° of the 54° usable; reached at ≈ 5.5 m back).
- **TP ending look-up from a short shot** beside and above Pip (art §11: "the crane starts at the TP camera position").
  The raw TP pose looking up +35° sits on the grass behind Pip's hood (a quarter of the frame); the crane now starts from
  the shot.
- **TP pedestal shot 5.0 m out, 1.8 m off Pip's left, 1.7 m up** (art: altar + (1.8, 1.4, 4.0); feel: toPip·4.5 +
  side·2.0 + 2.2 up): the side flips so Pip stands in the lower-left third (he was cut in the bottom-right corner), and it
  is fitted so he stays whole.
- **Pedestal seeds at scale 0.65** (was 1.1), seated 0.04 m into the slab: at 1.1 they covered the tree's face from the
  eye.

## Before / after numbers

| measure | foundation (8791) | first engineer | final |
|---|---|---|---|
| TP Pip height / crosshair clearance (village) | 28 % / 0.37 m | 33 % / 0.51 m | 33 % / 0.51 m |
| TP beside a wall on the shoulder side: Pip x / clearance | — | 0.50 W / 0.13 m (Pip under the crosshair) | 0.59 W / 0.35 m (other shoulder) |
| Round tree right behind Pip: arm | 0.52 m | slid, ≥ 1.5 m after 1.5 s | 2.6 m, no drop (crosses the trunk) |
| Adversarial walk (strafing and backing into colliders with yaw sweeps, 8 runs × 200 frames per region): woods pops > 0.4 m / frames arm < 0.5 / camera in Pip / mean arm | 11 / 382 / 17 / 1.95 | 14 / 292 / 29 / 1.78 | 3 / 135 / 4 / 2.15 |
| same, village: pops / arm < 0.5 / camera inside a collider | 9 / 225 / 14 | 10 / 113 / 7 | 6 / 103 / 0 |
| same, peaks: arm < 0.5 / inside a collider / camera in Pip | 356 / 1 / 99 | 253 / 11 / 7 | 194 / 0 / 7 |
| same, shores: pops / arm < 0.5 / camera in Pip | 6 / 284 / 31 | 8 / 224 / 52 | 2 / 166 / 27 |
| 300 random TP placements (heavy suite): inside a collider / under terrain / arm growth / inside a crown | — | 0 / 0 / 0 / — | 0 / 0 / 0 / 0 |
| FP dialogue eye ↔ face | 1.30 m (Digby 0.71 m) | 1.8 m | 1.8 m (NPC 47–61 % of the height) |
| FP boss intro: boss distance / height share at hand-back | 6.9–7.3 m / 26–36 % | same | 6.9–7.3 m / 29–40 % (FOV −10) |
| V switch mid-fight: per-frame move / rotation | — | 0.15 m / 0° | 0.15 m / 0° |

Review round 1 (reviewer scripts rerun on the fixed copy; "before" = the copy they reviewed):

| measure | before | after |
|---|---|---|
| FP bob, swing while walking after 15 s: largest per-frame Δ bobY / Δ roll (walking: 6.85 mm / 0.08°) | 11.1 mm / 0.56° | 6.5 mm / 0.08° |
| FP bob, swing after a short walk / dash after 15 s: Δ bobY per frame | 13.9 / 12.4 mm | 6.0 / 6.0 mm (≤ walking) |
| V (TP → FP) at intro 0.5 s / 2.2 s: mouse ignored after the fight starts | 1.48 s / > 3 s | 0 s / 0 s |
| TP new-game intro two-shot (Shellby 4.05 m away): Pip / speaker x | −0.10 (off) / 0.73 | 0.13 / 0.68 |
| TP two-shot at 2.3 m: Pip x | 0.20 | 0.21 (fitted; 1.3 m: 0.33 unchanged) |
| Portrait 390×844: two-shot Pip head x (h FOV) / item-get / boss intro Pip x | −0.18 (20.1°) / 0.44 / −0.39 | 0.28 (57.7°) / 0.49 / 0.22 |
| Arena entrance grid (54 poses per arena), camera behind the vine gate: woods / peaks / shores, no lock · lock | 4 / 2 / 6 · 9 / 10 / 10 | 0 / 0 / 0 · 0 / 0 / 0 |
| 240 hard placements next to colliders (12 000 frames): inside a collider / growth > cap / pops > 0.4 m / Pip hidden / mean arm | 2 / 4 / 50 / 23 / 1.80 | 0 / 0 / 41 / 19 / 1.85 (foundation 0 / 0 / 67 / 37 / 1.86) |
| Great Tree roots, 5 poses: Pip centre x | 0.18 / 0.23 / 0.15 / 0.18 / 0.24 | 0.22 / 0.23 / 0.15 / 0.22 / 0.24 |
| Frostbun live leap, TP lock, strafing: boss middle / bottom / Pip's head on screen in lifted frames | 103 / 224 middle (46 %) | 123–140 / 168 (73–83 %), 168 / 168, 168 / 168 |
| Ending crane at 144 Hz: frames without camera motion mid-crane / largest step | 301 of 505 / 0.12 m | 0 / 0.05 m |
| `L.inDyaw` after a TP lock ends (dyaw 0) | 0.11 (stale) | 0 |
| FP dialogue on an 844×390 phone: face from the top / box top | 0.42 (on the box edge) / 0.53 | 0.28 / 0.53 |
| `view.update` CPU, TP woods walk (mean / p99, 0.1 ms timer) | 0.17 / 0.6 ms | 0.12–0.16 / 0.6 ms (foundation 0.04 / 0.2) |

## Round 2 (integration) numbers

| measure (tester script, rerun on this copy) | merged | r2 |
|---|---|---|
| s1b: 264 TP poses with Pip's back to obstacles, both shoulders: bad (hidden / edge / under the crosshair / Pip < 20 % H) | 121 | 26 (back to a house wall, a cliff, a pine skirt: Pip dithered or at 0.85–0.95 W) |
| s1b: mean arm | 1.70 m | 2.16 m |
| s7: Pip's back 0.3 m from the altar / signs / boulders: arm | 0.35 (hidden) / 0.35 / 0.35 | 2.23 / 2.16–2.6 / 1.41–2.4, all visible |
| Great Tree roots (Pip walks in from 12 m, boom into the roots; 7 bearings): arm ≥ 1.2 m and Pip shown | 2 of 7 | 6 of 7 (5.4 rad: a root wall right behind him, Pip hidden) |
| s6 natural walks, 300 framed frames per region: under the crosshair village / woods / peaks | 45 / 44 / 16 | 14 / 32 / 24 |
| s6 peaks: Pip hidden / arm < 1.2 m / pops > 0.4 m | 29 / 107 / 9 | 2 / 19 / 7 |
| s7: FP → TP blend, first frame Pip is drawn | solid, 22 % of the screen at 0.50 m | fade 0.05 at 0.50 m, 0.41 at 0.66, 1 from 0.98 m |
| s10: TP two-shot at 4 m, Shellby's face in sight / Pip x | blocked by the altar / 0.12 W | in sight / ≥ 0.18 W for every NPC |
| phone intro two-shot (Shellby 7.6 m): Pip head NDC portrait / landscape | −0.91 / −0.76 (behind the name tab) | −0.55 / −0.18 (over-the-shoulder, Shellby in sight) |
| phone portrait pedestal shot: Pip head NDC | −0.95 | −0.80 |
| FP lock, 60° flick then idle: yaw off the target after 0.75 s | pulled back to 4–50° | 60° (WP4 releases it) |
| FP lock on Frostbun's leap: view pitch / landing disc on screen | 64° / 0 of 62 frames | ≤ 10° (disc in view) |
| FP lock held while reading a sign / talking: drift off the speaker | 66° / 48° | 0° |
| s8 Frostbun leap near the gate (TP lock): boss middle on screen / fenced frames | 21 / 46 of 56 | 28 / 0 of 56 (the arm still dips to 1.22 m there: something behind the arena edge, not the fence; the other 5 leaps 50–56 of 56) |
| ending crane: height over the plaza | 1.0 m | 10.9 m (`W.shots.endingCrane`) |

## Round 2, part 2 (integration)

What changed (all inside the view cluster; no foreign edits in this part):

- **Fight FOV** (`feel.ctxFov()`): the boss fight's +`ctx.fight` (3°) rides the eased context channel with the cinematics'
  values (FeelFP's ctx tween, `ctx.inT / outT`) instead of being added unsmoothed (`FeelFP.fight` is only its share, for
  `info()`). It popped 3.04° in one frame at the intro's hand-back and −3° at the defeat / FIGHT_END.
- **TP sight** (`RigTP.sees(W, x, y, z)`, `sideIn(W, c, d, want)`, `sightLen(W, S, back, right, offL)`, fields `sighted`,
  `noSight` (debug: true turns the rule off)): the boom is probed from the slid / side-leg shoulder, so the straight line
  back to Pip could cut a corner the boom went round. With Pip's back to the 1.35 m altar the slid camera ended behind the
  slab, Pip wholly occluded (a grey wall over two thirds of the screen; 8 of the 12 altar poses of the s1b sweep). Now the
  arm comes in at once (released like any pull-in) until the camera sees the pivot and — when it is the sight, not a wall,
  that stops the offset-scale move toward Pip's line — keeps his centre within `tpSightEdge` (0.72 NDC); that sideways move
  never rounds a corner out of his sight. "Sees" = a clear line to the pivot or to ± `tpSightW` (0.3 m) across it along
  the camera right (a post or beam that hides only the middle is the occluder dither's job: Pip's back to a house wall
  keeps the r2 framing). Low colliders and thin trunks / posts (PASS kinds, r ≤ `tpPassR`) never block the sight line. Pip's back flush against the altar has no TP framing that shows him whole: the camera comes in beside or into
  his head (Pip dithered by the screen edge, or hidden), the plaza ahead in clear view — as against a house wall.
- **Trunk in front of the camera** (fields `noPass`, `trunkT`): a thin trunk the unslid boom crosses with its Pip-side face
  within `tpPassNear` (2.2 m) of the camera, for `tpPassNearT` (0.4 s, Pip standing still), turns the slide's scoring to
  "crossed trunks are walls" for that frame, so the camera eases round it (here: over the other shoulder) instead of parking
  behind it with the crosshair and the target hidden. Walking past a trunk changes nothing; the hard probe still crosses it
  (no pop), and a slide that would leave Pip under the crosshair is no candidate then (in dense woods the trunk stays).
- **Dizzy drop vs the side leg**: `sideRoom` measures the shoulder's room from the pivot without `pivotDrop`. With the pivot
  dropped 0.5–0.6 m the room at Pip himself went negative, the leg snapped from 1 to 0 in one frame and the camera jumped
  0.8 m sideways (0.54 m in a V blend, which is how it was found).
- **Two-shot** (`Cine.twoShot`, `badShot`, `fitShot(…, vMax)`): over-the-shoulder candidates are tried at every distance
  (`talk.otsNear` 0.15 extra cost under `otsDist`); a candidate whose camera ended within `talk.minLook` (1.4 m) of its look
  point or with a subject behind it / within `talk.minDepth` (0.6 m) is out (−20); Pip on the left is worth
  `talk.leftBonus` 0.6 (was 0.3), so a blocked preferred side goes over the shoulder before it flips; a side shot pulled in
  to under half its clear length is refitted from Pip's head when that keeps more of it (the look point stood in Miso's
  counter); the dialogue shot widens at most to `talk.fovMaxV` 60° (was `fitVMax` 100°). At Miso's counter the shot was the
  camera inside Miso at 100° (hFOV 129.5°) with her face behind it.
- **FP dialogue with a back-hopping speaker** (`Cine.fpTalk(intro, retarget)`): the face is taken where WP5's talk back-hop
  will land (`npc.backHop`), at rest height (no greeting hop), and while the hop runs the framing is redone each frame
  (`view.retarget`, limits, eye back-off). Ribbit at 0.8 m: eye ↔ face 1.95 → 1.80 m, face 0.45 → 0.42 H from the top.
- **Eyelids above the crosshair**: `#wp1-eyelids` is inserted right after `#crosshair` (fallback: after the fade), so they
  cover the HUD, the dialogue, the title and the crosshair, and sit under the veil, loading screen, menus and touch
  controls. The ending's blink-back resets the crane shot under closed lids, which let the crosshair (shown at shotW < 0.5)
  float on them.

New TUNE.view keys: `tpPassNear 2.2, tpPassNearT 0.4, tpSightEdge 0.72, tpSightW 0.3`; `talk.otsNear 0.15, leftBonus 0.6, minLook 1.4, minDepth 0.6,
fovMaxV 60`.

| measure (tester script, rerun on this copy) | before | after |
|---|---|---|
| p9 / wp1 'fight FOV': largest per-frame vertical FOV step at the boss intro's hand-back / at the defeat | 3.04° / −3° | 0.85° / 0.16° |
| q-plaza (0, 8), Pip's back 0.34 m from the altar: what the camera shows | behind the slab, Pip occluded | in his head (hidden), clear view |
| q-altar / s1b: Pip's back 0.3 m from the altar at 6 bearings × 2 shoulders: the camera behind the slab (Pip occluded or half hidden) | 8 of 12 | 0 (Pip dithered by the screen edge in 6, hidden in 2; s1b's framing metric, which ignores occlusion, now lists these 8 as edge / hidden) |
| s1b (264 poses) and s6 natural walks (4 regions × 900 frames), everything else | — | unchanged (s6 under the crosshair 13 / 34 / 25 / 0 vs 14 / 32 / 24 / 0) |
| i-tpframe plaza ring (24 poses): arm < 1 m (Pip hidden) / Pip occluded by the altar | 0 / 1 | 1 / 0 (the same (0, 8) pose) |
| q-trunk: Pip still, a round trunk on the boom 1.0 m in front of the camera: frames it covers the crosshair (of 90) | 90 | 32 (the first 0.4 s + the swing over), pop ≤ 0.12 m |
| q-dizzy: V 20 frames into the topple, largest per-frame camera move | 0.81 m | 0.16 m |
| miso-keys / miso.mjs: TP dialogue at the counter (lx 0.55 / standAt / 1.3 / 1.8 m) | vFOV 100°, camera 0.72 m from Miso, face behind it | vFOV 43°, camera 3.5 m from Miso, Pip −0.41 / Miso +0.14 NDC |
| s10b: two-shots with all 6 NPCs at 4.0 / 2.4 / 1.3 m: Pip right of the speaker / FOV widened | 4 of 12 / — | 0 of 18 / 0 |
| q-fptalk: Ribbit / Shellby at 0.8 m, eye ↔ face, face from the top | 1.95 m, 0.45 H | 1.80 m, 0.42 H |

## Round 2, part 3 (integration)

What changed (view cluster only; no foreign edits):

- **FP eye height** (`RigFP.update(feet, dt, frozen, grounded, off, W, simT)`, view.js passes `game.clock.simTime`; fields
  `eyeV, feetY, air, landT`):
  - *Landing re-seed* (feel §4.7): on the first grounded frame after an airborne one, for the rest of the landing step
    (same `simT`: the render feet still interpolate from the last airborne step) and on the first frame of the next step
    (where they reach the ground) the eye is exact (`eyeY = feet + eyeH`, `eyeV = 0`); the filter takes over from there.
    It used to engage half a step above the ground and soak up 2 cm of the landing spring: a real held jump dipped 5.7 cm
    at 100 ms (the spring alone gives 7.6).
  - *Grounded smoothing* is a critically damped spring of ω `eyeW` 14 (replaces the first-order `eyeUp / eyeDown` λ 20 /
    26), sub-stepped at ≤ 1/480 s with the target moving linearly over the frame, so it smooths the eye's acceleration at
    any frame rate. The first-order filter passed the 1 m bilinear terrain kinks (the feet's vertical speed jumps between
    two frames) through as an acceleration step of λ·Δv. Trade-off: the eye trails the feet by 2·v/ω on a slope (≤ 0.21 m
    on the steepest peaks path, 0.07 m mean, ≤ 0.09 m in the meadow); a higher ω cuts the lag and raises the accel
    (offline sweep on the peaks trace: ω 10 / 14 / 20 → p95 4.7 / 5.6 / 7.9 m/s², lag 0.27 / 0.21 / 0.16 m). Feel T22's
    p95 ≤ 4 m/s² is not reachable on today's peaks path at any acceptable lag: its feet are ≈ 1.8× rougher than the
    fixture T22 was written for (p95 23.5 / max 63 m/s² against 13.3 / 40.7).
- **TP pivot** (`follow(x, u0, u1, λ, dt)` in rig-tp.js, field `pu` = last frame's target): the pivot is a first-order
  follower that is exact for a target moving linearly over the frame, so its lag behind a steady walk is v/λ at any frame
  time. `damp`'s per-frame lag v·(dt/(1 − e^−λdt) − dt) changed with dt, and the camera's speed behind a constant 4.4 m/s
  walk wobbled 3.91–4.74 m/s at uneven frame times (Pip shifting ≈ 1 cm a frame on screen).
- **TP side leg** (`legV`): the pull-in is a critically damped spring of ω `tpLegW` 18 toward a soft target (the soft
  probe's clear length + `tpSoftProbe − tpProbe`: the same as the hard leg against a wall square to it, shorter before a
  grazing contact); only the hard probe stays immediate (the shoulder point must never enter a collider's probe margin:
  `W.probeSegment` ignores a collider the boom starts inside). The release is unchanged (λ `tpArmRelease`). Orbiting at a
  constant stick past a village lamp post the leg dropped 1.00 → 0.90 in one frame (the camera moved 16 cm, 9.8 m/s
  against a steady 5.2).
- **Narrow screens** (`RigTP.narrow`, set by view.js = tan(vFOV/2 at 16:9) / tan(vFOV/2 now)): the boom × narrow, never
  under `tpNarrowMin` 1.8 m (nor under the wheel length). Portrait 390×844 (vFOV 100°): Pip 15 % → 21.7 % of the height,
  arm 2.6 → 1.8 m. RULINGS' 28–36 % is not reached there: a shorter arm would put Pip under the crosshair in the 57.7°
  horizontal FOV (the arm's offset scale keeps his centre within `tpOffEdge` of the middle; crosshair clearance 0.27 m at
  1.8 m). Landscape phones and 16:9 are unchanged (narrow = 1).
- **Touch look acceleration** (view.js `applyLook`, feel §3.4): touch deltas × (1 + smoothstep(400, 1600, finger speed
  px/s)); the speed is this frame's travel over the time since the last frame that brought any touch movement (touch
  events may come at 60 Hz on a 120 Hz display), at most 1/30 s back. 844×390: a slow 400 px swipe turns 114.6° (as
  before), a 400 px flick in ≈ 0.1 s 229.2° (was 114.6°).

New TUNE.view keys: `eyeW 14` (replaces `eyeUp, eyeDown`), `tpNarrowMin 1.8`, `tpLegW 18`.

| measure (tester script, rerun on this copy) | before | after |
|---|---|---|
| a-move3 landDip, full held jump (impact 7.63): dip / at (frames after the land frame, incl. it) / overshoot | 5.68 cm / 100 ms / 6.7 mm | 7.32 cm / 67 ms / 6.7 mm (144 Hz 7.39 cm, uneven dt 7.34 cm) |
| a-move2 slopes, 3 s walks: eye base accel p95 / max (m/s²) peaks / meadow / shores | 15.1 / 34.0, 7.8 / 18.6, 3.6 / 7.7 | 7.9 / 9.7, 4.4 / 5.5, 1.9 / 2.6 (peaks 144 Hz 8.1 / 9.9, uneven 8.3 / 10.3) |
| same: eye lag max / mean, peaks | 0.07 / 0.02 m | 0.21 / 0.07 m |
| c-tp2 village orbit (constant stick): camera speed max / median, frames with a > 0.8 m/s step | 9.79 / 5.18, 2 (uneven dt 4) | 6.28 / 5.17, 0 (uneven dt 6.26, 0) |
| d-smooth tpUneven: camera forward speed behind a 4.40 m/s walk | 3.91–4.74 | 4.400 every frame (144 Hz: the start-up transient only, monotone 4.27 → 4.40) |
| pF-orient (844×390): slow 400 px swipe / 400 px flick | 114.6° / 114.6° | 114.6° / 229.2° |
| pE-compose portrait 390×844, TP village: Pip height share / arm | 15 % / 2.6 m | 21.7 % / 1.8 m (landscape 31.8 %, unchanged) |
| no regression — s1b (264 TP poses): bad poses; s6 natural walks village / woods / peaks: under the crosshair, pops > 0.4 m | 38; 13 / 34 / 25, 0 / 4 / 7 | 38 (one edge ↔ under-the-crosshair swap); 13 / 33 / 22, 0 / 4 / 8 |

New `wp1` checks: 'r2 part 3: a real jump lands with the full dip … walking the peaks path the eye smooths the terrain
kinks', 'r2 part 3: TP at uneven frame times — a steady 4.4 m/s walk moves the camera at 4.4 m/s every frame; orbiting
past a post the side leg never jumps', 'r2 part 3: touch look accelerates with the finger speed', 'r2 part 3:
a portrait screen shortens the TP boom with the vertical FOV'.

## Round 3 (third person: view-tp)

What changed (`rig-tp.js`, `lockon.js`, the TP lines of `view.js`, `tune.js` TP keys, `wp1.js`; no foreign edits):

- **Pip's feet stay on screen with a short arm** (`RigTP.feetDrop`, last step of `update`; field `drop`): when the arm is
  short (a lamp post, a wall or a pine behind Pip) the camera point drops until his feet sit inside NDC −`tpFeetY` 0.9 at
  the look pitch (a look up counts as level), fully from `tpFeetArm` 1.2 m of arm, fading out toward `tpFadeBody` (he
  dithers below), at most `tpDropMax` 0.55 m, eased (λ `tpDropRate` 10), never under the camera floor at the camera point,
  into a collider along the lowered boom, or out of his sight. The open 2.6 m boom never drops. `drop` is part of the
  crosshair ray's height: `view.freezeAim` (`sy = pivot.y + lift − drop`) and the TP lock framing (`pivY`). The lead's
  `tp-peaks` pose: arm 1.62, feet at the bottom edge (pipBottom 1.00) → drop 0.30, feet at 0.955 H, Pip 56 % of the height.
- **Lock-on walk-in** (`LockCam.look`, TP): for a non-boss target the shoulder-parallax term is taken at no closer than
  `tpLockParD` 3 m (`asin(side / max(d, 3))`): walking from 6 m into a locked slime the camera turned 56° (peak 116°/s over
  0.25 s, 166°/s in a frame); now 7.8° (peak 14°/s). The slime sits a little left of the crosshair up close (NDC x −0.14),
  in front of Pip; WP4 aims the swing at it (`faceYaw`). Bosses keep the exact term.
- **Frostbun's leap under a TP lock** (the round-2 "arm dips on the 6th leap", cause found): looking up 40°+ at the lifted
  boss points the long lock boom into the ground behind Pip; with the hug lift capped at `tpHug` 0.6 m the fit cut the arm
  to 2.7 m (1.2 m on a rise) and the boss's middle left the frame. While a locked boss is lifted > `lock.liftAt`, LockCam
  sets `tp.lockHug = tpLockLiftHug` 1.0 m (eased in the rig as `lockH`, λ `lock.liftW`), added to `hugMax` / `hugCap`.
  s8 (6 forced leaps, AI on, strafing): arm min 2.69 → 4.21 m, boss middle on screen 291 → 336 of 336 lifted frames;
  wp1-heavy live test 168 / 168.
- **Low colliders the camera rides over** (`pruneLow(p, back, L, fresh)`): one that was floor last frame stays floor while
  the arm is past its footprint's near edge; the fit then brings the arm in along the hug's limit, continuously, and it
  becomes a wall once the camera is in front of it. The wall verdict used to flip at once: arm snapped in, the lift and the
  shoulder leg dropped in one frame (backing into the altar 1.2 m; natural peaks walk 0.5–2.4 m pops). With it,
  `hugCap` (the physical limit while an eased pull-in runs) is `tpHug + tpHugEase` (0.4) (+ `lockH`); the framing fit keeps
  `hugMax`. Backing into the altar: max camera move per frame 1.20 → 0.17 m.
- **Canopy pull-in never through a crossed trunk** (`behindTrunks(S, back)`, `_crossed` recorded by the main boom probe):
  the eased canopy pull-in stops `tpPassGap` behind a trunk the boom crossed (just inside the padded crown); before, the
  re-probe snapped the camera to the trunk's near side (1.6 m in one frame, woods walk frame 890). A camera point that comes
  within `tpPassGap` of a crossed trunk steps back out of the gap (`pushOut`) when the boom is long enough.
- **Slide scoring sees what the sight rule sees** (`slideScore`): a candidate whose camera point would not see Pip scores as
  a collapsed arm. Pip's back to the (now round, r 1.02) altar: the slide round the slab ended at 1.4 m with Pip solid in
  the corner (0.09 W, cut off; 12 of 12 s1b poses); now 8 of 12 come into his head (hidden, view ahead clear) and 4 of 12
  frame him whole at the edge (0.07 / 0.96 W, arm 1.0).
- The Settings rows "Camera drifts behind Pip" / "Pip faces where you look (third person)" checked with a fake standard
  gamepad, real keys + mouse deltas and CDP touch drags (`agents/r3-view-tp/settings.mjs`): pad / touch recentre drifts
  toward the travel (diagonal run ≈ 28°/s, sideways a quarter, backpedal none), never for keyboard / mouse; body-faces
  strafes with the body on the look (0°) for pad, keys and touch; the A swing goes to the crosshair (≤ 2.2° off the aim)
  either way; a pad lock (R3) faces the target (−4.9°) and frames it; dialogue holds the camera and Pip.

New TUNE.view keys: `tpFeetY 0.9, tpFeetArm 1.2, tpDropMax 0.55, tpDropRate 10, tpHugEase 0.4, tpLockParD 3.0,
tpLockLiftHug 1.0`. New `RigTP` fields / methods: `drop`, `lockHug` (set by LockCam) / `lockH`, `pushOut`, `_crossed`,
`feetDrop(W, feet, cam, back, pitch, tanHalf, dt, fresh)`, `behindTrunks(S, back)`; `pruneLow` takes `fresh`; `info()` has
`drop`. New wp1 checks: 'r3: TP lock-on walk-in …', 'r3: a short TP arm … keeps his feet on screen …', 'r3: TP lock on a
boss lifted 6.5 m … arm ≥ 3.6 m …', 'r3: backing into the altar the TP camera never jumps …'.

| check (agents/r3-view-tp/) | merged tree | round 3 |
|---|---|---|
| s1b 264 TP poses: bad (excl. the gtroot body metric; a hidden Pip counts as 'small'), Pip's feet cut with arm > 1.2 m | 42; 63 | 42; 26 |
| s6 natural walks village / woods / peaks: pops > 0.4 m, max | 1 / 4 / 8, 0.61 / 1.68 / 2.44 m | 1 / 4 / 5, 0.61 / 1.60 / 0.83 m |
| s6 peaks: Pip hidden / arm under 1.2 m (frames) | 2 / 12 | 0 / 0 |
| s6 under the crosshair (clearance < 0.25 m) village / woods / peaks | 0 / 34 / 22 | 0 / 36 / 19 |

## Round 4 (final gate)

- **TP talk two-shot: the face past Pip** (`Cine.pipHides(pos, q, P)`, used in `twoShot`'s candidate scoring): a
  candidate sees the speaker's face only if the line from its camera to the face also clears Pip — within `talk.pipR`
  0.4 m of his axis, between his feet and `talk.pipTop` 1.45 m (head, sprout, the raised sword), between the camera and
  the face. From Elder Shellby's altar side (+60°, 1.3 / 2 m, `standAt`) every side shot was blocked by the roots and the
  altar and the over-the-shoulder shot won with Pip's head and sword over her face; now a fitted side shot (1.3 m) or the
  mirrored side (2 m) wins. The over-the-shoulder shot still wins for speakers past ≈ 2 m whose side shots are blocked.
  Measured (`S/agents/r4-fix/talk.mjs`, 29 talks: Shellby 5 bearings × 2 distances + `standAt` ×2, Ribbit / Clover / Hoot /
  Digby 3 bearings, Miso): face inside Pip's box 3 → 0. Sheet `S/agents/r4-fix/talk-shellby-after.jpg`.
- **`G.debug.aimAt` in TP** (still-open item; tool accuracy only): it iterates from the camera the rig settles at for the
  candidate look — `view.setLook`, then 45 `view.tp.update` steps of the live rig (its slide, side leg, pull-ins and feet
  drop; the frames that follow would take it there anyway) — and aims from that camera, keeping the best of ≤ 12 looks.
  The old formula assumed the nominal boom and shoulder: misses of 0.3–1.6 m with a slid or shortened arm (12 village
  poses, `S/agents/r4-fix/dbg3.mjs`) → ≤ 2 mm in 11 of 12. The 12th is bistable: the slide flips shoulders with the aim
  (a trunk beside the boom), so no look hits it exactly; aimAt keeps the best it found (≈ 0.4–1.3 m there).
- Tests (wp1): "r4 TP talk two-shot: the speaker's face is never behind Pip …", "r4 G.debug.aimAt in third person …",
  and "r3: backing into the altar …" now checks the second half of its name (every pose ends `sighted` or with Pip
  hidden, fade < 0.05; drawn → his head and chest in the frame).
- TUNE: `view.talk.pipR` 0.4, `view.talk.pipTop` 1.45.

## Known limits

- Round 3: in a dense wood a crossed trunk whose gap the sweeping boom reaches, with no room behind it inside the boom
  length, still snaps the arm in to its near side (one 1.6 m frame in the 900-frame woods walk); the side leg can still
  drop 0.4–0.8 m sideways in a frame when a trunk enters the shoulder leg faster than its spring (3 frames in the woods /
  peaks walks). Pip under the crosshair in dense woods (36 of 300 sampled frames) is unchanged: trunks on both sides hold
  the shoulder leg in.
- Round 3: Pip's back flush against the altar at 4 of 12 bearings frames him whole but at the screen edge (arm 1.0); a
  flush house wall keeps the round-2 behaviour (dithered at 0.85–0.95 W, or hidden).
- Round 3: "Camera drifts behind Pip" follows the feel spec (≤ 40°/s toward the travel): with a camera-relative stick held
  diagonally Pip runs in a wide circle (≈ 9 m radius) while the camera follows; sideways a quarter of that.
- Portrait phones (TP default there): Pip is 21.7 % of the height, under RULINGS' 28–36 % (see part 3: the narrow
  horizontal FOV and the crosshair clearance cap the boom at 1.8 m). Accepted by the lead (round 3: ≈ 22 %).
- TP slide onset: a slide starts at its full speed (2.4 m/s sideways) in one frame, and a pose on a slide decision's
  boundary can pick one for a single frame (a 4 cm step out, eased back). An acceleration limit (tried in part 3) held the
  slide back where it is the way out and let the arm fold toward Pip walking into the altar, so it was not kept.
- FP eye on steep slopes: the critically damped eye trails the feet by up to ≈ 0.2 m (the eye sits lower climbing, higher
  descending, and settles in ≈ 0.3 s when Pip stops); feel T22's p95 ≤ 4 m/s² is not met on the peaks path (7.9).
- Pip pressed against a standing vine gate (Pip's arena clamp is r − 0.3, the fence r + 0.4) with the camera facing into
  the arena: the arm is ≈ 0.7–1.4 m, as against any wall (Pip dithers / hides; a boss lock cannot hold the boss and Pip
  then). The alternative was the view from behind the vines.
- Great Tree roots at one pose (angle 2.6 rad in the review set) only the far slide (1.1 shoulder units) is clear of the
  roots: Pip's centre sits at 0.15 W there (whole, by the left edge). The edge penalty prefers the nearer slides wherever
  they are clear.
- `view.update` costs ≈ 3× the foundation's (0.12–0.16 ms mean in TP woods): the slide, canopy, fence and fit probes, not
  allocations (the per-frame objects / closures the review listed are gone).

- Pine skirts in this copy start at 0.9·s: walking right next to a pine in TP puts the shoulder point inside the lowest
  tier, where no arm length helps, so the view shows the skirt's inside (and the FP eye at 0.88 m grazes it too). WP9 raises
  the skirts to ≥ 1.55 m; the canopy keep-out then handles the rest (looking down, slopes) as long as `COLLIDER_H.tree_pine /
  tree_snow.cam` stays the underside of the lowest skirt.
- Backing into a bush, boulder or wall still shortens the arm at once (no thin-pass: bushes are not dithered, boulders and
  walls are thick); Pip is then hidden under 0.45 m. The slide removes most of these, not all.
- Pip's dither by `view.bodyFade` needs WP2; until then he is either drawn solid or hidden.
