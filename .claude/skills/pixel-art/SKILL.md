---
name: pixel-art
description: Draw or redraw any Softfall sprite (a beast, a hero body, a creature, a prop) and improve it over rounds: paint flat shapes on the game's own pixel grid with app/art, look at it on the board and in a real game frame beside today's sprites, get a blind read from a reader with no brief, fix what the read found, repeat, then show Noah old next to new. Use whenever art is made or reworked, when Noah says something "looks bad", "awful" or "like slop", and from inside the concept-art and new-hero skills for the drawing itself.
---

# Drawing a sprite, and making it better each round

Read [docs/dev/art.md](../../../docs/dev/art.md) first: **The style** is the checklist, **What was
tried** is why this method and not the others. Do not go back to lit tubes and domes for living
things, do not paint big and shrink, do not trust your own eye on whether it reads.

## Before a pixel

1. Write the brief in three lines at the top of the asset file: what it is, its `KIND` (size band),
   and the one feature that makes its flat shape its own.
2. `node app/art/stage.js --cut W/refs --out W/today.png` and look at today's hero, wolf, deer and
   bear at game size. Take the palette ramps from them. If Noah gave a picture, fit to the picture.
3. If the sprite replaces one, put the old one in `VS` so every board shows old beside new.

## A round

Each round is `python3 app/art/round.py W/<name>.py --frame`, then look at `now/board.png` at full
size. Work in this order and do not move on while the row above is wrong:

1. **SHAPE row.** One flat colour, no shading yet. Does the black shape alone say the animal? Are
   the legs apart? Is the head clear of the body? Fix the outline points until it does.
2. **Masses.** Far legs dark, shadow shapes under the belly and where one mass turns behind
   another, one sheet of light over the top. Shapes are placed with `only=` so they stay inside
   what they shade.
3. **Face and accent.** A hand-set `patch` for the muzzle, eye and nose; the one accent colour.
4. **GREYS row and the game frames.** It must hold on snow and on the road, beside the hero and
   the bear, at the size a player sees.
5. `check.py` runs inside the round. A FAIL is a certain fault: fix it. A WARN is a place to look.

When a round is worth judging, add `--keep`.

## The blind read (every kept round)

You know what it is meant to be, so you cannot test whether it reads.

```
python3 app/art/blind.py W/tiles.png W/old.png W/<name>/r1/side.png [today's sprites, other rounds]
```

Give **only** `tiles.png`, copied to a path that names nothing, to a fresh subagent with no
context, and ask per tile: what is it, how sure, which way it faces, what the flat shape alone
looks like, the single biggest thing wrong; then a ranking best to worst, and which tiles show the
same subject. Tell it to be blunt and to read no other file. One reader, one image.

Then open `tiles.key.json`. The round passes when the reader names the right thing with high
confidence, says its shape alone reads, and ranks it above the old one. Otherwise the reader's own
words ("a loaf", "a toy", "can't count the legs") are the next round's brief: write them as a
comment on the view and redraw from the SHAPE row down. Three rounds without a pass means the
design is wrong, not the pixels: change the pose or the feature, or ask Noah for a reference
picture.

## Showing Noah

Art is taste: he sees it before it ships. Send the board of the kept round (old beside new, the
game frames under it), labelled STAGED, with one line on what changed and what the blind reader
said. One question at most, as a decision card. A picked look goes to the Kitchen (`kitchen` skill).

## Into the game

See **Into the game** in art.md. Verify in a real frame with `stage.js`, both teams
(`Art.swap`), every facing a hero has. Save the shipped art for the patch notes as the
`concept-art` skill's last step says.
