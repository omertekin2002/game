# WP2: player presentation (first-person hands + swords, third-person body)

What WP2 adds or changes. The lead folds this into `docs/ARCHITECTURE.md` after the merges. The package was started by
one engineer and finished by a second one; this file describes the code as it now stands.

## Files

| File | What |
|---|---|
| `js/view/viewmodel.js` | module `wp2-viewmodel`: viewmodel pass, pose state machine, swing sync, motion layers, item presentation, lights, FP boots |
| `js/vm/anim.js` (new) | pose math: `Pose`, `slashPose`, `chopPose`, `recoverPose`, `vmDir`, `armDir`, `sweepAt`, `chopAt`, `sweepTimeAt`, `chopTimeAt` |
| `js/vm/rig.js` (new) | procedural meshes: `buildArm` (skinned, 2 bones), `vmSwordBuilt(shiny)`, `potionGB(T)`, `bootBuilt()`, `vmOutlineMat(width)`, `VM_COL` |
| `js/vm/fx.js` (new) | `VmTrail` (FP blade ribbon), `VmSparks` (sparkles / hearts, one Points call), `raysCard()` (fx_raysburst disc) |
| `js/vm/boots.js` (new) | `Boots`: Pip's boots under the FP eye when looking steeply down |
| `js/vm/dither.js` (new) | `ditherToon(mat, u, rim)` / `ditherOutline(mat, u)`: Bayer dither + i-frame shimmer + TP rim multiplier |
| `js/player-body.js` | TP body: strafe / backpedal / air / landing poses, swings synced to the sweep, shimmer, dither, rim, held item |
| `js/fx-trail.js` | world `SlashTrail` (TP): follows the sim sweep (A/B tilted crescent, C vertical) |
| `js/debug/tests/wp2.js` | suites `wp2` (23 tests, in `'all'`) and `wp2-heavy` (2 tests; run the page at 1920×1080) |
| `js/tune.js` | `TUNE.vm` block only |

No edits outside these files.

## The viewmodel (`wp2-viewmodel`)

- **Pass.** Own `scene` + `camera` (vFOV `TUNE.vm.fov` 54°, widened on narrow screens by `vmFovFor(aspect)`, near 0.01,
  far 5), world axes translated to the eye, drawn in `afterRender` after `clearDepth()` (autoClear and shadow updates
  off). One pass now: the foundation's separate FP item-get pass (`present` group on `LAYER.PRESENT`, `renderPresent`,
  `updatePresent`) is gone; the presented item lives in the vm scene.
- **Rig.** Each arm is ONE skinned mesh + ONE ink hull with two rigid bones (forearm, hand), so an arm is 2 draw calls
  however it bends. The hand bone carries a fist (sword), an open paw (item / chest / seed) and, on the left arm, the
  paw holding the potion bottle, chosen by draw range. Colours (lead + art §1.2): warm peach skin `#ec9e6c`, brown
  bracer `#6e4026` with a stitched rim, cream cuff `#f4e4c1`, his tunic's cream sleeve `#e2c896` (was leaf-green
  `#86b443`, unlike the sleeve of his world model; a lathe that tapers toward
  the elbow and rounds off 25 cm up the forearm; the elbow puff and the olive capelet sphere are gone: in swings the
  elbow end is the part nearest the eye, and the old tube + puff + capelet ballooned across the frame). Swords:
  `vmSwordBuilt` (close-up proportions, one-piece steel blade; starter: iron guard, leather grip ending inside the fist;
  shiny: bright steel, gold guard, blue grip; no pommel: the grip's axis runs into his wrist, a pommel sat on the bracer).
- **Rest composition.** Solved per aspect from NDC targets: grip `restHand` (0.50, −0.60) at 0.40 m, tip `restTip`
  (0.32, −0.12) = feel §7.2's (0.66 W, 0.56 H), roll `restRoll` 15°. The portrait targets `restHandPortrait` /
  `restTipPortrait` blend in over aspect 1.2 → 0.9 (no jump at a square window). Wider than 16:9 the rest keeps its
  16:9 width, shifted right just enough that the tip stays at ≥ `restTipMinX` NDC (32:9: tip at 0.63 W, out of the box).
  The forearm points at `shoulderR` (low, to the right, a little ahead of the eye) so bracer, cuff and the sleeve
  run into the bottom-right corner. No blade sample in the centre box at 16:9, 21:9, 32:9, 4:3, 844×390, 390×844 and
  every aspect from 0.9 to 1.25. Swings aim the forearm at `shoulderSwing` (low): the sleeve rises out of the bottom
  edge instead of crossing the screen to the right-hand corner.
- **Swings (synced to the sim).** Generated, not keyframed: the blade always passes through the sweep point K = the
  sim's sweep bearing (A/B, `combat.sweepAt`) or chop pitch (C, `combat.chopAt`, floored at `chopFloor` −27° so it
  stays on screen) carried into the vm camera (same pixel as in the world camera), so the blade crosses the crosshair
  in the same frame as the hit test. The hand follows a Bézier path (`pathA/B/C`); wind-up with anticipation lift,
  outCubic sweep, follow-through that keeps travelling (`followA/E` wrap: A falls left, B ends upright on the right;
  r3: eased in and out, it runs on under the recovery), hold to `holdTo` / `chopHoldTo`, low recovery through the `carry`
  pose into the rest with a 6 % overshoot (r3: the A / B grip never below `recFloor`; see Round 3). Render time =
  `attackT − (1 − alpha)·STEP` (interpolated like the world). On `EV.HIT` (enemy / boss) or `EV.CLINK` the module
  solves the attackT at which the sweep reached the target (`sweepTimeAt` / `chopTimeAt`) and shows that contact pose
  for every frozen frame of the hit-stop, with a ±8 mm 30 Hz buzz, then catches up with the sim within ≤ 3 frames and
  kicks the blade back 4° (boss 6°). Clink: the blade bounces back 20° in 60 ms and returns. A/B tilt the slash plane
  toward the nearest enemy ahead (`aimElev`) so a slime at your feet is cut, not passed over.
- **Trail.** `VmTrail` ribbon from 60 % of the blade to the tip (`trailFrom`), sub-sampled 4× per frame from the exact
  swing poses, 0.10 s life, frozen during hit-stop. A crescent: full width at the blade, narrowing toward its old end;
  across it a soft body, a bright core and a thin warm-brown outer edge, so it keeps its value contrast over a pale sky
  (the old cream-only band vanished there); `fx_slash_swoosh` streaks in the body when present. Wood warm cream / brown
  edge, shiny gold / amber edge (normal blending) + 3 glints per shiny swing and a glint every 0.35 s on the resting
  shiny blade. All vm sparkles use a cosmetic `mulberry32` (render frames never draw on the sim's seeded Math.random).
- **Keyed poses / states** (`pickMode` priority dizzy > item > seed placing > chest > dialogue > boss intro > sprint >
  rest): `talk` (any `ui.dlg`, sword lowered), `guard` (`game.fight.phase === 'intro'`), `item` (both paws cradle the
  item at `itemNdc`, rays disc behind it, 12–18 sparkles), `chest` (`EV.CHEST_OPEN`: both palms push the lid),
  `seed` (pedestal cutscene with the camera in the head: the paws alternate holding the next seed), `sprint` (carry
  pose + the left fist pumping into the bottom edge), `dizzy` (sword drops out of view: `dizzyY` × the vm camera's
  vertical tan scale vs 16:9, so the widened portrait camera loses it too; the left paw flops), dash (both
  fists tuck, the left at its mirror spot), potion (`EV.POTION`: left paw raises, tilts, lowers the bottle; cork pop,
  6 pink hearts rising in screen space; a swing cancels it, and the chest push). Hidden (lowered out) in TP (first 0.15 s of the switch),
  during camera shots (`shotW`), menus and the shop.
- **Item above the dialogue box.** While an item is presented the module reads `ui.dlgEl.getBoundingClientRect()` and
  lifts item + paws (NDC, eased λ 10) until the item clears the box top (phone landscape: +0.17 NDC).
- **Motion layers** (× `headBob`, 0 with `reduceMotion`; state jolts stay at half strength): look sway (rotation +
  position lag, λ 12), figure-8 stride bob on `walkPhase`, strafe roll, forward pull-back, idle breathing, jump lag on
  `player.vy`, one landing spring kicked by `EV.JUMP` (`jumpDip` 2.5 cm) and `EV.LAND` (`landDip` 3.5 cm × impact/8),
  hurt jolt on `EV.HURT` (`hurtY` −5 cm, ±7° roll away from `rel`, pitch kick), i-frame flash 0.35 at 8 Hz (hurt
  i-frames and the 1.5 s respawn grace, `EV.RESPAWN`; with `reduceMotion` a steady `flashCalm` 0.18 tint for the same
  window, so nothing flickers above 3 Hz, WCAG 2.3.1) plus the hurt white flash, dash tuck. Kick sizes are exact:
  `springPeak()` simulates the discrete spring once.
- **Frame-rate independence.** Every spring (right-hand position, landing, hurt) is integrated in uniform sub-steps of
  ≤ 1/120 s, so 60, 30, 20 or 10 fps give the same motion (one step per frame went unstable once λ·dt neared 1: the
  item-get paws strobed at 30 fps, a dash out of a swing flailed, below ~15 fps one hurt blew the hands away for good).
  The 0.5 m catch-up snap zeroes the hand velocity; landing / hurt states are clamped; a non-finite layer transform or
  hand velocity resets the motion state (`resetMotion()`), which also runs on session start, title and while hidden.
- **Look-sway cuts.** A cut (teleport, respawn, `setLook`) is a yaw / pitch jump the look input did not make: a
  `view.addLookMod` records each frame's input deltas, and a non-input jump > 0.35 rad zeroes that frame's sway rate. A
  fast flick at any sensitivity saturates the sway at `swayRotMax` instead of zeroing it.
- **Lighting.** Hemisphere + sun copied from the sky every frame (sun × `sunK`, its direction biased `keyBias` toward a
  view-space key so the hands are never flat-backlit); a canopy / building shade ray toward the sun (`sunBlocked`,
  ~2 µs) eases the sun to `shadeSun` and the hemisphere to `shadeHemi`; at night (and only then: both light sets are
  compiled at attach) the nearest lamp at its true offset and Pip's glow moved out to `glowDist`. The ink hull gets the
  night tint. Measured (wp2 suite, 1280×720): 21:00 ≥ 30 % darker than noon and ≥ 35 % of it; canopy ≥ 15 % darker.
- **FP boots** (art §2): two boots in the main scene (WORLD layer, no shadow, `userData.cull.dist = Infinity`), stepping
  with `walkPhase`, faded in by Bayer dither between pitch −35° and −40°, only with the camera in the head.
- **Purchases.** `EV.SHOP_OPEN` snapshots potions / max hearts / sword level; on `EV.SHOP_CLOSE` the newest purchase
  (sword > heart container > potion) is raised in both paws for 1.3 s with `sfx('sparkle')` (FP only). The potion and
  sword builds are made once and reused (no geometry growth per presentation).
- **The placing seed** rides a hand bone only in `seed` mode: any other mode, the title, a new session and the hidden
  viewmodel drop it (`dropSeed()`), so a placing that ends while a seed is held never leaves it in the left fist.

### Interface

| Member | |
|---|---|
| `vm.present(item, hold = 1.4) → bool` | arch §15.2 `vm.present(item)`: both paws raise `item` ('potion' \| 'heart' \| 'sword' \| 'seed' or a GB build `{ geo, ol }`) for `hold` s, no dialogue; a swing, a real item-get or hiding the viewmodel ends it |
| `vm.info()` | snapshot, see `G.debug.vm()` |
| `vm.frameCheck(aspect)` | geometric rest composition for any aspect without resizing: `{ aspect, fov, tip, fist, sleeve (screen fractions), inBox, item (NDC) }` |
| `vm.swords`, `vm.scene`, `vm.camera` | kept (the smoke suite samples the blade through them) |
| export `vmFovFor(aspect)` | unchanged |

`G.debug.vm()` (= `G.debug.vm.state()`): `{ visible, low, mode ('hidden'|'rest'|'talk'|'guard'|'item'|'chest'|'seed'|
'dizzy'|'sprint'), state ('hidden'|'swing'|'rest'| mode), kind, swingId, tVis, contactT, hand, rot, tip (NDC), grip
(NDC), item (NDC or null), left, handR, handL ('fist'|'paw'|'prop'), sword, shade, flash, boots, calls, tris, cpuMs,
fov }`. New helpers: `G.debug.vm.pose(name | null)` (force rest / lowered / guard / item / chest / seed / sprint /
dizzy for screenshots), `vm.check(aspect)` (= `frameCheck`), `vm.present(item, hold)`, `vm.relayout()` (after editing
`vm.T`), `vm.module`, `vm.T` (= `TUNE.vm`, live).

Events consumed (none emitted): `swing`, `hit`, `clink`, `dashStart`, `dashEnd`, `jump`, `land`, `hurt`, `potion`,
`itemGet`, `itemDone`, `chestOpen`, `shopOpen`, `shopClose`, `viewMode`, `respawn`. Extension point used:
`view.addLookMod` (records the look input only, never changes it). Fields read: `player.attackT / swingId /
combo / state / swordLevel / walkPhase / vel / vy / grounded / sprint / dizzyT / flash / swingYaw / swingPitch /
swingLatch / swingX / swingZ / reach`, `clock.hitStopT / frozenFrame / alpha`, `view.blend / shotW / bodyOut / yaw /
pitch / mode`, `game.fight.phase`, `game.cutscene` (type `'place'`, `queue`, `cur`), `ui.dlg / dlgEl / menu / shop`,
`sky.hemi / sun / sunDir / lampLights / pipLight / night`. Settings read live: `headBob`, `reduceMotion`.
Sound: `sfx('sparkle')` (a presented purchase; a C8 name).

## Pip's body (`player-body.js`)

- Always animates (in FP its shadow is what you see). Locomotion in Pip's frame: forward waddle, strafe (lean into the
  side step, hips turn, side-step legs), backpedal (lean back, shorter bob, legs reversed).
- Air (C2): take-off stretch on `EV.JUMP`, rise / fall lean and limbs from `player.vy` while `player.grounded === false`,
  landing squash spring on `EV.LAND` (scaled by `impact`). Silent until WP3 emits them; simulated in the tests.
- Swings: the sword arm follows the sim sweep bearing (A/B) or chop pitch (C) at render time, the torso turns into it,
  holds through hit-stop; the world `SlashTrail` follows the same sweep.
- I-frames: `blinkOff` is now **always false**; a cream rim shimmer pulses at 8 Hz instead (`mat.userData.wp2Shim`;
  with `reduceMotion` it holds steady at `shimCalm` 0.7 and the 0.1 white wash goes),
  for the hurt i-frames and for the respawn grace (`EV.RESPAWN`: as long as `player.iframes` lasts, 1.5 s), never for
  the dash / item / dizzy i-frames.
- Body fade (C12): an ordered dither on Pip's own materials and on his own ink hull (`pl.olMat`, the shared 'char'
  outline is no longer used by Pip) by `view.bodyFade`; the shadow pass stays whole. `pl.olMat` is built from
  `TUNE.perf.outline.char` when it exists (WP7's 'char' outline config: pixel-width line, far fade), else from the
  'char' width with the C11 `px: true` flag, so Pip's line matches every other character's after the WP7 merge.
- Rim (art §3): Pip's toon rim × `TUNE.vm.rimTP` 1.6 while the camera is out of his head, 1.0 in FP.
- GLB hero: `hero.glb` carries its sword arm as its own node `armR` (pivot at the shoulder; at rotation 0 the arm
  hangs along −Y like the rig's, so the same pose angles drive both). The node's own rotation is the baked rest pitch
  (`pl.armRest`) and the sword sits in the baked fist at the node's `extras.hand` (`pl.handPos`). The resting blade
  leans 0.55 rad forward (`pl.swordRest`); on the GLB 1.2, and 0.5 rad out from his cheek (`pl.swordRestZ`): held
  upright (0.55, 0.3) it stood across his face seen from his left. Its shoulder sits low and close to his head, so A's
  TP follow-through stays out beside him instead of wrapping up over the far shoulder (`pl.tpWrapK` 0; wrapped, the
  blade ran through his hood) and a swinging arm splays out 0.7 rad × reach (`pl.armSplay`), the chop's 0.9
  (`pl.chopSplay`; less and the raised guard reached into his hood). The arm is short (shoulder → fist 0.135) and his
  capelet flares wider than that at the shoulder, so A/B turn it at most 0.3 rad out to his right (`pl.armOut`) and
  0.35 across his chest (`pl.armCross`); the rest of the sweep turns his torso, all of it across his chest, 0.3 of it out
  to his right (`pl.armTwistK`; all of it spun his back to a camera in front). Past those limits the fist and the hilt sank into his cape and chest (B's pommel
  5 cm deep for 9 frames). With the camera centred behind him the torso twists through A instead (`pl.tpTwistC`: open
  right at the wind-up, left at the follow-through) so the blade shows beside him. A GLB without `armR` falls back to the rig. The left arm stays baked.
- Swords (`models.swordBuilt`, FP `vm/rig.vmSwordBuilt`, colours `models.swordCol`): steel, each blade one closed
  flat-shaded surface from base to point (`toon.bladeGeometry`: hexagonal section, flats a shade darker than the
  bevels), its ink line from the guard's top (`olFrom`; from inside the guard it showed as a spur along it). The world
  blade is short and broad (0.50 × 0.095, point at 0.59) and its pommel a small ball tucked under the fist (swinging,
  the sword lies in line with his short arm). Starter: plain steel, iron guard and pommel, leather grip; Shiny: bright
  steel, gold, a gem.
- Shoulder: `hero.glb`'s sword arm ends in a smooth cream cuff (an ellipsoid at the sleeve's cut end, textured from the
  sleeve's cream texel, `armR.extras.cuff`): raised for a swing, the cut end showed as a torn patch.
- Ink on his face: `hero.glb`'s `body` node lists ellipsoids in `extras.olHoles` (eyes, blush) where the outline hull
  is cut (`toon.punchHull`, applied in `assets.template`): the face folds there, and the back-faced hull showed
  through as ink rings round his eyes.
- Item-get in TP: `pl.held` scaled by `heldS` 0.62 (interact.js builds the item at 1.3), it faces the camera, an
  additive rays disc behind it.
- New fields: `pl.fadeU`, `pl.rimU` (`{ value }` uniforms), `pl.olMat`, `pl.armRest`, `pl.swordRest`, `pl.swordRestZ`, `pl.tpWrapK`, `pl.armSplay`, `pl.chopSplay`, `pl.armOut`, `pl.armCross`, `pl.armTwistK`, `pl.tpTwistC`, `pl.heldRays`, `pl.anim`
  (`{ landSq, landV, jumpSq, hurtAt, fwd, side, air }`). `pl.root.userData.cull = { dist: Infinity }` (C10).

`SlashTrail` (`fx-trail.js`): `setReach(r, shiny)`, `start()`, `stop()`, `update(dt, player)` (the head follows
`player.attackT`; called from the body render). `player.js` keeps calling `setReach / start / stop` (`start`'s
arguments are ignored now).

## Round 2 (integration): the fist leaves the struck enemy

Testers measured the FP fist, bracer and sleeve hiding 20–33 % of a slime 1.9 m ahead through A's follow-through and hold
and 38–43 % through C's hold (the fist parked at ≈ 0.4 W, 0.75 H on the target), so its knockback / poof read late. The
swing paths now run lower after contact and leave through the bottom edge (A at feel §8.3's (0.25 W, 1.0 H)):

| key | r1 | r2 |
|---|---|---|
| `pathA` | (0.25, 0.03, −0.40) (0.13, −0.05, −0.44) (−0.07, −0.09, −0.41) | (0.25, 0.03, −0.40) (0.12, −0.11, −0.44) (−0.12, −0.21, −0.38) |
| `pathB` | (−0.20, −0.14, −0.38) (−0.15, −0.07, −0.44) (0.20, −0.05, −0.38) | (−0.20, −0.14, −0.38) (−0.12, −0.11, −0.44) (0.22, −0.10, −0.38) |
| `overrun` / `followE` / `holdTo` | (0.04, −0.02, 0.01) / [−4, 24] / 0.2 | (0.10, −0.14, 0.02) / [−20, 24] / 0.15 |
| `pathC` / `chopHoldTo` / `reachC` | … (0.03, −0.045, −0.34) / 0.26 / 0.32 | (0.11, 0.065, −0.37) (0.10, −0.05, −0.36) (0.14, −0.22, −0.32) / 0.17 / 0.34 |

Measured (with / without the vm pass, share of the slime's projected box covered, 1280×720; `agents/r2-fix-view/cov.mjs`):

| | r1 mean / max after the stop | r2 mean / max after the stop | hit-stop frames r1 → r2 |
|---|---|---|---|
| A | 0.25 / 0.35 | 0.03 / 0.31 (one frame: the blade's own sweep), 0 from 0.117 s | 0.18 → 0.17 |
| B | 0.04 / 0.39 | 0.02 / 0.28 (one frame) | 0.32 → 0.31 |
| C | 0.32 / 0.43 | 0.05 / 0.12 | 0.20 → 0.22 |

The blade, not the fist, now lies on the target at contact (the fist sits at the struck edge's outside). Sync with the hit
test is unchanged (wp2 'the blade crosses the crosshair exactly when the hit test does' passes). New check in `wp2`:
'after contact the fist leaves the struck enemy' (grip off the slime's projected box from contact + 45 ms through the hold,
A and C).

## Round 2, part 2 (integration)

- **Interpolated stride** (`Stride` in `vm/anim.js`; the viewmodel owns one through its `beforeStep / afterStep` hooks and
  publishes it as `player.stride`). `player.walkPhase` changes once per fixed step and decays × 0.9 a step (running
  backwards by tens of radians) whenever Pip is not walking in 'normal' / 'frozen'. Read raw, the FP hand's stride bob
  stood still on 227 of 399 frames at 144 Hz and jumped on step frames (53 of 319 frames still at uneven frame times), and
  Pip's TP legs ticked at 60 Hz and flailed as he stopped or swung. The stride phase moves forward with walkPhase, holds
  while it does not advance, phase-locks to it gently (≤ half a step per step) and is interpolated by the render alpha. Read
  by the hands' bob and the sprint pump (`viewmodel.ph`), the FP boots (`Boots.update(pl, view, show, dt, ph)`) and the TP
  legs / waddle (`player-body.js`, `this.stride.at(alpha)`, falls back to walkPhase).
- **FP contact poses**: `pathB` comes in from the lower left — (−0.24, −0.19, −0.36) (−0.20, −0.17, −0.40) (0.22, −0.10,
  −0.38) — so at B's contact the fist sits low-left of the struck enemy and the blade crosses it up and to the right (it
  pointed into the screen behind a fist and bracer parked on the target: 33–42 % of a mushroom covered by the arm). New
  `chopBite` 0.5: C's contact pose (the hit-stop) shows the chop that share of the hurtbox's height below its top — the
  top sits above a slime's or mushroom's visible cap, and the frozen blade hung ≈ 0.27 NDC over the enemy. The chop is far
  past that depth by the end of the hit step, and the contact time stays clamped inside that step.
- **TP presentation of A** (the hit test is untouched): seen over the right shoulder a level forehand in front of a 1 m Pip
  was behind his head and body for the whole hit window (the sweep reaches the left within 3 frames and holds there), with
  no trail either. With the camera out of his head A's swing opens toward the camera's side (`tpOpenA` 0.55 rad, the
  torso), tilts up in front (`tpLiftA` 0.35 rad) and its follow-through wraps up over the far shoulder (`tpWrapA` 1.15
  rad), so the blade ends above his hood in open screen. The world `SlashTrail` is drawn without the depth test (after
  Pip) and A's crescent tilts toward the camera (`tpTrailA` 0.7 rad; flat, it was seen edge-on); its rotation order is now
  'YXZ' (roll, tilt, opening). `pl.anim.swOpen / swLift / swTrail` carry the values to the trail. B and C are unchanged.

| measure | before | after |
|---|---|---|
| d-smooth (feel tester): FP hand still frames at 144 Hz / at uneven frame times | 227 of 399 / 53 of 319 | 2 / 0 |
| same: TP leg still frames at 144 Hz | (ticked with the steps) | 0 of 399 |
| fpswing / cov2: B contact (mushroom 1.7 m): share covered by the arm during the hit-stop | 0.39 | 0.18–0.20 (sword counted), 0.10 (arms only) |
| C contact: blade tip region to the enemy's body (screen heights) | 0.085 above it | 0 (on it) |
| q-tpswing: TP A, blade samples in view from the hit through the hold (of 8, per frame) | 0 (hidden) | 5–7 in every frame |

New `wp2` checks: 'a steady walk at 144 Hz and at uneven frame times moves the hand and Pip's legs every frame', 'at each
hit (A, B, C) the frozen contact pose shows the blade on the struck enemy's body and the arm covers ≤ 40 % of it', 'TP A:
from the hit through the hold the blade shows beside or above Pip'.

## Round 2, part 3 (integration)

- **Touch layouts keep the paw off the thumb buttons** (`vm.checkTouch()`, field `touchR`, `touchShift`). Once the touch
  controls have been shown (`input.touchVisible`) the viewmodel measures the `#touch .tb` buttons in the lower half of the
  screen (a cluster button that is `.off` right now, such as Use, is measured too, so nothing moves when it appears) and
  re-measures when the layout key changes (`ui.lay`, the window size, `touchLeftHanded`, `hudScale`) while the controls
  are up (they hide in dialogue and menus; the last rects stay). `layout()` then moves the rest grip left / up in tan
  space (0.02 steps, up costs `touchUpCost` 1.6 × left) until the paw box `touchPaw` [−0.15, 0.12, −0.13, 0.18] (tan at
  unit depth: left, right, down, up of the grip) plus `touchGap` 0.03 clears every button; the tip moves with it, kept
  ≥ `restTipMinX` NDC and ≤ `touchTipY` −0.12 NDC. The keyed and swing poses follow through `this.off`. Without touch rects
  the rest is the old one exactly. The left-handed mirror puts the cluster on the left: no move.
  844×390: grip (595, 314) → (565, 312) px, the fist clear of Roll / Use (it sat under both; the sleeve still runs out
  under Roll). 390×844: grip (296, 685) on Hop's corner → (176, 684) between the stick and Roll, blade up and to the right.
- **FP dialogue: the blade stays under the box** (`vm.talkDrop(ui, tR)`, `talkGap` 0.04 NDC): in 'talk' the lowered pose
  sinks until its tip is `talkGap` under the dialogue box's top (`ui.dlgEl.getBoundingClientRect()`, like the item lift).
  The lowered blade rose from the box into Shellby's beard at 1024×768 and onto his staff at 1280×720.

| measure | before | after |
|---|---|---|
| FP dialogue, 2.5 s in (Shellby / Clover / Digby): blade tip NDC y vs the box top, 1024×768 / 1280×720 / 1680×720 | above it (−0.13 at 1280: over the face) | −0.73 / −0.70 / −0.70 against −0.69 / −0.66 / −0.66 (under it) |
| phone 844×390 FP rest: grip px / paw under a button | (595, 314) / Roll, Use | (565, 312) / none |
| phone 390×844 FP rest: grip px / paw under a button | (296, 685) / Hop | (176, 684) / none |

New `wp2` checks: 'r2 part 3: FP dialogue — the lowered blade's tip stays under the dialogue box's top at this aspect and
at 4:3' (fails with the drop off: tip −0.13 / −0.17 against a box top of −0.77), 'r2 part 3: touch layouts — with a
phone's thumb buttons up the rest paw clears every button…' (the art §13.1 rects at 844×390 and 390×844).

## Round 3: the swing recovery stays in view

The lead's A → B → C strip showed the hand leaving the frame for ≈ 8 frames after A and popping back in at the lower right.
A frame trace (`agents/r3-view-fp/rec.mjs`: grip / tip NDC and the fist / blade samples on screen, every frame) found
three causes, all in the A / B swing poses:

- **The follow-through was cut short and restarted.** r2's `holdTo` 0.15 ends the hold 14 ms after the sweep (`s1` 0.136),
  long before the 0.06 s follow-through, and the recovery then started from the *full* follow-through pose (`u` 1.25): the
  grip jumped 0.43 NDC in one frame (A down out of the frame, B's blade flipped upright). The follow-through now eases
  in and out (`inOutSine`: the sweep ends at rest speed, an `outCubic` follow-through restarted at full speed) and keeps
  running under the recovery, which pulls it home from wherever it is (`swingPose`).
- **The recovery dipped below an already low start.** Its Bézier's middle point sits `recDip` under the lower end; A's
  hold ends at the bottom edge, so the path ran 0.5 NDC below the frame. New `TUNE.vm.recFloor` −1.08 (NDC): after the sweep
  (follow-through, hold, recovery) the A / B grip never sinks below it (`slashPose(…, floor)`, `recoverPose(…, floor)`,
  tan-space, so every aspect and the portrait vm FOV keep it): the knuckles ride the bottom edge back from the lower left
  and rise into the rest. C is unchanged (its fist leaves through the bottom, the blade stays on screen all the way).
- **`recoverPose` never turned the hand to rest.** `out.Q.slerpQuaternions(_q, out.Q, k)` copied `_q` into `out.Q` before
  reading it (three.js `slerpQuaternions` = `copy(qa).slerp(qb)`), so every A / B / C recovery only turned toward the
  `carry` pose and ended 12.8° off the rest; the rest spring finished the turn after the swing. Now a real quadratic
  slerp (de Casteljau) from → carry → rest, ending exactly on the rest pose.

| measure (1280×720, mushroom 1.9 m, `rec.mjs`) | r2 | r3 |
|---|---|---|
| frames with nothing of the fist or blade on screen after the sweep, A hit / A miss, 60 Hz | 6 / 3 | 0 / 0 |
| same at 144 Hz (A miss) | 7 | 0 |
| largest grip step in one 1 ms of pose time after the sweep (pure pose, A / B) | 0.44 / 0.44 NDC | 0.016 / 0.022 |
| rotation off the rest pose at the end of the swing | 12.8° | 0° |
| struck slime's box covered by the vm during A's recovery (`cov.mjs`, max) | 0.02 | 0.12 (the knuckles cross its bottom edge for 3–4 frames; finder's gate ≤ 0.15) |
| after-stop coverage mean / max, A · C (slime 1.9 m) | 0.03 / 0.32 · 0.05 / 0.11 | 0.05 / 0.31 · 0.04 / 0.11 (0.31: the frame after the stop, the sweep itself) |

New `wp2` check 'r3: A / B / C recoveries travel back to rest in view …' (pure poses every ms for A at three slash tilts, B
at two, C: something on screen every ms, the grip moving ≤ 0.03 NDC per ms, the swing ending on the rest pose; live A on
a mushroom at 60 and 144 Hz: no frame with the hand out of view). It fails on the r2 code (off 45 / 110 ms, step 0.44,
end 12.8°, live 6 / 16 frames out of view).

## Round 4 (final gate): the boss intro shot is the boss's

- First-person boss intro (still-open item): the viewmodel's `guard` pose held the blade up across the boss for the whole
  name-card shot. `pickMode` now returns `'intro'` while `fight.phase === 'intro'`: the `lowered` key with the blade tip
  dropped to NDC y ≤ `TUNE.vm.introTipY` −0.6 (0.8 H; `tipUnder(tR, yb)`, the helper the talk drop now shares), eased like
  the talk pose; the fight starts from it into the rest pose. `guard` stays for `vm.pose('guard')`. Measured: the tip at
  (0.65 W, 0.57 H) in the plain lowered key → under 0.8 H; frames `S/agents/r4-fix/fight-desk-sheet.jpg`,
  `fight-port-sheet.jpg`, `fight-land-sheet.jpg` (intro 0.3 / 1.0 / 2.0 s: only the tip at the bottom right).
- Test (wp2): "r4 first-person boss intro: the blade is lowered out of the shot …" (no blade sample above 0.62 H inside
  0.2–0.8 W at 1 s; `rest` once the fight starts).

## TUNE.vm keys

Composition: `fov, glowDist, restHand, restTip, restRoll, restHandPortrait, restTipPortrait, restTipMinX (new),
touchPaw, touchGap, touchUpCost, touchTipY (r2 part 3),
shoulderR, shoulderL, shoulderSwing (new), elbowSag, wrist, swordS, grip, bladeLen, outline`. Keyed poses (9-arrays `[P, B, A]` + optional roll°): `lowered,
guard, sprint, itemR, itemL, chestR, chestL, potionRaise, potionDrink, seedL, seedR, dizzyL, hiddenL, carry`.
Item: `itemNdc, itemS, raysS, raysK, heldS, potionAt, potionS`. TP: `rimTP`, `tpOpenA, tpLiftA, tpWrapA, tpTrailA` (r2).
Contact: `chopBite` (r2). Swings: `pathA, pathB, elevA, elevB,
aimElev, aimRange, aimCone, slashK, slashKBulge, reachMin, reachMax, slashRoll, rollOver, followA, followE, overrun,
follow, holdTo, overshoot, recDip, recFloor (r3), pathC, chopK, chopHoldTo, chopA, reachC, chopFloor, anticip, anticipC`. Contact:
`kick, kickBoss, kickT, jitter, jitterHz, clink, clinkIn, clinkOut`. Trail / sparkle: `trailLife, trailFrom, trailSub,
trailA, sparkleEvery`. `recover`. Lighting: `sunK, keyView, keyBias, shadeSun, shadeHemi, shadeR`. Motion: `breathe,
breatheHz, breatheRot, swayRot, swayRotMax, swayPos, swayPosMax, swayL, bob, bobSprint, strafeRoll, pushBack, jumpK,
jumpMax, jumpDip, landDip, landK, landD, dashPos, dashRot, dashIn, dashOut, hurtY, hurtRoll, hurtW, hurtZ, flashK,
flashHz, flashCalm, shimCalm, sprintPump, sprintPumpA, lowerY, lowerRot, hideT, talkT, talkGap (r2 part 3), dizzyT, dizzyY,
dizzyRoll`. Boots: `bootsPitch,
bootsSide, bootsFwd, bootsStep`. Removed (foundation stub): `anchor, anchorPortrait, depth, rest, scale, slashC,
slashR, slashHand, slashLead, slashTilt, chopHi, chopLo, chopRoll, chopHold`.

## What in ARCHITECTURE.md is no longer true

- §13 (whole section): the item-get stub (`present` group, `LAYER.PRESENT`, `updatePresent`, `renderPresent`, "WP2
  replaces both with paws") is gone: one vm pass, the item is in the vm scene in both paws. The rest pose is no longer
  `TUNE.vm.anchor` (0.42, −1.06) + `TUNE.vm.rest`: the grip is on screen at `restHand` (0.50, −0.60) (§19's deviation
  note about the grip "just below the screen" is obsolete). Dizzy and item-get are poses, not "hidden". Cost and the
  `G.debug.vm()` field list changed (above). "Measured sword luminance at 21:00 is ≈ 36 % below noon": the hands are
  measured now, same ≥ 30 % rule.
- §3 / §6: `afterRender` no longer draws an "FP item-get pass, then the sword pass" but one vm pass.
- §7 last line: `player.blinkOff` is always false now (no blink frames; the shimmer replaces them).
- §16: `TUNE.vm` holds the keys above. `util.js`'s `LAYER.PRESENT` (and its comment) is unused now.

## Numbers (before = foundation on :8791, after = this copy; same pose, noon)

| | foundation | WP2 |
|---|---|---|
| draw calls / tris at rest | 2 / 644 | 4–6 / 2.2–3.2 k |
| mid-swing (shiny) | 2 / 644 | 5–8 / 2.2–3.2 k |
| dash / potion / item-get / presented purchase | — / — / 0 (own pass) / — | ≤ 10 calls, ≤ 5.9 k tris |
| screen coverage at 1080p (rest / mid-A / mid-B / item-get) | ≈ 3 % / — / — / — | 7.6 % / 14.9 % / 17.7 % / 18.6 % (review r1: 8.0 / 22.8 / 24.3 / 20.6 %) |
| mean coverage over the A → B → C chain (1280×720, 59 frames) | — | 11.7 % (review r1: 15.1 %) |
| GPU `gpuVm` p50 at 1920×1080, wp2-heavy min of 3 medians (shared GPU, load avg 9–14) | 0.075–0.10 ms | 4 solo runs: rest 0.21–0.29, swinging 0.23–0.33, item-get 0.38–0.58 ms (review r1: 0.28–0.29 / 0.42 / 0.56–0.60) |

Where the time goes (timer queries, 40 back-to-back vm passes): the pass is fill-bound. A full-screen opaque quad costs
≈ 1.45 ms at 1080p with MSAA, the same draw calls at zero area 0.04–0.09 ms; materials and lights do not matter. So
the cost is ≈ 1.45 ms × screen coverage × overdraw (the ink hulls are a second layer). Review r1 cut coverage: the
tapered sleeve without puff / capelet, the low swing shoulder, the steeper item / chest forearms, a narrower trail, a
smaller rays disc that discards its empty pixels. The first engineer's version measured rest 0.37–0.43 / item-get
0.92–1.06 ms; ink hulls drawn last (early depth rejects their inside), no discard in the vm ink shader, point lights
only at night and a disc-shaped rays card brought it to the pre-review numbers.

## Known issues

- Item-get GPU 0.38–0.58 ms at 1080p, over the 0.3 ms budget: the item, its rays and sparkles alone cost ≈ 0.2 ms and
  both arms ≈ 0.15–0.25 ms more (the world is paused under the dialogue then). Reaching 0.3 ms needs the lead to
  re-budget it, or a depth mask of the (opaque) dialogue box so the forearms under it are rejected early (fragile while
  WP6 restyles the box). Rest passes; swinging measured 0.23–0.33 ms depending on machine load (3 of 4 solo runs ≤ 0.3).
- In TP, the A forehand's mid-sweep (≈ 2 frames between the wind-up and the hit) still passes behind Pip's head from the
  right-shoulder camera; the wind-up, the trail (drawn over him) and, from the hit on, the blade over his hood show
  (r2 part 2, above). A target straight ahead of Pip (not at the crosshair) is itself behind his body at 1.6 m.
- The pedestal seed shows in a paw only if WP1 keeps the camera in the eye for the placing (today's shot hides the
  viewmodel); the flying seed then starts at `pl.pos + 1.4` (cutscenes.js, WP1), not at the paw.
- `ditherToon`'s TP rim multiplier patches the string `uRimStr * uRimK` in `toon.js`'s fragment code; if WP7 renames
  it the rim stays at 1.0 (no error).
