# js/sim/lignum.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| LIGNUM's tuning, his four keys and what they leave in the world | `TREELINE_*`, `CHOP_*`, `AXE_*`, `BARK_*`, `TIMBER_*`, `LIGNUM_AB` (joined into `CLASS_AB`, abilities.js), `lignumAxes`, `lignumLogs` (both in `SAVE_ROOTS` and the snapshot) | `lignum` › `tuning`, `the keys` |
| TREELINE, his passive (`HERO_PASSIVE.treeline`): stepping out of the woods (`inWoods`) readies a basic strike that hits harder and quickens him (`HERO_MOVE`) | `isLignum`, `lignumTick`, `lignumDeal`, `lignumMove`, `lignumOut` | `lignum` › `TREELINE` |
| Q: a cut, then (the key again, `recast`) a heavier chop that slows | `lignumChop` | `lignum` › `Q CHOP` |
| W: the hand axe out (stepped by `HERO_TICK`), stuck in the first rival hero (riding them) or tree; the key again pulls him to it (`HERO_DASH.axepull`) | `lignumThrow`, `updateLignumAxes`, `axeAt`, `lignumStuck`, `lignumPull`, `pullStep` | `lignum` › `W THROWN AXE` |
| E: bark skin, a share off every hit (`HERO_TAKEN`), twice beside a pine | `lignumBark`, `pineBeside`, `barkTaken` | `lignum` › `E BARK SKIN` |
| R: the nearest pine felled down the aim (or the trunk from his feet), a knock-up along it, and the trunk's tiles a wall for a while (`HERO_SOLID`, read by `isSolidTile`) | `timberPine`, `timberLine`, `lignumTimber`, `updateLignumLogs`, `logSolid` | `lignum` › `R TIMBER` |
