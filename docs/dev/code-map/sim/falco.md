# js/sim/falco.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| FALCO's tuning and his four keys | `HAWK_*`, `TALON_*`, `FAN_*`, `GLIDE_*`, `STOOP_*`, `FALCO_AB` (joined into `CLASS_AB`, abilities.js) | `falco` › `tuning`, `the keys` |
| the mark: who his hawk marked and until when (`falcoBy`/`falcoUntil` on the body), the hawk out, the spot he aims at | `falcoMarked`, `falcoMark`, `falcoHawkOf`, `falcoSpot` | `falco` › `the mark` |
| THE HAWK, his passive (`HERO_PASSIVE.hawk`): the knives' bite on a mark, the climb's clock, standing still in the sky (`HERO_MOVE`), hidden in the sky (`HERO_COVER`), the hawk's eye for his side (`HERO_EYES`) | `hawkDeal`, `falcoTick`, `falcoMoveMul`, `falcoCover`, `falcoEyes`, `falcoOut` | `falco` › `THE HAWK` |
| Q, W, E, R: the hawk out and home, the three knives and the slow, the leap (`HERO_DASH.glide`), the climb and the drop | `falcoTalons`, `updateFalcoHawks`; `falcoFan`, `updateFalcoKnives`; `falcoGlide`, `glideEnd`, `glideLift`; `stoopTarget`, `falcoStoop`, `falcoDrop` | `falco` › each key |
| what he leaves in the world (`falcoHawks`, `falcoKnives`: `SAVE_ROOTS`, packed in snapshot.js), stepped once a step (`HERO_TICK`) | `updateFalcoHawks`, `updateFalcoKnives` | `falco` |
