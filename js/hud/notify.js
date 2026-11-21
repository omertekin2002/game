// Messages: the pickup feed (top-left; replaces self floaters and gameplay toasts), the notification slot (region
// chapter card under the compass) and the boss lower-third card — never on screen together — and the coach slot
// (3-step onboarding that advances when the player does the thing, then queued EV.HINT hints, contract C18) plus the
// fading key chips for the first sessions. Per frame: no style writes except at state changes.
import { G, store, sfx } from '../core.js';
import { REGIONS, BOSSES } from '../data.js';
import { hud as TH } from '../tune.js';
import { fmtKeys, deviceKind, esc } from './keys.js';
import { iconUrl } from './icons.js';
import { uiSfx } from './sound.js';
import { project } from './projector.js';

const HUD_KEY = 'starseed-isle-hud-v1';   // HUD-only memory (sessions seen, sideways tip); separate from save + settings
function mk(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
export const hudMem = {
  get() { const v = store.get(HUD_KEY); return v && typeof v === 'object' ? v : {}; },
  set(patch) { store.set(HUD_KEY, Object.assign(this.get(), patch)); },
};

// ------------------------------------------------------------------ pickup feed
export class Feed {
  constructor(el) { this.el = el; this.lines = []; }
  /** text (may hold key tokens); o = { key (merge lines with the same key), n (merged count), kind: 'gain'|'note'|'warn', life } */
  push(text, o = {}) {
    const now = performance.now(), life = (o.life || TH.feedLife) * 1000;
    if (o.key) {
      const l = this.lines.find((q) => q.key === o.key && !q.out && now - q.t0 < TH.feedMerge * 1000 + life);
      if (l) {
        l.n += o.n || 1; l.t0 = now; l.life = life;
        l.txt.innerHTML = fmtKeys(o.fmt ? o.fmt(l.n) : text, { html: true });
        try { l.e.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 160 }); } catch (e) { /* ignore */ }
        return l;
      }
    }
    const e = mk('div', 'fl ' + (o.kind || 'gain'), this.el);
    const txt = mk('span', '', e, fmtKeys(o.fmt ? o.fmt(o.n || 1) : text, { html: true }));
    if (o.icon) { const u = iconUrl(o.icon); if (u) e.insertAdjacentHTML('afterbegin', `<img src="${u}" alt="" draggable="false" onerror="this.remove()">`); }
    const l = { e, txt, key: o.key || null, n: o.n || 1, t0: now, life, out: false };
    this.lines.push(l);
    const max = this.max || TH.feedMax;
    while (this.lines.filter((q) => !q.out).length > max) this.retire(this.lines.find((q) => !q.out));
    return l;
  }
  retire(l) { if (!l || l.out) return; l.out = true; l.e.classList.add('out'); setTimeout(() => { l.e.remove(); this.lines = this.lines.filter((q) => q !== l); }, 320); }
  frame() { const now = performance.now(); for (const l of this.lines) if (!l.out && now - l.t0 > l.life) this.retire(l); }
  clear() { for (const l of this.lines) l.e.remove(); this.lines = []; }
}

// ------------------------------------------------------------------ region card + boss lower-third
export class Notices {
  constructor(ui) {
    this.ui = ui;
    this.banner = ui.banner;
    this.card = ui.bosscard;
    this.bossUp = false;
  }
  /** region chapter card in the notification slot; first visit adds the vista painting. Suppressed while the boss card
   *  or a boss intro is up (they never share the screen) */
  showBanner(title, sub) {
    const g = G.game;
    if (this.bossUp || (g && g.fight && g.fight.phase === 'intro')) return false;
    const ri = REGIONS.findIndex((r) => r.name === title), R = REGIONS[ri];
    const first = !!(g && g.S && ri >= 0 && !g.S.visited[ri]);
    const B = this.banner, vu = first && R ? iconUrl('vista_' + R.id) : null;
    B.querySelector('.t').textContent = fmtKeys(title);
    B.querySelector('.s').textContent = fmtKeys(sub || '');
    const V = B.querySelector('.vista');
    V.innerHTML = vu ? `<img src="${vu}" alt="" draggable="false" onerror="this.parentNode.classList.add('none');this.remove()">` : '';
    V.classList.toggle('none', !vu);
    B.classList.toggle('first', first);
    B.classList.add('show');
    // how far the card reaches below the free band's top (edge indicators and pips keep under it while it is up)
    // (until the card has faded out: its life + the 0.45 s fade)
    try { const O = this.ui.objEl; this.ui.bannerExtra = Math.max(0, B.offsetTop + B.offsetHeight - (O.offsetHeight ? O.offsetTop + O.offsetHeight : 0)); } catch (e) { /* ignore */ }
    this.ui.bannerUntil = performance.now() + (first ? TH.bannerT + 0.8 : TH.bannerT) * 1000 + 450;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => B.classList.remove('show'), (first ? TH.bannerT + 0.8 : TH.bannerT) * 1000);
    return true;
  }
  hideBanner() { clearTimeout(this.bannerT); this.banner.classList.remove('show'); this.ui.bannerUntil = Math.min(this.ui.bannerUntil || 0, performance.now() + 450); }
  /** the card covers the upper centre, where flyers rise and wind up: it fades as soon as a fight starts around Pip (an
   *  enemy within TH.bannerThreat m has noticed him; telegraphs and hurts hide it from hud.js). Cheap: only while it is up */
  frame(g) {
    if (!this.banner.classList.contains('show') || !g || !g.player) return;
    const p = g.player.pos, E = g.enemies, r2 = TH.bannerThreat * TH.bannerThreat;
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (e.alive && e.noticed && (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2 < r2) { this.hideBanner(); return; } }
  }
  /** boss lower-third: name, title, the boss's badge; appears after a short beat so the camera lands first (delay s; the
   *  boss intro passes 0: it times the beat on its own clock, which holds under the pause, fight.js) */
  bossCard(name, title, on, delay = TH.bossCardDelay) {
    const C = this.card;
    clearTimeout(this.cardT);
    // #ui.bosscard while the card is up: on a portrait phone the card (under the compass) reaches the feed's slot, so the
    // feed steps aside for it (styles.css)
    if (!on) { this.bossUp = false; C.classList.remove('show'); this.ui.root.classList.remove('bosscard'); return; }
    this.bossUp = true;
    this.hideBanner();
    // the badge: the guardian whose name the card starts with (a rematch card reads 'Grumble Shroom · Rematch')
    const id = Object.keys(BOSSES).find((k) => name === BOSSES[k].name || name.startsWith(BOSSES[k].name + ' ·')), u = id ? iconUrl(BOSSES[id].key) : null;
    C.querySelector('.bt').textContent = name;
    C.querySelector('.bs').textContent = title || '';
    C.querySelector('.badge').innerHTML = u ? `<img src="${u}" alt="" draggable="false" onerror="this.remove()">` : '<span>!</span>';
    const show = () => { if (this.bossUp) { C.classList.toggle('flip', this.pipLeft()); C.classList.add('show'); this.ui.root.classList.add('bosscard'); } };
    if (delay > 0) this.cardT = setTimeout(show, delay * 1000); else show();
  }
  /** r3: the card's slot (lower left; bottom centre on a landscape phone) is where the third-person intro shot puts Pip
   *  (left half, measured: his box x 200–515 of 1280 for all three bosses and both shoulders). With Pip on screen and left
   *  of the middle when the card comes in, it takes the right side. First person and the portrait card (top) stay put */
  pipLeft() {
    const g = G.game, v = g && g.view, pl = g && g.player;
    if (!v || !v.bodyOut || this.ui.lay === 'port' || !pl) return false;
    const p = pl.root ? pl.root.position : pl.pos, s = project({ x: p.x, y: p.y + 0.6, z: p.z }, this._pp || (this._pp = {}));
    return !s.behind && s.onScreen && s.x < this.ui.vw / 2;
  }
  reset() { this.hideBanner(); this.bossCard('', '', false); }
}

// ------------------------------------------------------------------ coach marks + hints
const STEPS = [
  { id: 'look', pic: { kbm: 'pic_mouse', pad: 'pic_controller', touch: 'pic_phone' }, text: { kbm: 'Move the mouse to look around', kbmArrows: 'Mouse or arrow keys to look around', pad: 'Tilt {look} to look around', touch: 'Swipe across the screen to look around' } },
  { id: 'move', pic: { kbm: 'pic_keycap', pad: 'pic_controller', touch: 'pic_phone' }, text: { kbm: '{move} to walk · {jump} to hop', pad: '{move} to walk · {jump} to hop', touch: 'Drag the stick to walk · tap {jump} to hop' } },
  { id: 'swing', pic: { kbm: 'act_swing', pad: 'act_swing', touch: 'act_swing' }, text: { kbm: '{attack} to swing your sword · {dash} to roll', pad: '{attack} to swing your sword · {dash} to roll', touch: 'Tap {attack} to swing · {dash} to roll' } },
];
// the coach pill's state key per step and device (built once: Coach.frame compares keys, never strings it builds)
const KEYS = STEPS.map((S, i) => ({ kbm: 's' + i + 'kbm', pad: 's' + i + 'pad', touch: 's' + i + 'touch' }));
export class Coach {
  constructor(ui, el) {
    this.ui = ui; this.el = el;
    el.innerHTML = '<span class="pic"></span><span class="ct"></span><span class="dots"><i></i><i></i><i></i></span>';
    this.pic = el.querySelector('.pic'); this.ct = el.querySelector('.ct'); this.dots = [...el.querySelectorAll('.dots i')];
    this.step = -1;               // -1 off, 0..2 a step, 3 the "all set" flourish
    this.did = null; this.hints = []; this.hint = null; this.seen = new Map(); this.shownKey = '';
    this.vis = false;
  }
  get active() { return this.step >= 0; }
  /** start the three steps (replaces the old first-run controls card); onDone marks the save */
  // shownKey null = unknown, so the next frame rewrites (a stop must also hide a pill that is up right now)
  // r4: look (deg), walk (m) and the first swing / roll / hop count from the start, whatever the step on show; every frame
  // the steps already done are skipped (one chime), so a player who did it all gets the flourish at once (the pill used to
  // ask for the mouse for 25 s while Pip walked, swung and rolled, then for a fresh 4 m walk)
  start(onDone) { this.step = 0; this.onDone = onDone; this.last = null; this.shownKey = null; this.did = { look: 0, walk: 0, act: false }; }
  stop() { this.step = -1; this.shownKey = null; this.el.classList.remove('show'); }
  /** a player action event (EV.SWING / EV.JUMP / EV.DASH_START) */
  action(kind) { if (this.step >= 0 && this.step < 3 && (kind === 'swing' || kind === 'dash' || kind === 'jump')) this.did.act = true; }
  /** step i already done (r4: counted from the start) */
  done(i) { const d = this.did; return i === 0 ? d.look >= TH.coachLook : i === 1 ? d.walk >= TH.coachWalk : d.act; }
  advance(to = this.step + 1) {
    this.step = to;
    uiSfx('coach');
    if (this.step === 3) { this.doneT = 0; const f = this.onDone; this.onDone = null; f && f(); }
  }
  /** EV.HINT { id, text }: queued, one at a time, the same id not again within hintGap s */
  pushHint(id, text, life = TH.hintT) {
    if (!text) return false;
    const now = performance.now(), k = id || text;
    if (this.seen.has(k) && now - this.seen.get(k) < TH.hintGap * 1000) return false;
    if (this.hints.some((h) => h.k === k) || (this.hint && this.hint.k === k)) return false;
    this.seen.set(k, now);
    // r4: a hint queued outside a fight waits out the next one (fight: it was queued in a fight, about it)
    const g = G.game;
    this.hints.push({ k, text, life: life * 1000, fight: !!(g && g.fight && g.fight.phase !== 'won') });
    if (this.hints.length > 4) this.hints.shift();
    return true;
  }
  /** per frame: progress, and which text shows (writes only when it changes) */
  frame(g, dt) {
    const base = g.state === 'play' && g.playing && !g.hudOff && g.player.state !== 'dizzy' && !(g.fight && g.fight.phase === 'intro');
    const can = base && !g.fight;   // coach steps wait out fights; hints may show in them
    const v = g.view, pl = g.player, dev = deviceKind();
    if (this.step >= 0 && this.step < 3) {
      const D = this.did || (this.did = { look: 0, walk: 0, act: false });
      if (base) {
        // look degrees (the player's own look: not a scripted shot) and walked metres (a teleport is no walk)
        const L = this.last;
        if (L && v.lookAllowed && v.shotW < 0.01) { let d = v.yaw - L.y; d = Math.atan2(Math.sin(d), Math.cos(d)); D.look += (Math.abs(d) + Math.abs(v.pitch - L.p)) * 57.2958; }
        if (L) { const d = Math.hypot(pl.pos.x - L.x, pl.pos.z - L.z); if (d < 1) D.walk += d; }
        if (!L) this.last = { y: 0, p: 0, x: 0, z: 0 };
        const M = this.last; M.y = v.yaw; M.p = v.pitch; M.x = pl.pos.x; M.z = pl.pos.z;
      } else this.last = null;
      if (can) { let s = this.step; while (s < 3 && this.done(s)) s++; if (s !== this.step) this.advance(s); }
    }
    if (this.step === 3 && (this.doneT += dt) > TH.coachHold) this.step = -1;
    // what shows: a coach step, else the current hint (the key is compared first: text is formatted only on a change)
    let key = '', html = '', pic = '', dots = -1, kind = 0;
    if (this.step >= 0 && can) {
      if (this.step < 3) { kind = 1; key = KEYS[this.step][dev]; }
      else { key = 'done'; html = 'You\'re all set. Have fun, Pip! ✿'; pic = 'icon_tree'; dots = 3; }
    } else if (base) {
      const now = performance.now(), inFight = !!(g.fight && g.fight.phase !== 'won');
      if (this.hint && now - this.hint.t0 > this.hint.life) this.hint = null;
      // r4: in a fight only its own hints show; one from before it goes back to the queue (shown whole afterwards)
      if (this.hint && inFight && !this.hint.fight) { this.hints.unshift(this.hint); this.hint = null; }
      if (!this.hint && this.hints.length) {
        const i = inFight ? this.hints.findIndex((h) => h.fight) : 0;
        if (i >= 0) { this.hint = this.hints.splice(i, 1)[0]; this.hint.t0 = now; this.hint.keys = {}; }
      }
      if (this.hint && !g.ui.dlg) { kind = 2; key = this.hint.keys[dev] || (this.hint.keys[dev] = 'h' + this.hint.k + dev); }
    }
    if (key !== this.shownKey) {
      this.shownKey = key;
      if (kind === 1) { const S = STEPS[this.step], arrows = dev === 'kbm' && S.text.kbmArrows && G.settings && G.settings.get('arrowLook'); html = fmtKeys(S.text[arrows ? 'kbmArrows' : dev], { html: true }); pic = S.pic[dev]; dots = this.step; }   // core: arrowLook
      else if (kind === 2) { html = fmtKeys(this.hint.text, { html: true }); pic = 'hint'; }
      this.size = null;
      if (key) {
        this.ct.innerHTML = html;
        const u = pic && pic !== 'hint' ? iconUrl(pic) : null;
        this.pic.innerHTML = u ? `<img src="${u}" alt="" draggable="false" onerror="this.parentNode.classList.add('fb');this.remove()">` : '';
        this.pic.classList.toggle('fb', !u);
        this.el.classList.toggle('hint', dots < 0);
        this.dots.forEach((d, i) => d.classList.toggle('on', i <= dots));
      }
      this.el.classList.toggle('show', !!key);
      // a rise only (a scale would grow about the box's untranslated centre and slide the centred pill sideways)
      if (key) try { this.el.animate([{ translate: '0 8px' }, { translate: '0 0' }], { duration: 220, easing: 'ease-out' }); } catch (e) { /* ignore */ }
    }
    this.place();
  }
  /** third person: the pill never sits on Pip (feedback.js projects his box). Desktop: it slides to the far side of him in
   *  its slot; phones (no room beside him between the touch controls) and when that does not fit: up into the band under
   *  the objective line, where it waits while the region card or the prompt pill is up. First person: the CSS slot, and
   *  on a phone in a boss fight the same top band (r4) */
  place() {
    const ui = this.ui, B = ui.fx && ui.fx.pipBox, g = G.game;
    let dx = 0, top = false;
    // r4: a phone in first person mid-fight: up under the boss bar too (the portrait slot at 0.55–0.63 H crossed the
    // boss's body, landscape's sat under its feet where the rings come in)
    if (!B && this.shownKey && ui.lay !== 'desk' && g && g.fight && g.fight.phase === 'fight') top = true;
    if (B && this.shownKey) {
      if (!this.size || this.size.vw !== ui.vw || this.size.u !== ui.u) this.size = { w: this.el.offsetWidth, h: this.el.offsetHeight, vw: ui.vw, u: ui.u };   // a layout read per new text / resize
      const W = ui.vw, H = ui.vh, u = ui.u, cw = this.size.w, ch = this.size.h;
      const gap = (this.dx || this.top ? 26 : 10) * u;     // hysteresis: once moved it stays put while Pip sways a little
      const bot = ui.lay === 'desk' ? H - 160 * u : ui.lay === 'land' ? H - 12 : H * 0.64 - 10;
      const hit = (cx) => cx + cw / 2 > B.l - gap && cx - cw / 2 < B.r + gap && bot > B.t - gap && bot - ch < B.b + gap;
      if (hit(W / 2)) {
        if (ui.lay === 'desk') {
          const cx = (B.l + B.r) / 2 < W / 2 ? B.r + 14 * u + cw / 2 : B.l - 14 * u - cw / 2;
          if (cx - cw / 2 >= 16 && cx + cw / 2 <= W - 16) dx = Math.round(cx - W / 2); else top = true;
        } else top = true;
      }
    }
    if (dx !== (this.dx || 0)) { this.dx = dx; this.el.style.marginLeft = dx ? dx + 'px' : ''; }
    if (top !== !!this.top) { this.top = top; this.el.classList.toggle('ctop', top); }
    if (top && this.topY !== ui.safeTop) { this.topY = ui.safeTop; this.el.style.setProperty('--ctop', ui.safeTop + 'px'); }
    const wait = top && ui.banner.classList.contains('show');
    if (wait !== !!this.wait) { this.wait = wait; this.el.classList.toggle('wait', wait); }
  }
}

// ------------------------------------------------------------------ key chips (bottom-right), first sessions only
const CHIPS = {
  kbm: '{attack} Swing · {dash} Roll · {jump} Hop · {view} View · {lock} Lock-on',
  pad: '{attack} Swing · {dash} Roll · {jump} Hop · {view} View · {lock} Lock-on',
};
export class KeyHints {
  constructor(el) { this.el = el; this.until = 0; this.dev = ''; }
  session() {
    const m = hudMem.get(), n = (m.sessions || 0) + 1;
    hudMem.set({ sessions: n });
    this.until = n <= TH.keyHintSessions ? performance.now() + TH.keyHintsT * 1000 : 0;
  }
  frame(g) {
    const dev = deviceKind();
    // never with the touch controls up (a touchscreen laptop or a tablet with a keyboard: the chips sit on Swing / Roll)
    const touch = !!(G.input && G.input.touchVisible);
    const fresh = !!CHIPS[dev] && performance.now() < this.until, on = fresh && g.playing && !g.hudOff && !touch;
    if (on && dev !== this.dev) { this.dev = dev; this.el.innerHTML = fmtKeys(CHIPS[dev], { html: true }); }
    // time up: a slow fade; dialogue / menus / another device: out at once (the dialogue box reaches this corner)
    if (this.on !== on) { this.on = on; this.el.classList.toggle('quick', !on && fresh || !CHIPS[dev]); this.el.classList.toggle('show', on); }
  }
}
export { esc };
