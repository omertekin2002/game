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

// With reduced motion on, the full-screen white and red flashes never go above this opacity.
export const FLASH_CAP = 0.2;

// Volumes match js/audio.js's own defaults. `reducedMotion` follows the OS `prefers-reduced-motion`
// value, which the caller passes in (this module has no DOM).
export function defaultSettings(prefersReducedMotion = false) {
  return {
    v: SETTINGS_VERSION, musicVolume: 0.35, sfxVolume: 0.7, camSensitivity: 1,
    invertCamX: false, invertCamY: false, reducedMotion: !!prefersReducedMotion,
  };
}
export const DEFAULT_SETTINGS = Object.freeze(defaultSettings(false));

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const round = (x) => Math.round(x * 1000) / 1000;

// A complete, valid settings object from anything (garbage, null, an older or newer `v`): numbers are
// clamped to their range, anything missing, wrong-typed or NaN takes the default, unknown keys are dropped.
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
  return out;
}

// The settings with `key` moved one step in `dir` (+1 / -1): numbers go to the next step on the grid
// (clamped, or wrapping past the ends when `wrap` is set); booleans toggle. Returns a new object.
export function stepSetting(s, key, dir, wrap = false) {
  const out = { ...s };
  if (BOOLS.includes(key)) { out[key] = !s[key]; return out; }
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
