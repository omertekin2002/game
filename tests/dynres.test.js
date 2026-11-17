// Dynamic-resolution controller (js/perf/dynres.js) against simulated displays and GPUs. Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { PACE_60, clampDyn, dynDecide, dynPause, dynState, titlePace } from '../js/perf/dynres.js';
import { Clock } from '../js/clock.js';
import { perf as T } from '../js/tune.js';

const clock = new Clock();
const MIN = 60_000;

// A vsynced device. hz(t): what the display (or a power-saver cap) allows; cost(scale, t): ms the GPU needs for the
// main pass. A frame takes whole display intervals, as in a browser. Untimed samples are the frame intervals after the
// clock's snap, with a little timer jitter (what perf.js collects without the timer extension); timed samples are the
// GPU ms of every other frame. Returns the steps taken and how many frames missed the display's own interval.
function play(st, dev, ms, { timed = false } = {}) {
  const S = [], steps = [];
  let t = st.t || 0, n = 0, late = 0, seed = st.seed || 12345;
  const end = t + ms;
  while (t < end) {
    const v = 1000 / dev.hz(t), g = dev.cost(st.dyn, t);
    const dt = Math.max(1, Math.ceil(g / v - 1e-9)) * v;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const jitter = (seed / 2 ** 32 - 0.5) * 0.8;
    t += dt; n++;
    if (dt > v * 1.5) late++;
    if (timed) { if (n & 1) S.push(g); } else S.push(clock.snap(Math.min(clock.MAX_DT, (dt + jitter) / 1000)) * 1000);
    if (S.length < T.dynEvery) continue;
    const k = clampDyn(dynDecide(st, S, timed, t, T), T);
    S.length = 0;
    if (k !== st.dyn) { steps.push({ t, from: st.dyn, to: k }); st.dyn = k; }
  }
  st.t = t; st.seed = seed;
  return { steps, frames: n, late, ups: steps.filter((s) => s.to > s.from), downs: steps.filter((s) => s.to < s.from) };
}

// frame intervals of a title screen (nothing heavy drawn) on a display of `hz`, with timer jitter of ± j ms
function titleFrames(hz, n = T.dynPaceN, j = 0.4) {
  let seed = 4242;
  return Array.from({ length: n }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return 1000 / hz + (seed / 2 ** 32 - 0.5) * 2 * j; });
}

// one window of dynEvery frames, `lateN` of them a whole interval late
const win = (lateN, pace = PACE_60) => [...new Array(T.dynEvery - lateN).fill(pace), ...new Array(lateN).fill(pace * 2)];

const display = (hz, cost) => ({ hz: typeof hz === 'function' ? hz : () => hz, cost: typeof cost === 'function' ? cost : () => cost });
const pixels = (ms) => (scale) => ms * scale * scale;      // a pass whose cost follows its pixel count

// every run: single ±dynStep steps, at least dynGap apart, inside dynMin … 1
function expectLawful(steps) {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    expect(Math.abs(s.to - s.from)).toBeCloseTo(T.dynStep, 6);
    expect(s.to).toBeGreaterThanOrEqual(T.dynMin - 1e-9);
    expect(s.to).toBeLessThanOrEqual(1 + 1e-9);
    if (i) expect(s.t - steps[i - 1].t).toBeGreaterThanOrEqual(T.dynGap * 1000);
  }
}

describe('untimed (no GPU timer): frame intervals against the pace', () => {
  test('one slow window on a 60 Hz display steps down once, and a steady 60 fps brings the scale back', () => {
    const st = dynState();
    let now = 0;
    const feed = (ms) => { now += ms * T.dynEvery; st.dyn = clampDyn(dynDecide(st, new Array(T.dynEvery).fill(ms), false, now, T), T); };
    feed(1000 / 30);
    expect(st.dyn).toBeCloseTo(1 - T.dynStep, 6);
    for (let i = 0; i < T.dynLoWins - 1; i++) feed(PACE_60);
    expect(st.dyn).toBeCloseTo(1 - T.dynStep, 6);          // not before dynLoWins windows
    feed(PACE_60);
    expect(st.dyn).toBe(1);
    for (let i = 0; i < 200; i++) feed(PACE_60);           // 6,000 frames at 60 fps
    expect(st.dyn).toBe(1);
    expect(st.loNeed).toBe(0);
  });

  test('a steady 60 fps never moves the scale', () => {
    const st = dynState();
    const r = play(st, display(60, pixels(9)), 5 * MIN);
    expect(r.steps).toEqual([]);
    expect(st.dyn).toBe(1);
  });

  test('a slowdown now and then does not ratchet the scale down', () => {
    const st = dynState();
    // every 90 s the frames are slow for two seconds, at any scale
    const r = play(st, display(60, (k, t) => (t % 90_000 < 2000 ? 40 : 9 * k * k)), 8 * MIN + 80_000);
    expectLawful(r.steps);
    expect(r.downs.length).toBeGreaterThan(8);
    expect(r.ups.length).toBe(r.downs.length);
    expect(st.dyn).toBe(1);
    expect(st.loNeed).toBe(0);
    expect(st.pace).toBeCloseTo(PACE_60, 6);
  });

  test('a slowdown that returns within dynProbe decisions of a step up reads as a failed probe and holds the scale down', () => {
    // the known limit in the header of dynres.js, on record: the same two-second slowdown, every 40 s
    const st = dynState();
    const r = play(st, display(60, (k, t) => (t % 40_000 < 2000 ? 40 : 9 * k * k)), 10 * MIN + 30_000);
    expectLawful(r.steps);
    expect(st.loNeed).toBe(T.dynLoMax);
    expect(st.dyn).toBeLessThan(0.9);
  });

  test('late means more than a quarter of the window: 7 of 30 late frames hold, 8 step down', () => {
    const a = dynState();
    expect(clampDyn(dynDecide(a, win(7), false, 1000, T), T)).toBe(1);
    expect(a.loWins).toBe(1);
    const b = dynState();
    expect(clampDyn(dynDecide(b, win(8), false, 1000, T), T)).toBeCloseTo(1 - T.dynStep, 6);
  });

  test('the late threshold is pace × dynLate: on a 20 ms pace 21.5 ms is on time, 22 ms is late', () => {
    const a = { ...dynState(), pace: 20 };
    expect(clampDyn(dynDecide(a, new Array(T.dynEvery).fill(21.5), false, 1000, T), T)).toBe(1);
    expect(a.loWins).toBe(1);
    const b = { ...dynState(), pace: 20 };
    expect(clampDyn(dynDecide(b, new Array(T.dynEvery).fill(22), false, 1000, T), T)).toBeCloseTo(1 - T.dynStep, 6);
    expect(b.pace).toBe(20);
  });

  test('two steps are never closer than dynGap (the windows of a 120 Hz display are 0.25 s)', () => {
    const st = dynState();
    let now = 1000;
    st.dyn = clampDyn(dynDecide(st, win(30), false, now, T), T);
    expect(st.dyn).toBeCloseTo(0.95, 6);
    now += (T.dynGap * 1000) / 2; st.dyn = clampDyn(dynDecide(st, win(30), false, now, T), T);
    expect(st.dyn).toBeCloseTo(0.95, 6);
    now += (T.dynGap * 1000) / 2; st.dyn = clampDyn(dynDecide(st, win(30), false, now, T), T);
    expect(st.dyn).toBeCloseTo(0.9, 6);
  });

  test('the on-time windows of a step up are consecutive: a late one starts the count again', () => {
    const st = dynState();
    st.dyn = 0.9;
    let now = 0;
    const feed = (lateN) => { now += 1000; st.dyn = clampDyn(dynDecide(st, win(lateN), false, now, T), T); };
    for (let i = 0; i < T.dynLoWins - 1; i++) feed(0);
    feed(30);
    expect(st.dyn).toBeCloseTo(0.85, 6);
    for (let i = 0; i < T.dynLoWins - 1; i++) feed(0);
    expect(st.dyn).toBeCloseTo(0.85, 6);
    feed(0);
    expect(st.dyn).toBeCloseTo(0.9, 6);
  });

  test('a pace that was never measured (the module starts at 0; NaN, undefined) is 60 fps', () => {
    for (const pace of [0, NaN, undefined, -5]) {
      const st = { ...dynState(), pace };
      expect(play(st, display(60, pixels(9)), MIN).steps).toEqual([]);
      expect(st.pace).toBe(PACE_60);
    }
  });

  test('a display faster than 60 Hz is held to 60 fps, not to its own rate', () => {
    for (const hz of [120, 144]) {
      const st = dynState();
      st.pace = titlePace(titleFrames(hz), T);
      expect(play(st, display(hz, pixels(4)), 10_000).steps).toEqual([]);     // every refresh
      expect(play(st, display(hz, pixels(12)), MIN).steps).toEqual([]);       // every other refresh: still 60 fps or better
      expect(st.pace).toBe(PACE_60);
    }
  });

  test('a GPU that holds 60 fps only below full size settles there, and probes upward less and less often', () => {
    const st = dynState();
    const dev = display(60, pixels(20));                    // 16.7 ms at 0.91: 0.90 holds, 0.95 does not
    const a = play(st, dev, 2 * MIN);
    expectLawful(a.steps);
    expect(Math.min(...a.steps.map((s) => s.to))).toBeCloseTo(0.9, 6);
    expect(Math.max(...a.steps.slice(2).map((s) => s.to))).toBeCloseTo(0.95, 6);
    const gaps = a.ups.slice(1).map((u, i) => u.t - a.ups[i].t);
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1] * 1.5);   // each wait about twice the last
    expect(st.loNeed).toBe(T.dynLoMax);
    // from then on: one failed probe per dynLoMax windows, almost every frame on time
    const b = play(st, dev, 10 * MIN);
    expectLawful(b.steps);
    expect(b.ups.length).toBeLessThanOrEqual(Math.ceil((10 * MIN) / (T.dynLoMax * T.dynEvery * PACE_60)) + 1);
    expect(b.late / b.frames).toBeLessThan(0.02);
    expect(st.dyn).toBeGreaterThanOrEqual(0.9 - 1e-9);
  });

  test('when the load eases for good, the scale climbs back to full size', () => {
    const st = dynState();
    play(st, display(60, pixels(20)), 3 * MIN);
    expect(st.loNeed).toBe(T.dynLoMax);
    const r = play(st, display(60, pixels(9)), 3 * MIN);
    expectLawful(r.steps);
    expect(r.downs).toEqual([]);
    expect(st.dyn).toBe(1);
    expect(st.loNeed).toBe(0);                              // a step up that held ended the back-off
  });

  test('a view that keeps getting heavy again stops the climbing instead of dropping frames each time', () => {
    const st = dynState();
    const dev = display(60, (k, t) => (t % 40_000 < 20_000 ? 25 : 9) * k * k);   // 20 s needing 0.80, 20 s light
    play(st, dev, 5 * MIN);
    const r = play(st, dev, 10 * MIN);
    expectLawful(r.steps);
    expect(r.steps.length).toBeGreaterThan(0);              // it still probes
    expect(Math.max(...r.steps.map((s) => s.to))).toBeLessThanOrEqual(0.85 + 1e-9);
    expect(Math.min(...r.steps.map((s) => s.to))).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(r.late / r.frames).toBeLessThan(0.01);
  });

  test('a short heavy view that returns within a minute is not met at full size every time', () => {
    const st = dynState();
    const dev = display(60, (k, t) => (t % 50_000 < 5000 ? 25 : 9) * k * k);     // 5 s needing 0.80, 45 s light
    play(st, dev, 5 * MIN);
    const r = play(st, dev, 20 * MIN);
    expectLawful(r.steps);
    expect(r.steps.length).toBeGreaterThan(0);
    expect(Math.min(...r.steps.map((s) => s.to))).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(r.late / r.frames).toBeLessThan(0.01);
  });

  for (const hz of [50, 30]) {
    test(`a ${hz} Hz pace (display or power saver) seen on the title costs no resolution`, () => {
      const st = dynState();
      st.pace = titlePace(titleFrames(hz), T);
      expect(st.pace).toBeGreaterThan(1000 / hz - 0.5);
      expect(st.pace).toBeLessThan(1000 / hz + 0.5);
      const r = play(st, display(hz, pixels(9)), 5 * MIN);
      expect(r.steps).toEqual([]);
      expect(st.dyn).toBe(1);
    });
  }

  test('on a 50 Hz display a GPU that needs a lower scale still gets it', () => {
    const st = dynState();
    st.pace = titlePace(titleFrames(50), T);
    const r = play(st, display(50, pixels(24)), 5 * MIN);  // 20 ms at 0.91
    expectLawful(r.steps);
    expect(Math.min(...r.steps.map((s) => s.to))).toBeCloseTo(0.9, 6);
    expect(st.dyn).toBeGreaterThanOrEqual(0.9 - 1e-9);
  });

  test('a cap that lifts puts the 60 fps pace back, so a slow GPU is still helped', () => {
    const st = dynState();
    st.pace = titlePace(titleFrames(30), T);
    expect(play(st, display(30, pixels(9)), MIN).steps).toEqual([]);
    expect(st.pace).toBeGreaterThan(30);
    expect(play(st, display(60, pixels(9)), MIN).steps).toEqual([]);
    expect(st.pace).toBeCloseTo(PACE_60, 6);
    // now the pass gets heavy: 60 fps needs 0.85. A stale 30 fps pace would leave it at full size and 30 fps
    const b = play(st, display(60, pixels(22)), MIN);
    expectLawful(b.steps);
    expect(Math.min(...b.steps.map((s) => s.to))).toBeCloseTo(0.85, 6);
    expect(st.dyn).toBeGreaterThanOrEqual(0.85 - 1e-9);
    expect(st.dyn).toBeLessThanOrEqual(0.9 + 1e-9);
  });

  test('a slow GPU is never taken for a slow display: it keeps the floor, and climbs when 60 fps comes within reach', () => {
    const st = dynState();
    const a = play(st, display(60, pixels(45)), 2 * MIN);   // 22 ms at the floor: 30 fps at any scale
    expectLawful(a.steps);
    expect(a.steps.map((s) => s.to)).toEqual([0.95, 0.9, 0.85, 0.8, 0.75, 0.7]);
    expect(st.pace).toBeCloseTo(PACE_60, 6);
    const b = play(st, display(60, pixels(24)), 3 * MIN);   // 15.4 ms at 0.80: 60 fps up to there
    expectLawful(b.steps);
    expect(st.dyn).toBeCloseTo(0.8, 6);
    expect(Math.max(...b.steps.map((s) => s.to))).toBeCloseTo(0.85, 6);
    expect(st.pace).toBeCloseTo(PACE_60, 6);
  });
});

describe('dynPause: play pauses while the world is still drawn', () => {
  const steppedUp = () => {
    const st = dynState();
    st.dyn = 0.9;
    let now = 0;
    for (let i = 0; i < T.dynLoWins; i++) { now += 500; st.dyn = clampDyn(dynDecide(st, win(0), false, now, T), T); }
    return { st, now };
  };

  test('a step up that no decision has judged is taken back, and only once', () => {
    const { st } = steppedUp();
    expect(st.dyn).toBeCloseTo(0.95, 6);
    st.dyn = clampDyn(dynPause(st, false, T), T);
    expect(st.dyn).toBeCloseTo(0.9, 6);
    expect(st.loNeed).toBe(0);                              // not a failed probe: the next one waits no longer
    st.dyn = clampDyn(dynPause(st, false, T), T);          // the next frame of the same pause
    expect(st.dyn).toBeCloseTo(0.9, 6);
  });

  test('a step up that a decision has judged stays', () => {
    const { st, now } = steppedUp();
    st.dyn = clampDyn(dynDecide(st, win(0), false, now + 600, T), T);
    expect(clampDyn(dynPause(st, false, T), T)).toBeCloseTo(0.95, 6);
  });

  test('nothing to take back: no step up yet, or timed samples', () => {
    const fresh = dynState();
    expect(dynPause(fresh, false, T)).toBe(1);
    const st = dynState();
    st.dyn = 0.9;
    let now = 0;
    for (let i = 0; i < T.dynLoWins; i++) { now += 1000; st.dyn = clampDyn(dynDecide(st, new Array(T.dynEvery).fill(6), true, now, T), T); }
    expect(st.dyn).toBeCloseTo(0.95, 6);
    st.probe = T.dynProbe;                                  // left over from untimed play before the timer came back
    expect(dynPause(st, true, T)).toBeCloseTo(0.95, 6);
  });
});

describe('titlePace: the display pace from title-screen frames', () => {
  test('too few frames give no answer', () => {
    expect(titlePace([], T)).toBe(0);
    expect(titlePace(titleFrames(50, T.dynPaceMin - 1), T)).toBe(0);
  });

  test('60 Hz and faster displays are a 60 fps pace, whole-millisecond timestamps included', () => {
    for (const hz of [60, 59.94, 75, 120, 144, 240]) expect(titlePace(titleFrames(hz), T)).toBe(PACE_60);
    expect(titlePace(Array.from({ length: 60 }, (_, i) => (i % 3 ? 17 : 16)), T)).toBe(PACE_60);
  });

  test('an even slower rhythm is the pace, jitter and a stray gap included', () => {
    expect(titlePace(titleFrames(50), T)).toBeCloseTo(20, 0);
    expect(titlePace(titleFrames(50, 60, 1.5), T)).toBeCloseTo(20, 0);
    expect(titlePace(titleFrames(30, 60, 1), T)).toBeCloseTo(1000 / 30, 0);
    expect(titlePace([...titleFrames(48, 40), 2500, ...titleFrames(48, 19)], T)).toBeCloseTo(1000 / 48, 0);
  });

  test('a busy main thread on a 60 Hz display is not a slow display', () => {
    const busy = titleFrames(60).map((d, i) => (i % 3 ? d * 2 : d));          // two frames in three late
    expect(titlePace(busy, T)).toBe(PACE_60);
    const stalls = titleFrames(60).map((d, i) => (i % 2 ? d * 3 : d * 2));    // every frame late, unevenly
    expect(titlePace(stalls, T)).toBe(PACE_60);
  });
});

describe('timed (GPU timer): the absolute band, unchanged', () => {
  test('over dynHi steps down at once, the band holds, dynLoWins windows under dynLo step up', () => {
    const st = dynState();
    const a = play(st, display(60, pixels(12)), MIN, { timed: true });    // 12 ms at full size, 10.8 ms at 0.95
    expectLawful(a.steps);
    expect(a.steps.map((s) => s.to)).toEqual([0.95]);
    const b = play(st, display(60, pixels(9)), MIN, { timed: true });     // 8.1 ms at 0.95, 9 ms at full size
    expect(b.steps.map((s) => s.to)).toEqual([1]);
    expect(b.steps[0].t - (st.t - MIN)).toBeGreaterThan(T.dynLoWins * T.dynEvery * 2 * PACE_60 - 100);
  });

  test('a heavy pass goes down one step per decision to the floor and stays there', () => {
    const st = dynState();
    const r = play(st, display(60, pixels(30)), MIN, { timed: true });
    expectLawful(r.steps);
    expect(r.steps.map((s) => s.to)).toEqual([0.95, 0.9, 0.85, 0.8, 0.75, 0.7]);
    expect(st.dyn).toBeCloseTo(T.dynMin, 6);
  });

  test('timed decisions never touch the untimed pace or its back-off', () => {
    const st = dynState();
    // a pass that crosses both bands with every step: the scale goes up and down
    const r = play(st, display(60, (k, t) => (Math.floor(t / 4000) % 2 ? 13 : 7)), 2 * MIN, { timed: true });
    expectLawful(r.steps);
    expect(r.ups.length).toBeGreaterThan(5);
    expect(r.downs.length).toBeGreaterThan(5);
    expect(st.loNeed).toBe(0);
    expect(st.probe).toBe(0);
    expect(st.pace).toBe(PACE_60);
  });
});
