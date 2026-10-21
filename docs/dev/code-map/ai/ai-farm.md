# js/ai/ai-farm.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a laner holding its blow until one hit finishes a soldier, what it remembers its blow does, which lane it holds, where it stands | `aiFarmHold`, `aiFarmFire` (rung 3 of `aiThink`), `aiFarmLearn` (from `hurtRobot`), `aiLane` (its position's lane), `aiLaneSpot` (no column: `laneHold`, js/sim/lanes.js, or the brush near it, `aiBrushWait`/`AI_BRUSH_R`/`AI_BRUSH_FWD`), `AI_FARM_*` | `bot farm` |
| a jungler's walk: the den with its pack up, or waiting just outside the next one to come back, by its side's known clocks (`campLeft`, camps.js) | `aiDenSpot`, `aiFarmWalk` (rung 5f), `AI_DEN_EARLY` | `bot farm` |
| which position a bot plays (its draft's, `p.position`, or dealt by seat) and the job it makes; a support's carry, where it stands beside it, and leaving it the last hits | `aiPosDeal`/`AI_POS_FILL` (called by `aiPlan`, ai-team.js: `T.pos`), `aiPos`, `aiPosJob`, `aiCarry`, `aiSupportSpot`, `aiLeavesWave` (read by `aiNearestEnemy`, ai.js), `AI_SUP_*` | `bot farm` (the positions: `POSITIONS`, player.js) |
