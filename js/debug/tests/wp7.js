// WP7 in-page test suites (registered by js/debug/tests.js; only loaded with ?debug=1). Add suites here, never in
// tests.js: suite('wp7', [['name', async (t) => { t.ok(cond, 'what failed', data); }], ...], { desc, prepare }).
// The context t and the prepare options are documented at the top of js/debug/tests.js and in docs/ARCHITECTURE.md.
import * as THREE from 'three';
import { perfLocations } from '../debug.js';
import { toonMat, sharedOutline, outlineGeometry, setBufferSize, U } from '../../toon.js';
import { perf as TP } from '../../tune.js';
import { dprFor } from '../../perf/perf.js';
import { SHAPE } from '../../fx.js';
import { GpuTimer } from '../gpu-timer.js';

const D2R = Math.PI / 180;
const mod = (game) => game.modules.find((m) => m && m.name === 'wp7-perf');
/** every scatter item a frustum-test says the camera can see (inside its class range and the far plane) and how it is
 *  packed: misses = visible but in no mesh */
function visibilityAudit(game) {
  const cam = game.camera, fr = new THREE.Frustum(), m = new THREE.Matrix4(), sp = new THREE.Sphere(), out = { seen: 0, misses: [], overRange: [] };
  cam.updateMatrixWorld(); fr.setFromProjectionMatrix(m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const cx = cam.position.x, cz = cam.position.z, mv = TP.repackMove;
  for (const L of game.scenery.layers) {
    const end = L.range ? L.range[1] : Infinity;
    for (let k = 0; k < L.n; k++) {
      if (L.hidden[k]) continue;
      const d = Math.hypot(L.x[k] - cx, L.z[k] - cz);
      const packed = L.slot0[k] >= 0 || L.slot1[k] >= 0;
      if (packed && d > end + 2 * mv + 0.6) out.overRange.push([L.type, +d.toFixed(1)]);
      // visible: in range (minus the fade tail, where it is already shrunk to nothing), in front of the far plane, in the frustum
      if (d > (L.range ? L.range[1] - 0.5 : cam.far - L.r[k])) continue;
      sp.center.set(L.x[k], L.y[k], L.z[k]); sp.radius = L.r[k];
      if (!fr.intersectsSphere(sp)) continue;
      out.seen++;
      if (!packed) out.misses.push([L.type, +d.toFixed(1)]);
    }
  }
  return out;
}
/** coverage (0–1) of `mesh` drawn alone into a 64² target with the main camera (clear magenta = not drawn) */
function coverage(game, obj) {
  const r = game.renderer, rt = new THREE.WebGLRenderTarget(64, 64), sc = new THREE.Scene(), cam = game.camera.clone();
  cam.aspect = 1; cam.updateProjectionMatrix();
  sc.add(new THREE.AmbientLight(0xffffff, 2)); sc.add(obj);
  const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  r.setRenderTarget(rt); r.setClearColor(0xff00ff, 1); r.clear(); r.render(sc, cam);
  const px = new Uint8Array(64 * 64 * 4); r.readRenderTargetPixels(rt, 0, 0, 64, 64, px);
  r.setRenderTarget(null); r.setClearColor(cc, ca); rt.dispose(); sc.remove(obj);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (!(px[i] > 240 && px[i + 1] < 20 && px[i + 2] > 240)) n++;
  return n / (64 * 64);
}
const raf = () => new Promise((r) => requestAnimationFrame(r));
/** the canvas as drawn by the last render (read in the same task, before it is composited) */
function readCanvas(game) {
  const gl = game.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}
/** share of pixels (sampled every 7th) whose RGB differs by more than `thr` (sum of channels); mean difference */
function pxDiff(a, b, thr = 40) {
  let n = 0, d = 0, s = 0;
  for (let i = 0; i < a.length; i += 28) { const e = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n++; s += e; if (e > thr) d++; }
  return { share: +(d / n).toFixed(4), mean: +(s / n).toFixed(2) };
}

/** count the shadow pass of every rendered frame: { calls, tris } of the last frame (wraps shadowMap.render) */
function shadowCounter(game) {
  const sm = game.renderer.shadowMap, info = game.renderer.info, orig = sm.render, last = { calls: 0, tris: 0, frames: [] };
  sm.render = function (...a) { const c0 = info.render.calls, t0 = info.render.triangles; orig.apply(this, a); last.calls = info.render.calls - c0; last.tris = info.render.triangles - t0; last.frames.push([last.calls, last.tris]); };
  return { last, off() { sm.render = orig; } };
}
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0);

const pq = (a, k) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * k))] : null);
/** render-only GPU bench of the current frame (arch §9.3 with the render map's method): `reps` × `n` synchronous main
 *  passes, each in a TIME_ELAPSED query read even when the driver flags the interval disjoint (other agents share this
 *  GPU, which flags nearly every interval), → per rep p50 / p90; the minimum p50 over the reps (and its p90) is the
 *  figure. The wp7-perf GPU timer is paused meanwhile (queries cannot nest) */
export async function benchGpu(game, n = 24, reps = 3) {
  const r = game.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;
  const hold = game.gpuT; game.gpuT = { begin() {}, end() {}, poll() {} };
  const out = [];
  try {
    for (let k = 0; k < reps; k++) {
      const qs = [];
      for (let i = 0; i < n; i++) { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); r.render(game.scene, game.camera); gl.endQuery(ext.TIME_ELAPSED_EXT); qs.push(q); }
      gl.finish();
      const ms = [];
      for (const q of qs) {
        for (let w = 0; w < 50 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); w++) await new Promise((res) => setTimeout(res, 2));
        if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ms.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      gl.getParameter(ext.GPU_DISJOINT_EXT);   // clear the flag
      if (ms.length) out.push({ p50: pq(ms, 0.5), p90: pq(ms, 0.9) });
      await raf();
    }
  } finally { game.gpuT = hold; }
  if (!out.length) return null;
  const best = out.reduce((a, b) => (b.p50 < a.p50 ? b : a));
  return { p50: +best.p50.toFixed(3), p90: +best.p90.toFixed(3), reps: out.map((x) => +x.p50.toFixed(2)) };
}

/** one view: settle, then `reps` × G.debug.perf({ ms }) → calls / tris (whole frame), shadow and vm shares, real-frame GPU
 *  (min of medians of the non-disjoint samples, often none on a shared GPU) and the render-only bench */
async function measure(t, o) {
  const { game, D } = t;
  const sc = shadowCounter(game);
  try {
    await t.wait(o.settle);
    const reps = [];
    for (let i = 0; i < o.reps; i++) { sc.last.frames.length = 0; const p = await D.perf({ ms: o.ms }); p.sh = [med(sc.last.frames.map((f) => f[0])), med(sc.last.frames.map((f) => f[1]))]; reps.push(p); }
    const g = reps.map((p) => p.gpuMain).filter(Boolean);
    const best = g.length ? g.reduce((a, b) => (b.p50 < a.p50 ? b : a)) : null;
    const p = reps[0];
    const vm = game.view.mode === 'fp' && t.D.vm ? (t.D.vm().calls || 0) : 0;
    const bench = o.bench === false ? null : await benchGpu(game, o.benchN || 24, o.reps);
    return {
      calls: p.calls, tris: p.tris, shadowCalls: p.sh[0], shadowTris: p.sh[1], vmCalls: vm,
      mainCalls: p.calls - p.sh[0] - vm, mainTris: p.tris - p.sh[1],
      gpu: best && { p50: best.p50, p90: best.p90, n: best.n }, gpuReps: g.map((x) => x.p50), bench, fps: Math.max(...reps.map((r) => r.fps)), dpr: p.dpr, tod: p.tod,
    };
  } finally { sc.off(); }
}

export default function register(suite) {
  // ---------------------------------------------------------------- fast acceptance checks (in 'all')
  suite('wp7', [
    ['C11 toonMat: nearFade on by default, false = off, [a, b] = own band, px accepted; px outlines on the shared kinds', (t) => {
      const a = toonMat({}), b = toonMat({ nearFade: false }), c = toonMat({ nearFade: true, px: true }), d = toonMat({ nearFade: [0.2, 0.5] });
      const fl = (m) => m.customProgramCacheKey().slice(4);   // flags after 'toon'
      t.ok(fl(a).includes('n') && !fl(b).includes('n') && fl(c).includes('n') && fl(d).includes('n'), 'NEAR_FADE in the program key', [a.customProgramCacheKey(), b.customProgramCacheKey()]);
      t.ok(c.userData.px === true && d.userData.px === false, 'px flag kept');
      for (const k of ['char', 'prop', 'big', 'tree', 'bush']) t.ok(sharedOutline(k).userData.px > 1, 'px outline ' + k, sharedOutline(k).userData.px);
      for (const m of [a, b, c, d]) m.dispose();
    }],
    ['C11 near fade: a wall 0.20 m from the eye is dithered (≈ 40 %), 0.50 m solid; nearFade:false solid; nothing at 0.09 m', (t) => {
      const { game } = t, cam = game.camera, f = new THREE.Vector3();
      cam.getWorldDirection(f);
      const wall = (dist, o) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), toonMat(o)); m.position.copy(cam.position).addScaledVector(f, dist); m.quaternion.copy(cam.quaternion); m.updateMatrixWorld(); const c = coverage(game, m); m.geometry.dispose(); m.material.dispose(); return c; };
      const c20 = wall(0.2, { vc: false }), c50 = wall(0.5, { vc: false }), c09 = wall(0.09, { vc: false }), off = wall(0.2, { vc: false, nearFade: false });
      t.note('coverage', { c09, c20, c50, off });
      t.ok(c20 > 0.2 && c20 < 0.65, '0.20 m dithered', c20);
      t.ok(c50 > 0.98 && off > 0.98, 'solid at 0.5 m / with nearFade:false', [c50, off]);
      t.ok(c09 < 0.02, 'gone at 0.09 m', c09);
    }, { prepare: { pose: 'village' } }],
    ['C10 userData.cull: { dist: 20, fade: 4 } shrinks over 16–20 m, hides beyond, returns inside (any depth); scenery.root children by radius; hulls untouched', (t) => {
      const { game, D } = t, P = mod(game), p = game.player.pos;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), toonMat({}));
      box.userData.cull = { dist: 20, fade: 4 };
      const holder = new THREE.Group(); holder.add(box); game.scene.add(holder);   // nested: found at any depth
      const at = (dx) => { box.position.set(p.x + dx, p.y + 0.5, p.z); box.updateMatrixWorld(); t.frames(2); return { vis: box.visible, s: +box.scale.x.toFixed(3) }; };
      P.scanObjects();
      const far = at(30), mid = at(18), near = at(10);
      box.scale.setScalar(2); const own = at(10); const ownMid = at(18);   // an owner's scale is kept as the base
      const small = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), toonMat({}));   // radius 0.43 → 60 m class
      small.position.set(p.x + 75, p.y, p.z); game.scenery.root.add(small); small.updateMatrixWorld();
      P.scanObjects(); t.frames(2);
      const autoFar = small.visible, cls = small.userData._wp7 && small.userData._wp7.dist;
      // the owner hides an object while the culler has it hidden (a pooled prop, a reset decoration): it stays hidden when
      // the camera comes back, and shows again only when the owner says so
      box.scale.setScalar(1); at(30); box.visible = false; const ownerHid = at(5); box.visible = true; const ownerShow = at(5);
      // r2: a spread-out object (WP9 keeps every lamp / edge stone / sign board of the island in one instanced or merged
      // mesh with its origin at the island centre) is culled by its nearest point and never scale-faded: an instance
      // beside Pip 100 m from the origin stays drawn, at its own size and place
      const sg = new THREE.BoxGeometry(0.3, 0.3, 0.3), spread = new THREE.InstancedMesh(sg, toonMat({}), 2), mx = new THREE.Matrix4();
      spread.setMatrixAt(0, mx.makeTranslation(p.x + 2, p.y + 0.3, p.z)); spread.setMatrixAt(1, mx.makeTranslation(p.x - 2, p.y + 0.3, p.z));
      spread.position.set(p.x - 100, 0, p.z); spread.updateMatrixWorld();   // the origin 100 m away, the instances at Pip's side
      for (let i = 0; i < 2; i++) { spread.getMatrixAt(i, mx); mx.premultiply(new THREE.Matrix4().makeTranslation(100, 0, 0)); spread.setMatrixAt(i, mx); }
      spread.userData.cull = { dist: 70, fade: 10 };
      game.scene.add(spread); P.scanObjects(); t.frames(2);
      const spreadNear = { vis: spread.visible, s: +spread.scale.x.toFixed(3), tracked: P.objs.includes(spread) };
      const sp0 = { x: p.x, z: p.z }; D.teleport(p.x + 150, p.z, 0, 0); t.frames(2);
      const spreadFar = { vis: spread.visible, s: +spread.scale.x.toFixed(3) };
      D.teleport(sp0.x, sp0.z, 0, 0); t.frames(2);
      game.scene.remove(spread); spread.dispose(); sg.dispose(); spread.material.dispose();
      game.scene.remove(holder); game.scenery.root.remove(small); P.scanObjects();
      t.note('c10', { far, mid, near, own, ownMid, autoFar, cls, ownerHid, ownerShow, spreadNear, spreadFar });
      t.ok(spreadNear.tracked && spreadNear.vis && spreadNear.s === 1 && spreadFar.vis === false && spreadFar.s === 1, 'a spread-out object: by its nearest point, never shrunk', { spreadNear, spreadFar });
      t.ok(ownerHid.vis === false && ownerShow.vis === true, 'an owner-hidden object stays hidden when back in range', { ownerHid, ownerShow });
      t.ok(far.vis === false && near.vis === true && near.s === 1, 'explicit cull dist', { far, near });
      t.near(mid.s, 0.5, 0.02, 'half way through the fade band');
      t.ok(own.s === 2 && Math.abs(ownMid.s - 1) < 0.05, 'owner scale kept', { own, ownMid });
      t.ok(autoFar === false && cls === 60, 'auto class by radius', { autoFar, cls });
      t.ok(game.scenery.greatTree.group.userData.cull.dist === Infinity, 'Great Tree never culled');
      // instanced meshes are tracked only when their owner tags them (C10; WP9's lamps, edge stones, waymarkers): never a
      // scatter layer, hull, shadow caster or the near grass (r2: the merged build has tagged WP9 ones, so the old
      // "no instanced mesh at all" encoded a copy without WP9)
      const sc = game.scenery, ours = new Set();
      for (const L of sc.layers) for (const m of [L.m0, L.ol0, L.m1, L.olP, L.ms]) if (m) ours.add(m);
      game.scene.traverse((o) => { if (o.isInstancedMesh && o.userData.grass) ours.add(o); });
      const inst = P.objs.filter((o) => o.isInstancedMesh);
      t.ok(!inst.some((o) => ours.has(o) || !o.userData.cull), 'no scatter layer, hull or near grass (and no untagged instanced mesh) in the generic culler', inst.map((o) => o.name || o.parent && o.parent.name));
    }],
    ['scatter: every instance the camera can see is packed (48 random views, FP and TP), nothing packed past its range', (t) => {
      const { game, D, W } = t;
      let seen = 0; const misses = [], over = [];
      D.seed(7);
      for (let i = 0; i < 48; i++) {
        const P = W.paths[['woods', 'peaks', 'shores', 'meadow'][i % 4]], q = P[Math.floor(Math.random() * P.length)];
        D.setView(i % 3 === 2 ? 'tp' : 'fp');
        D.teleport(q.x + (Math.random() - 0.5) * 6, q.z + (Math.random() - 0.5) * 6, Math.random() * 6.283, (Math.random() - 0.5) * (i % 5 === 0 ? 2.6 : 0.8));
        t.frames(2);
        const a = visibilityAudit(game);
        seen += a.seen; misses.push(...a.misses.map((m) => [i, ...m])); over.push(...a.overRange);
      }
      t.note('seen', seen); t.note('misses', misses.slice(0, 12)); t.note('overRange', over.slice(0, 12));
      t.ok(seen > 2000, 'audited instances', seen);
      t.eq(misses.length, 0, 'visible instances missing');
      t.eq(over.length, 0, 'instances packed past their class range');
    }],
    ['scatter: tree LOD bands (full < 48 m, proxy > 38 m, ≤ TUNE.perf.lodTris), hulls only inside their fade end, deco ≤ 35 m, small props ≤ 90 m', (t) => {
      const { game, D } = t, mv = TP.repackMove + 0.6;
      const bad = [];
      for (const pose of ['woods', 'meadow', 'hilltop', 'village']) {
        D.pose(pose); t.frames(2);
        const c = game.camera.position;
        for (const L of game.scenery.layers) {
          for (let k = 0; k < L.n; k++) {
            const d = Math.hypot(L.x[k] - c.x, L.z[k] - c.z);
            if (L.slot0[k] >= 0 && d > L.far0 + mv) bad.push([pose, L.type, 'full', +d.toFixed(1)]);
            if (L.slot1[k] >= 0 && L.band && d < L.band[0] - mv) bad.push([pose, L.type, 'proxy', +d.toFixed(1)]);
            if (L.slotO[k] >= 0 && d > L.olR + mv) bad.push([pose, L.type, 'hull', +d.toFixed(1)]);
          }
          if (L.cls === 'tree' && L.lodTris) t.ok(L.lodTris <= TP.lodTris, 'proxy tris ' + L.type, L.lodTris);
          if (L.cls === 'deco') t.ok(L.range[1] === 35, 'deco 35 m ' + L.type);
          if (L.cls === 'small') t.ok(L.range[1] === 90, 'small 90 m ' + L.type);
        }
      }
      t.note('bad', bad.slice(0, 10));
      t.eq(bad.length, 0, 'items outside their band');
    }],
    ['LOD proxies keep the silhouette: proxy vs full model coverage 0.8–1.25 from 4 sides (props 0.72), trunks kept, a hull of their own', (t) => {
      const { game } = t, r = game.renderer, rt = new THREE.WebGLRenderTarget(96, 96), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }), px = new Uint8Array(96 * 96 * 4), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      const cover = (geo, R, yaw) => {
        const m = new THREE.Mesh(geo, mat); sc.add(m);
        const h = (geo.boundingBox || (geo.computeBoundingBox(), geo.boundingBox)).max.y / 2;
        cam.position.set(Math.sin(yaw) * R * 4.2, h, Math.cos(yaw) * R * 4.2); cam.lookAt(0, h, 0);
        r.setRenderTarget(rt); r.setClearColor(0x000000, 1); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, 96, 96, px); r.setRenderTarget(null);
        sc.remove(m);
        let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 128) n++;
        return n;
      };
      const out = {};
      try {
        for (const L of game.scenery.layers) {
          if (!L.m1) continue;
          const ratios = [0, 1.6, 3.1, 4.7].map((y) => cover(L.m1.geometry, L.rad, y) / Math.max(1, cover(L.m0.geometry, L.rad, y)));
          out[L.type] = { ratios: ratios.map((x) => +x.toFixed(2)), parts: L.m1.geometry.userData.parts, hull: !!L.olP === !!L.ol0 };
          const lo = L.cls === 'tree' ? 0.8 : 0.72;   // small props are a few pixels tall at their LOD distance
          t.ok(ratios.every((x) => x > lo && x < 1.25), 'coverage ' + L.type, ratios);
          t.ok(out[L.type].hull, 'proxy hull ' + L.type);
          if (L.cls === 'tree') t.ok(L.m1.geometry.userData.parts.some((k) => k.startsWith('cyl')), 'trunk kept ' + L.type, L.m1.geometry.userData.parts);
        }
      } finally { r.setClearColor(cc, ca); rt.dispose(); mat.dispose(); }
      t.note('proxies', out);
    }],
    ['shadow casters: every caster inside the sun’s light box is in a shadow-drawn prefix (cone, proxies or shadow-only)', (t) => {
      const { game, D } = t, P = mod(game), miss = [];
      for (const [pose, yaw] of [['woods', 0], ['meadow', Math.PI], ['village', 1.5], ['shores', -1.5]]) {
        D.pose(pose); D.look(yaw, 0); t.frames(2);
        const B = P.view.box, c = game.camera.position;
        for (const L of game.scenery.layers) {
          if (!L.cast) continue;
          for (let k = 0; k < L.n; k++) {
            if (L.hidden[k]) continue;
            const dx = L.x[k] - B.tx, dy = L.y[k] - B.ty, dz = L.z[k] - B.tz, e = B.E + L.r[k] - 0.5;
            if (Math.abs(dx * B.ax + dy * B.ay + dz * B.az) > e || Math.abs(dx * B.bx + dy * B.by + dz * B.bz) > e) continue;
            if (L.range && Math.hypot(L.x[k] - c.x, L.z[k] - c.z) > L.range[1]) continue;
            const ok = (L.slot0[k] >= 0 && L.slot0[k] < L.n0s) || (L.slot1[k] >= 0 && L.slot1[k] < L.n1s) || L.slotS[k] >= 0;
            if (!ok) miss.push([pose, L.type, k]);
          }
        }
      }
      t.note('miss', miss.slice(0, 10));
      t.eq(miss.length, 0, 'casters in the box not drawn into the shadow map');
    }],
    ['stable ids: 50 cuts (bushes, pots, tall grass) while walking and turning; cut items are drawn nowhere, regrown ones are packed again', async (t) => {
      const { game, D, W } = t;
      // r3: independent of test order. Whatever earlier suites cut (and left regrowing) grows back first, so the candidate
      // list is always every cuttable in a fixed order (by position), and a pick the random 1.1 m approach cannot cut (a
      // wall, a fence beside it) is tried from two more sides before the next one: the 50 cuts never hinge on one approach
      for (const r of game.regrow) { r.o.cut = false; game.scenery.show(r.o); if (r.o.collider) r.o.collider.active = true; }
      game.regrow.length = 0;
      const list = [];
      let total = 0;
      for (const arr of game.cutHash.values()) for (const o of arr) if (o._inst) { total++; if (!o.cut) list.push(o); }
      t.eq(list.length, total, 'candidates: every cuttable, whatever earlier tests cut (test order)');
      list.sort((a, b) => a.x - b.x || a.z - b.z);
      D.seed(5);
      const pick = [];
      for (const kind of ['bush', 'pot', 'grass']) { const c = list.filter((o) => o.cutKind === kind); for (let i = 0; i < 20 && c.length; i++) pick.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]); }
      let cuts = 0; const stillDrawn = [], cutOnes = [];
      const drawn = (o) => { const L = o._inst.L, k = o._inst.k; return L.slot0[k] >= 0 || L.slot1[k] >= 0 || L.slotS[k] >= 0 || L.slotO[k] >= 0; };
      for (let i = 0; i < pick.length && cuts < 50; i++) {
        const o = pick[i], a0 = Math.random() * 6.283;
        let a = a0;
        for (let tr = 0; tr < 3 && !o.cut; tr++) {
          a = a0 + tr * 2.094;
          t.resetPlayer();
          D.teleport(o.x - Math.sin(a) * 1.1, o.z - Math.cos(a) * 1.1, a, -0.35);
          t.frames(2);
          t.press('attack');
          for (let f = 0; f < 24 && !o.cut; f++) t.frames(1);
          if (!o.cut) t.frames(30);   // the chain resets before the next approach
        }
        if (!o.cut) continue;
        cuts++; cutOnes.push(o);
        // walk away and turn around (re-packs), then audit the cut item and the rest of the view
        D.move(0, 1); t.frames(20); D.move(0, 0);
        D.look(a + Math.PI, 0); t.frames(2); D.look(a, 0); t.frames(2);
        if (drawn(o)) stillDrawn.push([o.cutKind, o._inst.L.type]);
      }
      t.note('cuts', cuts);
      // regrow everything (timers out; from three far-apart spots, so the out-of-view rule lets each one grow back)
      // (facing both ways: an item ahead of every spot within 90 m stays in the view cone and waits)
      for (const L of perfLocations(W).filter((l) => ['village', 'hilltop', 'shores', 'woods'].includes(l.name))) {
        for (const yaw of [0, Math.PI]) {
          for (const r of game.regrow) r.t = 0;
          D.teleport(L.x, L.z, yaw, 0); t.frames(2);
          game.updateRegrowth(0.1);
        }
      }
      const back = cutOnes.filter((o) => o.cut === false).length;   // the picks this test cut (the spares were never cut)
      let packedBack = 0, checked = 0;
      for (const o of cutOnes.slice(0, 12)) {
        if (o.cut) continue;
        D.teleport(o.x - 2.5, o.z, Math.PI / 2, -0.2); t.frames(2);
        checked++; if (drawn(o)) packedBack++;
      }
      t.ok(cuts >= 50, '50 cuts', cuts);
      t.eq(stillDrawn.length, 0, 'cut items still drawn');
      t.ok(back >= cutOnes.length - 2, 'regrown', { back, n: cutOnes.length });
      t.ok(checked > 0 && packedBack === checked, 'regrown items packed again', { packedBack, checked });
    }, { prepare: { pose: 'village', god: true, freeze: true } }],
    ['night-only point lights: hidden by day, shown at night; the first night compiles no new program (dual warm-up)', (t) => {
      const { game, D } = t, P = mod(game), r = game.renderer;
      D.setTime(12); t.frames(2, { draw: true });
      const day = P.lights.length > 0 && P.lights.every((l) => !l.visible);
      const progs0 = r.info.programs.length;
      D.setTime(22); t.frames(2, { draw: true });
      const night = P.lights.every((l) => l.visible);
      const progs1 = r.info.programs.length;
      D.setTime(12); t.frames(2, { draw: true });
      // G.debug.perf.lights(true) forces the night set by day until lights(null)
      D.perf.lights(true); t.frames(3, { draw: true }); const forced = [P.lightsOn, P.lights.every((l) => l.visible)];
      D.perf.lights(null); t.frames(2, { draw: true }); const auto = [P.lightsOn, P.lights.some((l) => l.visible)];
      t.note('programs', [progs0, progs1]); t.note('forced', { forced, auto });
      t.ok(forced[0] === true && forced[1] && auto[0] === false && !auto[1], 'perf.lights(true) holds by day; lights(null) = automatic', { forced, auto });
      t.ok(day, 'day: point lights hidden', P.lights.map((l) => l.visible));
      t.ok(night, 'night: point lights shown');
      t.eq(progs1, progs0, 'programs compiled at the first night');
    }],
    ['warm-up: tree proxies, grass cards, deco and night views compile nothing new on first sight', (t) => {
      const { game, D } = t, r = game.renderer;
      t.frames(1, { draw: true });
      const p0 = r.info.programs.length;
      for (const pose of ['hilltop', 'woods', 'shores', 'peaks', 'meadow', 'arena-woods']) { D.pose(pose); for (const y of [0, 1.6, 3.1, -1.6]) { D.look(y, 0); t.frames(1, { draw: true }); } }
      D.setView('tp'); D.pose('meadow'); t.frames(2, { draw: true });
      t.note('programs', [p0, r.info.programs.length]);
      t.eq(r.info.programs.length, p0, 'new programs while touring');
    }],
    ['warm-up covers what play makes later: WP5 pop-ups made and disposed twice by day and by night, dawn (lamps on, gulls out), a mapped caster drawn after an instanced one in the shadow pass', (t) => {
      const { game, D } = t, r = game.renderer, g = game.fx.ground, p = game.player.pos, gy = game.world.ground(p.x, p.z + 3), out = {};
      t.frames(1, { draw: true });
      const p0 = r.info.programs.length;
      // every '!' / glint / aura / crack / zone / stripe is a material made per use and disposed by its owner (a kept copy
      // from the boot warm-up holds each program, else every first sight recompiled it: one sprite compile per glint)
      out.fx = 0;
      for (const h of [12, 21]) {
        D.setTime(h);
        for (let k = 0; k < 2; k++) {
          const at = { x: p.x, y: gy, z: p.z + 3 };
          const its = [g.alert(at, 1), g.glint(at.x, gy + 1, at.z), g.aura(at), g.crack(at.x, gy, at.z, 2), g.zone(at.x, gy, at.z, 2), g.stripe(at.x, gy, at.z, 0, 3, 1)];
          t.frames(3, { draw: true });
          out.fx = Math.max(out.fx, r.info.programs.length - p0);   // while they show (a released program would hide a compile)
          for (const it of its) g.remove(it);
          t.frames(1, { draw: true });
        }
      }
      const pd = r.info.programs.length;
      // dawn: the lamps' point lights are still on while the gulls fly (both light sets compiled for the late-added gulls)
      D.setTime(6.5);
      for (const pose of ['spawn', 'shores']) { D.pose(pose); for (const y of [0, 1.6, 3.1, -1.6]) { D.look(y, 0.15); t.frames(2, { draw: true }); } }
      out.dawn = r.info.programs.length - pd;
      // the shared shadow-depth material: a caster with a map but no alpha test, drawn right after an instanced caster (the
      // order that made Pip's body compile a "depth + map" program at the first hilltop view), on the shadow-only layer
      D.setTime(12); D.pose('village'); t.frames(2, { draw: true });
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5), tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      tex.needsUpdate = true;
      const mi = new THREE.MeshBasicMaterial(), mm = new THREE.MeshBasicMaterial({ map: tex }), inst = new THREE.InstancedMesh(geo, mi, 1), mesh = new THREE.Mesh(geo, mm);
      inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(p.x + 2, gy + 1, p.z + 2));
      mesh.position.set(p.x + 2, gy + 1, p.z + 3);
      const pair = new THREE.Group();
      for (const o of [inst, mesh]) { o.castShadow = true; o.frustumCulled = false; o.layers.set(4); pair.add(o); }
      const p1 = r.info.programs.length;
      game.scene.add(pair);
      try { t.frames(2, { draw: true }); } finally { game.scene.remove(pair); }
      out.depth = r.info.programs.length - p1;
      inst.dispose(); geo.dispose(); tex.dispose(); mi.dispose(); mm.dispose();
      // r3: WP3's footprints (a mesh built on the first print on sand / snow) compiled by day and again at night in play
      const pfx = game.modules.find((m) => m && typeof m.print === 'function' && typeof m.printMesh === 'function');
      if (pfx) {
        const p2 = r.info.programs.length;
        for (const h of [12, 21]) { D.setTime(h); pfx.print(p.x, p.z + 1.5, 0, 'sand', 'L'); pfx.print(p.x + 0.3, p.z + 1.8, 0, 'snow', null); t.frames(3, { draw: true }); }
        out.prints = r.info.programs.length - p2;
        pfx.clearPrints && pfx.clearPrints();
      } else t.note('prints', 'no footprint module in this copy');
      t.note('new programs', out);
      t.eq(out.fx, 0, 'programs compiled by the pop-ups');
      t.eq(out.dawn, 0, 'programs compiled at dawn');
      t.eq(out.depth, 0, 'shadow-depth programs compiled by a mapped caster after an instanced one');
      if (pfx) t.eq(out.prints, 0, 'programs compiled by the first footprints (day, night)');
    }, { prepare: { pose: 'spawn', god: true, freeze: true } }],
    ['resolution: DPR cap per quality; dynamic resolution scales only the main pass (canvas untouched, a step is free, the scaled frame matches); one ±0.05 step per decision, never stacked', (t) => {
      const { game, D } = t, P = mod(game), dpr = window.devicePixelRatio || 1, r = game.renderer, gl = r.getContext();
      t.eq(dprFor('auto'), Math.min(dpr, 1.5), 'auto cap'); t.eq(dprFor('low'), Math.min(dpr, 1), 'low cap'); t.eq(dprFor('high'), Math.min(dpr, 2), 'high cap');
      const pr0 = r.getPixelRatio(), cw = r.domElement.width, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      t.frames(1, { draw: true }); const full = readCanvas(game);
      const c0 = performance.now(); D.perf.dyn(0.8); const stepMs = performance.now() - c0;
      let scaled, pass, res;
      try { t.frames(1, { draw: true }); scaled = readCanvas(game); pass = P.pass && P.pass.slice(); res = U.uRes.value.toArray(); }
      finally { D.perf.dyn(null); P.setDyn(1); }
      t.frames(1, { draw: true });
      const d = pxDiff(full, scaled);
      let black = 0; for (let i = 0; i < scaled.length; i += 28) if (scaled[i] + scaled[i + 1] + scaled[i + 2] < 6) black++;
      t.note('scaled', { pass, W, H, stepMs: +stepMs.toFixed(2), diff: d, black });
      t.ok(r.getPixelRatio() === pr0 && r.domElement.width === cw, 'canvas not re-allocated', [r.getPixelRatio(), pr0]);
      t.ok(pass && pass[0] === Math.round(W * 0.8) && pass[1] === Math.round(H * 0.8), 'main pass drawn at 0.8', pass);
      t.ok(res[0] === W && res[1] === H, 'pass size uniforms restored after the main pass', res);
      t.ok(stepMs < 5, 'a step costs nothing', stepMs);
      t.ok(d.mean < 20 && black / (scaled.length / 28) < 0.01, 'the stretched 0.8 frame matches the full frame', d);
      // the controller (fake samples; manual clock off for the decision, play state)
      // (without the timer these windows go through the untimed rules: its pace and probe state start clean and are put back)
      const ok = P.gt.ok, hiMs = ok ? 13 : 25, loMs = ok ? 6 : 10, was = game.clock.manual;
      const keep = { pace: P.pace, loNeed: P.loNeed, probe: P.probe };
      const feed = (ms) => { if (ok) P.gt.samples.f = new Array(TP.dynEvery).fill(ms); else P.rafDts = new Array(TP.dynEvery).fill(ms); P.dynamicRes(0); };
      game.clock.manual = false;
      try {
        P.lastDyn = -1e9; P.hiWins = P.loWins = P.loNeed = P.probe = 0; if (!ok) P.pace = 0; P.setDyn(1);
        feed(hiMs); const one = P.dyn;                    // dynHiWins (1) window over 11.5 ms: −0.05 at once, nothing waits
        feed(hiMs); const gap = P.dyn;                    // within dynGap: no second step
        const seq = [P.dyn];
        for (let i = 0; i < 10; i++) { P.lastDyn = -1e9; feed(hiMs); seq.push(P.dyn); }
        const steps = seq.slice(1).map((v, i) => +(seq[i] - v).toFixed(3));
        P.lastDyn = -1e9; for (let i = 0; i < TP.dynLoWins - 1; i++) feed(loMs);
        const notYet = P.dyn; feed(loMs); const up = P.dyn;
        t.note('controller', { one, gap, seq, notYet, up });
        t.near(one, 1 - TP.dynStep, 1e-6, 'one window over budget → one step down');
        t.near(gap, one, 1e-6, 'steps at least dynGap apart');
        t.ok(steps.every((x) => x <= TP.dynStep + 1e-6) && Math.min(...seq) >= TP.dynMin - 1e-6, 'never more than one step per decision, floor 0.70', seq);
        t.ok(Math.abs(notYet - Math.min(...seq)) < 1e-6 && Math.abs(up - notYet - TP.dynStep) < 1e-6, 'dynLoWins windows under 8.5 ms → one step up', { notYet, up });
      } finally { game.clock.manual = was; Object.assign(P, keep); P.setDyn(1); P.hiWins = P.loWins = 0; P.lastDyn = -1e9; }
      // without the GPU timer (Firefox, Safari): frame intervals against the pace (perf/dynres.js; tests/dynres.test.js
      // plays whole sessions). A stand-in timer without the extension, the same fake windows
      const gt = P.gt, state = game.state, raf = window.requestAnimationFrame;
      const feedU = (ms) => { P.lastDyn = -1e9; P.rafDts = new Array(TP.dynEvery).fill(ms); P.dynamicRes(0); return P.dyn; };
      P.gt = { ok: false, samples: {}, open: null, poll() {} };
      game.clock.manual = false;
      try {
        P.hiWins = P.loWins = P.loNeed = P.probe = P.pace = 0; P.setDyn(1);
        const down = feedU(1000 / 30);                                              // one slow window on a 60 Hz display
        let back = down; for (let i = 0; i < TP.dynLoWins; i++) back = feedU(1000 / 60);
        const fail = feedU(1000 / 30), need = P.loNeed;                             // that step up did not hold
        let wait = fail; for (let i = 0; i < TP.dynLoWins; i++) wait = feedU(1000 / 60);
        let later = wait; for (let i = 0; i < TP.dynLoWins; i++) later = feedU(1000 / 60);
        P.hiWins = P.loWins = P.loNeed = P.probe = 0; P.pace = 20; P.setDyn(1);     // a 50 Hz display, seen on the title
        let slow = 1; for (let i = 0; i < 8; i++) slow = feedU(20);
        t.note('untimed', { down, back, fail, need, wait, later, slow, pace: P.pace });
        t.near(down, 1 - TP.dynStep, 1e-6, 'untimed: one slow window → one step down');
        t.eq(back, 1, 'untimed: dynLoWins windows at a steady 60 fps → full size again');
        t.ok(fail < 1 && need === TP.dynLoWins * 2 && wait === fail && later === 1, 'untimed: a step up that did not hold doubles the wait for the next', { fail, need, wait, later });
        t.eq(slow, 1, 'untimed: the display\'s own slower pace is not a slowdown');
        // play pauses (here: the title state) right after a step up that nothing has judged: it is taken back, once
        P.hiWins = P.loWins = P.loNeed = P.probe = P.pace = 0; P.setDyn(0.9);
        let up = 0.9; for (let i = 0; i < TP.dynLoWins; i++) up = feedU(1000 / 60);
        game.state = 'title'; P.dynamicRes(0); const paused = P.dyn; P.dynamicRes(0); const still = P.dyn;
        game.state = state;
        t.ok(Math.abs(up - 0.95) < 1e-6 && Math.abs(paused - 0.9) < 1e-6 && still === paused && P.loNeed === 0, 'untimed: an unjudged step up does not outlast the start of a pause', { up, paused, still, loNeed: P.loNeed });
        // off (here: the manual clock) the on-time windows counted so far stay, a backed-off probe needs many; timed, they go
        P.setDyn(1); P.loWins = 3; game.clock.manual = true; P.dynamicRes(0); const kept = P.loWins;
        P.gt = gt; P.loWins = 3; P.dynamicRes(0); const timed = P.loWins;
        P.gt = { ok: false, samples: {}, open: null, poll() {} }; game.clock.manual = false;
        t.ok(kept === 3 && timed === (gt.ok ? 0 : 3), 'off: the untimed on-time count is kept, the timed one starts again', { kept, timed, timer: gt.ok });
        // the title's own pace (watchPace), frames pumped by hand: 20 ms apart → a 20 ms pace; a visit too short to tell
        // keeps it; an even 60 Hz title is 60 fps
        let q = [], now = 5000;
        window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
        const pump = (n, ms) => { for (let i = 0; i < n; i++) { now += ms; const c = q; q = []; for (const f of c) f(now); } };
        const title = (n, ms) => { game.state = 'title'; P.watchPace(); pump(n, ms); game.state = state; pump(1, ms); return P.pace; };
        P.pace = 0;
        const p50 = title(TP.dynPaceN + 1, 20), idle = P.paceRaf, left = q.length, short = title(TP.dynPaceMin - 2, 33), p60 = title(TP.dynPaceN + 1, 1000 / 60);
        t.note('title pace', { p50, short, p60, idle, left });
        t.ok(Math.abs(p50 - 20) < 0.01 && idle === 0 && left === 0, 'watchPace: an even 50 Hz title is a 20 ms pace, and the watch ends with the title', { p50, idle, left });
        t.eq(short, p50, 'watchPace: too few title frames keep the pace');
        t.near(p60, 1000 / 60, 1e-6, 'watchPace: a 60 Hz title is the 60 fps pace');
      } finally { window.requestAnimationFrame = raf; game.state = state; P.gt = gt; game.clock.manual = was; Object.assign(P, keep); P.paceRaf = 0; P.rafDts.length = 0; P.setDyn(1); P.hiWins = P.loWins = 0; P.lastDyn = -1e9; }
    }, { prepare: { settings: { dynRes: true } } }],
    ['quality low: no near grass, 1024² shadow map, DPR 1; back to auto restores them', (t) => {
      const { game, settings } = t, P = mod(game), sh = game.sky.sun.shadow;
      settings.set('quality', 'low'); t.frames(2);
      const low = { grass: P.grass ? P.grass.on : false, map: sh.mapSize.x, dpr: game.renderer.getPixelRatio() };
      settings.set('quality', 'auto'); t.frames(2);
      const auto = { grass: P.grass ? P.grass.on : false, map: sh.mapSize.x, dpr: game.renderer.getPixelRatio() };
      t.note('q', { low, auto });
      t.ok(!low.grass && low.map === 1024 && low.dpr === Math.min(window.devicePixelRatio || 1, 1), 'low', low);
      t.ok(auto.grass && auto.map === 2048, 'auto', auto);
    }],
    ['near grass: dense in the meadow (cards from grass_cards + flower_cards), none on paths, ≤ 0.45 m, cut by a swing', (t) => {
      const { game, D, W } = t, G2 = mod(game).grass;
      D.pose('meadow'); t.frames(2); G2.update(game.camera, 0, true);   // the whole window at once (a teleport fills it over ≈ 0.5 s)
      const info = G2.info();
      t.note('info', info);
      t.ok(info.on && (info.cards ? info.grass > 3000 : info.blades > 100), 'cards in the window', info);
      if (info.cards) t.ok(info.flowers > 100, 'flowers', info.flowers);
      let tall = 0, onPath = 0, n = 0;
      for (const tl of G2.active) for (const d of tl.data) for (let i = 0; i < d.length; i += 12) { n++; if (d[i + 4] > 0.45 + 1e-6) tall++; if (W.pathDAt(d[i], d[i + 2]) < TP.grass.pathD - 0.05) onPath++; }
      t.eq(tall, 0, 'cards taller than 0.45 m'); t.eq(onPath, 0, 'cards on a path');
      // swing at the densest card near Pip
      let best = null;
      for (const tl of G2.active) { const d = tl.data[0]; for (let i = 0; i < d.length; i += 12) { const dd = Math.hypot(d[i] - W.spawn.x, d[i + 2] - W.spawn.z); if (!best || dd < best.d) best = { x: d[i], z: d[i + 2], d: dd }; } }
      const q = W.paths.meadow[Math.round(W.paths.meadow.length * 0.85)];
      let c0 = G2.cuts, target = null;
      for (const tl of G2.active) { const d = tl.data[0]; for (let i = 0; i < d.length; i += 12) if (Math.hypot(d[i] - q.x, d[i + 2] - q.z) > 2.5 && Math.hypot(d[i] - q.x, d[i + 2] - q.z) < 6) { target = { x: d[i], z: d[i + 2] }; break; } if (target) break; }
      t.ok(!!target, 'a card to swing at');
      if (target) {
        const a = Math.atan2(target.x - q.x, target.z - q.z);
        D.teleport(target.x - Math.sin(a) * 1.0, target.z - Math.cos(a) * 1.0, a, -0.4); t.frames(2);
        const s0 = G2.sfxN || 0;
        t.press('attack'); t.frames(24);
        t.ok(G2.cuts > c0, 'swing cut cards', G2.cuts - c0);
        t.eq((G2.sfxN || 0) - s0, 1, "one 'leaves' sound per swing (cut() runs every step of the hit window)");
      }
    }, { prepare: { god: true, freeze: true } }],
    ['particles: painted fx_atlas cells, near fade (nothing at 0.25 m) and a screen-size cap; halos fade under 3 m and stay ≤ 1.6 m', (t) => {
      const { game } = t, f = game.fx;
      t.ok(SHAPE.PUFF === 4 && SHAPE.STREAK === 19 && SHAPE.SOFT === 0, 'shape names');
      t.ok(!!f.painted === !!(game.renderer && window.G.assets.textures.fx_atlas), 'painted atlas when present');
      const u = f.norm.mat.uniforms;
      t.ok(u.uNearP.value.x >= 0.3 && u.uCap.value.x <= 0.16 + 1e-6 && u.uCap.value.y <= 0.25 + 1e-6, 'near fade / cap uniforms');
      // a 2 m soft particle 0.25 m in front of the eye covers almost nothing; at 3 m it is clamped to ≤ 0.25·H across
      const cam = game.camera, fw = new THREE.Vector3(); cam.getWorldDirection(fw);
      const cover = (dist) => {
        for (const P of [f.norm, f.add]) { P.free.push(...P.list); P.list.length = 0; }
        f.add.spawn({ x: cam.position.x + fw.x * dist, y: cam.position.y + fw.y * dist, z: cam.position.z + fw.z * dist, life: 5, size: 2, color: 0xffffff, alpha: 1, shape: SHAPE.SOFT, fadeIn: 0 });
        f.update(0.05);
        // the sprite size is in buffer pixels: render it with the 64² target's own scale and height
        const pts = f.add.points, par = pts.parent, res = U.uRes.value.clone(), sc0 = f.add.uScale.value;
        U.uRes.value.set(64, 64); f.add.uScale.value = 64 / (2 * Math.tan((cam.fov * Math.PI) / 360));
        const c = coverage(game, pts);
        U.uRes.value.copy(res); f.add.uScale.value = sc0; par.add(pts);
        for (const P of [f.norm, f.add]) { P.free.push(...P.list); P.list.length = 0; } f.update(0);
        return c;
      };
      const near = cover(0.25), mid = cover(3);
      t.note('cover', { near, mid });
      t.ok(near < 0.02, 'faded at the eye', near);
      t.ok(mid > 0.003 && mid < 0.25 * 0.25 * 1.3, 'size cap', mid);
      const hu = game.halos.mat.uniforms.uHalo.value;
      t.ok(hu.x >= 0.5 && hu.y >= 3 && hu.z <= 1.6, 'halo rules', hu.toArray());
    }, { prepare: { pose: 'village' } }],
    ['eye inside a pine tier / a bush (FP or TP camera): that hull is not drawn — no outline-coloured flood', (t) => {
      const { game } = t, sp = game.world.spawn, cam = game.camera.clone(), out = {};
      for (const type of ['tree_pine', 'tree_round', 'bush']) {
        const L = game.scenery.layers.find((l) => l.type === type);
        if (!L || !L.ol0) continue;
        let k = 0, best = 1e9;
        for (let i = 0; i < L.n; i++) { const d = Math.hypot(L.x[i] - sp.x, L.z[i] - sp.z); if (d < best && !L.hidden[i]) { best = d; k = i; } }
        // the eye inside the widest band of the lower crown (the profile the shader tests), 45 % of the way out, looking at the trunk
        const u = L.ol0.material.userData, R = u.prof.value, y0 = u.profY.value.x, y1 = u.profY.value.y, n = R.length;
        let b = 0; for (let i = 1; i < n; i++) if (R[i] > R[b] && i < n * 0.8) b = i;
        const p = L.items[k], s = p.s || 1, ly = y0 + ((b + 0.5) / n) * (y1 - y0), rr = R[b] * 0.45 * s;
        const sink = type.startsWith('tree') ? 0.08 : 0;
        cam.position.set(p.x + rr, p.y - sink + ly * s, p.z); cam.lookAt(p.x - 2, cam.position.y + 0.3, p.z); cam.updateMatrixWorld();
        const shot = (hull) => { L.ol0.visible = hull; game.renderer.render(game.scene, cam); return readCanvas(game); };
        const vis = L.ol0.visible;
        try {
          game.scenery.cull({ ...mod(game).computeView(cam) }, true);
          const a = shot(vis), noHull = shot(false);
          const pv = u.profY.value.clone(); u.profY.value.y = u.profY.value.x - 1;   // the profile off: the flood the test must see
          const flood = shot(vis); u.profY.value.copy(pv);
          out[type] = { withHull: pxDiff(a, noHull).share, profileOff: pxDiff(flood, noHull).share, eye: cam.position.toArray().map((v) => +v.toFixed(2)) };
        } finally { L.ol0.visible = vis; game.scenery.dirty = true; }
        t.ok(out[type].withHull < 0.04, 'outline flood with the eye inside a ' + type, out[type]);
      }
      t.note('inside', out);
      t.ok(out.tree_pine && out.tree_pine.profileOff > 0.15, 'the check sees the flood without the profile (pine)', out.tree_pine);
    }, { prepare: { pose: 'spawn' } }],
    ['outline width: bold near the eye (char ≥ 6 px at 1.3 m, at 1080p), pixel-thin far (≈ 2–3 px at 30 m), phone floor (px scale ≥ 0.75)', (t) => {
      const { game } = t, r = game.renderer, W = 1920, H = 1080, rt = new THREE.WebGLRenderTarget(W, H), px = new Uint8Array(W * H * 4);
      const cam = new THREE.PerspectiveCamera(67.4, W / H, 0.08, 300), sc = new THREE.Scene(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      const res = U.uRes.value.clone(), pk = U.uPxK.value, pass = U.uPassK.value, ol = sharedOutline('char'), out = {};
      const width = (R, dist) => {
        const g = new THREE.SphereGeometry(R, 48, 32), m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const h = new THREE.Mesh(outlineGeometry([g]), ol); m.add(h); m.position.set(0, 0, -dist); sc.add(m); m.updateMatrixWorld(true);
        r.setRenderTarget(rt); r.setClearColor(0xff00ff, 1); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, W, H, px); r.setRenderTarget(null);
        sc.remove(m); g.dispose(); h.geometry.dispose(); m.material.dispose();
        let ink = 0; for (let i = 0; i < px.length; i += 4) if (px[i] < 70 && px[i + 1] < 70 && px[i + 2] < 70) ink++;
        const Rpx = R / Math.sqrt(dist * dist - R * R) * (H / 2) / Math.tan((67.4 * Math.PI) / 360);
        return +(ink / (2 * Math.PI * Rpx)).toFixed(2);
      };
      try {
        setBufferSize(W, H);
        out.near = width(0.25, 1.3); out.mid = width(0.6, 8); out.far = width(2, 30);
        setBufferSize(844, 585); out.phoneK = +U.uPxK.value.toFixed(3);
      } finally { r.setClearColor(cc, ca); rt.dispose(); U.uRes.value.copy(res); U.uPxK.value = pk; U.uPassK.value = pass; }
      t.note('widths px at 1080p', out);
      t.ok(out.near >= 6 && out.near <= TP.outlineCap + 1.5, 'char line at talk distance', out.near);
      t.ok(out.mid >= 2.4, 'char line at 8 m', out.mid);
      t.ok(out.far >= 1.6 && out.far <= 3.3, 'char line at 30 m stays pixel-thin', out.far);
      t.ok(out.phoneK >= TP.outlinePxKMin - 1e-6, 'phone px scale floor', out.phoneK);
    }],
    ['outline hulls are never decimated: every hull (Pip, NPCs, props) has its source mesh’s triangles', (t) => {
      const { game } = t, bad = [], seen = { pip: 0, npc: 0, other: 0 };
      const owner = (o) => { for (let p = o; p; p = p.parent) { if (p === game.player.root) return 'pip'; if (game.npcs && game.npcs.some((n) => n.root === p)) return 'npc'; } return 'other'; };
      const tris = (g) => (g.index ? g.index.count / 3 : g.attributes.position.count / 3);
      game.scene.traverse((o) => {
        if (o.geometry && o.geometry.userData.decimated) bad.push(['decimated', o.name || o.type]);
        if (!o.isMesh || !o.parent || !o.parent.isMesh || !o.material || o.material.side !== THREE.BackSide || !o.material.isShaderMaterial) return;
        seen[owner(o)]++;
        if (tris(o.geometry) !== tris(o.parent.geometry)) bad.push([owner(o), tris(o.geometry), tris(o.parent.geometry)]);
      });
      t.note('hulls', seen);
      const glb = Object.keys((window.G.assets && window.G.assets.gltf) || {}).length > 0;   // ?noassets: procedural models only
      t.ok(!glb || (seen.pip > 0 && seen.npc > 0), 'GLB hulls found', { seen, glb });
      t.eq(bad.length, 0, 'hulls with fewer triangles than their mesh: ' + JSON.stringify(bad.slice(0, 5)));
    }],
    ['boot warm-up: the warm enemies / bosses / telegraphs went through their owners’ remove(); their materials are kept undisposed (programs alive) and drawn by nothing', (t) => {
      const { game } = t, P = mod(game), keep = new Set(P.keep), used = [];
      game.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (keep.has(m)) used.push(o.name || o.type); });
      // the mechanism: a compiled material disposed inside keepPrograms keeps its program
      const r = game.renderer, m = toonMat({ glow: true, nightGlow: true, color: 0x123456 }), mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), m);
      mesh.position.copy(game.camera.position).add(new THREE.Vector3(0, 0, -2).applyQuaternion(game.camera.quaternion)); game.scene.add(mesh);
      t.frames(1, { draw: true });
      const p0 = r.info.programs.length, n0 = P.keep.length;
      P.keepPrograms(() => { game.scene.remove(mesh); m.dispose(); });
      const p1 = r.info.programs.length, kept = P.keep.length - n0;
      P.keep.splice(n0); mesh.geometry.dispose();
      t.note('keep', { warmKept: keep.size, used, p0, p1, kept });
      t.ok(keep.size > 0, 'warm-up materials kept', keep.size);
      t.eq(used.length, 0, 'kept materials still drawn by scene objects');
      t.ok(kept === 1 && p1 === p0, 'dispose held: material kept, program alive', { kept, p0, p1 });
    }],
    ['r3 canopy cutaway: off the eye (TP, the V blend), a tree beside the camera is dithered out above its canopy base — the trunk and the shadow stay, it fades with distance, a farther tree is untouched; never at the eye (FP)', (t) => {
      const { game, D } = t, r = game.renderer, out = {};
      const Ls = game.scenery.layers.filter((l) => l.cut);
      t.ok(['tree_pine', 'tree_round', 'tree_snow', 'tree_palm'].every((ty) => !game.scenery.layers.some((l) => l.type === ty) || Ls.some((l) => l.type === ty)), 'every scatter tree type carries its cut parameters', Ls.map((l) => l.type));
      const L = Ls.find((l) => l.type === 'tree_pine');
      if (!L) { t.ok(false, 'no pine layer'); return; }
      const [base, R, keep, top] = L.cut;
      out.cut = L.cut.map((v) => +v.toFixed(2));
      t.ok(base > 1.6 && base < 2.2 && R > 1.3 && R < 2.0 && keep > 0.1 && keep <= 0.45 && top > 5, 'pine: canopy base / radius / kept trunk radius / top (model units)', out.cut);
      t.ok(L.m0.castShadow && !L.m0.customDepthMaterial && !(L.ms && L.ms.material.customProgramCacheKey().slice(4).includes('c')), 'the shadow pass never runs the cutaway (depth material, shadow-only proxies)');
      // one pine (its own layer materials: model + hull) alone at the origin, read into a 64² target
      const sc = new THREE.Scene(), m = new THREE.InstancedMesh(L.m0.geometry, L.m0.material, 1), h = L.ol0 ? new THREE.InstancedMesh(L.ol0.geometry, L.ol0.material, 1) : null;
      sc.add(new THREE.AmbientLight(0xffffff, 2));
      for (const o of [m, h]) if (o) { o.setMatrixAt(0, new THREE.Matrix4()); o.frustumCulled = false; sc.add(o); }
      const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100), rt = new THREE.WebGLRenderTarget(64, 64), px = new Uint8Array(64 * 64 * 4);
      const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), k0 = U.uCutK.value, f0 = U.uCutFwd.value.clone();
      // pipD: Pip's depth along the view (r4 uCutFwd.z; the default 1e3 = no depth limit, the r3 cases)
      const cov = (x, y, lookY, k, fov = 60, pipD = 1e3) => {
        const l = Math.hypot(x, 0.2);
        U.uCutK.value = k; U.uCutFwd.value.set(-x / l, -0.2 / l, pipD);
        cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(x, y, 0.2); cam.lookAt(0, lookY, 0); cam.updateMatrixWorld();
        r.setRenderTarget(rt); r.setClearColor(0xff00ff, 1); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, 64, 64, px); r.setRenderTarget(null);
        let n = 0; for (let i = 0; i < px.length; i += 4) if (!(px[i] > 240 && px[i + 1] < 20 && px[i + 2] > 240)) n++;
        return +(n / 4096).toFixed(3);
      };
      const [b0, b1] = TP.cutaway.band;
      try {
        out.under = [cov(R * 0.6, 1.5, 2.8, 0), cov(R * 0.6, 1.5, 2.8, 1)];                 // under the lowest tier, looking up
        out.beside = [cov(R + b0 * 0.8, 1.5, 2.6, 0), cov(R + b0 * 0.8, 1.5, 2.6, 1)];      // just outside its rim
        out.trunk = [cov(R + 0.4, 0.9, 0.9, 0, 18), cov(R + 0.4, 0.9, 0.9, 1, 18)];         // the bare trunk below the canopy
        out.mid = [cov(R + (b0 + b1) / 2, 1.5, 3, 0), cov(R + (b0 + b1) / 2, 1.5, 3, 1)];   // halfway through the fade band
        out.far = [cov(R + b1 + 0.6, 1.5, 3, 0), cov(R + b1 + 0.6, 1.5, 3, 1)];             // beyond it
        out.above = [cov(R * 0.6, top + 2, 0, 0), cov(R * 0.6, top + 2, 0, 1)];             // the camera above the tree's top
        // r4: the tree Pip walks up to (its axis 0.6 m past him along the view, the camera inside the band): whole crown;
        // the same geometry with Pip 1.5 m short of the axis (the tree between them, beside the camera): still cut
        const dF = Math.hypot(R + b0 * 0.8, 0.2);
        out.faced = [cov(R + b0 * 0.8, 1.5, 2.6, 0), cov(R + b0 * 0.8, 1.5, 2.6, 1, 60, dF - 0.6)];
        out.short = [cov(R + b0 * 0.8, 1.5, 2.6, 0), cov(R + b0 * 0.8, 1.5, 2.6, 1, 60, dF + 1.5)];
        // r4: a crown 2.3 m over the camera (a palm looked up at from under its fronds): whole crown
        out.high = [cov(R * 0.6, base - 2.3, base + 1.5, 0), cov(R * 0.6, base - 2.3, base + 1.5, 1)];
      } finally { U.uCutK.value = k0; U.uCutFwd.value.copy(f0); r.setClearColor(cc, ca); rt.dispose(); m.dispose(); if (h) h.dispose(); }
      // the amount follows the camera's distance from the eye: 0 in FP, 1 in TP, rising through the V blend, never jumping
      D.setView('fp'); t.frames(3, { draw: true }); out.kFP = U.uCutK.value;
      const ks = []; D.setView('tp', { instant: false }); for (let i = 0; i < 30; i++) { t.frames(1, { draw: true }); ks.push(+U.uCutK.value.toFixed(3)); }
      out.kBlend = ks; D.setView('fp');
      t.note('coverage [k 0, k 1]', out);
      t.ok(out.under[1] < out.under[0] * 0.35, 'under the lowest tier: only the trunk is left', out.under);
      t.ok(out.beside[1] < out.beside[0] * 0.5, 'beside the rim: the canopy is gone', out.beside);
      t.ok(out.trunk[0] > 0.05 && out.trunk[1] >= out.trunk[0] * 0.95, 'the trunk stays', out.trunk);
      t.ok(out.mid[1] > out.mid[0] * 0.25 && out.mid[1] < out.mid[0] * 0.9, 'halfway through the band: partly dithered (no pop)', out.mid);
      t.ok(Math.abs(out.far[1] - out.far[0]) <= 0.01, 'beyond the band: untouched', out.far);
      t.ok(Math.abs(out.above[1] - out.above[0]) <= 0.01, 'the camera above the top: untouched', out.above);
      t.ok(Math.abs(out.faced[1] - out.faced[0]) <= 0.01, 'r4: the tree Pip faces (axis past his depth): untouched', out.faced);
      t.ok(out.short[1] < out.short[0] * 0.5, 'r4: the same tree short of Pip (between him and the camera): cut', out.short);
      t.ok(Math.abs(out.high[1] - out.high[0]) <= 0.01, 'r4: a crown 2.3 m over the camera: untouched', out.high);
      t.eq(out.kFP, 0, 'FP (camera at the eye): no cutaway');
      t.ok(ks[ks.length - 1] === 1 && ks.every((v, i) => i === 0 || (v >= ks[i - 1] - 1e-6 && v - ks[i - 1] < 0.5)), 'V blend: rises to 1 without a jump', ks);
    }, { prepare: { pose: 'spawn' } }],
    ['r4 lost WebGL context: the GPU timer forgets the dead queries, times nothing while lost, re-fetches its extension on restore and drops a stale query; dynamic resolution starts over at 1', (t) => {
      const { game } = t;
      // a stand-in context: queries carry the generation of the context that made them (a restore makes a new one)
      const cv = new EventTarget();
      let gen = 1, lost = false;
      const gl = { canvas: cv, QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2, isContextLost: () => lost,
        getExtension: () => ({ TIME_ELAPSED_EXT: 10, GPU_DISJOINT_EXT: 11, gen }), createQuery: () => ({ gen }), beginQuery() {}, endQuery() {}, deleteQuery() {}, getParameter: () => false,
        getQueryParameter: (q, p) => (q.gen !== gen ? null : p === 1 ? true : 4e6) };
      const gt = new GpuTimer(gl), pair = () => { gt.begin('f'); gt.end('f'); };
      pair(); pair(); pair();
      t.eq(gt.pending.length, 3, 'three queries pending');
      lost = true; cv.dispatchEvent(new Event('webglcontextlost'));
      pair();
      t.ok(gt.pending.length === 0 && !gt.open && !gt.ok, 'lost: pending forgotten, nothing timed', { pending: gt.pending.length, ok: gt.ok });
      lost = false; gen = 2; cv.dispatchEvent(new Event('webglcontextrestored'));
      t.ok(gt.ok && gt.ext.gen === 2, 'restored: the extension of the new context', gt.ext);
      gt.pending.push({ q: { gen: 1 }, tag: 'f' });     // one left over from the old context
      pair(); gt.poll();
      t.ok(gt.pending.length === 0 && (gt.samples.f || []).length === 1 && gt.samples.f[0] === 4, 'poll: the stale query dropped, the new one sampled (was: stuck behind it for good)', { pending: gt.pending.length, samples: gt.samples.f });
      gt.dispose(); lost = true; cv.dispatchEvent(new Event('webglcontextlost'));
      t.ok(!gt.lost, 'dispose removes its listeners');
      const P = game.modules.find((m) => m && m.name === 'wp7-perf'), hold = P.dynHold;
      try {
        P.dynHold = true; P.setDyn(0.8); P.hiWins = 3; P.loNeed = 8; P.probe = 5; P.contextLost();
        t.ok(P.ctxLost, 'perf: lost');
        P.contextRestored();
        t.ok(P.dyn === 1 && !P.ctxLost && P.hiWins === 0 && P.lastDyn < 0, 'perf: restored at full resolution, decisions start over', { dyn: P.dyn, hiWins: P.hiWins });
        t.ok(P.loNeed === 0 && P.probe === 0, 'perf: restored without the untimed back-off of the old context', { loNeed: P.loNeed, probe: P.probe });
      } finally { P.dynHold = hold; P.setDyn(1); }
    }],
    ['far plane 300 m; G.debug.perf helpers (state, cull, dyn, lights, grass, repack)', (t) => {
      const { game, D } = t;
      t.eq(game.camera.far, 300, 'far');
      const s = D.perf.state();
      t.ok(typeof D.perf === 'function' && s && s.scatter && s.view && s.grass, 'state()', Object.keys(s || {}));
      for (const k of ['cull', 'dyn', 'lights', 'grass', 'repack']) t.ok(typeof D.perf[k] === 'function', 'perf.' + k);
    }],
  ], { desc: 'WP7 rendering core: contracts C10 / C11, culling, LOD, shadows, stable ids, lights, resolution, grass, particles', prepare: { view: 'fp', pose: 'spawn', time: 12 } });

  // ---------------------------------------------------------------- heavy: shader hitch check (run it first in a fresh page)
  suite('wp7-hitch', [
    ['hitch ≤ 50 ms: first night, first enemy of each type in view, view switches, resolution steps while walking, first boss intro (real frames)', async (t) => {
      const { game, D } = t, r = game.renderer;
      D.manual(false); D.god(true); D.hud(false);
      // per rAF: the frame's CPU time (game.frameMs: synchronous shader compiles land here) and the rAF interval (also
      // carries GPU contention from other processes, so it is recorded, not gated); new programs per segment
      const cpu = [], raf = []; let run = true, last = performance.now();
      const loop = (now) => { if (!run) return; raf.push(now - last); cpu.push(game.frameMs || 0); last = now; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      const marks = {}, progs = {};
      const mark = (k) => { marks[k] = cpu.length; progs[k] = r.info.programs.length; };
      try {
        D.pose('village'); D.setTime(16.8); D.freezeTime(false); await t.wait(400);
        mark('night'); D.setTime(19.4); await t.wait(1500); D.setTime(12); D.freezeTime(true); await t.wait(300);
        mark('enemies');
        for (const ty of ['slime', 'mushroom', 'bat', 'bee', 'crab', 'snowpuff']) { D.spawn(ty, 4, 0); await t.wait(350); t.clearEnemies(); }
        mark('views'); D.setView('tp', { instant: false }); await t.wait(500); D.setView('fp', { instant: false }); await t.wait(500);
        // dynamic resolution: steps down and up while walking and turning (each one is only the next main pass's size)
        mark('res'); D.hold('up');
        for (const k of [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.8, 0.9, 1]) { D.perf.dyn(k); D.lookDelta(40, 0); await t.wait(120); }
        D.release('up'); D.perf.dyn(null); await t.wait(200);
        mark('boss'); D.toBoss('woods'); await t.wait(3500);
        mark('end');
      } finally { run = false; if (game.fight) game.endFight(true); D.freezeTime(false); D.hud(true); D.perf.dyn(null); }
      const keys = ['night', 'enemies', 'views', 'res', 'boss', 'end'], out = {};
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        out[a] = { cpuMax: +Math.max(0, ...cpu.slice(marks[a] + 1, marks[b])).toFixed(1), rafMax: +Math.max(0, ...raf.slice(marks[a] + 1, marks[b])).toFixed(1), newPrograms: progs[b] - progs[a] };
      }
      t.note('segments', out); t.note('frames', cpu.length);
      for (const k in out) { t.ok(out[k].newPrograms === 0, 'shader compiled during ' + k, out[k]); t.ok(out[k].cpuMax <= 50, 'CPU frame > 50 ms during ' + k, out[k]); }
    }],
], { desc: 'shader hitch check (≈ 8 s, meaningful only as the first thing in a fresh page)', heavy: true, prepare: { god: true } });


  // ---------------------------------------------------------------- heavy: the perf sweep with shadow / vm split
  suite('wp7-sweep', [
    ['wp7 sweep: 9 locations × 4 directions per view mode at a pinned hour; calls / tris split main · shadow · vm, GPU min of medians', async (t) => {
      const { game, D } = t, o = t.opts || {};
      const modes = o.modes || ['fp', 'tp'], locs = o.locs || null, dirs = o.dirs || ['S', 'E', 'N', 'W'];
      const m = { ms: o.ms || 500, reps: o.reps || 3, settle: o.settle || 400, bench: o.bench, benchN: o.benchN };
      const rows = [];
      D.manual(false); D.god(true); D.freezeAI(true); D.hud(false); D.setTime(o.time ?? 12); D.freezeTime(true);
      const prevDyn = t.settings.get('dynRes'); t.settings.set('dynRes', false);
      const yaws = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };
      try {
        for (const mode of modes) {
          D.setView(mode);
          for (const L of perfLocations(game.world)) {
            if (locs && !locs.includes(L.name)) continue;
            if (game.fight) game.endFight(true);
            t.resetPlayer(); t.clearEnemies();
            D.teleport(L.x, L.z, L.yaw ?? Math.PI, 0);
            if (L.arena) for (let i = 0; i < 60 && !(game.fight && game.fight.phase === 'fight'); i++) await t.wait(100);
            for (const dir of dirs) {
              D.look(yaws[dir], mode === 'tp' ? -6 * D2R : 0);
              t.clearEnemies();
              rows.push({ mode, loc: L.name, dir, fight: game.fight ? game.fight.phase : null, ...(await measure(t, m)) });
            }
          }
          if (game.fight) game.endFight(true);
        }
      } finally { D.hud(true); D.freezeTime(false); t.settings.set('dynRes', prevDyn); }
      t.note('rows', rows);
      t.ok(rows.length > 0 && rows.every((r) => r.tod === rows[0].tod), 'rows at one hour', rows.length);
      if (o.gate !== false) {
        const bad = rows.filter((r) => r.mainCalls > 350 || r.mainTris > 1.3e6 || r.shadowCalls > 60);
        t.ok(!bad.length, 'budget: main calls ≤ 350, main tris ≤ 1.3 M, shadow calls ≤ 60', bad.map((r) => `${r.mode} ${r.loc}-${r.dir} ${r.mainCalls}c ${(r.mainTris / 1e6).toFixed(2)}M sh${r.shadowCalls}`));
      }
    }],
  ], { desc: 'WP7 perf sweep (budget gate on calls / triangles; GPU recorded, min of 3 medians); opts { modes, locs, dirs, ms, reps, time }', heavy: true });
}
