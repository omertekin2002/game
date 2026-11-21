// Save schema: version, fresh state, migration and load-time validation.
// Pure module (no Three.js, DOM or localStorage) so `bun test` can import it. js/game.js does the storage.
import { BOSSES, CFG, SECRETS, SEED_ORDER } from './data.js';

// Bump when the save layout changes, and add a MIGRATIONS step from the previous version.
export const SAVE_VERSION = 6;

export function freshState(seed) {
  return {
    v: SAVE_VERSION, seed, hp: CFG.startHp, maxHp: CFG.startHp, coins: 0, potions: 0, swordLevel: 1,
    seeds: { woods: 0, peaks: 0, shores: 0 }, chests: {}, bosses: {}, shopHeart: false, ending: false,
    tod: CFG.startTimeOfDay, visited: {}, introDone: false, controlsSeen: false, playTime: 0, px: null, pz: null, facing: Math.PI,
    errands: {}, shells: {},   // v3: errand id → 1 started / 2 done (data.js ERRANDS); errand item flags: id → true (a rainbow shell picked up, a parade lantern lit)
    plushies: {},              // v4: Miso's guardian plushies bought: guardian id (BOSSES key) → true (data.js PLUSHIES)
    rematches: {},             // v5: guardian rematches won after the bloom: guardian id (BOSSES key) → true (data.js REMATCH)
    secrets: {},               // v6: landmark keepsakes found: keepsake id (data.js SECRETS) → true
  };
}

// MIGRATIONS[n] turns a version-n save into a version-(n + 1) save. Steps run in order up to SAVE_VERSION.
// Versions 1 and 2 never had a step: 2 was the first version ever written, so a v1 save has no path and is rejected.
export const MIGRATIONS = {
  // v2 → v3: villager errands (Clover's rainbow shells). Every v2 field is kept as it is; nothing has started yet
  2: (s) => ({ ...s, errands: {}, shells: {} }),
  // v3 → v4: Miso's guardian plushies. Every v3 field (errands and their item flags included) is kept; none bought yet
  3: (s) => ({ ...s, plushies: {} }),
  // v4 → v5: guardian rematches after the bloom. Every v4 field (plushies included) is kept; none won yet
  4: (s) => ({ ...s, rematches: {} }),
  // v5 → v6: the landmark keepsakes. Every v5 field (rematches included) is kept; none found yet
  5: (s) => ({ ...s, secrets: {} }),
};

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const clampNum = (x, lo, hi, dflt) => { const n = num(x); return n === null ? dflt : Math.min(hi, Math.max(lo, n)); };
const wrap01 = (x) => { let t = x % 1; if (t < 0) t += 1; return t >= 1 || t === 0 ? 0 : t; }; // keeps in-range values exact
const flags = (x) => { const o = {}; if (isObj(x)) for (const k of Object.keys(x)) if (x[k]) o[k] = true; return o; };

// Bring a raw save up to SAVE_VERSION. Returns a new object, or null for anything unusable:
// not an object, no integer `v`, `v` newer than SAVE_VERSION, a missing step, or no `seed`.
export function migrate(raw, steps = MIGRATIONS) {
  if (!isObj(raw) || !Number.isInteger(raw.v) || raw.v < 1 || raw.v > SAVE_VERSION || raw.seed == null) return null;
  let s;
  try {
    s = structuredClone(raw);
    for (let v = s.v; v < SAVE_VERSION; v++) {
      const step = steps[v];
      if (typeof step !== 'function') return null;
      s = step(s);
      if (!isObj(s)) return null;
      s.v = v + 1;
    }
  } catch (e) {
    return null;
  }
  return s.seed == null ? null : s;
}

// Fill missing fields from freshState and coerce or clamp the known ones, so the game can always start.
// Valid values pass through unchanged; unknown extra fields are kept.
export function normalize(s, seed) {
  const f = freshState(seed);
  if (!isObj(s)) return f;
  const out = { ...f, ...s, v: SAVE_VERSION };
  out.seed = num(s.seed) ?? seed;
  out.maxHp = Math.floor(clampNum(s.maxHp, CFG.startHp, CFG.maxHp, f.maxHp));
  out.hp = Math.floor(clampNum(s.hp, 1, out.maxHp, out.maxHp));
  out.coins = Math.floor(clampNum(s.coins, 0, Number.MAX_SAFE_INTEGER, 0));
  out.potions = Math.floor(clampNum(s.potions, 0, CFG.potionMax, 0));
  out.swordLevel = num(s.swordLevel) !== null && s.swordLevel >= 2 ? 2 : 1;
  out.seeds = { ...f.seeds };
  if (isObj(s.seeds)) for (const id of SEED_ORDER) out.seeds[id] = Math.round(clampNum(s.seeds[id], 0, 2, 0));
  out.chests = flags(s.chests);
  out.bosses = flags(s.bosses);
  out.visited = flags(s.visited);
  out.shells = flags(s.shells);
  out.plushies = {};
  if (isObj(s.plushies)) for (const id of Object.keys(BOSSES)) if (s.plushies[id] === true) out.plushies[id] = true;   // guardian ids, true only
  out.rematches = {};
  if (isObj(s.rematches)) for (const id of Object.keys(BOSSES)) if (s.rematches[id]) out.rematches[id] = true;   // guardian ids, as flags
  out.secrets = {};
  if (isObj(s.secrets)) for (const { id } of SECRETS) if (s.secrets[id] === true) out.secrets[id] = true;   // keepsake ids, true only
  out.errands = {};
  if (isObj(s.errands)) for (const k of Object.keys(s.errands)) { const n = Math.round(clampNum(s.errands[k], 0, 2, 0)); if (n > 0) out.errands[k] = n; }
  for (const k of ['shopHeart', 'ending', 'introDone', 'controlsSeen']) out[k] = !!s[k];
  out.tod = wrap01(num(s.tod) ?? f.tod);
  out.playTime = clampNum(s.playTime, 0, Number.MAX_VALUE, 0);
  const px = num(s.px), pz = num(s.pz);
  out.px = px !== null && pz !== null ? px : null;
  out.pz = px !== null && pz !== null ? pz : null;
  out.facing = s.facing === null ? null : num(s.facing) ?? f.facing;
  return out;
}

// migrate then normalize; null when the save can't be used (treat as "no save").
export function loadSave(raw, seed, steps = MIGRATIONS) {
  const s = migrate(raw, steps);
  return s ? normalize(s, seed) : null;
}
