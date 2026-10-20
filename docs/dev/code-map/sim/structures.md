# js/sim/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every building: its tier, cost, HP, footprint, the two colours the maps paint it | `STRUCTS` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| making a building (the one constructor), whose side it is, what a wreck pays, taking one off the map | `createStruct`, `ownsStruct`, `wreckPay`, `removeStruct` | `structures` |
| the fish net's tuning: what it holds, what it lures, how fast it catches and hands over | `NET_CAP`, `NET_R`, `NET_LURE`, `NET_CATCH_T`, `NET_TAKE_T` | `structures` (beside `STRUCTS`, whose `net` entry it belongs to) |
| construction ticks, generators, the barracks queuing and rolling out a wave | `updateStructures`, `BARRACKS_ROLL`, `barracksLaneLoad` (the cap is the lane's); a road tower's step `updateTower` (js/sim/towers.js) | `the building sim` (the barracks' entry - `wave`/`waveT`/`grow`/`cap`, `art` - is in `STRUCTS`; its pixels `drawBarracksOverlay`, js/draw/overhead.js) |
