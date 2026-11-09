# js/sim/structures.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| every building: its cost, HP, footprint, the two colours the maps paint it, and its hooks (`init`/`built`/`tick`, and the draw's `sprite`/`frame`/`over`) | `STRUCTS` | `structures` (scenery carries the same `mm`/`map` pair: `OBJECTS`, world.js) |
| making a building (the one constructor), whose side it is, what a wreck pays, taking one off the map | `createStruct`, `ownsStruct`, `wreckPay`, `removeStruct` | `structures` |
| construction ticks, the gold pump's step (`updatePump`, js/sim/pumps.js), the barracks queuing and rolling out a wave | `updateStructures`, `barracksTick`, `BARRACKS_ROLL`, `barracksBeat` (the waves keep the match's beat, `first` then every `waveT`), `barracksLaneLoad` (the cap is the lane's), `barracksWave` (the kinds of the wave queued now, capped by the lane), `barracksQueue` (into `o.kinds`, `o.queue` left; the beat and the practice bar's SPAWN WAVE), the practice bar's WAVES off (`state.prac.waves`); a road tower's step `updateTower`, or `towerRest` with the practice bar's TOWERS off (js/sim/towers.js) | `the building sim` (the barracks' entry - `mix`/`siege`/`first`/`waveT`/`grow`/`cap`, `art` - is in `STRUCTS`; its pixels `drawBarracksOverlay`, js/draw/overhead.js) |
