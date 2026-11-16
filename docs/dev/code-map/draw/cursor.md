# js/draw/cursor.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what the pointer looks like this frame, and its key | `cursorLook`, `CUR_HOT`, `RETICLE`, `NOCK_STEPS` | (top) |
| the pointer's pixels, painted through `ctx` | `drawLook` | (top) |
| the system cursor wearing the look: the bake, the size limit, the hotspot | `hwCursor`, `bakeHwCursor`, `HW_CUR_MAX`, `HW_PAD` | `the system cursor` |
| what the frame still paints in-canvas (BROWSER setting, a director take, a look too big) | `applyCursorStyle`, `stockCursor` | `the system cursor` |
