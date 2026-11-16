# js/ai/ai-farm.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a laner holding its blow until one hit finishes a soldier, what it remembers its blow does, which lane it holds, where it stands | `aiFarmHold` (its own soldiers' blows on the mark, `b.hitFoe`, at each kind's pace: `SOLDIER_TYPES`), `aiFarmFire` (rung 3 of `aiThink`), `aiFarmLearn` (from `hurtRobot`), `aiLane` (its position's lane), `aiLaneSpot` (no column: `laneHold`, js/sim/field.js, or the brush near it, `aiBrushWait`/`AI_BRUSH_R`/`AI_BRUSH_FWD`/`AI_BRUSH_LANE`), `AI_FARM_*` | `bot farm` |
| the early game every bot keeps to its position in, and a laner's leash to its lane | `aiLaning`/`AI_LANE_T` (read by `aiPlan` and the ladder), `aiLaneKept`, `aiOnLane`/`AI_LANE_LEASH` | `bot farm` |
| a jungler's walk: the den with its pack up, or waiting just outside the next one to come back, by its side's known clocks (`campLeft`, camps.js) | `aiDenSpot`, `aiFarmWalk` (rung 5f), `AI_DEN_EARLY` | `bot farm` |
| which position a bot plays (its draft's, `p.position`, or dealt by seat) and the job it makes | `aiPosDeal`/`AI_POS_FILL` (called by `aiPlan`, ai-team.js: `T.pos`), `aiPos`, `aiPosJob` | `bot farm` (the positions: `POSITIONS`, player.js) |
