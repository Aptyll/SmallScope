# js/sim/lucerna.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| LUCERNA's tuning and her four keys | `LAMP_*`, `PULL_SPD`, `CROOK_*`, `LANTERN_*`, `SHOO_*`, `CIRCLE_*`, `LUCERNA_AB` (joined into `CLASS_AB`, abilities.js) | `lucerna` › `tuning`, `the keys` |
| her light and her side: the aimed spot, the ally a bot's lantern saves, the one way her light shows a rival (`markUnit` over `unitsNear`) | `lucernaSpot`, `lucernaInDanger`, `lucernaShow` | `lucerna` › `her light and her side` |
| the pull, hers alone: a body drawn along the snow to a spot (`p.pullT`/`pullX`/`pullY`), held stunned on the way when it is a rival, stopped by walls | `lucernaPull`, `stepPulls` | `lucerna` › `the pull` |
| Q, W, E: the crook flying until a wall or the first rival body, the lantern lying where it was thrown until an ally walks onto it, the swing that shoves | `lucernaCrook`, `updateHooks`; `lucernaThrow`, `updateLanterns`; `lucernaShoo` | `lucerna` › `Q SHEPHERD'S CROOK`, `W LANTERN`, `E SHOO` |
| R: the ring of light where she stood, showing rivals inside and slowing those on its rim | `lucernaCircle`, `updateCircles` | `lucerna` › `R CIRCLE OF LIGHT` |
| her passive LAMPLIGHT (`HERO_PASSIVE.lamplight`) and what she leaves in the world (`lucernaHooks`, `lucernaLanterns`, `lucernaCircles`: `SAVE_ROOTS`, packed in snapshot.js), stepped once a step (`HERO_TICK`) | `lucernaTick`, `lucernaWorld` | `lucerna` › `her clocks` |
