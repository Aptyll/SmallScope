# js/draw/lakes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the snow's depth as this file reads it (js/sim/depth.js's map), the prevailing wind | `snowDepthAt`, `deepSnowAt`, `DRIFT_MID`/`DEEP_TOP`, `rollPrevailing` (`LW_X`/`LW_Y`, off `driftWind`) | `the snow's depth` |
| every lake's label and area, which count as big | `bakeLakeBodies` (`lakeId`/`lakeTiles`), `BIG_LAKE`, `bigLakeAt` | `lake bodies` |
| the per-tile pixel lists the bake fills and every tile paint stamps, their inks, where nothing may land | `bakeDressing` (called by `prepGround` after `bakeLakes`), `paintDressing` (under `paintGroundTile`), `dressPx`/`crackPx`, `stampAt`, `DRESS_INK`, `dressFree` | `the dressing's stamps` |
| the mid band drawn: the piles in the lee of a pine, a rock, the hut, and the skirt round a deep drift | `bakeDrifts` (reads `leeDepth`/`driftsDepth` per pixel), `DRIFT_FADE` | `drifts in the lee` |
| the bank on a lake's downwind shore | `bakeBanks`, `BANK_W`, `SUN_TO_X`/`SUN_TO_Y` | `the downwind bank` |
| the long cracks on a big lake | `bakeCracks`, `walkCrack`, `crackLine`, `CRACK_*` | `long cracks` |
| the dust on the ice, and the hook that scuffs it | `dustIce` (called on each ice pixel by `paintIceTile`/`paintSnowShore`), `iceDust`, `dustLee`/`bakeDustLee`, `DUST_*`, `trodden` (reads `trampleAt`), `iceDustInvalidate` (trampled snow calls it) | `dust on the ice` |
| the weather on the ice every frame: the dials, blown streaks over big lakes, a frosty night's glints and cracks, fresh dust | `lakeSky`, `drawLakeSky` (called by `render()` after `drawIceStars`), `LSTREAK_*`, `GLINT_*`, `CRACK_FROST*`, `dustCv`/`DUST_VARS`/`DUST_LEVELS` | `the weather on the ice` |
| the lake's fish drawn: a shadow under the ice, crisp where one crosses an open hole | `drawIceFish` (called by `render()` right after the ground blit) | `the fish under the ice` |
