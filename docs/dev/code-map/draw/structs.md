# js/draw/structs.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gold pump's paint (its holder's or grey), stroke frame, payout coin and ring (the holder's rim and the taker's fill), a building's sprite and where it is laid (read by the draw and the shot's sweep) | `pumpSet`, `pumpFrame`/`drawPumpCoin` (`PUMP_STROKE`, `PUMP_HOP`), `drawPumpRings`/`pumpArc` (`PUMP_GREY`; called from `drawFlatPass`, passes.js), `structSprite`, `structArtOff` | `the gold pump and a building's sprite` (what they read: `STRUCTS`, structures.js; the ring's state: js/sim/pumps.js) |
