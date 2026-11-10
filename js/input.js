// Keyboard / mouse / gamepad / touch → actions with per-frame edge detection.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyJ: 'attack', Space: 'attack', KeyK: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyF: 'interact', Enter: 'interact', KeyR: 'potion', KeyM: 'map', Tab: 'map', Escape: 'pause', KeyP: 'pause',
  KeyQ: 'camL', KeyE: 'camR',
};
const PREVENT = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backquote']);

export class Input {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keyEdges = new Set();      // raw key codes pressed this frame
    this.actHeld = new Set();
    this.actPrev = new Set();
    this.actPressed = new Set();
    this.pending = new Set();       // actions pressed via events since last update
    this.orbit = 0;                 // accumulated yaw delta (radians) from mouse/touch
    this.pitchDelta = 0;
    this.wheel = 0;
    this.stick = { x: 0, y: 0 };    // touch stick
    this.touchHeld = new Set();
    this.padPrev = [];
    this.padActive = false;
    this.lastDevice = 'keyboard';
    this.anyPressed = false;
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.keyEdges.add(e.code);
      const a = KEYMAP[e.code];
      if (a) this.pending.add(a);
      this.pending.add('any');
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touchHeld.clear(); });
    // mouse
    let drag = null;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.focus();
      if (e.pointerType === 'touch') return;
      if (e.button === 0) { this.pending.add('attack'); this.pending.add('click'); this.pending.add('any'); }
      if (e.button === 2 || e.button === 1) { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
      this.lastDevice = 'mouse';
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      this.orbit -= (e.clientX - drag.x) * 0.006;
      this.pitchDelta += (e.clientY - drag.y) * 0.004;
      drag.x = e.clientX; drag.y = e.clientY;
    });
    window.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
    this.setupTouch(ui);
  }
  setupTouch(ui) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.className = 'hidden';
    root.innerHTML = `<div class="stick"><div class="nub"></div></div>
      <div class="tb a" data-a="attack">A</div><div class="tb b" data-a="dash">B</div>
      <div class="tb sm pot" data-a="potion">🧪</div><div class="tb sm map" data-a="map">🗺</div><div class="tb sm pause" data-a="pause">II</div>`;
    ui.appendChild(root);
    this.touchRoot = root;
    const stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
    let sid = null, sx = 0, sy = 0;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      let dx = (e.clientX - sx) / 55, dy = (e.clientY - sy) / 55;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stick.x = dx; this.stick.y = -dy;
      nub.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; this.stick.x = this.stick.y = 0; nub.style.transform = ''; };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    root.querySelectorAll('.tb').forEach((b) => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.pending.add(a); this.pending.add('any'); if (a === 'attack') this.pending.add('interactSoft'); this.touchHeld.add(a); });
      const up = () => this.touchHeld.delete(a);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // drag on the canvas to orbit
    const drags = new Map();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.showTouch();
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      this.orbit -= (e.clientX - d.x) * 0.008;
      this.pitchDelta += (e.clientY - d.y) * 0.004;
      d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
      d.x = e.clientX; d.y = e.clientY;
    });
    const tEnd = (e) => {
      const d = drags.get(e.pointerId);
      if (d && d.moved < 10 && performance.now() - d.t < 300) { this.pending.add('click'); this.pending.add('any'); }
      drags.delete(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', tEnd);
    this.canvas.addEventListener('pointercancel', tEnd);
    window.addEventListener('touchstart', () => this.showTouch(), { once: true, passive: true });
  }
  showTouch() { if (this.touchRoot && !this.touchVisible) { this.touchVisible = true; this.touchRoot.classList.remove('hidden'); this.lastDevice = 'touch'; } }
  setTouchVisible(on) { if (this.touchRoot && this.touchVisible) this.touchRoot.style.display = on ? '' : 'none'; }

  update() {
    this.actPrev = this.actHeld;
    this.actHeld = new Set();
    for (const k of this.keys) { const a = KEYMAP[k]; if (a) this.actHeld.add(a); }
    for (const a of this.touchHeld) this.actHeld.add(a);
    this.padAxis = { x: 0, y: 0 };
    this.padCam = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const map = [[0, 'attack'], [1, 'dash'], [2, 'interact'], [3, 'potion'], [8, 'map'], [9, 'pause'], [4, 'camL'], [5, 'camR'], [12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']];
      for (const [i, a] of map) if (b(i)) { this.actHeld.add(a); if (!this.padPrev[i]) { this.pending.add(a); this.pending.add('any'); this.lastDevice = 'pad'; } }
      this.padPrev = map.reduce((acc, [i]) => { acc[i] = b(i); return acc; }, []);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { this.padAxis.x = ax; this.padAxis.y = -ay; this.lastDevice = 'pad'; }
      const rx = p.axes[2] || 0;
      if (Math.abs(rx) > 0.2) this.padCam = rx;
      const ry = p.axes[3] || 0;
      if (Math.abs(ry) > 0.25) this.pitchDelta += ry * 0.02;
      break;
    }
    this.actPressed = this.pending;
    this.pending = new Set();
    this.edges = this.keyEdges;
    this.keyEdges = new Set();
    this.anyPressed = this.actPressed.has('any');
  }
  pressed(a) { return this.actPressed.has(a); }
  held(a) { return this.actHeld.has(a); }
  keyPressed(code) { return this.edges && this.edges.has(code); }
  consume(a) { this.actPressed.delete(a); }
  confirm() { return this.pressed('attack') || this.pressed('interact') || this.pressed('click'); }
  cancel() { return this.pressed('pause') || this.pressed('dash'); }
  menuNav() {
    if (this.pressed('up') || this.keyPressed('KeyW')) return -1;
    if (this.pressed('down') || this.keyPressed('KeyS')) return 1;
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
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y, l: Math.min(1, l) };
  }
  takeOrbit() { const o = this.orbit; this.orbit = 0; return o; }
  takePitch() { const p = this.pitchDelta; this.pitchDelta = 0; return p; }
  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }
}
