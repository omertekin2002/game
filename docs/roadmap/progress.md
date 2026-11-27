# Progress

Dated close-out entries, newest first: the steps a milestone closed, its measured numbers (budgets per view, precache,
save size), its hours and its test results. Each `chore: close Mxx` and `perf: checkpoint n` step appends one entry in
the format of [bible/charter.md#progress-template](bible/charter.md#progress-template).

## 2026-11-27 · M01 Canon in the repo; the Catchers hand over closed (S-001 - S-007)

- Steps: S-001 #56 (PR #57), S-002a #60 (PR #61), S-002b #62 (PR #63), S-002c #64 (PR #65), S-003 #66 (PR #67),
  S-004 #68 (PR #69), S-005 #70 (PR #71), S-006 #73 (PR #74), S-007 #75 (PR __PR__); splits: S-002a/S-002b/S-002c;
  fallbacks used: none (the two S-004 decals were generated; the four reason models are code-built, their GLB slots
  commented out)
- Hours: +0.3 h this milestone (an estimate, as before S-078b: three reason props to look at, three handover scenes
  and the post-fight talks); cumulative 3.3 h; INDEX target 3.3 h; CANON §11 bucket(s): Act I main path
- Realms: shipped home; still hidden none (no realm engine yet, S-016 - S-031)
- Budgets (worst view per realm, FP / TP; `G.debug.perf` at noon, 1920 × 1080, software WebGL, the arenas measured
  in the fight phase): home: calls main 200/197, total 231/223 (`arena-peaks-W`); tris main 1.05 M/0.87 M
  (`arena-woods-S` FP / `arena-shores-N` TP), total 1.15 M/0.96 M; genMs home 1172 ms cold, 423 ms warm (`bun`, five
  `generateWorld(7151)` in a row); swap n/a (one realm)
  - The four WP7 views (no `REALMS[home].views` until S-022; the worst direction of four `perfLocations` per site):
    `village-N` 129/136 main, 174/177 total · `arena-woods-S` 194/58, 228/88 · `arena-peaks-W` 200/197, 231/223 ·
    `arena-shores-N` 184/186, 214/212. Against `5a58c02` (main with S-004, the last recorded numbers) every view is
    within 5 calls except TP `arena-woods-S`, which is −56: that third-person camera settles differently from run to run
    (62, 114 and 58 on three builds with no change near it). Against `b79d73d` (before M01) the reason props add +6
    (`arena-woods-S` FP) and +7 (`arena-peaks-W` both cameras), as S-004 recorded; the handovers add nothing.
  - For perf checkpoint 1 (S-047): FP `arena-peaks-W` is at the 200 main-pass target, and FP `arena-woods-S` is over
    the 1.0 M main-pass triangle target (1.05 M; 1.06 M before M01, so not new). Both are under the hard limits.
- Precache: core 24.8 MB (418 files; `node tools/build-pages.mjs`); bundles none yet
- Save: v7 (S-003: `flags`, backup key `starseed-isle-save-v2-bak`); fixtures `tests/fixtures/saves/` v6-bloomed 1.0 KB,
  act1-fresh 0.5 KB, act1-1seed 0.6 KB, act1-2seed 0.7 KB, act1-3carried 0.7 KB, act1-bloomed 0.7 KB
- Tests (local, one `agentctl heavy` each): bun test 307 pass (52 s); pwa pass (130 s); smoke pass (455 s); opening
  pass (75 s); playthrough pass (176 s); in-page `act1` 8/8 (41 s), `wp5` 35/35 (47 s), `wp9` 24/24 (202 s), `core`
  53/53 (63 s); chapters n/a (S-030). The rest of the CI matrix is gated by CI on the close-out PR.
- Art: no brief batch scheduled (the first is S-014); assets added 2 (`reason_tally` 12 KB, `decal_snow_cradle` 7 KB,
  S-004)
- Notes: reconciliation R2 closed (systems `#save-v7` now gives the v7 migration's contents); R1 was already applied
  to INDEX's S-003 row and the bible before S-001. `tests/docs.test.js` `ALLOW_PENDING` unchanged (13 entries, none
  touched by M01). `tests/chapter.mjs` does not exist yet (S-030), so there is no chapter chain to check; no act card
  exists yet. M01 calls the next milestones should know: the handover objective reads "Talk to <Catcher>" after a
  mid-scene save (S-005); the lighthouse reason items follow the landmark's model transform (S-004); the bloom
  watchers' Grumble mark moves 2.5 m to (−9.5, −4.5) on 7151 to keep 3 m of room (S-006).
