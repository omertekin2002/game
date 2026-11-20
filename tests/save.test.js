// Save schema: round trip, migration and load-time normalization (js/save.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { CFG, SEED_ORDER } from '../js/data.js';
import { MIGRATIONS, SAVE_VERSION, freshState, loadSave, migrate, normalize } from '../js/save.js';

const SEED = 7151;
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

function midGame() {
  return {
    ...freshState(SEED),
    hp: 7, maxHp: 10, coins: 143, potions: 2, swordLevel: 2,
    seeds: { woods: 2, peaks: 1, shores: 0 },
    chests: { c0: true, c5: true, c11: true },
    bosses: { woods: true, peaks: true },
    shopHeart: true, ending: false, tod: 0.8125,
    visited: { village: true, woods: true, peaks: true },
    introDone: true, controlsSeen: true, playTime: 1834.25,
    px: 12.5, pz: -40.25, facing: -1.25,
    errands: { clover: 1 }, shells: { shell2: true, shell4: true },
  };
}

// A v2 save as today's main writes it (SAVE_VERSION 2: no errands or shells yet): mid-game, and after the ending
function v2Save(ending = false) {
  const { errands, shells, ...s } = midGame();
  return ending
    ? { ...s, v: 2, ending: true, seeds: { woods: 2, peaks: 2, shores: 2 }, bosses: { woods: true, peaks: true, shores: true }, pitch: 0.2, controlsV: 2 }
    : { ...s, v: 2 };
}

// Every field the game reads has the right type and is in range.
function expectPlayable(s) {
  expect(s.v).toBe(SAVE_VERSION);
  expect(Number.isFinite(s.seed)).toBe(true);
  expect(Number.isInteger(s.maxHp)).toBe(true);
  expect(s.maxHp).toBeGreaterThanOrEqual(CFG.startHp);
  expect(s.maxHp).toBeLessThanOrEqual(CFG.maxHp);
  expect(Number.isInteger(s.hp)).toBe(true);
  expect(s.hp).toBeGreaterThanOrEqual(1);
  expect(s.hp).toBeLessThanOrEqual(s.maxHp);
  expect(Number.isInteger(s.coins)).toBe(true);
  expect(s.coins).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(s.potions)).toBe(true);
  expect(s.potions).toBeGreaterThanOrEqual(0);
  expect(s.potions).toBeLessThanOrEqual(CFG.potionMax);
  expect([1, 2]).toContain(s.swordLevel);
  for (const k of ['seeds', 'chests', 'bosses', 'visited', 'errands', 'shells']) {
    expect(s[k] !== null && typeof s[k] === 'object' && !Array.isArray(s[k])).toBe(true);
  }
  for (const id of SEED_ORDER) expect([0, 1, 2]).toContain(s.seeds[id]);
  for (const k of Object.keys(s.errands)) expect([1, 2]).toContain(s.errands[k]);
  for (const k of Object.keys(s.shells)) expect(s.shells[k]).toBe(true);
  for (const k of ['shopHeart', 'ending', 'introDone', 'controlsSeen']) expect(typeof s[k]).toBe('boolean');
  expect(s.tod).toBeGreaterThanOrEqual(0);
  expect(s.tod).toBeLessThan(1);
  expect(Number.isFinite(s.playTime) && s.playTime >= 0).toBe(true);
  for (const k of ['px', 'pz', 'facing']) expect(s[k] === null || Number.isFinite(s[k])).toBe(true);
  expect((s.px === null) === (s.pz === null)).toBe(true);
}

describe('round trip', () => {
  test('a fresh state survives save and load unchanged', () => {
    const s = freshState(SEED);
    expect(loadSave(roundTrip(s), SEED)).toEqual(s);
  });

  test('a mid-game state survives save and load unchanged', () => {
    const s = midGame();
    expect(loadSave(roundTrip(s), SEED)).toEqual(s);
  });

  test('a save from another island keeps its own seed', () => {
    const s = { ...midGame(), seed: 1234 };
    expect(loadSave(roundTrip(s), SEED).seed).toBe(1234);
  });

  test('unknown extra fields are kept', () => {
    expect(loadSave({ ...freshState(SEED), extra: { a: 1 } }, SEED).extra).toEqual({ a: 1 });
  });

  test('loading does not mutate the raw save', () => {
    const raw = { ...roundTrip(midGame()), hp: 999, chests: null };
    const copy = roundTrip(raw);
    loadSave(raw, SEED);
    expect(raw).toEqual(copy);
  });
});

describe('migrate', () => {
  test('the current version needs no steps', () => {
    expect(SAVE_VERSION).toBe(3);
    expect(Object.keys(MIGRATIONS)).toEqual(['2']);
    expect(migrate(roundTrip(midGame()))).toEqual(midGame());
  });

  test.each([['mid-game', false], ['after the ending', true]])('a v2 save (%s) migrates to v3 with every field kept', (_name, ending) => {
    const v2 = roundTrip(v2Save(ending));
    const m = migrate(v2);
    expect(m).toEqual({ ...v2, v: 3, errands: {}, shells: {} });
    expect(v2.v).toBe(2); // input untouched
    const s = loadSave(roundTrip(v2Save(ending)), SEED);
    expectPlayable(s);
    expect(s).toEqual({ ...v2, v: 3, errands: {}, shells: {} });   // normalize keeps every v2 field as it was
  });

  test('a migrated v2 save round-trips as v3', () => {
    const s = loadSave(roundTrip(v2Save(true)), SEED);
    expect(loadSave(roundTrip(s), SEED)).toEqual(s);
  });

  test('a v2 save that already carries errand fields still starts them empty', () => {
    expect(migrate({ ...roundTrip(v2Save()), errands: { clover: 2 }, shells: { shell1: true } })).toMatchObject({ v: 3, errands: {}, shells: {} });
  });

  test('runs an older-version step and stamps the current version', () => {
    // synthetic v1 layout: gems instead of coins, chests as an array of ids
    const v1 = { v: 1, seed: SEED, hp: 4, gems: 30, chests: ['c1', 'c2'] };
    const calls = [];
    const steps = {
      ...MIGRATIONS,
      1: (s) => {
        calls.push(s.v);
        const { gems, ...rest } = s;
        return { ...rest, coins: gems, chests: Object.fromEntries(s.chests.map((id) => [id, true])) };
      },
    };
    const m = migrate(v1, steps);
    expect(calls).toEqual([1]);
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.errands).toEqual({}); // then the real v2 → v3 step
    expect(m.coins).toBe(30);
    expect(m.chests).toEqual({ c1: true, c2: true });
    expect('gems' in m).toBe(false);
    expect(v1.v).toBe(1); // input untouched

    const s = loadSave(v1, SEED, steps);
    expectPlayable(s);
    expect(s.coins).toBe(30);
    expect(s.hp).toBe(4);
    expect(s.chests).toEqual({ c1: true, c2: true });
  });

  test('an older version with no registered step is unusable', () => {
    expect(migrate({ v: 1, seed: SEED })).toBeNull();
    expect(loadSave({ v: 1, seed: SEED }, SEED)).toBeNull();
  });

  test('a step that throws or returns garbage makes the save unusable', () => {
    expect(migrate({ v: 1, seed: SEED }, { 1: () => { throw new Error('boom'); } })).toBeNull();
    expect(migrate({ v: 1, seed: SEED }, { 1: () => null })).toBeNull();
    expect(migrate({ v: 1, seed: SEED }, { 1: (s) => ({ ...s, seed: undefined }) })).toBeNull();
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'save'],
    ['an array', [1, 2]],
    ['no v', { seed: SEED }],
    ['a non-integer v', { v: 1.5, seed: SEED }],
    ['a string v', { v: '2', seed: SEED }],
    ['v of 0', { v: 0, seed: SEED }],
    ['a newer v', { ...freshState(SEED), v: SAVE_VERSION + 1 }],
    ['a v4 save', { ...freshState(SEED), v: 4 }],
    ['no seed', { ...freshState(SEED), seed: undefined }],
    ['a null seed', { ...freshState(SEED), seed: null }],
  ])('returns null for %s', (_name, raw) => {
    expect(migrate(raw)).toBeNull();
    expect(loadSave(raw, SEED)).toBeNull();
  });
});

describe('normalize', () => {
  const base = () => roundTrip(midGame());
  const load = (patch) => {
    const s = loadSave({ ...base(), ...patch }, SEED);
    expectPlayable(s);
    return s;
  };

  test.each(['chests', 'bosses', 'visited', 'shells', 'errands'])('null, array or string %s becomes an empty object', (k) => {
    for (const bad of [null, [true, true], 'x', 3]) expect(load({ [k]: bad })[k]).toEqual({});
  });

  test('flag maps keep truthy entries as true and drop falsy ones', () => {
    expect(load({ chests: { c1: true, c2: 1, c3: false, c4: null } }).chests).toEqual({ c1: true, c2: true });
  });

  test('errand states are clamped to 1 / 2 (0 and junk dropped); shells become flags', () => {
    expect(load({ errands: { clover: 7, ribbit: -1, hoot: 'x', digby: 1.4, miso: 1.6, a: 2, b: 0, c: null } }).errands).toEqual({ clover: 2, digby: 1, miso: 2, a: 2 });
    expect(load({ shells: { shell1: 1, shell2: 'yes', shell3: false, shell4: 0 } }).shells).toEqual({ shell1: true, shell2: true });
  });

  test('null, array or partial seeds become a full seeds object', () => {
    expect(load({ seeds: null }).seeds).toEqual({ woods: 0, peaks: 0, shores: 0 });
    expect(load({ seeds: [2, 2, 2] }).seeds).toEqual({ woods: 0, peaks: 0, shores: 0 });
    expect(load({ seeds: { woods: 2 } }).seeds).toEqual({ woods: 2, peaks: 0, shores: 0 });
    expect(load({ seeds: { woods: 9, peaks: -1, shores: 'x' } }).seeds).toEqual({ woods: 2, peaks: 0, shores: 0 });
  });

  test('NaN, strings and infinities fall back to defaults', () => {
    const s = load({ hp: NaN, maxHp: 'x', coins: Infinity, potions: '2', swordLevel: NaN, tod: NaN, playTime: -Infinity });
    expect(s.maxHp).toBe(CFG.startHp);
    expect(s.hp).toBe(s.maxHp);
    expect(s.coins).toBe(0);
    expect(s.potions).toBe(0);
    expect(s.swordLevel).toBe(1);
    expect(s.tod).toBe(CFG.startTimeOfDay);
    expect(s.playTime).toBe(0);
  });

  test('NaN from JSON (null) and hp "x" still give a playable state', () => {
    // JSON.stringify turns NaN into null, which is what a corrupt localStorage save looks like
    const s = loadSave(roundTrip({ ...base(), hp: 'x', maxHp: NaN, chests: null }), SEED);
    expectPlayable(s);
    expect(s.chests).toEqual({});
  });

  test('negative numbers are clamped up', () => {
    const s = load({ hp: -5, maxHp: -10, coins: -3, potions: -1, swordLevel: -2, playTime: -9 });
    expect(s).toMatchObject({ hp: 1, maxHp: CFG.startHp, coins: 0, potions: 0, swordLevel: 1, playTime: 0 });
  });

  test('huge numbers are clamped down', () => {
    const s = load({ hp: 1e9, maxHp: 1e9, coins: 1e300, potions: 50, swordLevel: 7 });
    expect(s).toMatchObject({ hp: CFG.maxHp, maxHp: CFG.maxHp, coins: Number.MAX_SAFE_INTEGER, potions: CFG.potionMax, swordLevel: 2 });
  });

  test('hp above maxHp is clamped to maxHp', () => {
    expect(load({ hp: 12, maxHp: 8 })).toMatchObject({ hp: 8, maxHp: 8 });
  });

  test('time of day wraps into [0, 1)', () => {
    expect(load({ tod: 1.25 }).tod).toBeCloseTo(0.25);
    expect(load({ tod: -0.25 }).tod).toBeCloseTo(0.75);
    expect(load({ tod: 1 }).tod).toBe(0);
    expect(load({ tod: -1e-17 }).tod).toBe(0);
    expect(load({ tod: 0.4 }).tod).toBe(0.4);
  });

  test('a half-missing or non-finite position becomes null', () => {
    expect(load({ px: 3, pz: null })).toMatchObject({ px: null, pz: null });
    expect(load({ px: 'a', pz: 4 })).toMatchObject({ px: null, pz: null });
    expect(load({ px: Infinity, pz: 4 })).toMatchObject({ px: null, pz: null });
    expect(load({ facing: 'north' }).facing).toBe(Math.PI);
    expect(load({ facing: null }).facing).toBeNull();
  });

  test('booleans are coerced', () => {
    const s = load({ shopHeart: 1, ending: 'yes', introDone: 0, controlsSeen: null });
    expect(s).toMatchObject({ shopHeart: true, ending: true, introDone: false, controlsSeen: false });
  });

  test('a save with only v and seed is filled from freshState', () => {
    expect(loadSave({ v: SAVE_VERSION, seed: SEED }, SEED)).toEqual(freshState(SEED));
  });

  test('a non-numeric seed falls back to the given seed', () => {
    expect(loadSave({ v: SAVE_VERSION, seed: 'abc' }, SEED).seed).toBe(SEED);
  });

  test('normalize of a non-object returns a fresh state', () => {
    expect(normalize(null, SEED)).toEqual(freshState(SEED));
  });
});
