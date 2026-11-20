// Deterministic island generation: heightfield, regions, paths, river, ponds, arenas, bridges, props,
// chests, NPC spots, colliders and a reachability check (BFS + corridor carving). Ground/walkable/bridge queries,
// the walk grid and the collider hash live in world-collide.js.
import { RNG, makeNoise, clamp, lerp, smoothstep, sampleSpline, distToSeg, len2, angDiff, TAU, hash2 } from './util.js';
import { REGION, SIGNS, DOOR_LINES } from './data.js';
import { world as TW } from './tune.js';
import { WorldCollide } from './world-collide.js';
import { SIZE, HALF, N, CHUNK, NCH } from './world-const.js';
import { HOUSE_DRESSING, LANDMARK_R } from './props.js';

export { SIZE, HALF, N, CHUNK, NCH };

const SOLID = {
  tree_round: 0.72, tree_pine: 0.6, tree_snow: 0.6, tree_palm: 0.42, bush: 0.62, rock: 0.55, boulder: 1.25,
  stump: 0.45, pot: 0.3, lamp: 0.22, sign: 0.28, well: 1.15, chest: 0.6, pedestal: 0.95,
};
// WP9: collider declarations of reworked prop models (addProp collider, × s): pines got raised skirts (underside 1.95 m)
const DECL = {
  tree_pine: { h: 6.1, cam: 1.9 }, tree_snow: { h: 6.1, cam: 1.9 },
  waymarker: { r: 0.16, h: 1.25, eye: 0.3 }, sunflower: { r: 0.14, h: 1.55, eye: 0.3 },
};
// WP9: the foundation's plaza layout, kept as ghosts by the scatter shadow (scatter()); props WP9 adds before scatter
// carry `wp9` (extra: WP9) so the shadow does not see them
const FND = { pedestalZ: 4.6, spawnZ: 8.2, treeRes: 6, plazaRes: 12, lampR: 12.4, npcs: [[-3.4, 6.0], [-6.5, 1.5]] };
const WP9 = { wp9: true };

export class World {
  constructor(seed) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.rng = new RNG(seed * 7 + 3);
    this.H = new Float32Array(N * N);
    this.S = new Float32Array(N * N);       // slope magnitude (rise/run)
    this.D = new Float32Array(N * N);       // signed distance inland from coast
    this.reg = new Uint8Array(N * N);
    this.RW = new Float32Array(N * N * 5);  // region weights village,woods,peaks,shores,meadow
    this.pathD = new Float32Array(N * N).fill(99);
    this.pathH = new Float32Array(N * N);
    this.riverF = new Float32Array(N * N).fill(1);
    this.flatF = new Float32Array(N * N);   // plaza/arena flatten weight (no detail noise)
    this.splatA = new Float32Array(N * N * 4);
    this.splatB = new Float32Array(N * N * 4);
    this.props = [];      // solid & special props
    this.deco = [];       // non-colliding decoration
    this.colliders = [];
    this.interact = [];
    this.bridges = [];
    this.chests = [];
    this.lamps = [];
    this.npcSpots = {};
    this.houses = [];
    this.unreachable = [];
    this.shells = [];     // rainbow shells for Clover's errand (placeShells, a post-pass)
    this.lanterns = [];   // paper lanterns for Mayor Ribbit's parade (placeLanterns, a post-pass)
    this.carved = 0;
    // WP9 foundation shadow (scatter()): what the foundation had and WP9 does not (ghost solids and colliders, reservations
    // tagged t = 2) and its terrain before WP9's own edits, so the main stream draws exactly what the foundation drew
    this.fnd = { cols: [], H: null, S: null };
  }

  // ------------------------------------------------------------------ queries
  idx(i, j) { return j * N + i; }
  hAt(x, z) {
    const fx = clamp(x + HALF, 0, SIZE - 0.001), fz = clamp(z + HALF, 0, SIZE - 0.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const k = j * N + i, H = this.H;
    const a = H[k] + (H[k + 1] - H[k]) * tx;
    const b = H[k + N] + (H[k + N + 1] - H[k + N]) * tx;
    if (x < -HALF || x > HALF || z < -HALF || z > HALF) return -8;
    return a + (b - a) * tz;
  }
  slopeAt(x, z) {
    const fx = clamp(x + HALF, 0, SIZE - 0.001), fz = clamp(z + HALF, 0, SIZE - 0.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const k = j * N + i, S = this.S;
    const a = S[k] + (S[k + 1] - S[k]) * tx;
    const b = S[k + N] + (S[k + N + 1] - S[k + N]) * tx;
    return a + (b - a) * tz;
  }
  regionAt(x, z) {
    const i = clamp(Math.round(x + HALF), 0, SIZE), j = clamp(Math.round(z + HALF), 0, SIZE);
    return this.reg[j * N + i];
  }
  inArena(x, z, pad = 0) {
    for (const id in this.arenas) {
      const a = this.arenas[id];
      if (len2(x - a.x, z - a.z) < a.r + pad) return a;
    }
    return null;
  }

  // ------------------------------------------------------------------ generation
  /** o.shells = false skips the rainbow-shell post-pass and o.lanterns = false the parade-lantern one (tests compare the
   *  island with and without them) */
  generate(o = {}) {
    const t0 = performance.now();
    const T = (this.genT = {});
    let tl = t0;
    const lap = (k) => { const n = performance.now(); T[k] = +(n - tl).toFixed(1); tl = n; };
    this.layout();
    this.baseTerrain(); lap('terrain');
    this.flattenAreas();
    this.makePaths();
    this.carveWater();
    this.stampPaths();
    this.detail();
    this.computeSlope();
    this.computeRegions(); lap('shape');
    this.pathField(); lap('pathField');
    this.placeVillage();
    this.placeArenas();
    this.placeSpecial();
    this.placeLandmarks();
    this.placeWoodsGaps();
    this.placeArenaRings(); lap('places');
    this.scatter(); lap('scatter');
    this.placeSkyline();
    this.placeCoins();
    this.placePathDressing(); lap('coins');
    this.reachability(); lap('reach');
    this.computeSlope();
    this.computeSplat();
    this.buildColliderHash();
    this.publishAnchors(); lap('splat');
    if (o.shells !== false) { this.placeShells(); lap('shells'); }
    if (o.lanterns !== false) { this.placeLanterns(); lap('lanterns'); }
    this.genMs = performance.now() - t0;
  }

  layout() {
    const r = this.rng;
    // WP9 plaza re-layout for the 19.8 m tree (art §4.6): altar in front of the south root tips, spawn behind it
    this.plaza = { x: 0, z: 0, r: TW.plazaR, h: 2.3 };
    this.treePos = { x: 0, z: -1.5 };
    this.pedestal = { x: 0, z: TW.pedestalZ };
    this.spawn = { x: 0, z: TW.spawnZ };
    this.arenas = {
      woods: { id: 'woods', x: -4 + r.range(-3, 3), z: -114, r: 14, h: 3.2 },
      peaks: { id: 'peaks', x: 114, z: -20 + r.range(-3, 3), r: 14, h: 12.5 },
      shores: { id: 'shores', x: 26, z: 142, r: 14, h: 1.15 },
    };
    this.pen = { ax: 14, az: 110, bx: 27, bz: 146, r: 17 };
    this.islets = [{ x: -40, z: 139, r: 8.5 }, { x: -60, z: 151, r: 7 }];
    const jit = (p, a) => ({ x: p[0] + r.range(-a, a), z: p[1] + r.range(-a, a) });
    const A = this.arenas;
    this.pathDefs = {
      woods: [[0, -10], [-3, -28], [5, -50], [-4, -72], [-2, -92], [A.woods.x, A.woods.z]].map((p, i, a) => (i === 0 || i >= a.length - 2 ? { x: p[0], z: p[1] } : jit(p, 3))),
      peaks: [[10, 0], [28, 4], [47, 7], [66, -2], [84, -12], [99, -18], [A.peaks.x, A.peaks.z]].map((p, i, a) => (i === 0 || i === 2 || i >= a.length - 2 ? { x: p[0], z: p[1] } : jit(p, 3))),
      shores: [[0, 10], [5, 32], [-2, 56], [6, 84], [16, 110], [A.shores.x, A.shores.z]].map((p, i, a) => (i === 0 || i >= a.length - 2 ? { x: p[0], z: p[1] } : jit(p, 3))),
      meadow: [[-10, 0], [-30, 6], [-54, -3], [-78, 4], [-100, -4]].map((p, i) => (i === 0 ? { x: p[0], z: p[1] } : jit(p, 3))),
    };
    this.riverDef = [[37, -76], [50, -48], [47, -18], [49, 8], [60, 40], [82, 70], [102, 96], [130, 122], [150, 140]].map((p, i) => (i < 2 || i > 6 ? { x: p[0], z: p[1] } : jit(p, 3)));
    this.ponds = [
      { x: 37, z: -78, r: 5.5 },
      { x: -13, z: 25, r: 4.2 },
      { x: -70 + r.range(-4, 4), z: 22 + r.range(-3, 3), r: 7.5 },
      { x: -96 + r.range(-3, 3), z: -30 + r.range(-3, 3), r: 5.5 },
      { x: -50 + r.range(-3, 3), z: -40 + r.range(-3, 3), r: 4.5 },
    ];
  }

  baseTerrain() {
    const { noise, H, D, RW } = this;
    const sig2 = 2 * 0.42 * 0.42;
    const A = this.arenas, pen = this.pen;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = i - HALF, z = j - HALF, k = j * N + i;
        const r = Math.sqrt(x * x + z * z);
        const th = Math.atan2(x, -z);
        const edge = 127 + 11 * noise.fbm(Math.cos(th) * 1.6 + 3.1, Math.sin(th) * 1.6 - 1.7, 3) + 5 * noise.noise2(x * 0.03 + 9, z * 0.03 - 4);
        let d = edge - r;
        d = Math.max(d, pen.r - distToSeg(x, z, pen.ax, pen.az, pen.bx, pen.bz));
        for (const s of this.islets) d = Math.max(d, s.r - len2(x - s.x, z - s.z));
        d = Math.max(d, 26 - len2(x - A.woods.x, z - A.woods.z));
        d = Math.max(d, 26 - len2(x - A.peaks.x, z - A.peaks.z));
        D[k] = d;
        // region weights (compass sectors with noisy borders)
        const thp = th + 0.5 * noise.noise2(x * 0.011 + 20, z * 0.011 + 5);
        let ww = Math.exp(-(angDiff(thp, 0) ** 2) / sig2);
        let wp = Math.exp(-(angDiff(thp, Math.PI / 2) ** 2) / sig2);
        let ws = Math.exp(-(angDiff(thp, Math.PI) ** 2) / sig2);
        let wm = Math.exp(-(angDiff(thp, -Math.PI / 2) ** 2) / sig2);
        const sum = ww + wp + ws + wm;
        ww /= sum; wp /= sum; ws /= sum; wm /= sum;
        const rv = r + 6 * noise.noise2(x * 0.04 - 7, z * 0.04 + 3);
        const vw = 1 - smoothstep(26, 38, rv);
        RW[k * 5] = vw; RW[k * 5 + 1] = ww * (1 - vw); RW[k * 5 + 2] = wp * (1 - vw); RW[k * 5 + 3] = ws * (1 - vw); RW[k * 5 + 4] = wm * (1 - vw);
        // regional heights (WP9: skipped in open sea, where only d and ws shape the floor; identical result, ~2× faster)
        const beachW = clamp(3 + 11 * ws + 4 * wm - 2 * wp, 2, 14);
        if (d < 0) { H[k] = Math.max(-7.5, d * (0.16 + 0.26 * (1 - ws))); continue; }
        if (d < beachW) { H[k] = (d / beachW) * 1.1; continue; }
        const hV = vw > 0 ? 2.3 + 0.35 * noise.fbm(x * 0.04, z * 0.04, 2) : 0;   // WP9: lerp(…, hV, 0) never reads it (bit-exact)
        const hW = 3.0 + 1.9 * noise.fbm(x * 0.025 + 40, z * 0.025, 4);
        const hM = 2.0 + 2.4 * (0.5 + 0.5 * noise.fbm(x * 0.018 - 30, z * 0.018 + 12, 3));
        const hS = 1.8 + 0.9 * noise.fbm(x * 0.03, z * 0.03 + 50, 3);
        const ramp = smoothstep(54, 96, x + 10 * noise.noise2(z * 0.02, x * 0.02));
        const hP = 3.4 + ramp * (5 + 17 * noise.ridged(x * 0.021 + 7, z * 0.021 - 3, 4)) + 1.2 * noise.fbm(x * 0.05, z * 0.05, 2);
        let inland = ww * hW + wp * hP + ws * hS + wm * hM;
        if (vw > 0) inland = lerp(inland, hV, vw);
        // coastal profile
        H[k] = 1.1 + (inland - 1.1) * smoothstep(0, 18, d - beachW);
      }
    }
  }

  flattenAreas() {
    const { H, flatF, noise } = this;
    const A = this.arenas;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = i - HALF, z = j - HALF, k = j * N + i;
        const r = Math.sqrt(x * x + z * z);
        let h = H[k];
        const fv = (1 - smoothstep(14, 34, r)) * 0.85;
        if (fv > 0) h = lerp(h, 2.3 + 0.25 * noise.fbm(x * 0.05, z * 0.05, 2), fv);
        const fp = 1 - smoothstep(TW.plazaFlat[0], TW.plazaFlat[1], r);
        if (fp > 0) h = lerp(h, this.plaza.h, fp);
        let ff = fp;
        for (const id in A) {
          const a = A[id];
          const d = len2(x - a.x, z - a.z);
          const fa = 1 - smoothstep(a.r + 3, a.r + 11, d);
          if (fa > 0) { h = lerp(h, a.h, fa); ff = Math.max(ff, fa); }
        }
        H[k] = h;
        flatF[k] = ff;
      }
    }
  }

  makePaths() {
    this.paths = {};
    for (const id in this.pathDefs) {
      const pts = sampleSpline(this.pathDefs[id], 1);
      for (const p of pts) p.h = this.hAt(p.x, p.z);
      // smooth heights
      for (let pass = 0; pass < 5; pass++) {
        const src = pts.map((p) => p.h);
        for (let i = 0; i < pts.length; i++) {
          let s = 0, n = 0;
          for (let o = -5; o <= 5; o++) { const q = clamp(i + o, 0, pts.length - 1); s += src[q]; n++; }
          pts[i].h = s / n;
        }
      }
      // pin ends
      pts[0].h = this.plaza.h;
      const arena = this.arenas[id];
      for (const p of pts) {
        p.h = Math.max(0.75, p.h);
        if (len2(p.x, p.z) < TW.plazaFlat[0]) p.h = this.plaza.h;
        if (arena && len2(p.x - arena.x, p.z - arena.z) < arena.r + 3) p.h = arena.h;
      }
      // slope limit (max ~23°)
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i < pts.length; i++) pts[i].h = clamp(pts[i].h, pts[i - 1].h - 0.42, pts[i - 1].h + 0.42);
        for (let i = pts.length - 2; i >= 0; i--) pts[i].h = clamp(pts[i].h, pts[i + 1].h - 0.42, pts[i + 1].h + 0.42);
      }
      // tangent/normal
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, l = len2(dx, dz) || 1;
        pts[i].tx = dx / l; pts[i].tz = dz / l; pts[i].nx = -dz / l; pts[i].nz = dx / l;
      }
      this.paths[id] = pts;
      // rasterize nearest path distance
      for (const p of pts) {
        const R = 5;
        const ci = Math.round(p.x + HALF), cj = Math.round(p.z + HALF);
        for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          const k = j * N + i;
          const d = len2(i - HALF - p.x, j - HALF - p.z);
          if (d < this.pathD[k]) { this.pathD[k] = d; this.pathH[k] = p.h; }
        }
      }
    }
  }
  pathAt(id, t) {
    const pts = this.paths[id];
    return pts[clamp(Math.round(t * (pts.length - 1)), 0, pts.length - 1)];
  }
  pathAtDist(id, d) {
    const pts = this.paths[id];
    return pts[clamp(Math.round(d), 0, pts.length - 1)];
  }

  /** WP9: the true distance (m) to the nearest path sample everywhere (pathD is only rasterised within 5 cells, 99
   *  beyond): a two-pass 5×5 chamfer transform seeded from pathD. this.pathF; pathFAt(x, z) */
  pathField() {
    const D = new Float32Array(N * N), P = this.pathD;
    for (let k = 0; k < N * N; k++) D[k] = P[k] < 7.5 ? P[k] : 1e9;
    const a = 1, b = Math.SQRT2, c = Math.sqrt(5);
    // forward-pass neighbours (already visited when scanning rows up → down, cells left → right); the backward pass
    // mirrors them. The 2-cell border (open sea) keeps its seed
    const off = [-1, -N - 2, -N - 1, -N, -N + 1, -N + 2, -2 * N - 1, -2 * N + 1], w = [a, c, b, a, b, c, c, c];
    for (let pass = 0; pass < 2; pass++) {
      const s = pass ? -1 : 1;
      for (let jj = 2; jj < N - 2; jj++) {
        const j = pass ? N - 1 - jj : jj;
        for (let ii = 2; ii < N - 2; ii++) {
          const k = j * N + (pass ? N - 1 - ii : ii);
          let d = D[k];
          for (let q = 0; q < 8; q++) { const v = D[k + off[q] * s] + w[q]; if (v < d) d = v; }
          D[k] = d;
        }
      }
    }
    this.pathF = D;
  }
  pathFAt(x, z) {
    const i = clamp(Math.round(x + HALF), 0, SIZE), j = clamp(Math.round(z + HALF), 0, SIZE);
    return this.pathF ? this.pathF[j * N + i] : this.pathDAt(x, z);
  }

  carveWater() {
    const { H, riverF } = this;
    const river = sampleSpline(this.riverDef, 1);
    this.river = river;
    const carve = (cx, cz, w, bank, bed) => {
      const R = Math.ceil(w + bank + 1);
      const ci = Math.round(cx + HALF), cj = Math.round(cz + HALF);
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i;
        const d = len2(i - HALF - cx, j - HALF - cz);
        const f = smoothstep(w, w + bank, d);
        if (f < riverF[k]) riverF[k] = f;
      }
    };
    river.forEach((p, i) => {
      const t = i / (river.length - 1);
      carve(p.x, p.z, lerp(2.0, 4.6, t), 6.5, -1.2);
    });
    for (const p of this.ponds) carve(p.x, p.z, p.r, 8, -1.0);
    for (let k = 0; k < N * N; k++) {
      const f = riverF[k];
      if (f < 1) H[k] = Math.min(H[k], lerp(-1.15, H[k], f));
    }
  }

  stampPaths() {
    const { H, pathD, pathH, riverF } = this;
    for (let k = 0; k < N * N; k++) {
      const d = pathD[k];
      if (d > 4.6) continue;
      let w = 1 - smoothstep(1.7, 4.4, d);
      w *= smoothstep(0.35, 0.95, riverF[k]);
      if (w > 0) H[k] = lerp(H[k], pathH[k], w);
    }
    // bridges where paths cross water
    for (const id in this.paths) {
      const pts = this.paths[id];
      let start = -1;
      for (let i = 0; i <= pts.length; i++) {
        const p = pts[i];
        const wet = p && (this.riverFAt(p.x, p.z) < 0.55 || this.hAt(p.x, p.z) < 0.35);
        if (wet && start < 0) start = i;
        if (!wet && start >= 0) {
          const a = pts[Math.max(0, start - 3)], b = pts[Math.min(pts.length - 1, i + 2)];
          this.addBridge(a.x, a.z, b.x, b.z, a.h, b.h, 2.7, id);
          start = -1;
        }
      }
    }
  }
  riverFAt(x, z) {
    const i = clamp(Math.round(x + HALF), 0, SIZE), j = clamp(Math.round(z + HALF), 0, SIZE);
    return this.riverF[j * N + i];
  }
  addBridge(ax, az, bx, bz, h0, h1, w, id) {
    const dx = bx - ax, dz = bz - az, len = len2(dx, dz);
    const b = { ax, az, bx, bz, dx: dx / len, dz: dz / len, len, w, h0: Math.max(0.55, h0), h1: Math.max(0.55, h1), arch: Math.min(0.5, len * 0.04), id };
    this.bridges.push(b);
    return b;
  }

  detail() {
    const { H, noise, pathD, flatF } = this;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = i - HALF, z = j - HALF;
      const pw = 1 - smoothstep(1.5, 4.5, pathD[k]);
      const m = (1 - pw) * (1 - flatF[k]) * smoothstep(0.3, 1.3, H[k]);
      if (m <= 0) continue;
      H[k] += (0.2 * noise.noise2(x * 0.33, z * 0.33) + 0.08 * noise.noise2(x * 0.9, z * 0.9)) * m;
    }
  }

  computeSlope(i0 = 0, j0 = 0, i1 = SIZE, j1 = SIZE) {
    const { H, S } = this;
    for (let j = Math.max(0, j0); j <= Math.min(SIZE, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(SIZE, i1); i++) {
      const k = j * N + i;
      const hl = H[k - (i > 0 ? 1 : 0)], hr = H[k + (i < SIZE ? 1 : 0)];
      const hd = H[k - (j > 0 ? N : 0)], hu = H[k + (j < SIZE ? N : 0)];
      const sx = (hr - hl) / ((i > 0 && i < SIZE) ? 2 : 1), sz = (hu - hd) / ((j > 0 && j < SIZE) ? 2 : 1);
      S[k] = Math.sqrt(sx * sx + sz * sz);
    }
  }

  computeRegions() {
    const { RW, reg } = this;
    for (let k = 0; k < N * N; k++) {
      let best = 0, bv = RW[k * 5];
      for (let r = 1; r < 5; r++) if (RW[k * 5 + r] > bv) { bv = RW[k * 5 + r]; best = r; }
      reg[k] = best;
    }
    // regions are named by id order village, woods, peaks, shores, meadow (matches REGION)
  }

  computeSplat() {
    const { H, S, RW, splatA, splatB, noise, pathD, D } = this;
    const plazaMask = (this.plazaMask = new Float32Array(N * N)), PR = this.plaza.r - 2.5, trailD = this.trailD, CL = this.woodsGaps ? this.woodsGaps.clearings : [];
    const A = this.arenas;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, x = i - HALF, z = j - HALF;
      const h = H[k];
      const vw = RW[k * 5], ww = RW[k * 5 + 1], wp = RW[k * 5 + 2], ws = RW[k * 5 + 3], wm = RW[k * 5 + 4];
      const n1 = noise.noise2(x * 0.09 + 3, z * 0.09 - 8), n2 = noise.noise2(x * 0.21 - 5, z * 0.21 + 2);
      const snowF = smoothstep(6.0, 8.8, h + n1 * 1.6);
      let grass = vw + ws * 0.9 + wp * (1 - snowF) * 0.85 + ww * 0.12 + wm * 0.15;
      let forest = ww * 0.88;
      let meadow = wm * 0.85;
      let snow = wp * snowF;
      let rock = wp * (1 - snowF) * 0.15 * smoothstep(0.1, 0.6, n2);
      let sand = 0, dirt = 0;
      // patchy variation
      const pv = smoothstep(0.15, 0.55, n2);
      grass += meadow * pv * 0.4; meadow *= 1 - pv * 0.4;
      // beaches & sea floor
      const beachT = ws > 0.4 ? 2.0 : 1.4;
      const sandF = 1 - smoothstep(beachT - 0.6, beachT + 0.3, h + n1 * 0.45);
      // slopes
      const rockF = smoothstep(0.62, 0.92, S[k] + n2 * 0.1);
      // paths
      const pd = pathD[k] + n2 * 0.55 + n1 * 0.3;
      let dirtF = 1 - smoothstep(1.15, 2.05, pd);
      for (const id in A) { const a = A[id]; dirtF *= smoothstep(a.r - 3, a.r + 0.5, len2(x - a.x, z - a.z) + n1 * 1.2); }
      const pr = len2(x, z);
      const pm = 1 - smoothstep(PR - 1.2 + n1 * 1.2, PR + 0.4 + n1 * 1.2, pr);   // WP9: the paved plaza (W.plazaMask)
      plazaMask[k] = pm;
      dirtF = Math.max(dirtF, pm);
      // WP9: woods game trails (a narrower, broken dirt line) and lighter, grassy clearing floors
      if (trailD && trailD[k] < 3) dirtF = Math.max(dirtF, 0.85 * (1 - smoothstep(0.3, 0.95, trailD[k] + n2 * 0.35 + n1 * 0.25)));
      if (CL.length && ww > 0.05) {
        let cf = 0;
        for (let q = 0; q < CL.length; q++) { const c = CL[q], d = len2(x - c.x, z - c.z); if (d < c.r + 2.5) cf = Math.max(cf, 1 - smoothstep(c.r - 2.5, c.r + 0.8, d + n1 * 1.4)); }
        if (cf > 0) { forest *= 1 - 0.8 * cf; grass += 0.5 * cf; meadow += 0.35 * cf * pv; }
      }
      // arenas
      let arenaSand = 0, arenaSnow = 0;
      for (const id in A) {
        const a = A[id];
        const d = len2(x - a.x, z - a.z) + n1 * 1.5;
        const f = 1 - smoothstep(a.r - 1, a.r + 2.5, d);
        if (f <= 0) continue;
        if (id === 'woods') dirtF = Math.max(dirtF, f * smoothstep(-0.3, 0.4, n2 + 0.2));
        if (id === 'peaks') arenaSnow = Math.max(arenaSnow, f);
        if (id === 'shores') arenaSand = Math.max(arenaSand, f);
      }
      // normalise base
      let s = grass + forest + meadow + snow + rock + 1e-5;
      grass /= s; forest /= s; meadow /= s; snow /= s; rock /= s;
      const mixIn = (f) => { grass *= 1 - f; forest *= 1 - f; meadow *= 1 - f; snow *= 1 - f; rock *= 1 - f; sand *= 1 - f; dirt *= 1 - f; };
      if (arenaSnow > 0) { mixIn(arenaSnow); snow += arenaSnow; }
      mixIn(sandF); sand += sandF;
      if (arenaSand > 0) { mixIn(arenaSand); sand += arenaSand; }
      mixIn(rockF * (h > -0.5 ? 1 : 0)); rock += rockF * (h > -0.5 ? 1 : 0);
      if (dirtF > 0) { const f = dirtF * (h > 0.2 ? 1 : 0); mixIn(f); dirt += f; }
      splatA[k * 4] = grass; splatA[k * 4 + 1] = forest; splatA[k * 4 + 2] = meadow; splatA[k * 4 + 3] = sand;
      splatB[k * 4] = snow; splatB[k * 4 + 1] = dirt; splatB[k * 4 + 2] = rock; splatB[k * 4 + 3] = 0;
    }
  }

  // ------------------------------------------------------------------ props
  /** t: 0 shared with the foundation, 1 WP9 only, 2 the foundation's only (a ghost for the scatter shadow) */
  reserveCircle(x, z, r, t = 0) {
    (this.reserved || (this.reserved = [])).push({ x, z, r, t });
  }
  isReserved(x, z, pad = 0, skip = 2) {
    if (this.pathDAt(x, z) < 3.0 + pad) return true;
    const RG = pad <= 0 && this._rg;   // scatter's grid (no reservation is added while it runs)
    const list = RG ? RG.get(((Math.floor(x / 8) + 100) * 1000) + (Math.floor(z / 8) + 100)) || [] : this.reserved || [];
    for (const c of list) if (c.t !== skip && len2(x - c.x, z - c.z) < c.r + pad) return true;
    for (const b of this.bridges) if (distToSeg(x, z, b.ax, b.az, b.bx, b.bz) < b.w / 2 + 2.5 + pad) return true;
    return false;
  }
  /** the foundation's isReserved (its reservations, not WP9's): decides what the shadow draws */
  fReserved(x, z, pad = 0) { return this.isReserved(x, z, pad, 1); }
  /** a solid the foundation had and WP9 does not (shadow only; never a collider) */
  ghostSolid(x, z, r) {
    const key = ((Math.floor(x / 4) + 100) * 1000) + (Math.floor(z / 4) + 100);
    const H = this._gh || (this._gh = new Map());
    let a = H.get(key);
    if (!a) H.set(key, (a = []));
    a.push({ x, z, r });
  }
  /** shadow: bit 1 = a solid the foundation had within r (its props and ghosts, not WP9's), bit 2 = one WP9 has */
  solidBits(x, z, r) {
    let bits = 0;
    const c0 = Math.floor((x - r - 2) / 4), c1 = Math.floor((x + r + 2) / 4), d0 = Math.floor((z - r - 2) / 4), d1 = Math.floor((z + r + 2) / 4);
    for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
      const key = ((ci + 100) * 1000) + (cj + 100), a = this._ph && this._ph.get(key), g = this._gh && this._gh.get(key);
      if (a) for (const p of a) if (!p.removed && len2(p.x - x, p.z - z) < p.r + r) bits |= p.wp9 ? 2 : 3;
      if (g) for (const p of g) if (len2(p.x - x, p.z - z) < p.r + r) bits |= 1;
      if (bits === 3) return 3;
    }
    return bits;
  }
  /** shadow: the same bits for the explicit colliders (within c.r + rad) */
  collBits(x, z, rad) {
    let bits = 0;
    const G8 = this._cg;
    if (G8) {   // scatter's grid (8 m cells, each collider in every cell its circle + 3 m touches)
      const a = G8.get(((Math.floor(x / 8) + 100) * 1000) + (Math.floor(z / 8) + 100));
      if (a) for (const c of a) if (len2(c.x - x, c.z - z) < c.r + rad) { bits |= c.wp9 ? 2 : 3; if (bits === 3) return 3; }
    } else for (const c of this.colliders) if (len2(c.x - x, c.z - z) < c.r + rad) { bits |= c.wp9 ? 2 : 3; if (bits === 3) return 3; }
    for (const c of this.fnd.cols) if (len2(c.x - x, c.z - z) < c.r + rad) return bits | 1;
    return bits;
  }
  /** bilinear sample of a terrain-sized array (hAt / slopeAt of another copy, e.g. the shadow's foundation terrain) */
  sampleA(A, x, z) {
    const fx = clamp(x + HALF, 0, SIZE - 0.001), fz = clamp(z + HALF, 0, SIZE - 0.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * N + i;
    const a = A[k] + (A[k + 1] - A[k]) * tx, b = A[k + N] + (A[k + N + 1] - A[k + N]) * tx;
    return a + (b - a) * tz;
  }
  pathDAt(x, z) {
    const i = clamp(Math.round(x + HALF), 0, SIZE), j = clamp(Math.round(z + HALF), 0, SIZE);
    return this.pathD[j * N + i];
  }
  /** add a prop. o: { rot, s, y, r (solid radius override), solid, extra (fields copied onto the prop), collider }.
   *  collider declares the prop's collision shape at scale 1 (× s), where the prop is made:
   *  { r, h, cam, eye | eyeS | eyeAdd, sink, stand, shape: 'circle'|'obb', hx, hz } (the COLLIDER_H field names,
   *  world-collide.js). It makes the prop solid (radius r, or the OBB's bounding circle), and its fields override
   *  COLLIDER_H[type] when the collider is baked */
  addProp(type, x, z, o = {}) {
    const s = o.s ?? 1, col = o.collider || DECL[type] || null;
    const cr = col ? col.r ?? (col.hx != null ? Math.hypot(col.hx, col.hz || 0) : null) : null;
    const p = {
      type, x, z, y: o.y ?? this.ground(x, z), rot: o.rot ?? this.rng.range(0, TAU), s,
      r: o.r ?? (cr != null ? cr * s : SOLID[type] ? SOLID[type] * s : 0), solid: o.solid ?? (!!SOLID[type] || !!col),
      id: this.props.length, ...o.extra,
    };
    if (col) p.collider = col;
    this.props.push(p);
    this.spatialAdd(p);
    return p;
  }
  spatialAdd(p) {
    if (!p.solid) return;
    const key = ((Math.floor(p.x / 4) + 100) * 1000) + (Math.floor(p.z / 4) + 100);
    (this._ph || (this._ph = new Map()));
    let a = this._ph.get(key);
    if (!a) this._ph.set(key, (a = []));
    a.push(p);
  }
  solidNear(x, z, r) {
    if (!this._ph) return null;
    const c0 = Math.floor((x - r - 2) / 4), c1 = Math.floor((x + r + 2) / 4);
    const d0 = Math.floor((z - r - 2) / 4), d1 = Math.floor((z + r + 2) / 4);
    for (let ci = c0; ci <= c1; ci++) for (let cj = d0; cj <= d1; cj++) {
      const a = this._ph.get(((ci + 100) * 1000) + (cj + 100));
      if (!a) continue;
      for (const p of a) if (!p.removed && len2(p.x - x, p.z - z) < p.r + r) return p;
    }
    return null;
  }
  addDeco(type, x, z, o = {}) {
    this.deco.push({ type, x, z, y: o.y ?? this.hAt(x, z), rot: o.rot ?? this.rng.range(0, TAU), s: o.s ?? 1, id: this.deco.length });
  }
  addInteract(kind, x, z, o = {}) {
    const it = { kind, x, z, y: o.y ?? this.ground(x, z), r: o.r ?? 1.6, h: o.h ?? 1.4, ...o };
    this.interact.push(it);
    return it;
  }
  addSign(x, z, lines, faceX, faceZ) {
    const rot = Math.atan2(faceX - x, faceZ - z);
    const p = this.addProp('sign', x, z, { rot });
    this.addInteract('sign', x, z, { lines, h: 1.5, r: 1.6, prop: p });
    this.reserveCircle(x, z, 1.4);
    return p;
  }

  /** root-mound radius (m, at TW.treeH) toward bearing ang (0 = +Z south, π/2 = +X east), interpolated from TW.rootR */
  rootRAt(ang) {
    const R = TW.rootR, n = R.length, f = ((((ang / TAU) % 1) + 1) % 1) * n, i = Math.floor(f) % n, t = f - Math.floor(f);
    return R[i] + (R[(i + 1) % n] - R[i]) * t;
  }
  placeVillage() {
    const r = this.rng;
    const face = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);
    // Great Tree (19.8 m, art §4.6): trunk core + a ring of low root colliders that follow the GLB's root mound by
    // bearing (TW.rootR), so neither the body nor the eye ever enters the bark or a root arch
    const T = this.treePos, k = TW.treeH / 19.8;
    this.greatTree = { x: T.x, z: T.z, y: this.plaza.h, scaleHeight: TW.treeH, height: TW.treeH };
    this.reserveCircle(T.x, T.z, 9.5 * k, 1);
    this.colliders.push({ x: T.x, z: T.z, r: 4.2 * k, kind: 'tree', wp9: true });
    // view (r2): the TP arm reads the star collider's measured root heights (world-collide.js); the ring only keeps it
    // off the root tips (cam 2.4 walled off the gaps between the roots and folded the arm into Pip at 3 of 5 bearings)
    const ROOT = { h: 2.4, cam: 0.6, eyeAdd: 0.2 };
    for (let q = 0; q < 24; q++) {
      const ang = (q / 24) * TAU, R = this.rootRAt(ang) * k, ds = [];
      for (let d = 3.8 * k; d < R - 1.1 * k - 0.4; d += 1.8 * k) ds.push(d);
      ds.push(Math.max(3.8 * k, R - 1.1 * k));
      for (const d of ds) this.colliders.push({ x: T.x + Math.sin(ang) * d, z: T.z + Math.cos(ang) * d, r: 1.1 * k, kind: 'gtroot', decl: ROOT, wp9: true });
    }
    // the altar (art §4.4): 1.05 m, its socket slab tilted toward the south approach. Round in Pip's body band (brick ring
    // r 1.0–1.06, slab corners ≈ 1.0 m out): a circle sized to the mesh (WP3 keeps declared shapes exact; the old
    // 0.92 × 0.52 box let Pip walk 0.48 m into it from the north and south and put the FP eye under the slab)
    const P = this.pedestal;
    this.addProp('pedestal', P.x, P.z, { rot: 0, collider: { r: TW.pedestalR, h: TW.pedestalTop + 0.3, eye: 1.15 }, extra: WP9 });
    this.addInteract('pedestal', P.x, P.z, { r: 2.4, h: 1.5 });
    this.reserveCircle(P.x, P.z, 2.5, 1);
    this.reserveCircle(this.spawn.x, this.spawn.z, 2, 1);
    // shadow ghosts of the foundation's tree, altar and spawn
    {
      const F = this.fnd;
      this.reserveCircle(T.x, T.z, FND.treeRes, 2);
      F.cols.push({ x: T.x, z: T.z, r: 2.6 });
      for (let a = 0; a < 5; a++) { const ang = (a / 5) * TAU + 0.4; F.cols.push({ x: T.x + Math.sin(ang) * 2.6, z: T.z + Math.cos(ang) * 2.6, r: 0.9 }); }
      this.ghostSolid(P.x, FND.pedestalZ, SOLID.pedestal);
      this.reserveCircle(P.x, FND.pedestalZ, 2.5, 2);
      this.reserveCircle(this.spawn.x, FND.spawnZ, 2, 2);
    }
    // houses
    const houseSpots = [
      { type: 'house_a', x: -16, z: -14 }, { type: 'house_b', x: 15, z: -16 }, { type: 'house_a', x: -18, z: 13 },
      { type: 'house_b', x: 24, z: -6 }, { type: 'house_a', x: -25, z: -3 },
    ];
    houseSpots.forEach((hs, n) => {
      const rot = face(hs.x, hs.z);
      const y = this.hAt(hs.x, hs.z);
      const h = { type: hs.type, x: hs.x, z: hs.z, y, rot, n };
      this.houses.push(h);
      this.reserveCircle(hs.x, hs.z, 4.2);
      const fx = Math.sin(rot), fz = Math.cos(rot), rx = Math.cos(rot), rz = -Math.sin(rot);
      // footprint colliders (the back dressing — woodpile, barrels, laundry line — stands inside the back circles)
      for (const [a, b, rr] of [[0, 0, 2.3], [1.3, -0.6, 1.7], [-1.3, -0.6, 1.7], [0, -1.4, 1.8]]) {
        this.colliders.push({ x: hs.x + rx * a + fx * b, z: hs.z + rz * a + fz * b, r: rr, kind: 'house' });
      }
      for (const [a, b, rr, hh] of HOUSE_DRESSING[hs.type] || []) this.colliders.push({ x: hs.x + rx * a + fx * b, z: hs.z + rz * a + fz * b, r: rr, kind: 'dressing', decl: { h: hh, eyeAdd: 0.12 }, wp9: true });
      const dx = hs.x + fx * 2.55, dz = hs.z + fz * 2.55;
      this.addInteract('door', dx, dz, { lines: [DOOR_LINES[n % DOOR_LINES.length]], h: 2.4, r: 1.5 });
      // garden: fence + flowers + pots
      for (const side of [-1, 1]) {
        const bx = hs.x + rx * side * 3.4 + fx * 1.2, bz = hs.z + rz * side * 3.4 + fz * 1.2;
        this.addFence(bx, bz, bx + fx * 2.6, bz + fz * 2.6);
        for (let f = 0; f < 3; f++) this.addDeco('flowers', hs.x + rx * side * 2.7 + fx * (1.6 + f * 0.6) + r.range(-0.2, 0.2), hs.z + rz * side * 2.7 + fz * (1.6 + f * 0.6), { s: r.range(0.8, 1.1) });
      }
      const pside = r.chance(0.5) ? 1 : -1;
      this.addProp('pot', hs.x + rx * pside * 1.9 + fx * 2.9, hs.z + rz * pside * 1.9 + fz * 2.9, { extra: { breakable: true } });
      if (r.chance(0.6)) this.addProp('pot', hs.x + rx * pside * 2.5 + fx * 2.7, hs.z + rz * pside * 2.5 + fz * 2.7, { s: 0.85, extra: { breakable: true } });
    });
    // shop: an outdoor counter (top 0.57 m) under the awning with Miso behind it (art §4.4), crates closing its ends
    {
      const x = 15, z = 14, rot = face(x, z);
      const y = this.hAt(x, z);
      this.shop = { x, z, y, rot };
      this.reserveCircle(x, z, 4.6);
      const fx = Math.sin(rot), fz = Math.cos(rot), rx = Math.cos(rot), rz = -Math.sin(rot);
      const L = (a, b) => ({ x: x + rx * a + fx * b, z: z + rz * a + fz * b });
      for (const [a, b, rr] of [[0, -0.3, 2.5], [1.5, -0.7, 1.8], [-1.5, -0.7, 1.8]]) { const q = L(a, b); this.colliders.push({ x: q.x, z: q.z, r: rr, kind: 'house' }); }
      for (const [a, b, rr, hh] of HOUSE_DRESSING.shop) { const q = L(a, b); this.colliders.push({ x: q.x, z: q.z, r: rr, kind: 'dressing', decl: { h: hh, eyeAdd: 0.12 }, wp9: true }); }
      const COUNTER = { h: 0.82, cam: 0.82, eye: 0.5 };
      for (const [a, b, rr] of [[-0.2, 2.55, 0.42], [0.55, 2.55, 0.42], [1.3, 2.55, 0.42], [-0.62, 2.0, 0.3], [1.95, 2.0, 0.3]]) { const q = L(a, b); this.colliders.push({ x: q.x, z: q.z, r: rr, kind: 'counter', decl: COUNTER, wp9: true }); }
      const m = L(0.55, 2.0);
      this.npcSpots.miso = { x: m.x, z: m.z, rot };
      const d = L(-1.4, 2.6);
      this.addInteract('door', d.x, d.z, { lines: ['A sign on the door: "Miso\'s Shop. Ring the cat for service." The cat is Miso. She is right there at the counter.'], h: 2.2, r: 1.2 });
      const p1 = L(2.9, 2.2), p2 = L(3.4, 1.4);
      this.addProp('pot', p1.x, p1.z, { extra: { breakable: true } });
      this.addProp('pot', p2.x, p2.z, { s: 0.8, extra: { breakable: true } });
    }
    // well (rim lowered to 0.62 m, a frog on a lily pad inside: world-mod.js)
    this.addProp('well', 9, -7.5, { rot: face(9, -7.5) });
    this.addInteract('well', 9, -7.5, { r: 2.0, h: 2.6, lines: ['You peek into the well. A tiny frog on a lily pad waves back at you.', '...You wave back. It feels like the polite thing to do.'] });
    this.reserveCircle(9, -7.5, 2.4);
    // shadow: the foundation's 12 lamps (one rotation draw each) and its four village exit signs, as ghosts
    {
      const ghost = (x, z) => { r.range(0, TAU); this.ghostSolid(x, z, SOLID.lamp); this.reserveCircle(x, z, 1.2, 2); };
      for (const deg of [35, 145, 215, 325]) { const a = (deg / 180) * Math.PI; ghost(Math.sin(a) * FND.lampR, -Math.cos(a) * FND.lampR); }
      for (const id in this.paths) {
        const p1 = this.pathAtDist(id, 16), p2 = this.pathAtDist(id, 34);
        ghost(p1.x + p1.nx * 2.4, p1.z + p1.nz * 2.4); ghost(p2.x - p2.nx * 2.4, p2.z - p2.nz * 2.4);
      }
      for (const id of ['woods', 'peaks', 'shores', 'meadow']) { const p = this.pathAtDist(id, 9), x = p.x + p.nx * 2.6, z = p.z + p.nz * 2.6; this.ghostSolid(x, z, SOLID.sign); this.reserveCircle(x, z, 1.4, 2); }
    }
    // lamps: a ring at the plaza edge, then one every lampEvery m along each path (never on or beside a bridge), plus a
    // pair at the ends of every path bridge (art §4.4, world map: no lamp mid-bridge)
    for (const deg of [35, 145, 215, 325]) {
      const a = (deg / 180) * Math.PI;
      const lx = Math.sin(a) * TW.lampR, lz = -Math.cos(a) * TW.lampR;
      this.addLamp(lx, lz, face(lx, lz) - Math.PI / 2);
    }
    this.placePathLamps();
    // signpost at the plaza's south edge (replaces the four village exit signs): four arrow arms point down the paths
    {
      const pts = this.paths.shores;
      let i0 = pts.findIndex((p) => len2(p.x, p.z) > this.plaza.r + 1.5);
      if (i0 < 0) i0 = 8;
      const p = pts[i0];
      let side = 1;
      if (Math.abs(p.x + p.nx * 2.5) < Math.abs(p.x - p.nx * 2.5)) side = -1;
      const sx = p.x + p.nx * side * 2.5, sz = p.z + p.nz * side * 2.5;
      const rot = face(sx, sz);
      const prop = this.addProp('signpost', sx, sz, { rot, collider: { r: 0.22, h: 2.3, eye: 0.4 }, extra: WP9 });
      const aim = (id, idx) => { const q = this.paths[id][Math.min(this.paths[id].length - 1, idx)]; return Math.atan2(q.x - sx, q.z - sz); };
      const arms = [
        { id: 'woods', yaw: aim('woods', 24) }, { id: 'peaks', yaw: aim('peaks', 24) },
        { id: 'meadow', yaw: aim('meadow', 24) }, { id: 'shores', yaw: aim('shores', i0 + 20) },
      ];
      arms.forEach((a, i) => { a.name = SIGNS[a.id][0]; a.y = 2.0 - i * 0.3; });
      this.signpost = { x: sx, z: sz, y: this.ground(sx, sz), rot, arms, prop };
      const lines = ['A signpost with four arrows, one for each corner of the isle.'].concat(arms.map((a) => SIGNS[a.id].join(': ')));
      // no `prop` on the interact entry: the arms are painted on both faces, so it reads from every side (WP4's frontOk
      // limits a sign with a prop to its front half-plane)
      this.addInteract('sign', sx, sz, { lines, h: 2.1, r: 1.8, signpost: true });
      this.reserveCircle(sx, sz, 1.6, 1);
    }
    {
      const s = this.pathAtDist('shores', 22), side = -1;
      this.addSign(s.x + s.nx * side * 2.6, s.z + s.nz * side * 2.6, SIGNS.village, s.x + s.tx * 6, s.z + s.tz * 6);
    }
    // NPCs (moved out of the root mound; never on the z = 9 test line west of the altar)
    this.npcSpots.shellby = { x: -3.8, z: TW.pedestalZ - 0.9, rot: face(-3.8, TW.pedestalZ - 0.9, 0, TW.spawnZ) };
    this.npcSpots.ribbit = { x: -11, z: 3.5, rot: face(-11, 3.5, 0, TW.spawnZ) };
    for (const k2 of ['shellby', 'ribbit']) this.reserveCircle(this.npcSpots[k2].x, this.npcSpots[k2].z, 2.2, 1);
    for (const [x, z] of FND.npcs) this.reserveCircle(x, z, 2.2, 2);
    {
      const p = this.pathAtDist('shores', 40);
      this.npcSpots.clover = { x: p.x - p.nx * 2.6, z: p.z - p.nz * 2.6, rot: 0 };
      const q = this.pathAtDist('woods', 44);
      this.npcSpots.hoot = { x: q.x + q.nx * 2.7, z: q.z + q.nz * 2.7, rot: 0 };
      const pts = this.paths.meadow; const m = pts[pts.length - 1];
      this.npcSpots.digby = { x: m.x - 3, z: m.z + 2.5, rot: 0 };
      this.meadowCenter = { x: m.x, z: m.z };
      for (const k2 of ['clover', 'hoot', 'digby']) this.reserveCircle(this.npcSpots[k2].x, this.npcSpots[k2].z, 2.4);
      this.reserveCircle(m.x, m.z, 5);
    }
    // flower beds just outside the paved plaza: the foundation's draws (a ring at 12.5–16 m, skipped on its paths), moved
    // out to the new plaza edge
    for (let i = 0; i < 26; i++) {
      const a = r.range(0, TAU), rr = r.range(12.5, 16);
      if (this.pathDAt(Math.sin(a) * rr, Math.cos(a) * rr) < 2.2) continue;
      const s = r.range(0.8, 1.2), rot = r.range(0, TAU), R2 = this.plaza.r + 1.5 + (rr - 12.5) * (3 / 3.5);
      const x = Math.sin(a) * R2, z = Math.cos(a) * R2;
      if (this.pathDAt(x, z) >= 2.2) this.addDeco('flowers', x, z, { s, rot });
    }
    this.reserveCircle(0, 0, this.plaza.r + 1, 1);
    this.reserveCircle(0, 0, FND.plazaRes, 2);
  }
  /** path lamps every TW.lampEvery m (alternating sides, the lantern arm over the path), skipping bridges; a pair at the
   *  ends of each path bridge */
  placePathLamps() {
    const nearBridge = (x, z, pad) => this.bridges.some((b) => distToSeg(x, z, b.ax, b.az, b.bx, b.bz) < b.w / 2 + pad);
    const ok = (x, z) => this.bridgeAt(x, z) === null && !nearBridge(x, z, 2.2) && this.pathDAt(x, z) >= 2.0 && this.hAt(x, z) > 0.6 && this.slopeAt(x, z) < 0.5;
    for (const id in this.paths) {
      const pts = this.paths[id];
      let side = 1;
      for (let d = TW.lampFrom; d <= Math.min(TW.lampTo, pts.length - 14); d += TW.lampEvery) {
        for (const dd of [0, 3, -3, 6]) {
          const p = this.pathAtDist(id, d + dd);
          const x = p.x + p.nx * side * 2.4, z = p.z + p.nz * side * 2.4;
          if (!ok(x, z)) continue;
          this.addLamp(x, z, Math.atan2(p.nz * side, -p.nx * side));
          break;
        }
        side = -side;
      }
    }
    for (const b of this.bridges) {
      if (b.id === 'islet1' || b.id === 'islet2') continue;
      for (const [t, back] of [[0, -1], [1, 1]]) {
        const ex = b.ax + b.dx * b.len * t + b.dx * back * 1.4, ez = b.az + b.dz * b.len * t + b.dz * back * 1.4;
        const nx = -b.dz, nz = b.dx;
        const x = ex + nx * (b.w / 2 + 0.9), z = ez + nz * (b.w / 2 + 0.9);
        if (this.bridgeAt(x, z) !== null || this.hAt(x, z) < 0.6 || this.slopeAt(x, z) > 0.6) continue;
        this.addLamp(x, z, Math.atan2(nz, -nx));
      }
    }
  }
  addLamp(x, z, rot) {
    const p = this.addProp('lamp', x, z, { rot, extra: WP9 });   // every lamp is WP9's now (the shadow keeps the old ones)
    this.lamps.push(p);
    this.reserveCircle(x, z, 1.2, 1);
    return p;
  }
  addFence(ax, az, bx, bz) {
    const len = len2(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = lerp(ax, bx, t), z = lerp(az, bz, t);
      this.props.push({ type: 'fence', x, z, y: this.hAt(x, z), rot: rot + Math.PI / 2, s: (len / n) / 1.3, r: 0, solid: false, id: this.props.length });
    }
    for (let i = 0; i <= Math.ceil(len / 0.55); i++) {
      const t = i / Math.ceil(len / 0.55);
      this.colliders.push({ x: lerp(ax, bx, t), z: lerp(az, bz, t), r: 0.2, kind: 'fence' });
    }
  }

  placeArenas() {
    const r = this.rng;
    for (const id in this.arenas) {
      const a = this.arenas[id];
      // entrance angle: where the path enters the ring
      const pts = this.paths[id];
      let ent = pts[pts.length - 1];
      for (let i = pts.length - 1; i >= 0; i--) { if (len2(pts[i].x - a.x, pts[i].z - a.z) > a.r + 2) { ent = pts[i]; break; } }
      a.entAng = Math.atan2(ent.x - a.x, ent.z - a.z);
      a.entrance = { x: a.x + Math.sin(a.entAng) * (a.r + 1.5), z: a.z + Math.cos(a.entAng) * (a.r + 1.5) };
      // outside the entrance: where B teleports
      let outside = pts[0];
      for (let i = pts.length - 1; i >= 0; i--) { if (len2(pts[i].x - a.x, pts[i].z - a.z) > a.r + 7) { outside = pts[i]; break; } }
      a.outside = { x: outside.x, z: outside.z };
      this.reserveCircle(a.x, a.z, a.r + 0.8);
      const ringR = a.r + 1.9;
      const n = Math.round((TAU * ringR) / 2.3);
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU;
        if (Math.abs(angDiff(ang, a.entAng)) < 0.25) continue;
        const rr = ringR + r.range(-0.3, 0.6);
        const x = a.x + Math.sin(ang) * rr, z = a.z + Math.cos(ang) * rr;
        let type;
        if (id === 'woods') type = r.chance(0.6) ? 'tree_pine' : 'tree_round';
        else if (id === 'peaks') type = r.chance(0.55) ? 'boulder' : 'tree_snow';
        else type = r.chance(0.5) ? 'boulder' : (r.chance(0.5) ? 'tree_palm' : 'rock');
        if (type === 'tree_palm' && this.hAt(x, z) < 0.5) type = 'rock';
        const s = type === 'boulder' ? r.range(1.0, 1.35) : type === 'rock' ? r.range(1.3, 1.7) : r.range(1.05, 1.3);
        this.addProp(type, x, z, { s, extra: { arena: id } });
        // second, outer row to make the ring read as a wall
        if (k % 2 === 0) {
          const x2 = a.x + Math.sin(ang + 0.07) * (rr + 2.2), z2 = a.z + Math.cos(ang + 0.07) * (rr + 2.2);
          this.addProp(type === 'tree_palm' ? 'rock' : type, x2, z2, { s: s * 0.95, extra: { arena: id } });
        }
      }
      // gate-post decorations and sign
      for (const side of [-1, 1]) {
        const ang = a.entAng + side * 0.3;
        const x = a.x + Math.sin(ang) * (a.r + 2.2), z = a.z + Math.cos(ang) * (a.r + 2.2);
        this.addProp(id === 'shores' ? 'rock' : 'boulder', x, z, { s: 0.9 });
      }
      const sgn = this.pathAtDist(id, this.paths[id].length - (a.r + 8));
      this.addSign(sgn.x + sgn.nx * 2.6, sgn.z + sgn.nz * 2.6, SIGNS['arena_' + id], sgn.x - sgn.tx * 6, sgn.z - sgn.tz * 6);
      // pots near entrance
      for (let i = 0; i < 2; i++) {
        const q = this.pathAtDist(id, this.paths[id].length - (a.r + 5) - i * 1.2);
        const px = q.x - q.nx * 2.4, pz = q.z - q.nz * 2.4;
        if (Math.abs(this.hAt(px, pz) - q.h) < 0.5) this.addProp('pot', px, pz, { extra: { breakable: true } });
      }
      // a few decorations inside
      for (let i = 0; i < 10; i++) {
        const ang = r.range(0, TAU), rr = r.range(a.r * 0.65, a.r - 0.5);
        const x = a.x + Math.sin(ang) * rr, z = a.z + Math.cos(ang) * rr;
        this.addDeco(id === 'woods' ? 'glowshroom' : id === 'shores' ? 'shell' : 'pebble', x, z, { s: r.range(0.8, 1.2) });
      }
    }
  }

  findSpot(cx, cz, rMin, rMax, ok, tries = 80) {
    const r = this.rng;
    for (let t = 0; t < tries; t++) {
      const a = r.range(0, TAU), d = r.range(rMin, rMax);
      const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
      if (ok(x, z)) return { x, z };
    }
    return null;
  }
  flatGood(x, z, rad = 2) {
    const h = this.hAt(x, z);
    if (h < 0.5) return false;
    for (let a = 0; a < 8; a++) {
      const xx = x + Math.sin(a) * rad, zz = z + Math.cos(a) * rad;
      if (this.hAt(xx, zz) < 0.4 || this.slopeAt(xx, zz) > 0.55) return false;
    }
    return this.slopeAt(x, z) < 0.5 && !this.inArena(x, z, 4);
  }
  flattenDisc(x, z, rad, falloff, h) {
    const R = Math.ceil(rad + falloff + 1);
    const ci = Math.round(x + HALF), cj = Math.round(z + HALF);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const k = j * N + i;
      const d = len2(i - HALF - x, j - HALF - z);
      const f = 1 - smoothstep(rad, rad + falloff, d);
      if (f > 0) { this.H[k] = lerp(this.H[k], h, f); this.flatF[k] = Math.max(this.flatF[k], f); }
    }
    this.computeSlope(ci - R - 1, cj - R - 1, ci + R + 1, cj + R + 1);
  }
  addChest(id, x, z, kind, amount) {
    const rot = this.rng.range(0, TAU);
    const y = this.hAt(x, z);
    const c = { id, x, z, y, rot, kind, amount };
    this.chests.push(c);
    this.colliders.push({ x, z, r: 0.62, kind: 'chest' });
    this.addInteract('chest', x, z, { chest: c, r: 1.7, h: 1.2 });
    this.reserveCircle(x, z, 2.4);
    return c;
  }

  /** r3: does the peaks heart-chest nook at path point p (side ±1) stay open without a carved corridor? A local walk
   *  grid (1 m cells and the slope limit of buildWalk) over the terrain with the walkway and nook flattened as
   *  placeSpecial does, the solids placed so far and the nook's boulder wall (lobe at any yaw), on the path's, the
   *  walkway's and the nook's own ground only: the path must still run through (on a steep stretch the flat discs cut
   *  it: seeds 52 / 89 / 103 carved the path and the arena back) and the nook must join it (beside the peaks arena its
   *  dressing closed the walkway: seeds 25 / 87 / 111). Draws nothing and puts the terrain back, so a seed whose first
   *  nook passes (7151) is generated bit for bit as before */
  nookOk(p, side) {
    const h = p.h + 0.3, mx = p.x + p.nx * side * 5 + p.tx * 4, mz = p.z + p.nz * side * 5 + p.tz * 4;
    const bx = p.x + p.nx * side * 10, bz = p.z + p.nz * side * 10, walk = [];
    for (let t = 0; t <= 1; t += 0.08) walk.push([lerp(p.x, mx, t), lerp(p.z, mz, t)]);
    for (let t = 0; t <= 1; t += 0.08) walk.push([lerp(mx, bx, t), lerp(mz, bz, t)]);
    const wall = [-1, 0, 1].map((k) => [p.x + p.nx * side * 6.2 - p.tx * (k * 2.4 + 1.5), p.z + p.nz * side * 6.2 - p.tz * (k * 2.4 + 1.5)]);
    const pts = this.paths.peaks, i0 = pts.indexOf(p), pa = pts[Math.max(0, i0 - 10)], pb = pts[Math.min(pts.length - 1, i0 + 10)];
    let x0 = Math.min(bx, mx), x1 = Math.max(bx, mx), z0 = Math.min(bz, mz), z1 = Math.max(bz, mz);
    for (let i = Math.max(0, i0 - 10); i <= Math.min(pts.length - 1, i0 + 10); i++) { x0 = Math.min(x0, pts[i].x); x1 = Math.max(x1, pts[i].x); z0 = Math.min(z0, pts[i].z); z1 = Math.max(z1, pts[i].z); }
    const I0 = Math.floor(x0 - 5 + HALF), J0 = Math.floor(z0 - 5 + HALF), w = Math.ceil(x1 - x0 + 10), d = Math.ceil(z1 - z0 + 10);
    const H = this.H.slice(), S = this.S.slice(), F = this.flatF.slice();
    for (const [x, z] of walk) this.flattenDisc(x, z, 1.8, 2.5, h);
    this.flattenDisc(bx, bz, 3.6, 3.5, h);
    const ok = new Uint8Array(w * d), seen = new Uint8Array(w * d), q = [];
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
      const x = I0 + i - HALF + 0.5, z = J0 + j - HALF + 0.5;
      const lane = this.pathDAt(x, z) < 2 || len2(x - bx, z - bz) < 4 || walk.some(([u, v]) => len2(u - x, v - z) < 2.5);   // no detour scatter may fill later
      ok[j * w + i] = lane && this.walkable(x, z) && !this.solidNear(x, z, 0.25) && wall.every(([u, v]) => len2(u - x, v - z) > 2.0) ? 1 : 0;
    }
    this.H.set(H); this.S.set(S); this.flatF.set(F);
    const cell = (x, z) => [Math.floor(x + HALF) - I0, Math.floor(z + HALF) - J0];
    const [si, sj] = cell(pa.x, pa.z);
    if (ok[sj * w + si]) { seen[sj * w + si] = 1; q.push(sj * w + si); }
    while (q.length) {
      const c = q.pop(), i = c % w, j = (c / w) | 0;
      for (const n of [i > 0 ? c - 1 : -1, i < w - 1 ? c + 1 : -1, j > 0 ? c - w : -1, j < d - 1 ? c + w : -1]) if (n >= 0 && ok[n] && !seen[n]) { seen[n] = 1; q.push(n); }
    }
    const got = (x, z, r) => { const [ci, cj] = cell(x, z); for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && j >= 0 && i < w && j < d && seen[j * w + i]) return true; } return false; };
    return got(pb.x, pb.z, 1) && got(bx, bz, 2);
  }

  placeSpecial() {
    const r = this.rng;
    // ---- heart container chests ----
    // Meadow: a ring of tall sunflowers (1.2–1.6 m, over the eye) with a gap toward the nearest path (art §4.2)
    let sp = this.findSpot(-92, 34, 0, 14, (x, z) => this.flatGood(x, z, 4) && this.pathDAt(x, z) > 10 && this.regionAt(x, z) === REGION.MEADOW) || { x: -90, z: 34 };
    this.flattenDisc(sp.x, sp.z, 4, 4, this.hAt(sp.x, sp.z));
    this.addChest('hc_meadow', sp.x, sp.z, 'heart', 0);
    // shadow: the foundation's flower ring drew 18 deco rotations and 5 bush rotations here (the bushes become ghosts)
    for (let k = 0; k < 18; k++) {
      r.range(0, TAU);
      if (k % 3 === 0 && k !== 0) { const a = (k / 18) * TAU; r.range(0, TAU); this.ghostSolid(sp.x + Math.sin(a) * 4.3, sp.z + Math.cos(a) * 4.3, SOLID.bush * 0.9); }
    }
    {
      let best = null, bd = 1e9;
      for (const id in this.paths) for (const q of this.paths[id]) { const d = len2(q.x - sp.x, q.z - sp.z); if (d < bd) { bd = d; best = q; } }
      const gap = best ? Math.atan2(best.x - sp.x, best.z - sp.z) : 0;
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU + gap;
        if (Math.abs(angDiff(a, gap)) < 0.4) continue;
        const rr = 3.9 + 0.3 * Math.sin(k * 2.3);
        this.addProp('sunflower', sp.x + Math.sin(a) * rr, sp.z + Math.cos(a) * rr, { rot: a + Math.PI, s: 1.0 + 0.3 * ((k * 7) % 5) / 4, extra: WP9 });
        this.addDeco('flowers', sp.x + Math.sin(a + 0.2) * 3.0, sp.z + Math.cos(a + 0.2) * 3.0, { s: 1.2, rot: a });
      }
      sp.gap = gap;
    }
    this.reserveCircle(sp.x, sp.z, 5);
    this.hcSpots = { meadow: sp };
    // Shores: far islet + bridges
    {
      const [i1, i2] = this.islets;
      // find coast point from islet 1 toward island center
      const dir = { x: -i1.x / len2(i1.x, i1.z), z: -i1.z / len2(i1.x, i1.z) };
      let cx = i1.x, cz = i1.z, inside = 0;
      for (let d = i1.r * 0.6; d < 60; d += 0.5) {
        const x = i1.x + dir.x * d, z = i1.z + dir.z * d;
        if (inside === 0 && this.hAt(x, z) < 0.2) inside = 1;
        if (inside === 1 && this.hAt(x, z) > 0.55) { cx = x + dir.x * 1.5; cz = z + dir.z * 1.5; break; }
      }
      const e1 = { x: i1.x + dir.x * i1.r * 0.45, z: i1.z + dir.z * i1.r * 0.45 };
      this.addBridge(cx, cz, e1.x, e1.z, this.hAt(cx, cz), this.hAt(e1.x, e1.z), 2.5, 'islet1');
      const d2x = i2.x - i1.x, d2z = i2.z - i1.z, l2 = len2(d2x, d2z);
      const a1 = { x: i1.x + (d2x / l2) * i1.r * 0.45, z: i1.z + (d2z / l2) * i1.r * 0.45 };
      const a2 = { x: i2.x - (d2x / l2) * i2.r * 0.45, z: i2.z - (d2z / l2) * i2.r * 0.45 };
      this.addBridge(a1.x, a1.z, a2.x, a2.z, this.hAt(a1.x, a1.z), this.hAt(a2.x, a2.z), 2.5, 'islet2');
      this.addChest('hc_shores', i2.x + 0.5, i2.z + 1.2, 'heart', 0);
      this.addProp('tree_palm', i2.x - 2.2, i2.z - 1.0, { s: 0.95 });
      const palm1 = this.addProp('tree_palm', i1.x + 2.4, i1.z + 1.5, { s: 1.05 });
      // the islet rock: the foundation's spot (−2.5, +2) is in the islet-2 bridge's mouth (a wedge with the rail end post
      // that stops an approach at 35°), so it turns round the islet's centre to the first spot ≥ 1.5 m clear of every
      // bridge; the foundation's spot stays a ghost for the scatter shadow (no draw: the stream is unchanged)
      {
        const rr = SOLID.rock * 0.9, R0 = len2(2.5, 2), a0 = Math.atan2(-2.5, 2);
        let at = null;
        for (let k = 0; k <= 24 && !at; k++) {
          const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25, x = i1.x + Math.sin(a) * R0, z = i1.z + Math.cos(a) * R0;
          if (this.bridges.every((b) => distToSeg(x, z, b.ax, b.az, b.bx, b.bz) - rr >= 1.5) && len2(x - palm1.x, z - palm1.z) > palm1.r + rr + 0.5 && this.hAt(x, z) > 0.3) at = { x, z };   // islet sand: 0.42 m
        }
        const home = !!at && at.x === i1.x - 2.5 && at.z === i1.z + 2;
        if (!home) this.ghostSolid(i1.x - 2.5, i1.z + 2, rr);
        if (at) this.addProp('rock', at.x, at.z, { s: 0.9, extra: home ? undefined : WP9 });
        else this.rng.range(0, TAU);   // no clear spot: no rock, but the same main-stream draw (its rotation)
      }
      this.reserveCircle(i1.x, i1.z, i1.r);
      this.reserveCircle(i2.x, i2.z, i2.r);
      for (let k = 0; k < 6; k++) this.addDeco('shell', i2.x + r.range(-4, 4), i2.z + r.range(-4, 4));
      this.hcSpots.shores = { x: i2.x, z: i2.z };
    }
    // Peaks: nook behind boulders, off the peaks path
    {
      const pts = this.paths.peaks;
      let best = null;
      for (let tries = 0; tries < 60 && !best; tries++) {
        const p = pts[Math.round(lerp(0.55, 0.8, r.next()) * (pts.length - 1))];
        const side = r.chance(0.5) ? 1 : -1;
        const x = p.x + p.nx * side * 10, z = p.z + p.nz * side * 10;
        if (this.hAt(x, z) > 1 && !this.inArena(x, z, 6) && this.nookOk(p, side)) best = { x, z, p, side };
      }
      if (!best) { const p = pts[Math.round(pts.length * 0.7)]; best = { x: p.x + p.nx * 10, z: p.z + p.nz * 10, p, side: 1 }; }
      const { p, side } = best;
      const h = p.h + 0.3;
      // walkway from path to nook (curving round the boulders)
      const mx = p.x + p.nx * side * 5 + p.tx * 4, mz = p.z + p.nz * side * 5 + p.tz * 4;
      for (let t = 0; t <= 1; t += 0.08) this.flattenDisc(lerp(p.x, mx, t), lerp(p.z, mz, t), 1.8, 2.5, h);
      for (let t = 0; t <= 1; t += 0.08) this.flattenDisc(lerp(mx, best.x, t), lerp(mz, best.z, t), 1.8, 2.5, h);
      this.flattenDisc(best.x, best.z, 3.6, 3.5, h);
      this.reserveCircle(mx, mz, 2.2);
      this.reserveCircle(lerp(mx, best.x, 0.5), lerp(mz, best.z, 0.5), 2.2);
      this.addChest('hc_peaks', best.x, best.z, 'heart', 0);
      // boulder wall between path and nook
      for (let k = -1; k <= 1; k++) {
        const bx = p.x + p.nx * side * 6.2 - p.tx * (k * 2.4 + 1.5), bz = p.z + p.nz * side * 6.2 - p.tz * (k * 2.4 + 1.5);
        this.addProp('boulder', bx, bz, { s: 1.1 });
      }
      this.reserveCircle(best.x, best.z, 3.5);
      this.hcSpots.peaks = best;
    }
    // Woods: hidden glade surrounded by dense trees
    {
      const sp2 = this.findSpot(-36, -66, 0, 12, (x, z) => this.flatGood(x, z, 3) && this.pathDAt(x, z) > 18 && this.regionAt(x, z) === REGION.WOODS) || { x: -36, z: -66 };
      this.flattenDisc(sp2.x, sp2.z, 4.5, 4, this.hAt(sp2.x, sp2.z));
      this.addChest('hc_woods', sp2.x, sp2.z, 'heart', 0);
      this.glade = sp2;
      // ring of trees with a single gap pointing away from the path, plus glowing mushrooms
      const gapAng = Math.atan2(sp2.x - 6, sp2.z + 60);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU;
        if (Math.abs(angDiff(a, gapAng)) < 0.3) continue;
        this.addProp(r.chance(0.5) ? 'tree_pine' : 'tree_round', sp2.x + Math.sin(a) * 6.2, sp2.z + Math.cos(a) * 6.2, { s: r.range(1.0, 1.2) });
      }
      for (let k = 0; k < 10; k++) this.addDeco('glowshroom', sp2.x + r.range(-4, 4), sp2.z + r.range(-4, 4), { s: r.range(0.9, 1.4) });
      this.reserveCircle(sp2.x, sp2.z, 5.4);
      this.hcSpots.woods = sp2;
    }
    // shadow: the foundation's coin-chest loop (coin chests now come after scatter, placeCoins, own stream): the same draws,
    // and its chests as ghosts (reservation, collider, the 22 m spacing)
    {
      const V = REGION.VILLAGE, regionsFor = [REGION.WOODS, REGION.WOODS, REGION.PEAKS, REGION.PEAKS, REGION.SHORES, REGION.SHORES, REGION.MEADOW, REGION.MEADOW, REGION.MEADOW, V, REGION.SHORES];
      const chests = this.chests.map((c) => ({ x: c.x, z: c.z }));
      for (const reg of regionsFor) {
        for (let t = 0; t < 1500; t++) {
          const a = r.range(0, TAU), d = r.range(reg === V ? 22 : 36, reg === V ? 36 : 125);
          const x = Math.sin(a) * d, z = -Math.cos(a) * d;
          if (this.regionAt(x, z) !== reg) continue;
          const pd = this.pathDAt(x, z);
          if (pd < 5 || pd > 55 || !this.flatGood(x, z, 1.6) || this.fReserved(x, z, 1.5) || chests.some((c) => len2(c.x - x, c.z - z) < 22)) continue;
          r.int(0, 4); r.range(0, TAU);   // its amount, then addChest's rotation
          chests.push({ x, z }); this.fnd.cols.push({ x, z, r: 0.62 }); this.reserveCircle(x, z, 2.4, 2);
          break;
        }
      }
    }
    // extra pots around the meadow & shores (the foundation's spots and draws; a spot WP9 has since taken stays a ghost)
    for (let i = 0; i < 10; i++) {
      const sp3 = this.findSpot(0, 0, 40, 120, (x, z) => this.flatGood(x, z, 1.5) && !this.fReserved(x, z, 1) && [REGION.MEADOW, REGION.SHORES].includes(this.regionAt(x, z)));
      if (!sp3) continue;
      const ok = !this.isReserved(sp3.x, sp3.z, 1);
      for (let k = 0; k < 3; k++) {
        const x = sp3.x + r.range(-1.2, 1.2), z = sp3.z + r.range(-1.2, 1.2), s = r.range(0.8, 1.05), rot = r.range(0, TAU);
        if (ok) this.addProp('pot', x, z, { s, rot, extra: { breakable: true } }); else this.ghostSolid(x, z, SOLID.pot * s);
      }
      this.reserveCircle(sp3.x, sp3.z, 2.5, ok ? 0 : 2);
    }
  }

  // ------------------------------------------------------------------ WP9: landmarks, woods gaps, coins, path dressing
  /** one landmark per region, visible over the canopy (RULINGS, art §4.7); own RNG stream so the rest never reshuffles
   *  because of them. Each is a prop with a declared collider (rendered by world-mod.js) and a W.landmarks row */
  placeLandmarks() {
    const L = new RNG(this.seed * 13 + 5), H = TW.landmarkH;
    const T = this.greatTree;
    this.fnd.H = this.H.slice(); this.fnd.S = this.S.slice();   // the shadow's terrain: before WP9's summit cap
    this.landmarks = [{ id: 'great_tree', name: 'The Great Tree', region: 'village', x: T.x, z: T.z, y: T.y, height: T.scaleHeight }];
    const add = (id, type, name, region, x, z, rot, extra = {}) => this.addLandmark(id, type, name, region, x, z, rot, this.landmarkCol(id, extra));
    const free = (x, z, rad) => this.hAt(x, z) > 0.9 && !this.solidNear(x, z, rad) && !this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + rad);
    // woods: Grumble's Crown is placed after scatter (placeSkyline), where its path sees it best
    // peaks: the Summit Crystal Cairn on the highest ground of the peaks
    {
      let best = null;
      for (let j = 0; j < N; j += 2) for (let i = 0; i < N; i += 2) {
        const x = i - HALF, z = j - HALF;
        const h = this.H[j * N + i];
        if (x < 50 || (best && h <= best.h)) continue;
        if (this.inArena(x, z, 6) || this.pathFAt(x, z) < 12 || this.chests.some((c) => len2(c.x - x, c.z - z) < 22) || this.isReserved(x, z, 7)) continue;   // off the path, clear of the heart-chest nook and its walkway
        best = { x, z, h };
      }
      const x = best ? best.x : 100, z = best ? best.z : -48;
      // round the needle-sharp summit off into a small cap the stones can sit on (nothing overhangs thin air)
      if (best) this.flattenDisc(x, z, 2.4, 3.2, best.h - 0.5);
      add('peaks', 'lm_cairn', 'Summit Crystal Cairn', 'peaks', x, z, Math.atan2(-x, -z));
    }
    // shores: the lighthouse is placed after scatter (placeSkyline); its old islet spot (same draws, so the windmill
    // below keeps its place) is the fallback
    {
      const i2 = this.islets[1], c = this.chests.find((q) => q.id === 'hc_shores');
      let x = i2.x - 1.8, z = i2.z + 3.4;
      for (let t = 0; t < 24; t++) {
        const ang = L.range(0, TAU), d = L.range(2.6, 4.2);
        const xx = i2.x + Math.sin(ang) * d, zz = i2.z + Math.cos(ang) * d;
        if (this.hAt(xx, zz) < 0.35 || (c && len2(c.x - xx, c.z - zz) < 3.4) || this.solidNear(xx, zz, 2.2) || this.bridges.some((b) => distToSeg(xx, zz, b.ax, b.az, b.bx, b.bz) < 4.0)) continue;
        x = xx; z = zz; break;
      }
      this.lhFallback = { x, z, rot: Math.atan2(this.islets[0].x - x, this.islets[0].z - z) };
    }
    // meadow: a windmill behind Digby at the meadow's end, its sails toward the village path
    {
      const m = this.meadowCenter;
      let spot = null;
      for (let t = 0; t < 60 && !spot; t++) {
        const ang = -Math.PI / 2 + L.range(-1.0, 1.0), d = L.range(8, 15);
        const x = m.x + Math.sin(ang) * d, z = m.z + Math.cos(ang) * d;
        if (this.flatGood(x, z, 2.6) && free(x, z, 3) && !this.isReserved(x, z, 1) && this.regionAt(x, z) === REGION.MEADOW) spot = { x, z };
      }
      spot = spot || { x: m.x - 8, z: m.z - 8 };
      add('meadow', 'lm_windmill', 'Meadow Windmill', 'meadow', spot.x, spot.z, Math.atan2(m.x + 20 - spot.x, m.z - spot.z));
    }
  }
  /** declared landmark collider: radius from the model (props.js LANDMARK_R), eye keep-out 0.2 m beyond it */
  landmarkCol(id, extra = {}) {
    const H = TW.landmarkH[id], r = +LANDMARK_R[id](H).toFixed(3);
    return { r, h: H, eye: +(r + 0.2).toFixed(3), ...extra };
  }
  addLandmark(id, type, name, region, x, z, rot, col) {
    const p = this.addProp(type, x, z, { rot, collider: col, extra: { landmark: id, wp9: true } });
    this.reserveCircle(x, z, col.r + 2.5, 1);
    this.landmarks.push({ id, name, region, x, z, y: p.y, height: col.h, rot, prop: p });
    return p;
  }
  /** how well a landmark at (x, z) reads from its path: per path sample 20–150 m away (eye 0.9 m), 1 when the rays to
   *  0.95 H and 0.6 H both clear the terrain and the trees (a tree as a 1.3 m column up to its canopy top), scaled down
   *  when that span is under 40 px tall at 1080p (the same rule as G.debug.wp9.losLandmarks `reads`) */
  skyScore(x, z, y0, H, pts) {
    const tall = (p) => (p.type.startsWith('tree') ? 5.6 * p.s : p.type === 'boulder' ? 1.6 * p.s : p.type.startsWith('lm_') ? 12 : 0);
    const clear = (q, d, ty) => {
      const qy = q.h + 0.9, n = Math.ceil(d / 1.5);
      for (let k = 1; k < n - 1; k++) {
        const u = k / n, px = q.x + (x - q.x) * u, pz = q.z + (z - q.z) * u, py = qy + (ty - qy) * u;
        if (this.hAt(px, pz) > py) return false;
        const p = this.solidNear(px, pz, 1.3);
        if (p && !p.doomed && py < p.y + tall(p)) return false;
      }
      return true;
    };
    let v = 0;
    for (let i = 0; i < pts.length; i += 4) {
      const q = pts[i], d = len2(q.x - x, q.z - z);
      if (d < 20 || d > 150) continue;
      if (clear(q, d, y0 + H * 0.95) && clear(q, d, y0 + H * 0.6)) v += Math.min(1, (0.35 * H * 810) / d / 40);
    }
    return v;
  }
  /** the boss-intro views of an arena (the W.shots camera and the player's own at the entrance), so a landmark can keep
   *  out of the boss's silhouette: fn(x, z) → the smallest angle (rad) between the landmark and the arena centre */
  introOff(a) {
    const ex = a.x + Math.sin(a.entAng) * (a.r - 3), ez = a.z + Math.cos(a.entAng) * (a.r - 3);
    const cams = [[ex + Math.cos(a.entAng) * 2.5, ez - Math.sin(a.entAng) * 2.5], [a.entrance.x, a.entrance.z]];
    return (x, z) => Math.min(...cams.map(([cx, cz]) => Math.abs(angDiff(Math.atan2(x - cx, z - cz), Math.atan2(a.x - cx, a.z - cz)))));
  }
  /** two landmarks are placed after scatter, where their own path sees them best (skyScore with the real trees):
   *  - woods, Grumble's Crown: behind the Hollow, ≥ 0.42 rad off the boss in both intro views (it is the boss's purple
   *    and gold); trees inside its stem ring are taken out;
   *  - shores, Pinch's Lighthouse: on the coast by the cove (the path's goal), ≥ 0.6 rad off Pinch in the intro, clear of
   *    everything solid (fallback: islet 2). */
  placeSkyline() {
    {
      const a = this.arenas.woods, col = this.landmarkCol('woods', { cam: TW.landmarkH.woods * 0.55 }), R = col.r, off = this.introOff(a);
      let best = null;
      for (const d of [a.r + 7.5, a.r + 9, a.r + 10.5, a.r + 12]) for (let k = 0; k < 10; k++) {
        const da = (k % 2 ? -1 : 1) * [0.42, 0.52, 0.62, 0.72, 0.82][k >> 1], ang = a.entAng + Math.PI + da;
        const x = a.x + Math.sin(ang) * d, z = a.z + Math.cos(ang) * d, h = this.hAt(x, z);
        if (h < 1.2 || this.slopeAt(x, z) > 0.7 || this.inWoodsGap(x, z, R + 1) || off(x, z) < 0.42) continue;
        if (this.colliders.some((c) => !c.prop && len2(c.x - x, c.z - z) < c.r + R + 0.3)) continue;
        const near = [];
        for (const p of this.props) if (p.solid && !p.removed && len2(p.x - x, p.z - z) < p.r + R + 1) near.push(p);
        if (near.some((p) => !p.type.startsWith('tree') && p.type !== 'bush' && p.type !== 'stump' && p.type !== 'rock')) continue;
        near.forEach((p) => { p.doomed = true; });
        const v = this.skyScore(x, z, h, col.h, this.paths.woods);
        near.forEach((p) => { delete p.doomed; });
        if (!best || v > best.v) best = { x, z, v, near };
      }
      if (!best) {   // nothing passed (never seen on the test seeds): 0.6 rad off the axis, a.r + 9 behind the Hollow
        const ang = a.entAng + Math.PI + 0.6, x = a.x + Math.sin(ang) * (a.r + 9), z = a.z + Math.cos(ang) * (a.r + 9);
        best = { x, z, v: 0, near: this.props.filter((p) => p.solid && !p.removed && !p.landmark && len2(p.x - x, p.z - z) < p.r + R + 1) };
      }
      for (const p of best.near) p.removed = true;   // inside the stem ring: the mushroom stands where they stood
      this.addLandmark('woods', 'lm_mushroom', 'Grumble\'s Crown', 'woods', best.x, best.z, Math.atan2(a.x - best.x, a.z - best.z), col);
      this.skyPick = { woods: { v: +best.v.toFixed(2), removed: best.near.length } };
    }
    {
      const a = this.arenas.shores, col = this.landmarkCol('shores'), H = col.h, R = col.r, off = this.introOff(a);
      let best = null;
      for (let x = a.x - 60; x <= a.x + 45; x += 2.5) for (let z = a.z - 45; z <= a.z + 30; z += 2.5) {
        const h = this.hAt(x, z), dA = len2(x - a.x, z - a.z), coast = this.D[Math.round(z + HALF) * N + Math.round(x + HALF)];
        if (h < 0.6 || coast > 14 || dA < a.r + 7 || dA > 60 || this.regionAt(x, z) !== REGION.SHORES || this.slopeAt(x, z) > 0.45) continue;   // on the coast
        const pf = this.pathFAt(x, z);
        if (pf < 8 || pf > 40 || off(x, z) < 0.6 || this.isReserved(x, z, R + 1) || this.solidNear(x, z, R + 0.8) || this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + R + 0.8)) continue;
        const v = this.skyScore(x, z, h, H, this.paths.shores) - 0.06 * Math.max(0, dA - 22);   // and near the cove
        if (!best || v > best.v) best = { x, z, v };
      }
      const sp = best || this.lhFallback;
      this.addLandmark('shores', 'lm_lighthouse', 'Pinch\'s Lighthouse', 'shores', sp.x, sp.z, best ? Math.atan2(a.x - sp.x, a.z - sp.z) : sp.rot, col);
      (this.skyPick = this.skyPick || {}).shores = best ? { v: +best.v.toFixed(2) } : null;
    }
  }
  /** the arena edge rings (drawn by world-mod.js): a knee-high stone every `step` m at radius R (where the fight clamp
   *  stops Pip's body), open over the entrance gap. Each stone is a low collider, so outside a fight Pip enters only
   *  through the entrance (where the gate segment rises during the fight) and never walks through a stone */
  placeArenaRings() {
    const RING = { h: 0.45, cam: 0.45, eye: 0.3 };
    for (const id in this.arenas) {
      const a = this.arenas[id], R = a.r + 0.02, step = 0.62, n = Math.round((TAU * R) / step), gap = 0.36;
      a.ring = { R, n, gap, open: [] };
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * TAU;
        if (Math.abs(angDiff(ang, a.entAng)) < gap) continue;
        this.colliders.push({ x: a.x + Math.sin(ang) * R, z: a.z + Math.cos(ang) * R, r: 0.27, kind: 'arenaring', decl: RING, arena: id, wp9: true });
      }
    }
  }
  /** woods game trails and clearings (art §4.5 / world map): scatter keeps solid props out of them */
  placeWoodsGaps() {
    const R = new RNG(this.seed * 17 + 3), clear = [], trails = [];
    const glade = this.glade;
    for (let t = 0; t < 240 && clear.length < 3; t++) {
      const x = R.range(-90, 40), z = R.range(-112, -36);
      if (this.regionAt(x, z) !== REGION.WOODS) continue;
      const pf = this.pathFAt(x, z);
      if (pf < 13 || pf > 40 || this.inArena(x, z, 12) || (glade && len2(glade.x - x, glade.z - z) < 18)) continue;
      if (clear.some((c) => len2(c.x - x, c.z - z) < 26) || !this.flatGood(x, z, 3)) continue;
      clear.push({ x, z, r: R.range(6.5, 9) });
    }
    // a winding game trail from each clearing to the nearest woods-path point: two bends to alternate sides, spline-sampled
    // every 0.6 m and rasterised into trailD (m to the nearest trail sample within 4 cells, 99 elsewhere), which scatter
    // (inWoodsGap) and the dirt splat read. Each clearing gets a stump ringed by glowing mushrooms (a fairy ring)
    const pts = this.paths.woods, trailD = (this.trailD = new Float32Array(N * N).fill(99));
    for (const c of clear) {
      let best = pts[0], bd = 1e9;
      for (const q of pts) { const d = len2(q.x - c.x, q.z - c.z); if (d < bd && !this.inArena(q.x, q.z, 16)) { bd = d; best = q; } }   // well clear of a boss ring
      const dx = best.x - c.x, dz = best.z - c.z, L = Math.max(1, Math.hypot(dx, dz)), nx = -dz / L, nz = dx / L;
      // a few bends to choose from: the one that meets the fewest props placed so far (arena rings, landmarks) wins
      let t = null, tBad = 1e9;
      for (let k = 0; k < 6 && tBad > 0; k++) {
        const w1 = R.range(-1, 1) * Math.min(5, L * 0.18), w2 = -Math.sign(w1 || 1) * R.range(0.4, 1) * Math.min(4, L * 0.14);
        const tk = sampleSpline([{ x: c.x, z: c.z }, { x: c.x + dx * 0.36 + nx * w1, z: c.z + dz * 0.36 + nz * w1 }, { x: c.x + dx * 0.7 + nx * w2, z: c.z + dz * 0.7 + nz * w2 }, { x: best.x, z: best.z }], 0.6);
        const bad = tk.filter((p) => this.solidNear(p.x, p.z, 1.0) || this.isReserved(p.x, p.z, -0.5) && this.inArena(p.x, p.z, 4)).length;
        if (bad < tBad) { t = tk; tBad = bad; }
      }
      trails.push(t);
      for (const p of t) {
        const ci = Math.round(p.x + HALF), cj = Math.round(p.z + HALF);
        for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          const d = len2(i - HALF - p.x, j - HALF - p.z);
          if (d < trailD[j * N + i]) trailD[j * N + i] = d;
        }
      }
      const fx = c.x + R.range(-1.2, 1.2), fz = c.z + R.range(-1.2, 1.2);
      this.addProp('stump', fx, fz, { rot: R.range(0, TAU), s: 1.15, extra: WP9 });
      for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU + R.range(-0.15, 0.15), rr = 1.55 + R.range(-0.15, 0.2); this.addDeco('glowshroom', fx + Math.sin(a) * rr, fz + Math.cos(a) * rr, { rot: R.range(0, TAU), s: R.range(0.9, 1.3) }); }
      c.ring = { x: fx, z: fz };
    }
    this.woodsGaps = { clearings: clear, trails };
  }
  /** inside a woods clearing or within w of a trail (trailD rejects almost every cell; the exact test runs near trails) */
  inWoodsGap(x, z, w = 1.1) {
    const G2 = this.woodsGaps;
    if (!G2) return false;
    for (const c of G2.clearings) if (len2(c.x - x, c.z - z) < c.r) return true;
    if (!this.trailD) return false;
    const i = clamp(Math.round(x + HALF), 0, N - 1), j = clamp(Math.round(z + HALF), 0, N - 1);
    if (this.trailD[j * N + i] > w + 0.75) return false;     // a point is ≤ 0.71 m from the centre of its cell
    for (const t of G2.trails) for (const p of t) if (len2(p.x - x, p.z - z) < w) return true;
    return false;
  }
  /** coin chests coin_0…coin_9 (ids stable for saves), placed after scatter so trees and houses can hide them: true
   *  path distance in TW.coinPathD, a clear flat pocket, and the spot least visible from the paths within 30 m wins
   *  (own RNG stream) */
  placeCoins() {
    const R = new RNG(this.seed * 31 + 17), [dMin, dMax] = TW.coinPathD;
    const regionsFor = [REGION.WOODS, REGION.WOODS, REGION.PEAKS, REGION.PEAKS, REGION.SHORES, REGION.SHORES, REGION.MEADOW, REGION.MEADOW, REGION.MEADOW, REGION.VILLAGE];
    const samples = [];
    for (const id in this.paths) { const pts = this.paths[id]; for (let i = 0; i < pts.length; i += 3) samples.push(pts[i]); }
    const blockers = (x, z, y) => {
      const p = this.solidNear(x, z, 0);
      if (p && !p.removed) {
        const ht = p.type.startsWith('tree') || p.type === 'boulder' || p.type === 'bush' || p.type === 'house' || p.type.startsWith('lm_') ? 9 : p.type === 'rock' || p.type === 'stump' ? 0.6 * (p.s || 1) : 0;
        if (y < p.y + ht) return true;
      }
      for (const h of this.houses) if (len2(h.x - x, h.z - z) < 2.4) return true;
      return false;
    };
    const vis = (x, z) => {
      const cy = this.hAt(x, z) + 0.55;
      let seen = 0, n = 0;
      for (const q of samples) {
        const d = len2(q.x - x, q.z - z);
        if (d > 30) continue;
        n++;
        const qy = q.h + 0.9, steps = Math.ceil(d);
        let blocked = false;
        for (let s2 = 1; s2 < steps - 1 && !blocked; s2++) {
          const u = s2 / steps, px = q.x + (x - q.x) * u, pz = q.z + (z - q.z) * u, py = qy + (cy - qy) * u;
          if (this.hAt(px, pz) > py || blockers(px, pz, py)) blocked = true;
        }
        if (!blocked) seen++;
      }
      return n ? seen / n : 0;
    };
    this.coinPicks = [];
    const reach = this.bfs(this.buildWalk());   // only pockets Pip can already walk to (never a carved corridor)
    regionsFor.forEach((reg, n) => {
      let best = null;
      for (const relax of [0, 1, 2]) {
        const lo = relax === 2 ? 5 : dMin, hi = relax === 2 ? 60 : dMax;
        let found = 0;
        for (let t = 0; t < 900 && found < 10; t++) {
          const a = R.range(0, TAU), d = R.range(reg === REGION.VILLAGE ? 22 : 36, reg === REGION.VILLAGE ? 38 : 125);
          const x = Math.sin(a) * d, z = -Math.cos(a) * d;
          if (this.regionAt(x, z) !== reg) continue;
          const pf = this.pathFAt(x, z);
          if (pf < lo || pf > hi) continue;
          if (!this.flatGood(x, z, 1.6) || this.isReserved(x, z, 1.5) || this.inArena(x, z, 6)) continue;
          if (this.chests.some((c) => len2(c.x - x, c.z - z) < 22)) continue;
          if (this.solidNear(x, z, 1.5) || this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + 1.5) || !this.isReached(reach, x, z, true)) continue;
          found++;
          const v = relax ? 0.5 : vis(x, z);
          if (!best || v < best.v) best = { x, z, v, pf };
        }
        if (best) break;
      }
      if (!best) return;
      this.addChest('coin_' + n, best.x, best.z, 'coins', 10 + R.int(0, 4) * 5);
      this.coinPicks.push({ id: 'coin_' + n, pathD: +best.pf.toFixed(2), visible: +best.v.toFixed(2) });
    });
  }
  /** waymarker posts every TW.waymarkEvery m on the four paths (an arrow toward the path's end) and the path-edge
   *  stone rows near the plaza and at bridge approaches (this.edgeStones, drawn instanced by world-mod.js) */
  placePathDressing() {
    const R = new RNG(this.seed * 7 + 11);
    this.waymarkers = [];
    for (const id in this.paths) {
      const pts = this.paths[id], end = pts.length - (this.arenas[id] ? this.arenas[id].r + 12 : 10);
      let side = -1;
      for (let d = TW.waymarkEvery; d < end; d += TW.waymarkEvery) {
        // a rejected slot (bridge, slope, a tree or rock) slides up to 8 m along the path, then tries the other side
        let done = false;
        for (const sd of [side, -side]) for (const dd of [0, 2, -2, 4, -4, 6, -6, 8, -8]) {
          if (done) break;
          const p = this.pathAtDist(id, d + dd), x = p.x + p.nx * sd * 2.3, z = p.z + p.nz * sd * 2.3;
          if (this.bridgeAt(x, z) !== null || this.bridges.some((b) => distToSeg(x, z, b.ax, b.az, b.bx, b.bz) < b.w / 2 + 1.5)) continue;
          if (this.hAt(x, z) < 0.6 || this.slopeAt(x, z) > 0.75 || this.solidNear(x, z, 0.6) || this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + 0.6)) continue;
          const pr = this.addProp('waymarker', x, z, { rot: Math.atan2(p.tx, p.tz), extra: { path: id } });
          this.waymarkers.push({ x, z, y: pr.y, rot: pr.rot, region: id, prop: pr, d: d + dd });
          done = true;
        }
        side = -side;
      }
    }
    // path-edge stones: both edges every 0.9–1.3 m within TW.edgeStoneR of the plaza, and 14 m either side of bridges
    const st = (this.edgeStones = []);
    const nearBridgeEnd = (x, z) => this.bridges.some((b) => len2(b.ax - x, b.az - z) < 14 || len2(b.bx - x, b.bz - z) < 14);
    const [g0, g1] = TW.edgeStoneGap;
    for (const id in this.paths) {
      const pts = this.paths[id];
      for (const side of [-1, 1]) {
        let d = R.range(0, g1);
        while (d < pts.length - 1) {
          const p = this.pathAtDist(id, d), rr = len2(p.x, p.z);
          if ((rr > this.plaza.r + 0.5 && rr < TW.edgeStoneR) || nearBridgeEnd(p.x, p.z)) {
            const o = TW.edgeStoneOff + R.range(-0.15, 0.2), x = p.x + p.nx * side * o, z = p.z + p.nz * side * o;
            if (this.bridgeAt(x, z) === null && this.hAt(x, z) > 0.2 && this.pathDAt(x, z) > 1.6 && !this.solidNear(x, z, 0.3)) {
              st.push({ x, z, y: this.hAt(x, z), s: R.range(0.75, 1.3), rot: R.range(0, TAU), k: R.next() });
            }
          }
          d += R.range(g0, g1);
        }
      }
    }
    // a pair of stones marks the mouth of every woods game trail where it leaves the path
    for (const t of (this.woodsGaps ? this.woodsGaps.trails : [])) {
      for (let q = t.length - 1; q > 0; q--) {
        if (this.pathDAt(t[q].x, t[q].z) < 2.5) continue;
        const a = t[q], b = t[q - 1], L = Math.max(0.01, len2(b.x - a.x, b.z - a.z)), nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
        for (const sd of [-1, 1]) { const x = a.x + nx * sd * 1.05, z = a.z + nz * sd * 1.05; if (!this.solidNear(x, z, 0.3)) st.push({ x, z, y: this.hAt(x, z), s: R.range(1.05, 1.35), rot: R.range(0, TAU), k: R.next() }); }
        break;
      }
    }
  }
  /** WP9 → C6: anchors other packages read (cutscenes, compass / map, collisions) */
  publishAnchors() {
    const P = this.pedestal, T = this.greatTree, top = TW.pedestalTop, tilt = TW.pedestalTilt;
    P.y = this.ground(P.x, P.z); P.top = top; P.tilt = tilt; P.r = 1.06;
    // socket centres on the tilted slab (the slab faces +Z, tilted `tilt` rad back from horizontal)
    P.sockets = [-1, 0, 1].map((i) => ({ x: P.x + i * TW.socketDX, y: P.y + top, z: P.z + 0.05 }));
    T.y = this.plaza.h;
    const H = T.scaleHeight, sp = this.spawn, A = this.arenas;
    const v3 = (x, y, z) => [+x.toFixed(3), +y.toFixed(3), +z.toFixed(3)];
    this.shots = {
      // seed placement: a low 3/4 from the south-east, the altar in front of the roots, the trunk filling the back
      place: { pos: v3(P.x + 2.4, P.y + 1.55, P.z + 3.6), look: v3(P.x - 0.2, P.y + 1.05, P.z - 0.6) },
      // ending: look up the trunk from the spawn side, then crane up and back to frame the whole crown
      ending: { pos: v3(T.x + 1.5, T.y + 1.0, sp.z + 1.5), look: v3(T.x, T.y + H * 0.62, T.z) },
      endingCrane: { pos: v3(T.x + 6, T.y + H * 0.55, T.z + H * 1.75), look: v3(T.x, T.y + H * 0.6, T.z) },
      // first look at the plaza (session intro / respawn): from the spawn, up at the crown over the altar
      spawn: { pos: v3(sp.x, this.ground(sp.x, sp.z) + 0.88, sp.z), look: v3(T.x, T.y + H * 0.45, T.z) },
      bossIntro: {},
    };
    for (const id in A) {
      const a = A[id], ex = a.x + Math.sin(a.entAng) * (a.r - 3), ez = a.z + Math.cos(a.entAng) * (a.r - 3);
      this.shots.bossIntro[id] = { pos: v3(ex + Math.cos(a.entAng) * 2.5, a.h + 1.5, ez - Math.sin(a.entAng) * 2.5), look: v3(a.x, a.h + 1.6, a.z) };
    }
  }

  /** props and decoration. WP9: a shadow of the foundation's scatter. Every main-stream draw and every decision that
   *  decides what is drawn uses the foundation's state (its terrain before WP9's edits, its reservations, solids and
   *  colliders: ghosts of what WP9 moved or removed, nothing WP9 added), so each prop the foundation placed is drawn
   *  with the same numbers and the stream never drifts. WP9 then gives its own verdict on that prop (its reservations,
   *  props and colliders, the woods trails and clearings, the paved plaza): a rejected one becomes a ghost. WP9 never
   *  adds a prop where the foundation had none; decoration it adds gets its scale / rotation from a position hash */
  scatter() {
    const r = this.rng, noise = this.noise, F = this.fnd, fH = F.H || this.H, fS = F.S || this.S;
    const step = 2.1;
    // 8 m grids for collBits (each collider in every cell within r + 3 m: rad ≤ 3 m here) and isReserved with pad ≤ 0
    // (each reservation in every cell within r); neither list changes while scatter runs
    const grid = (list, e0) => {
      const M = new Map();
      for (const c of list) {
        const e = c.r + e0;
        for (let ci = Math.floor((c.x - e) / 8); ci <= Math.floor((c.x + e) / 8); ci++) for (let cj = Math.floor((c.z - e) / 8); cj <= Math.floor((c.z + e) / 8); cj++) {
          const key = ((ci + 100) * 1000) + (cj + 100);
          let a = M.get(key);
          if (!a) M.set(key, (a = []));
          a.push(c);
        }
      }
      return M;
    };
    this._cg = grid(this.colliders, 3); this._rg = grid(this.reserved || [], 0);
    for (let gz = -HALF + 2; gz < HALF - 2; gz += step) {
      for (let gx = -HALF + 2; gx < HALF - 2; gx += step) {
        const x = gx + r.range(-0.9, 0.9), z = gz + r.range(-0.9, 0.9);
        const h = this.sampleA(fH, x, z);
        if (h < 0.55) continue;
        const reg = this.regionAt(x, z);
        const sl = this.sampleA(fS, x, z);
        if (this.inArena(x, z, 3)) continue;
        if (this.fReserved(x, z)) continue;
        const rr = len2(x, z);
        const roll = r.next();
        let type = null, s = r.range(0.85, 1.2);
        if (sl > 0.9) { if (roll < 0.05) type = 'rock'; }
        else if (reg === REGION.WOODS) {
          const n = noise.noise2(x * 0.05, z * 0.05) + 0.45 * noise.noise2(x * 0.13 + 4, z * 0.13);
          const dense = n > 0.0;
          if (roll < (dense ? 0.5 : 0.05)) type = r.chance(0.55) ? 'tree_pine' : 'tree_round';
          else if (roll < (dense ? 0.53 : 0.085)) type = 'bush';
          else if (roll < (dense ? 0.55 : 0.1)) type = 'stump';
          else if (roll < (dense ? 0.57 : 0.115)) type = 'rock';
        } else if (reg === REGION.MEADOW) {
          const n = noise.noise2(x * 0.04 - 9, z * 0.04 + 2);
          if (roll < (n > 0.35 ? 0.16 : 0.025)) type = 'tree_round';
          else if (roll < 0.075) type = 'bush';
          else if (roll < 0.09) type = 'rock';
          else if (roll < 0.095) type = 'boulder';
          else if (roll < 0.1) type = 'stump';
        } else if (reg === REGION.SHORES) {
          if (h < 2.2 && roll < 0.05) type = 'tree_palm';
          else if (h >= 2.2 && roll < 0.03) type = 'tree_round';
          else if (roll < 0.075) type = 'rock';
          else if (roll < 0.085) type = 'bush';
          else if (roll < 0.09) type = 'boulder';
        } else if (reg === REGION.PEAKS) {
          if (roll < 0.075) type = h > 6.5 ? 'tree_snow' : 'tree_pine';
          else if (roll < 0.1) type = 'boulder';
          else if (roll < 0.15) type = 'rock';
        } else if (reg === REGION.VILLAGE) {
          if (rr < 20) continue;
          if (roll < 0.04) type = 'tree_round';
          else if (roll < 0.07) type = 'bush';
          else if (roll < 0.075) type = 'rock';
        }
        if (!type) continue;
        if (type === 'boulder') s = r.range(0.9, 1.3);
        if (type === 'tree_palm' && h < 0.9) continue;
        const rad = (SOLID[type] || 0.5) * s, bits = this.solidBits(x, z, rad + 0.35) | this.collBits(x, z, rad + 0.6);
        if (bits & 1) continue;                    // the foundation placed nothing here
        const rot = r.range(0, TAU);               // it placed this prop (its rotation draw)
        if ((bits & 2) || this.isReserved(x, z) || (reg === REGION.WOODS && this.inWoodsGap(x, z, 1.6))) { this.ghostSolid(x, z, rad); continue; }
        this.addProp(type, x, z, { s, rot, extra: type === 'bush' ? { cuttable: true } : undefined });
      }
    }
    // dense non-colliding decoration (the same rule; WP9 keeps the paved plaza bare and floors the woods clearings
    // with grass and flowers)
    // the paved plaza: its W.plazaMask cell (computeSplat's formula, same rounding as splatK) above 0.3
    const PR = this.plaza.r - 2.5, paved = (x, z, rr) => {
      if (rr > PR + 3) return false;
      const cx = clamp(Math.round(x + HALF), 0, N - 1) - HALF, cz = clamp(Math.round(z + HALF), 0, N - 1) - HALF, n1 = noise.noise2(cx * 0.09 + 3, cz * 0.09 - 8);
      return 1 - smoothstep(PR - 1.2 + n1 * 1.2, PR + 0.4 + n1 * 1.2, len2(cx, cz)) > 0.3;
    };
    const hs = (x, z, k) => hash2(Math.round(x * 64), Math.round(z * 64), this.seed * 7 + k);
    for (let gz = -HALF + 1; gz < HALF - 1; gz += 1.15) {
      for (let gx = -HALF + 1; gx < HALF - 1; gx += 1.15) {
        const x = gx + r.range(-0.5, 0.5), z = gz + r.range(-0.5, 0.5);
        const h = this.sampleA(fH, x, z);
        if (h < 0.15) continue;
        const pd = this.pathDAt(x, z);
        const rr = len2(x, z);
        if (rr < 8.5) continue;
        if (this.inArena(x, z, -1) && r.next() < 0.85) continue;
        const reg = this.regionAt(x, z);
        const roll = r.next();
        const sl = this.sampleA(fS, x, z);
        if (sl > 0.8) continue;
        const onPath = pd < 1.6;
        if (onPath && roll > 0.03) continue;
        const sandy = h < (reg === REGION.SHORES ? 1.6 : 1.0);
        const n = noise.noise2(x * 0.08 + 11, z * 0.08 - 3);
        // the foundation's pick: type and scale range (null: rotation only)
        let type = null, sr = null;
        if (sandy) { if (roll < 0.025) type = 'shell'; else if (roll < 0.04) type = 'pebble'; }
        else if (reg === REGION.PEAKS && h > 6.5) { if (roll < 0.05) { type = 'pebble'; sr = [0.8, 1.5]; } else if (roll < 0.075) { type = 'crystal'; sr = [0.7, 1.2]; } }
        else if (reg === REGION.WOODS) {
          if (roll < 0.26) { type = 'fern'; sr = [0.8, 1.3]; } else if (roll < 0.3) { type = 'glowshroom'; sr = [0.7, 1.2]; } else if (roll < 0.34 && !this.fReserved(x, z, -1.5)) { type = 'tallgrass'; sr = [0.9, 1.2]; }
        } else {
          const fl = reg === REGION.MEADOW ? 0.2 + 0.2 * smoothstep(0, 0.5, n) : 0.06;
          if (roll < 0.5) { type = 'grass'; sr = [0.8, 1.5]; } else if (roll < 0.5 + fl) { type = 'flowers'; sr = [0.7, 1.15]; }
          else if (roll < 0.52 + fl + (reg === REGION.MEADOW ? 0.06 : 0.035) && pd > 3.2 && !this.fReserved(x, z, -1.5)) { type = 'tallgrass'; sr = [0.9, 1.25]; }
          else if (roll < 0.535 + fl + 0.03) type = 'pebble';
        }
        let s = type && sr ? r.range(sr[0], sr[1]) : 1, rot = type ? r.range(0, TAU) : null;
        // WP9's verdict
        if (paved(x, z, rr)) continue;                                // the paved plaza stays bare
        if (!sandy && reg === REGION.WOODS && this.inWoodsGap(x, z, 0)) {   // clearings: grassy and flowery
          const w = roll < 0.4 ? ['grass', 0.8, 1.3] : roll < 0.52 ? ['flowers', 0.8, 1.1] : roll < 0.56 ? ['glowshroom', 0.7, 1.2] : null;
          if (!w) continue;
          type = w[0]; s = w[1] + (w[2] - w[1]) * hs(x, z, 1);
          if (rot === null) rot = hs(x, z, 2) * TAU;
        }
        if (!type || (type === 'tallgrass' && this.isReserved(x, z, -1.5))) continue;
        this.addDeco(type, x, z, { s, rot });
      }
    }
    this.fnd = null; this._gh = null; this._cg = null; this._rg = null;   // the shadow is done
  }

  // ------------------------------------------------------------------ errands
  /** Clover's errand (data.js ERRANDS): W.shells = five rainbow shells [{ id: 'shell1'…'shell5', kind: 'shell', x, y, z, at }], one
   *  per Shores spot Clover names: by the lighthouse, on each islet, outside Captain Pinch's cove and beside the beach
   *  path. A post-pass after everything else: it draws only from its own RNG stream, adds nothing to the world's lists
   *  (props, deco, colliders, reservations, interactables) and puts W.walk / W.reach back, so every existing placement
   *  is the same as without it for every seed. A spot is dry Shores sand (not a bridge), flat, clear of solids,
   *  colliders, reservations, chests and NPC spots, outside the arena and its ring, and reachable from the spawn. */
  placeShells() {
    const R = new RNG(this.seed * 41 + 29), keep = [this.walk, this.reach];
    const reach = this.bfs(this.buildWalk());
    this.walk = keep[0]; this.reach = keep[1];
    const shells = [], a = this.arenas.shores, lm = this.landmarks.find((l) => l.id === 'shores');
    // reservations: the path band, every reserved circle except the islets' own blankets (they keep scatter off the
    // islets; the islets are where Clover sends Pip) and a margin round every bridge deck
    const blanket = (c) => this.islets.some((i) => c.x === i.x && c.z === i.z && c.r === i.r);
    const reserved = (x, z) => this.pathDAt(x, z) < 3.0 || (this.reserved || []).some((c) => !blanket(c) && len2(x - c.x, z - c.z) < c.r + 0.5)
      || this.bridges.some((b) => distToSeg(x, z, b.ax, b.az, b.bx, b.bz) < b.w / 2 + 1.5);
    // the Shores: its region, or an islet (islet 2, off the western beach, reads as Meadow on the region map)
    const shores = (x, z) => this.regionAt(x, z) === REGION.SHORES || this.islets.some((i) => len2(x - i.x, z - i.z) < i.r - 1);
    const ok = (x, z) => shores(x, z) && this.surfaceAt(x, z) === 'sand' && this.hAt(x, z) > 0.3 && this.slopeAt(x, z) < 0.5
      && !this.inArena(x, z, 5) && !reserved(x, z) && !this.solidNear(x, z, 1.0) && !this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + 1.0)
      && !this.chests.some((c) => len2(c.x - x, c.z - z) < 2.5) && !this.interact.some((it) => len2(it.x - x, it.z - z) < 2.5)
      && !Object.values(this.npcSpots).some((q) => len2(q.x - x, q.z - z) < 3)
      && !shells.some((q) => len2(q.x - x, q.z - z) < 8) && this.isReached(reach, x, z, false);
    // the beach path: the middle of its stretch over Shores sand
    const sandy = (this.paths.shores || []).filter((p) => this.regionAt(p.x, p.z) === REGION.SHORES && this.hAt(p.x, p.z) < 1.6);
    const mid = sandy[Math.floor(sandy.length / 2)] || { x: a.x, z: a.z - a.r - 20 };
    const spots = [
      ['lighthouse', lm ? lm.x : a.x - 24, lm ? lm.z : a.z, 4, 12],
      ['islet1', this.islets[0].x, this.islets[0].z, 0, this.islets[0].r - 1.5],
      ['islet2', this.islets[1].x, this.islets[1].z, 0, this.islets[1].r - 1.5],
      ['cove', a.x, a.z, a.r + 6, a.r + 16],
      ['path', mid.x, mid.z, 3.5, 6.5],
    ];
    // every 0.5 m of the ring, nearest the spot's centre first (a small islet can have only a sliver of dry sand clear
    // of its palm, chest and bridge: seed 23's second islet, which random tries missed). Draws nothing
    const scan = (cx, cz, r0, r1) => {
      let best = null, bd = Infinity;
      for (let dz = -r1; dz <= r1; dz += 0.5) for (let dx = -r1; dx <= r1; dx += 0.5) {
        const d = Math.hypot(dx, dz);
        if (d < r0 || d > r1 || d >= bd || !ok(cx + dx, cz + dz)) continue;
        best = { x: cx + dx, z: cz + dz }; bd = d;
      }
      return best;
    };
    for (const [at, cx, cz, r0, r1] of spots) {
      let got = null;
      // 160 tries in the spot's ring, then a scan of the whole ring, so the shell is where Clover says; only then twice as
      // far out, then anywhere on the Shores (neither seen on seeds 1–150)
      for (const tier of [{ lo: r0, hi: r1 }, { scan: true }, { lo: r0, hi: r1 * 2 + 6 }, { lo: 0, hi: 150, x: a.x, z: a.z }]) {
        if (tier.scan) { const q = scan(cx, cz, r0, r1); if (q) got = { x: +q.x.toFixed(3), z: +q.z.toFixed(3) }; }
        else for (let t = 0; t < 160 && !got; t++) {
          const ang = R.range(0, TAU), d = Math.sqrt(R.range(tier.lo * tier.lo, tier.hi * tier.hi));
          const x = (tier.x ?? cx) + Math.sin(ang) * d, z = (tier.z ?? cz) + Math.cos(ang) * d;
          if (ok(x, z)) got = { x: +x.toFixed(3), z: +z.toFixed(3) };
        }
        if (got) break;
      }
      if (got) shells.push({ id: 'shell' + (shells.length + 1), kind: 'shell', x: got.x, y: this.hAt(got.x, got.z), z: got.z, at });
    }
    this.shells = shells;
  }

  /** Mayor Ribbit's parade (data.js ERRANDS 'ribbit'): W.lanterns = four paper lanterns [{ id: 'lantern1'…'lantern4',
   *  kind: 'lantern', x, y, z, at }], one per village spot Ribbit names: beside the walk up to the Great Tree's altar, by
   *  the plaza signpost, in front of Miso's shop and at the village edge on the Meadow path. A post-pass like
   *  placeShells: its own RNG stream, nothing added to the world's lists (a lantern has no collider: Pip lights it by
   *  walking past) and W.walk / W.reach put back. A spot is flat dry ground inside TW.paradeR of the plaza centre, off
   *  the path band and the z = 9 test line, clear of solids, colliders, chests, interactables and NPC spots, and
   *  reachable from the spawn. */
  placeLanterns() {
    const R = new RNG(this.seed * 53 + 7), keep = [this.walk, this.reach];
    const reach = this.bfs(this.buildWalk());
    this.walk = keep[0]; this.reach = keep[1];
    const out = [], P = this.pedestal, sp = this.signpost, sh = this.shop;
    const ok = (x, z) => len2(x, z) < TW.paradeR - 6 && !(Math.abs(z - 9) < 1.2 && Math.abs(x) < 14) && this.hAt(x, z) > 0.6 && this.slopeAt(x, z) < 0.45 && this.bridgeAt(x, z) === null
      && this.pathDAt(x, z) >= 2.2 && !this.solidNear(x, z, 1.2) && !this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + 0.9)
      && !this.chests.some((c) => len2(c.x - x, c.z - z) < 2.5) && !this.interact.some((it) => len2(it.x - x, it.z - z) < Math.max(2.5, (it.r || 0) + 0.8))
      && !Object.values(this.npcSpots).some((q) => len2(q.x - x, q.z - z) < 3) && len2(x - this.spawn.x, z - this.spawn.z) > 2.5
      && !out.some((q) => len2(q.x - x, q.z - z) < 8) && this.isReached(reach, x, z, false);
    // each spot: its centres in order (the Meadow one walks out along the path when a stretch is too cramped), a ring
    const mp = [26, 22, 29, 18].map((d) => { const p = this.pathAtDist('meadow', d); return [p.x, p.z]; });
    const spots = [
      ['altar', [[P.x, (P.z + this.spawn.z) / 2]], 3, 6.5],
      ['signpost', [[sp ? sp.x : 0, sp ? sp.z : 18]], 2.6, 6],
      ['shop', [[sh.x + Math.sin(sh.rot) * 7, sh.z + Math.cos(sh.rot) * 7]], 0, 4],
      ['meadow', mp, 2.4, 6],
    ];
    // nearest the spot's centre on a 0.5 m grid of its ring (draws nothing), as placeShells' fallback
    const scan = (cx, cz, r0, r1) => {
      let best = null, bd = Infinity;
      for (let dz = -r1; dz <= r1; dz += 0.5) for (let dx = -r1; dx <= r1; dx += 0.5) {
        const d = Math.hypot(dx, dz);
        if (d < r0 || d > r1 || d >= bd || !ok(cx + dx, cz + dz)) continue;
        best = { x: cx + dx, z: cz + dz }; bd = d;
      }
      return best;
    };
    for (const [at, centres, r0, r1] of spots) {
      let got = null;
      for (const [cx, cz] of centres) {
        for (let t = 0; t < 160 && !got; t++) {
          const ang = R.range(0, TAU), d = Math.sqrt(R.range(r0 * r0, r1 * r1));
          const x = cx + Math.sin(ang) * d, z = cz + Math.cos(ang) * d;
          if (ok(x, z)) got = { x, z };
        }
        if (!got) got = scan(cx, cz, r0, r1);
        if (got) break;
      }
      if (!got) got = scan(centres[0][0], centres[0][1], r0, r1 * 2 + 4);   // not seen on seeds 1–40
      if (got) {
        const x = +got.x.toFixed(3), z = +got.z.toFixed(3);
        out.push({ id: 'lantern' + (out.length + 1), kind: 'lantern', x, y: this.hAt(x, z), z, at });
      }
    }
    this.lanterns = out;
  }

  // ------------------------------------------------------------------ reachability
  bfs(W) {
    const R = new Uint8Array(SIZE * SIZE);
    const q = new Int32Array(SIZE * SIZE);
    const si = Math.floor(this.spawn.x + HALF), sj = Math.floor(this.spawn.z + HALF);
    let h = 0, t = 0;
    R[sj * SIZE + si] = 1; q[t++] = sj * SIZE + si;
    while (h < t) {
      const c = q[h++];
      const i = c % SIZE, j = (c / SIZE) | 0;
      if (i > 0 && W[c - 1] && !R[c - 1]) { R[c - 1] = 1; q[t++] = c - 1; }
      if (i < SIZE - 1 && W[c + 1] && !R[c + 1]) { R[c + 1] = 1; q[t++] = c + 1; }
      if (j > 0 && W[c - SIZE] && !R[c - SIZE]) { R[c - SIZE] = 1; q[t++] = c - SIZE; }
      if (j < SIZE - 1 && W[c + SIZE] && !R[c + SIZE]) { R[c + SIZE] = 1; q[t++] = c + SIZE; }
    }
    this.reach = R;
    return R;
  }
  reachTargets() {
    const T = [];
    for (const c of this.chests) T.push({ name: 'chest ' + c.id, x: c.x, z: c.z, adj: true });
    for (const k in this.npcSpots) T.push({ name: 'npc ' + k, x: this.npcSpots[k].x, z: this.npcSpots[k].z, adj: true });
    for (const id in this.arenas) T.push({ name: 'arena ' + id, x: this.arenas[id].x, z: this.arenas[id].z });
    for (const it of this.interact) if (it.kind === 'sign') T.push({ name: 'sign', x: it.x, z: it.z, adj: true });
    T.push({ name: 'meadow', x: this.meadowCenter.x, z: this.meadowCenter.z });
    return T;
  }
  isReached(R, x, z, adj) {
    const ci = Math.floor(x + HALF), cj = Math.floor(z + HALF);
    const rad = adj ? 2 : 0;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
      if (R[j * SIZE + i]) return true;
    }
    return false;
  }
  reachability() {
    for (let iter = 0; iter < 6; iter++) {
      const W = this.buildWalk();
      const R = this.bfs(W);
      const bad = this.reachTargets().filter((t) => !this.isReached(R, t.x, t.z, t.adj));
      this.unreachable = bad;
      if (!bad.length) return;
      if (iter === 0 && this.openRings(bad)) continue;   // WP9: a ring that closed an old way gets a gap first
      for (const t of bad) this.carveTo(R, t);
    }
  }
  /** WP9: on a few seeds the foundation's only way to a target (a heart-chest nook) crosses an arena's edge ring. Then
   *  that ring opens where the old way crossed it (the crossing nearest the target first, ±0.3 rad without stone
   *  colliders; world-mod.js leaves those stones out too) until the target is reached again. Returns whether it helped */
  openRings(bad) {
    const ring = this.colliders.filter((c) => c.kind === 'arenaring');
    if (!ring.length) return false;
    this.colliders = this.colliders.filter((c) => c.kind !== 'arenaring');
    const R0 = this.bfs(this.buildWalk());
    this.colliders.push(...ring);
    let opened = false;
    for (const t of bad) {
      if (!this.isReached(R0, t.x, t.z, t.adj)) continue;   // not the rings' doing
      for (const id in this.arenas) {
        const a = this.arenas[id];
        if (!a.ring || len2(t.x - a.x, t.z - a.z) > a.r + 30) continue;
        const tb = Math.atan2(t.x - a.x, t.z - a.z), cross = [];
        for (let k = 0; k < 72; k++) {
          const b = (k / 72) * TAU - Math.PI, at = (d) => this.isReached(R0, a.x + Math.sin(b) * d, a.z + Math.cos(b) * d, false);
          if (Math.abs(angDiff(b, a.entAng)) > a.ring.gap && at(a.r - 1.5) && at(a.r + 1.5)) cross.push(b);
        }
        cross.sort((p, q) => Math.abs(angDiff(p, tb)) - Math.abs(angDiff(q, tb)));
        for (const b of cross.slice(0, 4)) {
          this.colliders = this.colliders.filter((c) => !(c.kind === 'arenaring' && c.arena === id && Math.abs(angDiff(Math.atan2(c.x - a.x, c.z - a.z), b)) < 0.3));
          a.ring.open.push(+b.toFixed(4)); opened = true;
          if (this.isReached(this.bfs(this.buildWalk()), t.x, t.z, t.adj)) break;
        }
      }
    }
    return opened;
  }
  carveTo(R, t) {
    // nearest reachable cell, preferring similar height
    const th = this.hAt(t.x, t.z);
    let best = -1, bd = Infinity;
    const ci = Math.floor(t.x + HALF), cj = Math.floor(t.z + HALF);
    for (let rad = 1; rad < 120 && best < 0; rad += 3) {
      for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
        if (Math.abs(di) !== rad && Math.abs(dj) !== rad && rad > 3) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
        if (!R[j * SIZE + i]) continue;
        const x = i - HALF + 0.5, z = j - HALF + 0.5;
        const d = len2(x - t.x, z - t.z) + Math.abs(this.hAt(x, z) - th) * 3;
        if (d < bd) { bd = d; best = j * SIZE + i; }
      }
      if (best >= 0) break;
    }
    if (best < 0) return;
    const bx = (best % SIZE) - HALF + 0.5, bz = ((best / SIZE) | 0) - HALF + 0.5;
    const h0 = this.hAt(bx, bz), h1 = Math.max(0.6, this.hAt(t.x, t.z));
    const len = len2(t.x - bx, t.z - bz);
    for (let s = 0; s <= len; s += 0.7) {
      const u = len > 0 ? s / len : 1;
      const x = lerp(bx, t.x, u), z = lerp(bz, t.z, u);
      const hh = Math.max(0.6, lerp(h0, h1, u));
      this.flattenDisc(x, z, 1.4, 2.2, hh);
      for (const p of this.props) if (p.solid && !p.removed && len2(p.x - x, p.z - z) < p.r + 1.4 && p.type !== 'pedestal' && p.type !== 'sign') p.removed = true;
    }
    this.carved++;
  }
}

Object.assign(World.prototype, WorldCollide);

export function generateWorld(seed, o = {}) {
  const W = new World(seed);
  W.generate(o);
  return W;
}
