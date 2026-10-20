# js/ai/ai-farm.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a laner holding its blow until one hit finishes a soldier, what it remembers its blow does, which lane it holds, where it stands | `aiFarmHold`, `aiFarmFire` (rung 3 of `aiThink`), `aiFarmLearn` (from `hurtRobot`), `AI_LANE_ORDER`, `aiLaneDeal` (called by `aiPlan`, ai-team.js: `T.lanes`), `aiLane`, `aiLaneSpot` (no column: `laneHold`, js/sim/lanes.js), `AI_FARM_*` | `bot farm` |
| a jungler's walk: the den with its pack up, or waiting just outside the next one to come back | `aiDenSpot`, `aiFarmWalk` (rung 5f), `AI_DEN_EARLY`, `AI_JUNGLE_N`/`AI_LANE_N` (handed out by `aiPlan`, ai-team.js) | `bot farm` |
