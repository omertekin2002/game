// HTML/CSS overlay UI: HUD, minimap & full map, banner, prompts, floaters, dialogue, shop, boss bar/card,
// pause/controls/ending cards, title + loading screens, overlays, toasts, debug text.
import * as THREE from 'three';
import { G, sfx, spriteUrl, isMuted, toggleMute } from './core.js';
import { SEED_ORDER, SEEDS, SHOP, REGIONS, CFG } from './data.js';
import { HALF, SIZE, N } from './world.js';
import { TAU, clamp } from './util.js';
import { RANGES, stepSetting } from './settings.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
const img = (key, cls = '') => { const u = spriteUrl(key); return u ? `<img class="${cls}" src="${u}" alt="" draggable="false">` : ''; };
const _v = new THREE.Vector3();
// Settings overlay rows (keys of js/settings.js), then the Reset and Back buttons.
const SETTING_ROWS = [
  ['musicVolume', 'Music volume'], ['sfxVolume', 'SFX volume'], ['camSensitivity', 'Camera sensitivity'],
  ['invertCamX', 'Invert camera ↔'], ['invertCamY', 'Invert camera ↕'], ['reducedMotion', 'Reduced motion'],
];
const SETTINGS_N = SETTING_ROWS.length + 2;
const fmtSetting = (k, v) => (k === 'camSensitivity' ? `${v}×` : k in RANGES ? `${Math.round(v * 100)}%` : v ? 'On' : 'Off');

export class UI {
  constructor(root) {
    this.root = root;
    this.floaters = [];
    this.dlg = null;
    this.shop = null;
    this.menu = null; // 'pause' | 'controls' | 'settings' | 'map' | 'ending' | null
    this.shown = { hp: -1, maxHp: -1, coins: -1, potions: -1, seeds: '' };
    this.build();
  }
  build() {
    const R = this.root;
    this.hud = el('div', 'off', null, R); this.hud.id = 'hud';
    this.hearts = el('div', '', null, this.hud); this.hearts.id = 'hearts';
    this.counters = el('div', '', `<div class="counter gems">${img('coin')}<b>0</b></div><div class="counter pots">${img('potion')}<b>0</b></div>`, this.hud); this.counters.id = 'counters';
    this.seedsEl = el('div', '', SEED_ORDER.map((k) => `<div class="seed-slot" data-k="${k}">${img(SEEDS[k].key)}</div>`).join(''), this.hud); this.seedsEl.id = 'seeds';
    this.mini = el('div', '', '<canvas></canvas><div class="n">N</div>', this.hud); this.mini.id = 'minimap';
    this.miniCanvas = $('canvas', this.mini);
    this.banner = el('div', 'panel', '<div class="t"></div><div class="s"></div>', R); this.banner.id = 'banner';
    this.promptEl = el('div', 'prompt hidden', '!<div class="lbl"></div>', R);
    this.floatRoot = el('div', '', null, R);
    this.toastEl = el('div', 'panel', '', R); this.toastEl.id = 'toast';
    // boss
    this.bossbar = el('div', 'hidden', '<div class="bn"></div><div class="track"><div class="lag"></div><div class="fill"></div></div>', R); this.bossbar.id = 'bossbar';
    this.bosscard = el('div', '', '<div class="bt"></div><div class="bs"></div>', R); this.bosscard.id = 'bosscard';
    // overlays
    this.vignette = el('div', '', null, R); this.vignette.id = 'vignette';
    this.dizzyEl = el('div', '', 'Pip got dizzy!', R); this.dizzyEl.id = 'dizzy';
    this.flashEl = el('div', '', null, R); this.flashEl.id = 'flash';
    // dialogue
    this.dlgEl = el('div', 'panel interactive', '<div class="portrait"></div><div class="body"><div class="name"></div><div class="text"></div><div class="arrow">▼</div></div>', R); this.dlgEl.id = 'dialogue';
    this.dlgEl.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dlgClick = true; });
    // shop
    this.shopEl = el('div', 'panel interactive', '', R); this.shopEl.id = 'shop';
    // overlay cards
    this.pauseEl = this.overlay('pause', `<div class="card panel"><h2>Paused</h2><div class="menu">
      <button class="btn" data-a="resume">Resume</button><button class="btn" data-a="controls">Controls</button>
      <button class="btn" data-a="settings">Settings</button><button class="btn" data-a="sound">Sound: On</button>
      <button class="btn" data-a="quit">Save &amp; Quit</button></div></div>`);
    this.settingsEl = this.overlay('settings', `<div class="card panel"><h2>Settings</h2><div class="settings-rows">${SETTING_ROWS.map(([k, label], i) =>
      `<div class="srow" data-r="${i}"><div class="sl">${label}</div><div class="sv">${k in RANGES
        ? `<button class="sb" data-r="${i}" data-d="-1" aria-label="${label} down">−</button><span class="val"></span><button class="sb" data-r="${i}" data-d="1" aria-label="${label} up">+</button>`
        : `<button class="sb tog" data-r="${i}" data-d="1"><span class="val"></span></button>`}</div></div>`).join('')}</div>
      <div class="menu"><button class="btn" data-r="${SETTING_ROWS.length}">Reset to defaults</button><button class="btn" data-r="${SETTING_ROWS.length + 1}">Back</button></div>
      <div class="small">↑↓ choose · ←→ change · Esc back</div></div>`);
    this.controlsEl = this.overlay('controls', `<div class="card panel"><h2>How to play</h2>
      <div class="controls-grid">
        <div class="k">Move</div><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows / left stick</div>
        <div class="k">Sword</div><div><kbd>J</kbd> / <kbd>Space</kbd> / click / Ⓐ</div>
        <div class="k">Dash-roll</div><div><kbd>K</kbd> / <kbd>Shift</kbd> / Ⓑ</div>
        <div class="k">Talk / open</div><div><kbd>F</kbd> / <kbd>Enter</kbd> / Ⓧ (or sword at a "!")</div>
        <div class="k">Potion</div><div><kbd>R</kbd> / Ⓨ</div>
        <div class="k">Camera</div><div><kbd>Q</kbd> <kbd>E</kbd> / right-drag / right stick · wheel to zoom</div>
        <div class="k">Map · Pause</div><div><kbd>M</kbd> / <kbd>Tab</kbd> · <kbd>Esc</kbd> / <kbd>P</kbd></div>
      </div>
      <div class="small">Find the three Starseeds and bring them to the Great Tree's pedestal.</div>
      <div style="margin-top:12px"><button class="btn sel" data-close>Let's go!</button></div></div>`);
    this.mapEl = this.overlay('mapview', '<div class="card panel"><canvas></canvas><div class="small" style="margin-top:6px">Press M / Tab to close</div></div>');
    this.endingEl = this.overlay('ending', `<div class="card panel"><div class="et">✿ Starseed Isle is blooming again! ✿</div><div class="es">— Thanks for playing —</div>
      <div class="ex">The isle is yours to explore. Press any button to continue.</div></div>`);
    this.fadeEl = el('div', '', null, R); this.fadeEl.id = 'fade';
    // title + loading
    this.titleEl = el('div', 'gone', `<div class="bg"></div><div class="shade"></div>
      <div class="logo"><div class="l1">Starseed <span class="s">Isle</span></div><div class="l2">a cozy little adventure</div></div>
      <div class="menu"><button class="btn" data-a="new">New Adventure</button><button class="btn" data-a="continue">Continue</button><div class="confirm"></div></div>
      <div class="foot">WASD + J · or a gamepad</div>`, R);
    this.titleEl.id = 'title';
    this.loadingEl = el('div', '', '<div><div class="sprout">🌱</div><div class="lt">Starseed Isle</div><div class="bar"><div class="fill"></div></div><div class="ls">Gathering sparkles...</div></div>', R);
    this.loadingEl.id = 'loading';
    this.debugEl = el('div', 'hidden', '', R); this.debugEl.id = 'debug';
    // pointer handlers for menus
    this.pauseBtns = [...this.pauseEl.querySelectorAll('button')];
    // Pointer clicks only: Enter / Space on a focused button (e.detail === 0) already reach menuInput as actions.
    this.pauseBtns.forEach((b, i) => b.addEventListener('click', (e) => { if (e.detail) this.onPauseChoice(i); }));
    this.settingsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      if (!e.detail) return;
      this.settingsSel = +b.dataset.r;
      this.settingsActivate(b.dataset.d ? +b.dataset.d : 0);
    }));
    this.controlsEl.querySelector('[data-close]').addEventListener('click', () => this.closeControls());
    this.mapEl.addEventListener('click', () => this.closeMenu());
    this.endingEl.addEventListener('click', () => this.closeEnding());
  }
  overlay(id, html) {
    const o = el('div', 'overlay hidden', html, this.root);
    o.id = id;
    return o;
  }
  showOverlay(o, on) {
    if (on) { o.classList.remove('hidden'); requestAnimationFrame(() => o.classList.add('show')); }
    else { o.classList.remove('show'); setTimeout(() => { if (!o.classList.contains('show')) o.classList.add('hidden'); }, 250); }
  }

  // ---------------------------------------------------------------- loading / title
  setLoading(p, text) {
    $('.fill', this.loadingEl).style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
    if (text) $('.ls', this.loadingEl).textContent = text;
  }
  hideLoading() { this.loadingEl.classList.add('gone'); setTimeout(() => this.loadingEl.remove(), 600); }
  showTitle(hasSave, cb) {
    const t = this.titleEl;
    const url = (window.ASSET_MANIFEST && window.ASSET_MANIFEST.ui && window.ASSET_MANIFEST.ui.title) ? (window.ASSET_MANIFEST.ui.title.src || window.ASSET_MANIFEST.ui.title) : null;
    $('.bg', t).style.backgroundImage = url ? `url("${url}")` : 'linear-gradient(#9fd8f0, #d8f0c0)';
    t.classList.remove('gone');
    this.titleCb = cb;
    this.titleBtns = [...t.querySelectorAll('button')];
    const cont = t.querySelector('[data-a="continue"]');
    cont.style.display = hasSave ? '' : 'none';
    this.titleBtns = this.titleBtns.filter((b) => b.style.display !== 'none');
    this.titleSel = hasSave ? this.titleBtns.indexOf(cont) : 0;
    this.titleConfirm = false;
    this.hasSave = hasSave;
    $('.confirm', t).textContent = '';
    this.titleBtns.forEach((b, i) => {
      b.onclick = () => { this.titleSel = i; this.titleActivate(); };
      b.onmouseenter = () => { this.titleSel = i; this.markTitle(); };
    });
    this.markTitle();
    this.titleOn = true;
    clearInterval(this.sparkTimer);
    this.sparkTimer = setInterval(() => {
      if (!this.titleOn) return;
      const s = el('div', 'sparkle', '✦', t);
      s.style.left = (Math.random() * 100) + '%';
      s.style.top = (40 + Math.random() * 60) + '%';
      s.style.animationDuration = (2 + Math.random() * 2.5) + 's';
      s.style.fontSize = (8 + Math.random() * 14) + 'px';
      setTimeout(() => s.remove(), 4600);
    }, 260);
  }
  markTitle() { this.titleBtns.forEach((b, i) => b.classList.toggle('sel', i === this.titleSel)); }
  titleActivate() {
    const b = this.titleBtns[this.titleSel];
    const a = b.dataset.a;
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
    const nav = input.menuNav();
    if (nav) { this.titleSel = (this.titleSel + nav + this.titleBtns.length) % this.titleBtns.length; this.titleConfirm = false; $('.confirm', this.titleEl).textContent = ''; this.markTitle(); sfx('menu'); }
    if (input.pressed('attack') || input.pressed('interact')) this.titleActivate();
  }
  hideTitle() { this.titleOn = false; this.titleEl.classList.add('gone'); clearInterval(this.sparkTimer); }

  // ---------------------------------------------------------------- HUD
  showHud(on) { this.hud.classList.toggle('off', !on); }
  updateHud(S, force) {
    const sh = this.shown;
    if (force || sh.hp !== S.hp || sh.maxHp !== S.maxHp) {
      const n = S.maxHp / 2;
      if (force || this.hearts.children.length !== n) {
        this.hearts.innerHTML = '';
        for (let i = 0; i < n; i++) el('div', 'heart', `${img('heart_empty', 'emp')}${img('heart', 'full')}`, this.hearts);
        this.counters.classList.toggle('one-row', n <= 5);
      }
      [...this.hearts.children].forEach((h, i) => {
        const v = S.hp - i * 2;
        h.classList.toggle('empty', v <= 0);
        h.classList.toggle('half', v === 1);
        h.classList.toggle('low', S.hp <= 2 && v > 0);
      });
      if (sh.hp !== -1 && S.hp > sh.hp) this.bumpHearts();
      sh.hp = S.hp; sh.maxHp = S.maxHp;
      this.counters.classList.toggle('one-row', S.maxHp <= 10);
    }
    if (force || sh.coins !== S.coins) {
      const c = $('.gems', this.counters);
      $('b', c).textContent = S.coins;
      if (sh.coins !== -1) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      sh.coins = S.coins;
    }
    if (force || sh.potions !== S.potions) {
      const c = $('.pots', this.counters);
      $('b', c).textContent = S.potions + '/' + CFG.potionMax;
      if (sh.potions !== -1) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      sh.potions = S.potions;
    }
    const sk = SEED_ORDER.map((k) => S.seeds[k]).join('');
    if (force || sh.seeds !== sk) {
      this.seedsEl.querySelectorAll('.seed-slot').forEach((s) => {
        const v = S.seeds[s.dataset.k];
        s.classList.toggle('got', v === 1);
        s.classList.toggle('placed', v === 2);
      });
      sh.seeds = sk;
    }
  }
  bumpHearts() { [...this.hearts.children].forEach((h, i) => { setTimeout(() => { h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump'); }, i * 30); }); }

  // ---------------------------------------------------------------- minimap & map
  setMap(mapCanvas, W) {
    this.mapImg = mapCanvas;
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
  }
  drawMinimap(pl, facing, camYaw, S) {
    const c = this.miniCanvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr) || 160;
    if (c.width !== w) { c.width = w; c.height = w; }
    const x = c.getContext('2d');
    const scale = (w / 120); // px per metre (shows ~120 m across)
    x.save();
    x.fillStyle = '#4fa8d8';
    x.fillRect(0, 0, w, w);
    x.translate(w / 2, w / 2);
    x.imageSmoothingEnabled = true;
    if (this.mapImg) x.drawImage(this.mapImg, (-HALF - pl.x) * scale, (-HALF - pl.z) * scale, SIZE * scale, SIZE * scale);
    // view wedge
    x.fillStyle = 'rgba(255,250,230,0.18)';
    x.beginPath();
    x.moveTo(0, 0);
    const fa = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
    for (const da of [-0.45, 0.45]) x.lineTo(Math.sin(fa + da) * w * 0.4, Math.cos(fa + da) * w * 0.4);
    x.closePath(); x.fill();
    this.drawMarkers(x, pl, scale, S, w * 0.46);
    // player arrow
    x.rotate(Math.atan2(Math.sin(facing), Math.cos(facing)) * -1 + Math.PI);
    x.fillStyle = '#fff6e2'; x.strokeStyle = '#7a4b2a'; x.lineWidth = 2.2 * dpr;
    x.beginPath(); x.moveTo(0, -7 * dpr); x.lineTo(5.5 * dpr, 6 * dpr); x.lineTo(0, 3 * dpr); x.lineTo(-5.5 * dpr, 6 * dpr); x.closePath(); x.fill(); x.stroke();
    x.restore();
  }
  drawMarkers(x, center, scale, S, clampR) {
    const W = this.W;
    if (!W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mk = (wx, wz, draw) => {
      let px = (wx - center.x) * scale, pz = (wz - center.z) * scale;
      if (clampR) { const l = Math.hypot(px, pz); if (l > clampR) { px *= clampR / l; pz *= clampR / l; } }
      x.save(); x.translate(px, pz); draw(); x.restore();
    };
    // Great Tree
    mk(W.greatTree.x, W.greatTree.z, () => {
      x.fillStyle = S && S.ending ? '#ffb0c8' : '#6fae3a'; x.strokeStyle = '#4a2c1a'; x.lineWidth = 2 * dpr;
      x.beginPath(); x.arc(0, -2 * dpr, 6 * dpr, 0, TAU); x.fill(); x.stroke();
      x.fillStyle = '#8a5a32'; x.fillRect(-1.5 * dpr, 3 * dpr, 3 * dpr, 4 * dpr);
    });
    for (const id of SEED_ORDER) {
      const a = W.arenas[id];
      const beaten = S && S.bosses[id];
      mk(a.x, a.z, () => {
        x.fillStyle = beaten ? '#7cc35a' : '#e0503a'; x.strokeStyle = '#4a2c1a'; x.lineWidth = 2 * dpr;
        x.beginPath(); x.arc(0, 0, 6.5 * dpr, 0, TAU); x.fill(); x.stroke();
        x.fillStyle = '#fff'; x.font = `700 ${9 * dpr}px Fredoka, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(beaten ? '✓' : '!', 0, 0.5 * dpr);
      });
    }
    if (W.shop) mk(W.shop.x, W.shop.z, () => { x.fillStyle = '#f5c040'; x.strokeStyle = '#4a2c1a'; x.lineWidth = 1.5 * dpr; x.beginPath(); x.arc(0, 0, 4 * dpr, 0, TAU); x.fill(); x.stroke(); });
  }
  openMap(pl, facing, S) {
    this.menu = 'map';
    this.showOverlay(this.mapEl, true);
    const c = $('canvas', this.mapEl);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr) || 600;
    c.width = c.height = w;
    const x = c.getContext('2d');
    const scale = w / (SIZE * 0.92);
    x.fillStyle = '#4fa8d8'; x.fillRect(0, 0, w, w);
    x.save();
    x.translate(w / 2, w / 2);
    if (this.mapImg) x.drawImage(this.mapImg, -HALF * scale, -HALF * scale, SIZE * scale, SIZE * scale);
    this.drawMarkers(x, { x: 0, z: 0 }, scale, S, 0);
    x.font = `700 ${Math.round(17 * dpr)}px Fredoka, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const r of this.regionLabels || []) {
      const vis = S && S.visited && S.visited[REGIONS.findIndex((q) => q.name === r.name)];
      x.lineWidth = 5 * dpr; x.strokeStyle = 'rgba(74,44,26,0.85)'; x.fillStyle = vis ? '#fff6e2' : 'rgba(255,246,226,0.6)';
      x.strokeText(vis ? r.name : '???', r.x * scale, r.z * scale - 18 * dpr);
      x.fillText(vis ? r.name : '???', r.x * scale, r.z * scale - 18 * dpr);
    }
    // player
    x.translate(pl.x * scale, pl.z * scale);
    x.rotate(-facing + Math.PI);
    x.fillStyle = '#fff6e2'; x.strokeStyle = '#7a4b2a'; x.lineWidth = 3 * dpr;
    x.beginPath(); x.moveTo(0, -10 * dpr); x.lineTo(8 * dpr, 8 * dpr); x.lineTo(0, 4 * dpr); x.lineTo(-8 * dpr, 8 * dpr); x.closePath(); x.fill(); x.stroke();
    x.restore();
    sfx('menu');
  }

  // ---------------------------------------------------------------- banner / toast / prompt / floaters
  showBanner(title, sub) {
    $('.t', this.banner).textContent = title;
    $('.s', this.banner).textContent = sub || '';
    this.banner.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.banner.classList.remove('show'), 2600);
  }
  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }
  setPrompt(pos, label, camera) {
    if (!pos) { this.promptEl.classList.add('hidden'); return; }
    _v.copy(pos).project(camera);
    if (_v.z > 1) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.classList.remove('hidden');
    this.promptEl.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    this.promptEl.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    const l = $('.lbl', this.promptEl);
    if (l.textContent !== label) l.textContent = label || '';
  }
  floater(pos, text, color = '#fff6e2', size = 20) {
    const e = el('div', 'floater', text, this.floatRoot);
    e.style.color = color;
    e.style.fontSize = size + 'px';
    this.floaters.push({ e, pos: pos.clone(), t: 0 });
    if (this.floaters.length > 16) { const f = this.floaters.shift(); f.e.remove(); }
  }
  updateFloaters(dt, camera) {
    this.floaters = this.floaters.filter((f) => {
      f.t += dt;
      if (f.t > 1.0) { f.e.remove(); return false; }
      _v.copy(f.pos); _v.y += f.t * 1.2;
      _v.project(camera);
      f.e.style.left = ((_v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      f.e.style.top = ((-_v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      f.e.style.opacity = f.t < 0.7 ? 1 : 1 - (f.t - 0.7) / 0.3;
      f.e.style.transform = `translate(-50%,-50%) scale(${f.t < 0.12 ? 0.6 + f.t * 4 : 1})`;
      return true;
    });
  }

  // ---------------------------------------------------------------- dialogue
  say(lines, o = {}) {
    this.dlg = { lines: lines.slice(), i: 0, chars: 0, t: 0, blip: 0, onDone: o.onDone || null, name: o.name || null, portrait: o.portrait || null };
    const P = $('.portrait', this.dlgEl);
    const u = o.portrait ? spriteUrl(o.portrait) : null;
    P.innerHTML = u ? `<img src="${u}" alt="">` : '';
    this.dlgEl.classList.toggle('noportrait', !u);
    const nm = $('.name', this.dlgEl);
    nm.textContent = o.name || '';
    nm.style.display = o.name ? '' : 'none';
    $('.text', this.dlgEl).textContent = '';
    this.dlgEl.classList.add('show');
    this.dlgClick = false;
  }
  get dialogueOpen() { return !!this.dlg; }
  updateDialogue(dt, input) {
    const d = this.dlg;
    if (!d) return;
    const line = d.lines[d.i] || '';
    const adv = input.confirm() || this.dlgClick;
    this.dlgClick = false;
    if (d.chars < line.length) {
      d.chars = Math.min(line.length, d.chars + dt * 52);
      d.blip += dt;
      if (d.blip > 0.075) { d.blip = 0; if (line[Math.floor(d.chars)] !== ' ') sfx('talk'); }
      if (adv && d.t > 0.12) d.chars = line.length;
    } else if (adv) {
      d.i++;
      d.chars = 0;
      if (d.i >= d.lines.length) {
        this.dlg = null;
        this.dlgEl.classList.remove('show');
        sfx('select');
        if (d.onDone) d.onDone();
        return;
      }
      sfx('menu');
    }
    d.t += dt;
    $('.text', this.dlgEl).textContent = line.slice(0, Math.floor(d.chars));
    $('.arrow', this.dlgEl).style.visibility = d.chars >= line.length ? 'visible' : 'hidden';
    this.dlgEl.classList.toggle('idle', d.chars >= line.length);
  }

  // ---------------------------------------------------------------- shop
  openShop(S, onBuy, onClose) {
    this.shop = { S, onBuy, onClose, sel: 0, msg: 'What catches your eye?' };
    this.renderShop();
    this.shopEl.classList.add('show');
  }
  shopState(item, S) {
    if (item.id === 'potion') return S.potions >= CFG.potionMax ? 'full' : 'ok';
    if (item.id === 'heart') return S.shopHeart ? 'sold' : 'ok';
    if (item.id === 'sword') return S.swordLevel >= 2 ? 'sold' : 'ok';
    return 'ok';
  }
  renderShop() {
    const sh = this.shop;
    const S = sh.S;
    this.shopEl.innerHTML = `<h2>${img('npc_cat')} Miso's Shop</h2><div class="counter wallet">${img('coin')}<b>${S.coins}</b></div>
      <div class="items">${SHOP.map((it, i) => {
        const st = this.shopState(it, S);
        const pr = st === 'sold' ? 'SOLD OUT' : st === 'full' ? 'FULL' : `${img('coin')}${it.price}`;
        return `<div class="shop-item ${i === sh.sel ? 'sel' : ''} ${st !== 'ok' ? 'out' : ''}" data-i="${i}">${img(it.icon)}<div class="info"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div><div class="pr">${pr}</div></div>`;
      }).join('')}</div><div class="msg">${sh.msg}</div><div class="hint">↑↓ choose · J / Enter buy · Esc leave</div>
      <div style="text-align:center"><button class="btn" data-leave style="min-width:140px;font-size:17px;padding:6px 18px">Bye, Miso!</button></div>`;
    this.shopEl.querySelectorAll('.shop-item').forEach((e) => {
      e.addEventListener('click', () => { sh.sel = +e.dataset.i; this.buySelected(); });
      e.addEventListener('mouseenter', () => { if (sh.sel !== +e.dataset.i) { sh.sel = +e.dataset.i; this.renderShop(); } });
    });
    $('[data-leave]', this.shopEl).addEventListener('click', () => this.closeShop());
  }
  buySelected() {
    const sh = this.shop;
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
    if (nav) { sh.sel = (sh.sel + nav + SHOP.length) % SHOP.length; sfx('menu'); this.renderShop(); }
    if (input.pressed('attack') || input.pressed('interact')) this.buySelected();
    else if (input.cancel()) this.closeShop();
  }
  closeShop() {
    if (!this.shop) return;
    const cb = this.shop.onClose;
    this.shop = null;
    this.shopEl.classList.remove('show');
    sfx('cancel');
    cb && cb();
  }

  // ---------------------------------------------------------------- pause / controls / ending
  openPause() {
    this.menu = 'pause';
    this.pauseSel = 0;
    this.syncPause();
    this.showOverlay(this.pauseEl, true);
    sfx('menu');
  }
  syncPause() {
    const bs = this.pauseBtns;
    bs.find((b) => b.dataset.a === 'sound').textContent = 'Sound: ' + (isMuted() ? 'Off' : 'On');
    bs.forEach((b, i) => b.classList.toggle('sel', i === this.pauseSel));
  }
  onPauseChoice(i) {
    this.pauseSel = i;
    const a = this.pauseBtns[i].dataset.a;
    if (a === 'resume') { this.closeMenu(); return; }
    if (a === 'controls') { this.showOverlay(this.pauseEl, false); this.openControls(true); return; }
    if (a === 'settings') { this.showOverlay(this.pauseEl, false); this.openSettings(); return; }
    if (a === 'sound') { toggleMute(); sfx('select'); this.syncPause(); return; }
    if (a === 'quit') { this.closeMenu(true); this.onSaveQuit && this.onSaveQuit(); }
  }
  openSettings() {
    this.menu = 'settings';
    this.settingsSel = 0;
    this.syncSettings();
    this.showOverlay(this.settingsEl, true);
    sfx('select');
  }
  syncSettings() {
    const s = G.settings || this.settingsDefaults;
    this.settingsEl.querySelectorAll('.srow').forEach((r, i) => {
      $('.val', r).textContent = fmtSetting(SETTING_ROWS[i][0], s[SETTING_ROWS[i][0]]);
      r.classList.toggle('sel', i === this.settingsSel);
    });
    this.settingsEl.querySelectorAll('.menu .btn').forEach((b) => b.classList.toggle('sel', +b.dataset.r === this.settingsSel));
  }
  // dir: -1 / +1 from ← → or the − + buttons; 0 is Enter / attack / a click (toggle, step up with wrap, or press)
  settingsActivate(dir) {
    const i = this.settingsSel, n = SETTING_ROWS.length;
    if (i === n + 1) { this.closeSettings(); return; }
    if (i === n) { this.onSettingsChange && this.onSettingsChange({ ...this.settingsDefaults }); sfx('select'); this.syncSettings(); return; }
    if (i > n) return;
    const s = G.settings || this.settingsDefaults;
    this.onSettingsChange && this.onSettingsChange(stepSetting(s, SETTING_ROWS[i][0], dir || 1, !dir));
    sfx('menu');
    this.syncSettings();
  }
  closeSettings() {
    this.showOverlay(this.settingsEl, false);
    sfx('select');
    this.menu = 'pause';
    this.showOverlay(this.pauseEl, true);
    this.syncPause();
  }
  openControls(fromPause) {
    this.menu = 'controls';
    this.controlsFromPause = !!fromPause;
    this.showOverlay(this.controlsEl, true);
    this.controlsT = performance.now();
  }
  closeControls() {
    this.showOverlay(this.controlsEl, false);
    sfx('select');
    if (this.controlsFromPause) { this.menu = 'pause'; this.showOverlay(this.pauseEl, true); this.syncPause(); }
    else { this.menu = null; this.onControlsClosed && this.onControlsClosed(); }
  }
  openEnding() { this.menu = 'ending'; this.showOverlay(this.endingEl, true); this.endingT = performance.now(); }
  closeEnding() {
    if (performance.now() - (this.endingT || 0) < 1500) return;
    this.menu = null; this.showOverlay(this.endingEl, false); sfx('select');
    this.onEndingClosed && this.onEndingClosed();
  }
  closeMenu(silent) {
    const m = this.menu;
    this.menu = null;
    if (m === 'pause') this.showOverlay(this.pauseEl, false);
    if (m === 'settings') this.showOverlay(this.settingsEl, false);
    if (m === 'map') this.showOverlay(this.mapEl, false);
    if (!silent) sfx('cancel');
  }
  menuInput(input) {
    const m = this.menu;
    if (m === 'pause') {
      const nav = input.menuNav();
      const n = this.pauseBtns.length;
      if (nav) { this.pauseSel = (this.pauseSel + nav + n) % n; this.syncPause(); sfx('menu'); }
      if (input.pressed('attack') || input.pressed('interact')) this.onPauseChoice(this.pauseSel);
      else if (input.pressed('pause') || input.pressed('dash')) this.closeMenu();
    } else if (m === 'settings') {
      const nav = input.menuNav();
      if (nav) { this.settingsSel = (this.settingsSel + nav + SETTINGS_N) % SETTINGS_N; this.syncSettings(); sfx('menu'); }
      const lr = input.pressed('left') ? -1 : input.pressed('right') ? 1 : 0;
      if (lr && this.settingsSel < SETTING_ROWS.length) this.settingsActivate(lr);
      else if (input.pressed('attack') || input.pressed('interact')) this.settingsActivate(0);
      else if (input.pressed('pause') || input.pressed('dash')) this.closeSettings();
    } else if (m === 'controls') {
      if (performance.now() - this.controlsT > 300 && (input.anyPressed)) this.closeControls();
    } else if (m === 'map') {
      if (input.pressed('map') || input.pressed('pause') || input.confirm() || input.pressed('dash')) this.closeMenu();
    } else if (m === 'ending') {
      if (input.anyPressed) this.closeEnding();
    }
  }

  // ---------------------------------------------------------------- boss
  showBossCard(name, title, on) {
    if (on) { $('.bt', this.bosscard).textContent = name; $('.bs', this.bosscard).textContent = title; this.bosscard.classList.add('show'); }
    else this.bosscard.classList.remove('show');
  }
  bossBar(boss) {
    if (!boss) { this.bossbar.classList.add('hidden'); this.bossShown = null; return; }
    this.bossbar.classList.remove('hidden');
    if (this.bossShown !== boss) { $('.bn', this.bossbar).textContent = boss.def.name; this.bossShown = boss; }
    const k = (boss.hp / boss.maxHp) * 100 + '%';
    $('.fill', this.bossbar).style.width = k;
    $('.lag', this.bossbar).style.width = k;
  }

  // ---------------------------------------------------------------- overlays
  setVignette(a) { this.vignette.style.opacity = a; }
  setFlash(a) { this.flashEl.style.opacity = a; }
  setFade(a) { this.fadeEl.style.opacity = a; this.fadeEl.style.pointerEvents = a > 0.5 ? 'auto' : 'none'; }
  setDizzy(on) { this.dizzyEl.classList.toggle('show', on); }
  setDebug(text) {
    if (text == null) { this.debugEl.classList.add('hidden'); return; }
    this.debugEl.classList.remove('hidden');
    this.debugEl.textContent = text;
  }
}
