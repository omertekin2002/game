// Deterministic island generation: heightfield, regions, paths, river, ponds, arenas, bridges, props,
// chests, NPC spots, colliders and a reachability check (BFS + corridor carving).
import { RNG, makeNoise, clamp, lerp, smoothstep, sampleSpline, distToSeg, len2, angDiff, TAU } from './util.js';
import { REGION, SIGNS, DOOR_LINES } from './data.js';

export const SIZE = 360, HALF = 180, N = SIZE + 1;
export const CHUNK = 40;
export const NCH = Math.ceil(SIZE / CHUNK);

const SOLID = {
  tree_round: 0.72, tree_pine: 0.6, tree_snow: 0.6, tree_palm: 0.42, bush: 0.62, rock: 0.55, boulder: 1.25,
  stump: 0.45, pot: 0.3, lamp: 0.22, sign: 0.28, well: 1.15, chest: 0.6, pedestal: 0.95,
};

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
    this.carved = 0;
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
  bridgeAt(x, z) {
    for (const b of this.bridges) {
      const dx = x - b.ax, dz = z - b.az;
      const t = (dx * b.dx + dz * b.dz) / b.len;
      if (t < 0 || t > 1) continue;
      const side = Math.abs(dx * -b.dz + dz * b.dx);
      if (side > b.w / 2) continue;
      return b.h0 + (b.h1 - b.h0) * t + Math.sin(t * Math.PI) * b.arch;
    }
    return null;
  }
  ground(x, z) {
    const h = this.hAt(x, z);
    if (this.bridges.length) {
      const b = this.bridgeAt(x, z);
      if (b !== null && b > h) return b;
    }
    return h;
  }
  /** Can a walker stand here? (not deep water, not a cliff) */
  walkable(x, z) {
    const b = this.bridges.length ? this.bridgeAt(x, z) : null;
    if (b !== null) return true;
    if (this.hAt(x, z) < -0.4) return false;
    return this.slopeAt(x, z) < 0.84;
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
  generate() {
    const t0 = performance.now();
    this.layout();
    this.baseTerrain();
    this.flattenAreas();
    this.makePaths();
    this.carveWater();
    this.stampPaths();
    this.detail();
    this.computeSlope();
    this.computeRegions();
    this.placeVillage();
    this.placeArenas();
    this.placeSpecial();
    this.scatter();
    this.reachability();
    this.computeSlope();
    this.computeSplat();
    this.buildColliderHash();
    this.genMs = performance.now() - t0;
  }

  layout() {
    const r = this.rng;
    this.plaza = { x: 0, z: 0, r: 11, h: 2.3 };
    this.treePos = { x: 0, z: -1.5 };
    this.pedestal = { x: 0, z: 4.6 };
    this.spawn = { x: 0, z: 8.2 };
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
        // regional heights
        const hV = 2.3 + 0.35 * noise.fbm(x * 0.04, z * 0.04, 2);
        const hW = 3.0 + 1.9 * noise.fbm(x * 0.025 + 40, z * 0.025, 4);
        const hM = 2.0 + 2.4 * (0.5 + 0.5 * noise.fbm(x * 0.018 - 30, z * 0.018 + 12, 3));
        const hS = 1.8 + 0.9 * noise.fbm(x * 0.03, z * 0.03 + 50, 3);
        const ramp = smoothstep(54, 96, x + 10 * noise.noise2(z * 0.02, x * 0.02));
        const hP = 3.4 + ramp * (5 + 17 * noise.ridged(x * 0.021 + 7, z * 0.021 - 3, 4)) + 1.2 * noise.fbm(x * 0.05, z * 0.05, 2);
        let inland = ww * hW + wp * hP + ws * hS + wm * hM;
        inland = lerp(inland, hV, vw);
        // coastal profile
        const beachW = clamp(3 + 11 * ws + 4 * wm - 2 * wp, 2, 14);
        let h;
        if (d < 0) h = Math.max(-7.5, d * (0.16 + 0.26 * (1 - ws)));
        else if (d < beachW) h = (d / beachW) * 1.1;
        else h = 1.1 + (inland - 1.1) * smoothstep(0, 18, d - beachW);
        H[k] = h;
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
        const fp = 1 - smoothstep(12, 17, r);
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
        if (len2(p.x, p.z) < 14) p.h = this.plaza.h;
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
      dirtF = Math.max(dirtF, 1 - smoothstep(7.4 + n1 * 1.6, 8.9 + n1 * 1.6, pr));
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
  reserveCircle(x, z, r) {
    (this.reserved || (this.reserved = [])).push({ x, z, r });
  }
  isReserved(x, z, pad = 0) {
    if (this.pathDAt(x, z) < 3.0 + pad) return true;
    for (const c of this.reserved || []) if (len2(x - c.x, z - c.z) < c.r + pad) return true;
    for (const b of this.bridges) if (distToSeg(x, z, b.ax, b.az, b.bx, b.bz) < b.w / 2 + 2.5 + pad) return true;
    return false;
  }
  pathDAt(x, z) {
    const i = clamp(Math.round(x + HALF), 0, SIZE), j = clamp(Math.round(z + HALF), 0, SIZE);
    return this.pathD[j * N + i];
  }
  /** add a prop. o: {rot, s, solid radius override, kind, data} */
  addProp(type, x, z, o = {}) {
    const p = {
      type, x, z, y: o.y ?? this.ground(x, z), rot: o.rot ?? this.rng.range(0, TAU), s: o.s ?? 1,
      r: o.r ?? (SOLID[type] ? SOLID[type] * (o.s ?? 1) : 0), solid: o.solid ?? !!SOLID[type],
      id: this.props.length, ...o.extra,
    };
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

  placeVillage() {
    const r = this.rng;
    const face = (x, z, tx = 0, tz = 0) => Math.atan2(tx - x, tz - z);
    // Great Tree + pedestal
    this.greatTree = { x: this.treePos.x, z: this.treePos.z, y: this.plaza.h };
    this.reserveCircle(this.treePos.x, this.treePos.z, 6);
    this.colliders.push({ x: this.treePos.x, z: this.treePos.z, r: 2.6, kind: 'tree' });
    for (let a = 0; a < 5; a++) {
      const ang = (a / 5) * TAU + 0.4;
      this.colliders.push({ x: this.treePos.x + Math.sin(ang) * 2.6, z: this.treePos.z + Math.cos(ang) * 2.6, r: 0.9, kind: 'tree' });
    }
    this.addProp('pedestal', this.pedestal.x, this.pedestal.z, { rot: 0 });
    this.addInteract('pedestal', this.pedestal.x, this.pedestal.z, { r: 2.4, h: 1.5 });
    this.reserveCircle(this.pedestal.x, this.pedestal.z, 2.5);
    this.reserveCircle(this.spawn.x, this.spawn.z, 2);
    // houses
    const houseSpots = [
      { type: 'house_a', x: -16, z: -14 }, { type: 'house_b', x: 15, z: -16 }, { type: 'house_a', x: -18, z: 13 },
      { type: 'house_b', x: 24, z: -6 }, { type: 'house_a', x: -25, z: -3 },
    ];
    houseSpots.forEach((hs, n) => {
      const rot = face(hs.x, hs.z);
      const y = this.hAt(hs.x, hs.z);
      const h = { type: hs.type, x: hs.x, z: hs.z, y, rot };
      this.houses.push(h);
      this.reserveCircle(hs.x, hs.z, 4.2);
      const fx = Math.sin(rot), fz = Math.cos(rot), rx = Math.cos(rot), rz = -Math.sin(rot);
      // footprint colliders
      for (const [a, b, rr] of [[0, 0, 2.3], [1.3, -0.6, 1.7], [-1.3, -0.6, 1.7], [0, -1.4, 1.8]]) {
        this.colliders.push({ x: hs.x + rx * a + fx * b, z: hs.z + rz * a + fz * b, r: rr, kind: 'house' });
      }
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
    // shop
    {
      const x = 15, z = 14, rot = face(x, z);
      const y = this.hAt(x, z);
      this.shop = { x, z, y, rot };
      this.reserveCircle(x, z, 4.6);
      const fx = Math.sin(rot), fz = Math.cos(rot), rx = Math.cos(rot), rz = -Math.sin(rot);
      for (const [a, b, rr] of [[0, -0.3, 2.5], [1.5, -0.7, 1.8], [-1.5, -0.7, 1.8]]) this.colliders.push({ x: x + rx * a + fx * b, z: z + rz * a + fz * b, r: rr, kind: 'house' });
      this.npcSpots.miso = { x: x + fx * 3.2 + rx * 0.9, z: z + fz * 3.2 + rz * 0.9, rot };
      this.addInteract('door', x - rx * 1.4 + fx * 2.6, z - rz * 1.4 + fz * 2.6, { lines: ['A sign on the door: "Miso\'s Shop. Ring the cat for service."'], h: 2.2, r: 1.2 });
      this.addProp('pot', x + rx * 2.9 + fx * 2.2, z + rz * 2.9 + fz * 2.2, { extra: { breakable: true } });
      this.addProp('pot', x + rx * 3.4 + fx * 1.4, z + rz * 3.4 + fz * 1.4, { s: 0.8, extra: { breakable: true } });
    }
    // well
    this.addProp('well', 9, -7.5, { rot: face(9, -7.5) });
    this.addInteract('well', 9, -7.5, { r: 2.0, h: 2.6, lines: ['You peek into the well. A tiny frog waves back at you.', '...You wave back. It feels like the polite thing to do.'] });
    this.reserveCircle(9, -7.5, 2.4);
    // lamps around plaza and along paths
    for (const deg of [35, 145, 215, 325]) {
      const a = (deg / 180) * Math.PI;
      this.addLamp(Math.sin(a) * 12.4, -Math.cos(a) * 12.4);
    }
    for (const id in this.paths) {
      const p1 = this.pathAtDist(id, 16), p2 = this.pathAtDist(id, 34);
      this.addLamp(p1.x + p1.nx * 2.4, p1.z + p1.nz * 2.4);
      this.addLamp(p2.x - p2.nx * 2.4, p2.z - p2.nz * 2.4);
    }
    // signs
    const sp = (id, d, side) => { const p = this.pathAtDist(id, d); return { x: p.x + p.nx * side * 2.6, z: p.z + p.nz * side * 2.6, p }; };
    for (const id of ['woods', 'peaks', 'shores', 'meadow']) {
      const s = sp(id, 9, 1);
      this.addSign(s.x, s.z, SIGNS[id], s.p.x - s.p.tx * 6, s.p.z - s.p.tz * 6);
    }
    {
      const s = sp('shores', 22, -1);
      this.addSign(s.x, s.z, SIGNS.village, s.p.x + s.p.tx * 6, s.p.z + s.p.tz * 6);
    }
    // NPCs
    this.npcSpots.shellby = { x: -3.4, z: 6.0, rot: 0.5 };
    this.npcSpots.ribbit = { x: -6.5, z: 1.5, rot: 0.8 };
    for (const k of ['shellby', 'ribbit']) this.reserveCircle(this.npcSpots[k].x, this.npcSpots[k].z, 2.2);
    {
      const p = this.pathAtDist('shores', 40);
      this.npcSpots.clover = { x: p.x - p.nx * 2.6, z: p.z - p.nz * 2.6, rot: 0 };
      const q = this.pathAtDist('woods', 44);
      this.npcSpots.hoot = { x: q.x + q.nx * 2.7, z: q.z + q.nz * 2.7, rot: 0 };
      const pts = this.paths.meadow; const m = pts[pts.length - 1];
      this.npcSpots.digby = { x: m.x - 3, z: m.z + 2.5, rot: 0 };
      this.meadowCenter = { x: m.x, z: m.z };
      for (const k of ['clover', 'hoot', 'digby']) this.reserveCircle(this.npcSpots[k].x, this.npcSpots[k].z, 2.4);
      this.reserveCircle(m.x, m.z, 5);
    }
    // plaza flowers & benches of flowers
    for (let i = 0; i < 26; i++) {
      const a = r.range(0, TAU), rr = r.range(12.5, 16);
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      if (this.pathDAt(x, z) < 2.2) continue;
      this.addDeco('flowers', x, z, { s: r.range(0.8, 1.2) });
    }
    this.reserveCircle(0, 0, 12);
  }
  addLamp(x, z) {
    const p = this.addProp('lamp', x, z, { rot: this.rng.range(0, TAU) });
    this.lamps.push(p);
    this.reserveCircle(x, z, 1.2);
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

  placeSpecial() {
    const r = this.rng;
    // ---- heart container chests ----
    // Meadow: flower ring
    let sp = this.findSpot(-92, 34, 0, 14, (x, z) => this.flatGood(x, z, 4) && this.pathDAt(x, z) > 10 && this.regionAt(x, z) === REGION.MEADOW) || { x: -90, z: 34 };
    this.flattenDisc(sp.x, sp.z, 4, 4, this.hAt(sp.x, sp.z));
    this.addChest('hc_meadow', sp.x, sp.z, 'heart', 0);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU;
      this.addDeco('flowers', sp.x + Math.sin(a) * 3.2, sp.z + Math.cos(a) * 3.2, { s: 1.3 });
      if (k % 3 === 0 && k !== 0) this.addProp('bush', sp.x + Math.sin(a) * 4.3, sp.z + Math.cos(a) * 4.3, { s: 0.9, extra: { cuttable: true } });
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
      this.addProp('tree_palm', i1.x + 2.4, i1.z + 1.5, { s: 1.05 });
      this.addProp('rock', i1.x - 2.5, i1.z + 2, { s: 0.9 });
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
        if (this.hAt(x, z) > 1 && !this.inArena(x, z, 6)) best = { x, z, p, side };
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
    // ---- coin chests ----
    const regionsFor = [REGION.WOODS, REGION.WOODS, REGION.PEAKS, REGION.PEAKS, REGION.SHORES, REGION.SHORES, REGION.MEADOW, REGION.MEADOW, REGION.MEADOW, REGION.VILLAGE, REGION.SHORES];
    let n = 0;
    for (const reg of regionsFor) {
      for (let t = 0; t < 1500; t++) {
        const a = r.range(0, TAU), d = r.range(reg === REGION.VILLAGE ? 22 : 36, reg === REGION.VILLAGE ? 36 : 125);
        const x = Math.sin(a) * d, z = -Math.cos(a) * d;
        if (this.regionAt(x, z) !== reg) continue;
        const pd = this.pathDAt(x, z);
        if (pd < 5 || pd > 55) continue;
        if (!this.flatGood(x, z, 1.6)) continue;
        if (this.isReserved(x, z, 1.5)) continue;
        if (this.chests.some((c) => len2(c.x - x, c.z - z) < 22)) continue;
        this.addChest('coin_' + n, x, z, 'coins', 10 + r.int(0, 4) * 5);
        n++;
        break;
      }
    }
    // extra pots around the meadow & shores
    for (let i = 0; i < 10; i++) {
      const sp3 = this.findSpot(0, 0, 40, 120, (x, z) => this.flatGood(x, z, 1.5) && !this.isReserved(x, z, 1) && [REGION.MEADOW, REGION.SHORES].includes(this.regionAt(x, z)));
      if (!sp3) continue;
      for (let k = 0; k < 3; k++) this.addProp('pot', sp3.x + r.range(-1.2, 1.2), sp3.z + r.range(-1.2, 1.2), { s: r.range(0.8, 1.05), extra: { breakable: true } });
      this.reserveCircle(sp3.x, sp3.z, 2.5);
    }
  }

  scatter() {
    const r = this.rng, noise = this.noise;
    const step = 2.1;
    for (let gz = -HALF + 2; gz < HALF - 2; gz += step) {
      for (let gx = -HALF + 2; gx < HALF - 2; gx += step) {
        const x = gx + r.range(-0.9, 0.9), z = gz + r.range(-0.9, 0.9);
        const h = this.hAt(x, z);
        if (h < 0.55) continue;
        const reg = this.regionAt(x, z);
        const sl = this.slopeAt(x, z);
        if (this.inArena(x, z, 3)) continue;
        if (this.isReserved(x, z)) continue;
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
        const rad = (SOLID[type] || 0.5) * s;
        if (this.solidNear(x, z, rad + 0.35)) continue;
        if (this.colliders.some((c) => len2(c.x - x, c.z - z) < c.r + rad + 0.6)) continue;
        this.addProp(type, x, z, { s, extra: type === 'bush' ? { cuttable: true } : undefined });
      }
    }
    // dense non-colliding decoration
    for (let gz = -HALF + 1; gz < HALF - 1; gz += 1.15) {
      for (let gx = -HALF + 1; gx < HALF - 1; gx += 1.15) {
        const x = gx + r.range(-0.5, 0.5), z = gz + r.range(-0.5, 0.5);
        const h = this.hAt(x, z);
        if (h < 0.15) continue;
        const pd = this.pathDAt(x, z);
        const rr = len2(x, z);
        if (rr < 8.5) continue;
        if (this.inArena(x, z, -1) && r.next() < 0.85) continue;
        const reg = this.regionAt(x, z);
        const roll = r.next();
        const sl = this.slopeAt(x, z);
        if (sl > 0.8) continue;
        const onPath = pd < 1.6;
        if (onPath && roll > 0.03) continue;
        const sandy = h < (reg === REGION.SHORES ? 1.6 : 1.0);
        const n = noise.noise2(x * 0.08 + 11, z * 0.08 - 3);
        if (sandy) {
          if (roll < 0.025) this.addDeco('shell', x, z);
          else if (roll < 0.04) this.addDeco('pebble', x, z);
          continue;
        }
        if (reg === REGION.PEAKS && h > 6.5) {
          if (roll < 0.05) this.addDeco('pebble', x, z, { s: r.range(0.8, 1.5) });
          else if (roll < 0.075) this.addDeco('crystal', x, z, { s: r.range(0.7, 1.2) });
          continue;
        }
        if (reg === REGION.WOODS) {
          if (roll < 0.26) this.addDeco('fern', x, z, { s: r.range(0.8, 1.3) });
          else if (roll < 0.3) this.addDeco('glowshroom', x, z, { s: r.range(0.7, 1.2) });
          else if (roll < 0.34 && !this.isReserved(x, z, -1.5)) this.addDeco('tallgrass', x, z, { s: r.range(0.9, 1.2) });
          continue;
        }
        const fl = reg === REGION.MEADOW ? 0.2 + 0.2 * smoothstep(0, 0.5, n) : 0.06;
        if (roll < 0.5) this.addDeco('grass', x, z, { s: r.range(0.8, 1.5) });
        else if (roll < 0.5 + fl) this.addDeco('flowers', x, z, { s: r.range(0.7, 1.15) });
        else if (roll < 0.52 + fl + (reg === REGION.MEADOW ? 0.06 : 0.035) && pd > 3.2 && !this.isReserved(x, z, -1.5)) this.addDeco('tallgrass', x, z, { s: r.range(0.9, 1.25) });
        else if (roll < 0.535 + fl + 0.03) this.addDeco('pebble', x, z);
      }
    }
  }

  // ------------------------------------------------------------------ reachability
  buildWalk() {
    const W = new Uint8Array(SIZE * SIZE);
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const x = i - HALF + 0.5, z = j - HALF + 0.5;
      W[j * SIZE + i] = this.walkable(x, z) ? 1 : 0;
    }
    const block = (x, z, rad) => {
      const R = Math.ceil(rad + 1);
      const ci = Math.floor(x + HALF), cj = Math.floor(z + HALF);
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
        if (len2(i - HALF + 0.5 - x, j - HALF + 0.5 - z) < rad + 0.25) W[j * SIZE + i] = 0;
      }
    };
    for (const p of this.props) if (p.solid && !p.removed && !p.cuttable && !p.breakable) block(p.x, p.z, p.r);
    for (const c of this.colliders) block(c.x, c.z, c.r);
    this.walk = W;
    return W;
  }
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
      for (const t of bad) this.carveTo(R, t);
    }
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

  buildColliderHash() {
    for (const p of this.props) {
      if (p.removed || !p.solid || !p.r) continue;
      this.colliders.push({ x: p.x, z: p.z, r: p.r, kind: p.type, prop: p });
    }
    this.rehash();
  }
  rehash() {
    this.cHash = new Map();
    this.colliders.forEach((c, i) => {
      c.active = true;
      const x0 = Math.floor((c.x - c.r) / 4), x1 = Math.floor((c.x + c.r) / 4);
      const z0 = Math.floor((c.z - c.r) / 4), z1 = Math.floor((c.z + c.r) / 4);
      for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
        const key = (a + 100) * 1000 + (b + 100);
        let arr = this.cHash.get(key);
        if (!arr) this.cHash.set(key, (arr = []));
        arr.push(c);
      }
    });
  }
  addDynamicCollider(c) {
    c.active = true;
    this.colliders.push(c);
    const x0 = Math.floor((c.x - c.r) / 4), x1 = Math.floor((c.x + c.r) / 4);
    const z0 = Math.floor((c.z - c.r) / 4), z1 = Math.floor((c.z + c.r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const key = (a + 100) * 1000 + (b + 100);
      let arr = this.cHash.get(key);
      if (!arr) this.cHash.set(key, (arr = []));
      arr.push(c);
    }
    return c;
  }
  /** iterate active colliders near (x,z) */
  nearColliders(x, z, r, out) {
    out.length = 0;
    const x0 = Math.floor((x - r) / 4), x1 = Math.floor((x + r) / 4);
    const z0 = Math.floor((z - r) / 4), z1 = Math.floor((z + r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const arr = this.cHash.get((a + 100) * 1000 + (b + 100));
      if (!arr) continue;
      for (const c of arr) if (c.active && !out.includes(c)) out.push(c);
    }
    return out;
  }
}

export function generateWorld(seed) {
  const W = new World(seed);
  W.generate();
  return W;
}
