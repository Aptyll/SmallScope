# Working on sprites

How the ASCII-grid sprite system works and which sprites share grids with which. Read this before
editing anything under [js/sprites/](../../js/sprites/) — the shape of a sprite file, and which
file holds what, is at the end.

Sprites are literal ASCII grids paired with a palette object mapping character → hex (or `null`
for transparent), baked by `bake()` at load. Left-facing variants are `flipH()` of the right ones.
Character sprites are 16×16 in the world — detail goes into the 48 px model
([Looks](#looks-a-character-on-the-class-body)). The one exception is the IRON SCOUT skin (below),
the first step of Noah's move to a 32 px base: a body twice a player's height, drawn for the
local player only and over an unchanged sim body. The raider set
(`SPRITES.raider`, `RDPAL`) is baked from the exact same grids as the player, so a player pose
edit changes both — but nothing reads it (dead, [Intentional dead code](checklists.md#intentional-dead-code)).

**The tiered structures** use the same trick: one grid each (`wall` and `generator` 16×16,
the turret three 32×32 timber bases — **The turret is half grid, half raster**, below)
baked with `WPAL` / `WPAL_STONE` / `WPAL_GOLD` — a grid edit changes all three
tiers, and the palettes share the extra `k`/`K` (iron fitting) and `e` (glow) chars, which is also
what a building's team paint rides on (see below). A sprite too tall for a 16×16 wheel wedge gets
a dedicated icon grid baked into `teamBuild[team].icon` (the turret's and the bay's).

The **bot bay** (`spawner`) is the one big sprite: a single-tier 48×38 grid (`bay`, `BAYPAL`) on a 3×2
tile footprint — steel plates under a flat two-row snow cap, a team-painted lintel band (`L`/`T`/`t`
via `bayTeamPal`), riveted flanks with a grille and hazard stripe, and a 20-px dark doorway (cols
14–33, rows 13–35, floor row 36 — `drawBayOverlay` in js/draw/structs.js clips to it). Its 16×16 wheel glyph is
a separate grid, `bayIcon`, exported as `teamBuild[team].icon.spawner`; the 16×16 `spawner` grid
baked as the flat `SPRITES.spawner` is dead (nothing reads it).

The construction stages are one shared `scaffold` set (`[posts, frame, lattice-overlay]`, `SCPAL`),
and the worker bot is one 12×10 grid on `BOTPAL` (`botA`/`botB`: a faceless boxy chassis with
stub arms sitting on a single full-width tread, the two frames differing only in the tread
notches). The body chars `L`/`T`/`t` are the team paint (`teamRobotPal` → `coatL`/`coat`/`coatD`),
so `robotTeam[team]` is the whole bot in that colour; `drawRobot()` bobs the entire sprite while
driving and adds the tool swing and the carried nugget in code.

**Prone is a fifth pose direction**, a `prone` key sitting beside `down`/`up`/`right`/`left` in
each class's set (`champ[c][team].prone[dir][frame]`, three frames a direction: settled and two
of the crawl). The body lies **across** the 16×16 cell rather than standing up through it, so a
player's ground contact stays where the standing feet were and the y-sort never jumps when they
drop — foreshortened, not shrunk: twelve rows head-on to the standing sixteen, eight deep and
fifteen long side-on. Everything about the read is segmentation (boots, split calves, thighs
widening into the coat hem, elbows out past the shoulders to the full width of the cell, a small
head at the front), because pants sit a shade off the outline colour and an unsegmented lower body
just reads as a dark brick. The crawl frames alternate the reaching arm **and** the drawn-up knee,
since a belly crawl hauls with one arm and pushes off the opposite leg; the 1 px inch forward
between them is applied by `drawPlayer`, not baked into a second set of grids. The skater's set
swaps the pom hat for her hood, the eye for the goggle band, adds the trailing scarf and shows the
blade as a plate under each boot.

These are the one place `bakeSpan()` is used instead of `bake()`: it attaches `spans`, the per-row
`[firstX, lastX]` of painted pixels computed straight off the char grid, and `flipH` mirrors that
array with the canvas. The game's snow cover reads it to size the mound to the pose
([rendering.md](rendering.md#snow)) — which means editing a prone grid updates the
cover for free, and there is no canvas readback anywhere in the feature.

**The fish catch is three more DOWN frames** in every class set - `catch: [stoop, haul, hoist]` beside
the four directions and `prone`, baked by `catchSet` from `catchStoop`/`catchHaul`/`catchHold` (the
skater's `skCatch*` on her body plan) through the class palette plus `CATCHPAL_EXTRA`, the fish's own
letters (outline, two blues, belly, eye, a flying drop) so the catch keeps its colour under either
team's paint. The hoist is **16x20**: four rows of fish above the hat on the same feet, which is why
`drawPlayer` draws every frame at `ay + (16 - spr.height)` and lifts the overhead stack 4 px while it
is up. Look A off `docs/media/concepts/fish-catch-concepts-1.png`; which frame shows and for how long
is `catchFrame` / `CATCH_T` in [js/tools.js](../../js/tools.js) - [fishing](world.md#ice-holes-and-fishing).

## Looks: a character on the class body

A **character** ([profile.js](architecture.md#profilejs)) is a look — `sex`, `tone`, `hair`,
`hairCol`, `beard`, `face`, each an index — on a class body, and it is drawn at two sizes from one
set of tables. `SPRITES.LOOK` (characters.js, the `looks` section) is the one list: six skin
tones (`k`/`K`/`x`), eight hair colours (`h`/`H`), and per hair style a **fringe** — two
six-wide masks over the first face row and the row under it. **At 16 px only the tone and the
fringe read**: `champLook(cls, look, team)` rebuilds the class set through `lookPal` (the tone
and hair letters swapped in) with the fringe cut into the front and side walking frames by
`fringed` (mask chars replace *skin* pixels only, so a hat or hood is never painted on; the
pom-hat body shows six pixels under its brim, the hood four), and caches the set per
(class, team, tone, hair, colour) — ten players and a menu is all that ever asks. Every reader
of a body goes through `classSet(p)` (player.js), which asks it. Body type, beard and face
never touch the in-world body: it stays 16×16 permanently, and they read on the 48 px model only.

The **48 px model** ([looks.js](../../js/sprites/looks.js), `SPRITES.portrait(cls, look, team,
bare)`) is where the whole look reads — the create screen, the roster and the lobby's
stage. It is **layers stamped in order** onto one 48×48 canvas: `BODY[sex]` (24 wide at x 12:
neck, shoulders, arms, undershirt `u`, pants, boots), `HEAD[face]` (16 wide at x 16: round,
square-jawed, narrow — eyes `W`/`e`, nose shade, blush, mouth), `BEARD[beard]` (none, stubble,
short, full — `h` only inside the face, rimmed only where it hangs past the chin),
`HAIR[hair]` (20 wide from row 4: a shared crown, then the style — crop, side part, long to the
shoulders, bangs, spiked, bald is `null`; hair rows over the face carry no inner outline, so the
head's own rim stays), then `OUTFIT[cls]` over everything (the hunter's pom hat and trimmed
coat, the warrior's fur-lined hood with goggles pushed up and a scarf collar; the same
`r`/`R`/`d`/`t`/`T`/`m`/`M` letters as the 16 px body, so one team palette paints both
sizes). The hats stop at row 8 and the hair's fringe rows sit at 9–10, so hair shows under a
brim; long hair runs down beside the neck to where the coat begins. The file asserts every
table's length against `PROFILE.LOOK_N` / `CLASS_N` at load, so a new choice is added in
profile.js and here together or the game refuses to boot. The model is front view only (the
in-world body, which turns, stays the 16×16 set). A new class needs an `OUTFIT` layer
here ([checklists](checklists.md#common-changes)). `portrait` keeps what it composes in a cache
the create screen fills quickly — a cell per choice per row, refreshed on every pick — so the cache
is emptied past `PORTRAIT_KEEP` (512) rather than growing with every roll of the die.

`docs/media/concepts/model-concepts-1.png` (A BUNDLED, B LANKY, C STOUT) is a **rejected**
concept round for this model, kept as the record of what not to draw again.

**Team colours are palette swaps of those same grids.** `TEAM_SKINS` (two presets, RED and BLUE,
also exported as `SPRITES.teams` so the game code can read the names and marker colours) drives
five baked sets — the four below plus `eagleTeam[team]`: the drop eagle's three flap frames with
the torso band (the rows the head sits in, which hold still across the frames) re-lettered by
`armorize()` to plate/helm chars and baked in team colour, so the armour recolours only pixels
the bird already has and the silhouette is untouched (`eagleFlash` is the same trick in all
white, for the downed objective's hit flash):

**The presets can be repainted live.** `TEAM_PALETTES` holds four versions of the pair (`def`,
and `rg`/`by`/`hc` for colour-blind eyes, picked by `settings.teamPal`); `TEAM_SKINS` holds the
one in force. Every file that bakes from it registers its team bakes with `SPR.onTeams(fn)`,
which runs them at load and again when `SPRITES.setTeamPal(id)` copies a palette into the two
`TEAM_SKINS` objects in place (about 9 ms). The bakes fill the same arrays each time and the
look and portrait caches are cleared, so every reader of `SPRITES.*`/`TEAMS` sees the new paint
on its next frame. A new team-painted set must bake inside an `onTeams` callback, or it keeps the
colours it was born with.

- `playerTeam[team]` — coat/hat/trim swapped; `SPRITES.player` *is* `playerTeam[0]` (the repaint re-points it).
- `teamBuild[team][type][tier]` — the tier material with the `k`/`K`/`e` accents repainted, so
  tier still reads as tier.
- `robotTeam[team]`.
- `merchant[team]` — the eagle's driver ([the merchant](gameplay.md#the-merchant)), below.

A new character or building sprite has to be added to those bakes, not just to the flat `SPRITES`
entry, or it will not wear a team's colour — and every read indexes by `skin(team)` (the
CLAUDE.md hard rule), never the bare team.

**The war eagles** (`warbirds.js`) are the drop bird's cosmetic skins and have **no grids**: each
is flat plates in bird space (x forward, y toward the right wing, z up), seen from above, one cel
tone per plate from the way it faces a fixed light, filled at 4× and shrunk to whole pixels, then
given inner lines, lit edges and one ink outline. `frame(id, team, heading, beat, size)` paints a frame
at one of 64 headings, so the bird is never rotated on screen, and the helm's walls draw only
while they face the camera (the visor toward you, the back of the helm away). Level flight
beats `stroke`, one smooth shallow stroke in `STROKE_N` phases (`flight(id, team, heading, phase)`;
the upstroke reuses the downstroke's poses); the stoop, the flee and the roost use
the three harder `BEATS`. `pose` lifts and dips the tail with the wing. Frames
paint at `FLY` in the air and `REST` (today's bird's footprint) at the roost, on first use or
ahead of it (`warm`/`warmFlight` queue, `tick(ms)` paints within a budget; about 11 ms each) and
the least recently drawn go past `KEEP`; `shadow` and
`flash` wash a frame into one scratch canvas each, and `reach` measures how far it stands up and
down from its centre (the roost's hp bar). The team plates read `TEAM_SKINS`, so the cache clears
in an `onTeams` callback. `LOOKS` says what each wears by its `BIRD_SKINS` id (eagle.js, with the
name and price), and `SPRITES.birdSkinIcon` gives the skins screen the wingbeat (spread, mid, back, mid) nose-up at a
card's size, cropped to one box. The plates were designed in the concept round's Python, kept in
the project files, not the repo.

**The merchant** has its **own grids**, `merchDown`/`merchUp`/`merchSide`
plus `merchFeet` — **16 × 18**, two rows taller than a player — an old trader in a wide flat
**fur hat** (`f`/`F`, twelve wide, the silhouette) with a **team-cloth crown** (`y`/`Y`, the one
team ink and all of it), a white **beard** (`w`/`W`) down the chest, a khaki wool coat
(`r`/`R`/`d`) hanging straight to the hem, boots under it, three frames a direction (the boots
walk, the coat hangs; the side grid faces right and flips), under `merchantPal`. It is look **D**
off the concept sheet in `docs/media/concepts/merchant-concepts-2.png` (the `concept-art` skill
in `.claude/skills/` is how a sheet is made and picked). Nothing on it is a player's coat or hat,
so the side reads off the crown, the nameplate and the bar (no prone poses — it never lies down).

**The merchant's stall** (`stall` in js/sprites/buildings.js, baked per side inside `SPR.onTeams`
as `SPRITES.teamBuild[skin(team)].stall` under `stallPal`) is **48 × 38** over its 3×2 footprint:
a snowy awning in the side's stripes (`y`/`t`, the one team ink) over two shelves of goods, a
lantern, a scale and a planked counter. It is look **D** off
`docs/media/concepts/tent-concepts-2.png` (round 1, `tent-concepts-1.png`, picked the market stall
shape; round 2 grew it).

**The gate** (`gate` in js/sprites/buildings.js, baked per side and tier inside `SPR.onTeams` as
`SPRITES.teamBuild[skin(team)].gate` under `gatePal`, the tier palette plus the side's coat as
`y`/`Y`/`t`) is a 16 × 16 wall piece: a snowy beam on two posts with the grille hauled up under it in
the side's colour and the passage open below. It is look **C**, "raised portcullis", off
`docs/media/concepts/gate-concepts-1.png`.

**The swing tool icons** (`itemBow`/`itemAxe`/`itemPick`) are 8×8 grids sharing `AXPAL`, drawn at **1×** by
`drawHeldTool()` (inside a translate/rotate, resolved through `SPRITES[t.icon]` from the
`SWING_TOOLS` table) and by `drawRobot()` for a bot's swing — E picks the tool, there is no tool
bar. At rest `drawHeldTool()` draws the **weapon on the selected slot** instead, which is a 12×12
`toolArt_*` canvas baked in [js/tools.js](../../js/tools.js) rather than here; both sizes go
through the same code because the icon is centred on its own half-width.

The **gear icons** are twelve 12×12 grids, **one per variant** (`gearLongsight` … `gearGhoststep`), each baked once per
**material** — `GEAR_MAT_PALS`, leather → iron → steel → gold, plus the shared accent chars `w`
(ice-white) and `r` (hearth-red) — into `SPRITES.gearIcons[slot][variant][material]`: the glyph
says which piece, the material says its level. Drawn by the HUD's gear plates; the hero pop-up's wells wear the detailed 32×32 `GEAR32` set instead
(js/ui/menu.js — see [gameplay.md](gameplay.md#gear)). `itemBag` is
12×12 for the same reason — it sits in the same 18 px HUD well — but shares `ITPAL` with the
8×8 item icons rather than taking a material palette: it is one object, not four levels of one.

The five **roguelike card** icons are one card back — the full 8 px of height, lit along its top
and left edge (`L`), shaded along its bottom and right (`c`), inside a dark rim that holds it off
white snow — in the rarity's colour (`C`, the same five hexes as `RES_COLORS`), with the rarity
**counted** on it the way a die counts: one pip on White, two on Green, three, four, five on Gold
(`E`, dark on the pale White card and white on the rest). The count is what tells the five apart
under any palette, so colour is never the only thing carrying a rarity; Purple and Gold also throw
a glint off the corner (`x`). `itemCards` holds the five grids (the pips differ, so they are five
grids on one `CARD_PAL`, not one grid swapped five ways), baked as `itemCardWhite`…`itemCardGold`.
The strip's card button fans three of those same icons (`cardFanCv`, js/ui/hud-draw.js).

**The pine is twenty-four bend frames of one tree**, and the first of the imported sprites — the
others are the gold sack, the three animated goods and both prey, below:
`treeSway` is `docs/media/new_media/001.png` cropped to **27×37**, snapped onto
`TSPAL` (fourteen colours, `bake`d like everything else), and then **sheared** into its other
frames. It draws at
`(px - 5, py - 21)` with its trunk on the tile's centre line, and **through `SPRITES.treeAtlas`,
never through `SPRITES.tree`** (the one-texture rule;
[rendering.md](rendering.md#drawing-a-thousand-of-something)).

The array is a **ladder, not a cycle**: index 0 is the tree thrown fully left, 23 fully right, 11
and 12 are it standing up. A frame here is a *lean*, so `treeFrame` maps the wind's signed sway
onto an index directly and a gust lays every tree inside it over the same way. The shear is a **tip-loaded cantilever** rounded per row: a row `h` of
the way up from the base moves `2.6 * (3h² - h³) / 2` px, which is zero slope where the trunk meets
the snow, all of the curve in the crown, and 6 px of travel at the tip end to end. Rows cross their
rounding thresholds at different heights, so 21 of the 24 frames are distinct pixels.

Every frame being the same tree, each atlas row holds **forty-eight**: the 24 again, mirrored, with
the tile's `hash2` sending half the forest into them. `TPAL` above it stays: it still dresses the
`stump` a felled pine leaves.

**No pine draws in `TSPAL` as is: it is the source of nine palettes** (`treePals`), one atlas row
each (row = variant × 3 + tone), filtered in OKLCH at bake time rather than drawn. The drawn pine
ran from a near-black outline to near-white snow, which read as a foreground object; the three
**variants** Noah picked from `docs/media/concepts/tree-filters-2.png` lower that contrast and keep
the colour, because a desaturated pine turns to mud under the night grade (round 1,
`tree-filters-1.png`, is the grey version that was turned down). **B** gives the outline a dark
muted green, lifts the needle darks to an L floor of 0.40 and brings the snow down to a soft
blue-grey band; **C** adds a hue shift by value (shadows toward teal, lights toward yellow-green);
**D** takes C to 80% colour and mutes the trunk. Each comes in three **tones** by forest depth
(`TREE_TONES`, a needle L shift): the deep is the filtered look itself, the ring inside the edge
+0.035, the edge +0.07 — nine pines in ten stand deep, so darkening the deep instead would darken
the whole forest. Which row a tree wears is decided on its tile at draw time
([rendering.md](rendering.md#render-pass-order)). `SPRITES.tree` is variant B's deep row.

Which frame a tree is wearing is decided by the
wind, not here - [rendering.md](rendering.md#the-wind-field).

**The gold sack is the merchant's mark.** `SPRITES.goldSack` is
`docs/media/new_media3/bag_of_gold_bouncing.png` — a 320×32 strip — split at 32 px into the ten
frames of `sack` and snapped onto `SACKPAL` (twelve colours: an outline, five cloth, two cord,
three coin, one shine). Unlike the
pine the **source order IS the animation order**: it was drawn as a loop, and the cloth barely
moves while the coin in the neck of the sack glows, so the cycle reads as light catching gold
rather than as a bag being jostled.

Its only caller is the market plate
([the plates](rendering.md#notices-the-plates-under-the-minimap)), HUD chrome where **16** is
the size that reads — so the 32 px source was **resampled offline to 16×16** and snapped onto
`SACKPAL` before it ever reached this file. It sits in the same sunken well as the hand-drawn
crate below and has to be as crisp as one.

<a id="the-offline-resample"></a>
**Everything imported is resampled OFFLINE, never halved at load.** The sheets in
`docs/media/new_media3/` are drawn much larger than the game wants them — a bunny frame is 32 px
tall against a 16 px player — so the pass that produced these grids scaled each frame to the size
it ships at, then **snapped every pixel onto the subject's own palette and every edge to hard
alpha**. Two rules come out of that and both matter:

- **What is written in this file is what draws.** `bake()` paints every grid 1:1, so editing one
  character changes exactly one pixel in the game — the same contract every hand-drawn grid here
  has always had.
- **No sprite in the game has a soft edge or an off-palette pixel.** A downscale at load (an
  alpha-weighted average) fringes every edge with half-transparent pixels and invents colours
  the palette never had, which reads as blur against hard-edged art at a whole-number zoom.
  Nothing bakes at anything but its own cell size.

**Three item icons are loops rather than stamps**, all three off 16×16 strips and all three
shipped at the **8×8** every other item icon is, so what changed is the art and not the fit. The
gold and the fish are resampled from `docs/media/new_media3/`; the **berry is drawn by hand**
from `docs/media/new_media4/new-berries-spritesheet.png`, because a 2×2 average of its
four-berry cluster is mud. It keeps the sheet's colours and its leaf timing (up, soft, mid, flat,
flat, mid, mid, up), and its body holds still: the sheet's one-pixel dip would be half a pixel
at 8×8.

| icon | source | frames | palette | the loop |
| --- | --- | --- | --- | --- |
| `itemGold` | `gold_nugget.png` | 8 | `NUGPAL` (14) | a shine crossing the face |
| `itemBerry` | `new-berries-spritesheet.png` | 8 | `BERPAL` (8) | the two leaves flapping |
| `itemFish` | `fish.png` | 8 | `FIPAL` (10) | the fins working |

The **fish is the one whose palette does not match its sheet**: it arrived salmon and `FIPAL` is
**hue-shifted** to the cold blue everything else about a fish in this game already is — the
market's fish line and price graph, the pickup floater, `RES_COLORS.fish` (`#7ac0e8`) — because a
pink icon under a blue number reads as two different goods. Every entry keeps its **lightness**,
which is what carries the shading, and lands in a tight band around 205°; only the cream belly is
hand-nudged, because the source told its two bellies apart by hue at equal lightness and one hue
cannot carry that. `fish.png` itself is untouched, so a regenerated grid set needs the shift
reapplied — the grids are the sheet pixel for pixel, the ten colours in `FIPAL` are not.

They are exposed as **live canvases**, and that is the whole trick. `SPRITES.itemAnim[key]` holds
the frames; `SPRITES[key]` is one canvas per icon that `stepItemIcons()` (js/draw/render.js) stamps the
current frame into, once a frame, before anything draws. So `SPRITES[ITEMS[type].icon]` — how the
bag, a shop price, a sale row, a drop on the snow, a tooltip and the wiki all reach an item icon —
stays **one generic read**, and no call site has to know which three goods move. Handing those
reads a frame array instead would mean teaching every one of them about three special cases; the
three are not special, they are icons that happen to move. One clock drives all of them
(`ITEM_FR`, 100 ms), so every berry on the screen is on the same beat — a dozen icons each looping
to their own is a fruit machine, not a HUD — and a frame that has not changed is not redrawn.
Each canvas starts on frame 0, so a panel that bakes an item icon into a still image at boot (the
control primer) gets a picture rather than a hole.

**The crate is the other mark on that plate, and it is hand-drawn.** `SPRITES.crate` is the 16×16
`crate` grid on `CRATE_PAL` (five colours: an outline, plank in shade and in light, the pale X of
bracing, and the top rail's highlight), drawn by hand at the 16×16 it ships at rather than
resampled down from a sheet. It stands in the sack's place
on the plate whose news is a **turnover** rather than a price (`NOTE_KIND.stock.mark`,
[the plates](rendering.md#notices-the-plates-under-the-minimap)): same 16×16 stamp, same
sunken well, so the column reads as one column whichever kind lands in it.

**The turret is half grid, half raster, and it is THREE grids.** Its base is timber at every
tier — the upgrade is more of it, never a change of material — so unlike every other tiered
building it does not reuse one grid under three palettes. `turretT1`/`turretT2`/`turretT3`
(`turretBases`) are **32×32** each: a **sawn stump**, the **same stump carved**, and a **carved
pedestal** that has left the forest behind. They are baked through three timber palettes of their
own (`TUR_PALS`: pine, oak, tarred oak).

**The SILHOUETTE carries the tier, not the detail**, because at 16 px a tier has to read from
across the snow before any of its carving does. Tier 1 **tapers** to roots with gaps between them;
tier 2 is **straight-sided** on its roots under a snow rim; tier 3 is an **I** — a wide cornice on
two painted corner posts, a narrow shaft, a stepped plinth, and no roots at all. They widen with
it too: 16, 18 and 20 px on a 16 px footprint.

**And the turret wears more of its side than any other building**, because it is the one piece
that shoots back. `turretPal` extends `teamBuildPal`: besides the shared fittings `k`/`K` and glow
`e`, the grids carry the side's **coat** as `y`/`Y`/`t` (the gate's own three letters) and its
**mark** as `m`, the brightest ink a side owns — so every tier has a painted band with its own
emblem cut into it, and the flat `SPRITES.turret` set is baked through team 0's palette so none of
those letters can come out transparent.

The top 16 rows of each are deliberately empty: that is where the **sling** goes, and the sling is
not baked at all. `drawTurretHead()` in js/draw/structs.js rasterises it pixel by pixel at the live
bearing and dilates the result into a 1px dark rim, exactly as the arrows do, because a baked grid
would lock the fork to one angle. The pivot is sprite-local **(16, 12)**, just above the collar.

**The sling is a part table, not a wall of loops.** `SLING` is one row per piece — `k` its shape
(`ell`/`box`/`seg`/`dot`), `c` its ink role, `mir` mirroring it across the throw's line so one
row draws both arms, `when` naming a state flag it needs, and `from` the first **tier** it appears
at — in sling-local px: `f` **along** the throw (0 at the pivot, + toward the mark), `s` **across**
it (− to the left, the lit side). A coordinate written as a *string* is read out of the frame's
state instead (a leading `-` negates it), so the whole animation **and the per-tier geometry** are
the numbers `slingState()` works out and the table itself never moves.

`from` is the whole of how the three forks differ: tier 1 is a bare stick, tier 2 binds and paints
it (an iron rim round the deck, a collar on the stanchion, a wrap halfway up each arm), tier 3
ties and crowns it (the rim carried round the back, deck studs, the side's mark on the wraps, a
lashing's loose end, and a carved finial past each tip). The fork also grows: its reach is
**`TUR_MOUTH` (12 / 13 / 15 px, js/structures.js — the row the SIM reads for where the rock
leaves)**, so the arms can never be drawn anywhere but where the stone actually goes, and its
spread is `SL_FLARE` (7 / 7 / 9). `slingInk()` resolves a role against the tier's timber
(`SLING_WOOD`, which climbs with `TUR_PALS`) and the side's palette. Retuning the fork is editing
a row; adding a piece is adding one.

Two knock-ons: the sprite is wider than its one-tile footprint, so the draw pass centres it (`sx`
in the structure branch of `render()`); and a 32px sprite is too big for a radial-wheel segment, so
`turretIcon` (a 16×16 sling on a post, the same silhouette as the SLING a player carries) is baked
into `teamBuild[team].icon.turret`, the same escape hatch the bay uses.

**Wildlife is side-view only, and its frames are named CLIPS.** `SPRITES[kind][dir]` is an
**object**, not a flat list: one array per behaviour, every kind carrying at least `idle` — the
frame anything asking for "the beast" takes (the wiki's cards read `.right.idle[0]`). Which clip
is playing is the animal's business, not the sprite's: js/wildlife.js sets `a.clip` from what the
beast is doing (`ANIM_CLIPS`, [gameplay.md](gameplay.md#what-a-beast-is-doing-the-clips)) and
`clipFrame` in js/draw/bodies.js plays it. `bakeClips` builds a set and `mapClips` walks one — the
mirror for `left`, the bears' `right` below.

The **rabbit** and the **deer** are imported: three sheets each out of `docs/media/new_media3/`,
snapped onto `RBPAL` (eleven colours) and `DEPAL` (thirteen), source order the animation order.

| kind | clips (frames, and the sheet each came off) | source cell | **ships at** |
| --- | --- | --- | --- |
| `rabbit` | `idle` 10 `bunny…gently_look_around`, `hop` 6 `…hopping_right`, `rise` 8 `…stand_up_and_wiggle` | 28×30 | **11×12** |
| `deer` | `idle` 10 `deer…gently_look_around`, `graze` 12 `…grazing_loop`, `run` 12 `…galloping` | 38×38 | **19×19** |
| `wolf` | `idle` 1, `run` 2 | — | 16×13 |
| `bird` | `idle` 1 (perched), `fly` 2 | — | 9×6 / 9×5 |
| `dire` / `alpha` (the bears) | `idle` 6, `walk` 8, `run` 6, `bite` 10, `paw` 10, `roar` 8, `fish` 12 | a painted rig | 56×38 |

Both are [resampled offline](#the-offline-resample) — at its own cell size the bunny stands taller
than a 16 px player and the stag more than twice one. The **rabbit ships at 11×12**, deliberately
shy of half its source: a bunny the height of the hero read as a hare the size of a dog, and the
stag beside it is the animal that is meant to look big. Each kind's three sheets share **one
crop** — the box every frame of every clip fits inside — because a clip taking over on a different
crop would jump against the one it replaced. The deer keeps its whole 38×38 cell (the gallop
reaches column 0, the graze column 37); the rabbit is trimmed to 28×30, which still holds the ear
tips the hop throws up.

The wolf and the bird keep their hand-drawn grids (a shared `wolfBody` plus three leg rows per
frame; `birdPerch` plus two wing frames): an idle and a two-frame gait. Left variants are `flipH`
of the right-facing frames.

The camps' two [bears](world.md#camps), the brown (`dire`) and the black (`alpha`), live in
js/sprites/bears.js and are **generated, not typed**: `app/bake-bears/bake.py` (Python with numpy)
paints a bear as shaded ellipse parts, poses them as a cutout puppet (IK legs, body tilt, head,
jaw), renders each pose at 8× and shrinks it to the game's pixel, banding the shade into the
palette measured off Noah's reference sheet. The black bear is the same frames recoloured,
wearing its antlers and back runes as exact 1× stickers on their bones. Both are drawn facing
left, so `right` is the `flipH` there, and every frame of both shares one 56×38 box, centred on the standing bear, so the feet
never jump between clips. The box's headroom is for the rear-up; each frame carries `top`, the
empty rows over the standing head, where `drawAnimal` hangs the tells, and `crown`, the empty rows
over that bear's tallest pose in any clip (bake.py measures it per bear on every rebake), where the
frame sits, still, so a rear-up or any new clip never climbs into the bars. The
paw's claw trail and the bite's snap are baked into their frames (`SM`/`SD`, white slashes with an ink edge), and so is the
`fish` clip's catch (`FISH_PX` in bear.py, `FL`/`FM` silver inked in `SD`). Change the rig and rebake; never edit the grids.

The **IRON SCOUT** scout skin (`SPRITES.robotSkin`, js/sprites/robot.js) is generated the same
way by `app/bake-robot/bake.py` (Python with numpy and pillow): rig.py paints a lean robot as
flat-shaded facets (one tone per plane) on a 3D-jointed puppet, projects him through the game's
35° camera and bands him into his palette, the chest and scarf in team paint (`L`/`T`/`t`/`x`,
baked in `SPR.onTeams`). Per facing an `idle` (breathing, one blink) and a `run`; `right` is seen
a little from the front so the lamp eyes stay on screen, and `left` is its mirror. Every frame
shares one 22×38 box centred on the body, with `top` (rows over the head) and `foot` (the soles'
row); `icon` is the rig at its full 64 px for the skins screen's card. He stands about 32 px
tall, twice a player, but his hitbox is the player's: `drawPlayer` swaps him in for the class
body while upright (`scoutBody`, js/ui/skins.js), and grows the held tool and an ability's marks
2× about the feet to fit him. Lying down and the fish catch still show the class body.

The three camp props are
`deadTree` (two 16×24 snags on `DTPAL`) and `den` (A ROCK MAW of [den-concepts-1.png](../media/concepts/den-concepts-1.png): a 32×21 snow-capped boulder cave with icicle fangs over its mouth, on `DNPAL`, drawn at `py - 4` over its two tiles — the concept's trampled-snow rows were left off, because a decal must not cast a shade) and `hogHut` (eight 35×35 frames of the HOG HUT's chimney smoke on `HHPAL`, converted 1:1 from docs/media/new_media5/hog-hut-chimney-moving.png and drawn centred over the front row of its 2×2 footprint). The berry bush is
four frames on `BPAL` — `bush`, `bushEmpty`, `bushBud`, `bushRipen` — one silhouette in which only
the four berry pixels change (ripe, gone, pale `b` buds, dull `d` berries), because the frames are
a clock the player reads at a glance and a bush that seemed to move would read as a different
plant ([the regrow stages](world.md#the-tile-world)).

The **rocks** ([js/sprites/rocks.js](../../js/sprites/rocks.js)) are look B, STANDING CRAGS, of
[rock-concepts-1.png](../media/concepts/rock-concepts-1.png) (A snow boulders, B standing crags,
C strata ledge), one outline per kind so the kind reads without its colour: STONE is two leaning
slabs (32×22), a FROSTGLASS SPIRE is ice prisms thrust through the slabs (32×29), a SUNSTONE a
black obelisk seamed with amber and ringed with amber shards (32×35), each on `RKPAL` with its
32-wide rubble. The grids came off a generator (faceted stone lit from the upper left, prisms in
three faces) and are kept verbatim; the crack overlays are baked from them at load (`cracks`, a
seeded walk down the body, dark on stone and white on crystal) and so are the glint sites
(`glints`, every third of the brightest crystal and amber pixels). The three ore icons are 8×8
grids baked beside their code in js/mining.js (`ORE_ICONS`): a lump, a shard and a cut gem.

Anything drawn through `drawSpriteFlash()` must stay within **64×64**: it recolours through a
shared 64×64 scratch canvas and a larger sprite clips ([rendering.md](rendering.md#render-pass-order)).

**New sprites bake beside the code that draws them, not here.** The treasure chest (`CHEST_SPR`,
js/draw/ground.js) and every tool and bit icon (`TOOL_ART` / `BIT_ART` / `bakeGrid`, js/tools.js)
paint their char grids onto their own canvases and assign into `SPRITES`, which works because it
is a plain object - exactly what each js/sprites/ file does for its own keys (the paragraph
below), so a sprite that belongs to a drawer can live beside it. Tool art goes further and follows the gear icons'
trick — one 12×12 silhouette per weapon, baked once per **tier** through `TOOL_ART_PAL`, so shape
says which weapon and palette says how good it is. The two detailed 32×32 icon sets do the same:
the ability icons (`AB32`/`AB32_PAL`, js/abilities.js) and the gear-variant icons (`GEAR32`,
js/ui/menu.js) bake lazily beside their drawers, and `GEAR32` deliberately shares `AB32_PAL` so
every big icon in the game speaks one palette.

**The story landmarks** (`landmarks.js`, palette `LMPAL`) are E of
`docs/media/concepts/landmarks-concepts-1.png`: the rowboat (50×24 over 3×1). The paint on the hull is a
weathered rust, never a saturated red, because red and blue are the teams' inks. The other
candidates (C, the ice-fishing shack, stood in the game until 4.12; A, the slat sled, until 4.34) live only in the sheet. How they stand on their tiles:
[world.md](world.md#story-landmarks).

## The shape of a sprite file

`js/sprites/core.js` loads first and makes two globals: the empty `SPRITES` registry and `SPR`,
the helpers every art file shares — `bake`, `spansOf`, `bakeSpan`, `flipH`, `bakeClips`, `mapClips`,
`liveIcon`, the `TEAM_SKINS` table and `teamBuildPal`. Each of the eleven art files
is a private IIFE with the same skeleton: destructure what it needs off `SPR`, its palettes and
grids under `// ---- name` banners, the set builders, and at the bottom one
`Object.assign(SPRITES, { ... })` naming every key it owns. Nothing reads another file's grid, so
they load in any order after core; a new sprite goes into the file that owns its subject and its
key onto that file's `Object.assign`.

Keys marked **(dead)** are still baked but read by nothing outside js/sprites/
([Intentional dead code](checklists.md#intentional-dead-code)).

| File | Banners | Registers |
| --- | --- | --- |
| `characters.js` | player, the fish catch, skater, prone, raider, looks, the merchant | `playerTeam`, `champ`, `LOOK`, `champLook`, `player`, `raider` **(dead)**, `merchant` |
| `looks.js` | bodies, heads, beards, hair, outfits | `portrait`, `MODEL_LAYERS` |
| `terrain.js` | trees, gold ore, gold mine, bush, the dead snags, the den, the hog hut | `tree`, `treeAtlas`, `stump`, `goldOre` **(dead)**, `mine` **(dead)**, `bush*`, `deadTree`, `den`, `hogHut` |
| `rocks.js` | the three rock kinds, their rubble, the channel's cracks, the glint sites | `rock[kind]`, `rockSpent[kind]`, `rockCracks[kind][stage]`, `rockGlints[kind]` |
| `beasts.js` | imp, rabbit, deer, wolf, the bird | `rabbit`, `wolf`, `bird`, `deer`, `imp` **(dead)** |
| `bears.js` | none: generated by app/bake-bears/bake.py | `dire` (brown bear), `alpha` (black bear) |
| `robot.js` | none: generated by app/bake-robot/bake.py | `robotSkin` (the IRON SCOUT skin, per team) |
| `eagle.js` | eagle | `eagle`, `eagleTeam`, `eagleFlash`, `eagleShadows` |
| `warbirds.js` | palettes, plates, painter, cache | `warBirds` (no grids: painted in code, below) |
| `buildings.js` | wall, tiered structures, the turret's three timber bases, fish net, bot bay, spikes, fire, torch | `teamBuild`, `robotTeam`, `wall`, `turret` (`turretT1`/`T2`/`T3` through `TUR_PALS` and `turretPal`), `generator`, `spawner` **(dead**: the flat 16×16; the bay is `teamBuild[team].spawner`**)**, `net`, `scaffold`, `robot`, `spikes` **(dead)**, `fire` **(dead)**, `torch` **(dead)** |
| `items.js` | items, gold nugget, gold sack, crate, axe icon | `itemWood`/`itemStone`/`itemBag`, `itemAnim` + the three live icons, `goldSack`, `crate`, `itemCard*`, `itemAxe`/`itemBow`/`itemPick` |
| `landmarks.js` | landmarks | `landmark` (`boat`) |
| `icons.js` | gear icons, heart, cursors | `gearIcons`, `heart*`, `cursor`, `cursorShadow` |

The grids are **pure ASCII and byte-fragile**: `bake()` sizes each canvas from `rows[0].length`
alone, and an unmatched palette char is indistinguishable from a transparent pixel, so a row that
gains or loses a character silently shifts that grid row sideways. Move a row whole, never re-wrap
or re-indent one, and keep the files ASCII.

