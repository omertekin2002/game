// Enemy spawning, despawn and cuttable regrowth for the eye-level camera (Game mixin; arch WP4). Nothing may pop into
// existence where the player is looking:
// - the view cone is the look yaw ± (horizontal FOV/2 + coneAdd), measured from the render camera (TP: behind Pip);
// - a spawn never lands inside the cone closer than spawnClear (24 m): a candidate bearing inside the cone is pushed out
//   to spawnClear..spawnFar, and every spawn calls enemy.emerge(kind) (C16: 'ground' | 'sky' | 'water' | 'bush'), so
//   WP5 grows it in wherever the player happens to look;
// - bearings are weighted 2:1 toward the forward cone (±spawnFwdDeg of the movement direction, else of the look), so
//   encounters come into view ahead instead of from behind;
// - a ground critter (slime, mushroom, bee) whose spot is next to a bush pops out of that bush;
// - despawn only out of the cone (+despawnCone) beyond CFG.despawnDist, or anywhere beyond despawnFar;
// - grass / bushes / pots regrow only out of the cone beyond regrowNear, or anywhere beyond regrowFar.
import { G } from './core.js';
import { CFG, REGIONS, REGION } from './data.js';
import { Enemy } from './entities.js';
import { rand, TAU, len2, angDiff, yawOf } from './util.js';
import { combat as TC } from './tune.js';
import { hudFields } from './combat.js';

const D2R = Math.PI / 180;
const _near = [];
const BUSHY = { slime: 1, mushroom: 1, bee: 1 };

/** where the view cone is measured from: the render camera while it is out of Pip's head (TP), else Pip */
export function coneOrigin(game) {
  const v = game.view, c = game.camera;
  return v && v.bodyOut && c ? c.position : game.player.pos;
}
/** is (x, z) inside the view cone (look yaw ± horizontal FOV/2 + addDeg), seen from the camera (TP) or Pip (FP)? */
export function inViewCone(game, x, z, addDeg = TC.coneAdd) {
  const v = game.view, p = coneOrigin(game);
  return Math.abs(angDiff(v.yaw, yawOf(x - p.x, z - p.z))) < (v.fovH / 2 + addDeg) * D2R;
}
/** the emerge style for a spawn (C16) */
function emergeKind(W, type, x, z, bush) {
  if (bush) return 'bush';
  if (type === 'bat' || type === 'bee') return 'sky';
  if (type === 'crab') {
    for (let a = 0; a < 6; a++) if (W.hAt(x + Math.sin(a) * 2, z + Math.cos(a) * 2) < 0.05) return 'water';
  }
  return 'ground';
}

export const SpawnMixin = {
  updateSpawning(dt) {
    const pl = this.player;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.playing && !this.fight) { this.spawnT = 1.3; trySpawnEnemy(this); }
    for (const e of this.enemies) {
      if (e.minion) continue;
      const d = len2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
      if (d > TC.despawnFar || (d > CFG.despawnDist && !inViewCone(this, e.pos.x, e.pos.z, TC.despawnCone))) { e.remove(); e.removed = true; }
    }
    this.enemies = this.enemies.filter((e) => !e.removed);
  },
  updateRegrowth(dt) {
    const pl = this.player;
    for (const r of this.regrow) r.t -= dt;
    this.regrow = this.regrow.filter((r) => {
      if (r.t > 0) return true;
      const o = r.o, d = len2(o.x - pl.pos.x, o.z - pl.pos.z);
      if (d < TC.regrowFar && (d < TC.regrowNear || inViewCone(this, o.x, o.z, TC.despawnCone))) { r.t = 5; return true; }
      o.cut = false;
      this.scenery.show(o);
      if (o.collider) o.collider.active = true;
      return false;
    });
  },
};

/** one spawn attempt (every 1.3 s while playing, no fight) → the new Enemy or null */
export function trySpawnEnemy(game) {
  const pl = game.player, W = game.world, v = game.view;
  const reg = W.regionAt(pl.pos.x, pl.pos.z);
  const R = REGIONS[reg];
  if (!R || !R.enemies.length) return null;
  const night = G.sky ? G.sky.night : 0;
  const max = Math.min(CFG.maxEnemies, R.max);
  const live = game.enemies.filter((e) => !e.minion && e.alive).length;
  if (live >= max) return null;
  // forward: where Pip is heading, else where the player looks; 2:1 per degree toward the ±spawnFwdDeg cone
  const sp = Math.hypot(pl.vel.x, pl.vel.y), fwd = sp > 1 ? yawOf(pl.vel.x, pl.vel.y) : v.yaw;
  const fw = TC.spawnFwdDeg * D2R, wf = TC.spawnFwdW * 2 * fw, pF = wf / (wf + TAU - 2 * fw);
  const o = coneOrigin(game), back = len2(o.x - pl.pos.x, o.z - pl.pos.z);
  for (let tries = 0; tries < 12; tries++) {
    const a = Math.random() < pF ? fwd + rand(-fw, fw) : fwd + fw + rand(0, TAU - 2 * fw);
    let dist = rand(TC.spawnNear, TC.spawnRing);
    let x = pl.pos.x + Math.sin(a) * dist, z = pl.pos.z + Math.cos(a) * dist;
    if (inViewCone(game, x, z)) {                    // in view: far enough out that it emerges at the fog-soft distance
      dist = rand(TC.spawnClear, TC.spawnFar) + back;
      x = pl.pos.x + Math.sin(a) * dist; z = pl.pos.z + Math.cos(a) * dist;
    }
    const r2 = W.regionAt(x, z);
    if (r2 === REGION.VILLAGE || len2(x, z) < 38) continue;
    if (W.inArena(x, z, 6)) continue;
    if (!W.walkable(x, z) || W.hAt(x, z) < 0.3) continue;
    const ci = Math.floor(x + 180), cj = Math.floor(z + 180);
    if (W.reach && !W.reach[cj * 360 + ci]) continue;
    // type by region table (+bats at night)
    const tbl = REGIONS[r2].enemies.length ? REGIONS[r2].enemies.slice() : R.enemies.slice();
    if (night > 0.5 && (r2 === REGION.WOODS || r2 === REGION.MEADOW)) tbl.push(['bat', r2 === REGION.WOODS ? 6 : 3]);
    const tot = tbl.reduce((s, t) => s + t[1], 0);
    let roll = Math.random() * tot, type = tbl[0][0];
    for (const [t, w] of tbl) { roll -= w; if (roll <= 0) { type = t; break; } }
    // a bush next to the spot: the critter pops out of it (on Pip's side of the bush)
    let bush = null;
    if (BUSHY[type]) {
      let bd = TC.bushSnap;
      for (const c of W.nearColliders(x, z, TC.bushSnap, _near)) {
        if (c.kind !== 'bush' || !c.active || (c.prop && c.prop.cut)) continue;
        const d = len2(c.x - x, c.z - z);
        if (d < bd) { bd = d; bush = c; }
      }
      if (bush) {
        const dx = pl.pos.x - bush.x, dz = pl.pos.z - bush.z, l = len2(dx, dz) || 1, off = bush.r + 0.5;
        const bx = bush.x + (dx / l) * off, bz = bush.z + (dz / l) * off;
        if (W.walkable(bx, bz) && W.hAt(bx, bz) >= 0.3) { x = bx; z = bz; } else bush = null;
      }
    }
    // the rule itself, measured where the critter really lands
    if (inViewCone(game, x, z) && len2(x - o.x, z - o.z) < TC.spawnClear) continue;
    const e = new Enemy(type, x, z);
    hudFields(e);
    game.addEnemy(e);
    e.emerge(emergeKind(W, type, x, z, !!bush));
    return e;
  }
  return null;
}
