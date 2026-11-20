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

export const SHOP = [
  { id: 'potion', name: 'Potion', price: 25, icon: 'potion', desc: 'Heals every heart. Carry up to 3.' },
  { id: 'heart', name: 'Heart Container', price: 120, icon: 'heart_container', desc: '+1 max heart. Only one in stock!' },
  { id: 'sword', name: 'Shiny Sword', price: 150, icon: 'sword_shiny', desc: 'Double damage, longer reach, extra sparkly.' },
];

// ---------------- dialogue ----------------
const found = (S) => SEED_ORDER.filter((k) => S.seeds[k] > 0).length;
const placed = (S) => SEED_ORDER.filter((k) => S.seeds[k] === 2).length;
export const progress = { found, placed, carried: (S) => found(S) - placed(S) };

// ---------------------------------------------------------------- villager errands
// One small favour per villager, unlocked by progress. State lives in the save (js/save.js, v3): S.errands[id] is
// 0 (not started), 1 (started) or 2 (done); each item Pip picks up is a flag in S.shells under its world id ('shell1'…).
// World spots come from World.placeShells (W.shells), which names the same places as `hint`.
export const ERRANDS = [
  {
    id: 'clover', npc: 'clover', region: 'shores', item: 'shell', name: 'Rainbow shells', count: 5,
    unlock: (S) => !!(S.bosses && S.bosses.shores), reward: { gems: 50 },
    hint: 'One by the striped lighthouse, one on each little islet, one outside Captain Pinch\'s cove and one beside the beach path.',
  },
];
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
export const errands = {
  /** the ERRANDS entry with this id (or for this NPC), or null */
  get: (id) => ERRANDS.find((e) => e.id === id) || null,
  forNpc: (npcId) => ERRANDS.find((e) => e.npc === npcId) || null,
  /** 0 not started, 1 started, 2 done */
  state: (S, id) => { const v = isObj(S && S.errands) ? S.errands[id] : 0; return v === 1 || v === 2 ? v : 0; },
  /** the errand's item ids, matching W.shells: 'shell1' … 'shell' + count */
  items: (e) => Array.from({ length: e.count }, (_, i) => e.item + (i + 1)),
  /** items picked up so far */
  found: (S, e) => errands.items(e).filter((k) => isObj(S && S.shells) && S.shells[k] === true).length,
  /** is this world item out on the ground: the errand started, not finished, and the item not picked up yet */
  itemOut: (S, e, itemId) => errands.state(S, e.id) === 1 && errands.items(e).includes(itemId) && !(isObj(S.shells) && S.shells[itemId]),
  /** Pip picks up an item: marks it and returns the new count, or null when it is not out (no change) */
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
  /** errands finished (the tracker's row) */
  done: (S) => ERRANDS.filter((e) => errands.state(S, e.id) === 2).length,
};

// WP9: lines rewritten for an eye-level game (art §14): no screen directions, compass words, landmarks you can see
// over the trees, and boss tips that match the new moves. {tokens} name controls (C7: WP6 swaps in the glyph of the
// current device at display time; a copy without WP6 shows the raw token).
export const NPCS = [
  {
    id: 'shellby', name: 'Elder Shellby', key: 'npc_turtle', wander: 0.6,
    intro: [
      'Oh! Little Pip, there you are. Come close, my old shell creaks in this chilly wind.',
      'Last night the Great Tree sneezed. A big, sad, leafy sneeze... and its three Starseeds went flying!',
      'Three grumpy guardians scooped them up. Grumble Shroom in the Whispering Woods, up north...',
      '...Frostbun in the Frostcap Peaks to the east, and Captain Pinch down on the Sunny Shores to the south.',
      'If you ever lose your way, just look up for the Great Tree. It is the tallest thing on the whole isle! Your compass up top knows the way home too.',
      'Without its Starseeds the Tree is wilting. Bring them home and set them in the star sockets of this old pedestal, would you?',
      'Go in any order you like. The signpost at the edge of the plaza points the way, and if you get bonked, Miso sells potions. Off you sprout!',
    ],
    lines(S) {
      if (S.ending) return ['Look at her bloom... Thank you, Pip. You are the bravest little sprout on the whole isle.', 'Take your time and explore. The isle is yours to enjoy now.'];
      if (progress.carried(S) > 0) return ['Ooh, I can feel a Starseed humming in your pocket! Set it in a socket on the pedestal, dear. Just walk up and press {interact}.'];
      if (placed(S) > 0) return [(3 - placed(S)) + ' more to go! The Great Tree already looks a little perkier.', 'Remember: Woods to the north, Peaks to the east, Shores to the south. Just follow the letters on your compass, dear.'];
      return [
        'The Woods are north, the Peaks are east past the river, and the Shores are south. Follow the dirt paths and the little arrow posts.',
        'Lost? Turn around until you see the Great Tree over the treetops, and walk toward it. It always brings you home.',
        'If you ever get dizzy out there, you will wake up right here by the Tree. No harm done.',
      ];
    },
  },
  {
    id: 'ribbit', name: 'Mayor Ribbit', key: 'npc_frog', wander: 2.2,
    lines(S) {
      const n = found(S);
      if (S.ending) return ['A blooming Great Tree! This calls for a parade. You lead, I will hop behind.'];
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
    lines(S) {
      if (S.ending) return ['Mrrow~ The whole isle smells like blossoms now. Business is blooming too!'];
      return ['Mrrow~ Welcome to Miso\'s! Everything on the counter is shiny and nothing is refundable.'];
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
      if (!S.bosses.peaks) out.push('Frostbun loves to hop. When a pillar of light shoots up around you and something whistles overhead, LOOK UP! Then roll out of the glowing circle with {dash}, quick!');
      if (hc < 4) out.push('Psst... my tunnels rumble near four heart-shaped treasures: a ring of tall sunflowers here in the Meadow, the little islet off the western beach, a nook behind the Peaks boulders, and a hidden glade in the Woods.');
      else out.push('You found all four heart treasures? My tunnels feel so empty now. In a good way!');
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
