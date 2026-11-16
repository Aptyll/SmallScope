# Cursor

The pointer is a **pixel-art cursor worn by the system cursor** (js/draw/cursor.js). Each look
is baked once into a small PNG at `devScale` device px per game px and set as the canvas's CSS
cursor (`image-set(url(...) <dpr>x) hx hy, <stock>`), so the OS draws it: it moves the instant
the mouse does, at the desktop's own speed, to the device pixel. A cursor painted into the canvas
trails the hand by the frames between the event and the screen and snaps to whole game px, and
that read as a slower mouse than the desktop (fixed 11-16). `cursorInfo()` resolves the pointer state once per
frame from `mouse`, `state`, `player` (draw/flounder/roll), and what's under the pointer, and
both the pixel cursor and the browser-cursor fallback read from it. It returns
`{ kind, mode, dim, frac, nock, amb }`:

- `kind` **arrow** — dead (off a plank), paused, map, and anywhere in the title/settings/wheel that isn't
  a widget; **hand** — over a hub target (`roomHit()`), a death-overlay plank (`deadHit()`) or spectate arrow (`specHit()`), a settings widget (`settingsHit()`, shared with the click handler
  so hover and click can never disagree), a live wheel segment, or an ability well or a potion slot (`stripHit()`); any other item slot is read, not
  handled, and stays an arrow, as does the strip's gold plate (see [The HUD corners](the-hud-corners.md)); **grab** — dragging a
  slider; **reticle** — everywhere else in play.
- Reticle `mode` (table `RETICLE`): **idle** white cross; **amove** red ring — the CLICK scheme's
  A is armed and the next left press lays the attack-move
  ([the click scheme](../multiplayer.md#the-click-scheme); its rings on the snow are
  `drawClickMarks`, js/draw/marks.js); **lock** gold ring — E will work
  the object under the pointer (`workTarget()` is non-null: tree, dead tree, a rival's building),
  dimmed when it is beyond `WORK_REACH`, and **never inside a merchant's reach**, where E is the
  counter's ([opening it](../gameplay/the-merchants-counter.md#opening-it)) and a ring would promise a swing the key does
  not make; **ice** the same lock in pale blue over bare ice;
  **hunt** amber breathing ring over an animal, a rival player or a rival robot (`unitUnder`,
  actions.js — the same boxes the CLICK scheme's right button picks a body by); **bow** — while charging the ring closes as
  the draw fills and turns pale gold at full, like the meter. `dim` (50% alpha) also means attacks
  are blocked right now: floundering in a hole, or mid-roll.
- Every reticle in play also carries the **attack's own state**, whatever the pointer is
  over, since the crosshair is where the eye already is: `nock` (0→1 over `attackCycle`) draws
  four gold corner marks falling inward onto the ring. It comes from the one `ret()` helper inside
  `cursorInfo`, so no return site can forget it. See
  [the cycle](../gameplay/the-swing-tools-e.md#the-cycle).
- Sprites live in `SPRITES.cursor.{arrow,hand,grab}` (`CUPAL`, lit top-left, icy
  bevel) with one-colour `SPRITES.cursorShadow` twins drawn 1 px offset beneath; hotspots are
  in `CUR_HOT`. Reticles are procedural via `drawOutlinedRects()` (dark rim pass, then fill),
  which the aim line's markers reuse.
- `cursorLook(info, now)` turns the state into a look with a `key` holding every value that
  changes a pixel (the renock marks step in whole px, `NOCK_STEPS`); `drawLook` paints a look
  through `ctx`, and `bakeHwCursor` points `ctx` at a scratch canvas to bake one, crops it, and
  blows it up nearest-neighbour. `hwCursor` caches the CSS value per key, cleared when the px
  size or the DPR changes. The hotspot is an arrow tip's top-left device px, a reticle dot's middle.
- **What is still painted in-canvas** (`applyCursorStyle` returns it, the frame's last step draws
  it at `round(mouse)`): a look over `HW_CUR_MAX` CSS px a side, which Chromium refuses (a 4K
  screen at 100% during a renock: the system cursor wears the ring and only the falling marks
  are painted); everything while a director take records (`director.rec`), so the footage holds
  the pointer. `mouse.inside` and `DBG.hideUI` hide that painted part.
- `settings.pixelCursor` (default **on**, the CURSOR row in the ESC menu: PIXEL/BROWSER)
  switches to the nearest stock cursor (`stockCursor`: `crosshair`/`pointer`/`grabbing`/`default`).
  `canvas.style.cursor` is set only on change. A headless screenshot holds no system cursor.
