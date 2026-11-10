# js/sim/farm.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a soldier's last hit pays and how it grows, the coin it throws (gold for the hitter, grey to the side that missed it), the `farm` count | `SOLDIER_BOUNTY`, `SOLDIER_BOUNTY_GROW`, `soldierBounty` (a kind's `bounty` share, `SOLDIER_TYPES`, robots.js), `coinPop`/`coinPops`/`COIN_POP_T`, `farmHit` (from `robotDies`, robots.js, and `animalDies` on a camp monster, wildlife.js) | `farm` (the coin's pixels: `drawPops`, js/draw/pops.js; online: `evPlay`'s `coin`, js/net/events.js) |
| a soldier or a beast going down where it stood: the record a screen draws its fall from (frame, facing, side, where the blow came from), aged by the tick | `unitFall`/`falls`/`FALL_T`, `fallAng` (from `robotDies`, robots.js, and `animalDies`, wildlife.js; the orca goes back under its ice instead) | `falls` (the pixels: `drawFall`, js/draw/falls.js; online: `evPlay`'s `fall`, js/net/events.js; saved: `SAVE_ROOTS`) |
