// Villagers: gentle idle/wander, little hop when talked to. WP5 (art §10): they notice Pip — eye contact (head turn,
// or a slow body turn for the GLB villagers) from TUNE.actors.npcLook m, a wave once Pip comes within npcWave m (again
// after he has left the look range), the whole body faces him inside npcWave and while talking, and a wandering villager
// closer than npcBackHop m when a talk starts hops back a little so the FP framing never crops the face. A stay-at-home
// villager (wander 0: Miso behind her shop counter) keeps her spot: the world stages her where its colliders (the counter,
// the shop front) overlap her circle, so she never hops, and anything that moves her walks her straight back.
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { makeModel } from './assets.js';
import { instRig, npcDef } from './models.js';
import { moveCircle } from './phys.js';
import { dampAngle, wrapAngle, rand, len2, TAU, angDiff, clamp, damp } from './util.js';
import { actors as TA } from './tune.js';

const _box = new THREE.Box3();

export class NPC {
  constructor(def, spot) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.key = def.key;
    this.home = { x: spot.x, z: spot.z };
    this.homeRot = spot.rot ?? 0;           // a stay-at-home villager (wander 0) turns back to this after a chat
    this.pos = new THREE.Vector3(spot.x, G.world.ground(spot.x, spot.z), spot.z);
    this.prev = this.pos.clone();
    this.facing = spot.rot ?? 0;
    this.prevFacing = this.facing;
    this.r = 0.38;
    this.state = 'idle'; this.st = rand(1, 3);
    this.talking = false;
    this.hop = 0; this.hopV = 0;
    this.ph = rand(0, TAU);
    this.look = 0; this.lookYaw = 0;      // eye contact: 0..1 and the head's turn relative to the body (rad)
    this.waveT = 0; this.waved = false;   // wave: time left (s); waved once until Pip leaves the look range
    this.backHop = null;
    this.root = new THREE.Group();
    const glb = makeModel(def.key);
    if (glb) { this.root.add(glb.group); this.nodes = {}; this.mats = glb.materials; this.glbGroup = glb.group; }
    else { const r = instRig(npcDef(def.id)); this.root.add(r.root); this.nodes = r.nodes; this.mats = r.mats; }
    if (!glb) this.root.scale.setScalar(def.id === 'shellby' ? 1.1 : 1.05);
    G.scene.add(this.root);
    // model height (once): hurtbox top and the face point the crosshair aims at
    this.root.position.copy(this.pos);
    this.root.updateMatrixWorld(true);
    const h = _box.setFromObject(this.root).max.y - this.pos.y;
    this.height = h > 0.5 && h < 3 ? h : 1.2;
  }
  hurtbox(out = {}) {
    out.x = this.pos.x; out.z = this.pos.z; out.r = this.r; out.y0 = this.pos.y; out.y1 = this.pos.y + this.height;
    return out;
  }
  /** blob shadow (render; arch §8.2 extension point) */
  blob(out) { out.x = this.root.position.x; out.y = this.pos.y; out.z = this.root.position.z; out.r = 0.45; return out; }
  talkStart() {
    this.talking = true;
    this.hopV = 2.6;
    this.waveT = 0;
    // too close for a face-to-face framing: hop back a little (away from Pip). Not a stay-at-home villager: her counter
    // keeps Pip at a speaking distance, and a hop through the colliders that overlap her spot would eject her from it
    const pl = G.player;
    if (pl && this.def.wander) {
      const dx = this.pos.x - pl.pos.x, dz = this.pos.z - pl.pos.z, d = Math.hypot(dx, dz);
      if (d < TA.npcBackHop) this.backHop = { x: d > 1e-3 ? dx / d : Math.sin(this.facing), z: d > 1e-3 ? dz / d : Math.cos(this.facing), left: TA.npcBackHop + 0.25 - d };
    }
  }
  talkEnd() { this.talking = false; this.st = rand(1.5, 3); this.state = 'idle'; this.backHop = null; }
  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.st -= dt;
    this.hopV -= 14 * dt;
    this.hop = Math.max(0, this.hop + this.hopV * dt);
    if (this.hop === 0 && this.hopV < 0) this.hopV = 0;
    this.waveT = Math.max(0, this.waveT - dt);
    const pl = G.player;
    const d = len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z), toP = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    // eye contact within npcLook: the head turns to Pip (clamped ±60°), the rest of the turn is the body's job
    const sees = this.talking || d < TA.npcLook;
    this.look = damp(this.look, sees ? 1 : 0, 6, dt);
    this.lookYaw = clamp(angDiff(this.facing, toP), -1.05, 1.05);
    if (d > TA.npcLook + 0.5) this.waved = false;
    if (!this.talking && !this.waved && d < TA.npcWave) {
      this.waved = true; this.waveT = 1.3;
      sfx('hello', { x: this.pos.x, y: this.pos.y + this.height * 0.8, z: this.pos.z, vol: 0.7 });
    }
    if (this.backHop) {
      const s = Math.min(this.backHop.left, dt * 2.2);
      if (s > 0) moveCircle(G.world, this, this.backHop.x * s, this.backHop.z * s, { r: this.r, extra: [{ x: pl.pos.x, z: pl.pos.z, r: pl.r }] });
      this.backHop.left -= s;
      this.pos.y = G.world.ground(this.pos.x, this.pos.z);
      if (this.backHop.left <= 0) this.backHop = null;
    }
    // a stay-at-home villager (wander 0, a shopkeeper) something moved shuffles back to her spot as soon as the talk is
    // over (still facing Pip while he is close), straight back: her spot overlaps the counter's and the shop's colliders,
    // so a collider-resolved walk could never reach it (the old "stuck: this is home now" stranded her). Only Pip, standing
    // in the way, makes her wait
    const wander = this.def.wander || 0;
    let homing = false;
    if (!wander && !this.talking && !this.backHop) {
      const away = len2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      if (away > 0.02) {
        const a = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z), s = Math.min(away, TA.npcHome * dt);
        const nx = this.pos.x + Math.sin(a) * s, nz = this.pos.z + Math.cos(a) * s;
        if (len2(pl.pos.x - nx, pl.pos.z - nz) >= this.r + pl.r) { this.pos.x = nx; this.pos.z = nz; }
        this.pos.y = G.world.ground(this.pos.x, this.pos.z);
        homing = true;
        if (d >= TA.npcWave) { this.state = 'walk'; this.facing = dampAngle(this.facing, a, 6, dt); return; }
      }
    }
    if (this.talking || d < TA.npcWave) {
      this.facing = dampAngle(this.facing, toP, 8, dt);
      this.state = homing ? 'walk' : 'idle';
      return;
    }
    // the GLB villagers have no head node: inside the look range their whole body turns slowly instead
    if (this.glbGroup && sees) this.facing = dampAngle(this.facing, toP, 2.2, dt);
    if (!wander) {
      this.state = 'idle';
      if (!(this.glbGroup && sees)) this.facing = dampAngle(this.facing, this.homeRot ?? this.facing, 2, dt);
      return;
    }
    if (sees && this.state === 'walk') { this.state = 'idle'; this.st = rand(1.5, 3); }   // stop to look at Pip
    if (this.state === 'idle' && this.st <= 0 && !sees) {
      this.state = 'walk';
      this.st = rand(1.0, 2.2);
      const toHome = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      const away = len2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      this.dir = away > wander * 0.6 ? toHome + rand(-0.5, 0.5) : rand(0, TAU);
    } else if (this.state === 'walk') {
      const sp = 0.9;
      this.facing = dampAngle(this.facing, this.dir, 6, dt);
      moveCircle(G.world, this, Math.sin(this.dir) * sp * dt, Math.cos(this.dir) * sp * dt, { r: this.r, extra: [{ x: pl.pos.x, z: pl.pos.z, r: pl.r }] });
      if (len2(this.home.x - this.pos.x, this.home.z - this.pos.z) > wander + 0.5) this.dir = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      this.pos.y = G.world.ground(this.pos.x, this.pos.z);
      if (this.st <= 0) { this.state = 'idle'; this.st = rand(2, 5); }
    }
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    p.y += this.hop;
    this.root.rotation.y = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    const n = this.nodes;
    const walking = this.state === 'walk';
    const ph = time * 9 + this.ph;
    const wave = this.waveT > 0 ? Math.sin(Math.min(1, this.waveT / 0.25) * Math.PI / 2) * Math.min(1, (1.3 - this.waveT) / 0.2 + 0.01) : 0;
    if (this.glbGroup) {
      const g = this.glbGroup;
      g.rotation.z = walking ? Math.sin(ph) * 0.07 : Math.sin(time * 1.2 + this.ph) * 0.025 + wave * Math.sin(time * 14) * 0.08;
      g.rotation.x = this.talking ? Math.sin(time * 8) * 0.04 : 0;
      g.position.y = walking ? Math.abs(Math.sin(ph)) * 0.05 : wave * Math.abs(Math.sin(time * 9)) * 0.06;
      g.scale.set(1 - Math.sin(time * 2.4 + this.ph) * 0.01, 1 + Math.sin(time * 2.4 + this.ph) * 0.02, 1);
    }
    if (n.body) {
      n.body.rotation.z = walking ? Math.sin(ph) * 0.08 : Math.sin(time * 1.2 + this.ph) * 0.03;
      n.body.position.y = walking ? Math.abs(Math.sin(ph)) * 0.04 : 0;
      n.body.scale.y = 1 + Math.sin(time * 2.4 + this.ph) * 0.02;
    }
    // eye contact: the head turns toward Pip (and tilts a little while listening)
    if (n.head) n.head.rotation.set(this.talking ? Math.sin(time * 8) * 0.06 : 0, this.lookYaw * this.look, this.talking ? Math.sin(time * 3) * 0.08 : Math.sin(time * 0.9 + this.ph) * 0.05 + wave * 0.12);
    if (n.armL) {
      n.armL.rotation.x = walking ? -Math.sin(ph) * 0.5 : 0;
      n.armR.rotation.x = walking ? Math.sin(ph) * 0.5 : 0;
      n.armL.rotation.z = this.talking ? -0.4 - Math.abs(Math.sin(time * 6)) * 0.4 : 0;
      // a wave: the right arm up and swinging
      n.armR.rotation.z = wave > 0 ? -(2.3 * wave + Math.sin(time * 14) * 0.35 * wave) : 0;
    }
  }
}
