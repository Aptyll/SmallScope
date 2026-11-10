# js/draw/falls.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a soldier coming apart (grey inked plates thrown a little the way the blow went, one or two in its side's paint until they land, the treads left standing, gone into the snow one by one) and a beast dropping where it stands, slumped away from the blow in a puff of snow and sinking from the ground up; whole pixels, nothing turned; sorted with the bodies, hidden in the fog | `drawFall`, `fallDraws` (from the draw list, js/draw/passes.js), `fallSpr`, `fallPlates`, `FALL_PLATE`, `FALL_FLASH`/`FALL_DROP`/`FALL_LIE` | `falls` (the record: `unitFall`, js/sim/farm.js; a hero's own fall: `drawDown`, js/draw/bodies.js) |
| a wrecked building coming down (a road tower): its own picture shudders, drops band by band into the dust it raises, bare stones thrown clear and gone one by one | `drawWreck` (from `drawFall`, k `'S'`), `WRECK_ART` (the standing picture by type), `WRECK_*` | `a building coming down` (the record: `destroyStructure`, js/sim/actions.js, for a `STRUCTS` row with `wreck`) |
