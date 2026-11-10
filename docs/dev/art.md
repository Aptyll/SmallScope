# Making art

How a sprite is drawn, looked at and improved, and why it is done this way. The procedure is the
`pixel-art` skill ([.claude/skills/pixel-art/](../../.claude/skills/pixel-art/SKILL.md)); the tools
are in `app/art/`. Picking a look with Noah is the `concept-art` skill, a hero is `new-hero`; both
draw with this.

## What was tried

The same beast was drawn by each method and shown unnamed to a reader who knew nothing about it
(the blind read, below). Rounds are kept in the project files under `art-pipeline/proof/`.

| method | what it gave | verdict |
| --- | --- | --- |
| lit volumes painted at 8x and shrunk (`app/media/paint.py`: tubes, domes, lenses) | sausage legs, a head too small for a face, light rising from every edge. The boar read as "a farm pig or a possum" | rejected by Noah twice (camp beasts, snow beast heroes). Still right for machines and buildings (the pump, the tower), which are made of tubes and plates |
| paint big, then downsample | soft fringes and colours the palette never had | rejected earlier ([sprites.md](sprites.md), the rabbit's note) |
| 3D render to pixels | clean props, off-style characters | rejected for characters |
| a posed rig of shaded parts fitted to a reference picture (`app/bake-bears/`) | today's bears | works when Noah supplies the reference; without one there is nothing to fit to |
| flat shapes set on the game's own pixel grid, hand pixels for the face (`app/art/px.py`) | the boar read as "boar, clearly" from its flat shape alone and ranked first of every tile | **the method** |

Two things that were measured and are worth knowing:

- **No ruler tells good art from bad.** Colour count, lone pixels, outline cover, pillow shading and
  value range were measured on today's deer, bear, rabbit and wolf and on the rejected rounds, and
  none of them separates the two groups. `check.py` therefore fails only what is certain (below).
- **The author cannot judge the read.** The first BRUMA redraw passed every check and looked right
  to its author; the blind reader called it "a guinea pig in a cape" and "a sitting plush toy". The
  second round was drawn from those words.

Every creature Noah has kept so far (deer, rabbit, bears) began from a picture he supplied. This
method is for when there is no picture. When there is one, fit to it.

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
- **One ink outline**, outside the art, one pixel: `#2e2440` on heroes (ARM_PAL), a near-black of
  the beast's own hue on beasts.
- **A face that reads at 1x.** Head a third of a hero-sized beast, a quarter of a big one. A dark
  eye on light fur, or a light eye in a dark socket; yellow on tan vanishes. Nose on top of the
  muzzle: two dark pixels one above the other read as an open mouth.
- **One accent colour** per beast. On a hero the accent is the team colour, 16 px or more from every
  facing, as cloth or gear the character would own.
- **Dark to mid on snow.** Nothing light sits on the border without ink round it.
- **Scale.** A hero's body is 16 px tall on its cell; a look's `fine` world body is drawn twice as fine, 32 px on the same cell, behind `?fine=1` for now ([sprites](sprites.md#hero-looks)). Pack beasts 11 to 22, big camp beasts 26 to 48, a
  hero-sized beast 14 to 22.
- **No blood.** No spirits, totems or occult marks. Beasts are noble animals.
- **Lone pixels are noise** unless they are an eye, a glint or a nostril.

## The tools

| file | what it does |
| --- | --- |
| `px.py` | the painter: `Art(w, h, PAL)`, flat shapes (`blob`, `poly`, `ell`, `rect`, `line`), `only=` to keep a shape inside what it shades, `rim` for one row of light, `patch` for hand-set blocks, `outline`, `swap` for the other team, `js()` for the grid the game takes |
| `round.py` | one round of an asset file: paints every view, runs the checks, builds the board, with `--frame` the real game frames, with `--keep` saves the round so the next is judged against it |
| `board.py` | the board: each sprite big on snow, on road earth, as a flat shape, in greys, then all at 1x and 2x, then the game frames |
| `stage.js` | the art standing in a real game frame beside today's hero, wolf, deer and bear, on snow and on the road, drawn by the game with its shade and health frame. `--cut DIR` saves today's sprites at 1x |
| `check.py` | the certain faults: touches the canvas, wrong size for its kind, over 24 colours, border not ink, melts into snow, head too small, under 16 team pixels. The rest are WARN |
| `blind.py` | numbered, unnamed, shuffled tiles for a reader with no brief, and the key beside them |

```
node app/server.js &                                        # the game, for --frame
python3 app/art/round.py W/boar.py --frame                  # look at W/boar/now/board.png
python3 app/art/round.py W/boar.py --frame --keep           # a round worth keeping: W/boar/r1/
python3 app/art/blind.py W/tiles.png W/old.png W/boar/r1/side.png
```

An asset file (`W/boar.py`) holds `KIND`, `PAL`, `views()`, and optionally `HEAD`, `DETAIL`,
`TEAM`, `VS`, `REFS`, `SCALE`; `round.py`'s header says what each is. Work folders live outside the
repo, in the project files.

## Into the game

The grid in `<view>.txt` is what `bake()` takes: paste it into the sprite's file under
`js/sprites/` with its palette ([sprites.md](sprites.md)), and from then on the grid is the source,
edited by hand. A sprite with many frames keeps its painter instead, as a bake script under
`app/bake-<thing>/` that writes `js/baked/`. A pose is the same painter called with other points:
frames are redrawn at 1x, never rotated.
