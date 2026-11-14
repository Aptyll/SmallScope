# js/sim/fossor.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| FOSSOR's tuning and his four keys | `DIGIN_*`, `SPADE_*`, `BURROW_*`, `BANK_*`, `QUAKE_*`, `FOSSOR_AB` (joined into `CLASS_AB`, abilities.js) | `fossor` › `tuning`, `the keys` |
| DIG IN, his passive (`HERO_PASSIVE.digin`): standing still plants him, planted he takes less (`HERO_TAKEN`) | `isFossor`, `fossorTick`, `fossorPlanted`, `diginTaken`, `fossorOut` | `fossor` › `DIG IN` |
| Q: a wedge of flung snow that strikes and slows | `fossorSpade` | `fossor` › `Q SPADEFUL` |
| W: the run under the snow through bodies (`HERO_DASH.burrow`) and the throw where he comes up | `fossorBurrow`, `burrowStep`, `fossorSurface`, `isBurrowing` | `fossor` › `W UNDER THE SNOW` |
| E: a bank of snow walling tiles across the aim (`fossorBanks`, in `SAVE_ROOTS` and the snapshot; `HERO_SOLID`) | `fossorBank`, `bankCrowded`, `updateFossorBanks`, `bankSolid` | `fossor` › `E BANK UP` |
| R: a line of broken ground running out, each rival thrown once (`fossorQuakes`, in `SAVE_ROOTS` and the snapshot) | `fossorQuake`, `updateFossorQuakes` | `fossor` › `R BREAK GROUND` |
