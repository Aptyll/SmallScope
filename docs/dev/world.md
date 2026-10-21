# The world

The tile grid, worldgen, [one map](#one-map), the seeded
RNG contract, the day/night cycle, and the one runtime ground change (ice holes). Read this
before touching `genWorld()`, adding a ground type, or anything that must stay
stable per tile.

## The tile world

- `WORLD = 232` tiles of `TILE = 16` px → a 3712×3712 px world (under `PRACTICE` the const is
  76 instead — see [the practice arena](#the-practice-arena)). The forest border is
  `BORDER_MIN`/`BORDER_MAX` (30–70, avg ~50) tiles deep round an interior ~132 tiles
  across, open snow. The two **roost corners** —
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
  [Ice holes](#ice-holes-and-the-lake-fish)), `3` the road ([The road](#the-road)), `4` the
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
  `deadTree`, `rock` (genWorld's placeholder, [lifted at boot](#rocks)), `bush`, `den`, `dummy`, `banner`, `cairn`, `log`,
  `pylon`, `pkdie`, `agbell`, `stump`, `eagle`, `hut`, `part`, and the
  [story landmarks](#story-landmarks)' `boat` (added from `LANDMARKS`); the `STRUCTS` table's: `generator`,
  `barracks`, `tower`. `banner`/`log` are
  [the road](#the-road)'s furniture (`banner` is also the practice gate's flag), `pylon`
  [the zipline](#the-zipline)'s, and `dummy`/`pkdie`/`agbell` exist only in
  [the practice arena](#the-practice-arena). `den` (solid, inert scenery
  two tiles wide — `OBJECTS.den.w`, so `placeCamps` fills the tile east of it with a `part` — that
  carries its `site`, the camp record, so a hover on either tile can wear the camp's clock)
  exists only inside [camps](#camps) (the wolf dens), and so does `hut` (the HOG
  HUT: solid, inert, 2×2 by `OBJECTS.hut.w`/`h`, its parts stamped east and north so the anchor is
  the front row, drawing the whole building). `part` is the filler a multi-tile building (or a prop
  with a `w`/`h` in `OBJECTS`, the den and the hut) leaves on every footprint tile but its anchor (`{ type: 'part', of: <building> }`): solid, coloured like its
  building on both maps, ignored by work swings, and resolved by `structOf()` for every "what building
  is here" read (right-click, cursor, wheel, orders). `deadTree` (a 3 hp snag, chopped like a
  tree for `YIELD.deadTreeHit`/`deadTreeFall`, leaves a stump) and `cairn` stand nowhere since the
  bears moved to the river (4.82): no camp stamps them, and their types and art are kept unused.
- Index with `idx(tx, ty)`, read safely with `objAt`, create with `placeObj`. Deleting is
  `objects[idx] = null` (structures should go through `destroyStructure` so the `structures`
  registry stays in sync — it routes `STRUCTS` types through `removeStruct`).
- `generator`, `barracks`, `tower` and `net` are the **structures** (see
  [Buildings](gameplay/buildings.md)); nobody builds by hand. Each carries `{ tier, maxHp, building, buildT,
  buildTotal, dustT, sparkT }` plus per-type fields (generator `hold`, `cap`, `capBy`, `payT`, `paid`, `lane`: [the gold pumps](gameplay/buildings.md#the-gold-pumps); barracks `waveT`, `queue`,
  `rollT`, `born`, `door`; tower `ang`, `tgt`, `chg`, `cd`, `bolt`; net `fish`), and every live one is also referenced from the module-scope `structures`
  array so `updateStructures()` never scans the 53,824-tile grid. Nor do the object clocks
  (`flash`/`shake`, bush regrow): `tickObjTimers` (js/sim/sim.js, the
  `object timers` banner) ticks only the objects in `objTimed`, in map order, and drops each one
  once its clocks run down. A clock is started only through `joltObj(o, flash, shake)` or
  `timeObj(o)`, which enrol the object; one set straight on the object never runs.
  `objTimersRescan` rebuilds the set after a load (`saveApply`). An emptied
  bush ([Heals](gameplay/heals.md): walked into, it heals and empties) regrows in `BUSH_REGROW` (70 s) and **wears its own clock**: `bushEmpty` until ripening is
  `BUSH_BUD_T` away, then `bushBud` (pale buds where the berries will be), `bushRipen` (the
  berries back but dull) inside `BUSH_RIPEN_T`, then `bush` — chosen in `render()`'s bush
  branch, so a player reads wait-or-move-on off the plant at a glance, and **under the pointer a
  regrowing bush wears the neutral unit bar** filling toward ripe (the frames say roughly, a hover
  says exactly — [rendering.md](rendering/render-pass-order.md)). A bush never rims: E does
  nothing to it. The bushes genWorld lays only keep its stream; `placeBushes` takes them up at
  boot and lays the real ones by the wolf dens and on the creek's banks. Each
  type has one tier and a footprint (`STRUCTS[type].w/h`, 1×1 when absent), with `footprint()`,
  `structCenter()` and `structMouth()` (the ground point in front of the doorway) as the geometry
  helpers. A wreck leaves the tiles empty.
- The world center is an empty clearing: `CENTER_R` keeps ice ponds, the placeholder rocks
  and bushes clear of it, so the river spokes meet in
  open ground. The old ore loop there draws two
  `rand()` per spot and places nothing — **no-ops kept on purpose**, so every seed's stream
  stays what it is.
- Every `tree` carries `rare` (boolean), set at worldgen from `treeRare(tx, ty)`: a `hash2`
  roll makes a `TREE_RARE_CHANCE` (25%) of them **gold pines** — the only pines that pay:
  `YIELD.treeRare` gold (straight to the feller through `awardGold`, the plain gold number and a
  gold burst; nothing marks one standing), paid by `chopTree()` only when the tree actually
  falls, so felling is side income ([Economy](gameplay/economy-one-currency.md)). Being a position hash rather than an `rng()`
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
  edge rims depend on them). The runtime ground writers: [ice holes](#ice-holes-and-the-lake-fish) and
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
  `driftsDepth`) - the pads the map lays behind a pine or the hut, and the skirt round each
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

## One map

The game plays **one map**: one wide interior inside a ring of pines, the only wood the
border's. Two other map shapes (THICKET, all woods with paths cut through; FROZEN ISLES, one
lake with wooded islands) and the path network they needed were removed for now; the PR that
removed them names the commit to recover them from.

## Determinism and noise

Every run picks a fresh `SEED` at boot with `rollSeed()` — always **three digits**, 100..999, so
it can be said aloud — and **everything
random derives from it**: there is no other entropy source. `?seed=N` in the URL overrides it with
any N, which is
how you replay or diff a specific world (and `?practice=1` overrides *that*: the
[practice arena](#the-practice-arena) pins `SEED` to `PRACTICE_SEED`). `drawTags()` prints it as a line of the **info
stack** on the left edge at the top quarter of the view (drawn after the map, settings, and death
overlays), so a screenshot carries the world it came from while `settings.info` is on — the INFO
DISPLAY row in the ESC menu or **F3**, default **off**, so flip it on before comparison captures.

- `rng` is a single `mulberry32(SEED)` stream shared by worldgen *and* runtime effects (particle
  bursts, animal wanders, drop velocities). Worldgen is reproducible only because it runs first at
  boot — hence the CLAUDE.md rule against adding or removing an `rng()` call inside `genWorld()`;
  adding one after boot reshuffles nothing.
- `hash2(x, y)` mixes `SEED` in, and `vnoise(x, y)` is built on it. Both are still pure functions
  of position *within a run* — use them for anything that must stay stable per tile no matter when
  it is asked (ground texture, forest boundary, tree rare-drops, the frost slabs' mottling).
  `borderDepth()` rides on `vnoise`, so the seed reshapes the forest and with it the whole map
  (everywhere but inside the two roost discs, which every seed grows alike).
- An exception to the single stream — nothing outside worldgen may
  perturb the main `rng`'s worldgen prefix. `fxRng` (`SEED ^ 0x9e3779b9`) feeds resize-driven
  snowflake top-ups in `fitFlakes()`, so window size / resolution changes cannot move the world
  (the boot-time 70 flakes still draw from `rng`, unchanged). The [camps](#camps) roll nothing at all -
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
- Ice holes refreeze at dawn. The shoal is not topped up at dawn; it refills continuously. See
  [Ice holes and the lake fish](#ice-holes-and-the-lake-fish).

`state.day` drives no difficulty. What damages a player: another player's arrows, a
plunge through the ice (see [PvP](multiplayer.md#pvp)), and the wolves of a
[wolf den](#camps).

## Ice holes and the lake fish

**Holes are open water in the ice** (`ground = 2`), opened by an [ice break](#ice-breaks), which
freezes each tile back on its own clock (`breakClose`, js/sim/icebreak.js). Nothing a player
carries opens one: the pick and its `crackIce` were cut in 0.531. The `holes` list (open tiles that
outlive their break) has had no writer since the fish net went; the dawn refreeze still empties
it, so an old save's holes close. Constants live in the `fish` banner of
[js/sim/wildlife.js](../../js/sim/wildlife.js) (`HOLE_FALL_DMG`, `HOLE_FALL_T`,
`FISH_MAX`/`FISH_MIN`; `FISH_SPAWN_T` alone stays in core.js).

- **Falling in**: standing over a hole tile (checked at each player's feet in `updatePlayer`,
  js/sim/sim.js) plunges that player: `HOLE_FALL_DMG` (15) via `damagePlayer`, velocity zeroed, and
  `p.fallT` runs `HOLE_FALL_T` (1.1 s) of floundering — no movement, tools, dodge, or
  slide (`clickAction`, `tryWork`, and `tryDodge` all check `fallT`). `drawPlayer` clips
  the sprite to the waterline with ripple rects. The climb-out teleports to
  `nearestDryTile()` with brief i-frames. [The creek](#the-creek) plunges the same way, off the same check (`creekWet` on a ground-`4`
  tile), with the death line `WENT IN THE CREEK`. An **active dodge roll crosses open water safely**
  (the fall check skips while `dodgeT > 0`): any hole, and the creek when the roll starts at its bank. Every player falls in; `die(p)` and `Player.reset()`
  clear `fallT`.
- **Everyone else avoids water**: `moveEntity` treats hole tiles as solid for every entity
  except the player, so animals and robots never wade in, and `walkable()` refuses
  `ground === 2`, so no bot ever routes over one; arrows still fly over holes.
- **Refreeze**: at dawn every listed hole reverts to ice (`repaintGround` again).
- **Fish**: the `fish` array holds up to `FISH_MAX` (30) passive swimmers, that many spawned at
  boot (`spawnFish()`, after `spawnAnimals()`) on **interior** ice only (tile centers passing
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
  app/bake-fish/paint.py (16 headings, 2 tail frames). An ice break spooks nearby fish into a fast dart.
- **The lake fish are scenery.** Nobody catches them: the creek's whitefish is the river's heal
  ([Heals](gameplay/heals.md)). `SFX.splash()` is the water cue. `DBG` exposes `fish`, `holes`,
  `addFish`, `spawnEmerger`.

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
- **The pixels** (`drawIceBreaks`, flat in `render()`): one small canvas a
  break, repainted each frame it is on screen, clipped to where the ice is drawn (`iceAtPx`).

### The shoal is a population, not a nightly reset

Nothing catches the lake fish any more, but the population rules stand: what
keeps it full is a trickle in `updateFish`: `state.fishT` counts down `FISH_SPAWN_T` (11 s), or
`FISH_SPAWN_FAST` (4 s) while the shoal is under `FISH_MIN` (10), and each expiry calls
`spawnEmerger()` unless the shoal is already at `FISH_MAX`. Nothing takes a born fish out now, so
the trickle only fills a shoal that has not reached `FISH_MAX` yet, fastest while it is under its floor.

**`born` is a fish's whole life story.** A born fish is hard-clamped
inside the water and drawn. An **emerger** is none of those. `spawnEmerger()`
puts it two tiles *into the snow* beside a roomy shore tile, pointed at the water — the snow being
the deep lake the map has no way to draw — and it creeps in at `FISH_EMERGE_SPD` (7 px/s) with the
wander, the edge cap and the clamp all switched off, because the shore is the thing it is crossing.

`fishVis(f)` samples five points nose-to-tail and returns the fraction over water; that is `f.vis`,
and it is what promotes the fish (`vis >= 1` *and* `fishClear` agreeing ⇒ `born`, after which the
clamp keeps `vis` at 1 forever). The **draw alpha ramps off the back half of it** —
`max(0, (vis - 0.5) * 2)` — so an emerger is completely invisible until more than half its body is
under the ice, and by the time anything is drawn the only part still outside is a pixel or two of
tail at a fraction of 0.4. An emerger that has not made it in
`FISH_EMERGE_MAX` (14 s) is dropped, unseen. Everything that selects a fish — the draw, an ice break's spook — tests
`born` first.

**The emerge sites are found once and cached** (`emergeSites`/`buildEmergeSites`, a lazy one-time
scan costing ~1.4 ms) — never rejection-sample random tiles for one: on a 232² world a tile
that is ice with swimming room *and* has snow exactly two tiles off is rare enough that the
tries come up empty and the trickle silently stops. The
shoreline never moves, and a hole only flips ice↔water which `fishClear` counts as swimmable
either way, so one scan stays correct for the match; `genWorld()` only ever runs at boot.
