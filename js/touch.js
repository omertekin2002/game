// Touch controls (Input mixin, WP6; art §13, feel §14.3): a floating move stick in the move zone (left 40 % in
// landscape, the left half of the bottom deck in portrait; mirrored with touchLeftHanded), look drags everywhere else on
// the canvas, the thumb cluster (Swing 76, Roll 58 (hold: sprint), Hop 58, contextual Use 62 shown only with a target and
// labelled with its verb) and small buttons (Pause, Map, View, Potion, Lock — Lock only near enemies / in fights).
// A quick tap anywhere is a 'click' (advances dialogue) and a 'tap' (interacts with the crosshair target).
// Game sends the mode every frame (setTouchMode): only 'play' shows the controls; dialogue, shop, menus, the title and
// cinematics (cutscenes, fades, the boss intro) hide them (the old stick-over-dialogue overlap). Safe-area insets come
// from CSS. Layout per #ui.lay-* in styles.css.
import { G } from './core.js';
import { Assets } from './assets.js';
import { settings } from './settings.js';
import { hud as TH } from './tune.js';

const BTN = [
  // [action, class, icon key, label]
  ['attack', 'atk', 'act_swing', 'Swing'], ['dash', 'roll', 'act_roll', 'Roll'], ['jump', 'jump', 'act_hop', 'Hop'], ['interact', 'use', 'act_use', 'Use'],
  ['pause', 'pause sm', '', 'Pause'], ['map', 'map sm', 'act_map', 'Map'], ['view', 'view sm', 'act_view', 'View'], ['potion', 'pot sm', 'potion', 'Potion'], ['lockOn', 'lock sm', 'act_lock', 'Lock'],
];
const VERB_ICON = { npc: 'icon_talk', shop: 'icon_shop', chest: 'icon_chest', sign: 'act_use', pedestal: 'icon_tree' };
const url = (k) => (k ? Assets.url('ui', k) || Assets.url('sprites', k) : null);
const icon = (k, label) => { const u = url(k); return `${u ? `<img src="${u}" alt="" draggable="false" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}<span class="tl">${label}</span>`; };

export const TouchMixin = {
  setupTouch(ui) {
    const root = document.createElement('div');
    root.id = 'touch';
    root.className = 'hidden';
    root.innerHTML = `<div class="mzone"><div class="stick home"><div class="nub"></div></div></div>
      <div class="cluster">${BTN.slice(0, 4).map(([a, c, k, l]) => `<div class="tb ${c}${k && !url(k) ? ' noimg' : ''}" data-a="${a}" role="button" aria-label="${l}">${icon(k, l)}</div>`).join('')}</div>
      <div class="tops">${BTN.slice(4).map(([a, c, k, l]) => `<div class="tb ${c}${!url(k) ? ' noimg' : ''}" data-a="${a}" role="button" aria-label="${l}">${a === 'pause' ? '<i class="bars"></i><span class="tl">Pause</span>' : icon(k, l)}</div>`).join('')}</div>`;
    ui.appendChild(root);
    this.touchRoot = root;
    const zone = root.querySelector('.mzone'), stick = root.querySelector('.stick'), nub = root.querySelector('.nub');
    this.useBtn = root.querySelector('.tb.use'); this.lockBtn = root.querySelector('.tb.lock');
    // ---- floating stick: the base jumps under the thumb, returns home 1 s after release
    let sid = null, sx = 0, sy = 0, t0 = 0, moved = 0, homeT = null;
    zone.addEventListener('pointerdown', (e) => {
      if (sid != null) return;
      e.preventDefault(); e.stopPropagation();
      sid = e.pointerId; t0 = performance.now(); moved = 0;
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.setDevice('touch');
      clearTimeout(homeT);
      const zr = zone.getBoundingClientRect(), R = stick.offsetWidth / 2 || 55;
      sx = Math.max(zr.left + R, Math.min(zr.right - R, e.clientX)); sy = Math.max(zr.top + R, Math.min(zr.bottom - R, e.clientY));
      stick.classList.remove('home'); stick.classList.add('live');
      stick.style.transform = `translate(${(sx - zr.left - R).toFixed(0)}px, ${(sy - zr.bottom + R).toFixed(0)}px)`;
      this.stickMove(e.clientX - sx, e.clientY - sy, nub);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId !== sid) return; moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); this.stickMove(e.clientX - sx, e.clientY - sy, nub); });
    const end = (e) => {
      if (e.pointerId !== sid) return;
      const d = Math.hypot(e.clientX - sx, e.clientY - sy);
      if (d < 12 && moved < 12 && performance.now() - t0 < 300) { this.pending.add('click'); this.pending.add('tap'); this.pending.add('any'); }
      sid = null; this.stick.x = this.stick.y = 0; nub.style.transform = ''; stick.classList.remove('live');
      homeT = setTimeout(() => { stick.classList.add('home'); stick.style.transform = ''; }, TH.stickHome * 1000);
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    this.stickEnd = () => { if (sid != null) end({ pointerId: sid, clientX: sx, clientY: sy }); };
    // ---- buttons
    root.querySelectorAll('.tb').forEach((b) => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.setDevice('touch');
        this.pending.add(a); this.pending.add('any'); this.touchHeld.add(a);
        if (a === 'dash') this.touchHeld.add('sprint');
        b.classList.add('down');
      });
      const up = () => { this.touchHeld.delete(a); if (a === 'dash') this.touchHeld.delete('sprint'); b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // ---- look: drags on the canvas (everything outside the move zone and the buttons); quick taps click
    const drags = new Map();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.showTouch();
      this.setDevice('touch');
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 });
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      this.touchLook.x += dx; this.touchLook.y += dy;
      d.moved += Math.abs(dx) + Math.abs(dy);
      d.x = e.clientX; d.y = e.clientY;
    });
    const tEnd = (e) => {
      const d = drags.get(e.pointerId);
      if (d && d.moved < 12 && performance.now() - d.t < 300) { this.pending.add('click'); this.pending.add('tap'); this.pending.add('any'); }
      drags.delete(e.pointerId);
    };
    this.canvas.addEventListener('pointerup', tEnd);
    this.canvas.addEventListener('pointercancel', tEnd);
    window.addEventListener('touchstart', () => this.showTouch(), { once: true, passive: true });
    settings.on('touchLeftHanded', () => this.layoutTouch());
    this.layoutTouch();
  },
  /** stick deflection from the thumb offset (px): 8 px dead zone, full at 55 px; the nub travels at most 60 % of the base */
  stickMove(dx, dy, nub) {
    const l = Math.hypot(dx, dy), R = TH.stickR, k = l < TH.stickDead ? 0 : Math.min(1, (l - TH.stickDead) / (R - TH.stickDead));
    const ux = l > 0 ? dx / l : 0, uy = l > 0 ? dy / l : 0;
    this.stick.x = ux * k; this.stick.y = -uy * k;
    const travel = Math.min(l, R);
    nub.style.transform = `translate(${(ux * travel).toFixed(1)}px, ${(uy * travel).toFixed(1)}px)`;
  },
  /** left-handed mirror (setting); positions per layout live in styles.css */
  layoutTouch() { if (this.touchRoot) this.touchRoot.classList.toggle('lefty', !!settings.get('touchLeftHanded')); },
  showTouch() { if (this.touchRoot && !this.touchVisible) { this.touchVisible = true; this.touchRoot.classList.remove('hidden'); this.setDevice('touch'); } },
  /** Game calls it every frame with: 'play' (state 'play' without a modal) | 'dialogue' (ui.dlg: a quick tap anywhere
   *  advances it) | 'modal' (a cursor menu or the shop owns the screen) | 'hidden' (not in play: the title). A 'play'
   *  that is really a cinematic (a cutscene, a fade, the boss intro, the HUD switched off) becomes 'cinema'. Only 'play'
   *  shows the controls. In play the Use button follows the crosshair target (with its verb) and Lock shows near enemies */
  setTouchMode(mode) {
    if (mode === 'play') {
      const g = G.game, ui = G.ui;
      if (g && (g.cutscene || g.trans || (g.fight && g.fight.phase === 'intro') || (ui && ui.hud && ui.hud.classList.contains('off')))) mode = 'cinema';
    }
    this.touchMode = mode;
    this.setTouchVisible(mode === 'play');
    if (mode !== 'play' || !this.touchVisible) return;
    const g = G.game, tg = g && g.target;
    // the verb is worked out once per target (no string splitting per frame)
    if (tg !== this.useTg || (tg && (tg.verb || tg.label) !== this.useSrc)) { this.useTg = tg; this.useSrc = tg ? tg.verb || tg.label : null; this.useWord = tg ? String(tg.verb || tg.label || 'Use').split(' ')[0] : ''; }
    const verb = this.useWord;
    if (verb !== this.useVerb) {
      this.useVerb = verb;
      const b = this.useBtn;
      b.classList.toggle('off', !verb);
      if (verb) {
        const k = VERB_ICON[tg.kind] || (tg.verb === 'Shop' ? 'icon_shop' : 'act_use'), u = url(k);
        b.classList.toggle('noimg', !u);
        b.innerHTML = `${u ? `<img src="${u}" alt="" draggable="false" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}<span class="tl">${verb}</span>`;
        b.setAttribute('aria-label', verb);
      }
    }
    const pl = g && g.player;
    let lock = !!(g && (g.fight || (G.view && G.view.lockTarget)));
    if (!lock && pl) for (let i = 0, E = g.enemies; i < E.length; i++) { const e = E[i]; if (e.alive && Math.abs(e.pos.x - pl.pos.x) < 12 && Math.abs(e.pos.z - pl.pos.z) < 12) { lock = true; break; } }
    if (lock !== this.lockShown) { this.lockShown = lock; this.lockBtn.classList.toggle('off', !lock); }
  },
  /** shown/hidden (writes only on change); hiding drops held buttons and the stick so nothing sticks */
  setTouchVisible(on) {
    if (!this.touchRoot || this.touchOn === on) return;
    this.touchOn = on;
    this.touchRoot.style.display = on ? '' : 'none';
    if (!on) { this.touchHeld.clear(); this.stick.x = this.stick.y = 0; if (this.stickEnd) this.stickEnd(); this.touchRoot.querySelectorAll('.tb.down').forEach((b) => b.classList.remove('down')); }
  },
};
