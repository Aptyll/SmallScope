# Making art

How a sprite is drawn, looked at and improved, and why it is done this way. The procedure, for
every kind of visual asset, is the `art` skill ([.claude/skills/art/](../../.claude/skills/art/SKILL.md):
see, brief, draw, judge, options to Noah, ship); what differs for a creature, a hero, a building, a
place, an icon, a HUD part or an effect is in its
[kinds.md](../../.claude/skills/art/kinds.md). The tools are in `app/art/`. A hero is `new-hero`,
which draws with this.

## What was tried

The same beast was drawn by each method and shown unnamed to a reader who knew nothing about it
(the blind read, below). Rounds are kept in the project files under `art-pipeline/proof/`. The two
worked examples of modelled surfaces are `art-quality/work/boss.py` and `ice.py`.

| method | what it gave | verdict |
| --- | --- | --- |
| lit volumes painted at 8x and shrunk (`app/media/paint.py`: tubes, domes, lenses) | sausage legs, a head too small for a face, light rising from every edge. The boar read as "a farm pig or a possum" | rejected by Noah twice (camp beasts, snow beast heroes). Still right for machines and buildings (the pump, the tower), which are made of tubes and plates |
| paint big, then downsample | soft fringes and colours the palette never had | rejected earlier ([sprites.md](sprites.md), the rabbit's note) |
| 3D render to pixels | clean props, off-style characters | rejected for characters |
| a posed rig of shaded parts fitted to a reference picture (`app/bake-bears/`) | today's bears | works when Noah supplies the reference; without one there is nothing to fit to |
| flat shapes set on the game's own pixel grid, hand pixels for the face (`app/art/px.py`) | the boar read as "boar, clearly" from its flat shape alone and ranked first of every tile | **the method** |
| the same flat shapes left flat on a sprite of 24 px or more (the hollow boss, the shop stalls, typed as letter grids) | blocks of one colour with two tones a material and colours typed for the occasion; beside the pump and the tower it reads as a placeholder | not enough above hero size: the masses stay hand-set, then their surfaces are modelled on the same grid (`ramp`, `model`, `glint`, below). The boss redrawn this way ranked above the old one and above the pump in a blind read; ice drawn this way ranked above the pine |

Two things that were measured and are worth knowing:

- **No ruler tells good art from bad.** Colour count, lone pixels, outline cover, pillow shading and
  value range were measured on today's deer, bear, rabbit and wolf and on the rejected rounds, and
  none of them separates the two groups. `check.py` therefore fails only what is certain (below).
- **The author cannot judge the read.** The first BRUMA redraw passed every check and looked right
  to its author; the blind reader called it "a guinea pig in a cape" and "a sitting plush toy". The
  second round was drawn from those words.

- **Size decides where the quality is.** At hero size and under (the headlamp, a plant) a typed
  flat grid is already near its ceiling: the headlamp redrawn with modelled brass was not visibly
  better. What lifts a small sprite is its design, its motion and how it sits in the snow. From
  about 24 px up the surfaces carry it, and a flat grid there is the fault.
- **The blind read tests the read, not the craft.** Every flat round passed "what is it". Ask the
  reader to rank the tiles best-drawn to worst with today's neighbours among them (the pine, the
  pump): a new sprite that ranks under its neighbours is not ready, whatever it reads as.

Every creature Noah has kept so far (deer, rabbit, bears) began from a picture he supplied. This
method is for when there is no picture. When there is one, fit to it. The surface tools are proven
on machines, ice and props; an animal's faults were its anatomy (post legs, shadows cut as
polygons), which no tool here draws for you.

## The style

One family, on today's sprites. Measure against them in a real frame, never from memory.

- **Drawn at 1x.** Every edge lands on a pixel the first time. Nothing is scaled, rotated or blurred.
- **Shape first.** The flat silhouette alone must say what it is: legs apart with ground showing
  between them, a head that stands clear of the body, one feature no other sprite has (the boar's
  mane and tusk, the deer's antlers). A shape that is a loaf is not saved by colour.
- **Build it as an animal.** A beast is a front mass and a back mass joined by a back line, a neck,
  a head carried at its own height, and legs with a bend. Shoulders higher than the rump or the
  other way round, never level. Far legs are dark and stand in pairs with the near ones, not in a
  comb of four.
- **Light is a shape, placed on purpose.** One sheet of light over the top of the animal, a shadow
  under the belly, and a dark crescent where one mass turns behind another (behind the shoulder, in
  front of the ham). Three to six working tones. No gradient from every edge, no dither.
- **Above hero size a surface is modelled, not filled.** A boiler is a barrel (light a quarter of
  the way down, darkest just above the bottom, a row of bounce under it), a lens is a ball, a blade
  of ice is a lit face and a shaded face either side of a bright ridge. The mass is still the
  shape you set by hand; `model` only moves its pixels along the material's own ramp. Then the
  marks a hand leaves: a strap and its thin shadow, a knee collar, a crack, and the glints, which
  are always placed pixel by pixel in the ramp's lightest colour.
- **The light is the world's.** From above; and for what never turns round (a prop, a building,
  terrain) from the left as well, as the footings and the kerbs are lit. A sprite the game mirrors
  to face left (every beast) is lit from straight above, or its light would swap sides with it.
- **Colours come from the game.** A material is a ramp of four to six colours, dark to light, and
  the game already has them: `GAME` in `px.py` holds pine, snow, ice, wood, stone, iron, brass, fur.
  Take the ramp, do not type a hex. A new material is built round one base colour with `mkramp`,
  whose shadows turn toward blue and gain colour while its lights turn warm and pale, as the kept
  art's ramps do; a ramp that only darkens goes muddy.
- **An outline belongs to what it wraps.** One pixel, outside the art: ink `#2e2440` on heroes
  (ARM_PAL) and on what is built; a near-black of the beast's own hue on beasts; its own darkest
  colour on what grows or freezes (the pine is ringed in dark green, ice in deep blue), so it
  stands in the scene instead of on it like a sticker. Snow lying on snow has no outline at all: a
  line round a drift makes it a plate (`outline_by`).
- **A face that reads at 1x.** Head a third of a hero-sized beast, a quarter of a big one. A dark
  eye on light fur, or a light eye in a dark socket; yellow on tan vanishes. Nose on top of the
  muzzle: two dark pixels one above the other read as an open mouth.
- **One accent colour** per beast. On a hero the accent is the team colour, 16 px or more from every
  facing, as cloth or gear the character would own.
- **Dark to mid on snow.** Nothing light sits on the border without ink round it.
- **Scale.** A hero's body is 16 px tall on its cell and stays that size ([sprites](sprites.md#hero-looks)). Pack beasts 11 to 22, big camp beasts 26 to 48, a
  hero-sized beast 14 to 22.
- **No blood.** No spirits, totems or occult marks. Beasts are noble animals.
- **Lone pixels are noise** unless they are an eye, a glint or a nostril.

## The tools

| file | what it does |
| --- | --- |
| `px.py` | the painter: `Art(w, h, PAL)`, flat shapes (`blob`, `poly`, `ell`, `rect`, `line`), `only=` to keep a shape inside what it shades, `rim` for one row of light, `patch` for hand-set blocks, `outline`, `swap` for the other team, `js()` for the grid the game takes. Surfaces: `ramp(name, letters)` names a material (the game's own from `GAME`, or built by `mkramp`), `model(of, form)` lays a form's light over a mass (`cyl_h`, `cyl_v`, `ball`, `slope`), `step` moves an edge or a box of it darker or lighter, `glint` sets the highlights, `outline_by` gives each material its own outline or none. `Art.from_png` turns a sprite cut from the game into a grid to edit |
| `cut.js` | today's sprites out of the running game as 1x PNGs, by name (`--list`, then `--out DIR scrap.left.idle`): where a redraw of anything in the game starts |
| `bench.py` | the sprite big enough to count its pixels, a ruler down two sides, beside the neighbours it must stand next to at the same zoom, then all of them at 1x, 2x and 4x. `round.py` writes it as `bench.png` |
| `round.py` | one round of an asset file: paints every view, runs the checks, builds the board, with `--frame` the real game frames, with `--keep` saves the round so the next is judged against it |
| `board.py` | the board: each sprite big on snow, on road earth, as a flat shape, in greys, then all at 1x and 2x, then the game frames |
| `stage.js` | the art standing in a real game frame beside today's hero, wolf, deer and bear, on snow and on the road, drawn by the game with its shade and health frame. `--cut DIR` saves today's sprites at 1x |
| `check.py` | the certain faults: touches the canvas, wrong size for its kind, over 24 colours, border not ink, melts into snow, head too small, under 16 team pixels. The rest are WARN |
| `blind.py` | numbered, unnamed, shuffled tiles for a reader with no brief, and the key beside them |

```
node app/server.js &                                        # the game, for --frame and cut.js
node app/art/cut.js --out W/refs tree.0 pumpAnim.0 scrap.left.idle.0   # today's neighbours, and the sprite to start from
python3 app/art/round.py W/boar.py --frame                  # look at W/boar/now/board.png
python3 app/art/round.py W/boar.py --frame --keep           # a round worth keeping: W/boar/r1/
python3 app/art/blind.py W/tiles.png W/old.png W/boar/r1/side.png
```

An asset file (`W/boar.py`) holds `KIND`, `PAL`, `views()`, and optionally `HEAD`, `DETAIL`,
`TEAM`, `BARE`, `VS`, `NEAR`, `REFS`, `SCALE`; `round.py`'s header says what each is. Work folders live outside the
repo, in the project files.

## Into the game

The grid in `<view>.txt` is what `bake()` takes: paste it into the sprite's file under
`js/sprites/` with its palette ([sprites.md](sprites.md)), and from then on the grid is the source,
edited by hand. A sprite with many frames keeps its painter instead, as a bake script under
`app/bake-<thing>/` that writes `js/baked/`. A pose is the same painter called with other points:
frames are redrawn at 1x, never rotated.
