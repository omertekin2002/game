// Controller bindings (js/padbinds.js): what a stored `pad` value turns into, the swap on a rebind, the button maps
// input.js builds from them (with the secondary buttons), the menus' fixed layout, and the index → label names. Run with
// `bun test`. The module is pure (no DOM).
import { describe, expect, test } from 'bun:test';
import {
  PAD_ACTIONS, DEFAULT_PAD, PAD_RESERVED, PAD_BUTTONS, MENU_PADMAP, padBindable, sanitizePad, effectivePad, bindPad,
  activePadSecondary, buildPadmap, padLabel,
} from '../js/padbinds.js';

describe('defaults', () => {
  test('every rebindable action has its own bindable default button: the standard layout', () => {
    const idx = PAD_ACTIONS.map(([, i]) => i);
    expect(new Set(idx).size).toBe(idx.length);
    for (const i of idx) expect(padBindable(i), String(i)).toBe(true);
    expect(PAD_ACTIONS.map(([a]) => a)).not.toContain('pause');
    expect({ ...DEFAULT_PAD }).toEqual({
      jump: 0, dash: 1, attack: 2, interact: 3, potion: 4, view: 5, shoulder: 14, lockOn: 11, lockHold: 6, sprintToggle: 10, map: 8,
    });
  });

  test('Start and Home are reserved; out-of-range and non-integer indices are not buttons', () => {
    expect([...PAD_RESERVED].sort()).toEqual([16, 9].sort());
    for (const i of [9, 16, -1, 17, 99, 1.5, NaN, '3', null, undefined, true, [3]]) expect(padBindable(i), String(i)).toBe(false);
    for (let i = 0; i < PAD_BUTTONS; i++) expect(padBindable(i), String(i)).toBe(i !== 9 && i !== 16);
  });
});

describe('sanitizePad: a stored value', () => {
  test('a valid one is kept as is', () => {
    expect(sanitizePad({ jump: 7, map: 12 })).toEqual({ jump: 7, map: 12 });
  });

  test('anything that is no plain object gives no bindings', () => {
    for (const junk of [null, undefined, 7, '3', true, [], [3], () => 1]) expect(sanitizePad(junk)).toEqual({});
  });

  test('wrong types, unknown actions, reserved and out-of-range indices are dropped, per action', () => {
    const p = sanitizePad({
      jump: '7', attack: null, dash: { i: 7 }, potion: [7], view: 1.5, shoulder: -1, lockOn: 17, lockHold: NaN,
      interact: 9, sprintToggle: 16, pause: 7, sprint: 7, navUp: 7, __proto__: { map: 13 }, map: 15,
    });
    expect(p).toEqual({ map: 15 });
  });

  test('a stored button equal to the default is not kept', () => {
    expect(sanitizePad({ jump: 0, dash: 1, lockHold: 6 })).toEqual({});
  });

  test('two actions on one button both fall back to their defaults (repeated until nothing is shared)', () => {
    expect(sanitizePad({ jump: 7, attack: 7, map: 12 })).toEqual({ map: 12 });
    expect(sanitizePad({ jump: 3 })).toEqual({});                          // Y is interact's default
    expect(sanitizePad({ jump: 3, interact: 0 })).toEqual({ jump: 3, interact: 0 });   // a swap stored whole is fine
    expect(sanitizePad({ jump: 4, interact: 0 })).toEqual({});              // jump drops (LB is potion's), then interact clashes on A
  });

  test('the result is frozen and never shares the input; effectivePad fills in the defaults', () => {
    const raw = { jump: 7 }, p = sanitizePad(raw);
    expect(Object.isFrozen(p)).toBe(true);
    raw.jump = 12;
    expect(p.jump).toBe(7);
    expect(effectivePad({ jump: 7 })).toEqual({ ...DEFAULT_PAD, jump: 7 });
    expect(effectivePad(undefined)).toEqual({ ...DEFAULT_PAD });
  });
});

describe('bindPad', () => {
  test('a free button is bound', () => {
    expect(bindPad({}, 'jump', 7)).toEqual({ pad: { jump: 7 }, swapped: null, error: null });
  });

  test('a button another action has swaps the two', () => {
    const r = bindPad({}, 'jump', 3);
    expect(r.swapped).toBe('interact');
    expect(r.pad).toEqual({ jump: 3, interact: 0 });
    expect(bindPad(r.pad, 'interact', 3)).toEqual({ pad: {}, swapped: 'jump', error: null });   // back to the defaults
  });

  test('binding an action back to its own default drops it from storage; its own button again changes nothing', () => {
    expect(bindPad({ jump: 7, map: 12 }, 'jump', 0).pad).toEqual({ map: 12 });
    expect(bindPad({ jump: 7 }, 'jump', 7)).toEqual({ pad: { jump: 7 }, swapped: null, error: null });
  });

  test('reserved buttons and unknown actions are refused and leave the bindings alone', () => {
    for (const i of [9, 16, 17, -1, 2.5, '0', null]) expect(bindPad({ jump: 7 }, 'map', i)).toEqual({ pad: { jump: 7 }, swapped: null, error: 'reserved' });
    expect(bindPad({}, 'pause', 7).error).toBe('unknown');
    expect(bindPad({}, 'sprint', 7).error).toBe('unknown');
  });
});

describe('buildPadmap', () => {
  const at = (map) => Object.fromEntries(map.map((a, i) => [i, a]).filter(([, a]) => a));
  test('defaults: the old fixed map (X / RT attack, LB / D↓ potion, RB / D↑ view, D← / D→ shoulder), sprint on B, lock hold on LT', () => {
    const { map, held } = buildPadmap({});
    expect(map.length).toBe(PAD_BUTTONS);
    expect(at(map)).toEqual({
      0: 'jump', 1: 'dash', 2: 'attack', 7: 'attack', 3: 'interact', 4: 'potion', 13: 'potion', 5: 'view', 12: 'view',
      11: 'lockOn', 10: 'sprintToggle', 14: 'shoulder', 15: 'shoulder', 8: 'map', 9: 'pause',
    });
    expect(held[1]).toEqual(['sprint']);
    expect(held[6]).toEqual(['lockHold']);
    expect(held.filter((h) => h.length).length).toBe(2);
    expect(MENU_PADMAP).toEqual(map);
  });

  test('a rebound action leaves its old button and its extra buttons; Start stays pause', () => {
    const { map, held } = buildPadmap({ attack: 12, dash: 3, interact: 1 });
    expect(map[12]).toBe('attack');
    expect(map[2]).toBeNull();
    expect(map[7]).toBeNull();                               // RT went with the default X
    expect(map[3]).toBe('dash');
    expect(map[1]).toBe('interact');
    expect(held[3]).toEqual(['sprint']);
    expect(held[1]).toEqual([]);
    expect(map[9]).toBe('pause');
    expect(activePadSecondary({ attack: 12, dash: 3, interact: 1 })).toEqual({ attack: [], potion: [13], view: [], shoulder: [15] });
  });

  test('a button bound to an action wins over another action\'s extra button', () => {
    const p = { jump: 7, map: 13 };
    expect(activePadSecondary(p)).toEqual({ attack: [], potion: [], view: [12], shoulder: [15] });
    const { map } = buildPadmap(p);
    expect([map[7], map[13], map[0], map[8]]).toEqual(['jump', 'map', null, null]);
  });

  test('lock hold moved: the new button only holds it (no press edge), the old LT is free', () => {
    const { map, held } = buildPadmap({ lockHold: 7, attack: 6 });
    expect(held[7]).toEqual(['lockHold']);
    expect(map[7]).toBeNull();
    expect(map[6]).toBe('attack');
    expect(held[6]).toEqual([]);
  });

  test('the menus\' map never changes with the bindings', () => {
    const before = JSON.stringify(MENU_PADMAP);
    buildPadmap({ jump: 3, interact: 0 });
    expect(JSON.stringify(MENU_PADMAP)).toBe(before);
    expect(Object.isFrozen(MENU_PADMAP)).toBe(true);
  });
});

describe('padLabel', () => {
  test('standard-mapping names', () => {
    const cases = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 10: 'L3', 11: 'R3', 12: 'D-pad ↑', 13: 'D-pad ↓', 14: 'D-pad ←', 15: 'D-pad →', 16: 'Home' };
    for (const [i, l] of Object.entries(cases)) expect(padLabel(+i), i).toBe(l);
    expect(padLabel(20)).toBe('Button 20');
    expect(padLabel(undefined)).toBe('Button undefined');
  });
});
