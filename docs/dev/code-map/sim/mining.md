# js/sim/mining.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the three rock kinds: mining time, gold, ore, find, regrow, glint, and each one's progress fill | `ROCK_KINDS`, `SPRITES.rockFill` | `rocks and ore` |
| the ores as carried items, their icons and prices | `ORE_ICONS`/`ORE_PAL`/`ORE_PRICE`, `ORE_STACK`, `isOre` (the rows go into `ITEMS`; the tooltip: `tipStack`, js/ui/tooltip.js; the price: `itemValue`, js/ui/shop.js, which pays half) | `rocks and ore` |
| the pick that mines a rock on its own: taking the nearest free rock in reach, its tick, bite, landing, letting go and a rival's blow | `updateMine` (from `updatePlayer`, sim.js), `mineFree`, `mineIdle`, `mineStrike`, `finishMine`, `breakMine`, `mineHit` (from `damagePlayer`, player.js), `MINE_R`/`MINE_HIT_HOLD`/`MINE_STREAM_T`/`MINE_STRIKE`/`MINE_MOVE`/`ORE_FLING` | `rocks and ore` |
| is a rock standing, who is at it, is it in reach, and the timers: the cracks closing on a rock nobody is at (`MINE_DECAY`) and the rubble growing back | `rockReady`, `rockMiner`, `mineReach`, `rockCx`/`rockCy`, `tickRock` (the object timers, sim.js) | `rocks and ore` (the draw: `drawRock`, js/draw/render.js; the shade: `CASTERS.rock`, js/draw/ground.js) |
