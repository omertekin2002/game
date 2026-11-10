// Tunables + content tables: regions, enemies, bosses, NPC dialogue, shop, signs.
export const CFG = {
  seed: 7151,
  playerSpeed: 5.0,
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

export const SAVE_KEY = 'starseed-isle-save-v2';

export const REGION = { VILLAGE: 0, WOODS: 1, PEAKS: 2, SHORES: 3, MEADOW: 4 };
export const REGIONS = [
  { id: 'village', name: 'Sprout Village', sub: 'Home of the Great Tree', music: 'village', ambient: 'fluff', enemies: [], max: 0 },
  { id: 'woods', name: 'Whispering Woods', sub: 'Mind the mushrooms', music: 'woods', ambient: 'leaves', enemies: [['mushroom', 4], ['bat', 3], ['slime', 3]], max: 7 },
  { id: 'peaks', name: 'Frostcap Peaks', sub: 'Bring a scarf!', music: 'peaks', ambient: 'snow', enemies: [['snowpuff', 1]], max: 6 },
  { id: 'shores', name: 'Sunny Shores', sub: 'Sand, sea and snippy crabs', music: 'shores', ambient: 'sea', enemies: [['crab', 1]], max: 6 },
  { id: 'meadow', name: 'Bloom Meadow', sub: 'Flowers, ponds and secrets', music: 'meadow', ambient: 'butterflies', enemies: [['bee', 3], ['slime', 4]], max: 6 },
];

export const ENEMY = {
  slime: { hp: 2, r: 0.42, flying: false },
  mushroom: { hp: 3, r: 0.42, flying: false },
  bat: { hp: 1, r: 0.38, flying: true },
  bee: { hp: 2, r: 0.36, flying: true },
  crab: { hp: 3, r: 0.48, flying: false },
  snowpuff: { hp: 2, r: 0.45, flying: true },
};

export const SEED_ORDER = ['woods', 'peaks', 'shores'];
export const SEEDS = {
  woods: { key: 'seed_forest', name: 'Woods Starseed', color: 0x9be86a, glow: 0xc8ff8a, css: '#8be07a' },
  peaks: { key: 'seed_frost', name: 'Frost Starseed', color: 0x8fd8ff, glow: 0xc8f0ff, css: '#9fdcff' },
  shores: { key: 'seed_sea', name: 'Sea Starseed', color: 0xff9f9a, glow: 0xffd0c8, css: '#ff9f8f' },
};

export const BOSSES = {
  woods: { name: 'Grumble Shroom', title: 'Grumpy Guardian of the Whispering Woods', key: 'boss_shroom', hp: 24 },
  shores: { name: 'Captain Pinch', title: 'Snippy Skipper of the Sunny Shores', key: 'boss_crab', hp: 24 },
  peaks: { name: 'Frostbun', title: 'Chilly Champion of Frostcap Peaks', key: 'boss_frost', hp: 26 },
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

export const NPCS = [
  {
    id: 'shellby', name: 'Elder Shellby', key: 'npc_turtle', wander: 0.6,
    intro: [
      'Oh! Little Pip, there you are. Come close, my old shell creaks in this chilly wind.',
      'Last night the Great Tree sneezed. A big, sad, leafy sneeze... and its three Starseeds went flying!',
      'Three grumpy guardians scooped them up. Grumble Shroom in the Whispering Woods, up north...',
      '...Frostbun in the Frostcap Peaks to the east, and Captain Pinch down on the Sunny Shores to the south.',
      'Without its Starseeds the Tree is wilting. Bring them home and set them on this pedestal, would you?',
      'Go in any order you like. Follow the dirt paths, and if you get bonked, Miso sells potions. Off you sprout!',
    ],
    lines(S) {
      if (S.ending) return ['Look at her bloom... Thank you, Pip. You are the bravest little sprout on the whole isle.', 'Take your time and explore. The isle is yours to enjoy now.'];
      if (progress.carried(S) > 0) return ['Ooh, I can feel a Starseed humming in your pocket! Set it on the pedestal, dear.'];
      if (placed(S) > 0) return [(3 - placed(S)) + ' more to go! The Great Tree already looks a little perkier.', 'Remember: Woods to the north, Peaks to the east, Shores to the south.'];
      return [
        'The Woods are north, the Peaks are east past the river, and the Shores are south. Follow the dirt paths.',
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
        'North: the Whispering Woods. East, over the river bridge: Frostcap Peaks. South: the Sunny Shores.',
        'And west is Bloom Meadow. No guardian there, just flowers and secrets. Lots of secrets. Croak.',
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
      return ['Mrrow~ Welcome to Miso\'s! Everything is shiny and nothing is refundable.'];
    },
  },
  {
    id: 'clover', name: 'Clover', key: 'npc_bunny', wander: 1.4,
    lines(S) {
      if (S.bosses.shores) return [
        'You beat Captain Pinch?! I knew it! I bet he is only grumpy because his hat is too small.',
        'The beach is so peaceful now. Want to collect shells with me later?',
      ];
      return [
        'Going to the Sunny Shores? Watch out for Captain Pinch. He charges in a straight line like a runaway cart!',
        'Hop aside when he charges and he will bonk right into the arena wall. Then he is dizzy. Free hits!',
        'Little crabs raise their claws when they charge. Poke them from the side or from behind!',
      ];
    },
  },
  {
    id: 'hoot', name: 'Professor Hoot', key: 'npc_owl', wander: 0.9,
    lines(S) {
      if (S.bosses.woods) return ['Remarkable! Simply remarkable! I shall write a paper: "On the Gentle Defeat of Grumble Shroom", by Pip.'];
      return [
        'Hoo-hoo! Professor Hoot, scholar of the Whispering Woods. Grumble Shroom lurks at the north end.',
        'When he stomps, a shockwave ring rolls outward. Do not run from it. DASH right through it! Hoo!',
        'Mushrooms puff slow spores. Your sword can pop them, if you are quick about it.',
      ];
    },
  },
  {
    id: 'digby', name: 'Digby', key: 'npc_mole', wander: 1.2,
    lines(S) {
      const hc = ['hc_meadow', 'hc_shores', 'hc_peaks', 'hc_woods'].filter((k) => S.chests[k]).length;
      const out = ['Oh! Did not see you there. Did not see much of anything, honestly. Digby\'s the name, digging\'s the game.'];
      if (!S.bosses.peaks) out.push('Frostbun up in the Peaks loves to hop. Watch the shadow on the ground. That is where the big bun lands!');
      if (hc < 4) out.push('Psst... my tunnels rumble near four heart-shaped treasures: a flower ring here in the Meadow, an islet off the Shores, a nook behind the Peaks boulders, and a hidden glade in the Woods.');
      else out.push('You found all four heart treasures? My tunnels feel so empty now. In a good way!');
      out.push('Bushes hide gems sometimes. And sometimes they just hide more bushes.');
      return out;
    },
  },
];

export const DOOR_LINES = [
  'The door is locked. Someone inside is snoring very softly.',
  'A note on the door: "Gone fishing. Back... eventually."',
  'Mmm, it smells like cinnamon buns in there. The door is locked, sadly.',
  'Knock knock! ...Nobody answers. A cat yawns in the window.',
  'A tiny sign: "Please wipe your paws." The door is locked.',
];

export const SIGNS = {
  woods: ['↑ Whispering Woods', 'Grumble Shroom\'s Hollow is at the far north end.'],
  peaks: ['→ Frostcap Peaks', 'Cross the river bridge. Bring a scarf!'],
  shores: ['↓ Sunny Shores', 'Mind the crabs. They mind you too.'],
  meadow: ['← Bloom Meadow', 'Flowers, ponds, and a mole who knows things.'],
  arena_woods: ['Grumble Shroom\'s Hollow.', 'NO VISITORS. This means you. (And you.)'],
  arena_peaks: ['Frostbun\'s Summit.', 'Beware of bun.'],
  arena_shores: ['Captain Pinch\'s Cove.', 'Trespassers will be pinched!'],
  village: ['Sprout Village', 'Home of the Great Tree. Population: cozy.'],
};
