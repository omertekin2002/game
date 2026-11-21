// Controller bindings (setting `pad`): the rebindable gameplay actions of a standard-mapping pad, their default
// buttons, the buttons nobody can take (Start pauses; Home belongs to the browser / OS), and the pure helpers
// settings.js, input.js, hud/keys.js and the Settings card share: sanitize a stored value, swap on a rebind, build the
// button → action maps, and turn a button index into a short label. The pad side of js/keybinds.js. No DOM and no
// imports, so `bun test` loads it as is. Stored value: { action: button index } for the actions the player changed.
// Menus never read these bindings: they keep the standard layout (MENU_PADMAP, the default map), see input.js.

/** the rebindable actions in Settings order, with their default button (Gamepad.buttons index, standard mapping) */
export const PAD_ACTIONS = [
  ['jump', 0], ['dash', 1], ['attack', 2], ['interact', 3], ['potion', 4], ['view', 5],
  ['shoulder', 14], ['lockOn', 11], ['lockHold', 6], ['sprintToggle', 10], ['map', 8],
];
export const DEFAULT_PAD = Object.freeze(Object.fromEntries(PAD_ACTIONS));
const ACTIONS = new Set(PAD_ACTIONS.map((a) => a[0]));
/** extra buttons an action has only while it keeps its default button (rebinding it drops them; a button another
 *  action is bound to wins over them): RT swings, D-pad ↓ / ↑ potion / view, D-pad → swaps the shoulder too */
export const PAD_SECONDARY = { attack: [7], potion: [13], view: [12], shoulder: [15] };
/** actions a button gives only while held (no press edge): lock hold. The dash button also holds 'sprint' */
export const PAD_HELD_ONLY = new Set(['lockHold']);
/** buttons that always do the same thing: Start pauses (the way back to the menu) */
export const PAD_FIXED = { 9: 'pause' };
/** refused as a binding: Start and Home (16, the browser's or the system's) */
export const PAD_RESERVED = new Set([9, 16]);
/** the standard mapping's buttons: 0…16 (17 entries) */
export const PAD_BUTTONS = 17;

/** can this button index be bound to an action? */
export function padBindable(i) { return Number.isInteger(i) && i >= 0 && i < PAD_BUTTONS && !PAD_RESERVED.has(i); }

/** every rebindable action → its button in effect (stored, else default) */
export function effectivePad(stored) {
  const o = {};
  for (const [a, d] of PAD_ACTIONS) o[a] = stored && Number.isInteger(stored[a]) ? stored[a] : d;
  return o;
}

/** a stored `pad` value → a clean one: only known actions with a bindable index that differs from the default; when two
 *  actions would share a button, the stored bindings involved fall back to their defaults (repeated until no button is
 *  shared). Always a fresh, frozen object; anything that is no plain object gives {} */
export function sanitizePad(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze(out);
  for (const [a] of PAD_ACTIONS) {
    const i = Object.prototype.hasOwnProperty.call(raw, a) ? raw[a] : undefined;
    if (padBindable(i) && i !== DEFAULT_PAD[a]) out[a] = i;
  }
  for (;;) {
    const eff = effectivePad(out), seen = new Map(), clash = new Set();
    for (const [a] of PAD_ACTIONS) {
      const i = eff[a];
      if (seen.has(i)) { clash.add(a); clash.add(seen.get(i)); } else seen.set(i, a);
    }
    let dropped = false;
    for (const a of clash) if (a in out) { delete out[a]; dropped = true; }
    if (!dropped) break;
  }
  return Object.freeze(out);
}

/** bind button `i` to `action` → { pad, swapped, error }. pad: the new stored value (sanitized); swapped: the action that
 *  had the button and now takes `action`'s old one (null when none); error: 'reserved' | 'unknown' (pad unchanged) */
export function bindPad(stored, action, i) {
  const cur = sanitizePad(stored);
  if (!ACTIONS.has(action)) return { pad: cur, swapped: null, error: 'unknown' };
  if (!padBindable(i)) return { pad: cur, swapped: null, error: 'reserved' };
  const eff = effectivePad(cur), old = eff[action];
  let swapped = null;
  for (const [a] of PAD_ACTIONS) if (a !== action && eff[a] === i) swapped = a;
  eff[action] = i;
  if (swapped) eff[swapped] = old;
  const next = {};
  for (const [a, d] of PAD_ACTIONS) if (eff[a] !== d) next[a] = eff[a];
  return { pad: sanitizePad(next), swapped, error: null };
}

/** the secondary buttons in effect: an action's extras while it keeps its default button, minus buttons bound to any
 *  action */
export function activePadSecondary(stored) {
  const eff = effectivePad(stored), bound = new Set(Object.values(eff)), o = {};
  for (const a in PAD_SECONDARY) o[a] = eff[a] === DEFAULT_PAD[a] ? PAD_SECONDARY[a].filter((i) => !bound.has(i)) : [];
  return o;
}

/** the pad maps for input.js: map[i] = the action button i presses (edge and held), held[i] = the actions it only holds
 *  ('sprint' on the dash button, 'lockHold' on its button). Arrays indexed by button, PAD_BUTTONS long */
export function buildPadmap(stored) {
  const eff = effectivePad(stored), sec = activePadSecondary(stored);
  const map = new Array(PAD_BUTTONS).fill(null), held = Array.from({ length: PAD_BUTTONS }, () => []);
  for (const i in PAD_FIXED) map[i] = PAD_FIXED[i];
  for (const [a] of PAD_ACTIONS) { if (PAD_HELD_ONLY.has(a)) held[eff[a]].push(a); else map[eff[a]] = a; }
  for (const a in sec) for (const i of sec[a]) map[i] = a;
  for (const i of [eff.dash]) held[i].push('sprint');
  return { map, held };
}
/** the standard layout the menus, dialogue, the shop, the map and the rebind wait always read (A confirms, B goes
 *  back, LB / RB switch tabs, Y / X confirm too, Back / Start close): the default map, whatever the bindings are */
export const MENU_PADMAP = Object.freeze(buildPadmap({}).map);

const LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Home'];
/** button index → its standard-mapping name: 0 → 'A', 6 → 'LT', 10 → 'L3', 12 → 'D-pad ↑'; anything else 'Button n' */
export function padLabel(i) { return Number.isInteger(i) && LABELS[i] ? LABELS[i] : 'Button ' + String(i); }
