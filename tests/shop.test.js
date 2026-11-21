// Miso's shop stock rules (js/data.js `shop`, PLUSHIES) and her plushie lines. Run with `bun test`.
import { expect, test } from 'bun:test';
import { BOSSES, CFG, NPCS, PLUSHIES, SHOP, shop } from '../js/data.js';
import { freshState } from '../js/save.js';

const miso = NPCS.find((n) => n.id === 'miso');
const save = (patch = {}) => ({ ...freshState(CFG.seed), ...patch });
const ALL = { woods: true, shores: true, peaks: true };
// the heart and the sword sold: the shop is bought out
const boughtOut = (patch = {}) => save({ shopHeart: true, swordLevel: 2, maxHp: CFG.startHp + 2, ...patch });
const ids = (S) => shop.items(S).map((it) => it.id);
const BASE = ['potion', 'heart', 'sword'];

test('PLUSHIES: one per guardian in BOSSES order, 80 gems, the guardian sprite as icon, short copy', () => {
  expect(PLUSHIES.map((p) => p.boss)).toEqual(Object.keys(BOSSES));
  expect(new Set([...SHOP, ...PLUSHIES].map((it) => it.id)).size).toBe(SHOP.length + PLUSHIES.length);
  for (const p of PLUSHIES) {
    expect(p.price).toBe(80);
    expect(p.icon).toBe(BOSSES[p.boss].key);
    expect(p.name).toBe(BOSSES[p.boss].name + ' plushie');
    for (const s of [p.desc, p.got]) expect(typeof s === 'string' && s.length > 0 && s.length <= 60).toBe(true);
  }
  expect(PLUSHIES.reduce((a, p) => a + p.price, 0)).toBe(240);
});

test('before the heart and the sword are both sold the shop lists exactly Potion, Heart Container, Shiny Sword', () => {
  for (const S of [
    save(), save({ bosses: ALL }), save({ bosses: ALL, ending: true, coins: 9999 }),
    save({ bosses: ALL, shopHeart: true }), save({ bosses: ALL, swordLevel: 2 }),
    save({ bosses: ALL, plushies: ALL }),   // even a save that holds plushie flags
  ]) {
    expect(ids(S)).toEqual(BASE);
    expect(shop.items(S).map((it) => it.name)).toEqual(['Potion', 'Heart Container', 'Shiny Sword']);
  }
  expect(shop.boughtOut(save({ shopHeart: true }))).toBe(false);
  expect(shop.boughtOut(save({ swordLevel: 2 }))).toBe(false);
  expect(shop.boughtOut(boughtOut())).toBe(true);
  expect(shop.boughtOut(undefined)).toBe(false);
});

test('once bought out, one plushie row per beaten guardian, after the base rows, in guardian order', () => {
  expect(ids(boughtOut())).toEqual(BASE);                                                     // no guardian beaten yet
  expect(ids(boughtOut({ bosses: { shores: true } }))).toEqual([...BASE, 'plush_shores']);
  expect(ids(boughtOut({ bosses: { peaks: true, woods: true } }))).toEqual([...BASE, 'plush_woods', 'plush_peaks']);
  expect(ids(boughtOut({ bosses: ALL }))).toEqual([...BASE, 'plush_woods', 'plush_shores', 'plush_peaks']);
  expect(ids(boughtOut({ bosses: { kraken: true, woods: 1 } }))).toEqual(BASE);           // only beaten (true) guardian ids
  // a bought plushie stays listed, sold out
  const S = boughtOut({ bosses: ALL, plushies: { shores: true } });
  expect(ids(S)).toHaveLength(6);
  expect(shop.items(S).map((it) => shop.state(it, S))).toEqual(['ok', 'sold', 'sold', 'ok', 'sold', 'ok']);
  // items() never hands out the shared table to be mutated
  shop.items(save()).push({ id: 'x' });
  expect(SHOP).toHaveLength(3);
});

test('shop.state and shop.check: ok, sold, full and poor', () => {
  const [potion, heart, sword] = SHOP, [pw, ps] = PLUSHIES;
  let S = save({ coins: 79 });
  expect([potion, heart, sword].map((it) => shop.state(it, S))).toEqual(['ok', 'ok', 'ok']);
  expect(shop.state(pw, S)).toBe('ok');
  expect(shop.check(potion, S)).toBe('ok');
  expect(shop.check(heart, S)).toBe('poor');
  expect(shop.check(pw, S)).toBe('poor');                 // 79 < 80
  expect(shop.check(pw, { ...S, coins: 80 })).toBe('ok');
  expect(shop.check(pw, { ...S, coins: undefined })).toBe('poor');
  S = save({ potions: CFG.potionMax, shopHeart: true, swordLevel: 2, coins: 999, plushies: { woods: true } });
  expect([potion, heart, sword, pw, ps].map((it) => shop.check(it, S))).toEqual(['full', 'sold', 'sold', 'sold', 'ok']);
  expect(shop.check(pw, { ...S, plushies: { woods: 1 } })).toBe('ok');   // only a true flag is bought
});

test('a plushie can be bought once: 80 gems, then sold out (the buy flow as ui.js / interact.js run it)', () => {
  const S = boughtOut({ bosses: ALL, coins: 200 });
  const buy = (it) => {   // ui.buySelected → interact.buy
    const why = shop.check(it, S);
    if (why !== 'ok') return why;
    S.coins -= it.price;
    S.plushies = { ...S.plushies, [it.boss]: true };
    return 'ok';
  };
  const [pw, ps, pp] = PLUSHIES;
  expect(buy(pw)).toBe('ok');
  expect(S.coins).toBe(120);
  expect(buy(pw)).toBe('sold');
  expect(S.coins).toBe(120);
  expect(buy(ps)).toBe('ok');
  expect(buy(pp)).toBe('poor');                           // 40 left
  expect(S.coins).toBe(40);
  expect(shop.plushies(S)).toBe(2);
  expect(shop.inStock(S)).toBe(1);
});

test('shop.plushies counts guardian ids set to true only; inStock counts the unbought rows on show', () => {
  expect(shop.plushies(save())).toBe(0);
  expect(shop.plushies(save({ plushies: { woods: true, kraken: true, peaks: 1 } }))).toBe(1);
  expect(shop.plushies({})).toBe(0);
  expect(shop.inStock(save({ bosses: ALL }))).toBe(0);                        // not bought out
  expect(shop.inStock(boughtOut({ bosses: { woods: true } }))).toBe(1);
  expect(shop.inStock(boughtOut({ bosses: ALL, plushies: { woods: true } }))).toBe(2);
  expect(shop.inStock(boughtOut({ bosses: ALL, plushies: ALL }))).toBe(0);
});

test("Miso's lines are unchanged without plushie news", () => {
  const before = ['Mrrow~ Welcome to Miso\'s! Everything on the counter is shiny and nothing is refundable.'];
  const after = ['Mrrow~ The whole isle smells like blossoms now. Business is blooming too!'];
  expect(miso.lines(save())).toEqual(before);
  expect(miso.lines(save({ bosses: ALL, shopHeart: true }))).toEqual(before);          // the sword not sold yet
  expect(miso.lines(boughtOut())).toEqual(before);                                     // bought out, no guardian beaten
  expect(miso.lines(save({ ending: true, bosses: ALL }))).toEqual(after);
  expect(miso.lines(save({ ending: true, bosses: ALL, swordLevel: 2 }))).toEqual(after);
});

test('Miso has a plushie line for in stock, some bought and all three bought', () => {
  const lines = (S) => miso.lines(S);
  const states = {
    stock: boughtOut({ bosses: { woods: true } }),
    some: boughtOut({ bosses: ALL, plushies: { woods: true } }),
    keeping: boughtOut({ bosses: { woods: true }, plushies: { woods: true } }),   // bought the only one in stock
    all: boughtOut({ bosses: ALL, plushies: ALL, ending: true }),
  };
  const seen = new Set();
  for (const S of Object.values(states)) {
    const l = lines(S);
    expect(l).toHaveLength(2);
    for (const s of l) expect(typeof s === 'string' && s.length > 0 && s.length <= 155).toBe(true);
    seen.add(l[1]);
  }
  expect(seen.size).toBe(4);
  expect(lines(states.stock)[1]).toContain('80 gems');
  expect(lines(states.all)[1]).toContain('All three');
  expect(lines(states.all)[0]).toBe('Mrrow~ The whole isle smells like blossoms now. Business is blooming too!');
  for (const S of Object.values(states)) expect(lines(S)[1]).toMatch(/[Mm]rrow|~/);   // her voice
});
