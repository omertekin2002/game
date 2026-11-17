// WP8 in-page test suites (registered by js/debug/tests.js; only loaded with ?debug=1).
//   wp8      — atmosphere acceptance (fast, part of 'all'): sky layer, fog chunk + caps (+ WP9-style capFog patches),
//              horizon seam at 4 times × 3 sea vistas, shadow box ahead of the eye, terrain HD / cliff / cobble, quality
//              low at runtime, water uniforms + ripples + glint, view-relative ambient volume, region fog blending, night
//              readability + Pip's night light, woods light shafts, sky-atlas fallbacks.
//   wp8-perf — heavy: package calls / triangles per feature; GPU attribution (timer query per render, interleaved).
import * as THREE from 'three';
import { atmo as TA } from '../../tune.js';
import { ATMO, buildSkyAtlas, displayed } from '../../sky.js';
import { Assets } from '../../assets.js';

const D2R = Math.PI / 180;

/** draw one frame through the real loop and copy the drawing buffer (in the same task, before it is presented) into a
 *  pixel-pack buffer; fetched once its fence signals, so the GPU never stalls (no driver "ReadPixels stall" warnings) */
async function readFrame(t) {
  const gl = t.game.renderer.getContext();
  t.frames(1, { draw: true });
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, n = w * h * 4, buf = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf); gl.bufferData(gl.PIXEL_PACK_BUFFER, n, gl.STREAM_READ);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
  for (let i = 0; i < 400 && gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED; i++) await new Promise((r) => setTimeout(r, 5));
  gl.deleteSync(sync);
  const px = new Uint8Array(n);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  gl.deleteBuffer(buf);
  return { w, h, px };
}
const luma = (px, i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
/** r3: the main pass of this very frame drawn again and read back (no step between two configurations: A/B of one frame) */
function grab(game) {
  const R = game.renderer, gl = R.getContext();
  R.render(game.scene, game.camera);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { w, h, px };
}
/** horizon row (from the top, buffer pixels) for the current camera: a far level point straight ahead */
function horizonRow(t, f) {
  const v = t.view, c = t.game.camera.position, p = new THREE.Vector3(c.x + Math.sin(v.yaw) * 2000, c.y, c.z + Math.cos(v.yaw) * 2000);
  p.project(t.game.camera);
  return Math.round((1 - (p.y * 0.5 + 0.5)) * f.h);
}
/** the biggest row-to-row step of the per-row median luminance in a band around the horizon (the far-plane cut of the
 *  fogged sea / land and the dome meet there): columns 8 %–55 % (left of the viewmodel), rows −30 … +40 */
function seamStep(t, f) {
  const hr = horizonRow(t, f), x0 = Math.round(f.w * 0.08), x1 = Math.round(f.w * 0.55);
  const rowL = (r) => { const y = f.h - 1 - r, L = []; for (let x = x0; x < x1; x += 2) L.push(luma(f.px, (y * f.w + x) * 4)); L.sort((a, b) => a - b); return L[L.length >> 1]; };
  // the far-plane cut of the sea (y = 0) is one screen row: camera height / far × focal length below the horizon
  const cam = t.game.camera, focal = (f.h / 2) / Math.tan((cam.fov * D2R) / 2), cut = Math.round(hr + (focal * cam.position.y) / cam.far);
  const step = (a, b) => { let m = 0, at = a; for (let r = a; r < b; r++) { const d = Math.abs(rowL(r + 1) - rowL(r)); if (d > m) { m = d; at = r; } } return [+m.toFixed(2), at]; };
  const [max, at] = step(cut - 2, cut + 2);                 // the fog / dome boundary rows (the far-plane cut ± 2)
  const [band, bandAt] = step(hr - 30, hr + 40);             // the whole horizon band (sea gradient included; reported)
  // art §16 check 3 flavour: mean colour of the 6 rows above vs below the horizon line (reported)
  let ab = 0, be = 0;
  for (let r = 1; r <= 6; r++) { ab += rowL(hr - r); be += rowL(hr + r); }
  const prof = []; for (let r = hr - 3; r <= hr + 12; r++) prof.push(Math.round(rowL(r)));
  return { max, at, cut, hr, band, bandAt, sixRows: +Math.abs(ab / 6 - be / 6).toFixed(2), prof: prof.join(' ') };
}
/** stand on the coast facing the open sea: walk out from the island centre along yaw until the sea bed drops, back
 *  off onto walkable land */
function seaVista(W, yaw) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  let last = null;
  for (let d = 20; d < 178; d += 1) {
    const x = fx * d, z = fz * d;
    if (W.walkable(x, z) && W.hAt(x, z) > 0.05) last = { x, z };
    if (W.hAt(x, z) < -2.5 && last) break;
  }
  return last && { x: last.x, z: last.z, yaw };
}

/** look at a point `d` m out and `up` m above the eye that nothing in the scene hides (WP9's spawn faces a village house
 *  17 m away): yaws from the current one + 90° in 10° steps, at the current pose and then at a few open ones; the rays to
 *  the point and 3 m above / below it must reach it (visible meshes only, sky layer excluded) → { x, y, z, yaw, pose } */
function clearShot(t, d = 170, up = 35) {
  const { game, D } = t, sky = game.sky, rc = new THREE.Raycaster(), e = new THREE.Vector3(), q = new THREE.Vector3();
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const skip = new Set([sky.dome, sky.sprites && sky.sprites.mesh].filter(Boolean));
  const solid = game.scene.children.filter((o) => !skip.has(o) && !o.isLight && !o.isCamera);
  for (const pose of [null, 'shores', 'meadow', 'hilltop']) {
    if (pose) D.pose(pose);
    t.frames(1);
    e.copy(t.view.eye);
    const y0 = t.view.yaw + Math.PI * 0.5;
    for (let k = 0; k < 36; k++) {
      const yaw = y0 + k * (Math.PI / 18), x = e.x + Math.sin(yaw) * d, z = e.z + Math.cos(yaw) * d, y = e.y + up;
      let clear = true;
      for (const dy of [0, 3, -3]) {
        q.set(x, y + dy, z).sub(e); const len = q.length();
        rc.set(e, q.normalize()); rc.near = 0.3; rc.far = len - 4;
        if (rc.intersectObjects(solid, true).some((h) => h.object.isMesh && !skip.has(h.object) && shown(h.object))) { clear = false; break; }
      }
      if (!clear) continue;
      D.look(yaw, 0.12); t.frames(1);
      return { x, y, z, yaw, pose: pose || 'prepare' };
    }
  }
  return null;
}
/** the block's pixel (centre of `at` projected): rgb and k = red excess (r − (g + b) / 2) */
async function blockPixel(t, at) {
  const f = await readFrame(t), p = new THREE.Vector3(at.x, at.y, at.z).project(t.game.camera);
  const i = (Math.round((p.y * 0.5 + 0.5) * f.h) * f.w + Math.round((p.x * 0.5 + 0.5) * f.w)) * 4;
  return { r: f.px[i], g: f.px[i + 1], b: f.px[i + 2], k: f.px[i] - (f.px[i + 1] + f.px[i + 2]) / 2 };
}
/** the fog factor a block shows, measured: the same block drawn red and green through the same fog (pr, pg) and unfogged
 *  (rr, rg). Fog mixes after tone mapping, so the fog colour cancels in the difference: f = 1 − (pr − pg)·(rr − rg) / |rr − rg|² */
function fogShown(pr, pg, rr, rg) {
  const v = (p) => [p.r, p.g, p.b], d = v(rr).map((x, i) => x - v(rg)[i]), e = v(pr).map((x, i) => x - v(pg)[i]);
  return +(1 - d.reduce((a, x, i) => a + x * e[i], 0) / Math.max(1, d.reduce((a, x) => a + x * x, 0))).toFixed(3);
}

export default function register(suite) {
  suite('wp8', [
    ['sky layer: far plane 300 m, dome + one sprite draw behind the world, old puff clouds gone', async (t) => {
      const { game } = t, sky = game.sky, cam = game.camera;
      t.eq(cam.far, TA.far, 'camera far');
      // the dome is drawn last of the opaque world (only visible-sky pixels shaded), the sprites first of the transparent
      t.ok(sky.dome.renderOrder > 1000 && !sky.domeMat.transparent && sky.sprites.mesh.renderOrder < 0 && sky.sprites.mat.transparent && !sky.dome.frustumCulled && !sky.sprites.mesh.frustumCulled, 'dome after the opaque world, sprites first of the transparent, never culled');
      t.ok(/xyww/.test(sky.domeMat.vertexShader) && /cp\.z = cp\.w/.test(sky.sprites.mat.vertexShader), 'sky objects write depth 1');
      t.ok(!sky.domeMat.depthWrite && !sky.sprites.mat.depthWrite, 'no depth writes');
      const art = !!Assets.billboards.cloud_a;
      const S = sky.sprites;
      t.ok(S.count(2) === TA.clouds && S.count(3) === TA.cirrus, 'cumulus / cirrus counts', [S.count(2), S.count(3)]);
      if (Assets.billboards.horizon_isle_a) t.eq(S.count(4), TA.isles, 'horizon isles');
      t.note('art', art); t.note('sprites', S.list.length);
      let puff = 0;
      game.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 22 && o.parent === game.scene) puff++; });
      t.eq(puff, 0, 'old 3D cloud ring');
      t.ok(S.atlas.size[0] === 2048 && S.atlas.size[1] <= 1024, 'sprite atlas packs into 2048 × 1024', S.atlas.size);
      t.ok(sky.uploaded && sky.sprites.u.tAtlas.value === S.atlas.tex, 'atlas + stars bound once play runs (uploaded after the title)');
      // the moon rides low enough to sit in an eye-level FP view (vFOV/2 ≈ 33.7° at 100° Hor+ 16:9)
      const { D } = t, els = [];
      for (const h of [20.5, 22, 0, 2, 4]) { D.setTime(h); t.frames(1); els.push(+(Math.asin(sky.moonVis.y) * 180 / Math.PI).toFixed(1)); }
      t.ok(els.every((e) => e > 5 && e <= 33), 'moon elevation 5°–33° through the night', els);
    }],
    ['stars only on a darkened sky: none while the zenith is still light at 5.5–6.5 h / 18–18.5 h (night > 0 there), full at night', async (t) => {
      const { D, game } = t, dm = game.sky.domeMat, out = {};
      for (const h of [5.5, 6, 6.5, 18, 18.5, 19.5, 22, 2]) { D.setTime(h); t.frames(1); out[h] = { stars: +dm.uniforms.uStars.value.toFixed(3), night: +game.sky.night.toFixed(3) }; }
      t.note('stars', out);
      t.ok([5.5, 6, 6.5, 18, 18.5].every((h) => out[h].stars === 0 && out[h].night > 0.1), 'no stars on the light dawn / dusk sky', out);
      t.ok([19.5, 22, 2].every((h) => out[h].stars > 0.9), 'stars at night', out);
      t.ok(/uStars/.test(dm.fragmentShader) && !/uNight/.test(dm.fragmentShader), 'the dome draws its stars by uStars, not by the night amount');
    }],
    ['fog: radial distance, dome colour per direction, userData.fogCap → per-material cap', async (t) => {
      const C = THREE.ShaderChunk;
      t.ok(/length\( mvPosition\.xyz \)/.test(C.fog_vertex) && /atmoSky/.test(C.fog_fragment) && /FOG_CAP/.test(C.fog_fragment), 'chunks installed');
      t.eq(ATMO.A.elements[3], 1, 'shared fog uniforms on');
      t.ok(THREE.UniformsLib.fog.atmoSkyA && THREE.ShaderLib.toon.uniforms.atmoSkyA.value === ATMO.A, 'shared uniform by reference');
      // a toon material compiled after the patch carries the same matrix
      const m = new THREE.MeshToonMaterial();
      let shared = false;
      m.onBeforeCompile = (sh) => { shared = sh.uniforms.atmoSkyA && sh.uniforms.atmoSkyA.value === ATMO.A; };
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m);
      mesh.position.set(t.view.eye.x + Math.sin(t.view.yaw) * 3, t.view.eye.y, t.view.eye.z + Math.cos(t.view.yaw) * 3);
      mesh.userData.fogCap = 0.45;
      t.game.scene.add(mesh);
      const atmo = t.G.debug.atmo;
      t.game.modules.find((x) => x.name === 'wp8-atmo').applyCaps(true);
      t.frames(1, { draw: true });
      t.ok(shared, 'toon program sees ATMO.A');
      t.eq(m.defines && m.defines.FOG_CAP, '0.450', 'userData.fogCap → define');
      t.game.scene.remove(mesh); mesh.geometry.dispose(); m.dispose();
      t.ok(typeof atmo.info === 'function', 'G.debug.atmo');
    }],
    ['fog chunk keeps three\'s "fogColor, fogFactor )" text: a WP9-style capFog patch compiles and caps the fog', async (t) => {
      const { game, D } = t, C = THREE.ShaderChunk.fog_fragment, RX = /fogColor\s*,\s*fogFactor\s*\)/;
      const hits = C.match(new RegExp(RX.source, 'g')) || [];
      t.ok(hits.length === 1 && /mix\( gl_FragColor\.rgb, fogColor, fogFactor \)/.test(C), 'the text occurs once, in the final mix (a patch rewrites the first match)', hits.length);
      // WP9's capFog (wt/WP9/js/world-mod.js) in behaviour: rewrite that text into min( fogFactor, uFogCap )
      const capFog = (m, cap) => {
        const u = { value: cap };
        m.onBeforeCompile = (sh) => { const capped = C.replace(RX, 'fogColor, min( fogFactor, uFogCap ) )'); if (capped === C) return; sh.uniforms.uFogCap = u; sh.fragmentShader = 'uniform float uFogCap;\n' + sh.fragmentShader.replace('#include <fog_fragment>', capped); };
        m.customProgramCacheKey = () => '|wp8-capfog-test';
        return m;
      };
      // a red block 170 m out, 35 m up, in a view where nothing stands in front of it (r2: from WP9's spawn the old fixed
      // yaw + 90° looked into a village house 17 m away, and every read was the house's wall)
      const at = clearShot(t);
      t.ok(!!at, 'a view with a clear 170 m line of sight');
      if (!at) return;
      const { x, y, z } = at, R = 0xff2020, Gn = 0x20ff20;
      const M = {
        plainR: new THREE.MeshBasicMaterial({ color: R }), plainG: new THREE.MeshBasicMaterial({ color: Gn }),
        rawR: new THREE.MeshBasicMaterial({ color: R, fog: false }), rawG: new THREE.MeshBasicMaterial({ color: Gn, fog: false }),
        capR: capFog(new THREE.MeshBasicMaterial({ color: R }), 0.15), capG: capFog(new THREE.MeshBasicMaterial({ color: Gn }), 0.15),
      };
      const block = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 6), M.plainR);
      block.position.set(x, y, z); block.userData.cull = { dist: Infinity };
      const px = {};
      let src = '', runnable = false;
      try {
        px.bg = await blockPixel(t, at);                // the sky behind the block
        game.scene.add(block);
        for (const k of ['plainR', 'plainG', 'rawR', 'rawG', 'capR', 'capG']) { block.material = M[k]; px[k] = await blockPixel(t, at); }
        const prog = game.renderer.properties.get(M.capR).currentProgram, gl = game.renderer.getContext();
        if (prog) { src = gl.getShaderSource(prog.fragmentShader) || ''; runnable = prog.diagnostics ? prog.diagnostics.runnable : true; }
      } finally { game.scene.remove(block); block.geometry.dispose(); for (const k in M) M[k].dispose(); }
      const plain = px.plainR.k, capped = px.capR.k, fog = { plain: fogShown(px.plainR, px.plainG, px.rawR, px.rawG), capped: fogShown(px.capR, px.capG, px.rawR, px.rawG) };
      t.note('view', at); t.note('px', px); t.note('fog', fog);
      t.ok(/min\( fogFactor, uFogCap \)/.test(src) && runnable, 'patched chunk compiled and linked');
      t.ok(px.rawR.k - px.bg.k > 60, 'block occluded (the unfogged block is not at its pixel)', { bg: px.bg, raw: px.rawR });
      t.ok(fog.plain > 0.3 && fog.capped <= 0.15 + 0.05, 'fog factor on the block: plain > 0.3, capped at the patch cap 0.15', fog);
      t.ok(capped - plain > 40, 'the capped block reads redder through 170 m of fog', { plain, capped });
    }],
    ['fog caps by position: Great Tree + W.landmarks (C6) stay readable at 170 m', async (t) => {
      const { game, D, W } = t, atmo = t.G.debug.atmo;
      const caps = atmo.caps(), T = W.greatTree;
      t.ok(caps.length >= 1 && Math.hypot(caps[0][0] - T.x, caps[0][1] - T.z) < 1e-6 && caps[0][4] === TA.capTree && caps[0][2] >= TA.capTreeR, 'Great Tree cylinder', caps[0]);
      t.ok(ATMO.CA.elements[2] > TA.capTreeR && Math.abs((ATMO.CA.elements[2] % 1) - TA.capTree) < 1e-3, 'packed into atmoCapA', Array.from(ATMO.CA.elements.slice(0, 4)));
      // simulate WP9: a landmark 170 m out, a red block 25–45 m up, in a view where nothing stands in front of it (r2: the
      // old fixed yaw + 90° from WP9's spawn looked into a house)
      const at = clearShot(t);
      t.ok(!!at, 'a view with a clear 170 m line of sight');
      if (!at) return;
      const { x, y, z } = at, R = 0xff2020, Gn = 0x20ff20;
      const had = Object.prototype.hasOwnProperty.call(W, 'landmarks'), keep = W.landmarks;
      const M = { R: new THREE.MeshBasicMaterial({ color: R }), G: new THREE.MeshBasicMaterial({ color: Gn }), rawR: new THREE.MeshBasicMaterial({ color: R, fog: false }), rawG: new THREE.MeshBasicMaterial({ color: Gn, fog: false }) };
      const block = new THREE.Mesh(new THREE.BoxGeometry(6, 20, 6), M.R);
      block.position.set(x, y, z); block.userData.cull = { dist: Infinity };
      const px = {};
      const nWas = atmo.caps().length;   // the Great Tree + whatever W.landmarks holds now (WP9's four in the merged game)
      let n0, n1;
      const reads = async (pre) => { for (const k of ['R', 'G']) { block.material = M[k]; px[pre + k] = await blockPixel(t, at); } };
      try {
        W.landmarks = []; t.frames(1); n0 = atmo.caps().length;
        px.bg = await blockPixel(t, at);
        game.scene.add(block);
        await reads('plain');
        for (const k of ['rawR', 'rawG']) { block.material = M[k]; px[k] = await blockPixel(t, at); }
        W.landmarks = [{ id: 'wp8test', name: 'Test', region: 'village', x, z, height: 40, y: y - 15 }];
        t.frames(1); n1 = atmo.caps().length;
        await reads('capped');
      } finally {
        game.scene.remove(block); block.geometry.dispose(); for (const k in M) M[k].dispose();
        if (had) W.landmarks = keep; else delete W.landmarks;
        t.frames(1);
      }
      const plain = px.plainR, capped = px.cappedR, fog = { plain: fogShown(px.plainR, px.plainG, px.rawR, px.rawG), capped: fogShown(px.cappedR, px.cappedG, px.rawR, px.rawG) };
      t.eq(n1, n0 + 1, 'a new W.landmarks entry becomes a cylinder (no reload)');
      t.note('view', at); t.note('px', px); t.note('fog', fog);
      t.ok(px.rawR.k - px.bg.k > 60, 'block occluded (the unfogged block is not at its pixel)', { bg: px.bg, raw: px.rawR });
      t.ok(fog.plain > TA.capLandmark + 0.15 && fog.capped <= TA.capLandmark + 0.05, 'fog factor on the block: plain well over the cap, capped at capLandmark', fog);
      t.ok(capped.k - plain.k > 50 && capped.k > 70, 'capped block reads through the fog', { plain, capped });
      t.eq(atmo.caps().length, nWas, 'removed again (W.landmarks as it was)');
    }],
    ['horizon seam ≤ 6/255 at 4 times × 3 sea vistas (fog = dome colour per direction)', async (t) => {
      const { D, W } = t, out = [];
      const vistas = [['east', 0.9], ['west', -1.9], ['south', 0.15]].map(([name, yaw]) => { const v = seaVista(W, yaw); return v && { name, ...v }; }).filter(Boolean);
      for (const v of vistas) {
        for (const h of [12, 17.6, 22, 6.4]) {
          D.setTime(h); D.freezeTime(true);
          D.teleport(v.x, v.z, v.yaw, 0);
          t.G.debug.atmo.snapFog();
          t.clearEnemies();
          t.frames(3);
          const f = await readFrame(t), s = seamStep(t, f);
          out.push({ v: v.name, h, ...s });
        }
      }
      D.freezeTime(false);
      t.note('seams', out);
      t.ok(out.length >= 12, 'vistas found', out.length);
      const worst = out.reduce((a, b) => (b.max > a.max ? b : a), { max: 0 });
      t.note('worst', worst);
      t.ok(worst.max <= 6, 'horizon luminance step ' + worst.max + ' at ' + worst.v + ' ' + worst.h + 'h', worst);
      // and no hard line anywhere in the horizon band (the sea's own gradient into the haze), scaled to 720p rows
      const k = t.game.renderer.getContext().drawingBufferHeight / 720, band = Math.max(...out.map((o) => o.band)) * k;
      t.note('bandMax720', +band.toFixed(2));
      t.ok(band <= 16, 'horizon band gradient per 720p row ' + band.toFixed(2) + ' (a hard line measured 25 before the fix)');
    }, { prepare: { view: 'fp', time: 12 } }],
    ['shadows: box centred ahead of the eye, trees 25–35 m ahead covered, light-space texel snap', async (t) => {
      const { D, game } = t, sky = game.sky, sh = sky.sun.shadow;
      D.setTime(16.9); D.freezeTime(true);
      D.pose('meadow');
      t.frames(2, { draw: true });
      sh.camera.updateMatrixWorld();
      const v = t.view, e = v.eye, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), P = new THREE.Vector3();
      const inBox = (d, side = 0) => {
        const x = e.x + fx * d - fz * side, z = e.z + fz * d + fx * side;
        P.set(x, t.W.hAt(x, z), z).applyMatrix4(sh.camera.matrixWorldInverse);
        return Math.abs(P.x) <= sh.camera.right && Math.abs(P.y) <= sh.camera.top;
      };
      const ahead = [25, 30, 35].every((d) => inBox(d) && inBox(d, 10) && inBox(d, -10));
      t.ok(ahead, 'points 25–35 m ahead (±10 m) inside the shadow box');
      // how far sideways the box reaches 30 m ahead (a 100° FP view spans ±36 m there: the box covers its centre part)
      let L = 0, Rr = 0; while (L < 60 && inBox(30, L + 1)) L++; while (Rr < 60 && inBox(30, -(Rr + 1))) Rr++;
      t.note('lateral30', [L, Rr]);
      t.ok(Math.min(L, Rr) >= 10, 'lateral reach 30 m ahead ≥ 10 m both sides', [L, Rr]);
      const ah = (sky.shadowCenter.x - e.x) * fx + (sky.shadowCenter.z - e.z) * fz;
      t.near(ah, TA.shadowAhead, 1.0, 'the box centre sits shadowAhead m along the view');
      t.eq(sh.mapSize.x, t.settings.get('quality') === 'low' ? TA.shadowMapLow : TA.shadowMap, 'one map, RULINGS size');
      t.near(sh.camera.right, TA.shadowE, 1e-6, 'E');
      t.ok(sh.camera.far === TA.shadowFar && Math.abs(sh.camera.projectionMatrix.elements[10] + 2 / (TA.shadowFar - sh.camera.near)) < 1e-6, 'shadow depth range applied to the projection', [sh.camera.near, sh.camera.far]);
      // texel snapping in light space: the target's light-space x / y sit on the texel grid
      const tex = (2 * TA.shadowE) / sh.mapSize.x, z = sky.sunDir.clone(), xA = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize(), yA = new THREE.Vector3().crossVectors(z, xA);
      const c = sky.shadowCenter, lx = c.dot(xA) / tex, ly = c.dot(yA) / tex;
      t.ok(Math.abs(lx - Math.round(lx)) < 1e-3 && Math.abs(ly - Math.round(ly)) < 1e-3, 'snapped', [lx, ly]);
      // a sub-texel step of the eye keeps the box on the same texel (no shimmer)
      const before = c.clone();
      D.teleport(t.pl.pos.x + tex * 0.2, t.pl.pos.z, v.yaw, 0); t.frames(2, { draw: true });
      t.ok(before.distanceTo(sky.shadowCenter) < tex * 1.01, 'stable under sub-texel moves', before.distanceTo(sky.shadowCenter));
      D.freezeTime(false);
    }],
    ['terrain: HD layers swap in, anisotropy, cliff + plaza cobble slots, planks available', async (t) => {
      const { game } = t;
      await Assets.loadDeferred();
      t.frames(1);
      const u = game.terrain.material.userData.uniforms;
      const want = (k) => Assets.textures[k + '_hd'] || Assets.textures[k] || null;
      for (const [k, slot] of [['grass', 'tGrass'], ['forest', 'tForest'], ['meadow', 'tMeadow'], ['sand', 'tSand'], ['dirt', 'tDirt'], ['rock', 'tRock']]) {
        const w = want(k);
        if (w) t.ok(u[slot].value === w, slot + ' holds the best loaded file', u[slot].value.userData.key);
      }
      if (Assets.textures.cliff_hd) t.ok(u.tCliff.value === Assets.textures.cliff_hd, 'cliff_hd on steep slopes');
      if (Assets.textures.cobble_hd) t.ok(u.uPlaza.value.w === 1 && u.tCobble.value === Assets.textures.cobble_hd, 'plaza cobble on');
      t.near(u.uPlaza.value.z, game.world.plaza.r, 1e-6, 'plaza radius from W.plaza');
      const hd = Assets.textures.grass_hd;
      const gpu = game.renderer.capabilities.getMaxAnisotropy();
      if (hd) t.ok(hd.anisotropy >= Math.min(Assets.lowRes ? TA.anisoLow : TA.aniso, gpu), 'anisotropy', [hd.anisotropy, gpu]);
      t.ok(!!Assets.tex('planks'), 'planks texture available (Assets.tex("planks"))');
      t.note('terrain', t.G.debug.atmo.info().terrain);
    }],
    ['deferred HD textures: loaded after the title, all in within 5 s of it', async (t) => {
      const mod = t.game.modules.find((m) => m.name === 'wp8-atmo'), T0 = mod.titleAt, D0 = Assets.deferredAt;
      const M = (window.ASSET_MANIFEST && window.ASSET_MANIFEST.textures) || {};
      const hd = Object.keys(M).filter((k) => /_hd$/.test(k) && Assets.textures[k]);
      t.note('hdKeys', hd.length);
      if (!hd.length) { t.ok(true, 'no HD texture in this load (?noassets / policy)'); return; }
      t.ok(T0 != null && D0 != null && D0 >= T0 - 1, 'deferred loading starts once the title is up', { T0, D0 });
      const arr = hd.map((k) => Assets.arrivals[k]).filter((x) => x != null);
      t.eq(arr.length, hd.length, 'every resident HD texture arrived through loadDeferred');
      const last = Math.max(...arr) - T0;
      t.note('lastAfterTitleMs', Math.round(last));
      t.ok(last <= 5000, 'last HD texture ' + Math.round(last) + ' ms after the title (≤ 5000)');
    }],
    ['water: sky reflection + glint follow the time of day; wading steps ripple', async (t) => {
      const { game, D, EV } = t, u = game.waterMat.uniforms;
      D.setTime(12); D.freezeTime(true); t.frames(2);
      t.ok(u.uSunGlint.value.r > 0.2 && u.uMoonGlint.value.r === 0, 'sun glint by day', u.uSunGlint.value.toArray());
      D.setTime(22.5); t.frames(2);
      t.ok(u.uSunGlint.value.r === 0 && u.uMoonGlint.value.b > 0.2, 'moon glint at night', u.uMoonGlint.value.toArray());
      t.ok(u.uLight.value.equals(game.sky.waterLight), 'water light follows the sky (moved from game.js)');
      const before = u.uRip.value.map((r) => r.z);
      game.events.emit(EV.STEP, { foot: 'L', surface: 'water', speed: 3 });
      const after = u.uRip.value.map((r) => r.z);
      t.ok(after.some((z, i) => z !== before[i] && Math.abs(z - game.time) < 1e-6), 'a ripple starts at the step');
      D.freezeTime(false);
    }],
    ['ambient: spawn volume is view-relative (ahead of the eye, never within 1.5 m)', async (t) => {
      const { game, D } = t;
      const sample = (yaw) => {
        D.look(yaw, 0); t.frames(1, { draw: true });
        const c = game.camera.position, f = { x: Math.sin(yaw), z: Math.cos(yaw) };
        let n = 0, ahead = 0, near = 0, sum = 0;
        for (let i = 0; i < 400; i++) {
          const p = game.ambPoint(1, 7);
          if (!p) continue;
          n++;
          const dx = p.x - c.x, dz = p.z - c.z, dy = p.y - c.y, along = dx * f.x + dz * f.z;
          sum += along; if (along > 0) ahead++;
          if (dx * dx + dy * dy + dz * dz < TA.ambClear ** 2) near++;
        }
        return { mean: sum / n, ahead: ahead / n, near };
      };
      const a = sample(0), b = sample(Math.PI);
      t.ok(a.mean > TA.ambAhead * 0.6 && b.mean > TA.ambAhead * 0.6 && a.ahead > 0.7, 'volume follows the look', [a, b]);
      t.eq(a.near + b.near, 0, 'nothing within ambClear of the eye');
      D.setView('tp'); t.frames(25, { draw: true });
      const c = sample(Math.PI / 2);
      t.ok(c.mean > TA.ambAhead * 0.6, 'TP: around the camera view too', c);
    }],
    ['fog: per-region targets, blended, snapped on teleport, arena closes in', async (t) => {
      const { game, D } = t, mod = game.modules.find((m) => m.name === 'wp8-atmo');
      D.setTime(12); D.freezeTime(true);
      D.pose('woods'); t.frames(80);
      const w = TA.fog.woods;
      t.near(mod.fog.near, w[0], 0.5, 'woods near'); t.near(mod.fog.far, w[1], 1, 'woods far');
      t.near(game.scene.fog.far, mod.fog.far, 1e-6, 'applied to scene.fog');
      D.pose('village'); t.frames(80);
      t.near(mod.fog.far, TA.fog.village[1], 1.5, 'village far after the teleport (snapped)');
      t.ok(mod.fog.far < TA.far - 25, 'fog full before the far plane');
      D.freezeTime(false);
    }],
    ['night stays readable: 22:00 village ground luminance against noon (any art), ≥ 110 with the HD art', async (t) => {
      const { D } = t, mean = async (h) => {
        D.setTime(h); D.freezeTime(true); D.pose('village'); D.look(t.view.yaw, -0.25);
        t.frames(3);
        const f = await readFrame(t);
        let s = 0, n = 0;
        for (let y = 0; y < Math.round(f.h * 0.45); y += 3) for (let x = Math.round(f.w * 0.05); x < Math.round(f.w * 0.55); x += 3) { s += luma(f.px, (y * f.w + x) * 4); n++; }
        return s / n;
      };
      const night = await mean(22), noon = await mean(12), hd = !!(Assets.textures.grass_hd && !Assets.textures.grass_hd.userData.lo);
      t.note('groundLuma', { night: +night.toFixed(1), noon: +noon.toFixed(1), ratio: +(night / noon).toFixed(3), hd });
      // the foundation measures 116 / 169 = 0.69 on the base art (same metric, 1280 × 720); the lighting, not the art, is
      // what this checks, so the ratio holds for any resident art
      t.ok(night / noon >= 0.62, 'night / noon ' + (night / noon).toFixed(3) + ' ≥ 0.62');
      if (hd) t.ok(night >= 110, 'night ground mean luminance ' + night.toFixed(1) + ' ≥ 110 (HD art)');
      D.freezeTime(false);
    }],
    ['night: Pip\'s light sits over the eye (no hot spot on a wall at talk distance); its strength is the viewmodel\'s input', async (t) => {
      const { D, game } = t, sky = game.sky, L = sky.pipLight;
      D.setTime(21.5); D.freezeTime(true); D.pose('meadow'); D.look(t.view.yaw, 0); t.frames(2);
      const c = game.camera.position.clone(), yaw = t.view.yaw;
      t.ok(Math.hypot(L.position.x - c.x, L.position.z - c.z) < 0.15 && L.position.y - c.y > 0.5, 'FP: over the eye, never ahead of it', [L.position.x - c.x, L.position.y - c.y, L.position.z - c.z]);
      t.near(L.intensity, sky.night * TA.pipI, 1e-6, 'intensity = night × pipI (WP2\'s viewmodel copies it, ARCHITECTURE §13)');
      // a white wall 2 m ahead: its centre may not be much brighter than 0.6 m to the left or 0.5 m up
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      wall.position.set(c.x + Math.sin(yaw) * 2, c.y, c.z + Math.cos(yaw) * 2); wall.lookAt(c.x, c.y, c.z); wall.userData.cull = { dist: Infinity };
      game.scene.add(wall);
      let r;
      try {
        const f = await readFrame(t), at = (dx, dy) => {
          const p = new THREE.Vector3(wall.position.x - Math.cos(yaw) * dx, wall.position.y + dy, wall.position.z + Math.sin(yaw) * dx).project(game.camera);
          const px = Math.round((p.x * 0.5 + 0.5) * f.w), py = Math.round((p.y * 0.5 + 0.5) * f.h);
          let s = 0, n = 0; for (let y = py - 4; y <= py + 4; y++) for (let x = px - 4; x <= px + 4; x++) { s += luma(f.px, (y * f.w + x) * 4); n++; } return s / n;
        };
        r = { centre: at(0, 0), left: at(0.6, 0), up: at(0, 0.5) };
      } finally { game.scene.remove(wall); wall.geometry.dispose(); wall.material.dispose(); }
      t.note('wall', r);
      t.ok(r.centre <= 1.25 * Math.max(r.left, r.up), 'wall centre ≤ 1.25 × its sides (a light ahead of the eye made ≈ 2×)', r);
      D.freezeTime(false);
    }],
    ['woods light shafts: every beam ends inside a round crown and shows only while the sun shines along it', async (t) => {
      const { game, D, W } = t, S = game.atmoShafts;
      if (!S) { t.ok(true, 'no shaft spot in this world'); return; }
      const spots = S.userData.spots;
      t.ok(spots.length >= 4, 'beams beside the woods path', spots.length);
      const crowns = W.colliders.filter((c) => c.kind === 'tree_round');
      const inside = spots.map((sp) => {
        const tx = sp[0] + sp[4] * sp[7], ty = sp[1] + sp[5] * sp[7], tz = sp[2] + sp[6] * sp[7];
        const c = crowns.find((q) => Math.hypot(q.x - tx, q.z - tz) < 0.3);
        return !!c && ty > c.camTop && ty < c.y1;
      });
      t.ok(inside.every(Boolean), 'each top end sits inside a crown (never drawn against the open sky)', inside);
      t.ok(TA.shaftK <= 0.45 && TA.shaftTop <= 1, 'soft (shaftK ' + TA.shaftK + ') and gone before the top end');
      const vis = {};
      for (const h of [9, 15, 22]) { D.setTime(h); D.freezeTime(true); t.frames(1); vis[h] = S.visible; }
      t.ok(vis[9] && !vis[15] && !vis[22], 'on in the morning, off in the afternoon (sun off the baked ray) and at night', vis);
      D.freezeTime(false);
    }],
    ['water: a low sun lays a sparkling glint path, never a white wash', async (t) => {
      const { D, W, game } = t, sky = game.sky;
      D.setTime(17.6); D.freezeTime(true); t.frames(1);
      const yaw = Math.atan2(sky.sunVis.x, sky.sunVis.z), v = seaVista(W, yaw);
      if (!v) { t.ok(true, 'no coast toward the sun'); D.freezeTime(false); return; }
      D.teleport(v.x, v.z, yaw, -0.02); t.G.debug.atmo.snapFog(); t.clearEnemies(); t.frames(3);
      const f = await readFrame(t), hr = horizonRow(t, f);
      let white = 0, n = 0;
      for (let r = hr + 4; r < f.h; r += 2) { const y = f.h - 1 - r; for (let x = 0; x < Math.round(f.w * 0.6); x += 2) { const i = (y * f.w + x) * 4; n++; if (f.px[i] >= 248 && f.px[i + 1] >= 248 && f.px[i + 2] >= 248) white++; } }
      const pct = (100 * white) / Math.max(1, n);
      t.note('whitePct', +pct.toFixed(3));
      t.ok(pct <= 0.5, 'clipped-white water ' + pct.toFixed(2) + ' % ≤ 0.5 % (it was 3.5–6 %)');
      t.ok(/lace \* near \* band/.test(game.waterMat.fragmentShader), 'foam lace only inside the shore band');
      D.freezeTime(false);
    }],
    ['steep faces (r2): rock is side-projected, not stretched down the fall line (a 60° rock face seen head-on: the texture keeps its proportions)', async (t) => {
      const { game } = t, A = t.G.debug.atmo, u = game.terrain.material.userData.uniforms, r = game.renderer;
      await Assets.loadDeferred();
      t.ok(u.uSide && u.uSide.value.x === TA.sideNy[0] && u.uSide.value.y === TA.sideNy[1], 'side projection on (desktop quality)', u.uSide && u.uSide.value.toArray());
      if (t.settings.get('quality') === 'low' || Assets.lowRes) return;
      // a 20 m rock-only face, normal y 0.5 (60°), drawn alone with the terrain material by a camera on its normal 6 m out
      const n = new THREE.Vector3(0, 0.5, Math.sqrt(0.75)), c0 = new THREE.Vector3(0, 60, 0), N = 4;
      const geo = new THREE.PlaneGeometry(20, 20); geo.lookAt(n);
      geo.setAttribute('splatA', new THREE.BufferAttribute(new Float32Array(N * 4), 4));
      geo.setAttribute('splatB', new THREE.BufferAttribute(new Float32Array(N * 4).map((v, i) => (i % 4 === 2 ? 1 : 0)), 4));
      const mesh = new THREE.Mesh(geo, game.terrain.material), sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.5, 100);
      mesh.position.copy(c0); sc.add(mesh, new THREE.AmbientLight(0xffffff, 2.5));
      cam.position.copy(c0).addScaledVector(n, 6); cam.lookAt(c0);
      const S = 192, rt = new THREE.WebGLRenderTarget(S, S), px = new Uint8Array(S * S * 4);
      /** correlation length (px) of the face's luminance along x and along y: first lag where the autocorrelation < 0.5 */
      const corr = async () => {
        r.setRenderTarget(rt); r.render(sc, cam); r.setRenderTarget(null);
        await r.readRenderTargetPixelsAsync(rt, 0, 0, S, S, px);   // (no synchronous GPU stall)
        const L = new Float32Array(S * S); let m = 0;
        for (let i = 0; i < S * S; i++) { L[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]; m += L[i]; }
        m /= S * S; for (let i = 0; i < S * S; i++) L[i] -= m;
        const ac = (dx, dy) => { let s = 0, q = 0; for (let y = 0; y < S - dy; y++) for (let x = 0; x < S - dx; x++) { const a = L[y * S + x]; s += a * L[(y + dy) * S + x + dx]; q += a * a; } return s / q; };
        let lx = 1, ly = 1; while (lx < 80 && ac(lx, 0) > 0.5) lx++; while (ly < 80 && ac(0, ly) > 0.5) ly++;
        return { lx, ly, k: +(ly / lx).toFixed(2) };
      };
      let on, off;
      try {
        A.features({ terrainCliff: false, terrainDetail: false });   // the cliff layer would cover a 60° rock face entirely
        on = await corr(); A.features({ terrainSide: false }); off = await corr();
      } finally { A.features({ terrainCliff: true, terrainSide: true, terrainDetail: true }); rt.dispose(); geo.dispose(); }
      t.note('corr', { on, off });
      // top-down, a 60° face stretches the texture 2× along the fall line (screen y here), side-projected 1.15× (1.73 apart)
      t.ok(off.k > on.k * 1.4, 'the texture is no longer stretched down the fall line', { on, off });
    }],
    ['quality low while playing: terrain slots swap to the lo files, anisotropy drops, near detail / cliff off', async (t) => {
      const { game, settings: S } = t, u = game.terrain.material.userData.uniforms, q0 = S.get('quality');
      await Assets.loadDeferred(); t.frames(1);
      const e = window.ASSET_MANIFEST && window.ASSET_MANIFEST.textures && window.ASSET_MANIFEST.textures.grass_hd;
      if (!Assets.textures.grass_hd || Assets.textures.grass_hd.userData.lo || !(e && e.lo) || q0 === 'low') { t.ok(true, 'no full HD grass in this load: nothing to lower'); return; }
      const arr = Object.assign({}, Assets.arrivals);
      let lo, aniso, detail, cliff, grain;
      try {
        S.set('quality', 'low');
        for (let i = 0; i < 150 && !u.tGrass.value.userData.lo; i++) await t.wait(20);
        t.frames(1);
        lo = u.tGrass.value.userData.lo === true && u.tGrass.value === Assets.textures.grass_hd;
        aniso = Object.values(Assets.textures).every((x) => !x || x.userData.fallback || x.anisotropy <= TA.anisoLow);
        detail = u.uDetail.value.z; cliff = u.uCliff.value.x; grain = u.uGrain ? u.uGrain.value.z : 0;
      } finally {
        S.set('quality', q0); await Assets.loadDeferred(); t.frames(1);
      }
      // r2: the arrival times are the first ones (the 'HD within 5 s of the title' test read the re-announced full files
      // after another suite's quality change: 24–100 s)
      const moved = Object.keys(arr).filter((k) => Assets.arrivals[k] !== arr[k]);
      Object.assign(Assets.arrivals, arr);
      t.eq(moved.length, 0, 'arrival times moved by the quality change: ' + moved.slice(0, 4).join(', '));
      t.ok(lo, 'grass slot holds the lo file');
      t.ok(aniso, 'resident anisotropy ≤ anisoLow');
      t.ok(detail === 0 && cliff < -1 && grain === 0, 'near detail, cliff and (r3) grain off', [detail, cliff, grain]);
      t.ok(!u.tGrass.value.userData.lo && u.uDetail.value.z === TA.detailAmt && u.uGrain.value.z === TA.grain.amt, 'raised again: the full file, the detail and the grain are back');
    }],
    ['r3 near-ground grain: a boot-generated layer (no asset) adds fine contrast to the ground at the feet, fades out by ≈ 4.5 m (the distance untouched), costs nothing beyond it', async (t) => {
      const { game, D } = t, u = game.terrain.material.userData.uniforms, A = t.G.debug.atmo, out = {};
      const tex = u.tGrain && u.tGrain.value;
      t.ok(tex && tex.isDataTexture && tex.image.width === 256 && tex.wrapS === THREE.RepeatWrapping && tex.generateMipmaps, 'a 256² tileable, mipmapped data texture made at boot');
      t.ok(u.uGrain.value.z === TA.grain.amt && u.uGrain.value.y <= 5 && u.uGrain.value.x < u.uGrain.value.y, 'on, gone by ≈ 4.5 m', u.uGrain.value.toArray());
      // FP on the shores dirt path looking down: fine contrast (mean |Laplacian| of the luminance) in the band 0.5–1.6 m
      // ahead with the grain and without; the rows beyond 15 m must not change
      D.setView('fp'); D.pose('shores'); D.look(t.view.yaw, -0.6); t.clearEnemies(); t.frames(3);
      const lap = (f, r0, r1) => {
        let s = 0, n = 0; const { w, px } = f;
        for (let y = Math.round(f.h * r0); y < Math.round(f.h * r1); y += 2) for (let x = Math.round(w * 0.2); x < Math.round(w * 0.8); x += 2) {
          const i = (y * w + x) * 4; s += Math.abs(4 * luma(px, i) - luma(px, i - 4) - luma(px, i + 4) - luma(px, i - 4 * w) - luma(px, i + 4 * w)); n++;
        }
        return s / n;
      };
      const diff = (a, b, r0, r1) => { let s = 0, n = 0; for (let y = Math.round(a.h * r0); y < Math.round(a.h * r1); y++) for (let x = 0; x < a.w; x += 3) { const i = (y * a.w + x) * 4; s += Math.abs(luma(a.px, i) - luma(b.px, i)); n++; } return s / n; };
      let on, off;
      try { A.features({ terrainGrain: true }); on = grab(game); A.features({ terrainGrain: false }); off = grab(game); } finally { A.features({ terrainGrain: true }); }
      // readPixels rows run bottom-up: the bottom of the screen (nearest ground) is row 0
      out.near = [+lap(off, 0.08, 0.4).toFixed(2), +lap(on, 0.08, 0.4).toFixed(2)];
      out.farDiff = +diff(on, off, 0.9, 0.98).toFixed(3);
      t.note('grain', out);
      t.ok(out.near[1] > out.near[0] * 1.15, 'more fine contrast at the feet with the grain', out.near);
      t.ok(out.farDiff < 0.5, 'the distance is untouched', out.farDiff);
    }],
    ['r3 terrain drawn after the other opaque objects (early depth test skips the splat shader under grass, props, trees): the same picture', async (t) => {
      const { game, D } = t, R = game.renderer, chunks = game.terrain.group.children, out = {};
      t.ok(chunks.length > 0 && chunks.every((m) => m.renderOrder === 1), 'every terrain chunk at renderOrder 1');
      t.ok(game.sky.dome.renderOrder > 1, 'the dome is still drawn last of the opaque world');
      const set = (v) => { for (const m of chunks) m.renderOrder = v; };
      for (const [pose, yaw, mode] of [['woods', 1.2, 'fp'], ['arena-woods', 0, 'tp']]) {
        D.setView(mode); D.pose(pose); D.look(yaw, -0.12); t.clearEnemies(); D.spawn('slime', 3, 0); t.frames(2);
        let a, b;
        try { set(0); a = grab(game); set(1); b = grab(game); } finally { set(1); }
        let n = 0; for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]) > 6) n++;
        out[pose] = +(n / (a.w * a.h)).toFixed(6);
      }
      t.note('pixels that differ (share)', out);
      t.ok(Object.values(out).every((v) => v < 0.0005), 'the same picture (≤ 0.05 % of pixels: depth ties at contact edges)', out);
    }],
    ['sky atlas builds with every billboard missing (procedural clouds / sun / moon, no isles)', async (t) => {
      const keep = Object.assign({}, Assets.billboards);
      for (const k of Object.keys(Assets.billboards)) delete Assets.billboards[k];
      let A = null;
      try { A = buildSkyAtlas(); } finally { Object.assign(Assets.billboards, keep); }
      t.ok(A && A.cells.sun && A.cells.moon && A.cells.cloud_a && A.cells.cloud_e, 'fallback cells');
      t.ok(A.cells.horizon_isle_a === null && A.cells.sky_isle === null, 'no stand-in isles');
      A.tex.dispose();
      const c = displayed(new THREE.Color(0.5, 0.5, 0.5), new THREE.Color());
      t.ok(c.r > 0.5 && c.r < 1, 'displayed() maps linear mid-grey up', c.r);
    }],
  ], { desc: 'WP8 atmosphere: sky, fog, terrain, water, shadows, ambient', prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12 } });

  suite('wp8-perf', [
    ['package cost: calls / triangles per feature (deterministic) + GPU attribution when the timer answers', async (t) => {
      const { game, D } = t, A = t.G.debug.atmo, out = {};
      const ON = A.features();
      const OFF = { fogAtmo: false, caps: false, shadowAhead: false, terrainDetail: false, terrainCliff: false, terrainPlaza: false, sprites: false, gulls: false, shafts: false };
      await Assets.loadDeferred();
      D.hud(false); D.setTime(12); D.freezeTime(true);
      const count = () => { t.frames(2, { draw: true }); const r = game.renderer.info.render; return { calls: r.calls, tris: r.triangles }; };
      const views = [['village', 0], ['meadow', null], ['woods', null], ['shores', null], ['hilltop', null]];
      try {
        for (const h of [12, 17]) for (const [pose, yaw] of views) {
          D.setTime(h); D.pose(pose); if (yaw != null) D.look(yaw, 0); t.clearEnemies();
          A.features(ON); t.frames(3); const on = count();
          A.features(OFF); t.frames(3); const off = count();
          out[pose + '@' + h] = { calls: on.calls, dCalls: on.calls - off.calls, tris: on.tris, dTris: on.tris - off.tris };
        }
        // GPU: a TIME_ELAPSED query around each render of the main scene (shadow pass included), waited for one by one,
        // configurations interleaved (the rAF sampling of D.perf drops most samples on this shared GPU): the package
        // (features on − off) and the terrain pass (on − terrain hidden, the water hidden in both so it does not stand in)
        const R = game.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), gpu = {};
        // TIME_ELAPSED queries cannot nest: wp7-perf's main-pass timer (its renderer.render wrapper) stands aside while
        // game.gpuT is set, as for wp7's own bench (r2: it was left on, and every render here logged beginQuery errors)
        const gpuT = game.gpuT, glErr = [];
        if (ext) game.gpuT = { begin() {}, end() {}, poll() {} };
        if (ext) try {
          const timed = async () => {
            gl.getParameter(ext.GPU_DISJOINT_EXT);
            gl.getError();
            const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); R.render(game.scene, game.camera); gl.endQuery(ext.TIME_ELAPSED_EXT);
            const err = gl.getError(); if (err) glErr.push(err);
            for (let i = 0; i < 200 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); i++) await t.wait(4);
            const dis = gl.getParameter(ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
            return dis ? null : ns / 1e6;
          };
          const water = game.scene.getObjectByName('water');
          const med = (a) => { const v = a.filter((x) => x != null).sort((x, y) => x - y); return v.length ? +v[v.length >> 1].toFixed(2) : null; };
          for (const [pose, yaw] of [['village', Math.PI], ['meadow', null]]) {
            D.setTime(12); D.pose(pose); if (yaw != null) D.look(yaw, 0); t.clearEnemies(); A.features(ON); t.frames(3);
            const S = { on: [], off: [], noWater: [], noTerrain: [] };
            try {
              for (let r = 0; r < 6; r++) for (const k of ['on', 'off', 'noWater', 'noTerrain']) {
                A.features(k === 'off' ? OFF : ON);
                if (water) water.visible = !(k === 'noWater' || k === 'noTerrain');
                game.terrain.group.visible = k !== 'noTerrain';
                R.render(game.scene, game.camera);
                for (let i = 0; i < 5; i++) S[k].push(await timed());
              }
            } finally { A.features(ON); if (water) water.visible = true; game.terrain.group.visible = true; }
            const g = gpu[pose] = { on: med(S.on), off: med(S.off), n: S.on.filter((x) => x != null).length };
            if (g.on != null && g.off != null) g.package = +(g.on - g.off).toFixed(2);
            const a = med(S.noWater), b = med(S.noTerrain);
            if (a != null && b != null) g.terrain = +(a - b).toFixed(2);
          }
        } finally { game.gpuT = gpuT; }
        t.note('gpu', gpu);
        t.eq(glErr.length, 0, 'GL errors around the timer queries (a query nested in another one)');
        // the lead's ≈ 1 ms for the package's own features; the terrain pass (arch accept 3: ≤ 1.5 ms) is reported, not
        // asserted: with the HD art at 1080p it measures ≈ 2.3–2.6 ms here against the foundation's ≈ 1.3 ms (docs/wp/WP8.md §6)
        const pg = Object.values(gpu).filter((g) => g.package != null);
        if (pg.length) t.ok(pg.every((g) => g.package <= 1.0), 'package (features on − off) ≤ 1.0 ms GPU', gpu);
        else t.note('gpuTimer', 'no timer: GPU budget not measured in this run');
      } finally { A.features(ON); D.hud(true); D.freezeTime(false); }
      t.note('cost', out);
      // lead's budget for the package: ≈ 25 calls and 60 k triangles in any view. OFF lacks the foundation's 3D puff-cloud
      // ring that WP8 removed (1 call, 38 808 triangles), so against the foundation the package adds dCalls − 1, dTris − PUFF
      const PUFF = 38808, worst = Object.entries(out).reduce((a, b) => (b[1].dCalls > a[1].dCalls ? b : a));
      const worstT = Object.entries(out).reduce((a, b) => (b[1].dTris > a[1].dTris ? b : a));
      t.ok(Object.values(out).every((o) => o.dCalls - 1 <= 25), 'package draw calls (main + shadow) ≤ 25 in every view; worst ' + worst[0] + ' +' + (worst[1].dCalls - 1), out);
      t.ok(Object.values(out).every((o) => o.dTris - PUFF <= 60000), 'package triangles ≤ 60 k in every view; worst ' + worstT[0] + ' +' + (worstT[1].dTris - PUFF), out);
    }],
  ], { desc: 'WP8 package cost: calls / triangles per feature, GPU attribution (timer query per render, ≈ 30 s)', heavy: true, prepare: { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12 } });
}
