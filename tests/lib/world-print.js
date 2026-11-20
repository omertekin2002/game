// Placement fingerprint of a generated world (js/world.js): every chest, NPC spot, landmark, prop, decoration,
// interactable and collider position, rounded to the millimetre and hashed. tests/world.test.js compares it with
// tests/fixtures/world-prints.json (taken before the rainbow-shell pass existed) so a later pass can never move them.
const r3 = (x) => (typeof x === 'number' ? Math.round(x * 1000) / 1000 : x ?? null);

// FNV-1a over a string
export function fnvStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
const hashRows = (rows) => fnvStr(rows.map((r) => r.join(',')).join(';'));

export function placementPrint(w) {
  return {
    spawn: [r3(w.spawn.x), r3(w.spawn.z)],
    chests: w.chests.map((c) => [c.id, c.kind, c.amount, r3(c.x), r3(c.z), r3(c.rot)]),
    npcSpots: Object.fromEntries(Object.entries(w.npcSpots).map(([k, s]) => [k, [r3(s.x), r3(s.z)]])),
    landmarks: w.landmarks.map((l) => [l.id, r3(l.x), r3(l.z)]),
    arenas: Object.fromEntries(Object.entries(w.arenas).map(([k, a]) => [k, [r3(a.x), r3(a.z), r3(a.r)]])),
    props: [w.props.length, hashRows(w.props.map((p) => [p.type, r3(p.x), r3(p.z), r3(p.s), p.removed ? 1 : 0]))],
    deco: [w.deco.length, hashRows(w.deco.map((p) => [p.type, r3(p.x), r3(p.z), r3(p.s)]))],
    interact: [w.interact.length, hashRows(w.interact.map((it) => [it.kind, r3(it.x), r3(it.z)]))],
    colliders: [w.colliders.length, hashRows(w.colliders.map((c) => [c.kind ?? '', r3(c.x), r3(c.z), r3(c.r)]))],
  };
}
