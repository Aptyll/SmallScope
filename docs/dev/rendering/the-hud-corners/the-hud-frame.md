# The hud frame

`drawHudFrame(x, y, w, h, o)` is the one plate the strip, the pack and the team rail stand on,
drawn the way League's and Dota's HUDs get their contrast, kept simple (4.18): a dark outline
(`HUD_INK`), one faint line just inside it (`HUD_EDGE`, a step off the ground, kept apart from the drawer's amber and red states), and a
solid dark ground (`o.bg`, `AB_BG` by default). **The palette is neutral graphite** (0.421): the
cold steel line and the navy grounds it replaced pulled the eye off the game, so the frame is the
quietest thing on screen and the icons, the sides' colours and the gold carry the contrast. The
strip, the drawer, the rail, the practice bar and the tooltips share it;
the M map and the minimap wear it too (0.459), and the shop (0.484); the menus are still navy. The outline holds the plate apart from bright
snow at noon, the faint line finishes its edge against the forest at night, and the ground keeps every
well readable over both. No bevel, no snow, no ornament. The top corners are cut two pixels and
both lines follow the cuts; the corners that meet a screen edge stay square (a notch of world
there reads as a hole; `o.corners`). `o.lit`/`o.ink` are what a
widget's states colour (the drawer's full amber, a refusal's red): `o.lit` repaints the edge.
Every margin inside the outline is three pixels — line, edge, ground — which is what `AB_PAD` and
`BAG_PAD` are, so a well sits the same distance from the edge on every side of every widget. The
[drawer](the-backpack.md) wears it with only its two free (right) corners cut — it is flush with
the view's left edge.

**Three well sizes on the HUD**: the strip's ability wells are `HUD_CELL` (34) square, its item
and meal wells `ITEM_CELL` (24), and the drawer's cells `BAG_CELL` (18) with the art at 1× —
because a spare is glanced at and dragged, not read all match.

The whole widget — plate, wells and buy plates — draws at the size of its own dial, BOTTOM BAR SIZE
on the ESC panel's GAME page (`settings.hudScale`, default 1×). All geometry stays in 1×
strip space: at 1× everything draws straight to the frame, and at any other size `drawHudScaled`
bakes the widget into `hudScaleCv` and blits it scaled about the strip's anchor
with smoothing off, so the art scales nearest-neighbour instead of every fillRect going soft.
Every hit test (`stripHit`, `abBuyHit`) maps the pointer back through
the same anchor via `stripMouse` first, so a click can never land beside its pixel. **Each HUD widget
has its own size dial** (0.436: `hudScale` the strip, `hudCorner` the top-left drawer, `hudRail` the
team rail; the minimap keeps its radius dial, `mmR`). A dial's stops (`hudSizes`) are every 5%
(`HUD_FINE`) from `HUD_MIN` to `HUD_MAX` (0.5× to 2×) plus every **crisp** size (`hudCrisp`), one at
which a HUD pixel is a whole number of canvas pixels: a 2× canvas's are 50 / 100 / 150 / 200, a 3×
canvas's 67 / 100 / 133 / 167 / 200. A 5% stop within half a step of a crisp size gives way to it, so
the knob lands crisp near where it is dropped, and the crisp sizes are ticked under the track. Between
them some pixel rows draw one canvas pixel wider than others, the price of any size at all. No dial
stops past the size where its widget would outgrow the view (`stripCap`, `cornerCap`, `railCap`,
through `hudFit`); the track past that is sunk. `hudPick` draws a stored value at its nearest stop,
which also carries a setting across to a screen with other stops; `hudSc()` is the strip's size,
`cornerSc()` the corner's, `railSc` the rail's, and a bake and its size land on the device grid
(`hudPx`). **The top-left corner
scales with its own dial** (BACKPACK SIZE): `drawCornerScaled` bakes the drawer's tab and the drawer at 1× (`drawCorner`)
and blits them about the top-left corner (sized by `CORNER_REACH` and the open drawer), and
`bagHit` maps the pointer back through `cornerMouse`. While the slider's knob is in hand,
`renderSettings` draws the strip and the corner live over the slab — the minimap slider's
preview grammar.

The strip's **upgrade** half is entirely the floating buy plates above these wells — a skill
point is spent nowhere else, and nothing else on the strip is ever bought.
