# js/sim/orca.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca: its tuning, its water and the homes it cruises to, putting it in at boot, the cruise, who it locks on and why it lets go, the countdown's clock, the stalk (the pass and the run in), the strike that breaks the ice, the bite and its one-shot, the countdown a player wears | `ORCA_*`, `ORCA_FRESH`, `orca`, `orcaWater`/`orcaHome`, `orcaAge`, `orcaTileIn`/`orcaIn`/`orcaClear`, `orcaIce`/`orcaOnIce`, `orcaPrey`, `spawnOrca` (boot, after `spawnFish`), `orcaGoal`, `orcaSwim`, `orcaUnder`, `updateOrca` (from `updateWildlife`, sim.js, after `updateFish`), `orcaLook`, `orcaPass`, `orcaStalk`, `orcaStrike` (`iceBreak`, icebreak.js), `orcaBite` (`unitsHit`, `hurtUnit` cause `orca`), `orcaLethal`, `orcaLine` | `orca` (its lake: `orcaLakeEdge`/`orcaLakeAt`, world.js; the pixels: js/draw/orca.js; the count's: `drawOrcaCount`, js/draw/overhead.js; save: `SAVE_ROOTS`; wire: `snapSingles`, the client's ease: `netClientLerp`, net.js) |
| a bot the orca is after: the way off its ice | `orcaShore` (rung 0b of `updateAI`, ai.js; the bot API's `me.orca`, js/ai/bot-api.js) | `orca` |
