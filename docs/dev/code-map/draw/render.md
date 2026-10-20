# js/draw/render.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| render pass order | `render` (its steps: js/draw/passes.js) | `render` |
| the work-target rim: gold outline on the hovered tree/dead tree/berried bush/chest | `drawTargetRim`, the `o === wkO` stamps in the y-sorted pass | `render` |
| a rock as drawn: its kind or its rubble, the cracks and bar of its progress, its glint, and the ring of the pick's reach on the snow | `drawRock`, `drawMineRing`/`MINE_RING_NEAR`, `ROCK_GLINT_T`/`ROCK_GLINT_NIGHT` | `render` (above `drawTargetRim`; the art: js/sprites/rocks.js) |
| the `.` overlay: hitboxes, the model centre column, and its 1px ring/box/line rasterisers | `drawHitboxes`, `hbRing`, `hbBox`, `hbDot`, `hbLine`, `hbMid`, `HB_*` | `debug overlays` |
| the `.` overlay's routes: waypoints + goal tile, a bird's perch line, a fish's heading arrow | `drawNavPaths`, `hbArrow` | `debug overlays` |
| the one arrow body every shot in the air is drawn as, and the inverse-sampled turn the turret's rock is stamped with | `drawShaft`, `stampTurned` | `the shot's body` (called from `drawArrows`, js/draw/passes.js) |
| **the two item icons that MOVE** (the gold piece, the berry): the frame stamped into each one's live canvas, once a frame off one clock, so `SPRITES[ITEMS[type].icon]` stays one generic read everywhere | `stepItemIcons`, `ITEM_FR` (the frames: `SPRITES.itemAnim`; the grids: the `gold nugget` and `items` sections of js/sprites/items.js) | `render` (called at the top of `render()`, before anything draws) |
| pointer state and the bow aim line | `cursorInfo`, `drawCursor`, `drawAimLine` | `cursor & aim line` |
