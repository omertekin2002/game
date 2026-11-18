// Key tokens → the current device's glyph (contract C7). Any player-facing string may carry
// {move} {look} {attack} {jump} {dash} {sprint} {interact} {potion} {view} {shoulder} {lock} {map} {pause} (aliases {roll},
// {lockon}, {use}, {swing}, {hop}, {zoom}). ui.js formats every dialogue / sign / toast / banner / prompt / card line
// at display time; other packages that draw text themselves call fmtKeys(text). A token the device has no control for
// becomes a plain word (touch has no shoulder swap), so text never names a key the player does not have.
import { G } from '../core.js';
import { Assets } from '../assets.js';
import { settings } from '../settings.js';
import { effectiveKeys, activeSecondary, keyLabel } from '../keybinds.js';

const ALIAS = { roll: 'dash', lockon: 'lock', use: 'interact', swing: 'attack', hop: 'jump', camera: 'look' };
/** input.lastDevice → glyph family */
let coarse = null;
export function deviceKind(d) {
  let dev = d || (G.input && G.input.lastDevice);
  if (!dev) {                                     // before input exists (loading screen): guess from the pointer
    if (coarse === null) { try { coarse = matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; } }
    dev = coarse ? 'touch' : 'keyboard';
  }
  return dev === 'pad' ? 'pad' : dev === 'touch' ? 'touch' : 'kbm';
}
/** true when every key token in text has a glyph on the device (a note about a control the device lacks is dropped) */
export function hasKeys(text, device) {
  const m = String(text || '').match(/\{([a-zA-Z]+)\}/g);
  return !m || m.every((t) => { const g = glyph(t.slice(1, -1), device); return !g || !!g.text; });
}
// [text, style]: 'key' = keycap, 'pad' = round face button (colour class), 'word' = plain word, 'icon' = touch button icon
// The keyboard rows (GLYPHS.kbm, ALL.kbm) come from the key bindings in effect (setting `keys`) and are rebuilt when
// they change (wp6-hud then drops the HUD text it formatted once per device: prompt, coach, key chips, dialogue).
export const GLYPHS = {
  kbm: null,
  pad: {
    move: ['L-stick', 'key'], look: ['R-stick', 'key'], attack: ['X', 'pad x'], jump: ['A', 'pad a'], dash: ['B', 'pad b'],
    sprint: ['hold B', 'pad b'], interact: ['Y', 'pad y'], potion: ['LB', 'key'], view: ['RB', 'key'], shoulder: ['D-pad ◂▸', 'key'],
    lock: ['R3', 'key'], map: ['Back', 'key'], pause: ['Start', 'key'], zoom: ['', 'word'],
  },
  touch: {
    move: ['the stick', 'word'], look: ['swipe the screen', 'word'], attack: ['Swing', 'icon act_swing'], jump: ['Hop', 'icon act_hop'],
    dash: ['Roll', 'icon act_roll'], sprint: ['hold Roll', 'icon act_roll'], interact: ['Use', 'icon act_use'], potion: ['Potion', 'icon potion'],
    view: ['View', 'icon act_view'], shoulder: ['', 'word'], lock: ['Lock', 'icon act_lock'], map: ['Map', 'icon act_map'], pause: ['Pause', 'icon pause'],
    zoom: ['pinch', 'word'],
  },
};
// the full binding list per device (controls reference); first entry is the glyph above
export const ALL = {
  kbm: null,
  pad: { move: ['L-stick'], look: ['R-stick'], attack: ['X', 'RT'], jump: ['A'], dash: ['B'], interact: ['Y'], lock: ['R3', 'hold LT'],
    potion: ['LB', 'D-pad ↓'], view: ['RB', 'D-pad ↑'], shoulder: ['D-pad ◂▸'], map: ['Back'], pause: ['Start'] },
  touch: { move: ['stick'], look: ['swipe the screen'], attack: ['Swing'], jump: ['Hop'], dash: ['Roll'], interact: ['Use', 'tap'],
    lock: ['Lock'], potion: ['Potion'], view: ['View'], map: ['Map'], pause: ['Pause'] },
};
/** the move keys as one keycap: 'WASD' for single characters, else spaced ('I J K L', 'Num 8 Num 4 …') */
export function moveLabel(e, sep = '') {
  const l = [e.up, e.left, e.down, e.right].map(keyLabel);
  return l.every((x) => x.length === 1) ? l.join(sep) : l.join(' ');
}
/** rebuild the keyboard glyphs from the bindings k (default: the setting in effect) */
export function setKbmKeys(k = settings.get('keys')) {
  const e = effectiveKeys(k), s = activeSecondary(k), L = keyLabel;
  const alt = (a) => s[a].filter((c) => c !== 'ShiftRight').map(L);   // Right Shift: the same "Shift" keycap
  GLYPHS.kbm = {
    move: [moveLabel(e), 'key'], look: ['Mouse', 'key'], attack: ['LMB', 'key'], jump: [L(e.jump), 'key'], dash: [L(e.dash), 'key'],
    sprint: ['hold ' + L(e.dash), 'key'], interact: [L(e.interact), 'key'], potion: [L(e.potion), 'key'], view: [L(e.view), 'key'],
    shoulder: [L(e.shoulder), 'key'], lock: [L(e.lockOn), 'key'], map: [L(e.map), 'key'], pause: ['Esc', 'key'], zoom: ['Wheel', 'key'],
  };
  ALL.kbm = {
    move: [moveLabel(e, ' '), '← ↑ → ↓'], look: ['Mouse'], attack: ['LMB', L(e.attack)], jump: [L(e.jump)], dash: [L(e.dash), ...alt('dash')],
    interact: [L(e.interact), ...alt('interact'), 'Enter'], lock: [L(e.lockOn), 'MMB', 'hold RMB'], potion: [L(e.potion)], view: [L(e.view)],
    shoulder: [L(e.shoulder)], zoom: ['Wheel'], map: [L(e.map), ...alt('map')], pause: ['Esc', 'P'],
  };
}
setKbmKeys();
settings.on('keys', (k) => setKbmKeys(k));
const PADCLS = { A: 'a', B: 'b', X: 'x', Y: 'y' };
const TOKEN = /\{([a-zA-Z]+)\}/g;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);
const norm = (k) => ALIAS[k] || k;

/** glyph record for one action on a device → { text, style } or null for an unknown action */
export function glyph(action, device) {
  const g = GLYPHS[deviceKind(device)][norm(action)];
  return g ? { text: g[0], style: g[1] } : null;
}
/** one glyph as HTML: a keycap, a round pad button or a touch icon chip */
export function keyCap(action, device, label) {
  const dk = deviceKind(device);
  const a = norm(action);
  if (label != null) return capHtml(label, dk === 'pad' && PADCLS[label] ? 'pad ' + PADCLS[label] : 'key');
  const g = GLYPHS[dk][a];
  if (!g) return '';
  return capHtml(g[0], g[1]);
}
function capHtml(text, style) {
  if (!text) return '';
  if (style === 'word') return `<span class="kw">${esc(text)}</span>`;
  if (style.startsWith('icon')) {
    const key = style.split(' ')[1], u = key && (Assets.url('ui', key) || Assets.url('sprites', key));
    return `<span class="kt">${u ? `<img src="${u}" alt="" draggable="false" onerror="this.remove()">` : ''}${esc(text)}</span>`;
  }
  if (style.startsWith('pad ')) return `<kbd class="kp ${style.slice(4)}">${esc(text)}</kbd>`;
  return `<kbd>${esc(text)}</kbd>`;
}
/** C7: replace key tokens with the device's glyphs. Plain text by default (unknown tokens stay as written);
 *  o.html → escaped HTML with keycaps; o.device overrides input.lastDevice ('keyboard'|'mouse'|'pad'|'touch'|'kbm') */
export function fmtKeys(text, o = {}) {
  if (text == null) return '';
  const s = String(text), dev = o.device === 'kbm' ? 'keyboard' : o.device;
  if (!o.html) {
    if (s.indexOf('{') < 0) return s;
    return s.replace(TOKEN, (m, k) => { const g = glyph(k, dev); return g ? g.text : m; });
  }
  let out = '', last = 0;
  TOKEN.lastIndex = 0;
  for (let m; (m = TOKEN.exec(s));) {
    const g = glyph(m[1], dev);
    out += esc(s.slice(last, m.index)) + (g ? keyCap(m[1], dev) : esc(m[0]));
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
/** a line split for the typewriter: [{ s (plain text), html (null = text) }]; keycaps reveal as one character */
export function keyParts(text, device) {
  const s = String(text == null ? '' : text), out = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m; (m = TOKEN.exec(s));) {
    const g = glyph(m[1], device);
    if (!g) continue;
    if (m.index > last) out.push({ s: s.slice(last, m.index), html: null });
    out.push({ s: g.text, html: keyCap(m[1], device) });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ s: s.slice(last), html: null });
  return out;
}
