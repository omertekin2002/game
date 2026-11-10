// Enemies (6 types), projectiles, pickups, enemy spawner, blob shadows.
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { CFG, ENEMY, REGIONS, REGION } from './data.js';
import { instRig, enemyDef, gemBuilt, heartBuilt, seedBuilt, projectileBuilt } from './models.js';
import { makeModel } from './assets.js';
import { toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { moveCircle } from './phys.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, rand, pick, TAU, len2, angDiff, Ease } from './util.js';

const _v = new THREE.Vector3();

// ---------------------------------------------------------------- blob shadows (1 draw call)
export class Blobs {
  constructor(scene, max = 96) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0, 'rgba(40,25,40,0.55)'); g.addColorStop(0.6, 'rgba(40,25,40,0.3)'); g.addColorStop(1, 'rgba(40,25,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.max = max; this.n = 0;
    this.m = new THREE.Matrix4();
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  add(x, y, z, r) {
    if (this.n >= this.max) return;
    this.m.makeScale(r * 2, 1, r * 2).setPosition(x, y + 0.03, z);
    this.mesh.setMatrixAt(this.n++, this.m);
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------------------------------------------------------------- enemies
export class Enemy {
  constructor(type, x, z, o = {}) {
    this.type = type;
    this.def = ENEMY[type];
    this.hp = this.def.hp;
    this.r = this.def.r;
    this.pos = new THREE.Vector3(x, G.world.ground(x, z), z);
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector2();
    this.knock = new THREE.Vector2();
    this.facing = rand(0, TAU);
    this.prevFacing = this.facing;
    this.state = 'idle'; this.st = rand(0.3, 1.2);
    this.alt = this.def.flying ? (type === 'snowpuff' ? 0.35 : type === 'bee' ? 1.0 : 1.5) : 0;
    this.altCur = this.alt;
    this.iframes = 0; this.flash = 0; this.alive = true; this.minion = !!o.minion;
    this.cool = rand(1, 2.5);
    this.ph = rand(0, TAU);
    this.hop = 0; this.squash = 0;
    this.spawnT = 0;
    this.lastSwing = -1;
    const glb = makeModel(type);
    this.root = new THREE.Group();
    if (glb) { this.root.add(glb.group); this.mats = glb.materials; this.nodes = { body: glb.group }; this.glb = true; }
    else {
      const r = instRig(enemyDef(type));
      this.root.add(r.root);
      this.nodes = r.nodes;
      this.mats = r.mats;
    }
    this.root.scale.setScalar(0.01);
    G.scene.add(this.root);
  }
  get y() { return this.pos.y; }
  dist() { const p = G.player.pos; return len2(p.x - this.pos.x, p.z - this.pos.z); }
  dirTo() { const p = G.player.pos; return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  canGo = (x, z) => {
    if (this.minion) return true;
    if (len2(x, z) < 36) return false;
    return !G.world.inArena(x, z, 3);
  };
  move(dx, dz) {
    const extra = G.game.enemyColliders(this);
    return moveCircle(G.world, this, dx, dz, { r: this.r, flying: this.def.flying && this.type !== 'snowpuff', custom: this.canGo, extra, arena: this.minion && G.game.fight ? G.game.fight.arenaClamp : null });
  }
  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.spawnT = Math.min(1, this.spawnT + dt * 3);
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt * 7);
    this.squash *= Math.exp(-10 * dt);
    this.st -= dt;
    this.cool -= dt;
    const pl = G.player;
    const d = this.dist();
    const toP = this.dirTo();
    const active = d < 13 && pl.state !== 'dizzy';
    let mx = 0, mz = 0;
    const W = G.world;
    switch (this.type) {
      case 'slime': {
        if (this.state === 'idle') {
          this.facing = dampAngle(this.facing, active ? toP : this.facing, 6, dt);
          if (this.st <= 0) { this.state = 'crouch'; this.st = 0.24; }
        } else if (this.state === 'crouch') {
          this.squash = Math.min(1, this.squash + dt * 6);
          if (this.st <= 0) {
            this.state = 'hop'; this.st = 0.46; this.hopT = 0;
            const a = active ? toP + rand(-0.2, 0.2) : rand(0, TAU);
            const sp = active ? 4.4 : 1.8;
            this.vel.set(Math.sin(a) * sp, Math.cos(a) * sp);
            this.facing = a;
          }
        } else if (this.state === 'hop') {
          this.hopT += dt;
          this.hop = Math.sin((this.hopT / 0.46) * Math.PI) * 0.6;
          mx = this.vel.x; mz = this.vel.y;
          if (this.st <= 0) { this.state = 'idle'; this.st = active ? rand(0.35, 0.7) : rand(0.8, 1.6); this.hop = 0; this.squash = 1; G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 3, 0xd8f0b0); }
        }
        break;
      }
      case 'mushroom': {
        if (this.state === 'idle' || this.state === 'walk') {
          if (this.st <= 0) {
            if (this.state === 'idle') { this.state = 'walk'; this.st = rand(1.0, 1.8); this.wdir = active ? toP + rand(-1, 1) : rand(0, TAU); }
            else { this.state = 'idle'; this.st = rand(0.6, 1.2); }
          }
          if (this.state === 'walk') { mx = Math.sin(this.wdir) * 1.2; mz = Math.cos(this.wdir) * 1.2; this.facing = dampAngle(this.facing, this.wdir, 8, dt); }
          else if (active) this.facing = dampAngle(this.facing, toP, 6, dt);
          if (active && d < 11 && this.cool <= 0) { this.state = 'puff'; this.st = 0.42; }
        } else if (this.state === 'puff') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          this.squash = -Math.sin((1 - this.st / 0.42) * Math.PI) * 0.6;
          if (this.st <= 0) {
            G.game.spawnProjectile('spore', this.pos.x + Math.sin(this.facing) * 0.4, this.pos.y + 0.55, this.pos.z + Math.cos(this.facing) * 0.4, toP, 3.2);
            sfx('shoot');
            this.state = 'idle'; this.st = 0.6; this.cool = 2.5;
          }
        }
        break;
      }
      case 'bat': {
        this.ph += dt;
        if (this.state === 'idle') {
          if (active) {
            this.orbitA = (this.orbitA ?? toP + Math.PI) + dt * 0.9;
            const tx = pl.pos.x + Math.sin(this.orbitA) * 4, tz = pl.pos.z + Math.cos(this.orbitA) * 4;
            const a = Math.atan2(tx - this.pos.x, tz - this.pos.z), l = len2(tx - this.pos.x, tz - this.pos.z);
            const sp = Math.min(3.6, l * 2);
            mx = Math.sin(a) * sp; mz = Math.cos(a) * sp;
            this.facing = dampAngle(this.facing, toP, 6, dt);
            if (this.cool <= 0 && d < 8) { this.state = 'rise'; this.st = 0.35; }
          } else {
            this.wa = (this.wa ?? rand(0, TAU)) + rand(-1, 1) * dt;
            mx = Math.sin(this.wa) * 1.4; mz = Math.cos(this.wa) * 1.4;
            this.facing = dampAngle(this.facing, this.wa, 4, dt);
          }
          this.alt = 1.5 + Math.sin(this.ph * 3) * 0.25;
        } else if (this.state === 'rise') {
          this.alt = 2.1; this.facing = dampAngle(this.facing, toP, 12, dt);
          if (this.st <= 0) { this.state = 'swoop'; this.st = 0.55; this.sw = toP; }
        } else if (this.state === 'swoop') {
          mx = Math.sin(this.sw) * 8.5; mz = Math.cos(this.sw) * 8.5; this.alt = 0.55;
          if (this.st <= 0) { this.state = 'recover'; this.st = 0.6; }
        } else if (this.state === 'recover') {
          this.alt = 1.5; mx = Math.sin(this.sw) * 1.5; mz = Math.cos(this.sw) * 1.5;
          if (this.st <= 0) { this.state = 'idle'; this.cool = rand(2.5, 3.5); }
        }
        break;
      }
      case 'bee': {
        this.ph += dt;
        if (this.state === 'idle') {
          const base = active ? toP : (this.wa = (this.wa ?? rand(0, TAU)) + rand(-1, 1) * dt);
          const zig = Math.sin(this.ph * 4) * 1.1;
          const a = base + zig;
          const sp = active ? (d > 3 ? 2.6 : 0.6) : 1.2;
          mx = Math.sin(a) * sp; mz = Math.cos(a) * sp;
          this.facing = dampAngle(this.facing, active ? toP : base, 6, dt);
          this.alt = 1.0 + Math.sin(this.ph * 5) * 0.12;
          if (active && d < 7 && this.cool <= 0) { this.state = 'aim'; this.st = 0.55; }
        } else if (this.state === 'aim') {
          this.facing = dampAngle(this.facing, toP, 14, dt); this.dv = this.facing;
          this.alt = 1.3;
          if (this.st <= 0) { this.state = 'dive'; this.st = 0.45; }
        } else if (this.state === 'dive') {
          mx = Math.sin(this.dv) * 9; mz = Math.cos(this.dv) * 9; this.alt = 0.5;
          if (this.st <= 0) { this.state = 'recover'; this.st = 0.7; }
        } else if (this.state === 'recover') {
          this.alt = 1.0;
          if (this.st <= 0) { this.state = 'idle'; this.cool = rand(2.6, 3.6); }
        }
        break;
      }
      case 'crab': {
        if (this.state === 'idle') {
          this.facing = dampAngle(this.facing, active ? toP : this.facing, 5, dt);
          if (this.st <= 0) { this.side = Math.random() < 0.5 ? -1 : 1; this.st = rand(0.9, 1.5); }
          const sd = this.side || 1;
          const a = this.facing + Math.PI / 2;
          const sp = active ? 2.2 : 1.2;
          mx = Math.sin(a) * sd * sp; mz = Math.cos(a) * sd * sp;
          if (active && d > 3.5) { mx += Math.sin(toP) * 0.8; mz += Math.cos(toP) * 0.8; }
          if (active && d < 7 && this.cool <= 0) { this.state = 'windup'; this.st = 0.5; }
        } else if (this.state === 'windup') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          if (this.st <= 0) { this.state = 'charge'; this.st = 0.85; this.cd = this.facing; }
        } else if (this.state === 'charge') {
          mx = Math.sin(this.cd) * 7; mz = Math.cos(this.cd) * 7;
          if (Math.random() < 0.4) G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 1, 0xf6e2b0);
          if (this.st <= 0) { this.state = 'rest'; this.st = 0.85; }
        } else if (this.state === 'rest') {
          if (this.st <= 0) { this.state = 'idle'; this.cool = rand(2, 3); }
        }
        break;
      }
      case 'snowpuff': {
        this.ph += dt;
        this.alt = 0.35 + Math.sin(this.ph * 2.2) * 0.12;
        if (this.state === 'idle') {
          if (active) {
            this.facing = dampAngle(this.facing, toP, 6, dt);
            let sp = 0, a = toP;
            if (d < 5) { sp = -2.2; } else if (d > 9) sp = 1.8;
            mx = Math.sin(a) * sp + Math.sin(a + Math.PI / 2) * Math.sin(this.ph) * 1.2;
            mz = Math.cos(a) * sp + Math.cos(a + Math.PI / 2) * Math.sin(this.ph) * 1.2;
            if (this.cool <= 0 && d < 12) { this.state = 'windup'; this.st = 0.4; }
          } else {
            this.wa = (this.wa ?? rand(0, TAU)) + rand(-1, 1) * dt;
            mx = Math.sin(this.wa) * 0.9; mz = Math.cos(this.wa) * 0.9;
          }
        } else if (this.state === 'windup') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          this.squash = Math.sin((1 - this.st / 0.4) * Math.PI) * 0.5;
          if (this.st <= 0) {
            const sp = 6.5, T = Math.max(0.4, d / sp);
            G.game.spawnProjectile('snowball', this.pos.x, this.pos.y + this.alt + 0.6, this.pos.z, toP, sp, { vy: 9 * T * 0.5 - 0.3, grav: 9 });
            sfx('snow');
            this.state = 'idle'; this.cool = rand(1.8, 2.4);
          }
        }
        break;
      }
    }
    // knockback
    if (this.knock.lengthSq() > 0.01) { mx += this.knock.x; mz += this.knock.y; this.knock.multiplyScalar(Math.exp(-8 * dt)); }
    const blocked = this.move(mx * dt, mz * dt);
    if (blocked && this.type === 'crab' && this.state === 'charge') { this.state = 'rest'; this.st = 0.9; G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 4); }
    const gy = W.ground(this.pos.x, this.pos.z);
    this.pos.y = Math.max(gy, this.def.flying ? -0.2 : gy);
    this.altCur = damp(this.altCur, this.alt, this.state === 'swoop' || this.state === 'dive' ? 8 : 4, dt);
    // contact damage
    const py = this.pos.y + this.altCur + (this.hop || 0);
    if (d < this.r + pl.r + 0.05 && Math.abs(py - pl.pos.y) < 1.1 && this.spawnT > 0.5) {
      if (this.type === 'crab' && this.state === 'charge' && Math.abs(angDiff(this.facing, toP)) < 1.05) {
        // claw raised: bonk
        if (!pl.invulnerable && G.game.playerHurt(1, this.pos.x, this.pos.z)) { /* ok */ }
      } else G.game.playerHurt(1, this.pos.x, this.pos.z);
    }
  }
  /** returns 'hit' | 'clink' | 'dead' | null */
  hit(dmg, fx, fz, knock = 6.5) {
    if (this.iframes > 0 || !this.alive) return null;
    const a = Math.atan2(fx - this.pos.x, fz - this.pos.z);
    if (this.type === 'crab' && (this.state === 'charge' || this.state === 'windup') && Math.abs(angDiff(this.facing, a)) < 1.0) {
      this.iframes = 0.2;
      this.knock.set(-Math.sin(a) * 2, -Math.cos(a) * 2);
      return 'clink';
    }
    this.hp -= dmg;
    this.iframes = 0.25;
    this.flash = 1;
    this.squash = 0.8;
    this.knock.set(-Math.sin(a) * knock, -Math.cos(a) * knock);
    if (this.type === 'slime' && this.state === 'hop') { this.state = 'idle'; this.st = 0.5; this.hop = 0; }
    if (this.type === 'bat' || this.type === 'bee') { this.state = 'recover'; this.st = 0.5; this.sw = this.dv = this.facing; }
    if (this.hp <= 0) { this.alive = false; return 'dead'; }
    return 'hit';
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    p.y += this.altCur + (this.hop || 0);
    this.root.rotation.y = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    const sp = Ease.outBack(Math.min(1, this.spawnT));
    let sx = 1, sy = 1;
    const sq = this.squash;
    sy -= sq * 0.3; sx += sq * 0.2;
    const n = this.nodes;
    const breathe = Math.sin(time * 3 + this.ph) * 0.03;
    switch (this.type) {
      case 'slime': {
        if (this.state === 'hop') { sy += 0.22 * Math.sin((this.hopT / 0.46) * Math.PI); sx -= 0.1; }
        sy += breathe; sx -= breathe;
        break;
      }
      case 'mushroom': {
        const walk = this.state === 'walk';
        if (n.legL) { n.legL.rotation.x = walk ? Math.sin(time * 12) * 0.6 : 0; n.legR.rotation.x = walk ? -Math.sin(time * 12) * 0.6 : 0; }
        if (n.body) n.body.rotation.z = walk ? Math.sin(time * 12) * 0.08 : 0;
        if (n.cap) n.cap.scale.setScalar(1 + (this.state === 'puff' ? -this.squash * 0.5 : breathe));
        break;
      }
      case 'bat': {
        const f = this.state === 'swoop' ? 22 : 14;
        if (n.wingL) { n.wingL.rotation.z = Math.sin(time * f + this.ph) * 0.9; n.wingR.rotation.z = -Math.sin(time * f + this.ph) * 0.9; }
        if (n.body) n.body.rotation.x = this.state === 'swoop' ? 0.6 : 0.1;
        break;
      }
      case 'bee': {
        const f = this.state === 'aim' ? 70 : 40;
        if (n.wingL) { n.wingL.rotation.z = Math.sin(time * f) * 0.7; n.wingR.rotation.z = -Math.sin(time * f) * 0.7; }
        if (n.body) {
          n.body.rotation.x = this.state === 'dive' ? 0.7 : 0;
          n.body.position.x = this.state === 'aim' ? Math.sin(time * 60) * 0.03 : 0;
        }
        break;
      }
      case 'crab': {
        const up = this.state === 'windup' || this.state === 'charge';
        if (n.clawL) {
          n.clawL.rotation.z = up ? -0.6 + Math.sin(time * 30) * 0.05 : Math.sin(time * 4) * 0.15;
          n.clawR.rotation.z = up ? 0.6 - Math.sin(time * 30) * 0.05 : -Math.sin(time * 4 + 1) * 0.15;
          n.clawL.rotation.x = up ? -0.5 : 0; n.clawR.rotation.x = up ? -0.5 : 0;
        }
        if (n.legs) n.legs.rotation.z = Math.sin(time * 18) * 0.06;
        if (n.body) n.body.position.y = Math.abs(Math.sin(time * 18)) * 0.03;
        break;
      }
      case 'snowpuff': {
        if (n.top) n.top.rotation.y = time * 2;
        sy += breathe; sx += breathe;
        break;
      }
    }
    this.root.scale.set(sx * sp, sy * sp, sx * sp);
    for (const m of this.mats) m.userData.flash.value = this.flash * 0.9;
  }
  remove() {
    G.scene.remove(this.root);
    for (const m of this.mats) m.dispose();
  }
}

// ---------------------------------------------------------------- projectiles
const projMat = { m: null };
export class Projectile {
  constructor(kind, x, y, z, ang, speed, o = {}) {
    this.kind = kind;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(Math.sin(ang) * speed, o.vy || 0, Math.cos(ang) * speed);
    this.grav = o.grav || 0;
    this.r = o.r ?? (kind === 'bubble' ? 0.3 : 0.24);
    this.life = o.life ?? (kind === 'snowball' ? 4 : 5);
    this.dmg = o.dmg ?? 1;
    this.poppable = kind !== 'snowball' || o.poppable;
    this.alive = true;
    this.t = 0;
    this.scale = o.scale ?? 1;
    projMat.m = projMat.m || toonMat({ glow: true });
    this.root = meshWithOutline(projectileBuilt(kind), projMat.m, sharedOutline('char'), { cast: false });
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(this.scale);
    G.scene.add(this.root);
  }
  update(dt) {
    this.t += dt;
    this.vel.y -= this.grav * dt;
    if (this.kind === 'bubble') { this.vel.x += Math.sin(this.t * 5) * dt * 1.2; this.vel.z += Math.cos(this.t * 4.3) * dt * 1.2; }
    this.pos.addScaledVector(this.vel, dt);
    const W = G.world;
    const g = W.ground(this.pos.x, this.pos.z);
    if (this.t > this.life) return this.pop(false);
    if (this.grav > 0 && this.pos.y < g + 0.1) return this.pop(true);
    if (this.grav === 0) {
      if (this.pos.y < g + 0.15) this.pos.y = g + 0.15;
      if (W.slopeAt(this.pos.x, this.pos.z) > 1.1 && this.t > 0.2) return this.pop(true);
    }
    const pl = G.player;
    const dy = (this.pos.y) - (pl.pos.y + 0.5);
    if (len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < this.r * this.scale + pl.r && Math.abs(dy) < 0.75) {
      if (G.game.playerHurt(this.dmg, this.pos.x - this.vel.x, this.pos.z - this.vel.z)) return this.pop(true);
    }
  }
  pop(fx = true) {
    if (!this.alive) return;
    this.alive = false;
    if (fx) {
      if (this.kind === 'snowball') { G.fx.snowBurst(this.pos.x, this.pos.y, this.pos.z, 10, 0.7); sfx('snow'); }
      else if (this.kind === 'bubble') { G.fx.splash(this.pos.x, this.pos.y, this.pos.z, 8); sfx('bubble'); }
      else G.fx.poof(this.pos.x, this.pos.y, this.pos.z, 0xe0b8ff, 6, 0.6);
    }
    G.scene.remove(this.root);
  }
  render(time) {
    this.root.position.copy(this.pos);
    this.root.rotation.y = time * 3;
    const w = this.kind === 'bubble' ? 1 + Math.sin(time * 9 + this.t) * 0.08 : 1;
    this.root.scale.set(this.scale * w, this.scale / w, this.scale * w);
  }
}

// ---------------------------------------------------------------- pickups
let pickMat = null;
export class Pickup {
  constructor(kind, x, z, o = {}) {
    this.kind = kind; // 'gem' | 'heart' | 'seed'
    this.value = o.value || 1;
    this.seedId = o.seedId;
    const y = G.world.ground(x, z);
    this.pos = new THREE.Vector3(x, y + (o.y0 ?? 0.3), z);
    this.ground = y;
    const a = rand(0, TAU), s = o.spread ?? rand(1, 2.6);
    this.vel = new THREE.Vector3(Math.sin(a) * s, o.vy ?? rand(4, 6), Math.cos(a) * s);
    this.t = 0;
    this.life = kind === 'seed' ? Infinity : CFG.pickupLife;
    this.alive = true;
    this.landed = false;
    this.r = kind === 'seed' ? 0.7 : 0.35;
    pickMat = pickMat || toonMat({ glow: true, rim: 1.5 });
    let built;
    if (kind === 'gem') built = gemBuilt();
    else if (kind === 'heart') built = heartBuilt();
    else built = seedBuilt(o.color ?? 0xffffff);
    this.root = meshWithOutline(built, pickMat, sharedOutline('char'), { cast: true });
    if (kind === 'seed') this.root.scale.setScalar(1.6);
    this.root.position.copy(this.pos);
    G.scene.add(this.root);
    this.magnet = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t > this.life) { this.remove(); return; }
    const pl = G.player;
    const d = len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (this.kind !== 'seed' && this.t > 0.35 && d < CFG.pickupMagnet) this.magnet = true;
    if (this.magnet) {
      const k = Math.min(1, dt * 12);
      this.pos.x += (pl.pos.x - this.pos.x) * k;
      this.pos.z += (pl.pos.z - this.pos.z) * k;
      this.pos.y += (pl.pos.y + 0.5 - this.pos.y) * k;
    } else if (!this.landed) {
      this.vel.y -= 18 * dt;
      this.pos.addScaledVector(this.vel, dt);
      const g = Math.max(G.world.ground(this.pos.x, this.pos.z), 0);
      this.ground = g;
      if (this.pos.y < g + 0.3) {
        this.pos.y = g + 0.3;
        if (this.vel.y < -2) { this.vel.y *= -0.45; this.vel.x *= 0.6; this.vel.z *= 0.6; }
        else { this.landed = true; }
      }
    }
    const reach = this.kind === 'seed' ? 1.2 : 0.7;
    if (d < reach && this.t > (this.kind === 'seed' ? 1.2 : 0.25)) { G.game.collect(this); this.remove(); }
  }
  remove() { if (!this.alive) return; this.alive = false; G.scene.remove(this.root); }
  render(time) {
    const p = this.root.position;
    p.copy(this.pos);
    if (this.landed || this.kind === 'seed') p.y += Math.sin(time * 3 + this.pos.x) * 0.08 + (this.kind === 'seed' ? 0.8 : 0.05);
    this.root.rotation.set(this.kind === 'gem' ? 0 : -0.55, time * (this.kind === 'seed' ? 1.2 : 2.5), 0, 'YXZ');
    const left = this.life - this.t;
    this.root.visible = !(left < 3 && Math.floor(time * 10) % 2 === 0);
    if (this.kind === 'seed' && Math.random() < 0.3) G.fx.sparkle(p.x, p.y, p.z, 0xfff4b0, 1, 0.7);
  }
}

// ---------------------------------------------------------------- spawner
export function trySpawnEnemy(game, camera) {
  const pl = G.player, W = G.world;
  const reg = W.regionAt(pl.pos.x, pl.pos.z);
  const R = REGIONS[reg];
  if (!R || !R.enemies.length) return;
  const night = G.sky ? G.sky.night : 0;
  let max = Math.min(CFG.maxEnemies, R.max);
  const live = game.enemies.filter((e) => !e.minion && e.alive).length;
  if (live >= max) return;
  const frustum = game.frustum;
  for (let tries = 0; tries < 10; tries++) {
    const a = rand(0, TAU), dist = rand(CFG.spawnMinDist + 2, 28);
    const x = pl.pos.x + Math.sin(a) * dist, z = pl.pos.z + Math.cos(a) * dist;
    const r2 = W.regionAt(x, z);
    if (r2 === REGION.VILLAGE || len2(x, z) < 38) continue;
    if (W.inArena(x, z, 6)) continue;
    if (!W.walkable(x, z) || W.hAt(x, z) < 0.3) continue;
    const ci = Math.floor(x + 180), cj = Math.floor(z + 180);
    if (W.reach && !W.reach[cj * 360 + ci]) continue;
    _v.set(x, W.hAt(x, z) + 0.5, z);
    if (frustum && frustum.containsPoint(_v)) continue;
    // type by region table (+bats at night)
    const tbl = REGIONS[r2].enemies.length ? REGIONS[r2].enemies.slice() : R.enemies.slice();
    if (night > 0.5 && (r2 === REGION.WOODS || r2 === REGION.MEADOW)) tbl.push(['bat', r2 === REGION.WOODS ? 6 : 3]);
    const tot = tbl.reduce((s, t) => s + t[1], 0);
    let roll = Math.random() * tot, type = tbl[0][0];
    for (const [t, w] of tbl) { roll -= w; if (roll <= 0) { type = t; break; } }
    game.addEnemy(new Enemy(type, x, z));
    return;
  }
}
