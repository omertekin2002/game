// Toon materials (ramp shading, rim, glow, wind sway, occluder dither), inverted-hull outlines,
// and a small geometry builder that bakes vertex colours so a whole model merges into one draw call.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared uniforms (referenced by every material — update once per frame).
export const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uPip: { value: new THREE.Vector3(0, -999, 0) },
  uOccC: { value: new THREE.Vector2(-9999, -9999) },
  uOccR: { value: 1 },
  uOccDepth: { value: 0 },
  uRim: { value: new THREE.Color(1, 0.97, 0.9) },
  uRimStr: { value: 0.32 },
};

const gradCache = {};
export function gradientTex(name) {
  if (gradCache[name]) return gradCache[name];
  const steps = {
    char: [118, 178, 255],
    soft: [110, 150, 205, 255],
    terrain: [150, 175, 215, 255],
  }[name] || [118, 178, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = name === 'terrain' ? THREE.LinearFilter : THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  gradCache[name] = t;
  return t;
}

const BAYER = /* glsl */`
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[idx] + 0.5) / 16.0;
}`;

const OCC_FRAG = /* glsl */`
  {
    vec2 occd = gl_FragCoord.xy - uOccC;
    float od = length(occd * vec2(1.0, 0.8)) / uOccR;
    if (od < 1.0 && vViewDepth < uOccDepth) {
      float a = smoothstep(0.35, 1.0, od);
      if (a * 0.95 < bayer4(gl_FragCoord.xy)) discard;
    }
  }`;

const SWAY_PROJECT = /* glsl */`
  vec4 mvPosition = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  vec4 swW = modelMatrix * mvPosition;
  float swH = max(transformed.y - uSwayBase, 0.0);
  float swS = sin(uTime * 1.7 + swW.x * 0.33 + swW.z * 0.27) + 0.45 * sin(uTime * 3.1 + swW.z * 0.61 + swW.x * 0.2);
  swW.x += swS * uSway * swH;
  swW.z += swS * 0.55 * uSway * swH;
  #ifdef PIP_PUSH
    vec2 swD = swW.xz - uPip.xz;
    float swL = length(swD) + 1e-4;
    float swP = (1.0 - smoothstep(0.25, 1.05, swL)) * step(abs(swW.y - uPip.y), 2.0);
    swW.xz += swD / swL * swP * swH * 0.65;
    swW.y -= swP * swH * 0.25;
  #endif
  mvPosition = viewMatrix * swW;
  gl_Position = projectionMatrix * mvPosition;
`;

/**
 * Toon material.
 * o: { color, map, vc (vertex colours, default true), grad, glow (uses 'glow' attribute), nightGlow,
 *      glowBase, sway, swayBase, push, occ, transparent, opacity, side, rim }
 */
export function toonMat(o = {}) {
  const m = new THREE.MeshToonMaterial({
    color: o.color ?? 0xffffff,
    vertexColors: o.vc !== false,
    gradientMap: gradientTex(o.grad || 'char'),
    map: o.map || null,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    depthWrite: o.depthWrite ?? true,
  });
  const flash = { value: 0 };
  const flashColor = { value: new THREE.Color(1, 1, 1) };
  const sway = { value: o.sway || 0 };
  const swayBase = { value: o.swayBase || 0 };
  const glowK = { value: new THREE.Vector2(o.glowBase ?? 1, o.nightGlow ? (o.nightGlowAmt ?? 1.6) : 0) };
  const rimStr = { value: o.rim ?? 1 };
  m.userData.flash = flash;
  m.userData.flashColor = flashColor;
  m.userData.sway = sway;
  m.userData.glowK = glowK;
  const flags = { glow: !!o.glow, sway: !!o.sway, push: !!o.push, occ: !!o.occ };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uFlash: flash, uFlashColor: flashColor, uSway: sway, uSwayBase: swayBase, uGlowK: glowK, uRimK: rimStr });
    let vs = sh.vertexShader;
    let fs = sh.fragmentShader;
    const defs = (flags.push ? '#define PIP_PUSH\n' : '') + (flags.occ ? '#define OCCLUDER\n' : '');
    vs = defs + `
      uniform float uTime; uniform float uSway; uniform float uSwayBase; uniform vec3 uPip;
      varying float vViewDepth;
      ${flags.glow ? 'attribute float glow; varying float vGlow;' : ''}
    ` + vs;
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${flags.glow ? 'vGlow = glow;' : ''}`);
    if (flags.sway) vs = vs.replace('#include <project_vertex>', SWAY_PROJECT);
    vs = vs.replace('#include <fog_vertex>', '#include <fog_vertex>\n vViewDepth = -mvPosition.z;');
    fs = defs + `
      uniform float uFlash; uniform vec3 uFlashColor; uniform float uNight; uniform vec2 uGlowK;
      uniform vec3 uRim; uniform float uRimStr; uniform float uRimK;
      uniform vec2 uOccC; uniform float uOccR; uniform float uOccDepth;
      varying float vViewDepth;
      ${flags.glow ? 'varying float vGlow;' : ''}
      ${BAYER}
    ` + fs;
    if (flags.occ) fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + OCC_FRAG);
    if (flags.glow) {
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vGlow * (uGlowK.x + uNight * uGlowK.y);`);
    }
    fs = fs.replace('#include <opaque_fragment>', `
      {
        float rimF = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        outgoingLight += uRim * smoothstep(0.62, 1.0, rimF) * uRimStr * uRimK * diffuseColor.rgb * (1.0 - 0.6 * uNight);
      }
      outgoingLight = mix(outgoingLight, uFlashColor, uFlash);
      #include <opaque_fragment>`);
    sh.vertexShader = vs;
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'toon' + (flags.glow ? 'g' : '') + (flags.sway ? 's' : '') + (flags.push ? 'p' : '') + (flags.occ ? 'o' : '') + (o.map ? 'm' : '');
  return m;
}

/** Inverted-hull outline (constant-ish screen width, view-space extrusion). Works with InstancedMesh. */
export function outlineMat(o = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uColor: { value: new THREE.Color(o.color ?? 0x3d2416) },
    uWidth: { value: o.width ?? 0.03 },
    uSway: { value: o.sway || 0 },
    uSwayBase: { value: o.swayBase || 0 },
  }]);
  Object.assign(uniforms, { uTime: U.uTime, uPip: U.uPip, uOccC: U.uOccC, uOccR: U.uOccR, uOccDepth: U.uOccDepth, uNight: U.uNight });
  const defs = (o.push ? '#define PIP_PUSH\n' : '') + (o.occ ? '#define OCCLUDER\n' : '') + (o.sway ? '#define SWAY\n' : '');
  const m = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: true,
    vertexShader: defs + /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      uniform float uWidth; uniform float uTime; uniform float uSway; uniform float uSwayBase; uniform vec3 uPip;
      varying float vViewDepth;
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #ifdef SWAY
          ${SWAY_PROJECT}
        #else
          #include <project_vertex>
        #endif
        vec3 n = normalize(transformedNormal);
        #ifdef FLIP_SIDED
          n = -n; // BackSide flips normals in defaultnormal_vertex; the hull must still grow outward
        #endif
        float dist = -mvPosition.z;
        mvPosition.xyz += n * uWidth * clamp(dist / 11.0, 0.75, 4.0);
        gl_Position = projectionMatrix * mvPosition;
        vViewDepth = -mvPosition.z;
        #include <fog_vertex>
      }`,
    fragmentShader: defs + /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uNight;
      uniform vec2 uOccC; uniform float uOccR; uniform float uOccDepth;
      varying float vViewDepth;
      ${BAYER}
      void main() {
        #ifdef OCCLUDER
          ${OCC_FRAG}
        #endif
        gl_FragColor = vec4(uColor * (1.0 - 0.35 * uNight), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  return m;
}

// Cached common outline materials.
const olCache = {};
export function sharedOutline(kind = 'char') {
  if (olCache[kind]) return olCache[kind];
  const cfg = {
    char: { width: 0.022 },
    prop: { width: 0.032 },
    propOcc: { width: 0.034, occ: true },
    big: { width: 0.05, occ: true },
    tree: { width: 0.045, occ: true, sway: 0.018, swayBase: 1.6 },
    bush: { width: 0.03, sway: 0.03, swayBase: 0.1 },
  }[kind] || { width: 0.03 };
  olCache[kind] = outlineMat(cfg);
  return olCache[kind];
}

// ---------------------------------------------------------------- geometry builder
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color();

export class GB {
  constructor() { this.parts = []; this.ol = []; }
  /**
   * Add a geometry with baked colour. o: {x,y,z, rx,ry,rz, s, sx,sy,sz, glow, outline(default true), flat, colorFn(x,y,z,nx,ny,nz)->hex, jitter}
   */
  add(geo, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (o.jitter) {
      // deterministic-ish wobble per unique vertex position so faces stay closed
      const pos = g.attributes.position;
      const seed = o.seed ?? 1;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 3.3) * 43758.5453;
        const f = 1 + (h - Math.floor(h) - 0.5) * o.jitter;
        pos.setXYZ(i, x * f, y * f, z * f);
      }
    }
    if (o.flat || o.jitter) g.computeVertexNormals();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    const s = o.s ?? 1;
    _s.set(o.sx ?? s, o.sy ?? s, o.sz ?? s);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const pos = g.attributes.position, nor = g.attributes.normal;
    if (o.colorFn) {
      for (let i = 0; i < n; i++) {
        _c2.set(o.colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)));
        col[i * 3] = _c2.r; col[i * 3 + 1] = _c2.g; col[i * 3 + 2] = _c2.b;
      }
    } else {
      _c.set(color);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n).fill(o.glow || 0), 1));
    this.parts.push(g);
    if (o.outline !== false) this.ol.push(g);
    return this;
  }
  sphere(r, color, o = {}) { return this.add(new THREE.SphereGeometry(r, o.ws || 14, o.hs || 10, 0, Math.PI * 2, o.t0 || 0, o.t1 || Math.PI), color, o); }
  ico(r, color, o = {}) { return this.add(new THREE.IcosahedronGeometry(r, o.detail ?? 1), color, { flat: true, ...o }); }
  box(w, h, d, color, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), color, o); }
  rbox(w, h, d, color, o = {}) { return this.add(roundedBox(w, h, d, o.radius ?? Math.min(w, h, d) * 0.25), color, o); }
  cyl(rt, rb, h, color, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 14, 1, !!o.open), color, o); }
  cone(r, h, color, o = {}) { return this.add(new THREE.ConeGeometry(r, h, o.seg || 14), color, o); }
  capsule(r, l, color, o = {}) { return this.add(new THREE.CapsuleGeometry(r, l, 4, o.seg || 12), color, o); }
  torus(r, t, color, o = {}) { return this.add(new THREE.TorusGeometry(r, t, o.rs || 8, o.ts || 20, o.arc || Math.PI * 2), color, o); }
  lathe(pts, color, o = {}) { return this.add(new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), o.seg || 18), color, o); }
  tube(points, r, color, o = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return this.add(new THREE.TubeGeometry(curve, o.tseg || 12, r, o.rs || 7, false), color, o);
  }
  shape(shape, depth, color, o = {}) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: o.bevel ?? depth * 0.35, bevelSize: o.bevel ?? depth * 0.35, bevelSegments: 2, curveSegments: o.curve || 8 });
    g.translate(0, 0, -depth / 2);
    return this.add(g, color, o);
  }
  merge(other, o = {}) {
    // merge another builder's parts with transform
    for (const g0 of other.parts) {
      const g = g0.clone();
      _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
      _p.set(o.x || 0, o.y || 0, o.z || 0); const s = o.s ?? 1; _s.set(s, s, s);
      _m.compose(_p, _q, _s); g.applyMatrix4(_m);
      this.parts.push(g);
      if (other.ol.includes(g0)) this.ol.push(g);
    }
    return this;
  }
  get empty() { return this.parts.length === 0; }
  build() {
    if (!this.parts.length) return { geo: null, ol: null };
    const geo = mergeGeometries(this.parts, false);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const ol = this.ol.length ? outlineGeometry(this.ol) : null;
    return { geo, ol };
  }
}

/** Smooth-normal, position-only hull for inverted outlines. */
export function outlineGeometry(parts) {
  const list = parts.map((g) => {
    const n = new THREE.BufferGeometry();
    const src = g.attributes.position;
    const arr = new Float32Array(src.count * 3);
    for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
    n.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (g.index) n.setIndex(g.index.clone());
    return n;
  });
  let m = list.length === 1 ? list[0] : mergeGeometries(list, false);
  m = mergeVertices(m, 1e-3);
  m.computeVertexNormals();
  m.computeBoundingSphere();
  return m;
}

export function roundedBox(w, h, d, r) {
  // simple rounded box: box with spherical-ish corners via a scaled sphere blend (cheap)
  let g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const cx = Math.max(-hw, Math.min(hw, v.x)), cy = Math.max(-hh, Math.min(hh, v.y)), cz = Math.max(-hd, Math.min(hd, v.z));
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    pos.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
  }
  g.computeVertexNormals();
  return g;
}

/** A rigid mesh part with its outline child. */
export function meshWithOutline(built, mat, olMat, o = {}) {
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(built.geo, mat);
  mesh.castShadow = o.cast !== false;
  mesh.receiveShadow = !!o.receive;
  grp.add(mesh);
  if (built.ol && olMat) {
    const ol = new THREE.Mesh(built.ol, olMat);
    ol.castShadow = false;
    ol.raycast = () => {};
    grp.add(ol);
  }
  grp.userData.mesh = mesh;
  return grp;
}
