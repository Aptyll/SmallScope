# UI panels are baked once

`buildMapPanel()`, `buildSettingsPanel()` and `buildHelpPanel()` draw the static chrome (parchment,
labels — the map slab's header is live, since the day changes) into offscreen canvases (the map slab is the HUD's graphite plate, `drawHudFrame`; the help slab is a frost slab, `bakeFrostSlab()`; the settings slab and the SAVES slab in its place are flat, `bakeFlatSlab()`, both js/ui/panels.js); per-frame code blits them and draws only the live parts on top.
Their layout variables (`PANEL_*`, `MAP_*`, `SET_*`, `SL_X`) are shared between the bake
function and the per-frame code, so both sides move together — but a bake-side change only appears
after the panel is rebuilt. They are declared in js/app/canvas.js and reassigned by `relayout()`
([above](world-zoom-and-the-two-pixel-spaces.md)). The ESC slab's **rows have no fixed anchors**:
it is tabbed, and each page lays its rows out (and scrolls them) through `settingsLayout()`
(js/ui/panels.js) off `SET_X`/`SET_Y`/`SL_X` alone. A bake draws in panel-relative coordinates,
so a recenter never requires a re-bake — keep any new bake-side label and its per-frame widget
expressed the same way.

The [counter](../gameplay/the-merchants-counter.md#the-panel) bakes nothing: it draws on the HUD's own graphite plate
(`drawHudFrame`, js/ui/strip.js) every frame at a constant `SHOP_W` × `SHOP_H`, and only its
*position* moves on a resize (`shopLayout`).

The map panel's chart is a `MAP_W`-square slot **fitted to the view** (`fitMapSlab()`, below:
96 to `CHART_MAX` 232 px), so every tile-space position drawn on the chart (the camera rect,
every mark) is multiplied by `MAP_S = MAP_W / WORLD`, and `mapTileAt` is the inverse. **The chart
is a drawn map, not a photograph of the tiles**: `buildWorldMapImg()` files every tile under a `CH_*` class
(`objChart(o)` for what stands on it, else the ground array), flattens the class map — a lone
tile of forest or ice is ground again, a snow pinhole with three sides of one mass is that mass
(`CHART_NEED`) — resamples it into the slot by priority (`chartSpan`: each chart pixel takes the
highest class among the tiles it covers, so a one-tile wall never drops out of its run when a
small window folds the 232 tiles into fewer px), and paints one flat ink per class (`CHART_INK`) — **a flat chart** in quiet greys:
pale snow for the open ground, deep slate for the woods, cold blue for the ice and the creek, a
tan track for the road. Nothing is painted over the inks — no lit or inked rims, no grain — since
the marks and the team inks are the read, and shading fought them. No grid: a single
bush, rock or stump has no class and shows the ground, because at that scale a speck is noise;
the buried chests keep theirs, a gold speck being a thing worth walking to. A side's buildings
and its bird are two depths of one team ink (`chTeam`/`chEagle`, through `skin()`), so a base
reads as a shape in its colour with the bird bright at its heart. The sim keeps stepping under
it and the local player keeps walking
([the M map does not pause](../gameplay/the-m-map-does-not-pause.md)), so every live part — the
camera rect, every body's mark, the watched body's heart — moves while the chart is open; the
image itself is re-inked at most every `MM_REBUILD` ticks, like the minimap's, so a wall built
or a tree felled behind the parchment shows up on it within half a second.

**One grammar for both maps** (`drawMapDot`/`drawMapUnit`/`drawMapYou`/`drawMapBird`, the
`what a body looks like on a map` group in js/draw/marks.js): a square in its side's ink is a
body — a player one step bigger than a robot (3 vs 2 px on the chart, 2 vs 1 on the disc), and
every worker, soldier and merchant standing is drawn, none of them hides; the watched body
(`viewPlayer()`: you, or whoever the camera rides) is a player's square gone white inside a ring
of its side's ink, never a colour of its own that would read as a third team; the bird diamond
is an objective, roosted or flying. Each sits on a 1 px rim in the map's own dark. Under a
colour-blind palette a rival's square is a cross instead (`foeCue`, [teams and colours](../multiplayer.md#teams-and-colours)). **The slab is
the chart and a header, nothing else**, and it **fits the view**: `fitMapSlab()` (canvas.js, from
`relayout`) gives the chart every row the view has up to `CHART_MAX` (232 — the match world at one
px a tile, so a monitor charts at 1:1) with `MAP_SIDE`/`MAP_HEAD`/`MAP_FOOT` of parchment round it
(a window at the 240-row floor gets a 200 chart), and `mapAlloc()` (js/ui/panels.js) remakes the chart's
buffers and re-bakes the slab whenever `MAP_W` changes. The slab is the HUD's **graphite plate**
(`drawHudFrame`, its four corners cut), the chart in a one-pixel dark frame. In the header
(`MAP_HEAD_Y`) is the day at 2× in pale ink, and **no close button**: M or Escape closes the chart,
and so does a press anywhere off the slab (`mapCloseHit` in `pointerPress`, play and drop alike).
There is no compass (the chart is north-up, as the world is), no key (the marks are the minimap's
own), no clock (the rail or the disc wears it), no title, and **no camp names until asked**: each
camp is its glyph in its camp's ink (grey with its seconds under it while it is cleared,
`drawCampMark`, as on the minimap), and the one under the pointer (within `CHART_HOVER_R`) lights
white and wears its name on a small graphite tag running away from the chart's middle
(`drawChartCamps`/`chartTag`). The ziplines on both maps are `drawMapZip` (js/draw/marks.js): a
crisp two-pixel ribbon in the side's ink, pylon to pylon, each pylon a pale pixel on it
(`MAP_ZIP_PYLON`), drawn under every body. Every mark on the chart sits on the minimap's own dark (`CHART_DARK`), so a mark reads the
same on both maps.
The minimap is a scrolling viewport, not a whole-world view: `renderMinimap()` blits a
`MM_R / s`-tile square of `mmCv` around `viewPlayer()` into the disc, where `s = mmScale()` is
px per tile — an eased `mmCur` chasing `MM_ZOOMS[settings.mmZoom]` (0.25 … 4 over twelve rungs,
index 5 = the 1:1 baseline) on the same `ZOOM_EASE` the camera uses, so both zooms under one
hand feel like one control. A save written before `settings.v` indexes the old six-rung ladder
and is carried across by `MM_MIGRATE` on load. Stepped by the
scroll wheel while `overMinimap()` (pointer inside the disc + ring), which pre-empts the camera
zoom in the wheel handler and is saved with the settings. Every marker drawn over it (robots, players,
camp glyphs, the callouts and your side's [pings](../gameplay/pings.md)) multiplies its tile
offset by `s`. The disc sits on an opaque graphite
backing (`AB_BG`, to `MM_R + 5`; its day ring's track is `HUD_EDGE`) inside a **strong 2 px
`HUD_INK` outline** (to `MM_R + 7`), the HUD frame's own three inks since 0.459, and it has **no
hover state** — the chrome is baked once per radius and looks the same whatever the pointer does;
there is no halo or second ring outside it. `overMinimap()` reaches to that outline's outer edge. **No `arc()` anywhere in it**: canvas arcs anti-alias, and at
game resolution that reads as blur, so `mmRing(g, cx, cy, r0, r1, col, a0?, a1?)` paints the
backing, rims and the day/night band one pixel at a time (pixel-centre distance test, optional
clockwise angle span), and the map view is clipped by `mmMask(r)` — a cached pixel disc
composited with `destination-in` on the `mmView` scratch canvas — instead of `clip()`.
**But `mmRing` must never run per frame**: it is a per-pixel `hypot`/`atan2` loop issuing a
`fillRect` per lit pixel (~1.6 ms a frame when it did). The static chrome (outline, silhouette,
the ring's track) is baked per `MM_R` alone in `mmChrome`, and the day/night arcs plus the dusk tick per `(MM_R, progress step)` in `mmArcBand` — the
cycle quantised to `MM_ARC_STEPS` (512), about a pixel of arc per step, so the band repaints
every couple of real seconds. Only the progress tip, the centre dot and the markers are
per-frame fills. The terrain image is throttled the same way: `updateMinimap()`'s full
`WORLD²` sweep (a `structOf` call per tile) reruns at most every `MM_REBUILD` (30) sim ticks —
at one map pixel per tile, a build or a cut ice hole arriving half a second late is invisible.
