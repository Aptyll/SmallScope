# js/ai/ai-callouts.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a rival's grudge said to its mark (YOU AGAIN); the words of the brain's flag answers (ON IT, GUARDING: who says them is `aiAnswerFlag`, js/ai/ai-team.js) | `callGrudge`, `CALL_GRUDGE_T`/`CALL_GRUDGE_SEEN`; `CALLS.onit`/`CALLS.guarding` | `grudges` |
| a bot's callout to its side: what each one is, when one is said, the anti-spam rules, the one door every call goes through | `CALLS`, `CALL_*`, `updateCallouts` (called from `updatePlay`, sim.js), `callLook`, `callFriend`, `callFree`/`callSaid`, `addCallout` (replayed by `evPlay`, js/net/events.js), `callouts` | `bot callouts` (the pixels: js/draw/callouts.js) |
