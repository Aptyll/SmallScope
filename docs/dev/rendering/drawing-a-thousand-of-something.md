# Drawing a thousand of something

**A `drawImage` whose source canvas differs from the last one cannot be batched.** The driver has
to change texture, so it becomes its own GPU draw call, and a wide-open view holds around a
thousand pines. This is the single largest performance fact in the renderer, and it is not about
pixels at all — the measurement behind the rule (a GTX 1060 at 886×498 over the treeline, taken on
the sixteen-frame pine that preceded today's twenty-four):

| what the pines drew from | fps |
| --- | --- |
| sixteen separate frame canvases, cycling | **97** |
| the same sixteen, frame pinned so every call hits one canvas | **199** |
| no trees at all | 205 |

Sprite **area is irrelevant** (a sprite two and a half times the size cost 3 fps). What
costs is the state change. So `SPRITES.treeAtlas` lays all twenty-four bend frames side by side in
one canvas — and then all twenty-four again mirrored, forty-eight columns, because half the forest
draws flipped — and stacks **nine rows** of those, one per palette (three variants × three forest
depth tones, [sprites.md](../sprites.md)), because a bigger atlas is still **one** texture. `fw`/`fh`/`cols`
ride on it, a cell index is `column + row × cols`, and `drawFrameFlash(atlas, cell, x, y, flash)`
— the atlas-aware twin of `drawSpriteFlash` — blits a source rect out of it. `SPRITES.tree` still exists
because the atlas is baked from it, but nothing draws through it.

**Anything new that the world can hold hundreds of has to do the same**, or it will quietly cost
more than everything else in the frame put together.

## Specks

The same rule, one level down: the sun's dust motes and the ice's reflected stars are hundreds of
1–2 px dots a frame, and a `fillRect` per speck with its own `fillStyle` and `globalAlpha` is a
draw call per speck. A `Path2D` per bucket is **worse** — building and tessellating a path of
1 px rects every frame costs 1.0 ms for 240 motes, against ~0.05 ms for the atlas.

The answer is `bakeSpecks(kinds, paint)`: one texture holding a cell per *(kind, brightness
level)* — `SPECK_LV` of them, ten — so `drawSpeck(atlas, kind, alpha, x, y)` picks the level by
alpha and the whole field draws from a single source with `globalAlpha` pinned at 1 and nothing to
change between calls. `MOTE_CV` has two kinds (a grain, and a bright one with its catch);
`STAR_CV` has six (three tints × plain/bright); `FLAKE_CV` has one per pixel size, because the
[snow](render-pass-order.md#snow) is sized by the zoom and at the widest rung there are 240 flakes in frame.
Quantising a twinkle to tenths is invisible on a 2 px speck.

## What this pass costs

Every one of these effects is **screen-bounded and reads nothing the sim writes** — the cloud and
ray passes fill the view and no more, `drawIceStars` walks only the visible tiles and the sky cells
over them, and every mote and star is culled against `WV_W`/`WV_H` before it is drawn. None of them
feed anything back: they are safe to cheapen, skip or reorder without touching a match — which is
exactly what the ESC panel's **VIDEO page** does: `settings.vidClouds`/`vidRays` gate their calls
in `renderLighting`, `vidStars` gates `drawIceStars` in `render()`, `vidSnow` gates
`renderWeather`'s draw (the sim still moves the flakes) and `vidVig` the frame vignette, so a
weak GPU sheds the whole dressing without touching the sim
([settings](../gameplay/settings.md)).

Measured against a build with none of these passes (one browser tab navigated between the two
servers six times, median taken, so the same GPU and thermal state measures both): **191 fps
without, 190 with — 0.03 ms per frame**. The tree atlas is what pays for it; on separate frame
canvases the same scene runs at 87 fps.

## The wind field

One field, in the `wind` banner of [js/sim/weather.js](../../../js/sim/weather.js), and everything the
weather moves reads it rather than keeping a clock of its own:

- `state.windT` is its clock, stepped in `updateFx` — the **sim** clock, not wall time, so
  `DBG.step` reproduces a gust, a shaft and a twinkle exactly. Every animated thing in this
  section runs off it.
- **The shared wind is three reads**, and anything new the air should move takes them rather
  than a clock of its own: `state.windDir` (which way), `state.wind` (how hard) and
  `windGust(tx, ty)` (the gust over that tile now). `windSway` below is what a pine makes of them.
- `state.wind` is the field's strength, 0..1: `windAmp()` **squares the daylight**, so the air
  goes still across dusk and is dead calm by full dark, and scales by the day's weather
  (`state.wx.wind`), clamped at 1. Two swells on coprime periods (`WIND_SWELL`, `WIND_SWELL2`)
  ride under that, so a day's air never settles into a rhythm.
- `state.windDir` is which way the air is running, −1..1 — one answer for the whole map, because a
  prevailing wind is a property of the day and not of a tile. `windVeer()` steps it beside the
  strength: a sine on `WIND_VEER` (47 s) overdriven into its clamp by `WIND_VEER_HOLD`, so the air
  holds a steady quarter for most of a swing and crosses the still middle in about nine seconds.
  That is what puts a stand of pines over to the left for a while, stands them up, then lays them
  to the right.
- `windSway(tx, ty)` is the signed **lean** at a tile, −1..1, where +1 is a crown thrown fully to
  the right — a lean, not a phase, which is what lets a gust lay every tree inside it the same way.
  It is a **sum of waves on crossing bearings**, not one wave: a single travelling sine over a grid
  is a marching corduroy — straight, evenly spaced, every tree at full lean — which is the one thing
  air does not look like. Its three terms are the lean, the rustle and the arrival:

  ```
  s = wind * gust * (WIND_LEAN * windDir + WIND_RUSTLE * ripples)
  ```

  The **lean** is the DC push: a stand inside a gust bends downwind and is *held* there while the
  gust is on it, then eases upright in the lull behind, which is the part you actually watch cross
  the treeline. The **rustle** is the crowns working about that lean, multiplied by the same gust,
  so a tree in a lull barely stirs while one in the front is thrashing — and it is small enough
  against the lean that a gusted tree stays downwind of vertical the way a real one does. What
  crosses the field:
  - **three ripples** (`WIND_R1*`…`WIND_R3*`), each its own bearing as a `(kx, ky)` in rad per
    tile, its own speed and its own share of the amplitude. Two run with the prevailing down-right
    air and the third cuts across it. Their amplitudes sum to **1.44**, deliberately past 1: three
    waves at random phase mostly cancel, so a set summing to exactly 1 leaves the forest
    permanently half-hearted. The result runs through a **soft knee** at `WIND_SOFT` — under it the
    lean is linear, over it a rational curve eases toward ±1 without reaching it. A hard clamp
    there would *freeze* the worst-hit trees at full lean, which is the one moment they should look
    busiest.
  - **one bend** (`WIND_W*`), a long slow wave folded into the *spatial phase* of all three
    ripples at once — phase modulation, the trick FM synthesis is. It meanders the whole rustle
    together, which is what turns the plaid a plain sum of sines gives into wandering fronts.
  - **a gust envelope**: two waves an order of magnitude longer than the ripples (~56 and ~66
    tiles against ~18) on crossing bearings, summed and smoothstepped, running between `WIND_LULL`
    and `WIND_GUST_PEAK` (the day's weather widens or narrows that swing, `state.wx.gust`); it is
    `windGust(tx, ty)`, the one piece of the field other systems read directly. The sum is what makes a gust a *patch* of field rather than a stripe of
    it; the smoothstep widens the calm between gusts and squares up their shoulders. Both ends are
    set against the **view**, not the world: a screen is barely wider than one gust, so the floor
    cannot sit near zero (a player parked in a lull would be watching a dead forest) and the peak
    deliberately overshoots 1 so the heart of a gust runs into the soft knee and lays those trees
    right over. Their wavelength is set against the view too — about two screens each, so the near
    trees are already over while the far ones are still standing and you *see* the front travel.
  - **the arrival**: those two envelope waves are not sines. They run through `wskew`, which folds
    a wave's own value into its phase and leans it forward, so at `WIND_SKEW` = 0.7 a gust spends
    ~32 % of its cycle arriving and ~68 % dying away. A wind gauge draws that shape and a sine does
    not, and the asymmetry is most of what separates *a front hit* from *the forest is breathing in
    and out*.

  Sampled over a view for a minute of sim, a tile averages **2.34 frames** off upright, **3.4 %**
  are thrown 8 frames or more over (the heart of a gust) and **36.8 %** are within a frame of
  standing straight up — the motion distributed as gusts and lulls rather than evenly. Under
  `WIND_STILL` it returns a flat 0 and every pine simply stands up.
- `treeFrame(tx, ty)` (js/draw/ground.js) turns that into an atlas frame. The pine's frames are a
  **ladder** of leans, not a cycle of phases ([sprites.md](../sprites.md)) — 0 thrown fully left, 23
  fully right, the middle upright — so the map is direct: `round(11.5 + sway * 11.5)`, **clamped**
  rather than wrapped, because at the end of its travel a crown stops rather than snapping back the
  other way. Off the tile's `hash2`, half the forest draws **mirrored** (the second 24 columns of
  the atlas — a mirrored tree's ladder runs backwards, hence the reversed index), and each tree
  keeps a **standing lean** of up to `TREE_REST` frames, which is what it is still wearing after
  dark; its palette row and its nudge are the tile's too ([the pass order](render-pass-order.md)).
- `wsin` is a 256-entry sine table, and it is why the field can afford to be six waves: `windSway`
  is read once per visible pine per frame and does eight lookups (the two skewed envelope waves
  cost two each), not eight `Math.sin` calls, and its answer is quantised to twenty-four frames, so
  a table is exact enough. The cost stays flat when a zoomed-out view is holding a thousand trees.
  Negative phases are fine — `|0` then `& 255` wraps them, at the price of a truncation a 256th of
  a cycle wide. Measured over 2000 tiles (about what the widest view holds), the field costs
  **0.084 ms a frame** — 0.5 % of a 60 fps budget, and this is the one number here that *is* safe to take from a headless run,
  because it is V8 arithmetic rather than the rasteriser.
- `windSweep()` is the **sweep**: every `SWEEP_EVERY` (15 s) the air lifts a little loose snow and
  drifts it slowly across the view — two or three faint streaks taking `SWEEP_T` (7 s) to cross,
  gone well before the next. A breath of wind, deliberately not a gust. It is an event on the
  field's own clock, not weather of its own: it starts on each multiple of `SWEEP_EVERY` of
  `windT`, blows the way the veer ran **when it set off** (held to the end, since the veer can cross
  still air mid-sweep and a streak must not jump sides), and is only as strong as `state.wind`
  (none under `SWEEP_MIN`) times the day's `state.wx.sweep`, so it fades out over dusk with
  everything else and blows only on an ordinary snowy day. `drawSweep` (the
  `wind's sweep` banner, js/draw/ground.js) draws it in the air, after the y-sorted pass and under
  the eagle and the night grade: each streak is a thin line of white drift and a shorter strand
  behind it, breaking into flecks at the tail and rolling gently as it runs, over a faint shadow
  **multiplied** a few px down-right — white on white snow says little, so the shadow carries it
  there and the white carries it over the woods. The streaks live in the **world**, never on the
  screen: the valley is cut into `SWEEP_CELL_W`×`SWEEP_CELL_H` cells, each sweep lays one or two
  streaks in every cell at a spot off the cell and the sweep's number (`hash2`, nothing rolls), and
  each drifts `SWEEP_RUN` px downwind from there at its own moment and pace, fading in and out
  along its run — so a streak stays put as the camera pans, and two players over the same field
  see the same snow blowing across it. A moving thing, it is placed off the exact camera
  (`ex`/`ey`). It costs well under a millisecond a frame while it is on and nothing otherwise.
- The **snow off the pines** reads the crest of `windGust`
  ([js/sim/shed.js](../../../js/sim/shed.js), the `snow off the pines` banner). The sim raises that puff and
  `burst` carries it to every screen, so it is a gameplay-side event with no pass of its own:
  each human in the match has `SHED_DRAWS` (36) random tiles a second drawn from about a view
  round them (a bot draws none, nothing is scanned), and a draw landing on a pine at
  `SHED_CREST` of the peak, while `state.wind` is at least `SHED_WIND`, sheds with a chance of
  `SHED_P` × `state.wind` after a random wait of up to `SHED_DELAY`, then rests `SHED_REST` s.
  At most `SHED_LIVE` gust puffs are in the air at once. The draws, the wait and the rest are
  what ripple a front through a stand instead of the whole stand letting go on one frame. A blow
  (the axe in `chopTree`, a shot the arrow loop's wall branch stops in a pine) always sheds, a
  few flakes more, whatever the rest or the cap. A puff is `burst`'s numeric `grav` (a slow fall
  with no toss) and `drift` (the wind's sideways px/s): a few white pixels opening off the crown
  and carried downwind as they fall.

## The day's weather

Every day of a match rolls one of four weathers (the `weather` banner, js/sim/weather.js) off the seed
and `state.day` with `hash2`, so every client that knows the day (the snapshot already carries it)
knows the sky, and the wire carries nothing new. `weatherOf(day)` names it off `WX_ODDS`; the
practice arena always gets `snow`. A weather is only a row of **dials** in `WEATHERS` that the
passes above already read:

| dial | read by | calm | snow | blizzard | frost |
| --- | --- | --- | --- | --- | --- |
| `snow`, the share of the flakes falling | `renderWeather` | 0.4 | 1 | 0.22 | 0 |
| `wind`, the field's strength | `windAmp` | 0.35 | 1 | 1.6 | 0.3 |
| `gust`, the envelope's swing | `windGust` | 0.6 | 1 | 1.35 | 0.6 |
| `sweep`, the 15 s sweep | `drawSweep` | 0 | 1 | 0 | 0 |
| `drift`, the ground blizzard | `drawDrift`, the haze | 0 | 0 | 1 | 0 |
| `frost`, the clear cold | `todGrade`, `cloudShade`, `drawFrostGlint` | 0 | 0 | 0 | 1 |

`state.wx` holds the dials in force, and **`weatherNow()` is how any other system reads them** (read-only; a reader that wants the wind takes `state.wind`/`windGust`, which already carry them). `stepWeather` (from `updateFx`, above the wind) eases them
from wherever they were to the new day's row over `WX_FADE` (5 s) on a smoothstep, so the dawn
that changes the weather fades it in; the first step of a page snaps instead, so a match opens on
its weather. **The air still dies at dusk under every row** — the dials scale `windAmp`, which
squares the daylight, so a blizzard's night is as still as any other.

- **The ground blizzard** (`drawDrift`, the `the ground blizzard` banner, js/draw/ground.js) is
  low, fast streaks skimming the snow, drawn on the ground under everything that stands. Laid in
  the world like the sweep's: a `BLOW_CELL_W`×`BLOW_CELL_H` grid, `BLOW_PER` streaks a cell, each
  on a loop of its own length (`BLOW_LIFE`), born at a spot off the cell and its loop's number,
  running `BLOW_SPD` downwind and gone. Its way is the veer's at its birth; its brightness is the
  field's strength times the gust over its cell, so a gust crossing the valley reads as a brighter
  band. Every streak is one `drawImage` off one baked atlas (`blowAtlas`, a row per length, way and
  pass). `renderLighting` also lays a milky `BLIZ_HAZE` over a blowing blizzard's frame.
- **The clear frosty day** has nothing falling; the cold is on the light instead. `todGrade`
  multiplies `FROST_TINT` over the frame and holds the noon crisp at `FROST_CRISP` from dawn to
  dusk, `cloudShade` loses `FROST_CLEAR` of its shadow, and `drawFrostGlint` (js/draw/light.js)
  flashes single-pixel glints on bare snow tiles (a `GLINT_CELL` world grid, brief flashes past
  `GLINT_SHARP` of a slow sine), stamped **after the night grade**, because white on the day's
  white snow says nothing and the night's blue is what makes a glint catch. It rides the ICE STARS
  toggle (`settings.vidStars`).

`DBG.weather('blizzard')` pins a weather (fading to it like a dawn; `DBG.weather()` hands it back
to the day), `DBG.wx` reads the dials and `DBG.weatherOf(day)` what a day rolls on this seed.

On a GTX 1060 at 886×498 over the treeline the whole pass is inside measurement noise of not
running at all — see [What this pass costs](#what-this-pass-costs). Do not profile this in a
software rasteriser: headless Chrome on SwiftShader reports the cloud multiplies as the dominant
cost, and on a real GPU they are nearly free while a texture change the software path does not
care about is worth half the frame.
