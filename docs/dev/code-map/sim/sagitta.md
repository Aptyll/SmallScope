# js/sim/sagitta.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| SAGITTA's tuning and her four keys | `HEAVY_*`, `PIN_*`, `PAV_*`, `CRANK_*`, `LONG_*`, `SAGITTA_AB` (joined into `CLASS_AB`, abilities.js) | `sagitta` › `tuning`, `the keys` |
| a bolt of hers in the air (one of `arrows`) | `sagittaBolt`, `isSagitta` | `sagitta` › `the keys` |
| HEAVY BOLTS, her passive (`HERO_PASSIVE.heavybolts`): every third basic bolt heavier, a harder shove, more on buildings (`siege`); she kneels still for the long bolt (`HERO_MOVE`) | `sagittaShot`, `sagittaOut`, `sagittaMoveMul` | `sagitta` › `HEAVY BOLTS` |
| Q: the bolt that shoves and pins against a tree, rock or wall (`HERO_SHOT_HIT.pin`) | `sagittaPin`, `pinHit` | `sagitta` › `Q PIN` |
| W: the planted shield, a body of her side (`HERO_MACHINE.sagPavise`) | `sagittaPavise`, `stepPavise`, `pavDown` | `sagitta` › `W PAVISE` |
| E, R: the jump back off a bolt at her feet (`HERO_DASH.crank`); the long bolt through soldiers to the first hero (`HERO_SHOT_HIT.longbolt`) | `sagittaCrank`, `crankStep`; `sagittaLong`, `longHit` | `sagitta` › `E CRANK BACK`, `R THE LONG BOLT` |
