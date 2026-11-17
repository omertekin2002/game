// WP9 in-page suites (registered by js/debug/tests.js; only loaded with ?debug=1): world and content at eye level.
//   wp9        contracts (C6 anchors, C10 cull tags), layout invariants (reachability, lamps, coin chests, landmarks),
//              colliders that match what the eye sees (tree roots, altar), old-save repair, signs, text, village props
//   wp9-heavy  the Great Tree crown line of sight (world mapper's metric), landmark skylines, world-gen time (cold boot
//              and warm), carving on other seeds, the package's draw calls / triangles per view (module objects on vs off)
//              and the whole scene against the foundation's numbers per view
import { NPCS, SIGNS, DOOR_LINES, SAVE_KEY } from '../../data.js';
import { world as TW } from '../../tune.js';
import { propModel, ALTAR, WELL, HOUSE_WINDOWS, SHOP_COUNTER, landmarkParts, shopModel } from '../../props.js';
import { store } from '../../core.js';
import { yawOf, wrapAngle, len2, angDiff } from '../../util.js';

// the foundation's main pass at the 9 debug poses × 4 directions (FP, noon, enemies hidden, 16:9): [calls, triangles]
const FND_VIEW = { 'village-0': [397, 2791756], 'village-1': [324, 2254566], 'village-2': [316, 1607988], 'village-3': [329, 1531124], 'woods-0': [169, 1708008], 'woods-1': [296, 2474646], 'woods-2': [577, 3118494], 'woods-3': [292, 1697460], 'peaks-0': [281, 1762060], 'peaks-1': [565, 3397792], 'peaks-2': [312, 1163380], 'peaks-3': [128, 400442], 'shores-0': [643, 3827468], 'shores-1': [251, 1716148], 'shores-2': [149, 811276], 'shores-3': [226, 993792], 'meadow-0': [268, 2442148], 'meadow-1': [111, 828334], 'meadow-2': [253, 1570920], 'meadow-3': [658, 3721936], 'hilltop-0': [373, 2198478], 'hilltop-1': [610, 3291758], 'hilltop-2': [189, 729716], 'hilltop-3': [89, 255800], 'arena-woods-0': [90, 1081788], 'arena-woods-1': [259, 2356942], 'arena-woods-2': [718, 3964218], 'arena-woods-3': [235, 1601736], 'arena-peaks-0': [63, 322066], 'arena-peaks-1': [220, 1464270], 'arena-peaks-2': [695, 3873074], 'arena-peaks-3': [246, 902860], 'arena-shores-0': [65, 453548], 'arena-shores-1': [191, 757408], 'arena-shores-2': [767, 4126150], 'arena-shores-3': [153, 927892] };
// the same with ?noassets=all (procedural fallbacks for every model)
const FND_VIEW_NA = { 'village-0': [423, 2713172], 'village-1': [346, 2204886], 'village-2': [337, 1559776], 'village-3': [359, 1468596], 'woods-0': [184, 1683220], 'woods-1': [301, 2467818], 'woods-2': [613, 3052842], 'woods-3': [307, 1678356], 'peaks-0': [296, 1737272], 'peaks-1': [587, 3347512], 'peaks-2': [325, 1136436], 'peaks-3': [143, 381338], 'shores-0': [681, 3742164], 'shores-1': [252, 1704532], 'shores-2': [158, 779544], 'shores-3': [237, 969900], 'meadow-0': [283, 2417360], 'meadow-1': [116, 821506], 'meadow-2': [266, 1543976], 'meadow-3': [694, 3638240], 'hilltop-0': [398, 2161414], 'hilltop-1': [636, 3242486], 'hilltop-2': [202, 702772], 'hilltop-3': [94, 248972], 'arena-woods-0': [110, 1048994], 'arena-woods-1': [269, 2342108], 'arena-woods-2': [755, 3867304], 'arena-woods-3': [255, 1574626], 'arena-peaks-0': [83, 298048], 'arena-peaks-1': [240, 1434568], 'arena-peaks-2': [732, 3799920], 'arena-peaks-3': [264, 871002], 'arena-shores-0': [82, 417070], 'arena-shores-1': [210, 728770], 'arena-shores-2': [813, 4036100], 'arena-shores-3': [162, 911530] };
// every 12th main-stream prop the foundation placed for seed 7151 (type letter, x, z): the scatter shadow keeps them
const FND_PROPS = 'o-7.110,-98.268 m-37.600,140.500 p-36.722,-78.140 p9.636,-130.956 r19.537,-123.576 p-39.462,-120.056 r-23.218,-116.368 r32.812,-112.972 p56.516,-111.189 r-49.323,-106.027 p35.606,-106.413 p33.791,-104.157 r-25.461,-102.899 p-63.889,-100.428 p42.284,-99.496 r10.307,-97.921 r-60.356,-96.997 r21.899,-95.677 r-29.364,-94.369 b-54.453,-91.459 p35.433,-91.074 r-24.869,-90.119 b91.373,-88.905 r39.060,-87.238 r-20.350,-85.839 p81.836,-85.137 r-6.244,-84.282 t-22.602,-82.089 r61.590,-80.915 r-11.808,-79.771 r-52.878,-77.200 p75.232,-77.891 p59.739,-75.046 p55.234,-73.659 b25.721,-70.617 b-87.694,-68.390 p53.013,-69.428 r-15.584,-67.242 r83.822,-65.913 r-21.197,-64.154 r64.304,-64.209 k-19.217,-62.568 p88.230,-62.473 p22.263,-59.842 p-24.905,-59.028 r-59.789,-56.035 r24.333,-56.777 p-34.315,-54.519 k94.240,-54.566 k-24.886,-51.689 s96.539,-51.815 k-26.251,-49.590 k36.656,-49.184 r-37.031,-47.452 b-72.612,-46.469 p-64.060,-43.078 r41.050,-44.196 p15.716,-42.322 p-35.950,-40.053 s99.109,-39.220 r34.849,-36.461 p-15.976,-35.615 p-20.186,-33.373 r-80.621,-31.065 r-50.429,-28.206 k95.290,-29.516 r-112.650,-24.359 k25.171,-22.371 p35.581,-19.638 k-70.528,-15.706 r-57.422,-12.604 b-27.486,-10.159 p59.126,-7.189 r-108.451,-1.488 r-97.672,0.527 k-95.698,5.341 p116.187,5.908 k66.062,11.183 s75.629,12.562 k77.358,14.583 k60.931,16.990 k59.871,19.717 k89.020,20.955 p66.033,23.260 b-55.675,28.606 k106.102,30.450 k101.876,31.181 o-77.041,36.889 r38.129,37.518 r18.134,39.556 s82.983,42.222 k74.182,44.580 o55.431,45.920 b-106.328,51.495 s89.463,53.285 p108.422,54.568 r-88.383,58.504 m-43.264,60.596 p45.170,63.787 r-94.197,67.642 r-16.476,69.514 b-78.911,74.293 p38.307,76.612 m-58.956,80.467 m72.314,84.602 k-41.479,89.187 k-12.128,93.352 r-0.279,96.574 m36.809,101.515 m-36.913,109.817 m-6.623,120.598';
const FND_T = { r: 'tree_round', p: 'tree_pine', s: 'tree_snow', m: 'tree_palm', b: 'bush', k: 'rock', o: 'boulder', t: 'stump' };
const POSES = ['village', 'woods', 'peaks', 'shores', 'meadow', 'hilltop', 'arena-woods', 'arena-peaks', 'arena-shores'];
/** main-pass draw calls / triangles at every pose × 4 directions with enemies hidden (no sim step: no boss wakes) */
function viewCosts(G, game, D, set) {
  const r = game.renderer, rows = {}, hid = game.enemies.filter((e) => e.root && e.root.visible);
  hid.forEach((e) => { e.root.visible = false; });
  try {
    for (const name of POSES) for (let k = 0; k < 4; k++) {
      D.pose(name); D.look(G.view.yaw + (k * Math.PI) / 2, 0); game.render(1, 0);
      const m = () => { r.info.autoReset = false; r.info.reset(); r.render(game.scene, game.camera); r.info.autoReset = true; return [r.info.render.calls, r.info.render.triangles]; };
      if (!set) { rows[name + '-' + k] = m(); continue; }
      set(true); const on = m(); set(false); const off = m(); set(true);
      rows[name + '-' + k] = [on[0] - off[0], on[1] - off[1], on[0]];
    }
  } finally { hid.forEach((e) => { e.root.visible = true; }); }
  return rows;
}
/** the fraction of Miso's face band (0.62–0.95 of her height) that reaches the screen: render the scene, the scene
 *  without her and her alone into a small target and count her pixels that the scene lets through */
async function misoFace(t, dist) {
  const { game, D, THREE } = t, r = game.renderer, cam = game.camera, m = game.npcs.find((n) => n.id === 'miso'), s = game.world.shop, w = 320, h = 180;
  D.teleport(m.pos.x + Math.sin(s.rot) * dist, m.pos.z + Math.cos(s.rot) * dist); D.lookAt(m.pos.x, m.pos.y + 0.8, m.pos.z);
  t.frames(2); game.render(1, 0);
  const rt = new THREE.WebGLRenderTarget(w, h);
  // async readback where the renderer has it (no GPU stall warning), else the synchronous one
  const grab = async () => {
    const b = new Uint8Array(w * h * 4);
    r.setRenderTarget(rt); r.clear(); r.render(game.scene, cam); r.setRenderTarget(null);
    if (r.readRenderTargetPixelsAsync) await r.readRenderTargetPixelsAsync(rt, 0, 0, w, h, b); else r.readRenderTargetPixels(rt, 0, 0, w, h, b);
    return b;
  };
  const layers = [], keep = cam.layers.mask;
  try {
    const A = await grab(); m.root.visible = false; const B = await grab(); m.root.visible = true;
    m.root.traverse((o) => { layers.push([o, o.layers.mask]); o.layers.set(7); });
    cam.layers.set(7); const C = await grab(); cam.layers.set(6); const E = await grab(); cam.layers.mask = keep;
    layers.forEach(([o, k]) => { o.layers.mask = k; }); layers.length = 0;
    const row = (y) => (new THREE.Vector3(m.pos.x, y, m.pos.z).project(cam).y * 0.5 + 0.5) * h;
    const r0 = Math.max(0, Math.floor(row(m.pos.y + m.height * 0.62))), r1 = Math.min(h - 1, Math.ceil(row(m.pos.y + m.height * 0.95)));
    let n = 0, vis = 0;
    for (let y = r0; y <= r1; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, diff = (P, Q) => Math.abs(P[k] - Q[k]) + Math.abs(P[k + 1] - Q[k + 1]) + Math.abs(P[k + 2] - Q[k + 2]);
      if (diff(C, E) < 12) continue;
      n++; if (diff(A, B) >= 12) vis++;
    }
    return { n, vis: +(vis / Math.max(1, n)).toFixed(3) };
  } finally { m.root.visible = true; cam.layers.mask = keep; layers.forEach(([o, k]) => { o.layers.mask = k; }); rt.dispose(); }
}

/** solid props whose edge is within `pad` m of a bridge's deck end (where Pip walks on): a wedge with the rail end post */
function mouthSolids(W, pad = 1.5) {
  const out = [];
  for (const [i, b] of W.bridges.entries()) for (const [ex, ez] of [[b.ax, b.az], [b.bx, b.bz]]) {
    for (const p of W.props) if (p.solid && !p.removed && len2(p.x - ex, p.z - ez) - p.r < pad) out.push({ bridge: i, id: b.id, type: p.type, x: +p.x.toFixed(2), z: +p.z.toFixed(2), gap: +(len2(p.x - ex, p.z - ez) - p.r).toFixed(2) });
  }
  return out;
}
/** per-face stripe check on a built geometry: the triangles `pick(cx, cy, cz, ny, area)` selects whose colour is one of `cols`
 *  are grouped by `band(cx, cy, cz)`; returns { bands: [{ i, n, major }], mixed (triangles with more than one colour) } */
function stripeBands(THREE, geo, pick, band, cols) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color, C = cols.map((h) => new THREE.Color(h));
  const same = (k, q) => Math.abs(c.getX(k) - q.r) + Math.abs(c.getY(k) - q.g) + Math.abs(c.getZ(k) - q.b) < 3e-3;
  const by = new Map();
  let mixed = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const ux = p.getX(i + 1) - p.getX(i), uy = p.getY(i + 1) - p.getY(i), uz = p.getZ(i + 1) - p.getZ(i), vx = p.getX(i + 2) - p.getX(i), vy = p.getY(i + 2) - p.getY(i), vz = p.getZ(i + 2) - p.getZ(i);
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!pick(cx, cy, cz, n.getY(i), area)) continue;
    const k = C.findIndex((q) => same(i, q));
    if (k < 0) continue;
    if (!same(i + 1, C[k]) || !same(i + 2, C[k])) mixed++;
    const b = band(cx, cy, cz), e = by.get(b) || [0, 0];
    e[k]++; by.set(b, e);
  }
  const bands = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([i, e]) => ({ i, n: e[0] + e[1], major: e[0] >= e[1] ? 0 : 1 }));
  return { bands, mixed };
}

const TOKENS = ['move', 'look', 'attack', 'jump', 'dash', 'sprint', 'interact', 'potion', 'view', 'shoulder', 'lock', 'map', 'pause'];
const wp9 = (G) => G.game.modules.find((m) => m && m.name === 'wp9-world');
/** every player-facing string WP9 owns (NPC lines in several save states, signs, doors, world.js interact lines) */
function allText(W) {
  const out = [];
  const states = [
    { seeds: { woods: 0, peaks: 0, shores: 0 }, bosses: {}, chests: {}, ending: false },
    { seeds: { woods: 1, peaks: 0, shores: 0 }, bosses: { woods: true }, chests: {}, ending: false },
    { seeds: { woods: 2, peaks: 1, shores: 0 }, bosses: { woods: true, peaks: true }, chests: { hc_meadow: true }, ending: false },
    { seeds: { woods: 2, peaks: 2, shores: 2 }, bosses: { woods: true, peaks: true, shores: true }, chests: {}, ending: true },
  ];
  for (const n of NPCS) { if (n.intro) out.push(...n.intro); for (const S of states) out.push(...n.lines(S)); }
  for (const k in SIGNS) out.push(...SIGNS[k]);
  out.push(...DOOR_LINES);
  for (const it of W.interact) if (it.lines) out.push(...it.lines);
  return out;
}

export default function register(suite) {
  suite('wp9', [
    ['C6 anchors: W.pedestal, W.greatTree, W.landmarks, W.shots; old fields keep their shape', (t) => {
      const { W } = t, P = W.pedestal, T = W.greatTree, fin = (...a) => a.every(Number.isFinite);
      t.ok(fin(P.x, P.z, P.y, P.top) && Math.abs(P.top - 1.05) < 1e-9, 'W.pedestal { x, z, y, top = 1.05 }', P);
      t.near(P.y, W.ground(P.x, P.z), 1e-6, 'pedestal y = ground');
      t.ok(Array.isArray(P.sockets) && P.sockets.length === 3 && P.sockets.every((s) => fin(s.x, s.y, s.z) && Math.abs(s.y - P.y - P.top) < 1e-6), 'three sockets on the slab', P.sockets);
      t.ok(fin(T.x, T.z, T.height, T.scaleHeight) && Math.abs(T.scaleHeight - 19.8) < 0.05 && Math.abs(T.height - 19.8) < 0.05, 'W.greatTree { x, z, height, scaleHeight ≈ 19.8 }', T);
      t.near(t.game.scenery.greatTree.height, T.scaleHeight, 0.05, 'built tree height');
      const ids = (W.landmarks || []).map((L) => L.id).sort().join(',');
      t.eq(ids, 'great_tree,meadow,peaks,shores,woods', 'landmark ids');
      t.ok(W.landmarks.every((L) => typeof L.name === 'string' && L.name && ['village', 'woods', 'peaks', 'shores', 'meadow'].includes(L.region) && fin(L.x, L.z, L.height) && L.height >= 12), 'landmark rows { id, name, region, x, z, height ≥ 12 }');
      const sh = W.shots || {}, v3 = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
      t.ok(['place', 'ending'].every((k) => sh[k] && v3(sh[k].pos) && v3(sh[k].look)), 'W.shots.place / ending { pos, look }', sh);
      t.ok(['woods', 'peaks', 'shores'].every((k) => sh.bossIntro && sh.bossIntro[k] && v3(sh.bossIntro[k].pos)), 'W.shots.bossIntro per arena');
      t.ok(fin(W.spawn.x, W.spawn.z) && fin(W.plaza.x, W.plaza.z, W.plaza.r, W.plaza.h) && W.shop && fin(W.shop.x, W.shop.z, W.shop.rot), 'spawn / plaza / shop shapes');
      t.ok(W.lamps.every((l) => fin(l.x, l.z, l.y, l.rot)) && ['woods', 'peaks', 'shores'].every((k) => fin(W.arenas[k].x, W.arenas[k].z, W.arenas[k].r, W.arenas[k].entAng)), 'lamps / arenas shapes');
      t.ok(W.plazaMask instanceof Float32Array && W.plazaMask.length === 361 * 361, 'W.plazaMask (N×N) for the cobble splat');
    }],
    ['generation: reachable, deterministic, carved 0, chest ids stable and hidden 8–40 m off-path', (t) => {
      const { W } = t;
      t.eq(W.unreachable.length, 0, 'unreachable');
      t.note('genMs', +W.genMs.toFixed(1)); t.note('genT', W.genT); t.note('carved', W.carved);
      t.eq(W.carved, 0, 'carved corridors');
      const ids = W.chests.map((c) => c.id);
      for (const id of ['hc_meadow', 'hc_shores', 'hc_peaks', 'hc_woods'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => 'coin_' + i))) t.ok(ids.includes(id), 'chest id ' + id);
      const coins = W.chests.filter((c) => c.kind === 'coins'), [lo, hi] = TW.coinPathD;
      const pd = coins.map((c) => +W.pathFAt(c.x, c.z).toFixed(2));
      t.note('coinPathD', pd); t.note('coinVisible', (W.coinPicks || []).map((c) => c.visible));
      t.ok(pd.every((d) => d >= lo && d <= hi), 'coin chests ' + lo + '–' + hi + ' m from a path', pd);
      t.ok(W.lamps.filter((l) => W.bridgeAt(l.x, l.z) !== null).length === 0, 'no lamp on a bridge');
      t.ok(W.lamps.length >= 16, 'lamps ' + W.lamps.length);
      // the scatter shadow: the foundation's props stay exactly where they were (type, position) for the shipping seed
      if (W.seed === 7151) {
        const have = new Set(W.props.filter((p) => !p.removed).map((p) => p.type + '@' + p.x.toFixed(3) + ',' + p.z.toFixed(3)));
        const smp = FND_PROPS.split(' ').map((q) => { const [x, z] = q.slice(1).split(','); return FND_T[q[0]] + '@' + x + ',' + z; });
        const kept = smp.filter((k) => have.has(k)).length;
        t.note('foundationKept', kept + '/' + smp.length);
        t.ok(kept >= smp.length * 0.88, 'foundation props kept in place (seed 7151 sample)', kept + '/' + smp.length);
      } else t.note('foundationKept', 'only checked for seed 7151');
      // the same seed gives the same world (a fresh generation in the page)
      const sig = (w) => [w.props.length, w.deco.length, w.chests.map((c) => c.id + ':' + c.x.toFixed(3)).join('|'), w.landmarks.map((L) => L.x.toFixed(3)).join('|'), w.H[50000].toFixed(5)].join('#');
      return import('../../world.js').then((m) => { const W2 = m.generateWorld(W.seed); t.eq(sig(W2), sig(W), 'deterministic for the seed'); });
    }],
    ['landmarks: one per region, solid (declared colliders), never culled (C10), over the canopy', (t) => {
      const { W, G } = t, mod = wp9(G), objs = mod && mod.landmarkObjs;
      for (const L of W.landmarks.filter((q) => q.id !== 'great_tree')) {
        const p = L.prop;
        t.ok(p && p.solid && p.collider && p.collider.h === L.height && W.colliders.some((c) => c.prop === p), L.id + ' declared collider', p && p.collider);
        const o = objs && objs[L.id];
        t.ok(o && o.userData.cull && o.userData.cull.dist === Infinity && o.userData.landmark === L.id, L.id + ' userData.cull.dist = Infinity');
        const want = ['village', 'woods', 'peaks', 'shores', 'meadow'].indexOf(L.region);
        t.ok(L.height >= 12 && W.regionAt(L.x, L.z) === want, L.id + ' stands in its region', { h: L.height, reg: W.regionAt(L.x, L.z) });
      }
      // the woods mushroom and the lighthouse keep out of the boss's silhouette in both intro views (W.shots and the
      // entrance itself); same rule world.js places them by
      for (const [id, min] of [['woods', 0.42], ['shores', 0.6]]) {
        const L = W.landmarks.find((q) => q.id === id), off = W.introOff(W.arenas[id])(L.x, L.z);
        t.ok(off >= min - 1e-6, id + ' landmark is ' + off.toFixed(2) + ' rad off the boss in the intro views (≥ ' + min + ')');
      }
      // Clover's hint ("the cove is at the very end of this path, just past the striped lighthouse") matches the layout:
      // from her spot both lie ahead within 40°, the lighthouse nearer, and the lighthouse stands by the shores path
      const c = W.npcSpots.clover, lh = W.landmarks.find((q) => q.id === 'shores'), cove = W.arenas.shores;
      const bl = Math.atan2(lh.x - c.x, lh.z - c.z), bc = Math.atan2(cove.x - c.x, cove.z - c.z);
      t.ok(Math.abs(angDiff(bl, bc)) < 0.7 && len2(lh.x - c.x, lh.z - c.z) < len2(cove.x - c.x, cove.z - c.z) && W.pathFAt(lh.x, lh.z) <= 40, "Clover's hint: the lighthouse is on the way to the cove", { bl: +bl.toFixed(2), bc: +bc.toFixed(2) });
    }],
    ['landmarks: fog cap compiled; the declared collider keeps Pip out of every landmark mesh (0.5–1.5 m band)', (t) => {
      const { W, G, game, THREE } = t, mod = wp9(G), r = game.renderer;
      t.near(mod.mats.lm.userData.fogCap.value, TW.landmarkFogCap, 1e-9, 'fog cap uniform');
      r.compile(mod.root, game.camera);
      const progs = (r.info.programs || []).filter((p) => String(p.cacheKey).includes('|fogcap')), gl = r.getContext();
      t.ok(progs.length >= 2, 'landmark + outline programs carry the cap', progs.length);
      t.ok(progs.every((p) => !p.fragmentShader || /min\( fogFactor, uFogCap \)/.test(gl.getShaderSource(p.fragmentShader) || '')), 'patched fog chunk in the compiled shader');
      const v = new THREE.Vector3();
      for (const L of W.landmarks.filter((q) => q.id !== 'great_tree')) {
        const g = mod.landmarkObjs[L.id], gy = W.ground(L.x, L.z), R = L.prop.collider.r * (L.prop.s || 1);
        g.updateMatrixWorld(true);
        let worst = 0;
        g.traverse((m) => {
          if (!m.isMesh || m.material === mod.mats.olLm || m.material.isShaderMaterial) return;
          const p = m.geometry.attributes.position;
          for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const h = v.y - gy; if (h >= 0.5 && h <= 1.5) worst = Math.max(worst, Math.hypot(v.x - L.x, v.z - L.z)); }
        });
        t.ok(worst <= R + 0.32 + 0.02, L.id + ': model ≤ collider + Pip radius at body height', { worst: +worst.toFixed(2), R });
      }
    }],
    ['woods: winding trails are open and drawn as dirt, their mouths marked; a fairy ring in every clearing', (t) => {
      const { W } = t, G2 = W.woodsGaps;
      t.ok(G2.trails.length === G2.clearings.length && G2.trails.every((tr) => tr.length > 10), 'one sampled trail per clearing', G2.trails.map((tr) => tr.length));
      G2.trails.forEach((tr, i) => {
        const off = tr.filter((p) => W.pathDAt(p.x, p.z) > 3);
        const dirt = off.reduce((a, p) => a + W.splatB[W.splatK(p.x, p.z) * 4 + 1], 0) / Math.max(1, off.length);
        t.ok(dirt >= 0.4, 'trail ' + i + ' reads as dirt (mean splat)', +dirt.toFixed(2));
        const blocked = off.filter((p) => { const q = W.solidNear(p.x, p.z, 0.8); return q && q.type.startsWith('tree'); }).length;
        t.eq(blocked, 0, 'trail ' + i + ' has no tree on it');
        const mouth = W.edgeStones.filter((st) => tr.some((p) => len2(p.x - st.x, p.z - st.z) < 1.5 && W.pathDAt(p.x, p.z) > 2.2 && W.pathDAt(p.x, p.z) < 4)).length;
        t.ok(mouth >= 1, 'trail ' + i + ' mouth stones', mouth);
      });
      for (const c of G2.clearings) {
        t.ok(c.ring && W.props.some((p) => p.type === 'stump' && len2(p.x - c.ring.x, p.z - c.ring.z) < 0.01), 'stump in the clearing');
        t.ok(W.deco.filter((d) => d.type === 'glowshroom' && Math.abs(len2(d.x - c.ring.x, d.z - c.ring.z) - 1.6) < 0.4).length >= 7, 'glowing fairy ring');
      }
    }],
    ['Great Tree: crown, leaf cards, lanterns; the roots stop Pip before the bark', (t) => {
      const { W, G, D, pl } = t, mod = wp9(G), c = mod && mod.crown, T = W.greatTree;
      const glb = !!t.game.scenery.greatTree.glb;
      t.ok(c && c.lobes >= 15 && c.cardsN >= (glb ? 24 : 12) && c.lanterns >= 10, 'crown parts (' + (glb ? 'GLB' : 'procedural fallback') + ')', c && { lobes: c.lobes, cards: c.cardsN, lanterns: c.lanterns });
      // one dome, not two side "ears": the highest pad is the central top lobe, the side pads stay low
      const top = c.lobeList.reduce((a, b) => (b.y + b.r * 0.62 > a.y + a.r * 0.62 ? b : a)), sides = c.lobeList.filter((L) => Math.abs(L.x) > T.scaleHeight * 0.2);
      t.ok(Math.abs(top.x) < 0.5 && sides.every((L) => L.y + L.r * 0.62 < top.y + top.r * 0.62 - T.scaleHeight * 0.08), 'crown silhouette is one dome', { top: [top.x, top.y], sideMax: Math.max(...sides.map((L) => +(L.y + L.r * 0.62).toFixed(2))) });
      t.ok(!glb || (c.back && c.mantle >= 20), "the GLB's second face (north) is under a moss mantle", { back: c.back, mantle: c.mantle });
      // bunting never crosses the face in the spawn view (the face: |x| < 2.6 m, 4–12 m up, on the trunk's south side)
      const sp = W.spawn, ey = W.ground(sp.x, sp.z) + 0.88, mod2 = wp9(G);
      let cross = 0;
      for (const [a, b] of mod2.buntingStrings || []) for (let u = 0; u <= 1; u += 0.05) {
        const px = a.x + (b.x - a.x) * u, py = a.y + (b.y - a.y) * u, pz = a.z + (b.z - a.z) * u, k = (sp.z - (T.z + 2)) / (sp.z - pz);
        if (pz >= sp.z || k <= 1) continue;   // only points between the eye and the face plane
        const fx = sp.x + (px - sp.x) * k, fy = ey + (py - ey) * k;
        if (Math.abs(fx - T.x) < 2.6 && fy > T.y + 4 && fy < T.y + 12) cross++;
      }
      t.eq(cross, 0, 'bunting points in front of the face from the spawn');
      t.ok(c.cards.material.alphaTest > 0.3 && c.cards.material.map, 'alpha-tested leaf cards with the card art (or its fallback)');
      // walk at the trunk from three sides: Pip stops at the root mound (≥ 80 % of its radius on that bearing)
      for (const [x, z] of [[3, 12], [-14, -1.5], [12, -12]]) {
        const yaw = yawOf(T.x - x, T.z - z);
        D.teleport(x, z, yaw, 0); t.frames(1);
        t.move(0, 1); t.frames(240); t.move(0, 0);
        const d = len2(pl.pos.x - T.x, pl.pos.z - T.z), ang = Math.atan2(pl.pos.x - T.x, pl.pos.z - T.z), R = W.rootRAt(ang);
        t.ok(d >= R * 0.8, 'stopped by the roots from (' + x + ', ' + z + ')', { d: +d.toFixed(2), R: +R.toFixed(2) });
      }
    }],
    ['altar: 1.05 m, tilted sockets, solid; socket glows hide when a seed is placed', (t) => {
      const { W, G, D, pl, game } = t, P = W.pedestal, mod = wp9(G);
      t.near(ALTAR.top, 1.05, 1e-9, 'top'); t.ok(ALTAR.tilt > 0.4 && ALTAR.tilt < 0.9, 'slab tilt ' + ALTAR.tilt);
      const g = propModel('pedestal').geo; g.computeBoundingBox();
      t.ok(g.boundingBox.max.y > 1.05 && g.boundingBox.max.y < 1.6, 'mesh top', g.boundingBox.max.y);
      D.teleport(P.x + 0.3, P.z + 3, Math.PI, 0); t.frames(1);
      t.move(0, 1); t.frames(120); t.move(0, 0);
      t.ok(len2(pl.pos.x - P.x, pl.pos.z - P.z) >= 1.0 + pl.r - 0.02, 'the altar stops Pip', len2(pl.pos.x - P.x, pl.pos.z - P.z));
      const S = mod.sockets;
      t.frames(2, { draw: true });
      t.ok(S && S.shown.every(Boolean), 'three glowing empty sockets', S && S.shown);
      const keep = game.S.seeds.woods;
      game.S.seeds.woods = 2; game.pedSeeds[0].visible = true;
      t.frames(2, { draw: true });
      t.ok(!S.shown[0] && S.shown[1] && S.shown[2], 'socket 1 filled', S.shown);
      game.S.seeds.woods = keep; game.pedSeeds[0].visible = false; t.frames(2, { draw: true });
      t.ok(S.shown[0], 'socket 1 empty again');
    }],
    ['altar collider: a circle round the mesh in the body band (declared shapes are exact); Pip stops at it from the south, east and west with the FP eye clear of the slab', (t) => {
      const { W, D, pl, view } = t, P = W.pedestal, c = W.colliders.find((q) => q.kind === 'pedestal');
      t.ok(c && c.shape === 'circle' && Math.abs(c.r - TW.pedestalR) < 1e-6, 'declared circle r ' + TW.pedestalR, c && { shape: c.shape, r: c.r, hx: c.hx, hz: c.hz });
      // the mesh in Pip's body band (0.15–1.1 m) per 10° sector: inside the circle, and the circle no bigger than the mesh
      const pos = propModel('pedestal').geo.attributes.position, sec = new Array(36).fill(0);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < 0.15 || y > 1.1) continue;
        const x = pos.getX(i), z = pos.getZ(i), k = Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * 36) % 36;
        sec[k] = Math.max(sec[k], Math.hypot(x, z));
      }
      const mesh = Math.max(...sec);
      t.ok(mesh <= c.r + 0.02 && mesh >= c.r - 0.08, 'collider r ' + c.r + ' fits the mesh (' + mesh.toFixed(3) + ' m in the body band)', sec.map((v) => +v.toFixed(2)));
      // the plaza side (the roots fill the north; Shellby stands to the west): a run counts once Pip is pressed against
      // the altar (within 0.08 m of the collider), so a run something else stopped proves nothing and is not counted
      const runs = {};
      for (const [k, dx, dz] of [['S', 0.3, 3], ['SE', 2.1, 2.1], ['E', 3, 0.2], ['SW', -2.1, 2.1]]) {
        D.teleport(P.x + dx, P.z + dz, yawOf(-dx, -dz), 0); t.frames(1);
        t.move(0, 1); t.frames(120); t.move(0, 0); t.frames(1, { draw: true });
        const d = len2(pl.pos.x - P.x, pl.pos.z - P.z);
        runs[k] = { d: +d.toFixed(3), eye: +len2(view.eye.x - P.x, view.eye.z - P.z).toFixed(3), contact: d <= c.r + pl.r + 0.08 };
      }
      t.note('runs', runs);
      const hit = Object.entries(runs).filter(([, r]) => r.contact);
      t.ok(hit.length >= 3, 'runs that reach the altar: ' + hit.map(([k]) => k).join(', '), runs);
      for (const [k, r] of hit) t.ok(r.d >= mesh + pl.r - 0.02 && r.eye >= mesh + 0.2, k + ': stops outside the mesh, the eye ≥ 0.2 m from the slab', r);
    }],
    ['C10 seam: the island-wide meshes built in world coordinates stay out of WP7\'s culler; beside the farthest waymarker / edge stone / sign they are drawn at full scale, far from every stone the stones are not', (t) => {
      const { W, G, D, game, THREE } = t, mod = wp9(G), P = game.modules.find((m) => m && m.name === 'wp7-perf');
      if (P) {
        P.scanObjects();
        const mine = P.objs.filter((o) => { for (let q = o; q; q = q.parent) if (q === mod.root) return true; return false; });
        t.ok(!mine.some((o) => o.isInstancedMesh), 'no instanced mesh of the module in the generic culler');
        // every module object WP7 tracks stands at its own origin (inside its bounds) and is not island-wide
        const box = new THREE.Box3(), v = new THREE.Vector3();
        const bad = mine.filter((o) => {
          box.setFromObject(o);
          if (box.isEmpty()) return false;
          box.getSize(v);
          const ox = o.matrixWorld.elements[12], oz = o.matrixWorld.elements[14];
          return Math.max(v.x, v.z) > 40 || ox < box.min.x - 1 || ox > box.max.x + 1 || oz < box.min.z - 1 || oz > box.max.z + 1;
        }).map((o) => o.name || o.type);
        t.eq(bad.length, 0, 'tracked module objects stand at their own origin: ' + bad.join(', '));
      } else t.note('wp7', 'no wp7-perf module: the culler part is skipped');
      const from0 = (q) => len2(q.x - W.plaza.x, q.z - W.plaza.z), far = (list) => list.slice().sort((a, b) => from0(b) - from0(a))[0];
      const beside = (q, name, objs) => {
        for (let k = 0; k < 12; k++) { const a = k * 0.52, x = q.x + Math.sin(a) * 2.5, z = q.z + Math.cos(a) * 2.5; if (W.walkable(x, z)) { D.teleport(x, z, yawOf(q.x - x, q.z - z), -0.2); break; } }
        if (P) P.scanObjects();
        t.frames(3, { draw: true });
        const st = objs.map((o) => ({ vis: o.visible, s: +o.scale.x.toFixed(3) }));
        t.ok(st.every((s) => s.vis && s.s === 1), name + ' drawn at full scale beside it (' + from0(q).toFixed(0) + ' m from the plaza)', st);
      };
      beside(far(W.waymarkers), 'farthest waymarker', [mod.waymarkPosts, mod.waymarkIcons]);
      beside(far(W.edgeStones), 'farthest edge stone', [mod.edgeStones]);
      const band = W.edgeStones.find((s) => from0(s) > 62 && from0(s) < 68);
      if (band) beside(band, 'an edge stone 62–68 m out (the old fade band)', [mod.edgeStones]);
      beside(far(W.interact.filter((it) => it.kind === 'sign' && !it.signpost && it.prop)), 'farthest sign board', [mod.signBoards]);
      // the module's own span cull: on the path point farthest from every edge stone the stones are not drawn
      let spot = null;
      for (const id in W.paths) for (const q of W.paths[id]) {
        if (W.inArena(q.x, q.z, 4)) continue;
        let d = Infinity;
        for (const s of W.edgeStones) d = Math.min(d, len2(s.x - q.x, s.z - q.z));
        if (!spot || d > spot.d) spot = { x: q.x, z: q.z, d };
      }
      if (spot && spot.d > 75) { D.teleport(spot.x, spot.z, 0, 0); t.frames(3, { draw: true }); t.ok(!mod.edgeStones.visible, 'edge stones not drawn ' + spot.d.toFixed(0) + ' m from the nearest one'); }
      else t.note('farSpot', 'no path point ≥ 75 m from every edge stone');
    }],
    ['bridge mouths: no solid prop within 1.5 m of a deck end (the islet rock made a wedge with the rail end post); every approach at ±35° walks onto the deck', (t) => {
      const { W, D, pl } = t;
      const bad = mouthSolids(W);
      t.eq(bad.length, 0, 'solids in a bridge mouth: ' + JSON.stringify(bad));
      const res = [];
      for (const [bi, b] of W.bridges.entries()) for (const end of [0, 1]) for (const off of [-35, 35]) {
        const ex = end ? b.bx : b.ax, ez = end ? b.bz : b.az, sg = end ? -1 : 1, yaw = Math.atan2(b.dx * sg, b.dz * sg) + (off * Math.PI) / 180;
        const sx = ex - Math.sin(yaw) * 3, sz = ez - Math.cos(yaw) * 3;
        if (!W.walkable(sx, sz) || W.solidNear(sx, sz, pl.r + 0.05)) continue;
        D.teleport(sx, sz, yaw, 0); t.frames(1); t.move(0, 1); t.frames(120); t.move(0, 0);
        res.push({ bi, id: b.id, end, off, deck: pl.standOn === 'deck', at: [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)] });
      }
      t.note('runs', res);
      t.ok(res.length >= W.bridges.length * 2, 'runs ' + res.length);
      t.eq(res.filter((r) => !r.deck).length, 0, 'every ±35° approach ends on the deck: ' + JSON.stringify(res.filter((r) => !r.deck)));
    }],
    ['peaks heart-chest nook: no seed needs a carved corridor (25: the arena dressing closed the walkway; 52: its flat discs cut the path); the shipping seed keeps its nook', async (t) => {
      const m = await import('../../world.js'), out = {};
      for (const s of [25, 52]) {
        const W = m.generateWorld(s), hc = W.hcSpots.peaks, R = W.bfs(W.buildWalk());
        out[s] = { carved: W.carved, unreachable: W.unreachable.map((q) => q.name), chest: W.isReached(R, hc.x, hc.z, true), arena: W.isReached(R, W.arenas.peaks.x, W.arenas.peaks.z, false) };
      }
      t.note('seeds', out);
      t.ok(Object.values(out).every((o) => o.carved === 0 && !o.unreachable.length && o.chest && o.arena), 'carved 0, the chest and the peaks arena reached', out);
      // the default seed's nook passes the rule as the foundation placed it (the stream and the layout are unchanged)
      const hc = t.W.hcSpots.peaks;
      t.ok(len2(hc.x - 75.2, hc.z + 21.7) < 0.1 || t.W.seed !== 7151, 'seed 7151 nook at (75.2, −21.7)', { x: +hc.x.toFixed(2), z: +hc.z.toFixed(2) });
    }],
    ['the striped lighthouse and the shop awning show hard stripes (one colour per face, alternating bands)', (t) => {
      const { THREE } = t, L = t.W.landmarks.find((q) => q.id === 'shores'), k = L.height / 16, CREAM = 0xfff6e2, CORAL = 0xff7a6a, GREEN = 0x7cc35a;
      // the tower wall (big faces, near-horizontal normals) between the base (0.8 m) and the gallery (11.52 m), authored at 16 m
      const tower = stripeBands(THREE, landmarkParts('shores', L.height).main.geo, (x, y, z, ny, area) => Math.abs(ny) < 0.5 && area > 0.05 * k * k && y > 0.85 * k && y < 11.47 * k, (x, y) => Math.floor((y / k - 0.8) / 1.55), [CREAM, CORAL]);
      t.note('tower', tower);
      t.eq(tower.mixed, 0, 'tower faces carry one colour each');
      t.ok(tower.bands.length >= 6 && tower.bands.every((b, i) => b.i === i && b.major === i % 2 && b.n >= 18), 'cream / coral bands alternate up the tower', tower.bands);
      // the awning's top: 8 stripes across its 3 m (model x −1 … 2)
      const aw = stripeBands(THREE, shopModel().geo, (x, y, z, ny, area) => ny > 0.8 && area > 0.05 && y > 2.3 && y < 2.85 && z > 1.45 && z < 2.55 && x > -1 && x < 2, (x) => Math.floor((x - 0.5 + 1.5) / 0.375), [CREAM, GREEN]);
      t.note('awning', aw);
      t.eq(aw.mixed, 0, 'awning faces carry one colour each');
      t.ok(aw.bands.length === 8 && aw.bands.every((b, i) => b.i === i && b.major === i % 2), 'eight cream / green stripes across the awning', aw.bands);
    }],
    ['well: a pitched roof up to the ridge beam, posts standing on the rim (r3: the roof was a V under the ridge, the posts poked out of the wall)', (t) => {
      const { THREE } = t, g = propModel('well').geo, p = g.attributes.position, c = g.attributes.color, ROOF = new THREE.Color(0xc8743f), POST = new THREE.Color(0x8a5a30);
      const is = (i, q) => Math.abs(c.getX(i) - q.r) + Math.abs(c.getY(i) - q.g) + Math.abs(c.getZ(i) - q.b) < 3e-3;
      let ridge = -Infinity, eave = Infinity, postLo = Infinity, roofN = 0;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), az = Math.abs(p.getZ(i));
        if (is(i, ROOF)) { roofN++; if (az < 0.1) ridge = Math.max(ridge, y); if (az > 0.7) eave = Math.min(eave, y); }
        if (is(i, POST) && Math.abs(Math.abs(p.getX(i)) - 0.95) < 0.12 && az < 0.12) postLo = Math.min(postLo, y);
      }
      t.ok(roofN > 0 && ridge > eave + 0.4, 'the roof is highest at the ridge (a Λ, not a V)', { ridge: +ridge.toFixed(2), eave: +eave.toFixed(2) });
      t.ok(postLo >= WELL.rim - 0.1 && postLo < WELL.rim + 0.05, 'the posts start on the rim', { postLo: +postLo.toFixed(2), rim: WELL.rim });
    }],
    ['old saves: a saved spot that is now inside a prop moves to the nearest free spot; a free one stays', async (t) => {
      const { game, W, G, pl } = t, mod = wp9(G), P = W.pedestal, keep = store.get(SAVE_KEY);
      try {
        Object.assign(game.S, { controlsSeen: true, controlsV: 2, introDone: true });
        const mill = W.landmarks.find((L) => L.id === 'meadow');
        for (const [x, z, moved] of [[P.x, P.z, true], [mill.x + 0.3, mill.z, true], [2, 12, false]]) {
          const s = game.saveData(); s.px = x; s.pz = z; store.set(SAVE_KEY, s);
          game.continueGame(); t.frames(80);
          t.ok(!!mod.moved === moved, (moved ? 'moved out of ' : 'kept at ') + x.toFixed(1) + ', ' + z.toFixed(1), mod.moved);
          t.ok(mod.freeSpot(pl.pos.x, pl.pos.z), 'free spot after load', [pl.pos.x, pl.pos.z]);
          if (moved) t.ok(Math.hypot(pl.pos.x - x, pl.pos.z - z) < 4, 'close to the saved spot');
        }
      } finally { if (keep) store.set(SAVE_KEY, keep); }
    }],
    ['signs: painted boards are non-blank; the signpost arms point down their paths', (t) => {
      const { W, D } = t;
      const ink = D.wp9.signInk();
      t.note('ink', ink);
      t.ok(ink.ink > 0.3 && ink.text > 0.01, 'sign atlas has boards and dark text', ink);
      const sp = W.signpost;
      t.ok(sp && sp.arms.length === 4, 'four arms');
      for (const a of sp.arms) {
        const pts = W.paths[a.id], i = pts.reduce((b, q, k) => (len2(q.x - sp.x, q.z - sp.z) < len2(pts[b].x - sp.x, pts[b].z - sp.z) ? k : b), 0);
        const q = pts[Math.min(pts.length - 1, i + 20)], want = yawOf(q.x - sp.x, q.z - sp.z);
        t.ok(Math.abs(wrapAngle(a.yaw - want)) < 0.6, a.id + ' arm points down its path', { yaw: a.yaw, want });
        t.eq(a.name, SIGNS[a.id][0], a.id + ' board text');
      }
      t.ok(W.interact.filter((it) => it.kind === 'sign').every((it) => it.lines && it.lines.length), 'every sign has lines');
      t.ok(D.standAt('sign') !== null, 'standAt(sign) still finds a sign');
    }],
    ['text: no overhead-view or old-control wording; key tokens only from C7; new tips present', (t) => {
      const txt = allText(t.W);
      const bad = txt.filter((s) => /[↑↓←→]|press J\b|\bWASD\b|on the (map|screen)|top of the screen|bottom of the screen|from above/i.test(s) || /\bDASH\b/.test(s) || /\baltar\b/i.test(s));   // 'altar': the prompt and the controls card say Pedestal
      t.eq(bad.length, 0, 'old wording: ' + bad.join(' | '));
      const toks = [...txt.join(' ').matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      t.ok(toks.length >= 4 && toks.every((k) => TOKENS.includes(k)), 'tokens ' + [...new Set(toks)].join(','));
      const sh = NPCS.find((n) => n.id === 'shellby').intro.join(' ');
      t.ok(/compass/i.test(sh) && /Great Tree/.test(sh) && /tallest/i.test(sh), 'Shellby teaches the compass and the tree landmark');
      const all = txt.join(' ');
      t.ok(/\{jump\}/.test(all) && /ring/i.test(all), 'jump the shockwave'); t.ok(/stripe/i.test(all) && /sidestep/i.test(all), 'sidestep Pinch'); t.ok(/LOOK UP/i.test(all) && /pillar/i.test(all), 'watch the sky pillar (Frostbun)');
    }],
    ['village at eye level: low windows with interiors, well rim, counter at 0.7 m with Miso behind it', (t) => {
      const { W, G } = t, mod = wp9(G);
      t.ok(Object.values(HOUSE_WINDOWS).every((l) => l.length >= 2) && HOUSE_WINDOWS.house_a.concat(HOUSE_WINDOWS.house_b).filter((w) => w.y < 1.25).length >= 6, 'low windows (centre < 1.25 m)');
      t.ok(mod.windows && mod.windows.material.map && mod.stats.windows >= 100, 'interior cards', mod.stats.windows);
      t.ok(WELL.rim <= 0.65 && WELL.water < WELL.rim, 'well rim ' + WELL.rim);
      const s = W.shop, m = W.npcSpots.miso, fx = Math.sin(s.rot), fz = Math.cos(s.rot);
      const fwd = (m.x - s.x) * fx + (m.z - s.z) * fz;
      t.ok(fwd > 1.6 && fwd < 2.4, 'Miso stands between the shop wall and the counter', fwd);
      t.ok(W.colliders.filter((c) => c.kind === 'counter').length >= 3, 'counter colliders');
      t.ok(SHOP_COUNTER.top <= 0.6 && SHOP_COUNTER.gap[0] < 0.55 - 0.45 && SHOP_COUNTER.gap[1] > 0.55 + 0.45, 'low counter, clear in front of Miso', SHOP_COUNTER);
      const g = propModel('tree_pine').geo, p = g.attributes.position;
      let under = 9;
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) > 0.6) under = Math.min(under, p.getY(i));
      t.ok(under * 0.85 - 0.08 >= 1.55, 'pine skirt underside ≥ 1.55 m at the smallest scale', +(under * 0.85 - 0.08).toFixed(3));
    }],
    ["Miso's face shows over the counter from the FP eye at 1.6 / 2.4 / 3.5 m (rendered: her face pixels the scene lets through)", async (t) => {
      const r = {};
      for (const d of [1.6, 2.4, 3.5]) r[d] = await misoFace(t, d);
      t.note('face', r);
      for (const d in r) t.ok(r[d].n > 100 && r[d].vis >= 0.85, 'face visible at ' + d + ' m: ' + r[d].vis, r[d]);
    }],
    ['the signpost reads from every side (arms painted on both faces); the plaza paving is bare; posts every ≈ 30 m', (t) => {
      const { W, D, game } = t, sp = W.signpost, it = W.interact.find((q) => q.signpost);
      t.ok(it && !it.prop, 'signpost interact entry has no front half-plane (no prop)');
      const seen = {};
      for (const [k, a] of [['front', sp.rot], ['back', sp.rot + Math.PI], ['side', sp.rot + Math.PI / 2], ['side2', sp.rot - Math.PI / 2]]) {
        const x = sp.x + Math.sin(a) * 1.5, z = sp.z + Math.cos(a) * 1.5;
        if (!W.walkable(x, z)) { seen[k] = 'n/a'; continue; }
        D.teleport(x, z, yawOf(sp.x - x, sp.z - z), 0); t.frames(2); D.lookAt(it.x, it.y + 1.05, it.z); t.frames(40);
        seen[k] = game.target ? game.target.kind : null;
      }
      t.note('signpost', seen);
      t.ok(Object.values(seen).every((v) => v === 'sign' || v === 'n/a'), 'a sign prompt from every side', seen);
      // no grass, pebbles or flowers on the paved plaza (W.plazaMask)
      const onPave = W.deco.filter((d) => W.plazaMask[W.splatK(d.x, d.z)] > 0.3).length;
      t.eq(onPave, 0, 'decorations on the paved plaza');
      // waymarker posts: on every path, never more than 40 m apart (signpost → posts → arena sign)
      for (const id in W.paths) {
        const ds = (W.waymarkers || []).filter((w) => w.region === id).map((w) => w.d).sort((a, b) => a - b), end = W.paths[id].length - (W.arenas[id] ? W.arenas[id].r + 12 : 10);
        const gaps = [ds[0]].concat(ds.slice(1).map((d, i) => d - ds[i]));
        t.ok(ds.length >= Math.ceil(end / TW.waymarkEvery) - 1 && gaps.every((g) => g <= 40), id + ' waymarkers ' + ds.join(','), { end, gaps });
      }
    }],
    ['arena edge rings are solid outside a fight: Pip walking at a ring from outside stops at the stones', (t) => {
      const { W, D, pl } = t;
      for (const id in W.arenas) {
        const a = W.arenas[id], ring = W.colliders.filter((c) => c.kind === 'arenaring' && c.arena === id);
        t.ok(ring.length > 80 && ring.every((c) => Math.abs(len2(c.x - a.x, c.z - a.z) - a.ring.R) < 0.01 && Math.abs(angDiff(Math.atan2(c.x - a.x, c.z - a.z), a.entAng)) >= a.ring.gap - 1e-6), id + ' ring colliders on the stones, entrance open', ring.length);
      }
      const a = W.arenas.woods;
      let done = false;
      for (let k = 0; k < 30 && !done; k++) {   // a bearing whose outside (inside the tree ring) is free and whose ring is not opened
        const b = a.entAng + Math.PI * (0.3 + k * 0.047), x = a.x + Math.sin(b) * (a.r + 1.05), z = a.z + Math.cos(b) * (a.r + 1.05);
        if (!W.walkable(x, z) || W.solidNear(x, z, 0.45) || a.ring.open.some((o) => Math.abs(angDiff(o, b)) < 0.4)) continue;
        D.teleport(x, z, yawOf(a.x - x, a.z - z), 0); t.frames(1); t.move(0, 1); t.frames(150); t.move(0, 0);
        const d = len2(pl.pos.x - a.x, pl.pos.z - a.z);
        t.ok(d > a.r + 0.2, 'stopped outside the woods ring stones at ' + (d - a.r).toFixed(2) + ' m', { d, r: a.r });
        done = true;
      }
      t.ok(done, 'found a walkable approach to the woods ring');
      t.eq(W.unreachable.length, 0, 'everything still reachable');
    }],
    ['animators: one that throws is dropped (stats.animError) and the rest keep running; the socket pulse needs no glowK', (t) => {
      const { G, game } = t, mod = wp9(G), frog = mod.frog, n = mod.anim.length, keep = mod.sockets && mod.sockets.mat.userData.glowK;
      mod.anim.splice(0, 0, () => { throw new Error('test animator'); }); mod.quietAnim = true;
      if (keep) delete mod.sockets.mat.userData.glowK;
      try {
        frog.waveT = 0; game.events.emit(t.EV.INTERACT, { kind: 'well' });
        t.frames(3, { draw: true });
        t.ok(mod.stats.animError === 'test animator' && mod.anim.length === n, 'dropped the throwing animator', mod.stats.animError);
        t.ok(frog.waveT > 0 && frog.waveT < 2.2, 'the frog animator still runs', frog.waveT);
      } finally { if (keep) mod.sockets.mat.userData.glowK = keep; delete mod.stats.animError; mod.quietAnim = false; }
    }],
    ['regions: woods clearings stay open, waymarkers, edge stones, arena edge rings at the clamp, gates rise in a fight', (t) => {
      const { W, G, game, EV } = t, mod = wp9(G);
      const cl = W.woodsGaps.clearings;
      t.ok(cl.length >= 2, 'clearings ' + cl.length);
      t.ok(cl.every((c) => !W.props.some((p) => p.solid && !p.removed && p.type.startsWith('tree') && len2(p.x - c.x, p.z - c.z) < c.r - 0.5)), 'no trees inside clearings');
      t.ok((W.waymarkers || []).length >= 6, 'waymarkers ' + W.waymarkers.length);
      t.ok((W.edgeStones || []).length >= 100, 'edge stones ' + W.edgeStones.length);
      t.ok(Object.keys(mod.gates || {}).length === 3, 'three arena rings');
      game.events.emit(EV.BOSS_FIGHT, { id: 'woods' }); t.frames(40, { draw: true });
      t.near(mod.gates.woods.k, 1, 1e-9, 'woods entrance segment raised');
      game.events.emit(EV.FIGHT_END, { id: 'woods', reset: true }); t.frames(70, { draw: true });
      t.near(mod.gates.woods.k, 0, 1e-9, 'lowered after the fight');
    }],
    ['C10 / C11: every object the module adds carries userData.cull; module draw calls and triangles are small', (t) => {
      const { G } = t, root = wp9(G).root;
      let n = 0, tagged = 0, tris = 0, calls = 0;
      root.traverse((o) => { if (o.isMesh || o.isPoints) { n++; if (o.userData.cull) tagged++; calls++; const g = o.geometry; const k = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += o.isInstancedMesh ? k * o.count : k; } });
      const crown = wp9(G).crown;
      let cn = 0, ct = 0;
      for (const o of [crown.a, crown.b, crown.cards]) o.traverse((m) => { if (m.isMesh) { cn++; if (m.userData.cull && m.userData.cull.dist === Infinity) ct++; calls++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } });
      t.note('module', { meshes: n, calls, tris: Math.round(tris) });
      t.eq(tagged, n, 'cull tags');
      t.eq(ct, cn, 'crown parts tagged userData.cull { dist: Infinity }');
      // the whole island's worth at once (no view sees all of it: wp9-heavy measures per view against the 40 / 150k budget)
      t.ok(calls <= 60 && tris <= 200000, 'all module objects at once ≤ 60 calls / 200k triangles', { calls, tris: Math.round(tris) });
    }],
  ], { desc: 'world and content at eye level (WP9)', prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12 } });

  suite('wp9-heavy', [
    ['Great Tree crown line of sight from walkable points ≥ 15 m away ≥ 50 % (world mapper metric)', (t) => {
      const top = t.D.wp9.losCrown({ step: 8, h: 1.0 }), crown = t.D.wp9.losCrown({ step: 8, h: 0.8 });
      t.note('top', top); t.note('crown80', crown);
      t.ok(top.all >= 0.5, 'LOS to the crown top ' + top.all);
    }],
    ['skyline: each landmark reads from ≥ 50 % of its own path (0.95 H and 0.6 H clear, that span ≥ 40 px at 1080p)', (t) => {
      const r = t.D.wp9.losLandmarks({ h: 0.8, step: 4, px: 40 });
      t.note('los', r);
      for (const id in r) t.ok(r[id].reads >= 0.5 && r[id].n >= 10, id + ' reads from its path ' + r[id].reads + ' (any sliver: ' + r[id].path + ')', r[id]);
    }],
    ['world generation ≤ 600 ms (min of 3 warm runs; the cold boot generation is reported beside it)', async (t) => {
      const m = await import('../../world.js');
      const ms = [];
      for (let i = 0; i < 3; i++) ms.push(m.generateWorld(t.W.seed).genMs);
      ms.sort((a, b) => a - b);
      t.note('warm', ms.map((v) => +v.toFixed(1))); t.note('coldBoot', +t.W.genMs.toFixed(1)); t.note('coldPhases', t.W.genT);
      t.ok(ms[0] <= 600, 'gen ' + ms[0].toFixed(1) + ' ms (cold boot ' + t.W.genMs.toFixed(0) + ' ms)');
    }],
    ['other seeds: reachable without a carved corridor (also the seeds whose peaks nook the r2 merge carved); no solid in a bridge mouth', async (t) => {
      const m = await import('../../world.js'), out = {};
      // r3, carved before nookOk: 25 / 87 / 111 / 169 (the arena dressing closed the walkway), 52 / 89 / 103 / 121 / 145 /
      // 224 / 227 / 259 (the walkway's flat discs cut the peaks path)
      for (const s of [1, 2, 3, 15, 23, 25, 42, 31337, 52, 87, 89, 103, 111, 121, 145, 169, 224, 227, 259]) { const W = m.generateWorld(s); out[s] = [W.carved, W.unreachable.length, mouthSolids(W).length]; }
      t.note('seeds', out);
      t.ok(Object.values(out).every(([c, u]) => c === 0 && u === 0), 'carved / unreachable 0 on every seed', out);
      t.ok(Object.values(out).every(([, , b]) => b === 0), 'no solid prop within 1.5 m of a deck end on every seed', out);
    }],
    ['package cost per view: module objects on vs off (9 locations × 4 directions, FP)', (t) => {
      const { G, D, game } = t, mod = wp9(G), crown = mod.crown;
      const set = (on) => { mod.root.visible = on; crown.a.visible = on && !crown.bloomed; crown.cards.visible = on; };
      const rows = Object.entries(viewCosts(G, game, D, set)).map(([v, [calls, tris, total]]) => ({ v, calls, tris, total }));
      const worst = rows.reduce((a, b) => (b.calls > a.calls ? b : a)), worstT = rows.reduce((a, b) => (b.tris > a.tris ? b : a));
      t.note('worstCalls', worst); t.note('worstTris', worstT);
      t.ok(worst.calls <= 40 && worstT.tris <= 150000, 'module adds ≤ 40 calls / 150k tris to any view', { worst, worstT });
    }],
    ['whole scene vs the foundation per view (lamps, sunflowers, buildings, crown, module, scatter): ≤ +40 calls / +150k tris', (t) => {
      const { G, D, game } = t, aspect = innerWidth / innerHeight, q = location.search, na = /noassets=all/.test(q);
      if (Math.abs(aspect - 16 / 9) > 0.03) { t.note('skipped', 'the baselines are 16:9; this page is ' + aspect.toFixed(3)); return; }
      if (!na && /noassets/.test(q)) { t.note('skipped', 'no baseline for a partial ?noassets'); return; }
      const B = na ? FND_VIEW_NA : FND_VIEW;
      const rows = Object.entries(viewCosts(G, game, D)).map(([v, [c, tr]]) => ({ v, calls: c - B[v][0], tris: tr - B[v][1] }));
      const worst = rows.reduce((a, b) => (b.calls > a.calls ? b : a)), worstT = rows.reduce((a, b) => (b.tris > a.tris ? b : a));
      const med = (k) => rows.map((r) => r[k]).sort((a, b) => a - b)[rows.length >> 1];
      t.note('worstCalls', worst); t.note('worstTris', worstT); t.note('median', { calls: med('calls'), tris: med('tris') });
      t.ok(worst.calls <= 40 && worstT.tris <= 150000, 'whole scene ≤ +40 calls / +150k tris against the foundation at every view', { worst, worstT });
    }],
  ], { desc: 'WP9 heavy checks: crown LOS, gen time, package cost', heavy: true, prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12 } });
}
