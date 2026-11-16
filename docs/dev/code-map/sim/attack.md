# js/sim/attack.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each hero's left button IS: its row, one whole attack, the wind-up's share and the rest after the blow, and what it lands for | `attackOf`, `attackCycle`, `atkWind`, `atkRest`/`atkSince`, `drawTime`/`drawPow` (the wind-up read as a draw, for the poses), `attackDmg` (the rows: `CLASSES[c].attack`, js/sim/player.js; the attack speed they make: `classAs`, stats.js) | `basic attack` (its head) |
| **what a hero can attack**: a rival body it sees, a rival building still standing, the rival bird on its roost; how far to its edge; where on it a blow is aimed | `atkGood`, `atkIsStruct`/`atkStands`, `atkIsEagle`/`atkEagleUp`, `atkGap`, `atkIn`, `ATK_LEASH`, `atkPt` | `basic attack` › `the mark` |
| **the wind-up**: when it starts, what cancels it, the blow at its end, the turn to the mark | `attackStep` (called by `playerAttack`, sim.js), `atkCancel`, `atkFace` | `basic attack` › `the step` |
| the blow, for every player | `basicAttack` | `basic attack` › `the blow` |
| a shot: the one homing missile, its step onto the mark, what it does on arrival | `shootAttack`, `homingStep`, `homingLand` (stepped by the arrow loop, sim.js) | `basic attack` › `the shot` |
| a blade: the blow on the mark and the sweep left in the air | `cutAttack`, `SLASH_T`, `slashes`, `updateSlashes` (the hand's own swing: `p.slashT`/`slashA`/`slashHalf`, player.js, drawn by `drawHeldTool`, js/draw/bodies.js) | `basic attack` › `the cut` |
