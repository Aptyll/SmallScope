# js/sim/portitor.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| PORTITOR's tuning and its four keys | `CARRY_*`, `BED_*`, `CRATE_*`, `PLOUGH_*`, `HOME_*`, `PORTITOR_AB` (joined into `CLASS_AB`, abilities.js) | `portitor` › `tuning`, `the keys` |
| who it may lift (an ally on its own feet, carrying nobody), who a bot lifts or runs to | `portLiftable`, `portPick`, `shoulderPick`, `homePick`, `portNeedy`, `homeNeedy` | `portitor` › `the keys` |
| THE CARRY: an ally up on its back stands where it does every step, cannot walk (`HERO_MOVE`), keeps its hands free, and is never pushed apart (`HERO_HELD`); a roll, a dash, a fall or a stun ends it | `portLift`, `portSetDown`, `portCarryOver`, `portCarryStep`, `portCarrier`, `portRider`, `portMoveMul` | `portitor` › `THE CARRY` |
| BEDROLL, its passive (`HERO_PASSIVE.bedroll`): the ally it carries mends quickly, an ally standing still beside it slowly | `portitorTick`, `portitorOut` | `portitor` › `BEDROLL` |
| Q: a crate lobbed onto a spot (`portitorCrates`, in `SAVE_ROOTS` and the snapshot's `portitor`): rivals struck and slowed, allies shielded | `portitorCrate`, `crateLand`, `updateCrates` | `portitor` › `Q SUPPLY CRATE` |
| E and R's charges (`HERO_DASH.plough`, `HERO_DASH.home`): each rival met once, struck and shoved aside | `portRunHits`, `portRunEnd`, `portitorPlough`, `ploughStep` | `portitor` › `the charge's blows`, `E PLOUGH ON` |
| R: a run to a far ally, steered onto them, that lifts them for longer and walks faster | `portitorHome`, `homeStep` | `portitor` › `R CARRY HOME` |
| W: lift the ally nearest the aim; the key again sets them down there | `portitorShoulder` | `portitor` › `W SHOULDER` |
