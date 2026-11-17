# Seeing the game

`node app/see/see.js` shows you one place on the map the way a player has it, and pixel for pixel:
a named spot, at the real zooms, by hour, with heroes and the HUD, with art that is not built yet
standing in the world, today beside new, or the whole map in one piece. It is how a thread looks at
the game before it draws, and how it checks what it drew. Making the art is the `art` skill
([art.md](art.md)); film and GIFs are the media kit ([media.md](media.md)), which this stands on.

It needs nothing running: it serves the tree itself, opens headless Chrome (`CHROME=<path>` if none
is found), stages the spot and holds the clock. Node only, no packages. A look takes about three
seconds. Work folders (`W` below) stay outside the repo, in the project files.

## What to run

```
node app/see/see.js --spots                                    # every named place, off the live map
node app/see/see.js --spot orca --stocked --out W/orca         # three looks of one place
node app/see/see.js --spot wolf-den --time day,dusk,night --out W/den           # by hour, plus hours.png
node app/see/see.js --spot wolf-den --swap wolf=W/new.png --out W/vs            # new art for a live sprite, today beside new
node app/see/see.js --spot orca --put W/shelf.png@0,24:ground,W/rock.png@-60,10:stand --out W/pit   # unbuilt art laid in the world
node app/see/see.js --spot lane-top-mid --vs origin/main --out W/vs             # a code change against main
node app/see/see.js --spot base-w --strip 8@10 --out W/idle    # 8 frames 10 ticks apart: motion on one sheet
node app/see/see.js --map --out W/map                          # the whole map, no seams, and a chart of every place
```

Every flag is in the comment at the top of `app/see/see.js`; running it bare prints that.

## The three looks

A spot gives three pictures an hour, each 1280x720 and each for a different question:

| file | what it is | what it answers |
| --- | --- | --- |
| `far-<hour>.png` | the world layer, 1 image px a world px, 1280x720 world px round the spot | does the shape read at the smallest size, and does the place sit right in its surroundings |
| `play-<hour>.png` | the real screen at the resting zoom, HUD, names, health frames and weather on it | what a player actually has: does it clash with the HUD, a name, a bar |
| `close-<hour>.png` | the world layer, 8 px a world px, 160x90 world px round the spot | the pixels: outline, light, stray dots, how it meets the ground |

The world layer is everything from the ground to the light, straight out of the game's own world
buffer. It leaves out what is the screen's and not the world's: the HUD, falling snow, a bird in
flight, the noon shafts and the night's dark rim. `play` has all of those.

Hours are `dawn morning day noon dusk night` (or seconds into the cycle). `day` is plain daylight;
`noon` adds the shafts. With more than one hour, `hours.png` sets them side by side.

## Places

Names come off the game's own registries each run (the camps, the towers and pumps, the merchants,
the perches, the lanes), so a camp that moves takes its name with it. A name several things share
takes its side (`wolf-den-w`, `tower-nw`) and counts outward from the middle (`wolf-den-w2`). A
part of a name is enough (`orca`, `bear`, `scrap`), a beast's kind works too (`wolf`), and
`+dx,dy` shifts the spot in world px (`lane-top-mid+0,-40`). `@X,Y` is a world point, `tTX,TY` a
tile. `--stocked` brings every camp out at once, the timed ones too (the orca, the bear).

One hero stands on open ground beside the spot for scale (ARMATOS, the local player, so the HUD is
theirs). `--hero FOSSOR,VELOX@50,10:foe:left` picks who, where and which way; `--hero none` leaves
the place empty.

## Art that is not in the game yet

The game draws it, so its shade, the hour's light, the sort and the health frame are the real ones.

- `--swap KEY=FILE.png` puts a PNG in place of a sprite the game already draws, everywhere it is
  drawn: a beast (`wolf`, every frame, mirrored for the other facing; `--face right` if the PNG
  faces right), a prop (`den`), anything under `SPRITES` by its path (`teamBuild.0.stall`).
- `--put FILE.png@dx,dy:MODE` stands a PNG at the spot: `ground` lies flat under every body (an
  ice shelf, a worn patch), `stand` stands on its bottom centre in the sort with its shade (a rock,
  a den, a post), `beast` is a camp beast wearing it, with its health frame.

With either, the tool shoots the spot twice, without the art and with it, and writes the pair:
`vs-close-*.png`, `vs-play-*.png`, `vs-far-*.png` (TODAY left, NEW right), `changed-far-*.png` (the
far look greyed, what changed left in colour and boxed), and `vs-close-*-zoom.png` when the change
is small enough to blow up. The same files come from `--vs REF` for a code change: REF (default
`origin/main`) is exported whole and played beside this tree.

Each `vs` sheet's headline counts the pixels that differ, and the JSON line carries the count and
the box. **`NO PIXEL DIFFERS` means the change cannot be seen at that spot**: pick the spot where it
shows. Two loads of one tree paint the same pixels (`--vs HEAD` reads 0 on every look), so a count
is the change and nothing else.

A picture with art the game does not have is STAGED. The sheets say so in their headline; say so
wherever you show a bare look.

## The whole map

`--map` writes `map.png` (the whole map, 1 px a world px), its quarters `map-nw.png` and the other
three (each small enough to look at whole) and `map-spots.png`, a half-size chart with every place
named: for finding a spot, not for judging pixels. The map is stitched from overlapping views, and
the tool then lays a second set of views across every join and counts the pixels that disagree
(`seam` in the JSON). It must read 0; anything else is a pass that draws by the view instead of by
the world, and the tool says so.

## How to look

- **One picture at a time, at its own size.** Every file here is at most 1280x720 on whole pixels
  on purpose: a picture wider than about 1500 px is shrunk on its way to a reader's eye, and
  shrunk pixel art is a blur that hides exactly what you are judging. `map.png` and `--size 1080`
  shots are for people; the JSON lists them under `big`. Never judge from a thumbnail or a
  screenshot of a sheet.
- **Far first, then play, then close.** If the flat shape does not read at 1 px a world px, no
  shading saves it. If it reads far but fights a name or a bar in play, it is not done either.
- **Always a second hour.** A thing that holds by day can sink into the snow at night.
- **Beside something known.** The hero and the camp's own beasts are the ruler; a new thing alone
  in a frame tells you nothing about its size or weight.
- **Old beside new, never new alone**, and say the count: "412 world px differ, all inside the den".
- **You still cannot judge your own read.** A look tells you what is there; whether it reads is the
  blind reader's call (the `art` skill, step 4). Give the reader `close` or `far`, never a sheet
  with a headline on it.

## Staging of your own

`--do FILE.js` runs your own lines in the page once the stage is set, with `S` (the tool's page
side), `M` (the media kit's), `D` (`window.DBG`) and `at` (the spot, `[x, y]`); `--ticks N` then
runs the sim. Wake a camp, walk a foe in, start a cast:

```js
// W/wake.js: a rival steps in and the pack wakes
const foe = players.find((p) => p.team !== player.team);
foe.x = at[0] + 70; foe.y = at[1] + 30; foe.invuln = 0;
hurtUnit(animals.find((a) => a.kind === 'wolf'), 1, 1, 0, player);
```

`--boxes` turns the hitbox overlay on, `--bare` takes the health plates and world text off,
`--weather snow` sets the day's weather, `--fog` keeps the fog of war.

## How it holds still

Before any game script runs, the page's clock is replaced by one only a tick moves, `Math.random`
is seeded, and the page is frozen the moment `window.DBG` exists (the same three moves as
`app/check-same.js`). A capture paints a frame without stepping anything, so a pine's sway and a
cloud's shade are the same in every view of one moment. That is what lets a wide picture be
stitched with no seam and lets two runs be compared pixel for pixel.

A world picture wider than one view is stitched: each view is kept only well inside its own edge,
because the game does not draw a pine or a tower whose foot is off the view. Views are taken at
the farthest zoom the world buffer holds.

## Traps

- The first hero is the local player and the HUD is theirs; the staged seats are human-controlled,
  so nobody acts unless your `--do` lines make them.
- A swapped beast shows the one PNG on every frame: it is a still, good for a look, not for motion.
- `--put` art is not in the sim: nothing collides with it and nothing is hidden by fog behind it.
- A staged `beast` is a live wolf under the paint. It will wander and it can be hit.
- The match clock starts near zero, so timed camps are not out: use `--stocked`.
