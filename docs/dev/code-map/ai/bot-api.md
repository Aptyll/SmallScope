# js/ai/bot-api.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a seat driven by a bot FILE: its step in place of `updateAI`, taking and leaving a seat, its live runtime (never saved: `p.botId` is) | `botStep` (called from `updatePlay`, sim.js), `botAssign`/`botRelease`/`botOpen`, `botRt`, `BOT_THINK` | `bot api` |
| what a bot sees and what it may send: the observation, the hello, the act read field by field, the thought it leaves on `p.ai.thought`, the side's `say` | `botObserve` (`BOT_OBS_R`, `BOT_NODES`/`BOT_NODES_N`, `botSeen`), `botHello`, `botAct` (`BOT_CMDS`, `BOT_SAY_MAX`), `botSetThought`, `botHear`, `botIdOf`/`botRefs` | `bot api` |
| where a program runs: the library, the transports, the lockstep a headless runner waits on | `BOT_LIB`/`botLibAdd` (the examples: js/baked/bot-lib.js, baked from bots/*.js by app/bake-bots.js), `BOT_TRANSPORTS` (`botInline`, `botWorker`, `BOT_PRELUDE`), `botPending`/`botGiveUp`, `botEnd`, `window.BOTS` | `bot api` |
