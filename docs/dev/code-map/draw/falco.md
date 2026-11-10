# js/draw/falco.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| his hawk perched on his glove while it is home (`HERO_BODY_FX`; the glove stays up, empty, while it is out); the hawk out on TALONS, low over its shadow with its own bar (`HERO_MACHINE.falcoHawk` draw, in the body pass) | `drawFalcoPerch`, `drawHawk`, `hawkShadow`, `falcoHasHawk`, `drawFalcoAir`, `drawHawkOut` | `falco` › `the hawk` |
| the knife in his hand: hung from the fist at rest (`HERO_CARRY`), cocked back and flung (`HERO_AIMED.knife`) | `falcoCarry` | `falco` › `the knife in his hand` |
| his thrown knives: the basic attack's (`HERO_SHOTS.knife`) and KNIFE FAN's | `drawThrownKnife` | `falco` › `knives` |
| a rival his hawk marked, as his own side sees it, in the row over its stack (`HERO_OVER`) | `falcoSees` | `falco` › `over a body` |
| STOOP: his body gone into the sky, its shadow and a falling dart (`HERO_BODY_DRAW`) | `drawFalcoSky` | `falco` › `STOOP` |
