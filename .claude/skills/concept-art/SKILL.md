---
name: concept-art
description: Make a concept sheet of two to four candidate pixel-art looks for a new sprite (a character, an NPC, a creature, a building, a plant), drawn with the pixel-art skill and shown in a real game frame beside a player, hand the PNG to Noah, and only build the pick into the game. Use whenever a new sprite is asked for, a look is rejected ("looks like a witch"), or Noah asks for options, concepts, or "let me pick".
---

# Concept art for a new sprite

Noah picks looks from a sheet, not from prose, and the pick usually takes one message. Do this
**before** anything goes into `js/sprites/`; never ship a look he has not seen.

## How the art is made

Draw it with the `pixel-art` skill: flat shapes set on the game's own pixel grid with
`app/art/px.py`, judged on the board, in a real game frame and by a blind read
([docs/dev/art.md](../../../docs/dev/art.md)). Every candidate on a sheet has passed its own blind
read before Noah sees it.

`app/media/paint.py` (lit tubes, domes and blades painted at 8x) is for machines and buildings
only, as the pump and the tower use it. It was rejected for living things: sausage legs, heads too
small for a face. Do not render 3D models or paint big and shrink. Ramps come from the game's own
palettes in `js/sprites/`.

Rules that make a sheet honest:

- **Judged in the world.** `sheet.py` pastes every candidate into a real frame from `still.js`
  (`--find open --player -40,0`) beside a player, at each size in question (for the 32 px base:
  1 tile at 2x detail, and today's pixel size).
- **Silhouette first.** A new thing needs its own body plan, not a palette swap of the player; one
  hue family; simple beats detailed at small sizes. Top-down, stylized, never semi-realistic.
- **Genuinely different shapes**, lettered and given two-word names; letters continue across rounds
  (round one A-C, round two D-F). Team-painted things show both team colours; things that move
  show every facing.
- **No FAIL** from `app/art/check.py` for any candidate, and a passed blind read.

## The steps

1. Ask what is unclear (at most 3 questions, one letter each, your pick marked).
2. Draw the candidates in a work folder outside the repo (the `pixel-art` rounds), build the sheet
   with `sheet.py`, look at it yourself at full size.
3. Hand it over with one line per letter plus your pick and why. **Stop and wait** for the letter.
   Once he answers, add the sheet as a round to the Kitchen (the `kitchen` skill).
4. Polish only the pick. To ship it, its painter becomes a bake script under `app/bake-<thing>/`
   that writes the generated sprite file under `js/baked/` (never hand-edited, as bears.js and
   robot.js), a team-painted set bakes inside `SPR.onTeams`, and the pick's sheet is saved to
   `docs/media/concepts/<thing>-concepts-<round>.png`. Verify in game at a close-up
   (`DBG.setK(6, true)`, `DBG.hideUI = true`), update [docs/dev/sprites.md](../../../docs/dev/sprites.md),
   bump the patch.
5. **Show it in the patch notes.** Save the shipped art at 1x, trimmed, on a transparent ground as
   `docs/media/notes/<thing>.png`, run `node app/bake-notes-art.js`, and name it as the patch note's
   third field: `['0.392', 'TEXT.', '<thing>']`. The notes screen draws it under the line.
