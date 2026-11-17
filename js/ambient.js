// Region ambient particles + pedestal seed sparkles (Game mixin; WP8, art §4.5 / §8). Spawn volumes are view-relative:
// a disc of TUNE.atmo.ambR around the camera + its horizontal look × ambAhead, heights relative to the EYE (falling
// leaves / snow drift through eye height) or to the ground under the point (butterflies, fireflies), and nothing spawns
// within ambClear of the eye. The old top-down gull shadow sprites are gone (atmo.js flies real gulls).
import { REGIONS, REGION, SEED_ORDER, SEEDS } from './data.js';
import { SHAPE } from './fx.js';
import { rand, pick } from './util.js';
import { atmo as TA } from './tune.js';

const SH = (k, d) => (SHAPE && SHAPE[k] !== undefined ? SHAPE[k] : d);   // WP7 may rename the atlas shapes
const P = { x: 0, y: 0, z: 0, g: 0 };

export const AmbientMixin = {
  /** a random point of the view volume: xz in the disc, y = base + [lo, hi] where base is the eye (rel 'eye') or the
   *  ground under the point (rel 'ground'); null when it lands too close to the eye */
  ambPoint(lo, hi, rel = 'eye') {
    const c = this.camera.position, v = this.view, W = this.world;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const r = TA.ambR * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    P.x = c.x + fx * TA.ambAhead + Math.cos(a) * r;
    P.z = c.z + fz * TA.ambAhead + Math.sin(a) * r;
    P.g = W.hAt(P.x, P.z);
    P.y = (rel === 'ground' ? P.g : c.y) + rand(lo, hi);
    if (P.y < P.g + 0.15) P.y = P.g + 0.15;
    const dx = P.x - c.x, dy = P.y - c.y, dz = P.z - c.z;
    return dx * dx + dy * dy + dz * dz < TA.ambClear * TA.ambClear ? null : P;
  },
  updateAmbient(dt) {
    const fx = this.fx, reg = this.curRegion, night = this.sky.night;
    const id = REGIONS[reg] ? REGIONS[reg].ambient : null;
    const N_ = fx.norm, A = fx.add;
    let p;
    if (id === 'leaves' && N_.count('amb') < 40 && Math.random() < dt * 9 && (p = this.ambPoint(1, 7))) {
      N_.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-0.3, 0.6), vy: rand(-1.1, -0.6), vz: rand(-0.2, 0.4), life: 8, size: rand(0.16, 0.24), color: pick([0x7ccf55, 0xa6d94f, 0xe3b24f, 0x5fae46, 0xd98a3a]), shape: SH('LEAF', 2), vr: rand(-3, 3), sway: 1.2, tag: 'amb', fadeIn: 0.6, floor: p.g + 0.03 });
    }
    // woods: dust motes drifting in the light shafts (daytime)
    if (id === 'leaves' && night < 0.3 && A.count('mote') < 14 && Math.random() < dt * 4) {
      const S = this.atmoShafts && this.atmoShafts.visible ? this.atmoShafts.userData.spots : null, c = this.camera.position;
      const s = S && S[(Math.random() * S.length) | 0];
      // spot: ground point, width, beam axis + length (atmo.js); motes drift in the lit lower part of the beam
      const u = s ? rand(0.08, 0.5) * (s[7] || 4) : 0;
      if (s && (s[0] - c.x) ** 2 + (s[2] - c.z) ** 2 < 35 * 35) A.spawn({ x: s[0] + (s[4] || 0) * u + rand(-0.4, 0.4), y: s[1] + (s[5] ?? 1) * u, z: s[2] + (s[6] || 0) * u + rand(-0.4, 0.4), life: rand(3, 5), size: rand(0.03, 0.06), color: 0xfff4d0, shape: SH('SOFT', 0), wander: 0.25, alpha: 0.7, tag: 'mote', fadeIn: 1 });
    }
    if (id === 'snow' && N_.count('amb') < 120 && Math.random() < dt * 40 && (p = this.ambPoint(-1, 9))) {
      N_.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(-0.8, -0.2), vy: rand(-1.6, -0.9), life: 7, size: rand(0.06, 0.13), color: 0xffffff, shape: SH('DOT', 3), sway: 0.5, tag: 'amb', fadeIn: 0.5, floor: p.g + 0.02 });
    }
    // peaks, first person: a small breath puff below the view every ~3.2 s (art §4.5)
    if (id === 'snow' && !this.view.bodyOut && this.playing) {
      this.breathT = (this.breathT ?? 1.5) - dt;
      if (this.breathT <= 0) {
        this.breathT = rand(2.8, 3.6);
        const c = this.camera.position, v = this.view, pl = this.player, fx_ = Math.sin(v.yaw), fz = Math.cos(v.yaw);
        N_.spawn({ x: c.x + fx_ * 0.8, y: c.y - 0.3, z: c.z + fz * 0.8, vx: pl.vel.x + fx_ * 0.4, vy: 0.12, vz: pl.vel.y + fz * 0.4, life: 1.0, size: 0.12, size1: 0.34, color: 0xffffff, alpha: 0.35, shape: SH('SOFT', 0), drag: 1.5, tag: 'breath', fadeIn: 0.12 });
      }
    }
    if (id === 'butterflies') {
      if (N_.count('bfly') < 7 && Math.random() < dt * 1.2 && (p = this.ambPoint(0.6, 2, 'ground'))) {
        N_.spawn({ x: p.x, y: p.y, z: p.z, life: rand(8, 12), size: 0.26, color: pick([0xffb3d1, 0xfff08a, 0xb8e0ff, 0xffffff, 0xffc890]), shape: SH('LEAF', 2), wander: 3, flutter: 16, tag: 'bfly', fadeIn: 0.8 });
      }
      if (N_.count('amb') < 30 && Math.random() < dt * 3 && (p = this.ambPoint(-0.3, 3))) {
        N_.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(0.1, 0.5), vy: rand(0.0, 0.2), life: rand(6, 9), size: rand(0.05, 0.09), color: 0xfff3c4, shape: SH('DOT', 3), sway: 0.4, wander: 0.4, tag: 'amb', fadeIn: 0.8, alpha: 0.8 });
      }
    }
    if (id === 'fluff' && N_.count('amb') < 25 && Math.random() < dt * 3 && (p = this.ambPoint(-0.5, 4))) {
      N_.spawn({ x: p.x, y: p.y, z: p.z, vx: rand(0.2, 0.7), vy: rand(0.05, 0.3), life: rand(6, 9), size: rand(0.08, 0.13), color: 0xffffff, shape: SH('DOT', 3), sway: 0.4, wander: 0.4, tag: 'amb', fadeIn: 0.8, alpha: 0.85 });
    }
    if (id === 'sea' && A.count('amb') < 30 && Math.random() < dt * 14 && (p = this.ambPoint(0, 0, 'ground')) && p.g < -0.25) {
      A.spawn({ x: p.x, y: 0.12, z: p.z, life: rand(0.5, 1.0), size: rand(0.2, 0.4), size1: 0.02, color: 0xffffff, shape: SH('STAR', 1), tag: 'amb', fadeIn: 0.2 });
    }
    // nights: fireflies everywhere but the peaks, which get a faint snow sparkle on the ground instead
    if (night > 0.35 && reg !== REGION.PEAKS && A.count('fly') < 26 && Math.random() < dt * 5 * night && (p = this.ambPoint(0.4, 1.8, 'ground'))) {
      A.spawn({ x: p.x, y: p.y, z: p.z, life: rand(4, 7), size: rand(0.16, 0.26), color: pick([0xe8ff8a, 0xfff4a0, 0xb8ff9a]), shape: SH('SOFT', 0), wander: 1.2, flutter: 3, tag: 'fly', fadeIn: 1 });
    }
    if (night > 0.35 && reg === REGION.PEAKS && A.count('glint') < 20 && Math.random() < dt * 8 * night && (p = this.ambPoint(0.03, 0.06, 'ground'))) {
      A.spawn({ x: p.x, y: p.y, z: p.z, life: rand(0.5, 1.1), size: rand(0.06, 0.12), size1: 0.01, color: 0xdfeaff, shape: SH('STAR', 1), tag: 'glint', fadeIn: 0.2 });
    }
    if (this.S.ending && reg === REGION.VILLAGE && N_.count('amb') < 40 && Math.random() < dt * 4 && (p = this.ambPoint(3, 5))) fx.petals(p.x, p.y, p.z, 1, 4);
    // pedestal seed sparkles
    for (let i = 0; i < 3; i++) if (this.pedSeeds[i].visible && Math.random() < dt * 3) { const q = this.pedSeeds[i].position; fx.sparkle(q.x, q.y, q.z, SEEDS[SEED_ORDER[i]].glow, 1, 0.3); }
  },
};
