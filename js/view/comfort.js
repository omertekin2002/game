// Comfort settings (feel §13) as live scale factors for every camera layer WP1 adds (view/feel.js, lockon.js, shots.js).
// Motion comfort (`reduceMotion`) is genuinely calm: no head bob, no roll of any kind (strafe, bob, dash lean, hurt tilt,
// shake roll, dizzy topple), no FOV pulses (sprint, dash, hit punch), no camera wobble or orbit, small eye dips only.
// Context FOV channels (dialogue, item-get, boss intro…) are slow (λ 4) and stay on, as feel §6.7 rules.
import { clamp } from '../util.js';
import { view as T } from '../tune.js';

const KEYS = ['headBob', 'shake', 'speedFx', 'cameraRoll', 'reduceMotion', 'dialogueLookAt', 'lockTurnsCamera'];

export class Comfort {
  constructor(settings) {
    this.settings = settings;
    this.refresh();
    this.off = settings.on('*', (v, k) => { if (KEYS.includes(k)) this.refresh(); });
  }
  refresh() {
    const S = this.settings, num = (k, d) => { const v = +S.get(k); return Number.isFinite(v) ? clamp(v, 0, 1) : d; };
    const rm = !!S.get('reduceMotion');
    this.reduce = rm;
    this.bob = rm ? 0 : num('headBob', 1);                    // head bob (Full 1 / Reduced 0.4 / Off 0)
    this.shake = num('shake', 1) * (rm ? T.comfortShake : 1);  // trauma shake (view.js applies the same rule)
    this.speed = rm ? 0 : num('speedFx', 1);                  // FOV pulses, dash lean / nod, hit punches, speed lines
    this.roll = !rm && S.get('cameraRoll') !== false;         // any camera roll
    this.dip = rm ? T.comfortDip : 1;                         // landing / dash / hurt eye dips and kicks
    this.motion = !rm;                                        // wobble, orbit, topple (dizzy cams), crane sway
    this.lookAt = S.get('dialogueLookAt') !== false;          // dialogue / cinematic look assists
    this.lockCam = S.get('lockTurnsCamera') !== false;        // lock-on turns the camera
    return this;
  }
  info() { return { reduce: this.reduce, bob: this.bob, shake: this.shake, speed: this.speed, roll: this.roll, dip: this.dip, motion: this.motion, lookAt: this.lookAt, lockCam: this.lockCam }; }
}
