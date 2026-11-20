// Unit tests for deterministic island generation (js/world.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { generateWorld } from '../js/world.js';
import { CFG, REGION } from '../js/data.js';
import { world as TW } from '../js/tune.js';
import { placementPrint } from './lib/world-print.js';
import PRINTS from './fixtures/world-prints.json';

const HEART_IDS = ['hc_meadow', 'hc_shores', 'hc_peaks', 'hc_woods'];
const SEEDS = [CFG.seed, 1, 42, 1234];
const SLOW = 30_000; // world gen takes ~0.2-0.3 s locally; leave headroom for slow CI runners

// FNV-1a over raw bytes: a cheap fingerprint of the whole heightfield / region map.
function fnv(typed) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
  return h;
}

function fingerprint(w) {
  return {
    spawn: { ...w.spawn },
    props: w.props.length,
    deco: w.deco.length,
    chests: w.chests.map((c) => [c.id, c.kind, c.amount, +c.x.toFixed(3), +c.z.toFixed(3)]),
    arenas: Object.fromEntries(Object.entries(w.arenas).map(([k, a]) => [k, [+a.x.toFixed(3), +a.z.toFixed(3)]])),
    heights: fnv(w.H),
    regions: fnv(w.reg),
  };
}

// where Ribbit says a parade lantern is (data.js ERRANDS 'ribbit' hint)
function lanternNear(w, s) {
  const d = (x, z) => Math.hypot(s.x - x, s.z - z);
  if (s.at === 'altar') return d(w.pedestal.x, (w.pedestal.z + w.spawn.z) / 2) <= 6.6;
  if (s.at === 'signpost') return d(w.signpost.x, w.signpost.z) <= 6.1;
  if (s.at === 'shop') return d(w.shop.x, w.shop.z) <= 11.5;
  if (s.at === 'meadow') return Math.min(...w.paths.meadow.map((p) => d(p.x, p.z))) <= 6.5 && Math.hypot(s.x, s.z) > 18;
  return false;
}

const worlds = new Map();
const world = (seed) => {
  if (!worlds.has(seed)) worlds.set(seed, generateWorld(seed));
  return worlds.get(seed);
};

describe('generateWorld determinism', () => {
  test('same seed gives the same island', () => {
    const a = fingerprint(generateWorld(CFG.seed));
    const b = fingerprint(world(CFG.seed));
    expect(a).toEqual(b);
  }, SLOW);

  test('different seeds give different islands', () => {
    const a = fingerprint(world(CFG.seed));
    const b = fingerprint(world(1));
    expect(a.heights).not.toBe(b.heights);
  }, SLOW);
});

describe.each(SEEDS)('seed %p', (seed) => {
  test('every reachability target is reachable', () => {
    const w = world(seed);
    expect(w.unreachable.map((t) => t.name)).toEqual([]);
  }, SLOW);

  test('has the three boss arenas', () => {
    expect(Object.keys(world(seed).arenas).sort()).toEqual(['peaks', 'shores', 'woods']);
  }, SLOW);

  test('has exactly the four heart-container chests and at least one coin chest', () => {
    const w = world(seed);
    const hearts = w.chests.filter((c) => c.kind === 'heart').map((c) => c.id).sort();
    expect(hearts).toEqual([...HEART_IDS].sort());
    expect(w.chests.length).toBeGreaterThanOrEqual(HEART_IDS.length + 1);
    const ids = w.chests.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, SLOW);

  test('every existing placement matches the fingerprint taken before the rainbow-shell pass', () => {
    // tests/fixtures/world-prints.json: placementPrint of each seed on the code before Clover's errand (issue #32)
    expect(placementPrint(world(seed))).toEqual(PRINTS[seed]);
  }, SLOW);

  test('the rainbow-shell pass changes nothing else in the world', () => {
    const w = world(seed), bare = generateWorld(seed, { shells: false });
    expect(bare.shells).toEqual([]);
    expect(placementPrint(w)).toEqual(placementPrint(bare));
    expect(fingerprint(w)).toEqual(fingerprint(bare));
    expect(fnv(w.walk)).toBe(fnv(bare.walk));
    expect(fnv(w.reach)).toBe(fnv(bare.reach));
    expect(w.unreachable).toEqual(bare.unreachable);
  }, SLOW);

  test('five rainbow shells on dry Shores sand: flat, clear, outside the arena, reachable, at the spots Clover names', () => {
    const w = world(seed), a = w.arenas.shores;
    expect(w.shells.map((s) => s.id)).toEqual(['shell1', 'shell2', 'shell3', 'shell4', 'shell5']);
    expect(w.shells.map((s) => s.at)).toEqual(['lighthouse', 'islet1', 'islet2', 'cove', 'path']);
    const reach = w.bfs(w.buildWalk());
    const lm = w.landmarks.find((l) => l.id === 'shores');
    for (const s of w.shells) {
      const isle = w.islets.find((i) => Math.hypot(s.x - i.x, s.z - i.z) < i.r);
      const at = { id: s.id, shores: w.regionAt(s.x, s.z) === REGION.SHORES || !!isle, sand: w.surfaceAt(s.x, s.z), dry: w.hAt(s.x, s.z) > 0.3 };
      expect(at).toEqual({ id: s.id, shores: true, sand: 'sand', dry: true });
      expect(s.y).toBeCloseTo(w.hAt(s.x, s.z), 5);
      expect(w.slopeAt(s.x, s.z)).toBeLessThan(0.5);
      expect(w.bridgeAt(s.x, s.z)).toBeNull();
      expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeGreaterThan(a.r + 5);   // outside the arena and its stone ring
      expect(w.inArena(s.x, s.z, 5)).toBeNull();
      expect(w.solidNear(s.x, s.z, 1.0)).toBeNull();
      expect(w.colliders.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 1.0)).toEqual([]);
      expect(w.pathDAt(s.x, s.z)).toBeGreaterThanOrEqual(3);
      expect(w.chests.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < 2.5)).toEqual([]);
      expect({ id: s.id, reached: w.isReached(reach, s.x, s.z, false) }).toEqual({ id: s.id, reached: true });
      for (const t of w.shells) if (t !== s) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThanOrEqual(8);
      // where Clover says they are
      if (s.at === 'lighthouse') expect(Math.hypot(s.x - lm.x, s.z - lm.z)).toBeLessThan(12);
      if (s.at === 'islet1') expect(isle).toBe(w.islets[0]);
      if (s.at === 'islet2') expect(isle).toBe(w.islets[1]);
      if (s.at === 'cove') expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeLessThan(a.r + 16);
      if (s.at === 'path') expect(Math.min(...w.paths.shores.map((p) => Math.hypot(p.x - s.x, p.z - s.z)))).toBeLessThan(7);
    }
  }, SLOW);

  test('the parade-lantern pass changes nothing else in the world, with or without the shell pass', () => {
    const w = world(seed), noLanterns = generateWorld(seed, { lanterns: false }), bare = generateWorld(seed, { shells: false, lanterns: false });
    expect(noLanterns.lanterns).toEqual([]);
    expect(noLanterns.shells).toEqual(w.shells);   // its own RNG stream: the shells stay where they were
    for (const o of [noLanterns, bare]) {
      expect(placementPrint(w)).toEqual(placementPrint(o));
      expect(fingerprint(w)).toEqual(fingerprint(o));
      expect(fnv(w.walk)).toBe(fnv(o.walk));
      expect(fnv(w.reach)).toBe(fnv(o.reach));
      expect(w.unreachable).toEqual(o.unreachable);
    }
    expect(generateWorld(seed).lanterns).toEqual(w.lanterns);   // deterministic per seed
  }, SLOW);

  test('four parade lanterns in the village: flat, clear, off the paths, reachable, at the spots Ribbit names', () => {
    const w = world(seed);
    expect(w.lanterns.map((s) => s.id)).toEqual(['lantern1', 'lantern2', 'lantern3', 'lantern4']);
    expect(w.lanterns.map((s) => s.at)).toEqual(['altar', 'signpost', 'shop', 'meadow']);
    const reach = w.bfs(w.buildWalk());
    for (const s of w.lanterns) {
      expect(s.kind).toBe('lantern');
      expect(Math.hypot(s.x, s.z)).toBeLessThan(TW.paradeR - 6);   // well inside the village circle Ribbit follows in
      expect(s.y).toBeCloseTo(w.hAt(s.x, s.z), 5);
      expect(w.hAt(s.x, s.z)).toBeGreaterThan(0.6);
      expect(w.slopeAt(s.x, s.z)).toBeLessThan(0.45);
      expect(w.bridgeAt(s.x, s.z)).toBeNull();
      expect(w.pathDAt(s.x, s.z)).toBeGreaterThanOrEqual(2.2);
      expect(w.solidNear(s.x, s.z, 1.2)).toBeNull();
      expect(w.colliders.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 0.9)).toEqual([]);
      expect(w.chests.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < 2.5)).toEqual([]);
      expect(Object.values(w.npcSpots).filter((q) => Math.hypot(q.x - s.x, q.z - s.z) < 3)).toEqual([]);
      expect({ id: s.id, reached: w.isReached(reach, s.x, s.z, false) }).toEqual({ id: s.id, reached: true });
      for (const t of w.lanterns) if (t !== s) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThanOrEqual(8);
      for (const t of w.shells) expect(t.id).not.toBe(s.id);
      expect(lanternNear(w, s)).toBe(true);
    }
  }, SLOW);

  test('spawn point is on dry land', () => {
    const w = world(seed);
    expect(w.hAt(w.spawn.x, w.spawn.z)).toBeGreaterThan(0);
  }, SLOW);
});

// Clover names the spots (data.js ERRANDS hint), so every shell must be at its own on any island, not just the four
// above: seeds 1–40 (seed 23's second islet has only a sliver of dry sand clear of its palm, chest and bridge)
test('on seeds 1–40 every rainbow shell is at the spot Clover names', () => {
  const off = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed), a = w.arenas.shores, lm = w.landmarks.find((l) => l.id === 'shores');
    if (w.shells.length !== 5) off.push([seed, 'count', w.shells.length]);
    for (const s of w.shells) {
      const isle = s.at.startsWith('islet') ? w.islets[+s.at.slice(5) - 1] : null;
      const near = s.at === 'lighthouse' ? Math.hypot(s.x - lm.x, s.z - lm.z) < 12
        : isle ? Math.hypot(s.x - isle.x, s.z - isle.z) < isle.r
          : s.at === 'cove' ? Math.hypot(s.x - a.x, s.z - a.z) < a.r + 16
            : Math.min(...w.paths.shores.map((p) => Math.hypot(p.x - s.x, p.z - s.z))) < 7;
      if (!near) off.push([seed, s.at, s.x, s.z]);
    }
  }
  expect(off).toEqual([]);
}, 120_000);

test('default seed has exactly 14 chests, as documented in docs/DESIGN.md', () => {
  const w = world(CFG.seed);
  expect(w.chests.length).toBe(14);
  expect(w.chests.filter((c) => c.kind === 'coins').length).toBe(10);
}, SLOW);

// Ribbit names the spots, so every lantern must be at its own on any island: seeds 1–40
test('on seeds 1–40 there are four parade lanterns, each at the spot Ribbit names and reachable', () => {
  const off = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = generateWorld(seed);
    if (w.lanterns.length !== 4) off.push([seed, 'count', w.lanterns.length]);
    const reach = w.bfs(w.buildWalk());
    for (const s of w.lanterns) if (!lanternNear(w, s) || !w.isReached(reach, s.x, s.z, false)) off.push([seed, s.at, s.x, s.z]);
  }
  expect(off).toEqual([]);
}, 120_000);
