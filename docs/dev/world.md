# The world

The tile grid, worldgen, [one map](#one-map), the seeded
RNG contract, the day/night cycle, and the one runtime ground change (ice holes). Read this
before touching `genWorld()`, adding a ground type, or anything that must stay
stable per tile.

## The tile world

- `WORLD = 140` tiles of `TILE = 16` px (js/sim/core.js) → a 2240×2240 px world, square.
  **The field** that fills it is one signed distance (`fieldOpen`, js/sim/field.js): negative on
  ground a body can walk, written for RED's top-left quarter and folded four ways (`fieldFold`,
  `fieldFour`), so both sides and both halves are the same shape by construction, until the
  groves' edges wander. Two lanes are the
  two halves of one rounded rectangle round the middle (`laneLoop`); each side's perch sits on it at
  the middle of its own end ([the perch](rendering/the-perch.md)); a jungle of pine groves fills the inside
  (`JUNGLE_BOX`, `FIELD_GROVES`: strokes and ovals met in smooth unions, `fieldGroves`, whose edges
  wander on the map's noise read folded left to right only, `fieldWander`, so blue and red are mirror
  images but the top and bottom halves differ; `FIELD_WAYS` and a clearing round every camp and the
  pump stay open whatever the wander does); a creek of rough ice runs down the middle column from the
  top hollow's frozen pool, round the middle's grove, to the bottom hollow's (`fieldCreek`,
  `HOLLOW_POOL`); no pits or dens open off the lanes; and a pine border at least `FIELD_EDGE` tiles deep stands round it
  all. RED (team 0) holds the west end, BLUE the east. Nothing rolls.
- `genWorld()` (first at boot, js/app/boot.js) stands a wall pine (`wall: true`, which never falls:
  `treeFells`) on every tile the field leaves closed, lays the road (ground `3`) where `laneDist`
  is negative, and freezes the orca's pool and the creek (ground `1`, `orcaLakeAt`, `fieldCreek`). It reads the
  open tiles off `fieldGrid`, which also closes any open tile no `FIELD_PATH`-wide square covers and
  any pocket a walk from the perch never reaches, so every way through is at least `FIELD_PATH` wide.
  All three ices are rough (`fieldRough`, read by `slickUnder`): they hold a foot like snow. The camps, towers, stalls,
  pumps and drifts are laid on it after, each from written-down sites.
- `ground` — `Uint8Array(WORLD²)`: `0` snow, `1` ice, `2` open-water hole (runtime-only, see
  [Ice holes](#ice-holes)), `3` the road. **Open water is `waterAt(tx, ty)`**, a carved hole, the
  one read every walker, route, spawn and climb-out asks. Ice is **mechanically slippery** (see
  [Momentum movement](gameplay/momentum-movement-players-only.md)); the orca's pool is the only ice
  worldgen lays.
- `objects` — flat `Array(WORLD*WORLD)`, **at most one object per tile**. Every object is
  `{ type, tx, ty, hp, flash, shake, ...extra }`. The `OBJECTS` table names the scenery types
  (`tree`, `snowdrop`, `stump`, `eagle`, `part` and the rest); the `STRUCTS` table's are
  `pump` and `tower`. `part` is the filler a multi-tile building (or a prop with a `w`/`h` in `OBJECTS`)
  leaves on every footprint tile but its anchor (`{ type: 'part', of: <building> }`): solid,
  coloured like its building on both maps, ignored by work swings, and resolved by `structOf()`
  for every "what building is here" read (right-click, cursor, wheel, orders).
- Index with `idx(tx, ty)`, read safely with `objAt`, create with `placeObj`. A tile written or
  deleted during a match goes through `setTile(i, o)` (null deletes), which marks it for the host's
  wire (`snapTouch`, [the ack-keyed base](../pvp-architecture.md#the-wire-form)); a bare
  `objects[i] = ...` reaches clients only on the wire's slow sweep. Worldgen writes bare.
  Structures go through `destroyStructure` so the `structures` registry stays in sync — it routes
  `STRUCTS` types through `removeStruct`.
- `pump` and `tower` are the **structures** (see
  [Buildings](gameplay/buildings.md)); nobody builds by hand. Each carries `{ maxHp, building, buildT,
  buildTotal, dustT, sparkT }` plus the fields its entry's `init` lays (pump `hold`, `cap`, `capBy`, `payT`, `paid`, `lane`: [the gold pumps](gameplay/buildings.md#the-gold-pumps); tower `ang`, `tgt`, `chg`, `cd`, `bolt`), and every live one is also referenced from the module-scope `structures`
  array so `updateStructures()` never scans the 19,600-tile grid. Nor do the object clocks
  (`flash`/`shake`): `tickObjTimers` (js/sim/sim.js, the
  `object timers` banner) ticks only the objects in `objTimed`, in map order, and drops each one
  once its clocks run down. A clock is started only through `joltObj(o, flash, shake)` or
  `timeObj(o)`, which enrol the object; one set straight on the object never runs.
  `objTimersRescan` rebuilds the set after a load (`saveApply`). Each
  type has one tier and a footprint (`STRUCTS[type].w/h`, 1×1 when absent), with `footprint()` and
  `structCenter()` as the geometry helpers. A wreck leaves the tiles empty.
- Every `tree` worldgen stands is a wall pine. `chopTree()` (js/sim/actions.js) still pays a
  pine that can fall (`YIELD.treeFall`, and `YIELD.treeRare` for one marked `rare`), but none on
  the 3v3 field can ([Economy](gameplay/economy-one-currency.md)).
- **The ground is baked once, lazily.** The whole ground lives in one offscreen canvas and the
  frame loop blits the camera window out of it, but nothing is painted at boot: `prepGround()`
  (js/draw/ground.js) readies what the painter reads (`bakeLakes`, `bakeDressing`, `noteCasts`),
  `render()` bakes every `GROUND_CHUNK` (16-tile) square the view reaches before its blit
  (`groundView` → `bakeGroundChunk`), and idle time bakes the rest nearest the camera first
  (`groundIdle`, a `requestIdleCallback` whose timeout keeps it moving through a busy match) —
  the whole map at once kept the first frame waiting a second and a half. Every tile paints only inside its own 16 px, from the world as it
  stands, so `paintGroundTile` skips a tile whose chunk is not baked yet (`groundBaked`): that
  chunk's bake paints it as it is by then, and a chunk bake lays exactly what per-tile repaints
  would. A painter that colours single pixels dots them through the pixel pen (`penDot`, flushed
  by `penFlush` before it returns), which draws each run of same-ink pixels along a row in one
  `fillRect` — a million single ones were a third of the bake, and a run lays exactly what its
  pixels would. The per-tile painter is `paintGroundTile(g, tx, ty)`, and a runtime change goes through
  `repaintGround(tx, ty)` (the CLAUDE.md hard rule — the four neighbours are repainted because
  edge rims depend on them). The runtime ground writers: [ice holes](#ice-holes) and
  their dawn refreeze, [ice breaks](#ice-breaks) opening and freezing back, . The bake also lays the scenery's
  [cast shadows](rendering/light-and-weather.md#cast-shadows), and `render()` repaints a caster's reach itself
  when what stands on a tile changes, so felling or placing scenery calls nothing.
- **Open snow wears soft drifts** (the `snow's pixels` banner, js/draw/ground.js): swells laid
  along the wind (`SNOW_ANG`, which `layDrifts` turns onto the map's prevailing wind, `driftWind`, so
  the swells and the [drifts](#snow-depth) lean one way), lit on the sun's side and shaded on the lee in four close tones
  (`SNOW_PAL`) as flat tones on clean stepped edges, with a rare white glint on the lit tone. A low noise
  (`SNOW_REGION`, ~22 tiles a step, cut at `SNOW_CUT` into thirds of the map) lays out regions of
  three `SNOW_LOOKS` — fine drifts, broad swells, lee-only — blended across `SNOW_BLEND`. Every
  pixel is a function of its world position alone (the heights on a world-aligned 2 px lattice),
  so any repaint lays back exactly the snow the bake laid, a lake-shore tile reads the same
  lattice, and nothing rolls. Kept subtle on purpose: the lee tone stays well above a cast
  shadow. A chunk bake lays each row of its snow in one strip (`snowStrip`) — `putImageData` per
  tile alone would cost the map half a second — under every tile but ice and holes (the road lies
  over snow), and shares the height lattice across the chunk (`snowLatOpen`: a
  tile reads a 12-point square for its own 8, so alone it works out each height about twice).

## The lanes

Lane 0 is the TOP, lane 1 the BOTTOM: each the half of the lanes' loop on its side of the middle,
from RED's perch to BLUE's (`laneLine`, js/sim/field.js, a point about every tile with the tiles
along it). A lane is open `LANE_HALF` tiles either side of its centreline, and **the road** is the
packed earth down its middle, `ROAD_HALF` either side, plus the plaza round each perch
(`laneDist`, `onRoad`; ground `3`). A wave marches its lane's waypoints (`laneWaypoints`,
`LANE_STEP` apart), and a laner with no column of its own on the lane waits `LANE_HOLD` of the way
to its middle (`laneHold`). Two towers a side stand on each lane's centreline, one on the straight
and one on the bend by the perch (`TOWER_SPOTS`, js/sim/towers.js, folded with `fieldFour`).
The road's pixels are `paintRoadOverlay` (js/draw/paving.js).

### The ziplines

Each side strings a cable down each lane (`placeZips`, js/sim/zipline.js, at boot after
`placeTowers`): pylons along the lane's outer edge, `ZIP_OFF` tiles off the centreline, from
`ZIP_START` tiles out of the perch to the side's outer tower, at most `ZIP_SPAN` apart and one
beside each tower. Past the tower the cable ends without a post: the strand runs on to a landing
`ZIP_LAND` tiles past it, on the snow, and slants down to a stake `ZIP_STAKE` tiles beyond (each
cable's `land`/`stake`), the ramp a rider comes off and climbs on by. RED's top cable is laid off the lane and the
towers and the other three are it mirrored tile for tile, so all four are alike. A pylon takes
the tile of any pine on it. A cable runs only as far as its side's furthest standing tower on
the lane (`zipSync`, each tower's `zl`/`zi`): back to the inner tower's ramp once the outer falls,
and gone once both have. The ride is [the zipline](gameplay/momentum-movement-players-only.md#the-zipline).

## The bases

A side's base is its PERCH: a disc `BASE_R` tiles round a point on the loop at the middle of its
own end (`basePerch`; RED's at field x `BASE_X`), its plaza of stones `PLAZA_R` round the bird.
The eagle sits there from the first frame ([the perch](rendering/the-perch.md)), the soldiers walk
out of it both ways, and the side's merchant keeps its trading post behind it (`MERCH_STALL`,
js/sim/robots.js) in **the merchant's court**: on the perch's centre line a bay of the plaza's
stones is cut back into the woods (`COURT`, paved through `courtDist` in `laneDist`), the pines
leave a pocket round it (`COURT_CLEAR`) and close in two wings from the base's rim to its mouth
(`COURT_WING`, short of the lanes' open band), so the shop sits in the trees with both lanes the
same walk away. `baseAt(tx, ty, pad)` names the side whose disc holds a tile.

## Camps

The neutral monsters stand at fixed, mirrored sites (`CAMP_SITES`, js/sim/camps.js), written for
RED's top quarter and folded to the other three like the field (`campSites`): a site on the middle
row or column is its own twin. Per side: two SCRAP PILES of stray robots in the bottom half
(`scrap`, brass walkers: the jungle's farm, `farm`), nothing in the top half's two sites, and a rabbit WARREN in deep
snow by the base mouth (`meadow`). The orca's pool is the pit above the top lane and the black
bear's den the pit below the bottom one, one each for the whole map. Nothing rolls. What lives
in them: [wildlife](gameplay/wildlife.md#camp-monsters-neutral-until-hit). The gold pumps stand
one each side of the middle (`PUMP_SPOT`, js/sim/pumps.js).

### Snow depth

The brush is deep snow at written-down places (`FIELD_BRUSH`, js/sim/field.js, laid in all four
quarters by `layBrush`, js/sim/depth.js), plus each warren's round pool (`layMeadowDrifts`).
`snowDepth` is the whole map of how deep the snow lies; `brushOf`/`deepAt` ask after the deep
band a body hides in ([fog of war](gameplay/fog-of-war.md)).

### The ice shore

**A lake is a shape, not a run of tiles** (the `the ice shore` banner, js/draw/ground.js). The
tile grid still says where the ice is for every rule — slipping, cracking, the maps — and
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
`rng()`, runs once before the bake, and is the same on every screen; the ground
array only ever flips ice ↔ hole at runtime and both are lake, so it never needs redoing.

| Style | Edge | The ice |
| --- | --- | --- |
| **LIP** (`w` 1) | gentle wander, 2 px shade band | the sheet's two tones on a dithered low noise |
| **DEEP** (`w` 2) | gentle wander, 3 px deeper band | pale shallows along the shore, then two steps darker to the middle, off `lakeDepth` |

The looks are A and B of `docs/media/concepts/shore-shadow-concepts-1.png`, DEEP (B) being
the pick, hence its double weight; C (a drifted, cracked edge) was cut as too noisy. Cracks and glints (the tile's own hash) only go on
a tile whose 3x3 is all lake, so none lands on a bank. Where a road reaches a lake, `paintRoadOverlay` still paints over the
shore. Night's mirror follows the same edge ([the reflected sky](rendering/light-and-weather.md#the-reflected-sky)).

### The wind's leavings

**Scenery the wind lays, all in [js/draw/lakes.js](../../js/draw/lakes.js), and none of it a
rule**: no walker, route or slide reads it, and the ice's shine shows through everything laid on
it, so a lake still reads as slippery. `bakeDressing` runs in `prepGround` right after
`bakeLakes`: it labels every lake with its area (`lakeTiles`; `BIG_LAKE` tiles makes one big) and
works cracks, banks and drifts out **once** into per-tile pixel lists (`dressPx`), which
every paint of a tile stamps (`paintDressing`, called from `paintGroundTile` under the road and the
cast shade). So a repaint lays back exactly what the bake laid, a drift reaching
across a tile edge carries on, and a hole that refreezes gets its crack back.

- **One snow depth, three bands.** The deep snow layer owns one seeded depth map (`snowDepth`,
  `DEPTH_MID`/`DEPTH_DEEP`, `deepAt`, `driftWind`); its deepest band is the brush, and this
  file draws the two below it: the mid band (from `DRIFT_MID()`) as drifts,
  the shallow band as dust and banks. It reads the map only through `snowDepthAt`/`deepSnowAt`
  and the prevailing wind through `rollPrevailing` (`LW_X`/`LW_Y`, downwind), and draws nothing on
  a tile the deep band owns, so a pile that looks deep is always deep snow. Nothing is stamped on
  a tile an object stands on (a landmark on the ice covers its own).
- **Drifts in the lee**: the map's mid band drawn per pixel (`bakeDrifts`, reading `leeDepth` and
  `driftsDepth`) - the pads the map lays behind a pine or a den, and the skirt round each
  deep drift - as a low flat pile, sunward rim lit and a pixel of shade past its lee. Its shape is
  the map's, so it ends where the deep band's own look begins. Nothing on ice, the road or a
  tile something stands on.
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

## One map

The game plays **one map**: the 3v3 field, two lanes round a walled jungle
([the tile world](#the-tile-world)). The old 5v5 valley (three lanes, the creek, the cistern and the
landmarks) was cut with the 3v3 field; the PR that cut it names the commit to
recover it from.

## Determinism and noise

There is **one map**, grown from `MAP_SEED` (471, js/sim/core.js), a constant that is never rolled
and never sent: every match and every screen stand on the
same field, and a page is born on it. **Everything random derives from two numbers** and there is
no other entropy source: `MAP_SEED` for the map, `SEED` for the match. `SEED` is rolled when the
page loads, so no two matches play out alike (bots' first heroes, tie-breaks, the orca's wanders,
every `rng()` roll), unless `?seed=N` pins it, which a tool uses to replay a bot match; it never
changes the map, and the same `?seed` gives the same match (and `DBG.saveHash`). Only the host's
matters online: a client paints what the host sends. Players never see either. `matchHash(a, b)`
(js/sim/core.js) is `hash2` with `SEED` mixed in, for the host's per-match picks.
The info stack (`drawTags`, **F3** or the INFO DISPLAY row in the ESC
menu, default **off**) prints fps, frame times and the framed player's tile, no seed.

- **The map rolls nothing.** The field, the camps' sites, the brush, the towers and the stalls are
  all written down, and per-tile looks read `hash2`/`vnoise`. A worldgen pass that ever rolls must
  draw from `worldRng(name)` (js/sim/core.js: the pass's name hashed into `MAP_SEED`, carrying its
  own `rand` and `randi`), so a pass that changes moves only its own layer (CLAUDE.md hard rule 3).
  Every screen grows the map itself, so worldgen never reads `rng()`, `Math.random()` or anything
  local.
- `rng` is the **match's** `mulberry32(SEED)` stream: runtime rolls (particle bursts, animal
  wanders, drop velocities) and the beasts the match starts with (`stockCamps` at boot). Its state is saved, so a loaded match draws the next number the saved one would.
- `hash2(x, y)` (js/draw/ground.js) mixes `MAP_SEED` in, and `vnoise(x, y)` is built on it. Both are pure functions
  of position — use them for anything that must stay stable per tile no matter when
  it is asked (ground texture, forest boundary, tree rare-drops, the day's weather, which every
  screen works out for itself).
- `fxRng` (`SEED ^ 0x9e3779b9`) feeds the snowflakes (the boot fall and `fitFlakes()`' resize
  top-ups), so window size and zoom cannot move a match's rolls. The [camps](#camps) roll nothing at all -
  their sites are written down.
- `MAP_SEED` and `SEED` are `const`s in the rng banner and `hash2` closes over `MAP_SEED`, so nothing may call `hash2`
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
  `state.darkness < 0.3`. There is no cold/warmth system.
- **The wind dies with the light.** `windAmp()` squares `1 - darkness`, so the snow stops blowing
  sideways and every pine goes still over the twelve seconds of dusk and stays still until dawn
  ([the wind field](rendering/drawing-a-thousand-of-something.md#the-wind-field)).
- The **sun shafts** are not on the darkness curve at all: they are up for the eagle drop and for
  about fifteen seconds around noon, and dark otherwise
  ([god rays](rendering/light-and-weather.md)). The **cloud shadows** fade out on it, and the **ice** darkens
  into a mirror on it with the **reflected stars** coming up inside that
  ([the reflected sky](rendering/light-and-weather.md#the-reflected-sky)) - so a frozen lake reads darker than the
  snow around it after dusk, and an ice hole is a hole in the reflection.

`state.day` drives no difficulty. What damages a player: another player's arrows, a
plunge through the ice (see [PvP](multiplayer.md#pvp)), and the monsters of the
[camps](#camps).

## Ice holes

**Holes are open water in the ice** (`ground = 2`), opened by an [ice break](#ice-breaks), which
freezes each tile back on its own clock (`breakClose`, js/sim/icebreak.js). Nothing a player
carries opens one, and no hole outlives its break. Constants live in the `open water` banner of
[js/sim/wildlife.js](../../js/sim/wildlife.js) (`HOLE_FALL_DMG`, `HOLE_FALL_T`).

- **Falling in**: standing over a hole tile (checked at each player's feet in `updatePlayer`,
  js/sim/sim.js) plunges that player: `HOLE_FALL_DMG` (15) via `damagePlayer`, velocity zeroed, and
  `p.fallT` runs `HOLE_FALL_T` (1.1 s) of floundering — no movement, tools, dodge, or
  slide (`attackStep`, `tryWork`, and `tryDodge` all check `fallT`). `drawPlayer` clips
  the sprite to the waterline with ripple rects. The climb-out teleports to
  `nearestDryTile()` with brief i-frames. An **active dodge roll crosses open water safely**
  (the fall check skips while `dodgeT > 0`). Every player falls in; `die(p)` and `Player.reset()`
  clear `fallT`.
- **Everyone else avoids water**: `moveEntity` treats hole tiles as solid for every entity
  except the player, so animals and robots never wade in, and `walkable()` refuses
  `ground === 2`, so no bot ever routes over one; arrows still fly over holes.
- **Nothing lives under the lake ice** but [the orca](gameplay/wildlife.md#the-orca). `SFX.splash()`
  is the water cue.

### Ice breaks

**Something big coming up through a lake breaks the ice in its own shape**, never a tile's
([js/sim/icebreak.js](../../js/sim/icebreak.js), the pixels in
[js/draw/icebreak.js](../../js/draw/icebreak.js)). The orca comes up through one
([the orca](gameplay/wildlife.md#the-orca): `orcaStrike`). `iceBreak(x, y, shape, ang, { warn, hold })` breaks the ice
round a world point and returns the break (null where no bare ice lies under it);
`DBG.iceBreak` stages one.

- **The shape is a footprint** on the ice plane: an `ICE_BREAK_SHAPES` row of ellipses and
  polygons in world px (nose to +x, turned by `ang`, squashed by `sq` the way the 3/4 view lays
  ground). `orca` is the orca's own, `breach` is MARIS's (js/sim/maris.js).
- **Every pixel is hashed, never rolled**: the hole is the footprint one px proud
  (`ICE_BREAK_PROUD`) with a chipped edge, each pixel's freeze time `ft` runs from 0 at the rim
  to 1 in the middle, and the plates and cracks come off Voronoi cells seeded the same way. All
  of it comes from `hash2` (the map's), the break's spot and its own seed, so a break is a
  few numbers (`iceBreaks`, saved in `SAVE_ROOTS` and carried as a snapshot singleton) and
  every screen rebuilds its pixels (`breakCache`). No `rng()` call is spent.
- **Its life**, off `state.tick` (`iceBreakAge`): `warn` s of cracks tracing the outline, then
  it opens (plates flung out over `ICE_BREAK_BURST`, a splash), stays wide
  open `hold` s (`ICE_BREAK_HOLD` by default), freezes back over `ICE_BREAK_FREEZE` (20 s) from
  the rim inward along a ragged front, and the new ice thickens from dark to the sheet's tone
  over `ICE_BREAK_SKIM`.
- **Tiles and pixels.** Only tiles that were bare ice at birth (`cov`) break. A tile at least
  half open water is ground `2` (so `waterAt`, routes and spawns treat it as water) until its
  own close time in `open`; `updateIceBreaks` (from `updatePlay`) opens and closes them. A
  tile a break holds is painted as ice (`paintGroundTile` asks `iceBreakHolds`) and the break
  draws its own water over it, so nothing square ever shows. A player's feet read the pixels
  (`iceBreakWet`): the plunge in `playerPlunge` and the climb out (`nearestDryTile`) go by the
  water as drawn, and a strict move (`moveEntity`) stops at its edge.
- **The pixels** (`drawIceBreaks`, flat in `render()`): one small canvas a
  break, repainted each frame it is on screen, clipped to where the ice is drawn (`iceAtPx`).
