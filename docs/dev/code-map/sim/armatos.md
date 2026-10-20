# js/sim/armatos.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| ARMATOS's tuning and his four keys | `RESOLVE_*`, `VERDICT_*`, `HOLD_*`/`BASH_*`, `MARCH_*`, `GUARD_*`, `ARM_AB` (joined into `CLASS_AB`, abilities.js) | `armatos` › `tuning`, `the keys` |
| LEGION'S RESOLVE, his passive (`HERO_PASSIVE.resolve`, js/sim/heroes.js) | `resolveHurt`/`resolveCast`/`resolveTick` | `armatos` › `LEGION'S RESOLVE` |
| Q, W, E: the line slam, the brace and its bash, the march | `unitsInLine`, `armVerdict`; `armBrace`, `holdTaken` (`HERO_TAKEN`), `armBash`; `armMarch`, `marchStep` (`HERO_DASH.march`), `marchEnd` | `armatos` › `Q IRON VERDICT`, `W HOLD THE LINE`, `E VETERAN'S MARCH` |
| R: the planted standard, who it guards, its armor and tenacity, the slow on leaving | `guards`, `armGuard`, `guardFor`, `guardStat` (`HERO_STAT`), `guardTen` (`HERO_TEN`), `guardAllies`, `updateGuards` (`HERO_TICK`), `guardPlanted` | `armatos` › `R THE OLD GUARD` |
| how a bot picks one of his keys | `abBotKey` (each row's `bot`; asked by `aiThink`, ai-ladder.js) | `armatos` › `bots` |
