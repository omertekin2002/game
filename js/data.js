// Tunables + content tables: regions, enemies, bosses, NPC dialogue, shop, signs.
export const CFG = {
  seed: 7151,
  playerSpeed: 4.4,            // base run (RULINGS); the movement numbers live in TUNE.move (WP3)
  playerAccel: 38,
  playerDecel: 30,
  playerR: 0.32,
  swingTime: 0.3,
  reachWood: 1.6,
  reachShiny: 2.0,
  dashTime: 0.2,
  dashSpeed: 13,
  dashCooldown: 0.55,
  hurtIframes: 1.0,
  startHp: 6,
  maxHp: 20,
  potionMax: 3,
  pickupMagnet: 2.5,
  pickupLife: 12,
  dayLength: 480,
  startTimeOfDay: 0.4,
  autosave: 30,
  maxEnemies: 8,
  spawnMinDist: 14,
  despawnDist: 44,
  bushRespawn: 180,
  grassRespawn: 120,
  potRespawn: 240,
};

// The storage key stays fixed so existing saves keep loading. The save's schema version is its `v` field
// (SAVE_VERSION in js/save.js), not the "v2" in this name: bump SAVE_VERSION and add a migration instead.
export const SAVE_KEY = 'starseed-isle-save-v2';
// The untouched save string from before its last migration (js/game.js continueGame writes it; nothing reads it yet)
export const SAVE_BAK_KEY = 'starseed-isle-save-v2-bak';

export const REGION = { VILLAGE: 0, WOODS: 1, PEAKS: 2, SHORES: 3, MEADOW: 4 };
export const REGIONS = [
  { id: 'village', name: 'Sprout Village', sub: 'Home of the Great Tree', music: 'village', ambient: 'fluff', enemies: [], max: 0 },
  { id: 'woods', name: 'Whispering Woods', sub: 'Mind the mushrooms', music: 'woods', ambient: 'leaves', enemies: [['mushroom', 4], ['bat', 3], ['slime', 3]], max: 7 },
  { id: 'peaks', name: 'Frostcap Peaks', sub: 'Bring a scarf!', music: 'peaks', ambient: 'snow', enemies: [['snowpuff', 1]], max: 6 },
  { id: 'shores', name: 'Sunny Shores', sub: 'Sand, sea and snippy crabs', music: 'shores', ambient: 'sea', enemies: [['crab', 1]], max: 6 },
  { id: 'meadow', name: 'Bloom Meadow', sub: 'Flowers, ponds and secrets', music: 'meadow', ambient: 'butterflies', enemies: [['bee', 3], ['slime', 4]], max: 6 },
];

// name: the HUD's display name (C5); emerge: how a visible spawn appears (C16, 'spawn' → this)
export const ENEMY = {
  slime: { hp: 2, r: 0.42, flying: false, name: 'Jelly Slime', emerge: 'ground' },
  mushroom: { hp: 3, r: 0.42, flying: false, name: 'Grumpy Shroomlet', emerge: 'ground' },
  bat: { hp: 1, r: 0.38, flying: true, name: 'Dozy Bat', emerge: 'sky' },
  bee: { hp: 2, r: 0.36, flying: true, name: 'Buzzy Bee', emerge: 'bush' },
  crab: { hp: 3, r: 0.48, flying: false, name: 'Snippy Crab', emerge: 'ground' },
  snowpuff: { hp: 2, r: 0.45, flying: true, name: 'Snowpuff', emerge: 'sky' },
};

export const SEED_ORDER = ['woods', 'peaks', 'shores'];
export const SEEDS = {
  woods: { key: 'seed_forest', name: 'Woods Starseed', color: 0x9be86a, glow: 0xc8ff8a, css: '#8be07a' },
  peaks: { key: 'seed_frost', name: 'Frost Starseed', color: 0x8fd8ff, glow: 0xc8f0ff, css: '#9fdcff' },
  shores: { key: 'seed_sea', name: 'Sea Starseed', color: 0xff9f9a, glow: 0xffd0c8, css: '#ff9f8f' },
};

export const BOSSES = {
  woods: { name: 'Grumble Shroom', title: 'Grumpy Guardian of the Whispering Woods', key: 'boss_shroom', hp: 48 },
  shores: { name: 'Captain Pinch', title: 'Snippy Skipper of the Sunny Shores', key: 'boss_crab', hp: 48 },
  peaks: { name: 'Frostbun', title: 'Chilly Champion of Frostcap Peaks', key: 'boss_frost', hp: 50 },
};

// Guardian rematches after the bloom (opt-in: a napping guardian is woken with Use, never by walking in). Harder, still
// fair: hpK × its first-fight HP (rounded: 48 → 60, Frostbun 50 → 63), enraged from `enrage` of its HP (first fights:
// half), the same moves and wind-ups. The first rematch win per guardian gives `gems` once (S.rematches[id], save v5);
// no Starseed drops. js/fight.js runs it, js/bosses.js reads the numbers
export const REMATCH = { hpK: 1.25, enrage: 0.75, gems: 40 };

export const SHOP = [
  { id: 'potion', name: 'Potion', price: 25, icon: 'potion', desc: 'Heals every heart. Carry up to 3.' },
  { id: 'heart', name: 'Heart Container', price: 120, icon: 'heart_container', desc: '+1 max heart. Only one in stock!' },
  { id: 'sword', name: 'Shiny Sword', price: 150, icon: 'sword_shiny', desc: 'Double damage, longer reach, extra sparkly.' },
];

// Miso's keepsakes: one plushie per guardian (BOSSES key `boss`), a gem sink once the shop is bought out. In stock once
// the Heart Container and the Shiny Sword are both sold and its guardian is beaten; one of each. A bought one is a flag in
// the save (S.plushies[boss] = true, save v4) and sits on Miso's counter (scenery.setPlushie). Same order as BOSSES
export const PLUSHIES = [
  { id: 'plush_woods', boss: 'woods', name: 'Grumble Shroom plushie', price: 80, icon: 'boss_shroom', desc: 'Squishy, and only a little grumpy. Stitched by Miso.', got: 'A Grumble Shroom plushie! He is grumbling softly. Mrrow~' },
  { id: 'plush_shores', boss: 'shores', name: 'Captain Pinch plushie', price: 80, icon: 'boss_crab', desc: 'Felt claws and a tiny hat. Only pinches hugs.', got: 'A Captain Pinch plushie! Snip snip, purr purr~' },
  { id: 'plush_peaks', boss: 'peaks', name: 'Frostbun plushie', price: 80, icon: 'boss_frost', desc: 'Cool to the touch, warm to the heart.', got: 'A Frostbun plushie! Brr-illiant. Mrrow~' },
];

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const beaten = (S, id) => isObj(S && S.bosses) && S.bosses[id] === true;
const plushGot = (S, id) => isObj(S && S.plushies) && S.plushies[id] === true;
/** Miso's stock rules, pure so `bun test` covers them: ui.js renders and navigates shop.items(S) and buys through
 *  shop.check, interact.js (buy) applies a purchase */
export const shop = {
  /** the plushies unlock once the Heart Container and the Shiny Sword are both sold */
  boughtOut: (S) => !!S && S.shopHeart === true && S.swordLevel >= 2,
  /** the rows to show, in order: the three base items, then a plushie per beaten guardian once the shop is bought out */
  items: (S) => (shop.boughtOut(S) ? SHOP.concat(PLUSHIES.filter((p) => beaten(S, p.boss))) : SHOP.slice()),
  /** 'ok' (can be bought) | 'sold' (one of a kind, already bought) | 'full' (potion pockets full) */
  state(item, S) {
    if (item.id === 'potion') return S.potions >= CFG.potionMax ? 'full' : 'ok';
    if (item.id === 'heart') return S.shopHeart ? 'sold' : 'ok';
    if (item.id === 'sword') return S.swordLevel >= 2 ? 'sold' : 'ok';
    if (item.boss) return plushGot(S, item.boss) ? 'sold' : 'ok';
    return 'ok';
  },
  /** why a buy is refused ('sold' | 'full' | 'poor', a missing gem count is poor) or 'ok' */
  check(item, S) {
    const st = shop.state(item, S);
    if (st !== 'ok') return st;
    return (S.coins || 0) < item.price ? 'poor' : 'ok';
  },
  /** plushies bought (the tracker's row): only guardian ids, only true flags */
  plushies: (S) => PLUSHIES.filter((p) => plushGot(S, p.boss)).length,
  /** plushies on sale right now (shown and not bought yet) */
  inStock: (S) => shop.items(S).filter((it) => it.boss && !plushGot(S, it.boss)).length,
};

/** guardian rematch rules, pure so `bun test` covers them (fight.js applies them) */
export const rematch = {
  /** a guardian naps in its arena for a rematch: after the ending, once it is beaten (it always is by then) */
  available: (S, id) => !!S && S.ending === true && Object.hasOwn(BOSSES, id) && beaten(S, id),
  /** a rematch guardian's HP: REMATCH.hpK × its first-fight HP, rounded */
  hp: (id) => Math.round(BOSSES[id].hp * REMATCH.hpK),
  /** has Pip won this guardian's rematch (its one-time reward taken) */
  won: (S, id) => isObj(S && S.rematches) && S.rematches[id] === true,
  /** rematches won (the tracker's row): only guardian ids, only true flags */
  count: (S) => Object.keys(BOSSES).filter((id) => rematch.won(S, id)).length,
  /** a rematch win: the first one per guardian sets S.rematches[id] and adds REMATCH.gems to S.coins → the gems given
   *  (0 on a repeat win, which changes nothing). Mutates S */
  win(S, id) {
    if (!Object.hasOwn(BOSSES, id) || rematch.won(S, id)) return 0;
    S.rematches = { ...(isObj(S.rematches) ? S.rematches : {}), [id]: true };
    S.coins = (S.coins || 0) + REMATCH.gems;
    return REMATCH.gems;
  },
};

// Landmark keepsakes: one small hidden thing tucked round the back of each region landmark (W.landmarks id `landmark`;
// the Great Tree has none). World.placeSecrets puts each just outside its landmark's collider ring, on the side away
// from the region's path (the lighthouse's: toward the sea); the cairn's needle summit is too steep to walk up to, so
// its stone sits as close below it as Pip can stand. Use reads its lines like a sign and gives `gems` once;
// found ones are flags in the save (S.secrets[id] = true, save v6). Nothing on the compass or the map points at them;
// Digby hints at them once the first Starseed is home.
//  verb / label: the crosshair prompt ('Look · Something glowing': the name stays a surprise until it is read); keep: stays in the
//  world once found, in its opened look (the bottle), instead of disappearing
export const SECRETS = [
  {
    id: 'acorn', landmark: 'woods', name: 'Glowing acorn', label: 'Something glowing', verb: 'Look', gems: 25,
    lines: ['A little acorn, glowing softly, tucked in a hollow of the giant mushroom\'s roots.', 'Long ago, the Great Tree dropped acorns like this one all over the isle. This one never quite fell asleep.'],
  },
  {
    id: 'stone', landmark: 'peaks', name: 'Humming crystal stone', label: 'Something humming', verb: 'Look', gems: 25,
    lines: ['A loose crystal stone that rolled down from the cairn, humming a slow, sleepy tune. It sounds a lot like the Starseeds do.', 'Scratched on its back, very small: "We carried the first Starseed up here to see the stars. It liked them."'],
  },
  {
    id: 'bottle', landmark: 'shores', name: 'Message in a bottle', label: 'A bottle', verb: 'Open', gems: 25, keep: true,
    lines: ['A message in a bottle, wedged against the lighthouse wall on the sea side! The paper inside is salty and curled.', '"To whoever finds this: the Great Tree sneezes about once every hundred years. Keep a hanky handy. P.S. The crabs are friendlier than they look."'],
  },
  {
    id: 'pouch', landmark: 'meadow', name: 'Tiny seed pouch', label: 'A tiny pouch', verb: 'Look', gems: 25,
    lines: ['A tiny seed pouch, tucked against the windmill\'s stone footing. The stitching says "For Spring".', 'The seeds inside are the same gold as the Great Tree\'s blossoms. Someone has been planting little bits of the Tree all over the meadow.'],
  },
];
/** the Catchers' kind reasons, seen beside their arenas before the fight (S-004, world.js placeReasons; story.md #I.2):
 *  the `[E] Look` text on each Catcher's main prop. `kind` is the W.reasons item that answers Look (the middle
 *  night-light, the door tally, the snow cradle); `t` is the text id. Reading sets no flag and gives nothing */
export const REASONS = [
  { id: 'grumble', boss: 'woods', kind: 'nightlight', name: 'Night-lights', t: 'home.reason.grumble', text: 'Three tiny night-lights, none of them lit. Somebody small must sleep near here.' },
  { id: 'pinch', boss: 'shores', kind: 'tally', name: 'Chalk marks', t: 'home.reason.pinch', text: 'Chalk marks on the door, one for every night. Somebody is counting.' },
  { id: 'frost', boss: 'peaks', kind: 'cradle', name: 'Snow cradle', t: 'home.reason.frost', text: 'A little nest of snow, smoothed round like a cradle. It\'s still warm in the middle.' },
];
/** the REASONS entry a W.reasons item answers Look with (only the middle night-light of Grumble's three), or null */
export const reasonFor = (it) => (it && (it.kind !== 'nightlight' || it.id === 'home:reason-grumble-2') ? REASONS.find((r) => r.kind === it.kind) || null : null);
/** landmark keepsake rules, pure so `bun test` covers them (interact.js applies a find) */
export const secrets = {
  /** the SECRETS entry with this id, or null */
  get: (id) => SECRETS.find((s) => s.id === id) || null,
  /** has Pip found this keepsake */
  got: (S, id) => isObj(S && S.secrets) && S.secrets[id] === true,
  /** keepsakes found (the tracker's row): only SECRETS ids, only true flags */
  count: (S) => SECRETS.filter((s) => secrets.got(S, s.id)).length,
  /** Pip finds a keepsake: the first time sets S.secrets[id] and adds its gems to S.coins → the gems given (0 on a
   *  repeat or an unknown id, which change nothing). Mutates S */
  find(S, id) {
    const s = secrets.get(id);
    if (!s || secrets.got(S, id)) return 0;
    S.secrets = { ...(isObj(S.secrets) ? S.secrets : {}), [id]: true };
    S.coins = (S.coins || 0) + s.gems;
    return s.gems;
  },
};

// ---------------- dialogue ----------------
const found = (S) => SEED_ORDER.filter((k) => S.seeds[k] > 0).length;
const placed = (S) => SEED_ORDER.filter((k) => S.seeds[k] === 2).length;
export const progress = { found, placed, carried: (S) => found(S) - placed(S) };

// ---------------------------------------------------------------- villager errands
// One small favour per villager, unlocked by progress. State lives in the save (js/save.js, v3): S.errands[id] is
// 0 (not started), 1 (started) or 2 (done); each item is a flag in S.shells (the save's errand item flags) under its
// world id ('shell1'…, 'lantern1'…): true once picked up / lit. Every errand item's world spots are a W list (`list`)
// from a world post-pass (World.placeShells, World.placeLanterns) naming the same places as `hint`.
//  how: 'use' — Pip picks the item up with Use (a crosshair target, the item disappears);
//       'walk' — Pip lights it by walking past (within TUNE.actors.paradeLight m) while the villager follows close
//       behind (`follow`: the villager hops after Pip while the errand is under way, js/npcs.js). `keep`: the item stays
//       in the world, shown in its done look, once found (lanterns stay lit for good).
//  startToast / allToast: the feed note when it starts / when the last item is found; itemLabel: the floater per item
export const ERRANDS = [
  {
    id: 'clover', npc: 'clover', region: 'shores', item: 'shell', list: 'shells', how: 'use', name: 'Rainbow shells', count: 5,
    unlock: (S) => !!(S.bosses && S.bosses.shores), reward: { gems: 50 },
    hint: 'One by the striped lighthouse, one on each little islet, one outside Captain Pinch\'s cove and one beside the beach path.',
    startToast: 'Find 5 rainbow shells on the Sunny Shores', allToast: 'That\'s all 5! Bring them to Clover',
    itemLabel: 'Rainbow shell', itemColor: '#ffd0f0',
  },
  {
    id: 'ribbit', npc: 'ribbit', region: 'village', item: 'lantern', list: 'lanterns', how: 'walk', keep: true, follow: true,
    name: 'Bloom parade', count: 4, unlock: (S) => !!S.ending, reward: { gems: 50 },
    hint: 'One beside the walk up to the Great Tree\'s pedestal, one by the plaza signpost, one in front of Miso\'s shop and one at the village edge on the Meadow path.',
    startToast: 'Lead Mayor Ribbit past the 4 parade lanterns', allToast: 'All 4 lanterns lit! Mayor Ribbit hops home',
    itemLabel: 'Parade lantern', itemColor: '#ffe2a8',
  },
];
const flagged = (S, k) => isObj(S && S.shells) && S.shells[k] === true;
export const errands = {
  /** the ERRANDS entry with this id (or for this NPC), or null */
  get: (id) => ERRANDS.find((e) => e.id === id) || null,
  forNpc: (npcId) => ERRANDS.find((e) => e.npc === npcId) || null,
  /** the ERRANDS entry whose world items are of this kind ('shell', 'lantern'), or null */
  forItem: (kind) => ERRANDS.find((e) => e.item === kind) || null,
  /** 0 not started, 1 started, 2 done */
  state: (S, id) => { const v = isObj(S && S.errands) ? S.errands[id] : 0; return v === 1 || v === 2 ? v : 0; },
  /** the errand's item ids, matching its W list (W.shells, W.lanterns): e.item + '1' … e.item + count */
  items: (e) => Array.from({ length: e.count }, (_, i) => e.item + (i + 1)),
  /** items found (picked up / lit) so far */
  found: (S, e) => errands.items(e).filter((k) => flagged(S, k)).length,
  /** is this world item still to find: the errand started, not finished, and the item not picked up / lit yet */
  itemOut: (S, e, itemId) => errands.state(S, e.id) === 1 && errands.items(e).includes(itemId) && !flagged(S, itemId),
  /** is this world item shown: while it is out, and for a `keep` errand also once found (from the start on, for good) */
  itemShown: (S, e, itemId) => errands.itemOut(S, e, itemId) || (!!e.keep && errands.state(S, e.id) > 0 && errands.items(e).includes(itemId)),
  /** is this world item found (picked up / lit) */
  itemFound: (S, e, itemId) => errands.items(e).includes(itemId) && flagged(S, itemId),
  /** Pip finds an item (picks it up / lights it): marks it and returns the new count, or null when it is not out (no change) */
  pick(S, e, itemId) {
    if (!errands.itemOut(S, e, itemId)) return null;
    S.shells = { ...(isObj(S.shells) ? S.shells : {}), [itemId]: true };
    return errands.found(S, e);
  },
  /** after a talk with the errand's villager: 'start' (unlocked, not started → started), 'done' (every item found →
   *  done, reward added to S.coins once) or null (no change). Mutates S */
  talk(S, e) {
    const st = errands.state(S, e.id);
    const set = (v) => { S.errands = { ...(isObj(S.errands) ? S.errands : {}), [e.id]: v }; };
    if (st === 0 && e.unlock(S)) { set(1); return 'start'; }
    if (st === 1 && errands.found(S, e) >= e.count) {
      set(2);
      S.coins = (S.coins || 0) + ((e.reward && e.reward.gems) || 0);
      return 'done';
    }
    return null;
  },
  /** should the errand's villager follow Pip now: a `follow` errand under way with an item still to find */
  following: (S, e) => !!e.follow && errands.state(S, e.id) === 1 && errands.found(S, e) < e.count,
  /** errands finished (the tracker's row) */
  done: (S) => ERRANDS.filter((e) => errands.state(S, e.id) === 2).length,
};

// WP9: lines rewritten for an eye-level game (art §14): no screen directions, compass words, landmarks you can see
// over the trees, and boss tips that match the new moves. {tokens} name controls (C7: WP6 swaps in the glyph of the
// current device at display time; a copy without WP6 shows the raw token).
export const NPCS = [
  {
    id: 'shellby', name: 'Elder Shellby', key: 'npc_turtle', wander: 0.6,
    // the opening (interact.js sessionIntro): three pages, then the coach marks. What the cut pages said lives on in
    // lines(S) below (the compass, the signpost, Miso's potions), on the compass and the controls card
    intro: [
      'Oh! Little Pip, there you are. Last night the Great Tree sneezed. A big, sad, leafy sneeze... and its three Starseeds went flying!',
      'Three grumpy guardians scooped them up: Grumble Shroom in the Whispering Woods up north, Frostbun in the Frostcap Peaks to the east, and Captain Pinch on the Sunny Shores to the south.',
      'Without its Starseeds the Tree is wilting. Bring them home to this old pedestal, in any order you like. Off you sprout!',
    ],
    lines(S) {
      // after the bloom: a pointer to the guardian rematches (REMATCH), and a thank-you once all three are won
      if (S.ending) return ['Look at her bloom... Thank you, Pip. You are the bravest little sprout on the whole isle.', 'Take your time and explore. The isle is yours to enjoy now.',
        rematch.count(S) >= Object.keys(BOSSES).length ? 'You won a friendly rematch with every guardian! They say it was the most fun they have had in a hundred years.' : 'The guardians are napping in their arenas again. Wake one if you fancy a friendly rematch!'];
      if (progress.carried(S) > 0) return ['Ooh, I can feel a Starseed humming in your pocket! Set it in a socket on the pedestal, dear. Just walk up and press {interact}.'];
      if (placed(S) > 0) return [(3 - placed(S)) + ' more to go! The Great Tree already looks a little perkier.', 'Remember: Woods to the north, Peaks to the east, Shores to the south. Just follow the letters on your compass, dear.'];
      return [
        'The Woods are north, the Peaks are east past the river, and the Shores are south. The signpost at the edge of the plaza points the way, then follow the dirt paths and the little arrow posts.',
        'Lost? Turn around until you see the Great Tree over the treetops, and walk toward it. It always brings you home, and your compass up top knows the way too.',
        'If you get bonked, Miso sells potions. And if you ever get dizzy out there, you will wake up right here by the Tree. No harm done.',
      ];
    },
  },
  {
    id: 'ribbit', name: 'Mayor Ribbit', key: 'npc_frog', wander: 2.2,
    lines(S) {
      const n = found(S);
      // after the bloom: the parade (ERRANDS 'ribbit'). These lines show the state before the talk; interact.js
      // advances it (errands.talk) and sets him following when the talk ends
      if (S.ending) {
        const e = errands.get('ribbit'), st = errands.state(S, 'ribbit'), lit = errands.found(S, e), left = e.count - lit;
        if (st === 2) return [
          'The parade lanterns will glow over Sprout Village for good. Mayor\'s orders!',
          'RIBBIT! Still works. I have been croaking all day. The ducks are jealous.',
        ];
        if (st === 1 && left <= 0) return [
          'All four lanterns glowing! Best parade this isle has ever seen.',
          'And listen: RIBBIT! ...Did you hear that? My victory croak finally works!',
          'Here, gems from the town treasury. Thank you, Pip!',
        ];
        if (st === 1) return [lit === 0 ? 'Lead on, Pip! I am right behind you. Walk past a lantern and it lights up.' : lit + ' of ' + e.count + ' lanterns lit! ' + (left === 1 ? 'Just one more!' : 'Lead on, Pip!'), e.hint];
        return [
          'A blooming Great Tree! This calls for a parade. You lead, I will hop behind.',
          'I hung four paper lanterns around the village. Walk past each one with me close behind, and it lights up!',
          e.hint,
        ];
      }
      if (n === 0) return [
        'Ribbit! Welcome, welcome! Mayor Ribbit, at your service. Best lily pad in town, ask anyone.',
        'Every corner of our isle has something tall to aim for. North, a giant purple mushroom pokes over the Whispering Woods.',
        'East, over the river bridge, a frosty crystal twinkles on top of Frostcap Peaks. South, a striped lighthouse watches the Sunny Shores.',
        'And west, a windmill turns over Bloom Meadow. No guardian there, just flowers and secrets. Lots of secrets. Croak.',
      ];
      if (n === 1) return ['One Starseed back already? I hereby declare a holiday! ...Right after the other two.'];
      if (n === 2) return ['Two down! I have been practising my victory croak. RIBBIT! ...It needs work.'];
      return ['All three! Quick, put them on the pedestal! I want to see the Tree bloom before my nap.'];
    },
  },
  {
    id: 'miso', name: 'Miso', key: 'npc_cat', wander: 0, shop: true,
    // after the bloom or before, her first line; once the shop is bought out, a line about her guardian plushies
    // (PLUSHIES): in stock, some bought, all three bought. Without plushie news her lines are unchanged
    lines(S) {
      const out = [S.ending ? 'Mrrow~ The whole isle smells like blossoms now. Business is blooming too!' : 'Mrrow~ Welcome to Miso\'s! Everything on the counter is shiny and nothing is refundable.'];
      const got = shop.plushies(S), stock = shop.inStock(S);
      if (got >= PLUSHIES.length) out.push('All three guardian plushies, sitting in a row on my counter! Grumpy, snippy, chilly... and so soft. Best customer on the isle, mrrow~');
      else if (stock > 0 && got === 0) out.push('Psst... I stitched little plushies of the guardians you calmed down. Soft as a sunny nap, and only 80 gems each~');
      else if (stock > 0) out.push('Your plushies are keeping my counter company. I have another one ready if you want it~');
      else if (got > 0) out.push('I keep your plushies right here on the counter, so the whole village can wave at them. Calm another guardian and I will stitch one more~');
      return out;
    },
  },
  {
    id: 'clover', name: 'Clover', key: 'npc_bunny', wander: 1.4,
    // after Captain Pinch: the rainbow-shell errand (ERRANDS 'clover'). These lines show the state before the talk;
    // interact.js advances it (errands.talk) when the talk ends
    lines(S) {
      if (S.bosses.shores) {
        const e = errands.get('clover'), st = errands.state(S, 'clover'), n = errands.found(S, e), left = e.count - n;
        if (st === 2) {
          const out = ['My rainbow shells are lined up on my windowsill. They glow pink when the sun goes down!', 'Shell hunting is more fun with a friend. Thanks again, Pip!'];
          if (S.ending) out.push('And now the Great Tree is blooming too. Best. Summer. Ever!');
          if (rematch.won(S, 'shores')) out.push('You beat Captain Pinch AGAIN? He says it was a friendly match. He is already practising for the next one!');
          return out;
        }
        if (st === 1 && left <= 0) return ['All five rainbow shells! They are even prettier up close.', 'I found these gems by my sandcastle. They are yours, Pip. Thank you!'];
        if (st === 1) return [n === 0 ? 'No rainbow shells yet? Look for a little sparkle on the sand!' : n + ' of ' + e.count + ' rainbow shells! ' + (left === 1 ? 'Just one more!' : 'Keep looking, Pip!'), e.hint];
        return [
          'You beat Captain Pinch?! I knew it! I bet he is only grumpy because his hat is too small.',
          'The beach is so peaceful now. Want to collect shells with me?',
          'After the last big storm, five rainbow shells washed up on the Shores. Could you find them for me?',
          e.hint + ' They sparkle!',
        ];
      }
      return [
        'Going to the Sunny Shores? Follow this path south to the sea. Captain Pinch\'s cove is at its very end, just past the striped lighthouse on the beach, and he charges in a straight line like a runaway cart!',
        'When a glowing stripe runs across the sand in front of him, that is where he will charge. Sidestep out of it, or {dash} sideways, and he bonks the arena wall. Dizzy crab, free hits!',
        'Little crabs raise their claws before they charge. Step aside, then bonk them while they catch their breath. A big third swing knocks their claws right open!',
      ];
    },
  },
  {
    id: 'hoot', name: 'Professor Hoot', key: 'npc_owl', wander: 0.9,
    lines(S) {
      if (rematch.won(S, 'woods')) return ['Remarkable! Simply remarkable! I shall write a paper: "On the Gentle Defeat of Grumble Shroom", by Pip.', 'And now a sequel: "Grumble Shroom, Once More, With Feeling". He asked me to mention he was only warming up. Hoo!'];
      if (S.bosses.woods) return ['Remarkable! Simply remarkable! I shall write a paper: "On the Gentle Defeat of Grumble Shroom", by Pip.'];
      return [
        'Hoo-hoo! Professor Hoot, scholar of the Whispering Woods. Grumble Shroom lurks at the north end, under that giant purple mushroom.',
        'When he stomps, a glowing ring rolls outward along the ground. Do not run from it. HOP right over it with {jump}, or roll straight through with {dash}! Hoo!',
        'Mushrooms puff slow, wobbly spores. Swing with {attack} when one floats up to your nose and POP! Hoo-hoo.',
      ];
    },
  },
  {
    id: 'digby', name: 'Digby', key: 'npc_mole', wander: 1.2,
    lines(S) {
      const hc = ['hc_meadow', 'hc_shores', 'hc_peaks', 'hc_woods'].filter((k) => S.chests[k]).length;
      const out = ['Oh! Did not see you there. Did not see much of anything, honestly. Digby\'s the name, digging\'s the game.'];
      if (rematch.won(S, 'peaks')) out.push('Frostbun hopped by my tunnels to say you won your rematch fair and square. Then he sat on my roof for a while. Comfy, I suppose.');
      if (!S.bosses.peaks) out.push('Frostbun loves to hop. When a pillar of light shoots up around you and something whistles overhead, LOOK UP! Then roll out of the glowing circle with {dash}, quick!');
      if (hc < 4) out.push('Psst... my tunnels rumble near four heart-shaped treasures: a ring of tall sunflowers here in the Meadow, the little islet off the western beach, a nook behind the Peaks boulders, and a hidden glade in the Woods.');
      else out.push('You found all four heart treasures? My tunnels feel so empty now. In a good way!');
      // the landmark keepsakes (SECRETS): a hint once the first Starseed is home, a thank-you once all four are found
      if (secrets.count(S) >= SECRETS.length) out.push('You found what every tall thing on this isle was keeping? Thank you, Pip. Some of those have been waiting a long, long time for somebody.');
      else if (placed(S) > 0) out.push('Every tall thing on this isle keeps something tucked round its back. Digby\'s dug near all of them.');
      out.push('Little treasure chests like to hide where the paths cannot see them. Behind houses, behind boulders... I would look there. If I could see.');
      out.push('Bushes hide gems sometimes. And sometimes they just hide more bushes.');
      return out;
    },
  },
];

export const DOOR_LINES = [
  'The door is locked. Someone inside is snoring very softly. Through the window you can see a cozy fire.',
  'A note on the door: "Gone fishing. Back... eventually."',
  'Mmm, it smells like cinnamon buns in there. The door is locked, sadly.',
  'Knock knock! ...Nobody answers. A cat yawns at you through the window.',
  'A tiny sign: "Please wipe your paws." The door is locked.',
];

// Region signs: [board title, line]. The first line of the four region entries is painted on the signpost arms
// (world-mod.js); reading the signpost gives every line. Arena and village signs show their first line on the board.
export const SIGNS = {
  woods: ['Whispering Woods', 'North along this path. Grumble Shroom\'s Hollow is at the very end, under the giant purple mushroom.'],
  peaks: ['Frostcap Peaks', 'East over the river bridge, toward the crystal twinkling on the summit. Bring a scarf!'],
  shores: ['Sunny Shores', 'South to the sea and the striped lighthouse. Mind the crabs. They mind you too.'],
  meadow: ['Bloom Meadow', 'West through the flowers to the windmill. Ponds, sunflowers, and a mole who knows things.'],
  arena_woods: ['Grumble Shroom\'s Hollow', 'NO VISITORS. This means you. (And you.)'],
  arena_peaks: ['Frostbun\'s Summit', 'Beware of bun.'],
  arena_shores: ['Captain Pinch\'s Cove', 'Trespassers will be pinched!'],
  village: ['Sprout Village', 'Home of the Great Tree. Population: cozy.'],
};
