# Starseed Isle

A cute, cosy open-world adventure for the browser, played in first person with an over-the-shoulder third-person view
(Three.js r187, vendored). The Great Tree has lost its three Starseeds to three grumpy guardians. Help Pip, a tiny kid in
a leaf-green fox-eared hood, explore Starseed Isle in any order, beat Grumble Shroom, Captain Pinch and Frostbun, and
bring the seeds home so the tree can bloom again.

**Play it:** https://omertekin2002.github.io/game/

## Run it

The game uses native ES modules and must be served over HTTP (opening `index.html` from disk does not work):

```sh
bun run start                 # runs tools/serve.mjs, a zero-dependency static server → http://localhost:8080/
# or
node tools/serve.mjs 8080
# or
python3 -m http.server 8080
```

No build step and no runtime dependencies. It needs a browser with WebGL2.

### Publishing (GitHub Pages)

`.github/workflows/pages.yml` publishes the game to https://omertekin2002.github.io/game/ on every push to `main`
(and on demand from the Actions tab via *Run workflow*). It runs `node tools/build-pages.mjs`, which copies only the
runtime files (`index.html`, `styles.css`, `manifest.webmanifest`, `js/`, `assets/`, `vendor/three/`) into `_site/` and
fails if a referenced file is missing or a path is root-absolute (`/assets/...`); the game is served from the `/game/`
subpath, so every path must stay relative. It then writes the service worker `_site/sw.js` (from
`tools/sw-template.js`, with a precache list of every site file and a version hashed from their contents), adds the
marker that lets `js/pwa.js` register it to `_site/index.html`, and fails if a web-manifest icon or a precache entry is
missing or root-absolute. It prints the precache size (about 25 MiB). Pull requests run the same build and checks
without deploying. The repo's Pages source must be set to **GitHub Actions**.

### Install / offline

The published game is an installable web app: Chrome, Edge and Android offer *Install*, and Safari offers *Add to
Home Screen*. It opens full screen with the starseed icon (`manifest.webmanifest`; the icons in `assets/ui/app-icon-*.png`
come from `node tools/make-app-icons.mjs`). After one online visit, the whole game is stored in the browser (about
25 MB), so it loads without a network, `?seed=` and the other URL flags included. A new deploy reaches players on
their next load at the latest. Only files that changed are downloaded again, and the old copy is deleted. Only the
Pages build has a service worker: `bun run start` and the tests never register one, so local development never serves
stale files. `?nosw=1` skips the service worker and removes an installed one with its stored files, as an escape hatch
if a bad version is stuck.

## Two views

First person is the default: you see through Pip's eyes, with his hands and sword at the lower right. Press **V** (pad
**RB**, touch **View**) at any time to switch to the third-person view over Pip's shoulder, and back. The view is a
setting, so it is remembered on this device; phones held upright start in third person. In third person, **X** swaps the
shoulder and the mouse wheel moves the camera closer or further.

Click the game to capture the mouse; **Esc** releases it and opens the pause menu, and Resume captures it again (when the
browser wants one more click, a "Click to play" veil asks for it). Without pointer lock (some browsers, `?nolock=1`),
hold the right mouse button and drag to look. Every on-screen hint shows the keys of
the device you used last.

## Controls

| Action | Keyboard + mouse | Gamepad | Touch |
| --- | --- | --- | --- |
| Look | mouse | right stick | drag the screen |
| Move | W A S D / arrow keys | left stick | floating stick on the left (right when left-handed) |
| Swing (3-hit combo, the third is a big chop) | left click / J | X / RT | Swing |
| Hop | Space | A | Hop |
| Roll · keep holding to sprint | Shift / K | B (L3 toggles sprint) | Roll (hold) |
| Talk / read / open (look at it first) | E / F / Enter | Y | Use (shows the verb) or a quick tap |
| Lock on | Q / middle click, or hold the right button | R3, or hold LT | Lock (near enemies) |
| Potion | R | LB / D-pad ↓ | Potion |
| First ↔ third person | V | RB / D-pad ↑ | View |
| Shoulder swap · camera distance (third person) | X · mouse wheel | D-pad ← → | — |
| Map (click it to drop a marker for the compass) | M / Tab | Back | Map |
| Pause (Resume, Settings, Controls, Map, Chat log, Save & Quit) | Esc / P | Start | Pause |
| Menus | ↑↓ choose · ←→ change · Enter / E / Space confirm · Esc back | stick / D-pad · A · B · LB / RB tabs | tap |

The keyboard keys above are the defaults. **Settings → Controls → Keys** rebinds the key of every action except Pause:
confirm a row, then press the new key (Esc cancels; a key another action uses swaps the two). The arrow keys, Enter, Esc /
P and the mouse buttons always keep working; K, F, Tab and Right Shift work only while their action keeps its default
key. Hints, prompts and the controls card show the keys you chose, and Reset on the Controls tab restores the defaults.

The gamepad buttons above are the defaults too. **Settings → Controls → Buttons** rebinds the button of every gameplay
action (Hop, Roll, Swing, Use, Potion, View, Swap shoulder, Lock on, Lock on while held, Sprint on / off, Map): confirm a
row, then press the new button (B or Start cancels, and so does Esc; a button another action uses swaps the two, so to
put an action on B, rebind the action that has B now). Start always pauses, and the menus, dialogue, the shop and the
map keep the standard layout whatever you bind: stick / D-pad move, A confirms, B goes back, LB / RB switch tabs. RT,
D-pad ↓, D-pad ↑ and D-pad → work only while Swing, Potion, View and Swap shoulder keep their default button. Reset on
the Controls tab restores the default buttons as well.

The compass at the top points at the next guardian (over the bridge first while the river lies between, or at the altar
by the Great Tree while you carry a Starseed), with the distance; that goal, your map marker and the Great Tree stay pinned at its edge while they are behind you. Red
chevrons at the screen edge warn of an attack winding up off screen. On touch the controls step aside during dialogue,
menus and cutscenes, and a tap anywhere continues.

## Settings worth knowing

Open Settings from the pause menu or the title.

- **View**: first or third person, field of view for each (first person 100°, third person 90° by default), crosshair
  style, HUD size, minimap (turns with you, north up, off), graphics quality and dynamic resolution.
- **Controls**: mouse, controller and touch sensitivity, mouse and controller inversion (up / down and left / right),
  "Arrow keys look around", the keyboard keys of every action (Keys), the controller buttons of every action (Buttons), left-handed touch
  buttons, swing assist, lock-on as press or hold, "Lock-on turns the camera", "Lock on to bosses by itself", and for
  third person "Camera drifts behind Pip" and "Pip faces where you look".
- **Sound**: music, effects and ambience volumes, mute.
- **Comfort**: "Motion comfort" (one switch for a calm camera: no head bob, roll or speed effects, softer shake, and
  dimmer full-screen flashes; on by default when your system asks for reduced motion), head bob, camera shake, speed
  effects, camera roll, "Look at whoever is talking", text speed.

## What's in the box

- A deterministic 360 m island: Sprout Village with the 19.8 m Great Tree, Whispering Woods (north), Frostcap Peaks
  (east), Sunny Shores (south) and Bloom Meadow (west), each with a landmark you can see over the trees.
- Six enemy types that always telegraph their attacks, three boss fights, six villagers, a shop, 14 chests (4 heart
  containers), a day / night cycle, positional sound, autosave.
- Two villager errands: once Captain Pinch is beaten, Clover asks Pip to find five rainbow shells on the Sunny Shores, and
  rewards him when he brings them back; after the bloom, Mayor Ribbit's parade has Pip lead him around Sprout Village
  past four paper lanterns, which light up as they pass and stay lit.
- Something to spend spare gems on: once the Heart Container and the Shiny Sword are sold, Miso stocks a plushie of each
  guardian Pip has beaten (80 gems each), and every one bought sits on her counter.
- Guardian rematches after the bloom: the three guardians nap in their arenas again. Walking in wakes nobody; aim at one
  and press Use (`Wake`) for a friendly but harder rematch: 1.25× HP, enraged sooner, the same moves. The first win
  against each gives 40 gems; no Starseed drops.
- Four landmark secrets: a small keepsake is tucked against each region landmark (a glowing acorn at Grumble's Crown, a
  humming crystal stone below the Summit Crystal Cairn, a message in a bottle at Pinch's Lighthouse, a seed pouch at the
  Meadow Windmill), on the side away from its path. Nothing points at them: each twinkles faintly only within 6 m. Use
  reads it like a sign and gives 25 gems, once. Digby drops a hint once the first Starseed is home.
- A completion tracker on the pause menu and the map card: chests opened, heart containers (the four heart chests and
  Miso's shop heart), guardians beaten, regions visited, Starseeds home, errands done, Miso's guardian plushies bought, guardian rematches won and landmark secrets found (0/4), each as found /
  total with a ✓ when full,
  plus an overall percentage (★ 100% when everything is found). Totals come from the island, so any `?seed=` counts
  its own chests.
- Art: 2D sprites and painted cards in `assets/`, GLB models listed in `assets/manifest.js`; anything missing falls back
  to a procedural version.

Design: `docs/DESIGN.md`. Code contract: `docs/ARCHITECTURE.md`, with per-area detail in `docs/wp/`.

## Tests

```sh
bun install
bun test             # unit tests: world generation, content tables, shop stock, save schema, completion tally, settings, key bindings, dynamic resolution
bun run test:smoke   # headless Chromium: New Game, completion tracker, Continue a valid / corrupt / newer save, stored settings, rebound keys and controller buttons (a stubbed pad), no service worker; fails on any error
bun run test:pwa     # headless Chromium on the Pages build under /game/: install, offline play (and ?seed=7), an update, ?nosw=1
bun run test:opening # headless Chromium, real input only: New Game, Shellby's intro, then look, walk and swing until the first-run coach marks are done; desktop (keyboard + mouse) and a portrait phone (taps, swipe, stick, Swing); checks the portrait objective line keeps "N m" whole; fails on any error
bun run test:playthrough  # headless Chromium: New Game → three guardians (Clover's shell errand after Captain Pinch) → Starseeds on the pedestal → ending → free roam → Ribbit's lantern parade → Miso's plushies bought through the shop → a guardian rematch (Wake with Use, win, dizzy reset, repeat win) → the four landmark keepsakes (one before the bloom) → Save & Quit, reload and Continue; fails on any error
bun run test:inpage [suite[:k/n] …]  # headless Chromium: the in-page suites (next section) by name (wp8:1/3: every third test from the first), or every non-heavy one with no names; one line per test, fails on any failing test or error
```

The browser tests need Playwright's Chromium once: `bunx playwright install chromium`. On failure they save a
screenshot to `test-results/` (the PWA test builds its site into `test-results/pwa-site/`). CI
(`.github/workflows/ci.yml`) runs all of them on pushes and pull requests, the in-page suites as one job per suite
(`wp1` … `wp9`, `wp2` and `wp8` in three shards each, plus `core` for the regular suites in `js/debug/tests.js`);
heavy suites stay out of CI.

`test:inpage` runs the in-page tests described in the next section, which also run by hand from the browser console.

## Debug and in-page tests

Add `?debug=1` to the URL (for example `http://localhost:8080/?debug=1`). Then <kbd>`</kbd> toggles the overlay (FPS,
draw calls, triangles, position, view), and while it is on: `1`–`5` teleport (village / woods / peaks / shores /
meadow), `G` +100 gems, `H` heal, `B` jump to the nearest unbeaten boss arena, `N` +3 hours, `C` collider gizmos.
Without `?debug=1` these keys do nothing.

| URL flag | Effect |
| --- | --- |
| `?debug=1` | debug overlay, debug keys, in-page tests |
| `?view=fp` / `?view=tp` | start in that view for this page load |
| `?seed=1234` | generate another island |
| `?nolock=1` | no pointer lock: drag to look |
| `?fixed=1` | manual clock: frames advance only through the debug API |
| `?noaudio=1` | silence every audio call |
| `?noassets=textures,models,hd,…` | pretend art is missing (sections, `hd`, `all` or single keys) |
| `?atmofog=0` | three.js's plain fog instead of the sky-coloured fog (comparison only) |
| `?nosw=1` | published build only: no service worker; removes an installed one and its stored files |

Console helpers live on `G.debug` (full list in `docs/ARCHITECTURE.md` §17), for example `teleport(x, z, yaw?, pitch?)`,
`pose('woods')`, `spawn('slime', 4, 0)`, `setTime(21)`, `toBoss('peaks')`, `killBoss()`, `giveSeeds()`,
`setView('tp')`, `cutscene('ending')`, `hud(false)`, `await perf()`, `info()`. To test the landmark secrets,
`standAt('secret', i)` puts Pip in front of keepsake `i` of `G.world.secrets` (0 acorn, 1 stone, 2 bottle, 3 pouch) aimed
at it, so Use reads it; `G.game.S.secrets` holds the ones found (the tracker's Secrets chip counts them).

In-page tests (`docs/ARCHITECTURE.md` §18) run in the page itself, with `?debug=1`, from the browser console:

```js
await G.debug.test.run('all')       // every regular suite; returns { pass, fail, ms, results }
await G.debug.test.run('wp6')       // one suite
await G.debug.test.list()           // suite names, test counts, which are heavy
```

`'all'` runs `smoke`, `look`, `feel-basic`, `combat-basic`, `interact-basic`, `save-migrate` and `wp1` … `wp9`. Heavy
suites run only by name: `probe`, `sweep`, `wp1-heavy`, `wp2-heavy`, `wp3-heavy`, `wp4-matrix`, `wp5-heavy`,
`wp6-heavy`, `wp7-hitch` (first thing in a fresh page), `wp7-sweep`, `wp8-perf`, `wp9-heavy`; the GPU ones are meant
for a 1920×1080 window. The tests restore your save and settings when they finish. A few timing checks (HUD frame time,
`wp7-hitch`, the viewmodel GPU time) can fail on a busy machine; rerun them on an idle one.
