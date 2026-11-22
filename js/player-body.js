// WP2 Pip's body: model / rig construction and the procedural render animation (Player mixin; art §2–3, feel §8.3).
// The body always animates (in FP its shadow is all you see: it waddles, swings and rolls). TP presentation:
// - locomotion: forward waddle, strafe (lean into the side step, crab twist), backpedal (lean back, shorter bob);
// - air (C2: player.grounded / vy, EV.JUMP / EV.LAND from WP3): take-off stretch, rise / fall poses, landing squash;
// - swings synced to the sim: the sword arm points along the sweep bearing (A / B) or the chop pitch (C) of the hit
//   test at render time, with the torso turning into it; the world trail follows the same sweep (fx-trail.js);
// - i-frames: a cream rim shimmer (0.35 at 8 Hz), never a blink (blinkOff stays false; the shadow never flickers);
// - view.bodyFade (C12): an ordered dither on Pip's own materials and outlines (the shadow stays whole);
// - item-get: the item over Pip's head faces the camera with a rays burst behind it.
import * as THREE from 'three';
import { G } from './core.js';
import { CFG } from './data.js';
import { makeModel } from './assets.js';
import { instRig, pipDef, swordBuilt } from './models.js';
import { toonMat, sharedOutline, outlineMat, meshWithOutline } from './toon.js';
import { clamp, lerp, damp, wrapAngle, Ease, TAU, LAYER, setLayer, mulberry32, smoothstep } from './util.js';
import { SlashTrail } from './fx-trail.js';
import * as TUNE from './tune.js';
import { EV } from './events.js';
import { STEP } from './clock.js';
import { ditherToon, ditherOutline } from './vm/dither.js';
import { raysCard } from './vm/fx.js';
import { sweepAt, chopAt } from './vm/anim.js';

const TC = TUNE.combat, TV = TUNE.vm;

const fxRand = mulberry32(0x5eed);   // cosmetic randomness (never the sim's Math.random)
const D2R = Math.PI / 180, HALF_PI = Math.PI / 2;
const SHIMMER = new THREE.Color(1, 0.95, 0.82);

/** builds root/spin/inner, the GLB or procedural rig, sword pivot + swords, slash trail and held-item group */
export function buildBody(pl, scene) {
  pl.root = new THREE.Group();
  pl.root.name = 'pip';
  pl.root.userData.cull = { dist: Infinity };   // C10: Pip (and his shadow caster) is never distance-culled
  scene.add(pl.root);
  pl.spin = new THREE.Group();
  pl.spin.position.y = 0.45;
  pl.root.add(pl.spin);
  pl.inner = new THREE.Group();
  pl.inner.position.y = -0.45;
  pl.spin.add(pl.inner);

  // hero.glb carries its sword arm as its own node (armR): the pivot sits at the shoulder and the arm hangs along -Y at
  // rotation 0 like the rig's, so the same pose angles drive both; its rest pose (the node's own rotation) is the baked
  // forward pitch and the sword rides in the baked fist (extras.hand). A GLB without it falls back to the rig
  const glb = makeModel('hero'), armR = glb && glb.group.getObjectByName('armR');
  if (armR && armR.userData.hand) {
    pl.glb = true;
    pl.height = glb.height;
    pl.mats = glb.materials;
    pl.inner.add(glb.group);
    pl.body = glb.group;
    pl.arm = armR;
    pl.armRest = new THREE.Euler().setFromQuaternion(armR.quaternion, 'YXZ').x;
    pl.handPos = new THREE.Vector3().fromArray(armR.userData.hand);
    pl.swordMat = toonMat({ glow: true });
    pl.mats = [...pl.mats, pl.swordMat];
  } else {
    pl.glb = false;
    pl.height = 1;
    const r = instRig(pipDef());
    pl.inner.add(r.root);
    pl.rig = r.nodes;
    pl.mats = r.mats;
    pl.body = r.nodes.body;
    pl.arm = r.nodes.armR;
    pl.armRest = 0;
    pl.handPos = new THREE.Vector3(-0.075, -0.17, 0.02);
    pl.swordMat = r.mat;
  }
  // at rest the blade leans 0.55 rad forward; the GLB's fist sits in front of his cheek, so its blade leans further
  // forward (1.2) and out to the side, held out in front of him: upright it stood across his face seen from his left
  pl.swordRest = (pl.glb ? 1.2 : 0.55) - pl.armRest;
  pl.swordRestZ = pl.glb ? 0.5 : 0;
  // the GLB's shoulder sits low and close to his head: A's TP follow-through stays out beside him (wrapped up over the
  // far shoulder it ran the blade through his hood) and a swinging arm splays out, so the chop's raise clears it too
  pl.tpWrapK = pl.glb ? 0 : 1;
  pl.armSplay = pl.glb ? -0.7 : 0;
  // with the camera centred behind him the blade would then stay hidden behind his hood: the torso twists through the
  // swing instead (opening right at the wind-up, left at the follow-through), so it shows beside him
  pl.tpTwistC = pl.glb ? 1 : 0;
  // its arm is short (shoulder → fist 0.135) and his capelet flares wider than that at the shoulder: turned more than
  // armOut out to his right (or armCross across his chest) the fist and the hilt sank into the cape, so past that the
  // torso turns instead; raised overhead for the chop, the guard's inner end reached into his hood, so that arm
  // splays out further (chopSplay)
  pl.armOut = pl.glb ? 0.3 : Infinity;
  pl.armCross = pl.glb ? 0.35 : Infinity;
  pl.armTwistK = 0.3;   // out to his right only (the rest is dropped: all of it spun his back to a camera in front)
  pl.chopSplay = pl.glb ? -0.9 : 0;
  pl.arm.rotation.order = 'YXZ';
  pl.swordPivot = new THREE.Group();
  pl.swordPivot.position.copy(pl.handPos);
  pl.arm.add(pl.swordPivot);
  // Pip's own ink line (the shared 'char' outline is every character's): built from the same config, dithered with
  // the body. WP7 publishes that config as TUNE.perf.outline.char (pixel-width line, far fade); until then the 'char'
  // width with the C11 px flag
  pl.fadeU = { value: 1 }; pl.rimU = { value: 1 };
  const olCfg = (TUNE.perf && TUNE.perf.outline && TUNE.perf.outline.char) || { width: 0.022, px: true };
  pl.olMat = ditherOutline(outlineMat({ ...olCfg }), pl.fadeU);
  pl.swords = [false, true].map((shiny) => {
    const g = meshWithOutline(swordBuilt(shiny), pl.swordMat, pl.olMat);
    g.visible = false;
    pl.swordPivot.add(g);
    return g;
  });
  pl.root.traverse((o) => { if (o.isMesh && o.material === sharedOutline('char')) o.material = pl.olMat; });
  for (const m of new Set(pl.mats)) { ditherToon(m, pl.fadeU, pl.rimU); if (m.userData.flashColor) m.userData.flashColor.value.copy(SHIMMER); }
  pl.trail = new SlashTrail();
  pl.root.add(pl.trail.mesh);
  pl.held = new THREE.Group();
  pl.held.position.y = 1.45 * pl.height;
  pl.held.scale.setScalar(TV.heldS);   // interact.js builds the item at 1.3: overhead it would dwarf Pip in TP
  pl.root.add(pl.held);
  // rays burst behind a held item (TP item-get, art §11); not a child of held (clearHeldItem empties it)
  pl.heldRays = raysCard();
  pl.heldRays.renderOrder = 6;
  pl.root.add(pl.heldRays);
  // the body (and anything held) lives on the BODY layer: the FP camera skips it, the sun's shadow camera does not.
  // The world slash trail too: it is the TP swing cue; FP swings show in the viewmodel pass (view/viewmodel.js)
  setLayer(pl.root, LAYER.BODY);
  pl.heldRays.castShadow = false;
  // air / landing / hurt cues (WP3 emits jump / land; silent until then)
  pl.anim = { landSq: 0, landV: 0, jumpSq: 0, hurtAt: -9, iwin: CFG.hurtIframes, fwd: 1, side: 0, air: 0 };
  if (G.events) {
    G.events.on(EV.JUMP, () => { pl.anim.jumpSq = 1; });
    G.events.on(EV.LAND, (p) => { pl.anim.landV += 4 + 10 * clamp(((p && p.impact) || 0) / 8, 0, 1); });
    G.events.on(EV.HURT, () => { pl.anim.hurtAt = pl.t; pl.anim.iwin = CFG.hurtIframes; });
    // the respawn grace (combat.js gives 1.5 s of i-frames) shimmers too: the foundation blinked for it
    G.events.on(EV.RESPAWN, () => { pl.anim.hurtAt = pl.t; pl.anim.iwin = Math.max(CFG.hurtIframes, pl.iframes || 0); });
  }
}

export const PlayerBody = {
  render(alpha, dt, time) {
    const p = this.root.position;
    p.lerpVectors(this.prev, this.pos, alpha);
    const fac = this.prevFacing + wrapAngle(this.facing - this.prevFacing) * alpha;
    this.root.rotation.y = fac;
    const st = this.state, an = this.anim, sp = this.vel.length(), ground = this.grounded !== false;
    const moving = (st === 'normal' || st === 'frozen' || st === 'attack') && sp > 0.4 && ground;
    const k = clamp(sp / CFG.playerSpeed, 0, 1);
    // locomotion direction in Pip's frame (eased): forward share, side share (+ = toward Pip's left)
    const fx = Math.sin(fac), fz = Math.cos(fac);
    const fw = sp > 0.4 ? (this.vel.x * fx + this.vel.y * fz) / sp : 1, sd = sp > 0.4 ? (this.vel.x * fz - this.vel.y * fx) / sp : 0;
    an.fwd = damp(an.fwd, fw, 10, dt); an.side = damp(an.side, sd, 10, dt);
    const back = clamp(-an.fwd, 0, 1), side = moving ? an.side : 0, sideA = Math.abs(side);
    // squash & stretch: breathing, dash exit, landing spring, take-off stretch, air stretch along vy
    let sx = 1, sy = 1;
    const breathe = Math.sin(time * 2.6) * 0.018 * (1 - k);
    sy += breathe; sx -= breathe * 0.5;
    sy -= this.squash * 0.18; sx += this.squash * 0.12;
    an.landV += (-170 * an.landSq - 14 * an.landV) * dt; an.landSq = clamp(an.landSq + an.landV * dt, -0.3, 0.6); // + = squashed
    sy -= an.landSq * 0.45; sx += an.landSq * 0.28;
    an.jumpSq = Math.max(0, an.jumpSq - dt * 5);
    an.air = damp(an.air, ground ? 0 : 1, 14, dt);
    const vy = this.vy || 0;
    sy *= 1 + an.jumpSq * 0.14 + an.air * clamp(vy * 0.018, -0.05, 0.1);
    sx *= 1 - an.jumpSq * 0.07 - an.air * clamp(vy * 0.009, -0.025, 0.05);
    this.spin.rotation.set(0, 0, 0);
    this.inner.rotation.set(0, 0, 0);
    this.inner.position.set(0, -0.45, 0);
    // the stride phase interpolated to this frame (r2: the viewmodel's Stride; walkPhase itself changes once per step and
    // runs backwards while Pip stops or swings, so the legs ticked at 60 Hz and flailed)
    const ph = this.stride ? this.stride.at(alpha) : this.walkPhase;
    // body bob & waddle & lean; strafes lean into the side step and turn the hips toward it; backpedal leans back
    if (moving) {
      this.inner.position.y += Math.abs(Math.sin(ph)) * k * (0.05 * (1 - 0.4 * back) + 0.03 * sideA);
      this.inner.rotation.z = Math.sin(ph) * 0.09 * k * (1 - sideA) - side * 0.2 * k;
      this.inner.rotation.x = (0.12 * Math.max(0, an.fwd) - 0.1 * back) * k;
      this.inner.rotation.y = side * 0.3 * k;
    }
    // air: lean with the arc (forward rising, back a touch falling)
    if (an.air > 0.01) this.inner.rotation.x += an.air * clamp(vy * 0.03, -0.12, 0.15);
    // limbs: the sword arm in either body (the GLB's left arm is baked), the rest on the procedural rig only
    const rig = this.rig, dirLeg = back > 0.5 ? -1 : 1, fall = clamp(-vy / 6, 0, 1);
    let armRx = this.armRest + (moving ? Math.sin(ph) * 0.5 * k : 0), armRy = 0, armRz = 0, swordRx = this.swordRest, swordRz = this.swordRestZ;
    if (an.air > 0.01) armRx = lerp(armRx, -0.8 - fall * 0.8, an.air);
    an.swOpen = 0; an.swLift = 0; an.swTrail = 0;
    if (rig) {
      const swing = moving ? Math.sin(ph) * 0.7 * k * dirLeg * (1 - sideA) : 0, step = moving ? Math.sin(ph) * 0.35 * sideA : 0;
      rig.legL.rotation.set(swing, 0, step); rig.legR.rotation.set(-swing, 0, step);
      rig.armL.rotation.x = moving ? -Math.sin(ph) * 0.6 * k : Math.sin(time * 2.6) * 0.04;
      rig.armL.rotation.z = 0;
      rig.head.rotation.set(moving ? Math.sin(ph * 2) * 0.03 : Math.sin(time * 1.3) * 0.03, 0, moving ? -Math.sin(ph) * 0.05 : 0);
      if (an.air > 0.01) {
        rig.legL.rotation.x = lerp(rig.legL.rotation.x, -0.7 + fall * 0.4, an.air); rig.legR.rotation.x = lerp(rig.legR.rotation.x, -0.2 - fall * 0.2, an.air);
        rig.armL.rotation.x = lerp(rig.armL.rotation.x, -1.2 - fall * 1.2, an.air); rig.armL.rotation.z = 0.4 * an.air;
      }
    }
    if (st === 'attack') {
      // the sword follows the hit test at render time (the hit-stop holds it on the contact pose)
      const frozen = G.clock && (G.clock.hitStopT > 0 || G.clock.frozenFrame);
      const t = frozen ? this.attackT : Math.max(0, this.attackT - (1 - alpha) * STEP), kind = this.combo;
      if (kind === 'C') {
        const [s0, s1] = TC.sweepC, dur = this.swingDur || TC.swingC, hold = TV.chopHoldTo;
        let e, reach;
        if (t < s0) { e = lerp(0.3, TC.chopUp * D2R + 0.5, Ease.outQuad(t / s0)); reach = Ease.outQuad(t / s0); }   // raise overhead
        else if (t < s1) { e = chopAt(TC, t); reach = 1; }
        else if (t < hold) { e = TC.chopDown * D2R; reach = 1; }
        else { const u = Ease.inOutSine(clamp((t - hold) / (dur - hold), 0, 1)); e = lerp(TC.chopDown * D2R, -1.2, u); reach = 1 - u; }
        armRx = lerp(armRx, -HALF_PI - e, reach); armRz = this.chopSplay * reach;
        swordRx = lerp(this.swordRest, Math.PI - 0.12, reach); swordRz = this.swordRestZ * (1 - reach);
        const bite = t >= s1 && t < hold ? 1 : 0;
        this.inner.rotation.x = 0.06 + clamp(-e, 0, 1) * 0.35 * reach;
        sy *= 1 - bite * 0.06; sx *= 1 + bite * 0.04;
        if (rig) { rig.armL.rotation.x = armRx * 0.8; rig.armL.rotation.z = 0.25 * reach; }
      } else {
        const [s0, s1] = TC.sweepAB, dur = this.swingDur || TC.swingAB, dir = kind === 'B' ? -1 : 1, arc = TC.arc * D2R, hold = TV.holdTo;
        let a, reach;
        if (t < s0) { const u = Ease.outQuad(t / s0); a = lerp(0, -dir * arc * 1.12, u); reach = u; }     // wind back past the sweep start
        else if (t < s1) { a = sweepAt(TC, kind, t); reach = 1; }
        else if (t < hold) { a = dir * arc * (1 + 0.12 * Ease.outCubic(clamp((t - s1) / 0.06, 0, 1))); reach = 1; }   // follow through
        else { const u = Ease.inOutSine(clamp((t - hold) / (dur - hold), 0, 1)); a = dir * arc * 1.12 * (1 - u); reach = 1 - u; }
        // A falls from high right to low left, B rises: the arm's pitch follows the sweep
        const tilt = dir * (a / arc) * 0.3;
        // r2, TP presentation of A only (the hit test is untouched): seen from over the shoulder, a level forehand in front
        // of a 1 m Pip is behind his head and body for the whole hit window (the sweep reaches the left within 3 frames and
        // holds there). With the camera out of his head, A's swing opens toward the camera's side (tpOpenA), tilts up in
        // front (tpLiftA) and its follow-through wraps up over the far shoulder (tpWrapA), so the blade ends above his hood
        // in open screen; the world trail is drawn over him, tilted toward the camera (an.swTrail, fx-trail.js)
        const v = G.view, tpk = kind === 'A' && v && v.bodyOut && v.mode === 'tp' ? clamp(v.blend ?? 1, 0, 1) : 0;
        const cs = v && v.tp ? clamp(v.tp.side, -1, 1) : 1, u = (a / arc + 1) / 2, side = cs + (1 - Math.abs(cs)) * this.tpTwistC * (1 - 2 * u);
        an.swOpen = -TV.tpOpenA * side * tpk * reach; an.swLift = TV.tpLiftA * tpk; an.swTrail = TV.tpTrailA * tpk;
        const wrap = TV.tpWrapA * this.tpWrapK * tpk * smoothstep(0.45, 1.1, u);
        armRx = lerp(armRx, -HALF_PI + tilt - an.swLift * Math.cos(a) - wrap, reach);
        const ry = a * reach, cy = clamp(ry, -this.armOut, this.armCross);   // (+: toward his left, across his chest)
        armRy = cy; armRz = this.armSplay * reach;
        swordRx = lerp(this.swordRest, Math.PI - 0.12, reach); swordRz = this.swordRestZ * (1 - reach);
        const ex = ry - cy;   // the turn the arm did not make: across his chest the torso takes all of it, out to his right armTwistK
        this.inner.rotation.y += a * 0.35 * reach + ex * (ex > 0 ? 1 : this.armTwistK) + an.swOpen;      // the torso turns into the swing
        this.inner.rotation.x = 0.08;
        if (rig) { rig.armL.rotation.x = -0.3 * reach; rig.armL.rotation.z = 0.5 * reach; }
      }
    }
    if (st === 'dash') {
      const t = clamp(this.dashT / CFG.dashTime, 0, 1);
      this.spin.rotation.x = Ease.inOutSine(t) * TAU * (this.backstep ? -1 : 1);
      sy *= 0.85; sx *= 1.08;
      if (rig) { rig.legL.rotation.x = -1.0; rig.legR.rotation.x = -1.0; rig.armL.rotation.x = -1.2; }
      armRx = -1.2;
    }
    if (st === 'hurt') { this.inner.rotation.x = -0.3; this.inner.position.y += 0.03; }
    if (st === 'item') {
      armRx = -2.9; armRz = 0.3;
      if (rig) { rig.armL.rotation.x = -2.9; rig.armL.rotation.z = -0.3; }
      swordRx = 0.55; swordRz = 0;
      sy *= 1 + Math.sin(time * 8) * 0.02;
    }
    if (st === 'frozen' && G.game && G.game.cutscene && G.game.cutscene.type === 'place') {
      // presenting a seed to the pedestal
      armRx = -1.5; if (rig) rig.armL.rotation.x = -1.5;
    }
    if (st === 'dizzy') {
      this.spin.rotation.z = Math.min(1.3, (this.dizzyT || 0) * 3);
      this.inner.rotation.y = Math.sin(time * 6) * 0.2;
    }
    this.arm.rotation.set(armRx, armRy, armRz);
    this.swordPivot.rotation.set(swordRx, 0, swordRz);
    this.spin.scale.set(sx, sy, sx);
    // trail (follows the same sweep)
    this.trail.update(dt, this);
    // shiny-sword sparkles around the world swing: a cue for the visible body only (TP, shots; the FP swing is the
    // viewmodel's). One roll per sim step, on a cosmetic RNG so the seeded Math.random stream the sim uses is untouched
    if (this.swordLevel >= 2 && this.attackActive && G.view && G.view.bodyOut) {
      for (let i = 0, n = G.clock ? G.clock.steps : 1; i < n; i++) {
        if (fxRand() >= 0.7) continue;
        const a = fac + (fxRand() - 0.5) * 2.2, r = this.reach * (0.6 + fxRand() * 0.4);
        G.fx.sparkle(p.x + Math.sin(a) * r, p.y + 0.45, p.z + Math.cos(a) * r, 0xffe27a, 1, 0.1);
      }
    }
    // hurt flash, then the i-frame shimmer (cream, 0.35 at 8 Hz; Pip never vanishes, blinkOff stays false). Motion
    // comfort holds the rim steady at shimCalm with no wash (no repeating flash; WCAG 2.3.1)
    const shimmer = this.iframes > 0 && this.t - an.hurtAt < an.iwin + 0.05 && st !== 'dash' && st !== 'item' && st !== 'dizzy';
    const calm = !!(G.settings && G.settings.get('reduceMotion')), on = Math.floor(time * 16) % 2 === 0;
    const fl = Math.max(this.flash, 0) * 0.8, sh = !shimmer ? 0 : calm ? TV.shimCalm : on ? 1.1 : 0.25, wash = shimmer && on && !calm ? 0.1 : 0;
    for (const m of this.mats) {
      if (m.userData.flash) m.userData.flash.value = Math.max(fl, wash);
      if (m.userData.wp2Shim) m.userData.wp2Shim.value = sh;
    }
    this.blinkOff = false;
    // body fade (C12): the TP arm closing in dithers Pip out (the shadow pass ignores it)
    const v = G.view;
    this.fadeU.value = v && v.bodyOut ? clamp(v.bodyFade ?? 1, 0, 1) : 1;
    // rim (art §3): stronger while the camera is out of Pip's head, so the olive hood separates from dark woods
    this.rimU.value = v && v.bodyOut ? TV.rimTP : 1;
    // held item: bobs over Pip's head facing the camera, rays behind it
    this.held.position.y = 1.45 * this.height + Math.sin(time * 3) * 0.05;
    const has = this.held.children.length > 0, R = this.heldRays;
    if (has && G.camera) { this.held.lookAt(G.camera.position); this.held.rotateZ(Math.sin(time * 2.5) * 0.15); }
    R.visible = has && !!G.camera;
    if (R.visible) {
      R.position.copy(this.held.position);
      R.lookAt(G.camera.position);
      R.translateZ(-0.2);
      R.rotateZ(time * 0.2);
      R.scale.setScalar(1.5 * (0.92 + 0.08 * Math.sin(time * 3)));
      R.material.uniforms.uK.value = 1.3;
    }
  },
};
