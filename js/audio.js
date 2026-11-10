/* Starseed Isle — procedural audio (Web Audio API, zero assets).
 *
 *   G.audio.init()            unlock/resume (call on a user gesture; idempotent)
 *   G.audio.sfx(name)         fire-and-forget sound effect
 *   G.audio.music(track)      crossfade (~1 s) to a looping track; same = no-op; null = fade out
 *   G.audio.setMuted(bool) / G.audio.muted
 *   G.audio.setMusicVolume(0..1) / G.audio.setSfxVolume(0..1)
 *
 * Everything is wrapped so that a missing/blocked AudioContext simply makes every call a silent no-op.
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  root.G = root.G || {};

  var MUTE_KEY = 'starseed-isle-muted';
  var FADE = 1.0;            // music crossfade seconds
  var LOOKAHEAD = 0.18;      // seconds scheduled ahead of the audio clock
  var TICK_MS = 25;

  /* ------------------------------------------------------------------ state */
  var ctx = null;
  var master = null, comp = null, musicBus = null, sfxBus = null;
  var mRevIn = null, sRevIn = null;
  var noiseBuf = null;
  var timer = null;
  var cur = null;                 // current music instance
  var wanted = null;              // last requested track (so music() before init() works)
  var muted = false;
  var musicVol = 0.35, sfxVol = 0.7;
  var visHooked = false, gestureHooked = false;
  var live = {}, lastT = {}, liveAll = [];

  try { muted = root.localStorage && root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }

  function rnd() { return Math.random(); }
  function rv(a) { return 1 + (rnd() * 2 - 1) * a; }          // random multiplier 1±a
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp01(x) { x = +x; return x !== x ? 0 : Math.max(0, Math.min(1, x)); }

  /* --------------------------------------------------------------- primitives */
  function wire(node, o) {
    node.connect(o.dest || sfxBus);
    if (o.rev && !o.dest) {
      var s = ctx.createGain();
      s.gain.value = o.rev;
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

  // oscillator voice. o: t,d,f,f1,fd,type,v,a,h,lp,lp1,q,vib[hz,depthHz],detune,dest,rev
  function T(o) {
    var t = o.t, v = o.v == null ? 0.3 : o.v, a = o.a == null ? 0.006 : o.a;
    var osc = ctx.createOscillator(), g = ctx.createGain(), last = osc;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.min(o.f, 18000), t);
    var d = Math.max(o.d, a + 0.01);
    if (o.f1 && o.f1 !== o.f) osc.frequency.exponentialRampToValueAtTime(Math.min(18000, Math.max(20, o.f1)), t + (o.fd || d));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
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
    var t = o.t, v = o.v == null ? 0.2 : o.v, a = o.a == null ? 0.004 : o.a;
    var d = Math.max(o.d, a + 0.01);
    var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = o.type || 'bandpass';
    fl.Q.value = o.q || 0.8;
    fl.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + d);
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
  function makeIR(sec) {
    var sr = ctx.sampleRate, len = Math.floor(sr * sec);
    var buf = ctx.createBuffer(2, len, sr);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
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

  function build() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol;
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol;
    musicBus.connect(comp); sfxBus.connect(comp);
    comp.connect(master); master.connect(ctx.destination);

    // noise buffer
    var sr = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, sr * 2, sr);
    var nd = noiseBuf.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;

    // two reverbs sharing one generated impulse (music return / sfx return)
    var ir = makeIR(2.2);
    mRevIn = ctx.createBiquadFilter(); mRevIn.type = 'highpass'; mRevIn.frequency.value = 260;
    var mConv = ctx.createConvolver(); mConv.buffer = ir;
    var mRet = ctx.createGain(); mRet.gain.value = 0.7;
    mRevIn.connect(mConv); mConv.connect(mRet); mRet.connect(musicBus);

    sRevIn = ctx.createBiquadFilter(); sRevIn.type = 'highpass'; sRevIn.frequency.value = 300;
    var sConv = ctx.createConvolver(); sConv.buffer = ir;
    var sRet = ctx.createGain(); sRet.gain.value = 0.55;
    sRevIn.connect(sConv); sConv.connect(sRet); sRet.connect(sfxBus);
    return true;
  }

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

  // [max simultaneous voices, min gap seconds]
  var LIM = {
    coin: [3, 0.04], step: [2, 0.09], talk: [2, 0.035], hit: [4, 0.03], swing: [3, 0.06],
    menu: [2, 0.04], bubble: [4, 0.05], shoot: [4, 0.05], bush: [3, 0.05], pot: [3, 0.06],
    snow: [3, 0.05], enemyDie: [4, 0.05], heart: [2, 0.1], splash: [2, 0.1], error: [2, 0.12],
    select: [2, 0.05], cancel: [2, 0.05], dash: [2, 0.08], stomp: [2, 0.1], hurt: [2, 0.1]
  };
  var DEF_LIM = [6, 0.02];
  var LOW_PRI = { step: 1, talk: 1, swing: 1, menu: 1, bubble: 1, snow: 1, bush: 1 };

  function sfx(name) {
    try {
      if (!ctx || muted) return;
      var def = SFX[name];
      if (typeof def !== 'function') return;
      if (ctx.state !== 'running') { tryResume(); return; }
      var now = ctx.currentTime, lim = LIM[name] || DEF_LIM, i;
      var arr = live[name] || (live[name] = []);
      for (i = arr.length - 1; i >= 0; i--) if (arr[i] <= now) arr.splice(i, 1);
      for (i = liveAll.length - 1; i >= 0; i--) if (liveAll[i] <= now) liveAll.splice(i, 1);
      if (arr.length >= lim[0]) return;
      if (now - (lastT[name] || -1) < lim[1]) return;
      if (liveAll.length >= 24 && LOW_PRI[name]) return;
      if (liveAll.length >= 40) return;
      lastT[name] = now;
      var t = now + 0.005;
      var len = def(t) || 0.3;
      arr.push(t + len);
      liveAll.push(t + len);
    } catch (e) { /* never throw */ }
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

  function tick() {
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
        if (!timer) timer = setInterval(tick, TICK_MS);
        if (!visHooked && typeof document !== 'undefined' && document.addEventListener) {
          visHooked = true;
          document.addEventListener('visibilitychange', onVisibility);
        }
        if (wanted && !cur) switchTo(wanted);
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
    try { if (ctx) musicBus.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
  }
  function setSfxVolume(v) {
    sfxVol = clamp01(v);
    try { if (ctx) sfxBus.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
  }

  var api = {
    init: init,
    sfx: sfx,
    music: music,
    setMuted: setMuted,
    toggleMute: function () { return setMuted(!muted); },
    setMusicVolume: setMusicVolume,
    setSfxVolume: setSfxVolume,
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
