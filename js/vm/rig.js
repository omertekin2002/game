// WP2 viewmodel rig (art §1.2): Pip's arms as procedural toon meshes. Each arm is ONE skinned mesh + ONE outline with
// two rigid bones (forearm, hand), so a whole arm costs 2 draw calls however it bends. The hand bone carries two hand
// shapes in the same buffer, a fist (holding the sword) and an open paw (item-get, chest, seed); the geometry is
// ordered [paw | forearm | fist] so one contiguous draw range picks the variant at no cost.
// Frames (metres, view space at arm's length):
//   forearm: origin at the wrist, +Y toward the elbow (bone quaternion = setFromUnitVectors(+Y, A))
//   hand:    origin at the grip centre, +Y = grip / finger axis (B), +Z = the forearm side ⊥ B, X = Y × Z (= B × A)
// Colours: his tunic's cream sleeve (as on his world model), a cream cuff, brown bracer with a stitched rim, small warm
// hands (lead + art §1.2; the sleeve was leaf-green, unlike the world model's).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GB } from '../toon.js';
import { swordCol } from '../models.js';

export const VM_COL = {
  skin: 0xec9e6c, skinD: 0xd8875a, bracer: 0x6e4026, stitch: 0xd7a85a, cuff: 0xf4e4c1, sleeve: 0xe2c896,
  cape: 0x8f9a38, ink: 0x3d2416,
};

// low-segment primitives: the viewmodel is big on screen but small in triangles (item-get draws both arms + the item
// inside the ≤ 6 k budget); flat-ish toon shading hides the facets
const cap = (b, r, l, color, o) => b.add(new THREE.CapsuleGeometry(r, l, o.cs ?? 2, o.seg ?? 8), color, o);
const rbox = (b, w, h, d, r, color, o) => b.add(roundedBox3(w, h, d, r), color, o);
/** a rounded box with 3 segments per side (toon.roundedBox uses 4) */
function roundedBox3(w, h, d, r) {
  const g = new THREE.BoxGeometry(w, h, d, 3, 3, 3), pos = g.attributes.position, v = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const cx = Math.max(-hw, Math.min(hw, v.x)), cy = Math.max(-hh, Math.min(hh, v.y)), cz = Math.max(-hd, Math.min(hd, v.z));
    const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    pos.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
  }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const m = mergeVertices(g); m.computeVertexNormals();
  return m;
}
/** forearm parts (shared by both arms: it is round, mirroring changes nothing) */
function forearm(b) {
  const C = VM_COL;
  // a short bracer band at the wrist, so the cream cuff and the sleeve come into the frame at rest
  b.cyl(0.043, 0.039, 0.038, C.bracer, { y: 0.014, seg: 12 });                                    // leather bracer
  b.torus(0.0425, 0.0045, C.stitch, { y: 0.033, rx: Math.PI / 2, ts: 14, rs: 3, outline: false });  // stitched rim
  b.sphere(0.051, C.cuff, { y: 0.047, sy: 0.34, ws: 12, hs: 6 });                                    // cream cuff (a puffed band)
  // the sleeve, tapering toward the elbow and rounded off: in a swing the elbow end is the part nearest the eye,
  // so a straight tube (plus the old elbow puff and capelet) ballooned across the bottom of the frame: a fat lump on
  // screen and most of the pass's fill. At rest only its first ~8 cm is in frame (it runs out of the corner); it is
  // long (47 cm) only so the portrait camera (vFOV 100°) never sees its end: at 16:9 that part is always off screen
  b.lathe(SLEEVE, C.sleeve, { seg: 10 });
}
const SLEEVE = [[0, 0.03], [0.042, 0.034], [0.046, 0.058], [0.0445, 0.1], [0.04, 0.15], [0.036, 0.21], [0.034, 0.3], [0.033, 0.42], [0.028, 0.455], [0.016, 0.471], [0, 0.476]];
/** the fist around the grip (sd = +1 right hand, −1 left, mirrored in X): a soft mitten-like fist, the curled fingers'
 *  ridge on the far side from the forearm (−Z), the thumb wrapped over the index finger near the guard */
function fist(b, sd) {
  const C = VM_COL;
  rbox(b, 0.074, 0.068, 0.07, 0.03, C.skin, { y: 0.002 });
  for (let i = 0; i < 4; i++) cap(b, 0.0145, 0.026, C.skin, { x: sd * 0.004, y: 0.022 - i * 0.0155, z: -0.03, rz: Math.PI / 2, seg: 6, outline: false });
  cap(b, 0.0165, 0.03, C.skin, { x: -sd * 0.03, y: 0.03, z: -0.012, rx: Math.PI / 2 - 0.35, rz: -sd * 0.2, seg: 7 });
}
/** the open paw (fingers along +Y, palm pad on −X·sd): holds the item, pushes the lid */
function paw(b, sd) {
  const C = VM_COL;
  rbox(b, 0.032, 0.066, 0.072, 0.015, C.skin, { y: 0.01 });                                          // palm
  for (let i = 0; i < 4; i++) {
    const z = 0.024 - i * 0.016;
    cap(b, 0.012, 0.03, C.skin, { x: -sd * 0.007, y: 0.062 - Math.abs(i - 1.5) * 0.006, z, rz: sd * 0.3, seg: 6 });
  }
  cap(b, 0.0145, 0.028, C.skin, { x: -sd * 0.012, y: 0.012, z: 0.046, rx: 0.9, rz: -sd * 0.4, seg: 6 }); // thumb
  b.sphere(0.019, C.skinD, { x: -sd * 0.0165, y: 0.008, z: 0.004, sx: 0.4, outline: false, ws: 8, hs: 5 }); // palm pad
}
/** the first-person sword (model units like models.swordBuilt: grip centre at y 0.01, guard 0.112, point 0.66), with
 *  close-up proportions: a broader blade (one piece, base to point), a short guard; colours from models.swordCol */
export function vmSwordBuilt(shiny) {
  const b = new GB(), C = swordCol(shiny), gg = shiny ? 0.15 : 0;
  b.blade(0.56, 0.125, 0.044, 0, { y0: 0.1, olFrom: 0.141, tipLen: 0.17, colorFn: C.blade, glow: C.glow }); // blade + point
  rbox(b, 0.25, 0.058, 0.08, 0.028, C.guard, { y: 0.112, glow: gg });                                      // guard (clear of the thumb)
  b.cyl(0.03, 0.03, 0.12, C.grip, { y: 0.035, seg: 8 });                                                  // grip: in the guard, ends in the fist
  for (const y of [-0.012, 0.022, 0.056]) b.torus(0.031, 0.006, C.wrap, { y, rx: Math.PI / 2, ts: 8, rs: 3, outline: false });
  // no pommel: the grip's axis runs into his wrist here, and a pommel (or the Shiny's gem) sat on the bracer
  return b.build();
}

/** one arm: { geo, ol, ranges } for the mesh and the outline (bone 0 = forearm, bone 1 = hand). Buffer order
 *  [prop | paw | forearm | fist], so each variant is one contiguous range: fist = forearm + fist, paw = paw + forearm,
 *  prop = prop + paw + forearm (the left paw holding the potion bottle) */
function armGeometry(sd, prop = null) {
  const P = new GB(), F = new GB(), H = new GB();
  paw(P, sd); forearm(F); fist(H, sd);
  const list = (prop ? [[prop, 1]] : []).concat([[P, 1], [F, 0], [H, 1]]);
  const parts = list.map(([b, bone]) => { const { geo, ol } = b.build(); return { geo: skin(geo, bone), ol: skin(ol, bone) }; });
  const geo = mergeGeometries(parts.map((p) => p.geo), false), ol = mergeGeometries(parts.map((p) => p.ol), false);
  for (const g of [geo, ol]) { g.computeBoundingSphere(); g.boundingSphere.radius = 2; }
  const vc = parts.map((p) => p.geo.attributes.position.count), ic = parts.map((p) => p.ol.index.count);
  const o = prop ? 1 : 0, sum = (a, i, n) => a.slice(i, i + n).reduce((s, v) => s + v, 0);
  const range = (i, n) => ({ mesh: [sum(vc, 0, i), sum(vc, i, n)], ol: [sum(ic, 0, i), sum(ic, i, n)], tris: (sum(vc, i, n) + sum(ic, i, n)) / 3 });
  const ranges = { paw: range(o, 2), fist: range(o + 1, 2) };
  if (prop) ranges.prop = range(0, 3);
  return { geo, ol, ranges };
}
function skin(g, bone) {
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

/** ink line for the viewmodel: a fixed view-space width (m) at arm's length, skinned or not (three defines
 *  USE_SKINNING for SkinnedMesh), darker at night like the world outlines */
export function vmOutlineMat(width) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(VM_COL.ink) }, uWidth: { value: width }, uNightK: { value: 0 }, uFlash: { value: 0 } },
    side: THREE.BackSide,
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uWidth;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vec3 n = normalize(transformedNormal);
        #ifdef FLIP_SIDED
          n = -n;
        #endif
        mvPosition.xyz += n * uWidth;
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uNightK; uniform float uFlash;
      void main() {   // no discard: keeps early depth testing for the hull
        gl_FragColor = vec4(mix(uColor * (1.0 - 0.35 * uNightK), vec3(1.0, 0.97, 0.9), uFlash * 0.5), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** a skinned arm attached to `parent` (the vm camera): { root, bones: [forearm, hand], mesh, ol, setHand(kind), tris } */
export function buildArm(sd, mat, olMat, parent, prop = null) {
  const A = armGeometry(sd, prop);
  const fore = new THREE.Bone(), hand = new THREE.Bone();
  fore.name = sd > 0 ? 'vm-forearm-R' : 'vm-forearm-L'; hand.name = sd > 0 ? 'vm-hand-R' : 'vm-hand-L';
  parent.add(fore, hand);
  const skel = new THREE.Skeleton([fore, hand], [new THREE.Matrix4(), new THREE.Matrix4()]);
  const mk = (geo, m) => {
    const s = new THREE.SkinnedMesh(geo, m);
    s.frustumCulled = false; s.castShadow = false; s.receiveShadow = false;
    parent.add(s);
    s.bind(skel, new THREE.Matrix4());
    return s;
  };
  const mesh = mk(A.geo, mat), ol = mk(A.ol, olMat);
  ol.renderOrder = 1;   // after every solid part: the hull's inside fails the early depth test
  const arm = {
    side: sd, bones: [fore, hand], mesh, ol, skel, kind: null, ranges: A.ranges,
    setHand(kind) {
      if (kind === arm.kind) return;
      arm.kind = kind;
      const r = A.ranges[kind];
      mesh.geometry.setDrawRange(r.mesh[0], r.mesh[1]);
      ol.geometry.setDrawRange(r.ol[0], r.ol[1]);
    },
    set visible(v) { mesh.visible = ol.visible = v; },
    get visible() { return mesh.visible; },
  };
  arm.setHand('fist');
  return arm;
}

/** the potion bottle in the left paw's frame (art §1.2: pink sphere, cream neck, cork, highlight), sitting on the palm
 *  (the left palm faces +X) with its neck along the fingers; returns the GB so it joins the arm's buffer */
export function potionGB(T) {
  const b = new GB(), o = T.potionAt, s = T.potionS;
  const at = (x, y, z) => ({ x: o[0] + x * s, y: o[1] + y * s, z: o[2] + z * s });
  b.sphere(0.052 * s, 0xff5a7a, { ...at(0, 0, 0), glow: 0.35, ws: 14, hs: 10 });
  b.cyl(0.018 * s, 0.022 * s, 0.036 * s, 0xf6efe0, { ...at(0, 0.06, 0), seg: 10, glow: 0.1 });
  b.cyl(0.016 * s, 0.014 * s, 0.022 * s, 0xa0683a, { ...at(0, 0.088, 0), seg: 8 });
  b.sphere(0.014 * s, 0xffffff, { ...at(0.03, 0.022, 0.02), glow: 1, outline: false, ws: 6, hs: 4 });
  b.sphere(0.034 * s, 0xff8fb0, { ...at(0.022, -0.004, 0), sx: 0.5, glow: 0.7, outline: false, ws: 10, hs: 6 });
  return b;
}

/** two little boots for looking down in FP (art §2): brown leg capsule, dark sole, cream sock; built at the origin of
 *  each foot, toes toward +Z */
export function bootBuilt() {
  const b = new GB();
  b.sphere(0.058, 0x5a3420, { y: 0.024, z: 0.035, sx: 1.0, sy: 0.42, sz: 1.65, ws: 14, hs: 8 });  // sole
  b.sphere(0.054, 0x7a4a2e, { y: 0.05, z: 0.05, sx: 0.95, sy: 0.72, sz: 1.5, ws: 14, hs: 9 });    // foot + round toe
  b.capsule(0.046, 0.04, 0x7a4a2e, { y: 0.09, seg: 12 });                                          // short shaft
  b.torus(0.045, 0.008, 0xf3e3c3, { y: 0.125, rx: Math.PI / 2, ts: 16, rs: 4, outline: false });  // cream cuff
  b.sphere(0.046, 0x6e4128, { y: 0.122, sy: 0.55, ws: 12, hs: 7, outline: false });                // rounded top
  return b.build();
}
