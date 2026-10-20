# js/sim/pumps.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the two neutral gold pumps: their tuning, standing a mirrored pair beside the top and bot lanes' middles at boot, the ring's count of heroes, the fill, the flip and the pay to the holding side | `PUMP_*`, `pumpLaneMid`, `pumpAll`, `pumpRingPx`, `pumpSpotOk`, `pumpMirror`, `pumpSeek`, `placePumps` (called at boot after `placeLandmarks`, boot.js), `pumpStand`, `pumpCount` (also `aiPumpRung`, ai-ladder.js), `updatePump` (from `updateStructures`), `pumpFlip` | `pumps` (the `STRUCTS.generator` entry: structures.js; pixels: `pumpSet`/`pumpFrame`/`drawPumpCoin`/`drawPumpRings`, js/draw/structs.js; maps: `mmPump`/`chPump`, world.js) |
