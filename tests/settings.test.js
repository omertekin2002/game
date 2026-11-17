// Player settings: defaults, sanitizing, stepping and the camera / flash helpers (js/settings.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import {
  BOOLS, DEFAULT_SETTINGS, ENUMS, FLASH_CAP, RANGES, SETTINGS_VERSION,
  camScale, capFlash, defaultSettings, qualityProfile, sanitizeSettings, stepSetting,
} from '../js/settings.js';

const KEYS = ['v', ...Object.keys(RANGES), ...BOOLS, ...Object.keys(ENUMS)].sort();
const roundTrip = (s) => JSON.parse(JSON.stringify(s));

function expectValid(s) {
  expect(Object.keys(s).sort()).toEqual(KEYS);
  expect(s.v).toBe(SETTINGS_VERSION);
  for (const [k, r] of Object.entries(RANGES)) {
    expect(Number.isFinite(s[k])).toBe(true);
    expect(s[k]).toBeGreaterThanOrEqual(r.min);
    expect(s[k]).toBeLessThanOrEqual(r.max);
  }
  for (const k of BOOLS) expect(typeof s[k]).toBe('boolean');
  for (const [k, vals] of Object.entries(ENUMS)) expect(vals).toContain(s[k]);
}

describe('defaults', () => {
  test('match the audio defaults, sensitivity 1, no invert', () => {
    expect(defaultSettings()).toEqual({
      v: SETTINGS_VERSION, musicVolume: 0.35, sfxVolume: 0.7, camSensitivity: 1,
      invertCamX: false, invertCamY: false, reducedMotion: false, quality: 'high',
    });
    expect(DEFAULT_SETTINGS).toEqual(defaultSettings(false));
    expectValid(DEFAULT_SETTINGS);
  });
  test('reduced motion follows the OS preference passed in', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true);
    expect(sanitizeSettings(null, defaultSettings(true)).reducedMotion).toBe(true);
    expect(sanitizeSettings({ reducedMotion: false }, defaultSettings(true)).reducedMotion).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  test('valid settings pass through unchanged', () => {
    const s = { v: 1, musicVolume: 0.2, sfxVolume: 1, camSensitivity: 1.75, invertCamX: true, invertCamY: false, reducedMotion: true, quality: 'medium' };
    expect(sanitizeSettings(s)).toEqual(s);
  });
  test('garbage, null, arrays and primitives give the defaults without throwing', () => {
    for (const raw of [undefined, null, 0, 1, NaN, '', 'x', '{"musicVolume":0}', true, [], [1, 2], () => 1]) {
      expect(sanitizeSettings(raw)).toEqual(defaultSettings());
    }
  });
  test('out-of-range numbers are clamped', () => {
    const s = sanitizeSettings({ musicVolume: -3, sfxVolume: 7, camSensitivity: 0.1 });
    expect([s.musicVolume, s.sfxVolume, s.camSensitivity]).toEqual([0, 1, 0.5]);
    expect(sanitizeSettings({ camSensitivity: 99 }).camSensitivity).toBe(2);
    expect(sanitizeSettings({ musicVolume: Infinity }).musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
  });
  test('NaN, strings, null, arrays and objects in every field fall back to the default', () => {
    for (const bad of [NaN, '0.5', 'true', null, [], [1], {}, { a: 1 }, undefined]) {
      const raw = {};
      for (const k of [...Object.keys(RANGES), ...BOOLS, ...Object.keys(ENUMS)]) raw[k] = bad;
      expect(sanitizeSettings(raw)).toEqual(defaultSettings());
    }
  });
  test('booleans do not accept numbers for numbers or vice versa', () => {
    const s = sanitizeSettings({ musicVolume: true, invertCamX: 1, reducedMotion: 'yes' });
    expect(s.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(s.invertCamX).toBe(false);
    expect(s.reducedMotion).toBe(false);
  });
  test('unknown keys are dropped', () => {
    const s = sanitizeSettings({ musicVolume: 0.5, cheat: true, __proto__x: 1, graphics: 'ultra' });
    expectValid(s);
    expect(s.musicVolume).toBe(0.5);
  });
  test('a missing or newer v keeps the known fields and is stamped with the current version', () => {
    expect(sanitizeSettings({ sfxVolume: 0.3 })).toEqual({ ...defaultSettings(), sfxVolume: 0.3 });
    const newer = sanitizeSettings({ v: 99, sfxVolume: 0.3, invertCamY: true, fancy: 1 });
    expect(newer).toEqual({ ...defaultSettings(), sfxVolume: 0.3, invertCamY: true });
    expect(sanitizeSettings({ v: 'x' }).v).toBe(SETTINGS_VERSION);
  });
  test('sanitize → JSON → sanitize is stable', () => {
    const inputs = [null, {}, { musicVolume: 0.123456789, camSensitivity: 3, invertCamX: true }, { v: 99, sfxVolume: -1, reducedMotion: true }];
    for (const raw of inputs) {
      const a = sanitizeSettings(raw);
      const b = sanitizeSettings(roundTrip(a));
      expect(b).toEqual(a);
      expectValid(b);
    }
  });
  test('bad defaults fall back to the built-in defaults', () => {
    expect(sanitizeSettings(null, null)).toEqual(defaultSettings());
  });
});

describe('stepSetting', () => {
  test('volumes move to the next 10% step, starting from the off-grid default', () => {
    expect(stepSetting(DEFAULT_SETTINGS, 'musicVolume', 1).musicVolume).toBe(0.4);
    expect(stepSetting(DEFAULT_SETTINGS, 'musicVolume', -1).musicVolume).toBe(0.3);
    expect(stepSetting({ ...DEFAULT_SETTINGS, sfxVolume: 0.4 }, 'sfxVolume', 1).sfxVolume).toBe(0.5);
    let s = { ...DEFAULT_SETTINGS, sfxVolume: 0 };
    for (let i = 0; i < 10; i++) s = stepSetting(s, 'sfxVolume', 1);
    expect(s.sfxVolume).toBe(1);
  });
  test('clamps at the ends, or wraps when asked', () => {
    const top = { ...DEFAULT_SETTINGS, camSensitivity: 2, musicVolume: 0 };
    expect(stepSetting(top, 'camSensitivity', 1).camSensitivity).toBe(2);
    expect(stepSetting(top, 'camSensitivity', 1, true).camSensitivity).toBe(0.5);
    expect(stepSetting(top, 'musicVolume', -1).musicVolume).toBe(0);
    expect(stepSetting(top, 'musicVolume', -1, true).musicVolume).toBe(1);
    expect(stepSetting(DEFAULT_SETTINGS, 'camSensitivity', 1).camSensitivity).toBe(1.25);
  });
  test('booleans toggle and the input is not mutated', () => {
    const s = { ...DEFAULT_SETTINGS };
    const t = stepSetting(s, 'invertCamX', 1);
    expect(t.invertCamX).toBe(true);
    expect(s.invertCamX).toBe(false);
    expect(stepSetting(t, 'invertCamX', -1).invertCamX).toBe(false);
  });
  test('graphics quality moves one preset at a time, clamped at the ends', () => {
    const at = (quality) => ({ ...DEFAULT_SETTINGS, quality });
    expect(stepSetting(at('high'), 'quality', -1).quality).toBe('medium');
    expect(stepSetting(at('medium'), 'quality', -1).quality).toBe('low');
    expect(stepSetting(at('low'), 'quality', -1).quality).toBe('low');
    expect(stepSetting(at('low'), 'quality', 1).quality).toBe('medium');
    expect(stepSetting(at('medium'), 'quality', 1).quality).toBe('high');
    expect(stepSetting(at('high'), 'quality', 1).quality).toBe('high');
  });
  test('graphics quality wraps when activated (Enter), and the input is not mutated', () => {
    const s = { ...DEFAULT_SETTINGS };
    const a = stepSetting(s, 'quality', 1, true);
    expect(a.quality).toBe('low');
    expect(s.quality).toBe('high');
    const b = stepSetting(a, 'quality', 1, true);
    expect(b.quality).toBe('medium');
    expect(stepSetting(b, 'quality', 1, true).quality).toBe('high');
    expect(stepSetting({ ...s, quality: 'low' }, 'quality', -1, true).quality).toBe('high');
  });
  test('every stepped value is still valid', () => {
    let s = defaultSettings();
    for (const k of [...Object.keys(RANGES), ...BOOLS, ...Object.keys(ENUMS)]) for (const d of [1, 1, -1, 1, -1, -1, -1]) { s = stepSetting(s, k, d); expectValid(s); }
  });
});

describe('graphics quality', () => {
  test('defaults to High, which keeps the original renderer settings', () => {
    expect(DEFAULT_SETTINGS.quality).toBe('high');
    expect(defaultSettings(true).quality).toBe('high');
    expect(qualityProfile('high')).toEqual({ pixelRatioCap: 1.75, shadows: true, shadowMapSize: 2048, decoDensity: 1 });
  });
  test('sanitizing keeps the three presets and defaults anything else', () => {
    for (const q of ENUMS.quality) expect(sanitizeSettings({ quality: q }).quality).toBe(q);
    for (const bad of [undefined, null, '', 'ultra', 'HIGH', 'Low', ' low', 0, 1, true, [], ['low'], {}, { low: 1 }, NaN]) {
      expect(sanitizeSettings({ musicVolume: 0.5, quality: bad })).toEqual({ ...defaultSettings(), musicVolume: 0.5 });
    }
    expect(sanitizeSettings({}).quality).toBe('high');
    expect(sanitizeSettings('garbage').quality).toBe('high');
    expect(sanitizeSettings({ quality: 'ultra' }, { ...DEFAULT_SETTINGS, quality: 'low' }).quality).toBe('low');
    expect(sanitizeSettings({ quality: 'ultra' }, { ...DEFAULT_SETTINGS, quality: 'bogus' }).quality).toBe('high');
  });
  test('a stored v1 settings object from before the Graphics row loads with quality High', () => {
    const old = { v: 1, musicVolume: 0.3, sfxVolume: 0.8, camSensitivity: 1, invertCamX: true, invertCamY: false, reducedMotion: true };
    expect(sanitizeSettings(roundTrip(old))).toEqual({ ...old, quality: 'high' });
  });
  test('profiles grow monotonically from low to medium to high', () => {
    const [lo, md, hi] = ENUMS.quality.map(qualityProfile);
    for (const k of ['pixelRatioCap', 'shadowMapSize', 'decoDensity']) {
      expect(lo[k]).toBeLessThanOrEqual(md[k]);
      expect(md[k]).toBeLessThanOrEqual(hi[k]);
    }
    expect(Number(lo.shadows)).toBeLessThanOrEqual(Number(md.shadows));
    expect(Number(md.shadows)).toBeLessThanOrEqual(Number(hi.shadows));
    expect(lo).toMatchObject({ pixelRatioCap: 1, shadows: false });
    expect(lo.decoDensity).toBeGreaterThan(0);
    expect(hi.decoDensity).toBe(1);
  });
  test('an unknown preset gets the High profile, and profiles are copies', () => {
    expect(qualityProfile('ultra')).toEqual(qualityProfile('high'));
    expect(qualityProfile(undefined)).toEqual(qualityProfile('high'));
    qualityProfile('low').decoDensity = 5;
    expect(qualityProfile('low').decoDensity).toBeLessThan(1);
  });
});

describe('camera and flash helpers', () => {
  test('sensitivity scales and invert flips the yaw and pitch deltas', () => {
    expect(camScale(DEFAULT_SETTINGS)).toEqual({ yaw: 1, pitch: 1 });
    expect(camScale({ ...DEFAULT_SETTINGS, camSensitivity: 2 })).toEqual({ yaw: 2, pitch: 2 });
    expect(camScale({ ...DEFAULT_SETTINGS, camSensitivity: 0.5, invertCamX: true })).toEqual({ yaw: -0.5, pitch: 0.5 });
    expect(camScale({ ...DEFAULT_SETTINGS, invertCamY: true })).toEqual({ yaw: 1, pitch: -1 });
  });
  test('reduced motion caps the full-screen flash', () => {
    expect(capFlash(0.9, DEFAULT_SETTINGS)).toBe(0.9);
    expect(capFlash(0.9, { ...DEFAULT_SETTINGS, reducedMotion: true })).toBe(FLASH_CAP);
    expect(capFlash(0.05, { ...DEFAULT_SETTINGS, reducedMotion: true })).toBe(0.05);
    expect(capFlash(0.9, null)).toBe(0.9);
  });
});
