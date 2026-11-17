// Synchronous event bus (game.events === G.events) + the event names and payloads (arch §8.1).
// Events fire from fixed steps too: render-side listeners (viewmodel, shake, HUD) should buffer, not do heavy work.

export const EV = {
  SWING: 'swing',               // player.startAttack   { id, kind: 'A'|'B'|'C', level, side: 'R'|'L'|'C' (A/B/C), aimYaw, aimPitch }
  HIT: 'hit',                   // combat, per target   { kind: 'enemy'|'boss'|'projectile'|'cut', swing: 'A'|'B'|'C', x, y, z (contact), dmg, target, killed }
  CLINK: 'clink',               // combat (crab guard)  { x, y, z (contact), target, kind: swing kind }
  KILL: 'kill',                 // killEnemy            { type, x, y, z }
  HURT: 'hurt',                 // playerHurt           { dmg, fromX, fromY, fromZ, knock, source: 'enemy'|'boss'|'ring'|'projectile', hurtDir: {x, z} (toward the source), rel (its bearing from the look yaw, + = left) }
  DOWN: 'down',                 // playerDown           {}
  RESPAWN: 'respawn',           // dizzy respawn        {}
  DASH_START: 'dashStart',      // player               { dirX, dirZ }
  DASH_END: 'dashEnd',          // player, any exit from 'dash' (timer, cutscene, item-get, place)  {}
  JUMP: 'jump',                 // player (WP3)         {}
  LAND: 'land',                 // player (WP3)         { impact, surface }
  STEP: 'step',                 // player footstep      { foot: 'L'|'R', surface: 'grass'|'dirt'|'sand'|'snow'|'wood'|'water'|'stone', speed }
  COLLECT: 'collect',           // collect              { kind, value }
  POTION: 'potion',             // drinkPotion          {}
  ITEM_GET: 'itemGet',          // itemGet              { built, portrait, kind }
  ITEM_DONE: 'itemDone',        // itemGet onDone       the ITEM_GET payload object { built, portrait, kind }
  INTERACT: 'interact',         // interact             { kind, target }
  TALK_START: 'talkStart',      // talkTo / intro       { npc }
  TALK_END: 'talkEnd',          // talkTo / intro       { npc }
  SHOP_OPEN: 'shopOpen',        // talkTo (Miso)        {}
  SHOP_CLOSE: 'shopClose',      // shop close           {}
  CHEST_OPEN: 'chestOpen',      // openChest            { chest }
  CUTSCENE_START: 'cutsceneStart', // cutscenes / fight   { type: 'place'|'ending'|'bossIntro' }
  CUTSCENE_END: 'cutsceneEnd',  // cutscenes / fight    { type }
  BOSS_INTRO: 'bossIntro',      // startFight           { id, boss }
  BOSS_FIGHT: 'bossFight',      // intro → fight        { id }
  BOSS_HIT: 'bossHit',          // combat               { id, hp }
  BOSS_DEFEATED: 'bossDefeated', // onBossDefeated      { id }
  FIGHT_END: 'fightEnd',        // endFight / won       { id, reset }
  TELEGRAPH: 'telegraph',       // actors wind-up (WP5) { kind, x, y, z, t, source }
  SHOCKWAVE: 'shockwave',       // addShockwave         { x, y, z, ring }
  REGION: 'region',             // updateRegion         { id, first, session }  first = first visit ever, session = first check of the session
  SAVE: 'save',                 // save                 { quiet }
  VIEW_MODE: 'viewMode',        // view (F2)            { mode, prev }
  FOV: 'fov',                   // view (F2)            { v, h, px }
  MODAL: 'modal',               // game.frame tracker   { modal: null|'dlg'|'shop'|'pause'|'controls'|'map'|'ending'|'settings', prev }
  POINTER_LOCK: 'pointerLock',  // lock (F2)            { locked }
  DEVICE: 'device',             // input (F2)           { device }
  SETTINGS: 'settings',         // settings.set         { key, value }
  SESSION: 'session',           // startSession         { isNew }
  TITLE: 'title',               // title shown          {}
  LOCK: 'lock',                 // lock-on change (WP4) { target, prev }  (target / prev: Enemy | Boss | null)
  HINT: 'hint',                 // ask the HUD for a hint (any package → WP6 queues it)  { id, text }
};

const LOG_MAX = 64;

export class Emitter {
  constructor() {
    this.map = new Map();
    this.log = [];        // ring buffer of the last 64 events (G.debug.events())
    this.n = 0;
    this.clock = null;    // optional: stamps simTime on the log
  }
  /** subscribe; returns an off() function */
  on(type, fn) {
    let a = this.map.get(type);
    if (!a) this.map.set(type, (a = []));
    a.push(fn);
    return () => this.off(type, fn);
  }
  /** one-shot; off(type, fn) with the original fn also removes it */
  once(type, fn) {
    const w = (p, t) => { this.off(type, w); fn(p, t); };
    w.fn = fn;
    return this.on(type, w);
  }
  off(type, fn) {
    const a = this.map.get(type);
    if (!a) return;
    const i = a.findIndex((f) => f === fn || f.fn === fn);
    if (i >= 0) a.splice(i, 1);
  }
  emit(type, payload = {}) {
    const rec = { n: this.n++, type, t: this.clock ? this.clock.simTime : 0, payload };
    if (this.log.length >= LOG_MAX) this.log.shift();
    this.log.push(rec);
    const a = this.map.get(type);
    if (!a || !a.length) return;
    for (const fn of a.slice()) {
      try { fn(payload, type); } catch (e) { console.error('[Starseed] event listener', type, e); }
    }
  }
  clearLog() { this.log.length = 0; }
}
