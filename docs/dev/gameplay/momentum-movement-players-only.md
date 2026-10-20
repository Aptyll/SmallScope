# Momentum movement (players only)

A player moves on a real velocity (`p.vx/vy`): `p.input.mx/my` accelerates, and the surface
underfoot sets friction and speed caps. All the tuning constants live in the `players` banner of
[js/sim/player.js](../../../js/sim/player.js) (`ICE_MAX`, `SLIDE_MIN`/`SLIDE_EXIT`, `TRAIL_MIN`, above
`CLASSES`, whose kits are written against them) and the per-surface rates inline in
`updatePlayer()`'s movement block, which every player runs. **Momentum is deliberately players-only**
— animals, robots, and knockback move directly (a direction times a speed through `moveEntity`).

**Facing** (`p.dir`, the sprite a body shows) only ever changes through `faceToward(p, dx, dy, hold)`
in the `facing` banner of js/sim/player.js: the walk, a draw's aim, a raised shield, a work or mining
swing, the zipline, and every aimed action. Near a diagonal the axis the body already faces wins
until the other one leads by `FACE_BIAS` (1.25), so walking or aiming along 45 degrees does not
flick between two sprites each frame. A shot, a slash, a cast, a rush and a roll pass `hold`: the
body keeps that facing for `FACE_HOLD` (0.15 s, `p.faceT`) and the walk cannot turn it straight
back on the next frame. A draw and a shield still turn it every step.

- **Snow at walking speed** uses a near-instant vector approach (settles in ~3 frames) toward
  `PLAYER_SPEED` (72) — crisp starts and stops, nothing floaty.
- **Everything faster** (ice, sliding, or overspeed on snow) switches to a steer-the-heading /
  ease-the-speed model: the travel direction *rotates* toward the input at a per-state rad/s
  rate (carving, never snapping), while speed eases toward a per-state target. Ice pumps
  toward `ICE_MAX` (150, ~2× walk) while a direction is held, glides on idle, and barely
  bleeds overspeed; snow kills overspeed (dodge exits included) in well under a second
  unless you shift-slide to keep it.
- **Dodge roll** is an impulse into the same velocity: `tryDodge()` sets `vx/vy` to
  `max(DODGE_SPEED, current speed)` (a dash never slows you), the roll itself applies no
  friction, and the speed **carries out of the roll** for the surface to spend — so dashes
  chain into real speed on ice but die fast on snow. I-frames still end with the roll. That
  carried speed is also what the roll **hits** for — see [The roll is a hit](dodge-roll.md#the-roll-is-a-hit).
- **Shift = slide**: engages only above `SLIDE_MIN` (85), drops out below `SLIDE_EXIT` (55) or
  on release (hysteresis). Sliding keeps momentum across snow (low friction, reduced steering).
  Tools work normally while sliding — you can draw, hold, and loose the bow or E a tree
  mid-slide; only the hole-flounder and the dodge roll lock tools out. Snow slides have **fatigue** (`player.slideT`): friction ramps
  with slide duration, so the early glide is cheap but the tail drops off hard and a slide
  ends decisively (~2.2 s from full speed). The timer recovers while sliding on ice, so
  snow→ice→snow chains start each snow leg fresh-ish; ice slide friction itself is flat. Above `TRAIL_MIN` (110) it carves a surface-specific double
  trail: on snow, two-tone carved grooves (shadowed top row, lit bottom row — lit from the
  top-left like the rest of the art); on ice, thin frosted skate scratches. Marks are
  `k`-tagged entries pushed into the existing `footprints` decal array (cap 800) every ~2.5px
  of travel, interpolated along the path so a fast frame never gaps the line — never drawn
  into the pre-rendered ground canvas — plus snow-spray particle bursts. Snow grooves have
  their own short hold-then-fade life (`SNOW_TRAIL_LIFE` 3.5 s, fading only over the last
  `SNOW_TRAIL_FADE` 1.4 s), so a trail stays crisp and then wipes away tail-first behind the
  player; ice scratches and walking footprints keep the original 9 s linear fade.
- **Prone** short-circuits all of it: a belly crawl takes the plain direct-approach branch on any
  surface at a flat `PRONE_SPEED`, and sliding is refused outright. See
  [Prone](prone-under-the-snow.md).
- **Walls kill the blocked axis** (`blockedX` → `vx = 0`, same for y) in both the roll and
  normal movement, so you never grind along a treeline at full speed. A wall taken **head-on
  mid-roll** costs more than the axis: past `TACKLE_MIN` of speed driven into it, that is a
  [tackle](dodge-roll.md#the-roll-is-a-hit).
- Walk animation and footprints key off actual speed (`sp > 8`), not input; sliding and
  ice-gliding use the standing pose. The stride's pace is the ground speed too (clamped to
  0.55-1.3 of a walk's), so a drawn bow's creep steps slower than a run and an ice run a
  little quicker. `die(p)` and `Player.reset()` zero `vx/vy` and clear
  `sliding`. Footprints and slide trails from every player share the one `footprints` decal array.

## The zipline

The one movement that is neither walked nor slid: any body standing under **any** side's
cable (each side has one down each lane) ([the zipline](../world.md#the-zipline), `zipNear`) presses E and **clips on** —
`keyPress`/`pointerPress`/`ckRightPress` set `input.jump`, the edge-triggered hop intent the
eagle already reads, and `updatePlay` consumes it for every player alike as `zipToggle(p)`
(js/sim/zipline.js): riding, it lets go; under a cable, `zipStart`. The ride is its own branch of
`updatePlayer`'s movement ladder, after the grapple's and before the surface model
(`zipStep`): the cable sets `p.x/p.y` **outright** — no `moveEntity`, so a wall, a pine or a body
under the line never stops a rider — and `p.vx/vy` to the tangent × `ZIP_SPD` (220 px/s, three
times a walk, under `GRAP_REEL`), which is what the walk-animation gate, the trails and the exit
read. Holding the stick along the cable past a dead zone picks the direction (`p.zipDir`, ±1),
across it does nothing, and either end lets go. **The clip-on reads the way you were last
walking**, not the stick at the press: `p.lastMx/lastMy` (the stick's last held direction, kept
across a stop — set in `updatePlayer` whenever it is held) dotted with the cable's tangent past
−0.3 rides toward the base, anything else rides **toward the front** — so a body that walked home
and stood still for the press goes home, and a walk in across the cable from the lane takes the
default. At either end the cable has one way to go and the clip-on takes it, whatever the walk
said. State on the body: `p.zip` (the line's index in `zips`, −1 for none), `p.zipD` (px along),
`p.zipDir`, `p.lastMx/lastMy` — declared in `reset()` beside the grapple's, so a respawn never
comes back clipped on; `die` lets go too.

**The cable under the pointer.** `hoverZip()` (actions.js, beside `hoverFish`) is either
side's cable under the pointer as drawn (`zipUnder`, js/sim/zipline.js — within `ZIP_HOVER` of the
strand, never the invisible track under it), while the body is on the ground with nothing open
over it. While it holds, `drawZips` lights the whole line in the work-target rim's two golds on
its beat, and `drawZipGuide` (js/draw/zipline.js, right after the aim line) runs a static dotted
gold line from the feet to the nearest point of the track and a bar across it there — the walk
that puts the cap over your head — only while the body stands past `ZIP_GRAB` (32 px, two
tiles); inside it the cap is the whole answer. The click scheme's press asks the same
`zipUnder`, so what lights is what a press takes.

**The walk to the cable — a channel.** E (or the click scheme's right press) with the pointer on
a cable but the body out of reach is the same hop intent, and `zipToggle` reads it off
`input.aimX/aimY` (`zipUnder` again — the aim rides the wire, so a host answers a client the
same): `zipWalkStart` sets `p.zipWalk` and the line in `p.zipWalkL` (declared in `reset()`, cleared by `die`) and the body
walks itself there — `zipWalkStep`, called at the top of `updatePlayer`'s input read, routes
through `navTo` to the **mount** (`zipMount`: the nearest point of the track whose ground a body
can stand on — the track point itself is the pylon's own tile at a pylon; the bots walk to the
same point), re-read every step and never a straight line at it, hands the ladder the stick to
hold, then `zipStart`s the moment it is inside `ZIP_GRAB`.
It is a channel because the player is not holding the stick: **any movement input ends it**, the
legs are theirs again — and so does anything that takes the body (a dodge, a draw, a cast, a
rush, a shield, the grapple, a slide, prone, a stun, a root, a net, a hole, the air, a death),
a route that fails or pins (`navTo`'s `ok`), and E again (`zipToggle` calls the walk off ahead
of everything). No timer. The walk leaves `p.lastMx/lastMy` alone, so the clip-on at its end still
rides the way you were walking before the press. While it runs, the cable stays lit and the guide
line stays, pointer or no pointer (`zipLitLine`, js/draw/zipline.js).

**Hands on the handle.** `p.zip >= 0` joins the inline gates of `tryWork`, `autoWork`,
`tryAbility`, the bow draw (updatePlayer), `autoFish` and `tryProne`; `zipStart` itself refuses
a stunned, floundering, rolling, rushing, casting or shielded body and ends a grapple, a draw, a
meal, a catch and a slide. A meal and a card are the two things a rider may still use. `tryDodge`
rolls off the cable the way it rolls off the rope (`zipEnd` first, then the dash). **A rider is
still a body to every weapon** — arrows, the roll's sweep, a tower, a wolf, `seenAt` — and plain
damage never dismounts (its knockback decays unspent, since the ride branch never applies
`kbx/kby`); a **stun, a root or a net** does, through `zipEnd(p, true)` inside `stunUnit`,
`rootUnit` and `netUnit` (any body's, a soldier's too): dropped at rest on the snow under the
cable. Another body never shoves a rider (`separateUnits` skips `zip >= 0` the way it skips
`inAir(p)`), but **two rivals on one cable crash**: `zipCrash` (js/sim/zipline.js, called in `updatePlay`
once the robots have stepped) finds every pair of riders of different sides on the same line
within `ZIP_CRASH_R` (8 px) along it, or past each other since the last step (`zipLast`), and
`stunUnit`s both for `ZIP_CRASH_STUN` (0.8 s, the tackle's top) — so both fall at rest where they
met. A side's own riders pass through each other. Players (any seat) and soldiers crash alike.

**Letting go keeps the cable's speed** — `zipEnd(p, false)` leaves `vx/vy` at 220 px/s for the
surface model to spend exactly as `grapEnd` leaves the reel's, so a hop-off is a dash (snow kills
it in under a second) and shift on landing carves a slide; a body coming down over a solid tile
(the odd pine or rock on the shoulder) is set beside it (`nearestDryTile`). Riders draw lifted
`ZIP_ALT` px with their shadow on the ground, the handle over the head and a rope up to the cable
(`drawZipHandle`, js/draw/zipline.js), in the standing pose; the bare key cap over the cable is
`drawZipHint` (js/ui/wheel.js). Bots ride it too, through the same hop intent, folded into every
walk the ladder orders ([bots](../multiplayer.md#bots)), and so do the waves' soldiers
([Soldiers](robots.md#soldiers-the-waves)). The ride's own steps are shared by every body: `zipBoard` (onto
the handle, the end's one way included), `zipRide` (the cable's step) and `zipEnd`; `zipStart` is
the player's preparation in front of `zipBoard`, `zipStep` the player's stick and facing around
`zipRide`.
