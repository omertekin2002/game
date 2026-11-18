// Player preferences: per device, survive New Game, separate from the save (key 'starseed-isle-settings-v1').
// Only values the player changed are stored; defaults are computed once at load (portrait phone → third person,
// prefers-reduced-motion → motion comfort). Stored keys this build doesn't know are kept for forward compatibility.
// Mute keeps its own key ('starseed-isle-muted', owned by audio.js).
import { G, store } from './core.js';
import { EV } from './events.js';

export const SETTINGS_KEY = 'starseed-isle-settings-v1';

// def = default; opts = allowed values; min/max/step = numeric range. FOVs are horizontal degrees at 16:9 (Hor+).
export const SCHEMA = {
  view: { def: 'fp', opts: ['fp', 'tp'] },                        // phone portrait defaults to 'tp'
  fovFP: { def: 100, min: 80, max: 115, step: 1 },
  fovTP: { def: 90, min: 75, max: 100, step: 1 },
  sens: { def: 1.0, min: 0.25, max: 4.0, step: 0.05 },           // × 0.0022 rad per mouse count
  invertY: { def: false },
  invertX: { def: false },
  rawInput: { def: false },                                       // unadjustedMovement pointer lock
  padSens: { def: 1.0, min: 0.5, max: 2.0, step: 0.05 },
  padInvertY: { def: false },
  padInvertX: { def: false },
  padCurve: { def: 'default', opts: ['linear', 'default', 'precise'] },
  touchSens: { def: 1.0, min: 0.5, max: 2.0, step: 0.05 },
  arrowLook: { def: false },                                      // arrow keys look (accessibility)
  headBob: { def: 1.0, min: 0, max: 1, step: 0.05 },
  shake: { def: 1.0, min: 0, max: 1, step: 0.05 },
  speedFx: { def: 1.0, min: 0, max: 1, step: 0.05 },             // dash/sprint FOV, hit punches
  cameraRoll: { def: true },
  reduceMotion: { def: false },                                   // "Motion comfort" preset; true under prefers-reduced-motion
  crosshair: { def: 'dot', opts: ['dot', 'ring', 'off'] },
  crosshairSize: { def: 'm', opts: ['s', 'm', 'l'] },
  crosshairColor: { def: 'cream', opts: ['cream', 'yellow'] },
  aimAssist: { def: 'auto', opts: ['auto', 'off', 'low', 'high'] }, // swing magnetism; auto = mouse low, pad high, touch max
  lockMode: { def: 'toggle', opts: ['toggle', 'hold'] },
  lockTurnsCamera: { def: true },
  autoLockBosses: { def: 'auto', opts: ['auto', 'on', 'off'] },  // auto = pad/touch on, mouse off
  tpShoulder: { def: 'right', opts: ['right', 'left', 'center'] },
  tpBodyFacesCamera: { def: false },
  tpAutoRecenter: { def: true },
  dialogueLookAt: { def: true },
  musicVol: { def: 1.0, min: 0, max: 1, step: 0.05 },
  sfxVol: { def: 1.0, min: 0, max: 1, step: 0.05 },
  ambVol: { def: 1.0, min: 0, max: 1, step: 0.05 },
  textSpeed: { def: 52, opts: [30, 52, 90] },                    // dialogue characters per second
  hudScale: { def: 1.0, min: 0.8, max: 1.2, step: 0.05 },
  minimap: { def: 'heading', opts: ['heading', 'north', 'off'] },
  quality: { def: 'auto', opts: ['auto', 'low', 'high'] },
  dynRes: { def: true },
  touchLeftHanded: { def: false },
};

const mq = (q) => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };

/** device-dependent defaults, computed once */
function computeDefaults() {
  const d = {};
  for (const k in SCHEMA) d[k] = SCHEMA[k].def;
  try { if (mq('(pointer: coarse)') && window.innerWidth < window.innerHeight) d.view = 'tp'; } catch (e) { /* ignore */ }
  if (mq('(prefers-reduced-motion: reduce)')) d.reduceMotion = true;
  return d;
}

/** coerce a value to the schema; returns undefined when it can't be made valid */
function coerce(sc, v) {
  if (typeof sc.def === 'boolean') {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === 'true') return true;
    if (v === 0 || v === 'false') return false;
    return undefined;
  }
  if (sc.opts) {
    if (sc.opts.includes(v)) return v;
    const n = Number(v);
    return typeof sc.def === 'number' && sc.opts.includes(n) ? n : undefined;
  }
  // a number, or text that reads as one: Number() would also make 0 of false, [] and blank text, 1 of true
  if (typeof v === 'string' ? v.trim() === '' : typeof v !== 'number') return undefined;
  let n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (sc.step) n = Math.round(n / sc.step) * sc.step;
  n = Math.min(sc.max, Math.max(sc.min, n));
  return +n.toFixed(4);
}

export class Settings {
  constructor() {
    this.defaults = computeDefaults();
    this.user = {};          // only changed values (+ unknown keys from newer builds)
    this.subs = new Map();   // key | '*' → [fn]
    this.saveT = null;
    const raw = store.get(SETTINGS_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const k in raw) {
        if (k === 'v') continue;
        if (!SCHEMA[k]) { this.user[k] = raw[k]; continue; }
        const v = coerce(SCHEMA[k], raw[k]);
        if (v !== undefined) this.user[k] = v;
      }
    }
    try { window.addEventListener('pagehide', () => { if (this.saveT) this.flush(); }); } catch (e) { /* ignore */ }
  }
  get(k) { return k in this.user && SCHEMA[k] ? this.user[k] : this.defaults[k]; }
  /** every known setting with its effective value */
  all() { const o = {}; for (const k in SCHEMA) o[k] = this.get(k); return o; }
  /** clamps/validates, persists (debounced 250 ms), notifies; returns the effective value */
  set(k, v) {
    const sc = SCHEMA[k];
    if (!sc) { if (G.debugOn) console.warn('[Starseed] unknown setting', k); return undefined; }
    const c = coerce(sc, v);
    if (c === undefined) return this.get(k);
    const prev = this.get(k);
    if (c === this.defaults[k]) delete this.user[k]; else this.user[k] = c;
    this.persist();
    if (c !== prev) this.notify(k, c);
    return c;
  }
  /** back to defaults (one key, or all when k is omitted) */
  reset(k) {
    const keys = k ? [k] : Object.keys(SCHEMA);
    for (const key of keys) {
      if (!SCHEMA[key]) continue;
      const prev = this.get(key);
      delete this.user[key];
      if (this.get(key) !== prev) this.notify(key, this.get(key));
    }
    this.persist();
  }
  /** subscribe to one key or '*'; fn(value, key); returns off() */
  on(k, fn) {
    let a = this.subs.get(k);
    if (!a) this.subs.set(k, (a = []));
    a.push(fn);
    return () => { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  notify(k, v) {
    for (const key of [k, '*']) {
      const a = this.subs.get(key);
      if (a) for (const fn of a.slice()) { try { fn(v, k); } catch (e) { console.error('[Starseed] settings listener', k, e); } }
    }
    if (G.events) G.events.emit(EV.SETTINGS, { key: k, value: v });
  }
  persist() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.flush(), 250);
  }
  flush() {
    clearTimeout(this.saveT);
    this.saveT = null;
    return store.set(SETTINGS_KEY, Object.assign({ v: 1 }, this.user));
  }
}

export const settings = new Settings();
