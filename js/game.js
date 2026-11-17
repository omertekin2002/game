// Game orchestration: state, fixed-step simulation, interactions, combat, boss fights, ending, save/load,
// ambient particles, region tracking, debug helpers.
import * as THREE from 'three';
import { G, sfx, music, audioInit, store } from './core.js';
import { CFG, SAVE_KEY, REGIONS, REGION, NPCS, SEED_ORDER, SEEDS, BOSSES, progress } from './data.js';
import { freshState, loadSave } from './save.js';
import { capFlash } from './settings.js';
import { Player } from './player.js';
import { NPC } from './npcs.js';
import { Enemy, Projectile, Pickup, Blobs, trySpawnEnemy } from './entities.js';
import { Boss } from './bosses.js';
import { GB, toonMat, sharedOutline, meshWithOutline, U } from './toon.js';
import { seedBuilt, heartContainerBuilt, swordBuilt } from './models.js';
import { Halos, SHAPE } from './fx.js';
import { N, HALF } from './world.js';
import { clamp, lerp, rand, pick, TAU, len2, angDiff, smoothstep, Ease } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // renderer, scene, camera, cam, input, ui, fx, sky, world, scenery
    G.game = this;
    this.state = 'title';
    this.enemies = []; this.projectiles = []; this.pickups = []; this.npcs = [];
    this.bosses = {}; this.fight = null; this.cutscene = null; this.trans = null;
    this.hitStopT = 0; this.redFlash = 0; this.whiteFlash = 0;
    this.spawnT = 0; this.regionCheckT = 0; this.curRegion = -1; this.pendRegion = -1; this.pendT = 0;
    this.autosaveT = 0; this.ambT = 0; this.regrow = [];
    this.frustum = new THREE.Frustum();
    this.time = 0;
    this.debugGizmo = null;
    this.player = new Player(this.scene);
    G.player = this.player;
    this.blobs = new Blobs(this.scene);
    this.fitTreeColliders();
    this.buildCuttables();
    this.buildPedestalSeeds();
    this.buildVineWalls();
    const lanterns = this.world.lamps.map((l) => ({ x: l.x + Math.cos(l.rot) * 0.52, y: l.y + 2.04, z: l.z - Math.sin(l.rot) * 0.52, size: 3.2, color: 0xffb860 }));
    this.halos = new Halos(this.scene, this.fx.atlas, lanterns);
    for (const def of NPCS) {
      const sp = this.world.npcSpots[def.id];
      if (sp) this.npcs.push(new NPC(def, sp));
    }
    this.ui.onSaveQuit = () => this.saveAndQuit();
    this.ui.onControlsClosed = () => { this.S.controlsSeen = true; this.save(true); };
    this.ui.onEndingClosed = () => this.finishEnding();
    this.setupDebug();
  }

  // ------------------------------------------------------------------ setup helpers
  treeSeedsWanted() { const t = this.scenery.greatTree; return !(t && t.glb && t.glb.b); }
  fitTreeColliders() {
    const fp = this.scenery.greatTree && this.scenery.greatTree.footprint;
    if (!fp) return;
    const W = this.world, T = W.greatTree;
    const R = Math.min(3.4, Math.max(1.2, fp * 0.62));
    let ring = 0;
    for (const c of W.colliders) {
      if (c.kind !== 'tree') continue;
      const d = Math.hypot(c.x - T.x, c.z - T.z);
      if (d < 0.1) c.r = Math.min(c.r, R);
      else { const a = Math.atan2(c.x - T.x, c.z - T.z); c.x = T.x + Math.sin(a) * R * 0.9; c.z = T.z + Math.cos(a) * R * 0.9; c.r = Math.min(0.9, R * 0.4); ring++; }
    }
    W.rehash();
  }
  buildCuttables() {
    const W = this.world;
    this.cutHash = new Map();
    const add = (o, kind) => {
      o.cutKind = kind;
      const key = (Math.floor(o.x / 4) + 100) * 1000 + (Math.floor(o.z / 4) + 100);
      let a = this.cutHash.get(key);
      if (!a) this.cutHash.set(key, (a = []));
      a.push(o);
    };
    for (const d of W.deco) if (d.type === 'tallgrass') add(d, 'grass');
    for (const p of W.props) {
      if (p.removed) continue;
      if (p.type === 'bush') add(p, 'bush');
      if (p.type === 'pot' && p.breakable) add(p, 'pot');
    }
    for (const c of W.colliders) if (c.prop && (c.prop.type === 'bush' || c.prop.type === 'pot')) c.prop.collider = c;
  }
  nearCuttables(x, z, r, out = []) {
    out.length = 0;
    const x0 = Math.floor((x - r) / 4), x1 = Math.floor((x + r) / 4), z0 = Math.floor((z - r) / 4), z1 = Math.floor((z + r) / 4);
    for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) {
      const arr = this.cutHash.get((a + 100) * 1000 + (b + 100));
      if (arr) for (const o of arr) if (!o.cut) out.push(o);
    }
    return out;
  }
  buildPedestalSeeds() {
    const W = this.world;
    const mat = toonMat({ glow: true, rim: 1.5 });
    this.pedSeeds = SEED_ORDER.map((id, i) => {
      const g = meshWithOutline(seedBuilt(SEEDS[id].color), mat, sharedOutline('char'));
      g.position.set(W.pedestal.x + (i - 1) * 0.58, W.plaza.h + 1.1, W.pedestal.z + 0.05);
      g.scale.setScalar(1.1);
      g.visible = false;
      this.scene.add(g);
      return g;
    });
    // seeds hanging in the bloomed tree
    this.treeSeeds = SEED_ORDER.map((id, i) => {
      const g = meshWithOutline(seedBuilt(SEEDS[id].color), mat, sharedOutline('char'));
      const e = this.scenery.greatTree.branchEnds[i * 2];
      const th = this.scenery.greatTree.height;
      g.position.set(W.greatTree.x + e[0] * 0.8, W.greatTree.y + e[1] - th * 0.086, W.greatTree.z + e[2] * 0.8);
      g.scale.setScalar(th > 11 ? 2.2 : 1.6);
      g.visible = false;
      this.scene.add(g);
      return g;
    });
  }
  buildVineWalls() {
    this.vines = {};
    const mat = toonMat({ glow: true, nightGlow: false, glowBase: 1, occ: true });
    for (const id in this.world.arenas) {
      const a = this.world.arenas[id];
      const b = new GB();
      const half = 0.36;
      for (let k = 0; k < 7; k++) {
        const pts = [];
        for (let s = 0; s <= 8; s++) {
          const t = s / 8;
          const ang = a.entAng - half + t * half * 2;
          const r = a.r + 1.0 + Math.sin(t * Math.PI * 3 + k) * 0.35;
          pts.push([Math.sin(ang) * r, 0.2 + k * 0.42 + Math.sin(t * Math.PI * 4 + k * 1.3) * 0.25, Math.cos(ang) * r]);
        }
        b.tube(pts, 0.12, k % 2 ? 0x5aa83a : 0x6fc04a, { tseg: 28, rs: 6, glow: 0.25 });
      }
      for (let k = 0; k < 18; k++) {
        const t = (k + 0.5) / 18;
        const ang = a.entAng - half + t * half * 2;
        const r = a.r + 1.0;
        const y = 0.3 + (k % 7) * 0.42;
        b.sphere(0.16, 0x9ad04e, { x: Math.sin(ang) * r, y, z: Math.cos(ang) * r, sx: 1.6, sy: 0.4, rz: k, ry: ang, ws: 8, hs: 5, glow: 0.3 });
        if (k % 3 === 0) b.sphere(0.12, 0xffd0f0, { x: Math.sin(ang) * (r + 0.15), y: y + 0.2, z: Math.cos(ang) * (r + 0.15), ws: 8, hs: 6, glow: 0.9, outline: false });
      }
      for (const side of [-1, 1]) {
        const ang = a.entAng + side * half;
        b.cyl(0.25, 0.32, 3.3, 0x4a8a2a, { x: Math.sin(ang) * (a.r + 1), y: 1.6, z: Math.cos(ang) * (a.r + 1), glow: 0.15 });
      }
      const g = meshWithOutline(b.build(), mat, sharedOutline('propOcc'));
      g.position.set(a.x, a.h, a.z);
      g.visible = false;
      g.scale.set(1, 0.01, 1);
      this.scene.add(g);
      this.vines[id] = { g, k: 0, target: 0 };
    }
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
    const s = loadSave(store.get(SAVE_KEY), this.world.seed);
    if (!s) return this.newGame();
    this.S = s;
    this.startSession(false);
  }
  startSession(isNew) {
    const S = this.S;
    const W = this.world;
    // world state from save
    for (const c of W.chests) this.scenery.setChestOpen(c.id, !!S.chests[c.id], true);
    this.scenery.setBloom(!!S.ending);
    this.treeSeeds.forEach((g) => (g.visible = !!S.ending && this.treeSeedsWanted()));
    this.pedSeeds.forEach((g, i) => (g.visible = S.seeds[SEED_ORDER[i]] === 2));
    this.resetEntities();
    for (const id of SEED_ORDER) if (!S.bosses[id]) this.bosses[id] = new Boss(id, W.arenas[id]);
    this.spawnMissingSeeds();
    // player
    let px = W.spawn.x, pz = W.spawn.z, f = Math.PI;
    if (!isNew && S.px != null && W.walkable(S.px, S.pz) && !W.inArena(S.px, S.pz, 1)) { px = S.px; pz = S.pz; f = S.facing ?? Math.PI; }
    this.player.place(px, pz, f);
    this.player.setSword(S.swordLevel);
    this.player.frozen = false;
    this.cam.yawTarget = 0;
    this.cam.snap(this.player.pos);
    this.state = 'play';
    this.ui.hideTitle();
    this.ui.updateHud(S, true);
    this.ui.showHud(true);
    this.curRegion = -1; this.pendRegion = -1;
    this.autosaveT = 0;
    this.ui.setFade(1);
    this.fadeIn(1.0, () => {
      if (isNew || !S.introDone) {
        const sh = this.npcs.find((n) => n.id === 'shellby');
        if (sh) {
          sh.talkStart();
          this.player.facing = Math.atan2(sh.pos.x - this.player.pos.x, sh.pos.z - this.player.pos.z);
          this.ui.say(sh.def.intro, { name: sh.name, portrait: sh.key, onDone: () => { sh.talkEnd(); S.introDone = true; this.save(true); if (!S.controlsSeen) this.ui.openControls(false); } });
        }
      } else if (!S.controlsSeen) this.ui.openControls(false);
      else this.ui.toast('Welcome back, Pip!');
    });
    this.updateMusic(true);
  }
  resetEntities() {
    for (const e of this.enemies) e.remove();
    for (const p of this.projectiles) p.pop(false);
    for (const p of this.pickups) p.remove();
    for (const id in this.bosses) this.bosses[id].remove();
    this.enemies = []; this.projectiles = []; this.pickups = []; this.bosses = {};
    if (this.fight) this.endFight(true);
    this.fight = null; this.cutscene = null;
    this.fx.ground.clear();
    this.cam.bias = null; this.cam.clearShot();
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
    S.px = this.player.pos.x; S.pz = this.player.pos.z; S.facing = this.player.facing;
    if (this.fight && this.fight.phase !== 'won') { S.px = this.world.arenas[this.fight.id].outside.x; S.pz = this.world.arenas[this.fight.id].outside.z; }
    return S;
  }
  save(quiet) {
    if (this.state !== 'play' || !this.S) return;
    const ok = store.set(SAVE_KEY, this.saveData());
    if (ok && !quiet) this.ui.toast('✿ Saved');
  }
  saveAndQuit() {
    this.save(true);
    this.fadeOutIn(0.5, () => {
      this.resetEntities();
      this.state = 'title';
      this.ui.showHud(false);
      this.ui.setPrompt(null);
      this.ui.showTitle(this.hasSave(), (a) => (a === 'continue' ? this.continueGame() : this.newGame()));
      music('title');
    });
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
    for (const n of this.npcs) out.push({ x: n.pos.x, z: n.pos.z, r: n.r });
    if (this.fight && this.fight.boss && !this.fight.boss.dying && this.fight.boss.lift < 1) out.push({ x: this.fight.boss.pos.x, z: this.fight.boss.pos.z, r: this.fight.boss.r * 0.85 });
    for (const id in this.bosses) { const b = this.bosses[id]; if (b.state === 'sleep') out.push({ x: b.pos.x, z: b.pos.z, r: b.r }); }
    return out;
  }
  enemyColliders(e) {
    const out = this._edyn || (this._edyn = []);
    out.length = 0;
    for (const o of this.enemies) if (o !== e && o.alive && len2(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2) out.push({ x: o.pos.x, z: o.pos.z, r: o.r * 0.8 });
    return out;
  }
  dustColor(p) {
    const W = this.world;
    const i = clamp(Math.round(p.x + HALF), 0, N - 1), j = clamp(Math.round(p.z + HALF), 0, N - 1), k = j * N + i;
    if (W.splatB[k * 4] > 0.5) return 0xffffff;
    if (W.splatA[k * 4 + 3] > 0.5) return 0xf6e4b8;
    if (W.splatB[k * 4 + 1] > 0.4) return 0xd8b088;
    return 0xd8e0b0;
  }
  get playing() { return this.state === 'play' && !this.ui.dlg && !this.ui.shop && !this.ui.menu && !this.cutscene && !this.trans; }

  // ------------------------------------------------------------------ frame update
  frame(dt, rawDt) {
    const input = this.input;
    this.time += dt;
    U.uTime.value = this.time;
    if (this.state !== 'play') { this.updateTrans(rawDt); return 0; }
    this.updateTrans(rawDt);
    const ui = this.ui;
    // modal UI
    if (ui.dlg) ui.updateDialogue(dt, input);
    else if (ui.shop) ui.updateShop(input);
    else if (ui.menu) ui.menuInput(input);
    else if (!this.cutscene && !this.trans && this.player.state !== 'dizzy') this.gameplayInput(input);
    this.debugKeys(input);
    return 1;
  }
  gameplayInput(input) {
    const pl = this.player;
    if (input.pressed('pause')) { this.ui.openPause(); return; }
    if (input.pressed('map')) { this.ui.openMap(pl.pos, pl.facing, this.S); return; }
    if (input.pressed('potion')) this.drinkPotion();
    const tgt = this.target;
    if (tgt && (input.pressed('interact') || (input.pressed('attack') && pl.state === 'normal'))) {
      input.consume('attack');
      this.interact(tgt);
      return;
    }
    if (input.pressed('attack')) pl.attackBuffer = 0.16;
    if (input.pressed('dash')) pl.dashBuffer = 0.12;
  }
  drinkPotion() {
    const S = this.S;
    if (S.potions <= 0) { this.ui.toast('No potions! Miso sells them.'); sfx('error'); return; }
    if (S.hp >= S.maxHp) { this.ui.toast('Already full of hearts!'); sfx('error'); return; }
    S.potions--; S.hp = S.maxHp;
    sfx('potion');
    const p = this.player.pos;
    for (let i = 0; i < 14; i++) this.fx.sparkle(p.x, p.y + 0.6, p.z, pick([0xff9fb6, 0xffffff, 0xfff4a0]), 1, 0.6);
    this.ui.floater(_v.set(p.x, p.y + 1.4, p.z), 'Refreshed!', '#ffb6c8');
  }

  // ------------------------------------------------------------------ fixed step
  step(dt) {
    if (this.state !== 'play') return;
    const S = this.S;
    if (this.hitStopT > 0) { this.hitStopT -= dt; return; }
    const pl = this.player;
    const canAct = this.playing && pl.state !== 'dizzy' && !(this.fight && this.fight.phase === 'intro');
    const worldRuns = !this.ui.menu && !this.ui.shop;
    if (!worldRuns) return;
    if (!this.cutscene) S.tod = (S.tod + dt / CFG.dayLength) % 1;
    S.playTime += dt;
    pl.update(dt, this.input, this.cam, canAct);
    if (pl.state === 'dizzy') this.updateDizzy(dt);
    if (pl.attackActive) this.resolveSword();
    this.redFlash = Math.max(0, this.redFlash - dt * 2.2);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2.5);
    // entities
    const talking = !!this.ui.dlg;
    if (!talking) {
      for (const e of this.enemies) if (e.alive) e.update(dt);
      for (const e of this.enemies) if (!e.alive && !e.removed) this.killEnemy(e);
      this.enemies = this.enemies.filter((e) => !e.removed);
      for (const p of this.projectiles) if (p.alive) p.update(dt);
      this.projectiles = this.projectiles.filter((p) => p.alive);
      for (const p of this.pickups) if (p.alive) p.update(dt);
      this.pickups = this.pickups.filter((p) => p.alive);
      this.updateFight(dt);
    }
    for (const n of this.npcs) n.update(dt);
    if (this.cutscene) this.updateCutscene(dt);
    // spawning / despawning
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.playing && !this.fight) { this.spawnT = 1.3; trySpawnEnemy(this, this.camera); }
    for (const e of this.enemies) if (!e.minion && len2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z) > CFG.despawnDist) { e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    // regrowth
    for (const r of this.regrow) r.t -= dt;
    this.regrow = this.regrow.filter((r) => {
      if (r.t > 0) return true;
      const o = r.o;
      if (len2(o.x - pl.pos.x, o.z - pl.pos.z) < 12) { r.t = 5; return true; }
      o.cut = false;
      this.scenery.show(o);
      if (o.collider) o.collider.active = true;
      return false;
    });
    this.updateRegion(dt);
    this.updateAmbient(dt);
    this.autosaveT += dt;
    if (this.autosaveT > CFG.autosave && this.playing && !this.fight) { this.autosaveT = 0; this.save(true); }
  }

  // ------------------------------------------------------------------ combat
  resolveSword() {
    const pl = this.player;
    const S = this.S;
    const dmg = S.swordLevel >= 2 ? 2 : 1;
    const reach = pl.reach;
    const fx = Math.sin(pl.facing), fz = Math.cos(pl.facing);
    const inArc = (x, z, r) => {
      const dx = x - pl.pos.x, dz = z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > reach + r) return false;
      if (d < 0.7 + r * 0.5) return true;
      return (dx * fx + dz * fz) / (d || 1) > Math.cos((72 / 180) * Math.PI);
    };
    let hitSomething = false;
    for (const e of this.enemies) {
      if (!e.alive || e.lastSwing === pl.swingId) continue;
      const ey = e.pos.y + e.altCur + (e.hop || 0);
      if (ey - pl.pos.y > 2.1) continue;
      if (!inArc(e.pos.x, e.pos.z, e.r)) continue;
      e.lastSwing = pl.swingId;
      const res = e.hit(dmg, pl.pos.x, pl.pos.z);
      const hp = _v.set(e.pos.x, ey + 0.4, e.pos.z);
      if (res === 'clink') {
        sfx('hit'); this.fx.sparks(hp.x, hp.y + 0.2, hp.z, 6, 0xffffff);
        this.ui.floater(hp, 'Clink!', '#e8f4ff', 18);
        pl.vel.set(-fx * 4, -fz * 4);
        this.cam.shake(0.15);
      } else if (res) {
        hitSomething = true;
        sfx('hit');
        this.fx.sparks(hp.x, hp.y, hp.z, 9, S.swordLevel >= 2 ? 0xffe27a : 0xfff4b0);
      }
    }
    if (this.fight && this.fight.boss && !this.fight.boss.dying) {
      const b = this.fight.boss;
      if (b.lastSwing !== pl.swingId && inArc(b.pos.x, b.pos.z, b.r)) {
        b.lastSwing = pl.swingId;
        const res = b.hit(dmg, pl.pos.x, pl.pos.z);
        if (res) {
          hitSomething = true;
          sfx('bossHit');
          this.fx.sparks(b.pos.x - fx * b.r * 0.6, b.pos.y + 1.3, b.pos.z - fz * b.r * 0.6, 12, 0xfff4b0);
          this.ui.bossBar(b);
          this.hitStop(0.07);
        }
      }
    }
    for (const p of this.projectiles) {
      if (!p.alive || !p.poppable) continue;
      if (Math.abs(p.pos.y - pl.pos.y - 0.5) < 1.2 && inArc(p.pos.x, p.pos.z, p.r)) { p.pop(true); sfx('bubble'); hitSomething = true; }
    }
    // cuttables
    for (const o of this.nearCuttables(pl.pos.x, pl.pos.z, reach + 1)) {
      if (o.lastSwing === pl.swingId) continue;
      if (!inArc(o.x, o.z, o.cutKind === 'grass' ? 0.25 : 0.4)) continue;
      o.lastSwing = pl.swingId;
      this.cutObject(o);
    }
    if (hitSomething) { this.hitStop(0.05); this.cam.shake(0.22); }
  }
  cutObject(o) {
    o.cut = true;
    this.scenery.hide(o);
    if (o.collider) o.collider.active = false;
    const y = o.y ?? this.world.hAt(o.x, o.z);
    if (o.cutKind === 'grass') {
      sfx('bush');
      this.fx.leaves(o.x, y + 0.2, o.z, 6, [0x8bd65d, 0xa6e07a, 0x6cc04a, 0xc8e88a]);
      this.regrow.push({ o, t: CFG.grassRespawn + rand(0, 30) });
      this.maybeDrop(o.x, o.z, 0.06, 0.04);
    } else if (o.cutKind === 'bush') {
      sfx('bush');
      this.fx.leaves(o.x, y + 0.4, o.z, 14);
      this.regrow.push({ o, t: CFG.bushRespawn });
      this.maybeDrop(o.x, o.z, 0.25, 0.1);
    } else if (o.cutKind === 'pot') {
      sfx('pot');
      this.fx.shards(o.x, y, o.z, 12);
      this.fx.dust(o.x, y, o.z, 4, 0xe8c8a8);
      this.regrow.push({ o, t: CFG.potRespawn });
      this.maybeDrop(o.x, o.z, 0.5, 0.2);
    }
  }
  maybeDrop(x, z, pGem, pHeart) {
    const S = this.S;
    if (Math.random() < pGem) this.pickups.push(new Pickup('gem', x, z, { value: pick([1, 1, 1, 3, 5]) }));
    if (S.hp < S.maxHp && Math.random() < pHeart) this.pickups.push(new Pickup('heart', x, z));
  }
  hitStop(t) { this.hitStopT = Math.max(this.hitStopT, t); }
  playerHurt(dmg, fx, fz, knock = 7) {
    const pl = this.player;
    if (this.state !== 'play' || this.cutscene || pl.state === 'dizzy') return false;
    if (!pl.hurt(dmg, fx, fz, knock)) return false;
    const S = this.S;
    S.hp = Math.max(0, S.hp - dmg);
    sfx('hurt');
    this.cam.shake(0.45);
    this.redFlash = 1;
    this.hitStop(0.06);
    if (S.hp <= 0) this.playerDown();
    return true;
  }
  playerDown() {
    const pl = this.player;
    pl.state = 'dizzy';
    pl.dizzyT = 0;
    pl.iframes = 99;
    this.ui.setDizzy(true);
    sfx('death');
    if (this.ui.dlg) { this.ui.dlg = null; this.ui.dlgEl.classList.remove('show'); }
  }
  updateDizzy(dt) {
    const pl = this.player;
    pl.dizzyT += dt;
    if (Math.random() < 0.3) this.fx.sparkle(pl.pos.x + Math.sin(this.time * 8) * 0.5, pl.pos.y + 1.0, pl.pos.z + Math.cos(this.time * 8) * 0.5, 0xfff070, 1, 0.05);
    if (pl.dizzyT > 1.9 && !this.trans) {
      this.fadeOutIn(0.7, () => {
        const S = this.S;
        if (this.fight) this.endFight(true);
        for (const e of this.enemies) e.remove();
        for (const p of this.projectiles) p.pop(false);
        this.enemies = []; this.projectiles = [];
        S.hp = S.maxHp;
        const W = this.world;
        pl.place(W.spawn.x, W.spawn.z, Math.PI);
        pl.iframes = 1.5;
        this.cam.yawTarget = 0;
        this.cam.snap(pl.pos);
        this.ui.setDizzy(false);
        this.updateMusic(true);
      }, () => this.ui.toast('Pip woke up by the Great Tree.'));
    }
  }
  killEnemy(e) {
    e.removed = true;
    const y = e.pos.y + e.altCur + (e.hop || 0);
    const col = { slime: 0xc8f0a0, mushroom: 0xffd0c8, bat: 0xd8c0f0, bee: 0xfff0a0, crab: 0xffc8a0, snowpuff: 0xffffff }[e.type] || 0xffffff;
    this.fx.poof(e.pos.x, y + 0.2, e.pos.z, col, 12);
    sfx('enemyDie');
    this.cam.shake(0.25);
    e.remove();
    if (!e.minion || Math.random() < 0.5) {
      const S = this.S;
      if (Math.random() < 0.45) this.pickups.push(new Pickup('gem', e.pos.x, e.pos.z, { value: pick([1, 1, 3, 3, 5]) }));
      if (S.hp < S.maxHp && Math.random() < 0.15) this.pickups.push(new Pickup('heart', e.pos.x, e.pos.z));
    }
  }
  addEnemy(e) { this.enemies.push(e); }
  spawnProjectile(kind, x, y, z, ang, speed, o) { this.projectiles.push(new Projectile(kind, x, y, z, ang, speed, o)); }
  collect(p) {
    const S = this.S;
    const pp = this.player.pos;
    if (p.kind === 'gem') {
      S.coins += p.value;
      sfx('coin');
      this.fx.sparkle(pp.x, pp.y + 0.6, pp.z, 0xb8fff0, 3, 0.4);
      if (p.value > 1) this.ui.floater(_v.set(pp.x, pp.y + 1.2, pp.z), '+' + p.value, '#c8fbff', 18);
    } else if (p.kind === 'heart') {
      S.hp = Math.min(S.maxHp, S.hp + 2);
      sfx('heart');
      this.fx.sparkle(pp.x, pp.y + 0.6, pp.z, 0xff9fb6, 4, 0.4);
    } else if (p.kind === 'seed') {
      S.seeds[p.seedId] = 1;
      sfx('seed'); sfx('fanfare');
      const left = 3 - progress.found(S);
      this.itemGet(seedBuilt(SEEDS[p.seedId].color), SEEDS[p.seedId].key, [
        'You got the ' + SEEDS[p.seedId].name + '!',
        left > 0 ? 'Bring it to the pedestal by the Great Tree. ' + left + ' more to find!' : 'That\'s all three! Hurry back to the Great Tree!',
      ]);
      this.save(true);
      this.updateMusic(true);
    }
  }
  itemGet(built, portrait, lines, after) {
    const pl = this.player;
    pl.state = 'item';
    pl.vel.set(0, 0);
    pl.facing = Math.atan2(Math.sin(this.cam.yaw), Math.cos(this.cam.yaw));
    pl.held.clear();
    const mat = toonMat({ glow: true, glowBase: 0.4, rim: 0.6 });
    const g = meshWithOutline(built, mat, sharedOutline('char'));
    g.scale.setScalar(1.3);
    pl.held.add(g);
    this.fx.burst(pl.pos.x, pl.pos.y + 1.5, pl.pos.z, 0xfff4a0, 18, 4);
    this.ui.say(lines, { portrait, onDone: () => { pl.held.clear(); pl.state = 'normal'; this.ui.updateHud(this.S); if (after) after(); } });
  }

  // ------------------------------------------------------------------ interactions
  findTarget() {
    const pl = this.player;
    if (!this.playing || pl.state !== 'normal') return null;
    let best = null, bd = Infinity;
    const fx = Math.sin(pl.facing), fz = Math.cos(pl.facing);
    const consider = (o, x, z, r, label, h, y) => {
      const dx = x - pl.pos.x, dz = z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > r) return;
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (facing < -0.25 && d > 1.0) return;
      const score = d - facing * 0.6;
      if (score < bd) { bd = score; best = { o, label, x, z, y, h }; }
    };
    for (const n of this.npcs) consider(n, n.pos.x, n.pos.z, 1.9, n.def.shop ? 'Shop' : 'Talk', 1.55, n.pos.y);
    for (const it of this.world.interact) {
      if (Math.abs(it.x - pl.pos.x) > 3 || Math.abs(it.z - pl.pos.z) > 3) continue;
      if (it.kind === 'chest' && this.S.chests[it.chest.id]) continue;
      const lbl = { sign: 'Read', door: 'Knock', chest: 'Open', pedestal: progress.carried(this.S) > 0 ? 'Place' : 'Look', well: 'Peek' }[it.kind];
      consider(it, it.x, it.z, it.r, lbl, it.h, it.y);
    }
    return best;
  }
  interact(t) {
    const o = t.o;
    const pl = this.player;
    pl.vel.set(0, 0);
    pl.facing = Math.atan2(t.x - pl.pos.x, t.z - pl.pos.z);
    if (o instanceof NPC) return this.talkTo(o);
    switch (o.kind) {
      case 'sign': sfx('talk'); this.ui.say(o.lines, { name: 'Sign' }); break;
      case 'door': sfx('door'); this.ui.say(o.lines, {}); break;
      case 'well': sfx('splash'); this.ui.say(o.lines, {}); break;
      case 'chest': this.openChest(o.chest); break;
      case 'pedestal': this.usePedestal(); break;
    }
  }
  talkTo(npc) {
    sfx('talk');
    npc.talkStart();
    const S = this.S;
    const lines = npc.def.lines(S);
    this.ui.say(lines, {
      name: npc.name, portrait: npc.key,
      onDone: () => {
        if (npc.def.shop) this.ui.openShop(S, (it) => this.buy(it), () => { npc.talkEnd(); this.ui.updateHud(S); this.save(true); });
        else npc.talkEnd();
      },
    });
  }
  buy(it) {
    const S = this.S;
    S.coins -= it.price;
    let msg = '';
    if (it.id === 'potion') { S.potions++; msg = 'A potion! Bottoms up, later.'; }
    if (it.id === 'heart') { S.shopHeart = true; S.maxHp = Math.min(CFG.maxHp, S.maxHp + 2); S.hp = S.maxHp; msg = 'Max hearts +1! Purr-fect.'; sfx('fanfare'); }
    if (it.id === 'sword') { S.swordLevel = 2; this.player.setSword(2); msg = 'The Shiny Sword! Swish swish~'; sfx('fanfare'); }
    this.ui.updateHud(S);
    return msg;
  }
  openChest(c) {
    const S = this.S;
    if (S.chests[c.id]) return;
    S.chests[c.id] = true;
    this.scenery.setChestOpen(c.id, true);
    sfx('chest');
    this.fx.burst(c.x, c.y + 0.8, c.z, 0xfff4a0, 16, 3);
    this.player.frozen = true;
    setTimeout(() => {
      this.player.frozen = false;
      if (this.state !== 'play') return;
      if (c.kind === 'heart') {
        sfx('fanfare');
        S.maxHp = Math.min(CFG.maxHp, S.maxHp + 2);
        S.hp = S.maxHp;
        this.itemGet(heartContainerBuilt(), 'heart_container', ['You found a Heart Container!', 'Your max hearts grew by one, and you feel all warm and full.'], () => this.ui.bumpHearts());
      } else {
        const n = Math.max(2, Math.round(c.amount / 5));
        for (let i = 0; i < n; i++) this.pickups.push(new Pickup('gem', c.x, c.z, { value: 5, vy: rand(5, 8), spread: rand(1, 2.4) }));
        this.ui.floater(_v.set(c.x, c.y + 1.5, c.z), '+' + n * 5 + ' gems!', '#bff6ff', 22);
      }
      this.save(true);
    }, 420);
  }
  usePedestal() {
    const S = this.S;
    const carried = SEED_ORDER.filter((id) => S.seeds[id] === 1);
    const placed = progress.placed(S);
    if (!carried.length) {
      if (placed >= 3) this.ui.say(['The three Starseeds hum happily in their sockets. The Great Tree is thriving!'], { name: 'Pedestal' });
      else this.ui.say(['A mossy stone pedestal with three little star-shaped sockets.', placed + ' of 3 Starseeds are home. ' + (placed === 0 ? 'The grumpy guardians still have them...' : 'Find the rest, Pip!')], { name: 'Pedestal' });
      return;
    }
    this.cutscene = { type: 'place', t: 0, queue: carried.slice(), cur: null };
    this.player.state = 'frozen';
    const W = this.world;
    this.cam.setShot(new THREE.Vector3(W.pedestal.x + 2.5, W.plaza.h + 5, W.pedestal.z + 8), new THREE.Vector3(W.pedestal.x, W.plaza.h + 1.4, W.pedestal.z), { speed: 1.6 });
  }
  updateCutscene(dt) {
    const c = this.cutscene;
    c.t += dt;
    const W = this.world;
    if (c.type === 'place') {
      if (!c.cur && c.t > 0.5) {
        const id = c.queue.shift();
        if (!id) {
          // done
          this.cutscene = null;
          this.player.state = 'normal';
          this.cam.clearShot();
          const placed = progress.placed(this.S);
          this.save(true);
          if (placed >= 3) this.startEnding();
          else this.ui.say(['The Great Tree rustles happily and perks up a little!', (3 - placed) + ' more Starseed' + (3 - placed === 1 ? '' : 's') + ' to go.'], {});
          return;
        }
        const i = SEED_ORDER.indexOf(id);
        const mesh = meshWithOutline(seedBuilt(SEEDS[id].color), toonMat({ glow: true }), sharedOutline('char'));
        const from = this.player.pos.clone(); from.y += 1.4;
        this.scene.add(mesh);
        c.cur = { id, i, mesh, from, t: 0 };
        sfx('seed');
      }
      if (c.cur) {
        const cu = c.cur;
        cu.t += dt;
        const k = Math.min(1, cu.t / 0.9);
        const to = this.pedSeeds[cu.i].position;
        cu.mesh.position.lerpVectors(cu.from, to, Ease.inOutSine(k));
        cu.mesh.position.y += Math.sin(k * Math.PI) * 1.5;
        cu.mesh.rotation.y += dt * 8;
        if (Math.random() < 0.6) this.fx.sparkle(cu.mesh.position.x, cu.mesh.position.y, cu.mesh.position.z, SEEDS[cu.id].glow, 1, 0.2);
        if (k >= 1) {
          this.scene.remove(cu.mesh);
          this.S.seeds[cu.id] = 2;
          this.pedSeeds[cu.i].visible = true;
          this.fx.burst(to.x, to.y, to.z, SEEDS[cu.id].glow, 22, 4);
          sfx('place');
          this.cam.shake(0.3);
          this.ui.updateHud(this.S);
          c.cur = null;
          c.t = 0;
        }
      }
    } else if (c.type === 'ending') {
      const T = W.greatTree;
      if (c.stage === 0 && c.t > 1.8) {
        c.stage = 1;
        this.scenery.setBloom(true);
        this.treeSeeds.forEach((g) => (g.visible = this.treeSeedsWanted()));
        sfx('bloom');
        music('ending');
        this.whiteFlash = 0.9;
        this.cam.shake(0.5);
        const th = this.scenery.greatTree.height;
        for (let i = 0; i < 6; i++) this.fx.burst(T.x + rand(-th * 0.35, th * 0.35), T.y + rand(th * 0.55, th * 0.92), T.z + rand(-th * 0.35, th * 0.35), pick([0xffc2d9, 0xfff4a0, 0xffffff]), 20, 6);
      }
      if (c.stage >= 1) {
        const th = this.scenery.greatTree.height;
        this.fx.petals(T.x, T.y + th * 0.6, T.z, 3, th * 0.6);
        if (Math.random() < 0.5) this.fx.sparkle(T.x + rand(-th * 0.4, th * 0.4), T.y + rand(th * 0.45, th), T.z + rand(-th * 0.4, th * 0.4), pick([0xfff4a0, 0xffc2d9]), 1, 0.2);
      }
      if (c.stage === 1 && c.t > 5) { c.stage = 2; this.ui.openEnding(); }
    }
  }
  startEnding() {
    const W = this.world;
    const T = W.greatTree;
    this.cutscene = { type: 'ending', t: 0, stage: 0 };
    this.player.state = 'frozen';
    const th = this.scenery.greatTree.height;
    this.cam.setShot(new THREE.Vector3(T.x + 3, T.y + th * 0.55, T.z + th * 1.85), new THREE.Vector3(T.x, T.y + th * 0.5, T.z), { speed: 0.9 });
    this.ui.showHud(false);
  }
  finishEnding() {
    this.cutscene = null;
    this.player.state = 'normal';
    this.cam.clearShot();
    this.ui.showHud(true);
    this.S.ending = true;
    this.save(false);
  }

  // ------------------------------------------------------------------ boss fights
  updateFight(dt) {
    const pl = this.player;
    // trigger
    if (!this.fight && pl.state !== 'dizzy') {
      for (const id in this.bosses) {
        const b = this.bosses[id], a = this.world.arenas[id];
        if (len2(pl.pos.x - a.x, pl.pos.z - a.z) < a.r - 2.5 && b.state === 'sleep') { this.startFight(id); break; }
      }
    }
    // idle bosses (asleep)
    for (const id in this.bosses) { const b = this.bosses[id]; if (!this.fight || this.fight.boss !== b) b.update(dt); }
    for (const id in this.vines) {
      const v = this.vines[id];
      v.k += (v.target - v.k) * Math.min(1, dt * 4);
      v.g.visible = v.k > 0.02;
      v.g.scale.set(1, Math.max(0.01, v.k), 1);
    }
    const f = this.fight;
    if (!f) return;
    f.t += dt;
    const b = f.boss;
    if (f.phase === 'intro') {
      b.update(dt);
      // walk Pip a few steps into the arena so the vine wall is behind the camera framing
      const a = f.arena, dx = a.x - pl.pos.x, dz = a.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > a.r - 6 && f.t < 2.0) { pl.autoMove = { x: (dx / d) * 3.4, z: (dz / d) * 3.4 }; pl.facing = Math.atan2(dx, dz); } else pl.autoMove = null;
      if (f.t > 2.4) {
        f.phase = 'fight';
        pl.autoMove = null;
        pl.state = 'normal';
        this.cam.clearShot();
        this.ui.showBossCard('', '', false);
        this.ui.bossBar(b);
      }
    } else if (f.phase === 'fight') {
      b.update(dt);
      // shockwaves
      for (const r of f.rings) {
        if (!r.active) continue;
        const d = len2(pl.pos.x - r.cx, pl.pos.z - r.cz);
        if (Math.abs(d - r.r) < r.width && !pl.invulnerable) this.playerHurt(2, r.cx, r.cz, 8);
      }
      f.rings = f.rings.filter((r) => r.active);
      this.cam.bias = { x: (pl.pos.x + b.pos.x) / 2, z: (pl.pos.z + b.pos.z) / 2, y: pl.pos.y + 0.6, w: 0.35, dist: 13.5, pitch: 1.02 };
    } else if (f.phase === 'won') {
      f.wonT += dt;
      if (f.wonT > 2.5 && this.vines[f.id].target) { this.vines[f.id].target = 0; sfx('door'); }
      if (f.wonT > 3.2) { this.fight = null; this.cam.bias = null; this.updateMusic(true); }
    }
  }
  startFight(id) {
    const a = this.world.arenas[id];
    const b = this.bosses[id];
    this.fight = { id, arena: a, boss: b, phase: 'intro', t: 0, rings: [], arenaClamp: { x: a.x, z: a.z, r: a.r - 0.3 } };
    b.wake();
    const pl = this.player;
    pl.state = 'frozen';
    pl.vel.set(0, 0);
    this.vines[id].target = 1;
    sfx('door');
    music('boss');
    // despawn regular enemies nearby
    for (const e of this.enemies) if (!e.minion) { e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    // camera frames the boss from the player's side
    const dx = pl.pos.x - b.pos.x, dz = pl.pos.z - b.pos.z, l = Math.hypot(dx, dz) || 1;
    const cpos = new THREE.Vector3(b.pos.x + (dx / l) * 9 + (dz / l) * 2.5, a.h + 4.5, b.pos.z + (dz / l) * 9 - (dx / l) * 2.5);
    this.cam.setShot(cpos, new THREE.Vector3(b.pos.x, a.h + b.height * 0.55, b.pos.z), { speed: 2 });
    this.ui.showBossCard(BOSSES[id].name, BOSSES[id].title, true);
    setTimeout(() => this.ui.showBossCard('', '', false), 2600);
  }
  addShockwave(x, y, z, o) {
    if (!this.fight) return;
    const r = this.fx.ground.shockwave(x, y, z, o);
    this.fight.rings.push(r);
  }
  onBossDefeated(b) {
    const f = this.fight;
    const S = this.S;
    S.bosses[b.id] = true;
    delete this.bosses[b.id];
    if (f) { f.phase = 'won'; f.wonT = 0; }
    this.ui.bossBar(null);
    this.whiteFlash = 0.8;
    for (const e of this.enemies) if (e.minion) { this.fx.poof(e.pos.x, e.pos.y, e.pos.z, 0xffffff, 8); e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    for (const p of this.projectiles) p.pop(true);
    this.projectiles = [];
    const a = this.world.arenas[b.id];
    this.pickups.push(new Pickup('seed', b.pos.x, b.pos.z, { seedId: b.id, color: SEEDS[b.id].color, vy: 7, spread: 0, y0: 1.2 }));
    this.save(true);
  }
  endFight(reset) {
    const f = this.fight;
    if (!f) return;
    for (const r of f.rings) this.fx.ground.remove(r);
    if (reset && f.boss && !this.S.bosses[f.id]) {
      f.boss.remove();
      this.bosses[f.id] = new Boss(f.id, f.arena);
    }
    for (const e of this.enemies) if (e.minion) { e.remove(); e.removed = true; }
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.vines[f.id].target = 0;
    this.fight = null;
    this.cam.bias = null;
    this.cam.clearShot();
    this.ui.bossBar(null);
    this.ui.showBossCard('', '', false);
  }

  // ------------------------------------------------------------------ region / music / ambient
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
        if (!first || !this.S.visited[r]) this.ui.showBanner(R.name, R.sub);
        this.S.visited[r] = true;
        this.updateMusic();
      }
    }
  }
  updateMusic(force) {
    if (this.fight && this.fight.phase !== 'won') return;
    const R = REGIONS[this.curRegion < 0 ? this.world.regionAt(this.player.pos.x, this.player.pos.z) : this.curRegion];
    if (this.S && this.S.ending && R.id === 'village') { music('ending'); return; }
    music(R ? R.music : 'village');
  }
  updateAmbient(dt) {
    const pl = this.player;
    const fx = this.fx;
    const W = this.world;
    const reg = this.curRegion;
    const night = this.sky.night;
    const P = pl.pos;
    const rnd = (s) => rand(-s, s);
    const id = REGIONS[reg] ? REGIONS[reg].ambient : null;
    const N_ = fx.norm, A = fx.add;
    if (id === 'leaves' && N_.count('amb') < 40 && Math.random() < dt * 9) {
      N_.spawn({ x: P.x + rnd(14), y: P.y + rand(5, 9), z: P.z + rnd(12), vx: rand(-0.3, 0.6), vy: rand(-1.1, -0.6), vz: rand(-0.2, 0.4), life: 8, size: rand(0.16, 0.24), color: pick([0x7ccf55, 0xa6d94f, 0xe3b24f, 0x5fae46, 0xd98a3a]), shape: SHAPE.LEAF, vr: rand(-3, 3), sway: 1.2, tag: 'amb', fadeIn: 0.6 });
    }
    if (id === 'snow' && N_.count('amb') < 120 && Math.random() < dt * 40) {
      N_.spawn({ x: P.x + rnd(16), y: P.y + rand(4, 10), z: P.z + rnd(14), vx: rand(-0.8, -0.2), vy: rand(-1.6, -0.9), life: 7, size: rand(0.06, 0.13), color: 0xffffff, shape: SHAPE.DOT, sway: 0.5, tag: 'amb', fadeIn: 0.5 });
    }
    if (id === 'butterflies') {
      if (N_.count('bfly') < 7 && Math.random() < dt * 1.2) {
        N_.spawn({ x: P.x + rnd(12), y: P.y + rand(0.6, 2), z: P.z + rnd(10), life: rand(8, 12), size: 0.26, color: pick([0xffb3d1, 0xfff08a, 0xb8e0ff, 0xffffff, 0xffc890]), shape: SHAPE.LEAF, wander: 3, flutter: 16, tag: 'bfly', fadeIn: 0.8 });
      }
      if (N_.count('amb') < 25 && Math.random() < dt * 3) fx.petals(P.x, P.y + 3, P.z, 1, 12);
    }
    if (id === 'fluff' && N_.count('amb') < 25 && Math.random() < dt * 3) {
      N_.spawn({ x: P.x + rnd(14), y: P.y + rand(0.5, 4), z: P.z + rnd(12), vx: rand(0.2, 0.7), vy: rand(0.05, 0.3), life: rand(6, 9), size: rand(0.08, 0.13), color: 0xffffff, shape: SHAPE.DOT, sway: 0.4, wander: 0.4, tag: 'amb', fadeIn: 0.8, alpha: 0.85 });
    }
    if (id === 'sea') {
      if (A.count('amb') < 30 && Math.random() < dt * 14) {
        const x = P.x + rnd(16), z = P.z + rnd(14);
        if (W.hAt(x, z) < -0.25) A.spawn({ x, y: 0.12, z, life: rand(0.5, 1.0), size: rand(0.2, 0.4), size1: 0.02, color: 0xffffff, shape: SHAPE.STAR, tag: 'amb', fadeIn: 0.2 });
      }
      if (N_.count('gull') < 2 && Math.random() < dt * 0.15) {
        const side = Math.random() < 0.5 ? -1 : 1;
        N_.spawn({ x: P.x - side * 22, y: P.y + 0.15, z: P.z + rnd(8), vx: side * rand(5, 7), vz: rand(-1, 1), life: 8, size: 1.6, color: 0x2a3040, alpha: 0.16, shape: SHAPE.SOFT, tag: 'gull', fadeIn: 0.5 });
      }
    }
    if (night > 0.35 && reg !== REGION.PEAKS && A.count('fly') < 26 && Math.random() < dt * 5 * night) {
      const x = P.x + rnd(14), z = P.z + rnd(12);
      A.spawn({ x, y: W.hAt(x, z) + rand(0.4, 1.8), z, life: rand(4, 7), size: rand(0.16, 0.26), color: pick([0xe8ff8a, 0xfff4a0, 0xb8ff9a]), shape: SHAPE.SOFT, wander: 1.2, flutter: 3, tag: 'fly', fadeIn: 1 });
    }
    if (this.S.ending && reg === REGION.VILLAGE && N_.count('amb') < 40 && Math.random() < dt * 4) fx.petals(P.x, P.y + 4, P.z, 1, 12);
    // pedestal seed sparkles
    for (let i = 0; i < 3; i++) if (this.pedSeeds[i].visible && Math.random() < dt * 3) { const p = this.pedSeeds[i].position; fx.sparkle(p.x, p.y, p.z, SEEDS[SEED_ORDER[i]].glow, 1, 0.3); }
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
    for (const p of this.projectiles) p.render(t);
    for (const p of this.pickups) p.render(t);
    this.scenery.update(dt);
    // pedestal seeds bob
    this.pedSeeds.forEach((g, i) => { g.rotation.set(-0.5, Math.sin(t * 1.2 + i) * 0.6, 0, 'YXZ'); g.position.y = this.world.plaza.h + 1.15 + Math.sin(t * 2 + i) * 0.08; });
    this.treeSeeds.forEach((g, i) => { g.rotation.set(-0.3, Math.sin(t + i) * 0.5, 0, 'YXZ'); });
    // blob shadows
    const B = this.blobs;
    B.begin();
    B.add(pl.root.position.x, pl.pos.y, pl.root.position.z, 0.38);
    for (const e of this.enemies) B.add(e.root.position.x, e.pos.y, e.root.position.z, e.r * (e.def.flying ? 0.8 : 1.05));
    for (const n of this.npcs) B.add(n.root.position.x, n.pos.y, n.root.position.z, 0.45);
    for (const id in this.bosses) { const b = this.bosses[id]; B.add(b.root.position.x, b.arena.h, b.root.position.z, b.r * (1.1 - Math.min(0.5, b.lift * 0.08))); }
    for (const p of this.pickups) if (p.kind !== 'seed') B.add(p.pos.x, p.ground ?? p.pos.y, p.pos.z, 0.18);
    B.end();
    // sky & lights
    const h = this.S.tod * 24;
    this.sky.update(h, pl.root.position, this.camera, this.world.lamps, dt, t);
    // water light tint follows the hemisphere/sun
    const wl = this.waterMat.uniforms.uLight.value;
    wl.copy(this.sky.hemi.color).multiplyScalar(0.55).add(_c.copy(this.sky.sun.color).multiplyScalar(0.45 * Math.min(1, this.sky.sun.intensity / 2.6))).multiplyScalar(1.0);
    this.waterMat.uniforms.uSunCol.value.copy(this.sky.sun.color);
    // camera
    const allow = this.playing || this.ui.dlg;
    this.cam.update(dt, pl.root.position, pl.vel, this.input, allow && !this.cutscene);
    this.camera.updateMatrixWorld();
    this.cam.updateOcclusion(this.renderer, pl.root.position, !this.cutscene);
    U.uPip.value.copy(pl.root.position);
    this.frustum.setFromProjectionMatrix(_m.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    // UI
    this.target = this.findTarget();
    if (this.target) this.ui.setPrompt(_v2.set(this.target.x, (this.target.y ?? pl.pos.y) + this.target.h, this.target.z), this.target.label, this.camera);
    else this.ui.setPrompt(null);
    this.ui.updateHud(this.S);
    this.ui.updateFloaters(dt, this.camera);
    if ((this._mmT = (this._mmT || 0) + 1) % 2 === 0) this.ui.drawMinimap(pl.root.position, pl.facing, this.cam.yaw, this.S);
    this.ui.setVignette(capFlash(this.redFlash * 0.9, G.settings) + (this.S.hp <= 2 && this.S.hp > 0 ? 0.25 + Math.sin(t * 5) * 0.1 : 0));
    this.ui.setFlash(capFlash(this.whiteFlash, G.settings));
    if (this.fight && this.fight.phase === 'fight') this.ui.bossBar(this.fight.boss);
    this.updateDebug(dt);
  }

  // ------------------------------------------------------------------ debug
  setupDebug() {
    const game = this;
    G.debug = {
      teleport(x, z) { const p = game.player; const y = game.world.ground(x, z); p.pos.set(x, y, z); p.prev.copy(p.pos); game.cam.snap(p.pos); return [x, y, z]; },
      giveSeeds() { for (const id of SEED_ORDER) { if (!game.S.seeds[id]) game.S.seeds[id] = 1; game.S.bosses[id] = true; if (game.bosses[id]) { game.bosses[id].remove(); delete game.bosses[id]; } } game.pickups.filter((p) => p.kind === 'seed').forEach((p) => p.remove()); game.ui.updateHud(game.S, true); game.ui.toast('Got all seeds (debug)'); },
      setTime(h) { game.S.tod = (((h % 24) + 24) % 24) / 24; return h; },
      killBoss() { const f = game.fight; if (f && f.boss && !f.boss.dying) { if (f.phase === 'intro') { f.phase = 'fight'; game.cam.clearShot(); game.player.state = 'normal'; } f.boss.hp = 0; f.boss.startDying(); return true; } return false; },
      toBoss() { return game.debugToBoss(); },
      spawn(type, dist = 4) { const p = game.player; const a = Math.random() * TAU; const e = new Enemy(type, p.pos.x + Math.sin(a) * dist, p.pos.z + Math.cos(a) * dist); e.spawnT = 1; game.addEnemy(e); return type; },
      info() { return { pos: game.player.pos.toArray().map((v) => +v.toFixed(2)), region: REGIONS[game.curRegion] && REGIONS[game.curRegion].id, calls: game.renderer.info.render.calls, tris: game.renderer.info.render.triangles, fps: Math.round(game.fps || 0), enemies: game.enemies.length, unreachable: game.world.unreachable.length }; },
      world: () => game.world,
      game: () => game,
    };
  }
  debugToBoss() {
    const pl = this.player;
    let best = null, bd = Infinity;
    for (const id of SEED_ORDER) {
      if (this.S.bosses[id]) continue;
      const a = this.world.arenas[id];
      const d = len2(a.x - pl.pos.x, a.z - pl.pos.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { this.ui.toast('All bosses beaten!'); return null; }
    G.debug.teleport(best.outside.x, best.outside.z);
    this.player.facing = Math.atan2(best.x - best.outside.x, best.z - best.outside.z);
    this.cam.yawTarget = this.player.facing + Math.PI;
    this.cam.snap(this.player.pos);
    return best.id;
  }
  debugKeys(input) {
    if (input.keyPressed('Backquote')) { G.debugOn = !G.debugOn; if (!G.debugOn) { this.ui.setDebug(null); this.setGizmos(false); } }
    if (!G.debugOn || this.state !== 'play' || !this.playing) return;
    const tp = { Digit1: 'village', Digit2: 'woods', Digit3: 'peaks', Digit4: 'shores', Digit5: 'meadow' };
    for (const k in tp) if (input.keyPressed(k)) {
      const id = tp[k];
      const W = this.world;
      let p = W.spawn;
      if (id !== 'village') { const pts = W.paths[id]; p = pts[Math.round(pts.length * (id === 'meadow' ? 0.85 : 0.55))]; }
      G.debug.teleport(p.x, p.z);
      this.ui.toast('Teleport: ' + id);
    }
    if (input.keyPressed('KeyG')) { this.S.coins += 100; this.ui.toast('+100 gems (debug)'); }
    if (input.keyPressed('KeyH')) { this.S.hp = this.S.maxHp; this.ui.toast('Healed (debug)'); }
    if (input.keyPressed('KeyB')) this.debugToBoss();
    if (input.keyPressed('KeyN')) { this.S.tod = (this.S.tod + 0.125) % 1; this.ui.toast('Time ' + (this.S.tod * 24).toFixed(1) + 'h'); }
    if (input.keyPressed('KeyC')) this.setGizmos(!this.gizmosOn);
  }
  setGizmos(on) {
    this.gizmosOn = on;
    if (this.debugGizmo) { this.scene.remove(this.debugGizmo); this.debugGizmo.geometry.dispose(); this.debugGizmo = null; }
  }
  rebuildGizmos() {
    if (this.debugGizmo) { this.scene.remove(this.debugGizmo); this.debugGizmo.geometry.dispose(); }
    const pl = this.player.pos;
    const pts = [];
    const circle = (x, z, r, y) => { const n = 16; for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU; pts.push(x + Math.sin(a0) * r, y, z + Math.cos(a0) * r, x + Math.sin(a1) * r, y, z + Math.cos(a1) * r); } };
    const list = [];
    this.world.nearColliders(pl.x, pl.z, 22, list);
    for (const c of list) circle(c.x, c.z, c.r, this.world.ground(c.x, c.z) + 0.15);
    for (const id in this.world.arenas) { const a = this.world.arenas[id]; if (len2(a.x - pl.x, a.z - pl.z) < 60) circle(a.x, a.z, a.r, a.h + 0.2); }
    circle(pl.x, pl.z, this.player.r, pl.y + 0.15);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.debugGizmo = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff2060, depthTest: false }));
    this.debugGizmo.renderOrder = 99;
    this.scene.add(this.debugGizmo);
  }
  updateDebug(dt) {
    if (!G.debugOn) return;
    if (this.gizmosOn) { this._gzT = (this._gzT || 0) - dt; if (this._gzT <= 0) { this._gzT = 0.4; this.rebuildGizmos(); } }
    const info = this.renderer.info;
    const pl = this.player.pos;
    const R = REGIONS[this.curRegion];
    this.ui.setDebug([
      `FPS ${Math.round(this.fps || 0)}  frame ${(this.frameMs || 0).toFixed(1)}ms  calls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k  geo ${info.memory.geometries} tex ${info.memory.textures}`,
      `${R ? R.name : '-'}  pos ${pl.x.toFixed(1)}, ${pl.y.toFixed(1)}, ${pl.z.toFixed(1)}  slope ${this.world.slopeAt(pl.x, pl.z).toFixed(2)}  tod ${(this.S.tod * 24).toFixed(1)}h`,
      `enemies ${this.enemies.length}  proj ${this.projectiles.length}  pickups ${this.pickups.length}  particles ${this.fx.norm.list.length}+${this.fx.add.list.length}  unreachable ${this.world.unreachable.length}  carved ${this.world.carved}`,
      `keys: 1-5 teleport  G +100 gems  H heal  B boss  N +3h  C colliders  \` hide`,
    ].join('\n'));
  }
}
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
