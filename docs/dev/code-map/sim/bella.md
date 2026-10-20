# js/sim/bella.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| BELLA's tuning and her four keys | `PREC_*`, `EDGE_*`, `LUNGE_*`, `PARRY_*`, `OUT_*`, `DUEL_*`, `FLURRY_*`, `BELLA_AB` (joined into `CLASS_AB`, abilities.js) | `bella` › `tuning`, `the keys` |
| CALCULATED STRIKES, her passive (`HERO_PASSIVE.calculated`, js/sim/heroes.js): precision off basic hits on heroes, spent by the next key for an edge and a burst of speed; the E mark's bonus | `precisionDeal`, `bellaTick`, `bellaMoveMul`, `bellaOut` | `bella` › `CALCULATED STRIKES` |
| Q, W, E: the lunge and its refund, the parry and its riposte, the slip through a body and its mark | `bellaLunge`, `HERO_DASH.lunge`, `lungeStep`; `bellaParry`, `parryTaken`, `bellaRiposte`; `slipTarget`, `bellaSlip`, `HERO_DASH.slip`, `slipStep` | `bella` › `Q FIRST CUT`, `W PERFECT PARRY`, `E OUTMANEUVER` |
| R: the duel called on a hero, the key again's flurry and its finisher | `duelTarget`, `bellaDuel`, `flurryTarget`, `bellaFlurry`, `bellaStrike` | `bella` › `R THE FINAL GAMBIT` |
