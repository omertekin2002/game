// Villagers: gentle idle/wander, turn to face Pip when talked to, little hop.
import * as THREE from 'three';
import { G } from './core.js';
import { makeModel } from './assets.js';
import { instRig, npcDef } from './models.js';
import { moveCircle } from './phys.js';
import { dampAngle, wrapAngle, rand, len2, TAU } from './util.js';

export class NPC {
  constructor(def, spot) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.key = def.key;
    this.home = { x: spot.x, z: spot.z };
    this.pos = new THREE.Vector3(spot.x, G.world.ground(spot.x, spot.z), spot.z);
    this.prev = this.pos.clone();
    this.facing = spot.rot ?? 0;
    this.prevFacing = this.facing;
    this.r = 0.38;
    this.state = 'idle'; this.st = rand(1, 3);
    this.talking = false;
    this.hop = 0; this.hopV = 0;
    this.ph = rand(0, TAU);
    this.root = new THREE.Group();
    const glb = makeModel(def.key);
    if (glb) { this.root.add(glb.group); this.nodes = {}; this.mats = glb.materials; this.glbGroup = glb.group; }
    else { const r = instRig(npcDef(def.id)); this.root.add(r.root); this.nodes = r.nodes; this.mats = r.mats; }
    if (!glb) this.root.scale.setScalar(def.id === 'shellby' ? 1.1 : 1.05);
    G.scene.add(this.root);
  }
  talkStart() {
    this.talking = true;
    this.hopV = 2.6;
  }
  talkEnd() { this.talking = false; this.st = rand(1.5, 3); this.state = 'idle'; }
  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.st -= dt;
    this.hopV -= 14 * dt;
    this.hop = Math.max(0, this.hop + this.hopV * dt);
    if (this.hop === 0 && this.hopV < 0) this.hopV = 0;
    const pl = G.player;
    const d = len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (this.talking || d < 2.6) {
      this.facing = dampAngle(this.facing, Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z), 8, dt);
      this.state = 'idle';
      return;
    }
    const wander = this.def.wander || 0;
    if (!wander) { this.facing = dampAngle(this.facing, this.homeRot ?? this.facing, 2, dt); return; }
    if (this.state === 'idle' && this.st <= 0) {
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
    if (this.glbGroup) {
      const g = this.glbGroup;
      g.rotation.z = walking ? Math.sin(ph) * 0.07 : Math.sin(time * 1.2 + this.ph) * 0.025;
      g.rotation.x = this.talking ? Math.sin(time * 8) * 0.04 : 0;
      g.position.y = walking ? Math.abs(Math.sin(ph)) * 0.05 : 0;
      g.scale.set(1 - Math.sin(time * 2.4 + this.ph) * 0.01, 1 + Math.sin(time * 2.4 + this.ph) * 0.02, 1);
    }
    if (n.body) {
      n.body.rotation.z = walking ? Math.sin(ph) * 0.08 : Math.sin(time * 1.2 + this.ph) * 0.03;
      n.body.position.y = walking ? Math.abs(Math.sin(ph)) * 0.04 : 0;
      n.body.scale.y = 1 + Math.sin(time * 2.4 + this.ph) * 0.02;
    }
    if (n.head) n.head.rotation.set(this.talking ? Math.sin(time * 8) * 0.06 : 0, 0, this.talking ? Math.sin(time * 3) * 0.08 : Math.sin(time * 0.9 + this.ph) * 0.05);
    if (n.armL) {
      n.armL.rotation.x = walking ? -Math.sin(ph) * 0.5 : 0;
      n.armR.rotation.x = walking ? Math.sin(ph) * 0.5 : 0;
      n.armL.rotation.z = this.talking ? -0.4 - Math.abs(Math.sin(time * 6)) * 0.4 : 0;
    }
  }
}
