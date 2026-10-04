---
name: concept-art
description: Make a concept sheet of two to four candidate pixel-art looks for a new sprite (a character, an NPC, a creature, a building, a plant), painted in code with the app/media painter and shown in a real game frame beside a player, hand the PNG to Noah, and only build the pick into the game. Use whenever a new sprite is asked for, a look is rejected ("looks like a witch"), or Noah asks for options, concepts, or "let me pick".
---

# Concept art for a new sprite

Noah picks looks from a sheet, not from prose, and the pick usually takes one message. Do this
**before** anything goes into `js/sprites/`; never ship a look he has not seen.

## How the art is made

Paint it in code with `app/media/paint.py` (the 2D painted cutout painter; read
[docs/dev/media.md](../../../docs/dev/media.md)). Parts (tubes, lens leaves and blades, domes) are
painted at 8x, each art pixel takes the nearest part and snaps to a locked palette ramp, inner
lines separate overlapping parts, and the outline is ink (soft for snow, none for thin stems).
Creatures and characters are the same parts on a posed puppet (two-bone limbs, body tilt, head
turn), as `app/bake-bears/` and `app/bake-robot/` do.

Do not type pixel grids by hand, render 3D models, or auto-shade a template: all three were tried
and rejected (stiff, off-style, "slop"). Ramps come from the game's own palettes in `js/sprites/`.

Rules that make a sheet honest:

- **Judged in the world.** `sheet.py` pastes every candidate into a real frame from `still.js`
  (`--find open --player -40,0`) beside a player, at each size in question (for the 32 px base:
  1 tile at 2x detail, and today's pixel size).
- **Silhouette first.** A new thing needs its own body plan, not a palette swap of the player; one
  hue family; simple beats detailed at small sizes. Top-down, stylized, never semi-realistic.
- **Genuinely different shapes**, lettered and given two-word names; letters continue across rounds
  (round one A-C, round two D-F). Team-painted things show both team colours; things that move
  show every facing.
- **`lint` is 0** for every candidate: no off-palette colour, nothing touching the frame edge.

## The steps

1. Ask what is unclear (at most 3 questions, one letter each, your pick marked).
2. Paint the candidates in a work folder outside the repo, `lint` them, build the sheet with
   `sheet.py`, look at it yourself at full size.
3. Hand it over with one line per letter plus your pick and why. **Stop and wait** for the letter.
4. Polish only the pick. To ship it, its painter becomes a bake script under `app/bake-<thing>/`
   that writes the generated sprite file under `js/sprites/` (never hand-edited, as bears.js and
   robot.js), a team-painted set bakes inside `SPR.onTeams`, and the pick's sheet is saved to
   `docs/media/concepts/<thing>-concepts-<round>.png`. Verify in game at a close-up
   (`DBG.setK(6, true)`, `DBG.hideUI = true`), update [docs/dev/sprites.md](../../../docs/dev/sprites.md),
   bump the patch.
5. **Show it in the patch notes.** Save the shipped art at 1x, trimmed, on a transparent ground as
   `docs/media/notes/<thing>.png`, run `node app/bake-notes-art.js`, and name it as the patch note's
   third field: `['0.392', 'TEXT.', '<thing>']`. The notes screen draws it under the line.
