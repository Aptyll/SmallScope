# js/sim/base.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| each side's base: the fixed hollow in its roost corner, its ragged wall, the perch the bird lands on, the mouth the road leaves by and the two the side lanes leave by, where each lane's bay stands, which hollow a tile is in, the road's two ends, clearing it at boot | `BASE_U`/`BASE_R`/`BASE_RAG`/`PERCH_U`/`BASE_KEEP`/`BASE_SIDE_U`/`BASE_SIDE_S`/`BASE_BAYS`, `baseU`, `baseTile` (the side's road frame), `baseCentre`, `basePerch`, `baseGateU`, `baseGate`, `baseBaySpot` (read by `merchBaySite`, robots.js), `baseWall`, `baseAt` (the chests' and rocks' keep-out, world.js), `baseRoadEnd` (read by `roadDist`, world.js), `placeBase` (called at boot after `placeRoad`, boot.js) | `base` |
