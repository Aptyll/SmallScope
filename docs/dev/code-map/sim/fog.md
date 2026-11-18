# js/sim/fog.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how far each side sees, the woods' count and reach | `FOG_HERO` (times `HERO_SIGHT`: `heroEyeR`, `FOG_EYE_STEP`)/`FOG_SOLDIER`/`FOG_PERCH`/`FOG_MERCH`/`FOG_ZIP`/`FOG_ZIP_STEP` (a building's is its entry's `sight`), `FOG_WOODS_N`/`FOG_BRUSH`/`FOG_BRUSH_RIM` | `fog of war` |
| whether the fog is up at all | `fogUp` (`DBG.fog`) | `fog of war` |
| a side's eyes (heroes, soldiers, buildings with a `sight`, the perch, the merchant and its stall, each cable's row of eyes, and a hero's machine's `sight`: FABER's, FALCO's hawk out), each a plain circle | `sightSources`, `structCentre`/`objCentre`, `zipEyes`, `sightEye` | `fog of war` |
| the woods and the deep snow as brush | `inWoods`, `woodsHide`, `brushHide` (the patch from `brushOf`, js/sim/depth.js), `brushSeen` (whether a side sees into a whole patch, `FOG_BRUSH_RIM`; the reeds thin off it too, `reedThinOf`), `coverHide` (both, and a hero's own cover, `HERO_COVER`: asked by `sightAt` and `fogShown`) | `fog of war` |
| what a side sees (the bots ask it, and `seenAt(p, range, team)` through it), and the bare point test (the wire's cosmetics) | `inSight`, `fogEyesOf`, `sightAt` | `fog of war` |
