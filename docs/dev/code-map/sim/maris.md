# js/sim/maris.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| MARIS's tuning and her four keys | `COLD_*`, `HARPOON_*`, `REEL_*`, `BRACE_*`, `UNDERTOW_*`, `BREACH_*`, `MARIS_AB` (joined into `CLASS_AB`, abilities.js) | `maris` › `tuning`, `the keys` |
| COLD WATER, her passive (`HERO_PASSIVE.coldwater`): on ice or by open water she is quick (`HERO_MOVE`) and her basic strikes slow, for a while after; she swims (`HERO_SWIM`) | `isMaris`, `coldUnder`, `coldTick`, `coldDeal`, `coldMove`, `coldSwim` | `maris` › `COLD WATER` |
| Q: the harpoon (a shot); the body it hits is rooted and she is reeled to it (`HERO_DASH.reel`) | `marisHarpoon`, `harpoonCatch`, `reelStep` | `maris` › `Q HARPOON` |
| W, E: the brace (a share off every hit, more for each rival hero near: `HERO_TAKEN`), the cold ring (its slow stronger on ice) | `marisBrace`, `braceNear`, `braceTaken`; `marisUndertow`, `coldTileIce` | `maris` › `W BRACE FOR COLD`, `E UNDERTOW` |
| R: under the snow to a spot, untouchable (`invuln`), and up through it: knock-up, and on bare ice an `iceBreak` in the orca's `breach` shape | `breachSpot`, `marisBreach`, `HERO_DASH.breach`, `breachStep`, `breachUp` | `maris` › `R BREACH` |
