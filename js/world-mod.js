// WP9 world content at eye level (module wp9-world). Everything here is presentation built once at attach: the Great
// Tree's crown (lobes, hanging leaf cards, lanterns, ivy over the back face), the four region landmarks (+ windmill
// sails, lighthouse beam), painted sign boards / signpost arms / waymarker icons (CanvasTexture atlases ≤ 512 px),
// window interior cards that glow at night, plaza bunting, lamp light pools, path-edge stones, arena edge rings (+ the
// entrance segment that rises during a fight), the altar's pulsing socket glows and the well frog. Colliders and
// anchors (W.pedestal, W.greatTree, W.landmarks, W.shots…) are made in world.js. Old saves: onSession moves a saved
// position that now lies inside a prop to the nearest free spot. Every art key has a procedural fallback.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './core.js';
import { EV } from './events.js';
import { world as TW } from './tune.js';
import { GB, toonMat, sharedOutline, outlineMat, U } from './toon.js';
import { Assets } from './assets.js';
import { Halos } from './fx.js';
import { SIGNS, SEED_ORDER } from './data.js';
import { HOUSE_WINDOWS, SIGN_BOARD, WAYMARK_PLAQUE, ALTAR, WELL, starShape, landmarkParts, waymarkerModel, propModel, PROP_KIND } from './props.js';
import { len2, TAU, angDiff, yawOf } from './util.js';

const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _near = [];
const frac = (v) => v - Math.floor(v);
const REGION_ICON = { woods: 'icon_woods', peaks: 'icon_peaks', shores: 'icon_shores', meadow: 'icon_meadow', village: 'icon_village', tree: 'icon_tree' };

// ------------------------------------------------------------------ small geometry helpers
/** a raw mesh geometry (no index) from flat arrays; color / glow default to white / 0 */
function rawGeo(pos, nor, uv, col, glow) {
  const g = new THREE.BufferGeometry(), n = pos.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col || new Array(n * 3).fill(1), 3));
  g.setAttribute('glow', new THREE.Float32BufferAttribute(glow || new Array(n).fill(0), 1));
  g.computeBoundingSphere();
  return g;
}
/** push a quad (two triangles) c ± r·hw ± u·hh with uv rect [u0, v0, u1, v1] (u along r, v up) */
function pushQuad(A, c, r, u, hw, hh, n, uvr, col = [1, 1, 1], glow = 0) {
  const P = (sr, su) => [c.x + r.x * hw * sr + u.x * hh * su, c.y + r.y * hw * sr + u.y * hh * su, c.z + r.z * hw * sr + u.z * hh * su];
  const [u0, v0, u1, v1] = uvr;
  const vs = [[P(-1, -1), u0, v0], [P(1, -1), u1, v0], [P(1, 1), u1, v1], [P(-1, -1), u0, v0], [P(1, 1), u1, v1], [P(-1, 1), u0, v1]];
  for (const [p, a, b] of vs) { A.pos.push(...p); A.nor.push(n.x, n.y, n.z); A.uv.push(a, b); A.col.push(...col); A.glow.push(glow); }
}
/** a disc (fan) in the plane (r, u) with uv mapped into the rect */
function pushDisc(A, c, r, u, rad, n, uvr, col = [1, 1, 1], glow = 0, seg = 18) {
  const [u0, v0, u1, v1] = uvr, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, hu = (u1 - u0) / 2, hv = (v1 - v0) / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
    for (const [ca, sa] of [[0, 0], [Math.cos(a0), Math.sin(a0)], [Math.cos(a1), Math.sin(a1)]]) {
      A.pos.push(c.x + (r.x * ca + u.x * sa) * rad, c.y + (r.y * ca + u.y * sa) * rad, c.z + (r.z * ca + u.z * sa) * rad);
      A.nor.push(n.x, n.y, n.z); A.uv.push(cu + ca * hu, cv + sa * hv); A.col.push(...col); A.glow.push(glow);
    }
  }
}
const acc = () => ({ pos: [], nor: [], uv: [], col: [], glow: [] });
/** the right vector of a viewer looking along -n (so text on a face with normal n reads left → right) */
function faceRight(n) { const yaw = Math.atan2(-n.x, -n.z); return new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)); }
/** yaw rotation of a local offset (x, z) */
function rotXZ(rot, x, z) { const c = Math.cos(rot), s = Math.sin(rot); return { x: x * c + z * s, z: -x * s + z * c }; }

function meshPair(built, mat, ol, o = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(built.geo, mat);
  m.castShadow = o.cast !== false; m.receiveShadow = !!o.receive;
  g.add(m);
  if (built.ol && ol) { const om = new THREE.Mesh(built.ol, ol); om.castShadow = false; om.raycast = () => {}; g.add(om); }
  g.userData.mesh = m;
  return g;
}
/** per-material fog cap (art §4.5: landmarks keep their colour at any distance): patches the fog chunk of this material
 *  only, under its own program key. Tolerant: if the chunk text is not the expected one (another package rewrote fog),
 *  the material is left as it is */
function capFog(mat, cap) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey, u = { value: cap };
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    const chunk = THREE.ShaderChunk.fog_fragment || '', capped = chunk.replace(/fogColor\s*,\s*fogFactor\s*\)/, 'fogColor, min( fogFactor, uFogCap ) )');
    if (capped === chunk || !sh.fragmentShader.includes('#include <fog_fragment>')) return;
    sh.uniforms.uFogCap = u;
    sh.fragmentShader = 'uniform float uFogCap;\n' + sh.fragmentShader.replace('#include <fog_fragment>', capped);
  };
  mat.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|fogcap'; };
  mat.userData.fogCap = u;
  return mat;
}
/** C10 tag for an object that stands at its own origin (a group placed where it stands: arena rings, the frog). WP7's
 *  culler measures from the object's origin, so only `o` carries the distance: its children ride on its visibility and
 *  fade and are tagged { dist: Infinity } (never tracked on their own), and an instanced mesh is never put in the generic
 *  culler. A mesh built in world coordinates (origin = world origin) goes through `spanCull` instead */
function cullTag(o, dist, fade = 0) {
  if (o.isInstancedMesh) { dist = Infinity; fade = 0; }
  o.userData.cull = { dist, fade };
  o.traverse((c) => { if (c !== o && !c.userData.cull) c.userData.cull = { dist: Infinity, fade: 0 }; });
  return o;
}

// ------------------------------------------------------------------ canvas helpers (signs, leaf cards, fallbacks)
function canvas(w, h) {
  try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); return x ? { c, x } : null; } catch (e) { return null; }
}
function canvasTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, Assets.maxAniso || 4);
  return t;
}
const FONT = "'Fredoka', 'Nunito', 'Varela Round', ui-rounded, 'Segoe UI', system-ui, sans-serif";
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
/** fit one line of text into width w at most `size` px */
function fitText(x, text, w, size, weight = 600) {
  let s = size;
  for (; s > 10; s -= 1) { x.font = `${weight} ${s}px ${FONT}`; if (x.measureText(text).width <= w) break; }
  return s;
}
/** procedural fallback icons (no ui_icons art): a coloured badge with a simple glyph */
function drawIconFallback(x, id, cx, cy, r) {
  const col = { woods: '#9a5aa0', peaks: '#8fd8ff', shores: '#ff9f8f', meadow: '#ffd23a', village: '#e05a48', tree: '#7aa63a' }[id] || '#c88a4a';
  x.fillStyle = col; x.strokeStyle = '#4a2c1a'; x.lineWidth = Math.max(2, r * 0.12);
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); x.stroke();
  x.fillStyle = '#fff6e2';
  if (id === 'peaks') { x.beginPath(); x.moveTo(cx - r * 0.6, cy + r * 0.4); x.lineTo(cx, cy - r * 0.55); x.lineTo(cx + r * 0.6, cy + r * 0.4); x.closePath(); x.fill(); }
  else if (id === 'woods') { x.beginPath(); x.arc(cx, cy - r * 0.05, r * 0.55, Math.PI, 0); x.fill(); x.fillRect(cx - r * 0.15, cy, r * 0.3, r * 0.45); }
  else if (id === 'shores') { x.beginPath(); x.arc(cx, cy + r * 0.25, r * 0.55, Math.PI, 0); x.fill(); }
  else { x.beginPath(); x.arc(cx, cy, r * 0.3, 0, TAU); x.fill(); }
}

// ------------------------------------------------------------------ the module
const mod = {
  name: 'wp9-world',
  attach(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = 'wp9';
    game.scene.add(this.root);
    this.anim = [];               // per-frame animators fn(t, dt)
    this.spans = [];              // island-wide world-space meshes the module culls itself (spanCull)
    this.stats = {};
    const tryBuild = (k, f) => { try { f.call(this, game); } catch (e) { this.stats[k + 'Error'] = String(e && e.message || e); if (G.debugOn) console.error('[Starseed] wp9 ' + k, e); } };
    const lmOpts = { glow: true, nightGlow: true, glowBase: 0.3, nightGlowAmt: 2.2, occ: true, nearFade: true };
    this.mats = {
      solid: toonMat({ glow: true }), ring: toonMat(lmOpts),
      lm: capFog(toonMat(lmOpts), TW.landmarkFogCap), olLm: capFog(outlineMat({ width: 0.05, occ: true }), TW.landmarkFogCap),
      olProp: sharedOutline('prop'), olBig: sharedOutline('big'),
    };
    tryBuild('lamps', this.buildLamps);
    tryBuild('tree', this.fixFallbackTree);
    tryBuild('crown', this.buildCrown);
    tryBuild('landmarks', this.buildLandmarks);
    tryBuild('signs', this.buildSigns);
    tryBuild('windows', this.buildWindows);
    tryBuild('bunting', this.buildBunting);
    tryBuild('pools', this.buildLightPools);
    tryBuild('stones', this.buildEdgeStones);
    tryBuild('waymarkers', this.buildWaymarkers);
    tryBuild('arenas', this.buildArenaEdges);
    tryBuild('sockets', this.buildSockets);
    tryBuild('frog', this.buildFrog);
    const ev = game.events;
    ev.on(EV.INTERACT, (p) => { if (p && p.kind === 'well' && this.frog) this.frog.waveT = 2.2; });
    ev.on(EV.BOSS_INTRO, (p) => this.gate(p && p.id, true));
    ev.on(EV.BOSS_FIGHT, (p) => this.gate(p && p.id, true));
    ev.on(EV.FIGHT_END, (p) => this.gate(p && p.id, false));
    this.registerDebug(game);
  },
  /** old saves: a saved position inside a prop that did not exist when it was saved goes to the nearest free spot */
  onSession(isNew) {
    const g = this.game;
    this.moved = null;
    if (!g || isNew) return;
    const pl = g.player, p0 = { x: pl.pos.x, z: pl.pos.z };
    if (this.freeSpot(p0.x, p0.z)) return;
    const W = g.world;
    for (let r = 0.5; r <= 14; r += 0.5) {
      const n = Math.max(8, Math.round(r * 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, x = p0.x + Math.sin(a) * r, z = p0.z + Math.cos(a) * r;
        if (!this.freeSpot(x, z)) continue;
        pl.place(x, z, g.view.yaw); g.view.snap(); g.clock.resetPhase();
        this.moved = { from: [p0.x, p0.z], to: [x, z] };
        return;
      }
    }
    pl.place(W.spawn.x, W.spawn.z, Math.PI); g.view.setLook(Math.PI, 0); g.view.snap();
    this.moved = { from: [p0.x, p0.z], to: [W.spawn.x, W.spawn.z] };
  },
  /** walkable, outside arenas, clear of every static and dynamic collider by Pip's radius */
  freeSpot(x, z) {
    const g = this.game, W = g.world, r = g.player.r;
    if (!W.walkable(x, z) || W.inArena(x, z, 1)) return false;
    W.nearColliders(x, z, r + 3, _near);
    for (const c of _near) if (len2(c.x - x, c.z - z) < c.r + r) return false;
    for (const d of g.dynamicColliders(g.player)) if (len2(d.x - x, d.z - z) < d.r + r) return false;
    return true;
  },

  // ---------------------------------------------------------------- Great Tree
  /** no GLB (?noassets): the procedural tree is already built at TW.treeH (props.js); give scatter's record the height
   *  and re-place the bloom seeds that game.js hung from it before this module ran */
  fixFallbackTree(game) {
    const T = game.scenery.greatTree, W = game.world;
    if (!T || T.glb) return;
    T.height = W.greatTree.scaleHeight;
    W.fitTreeColliders(null, T.height);
    (game.treeSeeds || []).forEach((g, i) => { const e = T.branchEnds[i * 2]; if (e) g.position.set(W.greatTree.x + e[0] * 0.8, W.greatTree.y + e[1] - T.height * 0.086, W.greatTree.z + e[2] * 0.8); });
  },
  buildCrown(game) {
    const T = game.scenery.greatTree, W = game.world;
    if (!T) return;
    const H = W.greatTree.scaleHeight, sb = H * 0.6;
    // the GLB canopy's own colours (art §0.2 samples) and the bloom's lush greens
    const olive = [0x796724, 0x8a722a, 0x947b2d, 0x857028], lush = [0x5e9e36, 0x6aa83e, 0x7cbc48, 0x66a63a];
    const a = new GB(), bl = new GB();
    // lobes widen the crown front-to-back (the GLB is only 0.47 H deep: a column from east and west); none in front of
    // the face, where the GLB's own canopy is the hero. Each lobe is a flattened pad with a scalloped rim of sub-lobes
    // The silhouette is one dome: the side pads sit low and close (the further to the side, the lower and smaller, so
    // they never rise as two "ears"), a ring of top pads and a crest climb toward one central top lobe at ≈ 1.0 H
    const lobes = [], n = TW.crownLobes;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + 0.17, front = Math.abs(angDiff(ang, 0)) < 0.95, sd = Math.abs(Math.sin(ang));
      if (front) continue;
      const y = H * (0.6 + 0.1 * frac(i * 0.618) - 0.05 * sd), r = H * (0.13 + 0.05 * frac(i * 0.377 + 0.2)) * (1 - 0.22 * sd);
      lobes.push({ x: Math.sin(ang) * H * 0.29, y, z: Math.cos(ang) * H * 0.28, r, ang, k: i });
    }
    for (let i = 0; i < 4; i++) { const ang = (i / 4) * TAU + 0.8; lobes.push({ x: Math.sin(ang) * H * 0.15, y: H * 0.8, z: Math.cos(ang) * H * 0.13 - H * 0.04, r: H * 0.14, ang, top: true, k: n + i }); }
    // the crest over the face (well above it) and the central top lobe, the highest point of the crown
    for (let i = 0; i < 3; i++) lobes.push({ x: (i - 1) * H * 0.17, y: H * (0.87 - Math.abs(i - 1) * 0.06), z: H * 0.02, r: H * (0.15 - Math.abs(i - 1) * 0.02), ang: (i - 1) * 0.6, top: true, k: n + 4 + i });
    lobes.push({ x: 0, y: H * 0.92, z: -H * 0.04, r: H * 0.15, ang: 0, top: true, k: n + 7 });
    const shadeFn = (base, hi) => { const c0 = new THREE.Color(base), c2 = new THREE.Color(hi), c1 = new THREE.Color(); return (x, y, z, nx, ny) => { c1.copy(c0).lerp(c2, Math.max(0, ny) * 0.55 + 0.08 * Math.sin(x * 2.1 + z * 1.7)); if (ny < -0.25) c1.multiplyScalar(0.78); return c1.getHex(); }; };
    for (const L of lobes) {
      const c = olive[L.k % 4], f = shadeFn(c, 0xb0a03a), fb = shadeFn(lush[L.k % 4], 0xa8dc5a);
      a.sphere(L.r, 0, { x: L.x, y: L.y, z: L.z, sy: 0.62, ry: L.ang, ws: 14, hs: 8, colorFn: f });
      bl.sphere(L.r * 1.04, 0, { x: L.x, y: L.y + 0.2, z: L.z, sy: 0.66, ry: L.ang, ws: 14, hs: 8, colorFn: fb });
      for (let p = 0; p < 5; p++) {
        const pa = L.ang + (p - 2) * 0.62, rr = L.r * 0.42, px = L.x + Math.sin(pa) * L.r * 0.8, pz = L.z + Math.cos(pa) * L.r * 0.8, py = L.y - L.r * 0.18;
        a.sphere(rr, 0, { x: px, y: py, z: pz, sy: 0.6, ws: 9, hs: 6, colorFn: f });
        bl.sphere(rr, 0, { x: px, y: py + 0.2, z: pz, sy: 0.65, ws: 9, hs: 6, colorFn: fb });
        bl.sphere(0.3, p % 2 ? 0xffb0c8 : 0xffffff, { x: px, y: py + rr * 0.55, z: pz, sy: 0.6, ws: 7, hs: 5, outline: false, glow: 0.15 });
      }
    }
    // the GLB canopy rim (per 12° bearing: the outermost canopy point and its height) → where the leaf cards hang
    const rim = this.canopyRim(T, H) || lobes.filter((L) => !L.top).map((L) => ({ ang: L.ang, r: Math.hypot(L.x, L.z) + L.r * 0.8, y: L.y - L.r * 0.3 }));
    for (const L of lobes) if (!L.top) rim.push({ ang: L.ang, r: Math.hypot(L.x, L.z) + L.r * 0.75, y: L.y - L.r * 0.35, lobe: true });
    // lanterns hanging under the canopy rim (0.55–0.75 H), plus a small cluster on the north (back) face
    const lanterns = [];
    for (let i = 0; i < TW.lanterns; i++) {
      const ang = 0.35 + (i / TW.lanterns) * TAU + (frac(i * 0.37) - 0.5) * 0.3;
      let best = rim[0];
      for (const q of rim) if (Math.abs(angDiff(q.ang, ang)) < Math.abs(angDiff(best.ang, ang))) best = q;
      const rr = best.r * 0.72, y = Math.min(best.y - 1.2, H * (0.55 + 0.2 * frac(i * 0.53 + 0.1)));
      lanterns.push({ x: Math.sin(ang) * rr, y, z: Math.cos(ang) * rr, top: best.y + 0.4 });
    }
    // the back face (the GLB has a face on both sides): measured from the GLB and covered with ivy, moss curtains and
    // two lanterns, so walking round the tree you meet a mossy trunk, not a second face
    const back = this.backFace(T, H);
    let mantle = 0;
    if (back) {
      const mossC = [0x4e6a26, 0x5a742a, 0x66782c, 0x5e6e28];
      for (let i = 0; i < 12; i++) {
        const dx = (frac(i * 0.618) - 0.5) * 4.4, y = H * (0.3 + 0.3 * frac(i * 0.414 + 0.13)), z = back(y, dx), r = 0.35 + 0.25 * frac(i * 0.73);
        a.sphere(r, mossC[i % 3], { x: dx, y, z: z + 0.08, sx: 1.4, sy: 0.7, sz: 0.35, ws: 8, hs: 5, outline: false });
      }
      // a thick moss mantle right over the second face (eyes ≈ 0.39 H, mouth ≈ 0.34 H, |x| < 1.8 m), just outside the
      // outermost bark vertex of each patch, so walking round the tree you meet moss and ivy, never a second face
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        const y = H * (0.29 + j * 0.04) + (frac(i * 0.37 + j * 0.61) - 0.5) * 0.3, dx = (i - 2) * 0.8 + (frac(i * 0.71 + j * 0.29) - 0.5) * 0.3;
        const z = Math.min(back(y, dx), back(y + 0.4, dx), back(y - 0.4, dx)), r = 0.42 + 0.12 * frac(i * 0.53 + j * 0.17);
        a.sphere(r, mossC[(i + j) % 4], { x: dx, y, z: z - 0.06, sx: 1.5, sy: 0.95, sz: 0.4, ws: 8, hs: 5, outline: false });
        mantle++;
      }
      for (let i = 0; i < 14; i++) {
        const dx = (frac(i * 0.37 + 0.2) - 0.5) * 4.2, y = H * (0.36 + 0.22 * frac(i * 0.71)), z = back(y, dx), L = 1.2 + 1.6 * frac(i * 0.29);
        a.cyl(0.07, 0.035, L, 0x5a8a2a, { x: dx, y: y - L / 2, z: z - 0.08, seg: 4, outline: false });
        a.sphere(0.12, 0x7aa63a, { x: dx, y: y - L, z: z - 0.08, ws: 6, hs: 4, outline: false });
      }
      for (const dx of [-1.2, 1.3]) lanterns.push({ x: dx, y: H * 0.42, z: back(H * 0.42, dx) - 0.6, top: H * 0.52 });
    }
    for (const Ln of lanterns) {
      const s = 1.6;
      a.cyl(0.012 * s, 0.012 * s, Math.max(0.2, Ln.top - Ln.y - 0.3), 0x5a3a24, { x: Ln.x, y: (Ln.top + Ln.y + 0.3) / 2, z: Ln.z, seg: 3, outline: false });
      a.cone(0.15 * s, 0.13 * s, 0x5a3a24, { x: Ln.x, y: Ln.y + 0.24 * s, z: Ln.z, seg: 6 });
      a.cyl(0.11 * s, 0.11 * s, 0.3 * s, 0xffd27a, { x: Ln.x, y: Ln.y, z: Ln.z, seg: 6, glow: 0.9 });
      a.cyl(0.09 * s, 0.12 * s, 0.06 * s, 0x5a3a24, { x: Ln.x, y: Ln.y - 0.17 * s, z: Ln.z, seg: 6 });
    }
    // mushrooms and moss between the roots
    for (const [ang, d] of [[2.1, 4.8], [4.2, 4.6], [0.15, 5.2], [3.2, 5.0], [1.05, 6.6], [5.3, 6.4]]) {
      const x = Math.sin(ang) * d, z = Math.cos(ang) * d;
      a.cyl(0.07, 0.09, 0.28, 0xfff0d8, { x, y: 0.14, z, seg: 6 });
      a.sphere(0.2, 0xe2574c, { x, y: 0.3, z, sy: 0.65, t1: Math.PI * 0.55, ws: 10, hs: 6 });
      a.sphere(0.4, 0x7aa63a, { x: x + 0.35, y: 0.08, z: z + 0.2, sy: 0.35, sx: 1.4, ws: 8, hs: 5, outline: false });
    }
    const crownMat = toonMat({ sway: 0.01, swayBase: sb, glow: true, nightGlow: true, glowBase: 0.4, nightGlowAmt: 1.6 });
    const crownOl = outlineMat({ width: 0.05, sway: 0.01, swayBase: sb });
    const ga = cullTag(meshPair(a.build(), crownMat, crownOl), Infinity), gb = cullTag(meshPair(bl.build(), crownMat, crownOl), Infinity);   // C10: part of the hero landmark
    gb.visible = false;
    // hanging leaf cards: crossed quads along the canopy rim (both card arts packed in one canvas), swaying
    const cardMat = this.leafCardMaterial(sb * 0.75);
    const C = acc(), up = new THREE.Vector3(0, 1, 0);
    let ci = 0;
    rim.forEach((q, i) => {
      if (ci >= TW.crownCards) return;
      const front = Math.abs(angDiff(q.ang, 0)) < 0.32;     // keep the face clear
      if (front && !q.lobe) return;
      const big = q.lobe ? 1 : 0.9 + 0.25 * frac(i * 0.53), cw = H * 0.11 * big, chh = cw * 2;
      const rr = q.r * (q.lobe ? 0.96 : 0.9), cx = Math.sin(q.ang) * rr, cz = Math.cos(q.ang) * rr, top = q.y + cw * 0.35;
      if (q.lobe && i % 3 === 1) return;                     // fewer per pad: drooping leaves, not bunches
      const half = i % 2 ? [0.5, 0, 1, 1] : [0, 0, 0.5, 1];
      const tint = 0.74 + 0.16 * frac(i * 0.73);
      const nrm = new THREE.Vector3(Math.sin(q.ang), 0.5, Math.cos(q.ang)).normalize();
      // one card facing out from the trunk (a flat curtain of leaves), turned a little so neighbours overlap unevenly;
      // tinted toward the canopy's olive green so it reads as foliage, not as ochre grape bunches
      const rot = q.ang + (frac(i * 0.41) - 0.5) * 0.7;
      pushQuad(C, { x: cx, y: top - chh / 2, z: cz }, new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)), up, cw / 2, chh / 2, nrm, half, [tint * 0.8, tint * 0.98, tint * 0.6]);
      ci++;
    });
    // a curtain of the same foliage over the GLB's back face (two rows, facing north, against the bark)
    if (back) {
      for (let i = 0; i < 18; i++) {
        const row = Math.floor(i / 6), dx = ((i % 6) - 2.5) * 0.85 + (row % 2 ? 0.42 : 0), cw = H * 0.085, chh = cw * 2;
        const top = H * [0.56, 0.47, 0.4][row], z = Math.min(back(top - chh * 0.2, dx), back(top - chh * 0.5, dx), back(top - chh * 0.8, dx)) - 0.35 - row * 0.12;
        const tint = 0.7 + 0.12 * frac(i * 0.37);
        pushQuad(C, { x: dx, y: top - chh / 2, z }, new THREE.Vector3(-1, 0, 0), up, cw / 2, chh / 2, new THREE.Vector3(0, 0.35, -1).normalize(), i % 2 ? [0.5, 0, 1, 1] : [0, 0, 0.5, 1], [tint * 0.82, tint, tint * 0.62]);
      }
    }
    const cards = cullTag(new THREE.Mesh(rawGeo(C.pos, C.nor, C.uv, C.col, C.glow), cardMat), Infinity);
    cards.castShadow = true;
    T.group.add(ga, gb, cards);
    this.crown = { a: ga, b: gb, cards, cardMat, lobes: lobes.length, lanterns: lanterns.length, cardsN: ci, bloomed: false, back: !!back, mantle, rim: rim.length, lobeList: lobes.map((L) => ({ x: +L.x.toFixed(2), y: +L.y.toFixed(2), r: +L.r.toFixed(2) })) };
    // lantern halos at night (fx.js Halos: additive points, uNight-scaled)
    try {
      const gp = T.group.position;
      this.lanternHalos = new Halos(game.scene, game.fx.atlas, lanterns.map((Ln) => ({ x: gp.x + Ln.x, y: gp.y + Ln.y, z: gp.z + Ln.z, size: 1.3, color: 0xffc070 })));
      // share the lamp halos' pixel-scale uniform: view.applyFov rescales game.halos on every FOV / resize change
      if (game.halos) { this.lanternHalos.uScale = game.halos.uScale; this.lanternHalos.mat.uniforms.uScale = game.halos.uScale; }
      this.lanternHalos.points.userData.cull = { dist: Infinity, fade: 0 };
    } catch (e) { /* halos are optional */ }
    this.anim.push(() => {
      const bloomNow = T.glb && T.glb.b ? T.glb.b.visible : (T.bloom && T.bloom.visible) || !!(game.S && game.S.ending) || !!(game.cutscene && game.cutscene.type === 'ending' && game.cutscene.stage >= 1);
      if (bloomNow !== this.crown.bloomed) {
        this.crown.bloomed = bloomNow; ga.visible = !bloomNow; gb.visible = bloomNow;
        cardMat.color.setRGB(bloomNow ? 0.8 : 1, bloomNow ? 1.12 : 1, bloomNow ? 0.72 : 1);
      }
    });
  },
  /** the GLB canopy's outer rim per 12° bearing: { ang, r, y } of its outermost point above 0.4 H (null without a GLB) */
  canopyRim(T, H) {
    const g = T.glb && T.glb.a;
    if (!g) return null;
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(T.group.matrixWorld).invert(), bins = [];
    g.traverse((m) => {
      if (!m.isMesh) return;
      const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 15000));
      _m.multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < p.count; i += step) {
        _v.fromBufferAttribute(p, i).applyMatrix4(_m);
        if (_v.y < H * 0.4) continue;
        const r = Math.hypot(_v.x, _v.z), k = ((Math.round((Math.atan2(_v.x, _v.z) / TAU) * 30) % 30) + 30) % 30;
        if (!bins[k] || r > bins[k].r) bins[k] = { ang: (k / 30) * TAU, r, y: _v.y };
      }
    });
    return bins.filter(Boolean);
  },
  /** z of the GLB's north (back) surface at height y, x ≈ dx (from the model's vertices; null without a GLB) */
  backFace(T, H) {
    const g = T.glb && T.glb.a;
    if (!g) return null;
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(T.group.matrixWorld).invert(), bins = new Map();
    g.traverse((m) => {
      if (!m.isMesh) return;
      const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 12000));
      _m.multiplyMatrices(inv, m.matrixWorld);
      for (let i = 0; i < p.count; i += step) {
        _v.fromBufferAttribute(p, i).applyMatrix4(_m);
        if (_v.y < H * 0.24 || _v.y > H * 0.62 || Math.abs(_v.x) > 2.4 || _v.z > 0) continue;
        const k = Math.round(_v.y / 0.5) * 100 + Math.round(_v.x / 1.1);
        bins.set(k, Math.min(bins.get(k) ?? 0, _v.z));
      }
    });
    if (!bins.size) return null;
    return (y, dx) => { let z = bins.get(Math.round(y / 0.5) * 100 + Math.round(dx / 1.1)); if (z == null) z = Math.min(...bins.values()) * 0.9; return z; };
  },
  /** both hanging-foliage cards side by side in one canvas (fallback: painted leaf clumps) */
  leafCardMaterial(swayBase) {
    const cv = canvas(512, 512);
    let tex;
    if (cv) {
      const draw = () => {
        cv.x.clearRect(0, 0, 512, 512);
        ['gt_foliage_card', 'gt_foliage_card_b'].forEach((k, i) => {
          const t = Assets.billboards[k] || Assets.textures[k], img = t && t.image;
          if (img && img.width) cv.x.drawImage(img, i * 256, 0, 256, 512);
          else {
            const cx = i * 256 + 128;
            cv.x.strokeStyle = '#6e4526'; cv.x.lineWidth = 6; cv.x.beginPath(); cv.x.moveTo(cx, 0); cv.x.lineTo(cx, 120); cv.x.stroke();
            for (let k = 0; k < 26; k++) { const y = 40 + k * 14, w = 100 - k * 3; cv.x.fillStyle = k % 2 ? '#a39a38' : '#8f8a2e'; cv.x.beginPath(); cv.x.ellipse(cx + Math.sin(k * 2.3) * w * 0.4, y, 34 - k * 0.6, 22, Math.sin(k), 0, TAU); cv.x.fill(); }
          }
        });
        if (tex) tex.needsUpdate = true;
      };
      draw();
      tex = canvasTex(cv.c);
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    const m = toonMat({ map: tex || null, sway: 0.014, swayBase, side: THREE.DoubleSide, nearFade: true });
    m.alphaTest = 0.45;
    return m;
  },

  // ---------------------------------------------------------------- landmarks
  buildLandmarks(game) {
    const W = game.world;
    this.landmarkObjs = {};
    for (const L of W.landmarks || []) {
      if (L.id === 'great_tree' || !L.prop) continue;
      const parts = landmarkParts(L.id, L.height);
      const g = new THREE.Group();
      g.position.set(L.x, L.y - 0.25, L.z);
      g.rotation.y = L.rot || 0;
      g.add(meshPair(parts.main, this.mats.lm, this.mats.olLm, { receive: true }));
      g.userData.landmark = L.id;
      if (parts.spin) {
        const sp = meshPair(parts.spin.built, this.mats.lm, this.mats.olLm);
        const piv = new THREE.Group();
        piv.position.set(...parts.spin.pivot);
        piv.add(sp);
        g.add(piv);
        this.anim.push((t) => { piv.rotation.z = -t * TW.windmillSpin; });
      }
      if (parts.beam) g.add(this.makeBeam(parts.beam));
      cullTag(g, Infinity);
      this.root.add(g);
      this.landmarkObjs[L.id] = g;
    }
  },
  /** the lighthouse's sweeping night beam: two long additive cones from the lamp room, uNight-scaled */
  makeBeam(at) {
    const len = 70, one = new THREE.ConeGeometry(6, len, 16, 1, true);
    one.translate(0, -len / 2, 0); one.rotateZ(Math.PI / 2);
    const two = one.clone(); two.scale(-1, 1, 1);
    const geo = mergeGeometries([one, two], false);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uNight: U.uNight, uCol: { value: new THREE.Color(0xfff0b0) } },
      vertexShader: 'varying float vD; void main(){ vD = clamp(abs(position.x) / 70.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uNight; uniform vec3 uCol; varying float vD; void main(){ float a = 0.32 * smoothstep(0.25, 0.75, uNight) * (1.0 - vD) * smoothstep(0.0, 0.04, vD); if (a < 0.003) discard; gl_FragColor = vec4(uCol * a, a); }',
    });
    const piv = new THREE.Group();
    piv.position.set(...at);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 7; m.frustumCulled = false; piv.add(m);
    this.anim.push((t) => { piv.rotation.y = t * TW.beamSpin; piv.visible = U.uNight.value > 0.2; });
    this.beam = piv;
    return piv;
  },

  // ---------------------------------------------------------------- signs, signpost, waymarkers
  buildSigns(game) {
    const W = game.world;
    const cv = canvas(512, 512), ic = canvas(256, 256);
    if (!cv || !ic) return;
    this.signCanvas = cv.c; this.iconCanvas = ic.c;
    const cells = {}, px = TW.signPx;
    const signs = W.interact.filter((it) => it.kind === 'sign' && !it.signpost && it.prop);
    const sp = W.signpost;
    let ci = 0;
    const cell = (key, title, icon, arm) => { const i = ci++, cx = (i % 2) * px, cy = Math.floor(i / 2) * 128; cells[key] = { cx, cy, title, icon, arm }; return cells[key]; };
    if (sp) for (const a of sp.arms) cell('arm_' + a.id, a.name, a.id, true);
    for (const it of signs) {
      const key = Object.keys(SIGNS).find((k) => SIGNS[k] === it.lines) || 'sign' + ci;
      it._cell = cell(key, (it.lines && it.lines[0]) || 'Sign', key.startsWith('arena_') ? key.slice(6) : key === 'village' ? 'village' : null, false);
    }
    const iconIds = ['woods', 'peaks', 'shores', 'meadow'];
    let iconImg = null, fontReady = false;
    const drawIcon = (x, id, cx, cy, size) => {
      const at = Assets.atlas.ui_icons, cellA = at && at.cells && at.cells[REGION_ICON[id]];
      if (iconImg && cellA) x.drawImage(iconImg, cellA.x, cellA.y, cellA.w, cellA.h, cx - size / 2, cy - size / 2, size, size);
      else if (iconImg) { const k = ['tree', 'woods', 'peaks', 'shores', 'meadow', 'village'].indexOf(id); const col = k < 0 ? 0 : k % 5, row = k === 5 ? 1 : 0; x.drawImage(iconImg, col * 128, row * 128, 128, 128, cx - size / 2, cy - size / 2, size, size); }
      else drawIconFallback(x, id, cx, cy, size * 0.42);
    };
    const draw = () => {
      const x = cv.x;
      x.clearRect(0, 0, 512, 512);
      for (const k in cells) {
        const c = cells[k], h = c.arm ? 80 : 128, y0 = c.cy + (128 - h) / 2;
        x.fillStyle = '#ecd2a4'; roundRect(x, c.cx + 4, y0 + 4, px - 8, h - 8, 14); x.fill();
        x.strokeStyle = '#a8703e'; x.lineWidth = 5; x.stroke();
        x.strokeStyle = 'rgba(168,112,62,0.25)'; x.lineWidth = 2;
        for (let g = 0; g < 4; g++) { x.beginPath(); x.moveTo(c.cx + 16, y0 + 18 + g * (h - 30) / 3); x.bezierCurveTo(c.cx + 90, y0 + 12 + g * (h - 30) / 3, c.cx + 160, y0 + 26 + g * (h - 30) / 3, c.cx + px - 16, y0 + 16 + g * (h - 30) / 3); x.stroke(); }
        const iconS = c.icon ? h - 26 : 0, tx = c.cx + 14 + (iconS ? iconS + 6 : 0), tw = px - 28 - (iconS ? iconS + 6 : 0);
        if (c.icon) drawIcon(x, c.icon, c.cx + 14 + iconS / 2, y0 + h / 2, iconS);
        x.fillStyle = '#5a3a24'; x.textAlign = 'center'; x.textBaseline = 'middle';
        const words = c.title.split(' ');
        const two = !c.arm && words.length > 1 && (fitText(x, c.title, tw, 40) < 30);
        if (two) {
          const mid = Math.ceil(words.length / 2), l1 = words.slice(0, mid).join(' '), l2 = words.slice(mid).join(' ');
          const s = Math.min(fitText(x, l1, tw, 36), fitText(x, l2, tw, 36));
          x.font = `600 ${s}px ${FONT}`;
          x.fillText(l1, tx + tw / 2, y0 + h / 2 - s * 0.55); x.fillText(l2, tx + tw / 2, y0 + h / 2 + s * 0.6);
        } else { const s = fitText(x, c.title, tw, c.arm ? 34 : 40); x.font = `600 ${s}px ${FONT}`; x.fillText(c.title, tx + tw / 2, y0 + h / 2 + 2); }
      }
      // icon atlas: 4 region icons, 128² each
      ic.x.clearRect(0, 0, 256, 256);
      iconIds.forEach((id, i) => { ic.x.fillStyle = '#ecd2a4'; ic.x.beginPath(); ic.x.arc((i % 2) * 128 + 64, Math.floor(i / 2) * 128 + 64, 62, 0, TAU); ic.x.fill(); drawIcon(ic.x, id, (i % 2) * 128 + 64, Math.floor(i / 2) * 128 + 64, 104); });
      if (this.signTex) this.signTex.needsUpdate = true;
      if (this.iconTex) this.iconTex.needsUpdate = true;
      this.stats.signDraws = (this.stats.signDraws || 0) + 1;
      this.stats.signFont = fontReady;
      this.stats.signIcons = !!iconImg;
    };
    draw();
    this.signTex = canvasTex(cv.c); this.iconTex = canvasTex(ic.c);
    this.redrawSigns = draw;
    // late arrivals: the Fredoka face and the ui_icons sheet (both optional)
    try { if (document.fonts && document.fonts.load) document.fonts.load(`600 40px ${FONT}`).then(() => { fontReady = true; draw(); }, () => {}); } catch (e) { /* no font API */ }
    const url = Assets.url('ui', 'ui_icons');
    if (url) { const im = new Image(); im.onload = () => { iconImg = im; draw(); }; im.onerror = () => {}; im.src = url; }
    // quads: sign boards, signpost arm faces (both sides), waymarker plaques (both sides)
    const A = acc(), I = acc(), up = new THREE.Vector3(0, 1, 0);
    const uvCell = (c, h) => { const y0 = c.cy + (128 - h) / 2; return [(c.cx + 8) / 512, 1 - (y0 + h - 6) / 512, (c.cx + px - 8) / 512, 1 - (y0 + 6) / 512]; };
    for (const it of signs) {
      const p = it.prop, n = new THREE.Vector3(Math.sin(p.rot), 0, Math.cos(p.rot)), r = faceRight(n);
      const c = { x: p.x + n.x * SIGN_BOARD.z, y: p.y + SIGN_BOARD.y, z: p.z + n.z * SIGN_BOARD.z };
      pushQuad(A, c, r, up, SIGN_BOARD.w / 2, SIGN_BOARD.h / 2, n, uvCell(it._cell, 128));
    }
    if (sp) {
      const g = this.buildSignpostModel(sp);
      for (const a of sp.arms) {
        const d = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)), side = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
        for (const s of [1, -1]) {
          const n = side.clone().multiplyScalar(s), r = faceRight(n);
          const c = { x: sp.x + d.x * 0.42 + n.x * 0.041, y: sp.y + a.y, z: sp.z + d.z * 0.42 + n.z * 0.041 };
          pushQuad(A, c, r, up, 0.33, 0.1, n, uvCell(cells['arm_' + a.id], 80));
        }
      }
      this.root.add(this.spanCull(g, [sp.x, sp.z], 90));   // built in world coordinates: culled from the signpost itself
    }
    for (const w of W.waymarkers || []) {
      const i = Math.max(0, iconIds.indexOf(w.region)), uv = [(i % 2) * 0.5 + 0.01, 1 - (Math.floor(i / 2) + 1) * 0.5 + 0.01, (i % 2) * 0.5 + 0.49, 1 - Math.floor(i / 2) * 0.5 - 0.01];
      for (const s of [1, -1]) {
        const o = rotXZ(w.rot, s * (WAYMARK_PLAQUE.x - 0.005), 0), n = new THREE.Vector3(Math.cos(w.rot) * s, 0, -Math.sin(w.rot) * s), r = faceRight(n);
        pushDisc(I, { x: w.x + o.x, y: w.y + WAYMARK_PLAQUE.y, z: w.z + o.z }, r, up, WAYMARK_PLAQUE.r, n, uv);
      }
    }
    const mBoards = toonMat({ map: this.signTex, vc: false }), mIcons = toonMat({ map: this.iconTex, vc: false });
    mIcons.alphaTest = 0.3;
    // island-wide meshes in world coordinates (the village sign to Pinch's Cove, 121 m out; every waymarker): drawn while
    // the camera is within their distance of the NEAREST board / plaque (spanCull), never measured from the world origin
    const boardPts = signs.flatMap((it) => [it.prop.x, it.prop.z]).concat(sp ? [sp.x, sp.z] : []), wmPts = (W.waymarkers || []).flatMap((w) => [w.x, w.z]);
    if (A.pos.length) { const m = new THREE.Mesh(rawGeo(A.pos, A.nor, A.uv), mBoards); m.receiveShadow = true; this.root.add(this.spanCull(m, boardPts, 120)); this.signBoards = m; }
    if (I.pos.length) { const m = new THREE.Mesh(rawGeo(I.pos, I.nor, I.uv), mIcons); this.root.add(this.spanCull(m, wmPts, 90)); this.waymarkIcons = m; }
    this.stats.signs = signs.length + (sp ? 1 : 0); this.stats.signFaces = A.pos.length / 18; this.stats.waymarkers = (W.waymarkers || []).length;
  },
  /** the plaza signpost: a 2.3 m post with a little sprout on top and four arrow-shaped arms pointing down the paths */
  buildSignpostModel(sp) {
    const b = new GB();
    b.cyl(0.075, 0.09, 2.3, 0x8a5a30, { x: sp.x, y: sp.y + 1.15, z: sp.z, seg: 8 });
    b.cyl(0.13, 0.15, 0.12, 0x7a4b2a, { x: sp.x, y: sp.y + 2.33, z: sp.z, seg: 8 });
    b.sphere(0.09, 0x8fd14f, { x: sp.x + 0.07, y: sp.y + 2.46, z: sp.z, sx: 1.4, sy: 0.45, rz: 0.5, ws: 8, hs: 5 });
    b.sphere(0.09, 0x8fd14f, { x: sp.x - 0.07, y: sp.y + 2.46, z: sp.z, sx: 1.4, sy: 0.45, rz: -0.5, ws: 8, hs: 5 });
    for (let i = 0; i < 3; i++) b.ico(0.13, 0xa8a096, { x: sp.x + Math.sin(i * 2.1) * 0.22, y: sp.y + 0.04, z: sp.z + Math.cos(i * 2.1) * 0.22, sy: 0.5, detail: 0, outline: false });
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.42, -0.13); arrow.lineTo(0.3, -0.13); arrow.lineTo(0.48, 0); arrow.lineTo(0.3, 0.13); arrow.lineTo(-0.42, 0.13); arrow.closePath();
    for (const a of sp.arms) {
      const d = { x: Math.sin(a.yaw), z: Math.cos(a.yaw) };
      b.shape(arrow, 0.05, 0xb07a48, { x: sp.x + d.x * 0.48, y: sp.y + a.y, z: sp.z + d.z * 0.48, ry: a.yaw - Math.PI / 2, bevel: 0.01 });
    }
    return meshPair(b.build(), this.mats.solid, this.mats.olProp, { receive: true });
  },

  // ---------------------------------------------------------------- window interiors
  buildWindows(game) {
    const W = game.world;
    const tex = Assets.tex('interiors', { make: () => this.interiorFallback() });
    const at = Assets.atlas.interiors || (tex.userData && tex.userData.atlas) || { cells: { fireplace: { x: 0, y: 0, w: 384, h: 384 }, kitchen: { x: 384, y: 0, w: 384, h: 384 }, bedroom: { x: 0, y: 384, w: 384, h: 384 }, library: { x: 384, y: 384, w: 384, h: 384 } }, size: [768, 768] };
    const [SW, SH] = at.size || [768, 768];
    const fallback = !!(tex.userData && tex.userData.fallback) || !Assets.atlas.interiors;
    const uvOf = (name, aspect) => {
      if (fallback && !Assets.atlas.interiors) return [0.05, 0.05, 0.95, 0.95];
      const c = at.cells[name] || Object.values(at.cells)[0];
      const k = 0.78, w = c.w * k * Math.min(1, aspect), h = c.h * k / Math.max(1, aspect), cx = c.x + c.w / 2, cy = c.y + c.h * 0.52;
      return [(cx - w / 2) / SW, 1 - (cy + h / 2) / SH, (cx + w / 2) / SW, 1 - (cy - h / 2) / SH];
    };
    const rooms = ['fireplace', 'bedroom', 'kitchen', 'library'];
    const A = acc(), up = new THREE.Vector3(0, 1, 0), col = [0.78, 0.78, 0.76];
    const place = (b, list, pick) => {
      list.forEach((w, i) => {
        const o = rotXZ(b.rot, w.x, w.z), n = new THREE.Vector3(Math.sin(b.rot + w.ry), 0, Math.cos(b.rot + w.ry)), r = faceRight(n);
        const c = { x: b.x + o.x, y: b.y - 0.05 + w.y, z: b.z + o.z }, room = pick(i);
        if (w.r) pushDisc(A, c, r, up, w.r * 0.94, n, uvOf(room, 1), col, 1);
        else pushQuad(A, { x: c.x + n.x * 0.002, y: c.y, z: c.z + n.z * 0.002 }, r, up, w.w / 2, w.h / 2, n, uvOf(room, w.w / w.h), col, 1);
      });
    };
    W.houses.forEach((h, k) => place(h, HOUSE_WINDOWS[h.type] || [], (i) => rooms[(k + i) % 4]));
    if (W.shop) place(W.shop, HOUSE_WINDOWS.shop, (i) => ['kitchen', 'library', 'bedroom', 'fireplace'][i % 4]);
    if (!A.pos.length) return;
    const m = toonMat({ map: tex, glow: true, nightGlow: true, glowBase: 0.08, nightGlowAmt: 1.15 });
    const mesh = new THREE.Mesh(rawGeo(A.pos, A.nor, A.uv, A.col, A.glow), m);
    this.root.add(this.spanCull(mesh, W.houses.concat(W.shop ? [W.shop] : []).flatMap((b) => [b.x, b.z]), 110));
    this.windows = mesh;
    this.stats.windows = A.pos.length / 3;
  },
  interiorFallback() {
    const cv = canvas(128, 128);
    if (!cv) return null;
    const x = cv.x, g = x.createRadialGradient(64, 70, 6, 64, 70, 80);
    g.addColorStop(0, '#ffe2a0'); g.addColorStop(0.5, '#e8a860'); g.addColorStop(1, '#8a5030');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#6e4526'; x.fillRect(0, 96, 128, 32);
    x.fillStyle = '#fff3c0'; x.beginPath(); x.arc(40, 46, 10, 0, TAU); x.fill();
    return canvasTex(cv.c);
  },

  // ---------------------------------------------------------------- plaza bunting
  buildBunting(game) {
    const W = game.world, T = W.greatTree, plaza = W.lamps.filter((l) => len2(l.x - W.plaza.x, l.z - W.plaza.z) < W.plaza.r + 1);
    if (plaza.length < 2) return;
    // the tree's face looks south (+Z): no string may cross it in the spawn view. A south lamp's trunk end goes round to
    // the side of the trunk (≥ 75° off the face), and there is no lamp-to-lamp string across the south
    const strings = [], top = (l) => ({ x: l.x, y: l.y + 2.5, z: l.z }), FACE = 1.31;
    for (const l of plaza) {
      let a = Math.atan2(l.x - T.x, l.z - T.z);
      if (Math.abs(angDiff(a, 0)) < FACE) a = Math.sign(a || 1) * FACE;
      strings.push([top(l), { x: T.x + Math.sin(a) * 5.2, y: T.y + 6.2, z: T.z + Math.cos(a) * 5.2 }, 0.9]);
    }
    const byAng = plaza.slice().sort((p, q) => Math.atan2(p.x, p.z) - Math.atan2(q.x, q.z));
    for (let i = 0; i < byAng.length; i++) {
      const p = byAng[i], q = byAng[(i + 1) % byAng.length], mid = Math.atan2((p.x + q.x) / 2 - T.x, (p.z + q.z) / 2 - T.z);
      if (len2(p.x - q.x, p.z - q.z) < 22 && Math.abs(angDiff(mid, 0)) > 0.8) strings.push([top(p), top(q), 0.55]);
    }
    this.buntingStrings = strings.map(([a, b]) => [a, b]);
    const cols = [0xff9fb6, 0xfff3a0, 0x9fdcff, 0xb9f07a].map((h) => new THREE.Color(h));
    const A = acc();
    let flags = 0;
    for (const [a, b, sag] of strings) {
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), n = Math.max(2, Math.round(len / 0.6));
      const P = (u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag, z: a.z + (b.z - a.z) * u });
      const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), nrm = new THREE.Vector3(-dir.z, 0.3, dir.x).normalize();
      for (let i = 0; i < n; i++) {
        const p0 = P(i / n), p1 = P((i + 1) / n), pm = P((i + 0.5) / n), c = cols[(flags++) % 4];
        // the cord: a thin ribbon; the flag: a triangle hanging from it (two-sided material)
        for (const v of [[p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], [p1.x, p1.y - 0.025, p1.z], [p0.x, p0.y, p0.z], [p1.x, p1.y - 0.025, p1.z], [p0.x, p0.y - 0.025, p0.z]]) { A.pos.push(...v); A.nor.push(nrm.x, nrm.y, nrm.z); A.uv.push(0, 0); A.col.push(0.94, 0.89, 0.78); A.glow.push(0); }
        const w = 0.11;
        for (const v of [[pm.x - dir.x * w, pm.y, pm.z - dir.z * w], [pm.x + dir.x * w, pm.y, pm.z + dir.z * w], [pm.x, pm.y - 0.22, pm.z]]) { A.pos.push(...v); A.nor.push(nrm.x, nrm.y, nrm.z); A.uv.push(0, 0); A.col.push(c.r, c.g, c.b); A.glow.push(0.12); }
      }
    }
    const m = toonMat({ glow: true, side: THREE.DoubleSide, sway: 0.012, swayBase: 1.5, nearFade: true });
    const mesh = new THREE.Mesh(rawGeo(A.pos, A.nor, A.uv, A.col, A.glow), m);
    mesh.castShadow = false;   // thin cords: their shadow is not worth a shadow-pass draw call
    this.root.add(this.spanCull(mesh, strings.flatMap(([a, b]) => [a.x, a.z, b.x, b.z]), 90));
    this.bunting = mesh;
    this.stats.buntingFlags = flags;
  },

  // ---------------------------------------------------------------- lamp light pools
  buildLightPools(game) {
    const W = game.world, lamps = W.lamps;
    if (!lamps.length) return;
    const geo = new THREE.CircleGeometry(3, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uNight: U.uNight, uCol: { value: new THREE.Color(0xffc27a) } },
      vertexShader: 'varying vec2 vP;\nvoid main(){\n vP = position.xz / 3.0;\n vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n gl_Position = projectionMatrix * modelViewMatrix * p;\n}',
      fragmentShader: 'uniform float uNight; uniform vec3 uCol; varying vec2 vP; void main(){ float d = length(vP); float a = 0.45 * uNight * (1.0 - smoothstep(0.15, 1.0, d)); if (a < 0.004) discard; gl_FragColor = vec4(uCol * a, a); }',
    });
    const im = new THREE.InstancedMesh(geo, mat, lamps.length);
    lamps.forEach((l, i) => {
      const lx = l.x + Math.cos(l.rot) * 0.52, lz = l.z - Math.sin(l.rot) * 0.52;
      _m.makeTranslation(lx, W.ground(lx, lz) + 0.06, lz);
      im.setMatrixAt(i, _m);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.renderOrder = 2;
    this.root.add(this.spanCull(im, lamps.flatMap((l) => [l.x, l.z]), 120, () => U.uNight.value > 0.02));   // drawn at night only
    this.pools = im;
  },

  // ---------------------------------------------------------------- path-edge stones
  buildEdgeStones(game) {
    const st = game.world.edgeStones || [];
    if (!st.length) return;
    const b = new GB();
    b.ico(0.2, 0xb8ab98, { y: 0.06, sy: 0.55, sx: 1.2, detail: 0, jitter: 0.22, seed: 7, colorFn: (x, y, z, nx, ny) => (ny > 0.75 ? 0xc8bca8 : 0xb0a390) });
    const built = b.build();
    const mat = toonMat({ glow: true }), ol = sharedOutline('prop');
    const im = new THREE.InstancedMesh(built.geo, mat, st.length), om = new THREE.InstancedMesh(built.ol, ol, st.length);
    st.forEach((s, i) => {
      _q.setFromAxisAngle(_v.set(0, 1, 0), s.rot); _s.setScalar(s.s);
      _m.compose(_v.set(s.x, s.y - 0.03, s.z), _q, _s);
      im.setMatrixAt(i, _m);
      im.setColorAt(i, _c.setRGB(0.9 + s.k * 0.18, 0.9 + s.k * 0.14, 0.88 + s.k * 0.12));
    });
    om.instanceMatrix = im.instanceMatrix;
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); om.computeBoundingSphere();
    im.castShadow = false; im.receiveShadow = true; om.raycast = () => {};
    const g = new THREE.Group(); g.add(im, om);
    this.root.add(this.spanCull(g, st.flatMap((s) => [s.x, s.z]), 70));   // world-space instances: no scale fade (it would scale them about the origin)
    this.edgeStones = g;
    this.stats.edgeStones = st.length;
  },

  /** every lamp (plaza ring, paths, bridge ends) as one instanced mesh + outline: 2 draw calls island-wide instead of 2 per
   *  40 m chunk (props.js PROP_KIND has no `lamp`, so scatter.js skips them). Same model and material as scatter's
   *  'glow' kind; never culled (C10) */
  buildLamps(game) {
    const lamps = game.world.lamps, model = propModel('lamp');
    if (!lamps.length || !model || PROP_KIND.lamp) return;
    const mat = toonMat({ glow: true, nightGlow: true, glowBase: 0.25, nightGlowAmt: 1.8 });
    const im = new THREE.InstancedMesh(model.geo, mat, lamps.length);
    lamps.forEach((l, i) => { _q.setFromAxisAngle(_v.set(0, 1, 0), l.rot || 0); _s.setScalar(l.s || 1); _m.compose(_v.set(l.x, l.y, l.z), _q, _s); im.setMatrixAt(i, _m); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    const g = new THREE.Group(); g.add(im);
    if (model.ol) { const om = new THREE.InstancedMesh(model.ol, sharedOutline('prop'), lamps.length); om.instanceMatrix = im.instanceMatrix; om.computeBoundingSphere(); om.castShadow = false; om.raycast = () => {}; g.add(om); }
    this.root.add(cullTag(g, Infinity));
    this.lampMesh = g;
  },
  /** every waymarker post as one instanced mesh + outline (2 draw calls island-wide instead of 2 per 40 m chunk) */
  buildWaymarkers(game) {
    const list = game.world.waymarkers || [];
    if (!list.length) return;
    const built = waymarkerModel(), im = new THREE.InstancedMesh(built.geo, this.mats.solid, list.length), om = new THREE.InstancedMesh(built.ol, this.mats.olProp, list.length);
    list.forEach((w, i) => { _q.setFromAxisAngle(_v.set(0, 1, 0), w.rot); _s.setScalar(1); _m.compose(_v.set(w.x, w.y, w.z), _q, _s); im.setMatrixAt(i, _m); });
    om.instanceMatrix = im.instanceMatrix; im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere(); om.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true; om.castShadow = false; om.raycast = () => {};
    const g = new THREE.Group(); g.add(im, om);
    this.root.add(this.spanCull(g, list.flatMap((w) => [w.x, w.z]), 90));
    this.waymarkPosts = g;
  },

  // ---------------------------------------------------------------- arena edge rings
  /** a low ring of stones (shells on the shores, snow-capped on the peaks, mossy logs and glowshrooms in the woods)
   *  exactly where the fight clamp stops Pip (r − 0.3 m), open at the entrance; the entrance segment rises during the
   *  fight so the clamp is never an invisible wall */
  buildArenaEdges(game) {
    const W = game.world;
    this.gates = {};
    for (const id in W.arenas) {
      const a = W.arenas[id], R = a.ring ? a.ring.R : a.r + 0.02, half = a.ring ? a.ring.gap : 0.36, ring = new GB(), gate = new GB();   // world.js a.ring: the stones' colliders
      const tone = id === 'peaks' ? [0x9aa4ae, 0xf6faff] : id === 'shores' ? [0xe8d2a8, 0xf5e6c8] : [0x9aa070, 0x8ab048];   // peaks: grey stone, snow caps (reads on snow)
      const n = a.ring ? a.ring.n : Math.round((TAU * R) / 0.62);
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU, inGap = Math.abs(angDiff(ang, a.entAng)) < half;
        if (a.ring && a.ring.open.some((b) => Math.abs(angDiff(ang, b)) < 0.3)) continue;   // opened toward a nook (world.js openRings)
        const x = Math.sin(ang) * R, z = Math.cos(ang) * R, y = W.hAt(a.x + x, a.z + z) - a.h;
        const B = inGap ? gate : ring, s = 0.85 + 0.3 * frac(k * 0.618);
        B.ico(0.3 * s, 0, { x, y: y + 0.12 * s, z, sy: 0.75, sx: 1.25, ry: ang, detail: 0, jitter: 0.18, seed: k, colorFn: (px, py, pz, nx, ny) => (ny > 0.6 ? tone[1] : tone[0]), glow: inGap ? 0.25 : 0 });
        if (!inGap && k % 3 === 0) {
          if (id === 'shores') B.cone(0.1, 0.14, 0xffb8c0, { x: x * 0.985, y: y + 0.31 * s, z: z * 0.985, rx: -0.4, seg: 7, outline: false });
          else if (id === 'peaks') B.add(new THREE.OctahedronGeometry(0.11, 0), 0xc8f0ff, { x: x * 0.99, y: y + 0.42 * s, z: z * 0.99, sy: 2.2, rz: 0.25, flat: true, glow: 0.45, outline: false });
          else if (id === 'woods') { B.cyl(0.04, 0.05, 0.22, 0xfff2dc, { x: x * 0.98, y: y + 0.33, z: z * 0.98, seg: 5, outline: false }); B.sphere(0.1, 0x45d6c4, { x: x * 0.98, y: y + 0.45, z: z * 0.98, sy: 0.7, t1: Math.PI * 0.55, glow: 0.4, outline: false, ws: 8, hs: 5 }); }
        }
      }
      const g = new THREE.Group();
      g.position.set(a.x, a.h, a.z);
      g.add(meshPair(ring.build(), this.mats.ring, null, { receive: true }));
      const gm = meshPair(gate.build(), this.mats.ring, null, { receive: true });
      gm.position.y = -0.55; gm.visible = false;   // sunk out of sight (and not drawn) until a fight
      g.add(gm);
      this.gates[id] = { g: gm, k: 0, target: 0 };
      this.root.add(cullTag(g, 130));
    }
    this.anim.push((t, dt) => { for (const id in this.gates) { const q = this.gates[id]; if (q.k !== q.target) { q.k = q.target > q.k ? Math.min(1, q.k + dt * 2.5) : Math.max(0, q.k - dt * 1.5); q.g.position.y = -0.55 + q.k * 0.55; q.g.visible = q.k > 0.001; } } });
  },
  gate(id, up) { const q = this.gates && this.gates[id]; if (q) q.target = up ? 1 : 0; },

  // ---------------------------------------------------------------- altar sockets
  buildSockets(game) {
    const P = game.world.pedestal;
    if (!P || !P.sockets) return;
    const b = new GB(), tilt = P.tilt ?? ALTAR.tilt, ny = Math.cos(tilt), nz = Math.sin(tilt);
    b.shape(starShape(0.16, 0.075), 0.012, 0xfff3a0, { y: 0.042 * ny, z: 0.042 * nz, rx: -(Math.PI / 2 - tilt), outline: false, glow: 1, bevel: 0.004 });
    const built = b.build(), mat = toonMat({ glow: true });
    const im = new THREE.InstancedMesh(built.geo, mat, 3);
    P.sockets.forEach((s, i) => { _m.makeTranslation(s.x, s.y, s.z); im.setMatrixAt(i, _m); });
    im.castShadow = false; im.computeBoundingSphere();
    this.root.add(this.spanCull(im, [P.x, P.z], 60));
    this.sockets = { im, mat, shown: [true, true, true] };
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    this.anim.push((t) => {
      const per = TW.socketPulse, k = 0.5 + 0.5 * Math.sin((t / per) * TAU);
      const gk = mat.userData.glowK;   // toon.js internal (WP7 owns it): pulse only while it exists
      if (gk && gk.value && gk.value.set) gk.value.set(0.35 + 0.4 * k, 0.6);
      const ps = game.pedSeeds || [];
      let dirty = false;
      P.sockets.forEach((s, i) => {
        const show = !(ps[i] && ps[i].visible) && !(game.S && game.S.seeds && game.S.seeds[SEED_ORDER[i]] === 2);
        if (show !== this.sockets.shown[i]) { this.sockets.shown[i] = show; im.setMatrixAt(i, show ? _m.makeTranslation(s.x, s.y, s.z) : ZERO); dirty = true; }
      });
      if (dirty) im.instanceMatrix.needsUpdate = true;
    });
  },

  // ---------------------------------------------------------------- the well frog
  buildFrog(game) {
    const W = game.world, well = W.props.find((p) => p.type === 'well');
    if (!well) return;
    const GR = 0x8cbf4a, body = new GB(), arm = new GB();
    body.cyl(0.32, 0.32, 0.02, 0x7cc048, { y: 0.0, seg: 16, outline: false });
    body.box(0.2, 0.025, 0.16, 0x2f4f6a, { x: 0.22, y: 0.005, z: 0.0, ry: 0.6, outline: false });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; body.sphere(0.04, 0xffb0c8, { x: -0.18 + Math.sin(a) * 0.035, y: 0.04, z: 0.1 + Math.cos(a) * 0.035, sy: 0.6, ws: 6, hs: 4, outline: false }); }
    body.sphere(0.1, GR, { y: 0.09, sy: 0.75, ws: 12, hs: 9 });
    body.sphere(0.07, 0xf4e8b0, { y: 0.07, z: 0.04, sy: 0.6, ws: 10, hs: 7, outline: false });
    for (const sd of [-1, 1]) {
      body.sphere(0.04, GR, { x: sd * 0.05, y: 0.16, z: 0.03, ws: 10, hs: 8 });
      body.sphere(0.026, 0xffffff, { x: sd * 0.05, y: 0.165, z: 0.058, ws: 8, hs: 6, outline: false });
      body.sphere(0.015, 0x2a1a12, { x: sd * 0.05, y: 0.165, z: 0.078, ws: 6, hs: 5, outline: false });
      body.sphere(0.022, 0xff9f9f, { x: sd * 0.075, y: 0.1, z: 0.07, sz: 0.4, ws: 6, hs: 4, outline: false });
      body.sphere(0.035, GR, { x: sd * 0.07, y: 0.025, z: 0.07, sy: 0.4, sz: 1.4, ws: 8, hs: 5 });
    }
    body.torus(0.025, 0.006, 0x2a1a12, { y: 0.11, z: 0.083, arc: Math.PI, rz: Math.PI, ts: 8, rs: 3, outline: false });
    arm.capsule(0.016, 0.07, GR, { y: 0.045 });
    arm.sphere(0.024, GR, { y: 0.09, ws: 8, hs: 6 });
    const g = new THREE.Group();
    g.position.set(well.x, well.y + WELL.water + 0.012, well.z);
    g.rotation.y = well.rot;
    g.add(meshPair(body.build(), this.mats.solid, null, { cast: false }));   // in the well's own shadow anyway
    const piv = new THREE.Group();
    piv.position.set(-0.08, 0.1, 0.02);
    piv.add(meshPair(arm.build(), this.mats.solid, null, { cast: false }));
    g.add(piv);
    this.root.add(cullTag(g, 30));
    this.frog = { g, arm: piv, waveT: 0 };
    this.anim.push((t, dt) => {
      const f = this.frog, cp = game.camera.position;
      f.waveT = Math.max(0, f.waveT - dt);
      // a 20 cm frog inside a well: not drawn beyond its C10 distance (the same 30 m WP7's culler will use)
      g.visible = len2(cp.x - well.x, cp.z - well.z) < 30;
      piv.rotation.z = f.waveT > 0 ? 1.9 + Math.sin(t * 14) * 0.45 : 0.25;
      g.position.y = well.y + WELL.water + 0.012 + Math.sin(t * 1.3) * 0.006;
      // turn toward Pip when he is close (the frog notices you)
      const pl = game.player.pos;
      if (len2(pl.x - well.x, pl.z - well.z) < 4) g.rotation.y += Math.atan2(Math.sin(yawOf(pl.x - well.x, pl.z - well.z) - g.rotation.y), Math.cos(yawOf(pl.x - well.x, pl.z - well.z) - g.rotation.y)) * Math.min(1, dt * 4);
    });
  },

  /** C10 for an island-wide mesh built in world coordinates (its origin is the world origin, not where it stands, so
   *  WP7's culler would measure the wrong distance and its scale fade would shrink it toward the plaza): the generic
   *  culler never tracks it ({ dist: Infinity }), and the module draws it only while the camera is within `dist` of its
   *  NEAREST part (pts = [x, z, …]) and `gate()` (if given) agrees. Nothing beside Pip is ever culled; far views skip it */
  spanCull(o, pts, dist, gate = null) {
    cullTag(o, Infinity);
    this.spans.push({ o, P: Float32Array.from(pts), d2: dist * dist, gate, near: true });
    return o;
  },
  /** after the camera moved (this frame's position): show / hide the spanCull meshes */
  afterCamera() {
    const c = this.game.camera.position, off = this.game.scenery && this.game.scenery.cullOff;   // G.debug.perf.cull(false): draw all
    for (const s of this.spans) {
      let near = !!off;
      for (let i = 0; i < s.P.length && !near; i += 2) { const dx = s.P[i] - c.x, dz = s.P[i + 1] - c.z; near = dx * dx + dz * dz < s.d2; }
      s.near = near;
      s.o.visible = near && (!s.gate || s.gate());
    }
  },

  // ---------------------------------------------------------------- per frame
  beforeCamera(alpha, dt) {
    const t = this.game.time;
    // one failing animator (e.g. a renamed toon.js field after a merge) is reported once and dropped; the others keep going
    for (let i = 0; i < this.anim.length; i++) {
      try { this.anim[i](t, dt); } catch (e) {
        this.stats.animError = String(e && e.message || e);
        if (G.debugOn && !this.quietAnim) console.warn('[Starseed] wp9 animator dropped', e);
        this.anim.splice(i--, 1);
      }
    }
  },

  // ---------------------------------------------------------------- debug (G.debug.wp9)
  registerDebug(game) {
    const self = this;
    game.registerDebug('wp9', {
      /** layout + build numbers */
      info() {
        const W = game.world, r2 = (v) => +(+v).toFixed(2);
        const lampsOnBridges = W.lamps.filter((l) => W.bridgeAt(l.x, l.z) !== null).length;
        return {
          genMs: r2(W.genMs), genT: W.genT, carved: W.carved, unreachable: W.unreachable.length, props: W.props.length, deco: W.deco.length,
          lamps: W.lamps.length, lampsOnBridges, coins: W.coinPicks, waymarkers: (W.waymarkers || []).length, edgeStones: (W.edgeStones || []).length,
          clearings: W.woodsGaps ? W.woodsGaps.clearings.length : 0, landmarks: (W.landmarks || []).map((L) => ({ id: L.id, x: r2(L.x), z: r2(L.z), height: L.height })),
          pedestal: { x: W.pedestal.x, z: W.pedestal.z, y: r2(W.pedestal.y), top: W.pedestal.top }, spawn: W.spawn, crown: self.crown ? { lobes: self.crown.lobes, cards: self.crown.cardsN, lanterns: self.crown.lanterns, back: self.crown.back, bloomed: self.crown.bloomed } : null,
          skyPick: W.skyPick, stats: self.stats, moved: self.moved,
        };
      },
      /** the module's scene objects by name (tests, screenshots) */
      objects() { return { root: self.root, crown: self.crown, lamps: self.lampMesh, landmarks: self.landmarkObjs, signBoards: self.signBoards, waymarkIcons: self.waymarkIcons, windows: self.windows, bunting: self.bunting, pools: self.pools, edgeStones: self.edgeStones, gates: self.gates, sockets: self.sockets, frog: self.frog, beam: self.beam }; },
      /** fraction of non-transparent pixels in the sign atlas (headless sign check) */
      signInk() {
        const c = self.signCanvas;
        if (!c) return 0;
        const cp = document.createElement('canvas'); cp.width = c.width; cp.height = c.height;   // one readback per copy
        const cx = cp.getContext('2d', { willReadFrequently: true }); cx.drawImage(c, 0, 0);
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        let ink = 0, dark = 0;
        for (let i = 0; i < d.length; i += 16) { if (d[i + 3] > 10) ink++; if (d[i + 3] > 10 && d[i] < 120 && d[i + 1] < 90) dark++; }
        return { ink: +(ink / (d.length / 16)).toFixed(3), text: +(dark / (d.length / 16)).toFixed(4), font: !!self.stats.signFont, icons: !!self.stats.signIcons };
      },
      /** the world mapper's landmark metric: line of sight from grid points (every `step` m, walkable, ≥ 15 m from the
       *  tree) at eye height to the crown (tree base + h·H) through every shadow-casting scenery mesh except the tree */
      losCrown(o = {}) {
        const W = game.world, T = W.greatTree, H = T.scaleHeight, step = o.step ?? 8, hk = o.h ?? 0.9;
        const tree = game.scenery.greatTree.group, isTree = (ob) => { while (ob) { if (ob === tree) return true; ob = ob.parent; } return false; };
        const occ = [];
        game.scenery.root.children.forEach((m) => { if ((m.isInstancedMesh ? m.castShadow : true) && !isTree(m)) occ.push(m); });
        for (const id in self.landmarkObjs || {}) occ.push(self.landmarkObjs[id]);
        const ray = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
        const ty = T.y + H * hk;
        let n = 0, v = 0;
        const by = {};
        for (let x = -170; x <= 170; x += step) for (let z = -170; z <= 170; z += step) {
          if (!W.walkable(x, z) || W.hAt(x, z) < 0.3) continue;
          const r = Math.hypot(x - T.x, z - T.z);
          if (r < 15) continue;
          const py = W.ground(x, z) + 0.88;
          o3.set(x, py, z); d3.set(T.x - x, ty - py, T.z - z);
          const dist = d3.length(); d3.normalize();
          let ok = true;
          for (let s = 0.5; s < dist - 1 && ok; s += 0.5) if (W.hAt(x + d3.x * s, z + d3.z * s) > py + d3.y * s) ok = false;
          if (ok) { ray.set(o3, d3); ray.near = 0.05; ray.far = dist - 1; ok = ray.intersectObjects(occ, true).length === 0; }
          const k = r < 40 ? 'a15-40' : r < 80 ? 'b40-80' : r < 120 ? 'c80-120' : 'd120+';
          by[k] = by[k] || [0, 0]; by[k][0]++; n++;
          if (ok) { v++; by[k][1]++; }
        }
        return { all: +(v / n).toFixed(3), n, by: Object.fromEntries(Object.entries(by).sort().map(([k, a]) => [k, +(a[1] / a[0]).toFixed(2)])) };
      },
      /** skyline check: per landmark, the fraction of its own region's path samples (every `step`-th, ≥ 20 m away; all
       *  four paths for the Great Tree) whose 0.88 m eye sees h·height of it through terrain, scenery and the others
       *  (`path`), and the fraction where it reads (`reads`): the rays to 0.95 H and 0.6 H are both clear and that
       *  span is ≥ `px` pixels tall at 1080p (vFOV 67.4°), so a sliver over the trees does not count */
      losLandmarks(o = {}) {
        const W = game.world, hk = o.h ?? 0.8, step = o.step ?? 4, minPx = o.px ?? 40, out = {}, PX = 1080 / (2 * Math.tan((67.4 / 2) * Math.PI / 180));
        const occAll = game.scenery.root.children.filter((m) => (m.isInstancedMesh ? m.castShadow : true));
        const ray = new THREE.Raycaster(), o3 = new THREE.Vector3(), d3 = new THREE.Vector3();
        for (const L of W.landmarks || []) {
          const own = L.id === 'great_tree' ? game.scenery.greatTree.group : (self.landmarkObjs || {})[L.id];
          const isOwn = (ob) => { while (ob) { if (ob === own) return true; ob = ob.parent; } return false; };
          const occ = occAll.filter((m) => !isOwn(m));
          for (const id in self.landmarkObjs || {}) if (self.landmarkObjs[id] !== own) occ.push(self.landmarkObjs[id]);
          const ty = (L.y ?? W.greatTree.y) + L.height * hk, pts = L.id === 'great_tree' ? [].concat(...Object.values(W.paths)) : W.paths[L.region] || [];
          const by = (L.y ?? W.greatTree.y);
          const clear = (q, py, ty2) => {
            o3.set(q.x, py, q.z); d3.set(L.x - q.x, ty2 - py, L.z - q.z);
            const dist = d3.length(); d3.normalize();
            for (let s = 0.5; s < dist - 1; s += 0.5) if (W.hAt(q.x + d3.x * s, q.z + d3.z * s) > py + d3.y * s) return false;
            ray.set(o3, d3); ray.near = 0.05; ray.far = dist - 1.5;
            return ray.intersectObjects(occ, true).length === 0;
          };
          let n = 0, v = 0, rd = 0;
          for (let i = 0; i < pts.length; i += step) {
            const q = pts[i], d = Math.hypot(q.x - L.x, q.z - L.z);
            if (d < 20) continue;
            const py = W.ground(q.x, q.z) + 0.88;
            n++;
            if (clear(q, py, ty)) v++;
            if ((0.35 * L.height * PX) / d >= minPx && clear(q, py, by + L.height * 0.95) && clear(q, py, by + L.height * 0.6)) rd++;
          }
          out[L.id] = { path: +(v / Math.max(1, n)).toFixed(2), reads: +(rd / Math.max(1, n)).toFixed(2), n };
        }
        return out;
      },
    });
  },
};

export default mod;
