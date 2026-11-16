# js/draw/soldiershots.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a wave soldier's shot in the air and its splat, over the bodies (never in the body's own pass, whose light layer clips to the body's box): the ranged soldier's snowball lobbed from its claw (`BALL_PX`, `BALL_LIFT`, `BALL_ARC`) and the ballista bolt flat off the stock, then a three-beat splat sprayed along the flight (`SHOT_SPLAT`, `SPLAT_RIM`, `SPLAT_BACK`) | `drawSoldierShots` (from `render()`, after `drawArrows`), `soldierShotAt` (where it is drawn, eased on a client by `netSince`, js/net/net.js), `drawBallFlight`, `drawBoltFlight`, `drawShotSplat` | `soldier shots` |
