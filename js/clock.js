// Fixed-step clock: 1/60 s sim steps, vsync dt snapping, phase-offset accumulator (render alpha), hit-stop as a
// time scale in whole steps, and a manual mode for deterministic tests (G.debug.clock / G.debug.step).
export const STEP = 1 / 60;

/** whole steps the old float hit-stop skipped for `sec` (0.05 → 4, 0.06 → 4, 0.07 → 5): kept bit-identical */
export function stopSteps(sec) {
  let x = sec, n = 0;
  while (x > 0 && n < 600) { x -= STEP; n++; }
  return n;
}

export class Clock {
  constructor() {
    this.STEP = STEP;
    this.MAX_DT = 0.1;          // raw frame time clamp (s)
    this.MAX_STEPS = 6;         // = MAX_DT / STEP: a 10 fps frame still runs real time (feel §2.3); only the clamp slows it
    this.acc = STEP / 2;        // phase offset: at a locked 60 Hz alpha stays exactly 0.5
    this.timeScale = 1;         // slow-mo (opt-in); hit-stop does not use it
    this.hitStopT = 0;          // real seconds of freeze left, always a whole number of steps
    this.manual = false;        // frames and steps only through G.debug.step/advance (main.js loop just redraws)
    this.hold = false;          // set by Game while a cursor menu pauses the world: frames accumulate nothing
    this.steps = 0; this.alpha = 0.5; this.dt = 0;
    this.simTime = 0; this.frames = 0; this.longFrames = 0;
    this.stepFn = null; this.renderFn = null; // wired by main.js; used by run() / advance()
  }
  /** snap near-vsync deltas to exact multiples so a locked display gets a constant step count per frame */
  snap(dt) {
    if (Math.abs(dt - STEP) < 0.0015) return STEP;
    if (Math.abs(dt - 2 * STEP) < 0.0015) return 2 * STEP;
    if (Math.abs(dt - STEP / 2) < 0.001) return STEP / 2;
    return dt;
  }
  /** per rAF frame: returns the (clamped, snapped) frame dt and sets this.steps / this.alpha;
   *  force accumulates even with the manual clock (G.debug.advance: whole simulated frames) */
  frame(rawDt, force = false) {
    const dt = this.snap(Math.min(this.MAX_DT, Math.max(0, rawDt)));
    this.dt = dt;
    this.frames++;
    this.frozenFrame = this.hitStopT > 0;  // this frame began inside a hit-stop: render-side smoothing holds still too
    if (this.manual && !force) { this.steps = 0; this.alpha = 1; return dt; }
    if (this.hold) { this.steps = 0; return dt; }   // world paused (menus, shop): no steps, alpha and hit-stop keep still
    let add = dt;
    if (this.hitStopT > 0) {
      // the freeze eats real time first: nothing accumulates, so no steps run and alpha stays put
      const s = Math.min(this.hitStopT, add);
      this.hitStopT -= s; add -= s;
      if (this.hitStopT < 1e-7) this.hitStopT = 0;
      if (this.hitStopT > 0) { this.steps = 0; return dt; }
    }
    this.acc += add * this.timeScale;
    let n = 0;
    while (this.acc + 1e-9 >= STEP) { this.acc -= STEP; n++; }
    if (this.acc < 0) this.acc = 0;
    if (n > this.MAX_STEPS) { n = this.MAX_STEPS; this.longFrames++; } // drop the excess, keep the phase
    this.steps = n;
    this.alpha = Math.min(1, this.acc / STEP);
    return dt;
  }
  /** run this frame's steps; a hit-stop that starts mid-frame defers the remaining steps until after it */
  run(stepFn = this.stepFn) {
    for (let i = 0; i < this.steps; i++) {
      if (this.hitStopT > 0) { this.acc += (this.steps - i) * STEP; break; }
      stepFn(STEP);
      this.simTime += STEP;
    }
  }
  /** freeze the sim for the same number of whole steps the old float hit-stop gave; simultaneous stops take the max */
  hitStop(sec) { this.hitStopFor(stopSteps(sec)); }
  hitStopFor(steps) { this.hitStopT = Math.max(this.hitStopT, steps * STEP); }
  /** neutral render phase (session start, teleport, respawn) */
  resetPhase() { this.acc = STEP / 2; this.alpha = 0.5; }
  /** debug: n ticks of one step each (frozen ticks while a hit-stop runs), then one render; synchronous */
  advance(n = 1) {
    let ran = 0, frozen = 0;
    for (let i = 0; i < n; i++) {
      if (this.hitStopT > 0) { this.hitStopT -= STEP; if (this.hitStopT < 1e-7) this.hitStopT = 0; frozen++; continue; }
      if (this.stepFn) this.stepFn(STEP);
      this.simTime += STEP;
      ran++;
    }
    this.steps = 0; this.alpha = 1;
    if (this.renderFn) this.renderFn(1, Math.min(this.MAX_DT, n * STEP));
    return { ran, frozen };
  }
  info() {
    return { manual: this.manual, hold: this.hold, timeScale: this.timeScale, steps: this.steps, alpha: +this.alpha.toFixed(4), hitStopT: +this.hitStopT.toFixed(4), simTime: +this.simTime.toFixed(4), frames: this.frames, longFrames: this.longFrames };
  }
}
