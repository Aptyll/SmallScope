# js/sim/bucina.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| BUCINA's tuning and her four keys | `HEARD_*`, `BLAST_*`, `RALLY_*`, `ECHO_*`, `PINES_*`, `BUCINA_AB` (joined into `CLASS_AB`, abilities.js) | `bucina` › `tuning`, `the keys` |
| her side: the ally players near her, HEARD's run for them when one of her keys strikes a rival, whether a spot stands under a pine | `bucinaAllies`, `bucinaHeard`, `bucinaUnderPine` | `bucina` › `her side` |
| Q, W: the cone that shoves and slows; the ring whose allies attack faster (`HERO_STAT` 'as', a share on `asMul`) and shrug off part of every stun and slow (`HERO_TEN`) | `bucinaBlast`; `bucinaNote`, `bucinaAs`, `bucinaTen` | `bucina` › `Q HORN BLAST`, `W RALLYING NOTE` |
| E: the wave out, turned back once by a wall or a tree, each pass striking a body once, a rival struck by both stunned | `bucinaEcho`, `updateEchoes` | `bucina` › `E ECHO` |
| R: every pine in the ring shed (`shedHit`, shed.js), rivals under one stunned, rivals in the woods inside shown | `bucinaPines`, `updateCalls` | `bucina` › `R SHAKE THE PINES` |
| what she leaves in the world (`bucinaEchoes`, `bucinaCalls`: `SAVE_ROOTS`, packed in snapshot.js) and the clocks she lends (`p.heardT`, `p.rallyT`/`rallyAs`), stepped once a step (`HERO_TICK`); HEARD's walk (`HERO_MOVE`) | `bucinaWorld`, `bucinaMoveMul` | `bucina` › `her clocks` |
