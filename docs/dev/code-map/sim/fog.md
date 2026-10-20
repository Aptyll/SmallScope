# js/sim/fog.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| how far each side sees, the woods' count and reach, the lit face | `FOG_HERO`/`FOG_SOLDIER`/`FOG_PERCH`/`FOG_MERCH`/`FOG_ZIP`/`FOG_ZIP_STEP` (a building's is its entry's `sight`), `FOG_WOODS_N`/`FOG_BRUSH`/`FOG_BRUSH_RIM`, `FOG_FACE` | `fog of war` |
| whether the fog is up at all | `fogUp` (`DBG.fog`) | `fog of war` |
| a side's eyes (heroes, soldiers, buildings with a `sight`, the perch, the merchant and its stall, the cable's band), and a sight line meeting stone (the cistern by its distance field) | `sightSources`, `structCentre`/`objCentre`, `zipEyes`, `sightEye`, `sightReach` | `fog of war` |
| the woods and the deep snow as brush | `inWoods`, `woodsHide`, `brushHide` (`FOG_BRUSH_RIM`; the patch from `brushOf`, js/sim/depth.js), `coverHide` (both: asked by `sightAt` and `fogShown`) | `fog of war` |
| what a side sees (the bots ask it, and `seenAt(p, range, team)` through it), and the bare point test (the wire's cosmetics) | `inSight`, `fogEyesOf`, `sightAt` | `fog of war` |
