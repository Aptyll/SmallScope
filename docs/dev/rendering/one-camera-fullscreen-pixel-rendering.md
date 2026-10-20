# One-camera fullscreen pixel rendering

Every player gets the **same camera** (the SC2/League model): the view always shows
`TARGET_ROWS` (360) rows of world — a 1920×1080 fullscreen is exactly 640×360 at 3×, 1440p is
the same frame at 4× and 4K at 6×, and other monitors buy sharpness with their extra pixels,
never zoom. There is deliberately **no resolution setting**; camera zoom is a gameplay feature
(below), not a display one. (The menus, panels and end screens are authored in a 270-row frame
and centred in the taller view through `frameTop()`, core.js — `FRAME_H` names it.)
`VIEW_W`/`VIEW_H` are `let`s set by `fitCanvas()`:

- It picks an integer **device**-pixel scale (via `devicePixelRatio`, so game pixels land
  exactly on device pixels even under fractional 125%/150% OS scaling) closest to
  `deviceH / TARGET_ROWS`. It does not depend on the zoom — the canvas is laid out the same at
  every zoom (see [World zoom](world-zoom-and-the-two-pixel-spaces.md)), which is what keeps the
  HUD a fixed size on screen. `scale` is fractional in CSS px and must not be floored.
- **The backing store is in device pixels**: `canvas.width = VIEW_W * devScale`. The UI still
  draws in `VIEW_W`×`VIEW_H` space — `render()` puts a `devScale` transform under it, so 1px
  rects and the 3×5 font blow up by a whole number and stay exact — and no layout code changes.
  The extra resolution exists for one reason: it is what lets a world pixel be a whole number of
  *device* pixels at zooms that are not whole numbers of *canvas* pixels.
- 720p, 1080p, 1440p and 4K all divide 360 rows into a whole scale (2×, 3×, 4×, 6×). A height
  that doesn't (a window, an odd panel) **"breathes"** a few percent — `VIEW_H` is
  `ceil(deviceH / dev)` — rather than letterbox or blur, the Terraria/Stardew trade. 16:9
  screens always fill edge-to-edge.
- `VIEW_W` is **capped at 16:9** (`ceil(VIEW_H * 16/9)`): wider-than-16:9 monitors get pillarbox
  bars instead of extra vision — the SC2 rule. Narrower screens simply see less width. A guard
  keeps the view at least 320×240 so the UI panels always fit.
- A third canvas, `#replay`, sits *above* `#game` and carries the replay window at device
  resolution; see [Replay](replay-the-last-four-seconds.md). It is the only thing drawn outside
  `#game`'s pixel grid, and the only reason is that the grid has too few pixels there.
- The bars are **themed, not black**: a second full-window canvas (`#bars`, z-order under
  `#game`, `pointer-events: none`) carries a static frost-panel frame — night slab, mottling,
  ice crystals, icicle fringes on the top and bottom edges, and an icy bevel hugging the game
  view — baked by
  `renderBars()` in the game palette. It spans `FULL_W` (the pre-cap window width in game px)
  and is deliberately darker than the world so the eye stays on the game; on ≤16:9 screens it
  is cleared and fully covered. It uses `hash2`, so it must never run before boot — it is baked
  once per canvas size by `relayout()`, never per frame, and the game never draws into it.
