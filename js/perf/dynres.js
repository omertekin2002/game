// Dynamic-resolution controller (arch §9.2-7): one decision per window of frame samples. perf.js collects the samples
// and applies the scale; this file has no imports and no DOM, so tests/dynres.test.js runs it under bun.
//
// Two kinds of samples (ms):
// - timed: GPU time of the main pass (EXT_disjoint_timer_query_webgl2, Chromium). The time itself shows the headroom,
//   so the band is absolute: a window over dynHi → one step down, dynLoWins windows under dynLo → one step up.
// - untimed: the frame interval (no timer extension: Firefox, Safari). The display paces the frames: one is on time
//   or a whole interval late, and an on-time frame says nothing about headroom. The only question is whether the pace
//   holds:
//   · pace = the interval to hold: 60 fps, or the display's own if that is slower (a 50 Hz display, a 30 fps
//     power-saver cap), measured on the title screen, which draws no 3D (titlePace). A window whose median is clearly
//     faster (× dynPaceDrop) moves the pace back towards 60 fps
//   · a window is late over pace × dynLate (more than a quarter of its frames missed), else on time
//   · a late window → one step down
//   · dynLoWins windows on time → one step up, as a probe: a step down within the next dynProbe decisions means it
//     did not hold, and the next probe waits twice as many windows (up to dynLoMax); a step up that holds ends the
//     back-off. Without it a device that needs a lower scale would drop frames every two seconds, for good
//   · play pauses (menu, dialogue, cutscene) with a step up that no decision has judged yet: taken back (dynPause)
//   Known limits:
//   · any slowdown within dynProbe decisions of a step up reads as a failed probe, whatever caused it. One that keeps
//     returning that often (a heavy view, a busy main thread) holds the scale down, with one probe per dynLoMax
//     windows; a longer dynProbe would hold it down for rarer ones too, a shorter one would meet every return of a
//     heavy view at full size, a second of dropped frames per step
//   · a pace that gets slower during play (a power saver switching on) is not measured: the scale goes to the floor
//     and stays, as it does when the session starts before dynPaceMin title frames. A cap that lifts while the GPU is
//     the limit keeps its slow pace until a window runs faster
//
// State lives on `st` (the perf module, or a plain object in tests): dyn, hiWins, loWins, lastDyn, and for untimed
// samples pace, loNeed (on-time windows the next probe needs; 0 = dynLoWins) and probe (decisions left in which a step
// down counts against the last step up; still dynProbe = no decision has judged that step yet).

export const PACE_60 = 1000 / 60;
const SNAP = 1.5;                // ms around 60 Hz that js/clock.js snaps to one step (Clock.snap)

/** a fresh controller state */
export function dynState() {
  return { dyn: 1, hiWins: 0, loWins: 0, lastDyn: -1e9, loNeed: 0, probe: 0, pace: PACE_60 };
}

/** a scale the main pass can take: two decimals, dynMin … 1 */
export function clampDyn(k, T) { return Math.min(1, Math.max(T.dynMin, Math.round(k * 100) / 100)); }

/** The display's pace (ms) from frame intervals taken while nothing heavy is drawn; 0 = not enough of them. Only a
 *  regular slow rhythm counts (a display or a cap ticks evenly, a busy main thread does not): anything else is 60 fps,
 *  and so is a median the clock would snap to 60 Hz anyway (whole-millisecond timestamps read 17 ms there) */
export function titlePace(dts, T) {
  if (dts.length < T.dynPaceMin) return 0;
  const s = dts.slice().sort((a, b) => a - b), at = (f) => s[Math.floor(s.length * f)], mid = at(0.5);
  return at(0.75) < at(0.25) * T.dynPaceEven && mid >= PACE_60 + SNAP ? mid : PACE_60;
}

/** Play pauses (menu, dialogue, cutscene, fade): nothing is judged, yet the world is still drawn at st.dyn. An untimed
 *  step up that no decision has looked at yet is taken back, or a scale that does not hold would last the whole pause.
 *  Returns the scale to use (st.dyn when nothing changes) */
export function dynPause(st, timed, T) {
  if (timed || st.probe !== T.dynProbe) return st.dyn;
  st.probe = 0;
  return st.dyn - T.dynStep;
}

/** One window of samples (ms) → the scale for the next frames (st.dyn when nothing changes; the caller applies it).
 *  `timed`: GPU times; else frame intervals. `now` in ms. At most one step per call, steps at least dynGap s apart */
export function dynDecide(st, samples, timed, now, T) {
  const s = samples.slice().sort((a, b) => a - b), at = (f) => s[Math.floor(s.length * f)], p75 = at(0.75);
  let hi = T.dynHi, lo = T.dynLo, need = T.dynLoWins;
  if (!timed) {
    if (!(st.pace >= PACE_60)) st.pace = PACE_60;       // never measured (0), NaN, undefined: the negation catches all three
    if (at(0.5) < st.pace * T.dynPaceDrop) st.pace = Math.max(PACE_60, at(0.5));
    hi = lo = st.pace * T.dynLate;
    need = Math.max(need, st.loNeed || 0);
  }
  st.hiWins = p75 > hi ? (st.hiWins || 0) + 1 : 0;
  st.loWins = p75 < lo ? (st.loWins || 0) + 1 : 0;
  // too soon after the last step: the window is counted above, but it is no decision (and none of the probe's dynProbe)
  if (now - st.lastDyn < T.dynGap * 1000) return st.dyn;
  const probing = !timed && st.probe > 0;
  // one step per decision (a step is free: nothing waits for a calm moment, nothing stacks)
  if (st.hiWins >= T.dynHiWins && st.dyn > T.dynMin) {
    if (probing) { st.loNeed = Math.min(T.dynLoMax, need * 2); st.probe = 0; }   // the last step up did not hold
    st.hiWins = 0; st.lastDyn = now;
    return st.dyn - T.dynStep;
  }
  // the last step up held: no more waiting. The on-time windows counted through the hold stand, so the next step up
  // can come with this very window
  if (probing && --st.probe === 0) { st.loNeed = 0; need = T.dynLoWins; }
  if (st.loWins >= need && st.dyn < 1) {
    st.loWins = 0; st.lastDyn = now;
    if (!timed) st.probe = T.dynProbe;
    return st.dyn + T.dynStep;
  }
  return st.dyn;
}
