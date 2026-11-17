/* Starseed Isle — procedural audio (Web Audio API, zero assets). Classic script → G.audio. Nothing here ever throws.
 *
 *   G.audio.init()                      unlock / resume (user gesture; idempotent)
 *   G.audio.sfx(name, o?)               a sound; o = { x, y, z (world point: pan, distance gain, behind-you low-pass from
 *                                       the listener), vol, rate (pitch ×), pan (−1..1 without a position), dur, bus,
 *                                       at (start on the audio clock, ≤ 1 s ahead; default now) }.
 *                                       Unknown names are silent. A name the event layer claimed this frame or the
 *                                       next is dropped (so an old direct call never doubles an event-driven sound)
 *   G.audio.play(name, o?)              the same without the claim filter (the event layer, js/audio-bus.js)
 *   G.audio.listener(x, y, z, yaw)      the ear (WP5 module, every render frame): Pip's eye + the look yaw
 *   G.audio.place(x, y, z)              → { pan, gain, lp, dist, front, behind } (the positional maths; tests)
 *   G.audio.emitter(name, o)            → { set(x, y, z), stop(), alive } a moving / long sound (≤ 6 live)
 *   G.audio.ambience(id | null, o?)     region bed crossfade (village / woods / peaks / shores / meadow); o.night 0..1
 *   G.audio.heartbeat(k, o?)            low-health beat (0 = off; 0..1 = how urgent, still soft) on the HUD's wall-clock
 *                                       beat: o = { period (s, TUNE.hud.beat), lead (fraction of a period) }
 *   G.audio.duck(k)                     music gain multiplier, eased (dialogue ducking)
 *   G.audio.claim(names) / defer(names) event layer: claimed names drop direct calls; deferred ones wait for this task
 *   G.audio.config(o) / setVolumes({ music, sfx, amb })   TUNE.actors.audio / settings multipliers (0..1)
 *   G.audio.music(track), setMuted, toggleMute, setMusicVolume, setSfxVolume, muted, current, ready, tracks, sfxNames
 *   G.audio.render(name | [[name, o], …] | null, o, { sec, sr, listener, bed }) → Promise<{ peak, rmsL, rmsR, hf, … }> offline
 *   G.audio.info()                      → { state, listener, voices, emitters, bed, duck, heart, volumes }
 * ?noaudio=1: G.audio is a stub (every call a no-op, no AudioContext).
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  root.G = root.G || {};

  var noop = function () {};
  var DEAD = { set: noop, stop: noop, alive: false };
  if (/[?&]noaudio=1/.test((root.location && root.location.search) || '')) {
    root.G.audio = {
      init: function () { return false; }, sfx: noop, play: noop, music: noop, listener: noop, place: function () { return null; },
      emitter: function () { return DEAD; }, ambience: noop, heartbeat: noop, duck: noop, claim: noop, defer: noop, config: noop,
      setVolumes: noop, setMuted: function (m) { return !!m; }, toggleMute: function () { return false; }, setMusicVolume: noop,
      setSfxVolume: noop, muted: false, current: null, ready: false, tracks: [], sfxNames: [], stub: true,
      render: function () { return Promise.resolve(null); }, info: function () { return { stub: true }; }
    };
    return;
  }

  var MUTE_KEY = 'starseed-isle-muted';
  var FADE = 1.0;            // music crossfade seconds
  var LOOKAHEAD = 0.18;      // seconds scheduled ahead of the audio clock
  var TICK_MS = 25;

  /* ------------------------------------------------------------------ state */
  var ctx = null, offline = false;
  var master = null, comp = null, lim = null, musicBus = null, duckG = null, sfxBus = null, ambBus = null;
  var mRevIn = null, sRevIn = null;
  var noiseBuf = null;
  var timer = null;
  var cur = null;                 // current music instance
  var wanted = null;              // last requested track (so music() before init() works)
  var muted = false;
  var musicVol = 0.35, sfxVol = 0.7, AMB_VOL = 0.6;
  var volK = { music: 1, sfx: 1, amb: 1 }, duckK = 1;
  var visHooked = false, gestureHooked = false;
  var live = {}, lastT = {}, liveAll = [];
  // positional: the ear (game convention: yaw = atan2(dx, dz), right = (−cos, sin)) and the TUNE.actors.audio numbers
  var lis = { x: 0, y: 0, z: 0, yaw: 0, set: false };
  var CFG = { ref: 2.5, max: 45, minGain: 0.03, lpFront: 18000, lpBehind: 1400, panK: 0.9 };
  var outNode = null, curRate = 1, curRev = 1, EMPTY = {}, curOpts = EMPTY;
  var emitters = [];
  var bed = null, bedId = null, night = 0, hbK = 0, hbN = null, hbPer = 0.9, hbLead = 0.15, hbLog = [];

  try { muted = root.localStorage && root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

  function rnd() { return Math.random(); }
  function rv(a) { return 1 + (rnd() * 2 - 1) * a; }          // random multiplier 1±a
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp01(x) { x = +x; return x !== x ? 0 : Math.max(0, Math.min(1, x)); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function fin(v) { return typeof v === 'number' && isFinite(v); }

  /* --------------------------------------------------------------- primitives */
  function wire(node, o) {
    node.connect(o.dest || outNode || sfxBus);
    if (o.rev && !o.dest) {
      var s = ctx.createGain();
      s.gain.value = o.rev * curRev;
      node.connect(s);
      s.connect(sRevIn);
    }
  }

  function envelope(gp, t, v, a, h, d) {
    if (d <= a) d = a + 0.01;
    gp.setValueAtTime(0.0001, t);
    gp.linearRampToValueAtTime(v, t + a);
    if (h != null && h > a && h < d) gp.setValueAtTime(v, t + h);
    gp.exponentialRampToValueAtTime(0.0001, t + d);
    return d;
  }

  // oscillator voice. o: t,d,f,f1,fd,type,v,a,h,lp,lp1,q,vib[hz,depthHz],detune,dest,rev (sfx pitch × curRate)
  function T(o) {
    var t = o.t, v = o.v == null ? 0.3 : o.v, a = o.a == null ? 0.006 : o.a, k = o.dest ? 1 : curRate;
    var osc = ctx.createOscillator(), g = ctx.createGain(), last = osc;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.min(o.f * k, 18000), t);
    var d = Math.max(o.d, a + 0.01);
    if (o.f1 && o.f1 !== o.f) osc.frequency.exponentialRampToValueAtTime(Math.min(18000, Math.max(20, o.f1 * k)), t + (o.fd || d));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1] * k;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + d + 0.1);
    }
    if (o.lp) {
      var fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.Q.value = o.q || 0.5;
      fl.frequency.setValueAtTime(o.lp, t);
      if (o.lp1) fl.frequency.exponentialRampToValueAtTime(o.lp1, t + d);
      osc.connect(fl); last = fl;
    }
    envelope(g.gain, t, v, a, o.h, d);
    last.connect(g);
    wire(g, o);
    osc.start(t);
    osc.stop(t + d + 0.05);
  }

  // filtered noise burst. o: t,d,f,f1,q,type,v,a,dest,rev
  function N(o) {
    var t = o.t, v = o.v == null ? 0.2 : o.v, a = o.a == null ? 0.004 : o.a, k = o.dest ? 1 : curRate;
    var d = Math.max(o.d, a + 0.01);
    var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = o.type || 'bandpass';
    fl.Q.value = o.q || 0.8;
    fl.frequency.setValueAtTime(Math.min(18000, (o.f || 1000) * k), t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(Math.min(18000, o.f1 * k), t + d);
    envelope(g.gain, t, v, a, null, d);
    src.connect(fl); fl.connect(g);
    wire(g, o);
    src.start(t, rnd() * 1.4);
    src.stop(t + d + 0.05);
  }

  // glassy bell (sfx or music via dest)
  function bell(t, f, ring, v, dest, rev) {
    var o = { t: t, dest: dest, rev: rev };
    T({ t: t, dest: dest, rev: rev, f: f, d: ring, v: 0.26 * v, a: 0.004 });
    T({ t: t, dest: dest, rev: rev, f: f * 2.76, d: ring * 0.4, v: 0.07 * v, a: 0.003 });
    T({ t: t, dest: dest, rev: rev, f: f * 5.4, d: ring * 0.15, v: 0.025 * v, a: 0.002 });
    return o;
  }

  /* ------------------------------------------------------------------- graph */
  function makeIR(c, sec) {
    var sr = c.sampleRate, len = Math.floor(sr * sec);
    var buf = c.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var p = i / len;
        var k = 0.62 - 0.5 * p;                       // tail gets darker
        lp += ((rnd() * 2 - 1) - lp) * k;
        var pre = i < sr * 0.012 ? i / (sr * 0.012) : 1;
        d[i] = lp * Math.pow(1 - p, 2.6) * pre;
      }
    }
    return buf;
  }

  /** the whole bus graph on context c: music → duck → comp, sfx → comp, ambience → comp, comp → master → limiter */
  function makeGraph(c, live) {
    var g = {};
    g.master = c.createGain(); g.master.gain.value = live && muted ? 0 : 1;
    g.comp = c.createDynamicsCompressor();
    g.comp.threshold.value = -14; g.comp.knee.value = 18; g.comp.ratio.value = 5;
    g.comp.attack.value = 0.004; g.comp.release.value = 0.22;
    g.lim = c.createDynamicsCompressor();           // a brick-wall-ish limiter: stacked sounds never clip
    g.lim.threshold.value = -3; g.lim.knee.value = 0; g.lim.ratio.value = 20;
    g.lim.attack.value = 0.002; g.lim.release.value = 0.12;
    g.musicBus = c.createGain(); g.musicBus.gain.value = musicVol * volK.music;
    g.duckG = c.createGain(); g.duckG.gain.value = duckK;
    g.sfxBus = c.createGain(); g.sfxBus.gain.value = sfxVol * volK.sfx;
    g.ambBus = c.createGain(); g.ambBus.gain.value = AMB_VOL * volK.amb;
    g.musicBus.connect(g.duckG); g.duckG.connect(g.comp); g.sfxBus.connect(g.comp); g.ambBus.connect(g.comp);
    g.comp.connect(g.master); g.master.connect(g.lim); g.lim.connect(c.destination);
    var sr = c.sampleRate;
    g.noiseBuf = c.createBuffer(1, sr * 2, sr);
    var nd = g.noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
    // two reverbs sharing one generated impulse (music return / sfx return)
    var ir = makeIR(c, 2.2);
    g.mRevIn = c.createBiquadFilter(); g.mRevIn.type = 'highpass'; g.mRevIn.frequency.value = 260;
    var mConv = c.createConvolver(); mConv.buffer = ir;
    var mRet = c.createGain(); mRet.gain.value = 0.7;
    g.mRevIn.connect(mConv); mConv.connect(mRet); mRet.connect(g.musicBus);
    g.sRevIn = c.createBiquadFilter(); g.sRevIn.type = 'highpass'; g.sRevIn.frequency.value = 300;
    var sConv = c.createConvolver(); sConv.buffer = ir;
    var sRet = c.createGain(); sRet.gain.value = 0.55;
    g.sRevIn.connect(sConv); sConv.connect(sRet); sRet.connect(g.sfxBus);
    return g;
  }
  function useGraph(c, g) {
    ctx = c; master = g.master; comp = g.comp; lim = g.lim; musicBus = g.musicBus; duckG = g.duckG; sfxBus = g.sfxBus;
    ambBus = g.ambBus; mRevIn = g.mRevIn; sRevIn = g.sRevIn; noiseBuf = g.noiseBuf;
  }
  function graphNow() {
    return { ctx: ctx, g: { master: master, comp: comp, lim: lim, musicBus: musicBus, duckG: duckG, sfxBus: sfxBus, ambBus: ambBus, mRevIn: mRevIn, sRevIn: sRevIn, noiseBuf: noiseBuf } };
  }

  function build() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    var c;
    try { c = new AC({ latencyHint: 'interactive' }); } catch (e) { c = new AC(); }
    useGraph(c, makeGraph(c, true));
    return true;
  }

  /* -------------------------------------------------------------- positional */
  /** where a world point sits for the ear: pan (−1 left … +1 right of the view), distance gain (inverse from ref,
   *  smoothly 0 at max), a low-pass that closes as the source goes behind (and a little with distance) */
  function place(x, y, z) {
    var dx = x - lis.x, dy = (fin(y) ? y : lis.y) - lis.y, dz = z - lis.z;
    var dh = Math.sqrt(dx * dx + dz * dz), dist = Math.sqrt(dh * dh + dy * dy);
    var fx = Math.sin(lis.yaw), fz = Math.cos(lis.yaw), rx = -Math.cos(lis.yaw), rz = Math.sin(lis.yaw);
    var side = dx * rx + dz * rz, front = dx * fx + dz * fz;
    var pan = dh > 0.05 ? clamp(side / Math.max(dh, 1), -1, 1) * CFG.panK : 0;
    var gain = (CFG.ref / Math.max(CFG.ref, dist)) * (1 - smooth(CFG.max * 0.7, CFG.max, dist));
    var behind = dh > 0.3 ? clamp(-front / dh, 0, 1) : 0;
    var lp = CFG.lpFront * Math.pow(CFG.lpBehind / CFG.lpFront, behind) * clamp(1 - dist / 120, 0.45, 1);
    gain *= 1 - 0.15 * behind;
    return { pan: pan, gain: gain, lp: lp, dist: dist, front: dh > 0.05 ? front / dh : 1, behind: behind };
  }
  function chain(c, P, bus) {
    var inG = c.createGain(), lp = c.createBiquadFilter(), out = c.createGain();
    var pn = c.createStereoPanner ? c.createStereoPanner() : null;
    lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = clamp(P.lp, 60, 20000);
    out.gain.value = P.gain;
    inG.connect(lp);
    if (pn) { pn.pan.value = clamp(P.pan, -1, 1); lp.connect(pn); pn.connect(out); } else lp.connect(out);
    out.connect(bus || sfxBus);
    return { input: inG, lp: lp, pan: pn, out: out };
  }
  function unchain(ch) { if (!ch) return; for (var k in ch) { try { if (ch[k] && ch[k].disconnect) ch[k].disconnect(); } catch (e) { /* ignore */ } } }


  /* ---------------------------------------------------------------- SFX bank */
  var SFX = {
    swing: function (t) {
      var p = rv(0.08);
      N({ t: t, d: 0.16, v: 0.2, a: 0.025, type: 'bandpass', f: 500 * p, f1: 2600 * p, q: 1.1 });
      T({ t: t, f: 260 * p, f1: 620 * p, d: 0.13, v: 0.07, type: 'triangle', a: 0.02 });
      return 0.2;
    },
    hit: function (t) {
      var p = rv(0.1);
      T({ t: t, f: 260 * p, f1: 90 * p, d: 0.13, v: 0.5 });
      T({ t: t, f: 520 * p, f1: 300 * p, d: 0.07, v: 0.14, type: 'triangle' });
      N({ t: t, d: 0.06, v: 0.16, type: 'highpass', f: 1800 });
      return 0.15;
    },
    enemyDie: function (t) {
      var p = rv(0.06);
      N({ t: t, d: 0.34, v: 0.26, a: 0.01, type: 'lowpass', f: 2400, f1: 260, q: 0.7 });
      T({ t: t, f: 680 * p, f1: 160 * p, d: 0.3, v: 0.26, vib: [18, 25] });
      T({ t: t + 0.05, f: 900 * p, f1: 350, d: 0.2, v: 0.09, type: 'triangle' });
      T({ t: t + 0.13, f: 1760 * p, d: 0.2, v: 0.07, rev: 0.2 });
      return 0.4;
    },
    hurt: function (t) {
      T({ t: t, f: 560, f1: 250, d: 0.26, v: 0.32, type: 'triangle', vib: [14, 18] });
      T({ t: t, f: 340, f1: 180, d: 0.22, v: 0.2 });
      N({ t: t, d: 0.06, v: 0.1, type: 'lowpass', f: 700 });
      return 0.3;
    },
    coin: function (t) {
      var p = rv(0.03);
      T({ t: t, f: 1318.5 * p, d: 0.09, v: 0.2, type: 'triangle', a: 0.002 });
      T({ t: t + 0.06, f: 1975.5 * p, d: 0.26, v: 0.2, type: 'triangle', a: 0.002, rev: 0.12 });
      T({ t: t + 0.06, f: 3951 * p, d: 0.1, v: 0.045 });
      return 0.34;
    },
    heart: function (t) {
      var n = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < n.length; i++) {
        T({ t: t + i * 0.075, f: n[i], d: 0.32, v: 0.19, a: 0.004, rev: 0.2 });
        T({ t: t + i * 0.075, f: n[i] * 2, d: 0.14, v: 0.04 });
      }
      return 0.65;
    },
    chest: function (t) {
      T({ t: t, f: 110, f1: 190, d: 0.32, v: 0.1, type: 'sawtooth', lp: 520, vib: [9, 7] });
      N({ t: t, d: 0.2, v: 0.08, type: 'lowpass', f: 320 });
      var n = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < n.length; i++) T({ t: t + 0.32 + i * 0.075, f: n[i], d: 0.4, v: 0.19, a: 0.004, rev: 0.28 });
      var c = [1046.5, 1318.5, 1568];
      for (var j = 0; j < c.length; j++) T({ t: t + 0.72, f: c[j], d: 0.8, v: 0.08, a: 0.01, rev: 0.3 });
      return 1.5;
    },
    dash: function (t) {
      N({ t: t, d: 0.22, v: 0.22, a: 0.03, type: 'bandpass', f: 700, f1: 3600, q: 0.9 });
      T({ t: t, f: 180, f1: 520, d: 0.18, v: 0.07 });
      return 0.26;
    },
    talk: function (t) {
      var p = rv(0.2);
      T({ t: t, f: 560 * p, f1: 610 * p, d: 0.04, v: 0.085, a: 0.004 });
      return 0.06;
    },
    menu: function (t) {
      var p = rv(0.01);
      T({ t: t, f: 880 * p, f1: 940 * p, d: 0.065, v: 0.15, type: 'triangle', a: 0.003 });
      return 0.09;
    },
    select: function (t) {
      T({ t: t, f: 660, d: 0.11, v: 0.19, type: 'triangle', a: 0.004 });
      T({ t: t + 0.06, f: 990, d: 0.2, v: 0.19, type: 'triangle', a: 0.004, rev: 0.12 });
      return 0.28;
    },
    cancel: function (t) {
      T({ t: t, f: 520, d: 0.1, v: 0.17, type: 'triangle', a: 0.004 });
      T({ t: t + 0.07, f: 390, d: 0.16, v: 0.17, type: 'triangle', a: 0.004 });
      return 0.25;
    },
    bossHit: function (t) {
      T({ t: t, f: 170, f1: 45, d: 0.32, v: 0.6 });
      T({ t: t, f: 220, f1: 80, d: 0.14, v: 0.14, type: 'sawtooth', lp: 600 });
      N({ t: t, d: 0.22, v: 0.3, type: 'lowpass', f: 1000, f1: 200 });
      T({ t: t, f: 1100, d: 0.28, v: 0.1, rev: 0.1 });
      T({ t: t, f: 1700, d: 0.18, v: 0.06 });
      return 0.38;
    },
    bossDie: function (t) {
      T({ t: t, f: 130, f1: 30, d: 1.7, v: 0.5, a: 0.03 });
      N({ t: t, d: 1.7, v: 0.32, a: 0.05, type: 'lowpass', f: 700, f1: 90 });
      for (var i = 0; i < 4; i++) {
        var tt = t + 0.25 + i * 0.3;
        N({ t: tt, d: 0.22, v: 0.24, type: 'lowpass', f: 1600, f1: 280 });
        T({ t: tt, f: 520 * rv(0.1), f1: 150, d: 0.26, v: 0.18 });
      }
      var n = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
      for (var j = 0; j < n.length; j++) bell(t + 1.45 + j * 0.09, n[j], 0.9, 0.7, null, 0.35);
      for (var k = 0; k < 3; k++) T({ t: t + 2.05, f: [523.25, 659.25, 783.99][k], d: 1.1, v: 0.1, a: 0.02, rev: 0.4 });
      return 3.2;
    },
    seed: function (t) {
      var n = [783.99, 987.77, 1174.7, 1568, 1975.5, 2349.3];
      for (var i = 0; i < n.length; i++) bell(t + i * 0.075, n[i], 0.7, 0.75, null, 0.35);
      T({ t: t, f: 392, d: 1.1, v: 0.08, type: 'triangle', a: 0.25, rev: 0.3 });
      return 1.3;
    },
    fanfare: function (t) {
      var seq = [[392, 0, 0.13], [523.25, 0.14, 0.13], [659.25, 0.28, 0.13], [783.99, 0.42, 0.36],
                 [659.25, 0.84, 0.15], [783.99, 1.0, 0.15], [1046.5, 1.16, 0.95]];
      for (var i = 0; i < seq.length; i++) {
        var s = seq[i], f = s[0];
        T({ t: t + s[1], f: f, d: s[2] + 0.12, h: s[2], v: 0.15, type: 'square', lp: 2400, a: 0.01, rev: 0.2 });
        T({ t: t + s[1], f: f, d: s[2] + 0.12, h: s[2], v: 0.16, type: 'triangle', a: 0.01 });
        T({ t: t + s[1], f: f * 2, d: s[2] + 0.1, h: s[2] * 0.5, v: 0.03 });
      }
      var ch = [261.63, 329.63, 392, 523.25];
      for (var j = 0; j < ch.length; j++) T({ t: t + 1.16, f: ch[j], d: 1.15, h: 0.7, v: 0.09, type: 'triangle', a: 0.02, rev: 0.25 });
      for (var k = 0; k < 4; k++) bell(t + 1.3 + k * 0.1, [2093, 2637, 3136, 4186][k], 0.5, 0.35, null, 0.3);
      return 2.3;
    },
    bush: function (t) {
      var p = rv(0.1);
      N({ t: t, d: 0.1, v: 0.17, a: 0.01, type: 'bandpass', f: 3200 * p, f1: 5200 * p, q: 0.8 });
      N({ t: t + 0.05, d: 0.1, v: 0.14, a: 0.01, type: 'bandpass', f: 2800 * p, f1: 4600 * p, q: 0.8 });
      T({ t: t, f: 600 * p, f1: 400, d: 0.06, v: 0.06, type: 'triangle' });
      return 0.2;
    },
    pot: function (t) {
      var p = rv(0.08);
      T({ t: t, f: 220, f1: 120, d: 0.1, v: 0.2 });
      N({ t: t, d: 0.05, v: 0.22, type: 'highpass', f: 2500 });
      N({ t: t + 0.03, d: 0.05, v: 0.18, type: 'highpass', f: 3500 });
      N({ t: t + 0.07, d: 0.06, v: 0.14, type: 'highpass', f: 3000 });
      T({ t: t, f: 1500 * p, f1: 900, d: 0.1, v: 0.11, type: 'triangle' });
      T({ t: t + 0.02, f: 2300 * p, d: 0.13, v: 0.06, rev: 0.1 });
      return 0.3;
    },
    stomp: function (t) {
      T({ t: t, f: 130, f1: 38, d: 0.42, v: 0.75 });
      T({ t: t, f: 90, f1: 40, d: 0.3, v: 0.28, type: 'triangle' });
      N({ t: t, d: 0.32, v: 0.42, type: 'lowpass', f: 520, f1: 80 });
      return 0.5;
    },
    shoot: function (t) {
      var p = rv(0.06);
      T({ t: t, f: 880 * p, f1: 330 * p, d: 0.17, v: 0.2, type: 'triangle', a: 0.005 });
      N({ t: t, d: 0.11, v: 0.09, type: 'bandpass', f: 2200, f1: 900 });
      return 0.2;
    },
    splash: function (t) {
      N({ t: t, d: 0.42, v: 0.3, a: 0.02, type: 'bandpass', f: 1400, f1: 500, q: 0.7, rev: 0.15 });
      T({ t: t + 0.05, f: 350, f1: 800, d: 0.1, v: 0.12 });
      T({ t: t + 0.12, f: 450, f1: 1000, d: 0.09, v: 0.1 });
      return 0.5;
    },
    bubble: function (t) {
      var p = rv(0.15);
      T({ t: t, f: 380 * p, f1: 900 * p, d: 0.13, v: 0.2, a: 0.01 });
      T({ t: t + 0.12, f: 1800 * p, d: 0.04, v: 0.05 });
      N({ t: t + 0.13, d: 0.025, v: 0.07, type: 'highpass', f: 4000 });
      return 0.2;
    },
    snow: function (t) {
      N({ t: t, d: 0.3, v: 0.2, a: 0.04, type: 'lowpass', f: 3000, f1: 900, q: 0.5 });
      N({ t: t + 0.02, d: 0.05, v: 0.05, type: 'highpass', f: 5000 });
      T({ t: t, f: 2600, d: 0.15, v: 0.03, rev: 0.15 });
      return 0.35;
    },
    potion: function (t) {
      for (var i = 0; i < 3; i++) T({ t: t + i * 0.1, f: 320 + i * 60, f1: 520 + i * 60, d: 0.1, v: 0.2, a: 0.01 });
      var n = [1046.5, 1318.5, 1568, 2093];
      for (var j = 0; j < n.length; j++) T({ t: t + 0.36 + j * 0.065, f: n[j], d: 0.3, v: 0.11, a: 0.004, rev: 0.25 });
      return 0.85;
    },
    buy: function (t) {
      bell(t, 1568, 0.3, 0.8, null, 0.15);
      bell(t + 0.09, 2093, 0.6, 0.9, null, 0.2);
      N({ t: t, d: 0.03, v: 0.06, type: 'highpass', f: 6000 });
      N({ t: t + 0.09, d: 0.03, v: 0.06, type: 'highpass', f: 6500 });
      return 0.8;
    },
    error: function (t) {
      T({ t: t, f: 250, d: 0.1, v: 0.13, type: 'square', lp: 900, a: 0.008 });
      T({ t: t + 0.11, f: 190, d: 0.17, v: 0.13, type: 'square', lp: 800, a: 0.008 });
      return 0.32;
    },
    death: function (t) {
      T({ t: t, f: 700, f1: 110, d: 1.1, v: 0.28, type: 'triangle', vib: [7, 40] });
      T({ t: t, f: 350, f1: 55, d: 1.1, v: 0.2, vib: [5, 14] });
      T({ t: t + 1.05, f: 300, f1: 120, d: 0.18, v: 0.18 });
      return 1.4;
    },
    door: function (t) {
      T({ t: t, f: 160, f1: 90, d: 0.1, v: 0.34 });
      T({ t: t + 0.03, f: 140, f1: 210, d: 0.26, v: 0.07, type: 'sawtooth', lp: 450, vib: [11, 8] });
      T({ t: t + 0.3, f: 120, f1: 70, d: 0.13, v: 0.3 });
      N({ t: t + 0.3, d: 0.1, v: 0.1, type: 'lowpass', f: 500 });
      return 0.5;
    },
    place: (function () {
      var i = 0, n = [784, 987.77, 1174.7];
      return function (t) {
        var f = n[i++ % n.length];
        bell(t, f, 1.3, 0.9, null, 0.4);
        bell(t, f * 2, 0.8, 0.35, null, 0.4);
        T({ t: t, f: f / 2, d: 1.1, v: 0.1, type: 'triangle', a: 0.3, rev: 0.4 });
        N({ t: t, d: 0.5, v: 0.04, a: 0.2, type: 'bandpass', f: 3000, f1: 6000, q: 2 });
        return 1.5;
      };
    })(),
    bloom: function (t) {
      var m = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];
      for (var i = 0; i < m.length; i++) {
        var f = mtof(m[i]);
        T({ t: t + i * 0.09, f: f, d: 0.9, v: 0.15, type: 'triangle', a: 0.004, lp: 4000, rev: 0.4 });
        T({ t: t + i * 0.09, f: f * 2, d: 0.35, v: 0.03 });
      }
      var ch = [261.63, 329.63, 392, 523.25, 659.25, 784];
      for (var j = 0; j < ch.length; j++) T({ t: t + 1.2, f: ch[j], d: 2.3, h: 1.1, v: 0.1, type: 'triangle', a: 0.15, rev: 0.45 });
      for (var k = 0; k < 10; k++) T({ t: t + 1.2 + k * 0.12, f: 2000 + rnd() * 2200, d: 0.22, v: 0.045, rev: 0.4 });
      return 3.6;
    },
    step: function (t) {
      var p = rv(0.2);
      N({ t: t, d: 0.045, v: 0.05, a: 0.004, type: 'lowpass', f: 700 * p });
      T({ t: t, f: 95 * p, f1: 60, d: 0.05, v: 0.035 });
      return 0.07;
    }
  };

  /* ------------------------------------------------- SFX bank: WP5 additions */
  // All soft and round (triangle / sine bodies, filtered noise, no harsh square leads); cues for danger are short and
  // readable rather than scary. o = the call's options (o.dur stretches the timed ones).
  function chirp(t, f0, f1, d, v, type) { T({ t: t, f: f0, f1: f1, d: d, v: v, type: type || 'sine', a: 0.004 }); }
  var MORE = {
    // ---- footsteps per surface (EV.STEP; every step, quiet, panned ±0.15 by foot)
    step_grass: function (t) { var p = rv(0.15); N({ t: t, d: 0.06, v: 0.225, a: 0.004, type: 'bandpass', f: 2400 * p, f1: 1400 * p, q: 0.7 }); T({ t: t, f: 90 * p, f1: 60, d: 0.05, v: 0.105 }); return 0.08; },
    step_dirt: function (t) { var p = rv(0.15); N({ t: t, d: 0.05, v: 0.24, a: 0.003, type: 'lowpass', f: 950 * p, f1: 420 }); T({ t: t, f: 85 * p, f1: 55, d: 0.06, v: 0.15 }); return 0.08; },
    step_sand: function (t) { var p = rv(0.15); N({ t: t, d: 0.07, v: 0.21, a: 0.006, type: 'bandpass', f: 3600 * p, q: 1.4 }); N({ t: t + 0.022, d: 0.05, v: 0.135, type: 'bandpass', f: 2700 * p, q: 1.6 }); return 0.1; },
    step_snow: function (t) { var p = rv(0.12); for (var i = 0; i < 3; i++) N({ t: t + i * 0.018, d: 0.03, v: 0.18, a: 0.002, type: 'bandpass', f: (1500 + i * 500) * p, q: 2.5 }); T({ t: t, f: 120 * p, f1: 70, d: 0.05, v: 0.09 }); return 0.1; },
    step_wood: function (t) { var p = rv(0.1); T({ t: t, f: 200 * p, f1: 150 * p, d: 0.07, v: 0.3, type: 'triangle' }); N({ t: t, d: 0.03, v: 0.135, type: 'bandpass', f: 750 * p, q: 1.2 }); return 0.09; },
    step_stone: function (t) { var p = rv(0.1); T({ t: t, f: 950 * p, f1: 700 * p, d: 0.025, v: 0.135, type: 'triangle' }); N({ t: t, d: 0.03, v: 0.18, type: 'highpass', f: 2500 }); T({ t: t, f: 80, f1: 60, d: 0.04, v: 0.105 }); return 0.06; },
    step_wade: function (t) { var p = rv(0.15); N({ t: t, d: 0.16, v: 0.33, a: 0.01, type: 'bandpass', f: 1300 * p, f1: 600 * p, q: 0.9 }); T({ t: t + 0.03, f: 380 * p, f1: 700 * p, d: 0.06, v: 0.135 }); return 0.2; },
    // ---- jump / land (C2)
    jump: function (t) { var p = rv(0.06); T({ t: t, f: 330 * p, f1: 560 * p, d: 0.09, v: 0.11, type: 'triangle', a: 0.01 }); N({ t: t, d: 0.12, v: 0.06, a: 0.02, type: 'bandpass', f: 900, f1: 2200, q: 0.8 }); return 0.14; },
    land: function (t) { var p = rv(0.08); T({ t: t, f: 120 * p, f1: 60, d: 0.1, v: 0.24 }); N({ t: t, d: 0.09, v: 0.1, type: 'lowpass', f: 900, f1: 300 }); return 0.14; },
    landHeavy: function (t) { T({ t: t, f: 100, f1: 45, d: 0.2, v: 0.34 }); N({ t: t, d: 0.18, v: 0.2, type: 'lowpass', f: 700, f1: 160 }); T({ t: t + 0.02, f: 300, f1: 200, d: 0.06, v: 0.05, type: 'triangle' }); return 0.24; },
    // ---- sword: three whooshes (A forehand sweeps up, B backhand sweeps down, C overhead: wind-up hiss, then the chop)
    swingA: function (t) { var p = rv(0.06); N({ t: t, d: 0.17, v: 0.26, a: 0.025, type: 'bandpass', f: 520 * p, f1: 2800 * p, q: 1.1 }); T({ t: t, f: 260 * p, f1: 640 * p, d: 0.13, v: 0.06, type: 'triangle', a: 0.02 }); return 0.2; },
    swingB: function (t) { var p = rv(0.06); N({ t: t, d: 0.17, v: 0.19, a: 0.02, type: 'bandpass', f: 2600 * p, f1: 700 * p, q: 1.1 }); T({ t: t, f: 600 * p, f1: 300 * p, d: 0.13, v: 0.055, type: 'triangle', a: 0.02 }); return 0.2; },
    swingC: function (t) { var p = rv(0.05); N({ t: t, d: 0.11, v: 0.1, a: 0.05, type: 'bandpass', f: 400 * p, f1: 1200 * p, q: 1.0 }); N({ t: t + 0.09, d: 0.16, v: 0.13, a: 0.01, type: 'bandpass', f: 2400 * p, f1: 500 * p, q: 1.0 }); T({ t: t + 0.09, f: 380 * p, f1: 150 * p, d: 0.16, v: 0.05, type: 'triangle' }); return 0.27; },
    swingSparkle: function (t) { for (var i = 0; i < 3; i++) T({ t: t + 0.03 + i * 0.035, f: [2637, 3136, 3951][i], d: 0.12, v: 0.035, a: 0.002 }); return 0.2; },
    clink: function (t) { var p = rv(0.04); T({ t: t, f: 2093 * p, d: 0.3, v: 0.13, a: 0.002, rev: 0.15 }); T({ t: t, f: 3140 * p, d: 0.18, v: 0.07, a: 0.002 }); T({ t: t, f: 5770 * p, d: 0.08, v: 0.03, a: 0.001 }); N({ t: t, d: 0.02, v: 0.12, type: 'highpass', f: 5000 }); return 0.32; },
    squish: function (t) { var p = rv(0.1); T({ t: t, f: 320 * p, f1: 160 * p, d: 0.1, v: 0.12, vib: [30, 30] }); return 0.12; },
    pop: function (t) { var p = rv(0.1); T({ t: t, f: 600 * p, f1: 1300 * p, d: 0.07, v: 0.3, a: 0.003 }); N({ t: t, d: 0.05, v: 0.16, type: 'bandpass', f: 2200, q: 1 }); return 0.1; },
    tink: function (t) { var p = rv(0.08); T({ t: t, f: 2600 * p, d: 0.05, v: 0.06, type: 'triangle', a: 0.001 }); return 0.07; },
    // ---- enemies: the notice chirp, the off-view announce, one wind-up cue each, the attack releases
    alert: function (t) { var p = rv(0.05); chirp(t, 880 * p, 1240 * p, 0.07, 0.13, 'triangle'); chirp(t + 0.08, 1180 * p, 1760 * p, 0.09, 0.13, 'triangle'); return 0.2; },
    announce: function (t) { var p = rv(0.03); chirp(t, 1320 * p, 1250 * p, 0.09, 0.12, 'triangle'); chirp(t + 0.12, 990 * p, 930 * p, 0.13, 0.12, 'triangle'); return 0.28; },
    windup_slime: function (t, o) { var d = o.dur || 0.4; T({ t: t, f: 260, f1: 120, fd: d, d: d + 0.04, v: 0.14, type: 'triangle', vib: [16, 24] }); return d + 0.06; },
    boing: function (t) { var p = rv(0.08); T({ t: t, f: 170 * p, f1: 430 * p, d: 0.18, v: 0.14, vib: [22, 18] }); return 0.2; },
    windup_mushroom: function (t, o) { var d = o.dur || 0.55; N({ t: t, d: d, v: 0.12, a: d * 0.75, type: 'bandpass', f: 650, f1: 2200, q: 1.2 }); T({ t: t, f: 300, f1: 430, d: d, v: 0.045, a: d * 0.6, type: 'triangle' }); return d + 0.05; },
    windup_bat: function (t) { var p = rv(0.06); chirp(t, 2300 * p, 2950 * p, 0.05, 0.08); chirp(t + 0.11, 2450 * p, 3100 * p, 0.05, 0.08); N({ t: t, d: 0.3, v: 0.05, a: 0.02, type: 'bandpass', f: 600, q: 0.8 }); return 0.32; },
    swoop: function (t) { N({ t: t, d: 0.35, v: 0.12, a: 0.04, type: 'bandpass', f: 1900, f1: 550, q: 1.1 }); return 0.38; },
    windup_bee: function (t, o) { var d = o.dur || 0.7; T({ t: t, f: 175, f1: 330, d: d, v: 0.07, a: 0.06, type: 'sawtooth', lp: 1100, vib: [28, 14] }); return d + 0.05; },
    zip: function (t) { T({ t: t, f: 330, f1: 520, d: 0.3, v: 0.07, type: 'sawtooth', lp: 1600, vib: [34, 16] }); N({ t: t, d: 0.25, v: 0.05, type: 'bandpass', f: 1400, f1: 2400 }); return 0.32; },
    windup_crab: function (t) { for (var i = 0; i < 4; i++) { var tt = t + i * 0.14; N({ t: tt, d: 0.02, v: 0.14, a: 0.001, type: 'bandpass', f: 2600, q: 2 }); T({ t: tt, f: 1300, d: 0.025, v: 0.06, type: 'triangle', a: 0.001 }); } return 0.5; },
    scuttle: function (t) { for (var i = 0; i < 6; i++) N({ t: t + i * 0.06, d: 0.02, v: 0.06, a: 0.001, type: 'bandpass', f: 3000 * rv(0.1), q: 2 }); return 0.4; },
    windup_snowpuff: function (t, o) { var d = o.dur || 0.6; N({ t: t, d: d, v: 0.1, a: d * 0.7, type: 'lowpass', f: 400, f1: 2600, q: 0.7 }); for (var i = 0; i < 3; i++) T({ t: t + d * (0.35 + i * 0.2), f: [2093, 2637, 3136][i], d: 0.2, v: 0.03, a: 0.003 }); return d + 0.1; },
    throw: function (t) { N({ t: t, d: 0.12, v: 0.12, a: 0.01, type: 'bandpass', f: 900, f1: 2400, q: 1 }); T({ t: t, f: 300, f1: 620, d: 0.1, v: 0.05, type: 'triangle' }); return 0.14; },
    whistle: function (t, o) { var d = Math.max(0.3, o.dur || 0.9); T({ t: t, f: 1700, f1: 760, d: d, v: 0.06, a: 0.05, vib: [6, 10] }); return d + 0.05; },
    emerge_ground: function (t) { T({ t: t, f: 180, f1: 460, d: 0.35, v: 0.09, vib: [18, 30] }); for (var i = 0; i < 3; i++) T({ t: t + 0.1 + i * 0.12, f: 500 + i * 160, f1: 900 + i * 160, d: 0.05, v: 0.04 }); return 0.5; },
    emerge_sky: function (t) { N({ t: t, d: 0.5, v: 0.07, a: 0.05, type: 'bandpass', f: 2200, f1: 700, q: 1 }); T({ t: t + 0.3, f: 1200, f1: 900, d: 0.15, v: 0.04, type: 'triangle' }); return 0.55; },
    emerge_bush: function (t) { N({ t: t, d: 0.12, v: 0.1, a: 0.01, type: 'bandpass', f: 3200, f1: 5000, q: 0.8 }); N({ t: t + 0.08, d: 0.14, v: 0.08, a: 0.01, type: 'bandpass', f: 2800, f1: 4400, q: 0.8 }); return 0.25; },
    emerge_water: function (t) { N({ t: t, d: 0.3, v: 0.14, a: 0.02, type: 'bandpass', f: 1400, f1: 500, q: 0.8 }); T({ t: t + 0.08, f: 350, f1: 800, d: 0.1, v: 0.06 }); return 0.35; },
    // ---- bosses: wind-up cues by attack kind (cute grumbles, never roars), releases, impacts
    windSlam: function (t, o) { var d = o.dur || 0.55; T({ t: t, f: 150, f1: 96, fd: d, d: d + 0.05, v: 0.2, type: 'triangle', vib: [9, 7] }); N({ t: t, d: d, v: 0.06, a: d * 0.5, type: 'lowpass', f: 320 }); return d + 0.1; },
    windShot: function (t, o) { var d = o.dur || 0.6; N({ t: t, d: d, v: 0.14, a: d * 0.7, type: 'bandpass', f: 500, f1: 1700, q: 1.1 }); T({ t: t, f: 220, f1: 330, d: d, v: 0.05, a: d * 0.5, type: 'triangle' }); return d + 0.05; },
    windCharge: function (t, o) { var d = o.dur || 0.8; for (var i = 0; i < 3; i++) N({ t: t + i * d * 0.3, d: d * 0.22, v: 0.11, a: 0.03, type: 'bandpass', f: 1500 * rv(0.1), q: 1.5 }); T({ t: t, f: 120, f1: 105, d: d, v: 0.1, type: 'triangle', vib: [11, 5] }); return d + 0.05; },
    chargeLock: function (t) { T({ t: t, f: 1400, f1: 1100, d: 0.04, v: 0.12, type: 'triangle', a: 0.001 }); N({ t: t, d: 0.02, v: 0.1, type: 'highpass', f: 3500 }); return 0.06; },
    windLunge: function (t) { for (var i = 0; i < 4; i++) { var tt = t + [0, 0.13, 0.34, 0.47][i]; N({ t: tt, d: 0.03, v: 0.17, a: 0.001, type: 'bandpass', f: 1800, q: 2 }); T({ t: tt, f: 900, d: 0.04, v: 0.08, type: 'triangle', a: 0.001 }); } return 0.55; },
    snap: function (t) { T({ t: t, f: 700, f1: 300, d: 0.08, v: 0.13, type: 'sawtooth', lp: 1600 }); N({ t: t, d: 0.04, v: 0.12, type: 'highpass', f: 3000 }); return 0.1; },
    windLeap: function (t, o) { var d = o.dur || 0.45; T({ t: t, f: 200, f1: 150, d: d, v: 0.12, type: 'triangle' }); N({ t: t, d: d, v: 0.08, a: d * 0.6, type: 'bandpass', f: 600, f1: 1500 }); return d + 0.05; },
    hup: function (t) { T({ t: t, f: 260, f1: 540, d: 0.14, v: 0.16, type: 'triangle' }); return 0.16; },
    leapWhistle: function (t, o) { var d = Math.max(0.5, o.dur || 1.15), h = d * 0.45; T({ t: t, f: 640, f1: 1500, d: h, h: h * 0.8, v: 0.09, a: 0.08, vib: [5, 12] }); T({ t: t + h, f: 1500, f1: 520, d: d - h, v: 0.1, a: 0.02, vib: [5, 12] }); return d + 0.05; },
    windSummon: function (t) { for (var i = 0; i < 4; i++) bell(t + i * 0.12, [784, 988, 1175, 1568][i], 0.5, 0.45, null, 0.2); return 0.9; },
    summon: function (t) { N({ t: t, d: 0.3, v: 0.1, type: 'lowpass', f: 1800, f1: 300 }); T({ t: t, f: 520, f1: 1040, d: 0.2, v: 0.06 }); return 0.35; },
    windRing: function (t) { T({ t: t, f: 300, f1: 210, d: 0.16, v: 0.13, type: 'triangle' }); return 0.18; },
    rumble: function (t, o) { var d = Math.max(0.5, o.dur || 2.2); N({ t: t, d: d, v: 0.22, a: 0.05, type: 'lowpass', f: 220, f1: 120, q: 0.7 }); T({ t: t, f: 58, f1: 46, d: d, v: 0.14, vib: [7, 4] }); return d + 0.05; },
    slide: function (t) { N({ t: t, d: 0.5, v: 0.12, a: 0.03, type: 'bandpass', f: 3200, f1: 1400, q: 0.9 }); return 0.55; },
    bonk: function (t) { T({ t: t, f: 170, f1: 85, d: 0.2, v: 0.3 }); T({ t: t, f: 560, f1: 920, d: 0.09, v: 0.07, vib: [25, 30] }); return 0.25; },
    bossPop: function (t) { var p = rv(0.1); T({ t: t, f: 520 * p, f1: 150, d: 0.26, v: 0.18 }); N({ t: t, d: 0.2, v: 0.16, type: 'lowpass', f: 1600, f1: 280 }); return 0.3; },
    bossIntro: function (t) { T({ t: t, f: 98, f1: 60, d: 0.3, v: 0.32 }); T({ t: t + 0.05, f: 196, d: 0.4, h: 0.3, v: 0.08, type: 'triangle', lp: 900 }); T({ t: t + 0.5, f: 262, d: 0.7, h: 0.5, v: 0.09, type: 'triangle', lp: 1200, rev: 0.3 }); T({ t: t + 0.5, f: 392, d: 0.7, h: 0.5, v: 0.05, type: 'triangle', rev: 0.3 }); return 1.3; },
    // ---- player / pickups / UI names other packages may call (C8)
    pickupGem: function (t, o) { var p = rv(0.03); T({ t: t, f: 1318.5 * p, d: 0.09, v: 0.2, type: 'triangle', a: 0.002 }); T({ t: t + 0.06, f: 1975.5 * p, d: 0.26, v: 0.2, type: 'triangle', a: 0.002, rev: 0.12 }); if ((o.value || 1) > 1) T({ t: t + 0.12, f: 2637 * p, d: 0.3, v: 0.12, type: 'triangle', a: 0.002, rev: 0.15 }); return 0.4; },
    lockOn: function (t) { chirp(t, 1320, 1760, 0.07, 0.1, 'triangle'); T({ t: t + 0.06, f: 2637, d: 0.06, v: 0.04 }); return 0.14; },
    lockOff: function (t) { chirp(t, 1760, 1320, 0.08, 0.08, 'triangle'); return 0.1; },
    viewSwitch: function (t) { N({ t: t, d: 0.12, v: 0.06, a: 0.02, type: 'bandpass', f: 1200, f1: 2600, q: 0.9 }); T({ t: t + 0.08, f: 1800, d: 0.025, v: 0.04, type: 'triangle', a: 0.001 }); return 0.14; },
    uiMove: function (t) { T({ t: t, f: 1500, d: 0.03, v: 0.06, type: 'triangle', a: 0.002 }); return 0.04; },
    uiTick: function (t) { T({ t: t, f: 2200, d: 0.015, v: 0.05, type: 'triangle', a: 0.001 }); return 0.03; },
    uiOpen: function (t) { N({ t: t, d: 0.1, v: 0.05, a: 0.02, type: 'bandpass', f: 2600, q: 0.7 }); T({ t: t, f: 660, d: 0.1, v: 0.12, type: 'triangle' }); T({ t: t + 0.07, f: 990, d: 0.16, v: 0.12, type: 'triangle', rev: 0.1 }); return 0.25; },
    uiClose: function (t) { T({ t: t, f: 990, d: 0.08, v: 0.1, type: 'triangle' }); T({ t: t + 0.06, f: 660, d: 0.14, v: 0.1, type: 'triangle' }); return 0.22; },
    uiTab: function (t) { T({ t: t, f: 1100, d: 0.03, v: 0.08, type: 'triangle', a: 0.001 }); N({ t: t, d: 0.02, v: 0.04, type: 'bandpass', f: 2000, q: 1 }); return 0.05; },
    uiSlider: function (t) { T({ t: t, f: 1800, d: 0.02, v: 0.05, type: 'triangle', a: 0.001 }); return 0.03; },
    coach: function (t) { bell(t, 1568, 0.7, 0.6, null, 0.2); return 0.75; },
    waypoint: function (t) { bell(t, 2093, 0.5, 0.5, null, 0.2); bell(t + 0.08, 2637, 0.6, 0.45, null, 0.2); return 0.7; },
    shoulder: function (t) { N({ t: t, d: 0.1, v: 0.05, a: 0.02, type: 'bandpass', f: 1500, f1: 2200, q: 0.8 }); return 0.12; },
    eyelid: function (t) { N({ t: t, d: 0.4, v: 0.05, a: 0.15, type: 'lowpass', f: 800, f1: 2000 }); T({ t: t, f: 520, d: 0.5, v: 0.05, a: 0.2, type: 'triangle', rev: 0.3 }); return 0.55; },
    whoosh: function (t) { N({ t: t, d: 0.25, v: 0.12, a: 0.04, type: 'bandpass', f: 600, f1: 2400, q: 1 }); return 0.28; },
    sparkle: function (t) { for (var i = 0; i < 4; i++) T({ t: t + i * 0.05, f: [2093, 2637, 3136, 4186][i], d: 0.25, v: 0.05, a: 0.002, rev: 0.25 }); return 0.5; },
    creak: function (t) { T({ t: t, f: 180, f1: 245, d: 0.45, v: 0.07, type: 'sawtooth', lp: 700, vib: [11, 9] }); return 0.5; },
    splashBig: function (t) { N({ t: t, d: 0.6, v: 0.36, a: 0.02, type: 'bandpass', f: 1200, f1: 380, q: 0.6, rev: 0.2 }); T({ t: t + 0.06, f: 300, f1: 760, d: 0.12, v: 0.12 }); T({ t: t + 0.16, f: 420, f1: 980, d: 0.1, v: 0.1 }); return 0.65; },
    leaves: function (t) { var p = rv(0.1); N({ t: t, d: 0.14, v: 0.1, a: 0.02, type: 'bandpass', f: 3200 * p, f1: 4800 * p, q: 0.7 }); N({ t: t + 0.07, d: 0.14, v: 0.08, a: 0.02, type: 'bandpass', f: 2800 * p, f1: 4200 * p, q: 0.7 }); return 0.25; },
    bell: function (t) { bell(t, 1046.5, 1.2, 0.8, null, 0.3); return 1.2; },
    hello: function (t) { var p = rv(0.12); chirp(t, 700 * p, 980 * p, 0.08, 0.07, 'triangle'); chirp(t + 0.1, 880 * p, 1180 * p, 0.1, 0.07, 'triangle'); return 0.22; },
    // ---- low health (soft "bum-bum", gentle and low, never a siren)
    heartbeat: function (t) { T({ t: t, f: 64, f1: 48, d: 0.12, v: 0.11 }); T({ t: t + 0.2, f: 56, f1: 42, d: 0.14, v: 0.08 }); N({ t: t, d: 0.06, v: 0.03, type: 'lowpass', f: 300 }); return 0.36; },
    // ---- ambience one-shots (the beds schedule them; o.vol / o.pan from the bed)
    ambBird: function (t) { var p = rv(0.12), n = 2 + ((rnd() * 3) | 0); for (var i = 0; i < n; i++) chirp(t + i * 0.09, 2700 * p, 3500 * p * rv(0.05), 0.06, 0.05); return 0.4; },
    ambCricket: function (t) { T({ t: t, f: 4200 * rv(0.04), d: 0.28, h: 0.24, v: 0.025, a: 0.01, vib: [32, 400] }); return 0.3; },
    ambGull: function (t) { var p = rv(0.08); T({ t: t, f: 900 * p, f1: 1350 * p, fd: 0.12, d: 0.36, v: 0.04, type: 'sawtooth', lp: 1900 }); T({ t: t + 0.42, f: 1000 * p, f1: 1250 * p, fd: 0.1, d: 0.28, v: 0.03, type: 'sawtooth', lp: 1800 }); return 0.75; },
    ambOwl: function (t) { T({ t: t, f: 430, f1: 380, d: 0.32, v: 0.06, a: 0.04 }); T({ t: t + 0.45, f: 410, f1: 360, d: 0.42, v: 0.055, a: 0.04 }); return 0.9; },
    ambChime: function (t) { var n = [1568, 1760, 2093, 2349, 2637]; for (var i = 0; i < 3; i++) bell(t + i * 0.18 * rv(0.3), n[(rnd() * n.length) | 0], 1.0, 0.25, null, 0.3); return 1.2; },
    ambTinkle: function (t) { for (var i = 0; i < 3; i++) T({ t: t + i * 0.07, f: 3500 + rnd() * 2000, d: 0.18, v: 0.02, a: 0.002, rev: 0.3 }); return 0.4; }
  };
  for (var mk in MORE) SFX[mk] = MORE[mk];
  // aliases other packages may use (WP-BRIEFS / C1 / C8 names)
  var ALIAS = { lock: 'lockOn', unlock: 'lockOff', uiHover: 'uiMove', uiSelect: 'select', uiBack: 'cancel', itemGet: 'fanfare', landSoft: 'land' };
  for (var ak in ALIAS) if (!SFX[ak]) SFX[ak] = SFX[ALIAS[ak]];

  // [max simultaneous voices, min gap seconds]
  var LIM = {
    coin: [3, 0.04], step: [2, 0.09], talk: [2, 0.035], hit: [4, 0.03], swing: [3, 0.06],
    menu: [2, 0.04], bubble: [4, 0.05], shoot: [4, 0.05], bush: [3, 0.05], pot: [3, 0.06],
    snow: [3, 0.05], enemyDie: [4, 0.05], heart: [2, 0.1], splash: [2, 0.1], error: [2, 0.12],
    select: [2, 0.05], cancel: [2, 0.05], dash: [2, 0.08], stomp: [2, 0.1], hurt: [2, 0.1],
    step_grass: [2, 0.07], step_dirt: [2, 0.07], step_sand: [2, 0.07], step_snow: [2, 0.07], step_wood: [2, 0.07], step_stone: [2, 0.07], step_wade: [2, 0.07],
    swingA: [2, 0.05], swingB: [2, 0.05], swingC: [2, 0.05], clink: [2, 0.05], squish: [3, 0.04], pop: [4, 0.03], tink: [3, 0.05],
    alert: [3, 0.08], announce: [2, 0.12], heartbeat: [1, 0.3], uiMove: [2, 0.03], uiTick: [2, 0.02], uiSlider: [2, 0.03],
    ambBird: [3, 0.2], ambCricket: [4, 0.05], ambGull: [2, 0.5], ambOwl: [1, 1], ambChime: [1, 2], ambTinkle: [2, 0.4], rumble: [3, 0.1], whistle: [3, 0.05]
  };
  var DEF_LIM = [6, 0.02];
  var LOW_PRI = { step: 1, talk: 1, swing: 1, menu: 1, bubble: 1, snow: 1, bush: 1, tink: 1, ambBird: 1, ambCricket: 1, ambGull: 1, ambTinkle: 1, ambChime: 1, ambOwl: 1,
    step_grass: 1, step_dirt: 1, step_sand: 1, step_snow: 1, step_wood: 1, step_stone: 1, step_wade: 1 };

  /** one sound now. o.x/z → positional chain (cut below CFG.minGain); o.vol / o.pan / o.rate / o.dur / o.bus */
  function play(name, o) {
    try {
      if (!ctx || (muted && !offline)) return false;
      var def = SFX[name];
      if (typeof def !== 'function') return false;
      if (!offline && ctx.state !== 'running') { tryResume(); return false; }
      var now = ctx.currentTime, lm = LIM[name] || DEF_LIM, i;
      var arr = live[name] || (live[name] = []);
      for (i = arr.length - 1; i >= 0; i--) if (arr[i] <= now) arr.splice(i, 1);
      for (i = liveAll.length - 1; i >= 0; i--) if (liveAll[i] <= now) liveAll.splice(i, 1);
      if (arr.length >= lm[0]) return false;
      if (now - (lastT[name] == null ? -9 : lastT[name]) < lm[1]) return false;
      if (liveAll.length >= 24 && LOW_PRI[name]) return false;
      if (liveAll.length >= 40) return false;
      o = o && typeof o === 'object' ? o : null;
      var P = null, vol = o && fin(o.vol) ? Math.max(0, o.vol) : 1;
      if (o && fin(o.x) && fin(o.z)) { P = place(o.x, o.y, o.z); if (P.gain * vol < CFG.minGain) return false; }
      var bus = o && o.bus === 'amb' ? ambBus : sfxBus, ch = null;
      if (P) ch = chain(ctx, { pan: P.pan, gain: P.gain * vol, lp: P.lp }, bus);
      else if (vol !== 1 || (o && fin(o.pan)) || bus !== sfxBus) ch = chain(ctx, { pan: o && fin(o.pan) ? o.pan : 0, gain: vol, lp: 20000 }, bus);
      lastT[name] = now;
      var t = o && fin(o.at) && o.at > now + 0.005 && o.at < now + 1 ? +o.at : now + 0.005, len;
      outNode = ch ? ch.input : null; curRate = o && o.rate > 0 ? +o.rate : 1; curRev = ch ? ch.out.gain.value : 1; curOpts = o || EMPTY;
      try { len = def(t, curOpts) || 0.3; } finally { outNode = null; curRate = 1; curRev = 1; curOpts = EMPTY; }
      arr.push(t + len);
      liveAll.push(t + len);
      if (ch && !offline) setTimeout(function () { unchain(ch); }, (t - now + len + 0.8) * 1000);
      return true;
    } catch (e) { return false; }
  }

  /* -------------------------------------------- event claims (js/audio-bus.js) */
  // A gameplay event that drives a sound claims the old direct-call names for that frame: sfx('swing') next to
  // EV.SWING is dropped, so a package that still calls the old name never doubles the event-driven sound. Names some
  // event may claim later in the same task wait for the end of the task (a microtask) before they play.
  var claims = {}, deferSet = {}, pending = [], flushQ = false;
  function stamp() { var c = root.G && root.G.clock; return c && typeof c.frames === 'number' ? c.frames : Math.floor(Date.now() / 16.7); }
  function claim(names) { var s = stamp(); for (var i = 0; i < names.length; i++) claims[names[i]] = s; }
  function claimedAt(n, s) { var c = claims[n]; return c != null && Math.abs(s - c) <= 1; }
  function defer(names) { for (var i = 0; i < names.length; i++) deferSet[names[i]] = 1; }
  var qm = typeof root.queueMicrotask === 'function' ? function (f) { root.queueMicrotask(f); } : function (f) { Promise.resolve().then(f); };
  function flush() {
    flushQ = false;
    var p = pending; pending = [];
    for (var i = 0; i < p.length; i++) if (!claimedAt(p[i][0], p[i][2])) play(p[i][0], p[i][1]);
  }
  function sfx(name, o) {
    try {
      if (!ctx || muted) return false;
      var s = stamp();
      if (claimedAt(name, s)) return false;
      if (deferSet[name]) { pending.push([name, o, s]); if (!flushQ) { flushQ = true; qm(flush); } return true; }
      return play(name, o);
    } catch (e) { return false; }
  }

  /* --------------------------------------------------------------- emitters */
  /** a long / moving positional sound: set(x, y, z) every frame moves it (pan, gain, low-pass eased) */
  function emitter(name, o) {
    var h = { alive: false, set: noop, stop: noop };
    try {
      o = o || {};
      if (!ctx || muted || ctx.state !== 'running' || !lis.set) return h;
      var def = SFX[name];
      if (typeof def !== 'function') return h;
      while (emitters.length >= 6) emitters[0].stop();
      var vol = fin(o.vol) ? o.vol : 1, P = place(fin(o.x) ? o.x : lis.x, o.y, fin(o.z) ? o.z : lis.z);
      var ch = chain(ctx, { pan: P.pan, gain: P.gain * vol, lp: P.lp });
      var len;
      outNode = ch.input; curOpts = o;
      try { len = def(ctx.currentTime + 0.005, o) || 1; } finally { outNode = null; curOpts = EMPTY; }
      h.alive = true;
      h.set = function (x, y, z) {
        if (!h.alive || !fin(x) || !fin(z)) return;
        try { var Q = place(x, y, z), t = ctx.currentTime; ch.out.gain.setTargetAtTime(Q.gain * vol, t, 0.04); if (ch.pan) ch.pan.pan.setTargetAtTime(clamp(Q.pan, -1, 1), t, 0.04); ch.lp.frequency.setTargetAtTime(clamp(Q.lp, 60, 20000), t, 0.05); } catch (e) { /* ignore */ }
      };
      h.stop = function () {
        if (!h.alive) return;
        h.alive = false;
        var i = emitters.indexOf(h); if (i >= 0) emitters.splice(i, 1);
        try { ch.out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
        setTimeout(function () { unchain(ch); }, 500);
      };
      setTimeout(function () { h.stop(); }, (len + 0.2) * 1000);
      emitters.push(h);
      return h;
    } catch (e) { return h; }
  }

  /* --------------------------------------------------------------- ambience */
  // region beds: a filtered-noise wind (slow gusts), waves on the shore, and soft one-shots scheduled by tick()
  // (birds by day, crickets / an owl at night, chimes, gulls, ice tinkles), all on the ambience bus (ambVol)
  var BEDS = {
    village: { wind: [520, 0.6, 0.05, 0.035], ev: [['ambBird', 0.3, 0], ['ambCricket', 0.6, 1], ['ambChime', 0.04, -1]] },
    woods: { wind: [900, 0.8, 0.065, 0.045], ev: [['ambBird', 0.22, 0], ['ambOwl', 0.06, 1], ['ambCricket', 0.35, 1]] },
    peaks: { wind: [650, 1.2, 0.1, 0.07], ev: [['ambTinkle', 0.12, -1]] },
    shores: { wind: [420, 0.6, 0.03, 0.02], waves: [520, 0.1], ev: [['ambGull', 0.1, 0], ['ambCricket', 0.2, 1]] },
    meadow: { wind: [700, 0.7, 0.045, 0.03], ev: [['ambBird', 0.4, 0], ['ambCricket', 0.7, 1]] }
  };
  function startBed(id) {
    var B = BEDS[id];
    if (!B) return null;
    var t = ctx.currentTime, out = ctx.createGain(), nodes = [out];
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(1, t + 2.0);
    out.connect(ambBus);
    function lfo(hz, depth, param, phase) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(t + (phase || 0)); nodes.push(o, g);
    }
    function noise(type, f, q, gain) {
      var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = gain;
      s.connect(fl); fl.connect(g); g.connect(out); s.start(t, rnd() * 1.5); nodes.push(s, fl, g);
      return { f: fl, g: g };
    }
    if (B.wind) { var w = noise('bandpass', B.wind[0], B.wind[1], B.wind[2]); lfo(0.07 + rnd() * 0.04, B.wind[3], w.g.gain); lfo(0.043, B.wind[0] * 0.3, w.f.frequency, 1.3); }
    if (B.waves) { var v = noise('lowpass', B.waves[0], 0.5, B.waves[1]); lfo(0.11, B.waves[1] * 0.9, v.g.gain); lfo(0.11, 260, v.f.frequency, 0.4); }
    return { id: id, out: out, nodes: nodes, ev: B.ev || [] };
  }
  function stopBed(b) {
    if (!b) return;
    try { var t = ctx.currentTime; b.out.gain.cancelScheduledValues(t); b.out.gain.setValueAtTime(b.out.gain.value, t); b.out.gain.linearRampToValueAtTime(0.0001, t + 2.0); } catch (e) { /* ignore */ }
    setTimeout(function () { for (var i = 0; i < b.nodes.length; i++) { try { if (b.nodes[i].stop) b.nodes[i].stop(); } catch (e) { /* ignore */ } try { b.nodes[i].disconnect(); } catch (e) { /* ignore */ } } }, 2600);
  }
  function ambience(id, o) {
    try {
      if (o && fin(o.night)) night = clamp01(o.night);
      if (id === undefined) return bedId;
      if (id === bedId) return bedId;
      bedId = id || null;
      if (!ctx) return bedId;
      stopBed(bed); bed = null;
      if (bedId) bed = startBed(bedId);
      return bedId;
    } catch (e) { return null; }
  }
  function tickAmb(dt) {
    if (!bed || muted || ctx.state !== 'running') return;
    for (var i = 0; i < bed.ev.length; i++) {
      var e = bed.ev[i], when = e[2];
      if ((when === 0 && night > 0.5) || (when === 1 && night <= 0.5)) continue;
      if (rnd() < e[1] * dt) play(e[0], { bus: 'amb', pan: (rnd() * 2 - 1) * 0.8, vol: 0.5 + rnd() * 0.5 });
    }
  }
  // The low-health beat runs on the HUD's wall clock (ui.beatPhase(): performance.now() / TUNE.hud.beat), so each
  // "bum-bum" lands on the pulse of the hearts and the red vignette whatever the urgency: beat n starts at
  // (n + hbLead) · hbPer s of performance time (just before the pulse peaks, where ui.js put its own beat), mapped onto
  // the audio clock and scheduled up to LOOKAHEAD ahead. k only sets how loud it is.
  function perfSec() { var p = root.performance; return p && p.now ? p.now() / 1000 : Date.now() / 1000; }
  function tickHeart() {
    if (hbK <= 0 || muted || ctx.state !== 'running') return;
    var now = ctx.currentTime, off = now - perfSec(), n = Math.ceil((now - off) / hbPer - hbLead);
    if (hbN != null && n <= hbN) n = hbN + 1;
    var at = (n + hbLead) * hbPer + off;
    if (at - now > LOOKAHEAD) return;
    hbN = n;
    if (play('heartbeat', { vol: 0.55 + 0.45 * hbK, at: at })) { hbLog.push({ n: n, perf: +(at - off).toFixed(4), at: +at.toFixed(4), ahead: +(at - now).toFixed(4) }); if (hbLog.length > 6) hbLog.shift(); }
  }
  function heartbeat(k, o) {
    k = clamp01(k);
    if (o && typeof o === 'object') { if (fin(o.period) && o.period >= 0.3 && o.period <= 3) hbPer = +o.period; if (fin(o.lead) && o.lead >= 0 && o.lead < 1) hbLead = +o.lead; }
    if (k > 0 && hbK <= 0) { hbN = null; hbLog.length = 0; }
    hbK = k; return hbK;
  }
  function duck(k) {
    duckK = clamp(fin(k) ? k : 1, 0, 1);
    try { if (ctx) duckG.gain.setTargetAtTime(duckK, ctx.currentTime, 0.25); } catch (e) { /* ignore */ }
    return duckK;
  }
  function listener(x, y, z, yaw) {
    if (!fin(x) || !fin(z)) return;
    lis.x = x; lis.y = fin(y) ? y : lis.y; lis.z = z; if (fin(yaw)) lis.yaw = yaw; lis.set = true;
  }
  function config(o) { if (o) for (var k in CFG) if (fin(o[k])) CFG[k] = o[k]; return CFG; }
  function setVolumes(o) {
    if (!o) return volK;
    if (fin(o.music)) volK.music = clamp01(o.music);
    if (fin(o.sfx)) volK.sfx = clamp01(o.sfx);
    if (fin(o.amb)) volK.amb = clamp01(o.amb);
    try {
      if (ctx) {
        var t = ctx.currentTime;
        musicBus.gain.setTargetAtTime(musicVol * volK.music, t, 0.05);
        sfxBus.gain.setTargetAtTime(sfxVol * volK.sfx, t, 0.05);
        ambBus.gain.setTargetAtTime(AMB_VOL * volK.amb, t, 0.05);
      }
    } catch (e) { /* ignore */ }
    return volK;
  }

  /* --------------------------------------------- offline render (tests: levels) */
  function analyze(buf) {
    var L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    var peak = 0, sl = 0, sr = 0, hp = 0, prev = 0, eHi = 0, eAll = 0, n = L.length;
    var a = Math.exp(-2 * Math.PI * 3000 / buf.sampleRate);   // one-pole high-pass at 3 kHz
    for (var i = 0; i < n; i++) {
      var l = L[i], r = R[i], m = (l + r) * 0.5;
      var al = l < 0 ? -l : l, ar = r < 0 ? -r : r;
      if (al > peak) peak = al; if (ar > peak) peak = ar;
      sl += l * l; sr += r * r;
      hp = a * (hp + m - prev); prev = m;
      eHi += hp * hp; eAll += m * m;
    }
    var f6 = function (v) { return +v.toFixed(6); };
    return { peak: f6(peak), peakDb: +(20 * Math.log10(Math.max(1e-9, peak))).toFixed(2), rmsL: f6(Math.sqrt(sl / n)), rmsR: f6(Math.sqrt(sr / n)), hf: eAll > 0 ? f6(eHi / eAll) : 0, sec: +(n / buf.sampleRate).toFixed(3) };
  }
  /** render sounds into an OfflineAudioContext through the real bus graph (compressor + limiter): what = name or
   *  [[name, o], …] played together; R = { sec = 1.5, sr = 44100, listener: { x, y, z, yaw } } */
  function render(what, o, R) {
    R = R || {};
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return Promise.resolve(null);
    var saved = graphNow(), sLis = lis, sLive = live, sLast = lastT, sAll = liveAll, sOff = offline, sCfg = {}, k;
    for (k in CFG) sCfg[k] = CFG[k];
    var oc, ok = 0;
    try {
      oc = new OAC(2, Math.ceil((R.sr || 44100) * (R.sec || 1.5)), R.sr || 44100);
      useGraph(oc, makeGraph(oc, false));
      offline = true; live = {}; lastT = {}; liveAll = [];
      if (R.listener) lis = { x: R.listener.x || 0, y: R.listener.y || 0, z: R.listener.z || 0, yaw: R.listener.yaw || 0, set: true };
      if (R.bed) startBed(R.bed);                      // an ambience bed's noise layers (tests: its level)
      var list = typeof what === 'string' ? [[what, o]] : (what || []);
      for (var i = 0; i < list.length; i++) if (play(list[i][0], list[i][1] || null)) ok++;
    } catch (e) { ok = -1; } finally {
      useGraph(saved.ctx, saved.g); lis = sLis; live = sLive; lastT = sLast; liveAll = sAll; offline = sOff;
      for (k in sCfg) CFG[k] = sCfg[k];
    }
    if (!oc || ok < 0) return Promise.resolve(null);
    return oc.startRendering().then(function (buf) { var r = analyze(buf); r.played = ok; return r; }, function () { return null; });
  }

  /* ---------------------------------------------------------- music: voices */
  var V = {
    pluck: function (D, t, f, dur, v) {
      var L = Math.min(0.55, Math.max(0.16, dur * 0.9 + 0.1));
      T({ dest: D, t: t, f: f, type: 'triangle', d: L, v: 0.3 * v, a: 0.004, lp: 3600, lp1: 1100 });
      T({ dest: D, t: t, f: f * 2, d: L * 0.5, v: 0.08 * v, a: 0.003 });
    },
    uke: function (D, t, f, dur, v) {
      T({ dest: D, t: t, f: f, type: 'triangle', d: 0.4, v: 0.3 * v, a: 0.003, lp: 3200, lp1: 800 });
      T({ dest: D, t: t, f: f * 2.003, d: 0.18, v: 0.06 * v, a: 0.002 });
      N({ dest: D, t: t, d: 0.02, v: 0.03 * v, type: 'highpass', f: 3000 });
    },
    flute: function (D, t, f, dur, v) {
      var d = dur + 0.12, h = Math.max(0.08, dur);
      T({ dest: D, t: t, f: f, d: d, h: h, a: 0.06, v: 0.26 * v, vib: [5.3, f * 0.0045] });
      T({ dest: D, t: t, f: f * 2, d: d, h: h, a: 0.08, v: 0.035 * v });
      N({ dest: D, t: t, d: 0.14, v: 0.03 * v, a: 0.03, type: 'bandpass', f: f * 2, q: 4 });
    },
    bell: function (D, t, f, dur, v) {
      bell(t, f, Math.min(2.6, 0.8 + dur * 0.5), v, D, 0);
    },
    glock: function (D, t, f, dur, v) {
      T({ dest: D, t: t, f: f, d: 0.55, v: 0.16 * v, a: 0.003 });
      T({ dest: D, t: t, f: f * 4, d: 0.2, v: 0.05 * v, a: 0.002 });
    },
    harp: function (D, t, f, dur, v) {
      T({ dest: D, t: t, f: f, type: 'triangle', d: 0.75, v: 0.2 * v, a: 0.003, lp: 3000, lp1: 900 });
      T({ dest: D, t: t, f: f * 2, d: 0.3, v: 0.04 * v, a: 0.003 });
    },
    pad: function (D, t, f, dur, v) {
      var d = dur + 0.9, h = dur;
      T({ dest: D, t: t, f: f, type: 'sawtooth', detune: -7, d: d, h: h, a: 0.55, v: 0.04 * v, lp: 650 });
      T({ dest: D, t: t, f: f, type: 'sawtooth', detune: 7, d: d, h: h, a: 0.55, v: 0.04 * v, lp: 650 });
      T({ dest: D, t: t, f: f, type: 'triangle', d: d, h: h, a: 0.5, v: 0.05 * v });
    },
    bassSoft: function (D, t, f, dur, v) {
      var d = Math.max(0.3, dur * 0.95);
      T({ dest: D, t: t, f: f, d: d, v: 0.42 * v, a: 0.008 });
      T({ dest: D, t: t, f: f * 2, type: 'triangle', d: d * 0.5, v: 0.06 * v, lp: 800 });
    },
    bassSaw: function (D, t, f, dur, v) {
      var d = Math.max(0.14, dur * 0.9);
      T({ dest: D, t: t, f: f, type: 'sawtooth', d: d, v: 0.2 * v, a: 0.004, lp: 1400, lp1: 260, q: 3 });
      T({ dest: D, t: t, f: f, d: d, v: 0.32 * v, a: 0.004 });
    },
    square: function (D, t, f, dur, v) {
      var d = dur + 0.05, h = dur * 0.9;
      T({ dest: D, t: t, f: f, type: 'square', d: d, h: h, a: 0.01, v: 0.14 * v, lp: 2600, q: 0.7 });
      T({ dest: D, t: t, f: f, type: 'square', detune: 7, d: d, h: h, a: 0.01, v: 0.1 * v, lp: 2600, q: 0.7 });
    },
    stab: function (D, t, f, dur, v) {
      T({ dest: D, t: t, f: f, type: 'triangle', d: 0.16, v: 0.13 * v, a: 0.003, lp: 2600 });
    },
    strum: function (D, t, f, dur, v) {
      T({ dest: D, t: t, f: f, type: 'triangle', d: 0.38, v: 0.13 * v, a: 0.003, lp: 2800, lp1: 900 });
      T({ dest: D, t: t, f: f * 2, d: 0.15, v: 0.025 * v, a: 0.003 });
    }
  };

  var PERC = {
    k: function (D, t, v) {
      T({ dest: D, t: t, f: 150, f1: 48, d: 0.17, v: 0.6 * v, a: 0.002 });
      N({ dest: D, t: t, d: 0.03, v: 0.1 * v, type: 'lowpass', f: 300 });
    },
    s: function (D, t, v) {
      N({ dest: D, t: t, d: 0.13, v: 0.3 * v, type: 'bandpass', f: 1900, q: 0.7 });
      T({ dest: D, t: t, f: 200, f1: 130, d: 0.09, v: 0.2 * v, type: 'triangle', a: 0.002 });
    },
    h: function (D, t, v) { N({ dest: D, t: t, d: 0.035, v: 0.13 * v, type: 'highpass', f: 7500 }); },
    x: function (D, t, v) { N({ dest: D, t: t, d: 0.075, v: 0.1 * v, a: 0.015, type: 'bandpass', f: 5500, q: 1.2 }); },
    t: function (D, t, v) {
      T({ dest: D, t: t, f: 1250, f1: 1000, d: 0.045, v: 0.18 * v, a: 0.002 });
      N({ dest: D, t: t, d: 0.015, v: 0.05 * v, type: 'highpass', f: 3000 });
    }
  };

  /* ---------------------------------------------------- music: compositions */
  // Melody: one string per bar, tokens "Note[:steps]" (default 1 step) or "-[:steps]" for a rest.
  // Bass pattern: r root, t third, f fifth, o octave, . rest.
  // Comp pattern: 1..5 chord-tone index (1 root,2 third,3 fifth,4 octave/7th,5 ...), c = whole chord, . rest.
  // Perc pattern: k kick, s snare, h hat, x shaker, t tick, . rest.  Patterns tile across the bar.
  var TRACKS = {
    title: {
      bpm: 72, bpb: 4, sp: 8, swing: 0, rev: 0.34,
      delay: { beats: 0.75, fb: 0.35, mix: 0.25 },
      chords: 'A F#m D E A C#m D E F#m D A E D E A E',
      melody: [
        'E5:2 A5:2 C#6:3 B5:1', 'A5:2 F#5:2 A5:4', 'F#5:2 A5:2 D6:3 C#6:1', 'B5:4 G#5:2 B5:2',
        'C#6:2 E6:2 A6:3 G#6:1', 'E6:2 C#6:2 E6:4', 'D6:2 F#6:2 E6:2 D6:2', 'B5:4 G#5:2 E5:2',
        'F#5:2 A5:2 C#6:2 A5:2', 'D6:3 C#6:1 A5:4', 'A5:2 C#6:2 E6:2 C#6:2', 'B5:2 G#5:2 B5:2 E6:2',
        'F#6:3 E6:1 D6:4', 'G#6:2 E6:2 B5:4', 'C#6:3 E6:1 A6:4', 'G#6:2 F#6:2 E6:4'
      ],
      lead: 'bell', leadVol: 0.95,
      bass: { pat: 'r . . . f . . .', voice: 'bassSoft', vol: 0.8 },
      comp: { pat: '1 2 3 4 3 2 3 2', voice: 'harp', vol: 0.45, oct: 1 },
      pad: { voice: 'pad', vol: 0.55 },
      sparkle: true
    },
    village: {
      bpm: 112, bpb: 4, sp: 8, swing: 0, rev: 0.18,
      chords: 'C G Am F C G F G Am Em F C F C Dm G',
      melody: [
        'E5:1 G5:1 C6:2 G5:1 E5:1 G5:2', 'D5:1 G5:1 B5:2 G5:1 D5:1 G5:2',
        'C5:1 E5:1 A5:2 E5:1 C5:1 E5:2', 'F5:2 A5:2 G5:1 F5:1 E5:2',
        'E5:1 G5:1 C6:2 E6:2 D6:1 C6:1', 'B5:2 D6:2 G5:2 B5:2',
        'A5:2 C6:2 F6:2 E6:1 D6:1', 'D6:2 B5:2 G5:2 -:2',
        'A5:2 C6:1 E6:1 D6:2 C6:2', 'B5:2 G5:1 B5:1 E6:4',
        'C6:2 A5:1 C6:1 F6:2 E6:1 D6:1', 'E6:2 C6:2 G5:2 E5:2',
        'F5:1 A5:1 C6:2 A5:2 F5:2', 'E5:1 G5:1 C6:2 G5:2 E5:2',
        'D5:1 F5:1 A5:2 D6:2 C6:1 B5:1', 'D6:2 B5:1 A5:1 G5:2 -:2'
      ],
      lead: 'pluck', leadVol: 1,
      bass: { pat: 'r . f . r . f .', voice: 'bassSoft', vol: 0.9 },
      comp: { pat: '. c . c . c . c', voice: 'stab', vol: 0.8, oct: 1 },
      perc: [{ pat: 'k . x . t . x .', vol: 0.5 }],
      sparkle: true
    },
    meadow: {
      bpm: 88, bpb: 3, sp: 6, swing: 0, rev: 0.36,
      chords: 'G Em C D G Bm C D Em C G Em C Am D D',
      melody: [
        'B5:3 A5:1 G5:2', 'G5:2 E5:2 G5:2', 'E6:3 D6:1 C6:2', 'B5:2 A5:2 F#5:2',
        'G5:2 B5:2 D6:2', 'D6:2 B5:2 F#5:2', 'E6:2 D6:2 C6:2', 'A5:3 F#5:1 A5:2',
        'E6:3 D6:1 B5:2', 'C6:2 E6:2 G6:2', 'G6:3 F#6:1 E6:2', 'D6:2 B5:2 G5:2',
        'C6:3 B5:1 A5:2', 'A5:2 C6:2 E6:2', 'D6:3 C6:1 A5:2', 'A5:2 F#5:2 A5:2'
      ],
      lead: 'flute', leadVol: 1,
      bass: { pat: 'r . . . . .', voice: 'bassSoft', vol: 0.85 },
      comp: { pat: '2 3 4 5 4 3', voice: 'harp', vol: 0.5, oct: 1 },
      pad: { voice: 'pad', vol: 0.6 },
      sparkle: true
    },
    woods: {
      bpm: 76, bpb: 4, sp: 8, swing: 0, rev: 0.42,
      delay: { beats: 0.75, fb: 0.45, mix: 0.4 },
      chords: 'Dm Bb Gm A Dm F Gm A Bb F Gm Dm Bb C A A',
      melody: [
        'D5:3 F5:1 A5:4', 'G5:2 F5:2 D5:4', 'G5:3 Bb5:1 D6:4', 'C#6:2 A5:2 E5:2 -:2',
        'D5:2 F5:2 A5:2 D6:2', 'C6:3 A5:1 F5:4', 'Bb5:2 A5:2 G5:2 F5:2', 'E5:4 C#5:2 -:2',
        'D6:3 C6:1 Bb5:4', 'A5:2 C6:2 F6:4', 'G6:3 F6:1 D6:4', 'A5:2 F5:2 D5:4',
        'F5:2 Bb5:2 D6:2 F6:2', 'E6:3 D6:1 C6:4', 'A5:2 C#6:2 E6:4', 'D6:2 C#6:2 A5:4'
      ],
      lead: 'bell', leadVol: 0.9,
      bass: { pat: 'r . . . . . f .', voice: 'bassSoft', vol: 0.8 },
      comp: { pat: '1 . . 3 . . 2 .', voice: 'harp', vol: 0.35, oct: 1 },
      pad: { voice: 'pad', vol: 1 },
      sparkle: true
    },
    peaks: {
      bpm: 66, bpb: 4, sp: 8, swing: 0, rev: 0.5,
      delay: { beats: 1.5, fb: 0.35, mix: 0.3 },
      chords: 'Dmaj7 Bm7 Gmaj7 A Dmaj7 F#m7 Gmaj7 A Bm7 Gmaj7 Dmaj7 A Gmaj7 A Bm7 A',
      melody: [
        'F#5:2 A5:2 D6:2 C#6:2', 'B5:3 A5:1 F#5:4', 'G5:2 B5:2 D6:2 F#6:2', 'E6:3 C#6:1 A5:4',
        'A5:2 D6:2 F#6:2 A6:2', 'A6:3 F#6:1 C#6:4', 'B5:2 D6:2 G6:2 F#6:2', 'E6:4 C#6:2 -:2',
        'D6:3 B5:1 F#5:4', 'G5:2 A5:2 B5:2 D6:2', 'F#6:3 E6:1 D6:4', 'C#6:2 E6:2 A6:4',
        'B6:3 A6:1 F#6:4', 'E6:2 C#6:2 A5:2 C#6:2', 'D6:2 F#6:2 B6:2 A6:2', 'E6:3 C#6:1 A5:4'
      ],
      lead: 'bell', leadVol: 1,
      bass: { pat: 'r . . . . . . .', voice: 'bassSoft', vol: 0.7 },
      comp: { pat: '1 . 3 . 2 . 4 .', voice: 'glock', vol: 0.4, oct: 1 },
      pad: { voice: 'pad', vol: 0.55 },
      sparkle: false
    },
    shores: {
      bpm: 104, bpb: 4, sp: 8, swing: 0.28, rev: 0.22,
      chords: 'F Dm Bb C F Am Bb C Dm Bb F C Bb C F C',
      melody: [
        'A5:1 C6:1 A5:1 F5:1 G5:2 A5:2', 'A5:1 D6:1 A5:1 F5:1 A5:2 -:2',
        'D6:1 F6:1 D6:1 Bb5:1 C6:2 D6:2', 'E6:1 D6:1 C6:1 G5:1 C6:4',
        'A5:1 C6:1 F6:2 E6:1 C6:1 A5:2', 'E6:1 C6:1 A5:1 C6:1 E6:2 -:2',
        'D6:1 F6:1 Bb6:2 A6:1 F6:1 D6:2', 'G5:1 C6:1 E6:2 D6:2 C6:2',
        'D6:2 F6:1 A6:1 F6:2 D6:2', 'D6:1 Bb5:1 D6:1 F6:1 D6:2 Bb5:2',
        'C6:1 F6:1 A6:2 G6:1 F6:1 C6:2', 'G6:1 E6:1 C6:1 E6:1 G6:4',
        'F6:2 D6:1 Bb5:1 D6:2 F6:2', 'E6:1 G6:1 E6:1 C6:1 D6:2 E6:2',
        'F6:2 A5:1 C6:1 F6:4', 'E6:1 D6:1 C6:1 B5:1 C6:2 -:2'
      ],
      lead: 'uke', leadVol: 1,
      bass: { pat: 'r . . f r . f .', voice: 'bassSoft', vol: 0.85 },
      comp: { pat: 'c . c . . c . c', voice: 'strum', vol: 0.65, oct: 1, strum: 0.014 },
      perc: [{ pat: 'k . . . k . . .', vol: 0.45 }, { pat: 'x x x x x x x x', vol: 0.4 }],
      sparkle: true
    },
    boss: {
      bpm: 150, bpb: 4, sp: 16, swing: 0, rev: 0.14,
      chords: 'Am Am F G Am Am F E Dm Dm Am E F G Am E',
      melody: [
        'A5:2 -:1 A5:1 C6:2 -:1 E6:1 D6:2 C6:2 B5:2 A5:2',
        'A5:2 -:1 A5:1 C6:2 E6:2 A6:4 G6:2 E6:2',
        'F6:2 -:1 F6:1 E6:2 C6:2 A5:4 C6:2 A5:2',
        'G5:2 B5:2 D6:2 G6:2 F6:2 D6:2 B5:4',
        'A5:2 -:1 A5:1 C6:2 -:1 E6:1 D6:2 C6:2 B5:2 A5:2',
        'E6:2 -:1 E6:1 A6:2 -:1 A6:1 G6:2 E6:2 D6:2 C6:2',
        'F6:2 A6:2 G6:2 F6:2 E6:2 C6:2 A5:4',
        'G#5:2 B5:2 E6:2 G#6:2 E6:2 B5:2 G#5:2 -:2',
        'D6:2 -:1 D6:1 F6:2 A6:2 F6:2 D6:2 A5:4',
        'D6:2 F6:2 A6:4 G6:2 F6:2 E6:2 D6:2',
        'C6:2 E6:2 A6:2 E6:2 C6:2 E6:2 A5:4',
        'B5:2 G#5:2 B5:2 E6:2 D6:2 B5:2 G#5:4',
        'A5:2 C6:2 F6:2 C6:2 A5:2 C6:2 F5:4',
        'B5:2 D6:2 G6:2 D6:2 B5:2 D6:2 G5:4',
        'A5:2 C6:2 E6:2 A6:2 G6:2 E6:2 C6:2 E6:2',
        'E6:2 D6:2 B5:2 G#5:2 B5:4 G#5:4'
      ],
      lead: 'square', leadVol: 0.85,
      bass: { pat: 'r . r r . r . r r . r . f . o .', voice: 'bassSaw', vol: 1 },
      comp: { pat: '. . c . . . c . . . c . . . c .', voice: 'stab', vol: 0.75, oct: 1 },
      perc: [{ pat: 'k . . . s . . k . . k . s . . .', vol: 0.85 }, { pat: 'h . h . h . h . h . h . h . h h', vol: 0.7 }],
      sparkle: false
    },
    ending: {
      bpm: 92, bpb: 4, sp: 8, swing: 0, rev: 0.4,
      delay: { beats: 0.75, fb: 0.3, mix: 0.22 },
      chords: 'Eb Bb Cm Ab Eb Bb Ab Bb Cm Ab Eb Bb Ab Bb Eb Eb',
      melody: [
        'Bb5:2 Eb6:2 G6:3 F6:1', 'D6:2 F6:2 Bb6:4', 'G6:2 Eb6:2 C6:2 Eb6:2', 'Eb6:3 C6:1 Ab5:4',
        'G5:2 Bb5:2 Eb6:2 G6:2', 'F6:3 D6:1 Bb5:4', 'C6:2 Eb6:2 Ab6:2 G6:2', 'F6:4 D6:2 F6:2',
        'Eb6:2 G6:2 Bb6:2 G6:2', 'Ab6:3 G6:1 Eb6:4', 'Bb6:2 G6:2 Eb6:4', 'D6:2 F6:2 Bb6:4',
        'C6:2 Eb6:2 Ab6:4', 'F6:2 D6:2 Bb5:2 D6:2', 'Eb6:2 G6:2 Bb6:3 G6:1', 'Eb6:6 -:2'
      ],
      lead: 'flute', leadVol: 0.95, lead2: 'bell', lead2Vol: 0.5,
      bass: { pat: 'r . f . r . f .', voice: 'bassSoft', vol: 0.85 },
      comp: { pat: '1 2 3 4 5 4 3 2', voice: 'harp', vol: 0.42, oct: 1 },
      pad: { voice: 'pad', vol: 0.85 },
      perc: [{ pat: 'k . . . k . . .', vol: 0.35 }, { pat: '. . x . . . x .', vol: 0.3 }],
      sparkle: true
    }
  };

  /* ---------------------------------------------------- music: compilation */
  var CHORD_Q = {
    '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
    'dim': [0, 3, 6], 'sus': [0, 5, 7]
  };
  var PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function parseNote(tok) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return null;
    return (parseInt(m[3], 10) + 1) * 12 + PCS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function parseChord(s) {
    var m = /^([A-G][#b]?)(.*)$/.exec(s);
    var n = m && parseNote(m[1] + '4');
    if (n == null) return { pc: 0, iv: CHORD_Q[''] };
    return { pc: n % 12, iv: CHORD_Q[m[2]] || CHORD_Q[''] };
  }
  function chordTone(ch, i, rootMidi) {          // i is 1-based
    var n = ch.iv.length, k = i - 1;
    return rootMidi + ch.iv[k % n] + 12 * Math.floor(k / n);
  }
  function splitDur(tok) {
    var i = tok.indexOf(':');
    return i < 0 ? [tok, 1] : [tok.slice(0, i), parseInt(tok.slice(i + 1), 10) || 1];
  }
  function tiled(pat, sp) {
    var a = pat.split(/\s+/), out = [];
    for (var i = 0; i < sp; i++) out.push(a[i % a.length]);
    return out;
  }
  function runLen(a, i) {                         // steps until the next onset
    var j = i + 1;
    while (j < a.length && a[j] === '.') j++;
    return j - i;
  }

  function compile(cfg) {
    var sp = cfg.sp, bars = cfg.melody.length, total = sp * bars, ev = [], i, b;
    for (i = 0; i < total; i++) ev.push([]);
    var chords = cfg.chords.split(/\s+/).map(parseChord);
    for (b = 0; b < bars; b++) {
      var ch = chords[b % chords.length], s0 = b * sp, s = s0, end = s0 + sp;
      // melody
      var toks = cfg.melody[b].split(/\s+/);
      for (i = 0; i < toks.length && s < end; i++) {
        var sd = splitDur(toks[i]), d = Math.min(sd[1], end - s);
        if (sd[0] !== '-') {
          var m = parseNote(sd[0]);
          if (m != null) {
            ev[s].push({ k: 'L', m: m, d: d });
            if (cfg.lead2) ev[s].push({ k: 'L2', m: m, d: d });
            if (cfg.sparkle !== false && m + 12 < 104) ev[s].push({ k: 'S', m: m + 12, d: d });
          }
        }
        s += sd[1];
      }
      // bass
      if (cfg.bass) {
        var bp = tiled(cfg.bass.pat, sp), broot = 40 + ((ch.pc + 8) % 12);
        for (i = 0; i < sp; i++) {
          var bt = bp[i];
          if (bt === '.') continue;
          var off = bt === 'r' ? 0 : bt === 't' ? ch.iv[1] : bt === 'f' ? (ch.iv[2] == null ? 7 : ch.iv[2]) : bt === 'o' ? 12 : 0;
          ev[s0 + i].push({ k: 'B', m: broot + off, d: runLen(bp, i) });
        }
      }
      // accompaniment (arp notes or block chords)
      if (cfg.comp) {
        var cp = tiled(cfg.comp.pat, sp), croot = 48 + ch.pc + 12 * (cfg.comp.oct || 0);
        for (i = 0; i < sp; i++) {
          var ct = cp[i];
          if (ct === '.') continue;
          var cd = cfg.comp.dur || runLen(cp, i);
          if (ct === 'c') {
            var ms = [];
            for (var q = 0; q < ch.iv.length; q++) ms.push(croot + ch.iv[q]);
            ev[s0 + i].push({ k: 'C', ms: ms, d: cd });
          } else {
            var idx = parseInt(ct, 10);
            if (idx > 0) ev[s0 + i].push({ k: 'A', m: chordTone(ch, idx, croot), d: cd });
          }
        }
      }
      // pad (one sustained chord per bar)
      if (cfg.pad) {
        var proot = 48 + ch.pc, pms = [];
        for (var r = 0; r < ch.iv.length; r++) pms.push(proot + ch.iv[r]);
        ev[s0].push({ k: 'P', ms: pms, d: sp });
      }
      // percussion layers
      if (cfg.perc) {
        for (var li = 0; li < cfg.perc.length; li++) {
          var pp = tiled(cfg.perc[li].pat, sp);
          for (i = 0; i < sp; i++) if (pp[i] !== '.' && PERC[pp[i]]) ev[s0 + i].push({ k: 'D', n: pp[i], v: cfg.perc[li].vol });
        }
      }
    }
    return { ev: ev, total: total };
  }

  /* ------------------------------------------------------ music: scheduling */
  function playStep(inst, s, t) {
    var cfg = inst.cfg, list = inst.c.ev[s], sd = inst.stepDur, D = inst.tg;
    var accent = (s % 2 === 0) ? 1 : 0.86;
    for (var i = 0; i < list.length; i++) {
      var e = list[i], vel = accent * (0.94 + rnd() * 0.12);
      switch (e.k) {
        case 'L': V[cfg.lead](inst.lead, t, mtof(e.m), e.d * sd, vel * (cfg.leadVol || 1)); break;
        case 'L2': V[cfg.lead2](inst.lead, t, mtof(e.m), e.d * sd, vel * (cfg.lead2Vol || 0.5)); break;
        case 'S': if (inst.pass % 2 === 1) V.glock(inst.lead, t, mtof(e.m), e.d * sd, 0.3 * vel); break;
        case 'B': V[cfg.bass.voice](D, t, mtof(e.m), e.d * sd, vel * (cfg.bass.vol || 1)); break;
        case 'A': V[cfg.comp.voice](D, t, mtof(e.m), e.d * sd, vel * (cfg.comp.vol || 1)); break;
        case 'C':
          for (var j = 0; j < e.ms.length; j++)
            V[cfg.comp.voice](D, t + j * (cfg.comp.strum || 0), mtof(e.ms[j]), e.d * sd, vel * (cfg.comp.vol || 1));
          break;
        case 'P':
          for (var k = 0; k < e.ms.length; k++)
            V[cfg.pad.voice](D, t, mtof(e.ms[k]), e.d * sd, cfg.pad.vol || 1);
          break;
        case 'D': PERC[e.n](D, t, e.v * (0.92 + rnd() * 0.16)); break;
      }
    }
  }

  function tickMusic() {
    try {
      if (!ctx || !cur) return;
      var inst = cur, now = ctx.currentTime;
      if (inst.next < now - 0.4) inst.next = now + 0.05;   // recover after a stall
      var guard = 0;
      while (inst.next < now + LOOKAHEAD && guard++ < 64) {
        var t = inst.next + ((inst.step % 2) ? inst.cfg.swing * inst.stepDur : 0);
        if (!muted) playStep(inst, inst.step, t);
        inst.next += inst.stepDur;
        if (++inst.step >= inst.c.total) { inst.step = 0; inst.pass++; }
      }
    } catch (e) { /* never throw out of the timer */ }
  }

  function startTrack(name) {
    var cfg = TRACKS[name];
    if (!cfg) return null;
    if (!cfg._c) cfg._c = compile(cfg);
    var now = ctx.currentTime;
    var tg = ctx.createGain();
    tg.gain.setValueAtTime(0, now);
    tg.gain.linearRampToValueAtTime(1, now + FADE);
    tg.connect(musicBus);
    var send = ctx.createGain();
    send.gain.value = cfg.rev == null ? 0.2 : cfg.rev;
    tg.connect(send); send.connect(mRevIn);
    var lead = ctx.createGain();
    lead.connect(tg);
    var nodes = [tg, send, lead];
    if (cfg.delay) {
      var dl = ctx.createDelay(3), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
      dl.delayTime.value = cfg.delay.beats * 60 / cfg.bpm;
      fb.gain.value = cfg.delay.fb;
      wet.gain.value = cfg.delay.mix;
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      lead.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl);
      lp.connect(wet); wet.connect(tg);
      nodes.push(dl, fb, wet, lp);
    }
    return {
      name: name, cfg: cfg, c: cfg._c, tg: tg, lead: lead, nodes: nodes,
      step: 0, pass: 0, next: now + 0.08,
      stepDur: 60 / cfg.bpm * cfg.bpb / cfg.sp
    };
  }

  function retire(inst) {
    if (!inst) return;
    try {
      var now = ctx.currentTime, g = inst.tg.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + FADE);
    } catch (e) { /* ignore */ }
    setTimeout(function () {
      for (var i = 0; i < inst.nodes.length; i++) { try { inst.nodes[i].disconnect(); } catch (e) { /* ignore */ } }
    }, (FADE + 4.5) * 1000);
  }

  function switchTo(track) {
    var old = cur;
    cur = null;
    retire(old);
    if (track) cur = startTrack(track);
  }

  function music(track) {
    try {
      if (track === undefined) track = null;
      if (track !== null && !TRACKS[track]) return;
      if (track === wanted) return;
      wanted = track;
      if (!ctx) return;                // will start on init()
      switchTo(track);
    } catch (e) { /* never throw */ }
  }


  /* -------------------------------------------------------- lifecycle / API */
  var lastTick = 0;
  function tickAll() {
    try {
      tickMusic();
      if (!ctx) return;
      var now = ctx.currentTime, dt = lastTick ? Math.min(0.2, Math.max(0, now - lastTick)) : 0;
      lastTick = now;
      tickAmb(dt);
      tickHeart();
    } catch (e) { /* never throw out of the timer */ }
  }

  function tryResume() {
    try {
      if (ctx && ctx.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) { /* ignore */ }
  }

  function onVisibility() {
    try {
      if (!ctx) return;
      if (document.hidden) {
        if (ctx.state === 'running') { var p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); }
      } else {
        tryResume();
      }
    } catch (e) { /* ignore */ }
  }

  var GESTURES = ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'];
  function onGesture() {
    init();
    if (ctx && ctx.state === 'running') unhookGestures();
  }
  function hookGestures() {
    if (gestureHooked || typeof root.addEventListener !== 'function') return;
    gestureHooked = true;
    for (var i = 0; i < GESTURES.length; i++) { try { root.addEventListener(GESTURES[i], onGesture, true); } catch (e) { /* ignore */ } }
  }
  function unhookGestures() {
    if (!gestureHooked) return;
    gestureHooked = false;
    for (var i = 0; i < GESTURES.length; i++) { try { root.removeEventListener(GESTURES[i], onGesture, true); } catch (e) { /* ignore */ } }
  }

  function init() {
    try {
      if (!ctx) {
        if (!build()) { ctx = null; return false; }
        if (!timer) timer = setInterval(tickAll, TICK_MS);
        if (!visHooked && typeof document !== 'undefined' && document.addEventListener) {
          visHooked = true;
          document.addEventListener('visibilitychange', onVisibility);
        }
        if (wanted && !cur) switchTo(wanted);
        if (bedId && !bed) bed = startBed(bedId);
      }
      if (ctx.state !== 'running') {
        var p = ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function setMuted(m) {
    muted = !!m;
    try { if (root.localStorage) root.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
    try { if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03); } catch (e) { /* ignore */ }
    return muted;
  }
  function setMusicVolume(v) {
    musicVol = clamp01(v);
    try { if (ctx) musicBus.gain.setTargetAtTime(musicVol * volK.music, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
  }
  function setSfxVolume(v) {
    sfxVol = clamp01(v);
    try { if (ctx) sfxBus.gain.setTargetAtTime(sfxVol * volK.sfx, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
  }
  function info() {
    var lv = 0;
    try { if (ctx) { var now = ctx.currentTime; for (var i = 0; i < liveAll.length; i++) if (liveAll[i] > now) lv++; } } catch (e) { /* ignore */ }
    return {
      state: ctx ? ctx.state : 'none', now: ctx ? ctx.currentTime : null, listener: { x: +lis.x.toFixed(3), y: +lis.y.toFixed(3), z: +lis.z.toFixed(3), yaw: +lis.yaw.toFixed(4), set: lis.set },
      voices: lv, emitters: emitters.length, bed: bedId, night: night, duck: duckK, duckGain: duckG ? +duckG.gain.value.toFixed(3) : null,
      heart: hbK, heartBeat: { period: hbPer, lead: hbLead, last: hbLog.slice() }, volumes: { music: volK.music, sfx: volK.sfx, amb: volK.amb }, muted: muted, music: cur ? cur.name : (wanted || null), cfg: CFG
    };
  }

  var api = {
    init: init,
    sfx: sfx,
    play: play,
    music: music,
    listener: listener,
    place: function (x, y, z) { try { return place(x, y, z); } catch (e) { return null; } },
    emitter: emitter,
    ambience: ambience,
    heartbeat: heartbeat,
    duck: duck,
    claim: function (n) { try { claim([].concat(n)); } catch (e) { /* ignore */ } },
    defer: function (n) { try { defer([].concat(n)); } catch (e) { /* ignore */ } },
    config: config,
    setVolumes: setVolumes,
    setMuted: setMuted,
    toggleMute: function () { return setMuted(!muted); },
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
    render: function (w, o, R) { try { return render(w, o, R); } catch (e) { return Promise.resolve(null); } },
    info: info,
    tracks: Object.keys(TRACKS),
    sfxNames: Object.keys(SFX),
    get current() { return cur ? cur.name : (wanted || null); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    _tracks: TRACKS,
    _compile: compile
  };
  Object.defineProperty(api, 'muted', {
    get: function () { return muted; },
    set: function (v) { setMuted(v); },
    enumerable: true
  });
  root.G.audio = api;

  // Be helpful: unlock automatically on the first user gesture even if the engine forgets to call init().
  hookGestures();
})();
