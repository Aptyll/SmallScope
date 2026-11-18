# js/sim/covefoot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| **the pool at the orca's falls**, left by four rules at worldgen on its own `worldRng`: the falls scour a hole, stones fall off the face and tumble out (the big ones farther, stopping on one another or carried clear of the scour), the hole fills to the lowest gap in what holds it (a priority flood), and churned water stays open while still water freezes; its height field per px of the box round the falls | `coveFootBuild`, `coveFoot`, `COVE_STONES`, `COVE_STONE_R`, `COVE_SCOUR`, `COVE_FOOT_PAD` (its pixels: `coveFootPaint`, js/draw/cove.js) | `the falls' foot` |
| the tiles the stones and the pool hold, stood as `OBJECTS.waterfall` by `genWorld` (js/sim/field.js) | `coveFootTiles`, `COVE_FOOT_HOLD` | `the falls' foot` |
