// Completion tally for the pause menu and the map card: chests, heart containers, guardians, regions, Starseeds, errands.
// Pure module (no Three.js, DOM or localStorage) so `bun test` can import it. Totals come from the generated world
// (W.chests) and the content tables in data.js, so every ?seed= island counts its own chests. Only ids that exist in
// this world are counted: a stale or unknown key in the save never inflates a count.
import { BOSSES, ERRANDS, REGIONS, SEED_ORDER, SHOP, errands } from './data.js';

const has = (o, k) => !!o && typeof o === 'object' && Object.hasOwn(o, k) && !!o[k];
const row = (found, total) => ({ found, total, full: found >= total });

/** the tracker's rows in display order, with the key used in completion()'s result */
export const COMPLETION_ROWS = [
  { k: 'chests', name: 'Chests', icon: 'icon_chest', fb: '▣' },
  { k: 'hearts', name: 'Heart containers', icon: 'heart_container', fb: '♥' },
  { k: 'guardians', name: 'Guardians', icon: 'icon_woods', fb: '!' },
  { k: 'regions', name: 'Regions', icon: 'act_map', fb: '⚑' },
  { k: 'seeds', name: 'Starseeds home', icon: 'seed_forest', fb: '✦' },
  { k: 'errands', name: 'Errands', icon: 'shell_deco', fb: '✿' },
];

/**
 * Counts and totals for a world W (generateWorld) and a save state S (freshState / normalize).
 * Heart containers are the world's heart chests plus Miso's one shop heart. `pct` is the share of distinct things
 * done (a heart chest counts once), rounded down so 100 only shows when `done`.
 * @returns {{chests: {found: number, total: number, full: boolean}, hearts: object, guardians: object, regions: object,
 *   seeds: object, errands: object, pct: number, done: boolean}}
 */
export function completion(W, S) {
  const chests = (W && W.chests) || [];
  const st = S || {};
  const opened = chests.filter((c) => has(st.chests, c.id));
  const heartChests = chests.filter((c) => c.kind === 'heart');
  const shopHearts = SHOP.some((it) => it.id === 'heart') ? 1 : 0;
  const shopGot = shopHearts && st.shopHeart === true ? 1 : 0;
  const bossIds = Object.keys(BOSSES);
  const out = {
    chests: row(opened.length, chests.length),
    hearts: row(heartChests.filter((c) => has(st.chests, c.id)).length + shopGot, heartChests.length + shopHearts),
    guardians: row(bossIds.filter((id) => has(st.bosses, id)).length, bossIds.length),
    regions: row(REGIONS.filter((_, i) => has(st.visited, String(i))).length, REGIONS.length),
    seeds: row(SEED_ORDER.filter((id) => !!st.seeds && st.seeds[id] === 2).length, SEED_ORDER.length),
    errands: row(errands.done(st), ERRANDS.length),   // an errand counts once, when it is done (not its items)
  };
  // distinct things: every chest (heart chests included), the shop heart, guardians, regions, Starseeds, errands
  const found = out.chests.found + shopGot + out.guardians.found + out.regions.found + out.seeds.found + out.errands.found;
  const total = out.chests.total + shopHearts + out.guardians.total + out.regions.total + out.seeds.total + out.errands.total;
  out.done = COMPLETION_ROWS.every((r) => out[r.k].full);
  out.pct = out.done ? 100 : total ? Math.min(99, Math.floor((100 * found) / total)) : 0;
  return out;
}
