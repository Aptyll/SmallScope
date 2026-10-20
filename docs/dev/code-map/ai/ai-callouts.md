# js/ai/ai-callouts.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a rival's grudge said to its mark (YOU AGAIN); the words of a bot answering a ping (ON IT: who says it is `aiAnswer`, js/ai/ai-team.js) | `callGrudge`, `CALL_GRUDGE_T`/`CALL_GRUDGE_SEEN`; `CALLS.onit` | `grudges` |
| a bot's callout to its side, and a player's ping (the same record, its sound `SFX.ping`): what each one is, when one is said, the anti-spam rules, the one door every call goes through | `CALLS` (the pings spread in from `PING_CALLS`, js/sim/pings.js), `CALL_*`, `updateCallouts` (called from `updatePlay`, sim.js), `callLook`, `callFriend`, `callFree`/`callSaid`, `addCallout` (replayed by `evPlay`, js/net/events.js), `callouts` | `bot callouts` (the pixels: js/draw/callouts.js) |
