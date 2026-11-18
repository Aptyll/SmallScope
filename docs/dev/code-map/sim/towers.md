# js/sim/towers.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the lane towers: their tuning, standing three a side on each lane at boot (`TOWER_SPOTS`, folded four ways with `fieldFour`; `tier`, `TOWER_GUARD`), the order they fall in and the perch after them (`towerShut`, `perchShut`), what one shoots, the turn, the wind and the loose, the bolt's hit and the spent bolt, the nearest rival tower (a wave's and a pusher's read), whether a side's wave stands under one | `TOWER_*`, `towerFoot`, `placeTowers` (called at boot after `placeCamps`, boot.js), `towerHolds`/`towerCall`/`towerMark`, `updateTower` (from `updateStructures`), `towerBolt`, `towerNear` (`updateSoldier` rung 3, robots.js; `aiLaneFort`, ai.js), `towerTanked` | `road towers` (the `STRUCTS.tower` entry: structures.js; pixels: js/draw/towers.js; sight: `STRUCTS.tower.sight` from `towerFoot`, read by `sightSources`, fog.js) |
