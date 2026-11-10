# js/sim/core.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the numbers with no one owner: the tile grid, the view, the authored frame the screens centre in, the day cycle | `TILE`, `WORLD`, `VIEW_W`/`VIEW_H`/`FULL_W`, `FRAME_H`/`frameTop`, `DAY_LEN`/`NIGHT_LEN`/`CYCLE` | `constants` |
| the economy: every gold payout in one table, and a beast's XP (`xp`) | `YIELD` | `constants` (`gainGold`, the one way it is paid: `players`, player.js; the XP: `shareXp`, `players`, player.js) |
| tuning for one feature (the bow, the roll, a wolf, a tower, a ping, a potion) | **not here** - each block sits above the code that reads it; find it in this file's per-file section | - |
| determinism: the one map's seed and the match's stream | `mulberry32`, `MAP_SEED` (the map), `worldKind`, `SEED`, `rng` (the match), `worldRng` (worldgen's streams) | `rng` (`hash2`/`vnoise`: `ground prerender`, js/draw/ground.js; `treeRare`: `world`, world.js) |
| the singletons | `state`, `settings`, `perf` | `state` (`players`/`player` + the entity arrays: `players`, player.js) |
| settings persistence, the team palette, and the minimap-size helpers | `saveSettings`, `loadSettings`, `applyTeamPal`, `mmScale`, `applyMinimapSize` | `state` |
| `relayout()` — the resize pair's second half | `relayout`, `placeSlab` (the settings slab's x, its sliders and mute) | `state` (`fitCanvas`: `canvas`, canvas.js — still the resize pair) |
| page events held until boot: a listener registers here and boot.js attaches them all | `pageListen`, `pageListenStart`, `PAGE_LISTENERS` | `helpers` |
| floaters, particles, cost math, and the HUD's four-character count (`999` › `1.2K` › `340K` › `1.2M`) | `addFloater`, `burst`, `streamTo` (motes from one point to another), `NUM_SUFFIX`/`shortNum` | `helpers` |
| a body's running damage total: adding a hit, and the quiet that starts a new one | `tallyHit`, `TALLY_HOLD` (where it is drawn: `queueTally`, js/draw/overhead.js) | `helpers` |
| the gold word a staged archery target says when it breaks: the list, its life and rise | `wordPops`, `wordPop`, `WORD_POP_T`/`WORD_POP_RISE` (aged in `updateFx`, js/sim/sim.js; drawn by `drawTallies`, js/draw/overhead.js) | `helpers` |
