// Combat and world feedback around the crosshair (arch §10, art §12.2): crosshair states (idle dot, target ring, enemy
// in reach, hit marker, kill star), damage petals (EV.HURT), off-screen threat chevrons + a "look up" caret
// (EV.TELEGRAPH), enemy HP pips (aimed / locked / last hit), the lock-on reticle (view.lockTarget), the TP target marker,
// Pip's projected box in TP (the prompt pill and the coach keep off him) and the speed-line overlay (view.speedFx).
// Per frame only transform / opacity writes, each written only on change, no allocations; pools: petals 4, chevrons 4,
// pips 3. Every world point goes through the projector (never NaN, behind-eye guarded).
import { G } from '../core.js';
import { ENEMY } from '../data.js';
import { hud as TH } from '../tune.js';
import { project } from './projector.js';

const D2R = Math.PI / 180;
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function mk(tag, cls, parent, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
/** write a style property only when it changed (cached on the element) */
export function sty(e, k, v) { const c = e._s || (e._s = {}); if (c[k] !== v) { c[k] = v; e.style[k] = v; return 1; } return 0; }
const _scr = {}, _scr2 = {}, _hb = { x: 0, z: 0, r: 0, y0: 0, y1: 0 }, _pt = { x: 0, y: 0, z: 0 }, _ep = { x: 0, y: 0 };
const at = (x, y, z) => { _pt.x = x; _pt.y = y; _pt.z = z; return _pt; };
/** an actor that can no longer attack: killed, dying, or no longer in the game (an enemy removed from game.enemies) */
const gone = (g, a) => a.alive === false || !!a.removed || !!a.dying || (a.type != null && !!ENEMY[a.type] && g.enemies.indexOf(a) < 0);
const PETAL = '<svg viewBox="0 0 64 24" aria-hidden="true"><path d="M3 22 Q32 -10 61 22 Q32 13 3 22Z"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 17.5 L12 4.5 L21.5 17.5 Q17 19.5 15.5 16 L12 11 L8.5 16 Q7 19.5 2.5 17.5Z"/></svg>';
// kill star: a chubby gold star on a thick brown outline with a cream sparkle core (reads on the white poof and on grass)
const STAR = '<svg viewBox="-24 -24 48 48" aria-hidden="true"><path class="so" d="M0 -20 L5.6 -7.7 L19 -6.2 L9 2.9 L11.8 16.2 L0 9.5 L-11.8 16.2 L-9 2.9 L-19 -6.2 L-5.6 -7.7Z"/>'
  + '<path class="si" d="M0 -8 L2 -2.6 L7.6 -2.4 L3.3 1.2 L4.7 6.5 L0 3.6 L-4.7 6.5 L-3.3 1.2 L-7.6 -2.4 L-2 -2.6Z"/></svg>';
const HEART = '<svg viewBox="0 0 32 29" aria-hidden="true"><path d="M16 27.5C5 19.5 1 14 1 8.8 1 4.6 4.3 1.5 8.4 1.5c3.2 0 6 1.8 7.6 4.5 1.6-2.7 4.4-4.5 7.6-4.5 4.1 0 7.4 3.1 7.4 7.3 0 5.2-4 10.7-15 18.7z"/></svg>';
// one reticle corner (top-left; the others are the same svg turned by CSS): a brown outline under a cream stroke
const CORNER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M4 20V10Q4 4 10 4h10"/><path class="c" d="M4 20V10Q4 4 10 4h10"/></svg>';

/** an actor's hurtbox (Enemy / Boss) or a small default box around its position */
function hb(a) {
  if (a && typeof a.hurtbox === 'function') { try { const h = a.hurtbox(_hb); if (h && Number.isFinite(h.y1)) return h; } catch (e) { /* fall through */ } }
  const p = a && a.pos;
  if (!p) return null;
  _hb.x = p.x; _hb.z = p.z; _hb.r = a.r || 0.4; _hb.y0 = p.y; _hb.y1 = p.y + (a.height || 1); return _hb;
}
export const actorMax = (e) => (Number.isFinite(e.maxHp) && e.maxHp > 0 ? e.maxHp : (e.def && e.def.hp) || (ENEMY[e.type] && ENEMY[e.type].hp) || e._hudMax || (e._hudMax = Math.max(1, e.hp || 1)));

export class Feedback {
  constructor(ui) {
    this.ui = ui;
    // crosshair parts (inside #crosshair, centred)
    const X = ui.crossEl;
    X.innerHTML = '';
    this.xRing = mk('div', 'xring', X);
    this.xDot = mk('div', 'xdot', X);
    this.xReach = mk('div', 'xreach', X, '<i></i><i></i><i></i><i></i>');
    this.xHit = mk('div', 'xhit', X, '<i></i><i></i><i></i><i></i>');
    this.xKill = mk('div', 'xkill', X, STAR);
    // damage petals + threat chevrons + look-up caret (#petals, centred on the screen)
    const P = this.petalRoot = mk('div', '', ui.hud); P.id = 'petals';
    this.petals = []; for (let i = 0; i < 4; i++) this.petals.push({ e: mk('div', 'petal', P, PETAL), t: 9, life: 0.8, fx: 0, fz: 0 });
    this.chevs = []; for (let i = 0; i < 4; i++) this.chevs.push({ e: mk('div', 'chev', P, CHEV), t: 9, life: 1, x: 0, y: 0, z: 0, src: null, kind: '' });
    this.lookUp = mk('div', 'lookup', P, CHEV + '<b>look up!</b>');
    P.style.setProperty('--chev-t', (0.5 / TH.chevHz).toFixed(3) + 's');   // the pulse runs in CSS (one half period)
    // world-anchored: enemy pips, lock reticle, TP target marker (#worldmarks)
    const Wm = this.wm = mk('div', '', ui.hud); Wm.id = 'worldmarks';
    this.pips = []; for (let i = 0; i < 3; i++) { const e = mk('div', 'pips', Wm); this.pips.push({ e, in: mk('div', 'in', e), who: null, n: -1, hp: -1 }); }
    // lock reticle: four chunky rounded corners (cream on a brown outline) that hug the target, a soft breathe, no spin
    this.reticle = mk('div', 'reticle', Wm, `<div class="rin">${`<i>${CORNER}</i>`.repeat(4)}</div><b class="ra">${CHEV}</b>`);
    this.retIn = this.reticle.firstChild;
    this.ret = { x: 0, y: 0, ang: 0, edge: false };      // where the reticle sits now (edge pips hang off it)
    this.tmark = mk('div', 'tmark', Wm, '<i></i>');
    this.tm = { on: false, x: 0, y: 0 };                 // TP target marker (the prompt pill sits on it)
    this.pipBox = null; this._pb = { l: 0, t: 0, r: 0, b: 0 };   // Pip's projected box in TP (CSS px) or null
    // speed lines (C9: view.speedFx 0..1), first child of the HUD so every widget sits on it
    this.speed = mk('div', '', null); this.speed.id = 'speedfx'; ui.hud.insertBefore(this.speed, ui.hud.firstChild);
    this.lastHit = new Map();     // enemy → time of the last hit (pips for 2 s)
    this.time = 0;
    this.writes = 0;
    this._out = []; this._g = null;
    this._hitFn = (t, e) => { if (this.time - t > TH.pipHold || !e.alive) this.lastHit.delete(e); else this.addPip(e); };
  }
  // ------------------------------------------------------------------ events (render-side record only)
  /** EV.HURT: a petal pointing at the source (fromX / fromZ; a shockwave ring passes its centre) */
  hurt(p) {
    if (!p) return;
    const s = this.petals.reduce((a, b) => (b.t > a.t ? b : a));   // the oldest slot
    s.t = 0; s.life = TH.petalLife;
    // no source position: the bearing at the time of the hit (never a NaN angle)
    if (Number.isFinite(p.fromX) && Number.isFinite(p.fromZ)) { s.fx = p.fromX; s.fz = p.fromZ; }
    else { s.fx = null; s.rel = Number.isFinite(p.rel) ? p.rel : 0; }
  }
  /** EV.TELEGRAPH: a chevron while the wind-up runs, when the source is off the screen (frame decides, every frame) */
  telegraph(p) {
    if (!p) return;
    const s = this.chevs.find((c) => c.src && c.src === p.source) || this.chevs.reduce((a, b) => (b.t / b.life > a.t / a.life ? b : a));
    s.t = 0; s.life = clamp(Number.isFinite(p.t) ? p.t : 1, TH.chevMin, TH.chevMax) + 0.25;
    s.x = +p.x || 0; s.y = +p.y || 0; s.z = +p.z || 0; s.src = p.source || null; s.kind = p.kind || '';
  }
  /** EV.HIT / EV.CLINK / EV.KILL: crosshair markers; enemy hits keep its pips up for 2 s */
  hit(p, kind) {
    if (kind === 'kill') this.flash(this.xKill, 'kill');
    else if (kind === 'clink') this.flash(this.xHit, 'clink');
    else if (p && (p.kind === 'enemy' || p.kind === 'boss')) {
      this.flash(this.xHit, p.killed ? 'kill' : 'hit');
      if (p.kind === 'enemy' && p.target) this.lastHit.set(p.target, this.time);
    }
  }
  /** hit: cream ticks burst out of the crosshair (not the reach petals' shape or colour); kill: a gold star pops, spins
   *  a little and holds before it fades */
  flash(e, how) {
    if (!e.animate) return;
    const r = this.ui.reduced;
    try {
      if (e === this.xKill) e.animate([{ opacity: 1, transform: 'scale(0.45) rotate(0deg)' }, { opacity: 1, transform: `scale(1.18) rotate(${r ? 0 : 18}deg)`, offset: 0.28 }, { opacity: 1, transform: `scale(1) rotate(${r ? 0 : 24}deg)`, offset: 0.62 }, { opacity: 0, transform: `scale(1.05) rotate(${r ? 0 : 30}deg)` }], { duration: TH.killMs, easing: 'ease-out' });
      else {
        e.classList.toggle('clink', how === 'clink');
        e.animate([{ opacity: 1, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1.15)', offset: 0.45 }, { opacity: 0, transform: 'scale(1.4)' }], { duration: how === 'kill' ? TH.killMs * 0.7 : TH.hitMs, easing: 'ease-out' });
      }
    } catch (err) { /* old engines: no marker */ }
  }
  // ------------------------------------------------------------------ per frame
  frame(g, dt) {
    this.time += dt;
    this.writes = 0;
    this._g = g;
    const v = g.view, pl = g.player, H = this.ui.vh, W = this.ui.vw;
    const play = g.state === 'play', calm = !!(this.ui.dlg || g.cutscene || v.shotW > 0.5 || g.hudOff);
    const near = this.nearCount(g);     // live enemies within the pip distance (0: the reach / aim loops are skipped)
    // ---- crosshair state: target ring / enemy in reach
    const tg = g.target, reach = play && !calm && !tg && near > 0 && this.inReach(g);
    const st = tg ? 'target' : reach ? 'reach' : 'idle';
    if (this.xState !== st) { this.xState = st; this.ui.crossEl.dataset.st = st; this.writes++; }
    const tp = v.mode === 'tp';
    if (this.xTp !== tp) { this.xTp = tp; this.ui.crossEl.classList.toggle('tp', tp); this.writes++; }
    // ---- damage petals (angle recomputed from the source each frame, so they turn with the view)
    // (opacity in 1/20 steps and the angle in ½° steps: a still view writes nothing, a turning one only the transform)
    const R = H * TH.petalR;
    for (let i = 0; i < 4; i++) {
      const s = this.petals[i];
      if (s.t > s.life) { if (s.on) { s.on = false; s.q = null; this.writes += sty(s.e, 'opacity', '0'); } continue; }
      s.t += dt;
      const rel = s.fx == null ? (s.rel || 0) : wrap(Math.atan2(s.fx - pl.pos.x, s.fz - pl.pos.z) - v.yaw);
      const k = s.t / s.life, deg = Math.round(-rel / D2R * 2) / 2;
      s.on = true;
      this.writes += sty(s.e, 'opacity', String(Math.round(18 * (1 - k * k)) / 20));
      if (deg !== s.q || R !== s.qR) {
        s.q = deg; s.qR = R; const phi = deg * D2R;
        this.writes += sty(s.e, 'transform', 'translate(' + Math.round(Math.sin(phi) * R) + 'px,' + Math.round(-Math.cos(phi) * R) + 'px) rotate(' + deg + 'deg)');
      }
    }
    // ---- threat chevrons and the look-up caret. A threat gets a chevron when it is off the screen as the camera sees
    // it (behind the eye, past TH.chevNdc of the half-width, or under the bottom edge): the same edge WP5's offView
    // announces by, whatever the FOV, aspect or view. In front but above the view: the "look up!" caret instead
    let up = false;
    const cam = !!v.camera;
    for (let i = 0; i < 4; i++) {
      const s = this.chevs[i];
      if (s.src && gone(g, s.src)) { s.t = 9; s.src = null; }      // killed / removed / despawned: no chevron to a ghost
      if (s.t > s.life || calm) { if (s.on) { s.on = false; this.writes += sty(s.e, 'opacity', '0'); } if (!calm) s.t += dt; continue; }
      s.t += dt;
      // the source's body middle (its hurtbox; flyers at their height), else the point the event gave
      const h = s.src ? hb(s.src) : null, x = h ? h.x : s.x, z = h ? h.z : s.z, y = h ? (h.y0 + h.y1) / 2 : s.y;
      let off, ang;
      if (cam) {
        const sp = project(at(x, y, z), _scr), edge = TH.chevNdc - (s.on ? 0.04 : 0);   // a little hysteresis at the edge
        off = sp.behind || Math.abs(sp.ndcX) > edge || sp.ndcY < -1.02;
        // the way to turn, as the lock reticle reads it: in front the projected direction; behind the eye the depth is
        // added to the down axis (behind-left = lower left, straight behind = bottom)
        if (off) ang = sp.behind ? Math.atan2(sp.vx, sp.vy - sp.vz) : Math.atan2(sp.vx, sp.vy);
        else if (sp.ndcY > 0.9) up = true;
      } else {
        const rel = wrap(Math.atan2(x - pl.pos.x, z - pl.pos.z) - v.yaw);
        off = Math.abs(rel) > TH.chevCone * D2R; ang = -rel;
      }
      if (!off) { if (s.on) { s.on = false; this.writes += sty(s.e, 'opacity', '0'); } continue; }
      // on the free-area ellipse (the one the lock reticle uses: under the compass, above the key chips, clear of the
      // touch controls), pointing out toward the threat; the 4 Hz pulse is a CSS animation, so a frame only moves it
      const deg = Math.round(ang / D2R * 2) / 2, p = this.edgePoint(deg * D2R, TH.chevEdge * this.ui.u, W, H, _ep);
      const px = Math.round(p.x - W / 2), py = Math.round(p.y - H / 2);
      s.on = true;
      this.writes += sty(s.e, 'opacity', '1');
      if (deg !== s.q || px !== s.px || py !== s.py) {
        s.q = deg; s.px = px; s.py = py;
        this.writes += sty(s.e, 'transform', 'translate(' + px + 'px,' + py + 'px) rotate(' + deg + 'deg)');
      }
    }
    if (this.upOn !== up) { this.upOn = up; this.writes += sty(this.lookUp, 'opacity', up ? '1' : '0'); }
    // ---- lock-on reticle (C1), then the enemy pips (a locked target off screen hangs its pips on the edge reticle)
    this.reticleFrame(g, W, H, calm);
    this.pipFrame(g, W, H, calm, near);
    // ---- TP: Pip's projected box (prompt / coach placement) and a small marker over the interaction target
    this.pipBoxFrame(v, pl);
    const tm = this.tm;
    tm.on = false;
    if (tg && tp && !calm && Number.isFinite(tg.x)) {
      const s = project(at(tg.x, (tg.y ?? pl.pos.y) + Math.min(tg.h || 1.2, 1.6) + 0.15, tg.z), _scr);
      if (!s.behind && s.onScreen) { tm.on = true; tm.x = Math.round(clamp(s.x, 30, W - 30)); tm.y = Math.round(clamp(s.y, this.ui.safeTop + 40, H - 30)); }
    }
    if (tm.on) { this.writes += sty(this.tmark, 'opacity', '1'); this.writes += sty(this.tmark, 'transform', 'translate(' + tm.x + 'px,' + tm.y + 'px)'); }
    else this.writes += sty(this.tmark, 'opacity', '0');
    // ---- speed lines (C9)
    const sp = play && !calm ? clamp(+v.speedFx || 0, 0, 1) : 0;
    const so = this.ui.reduced ? 0 : Math.round(sp * TH.speedAlpha * 50) / 50;
    if (this.speedO !== so) { this.speedO = so; this.writes += sty(this.speed, 'opacity', String(so)); }
    return this.writes;
  }
  /** live enemies within the pip distance (cheap: a squared-distance test per enemy) */
  nearCount(g) {
    const pl = g.player.pos, d2 = TH.pipDist * TH.pipDist, E = g.enemies;
    let n = 0;
    for (let i = 0; i < E.length; i++) { const e = E[i]; if (!e.alive) continue; const dx = e.pos.x - pl.x, dz = e.pos.z - pl.z; if (dx * dx + dz * dz <= d2) n++; }
    return n;
  }
  /** an enemy inside sword reach and the swing cone (approximate, HUD only: the hit test is WP4's) */
  inReach(g) {
    const pl = g.player, v = g.view, rr = (pl.reach || 1.6) + 0.3, E = g.enemies;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > rr + (e.r || 0.4)) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - v.aimYaw)) > TH.reachCone * D2R) continue;
      const h = hb(e);
      if (h && (h.y0 > pl.pos.y + 2.2 || h.y1 < pl.pos.y - 0.2)) continue;
      return true;
    }
    return false;
  }
  /** the enemy nearest the crosshair ray within 8 m and 10° (cheap: ≤ 8 enemies) */
  aimed(g) {
    const pl = g.player, v = g.view, E = g.enemies;
    let best = null, ba = TH.aimDeg * D2R;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (!e.alive) continue;
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > TH.pipDist) continue;
      const a = Math.abs(wrap(Math.atan2(dx, dz) - v.aimYaw)) - Math.atan((e.r || 0.4) / Math.max(d, 0.3));
      if (a < ba) { ba = a; best = e; }
    }
    return best;
  }
  /** a pip candidate (live, in the world, not listed yet, at most 3) */
  addPip(e) {
    const out = this._out, g = this._g;
    if (e && e.alive !== false && !e.removed && out.length < 3 && out.indexOf(e) < 0 && g.enemies.indexOf(e) >= 0) out.push(e);
  }
  pipFrame(g, W, H, calm, near) {
    const v = g.view, pl = g.player, lock = v.lockTarget, out = this._out, u = this.ui.u;
    out.length = 0;
    if (!calm) {
      this.addPip(lock);
      if (near > 0) this.addPip(this.aimed(g));
      if (this.lastHit.size) this.lastHit.forEach(this._hitFn);
    }
    for (let i = 0; i < 3; i++) {
      const P = this.pips[i], e = out[i];
      let x = 0, y = 0, ok = false;
      if (e) {
        const d = Math.hypot(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z), h = (d <= TH.pipDist || e === lock) ? hb(e) : null;
        const s = h && project(at(h.x, h.y1 + TH.pipLift, h.z), _scr);
        // on screen or just past its edge (a tall enemy close by): just above the head, kept inside the free area
        if (s && !s.behind && Math.abs(s.ndcX) <= 1.15 && s.ndcY <= 1.6 && s.ndcY >= -1.15) {
          ok = true; x = clamp(s.x, 40, W - 40); y = clamp(s.y - TH.pipPx * u, this.freeTop() + 30 * u, H - 40);
        } else if (e === lock && this.ret.edge && this.retOn) {
          // the locked target is off screen: the pips hang on the inner side of the edge reticle
          const r = this.ret, k = (TH.retMin / 2 + 8) * u;
          ok = true; x = clamp(r.x, 60, W - 60); y = Math.cos(r.ang) > 0 ? r.y + k + 44 * u : r.y - k;
        }
      }
      if (!ok) { if (P.on) { P.on = false; this.writes += sty(P.e, 'opacity', '0'); P.who = null; } continue; }
      const max = Math.min(TH.pipMax, Math.max(1, Math.round(actorMax(e)))), hp = clamp(Math.ceil(e.hp), 0, max);
      if (P.who !== e || P.n !== max || P.hp !== hp) {
        P.who = e; P.n = max; P.hp = hp;
        let html = '';
        for (let k = 0; k < max; k++) html += `<span class="${k < hp ? 'f' : 'e'}">${HEART}</span>`;
        P.in.innerHTML = (e === lock && e.name ? `<b>${String(e.name).replace(/[<>&]/g, '')}</b>` : '') + `<span class="hs">${html}</span>`;
        this.writes++;
      }
      P.on = true;
      this.writes += sty(P.e, 'opacity', '1');
      this.writes += sty(P.e, 'transform', 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)');
    }
  }
  /** the top of the free area: under the compass + objective line, and under the region card until it has faded out */
  freeTop() { const ui = this.ui; return ui.safeTop + (ui.bannerExtra && performance.now() < (ui.bannerUntil || 0) ? ui.bannerExtra : 0); }
  /** where an edge indicator sits for a direction ang (0 = up, +π/2 = right) of reticle half-extent hh: on an ellipse
   *  inside the free area (under the compass + objective line, above the bottom widgets / the phone deck), so it never
   *  lands on the hearts, the minimap, the compass or the key chips; with touch controls up the lower half narrows
   *  between the stick and the thumb cluster (landscape) or stays above the control deck (portrait) */
  edgePoint(ang, hh, W, H, o) {
    const ui = this.ui, cx = W / 2, cy = H / 2, inp = G.input, touch = !!(inp && inp.touchOn);
    // (the region card may push it down by at most 40 % of the room above the crosshair: on a short phone screen an
    // indicator crowding the crosshair is worse than one over the fading card)
    const top = Math.min(this.freeTop(), ui.safeTop + Math.max(0, cy - ui.safeTop - hh) * 0.4), bot = H - (touch && ui.lay === 'port' ? H * 0.36 + 8 : ui.safeBottom);
    const ax = Math.max(20, cx - hh - 6), ayT = Math.max(10, cy - top - hh), ayB = Math.max(10, bot - cy - hh);
    const c = Math.cos(ang), sn = Math.sin(ang);
    let axk = ax;
    if (c < 0 && touch && ui.lay !== 'port') axk = ax - (ax - Math.max(20, Math.min(ax, cx - (ui.lay === 'desk' ? 300 * ui.u : 240)))) * -c;
    o.x = cx + sn * axk; o.y = c > 0 ? cy - c * ayT : cy - c * ayB;
    return o;
  }
  reticleFrame(g, W, H, calm) {
    const t = g.view.lockTarget, R = this.reticle, ret = this.ret;
    let h = null;
    if (t && !calm && t.alive !== false && !t.removed && !t.dying) h = hb(t);
    if (!h) { if (this.retOn) { this.retOn = false; this.retWho = null; ret.edge = false; this.writes += sty(R, 'opacity', '0'); } return; }
    const y = (h.y0 + h.y1) / 2, s = project(at(h.x, y, h.z), _scr2), u = this.ui.u;
    let x, yy, size, edge = false, ang = 0;
    if (s.behind || !s.onScreen) {
      // off screen: a small reticle on the free-area ellipse, its arrow pointing the way to turn. In front of the eye
      // that is the projected direction (camera-space x / y). Behind it the "how far behind" depth is added to the
      // down axis, so the screen reads like the chevrons and petals (behind you on the left = lower left, straight
      // behind = bottom) and a target under a view tipped all the way up still points down; both meet at the eye plane
      edge = true;
      ang = s.behind ? Math.atan2(s.vx, s.vy - s.vz) : Math.atan2(s.ndcX * W, s.ndcY * H);
      const p = this.edgePoint(ang, 46 * u, W, H, _pt);
      x = p.x; yy = p.y; size = TH.retMin * u;
    } else {
      // hugs the hurtbox (its larger projected side), within [retMin, retMax] × u
      x = s.x; yy = s.y;
      const px = G.view.px || 800, z = Math.max(0.5, s.viewZ);
      size = clamp(Math.max(h.r * 2, (h.y1 - h.y0) * 0.8) * px / z + 10 * u, TH.retMin * u, TH.retMax * u);
    }
    this.retOn = true; ret.x = x; ret.y = yy; ret.ang = ang; ret.edge = edge;
    this.writes += sty(R, 'opacity', '1');
    this.writes += sty(R, 'transform', 'translate(' + Math.round(x) + 'px,' + Math.round(yy) + 'px)');
    const sz = (Math.round(size / 2) * 2) + 'px';
    this.writes += sty(this.retIn, 'width', sz);
    this.writes += sty(this.retIn, 'height', sz);
    if (this.retEdge !== edge) { this.retEdge = edge; R.classList.toggle('edge', edge); }
    if (edge) this.writes += sty(R.lastChild, 'transform', 'rotate(' + Math.round(ang / D2R) + 'deg)');
    // a new target: the corners snap in from wide
    if (this.retWho !== t) {
      this.retWho = t;
      if (!this.ui.reduced && this.retIn.animate) try { this.retIn.animate([{ scale: '1.6', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.3,1.4,.6,1)' }); } catch (e) { /* ignore */ }
    }
  }
  /** TP: Pip's screen box from two projections (feet, top of the hood); null in FP, mid-blend or when he is faded out */
  pipBoxFrame(v, pl) {
    this.pipBox = null;
    if (!v.bodyOut || v.blend < 0.5 || (v.bodyFade ?? 1) < 0.3 || v.shotW > 0.5) return;
    const p = pl.root ? pl.root.position : pl.pos;
    const a = project(at(p.x, p.y, p.z), _scr);
    if (a.behind) return;
    const fx = a.x, fy = a.y;
    const b = project(at(p.x, p.y + 1.08, p.z), _scr);
    if (b.behind) return;
    const hpx = Math.max(8, fy - b.y), hw = hpx * 0.3, B = this._pb;
    B.l = (fx + b.x) / 2 - hw; B.r = (fx + b.x) / 2 + hw; B.t = b.y - hpx * 0.04; B.b = fy;
    this.pipBox = B;
  }
  /** drop everything (session start, title) */
  reset() {
    for (const s of this.petals) { s.t = 9; s.on = true; }
    for (const s of this.chevs) { s.t = 9; s.src = null; s.on = true; }
    this.lastHit.clear(); this.retWho = null; this.ret.edge = false;
  }
}
