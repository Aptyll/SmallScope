# js/draw/structs.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gold pump's paint (its holder's or grey), stroke frame, payout coin and ring (the holder's rim and the taker's fill), a building's sprite and where it is laid (read by the draw and the shot's sweep) | `pumpSet`, `pumpFrame`/`drawPumpCoin` (`PUMP_STROKE`, `PUMP_HOP`), `drawPumpRings`/`pumpArc` (`PUMP_GREY`; called from `drawFlatPass`, passes.js), `structSprite`, `structArtOff` | `the gold pump and a building's sprite` (what they read: `STRUCTS`, structures.js; the ring's state: js/sim/pumps.js) |
| the hour on a building: its sunward grey side lifted toward white at dawn and dusk so the grade warms it with the snow | `HOUR_LIT`, `HOUR_SHARE`, `HOUR_ROUND` (which kinds take it on one side), `hourLitOf` (a mask per sprite), `drawHourLit` (from `drawStructObj` and the stall, passes.js, and `drawTowerTop`) | `the gold pump and a building's sprite` |
