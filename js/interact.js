// Gameplay input routing, potions, pickups, item-get, talking, shop, chests, pedestal, errands (Game mixin). Event names and
// function names here are hooks for WP1 (camera), WP2 (hands) and WP6 (UI): keep them stable. Timed beats (the chest
// freeze) run on sim time (later / tickLater), so they hold while a menu or the shop pauses the world.
import * as THREE from 'three';
import { sfx } from './core.js';
import { BOSSES, CFG, SEED_ORDER, SEEDS, ERRANDS, SECRETS, progress, errands, secrets } from './data.js';
import { NPC } from './npcs.js';
import { Boss } from './bosses.js';
import { Pickup } from './entities.js';
import { toonMat, sharedOutline, meshWithOutline } from './toon.js';
import { seedBuilt, heartContainerBuilt } from './models.js';
import { rand, pick, len2, LAYER, setLayer } from './util.js';
import { EV } from './events.js';
import { combat as TC, actors as TA } from './tune.js';

const _v = new THREE.Vector3(), _a = new THREE.Vector3();

export const InteractMixin = {
  gameplayInput(input) {
    const pl = this.player, p = this.presses;
    if (input.pressed('pause')) { this.ui.openPause(); return; }
    if (input.pressed('map')) { this.ui.openMap(pl.pos, this.view.yaw, this.S); return; }
    if (input.pressed('potion')) this.drinkPotion();
    const tgt = this.target;
    // E / F / Enter, pad Y, touch Use or a tap in the look zone; attack never interacts (RULINGS)
    if (tgt && (input.pressed('interact') || input.pressed('tap'))) { this.interact(tgt); return; }
    if (performance.now() - this.modalClosedAt < 120) return; // the press that closed a modal never swings or rolls
    if (input.pressed('attack')) p.attack = true;
    if (input.pressed('dash')) p.dash = true;
    if (input.pressed('jump')) p.jump = true;
  },
  /** turn toward something Pip interacts with: FP eases the view onto it; TP turns the body (look unchanged) */
  faceSubject(x, y, z, dur = 0.35) {
    const pl = this.player;
    if (this.view.mode === 'fp') this.view.faceTo(x, y, z, { dur });
    else pl.turnTo(Math.atan2(x - pl.pos.x, z - pl.pos.z));
  },
  drinkPotion() {
    const S = this.S;
    if (S.potions <= 0) { this.ui.toast('No potions! Miso sells them.'); sfx('error'); return; }
    if (S.hp >= S.maxHp) { this.ui.toast('Already full of hearts!'); sfx('error'); return; }
    S.potions--; S.hp = S.maxHp;
    sfx('potion');
    this.events.emit(EV.POTION, {});
    const a = this.view.selfAnchor('chest', _a);
    for (let i = 0; i < 14; i++) this.fx.sparkle(a.x, a.y, a.z, pick([0xff9fb6, 0xffffff, 0xfff4a0]), 1, 0.6);
    this.ui.selfFloater('Refreshed!', '#ffb6c8');
  },
  collect(p) {
    const S = this.S;
    const a = this.view.selfAnchor('chest', _a);
    this.events.emit(EV.COLLECT, { kind: p.kind, value: p.value });
    if (p.kind === 'gem') {
      S.coins += p.value;
      sfx('coin');
      this.fx.sparkle(a.x, a.y, a.z, 0xb8fff0, 3, 0.4);
      if (p.value > 1) this.ui.selfFloater('+' + p.value + ' gems', '#c8fbff', 18);
    } else if (p.kind === 'heart') {
      S.hp = Math.min(S.maxHp, S.hp + 2);
      sfx('heart');
      this.fx.sparkle(a.x, a.y, a.z, 0xff9fb6, 4, 0.4);
    } else if (p.kind === 'seed') {
      S.seeds[p.seedId] = 1;
      sfx('seed'); sfx('fanfare');
      const left = 3 - progress.found(S);
      this.itemGet(seedBuilt(SEEDS[p.seedId].color), SEEDS[p.seedId].key, [
        'You got the ' + SEEDS[p.seedId].name + '!',
        left > 0 ? 'Bring it to the pedestal by the Great Tree. ' + left + ' more to find!' : 'That\'s all three! Hurry back to the Great Tree!',
      ]);
      this.save(true);
      this.updateMusic(true);
    }
  },
  /** item-get: Pip holds the item up. FP never turns the view: the item is presented in front of the eye (viewmodel.js);
   *  TP turns the body to the camera and raises it overhead */
  itemGet(built, portrait, lines, after) {
    const pl = this.player;
    pl.state = 'item';
    pl.vel.set(0, 0);
    if (this.view.mode === 'tp') pl.turnTo(this.view.yaw + Math.PI); // TP: show the item to the camera
    this.clearHeldItem();
    const mat = toonMat({ glow: true, glowBase: 0.4, rim: 0.6 });
    const g = meshWithOutline(built, mat, sharedOutline('char'));
    g.traverse((m) => { m.castShadow = false; });
    g.scale.setScalar(1.3);
    setLayer(g, LAYER.BODY);
    pl.held.add(g);
    this.heldItem = g;
    // the burst: over Pip's head in TP; in FP well past the held item (never inside 0.6 m of the eye)
    if (this.view.bodyOut) this.fx.burst(pl.pos.x, pl.pos.y + 1.5, pl.pos.z, 0xfff4a0, 18, 4);
    else { const e = this.view.simEye(_a), f = this.view.forward(); this.fx.burst(e.x + f.x * 1.6, e.y + 0.35, e.z + f.z * 1.6, 0xfff4a0, 18, 4); }
    const ev = { built, portrait, kind: portrait };   // itemDone carries the same payload, so overlapping item-gets stay apart
    this.events.emit(EV.ITEM_GET, ev);
    this.ui.say(lines, { portrait, onDone: () => { this.clearHeldItem(); pl.state = 'normal'; this.ui.updateHud(this.S); this.events.emit(EV.ITEM_DONE, ev); if (after) after(); } });
  },
  /** after the session fade-in: Shellby's intro (new game / intro not done), else the controls card once or a greeting */
  sessionIntro(isNew) {
    const S = this.S;
    if (isNew || !S.introDone) {
      const sh = this.npcs.find((n) => n.id === 'shellby');
      if (!sh) return;
      sh.talkStart();
      this.events.emit(EV.TALK_START, { npc: sh });
      this.faceSubject(sh.pos.x, sh.pos.y + TC.aimPts.npc[0] * sh.height, sh.pos.z, 0.6);
      this.ui.say(sh.def.intro, { name: sh.name, portrait: sh.key, onDone: () => { sh.talkEnd(); this.events.emit(EV.TALK_END, { npc: sh }); S.introDone = true; this.save(true); if (!S.controlsSeen) this.ui.openControls(false); } });
    } else if (!S.controlsSeen) this.ui.openControls(false);
    else this.ui.toast('Welcome back, Pip!');
  },
  /** run fn after sec of sim time (ticked by the wp4-targeting module's afterStep: holds under menus / the shop, and is
   *  dropped at session start and on the title) */
  later(sec, fn, cancel = null) { const j = { t: sec, fn, cancel }; (this._later || (this._later = [])).push(j); return j; },
  tickLater(dt) {
    const L = this._later;
    if (!L || !L.length) return;
    for (const j of L) j.t -= dt;
    const due = L.filter((j) => j.t <= 0);
    this._later = L.filter((j) => j.t > 0);
    for (const j of due) { try { j.fn(); } catch (e) { this.modError({ name: 'wp4-later' }, 'fn', e); } }
  },
  clearLater() { if (this._later && this._later.length) { for (const j of this._later) if (j.cancel) j.cancel(); } this._later = []; },
  clearHeldItem() {
    if (this.heldItem) this.heldItem.removeFromParent();
    this.heldItem = null;
    this.player.held.clear();
  },
  interact(t) {
    const o = t.o;
    const pl = this.player;
    pl.endSwing();          // E mid-swing: the swing stops here (talking pauses the world; no hits during it)
    pl.vel.set(0, 0);
    this.faceSubject(t.px ?? t.x, t.py ?? (t.y ?? pl.pos.y) + 0.8, t.pz ?? t.z); // FP eases onto the aim point (NPC face, sign board, lid…)
    this.events.emit(EV.INTERACT, { kind: o instanceof NPC ? (o.def.shop ? 'shop' : 'npc') : o instanceof Boss ? 'guardian' : o.kind, target: o });
    if (o instanceof NPC) return this.talkTo(o);
    if (o instanceof Boss) return this.wakeRematch(o);   // a napping rematch guardian (fight.js)
    switch (o.kind) {
      case 'sign': sfx('talk'); this.ui.say(o.lines, { name: 'Sign' }); break;
      case 'door': sfx('door'); this.ui.say(o.lines, {}); break;
      case 'well': sfx('splash'); this.ui.say(o.lines, {}); break;
      case 'chest': this.openChest(o.chest); break;
      case 'pedestal': this.usePedestal(); break;
      case 'secret': this.findSecret(o); break;   // a landmark keepsake
      default: { const e = errands.forItem(o.kind); if (e && e.how === 'use') this.findErrandItem(e, o); }   // a rainbow shell
    }
  },
  talkTo(npc) {
    sfx('talk');
    npc.talkStart();
    this.events.emit(EV.TALK_START, { npc });
    const S = this.S;
    const lines = npc.def.lines(S);
    this.ui.say(lines, {
      name: npc.name, portrait: npc.key,
      onDone: () => {
        if (npc.def.shop) {
          this.ui.openShop(S, (it) => this.buy(it), () => { npc.talkEnd(); this.events.emit(EV.SHOP_CLOSE, {}); this.events.emit(EV.TALK_END, { npc }); this.ui.updateHud(S); this.save(true); });
          this.events.emit(EV.SHOP_OPEN, {});
        } else { npc.talkEnd(); this.events.emit(EV.TALK_END, { npc }); }
        const e = errands.forNpc(npc.id);
        if (e && this.state === 'play' && !this.leaving) this.errandTalk(npc, e);
      },
    });
  },
  /** a talk with an errand's villager ended: start the errand (its items appear) or finish it (the reward, once). A
   *  `follow` errand under way sets the villager following Pip (again after a Continue, which sends him home) */
  errandTalk(npc, e) {
    const S = this.S, res = errands.talk(S, e);
    if (e.follow) npc.setFollow(errands.following(S, e));
    if (!res) return;
    if (res === 'start') {
      this.syncErrands();
      this.ui.toast('✿ ' + e.startToast);
    } else {
      const gems = (e.reward && e.reward.gems) || 0;   // errands.talk already added them to S.coins
      sfx('fanfare');
      this.fx.burst(npc.pos.x, npc.pos.y + 1.2, npc.pos.z, 0xb8fff0, 18, 3);
      for (let i = 0; i < 10; i++) this.fx.sparkle(npc.pos.x, npc.pos.y + 1, npc.pos.z, pick([0xb8fff0, 0xfff4a0, 0xffc8f0]), 1, 0.8);
      if (gems) this.events.emit(EV.COLLECT, { kind: 'gem', value: gems });   // the feed's "+50 gems" line and the gem sound
      this.ui.toast('✿ Errand done: ' + e.name);
      this.ui.updateHud(S);
    }
    this.save(true);
  },
  /** Miso's counter: the guardian plushies Pip bought (S.plushies), from the save */
  syncPlushies() {
    if (!this.scenery.setPlushie) return;
    for (const id of Object.keys(BOSSES)) this.scenery.setPlushie(id, !!this.S && !!this.S.plushies && this.S.plushies[id] === true);
  },
  /** every errand item's scenery from the save: shown while it is out (a `keep` item also once found, in its found look:
   *  a lit lantern), hidden otherwise. `instant`: no warm-up (a session start) */
  syncErrands(instant = true) {
    const W = this.world, S = this.S;
    if (!this.scenery.setErrandItem) return;
    for (const e of ERRANDS) for (const it of W[e.list] || []) {
      this.scenery.setErrandItem(e.item, it.id, !!S && errands.itemShown(S, e, it.id), !!S && errands.itemFound(S, e, it.id), instant);
    }
  },
  /** a new session: a villager who was following (the parade) or walking home is back on his spot, not following;
   *  talking to him picks the parade up again */
  resetErrandNpcs() {
    for (const n of this.npcs) if (n.follow || n.homing) n.resetHome();
  },
  /** Pip finds an errand item: a rainbow shell picked up with Use (it disappears) or a parade lantern lit by walking past
   *  (it warms up and stays lit). Counted and saved at once; the last one sends a parade villager home */
  findErrandItem(e, it) {
    const S = this.S;
    const n = e ? errands.pick(S, e, it.id) : null;
    if (n == null) return false;
    this.scenery.setErrandItem(e.item, it.id, !!e.keep, true, false);
    if (e.how === 'use') {
      sfx('coin');
      this.fx.burst(it.x, it.y + 0.3, it.z, 0xfff4a0, 10, 2);
      for (let i = 0; i < 8; i++) this.fx.sparkle(it.x, it.y + 0.3, it.z, pick([0xff9fb6, 0xfff4a0, 0xa8e4ff, 0xb8ffb0, 0xd8b0ff]), 1, 0.5);
    } else {
      // a soft light-up: a warm chime and a few slow motes (fewer with motion comfort), no flash or burst
      sfx('sparkle', it.paper || { x: it.x, y: it.y + 1.1, z: it.z });
      const k = this.calmFx() ? 2 : 5, c = it.paper || { x: it.x, y: it.y + 1.1, z: it.z };
      for (let i = 0; i < k; i++) this.fx.sparkle(c.x + rand(-0.2, 0.2), c.y + rand(-0.1, 0.3), c.z + rand(-0.2, 0.2), pick([0xfff4a0, 0xffd38a]), 1, 0.25);
    }
    this.ui.selfFloater(e.itemLabel + ' ' + n + '/' + e.count, e.itemColor);
    if (n >= e.count) {
      this.ui.toast('✿ ' + e.allToast);
      const npc = e.follow ? this.errandNpc(e) : null;
      if (npc) npc.goHome();
    }
    this.save(true);
    return true;
  },
  /** Motion comfort is on: errand effects stay calm (fewer motes, no lantern sway) */
  calmFx() { return !!(this.settings && this.settings.get('reduceMotion')); },
  /** the villager an errand belongs to (looked up once) */
  errandNpc(e) {
    const m = this._errandNpcs || (this._errandNpcs = new Map());
    if (!m.has(e.id)) m.set(e.id, this.npcs.find((q) => q.id === e.npc) || null);
    return m.get(e.id);
  },
  /** fixed step: a 'walk' errand item lights when Pip passes within TA.paradeLight m (XZ) of it while its villager
   *  follows close behind (within TA.paradeNear m of Pip). Free play only: never during a talk, a menu or a cutscene */
  tickErrands() {
    const S = this.S, W = this.world, pl = this.player;
    if (!S || !this.playing) return;
    for (const e of ERRANDS) {
      if (e.how !== 'walk' || errands.state(S, e.id) !== 1) continue;
      if (e.follow) {
        const npc = this.errandNpc(e);
        if (!npc || !npc.follow || len2(npc.pos.x - pl.pos.x, npc.pos.z - pl.pos.z) > TA.paradeNear) continue;
      }
      for (const it of W[e.list] || []) {
        if (len2(it.x - pl.pos.x, it.z - pl.pos.z) <= TA.paradeLight && errands.itemOut(S, e, it.id)) this.findErrandItem(e, it);
      }
    }
  },
  /** a soft twinkle over each errand item that is still out within 40 m (rainbow over a shell, warm over an unlit
   *  lantern, fewer with Motion comfort). Called each render frame, skipped while the clock holds or a dialogue is up */
  tickErrandFx(dt) {
    const W = this.world, S = this.S, pl = this.player, calm = this.calmFx();
    this.scenery.calm = calm;   // the lanterns' sway
    if (!S) return;
    this._shellT = (this._shellT || 0) - dt;
    if (this._shellT > 0) return;
    this._shellT = 0.35;
    for (const e of ERRANDS) {
      if (errands.state(S, e.id) !== 1) continue;
      const lantern = e.how === 'walk';
      for (const it of W[e.list] || []) {
        if (!errands.itemOut(S, e, it.id) || Math.abs(it.x - pl.pos.x) > 40 || Math.abs(it.z - pl.pos.z) > 40) continue;
        if (lantern) { const c = it.paper || it; if (Math.random() < (calm ? 0.2 : 0.5)) this.fx.sparkle(c.x + rand(-0.12, 0.12), c.y + rand(-0.12, 0.18), c.z + rand(-0.12, 0.12), pick([0xfff4a0, 0xffe2a8]), 1, 0.25); }
        else this.fx.sparkle(it.x + rand(-0.15, 0.15), it.y + rand(0.35, 0.7), it.z + rand(-0.15, 0.15), pick([0xff9fb6, 0xfff4a0, 0xa8e4ff, 0xb8ffb0, 0xd8b0ff]), 1, 0.3);
      }
    }
  },
  /** the landmark keepsakes from the save: the found ones gone (an opened bottle stays, without its cork) */
  syncSecrets() {
    if (!this.scenery.setSecret) return;
    for (const it of this.world.secrets || []) { const s = secrets.get(it.id); this.scenery.setSecret(it.id, !!this.S && secrets.got(this.S, it.id), !!(s && s.keep)); }
  },
  /** Pip reads a landmark keepsake with Use: its lines like a sign, and the first time its gems (the usual gem feedback)
   *  and a save. A found one is no longer offered, so a repeat never happens in play; secrets.find gives 0 then anyway */
  findSecret(it) {
    const S = this.S, s = secrets.get(it.id);
    if (!s) return false;
    const gems = secrets.find(S, s.id);
    sfx('talk');
    this.ui.say(s.lines, { name: s.name });
    if (!gems) return false;
    this.scenery.setSecret(s.id, true, !!s.keep);
    sfx('sparkle', { x: it.x, y: it.y + 0.3, z: it.z });
    const k = this.calmFx() ? 3 : 8;
    for (let i = 0; i < k; i++) this.fx.sparkle(it.x + rand(-0.15, 0.15), it.y + rand(0.15, 0.45), it.z + rand(-0.15, 0.15), pick([0xfff4a0, 0xb8fff0, 0xffc8f0]), 1, 0.5);
    this.events.emit(EV.COLLECT, { kind: 'gem', value: gems });   // the feed's "+25 gems" line and the gem sound
    this.ui.selfFloater('Secret found ' + secrets.count(S) + '/' + SECRETS.length, '#c8fbff');   // the gems are the feed's (EV.COLLECT)
    this.ui.updateHud(S);
    this.save(true);
    return true;
  },
  /** a faint twinkle over each keepsake not found yet, only within TUNE.combat.secretFx m (a secret from afar), fewer
   *  with Motion comfort. Called with tickErrandFx (each render frame, skipped while the clock holds or a dialogue is up) */
  tickSecretFx(dt) {
    const W = this.world, S = this.S, pl = this.player, R = TC.secretFx || 6;
    if (!S || !(W.secrets && W.secrets.length)) return;
    this._secretT = (this._secretT || 0) - dt;
    if (this._secretT > 0) return;
    this._secretT = 0.4;
    const calm = this.calmFx();
    for (const it of W.secrets) {
      if (secrets.got(S, it.id) || len2(it.x - pl.pos.x, it.z - pl.pos.z) > R) continue;
      if (Math.random() < (calm ? 0.25 : 0.7)) this.fx.sparkle(it.x + rand(-0.15, 0.15), it.y + rand(0.3, 0.6), it.z + rand(-0.15, 0.15), pick([0xfff4a0, 0xb8fff0]), 1, 0.25);
    }
  },
  buy(it) {
    const S = this.S;
    S.coins -= it.price;
    let msg = '';
    if (it.id === 'potion') { S.potions++; msg = 'A potion! Bottoms up, later.'; }
    if (it.id === 'heart') { S.shopHeart = true; S.maxHp = Math.min(CFG.maxHp, S.maxHp + 2); S.hp = S.maxHp; msg = 'Max hearts +1! Purr-fect.'; sfx('fanfare'); }
    if (it.id === 'sword') { S.swordLevel = 2; this.player.setSword(2); msg = 'The Shiny Sword! Swish swish~'; sfx('fanfare'); }
    if (it.boss) { S.plushies = { ...(S.plushies || {}), [it.boss]: true }; this.scenery.setPlushie(it.boss, true); msg = it.got; sfx('fanfare'); }   // data.js PLUSHIES: it sits on Miso's counter at once
    this.ui.updateHud(S);
    return msg;
  },
  openChest(c) {
    const S = this.S;
    if (S.chests[c.id] || c._opening) return;
    c._opening = true;                 // in its lid beat: not offered again; S.chests is set only with the reward
    this.scenery.setChestOpen(c.id, true);
    sfx('chest');
    this.events.emit(EV.CHEST_OPEN, { chest: c });
    this.fx.burst(c.x, c.y + 0.8, c.z, 0xfff4a0, 16, 3);
    this.player.frozen = true;
    // the lid's beat: 420 ms of sim time (pauses with the world), then the reward. A beat that never finishes (Save & Quit
    // during it, a session change) grants nothing and leaves the chest closed in the save, so a heart container is never
    // saved as taken without its max-heart bonus
    this.later(0.42, () => {
      c._opening = false;
      this.player.frozen = false;
      if (this.state !== 'play' || this.leaving) return;
      S.chests[c.id] = true;
      if (c.kind === 'heart') {
        sfx('fanfare');
        S.maxHp = Math.min(CFG.maxHp, S.maxHp + 2);
        S.hp = S.maxHp;
        this.itemGet(heartContainerBuilt(), 'heart_container', ['You found a Heart Container!', 'Your max hearts grew by one, and you feel all warm and full.'], () => this.ui.bumpHearts());
      } else {
        const n = Math.max(2, Math.round(c.amount / 5));
        for (let i = 0; i < n; i++) this.pickups.push(new Pickup('gem', c.x, c.z, { value: 5, vy: rand(5, 8), spread: rand(1, 2.4) }));
        // TP: over the lid; FP: the feed (a world floater rises out of the eye-level view within a fraction of a second)
        if (this.view.bodyOut) this.ui.floater(_v.set(c.x, c.y + 0.9, c.z), '+' + n * 5 + ' gems!', '#bff6ff', 22);
        else this.ui.selfFloater('+' + n * 5 + ' gems!', '#bff6ff', 22);
      }
      this.save(true);
    }, () => { c._opening = false; this.player.frozen = false; });
  },
  usePedestal() {
    const S = this.S;
    const carried = SEED_ORDER.filter((id) => S.seeds[id] === 1);
    const placed = progress.placed(S);
    if (!carried.length) {
      if (placed >= 3) this.ui.say(['The three Starseeds hum happily in their sockets. The Great Tree is thriving!'], { name: 'Pedestal' });
      else this.ui.say(['A mossy stone pedestal with three little star-shaped sockets.', placed + ' of 3 Starseeds are home. ' + (placed === 0 ? 'The grumpy guardians still have them...' : 'Find the rest, Pip!')], { name: 'Pedestal' });
      return;
    }
    this.startPlace(carried);   // cutscenes.js: staging, camera and the placing itself
  },
};
