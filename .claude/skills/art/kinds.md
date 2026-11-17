# What changes with the asset

Read only your kind's section. Each one says how that kind is drawn, its size, where its pixels
live, how steps 4 and 5 of the `art` skill look for it, and Noah's standing calls. A call with a
date is his own; change it only when he says so.

- [Creatures](#creatures)
- [Heroes](#heroes): bodies, weapons, skins
- [Soldiers, machines and buildings](#soldiers-machines-and-buildings)
- [Props and scenery](#props-and-scenery)
- [Terrain and places](#terrain-and-places): ground, a camp, a base, a shop
- [Icons](#icons)
- [HUD and menus](#hud-and-menus)
- [Effects](#effects): an ability's look, a hit, a status

## Creatures

- **Drawn** as flat shapes on the 1x grid with `app/art/px.py`, face by hand-set `patch`. Not lit
  tubes (`app/media/paint.py`): rejected twice for living things. The game mirrors a beast to face
  left, so its light comes from straight above, never from one side.
- **Size.** `KIND = 'pack'` 11 to 22 px tall, `'big'` 26 to 48, `'hero'` (a hero-sized beast) 14
  to 22. A hero's body is 16.
- **Lives** as hand grids in `js/sprites/beasts.js`; a beast with many frames keeps a baker
  (`app/bake-bears/`, `app/bake-orca/`).
- **Judge** with `review.py sprite --kind beast`, beside the wolf, rabbit and bear
  (`stage.js --refs`). Side-on, flipped for left. The library holds only three kept beasts, all
  from his pictures, so a pass here is weaker than for a hero or a machine.
- **Noah.** Every creature he kept (deer, rabbit, bears) began from a picture he supplied. Without
  one, say so and ask before round one: three drawn rounds missed his bar (11-10), and the method
  read well at 35 to 45 px and poorly at 16 to 22. Bears keep today's silhouette, face and size.
  Beasts are noble animals.

## Heroes

The bar is ARMATOS. Read `js/sprites/armatos.js` first.

- **Drawn** as hand-set 16 px grids on Armatos's frame and palette (`ARM_BODY`, `ARM_PAL`), front,
  back and side. Flat lit and shade planes, no two-colour dither on a torso this small. Ink is
  `#2e2440`. `px.py`'s `patch` takes a whole grid, so `round.py`, the board and `stage.js` work.
- **Proportions** within a quarter of Armatos. Head 5 rows and shoulders 8 wide; a 6-row head on
  10-wide shoulders reads chibi. One signature shape and one colour make a hero recognisable
  (FORTIVA's chain crown, BELLA's ponytail). Team colour is 16 px or more from every facing, as
  cloth or gear.
- **Side views**, measured by pixel count, never by eye: the head as wide as the front, the body
  about 2 px narrower (ARMATOS: front 10, side 8), no nose past the head's outline. The side run
  comes off the drawn side frame (`heroRunSide`); a look the doll's front run does not match
  takes `run: 'drawn'` on its skins row.
- **The weapon** is held in the hand in all four facings, grip visible: a `HERO_BLADES` row (flat
  and slanted art, the `hilt` on the flat art, the hip by facing), or a mage's `HERO_STAVES` row
  named by `staff:` on the `CLASSES` row. Keep the weapon Noah picked.
- **Options** (step 5): three bodies and three weapons as real 16 px grids, staged in a real game
  frame beside players (the worked round: `/mnt/project-files/armatos/round4/`). He rejected 3D
  renders and 32 px art for this: show what the game will draw.
- **Lives.** The pick becomes `<HERO>_BODY` grids and a `<HERO>_SKINS` list in
  `js/sprites/<hero>.js` (default look `price: 0`; first buyable skin `rarity: 'rare'`, 200
  coins), named by the file's `heroArt` row. Each look gets a doll in `app/bake-player/bodies.py`,
  then `python app/bake-player/bake.py`: the rebake may only add lines to `js/baked/motion.js`,
  every other hero's frames stay byte-identical. More in
  [sprites.md, Hero looks](../../../docs/dev/sprites.md#hero-looks).
- **Judge** with `review.py sprite --kind hero`: the front frame, among the heroes he kept.
- **Verify** the four facings, running, rolling, every look, both teams. Turn off respawn `invuln`
  before capturing, or the body draws faded.
- **Reads wrong on snow.** Light cloaks and white-only marks vanish. An appendage at shoulder
  height reads as a waving arm, thin ribbons as tentacles, red with white trim and a belt as Santa.
- **Known gap.** The 48 px portrait is the 16 px front at 3x; no hero has portrait art of its own.

## Soldiers, machines and buildings

- **Drawn** with the cutout painter `app/media/paint.py` (parts at 8x, banded to locked ramps):
  right for things made of tubes and plates, as the pump and the tower. A robot is drawn with
  `app/art/px.py`: a flat hand grid at hero size and under, as the headlamp; above that its masses
  are set by hand and its surfaces modelled on the same grid (`ramp`, `model`, `glint`: a boiler
  is `cyl_h`, a lens is `ball`), lit from straight above because the game mirrors it. The worked
  example is `/mnt/project-files/art-quality/work/boss.py`.
- **Camera.** A big building is drawn in the game's own view: its top and its south wall. Never a
  side or front view unless Noah asks.
- **Lives.** Its painter is a baker, `app/bake-<thing>/`, writing `js/baked/`. What it *is* lives
  in its `STRUCTS` or `BUILD_ITEMS` entry. Team paint rides shared palette letters swapped inside
  `SPR.onTeams` (`teamBuildPal` for buildings, `teamRobotPal` for soldiers).
- **Judge** with `review.py sprite --kind machine`, beside a hero for scale, in both team colours
  and unheld grey. He kept the small ones with one lamp or one idea (the headlamp, the pump) and
  turned down the blocks of team colour (siege E, F, G).

## Props and scenery

- **Drawn** as flat shapes with `app/art/px.py`, `KIND = 'prop'`, in the game's own materials
  (`GAME`: ice, snow, pine, wood, stone). A prop never turns round, so it is lit up-left. Above
  hero size its faces are modelled (`model` with `slope` for a flat face, a bright ridge between a
  lit face and a shaded one). It is outlined in its own darkest colour, not ink, and the snow at
  its foot has no outline, so it stands in the scene (`outline_by`; name the snow letters in
  `BARE`). The worked example is `/mnt/project-files/art-quality/work/ice.py`.
- **Lives** as grids in `js/sprites/terrain.js` or `landmarks.js`, with an `OBJECTS` entry saying
  what it is, placed through `placeObj`. A sheet of many same-sized sprites bakes through
  `SPR.bakeSheet`. Variety between tiles reads `hash2`/`vnoise`, never the local machine.
- **Judge** in a real spot among the pines, day and night, with a hero walking past;
  `review.py sprite --kind prop` gives a plain blind read until the library holds a prop.
- **Noah.** Scenery starts sparse; add more only when asked. The winterberry bush is never in the
  game.

## Terrain and places

A place (a camp, a base, a shop, a pit) is judged as a frame, never as a sprite.

- **Built** in the running map, not on a board. See it with
  `node app/see/see.js --spot <place> --time day,night --out W` (far, as played, close;
  [see.md](../../../docs/dev/see.md)); try a look before building it with
  `--put FILE.png@dx,dy:ground|stand`; after a code change add `--vs origin/main`. `--map` is the
  whole map with every place named.
- **Lives.** Ground paint is `js/draw/ground.js`; a ground edit goes through `repaintGround`. A
  worldgen pass rolls on its own `worldRng(name)`, so the map is the same on every screen.
- **Judge** (step 4) by [the seven rules of a place](../../../docs/dev/art-bar.md#a-place): the
  owner is the landmark, a room with a mouth, its own floor, the way in is drawn, a quiet canvas,
  it makes sense, and the epic one is one of a kind. Then `review.py frame --kind place` (a whole
  map: `--kind layout`): the reader says what the eye lands on first and whose place it is. The
  library holds one kept place, so the reader's call is weak and the rules decide. Turn on
  hitboxes (`.`) and check the art agrees with what the sim tests. Both bases mirror.
- **Options** are stills of the real spot, A beside B, labelled STAGED, with today's first: the
  `vs-*` sheets `see.js` writes are that pair.
- **Noah.** Camps and lairs have no built props: the world's own pines and ground make the pocket
  ("think about how League shows its camps"). His words on places are in
  [the bar](../../../docs/dev/art-bar.md#noahs-words).

## Icons

- **Ability icons** are drawn on the 32 grid to the rules above `AB32_PAL` in
  `js/draw/abilities.js`: one bold subject with an ink outline and two or three flat tones, filling
  the well's open box, on a stepped glow in the hero's own colour (`abGlow`). Colour says who, not
  what. No scenes, no thin lines.
- **What it does** goes in the row's `mark`: the same status icon the rival's health bar shows
  (`STATUS_ICONS`) or a kit mark (`AB_MARKS`), and only when the picture does not already say it.
- **Lives.** Ability grids in `js/sprites/<hero>.js`; item icons in `js/sprites/item-icons.js` as
  `item_<id>`.
- **Judge** in the real HUD strip at 1080p, and with `review.py sprite --kind icon`, old and new
  together (a plain blind read until the library holds icons). Bold
  art alone did not beat the old icons; bold art plus the mark did (11-10).
- **Noah** approved this method on 11-10 (`/mnt/project-files/hero-icons/method.md`) and had the
  thinnest icons redrawn bold.

## HUD and menus

- **The look** is Graphite: flat, opaque plates in the values at the top of `js/ui/strip.js`
  (`AB_BG`, `HUD_INK`, `HUD_EDGE`). No bevels, snow caps, steel edges or always-on highlights.
  Icons, team colour and gold carry the contrast, never the frame.
- **Show, don't label**: read [the page](../../../docs/dev/rendering/show-dont-label.md) before
  adding a word. Text is for names, numbers and headlines, through the `TEXT` table.
- **Pixels.** Layout reads `VIEW_W`/`VIEW_H`; zoom never scales the UI. Circles step evenly, and a
  badge with a digit has an odd diameter so the digit sits centred: check both at 1x. Overhead UI
  scales with the creature, sits close above it and never overlaps the health frame at any zoom.
- **Built** in the game and captured from the real screen. There is no board for a HUD part.
- **Judge** (step 4): `review.py frame --kind hud`. The reader gets the screenshot and is asked
  what each part is and what it does. A control it cannot name needs a better shape, not a label.
- **Options** are stills of the real screen, A beside B, with today's first.

## Effects

An ability's look, a hit, a status on a body.

- **Drawn in code**, in the hero's `js/draw/<hero>.js`: a landing that names `fx` is painted by
  `AB_FX_LOOK[fx]`, with the shared strokes in `js/draw/abilities.js` (`drawSwoosh`, `drawFlung`,
  `drawCracks`, `fxTail`, `fxInked`). The sim decides and never draws; a new `state` key a client
  shows joins `SNAP_STATE`, and `DBG.netEcho()` must still show zero pixels differ.
- **Each key is the thing it is**, unique to its hero. Fewer generic rings: a circle only where it
  is the clearest read (a heal's reach, a zone). Lines keep their true range.
- **Colour** says what it does: damage red-orange (`TELE_COL`, turning `TELE_HOT`), control ice
  blue, heal green, shield gold, movement white. Every light colour gets an ink rim on snow.
- **No blood.** No loose red pixels, no white straight shape with a red tip. A hit is a spark, a
  flash and a sound. Debris is chunks of the thing's own material; nothing is rotated by a free angle.
- **Judge** as frames over time: step the scene with `DBG.step` and lay the frames in a strip
  (`app/media/gif.py`) at game zoom, then `review.py frame --kind effect`. The reader is asked what
  happened and who it hurt.
- **Options** are staged strips, A beside B, labelled STAGED.
