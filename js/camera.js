// Third-person 3/4 overhead follow camera with orbit/zoom, terrain clearance, cutscene shots, shake,
// and the screen-space occluder fade uniforms.
import * as THREE from 'three';
import { U } from './toon.js';
import { clamp, damp, lerp, Ease, TAU } from './util.js';
import { G } from './core.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.yawTarget = 0;
    this.pitch = THREE.MathUtils.degToRad(40);
    this.pitchTarget = this.pitch;
    this.dist = 13.5;
    this.distTarget = 13.5;
    this.focus = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.lookAhead = new THREE.Vector3();
    this.shakeAmt = 0;
    this.scale = { yaw: 1, pitch: 1 }; // sensitivity × invert, from settings (camScale)
    this.reducedMotion = false;        // settings: no shake
    this.shot = null;      // { pos, look, dur, t, hold }
    this.shotW = 0;
    this.bias = null;      // { x, z, w, dist } — extra framing (boss fights)
    this.basePos = new THREE.Vector3();
  }
  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }
  shake(a) { if (this.reducedMotion) return; this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }
  snap(target) {
    this.focus.copy(target);
    this.lookAhead.set(0, 0, 0);
    this.yaw = this.yawTarget;
    this.dist = this.distTarget;
    this.pitch = this.pitchTarget;
    this.shotW = 0;
  }
  setShot(pos, look, o = {}) { this.shot = { pos: pos.clone(), look: look.clone(), speed: o.speed ?? 1.4 }; }
  clearShot() { this.shot = null; }
  update(dt, target, vel, input, allowControl) {
    if (input && allowControl) {
      const ky = this.scale.yaw, kp = this.scale.pitch;
      this.yawTarget += input.takeOrbit() * ky;
      if (input.held('camL')) this.yawTarget += dt * 2.2 * ky;
      if (input.held('camR')) this.yawTarget -= dt * 2.2 * ky;
      if (input.padCam) this.yawTarget -= input.padCam * dt * 2.6 * ky;
      const w = input.takeWheel();
      if (w) this.distTarget = clamp(this.distTarget + w * 1.2, 6.5, 24);
      const p = input.takePitch();
      if (p) this.pitchTarget = clamp(this.pitchTarget + p * kp, 0.5, 1.2);
    } else if (input) { input.takeOrbit(); input.takeWheel(); input.takePitch(); }
    this.yaw = damp(this.yaw, this.yawTarget, 10, dt);
    this.pitch = damp(this.pitch, this.bias && this.bias.pitch ? Math.max(this.pitchTarget, this.bias.pitch) : this.pitchTarget, this.bias ? 3 : 8, dt);
    let dTarget = this.distTarget;
    // look-ahead
    _v.set(vel.x * 0.32, 0, vel.y * 0.32);
    this.lookAhead.x = damp(this.lookAhead.x, _v.x, 3, dt);
    this.lookAhead.z = damp(this.lookAhead.z, _v.z, 3, dt);
    _w.copy(target).add(this.lookAhead);
    _w.y += 0.6;
    if (this.bias) {
      const b = this.bias;
      _w.x = lerp(_w.x, b.x, b.w); _w.z = lerp(_w.z, b.z, b.w); _w.y = lerp(_w.y, b.y ?? _w.y, b.w * 0.5);
      dTarget = Math.max(dTarget, b.dist || dTarget);
    }
    this.dist = damp(this.dist, dTarget, 4, dt);
    this.focus.x = damp(this.focus.x, _w.x, 7, dt);
    this.focus.z = damp(this.focus.z, _w.z, 7, dt);
    this.focus.y = damp(this.focus.y, _w.y, 5, dt);
    const ch = Math.cos(this.pitch) * this.dist, cv = Math.sin(this.pitch) * this.dist;
    const pos = this.basePos.set(this.focus.x + Math.sin(this.yaw) * ch, this.focus.y + cv, this.focus.z + Math.cos(this.yaw) * ch);
    // keep above terrain along the boom
    const W = G.world;
    if (W) {
      let need = 0;
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        const x = lerp(this.focus.x, pos.x, t), z = lerp(this.focus.z, pos.z, t), y = lerp(this.focus.y, pos.y, t);
        const g = W.hAt(x, z) + 0.9;
        if (g > y) need = Math.max(need, (g - y) / t);
      }
      pos.y += need;
    }
    this.look.copy(this.focus);
    // cutscene blend
    const want = this.shot ? 1 : 0;
    const sp = this.shot ? this.shot.speed : 1.8;
    this.shotW = want > this.shotW ? Math.min(1, this.shotW + dt * sp * 0.6) : Math.max(0, this.shotW - dt * sp * 0.8);
    if (this.shot) { this._sp = this.shot.pos; this._sl = this.shot.look; }
    if (this.shotW > 0 && this._sp) {
      const k = Ease.inOutSine(this.shotW);
      pos.lerp(this._sp, k);
      this.look.lerp(this._sl, k);
    }
    this.cam.position.copy(pos);
    // shake
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
      this.cam.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt *= Math.exp(-9 * dt);
    }
    this.cam.lookAt(this.look);
  }
  /** occluder fade: project Pip into drawing-buffer pixels */
  updateOcclusion(renderer, pipPos, active) {
    if (!active) { U.uOccR.value = 1; U.uOccC.value.set(-9999, -9999); return; }
    const size = renderer.getDrawingBufferSize(_tmp2);
    _v.copy(pipPos); _v.y += 0.55;
    const viewZ = _w.copy(_v).applyMatrix4(this.cam.matrixWorldInverse).z;
    _v.project(this.cam);
    U.uOccC.value.set((_v.x * 0.5 + 0.5) * size.x, (_v.y * 0.5 + 0.5) * size.y);
    U.uOccR.value = size.y * 0.15;
    U.uOccDepth.value = -viewZ - 0.9;
  }
}
const _tmp2 = new THREE.Vector2();
