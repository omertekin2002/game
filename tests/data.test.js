// Sanity checks for the content tables in js/data.js. Run with `bun test`.
import { expect, test } from 'bun:test';
import { BOSSES, CFG, ENEMY, ERRANDS, NPCS, REGIONS, SEED_ORDER, SEEDS, SHOP, errands } from '../js/data.js';
import { freshState } from '../js/save.js';

test('every enemy in a region spawn table exists in ENEMY', () => {
  for (const r of REGIONS) {
    for (const [type, weight] of r.enemies) {
      expect({ region: r.id, type, known: type in ENEMY }).toEqual({ region: r.id, type, known: true });
      expect(weight).toBeGreaterThan(0);
    }
  }
});

test('enemy definitions have positive hp and radius', () => {
  for (const [type, def] of Object.entries(ENEMY)) {
    expect({ type, hp: def.hp > 0, r: def.r > 0 }).toEqual({ type, hp: true, r: true });
  }
});

test('shop items have unique ids and positive prices', () => {
  expect(new Set(SHOP.map((s) => s.id)).size).toBe(SHOP.length);
  for (const item of SHOP) {
    expect(Number.isFinite(item.price)).toBe(true);
    expect(item.price).toBeGreaterThan(0);
  }
});

test('each starseed has a boss and a region', () => {
  const regionIds = REGIONS.map((r) => r.id);
  for (const key of SEED_ORDER) {
    expect(SEEDS[key]).toBeDefined();
    expect(BOSSES[key]).toBeDefined();
    expect(regionIds).toContain(key);
  }
});

test('the default seed is a positive integer', () => {
  expect(Number.isInteger(CFG.seed)).toBe(true);
  expect(CFG.seed).toBeGreaterThan(0);
});

test('the ERRANDS table is well-formed', () => {
  expect(ERRANDS.length).toBeGreaterThan(0);
  expect(new Set(ERRANDS.map((e) => e.id)).size).toBe(ERRANDS.length);
  const npcIds = NPCS.map((n) => n.id), regionIds = REGIONS.map((r) => r.id);
  for (const e of ERRANDS) {
    expect(typeof e.id).toBe('string');
    expect(npcIds).toContain(e.npc);
    expect(regionIds).toContain(e.region);
    expect(Number.isInteger(e.count) && e.count > 0).toBe(true);
    expect(typeof e.unlock).toBe('function');
    expect(e.reward.gems).toBeGreaterThan(0);
    expect(typeof e.name === 'string' && e.name.length > 0).toBe(true);
    expect(typeof e.hint === 'string' && e.hint.length > 0).toBe(true);
  }
  expect(errands.get('clover')).toMatchObject({ npc: 'clover', region: 'shores', count: 5, reward: { gems: 50 } });
  expect(errands.items(errands.get('clover'))).toEqual(['shell1', 'shell2', 'shell3', 'shell4', 'shell5']);
});

const clover = NPCS.find((n) => n.id === 'clover');
const save = (patch = {}) => ({ ...freshState(CFG.seed), ...patch });
const pinched = (patch = {}) => save({ bosses: { shores: true }, ...patch });
const allShells = { shell1: true, shell2: true, shell3: true, shell4: true, shell5: true };

test("before Captain Pinch is beaten, Clover's lines are unchanged and the errand stays locked", () => {
  const S = save({ errands: {} });
  expect(clover.lines(S)).toEqual([
    'Going to the Sunny Shores? Follow this path south to the sea. Captain Pinch\'s cove is at its very end, just past the striped lighthouse on the beach, and he charges in a straight line like a runaway cart!',
    'When a glowing stripe runs across the sand in front of him, that is where he will charge. Sidestep out of it, or {dash} sideways, and he bonks the arena wall. Dizzy crab, free hits!',
    'Little crabs raise their claws before they charge. Step aside, then bonk them while they catch their breath. A big third swing knocks their claws right open!',
  ]);
  expect(errands.talk(S, errands.get('clover'))).toBeNull();
  expect(S.errands).toEqual({});
});

test("Clover's lines are short, non-empty strings in every errand state", () => {
  const states = [
    save(), pinched(), pinched({ errands: { clover: 1 } }), pinched({ errands: { clover: 1 }, shells: { shell1: true } }),
    pinched({ errands: { clover: 1 }, shells: { shell1: true, shell2: true, shell3: true, shell4: true } }),
    pinched({ errands: { clover: 1 }, shells: allShells }), pinched({ errands: { clover: 2 }, shells: allShells }),
    pinched({ errands: { clover: 2 }, shells: allShells, ending: true }),
  ];
  const seen = new Set();
  for (const S of states) {
    const lines = clover.lines(S);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(typeof l === 'string' && l.length > 0).toBe(true);
    if (S.bosses.shores) for (const l of lines) expect(l.length).toBeLessThanOrEqual(150);   // the new lines stay short
    seen.add(lines.join('|'));
  }
  expect(seen.size).toBe(states.length);   // every state says something different
  expect(clover.lines(pinched({ errands: { clover: 1 }, shells: { shell1: true, shell3: true } }))[0]).toBe('2 of 5 rainbow shells! Keep looking, Pip!');
  expect(clover.lines(pinched({ errands: { clover: 2 }, ending: true })).join(' ')).toContain('Great Tree');
});

test("Clover's errand: start, pick up every shell once, finish once with the reward", () => {
  const e = errands.get('clover'), S = pinched({ coins: 7 });
  expect(errands.pick(S, e, 'shell1')).toBeNull();                 // not out before the errand starts
  expect(errands.talk(S, e)).toBe('start');
  expect(S.errands).toEqual({ clover: 1 });
  expect(errands.talk(S, e)).toBeNull();                           // no shells yet: just cheering
  expect(errands.pick(S, e, 'shell3')).toBe(1);
  expect(errands.pick(S, e, 'shell3')).toBeNull();                 // already picked up
  expect(errands.pick(S, e, 'shell9')).toBeNull();                 // not one of hers
  for (const id of ['shell1', 'shell2', 'shell4']) errands.pick(S, e, id);
  expect(errands.found(S, e)).toBe(4);
  expect(errands.talk(S, e)).toBeNull();
  expect(errands.pick(S, e, 'shell5')).toBe(5);
  expect(errands.talk(S, e)).toBe('done');
  expect(S.errands.clover).toBe(2);
  expect(S.coins).toBe(57);
  expect(errands.talk(S, e)).toBeNull();                           // no second reward
  expect(S.coins).toBe(57);
  expect(errands.done(S)).toBe(1);
});
