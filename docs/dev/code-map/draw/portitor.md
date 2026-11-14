# js/draw/portitor.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| its WALKING POLE: flat for the swing (`HERO_BLADES.pole`, no slanted carry), upright on the snow in its hand at rest in every facing (`HERO_CARRY`) | `portitorPoleArtOf`, `PT_POLE_UP`, `portitorCarry` | `portitor` › `the walking pole in its hands` |
| SUPPLY CRATE in the air (`HERO_AIR`), its shade on the spot through the wind-up and the flight, as far as it reaches (`HERO_GROUND`), its planks flung where it breaks (`AB_FX_LOOK.crate`) | `drawCrateAt`, `drawPortitorAir`, `drawCrateShade`, `drawPortitorGround`, `drawCrateFx` | `portitor` › `the supply crate` |
| CARRY HOME's wind-up, copper chevrons down the way to the ally, and the snow kicked up where it lifts them (`AB_FX_LOOK.lift`); SHOULDER and PLOUGH ON are too quick for one | `drawHomeTele`, `drawLiftFx` | `portitor` › `the supply crate` |
| BEDROLL's mend rising off an ally beside it or on its back (`HERO_MARK`) | `drawPortitorMark` | `portitor` › `BEDROLL on a body` |
