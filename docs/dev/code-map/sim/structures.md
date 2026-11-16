# js/sim/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every building: its cost, HP, footprint, the two colours the maps paint it, and its hooks (`init`/`built`/`tick`, and the draw's `sprite`/`frame`/`over`) | `STRUCTS` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| making a building (the one constructor), whose side it is, what a wreck pays, taking one off the map | `createStruct`, `ownsStruct`, `wreckPay`, `removeStruct` | `structures` |
| construction ticks, the gold pump's step (`updatePump`, js/sim/pumps.js) and a road tower's (`updateTower`, js/sim/towers.js) | `updateStructures` | `the building sim` (the waves are js/sim/robots.js: `updateWaves`) |
