// Module wp6-hud: wires the event bus to the HUD parts built by ui.js (petals ← EV.HURT, chevrons ← EV.TELEGRAPH,
// hit marker / kill star ← EV.HIT / EV.CLINK / EV.KILL, pickup feed ← EV.COLLECT, hints ← EV.HINT, coach steps ←
// EV.SWING / EV.JUMP / EV.DASH_START), resets per session, the portrait "turn sideways" tip, and G.debug.hud.* helpers
// (state, simulate providers, the overlap audit used by the wp6 suite and the tour scripts).
import { G } from '../core.js';
import { EV } from '../events.js';
import { fmtKeys, deviceKind } from './keys.js';
import { hudMem } from './notify.js';

const D2R = Math.PI / 180;

/** visible rect of an element (display / visibility / effective opacity ≥ 0.05 / in the DOM), else null */
function visRect(e) {
  if (!e || !e.isConnected) return null;
  let o = 1;
  for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    o *= +cs.opacity;
  }
  if (o < 0.05) return null;
  const r = e.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1 ? r : null;
}
const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** forbidden overlaps on screen right now: HUD widgets with each other, touch controls with anything, dialogue with
 *  HUD widgets, and any card / HUD widget leaving the viewport → { count, list: [[a, b, px²]], rects } */
export function audit() {
  const ui = G.ui, q = (s) => [...document.querySelectorAll(s)];
  const named = (list) => list.map(([n, e]) => [n, e, visRect(e)]).filter((x) => x[2]);
  const hud = named([['hearts', ui.hearts], ['counters', ui.counters], ['feed', ui.feedEl], ['compass', ui.compassEl], ['objective', ui.objEl], ['bossbar', ui.bossbar],
    ['banner', ui.banner], ['minimap', ui.mini], ['coach', ui.coachEl], ['keyhints', ui.keyHintsEl], ['prompt', ui.promptEl], ['bosscard', ui.bosscard], ['dizzy', ui.dizzyEl.querySelector('.dt')], ['crosshair', ui.crossEl.querySelector('.xdot')]]);
  const touch = named(q('#touch .tb, #touch .stick').map((e) => ['touch.' + (e.dataset.a || e.className.split(' ').join('.')), e]));
  const dlg = named([['dialogue', ui.dlgEl]]);
  const cards = named([['shop', ui.shopEl], ['pause', ui.pauseEl.querySelector('.card')], ['settings', ui.settingsEl.querySelector('.card')], ['controls', ui.controlsEl.querySelector('.card')],
    ['map', ui.mapEl.querySelector('.card')], ['chatlog', ui.logEl.querySelector('.card')], ['ending', ui.endingEl.querySelector('.card')], ['veil', ui.veilEl.querySelector('.chip')], ['title-menu', ui.titleEl.querySelector('.menu')]]);
  const list = [], W = innerWidth, H = innerHeight;
  const pair = (A, B, same) => { for (let i = 0; i < A.length; i++) for (let j = same ? i + 1 : 0; j < B.length; j++) { const a = inter(A[i][2], B[j][2]); if (a > 4) list.push([A[i][0], B[j][0], Math.round(a)]); } };
  pair(hud, hud, true); pair(touch, touch, true); pair(touch, hud); pair(touch, dlg); pair(touch, cards); pair(dlg, hud);
  for (const [n, , r] of [...hud, ...cards, ...dlg, ...touch]) if (r.left < -2 || r.top < -2 || r.right > W + 2 || r.bottom > H + 2) list.push([n, 'viewport', Math.round(Math.max(-r.left, -r.top, r.right - W, r.bottom - H))]);
  const rects = {};
  for (const [n, , r] of [...hud, ...touch, ...dlg, ...cards]) rects[n] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
  return { count: list.length, list, rects, size: [W, H] };
}

export default {
  name: 'wp6-hud',
  attach(game) {
    this.game = game;
    const ui = game.ui, E = game.events, on = (t, f) => E.on(t, (p) => { try { f(p || {}); } catch (e) { ui.err(e); } });
    // a wind-up or a hurt: the region card (upper centre, where flyers rise) gives the screen to the fight
    on(EV.HURT, (p) => { ui.fx.hurt(p); ui.notices.hideBanner(); });
    on(EV.TELEGRAPH, (p) => { ui.fx.telegraph(p); ui.notices.hideBanner(); });
    on(EV.HIT, (p) => ui.fx.hit(p, 'hit'));
    on(EV.CLINK, (p) => ui.fx.hit(p, 'clink'));
    on(EV.KILL, (p) => ui.fx.hit(p, 'kill'));
    on(EV.COLLECT, (p) => ui.collected(p));
    on(EV.HINT, (p) => ui.hint(p.id, p.text, p.life));
    on(EV.SWING, () => ui.coach.action('swing'));
    on(EV.JUMP, () => ui.coach.action('jump'));
    on(EV.DASH_START, () => ui.coach.action('dash'));
    on(EV.DOWN, () => ui.notices.hideBanner());       // "Pip got dizzy!" owns the upper screen
    for (const t of [EV.REGION, EV.BOSS_DEFEATED, EV.FIGHT_END, EV.BOSS_FIGHT, EV.SAVE]) on(t, () => { ui.markersDirty = true; });
    on(EV.DEVICE, () => {
      if (ui.shop) ui.renderShop();
      ui.promptKey = '';
      // (the "Controller ready" line waits for play: frameInput below)
    });
    this.ui = ui;
    game.registerDebug('hud', {
      /** HUD snapshot for tests */
      state: () => {
        const f = ui.frameMs.slice().sort((a, b) => a - b), p = (k) => (f.length ? +f[Math.min(f.length - 1, Math.floor(k * f.length))].toFixed(4) : 0);
        return { lay: ui.lay, u: +ui.u.toFixed(3), cross: ui.crossEl.dataset.st || 'idle', crossOn: ui.crossOn, prompt: ui.promptHidden ? null : ui.promptEl.textContent,
          petals: ui.fx.petals.filter((s) => s.on).length, chevrons: ui.fx.chevs.filter((s) => s.on).length, lookUp: !!ui.fx.upOn, pips: ui.fx.pips.filter((s) => s.on).length,
          reticle: !!ui.fx.retOn, speed: ui.fx.speedO || 0, feed: ui.feed.lines.filter((l) => !l.out).map((l) => l.e.textContent), objective: ui.objShown || '',
          coach: ui.coach.step, coachText: ui.coach.shownKey ? ui.coach.ct.textContent : '', hints: ui.coach.hints.length, banner: ui.banner.classList.contains('show'),
          bossCard: ui.bosscard.classList.contains('show'), bossBar: !ui.bossbar.classList.contains('hidden'), menu: ui.menu, cpu: { p50: p(0.5), p95: p(0.95), n: f.length },
          compassDraws: ui.compass.draws, miniDraws: ui.minimap.draws, markers: ui.markers.map((m) => m.id), writes: ui.fx.writes, chatLog: ui.chatLog.length, veil: !!ui.veilOn };
      },
      audit,
      /** simulate providers: a hurt from relDeg (+ = left), a telegraph at relDeg / dist, a lock target */
      petal: (relDeg = 90, dist = 3) => { const pl = G.player, a = G.view.yaw + relDeg * D2R; G.events.emit(EV.HURT, { dmg: 1, fromX: pl.pos.x + Math.sin(a) * dist, fromY: pl.pos.y, fromZ: pl.pos.z + Math.cos(a) * dist, knock: 0, source: 'enemy', hurtDir: { x: Math.sin(a), z: Math.cos(a) }, rel: relDeg * D2R }); },
      telegraph: (relDeg = 120, dist = 6, t = 1, y = null) => { const pl = G.player, a = G.view.yaw + relDeg * D2R; G.events.emit(EV.TELEGRAPH, { kind: 'lunge', x: pl.pos.x + Math.sin(a) * dist, y: y ?? pl.pos.y + 0.5, z: pl.pos.z + Math.cos(a) * dist, t, source: null }); },
      hint: (id, text) => G.events.emit(EV.HINT, { id, text }),
      fmt: (text, device) => fmtKeys(text, { device }),
      coach: (step) => { if (step == null) return ui.coach.step; ui.coach.start(() => ui.onControlsClosed && ui.onControlsClosed()); ui.coach.step = step; return step; },
      layout: () => { ui.layout(); return ui.lay; },
    });
  },
  onSession(isNew) {
    const ui = this.ui;
    ui.fx.reset(); ui.notices.reset(); ui.feed.clear(); ui.markersDirty = true;
    ui.coach.stop();
    if (isNew) ui.chatLog.length = 0;     // Continue keeps the chat log of this page visit
    ui.keyHints.session();
    // portrait phones start in third person: a one-time tip about the comfier sideways first-person view
    if (ui.lay === 'port' && deviceKind() === 'touch' && !hudMem.get().sideways) {
      hudMem.set({ sideways: true });
      clearTimeout(this.sideT);     // (kept, so the title and the wp6 suite can drop a tip that has not queued yet)
      this.sideT = setTimeout(() => ui.hint('sideways', 'Turn your phone sideways for the comfiest first-person view', 6), 2500);
    }
  },
  onTitle() {
    const ui = this.ui;
    ui.coach.stop(); ui.fx.reset(); ui.notices.reset(); ui.feed.clear(); clearTimeout(this.sideT);
    // play-only overlays off (the HUD frame does not run on the title)
    ui.setVignette(0); ui.setFlash(0); ui.lowOn = ui.critOn = false; ui.vignette.classList.remove('low');
    if (G.renderer) G.renderer.domElement.classList.remove('crit');
    ui.fx.speed.style.opacity = '0'; ui.fx.speedO = 0;
  },
  onResize() { this.ui.layout(); },
  /** the first controller use: a system line (art §12.2 system chip), so the new glyphs make sense. It waits for the
   *  first moment Pip is free and the HUD is up (not the title, the wake-up fade, the intro talk, a cutscene or a menu):
   *  a pad player usually picks the pad up on the title, where EV.DEVICE fires once, while there is no feed to show it */
  frameInput(input) {
    if (this.padNoted || !input || input.lastDevice !== 'pad') return;
    const g = this.game, ui = this.ui;
    if (!g.playing || ui.hud.classList.contains('off')) return;
    this.padNoted = true;
    ui.feed.push('Controller ready ✿', { kind: 'note', key: 'pad' });
  },
};
