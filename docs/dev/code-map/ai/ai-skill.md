# js/ai/ai-skill.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how well a bot plays: the four rival levels (every hand and choice field explained), the ally profile a notch above, the ladder's one pair of hands, which profile a player runs | `AI_LEVELS`, `AI_ALLY_PUSH`, `AI_ALLIES`, `AI_LADDER_HANDS`, `aiProfile` | `difficulty` |
| the hands between a decision and the input: noticing (the cone, a hit's wake-up), the read of a target and the aim wobble, each draw's release, the lapse, the crosshair's swing and the held draw, a blade's reach; the per-bot state the dashboard reads | `skillOf` (`p.ai.sk`), `skillTick`, `skillNotice`, `skillAim`, `skillDraw`, `skillSlip`, `skillHands`, `skillBlade`, `AI_SETTLE`/`AI_WOBBLE_T`/`AI_ALERT_T`/`AI_AIM_ON`/`AI_BLADE_CLOSE`/`AI_BLADE_HOLD` | `skill` |
