# js/draw/structs.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the turret's sling - the PART TABLE it is drawn from (a row's `from` is the tier it appears at: that is the whole of how the three forks differ), this frame's pouch, cords and fork geometry, the ink a part wears, and the rasteriser that lays them at the live bearing | `SLING`, `SL_MOUTH`/`SL_DRAW`/`SL_FLY`/`SL_FLARE`, `slingState`, `slingInk`, `slingPart`, `drawTurretHead`, `paintRimmed`, `SLING_WOOD`/`TUR_RIM` | `the turret's sling, its rocks, the bay, the net and the tiled struct` |
| a thrown rock's tumbling body, and the dashed aim ARC plus the cords snapping on the release | `drawSlungRock`/`ROCK_MAP`/`ROCK_INK`, `drawTurretFx`, `TUR_ARC`/`TUR_LET` | `the turret's sling, its rocks, the bay, the net and the tiled struct` |
| the gold pump's stroke frame and its payout coin, the bay's overlay, the fish net's draw, a tiered piece's sprite and where it is laid (read by the draw and the shot's sweep), a tiled building's draw (one tile of art per footprint tile) | `pumpFrame`/`drawPumpCoin` (`PUMP_STROKE`, `PUMP_HOP`), `drawBayOverlay`, `drawNet`/`NET_FISH_AT`, `structSprite`, `structArtOff`, `drawTiledStruct` | `the turret's sling` (the file's one banner; what they read: `STRUCTS`, structures.js) |
