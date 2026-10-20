# js/sim/recall.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the recall (the H key's channel home) and the roost ring that heals your side round its bird: the tuning, the ring's reach, the refusal, the start (the cmd), the break (called by `breakEat`, core.js), the cancel on the body's own actions (top of `playerIntents`, sim.js), the clock and the landing, the heal | `RECALL_T`, `RING_HP`/`RING_STAM`/`RING_FX_T`, `roostRing`, `recallBlocked`, `startRecall` (from `runCmd`, js/ui/wheel.js), `breakRecall`, `recallIntents`, `updateRecall` (from `updatePlayer`, beside `updateEat`); the landing tile: `roostTile`, js/sim/player.js; out of a fight: `p.fightT`, js/sim/items.js | `recall` (pixels: js/draw/recall.js; the bar: `drawPlayer`, js/draw/bodies.js; bots: `aiRecall`, js/ai/ai.js; the camera's cut: `CAM_CUT`, sim.js) |
