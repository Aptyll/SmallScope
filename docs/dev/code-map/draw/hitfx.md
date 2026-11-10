# js/draw/hitfx.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a big hit looks like on the body it lands on: which hits count (`HIT_BIG`, a share of max health), the hit-stop and catch-up, the 1 px recoil, the white spark toward the blow, the snow puff at the feet | `hitAge` (the last blow's `tallyLast`/`tallyTick`), `hitNudge` (from `drawSorted`), `drawHitPuffs` and `drawHitFx` (from `render()`), `drawHitSpark`, `drawHitPuff`, `HIT_*` | `hit feedback` (drawn from snapshot fields only: `tallyHit`, js/sim/core.js, and `hitAim`, js/sim/actions.js) |
| an ordinary blow on a hero or a beast: the small spark on the struck side and the body 1 px back, no hit-stop, no snow, never on a soldier | `HIT_SMALL`, `HIT_SMALL_T`, `hitBig` (set by `hitAge`), `drawHitTick` | `hit feedback` |
| a level gained, on the body: the gold band climbing the sprite, the gold streaks leaping from the snow round the feet (the plate's blink: `drawLevelBadge`, js/draw/overhead.js) | `drawLevelUp` (from `drawPlayer`), `LV_*` (the clock: `p.lvT`, `LEVEL_FX_T`, js/sim/player.js) | `a level gained` |
| a potion at work, on the body: a small green heart lifting off beside it, one side then the other, off `p.potT` | `POT_*`, `drawPotionHearts` (from `drawPlayer`, over the body) | `a potion at work` |
