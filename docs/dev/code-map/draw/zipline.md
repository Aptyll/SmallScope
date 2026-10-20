# js/draw/zipline.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a pylon's sprite in each side's colour and its draw in the y-sorted pass, the cable pass (a span rasterised pixel by pixel with its sag and wind lean, over every body and canopy, under the night; the hovered line lit gold), the dotted walk to the hovered cable, and a rider's handle and rope | `PYLON_H`/`PYLON_SPRS`, `drawPylon` (dispatched from `render()`'s object pass), `ZIP_INK`/`ZIP_LIT`/`ZIP_HOV_A`/`ZIP_HOV_B`/`ZIP_GUIDE`, `drawZips` (between `drawDropAir` and `renderLighting` in `render()`), `zipLitLine`, `drawZipGuide` (after `drawAimLine`), `drawZipHandle` (from `drawPlayer`, js/draw/bodies.js) | `zipline` (the geometry it reads: `zips`/`zipPoint`/`zipLift`, the `zipline` banner, js/sim/zipline.js) |
