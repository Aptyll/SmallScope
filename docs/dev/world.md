# The world

The tile grid, worldgen, the three **map shapes** a valley comes out of the snow in, the seeded
RNG contract, the day/night cycle, and the one runtime ground change (ice holes). Read this
before touching `genWorld()`, adding a ground type, adding a shape, or anything that must stay
stable per tile.

## The tile world

- `WORLD = 232` tiles of `TILE = 16` px → a 3712×3712 px world (under `PRACTICE` the const is
  76 instead — see [the practice arena](#the-practice-arena)). The forest border is
  `BORDER_MIN`/`BORDER_MAX` (30–70, avg ~50) tiles deep round an interior ~132 tiles
  across — open on OPEN FIELD, and grown over by the other two [map shapes](#map-shapes). The two **roost corners** —
  bottom-left and top-right, where the eagles always come down
  ([eagle drop](rendering/eagle-drop-mode-drop.md)) — are forested to `ROOST_R` (68 tiles from the
  corner, ~48 along the diagonal) outright: `borderDepth` is the seed's own `borderNoise` **or**
  a quarter-disc whose arc wobbles ±`ROOST_WOBBLE` (3) on the fine noise, so whatever the seed grew
  there the corner holds one solid block of woods round its [base](#the-bases)'s hollow, and
  the road's gate is at least the arc out. The union only adds pines, and `genWorld` rolls its per-tree `rng()` only under
  `borderNoise`, so the discs cost the shared stream nothing and move no seed's ground hash
  (the [camps](#camps)' clearings do); not under `PRACTICE`.
- `ringPts` is `RING_N` (6) points, evenly spaced on a ring `SPAWN_D` (`WORLD / 2 - 55`) tiles
  from the centre at the treeline. Nobody starts there (players land from the eagles,
  [multiplayer.md](multiplayer.md#where-players-start)) and no pocket is carved; the river
  spokes and the keep-clear rules hang off them — which is why `RING_N` is frozen at
  six instead of tracking `MAX_PLAYERS`: the roster's size must not reshape terrain.
- `ground` — `Uint8Array(WORLD²)`: `0` snow, `1` ice, `2` open-water hole (runtime-only, see
  [Ice holes and fishing](#ice-holes-and-fishing)), `3` the road ([The road](#the-road)), `4` the
  creek's open water and `5` a ford's stepping stone ([The creek](#the-creek)). **Open water is
  `waterAt(tx, ty)`** — a hole or the creek — the one read every walker, route, spawn and climb-out
  asks; a new check against `=== 2` alone is a hole the creek does not have. Ice is **mechanically slippery** (see
  [Momentum movement](gameplay/momentum-movement-players-only.md)), and worldgen carves it as a travel
  network: 14 frozen lakes plus winding ~5-tile-wide rivers (`carveRiver` in `genWorld()`) —
  a spoke from each ring point to the central clearing and a ring linking each point to its
  neighbour. The shared `carveIce` rule skips existing objects, the ring points, the clearing and
  everything within `ROAD_ICE_KEEP` (6) tiles of [the road](#the-road)'s edge, so rivers gap
  naturally around them — and a river running at the road narrows to nothing over
  `ROAD_ICE_TAPER` (7) tiles first (`carveRiver`'s disc shrinks with `roadDist`), so it peters out
  instead of ending in a cut. Neither test rolls anything, so a seed's rng stream is what it was.
- `objects` — flat `Array(WORLD*WORLD)`, **at most one object per tile**. Every object is
  `{ type, tx, ty, hp, flash, shake, ...extra }`. The `OBJECTS` table's types: `tree`,
  `deadTree`, `rock`, `bush`, `chest`, `den`, `dummy`, `banner`, `cairn`, `log`,
  `pylon`, `pkdie`, `agbell`, `stump`, `eagle`, `hut`, `part`, and the
  [story landmarks](#story-landmarks)' `boat` (added from `LANDMARKS`); the `STRUCTS` table's: `wall`,
  `longwall`, `turret`, `generator`, `spawner`, `barracks`, `net`. `banner`/`log` are
  [the road](#the-road)'s furniture (`banner` is also the practice gate's flag), `pylon`
  [the zipline](#the-zipline)'s, and `dummy`/`pkdie`/`agbell` exist only in
  [the practice arena](#the-practice-arena). `den` (solid, inert scenery
  two tiles wide — `OBJECTS.den.w`, so `placeCamps` fills the tile east of it with a `part` — that
  carries its `site`, the camp record, so a hover on either tile can wear the camp's clock)
  exists only inside [camps](#camps) (the wolf dens), and so does `hut` (the HOG
  HUT: solid, inert, 2×2 by `OBJECTS.hut.w`/`h`, its parts stamped east and north so the anchor is
  the front row, drawing the whole building); `chest` is a [treasure chest](#treasure-chests)
  standing where a border tree stood, or round a hog hut. `part` is the filler a multi-tile building (or a prop
  with a `w`/`h` in `OBJECTS`, the den and the hut) leaves on every footprint tile but its anchor (`{ type: 'part', of: <building> }`): solid, coloured like its
  building on both maps, ignored by work swings, and resolved by `structOf()` for every "what building
  is here" read (right-click, cursor, wheel, orders). `deadTree` (a 3 hp snag, chopped like a
  tree for `YIELD.deadTreeHit`/`deadTreeFall`, leaves a stump) and `cairn` stand nowhere since the
  bears moved to the river (4.82): no camp stamps them, and their types and art are kept unused.
- Index with `idx(tx, ty)`, read safely with `objAt`, create with `placeObj`. Deleting is
  `objects[idx] = null` (structures should go through `destroyStructure` so the `structures`
  registry stays in sync — it routes tiered types through `removeStruct`).
- `wall`, `longwall`, `turret`, `generator`, `spawner` are the **structures** any open snow or road tile takes (see
  [Base building](gameplay/base-building.md)). Each carries `{ tier, maxHp, building, buildT,
  buildTotal, dustT, sparkT }` plus per-type fields (turret `cd`, `ang`, `tgt`/`tgtK`, `off`,
  `chg`, `rec`, `scan`; generator `payT`; spawner `mode`,
  `bots`, `respawnT`/`respawnTotal`, `door`), and every live one is also referenced from the module-scope `structures`
  array so `updateStructures()` never scans the 53,824-tile grid. Nor do the object clocks
  (`flash`/`shake`, bush regrow, a rock's crack and rubble): `tickObjTimers` (js/sim/sim.js, the
  `object timers` banner) ticks only the objects in `objTimed`, in map order, and drops each one
  once its clocks run down. A clock is started only through `joltObj(o, flash, shake)` or
  `timeObj(o)`, which enrol the object; one set straight on the object never runs.
  `objTimersRescan` rebuilds the set after a load (`saveApply`). A picked
  bush regrows in `BUSH_REGROW` (70 s) and **wears its own clock**: `bushEmpty` until ripening is
  `BUSH_BUD_T` away, then `bushBud` (pale buds where the berries will be), `bushRipen` (the
  berries back but dull) inside `BUSH_RIPEN_T`, then `bush` — chosen in `render()`'s bush
  branch, so a player reads wait-or-move-on off the plant at a glance, and **under the pointer a
  regrowing bush wears the neutral unit bar** filling toward ripe (the frames say roughly, a hover
  says exactly — [rendering.md](rendering/render-pass-order.md)); `ready` refuses E until the
  berries are ripe, so neither in-between frame ever rims. The first
  three have three tiers; the spawner
  (the bot bay) has one and a **3×2 footprint** — `STRUCTS.spawner.w/h`, with `footprint()`,
  `structCenter()` and `structMouth()` (the ground point in front of the doorway) as the geometry
  helpers. Stumps are **consumable build anchors**: building on one replaces it (a bay consumes
  every stump under it), and demolition/destruction leaves the tiles empty, not stumps.
- The world center is an empty clearing: `CENTER_R` (beside `MAPS`) keeps ice ponds, rocks,
  bushes and every [shape](#map-shapes)'s own interior clear of it, so the river spokes meet in
  open ground. The ore loop there draws two
  `rand()` per spot and places nothing — **no-ops kept on purpose**, so every seed's stream
  stays what it is.
- Every `tree` carries `rare` (boolean), set at worldgen from `treeRare(tx, ty)`: a `hash2`
  roll gives each tree a `TREE_RARE_CHANCE` (8%) shot at a **jackpot** — `YIELD.treeRare` extra
  gold (straight to the feller through `awardGold`, plus a `JACKPOT!` floater), paid by
  `hitObject()` only when the tree actually falls, on top of the normal payout. Being a position hash rather than an `rng()`
  draw, the roll is the same whenever it is asked — `DBG.treeRare(tx, ty)` reports it for any
  tile, occupied or not.
- **The ground is baked once, lazily.** The whole ground lives in one offscreen canvas and the
  frame loop blits the camera window out of it, but nothing is painted at boot: `prepGround()`
  (js/draw/ground.js) readies what the painter reads (`bakeLakes`, `bakeDressing`, `noteCasts`),
  `render()` bakes every `GROUND_CHUNK` (16-tile) square the view reaches before its blit
  (`groundView` → `bakeGroundChunk`), and idle time bakes the rest nearest the camera first
  (`groundIdle`, a `requestIdleCallback` whose timeout keeps it moving through a busy match) —
  the whole map at once kept the first frame waiting a second and a half. `renderGround()` bakes
  everything now, for a test. Every tile paints only inside its own 16 px, from the world as it
  stands, so `paintGroundTile` skips a tile whose chunk is not baked yet (`groundBaked`): that
  chunk's bake paints it as it is by then, and a chunk bake lays exactly what per-tile repaints
  would. A painter that colours single pixels dots them through the pixel pen (`penDot`, flushed
  by `penFlush` before it returns), which draws each run of same-ink pixels along a row in one
  `fillRect` — a million single ones were a third of the bake, and a run lays exactly what its
  pixels would. The per-tile painter is `paintGroundTile(g, tx, ty)`, and a runtime change goes through
  `repaintGround(tx, ty)` (the CLAUDE.md hard rule — the four neighbours are repainted because
  edge rims depend on them). The runtime ground writers: [ice holes](#ice-holes-and-fishing) and
  their dawn refreeze, [ice breaks](#ice-breaks) opening and freezing back, a roost pad's paving ([the road](#the-road)), and the
  practice arena's track rolls. The bake also lays the scenery's
  [cast shadows](rendering/light-and-weather.md#cast-shadows), and `render()` repaints a caster's reach itself
  when what stands on a tile changes, so felling or placing scenery calls nothing.
- **Open snow wears soft drifts** (the `snow's pixels` banner, js/draw/ground.js): swells laid
  along the wind (`SNOW_ANG`, which `layDrifts` turns onto the seed's prevailing wind, `driftWind`, so
  the swells and the [drifts](#snow-depth) lean one way; -0.33 under `PRACTICE`), lit on the sun's side and shaded on the lee in four close tones
  (`SNOW_PAL`) under a Bayer dither, with a rare white glint on the lit tone. A low noise
  (`SNOW_REGION`, ~22 tiles a step, cut at `SNOW_CUT` into thirds of the map) lays out regions of
  three `SNOW_LOOKS` — fine drifts, broad swells, lee-only — blended across `SNOW_BLEND`. Every
  pixel is a function of its world position alone (the heights on a world-aligned 2 px lattice),
  so any repaint lays back exactly the snow the bake laid, a lake-shore tile reads the same
  lattice, and nothing rolls. Kept subtle on purpose: the lee tone stays well above a cast
  shadow. A chunk bake lays each row of its snow in one strip (`snowStrip`) — `putImageData` per
  tile alone would cost the map half a second — under every tile but ice and holes (the road and
  the creek lie over snow), and shares the height lattice across the chunk (`snowLatOpen`: a
  tile reads a 12-point square for its own 8, so alone it works out each height about twice).

### The ice shore

**A lake is a shape, not a run of tiles** (the `the ice shore` banner, js/draw/ground.js). The
tile grid still says where the ice is for every rule — slipping, cracking, fish, the maps — and
only the pixels wander: `iceAtPx(x, y)` blends the four tile centres round a pixel (1 for a
*lake* tile, ice or open hole, 0 for anything else) and pushes the blend across 0.5 with two
octaves of `vnoise`. Every style's noise stays under half a unit, so a tile whose 3x3 is all
lake is solid ice and one with no lake in its 3x3 is untouched snow, and only the band along an
edge pays for the per-pixel test (`paintIceTile` for an ice tile, `paintSnowShore` for the snow
beside one). The light comes from the top-left, as for [cast shadows](rendering/light-and-weather.md#cast-shadows)
and the map chart: the snow's lip over a lake's north and west sides is lit white and throws a
band of shade on the ice under it, and the far bank's face is lit pale.

**Each lake rolls one of two styles** (`ICE_STYLES`) for its whole body: `bakeLakes` labels
every lake by flood fill and rolls it off its first tile's `hash2` (`rollIceStyle`, weighted by
`w`), and sweeps each tile's depth in from the shore (`lakeDepth`, 1 on the edge). It rolls no
`rng()`, runs once before the bake, and is the same for a seed on every screen; the ground
array only ever flips ice ↔ hole at runtime and both are lake, so it never needs redoing.
FROZEN ISLES, being one lake, is one style per seed.

| Style | Edge | The ice |
| --- | --- | --- |
| **LIP** (`w` 1) | gentle wander, 2 px shade band | the sheet's two tones on a dithered low noise |
| **DEEP** (`w` 2) | gentle wander, 3 px deeper band | pale shallows along the shore, then two steps darker to the middle, off `lakeDepth` |

The looks are A and B of `docs/media/concepts/shore-shadow-concepts-1.png`, DEEP (B) being
the pick, hence its double weight; C (a drifted, cracked edge) was cut as too noisy. Cracks and glints (the tile's own hash) only go on
a tile whose 3x3 is all lake, so none lands on a bank. Where a [path](#the-paths) crosses a lake, `paintRoadOverlay` still paints over the
shore. Night's mirror follows the same edge ([the reflected sky](rendering/light-and-weather.md#the-reflected-sky)).

### The wind's leavings

**Scenery the wind lays, all in [js/draw/lakes.js](../../js/draw/lakes.js), and none of it a
rule**: no walker, route or slide reads it, and the ice's shine shows through everything laid on
it, so a lake still reads as slippery. `bakeDressing` runs in `prepGround` right after
`bakeLakes`: it labels every lake with its area (`lakeTiles`; `BIG_LAKE` tiles makes one big) and
works cracks, banks and drifts out **once** into per-tile pixel lists (`dressPx`), which
every paint of a tile stamps (`paintDressing`, called from `paintGroundTile` under the road, the
creek and the cast shade). So a repaint lays back exactly what the bake laid, a drift reaching
across a tile edge carries on, and a hole that refreezes gets its crack back.

- **One snow depth, three bands.** The deep snow layer owns one seeded depth map (`snowDepth`,
  `DEPTH_MID`/`DEPTH_DEEP`, `deepAt`, `driftWind`); its deepest band is the brush, and this
  file draws the two below it: the mid band (from `DRIFT_MID()`) as drifts,
  the shallow band as dust and banks. It reads the map only through `snowDepthAt`/`deepSnowAt`
  and the prevailing wind through `rollPrevailing` (`LW_X`/`LW_Y`, downwind), and draws nothing on
  a tile the deep band owns, so a pile that looks deep is always deep snow. Nothing is stamped on
  a tile an object stands on (a landmark on the ice covers its own).
- **Drifts in the lee**: the map's mid band drawn per pixel (`bakeDrifts`, reading `leeDepth` and
  `driftsDepth`) - the pads the map lays behind a pine, a rock or the hut, and the skirt round each
  deep drift - as a low flat pile, sunward rim lit and a pixel of shade past its lee. Its shape is
  the map's, so it ends where the deep band's own look begins. Nothing on ice, the road, the
  creek or a tile something stands on.
- **Dust** on every lake (`dustIce`, called on each ice pixel in the shore painters): sparse
  grains in streaks along the prevailing wind, heavier near the downwind shore, each only pulling
  the ice a little toward snow. Trampled snow's `trampleAt(x, y)` thins it where feet have been, and
  it calls `iceDustInvalidate` over a changed rect so those tiles repaint.
- **The downwind bank**: a few px of face, lit crest and lee along each lake's downwind shore
  (`bakeBanks`), starting a pixel past the shore's own lip, its width off the shore's depth.
- **Long cracks** through big lakes (`bakeCracks`/`walkCrack`): dark lines with a pale lip,
  branching, kept on `lakeDepth` 2 and in, a few per `CRACK_EVERY` tiles of lake. The short
  per-tile cracks in `paintGroundTile` still mark every lake.
- **The weather on the ice**, every frame (`drawLakeSky`, after the reflected stars in `render()`):
  streaks of blown snow drifting across big lakes with the live wind, more in a blizzard; a frosty
  night's glints and its long cracks darkening again; falling snow laying fresh grains from
  `dustCv`. The dials come in through `lakeSky()` alone, off `weatherNow()`.

## Map shapes

**The valley comes out from under the snow a different shape each winter** ([lore](lore.md)), and
`MAPS` (the `map types` group of [js/sim/world.js](../../js/sim/world.js)) is the shapes it comes out in.
One entry is one **interior**; the border forest and the two roost corners are every shape's
alike, because the road's gates are measured off `borderDepth` and the [bases](#the-bases)
are fixed, and nothing may move them.

| Shape | The interior |
| --- | --- |
| **OPEN FIELD** | one wide interior inside a ring of pines. The only wood is the border's — the world the game shipped with. |
| **THICKET** | the woods took the whole valley in stands (`scale` how big a stand runs, `wood` how much of the noise is one), and what is left between them are the pathways. |
| **FROZEN ISLES** | one frozen lake with wooded islands standing out of it: `land` is an island's shore, the ring of snow round its pines that ore, berries and anything built have to stand on, and `shore` is how far the lake laps **into** the treeline, drowning any island inside it — so the woods' own edge is always water and no island is reached dry-shod from the border. The band wobbles on the fine noise, like the roost discs' arc. |

**`mapTerrain(k, tx, ty)` IS a shape**: one pure function of the position noise (`mapFbm`, three
octaves) saying what shape `k` makes of a tile — `MT_SNOW`, `MT_ICE` or `MT_FOREST`. `genWorld`
plants from it and the class screen's chip draws from it (`mapChip`, js/ui/menu.js), so the
picture on the chip is **this seed's own valley** in that shape and not an illustration of one.

**`MAP_TYPE` is the shape this page grew** — `?map=N`, else the profile's `settings.mapType`,
read once in js/app/boot.js after `loadSettings()` and never again (and written back to `settings.mapType`, so the lobby's pick starts as the shape standing). Picking one in the lobby's map
pop-up (`pickMap`, [rendering.md](rendering.md#lobby)) only saves `settings.mapType` and the
lobby stays put; the pick is spent at LOCK IN, which is then a **page** the way a reroll is: it
comes back on `?seed=<this seed>&map=<the pick>` and goes straight to the eagle (`lockIn`,
js/app/boot.js's `softfall.drop`). Only a **solo** lobby may pick — a host reloading
would drop its room, and a guest's world is the host's (`netHostHello` refuses a hello whose map
is not the host's, exactly as it refuses a seed; `joinRoom` carries `&map=` with `&seed=`).

**A shape may not move OPEN FIELD.** The interior pass runs after the ponds and rivers, whose
retries read what stands on a tile, and before the ore and the berries, whose rolls do not; it is
pure position noise and draws no `rng()` at all, and the only `rng()` calls a shape adds — the
ore and berry **top-up** (`MAP_ROCKS`/`MAP_BUSHES`, which put a grown shape back to OPEN FIELD's
own strength, since most of the two scatter loops now land in wood or on the lake) — sit at the
very end of `genWorld` behind `mapGrown(MAP_TYPE)` (the rocks they stand are lifted again by
[`placeRocks`](#rocks), which moves every rock to the rim). Verified: OPEN FIELD's ground, objects,
animals and fish hash bit-identical to the shape before the shapes existed, on seeds 42, 7, 55,
999 and 1234.

What a shape changes downstream, without a line of its own anywhere:

- **the creek** ([below](#the-creek)) runs the same diagonal on every shape, and cuts an open
  channel through a grown shape's woods and FROZEN ISLES' lake alike; a shape's paths ford it
  where they cross;

- **the camps** stay at their fixed mirrored [sites](#camps) — `clearCamp` cuts the same clearing
  out of whatever grew there, so a camp on THICKET is a clearing in the woods;
- **the chests** ([below](#treasure-chests)) keep `CHEST_BURIED` of their number back for a pine
  standing *inside* a stand;
- **the shoal** rides how much swimmable ice there is (`FISH_WATER_REF`/`FISH_CAP_MUL`, the
  `fish` banner of js/sim/wildlife.js) — FROZEN ISLES holds 75 fish where OPEN FIELD holds 30;
- **building** needs ground `0` or `3` as it always did, so on FROZEN ISLES a base stands on an
  island's shore, the road or a path, never on the lake.

## The paths

A shape that grows woods over the whole valley would else be a wall, so it lays **paths** with
them (the `the paths` group, [js/sim/world.js](../../js/sim/world.js)): packed earth about a pine wide,
cut where the shape's own gaps run. **A path IS road** — `roadDist` mins over the path segments,
so `placeRoad` paves them with the lane in its one pass, the ground array says `3`, both maps ink
them, nothing grows on one, a building stands on one and nobody digs into one. Only narrower
(`PATH_HW` against `ROAD_HW`) and without the ruts, which `paintRoadOverlay` measures off the
diagonal a path is nowhere near.

`layPaths()` runs at boot **between `placeCreek()` and `placeRoad()`** and lays:

1. **one route** from a side's junction on the road to the rival's;
2. **a branch** off it to every camp, stopping `PATH_CAMP` tiles past the ground `clearCamp` will
   clear, so the woods can never wall a camp in and the clearing never eats the path's end —
   except a `woods` camp (the HOG HUT), which is buried in the border forest on purpose and gets
   no branch.

Each is a **Dijkstra over the tiles** on a cost field (`pathCost`) where **wood is a wall, not a
price**: open snow 1, the frozen lake `PATH_ICE`, a tile of [the creek](#the-creek) `CREEK_COST` (a ford's
stones 1), a tile inside the road's corridor `PATH_LANE`, and **anything standing refused
outright**. So a route crosses the creek short and square, or takes a ford already there, and
wherever it crosses open water `addPathRoute` lays a ford of its own at the middle of the crossing. So what a route *is*, is **the shortest way between
the two roosts through the ground that is already clear** — the gaps the noise left, threaded,
never a line driven through a stand. A bush is not a wall (it is walked past, and the paving
takes it like the lane does), and the lane's own tiles read as clear whatever stands on them,
because `placeRoad` fells and paves the whole diagonal a moment after this runs — which is also
what lets a route start at a junction buried in the corner's woods. It still pays `PATH_LANE` to
be there, so it **crosses** the lane instead of joining it: a path is the way the road is not, a
flank, walked, with no cable on it.

Only if a shape leaves no clear route at all does `layPaths` search again with the axe (`cut`,
where wood costs `PATH_WOOD` instead of refusing) — because a route is also the promise that
there is one. On the seeds measured the main route has never needed it; a camp branch does now
and then, when the noise walls a site in.

The **paving** is about a tile wider than the route either side, so a path running down a gap
trims the edge of the stands beside it. That is a cleared verge, not the route breaking through:
*where a path goes never needed an axe.* The searched tile path is registered every `PATH_SEG`
tiles as a segment (`addPathRoute`), which smooths the search's eight-way staircase into a
polyline.

`pathDist(fx, fy)` is the third term of `roadDist`, and it is **O(1)**: `indexPaths` stamps the
two nearest segments into a per-tile `Int16Array` pair, so a pixel of the ground bake tests at
most two segments instead of walking the whole network. Nothing is laid on OPEN FIELD or under
`PRACTICE`, and `pathDist` answers 99 there, so neither pays anything.

**A path is the one thing that meets ice.** Where it crosses a frozen lake the packed earth is
laid over the ice per pixel against the same ragged edge the road has, under a pale rim a pixel
or two wide that follows that edge (`paintRoadOverlay`'s `onIce`, js/draw/ground.js): a lake has
a shoreline, not a muddy shoulder.

Verified on seeds 42, 7 and 1234: the strict search finds the main route on both grown shapes
without the axe (212–232 tiles, 61–83 of its ~95 segments more than `ROAD_HW + 2` off the
diagonal, so it really is cross-country), and on the finished world a walker **chopping nothing**
reaches the rival's junction and every camp in the valley on all three shapes (the hog huts are
walled in by design: [camps](#camps)).

## Rocks

`placeRocks()` (the `world` banner, js/sim/world.js) runs at boot after `placeChests()` and stands
**the rocks in a few clusters, mining spots a player goes to**, each on the open snow just out
from the border forest: 2–8 tiles (`ROCK_BAND_MIN`/`ROCK_BAND_MAX`, walked 4-way) from the nearest
**border** pine — one on `borderDepth`'s side of the line, so a grown shape's inner woods draw no
band of their own — never touching a pine, never inside a camp's clearing (`r + 2`),
`ROCK_SPACING` apart, within `ROCK_CLUSTER_R` of the cluster's centre. Every rock is **two tiles
wide** (`OBJECTS.rock.w`): both tiles must be open snow in the band, and the east one takes a
`part` pointing at the anchor, the den's filler. So the ore is out at the valley's rim and the
middle stays open ground; no camp stands a rock.

**`ROCK_CLUSTERS`** says where: each entry is a heading from the valley's centre, `turn` degrees
off RED's roost toward the top-left corner (+) or the bottom-right (−), and a `kinds` list, one
per rock a side stands there. The centre is RED's rim anchor nearest that heading whose mirror
`(ty, tx)` fits too and with room round both for the cluster (`ROCK_CLUSTER_SLACK`: first within
25° with room to spare, then further round), and each side fills its own spot with the same
kinds; a side that got fewer leaves the other its count, so **both sides always have the same
rocks**. A cluster turned 90° (a corner neither side owns) straddles the creek, each side's share
on its own bank, unless it had to slide far enough round to be two spots. As shipped: a side
cluster of five STONE each way at ±50° (four spots) and a corner cluster at each unowned corner
of one SUNSTONE, one FROSTGLASS and one STONE a side: 32 rocks, fewer on a cramped seed (seed 9:
30). A shape whose rim cannot hold a cluster (FROZEN ISLES, whose rim is lake) widens the band
`ROCK_BAND_GROW` (8) tiles at a time, out to `ROCK_BAND_LIMIT` (40).

genWorld's own rock passes — the interior scatter and a grown shape's top-up (`MAP_ROCKS`) —
still run and still roll: taking their `rng()` calls out would reshuffle every seed
([determinism](#determinism-and-noise)). `placeRocks` lifts every rock they stood first, then
places its own on a stream of its own, `mulberry32(SEED ^ 0x524f434b)` (`rkRng`), touching only
`objects`, so terrain stays bit-identical for an existing seed.

**The kind** ([Mining a rock](gameplay/mining-a-rock.md)) is the cluster's `kinds` list: the
SUNSTONE and FROSTGLASS SPIRE are out at the contested corners, the plain STONE nearer home.

A rock is only ever taken off the map whole: `fellScenery(tx, ty)` clears every tile of the
footprint from either of them, and the runtime clears that reach scenery (the base's hollow at
boot, the crash's ring, the merchant's axe) go through it.

## Treasure chests

`placeChests()` (the `world` banner, js/sim/world.js) runs at boot after
`placeCamps()`: it scans for **border trees on the forest's inner edge** (a `tree` with at
least one cardinal neighbour of open snow — reachable with E from open ground) and swaps
`CHEST_COUNT` (14) of them for `chest` objects, at least `CHEST_SPACING` (22) tiles apart.
On a shape that grows its own woods ([map shapes](#map-shapes)) `CHEST_BURIED` (0.3) of them are
held back for a **buried** one instead — a pine with no open ground touching it and more pines
two tiles off on all four sides, so the only way to that cache is to chop one down. OPEN FIELD's
wood is one treeline and everything in it is on the inner edge, so OPEN FIELD buries none and
rolls exactly the draws it always did. No tree within a `woods` camp's `r + 4` is a candidate:
the rim of a [hog hut](#camps)'s clearing is not the forest's inner edge, and the hut brings its
own three chests (camp `props`, stamped by `placeCamps` with the same `{ hp: 1 }`).
Selection rolls on its own `mulberry32(SEED ^ 0x43484553)` stream (`chRng`) so it
can never perturb the shared `rng` stream and terrain stays bit-identical for an existing seed
(chests place after the camps and touch only `objects`, never `ground`). A chest is solid, gold
on both maps (its `mm`/`map` entry), and one free E press (`OPEN`, `needs: null`) springs it —
`hitObject`'s chest branch pays `CHEST_GOLD_MIN`–`CHEST_GOLD_MAX` (8–20) gold on the spot, drops one
card rolled from `CHEST_ODDS` (those constants beside `placeChests`) and gives a free item part
(`chestPart`, js/sim/items.js; [the items](gameplay/the-merchants-counter.md#the-items)). The tile empties with
it, leaving a one-tile notch in the treeline where the cache was dug out. The sprite bakes in
[js/draw/ground.js](../../js/draw/ground.js) (`CHEST_SPR`, under the `the scenery bakes` banner) rather than
in the byte-fragile grid files under js/sprites/.

## Story landmarks

Scenery that suggests someone was here before the match: a **boat** frozen out in a lake. They are the `landmarks` banner in [js/sim/landmarks.js](../../js/sim/landmarks.js),
and **a landmark is data**: one `LANDMARKS` entry (its footprint `w`×`h`, `solid`, the `where`
rule, `count`, `mirror`, `spacing`, its `art` key and `foot`, `mm`) and one sprite in
`SPRITES.landmark` (js/sprites/landmarks.js). The file turns each entry into an `OBJECTS` row
at load (no `tool`, so E never works one), the object pass draws any of them through one branch
(`drawLandmark`, js/draw/landmarks.js), and their shade is a `CASTERS` entry made from the same
table. The anchor is the footprint's front-left tile, with the `part` tiles stamped east and
north the way the hog hut's are.

| Landmark | Footprint | Blocks | Where (`LM_WHERE`) | Count |
| --- | --- | --- | --- | --- |
| boat | 3×1 | yes | `lake`: every tile ice at least 4 deep | up to 2 |

`placeLandmarks()` runs at boot straight after `placeRocks()`. It works out each ice tile's
distance from the shore itself (`lmIceDepth`), because the painter's `lakeDepth` is baked later,
by the draw. Then, kind by kind in table order, it lists every anchor its rule allows, shuffles
the list on its own stream (`mulberry32(SEED ^ 0x4c4d524b)`, so no `rng()` is drawn and every
seed keeps its terrain) and takes anchors until it has `count`, skipping any too close to one
already placed (`spacing` for the same kind, `LM_GAP` for any other). Every anchor also has to
pass `lmClear`: the footprint must be empty with nothing solid round it, at least `LM_CAMP_GAP`
tiles outside every camp's clearing and `LM_ROOST_GAP` tiles outside the roost disc (the eagles
land there and the merchant builds there). A `mirror` kind (none today) searches
only the bottom-left side's half (`tx < ty`) and places each pick along with its reflection
`(ty, tx)`, the camps' mirror, because both sides should get the same chance at a thing
players use. A seed without room for one places fewer and throws nothing. The `landmarks` array
keeps each placed landmark (`{ key, tx, ty }`) for the spacing check.

## The road

One straight lane down the map's whole diagonal, corner to corner and off both world edges — a
route that comes from beyond and goes on past us, not one that starts and ends here. Across the
open field it is about `ROAD_HW` (3.5) tiles either side of the centreline, a seven-tile lane with
room for a whole side and a wave to fight in; where it crosses each roost corner's treeline — the
**gate**, `roadSpan()`'s `u0`/`u1`, two pennant poles — it eases over `ROAD_GATE_BLEND` (2) u to
`ROAD_HW_WOOD` (2.5), a five-tile forest road with the pines closing in (`roadHW(u)`); and it
runs on through each side's [base](#the-bases) to end on the bird's **perch** (the `the road`
group of the `world` banner, js/sim/world.js). Ground `3`, packed earth showing
through the snow with two ruts down its length: it **walks like snow** (only ice and holes are
special-cased in `updatePlayer`'s momentum block) but it is **not snow** — nothing digs into it
(`tryProne`, the hunter's burrow), nothing grows on it, a fish never counts it
as water (`fishWater`), and the footprint emitter leaves no prints on it. A building **does**
stand on it: `canPlaceAt` (js/sim/structures.js) takes ground `0` and `3` alike.

**Its edge is ragged, never a tile staircase.** `roadEdgeAt(u, side)` wanders the half-width
along the lane on the position noise — a slow drift of ±`ROAD_RAG` (0.8) and a fine ripple, each
side its own — and `roadMainDist(fx, fy)` measures any point against that wandering edge (negative
inside; no ends). Both the ground array (`onRoad`, a tile's centre) and the ground bake (a pixel)
ask the same function, so what a tile *is* and what it *looks like* agree to within the verge.
**It never meets the ice network**: `genWorld`'s carve rules keep every pond and river `ROAD_ICE_KEEP` tiles
off its edge and taper a river to nothing on its way in (the tile world, above), and a
[shape](#map-shapes)'s lake reads the same keep-out, so the lane is dry from end to end on every
shape and the ice network lives further out on the map. The one water it meets is
[the creek](#the-creek), at the middle, frozen there into [the orca's lake](#the-orcas-lake)
inside [the cistern](#the-cistern): the lane ends on each gate's stone sill and the way between
is the ice. `laneDist` is the road as laid and drawn: `roadDist(fx, fy, true)`, which ends the line
on the two perches (`baseRoadEnd`, js/sim/base.js), capped by `cisternLane`, which narrows the
lane onto a gate's width over `CIST_LANE_TAPER` tiles and is nothing inside the ring.
`genWorld`'s carve rules read `roadDist` without `laid`, the whole line, so no seed's ponds move. A
**path** is the one thing that crosses the ice network ([the paths](#the-paths)), and it goes
round the cistern (`pathCost`).

**Each side's nest and junction are fixed.** `roadNest(team)` (cached) gives the **nest**, the
bird's perch at the back of the side's [base](#the-bases) (`basePerch`, on the centreline), and the
**junction**, the point on the centreline where the road leaves the base's hollow through its
mouth (`baseGateU`): `{ u, side, jx, jy, nx, ny, x, y }`, `side` the bird's own right (RED's the
top-left side, `roadOffS < 0`; BLUE's the bottom-right), which the cables use. The bird lands on
the nest ([eagle drop](rendering/eagle-drop-mode-drop.md)), and the crater is a **pad** in the
`pads` registry (`addPad(team, cx, cy, r)`, a disc of `BOOM_R`, paved whole the frame the bird
lands: `eagleCrash`, eagle.js), so the roost and the road are one ground. `roadDist(fx, fy)` is
the min of `roadMainDist`, every pad, the paths and [the side lanes](#the-side-lanes), so the
bake, both maps and every `onRoad` read see one road system. From the field, the way to a bird is one straight road through its base's mouth.

**Its furniture** is placed with it, off the same ragged edge (`mark` in `placeRoad`,
`ROAD_POLE_OUT` (0.9) tiles past it): two **`banner`** poles at each gate carrying a `team` (0 at
the bottom-left gate, 1 at the top-right — the practice gate's own flag object, which paints
its cloth in `TEAMS[skin(team)]`'s coat and both maps in that side's ink, and *fells* what stands
on its spot, since the gate stands in the treeline, but gives way to a rock or a bush). Inert to
E (no `tool`). The shoulders are otherwise bare: a lane's edge is not a thing to look at, and the
centre where the waves meet is open ground. The pole's pixels are `drawBanner`.

`placeRoad()` runs at boot **after `placeCreek()`, `layPaths()` and `layLanes()`** (then `placeZips()`, `placeCamps()`,
`placeChests()` — js/app/boot.js), on pure reads —
`roadSpan()` scans the diagonal for the last wooded tile out from each corner by `borderDepth`,
so the gates are where the treeline is — and it rolls nothing, so it neither moves the shared `rng` stream nor differs run to
run. Whatever the interior grew across the band is overwritten: a rock or a bush on it is gone,
the pines of the woods it cuts through are felled (there is no ice to meet - see above) - but a
tile of the creek or a ford is left as it is, so the creek runs on under the lane (its deck is
already laid) and a path stops at the water.
`roadAlong`/`roadOffS`/`roadOff`/`roadPoint` are the geometry —
the diagonal is `tx + ty = WORLD - 1`, `u` running from the bottom-left corner, `roadOffS` signed
toward the bottom-right side — taking a tile index or a continuous tile coordinate alike;
`onRoad(tx, ty)` is the membership test, and `roadWaypoints(team)` the centreline every
`ROAD_STEP` (20) tiles from a side's own junction to the rival's, which is the march the waves
walk ([Soldiers](gameplay/robots.md#soldiers-the-waves)), round the cistern by one of its fords
(`cisternWayRound`, [the cistern](#the-cistern)). Not under `PRACTICE` (`roadMainDist` answers
99 and no pad is ever registered).

Both maps paint it: a tan stroke on the minimap, a brown ink line down the parchment
(`updateMinimap`, `buildWorldMapImg`) — from the ground array. In the world it is **painted over the snow per pixel**, not per tile:
`paintGroundTile` paints every road tile, and every snow tile within `ROAD_SHOULDER` (1.4) + 1.2
tiles of the edge, as snow first and then hands it to `paintRoadOverlay` (the `the road's pixels`
group, js/draw/ground.js), which asks `roadDist` per pixel — inside, packed earth in two tones by 8 px
quad, the two ruts at `ROAD_RUT` (1.0) tiles off the *diagonal's* centreline (broken, wandering a
little along the lane on a per-quarter-tile cached noise), the odd stone and hoof-dark spot, and drifts of snow lying over the
last 0.7 tiles of the verge; outside, mud spread off the road in patches thinning to greyed snow
and then the field. The drifts and the mud are placed on a low-frequency `clump` noise read per
pixel, not on a per-pixel roll, so the melt reads as patches rather than sand. The whole bake
costs ~0.2 s at boot on top of the ground's own; a roost pad's paving repaints its disc and three
tiles round it once, the frame the bird lands.

## The bases

**Each side's home is a fixed hollow cut into its own roost corner's woods**, on the road's
diagonal: the `base` banner of [js/sim/base.js](../../js/sim/base.js). It is the same spot on every
seed, so a base is designed rather than found, and every bot knows it. RED (team 0) holds the
bottom-left corner, BLUE the top-right, mirrored across the creek like the camps (`baseU(team, u)`:
u → `WORLD - 1 - u`).

- The **hollow** is a clearing of radius `BASE_R` (15) tiles round `baseCentre(team)`, `BASE_U`
  (30) u from the corner; its wall wanders ±`BASE_RAG` (1.2) tiles on the position noise
  (`baseWall`), so it reads as a clearing, not a circle.
- The **perch** (`basePerch(team)`) is `PERCH_U` (21) u from the corner, at the back of the hollow
  and deepest in the woods: the bird roosts there ([eagle drop](rendering/eagle-drop-mode-drop.md)).
- The **mouth** is where the road leaves the hollow, `baseGateU(team)` (u `BASE_U + BASE_R`): the
  side's junction (`roadNest`, [the road](#the-road)), the way in for every walker.
- The road runs in through the mouth and **ends on the perch**: `baseRoadEnd(fx, fy)` is positive
  past either perch, and `laneDist` takes it, so the lane as laid and drawn stops at the bird.
- Two more mouths open the hollow's sides to [the side lanes](#the-side-lanes): the **top** mouth on
  the top-left wall and the **bot** mouth on the bottom-right, `BASE_SIDE_U` (34) u from the corner
  and `BASE_SIDE_S` (15) tiles across the road. `baseGate(team, lane)` is a lane's mouth (lane 0
  top, 1 mid, 2 bot) and `baseBaySpot(team, lane)` where its **bay** stands just inside it
  (`BASE_BAYS`, beside the lane in and clear of the stall), both through `baseTile(team, u, s)`,
  the side's frame: u along the road from its own corner, s tiles across (− the top side).
- `baseAt(tx, ty, pad)` names the side whose hollow holds a tile (`pad` tiles past the wall
  counted in), or −1, always −1 under `PRACTICE`. The chests and the rocks keep `BASE_KEEP` (3)
  tiles off a hollow's wall (`placeChests`, `placeRocks`).

`placeBase()` runs at boot right after `placeRoad()` (js/app/boot.js): every object inside a
hollow goes through `fellScenery` (a rock with both its tiles) and any ice there turns to snow. Pure
position noise, no `rng()`, so no seed moves. Not under `PRACTICE`.

## The side lanes

**Two more lanes join the bases besides the road**: the **top** lane round the top-left of the
valley and the **bot** lane round the bottom-right, the `lanes` banner of
[js/sim/lanes.js](../../js/sim/lanes.js). Each leaves either hollow's centre through its side
mouth ([the bases](#the-bases)), bends along the inside of the treeline, and crosses
[the creek](#the-creek) at the map's middle on a ford. They are fixed cuts, the same on every
seed: `LANE_HALF` is RED's half of the top lane as `[u, s]` control points in the road's frame,
BLUE's half mirrors it along the road and the bot lane mirrors the top across it (s → −s), and
`laneLine(lane)` smooths them (Catmull-Rom) into a centreline a point about every tile, with `at`,
the tiles along it (about 280 end to end; the road is 231). The points keep the lane about 14
tiles off the warren and 11 off the buff camp; on a seed with a deep border the lane cuts through
the woods instead.

**A lane IS road**, like a path: `roadDist` mins over `sideLaneDist(fx, fy)`, `LANE_HW` (3) tiles
either side of the centreline (a six-tile lane, a tile narrower than the road across the field)
with ±`LANE_RAG` (0.5) of wander on the position noise. So `placeRoad` paves it with the road in
its one pass, felling what stood there and turning ice to road, both maps ink it, the bake paints
it, and nothing drifts or grows on it. It has no ruts (those are measured off the diagonal) and
its own cables ([the zipline](#the-zipline)). `sideLaneDist` is **O(1)** like `pathDist`: the
segments (`LANE_SEG`, 3 tiles of centreline each) go through the shared `indexSegs`/`segsLat`
(world.js).

`layLanes()` runs at boot **after `layPaths()` and before `placeRoad()`**, so neither `genWorld`'s
carve rules nor the paths' search ever saw a lane: `sideLaneDist` answers 99 until it runs, and
always under `PRACTICE`. It rolls nothing, so no seed moves, and outside each lane's band the
ground is the same as before lanes existed. Where a lane crosses the creek it lays **stones**
(ground 5) on the water within `LANE_FORD_HW` (1.5) tiles of the centreline: a three-stone ford
along the lane, whichever way the creek bends there.

`laneWaypoints(team, lane)` is the march down a side lane: the centreline every `ROAD_STEP`
tiles from the side's own mouth to the rival's (`laneAlong`, `laneAt`), then the rival hollow's
centre ([Soldiers](gameplay/robots.md#soldiers-the-waves)). `laneZipTiles(team, lane)` is a side's cable
down it ([the zipline](#the-zipline)), and `laneHold(team, lane)` where a bot laner waits on any
lane, mid included, with no column of its own there ([bots](multiplayer.md#bots)).

## The creek

**One creek runs the whole map, world edge to world edge, down the
cross-diagonal** (`tx = ty`, the top-left corner to the bottom-right — the road's opposite), the
`the creek` group of [js/sim/world.js](../../js/sim/world.js). It cuts the valley into RED's half and
BLUE's with a roost on each side, meets the road once, at the middle where the waves meet (and
freezes there, into [the orca's lake](#the-orcas-lake): the one stretch that does), and
comes from beyond and goes on past us like the road: through the border woods too, where the
pines stand to the water's edge and there is no bank to walk along. Look A of
`docs/media/concepts/creek-concepts-1.png` (SNOWBANK CUT); its middle is [the cistern](#the-cistern).

**It is open water**, ground `4`: to every walker but a player a wall (`moveEntity`), to every
route a gap (`walkable`), and nothing spawns, lands or climbs out onto it (`waterAt`). A player
who steps in **plunges exactly as into an ice hole** ([falling in](#ice-holes-and-fishing)) — but
a dodge roll carries over it as it does over a hole: the roll's ~60 px clears the three tiles
of current only when started at the bank, and a roll that runs out over the water goes in. The scramble out is
onto the bank they went in from: `nearestDryTile` keeps to the same side of the water (creekAt's
`n`). A bot never wades in on its own feet — its walk is strict unless a shove past `WADE_SHOVE`
(sim.js) is carrying it — so the creek punishes a bot the way it punishes a player: by being
shoved in off the bank. The death line is `WENT IN THE CREEK`.

**The ways over**, all of them ground that walks like snow:

- **the cistern** at the middle ([below](#the-cistern)): the creek pools inside its ring and the
  pool is frozen, [the orca's lake](#the-orcas-lake), so the road goes in at one gate and out at
  the other across the ice, and anyone can come in by a gate or a breach, while the orca allows;
- **the cistern's two fords** (`cistFords`), one just outside each culvert, where the waves cross
  ([below](#the-cistern));
- **an outer ford** (`creekOuterFords`) on each stretch between a bend and the treeline, at
  its middle, where the stretch is `CREEK_FORD_GAP` or more;
- **a path's ford** wherever a grown shape's path crosses ([the paths](#the-paths)).

A **ford** (`creekFord`) is the whole run of water along one tile row through its point, made
ground `5` — a row, so it is always four-connected and nobody's feet cut a corner through the
current — with any pine on the tile past either end felled, so a ford never ends in a wall. On
OPEN FIELD the bends run most of the way to the treeline, so a seed often has no outer ford and
the way to the rival's camp is the cistern's ice (or a roll).

**The bends** (`creekBends`, `creekBend`): the two camps on the mirror line, the BROWN BEAR DEN and the
BLACK BEAR STONE, each have the creek swing round them in a half-loop, so each falls on one side's
bank: the upstream one (the brown bear, top-left) to RED, the downstream one (the black bear,
bottom-right) to BLUE. At the camp the line stands `R = r + PATH_CAMP + CREEK_BEND_GAP +
CREEK_HW` off the diagonal and eases back over `L = R × CREEK_BEND_LONG` either way along it as
`R (1 − t²)²`, flat where it rejoins the diagonal and never nearer the camp than `R` (that needs
`L ≥ 2R`). The line is point-symmetric about the crossing, as the roosts are, so both sides reach
their own camp dry-shod and the other's across the cistern's ice, a ford or a roll. Each bear lives on the
camp's side of its own bend, walking the water's edge ([river camps](#river-camps)).

**Geometry**, in tiles, off the road's own frame: `w` along the creek is `roadOffS` (+ downstream,
toward the bottom-right) and `p` across it is `creekP` (+ toward the top-right, BLUE's half).
The line is the bends plus a wander of `CREEK_WANDER` on the position noise (`creekMid`) and each
bank `CREEK_HW_RAG` off `CREEK_HW` (`creekHW`); `creekCalm` eases the wander and the rag to nothing
within `CREEK_CALM` of the cistern's fords (`CIST_FORD` + 2 tiles out), the middle half of a bend
and an outer ford, so the water meets each square: through the cistern the creek is `CREEK_HW` either side of the
cross-diagonal exactly, every seed, so the baked culverts always meet it. `creekAt(fx, fy)` is the signed distance to the nearer bank (negative in the water)
and leaves where the point is in `CQ` — along (`a`) and across (`n`, + toward BLUE's half) —
`creekFlow` the way the current runs there, and `creekWet` the
plunge test: in the water as drawn and off the frozen stretch (`creekIced`), so nobody
goes in off a pixel of bank. The ground array (a tile's centre) and the bake (a pixel) ask the same
functions, so they agree to within the bank, as the road's do.

`placeCreek()` runs at boot **right after `genWorld()`**, before the paths and the road: the
water fells whatever grew on it, the fixed fords go down, and last the cistern stands round the
middle and its pool freezes over (`placeCistern`). Pure position noise — nothing rolls, so no seed reshuffles — but it writes
`ground` after genWorld, so every seed's ground hash includes it
([determinism](#determinism-and-noise)). Not under `PRACTICE`. `DBG` exposes `creekAt`,
`creekFlow`, `creekWet`, `creekBends`, `creekOuterFords`, `waterAt` and `CQ`.

**Its pixels** (the `the creek's pixels` group, js/draw/ground.js): `paintGroundTile` hands every
tile `creekNear` to `paintCreek`, which paints per pixel over whatever the tile is — dark water
deepening toward the middle, the bank the light comes over (read off the slope of `creekAt`, so
the bends read like the straight run) wearing a white lip and throwing a band of shade on
the water, the far bank its pale face, still streaks stretched along the current, and a
ford tile's snow-capped stone (`paintFordStone`) with foam heaped on its upstream side. Both maps
ink the creek as open water and its fords as gaps. `drawCreekFlow`, right after the ground blit,
drifts a couple of glints per tile of open creek downstream every frame on the field's clock
(`windT`), so `DBG.step` and the wire's echo reproduce it. Under those glints (`drawCreekFish`,
drawn just before them) a LAKE WHITEFISH or a SNOW CHAR (`CREEK_FISH_CHAR` of them) swims
downstream every `CREEK_FISH_GAP` tiles of creek, now and then down out of sight and back, in under
the cistern's wall and never over a ford. Each is a pure function of its index and `windT` (`creekFishAt`,
world.js), so every client places them alike. A body that **rolls** over the water onto one
catches it (`creekFishCatch`, run by the roll in `playerMove`, updatePlayer's movement step, one winner through `contest()`):
it goes into the pouch as `whitefish` or `snowChar`, and its place swims back `CREEK_FISH_BACK`
seconds later (`state.creekGone`, index to the `windT` it returns at, in `SNAP_STATE` and the
save). Walking in is a plunge, so a roll is the only way to them. They are not the frost pike and
gold sunfish a hole or a net gives up, and the practice field has none.

Verified on seeds 42, 7 and 1234 across the shapes: every ford runs bank to bank with open ground
at both ends; the two junctions reach each other and every camp from both halves; a route across
the water only ever steps on the ice or a ford; three minutes of bots and waves put nobody in the
creek on their own feet, while a shove off the bank dunks a bot.

### The cistern

**At the middle the road and the creek meet inside a ring of dressed stone**, the works' old
cistern (the `the cistern` banner, [js/sim/cistern.js](../../js/sim/cistern.js)): its pool is
[the orca's lake](#the-orcas-lake), all ice. Look H CUT BLOCKS of
`docs/media/concepts/cistern-concepts-4.png`. The ring runs from `CIST_RI` to `CIST_RO` tiles off
the crossing (in `w`, `p`: the road's and the creek's frame), the wall 16 px tall (the bake's `HWALL`). The road comes
in at **two gates**, `CIST_GH` tiles either side of it, each a stone **sill** (ground `3`, walked
over) between two piers a head taller than the wall. The wall is down in **four breaches** on the
diagonals of that frame (north, east, south and west on screen), each stepping down course by
course, and the blocks that fell lie round them, most outside. The creek runs in and out under it
by a **culvert** each way, frozen under the wall (`CIST_FROZEN`) and open past it.

**It is baked, footprint and all.** `app/bake-cistern/paint.py` paints it as a heightfield per world
px in the game's 3/4 view and writes `js/baked/cistern.js` (`SPRITES.cistern`, never hand-edited):
`geo` (every measure above, read by the sim, so it can never stand off the art), `flat` (the sills
and every shadow), `segs` (the standing stone in pieces) and `solid` (the footprint: every ground
px stone stands on). Everything random is drawn from (`w`, `|p|`), so BLUE's half is RED's
mirrored, and nothing reads the seed: the creek is calm through it (`creekCalm`), so the culverts
meet the water on every seed. The bake keeps every fallen block `LANE` (16) px off each breach's
middle line and refuses to write if a breach or a gate leaves less room than that.

**Solid to the pixel.** `cisternField` turns the footprint into an exact distance field (px to the
nearest stone) once a page. `moveEntity` asks `cisternReach` on every axis step of every body: a
circle of the body's radius round its feet (`CIST_FOOT` px under `x, y`), swept every `CIST_STEP`
px, so no roll, rush, charge or reel goes through a block, and the body stops against the stone,
not short of it. A body already touching it may move any way but deeper. The tile grid gets three
coarser reads off `placeCistern`'s flags: `cisternTile` (a tile whose middle is stone: a wall
to `isSolidTile`, so to every shot, but not to `moveEntity`, which passes `swept`,
nor to the `.` view's cyan boxes), `cisternBlocks` (no body fits at the middle: `walkable`, so every route, spawn and
`nearestDryTile`, and `landPlayer`) and `cisternTouches` (any stone: `canPlaceAt`, and both maps
ink it). `findPath` refuses a step between two tiles' middles that a block lies across
(`cisternCuts`), `navLineClear` asks the px (`cisternCrowds`), and whatever puts a body down (a
warp, a hop off a cable or a deer) moves it off the stone the same way. The `.` view draws the
footprint's edge and each nearby body's feet ring (`drawCisternHitbox`). Pure position, the same
every client: no sim state, nothing to save.

**Drawn in two layers** (js/draw/cistern.js): `paintCisternFlat` lays the flat layer into the ground
canvas a tile at a time from `paintGroundTile`, under everything that walks; `pushMiddleDraws` puts
every piece of stone in view into render's y-sorted pass. A piece is the stone standing on
`BAND` ground rows, split where its columns break, keyed as a body whose feet stand on its middle
row, so a body is over every stone north of its feet and under every stone south of them: behind
the wall only a head shows over it.

`placeCistern` (placeCreek's last step) makes the ground the cistern's: ice inside `CIST_ICE`, the
creek frozen to `CIST_FROZEN`, the sills road, every other lake and everything worldgen stood
cleared off `CIST_CLEAR` (a later pass's zipline pylon may stand at its rim, off the stone), and
last a ford outside each culvert.
`cisternLane` ends the laid road on the sills ([the road](#the-road)). Not under `PRACTICE`.
`DBG` exposes `cisternR`, `cisternDist`, `cisternReach`, `cisternTile`, `cisternBlocks` and
`cisternTouches`.

**A ford outside each culvert, the waves' way round.** `placeCistern` lays a ford (`creekFord`) on
the creek's line `CIST_FORD` tiles up and down it from the crossing, its stones just clear of the
wall and the whole row on the cleared ground, where `creekCalm` holds the water square, and keeps
the two rows as `cistFords` (the upstream one first). `cisternWayRound`, from `makeSoldier`, swaps
the road's waypoints on the cistern's ground for the road just short of the soldier's own gate,
the ford's bank on its own half, the far bank and the road just past the rival's gate: every
other soldier out of a barracks' door takes the other ford, so a column comes up the road, forks
round the ring, and the two sides' waves meet on the stones, never on the orca's ice. Anyone
crosses them; a route takes one when it is the shorter way.

Verified on seed 7 (headless): walking with rolls and the warrior's rush at it from 120 angles,
no body's feet ever came within its radius of the stone, and only the gates and the breaches let
anyone in; a route from outside reaches the ice through each of the four breaches and both gates;
on 24 seeds nothing stands on its stone. The fords, on 24 seeds and every shape: both laid, five
stones each with open ground at both ends, and every leg of each side's march round each of them
a whole route that steps on no ice and no water; on seeds 7 and 42 every soldier of the first
waves crossed on the stones, none set foot inside the ring and none stood in the water.

### The orca's lake

**The cistern's pool is frozen over**; the orca lives under it ([the orca](gameplay/wildlife.md#the-orca)).
It is a disc `ORCA_LAKE_R` (= `CIST_ICE`) tiles round the crossing, its rim under the wall's
inner face, so each side's half of the valley gets the same ice. `orcaLakeEdge(fx, fy)` is the
signed distance in tiles to the rim (negative inside), `orcaLakeAt` the membership, `orcaLakeNear`
a tile that holds any of it or the frozen creek (for the painters) and `creekIced` the creek
frozen there, on in under the wall. All of it is off `roadOffS` and `creekP`, so nothing rolls.
`placeCistern` lays it; a landmark never stands on it (`LM_WHERE.lake`).

**Its pixels** are any lake's: the shore, the banks and the sheet come off `iceAtPx` like every
lake ([the ice shore](#the-ice-shore)), but `bakeLakes` labels it first and always in the DEEP
style (`ORCA_ICE`), so its dark middle is where the orca swims. Where the creek is frozen,
`paintCreek` leaves its water to the sheet and paints any of it the shore leaves bare as ice. Not
under `PRACTICE`. `DBG` exposes `orcaLakeAt` and `orcaLakeEdge`.

## Snow depth

One map of how deep the snow lies, `snowDepth(fx, fy)` (tile space, 0..1; `snowDepthPx` for
world px), in [js/sim/depth.js](../../js/sim/depth.js). It is static for the match and a pure function
of the seed and the scenery worldgen stood up (`hash2`/`vnoise`, **no `rng()`**), so every
client lays the same map and no seed's world moves. Anything that cares how deep the snow is
asks it; its bands:

- **DEEP** (`>= DEPTH_DEEP`, 0.6) is the **brush**: `brushOf(x, y)` names the patch a point
  is in (`deepAt` is the yes/no), on open snow (ground 0) only, so a runtime paving or a hole
  takes it away. A body in it is hidden from the other side ([Deep snow](gameplay/deep-snow.md))
  and it is drawn raised (`deepTone`, below) with reeds standing in it.
- **MID** (`DEPTH_MID` 0.25 up to deep) is a drift you see and do not hide in: the skirt
  round each brush patch (`BRUSH_SKIRT`), and the **lee pad**
  every standing thing out in the open holds (`layLees`/`leeDepth`, `leeCell`): the same shape a
  tile or two long downwind of a pine on the forest's edge, a rock, a bush, a stump, a snag, a
  den or a hut, at most `LEE_AMP` (0.42) tall. Forest floor (`LEE_WOODS` breakers among its eight
  neighbours) gets none.
- **Shallow** is the rest, down to a dusting in the hollows (`hollowDepth`, low on the
  position noise, capped at `DRIFT_HOLLOW` 0.2, so a hollow is never a drift). The field says
  nothing about the ground under it, so it reads over ice too.

The depth is the tallest **drift** at a point (`drifts`, the deep ones, indexed per tile in
`driftCell` with their skirts), over the lee pads and the hollows. `layDrifts()` runs at boot
once every worldgen pass has stood its scenery up (after `stockCamps`, before `prepGround`; under
`PRACTICE` it lays none):

- **The wind.** `driftWind` is the seed's prevailing wind, within `DRIFT_WIND_ARC` of the
  creek's line and either way along it. The lee pads and the ground's swells (`SNOW_ANG`) follow it.
- **The brush** (`layBrush`): hand-placed, the same on every seed. `BRUSH_PATCHES` lists RED's
  half in the road's frame (`baseTile`: u along the road from RED's corner, s across it), each
  an ellipse (half-length, half-width in tiles, world angle) with a rim wandering `BRUSH_WOB` on a
  fixed noise; BLUE's half is the same list mirrored across the creek's line, (tx, ty) -> (ty, tx),
  so both sides hold the same deep snow to the tile. Per side: one by each side lane on its
  inside edge, one either side of the mid road, one each side between the mid road and the
  dens, and one each side short of the creek toward the bears. A patch (`brushDepth`) is deep
  from its rim in (`brushIn`, tiles in from the rim, is what the fog of war measures) with a MID
  skirt `BRUSH_SKIRT` wide outside it. Laying it fells the pines, rocks, bushes, stumps and
  snags within `BRUSH_CLEAR` of the rim and turns ice there to snow, so no seed's ice or forest
  eats a patch; a chest, a landmark or a camp's prop stands. `brushNear` finds a patch near a
  point for the bots.
- **The warrens' own.** Each [SNOWDROP WARREN](#camps) is brush too: `layMeadowDrifts` lays one
  round **pool** (`MEADOW_POOL`, a drift with `pool` set that `driftDepth` hands to `poolDepth`,
  `poolIn` its rim distance) in the camp's own frame (`campFrame`), filling the clearing to its
  ring of pines. It can leave a crust island in its middle (`ring`) or a crust lane winding in
  from the mouth (`lane`). Nothing in it reads the seed (its rim wanders on a fixed wave), so
  both warrens wear the same pool, mirrored, on every match.

The deep band's pixels are baked into the ground: `snowTile` (js/draw/ground.js) hands every
pixel of a tile with a `driftCell` entry to `deepTone` (js/draw/depth.js), which reads the same
`driftsDepth` the sim does - a white crest and a thin outline on the sunlit edge, a smooth bright
top with faint wind ripples, a two-pixel dark lip where it faces away, and a shade thrown
down-right, longest at the tall crest. The frosted reeds standing in it are sprites, y-sorted with
the bodies (`reedDraws`/`drawReed`, js/draw/depth.js; [Deep snow](gameplay/deep-snow.md)). Its colours are `DEEP_PAL`, appended to `SNOW_INK`.
A pixel reads its neighbours' depths up to four pixels away, so `snowTile` opens a window over
its tile (`deepTileOpen`) and `deepPx` works each depth in it out once.

## The zipline

One cable per team down each lane, the `zipline` banner of [js/sim/zipline.js](../../js/sim/zipline.js): a
polyline of **pylon** points `{ team, lane, pts, cum, len }` (`pts` are body positions —
a rider's `p.y + 4` sits on the pylon tile's centre — `cum` the px along at each point) laid by
`placeZips()` at boot **right after `placeRoad()` and `placeBase()`**, on pure reads (`basePerch`,
`roadNest`, `roadSpan`, `roadEdgeAt`, `objAt`): nothing rolls, so `genWorld` and every seed's ground are
untouched. Not under `PRACTICE`. `zips[0]` and `zips[1]` are each side's line along the road;
the side lanes' four follow them, and a body's `p.zip` is its line's index. The road's points,
base to front:

1. the **base pylon**, `ZIP_BASE_OUT` (4.4) u up the road from the perch, `roadEdgeAt(u, side) +
   ZIP_OUT` (0.6) tiles off the centreline on the bird's own right (`roadNest(team).side`: the two
   cables sit on opposite verges and mirror through the centre like the camps), past the crash pad,
   so the ride home lets go beside the bird;
2. a pylon every `ZIP_SPAN` (10) u along the same verge to the **terminus** at `ZIP_MID_GAP`
   (20) u short of the road's centre — a stub of a span at the end joins the one before it — so the
   middle stretch where the waves meet is cable-free.

A side lane's line (`laneZipTiles`, js/sim/lanes.js) starts at a base pylon `LANE_ZIP_S` (7)
tiles off the perch on that lane's side of the road, then runs the lane's **outer** verge from its
mouth, a pylon every `LANE_ZIP_SPAN` (14) tiles, to `LANE_ZIP_MID` (28) tiles short of the
lane's middle. `zipLay(team, lane, tiles)` stands every line's pylons.

A pylon's tile is the nearest along the road (u, u±1, u±2) that is dry and holds nothing but
worldgen's scenery — a pine or a rock gives way, like the road's poles (`laneFells`); anything
else refuses, and the point stands whether or not a pylon does. It is an `OBJECTS` entry
(`pylon`: solid, inert to E, carrying its `team`; `mm` grey), so `isSolidTile`, `canPlaceAt` and
both maps handle it for free. Its pixels are `PYLON_SPRS` (one bake per team skin) and the cable
pass `drawZips` in [js/draw/zipline.js](../../js/draw/zipline.js); both maps stroke each line in
its side's ink. Seed 42: RED's line runs u 23→88, BLUE's 134→208.

`zipPoint(z, d)` is the cable at `d` px along (position, unit tangent, span and how far across
it), `zipLift(z, d)` how high it hangs there (`ZIP_H` 31 at a pylon, `ZIP_SAG` 3 less mid-span),
`zipNearest(z, x, y)` the nearest point of a line to a spot, and `zipNear(p)` the line a body may
clip on — the nearest, within `ZIP_GRAB` (32, two tiles) px of the track — or null:
**either side's**, a cable is anyone's ride. `zipUnder(wx, wy)` is the same
question for a world point against the cable **as drawn** — the point dropped to the track by
the lift where it lands (once for the span, once more with that span's sag), within `ZIP_HOVER`
(6) px — which the pointer's hover and the click scheme's press ask. The ride itself:
[the zipline](gameplay/momentum-movement-players-only.md#the-zipline).

**The road towers cut it.** `placeTowers()` (js/sim/towers.js, right after `placeZips()` in boot)
keeps every cable whole in `zipWhole[line]` (a line is its index in `zips`), stands two towers on
each at the points `TOWER_AT` (half and all of the way, base to front) picks, and moves those
points onto the tower, so the cable runs into it: two towers a lane, six a side. Each tower records its line and point (`o.zl`, `o.zi`). Every frame `towersSync()` cuts
`zips[line]` to the furthest standing tower's point on it, or sets it to null when none stand. The cut is read off the
structures alone, which are synced, so a client cuts the same line. A tower's 3x2 footprint is the
nearest to its point, inside `TOWER_SEEK` (6) tiles, that is dry, clear of the cistern and holds
nothing but scenery or a pylon, on plain snow if any such footprint is near and else on road
tiles (`towerStand`). The pylon it replaces is taken out, and so are pines and rocks
`TOWER_CLEAR` (1) tile round it and one more in front, so nothing stands over its face. All of it
is pure reads, so no seed shifts.

## Camps

The jungle: named places at **fixed, mirrored sites** where neutral monsters stand — the things
a team is choosing between while the eagle is still in the air, and the places it walks out of
its base for. They live in the `camps` banner of [camps.js](../../js/sim/camps.js) and in the
module-scope `camps` array (`{ key, spec, name, tag, tx, ty, r, repopT }` per placed site).
Five kinds, one reward each:

- **WOLF DEN** (`resource`, r 5, ×4) — a `den` in an open clearing and a pack of 4
  wolves. Gold per head (`YIELD.wolf`), the biggest steady payout on the map. Back 60 s after
  the last one dies.
- **BLACK BEAR STONE** (`buff`, r 4, ×1) — a [river camp](#river-camps): no props, one **black
  bear** (kind `alpha`) walking BLUE's bank of the downstream bend. The brown bear's match, the same
  body: the same hp, the same pay, its own BLACK BUFF for the whole team for 120 s
  ([camp monsters](gameplay/wildlife.md#camp-monsters-neutral-until-hit)). Back in 300 s.
- **BROWN BEAR DEN** (`epic`, r 6, ×1) — a [river camp](#river-camps): no props, the **brown
  bear** (kind `dire`) walking RED's bank of the upstream bend: a big body with a wall of hp. The kill pays the killer
  `YIELD.dire` and **every teammate** `EPIC_TEAM_GOLD`, gives the whole team the BROWN BUFF for 120 s, and
  writes the feed. Back in 300 s.
- **HOG HUT** (`hut`, r 4, ×6) — no monster: a log hut (`hut`, a 2×2
  footprint; `SPRITES.hogHut`, eight frames of chimney smoke) with **three chests** round it, in
  a clearing buried in the **border forest** (`woods`). No path leads there: it is reached with
  an axe, and the chests are why that is worth doing. They are ordinary
  [chests](#treasure-chests) and never come back; `pop` 0 means nothing restocks and the anchor
  wears no clock.
- **SNOWDROP WARREN** (`meadow`, ×2) — dug into the treeline (`treeline`) halfway out from each
  roost, and the one camp **drawn by hand** (its `plan`): a round clearing in a ring of pines
  with one mouth out to the field, **three rabbits** in the middle, three **snowdrop** clumps at
  the back that each shield the picker's side and then rest on their own cooldown
  ([the dawn shield](gameplay/the-dawn-shield.md)), and the clearing filled to the trees with
  deep snow, which is brush (`layMeadowDrifts`, js/sim/depth.js). The rabbits are the only ones on the map
  ([wildlife](gameplay/wildlife.md)); nothing in it is hostile. Cleared, the three are back 40 s
  later on the camp clock; with no anchor prop, nothing wears it.

**One entry in `CAMPS` is one kind of camp**, and that entry plus its site is the whole feature —
no map, chart or HUD code knows a camp by name:

| Field | Meaning |
| --- | --- |
| `name` | printed by the M map (the minimap shows the glyph alone) |
| `r` | footprint radius in tiles: the clearing, the props, and the radius `campAt()` calls "here" |
| `mark` | map ink for its glyph |
| `icon` | the glyph itself: `[x, y, w, h]` rects inside a 7×7 box, stamped by `drawCampIcon()` with a dark rim pass so it reads on parchment, snow and forest alike |
| `kind` / `pop` | the monster kind (`MONSTER`, wildlife.js) and how many the camp holds (`a.home === C` is the backref; prey, the warren's rabbits, carries `a.meadow === C` instead, so it is never a camp fight) |
| `repop` | seconds after the **last** one dies before the whole camp is back — a camp is cleared or it is not; nothing trickles |
| `props` | what stands in it: `[dx, dy, type, variant]` off the centre, stamped in worldgen **before** the ground bakes; the prop at `0, 0` is the anchor and carries `site` |
| `spots` | where each monster stands, `[dx, dy]` off the centre (`spawnCampMonster` takes the nearest free tile if a slot is taken) |
| `woods` | the site is **in the border forest**, not the valley: `placeCamps` checks it is, `layPaths` cuts no branch to it and `placeChests` keeps off its rim |
| `treeline` | the site is **on the treeline**: between the border's shallowest edge and `CAMP_EDGE`, with the border grown out round it on every seed (the warren groves, below) |
| `plan` | the camp is **drawn**: rows of characters from the back of the clearing (into the woods) to its front (the field), centred on the middle of the middle row, turned to face the field from whichever edge the site is nearest (`campFrame`), so the mirrored site gets the mirrored drawing. `layCampPlan` stamps it in place of `clearCamp`, `props` and `spots`: `-` left as the seed grew it, `.` cleared snow, `T` a pine, `f` a snowdrop, `r` a monster's spot (kept on the camp as `C.spots`). `campNear` covers the whole drawing, so no later pass (rocks, chests, landmarks, drifts) lands in it |
| `river` | the camp is a **stretch of riverbank**, not a den: tiles of bank either way along the creek's bend round the site that its monster walks ([river camps](#river-camps)); `props` and `spots` are empty |

### Placement

**Nothing rolls.** `CAMP_SITES` writes each site once, for the RED half of the map, in
[the road](#the-road)'s own coordinates — `u` tiles along the diagonal from RED's corner, `s`
tiles off the centreline (+ toward the bottom-right half) — and `campSites()` mirrors every
entry across the map's middle (`u → WORLD − 1 − u`, same `s`) for BLUE, so **both teams walk the
same distance to the same camp**. A site *on* the middle (`u = (WORLD − 1) / 2`) is its own
mirror and is placed once, at equal reach from either roost; [the creek](#the-creek)'s bends
then give one to each side's bank.
**Three camps a side of the road, six in all**: a mirrored pair of dens on each side, finished
by one midline camp — the brown bear den top-left, the black bear stone bottom-right, facing it across
the road. A mirrored pair always lands on one side (the mirror keeps `s`), so a side can only
grow by a pair or by a midline site. The six **hog huts** stand apart from that count, out in the
border woods: two mirrored pairs by the far corners and one halfway along an edge. `campTile(u,
s)` is the conversion back to a tile. The layout as shipped:

| Camp | RED-half site (u, s) | Tiles | Mirror |
| --- | --- | --- | --- |
| WOLF DEN | 90, −25 | 72, 123 | 123, 72 |
| WOLF DEN | 90, +25 | 108, 159 | 159, 108 |
| BLACK BEAR STONE | 115.5, +44 | 147, 147 | — |
| BROWN BEAR DEN | 115.5, −40 | 87, 87 | — |
| HOG HUT | 100.5, −114 | 20, 50 | 50, 20 |
| HOG HUT | 100.5, +114 | 181, 211 | 211, 181 |
| HOG HUT | 63, −61 | 20, 125 | 125, 20 |
| SNOWDROP WARREN | 91.5, −56 | 52, 100 | 100, 52 |

The huts are 20 tiles in from the world's edge: the two far corners (top-left and bottom-right)
hold one of each side's, and each side has one more halfway along an edge of its own half.

The two midline sites sit on the cross-diagonal, which is [the creek](#the-creek)'s line: the
creek bends round each, so the brown bear den stands on RED's bank and the black bear stone on BLUE's.

`placeCamps()` runs as worldgen's last ground pass (boot: after `placeRoad()` and `placeZips()`,
before `placeChests()`), then
`stockCamps()` fills every camp once `spawnAnimals`/`spawnFish` are done (and tops one up to
strength, never past it, when `DBG` calls it by hand). Every site sits at least `CAMP_EDGE`
(72) tiles from the world's edge — past the deepest treeline the border noise grows
(`BORDER_MAX`, 70) — and `placeCamps` throws if one does not, so a site can never be moved into
the woods by accident. A `woods` camp is the rule turned round: its whole clearing (`r + 2`) must
end inside `BORDER_MIN` (30), the shallowest treeline any seed grows, so it is buried in pines on
every seed (and stays `r + 4` off the edge itself). A `treeline` camp sits between the two: its
clearing must stay outside `BORDER_MIN` and its centre inside `CAMP_EDGE`. The seed's border
wanders 30–70 tiles deep, so on a shallow seed a warren would stand in the open field — and each
warren's stretch of border is **grown out to meet it** (`warrenGrove`, unioned into `borderDepth`
like the roost discs): a tongue of pines from the edge to `GROVE_IN` (3) tiles past the warren's
centre, as wide as its clearing plus three, tapering `GROVE_TAPER` (1.4) tiles of depth a tile
back into the seed's own edge, with a ±1.5 wobble on the fine noise. The clearing is then cut out
of it, so the warren is a bay in the treeline on every seed, and the warren's own drawing
(`plan`) then sets every tile of the bay: its wall of pines, its clearing, its props. Like the
discs it only adds pines, which roll nothing. Terrain still comes from the seed: **`clearCamp()` clears everything
inside `r + 2` of the centre** — a pine, a rock, a bush goes, ice becomes snow — so a camp is the
same clearing on every seed, and the props then stamp the same on every seed. A river camp also
fells everything on its bank ([river camps](#river-camps)). (A camp on a
seed's forest bay is therefore a clearing cut into its edge, and a river running under one
gets a snow bridge.) The clearing is the one pass that writes `ground` after `genWorld`
([determinism](#determinism-and-noise)), and nothing in a camp draws a random number.

### River camps

The two bear camps (`river` in `CAMPS`) have no den, no props and no fixed spot. At
`placeCamps` each lays `C.path` with `riverPath(C)`: one point a tile, `river` (9) tiles either
way along the creek from its bend's apex, on the camp's own side of the water and `RIVER_BANK`
(0.6) tiles back from the bank, each carrying the spot `RIVER_REACH` (0.35) tiles into the water
its scoop lands in (`wx`, `wy`). Pure
position off `creekBends`/`creekMid`: nothing rolls. Everything standing on the line or a tile
either side of it is felled. The bear spawns, and comes back, at the stretch's middle; the walk
and the fishing are [gameplay.md](gameplay/wildlife.md#camp-monsters-neutral-until-hit)'s.

`campNear(C, tx, ty, pad)` is every question about a camp's ground: inside `C.r + pad` of the
site, or for a river camp within `RIVER_BAND` (2) + `pad` of any point of its bank. `campAt`, the
leash, the rocks, the drifts and the landmarks all keep off or count the bank through it.
`campMark(C)` is where both maps stamp the glyph: the site, or the middle of a river camp's bank.

### Runtime

**A camp is neutral until hit.** No sight, no bar filling while you linger: you can walk
through a den and nothing happens. A hit wakes the whole camp on the hitter, the camp leashes
when the hitter leaves its ground and heals — the rules are in
[gameplay.md](gameplay/wildlife.md#camp-monsters-neutral-until-hit). `campAt(x, y)` returns the camp a
world position stands in (the leash and the keep-out ask it).

`updateCamps(dt)` (from `updateWildlife`, `updatePlay`'s wildlife step) runs each camp's respawn clock (`C.repopT`), kept honest
enough to be shown: a camp with anything alive in it holds the clock at `repop` — a half-killed
pack never trickles back; cleared, it counts down; and due, it **holds at zero** for as long as
any player is within `CAMP_HOLD` (96 px) — clearing a camp is a real reward for a while and it
still grows back, the moment the intruder leaves — then every slot is refilled at once. **The
anchor prop wears the clock** (a river camp has no anchor, so the bears' clock is not shown in the world): `drawCampClock` (js/draw/marks.js) prints the seconds left over
the den mouth at all times while the camp is cleared, and `drawCampMark` greys the camp's glyph
on both maps with the same seconds under it, so a jungle route can be walked on the clock. A camp
with anything alive in it wears none, and neither does one that is due and waiting for you to go.
Under the fog a side knows a clock only while it sees the camp (`campClockSeen`): out of sight it
counts the last clock it saw down, and a camp cleared unseen shows none.

`DBG` exposes `camps`, `CAMPS`, `CAMP_SITES`, `campSites`, `campTile`, `campAt`, `stockCamps`,
`campBuff` and `warp(tx, ty, p?)` — warping a player beside a site is how to stage one (never
onto the anchor's tile: it is solid).

### Saved for later

The **abandoned mine**, **frozen fort**, **shipwreck** and **shop** are meant to be table entries
here, not new systems, and so is the old **rookery** — the bird kind's code is dormant, not gone
([checklists.md](checklists.md#known-drift)). The format already holds them: `props` may stand
up anything `placeObj` takes, `clearCamp` makes the ground under it snow, and a `kind` that is
not a camp monster is simply whatever `updateAnimal` dispatches it to. What a new camp *does*
cost is a site in `CAMP_SITES` inside `CAMP_EDGE` and any **new object type** it stamps — that is
the checklist in [checklists.md](checklists.md#common-changes).

## The practice arena

The TRAINING FIELD behind the title's PRACTICE TOOL, reached through a party: the party lobby's
START takes the whole party there (`partyPractice`, js/ui/rooms.js; [gameplay.md](gameplay/settings.md)),
the leader's page hosting and friends joining on the spawn tile (`practiceSeat`; an empty seat is
parked in the corner forest, `practiceVacate`, js/sim/practice.js). `?practice=1` boots `genPracticeWorld()` (the
`practice arena` banner, js/sim/practice.js) **instead of** `genWorld()`, and js/app/boot.js skips
camps, chests, wildlife spawns and the eagle drop entirely. **The practice world is
`WORLD` 112 under `PRACTICE`, against the match's 232** (the conditional above the `WORLD`
const, js/sim/core.js; everything downstream sizes itself off `WORLD`, so the match world is
untouched). The field and the ice loop's collar round it are one `PR_RING` (76) tile square
block centred across the top (`PR_OX`/`PR_OY` offset every fixed parkour coordinate, which is
written in the block's own tiles); the **deer ride's forest wing** fills the rows under it. The **clock never runs**: js/app/boot.js pins `state.time` to early morning and sim.js
never advances it under `PRACTICE` — crisp daylight forever, no dusk, no dawn refreeze. The
**cloud shadows are skipped there too** for the same reason the clock is pinned: a shadow drifting
over the dummy's meter or the parkour's ice would change what those instruments measure between
one lap and the next. The sun shafts stay ([rendering.md](rendering/light-and-weather.md)).

The arena is one open **40×23-tile snowfield** (`PR_W`/`PR_H`) cut to pure combat. What stands
in it:

- a single **dummy** in the open snow in the middle, the spawn (`PR_SPAWN`) just south of it;
- the **range bell** five tiles west of the dummy on its own row;
- the **archery targets** riding a two-rail track around the field's whole perimeter (below).

No fences, no wildlife, no chests, no pond, no harvest, and nothing spawns or restocks outside
a round. `PRACTICE` (js/sim/core.js) pins `SEED` to `PRACTICE_SEED` *above* the `?seed` parse, so
the field is bit-identical on every visit and no seed can reshape it.

**The ice parkour** runs through the forest collar around the field: a narrow carved-ice loop
(`PK_PATH` is the *stock* centreline in world tiles, carved by `pkCarve` — trees hug
both sides, and ice being mechanically slippery is the whole game of it). A cleared walk
(`PK_WALK`) leads out of the field's west side to the **checkered start/finish line**: a
**fixed five-tile strip** (`PK_LINE`) that `pkPlanCarve` force-ices on every carve whatever
width the roll cut the lane, so the painted band (`drawParkourLine`, js/draw/practice.js, called from js/draw/render.js's flat pass), the
lap test and the two `banner` flags capping its ends never stretch, gap or move. The lap:
stepping onto the line box starts the clock (`parkour`, the
module state beside `PK_*`), a checkpoint at the current track's farthest-east waypoint keeps a
lap honest (`parkour.cpTx/cpTy`, a radius test on the ice), and recrossing the
line records it and rolls straight into the next lap. Leaving the ice for `PK_OFF_T` seconds (or
dying) abandons the run. The live clock rides over the runner's head (gold, icy blue once the
checkpoint is armed) and BEST / LAST hang on a frost plate above the gate (`drawParkour`,
js/draw/practice.js) — the dummy meter's instrument language, same recorded carve-out. **BEST is
the profile's all-time record on the stock track**: seeded from `PROFILE.bestLap()` at gen,
written back through
`PROFILE.setBestLap()` on a record (stored at the plate's own 0.1 s precision; only a strictly
lower time writes) — one of the two records practice writes (the other is the archery round's,
below), while LAST stays session-only.

Everything is coordinate tests against the carved ice — no objects, no triggers. The trickle that refills a
match's shoal is **off entirely under `PRACTICE`** (js/sim/wildlife.js), because the only ice in the
world is the race line and a fish emerging into it would be absurd; `crackIce` still works on
the track (a hole in the racing line is the player's own doing, and re-entering rebuilds —
and a reroll unregisters the old track's cracks and holes before the forest regrows). Ice a
roll lays down after the bake is labelled as it lands (`relabelIce`, called by `repaintGround`,
js/draw/ground.js): the style of the lake it joins and the edge's depth, so the shore painter
can read it.

**The deer ride** is a hand-laid snow trail (`RD_PATH`, the centreline in world tiles, smoothed
by `rdCurve` into a Catmull-Rom curve and cleared `RD_RAD` either side by `rdCarve`): out of the
field's south edge, across the ice loop and the tree belt into the forest wing, a sweep west, the
wing east with no two bends alike (a hairpin, a long flat sprint, a hook that curls back west)
past three targets and over a felled log on the hook's climb (`RD_LOG`, pieces along the
cross-diagonal as across a match road, so the roll key's leap clears it), a dive south and north
across the ice again into the field. It is carved before the loop, so a crossing ends up ice, and a roll never grows forest back onto it (`rdTiles`, `pkAnimStep`). The three targets
are stock faces on posts off the track (`RD_TARGETS`; an `at` point holds a face there instead
of the rail, `addPTarget`), each in a clearing that runs three wide to the nearest stretch of trail. A **tame deer**
(`a.tame`: it never bolts from a player and never wanders, js/sim/wildlife.js) waits at the
trailhead (`PR_DEER`); `prDeerStep` (from `updatePractice`) puts it back on its stand
`PR_DEER_BACK` seconds after it is let go, shot or killed.

**The roll station is one die and one held wheel**: the die on its plinth stands in a small
felled nook off the walk's south side, adjacent to the walk so its `E ROLL` cap rises as you
pass (`pkdie`, `PK_DIE` — `pkDieNear` resolves it, shared by the prompt, `drawPkHint` in
js/ui/wheel.js, and the press in js/app/input.js). **Holding E beside it opens a three-wedge radial
wheel** (kind `'pkdie'`, the manage wheel's own hold-and-release grammar and the ordinary wheel
pipeline): one wedge per difficulty, each drawn as **that difficulty's coloured die** — a
green, amber or red cube with its pip count (`PK_DIE_COL`, js/draw/practice.js), the current track's
one wearing a gold frame. Releasing on a wedge IS the roll (`pkWheelPick`, through the same
`input.cmd` → `runCmd` path every wheel uses): it carves a **fresh random track** at that
difficulty, and the standing die's whole body recolours to the picked cube, so the die always
says what the current track is without opening anything.

- **The path.** `pkRoll` picks the loop through `pkGenPath`: waypoints on a jittered ellipse per
  `PK_DIFF` around `PK_CX`/`PK_CY` at `PK_RX`/`PK_RY` (easy few points/wide carve, hard many
  alternating slalom points/narrow carve), pinned to the west gate with lightly jittered
  approach legs, kept out of the field's `PK_APRON` (6) tile **tree belt** with chord segments
  routed around its corners (the carve plan itself refuses field tiles). The checkpoint is
  re-aimed at the new farthest-east waypoint.
- **The sweep.** The terrain change is watched, not a blink: `pkRoll` sorts every affected tile
  into events keyed by ring angle (`pkAngKey`, 0 at the gate) and `pkAnimStep` (from
  `updatePractice`) spends them as one eased carving front laps the collar in `PK_ANIM_T`
  seconds, closing forest over the old track (never onto the player) and cutting the new lane.
  Each pine shudders `PK_WARN` radians ahead of the front (a `k:2` event sets `o.shake`, which
  sim.js's object-timer loop decays) before it falls. A sparkle plume rides the front along a
  dense angle-ordered sample of the new path (`pkAnim.trail`) on a time-based clock, so the
  sweep stays visible where old and new track share tiles and no event fires.
- **Its cost and its locks.** Each event is one ground write plus one `repaintGround` (a
  shudder is neither) — a handful per frame, `PK_ANIM_CAP` bounds dt spikes. For the whole sweep
  the die tumbles, `pkRoll` refuses a re-roll and the `E ROLL` cap hides. `pkTiles` remembers
  the current carve (the walk, line and station never move), and a shared tile the player broke
  a hole through gets its own re-ice event, since its registration was wiped with the roll.
- **A rolled track flips `parkour.custom`**: BEST/LAST restart and the profile is never written
  from one — random loops are not comparable, so the stored record stays the stock lap.

Track rolls draw on the runtime `rng()` stream — post-boot
calls reshuffle nothing ([determinism](#determinism-and-noise)), and the arena's boot remains
bit-identical: the stock loop is carved before any roll can happen.

**The archery targets** (Link's-Crossbow-Training-style) all ride one piece of furniture: a
**two-rail track ringing the field** (`AG_RECT`, `AG_INSET` tiles in from the rim, so the ring
sits in open snow with the treeline well clear of every face; rails drawn flat by
`drawAgTrack` — two nested bands built from one exact-cornered `band` helper, with ties
spanning the rails kept clear of the corner joins). Every target is a trolley
on a rail — ENTITIES in `ptargets`, never tile objects (a mover crosses tiles every frame, and
a raised face should not block a walker) — so only arrows meet them: the arrow loop's sweep
(`shotContacts`, js/sim/sim.js) meets every live face disc (`ptFace`/`ptLive`/`ptHitR` — the hit disc
scales with the target's `size`, small or large, `AG_SIZE`). A target lives at track distance
`s` (`agPos` maps it to world x/y) on one of **two lanes** (`AG_LANE_GAP` px apart), with three
habits: `still`, `move` (rolling `dir × spd` along the rail, `AG_SPD` slow/medium/fast) and
`pop` (flipping up out of its trolley on its own `{hide, rise, hold, sink}` clock).

**Every habit tells at a glance** (`drawPTarget`, which owns every pixel): a target is a rail
*carriage* — plank body, wheels seated on the rail along the rail's own axis (`agEdge`), a mast
sized to its face — whose wheels turn while it rolls, whose lane hop lifts the whole carriage,
and whose hidden pop-up form rattles on the rail for a beat before the face flips up. The two
face sizes are separate per-pixel bakes (`bakeTargetFace` → `TARGET_SPR`/`TARGET_SPR_S`,
js/draw/practice.js; `TARGET_SPR` is the 32×32 face — true circles, hash-dithered band edges),
never runtime downscales, and every break snaps a shock ring out from the hit, sized to the
face it came off (`agRings`/`drawAgRings`).

**A mover
about to run into anything parked — or rolling slower — on its rail hops to the free lane and
keeps going** (`laneU` eases the hop, and `agBlocked` refuses a hop into an occupied stretch),
which is what lets a crowded round keep flowing.

A hit lands in `hitPTarget`, and **the face
explodes on contact**: points, popup, the run and the shatter (`agShatter` — chips, straw,
splinters and the shock ring) all land the same frame, so the feedback is instant and the round
clock can never eat a landed shot. After the break a **stock** target (the free-practice roster,
`agStock`) stands bare `PT_RESPAWN` seconds and springs a fresh face, while a round target is
spent for good.

**A target can stand in a match too**, though only a staged scene puts one there
(`app/media/scenes/deer-gap.js`): the arrow test and the draw read `ptargets` in any mode, the
list rides `SAVE_ROOTS`, and since `updatePractice` never runs in a match the face holds where
it was put. One carrying a `word` scores nothing: `hitPTarget` shatters it and `wordPop`
(js/sim/core.js) floats the word up from the face in the damage totals' gold
([rendering](rendering/damage-feedback.md)).

**Every arrow into a face also extends a consecutive-hit run** (`agStreak`),
minigame or not: the hit popup carries it from the second hit on (`X3` alone in free practice —
white, gold from five, hot orange from ten — appended to the points during a round), any
practice arrow that ends without striking a face breaks it (the arrow loop, js/sim/sim.js — the
dummy counts as a break: the run is a *target* run), and ringing a round in starts it over.
**The run is audible**: every `AG_RUN_STEP` (5) in a row flares at the face AND rings
`SFX.runUp(agStreak)` - the one cue in the game deliberately PITCHED by a number, because the
number is the thing being climbed - and losing a run that long plays `SFX.runBroke`. One
`AG_RUN_STEP` for the flare and both cues, or they disagree about what a milestone is.

**The archery round** hangs off the **bell** (`agbell`, `AG_BELL`) west of the dummy: standing
within E's reach (`agBellNear`) raises an `E RING` cap (`drawBellHint`, js/ui/wheel.js), and **holding E
opens a three-wedge radial wheel** (kind `'agbell'`, `AG_WEDGES`, the roll die's own hold-and-release
grammar and the ordinary wheel pipeline) — one wedge per round, RANGE, QUICK DRAW and DEFEND, each
in its own mark (`AG_WEDGE_ART`, js/draw/practice.js) with the best medal it has earned pinned to
the corner; the last-rung one wears a gold frame (the bell itself never wears the pick — no
recolour, the wheel's frame is the readout).

**What a round is lives in `AG_ROUNDS`** (js/sim/practice.js), one entry per round: its name, its
starting clock, how it opens (`begin`) and runs (`tick`), what a hit pays and what its popup says
(`hit`), when it is over (`over`), the plate's three rows (`rows`), the line under the final score
(`end`) and where its record is kept (`best`/`setBest`). `agame.mode` names the one in play and
`agUpdate`, `hitPTarget` and `drawAgameUI` only ever ask it; `agame.left` is the round's clock.
The range is the entry described next. The other two:

- **QUICK DRAW** (`QD_*`): one face on the track at a time, `QD_START` seconds on the clock,
  and every hit buys time back (banked up to `QD_MAX`). Every `QD_STEP` hits the round climbs a
  stage (`QD_STAGES`: large still, small still, mover, quick pop-up, small fast mover, each
  buying a little less time), and each new face prefers a track spot within `QD_NEAR` px of the
  archer, so the draw is the test, not the walk. The score is the hits.
- **DEFEND** (`DF_*`): straw **raiders** — the field dummy's own sprite, hopping on its post
  (`drawRaider`) — come in off the field's rim and make for the **hold**, the dummy's own tile
  (`DF_HOLD`, a dashed frost ring on the snow while the round runs, `drawDfHold`). One arrow drops
  one; one that lands within `DF_REACH` of the hold costs a life and ends the run, and `DF_LIVES`
  gone ends the round. They come faster and closer together the longer you hold. A raider is a
  `ptargets` entry of kind `'raid'` — only arrows meet it, nothing blocks on it — and it hops a
  straight line (`dfStep`) because the round has sunk everything that stood on the field. No
  clock; the score is how many went down.

Each round keeps its own all-time record: the range's in `PROFILE.bestRange`, the others in
`PROFILE.bestRound(id)`; the bell's BEST / LAST plate shows the last-rung round's.

**Medals**, Crossbow Training's: each round's `medals` is the score for bronze, silver and gold
(untuned first guesses), `agMedal` reads a score against them, and the medal is never stored —
it is always the record's. The final score wears the round's at 2x, the bell's plate the best's,
and each wheel wedge its round's best (`MEDAL_SPR`, js/draw/practice.js).

Releasing on a wedge IS the ring (`agRing`, through the same `input.cmd` → `runCmd` path every
order takes) and runs the show — this is the range's (`AG_ROUNDS.range`); the other rounds share
everything up to GO (`agame.phase`, ticked by `agUpdate` from `updatePractice`): the
stock roster bursts away and **the dummy and the bell itself sink under the snow**
(`agSinkU` crops their sprites in js/draw/passes.js; at full depth their objects leave the grid
entirely, so nothing blocks a shot — which is also why a running round cannot be rung off, and
`agEndRound` puts the same instances back), a **3-2-1 countdown** lands (a second per tick on
`SFX.countTick`, the class screen's own cue) in the eagle drop's
big-number language, and for `AG_T` seconds **random targets pour onto the track from a spawn
table that climbs with the clock** (`AG_DIFF`, a third of the round on each in `AG_RANGE_DIFF`
order: the three mover speeds, the small/still/pop odds, the crowd cap and its refill pace —
easy is slow, large and sparse, hard fast, small and crowded) — each worth points on the harder-shot-pays-more rule (base 10; small, pop-up and
fast/medium pay more, speed scored by **class** so the bonus means the same thing on every
difficulty's table; the floater at the face says what it paid).

A TIME / SCORE / HITS plate
rides top-centre (`drawAgameUI` — a practice instrument, the dummy meter's carve-out), every
live face outside the view gets a gold chevron pinned to the screen edge on the archer's line to
it (`drawAgMarkers`, js/draw/practice.js — the shooter's off-screen marker, eight baked pixel
arrowheads, and none at all while every face is in view), timing
out ends the round with the final score standing large, and BEST / LAST hang
on a frost plate over the bell (`drawAgame`). **BEST is the profile's all-time record**
(`PROFILE.bestRange()`/`setBestRange` — whole points, only a strictly higher score writes), the
lap record's twin and the second of the only two things practice ever writes.

**The practice bar** (js/ui/cheats.js, League's practice-tool column) hangs down the left edge
under the corner's open drawer, at the corner's size (`cornerSc`) (capped so it never runs off the
bottom): icon wells on one hud plate in two groups — LEVEL UP, ADD GOLD (`CHEAT_GOLD`, through
`tradeGold`, so it never counts as earned), REFRESH COOLDOWNS and REFRESH HEALTH (standing toggles,
`CHEAT_AUTO`, applied every tick by `cheatAuto` from `updatePractice`, frost-rimmed while on),
RESET TO LEVEL 1; then TELEPORT, SPAWN DUMMY and CLEAR DUMMIES. The name is the tooltip
(`tipCheat`). A press sends `input.cmd {kind:'cheat'}` → `runCmd` → `cheatCmd` (js/sim/practice.js,
`PRACTICE`-gated); TELEPORT and SPAWN DUMMY arm a ghost on the pointer's tile instead (green
where it lands, red where it would not — `cheatAimOk` asks what `cheatCmd` will), and a left
press on the world sends the order with that tile — teleport once, dummies until the button,
the right button or Escape puts it down. A spawned dummy is the field dummy's twin (meter,
mend), at most `CHEAT_DUMMIES` standing (the oldest goes), never mid-round, and it joins the
round's furniture so a rung bell sinks it with the rest. The chevron tab on the plate folds the
column away.

Practice is not a match, and everything with stakes is guarded on `PRACTICE`: the local player is
the only active one (js/app/boot.js parks the other nine as `control: 'none'` in the corner
forest), `die()` becomes `practiceRevive()` (full pool, spawn tile `PR_SPAWN`, a beat of
grace), `checkLastStanding()` never fires, and the profile is never written — `gainGold` skips
`PROFILE.addGold` and the pinned clock means `addDay` can never fire — with two deliberate
exceptions: a record parkour lap (`PROFILE.setBestLap`) and a record bell round
(`PROFILE.setBestRange` / `setBestRound`, both above). The way out is the ESC
slab's LEAVE plank ([settings](gameplay/settings.md)).

The **dummy** is an `OBJECTS` entry (`solid`, any tool, verb HIT) with one solid tile and a
26×42 sprite (`DUMMY_SPR`, baked in js/draw/practice.js). Every way of hurting it
lands in `hitDummy` (js/sim/actions.js): the E swing (`DUMMY_WORK_DMG`), every basic attack — the arrow loop
tests the dummy across its base tile and the two above it, so torso and head shots land — and
the roll's tackle. It never breaks: the pool floors at zero, the overhead bar appears only
while it is hurt, and `updatePractice` (called from `updatePlay` under `PRACTICE`) mends it
back to `DUMMY_HP` after `DUMMY_RESET_T` seconds unhit, with a shimmer for the announcement.
`updatePractice` is also the grounds' clock: it ticks every target's habit, rail roll and
respawn, runs the archery round (`agUpdate`), and times the parkour laps.

Over the dummy's head hangs its **damage meter** — LAST HIT / DPS / TOTAL for the combo in
progress (an instrument, the [carve-out](rendering/show-dont-label.md)). `hitDummy` keeps the ledger (`mLast`/`mTotal`/`mT0`/`mT1` on the object; a
hit after the mend window starts it over), DPS is total over first-to-last hit floored at one
second, and `drawDummyMeter` (js/draw/practice.js) draws the plate — visible only while a combo is
live, lingering `DUMMY_METER_LINGER` past the mend so the final read stands, then fading.

## Determinism and noise

Every run picks a fresh `SEED` at boot with `rollSeed()` — always **three digits**, 100..999, so
it reads off the lobby and can be said aloud (the reroll die rolls the same way) — and **everything
random derives from it**: there is no other entropy source. `?seed=N` in the URL overrides it with
any N, which is
how you replay or diff a specific world (and `?practice=1` overrides *that*: the
[practice arena](#the-practice-arena) pins `SEED` to `PRACTICE_SEED`). `drawTags()` prints `SEED_TXT` as a line of the **info
stack** on the left edge at the top quarter of the view (drawn after the map, settings, and death
overlays), so a screenshot carries the world it came from while `settings.info` is on — the INFO
DISPLAY row in the ESC menu or **F3**, default **off**, so flip it on before comparison captures;
in `title` mode the main menu prints the seed instead, next to the reroll die.

- `rng` is a single `mulberry32(SEED)` stream shared by worldgen *and* runtime effects (particle
  bursts, animal wanders, drop velocities). Worldgen is reproducible only because it runs first at
  boot — hence the CLAUDE.md rule against adding or removing an `rng()` call inside `genWorld()`;
  adding one after boot reshuffles nothing. A [map shape](#map-shapes) is the one thing that adds
  any, and only at the very end of `genWorld` behind `mapGrown(MAP_TYPE)`, so OPEN FIELD's stream
  is untouched.
- `hash2(x, y)` mixes `SEED` in, and `vnoise(x, y)` is built on it. Both are still pure functions
  of position *within a run* — use them for anything that must stay stable per tile no matter when
  it is asked (ground texture, forest boundary, tree rare-drops, the frost slabs' mottling).
  `borderDepth()` rides on `vnoise`, so the seed reshapes the forest and with it the whole map
  (everywhere but inside the two roost discs, which every seed grows alike).
- Two exceptions to the single stream, both for the same reason — nothing outside worldgen may
  perturb the main `rng`'s worldgen prefix. `fxRng` (`SEED ^ 0x9e3779b9`) feeds resize-driven
  snowflake top-ups in `fitFlakes()`, so window size / resolution changes cannot move the world
  (the boot-time 70 flakes still draw from `rng`, unchanged). `chRng` (`SEED ^ 0x43484553`) feeds
  the [treasure chests](#treasure-chests)' placement, and `rkRng` (`SEED ^ 0x524f434b`) the
  [rocks](#rocks)'. The [camps](#camps) roll nothing at all -
  their sites are written down - and neither does [the creek](#the-creek); the creek and the
  camps' clearings are the boot passes that write `ground` after `genWorld`, so a seed's ground
  hash includes them.
- `SEED` is a `const` in the rng banner and `hash2` closes over it, so nothing may call `hash2`
  before that line runs. Everything that does — `genWorld`, the ground bake, the panel bakes — is
  further down in boot order.

## Day/night

`DAY_LEN = 110`, `NIGHT_LEN = 55`, so a full `CYCLE` is 165 s. `state.time` runs within the cycle,
`state.day` increments at wrap; a dawn rings `SFX.dawnChime` and raises no headline (0.516 gave
the top centre to the announcer).
`update()` derives `state.darkness` (0→1) from a hand-written
ramp: dusk over the last 12 s of day, full dark, then a 10 s dawn.

Night is a **colour**, not a darkness — a blue multiply over the finished frame with the
stars reflected in the ice under it, and nothing to carry a lamp for
([rendering.md](rendering/light-and-weather.md)) — and no sim rule sharpens at night: nothing
in wildlife or the AI reads `state.darkness`. What keys off the cycle:

- The only passive heal, slow HP regen in `updatePlayer()` for every player, runs while
  `state.darkness < 0.3` — or at any hour under a kit with `nightHeal` (`baseKit`,
  js/sim/player.js; no card or item sets it now). There is no cold/warmth system.
- **The wind dies with the light.** `windAmp()` squares `1 - darkness`, so the snow stops blowing
  sideways and every pine goes still over the twelve seconds of dusk and stays still until dawn
  ([the wind field](rendering/drawing-a-thousand-of-something.md#the-wind-field)).
- The **sun shafts** are not on the darkness curve at all: they are up for the eagle drop and for
  about fifteen seconds around noon, and dark otherwise
  ([god rays](rendering/light-and-weather.md)). The **cloud shadows** fade out on it, and the **ice** darkens
  into a mirror on it with the **reflected stars** coming up inside that
  ([the reflected sky](rendering/light-and-weather.md#the-reflected-sky)) - so a frozen lake reads darker than the
  snow around it after dusk, and an ice hole is a hole in the reflection.
- Carved ice holes refreeze at dawn and cracks heal — **unless a fish net stands on the hole**,
  which is what holds that water open. The shoal is not topped up at dawn; it refills
  continuously. See [Ice holes and fishing](#ice-holes-and-fishing).

`state.day` drives no difficulty. What damages a player: another player's arrows, a
plunge through the ice (see [PvP](multiplayer.md#pvp)), and the wolves of a
[wolf den](#camps).

## Ice holes and fishing

**E over a bare ice tile** (no object) brings out the pickaxe and calls `crackIce(tx, ty)` on
that tile (see [The swing tools](gameplay/the-swing-tools-e.md); the weapon:
[the basic attack](gameplay/the-basic-attack.md)). Hits accumulate in the
`iceCracks` map (`tile idx → hits`, rendered as bright fracture decals in their own pass);
`ICE_HOLE_HITS` (2) breaks through — the tile becomes `ground = 2` (open water), joins the
`holes` list, and is repainted into the ground canvas via `repaintGround()`. Constants live in the `fish` banner of
[js/sim/wildlife.js](../../js/sim/wildlife.js) (`ICE_HOLE_HITS`, `HOLE_FALL_DMG`, `HOLE_FALL_T`,
`FISH_MAX`/`FISH_MIN`/`FISH_WATER_REF`/`FISH_CAP_MUL`, `FISH_CATCH_R`; `FISH_SPAWN_T` alone stays in core.js, and the `NET_*` set
sits beside `STRUCTS` in [js/sim/structures.js](../../js/sim/structures.js) with the net entry it tunes).

- **Falling in**: standing over a hole tile (checked at each player's feet in `updatePlayer`,
  js/sim/sim.js) plunges that player: `HOLE_FALL_DMG` (15) via `damagePlayer`, velocity zeroed, and
  `p.fallT` runs `HOLE_FALL_T` (1.1 s) of floundering — no movement, tools, dodge, or
  slide (`clickAction`, `tryWork`, and `tryDodge` all check `fallT`). `drawPlayer` clips
  the sprite to the waterline with ripple rects. The climb-out teleports to
  `nearestDryTile()` with brief i-frames. [The creek](#the-creek) plunges the same way, off the same check (`creekWet` on a ground-`4`
  tile), with the death line `WENT IN THE CREEK`. An **active dodge roll crosses open water safely**
  (the fall check skips while `dodgeT > 0`): any hole, and the creek when the roll starts at its bank. Every player falls in; `die(p)` and `Player.reset()`
  clear `fallT`. **A hole with a net on it is planked over** and the check skips it (`netAt`) —
  that tile is walked across like any other, which is how the catch changes hands.
- **Everyone else avoids water**: `moveEntity` treats hole tiles as solid for every entity
  except the player, so animals and robots never wade in — a net does not change that, because
  `walkable()` refuses `ground === 2`, so no bot ever routes over one. `isSolidTile`
  skips any `water: true` STRUCTS entry, so a net is not solid either; arrows still fly over holes.
- **Refreeze**: at dawn every hole reverts to ice (`repaintGround` again) and `iceCracks`
  clears — except a hole carrying a net, which stays open water *and stays in `holes`*, so it
  refreezes the dawn after somebody wrecks the net.
- **Fish**: the `fish` array holds up to `fishCap` passive swimmers — `FISH_MAX` (30) times how
  much swimmable ice the world has against `FISH_WATER_REF`, floored at 1 and capped at
  `FISH_CAP_MUL` (2.5), so OPEN FIELD and THICKET hold the 30 the game has always had and
  FROZEN ISLES holds 75 ([map shapes](#map-shapes)) — that many spawned at
  boot (`spawnFish()`, after `spawnAnimals()`, which is also the one place the water is measured) on **interior** ice only (tile centers passing
  `fishClear` with a 14 px margin, ~a tile off the shore). `updateFish()` wanders them with a
  **soft edge cap**: `fishClear(x, y)` requires `FISH_MARGIN` (6 px) of water on all four sides
  of the body, the steering veers away from shore a look-ahead early (choosing the more open
  side, falling back to the fish's per-fish `ts` turn bias), and movement is hard-clamped —
  a position that would poke the body into snow is never committed. That clamp is **axis-aligned**
  (`fishClear` probes ±margin on the four compass directions from the centre) while the drawn body
  is rotated, so a fish swimming diagonally along a shore can clip a corner of snow with its
  nose or tail for a frame or two, at the faint alpha an under-ice fish is drawn with — accepted.
  Each is a **FROST PIKE** or, one in `FISH_RARE` (0.2, js/sim/wildlife.js), a **GOLD SUNFISH**: `f.kind`
  (`fish` or `sunfish`) comes from `hash2` of its spawn spot inside `addFish`, so no `rng()` call
  is added. They render in a pass right after the ground blit (`drawIceFish`, js/draw/lakes.js, using `ex`/`ey`) as a cold blue
  **shadow** under the ice (`SPRITES.iceFish[kind].shadow`, look N: the swim sprite's shape in the under-ice ink
  alone, solid round its rim and half as strong in its core, so a pike and a sunfish are told apart
  by shape, never colour) at 0.42 alpha; where a fish crosses an open hole the crisp swim sprite is drawn clipped to the hole's
  tiles, so only what is in the open water shows in colour. Both are baked by
  app/bake-fish/paint.py (16 headings, 2 tail frames). Cracking ice spooks nearby fish into a fast dart.
- **Fishing is automatic**: `autoFish(p, dt)` (js/sim/attack.js, called from `updatePlayer` every
  step) checks whether that player stands on an ice tile with a fish within `FISH_CATCH_R`
  (16 px); if so the fish is taken with no press — once per `FISH_AUTO_CD` (1.2 s), spending no
  attack cycle — into the `p.food` pouch, splash, no arrow, and the press on the ice
  flies like any other ([the swing tools](gameplay/the-swing-tools-e.md)). The catch is
  [contested](multiplayer.md#contested-orders), so two players can't land the same fish. **The catch is a pose**: the contest's
  callback calls `startCatch(p, kind)` (below `autoFish` in js/sim/attack.js), `CATCH_T` (2 s) of three
  down-facing frames whatever the body faced - `CATCH_STOOP` (0.16 s) bent to the hole,
  `CATCH_HAUL` (0.22 s) with the fish coming up, then the trophy hoist over the head
  (`catchFrame(p)` says which; `drawPlayer` draws it, the held tool off, the
  overhead stack lifted 4 px for the hoist). It is shown only by a body standing still anyway:
  a step, any other intent (a fresh press, a roll, a cast, a swing, a meal) and a hit
  through `damagePlayer` end it at once via `cancelCatch` — an automatic catch may never cost
  the player a frame of control. `p.catchKind` picks the hoisted fish: a gold sunfish lifts the
  gold `catchSun` frames, anything else the pike's `catch`. A net's first fish is hoisted
  the same way from `updateStructures`. The frames:
  [sprites](sprites.md). `DBG.startCatch`/`cancelCatch`/`catchFrame` stage it. Hovering a fish (`hoverFish()`, a 7 px disc) switches the
  cursor to the water-blue **fish** reticle and `drawFishHint()` (overlay pass, after the E
  prompt) frames it with the same pulsing brackets stumps get — white when `fishInRange()`
  holds, dimmed blue-grey outside it, and no verb: the mechanic is proximity, not aim, and the
  brackets' brightness is the whole of that hint. Fish are food: **F** eats one over a 1.5 s channel a
  hit can break (`eatFish`, mirroring the berry's Q/+20; both meals share one 3 s clock - see
  [Food](gameplay/food-the-meal-is-a-channel.md)), counted beside the berries on the backpack strip.
  A hole gives the frost pike (`fish`, +50, `SPRITES.itemFrostPike`) or the gold sunfish
  (`sunfish`, +80, `SPRITES.itemSunfish`); with the creek's whitefish (+40) and snow char (+70)
  they are the four fish the fish well eats ([Food](gameplay/food-the-meal-is-a-channel.md)). `SFX.splash()` is the water cue. `DBG`
  exposes `fish`, `iceCracks`, `holes`, `crackIce`, `addFish`, `spawnEmerger`, `netAt`,
  `buildSiteAt`.

### Ice breaks

**Something big coming up through a lake breaks the ice in its own shape**, never a tile's
([js/sim/icebreak.js](../../js/sim/icebreak.js), the pixels in
[js/draw/icebreak.js](../../js/draw/icebreak.js)). The orca comes up through one
([the orca](gameplay/wildlife.md#the-orca): `orcaStrike`). `iceBreak(x, y, shape, ang, { warn, hold })` breaks the ice
round a world point and returns the break (null where no bare ice lies under it);
`DBG.iceBreak` stages one.

- **The shape is a footprint** on the ice plane: an `ICE_BREAK_SHAPES` row of ellipses and
  polygons in world px (nose to +x, turned by `ang`, squashed by `sq` the way the 3/4 view lays
  ground). `orca` is the orca's own; `breach` and `lunge` were its first sketches, kept for
  staged scenes;
  `iceBreakCovers(b, x, y)` is the same footprint as a hit test.
- **Every pixel is hashed, never rolled**: the hole is the footprint one px proud
  (`ICE_BREAK_PROUD`) with a chipped edge, each pixel's freeze time `ft` runs from 0 at the rim
  to 1 in the middle, and the plates and cracks come off Voronoi cells seeded the same way. All
  of it comes from `hash2` (the world seed), the break's spot and its own seed, so a break is a
  few numbers (`iceBreaks`, saved in `SAVE_ROOTS` and carried as a snapshot singleton) and
  every screen rebuilds its pixels (`breakCache`). No `rng()` call is spent.
- **Its life**, off `state.tick` (`iceBreakAge`): `warn` s of cracks tracing the outline, then
  it opens (plates flung out over `ICE_BREAK_BURST`, a splash, the fish scattered), stays wide
  open `hold` s (`ICE_BREAK_HOLD` by default), freezes back over `ICE_BREAK_FREEZE` (20 s) from
  the rim inward along a ragged front, and the new ice thickens from dark to the sheet's tone
  over `ICE_BREAK_SKIM`.
- **Tiles and pixels.** Only tiles that were bare ice at birth (`cov`) break. A tile at least
  half open water is ground `2` (so `waterAt`, routes and spawns treat it as water) until its
  own close time in `open`; `updateIceBreaks` (from `updatePlay`) opens and closes them. A
  tile a break holds is painted as ice (`paintGroundTile` asks `iceBreakHolds`) and the break
  draws its own water over it, so nothing square ever shows. A player's feet read the pixels
  (`iceBreakWet`): the plunge in `playerPlunge` and the climb out (`nearestDryTile`) go by the
  water as drawn, and a strict move (`moveEntity`) stops at its edge. A net built on a break's
  water keeps it open and joins `holes`, so the dawn refreeze has it from there.
- **The pixels** (`drawIceBreaks`, flat after the pick cracks in `render()`): one small canvas a
  break, repainted each frame it is on screen, clipped to where the ice is drawn (`iceAtPx`).

### The shoal is a population, not a nightly reset

`autoFish` and nets take fish **out** of `fish`, and nothing puts them back at dawn. What
refills it is a trickle in `updateFish`: `state.fishT` counts down `FISH_SPAWN_T` (11 s), or
`FISH_SPAWN_FAST` (4 s) while the shoal is under `fishFloor` (`FISH_MIN`, 10, on the same
multiplier the cap rides), and each expiry calls `spawnEmerger()` unless the shoal is already at
`fishCap`. So the water can be fished down hard, never to nothing, and recovers fastest when it
is emptiest.

**`born` is a fish's whole life story.** A born fish is hard-clamped
inside the water, drawn, catchable, nettable. An **emerger** is none of those. `spawnEmerger()`
puts it two tiles *into the snow* beside a roomy shore tile, pointed at the water — the snow being
the deep lake the map has no way to draw — and it creeps in at `FISH_EMERGE_SPD` (7 px/s) with the
wander, the edge cap and the clamp all switched off, because the shore is the thing it is crossing.

`fishVis(f)` samples five points nose-to-tail and returns the fraction over water; that is `f.vis`,
and it is what promotes the fish (`vis >= 1` *and* `fishClear` agreeing ⇒ `born`, after which the
clamp keeps `vis` at 1 forever). The **draw alpha ramps off the back half of it** —
`max(0, (vis - 0.5) * 2)` — so an emerger is completely invisible until more than half its body is
under the ice, and by the time anything is drawn the only part still outside is a pixel or two of
tail at a fraction of 0.4. An emerger that has not made it in
`FISH_EMERGE_MAX` (14 s) is dropped, unseen. Everything that selects a fish — `hoverFish`,
`fishInRange`, `autoFish`, the net, the `crackIce` spook — tests
`born` first.

**The emerge sites are found once and cached** (`emergeSites`/`buildEmergeSites`, a lazy one-time
scan costing ~1.4 ms) — never rejection-sample random tiles for one: on a 232² world a tile
that is ice with swimming room *and* has snow exactly two tiles off is rare enough that the
tries come up empty and the trickle silently stops. The
shoreline never moves, and a hole only flips ice↔water which `fishClear` counts as swimmable
either way, so one scan stays correct for the match; `genWorld()` only ever runs at boot.

### Fish nets

`STRUCTS.net` (`FISH NET`, 8 gold, 45 hp, one tier) is the only `water: true` building, and that
one flag — never the type name — is what every site reads:

| `water: true` means | where |
| --- | --- |
| built on a bare open hole, not snow | `canPlaceAt` (the ghost's colour, the click, and the contest callback re-checks it) |
| a pad's wheel over open water offers it, and only it | `buildSiteAt` → `buildOptionsAt` → `WATER_STRUCT_ORDER` |
| not solid — you walk **on** it, and the plunge check skips it | `isSolidTile`, `updatePlayer` |
| its hole never refreezes while it stands | the dawn branch, via `netAt` |
| drawn flat, under everything, never y-sorted | `drawNet` in the flat pass — see [rendering](rendering/render-pass-order.md) |

The net is the [build list](gameplay/base-building.md)'s last row: its ghost is white over a bare
hole and red anywhere else, the same `canPlaceAt` read as every other piece. A pad's build wheel
over a hole offers the net alone, and nothing is special-cased for a one-option wheel:
`wheelSpan(1)` is the full circle, so any direction out of the hub picks the net and the hub
still cancels.

A finished net runs two clocks in `updateStructures`' `net` branch:

- **Catching.** Any `born` fish within `NET_R` (9 px) of the tile centre is spliced out of `fish`
  and becomes `o.fish` (`o.sun` of them gold sunfish), capped at `NET_CAP` (3), one every `NET_CATCH_T` (2.2 s) so a net fills
  visibly instead of hoovering the pond. Fish are *drawn into* it: `nearestNet` gives every born
  fish a gentle lean toward any net inside `NET_LURE` (44 px) that still has room — that lure is
  what makes a net read as working rather than waiting on luck.
- **Emptying.** Any living player whose feet are on the tile takes one fish every `NET_TAKE_T`
  (0.3 s) straight into their pouch — **team is never checked**. A net is a thing lying on the ice,
  not a locked chest, so an enemy standing on yours walks off with the catch. It is
  [contested](multiplayer.md#contested-orders) (`net:<idx>`) so two players over one rope cannot
  take the same fish. Sunfish come out first. Nothing can refuse a catch: fish are a pouch kind and take no bag cell.

Enemies break a net with **E** like any other building (`workTarget` finds the object on the tile
and gates on `ownsStruct`); the owner demolishes it from the manage wheel. Either way
`destroyStructure` tips what it was holding back out as `sunfish` and `fish` drops before it goes.

