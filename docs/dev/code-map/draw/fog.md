# js/draw/fog.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| whether a body (or its map dot, or its tracks) is drawn this frame, the frame's sight lines, the edge's distance at a point | `fogShown`, `fogView`, `fogMargin`, `fogRay`, `fogLines` (an eye that has not moved keeps its lines) | `fog of war (draw)` |
| the dim over the world: its tint, the stepped rim's cell and step, the mask and the multiply (called first thing in `renderLighting`) | `FOG_TINT`, `FOG_BAND`/`FOG_HALF` (the half-dim step just outside the edge), `FOG_CELL`/`FOG_STEP`/`FOG_ARC`/`FOG_CLAMP`, `fogCorners`, `fogMask`, `drawFog`; a cable's eyes joined pair by pair into a straight band for the mask (`fogBand`, `fogBands`); where two eyes' edges cross, the V between them rounded off by a smooth max (`fogJoin`, `FOG_JOIN`, worked out to `FOG_REACH` px) | `fog of war (draw)` |
| the minimap's and the M map's fog: one px a tile, rebuilt when an eye moves | `fogMapFrame`, `fogOverMap` (from `renderMinimap`, js/ui/minimap.js, and `renderWorldMap`, js/ui/panels.js) | `fog of war (draw)` |
