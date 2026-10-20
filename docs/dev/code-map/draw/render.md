# js/draw/render.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| render pass order | `render` (its steps: js/draw/passes.js) | `render` |
| the work-target rim: gold outline on the hovered tree/dead tree/berried bush | `drawTargetRim`, the `o === wkO` stamps in the y-sorted pass | `render` |
| the `.` overlay: hitboxes, the model centre column, and its 1px ring/box/line rasterisers | `drawHitboxes`, `hbRing`, `hbBox`, `hbDot`, `hbLine`, `hbMid`, `HB_*` | `debug overlays` |
| the `.` overlay's routes: waypoints + goal tile, a bird's perch line, a fish's heading arrow | `drawNavPaths`, `hbArrow` | `debug overlays` |
| the one arrow body every shot in the air is drawn as | `drawShaft` | `the shot's body` (called from `drawArrows`, js/draw/passes.js) |
| **the two item icons that MOVE** (the gold piece, the berry): the frame stamped into each one's live canvas, once a frame off one clock, so `SPRITES[ITEMS[type].icon]` stays one generic read everywhere | `stepItemIcons`, `ITEM_FR` (the frames: `SPRITES.itemAnim`; the grids: the `gold nugget` and `items` sections of js/sprites/items.js) | `render` (called at the top of `render()`, before anything draws) |
| pointer state and the bow aim line | `cursorInfo`, `drawCursor`, `drawAimLine` | `cursor & aim line` |
