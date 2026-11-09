# js/sim/hiems.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| HIEMS's tuning and her four keys | `CHILL_*`, `FREEZE_*`, `ICICLE_*`, `GLAZE_*`, `SNAP_*`, `WHITE_*`, `HIEMS_AB` (joined into `CLASS_AB`, abilities.js) | `hiems` › `tuning`, `the keys` |
| DEEP CHILL, her passive (`HERO_PASSIVE.deepchill`): a chill on every blow of hers (keys and staff), the third freezing the body (`stunUnit`), the wait before the next freeze; the clocks on every body | `hiemsChill`, `hiemsDeal`, `updateChill` | `hiems` › `DEEP CHILL` |
| Q, W, E: the shard in flight, the clear ice a rival skates on (`HERO_ICE`), the burst that roots the chilled | `hiemsIcicle`; `hiemsGlaze`, `onRivalGlaze`, `hiemsIceUnder`, `updateGlazes`; `hiemsSnap` | `hiems` › `Q ICICLE`, `W CLEAR ICE`, `E COLD SNAP` |
| R: the blizzard riding her: slow, a sting and a chill each second, a rival hero inside blinded (`HERO_SIGHT`, a multiplier) | `hiemsWhiteout`, `inRivalStorm`, `hiemsSight`, `updateStorms` | `hiems` › `R WHITEOUT` |
| what she leaves in the world (`hiemsGlazes`, `hiemsStorms`: `SAVE_ROOTS`, packed in snapshot.js), stepped once a step (`HERO_TICK`) | `updateHiemsWorld` | `hiems` › `R WHITEOUT` |
