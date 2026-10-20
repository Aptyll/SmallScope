# js/sim/sim.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the frame sim: momentum, day/night, timers; the camera, and its cut to a body set down far away | `update`, `updatePlay`, `CAM_CUT`/`camVp` | `update` |
| the wildlife's step of the frame: the animals, the lake's fish, the orca, the camps' clocks, the meadow's stock | `updateWildlife` (below `updatePlay`, which calls it) | `passive income` |
| one player's step off its input, and the walk inside it - the heading, the knockback's decay, the ice underfoot, the slide, the surface model, the world's edge - which a client also runs on its own body ahead of the host (`netPredictWalk`, net.js); and the step's named stretches, run in this order: the intents (stun, the fish hoist, the edge-triggered presses), what owns the velocity (the water, the roll, the rush, the rope, the leap, the cable, else the walk), the plunge into open water, the cover, the dodge charges and the stamina ghost, the marks left in the snow, the hands (swing, work, a tunnel's fresh press), the tool's draw and loose | `updatePlayer`, `walkHeading`, `kbDecay`, `iceUnder`, `walkSlide`, `walkStep`, `clampWorld`; `playerIntents`, `playerMove`, `playerPlunge`, `playerCover`, `playerStamina`, `playerTrails`, `playerSwing`, `playerAttack` | `the player's step` |
| the disc an arrow lands in round a body | `ARROW_HIT_R` (above `updatePlay`) | `update` |
| a shot meeting everything its step CROSSED, in the order it met it: the swept disc and box, the tile walk (roost, dummy, wall), every standing building by its drawn shape (the art's opaque box, a turret's turntable disc), the target faces and the three kinds of body - resolved by the arrow loop in `updatePlay` | `sweepDisc`, `sweepBox`, `artBox`/`structShotBox` (also drawn by `drawHitboxes`), `shotContacts`, `shotHits` | `the shot's sweep` |
| a map object's running clocks (the hit blink, the shiver, a picked bush and a mined rock growing back): starting one, ticking only the objects that have one, the rebuild after a load | `joltObj`, `timeObj`, `objTimed`, `objTiming`, `tickObjTimers` (called at the end of `updatePlay`), `objTimersRescan` (`saveApply`, js/sim/save.js) | `object timers` |
| the clock paying every player on the ground a coin, silently | `TRICKLE_GOLD`/`TRICKLE_T`, `trickle` (called in `updatePlay`'s player loop) | `passive income` |
| the zoom ease itself (runs first thing in `update`) | `applyZoom` | `update` |
| particles, floaters, footprints, drops, world-space snow flakes | `updateFx`, `makeFlake`, `fitFlakes` | `fx updates` |
| the belly-crawl drag furrow: emitted in `playerTrails` (updatePlayer's step), drawn as the `f.k === 3` branch | `footprints`, `p.trailD` | `update` (the draw branch: `drawFootprints`, js/draw/passes.js) |
