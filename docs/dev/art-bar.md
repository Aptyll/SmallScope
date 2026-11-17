# The bar: what good looks like

What a sprite, a camp or a frame must clear before Noah sees it, and how to tell. [Making art](art.md)
says how a sprite is drawn; this says when it is good enough. The tool is `app/art/review.py`, the
pictures are in `docs/media/bar/`.

Three facts set the method:

- **Noah's eye is the ruler.** Colour count, lone pixels, outline cover, value range and the size
  of flat fields were all measured on what he kept and what he rejected, and none of them tells the
  two apart ([art.md](art.md), What was tried). So the bar is not a number. It is his own verdicts,
  kept as pictures, and new work is judged by standing among them.
- **The author cannot judge their own work.** You know what it is meant to be. The judge is one
  fresh reader ([the judge step](#the-judge-step)).
- **A fresh reader's own taste is not his.** Asked which pieces it would ship, a reader with only
  a rubric put his rejected pieces above his kept ones more often than not. Shown his verdicts
  first, it called 23 of 26 held-out pieces as he did ([what was measured](#what-was-measured)).
  So the reader is always shown what he kept and what he rejected, and is asked what he would say.

## The five gates

A sprite passes them in this order. Failing one sends the drawing back to that gate, not to polish.

1. **IDEA.** One idea, said in five words, and the flat shape alone shows it: *a lamp box on
   stilts*, *a stag with a crown of antlers*. It has a persona: you can say what it looks at and
   what it wants. "A brown animal" and "a tank" are not ideas.
2. **READ.** At the size a player sees, on snow and on the road, a stranger names it in a second
   and says which way it faces. Nothing melts into the snow, and it is not mistaken for something
   else (a plush, a pig, Santa).
3. **LIFE.** It is caught in the middle of something. A beast has a line of action from head to
   tail, weight on its feet, a head carried at its own height, shoulders and rump at different
   heights. A machine has a stance, a lean and something it looks at. A level back on four legs in
   a comb is a table.
4. **CRAFT.** Form is shaded in small clusters that follow the mass, under one light from the top
   left. One ramp, warm to cool, taken from the game's own palettes; an outline in the sprite's own
   dark. No flat panels split by seam lines, no decal, no blur or fringe, no lone pixels, no
   dither. The most pixels go to the face.
5. **FIT.** In a real game frame beside today's hero, rabbit and bear, nobody can pick it out as
   made by another hand: the same outline weight, pixel size, palette family, camera (top-down
   3/4) and scale. It sits under the heroes in a squint, never over them. Every part has a reason:
   it could stand, be held, work.

## A place

A camp, a pit, a base, a lane mouth: anything a player walks into. League's rule for its map is the
order the eye should find things: effects first, then bodies, and the ground last, as "a canvas for
other elements"; and more detail in the ground always costs clarity (Riot's 2014 Summoner's Rift
dev blogs). Softfall's kept and rejected places say the same thing.

1. **The owner is the landmark.** In a squint the eye lands on the creature or the building the
   place belongs to: it is the biggest, darkest or most saturated thing in view. No prop out-shouts
   it. A camp needs no built thing at all.
2. **A room with a mouth.** The forest wall wraps it and leaves one way in, or two. A thing set
   down on open snow is not a place. The mouth is plain to see, never behind brush (Riot widened
   its alcove mouths for this).
3. **Its own floor.** The ground changes underfoot (stone, ice, packed earth, trampled snow), and
   the edge of that floor is the edge of the fight. It should show on the minimap as a shape.
4. **The way in is drawn.** A path, a creek or a line of worn snow points at the mouth. Bushes sit
   where an ambush or a steal would wait, each for a reason someone can say.
5. **A quiet canvas.** Middle values, low saturation, wide rest. Detail gathers at edges and
   landmarks. Nothing natural stands on a ruler: no straight tree lines, no rectangular groves, no
   even spacing. Symmetry between the two sides is for fairness and is exact.
6. **It makes sense.** Nothing nobody built. Everything in the game's camera: tops and south walls.
7. **The epic one is one of a kind.** The boss room has a ground or a colour temperature found
   nowhere else on the map (League's pits are the only purple and the only scorched ground on the
   Rift). The room is sized to its owner, about three bodies of the boss across, and the boss faces
   the mouth.

## Noah's words

The faults he has named, each with the piece that earned it. A reader who uses one of these words
has found a certain fault.

| his words | what it looks like | the piece |
| --- | --- | --- |
| "not up to my standard" | a table body in flat panels, legs in a comb | boar, ibex |
| "opposite of toy": sharp, lean, capable | round, symmetric, stubby, cute by accident | BRUMA, the siege tank |
| "uncanny valley" | realistic feathers and anatomy in a stylized game | the golden eagle |
| "horrible" | outline and shading put on by a program: stiff mannequins | the first scouts |
| "really bad" | the silhouette and face of a thing he liked were changed | bear look round 1 |
| "don't make sense" | walls nobody built, a staff held level, a bow through a cloak | the bear lairs |
| "think about how League shows its camps" | a prop in a field instead of a pocket in the wall | lair round 4 |
| "an easy shortcut", "copy-pasted" | the same shape again in a new colour | ability circles, colour rims |
| "looks like it disappears" | pale on snow, see-through, too small to follow | the ranged shot, the hit flash |
| "not polished" | a seam where two systems meet | the black rim near pines |
| "losing quality" | key art flattened until the painter's detail is gone | the logo |
| "I like minimal" | decoration on UI chrome | the snowy HUD frame |
| "intentional, with persona" | (what he asks for) every light and part says something | the headlamps |

Two more that are his standing calls: one change a round, shown beside today's sprite; and when a
piece is rejected, draw a new subject, do not polish the old one.

## The judge step

Before any sprite, concept sheet, camp or map frame goes to Noah:

```
python3 app/art/review.py sprite W/rv new.png --is "wild boar" --kind beast --beside W/refs/tree.0.png --frame W/frame-snow.png --new 5
python3 app/art/review.py frame  W/rv new-frame.png --is "the orca" --kind place
```

That writes `W/rv/` for the reader and `W/rv.key.json` for you. The sheet has three bands: pieces
of the same kind Noah kept (K), pieces he rejected (R), with his words in `owner.md`, and the
numbered pieces to judge. The numbered band is the new art shuffled with one or two pieces he has
already judged, so the reader cannot tell which is new and every review tests its own reader.
`--beside` adds today's sprites it will stand next to (the pine, the pump; `app/art/cut.js` saves
them). `--frame` is the real game frame from `app/art/stage.js`; `--new` counts the new bodies in
it from the left.

1. **Walk the gates yourself** on `sheet.png` at full size, one line a gate. A gate you cannot
   answer in a line has failed.
2. **One fresh reader.** A subagent with no context is given only the folder `W/rv/` and
   `app/art/reviewer.md`, and answers in JSON. One reader, one call: it names each piece, says
   whether Noah would keep it and which K or R piece it is most like.
3. **The verdict is mechanical.** Save the answer and run
   `python3 app/art/review.py verdict W/rv answers.json`. A piece passes when the reader names it
   as meant, calls it kept, ranks it above every hidden rejected piece, calls it finished and not
   a placeholder, does not rank it under every neighbour, and does not pick it as the odd one out
   in the game frame. The command first checks the reader against the hidden pieces:
   one that calls fewer than three in four as Noah did is not a judge of his taste, so get another.
4. **A fail is the next brief.** The reader's `why` and `worst` say which gate. Redraw from that
   gate. Three failed rounds mean the idea is wrong: change the idea, or ask Noah for a reference
   picture.
5. **Noah sees only what passed**, with the reader's one line. A pass is not his yes.
6. **His answer goes in the library**, kept or rejected, in his words:
   `python3 app/art/review.py add ID file.png --kind beast --verdict rejected --words "..."`.
   The bar is only as sharp as the library is current.

## The library

`docs/media/bar/verdicts.json` lists every piece: its kind (beast, hero, machine, place, layout),
Noah's verdict, his words and the date, and a line of Claude's reading of why, which may be wrong.
A row needs a verdict he gave himself; a thread's own opinion of a piece never goes in.
`python3 app/art/review.py wall out.png` lays the whole library on one sheet: look at it before
drawing anything.

What it shows, as a reading and not a rule: every beast he kept came from a picture he supplied or
has a body in motion; every machine and hero he kept is small, has one idea and a face or a lamp
that looks somewhere; what he rejected is mostly bigger, stiffer and built from parts.

## What was measured

Both tests used the library's own sprites with the verdicts hidden (2026-11-17; sheets, keys and
answers are in the project files under `visual-bar/backtest/`).

| the reader was given | result |
| --- | --- |
| the fault list only, and asked what it would ship (4 readers, 2 sheets) | it ranked a kept piece above a rejected one in 7% to 52% of pairs: worse than a coin. It liked the bigger, more rendered pieces (the siege guns, the redrawn bear, the boar) and called the heroes mannequins |
| Noah's kept and rejected pieces first, then asked what he would say (4 readers, 18 held-out pieces) | 15 of 18 as he did. All 10 rejected pieces were called rejected. The 3 misses were pieces he kept: his own deer and bunny, and PORTITOR |

What that means, and its limits:

- The gate is strict: in this sample nothing he rejected got through, and about one kept piece in
  three was failed. A pass is worth something; a fail on a piece unlike anything in the library is
  worth less.
- The misses came when the K band held no piece of the same kind (a deer judged against a pump and
  a bear). Anchors of the same kind matter, and the beasts have only three kept pieces.
- Eighteen pieces is a small sample, and part of the score is the easy rule "small and simple is
  kept". It is evidence the method works, not proof.
- A place cannot be judged this way yet. Without his verdicts shown, the reader preferred the
  built lairs he rejected. With them shown (one kept place, two rejected), it still called the
  hidden ice-fall lair kept. The library holds one kept place: until it holds more, the seven
  rules above and Noah's own eye decide a place, and `verdict` will say its reader failed.
- The command was then run as shipped on a piece no thread had shown him (a musk ox an earlier
  round drew and dropped): the reader called all 4 hidden pieces as he did and failed the ox as
  "a boulder with a blue stripe". With the 18 above that is 19 of 22.
- The finished-or-placeholder question and the neighbours came later, from the finding that every
  flat round passed "what is it" ([art.md](art.md), What was tried). One run with them in (the ox
  beside the pine and the pump): the reader called 4 of 4 hidden pieces as he did, called both
  kept pieces and both neighbours finished, and failed the ox as a placeholder ranked under both.
  That is one run: the two craft checks are much less tested than the call.
