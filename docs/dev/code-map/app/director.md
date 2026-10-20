# js/app/director.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| director mode's state, its keys (F7 on, arrows/HOME/PAGE UP/DOWN, F8 HUD, F9 the 9:16 frame, F2 record), the free and steady cameras, the strip | `director`, `dirTall` (read by `fitCanvas`), `directorKey` (from `keyPress`, input.js), `dirCam` (first in `update()`'s camera, sim.js), `DIR_*`, `drawDirector` (last in `render()`) | `director` (the detail: [media](../../media.md#director-mode-filming-the-live-game)) |
| the take: the canvas filmed through its own copy, the sounds off `SFX.tap`, the download | `dirRecStart`, `dirRecStop`, `dirRecFrame` (in `render()`, before `drawDirector`), `DIR_REC_TYPES` | `recorder` |
