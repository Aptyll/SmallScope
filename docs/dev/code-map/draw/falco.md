# js/draw/falco.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| his hawk circling over him (`HERO_AIR`), its shadow (`HERO_GROUND`), only where his side or the fog lets the viewer see; the hawk out on TALONS, low over its shadow with its own bar (`HERO_MACHINE.falcoHawk` draw, in the body pass) | `drawHawk`, `hawkShadow`, `hawkHome`, `falcoHasHawk`, `drawFalcoAir`, `drawFalcoGround`, `drawHawkOut` | `falco` › `the hawk` |
| his thrown knives: the basic attack's (`HERO_SHOTS.knife`) and KNIFE FAN's | `drawThrownKnife` | `falco` › `knives` |
| a rival his hawk marked, as his own side sees it (`HERO_MARK`) | `drawFalcoMarks` | `falco` › `over a body` |
| STOOP: his body gone into the sky, its shadow and a falling dart (`HERO_BODY_DRAW`) | `drawFalcoSky` | `falco` › `STOOP` |
