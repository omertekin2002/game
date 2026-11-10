// Boot: renderer, asset loading (with progress), world generation, scene assembly, title, fixed-step loop.
import * as THREE from 'three';
import { G, music, audioInit } from './core.js';
import { CFG } from './data.js';
import { loadAll } from './assets.js';
import { generateWorld } from './world.js';
import { buildTerrain, buildWater, buildMapCanvas } from './terrain.js';
import { Scenery } from './scatter.js';
import { Sky } from './sky.js';
import { FX } from './fx.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Enemy } from './entities.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8f0);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.3, 1400);
  camera.position.set(0, 20, 30);
  Object.assign(G, { renderer, scene, camera, THREE });

  await loadAll(renderer, (p) => ui.setLoading(p * 0.55, 'Gathering sparkles...'));
  ui.setLoading(0.6, 'Growing the island...');
  await nextFrame();
  const q = location.search.match(/[?&]seed=(\d+)/);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('starseed-isle-save-v2') || 'null'); } catch (e) { return null; } })();
  const seed = q ? +q[1] : (saved && saved.seed) || CFG.seed;
  const world = generateWorld(seed);
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
  const fx = new FX(scene);
  G.fx = fx;
  const cam = new CameraRig(camera);
  G.cam = cam;
  const input = new Input(canvas, uiRoot);
  G.input = input;
  ui.setMap(buildMapCanvas(world), world);
  const game = new Game({ renderer, scene, camera, cam, input, ui, fx, sky, world, scenery, terrain, waterMat: water.material });

  // warm shader programs (incl. enemy variants) so the first encounter doesn't hitch
  ui.setLoading(0.94, 'Brewing potions...');
  await nextFrame();
  game.player.place(world.spawn.x, world.spawn.z);
  cam.snap(game.player.pos);
  cam.update(0.016, game.player.pos, game.player.vel, null, false);
  sky.update(9.6, game.player.pos, camera, world.lamps, 0.016, 0);
  const warm = ['slime', 'mushroom', 'bat', 'bee', 'crab', 'snowpuff'].map((t) => new Enemy(t, world.spawn.x, world.spawn.z));
  try { await renderer.compileAsync(scene, camera); } catch (e) { try { renderer.compile(scene, camera); } catch (_) { /* ignore */ } }
  renderer.render(scene, camera);
  warm.forEach((e) => e.remove());

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const px = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    fx.setScale(px);
    game.halos.uScale.value = px;
  };
  window.addEventListener('resize', resize);
  resize();

  ui.setLoading(1, 'Ready!');
  await nextFrame();
  ui.hideLoading();
  const toTitle = () => {
    game.state = 'title';
    ui.showTitle(game.hasSave(), (a) => (a === 'continue' ? game.continueGame() : game.newGame()));
    music('title');
  };
  toTitle();
  window.addEventListener('pointerdown', () => audioInit(), { once: true });
  window.addEventListener('keydown', () => audioInit(), { once: true });
  window.addEventListener('beforeunload', () => game.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(true); });

  // ---------------------------------------------------------------- loop
  const STEP = 1 / 60;
  let last = performance.now(), acc = 0, fpsAcc = 0, fpsN = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(rawDt, 0.25);
    const t0 = performance.now();
    try {
      input.update();
      if (game.state === 'title') ui.titleInput(input);
      game.frame(dt, Math.min(rawDt, 0.1));
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 6) { game.step(STEP); acc -= STEP; steps++; }
      if (steps >= 6) acc = 0;
      game.render(acc / STEP, dt);
      fx.update(dt);
      if (game.state === 'play') renderer.render(scene, camera);
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
