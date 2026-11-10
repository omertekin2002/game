// Pip: movement, sword, dash-roll, hurt, procedural animation (works on the static GLB or the procedural rig).
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { CFG } from './data.js';
import { makeModel } from './assets.js';
import { instRig, pipDef, swordBuilt } from './models.js';
import { toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { moveCircle } from './phys.js';
import { clamp, lerp, dampAngle, wrapAngle, Ease, TAU, rand } from './util.js';
import { SlashTrail } from './fx.js';

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.facing = Math.PI; // facing south (toward the default camera)
    this.prevFacing = this.facing;
    this.state = 'normal';
    this.t = 0;
    this.attackT = 0; this.attackBuffer = 0; this.dashBuffer = 0; this.dashCD = 0;
    this.iframes = 0; this.hurtT = 0; this.swingId = 0;
    this.dashDir = new THREE.Vector2();
    this.walkPhase = 0; this.stepT = 0;
    this.squash = 0; this.flash = 0;
    this.frozen = false;
    this.wading = false;
    this.r = CFG.playerR;

    this.root = new THREE.Group();
    this.root.name = 'pip';
    scene.add(this.root);
    this.spin = new THREE.Group();
    this.spin.position.y = 0.45;
    this.root.add(this.spin);
    this.inner = new THREE.Group();
    this.inner.position.y = -0.45;
    this.spin.add(this.inner);

    const glb = makeModel('hero');
    if (glb) {
      this.glb = true;
      this.height = glb.height;
      this.mats = glb.materials;
      this.inner.add(glb.group);
      this.body = glb.group;
      const h = this.height;
      this.arm = new THREE.Group();
      this.arm.position.set(-0.19 * h, 0.5 * h, 0.02 * h);
      this.inner.add(this.arm);
      this.handPos = new THREE.Vector3(-0.06 * h, -0.17 * h, 0.06 * h);
      this.swordMat = toonMat({ glow: true });
      this.mats = [...this.mats, this.swordMat];
    } else {
      this.glb = false;
      this.height = 1;
      const r = instRig(pipDef());
      this.inner.add(r.root);
      this.rig = r.nodes;
      this.mats = r.mats;
      this.body = r.nodes.body;
      this.arm = r.nodes.armR;
      this.handPos = new THREE.Vector3(-0.075, -0.17, 0.02);
      this.swordMat = r.mat;
    }
    this.arm.rotation.order = 'YXZ';
    this.swordPivot = new THREE.Group();
    this.swordPivot.position.copy(this.handPos);
    this.arm.add(this.swordPivot);
    this.swords = [false, true].map((shiny) => {
      const g = meshWithOutline(swordBuilt(shiny), this.swordMat, sharedOutline('char'));
      g.visible = false;
      this.swordPivot.add(g);
      return g;
    });
    this.trail = new SlashTrail();
    this.trail.mesh.position.y = 0.42;
    this.root.add(this.trail.mesh);
    this.held = new THREE.Group();
    this.held.position.y = 1.45 * this.height;
    this.root.add(this.held);
    this.setSword(1);
  }

  setSword(level) {
    this.swordLevel = level;
    this.swords[0].visible = level < 2;
    this.swords[1].visible = level >= 2;
    this.reach = level >= 2 ? CFG.reachShiny : CFG.reachWood;
    this.trail.setReach(this.reach, level >= 2);
  }
  place(x, z, facing = Math.PI) {
    this.pos.set(x, G.world.ground(x, z), z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0);
    this.facing = this.prevFacing = facing;
    this.state = 'normal';
    this.attackT = 0; this.iframes = 0; this.hurtT = 0; this.dashCD = 0;
    this.root.visible = true;
    this.spin.rotation.set(0, 0, 0);
  }
  get attacking() { return this.state === 'attack'; }
  get attackActive() { const k = this.attackT / CFG.swingTime; return this.state === 'attack' && k > 0.12 && k < 0.62; }
  get invulnerable() { return this.iframes > 0 || this.state === 'dash' || this.state === 'dizzy'; }

  /** fixed step */
  update(dt, input, cam, canAct) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.t += dt;
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.squash *= Math.exp(-10 * dt);
    const W = G.world;
    let wish = { x: 0, z: 0, l: 0 };
    if (canAct && !this.frozen) {
      const a = input.axis();
      const f = cam.forward(), r = cam.right();
      wish = { x: r.x * a.x + f.x * a.y, z: r.z * a.x + f.z * a.y, l: a.l };
    } else { this.attackBuffer = 0; this.dashBuffer = 0; }
    // state transitions
    if (this.state === 'normal' || (this.state === 'attack' && this.attackT > CFG.swingTime * 0.7)) {
      if (this.dashBuffer > 0 && this.dashCD <= 0) this.startDash(wish);
      else if (this.attackBuffer > 0 && (this.state === 'normal' || this.attackT > CFG.swingTime * 0.85)) this.startAttack(wish);
    }
    const speedMul = this.wading ? 0.62 : 1;
    let tvx = 0, tvz = 0;
    switch (this.state) {
      case 'normal': {
        tvx = wish.x * CFG.playerSpeed * speedMul; tvz = wish.z * CFG.playerSpeed * speedMul;
        if (wish.l > 0.12) this.facing = dampAngle(this.facing, Math.atan2(wish.x, wish.z), 16, dt);
        const acc = (wish.l > 0.05 ? CFG.playerAccel : CFG.playerDecel) * dt;
        this.vel.x += clamp(tvx - this.vel.x, -acc, acc);
        this.vel.y += clamp(tvz - this.vel.y, -acc, acc);
        break;
      }
      case 'attack': {
        this.attackT += dt;
        if (this.swordLevel >= 2 && this.attackActive && Math.random() < 0.7) {
          const a = this.facing + (Math.random() - 0.5) * 2.2, r = this.reach * (0.6 + Math.random() * 0.4);
          G.fx.sparkle(this.pos.x + Math.sin(a) * r, this.pos.y + 0.45, this.pos.z + Math.cos(a) * r, 0xffe27a, 1, 0.1);
        }
        const d = Math.exp(-9 * dt);
        this.vel.multiplyScalar(d);
        if (wish.l > 0.3 && this.attackT < 0.08) this.facing = dampAngle(this.facing, Math.atan2(wish.x, wish.z), 20, dt);
        if (this.attackT >= CFG.swingTime) this.state = 'normal';
        break;
      }
      case 'dash': {
        this.dashT += dt;
        const k = this.dashT / CFG.dashTime;
        const sp = CFG.dashSpeed * (1 - k * 0.45) * speedMul;
        this.vel.set(this.dashDir.x * sp, this.dashDir.y * sp);
        if (Math.random() < 0.6) G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 1);
        if (this.dashT >= CFG.dashTime) { this.state = 'normal'; this.squash = 1; this.vel.multiplyScalar(0.45); G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 4); }
        break;
      }
      case 'hurt': {
        this.hurtT -= dt;
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        if (this.hurtT <= 0) this.state = 'normal';
        break;
      }
      case 'dizzy': case 'frozen': case 'item': {
        if (this.autoMove && this.state === 'frozen') this.vel.set(this.autoMove.x, this.autoMove.z);
        else this.vel.multiplyScalar(Math.exp(-12 * dt));
        break;
      }
    }
    // integrate with collision
    const extra = G.game ? G.game.dynamicColliders(this) : null;
    const arena = G.game && G.game.fight && G.game.fight.phase !== 'won' ? G.game.fight.arenaClamp : null;
    moveCircle(W, this, this.vel.x * dt, this.vel.y * dt, { r: this.r, extra, arena });
    const gy = W.ground(this.pos.x, this.pos.z);
    this.wading = gy < -0.08 && W.bridgeAt(this.pos.x, this.pos.z) === null;
    this.pos.y = this.wading ? Math.max(gy, -0.25) : gy;
    // footsteps
    const sp = this.vel.length();
    if ((this.state === 'normal' || this.state === 'frozen') && sp > 1) {
      this.walkPhase += dt * (6 + sp * 1.6);
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.29;
        if (this.wading) { G.fx.splash(this.pos.x, Math.max(0, this.pos.y), this.pos.z, 4); if (Math.random() < 0.3) sfx('splash'); }
        else { G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 1, G.game ? G.game.dustColor(this.pos) : 0xe8d6b8); if (Math.random() < 0.5) sfx('step'); }
      }
    } else this.walkPhase *= 0.9;
  }
  startAttack(wish) {
    this.attackBuffer = 0;
    if (wish.l > 0.3) this.facing = Math.atan2(wish.x, wish.z);
    this.state = 'attack';
    this.attackT = 0;
    this.swingId++;
    this.vel.x += Math.sin(this.facing) * 2.6;
    this.vel.y += Math.cos(this.facing) * 2.6;
    this.trail.start(CFG.swingTime * 0.75);
    sfx('swing');
  }
  startDash(wish) {
    this.dashBuffer = 0;
    let dx = wish.x, dz = wish.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.2) { dx = Math.sin(this.facing); dz = Math.cos(this.facing); } else { dx /= l; dz /= l; this.facing = Math.atan2(dx, dz); }
    this.dashDir.set(dx, dz);
    this.state = 'dash';
    this.dashT = 0;
    this.dashCD = CFG.dashCooldown;
    this.iframes = Math.max(this.iframes, CFG.dashTime + 0.06);
    G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 5);
    sfx('dash');
  }
  /** returns true if damage was applied */
  hurt(dmg, fx, fz, knock = 7) {
    if (this.invulnerable || this.state === 'item' || this.frozen) return false;
    const dx = this.pos.x - fx, dz = this.pos.z - fz, l = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / l) * knock, (dz / l) * knock);
    this.state = 'hurt';
    this.hurtT = 0.25;
    this.iframes = CFG.hurtIframes;
    this.flash = 1;
    return true;
  }

  // ------------------------------------------------------------------ render / animation
  render(alpha, dt, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    const fac = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    this.root.rotation.y = fac;
    const sp = this.vel.length();
    const moving = (this.state === 'normal' || this.state === 'frozen') && sp > 0.4;
    const k = clamp(sp / CFG.playerSpeed, 0, 1);
    // squash & stretch
    let sx = 1, sy = 1;
    const breathe = Math.sin(time * 2.6) * 0.018 * (1 - k);
    sy += breathe; sx -= breathe * 0.5;
    sy -= this.squash * 0.18; sx += this.squash * 0.12;
    this.spin.rotation.set(0, 0, 0);
    this.inner.rotation.set(0, 0, 0);
    this.inner.position.y = -0.45;
    const ph = this.walkPhase;
    // body bob & waddle & lean
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.05 * k : 0;
    this.inner.position.y += bob;
    this.inner.rotation.z = moving ? Math.sin(ph) * 0.09 * k : 0;
    this.inner.rotation.x = moving ? 0.12 * k : 0;
    // limbs
    const rig = this.rig;
    let armRx = 0, armRy = 0, armRz = 0, swordRx = 0.55, swordRz = 0;
    if (rig) {
      rig.legL.rotation.x = moving ? Math.sin(ph) * 0.7 * k : 0;
      rig.legR.rotation.x = moving ? -Math.sin(ph) * 0.7 * k : 0;
      rig.armL.rotation.x = moving ? -Math.sin(ph) * 0.6 * k : Math.sin(time * 2.6) * 0.04;
      rig.armL.rotation.z = 0;
      rig.head.rotation.set(moving ? Math.sin(ph * 2) * 0.03 : Math.sin(time * 1.3) * 0.03, 0, moving ? -Math.sin(ph) * 0.05 : 0);
      armRx = moving ? Math.sin(ph) * 0.5 * k : 0;
    }
    if (this.state === 'attack') {
      const t = clamp(this.attackT / CFG.swingTime, 0, 1);
      let sweep;
      if (t < 0.15) sweep = lerp(-0.5, -1.35, Ease.outQuad(t / 0.15));
      else if (t < 0.6) sweep = lerp(-1.35, 1.35, Ease.outCubic((t - 0.15) / 0.45));
      else sweep = lerp(1.35, 0.4, Ease.inOutSine((t - 0.6) / 0.4));
      const reachK = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      armRx = lerp(0, -1.5, Math.min(1, t * 6) * reachK);
      armRy = sweep * reachK;
      swordRx = lerp(0.55, Math.PI - 0.15, Math.min(1, t * 6) * reachK);
      this.inner.rotation.y = -sweep * 0.35 * reachK;
      this.inner.rotation.x = 0.08;
      if (rig) { rig.armL.rotation.x = -0.3 * reachK; rig.armL.rotation.z = 0.5 * reachK; }
    }
    if (this.state === 'dash') {
      const t = clamp(this.dashT / CFG.dashTime, 0, 1);
      this.spin.rotation.x = Ease.inOutSine(t) * TAU;
      sy *= 0.85; sx *= 1.08;
      if (rig) { rig.legL.rotation.x = -1.0; rig.legR.rotation.x = -1.0; rig.armL.rotation.x = -1.2; }
      armRx = -1.2;
    }
    if (this.state === 'hurt') { this.inner.rotation.x = -0.3; }
    if (this.state === 'item') {
      armRx = -2.9; armRz = 0.3;
      if (rig) { rig.armL.rotation.x = -2.9; rig.armL.rotation.z = -0.3; }
      swordRx = 0.55;
      sy *= 1 + Math.sin(time * 8) * 0.02;
    }
    if (this.state === 'dizzy') {
      this.spin.rotation.z = Math.min(1.3, (this.dizzyT || 0) * 3);
      this.inner.rotation.y = Math.sin(time * 6) * 0.2;
    }
    this.arm.rotation.set(armRx, armRy, armRz);
    this.swordPivot.rotation.set(swordRx, 0, swordRz);
    this.spin.scale.set(sx, sy, sx);
    // trail
    this.trail.update(dt);
    // hurt flash + blink
    const fl = Math.max(this.flash, 0);
    for (const m of this.mats) m.userData.flash && (m.userData.flash.value = fl * 0.8);
    this.root.visible = !(this.iframes > 0 && this.state !== 'dash' && this.state !== 'item' && this.state !== 'dizzy' && Math.floor(time * 14) % 2 === 0);
    this.held.position.y = 1.45 * this.height + Math.sin(time * 3) * 0.05;
    if (this.held.children.length && G.camera) { this.held.lookAt(G.camera.position); this.held.rotateZ(Math.sin(time * 2.5) * 0.15); }
  }
}
