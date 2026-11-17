// Pointer-lock manager (arch §5.3, RULINGS). Game sets `wanted` every frame (play, dialogue, cutscenes and fades: yes;
// pause, shop, map, controls card, ending, title: no). A request only goes out while the page holds a fresh user
// activation (a click or a non-Esc key; the closing click/key of a menu counts), so failures are rare; a failure
// cools down 1.1 s and the "Click to play" veil asks for a click. Losing the lock while it is wanted calls onLost
// (Game opens pause). A canvas press while the lock is wanted but missing only asks for it and is consumed.
// Unsupported API or ?nolock=1 → `supported` false: the mouse looks by drag (input.js), no veil, tests never lock.
// A page that can never get the lock (sandboxed iframe without allow-pointer-lock, or real clicks refused twice away
// from Chrome's short re-lock refusal after an Esc) drops to the same drag-look fallback at runtime.
import { G } from './core.js';
import { EV } from './events.js';

const REFUSALS = 2;            // gesture-backed refusals (no success in between) before falling back for good
const AFTER_LOSS = 2500;       // ms after a lock loss/release during which refusals don't count (Esc re-lock refusal)

export class PointerLock {
  constructor(canvas, { nolock = false, raw = () => false } = {}) {
    this.canvas = canvas;
    this.raw = raw;                          // settings.rawInput → { unadjustedMovement: true }
    this.supported = !nolock && typeof canvas.requestPointerLock === 'function' && 'pointerLockElement' in document;
    this.locked = false; this.wanted = false; this.veil = false;
    this.pending = false; this.expectUnlock = false; this.failed = false;
    this.coolUntil = 0; this.gestureT = -1e9; this.pendT = 0;
    this.dropMoves = 0;                      // engage spikes: drop the first move events after a lock
    this.onLost = null;                      // Game: lock lost while wanted (Esc, alt-tab, browser UI)
    this.onFallback = null;                  // Game: the lock turned out to be unavailable (drag-look from now on)
    this.requests = 0; this.errors = 0;
    this.promised = false;                   // the last request returned a promise: it reports errors, not the event
    this.reqGesture = false; this.refusals = 0; this.lostT = -1e9;
    this.lastError = null; this.fallback = null;
    if (!this.supported) return;
    document.addEventListener('pointerlockchange', () => this.onChange());
    document.addEventListener('pointerlockerror', () => { if (!this.promised) this.onError(null); });
    const gesture = (e) => { if (!(e.type === 'keydown' && e.code === 'Escape')) this.gestureT = performance.now(); };
    for (const t of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(t, gesture, true);
  }
  /** transient user activation (Chrome/Firefox/Safari keep it ~5 s after a click or key; Esc never grants it) */
  hasActivation() {
    const ua = navigator.userActivation;
    if (ua && typeof ua.isActive === 'boolean') return ua.isActive;
    return performance.now() - this.gestureT < 4000;
  }
  /** gesture = an explicit click (veil / canvas): skips the auto-retry cooldown */
  request(gesture = false) {
    if (!this.supported || this.locked || this.pending || (!gesture && performance.now() < this.coolUntil)) return false;
    this.pending = true; this.pendT = performance.now(); this.requests++; this.reqGesture = gesture;
    const track = (p) => { this.promised = !!(p && typeof p.then === 'function'); return this.promised; };
    const plain = () => { try { const q = this.canvas.requestPointerLock(); if (track(q)) q.then(() => { this.pending = false; }, (err) => this.onError(err)); } catch (e) { this.onError(e); } };
    let p;
    try { p = this.canvas.requestPointerLock(this.raw() ? { unadjustedMovement: true } : undefined); } catch (e) { this.onError(e); return false; }
    if (track(p)) p.then(() => { this.pending = false; }, (err) => { if (err && err.name === 'NotSupportedError' && this.raw()) plain(); else this.onError(err); });
    return true;
  }
  release() {
    this.pending = false;
    if (this.supported && document.pointerLockElement === this.canvas) { this.expectUnlock = true; this.lostT = performance.now(); try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
  }
  onChange() {
    if (!this.supported) return;
    const was = this.locked;
    this.locked = document.pointerLockElement === this.canvas;
    this.pending = false;
    if (this.locked) { this.failed = false; this.coolUntil = 0; this.dropMoves = 2; this.veil = false; this.refusals = 0; }
    if (was && !this.locked) {
      this.lostT = performance.now();
      const expected = this.expectUnlock;
      this.expectUnlock = false;
      if (!expected && this.wanted && this.onLost) this.onLost();
    }
    if (was !== this.locked && G.events) G.events.emit(EV.POINTER_LOCK, { locked: this.locked });
  }
  /** one call per failed request (the promise when there is one, else the pointerlockerror event) */
  onError(err) {
    if (!this.supported) return;
    this.pending = false; this.failed = true; this.errors++;
    this.coolUntil = performance.now() + 1100;
    this.lastError = err ? (err.name || 'Error') + ': ' + String(err.message || '').slice(0, 120) : 'pointerlockerror';
    if (/sandbox/i.test((err && err.message) || '')) return this.giveUp('sandboxed');
    if (this.reqGesture && performance.now() - this.lostT > AFTER_LOSS && ++this.refusals >= REFUSALS) this.giveUp('refused');
  }
  /** the lock will never come: drag-look + direct LMB attacks from now on, no veil */
  giveUp(why) {
    this.supported = false; this.fallback = why;
    this.wanted = false; this.veil = false; this.pending = false;
    if (G.events) G.events.emit(EV.POINTER_LOCK, { locked: false, fallback: why });
    if (this.onFallback) this.onFallback(why);
  }
  /** canvas mouse press: true = consumed (it only asked for the lock; it never swings the sword) */
  onCanvasDown() {
    if (!this.supported || !this.wanted || this.locked) return false;
    this.gestureT = performance.now();
    this.request(true);
    return true;
  }
  /** arch §5.3 name: a user gesture (canvas press, non-Esc key) while the lock is wanted but missing asks for it now.
   *  The gesture listeners + update() (each frame, while the activation lasts) already do this; kept as the frozen API */
  onUserGesture(e = null) {
    if (e && e.type === 'keydown' && e.code === 'Escape') return false;   // Esc never grants activation
    this.gestureT = performance.now();
    if (!this.supported || !this.wanted || this.locked) return false;
    return this.request(!!e && /^(pointer|mouse)down$/.test(e.type));
  }
  /** per frame (Game.trackModal): mouseUser = last device was mouse or keyboard (pad/touch never need the lock) */
  update(wanted, mouseUser) {
    this.wanted = this.supported && wanted;
    if (!this.supported) { this.veil = false; return; }
    if (this.pending && performance.now() - this.pendT > 1500) this.pending = false; // Firefox: no promise, no event
    if (!this.wanted) { if (this.locked || this.pending) this.release(); this.veil = false; return; }
    if (!this.locked && !this.pending && mouseUser && this.hasActivation()) this.request();
    this.veil = !this.locked && !this.pending && mouseUser;
  }
  info() { return { supported: this.supported, locked: this.locked, wanted: this.wanted, veil: this.veil, pending: this.pending, failed: this.failed, requests: this.requests, errors: this.errors, refusals: this.refusals, fallback: this.fallback, lastError: this.lastError, element: document.pointerLockElement ? document.pointerLockElement.id || document.pointerLockElement.tagName : null }; }
}
