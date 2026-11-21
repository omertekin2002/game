// Guardian rematches after the bloom: the pure rules in js/data.js (REMATCH, rematch) and the villager lines that point
// at them. The fight itself runs in the browser (js/fight.js; tests/playthrough.mjs and the wp5 in-page suites). Run with
// `bun test`.
import { expect, test } from 'bun:test';
import { BOSSES, CFG, NPCS, REMATCH, SEED_ORDER, rematch } from '../js/data.js';
import { freshState } from '../js/save.js';

const IDS = Object.keys(BOSSES);
/** a finished game: every guardian beaten, every Starseed home, the tree bloomed */
function bloomed() {
  const S = freshState(CFG.seed);
  for (const id of SEED_ORDER) { S.bosses[id] = true; S.seeds[id] = 2; }
  S.ending = true;
  return S;
}
const say = (id, S) => NPCS.find((n) => n.id === id).lines(S).join(' ');

test('REMATCH: 1.25 × HP (48 → 60, Frostbun 50 → 63), enraged from 75 %, 40 gems once', () => {
  expect(REMATCH).toEqual({ hpK: 1.25, enrage: 0.75, gems: 40 });
  expect(Object.fromEntries(IDS.map((id) => [id, rematch.hp(id)]))).toEqual({ woods: 60, shores: 60, peaks: 63 });
  // first fights keep their numbers
  expect(Object.fromEntries(IDS.map((id) => [id, BOSSES[id].hp]))).toEqual({ woods: 48, shores: 48, peaks: 50 });
});

test('a rematch is available only after the ending, for a beaten guardian id', () => {
  const S = bloomed();
  for (const id of IDS) expect(rematch.available(S, id)).toBe(true);
  expect(rematch.available({ ...S, ending: false }, 'woods')).toBe(false);          // before the bloom: never
  expect(rematch.available(freshState(CFG.seed), 'woods')).toBe(false);
  expect(rematch.available({ ...S, bosses: { shores: true, peaks: true } }, 'woods')).toBe(false);
  expect(rematch.available({ ...S, bosses: { woods: 1 } }, 'woods')).toBe(false);  // flags are true, not truthy junk
  for (const bad of ['kraken', 'constructor', 'toString']) expect(rematch.available(S, bad)).toBe(false);
  expect(rematch.available(null, 'woods')).toBe(false);
  expect(rematch.available(undefined, 'woods')).toBe(false);
});

test('the first win per guardian gives 40 gems once and sets the flag; a repeat win changes nothing', () => {
  const S = bloomed();
  S.coins = 12;
  const seeds = { ...S.seeds }, bosses = { ...S.bosses };
  expect(rematch.win(S, 'woods')).toBe(40);
  expect(S.coins).toBe(52);
  expect(S.rematches).toEqual({ woods: true });
  expect(rematch.won(S, 'woods')).toBe(true);
  expect(rematch.count(S)).toBe(1);
  expect(rematch.win(S, 'woods')).toBe(0);
  expect(S.coins).toBe(52);
  expect(S.rematches).toEqual({ woods: true });
  expect(rematch.win(S, 'peaks')).toBe(40);
  expect(rematch.win(S, 'shores')).toBe(40);
  expect(S.coins).toBe(132);
  expect(rematch.count(S)).toBe(3);
  // a rematch win never touches the Starseeds or the guardians beaten
  expect(S.seeds).toEqual(seeds);
  expect(S.bosses).toEqual(bosses);
});

test('rematch.win ignores unknown ids, and a missing rematches field or gem count starts from empty', () => {
  const S = bloomed();
  delete S.rematches; delete S.coins;
  expect(rematch.win(S, 'kraken')).toBe(0);
  expect(S.rematches).toBeUndefined();
  expect(rematch.win(S, 'shores')).toBe(40);
  expect(S.coins).toBe(40);
  expect(S.rematches).toEqual({ shores: true });
});

test('rematch.count counts guardian ids set to true only', () => {
  expect(rematch.count({ rematches: { woods: true, shores: 1, kraken: true, constructor: true } })).toBe(1);
  expect(rematch.count({ rematches: null })).toBe(0);
  expect(rematch.count({})).toBe(0);
  expect(rematch.count(undefined)).toBe(0);
});

test('after the bloom Elder Shellby points at the rematches, and thanks Pip once all three are won', () => {
  const S = bloomed();
  expect(say('shellby', S)).toContain('napping in their arenas again');
  expect(say('shellby', S)).toContain('rematch');
  S.rematches = { woods: true, shores: true };
  expect(say('shellby', S)).toContain('napping in their arenas again');
  S.rematches.peaks = true;
  expect(say('shellby', S)).not.toContain('napping in their arenas again');
  expect(say('shellby', S)).toContain('every guardian');
  // before the bloom, never a word about rematches
  const before = freshState(CFG.seed);
  before.bosses = { woods: true, shores: true, peaks: true };
  for (const id of ['shellby', 'hoot', 'digby', 'clover']) expect(say(id, before).toLowerCase()).not.toContain('rematch');
});

test("each guardian's tip-giver has one short line once that rematch is won", () => {
  const S = bloomed();
  S.errands = { clover: 2 };
  const pairs = [['hoot', 'woods'], ['clover', 'shores'], ['digby', 'peaks']];
  const before = Object.fromEntries(pairs.map(([npc]) => [npc, NPCS.find((n) => n.id === npc).lines(S)]));
  for (const [npc, id] of pairs) {
    S.rematches = { [id]: true };
    const lines = NPCS.find((n) => n.id === npc).lines(S);
    expect(lines.length).toBe(before[npc].length + 1);
    const added = lines.find((l) => !before[npc].includes(l));
    expect(typeof added).toBe('string');
    expect(added.length).toBeGreaterThan(20);
    expect(added.length).toBeLessThanOrEqual(160);
    expect(added).toContain(BOSSES[id].name);
  }
});
