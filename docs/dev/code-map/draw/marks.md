# js/draw/marks.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the camp glyph both maps stamp, and the respawn clock a cleared camp wears to a side that saw it cleared (over its anchor or, with none, its mark; on both maps under the glyph) | `drawCampIcon`, `drawCampClock`, `campClockShown`/`campClockTxt`, `campAnchored`, `campClockDraws`/`drawCampSpotClock`, `drawCampMark`, `drawCampMapClock`, `CAMP_CLOCK_INK`, `CAMP_EMPTY_INK` (found empty, time unknown) | `the camp glyph both maps and the drop chart stamp` (its `CAMPS` spec: `camps`, js/sim/camps.js) |
| the pole and pennant a wave's soldier carries | `drawPennant` (called from `drawRobot`, js/draw/bodies.js) | `a pennant` |
| the CLICK scheme's rings under the order and the lock, and the MOUSE scheme's range preview | `drawClickMarks`, `drawCastPreview` | `a pennant` |
| what a body looks like on either map: the square in its side's ink (a player one step bigger than a robot), the watched body's white heart in its side's ring, the bird diamond, and a rival's cross under a colour-blind palette | `drawMapDot`, `drawMapUnit`, `drawMapCross`, `drawMapYou`, `drawMapBird` | `what a body looks like on a map` (its two callers: `renderMinimap` js/ui/minimap.js, `renderWorldMap` js/ui/panels.js) |
| a zipline on either map: a crisp two-pixel ribbon in its side's ink pylon to pylon, each pylon a pale pixel on it | `drawMapZip`, `MAP_ZIP_PYLON` | `a zipline on a map` (its two callers: `renderMinimap` js/ui/minimap.js, `renderWorldMap` js/ui/panels.js; the lines: `zips`, js/sim/zipline.js) |
