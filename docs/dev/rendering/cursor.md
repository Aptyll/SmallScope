# Cursor

The native pointer is hidden over the canvas and a **pixel-art cursor is drawn in-canvas** as
the very last thing in `render()` (above every overlay and the info stack), so it sits on the
game's pixel grid at every zoom level. `cursorInfo()` resolves the pointer state once per
frame from `mouse`, `state`, `player` (draw/flounder/roll), and what's under the pointer, and
both the pixel cursor and the browser-cursor fallback read from it. It returns
`{ kind, mode, dim, frac, nock, amb, piece }`:

- `kind` **arrow** — dead (off a plank), paused, map, and anywhere in the title/settings/wheel that isn't
  a widget; **hand** — over a live main-menu item (`menuHit()`, frozen planks stay an arrow), a death-overlay plank (`deadHit()`) or spectate arrow (`specHit()`), a settings widget (`settingsHit()`, shared with the click handler
  so hover and click can never disagree), a live wheel segment, or a control inside the backpack
  widget (`bagHit()`) or an ability or meal well (`stripHit()`); an item slot is read, not
  handled, and stays an arrow, as does the strip's gold plate (see [The HUD corners](the-hud-corners.md)); **grab** — dragging a
  slider, **or carrying an item on the cursor** (`state.drag`, which outranks everything: the drag
  ghost *is* the cursor until it is put down);
  **reticle** — everywhere else in play.
- Reticle `mode` (table `RETICLE`): **idle** white cross; **cast** gold ring — the MOUSE scheme's
  readied ability, dim while it cannot cast ([the mouse scheme](../multiplayer.md#the-mouse-scheme));
  **amove** red ring — the CLICK scheme's
  A is armed and the next left press lays the attack-move
  ([the click scheme](../multiplayer.md#the-click-scheme); its rings on the snow are
  `drawClickMarks`, js/draw/marks.js); **lock** gold ring — E will work
  the object under the pointer (`workTarget()` is non-null: tree, rock, berried bush),
  dimmed when it is beyond `WORK_REACH`, and **never inside a merchant's reach**, where E is the
  counter's ([opening it](../gameplay/the-merchants-counter.md#opening-it)) and a ring would promise a swing the key does
  not make; **ice** the same lock in pale blue over bare ice;
  **hunt** amber breathing ring over an animal, a rival player or a rival robot (`unitUnder`,
  actions.js — the same boxes the CLICK scheme's right button picks a body by); **fish** water-blue ring over a fish; **bow** — while charging the ring closes as
  the draw fills and turns pale gold at full, like the meter. `dim` (50% alpha) also means attacks
  are blocked right now: floundering in a hole, or mid-roll.
- Every reticle in play also carries the **attack's own state**, whatever the pointer is
  over, since the crosshair is where the eye already is: `nock` (0→1 over `attackCycle`) draws
  four gold corner marks falling inward onto the ring. `amb` (buried, settled: the next shot is worth
  `AMBUSH_MUL`) grows a second segment out along each of the crosshair's **own axes** and warms the
  centre pixel to gold — deliberately on the cross, where the renock's marks are on the diagonals,
  so a bow that is both reloading and buried says two separate things at once. Both come from
  the one `ret()` helper inside `cursorInfo`, so no return site can forget them. See
  [the cycle](../gameplay/the-swing-tools-e.md#the-cycle) and [Prone](../gameplay/prone-under-the-snow.md).
- Sprites live in `SPRITES.cursor.{arrow,hand,grab}` (`CUPAL`, lit top-left, icy
  bevel) with one-colour `SPRITES.cursorShadow` twins drawn 1 px offset beneath; hotspots are
  in `CUR_HOT`. Reticles are procedural via `drawOutlinedRects()` (dark rim pass, then fill),
  which the aim line's markers reuse.
- `settings.pixelCursor` (default **on**, the CURSOR row in the ESC menu: PIXEL/BROWSER)
  switches to the native pointer; `applyCursorStyle()` then maps the same state to the
  nearest CSS cursor (`crosshair`/`pointer`/`grabbing`/`default`) and sets
  `canvas.style.cursor` only on change. `mouse.inside` (set by mousemove, cleared by
  `mouseleave` on the canvas and document) hides the drawn cursor when the pointer leaves,
  and `DBG.hideUI` hides it for captures.
