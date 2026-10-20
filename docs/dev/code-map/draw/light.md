# js/draw/light.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| one baked speck (mote, star, flake) at a quantised brightness, and the atlas behind it | `bakeSpecks`, `drawSpeck`, `SPECK_*` | `light & weather` › `specks` |
| drifting cloud shadows, and the tileable noise they are baked from | `cloudShade`, `cloudLayer`, `bakeCloud`, `pnoise`, `CLOUD_*` | `light & weather` › `cloud shadows` |
| whether the sun shafts are up at all (the drop window, and noon), and the shafts themselves | `rayLight`, `godRays`, `RAY_*` | `light & weather` › `god rays` |
| the ice's night mirror + the parallax stars in it, and the "is this pixel on unbroken ice" mask (the painted shore's, `iceAtPx`) | `drawIceStars`, `overIce`, `STAR_*` | `light & weather` › `the reflected sky` |
| the hour's colour grade (rose dawn, crisp midday, gold dusk: a warm multiply over a cool screen off keyframes on `state.time`, and the noon self-multiply) | `todGrade`, `todMix`, `todNoon`, `TOD_KEYS`/`TOD_CRISP`/`TOD_NOON*` | `light & weather` › `the hour` |
| a clear frosty day: its cool grade and all-day crisp (applied in `todGrade`), the cloud it clears, the glints on bare snow, and a blizzard's milky haze | `FROST_TINT`/`FROST_CRISP`/`FROST_CLEAR`, `drawFrostGlint`, `GLINT_*`, `BLIZ_HAZE`/`BLIZ_HAZE_A` | `light & weather` › `frost glints` |
| the night colour, snow (world-space flakes, see `fx updates`), vignette | `renderLighting`, `NIGHT_TINT`/`NIGHT_DEEP`/`NIGHT_DEEP_A`, `renderWeather`, `renderVignettes`/`vigCv` | `light & weather` › `the pass` |
| an open snowdrop's light, laid above every grade (its pool, bell, halo, twinkles and motes) | `litSnowdrops`, `litDrops` (filled by `render()`'s snowdrop branch), `SNOWDROP_POOL`/`SNOWDROP_SPECKS`, `SNOWDROP_*` | `light & weather` › `lit snowdrops` |
| the night RIM: the world-space vignette that closes the view in rather than dimming the middle | `nightEdge`, `NIGHT_EDGE`, `nvGrd` | `light & weather` › `the pass` |
| **text over the world, held back from the night grade** (a name tag, MERCH/PERCH, a damage floater, a sense mark), and **the frames over bodies, held back with it** (every bar, a player's and a beast's whole frame, PERCH's bar) | `drawWorldText`, `flushWorldInk`, `worldInk`, `inWorldLayer` (the world buffer or the air layer); `overheadPlate`, `flushPlates`, `worldPlates`, `platesNow`; the riders' names on a wing, the one text that never lands on another (ground names overlap): `drawNameTag`, `settleNameTags` (run by the flush), `TAG_GAP`/`TAG_CLIMB` | `light & weather` › `ink over the world` |
