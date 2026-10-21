# js/sim/aura.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| AURA's tuning and her four keys | `STARLIGHT_*`, `STAR_*`, `ORB_*`, `STEP_*`, `CURTAIN_*`, `AURA_AB` (joined into `CLASS_AB`, abilities.js) | `aura` › `tuning`, `the keys` |
| STARLIGHT, her passive (`HERO_PASSIVE.starlight`): the night's longer reach, the reveal on a rival her keys touch (`markUnit`) | `auraReach`, `auraSpot`, `auraReveal`, `auraSrc` | `aura` › `STARLIGHT` |
| Q, W, E: the star struck after its beat, the orb drifting through walls, the blink and the slow where she stood | `auraStar`, `starStrike`; `auraOrb`, `updateAuraOrbs`; `auraStep`, `HERO_DASH.step`, `stepEnd` | `aura` › `Q FALLING STAR`, `W DRIFTING LIGHT`, `E STEP OF LIGHT` |
| R: the band laid down the aim, and its fall: the hidden along it revealed, the bodies under it struck, buildings too | `auraCurtain`, `curtainBodies`, `curtainFall` | `aura` › `R THE CURTAIN` |
| what she leaves in the world (`auraStars`, `auraOrbs`, `auraCurtains`: `SAVE_ROOTS`, packed in snapshot.js), stepped once a step (`HERO_TICK`) | `updateAuraWorld` | `aura` › `what she leaves in the world` |
