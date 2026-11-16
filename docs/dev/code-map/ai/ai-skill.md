# js/ai/ai-skill.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how well a bot plays: the four rival levels (every hand and choice field explained), the ally profile a notch above, the one pair of hands every bot file's seat plays with, which profile a player runs | `AI_LEVELS`, `AI_ALLY_PUSH`, `AI_ALLIES`, `BOT_FILE_HANDS`, `aiProfile` | `difficulty` |
| the hands between a decision and the input: noticing (the cone, a hit's wake-up), the read of a target and the aim wobble, the attack's reaction lag and planted feet, the lapse, the crosshair's swing; the per-bot state the dashboard reads | `skillOf` (`p.ai.sk`), `skillTick`, `skillNotice`, `skillAim`, `skillSlip`, `skillHands`, `skillStrike`, `AI_SETTLE`/`AI_WOBBLE_T`/`AI_ALERT_T` | `skill` |
