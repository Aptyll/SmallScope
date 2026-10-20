# Trampled snow

Visual only (js/draw/trample.js). A grid of 4 px cells over the world holds how **packed** and how
**churned** each patch is. `trampleStep` looks at every body on the snow each frame the world moves
(players off the eagle and off a zipline, every animal but a bird, every robot off a zipline) and stamps a disc
the size of the body every `TR_STEP` px it travels: a walk packs `TR_WALK`, a slide and a crawl
their own amounts (read off `p.sliding`/`p.prone`, the same state the footprint emitter reads), a
roll or a knockback past `TR_SHOVE_V` churns, and a drop in hp or a body going down churns a wider
disc. It reads only what a client already draws (positions, hp, `kbx`/`kby`), so it runs on every
peer and nothing goes over the wire; a jump of over 40 px (a landing, a respawn) stamps nothing
between.

Fresh snow refills every cell **linearly**, the way snowfall fills a hollow: `TR_FILL` a second at
light snow (`TR_SNOW_LIGHT`), scaled by `trampleSnowfall()`: the day's falling snow plus its ground
blizzard off `weatherNow()` (see [the day's weather](../rendering/drawing-a-thousand-of-something.md#the-days-weather)), so a clear frost day refills at 0.3x and a snow day
or a blizzard at ~2.3x; churn refills `TR_FILL_CHURN` times faster. At light snow one pass (~0.1) is
gone in about ninety seconds and a hard-packed route (1.0) lasts a quarter of an hour of no traffic.

Each pixel asks what it stands on, the way the bake painted it (`trMask`): snow packs through three
pressed shades and throws clods where churned; **ice** is the lakes' dust layer's to
show: it reads `trampleAt(x, y)` per pixel and thins under it, and
`trDustSync` hands it (`iceDustInvalidate`) the lake tiles whose trample moved, so the dust comes
back as the trample refills - on a build without that layer, ice takes sparse frost scuffs instead; open water, the creek, its deck and the road's earth
take nothing. The footprints and slide trails draw over it as the crisp detail.
