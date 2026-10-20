# js/app/canvas.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| resolution, pillarbox frame | `fitCanvas`, `renderBars` | `canvas` (`relayout`: `state`, core.js) |
| world zoom: the pixel-exact rung, the eased scale, the world view (with the sub-pixel camera's spare px) and this frame's buffer corner, the two coordinate bridges | `ZOOM_*`, `kWant`/`kMin`/`kMax`/`zoomWantOf`, `zoomCur`, `WV_W`/`WV_H`, `wOX`/`wOY`, the air layer `airCv`/`actx`/`airMask`/`amctx`/`airOn`, the midday grade's copy `gradeCv`/`grctx` (todGrade), its riders and box `airRiders`/`airBox`/`airGrow`/`AIR_PAD`/`AIR_TOP` (lit by `lightAir`, js/draw/light.js), `sizeWorldView`, `wToSX`/`wToSY`, `mouseWX`/`mouseWY` | `canvas` |
| panel + minimap layout anchors (`PANEL_*`, `SET_*`, `ROW_*`, `MM_*`), and the map slab's fit to the view (`MAP_W`/`MAP_S`/`PANEL_W`/`PANEL_H` from `CHART_MAX`/`MAP_SIDE`/`MAP_HEAD`/`MAP_FOOT`) | assigned by `relayout()` (core.js) on every resize; `fitMapSlab` | `canvas` |
