# World zoom, and the two pixel spaces

**Zoom scales the world and nothing else.** The canvas keeps its `TARGET_ROWS` size at every
zoom level, so the HUD, the baked panels, the minimap and the cursor are pixel-identical
however close the camera is — scrolling in moves the camera, it does not magnify the interface.

That falls out of rendering in **two pixel spaces**:

| Space | Size | Written through | Holds |
| --- | --- | --- | --- |
| world | `WV_W`×`WV_H` | `ctx` while it points at `wctx` | ground → … → `renderLighting` |
| screen | `VIEW_W`×`VIEW_H` (backed by `VIEW * devScale` device px) | `ctx` while it points at `uictx`, under a `devScale` transform | weather, vignettes, all UI |

`ctx` is therefore **not a fixed binding**: `render()` sets `ctx = wctx` before the ground blit,
`renderAirLayer` points it at `actx` for the air layer, and `renderScreen` sets `ctx = uictx`. Between them it drops to the identity
transform and blits `worldCv` **in device pixels** at `k = zoomCur * devScale` px per world px,
then sets the `devScale` transform for everything below. Doing the scale-up as **one
nearest-neighbour resample of an already-composed frame** is what keeps it coherent: ground,
sprites, particles and floaters are drawn together at 1:1 first, so they share one pixel grid
instead of each rounding its own edges and shimmering against its neighbours.

Consequences a new pass has to respect:

- **A world pass bounds itself against `WV_W`/`WV_H`, never `VIEW_W`/`VIEW_H`.** Below zoom 1
  the world view is *wider* than the canvas, and culling to the canvas eats the edges.
- `worldCv` is allocated at the most zoomed-out size (`ZOOM_FLOOR`) once per
  canvas size, and each frame uses the `WV_W`×`WV_H` corner — never resize it per frame.
- Anything **UI-layer but anchored to a world point** (the radial wheel, the HOP OFF key cap over the
  roost, the archery round's off-screen markers, the gamepad's aim pointer) converts through `wToSX`/`wToSY`, and
  keeps its own pixel size.
- **A pointer position becomes a world position only through `mouseWX()`/`mouseWY()`**
  (`mouse / zoomCur + cam`). Aim, hover, the work target and the right-click tile all read them,
  so the zoom cannot be applied in one place and forgotten in another.
- The camera centres and clamps on `WV_W`/`WV_H`; the aim lean divides by `zoomCur` so it stays
  the same *fraction* of the view at every zoom.
- Weather and the vignettes sit **above** the blit deliberately: a flake keeps its own crisp
  size at every zoom, and its drift multiplies by `zoomCur` so the field still scrolls with the
  ground under it.

## The resting zoom is always pixel-exact

A world pixel ends up covering **`zoom × devScale` device pixels**. Unless that is a whole
number, some world pixels get an extra row of device pixels and their neighbours do not — which
on a 16×16 sprite is exactly what "stretched" looks like. So the zoom the player rests at is
not stored as a float at all:

- **`kWant` is that whole number** — device px per world px — and the wheel steps it by **±1**,
  clamped to `kMin()`…`kMax()` (`ZOOM_MIN` … `ZOOM_MAX` × `devScale`). `zoomWantOf()`
  derives the float scale as `kWant / devScale`.
- **The range is authored in rows of world on screen**, not in scale: `ZOOM_OUT_ROWS` (540, the
  whole clearing) and `ZOOM_IN_ROWS` (75, a face), and `ZOOM_MIN`/`ZOOM_MAX` are
  `TARGET_ROWS` over each (0.67 … 4.8 at 360 rows), so a taller frame neither hands out more
  vision at max-out nor loses the face at max-in. `DROP_ZOOM` is `ZOOM_MIN`.
- **A match opens at `ZOOM_REST` (2)**: every world pixel two canvas pixels, 180 rows of world on
  screen, so the 16 px art reads twice its old size by scale alone (no art was redrawn for it).
  `fitCanvas()` rungs `kWant` off it (6 at `devScale` 3), and re-rungs it from `kWant` itself on
  a resize, never from `zoomCur`, which a ride or a show may be holding elsewhere. The wheel still
  steps out to `ZOOM_MIN`.
- **The shows hold `ZOOM_SHOW` (1)**, the framing they were composed at: the title's backdrop,
  the drop brief's roost tour and the driven-off ceremony (`applyZoom`'s `show`, js/sim/sim.js), then
  ease back to the wheel's zoom. The ride itself keeps `DROP_OPEN_ZOOM` → `DROP_ZOOM`.
- The rungs are therefore `k / devScale`. At `devScale` 3 (a 1080p fullscreen) that is **third
  steps** — 0.67, 1, 1.33, 1.67 … 4.67, thirteen of them; at 4 (1440p) it is quarters, seventeen.
  A display with fewer pixels to spend gets fewer, coarser rungs, which is the honest answer
  rather than a lie.
- `sizeWorldView()` **ceils** (never rounds): `WV × k` must *cover* the canvas or a sliver of
  stale pixels survives down the right edge.
- `fitCanvas()` re-rungs `kWant` onto the new ladder (`round(zoomCur * dev)`) whenever `devScale`
  changes — a resize, a fullscreen toggle, a drag to another monitor.

**In motion it is deliberately not exact.** `applyZoom(dt)`, first thing in `update()`, eases
`zoomCur` toward `kWant / devScale` exponentially at `ZOOM_EASE` 16/s (~0.13 s to 90%,
frame-rate independent) and parks it exactly on the rung. **It zooms about the centre of the
view**: `camX`/`camY` name the top-left corner, so after `sizeWorldView()` it shifts them by
half the change in `WV_W`/`WV_H`, and the world point under the middle of the screen stays put
through every frame of the ease. Without that the picture pivots about the corner and the
slower follow camera drags it back over most of a second. While the ease runs the blit scale is
fractional and some pixels break the grid; nobody reads pixel edges mid-zoom, and it lands
clean — every rung is block-uniform at rest.

Nothing in that path touches the canvas, so it never calls `fitCanvas()`/`relayout()`, and no
overlay forces the zoom back to base — the fixed-size panels fit at any zoom.
`applyZoom(0, true)` snaps instead of easing, which is
what `beginDrop`/`landPlayer` use. The eagle ride forces `DROP_ZOOM` (the max-out view, `ZOOM_OUT_ROWS`
of world) for as long as mode is `drop`, after its opening shot eases out to it from `DROP_OPEN_ZOOM`; landing returns to whatever the player had set.
`DBG.setK(k, snap)` sets the rung directly, `DBG.setZoom(z, snap)` lands on the nearest rung,
and `DBG.getZoom()` reports `k`, `devScale`, `exact` and the whole `rungs` ladder. The scroll
wheel is zoom only (over the minimap it steps the disc's zoom instead).

**Mouse coords are divided by `scale` on the way in**, landing in screen space. Round positions
when drawing (`Math.round`) or sprites smear across subpixels.

**Canvas size changed → `fitCanvas()` then `relayout()`** (both
resize paths do it; both listeners live in canvas.js). `relayout()`
(js/sim/core.js) recomputes everything positioned off `VIEW_W`/`VIEW_H`, in this order:
`applyMinimapSize()` (the disc's anchors), `fitMapSlab()` (the chart's size, below), the
map/settings panel positions (`PANEL_X/Y`, `MAP_X/Y`, `SET_X/Y`, `SL_X`, `SET_MUTE_X`),
`fitFlakes()` (see [Snow](render-pass-order.md#snow)), `renderBars()` (re-bakes the pillarbox frame) and
`layoutReplay()`. Those panel `let`s are **declared together in js/app/canvas.js** (the file after
core.js), not down in their own panel sections, so by the time anything can call `relayout()`
none of them is still in a temporal dead zone — a new panel anchor is declared there too; the
offsets *within* each baked panel stay in their own sections. A screen authored
in the 270-row frame starts at `frameTop()` — `menuLayout()` shows the pattern (`toy` offset).

**The sub-pixel camera.** The world buffer's corner is the camera **floored** to a whole world
px (`ox`/`oy`, the screen shake folded in; also `wOX`/`wOY` for passes outside `render()`), and
the leftover fraction is spent at the blit: `worldCv` lands up-left of the canvas by
`round(fraction × k)` **device** px. So the screen scrolls by the device px while every world
pixel keeps its whole k×k block. A camera that moved only in whole world px stepped the whole
screen k px at a time (6 at a 1080p 2x), unevenly whenever a ride's speed was not a whole
number of px a step, and that full-screen judder was eye strain. `sizeWorldView()` adds the
spare world px on each axis the shift needs. The cost: a body the camera follows sits on the
world grid while the screen slides under it, so it wanders within half a world px of the centre.

**The air layer** removes that cost where it showed: the eagle the camera rides, and a player on a
zipline. A bird in flight (`dropFlies`: fly, dive, flee), anyone falling from it and a player on a
cable's handle (held out of the y-sorted pass in `airRiders`, so whoever that pass would not show
stays hidden) draw into `airCv` (js/app/canvas.js) off the **exact** camera, and the layer is blitted
over the world with no shift, so the body holds still on the screen while the ground slides under
it. A rider is drawn over the cable and the canopy. Only `airBox` is graded and blitted: the whole
frame while a bird flies (its trail and shadow reach across it), else a box `AIR_PAD`/`AIR_TOP`
round each rider and faller, grown with `airGrow`. `lightAir` lays the frame-wide grades over it (the
hour, the haze, the night and its rim, none of the ground's lights or shadows), cuts its empty
pixels back out with the layer's own shape (`airMask`), and stamps its names and frames ungraded
(`inWorldLayer` holds them back on both layers). A bird on the ground stays in the world buffer.
The replay banks the layer with the world (`airOn`).

Statics and movers share that whole-px corner (`ex`/`ey` are `ox`/`oy`): a mover subtracts
`ex`/`ey` from its exact position and rounds once at the end
([CLAUDE.md](../../../CLAUDE.md#hard-rules)), so it lands on the ground's own grid. New entity draw
code still uses `ex`/`ey`. A screen-space pass anchored to the world reads the exact camera
(`wToSX`/`wToSY`, `renderWeather(camX, camY)`), which matches the blit to the device px;
`drawTallies` takes the blit's own shift.
