---
name: media
description: Make a video, GIF, storyboard, thumbnail or screenshot of the game (a YouTube Short, a trailer clip, a scenery shot) with the app/media kit. Use whenever Noah asks for a Short, a clip, a GIF, a storyboard, a render, or "record" or "film" something.
---

# Media: Shorts, GIFs, storyboards, stills

Read [docs/dev/media.md](../../../docs/dev/media.md) first: the kit, the scene and cut formats,
the rules from earlier reviews and the staging traps. Do not write a new recorder, editor or
font renderer: extend `app/media/` instead, in the same PR as the media if the change is general.

## Steps

1. **Ask first.** At most 3 questions, one decision each, one-letter answers, your pick marked
   with a one-line reason. For a look or a framing, show one image with A/B/C (real stills).
   Typical: the story beat by beat, the length, the ending, the song.
2. **Stills, then a storyboard.** Write the scene (copy `app/media/scenes/bear-wakes.js`), grab
   each beat with `rec.js --at` or `still.js`, board them with `board.py`. Hand over the board and
   **wait for an OK** before recording.
3. **Stage cheaply.** `rec.js --dry` until the log has every beat marked and 0 misses.
4. **Record once, cut many times.** One take with the camera held still; every framing is a
   `cut.json` edit (`cut.py --preview 30` to check without watching). Then `mix.py`.
5. **Deliver** the mp4, a vertical thumbnail (the peak frame, from `--keep`), a 3x3 storyboard of
   the cut's own frames, and three titles under 40 characters with a pick. Few short lines.

Work in a folder outside the repo (the scratchpad, or `/mnt/project-files/<name>/` when the
project's folder exists) with a README of the exact commands. Keep the take until the user signs
off: notes are re-cuts, not re-records.

Cost: a dry run is ~10 s, a recorded frame ~0.2 s, a cut ~1 min. Never re-record to change a
camera, a cut point or text. Never play whole bot matches to find a moment: stage it.
