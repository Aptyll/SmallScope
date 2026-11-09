# js/sim/varro.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| VARRO's tuning and his four keys | `PACK_*`, `LEAP_*`, `HOWL_*`, `SNAP_*`, `CALL_*`, `VARRO_AB` (joined into `CLASS_AB`, abilities.js) | `varro` › `tuning`, `the keys` |
| THE PACK, his passive (`HERO_PASSIVE.pack`): attack speed per wolf near him (`HERO_STAT` 'as', folded into `asMul`), his blows on beasts, his basic attacks on LUNGE's mark | `packNear`, `packStat`, `packDeal`, `packMarked` | `varro` › `THE PACK` |
| Q, W, E: the leap that steers for its body and marks it (`HERO_DASH.vleap`), the howl's slow and shove, the two strikes | `leapTarget`, `varroLeap`, `leapStep`, `leapLand`; `varroHowl`; `snapTarget`, `varroSnap`, `varroStrike` | `varro` › `Q LUNGE`, `W HOWL`, `E SNAP` |
| R: three wolves out of the nearest pines, on his side, hunting one hero (`HERO_SUMMON.pack`: they live in `animals`) | `callTarget`, `callSpots`, `varroCall`, `packStep` | `varro` › `R CALL THE PACK` |
