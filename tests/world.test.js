// Unit tests for deterministic island generation (js/world.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { generateWorld } from '../js/world.js';
import { CFG } from '../js/data.js';

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

  test('spawn point is on dry land', () => {
    const w = world(seed);
    expect(w.hAt(w.spawn.x, w.spawn.z)).toBeGreaterThan(0);
  }, SLOW);
});

test('default seed has exactly 14 chests, as documented in docs/DESIGN.md', () => {
  const w = world(CFG.seed);
  expect(w.chests.length).toBe(14);
  expect(w.chests.filter((c) => c.kind === 'coins').length).toBe(10);
}, SLOW);
