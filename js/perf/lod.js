// WP7 LOD1 proxies (arch §9.2-2): any merged GB model (non-indexed position / normal / color / glow) → a ≤ target
// triangle proxy built from fitted primitives. The model is split into its connected parts (each GB primitive is one
// closed piece); every part that matters for the silhouette is fitted in its own principal frame (PCA box) and replaced
// by the primitive it looks like: an ellipsoid (canopy lobes, bush balls: icosahedron, octahedron when the budget is
// tight), a cone (pine tiers), a cylinder / frustum (trunks, posts), a flat diamond (fronds, leaves) or a box (roof
// boards). Normals are the primitive's own smooth normals, so toon shading reads like the original; each vertex takes the
// colour of the nearest source vertex (top-light / bottom-dark survives). Over budget: tiny parts go first, then aligned
// overlapping flat parts (a palm frond's two segments) and end-to-end cylinders (a palm trunk) merge, then primitives
// coarsen, then the least important parts drop. Generic on purpose: it works on whatever props.js builds (WP9 reshapes
// the trees) without a hand-made proxy per type.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** connected parts of a non-indexed geometry (vertices welded by position) → [{ tris: [first index], verts: [unique] }] */
function parts(pos) {
  const n = pos.count, key = new Map(), id = new Int32Array(n), rep = [];
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 1e4) + ',' + Math.round(pos.getY(i) * 1e4) + ',' + Math.round(pos.getZ(i) * 1e4);
    let v = key.get(k);
    if (v === undefined) { key.set(k, (v = key.size)); rep.push(i); }
    id[i] = v;
  }
  const par = new Int32Array(key.size).map((_, i) => i);
  const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < n; t += 3) { const a = find(id[t]); par[find(id[t + 1])] = a; par[find(id[t + 2])] = a; }
  const groups = new Map();
  for (let w = 0; w < rep.length; w++) { const r = find(w); let g = groups.get(r); if (!g) groups.set(r, (g = [])); g.push(rep[w]); }
  return [...groups.values()];
}

/** Jacobi eigen-decomposition of a symmetric 3×3 (row-major array) → eigenvectors as rows [[x, y, z] × 3] */
function eigen3(A) {
  const a = A.slice(), V = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 24; sweep++) {
    const off = Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[5]);
    if (off < 1e-12) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-14) continue;
      const th = (a[q * 3 + q] - a[p * 3 + p]) / (2 * apq);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { // A' = Jᵀ A J
        const akp = a[k * 3 + p], akq = a[k * 3 + q];
        a[k * 3 + p] = c * akp - s * akq; a[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p * 3 + k], aqk = a[q * 3 + k];
        a[p * 3 + k] = c * apk - s * aqk; a[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) { const vkp = V[k * 3 + p], vkq = V[k * 3 + q]; V[k * 3 + p] = c * vkp - s * vkq; V[k * 3 + q] = s * vkp + c * vkq; }
    }
  }
  return [[V[0], V[3], V[6]], [V[1], V[4], V[7]], [V[2], V[5], V[8]]];
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** fit a vertex set: principal frame, box centre, half extents (a0 ≥ a1 ≥ a2), kind and primitive levels */
function fit(pos, col, verts) {
  let cx = 0, cy = 0, cz = 0, cr = 0, cg = 0, cb = 0;
  const n = verts.length;
  for (const i of verts) { cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i); if (col) { cr += col.getX(i); cg += col.getY(i); cb += col.getZ(i); } }
  cx /= n; cy /= n; cz /= n;
  const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const i of verts) {
    const x = pos.getX(i) - cx, y = pos.getY(i) - cy, z = pos.getZ(i) - cz;
    C[0] += x * x; C[1] += x * y; C[2] += x * z; C[4] += y * y; C[5] += y * z; C[8] += z * z;
  }
  C[3] = C[1]; C[6] = C[2]; C[7] = C[5];
  const E = eigen3(C), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const i of verts) {
    const p = [pos.getX(i) - cx, pos.getY(i) - cy, pos.getZ(i) - cz];
    for (let k = 0; k < 3; k++) { const d = dot3(p, E[k]); lo[k] = Math.min(lo[k], d); hi[k] = Math.max(hi[k], d); }
  }
  const ax = [0, 1, 2].map((k) => ({ e: E[k], a: Math.max(1e-4, (hi[k] - lo[k]) / 2), m: (hi[k] + lo[k]) / 2 })).sort((p, q) => q.a - p.a);
  const c = [cx, cy, cz];
  for (const A of ax) for (let j = 0; j < 3; j++) c[j] += A.e[j] * A.m;
  const f = { verts, c, e: ax.map((A) => A.e), a: ax.map((A) => A.a), col: col ? [cr / n, cg / n, cb / n] : [1, 1, 1] };
  f.ext = 2 * f.a[0]; f.imp = f.a[0] * f.a[1];
  classify(pos, f);
  return f;
}

/** local coordinates of vertex i in f's frame */
function local(pos, f, i, out) {
  const x = pos.getX(i) - f.c[0], y = pos.getY(i) - f.c[1], z = pos.getZ(i) - f.c[2];
  for (let k = 0; k < 3; k++) out[k] = x * f.e[k][0] + y * f.e[k][1] + z * f.e[k][2];
  return out;
}

function classify(pos, f) {
  const a = f.a, p = [0, 0, 0];
  let q = 0;   // boxness: a box has vertices in its PCA-box corners (q → 1); an ellipsoid ≈ 0.58, a cylinder ≈ 0.71
  for (const i of f.verts) { local(pos, f, i, p); q = Math.max(q, Math.min(Math.abs(p[0]) / a[0], Math.abs(p[1]) / a[1], Math.abs(p[2]) / a[2])); }
  f.kind = 'ellipsoid';
  if (q > 0.9) { f.kind = 'box'; return levels(f); }
  // a symmetry axis: the other two extents match; its radius profile at both ends tells cone / cylinder / ellipsoid
  let best = null;
  for (let k = 0; k < 3; k++) {
    const u = (k + 1) % 3, w = (k + 2) % 3, r0 = Math.max(a[u], a[w]), r1 = Math.min(a[u], a[w]);
    if (r1 / r0 < 0.82) continue;
    let rLo = 0, rHi = 0, rMax = 0;
    for (const i of f.verts) {
      local(pos, f, i, p);
      const r = Math.hypot(p[u], p[w]), t = p[k] / a[k];
      rMax = Math.max(rMax, r);
      if (t < -0.88) rLo = Math.max(rLo, r);   // end slices: a sphere's radius there is < 0.48, a cylinder's 1
      if (t > 0.88) rHi = Math.max(rHi, r);
    }
    const lo = rLo / rMax, hi = rHi / rMax;
    let kind = 'ellipsoid';
    if (Math.min(lo, hi) < 0.4 && Math.max(lo, hi) > 0.7) kind = 'cone';
    else if (Math.min(lo, hi) > 0.55) kind = 'cyl';   // (a tapered trunk is a frustum)
    // an upright axis decides (props stand up: a pot is a ball, not a log on its side); otherwise a cone / cylinder beats an
    // ellipsoid, then the most upright axis wins
    const up = Math.abs(f.e[k][1]), rank = (up > 0.9 ? 10 : 0) + (kind === 'ellipsoid' ? 0 : 2) + up;
    if (!best || rank > best.rank) best = { rank, kind, k, rLo, rHi, rMax };
  }
  if (best && best.kind !== 'ellipsoid') {
    f.kind = best.kind; f.axis = best.k; f.rLo = best.rLo; f.rHi = best.rHi;
    f.long = 2 * a[best.k] > 2.4 * Math.max(best.rLo, best.rHi);   // long cylinders need no caps
  } else if (!best && a[2] < 0.3 * a[1]) f.kind = 'diamond';
  return levels(f);
}

/** triangle counts per detail level of f's primitive (level 0 = finest) */
function levels(f) {
  const capT = (n) => (f.long ? 0 : n - 2);
  f.L = f.kind === 'ellipsoid' ? [20, 8] : f.kind === 'diamond' ? [8] : f.kind === 'box' ? [12]
    : f.kind === 'cone' ? [7, 6, 5, 4].map((n) => n + n - 2) : [6, 5, 4, 3].map((n) => 2 * n + 2 * capT(n));
  f.N = f.kind === 'cone' ? [7, 6, 5, 4] : [6, 5, 4, 3];
  f.lv = 0;
  return f;
}

// unit primitives (indexed): icosahedron / octahedron vertices on the unit sphere
const T = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
const ICO_F = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
const OCT_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const OCT_F = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 4, 2, 1, 3, 4, 1, 5, 3, 1, 2, 5];
const BOX_FACES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];

/** the primitive of f at its level, in model space: { p: [], nrm: [], idx: [] } */
function primitive(f) {
  const P = [], Nn = [], I = [], a = f.a, e = f.e, c = f.c;
  const put = (l, nl) => {   // local position / normal → model space
    P.push(c[0] + l[0] * e[0][0] + l[1] * e[1][0] + l[2] * e[2][0], c[1] + l[0] * e[0][1] + l[1] * e[1][1] + l[2] * e[2][1], c[2] + l[0] * e[0][2] + l[1] * e[1][2] + l[2] * e[2][2]);
    const nx = nl[0] * e[0][0] + nl[1] * e[1][0] + nl[2] * e[2][0], ny = nl[0] * e[0][1] + nl[1] * e[1][1] + nl[2] * e[2][1], nz = nl[0] * e[0][2] + nl[1] * e[1][2] + nl[2] * e[2][2];
    const ln = Math.hypot(nx, ny, nz) || 1;
    Nn.push(nx / ln, ny / ln, nz / ln);
    return P.length / 3 - 1;
  };
  if (f.kind === 'ellipsoid' || f.kind === 'diamond') {
    const ico = f.kind === 'ellipsoid' && f.lv === 0, [V, F] = ico ? [ICO_V, ICO_F] : [OCT_V, OCT_F];
    // an inscribed polyhedron covers less than the ellipsoid: widen it so the silhouette keeps its size (a diamond only sideways)
    const s0 = f.kind === 'diamond' ? 1 : ico ? 1.06 : 1.15, s1 = ico ? 1.06 : 1.15, base = P.length / 3;
    for (const v of V) put([v[0] * a[0] * s0, v[1] * a[1] * s1, v[2] * a[2] * s1], [v[0] / a[0], v[1] / a[1], v[2] / a[2]]);
    for (const i of F) I.push(base + i);
    // keep the winding outward whatever the handedness of the PCA frame
    if (dot3(cross(e[0], e[1]), e[2]) < 0) flip(I);
  } else if (f.kind === 'box') {
    for (const [k, s] of BOX_FACES) {
      const u = (k + 1) % 3, w = (k + 2) % 3, nl = [0, 0, 0]; nl[k] = s;
      const q = [];
      for (const [su, sw] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = [0, 0, 0]; l[k] = s * a[k]; l[u] = su * a[u]; l[w] = sw * a[w]; q.push(put(l, nl)); }
      if (s > 0) I.push(q[0], q[1], q[2], q[0], q[2], q[3]); else I.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
    if (dot3(cross(e[0], e[1]), e[2]) < 0) flip(I);
  } else {
    // cone / cylinder around axis k: rings at t = −a_k (radius rLo) and +a_k (rHi); a cone's narrow end is one apex
    const k = f.axis, u = (k + 1) % 3, w = (k + 2) % 3, n = f.N[f.lv], h = a[k], wid = n >= 5 ? 1.06 : 1.15;
    const ring = (t, r0, slope) => {
      const ids = [], r = r0 * wid;
      for (let j = 0; j < n; j++) {
        const th = (j / n) * Math.PI * 2, l = [0, 0, 0], nl = [0, 0, 0];
        l[k] = t; l[u] = Math.cos(th) * r * (a[u] / Math.max(a[u], a[w])); l[w] = Math.sin(th) * r * (a[w] / Math.max(a[u], a[w]));
        nl[k] = slope; nl[u] = Math.cos(th); nl[w] = Math.sin(th);
        ids.push(put(l, nl));
      }
      return ids;
    };
    const slope = (f.rLo - f.rHi) / (2 * h);   // the side normal leans toward the narrow end
    const cone = f.kind === 'cone', apexHi = f.rHi < f.rLo;
    if (cone) {
      const rb = apexHi ? f.rLo : f.rHi, tb = apexHi ? -h : h, ta = apexHi ? h : -h;
      const R = ring(tb, rb, apexHi ? rb / (2 * h) : -rb / (2 * h));
      const la = [0, 0, 0]; la[k] = ta; const na = [0, 0, 0]; na[k] = apexHi ? 1 : -1;
      const A = put(la, na);
      for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; if (apexHi) I.push(R[j], R[j1], A); else I.push(R[j1], R[j], A); }
      // base cap (seen from below the tier)
      const B = ringCap(put, n, k, u, w, a, tb, rb * wid, apexHi ? -1 : 1);
      for (let j = 1; j < n - 1; j++) { if (apexHi) I.push(B[0], B[j + 1], B[j]); else I.push(B[0], B[j], B[j + 1]); }
    } else {
      const R0 = ring(-h, f.rLo, slope), R1 = ring(h, f.rHi, slope);
      for (let j = 0; j < n; j++) { const j1 = (j + 1) % n; I.push(R0[j], R0[j1], R1[j1], R0[j], R1[j1], R1[j]); }
      if (!f.long) {
        const B0 = ringCap(put, n, k, u, w, a, -h, f.rLo * wid, -1), B1 = ringCap(put, n, k, u, w, a, h, f.rHi * wid, 1);
        for (let j = 1; j < n - 1; j++) { I.push(B0[0], B0[j + 1], B0[j]); I.push(B1[0], B1[j], B1[j + 1]); }
      }
    }
    if (dot3(cross(e[0], e[1]), e[2]) < 0) flip(I);
  }
  return { p: P, nrm: Nn, idx: I };
}
function ringCap(put, n, k, u, w, a, t, r, s) {
  const ids = [], nl = [0, 0, 0]; nl[k] = s;
  for (let j = 0; j < n; j++) { const th = (j / n) * Math.PI * 2, l = [0, 0, 0]; l[k] = t; l[u] = Math.cos(th) * r * (a[u] / Math.max(a[u], a[w])); l[w] = Math.sin(th) * r * (a[w] / Math.max(a[u], a[w])); ids.push(put(l, nl)); }
  return ids;
}
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function flip(I) { for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } }

const colDist = (p, q) => Math.hypot(p.col[0] - q.col[0], p.col[1] - q.col[1], p.col[2] - q.col[2]);
function boxOverlap(pos, p, q) {
  const bb = (f) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const i of f.verts) { const v = [pos.getX(i), pos.getY(i), pos.getZ(i)]; for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } } return [lo, hi]; };
  const A = p.bb || (p.bb = bb(p)), B = q.bb || (q.bb = bb(q)), m = 0.05 * Math.max(p.ext, q.ext);
  for (let k = 0; k < 3; k++) if (A[0][k] > B[1][k] + m || B[0][k] > A[1][k] + m) return false;
  return true;
}
/** the best merge of two parts that stays the same shape: aligned flat parts (frond segments) or end-to-end cylinders */
function bestMerge(pos, col, P) {
  let best = null;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const p = P[i], q = P[j];
    const flat = p.kind === 'diamond' && q.kind === 'diamond', cyl = p.kind === 'cyl' && q.kind === 'cyl';
    if (!flat && !cyl) continue;
    if (colDist(p, q) > 0.25 || Math.abs(dot3(p.e[0], q.e[0])) < (flat ? 0.8 : 0.9) || !boxOverlap(pos, p, q)) continue;
    const u = fit(pos, col, p.verts.concat(q.verts));
    if (u.kind !== p.kind) continue;
    if (cyl && Math.max(u.rLo, u.rHi) > 1.35 * Math.max(p.rLo, p.rHi, q.rLo, q.rHi)) continue;   // a bent chain would fatten
    if (flat && u.a[1] > 1.4 * Math.max(p.a[1], q.a[1])) continue;
    const gain = p.L[p.lv] + q.L[q.lv] - u.L[0];
    if (gain > 0 && (!best || u.ext < best.u.ext)) best = { i, j, u };
  }
  return best;
}

/**
 * proxyGeometry(geo, target = 150) → indexed BufferGeometry (position, normal, color, glow) or null
 */
export function proxyGeometry(geo, target = 150) {
  const pos = geo.attributes.position, col = geo.attributes.color, glow = geo.attributes.glow;
  if (!pos || geo.index) return null;
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3()), big = Math.max(size.x, size.y, size.z) || 1;
  // tiny parts (leaf marks, drips, coconuts) never reach the silhouette at 45 m+
  let P = parts(pos).map((v) => fit(pos, col, v)).filter((f) => f.ext >= big * 0.12).sort((p, q) => q.imp - p.imp);
  if (!P.length) return null;
  const total = () => P.reduce((s, f) => s + f.L[f.lv], 0);
  if (total() > target) { const m = P[0].imp; P = P.filter((f) => f.imp >= m * 0.06); }        // ground clutter (roots)
  for (let guard = 0; guard < 200 && total() > target; guard++) {
    const mg = bestMerge(pos, col, P);
    if (mg) { P.splice(mg.j, 1); P.splice(mg.i, 1, mg.u); P.sort((p, q) => q.imp - p.imp); continue; }
    let k = -1;
    for (let i = P.length - 1; i >= 0; i--) if (P[i].lv < P[i].L.length - 1) { k = i; break; }
    if (k >= 0) { P[k].lv++; continue; }
    if (P.length > 1) P.pop(); else break;
  }
  const geos = [], v = [0, 0, 0];
  for (const f of P) {
    const pr = primitive(f), n = pr.p.length / 3, C = new Float32Array(n * 3), Gl = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      // colour / glow of the nearest source vertex of this part
      v[0] = pr.p[j * 3]; v[1] = pr.p[j * 3 + 1]; v[2] = pr.p[j * 3 + 2];
      let bi = f.verts[0], bd = Infinity;
      for (const i of f.verts) { const d = (pos.getX(i) - v[0]) ** 2 + (pos.getY(i) - v[1]) ** 2 + (pos.getZ(i) - v[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      C[j * 3] = col ? col.getX(bi) : 1; C[j * 3 + 1] = col ? col.getY(bi) : 1; C[j * 3 + 2] = col ? col.getZ(bi) : 1;
      Gl[j] = glow ? glow.getX(bi) : 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pr.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pr.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('glow', new THREE.BufferAttribute(Gl, 1));
    g.setIndex(pr.idx);
    geos.push(g);
  }
  const out = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!out) return null;
  out.computeBoundingSphere(); out.computeBoundingBox();
  out.userData.parts = P.map((f) => f.kind + f.lv);
  return out;
}
