# Starseed Isle

A cute, cozy, open-world **3D** action-adventure for the browser (Three.js r187, vendored).
The Great Tree has lost its three **Starseeds** to three grumpy guardians. Help **Pip** — a tiny kid in a
leaf-green fox-eared hood — explore Starseed Isle in any order, beat Grumble Shroom, Captain Pinch and
Frostbun, and bring the seeds home so the tree can bloom again.

## Run it

The game uses native ES modules and must be served over HTTP (opening `index.html` from disk will not work):

```sh
bun run start        # zero-dependency static server (tools/serve.mjs) → http://localhost:8080/
# or
python3 -m http.server 8080
```

No build step and no runtime dependencies. Works in recent Chrome, Edge, Firefox and Safari (WebGL2).

## Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| Move | WASD / arrow keys | left stick / d-pad |
| Sword | J / Space / left click | A |
| Dash-roll (i-frames) | K / Shift | B |
| Talk / open / read | F / Enter (or sword when a "!" is shown) | X |
| Potion | R | Y |
| Camera orbit | Q / E, right-drag; mouse wheel to zoom | right stick, LB / RB |
| Map | M / Tab | Back |
| Pause | Esc / P | Start |

Touch devices get a virtual stick, A/B buttons and drag-to-orbit.

## What's in the box

- Deterministic 360 m island (fixed seed): Sprout Village, Whispering Woods, Frostcap Peaks, Sunny Shores and
  Bloom Meadow, with a river, ponds, bridges, islets, dirt paths and a reachability check (BFS + carving).
- Toon-ramp shading, inverted-hull outlines, see-through dithering for anything hiding Pip, animated water with
  shore foam, swaying grass, day/night cycle with lamps and fireflies, per-region ambient particles.
- Six enemy types, three boss fights, six villagers, a shop, 14 chests (4 heart containers), autosave.
- Art: 2D sprites in `assets/sprites/` drive the UI and the procedural 3D models; GLB models listed in
  `assets/manifest.js` (`models`) are used automatically when present.

## Debug

Add `?debug=1` (or press <kbd>`</kbd>): FPS / draw calls / triangles overlay, `1`–`5` teleport
(village / woods / peaks / shores / meadow), `G` +100 gems, `H` heal, `B` jump to the nearest unbeaten boss
arena, `N` +3 h, `C` collider gizmos. Console helpers: `G.debug.teleport(x, z)`, `G.debug.giveSeeds()`,
`G.debug.setTime(h)`, `G.debug.killBoss()`, `G.debug.spawn(type)`, `G.debug.info()`.
Add `?seed=1234` to generate a different island.
