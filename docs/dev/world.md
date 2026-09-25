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
  ([eagle drop](rendering.md#eagle-drop-mode-drop)) — are forested to `ROOST_R` (68 tiles from the
  corner, ~48 along the diagonal) outright: `borderDepth` is the seed's own `borderNoise` **or**
  a quarter-disc whose arc wobbles ±`ROOST_WOBBLE` (3) on the fine noise, so whatever the seed grew
  there the corner holds one solid block of woods: the nest sits `CRASH_DEPTH` inside the arc and
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
  [Momentum movement](gameplay.md#momentum-movement-players-only)), and worldgen carves it as a travel
  network: 14 frozen lakes plus winding ~5-tile-wide rivers (`carveRiver` in `genWorld()`) —
  a spoke from each ring point to the central clearing and a ring linking each point to its
  neighbour. The shared `carveIce` rule skips existing objects, the ring points, the clearing and
  everything within `ROAD_ICE_KEEP` (6) tiles of [the road](#the-road)'s edge, so rivers gap
  naturally around them — and a river running at the road narrows to nothing over
  `ROAD_ICE_TAPER` (7) tiles first (`carveRiver`'s disc shrinks with `roadDist`), so it peters out
  instead of ending in a cut. Neither test rolls anything, so a seed's rng stream is what it was.
- `objects` — flat `Array(WORLD*WORLD)`, **at most one object per tile**. Every object is
  `{ type, tx, ty, hp, flash, shake, ...extra }`. The `OBJECTS` table's types: `tree`,
  `deadTree`, `rock`, `bush`, `chest`, `den`, `dummy`, `banner`, `rack`, `cairn`, `log`,
  `pylon`, `pkdie`, `agbell`, `stump`, `eagle`, `hut`, `part`; the `STRUCTS` table's: `wall`,
  `longwall`, `turret`, `generator`, `spawner`, `barracks`, `net`. `cairn`/`banner`/`log` are
  [the road](#the-road)'s furniture (`banner` is also the practice gate's flag), `pylon`
  [the zipline](#the-zipline)'s, and `dummy`/`rack`/`pkdie`/`agbell` exist only in
  [the practice arena](#the-practice-arena). `deadTree` (a 3 hp snag, chopped like a
  tree for `YIELD.deadTreeHit`/`deadTreeFall`, leaves a stump) and `den` (solid, inert scenery
  two tiles wide — `OBJECTS.den.w`, so `placeCamps` fills the tile east of it with a `part` — that
  carries its `site`, the camp record, so a hover on either tile can wear the camp's clock)
  exist only inside [camps](#camps) (`cairn` is a camp's anchor too), and so does `hut` (the HOG
  HUT: solid, inert, 2×2 by `OBJECTS.hut.w`/`h`, its parts stamped east and north so the anchor is
  the front row, drawing the whole building); `chest` is a [treasure chest](#treasure-chests)
  standing where a border tree stood, or round a hog hut. `part` is the filler a multi-tile building (or a prop
  with a `w`/`h` in `OBJECTS`, the den and the hut) leaves on every footprint tile but its anchor (`{ type: 'part', of: <building> }`): solid, coloured like its
  building on both maps, ignored by work swings, and resolved by `structOf()` for every "what building
  is here" read (right-click, cursor, wheel, orders).
- Index with `idx(tx, ty)`, read safely with `objAt`, create with `placeObj`. Deleting is
  `objects[idx] = null` (structures should go through `destroyStructure` so the `structures`
  registry stays in sync — it routes tiered types through `removeStruct`).
- `wall`, `longwall`, `turret`, `generator`, `spawner` are the **structures** any open snow or road tile takes (see
  [Base building](gameplay.md#base-building)). Each carries `{ tier, maxHp, building, buildT,
  buildTotal, dustT, sparkT }` plus per-type fields (turret `cd`; generator `payT`; spawner `mode`,
  `bots`, `respawnT`/`respawnTotal`, `door`), and every live one is also referenced from the module-scope `structures`
  array so `updateStructures()` never scans the 53,824-tile grid. (`updatePlay` does: one
  unconditional pass over all of `objects` every step, ticking `flash`/`shake` and bush regrow —
  that loop, not the structure tick, is where a full-grid frame cost actually lives.) A picked
  bush regrows in `BUSH_REGROW` (70 s) and **wears its own clock**: `bushEmpty` until ripening is
  `BUSH_BUD_T` away, then `bushBud` (pale buds where the berries will be), `bushRipen` (the
  berries back but dull) inside `BUSH_RIPEN_T`, then `bush` — chosen in `render()`'s bush
  branch, so a player reads wait-or-move-on off the plant at a glance, and **under the pointer a
  regrowing bush wears the neutral unit bar** filling toward ripe (the frames say roughly, a hover
  says exactly — [rendering.md](rendering.md#render-pass-order)); `ready` refuses E until the
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
- **The ground is baked once.** `renderGround()` (js/draw/ground.js) pre-renders the whole
  ground to one offscreen canvas at boot and the frame loop blits the camera window out of it;
  the per-tile painter is `paintGroundTile(g, tx, ty)`, and a runtime change goes through
  `repaintGround(tx, ty)` (the CLAUDE.md hard rule — the four neighbours are repainted because
  edge rims depend on them). The runtime ground writers: [ice holes](#ice-holes-and-fishing) and
  their dawn refreeze, a spur's and a roost pad's paving ([the road](#the-road)), and the
  practice arena's track rolls. The bake also lays the scenery's
  [cast shadows](rendering.md#cast-shadows), and `render()` repaints a caster's reach itself
  when what stands on a tile changes, so felling or placing scenery calls nothing.
- **Open snow wears soft drifts** (the `snow's pixels` banner, js/draw/ground.js): swells laid
  along the wind (`SNOW_ANG`), lit on the sun's side and shaded on the lee in four close tones
  (`SNOW_PAL`) under a Bayer dither, with a rare white glint on the lit tone. A low noise
  (`SNOW_REGION`, ~22 tiles a step, cut at `SNOW_CUT` into thirds of the map) lays out regions of
  three `SNOW_LOOKS` — fine drifts, broad swells, lee-only — blended across `SNOW_BLEND`. Every
  pixel is a function of its world position alone (the heights on a world-aligned 2 px lattice),
  so any repaint lays back exactly the snow the bake laid, a lake-shore tile reads the same
  lattice, and nothing rolls. Kept subtle on purpose: the lee tone stays well above a cast
  shadow. The boot bake lays each row's snow in one strip (`snowStrip`) — `putImageData` per tile
  alone would cost it half a second.

### The ice shore

**A lake is a shape, not a run of tiles** (the `the ice shore` banner, js/draw/ground.js). The
tile grid still says where the ice is for every rule — slipping, cracking, fish, the maps — and
only the pixels wander: `iceAtPx(x, y)` blends the four tile centres round a pixel (1 for a
*lake* tile, ice or open hole, 0 for anything else) and pushes the blend across 0.5 with two
octaves of `vnoise`. Every style's noise stays under half a unit, so a tile whose 3x3 is all
lake is solid ice and one with no lake in its 3x3 is untouched snow, and only the band along an
edge pays for the per-pixel test (`paintIceTile` for an ice tile, `paintSnowShore` for the snow
beside one). The light comes from the top-left, as for [cast shadows](rendering.md#cast-shadows)
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
shore. Night's mirror follows the same edge ([the reflected sky](rendering.md#the-reflected-sky)).

## Map shapes

**The valley comes out from under the snow a different shape each winter** ([lore](lore.md)), and
`MAPS` (the `map types` group of [js/world.js](../../js/world.js)) is the shapes it comes out in.
One entry is one **interior**; the border forest and the two roost corners are every shape's
alike, because the road's gates, both nests and the crash rule are all measured off
`borderDepth` and nothing may move them.

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
read once in js/boot.js after `loadSettings()` and never again (and written back to `settings.mapType`, so the lobby's pick starts as the shape standing). Picking one in the lobby's map
pop-up (`pickMap`, [rendering.md](rendering.md#lobby)) only saves `settings.mapType` and the
lobby stays put; the pick is spent at LOCK IN, which is then a **page** the way a reroll is: it
comes back on `?seed=<this seed>&map=<the pick>` and goes straight to the eagle (`lockIn`,
js/boot.js's `softfall.drop`). Only a **solo** lobby may pick — a host reloading
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
  `fish` banner of js/wildlife.js) — FROZEN ISLES holds 75 fish where OPEN FIELD holds 30;
- **building** needs ground `0` or `3` as it always did, so on FROZEN ISLES a base stands on an
  island's shore, the road or a path, never on the lake.

## The paths

A shape that grows woods over the whole valley would else be a wall, so it lays **paths** with
them (the `the paths` group, [js/world.js](../../js/world.js)): packed earth about a pine wide,
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

`placeRocks()` (the `world` banner, js/world.js) runs at boot after `placeChests()` and stands
**every rock in the world in a band of open snow just out from the border forest**: 2–8 tiles
(`ROCK_BAND_MIN`/`ROCK_BAND_MAX`, walked 4-way) from the nearest **border** pine — one on
`borderDepth`'s side of the line, so a grown shape's inner woods draw no band of their own —
never touching a pine, never inside a camp's clearing (`r + 2`), `ROCK_SPACING` (3) apart,
`ROCK_COUNT` (120) of them. So the ore is out at the valley's rim and the middle stays open
ground; no camp stands a rock. A shape whose rim cannot hold them (FROZEN ISLES, whose rim is
lake) widens the band `ROCK_BAND_GROW` (8) tiles at a time, out to `ROCK_BAND_LIMIT` (40), so
they land as near the rim as that shape allows — there, that is mostly the road's verges by
the roosts.

genWorld's own rock passes — the interior scatter and a grown shape's top-up (`MAP_ROCKS`) —
still run and still roll: taking their `rng()` calls out would reshuffle every seed
([determinism](#determinism-and-noise)). `placeRocks` lifts every rock they stood first, then
places its own on a stream of its own, `mulberry32(SEED ^ 0x524f434b)` (`rkRng`), touching only
`objects`, so terrain stays bit-identical for an existing seed.

## Treasure chests

`placeChests()` (the `world` banner, js/world.js) runs at boot after
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
card rolled from `CHEST_ODDS` (those constants beside `placeChests`) and, `CHEST_TOOL` (0.75,
js/tools.js) of the time, a **top-tier** tool or bit through `dropLoot` — the one place the top
tier is found. The tile empties with
it, leaving a one-tile notch in the treeline where the cache was dug out. The sprite bakes in
[js/draw/ground.js](../../js/draw/ground.js) (`CHEST_SPR`, under the `the scenery bakes` banner) rather than
in the byte-fragile grid files under js/sprites/.

## The road

One straight lane down the map's whole diagonal, corner to corner and off both world edges — a
route that comes from beyond and goes on past us, not one that starts and ends here. Across the
open field it is about `ROAD_HW` (3.5) tiles either side of the centreline, a seven-tile lane with
room for a whole side and a wave to fight in; where it crosses each roost corner's treeline — the
**gate**, `roadSpan()`'s `u0`/`u1`, two pennant poles — it eases over `ROAD_GATE_BLEND` (2) u to
`ROAD_HW_WOOD` (2.5), a five-tile forest road with the pines closing in (`roadHW(u)`); and
`ROAD_LOG_IN` (10) u past each nest's junction a **felled trunk** lies across it (`log`, below):
the way on is blocked, and the road running on under it to the edge says the route does not end
here (the `the road` group of the `world` banner, js/world.js). Ground `3`, packed earth showing
through the snow with two ruts down its length: it **walks like snow** (only ice and holes are
special-cased in `updatePlayer`'s momentum block) but it is **not snow** — nothing digs into it
(`tryProne`, the hunter's burrow), nothing grows on it, a fish never counts it
as water (`fishWater`), and the footprint emitter leaves no prints on it. A building **does**
stand on it: `canPlaceAt` (js/structures.js) takes ground `0` and `3` alike.

**Its edge is ragged, never a tile staircase.** `roadEdgeAt(u, side)` wanders the half-width
along the lane on the position noise — a slow drift of ±`ROAD_RAG` (0.8) and a fine ripple, each
side its own — and `roadMainDist(fx, fy)` measures any point against that wandering edge (negative
inside; no ends). Both the ground array (`onRoad`, a tile's centre) and the ground bake (a pixel)
ask the same function, so what a tile *is* and what it *looks like* agree to within the verge.
**It never meets ice**: `genWorld`'s carve rules keep every pond and river `ROAD_ICE_KEEP` tiles
off its edge and taper a river to nothing on its way in (the tile world, above), and a
[shape](#map-shapes)'s lake reads the same keep-out, so the lane is dry from end to end on every
shape and the ice network lives further out on the map. The one water it meets is
[the creek](#the-creek), at the middle, and it crosses that on a bridge. A **path** is the one thing that crosses
ice ([the paths](#the-paths)).

**The nests sit beside it, not on it.** `roadNest(team)` picks each side's **junction** on the
centreline — at least `ROAD_NEST_IN` (8) u inward from its gate, walking further in (to
`ROAD_NEST_MAX`, 40) until the **nest**, `ROAD_NEST_OFF` (13) tiles off the centreline to the
bird's own right, is deep: `roadNestDeep` wants `CRASH_DEPTH` inside the treeline by the border's
measure (`forestDepth`) *and* inside the roost disc's arc, with `MIN_CRASH_TREES` round it
(boot.js's crash rule — the deepest, densest candidate stands in if none qualifies). RED (team 0)
flies down to the bottom-left and its right is the top-left side (`roadOffS < 0`); BLUE's is the
bottom-right — the two nests mirror through the map's centre like the camps. Pure reads, cached
per team; a seed's nests are where they always are. The bird lands there
([eagle drop](rendering.md#eagle-drop-mode-drop)) and its felling front cuts a **spur** from the
crater straight back to the junction, **paved behind it** into a track `SPUR_HW` (1.25) tiles
either side of its centreline — under `MERCH_GATE_GAP`, so the gate's stumps stay off it — and
registered in `spurs` (`addSpur(team, jx, jy, cx, cy, end)`: the junction, the unit direction
toward the crater, the length to the blast's rim, and `paved`, measured back from the crater end
as the front advances); the crater itself is a **pad** in the same registry (`addPad(team, cx, cy,
r)`, a disc of `BOOM_R`, paved whole the frame the bird lands — `eagleCrash`, boot.js), so the
roost, the spur and the road are one ground. `spurDist` answers 99 where a spur is not yet paved,
and `roadDist(fx, fy)` is the min of `roadMainDist` and every spur and pad, so the bake, both maps
and every `onRoad` read see one road system that grows exactly as the front passes. From the road,
then, the way to a bird is one straight sightline down its spur.

**Its furniture** is placed with it, off the same ragged edge (`mark` in `placeRoad`,
`ROAD_POLE_OUT` (0.9) tiles past it): two **`banner`** poles at each gate carrying a `team` (0 at
the bottom-left gate, 1 at the top-right — the practice gate's own flag object, which paints
its cloth in `TEAMS[skin(team)]`'s coat and both maps in that side's ink, and *fells* what stands
on its spot, since the gate stands in the treeline, but gives way to a rock or a bush); one
**`cairn`** on the centreline at the map's centre — stepped out along the lane to the
bridgehead when the centre falls on [the creek](#the-creek)'s deck — solid cover where the two
waves meet; and the
**`log`** across each forest end — `ROAD_LOG_HALF` (2) pieces either side of the centreline along
the cross-diagonal, five tiles touching corner to corner so nothing squeezes between them, each
carrying `seg` (0 the up-left end, 1 the trunk, 2 the down-right end), solid, and a pine on the
verge gives way to its ends. All inert to E (no `tool`). The shoulders are otherwise bare: a
lane's edge is not a thing to look at. Their pixels: `CAIRN_SPR` baked beside `CHEST_SPR` in
js/draw/ground.js and drawn in `render()`'s object pass; the pole is `drawBanner`; the trunk is
**ground** — `paintLog` under `paintGroundTile` bakes each piece flat (`LOG_COL`), and a tile
paints its four neighbours' pieces too, shifted, because the trunk is wider than the diagonal it
runs on and spills past a tile's corners.

`placeRoad()` runs at boot **after `placeCreek()` and `layPaths()`** (then `placeZips()`, `placeCamps()`,
`placeChests()` — js/boot.js), on pure reads —
`roadSpan()` scans the diagonal for the last wooded tile out from each corner by `borderDepth`,
exactly the rule `diagEnd` (boot.js) flies the eagles by, so the gates are where each line's
mouth is — and it rolls nothing, so it neither moves the shared `rng` stream nor differs run to
run. Whatever the interior grew across the band is overwritten: a rock or a bush on it is gone,
the pines of the woods it cuts through are felled (there is no ice to meet - see above) - but a
tile of the creek or a ford is left as it is, so the creek runs on under the lane (its deck is
already laid) and a path stops at the water.
`roadAlong`/`roadOffS`/`roadOff`/`roadPoint` are the geometry —
the diagonal is `tx + ty = WORLD - 1`, `u` running from the bottom-left corner, `roadOffS` signed
toward the bottom-right side — taking a tile index or a continuous tile coordinate alike;
`onRoad(tx, ty)` is the membership test, and `roadWaypoints(team)` the centreline every
`ROAD_STEP` (20) tiles from a side's own junction to the rival's, which is the march the waves
walk ([Soldiers](gameplay.md#soldiers-the-waves)). Not under `PRACTICE` (`roadMainDist` answers
99 and no spur is ever registered).

Both maps paint it: a tan stroke on the minimap, a brown ink line down the parchment
(`updateMinimap`, `buildWorldMapImg`) — from the ground array, so a paved spur appears on both as
it is laid. In the world it is **painted over the snow per pixel**, not per tile:
`paintGroundTile` paints every road tile, and every snow tile within `ROAD_SHOULDER` (1.4) + 1.2
tiles of the edge, as snow first and then hands it to `paintRoadOverlay` (the `the road's pixels`
group, js/draw/ground.js), which asks `roadDist` per pixel — inside, packed earth in two tones by 8 px
quad, the two ruts at `ROAD_RUT` (1.0) tiles off the *diagonal's* centreline (broken, wandering a
little along the lane on a per-quarter-tile cached noise — a spur, measured off the same line, is
too far off it to carry them), the odd stone and hoof-dark spot, and drifts of snow lying over the
last 0.7 tiles of the verge; outside, mud spread off the road in patches thinning to greyed snow
and then the field. The drifts and the mud are placed on a low-frequency `clump` noise read per
pixel, not on a per-pixel roll, so the melt reads as patches rather than sand. The whole bake
costs ~0.2 s at boot on top of the ground's own; a spur's paving repaints three tiles round each
tile it lays, a few tiles a frame for the seconds the front takes.

## The creek

**One creek that never freezes runs the whole map, world edge to world edge, down the
cross-diagonal** (`tx = ty`, the top-left corner to the bottom-right — the road's opposite), the
`the creek` group of [js/world.js](../../js/world.js). It cuts the valley into RED's half and
BLUE's with a roost on each side, meets the road once, at the middle where the waves meet, and
comes from beyond and goes on past us like the road: through the border woods too, where the
pines stand to the water's edge and there is no bank to walk along. Look A of
`docs/media/concepts/creek-concepts-1.png` (SNOWBANK CUT) and, for the bridge, look A of
`bridge-concepts-1.png` (PLANK DECK).

**It is open water**, ground `4`: to every walker but a player a wall (`moveEntity`), to every
route a gap (`walkable`), and nothing spawns, lands or climbs out onto it (`waterAt`). A player
who steps in **plunges exactly as into an ice hole** ([falling in](#ice-holes-and-fishing)) — but
a roll does not carry over it (two tiles of current, where a hole is one), and the scramble out is
onto the bank they went in from: `nearestDryTile` keeps to the same side of the water (creekAt's
`n`). A bot never wades in on its own feet — its walk is strict unless a shove past `WADE_SHOVE`
(sim.js) is carrying it — so the creek punishes a bot the way it punishes a player: by being
pushed off the bridge. The death line is `WENT IN THE CREEK`.

**The ways over**, all of them ground that walks like snow:

- **the bridge** — the road crosses on a timber deck the lane's width (`BRIDGE_W` either side of
  the centreline along the creek, `BRIDGE_L` either side of the creek's line along the road),
  ground `3`, so to every rule it is road (the waves march over it, a building may stand on it).
  Its sides are open: shoved off one, you are in the water;
- **the islands** — the two camps on the mirror line, the DIRE HOLLOW and the ALPHA STONE, stand on
  islands the creek parts round and joins again below: a ring of water `r + PATH_CAMP +
  CREEK_ISLE + CREEK_HW` from the camp's centre, its dry ground cleared of scenery, and a **ford**
  from each half where the ring runs along the diagonal level with the camp — so both are still
  contested from both sides;
- **an outer ford** (`creekOuterFords`) on each stretch between an island and the treeline, at
  its middle, where the stretch is `CREEK_FORD_GAP` or more;
- **a path's ford** wherever a grown shape's path crosses ([the paths](#the-paths)).

A **ford** (`creekFord`) is the whole run of water along one tile row through its point, made
ground `5` — a row, so it is always four-connected and nobody's feet cut a corner through the
current — with any pine on the tile past either end felled, so a ford never ends in a wall. On
OPEN FIELD a seed has six: two per island and the two outer ones.

**Geometry**, in tiles, off the road's own frame: `w` along the creek is `roadOffS` (+ downstream,
toward the bottom-right) and `p` across it is `creekP` (+ toward the top-right, BLUE's half).
The line wanders `CREEK_WANDER` off the diagonal on the position noise (`creekMid`) and each bank
`CREEK_HW_RAG` off `CREEK_HW` (`creekHW`); `creekCalm` eases both to nothing within
`CREEK_CALM` of the bridge, an island and an outer ford, so the water meets each square.
`creekAt(fx, fy)` is the signed distance to the nearer bank (negative in the water) and leaves
where the point is in `CQ` — along (`a`), across (`n`) and which island's ring (`isle`, -1 for
the line) — `creekFlow` the way the current runs there, `bridgeAt` the deck, and `creekWet` the
plunge test: in the water as drawn and off the deck, so nobody goes in off a pixel of bank or off
the deck's overhang. The ground array (a tile's centre) and the bake (a pixel) ask the same
functions, so they agree to within the bank, as the road's do.

`placeCreek()` runs at boot **right after `genWorld()`**, before the paths and the road: the
water fells whatever grew on it, the deck is laid bank to bank, each island is cleared, and the
fixed fords go down. Pure position noise — nothing rolls, so no seed reshuffles — but it writes
`ground` after genWorld, so every seed's ground hash includes it
([determinism](#determinism-and-noise)). Not under `PRACTICE`. `DBG` exposes `creekAt`,
`creekFlow`, `creekWet`, `bridgeAt`, `creekIsles`, `creekOuterFords`, `waterAt` and `CQ`.

**Its pixels** (the `the creek's pixels` group, js/draw/ground.js): `paintGroundTile` hands every
tile `creekNear` to `paintCreek`, which paints per pixel over whatever the tile is — dark water
deepening toward the middle, the bank the light comes over (read off the slope of `creekAt`, so
the island rings read like the straight run) wearing a white lip and throwing a band of shade on
the water, the far bank its pale face, still streaks stretched along the current, the plank deck
(planks on the pixel diagonals, a stringer down each open side, snow drifted to the edges, a post
at each corner, three pilings upstream) with the water coming out from under it in shade, and a
ford tile's snow-capped stone (`paintFordStone`) with foam heaped on its upstream side. Both maps
ink the creek as open water and its fords as gaps. `drawCreekFlow`, right after the ground blit,
drifts a couple of glints per tile of open creek downstream every frame on the field's clock
(`windT`), so `DBG.step` and the wire's echo reproduce it.

Verified on seeds 42, 7 and 1234 across the shapes: every ford runs bank to bank with open ground
at both ends; the two junctions reach each other and every camp from both halves; a route across
the water only ever steps on the deck or a ford; three minutes of bots and waves put nobody in the
creek on their own feet, while a shove off the deck dunks a bot.

## Snow depth

One map of how deep the snow lies, `snowDepth(fx, fy)` (tile space, 0..1; `snowDepthPx` for
world px), in [js/depth.js](../../js/depth.js). It is static for the match and a pure function
of the seed and the scenery worldgen stood up (`hash2`/`vnoise`, **no `rng()`**), so every
client lays the same map and no seed's world moves. Anything that cares how deep the snow is
asks it; its bands:

- **DEEP** (`>= DEPTH_DEEP`, 0.6) is gameplay: `deepAt(x, y)` is true there on open snow
  (ground 0) only, so a runtime paving or a hole takes it away. It slows every walker
  ([Deep snow](gameplay.md#deep-snow)) and is drawn raised (`deepTone`, below).
- **MID** (`DEPTH_MID` 0.25 up to deep) is a drift you see and do not wade: a drift's skirt
  round its core, and the whole of a small drift whose `amp` never reaches deep.
- **Shallow** is the rest, down to a dusting in the hollows (`hollowDepth`, low on the
  position noise, capped at `DRIFT_HOLLOW` 0.2, so a hollow is never a drift). The field says
  nothing about the ground under it, so it reads over ice too.

The depth is the tallest **drift** at a point (`drifts`, indexed per tile in `driftCell`),
over the hollows. `layDrifts()` runs at boot once every worldgen pass has stood its scenery up
(after `placeRocks`, before `renderGround`; under `PRACTICE` it lays none):

- **The wind.** `driftWind` is the seed's prevailing wind, within `DRIFT_WIND_ARC` of the
  creek's line and either way along it, so the upwind treeline is one the creek cuts in two.
- **Where.** Every wind-breaker (`driftBreak`: anything solid worldgen stood - pine, snag,
  rock, chest, den, hut - and the berry bushes, which trap snow like a hedge) with open snow
  in its lee is a candidate, scored by how many breakers stand in the half-disc upwind of it,
  so the treeline and a stand beat a lone rock. A low noise over the valley keeps only some
  regions, so drifts come in groups with open lanes between them.
- **Shape.** A drift (`driftDepth`) has a rounded crest against its breaker and a tail
  tapering downwind, bent a little and with an edge wandering on a pre-sampled noise (`rag`);
  depth falls off across it as 1 - q², so its deep core is the inner part of a wider skirt.
  Length follows the open run in its lee (a rock or a bush may be buried, a pine stops it) and
  size follows shelter.
- **Keep-outs** (`driftFree`): the road and paths (`DRIFT_KEEP_ROAD`), the centre clearing,
  both roost corners' woods (`ROOST_R + DRIFT_KEEP_ROOST`), every camp's clearing
  (`DRIFT_KEEP_CAMP`), and anything within `DRIFT_KEEP_WET` of ice, a hole, the creek or a
  ford. A drift whose skirt runs into one is shortened and narrowed, never cut.
- **Spacing and share.** Crests stand `DRIFT_HEAD` apart, deep cores `DRIFT_GAP`; drifts are
  taken best first until the deep band covers `DEEP_COVER` of the interior's open snow or the
  candidates run out (OPEN FIELD and THICKET land near 3-4.5%: there is only so much shelter).
  **Fair shares:** neither side's half of the valley (split on the creek's line) keeps more
  than `DRIFT_FAIR` times the other's deep snow; the richer half gives up its weakest drifts.
  FROZEN ISLES grows none on the seeds checked, its snow being all lake shore.

The deep band's pixels are baked into the ground: `snowTile` (js/draw/ground.js) hands every
pixel of a tile with a `driftCell` entry to `deepTone` (js/draw/depth.js), which reads the same
`driftsDepth` the sim does - a white crest and a thin outline on the sunlit edge, a smooth bright
top with faint wind ripples, a two-pixel dark lip where it faces away, and a shade thrown
down-right, longest at the tall crest. Its colours are `DEEP_PAL`, appended to `SNOW_INK`.

## The zipline

One cable per team along the road, the `zipline` banner of [js/world.js](../../js/world.js): a
polyline of **pylon** points `zips[team] = { team, pts, cum, len }` (`pts` are body positions —
a rider's `p.y + 4` sits on the pylon tile's centre — `cum` the px along at each point) laid by
`placeZips()` at boot **right after `placeRoad()`**, on pure reads (`roadNest`, `roadSpan`,
`roadEdgeAt`, `findCrashPoint`, `objAt`): nothing rolls, so `genWorld` and every seed's ground are
untouched. Not under `PRACTICE`. The points, base to front:

1. the **base pylon**, `ZIP_BASE_OUT` (7.5) tiles from the crater along the spur's axis (the crash
   point by the crash's own rule, `findCrashPoint`) and `ZIP_SPUR_OFF` (1.9) tiles off that axis
   toward the front — outside the outer stump ring and the merchant's wall ring, so the ring closes
   under the cable, and over `SPUR_HW` so the track is never blocked;
2. the **verge pylon** where the spur meets the road, `ZIP_SPUR_OFF` along the road from the
   junction and `roadEdgeAt(u, side) + ZIP_OUT` (0.6) tiles off the centreline on the bird's own
   right (`roadNest(team).side` — the two cables sit on opposite verges and mirror through the
   centre like the nests and camps);
3. a pylon every `ZIP_SPAN` (10) u along the same verge to the **terminus** at `ZIP_MID_GAP`
   (20) u short of the centre cairn — a stub of a span at the end joins the one before it — so the
   middle stretch where the waves meet is cable-free.

A pylon's tile is the nearest along the road (u, u±1, u±2) that is dry and holds nothing but
worldgen's scenery — a pine or a rock gives way, like the road's poles (`laneFells`); anything
else refuses, and the point stands whether or not a pylon does. It is an `OBJECTS` entry
(`pylon`: solid, inert to E, carrying its `team`; `mm` grey), so `isSolidTile`, `canPlaceAt` and
both maps handle it for free. Its pixels are `PYLON_SPRS` (one bake per team skin) and the cable
pass `drawZips` in [js/draw/zipline.js](../../js/draw/zipline.js); both maps stroke each line in
its side's ink. Seed 42: RED's line runs u 35→91, BLUE's 131→196.

`zipPoint(z, d)` is the cable at `d` px along (position, unit tangent, span and how far across
it), `zipLift(z, d)` how high it hangs there (`ZIP_H` 31 at a pylon, `ZIP_SAG` 3 less mid-span),
`zipNearest(z, x, y)` the nearest point of a line to a spot, and `zipNear(p)` the line a body may
clip on — its own team's, within `ZIP_GRAB` (32, two tiles) px of the track — or null:
**team-locked**, a rival under your cable is a walker. `zipUnder(team, wx, wy)` is the same
question for a world point against the cable **as drawn** — the point dropped to the track by
the lift where it lands (once for the span, once more with that span's sag), within `ZIP_HOVER`
(6) px — which the pointer's hover and the click scheme's press ask. The ride itself:
[the zipline](gameplay.md#the-zipline).

## Camps

The jungle: named places at **fixed, mirrored sites** where neutral monsters stand — the things
a team is choosing between while the eagle is still in the air, and the places it walks out of
its base for. They live in the `camps` banner of [world.js](../../js/world.js) and in the
module-scope `camps` array (`{ key, spec, name, tag, tx, ty, r, repopT }` per placed site).
Four kinds, one reward each:

- **WOLF DEN** (`resource`, r 5, ×4) — a `den` in an open clearing and a pack of 4
  wolves. Gold per head (`YIELD.wolf`), the biggest steady payout on the map. Back 60 s after
  the last one dies.
- **ALPHA STONE** (`buff`, r 4, ×1) — a `cairn` and one **alpha**. The kill
  wears **ALPHA'S BLOOD** for 90 s ([camp monsters](gameplay.md#camp-monsters-neutral-until-hit)).
  Back in 120 s.
- **DIRE HOLLOW** (`epic`, r 6, ×1) — a `den` in a ring of seven `deadTree` snags, and the
  **dire wolf**: a 2× body with a wall of hp. The kill pays the killer
  `YIELD.dire` and **every teammate** `EPIC_TEAM_GOLD`, bloods the whole team for 120 s, and
  writes the feed. Back in 300 s.
- **HOG HUT** (`hut`, r 4, ×6) — no monster: a log hut (`hut`, a 2×2
  footprint; `SPRITES.hogHut`, eight frames of chimney smoke) with **three chests** round it, in
  a clearing buried in the **border forest** (`woods`). No path leads there: it is reached with
  an axe, and the chests are why that is worth doing. They are ordinary
  [chests](#treasure-chests) and never come back; `pop` 0 means nothing restocks and the anchor
  wears no clock.

**One entry in `CAMPS` is one kind of camp**, and that entry plus its site is the whole feature —
no map, chart or HUD code knows a camp by name:

| Field | Meaning |
| --- | --- |
| `name` | printed by the minimap (glyph only), the M map and the arrival toast |
| `tag` | the one-line personality under the name on the toast (`THE PACK PAYS IN GOLD`) |
| `r` | footprint radius in tiles: the clearing, the props, and the radius `campAt()` calls "here" |
| `mark` | map ink for its glyph and its toast rule |
| `icon` | the glyph itself: `[x, y, w, h]` rects inside a 7×7 box, stamped by `drawCampIcon()` with a dark rim pass so it reads on parchment, snow and forest alike |
| `kind` / `pop` | the monster kind (`MONSTER`, wildlife.js) and how many the camp holds (`a.home === C` is the backref) |
| `repop` | seconds after the **last** one dies before the whole camp is back — a camp is cleared or it is not; nothing trickles |
| `props` | what stands in it: `[dx, dy, type, variant]` off the centre, stamped in worldgen **before** `renderGround()` bakes; the prop at `0, 0` is the anchor and carries `site` |
| `spots` | where each monster stands, `[dx, dy]` off the centre (`spawnCampMonster` takes the nearest free tile if a slot is taken) |
| `woods` | the site is **in the border forest**, not the valley: `placeCamps` checks it is, `layPaths` cuts no branch to it and `placeChests` keeps off its rim |

### Placement

**Nothing rolls.** `CAMP_SITES` writes each site once, for the RED half of the map, in
[the road](#the-road)'s own coordinates — `u` tiles along the diagonal from RED's corner, `s`
tiles off the centreline (+ toward the bottom-right half) — and `campSites()` mirrors every
entry across the map's middle (`u → WORLD − 1 − u`, same `s`) for BLUE, so **both teams walk the
same distance to the same camp**. A site *on* the middle (`u = (WORLD − 1) / 2`) is its own
mirror and is placed once: the alpha and the epic are contested at equal reach from either roost.
**Three camps a side of the road, six in all**: a mirrored pair of dens on each side, finished
by one midline camp — the dire hollow top-left, the alpha stone bottom-right, facing it across
the road. A mirrored pair always lands on one side (the mirror keeps `s`), so a side can only
grow by a pair or by a midline site. The six **hog huts** stand apart from that count, out in the
border woods: two mirrored pairs by the far corners and one halfway along an edge. `campTile(u,
s)` is the conversion back to a tile. The layout as shipped:

| Camp | RED-half site (u, s) | Tiles | Mirror |
| --- | --- | --- | --- |
| WOLF DEN | 90, −25 | 72, 123 | 123, 72 |
| WOLF DEN | 90, +25 | 108, 159 | 159, 108 |
| ALPHA STONE | 115.5, +44 | 147, 147 | — |
| DIRE HOLLOW | 115.5, −40 | 87, 87 | — |
| HOG HUT | 100.5, −114 | 20, 50 | 50, 20 |
| HOG HUT | 100.5, +114 | 181, 211 | 211, 181 |
| HOG HUT | 63, −61 | 20, 125 | 125, 20 |

The huts are 20 tiles in from the world's edge: the two far corners (top-left and bottom-right)
hold one of each side's, and each side has one more halfway along an edge of its own half.

The two midline sites sit on the cross-diagonal, which is [the creek](#the-creek)'s line: each
stands on an island the creek parts round, with a ford to it from either half.

`placeCamps()` runs as worldgen's last ground pass (boot: after `placeRoad()` and `placeZips()`,
before `placeChests()`), then
`stockCamps()` fills every camp once `spawnAnimals`/`spawnFish` are done (and tops one up to
strength, never past it, when `DBG` calls it by hand). Every site sits at least `CAMP_EDGE`
(72) tiles from the world's edge — past the deepest treeline the border noise grows
(`BORDER_MAX`, 70) — and `placeCamps` throws if one does not, so a site can never be moved into
the woods by accident. A `woods` camp is the rule turned round: its whole clearing (`r + 2`) must
end inside `BORDER_MIN` (30), the shallowest treeline any seed grows, so it is buried in pines on
every seed (and stays `r + 4` off the edge itself). Terrain still comes from the seed: **`clearCamp()` clears everything
inside `r + 2` of the centre** — a pine, a rock, a bush goes, ice becomes snow — so a camp is the
same clearing on every seed, and the props then stamp the same on every seed. (A camp on a
seed's forest bay is therefore a clearing cut into its edge, and a river running under one
gets a snow bridge.) The clearing is the one pass that writes `ground` after `genWorld`
([determinism](#determinism-and-noise)), and nothing in a camp draws a random number.

### Runtime

**A camp is neutral until hit.** No sight, no bar filling while you linger: you can walk
through a den and nothing happens. A hit wakes the whole camp on the hitter, the camp leashes
when the hitter leaves its ground and heals — the rules are in
[gameplay.md](gameplay.md#camp-monsters-neutral-until-hit). `campAt(x, y)` returns the camp a
world position stands in; `updatePlay` feeds it `state.loc` (`{ L, t }`), which drives the
arrival toast in [rendering.md](rendering.md#camps-on-the-maps).

`updateCamps(dt)` (from `updatePlay`) runs each camp's respawn clock (`C.repopT`), kept honest
enough to be shown: a camp with anything alive in it holds the clock at `repop` — a half-killed
pack never trickles back; cleared, it counts down; and due, it **holds at zero** for as long as
any player is within `CAMP_HOLD` (96 px) — clearing a camp is a real reward for a while and it
still grows back, the moment the intruder leaves — then every slot is refilled at once. **The
anchor prop wears the clock**: `drawCampClock` (js/draw/marks.js) draws the neutral unit bar over
a hovered den mouth or alpha stone, the picked bush's own read
([rendering.md](rendering.md#render-pass-order)), filling toward the camp's return while it is
empty and nothing at all while anything in it lives; a full bar holding is a camp that is due
and waiting for you to go.

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

The TRAINING FIELD behind the title's PRACTICE TOOL plank (three knocks break its ice —
[rendering.md](rendering.md#main-menu-title)): `?practice=1` boots `genPracticeWorld()` (the
`practice arena` banner, js/world.js) **instead of** `genWorld()`, and js/boot.js skips
camps, chests, wildlife spawns and the eagle drop entirely. **The practice world itself is
small — `WORLD` is 76 under `PRACTICE`, against the match's 232** (the conditional above the
`WORLD` const, js/core.js; everything downstream sizes itself off `WORLD`, so the match world is
untouched). The **clock never runs**: js/boot.js pins `state.time` to early morning and sim.js
never advances it under `PRACTICE` — crisp daylight forever, no dusk, no dawn refreeze. The
**cloud shadows are skipped there too** for the same reason the clock is pinned: a shadow drifting
over the dummy's meter or the parkour's ice would change what those instruments measure between
one lap and the next. The sun shafts stay ([rendering.md](rendering.md#light-and-weather)).

The arena is one open **40×23-tile snowfield** (`PR_W`/`PR_H`) cut to pure combat. What stands
in it:

- a single **dummy** in the open snow in the middle, the spawn (`PR_SPAWN`) just south of it;
- the two-tile bow **rack** east of the dummy on its own row, and the **range bell** west of it
  as the rack's mirror, each five tiles out;
- the **archery targets** riding a two-rail track around the field's whole perimeter (below).

No fences, no wildlife, no chests, no pond, no harvest, and nothing spawns or restocks outside
a round. `PRACTICE` (js/core.js) pins `SEED` to `PRACTICE_SEED` *above* the `?seed` parse, so
the field is bit-identical on every visit and no seed can reshape it.

**The rack is the armory.** It is a `lead` on the left tile and a solid silent follower on the
right; a two-tile pair can only centre on a tile boundary, so the lead carries `dx: -8` and the
sprite, brackets and prompt all draw nudged 8 px left (`RACK_SPR` is baked per-pixel in
js/draw/practice.js). Standing within E's own reach (`rackNear`) raises an `E ARM` key-cap over
it (`drawRackHint`, js/ui/wheel.js — proximity, not hover); **holding E opens a radial wheel** of
every tool in the game (`state.wheel` kind `'rack'`, the ordinary wheel pipeline), the pointer
picks, and **releasing E takes** (a real work target in reach keeps E's day job, the same rule
that decides which prompt shows). The pick lands in `rackEquip` (`PRACTICE`-gated, the practice
banner): the selected slot is replaced with a fresh instance of the picked tool, a plain arrow
seated so it fires the moment it is taken.

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
match's shoal is **off entirely under `PRACTICE`** (js/wildlife.js), because the only ice in the
world is the race line and a fish emerging into it would be absurd; `crackIce` still works on
the track (a hole in the racing line is the player's own doing, and re-entering rebuilds —
and a reroll unregisters the old track's cracks and holes before the forest regrows).

**The roll station is one die and one held wheel**: the die on its plinth stands in a small
felled nook off the walk's south side, adjacent to the walk so its `E ROLL` cap rises as you
pass (`pkdie`, `PK_DIE` — `pkDieNear` resolves it, shared by the prompt, `drawPkHint` in
js/ui/wheel.js, and the press in js/input.js). **Holding E beside it opens a three-wedge radial
wheel** (kind `'pkdie'`, the armory rack's own hold-and-release grammar and the ordinary wheel
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
(`shotContacts`, js/sim.js) meets every live face disc (`ptFace`/`ptLive`/`ptHitR` — the hit disc
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

**Every arrow into a face also extends a consecutive-hit run** (`agStreak`),
minigame or not: the hit popup carries it from the second hit on (`X3` alone in free practice —
white, gold from five, hot orange from ten — appended to the points during a round), any
practice arrow that ends without striking a face breaks it (the arrow loop, js/sim.js — the
dummy counts as a break: the run is a *target* run), and ringing a round in starts it over.
**The run is audible**: every `AG_RUN_STEP` (5) in a row flares at the face AND rings
`SFX.runUp(agStreak)` - the one cue in the game deliberately PITCHED by a number, because the
number is the thing being climbed - and losing a run that long plays `SFX.runBroke`. One
`AG_RUN_STEP` for the flare and both cues, or they disagree about what a milestone is.

**The archery round** hangs off the **bell** (`agbell`, `AG_BELL`) west of the dummy: standing
within E's reach (`agBellNear`) raises an `E RING` cap (`drawBellHint`, js/ui/wheel.js), and **holding E
opens a three-wedge radial wheel** (kind `'agbell'`, the roll die's own hold-and-release
grammar and the ordinary wheel pipeline) — one wedge per difficulty, each drawn as **the target
face the round pours out, smaller as the pick gets harder**, the armed one wearing a gold frame
(the bell itself never wears the difficulty — no recolour, the wheel's frame is the readout).

Releasing on a wedge IS the ring (`agRing`, through the same `input.cmd` → `runCmd` path every
order takes) and runs the show (`agame.phase`, ticked by `agUpdate` from `updatePractice`): the
stock roster bursts away and **the dummy, the rack and the bell itself sink under the snow**
(`agSinkU` crops their sprites in js/draw/render.js; at full depth their objects leave the grid
entirely, so nothing blocks a shot — which is also why a running round cannot be rung off, and
`agEndRound` puts the same instances back), a **3-2-1 countdown** lands (a second per tick on
`SFX.countTick`, the class screen's own cue) in the eagle drop's
big-number language, and for `AG_T` seconds **random targets pour onto the track from the
picked difficulty's spawn table** (`AG_DIFF`: the three mover speeds, the small/still/pop odds,
the crowd cap and its refill pace — easy is slow, large and sparse, hard fast, small and
crowded) — each worth points on the harder-shot-pays-more rule (base 10; small, pop-up and
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

Practice is not a match, and everything with stakes is guarded on `PRACTICE`: the local player is
the only active one (js/boot.js parks the other nine as `control: 'none'` in the corner
forest), `die()` becomes `practiceRevive()` (full pool, spawn tile `PR_SPAWN`, a beat of
grace), `checkLastStanding()` never fires, and the profile is never written — `gainGold` skips
`PROFILE.addGold` and the pinned clock means `addDay` can never fire — with two deliberate
exceptions: a record parkour lap (`PROFILE.setBestLap`) and a record archery round
(`PROFILE.setBestRange`, both above). The way out is the ESC
slab's LEAVE PRACTICE plank ([settings](gameplay.md#settings)).

The **dummy** is an `OBJECTS` entry (`solid`, any tool, verb HIT) with one solid tile and a
26×42 sprite (`DUMMY_SPR`, baked in js/draw/practice.js). Every way of hurting it
lands in `hitDummy` (js/actions.js): the E swing (`DUMMY_WORK_DMG`), every bit — the arrow loop
tests the dummy across its base tile and the two above it, so torso and head shots land — and
the roll's tackle. It never breaks: the pool floors at zero, the overhead bar appears only
while it is hurt, and `updatePractice` (called from `updatePlay` under `PRACTICE`) mends it
back to `DUMMY_HP` after `DUMMY_RESET_T` seconds unhit, with a shimmer for the announcement.
`updatePractice` is also the grounds' clock: it ticks every target's habit, rail roll and
respawn, runs the archery round (`agUpdate`), and times the parkour laps.

Over the dummy's head hangs its **damage meter** — LAST HIT / DPS / TOTAL for the combo in
progress (an instrument, CLAUDE.md's carve-out). `hitDummy` keeps the ledger (`mLast`/`mTotal`/`mT0`/`mT1` on the object; a
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
  before that line runs. Everything that does — `genWorld`, `renderGround`, the panel bakes — is
  further down in boot order.

## Day/night

`DAY_LEN = 110`, `NIGHT_LEN = 55`, so a full `CYCLE` is 165 s. `state.time` runs within the cycle,
`state.day` increments at wrap. Each wrap (and the landing, for DAY 1) raises the **day headline**
— `state.dayPop`, a ~3.5 s fade of bare `DAY N` at 2×, top centre (drawn in `renderUI`, js/ui/compose.js) —
because days are the calendar a survival strategy is timed against, so a new one headlines
rather than riding the bottom message line.
`update()` derives `state.darkness` (0→1) from a hand-written
ramp: dusk over the last 12 s of day, full dark, then a 10 s dawn.

Night is a **colour**, not a darkness — a blue multiply over the finished frame with the
stars reflected in the ice under it, and nothing to carry a lamp for
([rendering.md](rendering.md#light-and-weather)) — and no sim rule sharpens at night: nothing
in wildlife or the AI reads `state.darkness`. What keys off the cycle:

- The only passive heal, slow HP regen in `updatePlayer()` for every player, runs while
  `state.darkness < 0.3` — or at any hour under a kit with `nightHeal` (the HEARTHWEAVE gear,
  js/player.js). There is no cold/warmth system.
- **The wind dies with the light.** `windAmp()` squares `1 - darkness`, so the snow stops blowing
  sideways and every pine goes still over the twelve seconds of dusk and stays still until dawn
  ([the wind field](rendering.md#the-wind-field)).
- The **sun shafts** are not on the darkness curve at all: they are up for the eagle drop and for
  about fifteen seconds around noon, and dark otherwise
  ([god rays](rendering.md#light-and-weather)). The **cloud shadows** fade out on it, and the **ice** darkens
  into a mirror on it with the **reflected stars** coming up inside that
  ([the reflected sky](rendering.md#the-reflected-sky)) - so a frozen lake reads darker than the
  snow around it after dusk, and an ice hole is a hole in the reflection.
- Carved ice holes refreeze at dawn and cracks heal — **unless a fish net stands on the hole**,
  which is what holds that water open. The shoal is not topped up at dawn; it refills
  continuously. See [Ice holes and fishing](#ice-holes-and-fishing).

`state.day` drives no difficulty. What damages a player: another player's arrows, a
plunge through the ice (see [PvP](multiplayer.md#pvp)), and the wolves of a
[wolf den](#camps).

## Ice holes and fishing

**E over a bare ice tile** (no object) brings out the pickaxe and calls `crackIce(tx, ty)` on
that tile (see [The swing tools](gameplay.md#the-swing-tools-e); the weapons:
[Tools and bits](gameplay.md#tools-and-bits)). Hits accumulate in the
`iceCracks` map (`tile idx → hits`, rendered as bright fracture decals in their own pass);
`ICE_HOLE_HITS` (2) breaks through — the tile becomes `ground = 2` (open water), joins the
`holes` list, and is repainted into the ground canvas via `repaintGround()`. Constants live in the `fish` banner of
[js/wildlife.js](../../js/wildlife.js) (`ICE_HOLE_HITS`, `HOLE_FALL_DMG`, `HOLE_FALL_T`,
`FISH_MAX`/`FISH_MIN`/`FISH_WATER_REF`/`FISH_CAP_MUL`, `FISH_CATCH_R`; `FISH_SPAWN_T` alone stays in core.js, and the `NET_*` set
sits beside `STRUCTS` in [js/structures.js](../../js/structures.js) with the net entry it tunes).

- **Falling in**: standing over a hole tile (checked at each player's feet in `updatePlayer`,
  js/sim.js) plunges that player: `HOLE_FALL_DMG` (15) via `damagePlayer`, velocity zeroed, and
  `p.fallT` runs `HOLE_FALL_T` (1.1 s) of floundering — no movement, tools, dodge, or
  slide (`clickAction`, `tryWork`, and `tryDodge` all check `fallT`). `drawPlayer` clips
  the sprite to the waterline with ripple rects. The climb-out teleports to
  `nearestDryTile()` with brief i-frames. [The creek](#the-creek) plunges the same way, off the same check (`creekWet` on a ground-`4`
  tile), with the death line `WENT IN THE CREEK`. An **active dodge roll crosses holes safely**
  (a hole, not the creek)
  (the fall check skips while `dodgeT > 0`). Every player falls in; `die(p)` and `Player.reset()`
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
  nose or tail for a frame or two, at the 0.4 alpha an under-ice fish is drawn with — accepted.
  They render as translucent silhouettes
  through the ice — brighter and surfaced inside an open hole — in a pass right after the
  ground blit (using `ex`/`ey`). Cracking ice spooks nearby fish into a fast dart.
- **Fishing is automatic**: `autoFish(p, dt)` (js/tools.js, called from `updatePlayer` every
  step) checks whether that player stands on an ice tile with a fish within `FISH_CATCH_R`
  (16 px); if so the fish is taken with no press — once per `FISH_AUTO_CD` (1.2 s), spending no
  tool cycle — into the `p.food` pouch, splash, no arrow, and the press on the ice
  flies like any other ([the swing tools](gameplay.md#the-swing-tools-e)). The catch is
  [contested](multiplayer.md#contested-orders), so two players can't land the same fish. **The catch is a pose**: the contest's
  callback calls `startCatch(p)` (below `autoFish` in js/tools.js), `CATCH_T` (2 s) of three
  down-facing frames whatever the body faced - `CATCH_STOOP` (0.16 s) bent to the hole,
  `CATCH_HAUL` (0.22 s) with the fish coming up, then the trophy hoist over the head
  (`catchFrame(p)` says which; `drawPlayer` draws it, the held tool and gear marks off, the
  overhead stack lifted 4 px for the hoist). It is shown only by a body standing still anyway:
  a step, any other intent (a fresh press, a roll, a cast, a swing, a meal) and a hit
  through `damagePlayer` end it at once via `cancelCatch` — an automatic catch may never cost
  the player a frame of control. A net's first fish is hoisted
  the same way from `updateStructures`. The frames:
  [sprites](sprites.md). `DBG.startCatch`/`cancelCatch`/`catchFrame` stage it. Hovering a fish (`hoverFish()`, a 7 px disc) switches the
  cursor to the water-blue **fish** reticle and `drawFishHint()` (overlay pass, after the E
  prompt) frames it with the same pulsing brackets stumps get — white when `fishInRange()`
  holds, dimmed blue-grey outside it, and no verb: the mechanic is proximity, not aim, and the
  brackets' brightness is the whole of that hint. Fish are food: **F** eats one for +50 HP over a 1.5 s channel a
  hit can break (`eatFish`, mirroring the berry's Q/+20; both meals share one 3 s clock - see
  [Food](gameplay.md#food-the-meal-is-a-channel)), counted beside the berries on the backpack strip
  (`SPRITES.itemFish`, 8×8, own `FIPAL`). `SFX.splash()` is the water cue. `DBG`
  exposes `fish`, `iceCracks`, `holes`, `crackIce`, `addFish`, `spawnEmerger`, `netAt`,
  `buildSiteAt`.

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
| drawn flat, under everything, never y-sorted | `drawNet` in the flat pass — see [rendering](rendering.md#render-pass-order) |

The net is the [build list](gameplay.md#base-building)'s last row: its ghost is white over a bare
hole and red anywhere else, the same `canPlaceAt` read as every other piece. A pad's build wheel
over a hole offers the net alone, and nothing is special-cased for a one-option wheel:
`wheelSpan(1)` is the full circle, so any direction out of the hub picks the net and the hub
still cancels.

A finished net runs two clocks in `updateStructures`' `net` branch:

- **Catching.** Any `born` fish within `NET_R` (9 px) of the tile centre is spliced out of `fish`
  and becomes `o.fish`, capped at `NET_CAP` (3), one every `NET_CATCH_T` (2.2 s) so a net fills
  visibly instead of hoovering the pond. Fish are *drawn into* it: `nearestNet` gives every born
  fish a gentle lean toward any net inside `NET_LURE` (44 px) that still has room — that lure is
  what makes a net read as working rather than waiting on luck.
- **Emptying.** Any living player whose feet are on the tile takes one fish every `NET_TAKE_T`
  (0.3 s) straight into their pouch — **team is never checked**. A net is a thing lying on the ice,
  not a locked chest, so an enemy standing on yours walks off with the catch. It is
  [contested](multiplayer.md#contested-orders) (`net:<idx>`) so two players over one rope cannot
  take the same fish. Nothing can refuse a catch: fish are a pouch kind and take no bag cell.

Enemies break a net with **E** like any other building (`workTarget` finds the object on the tile
and gates on `ownsStruct`); the owner demolishes it from the manage wheel. Either way
`destroyStructure` tips what it was holding back out as `fish` drops before it goes.

