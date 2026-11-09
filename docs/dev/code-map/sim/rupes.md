# js/sim/rupes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| RUPES's tuning and his four keys | `PACK_*`, `HEAVE_*`, `SHED_R`, `SHOULDER_*`, `AVA_*`, `RUPES_AB` (joined into `CLASS_AB`, abilities.js) | `rupes` › `tuning`, `the keys` |
| SNOWPACK, his passive (`HERO_PASSIVE.snowpack`): hits and deep snow pack it, full it cuts every hit (`HERO_TAKEN`), it melts out of a fight | `packLayers`, `packGain`, `packHurt`, `packTaken`, `packTick`, `packDeal` | `rupes` › `SNOWPACK` |
| Q, W, E: the block thrown (a shot carrying its own slow), the pack shed in a ring, the charge that throws a body and stuns it against a tree, a rock or a wall | `rupesHeave`; `rupesShed`; `rupesShoulder`, `HERO_DASH.shoulder`, `shoulderStep`, `solidBehind`, `shoulderEnd` | `rupes` › `Q HEAVE`, `W SHED`, `E SHOULDER` |
| R: the roll that grows and steers, and its burst | `rupesAvalanche`, `HERO_DASH.avalanche`, `avaGrow`, `avaRadius`, `avaStep`, `avaBurst` | `rupes` › `R AVALANCHE` |
