// Post-pass solids (docs/roadmap/bible/atlas-home.md #passes rule 7, S-004). A post-pass (world.js placeReasons, …)
// never adds to the generator's lists, so the prints, W.walk and W.reach are the same with or without it. Items that
// must block Pip declare `solid: { r }` in their own record instead; attachPost(W) turns them into colliders after
// generateWorld returns (main.js). Tests and the prints never call it.
export const POST_LISTS = ['reasons'];

/** append a circle collider (kind 'post', world-collide.js COLLIDER_H) for every post-pass item with `solid`.
 *  Returns the colliders added. Calling it twice adds nothing more */
export function attachPost(W) {
  const added = [];
  if (W._postAttached) return added;
  W._postAttached = true;
  for (const key of POST_LISTS) {
    for (const it of W[key] || []) {
      if (!it.solid || !(it.solid.r > 0) || it.x == null) continue;
      added.push(W.addDynamicCollider({ kind: 'post', x: it.x, z: it.z, r: it.solid.r, post: it.id }));
    }
  }
  return added;
}
