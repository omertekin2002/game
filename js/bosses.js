// Boss AI: Grumble Shroom (woods), Captain Pinch (shores), Frostbun (peaks). GLB model if present, else procedural.
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { BOSSES } from './data.js';
import { makeModel } from './assets.js';
import { instRig, bossDef } from './models.js';
import { Enemy } from './entities.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, rand, TAU, len2, angDiff, Ease } from './util.js';

export class Boss {
  constructor(id, arena) {
    this.id = id;
    this.def = BOSSES[id];
    this.arena = arena;
    this.maxHp = this.def.hp;
    this.hp = this.maxHp;
    this.r = id === 'shores' ? 1.55 : 1.35;
    this.pos = new THREE.Vector3(arena.x, arena.h, arena.z);
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector2();
    this.facing = arena.entAng; // look toward the entrance
    this.prevFacing = this.facing;
    this.state = 'sleep'; this.st = 0; this.t = 0;
    this.iframes = 0; this.flash = 0; this.squash = 0; this.lift = 0;
    this.cool = 2.0; this.dead = false; this.dying = false;
    this.hits = [];
    this.root = new THREE.Group();
    const glb = makeModel(this.def.key, { outline: 'prop' });
    if (glb) { this.root.add(glb.group); this.mats = glb.materials; this.nodes = {}; this.height = glb.height; this.glb = true; }
    else {
      const r = instRig(bossDef(id), { outline: 'prop' });
      this.root.add(r.root);
      this.nodes = r.nodes; this.mats = r.mats;
      this.height = id === 'woods' ? 3.4 : id === 'shores' ? 2.4 : 4.2;
    }
    this.root.position.copy(this.pos);
    G.scene.add(this.root);
  }
  get enraged() { return this.hp <= this.maxHp / 2; }
  get speedK() { return this.enraged ? 1.4 : 1; }
  dist() { const p = G.player.pos; return len2(p.x - this.pos.x, p.z - this.pos.z); }
  dirTo() { const p = G.player.pos; return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  clampArena(margin = 1.2) {
    const a = this.arena, dx = this.pos.x - a.x, dz = this.pos.z - a.z, d = len2(dx, dz);
    const lim = a.r - this.r - margin + 1.2;
    if (d > lim) { this.pos.x = a.x + (dx / d) * lim; this.pos.z = a.z + (dz / d) * lim; return true; }
    return false;
  }
  edgeDist() { const a = this.arena; return a.r - len2(this.pos.x - a.x, this.pos.z - a.z); }
  set(state, st) { this.state = state; this.st = st; this.stT = 0; }
  wake() { this.set('intro', 2.0); }

  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.t += dt;
    this.st -= dt; this.stT = (this.stT || 0) + dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.squash *= Math.exp(-7 * dt);
    if (this.dying) return this.updateDying(dt);
    if (this.state === 'sleep') return;
    if (this.state === 'intro') {
      this.facing = dampAngle(this.facing, this.dirTo(), 5, dt);
      if (this.stT > 0.6 && this.stT < 0.65 + dt) { this.squash = -0.8; sfx('stomp'); G.cam.shake(0.6); }
      if (this.st <= 0) this.set('walk', 0.5);
      return;
    }
    if (G.player.state === 'dizzy') { this.vel.multiplyScalar(0.9); return; }
    if (this.id === 'woods') this.aiShroom(dt);
    else if (this.id === 'shores') this.aiCrab(dt);
    else this.aiFrost(dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    const hitEdge = this.clampArena();
    if (hitEdge && this.onEdge) this.onEdge();
    this.pos.y = this.arena.h + this.lift;
    // contact damage
    const pl = G.player;
    const d = this.dist();
    if (d < this.r + pl.r + 0.15 && this.lift < 1.2 && this.state !== 'stunned') G.game.playerHurt(2, this.pos.x, this.pos.z, 9);
  }
  pickAttack(table) {
    const tot = table.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * tot;
    for (const [n, w] of table) { r -= w; if (r <= 0) return n; }
    return table[0][0];
  }

  // ---------------------------------------------------------------- Grumble Shroom
  aiShroom(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 4, dt);
        const sp = d > 2.4 ? 1.6 * k : 0;
        this.vel.set(Math.sin(this.facing) * sp, Math.cos(this.facing) * sp);
        this.cool -= dt;
        if (this.cool <= 0) {
          const minions = G.game.enemies.filter((e) => e.minion && e.alive).length;
          const atk = this.pickAttack([['stomp', 45], ['spores', 35], ['summon', minions < 2 ? 20 : 0]]);
          this.vel.set(0, 0);
          if (atk === 'stomp') this.set('stompCrouch', 0.55);
          else if (atk === 'spores') this.set('sporeWind', 0.55);
          else this.set('summon', 0.9);
        }
        break;
      }
      case 'stompCrouch':
        this.squash = Math.min(1, this.squash + dt * 4);
        this.facing = dampAngle(this.facing, toP, 6, dt);
        if (this.st <= 0) this.set('stompAir', 0.5);
        break;
      case 'stompAir': {
        const kk = 1 - this.st / 0.5;
        this.lift = Math.sin(kk * Math.PI) * 2.2;
        if (this.st <= 0) {
          this.lift = 0; this.squash = 1.2;
          G.cam.shake(0.9); sfx('stomp');
          G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 16, 0xd8c8a8);
          G.game.addShockwave(this.pos.x, this.arena.h, this.pos.z, { speed: 6.5 * (this.enraged ? 1.2 : 1), max: this.arena.r + 1 });
          this.set('recover', 0.8 / k);
          this.echo = this.enraged ? 0.6 : 0;
        }
        break;
      }
      case 'sporeWind':
        this.facing = dampAngle(this.facing, toP, 8, dt);
        this.squash = -Math.sin((this.stT / 0.55) * Math.PI) * 0.5;
        if (this.st <= 0) {
          const n = this.enraged ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = this.facing + (i - (n - 1) / 2) * 0.24;
            G.game.spawnProjectile('spore', this.pos.x + Math.sin(a) * 1.4, this.arena.h + 1.2, this.pos.z + Math.cos(a) * 1.4, a, 4.2, { scale: 1.3, r: 0.3 });
          }
          sfx('shoot');
          this.set('recover', 0.7 / k);
        }
        break;
      case 'summon':
        this.squash = Math.sin(this.stT * 10) * 0.2;
        if (this.st <= 0) {
          for (let i = 0; i < 2; i++) {
            const a = this.facing + (i ? 1.4 : -1.4);
            const x = this.pos.x + Math.sin(a) * 2.6, z = this.pos.z + Math.cos(a) * 2.6;
            const e = new Enemy('mushroom', x, z, { minion: true });
            G.game.addEnemy(e);
            G.fx.poof(x, this.arena.h, z, 0xe0c0ff, 10);
          }
          sfx('enemyDie');
          this.set('recover', 0.6);
        }
        break;
      case 'recover':
        this.vel.multiplyScalar(0.8);
        if (this.echo > 0) { this.echo -= dt; if (this.echo <= 0) { G.game.addShockwave(this.pos.x, this.arena.h, this.pos.z, { speed: 6.5, max: this.arena.r + 1 }); G.cam.shake(0.4); sfx('stomp'); } }
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(1.6, 2.6) / k; }
        break;
    }
  }

  // ---------------------------------------------------------------- Captain Pinch
  aiCrab(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    this.onEdge = null;
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 5, dt);
        this.side = this.side || 1;
        if (this.stT > 1.6) { this.side *= -1; this.stT = 0; }
        const a = this.facing + Math.PI / 2 * this.side;
        let vx = Math.sin(a) * 2.6 * k, vz = Math.cos(a) * 2.6 * k;
        const want = 6;
        vx += Math.sin(toP) * (d - want) * 0.6; vz += Math.cos(toP) * (d - want) * 0.6;
        this.vel.set(vx, vz);
        this.cool -= dt;
        if (this.cool <= 0) {
          const atk = this.pickAttack([['charge', 42], ['bubbles', 33], ['snap', d < 4.5 ? 40 : 15]]);
          this.vel.set(0, 0);
          if (atk === 'charge') { this.set('chargeWind', 0.8 / Math.sqrt(k)); this.cd = toP; this.tele = G.fx.ground.line(this.pos.x, this.arena.h, this.pos.z, toP, 30, 2.6, 0xff5a3a, 0.3); }
          else if (atk === 'bubbles') { this.set('bubbles', 1.2); this.shot = 0; }
          else this.set('snapWind', 0.42);
        }
        break;
      }
      case 'chargeWind':
        this.facing = dampAngle(this.facing, this.cd, 12, dt);
        if (this.stT < 0.4) { this.cd = dampAngle(this.cd, toP, 3, dt); if (this.tele) { this.tele.m.rotation.y = this.cd; this.tele.m.position.set(this.pos.x, this.arena.h + 0.06, this.pos.z); } }
        if (Math.random() < 0.5) G.fx.dust(this.pos.x - Math.sin(this.cd) * 1.2, this.arena.h, this.pos.z - Math.cos(this.cd) * 1.2, 1, 0xf6e2b0);
        if (this.tele) this.tele.m.material.opacity = 0.2 + 0.25 * Math.abs(Math.sin(this.stT * 14));
        if (this.st <= 0) { G.fx.ground.remove(this.tele); this.tele = null; this.set('charge', 2.2); sfx('dash'); }
        break;
      case 'charge': {
        const sp = 13 * Math.sqrt(k);
        this.vel.set(Math.sin(this.cd) * sp, Math.cos(this.cd) * sp);
        if (Math.random() < 0.7) G.fx.dust(this.pos.x, this.arena.h, this.pos.z, 2, 0xf6e2b0);
        this.onEdge = () => {
          this.vel.set(0, 0);
          this.set('stunned', 1.2);
          this.squash = 1; G.cam.shake(1); sfx('stomp');
          G.fx.sparks(this.pos.x + Math.sin(this.cd) * 1.5, this.arena.h + 1, this.pos.z + Math.cos(this.cd) * 1.5, 14);
        };
        if (this.st <= 0) this.set('recover', 0.6);
        break;
      }
      case 'stunned':
        this.vel.set(0, 0);
        if (Math.random() < 0.25) G.fx.sparkle(this.pos.x + Math.sin(this.t * 6) * 0.8, this.arena.h + 2.6, this.pos.z + Math.cos(this.t * 6) * 0.8, 0xfff070, 1, 0.1);
        if (this.st <= 0) this.set('recover', 0.4);
        break;
      case 'bubbles':
        this.facing = dampAngle(this.facing, toP, 6, dt);
        this.vel.set(0, 0);
        if (this.stT > this.shot * 0.18 && this.shot < (this.enraged ? 9 : 6)) {
          const a = toP + rand(-0.35, 0.35);
          G.game.spawnProjectile('bubble', this.pos.x + Math.sin(a) * 1.6, this.arena.h + 1.0, this.pos.z + Math.cos(a) * 1.6, a, 3.6, { life: 4 });
          sfx('bubble');
          this.shot++;
        }
        if (this.st <= 0) this.set('recover', 0.5);
        break;
      case 'snapWind':
        this.facing = dampAngle(this.facing, toP, 10, dt);
        this.vel.set(0, 0);
        if (this.st <= 0) { this.set('snap', 0.28); this.cd = this.facing; this.snapped = false; sfx('swing'); }
        break;
      case 'snap': {
        this.vel.set(Math.sin(this.cd) * 11, Math.cos(this.cd) * 11);
        const hx = this.pos.x + Math.sin(this.cd) * 1.9, hz = this.pos.z + Math.cos(this.cd) * 1.9;
        const pl = G.player;
        if (!this.snapped && len2(pl.pos.x - hx, pl.pos.z - hz) < 1.3) { this.snapped = G.game.playerHurt(2, this.pos.x, this.pos.z, 9); }
        if (this.st <= 0) { this.set('recover', 0.6 / k); G.fx.sparks(hx, this.arena.h + 0.8, hz, 6, 0xffffff); }
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(0.8);
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(1.4, 2.2) / k; }
        break;
    }
  }

  // ---------------------------------------------------------------- Frostbun
  aiFrost(dt) {
    const k = this.speedK;
    const toP = this.dirTo(), d = this.dist();
    this.onEdge = null;
    switch (this.state) {
      case 'walk': {
        this.facing = dampAngle(this.facing, toP, 4, dt);
        const sp = d > 2.6 ? 1.5 * k : 0;
        this.vel.set(Math.sin(this.facing) * sp, Math.cos(this.facing) * sp);
        this.lift = Math.abs(Math.sin(this.t * 5)) * 0.25;
        this.cool -= dt;
        if (this.cool <= 0) {
          const atk = this.pickAttack([['leap', 42], ['throw', 33], ['slide', 25]]);
          this.vel.set(0, 0); this.lift = 0;
          if (atk === 'leap') this.set('crouch', 0.45);
          else if (atk === 'throw') this.set('throwWind', 0.5);
          else { this.set('slideWind', 0.5); }
        }
        break;
      }
      case 'crouch':
        this.squash = Math.min(1, this.squash + dt * 5);
        if (this.st <= 0) {
          this.set('air', 1.15 / Math.sqrt(k));
          this.from = { x: this.pos.x, z: this.pos.z };
          const pl = G.player.pos;
          this.to = { x: pl.x, z: pl.z };
          this.shadow = G.fx.ground.disc(this.to.x, this.arena.h, this.to.z, 0.6, 0x3a2a50, 0.4);
          sfx('dash');
        }
        break;
      case 'air': {
        const dur = 1.15 / Math.sqrt(k);
        const kk = clamp(this.stT / dur, 0, 1);
        if (kk < 0.3) { const pl = G.player.pos; this.to.x = lerp(this.to.x, pl.x, dt * 4); this.to.z = lerp(this.to.z, pl.z, dt * 4); }
        this.vel.set(0, 0);
        this.pos.x = lerp(this.from.x, this.to.x, Ease.inOutSine(kk));
        this.pos.z = lerp(this.from.z, this.to.z, Ease.inOutSine(kk));
        this.lift = Math.sin(kk * Math.PI) * 6.5;
        if (this.shadow) { this.shadow.m.position.set(this.to.x, this.arena.h + 0.05, this.to.z); this.shadow.m.scale.setScalar(0.6 + kk * 2.2); this.shadow.m.material.opacity = 0.25 + kk * 0.35; }
        if (this.st <= 0) {
          this.lift = 0; this.squash = 1.3;
          G.fx.ground.remove(this.shadow); this.shadow = null;
          G.cam.shake(1.1); sfx('stomp'); sfx('snow');
          G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 30, 1.6);
          const pl = G.player;
          if (len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < 2.9) G.game.playerHurt(2, this.pos.x, this.pos.z, 10);
          if (this.enraged) {
            for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; G.game.spawnProjectile('snowball', this.pos.x, this.arena.h + 1.2, this.pos.z, a, 5, { vy: 4, grav: 9 }); }
          }
          this.set('recover', 0.9 / k);
        }
        break;
      }
      case 'throwWind':
        this.facing = dampAngle(this.facing, toP, 8, dt);
        this.squash = -Math.sin((this.stT / 0.5) * Math.PI) * 0.4;
        if (this.st <= 0) {
          const n = this.enraged ? 7 : 5;
          const sp = 7, T = clamp(d / sp, 0.5, 1.6);
          for (let i = 0; i < n; i++) {
            const a = toP + (i - (n - 1) / 2) * 0.22;
            G.game.spawnProjectile('snowball', this.pos.x + Math.sin(a) * 1.2, this.arena.h + 2.2, this.pos.z + Math.cos(a) * 1.2, a, sp, { vy: 9 * T * 0.5 - 1.2, grav: 9, scale: 1.4, r: 0.3 });
          }
          sfx('snow');
          this.set('recover', 0.6 / k);
        }
        break;
      case 'slideWind':
        this.facing = dampAngle(this.facing, toP, 10, dt);
        this.squash = Math.min(0.8, this.squash + dt * 4);
        if (this.st <= 0) { this.set('slide', 1.4); this.cd = toP; sfx('dash'); }
        break;
      case 'slide': {
        const sp = 10 * Math.sqrt(k);
        this.vel.set(Math.sin(this.cd) * sp, Math.cos(this.cd) * sp);
        this.facing = this.cd;
        if (Math.random() < 0.8) G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 2, 0.5);
        this.onEdge = () => {
          // bounce off the arena wall
          const a = this.arena;
          const nx = (this.pos.x - a.x), nz = (this.pos.z - a.z), l = len2(nx, nz) || 1;
          let vx = Math.sin(this.cd), vz = Math.cos(this.cd);
          const dot = vx * nx / l + vz * nz / l;
          vx -= 2 * dot * nx / l; vz -= 2 * dot * nz / l;
          this.cd = Math.atan2(vx, vz);
          G.cam.shake(0.4); G.fx.snowBurst(this.pos.x, this.arena.h, this.pos.z, 10, 0.8);
        };
        if (this.st <= 0) this.set('recover', 0.7);
        break;
      }
      case 'recover':
        this.vel.multiplyScalar(0.85);
        if (this.st <= 0) { this.set('walk', 0); this.cool = rand(1.5, 2.4) / k; }
        break;
    }
  }

  /** returns 'hit' | 'dead' | null */
  hit(dmg, fx, fz) {
    if (this.iframes > 0 || this.dying || this.state === 'sleep' || this.state === 'intro') return null;
    if (this.lift > 1.6) return null;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = 0.15;
    this.flash = 1;
    const a = Math.atan2(this.pos.x - fx, this.pos.z - fz);
    if (this.state === 'walk' || this.state === 'stunned' || this.state === 'recover') { this.pos.x += Math.sin(a) * 0.15; this.pos.z += Math.cos(a) * 0.15; }
    this.squash = Math.max(this.squash, 0.35);
    if (this.hp <= 0) { this.startDying(); return 'dead'; }
    return 'hit';
  }
  startDying() {
    this.dying = true;
    this.deathT = 0;
    this.vel.set(0, 0);
    this.lift = 0;
    for (const t of [this.tele, this.shadow]) if (t) G.fx.ground.remove(t);
    this.tele = this.shadow = null;
  }
  updateDying(dt) {
    this.deathT += dt;
    const k = this.deathT;
    this.flash = Math.floor(k * 10) % 2 ? 0.9 : 0.1;
    if (Math.floor(k / 0.3) !== Math.floor((k - dt) / 0.3)) {
      G.fx.burst(this.pos.x + rand(-1, 1), this.arena.h + rand(0.8, 2.6), this.pos.z + rand(-1, 1), [0xfff4a0, 0xffc8e0, 0xc8f0ff][Math.floor(k * 3) % 3], 14, 5);
      G.cam.shake(0.5);
      sfx('bossHit');
    }
    if (k > 2.2 && !this.dead) {
      this.dead = true;
      G.fx.burst(this.pos.x, this.arena.h + 1.5, this.pos.z, 0xfff4a0, 40, 9);
      G.fx.poof(this.pos.x, this.arena.h + 0.5, this.pos.z, 0xffffff, 30, 2.4);
      G.cam.shake(1.2);
      sfx('bossDie');
      G.scene.remove(this.root);
      G.game.onBossDefeated(this);
    }
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    this.root.rotation.y = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    let sx = 1, sy = 1;
    const sq = this.squash;
    sy -= sq * 0.22; sx += sq * 0.15;
    const n = this.nodes;
    const walking = this.state === 'walk' && this.vel.lengthSq() > 0.1;
    const ph = time * (this.id === 'shores' ? 10 : 6);
    this.root.rotation.z = 0; this.root.rotation.x = 0;
    if (this.state === 'sleep') { sy += Math.sin(time * 1.5) * 0.03; this.root.rotation.z = Math.sin(time * 0.8) * 0.03; }
    if (walking && this.id !== 'shores') this.root.rotation.z = Math.sin(ph) * 0.07;
    if (this.state === 'slide') { this.root.rotation.x = 1.2; p.y -= 0.6; }
    if (this.state === 'stunned') this.root.rotation.z = Math.sin(time * 12) * 0.12;
    if (this.dying) { this.root.rotation.z = Math.sin(time * 30) * 0.08; sy *= 1 + Math.sin(time * 20) * 0.05; }
    if (n.legL) { n.legL.rotation.x = walking ? Math.sin(ph) * 0.5 : 0; n.legR.rotation.x = walking ? -Math.sin(ph) * 0.5 : 0; }
    if (this.id === 'shores' && n.legL) { n.legL.rotation.z = Math.sin(ph) * 0.12; n.legR.rotation.z = -Math.sin(ph) * 0.12; n.legL.rotation.x = 0; n.legR.rotation.x = 0; }
    if (n.armL) {
      const raise = this.state === 'chargeWind' || this.state === 'charge' || this.state === 'snapWind' || this.state === 'intro' || this.state === 'crouch' || this.state === 'stompCrouch';
      n.armL.rotation.z = raise ? -0.5 : Math.sin(time * 2) * 0.08;
      n.armR.rotation.z = raise ? 0.5 : -Math.sin(time * 2) * 0.08;
      n.armL.rotation.x = this.state === 'snap' ? -0.8 : walking ? Math.sin(ph) * 0.3 : 0;
      n.armR.rotation.x = this.state === 'snap' ? -0.8 : walking ? -Math.sin(ph) * 0.3 : 0;
    }
    if (n.head) n.head.rotation.x = this.state === 'sleep' ? 0.15 : 0;
    this.root.scale.set(sx, sy, sx);
    for (const m of this.mats) m.userData.flash && (m.userData.flash.value = this.flash * 0.85);
  }
  remove() { G.scene.remove(this.root); for (const t of [this.tele, this.shadow]) if (t) G.fx.ground.remove(t); }
}
