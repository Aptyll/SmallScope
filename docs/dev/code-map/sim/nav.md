# js/sim/nav.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| entity movement and unit-vs-unit solidity, and each body's room | `moveEntity`, `separateUnits`, `UNIT_MASS`, `unitSpace`, `UNIT_SPACE`, `UNIT_ROOM_RATE`, `unitShare` (the right of way; who outranks: `isAnchored`, `MONSTER.anchor`, wildlife.js) | `movement & collision` (the tile half, `isSolidTile`: `world`, world.js) |
| routes around obstacles: A*, the per-unit route follower, the stall/give-up signal, the toll a tile charges a route (the orca's ice) and the straight line that must not cut across it (nor the cistern's stone: `cisternBlocks`, `cisternCuts`, `cisternCrowds`, js/sim/cistern.js) | `findPath`, `walkable`, `navTo`, `navStep`, `navToll` (set by `spawnOrca`, js/sim/orca.js), `navLineClear` (its `free`: `navSmooth`, `navTo`) | `pathfinding` |
