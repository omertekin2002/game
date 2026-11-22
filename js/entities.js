// Enemies (6 types), projectiles, pickups, blob shadows. The enemy spawner lives in spawn.js.
// WP5 readability rules for a 0.88 m eye (TUNE.actors): every attack is announced with EV.TELEGRAPH (C3) when its
// wind-up starts (t = seconds until it can hit), and an enemy only starts one inside TA.reach[type] (the farthest its
// attack can land on a standing Pip; further out it just closes in, without a token, telegraph or chirp). The wind-ups
// are longer, with a soft coral halo, a body pulse (TA.rimColors), a glint at the business end and an exaggerated
// pose; at most TA.tokens enemies wind up or attack at once (attack tokens); a source off the screen announces
// TA.announce s early and winds up TA.announceAdd longer; enemies pop a '!' with a chirp when they notice Pip; contact
// damage needs a vertical overlap and an attack state (the bee only hurts while diving); spawns in view emerge (C16).
// Every enemy carries hp / maxHp / name (C5).
import * as THREE from 'three';
import { G, sfx } from './core.js';
import { CFG, ENEMY } from './data.js';
import { EV } from './events.js';
import { instRig, enemyDef, gemBuilt, heartBuilt, seedBuilt, projectileBuilt } from './models.js';
import { makeModel } from './assets.js';
import { toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { moveCircle } from './phys.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, rand, pick, TAU, len2, angDiff, Ease } from './util.js';
import { actors as TA } from './tune.js';
import { emitter } from './audio-bus.js';

const D2R = Math.PI / 180;
const _hb = {};
const RIM = new THREE.Color(TA.rimColor), WHITE = new THREE.Color(1, 1, 1);
// the wind-up body pulse colour per type: a tint toward coral (or cream) turns the olive slime and the yellow bee
// muddy / grey, so those brighten toward a vivid version of their own hue (the coral halo carries the colour code)
const RIMS = {};
for (const ty in ENEMY) RIMS[ty] = new THREE.Color((TA.rimColors && TA.rimColors[ty]) ?? TA.rimColor);
// wind-up halo: width, height (m) and centre height over the body origin, per type (elliptical: a ground enemy's halo
// ends at its feet instead of sinking into the ground)
const AURA = { slime: [1.75, 1.3, 0.48], mushroom: [1.6, 1.5, 0.52], bat: [1.6, 1.25, 0.04], bee: [1.4, 1.2, 0.06], crab: [1.9, 1.3, 0.5], snowpuff: [1.65, 1.65, 0.47] };
const _ws = {};

/** C3: an attack is coming. t = seconds until it can hit; o adds fields (announce: true for off-view early warnings) */
export function telegraph(source, kind, x, y, z, t, o) {
  const ev = G.events;
  if (!ev) return;
  const p = { kind, x, y, z, t, source };
  if (o) Object.assign(p, o);
  ev.emit(EV.TELEGRAPH, p);
}
/** C18: ask the HUD (WP6) for a hint, once per page load per id; text may hold key tokens (C7) */
const hinted = new Set();
export function hint(id, text) {
  if (hinted.has(id) || !G.events) return;
  hinted.add(id);
  G.events.emit(EV.HINT, { id, text });
}
/** tests: let a hint id be emitted again */
export function hintReset(id) { hinted.delete(id); }
/** off the screen: behind the camera or past TA.offEdge of the half-width (whatever the FOV, aspect or view mode);
 *  y = the source's body height (default Pip's feet + 0.5). Without a projecting view: further than TA.offView degrees
 *  from the look yaw */
export function offView(x, z, y) {
  const v = G.view, p = G.player && G.player.pos;
  if (!v || !p) return false;
  if (typeof v.worldToScreen === 'function' && v.camera) {
    const s = v.worldToScreen({ x, y: Number.isFinite(y) ? y : p.y + 0.5, z }, _ws);
    if (Number.isFinite(s.ndcX)) return s.behind || Math.abs(s.ndcX) > TA.offEdge;
  }
  return Math.abs(angDiff(v.yaw, Math.atan2(x - p.x, z - p.z))) > TA.offView * D2R;
}
/** attack tokens: at most TA.tokens living enemies hold one (announce, wind-up or attack) */
function takeToken(e) {
  if (e.token) return true;
  let n = 0;
  for (const o of G.game.enemies) if (o !== e && o.alive && o.token) n++;
  if (n >= TA.tokens) return false;
  return (e.token = true);
}

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
// hurt volume [y0, y1] above the body origin (feet + altitude + hop), measured from the procedural models
const HURT_Y = { slime: [0, 0.74], mushroom: [0, 0.8], bat: [-0.3, 0.38], bee: [-0.25, 0.4], crab: [0, 0.8], snowpuff: [-0.14, 0.94] };
// wind-up state, the attack states that follow it (both hold a token), the TELEGRAPH kind
const ATTACK = {
  slime: { wind: 'crouch', states: ['crouch', 'hop'], kind: 'lunge' },
  mushroom: { wind: 'puff', states: ['puff'], kind: 'shot' },
  bat: { wind: 'rise', states: ['rise', 'swoop'], kind: 'lunge' },
  bee: { wind: 'aim', states: ['aim', 'dive'], kind: 'lunge' },
  crab: { wind: 'windup', states: ['windup', 'charge'], kind: 'charge' },
  snowpuff: { wind: 'windup', states: ['windup'], kind: 'shot' },
};
// the business end (body-local, before facing) where the wind-up glint flashes
const GLINT = { slime: [0, 0.78, 0.1], mushroom: [0, 0.95, 0.05], bat: [0, 0.05, 0.24], bee: [0, -0.2, -0.22], crab: [0, 0.75, 0.25], snowpuff: [0, 1.15, 0] };
const EMERGE_KINDS = new Set(['ground', 'sky', 'water', 'bush']);

export class Enemy {
  constructor(type, x, z, o = {}) {
    this.type = type;
    this.def = ENEMY[type];
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;                 // C5: the HUD's pips
    this.name = this.def.name || type;        // C5: the HUD's display name
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
    this.token = false; this.noticed = false; this.forgetT = 0; this.noticeT = 0;
    this.windT = 0; this.windDur = 0; this.emergeT = null;
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
  /** sim-space hurt volume: vertical cylinder { x, z, r, y0, y1 } (arch §8.2 extension point) */
  hurtbox(out = {}) {
    const b = HURT_Y[this.type] || HURT_Y.slime, y = this.pos.y + this.altCur + (this.hop || 0);
    out.x = this.pos.x; out.z = this.pos.z; out.r = this.r; out.y0 = y + b[0]; out.y1 = y + b[1];
    return out;
  }
  /** C16: the spawner calls it for spawns that could be in view: 'ground' | 'sky' | 'water' | 'bush' ('spawn' or
   *  anything else → the type's own way, ENEMY[type].emerge). TA.emerge s, harmless while it runs */
  emerge(kind = 'spawn') {
    if (!EMERGE_KINDS.has(kind)) kind = this.def.emerge || 'ground';
    this.emergeKind = kind; this.emergeT = 0; this.spawnT = 1;
    const x = this.pos.x, y = this.pos.y, z = this.pos.z, fx = G.fx;
    if (!fx) return this;
    if (kind === 'ground') {
      if (this.type === 'crab') fx.dust(x, y, z, 10, 0xf6e2b0);
      else if (this.type === 'mushroom') for (let i = 0; i < 3; i++) fx.sparkle(x, y + 0.4, z, 0xfff4a0, 1, 0.3);
      else { const b = fx.ground.band(x, y, z, { r: 0.42, w: 0.14, h: 0.01, wallA: 0, floorA: 0.55, color: 0x8cc63a, edge: 0xd8f0b0 }); b.fade = 1.1; b.manual = false; }
    } else if (kind === 'sky') {
      if (this.type === 'snowpuff') for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; fx.norm.spawn({ x: x + Math.sin(a) * 1.1, y: y + 0.4 + (i % 5) * 0.12, z: z + Math.cos(a) * 1.1, vx: -Math.sin(a) * 1.4 + Math.cos(a) * 1.6, vy: 0.2, vz: -Math.cos(a) * 1.4 - Math.sin(a) * 1.6, drag: 1.5, life: 0.7, size: 0.13, color: 0xffffff, shape: 3 }); }
      else fx.leaves(x, y + this.alt + 2.8, z, 4);
    } else if (kind === 'bush') fx.leaves(x, y + 0.4, z, 8);
    else if (kind === 'water') fx.splash(x, Math.max(0, y), z, 10);
    sfx('emerge_' + kind, { x, y: y + 0.3, z });
    return this;
  }
  get emerging() { return this.emergeT != null && this.emergeT < TA.emerge; }
  /** in a wind-up or an attack (what attack tokens limit; the announce beat holds a token but is neither) */
  get attacking() { return this.token && this.state !== 'announce' && ATTACK[this.type].states.includes(this.state) && (this.type !== 'slime' || this.hopAttack); }
  /** blob shadow (render): { x, y, z, r } into out, or null for none (arch §8.2 extension point; game.render adds it) */
  blob(out) {
    if (this.emerging && this.emergeKind !== 'sky') return null;
    out.x = this.root.position.x; out.y = this.pos.y; out.z = this.root.position.z; out.r = this.r * (this.def.flying ? 0.8 : 1.05);
    return out;
  }
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
  /** first sight of Pip: '!' pop + a positional chirp + a short head-turn pause */
  notice() {
    this.noticed = true; this.forgetT = 0; this.noticeT = 0.35;
    this.cool = Math.max(this.cool, 0.6);
    const top = (HURT_Y[this.type] || HURT_Y.slime)[1] + this.alt;
    if (G.fx) G.fx.ground.alert(this, top);
    sfx('alert', { x: this.pos.x, y: this.pos.y + top, z: this.pos.z });
  }
  /** cooldown is up and Pip in range: token → (off-view: announce) → wind-up. false = refused, retry soon */
  tryAttack() {
    if (!takeToken(this)) { this.cool = rand(TA.tokenRetry[0], TA.tokenRetry[1]); this.st = Math.max(this.st, 0.2); return false; }
    const A = ATTACK[this.type], off = this.offView();
    const wind = TA.windup[this.type] + (off ? TA.announceAdd : 0);
    if (this.type === 'slime') this.hopAttack = true;
    if (off) {
      this.pend = wind; this.state = 'announce'; this.st = TA.announce;
      const p = this.glintPos();
      telegraph(this, A.kind, p.x, p.y, p.z, TA.announce + wind + this.lead(), { announce: true, offView: true });
    } else this.beginWind(wind, false);
    return true;
  }
  /** seconds between the end of the wind-up and the first moment the attack can hurt */
  lead() { return this.type === 'slime' ? TA.slimeHopGate : 0; }
  /** Pip can still reach this attack: the AI starts a token / telegraph / wind-up only inside TA.reach[type] */
  inReach(d) { return d < (TA.reach[this.type] ?? 6); }
  /** off the screen (offView), judged at the middle of its body */
  offView() { const b = HURT_Y[this.type] || HURT_Y.slime; return offView(this.pos.x, this.pos.z, this.pos.y + this.altCur + (b[0] + b[1]) / 2); }
  beginWind(wind, off) {
    const A = ATTACK[this.type];
    this.state = A.wind; this.st = wind; this.windDur = wind; this.windT = 0;
    if (this.type === 'bat') this.waitT = 0;
    const p = this.glintPos(), au = AURA[this.type] || AURA.slime;
    if (G.fx) {
      G.fx.ground.glint(p.x, p.y, p.z);
      G.fx.ground.aura(this, { size: au[0], sizeY: au[1], h: au[2], dur: wind + 0.05, until: () => this.alive && this.state === A.wind });
    }
    telegraph(this, A.kind, p.x, p.y, p.z, wind + this.lead(), off ? { offView: true } : undefined);
  }
  glintPos(out = {}) {
    const g = GLINT[this.type] || GLINT.slime, s = Math.sin(this.facing), c = Math.cos(this.facing);
    out.x = this.pos.x + g[0] * c + g[2] * s; out.y = this.pos.y + this.altCur + (this.hop || 0) + g[1]; out.z = this.pos.z - g[0] * s + g[2] * c;
    return out;
  }
  update(dt) {
    this.prev.copy(this.pos);
    this.prevFacing = this.facing;
    this.spawnT = Math.min(1, this.spawnT + dt * 3);
    this.iframes = Math.max(0, this.iframes - dt);
    this.flash = Math.max(0, this.flash - dt * 7);
    this.squash *= Math.exp(-10 * dt);
    if (this.emerging) { this.emergeT += dt; return; }       // C16: harmless and still while emerging
    this.st -= dt;
    this.cool -= dt;
    this.windT += dt;
    this.noticeT = Math.max(0, this.noticeT - dt);
    const pl = G.player;
    const d = this.dist();
    const toP = this.dirTo();
    if (!this.noticed) { if (d < TA.notice && pl.state !== 'dizzy') this.notice(); }
    else if (d > TA.forget) { this.forgetT += dt; if (this.forgetT > TA.forgetT) { this.noticed = false; this.forgetT = 0; } }
    else this.forgetT = 0;
    const active = this.noticed && pl.state !== 'dizzy';
    const ready = active && this.noticeT <= 0;
    let mx = 0, mz = 0;
    const W = G.world;
    if (this.state === 'announce') {
      // the off-view early warning: hold still facing Pip, then the (longer) wind-up
      this.facing = dampAngle(this.facing, toP, 8, dt);
      if (this.st <= 0) this.beginWind(this.pend, true);
    } else switch (this.type) {
      case 'slime': {
        if (this.state === 'idle') {
          this.facing = dampAngle(this.facing, active ? toP : this.facing, 6, dt);
          if (this.st <= 0) {
            // within an attack hop of Pip: attack (token → telegraph → crouch); out of reach: a plain approach hop (no
            // token, telegraph or chirp, like the old slime); not noticed / dizzy: wander
            const hop = (side, near) => { this.state = 'crouch'; this.st = 0.3; this.hopAttack = false; this.hopSide = side; this.hopNear = near; };
            if (ready && this.inReach(d)) { if (!this.tryAttack() && Math.random() < 0.5) hop(true, false); }
            else hop(false, ready);
          }
        } else if (this.state === 'crouch') {
          this.squash = Math.min(1, this.squash + dt * (this.hopAttack ? 4 : 6));
          if (this.hopAttack || this.hopNear) this.facing = dampAngle(this.facing, toP, 10, dt);
          if (this.st <= 0) {
            this.state = 'hop'; this.st = 0.46; this.hopT = 0;
            // an attack hop goes at Pip; an approach hop lands about 1.7 m short of him; a tokenless slime in reach hops
            // sideways around him; an idle one wanders
            const a = this.hopAttack ? toP + rand(-0.2, 0.2) : this.hopSide ? toP + (Math.random() < 0.5 ? 1.4 : -1.4) : this.hopNear ? toP + rand(-0.3, 0.3) : rand(0, TAU);
            const sp = this.hopAttack ? 4.4 : this.hopNear ? clamp((d - 1.7) / 0.46, 1.8, 4.4) : 1.8;
            this.vel.set(Math.sin(a) * sp, Math.cos(a) * sp);
            if (this.hopAttack || this.hopNear) this.facing = a;
            sfx('boing', { x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z, vol: this.hopAttack ? 1 : 0.6 });
          }
        } else if (this.state === 'hop') {
          this.hopT += dt;
          this.hop = Math.sin((this.hopT / 0.46) * Math.PI) * 0.6;
          mx = this.vel.x; mz = this.vel.y;
          if (this.st <= 0) { this.state = 'idle'; this.st = active ? rand(0.35, 0.7) : rand(0.8, 1.6); this.hop = 0; this.squash = 1; this.hopAttack = this.hopNear = false; G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 3, 0xd8f0b0); }
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
          if (ready && this.inReach(d) && this.cool <= 0) this.tryAttack();
        } else if (this.state === 'puff') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          if (this.st <= 0) {
            G.game.spawnProjectile('spore', this.pos.x + Math.sin(this.facing) * 0.4, this.pos.y + 0.55, this.pos.z + Math.cos(this.facing) * 0.4, toP, 3.2);
            sfx('shoot', { x: this.pos.x, y: this.pos.y + 0.6, z: this.pos.z });
            this.squash = -0.8;
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
            if (ready && this.cool <= 0 && this.inReach(d)) {
              // prefer to swoop from inside the view: wait for the orbit to bring it round, then announce anyway
              this.waitT = (this.waitT || 0) + dt;
              if (!this.offView() || this.waitT > TA.batWait) this.tryAttack();
            }
          } else {
            this.wa = (this.wa ?? rand(0, TAU)) + rand(-1, 1) * dt;
            mx = Math.sin(this.wa) * 1.4; mz = Math.cos(this.wa) * 1.4;
            this.facing = dampAngle(this.facing, this.wa, 4, dt);
          }
          this.alt = 1.5 + Math.sin(this.ph * 3) * 0.25;
        } else if (this.state === 'rise') {
          this.alt = 2.1; this.facing = dampAngle(this.facing, toP, 12, dt);
          if (this.st <= 0) { this.state = 'swoop'; this.st = 0.55; this.sw = toP; sfx('swoop', { x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }); }
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
          if (ready && this.inReach(d) && this.cool <= 0) this.tryAttack();
        } else if (this.state === 'aim') {
          this.facing = dampAngle(this.facing, toP, 14, dt); this.dv = this.facing;
          this.alt = 1.3;
          if (this.st <= 0) { this.state = 'dive'; this.st = 0.45; sfx('zip', { x: this.pos.x, y: this.pos.y + 1.2, z: this.pos.z }); }
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
          if (ready && this.inReach(d) && this.cool <= 0) this.tryAttack();
        } else if (this.state === 'windup') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          if (this.st <= 0) { this.state = 'charge'; this.st = 0.85; this.cd = this.facing; sfx('scuttle', { x: this.pos.x, y: this.pos.y + 0.3, z: this.pos.z }); }
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
            let sp = 0;
            const a = toP;
            if (d < 5) { sp = -2.2; } else if (d > 9) sp = 1.8;
            mx = Math.sin(a) * sp + Math.sin(a + Math.PI / 2) * Math.sin(this.ph) * 1.2;
            mz = Math.cos(a) * sp + Math.cos(a + Math.PI / 2) * Math.sin(this.ph) * 1.2;
            if (ready && this.cool <= 0 && this.inReach(d)) this.tryAttack();
          } else {
            this.wa = (this.wa ?? rand(0, TAU)) + rand(-1, 1) * dt;
            mx = Math.sin(this.wa) * 0.9; mz = Math.cos(this.wa) * 0.9;
          }
        } else if (this.state === 'windup') {
          this.facing = dampAngle(this.facing, toP, 10, dt);
          if (this.st <= 0) { this.throwSnowball(d); this.state = 'idle'; this.cool = rand(1.8, 2.4); }
        }
        break;
      }
    }
    if (this.token && !this.holdsToken()) this.token = false;
    // knockback
    if (this.knock.lengthSq() > 0.01) { mx += this.knock.x; mz += this.knock.y; this.knock.multiplyScalar(Math.exp(-8 * dt)); }
    const blocked = this.move(mx * dt, mz * dt);
    if (blocked && this.type === 'crab' && this.state === 'charge') { this.state = 'rest'; this.st = 0.9; G.fx.dust(this.pos.x, this.pos.y, this.pos.z, 4); }
    const gy = W.ground(this.pos.x, this.pos.z);
    this.pos.y = Math.max(gy, this.def.flying ? -0.2 : gy);
    this.altCur = damp(this.altCur, this.alt, this.state === 'swoop' || this.state === 'dive' ? 8 : 4, dt);
    this.contact(pl, d);
  }
  holdsToken() { return this.state === 'announce' || (ATTACK[this.type].states.includes(this.state) && (this.type !== 'slime' || this.hopAttack)); }
  /** contact: Pip's body [feet, feet + TA.bodyH] overlapping this hurtbox. Only attacks hurt (a slime's attack hop once
   *  it has been airborne TA.slimeHopGate s, a swooping bat, a diving bee, a charging crab); anything else bumps */
  contact(pl, d) {
    if (d >= this.r + pl.r + 0.05 || this.spawnT <= 0.5) return;
    const hb = this.hurtbox(_hb);
    if (hb.y1 < pl.pos.y || hb.y0 > pl.pos.y + TA.bodyH) return;
    const s = this.state;
    const hurts = TA.passiveContact || (this.type === 'slime' && s === 'hop' && this.hopAttack && this.hopT >= TA.slimeHopGate) ||
      (this.type === 'bat' && s === 'swoop') || (this.type === 'bee' && s === 'dive') || (this.type === 'crab' && s === 'charge');
    if (hurts) { G.game.playerHurt(1, this.pos.x, this.pos.z); return; }
    // a bump: the enemy hops back a little (Pip's FP eye never jolts)
    const a = Math.atan2(this.pos.x - pl.pos.x, this.pos.z - pl.pos.z);
    if (this.knock.lengthSq() < 4) this.knock.set(Math.sin(a) * 2.6, Math.cos(a) * 2.6);
  }
  /** snowpuff: a flat throw at Pip's chest (flight TA.snowT, apex ≲ 1.6 m over the eye) with a landing reticle */
  throwSnowball(d) {
    const pl = G.player, g = 9;
    const x0 = this.pos.x, y0 = this.pos.y + this.altCur + 1.05, z0 = this.pos.z;
    const T = clamp(d / TA.snowK, TA.snowT[0], TA.snowT[1]);
    const yT = pl.pos.y + 0.5, ang = Math.atan2(pl.pos.x - x0, pl.pos.z - z0);
    const vy = (g * T) / 2 + (yT - y0) / T;
    G.game.spawnProjectile('snowball', x0, y0, z0, ang, d / T, { vy, grav: g, target: { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, T }, whistle: true });
    sfx('throw', { x: x0, y: y0, z: z0 });
    this.squash = -0.6;
  }
  /** returns 'hit' | 'clink' | 'dead' | null; breakGuard (the C chop) goes through a raised crab claw. swing: the
   *  sword's swingId — i-frames only guard against the swing that caused them (each swing hits a target once anyway),
   *  so a chained swing that crosses the target sooner than 0.25 s after the last one still lands */
  hit(dmg, fx, fz, knock = 6.5, breakGuard = false, swing = null) {
    if (!this.alive || (this.iframes > 0 && (swing == null || swing === this.iframeSwing))) return null;
    if (this.emerging && this.emergeT < TA.emerge * 0.5) return null;   // still underground / not there yet
    this.iframeSwing = swing;
    const a = Math.atan2(fx - this.pos.x, fz - this.pos.z);
    if (!breakGuard && this.type === 'crab' && (this.state === 'charge' || this.state === 'windup') && Math.abs(angDiff(this.facing, a)) < 1.0) {
      this.iframes = 0.2;
      this.knock.set(-Math.sin(a) * 2, -Math.cos(a) * 2);
      return 'clink';
    }
    this.hp -= dmg;
    this.iframes = 0.25;
    this.flash = 1;
    this.squash = 0.8;
    this.knock.set(-Math.sin(a) * knock, -Math.cos(a) * knock);
    if (!this.noticed) { this.noticed = true; this.noticeT = 0; }
    // flinch: a hit cancels a slime's hop or crouch (its wind-up), a bat's / bee's attack and a snowpuff's throw wind-up
    if (this.type === 'slime' && (this.state === 'hop' || this.state === 'crouch')) { this.state = 'idle'; this.st = 0.5; this.hop = 0; this.hopAttack = this.hopNear = false; }
    if (this.type === 'bat' || this.type === 'bee') { this.state = 'recover'; this.st = 0.5; this.sw = this.dv = this.facing; }
    if (this.type === 'snowpuff' && this.state === 'windup') { this.state = 'idle'; this.cool = rand(0.8, 1.2); }
    if (this.state === 'announce') { this.state = 'idle'; this.st = 0.4; }
    if (this.token && !this.holdsToken()) this.token = false;
    if (this.hp <= 0) { this.alive = false; this.token = false; return 'dead'; }
    return 'hit';
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    p.y += this.altCur + (this.hop || 0);
    this.root.rotation.y = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    this.root.rotation.x = 0;
    let sp = Ease.outBack(Math.min(1, this.spawnT));
    let sx = 1, sy = 1;
    const sq = this.squash;
    sy -= sq * 0.3; sx += sq * 0.2;
    const n = this.nodes;
    const breathe = Math.sin(time * 3 + this.ph) * 0.03;
    // wind-up progress (0 → 1) and the exaggerated poses (art §9.1)
    const wind = this.attacking && this.state === ATTACK[this.type].wind ? clamp(this.windT / Math.max(0.05, this.windDur), 0, 1) : 0;
    const ann = this.state === 'announce';
    switch (this.type) {
      case 'slime': {
        if (this.state === 'hop') { sy += 0.22 * Math.sin((this.hopT / 0.46) * Math.PI); sx -= 0.1; }
        if (wind) { const sh = Math.sin(time * 60) * 0.03 * wind; sx += sh; }
        sy += breathe; sx -= breathe;
        break;
      }
      case 'mushroom': {
        const walk = this.state === 'walk';
        if (n.legL) { n.legL.rotation.x = walk ? Math.sin(time * 12) * 0.6 : 0; n.legR.rotation.x = walk ? -Math.sin(time * 12) * 0.6 : 0; }
        if (n.body) n.body.rotation.z = walk ? Math.sin(time * 12) * 0.08 : 0;
        // the cap inflates to ×1.4 through the wind-up, then the puff squashes it
        if (n.cap) n.cap.scale.setScalar(this.state === 'puff' ? 1 + 0.4 * Ease.outCubic(wind) + Math.sin(time * 40) * 0.03 * wind : 1 + breathe + Math.max(0, -this.squash) * 0.3);
        break;
      }
      case 'bat': {
        const folded = this.state === 'rise';
        const f = this.state === 'swoop' ? 22 : 14;
        if (n.wingL) {
          // wings fold back during the rise (a dart-shaped silhouette), flap hard in the swoop
          n.wingL.rotation.z = folded ? 1.25 + Math.sin(time * 30) * 0.08 : Math.sin(time * f + this.ph) * 0.9;
          n.wingR.rotation.z = folded ? -1.25 - Math.sin(time * 30) * 0.08 : -Math.sin(time * f + this.ph) * 0.9;
        }
        if (n.body) n.body.rotation.x = this.state === 'swoop' ? 0.6 : folded ? -0.35 * wind : 0.1;
        break;
      }
      case 'bee': {
        const f = this.state === 'aim' ? 70 : 40;
        if (n.wingL) { n.wingL.rotation.z = Math.sin(time * f) * 0.7; n.wingR.rotation.z = -Math.sin(time * f) * 0.7; }
        if (n.body) {
          // rears back (nose up, stinger tucked forward) through the aim, dives nose-first
          n.body.rotation.x = this.state === 'dive' ? 0.7 : this.state === 'aim' ? -0.9 * Ease.outCubic(wind) : 0;
          n.body.position.x = this.state === 'aim' ? Math.sin(time * 60) * 0.03 : 0;
        }
        break;
      }
      case 'crab': {
        const up = this.state === 'windup' || this.state === 'charge';
        if (n.clawL) {
          const open = this.state === 'windup' ? 0.25 * Math.abs(Math.sin(time * 14)) : 0;
          n.clawL.rotation.z = up ? -0.75 - open + Math.sin(time * 30) * 0.05 : Math.sin(time * 4) * 0.15;
          n.clawR.rotation.z = up ? 0.75 + open - Math.sin(time * 30) * 0.05 : -Math.sin(time * 4 + 1) * 0.15;
          n.clawL.rotation.x = up ? -0.6 : 0; n.clawR.rotation.x = up ? -0.6 : 0;
        }
        if (n.legs) n.legs.rotation.z = Math.sin(time * 18) * 0.06;
        if (n.body) n.body.position.y = Math.abs(Math.sin(time * 18)) * 0.03 + (this.state === 'windup' ? 0.06 * wind : 0);
        break;
      }
      case 'snowpuff': {
        if (n.top) n.top.rotation.y = time * 2;
        sy += breathe + 0.12 * wind; sx += breathe - 0.05 * wind;
        // lifts a snowball overhead through the wind-up
        if (this.state === 'windup' || this.heldBall) {
          if (!this.heldBall) {
            projMat.m = projMat.m || toonMat({ glow: true, nearFade: true });
            this.heldBall = meshWithOutline(projectileBuilt('snowball'), projMat.m, sharedOutline('char'), { cast: false });
            this.heldBall.position.set(0, 1.05, 0);
            this.root.add(this.heldBall);
          }
          const k = this.state === 'windup' ? Ease.outBack(Math.min(1, wind * 1.6)) : 0;
          this.heldBall.visible = k > 0.01;
          this.heldBall.scale.setScalar(Math.max(0.001, k));
        }
        break;
      }
    }
    // C16 emerge: rise out of the ground / drop from the sky / sprout
    if (this.emerging) {
      const e = clamp(this.emergeT / TA.emerge, 0, 1), k = this.emergeKind;
      if (k === 'sky') { p.y += (1 - Ease.outCubic(e)) * 3.2; sp = this.type === 'snowpuff' ? Ease.outBack(e) : 1; this.root.rotation.y += (1 - e) * 6; }
      else if (k === 'water') p.y -= (1 - Ease.outCubic(e)) * 0.9;
      else if (this.type === 'mushroom') sp = Ease.outBack(e);
      else { p.y -= (1 - Ease.outBack(e)) * 0.85; sx += Math.sin(e * Math.PI) * 0.15; }
    }
    this.root.scale.set(sx * sp, sy * sp, sx * sp);
    // flash: white on a hit; a pulse through the wind-up (and the off-view announce beat), toward light coral or, for
    // green / yellow / orange bodies, cream (TA.rimColors). Motion comfort holds it steady at about the pulse's mean
    const calm = !!(G.settings && G.settings.get('reduceMotion'));
    const rim = wind > 0 || ann ? TA.rimFlash * (calm ? TA.rimCalm : 0.55 + 0.45 * Math.sin(time * TA.rimHz * TAU)) : 0;
    const hitF = this.flash * 0.9, useHit = hitF >= rim;
    for (const m of this.mats) {
      m.userData.flash.value = useHit ? hitF : rim;
      if (m.userData.flashColor) m.userData.flashColor.value.copy(useHit ? WHITE : RIMS[this.type] || RIM);
    }
  }
  remove() {
    G.scene.remove(this.root);
    for (const m of this.mats) m.dispose();
  }
}

// ---------------------------------------------------------------- projectiles
const projMat = { m: null };
const TRAIL = { spore: 0xe0b8ff, bubble: 0xc8f0ff, snowball: 0xffffff };
export class Projectile {
  constructor(kind, x, y, z, ang, speed, o = {}) {
    this.kind = kind;
    this.pos = new THREE.Vector3(x, y, z);
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector3(Math.sin(ang) * speed, o.vy || 0, Math.cos(ang) * speed);
    this.grav = o.grav || 0;
    this.r = o.r ?? (kind === 'bubble' ? 0.3 : 0.24);
    this.life = o.life ?? (kind === 'snowball' ? 4 : 5);
    this.dmg = o.dmg ?? 1;
    this.poppable = o.poppable ?? true;    // snowballs too: at eye level they come straight at the face
    this.alive = true;
    this.t = 0; this.trailT = 0;
    this.scale = o.scale ?? 1;
    projMat.m = projMat.m || toonMat({ glow: true, nearFade: true });   // C11: spores fly at the face
    this.root = meshWithOutline(projectileBuilt(kind), projMat.m, sharedOutline('char'), { cast: false });
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(this.scale);
    G.scene.add(this.root);
    // a lobbed ball's landing reticle: a coral ring + 0.4 m light band shrinking 1.0 → 0.3 m over the flight
    this.target = o.target || null;
    if (this.target && G.fx) this.reticle = G.fx.ground.band(this.target.x, this.target.y, this.target.z, { r: TA.reticle[0], w: 0.025, h: TA.reticleH, wallA: 0.32, floorA: 0.55, top: 0.14 });
    if (o.whistle) this.voice = emitter('whistle', { x, y, z, dur: this.target ? this.target.T : 0.9 });
  }
  hurtbox(out = {}) {
    const r = this.r * this.scale;
    out.x = this.pos.x; out.z = this.pos.z; out.r = r; out.y0 = this.pos.y - r; out.y1 = this.pos.y + r;
    return out;
  }
  /** blob shadow on the ground under it, so its height reads at eye level (art §9.1) */
  blob(out) {
    const p = this.root.position, g = Math.max(G.world.ground(p.x, p.z), -0.25), h = Math.max(0, p.y - g);
    out.x = p.x; out.y = g; out.z = p.z; out.r = this.r * this.scale * clamp(1.25 - h * 0.12, 0.6, 1.25);
    return out;
  }
  update(dt) {
    this.prev.copy(this.pos);
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
    if (this.reticle && this.reticle.active) {
      const k = clamp(this.t / Math.max(0.2, this.target.T), 0, 1);
      this.reticle.m.material.uniforms.uR.value = lerp(TA.reticle[0], TA.reticle[1], k);
      this.reticle.m.material.uniforms.uA.value = 0.6 + 0.4 * k;
      if (this.t > this.target.T + 0.35) G.fx.ground.remove(this.reticle);
    }
    if (this.voice) this.voice.set(this.pos.x, this.pos.y, this.pos.z);
    // a soft trail: 3 puffs per 0.1 s in the projectile's colour
    this.trailT -= dt;
    if (this.trailT <= 0 && G.fx) { this.trailT = 0.033; G.fx.norm.spawn({ x: this.pos.x, y: this.pos.y, z: this.pos.z, life: 0.35, size: 0.22 * this.scale, size1: 0.05, color: TRAIL[this.kind] || 0xffffff, alpha: 0.35, shape: 0 }); }
    // contact: horizontal reach + vertical overlap with Pip's body (a jump clears ground-skimming shots)
    const pl = G.player, r = this.r * this.scale;
    if (len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < r + pl.r && this.pos.y + r >= pl.pos.y && this.pos.y - r <= pl.pos.y + TA.bodyH) {
      if (G.game.playerHurt(this.dmg, this.pos.x - this.vel.x, this.pos.z - this.vel.z, undefined, 'projectile')) return this.pop(true);
    }
  }
  pop(fx = true) {
    if (!this.alive) return;
    this.alive = false;
    if (this.reticle) G.fx.ground.remove(this.reticle);
    if (this.voice) { this.voice.stop(); this.voice = null; }
    if (fx) {
      const p = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
      if (this.kind === 'snowball') { G.fx.snowBurst(p.x, p.y, p.z, 10, 0.7); sfx('snow', p); }
      else if (this.kind === 'bubble') { G.fx.splash(p.x, p.y, p.z, 8); sfx('bubble', p); }
      else { G.fx.poof(p.x, p.y, p.z, 0xe0b8ff, 6, 0.6); sfx('pop', p); }
    }
    G.scene.remove(this.root);
  }
  render(alpha, time) {
    this.root.position.lerpVectors(this.prev, this.pos, alpha);
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
    this.prev = this.pos.clone();
    this.ground = y;
    let a = rand(0, TAU), s = o.spread ?? rand(1, 2.6), vy = o.vy ?? rand(4, 6);
    // r4 first person (TUNE.actors.drops): away from Pip and low, never up through the eye line in front of the lens
    const pl = G.player, D = TA.drops;
    if (kind !== 'seed' && pl && G.view && G.view.mode === 'fp') {
      const dx = x - pl.pos.x, dz = z - pl.pos.z;
      if (dx * dx + dz * dz > 1e-6) a = Math.atan2(dx, dz) + rand(-1, 1) * D.awayDeg * Math.PI / 180;
      if (o.spread == null) s = rand(D.speed[0], D.speed[1]);
      if (o.vy == null) vy = Math.min(vy, D.vyMax);
    }
    this.vel = new THREE.Vector3(Math.sin(a) * s, vy, Math.cos(a) * s);
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
    this.prev.copy(this.pos);
    this.t += dt;
    if (this.t > this.life) { this.remove(); return; }
    const pl = G.player;
    const d = len2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    if (this.kind !== 'seed' && this.t > 0.35 && d < CFG.pickupMagnet) this.magnet = true;
    if (this.magnet) {
      // r4: first person pulls to the feet, height first (under the crosshair before it is close); TP to his chest
      const fp = !!(G.view && G.view.blend < 0.5), D = TA.drops, k = Math.min(1, dt * 12), ky = fp ? Math.min(1, dt * 12 * D.magnetYK) : k;
      this.pos.x += (pl.pos.x - this.pos.x) * k;
      this.pos.z += (pl.pos.z - this.pos.z) * k;
      this.pos.y += (pl.pos.y + (fp ? D.magnetY : 0.5) - this.pos.y) * ky;
    } else if (!this.landed) {
      this.vel.y -= 18 * dt;
      this.pos.addScaledVector(this.vel, dt);
      const g = Math.max(G.world.ground(this.pos.x, this.pos.z), 0);
      this.ground = g;
      if (this.pos.y < g + 0.3) {
        this.pos.y = g + 0.3;
        if (this.vel.y < -2) { this.vel.y *= -0.45; this.vel.x *= 0.6; this.vel.z *= 0.6; sfx('tink', { x: this.pos.x, y: this.pos.y, z: this.pos.z, vol: 0.5 }); }
        else { this.landed = true; }
      }
    }
    const reach = this.kind === 'seed' ? 1.2 : 0.7;
    if (d < reach && this.t > (this.kind === 'seed' ? 1.2 : 0.25)) { G.game.collect(this); this.remove(); }
  }
  remove() { if (!this.alive) return; this.alive = false; G.scene.remove(this.root); }
  /** blob shadow on the landing ground (seeds glow instead: none) */
  blob(out) {
    if (this.kind === 'seed') return null;
    out.x = this.root.position.x; out.y = this.ground ?? this.pos.y; out.z = this.root.position.z; out.r = 0.18;
    return out;
  }
  render(alpha, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    if (this.landed || this.kind === 'seed') p.y += Math.sin(time * 3 + this.pos.x) * 0.08 + (this.kind === 'seed' ? 0.8 : 0.05);
    this.root.rotation.set(this.kind === 'gem' ? 0 : -0.55, time * (this.kind === 'seed' ? 1.2 : 2.5), 0, 'YXZ');
    const left = this.life - this.t;
    this.root.visible = !(left < 3 && Math.floor(time * 10) % 2 === 0);
    if (this.kind === 'seed' && Math.random() < 0.3) G.fx.sparkle(p.x, p.y, p.z, 0xfff4b0, 1, 0.7);
  }
}
