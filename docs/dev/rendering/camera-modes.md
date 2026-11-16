# Camera modes

League's two cameras, one setting apart (`settings.camFree`: the GAME page's CAMERA row, the
`camLock` key, Y by default, or the padlock against the minimap's top-left corner,
`mmLockRect`/`drawMmLock`, js/ui/minimap.js: shut while LOCKED, open while FREE). The code is the
`camera modes` banner of js/app/canvas.js; the follow it gates is the camera block of `update`
(js/sim/sim.js).

- **LOCKED** rides the body `viewPlayer()` names, as the camera always has: your hero with its aim
  lean, or while you are down your fall or the ally you watch.
- **FREE** stays where it is put. The pointer within `CAM_EDGE` game px of a screen edge, or past
  it in a pillarbox bar (`mouse.rawX`/`rawY`/`inWin`, read off the window rather than the canvas),
  pans it at `CAM_PAN` game px of screen a second, the same on screen at any zoom (`camEdge`). No
  pan under the ESC slab, the M chart, a wheel, pause, or a window out of focus. The intro glide
  onto a fresh or respawned body plays out first.
- **The centre key** (`camCentre`, F by default) cuts straight onto the watched body on its press
  and keeps the camera there while held (`camStep`).
- **The minimap** takes the camera on a left press and carries it while the button is held
  (`camDragStart`/`camDragEnd`, the point from `mmCamAt`, clamped onto the square so a drag that
  runs off its edge keeps the edge). LOCKED springs back to the body on the release; FREE stays.
  The white box on the minimap is the camera's own frame, so it follows every mode.
- **While you are down** a FREE camera rides the watched body (your fall, or an ally) until an
  edge pan or a minimap press takes it off (`camLoose`); the centre key, or stepping to another
  ally (`specNext`, js/ui/screens.js), puts it back on.

The camera is this screen's alone, never the sim's: a client pans and drags exactly as a host
does, and nothing here travels.
