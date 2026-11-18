# js/draw/cove.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca's cove, drawn: the cut-stone face hanging under every pine wall round the cove (strata, a foot line of its own darkest stone, its shade, icicles off the lip) and the grotto's broken rock behind the waterfall, baked once and laid flat under all that stands | `coveRimBuild` (its lip one clean line: the tiles softened and a slow wander, `COVE_LIP_WANDER`), `coveRock`, `COVE_ROCK`, `COVE_FACE`, `COVE_STONE`, `drawCoveRim` (`drawFlatPass`, passes.js); the pines on the lip drawn standing back from it, `coveBack`/`COVE_PINE_BACK` (`drawSceneryObj`, passes.js) | `the orca's cove, drawn` (the cove itself: `COVE`, `COVE_FALL`, js/sim/field.js) |
| the waterfall: its curtain of per-column streaks, frozen edges and white curl, the foam at its foot, the plunge pool, its rings and spray, each frame of the loop a pure function of its number, baked once and drawn y-sorted at the grotto's foot | `coveFallFrame`, `COVE_FRAMES`/`COVE_FRAME_S`/`COVE_FALL_V`, `coveDraws` (`gatherDraws`, passes.js), `drawCoveFall` | `the orca's cove, drawn` |
