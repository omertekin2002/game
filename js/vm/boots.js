// WP2: Pip's boots in first person (art §2).
// The boots live in the main scene on the WORLD layer and never cast shadows: two little boots under the eye that step
// with the stride, faded in as the look pitch goes below −35° … −40°, only while the camera is in Pip's head.
import * as THREE from 'three';
import { toonMat, outlineMat, meshWithOutline } from '../toon.js';
import { bootBuilt } from './rig.js';
import { ditherToon, ditherOutline } from './dither.js';
import { clamp, LAYER } from '../util.js';

const D2R = Math.PI / 180;

export class Boots {
  constructor(scene, T) {
    this.T = T;
    this.fade = { value: 0 };
    const mat = ditherToon(toonMat({ glow: false }), this.fade), ol = ditherOutline(outlineMat({ width: 0.016 }), this.fade);
    const built = bootBuilt();
    this.group = new THREE.Group();
    this.group.name = 'wp2-boots';
    this.group.userData.cull = { dist: Infinity };   // C10: always at Pip's feet, never distance-culled
    this.feet = [-1, 1].map((sd) => {
      const g = meshWithOutline(built, mat, ol, { cast: false });
      g.userData.side = sd;
      this.group.add(g);
      return g;
    });
    this.group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.layers.set(LAYER.WORLD); });
    this.group.visible = false;
    scene.add(this.group);
    this.k = 0;
  }
  /** feet = render feet (pl.root.position), yaw = body facing, pitch = look pitch (rad), show = camera in the head;
   *  ph = the stride phase this frame (viewmodel's interpolated Stride; r2: the per-step walkPhase ticked at 60 Hz) */
  update(pl, view, show, dt, ph = pl.walkPhase) {
    const T = this.T, p0 = T.bootsPitch[0] * D2R, p1 = T.bootsPitch[1] * D2R;
    const want = show ? clamp((p0 - view.pitch) / (p0 - p1), 0, 1) : 0;
    this.k = show ? want : 0;
    this.fade.value = this.k;
    this.group.visible = this.k > 0.001;
    if (!this.group.visible) return;
    const f = pl.root.position, yaw = view.yaw, sx = Math.sin(yaw), cz = Math.cos(yaw);
    const moving = pl.vel.length() > 0.4 && (pl.state === 'normal' || pl.state === 'attack');
    const grounded = pl.grounded !== false;
    for (const g of this.feet) {
      const sd = g.userData.side;
      // fore-aft stepping with the stride (opposite feet), a small lift on the forward swing
      const step = moving && grounded ? Math.sin(ph) * sd * T.bootsStep : 0;
      const lift = moving && grounded ? Math.max(0, Math.sin(ph) * sd) * 0.03 : 0;
      const fwd = T.bootsFwd + step, side = sd * T.bootsSide;
      g.position.set(f.x + sx * fwd - cz * side, f.y + lift, f.z + cz * fwd + sx * side);
      g.rotation.set(-lift * 2, yaw, 0, 'YXZ');
    }
  }
}
