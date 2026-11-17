// Toon materials (ramp shading, rim, glow, wind sway, occluder dither, near-camera dither, instance distance fades and
// LOD crossfades), clip-space pixel outlines, and a small geometry builder that bakes vertex colours so a whole model
// merges into one draw call. WP7: NEAR_FADE, px outlines, instance fades (arch §6.4, §9.2).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { perf as TP } from './tune.js';

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
  // WP7: size of the pass being drawn (px outlines, particle caps), its px scale (height / 1080, floored so small screens
  // keep a readable line) and the main pass's dynamic-resolution scale; near-camera dither bands (view depth, m)
  uRes: { value: new THREE.Vector2(1920, 1080) },
  uPxK: { value: 1 },
  uPassK: { value: 1 },
  uOlCap: { value: TP.outlineCap },
  uNearFade: { value: new THREE.Vector2(...TP.nearFade) },
  uNearFadeF: { value: new THREE.Vector2(...TP.nearFadeFoliage) },
  uOlNear: { value: new THREE.Vector2(...TP.outlineNear) },
  uOlThin: { value: new THREE.Vector3(...TP.outlineThin) },
  // r3 canopy cutaway: 0 with the camera at the eye (FP) … 1 once it is off the eye (TP, the V blend, shots), set every
  // frame by wp7-perf; the band (m beyond a tree's canopy radius) over which a tree beside the camera comes back
  uCutK: { value: 0 },
  uCutBand: { value: new THREE.Vector2(...TP.cutaway.band) },
  // r4: (camera forward x, z in the ground plane, Pip's depth along it in m): a tree at or past Pip's depth keeps its
  // crown (uCutDepth: the fade band around that depth); and a crown whose base is uCutHigh m above the camera keeps it too
  uCutFwd: { value: new THREE.Vector3(0, 1, 1e3) },
  uCutDepth: { value: new THREE.Vector2(...TP.cutaway.depth) },
  uCutHigh: { value: new THREE.Vector2(...TP.cutaway.high) },
};
/** WP7: keep the px-outline / particle uniforms in step with the pass being drawn (perf module: resize, quality, and the
 *  scaled main pass of dynamic resolution, passK = its size / the drawing buffer's) */
export function setBufferSize(w, h, passK = 1) {
  U.uRes.value.set(Math.max(1, w), Math.max(1, h));
  U.uPxK.value = Math.max(Math.max(1, h) / 1080, TP.outlinePxKMin * passK);
  U.uPassK.value = passK;
}

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

const PROF_BINS = 12;   // WP7: height bands of an instanced hull's radial profile (radialProfile / outlineMat)

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
  #ifdef NEAR_FOLIAGE
    vSwayH = swH;
  #endif
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

// WP7 fragment dithers: near-camera fade (NEAR_FADE; swaying foliage above its sway base uses the wider band) and the
// instanced LOD crossfade (uLodSide 0 = the full model fades out, 1 = the proxy fades in, complementary Bayer masks; −1 =
// none). The LOD side and the instance fade are uniforms, not defines, so they add no program variants (boot compiles)
const LOD_FRAG = /* glsl */`
  if (uLodSide > -0.5) {
    float lk = smoothstep(uLodBand.x, uLodBand.y, vInstD), lb = bayer4(gl_FragCoord.xy);
    if (uLodSide < 0.5 ? lk > lb : lk <= lb) discard;
  }`;
const NEAR_FRAG = /* glsl */`
  #ifdef NEAR_FADE
  {
    vec2 nfB = uNearFadeM;
    #ifdef NEAR_FOLIAGE
      if (vSwayH > 0.02) nfB = uNearFadeF;
    #endif
    if (vViewDepth < nfB.y && smoothstep(nfB.x, nfB.y, vViewDepth) <= bayer4(gl_FragCoord.xy)) discard;
  }
  #endif
  ${LOD_FRAG}
  #ifdef CUTAWAY
  if (vCutK > 0.004) {
    float cK = vCutK * smoothstep(uCut.x - 0.3, uCut.x - 0.02, vCutP.x);   // full at the canopy base (a tier's flat underside)
    #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
      if (vColor.r > vColor.g * 1.2) cK = 0.0;   // bark (trunk, roots, coconuts) stays
    #endif
    if (cK > bayer4(gl_FragCoord.xy)) discard;
  }
  #endif`;
// WP7 instance distance (XZ, camera to the instance origin, the same measure as the CPU culler) and scale fade (a no-op
// with the default band [1e9, 2e9])
const INST_VERT = /* glsl */`
  #ifdef USE_INSTANCING
  {
    vec3 iO = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
    float iD = length(iO.xz - cameraPosition.xz);
    vInstD = iD;
    transformed *= 1.0 - smoothstep(uInstFade.x, uInstFade.y, iD);
  }
  #else
    vInstD = 0.0;
  #endif`;
// r3 canopy cutaway (CUTAWAY, instanced trees; RULINGS r3): a tree whose axis is within its canopy radius (+ uCutBand) of
// the camera in the ground plane, with the camera below its top, is dithered out above its canopy base while the camera is
// off the eye (uCutK). Per instance (its origin and uniform scale), so it never pops; the trunk (brown vertex colour) stays,
// and the shadow too (the depth pass never runs this material). uCut = (canopy base, canopy radius, trunk radius kept by
// the hull, top) in model units: vCutK = this instance's amount, vCutP = (model y, model radius).
// r4: only trees beside or behind the camera — one whose axis is at or past Pip's depth along the view (uCutFwd.z +
// uCutDepth) keeps its crown (the TP camera 2.6 m back put the tree Pip walks up to inside the band: its crown went to a
// screen door), and so does a crown whose base is uCutHigh m over the camera (a palm looked up at: the flat underside the
// ruling removes only exists at camera height)
const CUT_VERT = /* glsl */`
  #ifdef CUTAWAY
    vCutK = 0.0; vCutP = vec2(transformed.y, length(transformed.xz));
    #ifdef USE_INSTANCING
    {
      mat4 cM = modelMatrix * instanceMatrix;
      float cS = length(cM[0].xyz), cD = length(cM[3].xz - cameraPosition.xz), cR = uCut.y * cS;
      vCutK = uCutK * (1.0 - smoothstep(cR + uCutBand.x, cR + uCutBand.y, cD)) * (1.0 - smoothstep(uCut.w * cS, uCut.w * cS + 1.5, cameraPosition.y - cM[3].y));
      float cDep = dot(cM[3].xz - cameraPosition.xz, uCutFwd.xy);
      vCutK *= (1.0 - smoothstep(uCutFwd.z + uCutDepth.x, uCutFwd.z + uCutDepth.y, cDep)) * (1.0 - smoothstep(uCutHigh.x, uCutHigh.y, uCut.x * cS + cM[3].y - cameraPosition.y));
    }
    #endif
  #endif`;
const CUT_PARS = /* glsl */`
  #ifdef CUTAWAY
    uniform vec4 uCut; uniform float uCutK; uniform vec2 uCutBand; uniform vec3 uCutFwd; uniform vec2 uCutDepth; uniform vec2 uCutHigh; varying float vCutK; varying vec2 vCutP;
  #endif`;

/**
 * Toon material.
 * o: { color, map, vc (vertex colours, default true), grad, glow (uses 'glow' attribute), nightGlow,
 *      glowBase, sway, swayBase, push, occ, transparent, opacity, side, rim,
 *      nearFade (WP7, default true: dithered out near the camera; false = off (viewmodel); [a, b] = own band in m),
 *      px (accepted: every shared outline is pixel-width since WP7), instFade [a, b] (instanced: scale to 0 by camera
 *      distance), lod 0 | 1 + lodBand [a, b] (instanced: Bayer crossfade between a full model and its proxy),
 *      cut [canopy base, canopy radius, trunk radius, top] (r3, instanced trees: canopy cutaway beside the TP camera) }
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
  const nearOn = o.nearFade !== false;
  const nearM = Array.isArray(o.nearFade) ? { value: new THREE.Vector2(o.nearFade[0], o.nearFade[1]) } : U.uNearFade;
  const instFade = { value: new THREE.Vector2(...(o.instFade || [1e9, 2e9])) };
  const lod = o.lod === 0 || o.lod === 1 ? o.lod : -1;
  const lodBand = { value: new THREE.Vector2(...(o.lodBand || TP.lodBand)) }, lodSide = { value: lod };
  m.userData.flash = flash;
  m.userData.flashColor = flashColor;
  m.userData.sway = sway;
  m.userData.glowK = glowK;
  m.userData.instFade = instFade;
  m.userData.lodBand = lodBand;
  m.userData.px = !!o.px;
  const cut = { value: new THREE.Vector4(...(o.cut || [0, 0, 0, 0])) };
  m.userData.cut = cut;
  const flags = { glow: !!o.glow, sway: !!o.sway, push: !!o.push, occ: !!o.occ, near: nearOn, cut: !!o.cut };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uFlash: flash, uFlashColor: flashColor, uSway: sway, uSwayBase: swayBase, uGlowK: glowK, uRimK: rimStr, uNearFadeM: nearM, uInstFade: instFade, uLodBand: lodBand, uLodSide: lodSide, uCut: cut });
    let vs = sh.vertexShader;
    let fs = sh.fragmentShader;
    const defs = (flags.push ? '#define PIP_PUSH\n' : '') + (flags.occ ? '#define OCCLUDER\n' : '') + (flags.near ? '#define NEAR_FADE\n' : '')
      + (flags.near && flags.sway ? '#define NEAR_FOLIAGE\n' : '') + (flags.cut ? '#define CUTAWAY\n' : '');
    vs = defs + CUT_PARS + `
      uniform float uTime; uniform float uSway; uniform float uSwayBase; uniform vec3 uPip; uniform vec2 uInstFade;
      varying float vViewDepth; varying float vInstD;
      #ifdef NEAR_FOLIAGE
        varying float vSwayH;
      #endif
      ${flags.glow ? 'attribute float glow; varying float vGlow;' : ''}
    ` + vs;
    vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>\n${flags.glow ? 'vGlow = glow;' : ''}\n${CUT_VERT}\n${INST_VERT}\n#ifdef NEAR_FOLIAGE\n vSwayH = 0.0;\n#endif`);
    if (flags.sway) vs = vs.replace('#include <project_vertex>', SWAY_PROJECT);
    vs = vs.replace('#include <fog_vertex>', '#include <fog_vertex>\n vViewDepth = -mvPosition.z;');
    fs = defs + CUT_PARS + `
      uniform float uFlash; uniform vec3 uFlashColor; uniform float uNight; uniform vec2 uGlowK;
      uniform vec3 uRim; uniform float uRimStr; uniform float uRimK;
      uniform vec2 uOccC; uniform float uOccR; uniform float uOccDepth;
      uniform vec2 uNearFadeM; uniform vec2 uNearFadeF; uniform vec2 uLodBand; uniform float uLodSide;
      varying float vViewDepth; varying float vInstD;
      #ifdef NEAR_FOLIAGE
        varying float vSwayH;
      #endif
      ${flags.glow ? 'varying float vGlow;' : ''}
      ${BAYER}
    ` + fs;
    fs = fs.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + (flags.occ ? OCC_FRAG : '') + NEAR_FRAG);
    if (flags.glow) {
      fs = fs.replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
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
  m.customProgramCacheKey = () => 'toon' + (flags.glow ? 'g' : '') + (flags.sway ? 's' : '') + (flags.push ? 'p' : '') + (flags.occ ? 'o' : '') + (o.map ? 'm' : '')
    + (flags.near ? 'n' : '') + (flags.cut ? 'c' : '');
  return m;
}

/**
 * Inverted-hull outline. Works with InstancedMesh.
 * - WP7 pixel mode (o.px: width in px at 1080p, scaled with the pass height; true = derived from o.width): extruded in clip
 *   space so far lines keep their pixel width, thinned with distance and faded to nothing over o.far = [start, end] m
 *   (camera distance to the instance origin when instanced, else the view depth). Near the eye the line never gets thinner
 *   than o.w metres projected (the foundation's world-space ink, so characters, bosses and near props keep a bold line),
 *   capped at TUNE.perf.outlineCap px; it ramps in over the near band (fragments nearer than its start are discarded).
 *   Instanced hulls with a radial profile (setHullProfile) draw nothing while the eye is inside that instance's crown /
 *   bush (+ TUNE.perf.outlineInside m): from inside, a closed hull is all back faces and would fill the view.
 * - legacy world mode (no o.px: the viewmodel's 4 mm line): view-space extrusion of o.width × clamp(dist / 11, 0.75, 4).
 * The LOD side (o.lod 0 | 1 with o.lodBand) and the instance fade (o.instFade) are uniforms: no extra program variants.
 * r3: o.cut (instanced trees, as toonMat's): the hull of a canopy cut away beside the TP camera goes with it (the trunk's
 * hull, inside o.cut[2] of the axis, stays).
 */
export function outlineMat(o = {}) {
  const px = o.px == null || o.px === false ? 0 : o.px === true ? Math.min(3.5, Math.max(1.2, (o.width ?? 0.03) * 60)) : +o.px;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uColor: { value: new THREE.Color(o.color ?? 0x3d2416) },
    uWidth: { value: o.width ?? 0.03 },
    uSway: { value: o.sway || 0 },
    uSwayBase: { value: o.swayBase || 0 },
    uPx: { value: px },
    uWorldW: { value: px ? (o.w ?? 0) : 0 },
    uFar: { value: new THREE.Vector2(...(o.far || [40, 55])) },
    uLodBand: { value: new THREE.Vector2(...(o.lodBand || [1e9, 2e9])) },
    uLodSide: { value: px && o.lodBand ? (o.lod === 1 ? 1 : 0) : -1 },
    uInstFade: { value: new THREE.Vector2(...(o.instFade || [1e9, 2e9])) },
    uProf: { value: new Float32Array(PROF_BINS) },
    uProfY: { value: new THREE.Vector3(0, -1, TP.outlineInside) },   // y0, y1 (model units; y1 ≤ y0 = no profile), margin m
    uCut: { value: new THREE.Vector4(...(o.cut || [0, 0, 0, 0])) },
  }]);
  Object.assign(uniforms, { uTime: U.uTime, uPip: U.uPip, uOccC: U.uOccC, uOccR: U.uOccR, uOccDepth: U.uOccDepth, uNight: U.uNight, uRes: U.uRes, uPxK: U.uPxK, uOlNear: U.uOlNear, uOlThin: U.uOlThin, uOlCap: U.uOlCap, uCutK: U.uCutK, uCutBand: U.uCutBand, uCutFwd: U.uCutFwd, uCutDepth: U.uCutDepth, uCutHigh: U.uCutHigh });
  const defs = (o.push ? '#define PIP_PUSH\n' : '') + (o.occ ? '#define OCCLUDER\n' : '') + (o.sway ? '#define SWAY\n' : '') + (px ? '#define PX_OUTLINE\n' : '') + (o.cut ? '#define CUTAWAY\n' : '');
  const m = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: true,
    vertexShader: defs + /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      uniform float uWidth; uniform float uTime; uniform float uSway; uniform float uSwayBase; uniform vec3 uPip;
      uniform float uPx; uniform float uWorldW; uniform vec2 uFar; uniform vec2 uRes; uniform float uPxK; uniform float uOlCap;
      uniform vec2 uOlNear; uniform vec3 uOlThin; uniform vec2 uInstFade; uniform float uProf[${PROF_BINS}]; uniform vec3 uProfY;
      varying float vViewDepth; varying float vInstD;
      #ifdef PX_OUTLINE
        varying float vOlK;
      #endif
      ${CUT_PARS}
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        ${CUT_VERT}
        float od = -1.0, inside = 0.0;
        vInstD = 0.0;
        #ifdef USE_INSTANCING
        {
          mat4 iM = modelMatrix * instanceMatrix;
          od = length(iM[3].xz - cameraPosition.xz);
          vInstD = od;
          transformed *= 1.0 - smoothstep(uInstFade.x, uInstFade.y, od);   // the hull shrinks with its model
          if (uProfY.y > uProfY.x) {
            // the eye in this instance's local frame (uniform scale + rotation): inside its radial profile = in the crown
            vec3 lc = cameraPosition - iM[3].xyz, ax = iM[0].xyz;
            float s2 = dot(ax, ax), mg = uProfY.z * inversesqrt(s2);
            vec3 l = vec3(dot(lc, ax), dot(lc, iM[1].xyz), dot(lc, iM[2].xyz)) / s2;
            if (l.y > uProfY.x - mg && l.y < uProfY.y + mg) {
              int b = int(clamp((l.y - uProfY.x) / (uProfY.y - uProfY.x) * ${PROF_BINS}.0, 0.0, ${PROF_BINS}.0 - 0.001));
              if (length(l.xz) < uProf[b] + mg) inside = 1.0;
            }
          }
        }
        #endif
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
        #ifdef PX_OUTLINE
          if (od < 0.0) od = dist;
          // px at 1080p (× the pass scale), thinner with distance; never under the near world width (projected), capped
          float wpx = max(uPx * uPxK * mix(1.0, uOlThin.z, smoothstep(uOlThin.x, uOlThin.y, od)), uWorldW * projectionMatrix[1][1] * uRes.y * 0.5 / max(dist, 0.05));
          wpx = min(wpx, uOlCap * uPxK);
          float k = smoothstep(uOlNear.x, uOlNear.y, dist) * (1.0 - smoothstep(uFar.x, uFar.y, od)) * (1.0 - inside);
          vec4 nc = projectionMatrix * vec4(n, 0.0);
          float nl = length(nc.xy);
          vec2 dir = nl > 1e-6 ? nc.xy / nl : vec2(0.0);
          gl_Position.xy += dir * (wpx * k * 2.0) / uRes * gl_Position.w;
          vOlK = k;
          vViewDepth = dist;
        #else
          mvPosition.xyz += n * uWidth * clamp(dist / 11.0, 0.75, 4.0);
          gl_Position = projectionMatrix * mvPosition;
          vViewDepth = -mvPosition.z;
        #endif
        #include <fog_vertex>
      }`,
    fragmentShader: defs + /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uColor; uniform float uNight; uniform vec2 uOlNear; uniform vec2 uLodBand; uniform float uLodSide;
      uniform vec2 uOccC; uniform float uOccR; uniform float uOccDepth;
      varying float vViewDepth; varying float vInstD;
      #ifdef PX_OUTLINE
        varying float vOlK;
      #endif
      ${CUT_PARS}
      ${BAYER}
      void main() {
        #ifdef PX_OUTLINE
          if (vViewDepth < uOlNear.x || vOlK < 0.02) discard;   // inside the near band / faded out / eye in the crown
        #endif
        ${LOD_FRAG}
        #ifdef CUTAWAY
          if (vCutK > 0.004 && vCutP.y > uCut.z && vCutK * smoothstep(uCut.x - 0.3, uCut.x - 0.02, vCutP.x) > bayer4(gl_FragCoord.xy)) discard;
        #endif
        #ifdef OCCLUDER
          ${OCC_FRAG}
        #endif
        gl_FragColor = vec4(uColor * (1.0 - 0.35 * uNight), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  m.userData.px = px; m.userData.far = uniforms.uFar; m.userData.lodBand = uniforms.uLodBand; m.userData.instFade = uniforms.uInstFade;
  m.userData.prof = uniforms.uProf; m.userData.profY = uniforms.uProfY; m.userData.cut = uniforms.uCut;
  return m;
}

// WP7: radial profile of an instanced hull (the eye-in-crown test of outlineMat)
/** max distance from the model's Y axis per height band (model units), sampled along every triangle edge (the maximum of
 *  the radius over a triangle's slice lies on its edges) → { y0, y1, r: Float32Array(PROF_BINS) } */
export function radialProfile(geo) {
  const p = geo.attributes.position, idx = geo.index;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, bh = (y1 - y0) / PROF_BINS || 1, r = new Float32Array(PROF_BINS);
  const nTri = idx ? idx.count / 3 : p.count / 3, vi = (i) => (idx ? idx.getX(i) : i);
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const a = vi(t * 3 + e), b = vi(t * 3 + ((e + 1) % 3));
      const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a), bx = p.getX(b), by = p.getY(b), bz = p.getZ(b);
      const n = Math.max(1, Math.ceil(Math.abs(by - ay) / (bh * 0.25)));
      for (let s = 0; s <= n; s++) {
        const f = s / n, y = ay + (by - ay) * f, k = Math.min(PROF_BINS - 1, Math.max(0, Math.floor((y - y0) / bh)));
        const d = Math.hypot(ax + (bx - ax) * f, az + (bz - az) * f);
        if (d > r[k]) r[k] = d;
      }
    }
  }
  return { y0, y1, r };
}
/** give an instanced outline material its model's radial profile (one material per layer: the uniforms are its own) */
export function setHullProfile(mat, prof) {
  if (!mat || !mat.userData.prof || !prof) return;
  mat.userData.prof.value.set(prof.r);
  mat.userData.profY.value.set(prof.y0, prof.y1, TP.outlineInside);
}

// Cached common outline materials (WP7: pixel-width, widths and fade bands in TUNE.perf.outline).
const olCache = {};
export function sharedOutline(kind = 'char') {
  if (olCache[kind]) return olCache[kind];
  const T = TP.outline;
  const cfg = {
    char: { ...T.char },
    prop: { ...T.prop },
    propOcc: { ...T.propOcc, occ: true },
    big: { ...T.big, occ: true },
    tree: { ...T.tree, occ: true, sway: 0.018, swayBase: 1.6 },
    bush: { ...T.bush, sway: 0.03, swayBase: 0.1 },
  }[kind] || { ...T.prop };
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
