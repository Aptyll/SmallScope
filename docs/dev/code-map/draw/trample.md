# js/draw/trample.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the trampled snow: the grid (4 px cells), what stamps it (a walk, a slide, a crawl, a roll, a knockback, a blow, a death), the refill and the snowfall seam the weather feeds, which pixels trample (snow, ice, nothing) | `trPack`/`trChurn`, `trStamp`, `trBody`, `trampleStep` (called by `update()`, sim.js, beside the step on a host and after `netClientStep` on a client), `trRefill`, `trampleSnowfall`/`TR_SNOW_LIGHT`, `trMask`, `trampleGroundChanged` (called by `repaintGround`), `TR_*` | `trampled snow` |
| trampled ice thinning the lakes' dust: the read they take, the per-tile scan, the repaint queue handed to `iceDustInvalidate` | `trampleAt`, `trDustLayer`, `trDustScan`, `trDustSync`, `trDustSig`/`trDustQ`/`trDustHot` | `the dust on the ice` |
| its pixels: the pressed bands, the churned clods, the frost scuffed into ice, the chunk canvases and their pool | `TR_PACK_COL`/`TR_PIT`/`TR_LUMP`/`TR_FROST`, `trPaint`, `drawTrample` (called by `render()` right before the footprints; `trCatchUp` paints every dirty chunk at once for the echo harness's `snapFrame`), `trEvict` | `the trample's pixels` |
