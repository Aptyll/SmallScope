# js/sim/icebreak.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the ice breaking in its own shape (the orca's hole, `orcaStrike`, js/sim/orca.js): the footprints (`orca` the orca's own), the tuning, breaking it, the tiles it opens and closes, the step, the footprint as a hit test, whether a pixel is its water, whether it holds a tile | `ICE_BREAK_SHAPES`/`breakLens`, `ICE_BREAK_*`, `iceBreaks`, `iceBreak`, `breakFoot`/`breakGeom` (the shape and the hole off `breakCache`), `breakOpen`/`breakClose`, `updateIceBreaks` (from `updatePlay`, sim.js), `iceBreakCovers`, `iceBreakWet` (the plunge, `playerPlunge`; `nearestDryTile`, actions.js; `moveEntity`, nav.js), `iceBreakHolds` (`paintGroundTile`, ground.js; the mirror, light.js; the fish clip, render.js), `iceBreakAge`/`breakFront` | `ice breaks` (the pixels: js/draw/icebreak.js; save: `SAVE_ROOTS`; wire: `snapSingles`) |
