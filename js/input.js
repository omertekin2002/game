// Input v2: the canonical action map (RULINGS §1 / feel §14), per-frame edges, look accumulators (mouse counts,
// touch px, pad stick with radial dead zone + response curve), last-device tracking, and canvas click isolation:
// with a cursor menu open (shop, pause, map...) canvas clicks do nothing; a click that only asks for the pointer lock
// is consumed. Touch DOM: touch.js. Pointer-lock state machine: input-lock.js.
import { TouchMixin } from './touch.js';
import { G } from './core.js';
import { EV } from './events.js';
import { settings } from './settings.js';
import { buildKeymap, effectiveKeys, activeSecondary, keyLabel } from './keybinds.js';
import { buildPadmap, effectivePad, activePadSecondary, padLabel, MENU_PADMAP, DEFAULT_PAD, PAD_BUTTONS } from './padbinds.js';

// Keyboard: the map is built from the bindings (setting `keys`, js/keybinds.js) and rebuilt when they change:
// W/A/S/D move, J attack, Space jump, Shift (+ K, Right Shift) roll, held = sprint, E (+ F) interact, R potion, V view,
// X shoulder, Q lock, M (+ Tab) map; fixed: the arrows move, Enter / NumpadEnter interact, Esc / P pause.
// Standard-mapping pad (feel §14.2), built from the bindings (setting `pad`, js/padbinds.js) and rebuilt when they change:
// A jump, B roll / held sprint, X (+ RT) attack, Y interact, LB (+ D↓) potion, RB (+ D↑) view, D← (+ D→) shoulder,
// R3 lock toggle, LT lock hold, L3 sprint toggle, Back map; fixed: Start pause. Menus, dialogue, the shop and the map
// read the pad in that default layout whatever the bindings are (MENU_PADMAP → menuPressed); D-pad / stick navigate them.
let KEYMAP = {}, KEY_HELD = {};    // code → action / code → 'sprint' (buildKeys)
let PADMAP = [], PAD_HELD = [];    // button → action / button → [held-only actions] (buildPad)
/** single source for prompts, the controls card and hints (WP6 renders it) */
export const BINDINGS = {
  kbm: kbmBindings(buildKeys()),
  pad: padBindings(buildPad()),
  touch: { move: 'left stick', look: 'drag right side', attack: 'A', jump: 'Jump', dash: 'B', interact: 'Use', potion: '🧪', view: '👁', map: '🗺', pause: 'II' },
};
/** (re)build the keyboard maps and BINDINGS.kbm from the stored bindings (at load, and on every change of `keys`) */
function buildKeys() {
  const k = settings.get('keys');
  ({ map: KEYMAP, held: KEY_HELD } = buildKeymap(k));
  return k;
}
/** BINDINGS.kbm labels for the bindings in effect */
function kbmBindings(k) {
  const e = effectiveKeys(k), s = activeSecondary(k), L = keyLabel, alt = (a) => s[a].filter((c) => c !== 'ShiftRight').map(L);
  return {
    move: [e.up, e.left, e.down, e.right].map(L).join(' '), look: 'Mouse', attack: 'LMB / ' + L(e.attack), jump: L(e.jump),
    dash: [L(e.dash), ...alt('dash')].join(' / '), interact: [L(e.interact), ...alt('interact'), 'Enter'].join(' / '),
    lockOn: L(e.lockOn) + ' / MMB / RMB hold', potion: L(e.potion), view: L(e.view), shoulder: L(e.shoulder), zoom: 'Wheel',
    map: [L(e.map), ...alt('map')].join(' / '), pause: 'Esc / P',
  };
}
settings.on('keys', () => { BINDINGS.kbm = kbmBindings(buildKeys()); });
/** (re)build the pad maps from the stored buttons (at load, and on every change of `pad`) */
function buildPad() {
  const p = settings.get('pad');
  ({ map: PADMAP, held: PAD_HELD } = buildPadmap(p));
  return p;
}
/** BINDINGS.pad labels for the buttons in effect */
function padBindings(p) {
  const e = effectivePad(p), s = activePadSecondary(p), L = padLabel, w = (a) => [L(e[a]), ...s[a].map(L)].join(' / ');
  const shoulder = e.shoulder === DEFAULT_PAD.shoulder && s.shoulder.length ? 'D-pad ← →' : L(e.shoulder);
  return {
    move: 'L stick', look: 'R stick', attack: w('attack'), jump: L(e.jump), dash: L(e.dash), interact: L(e.interact),
    lockOn: L(e.lockHold) + ' / ' + L(e.lockOn), potion: L(e.potion), view: L(e.view), shoulder, map: L(e.map), pause: 'Start',
  };
}
settings.on('pad', () => { BINDINGS.pad = padBindings(buildPad()); });
// Enter/Space never reach a focused DOM button natively (the game's own confirm handles them)
const PREVENT = new Set(['Tab', 'Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote']);
const BTN_BIT = [1, 4, 2];           // e.button 0 / 1 / 2 (LMB / MMB / RMB) → e.buttons bit
const OUTLIER = 300;                 // drop single mouse events larger than this (Chrome lock/engage spikes)
const DRAG_K = 0.0035 / 0.0022;      // drag-look fallback runs 0.0035 rad per CSS px through the same mouse path
const CURVE = { linear: 1.0, default: 1.8, precise: 2.6 };
const CLICK_GUARD = 300;             // ms after a cursor menu closes during which canvas mouse presses do nothing
// Keyboard look (setting arrowLook, feel §3.5): ←/→ yaw 60°/s ramping to 140°/s over 0.25 s, ↑/↓ pitch 90°/s. It is fed
// to view.applyLook as a right-stick deflection (full stick = yaw 200°/s, pitch 140°/s; × Pad sensitivity, the pad's two
// invert switches apply), so every look consumer (assist cancel, the lock-on idle test, coach marks) sees it as look input. The
// deflection stays under the stick's turn-boost threshold (m < 0.95).
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const KEY_LOOK = { yaw0: 60 / 200, yaw1: 140 / 200, ramp: 0.25, pitch: 90 / 140 };

/** the device to assume before any input: a phone / tablet (coarse primary pointer and no fine pointer at all) is
 *  'touch', so text shows touch words from the first frame (loading tips, title); everything else 'keyboard' */
export function firstDevice(mm = (q) => matchMedia(q)) {
  try { return mm('(pointer: coarse)').matches && !mm('(any-pointer: fine)').matches ? 'touch' : 'keyboard'; } catch (e) { return 'keyboard'; }
}

/** radial dead zone with rescale: |s| inside `inner` → 0, beyond `outer` → 1, direction preserved */
function radial(x, y, inner, outer, exp = 1) {
  const l = Math.hypot(x, y);
  if (l <= inner) return { x: 0, y: 0, m: 0 };
  const m = Math.min(1, (l - inner) / (outer - inner)), c = Math.pow(m, exp);
  return { x: (x / l) * c, y: (y / l) * c, m };
}

export class Input {
  constructor(canvas, ui, lock = null) {
    this.canvas = canvas;
    this.lock = lock;
    this.keys = new Set();
    this.keyEdges = new Set();      // raw key codes pressed this frame
    this.actHeld = new Set();
    this.actPrev = new Set();
    this.actPressed = new Set();
    this.pending = new Set();       // actions pressed via events since last update
    this.mouse = { x: 0, y: 0 };    // mouse counts since the last takeMouse()
    this.touchLook = { x: 0, y: 0 };// touch look px since the last takeTouch()
    this._mo = { x: 0, y: 0 }; this._to = { x: 0, y: 0 };
    this.lookStick = { x: 0, y: 0, m: 0 };
    this.padAxis = { x: 0, y: 0 };
    this.wheel = 0;
    this.stick = { x: 0, y: 0 };    // touch stick
    this.touchHeld = new Set(); this.mouseHeld = new Set(); this.debugHeld = new Set();
    this.debugAxis = null;          // G.debug.move
    this.debugStick = null;         // { rx, ry } raw right stick override (tests)
    this.padPrev = []; this.padNav = 0;
    this.padCapture = null;         // fn(button): the Settings card waits for a pad button to bind; that press is no input
    this.mPressed = new Set();      // this frame's edges as the menus see them: the pad in its default layout (menuPressed)
    this.modal = false;             // Game sets it each frame: dialogue, the shop or a menu was open as the frame began
    this.lastDevice = firstDevice(); this.deviceT = 0; this.emittedDevice = null;
    this.keyLook = { x: 0, y: 0, m: 0 }; this.arrowT = 0; this.arrowDir = 0; // arrow-key look (setting arrowLook)
    this.cursorMenu = false;        // Game sets it each frame: shop/menus own the mouse (setter below)
    this.cursorOffAt = -1e9;        // when the last cursor menu closed: canvas presses stay inert for CLICK_GUARD ms
    this.drag = null;               // drag-look fallback (no pointer lock)
    this.dropped = 0;
    this.anyPressed = false;
    this.keyCapture = null;         // fn(code): the Settings card waits for a key to bind; that press is no input
    window.addEventListener('keydown', (e) => {
      if (this.keyCapture) {
        e.preventDefault();
        if (e.repeat) return;
        const fn = this.keyCapture; this.keyCapture = null;
        this.setDevice('keyboard');
        try { fn(e.code); } catch (err) { console.error('[Starseed] key capture', err); }
        return;
      }
      // a key bound to an action does not also do its browser thing (' and / open Firefox's quick find); letters and
      // digits have none worth stopping
      if (PREVENT.has(e.code) || (KEYMAP[e.code] && !/^(Key|Digit)/.test(e.code))) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.keyEdges.add(e.code);
      const a = KEYMAP[e.code];
      if (a) this.pending.add(a);
      this.pending.add('any');
      this.setDevice('keyboard');
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touchHeld.clear(); this.mouseHeld.clear(); this.drag = null; this.btns = 0; this.btnLive = false; });
    // mouse buttons: Pointer Events fire pointerdown only for the first button of a chord and pointerup only for the
    // last; the others arrive as pointermove with e.button set. Diffing e.buttons on all three sees every button.
    this.btns = 0;                  // e.buttons bits seen so far (1 LMB, 2 RMB, 4 MMB)
    this.btnLive = false;           // this chord began on the canvas in play (not a lock request, not a cursor menu)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.focus();
      if (e.pointerType === 'touch') return;
      this.setDevice('mouse');
      this.mouseButtons(e, 0);                                       // pointerdown starts a chord: drop stale bits
      if (this.cursorMenu || performance.now() - this.cursorOffAt < CLICK_GUARD) this.btnLive = false; // shop / menu open (or just closed: a double-click's 2nd click): inert
      else if (this.lock && this.lock.onCanvasDown(e)) { this.btnLive = false; e.preventDefault(); } // only asks for the lock
      else this.btnLive = true;
      this.mouseButtons(e, e.buttons || BTN_BIT[e.button] || 0);
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.buttons !== this.btns) this.mouseButtons(e);           // chorded press / release
      const L = this.lock;
      if (L && L.locked) {
        this.setDevice('mouse');
        if (L.dropMoves > 0) { L.dropMoves--; return; }
        this.addMouse(e.movementX || 0, e.movementY || 0);
        return;
      }
      const d = this.drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (!d.look && d.moved > 6) d.look = true;                     // LMB press-drag > 6 px looks too
      if (d.look) this.addMouse(dx, dy, DRAG_K);
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouseButtons(e);
      if (this.drag && e.pointerId === this.drag.id) this.drag = null;
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1); }, { passive: false });
    this.setupTouch(ui);
  }

  get cursorMenu() { return this._cursor; }
  set cursorMenu(v) { if (this._cursor && !v) this.cursorOffAt = performance.now(); this._cursor = v; }
  setDevice(d) { if (d !== this.lastDevice) { this.lastDevice = d; this.deviceT = performance.now(); } }
  /** button bits changed: presses act only inside a live chord; releases always clear (no stuck lockHold) */
  mouseButtons(e, now = e.buttons | 0) {
    const was = this.btns;
    this.btns = now;
    for (const b of [0, 1, 2]) {
      const bit = BTN_BIT[b];
      if ((now & bit) && !(was & bit)) { if (this.btnLive && !this.cursorMenu) this.mouseDown(b, e); }
      else if (!(now & bit) && (was & bit) && b === 2) this.mouseHeld.delete('lockHold');
    }
    if (!now) this.btnLive = false;
  }
  mouseDown(b, e) {
    const fallback = !this.lock || !this.lock.supported;
    if (b === 0) { this.pending.add('attack'); this.pending.add('click'); this.pending.add('any'); }
    if (b === 1) { this.pending.add('lockOn'); this.pending.add('any'); e.preventDefault(); }
    if (b === 2 && !fallback) this.mouseHeld.add('lockHold');
    if (fallback && (b === 0 || b === 2)) {
      if (this.drag) { if (b === 2) this.drag.look = true; return; } // a chord keeps the drag that's running
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, look: b === 2 };
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  }
  /** raw mouse counts (pointer-lock movementX/Y, drag px × k, or G.debug.lookDelta); single outliers are dropped */
  addMouse(dx, dy, k = 1) {
    if (Math.abs(dx) > OUTLIER || Math.abs(dy) > OUTLIER) { this.dropped++; return false; }
    this.mouse.x += dx * k; this.mouse.y += dy * k;
    return true;
  }
  takeMouse() { const o = this._mo; o.x = this.mouse.x; o.y = this.mouse.y; this.mouse.x = this.mouse.y = 0; return o; }
  takeTouch() { const o = this._to; o.x = this.touchLook.x; o.y = this.touchLook.y; this.touchLook.x = this.touchLook.y = 0; return o; }
  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  /** per frame (dt: this frame's clock dt, for the arrow-look ramp) */
  update(dt = 1 / 60) {
    this.actPrev = this.actHeld;
    this.actHeld = new Set();
    // Arrow keys look instead of moving (setting arrowLook) while no cursor menu owns the input. Their press edges stay
    // (↑↓ ←→ still work in dialogue and menus), and in cursor menus (map panning, slider repeat) they are held as before
    const arrowLook = !this.cursorMenu && settings.get('arrowLook');
    let kx = 0, ky = 0;
    for (const k of this.keys) {
      const ar = arrowLook && ARROWS[k];
      if (ar) { kx += ar[0]; ky += ar[1]; continue; }
      const a = KEYMAP[k]; if (a) this.actHeld.add(a); const b = KEY_HELD[k]; if (b) this.actHeld.add(b);
    }
    this.arrowStick(kx, ky, dt);
    for (const a of this.touchHeld) this.actHeld.add(a);
    for (const a of this.mouseHeld) this.actHeld.add(a);
    for (const a of this.debugHeld) this.actHeld.add(a);
    this.padAxis.x = this.padAxis.y = 0;
    let look = { x: 0, y: 0, m: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    // pad edges: gameplay ones (the bindings, PADMAP) and the menus' (the default layout, MENU_PADMAP) apart; the other
    // devices' edges (this.pending) go to both. navUp / navDown are the physical D-pad ↑ / ↓ (and the stick) in both
    const padGame = new Set(), padMenu = new Set(), both = (a) => { padGame.add(a); padMenu.add(a); };
    let capHit = -1;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const now = [], n = Math.min(p.buttons.length, PAD_BUTTONS);
      for (let i = 0; i < n; i++) {
        if (!(now[i] = b(i))) continue;
        const edge = !this.padPrev[i];
        if (edge) this.setDevice('pad');
        if (this.padCapture) { if (edge && capHit < 0) capHit = i; continue; }    // a rebind wait takes the pad
        const a = PADMAP[i], m = MENU_PADMAP[i];
        if (a) this.actHeld.add(a);
        if (PAD_HELD[i]) for (const h of PAD_HELD[i]) this.actHeld.add(h);
        if (!edge) continue;
        if (a) padGame.add(a);
        if (m) padMenu.add(m);
        if (a || m) both('any');
        if (i === 12) both('navUp');
        if (i === 13) both('navDown');
      }
      this.padPrev = now;
      const mv = radial(p.axes[0] || 0, p.axes[1] || 0, 0.18, 0.95);
      if (mv.m > 0) { this.padAxis.x = mv.x; this.padAxis.y = -mv.y; this.setDevice('pad'); }
      const ny = (p.axes[1] || 0) < -0.6 ? -1 : (p.axes[1] || 0) > 0.6 ? 1 : 0;
      if (ny && ny !== this.padNav) both(ny < 0 ? 'navUp' : 'navDown');
      this.padNav = ny;
      look = radial(p.axes[2] || 0, p.axes[3] || 0, 0.15, 0.92, CURVE[settings.get('padCurve')] || 1.8);
      if (look.m > 0) this.setDevice('pad');
      break;
    }
    if (this.debugStick) look = radial(this.debugStick.rx || 0, this.debugStick.ry || 0, 0.15, 0.92, CURVE[settings.get('padCurve')] || 1.8);
    else if (!(look.m > 0) && this.keyLook.m > 0) look = this.keyLook;     // a pushed pad stick wins over the arrows
    this.lookStick = look;
    this.mPressed = new Set(this.pending);
    for (const a of padMenu) this.mPressed.add(a);
    for (const a of padGame) this.pending.add(a);
    this.actPressed = this.pending;
    this.pending = new Set();
    if (capHit >= 0) {
      const fn = this.padCapture; this.padCapture = null;
      try { fn(capHit); } catch (err) { console.error('[Starseed] pad capture', err); }
    }
    this.edges = this.keyEdges;
    this.keyEdges = new Set();
    this.anyPressed = this.actPressed.has('any');
    if (this.lastDevice !== this.emittedDevice && performance.now() - this.deviceT >= 300) {
      this.emittedDevice = this.lastDevice;
      if (G.events) G.events.emit(EV.DEVICE, { device: this.lastDevice });
    }
  }
  /** held arrow directions (kx / ky: −1…1, + = right / down like the stick) → this.keyLook, a stick deflection at the
   *  feel §3.5 rates; the yaw ramp restarts when the horizontal direction changes or is released */
  arrowStick(kx, ky, dt) {
    kx = Math.sign(kx); ky = Math.sign(ky);
    this.arrowT = kx && kx === this.arrowDir ? this.arrowT + dt : 0;
    this.arrowDir = kx;
    const K = KEY_LOOK, o = this.keyLook;
    o.x = kx * (K.yaw0 + (K.yaw1 - K.yaw0) * Math.min(1, this.arrowT / K.ramp));
    o.y = ky * K.pitch;
    o.m = Math.min(0.94, Math.hypot(o.x, o.y));
    return o;
  }
  pressed(a) { return this.actPressed.has(a); }
  /** a press edge as menus, dialogue, the shop and the map read it: keyboard, mouse and touch as pressed(), the pad in
   *  its default layout whatever its bindings (A jump = confirm, B dash = back, LB / RB potion / view = tabs) */
  menuPressed(a) { return this.mPressed.has(a); }
  /** for per-frame toggles that also run under modal UI (view, shoulder, sprint latch): menu edges while a modal UI
   *  owns the frame (a pad button remapped onto A / B does not also toggle while it confirms or goes back), else pressed */
  framePressed(a) { return this.modal ? this.menuPressed(a) : this.pressed(a); }
  held(a) { return this.actHeld.has(a); }
  keyPressed(code) { return this.edges && this.edges.has(code); }
  consume(a) { this.actPressed.delete(a); this.mPressed.delete(a); }
  /** drop every press edge of this frame (a card closed by it: game.frame) */
  consumeAll() { this.actPressed.clear(); this.mPressed.clear(); this.anyPressed = false; }
  /** menu / dialogue confirm: LMB, J, E, F, Enter, Space, pad A/X/Y, touch tap */
  confirm() { return this.menuPressed('attack') || this.menuPressed('interact') || this.menuPressed('click') || this.menuPressed('jump'); }
  cancel() { return this.menuPressed('pause') || this.menuPressed('dash'); }
  menuNav() {
    if (this.menuPressed('up') || this.menuPressed('navUp')) return -1;
    if (this.menuPressed('down') || this.menuPressed('navDown')) return 1;
    return 0;
  }
  axis() {
    let x = 0, y = 0;
    if (this.actHeld.has('left')) x -= 1;
    if (this.actHeld.has('right')) x += 1;
    if (this.actHeld.has('up')) y += 1;
    if (this.actHeld.has('down')) y -= 1;
    x += this.stick.x + this.padAxis.x;
    y += this.stick.y + this.padAxis.y;
    if (this.debugAxis) { x += this.debugAxis.x; y += this.debugAxis.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, l: Math.min(1, l) };
  }
  /** debug/test injection: a press edge now, optionally held for ms (wall clock) or until release() */
  debugPress(a, ms = 0) {
    this.pending.add(a); this.pending.add('any');
    if (ms > 0) { this.debugHeld.add(a); setTimeout(() => this.debugHeld.delete(a), ms); }
  }
  debugHold(a, ms) { this.debugPress(a, 0); this.debugHeld.add(a); if (ms > 0) setTimeout(() => this.debugHeld.delete(a), ms); }
  debugRelease(a) { if (a) this.debugHeld.delete(a); else this.debugHeld.clear(); }
}
Object.assign(Input.prototype, TouchMixin);
