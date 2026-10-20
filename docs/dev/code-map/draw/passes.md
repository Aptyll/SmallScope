# js/draw/passes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the steps `render()` runs, in its order: the ground and the ice, the prints, the flat pass, the drops, the y-sorted list and its pass, the build bars, particles, shots, tracers, swing arcs, the air layer, the blit and everything in screen space | `drawGroundPass`, `drawFootprints`, `drawFlatPass`, `drawDrops`, `gatherDraws`, `drawSorted`, `drawBuildBars`, `drawParticles`, `drawArrows`, `drawTracers`, `drawSwingArcs`, `renderAirLayer`, `renderScreen` | `render passes` |
| one tile object as the y-sorted pass draws it (tree, snag, den, hut, stall, rock, chest, dummy, cairn, rack, bell, bush, snowdrop, a tiled wall), and a building's own draw (the build rising, its overlays, cracks and bar) | `drawSceneryObj` (`HUT_FR`, `SNOWDROP_SWAY`), `drawStructObj` | `render passes` |
