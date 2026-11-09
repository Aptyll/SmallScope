# js/sim/velox.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| VELOX's tuning and her four keys | `KEEP_*`, `SKIP_*`, `LANE_*`, `QSTEP_*`, `RUN_*`, `VELOX_AB` (joined into `CLASS_AB`, abilities.js) | `velox` › `tuning`, `the keys` |
| KEEP MOVING, her passive (`HERO_PASSIVE.keepmoving`): speed stacks off her basic hits (`HERO_MOVE`), longer on ice; the readied throw's bonus; LONG RUN's second stone | `veloxDeal`, `veloxTick`, `veloxMoveMul`, `veloxTen` | `velox` › `KEEP MOVING` |
| Q: the stone that skips and hits where it lands, further off ice (`veloxStones`) | `veloxSkip`, `skipLand`, `updateStones`, `veloxIceAt` | `velox` › `Q SKIP STONE` |
| W: the strip of ice she flies on and rivals skate on (`veloxLanes`, `HERO_ICE`) | `veloxLane`, `veloxLaneDist`, `onVeloxLane`, `veloxIceUnder` | `velox` › `W ICE LANE` |
| E, R: the short dash that readies her next throw (`HERO_DASH.vstep`); the long run and its second stone | `veloxStep`, `stepStep`; `veloxRun`, `veloxEcho` | `velox` › `E QUICK STEP`, `R LONG RUN` |
