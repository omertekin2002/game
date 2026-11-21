// Player settings (js/settings.js): defaults, what happens to whatever is found in storage, set / reset and what is
// written back. Run with `bun test`.
// The module (through js/core.js) reads `window`, `location` and `localStorage` when it is imported, so small stand-ins
// are installed first and taken away again after the last test.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

const NAMES = ['window', 'location', 'localStorage'];
const data = new Map();
let media = {};                       // media query → matches
let size = [1280, 720];
let listeners = {};                   // window event → the listeners added for it
let before = [];
let SETTINGS_KEY, SCHEMA, Settings, DEFAULTS;

// Set up and torn down together (a run that filters every test of this file out with -t skips both)
beforeAll(async () => {
  before = NAMES.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]);
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
  globalThis.location = { search: '' };
  globalThis.window = {
    matchMedia: (q) => ({ matches: !!media[q] }),
    addEventListener(type, fn) { (listeners[type] || (listeners[type] = [])).push(fn); },
    get innerWidth() { return size[0]; },
    get innerHeight() { return size[1]; },
  };
  ({ SETTINGS_KEY, SCHEMA, Settings } = await import('../js/settings.js'));
  DEFAULTS = Object.fromEntries(Object.entries(SCHEMA).map(([k, sc]) => [k, sc.def]));
});
afterAll(() => {
  for (const [n, d] of before) { if (d) Object.defineProperty(globalThis, n, d); else delete globalThis[n]; }
});
beforeEach(() => { data.clear(); media = {}; size = [1280, 720]; listeners = {}; });

const stored = () => JSON.parse(data.get(SETTINGS_KEY) ?? 'null');
const put = (v) => data.set(SETTINGS_KEY, typeof v === 'string' ? v : JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('schema', () => {
  test('every default is a value its own rule accepts', () => {
    for (const [k, sc] of Object.entries(SCHEMA)) {
      if (sc.obj) expect(sc.obj(sc.def), k).toEqual(sc.def);             // an object-valued key (keys)
      else if (sc.opts) expect(sc.opts, k).toContain(sc.def);
      else if (typeof sc.def === 'number') {
        expect(sc.min, k).toBeLessThanOrEqual(sc.def);
        expect(sc.max, k).toBeGreaterThanOrEqual(sc.def);
        expect(sc.step, k).toBeGreaterThan(0);
      } else expect(typeof sc.def, k).toBe('boolean');
    }
  });
});

describe('defaults', () => {
  test('nothing stored: every setting has its default, and nothing is written', () => {
    const s = new Settings();
    expect(s.all()).toEqual(DEFAULTS);
    expect(s.get('view')).toBe('fp');
    expect(s.get('quality')).toBe('auto');
    expect(s.get('invertX')).toBe(false);
    expect(s.get('padInvertX')).toBe(false);
    expect(data.has(SETTINGS_KEY)).toBe(false);
  });

  test('the device sets two of them: reduced motion asked by the system, third person on a phone held upright', () => {
    media = { '(prefers-reduced-motion: reduce)': true };
    expect(new Settings().get('reduceMotion')).toBe(true);
    media = { '(pointer: coarse)': true };
    size = [390, 844];
    expect(new Settings().get('view')).toBe('tp');
    size = [844, 390];                                      // the same phone on its side
    expect(new Settings().get('view')).toBe('fp');
    media = {};
    size = [390, 844];                                      // a narrow desktop window is not a phone
    expect(new Settings().get('view')).toBe('fp');
  });

  test('a device default is not stored, and the player can still choose against it', () => {
    media = { '(prefers-reduced-motion: reduce)': true };
    const s = new Settings();
    s.set('reduceMotion', false);
    s.flush();
    expect(stored()).toEqual({ v: 1, reduceMotion: false });
    expect(new Settings().get('reduceMotion')).toBe(false);
    s.set('reduceMotion', true);                            // back to this device's default: nothing left to store
    s.flush();
    expect(stored()).toEqual({ v: 1 });
  });
});

describe('what is found in storage', () => {
  test('anything that is not a settings object gives the defaults and never throws', () => {
    for (const junk of ['{not json', '[]', '[1,2]', '7', '"quality"', 'null', 'true', '']) {
      put(junk);
      expect(new Settings().all(), junk).toEqual(DEFAULTS);
    }
  });

  test('numbers are clamped to their range and put on the nearest step', () => {
    put({ fovFP: 9999, fovTP: -4, padSens: '1.5', touchSens: ' 0.75 ', musicVol: -3, hudScale: 1.07, shake: 1.08 / 2, sfxVol: 0.15, ambVol: 0.35, headBob: 0.7 });
    const s = new Settings();
    expect(s.get('fovFP')).toBe(SCHEMA.fovFP.max);
    expect(s.get('fovTP')).toBe(SCHEMA.fovTP.min);
    expect(s.get('padSens')).toBe(1.5);                     // a number may arrive as text
    expect(s.get('touchSens')).toBe(0.75);
    expect(s.get('musicVol')).toBe(0);
    expect(s.get('hudScale')).toBe(1.05);                   // 1.07 is nearer 1.05 than 1.1
    expect(s.get('shake')).toBe(0.55);                      // 0.54 is nearer 0.55 than 0.5
    expect(s.get('sfxVol')).toBe(0.15);                     // exactly on a step: no float dust (0.15000000000000002)
    expect(s.get('ambVol')).toBe(0.35);
    expect(s.get('headBob')).toBe(0.7);
  });

  test('what is no number keeps the default instead of becoming 0 or 1', () => {
    const junk = { sens: 'fast', headBob: null, shake: '', sfxVol: '   ', musicVol: false, ambVol: true, fovFP: [], fovTP: [95], hudScale: {}, padSens: 'NaN', touchSens: Infinity };
    put(junk);
    const s = new Settings();
    for (const k of Object.keys(junk)) expect(s.get(k), k).toBe(SCHEMA[k].def);
    expect(s.set('musicVol', false)).toBe(SCHEMA.musicVol.def);
    expect(s.set('sens', [])).toBe(SCHEMA.sens.def);
  });

  test('choices must be one of their values', () => {
    put({ quality: 'ultra', view: 'top-down', minimap: 'north', crosshair: 3, textSpeed: '90', lockMode: 'hold' });
    const s = new Settings();
    expect(s.get('quality')).toBe('auto');
    expect(s.get('view')).toBe('fp');
    expect(s.get('minimap')).toBe('north');
    expect(s.get('crosshair')).toBe(SCHEMA.crosshair.def);
    expect(s.get('textSpeed')).toBe(90);                    // a numeric choice may arrive as text
    expect(s.get('lockMode')).toBe('hold');
  });

  test('switches take true / false (also 1 / 0 and their text forms), nothing else', () => {
    put({ invertY: true, invertX: 1, padInvertY: 'true', padInvertX: 'maybe', lockTurnsCamera: 'false', cameraRoll: 0, dynRes: 'off', tpAutoRecenter: {}, dialogueLookAt: 2 });
    const s = new Settings();
    expect(s.get('invertY')).toBe(true);
    expect(s.get('invertX')).toBe(true);
    expect(s.get('padInvertY')).toBe(true);
    expect(s.get('padInvertX')).toBe(false);
    expect(s.get('lockTurnsCamera')).toBe(false);           // these three are on by default: the stored value won
    expect(s.get('cameraRoll')).toBe(false);
    expect(s.get('dynRes')).toBe(true);                     // and these three kept their default (on)
    expect(s.get('tpAutoRecenter')).toBe(true);
    expect(s.get('dialogueLookAt')).toBe(true);
  });

  test('keys this build does not know are kept and written back (a newer build may own them)', () => {
    put({ v: 1, quality: 'low', someFutureSetting: { a: 1 }, musicVolume: 0.35 });
    const s = new Settings();
    expect(s.get('quality')).toBe('low');
    expect(s.get('someFutureSetting')).toBeUndefined();     // unknown keys are not settings of this build
    s.set('sens', 2);
    s.flush();
    expect(stored()).toEqual({ v: 1, quality: 'low', someFutureSetting: { a: 1 }, musicVolume: 0.35, sens: 2 });
  });
});

describe('set and reset', () => {
  test('set clamps, returns the value in effect, and refuses what cannot be made valid', () => {
    const s = new Settings();
    expect(s.set('sens', 99)).toBe(SCHEMA.sens.max);
    expect(s.set('sens', 'fast')).toBe(SCHEMA.sens.max);    // refused: the value set before stays
    expect(s.set('quality', 'high')).toBe('high');
    expect(s.set('quality', 'ultra')).toBe('high');
    expect(s.set('invertX', true)).toBe(true);
    expect(s.set('invertX', 'maybe')).toBe(true);
    expect(s.get('quality')).toBe('high');
    expect(s.get('invertX')).toBe(true);
    expect(s.set('noSuchSetting', 1)).toBeUndefined();
    expect(s.get('noSuchSetting')).toBeUndefined();
    s.flush();
  });

  test('a change reaches storage by itself a moment later, a reset too, and at once when the page is hidden', async () => {
    const s = new Settings();
    s.set('fovFP', 110);
    expect(data.has(SETTINGS_KEY)).toBe(false);             // debounced: sliders write once, not per step
    await sleep(400);
    expect(stored()).toEqual({ v: 1, fovFP: 110 });
    s.reset('fovFP');
    await sleep(400);
    expect(stored()).toEqual({ v: 1 });
    s.set('quality', 'low');
    expect(listeners.pagehide.length).toBeGreaterThan(0);
    for (const fn of listeners.pagehide) fn();              // every store made in this test listens; all share the data
    expect(stored()).toEqual({ v: 1, quality: 'low' });
  });

  test('listeners hear a change once, on the key and on *; a set to the same value is silent', () => {
    const s = new Settings(), heard = [];
    const off = s.on('invertX', (v, k) => heard.push(['key', k, v]));
    s.on('*', (v, k) => heard.push(['any', k, v]));
    s.set('invertX', true);
    s.set('invertX', true);
    s.set('fovFP', 90);
    expect(heard).toEqual([['key', 'invertX', true], ['any', 'invertX', true], ['any', 'fovFP', 90]]);
    off();
    s.set('invertX', false);
    expect(heard.at(-1)).toEqual(['any', 'invertX', false]);
    expect(heard.length).toBe(4);
    s.flush();
  });

  test('a throwing listener does not stop the others or the change', () => {
    const s = new Settings(), heard = [], err = console.error;
    console.error = () => {};
    try {
      s.on('shake', () => { throw new Error('listener'); });
      s.on('shake', (v) => heard.push(v));
      expect(s.set('shake', 0.5)).toBe(0.5);
    } finally { console.error = err; }
    expect(heard).toEqual([0.5]);
    s.flush();
  });

  test('only what differs from the default is stored, and it comes back on the next load', () => {
    const s = new Settings();
    s.set('fovFP', 110); s.set('invertX', true); s.set('quality', 'low'); s.set('musicVol', 0.4);
    s.set('sens', 2); s.set('sens', SCHEMA.sens.def);       // back to the default: not stored
    s.flush();
    expect(stored()).toEqual({ v: 1, fovFP: 110, invertX: true, quality: 'low', musicVol: 0.4 });
    const again = new Settings();
    expect(again.get('fovFP')).toBe(110);
    expect(again.get('invertX')).toBe(true);
    expect(again.get('quality')).toBe('low');
    expect(again.get('musicVol')).toBe(0.4);
    expect(again.get('sens')).toBe(SCHEMA.sens.def);
  });

  test('reset puts one setting, or all of them, back and tells the listeners', () => {
    const s = new Settings(), heard = [];
    s.set('fovFP', 110); s.set('invertX', true); s.set('quality', 'low');
    s.on('*', (v, k) => heard.push([k, v]));
    s.reset('fovFP');
    expect(s.get('fovFP')).toBe(SCHEMA.fovFP.def);
    expect(s.get('invertX')).toBe(true);
    s.reset();
    expect(s.all()).toEqual(DEFAULTS);
    expect(heard).toEqual([['fovFP', SCHEMA.fovFP.def], ['invertX', false], ['quality', 'auto']]);
    s.flush();
    expect(stored()).toEqual({ v: 1 });
  });
});

describe('key bindings (the one object-valued setting)', () => {
  test('a stored binding comes back; a corrupt one falls back per action and is cleaned on the next write', () => {
    put({ v: 1, keys: { jump: 'KeyT', attack: 7, map: 'Escape', potion: 'KeyV', nope: 'KeyZ' }, quality: 'low' });
    const s = new Settings();
    expect(s.get('keys')).toEqual({ jump: 'KeyT' });       // potion on V clashed with view: back to R
    expect(s.get('quality')).toBe('low');
    s.set('sens', 2);
    s.flush();
    expect(stored()).toEqual({ v: 1, keys: { jump: 'KeyT' }, quality: 'low', sens: 2 });
  });

  test('whatever is no object, or holds nothing usable, gives the default keys and is not kept', () => {
    for (const junk of ['KeyT', 7, [], ['KeyT'], null, true, { jump: 'Escape' }, { jump: 'Space' }]) {
      put({ v: 1, keys: junk });
      const s = new Settings();
      expect(s.get('keys'), JSON.stringify(junk)).toEqual({});
      s.set('sens', 2);
      s.flush();
      expect(stored(), JSON.stringify(junk)).toEqual({ v: 1, sens: 2 });
    }
  });

  test('set stores only the changed actions, tells the listeners once, and a set to the same bindings is silent', () => {
    const s = new Settings(), heard = [];
    s.on('keys', (v) => heard.push(v));
    expect(s.set('keys', { jump: 'KeyT', map: 'Tab' })).toEqual({ jump: 'KeyT' });   // Tab is reserved
    expect(s.set('keys', { jump: 'KeyT' })).toEqual({ jump: 'KeyT' });
    expect(heard).toEqual([{ jump: 'KeyT' }]);
    expect(s.set('keys', 'KeyT')).toEqual({ jump: 'KeyT' });                          // refused: the bindings stay
    s.flush();
    expect(stored()).toEqual({ v: 1, keys: { jump: 'KeyT' } });
    expect(new Settings().get('keys')).toEqual({ jump: 'KeyT' });
    s.set('keys', {});
    s.flush();
    expect(stored()).toEqual({ v: 1 });
    expect(heard).toEqual([{ jump: 'KeyT' }, {}]);
  });

  test('reset brings the default keys back and tells the listeners', () => {
    const s = new Settings(), heard = [];
    s.set('keys', { jump: 'KeyT' });
    s.on('*', (v, k) => heard.push([k, v]));
    s.reset('keys');
    expect(s.get('keys')).toEqual({});
    s.reset('keys');                                         // nothing left to reset: silent
    expect(heard).toEqual([['keys', {}]]);
    s.flush();
    expect(stored()).toEqual({ v: 1 });
  });
});

describe('controller buttons (object-valued setting `pad`)', () => {
  test('a stored binding comes back; a corrupt one falls back per action and is cleaned on the next write', () => {
    put({ v: 1, pad: { jump: 3, interact: 0, attack: '7', map: 9, lockOn: 40, potion: 5, nope: 2 }, quality: 'low' });
    const s = new Settings();
    expect(s.get('pad')).toEqual({ jump: 3, interact: 0 });   // potion on RB clashed with view: back to LB
    s.set('sens', 2);
    s.flush();
    expect(stored()).toEqual({ v: 1, pad: { jump: 3, interact: 0 }, quality: 'low', sens: 2 });
  });

  test('whatever is no object, or holds nothing usable, gives the default buttons and is not kept', () => {
    for (const junk of ['3', 7, [], [3], null, true, { jump: 9 }, { jump: 0 }, { jump: 3, attack: 3 }]) {
      put({ v: 1, pad: junk });
      const s = new Settings();
      expect(s.get('pad'), JSON.stringify(junk)).toEqual({});
      s.set('sens', 2);
      s.flush();
      expect(stored(), JSON.stringify(junk)).toEqual({ v: 1, sens: 2 });
    }
  });

  test('set notifies once and persists; reset brings the defaults back next to the keys', () => {
    const s = new Settings(), heard = [];
    s.on('pad', (v) => heard.push(v));
    expect(s.set('pad', { jump: 7, map: 9 })).toEqual({ jump: 7 });                 // Start is reserved
    expect(s.set('pad', { jump: 7 })).toEqual({ jump: 7 });
    expect(heard).toEqual([{ jump: 7 }]);
    s.set('keys', { jump: 'KeyT' });
    s.flush();
    expect(stored()).toEqual({ v: 1, pad: { jump: 7 }, keys: { jump: 'KeyT' } });
    expect(new Settings().get('pad')).toEqual({ jump: 7 });
    s.reset('pad'); s.reset('keys');
    expect([s.get('pad'), s.get('keys')]).toEqual([{}, {}]);
    expect(heard).toEqual([{ jump: 7 }, {}]);
    s.flush();
    expect(stored()).toEqual({ v: 1 });
  });
});
