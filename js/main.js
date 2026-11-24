// Boot: renderer, asset loading (with progress), world generation, scene assembly, title, fixed-step loop (clock.js).
import * as THREE from 'three';
import { G, audioInit, store } from './core.js';
import { CFG, SAVE_KEY } from './data.js';
import { loadSave } from './save.js';
import { loadAll, Assets } from './assets.js';
import { generateWorld } from './world.js';
import { attachPost } from './world-post.js';
import { buildTerrain, buildWater, buildMapCanvas } from './terrain.js';
import { Scenery } from './scatter.js';
import { Sky } from './sky.js';
import { FX } from './fx.js';
import { ViewController } from './view/view.js';
import { PointerLock } from './input-lock.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Clock } from './clock.js';
import { Enemy } from './entities.js';
import { settings } from './settings.js';
import { LAYER } from './util.js';
import { Boss } from './bosses.js';
import perfMod, { dprFor } from './perf/perf.js';
import { perf as TPerf } from './tune.js';
import { registerServiceWorker } from './pwa.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
let titleUp;
// the service worker registers once the title is up (?nosw=1 removes it right away, even if the boot then fails)
registerServiceWorker(new Promise((r) => { titleUp = r; }));

async function boot() {
  const canvas = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const ui = new UI(uiRoot);
  G.ui = ui;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    ui.setLoading(0, 'Oh no — this browser could not start WebGL2. Try a recent Chrome, Firefox or Safari.');
    throw e;
  }
  renderer.setPixelRatio(dprFor(settings.get('quality')));   // WP7: DPR cap per quality (auto 1.5, low 1, high 2); dynamic resolution scales the main pass (perf.js)
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8f0);
  const camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.08, TPerf.far);   // WP7: world far plane 300 m
  camera.position.set(0, 20, 30);
  Object.assign(G, { renderer, scene, camera, THREE });

  await loadAll(renderer, (p) => ui.setLoading(p * 0.55, 'Gathering sparkles...'));
  ui.setLoading(0.6, 'Growing the island...');
  await nextFrame();
  const q = location.search.match(/[?&]seed=(\d+)/);
  const saved = loadSave(store.get(SAVE_KEY), CFG.seed);
  const seed = q ? +q[1] : (saved && saved.seed) || CFG.seed;
  const world = generateWorld(seed);
  attachPost(world);   // post-pass solids (the reasons' scarf rock) join the colliders; prints and walk are unchanged
  G.world = world;
  if (G.debugOn) {
    console.log(`[Starseed] world generated in ${world.genMs.toFixed(0)} ms — props ${world.props.length}, deco ${world.deco.length}, carved ${world.carved}`);
    console.assert(world.unreachable.length === 0, '[Starseed] unreachable targets', world.unreachable);
  }
  ui.setLoading(0.72, 'Planting trees...');
  await nextFrame();
  const terrain = buildTerrain(world, scene);
  const water = buildWater(world, scene);
  const scenery = new Scenery(world, scene);
  scenery.build();
  G.scenery = scenery;
  ui.setLoading(0.85, 'Waking the villagers...');
  await nextFrame();
  const sky = new Sky(scene);
  G.sky = sky;
  sky.sun.shadow.camera.layers.enable(LAYER.BODY); // Pip's body is invisible to the FP camera but always casts
  const fx = new FX(scene);
  G.fx = fx;
  const query = location.search;
  const lock = new PointerLock(canvas, { nolock: /[?&]nolock=1/.test(query), raw: () => settings.get('rawInput') });
  G.lock = lock;
  const input = new Input(canvas, uiRoot, lock);
  G.input = input;
  const view = new ViewController({ camera, renderer, settings });
  ui.setMap(buildMapCanvas(world), world);
  const clock = new Clock();
  clock.manual = /[?&]fixed=1/.test(query);
  G.clock = clock;
  const game = new Game({ renderer, scene, camera, view, lock, input, ui, fx, sky, world, scenery, terrain, waterMat: water.material, clock });
  // view mode: ?view=fp|tp overrides for this page load only; otherwise the setting (FP; portrait phones TP)
  const qv = query.match(/[?&]view=(fp|tp)\b/);
  view.setMode(qv ? qv[1] : settings.get('view'), { instant: true });

  // warm shader programs (incl. enemy variants) so the first encounter doesn't hitch
  // WP7: the Game starts in 'title'; until game.showTitle() below the boot is still running (and yields to the browser
  // for the loading bar), so anything that waits for the title (test drivers, newGame) must not see it yet
  game.state = 'boot';
  ui.setLoading(0.94, 'Brewing potions...');
  await nextFrame();
  game.player.place(world.spawn.x, world.spawn.z);
  view.snap();
  game.player.render(1, 0.016, 0);
  view.update(1, 0.016);
  sky.update(9.6, game.player.pos, camera, world.lamps, 0.016, 0);
  const warm = ['slime', 'mushroom', 'bat', 'bee', 'crab', 'snowpuff'].map((t) => new Enemy(t, world.spawn.x, world.spawn.z));
  const warmBoss = [];   // WP7: boss models compile here, not at the first boss in view
  for (const id of ['woods', 'peaks', 'shores']) { try { if (world.arenas[id]) warmBoss.push(new Boss(id, world.arenas[id])); } catch (e) { /* optional */ } }
  const sp = world.spawn, gy = world.ground(sp.x, sp.z), warmFx = [];
  // one of every ground telegraph / pop-up WP5 makes during play (each is a material made per use and disposed by its
  // owner, so without a kept copy its program is released and compiled again at every first sight: the '!' alert,
  // glint and aura sprites, the crack decal, the zone (+ rim + pillar) and the stripe)
  for (const f of [() => fx.ground.shockwave(sp.x, gy, sp.z), () => fx.ground.disc(sp.x, gy, sp.z, 1), () => fx.ground.line(sp.x, gy, sp.z, 0, 2, 1),
    () => fx.ground.crack(sp.x, gy, sp.z, 2), () => fx.ground.alert({ x: sp.x, y: gy, z: sp.z }, 1), () => fx.ground.glint(sp.x, gy + 1, sp.z),
    () => fx.ground.aura({ x: sp.x, y: gy, z: sp.z }), () => fx.ground.zone(sp.x, gy, sp.z, 2), () => fx.ground.stripe(sp.x, gy, sp.z, 0, 3, 1)]) {
    try { warmFx.push(f()); } catch (e) { /* optional */ }
  }
  // r3: WP3's footprint mesh is built on the first print on sand / snow; built now, so the warm-up compiles its programs
  // (both light sets: the first print, and the first one at night, compiled during play)
  for (const m of game.modules || []) if (m && typeof m.printMesh === 'function') { try { m.printMesh(); } catch (e) { /* optional */ } }
  const mask = camera.layers.mask;
  // WP7: day + night light sets, every mesh drawn once with every layer on (programs, uploads, shadow variants); the loading
  // bar moves between the two sets
  await perfMod.warmup(renderer, scene, camera, async () => { ui.setLoading(0.97, 'Brewing potions...'); await nextFrame(); });
  // WP7: the owners' own teardown (whatever they added, they remove), with their materials kept undisposed so the warmed
  // programs stay alive (the slime's see-through body and the ground telegraphs would recompile at every first sight)
  perfMod.keepPrograms(() => {
    for (const e of warm) e.remove();
    for (const b of warmBoss) b.remove();
    for (const it of warmFx) if (it) fx.ground.remove(it);
  });
  // the last boot frame stays on the canvas behind the fading title (nothing draws there): redraw it with the view's own
  // layers, so it shows the plaza from Pip's eye and not the inside of his hood
  camera.layers.mask = mask;
  renderer.render(scene, camera);

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    view.onResize(w, h); // aspect, Hor+ FOV, particle + halo pixel scale
    game.onResize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  ui.setLoading(1, 'Ready!');
  await nextFrame();
  ui.hideLoading();
  game.showTitle();
  const deferred = Assets.loadDeferred();   // HD / deferred textures after the title is up (Assets.onTex listeners swap them in)
  // the Pages build's service worker (js/pwa.js) precaches the whole site for offline play: it registers once the deferred
  // textures are in (or after 10 s), so it does not compete with them, and mostly reads what the boot already fetched
  Promise.race([deferred, new Promise((r) => setTimeout(r, 10000))]).then(titleUp);
  window.addEventListener('pointerdown', () => audioInit(), { once: true });
  window.addEventListener('keydown', () => audioInit(), { once: true });
  window.addEventListener('beforeunload', () => game.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(true); });

  // ---------------------------------------------------------------- loop
  // renderer.info sums every pass of a frame (shadow + main + later the viewmodel pass). It is reset just before
  // the first pass, so the overlay (drawn in game.render) shows the previous frame's total.
  renderer.info.autoReset = false;
  // draw = false runs every render-side update but skips the GPU passes (long scripted G.debug.advance runs)
  const renderFrame = (alpha, dt, draw = true) => {
    game.render(alpha, dt);
    fx.update(dt);
    if (!draw) return;
    renderer.info.reset();
    if (game.state !== 'play') return;         // the title draws nothing (modules' afterRender only follows a main pass)
    const gt = game.gpuT;                      // GPU timer, only while G.debug.perf() samples (main = shadow + world)
    if (gt) gt.begin('main');
    renderer.render(scene, camera);
    if (gt) gt.end('main');
    game.afterRender(dt);
  };
  clock.stepFn = (dt) => game.step(dt);
  clock.renderFn = renderFrame;
  // one frame: snap/accumulate → input → frame (look first, modal routing) → fixed steps → render.
  // force runs the steps even with the manual clock (G.debug.advance drives whole frames through here)
  const runFrame = (rawDt, force = false, draw = true) => {
    const dt = clock.frame(rawDt, force);
    input.update(dt);
    if (game.state === 'title') ui.titleInput(input);
    game.frame(dt, Math.min(rawDt, clock.MAX_DT));
    clock.run();
    renderFrame(clock.alpha, dt, draw);
    return dt;
  };
  game.runFrame = runFrame;
  // manual clock (G.debug.manual / clock({ manual }) / ?fixed=1): rAF runs no frames at all (no input, look, view
  // blends, shots, fades, dialogue or steps), so tests are deterministic; it only redraws the last frame
  const redraw = () => {
    if (game.state !== 'play') return;
    renderer.info.reset();
    renderer.render(scene, camera);
    game.afterRender(0);
  };
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  // (the first reading needs 0.5 s of frames, and a software-WebGL frame can take seconds: until then 0, so the test
  // surface (RULINGS §2.4: G.game.fps is a number) holds from boot, #58)
  game.fps = 0; game.frameMs = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = Math.max(0, (now - last) / 1000);
    last = now;
    const t0 = performance.now();
    try {
      if (clock.manual) { if (clock.redraw) redraw(); }
      else runFrame(rawDt);
    } catch (e) {
      if (!loop.errs) loop.errs = 0;
      if (loop.errs++ < 8) console.error('[Starseed]', e);
    }
    fpsAcc += rawDt; fpsN++;
    if (fpsAcc > 0.5) { game.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    game.frameMs = performance.now() - t0;
  }
  requestAnimationFrame(loop);
}

boot().catch((e) => {
  console.error('[Starseed] boot failed', e);
  const ls = document.querySelector('#loading .ls');
  if (ls) ls.textContent = 'Something went wrong while growing the island: ' + (e && e.message ? e.message : e);
});
