// Tunables added by the first-person conversion (new tunables go here, never into CFG). One `export const` group
// per work package, separated by blank lines, so parallel packages never edit the same lines. Read as TUNE.view.x.

// WP1 camera feel + cinematics (eye height, bob, shake, TP rig, shots). F2 defaults from RULINGS §1 / feel.
export const view = {
  // WP1: RULINGS §1 / feel §6 / §10 / §12, art §10–§11; the TP framing was picked from contact sheets (docs/wp/WP1.md)
  eyeH: 0.88,                 // FP eye above the feet (m)
  // grounded eye-y smoothing (feel §4.7; xz is rigid): r2 part 3 replaced the first-order λ 20 up / 26 down with a
  // critically damped spring of ω eyeW (it smooths the acceleration at the terrain's 1 m kinks; lag 2·v/ω on a slope)
  eyeW: 14,
  nearFP: 0.08, nearTP: 0.12,
  pitchFP: 85, pitchTPUp: 50, pitchTPDown: -55, // degrees
  // ---- third person (over the shoulder, level with Pip)
  // picked from contact sheets of candidate sets (the last round: 4 sets × village / woods path / slope / wall, docs/wp/WP1.md):
  // camera ≈ 1.30 m over the feet (level with Pip's head), Pip ≈ 33 % of the screen height at x ≈ 0.35 W, the crosshair ray
  // ≥ 0.5 m clear of him, the horizon at ≈ 0.44 H, a slime 3 m straight ahead visible beside him (RULINGS start values
  // 1.20 / 0.55 / 3.0 / −6 gave Pip 28 %, a 0.37 m clearance and the camera 0.5 m above his head)
  tpPivot: 1.12, tpPivotCenter: 1.45, tpShoulder: 0.80, tpBoom: 2.6, tpBoomMin: 1.8, tpBoomMax: 4.5, tpPitch: -4,
  tpPivotXZ: 16, tpPivotY: 10, // pivot smoothing λ
  tpNarrowMin: 1.8,           // r2 part 3: a narrow screen's boom (× tan(vFOV/2) at 16:9 / now) never goes under this (m)
  tpAirFollow: 0.5,           // the pivot follows this much of a jump's height (player.alt, C2)
  tpUpShort: 0.35, tpDownLong: 0.12, // boom × (1 − upShort·smoothstep(0°, 50°, pitch)) looking up, × (1 + downLong·…) down
  tpArmRelease: 4, tpArmGrow: 4, tpArmMin: 0.35, tpHideBody: 0.45, tpFadeBody: 0.9, tpClear: 0.30, tpWater: 0.25, tpHug: 0.6, // tpArmGrow: release ≤ this·dt·boom per frame (arch #2)
  tpSideRoom: 0.30,           // shoulder point clearance above the camera floor (else the side leg shortens)
  // r2 part 3: the side leg pulls in toward the soft probe's target on a critically damped spring of ω tpLegW (the hard
  // probe stays immediate); it popped 8 cm sideways in one frame orbiting past a house corner
  tpLegW: 18,
  tpFrame: 0.8,               // the hug lift never pushes Pip's head top below NDC −tpFrame
  tpArmPull: 20, tpArmPullMax: 9, // framing pull-in λ and speed cap (m/s); terrain in the way jumps in at once
  tpHugEase: 0.4,             // r3: while that pull-in eases, the hug may lift this much over tpHug (it jumped in, 0.4 m steps)
  tpZoom: 10,                 // wheel boom length smoothing λ (both directions)
  tpProbe: 0.22,              // hard probe radius: a collider inside it pulls the arm in at once (near plane margin)
  tpSoftProbe: 0.5,           // wider probe: the slide side-steps an obstacle closing on the boom before it touches
  tpLowTop: 0.7,              // colliders whose top + tpProbe is ≤ pivot + this (rocks, stumps, fences, chests…) are lifted
                              // over (camera floor) while the framing-capped hug can ride over them on this boom; one it
                              // cannot (a 1.35 m altar or a sign right behind Pip) is a wall (RigTP.pruneLow), else the
                              // arm folded into his head (all-floor) or every boulder walled the peaks off (all-wall)
  tpLowSide: 0.1,             // a low collider beside Pip stays floor while its top + tpProbe ≤ pivot + this; the shoulder
                              // leg keeps this much room over a low collider's top (tpSideRoom over the terrain)
  tpSlide: [0.55, 0.8, 1.1, -2, -2.6], // slides tried when a collider nears the boom (shoulder units, × side): out, over
                              // (no centre or narrow other shoulder: Pip would stand under the crosshair)
  tpSlideCost: 0.7,           // m of arm a 1 m lateral slide must win
  // an offset whose real lateral (after the side leg and the arm's offset scale) is under tpSlideCentreW × shoulder costs
  // up to tpSlideCentre m of arm (Pip under the crosshair: RULINGS wants the ray ≥ 0.35 m clear of him, ≈ 0.64 m lateral)
  tpSlideCentre: 1.5, tpSlideCentreW: 0.8,
  tpSlideEdge: 0.5, tpSlideEdgeCost: 2.5, // an offset that puts Pip's centre past NDC −tpSlideEdge (0.25 W) costs this m of arm per NDC unit
  tpSlideRate: 4, tpSlideSpeed: 2.4, tpSlideCross: 7, // slide easing λ and speed cap (m/s); crossing under the crosshair
  tpOffEdge: 0.5,             // the shoulder offset shrinks with a short arm so Pip's centre stays within this NDC of the middle
  tpPassR: 1.0, tpPassGap: 0.30, // trunks / posts up to this radius may cross the boom; the camera keeps this gap from them
  // r2: a crossed trunk whose Pip-side face is within tpPassNear m of the camera (it stands on the crosshair ray: it is on
  // the boom) for tpPassNearT s becomes a wall for the slide's scoring, so the camera eases round it instead of parking
  // behind it
  tpPassNear: 2.2, tpPassNearT: 0.4,
  tpSightEdge: 0.72, tpSightW: 0.3, // r2: the arm comes in until the camera sees Pip (the pivot or ± tpSightW m across his head) with his centre within tpSightEdge NDC
  // r3: a short arm lowers the camera point (≤ tpDropMax m, eased λ tpDropRate) so Pip's feet stay inside NDC −tpFeetY,
  // fully from tpFeetArm m of arm, fading out toward tpFadeBody (RigTP.feetDrop)
  tpFeetY: 0.9, tpFeetArm: 1.2, tpDropMax: 0.55, tpDropRate: 10,
  tpCanopyPad: 0.25, tpCanopyPull: 30, tpCanopyPullMax: 14, // canopy keep-out margin (m), pull-in λ and speed cap (m/s)
  // boss-arena vine gate (fight.js: tubes at r + 1 ± 0.35, ±0.36 rad, ≤ 3.3 m; no collider): while it stands the TP camera
  // point keeps within r + gate.r inside its span, opening out over gate.soft rad past the edges; above gate.top it is free
  gate: { r: 0.4, half: 0.36, soft: 0.3, top: 3.5 },
  fitVMax: 100,               // a fitted TP shot may widen to this vertical FOV when something keeps it from backing off
  modeBlend: 0.35,            // FP ↔ TP position blend (s)
  shakeMax: [2.2, 1.6, 2.4],  // pitch / yaw / roll degrees at full trauma (FP)
  shakeDecay: 1.5, shakeHz: 20, shakeTP: 0.8, shakeTPMove: 0.04,
  comfortShake: 0.25, comfortDip: 0.35, // motion comfort: shake × 0.25, eye dips / kicks × 0.35
  // ---- first-person feel layers (feel §6)
  // head bob: y 0.0115 → 2.3 cm peak-to-peak at full stride (feel T19 2.4 ± 0.3 and arch WP1 #1 0.022 ± 0.002 at 5 m/s)
  bob: { y: 0.0115, x: 0.010, roll: 0.35, nod: 0.20, ref: 4.4, sprint: 1.2, wade: 1.4, rise: 10, air: 20 },
  strafeRoll: 0.8, strafeRef: 4.4, strafeLambda: 8, rollCap: 6, // degrees; bank toward the lateral velocity
  land: { w: 16, z: 0.6, min: 2.0, k: 0.32, max: 3.2, nod: 16.3 }, // v_i = min(max, k·impact); nod: deg per m of dip
  kick: { w: 22, z: 0.65 }, hurt: { pitch: 3.0, roll: 3.5, yaw: 1.5, eye: -0.03 },
  dash: { dip: 0.10, dipIn: 0.07, dipHold: 0.14, dipOut: 0.16, roll: 4, nod: 3, back: 2, fov: 8, fovIn: 0.06, fovOut: 0.25, fovTP: 3 },
  punch: { yaw: 0.6, fov: -1.5, pitchC: -1.2, fovC: -3, lambda: 14, yawBoss: 0.9, fovBoss: -2.5 }, // boss hit: feel §8.4
  sprintFov: 4, sprintLambda: 6, sprintMin: 4.7, sprintFull: 5.6, sprintSpeedFx: 0.35,
  fovMin: -14, fovMax: 10,    // all FOV channels together (vertical degrees around the base)
  // context FOV channels (tween s). ending +8 follows art §11 (70 → 78 looking up the trunk; feel §6.7 asks −12: deviation,
  // docs/wp/WP1.md)
  ctx: { talk: -6, item: -8, intro: -10, ending: 8, place: -6, fight: 3, inT: 0.5, outT: 0.4 },
  // ---- lock-on camera (C1; feel §8.8 / §10.8). While a boss is lifted > liftAt (Frostbun's leap lands on Pip): pitch cap
  // liftPitchHi, pitch spring liftPitch, boom + liftBoom (feel: +1.0; 2.0 is what keeps the boss's middle and Pip's head
  // in one frame at the 6.5 m apex). FP: a boss lifted > fpLiftAt is eased toward in yaw, its pitch capped at fpLiftPitch°
  // (the landing disc stays on screen)
  lock: { fpRate: 9, fpDead: 4, fpMax: 240, fpIdle: 0.15, fpLiftAt: 0.5, fpLiftPitch: 10, tpYaw: 8, tpPitch: 8, tpPitchOff: -6, tpPitchLo: -25, tpPitchHi: 30, liftPitchHi: 44, liftPitch: 14, enemyBoom: 0.6, bossBoom: 4.2, bossPivot: 0.35, liftBoom: 2.0, liftAt: 2, liftW: 6, ease: 3, margin: 4 },
  // TP auto-recentre (setting tpAutoRecenter, pad / touch; feel §3.3): after idle s without look input while Pip runs
  // faster than speed m/s, the yaw eases toward his travel (λ rate, ≤ max °/s); never with an enemy within near m or the
  // travel more than back° off the look (backpedalling)
  recenter: { idle: 2.5, speed: 1.5, rate: 1.5, max: 40, side: 0.25, near: 10, back: 135 }, // side: × max running sideways
  tpLockParD: 3.0,            // r3: TP lock on a non-boss: the shoulder parallax is taken at ≥ this distance (m), no swing walking in
  tpLockLiftHug: 1.0,         // r3: extra ground-hug lift (m, eased λ lock.liftW) while a locked boss is lifted > lock.liftAt
  // ---- cinematics (art §10–§11, feel §9.3 / §12). TP shot FOVs (…FovH / fovH) are horizontal degrees at 16:9 like the
  // view's (Hor+, vFovFor), and every TP shot is fitted to its subjects (fitX / fitY: NDC bounds; shotMax: farthest m).
  // talk.shot*: the TP two-shot sits shotAngle° off the perpendicular, toward Pip's back (a pure profile reads as two
  // backs: Pip's hood hides his face), so the speaker's face shows. FP: the face at faceAt from the top, or at faceFree of
  // the free band above the dialogue box (minus its nameTab px) when that is lower (short landscape phones). TP (r2): the
  // two-shot fits Pip ≥ 0.18 W from the edge (fitX 0.64) and its subjects into the band above the dialogue box (≥ bandMin
  // NDC tall); candidates (Cine.twoShot) must see the speaker's face; a speaker > otsDist m away may get an over-the-
  // shoulder shot otsBack behind Pip, otsSide off his right, otsH up
  talk: { dur: 0.35, introDur: 1.4, yaw: 25, pitch: 15, spring: 8, faceK: 0.82, faceAt: 0.42, faceFree: 0.65, nameTab: 40, near: 1.8, back: 0.6, backIn: 0.3, backOut: 0.4, shotDist: 3.4, shotAngle: 32, shotH: 1.15, shotLook: 0.6, shotIn: 0.45, shotFovH: 70, fitX: 0.64, fitY: 0.85, shotMax: 9, bandMin: 0.9, otsDist: 4.5, otsBack: 1.7, otsSide: 0.75, otsH: 1.35, otsNear: 0.15, leftBonus: 0.6, minLook: 1.4, minDepth: 0.6, fovMaxV: 60, pipR: 0.4, pipTop: 1.45 },
  item: { fwd: 2.6, side: 0.6, h: 1.3, look: 0.95, inT: 0.4, fovH: 82 },
  intro: { lateral: 1.0, h: 1.15, back: 2.4, push: 0.5, look: 0.6, fovH: 82, fitX: 0.8, inT: 0.6, outT: 0.5, fovPunch: 4, len: 2.4 }, // len: fight.js's intro (s)
  dizzy: { wobble: 8, wobbleHz: 3, roll: 72, eye: 0.28, eyeComfort: 0.5, pitch: 18, drift: 6, tpDrop: 0.6, tpOrbit: 20 },
  eyelids: { open: 0.45, half: 0.12, reopen: 0.25, close: 0.35, halfK: 0.45 },
  wake: { pitch: 30, respawnPitch: 25, respawnEase: 1.0 },
  // place: seeds sit seedScale in their sockets, seat m below the slab top; FP looks fpLook m above the slab; TP shot from
  // the altar toward Pip · tpBack, off his left · tpSide, tpUp m high, fitted
  place: { dur: 0.4, seedT: 0.9, gap: 0.5, arc: 0.25, seedScale: 0.65, seat: -0.04, fpLook: 0.15, tpBack: 5.0, tpSide: 1.8, tpUp: 1.7, tpLook: 0.9, fovH: 79, shake: 0.2 },
  // ending: TP looks up from a short shot tpBack behind / tpSide beside / tpUp above Pip's feet (not from behind his hood)
  ending: { look: 35, lookT: 1.4, bloom: 1.8, crane: 3.0, craneT: 3.4, craneH: 0.85, craneR: 1.6, orbit: 40, card: 6.5, pitchBack: 15, tpBack: 1.2, tpSide: 1.4, tpUp: 2.0, tpFovH: 90, craneFovH: 79 },
  // boss intro (F2b, still read by fight.js): TP low 3/4 shot from Pip's side (m back toward Pip, m to the side, m above
  // the floor, look at fraction of the boss height, vertical FOV); blend in/out speeds (in 1/(0.6·s) s, out 1/(0.8·s) s).
  // WP1's feel module replaces that shot with the moving over-the-shoulder one above (intro.*) on EV.BOSS_INTRO
  introShot: { back: 10, side: 3.2, h: 1.6, look: 0.55, fov: 52 }, introIn: 2.78, introOut: 2.08,
};

// WP2 viewmodel (F3 stub values: rest pose, swing tween shapes; camera space, metres / degrees)
export const vm = {
  // WP2: Pip's hands + swords (art §1, feel §7–8.3). vm camera space: metres, x right, y up, −z ahead; degrees.
  // Poses [Px, Py, Pz, Bx, By, Bz, Ax, Ay, Az]: grip centre, grip / blade direction, forearm direction (wrist → elbow).
  fov: 54,                    // vm camera vFOV (widened on narrow screens, vmFovFor)
  glowDist: 3.6,              // Pip's night glow reaches the hands from this far (the 21:00 hands stay ≥ 30 % darker than noon)
  // rest composition, solved per aspect: grip at NDC (x, y) and depth; blade tip at NDC (feel §7.2 tip 0.66 W, 0.56 H);
  // the fist stays on screen (lead: the hand is the first-person signal); portrait pulls both inward
  restHand: [0.50, -0.60, 0.40], restTip: [0.32, -0.12], restRoll: 15, // roll about the grip: the guard reads as a bar
  restHandPortrait: [0.52, -0.62, 0.40], restTipPortrait: [0.30, -0.30], // blended in over aspect 1.2 → 0.9
  restTipMinX: 0.26,          // wider than 16:9 the rest keeps its 16:9 width, shifted right so the tip stays ≥ this NDC x
  // r2 part 3: with the touch controls up the rest moves left / up until the paw clears the thumb buttons: the paw's box
  // around the grip (tan at unit depth: left, right, down, up), the gap kept, the cost of 1 up against 1 left, the tip's
  // highest NDC y
  touchPaw: [-0.15, 0.12, -0.13, 0.18], touchGap: 0.03, touchUpCost: 1.6, touchTipY: -0.12,
  // forearms point at these (low, out to the side, a little ahead of the eye) so the bracer, the cream cuff and the
  // leaf-green sleeve run into the bottom-right corner at rest
  shoulderR: [0.62, -0.40, -0.20], shoulderL: [-0.62, -0.40, -0.20], elbowSag: 0,
  shoulderSwing: [0.50, -0.68, -0.22], // A / B / C swings: lower, so the sleeve drops out through the bottom edge
  wrist: [0, -0.032, 0.012],  // the wrist (forearm origin) in the hand frame
  swordS: 0.55, grip: 0.01,   // vm sword (vm/rig.js vmSwordBuilt, model units) scale and its grip height (model units)
  bladeLen: 0.3575,           // grip centre → tip at that scale (m)
  outline: 0.0032,            // ink line width (m) at arm's length (≈ 3.5 px at 1080p)
  // keyed poses (art §1.3 × 0.915 for vFOV 54, then tuned on screen)
  lowered: [0.21, -0.25, -0.40, -0.05, 0.55, -0.83, 0.40, -0.50, 0.77],
  guard: [0.19, -0.14, -0.42, -0.18, 0.85, -0.50, 0.45, -0.55, 0.70],
  sprint: [0.22, -0.19, -0.42, 0.22, 0.32, -0.92, 0.45, -0.55, 0.70], // carry: blade low and forward-right (tip ≈ 0.73 W, 0.65 H)
  // (centre poses: the forearms drop steeply out of the bottom edge; aimed at the camera they ran under the whole
  // dialogue box and doubled the pass's fill)
  itemR: [0.055, -0.04, -0.47, -0.35, 0.45, -0.8, 0.35, -0.85, 0.40, 60],   // paws cradling the item's lower sides
  itemL: [-0.055, -0.06, -0.47, 0.35, 0.45, -0.8, -0.35, -0.85, 0.40, -60],
  chestR: [0.08, -0.09, -0.44, -0.1, 0.75, -0.65, 0.35, -0.85, 0.40, 180],  // palms forward, pushing the lid
  chestL: [-0.08, -0.09, -0.44, 0.1, 0.75, -0.65, -0.35, -0.85, 0.40, -180],
  potionRaise: [-0.085, -0.175, -0.42, 0.28, 0.72, 0.62, -0.42, -0.72, 0.55],
  potionDrink: [-0.03, -0.065, -0.28, 0.10, 0.20, 0.97, -0.40, -0.75, 0.52],
  seedL: [-0.06, -0.075, -0.46, 0, 0.55, -0.83, -0.40, -0.60, 0.69],
  seedR: [0.06, -0.075, -0.46, 0, 0.55, -0.83, 0.40, -0.60, 0.69],
  dizzyL: [-0.23, -0.27, -0.40, 0.2, 0.5, -0.8, -0.4, -0.7, 0.5],
  hiddenL: [-0.30, -0.55, -0.36, 0, 0.8, -0.6, -0.4, -0.6, 0.6],
  itemNdc: [0, 0.08, 0.50],   // presented item: NDC (x, y) and depth (above the dialogue box at every aspect)
  itemS: 0.12,                // presented item: its larger face dimension (m)
  raysS: 0.28, raysK: 0.8,    // fx_raysburst card behind it: size (m), additive strength
  heldS: 0.62,                // TP: Pip's overhead item group scale (the item itself is built at 1.3)
  rimTP: 1.6,                 // TP: Pip's toon rim × this (art §3; 1.0 in FP, where only his shadow is seen)
  // r2: TP presentation of A (rad; the hit test is untouched): the swing opens toward the camera's side, tilts up in front,
  // its follow-through wraps up over the far shoulder; the world trail's crescent tilts toward the camera
  tpOpenA: 0.55, tpLiftA: 0.35, tpWrapA: 1.15, tpTrailA: 0.7,
  potionAt: [0.05, 0.03, 0.0], potionS: 0.72, // bottle on the left palm (hand frame), scale
  // A (dir +1) / B (dir −1) slash: hand path (Bézier, 3 points), sweep point radius (+ bulge mid-sweep), elevation range
  // of the sweep point (°, start → end: A falls, B rises), reach band (hand ↔ sweep point), follow-through overrun
  // (r2: the paths run lower after contact and the follow-through drops out of the bottom edge — A at feel §8.3's
  // (0.25 W, 1.0 H) — so the fist and forearm leave the struck enemy within 2 frames of the hit-stop and its reaction shows;
  // they parked on it at 0.4 W, 0.75 H, hiding 20–33 % of a slime through the hold)
  pathA: [[0.25, 0.03, -0.40], [0.12, -0.11, -0.44], [-0.12, -0.21, -0.38]],
  // (r2 part 2: B comes in from the lower left — at contact the fist sits low-left of the struck enemy and the blade
  // crosses it up and to the right; it pointed into the screen behind a fist and bracer parked on the target)
  pathB: [[-0.24, -0.19, -0.36], [-0.20, -0.17, -0.40], [0.22, -0.10, -0.38]],
  elevA: [9, -9], elevB: [-10, 10],   // symmetric: the sweep point is at the aim height when the sweep crosses it
  aimElev: [-28, 22], aimRange: 1.0, aimCone: 60, // the slash plane tilts to the nearest enemy ahead (°, clamp; m past reach; ± °)
  slashK: 0.50, slashKBulge: 0.05, reachMin: 0.10, reachMax: 0.30,
  slashRoll: 0, rollOver: [0.35, 0], // hand roll about the grip during A/B (°·dir); tip drop at the follow-through
  followA: [0, 16], followE: [-20, 24], // follow-through wrap (A, B): the sweep point moves this far back in (°) and up (°)
  overrun: [0.10, -0.14, 0.02], follow: 0.06, holdTo: 0.15, overshoot: 0.06, recDip: 0.05,
  // r3: A / B — after the sweep (follow-through, hold, recovery) the grip never sinks below this NDC y: the fist rides the
  // bottom edge back to rest in view (A's dropped out of the frame for 6 frames and rose in at the lower right)
  recFloor: -1.08,
  carry: [0.12, -0.24, -0.38, 0.25, 0.05, -0.97, 0.45, -0.6, 0.65], // the low carry a recovery passes through
  // C chop: hand path from raised to low, sweep point radius, chop-line bearing (°, + = left) from the top to the bottom
  // (r2: C ends low and right, the hold is shorter: the blade, not the fist, lies on the target after the bite)
  pathC: [[0.11, 0.065, -0.37], [0.10, -0.05, -0.36], [0.14, -0.22, -0.32]], chopK: 0.50, chopHoldTo: 0.17,
  chopA: [-12, 0, 2], reachC: 0.34, chopFloor: -27, // the blade stops following the chop below chopFloor° (off-screen in the world view)
  chopBite: 0.5,              // r2: C's contact pose (the hit-stop) shows the chop this share of the hurtbox's height below its top
  anticip: [0.02, 0.035, 0.0], anticipC: [0.01, 0.035, 0.0], // windup lift (m, x / y / z) at the cocked pose
  // contact feedback (feel §8.3–8.4): blade kick (°) and its time, hit-stop jitter (m, Hz), clink bounce (°, s)
  kick: 4, kickBoss: 6, kickT: 0.16, jitter: 0.008, jitterHz: 30, clink: 20, clinkIn: 0.06, clinkOut: 0.15,
  // trail: a crescent along the outer part of the blade (from trailFrom of its length to the tip), narrowing to a line at
  // its old end: life (s), sub-samples per frame, peak alpha wood / shiny (vm/fx.js VmTrail: body, bright core, warm edge)
  trailLife: 0.10, trailFrom: 0.6, trailSub: 4, trailA: [0.95, 0.95],
  sparkleEvery: 0.35,         // shiny blade glint period (s)
  recover: 18,                // λ toward a keyed pose
  // lighting (arch §6.1, art §1.1): sun × sunK, its direction biased by keyBias toward a view-space key; canopy shade
  // (ray to the sun within shadeR m) drops the sun to shadeSun and the hemisphere to shadeHemi
  sunK: 0.85, keyView: [-0.4, 1, 0.6], keyBias: 0.35, shadeSun: 0.3, shadeHemi: 0.85, shadeR: 9,
  // motion layers (feel §7.3; × the headBob setting, 0 with reduceMotion)
  breathe: 0.003, breatheHz: 0.3, breatheRot: 0.4,
  swayRot: [0.025, 0.020], swayRotMax: [0.06, 0.045], swayPos: [0.012, 0.010], swayPosMax: [0.025, 0.02], swayL: 12,
  bob: [0.010, 0.006], bobSprint: 1.6, strafeRoll: 4, pushBack: 0.012,
  jumpK: 0.005, jumpMax: 0.03, jumpDip: 0.025, landDip: 0.035, landK: 180, landD: 18,
  dashPos: [-0.04, -0.06, 0.03], dashRot: 14, dashIn: 0.06, dashOut: 0.15,
  hurtY: -0.05, hurtRoll: 7, hurtW: 18, hurtZ: 0.5, flashK: 0.35, flashHz: 8,
  sprintPump: [-0.17, -0.17, -0.40], sprintPumpA: 0.07, // the left fist pumps up into the bottom edge on alternate steps
  lowerY: 0.35, lowerRot: 0.9, hideT: 0.15, talkT: 0.25,
  talkGap: 0.04,              // r2 part 3: FP dialogue keeps the lowered blade's tip this NDC under the dialogue box's top
  introTipY: -0.6,            // r4: FP boss intro (name card up): the lowered blade's tip at or under this NDC y (0.8 H)
  dizzyT: 0.6, dizzyY: -0.40, dizzyRoll: 40,
  // FP boots (art §2): visible when the look pitch is below bootsPitch[1]°, fading in from bootsPitch[0]°
  bootsPitch: [-35, -40], bootsSide: 0.085, bootsFwd: 0.11, bootsStep: 0.08,
};

// WP3 movement, jump, collision
export const move = {
  // ground speeds: one table for both views (TP explore turns Pip to move, so its multiplier is 1)
  run: 4.4, strafeK: 0.95, backK: 0.80, wadeK: 0.62,
  sprint: 5.8, sprintCone: 50, // while the roll button stays held after the roll (pad L3 toggles); ± deg of forward
  sprintMinWish: 0.3, sprintTurn: 60, sprintTurnLag: 5, // ends below this wish or on a > 60° turn of the input (λ ≈ 0.2 s)
  sprintConeT: 0.2,            // … or once the wish stays outside ±sprintCone (where the sprint speed stops) this long (s)
  accel: 38, decel: 30,        // vector acceleration with / without wish (m/s²)
  // jump: apex 0.85 m, 0.278 s up, 0.508 s airtime on flat ground
  jumpV: 6.12, gUp: 22, gFall: 32, cutK: 0.5, termV: 20,
  coyote: 0.10, buffer: 0.12,  // s
  airAccel: 14, airDrag: 0.5, airCap: 6.2, wadeJumpK: 0.7,
  dashJump: 0.10,              // a jump cancels the first 0.10 s of a roll (speed kept, capped at airCap)
  attackJump: 0.20,            // … or a swing from this attackT on (earlier presses stay buffered)
  // ground contact: per-step rises above stepUp are walls, drops deeper than stepDown are falls
  stepUp: 0.35, stepDown: 0.35,
  standOnProps: true, ledge: 0.15, // stumps, low rocks (and bridge decks); support reaches past a top's edge
  softPush: 0.06,              // m per step a standable top slides an airborne Pip off its side
  hurtHop: 2.5,                // knockback hop (m/s up)
  bodyR: 0.32,                 // collision radius (CFG.playerR)
  eyeClear: 0.12,              // FP eye keep-out beyond the mesh (m)
  safeEvery: 0.5, unstickAfter: 0.5, unstickFade: 0.15, // lastSafe refresh (s), stuck time before the warp, fade each way
  slopeSpeed: false, slopeK: 0.30, slopeLo: 0.30, slopeHi: 0.84, // optional uphill slow-down (feel §4.1), off
  fpDustImpact: 4,             // m/s: from this landing speed FP kicks a fan of dust into the bottom of the view
  fpDustBig: 6,                // m/s: from this landing speed the fan is a little more opaque (a full jump lands at 7.6)
  printMax: 48, printSize: 0.3, printLife: 8, printFade: 2.5, printAlpha: 0.5, // footprints on sand / snow (m, s)
  legacySfx: true,             // step / splash / swing / roll sounds from wp3-player-fx until WP5's event audio lands
};

// WP4 combat, targeting, spawning. F2 defaults from feel §8.1–8.2 / §9.1, arch §15.2 WP4 and RULINGS §1.
export const combat = {
  // attack chain A (forehand, right → left) → B (backhand, left → right) → C (overhead chop); seconds of attackT
  swingAB: 0.30, swingC: 0.40, cRest: 0.12,  // C ends the chain: no new swing for cRest after it
  winAB: [0.036, 0.186], winC: [0.080, 0.200], // hit windows
  sweepAB: [0.036, 0.136], sweepC: [0.080, 0.160], // A/B horizontal sweep (easeOutCubic), C vertical chop (easeInQuad)
  chainAt: 0.255,             // a buffered press starts the next A/B swing from this attackT
  chainGap: 0.25,             // the chain continues if the next swing starts within this long after the last one ended
  buffer: 0.16, dashCancel: 0.21,
  moveK: 0.55,                // move speed while swinging (× directional speed); the lunge decays to it at λ lungeK
  lungeK: 9, lunge: 2.2, lungeSoft: 1.0, lungeC: 3.0, lungeNear: [1.2, 3.0], lungeCone: 20,
  knockAB: 6.5, knockC: 9, dmgC: 1, // C: +1 damage, bigger knockback, breaks the crab's guard
  knockAim: 0.65,             // knockback direction: this much along the aim, the rest away from Pip (behind: away only)
  // hit volume (from the eye; TP from Pip's virtual eye converging on the crosshair ray at tpConverge m past the pivot).
  // Horizontal (feel §8.2): the target's edges [θ − w, θ + w] (w = atan(r / d)) meet the bearing swept this step
  arc: 55, arcC: 35,          // half-arc of the A/B sweep; the C chop's horizontal band (deg, target edge)
  chopUp: 45, chopDown: -50,  // C: pitch sweep relative to the aim pitch (deg)
  // A/B vertical: the target's elevation interval from the eye meets [pitch − bandDown, pitch + bandUp] (deg). bandUp is
  // what makes hitting a raised bat deliberate: at 1.5 m a bat at altitude 2.1 needs ≥ 15.5° of look-up
  bandUp: 16, bandDown: 50,
  reachUp: 1.4, reachDown: 0.45, // the blade never reaches a target wholly above eye + 1.4 m, nor a flyer below feet − 0.45
  // a walking critter (ledge rules): never across a wall-sized terrain step (the profile from the swing start rises or
  // drops ≥ wallRise m over stretches steeper than wallGrade, sampled every wallStep m; real cliffs: ≥ 1.04 m, walkable
  // paths: 0; or the ends differ by ≥ wallRise and ≥ wallUnw of it is over a bank of slope ≥ wallSlope, clearly past
  // the 0.84 walk limit: WP9's peaks summit bank reaches 1.16, the steep walkable woods slope 0.89), and its base within
  // groundSlack + walkK·d of Pip's ground at the swing start (walkable paths reach 1.03·d on this island), at most
  // groundUp above it
  groundUp: 1.5, groundSlack: 0.35, walkK: 1.0, wallGrade: 1.0, wallRise: 0.9, wallUnw: 0.3, wallSlope: 0.9, wallStep: 0.1,
  bubble: 0.45, bubbleR: 0.5, // inside 0.45 + 0.5·r of the eye axis (at body height): hit in any direction
  reachSlack: 0.3,            // 3D eye → nearest target point ≤ reach + r + slack
  losStep: 0.2,               // terrain line of sight from the eye to the target, sampled every 0.2 m
  losEdge: 0.75,              // …to its contact point or its edges (losEdge·r off the centre line): any clear ray hits
  tpConverge: 3.0,
  // swing magnetism (feel §8.7; RULINGS): extends the swept coverage toward one enemy within reach + magReach whose
  // nearest edge lies outside it; never moves the camera. aimAssist off / low / high, + touch; auto = per device
  mag: { off: 0, low: 10, high: 20, touch: 25 }, magReach: 0.6, lockMag: 15, // a locked target gets at least lockMag
  // hit-stop in whole sim steps (RULINGS); simultaneous hits take the max
  stopEnemy: 3, stopBoss: 4, stopKill: 4, stopClink: 2, stopHurt: 4,
  // contact feedback (feel §8.4): the FP punch is WP1's (TUNE.view.punch, on EV.HIT); trauma for kills / clinks; TP hit
  // shake
  traumaKill: 0.15, traumaClink: 0.15, shakeTPHit: 0.15,
  fxNear: 0.6,                // FP: sparks never spawn inside this distance of the eye
  // crosshair interaction (feel §9.1): aim point height (NPC: fraction of its height) and radius per kind
  aimPts: { npc: [0.62, 0.35], sign: [1.05, 0.45], door: [1.1, 0.55], chest: [0.45, 0.55], pedestal: [0.75, 1.0], well: [0.9, 1.1] },
  // accept: angle ≤ clamp(atan(R/d) + add, min, cap) (touch × touchTol), XZ distance to the aim point ≤ range + 0.6
  npcRange: 1.9, rangeAdd: 0.6, tolAdd: 6, tolMin: 8, tolCap: 25, touchTol: 1.6,
  keepDeg: 4, keepDist: 0.3, keepT: 0.125, beatDeg: 3, // hysteresis: hold +4° / +0.3 m, drop within 150 ms of failing, rivals beat it by 3°
  keepGrace: 35,              // …that 150 ms grace only while the look is within this of it (a snap turn drops it at once)
  tpNear: 1.4, tpNearDeg: 70, // TP proximity fallback: aim surface within 1.4 m and ±70° of the body
  // lock-on (feel §8.8, arch WP4): acquire ≤ lockRange m inside ±lockCone° of the look (TP: else the nearest ≤ lockNear m
  // anywhere; in a boss fight the boss anywhere), score = angle° + lockDistW·m; terrain LOS in lockLosN samples. Breaks:
  // beyond lockBreak m (never the fight boss), LOS lost for lockLosT s, FP look > lockOffDeg° off for lockOffT s;
  // a dead target hands over to the nearest within lockRetarget m and ±lockRetargetDeg°
  lockRange: 18, lockCone: 45, lockNear: 6, lockDistW: 1.5, lockBossBonus: 20, lockLosN: 6,
  lockBreak: 22, lockLosT: 1.0, lockOffDeg: 40, lockOffT: 0.35, lockRetarget: 8, lockRetargetDeg: 60,
  lockSwitchDeg: 10,          // FP: lock pressed again while another candidate is ≥ this much closer to the crosshair → switch
  // TP with WP1's lock framing: a mouse flick (counts in lockFlickT s) or a stick flick (its horizontal part past
  // lockFlickPad while ≥ lockFlickHoriz × its vertical part) switches target. TP without the framing: no flicks, the near
  // fallback and the lock stay within ±lockFreeDeg of the camera (held further off for lockOffT: unlock)
  lockFlick: 45, lockFlickT: 0.12, lockFlickCD: 0.25, lockFlickPad: 0.85, lockFlickHoriz: 2, lockFreeDeg: 70,
  // TP with the framing: the stick is read relative to Pip → target; the part of it toward the target fades out over
  // the last lockStop m before Pip's body touches the target's (W stops at contact; enemies are not solid for Pip), and
  // A / D never circle it faster than lockOrbit °/s (at contact a full-speed strafe spun the camera at ≈ 300°/s)
  lockStop: 0.3, lockOrbit: 150,
  lockPt: { enemy: 0.5, boss: 0.45 }, // lock point: fraction of the hurt volume height
  // aim friction (feel §3.3): pad / touch look speed × friction while the crosshair is within frictionDeg of an enemy centre
  friction: 0.6, frictionDeg: 5, frictionRange: 12,
  // touch auto-face (feel §8.7; touch + aim assist high / auto, FP): at a swing start the view turns toward the best enemy
  // within ±faceDeg and faceRange m, at a peak of faceSpeed °/s
  faceDeg: 30, faceRange: 4, faceSpeed: 360,
  // encounters for the eye-level camera (arch WP4): never spawn inside the view cone (hFOV/2 + coneAdd, from the camera)
  // closer than spawnClear; in-cone spawns go spawnClear..spawnFar and emerge(); 2:1 weighting toward the forward cone
  // (±spawnFwdDeg of the movement direction, else the look); despawn only out of the cone (+despawnCone) beyond
  // CFG.despawnDist, or anywhere beyond despawnFar; regrow only out of the cone beyond regrowNear (or anywhere beyond
  // regrowFar); a ground spawn next to a bush pops out of it (bushSnap m)
  spawnClear: 24, spawnFar: 30, spawnNear: 16, spawnRing: 28, coneAdd: 15, spawnFwdDeg: 70, spawnFwdW: 2,
  despawnCone: 10, despawnFar: 70, regrowNear: 20, regrowFar: 90, bushSnap: 3.0,
};

// WP5 enemies, bosses, NPCs, audio
export const actors = {
  // readability rules for a 0.88 m eye with a ~100° view (arch §15.2 WP5, art §9)
  // telegraph colour code (art §0.2): coral = danger, cream = the bright top edge, gold = an opening
  danger: 0xff7a4a, dangerEdge: 0xfff3d8, chance: 0xffd34a, glint: 0xfff3a0,
  // enemy wind-ups (s): slime crouch, mushroom puff, bat rise, bee aim, crab windup, snowpuff windup
  windup: { slime: 0.40, mushroom: 0.55, bat: 0.60, bee: 0.70, crab: 0.65, snowpuff: 0.60 },
  slimeHopGate: 0.15,         // a slime hop can hurt only after this long in the air (telegraph lead ≥ 0.55 s)
  // an enemy starts an attack (token, telegraph, wind-up) only within this centre distance (m): about the farthest its
  // attack lands on a standing Pip (slime hop 4.4 m/s × 0.46 s, bat swoop 8.5 × 0.55, bee dive 9 × 0.45, crab charge
  // 7 × 0.85, each + the contact radius); further out it closes in first. Shots: the old ranges
  reach: { slime: 2.7, mushroom: 11, bat: 5.3, bee: 4.6, crab: 6.6, snowpuff: 12 },
  tokens: 2,                  // at most this many enemies in a wind-up or attack at once
  tokenRetry: [0.25, 0.5],    // an enemy refused a token waits this long (s) before asking again
  offEdge: 0.95,              // a source off the screen (behind, or |NDC x| past this) announces first …
  offView: 60,                // (fallback without a projecting view: further than this from the look yaw, deg)
  announce: 0.7, announceAdd: 0.25, // … this long before its wind-up, which is then this much longer
  batWait: 1.5,               // a bat waits up to this long to come into view before it announces and swoops
  notice: 13, forget: 17, forgetT: 3, // alert ('!' + chirp) at this range; it forgets Pip beyond `forget` after forgetT s
  alertLife: 0.7, alertH: 0.4, alertSize: 0.42, // '!' pop above the head (art §8): life, height over the top, size
  glintLife: 0.18, glintSize: 0.5,
  rimFlash: 0.35, rimHz: 7,   // body flash for the whole wind-up (toon flash amount, pulse Hz) toward a light coral …
  rimColor: 0xffa985,         // … or, for the olive slime and the yellow bee, a vivid version of their own hue (coral or
  rimColors: { slime: 0xd8ff4a, bee: 0xfff36a }, // cream turn them muddy / grey; the coral halo carries the colour code)
  passiveContact: false,      // difficulty knob: true = touching an idle enemy hurts (the old rule); false = a bump
  bodyH: 1.0,                 // Pip's body height for the vertical contact overlap
  emerge: 0.7,                // emerge animation (s), harmless while it runs (C16)
  // projectiles: snowball throw flight time (s) = clamp(d / snowK, ...) → flat arcs (apex ≲ 1.6 m over the eye)
  snowK: 8, snowT: [0.45, 1.1], reticle: [1.0, 0.3], reticleH: 0.4,
  // bosses
  ringJump: 0.30,             // shockwave / low attacks miss when Pip's feet are this high (player.alt, C2)
  ringWall: 0.45,             // light wall height over the damage band r ± width
  stripePad: 0.15,            // Pinch: the stripe is 2·(r + Pip r + pad) wide = exactly his charge contact width
  stripeLock: 0.4, stripeWall: 0.4,
  frostDisc: 2.9, pillarR: 1.2, pillarH: 8,
  zoneWall: 0.5, pillarIn: 0.16, // landing disc: rim light wall height (m); the pillar's veil alpha seen from inside it
  snapWind: 0.75, bubbleWind: 0.6, throwWind: 0.6, slideWind: 0.6, // boss wind-ups lengthened for the eye
  snap: [1.9, 1.3, 11, 0.28], // Pinch snap: claws this far ahead of his centre (m), hit half-width (m), lunge m/s, s
  snapLock: 0.5,              // … its aim (and the stripe) locks this long before the snap: a strafe begun 0.3 s after
                              // the telegraph clears the 1.3 m half-width before the snap (a sideways roll always does)
  slide: [10, 1.4, 0.8],      // Frostbun slide: m/s (× √enrage), s; the arena wall ends it with a bonk + this opening (s)
  bubbleEnraged: 1.6,         // enraged Pinch fires all 9 bubbles
  shove: 5.5,                 // passive boss contact: no damage, Pip pushed out to room[id] at up to this speed (m/s)
  // personal space (centre distance, m): far enough that an FP eye sees the boss's tells and the floor at its feet,
  // within wooden-sword reach (r + 1.6) − 0.2; a walking boss stops roomWalk further out
  room: { woods: 2.55, shores: 2.65, peaks: 2.75 }, roomWalk: 0.25,
  // the closest Pip's centre (the FP eye) gets to a boss's centre (m): its body's reach at 0.5–1.2 m height (GLB models:
  // Shroom 1.39, Pinch 1.46, Frostbun 1.64) + the near plane's corner (≈ 0.15). Used by separate(), the leap's landing
  // offset and the body collider (game.dynamicColliders, boss.colliderR)
  keepOut: { woods: 1.55, shores: 1.7, peaks: 1.85 },
  // a string of hits worth ≥ `hits` damage outside an opening (gaps < `gap` s; wooden sword: A 1, B 1, C 2 → the third
  // hit; Shiny Sword: 2, 2, 3 → the second) is shrugged off: Pip is shoved out at ≥ v m/s for t s
  // (out of sword reach, no damage) and the boss's next attack comes within `cool` s, but never sooner than `rest` s after
  // its walk began, so openings are where hits pile up; `wind` hits while it winds up or attacks shove him off too (the
  // tell is read from outside reach; 0 = off). Round 3 (lead ruling, careful / casual / masher bots): rest 1.2, wind 1
  shrug: { hits: 3, gap: 1.2, v: 7, t: 0.3, cool: 0.5, rest: 1.2, wind: 1 },
  // what each big attack takes from Pip (HP; a heart is 2): the stomp's ring, a charge / slide, Pinch's snap, Frostbun's
  // landing (projectiles take 1; round 2: all 2). Cadence: after an attack's recover, the next tell starts rand(cool[id]) s
  // later (round 2: woods 1.6–2.6)
  bossDmg: { ring: 1, rush: 1, snap: 1, leap: 1 },
  cool: { woods: [1.8, 2.8], shores: [1.4, 2.2], peaks: [1.5, 2.4] },
  minions: 1, minionHp: 2,    // the Shroom summons two Grumpy Shroomlets only while fewer than `minions` are about (round 2: 2); their HP (0: the type's 3)
  lean: 16, rise: 0.2, swell: 0.1, // boss wind-up deformation: lean (deg), rise (m), x/z swell
  tellNear: [1.5, 0.35],      // … the forward lean / swell scale down to [1] when Pip is at room, full [0] m further out
  preRing: [0.2, 0.25, 0.6],  // Shroom stomp: a light wall at r + [0] (half-width [1], height [2] m) from the crouch
  sparkleHz: 3,               // an opening's gold sparkles per second
  echoWarn: 0.3,              // enraged Shroom's echo ring: its own hop tell this long before
  // NPCs (art §10)
  npcLook: 4.0, npcWave: 2.6, npcBackHop: 1.1,
  npcHome: 0.9,               // a stay-at-home villager the back-hop moved walks back to her spot at this speed (m/s)
  // r4 gem / heart drops in first person (entities.js Pickup): launched away from Pip within ±awayDeg at speed m/s, vy
  // capped at vyMax (apex ≈ 0.34 m over the spawn: under the eye; a chest's own fountain keeps its vy), the magnet pulls
  // to the feet + magnetY (TP: the chest, +0.5) with its height closing magnetYK × faster than the distance. A kill at
  // sword reach launched its gem through the eye line and pulled it to just under the lens (a 300–500 px diamond on the
  // crosshair for 10+ frames)
  drops: { awayDeg: 60, speed: [1.5, 2.5], vyMax: 3.5, magnetY: 0.15, magnetYK: 2 },
  // audio (arch §12b): distance gain ref / max (m), cut below minGain; behind-you low-pass (Hz); heartSoft: the low-health
  // beat's urgency at hp 2 (the HUD's low pulse; 1 at hp ≤ 1), on the HUD's TUNE.hud.beat clock
  audio: { ref: 2.5, max: 45, minGain: 0.03, lpFront: 18000, lpBehind: 1400, panK: 0.9, heartSoft: 0.35 },
};

// WP6 HUD, menus, touch
export const hud = {
  // (art §12–13, arch §10; sizes in CSS px at --u = 1 unless noted)
  uMin: 0.72, uMax: 1.2, uK: 1.12,      // desktop scale unit: clamp(min(w/1920, h/1080) · uK, uMin, uMax) × hudScale
  petalLife: 0.8, petalR: 0.2,          // damage petals: life (s), ring radius (× screen height)
  chevEdge: 34, chevCone: 55, chevHz: 4, chevMin: 0.5, chevMax: 2.5, // threat chevrons: centre inset from the free area's edge (px × u; the arrow is 52), cone° (only without a camera), pulse, life clamp (s)
  chevNdc: 0.95,                        // a threat gets a chevron off the screen: behind the eye or past this of the half-width (= WP5's TUNE.actors.offEdge)
  reachCone: 32,                        // crosshair "in reach" petals: half-angle (deg) around the aim
  aimDeg: 10, pipDist: 8, pipHold: 2, pipLift: 0.06, pipPx: 10, pipMax: 5, // enemy pips: aimed within °, shown within m, after a hit (s), above the hurtbox top (m, then px × u), hearts cap
  retMin: 56, retMax: 220,              // lock reticle box (px × u): hugs the target's projected size within these
  hitMs: 170, killMs: 380,              // crosshair hit ticks / kill star (pop, hold, fade) (ms)
  speedAlpha: 0.55,                     // speed-line opacity at view.speedFx 1
  compassSpan: 180, compassW: 560, compassH: 38, landmarkRange: 160, // compass ribbon: degrees shown, size, landmark range (m)
  miniSize: 156, miniSpan: 120,         // minimap: size (px × u), metres across (redrawn on change: turning, 0.6 m of walking)
  feedLife: 3.0, feedMax: 3, feedMerge: 1.6, // pickup feed: line life (s), rows, gem lines merge within (s)
  logMax: 20,                           // chat log (pause): lines kept
  // r4 objective over a bridge (nav.js viaBridge): the straight line is sampled every viaStep m for the river; within
  // viaReach m of the bridge's near mouth (or on its deck) the marker moves to its far mouth
  viaStep: 1.5, viaReach: 2,
  dlgFar: 3.5,                // r4: first person keeps the dialogue portrait while the speaker is farther than this (m)
  bannerT: 2.6, bossCardDelay: 0.5,     // region chapter card (s, +0.8 on a first visit), boss lower-third delay (s; the intro's own clock, fight.js shows and hides it)
  bannerThreat: 14,                     // the region card fades when an enemy within this (m) has noticed Pip (or on a telegraph / hurt)
  beat: 0.9, lowBase: 0.32, lowPulse: 0.08, // low-HP beat period (s), vignette base / pulse (hp ≤ 2)
  coachLook: 45, coachWalk: 4, coachHold: 0.9, hintT: 4.5, hintGap: 60, // coach marks: look (deg; r4 45, was 90), walk (m), done pause (s); hint life (s), repeat gap (s)
  keyHintsT: 10, keyHintSessions: 3,    // bottom-right key chips: seconds shown, first N sessions
  stickR: 55, stickDead: 8, stickHome: 1.0, // touch stick: full deflection (px), dead zone (px), return home after (s)
};

// WP7 rendering performance
export const perf = {
  // arch §9.2, RULINGS perf budget. Distances in metres (camera XZ distance), widths in px at 1080p.
  far: 300,                   // world camera far plane (the sky is its own layer, WP8)
  // instanced scenery: per class cull distance (scale fade over the last `fade` m); trees swap to LOD1 over lodBand
  cull: { deco: 35, decoFade: 10, glow: 60, glowFade: 10, small: 90, smallFade: 10, big: Infinity },
  // full tree + hull below lodBand[1], a ≤ lodTris proxy (+ its own hull) above lodBand[0] (Bayer crossfade). 38–48 m, not
  // arch's 45–55: the fitted proxies hold up at 35 m and trees are the biggest GPU cost (a round tree is 1526 + 1454 hull
  // triangles, its proxy 172 + 172). 180, not 150: a round tree's 8 canopy lobes stay icosahedra (octahedra read as diamonds)
  lodBand: [38, 48], lodTris: 180,
  // proxies for the other heavy layers (model > lodMin triangles): [band start, band end, proxy triangles] per class
  lod: { small: [40, 50, 120], glow: [24, 32, 60], big: [50, 60, 80] }, lodMin: 400, lodMinTotal: 20000, // (layers ≥ that many triangles)
  coneMargin: 22,             // degrees added to the frustum's XZ half-angle; re-pack when the look turns by half of it
  coneMarginDeco: 60,         // the same for short-range deco (cheap to over-draw, costly to re-pack)
  repackMove: 1.0,            // re-pack when the camera moved this far (m) since the last pack
  nearAll: 3.0,               // items within this (+ their radius) are packed whatever the view direction
  shadowPad: 4,               // light-space margin (m) for shadow-only casters behind the view
  shadowFullR: 20,            // full models cast their own shadow up to this distance; beyond it (and behind the view) the proxy does
  // outlines: clip-space px at 1080p (scaled by the pass height), far fade band (m), and near the eye never thinner than
  // `w` metres projected (the foundation's near ink: 0.75 × its world widths), capped at outlineCap px at 1080p
  outline: {
    char: { px: 3.0, w: 0.0165, far: [70, 85] }, prop: { px: 2.3, w: 0.024, far: [40, 55] }, propOcc: { px: 2.3, w: 0.0255, far: [40, 55] },
    big: { px: 2.8, w: 0.0375, far: [90, 130] }, tree: { px: 2.7, w: 0.034, far: [40, 55] }, bush: { px: 2.4, w: 0.0225, far: [40, 55] },
  },
  outlineCap: 8,              // px at 1080p: the near world width never draws a thicker line
  outlinePxKMin: 0.75,        // px scale floor (pass height / 1080): a 585 px phone buffer still gets 0.75 × the 1080p width
  outlineInside: 0.45,        // an instanced hull is not drawn while the eye is inside its model's radial profile + this (m)
  outlineNear: [0.40, 1.0],   // width ramps in over this view depth; hull fragments nearer than [0] are discarded
  outlineThin: [10, 40, 0.7], // width × 1 → × 0.7 from 10 m to 40 m
  nearFade: [0.10, 0.32],     // NEAR_FADE dither band (view depth): gone at [0], solid at [1]
  nearFadeFoliage: [0.22, 0.60], // swaying foliage above its sway base (canopies, bushes, grass) fades over a wider band
  // r3 canopy cutaway (TP): a scatter tree whose axis is within its canopy radius + band[0] of the camera (ground plane) is
  // dithered out above its canopy base, back in full at radius + band[1]; on as the camera leaves the eye (m, ramp `on`).
  // r4: only beside / behind the camera: a tree whose axis is at Pip's depth along the view (min depthMin m) + depth[1]
  // keeps its whole crown (full cut up to + depth[0]: a tree beside Pip keeps it, one between him and the camera loses
  // it); a crown whose base is high[1] m over the camera too (from high[0]; a palm's is ≈ 2.3 m, a pine's 0.2–1.2 m).
  // Both bands are narrow: a tree that stands inside one keeps a part-dithered crown (walking past, ≈ 8 frames)
  cutaway: { band: [1.2, 2.0], on: [0.2, 1.2], depth: [-0.75, -0.15], depthMin: 1.0, high: [1.4, 1.9] },
  // generic culler (C10: userData.cull = { dist, fade } on any Object3D; scenery.root children by bounding radius)
  // [radius ≤ r → dist]; larger → never; re-scan period (s)
  objCull: [[0.6, 60], [2.5, 110]], objScanEvery: 2,
  objSpread: 6,               // C10: an object reaching farther than this (m) from its origin is culled by its nearest point, never scale-faded
  // resolution: DPR cap per quality (the canvas), dynamic resolution of the main pass (arch §9.2-7: GPU timer p75 of the main
  // pass every `dynEvery` timed frames; a step only changes the size of the next main pass, so it is free and immediate):
  // −dynStep after dynHiWins windows over dynHi ms, +dynStep after dynLoWins windows under dynLo, at most one per dynGap s
  dprCap: { auto: 1.5, low: 1.0, high: 2.0 },
  dynMin: 0.70, dynStep: 0.05, dynHi: 11.5, dynLo: 8.5, dynEvery: 30, dynHiWins: 1, dynLoWins: 4, dynGap: 0.5,
  shadowLow: 1024, shadowHigh: 2048,
  // near-field grass cards (art §4.2): camera-centred tiles, density per m² by splat layer, heights, fade band
  grass: {
    tile: 5, radius: 20, fade: [16, 20], h: [0.22, 0.45], w: 0.55,   // art §4.2: radius 20 m, dithered out over 16–20 m
    dens: { grass: 6, forest: 5, meadow: 9 }, flowers: { meadow: 1.2, grass: 0.4, forest: 0.25 },
    pathD: 1.4, minK: 0.35, sway: 0.09, cutR: 0.18, regrow: [40, 70], regrowNear: 12,
    syncR: 10, budgetMs: 0.6, refillEvery: 8, // tiles nearer than syncR are made at once, the rest within budgetMs per frame
    blades: 0.6,              // fallback (no card texture): tuft scale; density × 1/3
    clipFx: 10,               // clippings bursts per sword swing (one 'leaves' sound per swing)
    alphaTest: 0.5,           // card cut-out (no alpha-to-coverage: it stippled the edges)
    // card tint per splat layer = the ground texture's average colour / the cards' (so a card at tintMid of its height is
    // the colour of the ground it grows from); groundMatch blends it with the hand-tuned tint (0 = hand-tuned only)
    groundMatch: 1, tintMid: 0.85,
  },
  // particles: near fade band (view depth), size caps (fraction of the buffer height) near / far, halo rules
  pNear: [0.35, 0.9], pCapNear: 0.16, pCapFar: 0.25, haloNear: [0.5, 3.0], haloMax: 1.6,
};

// WP8 atmosphere, sky, terrain, water
export const atmo = {
  // art §4.1, §5–§8; arch §9.2-4/5
  far: 300,                   // world camera far plane (m); the sky layer is drawn behind it at depth 1
  // fog per region (radial distance, m): [near, far, tint hex, tint amount at mid distance]; × the time-of-day factors
  fog: {
    village: [30, 230, 0xf4ead0, 0.10], woods: [16, 165, 0x9cc79a, 0.45], peaks: [34, 255, 0xe6eef8, 0.25],
    shores: [36, 262, 0xe8f4f2, 0.15], meadow: [30, 235, 0xf4e9c4, 0.22], arena: [26, 150],
  },
  woodsHemi: 0.08,            // hemisphere ground colour lift in the woods (blended with the region fog)
  fogDusk: 0.9, fogNight: 0.78, fogBlend: 1.0, // dusk / night distance factors; region blend λ (≈ 3 s to settle)
  capFade: [262, 292],        // fog caps (landmarks) release over this distance, so nothing pops at the far plane
  capTree: 0.30, capLandmark: 0.45, // max fog factor on the Great Tree / W.landmarks (position cylinders)
  capTreeR: 9, capY0: 1.2,    // Great Tree cylinder radius ≥ capTreeR (else 0.55 × height); caps start capY0 m over the ground
  // sky layer
  hazeK: 0.55, hazeNightK: 0.25,
  clouds: 18, cirrus: 6, isles: 6,
  sunSize: 105, sunDusk: 125, moonSize: 78, skyR: 650, // billboard widths at the virtual distance skyR (m): ≈ 9° / 7°
  starTile: 2.6,              // stars texture repeats across the stereographic dome
  starsLum: [0.30, 0.50],     // stars fade out as the zenith's displayed luminance rises over this band (× night)
  // sun path: the light never drops below lightMinEl (rad) so toon shading stays readable; the painted sun / glow
  // follow the visible elevation down to the horizon at dusk / dawn
  lightMinEl: 0.40,
  moonEl: [0.30, 0.56],        // the moon's arc elevation (rad, ≈ 17°–32°): in an eye-level view, glint path on the sea
  // shadows: one map, box half-size E (m), centred shadowAhead m along the view, texel-snapped in light space
  // (E 24 m centred 14 m ahead: the ground from 10 m behind to 38 m ahead, 2.3 cm texels; the lead's budget of ≈ 25 calls
  // held in every sweep view, against 26 for E 28 / 17 m.) shadowDist: the light sits this far up the sun ray from the box
  // centre, the box ends shadowFar from the light; the light never drops below lightMinEl (23°), so a 20 m caster lands
  // ≤ 51 m down its ray: 60 / 95 keeps every caster and drops 25–45 % of the shadow-pass calls at 17 h against 100 / 200
  shadowE: 24, shadowAhead: 14, shadowMap: 2048, shadowMapLow: 1024, shadowFar: 95, shadowDist: 60,
  // Pip's night light: pipUp m over Pip's feet (0.72 m over the FP eye) in both views, the foundation's light (WP2's
  // viewmodel copies it). Ahead of the eye (art §7: 2 m ahead) it made a hot spot on doors / signs at interaction distance
  pipUp: 1.6, pipI: 4.5, pipRange: 7, pipDecay: 1.5,
  // terrain
  aniso: 16, anisoLow: 4,     // anisotropic filtering (capped by the GPU)
  detailNear: 4, detailFar: 10, detailAmt: 0.42, // near-detail layer (4× frequency) fades out between these (m)
  // cliffs: world normal y where cliff_hd starts / is full (≈ 49° … 60°, only where rock is the ground layer); m per tile
  // vertically and its horizontal stretch (rows → strata); snow on the cliff from / full at these heights (m, the peaks);
  // how much of the art's own contrast is kept (the rest is its mean colour)
  cliffNy: [0.66, 0.5], cliffPeriod: 10, cliffStretch: 2.4, cliffSnow: [10, 16], cliffSoft: 0.6,
  rockScale: 0.45, rockSoft: 0.15, // rock_hd uv scale (per 7 m tile; 0.45 → stones ≈ 1 m) and contrast softening
  sideNy: [0.86, 0.62],       // rock / snow side-projected on steep faces: from this normal y (≈ 31°) to full (≈ 52°)
  sideFar: 32,                // … within this distance of the eye (faded out over its last 40 %)
  detailSteep: 2.0,           // near-detail gain on rock / snow (their art is soft and large-scale at the feet)
  // r3 near-ground grain (boot-generated texture): full within near, gone by far (m from the camera), amount, m per tile
  grain: { near: 2.2, far: 4.2, amt: 1, tile: 0.85 },
  plazaEdge: 0.8,             // cobble disc edge noise (± m) around W.plaza
  // water
  fresnelMax: 0.72, glint: 2.6, glintPow: 220, foamTile: 3.0,
  ripples: 8, rippleLife: 0.9, rippleSpeed: 0.85,
  // ambient: view-relative volume (art §8): centre = eye + view dir × ambAhead, radius ambR, nothing within ambClear of the eye
  ambAhead: 10, ambR: 14, ambClear: 1.5,
  // woods light shafts: count, additive strength (a soft haze under the crowns), the hour whose sun ray they are baked
  // along, the beam's top end (m inside a round crown's underside), where along the beam (0 ground … 1 top end) it is gone
  gulls: 6, shafts: 10, shaftK: 0.4, shaftHour: 9, shaftIn: 0.5, shaftTop: 0.9,
};

// WP9 world content
export const world = {
  // layout numbers are read by world.js at generation; visuals by world-mod.js
  treeH: 19.8,                // Great Tree scaleHeight (×2.2 of the 9 m GLB, RULINGS); the bloom GLB keeps its ratio
  // root mound radius per 30° bearing (0 = +Z south, clockwise toward +X) at treeH, measured below 1.5 m on the GLB:
  // the trunk + root colliders follow it so the eye never walks into the bark
  rootR: [5.9, 8.0, 7.6, 8.5, 5.0, 8.0, 5.9, 7.1, 5.0, 7.8, 7.6, 7.3],
  plazaR: 16, plazaFlat: [18, 24], // paved plaza radius (W.plaza.r / W.plazaMask) and the terrain flatten band
  pedestalZ: 7.3,             // altar centre (z), in front of the south root tips; (0, 9.5) and z = 9 stay free for tests
  pedestalTop: 1.05, pedestalTilt: 0.68, socketDX: 0.58, // socket surface height, slab tilt toward +Z (rad, 39°), spacing
  pedestalR: 1.02,            // the altar's collider: a circle round the brick ring and the slab corners (mesh ≈ 1.0 m in the body band)
  spawnZ: 13,
  lampR: 16, lampEvery: 18, lampFrom: 16, lampTo: 62, // plaza lamp ring; path lamps every 18 m from 16 to 62 m
  waymarkEvery: 30,           // waymarker posts along the four paths
  edgeStoneR: 45, edgeStoneGap: [0.9, 1.3], edgeStoneOff: 2.15, // path-edge stones within 45 m of the plaza
  coinPathD: [8, 40],         // coin chests: true distance to the nearest path (m)
  landmarkH: { woods: 21, peaks: 15, shores: 18, meadow: 15 }, // tall enough to read over the canopy along their paths
  landmarkFogCap: 0.45,       // landmarks never fog out more than this (art §4.5), so each region reads from its skyline
  // runtime look (world-mod.js)
  crownLobes: 18, crownCards: 36, lanterns: 10,
  socketPulse: 1.2,           // empty-socket glow period (s)
  windmillSpin: 0.35, beamSpin: 0.2, // rad/s
  signPx: 256,                // sign board cell width in the text atlas (≤ 512 px canvases)
};

export const TUNE = { view, vm, move, combat, actors, hud, perf, atmo, world };
