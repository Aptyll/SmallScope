# Camps on the maps

A [camp](../world.md#camps) is a *named* place, so it has to be legible on every surface
that shows the world. `drawCampIcon(g, C, x, y, col, rim)` is the shared stamp: the spec's
`icon` rects inside a 7×7 box, drawn once inflated by 1 px in a rim colour and once in the ink,
so the same glyph reads on the chart, on snow and over forest.

- **The minimap** (`renderMinimap`) draws every camp's glyph through the same `drawChartCamps` as the
  M map, in the spec's `mark` over a dark rim, and the one under the pointer wears its name tag.
- **The M map** (`renderWorldMap`) draws the glyph plus the name in map ink under it — over it
  instead when a name already inked would run into it, since two sites sit a label's width
  apart — clamped
  to the map rect so a camp near the edge keeps its label. It opens mid-flight too (M in
  mode `drop`).
- **Arrival** says nothing: walking into a camp raises no plate (0.516 gave the top centre to the
  announcer, js/ui/announcer.js). The maps are where a camp is read by name.
