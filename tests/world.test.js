// Unit tests for deterministic island generation (js/world.js). Run with `bun test`.
import { describe, expect, test } from 'bun:test';
import { generateWorld } from '../js/world.js';
import { CFG, REGION, SECRETS, SIGNS } from '../js/data.js';
import { shapeDist } from '../js/world-collide.js';
import { world as TW } from '../js/tune.js';
import { placementPrint } from './lib/world-print.js';
import { worldAll } from './lib/world-cache.js';
import { LIGHTHOUSE, nightLightModel, spyglassModel, scarfRockModel, snowCradleModel } from '../js/props.js';
import PRINTS from './fixtures/world-prints.json';

const HEART_IDS = ['hc_meadow', 'hc_shores', 'hc_peaks', 'hc_woods'];
const SEEDS = [CFG.seed, 1, 42, 1234];
const SLOW = 30_000; // world gen takes ~0.2-0.3 s locally; leave headroom for slow CI runners

// FNV-1a over raw bytes: a cheap fingerprint of the whole heightfield / region map.
function fnv(typed) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
  return h;
}

function fingerprint(w) {
  return {
    spawn: { ...w.spawn },
    props: w.props.length,
    deco: w.deco.length,
    chests: w.chests.map((c) => [c.id, c.kind, c.amount, +c.x.toFixed(3), +c.z.toFixed(3)]),
    arenas: Object.fromEntries(Object.entries(w.arenas).map(([k, a]) => [k, [+a.x.toFixed(3), +a.z.toFixed(3)]])),
    heights: fnv(w.H),
    regions: fnv(w.reg),
  };
}

// where Ribbit says a parade lantern is (data.js ERRANDS 'ribbit' hint)
function lanternNear(w, s) {
  const d = (x, z) => Math.hypot(s.x - x, s.z - z);
  if (s.at === 'altar') return d(w.pedestal.x, (w.pedestal.z + w.spawn.z) / 2) <= 6.6;
  if (s.at === 'signpost') return d(w.signpost.x, w.signpost.z) <= 6.1;
  if (s.at === 'shop') return d(w.shop.x, w.shop.z) <= 11.5;
  if (s.at === 'meadow') return Math.min(...w.paths.meadow.map((p) => d(p.x, p.z))) <= 6.5 && Math.hypot(s.x, s.z) > 18;
  return false;
}

// a landmark keepsake's spot is valid (World.placeSecrets): dry, walkable, not steep, off bridges and arenas, clear of
// every solid and collider but its own landmark's, of chests, interactables, NPC spots, shells and lanterns; reachable.
// Returns the list of broken rules (empty when valid)
function secretFaults(w, s, reach) {
  const lm = w.landmarks.find((l) => l.id === s.landmark), bad = [];
  const d = (p) => Math.hypot(p.x - s.x, p.z - s.z);
  if (!(w.hAt(s.x, s.z) > 0.25)) bad.push('wet');
  if (!w.walkable(s.x, s.z) || !(w.slopeAt(s.x, s.z) < 0.7)) bad.push('steep');
  if (w.bridgeAt(s.x, s.z) !== null) bad.push('bridge');
  if (w.inArena(s.x, s.z, 2)) bad.push('arena');
  if (w.props.some((p) => p.solid && !p.removed && p !== lm.prop && d(p) < p.r + 0.5)) bad.push('solid');
  if (w.colliders.some((c) => c.prop !== lm.prop && shapeDist(c, s.x, s.z) < 0.5)) bad.push('collider');
  if (Math.hypot(s.x - lm.x, s.z - lm.z) < lm.prop.r + 0.55) bad.push('inside its landmark');
  if (w.chests.some((c) => d(c) < 2.5)) bad.push('chest');
  if (w.interact.some((it) => d(it) < Math.max(2, (it.r || 0) + 0.5))) bad.push('interactable');
  if (Object.values(w.npcSpots).some((q) => d(q) < 3)) bad.push('npc spot');
  if (w.shells.concat(w.lanterns).some((q) => d(q) < 2)) bad.push('errand item');
  if (!w.isReached(reach, s.x, s.z, false)) bad.push('unreachable');
  return bad;
}
// how far a keepsake is from its landmark's collider ring (m)
const ringGap = (w, s) => { const lm = w.landmarks.find((l) => l.id === s.landmark); return Math.hypot(s.x - lm.x, s.z - lm.z) - lm.prop.r; };
// the Summit Crystal Cairn's needle summit: is any spot of World.placeSecrets' near grid (0.6–3 m outside its ring,
// every 5°) valid (secretFaults) at all?
function cairnNearValid(w, reach) {
  const lm = w.landmarks.find((l) => l.id === 'peaks');
  for (const dd of [0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.5, 3.0]) for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2 - Math.PI, x = +(lm.x + Math.sin(a) * (lm.prop.r + dd)).toFixed(3), z = +(lm.z + Math.cos(a) * (lm.prop.r + dd)).toFixed(3);
    if (!w.isReached(reach, x, z, false) || !w.walkable(x, z)) continue;   // the cheap rules first
    if (!secretFaults(w, { landmark: 'peaks', x, z }, reach).length) return true;
  }
  return false;
}

const world = worldAll;   // one generation per seed per process, shared with the post-pass tests (tests/lib/world-cache.js)

// the Catchers' reasons (World.placeReasons, S-004): ids in order, and the atlas default rule for an item placed on the
// ground (atlas-home.md 1.3): dry, walkable, slope < 0.5, off the path band (night-lights 1.2 m, else 2.2 m), off
// bridges, outside every arena and its 5 m ring, ≥ 1 m from solids and colliders, ≥ 2.5 m from chests, interactables and
// NPC spots, ≥ 2 m from shells, parade lanterns, keepsakes and the other reason items (but the night-lights of the row),
// reachable. Returns the broken rules (empty when valid)
const REASON_IDS = ['home:reason-grumble-2', 'home:reason-grumble-1', 'home:reason-grumble-3', 'home:reason-rings', 'home:reason-pinch-spyglass', 'home:reason-pinch-tally', 'home:reason-frost-scarf', 'home:reason-frost-cradle'];
function reasonFaults(w, it, reach) {
  const bad = [], d = (p) => Math.hypot(p.x - it.x, p.z - it.z), { x, z } = it;
  if (!(w.hAt(x, z) > 0.3)) bad.push('wet');
  if (!w.walkable(x, z) || !(w.slopeAt(x, z) < 0.5)) bad.push('steep');
  if (w.pathDAt(x, z) < (it.kind === 'nightlight' ? 1.2 : 2.2)) bad.push('path');
  if (w.bridgeAt(x, z) !== null) bad.push('bridge');
  if (w.inArena(x, z, 5)) bad.push('arena');
  if (w.solidNear(x, z, 1.0)) bad.push('solid');
  if (w.colliders.some((c) => shapeDist(c, x, z) < 1.0)) bad.push('collider');
  if (w.chests.some((c) => d(c) < 2.5)) bad.push('chest');
  if (w.interact.some((q) => d(q) < 2.5)) bad.push('interactable');
  if (Object.values(w.npcSpots).some((q) => d(q) < 2.5)) bad.push('npc spot');
  if (w.shells.concat(w.lanterns, w.secrets).some((q) => d(q) < 2)) bad.push('earlier pass item');
  if (w.reasons.some((q) => q !== it && q.x != null && !(q.kind === 'nightlight' && it.kind === 'nightlight') && d(q) < 2)) bad.push('reason item');
  if (!w.isReached(reach, x, z, false)) bad.push('unreachable');
  return bad;
}
const reachOf = (w) => { const keep = [w.walk, w.reach], R = w.bfs(w.buildWalk()); w.walk = keep[0]; w.reach = keep[1]; return R; };

describe('generateWorld determinism', () => {
  test('same seed gives the same island', () => {
    const a = fingerprint(generateWorld(CFG.seed));
    const b = fingerprint(world(CFG.seed));
    expect(a).toEqual(b);
  }, SLOW);

  test('different seeds give different islands', () => {
    const a = fingerprint(world(CFG.seed));
    const b = fingerprint(world(1));
    expect(a.heights).not.toBe(b.heights);
  }, SLOW);
});

describe.each(SEEDS)('seed %p', (seed) => {
  test('every reachability target is reachable', () => {
    const w = world(seed);
    expect(w.unreachable.map((t) => t.name)).toEqual([]);
  }, SLOW);

  test('has the three boss arenas', () => {
    expect(Object.keys(world(seed).arenas).sort()).toEqual(['peaks', 'shores', 'woods']);
  }, SLOW);

  test('has exactly the four heart-container chests and at least one coin chest', () => {
    const w = world(seed);
    const hearts = w.chests.filter((c) => c.kind === 'heart').map((c) => c.id).sort();
    expect(hearts).toEqual([...HEART_IDS].sort());
    expect(w.chests.length).toBeGreaterThanOrEqual(HEART_IDS.length + 1);
    const ids = w.chests.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, SLOW);

  test('every existing placement matches the fingerprint taken before the rainbow-shell pass', () => {
    // tests/fixtures/world-prints.json: placementPrint of each seed on the code before Clover's errand (issue #32)
    expect(placementPrint(world(seed))).toEqual(PRINTS[seed]);
  }, SLOW);

  test('the rainbow-shell pass changes nothing else in the world', () => {
    const w = world(seed), bare = generateWorld(seed, { shells: false });
    expect(bare.shells).toEqual([]);
    expect(placementPrint(w)).toEqual(placementPrint(bare));
    expect(fingerprint(w)).toEqual(fingerprint(bare));
    expect(fnv(w.walk)).toBe(fnv(bare.walk));
    expect(fnv(w.reach)).toBe(fnv(bare.reach));
    expect(w.unreachable).toEqual(bare.unreachable);
  }, SLOW);

  test('five rainbow shells on dry Shores sand: flat, clear, outside the arena, reachable, at the spots Clover names', () => {
    const w = world(seed), a = w.arenas.shores;
    expect(w.shells.map((s) => s.id)).toEqual(['shell1', 'shell2', 'shell3', 'shell4', 'shell5']);
    expect(w.shells.map((s) => s.at)).toEqual(['lighthouse', 'islet1', 'islet2', 'cove', 'path']);
    const reach = w.bfs(w.buildWalk());
    const lm = w.landmarks.find((l) => l.id === 'shores');
    for (const s of w.shells) {
      const isle = w.islets.find((i) => Math.hypot(s.x - i.x, s.z - i.z) < i.r);
      const at = { id: s.id, shores: w.regionAt(s.x, s.z) === REGION.SHORES || !!isle, sand: w.surfaceAt(s.x, s.z), dry: w.hAt(s.x, s.z) > 0.3 };
      expect(at).toEqual({ id: s.id, shores: true, sand: 'sand', dry: true });
      expect(s.y).toBeCloseTo(w.hAt(s.x, s.z), 5);
      expect(w.slopeAt(s.x, s.z)).toBeLessThan(0.5);
      expect(w.bridgeAt(s.x, s.z)).toBeNull();
      expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeGreaterThan(a.r + 5);   // outside the arena and its stone ring
      expect(w.inArena(s.x, s.z, 5)).toBeNull();
      expect(w.solidNear(s.x, s.z, 1.0)).toBeNull();
      expect(w.colliders.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 1.0)).toEqual([]);
      expect(w.pathDAt(s.x, s.z)).toBeGreaterThanOrEqual(3);
      expect(w.chests.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < 2.5)).toEqual([]);
      expect({ id: s.id, reached: w.isReached(reach, s.x, s.z, false) }).toEqual({ id: s.id, reached: true });
      for (const t of w.shells) if (t !== s) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThanOrEqual(8);
      // where Clover says they are
      if (s.at === 'lighthouse') expect(Math.hypot(s.x - lm.x, s.z - lm.z)).toBeLessThan(12);
      if (s.at === 'islet1') expect(isle).toBe(w.islets[0]);
      if (s.at === 'islet2') expect(isle).toBe(w.islets[1]);
      if (s.at === 'cove') expect(Math.hypot(s.x - a.x, s.z - a.z)).toBeLessThan(a.r + 16);
      if (s.at === 'path') expect(Math.min(...w.paths.shores.map((p) => Math.hypot(p.x - s.x, p.z - s.z)))).toBeLessThan(7);
    }
  }, SLOW);

  test('the parade-lantern pass changes nothing else in the world, with or without the shell pass', () => {
    const w = world(seed), noLanterns = generateWorld(seed, { lanterns: false }), bare = generateWorld(seed, { shells: false, lanterns: false });
    expect(noLanterns.lanterns).toEqual([]);
    expect(noLanterns.shells).toEqual(w.shells);   // its own RNG stream: the shells stay where they were
    for (const o of [noLanterns, bare]) {
      expect(placementPrint(w)).toEqual(placementPrint(o));
      expect(fingerprint(w)).toEqual(fingerprint(o));
      expect(fnv(w.walk)).toBe(fnv(o.walk));
      expect(fnv(w.reach)).toBe(fnv(o.reach));
      expect(w.unreachable).toEqual(o.unreachable);
    }
    expect(generateWorld(seed).lanterns).toEqual(w.lanterns);   // deterministic per seed
  }, SLOW);

  test('four parade lanterns in the village: flat, clear, off the paths, reachable, at the spots Ribbit names', () => {
    const w = world(seed);
    expect(w.lanterns.map((s) => s.id)).toEqual(['lantern1', 'lantern2', 'lantern3', 'lantern4']);
    expect(w.lanterns.map((s) => s.at)).toEqual(['altar', 'signpost', 'shop', 'meadow']);
    const reach = w.bfs(w.buildWalk());
    for (const s of w.lanterns) {
      expect(s.kind).toBe('lantern');
      expect(Math.hypot(s.x, s.z)).toBeLessThan(TW.paradeR - 6);   // well inside the village circle Ribbit follows in
      expect(s.y).toBeCloseTo(w.hAt(s.x, s.z), 5);
      expect(w.hAt(s.x, s.z)).toBeGreaterThan(0.6);
      expect(w.slopeAt(s.x, s.z)).toBeLessThan(0.45);
      expect(w.bridgeAt(s.x, s.z)).toBeNull();
      expect(w.pathDAt(s.x, s.z)).toBeGreaterThanOrEqual(2.2);
      expect(w.solidNear(s.x, s.z, 1.2)).toBeNull();
      expect(w.colliders.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 0.9)).toEqual([]);
      expect(w.chests.filter((c) => Math.hypot(c.x - s.x, c.z - s.z) < 2.5)).toEqual([]);
      expect(Object.values(w.npcSpots).filter((q) => Math.hypot(q.x - s.x, q.z - s.z) < 3)).toEqual([]);
      expect({ id: s.id, reached: w.isReached(reach, s.x, s.z, false) }).toEqual({ id: s.id, reached: true });
      for (const t of w.lanterns) if (t !== s) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThanOrEqual(8);
      for (const t of w.shells) expect(t.id).not.toBe(s.id);
      expect(lanternNear(w, s)).toBe(true);
      expect(Math.hypot(s.paper.x - s.x, s.paper.z - s.z)).toBeCloseTo(0.38, 5);   // the hanging paper, out along the arm
      expect(s.paper.y).toBeGreaterThan(s.y + 1);
    }
  }, SLOW);

  test('the landmark-keepsake pass changes nothing else in the world, with or without the other post-passes', () => {
    const w = world(seed), noSecrets = generateWorld(seed, { secrets: false }), bare = generateWorld(seed, { shells: false, lanterns: false, secrets: false });
    expect(noSecrets.secrets).toEqual([]);
    expect(noSecrets.shells).toEqual(w.shells);       // no RNG draws: the shells and lanterns stay where they were
    expect(noSecrets.lanterns).toEqual(w.lanterns);
    for (const o of [noSecrets, bare]) {
      expect(placementPrint(w)).toEqual(placementPrint(o));
      expect(fingerprint(w)).toEqual(fingerprint(o));
      expect(fnv(w.walk)).toBe(fnv(o.walk));
      expect(fnv(w.reach)).toBe(fnv(o.reach));
      expect(w.unreachable).toEqual(o.unreachable);
      expect(o.props.length).toBe(w.props.length);
      expect(o.deco.length).toBe(w.deco.length);
      expect(o.colliders.length).toBe(w.colliders.length);
      expect(o.interact.length).toBe(w.interact.length);
      expect(o.reserved).toEqual(w.reserved);
      expect(o.npcSpots).toEqual(w.npcSpots);
    }
    expect(generateWorld(seed).secrets).toEqual(w.secrets);   // deterministic per seed
  }, SLOW);

  test('four landmark keepsakes, one per region landmark, just outside its ring, on valid reachable ground', () => {
    const w = world(seed), reach = w.bfs(w.buildWalk());
    expect(w.secrets.map((s) => s.id)).toEqual(SECRETS.map((s) => s.id));
    expect(w.secrets.map((s) => s.landmark)).toEqual(['woods', 'peaks', 'shores', 'meadow']);
    for (const s of w.secrets) {
      expect(s.kind).toBe('secret');
      expect(s.y).toBeCloseTo(w.hAt(s.x, s.z), 5);
      expect({ id: s.id, bad: secretFaults(w, s, reach) }).toEqual({ id: s.id, bad: [] });
      if (s.landmark !== 'peaks') {
        expect(ringGap(w, s)).toBeLessThanOrEqual(3 + 1e-6);
        expect(s.at).toBeLessThan(Math.PI / 2);   // on the half away from the path (the lighthouse: toward the sea)
      }
      for (const t of w.secrets) if (t !== s) expect(Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThan(20);
    }
  }, SLOW);

  test('the reasons pass changes nothing else in the world', () => {
    const w = world(seed), bare = generateWorld(seed, { reasons: false });
    expect(bare.reasons).toEqual([]);
    expect(bare.shells).toEqual(w.shells);         // its own RNG stream: every earlier pass stays where it was
    expect(bare.lanterns).toEqual(w.lanterns);
    expect(bare.secrets).toEqual(w.secrets);
    expect(placementPrint(w)).toEqual(placementPrint(bare));
    expect(fingerprint(w)).toEqual(fingerprint(bare));
    expect(fnv(w.walk)).toBe(fnv(bare.walk));
    expect(fnv(w.reach)).toBe(fnv(bare.reach));
    expect(w.unreachable).toEqual(bare.unreachable);
    expect(bare.props.length).toBe(w.props.length);
    expect(bare.deco.length).toBe(w.deco.length);
    expect(bare.colliders.length).toBe(w.colliders.length);
    expect(bare.interact.length).toBe(w.interact.length);
    expect(bare.reserved).toEqual(w.reserved);
    expect(bare.npcSpots).toEqual(w.npcSpots);
    expect(generateWorld(seed).reasons).toEqual(w.reasons);   // deterministic per seed
  }, SLOW);

  test('eight reason items, in order, each obeying its rule', () => {
    const w = world(seed), reach = reachOf(w), R = w.reasons, by = (id) => R.find((r) => r.id === id);
    expect(R.map((r) => r.id)).toEqual(REASON_IDS);
    // the night-lights: 1.2 m apart in a line beside the Woods arena sign, the middle one on the side away from the path
    const [n2, n1, n3] = R.slice(0, 3), d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    expect(R.slice(0, 3).map((r) => r.kind)).toEqual(['nightlight', 'nightlight', 'nightlight']);
    expect(Math.abs(d(n1, n2) - 1.2)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(d(n2, n3) - 1.2)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(d(n1, n3) - 2.4)).toBeLessThanOrEqual(0.1);
    const sign = w.interact.find((it) => it.kind === 'sign' && it.lines === SIGNS.arena_woods);
    expect(d(n2, sign)).toBeGreaterThanOrEqual(1.5);
    expect(d(n2, sign)).toBeLessThanOrEqual(3.5);
    expect(w.pathDAt(n2.x, n2.z)).toBeGreaterThan(w.pathDAt(sign.x, sign.z));
    // the fairy rings: three lists of ≥ 7 glowshrooms, each within 2.2 m of its clearing's ring
    const rings = by('home:reason-rings').rings, cl = w.woodsGaps.clearings;
    expect(rings.length).toBe(3);
    rings.forEach((ids, i) => {
      expect(ids.length).toBeGreaterThanOrEqual(7);
      for (const k of ids) {
        expect(w.deco[k].type).toBe('glowshroom');
        expect(Math.hypot(w.deco[k].x - cl[i].ring.x, w.deco[k].z - cl[i].ring.z)).toBeLessThanOrEqual(2.2);
      }
    });
    // the lighthouse items: on the gallery (r 1.3 m, bearing 200°) and on the door, turned with the landmark
    const lm = w.landmarks.find((l) => l.id === 'shores'), k = lm.height / LIGHTHOUSE.H, spy = by('home:reason-pinch-spyglass'), tally = by('home:reason-pinch-tally');
    expect([spy.attach, tally.attach]).toEqual(['shores', 'shores']);
    expect(Math.hypot(spy.x - lm.x, spy.z - lm.z)).toBeCloseTo(1.3, 2);
    expect(Math.atan2(spy.x - lm.x, spy.z - lm.z)).toBeCloseTo(Math.PI - (200 * Math.PI) / 180, 2);
    expect(spy.y).toBeCloseTo(lm.y - LIGHTHOUSE.sink + LIGHTHOUSE.deck * k, 2);
    expect(spy.s).toBeCloseTo(k, 3);   // scaled with the lighthouse, so the tube clears the gallery rail
    expect(Math.hypot(tally.x - lm.x, tally.z - lm.z)).toBeCloseTo((LIGHTHOUSE.door.z + 0.01) * k, 2);
    expect(Math.atan2(tally.x - lm.x, tally.z - lm.z)).toBeCloseTo(Math.atan2(Math.sin(lm.rot), Math.cos(lm.rot)), 2);
    expect(tally.y).toBeCloseTo(lm.y - LIGHTHOUSE.sink + LIGHTHOUSE.door.y * k, 3);
    // Frostbun's: ≥ 20 m from the Peaks arena centre; the cradle ≥ 2.5 m from the arena sign; the rock is solid
    const a = w.arenas.peaks, ps = w.interact.find((it) => it.kind === 'sign' && it.lines === SIGNS.arena_peaks), scarf = by('home:reason-frost-scarf'), cradle = by('home:reason-frost-cradle');
    expect(d(scarf, a)).toBeGreaterThanOrEqual(20);
    expect(d(cradle, a)).toBeGreaterThanOrEqual(20);
    expect(d(cradle, ps)).toBeGreaterThanOrEqual(2.5);
    expect(scarf.solid).toEqual({ r: 0.5 });
    expect(cradle.solid).toBeUndefined();
    // every item on the ground obeys the rule, as stored (rounded to the millimetre, y on the ground)
    for (const it of R) {
      if (it.x == null || it.attach) continue;
      expect({ id: it.id, bad: reasonFaults(w, it, reach) }).toEqual({ id: it.id, bad: [] });
      expect(it.x).toBe(+it.x.toFixed(3));
      expect(it.z).toBe(+it.z.toFixed(3));
      expect(it.y).toBeCloseTo(w.hAt(it.x, it.z), 6);
    }
  }, SLOW);

  test('spawn point is on dry land', () => {
    const w = world(seed);
    expect(w.hAt(w.spawn.x, w.spawn.z)).toBeGreaterThan(0);
  }, SLOW);
});

// Clover names the spots (data.js ERRANDS hint), so every shell must be at its own on any island, not just the four
// above: seeds 1–40 (seed 23's second islet has only a sliver of dry sand clear of its palm, chest and bridge)
test('on seeds 1–40 every rainbow shell is at the spot Clover names', () => {
  const off = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = worldAll(seed), a = w.arenas.shores, lm = w.landmarks.find((l) => l.id === 'shores');
    if (w.shells.length !== 5) off.push([seed, 'count', w.shells.length]);
    for (const s of w.shells) {
      const isle = s.at.startsWith('islet') ? w.islets[+s.at.slice(5) - 1] : null;
      const near = s.at === 'lighthouse' ? Math.hypot(s.x - lm.x, s.z - lm.z) < 12
        : isle ? Math.hypot(s.x - isle.x, s.z - isle.z) < isle.r
          : s.at === 'cove' ? Math.hypot(s.x - a.x, s.z - a.z) < a.r + 16
            : Math.min(...w.paths.shores.map((p) => Math.hypot(p.x - s.x, p.z - s.z))) < 7;
      if (!near) off.push([seed, s.at, s.x, s.z]);
    }
  }
  expect(off).toEqual([]);
}, 120_000);

test('default seed has exactly 14 chests, as documented in docs/DESIGN.md', () => {
  const w = world(CFG.seed);
  expect(w.chests.length).toBe(14);
  expect(w.chests.filter((c) => c.kind === 'coins').length).toBe(10);
}, SLOW);

// Ribbit names the spots, so every lantern must be at its own on any island: seeds 1–40
test('on seeds 1–40 there are four parade lanterns, each at the spot Ribbit names and reachable', () => {
  const off = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = worldAll(seed);
    if (w.lanterns.length !== 4) off.push([seed, 'count', w.lanterns.length]);
    const reach = reachOf(w);
    for (const s of w.lanterns) if (!lanternNear(w, s) || !w.isReached(reach, s.x, s.z, false)) off.push([seed, s.at, s.x, s.z]);
  }
  expect(off).toEqual([]);
}, 120_000);

// every island has its four keepsakes, each on valid reachable ground by its landmark: within 3 m of the ring, on the
// half away from the path for every landmark but the cairn. The cairn's needle summit has no reachable ground within
// 3 m of its ring on most seeds; there the stone is as close as Pip can stand (seeds 1–150: median 7 m, at most 28 m)
test('on seeds 1–150 every landmark has its keepsake on valid reachable ground by it', () => {
  const off = [];
  for (let seed = 1; seed <= 150; seed++) {
    const w = generateWorld(seed, { shells: true, lanterns: true });
    if (w.secrets.map((s) => s.id).join() !== SECRETS.map((s) => s.id).join()) { off.push([seed, 'ids', w.secrets.map((s) => s.id)]); continue; }
    const reach = w.bfs(w.buildWalk());
    for (const s of w.secrets) {
      const bad = secretFaults(w, s, reach), gap = ringGap(w, s);
      if (bad.length) off.push([seed, s.id, bad]);
      if (s.landmark === 'peaks') {
        if (gap > 3 + 1e-6 && cairnNearValid(w, reach)) off.push([seed, s.id, 'far although a spot by the ring is valid', gap]);
        if (gap > 40) off.push([seed, s.id, 'too far', gap]);
      } else {
        if (gap > 3 + 1e-6) off.push([seed, s.id, 'far', gap]);
        if (!(s.at < Math.PI / 2)) off.push([seed, s.id, 'on the path side', s.at]);
      }
    }
  }
  expect(off).toEqual([]);
}, 300_000);

// every island has the Catchers' reasons: the eight ids in order, every item on the ground valid and reachable from the
// spawn (seeds 1–40, from the shared world cache)
test('on seeds 1–40 every reason item exists, obeys its rule and is reachable', () => {
  const off = [];
  for (let seed = 1; seed <= 40; seed++) {
    const w = worldAll(seed), ids = w.reasons.map((r) => r.id);
    if (ids.join() !== REASON_IDS.join()) { off.push([seed, 'ids', ids]); continue; }
    const reach = reachOf(w);
    for (const it of w.reasons) {
      if (it.kind === 'rings') { if (it.rings.length !== 3 || it.rings.some((r) => r.length < 7)) off.push([seed, it.id, it.rings.map((r) => r.length)]); continue; }
      if (it.attach) continue;
      const bad = reasonFaults(w, it, reach);
      if (bad.length) off.push([seed, it.id, bad]);
    }
    const [n2, n1, n3] = w.reasons, d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    if (Math.abs(d(n1, n2) - 1.2) > 0.05 || Math.abs(d(n2, n3) - 1.2) > 0.05) off.push([seed, 'night-light row', d(n1, n2), d(n2, n3)]);
  }
  expect(off).toEqual([]);
}, 240_000);

// the reason props are code-built within their ART BRIEF budgets (atlas-home.md #placeReasons)
test('the reason props stay within their triangle budgets', () => {
  const tris = (...gs) => gs.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  const sc = scarfRockModel(), cr = snowCradleModel();
  const got = { nightlight: tris(nightLightModel(false).geo), nightlightLit: tris(nightLightModel(true).geo), spyglass: tris(spyglassModel().geo), scarf: tris(sc.rock.geo, sc.scarf.geo), cradle: tris(cr.nest.geo, cr.hollow) };
  const cap = { nightlight: 120, nightlightLit: 120, spyglass: 160, scarf: 220, cradle: 200 };
  for (const k in cap) expect({ k, n: got[k], ok: got[k] <= cap[k] }).toEqual({ k, n: got[k], ok: true });
  // heights: the night-light 0.42 m, the spyglass 0.7 m, the cradle 0.25 m
  const top = (g) => { g.computeBoundingBox(); return g.boundingBox.max.y; };
  expect(top(nightLightModel(false).geo)).toBeCloseTo(0.42, 2);
  expect(Math.abs(top(spyglassModel().geo) - 0.7)).toBeLessThan(0.03);
  expect(top(cr.nest.geo)).toBeCloseTo(0.25, 2);
});
