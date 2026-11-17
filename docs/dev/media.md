# Media: stills, GIFs, storyboards and finished videos

`app/media/` is one kit for every picture and video made of the game: stills, GIFs, storyboards, and
vertical Shorts cut from a staged headless take with the game's own sound. The procedure is the
`media` skill ([.claude/skills/media/](../../.claude/skills/media/SKILL.md); a Short adds its
`shorts.md`). It also holds the sheet tools the `art` skill shows options with. It runs the same on
a Windows desktop (installed Chrome) and in a cloud box (Playwright's Chromium): set `CHROME=<path>`
if neither is found. Node needs no packages; Python needs `python3 -m pip install pillow numpy
imageio-ffmpeg`. Everything talks to `node app/server.js` (`PORT=` for another port). Work folders
and takes stay outside the repo; only the kit, its example scene and finished media meant to ship
are committed.

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

Draft at medium effort; spend high effort on the final only. A re-cut costs nothing to
re-record: shots name the take's own beats, so most notes are a `cut.json` edit. Art has the same
shape (rough options, the user's letter, then polish only the pick) and its own doc, [art.md](art.md).

## Director mode: filming the live game

The kit stages headless takes; director mode films a match you are playing, for OBS or the game's
own recorder (code: js/app/director.js). **F7** turns it on and shows a strip at the left edge with the
keys. While it is on: the **arrows** fly a free camera (they stop walking the body), **HOME** hands
the camera back to a steady follow with no aim lean, **PAGE UP / PAGE DOWN** and the wheel zoom on
a slow glide, **F8** hides the HUD (`DBG.hideUI`, the kit's own switch: also the attack marks (unless `DBG.showMarks`), the
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
| `stage.js` | page side, injected: `MEDIA.boot` flies the drop, cuts the local input, hides the HUD, sets zoom, weather and time, and lifts the fog of war unless `o.fog`; `park`, `track`, `mark`, `drive`; `M.speed` slows the sim (0 freezes it: `still` runs only the snow and the effects); logs hits and the sound cues heard near the camera |
| `rec.js` | records a scene: every frame as `fNNNN.png` plus `log.json` (`--dry` no pixels, `--at f,f` only those) |
| `still.js` | one clean frame anywhere (`--find open` picks open snow under pines, `--player dx,dy` adds one for scale) |
| `../see/see.js` | not the kit's, but built on it: a named place at the real zooms, by hour, today beside new, the whole map ([see.md](see.md)) |
| `cut.py` | the editor: `cut.json` shots between beats, sharp camera moves, text, a freeze with a drain, the end card; writes the mp4 and `map.json` |
| `view.py` | any camera off a recorded frame, pixel-exact (nearest blow-up, then area-average down) |
| `look.py` | the game's 3x5 font as rimmed video text, `stamp`, the game logo, the pixel Steam and Discord marks (`steam-mark.png`, `discord-mark.png`), `drain`, `freeze` |
| `mix.py` + `audio.js` | the take's cues on the frames they land on, rendered offline through js/app/audio.js, under an optional song, muxed |
| `board.py` | a 3x3 (or `--cols`) storyboard with pixel-font captions, from stills or from `--keep` frames |
| `gif.py` | GIFs from frames, a 1x strip, or a piece of an mp4 |
| `paint.py` | the 2D painted cutout painter, for machines and buildings only ([art.md](art.md)): parts at 8x, banded to locked ramps, inner lines, outline, stickers, `lint` |
| `sheet.py` | a concept pick sheet: letters and names, 8x/1x/2x, pasted into a real frame beside a player at each size asked |
| `scenes/iron-verdict.js` | the example scene and template (one hero, one key, one rival, on open snow it finds itself); `iron-verdict.cut.json` its cut |

```
node app/media/rec.js app/media/scenes/iron-verdict.js W/take --dry      # clean? then:
node app/media/rec.js app/media/scenes/iron-verdict.js W/take
python3 app/media/cut.py W/take app/media/scenes/iron-verdict.cut.json W/video.mp4 --keep 0,45,200
python3 app/media/mix.py W/take W/video.mp4 W/final.mp4 [--song song.mp3]
python3 app/media/board.py W/board.png --keep W "0|RAISE" "45|SLAM" "200|CARD" --cols 3
python3 app/media/gif.py W/slam.gif --mp4 W/final.mp4 --from 0 --to 1.5 --width 270
```

## A scene

A scene file sets `window.SCENE = { o, setup(M), tick(M), done(M) }` (read `scenes/iron-verdict.js`).
`o` is read in Node too, so only the functions may touch game globals. `o.w` x `o.h` CSS px at
`o.dpr` is the frame; `o.k` (device px per world px) is the take's S, and an edit can zoom from
the frame's width up to any k. A bigger S costs disk and time per frame, not quality you can't get
in post below S: record at the closest zoom the cut needs. Actors act through `p.input` only.

## A cut

Beats come from the take's `mark`s: `"slam"`, `"down#2"`, `"slam+14"`, `"end-30"`, or a frame
number. A focus is a tracked name, `"rival@slam"` (pinned where it stood at the slam), `"mix:a,b,0.3"`
or `[x, y]`; `ox`/`oy` nudge it. `k` is output px per world px, `[from, to]` for a push (zoom moves
in log space). `ease` is `smooth`, `linear` or `out`. `paint` stamps a 1x sprite into the take frame
over a tracked body (so it scales with the world, never drifts onto a health bar); `texts` put a
line over a shot; `end` adds the freeze and the end card. A bare `card: {}` is the standing one:
the logo, the pixel Discord mark, a small white JOIN THE over a big blue DISCORD, nothing under
it. `card.mark: 'steam'` gives WISHLIST ON STEAM under the Steam mark instead. `card.cta` gives
lines of its own, standing larger where the mark was unless `card.mark` names one (`steam`,
`discord`), and `card.cta_s` sizes each of its lines; `line` is the small line under them, at
`line_y`, and `line: 0` drops it. Colour `discord` is the Discord blue. `step` plays a shot every nth take
frame, negative to run it backwards (a rewind), and `mute: true` keeps its frames silent. Slow
motion and a held freeze are recorded, not cut: the scene lowers `M.speed`, so the snow keeps
falling through them. `blur`, on the cut (every shot's) or on a shot (merged over it; `false` turns
it off), keeps an ellipse round the frame's middle sharp and blurs and dims the rest: `r` its
half-axes as fractions of the frame, `soft` the feather past it, `px` the blur, `dim` the darkening,
`cx`/`cy` its centre. Text goes on after it, so it stays sharp. A text's `out` fades it over that
many frames before it goes.

## Rules that came from reviews

- The first frame decides: most viewers swipe within about a second. Open on the peak or just
  before it, one clear subject already in action; the `media` skill's `shorts.md` has Noah pick it
  from lettered stills. Give an action about 1 s to read
  (a 0.5 s opening was too fast; 0.9 s worked). Cut on actions; mix ~1 s close shots with one slow
  ~2 s wide one. End on the payoff, then the end card, even if it breaks a loop.
- One idea a Short. The first hero spotlights showed five abilities with name captions in about
  ten seconds; Noah found them confusing and boring (11-12).
- Show what the game really does. If staging needs the game to behave differently, that is a game
  change and a PR. Never say "real gameplay" about a staged take.
- Nothing covers the subject: keep fighters level (side-on) so health frames never stack; text never
  over a kill, at most 2 lines, the game font, no box.
- A sprite a shot needs and the game lacks is made by the `art` skill ([art.md](art.md)) and picked
  by Noah before any frame uses it.

## Staging traps

- Every player stays `control = 'human'`: `'none'` makes an inactive ghost and an empty team ends
  the match. Park, don't delete; `p.respawnT = 99` keeps the dead down; player 0 must not die (the
  RESPAWNING screen). Only the local team is visible.
- A body still under `p.invuln` blinks at 45%: set `p.invuln = 0` before placing it.
- Stage melee on snow: on ice nobody brakes. Dry-run until the log shows every hit landing.
- A key casts only when it is ranked and off cooldown: set `p.abLv` and `p.abCd` for the cast, and
  press `p.input.ability` for one frame, as a hand does.
- Runs are not deterministic between page loads (the title loop runs on wall time): never trust a
  dry run's frame numbers; cut from the recorded take's own marks.
- A hit wakes the camp and starts the roar on the same frame; cut into the roar a few frames later, after the flash.
- Bodies vanish on death: freeze on the blow, 2 frames before the down.
- `waterAt` / `isSolidTile` take tile coordinates. `sfxAt`/`sfxFor` play only near the local
  player; `stage.js` logs what is heard near the camera instead.
- Skip the eagle's far `boom` in a mix (`mix.py` does): it rings on every screen at once.
- `pkill -f "app/server.js"` kills the shell that runs it; use `pgrep -f "[n]ode app/server"`.
