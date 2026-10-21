# js/sim/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every building: its tier, cost, HP, footprint, the two colours the maps paint it | `STRUCTS` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| making a building (the one constructor), whose side it is, what a wreck pays, taking one off the map | `createStruct`, `ownsStruct`, `wreckPay`, `removeStruct` | `structures` |
| construction ticks, the gold pump's step (`updatePump`, js/sim/pumps.js), the barracks queuing and rolling out a wave | `updateStructures`, `BARRACKS_ROLL`, `barracksBeat` (the waves keep the match's beat, `first` then every `waveT`), `barracksLaneLoad` (the cap is the lane's); a road tower's step `updateTower` (js/sim/towers.js) | `the building sim` (the barracks' entry - `wave`/`first`/`waveT`/`grow`/`cap`, `art` - is in `STRUCTS`; its pixels `drawBarracksOverlay`, js/draw/overhead.js) |
