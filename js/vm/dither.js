// WP2: ordered-dither fades for Pip (TP body by view.bodyFade, C12) and the FP boots. The shadow pass uses three's depth
// material, so a dithered body still casts its whole shadow.
const BAYER = /* glsl */`
float wp2Bayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[idx] + 0.5) / 16.0;
}`;

/** chain an ordered-dither discard onto a toonMat (MeshToonMaterial + onBeforeCompile): fragments survive while
 *  u.value ≥ their Bayer threshold (1 = solid, 0 = gone). Shared uniform object u = { value }. Also adds a cream rim
 *  glow, mat.userData.wp2Shim.value (0 = off): Pip's i-frame shimmer (art §3), and a multiplier on the toon rim,
 *  mat.userData.wp2Rim.value (art §3: 1.6 in TP, 1.0 in FP) */
export function ditherToon(mat, u, rim = null) {
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey, shim = (mat.userData.wp2Shim = { value: 0 });
  const rimU = (mat.userData.wp2Rim = rim || { value: 1 });
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uWp2Dither = u; sh.uniforms.uWp2Shim = shim; sh.uniforms.uWp2Rim = rimU;
    let fs = 'uniform float uWp2Dither; uniform float uWp2Shim; uniform float uWp2Rim;\n' + BAYER + '\n' + sh.fragmentShader.replace('uRimStr * uRimK', 'uRimStr * uRimK * uWp2Rim').replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n  if (uWp2Dither < 0.999 && uWp2Dither < wp2Bayer(gl_FragCoord.xy)) discard;');
    const k = fs.lastIndexOf('#include <opaque_fragment>');
    if (k > 0) fs = fs.slice(0, k) + 'outgoingLight += uWp2Shim * smoothstep(0.35, 0.95, 1.0 - max(dot(normalize(vViewPosition), normal), 0.0)) * vec3(1.0, 0.95, 0.82);\n' + fs.slice(k);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '|wp2d';
  mat.userData.wp2Dither = u;
  mat.needsUpdate = true;
  return mat;
}
/** the same for an outline ShaderMaterial (outlineMat): patch its fragment source */
export function ditherOutline(mat, u) {
  mat.uniforms.uWp2Dither = u;
  mat.fragmentShader = 'uniform float uWp2Dither;\n' + BAYER + '\n' + mat.fragmentShader.replace('void main() {',
    'void main() {\n  if (uWp2Dither < 0.999 && uWp2Dither < wp2Bayer(gl_FragCoord.xy)) discard;');
  mat.needsUpdate = true;
  return mat;
}
