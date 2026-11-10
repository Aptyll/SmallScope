# js/ai/ai-ladder.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the bot ladder, top to bottom: each rung a function that says whether it took the think, in the order `aiThink` asks them | `aiThink` |  `the ladder` |
| the think's shared read every rung gets (`k`: the profile, the plan and the role, the walks `walkTo`/`steerTo`/`aimAt`, the clocks, the two birds, what it minds) and the ping it answers (`order`, `want`) | `aiRead`, `aiOrders` | `the ladder` |
| the rival it fights and when it turns on them (focus fire, the held foe, a grudge, the siege, the charge); the potion; the wild things it may turn on (a bear party's bear, the nearest wolf at its ward) | `aiFoe`, `aiDrink` (js/ai/ai.js), `aiWildFoes` | `the ladder` |
| the rungs: a rival in sight, a camp it woke, backing off a DANGER ping, walking to a ping and holding or breaking a building there, its bird, the guard's patrol and post, the push, a call for help, a gold pump to take or hold, the bear party / stalker / the position's walk, the road's wave, the hunt, harvest, the roam | `aiFight`, `aiCampFight`, `aiBackOffRung`, `aiPingRung`, `aiDefendRung`, `aiHomeRung`, `aiGuardRung`, `aiPushRung`, `aiHelpRung`, `aiPumpRung` (`AI_PUMP_NEAR`, `AI_PUMP_N`, `AI_PUMP_IN`), `aiRoamJobs`, `aiRoadRung`, `aiHuntRung`, `aiHarvestRung`, `aiRoam` | `the ladder` |
