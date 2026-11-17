// Player settings: defaults, ranges, load-time sanitizing and the small helpers the game applies them with.
// Pure module (no Three.js, DOM or localStorage) so `bun test` can import it. js/main.js does the storage.

// Bump when the settings layout changes. Stored separately from the save, so New Game never resets settings.
export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = 'starseed-isle-settings-v1';

// Numeric settings: allowed range and the step the menu moves them by.
export const RANGES = {
  musicVolume: { min: 0, max: 1, step: 0.1 },
  sfxVolume: { min: 0, max: 1, step: 0.1 },
  camSensitivity: { min: 0.5, max: 2, step: 0.25 },
};
export const BOOLS = ['invertCamX', 'invertCamY', 'reducedMotion'];
// Choice settings: the allowed values, in menu order (← / − moves left, → / + moves right).
export const ENUMS = {
  quality: ['low', 'medium', 'high'],
};

// What each graphics preset sets. High is the original look. Each knob only grows from low to high.
//  pixelRatioCap: upper bound for the renderer pixel ratio (the device ratio is used when it is lower)
//  shadows / shadowMapSize: sun shadows and the size of their square shadow map
//  decoDensity: the fraction of non-interactive decoration that is drawn (grass, flowers, ferns, pebbles, shells,
//    glowshrooms, crystals; js/scatter.js). Low uses 0.15: with shadows off, that draws about 42% fewer
//    triangles than High at the spawn view (0.35 gave only 36%; trees and their outlines are most of the rest).
const QUALITY = {
  low: { pixelRatioCap: 1, shadows: false, shadowMapSize: 1024, decoDensity: 0.15 },
  medium: { pixelRatioCap: 1.25, shadows: true, shadowMapSize: 1024, decoDensity: 0.65 },
  high: { pixelRatioCap: 1.75, shadows: true, shadowMapSize: 2048, decoDensity: 1 },
};

// With reduced motion on, the full-screen white and red flashes never go above this opacity.
export const FLASH_CAP = 0.2;

// Volumes match js/audio.js's own defaults. `reducedMotion` follows the OS `prefers-reduced-motion`
// value, which the caller passes in (this module has no DOM).
export function defaultSettings(prefersReducedMotion = false) {
  return {
    v: SETTINGS_VERSION, musicVolume: 0.35, sfxVolume: 0.7, camSensitivity: 1,
    invertCamX: false, invertCamY: false, reducedMotion: !!prefersReducedMotion, quality: 'high',
  };
}
export const DEFAULT_SETTINGS = Object.freeze(defaultSettings(false));

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const round = (x) => Math.round(x * 1000) / 1000;

// A complete, valid settings object from anything (garbage, null, an older or newer `v`): numbers are
// clamped to their range, choices must be one of their values, anything missing, wrong-typed or NaN takes the
// default, unknown keys are dropped.
// Never throws.
export function sanitizeSettings(raw, defaults = DEFAULT_SETTINGS) {
  const d = isObj(defaults) ? defaults : DEFAULT_SETTINGS;
  const src = isObj(raw) ? raw : {};
  const out = { v: SETTINGS_VERSION };
  for (const [k, r] of Object.entries(RANGES)) {
    const v = src[k];
    out[k] = typeof v === 'number' && Number.isFinite(v) ? round(Math.min(r.max, Math.max(r.min, v))) : d[k];
  }
  for (const k of BOOLS) out[k] = typeof src[k] === 'boolean' ? src[k] : !!d[k];
  for (const [k, vals] of Object.entries(ENUMS)) {
    out[k] = vals.includes(src[k]) ? src[k] : vals.includes(d[k]) ? d[k] : DEFAULT_SETTINGS[k];
  }
  return out;
}

// The settings with `key` moved one step in `dir` (+1 / -1): numbers go to the next step on the grid
// (clamped, or wrapping past the ends when `wrap` is set); choices move to the next value the same way;
// booleans toggle. Returns a new object.
export function stepSetting(s, key, dir, wrap = false) {
  const out = { ...s };
  if (BOOLS.includes(key)) { out[key] = !s[key]; return out; }
  const vals = ENUMS[key];
  if (vals) {
    const n = vals.length, i = Math.max(0, vals.indexOf(s[key])) + (dir > 0 ? 1 : -1);
    out[key] = vals[wrap ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
    return out;
  }
  const r = RANGES[key];
  if (!r) return out;
  const i = (s[key] - r.min) / r.step;
  const n = dir > 0 ? Math.floor(i + 1e-6) + 1 : Math.ceil(i - 1e-6) - 1;
  let v = round(r.min + n * r.step);
  if (wrap && v > r.max + 1e-6) v = r.min;
  else if (wrap && v < r.min - 1e-6) v = r.max;
  out[key] = Math.min(r.max, Math.max(r.min, v));
  return out;
}

// Multipliers for the camera's yaw and pitch input deltas (sensitivity and invert).
export function camScale(s) {
  return { yaw: s.camSensitivity * (s.invertCamX ? -1 : 1), pitch: s.camSensitivity * (s.invertCamY ? -1 : 1) };
}

// Full-screen flash opacity after the reduced-motion cap.
export function capFlash(a, s) { return s && s.reducedMotion ? Math.min(a, FLASH_CAP) : a; }

// The concrete renderer and scenery knobs for a graphics preset (unknown values get the default, High).
export function qualityProfile(quality) {
  return { ...(QUALITY[quality] || QUALITY[DEFAULT_SETTINGS.quality]) };
}
