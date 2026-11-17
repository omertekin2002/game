// Sky layer, fog, lights and shadows (WP8: art §5, §7; arch §9.2-4/5; RULINGS "sky is its own layer behind the world").
// - Sky layer: every sky object writes depth 1 (gl_Position.z = w) and is drawn first / without depth writes, so the world
//   (camera far = TUNE.atmo.far) always covers it. The dome is an output-space gradient (top, horizon, haze band, far sea
//   below the horizon, sun / moon glow) + the `stars` texture at night. The painted sun, moon, cumulus + cirrus clouds,
//   horizon isles and the sky isle are packed into one canvas atlas and drawn in ONE call (SkySprites).
// - Fog: three's fog chunks are replaced once at import (installFog): radial distance; the fog colour is the dome colour
//   in the fragment's own direction (atmoSky, the same function the dome draws), so fogged geometry melts into the sky
//   with no seam; a region tint at mid distance; landmark caps by position (atmoCap cylinders, filled by wp8-atmo
//   from W.greatTree / W.landmarks) and per material (`material.defines.FOG_CAP`, see fogCap). A material without the
//   shared uniforms falls back to scene.fog.color (the horizon colour).
// - Lights: day/night keys, sun / moon arcs (the visible sun sets into the horizon, the light stays ≥ lightMinEl),
//   a forward-shifted shadow box with light-space texel snapping, pooled lamp lights, Pip's night light.
import * as THREE from 'three';
import { G } from './core.js';
import { U } from './toon.js';
import { clamp, lerp, smoothstep, TAU, wrapAngle } from './util.js';
import { atmo as TA } from './tune.js';
import { Assets } from './assets.js';
import { settings } from './settings.js';

// hour, sky top, horizon, sun colour, sun intensity, hemi sky, hemi ground, hemi intensity (the fog colour is derived)
const KEYS = [
  [0.0, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.6, 0x5f70bf, 0x343a5c, 1.3],
  [4.8, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.6, 0x5f70bf, 0x343a5c, 1.3],
  [6.0, 0x7a8fd8, 0xffb7c6, 0xffb48a, 1.4, 0xd6b6dd, 0x7a6670, 1.35],
  [7.6, 0x5aaef2, 0xd4f0fc, 0xfff1dc, 2.6, 0xd8ecff, 0x8a9a6a, 1.45],
  [16.4, 0x5aaef2, 0xd4f0fc, 0xfff1dc, 2.6, 0xd8ecff, 0x8a9a6a, 1.45],
  [16.9, 0x6aa6e6, 0xffe2b0, 0xffd49a, 2.3, 0xf0dcc0, 0x8a8a5a, 1.4],  // golden hour (art §5.5)
  [18.0, 0x7484cc, 0xffc890, 0xffc08a, 1.5, 0xe8ccc0, 0x7a6658, 1.35],
  [19.5, 0x2c3778, 0x6a5aa8, 0xb4a8ff, 0.75, 0x6a6ab8, 0x3a3456, 1.3],
  [24.0, 0x1c2a63, 0x3d4c8f, 0x9fb4ff, 0.6, 0x5f70bf, 0x343a5c, 1.3],
];
// cloud tint by hour (art §5.3), displayed colours
const CLOUD = [[0, 0x7d89c4], [4.8, 0x7d89c4], [5.6, 0xffdcd4], [6.8, 0xffe4dc], [7.6, 0xffffff], [16.4, 0xffffff], [16.9, 0xfff2e0],
  [17.6, 0xffd8c8], [18.6, 0xffcfc0], [19.8, 0x7d89c4], [24, 0x7d89c4]];
const WATER_DEEP = new THREE.Color(0x1b86c8);

const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color(), _d = new THREE.Color();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
function mixHex(h1, h2, t, out) { _a.setHex(h1); _b.setHex(h2); return out.copy(_a).lerp(_b, t); }
function keyAt(table, h, out) {
  let i = 0;
  while (i < table.length - 2 && h > table[i + 1][0]) i++;
  const A = table[i], B = table[i + 1];
  return mixHex(A[1], B[1], smoothstep(A[0], B[0], h), out);
}

export function nightAmount(h) {
  if (h >= 7.2 && h <= 17.4) return 0;
  if (h > 17.4 && h < 19.8) return smoothstep(17.4, 19.8, h);
  if (h >= 4.6 && h < 7.2) return 1 - smoothstep(4.6, 7.2, h);
  return 1;
}

// sun / moon arcs east → south → west (f 0..1 over their 12 h); elK(el) maps the arc's elevation (rad); el0 / el1 the arc's
// low / high elevation (the moon rides lower than the sun, TUNE.atmo.moonEl, so at eye level it sits in view)
function arcDir(f, out, elK, el0 = 0.62, el1 = 1.05) {
  const az = lerp(1.25, -1.25, f) + 0.25, el = lerp(el0, el1, Math.sin(f * Math.PI));
  const e = elK(el);
  return out.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e) * 0.8 + 0.35).normalize();
}
const sunKAt = (h) => smoothstep(5.3, 7.5, h) * (1 - smoothstep(16.0, 18.5, h));
/** the sun light's direction (toward the sun) at a daytime hour, as Sky.update sets `sunDir` (wp8-atmo bakes the woods
 *  light shafts' tilt from it) */
export function sunLightDir(h, out = new THREE.Vector3()) {
  const fd = clamp((h - 6) / 12, 0, 1), k = sunKAt(h);
  arcDir(fd, out, (el) => lerp(-0.1, el, k));
  const visEl = Math.asin(clamp(out.y, -1, 1));
  return arcDir(fd, out, () => Math.max(visEl, TA.lightMinEl));
}

// ---------------------------------------------------------------- colour: linear working → displayed (output) space
const srgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const rrt = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
/** what the renderer shows for a linear colour (its ACES tone mapping + sRGB), so the output-space sky matches the
 *  world's look; `out` gets displayed 0..1 values (NOT linear) */
export function displayed(c, out) {
  const r = G.renderer, aces = !r || r.toneMapping === THREE.ACESFilmicToneMapping;
  let R = c.r, Gc = c.g, B = c.b;
  if (aces) {
    const k = (r ? r.toneMappingExposure : 1.08) / 0.6;
    R *= k; Gc *= k; B *= k;
    const i0 = rrt(0.59719 * R + 0.35458 * Gc + 0.04823 * B), i1 = rrt(0.076 * R + 0.90834 * Gc + 0.01566 * B), i2 = rrt(0.0284 * R + 0.13383 * Gc + 0.83777 * B);
    R = 1.60475 * i0 - 0.53108 * i1 - 0.07367 * i2; Gc = -0.10208 * i0 + 1.10813 * i1 - 0.00605 * i2; B = -0.00327 * i0 - 0.07276 * i1 + 1.07602 * i2;
  }
  out.r = srgb(clamp(R, 0, 1)); out.g = srgb(clamp(Gc, 0, 1)); out.b = srgb(clamp(B, 0, 1));
  return out;
}

// ---------------------------------------------------------------- fog chunks (installed once, before any compile)
// Shared uniforms are plain { elements } objects: UniformsUtils.clone keeps non-three objects by reference, so every
// material (built-in libs, merged ShaderMaterials) reads the same two matrices that Sky.update fills each frame.
//  atmoSkyA: col0 top.rgb + on-flag | col1 horizon.rgb + haze k | col2 haze.rgb + tint k | col3 far sea.rgb + cap fade start
//  atmoSkyB: col0 tint.rgb + cap fade end | col1 visible sun dir + the lowest landmark cap (wp8-atmo) | col2 sun glow.rgb
//  (displayed) | col3 moon dir + glow k
//  atmoCapA / atmoCapB: 8 landmark fog-cap cylinders, one per column: x, z, radius (whole metres) + cap (fraction), y0
//  (world y the cap starts at, so the ground and the sea around a landmark fog as usual); radius 0 = unused slot
export const ATMO = { A: { elements: new Float32Array(16) }, B: { elements: new Float32Array(16) }, CA: { elements: new Float32Array(16) }, CB: { elements: new Float32Array(16) } };
export const ATMO_GLSL = /* glsl */`
#ifndef ATMO_SKY
#define ATMO_SKY
uniform mat4 atmoSkyA; uniform mat4 atmoSkyB;
vec3 atmoSky( vec3 d ) {
  float y = d.y;
  vec3 c = mix( atmoSkyA[1].rgb, atmoSkyA[0].rgb, smoothstep( -0.02, 0.5, y ) );
  c = mix( c, atmoSkyA[2].rgb, exp( -abs( y ) * 14.0 ) * atmoSkyA[1].w );
  c = mix( c, atmoSkyA[3].rgb, smoothstep( 0.0, -0.06, y ) );
  // sun glow s^14 · 0.32 + s^4 · 0.10 and the moon halo m^32 by squaring, not pow (this runs for every fogged fragment)
  float s = max( dot( d, atmoSkyB[1].xyz ), 0.0 ), s2 = s * s, s4 = s2 * s2;
  c += atmoSkyB[2].rgb * ( s4 * s4 * s4 * s2 * 0.32 + s4 * 0.10 );
  if ( atmoSkyB[3].w > 0.0 ) {
    float m = max( dot( d, atmoSkyB[3].xyz ), 0.0 ), m2 = m * m, m4 = m2 * m2, m8 = m4 * m4, m16 = m8 * m8;
    c += vec3( 0.55, 0.64, 0.95 ) * m16 * m16 * atmoSkyB[3].w;
  }
  return c;
}
#endif`;
function installFog() {
  const C = THREE.ShaderChunk;
  if (C.__wp8fog) return;
  C.__wp8fog = true;
  C.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogDir;\n#endif';
  // radial distance (planar depth made fog swim at the edges of a 100° view) + the world direction for the colour
  C.fog_vertex = '#ifdef USE_FOG\n\tvFogDir = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;\n\tvFogDepth = length( mvPosition.xyz );\n#endif';
  C.fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogDir;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
	${ATMO_GLSL}
	uniform mat4 atmoCapA; uniform mat4 atmoCapB;
	// landmark cylinder (x, z, r + cap, y0) → the fog cap at the world point wp (1 = no cap), soft at its edges
	float atmoCapOf( vec4 c, vec3 wp ) {
		float r = floor( c.z );
		vec2 d = wp.xz - c.xy;
		float d2 = dot( d, d );
		if ( r < 0.5 || d2 > r * r ) return 1.0;     // unused slot / outside: the cheap common case
		float k = ( 1.0 - smoothstep( r - 1.5, r, sqrt( d2 ) ) ) * smoothstep( c.w - 0.5, c.w + 1.0, wp.y );
		return mix( 1.0, fract( c.z ), k );
	}
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	bool atmoOn = atmoSkyA[0].w > 0.5;
	#ifdef FOG_CAP
		fogFactor = min( fogFactor, atmoOn ? max( float( FOG_CAP ), smoothstep( atmoSkyA[3].w, atmoSkyB[0].w, vFogDepth ) ) : float( FOG_CAP ) );
	#endif
	// landmark fog caps by position (the Great Tree, W.landmarks): readable across the island, released into the fog
	// before the far plane cuts them. A fog factor at or below the lowest cap (atmoSkyB[1].w) can never be capped
	if ( atmoOn && atmoCapA[0].z > 0.5 && fogFactor > atmoSkyB[1].w ) {
		vec3 wp = cameraPosition + vFogDir;
		float cap = min( min( min( atmoCapOf( atmoCapA[0], wp ), atmoCapOf( atmoCapA[1], wp ) ), min( atmoCapOf( atmoCapA[2], wp ), atmoCapOf( atmoCapA[3], wp ) ) ),
			min( min( atmoCapOf( atmoCapB[0], wp ), atmoCapOf( atmoCapB[1], wp ) ), min( atmoCapOf( atmoCapB[2], wp ), atmoCapOf( atmoCapB[3], wp ) ) ) );
		fogFactor = min( fogFactor, max( cap, smoothstep( atmoSkyA[3].w, atmoSkyB[0].w, vFogDepth ) ) );
	}
	vec3 fogC = fogColor;
	if ( atmoOn && fogFactor > 0.0 ) fogC = mix( atmoSky( normalize( vFogDir ) ), atmoSkyB[0].rgb, atmoSkyA[2].w * ( 1.0 - fogFactor ) );
	// the last line keeps three's own mix text (fogColor here is a block-local colour shadowing the uniform), so per-material
	// patches that rewrite that call (WP9 capFog caps its factor) still apply; never quote that text in a comment above
	{ vec3 fogColor = fogC; gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor ); }
#endif`;
  const add = (u) => { u.atmoSkyA = { value: ATMO.A }; u.atmoSkyB = { value: ATMO.B }; u.atmoCapA = { value: ATMO.CA }; u.atmoCapB = { value: ATMO.CB }; };
  add(THREE.UniformsLib.fog);
  for (const k in THREE.ShaderLib) { const L = THREE.ShaderLib[k]; if (L && L.uniforms && L.uniforms.fogColor) add(L.uniforms); }
}
// ?atmofog=0 keeps three's own fog chunks (attribution: boot / compile cost of the dome-coloured fog)
if (!(typeof location !== 'undefined' && /[?&]atmofog=0\b/.test(location.search))) installFog();

/** cap the fog factor of an object's own materials (landmarks stay readable across the island; the cap releases near the
 *  far plane, TUNE.atmo.capFade). Materials shared with anything outside `obj` (and ShaderMaterials, whose shared
 *  uniforms a clone would break) are left alone. cap null removes it. → number of materials changed */
export function fogCap(obj, cap, scene = G.scene) {
  if (!obj) return 0;
  const inside = new Set(), outside = new Set();
  obj.traverse((o) => { for (const m of [].concat(o.material || [])) if (m) inside.add(m); });
  if (scene) scene.traverse((o) => { if (!o.material) return; let p = o; while (p && p !== obj) p = p.parent; if (p !== obj) for (const m of [].concat(o.material)) outside.add(m); });
  const v = cap == null ? null : (+cap).toFixed(3);
  let n = 0;
  for (const m of inside) {
    if (outside.has(m) || m.isShaderMaterial || m.fog === false) continue;
    const cur = m.defines && m.defines.FOG_CAP;
    if ((cur ?? null) === v) continue;
    m.defines = m.defines || {};
    if (v == null) delete m.defines.FOG_CAP; else m.defines.FOG_CAP = v;
    m.needsUpdate = true;
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- sky sprites (one atlas, one draw)
const SPRITE_KEYS = ['sun', 'moon', 'cloud_a', 'cloud_b', 'cloud_c', 'cloud_d', 'cloud_e', 'cloud_f', 'horizon_isle_a', 'horizon_isle_b', 'horizon_isle_c', 'horizon_isle_d', 'sky_isle'];
const KIND = { sun: 0, moon: 1, cloud: 2, cirrus: 3, isle: 4, skyIsle: 5 };
// bound until Sky.upload(renderer) swaps the real textures in (after the title: they stay out of the boot-to-title time)
const EMPTY = (() => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; })();
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/** procedural stand-ins for missing billboards (clouds: soft puff clusters; sun: rayed disc; moon: crescent) */
function drawFallback(x, k, X, Y, w, h) {
  x.save();
  if (k.startsWith('cloud')) {
    const r = rng(k.charCodeAt(6) * 977), n = k === 'cloud_e' ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const cx = X + w * (0.14 + 0.72 * (i / (n - 1))) + (r() - 0.5) * w * 0.06;
      const rad = (k === 'cloud_e' ? h * 0.32 : h * (0.26 + 0.2 * Math.sin((i / (n - 1)) * Math.PI))) * (0.85 + r() * 0.3);
      const cy = Y + h * (k === 'cloud_e' ? 0.5 : 0.92) - rad * (k === 'cloud_e' ? 0.2 : 0.95);
      const g = x.createRadialGradient(cx, cy - rad * 0.25, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,253,248,1)'); g.addColorStop(0.7, 'rgba(250,240,240,0.95)'); g.addColorStop(1, 'rgba(240,230,240,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill();
    }
  } else if (k === 'sun') {
    const cx = X + w / 2, cy = Y + h / 2, R = w * 0.3;
    x.fillStyle = '#ffc24a';
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a - 0.12) * R, cy + Math.sin(a - 0.12) * R); x.lineTo(cx + Math.cos(a) * R * 1.55, cy + Math.sin(a) * R * 1.55); x.lineTo(cx + Math.cos(a + 0.12) * R, cy + Math.sin(a + 0.12) * R); x.fill(); }
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.8, '#ffd560'); g.addColorStop(1, '#f5b830');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
  } else if (k === 'moon') {
    const cx = X + w / 2, cy = Y + h / 2, R = w * 0.38;
    x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(cx + R * 0.55, cy - R * 0.1, R * 0.92, 0, TAU); x.fill();
  }
  x.restore();
}

export function buildSkyAtlas() {
  const items = SPRITE_KEYS.map((k) => {
    const t = Assets.billboards[k], im = t && t.image, ok = !!(im && im.width > 0 && im.height > 0);
    // source widths sized to their largest on-screen size at 1080p (isles ≤ 280 px, the sky isle ≤ 120 px), so the
    // whole atlas packs into 2048 × 1024 (half the upload of a 2048² sheet)
    const maxW = k === 'sun' || k === 'moon' || k === 'sky_isle' ? 256 : k.startsWith('horizon_isle') ? 448 : 512;
    let w = maxW, h = k === 'cloud_e' ? 128 : k === 'cloud_d' ? 448 : k.startsWith('cloud') ? 256 : maxW;
    if (ok) { const s = Math.min(1, maxW / im.width); w = Math.round(im.width * s); h = Math.round(im.height * s); }
    const draw = ok || !k.startsWith('horizon_isle') && k !== 'sky_isle';   // no stand-in for the painted isles
    return { k, im: ok ? im : null, w, h, ok, draw };
  });
  // first-fit shelf packing into a 2048-wide canvas, tallest first (8 px gutters so mip levels never bleed between cells)
  const W = 2048, P = 8, order = items.filter((i) => i.draw).sort((a, b) => b.h - a.h || b.w - a.w), shelves = [];
  for (const it of order) {
    let sh = shelves.find((q) => q.x + it.w <= W && it.h <= q.h);
    if (!sh) { const l = shelves[shelves.length - 1]; shelves.push((sh = { x: 0, y: l ? l.y + l.h + P : 0, h: it.h })); }
    it.x = sh.x; it.y = sh.y; sh.x += it.w + P;
  }
  const last = shelves[shelves.length - 1];
  let H = 64;
  while (last && H < last.y + last.h) H *= 2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  const cells = {};
  for (const it of items) {
    if (!it.draw) { cells[it.k] = null; continue; }
    try { if (it.im) cx.drawImage(it.im, it.x, it.y, it.w, it.h); else drawFallback(cx, it.k, it.x, it.y, it.w, it.h); }
    catch (e) { drawFallback(cx, it.k, it.x, it.y, it.w, it.h); }
    cells[it.k] = { u0: it.x / W, v0: 1 - (it.y + it.h) / H, u1: (it.x + it.w) / W, v1: 1 - it.y / H, aspect: it.h / it.w, art: it.ok };
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;     // displayed values: the sky layer works in output space
  tex.premultiplyAlpha = true;             // premultiplied mips (no dark fringes) + one blend mode for normal and additive
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return { tex, cells, size: [W, H] };
}

const SPRITE_VS = /* glsl */`
  ${ATMO_GLSL}
  uniform float uTime, uCamY, uPeaksAz, uMoonRot, uSkyR;
  uniform vec3 uSunVis, uMoonVis;
  uniform vec4 uSunCol, uMoonCol, uCloudCol, uIsleCol;
  uniform vec2 uSunMoonW;
  attribute vec2 corner; attribute vec4 a0; attribute vec4 a1; attribute vec4 a2; attribute vec2 a3;
  varying vec2 vUv; varying vec4 vTint; varying vec3 vHaze; varying float vHazeK; varying vec3 vDir; varying float vClip; varying float vAdd;
  void main() {
    float kind = a1.z, w = a1.x, h = a1.y, R = a0.y;
    vec3 dir, right, up, p;
    vec2 cn = corner;
    if ( kind < 1.5 ) {
      dir = kind < 0.5 ? uSunVis : uMoonVis;
      w = kind < 0.5 ? uSunMoonW.x : uSunMoonW.y; h = w; R = uSkyR;
      right = normalize( vec3( -dir.z, 0.0, dir.x ) + vec3( 1e-4, 0.0, 0.0 ) );
      up = normalize( cross( right, dir ) );
      float r = kind < 0.5 ? 0.0 : uMoonRot, cs = cos( r ), sn = sin( r );
      cn = vec2( cs * corner.x - sn * corner.y, sn * corner.x + cs * corner.y );
      p = dir * R + right * cn.x * 0.5 * w + up * cn.y * 0.5 * h;
      vClip = 0.0;
    } else {
      float az = a0.x + uTime * a0.w;
      float da = abs( atan( sin( az - uPeaksAz ), cos( az - uPeaksAz ) ) );
      float pk = kind < 2.5 ? 1.0 - smoothstep( 0.35, 0.95, da ) : 0.0;   // cumulus over the peaks: bigger, higher
      w *= 1.0 + 0.25 * pk; h *= 1.0 + 0.25 * pk;
      vec3 base = vec3( sin( az ) * R, a0.z + 30.0 * pk - uCamY, cos( az ) * R );
      dir = normalize( base );
      right = vec3( -cos( az ), 0.0, sin( az ) );
      up = vec3( 0.0, 1.0, 0.0 );
      p = base + right * corner.x * 0.5 * w * a3.y + up * ( corner.y * 0.5 + 0.5 ) * h;
      vClip = kind > 3.5 && kind < 4.5 ? ( a0.z - uCamY ) / R - 0.002 : 0.0;
    }
    vUv = vec2( mix( a2.x, a2.z, corner.x * 0.5 + 0.5 ), mix( a2.y, a2.w, corner.y * 0.5 + 0.5 ) );
    vec4 tint = kind < 0.5 ? uSunCol : kind < 1.5 ? uMoonCol : kind < 3.5 ? uCloudCol : uIsleCol;
    vTint = vec4( tint.rgb, tint.a * a3.x );
    vAdd = 0.0;
    vDir = p;
    vec3 nd = normalize( p );
    vHaze = atmoSky( nd );
    vHazeK = a1.w * ( 0.45 + 0.55 * ( 1.0 - smoothstep( 0.0, 0.3, nd.y ) ) );
    vec4 cp = projectionMatrix * viewMatrix * vec4( cameraPosition + p, 1.0 );
    cp.z = cp.w;                      // sky layer: depth 1, behind everything the world draws
    gl_Position = cp;
  }`;
const SPRITE_FS = /* glsl */`
  uniform sampler2D tAtlas;
  varying vec2 vUv; varying vec4 vTint; varying vec3 vHaze; varying float vHazeK; varying vec3 vDir; varying float vClip; varying float vAdd;
  void main() {
    vec4 t = texture2D( tAtlas, vUv );               // premultiplied, displayed values
    float y = normalize( vDir ).y;
    float k = vTint.a * smoothstep( vClip - 0.0015, vClip + 0.0015, y );   // never below the sea horizon
    float a = t.a * k;
    vec3 c = t.rgb * vTint.rgb * k;
    c = mix( c, vHaze * a, vHazeK );
    if ( a < 0.002 ) discard;
    gl_FragColor = vec4( c, a * ( 1.0 - vAdd ) );
  }`;

class SkySprites {
  constructor(scene, sky) {
    this.atlas = buildSkyAtlas();
    const C = this.atlas.cells, r = rng(20261115), list = [];
    const add = (key, kind, o) => { const cell = C[key]; if (!cell) return; list.push({ key, kind, cell, ...o }); };
    add('sun', KIND.sun, {});
    add('moon', KIND.moon, {});
    // cirrus (behind the cumulus): 6 × cloud_e, high and wide (art §5.3)
    for (let i = 0; i < TA.cirrus; i++) {
      const w = 300 + r() * 120;
      add('cloud_e', KIND.cirrus, { az: (i / TA.cirrus) * TAU + r() * 0.6, R: 800, y: 160 + r() * 80, w, alpha: 0.7, drift: 0.0005, haze: 0.22, flip: r() < 0.5 ? -1 : 1 });
    }
    // the sky isle: one, far in the north-east, hazy (art §4.7)
    add('sky_isle', KIND.skyIsle, { az: 2.3, R: 900, y: 135, w: 92, alpha: 0.9, drift: 0, haze: 0.42, flip: 1 });
    // horizon isles: one per 60° sector, never on the plaza → Great Tree line from the spawn (north, yaw π)
    const isles = ['horizon_isle_a', 'horizon_isle_b', 'horizon_isle_c', 'horizon_isle_d'];
    for (let i = 0; i < TA.isles; i++) {
      let az = (i / TA.isles) * TAU + 0.35 + r() * 0.5;
      if (Math.abs(wrapAngle(az - Math.PI)) < 0.32) az += 0.5;
      add(isles[i % 4], KIND.isle, { az, R: 760, y: 0, w: 125 + r() * 70, alpha: 1, drift: 0, haze: 0.5, flip: i >= 4 ? -1 : 1 });
    }
    // cumulus ring (art §5.3): 18 from cloud_a/b/c/d/f, 520–680 m out, base 45–110 m, 140–260 m wide
    const cu = ['cloud_a', 'cloud_b', 'cloud_c', 'cloud_d', 'cloud_f'];
    for (let i = 0; i < TA.clouds; i++) {
      const key = cu[(i * 3 + 1) % 5];
      const w = key === 'cloud_d' ? 120 + r() * 50 : 140 + r() * 120;
      add(key, KIND.cloud, { az: (i / TA.clouds) * TAU + r() * 0.25, R: 520 + r() * 160, y: 45 + r() * 65, w, alpha: 1, drift: 0.0008 + r() * 0.0007, haze: 0.16, flip: r() < 0.5 ? -1 : 1 });
    }
    this.list = list;
    const n = list.length, geo = new THREE.BufferGeometry();
    const corner = new Float32Array(n * 8), a0 = new Float32Array(n * 16), a1 = new Float32Array(n * 16), a2 = new Float32Array(n * 16), a3 = new Float32Array(n * 8);
    const idx = [];
    list.forEach((s, i) => {
      const c = s.cell, h = (s.w || 1) * c.aspect;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([cx, cy], j) => {
        const v = i * 4 + j;
        corner.set([cx, cy], v * 2);
        a0.set([s.az || 0, s.R || 650, s.y || 0, s.drift || 0], v * 4);
        a1.set([s.w || 1, h, s.kind, s.haze || 0], v * 4);
        a2.set([c.u0, c.v0, c.u1, c.v1], v * 4);
        a3.set([s.alpha ?? 1, s.flip || 1], v * 2);
      });
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    geo.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    geo.setAttribute('a0', new THREE.BufferAttribute(a0, 4));
    geo.setAttribute('a1', new THREE.BufferAttribute(a1, 4));
    geo.setAttribute('a2', new THREE.BufferAttribute(a2, 4));
    geo.setAttribute('a3', new THREE.BufferAttribute(a3, 2));
    geo.setIndex(idx);
    this.u = {
      tAtlas: { value: EMPTY }, uTime: U.uTime, uCamY: { value: 0 }, uPeaksAz: { value: 2.0 }, uMoonRot: { value: 0 }, uSkyR: { value: TA.skyR },
      uSunVis: { value: new THREE.Vector3(0, 1, 0) }, uMoonVis: { value: new THREE.Vector3(0, -1, 0) },
      uSunCol: { value: new THREE.Vector4(1, 1, 1, 1) }, uMoonCol: { value: new THREE.Vector4(1, 1, 1, 0) },
      uCloudCol: { value: new THREE.Vector4(1, 1, 1, 1) }, uIsleCol: { value: new THREE.Vector4(1, 1, 1, 1) },
      uSunMoonW: { value: new THREE.Vector2(TA.sunSize, TA.moonSize) },
      atmoSkyA: { value: ATMO.A }, atmoSkyB: { value: ATMO.B },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.u, vertexShader: SPRITE_VS, fragmentShader: SPRITE_FS, transparent: true, depthWrite: false, depthTest: true, fog: false, toneMapped: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = 'skySprites';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -9;
    this.mesh.userData.cull = { dist: Infinity };
    scene.add(this.mesh);
  }
  count(kind) { return this.list.filter((s) => s.kind === kind).length; }
}

// ---------------------------------------------------------------- dome
const DOME_VS = /* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const DOME_FS = /* glsl */`
  ${ATMO_GLSL}
  uniform sampler2D tStars; uniform float uStars, uTime, uStarTile, uHasStars;
  varying vec3 vDir;
  float h21( vec2 p ) { return fract( sin( dot( p, vec2( 41.3, 289.1 ) ) ) * 43758.5453 ); }
  void main() {
    vec3 d = normalize( vDir );
    vec3 c = atmoSky( d );
    if ( uStars > 0.01 && d.y > 0.02 ) {
      // stereographic projection from the zenith: conformal (round stars), no bunching at the pole
      vec2 sp = d.xz / ( 1.0 + d.y );
      vec3 st = vec3( 0.0 );
      if ( uHasStars > 0.5 ) { vec4 s = texture2D( tStars, sp * uStarTile + vec2( 0.37, 0.11 ) ); st += s.rgb * s.a * 1.35; }
      vec2 g = sp * 70.0, id = floor( g ), f = fract( g ) - 0.5;
      float r = h21( id ), off = h21( id + 5.3 ) - 0.5;
      st += vec3( 1.0, 0.95, 0.86 ) * step( 0.985, r ) * smoothstep( 0.16, 0.02, length( f - vec2( off, -off ) * 0.6 ) ) * ( 0.45 + 0.55 * fract( r * 91.0 ) );
      float tw = 0.7 + 0.3 * sin( uTime * 2.3 + h21( floor( sp * 48.0 ) ) * 60.0 );
      c += st * tw * uStars * smoothstep( 0.03, 0.25, d.y );
    }
    c += ( h21( gl_FragCoord.xy * 0.37 ) - 0.5 ) / 255.0;   // dither: no banding in the wide gradient
    gl_FragColor = vec4( c, 1.0 );
  }`;

// ---------------------------------------------------------------- Sky
export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.skyTop = new THREE.Color(); this.horizon = new THREE.Color(); this.fogColor = new THREE.Color();
    this.night = 0;
    this.sunVis = new THREE.Vector3(0, 1, 0); this.moonVis = new THREE.Vector3(0, -1, 0);
    this.sunK = 1; this.moonK = 0;
    // fog targets (wp8-atmo blends them per region / time; Sky.update applies them)
    this.fogNear = 30; this.fogFar = 230; this.fogTint = new THREE.Color(1, 1, 1); this.fogTintK = 0;
    this.out = { top: new THREE.Color(), hor: new THREE.Color(), haze: new THREE.Color(), sea: new THREE.Color(), tint: new THREE.Color(), glow: new THREE.Color(), cloud: new THREE.Color(), isle: new THREE.Color() };
    this.waterLight = new THREE.Color(1, 1, 1);

    // dome (its own layer: depth 1, no depth writes, drawn first)
    const stars = Assets.textures.stars || null;
    this.late = [];          // [uniform, texture, flag uniform]: uploaded by upload() once the title is up
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { tStars: { value: EMPTY }, uHasStars: { value: 0 }, uStarTile: { value: TA.starTile }, uStars: { value: 0 }, uTime: U.uTime, atmoSkyA: { value: ATMO.A }, atmoSkyB: { value: ATMO.B } },
      vertexShader: DOME_VS, fragmentShader: DOME_FS,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.domeMat);
    this.dome.name = 'skyDome';
    this.dome.frustumCulled = false;
    // drawn last of the opaque world (depth test at depth 1): only the pixels where the sky shows are shaded (drawn first,
    // it shaded the whole 1080p screen under the world: ≈ 0.4 ms)
    this.dome.renderOrder = 1e6;
    this.dome.userData.cull = { dist: Infinity };
    scene.add(this.dome);
    this.sprites = new SkySprites(scene, this);
    if (stars) this.late.push([this.domeMat.uniforms.tStars, stars, this.domeMat.uniforms.uHasStars]);
    this.late.push([this.sprites.u.tAtlas, this.sprites.atlas.tex, null]);

    // lights
    this.hemi = new THREE.HemisphereLight(0xd8ecff, 0x8a9a6a, 1.4);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    this.shadowExtent = TA.shadowE;
    this.shadowAhead = TA.shadowAhead;   // m along the view (0 + E 22 = the foundation's box around Pip: G.debug.atmo.features)
    this.atmoOn = true;                  // false: fog falls back to scene.fog.color (attribution / debug)
    sh.camera.near = 1; sh.camera.far = TA.shadowFar;   // before setShadowQuality's updateProjectionMatrix
    this.setShadowQuality(settings.get('quality'));
    settings.on('quality', (q) => this.setShadowQuality(q));
    sh.bias = -0.0005;
    sh.normalBias = 0.04;
    sh.radius = 2.5;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.45).normalize();   // the light's direction (viewmodel copies it)
    this.shadowCenter = new THREE.Vector3();

    // point light pool: lamps + Pip glow (constant count → no shader recompiles)
    this.lampLights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffc27a, 0, 10, 2);
      l.castShadow = false;
      scene.add(l);
      this.lampLights.push(l);
    }
    this.pipLight = new THREE.PointLight(0xfff0d0, 0, TA.pipRange, TA.pipDecay);
    scene.add(this.pipLight);

    scene.fog = new THREE.Fog(0xcfe9f5, this.fogNear, this.fogFar);
    ATMO.A.elements[3] = 1;
  }
  /** upload the sky textures held back at boot (the star field, the 2048 × 1024 sprite atlas: ≈ 70–150 ms here) and
   *  bind them; wp8-atmo calls it once the title is up (and before the first play frame at the latest). → done */
  upload(renderer) {
    for (const [u, tex, flag] of this.late) { try { if (renderer) renderer.initTexture(tex); } catch (e) { /* bound below: uploads on first use */ } u.value = tex; if (flag) flag.value = 1; }
    this.late.length = 0;
    return true;
  }
  get uploaded() { return this.late.length === 0; }
  /** one 2048² map (1024² on quality low, RULINGS); box half-size E */
  setShadowQuality(q) {
    const sh = this.sun.shadow, size = q === 'low' ? TA.shadowMapLow : TA.shadowMap, E = this.shadowExtent;
    sh.camera.left = -E; sh.camera.right = E; sh.camera.top = E; sh.camera.bottom = -E;
    sh.camera.updateProjectionMatrix();
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
  }
  /** h: hour 0..24; focus: Pip (render feet); shadowFocus { x, z, fx, fz }: the eye and the view forward (view.shadowFocus) */
  update(h, focus, camera, lamps, dt, time, shadowFocus = null) {
    let i = 0;
    while (i < KEYS.length - 2 && h > KEYS[i + 1][0]) i++;
    const A = KEYS[i], B = KEYS[i + 1];
    const t = smoothstep(A[0], B[0], h);
    mixHex(A[1], B[1], t, this.skyTop);
    mixHex(A[2], B[2], t, this.horizon);
    mixHex(A[3], B[3], t, this.sun.color);
    let sunI = lerp(A[4], B[4], t);
    mixHex(A[5], B[5], t, this.hemi.color);
    mixHex(A[6], B[6], t, this.hemi.groundColor);
    this.hemi.intensity = lerp(A[7], B[7], t);
    const n = (this.night = nightAmount(h));
    U.uNight.value = n;

    // sun by day, moon by night: arcs east → south → west; the painted disc sets into the horizon while the light
    // keeps ≥ lightMinEl (toon shading stays readable); the light swaps arcs at 6 h / 18 h while it is dimmed
    // (arcDir: the moon rides lower than the sun, TUNE.atmo.moonEl, so at eye level it sits in view over the horizon)
    const arc = arcDir;
    const fd = clamp((h - 6) / 12, 0, 1);
    const fn = h >= 18 ? (h - 18) / 12 : h < 6 ? (h + 6) / 12 : h >= 12 ? 0 : 1;
    this.sunK = sunKAt(h);
    this.moonK = h >= 12 ? smoothstep(17.8, 20.2, h) : 1 - smoothstep(3.8, 6.2, h);
    arc(fd, this.sunVis, (el) => lerp(-0.1, el, this.sunK));
    arc(fn, this.moonVis, (el) => lerp(-0.1, el, this.moonK), TA.moonEl[0], TA.moonEl[1]);
    const isDay = h >= 6 && h < 18;
    const visEl = Math.asin(clamp((isDay ? this.sunVis : this.moonVis).y, -1, 1));
    arc(isDay ? fd : fn, this.sunDir, () => Math.max(visEl, TA.lightMinEl));
    const swap = Math.min(smoothstep(0, 0.7, Math.abs(h - 6)), smoothstep(0, 0.7, Math.abs(h - 18)));
    this.sun.intensity = sunI * (0.06 + 0.94 * swap);

    // ---- output-space sky (dome, fog colour, sprites, water reflections all read these)
    const O = this.out;
    displayed(this.skyTop, O.top);
    // stars only on a darkened sky (r2): night × how far the zenith has dimmed into mid blue. By night alone they showed
    // on the pale, sunlit sky of 5.5–6.5 h and 18–18.5 h (night 0.16–0.72 while the zenith was still light blue)
    this.domeMat.uniforms.uStars.value = n * (1 - smoothstep(TA.starsLum[0], TA.starsLum[1], 0.2126 * O.top.r + 0.7152 * O.top.g + 0.0722 * O.top.b));
    displayed(this.horizon, O.hor);
    displayed(_c.copy(this.horizon).lerp(_d.setRGB(1, 1, 1), 0.25 * (1 - n)), O.haze);
    // far sea: the lit deep-water colour toward the horizon (the water fades into exactly this, no hard line)
    this.waterLight.copy(this.hemi.color).multiplyScalar(0.55).add(_c.copy(this.sun.color).multiplyScalar(0.45 * Math.min(1, this.sun.intensity / 2.6)));
    displayed(_c.copy(WATER_DEEP).multiply(this.waterLight).lerp(this.horizon, 0.55), O.sea);
    displayed(this.fogTint, O.tint);
    displayed(_c.copy(this.sun.color).multiplyScalar(0.55 + 0.25 * (1 - this.sunK)), O.glow);
    O.glow.multiplyScalar(smoothstep(-0.12, 0.05, this.sunVis.y) * (1 - n * 0.7));
    const a = ATMO.A.elements, b = ATMO.B.elements;
    a[0] = O.top.r; a[1] = O.top.g; a[2] = O.top.b; a[3] = this.atmoOn ? 1 : 0;
    a[4] = O.hor.r; a[5] = O.hor.g; a[6] = O.hor.b; a[7] = lerp(TA.hazeK, TA.hazeNightK, n);
    a[8] = O.haze.r; a[9] = O.haze.g; a[10] = O.haze.b; a[11] = this.fogTintK;
    a[12] = O.sea.r; a[13] = O.sea.g; a[14] = O.sea.b; a[15] = TA.capFade[0];
    b[0] = O.tint.r; b[1] = O.tint.g; b[2] = O.tint.b; b[3] = TA.capFade[1];
    b[4] = this.sunVis.x; b[5] = this.sunVis.y; b[6] = this.sunVis.z;   // b[7]: the lowest cap (wp8-atmo applyCaps)
    b[8] = O.glow.r; b[9] = O.glow.g; b[10] = O.glow.b; b[11] = 0;
    b[12] = this.moonVis.x; b[13] = this.moonVis.y; b[14] = this.moonVis.z; b[15] = 0.35 * this.moonK * n;
    // fallback fog colour (materials without the shared uniforms): the horizon as displayed
    this.fogColor.setRGB(O.hor.r, O.hor.g, O.hor.b, THREE.SRGBColorSpace);
    const F = this.scene.fog;
    F.color.copy(this.fogColor); F.near = this.fogNear; F.far = this.fogFar;

    // ---- sprites
    const su = this.sprites.u;
    keyAt(CLOUD, h, O.cloud);
    su.uCloudCol.value.set(O.cloud.r, O.cloud.g, O.cloud.b, 1 - 0.3 * n);   // moonlit, a little thinner at night (stars barely through)
    if (n < 0.5) O.isle.setRGB(1, 1, 1).lerp(O.hor, 0.45); else O.isle.setHex(0x4a5694).lerp(O.hor, 0.5).multiplyScalar(0.8);
    if (n > 0 && n < 1) { _c.setRGB(1, 1, 1).lerp(O.hor, 0.45); _d.setHex(0x4a5694).lerp(O.hor, 0.5).multiplyScalar(0.8); O.isle.copy(_c).lerp(_d, n); }
    su.uIsleCol.value.set(O.isle.r, O.isle.g, O.isle.b, 1);
    const dusk = 1 - this.sunK;
    _c.setRGB(1, 1, 1).lerp(_d.setHex(0xffb48a), dusk * 0.85);
    su.uSunCol.value.set(_c.r, _c.g, _c.b, smoothstep(-0.1, 0.0, this.sunVis.y) * (1 - n * 0.8));
    su.uMoonCol.value.set(0.94, 0.95, 1.0, smoothstep(-0.1, 0.0, this.moonVis.y) * smoothstep(0.15, 0.6, n));
    su.uSunMoonW.value.set(lerp(TA.sunSize, TA.sunDusk, dusk), TA.moonSize);
    su.uSunVis.value.copy(this.sunVis); su.uMoonVis.value.copy(this.moonVis);
    su.uCamY.value = camera.position.y;
    // the moon's lit limb (the image's left side) turns toward the sun below the horizon
    _v.set(-this.moonVis.z, 0, this.moonVis.x).normalize();                     // billboard right
    _w.crossVectors(_v, this.moonVis).normalize();                              // billboard up
    arc(fd, _x, () => -0.6);                                                     // where the sun is (under the world)
    su.uMoonRot.value = Math.atan2(_x.dot(_w), _x.dot(_v)) - Math.PI;
    this.dome.position.copy(camera.position);

    // ---- shadows: box centred ahead of the eye, snapped to whole texels in light space (no shimmer when walking or
    // turning). Light-space basis = the shadow camera's own (lookAt from the light with world up)
    const sh = this.sun.shadow, E = this.shadowExtent, texel = (2 * E) / sh.mapSize.x;
    const sf = shadowFocus;
    const ah = this.shadowAhead, cx = sf && ah ? sf.x + sf.fx * ah : focus.x, cz = sf && ah ? sf.z + sf.fz * ah : focus.z;
    const cy = focus.y;
    _w.copy(this.sunDir);                                               // light-space z (toward the light)
    _v.crossVectors(_y.set(0, 1, 0), _w).normalize();                    // light-space x
    _x.crossVectors(_w, _v);                                             // light-space y
    const px = Math.round((cx * _v.x + cy * _v.y + cz * _v.z) / texel) * texel;
    const py = Math.round((cx * _x.x + cy * _x.y + cz * _x.z) / texel) * texel;
    const pz = cx * _w.x + cy * _w.y + cz * _w.z;
    const tgt = this.sun.target.position;
    tgt.set(_v.x * px + _x.x * py + _w.x * pz, _v.y * px + _x.y * py + _w.y * pz, _v.z * px + _x.z * py + _w.z * pz);
    this.shadowCenter.copy(tgt);
    this.sun.position.copy(tgt).addScaledVector(this.sunDir, TA.shadowDist);
    this.sun.target.updateMatrixWorld();

    // ---- lamps
    if (lamps && lamps.length) {
      if (this._lampSrc !== lamps || this._lampSort.length !== lamps.length) { this._lampSrc = lamps; this._lampSort = lamps.map((l) => ({ l, d: 0 })); }
      const sorted = this._lampSort;
      for (const s of sorted) s.d = (s.l.x - focus.x) ** 2 + (s.l.z - focus.z) ** 2;
      sorted.sort((p, q) => p.d - q.d);
      this.lampLights.forEach((L, k) => {
        const s = sorted[k];
        if (!s || s.d > 40 * 40 || n < 0.02) { L.intensity = 0; return; }
        L.position.set(s.l.x + Math.cos(s.l.rot) * 1.1, s.l.y + 1.7, s.l.z - Math.sin(s.l.rot) * 1.1);
        L.intensity = n * 6 * (0.92 + 0.08 * Math.sin(time * 9 + k));
      });
    }
    // ---- Pip's night light: over Pip (0.72 m over the FP eye) in both views, at the foundation's strength. Placed ahead of
    // the eye it painted a hot spot on every door / sign / chest at interaction distance, and WP2's viewmodel copies this
    // light's intensity and direction for the hands / sword (ARCHITECTURE §13), so its contract stays unchanged
    this.pipLight.position.set(focus.x, focus.y + TA.pipUp, focus.z);
    this.pipLight.intensity = n * TA.pipI;
  }
}
