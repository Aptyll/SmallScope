# js/ai/ai-ladder.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the bot ladder, top to bottom: each rung a function that says whether it took the think, in the order `aiThink` asks them | `aiThink` |  `the ladder` |
| the think's shared read every rung gets (`k`: the profile, the plan and the role, the walks `walkTo`/`steerTo`/`aimAt`, the clocks, the two birds, what it minds) and the ping it answers (`order`, `want`) | `aiRead`, `aiOrders` | `the ladder` |
| the rival it fights and when it turns on them (focus fire, the held foe, a grudge, the siege, the charge); food; the burrow | `aiFoe`, `aiEat` (js/ai/ai.js), `aiBurrow` | `the ladder` |
| the rungs: a rival in sight, a camp it woke, backing off a DANGER ping, walking to a ping and holding or breaking a building there, its bird, the guard's post, the push, the escort, a call for help, a gold pump to take or hold, the bear party / stalker / scout, the road's wave, the hunt, loot, harvest, the roam | `aiFight`, `aiCampFight`, `aiBackOffRung`, `aiPingRung`, `aiDefendRung`, `aiHomeRung`, `aiGuardRung`, `aiPushRung`, `aiEscortRung`, `aiHelpRung`, `aiPumpRung` (`AI_PUMP_NEAR`, `AI_PUMP_N`, `AI_PUMP_IN`), `aiRoamJobs`, `aiRoadRung`, `aiHuntRung`, `aiLootRung`, `aiHarvestRung`, `aiRoam` | `the ladder` |
