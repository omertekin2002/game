// The shared world cache for post-pass tests (docs/roadmap/bible/atlas-home.md #passes rule 9a, S-004; S-016 extends it):
// one generateWorld(seed) per seed per test process, so every post-pass test on seeds 1-40 shares a single generation.
// The worlds are read-only: a test must never change one.
import { generateWorld } from '../../js/world.js';

const all = new Map();

/** generateWorld(seed) with every post-pass, memoised per process */
export function worldAll(seed) {
  if (!all.has(seed)) all.set(seed, generateWorld(seed));
  return all.get(seed);
}
