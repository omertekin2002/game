// HTML/CSS overlay UI (WP6): play HUD (hearts / gems / potions, pickup feed, compass + objective + seed tray, boss bar,
// region card, heading-up minimap, crosshair + prompt pill, damage petals, threat chevrons, hit markers, lock reticle,
// enemy pips, speed lines, low-HP beat, coach marks + hints), dialogue, shop, pause / settings / controls / map /
// ending cards, title + loading screens, the "Click to play" veil. Parts live in js/hud/*.js; the wp6-hud module
// (js/hud/hud.js) wires the events. Every player-facing string goes through fmtKeys (key tokens, contract C7).
// Layout: one scale unit --u (desktop) or the phone layouts (#ui.lay-land / .lay-port), set by layout().
import * as THREE from 'three';
import { G, sfx, spriteUrl, isMuted, toggleMute } from './core.js';
import { SEED_ORDER, SEEDS, SHOP, REGIONS, CFG } from './data.js';
import { HALF, N } from './world-const.js';
import { clamp } from './util.js';
import { project, refreshViewport } from './hud/projector.js';
import { settings } from './settings.js';
import { Assets } from './assets.js';
import { hud as TH } from './tune.js';
import { fmtKeys, keyParts, deviceKind, esc } from './hud/keys.js';
import { iconHtml, iconUrl, preloadIcons } from './hud/icons.js';
import { Feedback, sty } from './hud/feedback.js';
import { uiSfx } from './hud/sound.js';
import { Feed, Notices, Coach, KeyHints, hudMem } from './hud/notify.js';
import { Compass, Minimap, MapCard, navMarkers, objective } from './hud/nav.js';
import { MenuList, SettingsCard, ControlsCard, Nav } from './hud/menus.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
// a sprite that 404s or fails to decode hides instead of showing a broken-image icon (every asset may be missing)
const img = (key, cls = '') => { const u = spriteUrl(key); return u ? `<img class="${cls}" src="${u}" alt="" draggable="false" onerror="this.style.visibility='hidden'">` : ''; };
// HUD heart: the sprites over a drawn heart that shows instead when a heart sprite is absent or fails to load
const HEART_PATH = 'M16 27.5C5 19.5 1 14 1 8.8 1 4.6 4.3 1.5 8.4 1.5c3.2 0 6 1.8 7.6 4.5 1.6-2.7 4.4-4.5 7.6-4.5 4.1 0 7.4 3.1 7.4 7.3 0 5.2-4 10.7-15 18.7z';
const heartSvg = (c) => `<svg class="hg ${c}" viewBox="0 0 32 29" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
const heartImg = (key, cls) => { const u = spriteUrl(key); return u ? `<img class="${cls}" src="${u}" alt="" draggable="false" onerror="this.parentNode.classList.add('nosprite')">` : ''; };
const heartSprites = () => !!(spriteUrl('heart') && spriteUrl('heart_empty')) && !(G.assets && (G.assets.failed.has('sprites.heart') || G.assets.failed.has('sprites.heart_empty')));
// gem / potion counters: sprite with a drawn fallback
const gemFb = '<svg class="cfb" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 9 12 22 3 9Z" fill="#7fe3d6" stroke="#4a2c1a" stroke-width="2" stroke-linejoin="round"/></svg>';
const potFb = '<svg class="cfb" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v4l4 5v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7l4-5Z" fill="#ff9fb6" stroke="#4a2c1a" stroke-width="2" stroke-linejoin="round"/></svg>';
const cimg = (key, fb) => { const u = spriteUrl(key); return u ? `<span class="ci">${fb}<img src="${u}" alt="" draggable="false" onerror="this.remove()"></span>` : `<span class="ci">${fb}</span>`; };
const NAME_COL = { npc_turtle: '#7a9a4a', npc_frog: '#d84a3a', npc_cat: '#f59a50', npc_bunny: '#f08aa0', npc_owl: '#8a5a7a', npc_mole: '#8a5a3a' };
const TIPS = ['Look at something and press {interact} to talk or read.', 'Your compass knows where the next guardian is.', 'Hop over shockwave rings!',
  'Pip\'s shadow has fox ears. Look down on a sunny day.', 'Keep swinging: the third hit of a combo is a big chop.', 'Lost? Open the map with {map} and drop a marker.'];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _p = new THREE.Vector3(), _scr = {};
/** this frame's dt (the clock's clamped, snapped frame time; 1/60 before the clock exists) */
const frameDt = () => { const c = G.clock; return c && c.dt > 0 ? Math.min(c.dt, 0.1) : 1 / 60; };
const reduceQ = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
/** the desktop top-row fit (pure, so tests can try any viewport): hearts columns, compass size, boss bar width (0 = CSS).
 *  lay, w (CSS px), u (scale unit), n (heart containers), mini (minimap shown), hs (HUD size), cnt (the gem + potion
 *  counters' width in px; they sit just under one row of hearts, level with the compass's lower edge)
 *  → { cols, cw, ch, bw } */
export function topFit(lay, w, u, n, mini, hs = 1, cnt = 160 * u) {
  if (lay !== 'desk') return { cols: 5, cw: lay === 'land' ? 360 * hs : Math.min(w - 28, 420), ch: 28 * hs, bw: 0 };
  const full = TH.compassW * u, hw = 39 * u, left = 24 * u, right = mini ? (24 + TH.miniSize) * u : 0, gap = 12;
  const heartsW = (c) => Math.min(n, c) * hw;
  // the widest centred compass that fits: beside one row of hearts and the counters under it (two rows of hearts push
  // the counters below the compass), and the minimap
  const room = (c) => (w / 2 - Math.max(left + Math.max(heartsW(c), n > c ? 0 : cnt), right) - gap) * 2;
  const cols = room(10) >= full ? 10 : 5;
  const cw = Math.max(200 * u, Math.min(full, room(cols)));
  // the boss bar sits a row lower: beside the counters and a second row of hearts
  const bw = Math.max(200 * u, Math.min(640 * u, w - 32, (w / 2 - left - Math.max(heartsW(cols), cnt) - gap) * 2));
  return { cols, cw, ch: TH.compassH * u, bw };
}

export class UI {
  constructor(root) {
    this.root = root;
    this.floaters = [];
    this.dlg = null;
    this.shop = null;
    this.menu = null; // 'pause' | 'settings' | 'controls' | 'map' | 'ending' | null
    this.shown = { hp: -1, maxHp: -1, coins: -1, potions: -1, seeds: -1 };
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    this.frameMs = []; this.markers = [];
    this.build();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    settings.on('*', (v, k) => this.onSetting(k, v));
    this.applySettings();
  }
  build() {
    const R = this.root;
    // ---- play HUD (#hud: everything here hides with showHud(false) / G.debug.hud(false))
    this.hud = el('div', 'off', null, R); this.hud.id = 'hud';
    const tl = el('div', 'col', null, this.hud); tl.id = 'tl';
    this.hearts = el('div', '', null, tl); this.hearts.id = 'hearts';
    this.counters = el('div', '', `<div class="counter gems">${cimg('coin', gemFb)}<b>0</b></div><div class="counter pots">${cimg('potion', potFb)}<b>0</b></div>`, tl); this.counters.id = 'counters';
    this.feedEl = el('div', '', null, tl); this.feedEl.id = 'feed';
    this.feed = new Feed(this.feedEl);
    const tc = el('div', 'col', null, this.hud); tc.id = 'tc';
    this.compassEl = el('div', '', null, tc); this.compassEl.id = 'compass';
    this.compass = new Compass(this.compassEl);
    this.objEl = el('div', '', `<div id="seeds">${SEED_ORDER.map((k) => `<div class="seed-slot" data-k="${k}">${img(SEEDS[k].key)}<i class="sfb"></i></div>`).join('')}</div><div class="obj"></div>`, tc); this.objEl.id = 'objline';
    this.seedsEl = $('#seeds', this.objEl); this.objText = $('.obj', this.objEl);
    this.bossbar = el('div', 'hidden', '<div class="bn"></div><div class="track"><div class="lag"></div><div class="fill"></div></div><div class="now">Now!</div>', tc); this.bossbar.id = 'bossbar';
    this.banner = el('div', 'panel', '<div class="vista none"></div><div class="btx"><div class="t"></div><div class="s"></div></div>', tc); this.banner.id = 'banner';
    this.mini = el('div', '', null, this.hud); this.mini.id = 'minimap';
    this.minimap = new Minimap(this.mini);
    this.coachEl = el('div', '', null, this.hud); this.coachEl.id = 'coach';
    this.keyHintsEl = el('div', '', null, this.hud); this.keyHintsEl.id = 'keyhints';
    // ---- world-anchored + overlays (DOM order = stacking, ARCHITECTURE §6)
    this.promptEl = el('div', 'prompt hidden', '<span class="pk"></span><span class="pv"></span><span class="pn"></span>', R);
    this.promptEl.id = 'prompt';
    this.floatRoot = el('div', '', null, R);
    this.toastEl = this.feedEl;    // toasts are feed lines now (G.debug.hud hides it with the HUD)
    this.bosscard = el('div', '', '<div class="badge"></div><div class="bw"><div class="bt"></div><div class="bs"></div></div>', R); this.bosscard.id = 'bosscard';
    this.vignette = el('div', '', null, R); this.vignette.id = 'vignette';
    this.dizzyEl = el('div', '', '<div class="stars"><i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div><div class="dt">Pip got dizzy!</div>', R); this.dizzyEl.id = 'dizzy';
    this.flashEl = el('div', '', null, R); this.flashEl.id = 'flash';
    // dialogue
    this.dlgEl = el('div', 'panel interactive', '<div class="portrait"></div><div class="body"><div class="name"></div><div class="text"></div><div class="arrow"></div></div>', R); this.dlgEl.id = 'dialogue';
    this.dlgEl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dlgClick = true; });
    // shop: a full-screen backdrop (no click reaches the world) holding the panel
    this.shopWrap = el('div', 'overlay hidden', '<div class="panel" id="shop"></div>', R); this.shopWrap.id = 'shopwrap';
    this.shopEl = $('#shop', this.shopWrap);
    // overlay cards
    this.pauseEl = this.overlay('pause', `<div class="card panel"><h2>Paused</h2><div class="pseeds"></div><div class="small sub"></div><div class="menu">
      <button class="btn" data-i="0">Resume</button><button class="btn" data-i="1">Settings</button><button class="btn" data-i="2">Controls</button>
      <button class="btn" data-i="3">Map</button><button class="btn" data-i="4">Chat log</button><button class="btn" data-i="5">Save &amp; Quit</button></div></div>`);
    this.settingsEl = this.overlay('settings', `<div class="card panel wide"><div class="chead">${iconHtml('act_settings', '', 'hico')}<h2>Settings</h2></div><div class="tabs"></div>
      <div class="sbody"></div><div class="scue"><button class="smore" tabindex="-1" aria-label="More settings below">more ▾</button></div>
      <div class="cfoot"><span class="small fkeys"></span><button class="btn sm" data-reset>Reset tab</button><button class="btn sm" data-back>Back</button></div></div>`);
    this.controlsEl = this.overlay('controls', `<div class="card panel wide"><div class="chead">${iconHtml('pic_keycap', '', 'hico')}<h2>Controls</h2></div><div class="tabs"></div>
      <div class="controls-grid"></div><div class="small goal">Find the three Starseeds and bring them home to the altar under the Great Tree.</div>
      <div class="cfoot"><span class="small fkeys"></span><button class="btn sm sel" data-close>Back</button></div></div>`);
    // chat log: the last 20 lines anyone said (art §12.3 backlog), from the pause menu
    this.logEl = this.overlay('chatlog', `<div class="card panel wide"><div class="chead">${iconHtml('icon_talk', '', 'hico')}<h2>Chat log</h2></div>
      <div class="lbody"></div><div class="cfoot"><span class="small fkeys"></span><button class="btn sm sel" data-close>Back</button></div></div>`);
    this.chatLog = [];
    this.mapEl = this.overlay('mapview', `<div class="card panel paper"><div class="mhead"><h2>Starseed Isle</h2><button class="btn sm x" data-close aria-label="Close">✕</button></div>
      <div class="mframe"><canvas></canvas></div><div class="legend"></div><div class="small mhint"></div></div>`);
    this.endingEl = this.overlay('ending', `<div class="eart"></div><div class="card panel"><div class="et">✿ Starseed Isle is blooming again! ✿</div><div class="es">Thanks for playing</div>
      <div class="ex"></div></div>`);
    this.fadeEl = el('div', '', null, R); this.fadeEl.id = 'fade';
    // title + loading
    this.titleEl = el('div', 'gone', `<div class="bgw"><div class="bg"></div></div><div class="shade"></div>
      <div class="logo"><div class="l1">Starseed <span class="s">Isle</span></div><div class="l2">a cozy little adventure</div></div>
      <div class="menu"><button class="btn" data-a="new">New Adventure</button><button class="btn" data-a="continue">Continue</button><button class="btn" data-a="settings">Settings</button><div class="confirm"></div></div>
      <div class="foot">Mouse + keyboard · gamepad · touch</div>`, R);
    this.titleEl.id = 'title';
    // first-person helpers: crosshair (feedback.js fills it) and the "Click to play" veil (pointer lock missing while wanted)
    this.crossEl = el('div', 'hidden', null, R); this.crossEl.id = 'crosshair';
    this.veilEl = el('div', 'hidden', `<div class="panel chip">${iconHtml('pic_mouse', '', 'vico')}<span class="vt">Click to play</span></div>`, R); this.veilEl.id = 'veil';
    this.veilEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.onVeilClick && this.onVeilClick(); });
    this.loadingEl = el('div', '', `<div class="lbg"></div><div class="lveil"></div><div class="lstack"><div class="lt">Starseed <span>Isle</span></div>
      <div class="bar"><div class="fill"><i class="sprout"><b></b><b></b></i></div></div><div class="ls">Gathering sparkles...</div><div class="tip"></div></div>`, R);
    this.loadingEl.id = 'loading';
    this.debugEl = el('div', 'hidden', '', R); this.debugEl.id = 'debug';
    // ---- parts
    this.fx = new Feedback(this);
    // r4: the coach pill stacks over the world-anchored HUD Feedback just added (lock reticle, enemy pips, petals): on a
    // phone mid-fight the reticle corners and a heart pip drew over its text
    this.hud.appendChild(this.coachEl);
    this.notices = new Notices(this);
    this.coach = new Coach(this, this.coachEl);
    this.keyHints = new KeyHints(this.keyHintsEl);
    this.settingsCard = new SettingsCard($('.card', this.settingsEl), this);
    this.controlsCard = new ControlsCard($('.card', this.controlsEl), this);
    this.mapCard = new MapCard($('.card', this.mapEl));
    this.mapCard.onChange = (wp) => { uiSfx(wp ? 'waypoint' : 'uiBack'); this.markersDirty = true; };
    this.pauseList = new MenuList([...this.pauseEl.querySelectorAll('.menu button')], (i) => this.onPauseChoice(i));
    this.menuNav = new Nav();
    $('[data-close]', this.mapEl).addEventListener('click', () => this.closeMenu());
    $('[data-close]', this.logEl).addEventListener('click', () => this.closeMenu());
    this.tapClose(this.endingEl, () => this.closeEnding());
    this.initLoading();
    // a mouse-clicked button must not keep focus: Enter/Space (interact, dialogue) would click it again natively
    R.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button'); if (b) b.blur(); });
    // ghost clicks: a tap that made the game open a card (the tap that ends Miso's dialogue opens the shop) delivers its
    // click a moment later onto the new card; clicks on a card in its first 350 ms are dropped
    R.addEventListener('click', (e) => {
      const o = e.target && e.target.closest && e.target.closest('.overlay');
      if (o && e.isTrusted && performance.now() - (o.shownAt || 0) < 350) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    // last pointer position (the shop tells a real hover from a re-render under a resting cursor)
    document.addEventListener('mousemove', (e) => { this.ptrX = e.clientX; this.ptrY = e.clientY; }, { passive: true });
    preloadIcons(['icon_tree', 'icon_woods', 'icon_peaks', 'icon_shores', 'icon_shop', 'icon_waypoint']);
    // generated art with drawn fallbacks: the painted hurt vignette, the parchment behind the map
    const vu = Assets.url('ui', 'ui_vignette_hurt');
    if (vu) { const im = new Image(); im.onload = () => { this.vignette.style.setProperty('--vig', `url("${vu}")`); this.vignette.classList.add('art'); }; im.src = vu; }
    const pu = Assets.url('ui', 'ui_paper');
    if (pu) { const im = new Image(); im.onload = () => { $('.card', this.mapEl).style.backgroundImage = `url("${pu}")`; }; im.src = pu; }
  }
  overlay(id, html) {
    const o = el('div', 'overlay hidden', html, this.root);
    o.id = id;
    return o;
  }
  /** click-anywhere-to-close overlay: only a press that began on it after it opened counts. A touch button that opens
   *  it is hidden under the finger, and that same tap's click would otherwise land here and close it again */
  tapClose(o, fn) {
    o.addEventListener('pointerdown', () => { o.armed = true; });
    o.addEventListener('click', () => { if (o.armed) { o.armed = false; fn(); } });
  }
  showOverlay(o, on) {
    o.armed = false;
    if (on && o.classList.contains('hidden')) o.shownAt = performance.now();
    o.want = on;                                       // a quick open → close (or close → open) never strands a card
    if (on) { o.classList.remove('hidden'); requestAnimationFrame(() => { if (o.want) o.classList.add('show'); }); }
    else { o.classList.remove('show'); setTimeout(() => { if (!o.want) o.classList.add('hidden'); }, 250); }
  }

  // ---------------------------------------------------------------- layout + settings
  /** desktop: --u = clamp(min(w/1920, h/1080)·1.12, 0.72, 1.2) × hudScale; phones (short landscape / narrow portrait)
   *  use fixed-px layouts (art §13) × hudScale. Sizes the canvases. Called on resize and when hudScale changes */
  layout() {
    const w = window.innerWidth, h = window.innerHeight, hs = settings.get('hudScale') || 1;
    this.vw = w; this.vh = h;
    refreshViewport();                         // the projector's cached size (whoever calls layout first)
    const lay = h <= 500 && w > h ? 'land' : w <= 600 && h > w ? 'port' : 'desk';
    this.lay = lay;
    for (const k of ['desk', 'land', 'port']) this.root.classList.toggle('lay-' + k, k === lay);
    const u = lay === 'desk' ? clamp(Math.min(w / 1920, h / 1080) * TH.uK, TH.uMin, TH.uMax) * hs : hs;
    this.u = u;
    this.root.style.setProperty('--u', u.toFixed(4));
    this.fitTop(true);
    this.minimap.size(lay === 'desk' ? TH.miniSize * u : 96 * hs);
    this.feed.max = lay === 'desk' ? TH.feedMax : 2;
    this.markersDirty = true;
    if (this.settingsCard && this.settingsCard.open) this.settingsCard.cue();
    if (G.input && G.input.layoutTouch) G.input.layoutTouch();
  }
  /** the top row on a desktop layout: hearts (one row of up to 10) at the left, the compass centred, the minimap at the
   *  right. On narrow windows (portrait tablets, split screens: 601–900 px) the hearts wrap to rows of 5 and the compass
   *  and the boss bar narrow to the room between them, so late-game hearts never slide under the compass. Then the free
   *  band under the compass + objective line is measured (safeTop: edge indicators, pips, the anchored prompt and the
   *  coach's top slot stay below it). Runs on resize, on a new heart container and when the minimap setting changes */
  fitTop(force) {
    const lay = this.lay, u = this.u, w = this.vw, hs = settings.get('hudScale') || 1;
    const S = G.game && G.game.S, n = Math.max(3, Math.round((S && S.maxHp ? S.maxHp : 6) / 2));
    const f = topFit(lay, w, u, n, this.miniMode !== 'off', hs, lay === 'desk' ? this.counters.offsetWidth || 160 * u : 0);
    const cols = Math.min(n, f.cols), key = cols + '|' + f.cw.toFixed(1) + '|' + f.bw.toFixed(1) + '|' + f.ch.toFixed(1);
    if (!force && key === this.fitKey) return;
    this.fitKey = key; this.fit = f;
    this.hearts.style.setProperty('--hcols', String(cols));       // the grid is only as wide as its hearts
    this.bossbar.style.width = f.bw ? Math.round(f.bw) + 'px' : '';
    this.compass.size(f.cw, f.ch);
    this.measureSafe();
  }
  /** safeTop: the bottom of the compass + objective line (or boss bar) + 6 px; safeBottom: the key chips' band (a layout
   *  read, only from fitTop) */
  measureSafe() {
    let top = 0;
    try { for (const e of [this.compassEl, this.objEl, this.bossbar]) { const r = e.getBoundingClientRect(); if (r.height > 1) top = Math.max(top, r.bottom); } } catch (e) { /* ignore */ }
    this.safeTop = Math.round((top || 90 * this.u) + 6);
    this.safeBottom = this.lay === 'desk' ? Math.round(56 * this.u) : 24;
  }
  applySettings() {
    const s = (k) => settings.get(k);
    const X = this.crossEl;
    X.dataset.kind = s('crosshair'); X.dataset.size = s('crosshairSize'); X.dataset.col = s('crosshairColor');
    this.root.classList.toggle('calm', !!s('reduceMotion') || reduceQ());
    this.reduced = this.root.classList.contains('calm');
    this.miniMode = s('minimap');
    this.mini.classList.toggle('off', this.miniMode === 'off');
    if (this.fit) this.fitTop();
    this.applyVolumes();
  }
  onSetting(k) {
    if (k === 'hudScale') this.layout();
    this.applySettings();
    if (k === 'touchLeftHanded' && G.input && G.input.layoutTouch) G.input.layoutTouch();
  }
  /** volumes go to audio.js until an audio layer reads the settings itself: one that sets G.audio.ownsVolumes or has
   *  setVolumes (WP5's: it multiplies musicVol / sfxVol in; pushing them here too would square the curve) */
  applyVolumes() {
    const a = G.audio;
    if (!a || a.ownsVolumes || typeof a.setVolumes === 'function') return;
    try { if (typeof a.setMusicVolume === 'function') a.setMusicVolume(0.35 * settings.get('musicVol')); if (typeof a.setSfxVolume === 'function') a.setSfxVolume(0.7 * settings.get('sfxVol')); } catch (e) { /* audio never breaks the UI */ }
  }

  // ---------------------------------------------------------------- loading / title
  initLoading() {
    const L = this.loadingEl;
    const e = Assets.entry('ui', 'loading_bg');
    let coarse = false; try { coarse = matchMedia('(pointer: coarse)').matches; } catch (err) { /* ignore */ }
    const u = e ? (coarse && e.lo ? e.lo : e.src) : null;
    if (u) { const im = new Image(); im.onload = () => { $('.lbg', L).style.backgroundImage = `url("${u}")`; L.classList.add('art'); }; im.src = u; }
    let i = Math.floor(Math.random() * TIPS.length);
    const tip = () => { $('.tip', L).innerHTML = fmtKeys(TIPS[i++ % TIPS.length], { html: true }); };
    tip(); this.tipT = setInterval(tip, 4000);
  }
  setLoading(p, text) {
    $('.fill', this.loadingEl).style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
    if (text) $('.ls', this.loadingEl).textContent = text;
  }
  hideLoading() { this.loadingEl.classList.add('gone'); clearInterval(this.tipT); setTimeout(() => this.loadingEl.remove(), 600); }
  /** the title background: title_fp_v2, else title_fp, else title, else the drawn sky (each probed, a 404 falls through) */
  titleArt(cb) {
    const keys = ['title_fp_v2', 'title_fp', 'title'];
    const next = (i) => {
      if (i >= keys.length) return cb(null);
      const u = G.assets ? G.assets.url('ui', keys[i]) : null;
      if (!u) return next(i + 1);
      const pre = G.assets && G.assets.images[keys[i]];
      if (pre && pre.complete && pre.naturalWidth) return cb(u);
      const im = new Image(); im.onload = () => cb(u); im.onerror = () => next(i + 1); im.src = u;
    };
    next(0);
  }
  showTitle(hasSave, cb) {
    const t = this.titleEl;
    const bg = $('.bg', t);
    if (!this.titleArtDone) {
      this.titleArtDone = true;
      bg.style.backgroundImage = 'linear-gradient(#9fd8f0, #d8f0c0)';
      this.titleArt((u) => { if (u) { bg.style.backgroundImage = `url("${u}")`; t.classList.add('art'); } });
      t.addEventListener('mousemove', (e) => {
        if (this.reduced) return;
        const x = (e.clientX / this.vw - 0.5) * -2.4, y = (e.clientY / this.vh - 0.5) * -2.4;
        $('.bgw', t).style.transform = `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
      });
    }
    // boot: the loading card is still on top (fading out). The title comes in at full opacity under it, with no fade of its
    // own, so the two never stack half-transparent over the raw WebGL canvas; the loading card's fade is the transition
    if (this.loadingEl.isConnected) { t.style.transition = 'none'; t.classList.remove('gone'); void t.offsetHeight; t.style.transition = ''; }
    else t.classList.remove('gone');
    t.inert = false;
    this.titleCb = cb;
    const cont = t.querySelector('[data-a="continue"]');
    cont.style.display = hasSave ? '' : 'none';
    if (!this.titleList) this.titleList = new MenuList([...t.querySelectorAll('.menu button')], (i) => { this.titleList.sel = i; this.titleActivate(); });
    this.titleBtns = this.titleList.btns.filter((b) => b.style.display !== 'none');
    this.titleList.sel = hasSave ? this.titleList.btns.indexOf(cont) : 0;
    this.titleConfirm = false;
    this.hasSave = hasSave;
    $('.confirm', t).textContent = '';
    this.titleList.mark();
    this.titleOn = true;
    clearInterval(this.sparkTimer);
    this.sparkTimer = setInterval(() => {
      if (!this.titleOn || this.reduced) return;
      const s = el('div', 'sparkle', '✦', t);
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (40 + Math.random() * 60) + '%';
      s.style.animationDuration = (2 + Math.random() * 2.5) + 's';
      s.style.fontSize = (8 + Math.random() * 14) + 'px';
      setTimeout(() => s.remove(), 4600);
    }, 260);
  }
  get titleSel() { return this.titleList ? this.titleList.sel : 0; }
  set titleSel(v) { if (this.titleList) this.titleList.sel = v; }
  markTitle() { if (this.titleList) this.titleList.mark(); }
  titleActivate() {
    if (!this.titleOn) return;            // hidden title (#title.gone): its buttons never start a session again
    const b = this.titleList.btns[this.titleList.sel];
    const a = b.dataset.a;
    if (a === 'settings') { uiSfx('uiOpen'); this.openSettings(true); return; }
    if (a === 'new' && this.hasSave && !this.titleConfirm) {
      this.titleConfirm = true;
      $('.confirm', this.titleEl).textContent = 'This will replace your saved adventure. Press again to start fresh!';
      sfx('menu');
      return;
    }
    sfx('select');
    this.titleCb && this.titleCb(a);
  }
  titleInput(input) {
    if (!this.titleOn) return;
    if (this.menu === 'settings') { this.settingsCard.input(input, frameDt()); return; }
    const nav = input.menuNav();
    if (nav) { this.titleList.move(nav); this.titleConfirm = false; $('.confirm', this.titleEl).textContent = ''; }
    if (input.pressed('attack') || input.pressed('interact') || input.pressed('jump')) this.titleActivate();
  }
  hideTitle() {
    this.titleOn = false; this.titleEl.classList.add('gone'); this.titleEl.inert = true; clearInterval(this.sparkTimer);
    if (this.menu === 'settings') this.closeSettings(true);
  }

  // ---------------------------------------------------------------- HUD frame
  /** one HUD frame while playing (Game.render, after the camera and game.target): crosshair states, petals, chevrons,
   *  pips, reticle, prompt pill, hearts / counters, feed, floaters, compass + objective, minimap, vignette + low-HP
   *  beat, flash, boss bar, coach marks. Only transform / opacity / text writes, each on change. CPU time is recorded
   *  in ui.frameMs (G.debug.hud.state().cpu) */
  frame(g, dt) {
    const t0 = performance.now();
    const tg = g.target, cam = g.camera, v = g.view, S = g.S;
    try { this.fx.frame(g, dt); } catch (e) { this.err(e); }
    const busy = !!(this.dlg || this.menu || this.shop || g.cutscene || g.trans || v.shotW > 0.5);
    if (tg && !busy) this.setPrompt(_v.set(tg.x, tg.y + Math.min(tg.h, 1.6), tg.z), tg, cam, v.bodyOut ? 'world' : 'fp');
    else this.setPrompt(null);
    this.updateHud(S);
    this.feed.frame();
    this.updateFloaters(dt, cam);
    // way-finding: markers (rebuilt when something changed), compass every frame it changes, objective 4×/s
    const pl = g.player.root.position;
    if (this.markersDirty || (this.mkT = (this.mkT || 0) + dt) > 0.5) {
      this.markersDirty = false; this.mkT = 0;
      const o = objective(g.world, S, g.player.pos);
      if ((o && o.id) !== (this.obj && this.obj.id)) this.objT = 1;     // the line follows the compass at once
      this.obj = o;
      navMarkers(g.world, S, this.markers, o);
      let sig = ''; for (const m of this.markers) sig += m.id + (m.beaten ? '+' : '') + m.x + ',' + m.z + ';';
      if (sig !== this.mkSig) { this.mkSig = sig; this.markersVer = (this.markersVer || 0) + 1; }
    }
    const heading = (Math.atan2(Math.sin(v.yaw), -Math.cos(v.yaw)) * 180) / Math.PI;
    this.compass.draw(heading, pl, this.markers, this.obj);
    if ((this.objT = (this.objT || 0) + dt) > 0.25) { this.objT = 0; this.updateObjective(g); }
    if (this.miniMode !== 'off' && this.lay === 'desk') this.minimap.draw(pl, v.yaw, g.player.facing, (v.fovH * Math.PI) / 360, this.miniMode === 'heading', this.markers, this.obj, this.markersVer);
    // hurt flash + low-HP beat (one 0.9 s clock for the heart, the vignette and the heartbeat)
    const low = S.hp > 0 && S.hp <= 2, crit = S.hp > 0 && S.hp <= 1;
    const ph = this.beatPhase(), pulse = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 2;
    // motion comfort: a flash is capped (photosensitivity); the steady low-HP tint is no flash and stays as it is
    const flash = (a) => (this.reduced ? Math.min(a, TH.flashCap) : a);
    this.setVignette(Math.min(1, flash(g.redFlash * 0.9) + (low ? TH.lowBase + (this.reduced ? 0 : TH.lowPulse * (pulse * 2 - 1)) : 0)));
    if (this.lowOn !== low) { this.lowOn = low; this.vignette.classList.toggle('low', low); }
    if (this.critOn !== crit) { this.critOn = crit; if (G.renderer) G.renderer.domElement.classList.toggle('crit', crit); }
    if (low) { const b = (1 + (this.reduced ? 0 : 0.16 * pulse)).toFixed(3); if (b !== this.beatV) { this.beatV = b; this.hearts.style.setProperty('--beat', b); } }
    // half a heart left: a heartbeat on the same beat, just before the pulse peaks (silent until the audio layer has it).
    // An audio layer with its own heartbeat(k) (WP5's audio-bus drives it from hp) is the one source: no second beat here
    if (crit && !this.menu && !this.dlg && !(G.audio && typeof G.audio.heartbeat === 'function')) { const n = Math.floor(performance.now() / 1000 / TH.beat - 0.15); if (n !== this.beatN) { if (this.beatN != null) uiSfx('heartbeat'); this.beatN = n; } }
    else this.beatN = null;
    this.setFlash(flash(g.whiteFlash));
    if (g.fight && g.fight.phase === 'fight') this.bossBar(g.fight.boss);
    this.coach.frame(g, dt);
    this.notices.frame(g);
    this.keyHints.frame(g);
    this.updateDialogueLayout();
    const ms = performance.now() - t0;
    const fm = this.frameMs; if (fm.length < 240) fm.push(ms); else { fm[this.fmI = ((this.fmI || 0) + 1) % 240] = ms; }
  }
  err(e) { if ((this.errs = (this.errs || 0) + 1) <= 5 && G.debugOn) console.error('[Starseed] hud', e); }
  /** 0..1 phase of the shared low-HP beat (wall clock, so CSS, audio and the vignette agree) */
  beatPhase() { return (performance.now() / 1000 / TH.beat) % 1; }
  updateObjective(g) {
    const fight = !!(g.fight && g.fight.phase !== 'won');
    if (this.fightOn !== fight) { this.fightOn = fight; this.objEl.classList.toggle('infight', fight); }
    const o = this.obj, pl = g.player.pos;
    const txt = !o ? (g.S.ending ? 'The isle is blooming ✿' : '') : o.text + ' · ' + Math.round(Math.hypot(o.x - pl.x, o.z - pl.z)) + ' m';
    if (txt !== this.objShown) { this.objShown = txt; this.objText.textContent = txt; }
  }
  showHud(on) { this.hud.classList.toggle('off', !on); if (on) this.markersDirty = true; }
  updateHud(S, force) {
    const sh = this.shown;
    if (force || sh.hp !== S.hp || sh.maxHp !== S.maxHp) {
      const n = S.maxHp / 2;
      if (force || this.hearts.children.length !== n) {
        this.hearts.innerHTML = '';
        const cls = heartSprites() ? 'heart' : 'heart nosprite';
        for (let i = 0; i < n; i++) el('div', cls, `${heartSvg('e')}${heartSvg('f')}${heartImg('heart_empty', 'emp')}${heartImg('heart', 'full')}`, this.hearts);
        this.fitTop();                           // a new heart container may need the narrow-window fit
      }
      [...this.hearts.children].forEach((h, i) => {
        const v = S.hp - i * 2;
        h.classList.toggle('empty', v <= 0);
        h.classList.toggle('half', v === 1);
        h.classList.toggle('low', S.hp <= 2 && v > 0);
      });
      if (sh.hp !== -1 && S.hp > sh.hp) this.bumpHearts();
      if (sh.hp !== -1 && S.hp < sh.hp && this.hearts.animate) {
        this.hearts.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 180 });
        // i-frame shimmer: the hearts glow cream for 1 s after a hit (art §12.2)
        this.hearts.animate([{ filter: 'drop-shadow(0 3px 0 rgba(74,44,26,0.35)) drop-shadow(0 0 7px #fff6e2) brightness(1.2)' }, { filter: 'drop-shadow(0 3px 0 rgba(74,44,26,0.35)) drop-shadow(0 0 0 #fff6e2) brightness(1)' }], { duration: 1000, easing: 'ease-in' });
      }
      sh.hp = S.hp; sh.maxHp = S.maxHp;
    }
    if (force || sh.coins !== S.coins) {
      const c = $('.gems', this.counters);
      $('b', c).textContent = S.coins;
      const dg = String(S.coins).length;
      if (dg !== this.coinDigits) { this.coinDigits = dg; if (this.fit) this.fitTop(); }   // a wider counter may narrow the compass
      if (sh.coins !== -1 && c.animate) c.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,1.8,.6,1)' });
      sh.coins = S.coins;
    }
    if (force || sh.potions !== S.potions) {
      const c = $('.pots', this.counters);
      $('b', c).textContent = S.potions + '/' + CFG.potionMax;
      if (sh.potions !== -1 && c.animate) c.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.3,1.8,.6,1)' });
      sh.potions = S.potions;
    }
    const sd = S.seeds, sk = (sd.woods | 0) + (sd.peaks | 0) * 3 + (sd.shores | 0) * 9;
    if (force || sh.seeds !== sk) {
      for (const root of [this.seedsEl, $('.pseeds', this.pauseEl)]) {
        root.querySelectorAll('.seed-slot').forEach((s) => {
          const v = S.seeds[s.dataset.k];
          s.classList.toggle('got', v === 1);
          s.classList.toggle('placed', v === 2);
        });
      }
      if (sh.seeds !== -1 && sk !== sh.seeds) this.markersDirty = true;
      sh.seeds = sk;
    }
  }
  bumpHearts() { [...this.hearts.children].forEach((h, i) => { setTimeout(() => { if (h.animate) h.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'cubic-bezier(.3,1.8,.6,1)' }); }, i * 30); }); }

  // ---------------------------------------------------------------- minimap & map
  setMap(mapCanvas, W) {
    this.mapImg = mapCanvas;
    this.minimap.setMap(mapCanvas);
    this.W = W;
    // region label positions (centroids)
    const acc = REGIONS.map(() => ({ x: 0, z: 0, n: 0 }));
    for (let j = 0; j < N; j += 3) for (let i = 0; i < N; i += 3) {
      const k = j * N + i;
      if (W.H[k] < 0.5) continue;
      const a = acc[W.reg[k]]; a.x += i - HALF; a.z += j - HALF; a.n++;
    }
    this.regionLabels = acc.map((a, r) => ({ name: REGIONS[r].name, x: a.n ? a.x / a.n : 0, z: a.n ? a.z / a.n : 0 }));
    this.regionLabels[0].z += 14;
    this.markersDirty = true;
  }
  /** the minimap (kept for callers): heading-up per the setting; the wedge is the real horizontal FOV */
  drawMinimap(pl, facing, viewYaw, S, halfFov = 0.45) { this.markersVer = (this.markersVer || 0) + 1; this.minimap.draw(pl, viewYaw, facing, halfFov, this.miniMode !== 'north', navMarkers(this.W, S, this.markers, this.obj), this.obj, this.markersVer); }
  /** the parchment map card: north-up, markers, opened chests, Pip + view cone; click / tap or cursor + confirm places
   *  a waypoint (shown on the compass), on the waypoint removes it */
  openMap(pl, facing, S) {
    this.menu = 'map';
    this.showOverlay(this.mapEl, true);
    const g = G.game, v = G.view;
    this.obj = objective(this.W, S, pl);
    navMarkers(this.W, S, this.markers, this.obj);
    this.mapCard.open({ mapImg: this.mapImg, labels: this.regionLabels, W: this.W, S, pl: { x: pl.x, z: pl.z }, facing: g ? g.player.facing : facing, viewYaw: facing, halfFov: v ? (v.fovH * Math.PI) / 360 : 0.8, list: this.markers.slice(), obj: this.obj });
    const L = [['icon_tree', '✿', 'Great Tree'], ['icon_woods', '!', 'Guardian'], ['icon_shop', '$', 'Miso\'s shop'], ['icon_chest', '▣', 'Chest found'], ['icon_waypoint', '★', 'Your marker']];
    $('.legend', this.mapEl).innerHTML = L.map(([k, f, n]) => `<span>${iconHtml(k, f, 'lico')}${esc(n)}</span>`).join('');
    const dev = deviceKind();
    $('.mhint', this.mapEl).innerHTML = fmtKeys(dev === 'touch' ? 'Tap the map to drop a marker · tap it again to remove it' : dev === 'pad' ? '{move} move · {jump} drop a marker · {dash} close' : 'Click to drop a marker (click it again to remove) · {map} close', { html: true });
    uiSfx('uiOpen');
  }

  // ---------------------------------------------------------------- banner / toast / prompt / floaters
  /** region chapter card in the notification slot (never together with the boss card) */
  showBanner(title, sub) { return this.notices.showBanner(title, sub); }
  /** gameplay toasts are pickup-feed lines now (top-left), never over the dialogue, boss bar or thumbs */
  toast(msg) { return this.feed.push(msg, { kind: /^✿/.test(msg) ? 'note' : 'warn', key: 't:' + msg }); }
  /** EV.HINT / anyone: a hint in the coach slot (queued, one at a time; the same id not again within a minute) */
  hint(id, text, life) { return this.coach.pushHint(id, text, life); }
  /** world point → CSS px through the HUD projector (hud/projector.js; behind the eye: null, never NaN). The record is
   *  written into out (a fresh object by default), so results kept from earlier calls stay valid */
  project(pos, camera, out = {}) {
    if (G.view) { const s = project(pos, out); return s.behind ? null : s; }
    _p.copy(pos).project(camera);
    if (_p.z > 1) return null;
    out.x = (_p.x * 0.5 + 0.5) * window.innerWidth; out.y = (-_p.y * 0.5 + 0.5) * window.innerHeight;
    return out;
  }
  /** interaction prompt `[key] Verb · Name` (the key follows the last input device; touch shows the hand). First person:
   *  the pill under the crosshair. Third person (mode 'world', arch §10): it sits on the target marker above the
   *  target's head (feedback.js projects it), above the crosshair when the target is off screen, and never on Pip (his
   *  projected box: above his hood, else beside him). pos / camera are kept for callers; label: a string or the target
   *  ({ verb, name, label }) */
  setPrompt(pos, label, camera, mode = 'world') {
    const P = this.promptEl;
    if (!label) { if (!this.promptHidden) { this.promptHidden = true; P.classList.add('hidden'); this.root.classList.remove('prompting'); } return; }
    if (this.promptHidden !== false) { this.promptHidden = false; P.classList.remove('hidden'); this.root.classList.add('prompting'); }
    const dev = deviceKind();
    const str = typeof label === 'string', verb = str ? label : label.verb || label.label || '', name = str ? '' : label.verb ? label.name || '' : '';
    const anch = mode !== 'fp';
    if (this.pDev !== dev || this.pVerb !== verb || this.pName !== name || this.pAnch !== anch || this.promptKey !== 'set') {
      this.pDev = dev; this.pVerb = verb; this.pName = name; this.pAnch = anch; this.promptKey = 'set';
      $('.pk', P).innerHTML = fmtKeys('{interact}', { html: true });
      $('.pv', P).textContent = fmtKeys(verb);
      $('.pn', P).textContent = name ? fmtKeys(name) : '';
      P.classList.toggle('noname', !name);
      P.classList.toggle('fp', !anch);
      P.classList.toggle('anch', anch);
      if (!anch) P.style.transform = '';
      this.pX = this.pY = null;
      if (anch) { this.promptW = P.offsetWidth; this.promptH = P.offsetHeight; }   // one layout read per new label
      // the pop: FP rises 4 px and grows about its centre; anchored (TP) it only fades in (its translate places it)
      if (P.animate) P.animate(anch ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, translate: '0 4px', scale: '0.92' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 120, easing: 'ease-out' });
    }
    if (anch) this.placePrompt();
  }
  /** TP: the pill's bottom-centre on the target marker (or above the crosshair), moved off Pip's box, inside the free area */
  placePrompt() {
    const fx = this.fx, tm = fx.tm, W = this.vw, H = this.vh, u = this.u, pw = this.promptW || 120, ph = this.promptH || 30, gap = 8 * u;
    let x = tm.on ? tm.x : W / 2, y = tm.on ? tm.y - 16 * u : H / 2 - 26 * u;
    const B = fx.pipBox;
    if (B && x + pw / 2 > B.l - gap && x - pw / 2 < B.r + gap && y > B.t - gap && y - ph < B.b + gap) {
      if (B.t - gap - ph >= this.safeTop) y = B.t - gap;
      else x = (B.l + B.r) / 2 < W / 2 ? B.r + gap + pw / 2 : B.l - gap - pw / 2;
    }
    const xq = Math.round(clamp(x, pw / 2 + 8, W - pw / 2 - 8)), yq = Math.round(clamp(y, this.safeTop + ph, H - 8));
    if (xq !== this.pX || yq !== this.pY) { this.pX = xq; this.pY = yq; this.promptEl.style.transform = 'translate(' + xq + 'px,' + yq + 'px)'; }
  }
  /** a gain about Pip himself ('Refreshed!', '+5 gems'): a pickup-feed line in both views (gems come from EV.COLLECT) */
  selfFloater(text, color = '#fff6e2') {
    const t = String(text);
    if (/^\+\d+ gems?!?$/.test(t)) return null;       // gem gains: the feed counts the real pickups (EV.COLLECT)
    if (/^Refreshed!?$/.test(t)) return this.feed.push('Refreshed! ♥ full', { kind: 'gain', icon: 'potion' });
    const l = this.feed.push(t, { kind: 'gain', key: 's:' + t });
    if (l && color) l.e.style.setProperty('--fc', color);
    return l;
  }
  /** EV.COLLECT → the feed (gems merge into one counting line) */
  collected(p) {
    if (!p) return;
    if (p.kind === 'gem') this.feed.push('', { key: 'gems', n: p.value || 1, fmt: (n) => '+' + n + (n === 1 ? ' gem' : ' gems'), icon: 'coin' });
    else if (p.kind === 'heart') this.feed.push('+1 heart', { key: 'hearts', n: 1, fmt: (n) => '♥ +' + n, icon: 'heart' });
  }
  /** world floaters ('Clink!', TP chest gems): only for points ≥ 1.5 m in front of the eye */
  floater(pos, text, color = '#fff6e2', size = 20) {
    const cp = G.camera && G.camera.position;
    if (cp && pos.distanceTo && pos.distanceTo(cp) < 1.5) return;
    const e = el('div', 'floater', esc(fmtKeys(text)), this.floatRoot);
    e.style.color = color;
    e.style.left = e.style.top = '-9999px'; e.style.visibility = 'hidden'; // until the first projection
    e.style.fontSize = size + 'px';
    this.floaters.push({ e, pos: pos.clone(), t: 0 });
    if (this.floaters.length > 16) { const f = this.floaters.shift(); f.e.remove(); }
  }
  updateFloaters(dt, camera) {
    const F = this.floaters;
    let j = 0;
    for (let i = 0; i < F.length; i++) {          // in place: no new array per frame
      const f = F[i];
      f.t += dt;
      if (f.t > 1.0) { f.e.remove(); continue; }
      F[j++] = f;
      _v2.copy(f.pos); _v2.y += f.t * 1.2;
      // behind the eye or off the screen: hidden (never NaN, never pinned to an edge)
      const s = this.project(_v2, camera, _scr);
      const on = !!s && s.onScreen !== false && isFinite(s.x) && isFinite(s.y);
      f.e.style.visibility = on ? '' : 'hidden';
      if (!on) continue;
      f.e.style.left = s.x + 'px';
      f.e.style.top = s.y + 'px';
      f.e.style.opacity = f.t < 0.7 ? 1 : 1 - (f.t - 0.7) / 0.3;
      f.e.style.transform = `translate(-50%,-50%) scale(${f.t < 0.12 ? 0.6 + f.t * 4 : 1})`;
    }
    F.length = j;
  }

  // ---------------------------------------------------------------- dialogue
  say(lines, o = {}) {
    this.dlg = { lines: lines.slice(), i: 0, chars: 0, t: 0, blip: 0, onDone: o.onDone || null, name: o.name || null, portrait: o.portrait || null, shown: -1, parts: null, dev: '' };
    const P = $('.portrait', this.dlgEl);
    const u = o.portrait ? spriteUrl(o.portrait) : null;
    P.innerHTML = u ? `<img src="${u}" alt="" onerror="this.parentNode.parentNode.classList.add('noportrait')">` : '';
    this.dlgEl.classList.toggle('noportrait', !u);
    // an NPC speaking in first person: the real face is framed in view, the portrait hides (C14) — r4: unless the speaker
    // stands more than TUNE.hud.dlgFar m from the eye (Elder Shellby's opening, 7.6 m off: a 60 px face)
    this.dlg.npc = !!(o.portrait && /^npc_/.test(o.portrait));
    this.dlg.who = this.dlg.npc && G.game && G.game.npcs ? G.game.npcs.find((n) => n.key === o.portrait) || null : null;
    const nm = $('.name', this.dlgEl);
    nm.textContent = o.name ? fmtKeys(o.name) : '';
    nm.style.display = o.name ? '' : 'none';
    nm.style.background = NAME_COL[o.portrait] || '';
    $('.text', this.dlgEl).textContent = '';
    this.dlgFp = null;
    this.updateDialogueLayout();
    this.dlgEl.classList.add('show');
    this.dlgClick = false;
  }
  get dialogueOpen() { return !!this.dlg; }
  updateDialogueLayout() {
    const d = this.dlg;
    if (!d) return;
    const v = G.view, w = d.who, far = !!(w && v && Math.hypot(w.pos.x - v.eye.x, w.pos.z - v.eye.z) > TH.dlgFar);
    const fp = !!(d.npc && v && v.blend < 0.5 && v.shotW < 0.5 && !far);
    if (this.dlgFp !== fp) { this.dlgFp = fp; this.dlgEl.classList.toggle('fpnpc', fp); }
  }
  updateDialogue(dt, input) {
    const d = this.dlg;
    if (!d) return;
    const dev = deviceKind();
    if (!d.parts || d.dev !== dev) { d.parts = keyParts(d.lines[d.i] || '', dev); d.dev = dev; d.len = d.parts.reduce((a, p) => a + (p.html ? 1 : p.s.length), 0); d.shown = -1; }
    const len = d.len;
    const adv = input.confirm() || this.dlgClick;
    this.dlgClick = false;
    if (d.chars < len) {
      d.chars = Math.min(len, d.chars + dt * (settings.get('textSpeed') || 52));
      d.blip += dt;
      if (d.blip > 0.075) { d.blip = 0; sfx('talk'); }
      if (adv && d.t > 0.12) d.chars = len;
    } else if (adv) {
      d.i++;
      d.chars = 0; d.parts = null;
      if (d.i >= d.lines.length) {
        this.dlg = null;
        this.dlgEl.classList.remove('show');
        sfx('select');
        if (d.onDone) d.onDone();
        return;
      }
      sfx('menu');
      d.parts = keyParts(d.lines[d.i] || '', dev); d.dev = dev; d.len = d.parts.reduce((a, p) => a + (p.html ? 1 : p.s.length), 0); d.shown = -1;
    }
    d.t += dt;
    if (d.logged !== d.i) { d.logged = d.i; this.logLine(d, d.lines[d.i]); }
    const n = Math.floor(d.chars);
    if (n !== d.shown) {
      d.shown = n;
      let left = n, html = '';
      for (const p of d.parts) {
        if (left <= 0) break;
        if (p.html) { html += p.html; left--; } else { html += esc(p.s.slice(0, left)); left -= p.s.length; }
      }
      $('.text', this.dlgEl).innerHTML = html;
      const idle = d.chars >= d.len;
      this.dlgEl.classList.toggle('idle', idle);
    }
  }

  // ---------------------------------------------------------------- shop
  openShop(S, onBuy, onClose) {
    this.shop = { S, onBuy, onClose, sel: 0, msg: 'What catches your eye?', mx: this.ptrX, my: this.ptrY };
    this.renderShop();
    this.showOverlay(this.shopWrap, true);
    uiSfx('uiOpen');
  }
  shopState(item, S) {
    if (item.id === 'potion') return S.potions >= CFG.potionMax ? 'full' : 'ok';
    if (item.id === 'heart') return S.shopHeart ? 'sold' : 'ok';
    if (item.id === 'sword') return S.swordLevel >= 2 ? 'sold' : 'ok';
    return 'ok';
  }
  renderShop() {
    const sh = this.shop;
    if (!sh) return;
    const S = sh.S, dev = deviceKind();
    const hint = dev === 'touch' ? 'Tap an item to buy it' : dev === 'pad' ? '↑↓ choose · {jump} buy · {dash} leave' : '↑↓ choose · {interact} or click to buy · {pause} leave';
    this.shopEl.innerHTML = `<div class="shead"><h2>${img('npc_cat')}<span>Miso's Shop</span></h2><div class="counter wallet">${cimg('coin', gemFb)}<b>${S.coins}</b></div></div>
      <div class="items">${SHOP.map((it, i) => {
        const st = this.shopState(it, S);
        const pr = st === 'sold' ? 'SOLD OUT' : st === 'full' ? 'FULL' : `${cimg('coin', gemFb)}${it.price}`;
        return `<div class="shop-item ${i === sh.sel ? 'sel' : ''} ${st !== 'ok' ? 'out' : ''} ${st === 'ok' && S.coins < it.price ? 'poor' : ''}" data-i="${i}">${img(it.icon)}<div class="info"><div class="nm">${esc(it.name)}</div><div class="ds">${esc(it.desc)}</div></div><div class="pr">${pr}</div></div>`;
      }).join('')}</div><div class="sfoot"><div class="msg">${esc(fmtKeys(sh.msg))}</div><div class="hint">${fmtKeys(hint, { html: true })}</div>
      <button class="btn sm" data-leave>Bye, Miso!</button></div>`;
    this.shopEl.querySelectorAll('.shop-item').forEach((e) => {
      e.addEventListener('click', () => { sh.sel = +e.dataset.i; this.buySelected(); });
      // hover selects only when the pointer really moved: re-rendered rows appearing under a resting cursor (arrow keys,
      // purchases) get synthetic hover events, which used to snap the keyboard selection back to that row
      e.addEventListener('mousemove', (ev) => {
        if (ev.clientX === sh.mx && ev.clientY === sh.my) return;
        sh.mx = ev.clientX; sh.my = ev.clientY;
        if (sh.sel !== +e.dataset.i) { sh.sel = +e.dataset.i; this.renderShop(); }
      });
    });
    $('[data-leave]', this.shopEl).addEventListener('click', () => this.closeShop());
  }
  buySelected() {
    const sh = this.shop;
    if (!sh) return;
    const it = SHOP[sh.sel];
    const st = this.shopState(it, sh.S);
    if (st === 'sold') { sh.msg = 'Sold out! Only one of those, sorry~'; sfx('error'); }
    else if (st === 'full') { sh.msg = 'Your pockets are full of potions already!'; sfx('error'); }
    else if (sh.S.coins < it.price) { sh.msg = 'Not enough gems, little sprout. Mrrow...'; sfx('error'); }
    else { sh.msg = sh.onBuy(it); sfx('buy'); }
    this.renderShop();
  }
  updateShop(input) {
    const sh = this.shop;
    if (!sh) return;
    const nav = input.menuNav();
    if (nav) { sh.sel = (sh.sel + nav + SHOP.length) % SHOP.length; uiSfx('uiMove'); this.renderShop(); }
    if (input.pressed('attack') || input.pressed('interact') || input.pressed('jump')) this.buySelected(); // keys/pad; canvas clicks never reach here
    else if (input.cancel()) this.closeShop();
  }
  closeShop() {
    if (!this.shop) return;
    const cb = this.shop.onClose;
    this.shop = null;
    this.showOverlay(this.shopWrap, false);
    uiSfx('uiClose');
    cb && cb();
  }

  // ---------------------------------------------------------------- pause / settings / controls / map / ending
  /** sub: optional subtitle; given when the pointer lock was lost (then the pause key is ignored for 200 ms so a
   *  delivered Esc cannot close the pause it caused) */
  openPause(sub) {
    this.menu = 'pause';
    this.pauseList.sel = 0;
    $('.sub', this.pauseEl).textContent = sub || '';
    const ps = $('.pseeds', this.pauseEl);
    if (!ps.children.length) { ps.innerHTML = this.seedsEl.innerHTML; }
    if (G.game && G.game.S) this.updateHud(G.game.S, true);
    this.pauseGuardUntil = sub ? performance.now() + 200 : 0;
    this.syncPause();
    this.showOverlay(this.pauseEl, true);
    uiSfx('uiOpen');
  }
  /** the pointer lock was lost in play (Esc, alt-tab, browser UI): pause with the way back (Game calls it) */
  openLockPause() { this.openPause('click Resume to keep playing'); }
  get pauseSel() { return this.pauseList.sel; }
  set pauseSel(v) { this.pauseList.sel = v; }
  syncPause() { this.pauseList.mark(); }
  /** 0 Resume · 1 Settings · 2 Controls · 3 Map · 4 Chat log · 5 Save & Quit */
  onPauseChoice(i) {
    this.pauseList.sel = i;
    if (i === 0) { this.closeMenu(); return; }
    if (i === 1) { this.showOverlay(this.pauseEl, false); this.openSettings(false); return; }
    if (i === 2) { this.showOverlay(this.pauseEl, false); this.openControls(true); return; }
    if (i === 3) { this.showOverlay(this.pauseEl, false); const g = G.game; this.mapFromPause = true; this.openMap(g.player.pos, g.view.yaw, g.S); return; }
    if (i === 4) { this.showOverlay(this.pauseEl, false); this.openLog(); return; }
    if (i === 5) { this.closeMenu(true); this.onSaveQuit && this.onSaveQuit(); }
  }
  openSettings(fromTitle) {
    this.settingsFrom = fromTitle ? 'title' : 'pause';
    this.menu = 'settings';
    this.settingsEl.classList.toggle('over', !!fromTitle);
    this.settingsCard.show(fromTitle);
    $('.fkeys', this.settingsEl).innerHTML = this.footKeys();
    this.showOverlay(this.settingsEl, true);
    this.settingsCard.cue();                  // measured once the card is displayed (rows below the fold → the cue)
    uiSfx('uiOpen');
  }
  closeSettings(silent) {
    this.settingsCard.hide();
    this.showOverlay(this.settingsEl, false);
    if (!silent) uiSfx('uiBack');
    settings.flush && settings.flush();
    if (this.settingsFrom === 'title') { this.menu = null; return; }
    this.menu = 'pause'; this.showOverlay(this.pauseEl, true); this.syncPause();
  }
  footKeys() {
    const d = deviceKind();
    return fmtKeys(d === 'touch' ? '' : d === 'pad' ? '↑↓ choose · ◂▸ change · {potion} {view} tabs · {dash} back' : '↑↓ choose · ←→ change · {pause} back', { html: true });
  }
  /** fromPause: the controls reference card. The first-run call (fromPause false) starts the in-play coach marks instead
   *  of a modal card (the pointer stays locked); onControlsClosed fires when the three steps are done */
  openControls(fromPause) {
    if (!fromPause) { this.coach.start(() => this.onControlsClosed && this.onControlsClosed()); return; }
    this.menu = 'controls';
    this.controlsFromPause = !!fromPause;
    this.controlsCard.show();
    $('.fkeys', this.controlsEl).innerHTML = fmtKeys(deviceKind() === 'touch' ? '' : '◂▸ device · {pause} back', { html: true });
    this.showOverlay(this.controlsEl, true);
    this.controlsT = performance.now();
    uiSfx('uiOpen');
  }
  closeControls() {
    if (this.menu !== 'controls') { if (this.coach.active) { this.coach.stop(); this.onControlsClosed && this.onControlsClosed(); } return; }
    this.showOverlay(this.controlsEl, false);
    sfx('select');
    if (this.controlsFromPause) { this.menu = 'pause'; this.showOverlay(this.pauseEl, true); this.syncPause(); }
    else { this.menu = null; this.onControlsClosed && this.onControlsClosed(); }
  }
  /** a line as it is first shown (raw: its key tokens are formatted when the log opens, for the device in use then) */
  logLine(d, text) {
    if (!text) return;
    this.chatLog.push({ name: d.name || '', col: NAME_COL[d.portrait] || '', text: String(text) });
    if (this.chatLog.length > TH.logMax) this.chatLog.shift();
  }
  openLog() {
    this.menu = 'log';
    const L = this.chatLog, body = $('.lbody', this.logEl);
    body.innerHTML = L.length ? L.map((l) => `<div class="lline">${l.name ? `<b class="lname"${l.col ? ` style="background:${l.col}"` : ''}>${esc(fmtKeys(l.name))}</b>` : ''}<span>${fmtKeys(l.text, { html: true })}</span></div>`).join('')
      : '<div class="lempty small">Nobody has said anything yet. Go say hi!</div>';
    const d = deviceKind();
    $('.fkeys', this.logEl).innerHTML = fmtKeys(d === 'touch' ? '' : d === 'pad' ? '↑↓ scroll · {dash} back' : '↑↓ scroll · {pause} back', { html: true });
    this.showOverlay(this.logEl, true);
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    uiSfx('uiOpen');
  }
  openEnding() {
    this.menu = 'ending';
    const a = $('.eart', this.endingEl), u = G.assets ? G.assets.url('ui', 'ending_art') : null;
    if (u && !a.dataset.u) { a.dataset.u = u; const im = new Image(); im.onload = () => { a.style.backgroundImage = `url("${u}")`; this.endingEl.classList.add('art'); }; im.src = u; }
    $('.ex', this.endingEl).textContent = deviceKind() === 'touch' ? 'The isle is yours to explore. Tap to continue.' : 'The isle is yours to explore. Press any button to continue.';
    this.showOverlay(this.endingEl, true); this.endingT = performance.now();
  }
  closeEnding() {
    if (performance.now() - (this.endingT || 0) < 1500) return;
    this.menu = null; this.showOverlay(this.endingEl, false); sfx('select');
    this.onEndingClosed && this.onEndingClosed();
  }
  /** close whatever cursor menu is open (back to play; Resume, map close, tests) */
  closeMenu(silent) {
    const m = this.menu;
    this.menu = null;
    for (const o of [this.pauseEl, this.mapEl, this.settingsEl, this.controlsEl, this.logEl]) if (o.classList.contains('show') || !o.classList.contains('hidden')) this.showOverlay(o, false);
    if (m === 'settings') this.settingsCard.hide();
    if (m === 'log' && !silent) { this.menu = 'pause'; this.showOverlay(this.pauseEl, true); this.syncPause(); uiSfx('uiBack'); return; }
    if (m === 'map' && this.mapFromPause && !silent) { this.mapFromPause = false; this.menu = 'pause'; this.showOverlay(this.pauseEl, true); this.syncPause(); uiSfx('uiBack'); return; }
    this.mapFromPause = false;
    if (!silent) uiSfx('uiClose');
  }
  menuInput(input) {
    const m = this.menu, dt = frameDt();          // the real frame time: slider repeat and the map cursor run at any refresh rate
    if (m === 'pause') {
      const nav = input.menuNav();
      if (nav) this.pauseList.move(nav);
      if (input.pressed('attack') || input.pressed('interact') || input.pressed('jump')) this.pauseList.pick();
      else if ((input.pressed('pause') || input.pressed('dash')) && performance.now() >= (this.pauseGuardUntil || 0)) this.closeMenu();
    } else if (m === 'settings') {
      this.settingsCard.input(input, dt);
    } else if (m === 'controls') {
      if (performance.now() - this.controlsT > 200) this.controlsCard.input(input, dt);
    } else if (m === 'map') {
      if (input.pressed('map') || input.pressed('pause') || input.pressed('dash')) { this.closeMenu(); return; }
      const a = input.axis();
      if (a.l > 0.05) this.mapCard.nudge(a.x, a.y, dt);
      if (input.pressed('interact') || input.pressed('jump') || (input.pressed('attack') && input.lastDevice !== 'mouse')) this.mapCard.confirm();
    } else if (m === 'log') {
      if (input.cancel() || input.pressed('interact') || input.pressed('jump') || input.pressed('pause')) { this.closeMenu(); return; }
      const nav = input.menuNav(); if (nav) $('.lbody', this.logEl).scrollTop += nav * 70;
    } else if (m === 'ending') {
      if (input.anyPressed) this.closeEnding();
    }
  }

  // ---------------------------------------------------------------- boss
  /** boss lower-third card (fight.js: on at the intro, off at the fight) */
  showBossCard(name, title, on, delay) { this.notices.bossCard(name, title, on, delay); }
  bossBar(boss) {
    if (!boss) { if (this.bossShown !== null) { this.bossbar.classList.add('hidden'); this.bossShown = null; } return; }
    if (this.bossShown !== boss) {
      this.bossShown = boss;
      this.bossbar.classList.remove('hidden');
      $('.bn', this.bossbar).textContent = (boss.def && boss.def.name) || boss.name || '';
      this.bossK = -1; this.bossFillIn = performance.now();
      this.markersDirty = true;
    }
    // the bar fills 0 → 100 % over 0.6 s as the fight starts, then follows hp
    const k = clamp(boss.hp / (boss.maxHp || 1), 0, 1) * Math.min(1, (performance.now() - this.bossFillIn) / 600);
    const kk = Math.round(k * 1000) / 1000;
    if (kk !== this.bossK) {
      this.bossK = kk;
      $('.fill', this.bossbar).style.transform = `scaleX(${kk})`;
      $('.lag', this.bossbar).style.transform = `scaleX(${kk})`;
    }
    // "Now!": WP5's free-hit window (boss.opening: stunned, or recovering after a big attack), as the world's gold pulse
    const en = !!boss.enraged, now = !!boss.opening || boss.state === 'stunned';
    if (this.bossEn !== en) { this.bossEn = en; this.bossbar.classList.toggle('enraged', en); }
    if (this.bossNow !== now) { this.bossNow = now; this.bossbar.classList.toggle('vuln', now); }
  }

  // ---------------------------------------------------------------- overlays
  setVignette(a) { const q = a <= 0.004 ? 0 : Math.round(a * 1000) / 1000; if (this.vigA !== q) { this.vigA = q; this.vignette.style.opacity = String(q); } }
  setFlash(a) { const q = a <= 0.004 ? 0 : Math.round(a * 1000) / 1000; if (this.flA !== q) { this.flA = q; this.flashEl.style.opacity = String(q); } }
  setFade(a) { this.fadeEl.style.opacity = a; this.fadeEl.style.pointerEvents = a > 0.5 ? 'auto' : 'none'; }
  setDizzy(on) { this.dizzyEl.classList.toggle('show', on); }
  /** "Click to play" (a tap on touch screens): the pointer lock is wanted but missing; a press on it asks again */
  setVeil(on) {
    if (this.veilOn === on) return;
    this.veilOn = on; this.veilEl.classList.toggle('hidden', !on);
    const touch = deviceKind() === 'touch';
    if (on && this.veilDev !== touch) { this.veilDev = touch; $('.chip', this.veilEl).innerHTML = `${iconHtml(touch ? 'pic_phone' : 'pic_mouse', '', 'vico')}<span class="vt">${touch ? 'Tap to play' : 'Click to play'}</span>`; }
  }
  setCrosshair(on) { if (this.crossOn !== on) { this.crossOn = on; this.crossEl.classList.toggle('hidden', !on); } }
  setDebug(text) {
    if (text == null) { this.debugEl.classList.add('hidden'); return; }
    this.debugEl.classList.remove('hidden');
    this.debugEl.textContent = text;
  }
}
export { isMuted, toggleMute, iconUrl, hudMem };
