# Light and weather

Everything over the finished world frame, in world pixels, in `renderLighting()`
([js/draw/light.js](../../../js/draw/light.js), the `light & weather` banner). It is the last world
pass; the debug overlays are the only thing above it.

**The fog of war goes first** (`drawFog`, js/draw/fog.js): one `multiply` of a flat grey
(`FOG_TINT`) through a mask of the viewed side's sight, under the hour and the night, so fog and
night stack instead of fighting. Dim, never black, and neutral grey where the night is blue. The
rim is stepped `FOG_STEP` px on the world's own grid (the edge measured on `FOG_CELL` px corners),
so it holds still while the camera slides; never a blur. A body out of sight is simply not put on
the draw list (`fogShown`, in `render()`'s list, the swing arcs, the trample and both maps' dots).
Its cost is on F3's DRAW: about 1 ms on the headless software renderer, mostly the multiply
itself, and an eye that has not moved re-uses its sight lines.

**Almost nothing on the map emits light, and there is no light registry** — not even a glow on the
player: a lit shot and a warren's open snowdrop are the only two. **Night is a colour and a closing in**: a `multiply` of
`NIGHT_TINT` at `globalAlpha = state.darkness`, a little `NIGHT_DEEP` for depth, and then
`nightEdge` — a vignette **inside the world pass**, so it never touches the HUD. It cools what is
already drawn instead of laying a slab over it, so snow stays snow, team colours stay legible at
midnight, and dusk eases into it off the darkness curve with nothing to schedule. A new glowing
object adds a pass here; it does not register anywhere.

**The grade is pale on purpose, and the dark lives at the rim.** What says *night* has to be the
**hue** and the **edge**, because the one thing it cannot be is the middle of the screen going
dark — a top-down field read at a glance has to stay read at a glance. Measured on seed 42's
roost (daylight: open snow L169, pines L108), the tint leaves snow at **L98** and pines at
**L51** — a darker one sinks a blue MERCH tag into blue snow and takes the red out of a red
team's paint — while its channels stay far
apart — `NIGHT_TINT`'s blue is nearly twice its red, and **that ratio is the whole read**; lifting
it is what turns night into dusk. `NIGHT_EDGE` then takes the light back at the corners, where
nobody is reading anything. Those four numbers are what to re-measure after retuning it.

**The grade dims what the world *is*, never what the game is *saying*.** A name tag, the MERCH /
PERCH caps and a damage floater are HUD that happens to be pinned to a body, and a `multiply`
lands on the ink and on the snow under it alike — so a coloured readout converges on its own
background exactly as fast as that background cools. Pre-brightening the ink cannot fix it: the
tint's red channel is half its blue, so a RED team's tag loses its hue before it regains its
value whatever it is drawn in. So world text is **held back** instead — `drawWorldText` queues
the glyphs (`worldInk`) and `flushWorldInk` stamps them at the **end of `renderLighting`**, above
the tint, the depth wash and the rim. It is the same carve-out the two debug overlays get, for
the same reason. **The frames over a body are held back the same way**: `overheadPlate(fn)` queues
one closure per body (`worldPlates`, with the `globalAlpha` and transform standing at the call -
a buried body's fade), and `flushPlates`, first thing in `flushWorldInk`, runs
them in draw order. A player's whole frame (bars, level plate, stun plate, meter and name), a
beast's, every `drawHealthBar` (robots, buildings, the regrow clocks) and the roost's PERCH bar
go through it, so a bar is the same pixels in any light and nothing standing in front of a body
(a pine, another body, a god ray, a cloud's edge) cuts into it; a nearer body's whole frame
covers a farther one's, the way League's plates pile. Queue order is draw order, so a nearer body's tag still covers a farther one's;
the queue only applies while `ctx === wctx`, so a UI pass that reuses one of those drawers (the
wiki's animal page raises a sense mark of its own) draws where it stands. Everything else over
the world — bodies, shots, ground decals — goes **under** the grade, which is what keeps night a
place rather than a filter.

The day half is two things, drawn in that order because a shadow falls across a sunbeam and not
the other way round:

- **God rays** (`godRays`) — **parallel** shafts of low sun on one heading (`RAY_ANG`, drifting on
  a long sine), and they are a **moment, not weather**. Low sun is the light of an arrival and of
  the top of the day, and a beam that is always there stops being a beam, so `rayLight()` gates the
  whole pass to two windows and it is dark the rest of the time: the **entire eagle ride** plus
  `RAY_AFTER` (4 s) past the landing — `landPlayer` stamps `state.rayT`, `updateFx` counts it down —
  and a **~15 s window around noon** (`RAY_NOON`, the middle of the daylight half). Both ease in and
  out over `RAY_WINDOW_FADE`. The gate is read *first*, so outside those windows the eight blits and
  the 240 motes behind them never run at all. The practice arena's clock never moves, so
  its training light never gets them. The sun is far away, so nothing here converges: shafts fanned
  off a nearby origin read as a spotlight rather than as daylight. What makes a parallel set
  read as *beams* rather than as striping laid over the picture is the **length fade**: each shaft
  swells out of nothing, peaks about a third of the way along and **trails off** before it leaves
  the view, so it arrives from somewhere and dies in the air instead of running edge to edge. They
  are slim (`RAY_W`, a fraction of `WV_H`) and deliberately faint — on snow already sitting at 0.95
  a shaft that states itself is a shaft that has blown the ground out, which is why they read
  strongest on ice and on the treeline and barely at all on an open drift.
  Placement is done in the **rotated frame**: the view's four corners are projected onto the
  heading and its normal, and the shafts are laid across that span, so none is ever placed where it
  could not be seen. The set breathes sideways on a slow sine rather than drifting and wrapping —
  a wrap would pop a shaft into existence mid-screen — and each shaft is staggered along its own
  length and wanders a little off the shared heading, so the set never reads as a comb.
  The shaft is one **baked** 256×64 texture (`RAY_CV`) carrying *both* fades — a soft-shouldered
  cross-section and the swell-and-trail along its length — drawn scaled and rotated per shaft. That
  is why it is baked: drawn as gradient strips the length fade bands, and two gradients cannot
  multiply in one fill. Eight `drawImage`s carry the whole pass.
  The set is anchored to the **view**, not the world, and every dimension is a fraction of
  `WV_W`/`WV_H`. Crepuscular rays are air, not ground, so nothing about them should slide when you
  pan — and it means the shafts are composed identically at every zoom.
- **Dust motes** — the sparkle in the shafts, drawn by the same function, and the half of the
  effect that actually carries on snow. They live in **shaft coordinates** (`u` along, `v` across),
  so they can only ever exist where a shaft does and they drift *down* it rather than falling with
  the snow; they carry the shaft's own swell-and-trail, so a mote fades with its light. Their hash
  keys off the shaft's **index**, never its angle — the angle wobbles every frame, and a mote whose
  seed moves teleports instead of drifting. They are drawn `source-over` in warm **gold**, not
  additively in white: snow sits at 0.95 and has no headroom left to brighten, so a white additive
  mote over a sunlit drift is invisible while a warm speck reads. The biggest get a white core and
  a four-armed catch. `RAY_N` 8 shafts × `RAY_MOTES` 30 = 240 of them, before the view cull.
- **Cloud shadows** (`cloudShade`) — two tileable noise fields (`bakeCloud`) baked once at their
  **final world size** and drawn 1:1 through `repeat` patterns: no scaling, so no smoothing
  question and no seam. `pnoise` is value noise on a lattice wrapped per axis, which is the whole
  trick — it is what lets one 768 px canvas tile the entire 3712 px world. Fewer features across
  than down stretches the shade along its drift, which keeps it from reading as circles. The two
  periods (768 and 448) never come round together, so what crosses the field never visibly
  repeats. World-anchored and world-sized, so zooming in walks you *under* a cloud.
  **The mapping is the whole look.** A threshold with a narrow ramp gives a plateau of full shade
  inside a visible rim, and a screen of those reads as clip-art blobs sliding over the snow. So
  there is no threshold: `lo`…`hi` spans about three standard deviations of the field, so almost
  every pixel lands somewhere on the ramp and hardly any reaches either end — what crosses the
  ground is one continuous swell of dimming with **no edge anywhere in it**. `lo` sits just above
  the median, which keeps roughly half the sky genuinely open: a flat plateau of *clear* is fine,
  it is a flat plateau of *shade* that reads as a blob.
  **Contrast is set on the ramp, not by turning the whole thing up.** `CLOUD_CURVE` (a power > 1)
  bends the thin half of the ramp thinner, and `CLOUD_GAIN` then pushes what is left into the
  clamp, so open snow stays open and the deep part of a cloud is the only part that really
  darkens — the swing across the ground is what grows, not the average. Measured off the two baked
  textures at full daylight, as a percentage of the ground's own brightness left standing: the
  deepest 0.1 % of the field sits at **61 %**, the median at **97 %** and the mean at **94 %**.
  That swing is the number to check when retuning it; the shadow tint (`CLOUD_TINT`, cool, never
  grey) is the other half of how hard it bites.
  **The practice arena is exempt** (`PRACTICE`): a shadow drifting over the dummy's meter or the
  parkour's ice would change what those instruments are measuring between one lap and the next, and
  that room's whole point is that its light never changes. (It gets no shafts either, for free —
  its clock is pinned nowhere near noon and it has no eagle.)

Then [the hour](#the-hour) (`todGrade`), then the night multiply, then **`litSnowdrops`**, the
one light left in the game: each open snowdrop the object pass drew hands
its place over (`litDrops`), and this lays the rest above every grade — a stepped pool of warm light
(`SNOWDROP_POOL`, added, breathing on `SNOWDROP_BREATH`, stronger with the dark), the bell again
(`SPRITES.snowdrop[v].bell`, so no cloud shadow, hour or night dulls it), its halo of sparks
(`SNOWDROP_GLOW_HZ`), `SNOWDROP_TWINKLES` four-armed stars popping round the bell and
`SNOWDROP_MOTES` gold motes rising off it. Each clump runs on its own hash phase, all of it on the
frame's clock. A body standing just in front of a clump has the bell drawn over its edge.

## The hour

**The same place looks like four places across a match — rose dawn, crisp midday, gold dusk, blue
night — and all four are a colour grade, never a light.** `todGrade` (`the hour`, js/draw/light.js)
runs after the clouds and before the night multiply, and grades what is already on the frame with
two fills, a **split tone**:

- a `multiply`, the colour of the **light**: it moves snow at 0.95 a long way and a pine's
  needles hardly at all, so it lands on what is lit — the drifts and the snow on the canopies;
- a `screen`, the colour of the **sky in the shade**: it lifts a dark pixel a long way and a white
  one hardly at all, so it lands in the cast shadows, the cloud shade and the needles.

Warm light over cool shade is what golden hour looks like, and the pair pulls a pixel apart by its
value where a single wash would only tint the whole frame. The colours come off `TOD_KEYS`,
keyframes on `state.time` across the whole `CYCLE` (the last row repeats the first, a cycle on):
rose light over violet shade as the dark lifts, clearing through the morning, clean at midday,
warming through the afternoon, gold-orange over blue shade at dusk until the dark ramp takes it,
and white over black — a no-op — through the night, whose own multiply does that half. **Keep the
dusk multiply's blue channel near 160 or above**: at 118 a blue team's paint goes grey (the eagle
did). The practice arena is exempt (`PRACTICE`): its light never changes, for its instruments' sake.

**Midday** is clean light, and clean light is contrast: across the noon window (`TOD_NOON` ±
`TOD_NOON_HALF`, easing over `TOD_NOON_FADE`, gated by `todNoon`) the world buffer is multiplied
**by itself** at `TOD_CRISP`, which deepens the needles and the cast shade far more
than the drifts. It goes through a copy (`gradeCv`, js/app/canvas.js): the frame's used corner is
copied there and multiplied back. Never draw a canvas onto itself: the browser then copies the
whole backing store and again on the next stroke, which cost 4 ms a frame on a CPU-drawn canvas.

## The reflected sky

`drawIceStars` is night's one bright thing, and the only place the stars are visible in a game
with no sky in frame: they are **in the ice**. Two halves, and the first is what makes the second
work at all.

**The mirror.** Sheet ice is painted at 0.72–0.93 brightness — most of the way to white — so a
white dot on it has almost no contrast, and the night `multiply` grades star and ice down together
and *keeps* it that way. There is no headroom to fix it with. So the ice itself goes **dark**
first: every intact tile takes a deep-blue wash scaled by `state.darkness` (`STAR_MIRROR`), which
is what a frozen lake at night actually looks like from above — a black mirror, darker than the
snow around it — and it is what gives the stars something to be bright against. Without it the
whole effect is invisible. A tile no shore crosses is filled in horizontal **runs** of adjacent
ice, one `fillRect` per run rather than one per tile; a tile the shore does cross (ice or snow)
stamps its own 16 px slot of `mirrorCv` — the ice pixels of the edge test the ground bake read
([the ice shore](../world.md#the-ice-shore), js/draw/ground.js), all in one atlas so the stamps
batch — so the dark ends where the painted ice does, never on the tile grid.

**The sky.** The stars are anchored to the **world**, never to the camera: a star sits at one place
on the lake, so it stays put as the view pans over it and two players looking at the same stretch
of ice see the same stars. The loop runs over **sky cells** — a `STAR_CELL` grid laid over the
world — and asks what tile each one landed on. A star draws only where it fell on **unbroken** ice
(`ground` 1 — `overIce()`, which every reflected pixel passes, the arms of a bright star's cross
included), so the field is cut to the shape of the lake and **an ice hole is a hole in the stars
too**. Each twinkles on its own rate, and the whole reflection ripples a pixel sideways on a slow
wave down the field, because ice is not a perfect mirror.

It is drawn **early** — right after the visible tile range is computed, above the under-ice fish
and the crack decals but under everything that walks, so a body standing on the ice covers its own
reflection — and therefore **under** the night multiply as well. That is deliberate: the same blue
that cools the snow cools the stars with it, which is what a reflection does.

## Cast shadows

**One sun, top-left, and everything standing on the snow throws its own silhouette down-right**
(the `cast shadows` banner, js/draw/ground.js). `shadeMask` bakes a frame's shade once: each
opaque pixel lands `SUN_DX`/`SUN_DY` (0.62, 0.34) per row of height from the art's foot row, so a
pine throws a long leaning slab and a rabbit a sliver. It is not light — nothing glows — and it
does not follow the day clock: the shade lies where it lies at night too, under the grade.

- **The scenery's shade is ground.** `CASTERS` names what stands, by object type (pine, dead
  tree, rock, bush, stump, den, chest, cairn, hog hut), with its art and where it sits on its tile — the
  pine's is its *standing* frame (`treeRestFrame`), never the wind's, and its code carries its
  nudge too so the shade lies under the art where it was nudged (every palette row shares one
  silhouette, so the shade is cut from row 0). Each chunk bake lays its own
  in one go (`shadeChunk`: every caster's shade unioned opaque, then one
  `multiply` of `SHADE_TINT` at `SHADE_A`, so overlapping shade is one shade, never a darker
  one); a single tile repaints through `paintCastShade`, the same union for one tile. A composite
  onto the 3712 px canvas costs the same for 16 px as for 256, so the per-tile path over the whole
  map took five seconds — never bake the map through it.
- **Nobody has to report a change.** `castAt` remembers the caster each tile's shade was painted
  with, and `syncCasts` — the first thing `render()` does before the ground blit — compares it
  with what stands there now over the view plus `CAST_REACH`, and repaints the reach of any that
  changed, each dirty tile once. A pine felled by an axe, a crater or a snapshot takes
  its shade with it, and a new kind of scenery only needs a `CASTERS` entry.
- **Bodies draw their own each frame** (`drawCastShade(spr, x, y)` before the sprite, a
  `WeakMap` of shades per frame): players (the standing frame through a roll; none lying prone or
  in a hole), animals, worker bots and soldiers, merchants (on the snow through a hop) and
  finished buildings. It is flat `SHADE_BODY` at `SHADE_BODY_A`, which reads the same on the snow
  as the multiply. Birds, flags, pylons and the practice furniture keep their small flat marks.
