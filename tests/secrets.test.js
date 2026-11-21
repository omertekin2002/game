// Landmark keepsakes: the content table and pure rules in js/data.js (SECRETS, secrets) and the villager lines that
// point at them. Placement is tests/world.test.js; reading one in the game is tests/playthrough.mjs. Run with `bun test`.
import { expect, test } from 'bun:test';
import { CFG, NPCS, SECRETS, SEED_ORDER, secrets } from '../js/data.js';
import { freshState } from '../js/save.js';

const IDS = SECRETS.map((s) => s.id);
const say = (id, S) => NPCS.find((n) => n.id === id).lines(S);
/** a save with n Starseeds home and the given keepsakes found */
function save(n = 0, found = []) {
  const S = freshState(CFG.seed);
  SEED_ORDER.slice(0, n).forEach((id) => { S.bosses[id] = true; S.seeds[id] = 2; });
  for (const id of found) S.secrets[id] = true;
  return S;
}
const HINT = "Every tall thing on this isle keeps something tucked round its back. Digby's dug near all of them.";

test('SECRETS: one keepsake per region landmark (not the Great Tree), 25 gems each, 1–2 lines, unique ids', () => {
  expect(IDS).toEqual(['acorn', 'stone', 'bottle', 'pouch']);
  expect(SECRETS.map((s) => s.landmark)).toEqual(['woods', 'peaks', 'shores', 'meadow']);
  expect(new Set(IDS).size).toBe(IDS.length);
  for (const s of SECRETS) {
    expect(s.gems).toBe(25);
    expect(s.lines.length).toBeGreaterThanOrEqual(1);
    expect(s.lines.length).toBeLessThanOrEqual(2);
    for (const l of s.lines) { expect(typeof l).toBe('string'); expect(l.length).toBeGreaterThan(10); }
    expect(typeof s.name).toBe('string');
    expect(['Look', 'Open']).toContain(s.verb);
    expect(s.label).not.toBe(s.name);   // the crosshair prompt keeps the surprise
  }
  expect(SECRETS.filter((s) => s.keep).map((s) => s.id)).toEqual(['bottle']);   // the opened bottle stays on the sand
});

test('secrets.find: the first find sets the flag and gives 25 gems; a repeat or an unknown id changes nothing', () => {
  const S = save();
  S.coins = 7;
  expect(secrets.count(S)).toBe(0);
  expect(secrets.got(S, 'acorn')).toBe(false);
  expect(secrets.find(S, 'acorn')).toBe(25);
  expect(S.coins).toBe(32);
  expect(S.secrets).toEqual({ acorn: true });
  expect(secrets.got(S, 'acorn')).toBe(true);
  expect(secrets.count(S)).toBe(1);
  const before = JSON.stringify(S);
  expect(secrets.find(S, 'acorn')).toBe(0);           // a repeat
  for (const bad of ['kraken', 'constructor', 'toString', '', undefined]) expect(secrets.find(S, bad)).toBe(0);
  expect(JSON.stringify(S)).toBe(before);
  for (const id of ['stone', 'bottle', 'pouch']) expect(secrets.find(S, id)).toBe(25);
  expect(S.coins).toBe(7 + 4 * 25);
  expect(secrets.count(S)).toBe(4);
});

test('secrets.find works on a save without a secrets map (before normalize) and never shares the old object', () => {
  const S = { coins: 0 };
  expect(secrets.find(S, 'pouch')).toBe(25);
  expect(S).toEqual({ coins: 25, secrets: { pouch: true } });
  const old = { acorn: true }, T = { coins: 1, secrets: old };
  secrets.find(T, 'stone');
  expect(old).toEqual({ acorn: true });
  expect(T.secrets).toEqual({ acorn: true, stone: true });
});

test('count and got read only keepsake ids set to true', () => {
  expect(secrets.count({ secrets: { acorn: true, stone: 1, bottle: 'yes', kraken: true, constructor: true } })).toBe(1);
  expect(secrets.got({ secrets: { stone: 1 } }, 'stone')).toBe(false);
  for (const S of [null, undefined, {}, { secrets: null }, { secrets: [true] }]) expect(secrets.count(S)).toBe(0);
  expect(secrets.get('bottle').name).toBe('Message in a bottle');
  expect(secrets.get('kraken')).toBeNull();
});

test("Digby hints at the keepsakes once the first Starseed is home, and thanks Pip once all four are found", () => {
  expect(say('digby', save(0))).not.toContain(HINT);
  const S1 = save(1);
  S1.seeds.peaks = 1;   // carried, not home: still one home
  expect(say('digby', S1)).toContain(HINT);
  expect(say('digby', save(3, ['acorn', 'stone', 'bottle']))).toContain(HINT);
  for (const n of [0, 3]) {
    const all = say('digby', save(n, IDS));
    expect(all).not.toContain(HINT);
    expect(all.some((l) => l.includes('You found what every tall thing on this isle was keeping?'))).toBe(true);
  }
  // only a carried Starseed (none home yet): no hint
  const carried = save(0);
  carried.seeds.woods = 1;
  expect(say('digby', carried)).not.toContain(HINT);
  // after the bloom, too
  expect(say('digby', { ...save(3), ending: true })).toContain(HINT);
});

test("Ribbit's lines (\"Lots of secrets\") are the same whatever keepsakes are found", () => {
  for (const n of [0, 1, 2, 3]) {
    const base = say('ribbit', save(n)), all = say('ribbit', save(n, IDS));
    expect(all).toEqual(base);
  }
  expect(say('ribbit', save(0)).join(' ')).toContain('flowers and secrets. Lots of secrets. Croak.');
});
