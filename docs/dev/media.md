# Media: concept art, GIFs, storyboards and finished videos

`app/media/` is one kit for every picture and video made of the game: concept sheets painted in
code, GIFs, storyboards, and vertical Shorts cut from a staged headless take with the game's own
sound. It runs the same on a Windows desktop (installed Chrome) and in a cloud box (Playwright's
Chromium): set `CHROME=<path>` if neither is found. Node needs no packages; Python needs
`python3 -m pip install pillow numpy imageio-ffmpeg`. Everything talks to `node app/server.js`
(`PORT=` for another port). Work folders and takes stay outside the repo; only the kit, its example
scene and finished media meant to ship are committed.

## The flow, and where the money goes

Each step is a gate: nothing expensive runs until the cheap step before it is approved.

| step | tool | cost | gate |
| --- | --- | --- | --- |
| 1. questions | | none | at most 3, one letter each, a pick marked |
| 2. stills of each beat | `still.js`, `rec.js --at` | seconds | |
| 3. storyboard of the stills | `board.py` | seconds | **the user picks or OKs** |
| 4. stage until the log is clean | `rec.js --dry` | ~10 s a run | 0 misses, every beat marked |
| 5. record the take | `rec.js` | ~0.2 s a frame | |
| 6. cut, sound | `cut.py --preview`, `mix.py` | ~1 min | |
| 7. storyboard and thumbnail from the cut | `cut.py --keep`, `board.py` | seconds | **the user reviews** |

Concept art is the same shape: a rough sheet (`paint.py` + `sheet.py`), the user's letter, then
polish only the pick. Draft at medium effort; spend high effort on the final only. A re-cut costs
nothing to re-record: shots name the take's own beats, so most notes are a `cut.json` edit.

## Director mode: filming the live game

The kit stages headless takes; director mode films a match you are playing, for OBS or the game's
own recorder (code: js/director.js). **F7** turns it on and shows a strip at the left edge with the
keys. While it is on: the **arrows** fly a free camera (they stop walking the body), **HOME** hands
the camera back to a steady follow with no aim lean, **PAGE UP / PAGE DOWN** and the wheel zoom on
a slow glide, **F8** hides the HUD (`DBG.hideUI`, the kit's own switch: also the aim line, the
pointer's gold rims and E caps), **F9** swaps the window's 16:9 for a **9:16** frame whose canvas is
always 1080x1920 device px (360x640 game px) shown fitted to the window, and **F2** starts and stops
a take of the canvas itself, saved as a download: H.264 mp4 where the browser has it, else VP9
webm, with the sounds but not the music. The strip is drawn after the take copies the frame, so it
is never in a take; with the HUD hidden it shows only a moment after a key. A screen recorder
captures the 9:16 frame at the size it is shown, so use F2 for a crisp 1080x1920 Short and OBS
for 16:9 at the monitor's own size. The free camera also pans while paused. `DBG.director` is the
state; `DBG.directorKey('F9')` presses a key headless.

## The files

| file | what it does |
| --- | --- |
| `browser.js` | finds Chrome, drives it headless over the DevTools protocol (`open`, `openGame`, `eval`, `inject`, `shot`) |
| `stage.js` | page side, injected: `MEDIA.boot` flies the drop, cuts the local input, hides the HUD, sets zoom, weather and time; `park`, `track`, `mark`, `drive`; `M.speed` slows the sim (0 freezes it: `still` runs only the snow and the effects); logs hits and the sound cues heard near the camera |
| `rec.js` | records a scene: every frame as `fNNNN.png` plus `log.json` (`--dry` no pixels, `--at f,f` only those) |
| `still.js` | one clean frame anywhere (`--find open` picks open snow under pines, `--player dx,dy` adds one for scale) |
| `cut.py` | the editor: `cut.json` shots between beats, sharp camera moves, text, a freeze with a drain, the wishlist card; writes the mp4 and `map.json` |
| `view.py` | any camera off a recorded frame, pixel-exact (nearest blow-up, then area-average down) |
| `look.py` | the game's 3x5 font as rimmed video text, `stamp`, the game logo, the pixel Steam and Discord marks (`steam-mark.png`, `discord-mark.png`), `drain`, `freeze` |
| `mix.py` + `audio.js` | the take's cues on the frames they land on, rendered offline through js/audio.js, under an optional song, muxed |
| `board.py` | a 3x3 (or `--cols`) storyboard with pixel-font captions, from stills or from `--keep` frames |
| `gif.py` | GIFs from frames, a 1x strip, or a piece of an mp4 |
| `paint.py` | the 2D painted cutout painter: parts at 8x, banded to locked ramps, inner lines, outline, stickers, `lint` |
| `sheet.py` | a concept pick sheet: letters and names, 8x/1x/2x, pasted into a real frame beside a player at each size asked |
| `scenes/bear-wakes.js` | the example scene and template; `bear-wakes.cut.json` its cut |
| `scenes/deer-ride.js` | the practice field's deer ride at a gallop: the three posts say JOIN, THE, DISCORD, then the log leap; `deer-ride.cut.json` its cut |
| `scenes/deer-gap.js` | a hunter on a deer breaks three word targets (WISHLIST, ON, STEAM), the last through a cut in the pines mid-leap, slowing to a freeze |

```
node app/media/rec.js app/media/scenes/bear-wakes.js W/take --dry      # clean? then:
node app/media/rec.js app/media/scenes/bear-wakes.js W/take
python3 app/media/cut.py W/take app/media/scenes/bear-wakes.cut.json W/video.mp4 --keep 0,120,150,190
python3 app/media/mix.py W/take W/video.mp4 W/final.mp4 [--song song.mp3]
python3 app/media/board.py W/board.png --keep W "0|CATCH" "120|ARROW" "150|ROAR" "190|IT COMES"
python3 app/media/gif.py W/roar.gif --mp4 W/final.mp4 --from 2.0 --to 3.3 --width 360
```

## A scene

A scene file sets `window.SCENE = { o, setup(M), tick(M), done(M) }` (read `scenes/bear-wakes.js`).
`o` is read in Node too, so only the functions may touch game globals. `o.w` x `o.h` CSS px at
`o.dpr` is the frame; `o.k` (device px per world px) is the take's S, and an edit can zoom from
the frame's width up to any k. A bigger S costs disk and time per frame, not quality you can't get
in post below S: record at the closest zoom the cut needs. Actors act through `p.input` only.
`o.practice` stages on the practice field instead of a match (no seed, no drop).

## A cut

Beats come from the take's `mark`s: `"roar"`, `"down#2"`, `"roar+14"`, `"end-30"`, or a frame
number. A focus is a tracked name, `"bear@roar"` (pinned where it stood at the roar), `"mix:a,b,0.3"`
or `[x, y]`; `ox`/`oy` nudge it. `k` is output px per world px, `[from, to]` for a push (zoom moves
in log space). `ease` is `smooth`, `linear` or `out`. `paint` stamps a 1x sprite into the take frame
over a tracked body (so it scales with the world, never drifts onto a health bar); `texts` put a
line over a shot; `end` adds the freeze and the end card: WISHLIST ON STEAM under the Steam mark by
default. `card.cta` gives lines of its own (say JOIN THE DISCORD), standing larger where the mark
was unless `card.mark` names one (`steam`, `discord`), and `card.cta_s` sizes each of its lines
(a small JOIN THE over a big DISCORD); `line` is the small line under them, at `line_y`, and
`line: 0` drops it. Colour `discord` is the Discord blue. `step` plays a shot every nth take
frame, negative to run it backwards (a rewind), and `mute: true` keeps its frames silent. Slow
motion and a held freeze are recorded, not cut: the scene lowers `M.speed`, so the snow keeps
falling through them.

## Rules that came from reviews

- The first frame decides: most viewers swipe within about a second. Open on the peak or just
  before it, one clear subject already in action; the `shorts` skill has Noah pick it from lettered stills.
  Give an action about 1 s to read
  (a 0.5 s opening was too fast; 0.9 s worked). Cut on actions; mix ~1 s close shots with one slow
  ~2 s wide one. End on the wishlist card even if it breaks a loop.
- Show what the game really does. If staging needs the game to behave differently, that is a game
  change and a PR. Never say "real gameplay" about a staged take.
- Nothing covers the subject: keep fighters level (side-on) so health frames never stack; text never
  over a kill, at most 2 lines, the game font, no box.
- Art is painted in code (`paint.py`) and judged in a real frame beside a player. No 3D renders, no
  hand-typed grids, no auto-shaded templates. Top-down, stylized, on palette (`lint` = 0).

## Staging traps

- Every player stays `control = 'human'`: `'none'` makes an inactive ghost and an empty team ends
  the match. Park, don't delete; `p.respawnT = 99` keeps the dead down; player 0 must not die (the
  RESPAWNING screen). Only the local team is visible.
- A teammate can still be on its roost's zipline after the boot (`zipStep` sets its position every
  frame), and a body just off the drop blinks at 45% while `p.invuln > 0`: set `p.zip = -1` and
  `p.invuln = 0` before placing it.
- Archers loose only at a target standing still; leading a moving one misses. Stage melee on snow:
  on ice nobody brakes. Dry-run until the log shows every hit landing.
- Runs are not deterministic between page loads (the title loop runs on wall time): never trust a
  dry run's frame numbers; cut from the recorded take's own marks.
- An ambush hit on an unaware camp stuns it and skips the roar. A hit wakes the camp and starts the
  roar on the same frame; cut into the roar a few frames later, after the flash.
- Bodies vanish on death: freeze on the blow, 2 frames before the down.
- `waterAt` / `isSolidTile` take tile coordinates. `sfxAt`/`sfxFor` play only near the local
  player; `stage.js` logs what is heard near the camera instead.
- Skip the eagle's far `boom` in a mix (`mix.py` does): it rings on every screen at once.
- `pkill -f "app/server.js"` kills the shell that runs it; use `pgrep -f "[n]ode app/server"`.
