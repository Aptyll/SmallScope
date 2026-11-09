# js/sim/faber.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| FABER's tuning and his four keys | `PART_*`, `SPARK_*`, `ARC_*`, `WINDER_*`, `SPRING_*`, `ENGINE_*`, `FABER_AB` (joined into `CLASS_AB`, abilities.js) | `faber` › `tuning`, `the keys` |
| SPARE PARTS, his passive (`HERO_PASSIVE.spareparts`): a wreck in `robots` near him (`HERO_WRECK`, from `robotDies`) leaves a part; walking over it cuts his keys' waits | `faberWreck`, `updateParts` | `faber` › `SPARE PARTS` |
| Q: the spark in flight, and its jump to a second rival the step after (queued by `faberDeal`, the passive's `deal`) | `faberSpark`, `faberDeal`, `updateArcs` | `faber` › `Q SPARK` |
| his machines: a robot body (`robotBody`, robots.js) with his side and id and a kind in `HERO_MACHINE` (its brain, its draw, its size, its sight, its pay); one that runs down goes without a wreck | `faberMachine`, `faberRunDown`, `faberEngineOn`, the `HERO_MACHINE` rows | `faber` › `his machines` |
| W: the small gun set at the aim (two at most), shooting the nearest rival through `robotFoeUnit` with a bolt that follows its mark | `faberWinder`, `stepWinder`, `updateBolts` | `faber` › `W WIND A MACHINE` |
| E: the clockspring trap (three at most) that roots and hurts the first rival hero on it | `faberSpring`, `updateSprings` | `faber` › `E CLOCKSPRING` |
| R: the old engine walking to his aim (`navStep`) and slamming the rivals round it; his guns shoot faster while it runs | `faberEngine`, `stepEngine` | `faber` › `R THE OLD ENGINE` |
| what he leaves in the world (`faberParts`, `faberArcs`, `faberBolts`, `faberSprings`: `SAVE_ROOTS`, packed in snapshot.js; his machines ride `robots`), stepped once a step (`HERO_TICK`) | `updateFaberWorld` | `faber` › `R THE OLD ENGINE` |
