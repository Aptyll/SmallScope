# Camps on the maps

A [camp](../world.md#camps) is a *named* place, so it has to be legible on every surface
that shows the world. `drawCampIcon(g, C, x, y, col, rim)` is the shared stamp: the spec's
`icon` rects inside a 7×7 box, drawn once inflated by 1 px in a rim colour and once in the ink,
so the same glyph reads on the chart, on snow and over forest.

- **The minimap** (`renderMinimap`) draws the glyph for any camp inside the disc, in the
  spec's `mark` over a dark rim. No name — `WOLF DEN` is wider than the whole disc (48 px at the default `settings.mmR` of 24).
- **The M map** (`renderWorldMap`) draws the glyph plus the name in map ink under it — over it
  instead when a name already inked would run into it, since two sites sit a label's width
  apart — clamped
  to the map rect so a camp near the edge keeps its label. It opens mid-flight too (M in
  mode `drop`).
- **Arrival** — `updatePlay` keeps `state.loc` (`{ L, t }`) for the local player from
  `campAt(player.x, player.y)`, and `renderUI` shows a toast top centre for ~3.5 s whenever it
  changes: a dark plate ruled in the spec's `mark`, the glyph, the name at 2× and the `tag` under
  it. It sits on a plate, so it uses `drawPixelTextShadow` (see
  [Text over the world](text-over-the-world.md)). The **day headline** (`state.dayPop`, set by each dawn and the landing in sim.js)
  shares the spot but not the plate: bare `DAY N` at 2×, nothing else. It wants BOTH the fade and
  the outline text over the world demands, so the opaque outlined stamp is baked once per day
  number (`dayPopCv`) and the canvas fades. It steps under the location plate when both are up.
