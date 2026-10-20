# The M map does not pause

**M** opens the world chart with the sim still stepping (M, Escape or a click off the slab put it
away), the same deal the [build list](base-building.md) takes: night still falls, arrows still fly, bots still hunt you.
`sampleHumanInput` handles it in its own branch, and the rule is *the map keeps your feet and
nothing else*: `mx`/`my`, `slide` and the grapple's held key are read as usual, the edge-triggered
`dodge` passes
straight through, and `fire`/`work`/`eatBerry`/`eatFish`/`cmd` are dropped along with any held
draw (the pointer is over the parchment, so there is nothing to aim or work at, and an ability level
bought blind under the dim would be bought by accident). So you walk with the chart up and watch
your own marker cross it. Consequences worth knowing:

- The replay ring keeps recording (`replayLive`) — the capture point is above the map's dim, so
  the banked frames are clean world frames. `replayShowing` still hides the *window* under the panel.
- Dying with the map open is possible; `endMatch` clears `state.mapOpen`, and M only toggles in `play` and `drop` modes (mid-flight it is the ride's
  wide read; `landPlayer` closes it at touchdown), so the chart cannot survive into the death
  overlay.
- The world keeps the zoom you were playing at. The slab is UI and fits the view whatever the
  zoom (`fitMapSlab`, js/app/canvas.js: the chart takes the rows the view gives it, 96 up to
  `CHART_MAX` 232 px; [World zoom](../rendering/world-zoom-and-the-two-pixel-spaces.md)), so
  opening the map never touches the camera.
