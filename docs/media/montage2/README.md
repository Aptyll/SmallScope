# Montage 2 — the team battle

Sixteen shots of one ten-player encounter, **1080×1920 (9:16 vertical, 60 fps)**, **every sound
effect and no music**, 4–5 s each. Same format as [montage 1](../montage/README.md), pulled back:
the camera sits far enough out to hold both sides at once, and the fight is **real** — both teams
are the game's own AI under a staged profile, not bodies moved along a timeline.

```
node app/server.js                                # the page has to be served
cd docs/media/montage2/tools && node run.js        # all 16, about five minutes
node run.js 05-stomp                               # ...or one (pass GAIN=2.10 to match the set)
node shot.js 05-stomp                              # stage it and take a still instead
node jitter.js                                     # re-measure the camera
```

## The cast

Ten named characters, five a side. The paint flips with `settings.teamBlue` — your side is always
BLUE on your screen — so the names carry no colour.

| | |
| --- | --- |
| **WREN** (the camera), ALDER, JUNIPER, BRIAR, FINCH | ROWAN, ASHE, LINNET, THORNE, SABLE |

## The clips

| clip | what happens |
| --- | --- |
| `01-the-two-lines-close-across-the-snow` | the widest establishing shot: two ranks walking at each other, first arrows in the air |
| `02-the-lines-collide-in-the-middle` | contact — the ranks break into each other |
| `03-arrow-volley-across-the-gap` | ten longbows, lines held apart, the shot is the air between them |
| `04-bull-rush-breaks-the-line` | WREN's charge telegraph on the snow, then a body carried and slammed |
| `05-stomp-scatters-the-cluster` | a stomp in the middle of the pile: the ring, the knockback, the crater |
| `06-the-side-focuses-fire-on-thorne` | one wounded rival turns the whole side onto it (IMPOSSIBLE picks the weakest) |
| `07-a-body-falls-and-the-pack-spills` | LINNET goes down mid-fight and the pack comes apart in the snow |
| `08-piercing-shot-through-the-front-rank` | one arrow through five stacked bodies |
| `09-shield-wall-holds-the-centre` | the wall up in the middle of the melee, then the slam |
| `10-the-melee-closes-to-swords` | every body a blade, the gap shut, nothing but contact |
| `11-night-battle-under-the-dark` | the same fight after dark, lit only by CARE ARROWS landing |
| `12-a-soldier-column-marches-into-it` | eight soldiers walk into the players' fight from both ends |
| `13-the-widest-view-of-the-field` | the max-out view, 34 × 60 tiles, the whole engagement at once |
| `14-the-camera-pulls-back-off-the-fight` | five zoom rungs stepped out while the fight runs |
| `15-net-then-execute-a-finisher` | a net onto SABLE, then the follow-up |
| `16-what-is-left-of-the-two-sides` | the fight run out first, then what is still standing |

## No camera jitter

Three things together, and all three are needed:

- **Screen shake is off** (`settings.shake`). It is a random per-frame offset applied in `render()`,
  raised by `shakeAt` — which rides the *same* `nearPlayer` gate the cues do. With the audio gate
  widened for a wide shot (below), every hit in a ten-body fight would have shaken the frame.
- **The camera is a rig with its own position** (`M.rig`). A hook that eases from whatever `camX`
  currently holds is easing off a floor the sim already moved this step — and a frame carrying 0 or
  2 sim steps moves it by different amounts. The rig keeps its own float, eases that at a fixed rate
  per frame, and writes the result.
- **It writes whole world pixels.** A zoom rung is a whole number of device pixels per world pixel,
  so a whole-world-pixel camera is a whole-device-pixel camera, and statics and movers land on the
  same rounding (CLAUDE.md: screen position is `round(world − camera)`, rounded exactly once).

Measured over ~500 frames of four different clips (`tools/jitter.js`): **0 fractional camera
positions, max step 1 px per frame, 4–6 direction reversals per clip** — that is the camera
following the fight drifting, not vibrating.

## Wide shots need wide ears

Every cue the sim raises is gated on `nearPlayer` (180 px), which is tuned for a camera on one
player's shoulder. A wide shot of a ten-body fight would be nearly silent under it, so
`M.wideEars` widens the gate to roughly what the frame shows — audible means on screen — and
re-reads it whenever the zoom changes. It is the only reason the shake had to go: the two share
that gate.

Everything else matches montage 1 — the WebAudio tap that captures the SFX bus and structurally
cannot capture the music, one `MediaRecorder` over canvas and audio together, master at 0.4 with
one shared gain (+2.10 dB) across the set so the loudest peak lands at −1 dBFS and a night shot
stays quieter than a melee. The run asserts the music too: zero audio elements were ever created.

Seed 42 throughout (`SEED=n node run.js` for another). The local player is kept at full health
during a battle clip (`M.keepUp`): if the camera operator goes down, `endMatch` puts **RESPAWNING
IN 5** across the upper band and the clip is of that instead of the fight.
