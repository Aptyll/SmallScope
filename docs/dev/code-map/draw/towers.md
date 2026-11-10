# js/draw/towers.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a road tower's gun at its heading and frame, the front parapet over it and the bar; the dashed aim line and ring while it winds on a hero, the bolt in flight, the spent bolt in the snow | `TOWER_HEADS`, `towerHead`, `towerFrame`, `towerGunAt`, `drawTowerTop` (from `drawStructObj`, js/draw/passes.js), `drawTowerFx` (from `render`, js/draw/render.js), `towerFigure` (the whole tower as one canvas: the wiki's figure) | `road towers` (the sim: js/sim/towers.js) |
| the paved round a tower stands on: the lane's own flagstones on the same grid under a snow lip, one canvas a tower, drawn under the bodies | `TOWER_FOOT_RX`/`TOWER_FOOT_RY`, `towerFooting`, `drawTowerFootings` (from `render()`, after the flat pass) | `road towers` |
