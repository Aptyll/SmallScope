# js/draw/hitfx.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a big hit looks like on the body it lands on: which hits count (`HIT_BIG`, a share of max health), the hit-stop and catch-up, the 1 px recoil, the white spark toward the blow, the snow puff at the feet | `trackHits` (from `gatherDraws`), `hitNudge` (from `drawSorted`), `drawHitPuffs` and `drawHitFx` (from `render()`), `drawHitSpark`, `drawHitPuff`, `HIT_*` | `hit feedback` (read off `tallyHit`, js/sim/core.js, and the body's `kbx`/`kby`) |
