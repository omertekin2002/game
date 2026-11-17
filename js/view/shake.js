// Trauma shake (feel §6.5): additive trauma, linear decay, intensity = trauma². Rotation only in FP; TP adds a small
// translation. Smooth value noise sampled on real time, so the shake frequency never depends on the frame rate.
import { view as T } from '../tune.js';
import { clamp } from '../util.js';

const D2R = Math.PI / 180;
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(t, seed) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return (hash(i + seed * 101) * (1 - u) + hash(i + 1 + seed * 101) * u) * 2 - 1; }

export class Shake {
  constructor() {
    this.trauma = 0; this.t = 0; this.seed = 0;
    this.p = 0; this.y = 0; this.r = 0;        // radians
    this.dx = 0; this.dy = 0; this.dz = 0;     // metres (TP only)
  }
  /** legacy amount scale (0.15..1.2); dist (m) to the source attenuates when given */
  add(amount, dist = null) {
    const k = dist == null ? 1 : clamp(1 - (dist - 3) / 22, 0.2, 1);
    this.trauma = Math.min(1, this.trauma + amount * 0.75 * k);
  }
  reset() { this.trauma = 0; this.p = this.y = this.r = this.dx = this.dy = this.dz = 0; }
  /** scale = settings.shake (× comfort); tpK 0..1 = how third-person the pose is; noRoll under motion comfort */
  update(dt, scale, tpK, noRoll) {
    this.trauma = Math.max(0, this.trauma - T.shakeDecay * dt);
    this.t += dt * T.shakeHz;
    const s = this.trauma * this.trauma * scale * (1 - tpK * (1 - T.shakeTP));
    if (s <= 0) { this.p = this.y = this.r = this.dx = this.dy = this.dz = 0; return; }
    const t = this.t, m = T.shakeMax, o = this.seed;
    this.p = vnoise(t, o + 1) * m[0] * D2R * s;
    this.y = vnoise(t, o + 2) * m[1] * D2R * s;
    this.r = noRoll ? 0 : vnoise(t, o + 3) * m[2] * D2R * s;
    const mv = T.shakeTPMove * s * tpK;
    this.dx = vnoise(t, o + 4) * mv; this.dy = vnoise(t, o + 5) * mv; this.dz = vnoise(t, o + 6) * mv;
  }
}
