---
name: media
description: Make a picture or video of the game for people to watch: a YouTube Short, a trailer clip, a GIF, a storyboard, a thumbnail, a store screenshot, with the app/media kit. Use whenever Noah asks for a Short, a Short idea, a clip, a GIF, a storyboard, a trailer, a render, or to "record" or "film" something.
---

# Media: stills, GIFs, clips and Shorts

One kit makes all of it: `app/media/`. Read [docs/dev/media.md](../../../docs/dev/media.md) first,
by section: **The flow** (each step and its cost), **A scene** and **A cut** (the two files you
write), **Rules that came from reviews**, **Staging traps**. Do not write a new recorder, editor
or font renderer: extend `app/media/`, in the same PR as the media if the change is general.

## Which job is it

| the ask | Noah gets | path |
| --- | --- | --- |
| a still, a screenshot, a thumbnail | PNGs, labelled STAGED | steps 2 and 5 |
| a GIF, a clip, a trailer piece | the mp4 or GIF and its storyboard | steps 1 to 5 |
| a YouTube Short | the mp4 and its YouTube package | [shorts.md](shorts.md) first: it picks frame 0 with Noah, then hands its beats to steps 2 to 5 |
| "I just want to see" | stills only, no PR | step 2 |

## The steps

Each step is a gate: nothing expensive runs until the cheap step before it is approved.

1. **Ask only what a picture cannot settle.** At most 3 questions, one decision card each, your
   pick marked, and keep working on your picks. For a look or a framing, show real stills A/B/C.
2. **Stills, then a storyboard.** Write the scene (copy `app/media/scenes/iron-verdict.js`; run it
   `--dry` once untouched, and if the template itself fails, fix the kit first), grab each beat
   with `rec.js --at` or `still.js`, board them with `board.py`. Hand over the board and
   **wait for an OK** before recording.
3. **Stage cheaply.** `rec.js --dry` until the log has every beat marked and 0 misses.
4. **Record once, cut many times.** One take with the camera held still; every framing, cut
   point and line of text is a `cut.json` edit (`cut.py --preview 30` to check without watching).
   Then `mix.py`. Notes from Noah are re-cuts, never re-records: keep the take until he signs off.
5. **Deliver** the file, a storyboard of the cut's own frames (`cut.py --keep`, `board.py`), and
   for a video a vertical thumbnail (the peak frame). Few short lines. Look at every output
   yourself before sending it.

## Rules that hold for all of it

- **It shows what the game does.** Actors act through `p.input` only. If staging needs the game
  to behave differently, or the footage shows something odd, that is a game bug: offer the game
  fix, do not stage around it.
- **Staged is labelled STAGED**, and never called "real gameplay".
- **Never play bot matches to find a moment.** Stage it.
- No blood. No screen shake. Say "bots", never "AI".
- A finished video, and every round of stills Noah answered, goes to the Kitchen (`kitchen` skill).
- A sprite the shot needs and the game lacks goes through the `art` skill first.

Work in `/mnt/project-files/<name>/` (scenes and cuts in its `src/`, with a README of the exact
commands), never in the repo. Only the kit and its example scene are committed.

Cost: a dry run is ~10 s, a recorded frame ~0.2 s, a cut ~1 min. A headless script that exits
without closing its page leaves Chromium running: if runs crawl, `pgrep -af chrom | wc -l`.
