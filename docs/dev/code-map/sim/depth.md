# js/sim/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how deep the snow lies anywhere: the map, its bands, the prevailing wind, the drift list and per-tile index, the lee pad behind every standing thing | `snowDepth`/`snowDepthPx`, `driftsDepth`, `hollowDepth`, `leeDepth`/`layLees`/`leeCell`/`LEE_AMP`, `DEPTH_DEEP`/`DEPTH_MID`, `driftWind`, `drifts`, `driftCell`, `driftDepth` (one drift's shape) | `snow depth` |
| laying the drifts: what breaks the wind, what a drift may lie on or bury, the keep-outs, the fair split between the halves, and the warrens' own set | `layDrifts` (boot.js, after worldgen), `driftBreak`, `driftBury`, `driftFree`, `driftTiles`, the `DRIFT_*` constants, `layMeadowDrifts`/`MEADOW_POOL`/`MEADOW_AMP`, `poolDepth` (a warren's round pool; `driftDepth` hands a `pool` drift to it) | `snow depth` › `laying the drifts` |
| the slowdown: the wade every unit eases, what it leaves of a walk, and its tuning | `wadeStep` (from `updateUnitStatus`, actions.js), `wadeEase` (the depth alone, no puff: `wadeStep`'s first half, and a client's own walk, `netPredictWalk`), `wadeMul` (`walkMax` in `walkStep`, sim.js; `unitMoveMul`, actions.js), `DEEP_WALK`/`DEEP_DODGE`/`DEEP_SLIDE`/`DEEP_SLIDE_BAR`/`DEEP_EASE` | `snow depth` |
