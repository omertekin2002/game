// WP5 audio layer (C8): sounds are driven by the event bus. Each handler plays the event's sound (positional where the
// event has a place) and claims the old direct-call names for that frame, so a package that still calls
// sfx('swing') next to EV.SWING never doubles it (G.audio.claim / defer in audio.js). Also: the ear follows the view
// every render frame, region ambience beds, the low-health heartbeat, music ducking in dialogue, the shockwave rumble
// riding the ring, and the settings volumes. Everything goes through guarded calls: a missing / stubbed G.audio or
// ?noaudio=1 is a silent no-op.
import { G } from './core.js';
import { EV } from './events.js';
import { settings } from './settings.js';
import { actors as TA, view as TV, hud as TH } from './tune.js';

const NOAUDIO = /[?&]noaudio=1/.test(location.search);
const DEAD = { set() {}, stop() {}, alive: false };
function call(fn, ...args) {
  if (NOAUDIO) return undefined;
  try { const a = G.audio; if (a && typeof a[fn] === 'function') return a[fn](...args); } catch (e) { /* audio never breaks the game */ }
  return undefined;
}
/** a moving / long positional sound: { set(x, y, z), stop(), alive } (a dead handle when audio is off) */
export function emitter(name, o) { return call('emitter', name, o) || DEAD; }
const play = (name, o) => call('play', name, o);
const claim = (...names) => call('claim', names);

// EV.STEP surfaces → footstep names (water = wading)
export const STEP_NAME = { grass: 'step_grass', dirt: 'step_dirt', sand: 'step_sand', snow: 'step_snow', wood: 'step_wood', stone: 'step_stone', water: 'step_wade' };
// boss TELEGRAPH kinds → their wind-up cue
export const BOSS_CUE = { slam: 'windSlam', shot: 'windShot', charge: 'windCharge', lunge: 'windLunge', leap: 'windLeap', summon: 'windSummon', ring: 'windRing' };
// every old direct-call name an event may claim (they wait for the end of the task before playing)
const CLAIMABLE = ['step', 'splash', 'jump', 'land', 'landHeavy', 'swing', 'hit', 'bossHit', 'bubble', 'snow', 'pop', 'bush', 'pot', 'enemyDie', 'hurt', 'dash', 'coin', 'heart', 'seed', 'fanfare', 'potion', 'chest', 'death'];

const S = { rings: [], game: null, regionId: null, nightT: 0, offs: [], heart: 0, bound: false, last: [] };
// the low-health beat is the HUD's (lead ruling: one period for sound and HUD): ui.js pulses the hearts and the vignette on
// a TUNE.hud.beat wall clock at hp ≤ 2 (crit at hp ≤ 1) and puts its beat 0.15 of a period in, just before the pulse peaks
const HB_LEAD = 0.15;
const at = (p, dy = 0) => ({ x: p.x, y: (p.y ?? 0) + dy, z: p.z });

export function bindAudio(game) {
  if (S.bound) return;
  S.bound = true; S.game = game;
  call('defer', CLAIMABLE);
  call('config', TA.audio);
  const ev = game.events;
  const on = (type, fn) => S.offs.push(ev.on(type, (p) => { try { fn(p || {}); } catch (e) { /* ignore */ } }));
  const go = (evName, name, o) => { S.last.push({ ev: evName, name }); if (S.last.length > 48) S.last.shift(); return play(name, o); };
  on(EV.STEP, (p) => { claim('step', 'splash'); go('step', STEP_NAME[p.surface] || 'step_grass', { pan: p.foot === 'L' ? -0.15 : 0.15, vol: Math.min(1.1, 0.6 + 0.1 * (p.speed || 4.4)) }); });
  on(EV.JUMP, () => { claim('jump'); go('jump', 'jump'); });
  on(EV.LAND, (p) => {
    claim('land', 'landHeavy');
    const i = +p.impact || 0;
    if (i > 8) go('land', 'landHeavy'); else if (i > 3) go('land', 'land'); else if (i > 1) go('land', STEP_NAME[p.surface] || 'step_grass', { vol: 0.9 });
  });
  on(EV.SWING, (p) => { claim('swing'); go('swing', 'swing' + (p.kind === 'B' || p.kind === 'C' ? p.kind : 'A')); if ((p.level || 1) >= 2) go('swing', 'swingSparkle', { vol: 0.8 }); });
  on(EV.HIT, (p) => {
    const o = at(p);
    if (p.kind === 'enemy') { claim('hit'); go('hit', 'hit', o); go('hit', 'squish', o); }
    else if (p.kind === 'boss') { claim('bossHit'); go('hit', 'bossHit', o); }
    else if (p.kind === 'projectile') { claim('bubble', 'snow', 'pop'); go('hit', p.target && p.target.kind === 'bubble' ? 'bubble' : 'pop', o); }
    else if (p.kind === 'cut') { claim('bush', 'pot'); go('hit', p.target && p.target.cutKind === 'pot' ? 'pot' : p.target && p.target.cutKind === 'grass' ? 'leaves' : 'bush', o); }
  });
  on(EV.CLINK, (p) => { claim('hit'); go('clink', 'clink', at(p)); });
  on(EV.KILL, (p) => { claim('enemyDie'); go('kill', 'enemyDie', at(p)); });
  on(EV.HURT, () => { claim('hurt'); go('hurt', 'hurt'); });
  on(EV.DOWN, () => { claim('death'); go('down', 'death'); });
  on(EV.DASH_START, () => { claim('dash'); go('dashStart', 'dash'); });
  on(EV.COLLECT, (p) => {
    claim('coin', 'heart', 'seed', 'fanfare');
    if (p.kind === 'gem') go('collect', 'pickupGem', { value: p.value || 1 });
    else if (p.kind === 'heart') go('collect', 'heart');
    else if (p.kind === 'seed') go('collect', 'seed');
  });
  on(EV.POTION, () => { claim('potion'); go('potion', 'potion'); });
  on(EV.ITEM_GET, () => { claim('fanfare'); go('itemGet', 'fanfare'); });
  on(EV.CHEST_OPEN, (p) => { claim('chest'); const c = p.chest; go('chestOpen', 'chest', c && Number.isFinite(c.x) ? { x: c.x, y: (c.y || 0) + 0.5, z: c.z } : null); });
  on(EV.VIEW_MODE, (p) => { if (p.prev && p.mode !== p.prev) go('viewMode', 'viewSwitch'); });
  on(EV.LOCK, (p) => go('lock', p.target ? 'lockOn' : 'lockOff'));
  on(EV.TELEGRAPH, (p) => {
    const s = p.source, o = at(p);
    if (p.ring) return;                                   // a ring that just spawned: its rumble rides it (SHOCKWAVE)
    if (p.announce) { go('telegraph', 'announce', o); return; }
    if (s && s.type && !s.arena) { go('telegraph', 'windup_' + s.type, { ...o, dur: s.windDur || p.t }); return; }
    const cue = BOSS_CUE[p.kind];
    if (cue) go('telegraph', cue, { ...o, dur: (s && s.windDur) || p.t, vol: 1.1 });
  });
  on(EV.SHOCKWAVE, (p) => {
    const r = p.ring;
    if (!r) return;
    const em = emitter('rumble', { x: p.x, y: p.y, z: p.z, dur: Math.max(0.6, (r.max - r.r) / Math.max(1, r.speed)) });
    S.rings.push({ r, em });
  });
  on(EV.BOSS_INTRO, () => go('bossIntro', 'bossIntro'));
  on(EV.FIGHT_END, () => stopRings());
  on(EV.REGION, (p) => { S.regionId = p.id; call('ambience', p.id, { night: night() }); });
  on(EV.MODAL, (p) => call('duck', p.modal === 'dlg' ? 0.45 : p.modal === 'shop' ? 0.7 : 1));
  // the title silences everything; the cached heartbeat level goes with it, so a Continue at low hp starts it again
  on(EV.TITLE, () => { call('ambience', null); call('heartbeat', 0); S.heart = 0; call('duck', 1); stopRings(); S.regionId = null; });
  on(EV.SESSION, () => { S.heart = -1; });   // a new / loaded session: stepAudio re-sends the level whatever it is
  // settings: musicVol / sfxVol / ambVol are multipliers on the mix (C17)
  const vols = () => call('setVolumes', { music: settings.get('musicVol'), sfx: settings.get('sfxVol'), amb: settings.get('ambVol') });
  vols();
  for (const k of ['musicVol', 'sfxVol', 'ambVol']) S.offs.push(settings.on(k, vols));
}
function stopRings() { for (const q of S.rings) q.em.stop(); S.rings = []; }
function night() { const s = G.sky; return s && Number.isFinite(s.night) ? s.night : 0; }

/** every fixed step (module afterStep): the low-health heartbeat, the bed's day / night every 2 s */
export function stepAudio(game, dt) {
  const st = game.S;
  let k = 0;
  // the HUD's thresholds whatever maxHp is: soft with the low pulse (hp ≤ 2), full at half a heart (hp ≤ 1)
  if (st && game.state === 'play' && st.hp > 0 && game.player.state !== 'dizzy') k = st.hp <= 1 ? 1 : st.hp <= 2 ? TA.audio.heartSoft : 0;
  if (k !== S.heart) { S.heart = k; call('heartbeat', k, { period: TH.beat, lead: HB_LEAD }); }
  S.nightT -= dt;
  if (S.nightT <= 0) { S.nightT = 2; if (S.regionId) call('ambience', S.regionId, { night: night() }); }
}
/** every render frame (module afterCamera): the ear at Pip's eye with the look yaw; rumbles ride their rings */
export function frameAudio(game) {
  const v = game.view, pl = game.player;
  const ex = v.mode === 'fp' ? v.eye.x : pl.root.position.x, ez = v.mode === 'fp' ? v.eye.z : pl.root.position.z;
  const ey = v.mode === 'fp' ? v.eye.y : pl.root.position.y + TV.eyeH;
  call('listener', ex, ey, ez, v.yaw);
  if (S.rings.length) {
    for (const q of S.rings) {
      const r = q.r;
      if (!r.active || !q.em.alive) { q.em.stop(); q.dead = true; continue; }
      // the nearest point of the ring to the ear
      const dx = ex - r.cx, dz = ez - r.cz, l = Math.hypot(dx, dz) || 1;
      q.em.set(r.cx + (dx / l) * r.r, r.cy + 0.3, r.cz + (dz / l) * r.r);
    }
    S.rings = S.rings.filter((q) => !q.dead);
  }
}
/** debug: the audio layer's recent event → sound decisions, live rumbles, the heartbeat level */
export function audioState() { return { last: S.last.slice(-16), rings: S.rings.length, heart: S.heart, region: S.regionId, bound: S.bound }; }
export function clearAudioLog() { S.last.length = 0; }
