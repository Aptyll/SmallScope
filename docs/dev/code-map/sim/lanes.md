# js/sim/lanes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the top and bot lanes: their tuning and fixed control points, the smoothed centreline and a point along it, the registry roadDist mins over, laying them and their creek fords at boot, a wave's march down one, a side's cable down one, where a laner waits on any lane | `LANE_*`, `laneLine`, `laneAt`, `laneAlong`, `laneSegs`, `sideLaneDist` (read by `roadDist`, world.js; its index: `indexSegs`/`segsLat`, world.js), `layLanes` (called at boot between `layPaths` and `placeRoad`, boot.js), `laneWaypoints` (read by `makeSoldier`, robots.js), `laneZipTiles` (read by `placeZips`, zipline.js), `laneHold` (where a bot laner waits: `aiLaneSpot`, js/ai/ai-farm.js) | `lanes` (pixels: the road's, `paintRoadOverlay`, js/draw/ground.js) |
