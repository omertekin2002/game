// Cursor menus: a navigable button list (pause, title), the Settings card generated from settings.SCHEMA (contract
// C17: every key gets a control, live and persisted through settings.set) and the controls reference that adapts to
// keyboard + mouse / controller / touch (art §12.4). Usable by mouse (click, drag sliders), keyboard (↑↓ rows, ←→
// values / tabs, Enter / E / Space confirm, Esc back), pad (stick / d-pad, A confirm, B back, LB / RB tabs) and touch.
import { G, sfx, isMuted, toggleMute } from '../core.js';
import { settings, SCHEMA } from '../settings.js';
import { vFovFor } from '../view/view.js';
import { fmtKeys, keyCap, deviceKind, esc, ALL, hasKeys } from './keys.js';
import { iconHtml } from './icons.js';
import { uiSfx } from './sound.js';

/** per-frame menu input with left / right edges (keys A / D / arrows, pad stick and d-pad) and hold-repeat */
export class Nav {
  constructor() { this.padX = 0; this.dp = [false, false]; this.rep = 0; this.dir = 0; }
  read(input, dt) {
    // tabs: LB / RB (R / V on the keyboard) arrive as 'potion' / 'view'. The pad map also gives the D-pad's ↓ / ↑ those
    // actions (with navDown / navUp), and in a menu the D-pad moves the selection, so a press that came from it is no tab
    const pp = input.padPrev || [];
    const dDown = !!pp[13] && !pp[4] && input.pressed('navDown'), dUp = !!pp[12] && !pp[5] && input.pressed('navUp');
    const o = { y: input.menuNav(), x: 0, ok: input.pressed('interact') || input.pressed('jump') || (input.pressed('attack') && input.lastDevice !== 'mouse'), back: input.cancel(), prev: input.pressed('potion') && !dDown, next: input.pressed('view') && !dUp };
    if (input.pressed('left')) o.x = -1;
    if (input.pressed('right')) o.x = 1;
    const ax = input.padAxis ? input.padAxis.x : 0, px = ax < -0.6 ? -1 : ax > 0.6 ? 1 : 0;
    if (px && px !== this.padX) o.x = px;
    this.padX = px;
    const l = !!pp[14], r = !!pp[15];
    if (l && !this.dp[0]) o.x = -1;
    if (r && !this.dp[1]) o.x = 1;
    this.dp = [l, r];
    // hold to repeat (sliders)
    const held = input.held('left') || px < 0 || l ? -1 : input.held('right') || px > 0 || r ? 1 : 0;
    if (held && held === this.dir) { this.rep += dt; if (this.rep > 0.38) { this.rep -= 0.09; o.x = o.x || held; o.repeat = true; } } else { this.rep = 0; }
    this.dir = held;
    return o;
  }
}

/** a vertical list of buttons with a selection (✿ marker), hover and click */
export class MenuList {
  constructor(buttons, onPick) {
    this.btns = buttons; this.sel = 0; this.onPick = onPick;
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => { this.sel = i; this.mark(); this.onPick(i, b); });
      b.addEventListener('mousemove', () => { if (this.sel !== i && !b.disabled) { this.sel = i; this.mark(); } });
    });
  }
  visible() { return this.btns.filter((b) => b.style.display !== 'none' && !b.disabled); }
  mark() { this.btns.forEach((b, i) => b.classList.toggle('sel', i === this.sel)); }
  move(d) {
    const vis = this.btns.map((b, i) => (b.style.display !== 'none' && !b.disabled ? i : -1)).filter((i) => i >= 0);
    if (!vis.length) return;
    let k = vis.indexOf(this.sel); if (k < 0) k = 0;
    this.sel = vis[(k + d + vis.length) % vis.length];
    this.mark(); uiSfx('uiMove');
  }
  pick() { const b = this.btns[this.sel]; if (b && b.style.display !== 'none' && !b.disabled) this.onPick(this.sel, b); }
}

// ------------------------------------------------------------------ settings card
const PCT = (v) => Math.round(v * 100) + '%';
const MUL = (v) => '×' + (+v).toFixed(2);
// tab, group, label, value names, formatter, note. Keys missing here still get a control (tab "View", group "More").
// hidden: a SCHEMA key nothing in the game reads yet: no row, so the card never offers a switch that does nothing.
// None today (arrowLook → input.js, tpAutoRecenter / tpBodyFacesCamera → view/feel.js); keep the flag for future keys
export const META = {
  view: { tab: 'view', g: 'Camera', label: 'View', names: { fp: 'First person', tp: 'Third person' }, note: '{view} switches any time' },
  fovFP: { tab: 'view', g: 'Camera', label: 'Field of view · first person', fmt: (v) => `${v}° <small>${Math.round(vFovFor(v, innerWidth / innerHeight))}° tall</small>` },
  fovTP: { tab: 'view', g: 'Camera', label: 'Field of view · third person', fmt: (v) => `${v}° <small>${Math.round(vFovFor(v, innerWidth / innerHeight))}° tall</small>` },
  tpShoulder: { tab: 'view', g: 'Camera', label: 'Third-person shoulder', names: { right: 'Right', left: 'Left', center: 'Centre' }, note: '{shoulder} swaps sides' },
  crosshair: { tab: 'view', g: 'Screen', label: 'Crosshair', names: { dot: 'Dot', ring: 'Dot + ring', off: 'Off' } },
  crosshairSize: { tab: 'view', g: 'Screen', label: 'Crosshair size', names: { s: 'Small', m: 'Medium', l: 'Large' } },
  crosshairColor: { tab: 'view', g: 'Screen', label: 'Crosshair colour', names: { cream: 'Cream', yellow: 'Bright yellow' } },
  minimap: { tab: 'view', g: 'Screen', label: 'Minimap', names: { heading: 'Turns with you', north: 'North up', off: 'Off' }, note: 'Phones show the compass only' },
  hudScale: { tab: 'view', g: 'Screen', label: 'HUD size', fmt: PCT },
  quality: { tab: 'view', g: 'Graphics', label: 'Graphics quality', names: { auto: 'Auto', low: 'Low', high: 'High' } },
  dynRes: { tab: 'view', g: 'Graphics', label: 'Dynamic resolution' },
  sens: { tab: 'controls', g: 'Keyboard + mouse', label: 'Mouse sensitivity', fmt: MUL },
  invertY: { tab: 'controls', g: 'Keyboard + mouse', label: 'Invert mouse up / down' },
  rawInput: { tab: 'controls', g: 'Keyboard + mouse', label: 'Raw mouse input' },
  arrowLook: { tab: 'controls', g: 'Keyboard + mouse', label: 'Arrow keys look around', note: 'WASD still walks · they turn at the controller look speed' },
  padSens: { tab: 'controls', g: 'Controller', label: 'Controller look speed', fmt: MUL },
  padInvertY: { tab: 'controls', g: 'Controller', label: 'Invert controller up / down' },
  padCurve: { tab: 'controls', g: 'Controller', label: 'Stick response', names: { linear: 'Linear', default: 'Smooth', precise: 'Precise' } },
  // (the two third-person rows: their own group right after the device's and Sword, so a portrait phone, which plays in
  // third person, finds the drift it gets by default without scrolling past other devices' rows)
  tpAutoRecenter: { tab: 'controls', g: 'Third person', label: 'Camera drifts behind Pip', note: 'With a controller or touch, while you run and leave the camera alone' },
  touchSens: { tab: 'controls', g: 'Touch', label: 'Touch look sensitivity', fmt: MUL },
  touchLeftHanded: { tab: 'controls', g: 'Touch', label: 'Left-handed buttons' },
  aimAssist: { tab: 'controls', g: 'Sword', label: 'Swing assist', names: { auto: 'Auto', off: 'Off', low: 'Low', high: 'High' } },
  lockMode: { tab: 'controls', g: 'Sword', label: 'Lock-on button', names: { toggle: 'Press', hold: 'Hold' } },
  lockTurnsCamera: { tab: 'controls', g: 'Sword', label: 'Lock-on turns the camera' },
  autoLockBosses: { tab: 'controls', g: 'Sword', label: 'Lock on to bosses by itself', names: { auto: 'Auto', on: 'On', off: 'Off' } },
  tpBodyFacesCamera: { tab: 'controls', g: 'Third person', label: 'Pip faces where you look', note: 'Pip steps sideways instead of turning to run' },
  musicVol: { tab: 'sound', g: 'Volume', label: 'Music', fmt: PCT },
  sfxVol: { tab: 'sound', g: 'Volume', label: 'Effects', fmt: PCT },
  ambVol: { tab: 'sound', g: 'Volume', label: 'Ambience', fmt: PCT },
  reduceMotion: { tab: 'comfort', g: 'Motion', label: 'Motion comfort', note: 'A calmer camera: no bob, roll, wobble or speed effects · dimmer full-screen flashes' },
  headBob: { tab: 'comfort', g: 'Motion', label: 'Head bob', fmt: (v) => (v <= 0 ? 'Off' : v < 0.6 ? 'Reduced · ' + PCT(v) : PCT(v)) },
  shake: { tab: 'comfort', g: 'Motion', label: 'Camera shake', fmt: PCT },
  speedFx: { tab: 'comfort', g: 'Motion', label: 'Speed effects', fmt: PCT },
  cameraRoll: { tab: 'comfort', g: 'Motion', label: 'Camera roll' },
  dialogueLookAt: { tab: 'comfort', g: 'Reading', label: 'Look at whoever is talking' },
  textSpeed: { tab: 'comfort', g: 'Reading', label: 'Text speed', names: { 30: 'Slow', 52: 'Normal', 90: 'Fast' } },
};
export const TABS = [['view', 'View'], ['controls', 'Controls'], ['sound', 'Sound'], ['comfort', 'Comfort']];
const DEV_GROUP = { kbm: 'Keyboard + mouse', touch: 'Touch', pad: 'Controller' };
let touchOnly = null;
const isTouchOnly = () => { if (touchOnly === null) { try { touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { touchOnly = false; } } return touchOnly; };
/** the device the menus are for: the last one used; a touch-only screen counts as touch before its first tap */
function curDev() {
  const d = deviceKind();
  if (d !== 'kbm') return d;
  return isTouchOnly() ? 'touch' : d;
}
/** a touch-only screen nobody has typed on: the keyboard + mouse rows (mouse speed, raw input, arrow look) do nothing
 *  there, so Settings leaves them out (a Bluetooth keyboard's first key press brings them back) */
export function kbmRowsHidden() {
  const d = G.input && G.input.lastDevice;
  return isTouchOnly() && d !== 'keyboard' && d !== 'mouse';
}

export class SettingsCard {
  constructor(card, ui) {
    this.card = card; this.ui = ui;
    this.tab = 'view'; this.f = 0; this.nav = new Nav();
    this.tabsEl = card.querySelector('.tabs'); this.body = card.querySelector('.sbody');
    this.tabsEl.innerHTML = TABS.map(([k, n]) => `<button class="tab" data-t="${k}">${n}</button>`).join('');
    this.tabsEl.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { this.setTab(b.dataset.t); this.f = -1; this.mark(); }));
    card.querySelector('[data-back]').addEventListener('click', () => this.ui.closeSettings());
    card.querySelector('[data-reset]').addEventListener('click', () => this.resetTab());
    settings.on('*', () => { if (this.open) this.sync(); });
    // scroll cue (rows below the fold): the chip scrolls the body on a click; scrolling updates the fades
    this.cueEl = card.querySelector('.smore'); this.cueDn = this.cueUp = false;
    this.body.addEventListener('scroll', () => this.cue(), { passive: true });
    if (this.cueEl) this.cueEl.addEventListener('click', () => { const b = this.body; try { b.scrollBy({ top: Math.max(60, b.clientHeight * 0.7), behavior: this.ui.reduced ? 'auto' : 'smooth' }); } catch (e) { b.scrollTop += b.clientHeight * 0.7; } });
  }
  /** the scroll cue: with rows past the bottom edge of the body, the edge fades and a "more ▾" chip sits on it (overlay
   *  scrollbars, a trackpad, a phone show nothing until you scroll: at 1280×720 the View tab's Graphics rows were below the
   *  fold with no sign of them); scrolled down, the top edge fades too. A layout read: on open, tab, scroll, resize only */
  cue() {
    const b = this.body, max = b.scrollHeight - b.clientHeight;
    const dn = max > 2 && b.scrollTop < max - 2, up = max > 2 && b.scrollTop > 2;
    if (dn !== this.cueDn) { this.cueDn = dn; b.classList.toggle('more-dn', dn); this.card.classList.toggle('more-dn', dn); }
    if (up !== this.cueUp) { this.cueUp = up; b.classList.toggle('more-up', up); }
  }
  /** every SCHEMA key with its tab (keys without META land in View · More; META.hidden keys get no row). The device in
   *  use puts its own group first, then Sword and Third person (touch: Touch · Sword · Third person · Controller), so a
   *  phone opens on its rows; noKbm (a touch-only screen, kbmRowsHidden) leaves the Keyboard + mouse rows out */
  keysOf(tab, dev = curDev(), noKbm = kbmRowsHidden()) {
    const mk = Object.keys(META), gs = [], has = (g) => mk.some((k) => META[k].tab === tab && META[k].g === g && !META[k].hidden);
    for (const g of [DEV_GROUP[dev], 'Sword', 'Third person']) if (g && has(g)) gs.push(g);
    for (const k of mk) if (META[k].tab === tab && !gs.includes(META[k].g)) gs.push(META[k].g);
    const rank = (k) => (META[k] ? gs.indexOf(META[k].g) * 1000 + mk.indexOf(k) : 1e6);
    const off = (k) => META[k] && (META[k].hidden || (noKbm && META[k].g === DEV_GROUP.kbm));
    return Object.keys(SCHEMA).filter((k) => (META[k] ? META[k].tab : 'view') === tab && !off(k)).sort((a, b) => rank(a) - rank(b));
  }
  show(fromTitle) { this.open = true; this.fromTitle = !!fromTitle; this.kb = false; this.setTab(this.tab); this.f = -1; this.mark(); }
  hide() { this.open = false; }
  setTab(t) {
    this.tab = t;
    this.tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    let html = '', g = null;
    const rows = [];
    if (t === 'sound') rows.push('_mute');
    rows.push(...this.keysOf(t));
    for (const k of rows) {
      const m = META[k] || { g: 'More', label: k }, sc = SCHEMA[k];
      const grp = k === '_mute' ? 'Volume' : m.g;
      if (grp !== g) { g = grp; html += `<div class="sgrp">${esc(g)}</div>`; }
      html += this.rowHtml(k, m, sc);
    }
    this.body.innerHTML = html;
    this.body.scrollTop = 0;                // a new tab opens at its top (the cue then says what is below)
    this.rows = [...this.body.querySelectorAll('.srow')];
    this.rows.forEach((r, i) => {
      const k = r.dataset.k;
      r.addEventListener('mousemove', () => { if (this.f !== i || this.kb) { this.kb = false; this.f = i; this.mark(false); } });
      r.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => { this.f = i; this.set(k, decode(SCHEMA[k], b.dataset.v)); }));
      const tg = r.querySelector('.tog');
      if (tg) tg.addEventListener('click', () => { this.f = i; this.toggle(k); });
      const rg = r.querySelector('input[type=range]');
      if (rg) {
        rg.addEventListener('input', () => { this.f = i; this.set(k, +rg.value, true); });
        rg.addEventListener('change', () => rg.blur());
      }
    });
    this.sync();
    if (this.open) this.cue();
  }
  rowHtml(k, m, sc) {
    const note = m.note && hasKeys(m.note) ? `<div class="snote">${fmtKeys(m.note, { html: true })}</div>` : '';
    let ctl;
    if (k === '_mute') ctl = `<button class="tog" aria-label="Sound"><i></i></button>`;
    else if (sc.opts) ctl = `<div class="seg">${sc.opts.map((o) => `<button data-v="${esc(o)}">${esc(m.names && m.names[o] != null ? m.names[o] : o)}</button>`).join('')}</div>`;
    else if (typeof sc.def === 'boolean') ctl = `<button class="tog" aria-label="${esc(m.label)}"><i></i></button>`;
    else ctl = `<input type="range" min="${sc.min}" max="${sc.max}" step="${sc.step || 0.01}" aria-label="${esc(m.label)}"><span class="sval"></span>`;
    return `<div class="srow" data-k="${k}"><div class="slab">${esc(k === '_mute' ? 'Sound' : m.label)}${note}</div><div class="sctl">${ctl}</div></div>`;
  }
  /** reflect the current values (also after V / X change a setting from the keyboard) */
  sync() {
    for (const r of this.rows || []) {
      const k = r.dataset.k;
      if (k === '_mute') { r.querySelector('.tog').classList.toggle('on', !isMuted()); continue; }
      const sc = SCHEMA[k], v = settings.get(k), m = META[k] || {};
      if (sc.opts) r.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', String(v) === b.dataset.v));
      else if (typeof sc.def === 'boolean') r.querySelector('.tog').classList.toggle('on', !!v);
      else {
        const rg = r.querySelector('input[type=range]');
        if (document.activeElement !== rg || +rg.value !== v) rg.value = v;
        rg.style.setProperty('--p', ((v - sc.min) / (sc.max - sc.min) * 100).toFixed(1) + '%');
        r.querySelector('.sval').innerHTML = m.fmt ? m.fmt(v) : String(v);
      }
    }
  }
  set(k, v, quiet) { const before = settings.get(k); settings.set(k, v); if (settings.get(k) !== before && !quiet) uiSfx('uiSlider'); this.sync(); }
  toggle(k) {
    if (k === '_mute') { toggleMute(); sfx('select'); this.sync(); return; }
    this.set(k, !settings.get(k)); uiSfx('uiSelect');
  }
  /** keyboard / pad step on the focused row: d = -1 | 1 */
  step(d) {
    const r = this.rows[this.f]; if (!r) return;
    const k = r.dataset.k;
    if (k === '_mute') return this.toggle(k);
    const sc = SCHEMA[k], v = settings.get(k);
    if (sc.opts) { const i = sc.opts.indexOf(v); this.set(k, sc.opts[Math.max(0, Math.min(sc.opts.length - 1, (i < 0 ? 0 : i) + d))]); }
    else if (typeof sc.def === 'boolean') this.set(k, d > 0);
    else this.set(k, v + d * (sc.step || 0.05));
  }
  resetTab() { for (const k of this.keysOf(this.tab)) settings.reset(k); uiSfx('uiBack'); this.sync(); }
  /** focus: -1 = the tab bar; then the rows; then Reset and Back */
  items() { return this.rows.length + 2; }
  mark(scroll = true) {
    this.card.classList.toggle('kbnav', !!this.kb);
    this.tabsEl.classList.toggle('foc', this.f === -1);
    this.rows.forEach((r, i) => r.classList.toggle('foc', i === this.f));
    const btns = [this.card.querySelector('[data-reset]'), this.card.querySelector('[data-back]')];
    btns.forEach((b, i) => b.classList.toggle('sel', this.f === this.rows.length + i));
    const el = this.f >= 0 && this.f < this.rows.length ? this.rows[this.f] : null;
    if (scroll && el && el.scrollIntoView) try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
  }
  input(input, dt) {
    const o = this.nav.read(input, dt);
    if ((o.x || o.y || o.ok || o.prev || o.next) && !this.kb) { this.kb = true; this.mark(false); }
    if (o.back) { this.ui.closeSettings(); return; }
    if (o.prev || o.next) { const i = TABS.findIndex((t) => t[0] === this.tab); this.setTab(TABS[(i + (o.next ? 1 : -1) + TABS.length) % TABS.length][0]); this.f = -1; this.mark(); uiSfx('uiTab'); return; }
    if (o.y) { this.f = Math.max(-1, Math.min(this.items() - 1, this.f + o.y)); this.mark(); uiSfx('uiMove'); }
    if (o.x) {
      if (this.f === -1) { const i = TABS.findIndex((t) => t[0] === this.tab); this.setTab(TABS[(i + o.x + TABS.length) % TABS.length][0]); this.mark(); uiSfx('uiTab'); }
      else if (this.f < this.rows.length) this.step(o.x);
    }
    if (o.ok) {
      if (this.f === this.rows.length) this.resetTab();
      else if (this.f === this.rows.length + 1) this.ui.closeSettings();
      else if (this.f >= 0) {
        const k = this.rows[this.f].dataset.k, sc = SCHEMA[k];
        if (k === '_mute' || (sc && typeof sc.def === 'boolean')) this.toggle(k);
        else if (sc && sc.opts) { const i = sc.opts.indexOf(settings.get(k)); this.set(k, sc.opts[(i + 1) % sc.opts.length]); }
      } else { this.f = 0; this.mark(); }
    }
  }
}
function decode(sc, s) { return typeof sc.def === 'number' ? +s : s; }

// ------------------------------------------------------------------ controls reference
// (look / move: the pictogram of the device tab, below)
const ROWS = [
  ['look', 'Look around', 'pic_mouse'], ['move', 'Walk', 'pic_keycap'], ['attack', 'Swing (keep going for a 3-hit combo)', 'act_swing'],
  ['jump', 'Hop', 'act_hop'], ['dash', 'Roll · keep holding to sprint', 'act_roll'], ['interact', 'Talk, read, open (look at it first)', 'act_use'],
  ['lock', 'Lock on', 'act_lock'], ['potion', 'Drink a potion', 'potion'], ['view', 'First ↔ third person', 'act_view'],
  ['shoulder', 'Swap shoulder (third person)', 'act_view'], ['zoom', 'Camera distance (third person)', 'act_view'], ['map', 'Map', 'act_map'], ['pause', 'Pause', 'act_settings'],
];
const DEVS = [['kbm', 'Keyboard + mouse', 'pic_mouse'], ['pad', 'Controller', 'pic_controller'], ['touch', 'Touch', 'pic_phone']];
const DEV_PIC = { pad: { look: 'pic_controller', move: 'pic_controller' }, touch: { look: 'pic_phone', move: 'pic_phone' } };
export class ControlsCard {
  constructor(card, ui) {
    this.card = card; this.ui = ui; this.nav = new Nav();
    this.tabsEl = card.querySelector('.tabs'); this.grid = card.querySelector('.controls-grid');
    this.tabsEl.innerHTML = DEVS.map(([k, n, p]) => `<button class="tab" data-d="${k}">${iconHtml(p, '', 'tico')}${n}</button>`).join('');
    this.tabsEl.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => this.setDev(b.dataset.d)));
    card.querySelector('[data-close]').addEventListener('click', () => this.ui.closeControls());
  }
  show() { this.setDev(curDev()); }
  setDev(d) {
    this.dev = d;
    this.tabsEl.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.d === d));
    // core: with "Arrow keys look around" on, the arrows are a look control, not a move one (input.js arrowLook)
    const B = d === 'kbm' && settings.get('arrowLook') ? { ...ALL.kbm, move: ALL.kbm.move.slice(0, 1), look: [...ALL.kbm.look, '← ↑ → ↓'] } : ALL[d];
    this.grid.innerHTML = ROWS.filter(([a]) => B[a]).map(([a, label, ic]) => {
      const caps = B[a].map((t) => (d === 'touch' ? `<span class="kw">${esc(t)}</span>` : keyCap(a, d === 'kbm' ? 'keyboard' : d, t))).join('<span class="or">/</span>');
      return `<div class="crow">${iconHtml((DEV_PIC[d] && DEV_PIC[d][a]) || ic, '•', 'cico')}<div class="k">${esc(label)}</div><div class="v">${caps}</div></div>`;
    }).join('');
  }
  input(input, dt) {
    const o = this.nav.read(input, dt);
    if (o.x || o.prev || o.next) { const i = DEVS.findIndex((q) => q[0] === this.dev), d = o.x || (o.next ? 1 : -1); this.setDev(DEVS[(i + d + DEVS.length) % DEVS.length][0]); uiSfx('uiTab'); }
    else if (o.back || o.ok) this.ui.closeControls();
    else if (o.y) { const g = this.grid; g.scrollTop += o.y * 60; }
  }
}
