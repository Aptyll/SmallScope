# Working on sprites

How the ASCII-grid sprite system works and which sprites share grids with which. Read this before
editing anything under [js/sprites/](../../js/sprites/) or [js/baked/](../../js/baked/) — the shape of a sprite file, and which
file holds what, is at the end.

Sprites are literal ASCII grids paired with a palette object mapping character → hex (or `null`
for transparent), baked by `bake()` at load. Left-facing variants are `flipH()` of the right ones.

**Measuring art reads `SPR.pixelsOf(cv)`, never the canvas.** A sprite canvas lives on the GPU and
`getImageData` on it stalls the frame; `bake` and `flipH`/`flipV` keep each sprite's pixels as they
paint, so a sun shade, a building's shot box, a canopy's ink or a blade's reach reads those. Any
other canvas is read back once on first ask (`SPR.readbacks()` counts them). A canvas drawn into a
CPU layer that is read every frame (the canopy's hero layer) goes through its `SPR.cpuTwin`: one GPU
canvas drawn into a CPU one makes every later read of it wait on the GPU. So hand-built art bakes
through `SPR.bake`, not a copy of it.
Character sprites are 16×16 in the world, each hero drawn only in its own looks
([hero looks](#hero-looks)); its 48 px face is that same standing front at 3x. The run and the roll
are wider frames holding that same cell, and the one set not typed by hand
([the run and the roll](#the-run-and-the-roll)).

**The buildings' team paint** rides the shared `k`/`K` (iron fitting) and `e` (glow) chars,
which `teamBuildPal` swaps for a side's own (see below).

**The gold pump** is a pump jack on a planked 4x2 tile pad, painted in code by
`app/bake-pump/pump.py` with the cutout painter (app/media/paint.py) and baked by
`python3 app/bake-pump/bake.py` into `js/baked/pump.js` (never hand-edit it). It is one
stroke of 8 frames (the crank turns, the pitman rocks the beam, a glint runs down the pipe, the
barrel's gold bobs). The team paint is `k`/`K`/`e`, baked inside `SPR.onTeams` into
`teamBuild[team].pumpAnim`; frame 0 is `teamBuild[team].pump`, the still that
`structSprite` hands every other reader. A pump nobody holds wears the same grids with the team
paint in grey, baked once outside `onTeams` into `SPRITES.pumpNeutral` (`pumpAnim`, `pump`);
`pumpSet` (js/draw/structs.js) picks the holder's set or that one. `pumpFrame` picks the frame off
the pump's `payT`, a whole number of `PUMP_STROKE` strokes to a payout, and `drawPumpCoin` hops a
coin out of `SPRITES.pumpMouth` for `PUMP_HOP` s after each pay.

**The road tower** is a cut-stone tower with a gun deck and a great crossbow on a turntable,
painted in code by `app/bake-tower/tower.py` with the cutout painter and baked by
`python3 app/bake-tower/bake.py` into `js/baked/tower.js` (never hand-edit it). It is three layers
so the gun stands in its deck: the body (`teamBuild[team].tower[0]`, what `structSprite` hands
every reader), the gun (`towerGun[heading][frame]`: 16 headings from east, clockwise, and the
frames LOADED, LOOSED, WINDING, WOUND) and the deck's front parapet (`towerFront`) over it. The team
paint is `k`/`K`/`e`/`E` (fit, coatD, coat, coatL), baked inside `SPR.onTeams`. `drawTowerTop`
(js/draw/towers.js) lays the gun and the parapet; the bolt in flight is `towerBolt[heading]`.

The **barracks** wears the bay grid (`STRUCTS.barracks.art` is `'spawner'`): a single-tier 48×38
grid (`bay`, `BAYPAL`) on a 3×2 tile footprint — steel plates under a flat two-row snow cap, a
team-painted lintel band (`L`/`T`/`t` via `bayTeamPal`), riveted flanks with a grille and hazard
stripe, and a 20-px dark doorway (cols 14–33, rows 13–35, floor row 36 — `drawBarracksOverlay` in
js/draw/overhead.js clips to it), baked as `teamBuild[team].spawner`.

A soldier is one 12×10 grid on `BOTPAL` (`botA`/`botB`: a faceless boxy chassis with
stub arms sitting on a single full-width tread, the two frames differing only in the tread
notches). The body chars `L`/`T`/`t` are the team paint (`teamRobotPal` → `coatL`/`coat`/`coatD`),
so `robotTeam[team]` is the whole melee bot in that colour; `drawRobot()` bobs the entire sprite while
driving and, for a melee soldier, rams the chassis at its foe (`soldierRam`); a soldier carries nothing. The **ranged** and
**siege** soldiers (`robotRanged`/`robotSiege`, js/baked/soldiers.js) are drawn by
app/bake-soldiers/bake.py (looks B SNOWBALL ARM and D BALLISTA CART off
`docs/media/concepts/wave-soldiers-concepts-1.png`, the cart redrawn in
`docs/media/concepts/wave-soldiers-ballista-2.png`): the same grid with a raised arm holding a
snowball, and the chassis a size up carrying a bow on a swivel post, its own arm at the winch, the
bolt's fletching in the side's mark. Each has four frames, two tread notches loaded and the same two
spent; the cart's set adds those four mirrored, shown while it faces left (`b.faceL`).
`SPRITES.robotAx` says where in each frame the body's x stands (a mirrored frame's is its width less
that).

## The run and the roll

**The run, the held run and the dodge roll are the one set of player frames not typed by hand.**
[app/bake-player/](../../app/bake-player/) paints them off a jointed doll of each hero look (ARMATOS's `standard` and `oath`, FORTIVA's `unbroken` and `coif`, BELLA's `general` and `traitor`,
IGNIA's `hearth` and `wanderer`, AURA's `light`, SALVIA's `hood` and `tent`, LUCERNA's `lamp` and `dusk`, HIEMS's `scholar` and `frost`, FABER's `clockmaker` and `foreman`, NIX's `snowblind`, FALCO's `falconer`, RUPES's `quarry` and `cellar`, VARRO's `wolfkept` and `whitepack`, VELOX's `canal` and `night`, BUCINA's `horn` and `column`, MARIS's `diver` and `orca`, SAGITTA's `siege` and `tower`, LIGNUM's `feller` and `forest`, CLIVUS's `guide`; [hero looks](#hero-looks)) and
writes them to js/baked/motion.js as char grids in characters.js's own letters, so `motionSet`
bakes them through the same team and hero palettes as every hand-drawn pose: `run[dir]`,
`hold[dir]` and `roll[dir]` sit beside the walking directions, `left` the mirror of `right`.
They are look A, TUCK TUMBLE, and C, SPRINT, off
[run-roll-concepts-1.png](../media/concepts/run-roll-concepts-1.png) (B CANNONBALL curled up first
and held it a beat; D JOG was the calmer run). The idle and every other pose stay the hand-drawn
grids in each hero's js/sprites/ file. The doll's own idle lands on them pixel for pixel head-on, which is why a stand turns
into a run without a jump.

**The doll** (doll.py) is soft parts posed in 3D and seen through a 20° camera. Each part is a
superellipsoid: exponent 2 is an ellipsoid, a higher one is boxier, which is how the hand-drawn
head keeps its rounded square. It is rasterised at 8× and shrunk to the game's pixel: the nearest
part holding a fair share of a cell wins it, banded by its mean light into its material's
letters. Then it is inked the hand art's way: an outline beside the silhouette on the left and
right only (all four sides for the compact roll shapes, across the top too for a hood), and an inner line where one part passes in front of another. The light comes mostly from
the viewer, so a highlight runs down a part's middle like the hand-drawn `RR` stripe. A region of
a part's surface can wear another material (the face is the front of the head below the brim).
The marks that must land on one exact pixel (eyes, the mouth's shade, a helm's band) are stickers, placed where they sit on today's front frame and carried by the head
(`decal`). bodies.py builds every look on one base frame, measured off the hand-drawn 16 px
frames: a fur-lined hood and goggles, two scarf ends, a tail that streams out on the run, and
skate blades that stand it a row taller; each look overrides what it changes (its hat, hair,
cloak, boots). anim.py poses them.

**Pixel discipline is what keeps it from looking generated.** The body bobs only in whole screen
pixels (`RUN_BOB`, `HOLD_BOB`), so the coat and the face are the same pixels in every frame,
moved up or down, and the limbs' joints snap to the pixel grid, so a leg lands as a clean
two-pixel column. The views differ where a 16 px body cannot show one stride both ways. Side-on
the legs scissor out past the coat on a narrow track (the far boot a shade darker, an inner line
where the legs cross); head-on they mostly lift, because a long stride toward the camera would
step the near boot below the ground line. Side-on the head also turns toward the viewer, so the
near eye shows as it does on the hand-drawn side frame, and the scarf's tail streams behind.

**What each set holds.** `run` is eight frames, two steps: contact, down, pass and float off the
right foot, then the left. The arms pump against the legs.
`hold` is the same legs with the arms at the sides, for a body whose hands are busy (`handsBusy`,
js/draw/bodies.js: a drawn weapon, a swing or slash, a cast, the shield up), so
nothing pumps under a drawn weapon; it only dips onto each strike. `roll` is a crouch, a dive, the
tucked ball turning over once in 30° steps from the dive's end to sitting curled again, a deep
squat and a rise. The ball is a body of its own (`paint_ball`: the back of the coat is the ball,
the hood tucked in at the front, the knees, boots and mittens wrapped round the other
side), turned about its centre, so its colours go round the rim while the light stays where the
sun is; every roll frame is set down on the ground row. `ROLL_AT` is the share of `DODGE_T` at
which each frame starts (the crouch and the dive get the first fifth, the ball most of the rest,
the squat and the rise the last sixth), and `rollFrame` picks off `1 - dodgeT / DODGE_T`, the two
afterimages wearing the frames from 0.07 and 0.14 of the roll earlier.

**A frame is wider than the cell.** Every frame is the one box `SPRITES.motionBox` names, centred
on the body's column so a mirrored left frame keeps its feet where they were, with the 16×16 cell
at its (`x`, `y`); `drawPlayer` draws a frame at the cell's top-left less that. The run plays
`RUN_STEP` frames per step of `animT` (`runFrame`), and the sim steps `animT` with the ground
speed, so a creep strides slower and an ice run quicker. What rides the body follows it: the held
tool moves with the frame's bob (`runBob`).

**A facing bakes the first time it is drawn** (`motionSet`'s getters), not with the set: a set is
a hundred-odd canvases, every hero look and team paint carries one, and baked up front they
stalled the drop's start and a palette repaint.

Edit the doll and rebake (`python app/bake-player/bake.py`, after `preview.py out.png` has laid
every frame of every look out on one sheet to judge, or `preview.py out.png 4 standard,oath` for
some); never edit the grids.

## Hero looks

Every hero is drawn only in its own looks. Its `CLASSES` row carries its `id`, which names its row
in the **hero art registry** (`HERO_ART`, [js/sprites/hero-art.js](../../js/sprites/hero-art.js)):
each hero's own sprite file ends with one `heroArt(id, { looks, pal, glyph, emblem })` call (its looks,
e.g. `ARM_SKINS`, their paint, the skins tab's glyph and the 12 px emblem), every reader asks
`heroArtOf(cls)` (player.js), and player.js refuses to boot when a row and its art do not pair up.
`champLook(cls, team, skinId)` (characters.js,
the `heroes` banner) bakes the chosen row's own grids `champLook(cls, team, skinId)` (characters.js,
the `heroes` banner) bakes the chosen row's own grids (its standing frame per facing, the walk
lifted off it by `heroWalk`, the roll from its doll by name through `motionSet`) in the hero's paint (`pal`, e.g. `ARM_PAL`, then the row's own `pal` if it has one)
over the team's coat (`teamPlayerPal` over `PPAL`). A `skinId` that names no row, or none, wears
the free first row. The set is cached per (hero, team, look): ten players and a menu or two is
all that ever asks. Every reader of a player's body goes through `classSet(p)` (player.js), which
asks it. **Standing still a hero breathes**: `set.breath[dir]` is the standing frame and
`heroBreath`'s (armatos.js: a chest row over the hands goes and the head and shoulders sink a pixel,
the hands, weapon and feet hold), shown on each body's own phase (js/draw/idle.js). A look's
`cloth` boxes (`[x0, y0, x1, y1]` per facing: BELLA's ponytail, FORTIVA's braid, VELOX's scarf,
FALCO's feather) and its `hem` (the rows of skirt over the legs) hang a pixel behind for the beat
after a stop or a turn (`heroCloth`, baked by `set.cloth`). A grid of another size keeps working:
both count from the grid's own rows. **A hero's side run and held run come off its own drawn side
frame, not the doll**: `heroRunSide` (armatos.js) finds the leg rows, scissors them by
`HERO_STRIDE` and bobs the body over them, so the head and coat keep the standing width (the doll's
side run was a pixel or two narrower and read as the hero shrinking when turning left or right).
**A look's cell may be larger than 16 px** (a square of any even size, feet on its last row): `heroWalk`,
`heroRunSide` and `heroRunFront` count rows and columns off the grid's own size (run frames come out
in `heroRunBox`), `drawPlayer` centres any frame on the 16 px cell with its floor on the cell's, and
`champLook` sets the set's `rise` and `reach` from the cell size (`heroRise`, `heroReach`,
js/draw/heroes.js): the overhead frame lifts by `rise`, a staff or blade hand sits `reach` px further
out. No look uses a larger cell yet; the roll and the other doll poses are still 16 px, and the menus
draw frames into 16 px boxes.
**A look can carry a finer world body**: `fine: { dens, grids }` on its row (ARMATOS's LAST
STANDARD, `ARM_FINE`; SAGITTA's, NIX's and IGNIA's looks, `SAGITTA_FINE`, `NIX_FINE`, `IGNIA_FINE`) is a `down`/`up`/`side` set at `dens` art px a world px (32 px on the 16
px cell). When `WD` is 2 (`?fine=1`; it is 1 by default, so no player sees one yet), `champLook`
builds it beside the 16 px set as `set.fine` through the same `lookSet`
(walk, side and front run, breath and cloth step `dens` px, a world px; every frame carries
`dens`), and only `drawPlayer` reads it, through `bodySet` and only while `ctx` is a `WD`-dense
layer (`worldDense`: the world buffer, the air layer and the layers that mirror them, `WD_CTX`;
[world zoom](rendering/world-zoom-and-the-two-pixel-spaces.md)). The menus, portraits, cards, the
eagle's seats and a falling body keep the 16 px set. **The rest of the kit follows the body**: a
`roll` on the row (`ARM_ROLL_FINE`: 14 frames a facing in the doll's box at `dens` px) replaces
the doll's; a `HERO_BLADES` row's `fine()` (`armSwordsFine`: the art at 32 px, its `hilt` and
`grip` the same world px) is what `bladeArt` hands the hands, and `drawGripped` and `heroCarry`
draw any art at `heldW`×`heldH`; the fist closes on its art px (`heroFistFine`), and ARMATOS's
standard draws on half px (`drawStandardFine`); a swing's crescent (`drawSwish`) lays itself on the body's art px. **A fine body brings the rest along**: a fine look with no `roll` gets its doll's roll
doubled (`SPR.fine2x`: Scale2x, the outline back to one px), and a blade row with no `fine()`
gets its own art doubled the same way (`fineArt`, the ink read as the darkest colour on the art's
rim). A staff (`HERO_STAVES`) follows the same way: its row's `fine()` frames, else its own
doubled (`staffArt`; IGNIA's crook and lantern is drawn, `IGNIA_CROOK_FINE`). A shot weapon follows too: `WEAPON_FINE[art]` (js/sprites/weapons.js) is its
drawn 32 px level art and slanted grid (SAGITTA's arbalest), else its own doubled (`shotArt`, read by
the aim and by her carry). So `fine.grids` alone is a whole kit; a drawn `roll` or `fine()` (ARMATOS's, NIX's dirk) replaces the
doubled one where the doubling reads badly (a 45 degree edge comes out in two px steps).
**The doubling is a stopgap, not 32 px art**: it keeps a fine kit from mixing pixel sizes, and
reads softer than a drawn part beside it. A hero whose roll or blade is still doubled does not count
toward turning `?fine=1` on for players; every part gets drawn first.
The run facing down and up is still the doll's, unless the look's row says `run: 'drawn'`: then
`heroRunFront` lifts the drawn front and back the same way (IGNIA's two looks, AURA's, SALVIA's, LUCERNA's and BUCINA's two, whose shawl, mantle, coat, cape and hair
the doll does not match). Which look a player wears is `heroSkinOf(p)` (player.js): the id in `p.skins` under the
hero's `id`, or the free first row. LAST STANDARD (nasal helm, white beard, tabard) is his
own; IRON OATH (closed helm with a gold cross, pauldrons, a cape) is bought on the skins screen.
They are F and G off armatos-round4.png in the project files. His 48 px face is his own standing
front at 3x (below).

His OATH GREATSWORD (`ARM_SWORD`, `ARM_SWORD_DIAG`) replaces the sword's held art in his hands
(`HERO_BLADES.oath`, js/draw/heroes.js: `heroBlade`, asked by `drawHeldTool`): flat for the swing and the wind-up (turned about its `hilt`), and slanted
at rest in every facing (`heroCarry`), the grip at his hip (the row's `hip`) and the blade up past the
shoulder, mirrored facing left, drawn behind the body facing up. **A blade is held the same way in
every facing** so a hero keeps one shape as it turns and nothing heavy is held out level: a
`HERO_BLADES` row with a slanted grid names its `hold` (`BLADE_HOLDS`; none is `slant`, up and out
from the leading hand: ARMATOS, VARRO, MARIS; `far` the other hand facing down: FORTIVA; `shoulder`
up against the shoulder, its head clear beside his own: LIGNUM's axe; `rest` the head down on the snow beside the
foot: RUPES's maul; `low` point down and out from the fist at the hip, the knife fighter's way:
NIX's dirk). Each is the row's own slanted grid mirrored left to right or top to bottom
(`heldFlip`, `heldDrop`); none rises past the head, where the health frame sits. A row with no
slanted grid keeps the level carry.

FORTIVA's looks (`FORT_SKINS`, js/sprites/fortiva.js) are built the same way on ARMATOS's frame and in
his iron (`FORT_PAL` is `ARM_PAL` with her copper hair `a`/`A` and her chain `c`/`C`). UNBROKEN
(his open helm with the gold band, a copper braid over her right shoulder, a broken shackle on her
left wrist) is her own; CHAINBREAKER (a mail coif, chain across the tabard, shackles on both wrists)
is bought. They are M and O off fortiva-round4.png in the project files; their dolls (`Unbroken`,
`Coif` in app/bake-player/bodies.py) paint the braid and hair in the doll's `hair` material. Her
48 px model is her own standing front too. Her CHAIN GREATSWORD (`FORT_SWORD`,
`FORT_SWORD_DIAG`, `HERO_BLADES.chain`) is held the way his is.

BELLA's looks (`BELLA_SKINS`, js/sprites/bella.js) are built the same way on ARMATOS's frame, legs
and torso planes (`BELLA_PAL` is `ARM_PAL` with her dark hair `a`/`A` and the traitor's mask and
mantle `q`/`Q`). Three shapes carry her from a distance: the high ponytail, the gold epaulettes
and her side's coat. IMPERIAL GENERAL (a gold circlet) is her own; EXILE'S BLADE (the same
ponytail, an iron band, a dark mask, a dark mantle where the gold was) is bought. They are P off
bella-round4.png in the project files and its skin; their dolls (`General`, `Traitor` in
app/bake-player/bodies.py) stream the ponytail behind her in the run (the doll's `hair` and `cloak`
materials). Her 48 px model is her own standing front too. Her EAGLE SPATHA (`BELLA_SPATHA`,
`HERO_BLADES.spatha`) is flat for the swing and slanted at rest (`BELLA_SPATHA_DIAG`, the grip at
`BELLA_SPATHA_GRIP`): she holds it at the ready in the leading hand in every facing.

IGNIA's looks (`IGNIA_SKINS`, js/sprites/ignia.js) are drawn on ARMATOS's frame too (`IGNIA_PAL` is
`ARM_PAL` with her copper hair `a`/`A` and the ember letters `u`/`f`/`F`). HEARTHKEEPER (loose
copper hair, an ember shawl) is her own; WANDERER (a hood up over the same hair, a pale collar) is
bought. They are A and C off ignia-round2.png in the project files, with their side frames redrawn
so the face and body hold their front width; their dolls (`Hearth`, `Wanderer` in
app/bake-player/bodies.py) paint the shawl in the doll's `ember` material and only the roll is used.
Her 48 px model is her own standing front too. Her CROOK AND LANTERN is not a blade: the row's
`staff: 'crook'` names a `HERO_STAVES` entry (`IGNIA_CROOK`, js/draw/ignia.js), carried upright in
the leading hand in every facing (`heroStaff`, asked by `drawHeldTool`, mirrored facing left or up)
and held through a cast; the lantern's heart flickers between two baked frames. **Each staff hero
carries it its own way** so two of them are two shapes on the snow: a `HERO_STAVES` row's `hold`
names a `STAFF_HOLDS` entry (none is the leading hand; `far` the other hand, SALVIA and HIEMS).
A staff is always upright with its foot by the hero's own. A draw or a cast brings it into the
leading hand; a draw lifts it 1 px, and a cast is two beats (`staffBeat`): its first half gathers the
staff up and a pixel out with the body a pixel up (a row's own `cast` sets it: BUCINA's horn at her lips, LUCERNA holds
her lantern aloft), its second half and the beat after a shot thrust it the way she faces
(`STAFF_THRUST`) with the body leaning in and the sleeve reaching out behind the fist (`heroSleeve`).

**Every hero body shows its side from every facing**: the side's coat letters (`r`/`R`/`d`) fill 16 px
or more of the torso facing down and up and 12 or more side-on, the lower back from behind
(the rule and the tool that counts it: hero-readability.md in the project's visual-direction files).

AURA has one look (`AURA_SKINS`, js/sprites/aura.js): NORTHERN LIGHT, drawn on ARMATOS's frame
(`AURA_PAL` is `ARM_PAL` with her silver hair `a`/`A`, the night-blue mantle `q`/`Q` and the
star-gold `s` of her circlet). It is A off aura-round1.png in the project files; its side frame
keeps the head at the front's width, the face flush with it. From behind her dress shows
under the hair and the mantle in the side's colour, so her side reads in every facing. Her doll (`Light` in
app/bake-player/bodies.py) paints the mantle in the doll's `cloak` material and only the roll is
used. Her 48 px model is her own front frame at 3x (`portrait`). Her STAR-GLASS is a staff like IGNIA's:
`staff: 'shard'` names `HERO_STAVES.shard` (`AURA_SHARD`, js/draw/aura.js), a fallen star,
warm white and gold, on a dark shaft; it flares between two baked frames (`AURA_SHARD_FLARE`).

SALVIA has two looks (`SALVIA_SKINS`, js/sprites/salvia.js): MENDER (free: a sage hood and
shawl, a linen apron over the side's dress) and FIELD TENT (rare, 200 coins: a linen headscarf
and a canvas tabard with a satchel strap), both on ARMATOS's frame (`SALVIA_PAL` is `ARM_PAL` with
her dark hair `a`/`A` and the sage `q`/`Q`; his linen `w`/`W` is her apron). They are A and B off
salvia-round1.png in the project files; side-on the head keeps the front's width and the body is
two pixels narrower. Her dolls (`Hood` and `Tent` in app/bake-player/bodies.py) paint the sage in
the doll's `cloak` material and the linen in `beard`; only the roll is used. Her 48 px model is her own front frame at 3x (`portrait`). Her SNOWDROP STAFF is a staff: `staff: 'snowdrop'` names `HERO_STAVES.snowdrop`
(`SALVIA_STAFF`, js/draw/salvia.js), a green sprig of snowdrop leaves with one white bud on a vine-wound alder shaft,
swaying between two baked frames.
RUPES has two looks (`RUPES_SKINS`, js/sprites/rupes.js): QUARRYMAN (free; a fur cap with ear
flaps, a full beard, leather straps over the side's coat, fur mitts) and ICE CELLAR (200 coins; the
side's hood up, a leather mantle, an ice-blue scarf), A and B off heroes-rupes/round1 in the project
files. Both are drawn on ARMATOS's frame with the broadest shoulders of anyone (12 px head-on,
11 side-on as QUARRYMAN: every hero's body stays within 25% of ARMATOS's 10 px) and run as their drawn bodies (`run: 'drawn'`); their dolls (`Quarry`, `Cellar` in
app/bake-player/bodies.py) are used only for the roll. `RUPES_PAL` is `ARM_PAL` with the fur
`t`/`T`, beard `w`/`W`, leather `m`/`M` and scarf `i`/`I`. His ICE MAUL is a `HERO_BLADES` row
(`blade: 'maul'`, js/draw/rupes.js). While he rolls (AVALANCHE) a `HERO_BODY_DRAW` row draws the
snowball in his place (js/draw/heroes.js).

MARIS has two looks (`MARIS_SKINS`, js/sprites/maris.js): BARGE DIVER (free; a close sealskin hood,
the brass-rimmed diving glass pushed up on the brow, a coil of line across the side's coat, a
leather belt) and ORCA SKIN (200 coins; a black sealskin hood with the orca's white patches on the
crown and a small fin, the side's colour a tabard over black), A and B off heroes-maris/round1 in
the project files. Both are drawn on ARMATOS's frame and run as their drawn bodies
(`run: 'drawn'`); their dolls (`Diver`, `Orca` in app/bake-player/bodies.py) are used only for the
roll. `MARIS_PAL` is `ARM_PAL` with the sealskin `q`/`Q`, brass `y`/`Y`, glass `I`, line `c` and
leather `a`. Her HARPOON is a `HERO_BLADES` row (`blade: 'harpoon'`, js/draw/maris.js). Swimming,
the water is drawn over her legs (`HERO_BODY_FX`); under the snow (BREACH) a `HERO_BODY_DRAW` row
draws the heaving snow in her place.

LIGNUM has two looks (`LIGNUM_SKINS`, js/sprites/lignum.js): FELLER (free; a fur cap with ear
flaps, a full beard spilling over the side's coat, the axe strap and a belt) and LAST FOREST (200
coins; a pine-green hood and shoulders over a bark-brown mantle, the side's colour down the
front), A and B off heroes-lignum/round1 in the project files. Both are drawn on ARMATOS's frame
and run as their drawn bodies (`run: 'drawn'`); their dolls (`Feller`, `Forest` in
app/bake-player/bodies.py: the cap in `pelt`, the hood in `cloak`, the mantle and belt in `hair`)
are used only for the roll. `LIGNUM_PAL` is `ARM_PAL` with the fur `j`/`f`/`F`, the beard `w`/`W`,
the leather `a`/`A`, the hood `q`/`Q` and the buckle `y`/`Y`. His FELLING AXE is a `HERO_BLADES`
row (`blade: 'felling'`, js/draw/lignum.js). BARK SKIN lays bark plates on his shoulders
(`HERO_BODY_FX`); TIMBER's trunk is drawn on the snow (`HERO_GROUND`).

CLIVUS has one look (`CLIVUS_SKINS`, js/sprites/clivus.js): GUIDE (free; a knit cap with snow
goggles pushed up on the brow, a coil of rope over his left shoulder across to the right hip, a
belt). It is drawn on ARMATOS's frame (15 rows tall, 10 wide from the front, 8 from the side) and
runs as its drawn body (`run: 'drawn'`); its doll (`Guide` in app/bake-player/bodies.py: the cap in
`cap`, the rope in `hair`, the belt in `trim`) is used only for the roll. `CLIVUS_PAL` is `ARM_PAL`
with the cap `c`/`C` and the rope `a`/`A`. His ICE AXE is a `HERO_BLADES` row (`blade: 'iceaxe'`,
js/draw/clivus.js); the rope out and tied is drawn in the air (`HERO_AIR`), the rope ring on its
stakes on the snow (`HERO_GROUND`), and a readied FOOTHOLD as a glint running up his rope
(`HERO_BODY_FX`). In the air on his vault he joins the air layer, over the pines.

LUCERNA has two looks (`LUCERNA_SKINS`, js/sprites/lucerna.js): LAMPLIGHTER (free: a flat cap over
dark hair, a warm brown greatcoat open on the side's waistcoat, brass buttons) and DUSK ROAD (rare,
200 coins: the same coat with a mustard scarf and a wide hat), both on ARMATOS's frame
(`LUCERNA_PAL` is `ARM_PAL` with her hair `a`/`A`, the coat `q`/`Q` and the brass `u`/`f`). They are
A and B off lucerna-round1.png in the project files; side-on the head keeps the front's width and
the body is two pixels narrower. The waistcoat is four pixels wide head-on and, from behind, the
coat's skirt under a brass belt is the side's colour (`r`/`R`/`d`), so her side reads in every facing. Her dolls (`Lamp` and `Dusk` in app/bake-player/bodies.py) paint
the coat in the doll's `cloak` material; only the roll is used. Her 48 px model is her own front frame at 3x (`portrait`). Her LANTERN is carried like a staff but hangs: `staff: 'lantern'` names
`HERO_STAVES.lantern` (`LUCERNA_LANTERN`, js/draw/lucerna.js), a brass lamplighter's lantern held by
its ring (`LUCERNA_LANTERN_GRIP`), its flame breathing between two baked frames.

BUCINA has two looks (`BUCINA_SKINS`, js/sprites/bucina.js): HORN-BLOWER (free: bare-headed, an
auburn braid, a slate wool cape with a cream fur collar over the side's coat, a brass baldric) and
COLUMN CALL (rare, 200 coins: an iron cap with a brass brim and a brass gorget in place of the fur),
both on ARMATOS's frame (`BUCINA_PAL` is `ARM_PAL` with her hair `a`/`A`, the cape `q`/`Q` and the
fur `w`/`W`). They are A and B off bucina-round1.png in the project files; side-on the head keeps the
front's width and the body is two pixels narrower. Her dolls (`Horn` and `Column` in
app/bake-player/bodies.py) paint the cape in the doll's `cloak` material and the collar in `beard`
(`gold` for the gorget); only the roll is used. Her
HORN is a staff: `staff: 'horn'` names `HERO_STAVES.horn` (`BUCINA_HORN`, js/draw/bucina.js), a brass
bucina coiled in one loop with the bell up and out, held by the loop, glinting between two baked frames.
VARRO has two looks (`VARRO_SKINS`, js/sprites/varro.js): WOLF-KEPT (free) and WHITE PACK (rare,
200 coins), both on ARMATOS's frame (`VARRO_PAL` is `ARM_PAL` with the grey pelt `f`/`F`/`j`, the
white pelt `u`/`U`/`v` shaded blue so it holds on snow, and his dark hair `a`). The pelt is worn as
a hood, the wolf's ears standing up off the crown: his one signature shape. It is A off
varro-round1.png in the project files. His dolls (`Wolfkept` and `Whitepack` in
app/bake-player/bodies.py) paint the pelt in the doll's `pelt` and `snowpelt` materials and only the
roll is used (`run: 'drawn'`). His HUNTING SPEAR is a blade row
(`HERO_BLADES.spear`, js/draw/varro.js): 18 px painted, flat for the side and the swing, slanted
facing down or up with the grip at `VARRO_GRIP`.

HIEMS has two looks (`HIEMS_SKINS`, js/sprites/hiems.js): WEATHER SCHOLAR (free) and FIRST FROST
(rare, 200 coins), both on ARMATOS's frame. `HIEMS_PAL` is `ARM_PAL` with the hood `a`/`A`, the
robe's panels `q`, the ice band and clasp `c`/`C`/`i`, FIRST FROST's snow-white hair `l`/`L` and ice
mantle `z`/`Z`. They are A and B off hiems-round1.png in the project files. Their dolls (`Scholar`
and `Frost` in app/bake-player/bodies.py) paint the hood in the doll's `hair` material, and the
white hair and the mantle in two materials added for her (`frost`, `ice`, doll.py); only the roll
is used. Her SNOWFLAKE STAFF is a staff like IGNIA's: `staff: 'flake'` names `HERO_STAVES.flake`
(`HIEMS_FLAKE`, js/draw/hiems.js), a six-pointed flake of ice on a pale birch shaft whose heart
glints between two baked frames.

NIX has two looks (`NIX_SKINS`, js/sprites/nix.js) on one set of grids and one doll: SNOWBLIND
(free) and MOONLESS (rare, 200). `NIX_PAL` is `ARM_PAL` with her night hood `q`/`Q` (the doll's
`cloak`), bone goggles `w`/`W` and frost scarf `m`/`M` (the doll's `trim`); MOONLESS is the same
cut repainted by its row's `pal` (moonless black, gold goggles, a violet scarf), which
`champLook` lays over the hero's palette. It is A off nix-round1.png in the project files. Her
doll is `Snowblind` in app/bake-player/bodies.py. Her ICE DIRK is a `HERO_BLADES` row (`dirk`,
js/draw/nix.js), half a sword's length, with its own slanted grid (`NIX_DIRK_DIAG`) held `low`.

VELOX has two looks (`VELOX_SKINS`, js/sprites/velox.js): CANAL RUNNER (free: a navy wool cap, auburn
hair in a braid down her back, a gold scarf, a satchel at her hip, skate blades under her boots) and
NIGHT POST (rare, 200 coins: dark hair, a dark cap, a pale blue scarf), both on ARMATOS's frame. They
are A and C off velox-round1.png in the project files. Her dolls are `Canal` and `Night` in
app/bake-player/bodies.py; she runs on her drawn frames (`run: 'drawn'`). Her STAFF SLING is a
`HERO_STAVES` row (`sling`, js/draw/velox.js): a hooked staff with the sling hanging off its hook,
carried upright.

SAGITTA has two looks (`SAGITTA_SKINS`, js/sprites/sagitta.js): SIEGEWRIGHT (free: a leather cap
with a brass goggle band over dark hair, a work apron over the side's coat) and TOWER BUILDER (rare,
200 coins: the same cut in slate and steel), both on ARMATOS's frame. They are A and C off
sagitta-round1.png in the project files. Her dolls are `Siege` and `Tower` in
app/bake-player/bodies.py; she runs on her drawn frames (`run: 'drawn'`). Her HEAVY ARBALEST is her
basic attack's `art` (`SPRITES.weaponArt.arbalest`, prod left, seen from above and cocked), with a
slanted grid of the same crossbow (`SPRITES.weaponDiag.arbalest`, pointing down and right): she
carries the slanted one low at her hip in every facing, the butt tucked under her arm (`SG_TUCK`
rows of the grid stay undrawn, so the stock never crosses her jaw; `HERO_CARRY`, js/draw/sagitta.js) and aims
in eight drawn headings, the level art in quarter turns or the slanted one (`aimHeading`,
js/draw/bodies.js), never turned to a free angle.

ARCUS has two looks (`ARCUS_SKINS`, js/sprites/arcus.js): WILLOW CUTTER (free: a brimmed felt cap
with a white feather over short brown hair and a beard, a leather jerkin and a quiver on his back)
and FIRST SNOW (rare, 200 coins: the same cut in pale wool, its `pal` repainting the cap, jerkin and
feather), both on ARMATOS's frame. The cut is C off arcus-round1.png in the project files. His doll
is `Fletcher` in app/bake-player/bodies.py (motion `fletcher`); he runs on his drawn frames
(`run: 'drawn'`). His WILLOW LONGBOW is his basic attack's `art` (`SPRITES.weaponArt.longbow`): at rest
he carries its own carried art (`ARCUS_BOW_CARRY`, a shallow D) upright in his leading hand, beside
the body in every facing (`HERO_CARRY`, js/draw/arcus.js). Drawn, it is one of eight set frames on
the snapped aim with the string back and an arrow on it, half then full, and the string straight for
a beat after the shot (`ARCUS_BOW_AIM`; `HERO_AIMED`, js/draw/heroes.js): never a turned sprite. His fine body (`ARCUS_FINE`, one set both paints repaint) holds the same bow at 32 px (`ARCUS_BOW_FINE`, `arcusBowsFine`: the carry and the same headings through `arcusBowAim`, grips and hands still world px).

FABER has two looks (`FABER_SKINS`, js/sprites/faber.js): CLOCKMAKER (free) and WORKS FOREMAN
(rare, 200 coins), both on ARMATOS's frame. `FABER_PAL` is `ARM_PAL` with the leather cap and apron
`a`/`A`, the goggle lenses `C`, the moustache `U` and the hard hat's lamp `S`. They are A and B off
faber-round1.png in the project files. Their dolls (`Clockmaker` and `Foreman` in
app/bake-player/bodies.py) paint the cap in the doll's `hair` material and the hard hat in `hat`;
only the roll is used. His CLOCK STAFF is a staff like IGNIA's: `staff: 'clock'` names
`HERO_STAVES.clock` (`FABER_CLOCK`, js/draw/faber.js), a toothed brass gear (dark hub, one light) standing out from a walnut shaft, whose
wheel turns a tooth on between two baked frames. His two machines draw themselves from small grids baked per
side (`faberArt`, js/draw/faber.js), the side's colour in a band across each.

FALCO has two looks (`FALCO_SKINS`, js/sprites/falco.js) on one set of grids and one doll:
HUNTSMAN (free; row id `falconer`) and LAST HAWK (rare, 200). `FALCO_PAL` is `ARM_PAL` with the
green hat and shoulder cape `q`/`Q`, brown hair `a`/`A`, a leather belt `x` and the hat's long
cream feather `W`; LAST HAWK is the same cut repainted by its row's `pal` (black hat and cape,
silver hair, a gold belt). It is C off falco-round1.png in the project files. Both run as their
drawn bodies (`run: 'drawn'`); his doll (`Falconer` in app/bake-player/bodies.py) is used only for
the roll. His THROWING KNIFE is weapon art
(`SPRITES.weaponArt.knife`, point right, `WEAPON_GRIP.icon.knife`) for the HUD. On the snow his hand
holds its own small art (`FALCO_KNIFE`): hung point down from the fist at rest (`HERO_CARRY`), raised
point up beside the head while drawn and the closed, empty hand down the throw's line for a beat
after (`FALCO_THROW`, `HERO_AIMED`); the shot is drawn by `HERO_SHOTS.knife`. His other hand wears a
tan glove raised beside him with his hawk perched on it while it is home (`FALCO_HAWK`,
`drawFalcoPerch`, `HERO_BODY_FX`): the glove is empty while the hawk is out.

**The 48 px face** (`SPRITES.portrait(cls, team, skinId)`, characters.js) is a hero's own 16 px
standing front in that look (the free one when `skinId` is null) at 3x on a 48×48 canvas, the
same body the world and the HUD strip draw; the lobby stage shows it (`drawLobbyStage`,
js/ui/menu.js). There is no layered model under it. `portrait` keeps what it composes in a cache,
emptied past `PORTRAIT_KEEP` so a ladder card's look or a team repaint never grows it without
bound. The small faces (champ select's grid, its seat discs and ban icons) take `heroHead`
(js/ui/draft.js): ten 16 px columns and rows around the hero's head (`HERO_HEAD16`), drawn at
twice the scale into a `HERO_FACE` cell. A hand-drawn 48 px model
per hero is what would replace it. The champ select's showcase (`drawShowcase`, js/ui/select.js)
draws the in-game body itself, not this.

`docs/media/concepts/model-concepts-1.png` (A BUNDLED, B LANKY, C STOUT) is a **rejected**
concept round for a layered 48 px model, kept as the record of what not to draw again.

**Team colours are palette swaps of those same grids.** `TEAM_SKINS` (two presets, RED and BLUE,
also exported as `SPRITES.teams` so the game code can read the names and marker colours) drives
four baked sets:

**The presets can be repainted live.** `TEAM_PALETTES` holds four versions of the pair (`def`,
and `rg`/`by`/`hc` for colour-blind eyes, picked by `settings.teamPal`); `TEAM_SKINS` holds the
one in force. Every file that bakes from it registers its team bakes with `SPR.onTeams(fn)`,
which runs them at load and again when `SPRITES.setTeamPal(id)` copies a palette into the two
`TEAM_SKINS` objects in place (about 9 ms). The bakes fill the same arrays each time and the
look and portrait caches are cleared, so every reader of `SPRITES.*`/`TEAMS` sees the new paint
on its next frame. A new team-painted set must bake inside an `onTeams` callback, or it keeps the
colours it was born with.

- every hero's pose set (`champLook`'s cache in js/sprites/characters.js): coat/hat/trim swapped
  under the hero's own paint; the cache is emptied and rebakes on its next ask.
- `teamBuild[team][type][tier]` — the tier material with the `k`/`K`/`e` accents repainted, so
  tier still reads as tier.
- `robotTeam[team]`, `robotRanged[team]`, `robotSiege[team]` (js/baked/soldiers.js).
- `merchant[team]` — the eagle's driver ([the merchant](gameplay/robots.md#the-merchant)), below.

A new character or building sprite has to be added to those bakes, not just to the flat `SPRITES`
entry, or it will not wear a team's colour — and every read indexes by `skin(team)` (the
CLAUDE.md hard rule), never the bare team.

**Perch** (`perch.js`) is the drop bird in its one look (`LOOKS.classic`, `SPRITES.perch.look`:
the eagle skins were cut in 0.695), in flight and at the roost: seen from above, the
crew's saddle on its back, a narrow arrow head with no face, and no grids either. It is a stack
of flat shapes (`rell` ellipses, `blade` feathers, `poly`, `rect`) on a 112 px grid facing left,
shaded by rule: a shadow rim away from the top-left light, a lit rim on `hl` parts, a contact
shadow under whatever overlaps from above, an inner line (`lt`) where a part passes over the same
material (`seam: false` melts a part into it instead), one ink outline, and on the ground a tight
snow shadow. A **pose** (`POSE(key)`) moves the wings and tail: `r0`-`r2` the roost's three beats,
`s0`-`s9` level flight's one smooth stroke (`STROKE_N` phases), `d0`-`dDIVE_N` the stoop by its
progress (the wings tuck back off the stroke, hold, then flare to brake), `l0`-`l2` the takeoff's
hard beats; a lifted wing turned from the light steps a tone darker (`litStep`). `frame(id, team,
heading, key, scale)` maps every part from the grid onto the frame through its own affine (posed,
turned to the heading, `scale` px a cell: 1 at the roost, 1.5 in flight), so the pixels never
smear, the light stays top-left and the bird draws 1:1; `shadow` is the same pose's silhouette
flat on the snow at the roost's size; `seat` is where a rider's seat lands on that frame, so a
rider rides its wing; `flash` washes a frame all white into one scratch canvas and `reach`
measures how far it stands up and down from its centre (the roost's hp bar). Frames paint on first use or from `warm` (urgent, or `idle`: the slow queue,
one frame per `IDLE_GAP`) and `tick`, about 5 ms each, within a budget; a bird whose frame is not
painted yet holds its last one, and the least recently drawn go past `KEEP`. A cached frame
or shadow keeps only the box its pixels fill (`trimmed`: the air round the wings was three
quarters of it), carrying where that box sat (`ox`, `oy`) and the whole frame's size (`fw`, `fh`):
draw it with `put(g, cv, x, y)`, `x, y` the whole frame's top-left, never a bare `drawImage`. The team parts read
`TEAM_SKINS`, so the cache clears in `onTeams`. `figure` paints the wiki's. The concept rounds' Python
(perch-landed/src/styles.py, look D, head H) lives in the project files, not the repo.

**The merchant** has its **own grids**, `merchDown`/`merchUp`/`merchSide`
plus `merchFeet` — **16 × 18**, two rows taller than a player — an old trader in a wide flat
**fur hat** (`f`/`F`, twelve wide, the silhouette) with a **team-cloth crown** (`y`/`Y`, the one
team ink and all of it), a white **beard** (`w`/`W`) down the chest, a khaki wool coat
(`r`/`R`/`d`) hanging straight to the hem, boots under it, three frames a direction (the boots
walk, the coat hangs; the side grid faces right and flips), under `merchantPal`. It is look **D**
off the concept sheet in `docs/media/concepts/merchant-concepts-2.png` (the `concept-art` skill
in `.claude/skills/` is how a sheet is made and picked). Nothing on it is a player's coat or hat,
so the side reads off the crown, the nameplate and the bar.

**The merchant's stall** (`stall` in js/sprites/buildings.js, baked per side inside `SPR.onTeams`
as `SPRITES.teamBuild[skin(team)].stall` under `stallPal`) is **48 × 38** over its 3×2 footprint:
a snowy awning in the side's stripes (`y`/`t`, the one team ink) over two shelves of goods, a
lantern, a scale and a planked counter. It is look **D** off
`docs/media/concepts/tent-concepts-2.png` (round 1, `tent-concepts-1.png`, picked the stall
shape; round 2 grew it).

**The axe icon** (`itemAxe`) is an 8×8 grid on `AXPAL`. The axe is drawn at
**1×** by `drawHeldTool()` (inside a translate/rotate, while a swing runs) and by `drawRobot()` for a
bot's swing; the bow is the end screen's kills plate. At rest `drawHeldTool()` draws the **hero's own weapon** instead, a 12×12
`SPRITES.weaponArt` canvas baked in [js/sprites/weapons.js](../../js/sprites/weapons.js) (a blade at
its real length in `SPRITES.weaponHeld`); both sizes go
through the same code because each is turned about where the hand closes on it (`WEAPON_GRIP`, a
hero blade's `hilt`; a work tool's icon about its middle) - the carry rule in `drawHeldTool` that
keeps a weapon off the face.

The **item icons** are one 16×16 grid an item in [js/sprites/item-icons.js](../../js/sprites/item-icons.js),
`SPRITES['item_' + id]` (see [the items](gameplay/the-merchants-counter.md#the-items)),
so a 20 px shop well shows each at 1x. Every site draws one through `itemIcon`, which lays the grid
over a stepped glow in the colour of what the item is about (`itemKind`, js/sim/items.js; the stat
strip's own inks, deepened, `ITEM_GLOW`): light behind the subject and dark at the edges, centred on
the subject's own middle, the ability icons' backing. The colour says what an item gives, the shape
which item it is. One ink for all of them: a dark outline, flat lit planes on
the top-left and shade on the bottom-right, and the material says the stat (steel and wood for
damage, hide and fur for health, plate for armor, amber and violet for ability power, glass for
cooldown speed, leather for boots). Each carries its own small palette beside its grid. The grids
began as a primitives-and-shading script (kept with the shop's concept sheets in the project
files) and are hand-editable sprites now. The potion keeps its own flask (`itemPotion`).

**The pine is twenty-four bend frames of one tree**, and the first of the imported sprites — the
others are the gold sack, the three animated goods and both prey, below:
`treeSway` is `docs/media/new_media/001.png` cropped to **27×37**, snapped onto
`TSPAL` (fourteen colours, `bake`d like everything else), and then **sheared** into its other
frames. It draws at
`(px - 5, py - 21)` with its trunk on the tile's centre line, and **through `SPRITES.treeAtlas`,
never through `SPRITES.tree`** (the one-texture rule;
[rendering.md](rendering/drawing-a-thousand-of-something.md)).

The array is a **ladder, not a cycle**: index 0 is the tree thrown fully left, 23 fully right, 11
and 12 are it standing up. A frame here is a *lean*, so `treeFrame` maps the wind's signed sway
onto an index directly and a gust lays every tree inside it over the same way. The shear is a **tip-loaded cantilever** rounded per row: a row `h` of
the way up from the base moves `2.6 * (3h² - h³) / 2` px, which is zero slope where the trunk meets
the snow, all of the curve in the crown, and 6 px of travel at the tip end to end. Rows cross their
rounding thresholds at different heights, so 21 of the 24 frames are distinct pixels.

Every frame being the same tree, each atlas row holds **forty-eight**: the 24 again, mirrored, with
the tile's `hash2` sending half the forest into them. `TPAL` above it stays: it still dresses the
`stumps` a felled pine leaves (three cuts, picked and nudged by `stumpLook`, js/draw/ground.js).

**No pine draws in `TSPAL` as is: it is the source of twelve palettes** (`treePals`), one atlas row
each for each height (row = size × 12 + variant × 4 + tone), filtered in OKLCH at bake time rather than drawn. The drawn pine
ran from a near-black outline to near-white snow, which read as a foreground object; the three
**variants** Noah picked from `docs/media/concepts/tree-filters-2.png` lower that contrast and keep
the colour, because a desaturated pine turns to mud under the night grade (round 1,
`tree-filters-1.png`, is the grey version that was turned down). **B** gives the outline a dark
muted green, lifts the needle darks to an L floor of 0.40 and brings the snow down to a soft
blue-grey band; **C** adds a hue shift by value (shadows toward teal, lights toward yellow-green);
**D** takes C to 80% colour and mutes the trunk. Each comes in six **tones** by forest depth
(`TREE_TONES`, a needle and a snow L shift): the deep is the filtered look itself, the ring inside the edge
+0.035, the edge +0.07, and the **heart** (forest three tiles each way) drops its snow into shade so a wide wall is one dark mass with a lit rim, the **hollow** is darker again and the **ridge** has needles and snow back in the light (where the deep forest's swell sinks and lifts) — nine pines in ten stand deep, so darkening the deep instead would darken
the whole forest. Which row a tree wears is decided on its tile at draw time
([rendering.md](rendering/render-pass-order.md)). `SPRITES.tree` is variant B's deep row. `SPRITES.treeGlow` is the snow and lightest needles alone in a warm white, a row per height: what a crown wears at dawn and dusk (`treeArt`, js/draw/ground.js) so the hour's grade warms it with the drifts.

**The pine stands in three heights** (`TREE_CUTS`/`treeSizes`): the drawn tree, one without its
middle tier of boughs (30 rows) and one without its bottom tier (26). Each is cut from the tree
standing straight, set on the cell's floor and leant again by the same cantilever, so every
height shares the 27×37 cell and the draw offset. Which height a tile wears is `treeSize`
(js/draw/ground.js): half a slow noise, so heights stand in groves, half the tile's hash.

Which frame a tree is wearing is decided by the
wind, not here - [rendering.md](rendering/drawing-a-thousand-of-something.md#the-wind-field).

**The gold sack is the merchant's mark.** `SPRITES.goldSack` is
`docs/media/new_media3/bag_of_gold_bouncing.png` — a 320×32 strip — split at 32 px into the ten
frames of `sack` and snapped onto `SACKPAL` (twelve colours: an outline, five cloth, two cord,
three coin, one shine). Unlike the
pine the **source order IS the animation order**: it was drawn as a loop, and the cloth barely
moves while the coin in the neck of the sack glows, so the cycle reads as light catching gold
rather than as a bag being jostled.

Its only caller is GOLD's figure on the wiki's world page (`WIKI_WORLD`, js/ui/wiki.js, its last
frame as a still), where **16** is the size that reads, so the 32 px source was **resampled
offline to 16×16** and snapped onto `SACKPAL` before it ever reached this file.

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

**The gold piece is a loop rather than a stamp**, off a 16×16 strip and shipped at the
**8×8** every other bag icon is, so what changed is the art and not the fit. It is resampled
from `docs/media/new_media3/`. (The berry loop went with the food pouch, and the old
finning ice-fish loop off `fish.png` with the ice fish in 0.444.)

| icon | source | frames | palette | the loop |
| --- | --- | --- | --- | --- |
| `itemGold` | `gold_nugget.png` | 8 | `NUGPAL` (14) | a shine crossing the face |

They are exposed as **live canvases**, and that is the whole trick. `SPRITES.itemAnim[key]` holds
the frames; `SPRITES[key]` is one canvas per icon that `stepItemIcons()` (js/draw/render.js) stamps the
current frame into, once a frame, before anything draws. So `SPRITES[icon]` — how the
purse, a shop price, a sale row, a tooltip and the wiki all reach an item icon —
stays **one generic read**, and no call site has to know which goods move. Handing those
reads a frame array instead would mean teaching every one of them about a special case; a moving
icon is not special, it is an icon that happens to move. One clock drives all of them
(`ITEM_FR`, 100 ms), so every coin on the screen is on the same beat — a dozen icons each looping
to their own is a fruit machine, not a HUD — and a frame that has not changed is not redrawn.
Each canvas starts on frame 0, so a panel that bakes an item icon into a still image at boot gets
a picture rather than a hole.


**Wildlife is side-view only, and its frames are named CLIPS.** `SPRITES[kind][dir]` is an
**object**, not a flat list: one array per behaviour, every kind carrying at least `idle` — the
frame anything asking for "the beast" takes (the wiki's cards read `.right.idle[0]`). Which clip
is playing is the animal's business, not the sprite's: js/sim/wildlife.js sets `a.clip` from what the
beast is doing (`ANIM_CLIPS`, [gameplay.md](gameplay/wildlife.md#what-a-beast-is-doing-the-clips)) and
`clipFrame` in js/draw/bodies.js plays it. `bakeClips` builds a set and `mapClips` walks one — the
mirror for `left`, the bears' `right` below.

The **rabbit** and the **deer** are imported: three sheets each out of `docs/media/new_media3/`,
snapped onto `RBPAL` (eleven colours) and `DEPAL` (thirteen), source order the animation order.

| kind | clips (frames, and the sheet each came off) | source cell | **ships at** |
| --- | --- | --- | --- |
| `rabbit` | `idle` 10 `bunny…gently_look_around`, `hop` 6 `…hopping_right`, `rise` 8 `…stand_up_and_wiggle` | 28×30 | **11×12** |
| `deer` | `idle` 10 `deer…gently_look_around`, `graze` 12 `…grazing_loop`, `run` 12 `…galloping` | 38×38 | **38×38** (its own cell, snapped onto `DEPAL` 1:1) |
| `wolf` | `idle` 1, `run` 2 | — | 16×13 |
| `alpha` (the bear) | `idle` 6, `walk` 8, `run` 6, `bite` 10, `paw` 10, `roar` 8 | a painted rig | 110×76 |

The rabbit is [resampled offline](#the-offline-resample) — at its own cell size the bunny stands taller
than a 16 px player — and the deer only snapped, never scaled: the stag ships at its full cell, twice a player's height, so it reads as the animal you can ride ([riding](gameplay/wildlife.md#riding-a-deer)). The **rabbit ships at 11×12**, deliberately
shy of half its source: a bunny the height of the hero read as a hare the size of a dog, and the
stag beside it is the animal that is meant to look big. Each kind's three sheets share **one
crop** — the box every frame of every clip fits inside — because a clip taking over on a different
crop would jump against the one it replaced. The deer keeps its whole 38×38 cell (the gallop
reaches column 0, the graze column 37); the rabbit is trimmed to 28×30, which still holds the ear
tips the hop throws up.

The wolf keeps its hand-drawn grids (a shared `wolfBody` plus three leg rows per frame): an idle
and a two-frame gait. Left variants are `flipH` of the right-facing frames.

The warrens' **snowdrops** ([world.md](world.md#camps)) are painted by
`app/bake-snowdrops/paint.py` (Python with numpy and Pillow): distance-field shapes at 8×
supersampling (two leaf blades, one bold crook, the bell, a pale shadow pool) filled in two flat
tones lit from the upper left, no ink line. The bloom is a sunny gold with a white lip so it reads
on snow, the leaves a fresh green, the shut bud a dull bronze. It writes four transparent 24×24-cell
atlases beside itself; `node
app/bake-snowdrops/bake.js` reads them (zlib, no packages) and writes js/baked/snowdrops.js as
char grids and one palette, baked at load like every other sprite. Four variants (two shapes,
each also mirrored), each **shut** and **open** at three wind leans and once **picked**, plus the
open bloom's **glow**: a halo of sparks round the bell at `GLOW_N` (6) phases per lean, and the
open **bell** alone at each lean with `at`, the point in the cell its light centres on. The bell,
the glow and the light are laid above the night grade by `litSnowdrops`
([rendering](rendering/light-and-weather.md)). Feet at the tile's (8, 15). The render picks the lean off `windSway` and jitters each clump inside its tile
by its own hash. Repaint and rebake; never edit the grids.

The camp's [bear](world.md#camps), the black (`alpha`), lives in
js/baked/bears.js and are **generated, not typed**: `app/bake-bears/bake.py` (Python with numpy)
paints a bear as shaded ellipse parts, poses them as a cutout puppet (IK legs, body tilt, head,
jaw), renders each pose at 8× and shrinks it to the game's pixel, banding the shade into the
palette measured off Noah's reference sheet. The rig is laid out in the units of the 1× bear the
reference was measured at and drawn `S` (2) game pixels to the unit, so the bear stands twice that
size at the game's own pixel. The black bear is the same frames recoloured,
wearing its antlers and back runes as exact stickers on their bones, each sticker pixel an S×S
block. Both are drawn facing
left, so `right` is the `flipH` there, and every frame of both shares one 112×76 box, centred on the standing bear, so the feet
never jump between clips. The box's headroom is for the rear-up; each frame carries `top`, the
empty rows over the standing head, where `drawAnimal` hangs the tells, and `crown`, the empty rows
over that bear's tallest pose in any clip but the roar (bake.py measures it per bear on every rebake), where the
frame sits, still, so a lunge, the claw trail or any new clip never climbs into the bars.
The roar's rear-up is far taller than the bear; a frame held clear of it floated off the body, so the
one-off wake-up passes behind the frame instead. The
paw's claw trail and the bite's snap are baked into their frames (`SM`/`SD`, white slashes with an ink edge one game pixel wide). Change the rig and rebake; never edit the grids.

The three camp props are
`deadTree` (two 16×24 snags on `DTPAL`, now only the wiki's THE WORKS figure) and `den` (A ROCK MAW of [den-concepts-1.png](../media/concepts/den-concepts-1.png): a 32×21 snow-capped boulder cave with icicle fangs over its mouth, on `DNPAL`, drawn at `py - 4` over its two tiles — the concept's trampled-snow rows were left off, because a decal must not cast a shade) and `hogHut` (eight 35×35 frames of the HOG HUT's chimney smoke on `HHPAL`, converted 1:1 from docs/media/new_media5/hog-hut-chimney-moving.png and drawn centred over the front row of its 2×2 footprint).

Anything drawn through `drawSpriteFlash()` must stay within **64×64**: it recolours through a
shared 64×64 scratch canvas and a larger sprite clips ([rendering.md](rendering/render-pass-order.md)).

**New sprites bake beside the code that draws them, not here.** The zipline pylon (js/draw/zipline.js)
and the practice dummy (`DUMMY_SPR`, js/draw/practice.js)
paint their char grids onto their own canvases and assign into `SPRITES`, which works because it
is a plain object - exactly what each js/sprites/ file does for its own keys (the paragraph
below), so a sprite that belongs to a drawer can live beside it. The detailed 32×32 ability icons (`AB32_PAL`,
js/draw/abilities.js) bake lazily beside their drawer.

**The story landmarks** (`landmarks.js`, palette `LMPAL`) are E of
`docs/media/concepts/landmarks-concepts-1.png`: the rowboat (50×24 over 3×1). The paint on the hull is a
weathered rust, never a saturated red, because red and blue are the teams' inks. The other
candidates (C, the ice-fishing shack, stood in the game until 4.12; A, the slat sled, until 4.34) live only in the sheet. How they stand on their tiles:
[world.md](world.md#story-landmarks).

## The shape of a sprite file

`js/sprites/core.js` loads first and makes two globals: the empty `SPRITES` registry and `SPR`,
the helpers every art file shares — `bake`, `flipH`/`flipV`, `pixelsOf`, `keepPixels`, `cpuTwin`, `bakeClips`, `mapClips`,
`liveIcon`, the `TEAM_SKINS` table and `teamBuildPal`. Each art file
is a private IIFE with the same skeleton: destructure what it needs off `SPR`, its palettes and
grids under `// ---- name` banners, the set builders, and at the bottom one
`Object.assign(SPRITES, { ... })` naming every key it owns. Nothing reads another file's grid, so
they load in any order after core; a new sprite goes into the file that owns its subject and its
key onto that file's `Object.assign`. A file an `app/bake-*` script writes sits in js/baked/
(the table names its baker) and is never edited by hand. The one exception is `motion.js`, which is data only: the
run and roll grids on `SPR.motion`, loaded right before characters.js, which bakes them
([the run and the roll](#the-run-and-the-roll)).

Every key here is read: `app/check-dead.js` fails a key registered on `SPRITES` that nothing
reads, and a dynamic `SPRITES[expr]` read must be listed in its `DYNAMIC` table with the table
that feeds it ([app/](architecture.md#app)), so a sprite whose feature goes is deleted
with it.

| File | Banners | Registers |
| --- | --- | --- |
| `motion.js` | none: generated by app/bake-player/bake.py | `SPR.motion` (not `SPRITES`: the run, held run and roll grids of every hero look, the bobs and the roll's timing, for characters.js) |
| `characters.js` | paint, run and roll, heroes (then the merchant) | `champLook` (a hero's set, with its `run`/`hold`/`roll`), `portrait`, `merchant`, `motionBox`/`runBob`/`holdBob`/`rollAt` |
| `armatos.js` and one file per hero | none: top-level globals | the hero's `*_SKINS` rows, palette and held art, which its `CLASSES` row names (armatos.js also holds `heroWalk`, `heroRunSide`, `heroRunFront`, `heroLegTop`, `heroBreath` and `heroCloth` for every hero) |
| `terrain.js` | trees, the dead snags, the den, the hog hut | `tree`, `treeAtlas`, `stumps`, `deadTree`, `den`, `hogHut` |
| `beasts.js` | rabbit, deer, wolf | `rabbit`, `wolf`, `deer` |
| `bears.js` | none: generated by app/bake-bears/bake.py | `alpha` (black bear) |
| `orca.js` | none: generated by app/bake-orca/paint.py | `orca` (`breach`: `open`/`shut` side-on, head up and left, `openR`/`shutR` their mirrors, `jaw` the pixel between the jaws in the `bcell`; `shade(heading, step)`, 64 headings from east clockwise, 8 steps of the flukes' up-and-down beat, in `cell` squares, packed run-length and baked on first use); look D BOLD off `docs/media/concepts/orca-concepts-2.png` |
| `cistern.js` | none: generated by app/bake-cistern/paint.py | `cistern` (`geo`, the ring's measures in tiles the sim reads; `flat`, the sills and every shadow, one canvas; `segs`, the standing stone cut into pieces two ground rows deep, each with its y-sort key `k`; `solid`, the footprint as on/off runs per ground row; all in px of a box `rb` round the crossing); a heightfield painted per world px in the 3/4 view, look H CUT BLOCKS off `docs/media/concepts/cistern-concepts-4.png` |
| `snowdrops.js` | none: generated by app/bake-snowdrops/bake.js | `snowdrop[variant]` (`closed`/`open` at three leans, `picked`, `glow[lean][phase]`) |
| `soldiers.js` | none: generated by app/bake-soldiers/bake.py | `robotRanged`, `robotSiege` (per team: 2 loaded, 2 spent; the cart's 4 more mirrored), `robotAx` |
| `perch.js` | palettes, shapes, the bird, poses, painter, cache | `perch` (no grids: painted in code, below) |
| `items.js` | items, gold nugget, gold sack, axe icon | `itemPotion` (the health potion's 11×12 flask), `itemAnim` + the gold's live icon, `goldSack`, `itemAxe` |
| `buildings.js` | the barracks bay, soldiers, the merchant's stall, fire | `teamBuild` (`spawner`, `stall`), `robotTeam`, `robot`, `fire` |
| `landmarks.js` | landmarks | `landmark` (`boat`) |
| `icons.js` | cursors | `cursor`, `cursorShadow` |
| `item-icons.js` | item icons | `item_<id>` (one a `BUILD_ITEMS` entry) |

The grids are **pure ASCII and byte-fragile**: `bake()` sizes each canvas from `rows[0].length`
alone, and an unmatched palette char is indistinguishable from a transparent pixel, so a row that
gains or loses a character silently shifts that grid row sideways. Move a row whole, never re-wrap
or re-indent one, and keep the files ASCII.

