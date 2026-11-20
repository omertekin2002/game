# Starseed Isle — architecture

The code contract of the game as it is now: how a frame runs, which object owns what, and the interfaces a change has
to respect. Each section links to a detail file in `docs/wp/` that holds the measurements, tuning history and edge cases
of that area; this file states what is true and where to look. When you change an interface, update its section here
and the detail file.

Starseed Isle is a first-person game with an over-the-shoulder third-person view. FP below means first person (the
camera at Pip's eye), TP third person (the camera on a spring arm behind Pip's shoulder).

- Plain ES modules, no build step, no runtime dependencies. Three.js r187 is vendored in `vendor/three/` and loaded
  through the import map in `index.html` (`three`, `three/addons/`). The `devDependencies` in `package.json` are only
  for the art tools in `tools/`.
- Two classic scripts load first: `assets/manifest.js` sets `window.ASSET_MANIFEST`; `js/audio.js` sets `G.audio`.
  Then the module `js/main.js` boots the game.
- `window.G` is the shared namespace (`js/core.js`): `G.game, G.player, G.view (= G.cam), G.camera, G.renderer, G.scene,
  G.world, G.scenery, G.sky, G.fx, G.ui, G.input, G.lock, G.clock, G.events, G.settings, G.assets, G.audio, G.debug,
  G.THREE`, plus the flags `G.debugAllowed` and `G.debugOn` (§17).

Detail files: [WP1](wp/WP1.md) camera feel and cinematics · [WP2](wp/WP2.md) hands, swords and Pip's body ·
[WP3](wp/WP3.md) movement and collision · [WP4](wp/WP4.md) combat, lock-on, interaction, spawning ·
[WP5](wp/WP5.md) enemies, bosses, NPCs, audio · [WP6](wp/WP6.md) HUD, menus, touch, settings card ·
[WP7](wp/WP7.md) rendering core and performance · [WP8](wp/WP8.md) sky, fog, terrain, water, shadows, ambience ·
[WP9](wp/WP9.md) world content. The numbering comes from the conversion's work packages (§20); module and test-suite
names use it too.

## 1. Conventions

| Topic | Rule |
|---|---|
| Units | metres, seconds, radians (degrees only in settings, `TUNE` and debug helpers that say so) |
| Yaw | `yaw = atan2(dx, dz)`: 0 looks +Z (south), π looks −Z (north). Turning left increases yaw. `util.wrapAngle` maps to [−π, π) (`wrapAngle(π) = −π`: compare angles with `angDiff`, never with `=== Math.PI`) |
| Vectors | `fwdXZ(yaw) = {x: sin, z: cos}`, `rightXZ(yaw) = {x: −cos, z: sin}`, `yawOf(dx, dz)`, `dir3(yaw, pitch, out)` (`js/util.js`) |
| Pitch | positive looks up. FP ±85°, TP −55° … +50° (`TUNE.view.pitchFP / pitchTPUp / pitchTPDown`); the limits follow the FP ↔ TP blend |
| Three camera | looks down −Z, so the camera quaternion is `Euler(pitch, yaw + π, roll, 'YXZ')` |
| Bearings | relative bearings (`EV.HURT.rel`, debug `relDeg`) are + = left of the look |
| Feet | `player.pos` is the feet in the simulation; `player.root.position` is the render-interpolated feet |
| Layers | `LAYER = { WORLD: 0, BODY: 1, PRESENT: 2, DEBUG: 3 }` (`PRESENT` is unused now); scatter's `LAYER_SHADOW = 4` (shadow-only casters); layer 30 only during the boot warm-up. Layers are not inherited: `setLayer(obj, layer, skip)` sets every descendant |
| FOV | settings store horizontal degrees at 16:9; the camera uses vertical degrees, Hor+ (`vFovFor(hDeg, aspect)`); a narrow screen keeps ≥ 70° horizontal up to a 100° vertical cap |
| Tunables | new numbers go into `js/tune.js` (`TUNE`, §16), never into `CFG` (`js/data.js` keeps the original game constants and content) |
| Storage | only through `store.get / set / del` (`core.js`, wrapped in try/catch). Keys: save `starseed-isle-save-v2`, settings `starseed-isle-settings-v1`, HUD memory `starseed-isle-hud-v1`, mute `starseed-isle-muted` |

Grep rules (must stay empty): `grep -rnE "\.yawTarget|cam\.bias|cam\.yaw" js` and
`grep -rnE "player\.facing\s*=|pl\.facing\s*=" js` (the body facing is written only inside `player.js`, or through
`player.turnTo`).

## 2. File map

| File | Contents | Detail |
|---|---|---|
| `js/main.js` | boot (renderer, assets, world, scene, warm-up, title), the frame loop `runFrame` | §3 |
| `js/clock.js`, `js/events.js` | fixed-step clock and hit-stop; event bus and `EV` names | §4, §5 |
| `js/modules.js` | the module registry (nine modules) | §6 |
| `js/core.js`, `js/util.js` | `G`, guarded audio calls, `store`, `spriteUrl`; maths, RNG, noise, easing, conventions, `LAYER` | §1 |
| `js/tune.js`, `js/settings.js` | `TUNE` groups; settings schema and persistence | §16, §12 |
| `js/game.js` | session, save, transitions, input routing, step and render orchestration, module host | §3, §6 |
| `js/save.js` | save schema: `SAVE_VERSION`, `freshState`, `migrate`, `normalize`, `loadSave` (pure; unit-tested in `tests/save.test.js`) | §12 |
| `js/completion.js` | completion tally `completion(W, S)` for the tracker on the pause menu and map card (`js/hud/tracker.js`); pure, unit-tested in `tests/completion.test.js` | §12 |
| `js/view/view.js` | `ViewController`: look, camera pose, FOV, near plane, layers, shots | §7, [WP1](wp/WP1.md) |
| `js/view/rig-fp.js`, `rig-tp.js`, `lockon.js`, `shots.js`, `shake.js`, `comfort.js`, `feel.js` | FP eye rig and feel layers, TP spring arm, lock-on camera, cinematics, trauma shake, comfort factors, module `wp1-feel` | §7, [WP1](wp/WP1.md) |
| `js/view/viewmodel.js`, `js/vm/*.js` | module `wp2-viewmodel`: FP hands and swords pass (`anim`, `rig`, `fx`, `boots`, `dither`) | §13, [WP2](wp/WP2.md) |
| `js/player.js`, `js/player-body.js`, `js/player-fx.js`, `js/fx-trail.js` | Pip's simulation and attack chain; body build and TP animation; module `wp3-player-fx` (dust, footprints, sprint toggle, stuck warp); TP slash trail | §8, [WP3](wp/WP3.md), [WP2](wp/WP2.md) |
| `js/phys.js`, `js/world-collide.js` | movement collision; colliders, ground, probes, eye keep-out (World mixin) | §9, [WP3](wp/WP3.md) |
| `js/world.js`, `js/world-const.js`, `js/props.js`, `js/models.js`, `js/world-mod.js` | world generation, prop and character models, module `wp9-world` (landmarks, signs, lamps, animation, culling of world-space meshes) | §9, [WP9](wp/WP9.md) |
| `js/combat.js`, `js/targeting.js`, `js/interact.js`, `js/spawn.js` | sword hit test, damage, kills, hurt, dizzy; module `wp4-targeting` (lock-on, aim friction, crosshair interaction); gameplay input, talk, shop, chests, pedestal, sim-time scheduler; spawner | §10, [WP4](wp/WP4.md) |
| `js/entities.js`, `js/bosses.js`, `js/fight.js`, `js/npcs.js`, `js/fx-ground.js`, `js/actors-mod.js`, `js/audio-bus.js`, `js/audio.js` | enemies and projectiles, bosses, boss fights, villagers, ground telegraphs, module `wp5-actors`, event-driven audio, the sound engine | §10, §14.4, [WP5](wp/WP5.md) |
| `js/cutscenes.js` | pedestal and ending cutscenes, world anchors | §7.5, [WP1](wp/WP1.md) |
| `js/input.js`, `js/input-lock.js`, `js/touch.js`, `js/keybinds.js` | input, pointer lock, touch controls; keyboard bindings (pure; unit-tested in `tests/keys.test.js`) | §11, [WP6](wp/WP6.md) |
| `js/ui.js`, `js/hud/*.js`, `styles.css`, `index.html` | HUD, menus, dialogue, title, module `wp6-hud` | §15, [WP6](wp/WP6.md) |
| `js/toon.js`, `js/scatter.js`, `js/fx.js`, `js/perf/perf.js`, `js/perf/lod.js`, `js/perf/grass.js` | materials, instanced scenery, particles, module `wp7-perf` (culling, LOD, cutaway, lights, warm-up, resolution), tree proxies, near grass | §14.2, [WP7](wp/WP7.md) |
| `js/perf/dynres.js` | the dynamic-resolution decisions: `dynDecide`, `dynPause`, `titlePace`, `clampDyn` (pure; unit-tested in `tests/dynres.test.js`) | §14.2 |
| `js/sky.js`, `js/terrain.js`, `js/atmo.js`, `js/ambient.js`, `js/assets.js`, `assets/manifest.js` | sky and fog, terrain and water, module `wp8-atmo`, ambient particles, asset loader, manifest | §14, [WP8](wp/WP8.md) |
| `js/debug/debug.js`, `js/debug/gpu-timer.js`, `js/debug/tests.js`, `js/debug/tests/wp1.js … wp9.js` | `G.debug`, GPU timer, test runner and suites | §17, §18 |
| `js/pwa.js`, `manifest.webmanifest`, `assets/ui/app-icon-*.png` | service-worker registration for the Pages build only (`swPlan`, `registerServiceWorker`; unit-tested in `tests/pwa.test.js`); the web manifest and its icons | §14.5 |
| `tools/build-pages.mjs`, `tools/sw-template.js`, `tools/make-app-icons.mjs` | the Pages build and its checks (`buildPages`, `checkPwa`), the service worker's code, the icon generator | §14.5 |

## 3. One frame (`main.js` `runFrame(rawDt, force = false, draw = true)`)

```
dt = clock.frame(rawDt, force)            snap near-vsync deltas, clamp 0.1 s, accumulate (not during a hit-stop or while
                                          clock.hold), set clock.steps / clock.alpha
input.update(dt)                          pad poll, press edges, arrow look; mouse / touch deltas were accumulated by events
ui.titleInput(input)                      title only
game.frame(dt, min(rawDt, 0.1))
  ├─ view.lookAllowed / view.assistPaused; view.applyLook(input, dt)   look first (0 frames of latency), aim frozen
  ├─ (not play: drain the wheel, fades, trackModal, return)
  ├─ fades; modal routing: dialogue → ui.updateDialogue | shop → ui.updateShop | menu → ui.menuInput (a press that
  │                        closes the menu is consumed: input.consumeAll)
  │                        | else gameplayInput (not in cutscenes, fades or while dizzy)
  ├─ V view toggle (also in dialogue) / X shoulder swap (TP) / wheel zoom (TP), not under the shop or a menu
  ├─ modules.frameInput(input, dt); debugKeys(input)
  └─ trackModal(): EV.MODAL + modules.onModal on change; input.cursorMenu; touch mode; pointer lock + veil;
                   lock lost while busy → pause once play resumes; clock.hold (menus, shop); crosshair visibility
clock.run()                               for each step: game.step(STEP)
  game.step: (not play, or a menu / the shop open → return) modules.beforeStep → time of day →
  player.update(dt, buildIntent(canAct), canAct) → presses cleared → dizzy → resolveSword (in the hit window, not in
  dialogue) → enemies / projectiles / pickups / fight (settled instead while talking) → NPCs → cutscene → spawning →
  regrowth → region → ambient → autosave → modules.afterStep
renderFrame(alpha, dt, draw)
  game.render(alpha, dt): actors render(alpha) → scenery, seeds → blob shadows → modules.beforeCamera →
    view.update(alpha, dt) [pose mods → FP rig → TP rig → blend → shake → shot → FOV, near, layers, occluder] →
    sky.update(h, feet, camera, lamps, dt, t, view.shadowFocus()) → uPip, frustum → modules.afterCamera (culling, LOD,
    lights, grass, fog and water, viewmodel pose, audio listener …) → game.target = findTarget() → ui.frame(game, dt) →
    debug overlay
  fx.update(dt)
  draw and play only: renderer.info.reset(); renderer.render(scene, camera) → game.afterRender(dt) →
    modules.afterRender (the viewmodel pass; GPU timer poll and dynamic resolution)
```

- `renderer.render` and `renderer.renderBufferDirect` are wrapped by `wp7-perf`: the main pass is GPU-timed, and below
  dynamic-resolution 1 it is drawn into the lower-left part of the canvas and stretched over it (§14.2). Any other code that
  wraps `renderer.render` must call through.
- Opaque draw order: the scatter tree bodies (`renderOrder` −1), everything else (0), then the terrain chunks
  (`renderOrder` 1, so the early depth test skips the splat shader wherever something covers the ground), the scatter
  outline hulls (2), then the sky dome (`renderOrder` 1e6). The sky sprites are the first transparent objects
  (`renderOrder` −9). An opaque object that must draw after the terrain needs `renderOrder` > 1.
- The title draws nothing: its canvas keeps the last boot frame. `game.state` is `'boot'` from the start of the warm-up
  until `showTitle()`, then `'title'`, then `'play'`.
- With the manual clock (`G.debug.manual(true)`, `?fixed=1`) the rAF loop only redraws the last frame; frames run only
  through `G.debug.step / advance` or `game.runFrame(dt, true, draw)`. `G.debug.clock({ redraw: false })` stops that
  redraw as well, so only frames run with a draw reach the GPU (in software WebGL each draw costs a fraction of a second).

## 4. Clock (`js/clock.js`, `G.clock === game.clock`)

`STEP = 1/60`. `stopSteps(sec)` converts the old float hit-stop to whole steps (0.05 → 4, 0.06 → 4, 0.07 → 5).

| Member | Meaning |
|---|---|
| `STEP, MAX_STEPS (6), MAX_DT (0.1)` | a 0.1 s frame still runs real time; below 10 fps only the `MAX_DT` clamp slows the simulation |
| `acc` | accumulator, starts at `STEP/2` (a locked 60 Hz display keeps alpha at 0.5) |
| `timeScale` | opt-in slow motion (hit-stop does not use it) |
| `hitStopT` | real seconds of freeze left (whole steps); look input stays live during a freeze |
| `manual`, `hold` | tests: frames only through `advance` / a forced `frame`; Game sets `hold` while a menu or the shop pauses the world |
| `steps, alpha, dt, simTime, frames, longFrames, frozenFrame` | this frame's values; `frozenFrame` = it began inside a hit-stop |
| `frame(rawDt, force = false) → dt`, `run(stepFn)` | §3; a hit-stop that starts mid-frame defers the remaining steps |
| `hitStop(sec)`, `hitStopFor(steps)` | freeze; simultaneous stops take the max, never the sum |
| `resetPhase()`, `advance(n) → { ran, frozen }`, `info()` | alpha back to 0.5 (session, teleport, respawn); debug ticks + one render; snapshot |

## 5. Events (`js/events.js`, `G.events === game.events`)

`Emitter`: `on(type, fn) → off()`, `once(type, fn)`, `off(type, fn)`, `emit(type, payload = {})` (synchronous; a
throwing listener is caught and logged), `log` (the last 64 `{ n, type, t: simTime, payload }`), `clearLog()`. Events
fire from fixed steps: render-side listeners should record what happened and do the work in their frame hook.

| `EV.` (name) | emitted by | payload |
|---|---|---|
| `SWING` (`swing`) | `player.startAttack` | `{ id, kind: 'A'\|'B'\|'C', level, side: 'R'\|'L'\|'C', aimYaw, aimPitch }` |
| `HIT` (`hit`) | combat, per target | `{ kind: 'enemy'\|'boss'\|'projectile'\|'cut', swing, swingId, x, y, z, dmg, target, killed, contactT }` + `knockX, knockZ, magnet` on enemy and boss hits |
| `CLINK` (`clink`) | combat (crab guard) | `{ x, y, z, target, kind, swingId, contactT }` |
| `KILL` (`kill`) | `killEnemy` | `{ type, x, y, z, swing, target }` |
| `HURT` (`hurt`) | `playerHurt` | `{ dmg, fromX, fromY, fromZ, knock, source: 'enemy'\|'boss'\|'ring'\|'projectile', hurtDir: {x, z}, rel }` |
| `DOWN` / `RESPAWN` | dizzy start / respawn | `{}` |
| `DASH_START` / `DASH_END` | player (any exit from the dash) | `{ dirX, dirZ }` / `{}` |
| `JUMP` / `LAND` | player at take-off / touchdown (not for a TP knockback hop) | `{}` / `{ impact (m/s), surface }` |
| `STEP` | player footstep, grounded only | `{ foot: 'L'\|'R', surface: 'grass'\|'dirt'\|'sand'\|'snow'\|'wood'\|'water'\|'stone', speed }` |
| `COLLECT` / `POTION` | pickups / potion | `{ kind, value }` / `{}` |
| `ITEM_GET` / `ITEM_DONE` | item-get start / its dialogue done | the same object `{ built, portrait, kind }` |
| `INTERACT` | `interact` | `{ kind, target }` |
| `TALK_START` / `TALK_END` | talk, session intro | `{ npc }` |
| `SHOP_OPEN` / `SHOP_CLOSE` / `CHEST_OPEN` | Miso / chests | `{}` / `{}` / `{ chest }` |
| `CUTSCENE_START` / `CUTSCENE_END` | cutscenes, boss intro | `{ type: 'place'\|'ending'\|'bossIntro' }` |
| `BOSS_INTRO` / `BOSS_FIGHT` / `BOSS_HIT` / `BOSS_DEFEATED` / `FIGHT_END` | fight, combat | `{ id, boss }` / `{ id }` / `{ id, hp }` / `{ id }` / `{ id, reset }` |
| `TELEGRAPH` | an enemy or boss wind-up | `{ kind, x, y, z, t (s until it can first hurt), source }` + `announce`, `offView`, `ring` (§10.4) |
| `SHOCKWAVE` | `addShockwave` | `{ x, y, z, ring }` |
| `LOCK` | lock-on change | `{ target, prev }` (Enemy, Boss or null) |
| `HINT` | any area asking the HUD for a hint | `{ id, text, life? }` |
| `REGION` / `SAVE` | region change / save | `{ id, first, session }` / `{ quiet }` |
| `VIEW_MODE` / `FOV` | view | `{ mode, prev }` / `{ v, h, px }` |
| `MODAL` | modal tracker | `{ modal: null\|'dlg'\|'shop'\|'pause'\|'settings'\|'controls'\|'map'\|'log'\|'ending', prev }` |
| `POINTER_LOCK` / `DEVICE` / `SETTINGS` | lock / input / settings | `{ locked, fallback? }` / `{ device }` / `{ key, value }` |
| `SESSION` / `TITLE` | session start / title shown | `{ isNew }` / `{}` |

`'unstick'` `{ x, z }` is a plain string event (no `EV` constant) from `wp3-player-fx` after a stuck-recovery warp.

## 6. Module host — adding a feature without editing `game.js`

A feature lives in a module: a plain object listed in `js/modules.js`. Every hook is optional:

```js
export default {
  name: 'my-feature',
  attach(game) {},              // end of the Game constructor (G.debug exists; register debug helpers here)
  onSession(isNew) {},          // end of startSession
  onTitle() {},                 // title shown (boot, Save & Quit)
  onModal(modal, prev) {},      // modal tracker change (also EV.MODAL)
  onResize(w, h) {},            // after view.onResize
  frameInput(input, dt) {},     // after modal routing, before the steps
  beforeStep(dt) {}, afterStep(dt) {},          // each fixed step while the world runs
  intent(it, canAct) {},        // each step, after Game built the player intent (§8): adjust it
  beforeCamera(alpha, dt) {}, afterCamera(alpha, dt) {},   // render side, around view.update (play only)
  afterRender(renderer, dt) {}, // after the main pass (play only)
};
```

The registry, in call order: `wp1-feel` (`view/feel.js`), `wp2-viewmodel` (`view/viewmodel.js`), `wp3-player-fx`
(`player-fx.js`), `wp4-targeting` (`targeting.js`), `wp5-actors` (`actors-mod.js`), `wp6-hud` (`hud/hud.js`), `wp7-perf`
(`perf/perf.js`), `wp8-atmo` (`atmo.js`), `wp9-world` (`world-mod.js`).

- `game._call(hook, a, b, c)` wraps every call in try/catch; errors are counted in `game.modErrs` (`'name.hook'`) and the
  first 5 per hook are logged while `G.debugOn`. A broken module never stops the loop. `game.addModule(m)` adds one at
  runtime.
- Debug helpers: `game.registerDebug('ns', obj)` → `G.debug.ns`. An existing namespace is never lost: an object merges
  into it (so `G.debug.cam()` stays callable and gains `cam.*`); a function takes the old members over.
- Sounds: `sfx('name', opts)` (§14.4); an unknown name is a silent no-op.

| Need | Extension point |
|---|---|
| change the player's step intent (sprint toggle, lock-on strafing, body facing) | the `intent(it, canAct)` hook; `it.bodyYaw` is reset to null every step, so a module holds it by setting it each step (§8) |
| scale or replace look deltas (aim friction, lock-on ease, TP auto-recentre, dialogue soft limits) | `view.addLookMod(fn)` (§7). Current order: lock flick switch, `wp1-feel` look, viewmodel sway observer, aim friction |
| camera offsets (bob, dips, kicks, FOV channels, roll) | `view.addPoseMod(fn)` (§7); `view.feel.kick / fovPunch / lockOn` |
| blob shadows | each actor's `blob(out)` (§10) |
| Pip fading as the TP camera closes in | `view.bodyFade` (§7); `player-body.js` applies it |
| FP eye kept out of geometry | `W.eyeKeepOut(eye, feet)` (§9) |
| a prop's collider | `W.addProp(type, x, z, { collider })` (§9) |
| culling of an object you add | `userData.cull = { dist, fade }` (§14.2) |
| item presentation in FP | the viewmodel (`game.heldItem`, `EV.ITEM_GET`, `vm.present`, §13) |
| per-frame HUD rules | `ui.frame(game, dt)` (§15) |
| tutorial text | emit `EV.HINT`; only the HUD draws hints |
| pedestal / ending staging | `startPlace` / `startEnding` in `cutscenes.js` |

Screen overlays from a module: create an absolutely positioned element with `pointer-events: none` inside `#ui`
(`G.ui.root`). `#ui` children have no z-index and stack in DOM order: `#hud` (holding `#speedfx`, `#tl` hearts,
counters and `#feed`, `#tc` compass, objective line, seed tray, boss bar and region banner, `#minimap`, `#keyhints`,
petals and world marks, then `#coach` over them), `#prompt`, floaters, `#bosscard`, `#vignette`, `#dizzy`, `#flash`, `#dialogue`,
`#shopwrap`, `#pause`, `#settings`, `#controls`, `#chatlog`, `#mapview`, `#ending`, `#fade`, `#title`, `#crosshair`,
`#wp1-eyelids`, `#veil`, `#loading`, `#debug`, `#touch`. Insert HUD-like elements with
`G.ui.root.insertBefore(el, G.ui.dlgEl)` (under dialogue, menus, fade and title); append only full-screen effects that
must cover everything.

## 7. View system (`js/view/*`, `G.view === G.cam === game.view`) — detail: [WP1](wp/WP1.md)

`ViewController` (`view.js`) owns the look yaw / pitch, the camera transform, FOV, near plane and `camera.layers`. Only
`js/view/*` writes yaw and pitch. The render pose is: FP eye ↔ TP boom (a position blend at identical orientation), then
the trauma shake, then the cinematic shot blend.

State (read-only outside `js/view/`): `mode` (`'fp'|'tp'`), `yaw`, `pitch`, `roll`, `blend` (0 FP … 1 TP), `shotW` (eased
shot weight), `eye` (interpolated FP eye), `armLen`, `fovV`, `fovH`, `px` (pixels per unit at depth 1), `near`,
`bodyOut` (camera out of Pip's head), `bodyFade` (how much of Pip to draw), `bodyVisible`, `lookAllowed`, `assistPaused`,
`lockTarget`, `speedFx` (0…1, dash / sprint intensity for the HUD's speed lines), sub-objects `fp` (RigFP), `tp`
(RigTP), `shots` (Shots), `shk` (Shake), `feel` (the `wp1-feel` module), and `lookMods`, `poseMods`.

| Method | |
|---|---|
| `applyLook(input, dt)` | before the steps. Mouse `0.0022 × sens` rad per count (no smoothing; `invertY`, `invertX`); touch `0.0050 / 0.0042 × touchSens` rad per px × (1 + smoothstep(400, 1600, finger px/s)); pad stick 200 / 140 °/s × `padSens` (yaw boosts to 320 °/s after 0.12 s at full deflection; `padInvertY`, `padInvertX`, which the arrow keys follow when they look: they feed the same stick). Drained while not allowed (scripted assists still run); then the look mods; then the aim is frozen for this frame's steps |
| `update(alpha, dt)` | render pose (above), FOV, near plane, layers, `bodyFade`, the TP occluder uniforms |
| `snap()` | reset smoothing (teleport, respawn, session); also cuts a shot that is only blending out |
| `forward()`, `right()`, `aim(out)`, `aimYaw / aimPitch / lookYaw / lookPitch` | the look basis and sword aim frozen for this frame. FP aim = the eye ray. TP aim = from Pip's eye toward the crosshair ray at `TUNE.combat.tpConverge` (3 m) past his shoulder plane, the ray at `tp.pivot.y + tp.lift − tp.drop` |
| `simEye(out)`, `selfAnchor(kind, out)`, `shadowFocus()` | sim feet + eye height; where self-centred effects spawn (`'chest'\|'head'\|'hand'`: in front of the eye in FP, on Pip otherwise); eye xz + view forward (the sun's shadow box centres on it) |
| `worldToScreen(v, out)` | CSS px; never NaN (`behind` when clip w ≤ 0.05). Reads the window size per call: the HUD uses its own projector instead (§15) |
| `setLook(yaw, pitch)`, `lookAtPoint(x, y, z, maxPitch)` | instant, clamped, cancels assists |
| `faceTo(x, y, z, { dur, pitch, lock, hold })`, `retarget(x, y, z)`, `setLookLimit(center, half)` | eased look assist (real look input cancels it unless `lock`); move its point; a soft yaw range |
| `lockOn(target \| null)` | stores `lockTarget` (chosen by `targeting.js`) and calls `view.feel.lockOn` |
| `shake(amount, src)`, `kick(pitchDeg, yawDeg, rollDeg)`, `fovPunch(dV, in, hold, out)` | trauma (+0.75·amount, falloff from `src {x, z}`); spring kick and FOV punch through `view.feel` |
| `addLookMod(fn) → off`, `addPoseMod(fn) → off` | `fn(L, view)`: `L = { dyaw, dpitch, mouse, touch, pad, dt, inDyaw, inDpitch }` (the last two: this frame's raw input, set by `wp1-feel`). `fn(M, view, alpha, dt)`: `M = { eye, pos, pitch, yaw, roll, fov }`, zeroed each frame; a non-finite `M` is dropped. A throwing modifier is counted in `game.modErrs`, never fatal |
| `setShot({ pos, look \| quat, fov, speed, cut, priority, snapIn }) → token`, `clearShot(token, { face, speed })` | cinematic shot (0 = refused: a higher priority is active); hand-back faces `face` first; stale tokens are ignored |
| `setMode(mode, { instant })`, `toggleMode()`, `swapShoulder()`, `zoom(wheelDy)`, `shoulderSide()` | V / X / wheel; toggle and swap persist the setting; `EV.VIEW_MODE` |
| `baseFov(aspect)`, `applyFov(force, v, near)`, `onResize(w, h)`, `info()` | the only writer of `camera.fov / near`; rescales particles and halos; `EV.FOV` |

Exported: `vFovFor(hDeg16x9, aspect)`, `hFovOf(vDeg, aspect)`, `MOUSE_K`.

**7.1 Mode switch.** V (pad RB, touch View) blends the camera position over `TUNE.view.modeBlend` (0.35 s) at identical
orientation; the FOV eases between the two settings; the near plane is 0.08 m in FP and 0.12 m in TP (switching at the
blend's middle). The view mode is a setting (`view`), not part of the save. `?view=fp|tp` overrides it for one page load.

**7.2 FP rig and feel** (`rig-fp.js`). `RigFP.update(feet, dt, frozen, grounded, off, W, simT)`: eye = interpolated feet +
`TUNE.view.eyeH` (0.88 m). While grounded the eye height follows a critically damped spring (ω `eyeW` 14) that smooths
the terrain's kinks; airborne it is exact and it is re-seeded at touchdown; x and z are never smoothed. Then `off` (the
pose mods' `M.eye`) and `W.eyeKeepOut`. `FeelFP` adds, in this order, head bob, strafe roll, landing spring
(`EV.LAND.impact`), dash dip / lean / nod, hurt kick (away from `EV.HURT.rel`), one punch per sword contact (`EV.HIT`;
A/B yaw 0.6°, C pitch −1.2°, bosses 0.9°, with small FOV punches), sprint FOV +4 and context FOV channels (dialogue −6,
item −8, boss intro −10, pedestal −6, boss fight +3, ending +8, vertical degrees). Roll is capped at 6°. None of them
change the look or the aim. Everything is scaled by `Comfort` (`comfort.js`, from the settings `headBob, shake, speedFx,
cameraRoll, reduceMotion, dialogueLookAt, lockTurnsCamera`); motion comfort removes bob, roll, FOV pulses and the dizzy
wobble, and scales shake × 0.25 and eye dips × 0.35. The trauma shake (`shake.js`) is rotation only in FP (max pitch /
yaw / roll 2.2° / 1.6° / 2.4°, decay 1.5/s, 20 Hz).

**7.3 TP rig** (`rig-tp.js`). From `TUNE.view`: pivot `tpPivot` 1.12 m above the feet (1.45 centred), shoulder offset
`tpShoulder` 0.80 m to the right (X swaps; the setting of the same name also offers centre), boom `tpBoom` 2.6 m (wheel
1.8–4.5), default pitch `tpPitch` −4°.
The orientation is exactly the look. Every frame, the spring arm: follows the feet with a ramp-exact pivot filter; pulls
the shoulder leg in on a spring when a slope or collider crowds it; slides the shoulder offset sideways (further out, or
over the other shoulder, never to the centre) when a collider nears the boom; treats low colliders the camera can ride
over as floor and the rest as walls (the arm stops at their face); lets thin trunks and posts cross the boom (the
occluder dither shows Pip through them); keeps the camera out of tree crowns and pine skirts; keeps it inside a boss
arena while the vine gate stands; comes in until it sees Pip; shrinks the shoulder offset with a short arm; drops the
camera point (≤ 0.55 m) on a short arm so Pip's feet stay on screen; and shortens the boom on narrow screens (≥ 1.8 m).
Pip dithers out below 0.9 m of arm and hides below 0.45 m (`RigTP.bodyFade`); his shadow stays. `view.bodyFade` takes the
real camera-to-head distance in every pose, so the V blend and shots fade him too. Probes go through `W.probeSegment`
(§9). Debug: `G.debug.armProbe`, `G.debug.cam.framing()`.

**7.4 Lock-on camera** (`lockon.js`, `LockCam`). The target comes from `targeting.js` (§10.2); the lock point is a
regular enemy's hurt-volume centre or a boss at 0.45 of its height. FP is a soft lock: the view eases toward the target
only after 0.15 s without any look input (≤ 240 °/s, 4° dead zone); any look input wins, and a look more than 40° off the
target is left alone (targeting then releases the lock). TP frames the target: the yaw puts it on the crosshair ray, the
pitch follows its elevation, the boom grows (+0.6 m for enemies, 4.2 m with a raised pivot for bosses, +2.0 m and a
higher pitch cap while a boss is airborne), and mouse or stick deltas no longer turn the camera (flicks switch targets).
Neither view frames or eases while the world is not playing (dialogue, menus, cutscenes). The setting "Lock-on turns the
camera" off disables all of it.

**7.5 Cinematics** (`shots.js`: `Shots`, `Cine`, `Lids`; `cutscenes.js`). TP shot FOVs are stored as horizontal degrees
at 16:9 and converted like gameplay FOVs; `Cine.fitShot` backs a shot off until its subjects fit, keeps it out of
terrain and colliders, and widens the FOV only when it must.

| Beat | FP | TP |
|---|---|---|
| new game / respawn | eyelids (`#wp1-eyelids`) open as the fade clears, the view eases down from the tree | same |
| dialogue | the view eases onto the speaker's face (above the dialogue box), FOV −6, soft look limits, the camera backs off to ≥ 1.8 m; the portrait hides (it stays for a speaker more than 3.5 m away: the opening) | a fitted two-shot (or over the shoulder) that sees the speaker's face, past Pip too; the portrait shows |
| item-get | the item is presented in Pip's paws (§13), FOV −8 | a front three-quarter shot of Pip holding it up |
| boss intro (2.4 s) | the view tracks the boss (look locked), FOV −10, the sword lowered out of the shot | a moving over-the-shoulder push-in, then the hand-back facing the boss |
| pedestal | the view locks onto the slab; the seeds arc into their sockets | a fitted shot from the altar toward Pip |
| ending | look up the trunk (FOV +8), the tree blooms, a crane up and around the tree, the card at 6.5 s | the look-up starts from a short shot beside Pip |
| dizzy | wobble, topple and sink, then the lids close with the respawn fade | the pivot drops, a slow orbit |

World anchors are read once per cutscene by `anchors(game)`: `W.pedestal`, `W.greatTree`, `W.shots.place`,
`W.shots.endingCrane`, with fallbacks.

**7.6 TP extras** (`feel.js`). Setting "Camera drifts behind Pip" (`tpAutoRecenter`): with a pad or touch, after 2.5 s
without look input while Pip runs, the yaw eases toward his travel at ≤ 40 °/s (a quarter of that running sideways);
never while locked, with an enemy within 10 m, in dialogue or shots, or backpedalling. Setting "Pip faces where you look"
(`tpBodyFacesCamera`): the body faces the look and movement strafes.

## 8. Player (`js/player.js`, `G.player === game.player`) — detail: [WP3](wp/WP3.md), body: [WP2](wp/WP2.md)

`player.update(dt, intent, canAct)`. The player never reads input or the camera: Game builds one intent per step
(`game.buildIntent(canAct)`) and modules may change it in their `intent` hook:
`{ mx, mz, ml (world wish, |m| ≤ 1), lookYaw, lookPitch, mode, attack, dash, jump (press edges), jumpHeld, sprint
(roll button held), sprintToggle (pad L3 latch), faceYaw, facePitch (TP sword aim or null), bodyYaw (null unless a
module holds it), bodyShown (camera out of the head) }`.

- Facing: FP = the look yaw every step. TP = turn toward movement (λ 12), or `bodyYaw` while a module holds it (lock-on,
  "Pip faces where you look"); attacks snap to `faceYaw` in TP. `player.turnTo(yaw)` is the only external write.
- Movement (`TUNE.move`): run 4.4 m/s; in FP strafe × 0.95 and backpedal × 0.80 of the look direction; wading × 0.62;
  vector acceleration 38 / 30 m/s². Sprint 5.8 m/s while the roll button is still held when the roll ends (pad L3
  toggles), only within ±50° of the look.
- Jump: v0 6.12 m/s, gravity 22 rising / 32 falling, early release halves vy once; apex 0.85 m, airtime ≈ 0.52 s; coyote
  0.10 s, buffer 0.12 s; air acceleration 14 m/s², air speed cap 6.2 m/s. Airborne movement keeps every wall and the
  walkability test: a jump reaches nothing a walk can't, except the tops of stumps and rocks ≤ 0.75 m and bridge decks
  (`TUNE.move.standOnProps`). Steps up and down ≤ 0.35 m per step; deeper is a fall; no fall damage.
- Dash-roll (`CFG`): 0.2 s at 13 m/s, cooldown 0.55 s, i-frames for its length. With no direction held in FP it is a
  backstep. A jump in its first 0.10 s keeps the speed.
- Attack chain (`TUNE.combat`): A forehand → B backhand → C overhead chop. A / B last 0.30 s, C 0.40 s; hit windows A/B
  36–186 ms, C 80–200 ms; a buffered press starts the next swing from attackT 0.255; the chain lapses 0.25 s after a
  swing ends; after C no new swing for 0.12 s. Pip moves at 55 % while swinging, with a short lunge. A jump cancels a
  swing from attackT 0.20. `EV.SWING` fires at each start.
- Hurt: 1 s of i-frames (`CFG.hurtIframes`) and a knockback away from the source; in TP also a small hop (no
  `EV.LAND` at its touchdown); in FP no hop.
- Stuck recovery: inside a body collider or off the walkable area for > 0.5 s → `player.stuck`; `wp3-player-fx` fades out,
  warps to the last safe spot and fades in.

States: `'normal'|'attack'|'dash'|'hurt'|'dizzy'|'frozen'|'item'`. Fields include `pos, prev, vel (Vector2), facing,
vy, grounded, alt (getter: feet above the ground), sprint, sprintMode, wading, surface, combo, attackT, swingId, chainT,
swingYaw, swingPitch, walkPhase, iframes, hurtDir, reach, swordLevel, r`; getters `attacking`, `attackActive`,
`invulnerable`. Methods: `place(x, z, facing)`, `warp(x, z)`, `resync()` (after any external move of `pos`), `turnTo`,
`setSword(level)`, `startAttack`, `endSwing()`, `startDash`, `hurt(dmg, fx, fz, knock) → bool`, `canJump()`,
`unstick()`, `blob(out)`, `render(alpha, dt, time)`.

Pip's body (`player-body.js`) is always animated (in FP you see its shadow): waddle, strafe, backpedal, air and landing
poses, swings synced to the sword's sweep, a cream rim shimmer during i-frames (`player.blinkOff` is always false), a
Bayer dither by `view.bodyFade` on his own materials and ink hull, the TP rim × 1.6. His meshes and the TP slash trail are
on `LAYER.BODY`: the FP camera skips them, the sun's shadow camera draws them. `player.stride` (an interpolated stride
phase owned by the viewmodel module) drives the legs, the hands' bob and the FP boots.

## 9. World: generation, anchors, colliders (`js/world.js`, `js/world-collide.js`, `js/phys.js`) — detail: [WP9](wp/WP9.md), [WP3](wp/WP3.md)

**9.1 Generation.** `generateWorld(seed)` is deterministic per seed (default `CFG.seed` 7151; `?seed=N`; a save keeps its
seed). The grid is 360 × 360 m (`world-const.js`). Order: layout, terrain, flatten, paths, water, regions, path field,
village, arenas, special spots (heart-chest nooks), landmarks, woods clearings and trails, arena edge rings, scatter,
skyline landmarks, coin chests, path dressing, reachability, splat, collider hash, anchors. Reachability is a BFS on 1 m
cells from the spawn (`W.reach`); anything important it cannot reach gets a corridor carved (`W.carved`), and
`W.unreachable` must stay empty (asserted under `?debug=1`). Placement avoids carving (the peaks heart-chest nook is
placed only where `W.nookOk(p, side)` keeps the path open; coin chests go only into pockets Pip can already reach), and
no tested seed carves today. Landmarks, woods clearings, coin chests and path dressing draw from their own random
streams, so the main stream (and with it the scatter) of a seed stays stable.

**9.2 Anchors other code reads** (never hard-code these positions):

| Field | Meaning |
|---|---|
| `W.spawn`, `W.plaza { x, z, r (16), h }`, `W.plazaMask` | spawn (0, 13) facing the Great Tree; the paved plaza |
| `W.greatTree { x, z, y, height, scaleHeight }` | 19.8 m (`TUNE.world.treeH`) |
| `W.pedestal { x, z, y, top, tilt, r, sockets }` | the altar at (0, 7.3); socket surface 1.05 m up |
| `W.landmarks [{ id, name, region, x, z, y, height, rot, prop? }]` | `great_tree`, `woods` (giant mushroom, 21 m), `peaks` (crystal cairn, 15 m), `shores` (lighthouse, 18 m), `meadow` (windmill, 15 m) |
| `W.shots.{ place, ending, endingCrane, spawn, bossIntro.{woods, peaks, shores} }` | camera hints `{ pos, look }` |
| `W.arenas[id] { x, z, r, h, entAng, entrance, outside, ring }` | the three boss arenas (r 14 m) and their edge rings |
| `W.paths`, `W.pathF / pathFAt`, `W.woodsGaps`, `W.signpost`, `W.waymarkers`, `W.lamps`, `W.chests`, `W.houses`, `W.shop`, `W.npcSpots`, `W.interact` | paths and dressing, interactables |
| `W.shells [{ id: 'shell1'…'shell5', kind: 'shell', x, y, z, at }]` | Clover's rainbow shells (`at`: `lighthouse`, `islet1`, `islet2`, `cove`, `path`). `placeShells()` runs after everything else in `generate()` on its own RNG (`seed × 41 + 29`), adds nothing to any other list and restores `W.walk` / `W.reach`, so no existing placement moves on any seed (`tests/world.test.js` compares with `tests/fixtures/world-prints.json`). Each spot is dry Shores sand (an islet counts as Shores), flat, ≥ 3 m off the path, clear of solids, colliders, reservations (bar the islets' own), bridges, chests and NPC spots, outside the arena ring and reachable. A spot is tried 160 times at random in its ring, then the whole ring is scanned every 0.5 m, so the shell is where Clover says (seeds 1–300 checked; `tests/world.test.js` checks 1–40); only then does it widen. `generateWorld(seed, { shells: false })` skips the pass. Not in `W.interact`: `interactables()` (`js/targeting.js`) offers the ones that are out |

**9.3 Colliders.** `W.colliders`, hashed in 4 m cells: `{ x, z, r (bounding), kind, shape: 'circle'|'obb'|'star', hx, hz,
rot, y0, y1, camTop, rEye, stand, over, canopy, body, … }`. Heights are baked from `COLLIDER_H` (per kind) unless a prop
declares its own. A prop declares its shape where it is made:
`W.addProp(type, x, z, { s, collider: { r | hx, hz | parts: [...], h, cam, eye | eyeS | eyeAdd, sink, stand, shape } })`
at scale 1 (× `s`). Declared boxes are exact, so a declaration must describe the mesh's real footprint. `camTop` is what
the TP arm treats as solid (tree trunks end where the canopy starts); `rEye` is the FP eye's keep-out radius for
circles; `over` marks overhead parts (eaves, awnings), the only colliders ever passable by height; `canopy` carries a tree
crown's measured underside. House A is a circle plus porch and step parts, house B and the shop are boxes plus parts
(counter, crates, awning posts), and eaves and the awning are overhead parts; chests are boxes; fences are one box per
straight run; bridges have rail boxes and end posts; the Great Tree is one `'star'` outline measured from its model
(`fitTreeColliders`) plus a ring of `gtroot` circles. Other declared kinds: `pedestal` (a circle, r 1.02), `counter`,
`dressing`, `arenaring` (edge-ring stones, solid outside the entrance), `lm_*` (landmarks). NPCs, sleeping bosses, the
fight boss and nearby enemies are dynamic circles (`game.dynamicColliders`, `game.enemyColliders`), not in the hash.

| Method | |
|---|---|
| `nearColliders(x, z, r, out)` | active colliders around (x, z), each once |
| `probeSegment(ax, ay, az, bx, by, bz, radius = 0.22, opts)` or `(a, b, radius, opts)` → t ∈ [0, 1] | first contact of a sphere moved a → b (1 = clear) against terrain, water, bridge decks (from above) and collider volumes up to `camTop` (or the body top with `top: 'body'`); a collider the segment starts inside is ignored. `opts` also receives `t, kind, collider` |
| `groundFor(x, z, feetY, props, out)`, `ground`, `hAt`, `slopeAt`, `walkable`, `walkF`, `walkNormal`, `bridgeAt`, `deckAt`, `standTop`, `standY` | ground height (decks and standable tops only from above), walkability and its margin |
| `colliderDist(c, x, z)`, `colliderContains(c, x, y, z, top)` | exact for every shape |
| `eyeKeepOut(eye, feet)`, `eyeCeiling(x, z)` | moves the FP eye ≥ 0.12 m outside nearby colliders and under ceilings (eaves, canopies), continuously |
| `surfaceAt`, `dustColor`, `splatK`, `regionAt`, `inArena` | footstep surface, dust colour, region |
| `fitTreeColliders`, `refreshReach`, `buildWalk`, `buildColliderHash`, `bakeCollider`, `rehash`, `addDynamicCollider` | build-time |

**9.4 Movement collision** (`phys.js`). `moveCircle(W, e, dx, dz, o)` pushes every shape out along its surface normal
(walls slide at any angle); with `o.slide` (Pip) it also slides along the edge of the walkable area (cliffs, deep water)
and uses `walkOK(W, x, z)` as the ground test (`W.walkable` without hairline slivers under 0.2 m). Walkers that pass
their feet (`feetY`, `grounded`, `on`) get standable tops, overhead parts and one-way deck walls. `headroom(…)` is the
jump ceiling, `penetration(…)` the overlap, `HEAD` (1.0 m) a walker's height. Enemies and NPCs keep `W.walkable`.

## 10. Actors and combat — detail: [WP4](wp/WP4.md), [WP5](wp/WP5.md)

**10.1 Sword hit test** (`combat.js`). `game.resolveSword(dt)` runs each step inside the hit window. `swordTest(hb, s)` is
a pure test from the eye (`game.swingState(dt)` from `view.aim()` and the feet), so it works in the air too:

| Rule | Value (`TUNE.combat`) |
|---|---|
| Horizontal, A/B | the target's edges meet the bearing swept this step: ±55° in 36–136 ms (A right → left, B left → right) |
| Horizontal, C | target edges within ±35° |
| Vertical, A/B | the target's elevation interval meets [pitch − 50°, pitch + 16°] |
| Vertical, C | the chop sweeps from pitch + 45° to pitch − 50° in 80–160 ms |
| Reach | `CFG.reachWood` 1.6 m, `reachShiny` 2.0 m, to the target's surface (+0.3 m slack in 3D) |
| Vertical reach | never a target wholly above eye + 1.4 m; a flyer never wholly below feet − 0.45 m; a walking critter never across a wall-sized terrain step, nor far above or below Pip's ground at the swing start (a lunge or a jump never adds reach to a ledge) |
| Line of sight | any clear ray from the eye to the target's contact point, edges or upper part (terrain, colliders, trees by their trunk) |
| Bubble | within 0.45 + 0.5·r of the eye axis at body height: hit in any direction (and only this after the sweep) |
| Magnetism | `aimAssist` off 0° / low 10° / high 20° (touch 25°); auto = mouse low, pad high, touch 25°. Widens the test toward one enemy per swing; a locked target gets ≥ 15°. Never moves the camera. One table for both views |
| Damage | wooden sword A/B 1, shiny 2; C +1 (`dmgC`), knockback 9 m/s (A/B 6.5) and it breaks the crab's guard |
| Hit-stop (whole steps) | enemy 3, boss 4, kill 4, clink 2, hurt 4; simultaneous hits take the max |

`swordTest` writes `s.contactT` (when the blade met the target); the viewmodel freezes at that pose during the hit-stop.
FP contact feedback is the one punch from `wp1-feel` on `EV.HIT`; combat adds kill / clink trauma (0.15) and, in TP, a
0.15 shake. Exports: `swordTest, vReach, walksOnGround, trunkR, sweepAt, sweepT, chopAt, chopT, hudFields`.
`hudFields(e)` keeps `hp ≥ 0`, `maxHp` and `name` filled on every enemy and boss for the HUD.

**10.2 Lock-on and assists** (`targeting.js`, module `wp4-targeting`). Q / middle click / pad R3 toggle; right button /
pad LT hold (`lockMode: 'hold'` makes Q and R3 hold too). It acquires emerged, living enemies within 18 m inside ±45° of
the crosshair ray (TP: measured from the camera) with line of sight, scored by angle + 1.5 per metre; TP falls back to
the nearest within 6 m. In a boss fight one press always locks the boss; `autoLockBosses` (auto = pad and touch players)
locks it at `EV.BOSS_FIGHT`. A lock breaks beyond 22 m (never the fight boss), after 1 s without line of sight, in FP
after the look stays > 40° off it for 0.35 s, on release, on `EV.DOWN / RESPAWN / FIGHT_END`, at session start and on
the title. A dead target hands over to the best candidate within 8 m and ±60°. Pressing again switches to a candidate
≥ 10° nearer the crosshair, else unlocks; in a framed TP lock a mouse or horizontal stick flick switches sides
(`game.switchLock(dir)`). In TP the `intent` hook faces Pip and every swing at the target; with framing on, W walks at it
and stops at contact, A / D circle it at ≤ 150 °/s. Methods: `lockPoint, lockEye, lockFramed, lockCandidates, setLock, releaseLock, switchLock,
updateLock, lockIntent, autoLockBoss`. Aim friction: pad and touch look × 0.6 while the crosshair is within 5° of an
enemy within 12 m (off with `aimAssist: 'off'`). Touch auto-face (FP, touch, assist auto / high): a swing turns the view
toward the best enemy within ±30° and 4 m.

**10.3 Interaction** (`targeting.js`, `interact.js`). `game.findTarget()` → `game.target = { o, kind, px, py, pz, R, range,
x, y, z, h, ang, dist, verb, name, label, key: '{interact}' }`: the crosshair ray (cone tolerance `clamp(atan(R/d) + 6°,
8°, 25°)`, × 1.6 on touch), line of sight past colliders lower than Pip's eye, a 150 ms grace while the look stays within
35°, and in TP a proximity fallback (1.4 m, ±70° of the body). E / F / Enter, pad Y, touch Use or a tap interact; attack
never interacts. `interact.js` keeps every name stable (`gameplayInput, faceSubject, drinkPotion, collect, itemGet,
sessionIntro, clearHeldItem, interact, talkTo, buy, openChest, usePedestal`) and owns a sim-time scheduler
`game.later(sec, fn, cancel) / tickLater / clearLater` (it holds under menus). A chest's reward and `S.chests[id]` come at
the end of its 0.42 s lid beat.

**10.4 Enemies** (`entities.js`). `Enemy` has `hurtbox(out)`, `blob(out)`, `emerge(kind)` (`'ground'|'sky'|'water'|'bush'`,
0.7 s, harmless and only hittable in its second half), `hit(dmg, fx, fz, knock, breakGuard, swing)`, `render(alpha, t)`,
`remove()`, and `hp, maxHp, name, token, attacking, noticed, emerging`. An enemy starts an attack only within its reach
(`TUNE.actors.reach`), holding one of at most 2 attack tokens; every wind-up emits `EV.TELEGRAPH` (`t` = seconds until it
can hurt) with a coral halo, body pulse, glint and pose; one off the screen first announces for 0.7 s (`announce: true`,
then a 0.25 s longer wind-up). Only attacks hurt (the slime's hop, bat swoop, bee dive, crab charge, projectiles); other
contact bumps it away (`TUNE.actors.passiveContact` false). Projectiles cast blob shadows, can all be popped by the sword,
and an aimed snowball shows a landing reticle. Helpers: `telegraph(source, kind, x, y, z, t, extra)`, `offView(x, z, y)`,
`hint(id, text)`.

**10.5 Bosses and fights** (`bosses.js`, `fight.js`, `fx-ground.js`). `Boss` has `name, maxHp, hp, opening` (a free-hit
window: stunned or recovering), `enraged` (hp ≤ half), `busy`, `room` (personal space, 2.55–2.75 m), `keepOut`,
`colliderR`, `touchR`, `shrug(wind)`, `snapLen / slideLen`, `forceAtk` (debug). Telegraphs are exact ground shapes from
`G.fx.ground`: `shockwave` rings (advanced in the fixed step with `stepRings`; a jump with `player.alt > 0.30` clears
them), `band`, `stripe` (charge, snap, slide paths), `zone` (Frostbun's landing disc, rim wall and pillar), `crack`,
`alert`, `aura`, `glint`. Every telegraph mesh carries `userData.cull = { dist: Infinity }`. Fight flow: entering the
arena (within r − 2.5) starts a 2.4 s intro (`EV.BOSS_INTRO`, `CUTSCENE_START`, vine gate rises, Pip walks in, look
locked), then `EV.BOSS_FIGHT`; defeat → `EV.BOSS_DEFEATED`, the Starseed drops, `EV.FIGHT_END` after 3.2 s; a respawn
resets an unbeaten boss (`endFight(true)`).

**10.6 NPCs and encounters.** `NPC` (`npcs.js`): head (or body) turns to Pip within 4 m, waves within 2.6 m, faces him
while talking, hops back when a talk starts closer than 1.1 m (never Miso, who stays at her counter). Spawning
(`spawn.js`, `trySpawnEnemy(game) → Enemy | null`): never in the village; never inside the view cone (hFOV/2 + 15°, from
the camera in TP) closer than 24 m; weighted 2:1 toward the direction of travel; region tables from `REGIONS` (+ bats at
night in the woods and meadow), at most `CFG.maxEnemies` 8 and the region's `max`; despawn only out of view beyond 44 m
or anywhere beyond 70 m; cut grass, bushes and pots regrow out of view beyond 20 m (anywhere beyond 90 m).
`inViewCone(game, x, z, addDeg)`.

## 11. Input (`js/input.js`, `js/touch.js`, `js/input-lock.js`) — detail: [WP6](wp/WP6.md)

Actions: `up down left right attack jump dash sprint interact potion view shoulder lockOn lockHold sprintToggle map pause
click tap navUp navDown any`. `BINDINGS = { kbm, pad, touch }` (labels); the HUD's glyph tables are in `js/hud/keys.js`.

**Keyboard bindings** (`js/keybinds.js`, setting `keys`). The player picks the primary key of each action in
`KEY_ACTIONS` (Settings → Controls → Keys): `up down left right attack jump dash interact potion view shoulder lockOn
map`, defaults W S A D J Space Shift(left) E R V X Q M. The held `sprint` follows the roll key. **Fixed** (`FIXED`,
never rebindable): the arrows move (or look, with `arrowLook`), Enter / NumpadEnter interact, Esc / P pause, so the
menu is always reachable. **Reserved** (refused as a binding): the fixed keys plus Tab and the debug `` ` ``. **Extra
keys** (`SECONDARY`: K and Right Shift roll, F use, Tab map) work only while their action keeps its default key: rebinding
the action drops them, and a key bound to any action wins over another action's extra key. Mouse buttons and the wheel
are not rebindable. `buildKeymap(keys)` gives `input.js` its code → action map and the sprint keys; `input.js`,
`hud/keys.js` (`GLYPHS.kbm`, `ALL.kbm`) and `BINDINGS.kbm` rebuild on every change of the setting (no reload), and
`wp6-hud` drops the text it formatted once per device (prompt, coach, key chips, dialogue line). `keyLabel(code)` names
a key from its `KeyboardEvent.code` (`KeyT` → `T`, `Digit1` → `1`, `ShiftLeft` → `Shift`, `Semicolon` → `;`).
While the Settings card waits for a key, `input.keyCapture = fn(code)` takes the next key press instead of the game.

| Device | Bindings |
|---|---|
| Keyboard + mouse (default keys) | WASD / arrows move (with `arrowLook` the arrows look instead), mouse look, LMB / J attack, Space jump, Shift / K roll (held: sprint), E / F / Enter / NumpadEnter interact, R potion, V view, X shoulder, Q / MMB lock toggle, RMB lock hold, wheel zoom, M / Tab map, Esc / P pause |
| Pad (standard mapping) | L stick move, R stick look, A jump, B roll (held: sprint), X / RT attack, Y interact, LB / D-pad ↓ potion, RB / D-pad ↑ view, R3 lock toggle, LT lock hold, L3 sprint toggle, D-pad ← / → shoulder, Back map, Start pause |
| Touch | floating move stick (left zone; right with `touchLeftHanded`), drag elsewhere to look, Swing, Roll (held: sprint), Hop, Use (only with a target, labelled with its verb), Pause, Map, View, Potion, Lock (only near enemies or in fights); a quick tap is `click` + `tap` |

| `Input` | |
|---|---|
| `update(dt)` | per frame: held set, pad poll (look dead zone 0.15–0.92 with the `padCurve` exponent, move 0.18–0.95), edges, arrow look, last device (`EV.DEVICE` after 300 ms) |
| `pressed(a)`, `held(a)`, `keyPressed(code)`, `consume(a)`, `consumeAll()`, `confirm()`, `cancel()`, `menuNav()`, `axis() → { x, y, l }` | `confirm` = attack / interact / click / jump; `cancel` = pause / dash |
| `keyCapture` | `fn(code)` or null: the next key press goes to it (once) and is no input; set by the Settings card's Keys rows |
| `addMouse(dx, dy, k)`, `takeMouse()`, `takeTouch()`, `takeWheel()`, `lookStick`, `keyLook`, `arrowStick(kx, ky, dt)` | look accumulators; single mouse events > 300 counts are dropped. Arrow look feeds `view.applyLook`'s pad path as a stick deflection (yaw 60 → 140 °/s over 0.25 s, pitch 90 °/s), so it counts as look input everywhere |
| `lastDevice` (`firstDevice()`: `'touch'` on a coarse-only pointer, else `'keyboard'`), `cursorMenu` | set by Game; closing a cursor menu keeps canvas presses inert for 300 ms |
| `setTouchMode(mode)`, `setTouchVisible(on)`, `showTouch()`, `layoutTouch()` | Game sends `'hidden'` (title), `'modal'` (menu or shop), `'dialogue'` or `'play'` every frame; a `'play'` during a cutscene, fade, boss intro or with the HUD off becomes `'cinema'`. Only `'play'` shows the controls |
| `debugPress / debugHold / debugRelease / debugAxis / debugStick` | tests |

`PointerLock` (`G.lock`): `supported, locked, wanted, veil, fallback, request(gesture), release(), onCanvasDown(),
onUserGesture(e), update(wanted, mouseUser), hasActivation(), giveUp(why), info()`. The lock is kept for play,
dialogue, cutscenes and fades and released for pause, settings, shop, map, controls, chat log, ending and title. Losing it
in free play opens pause; while busy (dialogue, cutscene, fade, dizzy, boss intro) the "Click to play" veil shows and
pause opens once play resumes without it. Without the API, with `?nolock=1`, or after repeated refusals, the mouse looks
by dragging (right button, or a left-button drag over 6 px). Gameplay ignores attack / dash / jump for 120 ms after a
modal closes.

## 12. Settings (`js/settings.js`, `G.settings === game.settings`) — UI: [WP6](wp/WP6.md)

`settings.get(k)`, `set(k, v) → effective value` (coerced to the schema, persisted debounced 250 ms, only non-default
values stored, emits `EV.SETTINGS`), `on(k | '*', fn(value, key)) → off`, `reset(k?)`, `all()`, `flush()`; `SCHEMA`,
`SETTINGS_KEY`. Unknown stored keys are kept. One key is object-valued: `keys` (schema rule `obj`: a sanitizer). A
stored `keys` that is no plain object is ignored; otherwise unknown actions, non-strings, odd or reserved codes and
codes equal to the default are dropped, and actions that would share a key fall back to their defaults (`sanitizeKeys`);
an empty result is not stored. Device defaults: a coarse pointer in portrait → `view: 'tp'`;
`prefers-reduced-motion` → `reduceMotion: true`. The Settings card is generated from `SCHEMA` with labels and groups
from `META` (`js/hud/menus.js`); a key without `META` still gets a row.

| Key | Default (range / values) | Read by |
|---|---|---|
| `view` | `fp` (`fp`, `tp`) | view |
| `fovFP`, `fovTP` | 100 (80–115), 90 (75–100), horizontal at 16:9 | view |
| `sens`, `invertY`, `invertX`, `rawInput` | 1 (0.25–4), false, false, false | view; pointer lock (`unadjustedMovement`) |
| `padSens`, `padInvertY`, `padInvertX`, `padCurve` | 1 (0.5–2), false, false, `default` (`linear`, `default`, `precise`) | view; input |
| `touchSens`, `touchLeftHanded` | 1 (0.5–2), false | view; touch, HUD, viewmodel |
| `arrowLook` | false | input |
| `keys` | `{}`: an object `{ action: KeyboardEvent.code }` with only the rebound actions (`js/keybinds.js`) | input, HUD key glyphs |
| `headBob`, `shake`, `speedFx` | 1 (0–1 each) | view feel, viewmodel, HUD speed lines |
| `cameraRoll`, `reduceMotion` | true, false | view feel, viewmodel, HUD (`#ui.calm`; flashes capped at `TUNE.hud.flashCap`) |
| `dialogueLookAt` | true | view feel (dialogue look assist) |
| `crosshair`, `crosshairSize`, `crosshairColor` | `dot` (`dot`, `ring`, `off`), `m` (`s`, `m`, `l`), `cream` (`cream`, `yellow`) | HUD |
| `aimAssist` | `auto` (`auto`, `off`, `low`, `high`) | combat (magnetism), targeting (friction, touch auto-face) |
| `lockMode`, `lockTurnsCamera`, `autoLockBosses` | `toggle` (`toggle`, `hold`), true, `auto` (`auto`, `on`, `off`) | targeting; lock-on camera |
| `tpShoulder`, `tpBodyFacesCamera`, `tpAutoRecenter` | `right` (`right`, `left`, `center`), false, true | view; view feel |
| `musicVol`, `sfxVol`, `ambVol` | 1 (0–1 each) | audio bus |
| `textSpeed` | 52 (30, 52, 90 characters per second) | dialogue |
| `hudScale`, `minimap` | 1 (0.8–1.2), `heading` (`heading`, `north`, `off`) | HUD |
| `quality`, `dynRes` | `auto` (`auto`, `low`, `high`), true | perf (DPR, grass, shadow map, dynamic resolution), assets (HD / lo, anisotropy), atmosphere (terrain layers) |

Save (`game.S`, key `starseed-isle-save-v2`, `v: 3`): seed, position, facing, hp, maxHp, coins, potions, swordLevel,
seeds (0 none, 1 carried, 2 placed), chests, bosses, shopHeart, ending, time of day, visited regions, playTime, intro and
controls flags, `errands` (errand id → 1 started, 2 done; `ERRANDS` and the `errands` helpers in `js/data.js`), `shells`
(rainbow shell id → true), plus the optional `pitch` (restored clamped ±0.6 rad), `controlsV` (< 2 → the first-run coach marks once)
and `waypoint { x, z }` (the map marker). Non-numeric optional fields fall back to defaults. Autosave every 30 s outside
fights and at key events. `wp9-world.onSession` moves a Continue whose saved spot is now inside a collider to the
nearest free spot.

Every read of the save goes through `loadSave(raw, seed)` in `js/save.js`: `Game.hasSave`, `Game.continueGame` and the
seed lookup at boot in `main.js`. It migrates older versions (`MIGRATIONS`), rejects unusable saves (treated as no save)
and fills, clamps or coerces the known fields; unknown fields such as `pitch`, `controlsV` and `waypoint` pass through.
`js/save.js` imports only `js/data.js`, so `bun test` can load it. To change the layout, bump `SAVE_VERSION` and add a
`MIGRATIONS[old]` step with a test (`docs/DESIGN.md` §15). `MIGRATIONS[2]` (v2 → v3) adds `errands: {}` and
`shells: {}` and keeps every v2 field.

Errands (`js/interact.js`): Clover's lines (`NPCS`) read the errand state before a talk; when the talk ends,
`errandTalk` calls `errands.talk(S, e)`, which starts the errand (`syncShells` shows the shells) or, with every shell
found, finishes it and adds the reward to `S.coins` once (the feed gets an `EV.COLLECT` gem line); either way the game
saves. A shell is an interactable of kind `shell` (`Pick up · Rainbow shell`, aim point `TUNE.combat.aimPts.shell`, range
`shellRange`); `pickShell` marks it (`errands.pick`), hides it (`scenery.setShellShown`) and saves. The scenery draws each
shell as a small group (`rainbowShellModel()` in `js/props.js`, procedural) that turns and bobs; `tickShells` twinkles
the ones within 40 m. The tracker's `errands` row counts errands done (`errands.done(S)`) over `ERRANDS.length`.

## 13. Viewmodel (`js/view/viewmodel.js`, module `wp2-viewmodel`) — detail: [WP2](wp/WP2.md)

Pip's hands and swords in FP are drawn in their own pass after the world: an own `scene` and `camera` (vertical FOV
`TUNE.vm.fov` 54°, widened on narrow screens by `vmFovFor(aspect)`, near 0.01, far 5) at the eye with the main camera's
orientation, drawn in `afterRender` after `clearDepth()` with `autoClear` and shadow updates off. It always uses the full
canvas size (dynamic resolution only scales the main pass).

- Rig (`js/vm/rig.js`): each arm is one skinned mesh and one ink hull (2 draw calls) with a fist, an open paw and a potion
  paw; procedural steel and shiny swords, each blade one closed surface from base to point (`toon.bladeGeometry`,
  colours from `models.swordCol`, shared with the world sword).
- Rest pose: solved per aspect from NDC targets (`TUNE.vm.restHand`, `restTip`, portrait variants blended in over aspect
  1.2 → 0.9); no blade pixel in the screen's centre box at any tested aspect. With touch controls up the rest moves until
  the paw clears every thumb button.
- Swings follow the simulation: the blade passes the sweep bearing (A/B) or chop pitch (C) of `combat.sweepAt / chopAt`
  at render time (`attackT` interpolated by alpha), so it crosses the crosshair in the frame the hit test does. On
  `EV.HIT` / `EV.CLINK` it shows the contact pose (`contactT`) through the hit-stop, then kicks back. After the sweep the
  A/B grip never sinks below `recFloor`, and every recovery ends exactly on the rest pose. A ribbon trail (`VmTrail`)
  follows the outer blade.
- Keyed poses, by priority: dizzy > item > seed placing > chest > dialogue (blade lowered under the dialogue box) > boss
  intro > dash / sprint > rest; potion drinking on `EV.POTION`; a bought item is held up after the shop closes. Hidden in
  TP, during shots, menus and the shop.
- Motion layers (× `headBob`, off under motion comfort): look sway, stride bob, strafe roll, breathing, jump lag, landing
  and hurt springs (sub-stepped, frame-rate independent).
- Lighting: hemisphere and sun copied from the sky (shaded under canopies), at night the nearest lamp and Pip's glow
  (`sky.pipLight`, 1.6 m over his feet) moved out to `TUNE.vm.glowDist`; the hands at 21:00 stay ≥ 30 % darker than at
  noon (smoke suite).
- FP boots (`js/vm/boots.js`): two boots in the main scene, faded in when the look pitch goes below −35°.

Interface: `vm.present(item, hold)` ('potion' | 'heart' | 'sword' | 'seed' or a build), `vm.info()`,
`vm.frameCheck(aspect)`, `vm.swords / scene / camera`. `G.debug.vm()` → `{ visible, mode, state, kind, swingId, tip, grip, item, hand, calls, tris,
cpuMs, fov, … }`; `G.debug.vm.pose(name)`, `vm.check(aspect)`, `vm.present(item, hold)`, `vm.relayout()`, `vm.T`.

## 14. Assets, rendering, atmosphere and audio

**14.1 Assets** (`js/assets.js`, `G.assets === Assets`) — detail: [WP8](wp/WP8.md). Manifest sections: `sprites` (DOM
images), `textures`, `billboards` (sky cards, grass and flower cards, effect cards), `models` (GLB), `ui`. An entry is
`'path'` or `{ src, lo?, atlas? (or json), loAtlas?, deferred?, eager?, wrap?, srgb?, mips?, height? }`; adding keys needs
no code change.

- Every key may be missing; a file that 404s or fails to decode is treated as absent (`Assets.missing`, `Assets.failed`,
  one `console.info` under `?debug=1`), never an error. Everything has a procedural fallback.
- HD / lo policy: `Assets.hdOk` = quality not low, no coarse pointer and `maxTextureSize ≥ 2048`; `Assets.lowRes` =
  quality low or a coarse pointer. `_hd` and `deferred` keys load after the title (`loadDeferred()`). Raising the
  quality fetches the full files; lowering it swaps resident `_hd` textures to their `lo` files. One slot per key;
  `texture.userData.lo` marks the small file. Anisotropy follows `TUNE.atmo.aniso` (16, GPU-capped; 4 on low / phones).
- `Assets.tex(key, ...fallbackKeys, opts) → texture` (never null: HD, key, base key, fallbacks, `opts.make()`, a 4×4
  colour). Consumers call it again from an `Assets.onTex(fn(key, texture, section)) → off` listener to pick up later
  arrivals; a replaced texture is not disposed (its owner may still hold it until its swap).
- `Assets.url / entry / has`, `textures / billboards / gltf / modelInfo / images / atlas`, `deferredAt`, `arrivals`;
  `makeModel(key, opts) → { group, materials, height, wrap } | null`, `hasModel(key)`, `loadAll(renderer, onProgress)`.
- `?noassets=<csv>` hides sections (`textures`, `billboards`, `models`, `sprites`, `ui`), `hd`, `all`, or single keys.

**14.2 Rendering core and performance** — detail: [WP7](wp/WP7.md).

- Materials (`toon.js`): `toonMat(o)` (toon ramp; options `nearFade` (default on: fragments nearer than 0.32 m dither out,
  gone at 0.10 m; `false` for the viewmodel), `instFade: [a, b]` (instances shrink by camera distance), `lod` + `lodBand`
  (Bayer crossfade between full model and proxy), `cut` (canopy cutaway)); `outlineMat(o)` (inverted-hull ink in pixels
  at 1080p, never thinner near the eye than the world-space width, capped at 8 px, faded per kind's far band; options
  `px, w, far, lodBand, lod, instFade, cut`); `sharedOutline(kind)`, `radialProfile`, `setHullProfile` (an instanced hull is
  not drawn while the eye is inside its model + 0.45 m), shared uniforms `U` (`uRes, uPxK, uPassK, uCutK, uCutBand,
  uOccC, uOccR, uTime, uPip …`).
- Scenery (`scatter.js`): one instanced layer per prop type, packed on the CPU per frame by view cone and distance class
  (`Scenery.cull(view, force)`). Deco (grass, flowers, pebbles, shells) shrinks away over 25–35 m, glowing deco over
  50–60 m, small props over 80–90 m; boulders, buildings, bridges and the Great Tree are never culled. Trees and heavy
  props have generated proxies (`perf/lod.js`) with their own ink hull, crossfaded over 38–48 m. Full models cast their
  own shadow within 20 m, proxies beyond and behind the view (`LAYER_SHADOW`). Stable prop ids: `p._inst = { L, k }`;
  `scenery.hide(p) / show(p)`.
- Canopy cutaway: a scatter tree whose axis is within its canopy radius + 1.2 m of the camera (ground plane) is dithered
  out above its canopy base, back in full 0.8 m further out; the trunk and the shadow stay. `U.uCutK` turns it on as the
  camera leaves the eye (0.2–1.2 m), so it is off in FP and ramps in through the V blend. Only trees beside or behind
  the camera: one whose axis is at Pip's depth along the view or past it keeps its crown (`U.uCutFwd` = view forward
  and Pip's depth, set by `wp7-perf`), and so does a crown whose base is ≥ 1.9 m over the camera (palms).
- Near grass (`perf/grass.js`): crossed cards in 5 m tiles within 20 m of the camera, density from the ground splat, tinted
  to the ground, cut by the sword's swing volume, regrowing out of view; off on quality low; the grass-tuft mesh is the
  fallback without the card texture.
- Generic object culler: any `Object3D` with `userData.cull = { dist, fade }` is hidden beyond `dist` (`Infinity` =
  never), shrinking over the last `fade` metres; objects whose bounds reach > 6 m from their origin are measured by
  their nearest point and only hidden. Direct children of `scenery.root` without a tag are classified by size. The culler
  never writes the owner's `visible` flag. World-space meshes built at the world origin (edge stones, waymarkers, signs,
  window cards, bunting) are tagged `Infinity` and culled by `wp9-world`'s own `spanCull` instead.
- Lights: point and spot lights are visible only at night (`sky.night ≥ 0.02`, with hysteresis) unless they carry
  `userData.alwaysOn`; both light sets are compiled at boot.
- Warm-up (`perf.warmup(renderer, scene, camera, between)`, called by `main.js`): every mesh, shadow-depth variant and
  telegraph is drawn once per light set before the title, so play compiles no new programs; the warm enemies, bosses and
  telegraphs are torn down through their owners' `remove()` inside `perf.keepPrograms(fn)`. A material created lazily
  later (first used in play) compiles at first sight: add one to the warm-up list in `main.js`.
- Resolution: the canvas DPR cap per quality (`dprFor`: auto 1.5, low 1.0, high 2.0). Dynamic resolution 0.70–1.0 scales
  only the main pass from the GPU timer (p75 of 30 timed frames: > 11.5 ms → −0.05; four windows < 8.5 ms → +0.05; ≥ 0.5 s
  apart); off with `dynRes: false`, under the manual clock and while `G.debug.perf` samples. Without the timer extension
  (Firefox, Safari) the samples are frame intervals, which only show whether the display's pace holds: a window with
  more than a quarter of its frames late → −0.05; four windows on time → +0.05 as a probe, and a step down within 128
  decisions of a step up doubles the on-time windows the next one needs (up to 128); a step up that no decision has
  judged when play pauses is taken back. The pace is 60 fps, or the display's own if slower (a 50 Hz display, a 30 fps
  power-saver cap), measured on the title screen, which draws no 3D (not when the page is embedded in a frame); a pace
  that gets slower during play is not measured again, one that gets faster moves back towards 60 fps. The decisions
  and their known limits are in `js/perf/dynres.js`. A lost WebGL context drops
  the timer's queries and pauses it; on restore the timer fetches its extension again and the scale starts over at 1. Shaders that use
  `gl_FragCoord` must take the pass size from `U.uRes`. Quality low: DPR 1.0, no near grass, 1024² shadow map, lo
  textures, no terrain near detail or cliff layer.
- Particles (`fx.js`): the painted `fx_atlas` (cells in `SHAPE`), near-faded under 0.35–0.9 m and size-capped; `FX` keeps
  every function's signature; `Halos` for lamp glows.

**14.3 Atmosphere, terrain and water** (`sky.js`, `terrain.js`, `atmo.js` module `wp8-atmo`, `ambient.js`) — detail:
[WP8](wp/WP8.md).

- Camera far plane 300 m. The sky lives in the main scene at depth 1: a gradient dome drawn after the opaque world, then
  one sprite draw for the painted sun, moon, clouds, horizon isles and sky isle; stars only on a darkened sky.
- Fog: `sky.js` replaces three.js's fog chunks at import: radial distance, coloured by the dome in the fragment's own
  direction (no seam at the horizon), per region near / far and tint (`TUNE.atmo.fog`), closer at dusk, night and in
  arenas, full before 270 m. The Great Tree and every `W.landmarks` entry are capped (0.30 / 0.45) so they read across the
  island. A custom `ShaderMaterial` with `fog: true` must include `<fog_pars_vertex>` and `<fog_vertex>` (they declare
  `vFogDir`); `fogCap(obj, cap)` caps one object's own materials.
- Terrain (`buildTerrain`, program `terrainSplat6`): top-3 splat of grass, forest, meadow, sand, snow, dirt and rock;
  HD layers after the title; a near-detail layer (4–10 m); rock and snow projected from the side on steep faces; a
  stratified cliff layer on faces ≥ ≈ 50°; cobbles on the plaza; a boot-generated grain texture within 2.2–4.2 m
  (`grainTexture`, no asset needed). `watchTerrainTextures(mat)` swaps late arrivals.
- Water (`buildWater`): Fresnel to the sky, sun and moon glints, shore foam, wading ripples (from `EV.STEP` / `EV.LAND`),
  far sea faded into the dome. `wp8-atmo.afterCamera` sets its light every frame.
- Shadows: one 2048² map (1024² on low), box half-size 24 m centred 14 m ahead of the eye along `view.shadowFocus()`,
  texel-snapped; the sun light never drops below 23°.
- Day and night: `CFG.dayLength` 480 s per day, new games start at 9.6 h. Night brings the moon (low, 17°–32°), stars,
  lamp pools, Pip's light (1.6 m over his feet), fireflies.
- Ambient (`game.ambPoint`, `updateAmbient`): region particles spawned in a volume 10 m ahead of the eye (radius 14 m,
  never within 1.5 m), gulls over the shores, morning light shafts under woods crowns.

**14.4 Audio** (`js/audio.js`, `js/audio-bus.js`) — detail: [WP5](wp/WP5.md). `core.js` wraps every call: `sfx(name,
opts)`, `music(track)`, `audioInit()`, `toggleMute()`, `isMuted()`; `?noaudio=1` makes them no-ops. `G.audio.sfx(name,
{ x, y, z, vol, rate, pan, dur, bus, at })`: a world point gives pan, distance gain (ref 2.5 m, silent by 45 m) and a
low-pass behind the listener. Also `play, listener, place, emitter (≤ 6 live), ambience, heartbeat, duck, claim, defer,
config, setVolumes, render (offline), info`. `audio-bus.js` plays sounds from events (steps per surface, jump, land, the
three swings, hits, clink, kills, hurt, dizzy, dash, pickups, potion, item-get fanfare, chests, view switch, lock on /
off, every telegraph, shockwave rumble, boss intro, region ambience beds, music ducking in dialogue and the shop) and
claims the old direct-call names for that frame so nothing plays twice. The low-health heartbeat follows the HUD's beat
(`TUNE.hud.beat` 0.9 s, soft at hp 2, full at hp ≤ 1). Volumes come from `musicVol / sfxVol / ambVol`; mute keeps its
own key.

**14.5 Offline / installable build** (`js/pwa.js`, `manifest.webmanifest`, `tools/build-pages.mjs`,
`tools/sw-template.js`; tests `tests/pwa.test.js`, `tests/pwa.mjs`). Only `_site/` has a service worker.

- `manifest.webmanifest` (linked from `index.html`): name, short name, `start_url` / `scope` / `id` `./` (so it works
  under `/game/`), `display: fullscreen`, `background_color` `--cream`, `theme_color` `--green`, icons 192 and 512 plus
  a maskable 512 (`assets/ui/app-icon-*.png`, drawn by `tools/make-app-icons.mjs` as a vector redraw of
  `assets/ui/icon.png`).
- The build adds `<meta name="starseed-sw" content="sw.js">` to `_site/index.html` and writes `_site/sw.js`: `VERSION`
  (a hash of every file's SRI hash) and `PRECACHE` (`[relative URL, sha256 integrity]` for every site file), then the
  template. `checkPwa(site, precache)` fails the build on a missing or invalid manifest member, a missing 192 / 512 /
  maskable icon, a root-absolute or missing path, or a site file left out of the precache list.
- `sw.js` install: precache into `starseed-isle <scope> <VERSION>` (`cachePrefix(scope)`: deployments under two paths of
  one origin never delete each other's caches). A file with the same integrity in an older version's cache
  is copied from it; the rest are fetched (HTTP cache, then `cache: 'reload'`) with `integrity`, so a stale copy fails
  the install instead of landing in the cache. `sw-precache-index.json`, written last, marks the cache complete. Then
  `skipWaiting`. Activate: delete this scope's other caches and `clients.claim()`. Fetch: same-origin GETs in
  the scope (no `Range`), cache-first by path with the query string ignored and `…/` served as `…/index.html`; a miss
  goes to the network. A deploy is therefore served from the next load after the one that found it. A page still open
  from the old version keeps working, because the new cache is complete before it takes over; it gets the new
  version's files from then on, and all its JS modules loaded at boot.
- `registerServiceWorker(ready)` (called by `main.js`): with the marker it registers `sw.js` once the title is up and
  the deferred textures have arrived (≤ 10 s); without it (the repo, `bun run start`, the smoke test) it does nothing,
  so `sw.js` is never requested. `?nosw=1`, or a page a worker controls without the marker, removes this scope's
  registration and its caches at once, even if the boot then fails. Errors are swallowed.
- Kill switch, if a bad worker ships: revert the registration (so pages stop registering), and ship this file as the
  site's `sw.js` (add it to `SITE_FILES`). Browsers check `sw.js` on every navigation, so each player's next load
  installs it, and it deletes the caches, unregisters itself and reloads open pages from the network:

  ```js
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(`starseed-isle ${self.registration.scope} `)) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })()));
  ```

## 15. HUD and UI (`js/ui.js`, `js/hud/*.js`, module `wp6-hud`) — detail: [WP6](wp/WP6.md)

`ui.frame(game, dt)` is the per-frame HUD, called by `game.render` once `game.target` is set: crosshair states, the
prompt, hearts and counters, the pickup feed, floaters, markers, compass, objective line, minimap (desktop only),
vignette and low-health beat, flash, boss bar, coach marks, key chips. It writes only transforms, opacity and short text,
each only on change; its CPU time is kept in `ui.frameMs` (budget p95 ≤ 0.3 ms).

| Part | Contract |
|---|---|
| projector (`hud/projector.js`) | `project(v, out)` → the `worldToScreen` record plus camera-space `vx vy vz`, from a cached viewport (refreshed by `ui.layout`); behind the eye `edgeAngle` is the real direction. `ui.project(pos, camera, out)` |
| prompt | `ui.setPrompt(pos, label, camera, mode)`: `[key] Verb · Name`. FP: the pill under the crosshair. TP: above the target's head, never on Pip |
| key tokens (`hud/keys.js`) | `fmtKeys(text, { html, device })` turns `{move} {look} {attack} {jump} {dash} {sprint} {interact} {potion} {view} {shoulder} {lock} {map} {pause} {zoom}` (aliases `{roll} {lockon} {use} {swing} {hop} {camera}`) into the device's glyphs; a control the device lacks becomes empty (`hasKeys`). Every on-screen text is formatted at display time |
| hints | `EV.HINT { id, text, life }` → `ui.hint`: queued (≤ 4), one at a time in the coach slot, the same id not again within 60 s; in a boss fight only hints queued in it show (the others wait for its end); a phone in FP docks the pill at the top mid-fight |
| feedback (`hud/feedback.js`) | crosshair ring on a target, coral petals with an enemy in reach, hit ticks and kill star; damage petals toward the source of `EV.HURT`; threat chevrons for `EV.TELEGRAPH` sources off the screen (behind the eye or past 0.95 of the half-width) and a "look up" caret; enemy heart pips (locked, aimed, last hit; ≤ 3); the lock reticle (an edge reticle with an arrow when off screen); speed lines from `view.speedFx` |
| navigation (`hud/nav.js`) | `objective(W, S, pl)`, `navMarkers(W, S, out, obj)`, `Compass`, `Minimap` (heading-up or north-up), `MapCard` (a click places `S.waypoint`). Markers come from `W.landmarks`, `W.arenas`, `W.shop`, `W.pedestal` (while a seed is carried the altar is the objective); while the straight line to the next arena crosses the river, the objective is that arena's bridge (`via-<id>`: its near mouth, then its far mouth) |
| notices (`hud/notify.js`) | `Feed` (pickup feed), `Notices` (region card and boss lower-third, never together), `Coach` (first-run coach marks: look 45°, walk 4 m, then swing, hop or roll; all three count from the start, done steps are skipped), `KeyHints`, `hudMem` (`starseed-isle-hud-v1`) |
| menus (`hud/menus.js`) | `Nav`, `MenuList`, `SettingsCard` (tabs View / Controls / Sound / Comfort from `SCHEMA` + `META`; the device's group first; keyboard + mouse rows hidden on a touch-only screen), `ControlsCard`, `kbmRowsHidden()` |
| boss UI | `ui.showBossCard(name, title, on, delay)` (a lower-third; in TP it moves to the right when Pip stands in the left half; the boss intro shows it on its own clock, which holds under the pause), `ui.bossBar(boss)` (under the compass; enraged border; "Now!" while `boss.opening`) |
| other | `ui.layout()` (`lay`: `'desk'\|'land'\|'port'`, scale unit `u`), `fitTop`, `toast`, `selfFloater`, `floater`, `collected`, `say`, `showBanner`, `openPause` (Resume, Settings, Controls, Map, Chat log, Save & Quit), `openLockPause`, `openSettings`, `openControls`, `openMap`, `openLog`, `setVeil`, `setCrosshair`, `setFade`, `setDizzy`, `beatPhase()`; `ui.menu` ∈ `'pause'\|'settings'\|'controls'\|'map'\|'log'\|'ending'` |

A missing sprite hides itself, except the hearts, which switch to drawn SVG hearts.

## 16. TUNE groups (`js/tune.js`)

One `export const` group per area; every key has a comment that says what it means. `CFG` (`data.js`) keeps the
original constants still in use (dash, reach, hearts, day length, spawning, regrowth).

| Group | Holds |
|---|---|
| `TUNE.view` | eye height and smoothing, near planes, pitch limits, the TP rig (pivot, shoulder, boom, slide, low colliders, trunks, canopy, gate fence, sight, feet drop, narrow screens), mode blend, shake, FP feel layers (bob, roll, land, kick, hurt, dash, punch, sprint FOV, FOV channels), lock-on camera, TP recentre, cinematics (talk, item, intro, dizzy, eyelids, wake, place, ending) |
| `TUNE.vm` | viewmodel camera, rest composition and touch clearance, keyed poses (the talk and boss-intro tip limits), item presentation, swing paths and recovery, contact feedback, trail, lighting, motion layers, boots |
| `TUNE.move` | speeds, sprint, acceleration, jump, coyote and buffer, air control, step heights, standable props, knockback hop, eye clearance, stuck recovery, FP dust, footprints |
| `TUNE.combat` | attack chain timings, lunge, knockback, hit volume, vertical reach and wall rules, magnetism, hit-stop steps, contact trauma, interaction cones, lock-on, aim friction, touch auto-face, spawning |
| `TUNE.actors` | telegraph colours, enemy wind-ups and reach, tokens, announce, alert, emerge, projectiles, boss tells and telegraph shapes, personal space, shrug, boss damage, cadence, minions, NPC behaviour, first-person drops, positional audio |
| `TUNE.hud` | scale unit, petals, chevrons, pips, reticle, hit markers, speed lines, compass, minimap, feed, chat log, cards, low-health beat, coach, the far-speaker portrait, the bridge objective, key chips, touch stick |
| `TUNE.perf` | far plane, cull distances, LOD bands, outlines, near fade, canopy cutaway, object culler, DPR caps, dynamic resolution, shadow sizes, near grass, particles |
| `TUNE.atmo` | far plane, fog per region, landmark caps, sky sprites, sun and moon, shadows, Pip's light, anisotropy, terrain layers (detail, cliff, side projection, grain), water, ambient volume, gulls, shafts |
| `TUNE.world` | Great Tree height and root radii, plaza, altar, spawn, lamps, waymarkers, edge stones, coin chests, landmark heights and fog cap, crown, animation speeds |

## 17. Debug API (`G.debug`, always present; overlay and keys with `?debug=1`)

`G.debugAllowed` = the page was loaded with `?debug=1`; `G.debugOn` = the overlay and debug logging right now (starts as
`debugAllowed`). Only while allowed: `` ` `` toggles `debugOn`, and with it on, in free play: 1–5 teleport (village,
woods, peaks, shores, meadow), G +100 gems, H heal, B to the nearest unbeaten boss arena, N +3 h, C collider gizmos. A
normal page load ignores all of them; `test.run / list` need `debugAllowed`.

URL flags: `?debug=1`, `?view=fp|tp` (this load only), `?nolock=1` (drag look, no pointer lock), `?fixed=1` (manual
clock), `?noaudio=1`, `?noassets=<csv>` (§14.1), `?seed=N` (another island), `?atmofog=0` (three.js's own fog, for
comparison only).

| Helper | |
|---|---|
| `teleport(x, z, yaw = null, pitch = 0) → [x, y, z]`, `pose(name)`, `standAt(kind \| npcId, n, { dist })` (`kind` `'shell'`: rainbow shell n of `W.shells`) | `pose`: `spawn`, `plaza-N`, `plaza-S`, `tree`, `village`, `woods`, `peaks`, `shores`, `meadow`, `hilltop`, `arena-woods / peaks / shores` (an unknown name lists them) |
| `spawn(type, dist = 4, relDeg = null, { alt, face, state, st })`, `last`, `enemies()`, `freezeAI(on)`, `freezeTime(on)`, `god(on)`, `hurt(dmg, relDeg)`, `down()` | `relDeg` from the view yaw (+ = left); the new enemy is `G.debug.last` |
| `setTime(h)`, `giveSeeds()`, `toBoss(id)`, `killBoss()`, `cutscene(name, id)` | `cutscene`: `'place'`, `'ending'`, `'bossIntro'`, `'itemGet'` |
| `aim()`, `target()`, `aimAt(x, y, z)` | what a full swing would hit now; the interaction target; aim the crosshair at a point (TP: from the camera the rig settles at for that look, which it runs the live rig to; where a slide flips shoulders with the aim it keeps the best look) |
| `setView(mode, { instant })`, `view(mode?)`, `look(yaw, pitch)`, `lookDelta(dx, dy, { single })`, `lookAt(x, y, z)`, `fov(h?)` | |
| `press(a, ms)`, `hold(a, ms)`, `release(a?)`, `move(x, y, ms)`, `pad(rx, ry)`, `inject({ look, hold, release, press, pad, touch, frames })` | input injection |
| `clock({ manual, redraw, timeScale })`, `manual(on)`, `step(n) → { ran, frozen, pos }`, `advance(n, dt \| dt[], { render })`, `seed(n \| null)` | deterministic frames; `seed` seeds `Math.random` |
| `events(n)`, `clearEvents()`, `settings(patch?)`, `shake(a, src)`, `hud(on)` | `hud(false)` hides every HUD element (dialogue and menus stay) |
| `armProbe(x, z, yaw, pitch)` | the TP spring arm as a pure query |
| `perf({ ms }) → Promise<{ fps, frames, cpuMs, gpuMain, gpuVm, gpuTimer, gpuDropped, calls, tris, dpr, size, view, tod }>` | real frames, GPU per pass via `EXT_disjoint_timer_query_webgl2` (null when unavailable); pin the hour with `setTime` + `freezeTime` |
| `info()`, `cam()`, `player()`, `lock()`, `game()`, `world()` | snapshots |
| `test.run(name = 'all', opts)`, `test.list()` | §18 |

Namespaces added by modules:

| Namespace | Helpers |
|---|---|
| `G.debug.cam.*` | `feel()`, `land(impact, surface)`, `jump()`, `kick(…)`, `fovPunch(…)`, `trace(n, dt, each)`, `sample()`, `tune(patch)`, `framing()`, `lockOn(target)`, `eyelids(k)` |
| `G.debug.vm` | `vm()` (= `vm.state()`), `pose(name)`, `check(aspect)`, `present(item, hold)`, `relayout()`, `module`, `T` |
| `G.debug.phys` | `state()`, `jumpTrace({ hold, run, sprint, frames, warm })`, `near(x, z, d)`, `warpSafe()`, `prints()` |
| `G.debug.lockOn(target?)`, `lockInfo()`, `lockCandidates()` | lock-on |
| `G.debug.actors` | `tokens()`, `telegraphs(n)`, `attack(e)`, `boss(name)` (woods `stomp\|spores\|summon`, shores `charge\|bubbles\|snap`, peaks `leap\|throw\|slide`), `ring(speed)`, `stage(type, o)` |
| `G.debug.audio` | `info()`, `place(x, y, z)`, `render(…)`, `last()`, `clear()`, `names()` |
| `G.debug.hud` | `state()`, `audit()` (overlapping HUD, touch and card rectangles now), `petal(relDeg, dist)`, `telegraph(relDeg, dist, t, y)`, `hint(id, text)`, `fmt(text, device)`, `coach(step)`, `layout()` |
| `G.debug.perf.*` | `state()`, `cull(on)` (false = everything at full detail), `dyn(k?)`, `lights(on?)`, `grass(on)`, `repack()` |
| `G.debug.atmo` | `info()`, `caps()`, `applyCaps()`, `fogCap(obj, cap)`, `ripple(x, z, k)`, `snapFog()`, `features(patch)` (switch fog, caps, terrain layers incl. `terrainGrain`, sprites, water, gulls, shafts) |
| `G.debug.wp9` | `info()`, `objects()`, `signInk()`, `losCrown(o)`, `losLandmarks(o)` |

## 18. In-page tests (`js/debug/tests.js`, `js/debug/tests/wp1.js … wp9.js`)

CI (`.github/workflows/ci.yml`) does not run these. It runs `bun test` (`tests/*.test.js`: world generation, content
tables, save schema, the settings store, the dynamic-resolution controller against simulated displays, the service-worker
registration and the PWA build checks), `tests/smoke.mjs` (headless Chromium with software WebGL: New Game, then Continue a valid, a
corrupt and a newer-version save, each load with stored settings: valid, wrong-typed, unreadable; no service worker),
`tests/pwa.mjs` (the Pages build under `/game/`: install, offline play, an update, `?nosw=1`; §14.5) and
`tests/playthrough.mjs` (a whole game from a clean `localStorage`: New Game, Shellby's intro, each guardian's arena walked
into, beaten with `G.debug.killBoss()` and its Starseed walked onto, Use at the pedestal, the ending and its card, free roam,
Clover's errand after Captain Pinch (talk, Use on the five rainbow shells, talk again for the reward once), the pause
tracker at 3/3 and errands 1/1, Save & Quit, a reload and Continue with the bloom and the finished errand restored; it steps the real frame loop
(`game.runFrame`, drawing one frame in 60) on the manual clock without its redraws instead of waiting in real time).
`tests/lib/browser.mjs` holds the static server and Chromium options the smoke and playthrough tests share. `jsconfig.json` maps `three` to the vendored copy for `bun test`, as the import map
in `index.html` does for the browser, because `js/world.js` reaches `js/props.js` and so three.js. The Pages build
(`tools/build-pages.mjs`) scans every `js/**/*.js` for `from '…'` with a regular expression, comments and strings
included, so text such as `from 'dash'` in a comment fails it: keep that pattern out of comments and messages.

Loaded only by `G.debug.test.run / list` (a dynamic import that needs `?debug=1`), so normal play never pays for them.
Run them from the browser console on `http://localhost:8080/?debug=1`:

```js
await G.debug.test.run('all')            // every suite not marked heavy → { suite, pass, fail, ms, results }
await G.debug.test.run('wp3', { only: 'jump' })   // one suite, tests whose name contains 'jump'
await G.debug.test.list()                // [{ name, desc, tests, heavy }]
```

| Suites | |
|---|---|
| in `'all'` | `smoke` (boot contracts, viewmodel composition and night lighting, extension points, collider / touch / projector / heart contracts, the debug-key gate), `look`, `feel-basic`, `combat-basic`, `interact-basic`, `save-migrate`, and one per area: `wp1` … `wp9` |
| heavy (run by name) | `probe` (TP arm vs colliders, `{ n }`), `sweep` (perf sweep: 9 locations × 4 directions per view, `{ modes, ms, settle, time }`), `wp1-heavy`, `wp2-heavy` (vm GPU; run at 1920×1080), `wp3-heavy` (`{ n, walks, per, tree }`), `wp4-matrix`, `wp5-heavy` (boss masher check, audio levels), `wp6-heavy` (overlap audit), `wp7-hitch` (run first in a fresh page), `wp7-sweep` (budget gate; `{ modes, locs, dirs, ms, reps, settle, time, gate }`), `wp8-perf`, `wp9-heavy` |

Each test starts from a deterministic state: manual clock, `Math.random` seeded, play with no modal, cutscene or fight,
no enemies, full hearts, noon, FP unless `prepare.view`, default look settings, Pip at `prepare.pose` or `prepare.at`,
render clocks and walk phase at 0. After the run the save and the settings are restored and the session reloads from
the save (`{ keep: true }` skips the reload). An area registers its suites in its own file (a sketch):

```js
export default function register(suite) {
  suite('wp3', [
    ['jump apex 0.85 m', async (t) => {
      t.press('jump'); t.frames(18);
      t.near(t.pl.pos.y - t.W.hAt(t.pl.pos.x, t.pl.pos.z), 0.85, 0.03, 'apex');
    }],
  ], { desc: 'physics', prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12, sword: 1, seed: 1, settings: {} }, heavy: false });
}
```

Context `t`: `opts, G, game, D (= G.debug), view, pl, W, ui, input, settings, EV, STEP, THREE, ok(cond, msg, data),
eq(a, b, msg), near(a, b, tol, msg), note(key, value), frames(n, { dt, draw }), press(a), hold(a), release(a), move(x, y),
wait(ms), dlgDone(), events(type), clearEnemies(), resetPlayer(), swing({ type, dist, rel, pitch, alt, face, state,
chainC })`. A test with no checks fails. Gameplay ignores attack / dash / jump for 120 ms after a modal closes: `prepare`
waits it out; a test that closes a modal itself uses `await t.wait(130)`.

Timing checks read real milliseconds and can fail on a loaded machine without a regression: the HUD frame CPU test in
`wp6`, the `wp7-hitch` frame maximum and the `wp2-heavy` viewmodel GPU time. Judge them on an idle machine.

## 19. Known limits

- TP camera: with Pip's back flush against a wall, a cliff or the altar he is dithered or hidden (the view ahead stays
  clear); in dense woods Pip sometimes stands under the crosshair; a few pull-ins of up to ≈ 0.8 m in one frame remain in
  natural walks, and the sideways slide starts at full speed. On a portrait phone Pip is ≈ 22 % of the screen height
  (28–36 % elsewhere). A tree whose trunk is beside the camera loses its canopy to the cutaway and shows a bare trunk.
- "Camera drifts behind Pip" pauses while an enemy is within 10 m, and with the stick held diagonally Pip runs a wide
  curve (≈ 9 m radius) as the camera follows.
- FP eye on rough slopes: the smoothed eye trails the feet by up to ≈ 0.2 m on the steepest paths, and its vertical
  acceleration there (p95 ≈ 7.9 m/s²) is above the feel target of 4.
- On a landscape phone the FP sleeve runs out under the Roll button (the paw itself clears every button).
- Boss balance is tuned for the wooden sword; with the Shiny Sword fights are shorter and a player who never dodges
  wins about two in three.
- `W.reach` is a 1 m grid; Pip's continuous walkability lets walks follow thin bands a few metres past it (≤ 5.4 m in
  300 000 random steps); no sequence break was found.
- `G.debug.perf` and the `sweep` suite measure one repetition per view; `wp7-sweep` takes the minimum of three medians.

## 20. History

Starseed Isle began as a cute top-down 3D adventure with a three-quarter overhead camera. It was converted to a
first-person game with an over-the-shoulder third-person view in a foundation phase (clock, events, module host,
settings, view system, input with pointer lock, debug API, test runner) followed by nine work packages built in parallel
(WP1 camera feel and cinematics, WP2 hands and Pip's body, WP3 movement and collision, WP4 combat and targeting, WP5
actors and audio, WP6 HUD, menus and touch, WP7 rendering performance, WP8 atmosphere, WP9 world content) and two rounds
of integration fixes and playtests. Module names (`wp1-feel` …), test suites (`wp1` …) and `docs/wp/WP1.md … WP9.md`
keep those numbers. The detail files record each round's measurements and decisions; they cite the design proposals
(as arch / feel / art §n), cross-area contracts (C1–C18) and evidence files under `S/…` (the scratch directory of the
build session), none of which are part of the repository. Decisions that differ
from the original plan and are kept on purpose: the ending looks up with FOV +8°; the TP lock boom grows +2.0 m during
Frostbun's leap; one swing-magnetism table for both views; boss HP doubled (48 / 48 / 50) with every big attack taking
half a heart; passive enemy contact does not hurt; tree LOD over 38–48 m; dynamic resolution scales the main pass, not
the canvas; the sky drawn in the main scene at depth 1; fog full by 270 m; the lighthouse on the beach by Pinch's cove.
