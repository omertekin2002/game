// Module wp5-actors: the event-driven audio layer (audio-bus.js: sounds from events, the ear following the view,
// ambience beds, heartbeat, ducking, volumes) and the WP5 debug helpers. Enemy / boss / NPC behaviour lives in
// entities.js, bosses.js, npcs.js; the telegraph visuals in fx-ground.js.
//   G.debug.actors: tokens(), telegraphs(n), attack(e?), boss(name), ring(), stage(type, o)
//   G.debug.audio:  info(), place(x, y, z), render(what, o, R), last(), names()
import { G } from './core.js';
import { EV } from './events.js';
import { bindAudio, stepAudio, frameAudio, audioState, clearAudioLog } from './audio-bus.js';

const r4 = (v) => +(+v).toFixed(4);
const BOSS_ATTACKS = { woods: ['stomp', 'spores', 'summon'], shores: ['charge', 'bubbles', 'snap'], peaks: ['leap', 'throw', 'slide'] };

export default {
  name: 'wp5-actors',
  attach(game) {
    this.game = game;
    bindAudio(game);
    const reg = game.registerDebug ? (ns, o) => game.registerDebug(ns, o) : null;
    if (!reg) return;
    reg('actors', {
      /** attack tokens in use and who is winding up / attacking right now */
      tokens() { const e = game.enemies.filter((q) => q.alive); return { tokens: e.filter((q) => q.token).length, attacking: e.filter((q) => q.attacking).length, list: e.map((q) => ({ type: q.type, state: q.state, token: q.token, attacking: q.attacking })) }; },
      /** the last n EV.TELEGRAPH payloads (source flattened) */
      telegraphs(n = 16) { return game.events.log.filter((r) => r.type === EV.TELEGRAPH).slice(-n).map((r) => ({ t: r4(r.t), kind: r.payload.kind, lead: r4(r.payload.t), x: r4(r.payload.x), y: r4(r.payload.y), z: r4(r.payload.z), source: r.payload.source ? (r.payload.source.type || r.payload.source.id) : null, announce: !!r.payload.announce })); },
      /** make an enemy (default G.debug.last) start its attack now (token → announce / wind-up) → its state */
      attack(e = G.debug.last) { if (!e) return null; e.noticed = true; e.noticeT = 0; e.cool = 0; e.tryAttack(); return e.state; },
      /** the fight's boss starts a named attack on its next step: woods stomp|spores|summon, shores charge|bubbles|snap,
       *  peaks leap|throw|slide → true when queued */
      boss(name) {
        const b = game.fight && game.fight.boss;
        if (!b || b.dying || !BOSS_ATTACKS[b.id].includes(name)) return false;
        b.clearTells(); b.lift = 0; b.forceAtk = name; b.set('walk', 0); b.cool = 0;
        return true;
      },
      /** a shockwave ring from the fight's boss now */
      ring(speed = 6.5) { const b = game.fight && game.fight.boss; if (!b) return null; b.ring(speed, 0); return game.fight.rings[game.fight.rings.length - 1] || null; },
      /** spawn + pose an enemy for screenshots: o = { dist, rel, state ('wind' = its wind-up via attack()), alt } */
      stage(type, o = {}) {
        G.debug.spawn(type, o.dist ?? 4, o.rel ?? 0, { face: true, alt: o.alt });
        const e = G.debug.last;
        if (o.state === 'wind') this.attack(e); else if (o.state) { e.state = o.state; e.st = o.st ?? 99; }
        return e;
      },
    });
    reg('audio', {
      info: () => (G.audio && G.audio.info ? G.audio.info() : null),
      place: (x, y, z) => (G.audio && G.audio.place ? G.audio.place(x, y, z) : null),
      render: (what, o, R) => (G.audio && G.audio.render ? G.audio.render(what, o, R) : Promise.resolve(null)),
      /** the audio layer's last event → sound decisions */
      last: () => audioState(),
      clear: () => clearAudioLog(),
      names: () => (G.audio && G.audio.sfxNames ? G.audio.sfxNames.slice() : []),
    });
  },
  afterStep(dt) { stepAudio(this.game, dt); },
  afterCamera() { frameAudio(this.game); },
};
