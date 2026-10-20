# js/sim/fortiva.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| FORTIVA's tuning and her four keys | `UNB_*`, `SEVER_*`, `DEFY_*`, `YOKE_*`, `NOKNEEL_*`, `FORT_AB` (joined into `CLASS_AB`, abilities.js) | `fortiva` › `tuning`, `the keys` |
| UNBROKEN, her passive (`HERO_PASSIVE.unbroken`, js/sim/heroes.js): resolve off hero damage dealt and taken, its drain, tenacity and basic-attack healing while high | `unbFeed`, `unbHurt`, `unbDeal`, `unbTick`, `unbOut`, the `HERO_TEN` and `HERO_STAT` rows | `fortiva` › `UNBROKEN` |
| Q, W, E: the arc and its healing edge, the shield and its shockwave, the lunge and its slowing strike | `fortSever`; `fortDefy`, `defyRelease`; `fortYoke`, `HERO_DASH.yoke`, `yokeStrike` | `fortiva` › `Q SEVER THE CHAINS`, `W DEFIANT HEART`, `E BREAK THE YOKE` |
| R: the leap, the knock-up at its heart, the after (tenacity and attack damage) | `noKneelAt`, `fortNoKneel`, `HERO_DASH.vault`, `noKneelLand` | `fortiva` › `R NO KNEELING` |
