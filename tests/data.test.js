// Sanity checks for the content tables in js/data.js. Run with `bun test`.
import { expect, test } from 'bun:test';
import { BOSSES, CATCHER_TALK, CFG, ENEMY, ERRANDS, HANDOVER, NPCS, REASONS, REGIONS, SEED_ORDER, SEEDS, SHOP, errands, reasonFor } from '../js/data.js';
import { freshState } from '../js/save.js';

test('every enemy in a region spawn table exists in ENEMY', () => {
  for (const r of REGIONS) {
    for (const [type, weight] of r.enemies) {
      expect({ region: r.id, type, known: type in ENEMY }).toEqual({ region: r.id, type, known: true });
      expect(weight).toBeGreaterThan(0);
    }
  }
});

test('enemy definitions have positive hp and radius', () => {
  for (const [type, def] of Object.entries(ENEMY)) {
    expect({ type, hp: def.hp > 0, r: def.r > 0 }).toEqual({ type, hp: true, r: true });
  }
});

test('shop items have unique ids and positive prices', () => {
  expect(new Set(SHOP.map((s) => s.id)).size).toBe(SHOP.length);
  for (const item of SHOP) {
    expect(Number.isFinite(item.price)).toBe(true);
    expect(item.price).toBeGreaterThan(0);
  }
});

test('each starseed has a boss and a region', () => {
  const regionIds = REGIONS.map((r) => r.id);
  for (const key of SEED_ORDER) {
    expect(SEEDS[key]).toBeDefined();
    expect(BOSSES[key]).toBeDefined();
    expect(regionIds).toContain(key);
  }
});

test('the default seed is a positive integer', () => {
  expect(Number.isInteger(CFG.seed)).toBe(true);
  expect(CFG.seed).toBeGreaterThan(0);
});

test('the ERRANDS table is well-formed', () => {
  expect(ERRANDS.length).toBeGreaterThan(0);
  expect(new Set(ERRANDS.map((e) => e.id)).size).toBe(ERRANDS.length);
  const npcIds = NPCS.map((n) => n.id), regionIds = REGIONS.map((r) => r.id);
  for (const e of ERRANDS) {
    expect(typeof e.id).toBe('string');
    expect(npcIds).toContain(e.npc);
    expect(regionIds).toContain(e.region);
    expect(Number.isInteger(e.count) && e.count > 0).toBe(true);
    expect(typeof e.unlock).toBe('function');
    expect(e.reward.gems).toBeGreaterThan(0);
    expect(typeof e.name === 'string' && e.name.length > 0).toBe(true);
    expect(typeof e.hint === 'string' && e.hint.length > 0).toBe(true);
    expect(['use', 'walk']).toContain(e.how);
    expect(typeof e.list === 'string' && typeof e.item === 'string').toBe(true);
    for (const k of ['startToast', 'allToast', 'itemLabel']) expect(typeof e[k] === 'string' && e[k].length > 0).toBe(true);
    expect(errands.forItem(e.item)).toBe(e);
    expect(errands.forNpc(e.npc)).toBe(e);
  }
  // item ids share the save's errand item flags (S.shells): no two errands may name the same one
  const ids = ERRANDS.flatMap((e) => errands.items(e));
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(ERRANDS.map((e) => e.item)).size).toBe(ERRANDS.length);
  expect(new Set(ERRANDS.map((e) => e.list)).size).toBe(ERRANDS.length);
  expect(errands.get('clover')).toMatchObject({ npc: 'clover', region: 'shores', count: 5, reward: { gems: 50 } });
  expect(errands.items(errands.get('clover'))).toEqual(['shell1', 'shell2', 'shell3', 'shell4', 'shell5']);
  expect(errands.get('ribbit')).toMatchObject({ npc: 'ribbit', region: 'village', item: 'lantern', list: 'lanterns', how: 'walk', keep: true, follow: true, count: 4, reward: { gems: 50 } });
  expect(errands.items(errands.get('ribbit'))).toEqual(['lantern1', 'lantern2', 'lantern3', 'lantern4']);
  expect(errands.get('clover')).toMatchObject({ item: 'shell', list: 'shells', how: 'use' });
  expect(errands.get('clover').keep).toBeFalsy();
  expect(errands.get('clover').follow).toBeFalsy();
});

const clover = NPCS.find((n) => n.id === 'clover');
const save = (patch = {}) => ({ ...freshState(CFG.seed), ...patch });
const pinched = (patch = {}) => save({ bosses: { shores: true }, ...patch });
const allShells = { shell1: true, shell2: true, shell3: true, shell4: true, shell5: true };

test("before Captain Pinch is beaten, Clover's lines are unchanged and the errand stays locked", () => {
  const S = save({ errands: {} });
  expect(clover.lines(S)).toEqual([
    'Going to the Sunny Shores? Follow this path south to the sea. Captain Pinch\'s cove is at its very end, just past the striped lighthouse on the beach, and he charges in a straight line like a runaway cart!',
    'When a glowing stripe runs across the sand in front of him, that is where he will charge. Sidestep out of it, or {dash} sideways, and he bonks the arena wall. Dizzy crab, free hits!',
    'Little crabs raise their claws before they charge. Step aside, then bonk them while they catch their breath. A big third swing knocks their claws right open!',
  ]);
  expect(errands.talk(S, errands.get('clover'))).toBeNull();
  expect(S.errands).toEqual({});
});

test("Clover's lines are short, non-empty strings in every errand state", () => {
  const states = [
    save(), pinched(), pinched({ errands: { clover: 1 } }), pinched({ errands: { clover: 1 }, shells: { shell1: true } }),
    pinched({ errands: { clover: 1 }, shells: { shell1: true, shell2: true, shell3: true, shell4: true } }),
    pinched({ errands: { clover: 1 }, shells: allShells }), pinched({ errands: { clover: 2 }, shells: allShells }),
    pinched({ errands: { clover: 2 }, shells: allShells, ending: true }),
  ];
  const seen = new Set();
  for (const S of states) {
    const lines = clover.lines(S);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(typeof l === 'string' && l.length > 0).toBe(true);
    if (S.bosses.shores) for (const l of lines) expect(l.length).toBeLessThanOrEqual(150);   // the new lines stay short
    seen.add(lines.join('|'));
  }
  expect(seen.size).toBe(states.length);   // every state says something different
  expect(clover.lines(pinched({ errands: { clover: 1 }, shells: { shell1: true, shell3: true } }))[0]).toBe('2 of 5 rainbow shells! Keep looking, Pip!');
  expect(clover.lines(pinched({ errands: { clover: 2 }, ending: true })).join(' ')).toContain('Great Tree');
});

test("Clover's errand: start, pick up every shell once, finish once with the reward", () => {
  const e = errands.get('clover'), S = pinched({ coins: 7 });
  expect(errands.pick(S, e, 'shell1')).toBeNull();                 // not out before the errand starts
  expect(errands.talk(S, e)).toBe('start');
  expect(S.errands).toEqual({ clover: 1 });
  expect(errands.talk(S, e)).toBeNull();                           // no shells yet: just cheering
  expect(errands.pick(S, e, 'shell3')).toBe(1);
  expect(errands.pick(S, e, 'shell3')).toBeNull();                 // already picked up
  expect(errands.pick(S, e, 'shell9')).toBeNull();                 // not one of hers
  for (const id of ['shell1', 'shell2', 'shell4']) errands.pick(S, e, id);
  expect(errands.found(S, e)).toBe(4);
  expect(errands.talk(S, e)).toBeNull();
  expect(errands.pick(S, e, 'shell5')).toBe(5);
  expect(errands.talk(S, e)).toBe('done');
  expect(S.errands.clover).toBe(2);
  expect(S.coins).toBe(57);
  expect(errands.talk(S, e)).toBeNull();                           // no second reward
  expect(S.coins).toBe(57);
  expect(errands.done(S)).toBe(1);
});

test("Clover's shells show only while they are out; picking one up hides it and never touches a lantern", () => {
  const e = errands.get('clover'), S = pinched({ errands: { clover: 1 } });
  expect(errands.itemShown(S, e, 'shell1')).toBe(true);
  errands.pick(S, e, 'shell1');
  expect(errands.itemShown(S, e, 'shell1')).toBe(false);
  expect(errands.itemFound(S, e, 'shell1')).toBe(true);
  expect(errands.following(S, e)).toBe(false);   // Clover never follows
  expect(Object.keys(S.shells)).toEqual(['shell1']);
});

const ribbit = NPCS.find((n) => n.id === 'ribbit');
const bloomed = (patch = {}) => save({ ending: true, bosses: { woods: true, peaks: true, shores: true }, seeds: { woods: 2, peaks: 2, shores: 2 }, ...patch });
const allLanterns = { lantern1: true, lantern2: true, lantern3: true, lantern4: true };

test("before the bloom, Mayor Ribbit's lines are unchanged and the parade stays locked", () => {
  const e = errands.get('ribbit');
  expect(ribbit.lines(save())).toEqual([
    'Ribbit! Welcome, welcome! Mayor Ribbit, at your service. Best lily pad in town, ask anyone.',
    'Every corner of our isle has something tall to aim for. North, a giant purple mushroom pokes over the Whispering Woods.',
    'East, over the river bridge, a frosty crystal twinkles on top of Frostcap Peaks. South, a striped lighthouse watches the Sunny Shores.',
    'And west, a windmill turns over Bloom Meadow. No guardian there, just flowers and secrets. Lots of secrets. Croak.',
  ]);
  expect(ribbit.lines(save({ seeds: { woods: 1, peaks: 0, shores: 0 } }))).toEqual(['One Starseed back already? I hereby declare a holiday! ...Right after the other two.']);
  expect(ribbit.lines(save({ seeds: { woods: 2, peaks: 1, shores: 0 } }))).toEqual(['Two down! I have been practising my victory croak. RIBBIT! ...It needs work.']);
  expect(ribbit.lines(save({ seeds: { woods: 2, peaks: 2, shores: 1 } }))).toEqual(['All three! Quick, put them on the pedestal! I want to see the Tree bloom before my nap.']);
  // every guardian beaten and every Starseed placed, but the ending not played: still locked
  const S = save({ bosses: { woods: true, peaks: true, shores: true }, seeds: { woods: 2, peaks: 2, shores: 2 } });
  expect(errands.talk(S, e)).toBeNull();
  expect(S.errands).toEqual({});
  for (const id of errands.items(e)) expect(errands.itemShown(S, e, id)).toBe(false);
});

test("Mayor Ribbit's lines are short, non-empty strings in every parade state", () => {
  const e = errands.get('ribbit');
  const states = [
    bloomed(), bloomed({ errands: { ribbit: 1 } }), bloomed({ errands: { ribbit: 1 }, shells: { lantern2: true } }),
    bloomed({ errands: { ribbit: 1 }, shells: { lantern1: true, lantern2: true, lantern3: true } }),
    bloomed({ errands: { ribbit: 1 }, shells: allLanterns }), bloomed({ errands: { ribbit: 2 }, shells: allLanterns }),
  ];
  const seen = new Set();
  for (const S of states) {
    const lines = ribbit.lines(S);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(typeof l === 'string' && l.length > 0 && l.length <= 155).toBe(true);
    seen.add(lines.join('|'));
  }
  expect(seen.size).toBe(states.length);
  expect(ribbit.lines(bloomed())[0]).toBe('A blooming Great Tree! This calls for a parade. You lead, I will hop behind.');
  expect(ribbit.lines(bloomed())).toContain(e.hint);                 // he says where the lanterns are
  expect(ribbit.lines(bloomed({ errands: { ribbit: 1 }, shells: { lantern1: true, lantern4: true } }))[0]).toBe('2 of 4 lanterns lit! Lead on, Pip!');
  expect(ribbit.lines(bloomed({ errands: { ribbit: 1 }, shells: { lantern1: true, lantern2: true, lantern4: true } }))[0]).toBe('3 of 4 lanterns lit! Just one more!');
  expect(ribbit.lines(bloomed({ errands: { ribbit: 1 }, shells: allLanterns })).join(' ')).toContain('victory croak finally works');
  // Clover's rainbow shells never count as lanterns
  expect(errands.found(bloomed({ errands: { ribbit: 1 }, shells: { shell1: true, shell2: true, shell3: true, shell4: true } }), e)).toBe(0);
});

test("Ribbit's parade: unlocked by the bloom, he follows while lanterns are left, each lights once, the reward is paid once", () => {
  const e = errands.get('ribbit'), S = bloomed({ coins: 3 });
  expect(errands.following(S, e)).toBe(false);
  expect(errands.pick(S, e, 'lantern1')).toBeNull();               // nothing to light before the parade starts
  expect(errands.talk(S, e)).toBe('start');
  expect(S.errands).toEqual({ ribbit: 1 });
  expect(errands.following(S, e)).toBe(true);
  for (const id of errands.items(e)) expect([errands.itemShown(S, e, id), errands.itemFound(S, e, id)]).toEqual([true, false]);
  expect(errands.talk(S, e)).toBeNull();                           // mid-parade: just cheering
  expect(errands.pick(S, e, 'lantern3')).toBe(1);
  expect(errands.pick(S, e, 'lantern3')).toBeNull();               // lighting is idempotent
  expect(errands.pick(S, e, 'shell1')).toBeNull();                 // not one of his
  expect(errands.pick(S, e, 'lantern5')).toBeNull();
  expect([errands.itemShown(S, e, 'lantern3'), errands.itemFound(S, e, 'lantern3')]).toEqual([true, true]);   // a lit lantern stays
  errands.pick(S, e, 'lantern1'); errands.pick(S, e, 'lantern2');
  expect(errands.following(S, e)).toBe(true);
  expect(errands.talk(S, e)).toBeNull();
  expect(errands.pick(S, e, 'lantern4')).toBe(4);
  expect(errands.following(S, e)).toBe(false);                     // all lit: he heads home
  expect(errands.talk(S, e)).toBe('done');
  expect(S.errands.ribbit).toBe(2);
  expect(S.coins).toBe(53);
  expect(errands.talk(S, e)).toBeNull();                           // no second reward
  expect(S.coins).toBe(53);
  expect(errands.following(S, e)).toBe(false);
  for (const id of errands.items(e)) expect([errands.itemShown(S, e, id), errands.itemFound(S, e, id)]).toEqual([true, true]);
  expect(Object.keys(S.shells).sort()).toEqual(['lantern1', 'lantern2', 'lantern3', 'lantern4']);
  expect(errands.done(S)).toBe(1);
  S.errands.clover = 2;
  expect(errands.done(S)).toBe(2);
});

test("Elder Shellby's intro is short and keeps its story; his first hints keep what the cut pages taught", () => {
  const sh = NPCS.find((n) => n.id === 'shellby');
  const intro = sh.intro.join(' ');
  expect(sh.intro.length).toBeGreaterThan(0);
  expect(sh.intro.length).toBeLessThanOrEqual(3);
  expect(intro).toContain('sneeze');
  for (const [boss, region, dir] of [['Grumble Shroom', 'Whispering Woods', 'north'], ['Frostbun', 'Frostcap Peaks', 'east'], ['Captain Pinch', 'Sunny Shores', 'south']]) {
    expect(intro).toContain(boss);
    expect(intro).toContain(region);
    expect(intro).toContain(dir);
  }
  expect(sh.intro[sh.intro.length - 1]).toEndWith('Off you sprout!');
  // the cut pages' facts, in his lines before any Starseed is found: the Great Tree to steer by, the compass, the
  // signpost, Miso's potions
  const first = sh.lines(freshState(CFG.seed)).join(' ');
  for (const fact of ['Great Tree', 'compass', 'signpost', 'Miso sells potions']) expect(first).toContain(fact);
});

test('the Catchers\' reasons (REASONS): three Look lines, one per Catcher, each ≤ 220 characters with its text id', () => {
  expect(REASONS.map((r) => r.t)).toEqual(['home.reason.grumble', 'home.reason.pinch', 'home.reason.frost']);
  expect(REASONS.map((r) => r.boss).sort()).toEqual(Object.keys(BOSSES).sort());
  for (const r of REASONS) {
    expect(typeof r.text === 'string' && r.text.length > 0).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(220);
    expect(typeof r.name === 'string' && r.name.length > 0).toBe(true);
  }
  // only the middle night-light, the tally and the cradle answer Look
  expect(reasonFor({ id: 'home:reason-grumble-2', kind: 'nightlight' })).toBe(REASONS[0]);
  expect(reasonFor({ id: 'home:reason-grumble-1', kind: 'nightlight' })).toBeNull();
  expect(reasonFor({ id: 'home:reason-pinch-tally', kind: 'tally' })).toBe(REASONS[1]);
  expect(reasonFor({ id: 'home:reason-frost-cradle', kind: 'cradle' })).toBe(REASONS[2]);
  for (const kind of ['rings', 'spyglass', 'scarf']) expect(reasonFor({ id: 'x', kind })).toBeNull();
});

// the key tokens a player-facing line may carry (js/hud/keys.js header, contract C7)
const KEY_TOKENS = ['move', 'look', 'attack', 'jump', 'dash', 'sprint', 'interact', 'potion', 'view', 'shoulder', 'lock', 'map', 'pause', 'roll', 'lockon', 'use', 'swing', 'hop', 'zoom', 'camera', 'ok', 'back', 'tabPrev', 'tabNext'];
test('the Catchers\' handover (HANDOVER, CATCHER_TALK): Grumble\'s three lines and his Talk lines, each ≤ 220 characters with its text id and known tokens only', () => {
  expect(Object.keys(HANDOVER)).toEqual(['woods']);   // Pinch and Frostbun keep the shipped burst until S-006
  expect(Object.keys(CATCHER_TALK)).toEqual(['woods']);
  expect(HANDOVER.woods.map((l) => l.t)).toEqual(['home.handover.woods.1', 'home.handover.woods.2', 'home.handover.woods.3']);
  expect(CATCHER_TALK.woods.placed.map((l) => l.t)).toEqual(['home.catcher.woods.placed']);
  expect(CATCHER_TALK.woods.before.map((l) => l.t)).toEqual(['home.catcher.woods.before.1', 'home.catcher.woods.before.2']);
  const lines = [...HANDOVER.woods, ...CATCHER_TALK.woods.placed, ...CATCHER_TALK.woods.before];
  for (const id of Object.keys(HANDOVER)) expect(BOSSES[id]).toBeDefined();
  for (const l of lines) {
    expect(typeof l.text === 'string' && l.text.length > 0).toBe(true);
    expect(l.text.length).toBeLessThanOrEqual(220);
    // braces only as known key tokens (contract C7, js/hud/keys.js); no "defeat" (Tone)
    for (const m of l.text.matchAll(/\{([a-zA-Z]*)\}/g)) expect(KEY_TOKENS).toContain(m[1]);
    expect(l.text.replace(/\{[a-zA-Z]+\}/g, '')).not.toMatch(/[{}]/);
    expect(l.text).not.toMatch(/defeat/i);
  }
  expect(HANDOVER.woods[0].text).toBe('Hmph. Fine. FINE. Take it.');
  expect(HANDOVER.woods[2].text).toBe('Bring it home. Tell her Grumble kept it warm.');
});
