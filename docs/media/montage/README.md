# Montage clips

Twenty-three short takes of Softfall for cutting into a montage, recorded at **1080×1920 (9:16
vertical, 60 fps)** with **every sound effect and no music**. Each clip is 3–5 s, one action, one
file. The mp4s and their webm originals are gitignored; `tools/` rebuilds the whole set from the
seed, so the clips are reproducible rather than archived.

```
node app/server.js                              # the page has to be served
cd docs/media/montage/tools && node run.js       # all 23, about six minutes
node run.js 15-robot                             # ...or one, by name fragment
node shot.js 03-chop                             # stage it and take a still instead
```

`shot.js` is the loop worth using while a scene is still being framed: it stages and holds, but
never records, so a framing fix costs a second rather than a clip. Stills land in `tools/shots/`.
A partial `run.js` re-normalises against only what it recorded — pass `GAIN=1.00` to match the set.

## The clips

| clip | what happens |
| --- | --- |
| `01-eagle-ride-in-over-the-treeline` | the ride in, close on the bird, the rival eagle passing under it mid-flight |
| `02-eagle-leap-off-into-the-fall` | the leap off the wing and the fall |
| `03-chop-a-pine-until-it-falls` | four swings, chips, the timber crack and the jackpot |
| `04-mine-a-rock-to-rubble` | the pick on a rock until it breaks |
| `05-swap-the-tool-for-a-loaded-longbow` | walking onto a built LONGBOW: the swap ring, the risen icon, the shelf filling with its bits |
| `06-hefty-wand-fires-a-fan-of-fire` | a LONGBOW carrying HEFT + SPLITTER + CINDER BURST — one press, a fan of fat burning shots |
| `07-warrior-stomp-cracks-the-snow` | STOMP: the ring, the knockback, the crater left behind |
| `08-warrior-bull-rush-carries-a-body` | BULL RUSH: the telegraph line, the charge, a body carried and slammed |
| `09-warrior-shield-wall-then-slam` | the wall raised, shots dying on it, then the same key as the slam |
| `10-warrior-execute-finishes-a-body` | EXECUTE on a body already worked over, and the kill |
| `11-hunter-piercing-shot-up-the-line` | the locked draw, the telegraph, one arrow through three bodies |
| `12-hunter-net-shot-drops-a-drape` | the net down the line, the drape drawn on the target, the recoil hop |
| `13-hunter-grapple-reels-into-the-pines` | the hook catching a pine and the reel up the frame |
| `14-a-death-spills-the-whole-backpack` | a kill, and the pack coming apart into the snow — the built weapon, the fittings, the food |
| `15-robot-war-two-columns-collide` | two columns of soldiers, one up the frame and one down, meeting in the middle |
| `16-night-falls-over-a-wolf-pack` | night, a pack, and CARE ARROWS lighting the only light there is |
| `17-night-in-the-dire-wolf-hollow` | the epic camp after dark: dead trees, the den and the dire wolf |
| `18-zoomed-all-the-way-out-over-the-snow` | the max-out view, 34 × 60 tiles of it, wildlife scattered across the field |
| `19-zoom-punch-from-wide-into-the-kill` | eight zoom rungs stepped in over five seconds while the shots land |
| `20-dodge-roll-through-a-wolf` | the roll, and the roll landing as a hit |
| `21-a-bot-bay-rises-from-its-site` | a 3 × 2 site raising itself: dust, weld sparks, the hammer ticks, the finish |
| `22-a-turret-cuts-down-an-intruder` | a tier-1 turret marking a rival and putting bolts into it |
| `23-pyre-arrows-set-three-bodies-alight` | PYRE + SPLITTER at night, three bodies burning, and the ember ring catching the shooter |

## How it was shot

- **9:16 is native, not cropped.** Chrome runs under a 1080 × 1920 device-metrics override, which
  puts `fitCanvas` on the desktop branch at `devScale` 3 and a `VIEW_W`×`VIEW_H` of exactly
  360 × 640 — so the HUD lays itself out for the tall frame and the world view is 7.5 tiles wide
  against 13–24 tall. Every scene is composed **up the screen** for that reason.
- **The sound is the real bus.** `tools/tap.js` goes in on a fresh document and mirrors every
  connection into `ctx.destination` onto a `MediaStreamAudioDestinationNode`. Everything the game
  synthesises or samples hangs off one master gain (js/audio.js), and the MUSIC layer is
  `HTMLAudioElement` and never enters the graph — so the tap is all of the SFX and none of the
  music by construction. The run also asserts it: zero audio elements were ever created.
- **One `MediaRecorder`** takes `canvas.captureStream(60)` and that audio track together, so picture
  and sound are in sync with no alignment pass. The clip comes back over CDP in base64 slices and
  ffmpeg makes the mp4 (h264 CRF 17, AAC 192k).
- **Master sits at 0.5** with one shared gain applied across the whole set afterwards, so the
  loudest peak in the montage lands at −1 dBFS and nothing clips — and a night shot stays quieter
  than a robot war, which per-clip normalising would have flattened.
- **Scenes are staged frozen and muted** (`DBG.freeze` + `SFX.setMuted`), then the mute comes off
  and the clip runs in real time. Two hooks drive it: one per sim step, installed at the end of
  `sampleHumanInput` (which rebuilds the local input every step, so anything written earlier is
  gone before `updatePlay` reads it), and one per frame just before `render`, which is the only
  place a hand-held camera can be written — `update()` moves `camX`/`camY` itself.

Seed 42 throughout (`SEED=n node run.js` for another).
