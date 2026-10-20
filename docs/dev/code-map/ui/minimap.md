# js/ui/minimap.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the minimap (and the disc's inverse projection, for a walk ordered on it) | `renderMinimap`, `mmClockShown` (the clock under the disc, only while no team rail is up), `mmWorldAt`, `updateMinimap` (throttled to `MM_REBUILD` ticks), `mmChrome`/`mmArcBand` (the disc's baked chrome and cached day/night arc band), `mmMask`/`mmRing`/`mmView` | `minimap` (the disc's per-tile colour comes from `objMapColor(o)`: `world`, world.js; the marks over it: `drawMap*`, js/draw/marks.js) |
