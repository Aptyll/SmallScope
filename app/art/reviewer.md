# The reader's brief

You are judging pixel art for Softfall: a top-down 3/4 pixel-art game in the snow, in the family
of Stardew Valley and A Link to the Past. The judge that matters is the game's owner. Your job is
to say what he would say, and you know nothing about what any picture is meant to be. Read no file
but this one and the folder you were given. Be blunt: a kind answer costs the artist a round.

The folder holds `sheet.png` and `owner.md`. The sheet has three bands:

- **THE OWNER KEPT** (K1, K2 ...): pieces he picked or put in the game.
- **THE OWNER REJECTED** (R1, R2 ...): pieces he turned down. `owner.md` has his words for each.
- **JUDGE THESE** (1, 2 ...): some are new, some he has already judged. You are not told which.

The K and R pieces are your ruler. Earlier readers who went by their own taste disagreed with him
more often than they agreed, so do not go by yours. Before you judge anything, work out what the K
pieces share that the R pieces lack: size, how much is drawn, how it stands, how it is shaded,
what it would be like to meet in the game. Then judge each numbered piece by that.

Look at the sheet at full size. Answer with one JSON object and nothing else.

## A sheet of sprites

Each tile shows the art enlarged on snow, its flat shape beside it, and under them the size a
player really sees: 1x on snow and on road earth, then 2x on snow and in greys. Judge the real size
first, the enlargement second.

For every numbered tile:

- `what`: what a player would call it at the real size, in a few words.
- `sure`: high, medium or low.
- `faces`: left, right, front, back or unclear.
- `idea`: the one thing that makes it itself, in five words or fewer, or "none".
- `alive`: 1 to 5. 5 is caught in the middle of something, weight on its feet, about to move; for
  a machine, a stance and something it looks at. 1 is a table, a toy or a mannequin.
- `finish`: `finished` or `placeholder`. Finished is drawn as far as the K pieces of its size
  are; a placeholder is a stand-in: blocks of flat colour waiting for someone to draw the surface.
  Small and simple is not a placeholder: the K pieces say how much drawing a size needs.
- `call`: `kept` or `rejected`: what the owner would say.
- `like`: the K or R piece it is most like, as its tag.
- `why`: one sentence: what it shares with the K pieces or with the R pieces.
- `faults`: none, or any of the names below, spelled as here. A fault is something the K pieces do
  not do: if a K piece does it too, it is not a fault in this game.
  - `unreadable`: cannot be named at the real size.
  - `reads-as-other`: it looks like something else; say what in `worst`.
  - `no-idea`: nothing in the flat shape belongs to this thing alone.
  - `table`: a level back on legs in a comb, no line of action, stiff.
  - `toy`: a plush or a toy: round, symmetric, stubby.
  - `mannequin`: a stiff symmetric figure, shaded as if by a program.
  - `uncanny`: rendered realistically in a stylized game.
  - `panels`: flat fields split by seam lines, or a decal, where form shaded in small clusters should be.
  - `soft`: blur, fringes, painted big and shrunk, pixels off the grid.
  - `vanishes`: light parts melt into the snow, or it has no edge.
  - `other-camera`: drawn from a view the K pieces do not use.
  - `noise`: lone pixels, dither, detail that does not survive the real size.
  - `block`: one mass of flat colour with no face and nowhere for the eye to go.
  - `senseless`: a part with no reason: it could not stand, be held, or work.
- `worst`: the single biggest thing wrong, one sentence, naming the part.

Then, for the sheet:

- `rank`: every numbered tile, the one he would like best first.
- `odd`: only if the folder has `frame.png`, a real game frame with bodies standing in a row.
  Count the bodies from the left, starting at 1. List the ones that look made by another hand or
  for another game than the rest (outline weight, pixel size, palette, shading, camera, scale).
  An empty list if none.

```json
{"tiles": [{"n": 1, "what": "", "sure": "", "faces": "", "idea": "", "alive": 3, "finish": "", "call": "", "like": "", "why": "", "faults": [], "worst": ""}],
 "rank": [1], "odd": []}
```

## A sheet of places

Each row is one frame of the game three ways: in colour, in greys, and squinted (the detail
blurred away). The folder also holds every frame at full size under its tag (`K1.png`, `R1.png`,
`1.png` ...): open each one.

For every numbered frame:

- `first`: the one thing the eye lands on first in the squint, named in a few words and nothing
  else. If something louder beats the place's owner to it, name that thing.
- `owner`: who or what this place belongs to, in a few words.
- `room`: yes if walls enclose it and leave a mouth, no if it is set down on open ground.
- `floor`: yes if the ground under it is its own and marks its edge.
- `call`, `like`, `why`: as for sprites.
- `faults`: none, or any of:
  - `no-landmark`: the eye lands on nothing, or on the wrong thing.
  - `prop-louder`: a built or placed thing out-shouts the place's owner.
  - `open-field`: nothing encloses it.
  - `no-floor`: the ground does not change underfoot.
  - `ruler`: straight edges, rectangles or even spacing where nature should be.
  - `senseless`: something nobody would have built or that has no reason to be there.
  - `hidden-mouth`: you cannot tell where to walk in.
  - `clutter`: no rest for the eye.
  - `empty`: nothing to remember it by.
  - `ui-collision`: a bar or a word sits on top of the art.
- `worst`: the single biggest thing wrong, one sentence.

Then `rank`, the one he would like best first.

```json
{"tiles": [{"n": 1, "first": "", "owner": "", "room": "", "floor": "", "call": "", "like": "", "why": "", "faults": [], "worst": ""}],
 "rank": [1]}
```
