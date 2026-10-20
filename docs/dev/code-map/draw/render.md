# js/draw/render.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| render pass order | `render` (its steps: js/draw/passes.js) | `render` |
| the work-target rim: gold outline on the hovered tree/dead tree/berried bush/chest | `drawTargetRim`, the `o === wkO` stamps in the y-sorted pass | `render` |
| a rock as drawn: its kind or its rubble, the cracks and bar of its progress, its glint, and the ring of the pick's reach on the snow | `drawRock`, `drawMineRing`/`MINE_RING_NEAR`, `ROCK_GLINT_T`/`ROCK_GLINT_NIGHT` | `render` (above `drawTargetRim`; the art: js/sprites/rocks.js) |
| the `.` overlay: hitboxes, the model centre column, and its 1px ring/box/line rasterisers | `drawHitboxes`, `hbRing`, `hbBox`, `hbDot`, `hbLine`, `hbMid`, `HB_*` | `debug overlays` |
| the `.` overlay's routes: waypoints + goal tile, a bird's perch line, a fish's heading arrow | `drawNavPaths`, `hbArrow` | `debug overlays` |
| which body a bit flies as: the plain arrow and the three shafts that are not it (barbed, icy, gold with a glint), the grapple on its cord, the turning log, the comet wisp, the swung fist and axe, the teleport request; the inverse-sampled turn they share | `BIT_BODY`, `drawShaft`, `BARB_BODY`/`LANCE_BODY`/`CARE_INK`/`drawCare`, `HOOK_BODY`/`drawHook`, `stampTurned`, `LOG_MAP`/`drawTumbler`, `drawMote`, `drawSwungBody`/`FIST_MAP`/`AXE_MAP`/`BIT_INK`, `drawWarpShot` | `the bodies a bit flies as` (and its `the shafts` / `the swung bodies`, with `BIT_BODY` at the section's foot; the names they answer to: `body` on `BITS`, tools.js) |
| a burning shot's head: the tongue of fire (longer the hotter), and a CINDER BURST's sparks | `drawShotFire`, `FIRE_FLICK` | `the bodies a bit flies as` › `fire riding a shot` (called from `drawArrows`, js/draw/passes.js, for any `a.burn > 0`) |
| the silhouettes a teleport strings across its jump | `drawWarps` | `render` › `the teleport's flash` (the flash itself: `warpPlayer`/`warps`, tools.js) |
| the ring and the risen icon a TOOL SWAP raises, on every player | `drawSwaps` | `render` › `the teleport's flash` (below `drawWarps`; the event itself: `swapFx`/`swaps`, tools.js) |
| **the two item icons that MOVE** (the gold piece, the berry): the frame stamped into each one's live canvas, once a frame off one clock, so `SPRITES[ITEMS[type].icon]` stays one generic read everywhere | `stepItemIcons`, `ITEM_FR` (the frames: `SPRITES.itemAnim`; the grids: the `gold nugget` and `items` sections of js/sprites/items.js) | `render` (called at the top of `render()`, before anything draws) |
| pointer state and the bow aim line | `cursorInfo`, `drawCursor`, `drawAimLine` | `cursor & aim line` |
