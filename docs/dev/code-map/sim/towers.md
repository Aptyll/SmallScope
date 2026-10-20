# js/sim/towers.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the road towers: their tuning, standing two on every cable at boot (`TOWER_SEEK`, `TOWER_CLEAR`), cutting each cable to the furthest one standing, what one shoots, the turn, the wind and the loose, the bolt's hit and the spent bolt, the nearest rival tower (a wave's and a pusher's read), whether a side's wave stands under one | `TOWER_*`, `zipWhole`, `towerFoot`, `placeTowers` (called at boot after `placeZips`, boot.js), `towerStand`, `towersSync` (first thing in `updateStructures`, and in `drawZips`), `towerHolds`/`towerCall`/`towerMark`, `updateTower` (from `updateStructures`), `towerBolt`, `towerNear` (`updateSoldier` rung 3, robots.js; `aiLaneFort`, ai.js), `towerTanked` | `road towers` (the `STRUCTS.tower` entry: structures.js; pixels: js/draw/towers.js; sight: `FOG_TOWER`, fog.js) |
