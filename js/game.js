// Game core: session, save/load, transitions, per-frame input routing, fixed-step orchestration, render-side
// orchestration, the module host (modules.js) and the event bus (events.js). Features are prototype mixins:
// combat.js, targeting.js, interact.js, fight.js, cutscenes.js, ambient.js, spawn.js and debug/debug.js.
import * as THREE from 'three';
import { G, music, audioInit, store } from './core.js';
import { CFG, SAVE_KEY, SAVE_BAK_KEY, REGIONS, NPCS, SEED_ORDER, SEEDS } from './data.js';
import { SAVE_VERSION, freshState, loadSave } from './save.js';
import { Player } from './player.js';
import { NPC } from './npcs.js';
import { Projectile, Pickup, Blobs } from './entities.js';
import { Boss } from './bosses.js';
import { U } from './toon.js';
import { Halos } from './fx.js';
import { clamp, len2, Ease } from './util.js';
import { view as TV } from './tune.js';
import { Emitter, EV } from './events.js';
import { MODULES } from './modules.js';
import { settings } from './settings.js';
import { CombatMixin } from './combat.js';
import { TargetingMixin } from './targeting.js';
import { InteractMixin } from './interact.js';
import { FightMixin } from './fight.js';
import { CutsceneMixin } from './cutscenes.js';
import { AmbientMixin } from './ambient.js';
import { SpawnMixin } from './spawn.js';
import { DebugMixin, frozenTick } from './debug/debug.js';

// controls-card version: saves from before the first-person controls (no controlsV) see the new card once
export const CONTROLS_V = 2;

const NO_AXIS = { x: 0, y: 0, l: 0 };

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // renderer, scene, camera, view, lock, input, ui, fx, sky, world, scenery, clock
    G.game = this;
    this.events = G.events = new Emitter();
    this.events.clock = this.clock;
    this.settings = G.settings = settings;
    this.cam = G.cam = G.view = this.view;   // G.cam stays as an alias (bosses.js G.cam.shake)
    this.modules = MODULES.filter(Boolean);
    this.modErrs = new Map();
    this.modal = null;
    this.modalClosedAt = -1e9;                 // gameplay ignores attack/jump/dash for 120 ms after a modal closes
    this.presses = { attack: false, dash: false, jump: false }; // press edges waiting for the next fixed step
    this.intent = { mx: 0, mz: 0, ml: 0, lookYaw: Math.PI, lookPitch: 0, mode: 'fp', attack: false, dash: false, jump: false, jumpHeld: false, sprint: false, faceYaw: null, facePitch: null, bodyYaw: null, bodyShown: false };
    this.leaving = false;
    this.state = 'title';
    this.enemies = []; this.projectiles = []; this.pickups = []; this.npcs = [];
    this.bosses = {}; this.fight = null; this.cutscene = null; this.trans = null;
    this.skipScene = null;   // a running cutscene that can be skipped registers its skip here (G.debug.scene.skip)
    this.redFlash = 0; this.whiteFlash = 0;
    this.spawnT = 0; this.regionCheckT = 0; this.curRegion = -1; this.pendRegion = -1; this.pendT = 0;
    this.autosaveT = 0; this.ambT = 0; this.regrow = [];
    this.frustum = new THREE.Frustum();
    this.time = 0;
    this.player = new Player(this.scene);
    G.player = this.player;
    this.blobs = new Blobs(this.scene);
    const gt = this.scenery.greatTree;
    this.world.fitTreeColliders(gt && gt.footprint, gt && gt.height);   // trunk/root circles + their height from the built tree
    this.buildCuttables();
    this.buildPedestalSeeds();
    this.buildVineWalls();
    const lanterns = this.world.lamps.map((l) => ({ x: l.x + Math.cos(l.rot) * 0.52, y: l.y + 2.04, z: l.z - Math.sin(l.rot) * 0.52, size: 3.2, color: 0xffb860 }));
    this.halos = new Halos(this.scene, this.fx.atlas, lanterns);
    this.heldItem = null;               // item-get item (interact.js); presented by the viewmodel module (WP2)
    for (const def of NPCS) {
      const sp = this.world.npcSpots[def.id];
      if (sp) this.npcs.push(new NPC(def, sp));
    }
    this.ui.onSaveQuit = () => this.saveAndQuit();
    this.ui.onControlsClosed = () => { this.S.controlsSeen = true; this.S.controlsV = CONTROLS_V; this.save(true); };
    this.ui.onEndingClosed = () => this.finishEnding();
    this.view.attach(this);
    if (this.lock) {
      this.lock.onLost = () => this.onLockLost();
      this.lock.onFallback = () => this.ui.toast('Mouse look: hold the right button and drag');
      this.ui.onVeilClick = () => this.lock.request(true);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing && this.player.state !== 'dizzy') this.ui.openPause(); });
    this.setupDebug();
    this._call('attach', this);
  }
  /** pointer lock lost while wanted (Esc, alt-tab): pause in free play; while busy (dialogue, cutscene, fade, dizzy,
   *  boss intro) the veil asks for a click, and pause opens as soon as play resumes if the lock is still missing */
  onLockLost() {
    if (this.lockBusy()) { this.lockLostBusy = this.state === 'play'; return; }
    this.ui.openLockPause();
  }
  lockBusy() { return this.state !== 'play' || !this.playing || this.player.state === 'dizzy' || !!(this.fight && this.fight.phase === 'intro'); }

  // ------------------------------------------------------------------ module host
  /** run one hook on every module; a throwing module never stops the loop (first 5 errors per module/hook logged) */
  _call(hook, a, b, c) {
    for (const m of this.modules) {
      const f = m[hook];
      if (typeof f !== 'function') continue;
      try { f.call(m, a, b, c); } catch (e) { this.modError(m, hook, e); }
    }
  }
  modError(m, hook, e) {
    const k = (m.name || '?') + '.' + hook, n = (this.modErrs.get(k) || 0) + 1;
    this.modErrs.set(k, n);
    if (G.debugOn && n <= 5) console.error('[Starseed] module ' + k, e);
  }
  /** register a module at runtime (tests, late-loaded features) */
  addModule(m) {
    this.modules.push(m);
    if (typeof m.attach === 'function') { try { m.attach(this); } catch (e) { this.modError(m, 'attach', e); } }
    return m;
  }
  onResize(w, h) { this._call('onResize', w, h); }
  afterRender(dt) { this._call('afterRender', this.renderer, dt); }
  /** which modal UI owns input right now */
  modalNow() { const ui = this.ui; return ui.dlg ? 'dlg' : ui.shop ? 'shop' : ui.menu || null; }
  trackModal() {
    const m = this.modalNow();
    if (m !== this.modal) {
      const prev = this.modal;
      this.modal = m;
      if (!m) this.modalClosedAt = performance.now();
      else this.clearPresses();                  // a press still waiting for its step never fires after the modal
      this.events.emit(EV.MODAL, { modal: m, prev });
      this._call('onModal', m, prev);
    }
    // pointer lock: kept for play, dialogue, cutscenes and fades; released for cursor menus and the title
    const ui = this.ui, cursor = this.state !== 'play' || !!ui.shop || !!ui.menu || this.leaving;
    this.input.cursorMenu = cursor;
    // touch layout per mode (touch.js presents each one, WP6): title / fades → hidden, cursor menu or shop → modal
    this.input.setTouchMode(this.state !== 'play' ? 'hidden' : ui.shop || ui.menu ? 'modal' : ui.dlg ? 'dialogue' : 'play');
    if (this.lock) {
      const dev = this.input.lastDevice;
      this.lock.update(!cursor, dev === 'mouse' || dev === 'keyboard');
      ui.setVeil(this.lock.veil);
      // a lock lost while busy: once play resumes without it, pause (the fight must not run on under the veil)
      if (this.lockLostBusy && (this.lock.locked || this.state !== 'play')) this.lockLostBusy = false;
      else if (this.lockLostBusy && !this.lockBusy() && !cursor) { this.lockLostBusy = false; if (this.lock.wanted) ui.openLockPause(); }
    }
    // the world is paused under cursor menus: the clock holds too, so interpolated actors (and the FP eye) keep still
    this.clock.hold = this.state === 'play' && !!(ui.menu || ui.shop);
    ui.setCrosshair(this.state === 'play' && !cursor && !ui.dlg && this.view.shotW < 0.5 && !this.trans);
  }

  // ------------------------------------------------------------------ session
  // Saves are validated and migrated by js/save.js (keyed off their `v` field, not SAVE_KEY's name).
  hasSave() { return !!loadSave(store.get(SAVE_KEY), this.world.seed); }
  newGame() {
    audioInit();
    this.S = freshState(this.world.seed);
    this.startSession(true);
  }
  continueGame() {
    audioInit();
    this.backupOldSave();
    const s = loadSave(store.get(SAVE_KEY), this.world.seed);
    if (!s) return this.newGame();
    this.S = s; // validated, migrated and filled from freshState by loadSave (js/save.js)
    // optional pitch is restored clamped in startSession; an older controls card → show the new one once
    if (!((s.controlsV || 1) >= CONTROLS_V)) this.S.controlsSeen = false;
    this.startSession(false);
  }
  // A save from an older version is about to migrate: keep its raw string as it was under SAVE_BAK_KEY first (each
  // migration overwrites the backup before it). Read raw on purpose: store.get parses, and the backup must be untouched.
  backupOldSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw == null) return false;
      const o = JSON.parse(raw);
      if (o === null || typeof o !== 'object' || !Number.isInteger(o.v) || o.v >= SAVE_VERSION) return false;
      localStorage.setItem(SAVE_BAK_KEY, raw);
      return true;
    } catch (e) {
      return false;
    }
  }
  startSession(isNew) {
    const S = this.S;
    const W = this.world;
    // world state from save
    for (const c of W.chests) this.scenery.setChestOpen(c.id, !!S.chests[c.id], true);
    this.syncErrands();      // errand items (Clover's rainbow shells that are out, Ribbit's parade lanterns; interact.js)
    this.syncPlushies();     // Miso's counter: the guardian plushies bought (interact.js)
    this.syncSecrets();      // the landmark keepsakes: the found ones gone, an opened bottle (interact.js)
    this.resetErrandNpcs();  // a parade villager is back home, not following, until Pip talks to him again
    this.scenery.setBloom(!!S.ending);
    this.treeSeeds.forEach((g) => (g.visible = !!S.ending && this.treeSeedsWanted()));
    this.pedSeeds.forEach((g, i) => (g.visible = S.seeds[SEED_ORDER[i]] === 2));
    this.resetEntities();
    for (const id of SEED_ORDER) if (!S.bosses[id]) this.bosses[id] = new Boss(id, W.arenas[id]);
    this.spawnRematches(true);   // after the bloom, the beaten guardians nap in their arenas for a rematch (fight.js)
    this.spawnMissingSeeds();
    // player + look (facing = look yaw, facing convention; pitch is an optional save field). A corrupted optional field
    // (non-numeric facing / pitch) falls back to the default instead of turning the view NaN
    let px = W.spawn.x, pz = W.spawn.z, f = Math.PI, pitch = this.defaultPitch();
    const num = (v) => (v != null && v !== '' && Number.isFinite(+v) ? +v : null);
    if (!isNew && num(S.px) != null && num(S.pz) != null && W.walkable(+S.px, +S.pz) && !W.inArena(+S.px, +S.pz, 1)) {
      px = +S.px; pz = +S.pz; f = num(S.facing) ?? Math.PI; pitch = clamp(num(S.pitch) ?? pitch, -0.6, 0.6);
    }
    this.player.place(px, pz, f);
    this.player.setSword(S.swordLevel);
    this.player.frozen = false;
    this.leaving = false;
    this.clearPresses();
    this.view.setLook(f, pitch);
    this.view.setLookLimit(null);
    this.view.snap();
    this.clock.resetPhase();
    this.state = 'play';
    this.ui.hideTitle();
    this.ui.updateHud(S, true);
    this.ui.showHud(true);
    this.curRegion = -1; this.pendRegion = -1;
    this.autosaveT = 0;
    this.ui.setFade(1);
    this.fadeIn(1.0, () => this.sessionIntro(isNew));   // interact.js (intro talk / controls card / greeting)
    this.updateMusic(true);
    this.events.emit(EV.SESSION, { isNew });
    this._call('onSession', isNew);
  }
  resetEntities() {
    for (const e of this.enemies) e.remove();
    for (const p of this.projectiles) p.pop(false);
    for (const p of this.pickups) p.remove();
    for (const id in this.bosses) this.bosses[id].remove();
    this.enemies = []; this.projectiles = []; this.pickups = []; this.bosses = {};
    if (this.fight) this.endFight(true);
    this.fight = null; this.cutscene = null; this.skipScene = null;
    this.fx.ground.clear();
    this.clearHeldItem();
    this.view.clearShot();
    this.ui.bossBar(null);
    for (const id in this.vines) { const v = this.vines[id]; v.k = v.target = 0; v.g.visible = false; }
  }
  spawnMissingSeeds() {
    for (const id of SEED_ORDER) {
      if (this.S.bosses[id] && !this.S.seeds[id] && !this.pickups.some((p) => p.kind === 'seed' && p.seedId === id)) {
        const a = this.world.arenas[id];
        this.pickups.push(new Pickup('seed', a.x, a.z, { seedId: id, color: SEEDS[id].color, vy: 6, spread: 0, y0: 1 }));
      }
    }
  }
  saveData() {
    const S = this.S;
    S.px = this.player.pos.x; S.pz = this.player.pos.z; S.facing = this.view.yaw; S.pitch = +this.view.pitch.toFixed(4);
    if (this.fight && this.fight.phase !== 'won') { S.px = this.world.arenas[this.fight.id].outside.x; S.pz = this.world.arenas[this.fight.id].outside.z; }
    return S;
  }
  save(quiet) {
    if (this.state !== 'play' || !this.S) return;
    const ok = store.set(SAVE_KEY, this.saveData());
    if (ok && !quiet) this.ui.toast('✿ Saved');
    if (ok) this.events.emit(EV.SAVE, { quiet: !!quiet });
  }
  saveAndQuit() {
    this.save(true);
    this.leaving = true; // releases the pointer lock during the fade
    this.fadeOutIn(0.5, () => {
      this.resetEntities();
      this.ui.showHud(false);
      this.ui.setPrompt(null);
      this.showTitle();
    });
  }
  /** gameplay pitch at session start / respawn: level in FP, slightly down in TP (RULINGS default −6°) */
  defaultPitch() { return this.view.mode === 'tp' ? (TV.tpPitch * Math.PI) / 180 : 0; }
  /** title screen (boot and Save & Quit) */
  showTitle() {
    this.state = 'title';
    this.ui.showTitle(this.hasSave(), (a) => (a === 'continue' ? this.continueGame() : this.newGame()));
    music('title');
    this.events.emit(EV.TITLE, {});
    this._call('onTitle');
  }

  // ------------------------------------------------------------------ transitions
  fadeIn(dur, then) { this.trans = { phase: 'in', t: 0, dur, then }; }
  fadeOutIn(dur, mid, then) { this.trans = { phase: 'out', t: 0, dur, mid, then }; }
  updateTrans(dt) {
    const tr = this.trans;
    if (!tr) return;
    tr.t += dt;
    const k = clamp(tr.t / tr.dur, 0, 1);
    this.ui.setFade(tr.phase === 'out' ? Ease.inOutSine(k) : 1 - Ease.inOutSine(k));
    if (k >= 1) {
      if (tr.phase === 'out') { tr.mid && tr.mid(); tr.phase = 'in'; tr.t = 0; }
      else { this.trans = null; this.ui.setFade(0); tr.then && tr.then(); }
    }
  }

  // ------------------------------------------------------------------ queries used by entities
  dynamicColliders(pl) {
    const out = this._dyn || (this._dyn = []);
    out.length = 0;
    // a villager following Pip (Ribbit's parade) is not solid for him: he trails right behind, so Pip turning back in a
    // narrow spot would find the way out blocked (he also steps aside, npcs.js followUpdate)
    for (const n of this.npcs) if (!n.follow) out.push({ x: n.pos.x, z: n.pos.z, r: n.r });
    // r2 actors: the boss body stays solid while it dies (until it is gone), sized to keep the FP eye out of its mesh
    const fb = this.fight && this.fight.boss;
    if (fb && !fb.dead && fb.lift < 1) out.push({ x: fb.pos.x, z: fb.pos.z, r: fb.colliderR ?? fb.r * 0.85 });
    for (const id in this.bosses) { const b = this.bosses[id]; if (b.state === 'sleep') out.push({ x: b.pos.x, z: b.pos.z, r: b.r }); }
    return out;
  }
  enemyColliders(e) {
    const out = this._edyn || (this._edyn = []);
    out.length = 0;
    for (const o of this.enemies) if (o !== e && o.alive && len2(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2) out.push({ x: o.pos.x, z: o.pos.z, r: o.r * 0.8 });
    return out;
  }
  // ground surface queries live on the world (world-collide.js, WP3); these delegates keep the old Game API
  splatK(p) { return this.world.splatK(p.x, p.z); }
  dustColor(p) { return this.world.dustColor(p.x, p.z); }
  surfaceAt(p) { return this.world.surfaceAt(p.x, p.z); }
  get playing() { return this.state === 'play' && !this.ui.dlg && !this.ui.shop && !this.ui.menu && !this.cutscene && !this.trans; }

  // ------------------------------------------------------------------ frame update
  frame(dt, rawDt) {
    const input = this.input, ui = this.ui, view = this.view;
    this.time += dt;
    U.uTime.value = this.time;
    // look first: raw deltas → yaw/pitch before the steps (0 frames latency); drained whenever look isn't allowed
    view.lookAllowed = this.state === 'play' && (this.playing || !!ui.dlg) && this.player.state !== 'dizzy' && !ui.shop && !ui.menu && view.shotW <= 0.5 && !(this.fight && this.fight.phase === 'intro');
    view.assistPaused = !!(ui.shop || ui.menu); // the world is paused: scripted look assists (boss intro) wait for it
    view.applyLook(input, dt);
    if (this.state !== 'play') { input.takeWheel(); this.updateTrans(rawDt); this.trackModal(); return 0; }
    this.updateTrans(rawDt);
    // modal UI (input.modal: this frame began with one open, so the pad's edges for the per-frame toggles below come from
    // its menu layout, even when the press closes it)
    input.modal = !!(ui.dlg || ui.shop || ui.menu);
    if (ui.dlg) ui.updateDialogue(dt, input);
    else if (ui.shop) ui.updateShop(input);
    // r4: the press that closes a card is the card's (V or RB on the ending's "any button" also switched the view)
    else if (ui.menu) { ui.menuInput(input); if (!ui.menu) input.consumeAll(); }
    else if (!this.cutscene && !this.trans && this.player.state !== 'dizzy') this.gameplayInput(input);
    // view toggle (also during dialogue), TP shoulder swap and boom zoom
    const free = !ui.shop && !ui.menu;
    if (free && input.framePressed('view')) view.toggleMode();
    if (free && input.framePressed('shoulder') && view.mode === 'tp') view.swapShoulder();
    const wh = input.takeWheel();
    if (wh && free) view.zoom(wh);
    this._call('frameInput', input, dt);
    this.debugKeys(input);
    this.trackModal();
    return 1;
  }
  clearPresses() { const p = this.presses; p.attack = p.dash = p.jump = false; }
  /** one intent per fixed step: world wish rotated by this frame's frozen look basis + press edges (arch §7.1), then
   *  the modules' intent(it, canAct) hook may adjust it (lock-on: bodyYaw = target bearing and faceYaw for swings,
   *  WP1/WP4; sprint toggle: WP3). bodyYaw starts null every step: a module holds it by setting it each step */
  buildIntent(canAct) {
    const it = this.intent, v = this.view, input = this.input, p = this.presses;
    const a = canAct ? input.axis() : NO_AXIS, f = v.forward(), r = v.right();
    it.mx = r.x * a.x + f.x * a.y; it.mz = r.z * a.x + f.z * a.y; it.ml = a.l;
    it.lookYaw = v.lookYaw; it.lookPitch = v.lookPitch; it.mode = v.mode; it.bodyShown = v.bodyOut;
    it.attack = p.attack; it.dash = p.dash; it.jump = p.jump;
    it.jumpHeld = input.held('jump'); it.sprint = input.held('sprint');
    // TP: attacks snap the body to the crosshair aim and swing along it
    it.faceYaw = v.mode === 'tp' ? v.aimYaw : null; it.facePitch = v.mode === 'tp' ? v.aimPitch : null;
    it.bodyYaw = null;
    this._call('intent', it, canAct);
    return it;
  }

  // ------------------------------------------------------------------ fixed step (hit-stop freezes are the clock's job)
  step(dt) {
    if (this.state !== 'play') return;
    const S = this.S;
    const pl = this.player;
    const canAct = this.playing && pl.state !== 'dizzy' && !(this.fight && this.fight.phase === 'intro');
    const worldRuns = !this.ui.menu && !this.ui.shop;
    if (!worldRuns) return;
    this._call('beforeStep', dt);
    if (!this.cutscene && !this.todFrozen) S.tod = (S.tod + dt / CFG.dayLength) % 1;   // todFrozen: G.debug.freezeTime
    S.playTime += dt;
    pl.update(dt, this.buildIntent(canAct), canAct);
    this.clearPresses(); // delivered to the first step after the press
    if (pl.state === 'dizzy') this.updateDizzy(dt);
    if (pl.attackActive && !this.ui.dlg) this.resolveSword(dt); // talking pauses the world: no free hits on it
    this.redFlash = Math.max(0, this.redFlash - dt * 2.2);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2.5);
    // entities (G.debug.freezeAI: enemies hold still, only their timers run)
    const talking = !!this.ui.dlg;
    if (!talking) {
      for (const e of this.enemies) if (e.alive) { if (this.aiFrozen) frozenTick(e, dt); else e.update(dt); }
      for (const e of this.enemies) if (!e.alive && !e.removed) this.killEnemy(e);
      this.enemies = this.enemies.filter((e) => !e.removed);
      for (const p of this.projectiles) if (p.alive) p.update(dt);
      this.projectiles = this.projectiles.filter((p) => p.alive);
      for (const p of this.pickups) if (p.alive) p.update(dt);
      this.pickups = this.pickups.filter((p) => p.alive);
      this.updateFight(dt);
    } else {
      // talking pauses these actors: settle their interpolation so they don't shimmer between prev and pos
      for (const e of this.enemies) settle(e);
      for (const p of this.projectiles) settle(p);
      for (const p of this.pickups) settle(p);
      for (const id in this.bosses) settle(this.bosses[id]);
    }
    for (const n of this.npcs) n.update(dt);
    this.tickErrands();   // parade lanterns Pip walks past with Ribbit close behind (interact.js)
    if (this.cutscene) this.updateCutscene(dt);
    this.updateSpawning(dt);
    this.updateRegrowth(dt);
    this.updateRegion(dt);
    this.updateAmbient(dt);
    this.autosaveT += dt;
    if (this.autosaveT > CFG.autosave && this.playing && !this.fight) { this.autosaveT = 0; this.save(true); }
    this._call('afterStep', dt);
  }
  addEnemy(e) { this.enemies.push(e); }
  spawnProjectile(kind, x, y, z, ang, speed, o) { this.projectiles.push(new Projectile(kind, x, y, z, ang, speed, o)); }

  // ------------------------------------------------------------------ region / music
  updateRegion(dt) {
    this.regionCheckT -= dt;
    if (this.regionCheckT > 0) return;
    this.regionCheckT = 0.25;
    const pl = this.player;
    const r = this.world.regionAt(pl.pos.x, pl.pos.z);
    if (r !== this.curRegion) {
      if (r !== this.pendRegion) { this.pendRegion = r; this.pendT = 0; }
      this.pendT += 0.25;
      if (this.pendT >= 0.75 || this.curRegion === -1) {
        const first = this.curRegion === -1;
        this.curRegion = r;
        const R = REGIONS[r];
        const seen = !!this.S.visited[r];
        if (!first || !seen) this.ui.showBanner(R.name, R.sub);
        this.S.visited[r] = true;
        this.updateMusic();
        this.events.emit(EV.REGION, { id: R.id, first: !seen, session: first });
      }
    }
  }
  updateMusic(force) {
    if (this.fight && this.fight.phase !== 'won') return;
    const R = REGIONS[this.curRegion < 0 ? this.world.regionAt(this.player.pos.x, this.player.pos.z) : this.curRegion];
    if (this.S && this.S.ending && R.id === 'village') { music('ending'); return; }
    music(R ? R.music : 'village');
  }

  // ------------------------------------------------------------------ render-side update
  render(alpha, dt) {
    if (this.state !== 'play') return;
    const t = this.time;
    const pl = this.player;
    pl.render(alpha, dt, t);
    for (const e of this.enemies) e.render(alpha, t);
    for (const n of this.npcs) n.render(alpha, t);
    for (const id in this.bosses) this.bosses[id].render(alpha, t);
    for (const p of this.projectiles) p.render(alpha, t);
    for (const p of this.pickups) p.render(alpha, t);
    this.scenery.update(dt);
    this.animateSeeds(t);
    if (!this.clock.hold && !this.ui.dlg) { this.tickErrandFx(dt); this.tickSecretFx(dt); }
    // blob shadows: each actor's blob(out) says where and how big (or null); Pip's own only while the camera is out of
    // his head, never under the FP eye
    const B = this.blobs, o = _blob;
    B.begin();
    if (this.view.bodyOut && pl.blob(o)) B.add(o.x, o.y, o.z, o.r);
    for (const e of this.enemies) if (e.blob(o)) B.add(o.x, o.y, o.z, o.r);
    for (const n of this.npcs) if (n.blob(o)) B.add(o.x, o.y, o.z, o.r);
    for (const id in this.bosses) if (this.bosses[id].blob(o)) B.add(o.x, o.y, o.z, o.r);
    for (const p of this.projectiles) if (p.blob(o)) B.add(o.x, o.y, o.z, o.r);
    for (const p of this.pickups) if (p.blob(o)) B.add(o.x, o.y, o.z, o.r);
    B.end();
    this._call('beforeCamera', alpha, dt);
    // camera: eye / TP boom / shot blend, FOV, layers, occluder uniforms (the view owns all of it)
    this.view.update(alpha, dt);
    // sky & lights
    const h = this.S.tod * 24;
    this.sky.update(h, pl.root.position, this.camera, this.world.lamps, dt, t, this.view.shadowFocus());
    // WP8: the water's light / reflections / glints moved to the wp8-atmo module (afterCamera)
    U.uPip.value.copy(pl.root.position);
    this.frustum.setFromProjectionMatrix(_m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    this._call('afterCamera', alpha, dt);
    // crosshair target (WP4), then the HUD frame: prompt, hearts, floaters, minimap, vignette, flash, boss bar (ui.js, WP6)
    this.target = this.findTarget();
    this.ui.frame(this, dt);
    this.updateDebug(dt);
  }
}

Object.assign(Game.prototype, CombatMixin, TargetingMixin, InteractMixin, FightMixin, CutsceneMixin, AmbientMixin, SpawnMixin, DebugMixin);

const _m = new THREE.Matrix4();
const _blob = { x: 0, y: 0, z: 0, r: 0 };
/** an actor the step skipped renders at its sim pose for any alpha */
function settle(o) { if (o.prev) o.prev.copy(o.pos); if (o.prevFacing !== undefined) o.prevFacing = o.facing; }
