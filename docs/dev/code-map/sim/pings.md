# js/sim/pings.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| tuning: how long a ping shows, the spam guard, how far bots hear one and how many answer, how long they hold the spot, the DANGER ring | `PING_T`, `PING_BURST`/`PING_WINDOW`/`PING_GAP`, `PING_R`, `PING_HEAR`, `PING_ANSWERS`, `PING_IN`, `PING_FOLLOW`, `PING_STAY`, `PING_DANGER_R`, `PING_BACK_T` | `pings` |
| the five pings: their words and inks, and the wheel's order (GO HERE is the tap) | `PING_CALLS` (spread into `CALLS`, js/ai/ai-callouts.js), `PING_KINDS`, `PING_WHEEL` | `pings` |
| a player's ping landing: the spam guard, the callout it becomes (team-only online through the `call` event), the bots it steers | `pingReady`, `pingCmd` (from `runCmd`'s `ping`, js/ui/wheel.js), `pingSteer` (what bots do with it: `aiOrders`, `aiPingRung`, `aiBackOffRung`, js/ai/ai-ladder.js) | `pings` (the pixels: `drawPingMark`, js/draw/callouts.js) |
