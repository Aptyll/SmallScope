# js/sim/world.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the tile grid: what lies on the ground (0 snow, 1 ice, 2 hole, 3 road) and what stands on it, one object per tile | `ground`, `objects`, `idx`, `inWorld`, `objAt` | `world` (the field that fills it: [field](field.md)) |
| the snowdrop clump and its rest after a pick | `OBJECTS.snowdrop`, `SNOWDROP_CD`/`SNOWDROP_BUD_T`, `snowdropLeft` (`o.readyAt`; the pick: `pickSnowdrop`, js/sim/actions.js) | `world` |
| what a kind of scenery **is** - solid, which tool, the E verb and lift, what each map paints it (the minimap's colour, the chart's class) | `OBJECTS` | `world` (buildings carry the same `mm`/`map` pair: `STRUCTS`, structures.js) |
| what a tile's occupant paints on either map, over both tables: the minimap's colour, the chart's class, and the two team inks each map paints a side's buildings and its bird in | `objMapColor`, `objChart`, `CH_*`, `chTeam`/`chPump`/`chEagle`, `MM_TEAM_*`/`mmTeam`, `MM_PUMP`/`mmPump`, `MM_EAGLE_*`, `MM_UNKNOWN` | `world` (its two readers: `updateMinimap` js/ui/minimap.js, `buildWorldMapImg` js/ui/panels.js) |
| does this tile block a walker (a tile a hero's kit walls for a while: `HERO_SOLID`; a body on a hero's `over` dash passes all but a building's) | `isSolidTile` | `world` (it reads `heroSolid`, then `STRUCTS` then `OBJECTS`, and names no type) |
| is this tile open water (a carved ice hole) - the one read every walker, route, spawn and climb-out asks | `waterAt` | `world` (under `isSolidTile`) |
| whether a pine may fall in a match (a swing, a bot, the merchant's axe, LIGNUM's TIMBER): never the field's wall pines (`wall`: `genWorld`, field.js) | `treeFells` (above `OBJECTS`; the tree entry's `ready`) | `world` |
| a footprint: its width and height off the OBJECT (or a bare type), its tiles, its centre | `structW`, `structH`, `structOf`, `footprint`, `structCenter` | `world` |
| standing an object on a tile, and writing a tile mid-match so the wire sees it | `placeObj`, `setTile` (`snapTouch`, js/net/snapshot.js) | `world` |
| the floater and sound every world heal shows | `healFx` | `world` |
