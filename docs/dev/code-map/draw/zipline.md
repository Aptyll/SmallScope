# js/draw/zipline.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a pylon's sprite in each side's colour and its draw in the y-sorted pass, standing in a drift of snow (`PYLON_DRIFT`), the cable pass (a span rasterised pixel by pixel with its sag and wind lean, over every body and canopy, under the night; the hovered line lit gold; the end stop where the ride lets go), the dotted walk to the hovered cable, and a rider's handle and rope | `PYLON_H`/`PYLON_SPRS`, `drawPylon` (dispatched from the object pass, passes.js), `ZIP_INK`/`ZIP_LIT`, the rope's strands `ZIP_ROPE`/`ZIP_ROPE_INK`/`ZIP_HOV_A`/`ZIP_HOV_B`/`ZIP_GUIDE`, `drawZips` (before `renderLighting` in `render()`), `zipLitLine`, `drawZipGuide`, `drawZipHandle` (from `drawPlayer` and `drawRobot`, js/draw/bodies.js) | `zipline` (the geometry it reads: `zips`/`zipPoint`/`zipLift`, the `zipline` banner, js/sim/zipline.js) |
