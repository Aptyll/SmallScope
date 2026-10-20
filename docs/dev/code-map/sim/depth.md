# js/sim/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how deep the snow lies anywhere: the map, its bands, the prevailing wind, the deep drift list and per-tile index, the lee pad behind every standing thing | `snowDepth`/`snowDepthPx`, `driftsDepth`, `hollowDepth`, `leeDepth`/`layLees`/`leeCell`/`LEE_AMP`, `DEPTH_DEEP`/`DEPTH_MID`, `driftWind`, `drifts`, `driftCell`, `driftDepth` (one drift's shape) | `snow depth` |
| the brush: the hand-placed patches, their shape, which patch a point is in, one near a point, what laying them clears | `BRUSH_PATCHES`, `BRUSH_*`, `brushes`, `layBrush`, `brushDepth`, `brushIn` (tiles in from the rim; a pool's through `poolIn`), `brushOf`/`deepAt` (js/sim/fog.js hides a body by it), `brushNear` (`aiBrushWait`, ai-farm.js) | `snow depth` › `the brush` |
| laying the map: the wind, the brush, the warrens' pools, the index, the lee pads | `layDrifts` (boot.js, after worldgen), `driftBreak`, `driftTiles`, `layMeadowDrifts`/`MEADOW_POOL`/`MEADOW_AMP`, `poolDepth`/`poolIn` (a warren's round pool; `driftDepth` hands a `pool` drift to it) | `snow depth` › `laying the drifts` |
