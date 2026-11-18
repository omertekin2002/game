// Keyboard bindings (setting `keys`): the rebindable gameplay actions, their default primary keys, the fixed keys
// nobody can take (Esc / P pause, the arrows, Enter, Tab, the debug `), and the pure helpers settings.js, input.js,
// hud/keys.js and the Settings card share: sanitize a stored value, swap on a rebind, build the code → action map,
// and turn a KeyboardEvent.code into a short label. No DOM and no imports, so `bun test` loads it as is.
// Stored value: { action: KeyboardEvent.code } for the actions the player changed, nothing else.

/** the rebindable actions in Settings order, with their default primary key */
export const KEY_ACTIONS = [
  ['up', 'KeyW'], ['down', 'KeyS'], ['left', 'KeyA'], ['right', 'KeyD'],
  ['attack', 'KeyJ'], ['jump', 'Space'], ['dash', 'ShiftLeft'], ['interact', 'KeyE'],
  ['potion', 'KeyR'], ['view', 'KeyV'], ['shoulder', 'KeyX'], ['lockOn', 'KeyQ'], ['map', 'KeyM'],
];
export const DEFAULT_KEYS = Object.freeze(Object.fromEntries(KEY_ACTIONS));
const ACTIONS = new Set(KEY_ACTIONS.map((a) => a[0]));
/** extra keys an action has only while it keeps its default key (rebinding it drops them; a key another action is
 *  bound to wins over them) */
export const SECONDARY = { dash: ['KeyK', 'ShiftRight'], interact: ['KeyF'], map: ['Tab'] };
/** keys that always do the same thing and can never be bound: they are the way back to the menu and the alternates */
export const FIXED = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'interact', NumpadEnter: 'interact', Escape: 'pause', KeyP: 'pause',
};
export const RESERVED = new Set([...Object.keys(FIXED), 'Tab', 'Backquote']);
const CODE = /^[A-Za-z][A-Za-z0-9]{0,31}$/;

/** can this KeyboardEvent.code be bound to an action? */
export function bindable(code) { return typeof code === 'string' && CODE.test(code) && !RESERVED.has(code); }

/** a stored `keys` value → a clean one: only known actions with a bindable code that differs from the default; when two
 *  actions would share a key, the stored bindings involved fall back to their defaults (repeated until no key is shared).
 *  Always a fresh, frozen object; anything that is no plain object gives {} */
export function sanitizeKeys(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze(out);
  for (const [a] of KEY_ACTIONS) {
    const c = Object.prototype.hasOwnProperty.call(raw, a) ? raw[a] : undefined;
    if (bindable(c) && c !== DEFAULT_KEYS[a]) out[a] = c;
  }
  for (;;) {
    const eff = effectiveKeys(out), seen = new Map(), clash = new Set();
    for (const [a] of KEY_ACTIONS) {
      const c = eff[a];
      if (seen.has(c)) { clash.add(a); clash.add(seen.get(c)); } else seen.set(c, a);
    }
    let dropped = false;
    for (const a of clash) if (a in out) { delete out[a]; dropped = true; }
    if (!dropped) break;
  }
  return Object.freeze(out);
}

/** every rebindable action → its key in effect (stored, else default) */
export function effectiveKeys(stored) {
  const o = {};
  for (const [a, d] of KEY_ACTIONS) o[a] = stored && typeof stored[a] === 'string' ? stored[a] : d;
  return o;
}

/** bind `code` to `action` → { keys, swapped, error }. keys: the new stored value (sanitized); swapped: the action that
 *  had the key and now takes `action`'s old one (null when none); error: 'reserved' | 'unknown' (keys unchanged) */
export function bindKey(stored, action, code) {
  const cur = sanitizeKeys(stored);
  if (!ACTIONS.has(action)) return { keys: cur, swapped: null, error: 'unknown' };
  if (!bindable(code)) return { keys: cur, swapped: null, error: 'reserved' };
  const eff = effectiveKeys(cur), old = eff[action];
  let swapped = null;
  for (const [a] of KEY_ACTIONS) if (a !== action && eff[a] === code) swapped = a;
  eff[action] = code;
  if (swapped) eff[swapped] = old;
  const next = {};
  for (const [a, d] of KEY_ACTIONS) if (eff[a] !== d) next[a] = eff[a];
  return { keys: sanitizeKeys(next), swapped, error: null };
}

/** the secondary keys in effect: an action's extras while it keeps its default key, minus keys bound to any action */
export function activeSecondary(stored) {
  const eff = effectiveKeys(stored), bound = new Set(Object.values(eff)), o = {};
  for (const a in SECONDARY) o[a] = eff[a] === DEFAULT_KEYS[a] ? SECONDARY[a].filter((c) => !bound.has(c)) : [];
  return o;
}

/** the keyboard maps for input.js: map (code → action, edges and held) and held (code → 'sprint': the dash keys) */
export function buildKeymap(stored) {
  const eff = effectiveKeys(stored), sec = activeSecondary(stored), map = { ...FIXED }, held = {};
  for (const [a] of KEY_ACTIONS) map[eff[a]] = a;
  for (const a in sec) for (const c of sec[a]) map[c] = a;
  for (const c of [eff.dash, ...sec.dash]) held[c] = 'sprint';
  return { map, held };
}

// KeyboardEvent.code → a short label for keycaps
const NAMED = {
  Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl',
  AltLeft: 'Alt', AltRight: 'Right Alt', MetaLeft: 'Meta', MetaRight: 'Right Meta', OSLeft: 'Meta', OSRight: 'Right Meta',
  CapsLock: 'Caps Lock', Backspace: 'Backspace', Delete: 'Del', Insert: 'Ins', Home: 'Home', End: 'End',
  PageUp: 'PgUp', PageDown: 'PgDn', ContextMenu: 'Menu', NumLock: 'Num Lock', ScrollLock: 'Scroll Lock', Pause: 'Pause',
  PrintScreen: 'PrtSc', Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  IntlBackslash: '\\', IntlRo: 'Ro', IntlYen: '¥', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
  Backquote: '`', Tab: 'Tab', Enter: 'Enter', NumpadEnter: 'Num Enter', Escape: 'Esc',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
const NUMPAD = { Add: '+', Subtract: '-', Multiply: '*', Divide: '/', Decimal: '.', Equal: '=', Comma: ',' };
/** 'KeyT' → 'T', 'Digit1' → '1', 'Numpad1' → 'Num 1', 'ShiftLeft' → 'Shift', 'Semicolon' → ';', 'F5' → 'F5'; an
 *  unknown code is shown as it is */
export function keyLabel(code) {
  const c = String(code == null ? '' : code);
  if (NAMED[c]) return NAMED[c];
  let m;
  if ((m = /^Key([A-Z])$/.exec(c))) return m[1];
  if ((m = /^Digit([0-9])$/.exec(c))) return m[1];
  if ((m = /^Numpad(.+)$/.exec(c))) return 'Num ' + (NUMPAD[m[1]] || m[1]);
  return c;
}
