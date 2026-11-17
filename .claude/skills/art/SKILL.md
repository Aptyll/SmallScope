---
name: art
description: Make or change anything a player sees in Softfall: a creature, a hero body or weapon, a soldier, a machine or building, a prop, terrain or a whole place (a camp, a base, a shop), an icon, a HUD or menu part, an ability's effect. One loop for all of them: see today's game, brief it, draw it at 1x, judge it in a real game frame and by a blind read, give Noah lettered options, ship only his pick. Use whenever a new look is asked for, something is redrawn or "looks bad", "awful" or "like slop", a look is rejected, or Noah asks for options, concepts or "let me pick"; the hero and media skills send their art here.
---

# Making anything a player sees

Six steps, the same for every asset. What changes with the asset is in [kinds.md](kinds.md): find
your kind there and read only its section (how it is drawn, its size, where it lives in the code,
what Noah has already said about it). The facts behind the steps are in
[docs/dev/art.md](../../../docs/dev/art.md): **The style** is the checklist, **What was tried** is
why these methods and not the others, **The tools** is every command.

Three rules hold for all of it:

- **Noah picks from pictures, and sees art before it ships.** Never ship a look he has not seen.
- **You cannot judge your own read.** You know what it is meant to be. A reader with no brief
  decides whether it reads (step 4).
- **Start from the game.** Today's sprite, a real frame, the game's own palettes. Never from
  memory, never painted big and shrunk, never a 3D render, never blurred or rotated.

## Which job is it

| the ask | what Noah gets | steps |
| --- | --- | --- |
| A new look: nothing like it is in the game, or he rejected the last one | a sheet of two to four lettered options | all six |
| A redraw: "looks bad", "improve X" | today's beside the new one, one change a round | all six; step 5 shows old beside new |
| A fix inside a kept look: a stray pixel, a missing facing, a colour that melts into snow | before and after in the PR reply | 1, 3, 4, 6 |
| "I just want to see" | stills only, no PR | 1 to 5 |

A redraw of a thing Noah kept holds its silhouette and face and changes one thing. A piece he
rejected is not polished again: bring a new design or a new subject.

## 1. See

Look at today's game before a pixel.

```
node app/server.js &
node app/art/stage.js --cut W/refs --out W/today.png     # today's hero, wolf, rabbit, bear at game size
node app/art/cut.js --out W/refs scrap.left.idle tree.0  # any sprite in the game at 1x, by name (--list shows the names)
node app/media/still.js --out W/place.png --tile TX,TY   # a clean frame of any spot
```

Take sizes from what you see and colours from the game's own ramps (`GAME` in `app/art/px.py`). A
redraw starts from the cut sprite itself: `Art.from_png` turns it into a grid to edit. If Noah gave a picture, fit to the picture: every
creature he has kept began from one. `W` is a work folder outside the repo, in the project files:
`/mnt/project-files/<thing>/round<N>/`, painters in its `src/`.

## 2. Brief

Three lines at the top of the asset file, before drawing: what it is, its kind and size, and the
one feature that makes its flat shape its own. Then read that kind's section of
[kinds.md](kinds.md). If the thing replaces one, today's goes in `VS` so every board shows old
beside new. Ask Noah only what a picture cannot settle (at most 3 questions, one letter each, your
pick marked) and keep drawing on your picks.

## 3. Draw

At 1x, on the game's own grid, in this order. Do not move on while the step above is wrong.

1. **Shape.** One flat colour. Does the black shape alone say what it is?
2. **Masses.** The big dark and light shapes, placed on purpose, three to six tones.
3. **Surfaces**, for anything bigger than a hero (about 24 px up): a flat block there reads as a
   placeholder beside the pump and the pine. Name each material as a ramp (`a.ramp('brass',
   'bHhgGW')`), lay its form's light over the mass you set (`a.model('brass', cyl_h(6, 17))`: a
   barrel, a ball, a sloped face), then add by hand what a hand leaves: straps, seams, cracks, and
   the glints, pixel by pixel. At hero size and under skip this: flat is right there, and the
   quality is the design.
4. **Face and accent.** Hand-set pixels for what must read at 1x; the one accent colour.
5. **Outline and ground.** Ink on what is built, its own darkest colour on what grows or freezes,
   none on snow lying on snow (`outline_by`). It holds on snow and on the road, in greys, at the
   size a player sees.

For a sprite each round is `python3 app/art/round.py W/<name>.py --frame`, then look at
`now/bench.png` (the pixels with a ruler, beside today's neighbours at the same zoom: name them in
`NEAR`) and `now/board.png` at full size; `--keep` saves a round worth judging. Kinds that are not one sprite
(a place, a HUD part, an effect) are built in the running game and captured as frames.

## 4. Judge

Every kept round, before Noah sees anything:

- **The board**, at full size: the SHAPE row first, then the GREYS row.
- **A real game frame**: beside the hero and the bear, on snow and on the road, both teams, every
  facing it has. For a place or a HUD part, the real screen at the zoom a player uses.
- **`check.py`** runs inside the round. A FAIL is a certain fault: fix it. A WARN is a place to look.
- **The blind read.** `python3 app/art/blind.py W/tiles.png W/old.png W/<name>/r1/side.png [today's
  sprites, other rounds]`. Give only `tiles.png`, copied to a path that names nothing, to a fresh
  subagent with no context. Ask per tile: what is it, how sure, which way it faces, what the flat
  shape alone looks like, whether it looks finished or like a placeholder, the single biggest
  thing wrong; then a ranking best-drawn to worst. Put today's neighbours among the tiles (the
  pine, the pump, a headlamp). One reader, one image, told to be blunt and to read no other file.
  Then open `tiles.key.json`.

It passes when the reader names the right thing with high confidence, says its shape alone reads,
and ranks it above the old one and no lower than the neighbours it will stand beside. Otherwise the reader's own words ("a loaf", "a toy") are the next
round's brief: redraw from the shape down. Three rounds without a pass means the design is wrong,
not the pixels: change the pose or the feature, or ask Noah for a reference picture.

## 5. Options to Noah

- **Lettered, genuinely different shapes**, each with a two-word name. Letters run on across rounds
  (round one A to C, round two D to F). Every option has passed step 4.
- **Shown in the world**, labelled STAGED: `python3 app/media/sheet.py sheet.json out.png` pastes
  each option into a real frame from `still.js --find open --player -40,0` beside a player, at each
  size in question. A place, a HUD part or an effect is shown as stills of the real game, A beside B.
- Team-painted things show both team colours. Things that move show every facing.
- One line per letter, your pick and why, what the blind reader said, then one decision card.
  **Stop and wait for the letter.** Once he answers, the round goes to the Kitchen (`kitchen` skill).

## 6. Ship the pick

Polish only the pick. Where its pixels live is in its section of [kinds.md](kinds.md). For all kinds:

1. Grids under `js/sprites/` are pure ASCII and break silently if a row changes length. A sprite
   with many frames keeps its painter as `app/bake-<thing>/`, which writes `js/baked/` (never
   hand-edited). Team-painted sets bake inside `SPR.onTeams`.
2. Verify in the running game at a close-up (`DBG.setK(6, true)`, `DBG.hideUI = true`): both teams,
   every facing, day and night. Run `node app/check-globals.js`.
3. Save the picked sheet as `docs/media/concepts/<thing>-concepts-<round>.png`, and fix every doc
   line the change makes false ([sprites.md](../../../docs/dev/sprites.md) first).
4. Show it in the patch notes: the shipped art at 1x, trimmed, on a transparent ground as
   `docs/media/notes/<thing>.png`, then `node app/bake-notes-art.js`, named as the note's third
   field: `['0.392', 'TEXT.', '<thing>']`.
