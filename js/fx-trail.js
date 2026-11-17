// WP2 world slash trail (TP; a child of Pip's root on the BODY layer, so the FP camera never sees it). A painted crescent
// that follows the sim's sweep exactly (feel §8.3, art §3): A forehand right → left, B backhand left → right (both
// tilted 18° along the swing so it reads as a crescent, not a ground ring), C an arc in the vertical plane from overhead
// down to the ground. Inner radius reach − 1.0, outer radius reach; wood cream, shiny gold; fx_slash_swoosh brush when
// present. player.js keeps calling setReach / start / stop; the body's render drives update(dt, player).
import * as THREE from 'three';
import { Assets } from './assets.js';
import { combat as TC } from './tune.js';
import { clamp, Ease } from './util.js';

const D2R = Math.PI / 180;
/** arc in the XZ plane: aT 0 → 1 runs bearing −arc → +arc (right → left, + = left as everywhere), aR inner → outer */
function arcGeometry(r0, r1, arc, segs = 32) {
  const pos = [], tt = [], rr = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = -arc + 2 * arc * t;
    for (let j = 0; j < 2; j++) {
      const r = j ? r1 : r0;
      pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
      tt.push(t); rr.push(j);
    }
    if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rr, 1));
  g.setIndex(idx);
  return g;
}
export class SlashTrail {
  constructor() {
    const map = Assets.billboards.fx_slash_swoosh || null;
    this.u = { uHead: { value: 0 }, uTail: { value: 0.45 }, uAlpha: { value: 0 }, uColor: { value: new THREE.Color(0xfff3d8) }, uMap: { value: map }, uHasMap: { value: map ? 1 : 0 } };
    // r2: drawn without the depth test (renderOrder 7, after Pip): over the shoulder the arc in front of Pip is behind
    // his own body, and a hidden blade with a hidden trail read as Pip twitching while the enemy gets hit by nothing
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
      uniforms: this.u,
      vertexShader: /* glsl */`attribute float aT; attribute float aR; varying float vT; varying float vR;
        void main() { vT = aT; vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform float uHead, uTail, uAlpha, uHasMap; uniform vec3 uColor; uniform sampler2D uMap;
        varying float vT; varying float vR;
        void main() {
          if (vT > uHead) discard;
          float tail = smoothstep(uHead - uTail, uHead, vT);
          float edge = smoothstep(0.0, 0.7, vR) * (1.0 - smoothstep(0.92, 1.0, vR));
          float a = tail * edge * uAlpha;
          if (uHasMap > 0.5) { vec4 s = texture2D(uMap, vec2(mix(0.1, 0.95, (vT - uHead + uTail) / uTail), mix(0.6, 0.2, vR))); a *= 0.7 + 0.5 * s.a; }
          gl_FragColor = vec4(mix(uColor, vec3(1.0), smoothstep(0.7, 0.98, vR) * 0.5), a * 0.9);
          #include <colorspace_fragment>
        }`,
    });
    this.arc = TC.arc * D2R;
    this.mesh = new THREE.Mesh(arcGeometry(0.55, 1.6, this.arc), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
    this.mesh.name = 'slash-trail';
    this.active = false; this.fade = 0; this.reach = 1.6;
  }
  setReach(r, shiny) {
    this.reach = r;
    this.mesh.geometry.dispose();
    this.mesh.geometry = arcGeometry(Math.max(0.35, r - 1.0), r, this.arc);
    this.u.uColor.value.set(shiny ? 0xffd75e : 0xfff3d8);
  }
  /** a swing started (player.startAttack): the sweep itself is read from the player in update */
  start() { this.active = true; this.fade = 0; }
  stop() { this.active = false; this.mesh.visible = false; this.u.uAlpha.value = 0; }
  /** pl: the player (TP body render); the head follows its sweep (A/B bearing, C pitch) */
  update(dt, pl = null) {
    const m = this.mesh, u = this.u;
    if (!pl || !this.active) { m.visible = false; return; }
    if (pl.state !== 'attack') { this.fade += dt; u.uAlpha.value = Math.max(0, 1 - this.fade / 0.12); m.visible = u.uAlpha.value > 0.01; if (!m.visible) this.active = false; return; }
    const kind = pl.combo, t = pl.attackT, C = kind === 'C';
    const [s0, s1] = C ? TC.sweepC : TC.sweepAB;
    // sweep fraction: A/B easeOutCubic like combat.sweepAt; C easeInQuad like chopAt (mapped onto ±arc)
    const k = clamp((t - s0) / (s1 - s0), 0, 1), head = C ? k * k : Ease.outCubic(k);
    u.uHead.value = head * 1.02;
    u.uTail.value = C ? 0.6 : 0.5;
    u.uAlpha.value = t < s0 ? 0 : 1 - clamp((t - s1) / 0.12, 0, 1);
    m.visible = u.uAlpha.value > 0.01;
    // orientation in Pip's frame: A falls right → left, B mirrored (rises left → right), C in the vertical plane
    // from overhead (+45°) down to −50°
    if (C) { m.position.set(-0.08, 0.62, 0.05); m.rotation.set(0, 0, Math.PI / 2, 'YXZ'); m.scale.set(-1, 1, 1); }
    else {
      // −18° about the forward axis: A's start (right) sits higher than its end, B's mirrored arc rises to the right.
      // r2: TP A swings opened toward the camera's side (player-body.js an.swOpen) and its crescent tilts up in front
      // toward the over-the-shoulder camera (an.swTrail; flat, it was seen edge-on): roll, then the tilt, then the opening
      const dir = kind === 'B' ? -1 : 1, an = pl.anim || {};
      m.position.set(0, 0.55, 0); m.rotation.set(-(an.swTrail || 0), an.swOpen || 0, -18 * D2R, 'YXZ'); m.scale.set(dir, 1, 1);
    }
  }
}
