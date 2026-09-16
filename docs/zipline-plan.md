# The zipline plan

A cable per team from the rim of its crater down the spur and along the road's verge to a
terminus short of the middle. Anyone on that team clips on under it with E, rides at three times
walk speed in whichever direction they hold, and lets go anywhere. The walk out is dead time; the
fight in the middle is not, so the cable stops where the fighting starts. Designed 2026-09-16 on
`noah/zipline`; this file is the source. Work it **top to bottom**: each task is one PR, verified
in the browser pane (`?seed=42`, DBG staging, POST /shot crops) with its docs in the same PR.

Before any task: read CLAUDE.md, docs/dev/game.md, world.md's *The road*, gameplay.md's
*Momentum movement*, multiplayer.md's *The input struct*. Every CLAUDE.md rule applies — the ones
this feature will trip over first: a player's act reads `p.input` (a key handler calls no sim
function), `skin(team)` for every colour, `inAir`-style skips are a list you join, `hurtUnit`
for every blow, no `rng()` inside `genWorld()`, show don't label.

## The rulings (Noah, 2026-09-16)

- **Fixed line, not "the front".** The front moves; the cable does not. Each team's runs from
  its base to `ZIP_MID_GAP` road-units short of the centre cairn, so the middle stretch where the
  waves meet is cable-free and is always walked into.
- **Symmetric speed both ways.** A trip home costs the round trip and what you miss at the
  front, League-style. This softens the counter's "walk to a body" bargain on purpose; if base
  trips get abused the levers are a slower home direction or a base end at the junction.
- **Team-locked.** Only the owning team clips on. Riders are still attackable near the front
  terminus, which is where the risk belongs.
- **Hands on the handle.** No swing, shot, cast, fish or prone while riding. Damage passes
  through and does not dismount; a stun, root or net drops the rider onto the snow under the
  cable. A dodge rolls off it, the way it rolls off the grapple.
- **Bots ride it** — as a follow-up task, so humans do not get a match-long tempo edge. Waves
  never ride: the march is the clock.
- **Breakable pylons** are a third, optional task.

## The measured numbers (seed 42)

| | RED (team 0) | BLUE (team 1) |
| --- | --- | --- |
| gate u (`roadSpan`) | 47 | 174 |
| junction u (`roadNest`) | 34 | 197 |
| centre u (the cairn, round((u0+u1)/2)) | 111 | |
| terminus u (`ZIP_MID_GAP` 20) | 91 | 131 |

A road unit is √2 tiles (22.6 px). Roost to the cairn walks about 28 s at 72 px/s, roost to the
rival junction about 54 s. The cable (crater rim → junction, 56 u along the road) is about 1500 px:
**7 s at 220 px/s**, then about 6 s of walk to the cairn. The respawn wait is 3 s at level 1 and
25 s at max, so today the walk is the larger half of a death for most of a match.

## Tuning constants (`js/world.js`, the `the zipline` group under the road's)

| const | value | what |
| --- | --- | --- |
| `ZIP_MID_GAP` | 20 | u short of the centre the front terminus stands |
| `ZIP_OUT` | 0.6 | tiles past the ragged road edge the cable runs (the shoulder) |
| `ZIP_SPAN` | 10 | u between pylons along the road (about 226 px) |
| `ZIP_SPD` | 220 | px/s — 3× walk, under `GRAP_REEL` (260) so the hook stays the fastest thing |
| `ZIP_GRAB` | 14 | px off the cable's ground track a body may clip on from |
| `ZIP_ALT` | 10 | px the body hangs above its shadow |
| `ZIP_SAG` | 3 | px a span sags at its middle |
| `ZIP_AI_GAIN` | 4 | s a bot must save before it walks to a cable (task 2) |

---

## Task 1 — the line and the ride (PATCH 3.56)

**Geometry.** Each team's line is a polyline of pylon points in world px, built at boot by
`placeZips()` right after `placeRoad()` (pure reads of `roadNest`, `roadSpan`, `roadEdgeAt`,
`objAt`; rolls nothing, so `genWorld` and every seed's ground are untouched):

1. the **crater rim** on the spur axis: the nest tile (`roadNest(team).nx/ny`) plus `BOOM_R + 1`
   tiles toward the junction — the spur is not paved yet at boot, but the pad and the spur run
   from those two points, so the line and the road grow onto the same ground;
2. the **junction** `roadNest(team).x/y`, offset to the verge like the rest of the road furniture:
   `s = roadEdgeAt(u, side) + ZIP_OUT` on the bird's own right (`roadNest(team).side`, −1 for
   RED, +1 for BLUE — the two cables sit on opposite verges and mirror through the centre like the
   nests and camps), placed by the same rule as `mark` (world.js:655): fell a pine or rock on the
   tile, refuse anything else, then `placeObj(tx, ty, 'pylon', { team })`;
3. one pylon every `ZIP_SPAN` u along the road out to the terminus `u = centre ∓ ZIP_MID_GAP`.

Registry `zips[team] = { team, pts: [{x, y}], len, cum: [] }` with `zipPoint(z, d)` (a distance
along → world px and the unit tangent), `zipNearest(z, x, y)` (→ `{ d, dist }`), `zipNear(p)`
(the line a body may clip on: its own team's, `dist <= ZIP_GRAB`, not in the water). Exposed on
`DBG` as `zips`, `zipPoint`, `zipNearest`.

**The pylon** is an `OBJECTS` entry — `pylon: { solid: true, mm: (o) => grey, map: null }` — so
`isSolidTile`, `canPlaceAt` and both maps handle it for free. It is inert to E (no `tool`, no
`verb`). Its sprite bakes beside its draw code in js/draw/ like `CAIRN_SPR` (never under
js/sprites/): a 10×24 pole with a crossarm and a two-pixel band in `TEAMS[skin(o.team)].coat`,
drawn bottom-aligned in the y-sorted object branch of `render()` (render.js:431 is the model),
sort key `(ty + 1) * TILE` like a pine so a body walking behind it is covered.

**The cable pass** — `drawZips(ex, ey, now)` in js/draw/ — sits in `render()` between
`drawDropAir` and `renderLighting` (render.js:664-665): over every body and canopy, under the
night grade. Per span: a 1 px dark line with a 1 px lit line under it, sagging `ZIP_SAG` at the
middle (quadratic), leaning `windSway(mid tile)` px sideways so it moves with the pines and stills
at dusk. Bounds against `WV_*`; culls a span whose bounding box misses the frame. Two polylines of
about eight spans each is nothing.

**Riding state** on the `Player`, declared in `reset()` beside the grapple's (player.js:560) so a
respawn never comes back clipped on: `zip = -1` (the line's team index, or none), `zipD` (px along),
`zipDir` (±1). Scalars on purpose: the wire diffs them per field, and `zipD` joins `SNAP_QUANT`.

**Mount and dismount** go through the input struct — `input.jump` already exists as the
edge-triggered "hop" intent (the leap off the eagle), is set by `keyIs(e, 'work')` in drop mode
(input.js:248), is on the client→host list (net.js:258) and is consumed at the top of the player
loop (sim.js:268). Extend it:

- `keyPress` (input.js:300, the work branch): before the work-target chain, `if (player.zip >= 0
  || zipNear(player)) { player.input.jump = true; return; }` — so under a cable E clips on and
  E again lets go, and the tree beside the cable is still chopped when you are not under it. The
  same line in `pointerPress`'s work path and `ckRightPress` so pad and touch and the CLICK scheme
  all reach it (a controller presses the same key through `keyPress`; nothing else is needed).
- `sim.js:268` consumption: `if (p.aboard) dropJump(p); else if (p.zip >= 0) zipEnd(p); else {
  const z = zipNear(p); if (z) zipStart(p, z); }`.
- `zipStart(p, z)`: `p.zip = team; p.zipD = d; zipDir` = the sign of `input.mx/my` projected onto
  the tangent, or **toward the front** when the stick is idle (away from own base, the direction
  you are almost always going); clear `sliding`, `prone`, the draw, the catch; `sfxFor(p, ...)`.
- `zipEnd(p, fell)`: `p.zip = -1`, position stays where the cable put it, **velocity stays** at
  the tangent × `ZIP_SPD` so the exit carries momentum into the normal branch's decay exactly the
  way `grapEnd` does — shift on landing carves a slide, a hop-off is a dash. With `fell` (a stun,
  root or net) velocity is zeroed instead: knocked down, not launched.

**The branch** joins `updatePlayer`'s if/else ladder (sim.js:684-814) between the grapple reel
and the normal branch: every step, a held stick along the tangent past a dead-zone flips
`zipDir`; `zipD += zipDir * ZIP_SPD * dt`; `p.x/p.y` = `zipPoint(z, zipD)` — set directly, no
`moveEntity`, so a wall or pine under the cable never stops a rider; `p.vx/vy` = tangent ×
`ZIP_SPD` (so trails, the walk animation gate and the exit all read a real speed); knockback
(`kbx/kby`) decays but is not applied; reaching either end calls `zipEnd`. The hole-fall test
after the ladder skips a rider like it skips a roll.

**Locks** — `p.zip >= 0` joins the inline lists at `tryWork` (actions.js:154), `autoWork` (:231),
`tryAbility` (abilities.js:180), the bow-draw gate (sim.js:1019), `autoFish` (tools.js:894) and
`tryProne` (actions.js:387). `tryDodge` instead calls `zipEnd(p)` first and rolls, the way it
`grapEnd`s (actions.js:247). Eating and cards stay allowed. `stunUnit` (actions.js:891, beside
its `grapEnd`), `rootUnit` and `netUnit` call `zipEnd(p, true)`. `die` needs nothing — `reset`
clears it. Under `NET.isClient` none of this runs, and the state arrives on the wire.

**Contact and targeting.** `separateUnits` (nav.js:63) skips a rider like it skips `inAir` — the
body is above the ground. Everything else keeps seeing it: arrows, the roll's sweep, turrets,
wolves, `seenAt`. That is the whole "riders can be attacked" rule, and it costs one line.

**Drawing the rider** — `drawPlayer` (bodies.js:236): a rider keeps its shadow at `py + 15` and
draws the body `ZIP_ALT` higher, in the standing pose, with a 3×3 handle above its head and a
1 px stroke from the handle to the cable; the overhead stack rises with it (one `hy`). The rider
stays in the y-sorted list at its ground `y`, so a pine still covers it and the cable pass still
paints over it. The team paint reads `skin(p.team)` as it already does.

**The prompt.** Standing under a cable and not riding: a bare key cap over the cable at the
body's tile — `drawKeyPrompt(x, y, '', pressed, 'work')` from `drawWorkHint`'s proximity
family (wheel.js:307 `drawRackHint` is the model), no verb, since the cable over the head is the
affordance and the cap is the carve-out. Riding: nothing.

**Maps.** The minimap overlay (minimap.js:147-189) and the chart (panels.js:372-407, the eagle
flight path at :384 is the line precedent) each stroke both polylines 1 px in
`TEAMS[skin(team)].coat`, clipped to the disc / in `MAP_S` space. Pylons show through `mm` grey.

**Docs in the same PR.** game.md: one sentence under *The road is where the match is fought*.
world.md: a *The zipline* group under *The road* (geometry, placement, the registry). gameplay.md:
a *The zipline* section under *Momentum movement* (the ride, the locks, the exit speed) and a line
in *Death and respawn*. multiplayer.md: `input.jump`'s new meaning in *The input struct*, and a
line under *PvP*. code-map.md rows for the new banners. checklists.md: the `zip` skip joins the
`inAir` list rule. rendering.md's pass table gets the cable pass. CLAUDE.md's `inAir` hard rule
gains "and `p.zip >= 0` where the body must not be shoved". Patch note + `PATCH_TXT` 3.56.

**Verify (browser pane, `?seed=42`).** `DBG.zips` has two lines of the expected u range and every
pylon tile is `objAt` = pylon on snow/road, none on ice. Stage: `startGame`, step to play,
`setControl(1..9, 'none')`, `hopOff(player)`, `warp` beside RED's second pylon; `player.input.jump
= true; DBG.step(1/60, 1)` → `player.zip === 0`; 60 steps → `zipD` grew by ≈220 px, `p.x/p.y`
on the cable; hold `input.mx/my` back along the line → `zipDir` flips; `input.jump` again →
`zip === -1`, `hypot(vx, vy) ≈ 220`, a slide with `input.slide`; `stunUnit(0.5)` mid-ride drops
the body at rest under the cable; a rival bot's arrow hits a rider (`hp` falls, `zip` unchanged);
`tryWork`/`tryAbility` do nothing while riding; a BLUE body under RED's cable gets no prompt and no
mount. Crops: a pylon, a span with its sag, a rider with the handle, the chart. `.` for hitboxes.
A minute of unattended play raises no page errors; `DBG.netEchoRun` shows a rider on a client.

## Task 2 — bots ride it (PATCH 3.57)

`updateAI` reaches every walk through one `steerTo(x, y, reach, budget)` (ai.js:437). Wrap it:
`aiGo(x, y, reach, budget)` asks `aiZipPlan(p, x, y)` whether a ride saves `ZIP_AI_GAIN` seconds —
walk-time straight (`d / walk`) against walk to the nearest own-cable point + ride to the cable
point nearest the goal + walk from there — and if so steers to the mount point, sets `inp.jump`
inside `ZIP_GRAB`, holds `mx/my` along the ride's direction, and sets `inp.jump` again at the exit
distance. Stored on `p.ai.zip = { d0, d1 }` and dropped when the goal changes. The fight rung
(ai.js:574) dismounts first (`inp.jump`) when a rival is in sight, so a bot never rides past an
enemy holding the handle. Waves are untouched (`robots.js:711` walks `roadWaypoints`).

Verify with the headless bot-vs-bot harness (multiplayer.md *Calibrating a level*): a NORMAL bot's
first roost-to-mid arrival drops from ~28 s to ~13 s, and the 15-minute match length shifts —
record the new buckets in the memory note. Docs: multiplayer.md *Bots* gets the ride rung.

## Task 3 — breakable pylons (optional)

A pylon takes E from a rival like a building: give the entry `tool: 'axe'`, `hp`, `team`, and a
`hitObject` branch that fells it into a stump-like `pylonDown`; a line with a felled pylon is cut
into two rideable halves (`zips[team].cut`), and the merchant's ambient repair (the foreman plan)
re-raises it. Not before task 2 and not before the foreman plan's repair task lands.

## Open questions to watch in play, not decide now

- Does 220 px/s feel fast against the road's 7 tiles, or does the sag/sway need to read faster?
- Is `ZIP_MID_GAP` 20 the right walk into the fight (6 s), or should it be 25?
- Do riders arriving one at a time at the terminus get farmed by a hunter parked under it? If so,
  the front pylon could stand a few tiles back into the verge's cover rather than on the shoulder.
