# Montage 3: the Steam trailer takes

Thirty-three short takes of Softfall for cutting the Steam page trailer. They are recorded at
**1920×1080 (16:9, 60 fps)** with **every sound effect and no music**. Each clip is 3–5 s and
shows one action. The set covers the title menu and the wiki, the eagle ride in, work on the land,
the weapon well, both classes' abilities, loot, robots, the team battle, night, the wide shots and
the roost. The mp4s and their webm originals are gitignored; `tools/` rebuilds the whole set from
the seed.

```
node app/server.js                                   # the page has to be served
cd docs/media/montage3/tools && node run.js           # all 33, about twenty minutes
node run.js 08-,17-                                   # ...or some, by name fragment (pass GAIN=-0.40 to match the set)
node shot.js 09-                                      # stage it and take a still instead
node timeline.js 16- 400,900,1600                     # stills of one roll at several moments, with positions
node review.js                                        # contact sheets of the RECORDED mp4s, four frames a clip
node verify.js                                        # check every mp4: format, timing, lost states, a cut on frame 0, levels
node jitter.js                                        # re-measure the camera
node scout.js                                         # print the scouted locations for the seed
```

Stills and sheets land in `tools/shots/` (gitignored). Seed 42 throughout (`SEED=n` for another).

## The cast

Ten named characters, five a side. The paint flips with `settings.teamBlue` (your side is always
BLUE on your screen), so the names carry no colour. The profile's character is renamed WREN
before the first shot, so the title's name tag reads WREN too.

| your side | the rival side |
| --- | --- |
| **WREN** (the camera), ALDER, JUNIPER, BRIAR, FINCH | ROWAN, ASHE, LINNET, THORNE, SABLE |

## The clips

| clip | what happens |
| --- | --- |
| `01-main-menu-the-frost-planks` | the real title screen: the pointer walks down the plank column and each plank lifts as it arrives |
| `02-the-wiki-classes-page-scrolls` | the CLASSES page scrolled end to end: both classes, stat pips, all eight abilities |
| `03-the-wiki-arsenal-and-beasts-tabs` | the ARSENAL table scrolls, the pointer clicks BEASTS, and the beast cards scroll in |
| `04-the-eagle-carries-the-team-in` | the widest view: the crew on the wings, the road and the zipline below, and the rival eagle crossing under |
| `05-the-team-leaps-off-into-the-fall` | the crew aboard, the bots leaping off, WREN's jump and the fall onto the road |
| `06-chop-a-pine-down-to-the-stump` | a walk up to a stand of pines, the swings, the fall, a JACKPOT |
| `07-mine-a-rock-to-rubble` | the pick on a rock until it breaks and a tool pops out of it |
| `08-swap-the-tool-for-a-loaded-longbow` | walking over a built LONGBOW and two piles of fittings: the swap, and the shelf filling cell by cell |
| `09-hefty-wand-fans-burning-shots` | a LONGBOW carrying HEFT + SPLITTER + CINDER BURST fanning fat burning shots into a wolf pack, WOLF DOWN, level-ups |
| `10-warrior-bull-rush-carries-a-body` | BULL RUSH across the frame: the telegraph line, the charge, a body carried |
| `11-warrior-stomp-cracks-the-snow` | STOMP in the middle of three rivals: the ring, the knockback, the crater |
| `12-warrior-shield-wall-then-slam` | the wall raised, then the same key as the slam |
| `13-hunter-piercing-shot-down-the-rank` | the locked draw and one arrow through four bodies in a row |
| `14-hunter-net-shot-drops-a-drape` | the net shot onto ASHE |
| `15-hunter-grapple-reels-into-the-pines` | the hook catching a pine and the reel into the treeline |
| `16-dodge-roll-through-a-charging-wolf` | a roll through a wolf (the roll is a hit), and the wolf's answer |
| `17-three-chests-burst-their-hoard-into-the-snow` | three chests sprung in a row: gold, cards, a tool and bits out of each |
| `18-a-kill-bursts-the-body-in-team-colour` | THORNE shot down: the burst in the team's colour and THORNE DOWN |
| `19-robot-war-two-columns-collide` | two soldier columns marching at each other across the frame and fighting where they meet |
| `20-a-turret-cuts-down-an-intruder` | ASHE walking onto a turret's mark beside a wall |
| `21-two-lines-close-across-the-snow` | ten players, two lines, closing on each other across the field |
| `22-the-lines-collide-in-the-middle` | contact: the lines break into each other |
| `23-arrow-volley-across-the-gap` | ten longbows held apart: the shot is the air between the lines |
| `24-the-melee-closes-to-swords` | every body a blade, the camera holding the pile around WREN |
| `25-a-soldier-column-marches-into-the-fight` | soldier columns walking into the players' fight from both sides |
| `26-night-battle-lit-by-care-arrows` | the same fight after dark, lit only by CARE ARROWS landing |
| `27-night-in-the-dire-wolf-hollow` | the epic camp after dark: dead trees, the dire wolf, a light arrow |
| `28-nightfall-over-the-widest-view` | the max-out view at night, a slow dolly over a herd that bolts from a hunter |
| `29-zoomed-all-the-way-out-over-the-field` | the max-out view, 60 × 34 tiles, the whole ten-body engagement at once |
| `30-the-camera-pulls-back-off-the-fight` | five zoom rungs stepped out while the fight runs |
| `31-zoom-punch-from-wide-into-the-kill` | from the widest rung into SABLE's death, a rung every 0.7 s |
| `32-the-zipline-runs-the-road` | WREN clipping onto their side's cable and riding it down the road |
| `33-the-rival-roost-under-siege` | the rival eagle on its roost among walls and turrets, both sides fighting at its feet |

## What is real and what is staged

Everything on screen is the game running its own rules. The scenes *stage* where bodies and
things stand, what is loaded into a tool, the time of day and the camera. Then the sim plays it
out: both battle sides are the game's AI under a fighting profile, a soldier walks its own march,
a chest rolls its own loot, a turret picks its own mark.

**A player's death no longer spills their pack.** Since 3.55 a body keeps its gold, bag and
weapon, and a kill pays a flat bounty. So "a death spilling items" is two clips, both honest:
`18` is the death itself (the team-colour burst and the DOWN line) and `17` is the thing in the
game that really does burst loot across the snow. There is no "hefty wand" item. `09` is the
build montage 1 named that, a LONGBOW packed with HEFT, SPLITTER and CINDER BURST.

## 16:9

At a 1080-tall viewport `fitCanvas` picks 3 device px per game px, so the view is exactly
640×360, the game's own authored frame. The canvas is 1920×1080 with nothing cropped,
letterboxed or rescaled, and every zoom rung is an exact third (0.6667 … 4.6667). Every shot is
composed ACROSS the frame: the battle lines stand left and right (`M.battle`'s `axis: 'x'`) and
a charge or a walk crosses the screen. Close shots stand in front of a treeline. A 16:9 frame at
zoom 2–3 is only 13–20 tiles wide, so the scout finds a clear 21 × 5 strip with pines behind it
and none in front (`W.lane`).

## No camera jitter

Five rules kept together:

- **Screen shake is off** (`settings.shake`). It is a random per-frame offset, and the widened
  audio gate would otherwise raise one on every hit of a ten-body fight.
- **The camera is a rig with its own position** (`M.rig`), which never eases off `camX`. The sim
  has already moved `camX` this step.
- **It writes whole world pixels.** On any rung that is a whole number of device pixels, so
  statics and movers round identically. At the title the camera is the sim's own float drift,
  and `M.titleCam` rounds it.
- **One camera move and one video frame per sim step.** This machine refreshes at ~175 Hz
  against the sim's fixed 1/60. A camera hook run per render eased a different number of times
  between two states. `captureStream(60)` sampled on its own clock and doubled or dropped a step
  about once a second. So the hook runs inside `update()`, and the recorder is handed a frame by
  hand (`requestFrame`). A canvas capture delivers at most one frame per composited frame, so
  while recording the loop is never allowed two steps in one rAF: a late rAF's extra steps are
  owed and paid one per following rAF (`M.owed`), which puts every state on screen for a frame of
  its own and has the sim back on the wall clock within milliseconds. The encode then times frame
  N at N/60 (`setpts`), so a render that ran long never becomes a doubled or dropped frame.
- **The encoder's start-up stall is cut off.** About 0.2 s after a recorder starts, the page
  stalls ~40 ms, which used to cost one state. The runner starts recording 600 ms before the
  scene's hooks are armed. `M.mark()`, in the same evaluation that arms them, counts where the
  shot begins, and the encode trims that pre-roll plus a two-frame margin from both tracks.

Measured on the final set with `node verify.js` and `node jitter.js`:

- **Format.** All 33 clips are 1920×1080 at 60 fps with AAC audio, and every mp4 frame lands
  exactly 1/60 s after the last.
- **No skipped state.** No sim state is missing from any kept frame. A lost state shows up as a
  permanent 16.7 ms step in frame time against frame index. The check found 30 of 30 single frames
  removed from a real clip's timings and flags nothing on the clip as recorded.
- **No cut on frame 0.** A spliced cut reads 21.7 against ~2 for the rest of the clip; no clip
  comes near that.
- **The camera, per sim step over 13 shots.** The shots cover the title drift, the eagle lock,
  the follow rigs, the battle rig, the zoom ladder, the dolly and the zipline. The camera had 0
  fractional positions and 0 flickers (a move undone on the very next step). The largest moves
  are 3–5 px a step, where the subject itself moves that fast (the eagle, the zipline, the
  grapple's reel). The 160 px steps on 30 and 31 are the zoom rungs themselves.

## Sound

Every cue the sim raises is gated on `nearPlayer`, so the wide shots widen that gate to about what
the frame shows (`M.wideEars`). The WebAudio tap mirrors everything that reaches the destination,
which is the whole SFX bus, into the recorder. The music layer is `new Audio()` elements.
`js/audio.js` never calls `createMediaElementSource`, so no music is ever in the graph the tap
records, at any volume, and the run also holds the music volume at 0. Master sits at 0.4, and
one shared gain across the set (−0.40 dB on this cut) moves only the loudest peak to about
−1 dBFS, so a night shot stays quieter than a battle. The title screen is nearly silent, peaking
around −40 dB: it only has its ambience, and the hover makes no sound.
