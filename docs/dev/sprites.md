# Working on sprites

How the ASCII-grid sprite system works and which sprites share grids with which. Read this before
editing anything under [js/sprites/](../../js/sprites/) — the shape of a sprite file, and which
file holds what, is at the end.

Sprites are literal ASCII grids paired with a palette object mapping character → hex (or `null`
for transparent), baked by `bake()` at load. Left-facing variants are `flipH()` of the right ones.
Character sprites are 16×16; the raider set (`SPRITES.raider`, `RDPAL`) is baked from the exact
same grids as the player, so a player pose edit changes both. The tiered structures use the same
trick: one grid each (`wall`, `turret`, `generator`, all 16×16) baked with `WPAL` /
`WPAL_STONE` / `WPAL_GOLD` — a grid edit changes all three
tiers, and the palettes share the extra `k`/`K` (iron fitting) and `e` (glow) chars, which is also
what a building's team paint rides on (see below). A sprite too tall for a 16×16 wheel wedge gets
a dedicated icon grid baked into `teamBuild[team].icon` (the turret's and the bay's). The
**bot bay** (`spawner`) is the one big sprite: a single-tier 48×38 grid (`bay`, `BAYPAL`) on a 3×2
tile footprint — steel plates under a flat two-row snow cap, a team-painted lintel band (`L`/`T`/`t`
via `bayTeamPal`), riveted flanks with a grille and hazard stripe, and a 20-px dark doorway (cols
14–33, rows 13–35, floor row 36 — `drawBayOverlay` in js/draw/structs.js clips to it). Its 16×16 wheel glyph is
a separate grid, `bayIcon`, exported as `teamBuild[team].icon.spawner`; the old 16×16 `spawner` grid
is still baked as the flat `SPRITES.spawner` but unreferenced. The
construction stages are one shared `scaffold` set (`[posts, frame, lattice-overlay]`, `SCPAL`),
and the worker bot is one 12×10 grid on `BOTPAL` (`botA`/`botB`: a faceless boxy chassis with
stub arms sitting on a single full-width tread, the two frames differing only in the tread
notches). The body chars `L`/`T`/`t` are the team paint (`teamRobotPal` → `coatL`/`coat`/`coatD`),
so `robotTeam[team]` is the whole bot in that colour; `drawRobot()` bobs the entire sprite while
driving and adds the tool swing and the carried nugget in code.

**Prone is a fifth pose direction**, a `prone` key sitting beside `down`/`up`/`right`/`left` in
each champion's set (`champ[c][team].prone[dir][frame]`, three frames a direction: settled and two
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
([rendering.md](rendering.md#snow-over-a-body)) — which means editing a prone grid updates the
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
of a body goes through `classSet(p)` (player.js), which asks it. Body type, beard and face do
not touch the 16 px body until the 32 px rework.

The **48 px model** ([looks.js](../../js/sprites/looks.js), `SPRITES.portrait(cls, look, team,
bare)`) is where the whole look reads — the create screen, the roster and class select's
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
profile.js and here together or the game refuses to boot. Front view only for now — the
32 px in-world rework is where turning it round belongs. A new class needs an `OUTFIT` layer
here ([checklists](checklists.md#common-changes)). `portrait` keeps what it composes in a cache
the create screen fills quickly — a cell per choice per row, refreshed on every pick — so the cache
is emptied past `PORTRAIT_KEEP` (512) rather than growing with every roll of the die.

A first concept round for a stronger model (`docs/media/concepts/model-concepts-1.png`,
2026-09-11: A BUNDLED, B LANKY, C STOUT, each with eye, brow, mouth and mark layers) was
**rejected whole**; the PNG is kept as the record of what not to draw again.

**Team colours are palette swaps of those same grids.** `TEAM_SKINS` (two presets, RED and BLUE,
also exported as `SPRITES.teams` so the game code can read the names and marker colours) drives
four baked sets — the three below plus `eagleTeam[team]`: the drop eagle's three flap frames with
the torso band (the rows the head sits in, which hold still across the frames) re-lettered by
`armorize()` to plate/helm chars and baked in team colour, so the armour recolours only pixels
the bird already has and the silhouette is untouched (`eagleFlash` is the same trick in all
white, for the downed objective's hit flash):
`playerTeam[team]` (coat/hat/trim swapped — `SPRITES.player` *is* `playerTeam[0]`),
`teamBuild[team][type][tier]` (the tier material with the `k`/`K`/`e` accents repainted, so tier
still reads as tier), `robotTeam[team]`, and `merchant[team]` — the eagle's driver
([the merchant](gameplay.md#the-merchant)): its **own grids**, `merchDown`/`merchUp`/`merchSide`
plus `merchFeet` — **16 × 18**, two rows taller than a player — an old trader in a wide flat
**fur hat** (`f`/`F`, twelve wide, the silhouette) with a **team-cloth crown** (`y`/`Y`, the one
team ink and all of it), a white **beard** (`w`/`W`) down the chest, a khaki wool coat
(`r`/`R`/`d`) hanging straight to the hem, boots under it, three frames a direction (the boots
walk, the coat hangs; the side grid faces right and flips), under `merchantPal`. It is look **D**
off the concept sheet in `docs/media/concepts/merchant-concepts-2.png` (the `concept-art` skill
in `.claude/skills/` is how a sheet is made and picked — two rounds of hoods and hats came
before this one). Nothing on it is a player's coat or hat, so the side reads off the crown, the
nameplate and the bar (no prone poses — it never lies down). A new character or building sprite has to
be added to those bakes, not just to the flat `SPRITES` entry, or it will not wear a team's
colour — and every read of one of them indexes by `skin(team)` (js/player.js), never the bare
team, so your side is painted blue whichever index it was dealt. The swing
tool icons (`itemBow`/`itemAxe`/`itemPick`) are 8×8 grids sharing `AXPAL`, drawn at **1×** by
`drawHeldTool()` (inside a translate/rotate, resolved through `SPRITES[t.icon]` from the
`SWING_TOOLS` table) and by `drawRobot()` for a bot's swing — E picks the tool, there is no tool
bar. At rest `drawHeldTool()` draws the **weapon on the selected slot** instead, which is a 12×12
`toolArt_*` canvas baked in [js/tools.js](../../js/tools.js) rather than here; both sizes go
through the same code because the icon is centred on its own half-width. The **gear icons** are
twelve 12×12 grids, **one per variant** (`gearLongsight` … `gearGhoststep`), each baked once per
**material** — `GEAR_MAT_PALS`, leather → iron → steel → gold, plus the shared accent chars `w`
(ice-white) and `r` (hearth-red) — into `SPRITES.gearIcons[slot][variant][material]`: the glyph
says which piece, the material says its level. Drawn by the HUD's gear plates and class select's
collapsed gear widget; the gear pop-up's wells wear the detailed 32×32 `GEAR32` set instead
(js/ui/menu.js — see [gameplay.md](gameplay.md#gear)). `itemBag` is
12×12 for the same reason — it sits in the same 18 px HUD well — but shares `ITPAL` with the
8×8 item icons rather than taking a material palette: it is one object, not four levels of one.
The five **roguelike card** icons take the gear icons' trick the other way round: one shared 8×8
`itemCard` silhouette (a card face with a sparkle pip), baked five times through `CARD_PALS` —
White/Green/Blue/Purple/Gold — where the rarity itself is the only colour that changes (`C`), so
`itemCardWhite`…`itemCardGold` are five palette swaps of one grid, the same relationship `GEAR_MATS`
has to a single gear icon.

**The pine is twenty-four bend frames of one tree**, and the first of the imported sprites — the
others are the gold sack, the three animated goods and both prey, below:
`treeSway` is `docs/media/new_media/001.png` cropped to **27×37**, snapped onto
`TSPAL` (fourteen colours, `bake`d like everything else), and then **sheared** into its other
frames. It draws at
`(px - 5, py - 21)` with its trunk on the tile's centre line, and **through `SPRITES.treeAtlas`,
never through `SPRITES.tree`** — because a `drawImage` that
changes source texture cannot be batched and a wide view holds a thousand pines
([rendering.md](rendering.md#drawing-a-thousand-of-something)).

The array is a **ladder, not a cycle**: index 0 is the tree thrown fully left, 23 fully right, 11
and 12 are it standing up. A frame here is a *lean*, so `treeFrame` maps the wind's signed sway
onto an index directly and a gust lays every tree inside it over the same way — where the sixteen
variant crops this replaced could only morph one tree's branches into another's, which no ordering
makes into a forest bending. The shear is a **tip-loaded cantilever** rounded per row: a row `h` of
the way up from the base moves `2.6 * (3h² - h³) / 2` px, which is zero slope where the trunk meets
the snow, all of the curve in the crown, and 6 px of travel at the tip end to end. Rows cross their
rounding thresholds at different heights, so 21 of the 24 frames are distinct pixels.

Every frame being the same tree, the atlas holds **forty-eight**: the 24 again, mirrored, with the
tile's `hash2` sending half the forest into them — which, together with the small standing lean that
hash also gives, is what keeps a stand from reading as one stamp repeated. `TPAL` above it stays: it
still dresses the `stump` a felled pine leaves. Which frame a tree is wearing is decided by the
wind, not here - [rendering.md](rendering.md#the-wind-field).

**The gold sack is the merchant's mark.** `SPRITES.goldSack` is
`docs/media/new_media3/bag_of_gold_bouncing.png` — a 320×32 strip — split at 32 px into the ten
frames of `sack` and snapped onto `SACKPAL` (twelve colours: an outline, five cloth, two cord,
three coin, one shine). Unlike the
pine the **source order IS the animation order**: it was drawn as a loop, and the cloth barely
moves while the coin in the neck of the sack glows, so the cycle reads as light catching gold
rather than as a bag being jostled.

Its only caller is the market plate
([the plates](rendering.md#market-notices-the-plates-under-the-minimap)), HUD chrome where **16** is
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
- **No sprite in the game has a soft edge or an off-palette pixel.** The earlier `bakeHalf` did
  the downscale at load as an alpha-weighted 2×2 average, which is fine for a HUD stamp whose
  whole animation is a 1 px sparkle and wrong for everything else: it fringes every edge with
  half-transparent pixels and invents colours the palette never had. Against hard-edged art at a
  whole-number zoom that reads as blur. `bakeHalf` is **gone**; nothing bakes at anything but its
  own cell size.

**Three item icons are loops rather than stamps**, all three off 16×16 strips in
`docs/media/new_media3/`, resampled to the **8×8** every other item icon is, so what changed is
the art and not the fit:

| icon | source | frames | palette | the loop |
| --- | --- | --- | --- | --- |
| `itemGold` | `gold_nugget.png` | 8 | `NUGPAL` (14) | a shine crossing the face |
| `itemBerry` | `berries.png` | 10 | `BERPAL` (9) | a sparkle over the stalks |
| `itemFish` | `fish.png` | 8 | `FIPAL` (10) | the fins working |

The **fish is the one whose palette does not match its sheet**: it arrived salmon and `FIPAL` is
**hue-shifted** to the cold blue everything else about a fish in this game already is — the
market's fish line and price graph, the pickup floater, `RES_COLORS.fish` (`#7ac0e8`) — because a
pink icon under a blue number reads as two different goods. Every entry keeps its **lightness**,
which is what carries the shading, and lands in a tight band around 205°; only the cream belly is
hand-nudged, because the source told its two bellies apart by hue at equal lightness and one hue
cannot carry that. `fish.png` itself is untouched, so a regenerated grid set needs the shift
reapplied — the grids are the sheet pixel for pixel, the twelve numbers in `FIPAL` are not.

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
resampled down from a sheet. It replaces the sack
on the plate whose news is a **turnover** rather than a price (`NOTE_KIND.stock.mark`,
[the plates](rendering.md#market-notices-the-plates-under-the-minimap)): same 16×16 stamp, same
sunken well, so the column reads as one column whichever kind lands in it.

**The turret is half grid, half raster.** `turret` is a **32×32** mount — collar, column, plinth
and snow skirt — whose top 16 rows are deliberately empty. The rotating housing and barrel are not
baked at all: `drawTurretHead()` in js/draw/structs.js rasterises them pixel by pixel at the live bearing and
dilates the result into a 1px dark rim, exactly as the arrows do, because a baked grid would lock
the gun to one angle. The pivot is sprite-local **(16, 14)**, just above the collar. Two knock-ons:
the sprite is wider than its one-tile footprint, so the draw pass centres it (`sx` in the structure
branch of `render()`); and a 32px sprite is too big for a radial-wheel segment, so `turretIcon` (the
old 16×16 cannon) is baked into `teamBuild[team].icon.turret`, the same escape hatch the bay uses.
**Wildlife is side-view only, and its frames are named CLIPS.** `SPRITES[kind][dir]` is an
**object**, not a flat list: one array per behaviour, every kind carrying at least `idle` — the
frame anything asking for "the beast" takes (the wiki's cards read `.right.idle[0]`). Which clip
is playing is the animal's business, not the sprite's: js/wildlife.js sets `a.clip` from what the
beast is doing (`ANIM_CLIPS`, [gameplay.md](gameplay.md#what-a-beast-is-doing-the-clips)) and
`clipFrame` in js/draw/bodies.js plays it. `bakeClips` builds a set and `mapClips` walks one — the
mirror for `left`, and the alpha/dire wash below.

The **rabbit** and the **deer** are imported: three sheets each out of `docs/media/new_media3/`,
snapped onto `RBPAL` (eleven colours) and `DEPAL` (thirteen), source order the animation order.

| kind | clips (frames, and the sheet each came off) | source cell | **ships at** |
| --- | --- | --- | --- |
| `rabbit` | `idle` 10 `bunny…gently_look_around`, `hop` 6 `…hopping_right`, `rise` 8 `…stand_up_and_wiggle` | 28×30 | **11×12** |
| `deer` | `idle` 10 `deer…gently_look_around`, `graze` 12 `…grazing_loop`, `run` 12 `…galloping` | 38×38 | **19×19** |
| `wolf` | `idle` 1, `run` 2 | — | 16×13 |
| `bird` | `idle` 1 (perched), `fly` 2 | — | 9×6 / 9×5 |

Both are [resampled offline](#the-offline-resample) — at its own cell size the bunny stands taller
than a 16 px player and the stag more than twice one. The **rabbit ships at 11×12**, deliberately
shy of half its source: a bunny the height of the hero read as a hare the size of a dog, and the
stag beside it is the animal that is meant to look big. Each kind's three sheets share **one
crop** — the box every frame of every clip fits inside — because a clip taking over on a different
crop would jump against the one it replaced. The deer keeps its whole 38×38 cell (the gallop
reaches column 0, the graze column 37); the rabbit is trimmed to 28×30, which still holds the ear
tips the hop throws up.

The wolf and the bird keep their hand-drawn grids (a shared `wolfBody` plus three leg rows per
frame, the trick the deer used to use; `birdPerch` plus two wing frames) — they were already an
idle and a two-frame gait, so the clip shape only names what they had. Left variants are `flipH`
of the right-facing frames. The camps' two [alpha and dire wolf](world.md#camps) are
**placeholder looks derived from the wolf, not grids**: `wash` washes the wolf's frames toward
silver (alpha) or a dark red (dire), each through `mapClips` so every clip is washed, and `double`
blows the dire up to 32�26 nearest-neighbour
(the tail of js/sprites/beasts.js) — each wants its own grid through the concept-art skill one day.
The two camp props are
`deadTree` (two 16×24 snags on `DTPAL`, the footprint the pine used to share so they draw in the same
band) and `den` (one 16×12 mound on `DNPAL`, drawn at `py + 4` like a rock). The berry bush is
four frames on `BPAL` — `bush`, `bushEmpty`, `bushBud`, `bushRipen` — one silhouette in which only
the four berry pixels change (ripe, gone, pale `b` buds, dull `d` berries), because the frames are
a clock the player reads at a glance and a bush that seemed to move would read as a different
plant ([the regrow stages](world.md#the-tile-world)).
Anything drawn through `drawSpriteFlash` must stay within 64×64.

**New sprites bake beside the code that draws them, not here.** The treasure chest (`CHEST_SPR`,
js/draw/ground.js) and every tool and bit icon (`TOOL_ART` / `BIT_ART` / `bakeGrid`, js/tools.js)
paint their char grids onto their own canvases and assign into `SPRITES`, which works because it
is a plain object - exactly what each js/sprites/ file does for its own keys (the paragraph
below), so a sprite that belongs to a drawer can live beside it. Tool art goes further and follows the gear icons'
trick — one 12×12 silhouette per family, baked once per **tier** through `TOOL_ART_PAL`, so shape
says which weapon and palette says how good it is. The two detailed 32×32 icon sets do the same:
the ability icons (`AB32`/`AB32_PAL`, js/abilities.js) and the gear-variant icons (`GEAR32`,
js/ui/menu.js) bake lazily beside their drawers, and `GEAR32` deliberately shares `AB32_PAL` so
every big icon in the game speaks one palette.

## The shape of a sprite file

`js/sprites/core.js` loads first and makes two globals: the empty `SPRITES` registry and `SPR`,
the helpers every art file shares — `bake`, `spansOf`, `bakeSpan`, `flipH`, `bakeClips`, `mapClips`,
`liveIcon`, `wash`, `double`, the `TEAM_SKINS` table and `teamBuildPal`. Each of the seven art files
is a private IIFE with the same skeleton: destructure what it needs off `SPR`, its palettes and
grids under `// ---- name` banners, the set builders, and at the bottom one
`Object.assign(SPRITES, { ... })` naming every key it owns. Nothing reads another file's grid, so
they load in any order after core; a new sprite goes into the file that owns its subject and its
key onto that file's `Object.assign`.

| File | Banners | Registers |
| --- | --- | --- |
| `characters.js` | player, the fish catch, skater, prone, raider, looks, the merchant | `playerTeam`, `champ`, `LOOK`, `champLook`, `player`, `raider`, `merchant` |
| `looks.js` | bodies, heads, beards, hair, outfits | `portrait`, `MODEL_LAYERS` |
| `terrain.js` | trees, rocks, gold ore, gold mine, bush, the dead snags, the den | `tree`, `treeAtlas`, `stump`, `rock`, `goldOre`, `mine`, `bush*`, `deadTree`, `den` |
| `beasts.js` | imp, rabbit, deer, wolf, the bird, the camps' wolves | `rabbit`, `wolf`, `bird`, `deer`, `imp`, `alpha`, `dire` |
| `eagle.js` | eagle | `eagle`, `eagleTeam`, `eagleFlash`, `eagleShadow` |
| `buildings.js` | wall, tiered structures, fish net, bot bay, spikes, fire, torch | `teamBuild`, `robotTeam`, `wall`, `turret`, `generator`, `spawner`, `net`, `scaffold`, `robot`, `spikes`, `fire`, `torch` |
| `items.js` | items, gold nugget, gold sack, crate, axe icon | `itemWood`/`itemStone`/`itemBag`, `itemAnim` + the three live icons, `goldSack`, `crate`, `itemCard*`, `itemAxe`/`itemBow`/`itemPick` |
| `icons.js` | gear icons, heart, cursors | `gearIcons`, `heart*`, `cursor`, `cursorShadow` |

The grids are **pure ASCII and byte-fragile**: `bake()` sizes each canvas from `rows[0].length`
alone, and an unmatched palette char is indistinguishable from a transparent pixel, so a row that
gains or loses a character silently shifts that grid row sideways. Move a row whole, never re-wrap
or re-indent one, and keep the files ASCII (the old single file carried a BOM and seven rows that
repaired a mangled byte inline; the split wrote those rows as the ASCII they repaired to).

