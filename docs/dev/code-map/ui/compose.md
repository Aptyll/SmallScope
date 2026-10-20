# js/ui/compose.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the frame's UI pass in order - what goes over the world while you play, from the minimap to the announcer | `renderUI` | `renderUI` (last of the HUD files; the pieces it calls live in the seven files above it) |
| the F3 info stack: fps, the ms a frame spends in the sim and in drawing (`perf`, js/sim/core.js), coords, seed | `drawTags` | `the info stack` |
