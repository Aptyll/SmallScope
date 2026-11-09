# js/ai/ai-team.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a bot's temperament and what it moves; the decision knobs read off the profile with their defaults | `AI_MOODS`, `aiMood`, `aiMoodOf`, `aiKnob`/`AI_KNOB_DEFAULT`, `aiJudge` | `team brain` |
| the side's plan: who pushes, guards, lanes, jungles, supports, stalks or hunts the bear (a seat it handed nothing: `aiRole` null), the stance, the window, the focus, the plan's order (`aiRank`, ai.js) | `AI_ROLES`, `AI_POS_FIT`, `aiTeams`, `aiTeamNew`, `aiPlan`, `aiRole`, `aiPlanRank`, `AI_PLAN_T`, `AI_WINDOW_*` | `team brain` |
| what the side has seen and who is calling: sightings, calls for help, the stalker's pick, the odds and the fall-back | `aiLook`/`aiSaw`, `aiCall`, `aiHumanCall`, `aiHelpCall`, `aiStalkTarget`, `aiOdds`, `aiFallBack`/`aiFallBackTo`, `aiForget` | `team brain` |
| the bear party | `aiSideBear`, `aiBearJob`, `AI_BEAR_*` | `team brain` |
| a bot's grudge, an ally saying ON IT to your ping, the fight's commit window | `aiDowned` (called from `die`, player.js), `aiGrudge`, `aiGrudgeFoe`, `AI_GRUDGE_*`, `aiAnswer`/`aiAnswerStep`, `AI_ONIT_T`/`AI_ONIT_STALE`, `aiHoldFoe`, `AI_COMMIT_*`, `AI_FLEE_HOLD` | `team brain` |
| what a bot is doing and why, for the dashboard; the one goal table, every goal word a bot (native or a bot file) writes and its kind and colour, which the F4 view, the recorder's export, the arena's match log and the Bot Lab read | `aiNote` (`p.ai.thought`), `AI_GOALS`, `AI_GOAL_KINDS` | `team brain` |
