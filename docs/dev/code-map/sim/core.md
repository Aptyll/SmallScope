# js/sim/core.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the numbers with no one owner: the tile grid, the view, the authored frame the screens centre in, the day cycle | `TILE`, `WORLD`, `VIEW_W`/`VIEW_H`/`FULL_W`, `FRAME_H`/`frameTop`, `DAY_LEN`/`NIGHT_LEN`/`CYCLE` | `constants` |
| the economy: every gold payout in one table, and a beast's XP (`xp`) | `YIELD` | `constants` (`gainGold`, the one way it is paid: `players`, player.js; the XP: `shareXp`, `players`, player.js) |
| tuning for one feature (the bow, the roll, prone, a wolf, a turret, a ping, a fish) | **not here** - each block sits above the code that reads it; find it in this file's per-file section | - |
| the one exception to that: `state` reads it at load, so it cannot live in a later file | `FISH_SPAWN_T` | `constants` (the rest of the shoal: `fish`, wildlife.js) |
| determinism: the seeded stream every world draw comes from | `mulberry32`, `SEED`, `rng` | `rng` (`hash2`/`vnoise`: `ground prerender`, js/draw/ground.js; `treeRare`: `world`, world.js) |
| the singletons | `state`, `settings`, `perf` | `state` (`players`/`player` + the entity arrays: `players`, player.js) |
| settings persistence, the team palette, and the minimap-size helpers | `saveSettings`, `loadSettings`, `applyTeamPal`, `mmScale`, `applyMinimapSize` | `state` |
| `relayout()` — the resize pair's second half | `relayout` | `state` (`fitCanvas`: `canvas`, canvas.js — still the resize pair) |
| page events held until boot: a listener registers here and boot.js attaches them all | `pageListen`, `pageListenStart`, `PAGE_LISTENERS` | `helpers` |
| floaters, particles, drops, cost math, and the HUD's four-character count (`999` › `1.2K` › `340K` › `1.2M`) | `addFloater`, `burst`, `streamTo` (motes from one point to another), `spawnDrop` (returns the drop), `canAfford`, `NUM_SUFFIX`/`shortNum` | `helpers` |
| food: the 1.5 s meal, the 3 s clock berries and fish share, and every way one is broken | `FOOD_CD`/`FOOD_EAT`/`FOOD_SLOW`/`FOOD_FX_T`, `startEat`, `eatBerry`/`eatFish`, `fishToEat` (which kind the fish well eats: the pick, else the smallest meal held), `updateEat`, `breakEat` | `helpers` › `food` (the heal numbers: `ITEMS[type].heal`, `players`, player.js; the wells that draw the clock: `drawFoodClock`, js/ui/character.js) |
| the gold flare and crack an ambush arrow lands with | `ambushFx` | `helpers` |
| a body's running damage total: adding a hit, and the quiet that starts a new one | `tallyHit`, `TALLY_HOLD` (where it is drawn: `queueTally`, js/draw/overhead.js) | `helpers` |
| the gold word a staged archery target says when it breaks: the list, its life and rise | `wordPops`, `wordPop`, `WORD_POP_T`/`WORD_POP_RISE` (aged in `updateFx`, js/sim/sim.js; drawn by `drawTallies`, js/draw/overhead.js) | `helpers` |
