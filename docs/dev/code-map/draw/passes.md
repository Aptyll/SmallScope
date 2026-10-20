# js/draw/passes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the steps `render()` runs, in its order: the ground and the ice, the prints, the flat pass, the y-sorted list and its pass, the build bars, particles, shots, swing arcs, the air layer, the blit and everything in screen space | `drawGroundPass`, `drawFootprints`, `drawFlatPass`, `gatherDraws`, `drawSorted`, `drawBuildBars`, `drawParticles`, `drawArrows`, `drawSwingArcs`, `renderAirLayer`, `renderScreen` | `render passes` |
| one tile object as the y-sorted pass draws it (tree, snag, den, hut, stall, dummy, cairn, bell, bush, snowdrop), and a building's own draw (the build rising, its overlays, cracks and bar) | `drawSceneryObj` (`HUT_FR`, `SNOWDROP_SWAY`), `drawStructObj` | `render passes` |
