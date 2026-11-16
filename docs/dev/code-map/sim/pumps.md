# js/sim/pumps.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the two neutral gold pumps: their tuning, standing a mirrored pair one each side of the middle at boot (`PUMP_SPOT`), the ring's count of heroes, the fill, the flip and the pay to the holding side | `PUMP_*`, `pumpRingPx`, `placePumps` (called at boot after `placeCamps`, boot.js), `pumpCount` (also `aiPumpRung`, ai-ladder.js), `updatePump` (from `updateStructures`), `pumpFlip` | `pumps` (the `STRUCTS.pump` entry: structures.js; pixels: `pumpSet`/`pumpFrame`/`drawPumpCoin`/`drawPumpRings`, js/draw/structs.js; maps: `mmPump`/`chPump`, world.js) |
