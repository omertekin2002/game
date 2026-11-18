// Keyboard bindings (js/keybinds.js): what a stored `keys` value turns into, the swap on a rebind, the keyboard map
// input.js builds from them, and the code → keycap label. Run with `bun test`. The module is pure (no DOM).
import { describe, expect, test } from 'bun:test';
import {
  KEY_ACTIONS, DEFAULT_KEYS, RESERVED, bindable, sanitizeKeys, effectiveKeys, bindKey, activeSecondary, buildKeymap, keyLabel,
} from '../js/keybinds.js';

describe('defaults', () => {
  test('every rebindable action has its own bindable default key, and pause is not one of them', () => {
    const codes = KEY_ACTIONS.map(([, c]) => c);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(bindable(c), c).toBe(true);
    expect(KEY_ACTIONS.map(([a]) => a)).not.toContain('pause');
    expect(DEFAULT_KEYS).toMatchObject({ up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', map: 'KeyM' });
  });

  test('the fixed keys are reserved', () => {
    for (const c of ['Escape', 'KeyP', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter', 'Tab', 'Backquote']) {
      expect(RESERVED.has(c), c).toBe(true);
      expect(bindable(c), c).toBe(false);
    }
  });
});

describe('sanitizeKeys: a stored value', () => {
  test('a valid one is kept as is', () => {
    expect(sanitizeKeys({ jump: 'KeyT', map: 'Digit1' })).toEqual({ jump: 'KeyT', map: 'Digit1' });
  });

  test('anything that is no plain object gives no bindings', () => {
    for (const junk of [null, undefined, 7, 'KeyT', true, [], ['KeyT'], () => 1]) expect(sanitizeKeys(junk)).toEqual({});
  });

  test('wrong types, unknown actions, odd codes and reserved keys are dropped, per action', () => {
    const k = sanitizeKeys({
      jump: 7, attack: null, dash: { code: 'KeyT' }, potion: ['KeyT'], view: '', shoulder: 'Key T', lockOn: '<script>',
      interact: 'Escape', up: 'ArrowUp', down: 'KeyP', left: 'Tab', right: 'Backquote', pause: 'KeyT', sprint: 'KeyT',
      __proto__: { map: 'KeyZ' }, map: 'KeyL',
    });
    expect(k).toEqual({ map: 'KeyL' });
    expect(sanitizeKeys({ jump: 'x'.repeat(40) })).toEqual({});
  });

  test('a stored key equal to the default is not kept', () => {
    expect(sanitizeKeys({ jump: 'Space', dash: 'ShiftLeft' })).toEqual({});
  });

  test('two actions on one key both fall back to their defaults', () => {
    expect(sanitizeKeys({ jump: 'KeyT', attack: 'KeyT', map: 'KeyL' })).toEqual({ map: 'KeyL' });
  });

  test('a stored key that is another action\'s default falls back, and so does what that frees up', () => {
    expect(sanitizeKeys({ jump: 'KeyE' })).toEqual({});                       // E is interact's default
    // up on J (attack's default): up falls back to W; nothing else shares a key
    expect(sanitizeKeys({ up: 'KeyJ', map: 'KeyL' })).toEqual({ map: 'KeyL' });
    // a swap that is stored whole is fine
    expect(sanitizeKeys({ jump: 'KeyE', interact: 'Space' })).toEqual({ jump: 'KeyE', interact: 'Space' });
    // dropping jump (back to Space) makes it clash with interact on Space: both go back
    expect(sanitizeKeys({ jump: 'KeyR', interact: 'Space' })).toEqual({});
  });

  test('the result is frozen and never shares the input', () => {
    const raw = { jump: 'KeyT' }, k = sanitizeKeys(raw);
    expect(Object.isFrozen(k)).toBe(true);
    raw.jump = 'KeyY';
    expect(k.jump).toBe('KeyT');
  });

  test('effectiveKeys fills in the defaults', () => {
    expect(effectiveKeys({ jump: 'KeyT' })).toEqual({ ...DEFAULT_KEYS, jump: 'KeyT' });
    expect(effectiveKeys(undefined)).toEqual({ ...DEFAULT_KEYS });
  });
});

describe('bindKey', () => {
  test('a free key is bound', () => {
    expect(bindKey({}, 'jump', 'KeyT')).toEqual({ keys: { jump: 'KeyT' }, swapped: null, error: null });
  });

  test('a key another action has swaps the two', () => {
    const r = bindKey({}, 'jump', 'KeyE');
    expect(r.swapped).toBe('interact');
    expect(r.keys).toEqual({ jump: 'KeyE', interact: 'Space' });
    // swapping back to the defaults stores nothing
    expect(bindKey(r.keys, 'interact', 'KeyE')).toEqual({ keys: {}, swapped: 'jump', error: null });
  });

  test('binding an action back to its own default drops it from storage', () => {
    expect(bindKey({ jump: 'KeyT', map: 'KeyL' }, 'jump', 'Space').keys).toEqual({ map: 'KeyL' });
  });

  test('its own key again changes nothing', () => {
    expect(bindKey({ jump: 'KeyT' }, 'jump', 'KeyT')).toEqual({ keys: { jump: 'KeyT' }, swapped: null, error: null });
  });

  test('reserved keys and unknown actions are refused and leave the bindings alone', () => {
    for (const c of ['Escape', 'KeyP', 'ArrowLeft', 'Enter', 'Tab', 'Backquote', '', null]) {
      expect(bindKey({ jump: 'KeyT' }, 'map', c)).toEqual({ keys: { jump: 'KeyT' }, swapped: null, error: 'reserved' });
    }
    expect(bindKey({}, 'pause', 'KeyT').error).toBe('unknown');
    expect(bindKey({}, 'sprint', 'KeyT').error).toBe('unknown');
  });
});

describe('buildKeymap', () => {
  test('defaults: the old fixed map, sprint on every roll key', () => {
    const { map, held } = buildKeymap({});
    expect(map).toEqual({
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      KeyJ: 'attack', Space: 'jump', KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
      KeyE: 'interact', KeyF: 'interact', Enter: 'interact', NumpadEnter: 'interact', KeyR: 'potion', KeyV: 'view', KeyX: 'shoulder', KeyQ: 'lockOn',
      KeyM: 'map', Tab: 'map', Escape: 'pause', KeyP: 'pause',
    });
    expect(held).toEqual({ KeyK: 'sprint', ShiftLeft: 'sprint', ShiftRight: 'sprint' });
  });

  test('a rebound action leaves its old key and its extra keys; the fixed keys stay', () => {
    const { map, held } = buildKeymap({ jump: 'KeyT', dash: 'KeyG', map: 'KeyL', interact: 'KeyH' });
    expect(map.KeyT).toBe('jump');
    expect(map.Space).toBeUndefined();
    expect(map.KeyG).toBe('dash');
    for (const c of ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyF', 'Tab', 'KeyE', 'KeyM']) expect(map[c], c).toBeUndefined();
    expect(held).toEqual({ KeyG: 'sprint' });
    expect(map.KeyL).toBe('map');
    expect(map.KeyH).toBe('interact');
    expect([map.Enter, map.NumpadEnter, map.Escape, map.KeyP, map.ArrowUp]).toEqual(['interact', 'interact', 'pause', 'pause', 'up']);
  });

  test('a key bound to an action wins over another action\'s extra key', () => {
    const k = { jump: 'KeyK', attack: 'KeyF' };
    expect(activeSecondary(k)).toEqual({ dash: ['ShiftRight'], interact: [], map: ['Tab'] });
    const { map, held } = buildKeymap(k);
    expect(map.KeyK).toBe('jump');
    expect(map.KeyF).toBe('attack');
    expect(held).toEqual({ ShiftLeft: 'sprint', ShiftRight: 'sprint' });
  });
});

describe('keyLabel', () => {
  test('short names for codes', () => {
    const cases = {
      KeyT: 'T', Digit1: '1', Numpad1: 'Num 1', NumpadAdd: 'Num +', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl',
      AltLeft: 'Alt', Space: 'Space', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[',
      Minus: '-', Equal: '=', F5: 'F5', CapsLock: 'Caps Lock', ArrowUp: '↑', Escape: 'Esc', SomethingNew: 'SomethingNew',
    };
    for (const [c, l] of Object.entries(cases)) expect(keyLabel(c), c).toBe(l);
    expect(keyLabel(undefined)).toBe('');
  });
});
