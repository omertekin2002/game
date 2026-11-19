// Unit tests for the completion tally (js/completion.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { completion, COMPLETION_ROWS } from '../js/completion.js';
import { generateWorld } from '../js/world.js';
import { freshState, loadSave, SAVE_VERSION } from '../js/save.js';
import { BOSSES, CFG, REGIONS, SEED_ORDER } from '../js/data.js';

const SEEDS = [CFG.seed, 1, 42, 1234]; // the seeds tests/world.test.js checks
const SLOW = 30_000;

const worlds = new Map();
const world = (seed) => {
  if (!worlds.has(seed)) worlds.set(seed, generateWorld(seed));
  return worlds.get(seed);
};

// a save with everything done on world W
function fullSave(W) {
  const S = freshState(W.seed);
  for (const c of W.chests) S.chests[c.id] = true;
  for (const id of Object.keys(BOSSES)) S.bosses[id] = true;
  REGIONS.forEach((_, i) => { S.visited[i] = true; });
  for (const id of SEED_ORDER) S.seeds[id] = 2;
  S.shopHeart = true;
  return S;
}

const counts = (c) => Object.fromEntries(COMPLETION_ROWS.map((r) => [r.k, [c[r.k].found, c[r.k].total]]));

test('fresh save on the default seed: nothing found, the documented totals', () => {
  const W = world(CFG.seed);
  const c = completion(W, freshState(W.seed));
  expect(counts(c)).toEqual({ chests: [0, 14], hearts: [0, 5], guardians: [0, 3], regions: [0, 5], seeds: [0, 3] });
  expect(c.pct).toBe(0);
  expect(c.done).toBe(false);
  for (const r of COMPLETION_ROWS) expect(c[r.k].full).toBe(false);
}, SLOW);

test('a partial save counts what is set, and a heart chest counts as a chest and a heart', () => {
  const W = world(CFG.seed);
  const S = freshState(W.seed);
  const heart = W.chests.find((c) => c.kind === 'heart');
  const coins = W.chests.find((c) => c.kind !== 'heart');
  S.chests[heart.id] = true; S.chests[coins.id] = true;
  S.bosses.woods = true;
  S.visited[0] = true; S.visited[3] = true;
  S.seeds.woods = 2; S.seeds.peaks = 1;          // 1 = carried, not home yet
  const c = completion(W, S);
  expect(counts(c)).toEqual({ chests: [2, 14], hearts: [1, 5], guardians: [1, 3], regions: [2, 5], seeds: [1, 3] });
  // distinct things: 14 chests + shop heart + 3 guardians + 5 regions + 3 seeds = 26; found 2 + 1 + 2 + 1 = 6
  expect(c.pct).toBe(Math.floor((100 * 6) / 26));
  expect(c.done).toBe(false);
}, SLOW);

test('the shop heart alone counts as one heart container', () => {
  const W = world(CFG.seed);
  const c = completion(W, { ...freshState(W.seed), shopHeart: true });
  expect(c.hearts).toEqual({ found: 1, total: 5, full: false });
  expect(c.chests.found).toBe(0);
}, SLOW);

test('everything but one thing is not done and stays under 100 %', () => {
  const W = world(CFG.seed);
  const S = fullSave(W);
  S.shopHeart = false;
  const c = completion(W, S);
  expect(c.hearts.full).toBe(false);
  expect(c.chests.full).toBe(true);
  expect(c.done).toBe(false);
  expect(c.pct).toBeLessThan(100);
}, SLOW);

test('a save round-tripped through JSON and loadSave counts the same (visited keys become strings)', () => {
  const W = world(CFG.seed);
  const S = fullSave(W);
  const back = loadSave(JSON.parse(JSON.stringify(S)), W.seed);
  expect(counts(completion(W, back))).toEqual(counts(completion(W, S)));
  expect(completion(W, back).done).toBe(true);
}, SLOW);

test('stale and unknown keys do not inflate the counts', () => {
  const W = world(CFG.seed);
  const S = loadSave({
    v: SAVE_VERSION, seed: W.seed,
    chests: { not_a_chest: true, hc_nowhere: true, toString: true, __proto__x: true },
    bosses: { kraken: true, constructor: true },
    visited: { village: true, woods: true, 5: true, 99: true, '-1': true, 1.5: true },
    seeds: { woods: 2, moon: 2 },
  }, W.seed);
  expect(counts(completion(W, S))).toEqual({ chests: [0, 14], hearts: [0, 5], guardians: [0, 3], regions: [0, 5], seeds: [1, 3] });
  // inherited object keys are never "set", even on a bare object without normalize()
  const bare = { chests: {}, bosses: {}, visited: {}, seeds: {} };
  expect(counts(completion({ chests: [{ id: 'constructor', kind: 'coins' }] }, bare)).chests).toEqual([0, 1]);
}, SLOW);

test('missing world or save fields count as nothing found', () => {
  expect(counts(completion({ chests: [] }, {}))).toEqual({ chests: [0, 0], hearts: [0, 1], guardians: [0, 3], regions: [0, 5], seeds: [0, 3] });
  expect(completion(undefined, undefined).pct).toBe(0);
});

test('completion() does not change the world or the save', () => {
  const W = world(CFG.seed);
  const S = fullSave(W);
  const before = JSON.stringify(S), ids = W.chests.map((c) => c.id).join();
  completion(W, S);
  expect(JSON.stringify(S)).toBe(before);
  expect(W.chests.map((c) => c.id).join()).toBe(ids);
}, SLOW);

describe.each(SEEDS)('seed %p', (seed) => {
  test('totals follow the generated world; a full save is 100 % and done', () => {
    const W = world(seed);
    const fresh = completion(W, freshState(seed));
    expect(fresh.chests.total).toBe(W.chests.length);
    expect(fresh.hearts.total).toBe(W.chests.filter((c) => c.kind === 'heart').length + 1);
    expect(fresh.done).toBe(false);
    const full = completion(W, fullSave(W));
    for (const r of COMPLETION_ROWS) expect(full[r.k]).toEqual({ found: fresh[r.k].total, total: fresh[r.k].total, full: true });
    expect(full.pct).toBe(100);
    expect(full.done).toBe(true);
  }, SLOW);
});
