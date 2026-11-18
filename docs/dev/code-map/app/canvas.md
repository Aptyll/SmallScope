# js/app/canvas.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| resolution, pillarbox frame, UI SIZE (`worldDev` vs `devScale`) | `fitCanvas`, `uiDevFor`/`UI_SIZES`, `zu`, `renderBars` | `canvas` (`relayout`: `state`, core.js) |
| fullscreen or windowed (the VIDEO page's DISPLAY row) | `fullscreenOn`, `setFullscreen`, `winFull` | `canvas` |
| world zoom: the pixel-exact rung, the eased scale, the world view (with the sub-pixel camera's spare px) and this frame's buffer corner, the two coordinate bridges | `ZOOM_*`, `kWant`/`frameRows`/`kMin`/`kMax`/`rungK`/`zoomWantOf`/`zoomFloor`, `zoomCur`, `WV_W`/`WV_H`, `wOX`/`wOY`, the air layer `airCv`/`actx`/`airMask`/`amctx`/`airOn`, the midday grade's copy `gradeCv`/`grctx` (todGrade), its riders and box `airRiders`/`airBox`/`airGrow`/`AIR_PAD`/`AIR_TOP` (lit by `lightAir`, js/draw/light.js), `sizeWorldView`, `wToSX`/`wToSY`, `mouseWX`/`mouseWY` | `canvas` |
| the camera's two modes, LOCKED and FREE: the edge pan, the centre key's cut, the minimap's drag, a FREE camera panned off the body you watch while down | `CAM_EDGE`/`CAM_PAN`, `camLoose`, `camDrag`, `camLive`, `camFreeOn`, `camFlip`, `camEdge`, `camStep` (from `update`, js/sim/sim.js), `camCentre`, `camDragStart`/`camDragEnd` (from `pointerPress`/`pointerRelease`, input.js) | `camera modes` ([camera-modes](../../rendering/camera-modes.md)) |
| panel + minimap layout anchors (`PANEL_*`, `SET_*`, `ROW_*`, the minimap disc's `MM_CX`/`MM_CY`/`MM_R`), and the map slab's fit to the view (`MAP_W`/`PANEL_W`/`PANEL_H` from `CHART_MAX`/`MAP_SIDE`/`MAP_HEAD`/`MAP_FOOT`) | assigned by `relayout()` (core.js) on every resize; `fitMapSlab` | `canvas` |
