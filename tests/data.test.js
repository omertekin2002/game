// Sanity checks for the content tables in js/data.js. Run with `bun test`.
import { expect, test } from 'bun:test';
import { BOSSES, CFG, ENEMY, REGIONS, SEED_ORDER, SEEDS, SHOP } from '../js/data.js';

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
