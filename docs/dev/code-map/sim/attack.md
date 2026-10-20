# js/sim/attack.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each hero's left button IS: its row, and the renock a press starts | `attackOf`, `attackCycle` (the rows: `CLASSES[c].attack`, js/sim/player.js; the attack speed they make: `classAs`, stats.js) | `basic attack` (its head) |
| the draw curve: what a hold buys an attack, how long a full draw takes, the one flight envelope the sim fires and the aim line measures, and what it lands for | `DRAW_RANGE_MIN`/`DRAW_SPEED_MIN`/`DRAW_DMG_MIN`, `drawTime`, `drawPow`, `drawSpeedMul`/`drawRangeMul`/`drawDmgMul`, `shotFlight`, `attackDmg` (SNOW COVER's rank on the ambush: `ambushRank`) | `basic attack` › `the draw` |
| **what one press does**, for every player | `basicAttack` (called by `playerAttack`, sim.js) | `basic attack` › `the press` |
| a shot's press: the one arrow it puts in the air | `shootAttack` | `basic attack` › `the shot` |
| a blade's press: the wedge it sweeps at this draw, and the sweep left on the snow | `cutAttack`, `slashReach`, `SLASH_T`, `SLASH_REACH_MIN`, `slashes`, `updateSlashes` (the hand's own swing: `p.slashT`/`slashA`/`slashHalf`, player.js, drawn by `drawHeldTool`, js/draw/bodies.js) | `basic attack` › `the cut` |
| the fish taken with no press at all; the catch pose: its clock and which fish it hoists (`p.catchKind`), the cancel every step, press and hit call, which of its three frames is up | `autoFish`, `FISH_AUTO_CD`, `CATCH_T`, `startCatch(p, kind)`, `cancelCatch`, `catchFrame` | `fishing` (ticked in `updatePlayer`, sim.js; drawn by `drawPlayer`, js/draw/bodies.js; the net take in `updateStructures`, structures.js) |
| how hard an attack shoves what it hits | `kb` on each `attack` row (`HIT_KB` player.js, `ROBOT_KB` robots.js, `o.kbMul` in `hurtUnit`) | `basic attack` |
