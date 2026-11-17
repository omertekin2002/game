# WP3 — Player physics and world collision (as built)

Files: `js/player.js`, `js/phys.js`, `js/world-collide.js`, `js/player-fx.js` (module `wp3-player-fx`), `TUNE.move`
(`js/tune.js`), `CFG.playerSpeed` (`js/data.js`), `js/debug/tests/wp3.js`. Foundation test assertions changed in
`js/debug/tests.js` (marked `// WP3:`, listed at the end). Nothing else was touched.

## 1. Movement (`js/player.js`, numbers in `TUNE.move`)

| | Before (foundation) | Now |
|---|---|---|
| run / strafe / backpedal (FP, and TP while a module holds `bodyYaw`) | 5.0 / 5.0 / 5.0 m/s | **4.40 / 4.18 / 3.52** (`run`, `strafeK` 0.95, `backK` 0.80; c = dot(wish, look fwd): c ≥ 0 lerp(0.95, 1, c), c < 0 lerp(0.95, 0.80, −c)) |
| TP explore (turn-to-move) | 5.0 | 4.40 any direction |
| wading | × 0.62 | × 0.62 (`wadeK`), no sprint, jump v0 × 0.7 |
| sprint | none | **5.8 m/s** (`sprint`) while the roll button is still held when the roll ends; a roll press while the roll cools down sprints at once; pad L3 (`sprintToggle`) latches it. Only within ±50° of the look (`sprintCone`), sideways capped at 4.18. Ends on release (hold mode), wish < 0.3, a > 60° turn of the input (`sprintTurn`), the wish staying outside the ±50° cone for 0.2 s (`sprintConeT`, end reason `'cone'`: a gradual turn into a strafe / backpedal no longer reports a sprint at plain speed), wading, a swing / hurt / any non-normal state. No auto-jog (RULINGS). `player.sprint` is the live state, `sprintMode` `'hold'|'toggle'`, `sprintEnd` the last reason |
| acceleration | vector 38 / 30 | vector 38 / 30 (`accel` / `decel`): 0 → 4.4 in 7 steps, 4.4 → 0 in 9, same on diagonals |
| jump | plumbed, no effect | **v0 6.12, gravity 22 rising / 32 falling** (exact within a step, split at the apex), release while rising halves vy once (`cutK`), terminal 20. Measured: apex **0.851 m**, airtime **0.517 s** (31 steps), tap hop **0.287 m**, landing impact 7.63 m/s, jog jump **2.27 m**. Coyote **0.10 s**, buffer **0.12 s**: a press up to 7 steps before touchdown jumps **on the touchdown step** (re-checked right after the landing in the same step; round 2 — it used to jump one step late, and only from 6 steps out; feel T16). Air: 14 m/s² toward the wish (speed along it beyond the target is kept), drag 0.5/s without wish, cap = max(take-off speed, 4.4) ≤ **6.2**. Dash-jump in the first 0.10 s of a roll (`dashJump`, keeps ≤ 6.2); a jump cancels a swing from attackT 0.20 (`attackJump`; earlier presses stay buffered; the chain stays live); air swings have no lunge; no roll in the air (the press waits in its buffer) |
| ground contact | terrain snap every step | snap down ≤ 0.35 per step (`stepDown`), deeper = fall (with coyote); a standable top / deck is ground only from above (`stepUp` 0.35 is the reach of `standTop`). No fall damage. A jump under an overhead body part (`c.over`, e.g. a declared counter) stops with the head at its underside (`phys.headroom`; vy → 0) |
| standing on props | none | **stumps and rocks no taller than 0.75 m** (+ bridge decks), behind `TUNE.move.standOnProps` (default true). Reached by jumping (tops never block from above, are walls from the side); the stand height domes down toward the edge, support reaches `ledge` 0.15 m past it; stepping or dropping off slides Pip off softly (`softPush` 0.06 m/step). Pots, chests, the pedestal: never |
| knockback | 7 m/s horizontal | + a hop: vy 2.5 (`hurtHop`) when grounded **and the camera is out of Pip's head** (TP, shots; lands within 17 steps); its touchdown back on its own level (≥ take-off − `stepDown`) emits **no `EV.LAND`** (its take-off is no `EV.JUMP` either; field `hopY`). **First person: no hop** (round 2: it lifted the eye 13 cm, also under reduce motion, and landed it with a full landing — WP1's spring dip and −0.52° nod, the viewmodel dip, `land` sound, dust; the FP hurt is WP1's directional kick, feel §6.4) |
| stuck | — | `lastSafe` refreshed every 0.5 s while grounded on a walkable, reached, clear spot; inside a body collider (> 5 cm) or off the walkable area for > 0.5 s → `player.stuck`; the module fades out 0.15 s, `player.unstick()` warps to `lastSafe`, view snapped, fades in |

New player fields: `hopY` (feet y at a TP knockback hop's take-off, else null), `bodyShown` (the last step's `intent.bodyShown`), `coyoteT, airT, jumping, cutDone, airCap, groundY, standOn (null | 'deck' | collider), surface, landImpact,
sprintMode, sprintRef, sprintEnd, sprintToggleOff, sprintOutT, lastSafe {x, y, z}, safeT, unsafeT, stuck, _sim, _mv`. Getter **`alt`**
(feet above the ground under Pip, 0 grounded). Methods: `warp(x, z)`, `resync()` (any external move of `pos` between
steps — teleport, `place` — re-seats Pip on the ground there and drops vertical motion), `groundAt`, `integrate`, `fall`,
`jump`, `canJump()` (the states a jump may start from), `endChainSwing(cut)`, `targetVel`, `airMove`, `updateSprint`, `startSprint`, `footsteps`, `surfaceHere`, `safety`,
`reachable(x, z)`, `unstick()`. Intent: reads the new optional `intent.sprintToggle` (set by the module's `intent` hook).
Integration order per step: horizontal `moveCircle` (velocity becomes what actually happened when a wall took part of
the move) → `groundFor` → grounded / air resolution → events.

**Contract C2 (provided):** `EV.JUMP {}` at take-off; `EV.LAND { impact (m/s ≥ 0, 3 decimals), surface }` at touchdown (not at a TP knockback hop's touchdown, above; a buffered jump on the touchdown step emits `LAND` then `JUMP` in the same step)
(`surface`: terrain's `grass|dirt|sand|snow`, `wood` on bridges and stumps, `stone` on rocks, `water` wading);
`player.grounded`, `player.vy`, `player.alt`, `player.sprint`. A full jump keeps `alt > 0.30` for 0.40 s (24 steps).
`EV.STEP` fires only while grounded; its surface is `stone` / `wood` on a top.

The attack chain itself is unchanged (TUNE.combat timings, 55 % move while swinging); `sfx('swing')` / `sfx('dash')`
moved out of player.js (see §4).

## 2. Collision (`js/phys.js`)

`moveCircle(W, e, dx, dz, o)` (same signature; enemies unchanged except that boxes / the star are exact now) gained
options for walkers that pass their feet: `feetY` (standable tops, overhead parts, one-way deck walls), `grounded`, `on`
(the top it stands on), `slide`; it writes the step's start to `o.x0 / o.z0`. **Overhead rule**: only parts flagged
`c.over` (a part with its own `y0`: eaves, awnings, a declared counter) are ever passable by height — when they start
above the head (`y0 > feetY + 0.98`), and, sticky, while the walker already overlapped them at the start of the step and
their bottom is more than a step (0.35) above the feet, so ground rising under a part can never flicker it solid /
passable (the foundation rule applied to every collider: a walk downhill along a boulder sitting higher on the slope made
it passable, then solid while overlapped — stuck). `export headroom(W, x, z, r, feetY)` (the jump ceiling) and
`export HEAD` (1.0). Colliders of every shape push out along their
surface normal (3 iterations), so walls slide at any angle (house box at 20/45/70°: tangential speed 1.505 / 3.111 /
4.135 m/s = 4.4·sin, flush, velocity = slide); a fence run is one box (lateral wobble 0). **`slide`**: collide-and-slide
on the walkable area (cliffs, deep water) — up to 4 contacts per step along the local edge tangent (`W.walkNormal`,
central difference 0.06 m), 4 mm skin; where that local normal is head-on (|cos| > 0.95) and the 0.25 m normal leaves
more tangent (a notch of the 1 m walkability field) the 0.25 m one is used; a step that would end inside a wedge takes
the clear part of the move. Cliff edges (24 diagonal edges × 2 directions at 45°, 1.25 s each; a stall = 12 steps with
< 0.12 m progress, legitimate where the 0.5 m-scale edge is within 25° of head-on, a concave wedge, or a solid met
head-on): **0 glue stalls, mean 3.68 m/s** here, **0 / 3.78 m/s in the WP3+WP9 merge** (axis fallback on 6 edges: 3 / 5
glue, mean 2.15 / 2.47). 60 edges × 2: 0 glue in both worlds. New export `penetration(W, x, z, r, feetY, grounded, on,
skipStand)` (overhead parts the circle overlaps count as passable, consistent with the sticky rule).
**Hairlines (round 3).** For `slide` walkers (the player) the ground test is the new export `walkOK(W, x, z)`:
`W.walkable` and not a sliver — where the walkability margin `W.walkF` is under 0.35, a point is refused when, along one of
four directions (the axes and both diagonals), the walkable area ends within 0.1 m on both sides (a strip < 0.2 m
across). Two limits meeting at a grazing angle (deep water against a bank too steep to walk) leave such a sliver, and the
edge slide used to thread it for metres: a `wp3-heavy` walk waded 4 m along one at the peaks shore (61.5…62.8,
30…33.5) to 6.4 m from `W.reach`. Strips ≥ 0.2 m wide, every ordinary edge and bridges (margin 1) are unchanged; a convex
corner of the walkable area loses its last ~0.1 m. `W.walkable` itself (reachability, spawns, placements) is unchanged.
Enemies and NPCs keep `W.walkable`.

## 3. Colliders and probes (`js/world-collide.js`)

Shapes are derived from what was generated, by prop kind / building type / scale / yaw — never coordinates:
- `FIT[kind]` (props at scale 1, measured from the prop meshes in the body band): bush r 0.84, rock 0.63, boulder 1.29 +
  lobe 0.66, stump 0.56, lamp 0.34, **sign box 0.50 × 0.10**, well 1.13, pedestal 1.17, tree_round 0.60, palm 0.34; pines
  0.60 while the lowest skirt (measured from the mesh) hangs below the eye, else the 0.42 trunk.
- `BUILDINGS[type]`: house_a circle 2.42 + porch / step parts, **house_b and the shop as boxes**, roof eaves / the
  awning as overhead camera-only parts (`y0`, `cam: true` → `body: false`, `over`). **Re-measured on WP9's models in
  integration round 2** (the body-band mesh, 0.05–1.0 m, of each building against its colliders; `wp3` "buildings fit
  WP9's models" asserts every point is inside or within 3 cm): house_a's door steps a box (z 2.75, 0.56 × 0.37: the
  lower step's corners stood 0.15 m outside the old circle); house_b's box 2.22 × 1.85 (flower boxes and ivy reach
  |x| 2.21, the front boxes z 1.85); the shop's box 2.42 × 1.8 (side flower boxes, ivy), WP9's outdoor counter as its
  box (x 0.55, z 2.55, 1.18 × 0.29, h 0.82), the two end crates (0.28 × 0.28, h 0.7), **the awning's two posts** (r 0.07,
  eye 0.05 — they had no collider: Pip's body went 0.27 m into one and the FP eye stopped 0.046 m from it, wp3-heavy's
  shop FP contact), the stacked back crates (r 0.36). The foundation's counter / crate parts behind WP9's counter are
  gone; WP9's own `'counter'` / `'dressing'` circles stay (a superset).
- chests: a box per chest (yawed, heart × 1.15); fence chains → **one box per straight run**; bridges: **rail boxes** both
  sides from 0.35 m in from each deck end (arch §7.2 / feel §4.6 keep the mouths open; pieces following the deck's arch,
  deck − 0.6 … deck + 0.92), **a round post (r 0.12) at each deck end** where the mesh has one, and a deck box
  (`b.deckBox`) for the one-way rule.
- **Tree canopies** (`tree_pine`, `tree_snow`, `tree_round`): the main collider carries `canopy` = the crown's / lowest
  skirt's underside measured from the built model of the kind (`export canopyOf(kind)`: the lowest mesh point per polar
  cell, 24 bearings × 0.1 m rings, of everything above 0.45 m outside the trunk; each node the lowest of its 3 × 3
  neighbourhood so the bilinear blend never rises above the mesh; outside the crown the ceiling rounds the rim with radius
  eyeClear and then rises 1.5 m per m) and `cy` (the mesh base: `scatter.composeFor` sinks trees 0.08). WP9's raised
  skirts are picked up by themselves.
- **The Great Tree: one `'star'` collider measured from the built model** (`treeFitFromModel`, run by
  `fitTreeColliders`; band and spacing in the exported `TREE_FIT`): the outline of every triangle in Pip's body band per
  direction (n = 2π·R/0.22 vertices, 64…512),
  gaps narrower than 0.6 m closed (metric closing), plus a polar height grid (0.25 m rings) that is the spring arm's top
  (it passes over low root tips, never through the trunk). It follows WP9's scale: at ×2.2 the outline grows to r 8.58 with
  245 vertices; ≥ 99.97 % of the band mesh inside it at ×1 and ×2.2; 150 random walks / jumps / rolls into the roots at
  each scale: 0 steps inside it, 0 stuck. Unreadable model → the old footprint-radius circles. The fit replaces the
  generator's raw colliders of kind `'tree'` and any flagged **`greatTree: true`** (opt-in; WP9's `'gtroot'` ring is kept
  unless WP9 flags it — see §10).
- A prop's own declaration still wins (`addProp(…, { collider: { r | hx, hz | parts: [{x, z, r | hx, hz, h}], h, cam,
  eye…, stand } })`); a building may carry `collider: [parts]`. `combat.buildCuttables` reuses `prop.collider` for the
  live collider link: a built collider is never read as a declaration (`declOf`).

Collider fields: `shape: 'circle' | 'obb' | 'star'` (was circle only), OBB `hx, hz, rot` with local +z = (sin rot, cos rot),
star `n, rad, vx, vz, core, nr, dr, top`, `body` (false = camera / eye only), **`over`** (an overhead part: a part with its
own `y0` — a ceiling for the FP eye and for a jump, never pushed against sideways, the only kind of collider ever passable
by height), **`canopy`** + `cy` (trees, above), `part`, `main`, `building`, `bridge`, `chest`, `fixed`, `wp3`. `r` is the
bounding radius (hash). **Declared OBBs are exact** (`addProp(…, { collider: { shape: 'obb', hx, hz } })`): under the
foundation a declared box was solid as its bounding circle (ARCHITECTURE §9); now its box is the footprint, so a
declaration must describe the mesh's real footprint (a round mesh declared as a box is walked into at its corners).

New / changed world methods: `colliderDist(c, x, z)` (signed, exact for every shape; module export `shapeDist(c, x, z,
out)` also gives the outward normal), **`colliderContains(c, x, y, z, top = 'cam'|'body')`**, `rawColliders()`,
`solidShapes()`, `railShapes(b)`, `deckAt(b, x, z)`, `treeFitFromModel(h)`, **`refreshReach()`** (re-runs the BFS on the
colliders as built after the tree fit; `W.unreachable` re-checked, nothing carved), `standY(c, x, z)`, `standTop(x, z,
feetY, step)`, `groundFor(x, z, feetY, props = true, out)` (`out.on`: null | 'deck' | collider), `walkF(x, z)` (walkability
margin), `walkNormal(x, z, out, e = 0.25)`. `buildWalk` rasterises the same shapes Pip collides with.
**`probeSegment`**: both call forms and the result fields unchanged; boxes are exact (rounded box swept by the radius),
the star is marched (≤ 0.1 m) with its height grid, rails / eaves / roots are colliders like any other. No allocations per
call in the box / star paths.
**`eyeKeepOut(eye, feet)`** implemented, continuous in the eye position:
- sides: ≥ `TUNE.move.eyeClear` (0.12 m) outside each nearby collider's eye radius (circles: `rEye`; boxes and the star:
  the shape itself) along the XZ normal, shrinking like a sphere above a collider's top;
- ceilings: overhead parts (`over`) and canopies are never pushed against sideways (that was the 0.31 m house_a eave
  pop); the eye stays 0.12 m under their underside, a ceiling that rounds the rim (radius 0.12) and rises 1.5 m per m
  outside the footprint. A canopy never pulls the eye below the standing eye height over the terrain there, so a skirt
  that already hangs below the eye (the foundation's pines, until WP9 raises them) keeps the old view and only stops a
  jump from rising into it. **`W.eyeCeiling(x, z)`** returns the ceiling (debug / tests).
Measured: flush jumps against every building (142, the reviewer's survey): eye pop 0 (was 0.31–0.33 m in 6 runs);
eye-to-mesh in FP contact (heavy suite): bush 0.315, boulder 0.309, rock 0.535, well 0.384, house_a 0.397, house_b
0.300, shop 0.34 m; tree canopies, 12 trees × 4 sides per kind, standing and at a held jump's apex: ≥ 0.12 m under the
crown (round trees 0.125, WP9's raised pines 0.12 in the merge) and 0 rises under the foundation's low skirts. Pixel scan
(the reviewer's `pinescan`, 20 trees per kind): jump-apex-only "inside" frames pine 42 → 2, snow pine 37 → 0, round 19 → 7
(the remaining frames are the trunk and the crown's outline band filling a view at 0.5 dark pixels, not inside a mesh).

Counts (seed 7151): 1675 colliders before → **1781** (78 boxes: house 8, fence 10, chest 14, sign 8, rail 38; 12 rail end
posts; 1 star; 7 overhead parts; 846 trees with a canopy). `W.unreachable.length` 0, carved 0.

## 4. Module `wp3-player-fx` (`js/player-fx.js`)

- Dust from the bus: `EV.STEP` (bigger while sprinting), `EV.JUMP`, `EV.LAND` sized by `impact` (ring of dust; from 6 m/s
  a low ring rolling out ~1.2 m; snow spray; splash in water), roll start / end and a puff trail while rolling. **First
  person:** from `fpDustImpact` (4 m/s) a fan of 8–14 puffs is **placed by the view** (`fpFan`): each on the ground where
  the eye's ray through a point in the lower fifth of the frame lands (any FOV, aspect, pitch; 0.7–4 m out), clumped in a
  near and a far row, carrying Pip's momentum; a warmer, darker soil tint per surface (`FP_TINT`) so it reads on bright
  grass, a little more opaque from `fpDustBig` (6 m/s). Checked at FOV 80 / 100 / 115 and 2560 × 1080 (the fan was out of
  frame at FOV 80 before).
- **Footprints on sand and snow**: one boot print per step (half of sprite `fx_footprint`, beside the foot's side of the
  path; the pair at a landing ≥ 2.5 m/s), tilted to the terrain, lit (Lambert), fading after `printLife` 8 s over 2.5 s;
  one instanced draw call (`printMax` 48, `userData.cull = { dist: Infinity }`); drawn ovals when the sprite is missing.
- Pad L3 sprint toggle: `frameInput` latches `input.pressed('sprintToggle')`, `intent(it)` sets `it.sprintToggle`.
- Stuck recovery warp (fade 0.15 s each way) and emits **`'unstick'` `{ x, z }`** (string event, no `EV` constant).
- **Legacy sounds**: `step`, `splash`, `swing`, `dash` now play from here on `EV.STEP` / `EV.SWING` / `EV.DASH_START`
  while `TUNE.move.legacySfx` is true (they were `sfx()` calls in player.js). No new sound names.
- Debug: **`G.debug.phys`** = `{ state(), jumpTrace({ hold, run, sprint, frames, warm }) → { apex, airtime, dist, impact,
  trace }, near(x, z, d), warpSafe(), prints() }`.

## 5. TUNE.move keys

`run strafeK backK wadeK sprint sprintCone sprintMinWish sprintTurn sprintTurnLag accel decel jumpV gUp gFall cutK termV
coyote buffer airAccel airDrag airCap wadeJumpK dashJump attackJump stepUp stepDown standOnProps ledge softPush hurtHop
bodyR eyeClear safeEvery unstickAfter unstickFade slopeSpeed slopeK slopeLo slopeHi fpDustImpact printMax printSize
printLife printFade printAlpha legacySfx`, and **`sprintConeT`** (0.2 s), **`fpDustBig`** (6 m/s) from the review round. `CFG.playerSpeed` = 4.4 (only player-body.js still reads it, for the walk
animation scale). Optional slope slow-down (feel §4.1) is implemented and off (`slopeSpeed: false`).

## 6. Tests

- `wp3` (in `'all'`, ~4.5 s): 32 tests — speeds, vector accel, jump numbers + C2 events, jump cut, alt window, coyote /
  buffer, dash-jump / no air roll, swing jump-cancel, standable tops, step heights on a path, bridges (54 side runs, 27
  waders), collider shapes + reach, the Great Tree star at ×1 and ×2.2, wall / fence / cliff slides (48 cliff runs, glue
  stalls vs legitimate stops), eye keep-out at a side collider, **eye under eaves / awnings (48 flush jumps: eye ΔXZ ≤
  body ΔXZ + 1 cm, never above the ceiling)**, **sticky overheads (a synthetic overhead box on an uphill run: no shove,
  not stuck, a jump bonks)**, **the shop counter (4 offsets: no shove, stops in front)**, **tree canopies (4 trees × 4
  sides per kind, standing and apex, against the mesh)**, **sprint cone end**, **the Great Tree raw-collider replacement**,
  **bridge mouths (every deck end along the axis and at ±35°; round 3: any stop off the deck fails — the wedge
  exemption for the islet rock is gone with the rock)**, **hairline (round 3: a stub world — the slide stops at the mouth
  of a 0.1 m sliver and walks a 0.5 m strip to its end)**, stuck recovery, **knockback hop (TP only, no EV.LAND at its touchdown; FP / reduce motion: no hop, no eye rise, no
  landing)**, **jump buffer (T16: a press 7 steps before touchdown jumps on the touchdown step, 8 does not)**, **buildings
  fit WP9's models (body-band mesh within 3 cm of the colliders)**, **shop counter (WP9's: 4 offsets stop at its front;
  the awning posts stop the body)**, L3 toggle, footprints,
  arena clamp in the air, exact box probes.
- `wp3-heavy` (heavy, ~15 s): 1000 random jumps (0 landings outside `W.reach` ±2 cells or joined to it by a 0.1 m walk
  flood fill, 0 stuck), 500 random 10 s walks (worst grounded step 0.34 m, 0 stuck, 0 off-world, never > 6 m from
  `W.reach`: farthest 5.39 m in round 3, at the peaks shore band (61.6, 31.0) the 1 m BFS misses; 6.4 m before the
  hairline gate — the merge did not change the path, it re-drew the walks' random start cells because `W.reach` changed
  near the altar and the islet), 200 walks / rolls / jumps / sprints into
  every bridge side (0 exits) + islet waders (0 entries), the Great Tree at ×1 / ×2.2, house gaps by mesh ray-march (worst
  gap 0.127 m, worst overlap 0.03 m; a stopper up to 0.1 m above the head counts for the gap), **FP at tree canopies (12
  trees × 4 sides per kind, standing and apex)**, FP eye-to-mesh contacts. Options: `run('wp3-heavy', { n, walks, per,
  tree })`.

## 7. What in ARCHITECTURE.md is no longer true

- §5: `JUMP` / `LAND` are emitted (not "WP3; not emitted yet"); `STEP` surface also `stone` (rocks) / `wood` (stumps).
- §8: speed is 4.4 with the direction table, sprint 5.8, jump works; "`sprintToggle` has no consumer" → wp3-player-fx;
  the new fields / methods above.
- §9: shapes are `'circle'|'obb'|'star'` ("All shapes are 'circle' today" is gone); OBBs are exact in `probeSegment`
  (no bounding circle); `groundFor` standable tops use the dome / ledge rule (not "within 0.85·r, feetY ≥ top − 0.25") and
  only stumps / low rocks; `eyeKeepOut` is implemented; `fitTreeColliders` builds one star and re-runs reachability;
  `buildWalk` uses the exact shapes. `rEye` is used only for circles. Declared OBBs are exact (not bounding circles).
  Only `over` parts are passable by height ("y0 above the head" no longer applies to every collider).
- §16: `TUNE.move` is no longer empty. §17: `G.debug.phys`. §18: suites `wp3`, `wp3-heavy`.
- Sounds `step / splash / swing / dash` come from the module (legacy switch), not player.js.

## 8. Foundation test edits (`js/debug/tests.js`, each marked `// WP3:`)

- `run speed 5.0 ± 0.05` → 4.4 (RULINGS); `eye moves 8.33 ± 0.3 cm per frame` → 7.33 (bounds 7.03 … 7.63).
- smoke "baked collider fields": shape may also be `'star'`.
- probe suite: "camera inside a collider" uses `W.colliderContains` (exact boxes and the star's height grid).

## 9. Known limits

- Jumping over pots / low props is not possible (feel §4.5: every collider but the approved tops blocks at every height).
- `W.reach` is a 4-connected BFS on 1 m cells; Pip's walkability is continuous, so walks can follow thin walkable tongues
  a few metres past it (pond bars, pinches, a 0.2–0.5 m shallow band at a shore). Slivers under 0.2 m are no longer
  walkable for Pip (§2). No sequence break was found (max 5.39 m in 300 000 random steps).
- BUILDINGS / FIT tables are measured from today's prop models; if WP9 changes a model, re-measure (the heavy house test
  ray-marches the real meshes and will flag it; a building may declare `collider: [parts]`). See §10 for WP9's models.
- The FP eye at ground level is still inside the foundation's low pine skirts (underside 0.82 m × s, below the eye): WP9
  raises them (then the eye clears them standing; the canopy ceiling keeps jumps out), WP7's near fade hides the hull.
- TP: at a jump's apex the spring arm's pivot (feet + 1.2) can be inside a round tree's crown (camTop 1.9 is the trunk);
  the arm does not treat canopies as solid (WP1 pivot / WP7 near fade).
- Cliff slides: a ~0.15 m lip of the 1 m walkability field in front of an edge met within 25° of head-on can hold Pip
  for up to ~0.5 s (the 0.25 m normal is head-on there too); measured: 1 such run in 120 in the WP3+WP9 merge, 0 here.
- Bridge 2's west mouth (fixed in round 2 by WP9: the islet rock turns round the islet to a spot ≥ 1.5 m from every
  bridge). Round 3: `wp3` "bridge mouths" no longer exempts a stop in a wedge with an end post.
- `?noassets=all` makes the foundation smoke check "sprites back" fail (also on the foundation build, 8791).

## 10. Integration notes (WP9 / the lead)

- **Great Tree raw colliders.** The star fit replaces raw colliders of kind `'tree'` and any flagged `greatTree: true`.
  WP9's 57 `'gtroot'` circles (r 1.1, 2.4 m camera-solid) are kept, unflagged. Measured in the reviewer's merge
  (merge39): they reach up to 1.41 m beyond the star outline and stop the TP arm at the root tips. They also cover bark
  overhangs 1.1–1.5 m up that the body-band star (0.15–1.1 m) leaves open: at 0° the GLB has mesh at 1.1–2.5 m out to
  4.7–4.9 m while the star is 3.25 m. Dropping them (flag them `greatTree: true`) opens those pockets: Pip could walk
  under the overhangs and jump his eye into the bark, and WP9's "roots stop Pip before the bark" test fails (Pip reaches
  0.58 × rootR). Extending the star's band to the jumping eye (1.85 m) closes the overhangs but cut off NPC Shellby from
  reachability in WP9's plaza, so it was not done. Keep the ring until the star gets an eye ceiling for overhangs, or
  flag it if the lead prefers the open pockets.
- **Declared OBBs are exact.** WP9's altar `{ shape: 'obb', hx: 0.92, hz: 0.52 }` describes a round mesh (≈ 1.0 m in the
  body band): Pip walks 0.48 m into it from north / south and wp9's "the altar stops Pip" fails (0.892 < 1.30). Declare it
  as a circle (`{ r: 1.02, h, eye }`) or as parts matching the mesh.
- **Building tables vs WP9's models: done in integration round 2** (§3: BUILDINGS re-measured on WP9's house_a /
  house_b / shop, the counter, its crates and the awning posts as parts; the 0.27 m overlap was the awning post, not a
  crate). `wp3-heavy` houses: worst overlap 0.065 / 0.102 → ≤ 0.03, FP contact at the shop 0.046 → ≥ 0.12 m. WP9's
  laundry line hangs at Pip's ear tips (≈ 0.98 m over his feet where the yard slopes): a walk under it touches the cloth;
  the houses test leaves yard dressing out of its "ended against the building" runs.
- **Overhead parts.** A part with its own `y0` (BUILDINGS or a declared `parts` entry) is an overhead (`over`): passable
  by height, sticky while overlapped, a ceiling for jumps and the FP eye. No other collider is ever passable by its base
  height.
