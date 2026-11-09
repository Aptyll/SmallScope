# js/sim/salvia.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| SALVIA's tuning and her four keys | `BROTH_*`, `POULTICE_*`, `DROP_*`, `CLOAK_*`, `THAW_*`, `SALVIA_AB` (joined into `CLASS_AB`, abilities.js) | `salvia` › `tuning`, `the keys` |
| her side: the living ally players near a point, the most hurt one a bot heals, the one way her keys heal (`healPlayer`, `healFx`) with WARM BROTH on top (`HERO_PASSIVE.warmbroth`: speed and the slows off) | `salviaAllies`, `salviaNeedy`, `salviaHeal`, `salviaUnslow` | `salvia` › `her side` |
| Q, W, E: the bundle flying until a wall, an ally or a rival takes it, the snowdrops planted and picked, the cloak on the ally nearest the aim | `salviaPoultice`, `poulticeMeets`, `updateBundles`; `salviaPlant`, `updateDrops`; `cloakTarget`, `salviaCloak` | `salvia` › `Q POULTICE`, `W SNOWDROPS`, `E WARM CLOAK` |
| R: the warm ring where she stood, healing each second and taking every slow off the allies inside | `salviaThaw`, `updateThaws` | `salvia` › `R THAW` |
| what she leaves in the world (`salviaBundles`, `salviaDrops`, `salviaThaws`: `SAVE_ROOTS`, packed in snapshot.js), and the speed she lends (`p.brothT`, `p.cloakT`: `HERO_MOVE`), stepped once a step (`HERO_TICK`) | `salviaWorld`, `salviaMoveMul` | `salvia` › `her clocks` |
