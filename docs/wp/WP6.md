# WP6 — HUD, menus, touch and settings UI (as built)

What WP6 added or changed, for folding into `docs/ARCHITECTURE.md` after the merges. Owned files: `js/ui.js`,
`styles.css`, `index.html`, `js/hud/*.js`, `js/touch.js`, `README.md` (controls, debug), the UI section of
`docs/DESIGN.md`, `TUNE.hud`, `js/debug/tests/wp6.js`, this file.

## 1. Files

| File | Contents |
|---|---|
| `js/ui.js` | `UI`: builds every element, layout (`--u`, phone layouts, the narrow-window top-row fit), settings hooks, title / loading, the per-frame HUD (`frame`), dialogue, shop, pause / settings / controls / map / chat log / ending cards, veil; exports `topFit` (pure top-row fit) |
| `js/hud/hud.js` | module `wp6-hud`: event wiring, per-session resets, the portrait "turn sideways" tip, `G.debug.hud.*`, `audit()` |
| `js/hud/keys.js` | **C7** key tokens → device glyphs: `fmtKeys`, `keyParts`, `glyph`, `keyCap`, `deviceKind`, `hasKeys`, `GLYPHS`, `ALL`, `esc` |
| `js/hud/feedback.js` | `Feedback`: crosshair states, hit ticks / kill star, damage petals, threat chevrons + look-up caret, enemy pips, lock reticle (edge mode on a free-area ellipse), TP target marker (`tm`), Pip's projected box in TP (`pipBox`), speed lines; `sty(e, k, v)`, `actorMax(e)` |
| `js/hud/nav.js` | `objective(W, S, pl)`, `navMarkers(W, S, out)`, `Compass`, `Minimap`, `MapCard` |
| `js/hud/notify.js` | `Feed` (pickup feed), `Notices` (region card + boss lower-third), `Coach` (coach marks + hint queue), `KeyHints`, `hudMem` |
| `js/hud/menus.js` | `Nav` (menu input edges + repeat), `MenuList`, `SettingsCard` (from `SCHEMA`), `ControlsCard`, `META`, `TABS` |
| `js/hud/icons.js` | `iconUrl`, `iconImg`, `iconState`, `drawIcon`, `iconHtml` (ui / sprite icons with fallbacks), `preloadIcons` |
| `js/hud/sound.js` | `uiSfx(name)`, `hasSfx(name)`: the C8 UI names, falling back to the legacy sound until WP5 has the name |
| `js/hud/projector.js` | `project(v, out)` does the camera maths itself with a cached viewport (`viewport()`, `refreshViewport()`; refreshed on resize and by `ui.layout`); adds camera-space `vx vy vz`; behind the eye `edgeAngle` is the real direction. It no longer calls `view.worldToScreen` (that reads `innerWidth` per call, which forces a style + layout pass under a mobile viewport) |
| `js/touch.js` | full touch layout (floating stick, thumb cluster, small buttons, contextual Use, Lock near enemies, left-handed) |

## 2. Contracts

- **C7 (provider).** `fmtKeys(text, { html = false, device })` from `js/hud/keys.js`. Tokens `{move} {look} {attack}
  {jump} {dash} {sprint} {interact} {potion} {view} {shoulder} {lock} {map} {pause}` plus aliases `{roll} {lockon}
  {use} {swing} {hop} {camera}` and `{zoom}`. Plain text by default (unknown tokens stay as written); `html: true`
  returns escaped HTML with keycaps (`<kbd>`, round pad face buttons `<kbd class="kp a">`, touch icon chips). `device`
  overrides `input.lastDevice` (`'keyboard'|'mouse'|'kbm'|'pad'|'touch'`). A control the device lacks becomes an
  empty string (touch has no `{shoulder}`), and `hasKeys(text, device)` tells callers whether a line names one.
  `ui.js` formats at display time: dialogue (typewriter treats a keycap as one character and re-formats when the
  device changes mid-line), signs, toasts / feed lines, banners, prompts, hints, coach marks, cards, the chat log.
- **C18 (provider).** `EV.HINT { id, text, life? }` → `ui.hint(id, text, life)`: queued (max 4), one at a time in the
  coach slot (4.5 s), the same `id` not again within 60 s; waits out dialogue; tokens formatted. Others never draw
  tutorial text.
- **C1 (consumer).** Lock reticle on `view.lockTarget` (its `hurtbox()`; position fallback). Off screen it sits on an
  ellipse inside the free area (under the compass + objective line and, capped, the region card; above the key chips
  / the portrait control deck; between the stick and the thumb cluster in landscape) with an arrow pointing the way to
  turn: in front of the eye the projected direction, behind it camera-space `atan2(vx, vy − vz)` (behind-left = lower
  left, straight behind = bottom, a target under a view tipped all the way up = bottom). Pips always for the locked
  target (any distance), with its `name`; off screen they hang on the inner side of the edge reticle.
- **C3 (consumer).** `EV.TELEGRAPH { kind, x, y, z, t, source }`: a chevron while `t` (clamped 0.5–2.5 s, +0.25) runs,
  only when the source is **off the screen as the camera sees it** (projected at its hurtbox middle: behind the eye,
  `|NDC x| > TUNE.hud.chevNdc` 0.95 (0.91 to turn an on-screen chevron off), or under the bottom edge), the same edge
  WP5's `offView` announces by, so it holds at any FOV, aspect (portrait phones: hFOV ≈ 58°) and view. It points the way
  to turn as the lock reticle does (in front: the projected direction; behind the eye: `atan2(vx, vy − vz)`) and sits on
  the reticle's free-area ellipse (`edgePoint`, inset `chevEdge` × u: under the compass, above the key chips / the
  portrait control deck, between the stick and the thumb cluster). Follows the source's hurtbox; a source that is
  killed, dying or no longer in `game.enemies` drops its chevron at once. A "look up!" caret when a threat in front is
  above the view (NDC y > 0.9). Without a camera the old ±`chevCone`° yaw cone is the fallback.
  A telegraph (and a hurt) also hides the region card (§3 `showBanner`).
- **C4 (consumer).** `EV.HURT { fromX, fromZ, rel }`: a damage petal at radius 0.2 × screen height pointing at the source,
  recomputed every frame (turns with the view), 0.8 s; `rel` is the fallback without a source.
- **C5 (consumer).** Pips read `hp`, `maxHp` (fallback `def.hp`, `ENEMY[type].hp`, first seen hp), `name`; shown for
  the locked, the aimed (≤ 10°, ≤ 8 m) and the last-hit (`EV.HIT.target`, 2 s) enemies, at most 3, ≤ 5 hearts. An
  enemy off screen that is not locked shows none (they are no longer clamped onto the HUD widgets).
- **C6 (consumer).** Compass / map / minimap markers from `W.landmarks` (`{ id, name, region, x, z }`; the one whose id or
  name says "tree" is the Great Tree, others show within 160 m) else `W.greatTree` / `W.treePos`; `W.arenas`, `W.shop`,
  `W.pedestal`: while a seed is carried, an **`altar` marker** (kind `altar`: the tree icon with a gold ★ pip; a gold
  minimap dot) at `W.pedestal` is the objective (`objective().id === 'altar'`), so the compass badge, its distance pill,
  the objective line, the minimap ring and the map highlight all point at the altar (they pointed at the trunk 8.8 m
  away); without `W.pedestal` the tree is home as before.
- **C9 (consumer).** `view.speedFx` (0…1) → `#speedfx` opacity × 0.55 (0 under Motion comfort).
- **C8 (consumer).** UI sounds go through `uiSfx`: new names `uiMove uiSelect uiBack uiOpen uiClose uiTab uiSlider
  coach waypoint` play when `G.audio.has(name)` (or `G.audio.sfxNames`) lists them, else the legacy `menu / select /
  cancel` (never both). New name not in the C8 list: **`heartbeat`** (each 0.9 s beat while hp ≤ 1, silent until WP5).
  **One source:** when the audio layer has its own `G.audio.heartbeat(k)` (WP5's audio-bus drives it from hp), the
  HUD plays no beat; when it has `setVolumes` (or sets `ownsVolumes`), the HUD pushes no volumes (no squared curve).
- **C14.** FP NPC dialogue (`portrait` starting `npc_`, `view.blend < 0.5`, no shot) hides the portrait (`.fpnpc`).
- **C15.** `ui.showBossCard(name, title, on)` (lower-third after 0.5 s, `#ui.bosscard` while it shows (portrait: the feed
  steps aside); hides the region card and refuses new ones
  while up; round 3: when it comes in with Pip on screen in the left half — the third-person intro shot frames him there,
  right under the lower-left slot — it takes the right side, `#bosscard.flip`, `Notices.pipLeft()`; first person and the
  portrait card (top) keep their place), `ui.bossBar(boss)` under the compass (fills in over 0.6 s; `boss.enraged` → pulsing border;
  WP5's `boss.opening` (the free-hit window: recovering after a big attack, or stunned) or `boss.state === 'stunned'`
  → "Now!" tag).
- **C17.** The Settings card shows every `SCHEMA` key (tabs View / Controls / Sound / Comfort, plus a Sound mute row);
  keys without `META` land in View · More, so new keys get a control automatically. **Except** keys `META` marks
  `hidden: true` (a SCHEMA key nothing in the game reads, so the card never offers a switch that does nothing). No key
  is hidden today: round 2 built the three missing consumers (`arrowLook` → `js/input.js`; `tpAutoRecenter` and
  `tpBodyFacesCamera` → `js/view/feel.js`) and their rows are shown. The
  Controls tab puts the device in use first, then Sword, then **Third person** (touch: Touch · Sword · Third person ·
  Controller; a touch-only screen counts as touch before its first tap); the Controls card's look / walk rows use the
  device tab's pictogram. Groups (round 3): **Keyboard + mouse** (was "Mouse": it holds the arrow-look row) — mouse
  sensitivity, invert, raw input, "Arrow keys look around" (note: WASD still walks · they turn at the controller look
  speed, with its invert switches); Controller; Touch; Sword; **Third person** — "Camera drifts behind Pip" (note: with a controller or touch,
  while you run and leave the camera alone; it was under Controller, after the mouse rows) and "Pip faces where you look"
  (note: Pip steps sideways instead of turning to run; it was "… (third person)" under Sword). On a **touch-only screen
  nobody has typed on** (`kbmRowsHidden()`: `(pointer: coarse)`, no `(any-pointer: fine)`, `input.lastDevice` not
  keyboard / mouse) the Keyboard + mouse rows are left out (they do nothing there; a Bluetooth keyboard's first key brings
  them back); `SettingsCard.keysOf(tab, dev, noKbm)`.
  A tab taller than its box (View and Controls at 1280×720 and below; most tabs on phones) gets a **scroll cue**:
  `SettingsCard.cue()` (on open, tab change, scroll and `ui.layout`) sets `.sbody.more-dn` / `.more-up` and
  `.card.more-dn`; the bottom edge fades out (`--fd` 58 px, 36 px on landscape phones), the top edge fades once
  scrolled, and a "more ▾" chip on the bottom edge scrolls 70 % of the box on a click. Keyboard / pad focus scrolls stop
  clear of the fades (`scroll-padding`). A new tab opens scrolled to its top.

## 3. UI interface (`G.ui`), new or changed

| Member | |
|---|---|
| `frame(game, dt)` | the per-frame HUD: feedback, prompt, hearts / counters / seeds, feed, floaters, markers (rebuilt on events or every 0.5 s), compass, objective (4 Hz), minimap (desktop), vignette + low-HP beat + `heartbeat`, flash, boss bar, coach, key chips. CPU time in `ui.frameMs` (ring of 240) |
| `layout()`, `lay` (`'desk'|'land'|'port'`), `u` | desktop `--u = clamp(min(w/1920, h/1080)·1.12, 0.72, 1.2) × hudScale`; `land` = height ≤ 500 and landscape, `port` = width ≤ 600 and portrait (fixed px × hudScale) |
| `fitTop(force)`, `fit`, `measureSafe()`, `safeTop`, `safeBottom` | desktop top row: hearts wrap to rows of 5 (`#hearts --hcols`) and the compass / boss bar narrow so hearts (up to 10), counters, compass and minimap never overlap (601–900 px windows); runs on resize, a new heart container, a wider gem counter, the minimap setting. `safeTop` = bottom of compass + objective line (or boss bar) + 6 px; `safeBottom` = key-chip band |
| `bannerExtra`, `bannerUntil` | how far the region card reaches below `safeTop`, until it has faded out (edge indicators / pips keep under it, capped) |
| `setPrompt(pos, label, camera, mode)` | `[key] Verb · Name` from `label` (string or `{ verb, name, label }`). FP (`mode 'fp'`): the pill under the crosshair (centred by auto margins). TP (`'world'`, arch §10): `placePrompt()` puts its bottom-centre on the target marker above the target's head (`fx.tm`), above the crosshair when the target is off screen, never on Pip (`fx.pipBox`: above his hood, else beside him), inside the free area |
| `toast(msg)` | a pickup-feed line (top-left), merged when repeated; `✿…` lines are notes |
| `selfFloater(text, color)` | a feed line in both views; `+N gems` lines are dropped (the feed counts `EV.COLLECT`); `Refreshed!` → `Refreshed! ♥ full` |
| `collected(p)` | `EV.COLLECT` → gem lines merge into one counting line |
| `hint(id, text, life)` | C18 queue |
| `showBanner(title, sub)` | region card in the notification slot (vista art on a first visit, desktop); returns false while the boss card is up. It fades early when a fight starts around Pip (it covers the upper centre, where flyers rise): `EV.TELEGRAPH`, `EV.HURT`, or an enemy within `TUNE.hud.bannerThreat` (14 m) that has noticed him (`notices.frame(g)`, only while the card is up) |
| `openControls(fromPause)` | `fromPause` false (first run): the 3 coach marks instead of a modal card (look 90°, walk 4 m, swing / hop / roll); `onControlsClosed` fires when done. With the setting `arrowLook` the keyboard look step names the arrow keys too, and the controls reference lists them under Look instead of Move. In TP the coach pill keeps off Pip (`Coach.place`): desktop slides it beside him (`margin-left`), phones / no room move it up under the objective line (`#coach.ctop`, waits while the region card or the prompt pill is up) |
| `menuInput(input)`, `titleInput(input)` | read the real frame time (`G.clock.dt`, clamped 0.1 s): slider repeat and the map cursor run alike at 30 / 60 / 144 Hz |
| `openSettings(fromTitle)`, `closeSettings(silent)` | Settings card (from the title it sits over it; the scroll cue is measured once it is displayed) |
| `showTitle(hasSave, cb)` | at boot (the loading card still in the DOM, fading out on top) the title appears at full opacity under it with no fade of its own, so the loading card's 0.5 s fade is the whole transition and the WebGL canvas never shows through; later (Save & Quit) it fades in over 0.6 s as before. The device line ("Mouse + keyboard · gamepad · touch") sits bottom-left on a soft dark chip, clear of the painted sword hand |
| `openLog()`, `chatLog` | pause → **Chat log**: the last 20 dialogue lines (formatted when it opens); cleared on a new game |
| `onPauseChoice(i)` | 0 Resume · 1 Settings · 2 Controls · 3 Map · **4 Chat log · 5 Save & Quit** (was 4) |
| `openMap(pl, facing, S)` | parchment map; click / tap / pad cursor (move stick + confirm) places `S.waypoint`, on it again removes it |
| `setVeil(on)` | "Click to play", "Tap to play" on touch |
| `ui.menu` | adds `'settings'` and `'log'` (so `EV.MODAL.modal` can be those too) |
| parts | `fx` (Feedback), `feed`, `notices`, `coach`, `keyHints`, `compass`, `minimap`, `mapCard`, `settingsCard`, `controlsCard`, `markers`, `markersDirty`, `markersVer`, `reduced` |

Menus by pad (`Nav.read`): LB / RB (and R / V) switch tabs; the D-pad's ↑↓, which input.js also maps to potion / view,
moves the selection in Settings / Controls (a `potion` / `view` press whose D-pad button is down with its `navDown` /
`navUp` edge is not a tab switch).

Compass (`nav.js`): N / E / S / W on their own canvas above the marker badges (only the objective, z 5, sits above
them). Outside the window the objective, the map marker and the Great Tree stay pinned at the edge (opaque, colour
muted), stacked inward in that order. Map card: region names move off the marker badges; the frame hugs the canvas.

Key chips (`KeyHints`) stay hidden while the touch controls are up (hybrid devices).

Touch (`js/touch.js`, Input mixin): `setupTouch(ui)`, `stickMove`, `layoutTouch()` (left-handed mirror),
`showTouch()`, `setTouchMode(mode)` (only `'play'` shows controls; a `'play'` during a cinematic — `game.cutscene`,
`game.trans` (any fade, incl. title → play), the boss intro (`fight.phase === 'intro'`) or the HUD switched off — becomes
`'cinema'` and hides them like dialogue does; in play the Use button follows `game.target` with its verb / icon and
Lock shows near enemies or in fights), `setTouchVisible(on)` (hiding drops held buttons and the stick). Held Roll also
holds `sprint`.

## 4. Fields, storage, settings

- **Save:** optional `S.waypoint = { x, z }` (map marker; deleted when removed).
- **Storage:** `starseed-isle-hud-v1` (through `store`): `{ sessions, sideways }` (key chips for the first 3 sessions,
  the one-time portrait tip). Separate from the save and the settings.
- **Settings read live:** `crosshair`, `crosshairSize`, `crosshairColor`, `minimap`, `hudScale`, `reduceMotion` (+
  `prefers-reduced-motion`: `#ui.calm` stops every bobbing animation and caps the full-screen hurt and white flashes at
  `flashCap`), `textSpeed`, `touchLeftHanded`, `musicVol` /
  `sfxVol` (pushed to `G.audio.setMusicVolume / setSfxVolume` unless `G.audio.ownsVolumes` is true — WP5 sets that when
  its audio layer reads the settings itself). The settings card writes every key through `settings.set`.
- **Wish (not added, C17):** a "Damage petals on/off" comfort key (art §12.4).

## 5. TUNE.hud

`uMin uMax uK` (scale unit), `petalLife petalR`, `chevEdge chevCone chevHz chevMin chevMax`, `chevNdc` (round 2: 0.95,
= WP5's `TUNE.actors.offEdge`; `chevEdge` 70 → 34: now the centre inset on the free-area ellipse; `chevCone` only without
a camera), `bannerThreat` (round 2: 14 m), `reachCone`,
`aimDeg pipDist pipHold pipLift pipPx pipMax`, `retMin retMax`, `hitMs killMs`, `speedAlpha`,
`compassSpan compassW compassH landmarkRange`, `miniSize miniSpan`, `feedLife feedMax feedMerge`, `logMax`,
`bannerT bossCardDelay`, `beat lowBase lowPulse flashCap`, `coachLook coachWalk coachHold hintT hintGap`, (`hitMs` 170 and
`killMs` 380 since the fix round: the hit ticks and the kill star pop, hold and fade),
`keyHintsT keyHintSessions`, `stickR stickDead stickHome`. Meanings are in the comments in `js/tune.js`.

## 6. Debug and tests

- `G.debug.hud.state()` → `{ lay, u, cross, crossOn, prompt, petals, chevrons, lookUp, pips, reticle, speed, feed,
  objective, coach, coachText, hints, banner, bossCard, bossBar, menu, cpu: { p50, p95, n }, compassDraws, miniDraws,
  markers, writes, chatLog, veil }`; `audit()` → `{ count, list: [[a, b, px²]], rects, size }` (forbidden overlaps on
  screen now: HUD widgets with each other, touch controls with anything, dialogue with HUD, anything leaving the
  viewport); `petal(relDeg, dist)`, `telegraph(relDeg, dist, t, y)` (simulate C4 / C3), `hint(id, text)`,
  `fmt(text, device)`, `coach(step)`, `layout()`.
- Suites: `wp6` (40 tests, in `'all'`; the CPU test replays one scripted 200-frame run 2 + 7 times from the same seeded
  state and judges the p95 of the per-frame **medians** over the 7 replays — round 3, see §11), `wp6-heavy`
  (60 s NaN session, overlap audit over 16 HUD states incl. 8 hearts). Regression checks from the fix round: real-pad
  menus through a stubbed `navigator.getGamepads`; edge reticle at ±100° / ±160° and pitch ±85°; projector vs
  `view.worldToScreen`; TP prompt / coach vs Pip; top-row fit (8 hearts at 640–2560 px); menu input at 30 / 60 / 144 Hz;
  pinned compass badges; key chips vs touch; one audio source for volumes and the heartbeat.
- Scripts outside the repo (`agents/r1-WP6-build/`): `tour.mjs` (31 states, JPEG + audit per state), `play.mjs`
  (real-input playthrough), `before.mjs` (same overlap rules on any build), `look.mjs`, `touchscroll.mjs`, `prof4.mjs`.

## 7. What in ARCHITECTURE.md is no longer true

- §6 DOM order of `#ui`: now `#hud` (inside it: `#speedfx`, `#tl` hearts / counters / `#feed`, `#tc` compass /
  objective + seeds / boss bar / region banner, `#minimap`, `#coach`, `#keyhints`, `#petals`, `#worldmarks`), `#prompt`,
  floaters, `#bosscard`, `#vignette`, `#dizzy`, `#flash`, `#dialogue`, `#shopwrap`, `#pause`, `#settings`, `#controls`,
  `#chatlog`, `#mapview`, `#ending`, `#fade`, `#title`, `#crosshair`, `#veil`, `#loading`, `#debug`, `#touch`. The banner,
  boss bar and toast are no longer separate `#ui` children (toasts are `#feed` lines). `insertBefore(G.ui.dlgEl)` still
  puts an overlay under dialogue / menus.
- §15: the prompt is the crosshair pill in FP and world-anchored on the target in TP (as arch §10); `selfFloater` is a
  feed line in both views; `ui.frame` also runs the compass, feedback, coach and feed; the first-run controls card is the
  coach marks.
- §10: the HUD projector does its own projection with a cached viewport (no `view.worldToScreen` per call).
- §11: `setTouchMode` modes are laid out (only `'play'` shows controls); touch has a Lock button and left-handed mode.
- §12: the settings listed above are read live by WP6 (they no longer "wait for their packages").
- §5: `EV.MODAL.modal` adds `'settings'` and `'log'`; `EV.HINT` has a consumer.
- §17 / §18: `G.debug.hud.*`, suites `wp6` / `wp6-heavy`.

## 8. Before / after (evidence in `agents/r1-WP6-build/`)

- Forbidden overlaps, same rules, same 10 states (`before.mjs`): foundation **10** (844×390), **51** (390×844), **2**
  (1280×720) → WP6 **0 / 0 / 0**. The full tour (31 states incl. shop, settings tabs, map, chat log, boss intro and
  fight in FP and TP, item-get, veil, dizzy, ending): **0** at 1280×720, 1920×1080, 844×390 and 390×844
  (`r3-*.jpg`, `r3-*.json`).
- HUD CPU (`wp6` test, median of 3 runs after a warm-up run, 0.1 ms timer), fix round: p95 0.2 ms at 1280×720,
  800×600, 2560×1080, 390×844 @3 and 844×390 @3 (mobile emulation), means 0.05–0.09 ms. Before the fix the phone runs
  failed (p95 0.6–1.0): every projection read `innerWidth`, which under a mobile viewport forces a style + layout pass
  after each HUD style write (measured ≈ 100–130 µs per `view.worldToScreen` call vs 1.5–3 µs for the new projector;
  desktop 2–4 µs either way). Isolated (`agents/r1-WP6-fix-r1/micro.mjs`): `fx.frame` 6–10 µs, `ui.frame` 10–25 µs per
  call. With the GPU pass between frames on this shared machine (load ≈ 10) the per-frame mean is 0.18–0.3 ms and p95
  0.3–0.6 ms (GC and cache effects of the world render land in the HUD's slice); see known issues. Per frame only
  transform / opacity / short text writes, each only on change, no layout reads, no allocations in the hot paths.
- 60 s FP session: 0 NaN / empty coordinates (> 1000 element samples).

## 9. Fix round 1 (reviewer findings)

- Pad D-pad ↑↓ switched Settings / Controls tabs (input.js maps it to potion / view too): fixed in `Nav.read`.
- Edge reticle pointed the wrong way for targets beside / behind (view.js returns the reversed angle behind the eye):
  the projector computes it, the reticle uses the free-area ellipse and camera-space direction. **For F / WP1:**
  `view.worldToScreen` (view.js:133) still reverses `edgeAngle` behind the eye and reads `window.innerWidth/innerHeight`
  per call (a forced layout under a mobile viewport); WP6 no longer uses it.
- TP prompt on Pip (deviation from arch §10 in the first build, now reverted): anchored on the target, kept off Pip.
- HUD CPU on phones: the projector (above); `Feedback.frame` skips the reach / aim loops with no enemy within 8 m, no
  per-frame closures / Map entry arrays / string keys (coach, hints, prompt, touch verb), floaters updated in place.
- Hearts under the compass on 601–900 px windows: `fitTop`. Coach on Pip in TP: `Coach.place`. Compass clutter, map
  frame / labels, edge pips, hit / kill markers, key chips with touch, menu frame-rate dependence: see above.
- Known issues: the HUD's per-frame CPU measured with the GPU pass in between is noisy on this shared machine (p95 up to
  0.6 ms in single runs; the in-page test, without the GPU pass, is 0.2 ms); WP5's own heartbeat runs every 0.75 s at
  hp ≤ 1 while the HUD's visual beat is 0.9 s (lead: align `TUNE.hud.beat` or WP5's period after the merge).

## 10. Integration round 2 (merged-game findings, cluster `hud`)

- **Chevrons by the real screen edge (C3).** See §2: projector-based (behind / `|NDC x|` > 0.95 / below the bottom
  edge) instead of the fixed ±55° cone, which left threats 29–55° to the side on a portrait phone (hFOV 57.7°) and
  50–55° at FOV 100 off screen with no chevron while WP5 announced them as off-view. Removed / killed sources drop their
  chevron at once (was: up to 2.75 s pointing at nothing). Placement on `edgePoint` (the reticle's free-area ellipse).
- **Boss bar "Now!"** reads `boss.opening` (WP5's free-hit flag; the Shroom's and Frostbun's openings are state
  `recover`), not only `state === 'stunned'` (Pinch).
- **Touch `'cinema'` mode** (touch.js decides it from the `'play'` game.js sends): no buttons over cutscenes, fades, the
  boss intro or the ending.
- **Altar marker / objective** (C6, §2).
- **Settings:** the `hidden` flag for unconsumed keys (none hidden after the round-2 merge), device-first group order, Controls card pictograms per device (C17, §2).
- **Region card** fades when a fight starts around Pip (§3 `showBanner`).
- **Minimap centre:** the map, dots and N orbit are centred on the content box (`R = clientWidth / 2`, read in
  `Minimap.size`, a layout pass; the 5 u rim border had pushed everything +2.8 px at 1280×720 / +5.1 px at 1920 toward
  the lower right, up to 15° of bearing error on near markers).
- **Map card names** avoid each other as well as the marker badges (visited names first; a '???' with no free spot is
  left out); `mapCard.placed` lists where each went.
- **Phone CSS:** the landscape / portrait dialogue box sits inside the safe-area insets (`--sl` / `--sr`); menu tap
  targets ≥ 40 px tall on phones (tabs, segmented buttons, buttons; toggles and slider tracks get a 40 px hit area
  around the same drawing); the title's device line moved bottom-left, off the painted sword hand.
- **Part 2:** the Settings scroll cue (§2 C17; the View tab's Graphics rows were below the fold at 1280×720 with no sign
  of them); "Controller ready ✿" waits for play (`wp6-hud` `frameInput`: the first frame with `input.lastDevice === 'pad'`,
  `game.playing` and the HUD up, once per page visit; it was tied to `EV.DEVICE` while in play, and a pad picked up on the
  title emits that event only there, so the line never showed); the loading → title transition is the loading card fading
  over an already opaque title (§3 `showTitle`; the two layers used to cross-fade with both half transparent over the raw
  WebGL frame for ≈ 0.3 s); the title's device line got a soft dark chip (it had moved bottom-left in part 1).
  Found on the way (the `wp6-heavy` overlap audit flaked on it at 390×844, same on main): on a portrait phone the boss
  lower-third (132–258 px) covered the pickup feed's slot (232 px), so a feed line still up when an intro began sat on the
  boss's subtitle. `Notices.bossCard` sets `#ui.bosscard` while the card shows; `#ui.lay-port.bosscard #feed` fades out.
- **Tests (wp6):** "C9 speed lines" now drives a real dash (WP1 writes `view.speedFx` every frame, so setting it from the
  test proved nothing); new: chevrons at FOV 80 / 100 just inside / outside the edge and a removed attacker; altar
  objective + compass pill = objective line; boss "Now!" on `opening`; region card yields; touch `'cinema'` in a fade /
  HUD off / boss intro; minimap marker under the arrow (≤ 1 px) and the N inside the rim; map names never overlap;
  settings hidden keys and device-first order; Controls card touch pictograms. Part 2: "Controller ready" after a pad picked up
  outside play (not under talk / a menu, once); the Settings scroll cue (fade + chip on an overflowing tab, the chip
  scrolls, none on a tab that fits); portrait feed vs boss card.

## 11. Round 3 (verify and finish, cluster `hud`)

- **Minimap N badge at 1920×1080.** Its orbit was `R − 10` px whatever the HUD scale; the badge is 22 u wide, so above
  u ≈ 0.8 (1920×1080: u 1.12) its outer edge sat 2.4 px over the rim border (wp6 "minimap … the N badge orbits inside the
  rim" failed there). `Minimap.size` now sets `nr = R − badge width / 2 − 1.5` (the badge's `offsetWidth`, read in the
  same layout pass as `R`; the CSS ratio while hidden).
- **Settings rows the lead unhid** (§2 C17): their own Third person group right after the device's group and Sword,
  notes that say when they apply, "Mouse" → "Keyboard + mouse", and no keyboard + mouse rows on a touch-only screen.
- **Landscape phones:** the Settings / Controls card heading sits at the left end of the tab row (tabs right-aligned)
  instead of on a row of its own: on a 390 px screen Settings showed two rows at a time, now three to four.
- **Boss card vs Pip in third person** (§2 C15): measured at 1280×720, the card covered Pip's hood in every TP intro
  (all three bosses, both shoulders: 8 000–20 000 px² of overlap); flipped, 0.
- **HUD CPU test vs machine load.** The old test took the p95 of each of 3 runs and their median; at load 12–15 it read
  0.5 ms on the merged tree while the HUD's own cost was ≈ 0.04–0.1 ms per frame (preemption, GC and JIT left by earlier
  tests land on random frames). It now replays one deterministic 200-frame run (seeded random, same pose, enemies, input,
  petals, chevrons) 2 + 7 times and takes, per frame, the median over the 7 replays, then the p95 of those medians:
  noise that hits a frame in fewer than half of the replays drops out, a real regression costs the same in every replay
  and stays (the median and not the minimum: `performance.now` is clamped to 0.1 ms with jitter, so the minimum of a few
  readings reads up to a step low). Injected regressions at load ≈ 11: a forced layout per HUD frame → 0.8 ms (fails),
  +0.25 ms of work per frame → 0.4 ms (fails), +0.1 ms → 0.3 ms (passes, at the budget). In-suite at load 6–15 it read
  0.2–0.3 ms in 9 of 10 runs; the one failure (0.4 ms, 1920×1080, load 12–15) came from a run in which the whole `'all'`
  suite took 191 s instead of 70 s: a machine-wide slowdown raises every frame of every replay (median p50 0.3 ms) and
  cannot be told from a regression by timing alone.
- **Tests (wp6):** new "boss card (r3): in third person it never sits on Pip …"; the settings test checks the Third
  person group, the touch-only rule and the renamed group; the minimap test now passes at 1920×1080.

## 12. Round 4 (final gate)

- **Coach marks in any order** (`Coach.did`, `Coach.done(i)`): look degrees, walk metres and the first swing / roll / hop
  count from `start()` whatever step is on show (look and walk while the HUD is up and Pip free; the action events at any
  step); every frame the steps already done are skipped with one chime, so a player who did it all gets the flourish at
  once. `TUNE.hud.coachLook` 90 → 45°. (A tester turned 75°, walked 20 m, swung, hopped and rolled: the pill asked for the
  mouse for 25 s, then for a fresh 4 m walk.)
- **Hints and fights** (`Coach.pushHint` tags a hint `fight` when queued in a boss fight): in a fight only those show; a
  hint from before it (the portrait "turn sideways" tip) goes back to the queue whole and shows after. On a phone in FP
  the pill docks at the top band under the boss bar mid-fight (`place()`, as TP already did); `#coach` now stacks over
  `#worldmarks` and `#petals` (moved after them in `#hud`). Measured (`S/agents/r4-fix/fight.mjs`): portrait pill y 162–223
  (boss 298–509), landscape 75–136 (boss 95–265: the crown's tip), the reticle no longer over its text; sheets
  `fight-port-sheet.jpg`, `fight-land-sheet.jpg`.
- **FP dialogue portrait for a far speaker** (`ui.dlg.who`, `TUNE.hud.dlgFar` 3.5 m): Elder Shellby's opening is spoken
  from 7.6 m (a 60 px face) — the portrait now stays while the speaker is farther than that.
- **The press that closes a card is the card's** (`game.frame`: `input.consumeAll()` when `ui.menuInput` closed the
  menu): V / RB on the ending's "any button" also switched (and saved) the view; X swapped the shoulder.
- **Objective over the river** (`nav.js` `viaBridge`, `crossesRiver`; `TUNE.hud.viaStep` 1.5, `viaReach` 2): while the
  straight line to the next arena crosses the river and Pip is on the near side, the objective is that arena's bridge
  (id `via-<arena>`, text "… · Bridge to <boss>"): its near mouth, then its far mouth (within 2 m of the near one, or on
  the deck); past the river the arena. `navMarkers(W, S, out, obj)` adds the bridge marker (kind `via`, the arena's
  icon). A compass-only bot (`S/agents/r4-fix/compass.mjs peaks`, steering at the objective) reached Frostbun in 31 s
  over the bridge (was: 19 stuck events in the river, no arrival in 140 s).
- **Phones**: the Settings "more ▾" chip's hit area is the chip plus 12 px under it (was a −10 / −12 px ring over the
  visible bottom row: 23–41 % of "Medium" / "Large"); the Controls card on a landscape phone keeps 128 px for its heading
  and tightens its tabs under 620 px wide (568 × 320: "Controls" ran 20 px under "Keyboard + mouse"; now 31 px clear, one
  row). `S/agents/r4-fix/phone.mjs`, sheet `phone-sheet.jpg`.
- Tests (wp6, names start with `r4`): the press that closes a card; the boss card on the intro clock; the far-speaker
  portrait; hints in a boss fight; coach marks counted from the start; the headings never under a tab at this viewport;
  the chip's hit area; the objective over the river. The C6 test accepts the bridge objective as "a guardian".
