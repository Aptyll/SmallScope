# Gameplay systems

## Deep snow

The DEEP band of the [snow depth map](world.md#snow-depth) slows **every** walker, not only
players: each unit carries `e.wade` (0..1), eased toward whether its feet (`y + 4`) are in deep
snow at `DEEP_EASE` (~95% in a quarter second, and back out as fast) by `wadeStep`, which
`updateUnitStatus` runs for players, animals and robots alike. A body in the air, on the cable,
in the water or dead is in none of it. The numbers ([js/depth.js](../../js/depth.js)):

- **Walking: `DEEP_WALK` 0.7.** `wadeMul(e)` folds into a player's `walkMax` (so it stacks with
  a drawn bow, a cast and the rest) and into `unitMoveMul` for everything else. A player at 75
  px/s eases to 52 over about 0.4 s going in (the snow's overspeed decay spends the rest) and
  is back to full within a quarter second out.
- **Dodge: `DEEP_DODGE` 0.85 of the travel.** The roll's displacement is scaled, not its
  velocity, so what it hits for and what it carries out are the dash's own (61 px of roll
  becomes 52).
- **Sliding: friction x`DEEP_SLIDE` (2)** on a snow slide in it, and no slide *starts* with the
  wade past `DEEP_SLIDE_BAR` - you can slide in, and the drift eats it.
- The walk cycle runs up to 35% slower with the wade, and a wading body moving faster than
  12 px/s kicks up a puff at its feet every `DEEP_PUFF_T`.

A rush, the grapple's reel and the zipline own their velocity and ignore it. Bots do not route
around deep snow (`findPath` has no cost for it); they walk through it slower like anybody.

**The look** (`drawWading`, js/draw/depth.js, around each body in `render()`): a body in it is
drawn `WADE_SINK` rows lower and cut at the snow's surface, with a collar of drift round the cut
that shivers while it moves. The draw eases its own copy of the wade on the frame's clock,
because a client's sim never runs; none of the `wade*` fields cross the wire (`SNAP_SKIP`).

The player (momentum, tools, dodge), the entities that share the world, the gold economy, what
you can build, and the supporting subsystems. Read this before changing how an input resolves,
what something pays out, or what a structure does.

Everything below describes **a player**, not *the* player: each mechanic runs per player off
`p.input`, and `player` is only the local player. [multiplayer.md](multiplayer.md) covers the player
model, the input struct, teams, bots and how two players' orders are resolved.

> Several numbers below (ice cap, steer, slide threshold and fatigue, draw time and speed, arrow
> damage, dash speed, max hp) are **per class** — the constants are baselines the kits are
> written against and the sim reads them through `kitOf(p)`. See [Classes](multiplayer.md#classes).

## Momentum movement (players only)

A player moves on a real velocity (`p.vx/vy`): `p.input.mx/my` accelerates, and the surface
underfoot sets friction and speed caps. All the tuning constants live in the `players` banner of
[js/player.js](../../js/player.js) (`ICE_MAX`, `SLIDE_MIN`/`SLIDE_EXIT`, `TRAIL_MIN`, above
`CLASSES`, whose kits are written against them) and the per-surface rates inline in
`updatePlayer()`'s movement block, which every player runs. **Momentum is deliberately players-only**
— animals, robots, and knockback move directly (a direction times a speed through `moveEntity`).

**Facing** (`p.dir`, the sprite a body shows) only ever changes through `faceToward(p, dx, dy, hold)`
in the `facing` banner of js/player.js: the walk, a draw's aim, a raised shield, a work or mining
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
  carried speed is also what the roll **hits** for — see [The roll is a hit](#the-roll-is-a-hit).
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
  [Prone](#prone-under-the-snow).
- **Walls kill the blocked axis** (`blockedX` → `vx = 0`, same for y) in both the roll and
  normal movement, so you never grind along a treeline at full speed. A wall taken **head-on
  mid-roll** costs more than the axis: past `TACKLE_MIN` of speed driven into it, that is a
  [tackle](#the-roll-is-a-hit).
- Walk animation and footprints key off actual speed (`sp > 8`), not input; sliding and
  ice-gliding use the standing pose. `die(p)` and `Player.reset()` zero `vx/vy` and clear
  `sliding`. Footprints and slide trails from every player share the one `footprints` decal array.

### The zipline

The one movement that is neither walked nor slid: a body of the owning team standing under its
side's cable ([the zipline](world.md#the-zipline), `zipNear`) presses E and **clips on** —
`keyPress`/`pointerPress`/`ckRightPress` set `input.jump`, the edge-triggered hop intent the
eagle already reads, and `updatePlay` consumes it for every player alike as `zipToggle(p)`
(world.js): riding, it lets go; under a cable, `zipStart`. The ride is its own branch of
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
said. State on the body: `p.zip` (the line's team, −1 for none), `p.zipD` (px along),
`p.zipDir`, `p.lastMx/lastMy` — declared in `reset()` beside the grapple's, so a respawn never
comes back clipped on; `die` lets go too.

**The cable under the pointer.** `hoverZip()` (actions.js, beside `hoverFish`) is your own
side's cable under the pointer as drawn (`zipUnder`, world.js — within `ZIP_HOVER` of the
strand, never the invisible track under it), while the body is on the ground with nothing open
over it. While it holds, `drawZips` lights the whole line in the work-target rim's two golds on
its beat, and `drawZipGuide` (js/draw/zipline.js, right after the aim line) runs a static dotted
gold line from the feet to the nearest point of the track and a bar across it there — the walk
that puts the cap over your head — only while the body stands past `ZIP_GRAB` (32 px, two
tiles); inside it the cap is the whole answer. The click scheme's press asks the same
`zipUnder`, so what lights is what a press takes.

**The walk to the cable — a channel.** E (or the click scheme's right press) with the pointer on
your own cable but the body out of reach is the same hop intent, and `zipToggle` reads it off
`input.aimX/aimY` (`zipUnder` again — the aim rides the wire, so a host answers a client the
same): `zipWalkStart` sets `p.zipWalk` (declared in `reset()`, cleared by `die`) and the body
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
still a body to every weapon** — arrows, the roll's sweep, a turret, a wolf, `seenAt` — and plain
damage never dismounts (its knockback decays unspent, since the ride branch never applies
`kbx/kby`); a **stun, a root or a net** does, through `zipEnd(p, true)` inside `stunUnit`,
`rootUnit` and `netUnit`: dropped at rest on the snow under the cable. The one thing that cannot
touch a rider is another body: `separateUnits` skips `p.zip >= 0` the way it skips `inAir(p)`.

**Letting go keeps the cable's speed** — `zipEnd(p, false)` leaves `vx/vy` at 220 px/s for the
surface model to spend exactly as `grapEnd` leaves the reel's, so a hop-off is a dash (snow kills
it in under a second) and shift on landing carves a slide; a body coming down over a solid tile
(the odd pine or rock on the shoulder) is set beside it (`nearestDryTile`). Riders draw lifted
`ZIP_ALT` px with their shadow on the ground, the handle over the head and a rope up to the cable
(`drawZipHandle`, js/draw/zipline.js), in the standing pose; the bare key cap over the cable is
`drawZipHint` (js/ui/wheel.js). Bots ride it too, through the same hop intent, folded into every
walk the ladder orders ([bots](multiplayer.md#bots)); the waves never will.

## Trampled snow

Visual only (js/draw/trample.js). A grid of 4 px cells over the world holds how **packed** and how
**churned** each patch is. `trampleStep` looks at every body on the snow each frame the world moves
(players off the eagle and off a zipline, every animal but a bird, every robot) and stamps a disc
the size of the body every `TR_STEP` px it travels: a walk packs `TR_WALK`, a slide and a crawl
their own amounts (read off `p.sliding`/`p.prone`, the same state the footprint emitter reads), a
roll or a knockback past `TR_SHOVE_V` churns, and a drop in hp or a body going down churns a wider
disc. It reads only what a client already draws (positions, hp, `kbx`/`kby`), so it runs on every
peer and nothing goes over the wire; a jump of over 40 px (a landing, a respawn) stamps nothing
between.

Fresh snow refills every cell **linearly**, the way snowfall fills a hollow: `TR_FILL` a second at
light snow (`TR_SNOW_LIGHT`), scaled by `trampleSnowfall()`: the day's falling snow plus its ground
blizzard off `weatherNow()` (see [the day's weather](rendering.md#the-days-weather)), so a clear frost day refills at 0.3x and a snow day
or a blizzard at ~2.3x; churn refills `TR_FILL_CHURN` times faster. At light snow one pass (~0.1) is
gone in about ninety seconds and a hard-packed route (1.0) lasts a quarter of an hour of no traffic.

Each pixel asks what it stands on, the way the bake painted it (`trMask`): snow packs through three
pressed shades and throws clods where churned; **ice** is the lakes' dust layer's to
show: it reads `trampleAt(x, y)` per pixel and thins under it, and
`trDustSync` hands it (`iceDustInvalidate`) the lake tiles whose trample moved, so the dust comes
back as the trample refills - on a build without that layer, ice takes sparse frost scuffs instead; open water, the creek, its deck and the road's earth
take nothing. The footprints and slide trails draw over it as the crisp detail.

## Unit collisions

Players, animals and robots are solid circles to each other (`PLAYER_R` 4.5 — a merchant takes it
too — deer 5, rabbit 2.5, a camp monster its `MONSTER` row's `r`: the wolf 4.5, either bear 9;
everything else, worker bots and wave soldiers included, 3 — `unitRadius`). **Birds are the exception**: they fly, so `separateUnits()`
skips them entirely and they have no `UNIT_MASS` entry. Tile collision stays per-mover in
`moveEntity`; unit-vs-unit is a separate relaxation pass, `separateUnits(dt)` in the
`movement & collision` banner, that `updatePlay` runs once after every player, animal and robot
has stepped. For each overlapping pair it splits the overlap by inverse mass (`UNIT_MASS`:
player 3, merchant 3, deer 2.2, soldier 1, robot 0.7, rabbit 0.5; a camp monster's mass is its
`MONSTER` row — wolf 2, either bear 5 — read through `unitMass`; a player shoves a rabbit
aside and barely notices, two players split it evenly). Every
push goes through `moveEntity(…, strict)`, which treats open water as a wall even for players
(a shove never dunks anyone), and **any push a wall refuses is handed to the other unit** — the
player's share is tried first, so a small unit can never pin a player in a corner: the pinner
is the one that gets moved (a rabbit wedged between you and a rock squirts out sideways).
Two passes settle piles; the pass is deterministic (fixed order, no `rng`).

**Room.** Past the hard circle every body keeps a soft ring of personal space, `unitSpace` (its
radius x `UNIT_SPACE`, 1.6: a player's is 7.2, so two players settle 14.4 px apart side by side),
measured as an ellipse `UNIT_SPACE_TALL` (4/3) times taller than wide, because a body is drawn
standing up with its frame over its head (19.2 px one above the other). Before the hard passes,
`separateUnits(dt)` nudges each pair inside each other's rooms apart by `UNIT_ROOM_RATE` (8) of the
overlap per second, split by mass, through `moveEntity(…, strict)`. It moves position only, never
`vx/vy` or knockback, and peaks at 43 px/s between two players against a ~73 px/s walk, so anyone
walking, chasing or swinging still reaches contact; only a crowd that has stopped pushing spreads out.
A live roll skips the rooms entirely, and so does any pair of a camp beast and a body that is not one
(`hunt`, `isCampKind`): a beast bites from inside its `MONSTER` reach, and a bear's room (28.8 px above or
below) is wider than the 22 px it starts a blow inside, so a room would slide a standing target out of
every blow before it began. The hard passes run after the rooms and get the last word.

**A live dodge roll is the one exception to any of it.** `separateUnits` skips a pair outright
when one side is a player mid-roll and the other is *small* — every player, every robot, and
every animal but a deer and a bear (`MONSTER[kind].big`, asked through `isBigBeast`) — because the roll goes through
them and [swipes them](#the-roll-is-a-hit) instead of shoving them. A deer and a bear keep
their mass and their contact, which is what makes running into one a tackle rather than a pass.

**Right of way.** A body whose `MONSTER` row says `anchor` (both bears, asked through `isAnchored`)
outranks every other one (`pri` in `separateUnits`, `unitShare`). In a contact between ranks the
lower side takes the whole push in the room pass and the hard passes, loses its closing speed
(with the lighter side's bounce) and hands the higher side **no** knockback, so a player walking,
sliding or rolling into a bear stops against it while a bear walking into a player moves the player
aside. Only when a wall refuses the lower side does the higher take the remainder, so no one is ever
left inside a bear. Nothing else shoves it either: `updateAnimal` drops an anchored body's knockback
every step, so arrows, slams and stomps still hurt (and stun, where the ability stuns) but never move it.

Momentum: on the first pass a unit closing on the contact loses only its *share* of the
velocity component along the normal — tangential speed is untouched, so a slide into a deer
deflects along it and carries on rather than sticking — the rest of that component is handed to
the other unit as knockback (`kbx/kby`, the same channel arrows use), and the lighter side of
a contact gets a 0.3 bounce (`UNIT_BOUNCE`). Players carry `vx/vy`; animals and robots only carry
their knockback (their walk is a direction re-chosen each tick), and an idle animal/robot applies
its knockback too, so a shoved deer actually moves.

**Open water takes a player and nobody else.** A player walks into an ice hole or
[the creek](world.md#the-creek) and plunges; an animal or a robot meets a wall there. A **bot**'s
own walk is strict too (`moveEntity(…, strict)` in `updatePlayer`) unless it is already standing
in water or a shove past `WADE_SHOVE` (40 px/s of knockback) is carrying it, so a bot never wades
in by itself and still goes in off the bridge when it is knocked off.

## Pathfinding

Everything that walks to a goal on its own — robots, bots, hunting wolves and patrolling
ones, prey both fleeing and grazing, any future enemy — routes through the `pathfinding` banner
rather than steering straight at it.
`findPath(sx, sy, gx, gy, reach, budget, e)` is grid A* over the tile map: a tile is `walkable()`
when it is in-world, not `isSolidTile` for the walker `e` (its own side's gates stand open; `navTo`
passes the unit, `navLineClear`/`navSmooth` carry it on), and not open water (`waterAt`: an ice hole or the creek); eight-connected with no
corner cutting (a diagonal needs both orthogonal neighbours open, so a unit of radius ≤ 5 never
clips a tree walking centre to centre); octile heuristic; typed-array scores stamped by a
generation counter so nothing is cleared between searches; a binary heap; no `rng`, so it is
deterministic. `reach` is the Chebyshev distance at which the goal counts as reached — 1 lets a
unit path to a tree it cannot stand on (and is exactly `WORK_REACH` for a bot's swing). A search
that exhausts `NAV_BUDGET` (700 expansions, ~a 25-tile detour) returns the route to the closest
tile it saw with `path.partial = true`, so a far goal still gets a first leg and a later replan
finishes it; only an enclosed goal (or an unwalkable one with reach 0) returns `null`. A full
search is cheap enough that dozens of units replanning several times a second is noise.

Units do not call `findPath` directly. `navTo(e, gx, gy, r, reach, dt, budget)` (the last optional: a bigger
search budget for a walk into a corner's forest — the bots' `AI_ROOST_BUDGET`, ai.js) keeps a route on
`e.nav` (`{ path, i, gtx, gty, replanT, fail, stallT, … }`, created lazily on any entity) and
returns `{ dx, dy, d, ok }` — the unit direction to move this frame, the straight-line distance
to the goal (callers keep their own arrive radius), and `ok`. A plan first tries
`navLineClear()` (the same four-corner test `moveEntity` makes, every 4 px) and takes a direct
line when it is open, else A* plus `navSmooth()` string-pulling; it replans when the goal moves
more than a tile, every `NAV_REPLAN` (0.6 s), or — through `navStep()` — when `moveEntity`
reports a wall. **`ok = false` is the give-up signal**: the goal is unreachable, or the unit has
made no progress for `NAV_STALL` (1.6 s — pinned by other units, which routes ignore and
`separateUnits` resolves). There are no stuck timers anywhere else; a caller that gets `false`
drops the goal (robots and bots blacklist it for 12 s). A failed goal is not searched again until
`replanT` runs out. `navStep(e, gx, gy, r, spd, dt, reach)` wraps `navTo` with the
`moveEntity` call and `mvx/mvy` for the animal/robot movers; players (bots) take `navTo`'s
direction into `p.input` and move through their momentum. `navClear(e)` forgets a route.
`DBG.showPaths = true` draws every live route (`drawNavPaths`: bots gold, prey green, wolves
red, robots blue), and `DBG.findPath`/`DBG.walkable`/`DBG.navTo` are exposed for staging.

## Tools and bits

Everything in this section lives in **[js/tools.js](../../js/tools.js)**, under the `tools & bits`
banner. It loads after `actions.js` because a shot it fires is the arrow pipeline's, and its
top-level code registers one `ITEMS` row per kind — which is what makes the bag, the drop pickup,
the throw and the refusal flash work on tools and bits with no storage code of their own.

**There is ONE weapon slot** (`p.tools`, `TOOL_SLOTS` = 1 — the array and the drag plumbing stay
generic over it), and the left button fires it. Keys 1-4 belong to the
[class abilities](#class-abilities-keys-1-4). The slot holds a **tool**; a tool holds
**bits**; the bits are what actually fly. Both are found in the world or bought at
[the counter](#the-merchants-counter), and both are
carried items you can drag around — so the weapon is a thing a player assembles rather than a
thing they are issued.

### A tool

One entry in the `TOOLS` table (`shortbow`, `sling`, `longsword`, `recurve`, `hornbow`, `longbow`). A tool is a
**body** and carries no behaviour of its own — three numbers and a look (plus, on the one blade,
a `melee` block: [the cut](#the-cut-a-melee-tool)):

| field | means |
| --- | --- |
| `rof` | game steps between shots. `toolRof(p, cell)` turns it into seconds and scales it by `kit.nock / BOW_NOCK`, so every card that shortens `kit.nock` (QUICKDRAW, QUICK HANDS, FLETCHER'S TOUCH, RELENTLESS) quickens it |
| `cap` | how many bit cells it has (2–5) |
| `tensile` | **how much weight it draws at the normal speed**: a loaded weight past `DRAW_EASE` (half) of it lengthens the pull to full power ([the draw](#the-draw)). Nothing is ever cut: every loaded bit fires |
| `tier` / `art` | which of the three `TOOL_TIERS` palettes it wears, and which 12×12 silhouette (`bow`, `sling`, `sword`, `recurve`) |
| `up` | the second stat [the forge](#the-forge) raises beside damage: `rof` (SHORTBOW, RECURVE, LONGBOW) or `tensile` (SLING, LONGSWORD, HORN BOW) |

`cap` and `tensile` are the two halves of a tool: **cap is how much you may hang on it, tensile
how much of that it pulls easily.** The tiers grow the two together at roughly four weight a
cell — SHORTBOW 9/2, SLING 10/2, LONGSWORD 10/2, RECURVE 13/3, HORN BOW 15/4, LONGBOW 22/5 — so a
heavy build on a light body is never refused or cut short, it is only *slower to pull*.

A tool is **instanced**: its bag cell *is* the tool, `bits` array and all (`makeTool`), so it is
moved between bag, slot and drop rather than rebuilt from its type name — see the hard rule in
[CLAUDE.md](../../CLAUDE.md#hard-rules). `spawnDrop`'s `it` payload is the same object the bag had,
and `bagPut` puts that same object back, so nothing about a build is ever reconstructed.

The one exception is a tool that lands in the snow, which arrives bare:
[a discarded weapon sheds its build](#a-discarded-weapon-sheds-its-build).

### A bit

One entry in the `BITS` table, and there are two kinds of them, told apart by `proj`.

**Every bit has a `weight`**, projectile and modifier alike. The weights add up to the tool's
load (`toolLoad`), and a load heavy for the body's tensile makes the pull to full power longer
([the draw](#the-draw)). A heavy bit costs time, never a shot.

A **projectile bit** is one shot: `path` (how it flies), `solid` (whether a wall stops it), `ff`
(whether it will hurt your own side), `kb`
([knockback](#knockback-one-number-thrown-at-three-weights)), and
`life`/`speed`/`dmg` as baselines. Optional `lit` is a light radius it carries in
flight; optional `reach` widens every hit test past the tip (a bit with a *body* — the fist, the
axe); optional `body` names the silhouette the shots pass draws it as (`BIT_BODY`, js/draw/render.js);
optional `impact` names what it does where it *lands* (`BIT_IMPACT`, js/tools.js); and
`bot: false` marks a kind no bot will load. A spent shot is simply gone — nothing lands to be
picked back up.

#### Knockback: one number thrown at three weights

`kb` is a **multiplier**, not a speed, and 1 is the ordinary shove. It has to be, because the
three kinds of unit are already pushed at three different weights — a player at `HIT_KB` (110 px/s,
js/player.js), a worker at `ROBOT_KB` (40, js/robots.js), an animal on a curve off the draw
(25–70) — and one number written on a bit has to mean the same thing thrown at any of them. It
rides to `hurtUnit` as `o.kbMul`, which scales whatever shove that kind takes; `o.kb` beside it
is still the absolute px/s an *ability* picks for a particular blow. A shot with no `kb` at all
(a turret's rock, whose thump names none either) takes the ordinary shove, ×1.

The spread across the table is the point of the number: a WISP barely nudges (×0.3), an ARROW is
the baseline (×1), an ICE LANCE staggers (×1.6), a THROWING LOG flattens (×2.4) and a BIG FIST
throws a body across the snow (×4). The tooltip prints it as `x4`, the one bit row that is a
multiple rather than a quantity.

A **modifier bit** (`proj: false`) never flies, but it costs weight like anything else. Its
`mod(m)` edits the shot envelope — `spdMul`, `dmgMul`, `dmgAdd`, `lifeMul`, `fan` (one shot
becomes N in a spread), `dup` (the whole fan fired again), `lit`, and the fire quartet below.

Two rules govern it, and both are load-bearing:

- **It applies to every shot.** Where a modifier sits means nothing: it changes every projectile
  the tool fires, the built-in arrow included when nothing else is loaded. There is no wrong place
  to put one and no way to waste one. The shelf draws that reach as a **line** from the fitting
  into each shot ([the shelf](#the-weapon-shelf)).
- **It compounds with whatever is already there.** Every `mod` composes with the value it is
  handed — `*=` a multiplier, `+=` a quantity — and must never `=` or `Math.max` it. Two SPEEDUPs are
  four times the speed, two SPLITTERs nine shots, two FLAMEs twice as long at twice the rate
  (which is exactly a PYRE). **Every modifier added from here follows that rule**; the only field
  that is set rather than composed is `m.type`, because a damage type is a category and not a
  magnitude.

Eight exist: SPEEDUP, SPLITTER, DUPLICATE, HEFT, LONGSHOT, and the three that carry fire.

#### Fire on a shot

`m.type` is the shot's **damage type** (`DMG_TYPES`, js/actions.js — `blunt` unless a modifier says
otherwise), and `m.burn` / `m.burnDps` are the fire it leaves in the body it hits. The shot carries
all four onto the arrow, and every hit branch in the arrow loop hands them to `hurtUnit` — so a
flaming shot burns a rival, a deer, a bird and a worker bot identically, with no per-kind code.
What a burn then does is [status effects](#status-effects-one-set-for-every-unit).

| bit | tier | what it writes |
| --- | --- | --- |
| **FLAME** | KEEN, under SPEEDUP | `type: 'fire'`, `BURN_T` 3 s at `BURN_DPS` 6, `dmgAdd += 2`, `lit` 30. The flat bonus is small on purpose: the burn is where the damage went |
| **PYRE** | GILDED, under FLAME | the same fire, `PYRE_T` 6 s at `PYRE_DPS` 12 — twice as long and twice as hot |
| **CINDER BURST** | GILDED, under DUPLICATE | plain fire, plus `m.cinder` — a `CINDER_R` (26 px) ring lit where the shot **ends**, hit or miss. The multiplying lineage's finish: SPLITTER multiplies one bit's arms, DUPLICATE fires the fan again, CINDER multiplies the impact |

A tool holding only modifiers fires nothing, the same as one whose very first cell is already
heavier than the body can swing.

#### The closing line: three bits that are not archery

BIG FIST → BIG AXE → TELEPORT REQUEST is a lineage about *arriving* rather than about shooting,
and all three are deliberately hostile to range.

| bit | tier | what it is |
| --- | --- | --- |
| **BIG FIST** | WORN | a punch: `FIST_T` (0.2 s) of flight at 300 px/s — about a body length — 16 damage and `kb` ×4. The short life is the whole trick: it is gone before it reads as a projectile, so the left button looks like a melee swing. `reach` 5 gives it a body rather than a tip |
| **BIG AXE** | KEEN | the same brief flight on the `curve` path, 20 damage, `kb` ×2, `reach` 6 — and `impact: 'chop'`, which is what makes it more than a heavy fist |
| **TELEPORT REQUEST** | GILDED | 620 px/s and 6 damage, a body that is not a shape at all, and `impact: 'warp'` |

All three carry `bot: false`: a bot has no pointer and cannot read a weapon whose point is
*where you end up standing*, the same refusal that already keeps boomerangs and orbits out of
its hands.

**What a bit does where it lands** is one row in `BIT_IMPACT` (js/tools.js), called from the arrow
update only when the shot ended **on** something (`a.struck` — a wall, a tree, a body, the roost,
a dummy, a target face) rather than merely running out of life over open snow. That distinction
is the teleport's whole rule: a request that hits nothing takes you nowhere.

- **`warp`** — the shooter is standing where the shot stopped, rewound `WARP_BACK` (0.02 s) of
  flight so it lands *short* of what it hit. The spot is pulled onto a tile a body can stand on
  (`nearestDryTile`), so a request buried in a treeline puts you beside the tree rather than
  inside it; the jump rises you out of the snow and drops the fish hoist, the way any hit does.
  The tell is `warps` — the character stamped as a flat violet silhouette every `WARP_STEP` (11
  px) of the line crossed, up to `WARP_MAX` (14) of them, fading together over `WARP_FLASH_T`
  (0.34 s) and **never at the arrival**, because the body is already standing there
  (`drawWarps`, js/draw/render.js; aged in `updateFx`). Without the trail a teleport reads as a body
  blinking out of existence rather than as a path.
- **`chop`** — one chop into every tree within `AXE_CHOP_R` (26 px) of where the head stopped,
  the struck tile included. It is the same blow an E swing lands (`chopTree`, js/actions.js —
  gold, stump, fell payout, loot roll and the rare pine's jackpot), routed through `contest()`
  on the same `work:` key, so an axe and a swing on one tile in one step are one chop. Three
  throws fell a pine, and they fell its neighbours with it.

### Firing

**One press is the whole tool, resolved in one frame.** Nothing cycles between presses and
nothing is left behind: every loaded shot leaves together, each wearing every loaded modifier.

`fireTool(p)` is the one entry point — the falling edge of `input.fire`, for every player alike:

1. Read the cover first (`ambushReady`), before anything below can break it.
2. No tool on the selected slot → `dryFire(p)` and stop. (A fish underfoot never takes the
   press — the catch is `autoFish`'s, [the swing tools](#the-swing-tools-e).)
3. `toolPlan(cell)` — the one function the whole weapon runs on, below.
4. A blade hands the plan to `slashTool`
   ([the cut](#the-cut-a-melee-tool)) and anything else runs `emitBit` for each shot plus one
   `sfxAt('arrow', …)`; then `p.nockT = toolRof(p, cell)` ([the cycle](#the-cycle)) and
   `risePlayer` (the shot is what breaks cover).

#### `toolPlan`: one activation, in one pass

`toolPlan(cell)` walks the cells once and returns `{ shots, load, tensile, spent }`
(`spent` is every loaded cell — what `fireTool` flashes on the shelf). It is
the *only* place the arithmetic lives, and the press, the [aim line](#the-draw) and the
[shelf](rendering.md#the-weapon-shelf) all read it — so the three can never disagree about what
the button is about to do.

- **Order means nothing.** Every modifier folds into one envelope, and every projectile is
  pushed onto `shots` with a copy of the whole of it (`mods` lists the modifier cells that power
  it, which is what the shelf's lines draw). A SPLITTER beside two ARROWs fans both.
- Every loaded cell's weight is added to `load`, which only slows [the draw](#the-draw).
- **No shot loaded still fires.** A tool with only modifiers, or with nothing, fires the built-in
  `TOOL_BASE_SHOT` (a plain ARROW, `i` -1, `base`) wearing whatever modifiers are there. It takes
  no cell, cannot be dropped or sold, and steps aside the moment a real shot is loaded.

`peekBit(cell)` is `shots[0].id` — the lead shot, what the aim line is drawn for.
`toolLoad(cell)` is the row's weight.

The cells keep themselves in order: `sortBits(cell)` puts projectiles on the left, modifiers on
the right and empty cells between, and `bitPut` runs it on every placement, so the row a player
sees is always shots then fittings however the bits went in.

`emitBit` is where the player is folded back in: the bit's own damage leads, the class kit's
`dmgBase`/`dmgPow`, the kit's speed bonus (`spdDmg`) and the hero level add to it, **the draw
scales the whole sum** (`drawDmgMul`, [The draw](#the-draw)) and then the modifiers scale that —
so gear, cards and levels all still matter to a weapon they know nothing about, and a spammed
level-twelve bow is still a weak one. Speed and life come from `shotFlight(b, m, pw)`, the same
envelope the aim line measures. The shot goes into the `arrows` array carrying
`path`, `solid`, `ff`, `kb`, `reach`, `body`, `impact`, `type`, `burn`, `burnDps`, `cinder`,
`lit` and `col` beside its position, velocity, damage, owner and team.

`toolReady(p)` is the only refusal besides the cycle: an empty weapon slot is dry, and
`updatePlayer` refuses the draw on it (`dryFire`, the slack-string tell). A tool in hand always
fires.

Every bit a press fires leaves in the **same frame**, so no two of them may be stacked inside
one another: each bit past the first is nudged `SHOT_SKEW` (0.05 rad) off the aim, alternating
sides, and a DUPLICATE's repeats `DUP_SKEW` (0.07) — per *bit* and per *repeat*, never per arm of
a SPLITTER's fan, which already spreads its own arms `FAN_SPREAD` (0.16) apart. Where arm *k* of
repeat *d* leaves is `armOff(m, k, d)`, and the piercing shot lays its volley out through it too.

### The cut: a melee tool

The LONGSWORD is the one body with a `melee` block in `TOOLS` (`reach` 28 px of blade at full
draw, `half` 1.05 rad of sweep either side of the aim), and that block is the whole difference:
`fireTool` runs the same press, the same `toolPlan` and the same cycle, and then hands the plan to
`slashTool` instead of `emitBit`. **The draw is still the throttle** — a tap reaches
`SLASH_REACH_MIN` (60 %) of the blade for `DRAW_DMG_MIN` of the damage, a full draw the whole
blade at its whole worth (`slashReach`) — and **every bit in the plan is one cut of the same
swing**: its damage through `emitBit`'s own sum (bit, kit, level, the draw's multiplier, the
modifiers' `dmgMul`/`dmgAdd`, the ambush), its modifiers' damage type and fire on every body the
edge reaches. What the edge reaches is the **wedge** — `inCone`/`unitsInCone`/`structsInCone`
(js/actions.js): a body counts by its centre plus its own radius, a building by any tile of its
footprint — and nothing else: a body behind the caster is never cut. A bit whose whole point is its
flight (a boomerang, a lob, an orbit) swings as a plain cut worth its damage; the sword is a place
the fittings you found can still go, not a second arsenal. Each cut leaves its wedge on the snow
(`slashes`, `SLASH_T` 0.28 s, ticked by `updateSlashes` from `updatePlay`) — the outline in white,
gold when it landed, with a bright edge sweeping across it — drawn by `drawSlashes` (js/abilities.js,
called from js/draw/render.js beside the E swing arcs), and the local player's draw grows the same wedge
in place of the aim line (`drawAimLine`), so the reach the cut is about to have is on the ground
before it lands. **The hand swings the sword itself**: the blade is drawn at its real 22 px length
(`TOOL_HELD_ART`, baked as `toolHeld_<art>_<tier>` beside the 12 px bag icon, and used wherever the
hand holds a tool that has one), a draw winds it back to the start of its arc, and for `SLASH_T`
after the loose (`p.slashT`/`slashA`/`slashHalf`, counted down in `updatePlayer`) `drawHeldTool`
sweeps it across the wedge pivoting at the hands, two ghosts of it trailing, in front of the body
whichever way it faces. A bot with a blade fights at `AI_MELEE_D` (18 px) instead of a bow's 70, and
only presses fire once the target is under the edge (`aiMelee`, js/ai.js).

### Flight paths

`steerBit(a, dt)` runs once per shot per sim step **before** the step is integrated, so the path
owns the velocity and the trail, the hit tests and the drawn body just follow it. A turret's rock
rides `sling`.

| `path` | what it does |
| --- | --- |
| `line` | nothing — a straight shot, and it costs nothing |
| `lob` | drag on both axes plus `LOB_FALL` gravity: a heavy throw that arcs down and lands |
| `boomer` | out on the bearing bleeding down to `BOOM_SLOW`, then one continuous curve home — see below |
| `orbit` | a ring of `ORBIT_R` around the shooter, eased out over the first 0.25 s and swept at its own speed |
| `curve` | the bearing sweeps one way at `CURVE_TURN` (3.4 rad/s): a scythe, the way a thrown axe goes |

**The boomerang is the one path that has to CLOSE**, so it is the one with a controller rather
than a formula. Past `BOOM_OUT` of its life it **banks**: the bearing is turned the short way
toward the thrower a little each step instead of snapped onto them, so the velocity never jumps
and the shot carves a teardrop, coming home along the outside of its own path. Every number is a
*fraction of the flight* rather than a count of seconds — the half turn is allowed `BOOM_SWING`
of the life whatever that life is — which is what keeps the shape identical at every draw, from a
tap's quarter-second loop to a LONGSHOT's three-second sweep; and because the turn is a rate and
the speed is a speed, the arc widens on its own for a fast shot and tightens for a slow one.

Three rules make it *always* come home rather than usually:

- the return **builds speed back up to full**, and is floored at whatever pace closes the gap by
  `BOOM_SPARE` of the life — a **fixed** deadline, not a rolling one, or the target recedes as
  fast as the shot chases it and the loop lands on the last frame every time. That floor is only
  spent once the shot is roughly *pointed* home (`BOOM_ALIGN`), since speed spent mid-turn only
  widens the arc it has to fly back out of, and it is capped at `BOOM_RUSH` so a sprinting owner
  is chased rather than snapped to.
- the swing **tightens as the hand nears** (`BOOM_BITE`): a circle of radius *r* cannot curve
  into anything closer than *r*, so a turn wide enough to read well at range is an orbit around
  the thrower at ten px. At range that term is nothing and `BOOM_SWING` owns the shape; on the
  doorstep it is the whole of the guidance, and it is what makes the loop close.
- it ends at the hand (`BOOM_HOME_R`, or the step just taken, whichever is wider — a fast shot in
  a long frame must not stride straight over the hand) **or at the end of its life**, whichever
  comes first. The life cap is unconditional, so a boomerang never trails a walking owner around
  the map even in the one geometry it cannot solve (thrown in the direction you are sprinting).

Three per-bit rules land in the arrow update (`updatePlay`, and the sweep it asks, `shotContacts`):
`a.solid !== false` gates the tile test (that is the whole of "never hits ground"), `a.ff` lifts the team check on players and worker
bots (never on the shooter, at any weight), and `a.cinder` lights a ring around wherever the shot
ended. **That solid-tile branch is also the one place a shot sieges**: when the tile that stopped
it is a rival's building (`structFoe(sideOf(a), structOf(objAt(…)))`) the shot's damage goes
through `hurtStruct`, `STRUCT_DR` (60 %) off like any player blow — so a bit that passes walls
(`solid: false`) pays for that with its siege, and needs no second flag. A burning shot trails fire instead of team colour, burns on its head in flight ([the draw](#the-draw)) and bursts embers where it lands.

**A shot meets everything its step crossed, then one blow.** A step is a *segment*, never a point:
`shotContacts` (js/sim.js, `the shot's sweep`) lists what the segment met in the order it met
it — the tiles it entered (a grid DDA) up to the first that ends it (a rival roost, the practice
dummy, a solid tile), every **standing building by the shape it is drawn in** — `structShotBox`,
the box its sprite's opaque pixels cover where the draw lays it (`structArtOff`, so the bay's roof
6 px over its footprint and the turret's timber base up to 2 px past each side — the tier-3
plinth; tier 1 sits inside its tile — stop a shot), plus a
turret's head as a disc of the entry's `head` (6 px) round `turretPivot`, the sling's arms past it
sticks a shot flies by; a site still going up is its footprint alone — a target face, and every
body whose hit disc it crossed (`sweepDisc`, and `sweepBox` for the building's box): the
`ARROW_HIT_R` (10 px) disc at a player's chest, `ROBOT_HIT_R` (7) about `robotHitY` for a chassis,
`animalHitR` about `animalHitY` for a body that may be up on its own altitude, each widened by the
bit's `reach`. So speed never skips a hit — three SPEEDUPs throw a shot 43 px a step, wider than a
rabbit and wider than a wall tile, and it still stops on the rabbit in front of the wall and never
on the one behind it. The step's bounding box turns nearly every body away before the sweep is
asked, so a body costs a shot a few comparisons. The tile a step starts in was asked by the step
before; a shot's **first** step asks its spawn tile only if it is heading into it (still inside
`TILE`/2 on), so a bow overhanging the tree its body hugs shoots out over the edge and never
through the trunk. The arrow loop takes the contacts in order — a raised tower shield first, on a
player — and every body goes through the same local `blow()`, which hands the bit's damage, type,
fire and shove to `hurtUnit`. A shot that ends on something is clipped to the point it met it, so
its burst, its embers, a cinder ring and an impact (the teleport's arrival) land there. Nothing
about *what a shot does* is written per kind, which is what keeps the left button honest across
the whole roster.

### The weapon shelf

**The build is on screen at all times, top-left** — the tool in a bigger well at the left end of
a row, then its bit cells: **shots on the left, fittings on the right**, empty cells between
(`sortBits`). The order is kept for the player and means nothing to the press. It is the whole of what the HUD says
about the arsenal — one tool, read in one place; the bottom strip has no weapon well — with the
[inventory drawer](rendering.md#the-backpack) shut under it.

It stands on the same plate as the rest of the HUD, which swallows a click anywhere on it
(`shelfPlateHit`). It is pinned by its TOP to the
corner and grows rightward — a bigger tool grows the row rather than moving the tool cell it is
read from. The geometry is `shelfCellRect(i)` (cell **-1 is the tool**), the pointer
`shelfHit` (`{kind:'tool'}` / `{kind:'bit', i}` / null), and the draw `drawShelf` — all in
js/ui/hud-draw.js and js/ui/strip.js, scaled about the top-left corner at the strip's HUD SIZE
([rendering.md](rendering.md#the-hud-strip)).

Two marks and no words, [drawn](rendering.md#the-weapon-shelf) rather than labelled: a box's
**rim colour** is its rarity (and a hatched ground is a fitting), and one **line** per fitting runs
over the row from it into every shot it powers (the tool well itself when the built-in arrow is
the shot). And two events on the one flash (`bitLit`/`bitLitAt`/`bitLitCol`,
js/tools.js, aged in `updateFx`): every cell the last press SPENT flashes white and fades over
`BIT_LIT_T` (0.3 s), its lines with it, so the left button teaches the row it is firing — and a
[tool swap](#where-tools-and-bits-come-from) lights the **whole** row, the tool well included, in
the new tier's ink for `SWAP_T` (1.1 s).

The drag is one mechanism shared by the grid, the weapon slot and the shelf
(the drag banners of [js/ui/strip.js](../../js/ui/strip.js), `state.drag`): a press **arms** a pick-up and only travel past
`DRAG_SLOP` promotes it, so a tap on a berry still eats it
while a drag off either one picks it up. A release over any well that will take it puts it there;
over the rest of the HUD it goes home; **over the world it is thrown**, which is the only way to
get rid of a tool.

**A throw goes where it was aimed, and stays thrown.** `throwCell` sends the item off the body
along the **cursor's heading** at `TOSS_SPEED` (130 px/s — the facing stands in when the pointer
is on the body), rather than tipping it out at the feet, so "put this over there" is a gesture and
not a wish; and for `TOSS_LOCK_T` (3 s) the drop is **deaf to the hand that threw it**
(`lockDrop`/`dropLocked`, js/core.js — the drop carries one player id), because the pickup magnet
would otherwise reel straight back in what was just dragged out. The lock is one player's:
everybody else may take it the instant it lands, which is what makes a hand-off across a fight
work. A thrown **tool** sheds its bits on the way ([above](#a-discarded-weapon-sheds-its-build)),
and they carry the same heading and the same lock.

**A drop onto a loaded well SWAPS.** Whatever the drop displaces goes back to *home* — the well
this drag started from (`dragHome`) — because home is the one place already known to be free: it
is where the thing in hand came out of. So a bit dragged from the pack onto a loaded bit cell
trades places with the bit that was there, a tool dropped on the weapon well sends the old one to
the bag cell it came out of, and a bit dragged out of the column onto a bit in the grid does the
same in reverse: one move each way, the same swap `sendBagCell`'s click makes. Home can be gone
by the time it is asked — a stack that did not empty is still
sitting in it, an earlier swap in the same gesture filled it, or it cannot hold that kind at all
(a berry does not go in a bit cell, a bit does not go on the weapon key) — and then the displaced
item rides the cursor, which is free, because what was on it is what just went into the well.

**A plain click is the whole move**, because every one of these wells has exactly one sensible
destination (`sendBagCell` / `sendBitCell` / `sendSlot`): a **bit** in the grid loads into the
weapon where it works (`fitBit`, [below](#where-tools-and-bits-come-from)), a **bit** in the column comes back to the pack (merging its own stack,
`bagAdd`), a **tool** in the grid trades places with the weapon in hand, and the **weapon well**
stows what it holds in the pack the way a bit does. It is the backpack's own grammar — clicking a
cell *uses* what is in it, a berry by eating it and a card by drawing from it.

**Every press in this widget ARMS; the release is what resolves it** — `hudPress` writes
`state.dragPend` and nothing else, `hudRelease` acts, for a pick-up (a press that travels past
`DRAG_SLOP`) and for putting a carried item down alike. **Never resolve a put-down on the press**:
a drop onto a loaded well swaps, a swap whose displaced item cannot go home puts that item back
on the cursor, and the mouseup would then run the same `dragDrop` at the same pixel — one click,
two swaps. The item lands where the button came *up*, and a press can be called off by moving
away before letting go. Each helper returns whether it *handled* the click, so a berry, a card and an empty
cell fall through to their ordinary click. Nothing can be destroyed: when the destination
has no room the item does not move at all, and the container that is full is the one that
refuses — the pack through `bagDenied()`, the weapon through its twin `toolDenied()`, which bands
the weapon well in the same red for the same 0.6 s.

### What a gesture answers with

**Every move of an item answers in three places at once** — the ear, the hand and the well it
landed in — and one function raises all three (`hudFx(kind, k, i, slot)`, the `what a gesture
answers with` banner, js/ui/bag.js) — so a new well or a new gesture calls `hudFx`, never a bare
`SFX`, and cannot end up with two of the three.

Five kinds, and they are a language rather than a volume: **`grab`** lifting something onto the
cursor, **`place`** setting it into an empty well, **`seat`** the weapon well's heavier version of
that, **`swap`** an exchange, and **`deny`** a refusal. The swap is the loudest of them on purpose
— it is the one move that hands you something *back* — so it gets a cue of its own (`SFX.swap`,
two notes crossing, told from `stash`'s rising pair by ear alone), the hardest rumble, and the
only pulse on the cursor itself.

- the **ear**: the cue above.
- the **hand**: `haptic(kind)` ([the two controllers](multiplayer.md#the-two-controllers)) —
  a pad rumbles, a mouse cannot.
- the **eye**: the well pulses for `WELL_LIT_T` (0.3 s) in the colour of what happened
  (`wellLit`/`drawWellLit`), and on a swap the carried ghost flares gold and grows a ring for
  `DRAG_LIT_T` (0.36 s) — so the hand visibly changes contents rather than quietly doing it. Both
  age in `updateFx` beside the refusal reds.

**And the well says what will happen before it happens.** While something rides the cursor, the
well under the pointer wears a **ring** in one of four colours — blue *drops it in*, green *tops
the stack up*, gold *trades with what is there*, red *refuses* — from `dropKindBag` /
`dropKindSlot` / `dropKindBit`, which read the same branches the three `dragDrop*` functions take,
so the promise and the move can never disagree — a bit held over the weapon **key** reddens
*before* the release. The ring is drawn last of all (`drawDropPromise`, after `drawDragGhost`) and outside the
well's own footprint, because the thing asking the question is an 18 px ghost sitting on an 18 px
cell — a rim inside the well is a rim nobody ever sees. The hover tooltip names what the click will
do where the item actually sits (`tipSend`), which is why a tool reads TAKE IT IN HAND in the
grid and STOW IT IN THE PACK in the well.

**Shift SENDS**, in both hands. With an **empty** one it is the plain click's own transfer above,
nothing more. With something already riding the cursor, a
plain press puts the item down where it lands, while a press begun with shift held is remembered
on `state.dragPend` (`keep`) and its release runs `sendAt(mx, my)` instead — the same wells
`dragDrop` tries, in the same order, but acting on what is already *sitting* there and leaving
what is in hand in hand. Over anything else — the bare frame, an empty cell, the rest of the HUD —
it does nothing at all, because that promise is the whole point. Recording the modifier at the
press rather than reading it at the release is deliberate: letting go of shift mid-click cannot
change what the gesture turns out to be.

The pack advertises the gesture rather than expecting you to know it: `drawShiftHint` floats a
**SHIFT key cap** (the world prompts' own `drawKeyPrompt`, the keybind-indicator carve-out of
the [UI rule](rendering.md#show-dont-label)) over the pack's top-right corner whenever the pointer is
on a well with somewhere to send what it holds, and the verb on it is that **destination** —
`LOAD` for a bit in the grid, `STOW` for a bit on the shelf or the tool on the weapon,
`HOLD` for a tool in the grid — so the plate teaches which way the transfer goes rather than
merely announcing a key. `shiftVerb` asks the same wells in the same order `sendAt` does, so the
plate and the click can never disagree; a berry and a card get none, because eating and drawing
are not transfers. The cap presses down while the key is actually held.

### Where tools and bits come from

`dropLoot(x, y, tier, chance)` rolls one find on the shared `rng` at the moment a swing lands
(never inside `genWorld` — see the seed rule). `LOOT_TOOL` (0.3) of any find is a tool, the rest a
bit, and only kinds at or under the given tier are in the pool.

| source | chance | tier |
| --- | --- | --- |
| a mined rock | its kind's `loot`: STONE 0.2, FROSTGLASS 0.5, SUNSTONE 1 | its `lootTier`: 0 / 1 / 2 |
| a felled tree | `TREE_DROP` 0.04 | 0 |
| a sprung chest | `CHEST_TOOL` 0.75 | up to 2 |

**The tier is a ceiling, not a floor.** The kind is picked evenly from everything at or under it
(`LOOT_POOL`, [the wiki](#the-wiki)), so a roll at tier 2 mostly turns up tier-0 and tier-1 kinds,
and the top tier is the smaller share of what it can give. A SUNSTONE and a chest roll that same
pool, and the rock always rolls where the chest rolls `CHEST_TOOL` of the time, so **a SUNSTONE
turns up a top-tier kind more often than a chest does** — and grows back
([Mining a rock](#mining-a-rock)), where a chest is gone for the match. What only a chest pays is
its card ([Roguelike cards](#roguelike-cards)). The [counter](#the-merchants-counter) sells every
tier beside all of them.

**A found bit arms itself.** The pack is the overflow, not the destination: a bit walked over
(or bought over the counter) goes into a free cell of the tool, and only what the tool cannot
hold lands in the grid. **Anywhere it lands, it works** (`fitBit`): it takes a free cell and
`sortBits` seats it on its own side — a shot at the end of the shots, a fitting at the front of
the fittings — and since every fitting powers every shot, a find is never wasted — `fitAdd(p, type, n)`, with `fitRoom(p, type)` the room it counts, which
is why a FULL pack with an empty bit cell still magnetises a drop and still claims it. The drop
pickup (js/sim.js) and `shopBuy` (js/ui/shop.js) both go through the pair, so the ordinary way to
arm a find is to walk over it, and the drag is what you reach for to ARRANGE a build rather than
what you must do to have one — which is half of why the [shelf](#the-weapon-shelf) is on screen
at all times: a bit that loaded itself has to be seen loading itself. It fills a free cell
whatever the load (a heavy build only pulls slower, and one click sends a bit back to the pack),
and a **bot is left out** — `botFitLoadout` does this for them on its own timer and is choosier
about it, so a pickup that shoved a bit into a bot's tool would only make it a worse shot.

So the bottom tier lies around loose in the stone and the pines, the middle tier in the frostglass,
and the top tier in the sunstone and the chests. A found tool comes out **empty** — its bits are the next thing to find.

**And a strictly better body takes the build with it.** A tool walked over swaps itself straight
into the hand when two things are true at once: its **tier is higher** than the one held, and its
`cap` is **at least as big**, so nothing already loaded is left with nowhere to sit
(`toolUpgrade`). Then `takeUpgrade` moves the bits across and `sortBits` lays them out again,
shots left and fittings right, the new open cells between them — and the old body is treated exactly as the find was a moment earlier: into the pack, or
into the snow it was lying in if the pack is full. That last part is why a **full pack is still
room** for an upgrade (`roomFor`, the drop loop): the pickup is an exchange, not an addition.

It runs for **every** player, bot included, off the same two functions, and it is the one thing in
the game that rearms somebody with no hand on the weapon — which is why it carries a tell of its
own, drawn rather than announced: a ring in the new tier's colour opens out of the body and the
new tool's own icon rises out of it (`swapFx` → [`drawSwaps`](rendering.md#the-tool-swap)), for
everyone on screen, while the local player's whole [shelf](#the-weapon-shelf) row flashes in that
same tier ink. Nothing is refused and nothing is lost: a same-tier find, or a higher-tier body
with fewer cells than the build needs, is an ordinary pickup into the pack.

### A discarded weapon sheds its build

The counterweight to the pack being the overflow: **a tool that lands in the snow arrives bare.**
`shedBits(cell, x, y, hx, hy, p)` (js/tools.js) empties the row as the tool goes down, spawning
every loaded bit as its own drop flung along `hx`/`hy` — whatever threw the tool — plus a
`SHED_KICK` of its own, so what lies there is a body in a scatter of fittings. The one ground-drop
path calls it: the [drag out onto the world](#the-weapon-shelf) (`throwCell`, js/ui/bag.js). A
death puts nothing down ([Death and respawn](#death-and-respawn) — the body keeps its build), so
the throw is the only caller; **any new ground-drop path for a tool must call `shedBits` first**,
or a thrown tool becomes the way to hand over a whole build in one gesture. Emptying the instance
at that one moment is not the rebuilding-from-type the [hard rule](../../CLAUDE.md#hard-rules)
forbids.

The pool a roll draws from is the whole table at or under that tier — `LOOT_POOL`,
[the wiki](#the-wiki).

### Tiers, and how a find reads

`TOOL_TIERS` is a colour and nothing else in the sim: what a tier buys you is written into each
tool's own numbers. The three read worse to better as **dim green, bright blue, bright gold**
(WORN, KEEN, GILDED). The tier is stated in **one** place and the same way everywhere — the 1px
rim round a dark plate, in every well the item ever sits in (bag cell, weapon slot, bit cell, drag
ghost, loadout card) — which is why nothing on screen has to say "TIER 2". `tierPlate(type)` is
that lookup and `itemTier(type)` the raw index. Nothing shines or moves.

**Which of the two kinds of bit it is is stated on that same plate**, by `modPlate` (js/ui/hud-draw.js),
called wherever a bit sits — the grid, the column, the cursor, the counter's wells, a tech node,
the tooltip's own icon plate. A **projectile** keeps the flat square plate every carried item
wears: it is a thing you fire. A **modifier** gets its plate hatched, inset 2px so the rim stays
one clean line, in its rarity's colour — it never flies, it is fitted *into* the tool — so the two
are told apart across a whole grid without recognising a single glyph. Colour is already spent on
tier, which is why the difference has to be texture. Weight has no mark on a cell; it shows as the
length of the draw. The 8×8 glyph (`BIT_ART`, js/tools.js)
then says what the bit *does*, in the same two grammars: a **shot** is drawn as the thing that
flies, tip to the upper right like every other shot icon (the arrow; the barbed shaft; the
return loop of the hookshot; the gold arrow with a light for a head; the comet wisp; the cut
log; the icicle; the fist thrown with speed lines; the axe; the portal and the dotted line to
it), and a **fitting** as what it does to the shots, never a lone shaft (fast-forward
chevrons; one shaft coming apart into three tips; the same arrow
twice; a dumbbell; a head at the end of a long dashed flight; a flame, a banked fire on logs, an
impact throwing embers). On the ground a find glints in its tier's colour so it is
told from a berry at a distance. A tool's **shape** says which weapon it is and its **palette**
says its tier: six 12×12 silhouettes (`TOOL_ART`: bow, recurve, horn, long, sword, sling — one a
tool, every bow its own: the short plain D, the recurve's forward-flicked tips, the horn bow's
swept-back ears either side of a set-back grip, the full-height gold longbow), each baked in all
three tier palettes — the same trick `GEAR_MATS` plays with one gear icon across four materials.

### Bots

A bot has no shelf and no pointer, so `botFitLoadout(p)` (called from step 8 of the ladder,
`aiThink` — `updateAI` is only its wrapper — on
a 2.5 s timer) does by hand what a person does with a drag: push loose bits into the tool it is
firing **while the load stays inside its tensile** (so its draw keeps its speed), `sortBits` the
row as a person's is sorted, and put a spare tool into an
empty weapon slot — or over a strictly worse body, which then takes the bag cell the new one came out of. It
only takes bits that fly *toward* what they were aimed at; a bot cannot read a boomerang or an
orbit and leaves those for someone who can.

### Starting loadouts

`CLASS_LOADOUT` gives each class a tool and its bits, and `giveLoadout(p)` is called from
`Player.reset()` on the **first** landing and from `setClass()` — so the weapon is part of picking
a class and every AI player gets its own. A respawn keeps the weapon it died holding
([Death and respawn](#death-and-respawn)); `reset(false)` only hands the kit over again when every
weapon slot is bare, so nobody is set down with nothing to fire. Each class flies in with **one projectile and
nothing else**: the HUNTER a SHORTBOW loaded ARROW, the WARRIOR a LONGSWORD with a BARBED SHOT on
its edge — the one **melee** body ([the cut](#the-cut-a-melee-tool) below).

**The shot sits in the first cell and the rest are left open** (`giveLoadout` runs `sortBits`),
so the first fitting anybody picks up has somewhere to go — a SPLITTER walked over turns that one
arrow into three on the very next press. The hero pop-up's preview
shows the weapon at the body's side (`drawGearPreview`, js/ui/menu.js) — the other half of what a
class flies out with.

## Class abilities (keys 1-4)

Everything in this section lives in **[js/abilities.js](../../js/abilities.js)**, under the
`class abilities` banner. Keys 1-4 cast the four actives of the player's
[class](multiplayer.md#classes) — `CLASS_AB[p.cls]`, one row per key, where **what an ability IS
lives in its table entry** (`cd`, `cast`, `use(p)`), never in an `if` elsewhere. **A key can
carry more than one option**: `CLASS_AB[cls][i]` is its first and `CLASS_AB_ALT[cls][i]` the
others (`abOptions(cls, i)` lists them), and which one a body carries is `p.abPick[i]`, picked
before the eagle in the [hero pop-up](rendering.md#the-hero-pop-up)'s ability strip and carried
through the lock-in page with the gear; **every reader asks `abOf(p, i)`** for what a key is on
this body, and `abKeyOf(p, id)` for the key an ability id stands on (−1 when it is not picked).
A bot keeps the first option on every key — the one its hands know, since `aiCombat` reaches
for keys by index. The hunter's keys carry one option each; the warrior's carry two:

| key | first | other |
| --- | --- | --- |
| 1 | SHIELD WALL | **WAR CRY** — every rival unit within `CRY_R` slowed (`CRY_SLOW` for `CRY_SLOW_T`) and marked (`CRY_MARK_T`) for both maps; nothing hurt (`abWarCry`) |
| 2 | BULL RUSH | **WHIRLWIND** — everything alive within `WHIRL_R` cut for `WHIRL_DMG` and thrown `WHIRL_KB`, buildings cut too (`abWhirlwind`) |
| 3 | STOMP | **HAMSTRING** — the wedge ahead (`HAM_R`/`HAM_HALF`) cut for `HAM_DMG` and rooted `HAM_ROOT` (`abHamstring`) |
| 4 | EXECUTE | **SECOND WIND** — `WIND_HEAL` (30%) of max hp back over `WIND_T` (4 s), paid out each tick by `updateAbilities` (`p.windT`/`p.windRate`, `abSecondWind`); the strip's active tell |

The press goes
through `input.ability` (edge-triggered, like the dodge) into `tryAbility(p, i)`, so a bot casts
through exactly the key a human presses; `updateAbilities(p, dt)` runs the cooldowns, lands the
cast, and ages every state an ability leaves on a body; `updateAbilityWorld(dt)` (called from
`updatePlay`) steps what they leave in the world.

**Abilities are bought with skill points, never gold — and a key you have not bought does
nothing.** Each key starts **LOCKED at level 0**: the class hands you the four actives, not the
use of them. Every level costs **one skill point** — the only thing a point buys, one per
[hero level](multiplayer.md#hero-levels). The **first** point on a key unlocks it (`abUnlocked(p,
i)`, the one gate: `tryAbility` refuses a level-0 key outright and every bot reaches for keys
through `abReady(p, i)` = bought and off cooldown), and each one after shaves `AB_LV_CD` (12%)
off that ability's cooldown — the one lever that means something on all eight keys, twice at most,
so a capped key comes back 24% faster than a freshly unlocked one. Four keys × `AB_LV_MAX` is
**12 points against the 12 a capped hero earns**, so the ladder ends exactly where the hero does:
every point has a home and nothing is stranded. The choice is the ORDER — you land with one point
and four dark keys, so the first thing a match asks is which ability you want to be, and a key
taken to 3 early is three keys still dark at level 4.
The rest of the set: `abLvCanBuy(p, i)` (a point in hand, room on the key),
`buyAbilityLv(p, i)` (the single entry point, reached through `input.cmd {kind:'ability', i}` →
`runCmd` by HUD plate click and bots alike — the unlock floats `NAME UNLOCKED` and a fatter
burst, every level after floats the number), and `abCdOf(p, i)` — which every cooldown-setting
site reads instead of the table's base `cd` (the cast landing, and the shield's comes-down
reset). `p.abLv` resets with the match like `p.gearLv`. The wells carry the progress — fat
gear-style buy pips along the top edge, **one seat per point the key can hold**, so an empty row
is a locked ability — and a locked well stands dim (dark rim, the icon at `LOCK_DIM`, a grey key
digit), exactly as a meal button with nothing behind it does; a press on one reddens and shakes
it (`abDenied`, the twin of `toolDenied`/`foodDenied`). The ASK floats clear of the wells: while a
point is unspent each un-maxed key grows a bobbing gold plus plate in the open screen above its
well (`abBuyRect`/`abBuyHit`/`drawAbBuyPlate`, UI › `hud strip`). The plate press buys — and so does **the key itself while a point is unspent**: the sim
consumes `p.input.ability` as a buy whenever `abLvCanBuy(p, i)` holds and as a cast otherwise
(js/sim.js, beside the other edge intents), so key 2 with a point in hand levels ability 2 and the
next press casts it; a maxed key casts straight through an unspent point. That reaches every
controller and the well click alike, since all of them set the one field. Hover lights the plate
and the tooltip carries the numbers (`LOCKED` and `UNLOCK 1 SKILL PT` on a dark key). Bots spend each free point in rung 0 of the ladder (`aiThink`, js/ai.js), lowest ability
level first — which spends their first four unlocking all four keys before any gets a cut. The cd
column in the tables below is the level-1 base.

**Every ability lands on every kind of body.** A player, a rabbit, a deer, a bird, a wolf and a worker
bot out of the [bot bay](#robots) take the same damage and the same states from all eight — the
tables below say "rival" because that is who you are usually casting at, not because anything else
is exempt. That is not written into each ability: they sweep `unitsNear`/`unitsHit` and land through
`hurtUnit` and the state setters ([status effects](#status-effects-one-set-for-every-unit)), so the
next kind of neutral fauna pushed into `animals` is in range of all eight on the day it is added,
with no edit here. A **structure** is not a unit, so it takes no state — but a rival's building
takes the *damage* of every blow with an area, through `hurtStruct` (`STRUCT_DR` off): the SLAM and
the EXECUTE sweep `structsInCone`, the STOMP `structsNear`, the BULL RUSH's wall slam and the NET
SHOT's line check `structFoe` on what stopped them. The roosting eagle is an objective with its
own damage path, and takes none of it.

**A cast is a performance**: `p.castT` runs the ability's `cast` seconds, the body visibly does
it (`abilityPose` shifts/tilts the sprite — the pierce's locked lean-back, a hop into the stomp,
the recoil hop off the net shot), movement halves (the pierce windup all but plants the feet —
`PIERCE_SLOW`), and the effect fires at the aim held at the END
of the cast. Casting breaks prone cover like a shot, is refused mid-roll / mid-stun / in a hole,
and a stun knocks a cast (and the shield, the rush, and the grapple's rope) out of the hands.
Everything an ability
does to a body is **drawn on that body for both sides** (`drawAbilityOnPlayer`) — a netted player
wears the net — and every wind-up with an area is telegraphed on the snow (below the tables).

HUNTER — bow, distance control, the ground between:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| 1 | **PIERCING SHOT** | 12 s | locks a full draw for `PIERCE_WIND` (0.7 s) — the body plants (`PIERCE_SLOW` ×0.15 walk), the pose leans back and holds, and a thin dashed **telegraph line** is drawn on the ground along the live aim for BOTH sides, gold-flaring as the loose nears. Then the shot fires itself: one enhanced arrow (a full-draw plain arrow ×`PIERCE_MUL` 1.5, `PIERCE_SPD` 380, `PIERCE_RANGE` 520) that **goes through every body on the line** (`a.pierce`/`a.pierceHit`, the arrow loop in js/sim.js) — only a raised shield or the world stops it. **It wears every modifier on the tool in hand** (`pierceMods`) — folded into one envelope and spent as a press spends one: `pierceFlight` is `shotFlight` at full draw, so SPEEDUP and LONGSHOT stretch the reach as well as the speed; HEFT and SPLITTER scale the damage after the multiplier; the fire and CINDER BURST ride it; SPLITTER fans it and DUPLICATE repeats it (`armOff`), every arm a pierce of its own. The telegraph draws that flight, one line per fan arm, each to where the world stops it (`teleLen`). The loose is the unmissable cue: `SFX.nock` snap + a white flash on the arrowhead |
| 2 | **NET SHOT** | 15 s | a weighted net down a line (`nets`): first rival hit takes 4 and is **slowed** (`p.slowT`/`slowMul` ×0.4, 2 s, the drape drawn on them); the recoil kicks the hunter backward with an animated hop (`p.hopT`) |
| 3 | **GRAPPLE** | 8 s | throws a hook down the aim ray: the first **tree, dead tree or rock** within `GRAP_RANGE` (170 px) and `GRAP_ASSIST` of the line (the aim assist) anchors it, and the body is reeled straight at it at `GRAP_REEL` (260 px/s — over `SLIDE_MIN`, so shift on release carves a slide). The reel runs **while key 3 is held** (`input.grapple`, the one held ability input); releasing, arriving, a wall or a stun lets go through `grapEnd`, which KEEPS the momentum and starts the cooldown — a long ride and an instant release cost the same. A hook that catches nothing costs `GRAP_MISS_CD` (1 s) |
| 4 | **SNOW COVER** | 60 s | the burrow ([Prone](#prone-under-the-snow), which only this key opens): the cast kneels and calls `tryProne`, the 60 s clock is paid **on the way under**, and the key again — like every other way back up — rises free. A kneel the snow refuses (still moving, sliding, no snow underfoot) refunds the clock. The well's active tell drains with `p.hide` as the cover builds |

WARRIOR — close pressure, blocking, momentum:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| 1 | **SHIELD WALL** | 9 s | raises a tower shield toward the aim for up to 2.2 s (the cooldown starts when it comes DOWN). Any shot flying into the front arc dies on it (`abShieldBlocks`, checked in the arrow loop before the body); walking drops to 40 % and the weapon is out of hand. **The key again while the wall is up is the SLAM** (`tryAbility` sets `p.castSlam`, the row's `use` branches on it): a `SLAM_CAST` (0.16 s) wind-up with the wedge on the snow, then `abSlam` — `SLAM_DMG` (8), `SLAM_STUN` (1.1 s) and `SLAM_KB` down the face on everything in `SLAM_R`/`SLAM_HALF` (30 px, ±0.85 rad, `unitsInCone`/`structsInCone`, js/actions.js) — and the wall is spent (`abShieldDown`, the cooldown starts). **Mid-charge the same key slams too**: the rush ends on the spot (`rushEnd`, the carried body slammed where it stands) and the wind-up begins there; with no wall up it waits on the shield's cooldown like the raise would. A rush may be cast with the wall up — only the charge itself refuses the other keys |
| 2 | **BULL RUSH** | 12 s | a 0.3 s wind-up with **the line on the snow** for both sides (`RUSH_SPD × RUSH_T` long, stopped at solids, a bar at its end where the slam will be — the body faces the live aim the whole wind-up), then charges the aim line at 300 px/s for 0.42 s (its own movement branch in `updatePlayer`, no i-frames, ramping to speed over `RUSH_RAMP`): the **first rival hit is carried** on the shoulder and **slammed** at the end (a bear is never picked up: the charge stops against it and slams it where it stands) — 10 damage + 0.6 s stun, ×1.6 driven into a wall (`rushStep`/`rushEnd`) |
| 3 | **STOMP** | 14 s | a leap-stomp at the feet — the ring of `STOMP_R` on the snow through the wind-up, filling in as it nears, and flashed white where it lands (`abFx`): 12 damage + radial knockback + a beat of stun in `STOMP_R`, and the **crater** (`craters`) is deep snow that slows rivals crossing it for 4 s |
| 4 | **EXECUTE** | 18 s | a 0.55 s overhead wind-up with the wedge on the snow (`EXEC_R`/`EXEC_HALF`, 30 px, ±0.75 rad — narrower than the sword), then `abExecute`: every unit in it takes `execDmg` — `EXEC_DMG` (10) plus `EXEC_MISSING` (half) of the life it has already lost, capped at `EXEC_BONUS_MAX` (40) extra — so a body the other three keys have worked over is finished, and a full one takes ten. `EXEC_KB` shove; a cut over twice the base is a crit |

Every wind-up with an area is **telegraphed on the snow for both sides** (`drawAbilityGround`): the
pierce's and the charge's marching line, the stomp's ring, the slam's and the execute's wedge — in
`TELE_COL` red, `TELE_HOT` gold for the last quarter, the inside hashing in as the landing nears
(`castProg`, off `p.castMax`) — and every landing flashes the same shape in the blow's own colour
for `AB_FX_T` (`abFx`, ticked in `updateAbilityWorld`). The shapes are `drawWedge`/`drawRing`/
`drawTeleLine`, and the sword's sweep (`drawSlashes`, called from js/draw/render.js beside the E swing
arcs) is the same wedge. A telegraphed cast keeps the body facing the live aim the whole wind-up
(`updateAbilities`), so the shape and the body agree about where it is going.

A player's movement caps fold through one function — `abilityMoveMul(p)`: root pins, cast/shield/net/
crater drag (the pierce windup's own harder drag included) — applied to the walk
cap **and** the ice cap in `updatePlayer`; the grapple's reel is its own movement branch there,
beside the rush's. An
animal or a bot folds the same root and slow through `unitMoveMul(e)`, spent inside `navStep`.
All damage passes its `src`, so an ability kill credits like an arrow — a net whose
caster has since gone down credits nobody (`abCredit`) rather than a corpse. Bots spend abilities in
the ladder's fight rung (`aiThink`), off cooldown at ranges each is good at (the grapple is the one they skip —
a held key and a terrain read the ladder does not try to fake). The strip's ability wells (icons,
cooldown wipes) are the HUD's half and live with it in [rendering.md](rendering.md).

## The wiki

The main menu's **WIKI** plank (`m.screen = 'wiki'`, its own `wikiT` ease, ESC back) opens the
game written down: one surface, a tab bar of **pages**, each a scrolling column of blocks.
WHISPERING WOODS (`TRACKS.wiki`) loops under it from the moment it opens — an ordinary
`music.play` the way the lobby takes the layer, not the counter's hold, because the wiki is
a surface you sit in rather than a window over a running match; `leaveWiki()` puts `intro` back
([Audio](#audio)). The
page itself — the slab, the tabs, the blocks, the rail — is in
[rendering.md](rendering.md#the-wiki-screen); this section is what the pages *say* and where
the numbers come from. Every number on a page is read off the constant the sim spends, never
typed twice, so a retune can never leave the wiki lying.

- **CLASSES** (the page the wiki opens on) — the two classes as the lobby reads them: the
  body at 3x in the side you play in, the name and role, the three lines of the pitch, and a
  ledger of health and the four stat pips (`CLASSES[c].stats`, `kit.maxHp`); under each, its
  four abilities in key order — the key on a plate, the strip's own 32 px icon in a well
  (`classAbIcon`), the name, COOLDOWN and CAST in the columns (`WIKI_AB_COLS`, off `CLASS_AB`)
  and the blurb wrapped beneath. A hover raises the lobby's ability card (`tipClassAb` with
  the class passed, so the base cooldown). The intro names what a skill point does
  (`AB_LV_CD`, `AB_LV_MAX`, [Hero levels](multiplayer.md#hero-levels)).
- **BEASTS** — the meadow's two kinds and the camps' three, each drawn wearing the frame it wears in the snow; a
  legend naming the frame's parts once (the level plate, health, the stamina bar that is a
  camp monster's leash bar, the `!` noticed mark); and per kind a line of what it does and a growth
  table — HEALTH and KILL GOLD at levels 1, 6 and 12 (`WIKI_LEVELS`) — from `ANIMAL_HP` /
  `ANIMAL_LV_HP` and `YIELD` / `ANIMAL_LV_GOLD` through the same arithmetic `makeAnimal` and
  `animalDies` use ([Wildlife](#wildlife)). The frames on the page wear the level a spawn would
  be dealt right now (`animalLevel()`).
- **ARSENAL** — every tool and bit, and **every one is unlocked**: the page is not a shop, not a
  skill tree and not a gate but the picture of what the map may hand you, and it may hand you
  all of it — a profile on its first flight rolls exactly what one five hundred matches old
  rolls. Three tables — TOOLS (rate of fire, bit slots, tensile),
  BITS (damage, weight, speed, lifespan, flight) and MODIFIERS (weight, and the first sentence
  of the blurb) — worn to gilded, each kind's icon on its own tier plate with the blue pip for "you
  have held one" (`PROFILE.techSeen`), and a hover raising the full card in the tooltip
  (`tipKind`, js/ui/tooltip.js).
- **WORLD** — the one page with no numbers on it: the valley written down. Ten entries in the
  order a scout meets them — SOFTFALL, THE WORKS, THE CLAIM, THE EAGLES, THE SCOUTS, THE
  COUNTER, THE MACHINES, THE ROAD, THE WOLVES, GOLD (`WIKI_WORLD`) — each a figure on its mound
  in the side you play beside a short paragraph, between a two-line opening and a one-line
  close. Every sentence is either something a match does or the valley's reason for it, and the
  sentences live in that table alone; the premise, the fixed words and the voice they are
  written in are [lore.md](lore.md).

The `TECH` table in [js/tools.js](../../js/tools.js) carries the kinds and exactly one
edge per node — `req`, the node beneath it, null on the tier-0 row. Nothing at runtime reads the
edge: it is the arsenal's lineage on paper (each root plus at most two children — SHORTBOW →
RECURVE BOW → LONGBOW, ARROW → CARE ARROW → ICE LANCE, BARBED SHOT → THROWING LOG → HEFT, and so
on), the ARSENAL page lists kinds in its order, and a future page may want to draw it.

**`LOOT_POOL` is every kind at or under a tier**, split into tools and bits, and it is built once
by `rebuildLootPool()` at boot rather than filtered per roll, because a drop happens in the middle
of a swing. Nothing narrows it and nothing can empty it, so the tier is the only thing a roll asks
about; `dropLoot` still returns null on an empty pool rather than throwing.

`PROFILE.markSeen(id)` is all a profile remembers about the arsenal, and it gates
**nothing**: it is fired for the local player only (`noteSeen(p, type)`) from the drop pickup and
from the loadout they fly in with, and it puts the blue pip on the ARSENAL row.

Storage is [js/profile.js](../../js/profile.js) and nothing here writes a key — see
[architecture.md](architecture.md#profilejs).

## The swing tools (E)

The axe and the pick are **not selectable and are not weapons**. `SWING_TOOLS` (`bow`, `axe`,
`pick`, indices `SWING_BOW/AXE/PICK`) is an internal table for icons and names; `p.swing` is what
that player is *holding for work*, and it returns to `SWING_BOW` — which draws the weapon on the
selected slot — the moment a swing ends. Two verbs, two inputs:

- **Left click = the selected tool slot.** The press only records intent (`clickAction` sets
  `input.fire`); `updatePlayer` starts the draw on the rising edge and fires on the falling one.
- **The hands work on their own** (`autoWork(p)`, js/actions.js — `updatePlayer` calls it every
  step `p.input.work` is *not* set). Whatever an `OBJECTS` entry marks `auto` — a tree, a dead
  tree, a berried bush, a chest, a rival's roosting eagle — and **any building on the
  other team** (`autoToolFor`, resolving a footprint tile through `structOf` and refusing your
  own via `ownsStruct`, exactly as `workTarget` does) is swung at the moment it is inside
  `WORK_REACH`, no key held: `autoTarget(p)` takes the nearest such tile in the ring around
  the player — a rival's building or eagle first (`AUTO_PRIO_FOE`), then a chest (`AUTO_PRIO_PRIZE`), then scenery, and by tile centre to body within a rank (`autoPrio`) — and `startSwing` runs the same swing E's would. What makes it
  automatic and not a cancel: it never drops a draw or the held button (`p.autoSwing` lets the
  draw begin under it, and the release fires on the frame the button lifts, swing or no swing),
  never stands a crawler up (`p.prone` waits, unlike E), and never touches the aim (`startSwing`
  leaves the facing alone while a draw is running, so the aim never flicks toward the tile) — you
  keep shooting, walking or drawing through it, and the tree comes down beside you, with
  **both tools on the sprite**: the axe or pick sweeping in one hand, the drawn weapon on the aim
  in the other (`drawHeldTool`, [below](#the-draw)). It obeys the
  same busy gates as E (a fall, a roll, a stun, an ability, a meal, the swing cooldown).
  **Fish are the same idea on ice** (`autoFish(p, dt)`, js/tools.js, called right after it):
  standing on an ice tile with a fish inside `FISH_CATCH_R` catches it with no press, once
  every `FISH_AUTO_CD` (1.2 s, `p.fishCd`) so a walk along a shoal is a stride per fish, and
  nothing can refuse the catch, because fish go in the pouch. It spends no tool cycle and runs
  under a draw; the fire button never spears — `fireTool` fires whatever is loaded, fish or no
  fish. Nothing in this is a key: the swing itself, the catch pose and the rim are the whole
  signal, so `drawWorkHint` shows no prompt over an `auto` target and the fish brackets carry
  no verb (bright inside catch reach, dim outside).
- **E = work** (`tryWork(p)`, auto-repeating every swing cooldown while held — `updatePlayer`
  calls it whenever `p.input.work` is set, and a held E always beats the hands' own choice).
  It is what reaches **bare ice** (cracking toward a hole) and **the practice dummy** — the
  things not marked `auto` — and it still works anything else if you insist. A rock is not E's:
  it mines itself for whoever stands by it ([Mining a rock](#mining-a-rock)). It resolves `workTarget(p)`: the tile that player is
  aiming at, if it holds a tree or a dead tree (→ axe), a berried bush (→ axe), or
  is bare ice with no object (→ pick, cracking toward a fishing hole); and `near` = the tile is
  within `WORK_REACH` (1) tiles, Chebyshev, of the tile the player stands on — i.e. the 3×3
  ring around you, never a second row, regardless of where in your tile you stand. Out of reach or nothing workable, E
  does nothing — and **standing at a merchant's counter, E is the counter's** and swings at nothing
  at all ([opening it](#opening-it)). A valid target swaps `p.swing` to the right one, drops any draw, faces the
  tile, and starts the swing; `swingHit(p)` **contests** the locked tile (`p.workTx/Ty`) so only
  one player's swing lands on it in a step, then hits whatever is there via
  `hitObject(o, p)`/`crackIce()`. Once `swingT` and `swingCd`
  both reach 0, `updatePlayer` puts the weapon back (`p.swing = SWING_BOW`), so the axe only
  exists visually for the duration of the work. `workTarget()` is shared with the cursor, so the
  lock ring is exactly "E will do something here".

Whenever `workTarget()` is non-null, `near`, **and not something the hands take on their own**
(`autoToolFor(t.o, player) >= 0` nulls it — and tools aren't blocked, the bow drawn or a cable
ridden), `drawWorkHint()` — called right after `drawSelection` in the overlay pass — floats a
key prompt over the target: a pixel key-cap wearing the work key (**E** until rebound) plus the
verb. Since every tree, bush, chest and rival building is `auto`, the only prompts that
show in play are **CRACK ICE** over bare ice, **HIT** over the practice dummy and **MINE** over a
standing rock; the verb and the lift are still read off the `OBJECTS` entry (`verb`, `lift`: 33
for a pine, 20 for a dead tree, 28 for the dummy, 10–12 for the short ones, a rock's by its kind,
8 over bare ice), a two-tile rock takes it on its middle (`w`), and the building branch — BREAK,
clearing the sprite and centred on the footprint — stays for a building that is ever not `auto`.
A merchant and a zipline in reach claim the cap first (`drawShopHint`, `drawZipHint`). The cap
visibly presses (face drops a pixel, highlight gone, label goes gold) while the local player's
`input.work` is set.
If the prompt would overlap the player sprite (an adjacent target) it flips under the tile
instead. Since it only appears in reach, it doubles as the "you're close enough" signal.

`hitObject()` keeps its hard tool gating (trees need the axe, with
`SFX.deny` + a `NEEDS AXE`/`NEEDS PICKAXE` floater) as a safety net: `tryWork` and `autoWork`
always pick the right tool, so normal play never reaches it; buildings are not gated
at all, since the axe is the only tool E ever brings out for one.

**Stumps and open ice holes** are not E targets — a stump is ground a piece may stand on and a hole the net's site (`canPlaceAt`, the [build list](#base-building)). **Buildings on another
team are**: `workTarget()` resolves the tile through `structOf()` (so any tile of a 3×2 footprint
counts, via its `part`) and returns the axe when `ownsStruct()` is false, and `swingHit` routes
the swing to the anchor. Your own buildings are never swung at: E in reach of one opens its
manage wheel instead (`manageNear`, js/structures.js), so E is never ambiguous. See
[Base building](#base-building) for the damage numbers. The axe and the pick never hit a living
thing: the tool on the selected slot is the only weapon aimed at one.

Every tool is **hold-to-charge**: holding the button arms the shot (`p.fireArmed`), the draw
starts as soon as the tool is actually ready and runs `p.charging`/`p.chargeT` (movement targets
scale by the kit's `chargeMul`, 55% for the hunter — walk speed and the ice cap both — facing
tracks the mouse, a draw meter renders
above the player's health bar), and the release edge fires via `fireTool(p)`. What the hold buys
is [The draw](#the-draw); a shot loosed out of full snow
cover multiplies the damage by `AMBUSH_MUL` (see [Prone](#prone-under-the-snow)). Shots carry
their shooter's `owner`/`team`, live in the `arrows` array, and are updated in `updatePlay()`:
they die on solid tiles (unless the bit passes through them — and a rival's **building** that
stops one is sieged), on a **rival player** (see [PvP](multiplayer.md#pvp)), on an **enemy worker
bot** (`hurtRobot`) or on any animal hit (knockback scales with power) — whichever the step met
first ([flight paths](#flight-paths)) — or at the end of the bit's life.

`p.fireArmed` is what makes the draw survive a tool that isn't ready. It is set on the press edge,
cleared on release and at every point that cancels a draw (`tryWork`, falling in a hole, a meal,
an ability cast, clipping onto the zipline, an
overlay opening in `sampleHumanInput`, `die`), and the draw begins on the first
step where it is set *and* `nockT <= 0` *and* `toolReady(p)` (a tool in hand). Requiring a fresh press instead
would deadlock every controller that simply holds the button down — which is every bot:
`aiThink` sets `inp.fire = chargeT < drawTime(p) * k`, so after a shot it goes straight back to
true and no second edge ever arrives. `p.chargeT` is the raw seconds held and is **never
clamped** — every reader takes `drawPow(p)` (0..1) off it, and the meter's white blink at the
peak needs to see the hold run past the full draw.

### The cycle

There is no ammunition. What sits between one press and the next is **the tool's own cycle**:
`fireTool` sets `p.nockT = toolRof(p, cell)` ([a tool](#a-tool)'s `rof` row), and no
draw can begin while that runs. Its end is the **one** gate: the frame the wipe clears, a held
button starts the draw. `toolCycle(p)` — `toolRof` of the held tool, bare hands' `kit.nock` when
no tool is up — is the one number every readout divides `nockT` by —
the well's wipe, the reticle's corner marks and the overhead slate bar — so no meter can show a
cooldown a different length from the one running; a new readout divides by it too, never by the
bare `kit.nock`.

Three indicators carry it, and none is a word:

- **The weapon well** (the shelf's tool cell, `drawShelf`) — the top-down cooldown wipe, the same cover every
  ability well cools by, over exactly `toolCycle`. When the wipe is gone, the bow is ready.
  Always.
- **The overhead bar** (`drawPlayer`) — the draw meter's slot doubles as the cycle readout for
  *every* player: gold filling = drawing, slate filling = reloading, pale gold = just came back.
  Same geometry either way, so it never jumps.
- **The reticle** (`cursorInfo` → `drawCursor`). Every reticle in play carries `nock` (elapsed
  fraction, 1 = ready) and `dry`, whatever the pointer is over. While the cycle runs, four gold
  corner marks fall inward and land on the ring; a dry tool drops the centre pixel and greys the
  ticks — the crosshair goes hollow.

Sounds: `SFX.nock()` on the cycle completing (very quiet — it plays after every shot) and
`SFX.dryFire()` on an empty press.

### The draw

Under the keyboard's [CLICK scheme](multiplayer.md#the-click-scheme) a locked target draws the
tool by itself to `CK_AUTO_DRAW` (0.7 — the same fraction a NORMAL bot looses at) while the hand
is off the button, through this same curve and the same cycle: the auto-attack is a bot's loose
and nothing more, a floor under the hand's own draw, never a second weapon.

`drawPow(p)` — `chargeT` over `drawTime(p)`, clamped 0..1 — scales the shot three ways
at once, each on a straight line from a floor to the bit's own number (the `the draw` banner,
js/tools.js):

| | at a tap (`pw` 0) | at full draw | floor |
| --- | --- | --- | --- |
| range | ×`DRAW_RANGE_MIN` | ×1 | 0.22 |
| speed | ×`DRAW_SPEED_MIN` | ×1 | 0.6 |
| damage (the whole sum: bit + kit + level, before modifiers) | ×`DRAW_DMG_MIN` | ×1 | 0.3 |

`shotFlight(b, m, pw)` turns that into the `spd` and `life` a bit leaves the tool with, the
modifiers' envelope folded in and the range curve applied through the life, so a tap also *stops
short* rather than only arriving late. It is the one envelope: `emitBit` fires through it and
`drawAimLine` measures it, which is what lets the line on the ground grow out of the bow as the
string comes back. A plain arrow off the shortbow: 60 px and 4 damage at a tap, 272 px and 17 at
full.

**Weight is the length of the pull.** `drawTime(p)` is the kit's `bowCharge` times
`toolDrawMul(cell)`: 1 while the load is at most `DRAW_EASE` (half) of the tool's tensile, then
`DRAW_LOAD` (0.6) longer per full tensile beyond it. A heavy build fires everything it carries,
only later. The overhead bar, the aim line and the bots all read `drawTime`, never `bowCharge`. **That curve is the whole punishment for spamming the button** — short, slow and weak, with
the cycle still to run before the next — dealt by the shot itself rather than by a counter, so
what a player sees (a stubby line, a pale meter) is exactly what they get. Bots read the same
curve: `aiThink` holds to `drawTime(p) × k` before loosing.

A shot in flight is drawn in its own pass (using `ex`/`ey`), and **what it looks like in the air
says what it does**. A bit may name a **body** of its own and `BIT_BODY` (the `the bodies a bit
flies as` banner, js/draw/render.js) is the only place those names mean anything, so a new
silhouette is one row in `BITS` and one row there rather than an `if` in the shots pass. Each is
handed the tip both rounded and exact, and a shaft rasterises from the exact one.

| `body` | bit | what flies |
| --- | --- | --- |
| `barb` | BARBED SHOT | the arrow's head with two pairs of barbs swept back down a dark, heavier shaft (`BARB_BODY`) |
| `lance` | ICE LANCE | an icicle five px deep: white spine, a lit face and a shaded one, no fletching, the side's wrap on its butt (`LANCE_BODY`) |
| `care` | CARE ARROW | the arrow in gold (`CARE_INK`) with a four-armed glint breathing on its tip (`drawCare`) |
| `hook` | HOOKSHOT | a grapple - prongs swept back, the shank in the bit's colour, the side's eye at the butt - on a twisted cord back to the thrower's hands (`drawHook`), which shortens as the boomerang comes home |
| `tumble` | THROWING LOG | a 9×5 cut log, bark and pale end grain, turning end over end (`LOG_MAP` → `drawTumbler`) |
| `mote` | WISP | a round core breathing between 5 and 7 px, white at its heart, dragging a comet's tail back along the ring it sweeps (`drawMote`) |
| `fist`, `axe` | BIG FIST, BIG AXE | ASCII maps stamped as a **block** rather than a spine (`FIST_MAP`/`AXE_MAP` → `drawSwungBody`) — the fist's jagged leading edge is its knuckles, the axe a four-px wedge on a six-px haft |
| `warp` | TELEPORT REQUEST | not a shape at all: three bars snapping to fresh angles every `WARP_FLICK` (0.03 s) over a white core, so the thing crossing the snow visibly does not obey it |

The shafts (`barb`, `lance`, `care`, `hook`) are maps in `ARROW_MAP`'s own language, parsed by
`shaftBody` (js/draw/overhead.js) and rasterised by the arrow's own DDA through `drawShaft`, so
they are as clean on a diagonal as the arrow and keep the team's T/D on their tails. Everything
that turns as a block (the log, the fist, the axe) goes through `stampTurned`, which samples
*back* from every pixel into the map, so it is solid at every angle — stamping each cell forward
leaves holes on the diagonals that the rim fills with dark. All of them wear `paintRimmed`'s or
`paintArrowPx`'s 1 px dark edge. **A burning shot burns on its head** whatever it flies as:
`drawShotFire` licks a tongue of fire back off the tip — a white-gold heart, an orange body, a
red rim that keeps it off white snow — climbing as it trails and flickering every `FIRE_FLICK`,
longer the hotter the burn (5 px on a FLAME, 7 on a PYRE, 9 on both), with a CINDER BURST's
shot spitting sparks round its head. Everything else is **the one arrow body**: `ARROW_MAP`
(js/actions.js), an ASCII master parsed once into `ARROW_BODY` — a white tip, a tapered flint
head, a 1 px collar in the bit's own `col` (the bit is readable from the collar; the shaft never
recolours), a single-gold shaft, and swept swallow-tail feathers in `TEAMS[a.team].mark` edged
with the team's `coatD` — so whose shot it is reads from the tail. `arrowBodyPx`
(js/draw/overhead.js) rasterises it at the live bearing by **DDA** — the spine advances exactly one
pixel along the flight's dominant axis per step (a diagonal shaft is a clean 8-connected
staircase, never a lumpy one with doubled cells), body columns are sampled onto that chain with
structural pixels winning collisions (`ARROW_BODY` is priority-sorted at parse), and each vane
row sits one exact pixel further out along the perpendicular's dominant axis, so rows never
collapse together and the two vanes stay mirrored at every angle. At the four cardinals this
degenerates to plain rounding. `paintArrowPx` dilates every pixel into `ARROW_RIM` first (a plus-shaped
1 px dark edge) so the shaft reads over snow. The body is built into the `ARROW_PX` scratch
array; `a.x`/`a.y` is the TIP (the point the sim tests) and the body trails `ARROW_LEN` (15) px
behind it, which is why the view cull uses the widened ±22 bound. The whole body is 16 long by
7 deep — one 16×16 sprite cell, the scale everything else in the world is drawn at.

Behind it, each shot lays a **trail of team-coloured motes** into `particles` (fire instead, if a
FLAME modifier is riding it — the burn is the more urgent fact about that shot than whose it is),
one every
`ARROW_TRAIL_STEP` (4) px of *flight distance* — not per tick, so a slow arrow streaks as evenly
as a fast one, and a long frame is subdivided instead of leaving a gap. Motes are dropped at the
distance behind the TAIL they are owed (`a.trailD` banks the remainder; a shaft's body runs
`ARROW_LEN` px behind the tip, so the trail flows off the fletching — and none lay until the tail
has cleared the bow, `a.flown`), drift back at 8 px/s and
fade from `ARROW_TRAIL_A` (0.7) over `ARROW_TRAIL_LIFE` (0.22 s), leaving a tail that thins out
behind the shot. The particle draw pass is what makes that possible: a particle's
`maxLife` is the seconds it spends fading (`burst` uses 0.4) and its optional `alpha` caps how
opaque it ever gets; an optional `dx` is a steady sideways px/s the damping never takes (`burst`'s
`drift`: the wind carrying a pine's snow). Particles draw before the arrows, so a trail always sits under its own shaft.
Switching tools, opening an overlay, or dying drops the draw without firing (and clears
`fireArmed` with it); `BOW_CHARGE` (0.9 s) is a full draw.

While a tool is drawn, `drawAimLine()` (called from `render()` right before the shots pass, using
`ex`/`ey`) shows the shot: a static line of 2×2 drop-shadowed dots from the spawn point along the
exact direction `emitBit()` uses. Both aim from `player.y - BOW_Y` (6 px above the feet, where the
shot spawns) — not the feet — so the line and the flight pass exactly through the cursor instead
of running parallel a few px above it.

The line is **truthful, not decorative**, and it is truthful about the **bit that is up next**
(`toolPlan`'s lead shot) at the **draw held right now**, not about a bow in general: it runs
exactly as far
as that bit would fly if loosed this instant (`shotFlight` — speed × life through the tool's
modifiers and the draw curve, so it grows out of the bow as the string comes back, and a tap's
line is a stub), and only stops at an `isSolidTile` if that
bit is one a wall stops. It still stops at the first animal it would hit (the same 8 px body test
as the arrow update) with an impact cross — line-coloured on a solid, hunt-amber on a body — and
otherwise ends in a short perpendicular range-cap bar. A `lob` gets only the first 35% of its
flight, where it is still on the bearing; a `boomer`, an `orbit` or a `curve` gets **no line at all**, since
the only honest straight line for those is none — what they do is shown by the shot itself the
moment it leaves. Colour follows the draw meter: gold charging, pale gold at full (`DRAW_COL` / `DRAW_FULL_COL`,
js/draw/overhead.js).

The weapon is also drawn **on the player** by `drawHeldTool()` (called from `drawPlayer()`): at
rest the hands hold the tool on the *selected slot*, in its own tier colour, so what someone is
carrying reads off their sprite from across the snow — and an empty slot reads as empty hands.
It is carried at the leading hand while idle/walking (turned to the facing, drawn *before* the
body sprite for `up` so it's occluded, 1px walk bob), and rotated toward the mouse while drawn.
Every art says which way its business end points as drawn (`TOOL_FWD`, js/tools.js) and the hand
turns it by the facing or the aim minus that: a bow's arrowhead is at +x, drawn the way a bow is
held — string toward the archer, belly toward the target — the sword's point at −x, the sling's
stone up.
A melee swing sweeps the axe or pick's icon along the swing arc instead, and a swing running
under a draw (an automatic one — `autoWork`) draws **both**: the sweep first, the drawn weapon
on top, since the shot about to leave is the thing to read.
Mid-swing the axe or pick takes over, swept along the same arc as the swing effect. Both sizes go
through the same code: the icon is centred on its own half-width, 8×8 for a swing tool and 12×12
for a weapon.

## Dodge roll

**Space** (`tryDodge(p)`, driven by the edge-triggered `input.dodge`) dashes a player along its
`input.mx/my` (facing direction if nothing is held): an impulse of
`max(DODGE_SPEED (215), current speed)` into `p.vx/vy`
for `DODGE_T` (0.28 s), with i-frames for the roll only (`p.invuln` — momentum carried
past the roll gets no i-frames). It is the only i-frame a fight produces
([i-frames](#i-frames-only-something-deliberate-grants-them)). Two charges (`DODGE_CHARGES`), refilling **one at a time**
every `DODGE_CD` (3.5 s); state lives on the player as `dodgeT/dodgeVX/dodgeVY/dodgeCharges/
dodgeRegenT/dodgeDustT` (`dodgeVX/VY` exist only for the spin/ghost render — movement runs on
`vx/vy`). While rolling, movement input, friction, footprints, walk animation, and the held
tool are suppressed (still collides with solids; a wall zeroes that axis), and `drawPlayer`
swaps to a full 360° sprite spin with two afterimage ghosts trailing the velocity plus dust
bursts. The roll's exit speed is spent by the surface — see
[Momentum movement](#momentum-movement-players-only). The charge meter is a single unsegmented **white** stamina
bar (`STAM_COL`, js/draw/overhead.js — white on every side, since stamina has no side) on a plate
directly beneath the overhead health bar — charges stay discrete in the sim,
the bar shows the pooled total (full charges + regen progress). Spending a charge leaves a
pale ghost of the lost chunk (`player.stamGhost`/`stamGhostT`): it holds ~0.3 s, then drains
into the live fill souls-style. Death cancels the roll, respawn refills
charges; pause, the settings panel and the wheel block the local player's roll (the
[map](#the-m-map-does-not-pause) does not). The bar is drawn for
**every player** — a rival out of rolls is a tell, and the level badge spans both bars. A roll out of
[prone](#prone-under-the-snow) is legal: `tryDodge` stands the player up first.

### The roll is a hit

A dash is a body thrown at whatever is in front of it. Every step of the roll, `rollSweep(p)`
takes everything inside `ROLL_HIT_R` (7px) of the roller's own radius and splits it two ways:

- **Small — rabbits, wolves, robots, other players.** One swipe each, **once per roll**
  (`p.rollHit`, cleared by `tryDodge` and again when the roll ends), and the roll goes straight
  **through** them: `separateUnits` skips any pair where one side is a live roll and the other is
  small, so there is nothing to bump against. Friendly bots and teammates are passed through
  untouched — you roll *under* them, you do not run them down. A rival with i-frames up (mid-roll
  of their own) refuses the whole thing, damage and stun both, so **rolls cancel rolls**.
- **Big — a deer, a bear, a tree, a rock, a building.** A **tackle**: both sides take it, both are
  stunned (except a bear: it takes the damage and keeps its stride, roar and attacks included), and the roll ends on the spot. `rollTackle` drops the roller's own i-frames first,
  because the tackle is the one hit a roll cannot dodge, and bounces them back off the contact.
  A wall only counts when it is taken head-on — the speed actually driven into the axis
  `moveEntity` refused has to clear `TACKLE_MIN` (120 px/s), so brushing past a pine at a run is
  free and dashing straight into one is not. `tackleObject` puts real damage into an **enemy
  building** (it has an hp pool); a tree or a rock only shudders, because a pine's `hp` is a chop
  count behind a tool gate, a rock mines itself for whoever stands by it, and a shoulder is neither. Fish are under the ice and are in none of it — and
  nor is a **fish net**, which is not solid, so a roll crosses one without a contact at all.

**Everything scales with the speed the roll is actually carrying** — `rollPow` runs from the
class's own `kit.dodgeSpeed` up to `ROLL_FAST` (340 px/s), which is why a dash launched out of
an ice slide deals `ROLL_DMG`'s top end (16 and a 1.1s stun) against 5 and 0.5s off a standing
start. That is the whole reason to chain a dash out of momentum instead of from rest. All three
kinds take it through the same `hurtUnit` + `stunUnit` pair
([status effects](#status-effects-one-set-for-every-unit)) — the loops differ only in their radius
and their once-per-roll bookkeeping.

## Status effects: one set for every unit

Everything in this section lives under the **`status effects`** banner at the foot of
[js/actions.js](../../js/actions.js). Three kinds of thing walk this world — a **player**, an
**animal**, a **worker bot** — and all three take a blow and a state through the same funnels
(the [CLAUDE.md](../../CLAUDE.md) hard rule; the detail is here):

| Reach for | When |
| --- | --- |
| `hurtUnit(e, dmg, nx, ny, src, o)` | **any** blow. `o` = `{ type, kb, kbMul, cause, ambush, crit, burn, burnDps }` — `kb` the absolute px/s of shove an ability picks, `kbMul` the multiplier on whatever shove that kind takes anyway ([knockback](#knockback-one-number-thrown-at-three-weights)). Routes to `damagePlayer` / `hurtAnimal` / `hurtRobot`, which stay for what is genuinely per-kind (a den waking, a worker turning on whoever hit it) |
| `unitsNear(src, x, y, r)` | every living thing in a circle that `src` may touch — players, wildlife **and** bots in one list |
| `unitsHit(src, x, y, r)` | the same, minus anyone whose i-frames are up: the list a **blow** sweeps, so a rival mid-roll is untouchable. A lasting ground *condition* (a crater) wants `unitsNear` — a condition is not a hit, and a roll should not shrug one off |
| `stunUnit` `rootUnit` `slowUnit` `netUnit` `markUnit` `igniteUnit` | the one place each state is written. Each takes the worse/longer of what is already on the body |
| `unitMoveMul(e)` | what is left of a non-player's speed — `abilityMoveMul`'s twin. Spent inside `navStep`, so one edit slows every walker; the two movers that steer themselves rather than route (a loitering bot, a bird in flight) fold it in by hand |
| `clearUnitStatus(e)` / `douseUnit(e)` | a fresh body, and a fire put out. Called by `Player.reset`, `die`, `makeAnimal`, `makeRobot` |

`unitFoe(src, e)` is the side rule they all share, and it is where **wildlife being neutral** is
written down once: an animal has no `team` (`unitTeam` → −1), so it is nobody's friend and
everybody's fair game — exactly how the world already treated a deer. `sideOf(w)` hands one of these
lists the side of a **thing in the world** — a net, a shot in flight — rather than a living
caster, so a net outlives the hunter who threw it and still knows whose it was; `abCredit(w)`
(js/abilities.js) is its other half, and pays a kill to nobody once that caster is down.

### I-frames: only something deliberate grants them

`p.invuln` (players only — an animal or a worker bot has no such field and never had) counts down
in `updatePlayer` and is read by every picker at once: the arrow loop skips a player that has it,
`unitsHit` drops one, `rollSweep` passes over one, and `damagePlayer` returns early on one. **A hit
sets it nowhere.** The only things that grant it are deliberate:

| Granted by | For | Why |
| --- | --- | --- |
| `tryDodge` | `DODGE_T` + 0.05 s | the roll *is* the dodge — [Dodge roll](#dodge-roll) |
| `Player.reset` — so `respawnPlayer` | 3 s (0 on the very first spawn) | nobody is spawn-camped |
| `landPlayer`, `practiceRevive` | 2 s | a beat of grace while the snow settles |
| the ice-hole scramble (`updatePlayer`, js/sim.js) | 0.8 s | you climb out; you are not bitten climbing out |
| the drop briefing (`js/boot.js`) | 0.4 s, refreshed | the lesson is not a fight |

`rollTackle` **drops** them ([the roll is a hit](#the-roll-is-a-hit)).

Because a hit grants none, every bit of a volley ([tools and bits](#tools-and-bits)) lands its own
damage, its own shove and its own fire, nothing caps a wolf pack
([Camp monsters](#camp-monsters-neutral-until-hit)), and
a body can take several hits in one frame — `SFX.hurt()`’s 0.03 s `gap` collapses the oofs into
one so they do not phase, while the damage total (each hit adds to it), the red flash, the shove and the shake are
per hit. Knockback does not accumulate: the last blow of a step writes `kbx`/`kby` outright.

The six states, and what each does to a body:

| state | field | what it does | the tell on the body |
| --- | --- | --- | --- |
| **stun** | `stunT`/`stunMax` | a player has every intent dropped out of `p.input` at the top of `updatePlayer` (movement, fire, work, slide, the edge-triggered lot) rather than each action refusing separately, so a human and an AI fill are pinned by the identical window — the draw, the swing in flight and any roll are cancelled outright; an animal or a bot skips its brain for the window in `updateAnimal`/`updateRobot`. Never touches velocity: whatever hit you still slides you | three sparks orbiting (`drawStunStars`) |
| **root** | `rootT` | move multiplier 0 — no walk, no roll, no slide; tools still work. Currently no ability or bit sets it — the state and its tell stay with the universal set ([Intentional dead code](checklists.md#intentional-dead-code)) | sprung iron jaws at the feet |
| **slow** | `slowT`/`slowMul` | the multiplier on every speed cap | — (the net's drape says it, when a net is why) |
| **net** | `netT` | the slow, plus the reason for it | a mesh drape over the sprite |
| **mark** | `markT` | on a player, `seenAt()` returns full range and both maps keep drawing them (its one legal bypass); an animal or a bot has no cover to strip, so it is the reveal alone. Like root, currently sourceless — kept with the set | gold chevrons falling toward the head |
| **fire** | `burnT`/`burnDps`/`burnBy` | see below | flame tongues off the crown, and lit snow under the feet |

Every one of them is **drawn on the body, for both sides**, at whatever size that body is —
`drawUnitStates(e, px, py, w, h, now)` (js/abilities.js) takes the sprite's own box and is called by
`drawAbilityOnPlayer`, `drawAnimal`, `drawBird` and `drawRobot` alike. A state you cannot see is a
rule you cannot play around, and that is as true of a deer as of a rival. The player keeps one tell
of its own on top (a raised shield, `drawAbilityOnPlayer`), and the stun badge is the one visual that
differs by kind: over an animal or a robot the sparks sit above the health bar, while on a player
they ride a badge that **mirrors the level badge on the other side of the overhead frame** — same
backing and track, its left frame column shared with the health bar backing's right edge — whose
5×5 track drains from the bottom as the window runs out (`stunMax` is the height it drains from).
It is drawn for every player, like the stamina bar: a rival seeing stars is a tell worth having.

### Damage types, and fire

A blow carries a **type**, and `DMG_TYPES` is what a type *is* — the sparks it throws off a body and
how long it leaves that body burning. `blunt` is everything that always existed (an arrow, an axe, a
shoulder) and is the default when nothing names one.

**`fire` is the one type that outlives its own blow.** It ignites what it lands on; an ignited unit
then pays `burnDps` in bites `BURN_TICK` (0.4 s) apart until its clock runs out — `BURN_T` 3 s at
`BURN_DPS` 6 for a plain fire hit. A fresh ignition **refreshes** the clock (capped at `BURN_MAX`,
8 s) and takes the hotter of the two rates rather than lighting a second fire, so a SPLITTER fan
sets you properly alight instead of banking half a minute of it. Credit rides along in `burnBy`, so
burning to death is a kill for whoever struck the light (`KILL_VERB.fire` — "BURNED"; with nobody to
credit, `DEATH_CAUSE.fire` — "BURNED IN THE SNOW").

Two rules make the burn behave like fire rather than like a stream of small arrows:

- **`DOT_CAUSE`** (js/player.js) — a bite of fire is *not a blow*. It goes **through** the i-frames
  a body does have — a roll does not put a fire out, and neither does a respawn — and never shoves:
  a burn is a condition on the body, not a blow landing on it. It still breaks cover and the meal:
  you cannot lie hidden, or eat, while you are alight.
- **The tick's own damage type is `burn`, not `fire`** — otherwise the bite would relight the fire
  dealing it and nothing would ever go out.

Where fire comes from: the three **fire modifier bits**
([tools and bits](#tools-and-bits)) — FLAME, PYRE, CINDER BURST. Nothing else on the map is on fire:
the roosting eagle is an objective with its own damage path, not a unit, and takes no status at all.

## Prone: under the snow

**SNOW COVER — the HUNTER's key 4** — lies a player face-down in the snow and pulls it over them.
It is the game's only stealth, it belongs to one class, and once under it is paid for
entirely in speed; the way IN costs the ability's 60 s cooldown
([class abilities](#class-abilities-keys-1-4)), and every way back up is free. There is no
burrow key and no `input.prone` — the ability is the one door.

`tryProne(p)`/`risePlayer(p)` (the `prone` sub-banner of `actions`, js/actions.js) are the only two ways in and out —
`abSnowCover` (js/abilities.js) is the one caller of `tryProne` and refunds the clock when the
snow refuses. Going down
needs **both feet still** (`hypot(vx, vy) <= PRONE_ENTER`, 14 px/s — you cannot dive at a run),
not sliding, not mid-roll, and **snow underfoot**: a river has nothing to dig into, and the press
there is denied before the kneel even starts. Getting up happens on key 4 again, on the ambush
shot, on a `tryWork` E
press, on `tryDodge` (the fast way out, and it costs a charge), on any hit
(`damagePlayer` calls `risePlayer` before anything else), on falling through the ice, and on death.

### The one number

`p.hide` (0..1) is the whole state. It climbs at `1 / kit.bury` (starts at `PRONE_BURY` 1.5 s,
shortened by ambush ranks) while lying **still on
snow**, holds while crawling, decays fast off snow — a body dragged onto bare ice keeps the pose
but loses the cover, because the cover is the snow, not the posture — and is zeroed the instant
`risePlayer` runs. Two derived reads sit on top of it and **everything else in the game uses
those, never `p.hide` directly**:

- `concealOf(p)` = `hide`, discounted to `PRONE_MOVE` (×0.5) while `p.moving`. A crawling mound is
  worth half a still one, which is what makes "stop before you shoot" a real decision.
- `seenAt(p, range)` = the distance a watcher with plain sight `range` actually notices p from:
  `range × kit.stealth × (1 − PRONE_CUT × conceal)`, floored at `PRONE_SNIFF` (22 px) whenever
  there is any cover at all — **nothing hides at arm's length**. A bot's sight is its profile's
  (`AI_LEVELS`, js/ai-skill.js: EASY 120, NORMAL 147, HARD 200, IMPOSSIBLE 267 px), so full cover takes those to
  22 (the floor), 22, 28 and 37, and a tier-3 turret's 124 down to 22.

**Every watcher resolves through `seenAt`, and a new one must too.** Today's callers: a bot's
target pick and its roost-threat count (`aiNearestEnemy`, `aiSituation`, js/ai.js), a turret
(`turretMark`/`turretHolds`), a worker bot's quarry and the flag's reach (js/robots.js), prey
deciding to bolt (`updatePrey`), the eagle's gust (js/boot.js) and the CLICK scheme's lock and
acquire (js/input.js). A camp monster has no sight
to resolve, since a hit is its only trigger ([Camp monsters](#camp-monsters-neutral-until-hit)).
Both maps gate separately on `concealOf(p) >= PRONE_MAP` (0.55): a rival buried and still drops off
the minimap and the M map, and a rival *crawling* tops out at 0.5 and stays on both — moving puts
you back on their map before it puts you back in their sights.

### Crawling

`updatePlayer`'s movement block forces the plain direct-approach branch with
`walkMax = PRONE_SPEED` (20 px/s against a 72 px/s walk) on **any** surface — no ice cap, no
`chargeMul`, nothing to stack, and `inp.slide` is ignored (`wantSlide` requires `!p.prone`).
Rising costs `PRONE_RISE` (0.34 s) at 45% walk speed. Instead of footprints a crawl lays a **drag
furrow**: `k: 3` entries in the shared `footprints` array every 2 px, each storing the
perpendicular it was pushed with so the trough draws square to the path whichever way it went, two
deep so consecutive marks tile into one continuous line, with an elbow dimple to one side on every
other mark. It keeps the full 9 s footprint life — a trail worth following has to outlast the crawl
that made it — and it is the counterplay: a line like that leads straight to the mound at the end.

### The ambush shot

`ambushReady(p)` is `prone && hide >= 1 && !moving`: **full** cover, and dead still while it goes.
`fireTool` reads it before anything else can break the cover, multiplies the whole damage roll
(`emitBit`, js/tools.js: `(bit.dmg + kit.dmgPow × draw × 0.5 + kit.dmgBase + speed bonus + level)
× drawDmgMul`, then the modifiers) by `kit.ambushMul` (starts at `AMBUSH_MUL` 2.5, grown by ambush
ranks), tags the arrow `ambush: true`, and calls
`risePlayer` after the loose — one ambush per burrow, then you are a player lying in the open with
a bow that still has to be renocked. A level-1 HUNTER's full draw of the plain arrow (`dmg` 8) goes
17 → 43. A fish taken off the ice (`autoFish`) is not a shot: it never touches the tool and breaks
no cover.

Wherever the tagged arrow lands — player, worker bot or animal — `ambushFx()` puts a gold flare
over the ordinary hit puff and plays `SFX.ambush()`; `damagePlayer`'s `crit` argument doubles the
local shake.

### The tells

None of them is a word:

- **The body disappears.** `drawSnowCover` closes over the prone sprite **from the outside in** —
  boots and elbows first, the middle of the back last — so at 85% there is still a seam of coat
  showing down the spine. Row extents come from `spr.spans`, the per-row `[firstX, lastX]`
  [sprites.md](sprites.md) takes off the char grid at bake time, dilated a row into its neighbours
  so it is a drift rather than a traced outline; the finished mound is lit like every other drift
  here (white crest, shaded far side, dark rim under it doing the grounding a prone body's missing
  cast shadow would have done). Alpha is 1 for a rival, 0.85 for an ally and 0.66 for yourself, so
  **you can always see yourself under the snow** and nobody else can.
- **The overhead furniture fades with the cover** (`drawPlayer`) — name tag, health bar, stamina
  bar, level badge, and the draw meter that says a shot is coming. A rival keeps none of it. The
  whole stack also drops 6 rows with the pose, since a prone body starts that much lower in the
  same 16×16 cell.
- **The bury ring** (`drawBuryRing`, local player only) — twelve marks on a ring in the snow that
  light one at a time as the cover builds, then flash white and go. Each gets a dark pixel under
  it, because white on snow is white on white. A rival needs no meter: they can watch you vanish.
- **The reticle arms.** `cursorInfo` puts `amb` on every reticle it builds; `drawCursor` grows a
  second segment out along each of the crosshair's own axes and warms the centre pixel to gold —
  deliberately on the cross, where the renock's marks are on the diagonals.
- **Breath.** One timer on the player does two jobs, and which one says what state the body is in:
  while the cover is still building it throws up the snow being pulled over, and once it is
  finished it becomes a plume of breath every ~2 s. That, the mound itself and the furrow are the
  three things that keep "almost invisible" honest.

### Bots

A hunter bot casts it through the same ability key a human presses (`inp.ability = 3`) — rung 2
of the [ladder](multiplayer.md#bots), decided before the rest because two later rungs read
the answer; a warrior bot has no burrow to decide.

## Wildlife

`animals` holds **everything that is shot rather than swung at** — two kinds of prey, the camps' three wolves and the dormant bird, keyed by
`a.kind` with hp from `ANIMAL_HP`. The passive pair is spawned at boot by `spawnAnimals()`
(called right after `genWorld()`, so its `rng()` draws don't reshuffle the world layout) at
`PREY_POP` strength: 16 rabbits (8 HP) and 10 deer (24 HP). **Every rabbit lives in a warren**
([the SNOWDROP WARREN camps](world.md#camps)): `spawnPrey` puts a new one inside the clearing of
whichever warren holds fewest (`warrenFor`), and `a.meadow` remembers it (not `a.home`, which is a
camp monster's).
Neither reproduces, but **the meadow is restocked**: `updatePreyStock` (from `updatePlay`, never
under `PRACTICE`) puts one animal of the kind furthest under strength back every `PREY_REPOP`
(15 s) through `spawnPrey`, on a free tile no live player is within `PREY_CLEAR` (280 px — past
the edge of any screen at zoom 1) of, so nothing is ever seen to appear. The three wolf kinds
([their table](#camp-monsters-neutral-until-hit)) belong to a [camp](world.md#camps) instead — `a.home` points at it,
and the camp restocks them, all at once, once it is cleared. (**Birds**, 3 HP, are dormant: nothing spawns one.)

**Every animal wears a level** (`a.level`), the hero's plate on the left of its frame
([rendering.md](rendering.md#overhead-health-bars)), dealt once by `makeAnimal` from
`animalLevel()` — the **average hero level of the active players**, rounded, capped at
`LEVEL_MAX` — and never raised after: an animal does not level, the meadow does, as the ones
the eagle dropped you into (all level 1) are shot and restocked at whatever the table has
reached. What grows with it is hp, `ANIMAL_LV_HP` a level over `ANIMAL_HP` (rabbit +1, deer
+2; a level-6 pack is 45 hp a wolf), and a camp monster's bite (`MONSTER.lvBite`) — the wolves' numbers are in
[their table](#camp-monsters-neutral-until-hit).
**The kill pays for it**: `animalDies` grows the `YIELD` payout by `ANIMAL_LV_GOLD` (a tenth)
a level, rounded, before the HUNTSMAN bonus is taken off it — a level-6 rabbit is 15 gold, a
level-6 wolf 36, and a level-12 beast a little over twice its level-1 self, about what its hp
grew by. Gold is XP, so a richer meadow lifts the table that made it richer, but at a tenth a
level it is a slope, not a farm.

**The noticed mark.** An animal that has a player in sight wears a `!` over its head — the
`drawSenseMark` glyph in [rendering.md](rendering.md#overhead-health-bars), stamina white on
prey and threat red on a wolf — for as long as it does: `a.senseT` counts the seconds since it
first did and is 0 whenever it does not. For prey, "in sight" is a player inside the
`FLEE_SIGHT` ring (through `seenAt`, so cover keeps it down) **or a flight already under way**,
so a deer running wears the reason it is running and a deer that grazes on has not seen you; for
a camp monster it is a hunt in progress and nothing else — a leash bar still draining is still
a hunt — and the mark going out is the monster giving you up. The **body** says the same thing
at a distance where a `!` is a speck — see the clips below.

### What a beast is doing: the clips

A beast's animation is a named **clip** — a graze, a gallop, a
sit-up ([sprites.md](sprites.md)) — not a walk flag. `ANIM_CLIPS` (js/wildlife.js) is the whole of it: a row per kind naming the clips that
kind's `SPRITES` entry carries and the frames a second each runs at. `setClip(a, name)` puts a
beast in one and **restarts the loop**, so a sit-up always begins on the frame it was drawn to
begin on; `stepClip(a, dt, rate)` advances it, `rate` being the caller's own gait multiplier —
a wander is the same gallop run slower, not a second animation; and `clipFrame`
(js/draw/bodies.js) is the one thing that turns `a.clip` + `a.animT` into a canvas.

| kind | its clips | set by |
| --- | --- | --- |
| `rabbit` | `idle` low over its paws, `rise` up on its haunches, `hop` | `updatePrey` |
| `deer` | `graze` head down in the snow, `idle` head up and turning, `run` the gallop | `updatePrey` |
| `wolf` | `idle`, `run` | `updateCampMonster` |
| `alpha` / `dire` (the bears) | `idle`, `walk`, `run`, `bite`, `paw`, `roar`, `fish` | `updateCampMonster` |
| `bird` | `idle` perched, `fly` | `updateBird` |

**The head is the tell.** Standing still and settled, a deer's head is DOWN in the snow and a
rabbit is low over its paws; standing still and *wary*, the deer's head is up and turning and
the rabbit is rocked back on its haunches. So **a grazing deer is a deer that has not seen
you** — the fact the `!` carries, said by the body, at a range where the mark is a speck. It is
what makes closing on one under GHOSTSTEP or buried in the snow visibly worth doing.

Wary is `a.wary`, held at `PREY_WARY_T` (3 s) whenever a player is in sight or a flight is
under way and decaying otherwise. It is deliberately softer than `a.senseT`, which snaps to 0:
the mark goes out the instant the animal loses you, the head stays up a moment longer, and a
deer that has just been run **stands and watches before it grazes again**. It costs nothing —
no speed, no sight, no bolt of its own.

**A rabbit sits up before it goes.** `RABBIT_ALERT` (0.3 s): the first time a rabbit notices a
player it rocks onto its haunches and **holds** — no walk, no flight — and only then bolts. It
is the one still shot a hunter is ever offered at one. A **hit** skips it
(`hurtAnimal` clears `alertT`), so a rabbit already running never stops to pose; a stun clears
it with everything else; and the jink still fires out of it, because `arrowAtRabbit` is read
before the beat is.

`updateAnimal()` is the shared shell: it ages the flash and knockback, runs
`updateUnitStatus` (the shared clock — root, slow, net, mark, fire), dispatches to
`updatePrey` / `updateCampMonster` / `updateBird`, clamps to the world, and calls `animalDies(a)` — the
one place a kill pays out, straight from the `YIELD` table. Everything in `animals` is a target
for arrows (the disc `animalHitR` about `animalHitY`: the arrow update sweeps it, the aim line asks
`animalHit`), gets the amber
hunt reticle, and joins the y-sorted draws.

**An animal is a unit like any other.** `makeAnimal` hands every kind the full status set through
`clearUnitStatus`, so a rabbit, a deer, a wolf and a bird take the same damage and the same six
states from every ability and every bit that a player does — rooted, netted, slowed, marked,
stunned, set alight — and wear the same tells at their own size
([status effects](#status-effects-one-set-for-every-unit)). Nothing about wildlife is exempted
anywhere; what makes them everybody's target rather than nobody's is simply that they carry no
`team`, which `unitFoe` reads as neutral. **A new kind of neutral fauna pushed into `animals` gets
all of it for free** — the checklist for one is in
[checklists.md](checklists.md#common-changes) ("Adding a kind of unit").

Prey behaviour lives in `updatePrey()`, and **every step of it is a routed goal** — grazing
included, which is what keeps the `.` overlay honest ([rendering.md](rendering.md#routes)).

- **Grazing.** Idle, then pick one goal and walk it. `wanderGoal(a, base, spread, near, far)`
  tries 8 tiles in an arc, takes the first it can actually route to, and returns `null` when the
  animal is boxed in (the caller just idles and picks again). `preyWander` is the per-kind
  chooser: a rabbit out past its warren's clearing (`r - 1` tiles from the centre) hops back
  toward the middle, and inside it takes short 1–3 tile hops, so the warren reads as theirs; a
  deer takes an open direction, 3–6 tiles. A rabbit runs on the deep snow's crust (`wadeStep`
  never slows one). `navStep` walks it at
  `PREY_SPD`, and arriving (or `ok === false`) drops the goal and idles. The walk wears the
  `hop` / `run` clip at 0.6 rate — the same gait as a flight, taken lazily — and the idle at
  the end of it is where a settled deer's head actually goes down.
- **Bolting.** Both species flee, on `FLEE_SIGHT` / `FLEE_TIME`: a rabbit sits tight and goes
  at 26 px, a deer watches wider and runs longer at 46 px. The trigger asks
  **`seenAt(p, FLEE_SIGHT[kind])`**, not raw distance, so GHOSTSTEP and lying buried in the snow
  are how a hunter closes on a deer at all — measured, full cover collapses a deer's ring from 46
  to `PRONE_SNIFF` (22), and inside *that* it bolts no matter what you are lying under. A hit
  also sends either species running from the nearest player (`fleeT`).
- **The flight** is a chain of routed legs at `PREY_RUN`: `fleeGoal(a, from)` picks a tile ~6
  tiles off, as straight away from the threat as the ground allows (fanning out, then sideways,
  then past it), the first it can route to; a leg that arrives or fails hands over to the next,
  and an animal with nowhere to run stops fleeing.
- **A deer's sprint.** A deer always wears a second bar under its health — stamina white
  (`STAM_COL`), stacked the way a player's is (`drawAnimal`) — and spends it on the first stretch
  of every flight: while `a.sprint` (0..1) is above zero the legs run at `DEER_SPRINT` and the bar
  drains over `DEER_SPRINT_T` (2.5 s of running); empty, the flight drops to `PREY_RUN.deer`, its
  walk. Both paces are multiples of a player's walk, tuned in one place — `DEER_RUN_MUL` (1.4,
  101 px/s) and `DEER_WALK_MUL` (1.15, 83 px/s), the px/s consts derived from them — so a deer
  outpaces a walking scout either way and the empty bar is when a roll, a slide or an arrow closes
  the gap. It refills over `DEER_SPRINT_REGEN` (10 s) whenever the deer is not fleeing, so the bar
  is the hunt's read: a full one means the deer will simply leave, a low one means run it again now.
- **A deer never jumps pace.** `a.spd` is the speed it is at, and `deerPace(a, want, dt)` closes
  it on the one it wants by an exponential of `dt` — an ease-out, the same curve at any step
  length, there within 2% after `DEER_EASE_T` (0.28 s): the startle from a standstill to the run,
  the drop to the walk when the bar empties, the graze, and the stop, where the idle branch
  coasts the body along its last heading until the pace is spent. A stun zeroes it. The gallop
  clip's rate follows `a.spd` too, so the legs wind up and down with the body.
- **A rabbit's jink.** A rabbit wears the same white bar (`a.dodge`, 0..1), but it is one
  **dodge charge**, ready only when full. `arrowAtRabbit` looks at every shot in flight each step:
  one inside `RABBIT_DODGE_SIGHT` (90 px), still flying *toward* the rabbit, on a line that passes
  within `RABBIT_DODGE_MISS` (14 px) of its body, is a shot coming at it, and `rabbitDodge` spends
  the charge on a hand-steered dash straight off that line — sideways, to the side the body already
  leans to (the other if that one is a wall, `navLineClear`), at `RABBIT_DODGE_SPD` (260 px/s) for
  `RABBIT_DODGE_T` (0.11 s, ~29 px, clear of the 8 px disc `animalHit` tests) — and then an ordinary
  bolt (`fleeT`) away from the shooter: the zig, then the zag. The charge comes back over
  `RABBIT_DODGE_CD` (10 s) whatever the rabbit is doing, so an empty bar is the read that the
  next arrow lands; a rooted or netted rabbit never spends it. A shot already past or flying
  wide is nothing to it, and a stun drops a dash mid-jink like any other move.

A kill pays its `YIELD` gold, grown a tenth a level for the animal's level (`ANIMAL_LV_GOLD`,
above), straight to whoever landed the final blow (`a.lastHit`, through
`awardGold` — see [Economy](#economy-one-currency)); rabbits also drop 1 berry as a physical
pickup, and one in four (`TUN_DROP`) a [burrow](#the-burrow-a-tunnel-anyone-can-ride), and a burn credits the player that lit it, so an animal that walks away and dies of its
fire still pays. Shots, rolls and the class abilities are what hurt them (there is no
melee — the E swing is for scenery, never for a body); animals are solid
to players, robots and each other except birds, which fly (see
[Unit collisions](#unit-collisions)), and sprites are side-view only (`dir` is `left|right`).
They are not shown on the minimap or world map.

### Camp monsters: neutral until hit

The [camps](world.md#camps) keep three kinds — the **wolf** (a den's 4), the **black bear**
(`alpha`, BLUE's river camp, 1) and the **brown bear** (`dire`, RED's river camp, 1) — one `MONSTER`
row each (wildlife.js: the bite and what it grows a level, the reach, the seconds between one
body's bites, the hunting speed, the body's radius and mass, `big` for a bear's big body, and
`cause`, the death line a bite writes). The kind keys are the old wolves' and stay so saves
still load. All three run
`updateCampMonster()`:

- **Neutral.** There is no sight and no threat bar filling on a linger: a player can stand at
  the mouth of a den, or beside a fishing bear, and nothing happens. **A hit is the whole trigger** — an arrow, a roll, a
  stomp, anything through `hurtUnit` — and it wakes the *camp*: `wakeCamp(w, hitter)` hands the
  hitter to every monster of the same camp at a full leash bar. A bear that was not already
  hunting plays its `roar` clip, planted, for `BEAR_ROAR_FRAMES`, and the camp gives `SFX.roar()`
  (the `roar` sample, a low bear roar about as long as the clip); a pack that wakes gives
  `SFX.howl()`. A camp already on a hunt is silent however often it is hit, and a hit does not
  re-aim it.
- **The nearest body.** Awake, each monster goes for whoever is nearest (`campQuarry`): any
  living, landed player on the camp's ground inside `CAMP_SEE` (9 tiles, shortened by `seenAt`
  for the hidden). It turns only between blows, never mid-attack or mid-roar, and only to a body
  `CAMP_SWITCH` (a tile) nearer than its quarry, so two side by side never make it dither. So it
  never runs past one player to reach another, and whoever stands closest is tanking it.
- **The leash bar.** `a.threat` (0..1) is the red bar hung under the health bar the way a
  player's stamina is (`THREAT_COL`, `drawAnimal`; bare track at rest). It holds full while
  the quarry is on the camp's **ground** — `CAMP_GROUND` (7) tiles past the camp's `r`, or past
  a river camp's bank band (`campNear`, [world.md](world.md#river-camps)) — and
  drains over `CAMP_LEASH_T` (3 s) anywhere off it, with the monster at your heels or not; it
  keeps coming while the bar drains and the hunt ends only when the bar is empty. Then it walks
  home and **heals**: a monster with nobody to hunt mends from nothing to full over
  `CAMP_REGEN_T` (6 s), so a fight you break off is a fight reset, never a chip-away. A quarry
  that dies or boards its eagle hands the hunt straight on to the nearest player on the ground;
  with nobody there the hunt is over.
- **The chase.** The kind's `spd` (the table below) is faster than the 72 px/s walk and slower
  than a slide, so the answer is the momentum system, not
  distance; every one routes around trees and water ([Pathfinding](#pathfinding)), and a quarry
  it cannot route to (out on a hole) it holds and faces. Bites do the row's `bite` plus `lvBite`
  for every level past the monster's first, inside `reach`, every `cd` seconds *per body*,
  through `damagePlayer(t, dmg, dx, dy, null, cause)` — `'wolf'` (`WENT TO THE WOLVES`) for the
  pack, `'bear'` (`MET A BEAR`) for either bear. **A bear's blow is telegraphed**: in reach it
  plays one of its attacks, on all fours and planted: the `bite` (coil, jaw wide, lunge, snap) or
  the `paw` (paw cocked over the head, swept out flat in front), taken in turn (`BEAR_ATTACKS`,
  `a.atkN`) so two blows in a row never look alike. The blow (`monsterBite`) lands only as the clip
  crosses `BEAR_STRIKE`. **A blow once begun is committed**, like a moba's auto attack: nothing but a
  stun cuts it, the bear turns with its quarry through the wind-up, and the blow lands on that quarry
  anywhere inside `reach × BEAR_COMMIT_REACH` (44 px) - walking away does not dodge it, a roll or a
  dash does. The wind-up is the tell. Only the wake-up `roar` stands the bear on its hinds. A bear walks its patrol on `walk` and gallops the hunt on
  `run`, and moves through the tiles on its `foot` box (5), not its 9 px body, which is wider
  than a tile and jammed on the first tree beside its route. **Nothing caps the
  pack** ([i-frames](#i-frames-only-something-deliberate-grants-them)):
  four wolves on you is four bites a second, ~36 hp/s at level 1. `cd` is the only dial on it.
- **Off duty** it patrols its camp on routed legs from the same `wanderGoal` the prey graze with
  (2–5 tiles); once it drifts past `r * 0.8` the arc narrows to 0.5 rad straight back at the
  camp, so the only way it will walk out there is home. Taking a quarry drops the patrol goal.
  **A bear walks its river instead** (`riverLeg`): legs of `RIVER_LEG` (3–7) points along its
  bank (`C.path`), turning at either end, back to the nearest point first when a hunt left it off
  the bank. `RIVER_FISH_P` (0.6) of legs end in a stop to **fish**: it faces the water for
  `RIVER_FISH_WAIT` (1.4–3.2 s), then plays its own `fish` clip (`BEAR_FISH_FRAMES`): paw up over
  the water, a scoop that flips a fish into the air, the snap that catches it and the chewing. The
  fish is drawn in the frames; on the scoop (`BEAR_FISH_STRIKE`) `riverFish` splashes the water at
  the edge (a burst and `SFX.splash`). A hit mid-catch drops it at once for the hunt.
  A hit mid-fish wakes it as anywhere else; the fish can wait.
  The noticed mark (`a.senseT`) is worn on a hunt and nothing else.

| Kind | hp (+ a level) | bite (+ a level) | reach / cd / spd | body | kill |
| --- | --- | --- | --- | --- | --- |
| wolf | 30 (+3) | 9 (+1) | 13 px / 1 s / 96 | r 4.5, mass 2, a roll passes through | `YIELD.wolf` 24 |
| alpha (black bear) | 640 (+50) | 22 (+3) | 22 px / 1.4 s / 100 | r 9, mass 5, a big body a roll **tackles** | `YIELD.alpha` 90, `EPIC_TEAM_GOLD` (40) to every teammate on the ground, the whole team blooded, a feed line |
| dire (brown bear) | 640 (+50) | 22 (+3) | 22 px / 1.4 s / 100 | r 9, mass 5, a big body a roll **tackles** | `YIELD.dire` 90, `EPIC_TEAM_GOLD` (40) to every teammate on the ground, the whole team blooded, a feed line |

The two bears are the two midline camps' kinds (`teamPay` in their `MONSTER` rows), and
[the creek](world.md#the-creek) bends so each side owns one: they are one fight in two coats,
the same row, the same hp and the same pay. Every payout grows `ANIMAL_LV_GOLD` a level like any
kill ([Wildlife](#wildlife)). The teammate share goes through `awardGold` at each teammate's own feet (so a bot's gear purchase can
eat it the same tick — the XP is what is guaranteed), to every active teammate who is not dead
or in the air; the blood goes to every active teammate regardless.

**ALPHA'S BLOOD** (`campBuff(p, t)`, the constants above the `camp monsters` banner): `p.buffT`
seconds during which every blow the player lands is `CAMP_BUFF_DMG` (×1.25, applied in
`hurtUnit` — a shot, a roll and a stomp alike) and the walk is `CAMP_BUFF_SPD` (×1.15, in
`abilityMoveMul`). Either midline kill bloods the killer's whole team for `CAMP_BUFF_EPIC_T`
(120 s), and a fresh grant only ever extends what is left. It is worn as an
**amber ring of twelve pips around the feet** (`drawBuffRing`, js/draw/bodies.js) that loses a pip
at a time as it runs out — the ring is the timer, a full ring on a rival is the warning — and it
goes out with the body on death. There is no HUD element for it: the ring is the read.

**Bots and camps.** A bot fights a camp that is already hunting it (`aiNearestWolf` answers
a monster whose `target` is that bot, inside `AI_SIGHT`) — and an **ally** also fights one hunting
anybody on its side inside `AI_ANCHOR_R` of the human, noticed from `AI_ANCHOR_D`, walking in to
its own range first, unless its own bird is under threat: the human is the camp fight's anchor
the way it is a rival's ([Bots](multiplayer.md#bots), rung 4), so a bear you wake is one
your side comes to. It is *anybody on its side* because the camp turns to whoever is nearest, and the
helpers must not drop out when one of them walks in and takes it off you. A bot will pull a den on its own through
the hunt rung like any other animal, and never a bear (`teamPay`), which a
lone bot would die to. No bot walks *to* a camp deliberately yet — see
[checklists.md](checklists.md#known-drift).

### Birds: the flock (dormant)

The bird kind — `updateBird()`, `flushBirds(L, from)`, `rookeryPerch(L)`, `drawBird`, the
`BIRD_*` constants, `YIELD.bird` — is intact but **nothing spawns one**
([Intentional dead code](checklists.md#intentional-dead-code)). What the code does if one exists: a flock perched in a
stand's snags is put up all at once by any player inside `BIRD_FLUSH` (34 px), an arrow, or a snag
being chopped, flies at `BIRD_SPD` (112 px/s) and returns to a perch; `a.alt` (`BIRD_ALT` 15
perched) is the only height in the game, subtracted by `animalHitY` and the cursor, skipped by
`separateUnits`. A camp that wants a flock stands one up with
`props` of `deadTree` and a spawn that perches birds on them (`rookeryPerch`).

## Economy (one currency)

Every player owns a wallet **and** a bag. `p.inv` is `{ gold }` — currency only, no ceiling —
while everything you *carry* lives in `p.bag`, the slot array described in
[Inventory and the backpack](#inventory-and-the-backpack). (`inv` is an alias for the local
player's wallet.) **Gold is the only currency.** The one other thing the world pays out is
**ore**, which only a mined rock gives up and which is carried in the bag
([Mining a rock](#mining-a-rock)); berries/fish are consumables ([Food](#food-the-meal-is-a-channel)), never spent on anything. The whole economy is the
`YIELD` table in the constants banner of [js/core.js](../../js/core.js) - the one tuning table
with no single owner - which gives every source a different **yield profile**
rather than a different resource (the League model: one number, many ways to earn it):

| Source | Pays | Profile |
| --- | --- | --- |
| the clock | `TRICKLE_GOLD` (1) every `TRICKLE_T` (4 s) — the `passive income` banner, js/sim.js | 15 a minute to every player on the ground, silently (no floater, no blip); the floor under everyone's purse and the pace a level comes at for a player who never farms |
| tree (`TREE_HP` 3, js/world.js) | `treeFall` 1 on the fell (`treeHit` is 0 — a swing is work, the fell is the pay) | slow, safe, everywhere — a pine a second chained, so a gold a second is the ceiling of full-time farming; leaves a stump, and 1 in 25 leaves a tier-0 [find](#where-tools-and-bits-come-from) |
| dead tree (3 hp) | `deadTreeFall` 1 | a tree; none stand since 4.82 (the brown bear's ring went with its den) |
| rare tree (8%) | + `treeRare` 3 → 4 | jackpot roll, see `treeRare()` |
| rock | its kind's `gold` (`ROCK_KINDS`, js/mining.js): STONE 3, FROSTGLASS SPIRE 8, SUNSTONE 20 | 2 / 3 / 4 s of standing by it, paid with **ore** besides and a roll at a find; it regrows ([Mining a rock](#mining-a-rock)) |
| rabbit | `rabbit` 2 coins × 5 → 10 (+1 berry) | bolts when approached; jinks one shot per 10 s |
| deer | `deer` 3 coins × 6 → 18 | the big mobile target |
| wolf | `wolf` 3 coins × 8 → 24 | a den's four; neutral until hit, and then the pack bites back |
| black bear | `alpha` 6 coins × 15 → 90 | BLUE's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the whole team blooded |
| brown bear | `dire` 6 coins × 15 → 90 | RED's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the whole team blooded |
| bird | `bird` 2 coins × 4 → 8 | dormant: nothing spawns one |
| generator | `tiers[tier].pay` every `period` s: 1/15, 1/7.5, 2/9 — 4 / 8 / 13.3 a minute, so an upgrade pays back (6.25 and 8.4 min) between the ramp's new builds | passive income, deposited to its owner; each one its owner already has makes the next cost 1.5x (`ramp`, `buildCost`), so a farm of them stops paying back |
| chest | `CHEST_GOLD_MIN`–`MAX` (8–20) + a card, and 3 in 4 a tool or bit of any tier | ~14 caches along the treeline, one free E press — the world's one source of cards, and with the SUNSTONE the only [find](#where-tools-and-bits-come-from) that can be top-tier |
| a sale at [the counter](#the-merchants-counter) | half a made thing's price, or the live market price for fish and berries | the one payout that is **not** XP (`tradeGold`) — a trade is an exchange, not a source, and the counter buys food at the price it sells it |

The table is sized so that a
player chaining pines nonstop earns about a gold a second, the trickle is a quarter of that,
and the animals, chests, kills and rocks are where the rest comes from ([hero
levels](multiplayer.md#hero-levels) are sized against the same rate — raise a fell and the
bots hit the level cap early). PACKMULE and the
FORAGER card multiply the fell (`harvestMul`, +25% a level and +50%; the payout rounds).

**Gold is never a physical drop.** Every source pays the earner on the spot through
`awardGold(p, n, x, y)` (`players` banner, js/player.js, beside `gainGold` — which it wraps, so
every payout is also XP, see [Hero levels](multiplayer.md#hero-levels)): the `+N` floater rises
at the place the action happened (the tree, the kill, the wreck), and the local earner gets the
coin blip. Who earns is always the actor: the swinger of the blow, the final-blow shooter of an
animal or a loaded worker bot (its `b.carry` goes to whoever downed it), the breaker of an enemy
building (the 50% wreck refund, same as a demolishing owner's), the killer of a player (a flat
`KILL_BOUNTY` of 12 from nowhere — the victim's own purse is untouched, and an uncredited death
pays nobody), and a
generator's **owner**, into whose wallet each `pay` tick deposits directly. Robots carry a
single gold number (`b.carry`) and deposit at 8+ into their owner's wallet.

**Treasure chests** are the free-money exception to earning it: `placeChests()`
([world.md](world.md#treasure-chests)) swaps ~14 inner-edge border trees for chests, and one E
press (`OPEN`, no tool gate) springs one — `CHEST_GOLD_MIN`–`CHEST_GOLD_MAX` gold straight to
the purse plus one unopened card drop rolled from `CHEST_ODDS` (rarity odds beside the other
chest constants in js/world.js). The chest's tile opens with it.

Physical drops exist for everything **carried**: `spawnDrop(x, y, type, n)` takes the
value of the drop (`d.n`, default 1) and the pickup adds what fits through `bagAdd`, floating
that number in `RES_COLORS[type]`. It **returns the drop** it made, which is what lets a
deliberate throw give it a heading and a lock on top (`flingDrop`/`lockDrop`, js/core.js). **Whatever was taken comes off `d.n`, and the drop is only
removed when `d.n` hits zero** — that is what lets a stack of 5 bits half-fill a bag and
leave 3 lying in the snow. A drop's `type` is always an `ITEMS` key: sources pay `berry` and
the card rarities, a caught fish goes straight into the pouch (taken by `autoFish`, or handed over by a
[fish net](world.md#fish-nets) you are standing on), and a wrecked net's
contents carry `fish` too (`SPRITES.itemFish` in the drop draw pass). Gold, berries and fish all read on
the **hud strip's right end** (bottom centre) — the pouch block, berry over fish and gold over
cards with the burrow past them, on screen all match. Death touches none of them —
see [Death and respawn](#death-and-respawn). Drops are neutral: they drift
toward the nearest player, and everyone standing on one contests it
(`canAfford`/`pay` also take the player whose wallet is meant) — except that a player with **no
room** for a drop is neither magnetised by it nor a claimant, so a full bag hands the pickup to
whoever else is standing there instead of sitting on it, and standing alone on something you
cannot carry fires the [refusal tell](#inventory-and-the-backpack) rather than eating it. Food is
outside all of that: the pouch has no ceiling, so a berry is never left in the snow.

Two things bend "no room" and "everyone standing on one". A drop inside its
[throw lock](#the-weapon-shelf) is neither magnetised by nor claimable by **the one player who
threw it** — and raises no refusal for them either, since standing on something you meant to put
down is not a denial; it draws at half alpha with its tier glint off for that player alone, and
comes back to life when the three seconds are up. And a body that would
[swap for the tool in hand](#where-tools-and-bits-come-from) counts as room whatever the pack
holds, because that pickup is an exchange.

## The merchant's counter

**Each eagle's merchant keeps a shop, and both shops serve everybody.** Walk up to either team's
**stall** (the market stall its [merchant](#the-merchant) pitches beside the spur's head) or to the
merchant itself, press **E**, and the counter opens — the **SHOP**: twelve
offers rolled off the tool, bit and card pools, a **sell strip** anything in the pack can be
dragged onto with a **SELL ALL** button at its end, a live **fish and berry market**, and a
[restock road](#the-restock-road) counting down to the next turnover. The whole feature is
[js/ui/shop.js](../../js/ui/shop.js) — the `market`, `the counter's stock`, `buying and selling` and
`the shop panel` banners. Two tab plates beside the portrait turn the same slab to its other face,
[the FORGE](#the-forge), where ore takes a weapon up a level.

The post is the **shop**; the MARKET is one corner of it, under its own rule on the panel, and it
is the only corner whose prices move. That is why the slab is not itself called a market —
everything above that rule is priced once, on its own def.

Your own roost's merchant is the near one; the rival's is a walk through their base and sells the
same twelve things, because there is **one market and two shopfronts onto it**. That is also why a
merchant **cannot be killed**: `unitAlive` (js/actions.js) answers false for one (the
[CLAUDE.md](../../CLAUDE.md) picker rule). It has no `hp` field
at all and draws no health bar.

### Opening it

`merchNear(p)` is the resolver — the nearest **counter** within `SHOP_REACH` (34 px) of a body,
either team's, where a counter is a merchant's body or its stall (`stallUp`), each measured by
`counterDist` (from the body itself, or from the nearest edge of the stall's footprint, so its back
and sides count as well as its front; the cap and a click's walk go to `counterPt`, the middle of
the stall's front edge) — and the `E SHOP` cap over it (`drawShopHint`, js/ui/wheel.js) is the same proximity
prompt the practice armory's `E ARM` uses. **A merchant in reach owns E outright**: unlike the
armory, the roll die and the bell — which all stand aside for a real
[work target](#the-swing-tools-e) — the counter is taken *first*, ahead of the swing and ahead of
everything else the key does (`keyPress`, js/input.js). It has to be: the merchant fells trees for
a living and loiters among them, so there is very often a trunk one tile off the counter, and a
swing that outranked the counter would leave the shop unopenable under its own `E SHOP` cap.
One rule answers in all three places: the press, the cap, and whether the
cursor's [lock ring](rendering.md#cursor) promises a swing. The counter is a **panel, not a held wheel**:
the press opens it and E, Escape, the X or **walking out of reach** shuts it (`updateMarket`
re-checks `inReach` every step). It is HUD like the pack and the character sheet — **the sim runs
on underneath, and standing at a counter protects nobody**.

The **backpack** is already up beside it, because a sale is a drag out of the grid; the character
sheet closes, since the two slabs would sit on each other.
While it is up, E does not swing at the world (`sampleHumanInput`), the way a wheel already
swallows it.

**The frame goes under a wash while the counter is open** (`shopScrim`, `SHOP_WASH`), and exactly
four things stay lit above it — the ones a trade is made of: **the counter**, **the corner** (the
weapon shelf and the pack drawer a sale is dragged out of), **the item on the cursor**, and **the
[tooltip](rendering.md#the-hover-tooltip)** pricing whatever the pointer is on. The minimap, the
hud strip and the world all go under. The mechanism is the draw ORDER in `renderUI` (js/ui/compose.js) and
not the panel: a panel cannot dim what is drawn after it, so the minimap and the strip are drawn,
then the wash, then the corner and the slab — which is why the corner is drawn in two places
there. Everything painted after that block — the market's plates, the tooltip —
is above the wash by arriving late.

**The post has its own song.** `openShop` calls `SFX.music.hold('village', …)` — FOREST VILLAGE
LOOP, which loops for exactly as long as the counter is open — and `closeShop` calls
`SFX.music.release()`. A hold notes what was playing **and the second it had reached**, and the
release puts that track back at that second, so a trip to the shop costs the match's own track the
bars it covered rather than the whole song. Any ordinary `music.play`/`music.stop` in between
clears the hold, so a track that takes the layer for its own reason — a victory, the lobby — can
never be undone by a release arriving after it. See the `music` banner, js/audio.js.

The merchant **stands still and faces you** while a counter is open on its own body (`shopServing`,
read by `updateMerchant`): it drops the bays, the felling and the loiter for as long as the sale
takes. A counter open at the **stall** holds nobody, so its keeper goes on working. It is gated on
the OPEN PANEL rather than on proximity because everybody lands at the roost together, and a
merchant that stopped for anyone standing near it would never raise its stall.

### The forge

The counter's second face (the anvil tab; `state.shopTab`, the `the forge tab` banner of
[js/ui/forge.js](../../js/ui/forge.js)) swaps the stock, the market and the sell strip for one
bench, and the rules live beside the ore in the `the forge` banner of
[js/mining.js](../../js/mining.js). **It is a dump, not a recipe**: any ore, in any amount and any
order, goes into a weapon as forge points (`FORGE_PTS`: IRONSTONE 1, FROSTGLASS 4, SUNSTONE 15),
the points fill the weapon's bar, and each time it fills the weapon is a level up and the next
bar is `FORGE_NEED_UP` (3) longer (`forgeNeed`: 5, 8, 11, 14...; `forgeCum` is the total). There is
no top level. The points are `fp` on the weapon's own cell beside `bits`, so they go wherever the
tool goes — the shelf, the pack, the snow, the wire, a save — and a rebuilt tool would lose them;
the level is always read off them (`toolLvl`). A weapon from the fixed-recipe forge carries a bare
`lvl`, which `toolFp` reads as the points that level costs.

**What a level adds tapers** (`forgeSum`: each level adds `FORGE_TAPER`, 0.9, of what the one
before it added), so a pile of five hundred stones makes a weapon strong and never absurd:
damage into the press's envelope before any fitting (`toolPlan`, and the PIERCING SHOT's
`pierceMods`), and some of the body's `up` stat — cycle off an `rof` body, weight on a `tensile`
one.

| level | points in all | damage | `rof` cycle | `tensile` |
| --- | --- | --- | --- | --- |
| +5 | 55 | ×1.25 | ×0.84 | +4 |
| +10 | 185 | ×1.39 | ×0.74 | +7 |
| +17 | 493 | ×1.50 | ×0.67 | +8 |
| limit | | ×1.60 (`FORGE_DMG` 6% first) | ×0.60 (`FORGE_ROF` 4% first) | +10 (`FORGE_TENSILE` 1 first) |

A forged weapon sells for its points as well as its body (`forgeWorth`, `FORGE_GOLD` 2 a point,
in `cellValue`), so nothing spent at the bench is quietly lost at the sell strip.

**The bench**, left to right: the WEAPON well, the PILE well (each kind in it as a stacked icon
with its count), and the preview (the level and the two numbers the pile moves, old > new) over
the plate that forges it, which carries the pile's points — green when it will take, dark when it
will not. Under the wells runs the weapon's FORGE BAR: its points toward the next level, the
pile's share lit green on top (the whole bar green when the pile levels it), the level at each end
and the points in the middle. Under the bench, one ORE plate per kind: what a piece is worth, and
in the pile / carried. The pile fills by a **drag** of a stack onto the pile well or its kind's
plate (`forgeDrop`, from `dragDrop`), a **click** on an ore stack in the pack while this face is up
(`forgePut`, from `sendBagCell`), a click on a kind's plate (all of it in, or out again) or a click
on the pile well (every ore you carry in, or the pile emptied); the weapon well fills by the same
drag and click, and its own click steps through what you carry. Nothing leaves the pack for
either: the weapon well holds a pointer to the cell (`state.forgeSel`, found again each frame, by
the cell or by where it was and what it is for a client whose pack the snapshot rebuilds) and
the pile only counts (`state.forgePile`, clamped to what you carry every frame by
`forgePileNow`). Both are this screen's and stay out of a save (`SAVE_STATE_SKIP`, js/save.js).
The plate sends `input.cmd` `{kind: 'shop', act: 'forge', where, i, pile}`, and `forgeTool`
re-checks the reach and that every count is whole and carried (`forgeReady`), spends the pile
(`bagTake`) and adds its points. The bots do not forge.

A forged weapon wears `+N` in the forge's colour (`FORGE_INK`) on its well's top-left corner —
the shelf, the pack, the bench (`forgeMark`) — and its tooltip title carries it too, with the
forged numbers in that colour.

### The stock, and what it costs

**Every tool, bit and card has a gold price on its own def**: `price` on the `TOOLS` and
`BITS` entries (js/tools.js) and `CARD_PRICE` by rarity (js/player.js). A card is priced by rarity and
not per entry because the rarity is what changes hands — the [pick of three](#roguelike-cards)
inside it is drawn afterwards, so the buyer is paying for the odds.

| section | offers | rolled from |
| --- | --- | --- |
| TOOLS | 3 | every key in `TOOLS`, distinct |
| BITS | 3 | the `proj` bits, distinct |
| MODIFIERS | 3 | the `proj: false` bits, distinct |
| CARDS | 3 | `rollCardRarity(SHOP_CARD_ODDS)` — kinder than a chest's `CHEST_ODDS`, since a counter you chose to walk to should beat a box you tripped over |

**An offer is a single item**: buying it empties its well (its `market.stock` entry goes `null`,
drawn as a flat empty well that takes no click) until the counter turns over, every
`SHOP_RESTOCK` (120 s), and the new shipment fills all twelve again — announced in the feed, on a
plate under the minimap and over a cue of its own (below), and counted down by the
[restock road](#the-restock-road) along the slab's bottom rail. The stock is shared by both
counters and every player, so a buy is [contested](multiplayer.md#contested-orders) on its well
(`shop:<section>:<i>`): two buyers in one step get one winner and the loser keeps its gold. That is
what makes the clock matter: what is on the counter is gone once somebody gets there first.

Everything rolls on `mktRng`, the market's **own** stream seeded off `SEED` (the chests' `chRng`
pattern): the same seed is the same market on every machine, and a busy shop can never shift a loot
roll by consuming draws out of the shared stream.

**Buying** goes through `input.cmd = { kind: 'shop', … }` → `runCmd` → `shopBuy`, the path
[gear](#gear) already uses, so a bot could buy tomorrow without a second code path; it re-validates
its own reach the way `buyGear` re-validates its cost, and it checks **bag room before it takes
the money**, so nothing is ever paid for that cannot be carried. Bots do not shop yet.

**Selling** is a **drag**: pick a cell out of the grid and let go anywhere on the sell strip
(`shopDropSell`, reached from `dragDrop`). The whole cell goes — an instanced tool cannot be
split — and **a loaded tool sells with its bits**, at half of each, so nothing is ever quietly
emptied for gold (`cellValue` → `sellValue`). Made goods fetch **half** their asking price; that
margin is the whole reason looting still beats shopping. Unlike the buys, a sale resolves on the
spot rather than through `input.cmd`: what is on the cursor is out of the bag already, and a
command the sim might drop that frame (pause, the chart) would take the item with it.

**Or all of it at once.** The **SELL ALL** button at the strip's right end (`shopSellAll`) puts
the whole pack over the counter in one press — for `packValue(p)`, what the drawer is worth right
now, printed on the button itself. **What it takes is the BAG, and the bag's own boundaries are
the whole rule**: the two meals and the unopened cards are in the pouch
([`p.food`](#inventory-and-the-backpack)) and take no cell, and the tool in hand with the bits
fitted into it is on the shelf (`p.tools`),
so **what the press cannot reach is exactly what is being carried on purpose** — no exclusion list
had to be written, and one cannot rot. It resolves as **one** sale, not twelve: one payment, one
floater, one coin, because it is one decision. Unlike the drag it goes through `input.cmd` like
the buys — nothing is on the cursor for a dropped command to take with it — and an empty pack is
refused with the ordinary deny. A **release** on it, rather than a click, sells the carried cell
like the rest of the strip: with an item in hand the strip is one full-width target and only
becomes two controls once your hand is empty.

**A sale pays gold but no XP** — `tradeGold`, the one documented exception to the `gainGold`
rule in [CLAUDE.md](../../CLAUDE.md).

### The fish and berry market

**Fish and berries have a price that moves, and they are the only two things in the game that do.**
`GOODS` (js/ui/shop.js) is the whole table: `base` is what a thing is worth when nothing is
happening, `min`/`max` are rails it can never leave, `vol` is the ordinary step and `shock`
the chance a step is a **lurch** instead — straight to `lo` or `hi` of where it stood.

| good | base | rails | ordinary step | lurch |
| --- | --- | --- | --- | --- |
| FISH | 18 | 5–60 | ±13% | 5% of steps, ×0.62 or ×1.7 |
| BERRIES | 4 | 1–15 | ±11% | 4% of steps, ×0.66 or ×1.6 |

Fish are the money good and berries the small change — a fish is worth four or five berries at
rest and the gap widens on a spike, so a pouch of fish is a real decision about *when* to sell
it. Every `MKT_STEP` (5 s) each good takes one step: a pull `MKT_REVERT` of the way back to its
base, the drift, then the lurch. `price` is a float and the walk runs on it; what is ever **paid**
is `marketPrice()`, the rounded coin, so the graph can wander between two whole numbers without
the counter's price flickering.

**Both goods trade at one price in both directions** — no spread at all, the one place the
half-price rule does not apply. A spread would kill the only thing the market is *for* (buy low,
hold, sell high), and there is nothing to protect: the price does the taking by itself.

**The graphs are three days deep.** Each good keeps `MKT_HIST` samples (`MKT_DAYS × CYCLE ÷
MKT_STEP` = 99, one per step), drawn as a filled sparkline with a dotted gridline per day boundary
and its high and low printed small at the ends. `initMarket()` **primes the whole history at
boot** by walking it forward from the base price, so the counter's graphs are graphs on day one
rather than a flat line that fills in over the first quarter of an hour.

**A big move makes the news.** `marketNews` cuts a headline when the price has moved both
`MKT_NEWS` (30%) *and* the good's own `newsMin` gold (fish 4, berries 2) since the last one — green on a rise and red on
a fall. The absolute floor is the half that matters: a berry going 2G → 3G is a 50% "spike", and
without it the feed fills with small change. The card that made one pulses in the panel for three
seconds.

A headline goes to **two places at once**, and a restock's does too:

- the **event log** (not drawn; `DBG.events`) — `FISH SPIKE 34G`, `BERRIES CRASH 2G`,
  `THE MERCHANTS RESTOCK` — the match's own record, where everything else that happened to
  somebody already is;
- a **plate top-right under the minimap** — the `notices` banner in js/ui/shop.js, drawn by
  `renderNotices` ([the plates](rendering.md#notices-the-plates-under-the-minimap)) —
  because a price is not something that happened to a player: it is the state of the world you are
  about to sell your bag into, and it has to arrive on screen, where the clock is.

Both readouts take their colour from one table (`NOTE_KIND`), handed straight to `logEvent` as its
palette override, so the two can never disagree about which way a price went.

**Each has its own cue** (js/audio.js): `SFX.market(up)` is a coin dinging on a spike and a falling
sigh on a crash — two *different* clips rather than one pitched two ways, and unjittered, because
this is read as a direction and never as a texture — and `SFX.restock()` is the turnover in two beats, a
wagon pulling in and, `RESTOCK_RING` (0.9 s) behind it, the bell over the new stock. Neither is
gated on standing at a counter: a turnover is the one market event worth walking across
the map for, and news you only hear once you are already there is not news.

### The panel

It is **wide and short and pinned near the top edge** (336×216, `SHOP_W`/`SHOP_H`/`SHOP_Y`), and
that is a constraint, not taste — **the tooltip-corner rule**, which everything on this slab is
laid out against: the [tooltip](rendering.md#the-hover-tooltip) parks bottom-left and grows
upward off the bottom rim, and the deepest one an offer here can raise tops out around 192 px. So
the slab stays short, the **sell strip ends at 190**, clear of that line, only the restock road
runs under it, and the two readouts that must survive a tooltip — the road's countdown and the
SELL ALL button — sit at the **right** end. All a tooltip can ever cover is the wagon, never an
offer, a card, the sell target or the clock.

**It is pinned clear of the corner**: **a counter may not stand on
the pack it is sold out of** — a sale is a drag from that drawer into this slab. The weapon shelf
and the pack drawer are in the top-left (`cornerClaim` / `cornerBottom`, js/ui/strip.js), and the slab
takes the room **beside** the corner where there is one and the room **under** it where there is
not:

| | when | where it goes |
| --- | --- | --- |
| **beside** | `cornerClaim() + 6` still leaves the slab inside the frame | `x = max(centred, cornerClaim() + 6)`, `y = 4`. It keeps the centre whenever the view is wide enough for both, so on the ordinary 640×360 frame this is a nudge of 28 px |
| **under** | it does not, but the slab clears both the frame's bottom and the deepest tooltip below the drawer | centred across, `y = cornerBottom() + 6`. A **tall, narrow** frame (a portrait monitor's 360×640), where nothing fits beside the 336-wide slab |
| **neither** | both fail | `x` at the view's right rim, `y = 4` — the minimap's rim goes under it |

The width claim is the corner's **fixed** reach — the widest row a tool could ever grow to — and
not the live `shelfRowRight()`, because the row grows with the tool in hand and a slab that slid
sideways when a swap changed the row mid-trade would walk out from under the pointer. The **under**
branch is gated on `SHOP_TIP_CLEAR` (196) as well as on the frame (the tooltip-corner rule
again). Where nothing fits at all (the shortest view the canvas
allows, 320×240, where the slab is wider than the frame), it covers the corner. The placement's
comments in js/ui/shop.js carry the rest of the reasoning.

Top to bottom: the **awning** — a snow-capped, icicled valance striped in the counter's own team
colours, the one thing on the panel that says whose eagle this is — with the shop's sign hung off
its hem between two lanterns, the merchant's portrait framed at one end and the purse at the
other; the four sections as a 2×2 grid of three-well rows, each on a recessed
board; the **MARKET** rule and its two cards side by side; the **SELL strip**, the full width of
the slab, with air under it (`SHOP_SELL_GAP`); and the
[restock road](#the-restock-road) along that rail. The frame, the section rules, the market cards and
that edge are all cut from one timber palette under iron corner brackets, which is what makes the
slab read as a shopfront rather than as one more blue HUD panel.

The **strip is two controls on one line**: the drop well you aim at with an item on the cursor,
and the **SELL ALL** button (`SHOP_ALL_W`, 82 px) at its right end (the tooltip-corner rule).
It is a **click** where the well beside it is a **drop**, so it is a raised plate that lifts under
the pointer, not a second recessed well. On it: the **pack** as six lit pips (`drawPackGlyph`), an
**arrow** into a **coin**, the **gold** it fetches (`packValue`), and the word ALL. With an empty
pack it goes flat and dark and does not lift — deliberately *not* the counter's out-of-reach red
(`SHOP_DEAR_*`), which means "you cannot afford this".

Every offer well wears **its item's own tier plate** (`tierPlate`, gilded ones still shine) with
the price on a band along the bottom. Two rules make the twelve read as one grid rather than as
twelve loose pictures: every icon is drawn at the largest **whole-number** scale that fits
`SHOP_ICON` (16) px (`shopIconCv`, baked once each) — the game's two icon grids are 8×8 and 12×12,
so the counter runs 16s with the three tools at 12. The scale has to be whole: a
fractional one stretches every third source pixel to double width, and a bow's 1 px linework comes
out frayed. And a price band's coin sits at a **fixed** offset with its number **right-aligned** to
another, so a section's three prices line up as a column instead of three centred groups sliding
about with the digit count.

### The restock road

Along the bottom rail, under the sell strip: **how long until the twelve offers above it turn
over** (`drawShopLane`, the `the restock road` banner). The question it answers: long enough to
go and earn more gold, or worth waiting here for?

It answers twice, and neither answer is a sentence. **The number** is on a plate at the road's
far end, `M:SS` beside a small clock face, going gold and flashing under 15 s. **The picture** is
the merchant's own errand: a canopied wagon and the horse in its shafts leave the post's door at
the turnover, are furthest out at the halfway mark, and roll back through that door exactly as the
new stock lands. The wagon's **position is the clock** — there is no separate progress bar,
because the wagon already is one — it faces the way it is going, and its trot frame is cut from
**distance travelled** rather than from a timer of its own, so the legs and the wheels belong to
the same journey.

The countdown sits at the **right** end deliberately ([the tooltip-corner rule](#the-panel)).

**A price you cannot pay is said three ways at once**: the well's rim and its price band both go to the counter's out-of-reach red
(`SHOP_DEAR_*`), the price ink with them, and the goods themselves grey back under a wash — the
tier plate keeping its own hue through it, since which tier a thing is stays true whatever it
costs. It does not lift under the pointer and it does not shine. It is the same red
[tipGear](#gear)'s next-level row and the pack's own refusal already speak, and a market card's
BUY plate wears it too when the reason it is dead is the price rather than a full pack.

The **sell strip** is a full-width recessed well with corner brackets — a drop target, so it is
hard to miss — and it carries the word SELL. Idle it is SELL → a coin; with something in hand it
becomes that item → a coin and the gold it fetches, and the whole well lights and pulses. At rest
a slow band of light crosses it (`sellSheen`, a long period and a soft envelope: a resting
state must not blink). Nothing
else on the panel is labelled with a verb: a market card's two trade plates say their direction by
*arrangement* — coin into item is a buy, item into coin is a sale — and the price is stated once,
big, because it is the same number both ways. The
section headings (TOOLS / BITS / MODIFIERS / CARDS) and the graphs' own numbers are this panel's
share of the [instruments carve-out](rendering.md#show-dont-label), for the reason the practice instruments have
one: reading a market **is** reading numbers, and no shape compares a price today against a price
yesterday. Hovering anything on it describes it in the ordinary tooltip — an offer with a PRICE
row on top of the rows that item shows anywhere else, a good with its day's change and its
three-day high and low — and while the counter is up, every bag cell's tooltip gains a SELLS FOR
row.

## Inventory and the backpack

A player carries in two places, and which one a kind lives in is **one flag on its `ITEMS` row**.

**The bag** (`p.bag`) is a fixed array of `p.bagCap` cells, each one `null`
or a `{ type, n }` stack of at most `ITEMS[type].stack`. Everyone starts with **one bag of 12**
(`BAG_CAP`, two rows of `BAG_COLS` 6 in the [drawer](rendering.md#the-backpack) under the weapon shelf, shut until B); a second bag is a bigger `bagCap` and a longer array,
nothing else. It holds the **build**: the spare tools and bits a player lays out, compares and
chooses between — and a bit only takes a cell once every tool carried (the one in hand, then
each in the pack) is full, since `fitAdd` (js/tools.js) loads it into them first.

**The pouch** (`p.food`, `newPouch()`) is a set of uncapped counters beside the wallet, and it
holds the two **meals**, the five **unopened card** rarities and the **burrow** — everything with
`pouch: true`. A pouch kind takes no cell, cannot be dragged, cannot be arranged and cannot be
refused: a meal is pressed on Q and F, a card drawn on C and a burrow dug on V from
[the hud strip's pouch block](rendering.md#the-hud-strip) and nowhere else, so the cells are
all the build's. Being uncapped is why every count that shows
one goes through **`shortNum`** (js/core.js) — `999`, then `1.2K`, `12K`, `340K`, `1.2M`, four
characters at most. The exact figure stays in the tooltip, the surface whose job is comparing
numbers.

| Item | Icon | Where | Used by |
| --- | --- | --- | --- |
| `berry` | `itemBerry` | pouch, no cap | Q, or clicking the strip's meal button — eats it (see [Food](#food-the-meal-is-a-channel)) |
| `fish` | `itemFish` | pouch, no cap | F, or clicking its meal button — eats it (same) |
| `cardWhite`/`cardGreen`/`cardBlue`/`cardPurple`/`cardGold` | `itemCard<Rarity>` | pouch, no cap | C, or clicking the strip's card button — draws one at random (see [Roguelike cards](#roguelike-cards)) |
| `tunnel` | `itemTunnel` | pouch, no cap | V, or clicking the strip's burrow button — stands the hole's ghost up (see [The burrow](#the-burrow-a-tunnel-anyone-can-ride)) |
| `tool:<id>` | `toolArt_<shape>_<tier>` | bag, stack 1 | dragged onto one of the four weapon slots (see [Tools and bits](#tools-and-bits)) |
| `bit:<id>` | `bitArt_<id>` | bag, stack `BIT_STACK` 255 | loads itself into the tool in hand on pickup (`fitAdd`), or is dragged into a cell of the shelf |
| `ironstone`/`frostglass`/`sunstone` | `itemOre_<key>` | bag, stack `ORE_STACK` 99 | nothing yet but the counter, which buys it at half its `price` (2 / 12 / 40); see [Mining a rock](#mining-a-rock) |

An unopened card is an ordinary `ITEMS` entry (`pouch: true`) — one per rarity, since a white
card and a gold card are not interchangeable — which is what makes the drop pickup and the
counting helpers free for it, same as any other carried item. Tools and bits
register their rows the same way, from [js/tools.js](../../js/tools.js), under namespaced keys so
a kind can never collide with a berry.

A tool is the **one instanced** item (the [CLAUDE.md](../../CLAUDE.md) hard rule): it stacks to 1
and moves as a whole object (`bagPut(p, cell)`, and `spawnDrop`'s `it` payload). `bagAdd` cannot make one and must not be asked to — the drop pickup
branches on `d.it` for exactly this reason. Everything else in the bag is stateless.

**A bit stacks to `BIT_STACK` (255)**, which is a deliberate "as many as you will ever find". A
bit is ammunition for the build rather than a thing to ration: the twelve cells are for the *choice*
between kinds. 255 is the ceiling because the count still reads in three characters inside an 18 px
well — past that the number would need `shortNum` and a cell would stop saying exactly what is in
it. A tool stacks to 1; the pouch kinds (meals, cards) have no stack at all.

**The slot is the unit of capacity for what the bag holds**, which is the whole reason it is an
array and not a row of counters: two half stacks cost two cells, so a bag genuinely fills and the
pickup path can genuinely refuse. Six helpers in the `players` banner are the entire API —
`bagCount(p, type)`,
`bagUsed(p)`, `bagRoom(p, type)` (room in partial stacks + a full stack per empty cell),
`bagAdd(p, type, n)` (tops up partial stacks before opening a cell, returns how many went in),
`bagTake(p, type, n)` (spends from the **last** stack backwards, so partials empty and free their
cell) and `bagPut(p, cell)` (an instanced cell into the first free slot, or false). Nothing outside
them touches `p.bag` — `updateEat` (the meal landing), the fish catch, the drop pickup and the AI's
food check all go through the six. The one deliberate exception is the **drag**
(the drag banners of [js/ui/strip.js](../../js/ui/strip.js)), which is moving cells between wells rather than storing items, and
owns `p.bag[i]` directly for exactly the length of one gesture.

**The four counting helpers are also where the pouch lives** (`isPouch(type)`): for a `pouch` kind
`bagCount` reads `p.food[type]`, `bagRoom` answers `Infinity`, `bagAdd` always takes it all and
`bagTake` spends it. That one branch is what keeps every caller generic over where a kind actually
sits — the drop pickup, the catch, a market trade and the AI's food check are
written once and neither know nor care.

**Refusing is a real outcome** for what the *bag* holds, and every path that cannot store
something says so the same way:
`bagDenied()` reddens and shakes the whole backpack frame for 0.6 s with one `SFX.deny()`, and re-firing while
it is already up does nothing, so standing on a drop you cannot carry is one flash and not sixty a
second. A pouch kind can never fire it. The **weapon** refuses in the same language:
`toolDenied()` / `toolFlash` (UI › `hud strip`) bands the weapon well in that red and shakes it
for the same 0.6 s when a bit has nowhere to go in it, so the container that is full is always
the one that answers.

The HUD is in the `UI` › `backpack` banner — see
[the backpack](rendering.md#the-backpack).

## Food: the meal is a channel

Berries and fish are the only heal a player carries, and they answer the same question — *can I take
this fight* — so the whole thing is **one clock and one channel**, in the `food` banner of
[js/core.js](../../js/core.js):

| | |
| --- | --- |
| `FOOD_CD` | **3 s**, and it is **shared**: eating either meal puts *both* away |
| `FOOD_EAT` | **1.5 s** of channel, interruptible for its whole length |
| `FOOD_SLOW` | **×0.5** on the walk cap and the ice cap while chewing — the drag a cast puts on the legs |
| `ITEMS[type].heal` | what the meal is worth before `foodMul`: berry **20**, fish **50** |

**Nothing is spent up front.** `startEat(p, type)` only arms `p.eatT`/`p.eatType`; the food leaves
the pouch and `p.foodCd` starts when `updateEat` lands the channel — exactly the way an ability's
cooldown starts when its *cast* lands, not when the key is pressed
([Class abilities](#class-abilities-keys-1-4)). So a meal knocked out of your hands costs the time
and the tempo and **nothing out of the pouch**, and can be restarted on the spot.

`eatBerry(p)` / `eatFish(p)` are the two edge-triggered intents Q and F set (two keys, two
meals — the hud strip's meal buttons click the same intents a key sets); both are one
line into `startEat`. It refuses — with the `SFX.deny()` an ability well
speaks — while the clock is up, the body is busy (stunned, falling, rolling, mid-cast, mid-rush,
airborne), or there is nothing a meal could do (no food, or already at full hp).

**What breaks a meal** is `breakEat(p)`, and every side that can break one calls it. The world
takes it away: a hit (`damagePlayer`), a stun (`stunUnit`), the ice (the hole plunge in
`updatePlayer`), death (`die`, `practiceRevive`). And **you** drop it on purpose, two ways — a
**dodge roll** (`tryDodge`), and the **fire button**: the rising edge of `inp.fire` in
`updatePlayer` cancels the meal and the draw gate two lines below arms in the *same frame*, so a
body mid-chew is never a body that cannot fight back. The food is unspent, so the cancel costs the
1.5 s and the tempo and nothing else, and the meal can be started again the moment the shot is
away.

**What a meal still refuses** is the E swing (`tryWork`) and an ability (`tryAbility`) — the two
presses that spend a cooldown, which a stray keypress should not be able to throw away. A meal does
*not* break the burrow — you can eat lying in the snow — and its crumbs fade with the cover exactly
as the overhead tells do (`alpha: 1 - concealOf(p)`).

**It reads without a word of it** ([UI rule](rendering.md#show-dont-label)):

- the **overhead frame** carries the channel in the same slot as the bow-draw meter, filled in the
  heal green — gold = drawing, slate = reloading, **green = eating** — so a rival can see the meal
  and take it away ([Overhead health bars](rendering.md#overhead-health-bars));
- crumbs in the meal's own colour fly at the mouth for the whole channel;
- the shared clock **wipes top-down over the food itself** (`drawFoodClock`, UI › `backpack`) — in
  the bag cell the click that eats lands on, on the open pack's strip counters *and* on the hud
  strip's two **meal buttons** (`drawFoodCell`, [rendering.md](rendering.md#the-hud-strip) — icon,
  count, key letter, and a click that sets the same `eatBerry`/`eatFish` intent the key does).
  All wipe together: that is the point of one clock. The meal being chewed lights its own well
  white, the way a casting ability well does.
- the food tooltip carries `HEALS` / `EAT` / `COOLDOWN` / `CARRIED` and a red `READY IN` while the
  clock runs — the same rows `tipClassAb` prints.

**Bots eat through the same one path** (rung 1 of `aiThink`, the ladder `updateAI` wraps — which is why it reads `foe` before the
burrow rung): a bot only starts a meal with no rival inside `AI_EAT_R` (110 px), because standing
there chewing under fire is not patience, it is a free kill.

## The dawn shield

The [warrens](world.md#camps) carry a dozen **snowdrop** clumps each (`OBJECTS.snowdrop`, art from
`app/bake-snowdrops`). They are shut all day and open only for the **dawn window**
(`bloomOpen`, js/world.js): `BLOOM_LEAD` (6 s) before the clock wraps to a new day and
`BLOOM_HOLD` (18 s) after it, never under `PRACTICE`. An open clump is a work target and the hands
take it on their own like a berried bush (`auto`, `ready`), and a pick (`pickSnowdrop`,
js/actions.js) lays `DAWN_SHIELD` (10) of shield on **every scout of the picker's side** who is up
and on the ground, wherever they are, stacking to `DAWN_SHIELD_MAX` (30): so the clumps are worth
racing the other side to, one segment each. The clump stays picked until the next dawn opens it
(`o.picked` = the `bloomDay` it was taken on).

The shield (`p.dawnShield`) holds until hits break it or its scout goes down — it never wears off.
`damagePlayer` spends it **after** the damage reduction and **before** health, with a gold burst,
and a shatter (`shieldBreak`) the hit that empties it. It is drawn as its own gold bar over the
health bar ([rendering.md](rendering.md#overhead-health-bars)), and nowhere else.

## The burrow: a tunnel anyone can ride

A rabbit's kill leaves a **burrow** one time in four (`TUN_DROP`), carried in the pouch
(`ITEMS.tunnel`). Pressed (V, or its strip button), it stands a **hole ghost** on the tile under
the pointer, the build list's grammar (`tunnelAimToggle`/`drawTunnelGhost`): the builder's reach
dotted round the body, green where `tunPlaceOk` says it can go (inside `BUILD_REACH`, on open
snow or the road, nothing standing there), red where not. A left press sends the `tunnel` order
(`runCmd` → `digTunnel`); the key again, the right button or Escape puts the ghost away.

The order lays the **near hole** (`OBJECTS.tunnel`, a tile object that knows its `mate`, its
digger and side, and `crumble`) and starts the dig: for `TUN_DIG` (10 s) the digger runs, and
wherever they stand when it ends — or the nearest free tile within `TUN_FAR` (2) — the **far hole**
opens (`updateTunnels`). Nowhere free puts the burrow back in the pouch. A tunnel can end anywhere
on the map. **One tunnel a digger**: a new dig caves the old one, and a digger who goes down before
the far end opens loses the near hole too. A finished tunnel outlives its digger
(`p.tunHole` is not cleared by `reset()`).

**Anyone takes a hole**, of either side, and many can be under at once: a fresh press of the work
key standing on it (`TUN_ON`, 9 px; `tunnelEnter`, ahead of the swing in `updatePlayer` — a key held
from before stays the swing's). Underground the body is out of the world — `inAir` answers true
for `p.tun`, so nothing hits it, nothing it wants gets through, and every loop over players skips
it — and it rides the line between the holes at `TUN_SPEED` (240 px/s, at least `TUN_MIN_T`)
as a **mound of snow** every player can see, with its side's pip and a churned furrow behind it.
It comes up `TUN_UP` px above the far hole, so the hole lies in front of its boots, and waits
`TUN_CD` (3 s, `p.tunCd`) before any hole takes it again. Bots do not take holes yet.

A **rival standing on a hole** for `TUN_BREAK` (3 s, `h.crumble`, which drains back when they step
off) caves the whole tunnel. Every state is drawn on the hole (js/draw/tunnel.js): a ring of dots
draining **gold** is a dig running out (the same ring under the digger's boots, so a rival sees
where it comes up), one filling **pale blue** is your own wait, and a hole that shrinks and shakes
is caving. Standing on a hole you can take, the work key's bare cap rises over it
(`drawTunnelHint`).

## Mining a rock

Rocks come in three kinds (`ROCK_KINDS`, the `rocks and ore` banner of
[js/mining.js](../../js/mining.js)), each with its own outline so the kind reads by shape before
colour: **STONE**, a pair of leaning slabs; **FROSTGLASS SPIRE**, ice prisms through the slabs;
**SUNSTONE**, a black obelisk seamed with amber. Where each stands is [world.md](world.md#rocks).
Every rock is two tiles wide (`OBJECTS.rock.w`), and either tile answers for the whole rock.

**A rock mines itself: no key, just standing by it.** Every step `updateMine` (beside `updateEat`
in `updatePlayer`) looks for the nearest standing rock within `MINE_R` (40 px of its middle,
`rockCx`/`rockCy`) that nobody else is at (`mineFree`, `rockMiner`) and takes it: one miner per
rock, two in one step [contested](multiplayer.md#contested-orders) on `mine:<tile>`. The bar
fills for as long as the miner stays inside the ring, whatever they do there - walk, shoot,
roll, eat, cast:

| kind | `mine` | `gold` | `ore` | `loot` / `lootTier` | `regrow` |
| --- | --- | --- | --- | --- | --- |
| STONE | 2 s | 3 | 3–5 IRONSTONE | 0.2 / 0 | 120 s |
| FROSTGLASS SPIRE | 3 s | 8 | 1–2 FROSTGLASS | 0.5 / 1 | 180 s |
| SUNSTONE | 4 s | 20 | 1 SUNSTONE | 1 / 2 | 300 s |

The pick bites every `MINE_STRIKE` (0.5 s): the rock shivers and blinks white, chips and a
white spark fly off where the pick lands, three motes of the kind's colour stream into the miner
over `MINE_STREAM_T` (`streamTo`, core.js), and on a body standing with its hands free the E
swing's own animation plays at it with nothing landing and no cooldown spent. The rock cracks in
thirds (each new crack a chunk burst, a bigger blink and a small shake) while the kind's colour
rises up its body from the foot (`SPRITES.rockFill`) and a bar fills over it (`o.crack`, the
progress itself, drawn by `drawRock`, js/draw/render.js, for every screen); a ring of `MINE_R`
lies on the snow in the kind's colour round the rock your pick is at, and faint round a free
one within reach of a step (`drawMineRing`). **Only a rival's blow knocks the pick off**:
`damagePlayer` calls `mineHit` for a hit from anyone not on your team (a wolf included; a
teammate, a fall or the cold do nothing), which lets go and keeps that body off every rock for
`MINE_HIT_HOLD` (1.5 s). A stun holds the bar still. Stepping out of the ring, dying, the water,
the air or the zipline let go (`breakMine`). **Progress is never thrown away**: a rock
nobody is at closes back up at `MINE_DECAY` (0.35 s of pick per s, `tickRock`), and the next pick
at it, yours or a rival's, starts from what is left.

When it lands (`finishMine`) the rock pays its `gold` through `awardGold` (times `harvestMul`,
so it is XP too), throws its ore onto the snow one piece at a time toward the miner
(`ORE_FLING`) for the [drop pickup](#inventory-and-the-backpack), rolls its find
(`dropLoot`), and lies as **rubble** (`o.regrow`, `SPRITES.rockSpent`) — still solid, not
offered to E (`OBJECTS.rock.ready` is `rockReady`) — until `tickRock` in the object timers
grows it back. The bots mine by the same rule (the harvest rung walks them beside a rock and
they stand there, key up, until it breaks); the worker bots leave rocks alone, and the merchant's axe, a crater and the
landing's lane take a rock off the map whole (`fellScenery`, js/world.js). What the ore is for
is [the forge](#the-forge).

## Gear

Every player wears four pieces — **helmet, chest, legs, boots** (`GEAR_SLOTS`) — each one of three
variants with a distinct lane, all in the `GEAR` table in the `players` banner:

| Slot | Variants (per piece level) |
| --- | --- |
| helmet | LONGSIGHT +1 arrow dmg · QUICKDRAW −8% draw *and* renock time · HUNTSMAN +15% animal-kill gold |
| chest | BULWARK +8 max hp · IRONHIDE −1 dmg from every hit (min 1) · HEARTHWEAVE +25% food heal, passive heal runs at night |
| legs | STRIDER +4% walk speed · SLIDEWORN −12% fatigue, slide engages 5 sooner · PACKMULE +25% gold on fells/breaks (`harvestMul`, rounded) |
| boots | SKATES +8% ice cap, +0.15 steer · DANCER −0.4 s dodge refill · GHOSTSTEP wolves/turrets acquire at −10% range |

The variant pick is free and is **level 1**; in-match gold buys each piece to level `GEAR_LV_MAX`
(4) for `GEAR_COSTS` 10/20/35 — the second gold sink beside building. Levels reset with the match
(every boot builds fresh `Player`s). The human picks variants in the **hero pop-up** — opened
by clicking their figure on the lobby, all 12 variants at once as 32×32 icon wells beside a
live preview and a real-number stat ledger with hover deltas (League runes-style; see
[the hero pop-up](rendering.md#the-hero-pop-up)); `pickGear()` writes straight to `player.gear`.
AI players hash all four variants from the seed in `initPlayers()`. **Every variant has its own
icons**: the 12×12 material-swapped `SPRITES.gearIcons[slot][variant][material]` the HUD
wears, and the detailed 32×32 `GEAR32` set the pop-up's wells wear — a pick is a distinct
picture, not a label.

<a id="stat-points"></a>
**Stat points** are the build's other half, spent on the same pop-up's stat ledger itself:
`STAT_POINTS` (6) to put a step at a time on **any row** before the eagle. `STAT_TRACKS`
(js/player.js `stat points`) is one track per ledger row, same names in the same order as
`GEAR_STATS` — HEALTH +5, DAMAGE +0.5, DRAW ×0.96, RENOCK ×0.95, ARMOR +0.5, WALK +2%, ICE
SPEED ×1.04, ICE GRIP +0.15, FATIGUE ×0.94, DODGE −0.15 s, HUNTS +10%, FELLS +15%, FOOD +15%,
SEEN AT −5% a point — each a `mod(k, n)` folded into the kit by `refreshKit` after gear, so
every kit-reading site picks them up for free.
`player.pts` holds the spend (`spendPt`, js/ui/menu.js; `ptsSpent` the total); it rides the
lock-in page with the gear (`softfall.drop`) and no profile keeps it. **The budget is the same
for everybody** — AI players deal theirs from the seed in `initPlayers()`, a point at a time
across the tracks — so a spend is a shape, never a head start, and the arsenal's flatness holds.

**Worn gear shows on the sprite**: each piece at level 2+ lays a 1 px band of its material across
the shared 16×16 body plan — hat, coat, hips, one mark per foot (`GEAR_MARKS`/`drawGearMarks`,
called from `drawPlayer` under the held tool; skipped while rolling, in a hole, or in title). The
free level-1 pick draws nothing, so the baseline look stays the class's; a fed player reads
iron → steel → gold at a glance, the same materials the HUD plates wear.

**Mechanism**: a variant's `mod(k, L)` writes its bonus into the player's *effective kit* —
`refreshKit(p)` copies the class kit, adds the gear-only defaults (`huntMul`, `dr`, `foodMul`,
`nightHeal`, `walkMul`, `harvestMul`, `dodgeCd`, `stealth`) and applies the four mods; `kitOf(p)`
returns that cache, so every existing kit read site (movement, `emitBit`, dodge timing, the AI,
the draw meter) picks gear up without knowing it exists. The sim never reads `p.gear` directly.
Sites that read the gear-only fields: `damagePlayer` (`dr`), `updateEat`'s landing and the daylight
regen (`foodMul`/`nightHeal`), `hitObject`'s fell/break payouts (`harvestMul`), `animalDies`
(`huntMul`, paid to `a.lastHit` — stamped by the arrow loop — as one extra coin), **`seenAt()`**
(`stealth` — see [Prone](#prone-under-the-snow); the wolf pack, both turret checks *and*
`aiNearestEnemy` all go through it, so GHOSTSTEP works against a rival player as well as against
wolves and turrets), and the three dodge-refill sites (`dodgeCd`).

**Buying** goes through `input.cmd = {kind:'gear', piece}` → `runCmd` → `buyGear(p, i)` — the one
entry point: it re-validates cost, pays, bumps `gearLv`, rebuilds the kit, and heals a BULWARK
bump on the spot like a hero level. No tile, no reach, no contest — it only touches the buyer's
own wallet. The human buys on the **character panel** (G): the four pieces sit head-to-toe as
32 px icon wells (`charLayout`/`charHit`/`drawCharPanel`, js/ui/bag.js), each named in the material
of its level (leather → iron → steel → gold) with gear's three buy pips and the next level's
price on it — an affordable well pulses its rim gold, a click on it buys, and a maxed piece goes
quiet behind a gold rim
([the character panel](rendering.md#the-character-panel-g)). There is no keyboard shortcut for
it: keys 1-4 are the class abilities, and gear is bought where gear is worn. `gearHit` (a
read through `charHit`) is shared by the click handler, `cursorInfo` (hand cursor) and
`tipAt`, so the three can never disagree. The click is swallowed **before** `clickAction` — the
panel, the backpack widget, the hud strip (the weapon well, an ability well casting and its buy
badge) and the weapon shelf are the left-clickable HUD in play. Bots buy at rung 0 of
`aiThink` (js/ai.js), from anywhere — a pusher never reaches the spend rung: cheapest piece
first, keeping a 15-gold float so they still build.

## Roguelike cards

A permanent buff dropped by a sprung **chest** in the treeline (`placeChests`, js/world.js;
`hitObject`'s chest branch in js/actions.js rolls the rarity against `CHEST_ODDS` through
`rollCardRarity`), one at a time, drawn one at a time.
`CARDS` is `{ white: [...], green: [...], blue: [...], purple: [...], gold: [...] }`
(`CARD_RARITIES`, White → Gold rising in rarity and magnitude), each entry `{ name, blurb, mod(k) }` —
the exact shape a `GEAR` variant's `mod(k, L)` is, minus the level argument, since a card is a
one-shot pick rather than a leveled buy. Every effect stays inside `kitOf`'s existing field
vocabulary (`dmgBase`, `dr`, `maxHp`, `walkMul`, `stealth`, `ambushMul`, `iceMax`, …) except one
genuinely new field, `killHeal` — a flat heal on a confirmed kill, hooked at `die()`'s existing
kill-credit line the same way `updateEat` applies a meal's.

**The draw** (there is no draft screen): an unopened card is a pouch kind, and
the card key (`'card'`, C; L3 on a pad) or a click on the strip's card button sets the
`useCard` intent, which `useCard(p)` (js/core.js, beside `startEat`) resolves on the spot —
one card taken at random from everything held (so a rarity is as likely as it is common in the
hand), one entry of that rarity at random, `bagTake` the card, push `{ rarity, id }` onto
`p.cards`, `refreshKit(p)`, then `cardFx` (a burst in the rarity's colour) and a floater with the
card's name. The floater names the CARD; what it did to the NUMBERS flies into the notice lane
as the [stat sheet](rendering.md#the-stat-ledger-your-sheet-as-a-notice), every row the pick
moved lit and blinking on it. Nothing to draw is a refusal on the button (`cardDenied`). `refreshKit` folds every entry in `p.cards` in after gear, cumulatively
(`for (const c of p.cards) CARDS[c.rarity][c.id].mod(k);`), so picking the same effect twice stacks
it, and every existing kit-reading site in the sim — movement, `emitBit`, dodge timing, the AI,
`seenAt`'s stealth — picks a card up for free, the same way it already does for gear. `p.cards` is
set once in the `Player` constructor and never touched by `reset()`, so a build survives every
respawn within a match.

**Bots never press the card key** — `useCard` is reached through the input struct, which `updateAI` never sets for cards.
Instead, the instant a bot is carrying any unopened card, `resolveCardForBot(p)` (js/ai.js, the
top of `aiThink`) resolves it: the first rarity in `CARD_RARITIES` order it holds (a human's draw
is weighted across everything held), one random entry from that rarity's pool, minus the burst
and the floater.

## Base building

**T opens the build list, and the ghost under the pointer is what a click lays.** The way in is
on screen all match: the **build well** (`drawBuildTab`), the ability strip's fifth well after
ability 4 — the hammer the pointer turns into, doubled, with the build key's cap (the pad's
dpad-down glyph while one is in hand) in the corner an ability well prints its key in. **A tap
of T** or a click on the well opens the list on the **last piece picked** (`toggleBuild`, the one
toggle both call; `buildLast`), and a tap again puts it away. **Holding T** past `PIECE_HOLD`
opens the **piece wheel** over the pointer (`buildKeyPress`: the wheel kind `piece`, every piece
round the ring on the manage wheel's grammar, drawn only once the hold is a hold so a tap never
flashes it), and the release on a wedge opens the list on that piece (`buildKeyRelease`); a hold
let go in the hub changes nothing. The list (`drawBuildList`, the `build list` group in
[js/ui/wheel.js](../../js/ui/wheel.js)) is a column standing over the well, one row a piece in
`BUILD_ORDER` — wall, long wall, gate, turret, generator, bot bay, fish net — each row its icon and its
price (gold's colour while the purse covers it, red while not), the picked row rimmed gold and
the well with it. Well and column are the **strip's**: drawn in its 1× space at the HUD SIZE
(`drawHudStrip`, js/ui/hud-draw.js, whose bake grows by `buildHeadroom` while the column is up),
hit tested through `stripMouse`, the column's foot clear of the pouch tab it overhangs.
The mouse wheel walks the rows (the camera's zoom waits), a click on a row picks it, a **hover on
a row prints what the piece is for** (`tipStruct`, js/ui/tooltip.js: the price, health, build
time and the type's own numbers, then its `STRUCTS` `blurb`), and **R turns a piece that turns**:
the picked row wears the rotate key's cap. In the world the picked piece rides the pointer as a
**ghost** (`drawBuildGhost`, the world pass): its own art, faint, snapped to the tile grid with
its footprint centred on the tile under the pointer, rimmed in the standard bright ink where it
can stand, the danger red where it cannot and **grey where it could but the purse cannot pay**
(`BUILD_BROKE`), and a **dot at every tile corner inside `BUILD_REACH`** (64 px) of the builder,
so the snap and the reach read as one thing without a number. **The pointer wears the piece too**
— the hammer cursor with the picked piece's icon on the picked row's gold under it
(`drawBuildCursor`, dim with the hammer where the ghost cannot stand), wherever a press would lay
it — so the mode is read where the eye is: a left press over the world lays or refuses, and never
fires. A left-click lays the ghost and **the list stays up** for the next piece. **A piece marked
`line` (the wall) is laid by a drag**: the press remembers its tile, the ghost becomes the run
from it along whichever axis the pointer travelled further (`buildLine`, at most `BUILD_LINE_MAX`
tiles, each tile its own colour, going grey where the purse gives out), and the release sends the
run as one order (`buildOrder`: `tx2`/`ty2` on the `build` cmd) that `placeLine` lays tile by
tile, each its own contested `placeStruct`, skipping what cannot stand; a press and release on
one tile is the single piece. T tapped, the well, Escape or the right button put the list away;
a red ghost refuses with the deny cue and nothing else. Rust is the reference.

**One placement rule.** `canPlaceAt(type, tx, ty, rot, p)` (structures.js) is what the ghost's
colour, the click, the pad's wheel, `findSite` and the AI all ask, so none of them can offer a
site another refuses: a `water` building wants a bare open ice hole; everything else wants every
footprint tile to be in-world snow or road (`ground` 0 / 3) holding nothing or a **stump** (a
stump is consumed — it is not a site, just something a wall may stand on), no unit inside the
footprint (a building is solid and would entomb it), and the builder within `BUILD_REACH` of the
nearest footprint tile. It answers `{ ok, why }` and never asks the price: a ghost you cannot afford
yet is still a valid site, and the row says the price. The one build *site* is the
hole: `buildSiteAt` answers `'water'` for a bare hole and `null` for everything else, and only the
pad's wheel (`buildOptionsAt`) asks it.

**Rotation is the footprint, never the art.** A type marked `rotates` may stand turned (`o.rot`
1): its `w` and `h` swap (`structW`/`structH` take the *object*, so a turned one answers turned —
or a bare type name, unturned; `footprint(type, tx, ty, rot)`), and that is the whole of it. A
3/4-view sprite cannot turn, so a type that rotates is `tiled`: each footprint tile wears one tile
of the named type's own grid (`drawTiledStruct`, js/draw/structs.js; `structSprite` resolves `tiled` the
way it resolves `art`). Today that is the **long wall** alone — two wall tiles laid as one piece
for a little under two walls, 2×1 or 1×2, hurt and upgraded as one — and the bay stays 3×2.

**The gate** (`STRUCTS.gate`, the `gate` flag) is a one-tile wall piece its own side walks
through and nobody else does: `isSolidTile(tx, ty, e)` answers open for a walker `e` of the gate's
team, and `moveEntity` and the pathfinder pass the walker, so a side's players and bots route
through their own gates while rivals, wildlife and every shot meet a wall (shots and the maps ask
without a walker). It is hurt, upgraded and wrecked like a wall, and laid one at a time (no
`line`), so a dragged wall with a gate in it is two gestures.

**Managing is E.** Holding E beside one of your own buildings (`manageNear`: the one
under the aim in reach, else the nearest in reach; never the barracks, which is `fixed`) opens
the **manage wheel** on the practice rack's grammar — upgrade straight up, **repair** between,
demolish last — and the release takes. A **site still going up** offers the demolish alone (the
wheel's `site`, fixed when it opens so the wedges never shift under the pointer). This list is
*not* generic over a table (`wheelOptions()` hand-builds it). **Repair** (`startRepair`) pays
`repairCost` — `REPAIR_SHARE` of the standing tier's price scaled by the share of hp missing, at
least 1 — and the building mends at `REPAIR_RATE` of its max hp a second (`o.mend`, spent in
`updateStructures`) whether or not it is being hit; the wheel's label says the price, or FULL
HEALTH. E never swings at a
building of your own (`workTarget`), which is what leaves the key free to open it. The right
button is the [flag wheel](#team-flags) everywhere.

**A pad builds from a wheel.** `openWheelNear` (dpad down) opens the build wheel on the tile the body **faces**, offering `STRUCT_ORDER` on land and
`WATER_STRUCT_ORDER` over a hole (the wedges follow the table's length — see *One geometry*
below); the pick is laid on that
tile, a big one fitted round it by `findSite`, and a building of the player's own on that tile
opens its manage wheel instead.

All the data lives in the `STRUCTS` table: three tiers for wall/long wall/turret/generator (for
the wall, the long wall and the generator the wood → stone → gold *look* is just the sprite
palette; the turret is the exception — three timber grids of its own) and **one each for the bay and the net**,
each with a gold `cost`, `hp`, `buildT`, and per-type stats. A `water: true` entry (only the net)
goes on a hole instead of snow, and that flag — never the type name — is what `canPlaceAt`,
`isSolidTile` and the dawn refreeze each read; see [Fish nets](world.md#fish-nets).
`tiers[0]` is what the list builds, at `buildCost(type, p)`: an income building (`ramp`: the generator
and the bay, 1.5) costs `ramp` times more for each of that type its owner already has, standing or
going up (12, 18, 27, 41... for generators), and the price paid rides the building as `paid` for
the refund. Upgrading pays the next tier's cost and re-runs a shorter
construction, and the last tier (`tiers.length - 1`) reports MAX TIER. Building and [gear](#gear)
are the two gold sinks.

Mechanics (the wheel in [js/ui/wheel.js](../../js/ui/wheel.js), the buildings in [structures.js](../../js/structures.js)):

- `state.wheel` (`{kind:'build'|'manage'|'flag'|'rack'|'pkdie'|'agbell', tx, ty, seg, ax, ay}`, plus
  `sx`/`sy` on a flag wheel opened over the chart) is the open wheel — `'flag'` is the
  [flag wheel](#team-flags), `'rack'` is the practice armory, `'pkdie'` the parkour roll die and `'agbell'` the archery
  range's bell, all three opened by holding **E**
  beside them and resolved on its release
  ([world.md](world.md#the-practice-arena)); ESC/M/settings/death
  close it, a left-click cancels it, and the game **keeps running** — opening the
  wheel mid-night is deliberate pressure. `wheelLayout()` is shared by `resolveWheel()` and
  `renderWheel()` so hover math and pixels can never disagree - and by `pointerMove` (js/input.js),
  which is what `seg` is for: it holds the wedge the cue last spoke for, so crossing into another one ticks `SFX.notch` once, for a mouse or a stick
  alike (the wheel opening itself is `SFX.wheelUp`). `resolveWheel()` does not act: it
  writes `player.input.cmd`, and `runCmd(p, c)` performs it in the next sim step (re-checking
  ownership and the 60 px reach).
- **One geometry, any number of options.** `wheelSpan(n)` is `2*PI/n` and `wheelAng(i, n)` is
  `-PI/2 + i * span`: n wedges of exactly the same size, the first centred straight up and the
  rest clockwise. Nothing is special-cased per count — 4 options land on up/right/down/left and 2
  on up/down because that is what the formula gives, and 3 land 120° apart. The hover test reads
  the segment with the *same* `floor((angle + span/2) / span)` the wedges are drawn from, so a
  wedge is exactly its own hitbox at any count. `wheelOptions()` returns ids only; `wheelLayout()`
  stamps the angle on each, so there is one source for the layout.
- **Radii** (all in the `radial wheel` banner): `WHEEL_HUB` 13 is the hole in the middle,
  `WHEEL_R` 40 the rim, `WHEEL_PAD` 4 the backing disc beyond it, and `WHEEL_RING` — the midpoint
  of the band — is where every icon and label sits, so they are the same distance from the centre
  in every direction. Wedges are drawn as annulus sectors (arc out at `WHEEL_R`, arc back at
  `WHEEL_HUB`) with a `WHEEL_GAP` of daylight between them, measured in px at the rim so the gap
  looks the same however many wedges there are.
- **The hub is the cancel target.** It carries a cross rather than the word CANCEL, and goes hot
  red while the pointer is inside it — which is where the pointer starts, so the way out is the way
  you came in. `WHEEL_HUB` is also the deadzone: nothing is chosen until the pointer travels 13 px,
  which makes a plain right-click (press and release without moving) a no-op. ESC and a left-click
  both close the wheel outright, and the left-click also stops the right-release that follows from
  firing the order.
- **The pointer is measured from `ax`/`ay`, the point the press that opened the wheel went down
  at** (the pointer's spot at the right press for a flag wheel, at the E or dpad press for the others), not from
  the wheel's drawn hub: that press is what the hand remembers, and the hub is pinned to the tile,
  so it drifts as the camera follows the player and gets clamped near a screen edge. Because that
  travel is invisible (the cursor can be anywhere on screen), `drawWheelStick()` draws it at the
  hub as a knob that moves **1:1** with the pointer — so the knob is visibly inside the lit wedge —
  clamped to the lane between the hub rim and the icon ring so it never lands on an icon. Grey on
  the cross means nothing is chosen; gold out in a wedge means that is what a release will do.
- `placeStruct(tx, ty, type, p, rot)` asks `canPlaceAt` (a stump under the footprint is consumed
  — the tile is **empty** after demolition), pays `tiers[0].cost` from that player's wallet, and
  has `createStruct()` drop the object into `building` state at 30% hp, stamped with
  `owner`/`team`/`rot` (`createStruct` is the one constructor — `DBG.buildStruct` uses it too —
  and lays the `part` fillers for a big footprint, turned or not). The placement itself is
  [contested](multiplayer.md#contested-orders) on the anchor tile, and the winner re-asks
  `canPlaceAt` before it builds, so two footprints can't land on one tile.
- **A big building ordered by one tile** (the pad's wheel, the AI): `findSite(type, tx, ty)`
  tries every anchor that covers that tile through `canPlaceAt` (reach aside, unturned) and takes
  the one covering the most stumps; none → the order is denied. The anchor is the top-left tile.
  The list never needs it: its ghost *is* the anchor.
- **Ownership**: a building wears its team's palette (`structSprite`), and `ownsStruct(o, p)`
  means only its side can open the manage wheel, upgrade or demolish it. Stumps are neutral.
- **Construction**: `updateStructures()` (called from `updatePlay`, iterating only the
  `structures` registry) advances `buildT`, grows hp toward max, and puffs dust — **faster for
  every one of the site's side standing within `BUILD_REACH`** (`buildCrew`: `CREW_BOOST` a head,
  up to `CREW_MAX`, the dust quickening with it), so helping is standing there; it also spends a
  paid repair (`o.mend`); the draws pass
  shows `SPRITES.scaffold[0|1]` under 2/3 progress, then the real sprite under the `scaffold[2]`
  lattice. A sprite wider than 16 px — the bay — builds differently: the first 12% of the timer
  shows only a staked-out foundation pad over the footprint, then the sprite rises bottom-up behind
  a weld line that throws sparks from `updateStructures` (`bigBuildReveal()` is the shared split so
  the sparks sit on the drawn edge), and completion flashes the sprite white (`o.flash`), puffs
  snow along the roofline and shakes harder. Small builds keep their burst + `SFX.place` + shake. A
  yellow progress bar renders above every site (centred over the roof for a big one). Sites are
  solid from placement. A big building y-sorts by the bottom of its footprint and sits its snow
  skirt on that edge.
- **Turret**: a **slingshot on a timber base** that lobs rocks.

  **What it throws at**, in this order of preference (`TUR_RANK`, nearest inside a rank):
  a rival **player** → a rival **worker or soldier bot** → a **hostile creature hunting somebody**
  (a camp monster with a `target`; it belongs to no side, so it is every turret's problem) → a
  rival **building**. A held mark is kept while it holds — a sling that jumped to whichever body
  was a pixel nearer would swing forever and never finish a draw — but a **better-ranked one takes
  it the moment it arrives**, so a turret chewing a wall turns on the raider who walks up.
  `turretAim(o, tg, k)` is the single gate: it returns the aim point on a mark, or null the instant
  it stops being one. It rejects anything `unitAlive` rejects (dead, a merchant, a player still
  `inAir` on the eagle), anything on the turret's own team, a building `structFoe` rejects, and a
  beast that is not actually hunting — so the meadow is never shot at. `turretMark` and
  `turretHolds` both ask it, which is why acquiring and holding cannot drift apart. A **player's**
  ring is `seenAt(tg, range)`, so GHOSTSTEP and a buried body shrink it; nothing else hides.

  **The throw is solved, once, by `turretLaunch(pv, ax, ay)`**: the velocity that carries a rock
  from the pivot onto the aim point at `ROCK_SPD` (190 px/s over the ground) while `ROCK_FALL`
  (240 px/s²) pulls it down, the seconds that takes, and the bearing it leaves on. The flight is an
  exact parabola — no drag, one constant sag (the `sling` [path](#flight-paths)) — so **its life IS
  its time of flight**, and a rock that runs out of life has *arrived*. The sag is slight and grows
  with the range: ~3 px off the chord at 64, ~12 px at 124.

  **The fork points along the THROW, not at the mark.** The tick swings `o.ang` toward
  `turretLaunch(...).ang` at `traverse` rad/s (2.2 / 3.0 / 3.8 — it never snaps), so the arms stand
  visibly *above* what they are throwing at, and `fireRock` throws along that same solve (snapping
  `o.ang` to it exactly as it lets go). With no mark the fork sweeps ±1.15 rad at a third of its
  traverse, so a live turret never reads as a prop.

  **Accuracy is rolled when the draw BEGINS, not at the release** (`turretRoll`): on a hit it aims
  true, on a miss it carries `o.off`, 14–26 px at a random bearing, for the whole of the draw.
  `acc` is 0.6 / 0.8 / 0.9 by tier. Because the fork and the dashed aim arc both read `turretGoal`
  (the aim point **plus** that offset), a throw that is going to miss *says so before it goes* —
  which is what the number is worth to the player standing in front of it.

  Once the bearing is inside `TUR_LOCK` (0.14 rad) it draws for `aim` seconds (0.55 / 0.45 / 0.35)
  and lets go every `rate` seconds; losing the bearing eases the draw back down rather than
  cancelling it. `o.rec` is the one release timer (`TUR_SNAP`, 0.14 s): it drives both the pouch
  snapping forward and the cords drawn across the mouth.

  **It needs no line of sight.** A rock flies **over the world** (`solid: false`, the wisp's own
  flag — the arrow loop's solid-tile branch *and* its building sweep both skip it), over walls,
  pines and the turret's own base, so a sling behind a wall of its own is a weapon and not a prop.
  Range alone limits a mark: `range` grows the hardest of any tier stat, 64 → 92 → 124, because
  reach is what the upgrade buys.

  **A rock is an ordinary entry in `arrows`** tagged `kind: 'rock'`, so bodies it crosses in flight
  take it through the usual pipeline, with friendly fire and kill credit for free. But flying over
  the world means it never *meets* a building — so when a rock's life ends, `rockLands` puts it
  exactly on the point it was thrown at and the ground there takes the thump: every rival building
  inside `ROCK_SPLASH` (7 px) through `hurtStruct` and every body through `hurtUnit`, by way of
  `structsNear`/`unitsHit`. **That landing is the only door a rock has to a building.** A rock that
  already struck something on the way in spent itself there and only puffs.
  **Generator**: deposits `tiers[tier].pay` gold every `period` seconds straight into its
  **owner's** wallet (`awardGold` — the `+N` floater rises at the generator, but there is
  nothing to collect and no pile to cap). **Bot bay** (`spawner`):
  keeps `tiers[0].bots` (3) robots alive, rolling them out **one at a time** — the first 1 s after
  completion, then 4 s apart; a lost bot takes 12 s to replace (`respawnT`/`respawnTotal`).
  `makeRobot` spawns at `structMouth()` (the ring around the footprint if that is blocked) with an
  exhaust puff. **Barracks** (`barracks`): the wave bay, **never on the wheel** — not in
  `STRUCT_ORDER`; each [merchant](#the-merchant) raises up to three in the back woods behind its roost, and
  `fixed: true` refuses the manage wheel's upgrade and demolish, so nobody pulls it down for the
  refund. It wears the bay's 3×2 grid (`art: 'spawner'`, read by `structSprite`) under its own
  overlay (`drawBarracksOverlay`: the shutter, the next soldier sliding down the door, the wave
  clock on the flank in the side's paint, the beacon amber while a column is leaving). Every
  `waveT` (30 s) it queues a **wave** — `wave` (5) soldiers, one more per `grow` (180 s) it has
  stood, never more than `cap` (24) of its **side's** soldiers alive at once, every bay's queue and column counted — and the queue leaves the door
  one every `BARRACKS_ROLL` (0.5 s), so a wave reads as a column. Its `cost` (40) is only what a
  wrecker is paid half of: breaking one stalls the waves until the merchant rebuilds it
  ([Soldiers](#soldiers-the-waves)). `drawBayOverlay()` draws everything live on top of the baked sprite: the next bot
  sliding down the doorway over the last 0.8 s of its timer; a roll-up **shutter** over the doorway
  (`o.door`, lerped in the tick — open while any of its workers is out of the yard or one is
  rolling out, shut when the whole crew is home, so the door reports the bay's state);
  three **bot pips** on the right flank (lit = alive, blinking = being built, dark = empty) with the
  roll-out timer as a bar under them; a flickering slat across each vent grille; a roof **beacon**
  that blinks amber while a bot is due; and an hp bar over the roof once damaged. `removeStruct()`
  clears the whole footprint and kills its robots with it.
- **Buildings take damage from everything a rival can throw, and only from the other team.**
  `hurtStruct(o, dmg, p, bot)` is the one blow — the flash, the shake, the damage total, the camera
  kick, the wreck payout and the `<NAME> WRECKED A <TYPE>` feed line are one path and cannot
  drift apart. Four things reach it:
  - the **E swing**, `hitObject()`'s structure branch, **contested** with everything else E does
    (it runs inside `swingHit`'s `contest('work:' + idx)`);
  - **every bit a tool fires**, in the arrow update's solid-tile branch (js/sim.js): a shot
    that dies on a wall sieges it first — anywhere on the building's drawn shape, the turret's
    turntable included ([the sweep](#flight-paths), `structShotBox`). A bit whose `solid` is `false`
    (the care arrow, the wisp, the hook) passes through buildings without touching them — that
    is the trade for passing walls, and it needs no second flag;
  - a **turret's rock LANDING** (`rockLands`, js/structures.js), which is how a piece that flies
    over the world reaches a building at all — see [Turret](#the-buildings) above;
  - the **abilities**: the stomp's ring, the shield's slam and the execute (their wedge, through
    `structsInCone`), the charge's slam into whatever it was driven into, the net, and the
    piercing shot, which rides the arrows array like any bit — and the sword's cut, whose wedge
    reaches a wall the same way;
  - a **worker or soldier bot's axe** on a siege flag (`robotStrike`).

  **`STRUCT_DR` (0.6) damps a player's blow, and only a player's.** Every one of those player
  numbers was tuned against a 40–160 hp *body* and would melt a 60 hp wall, so the damping is
  charged once, inside `hurtStruct`, rather than written out as a second building-sized number
  per weapon: raise a shot's damage and the siege scales with it, and a new ability never has to
  remember the rule. A bot names itself in the fourth argument and keeps its full `ROBOT_DMG`,
  which is already a building number. `STRUCT_HIT_DMG` is the **raw** E swing (25) and lands 10
  after the damping, at the `swingCd` of 0.34 s: ~2 s for a
  tier-1 wall (60 hp), ~10 s for a tier-3 one (300 hp), ~7.5 s for the bay (220 hp). A full-draw
  plain arrow lands 7, so a tier-1 wall is nine shots. At 0 hp it calls
  `destroyStructure(o, true, p)` and the wreck pays out exactly like a demolition, straight to
  the wrecker. Wildlife still damages nothing.

  **`structsNear(src, x, y, r)` is the buildings half of `unitsNear`** — every rival building
  the circle touches, resolved to its anchor and listed once, so an **area** effect reaches a
  wall through one call rather than a tile loop per ability, and a 3×2 bay is caught by whichever
  of its six tiles the ring actually crosses. `structFoe(src, s)` is its `unitFoe`: never your
  own, never a neutral, and PVP has nothing to say about it, because a wall is not a body.
- Demolish refunds **50% of the cumulative cost across tiers** (`cumulativeCost`, `structRefund`),
  paid to the demolisher on the spot through `awardGold` — 23 gold for a fully-upgraded wall —
  except **a site still going up for the first time, which hands its whole price back**, so a
  misplaced piece costs nothing but the walk (an upgrade under way is still the half). A wreck
  always pays the wrecker the half. `demolishStruct()` → `destroyStructure(o, 'own', p)` is the
  live path for that, reached from `runCmd` for the wheel's demolish order (the one order a site
  takes); the manage wheel's label shows the refund. `canAfford`/`pay`/`costText` are generic over every `inv` key. Demolishing is
  **not** guarded beyond that — no confirmation dialog exists anywhere in this game.
- **Every damaged building wears an hp bar** (`drawHealthBar`, centred on the sprite, `sy - 5`),
  drawn only once `hp < maxHp` so an untouched base stays clean — and never while `building`, when
  hp is climbing rather than falling. The bot bay is excluded: `drawBayOverlay` draws its own at
  `sy - 11`. Below 60% hp a building also picks up four crack marks placed as fractions of its
  sprite, so damage reads without the bar.
- No structure emits light (see [Lighting](rendering.md#light-and-weather)).

## Robots

`robots` holds the bay-owned worker bots (one 12×10 faceless tread-bot grid in team colour, two
tread frames — see [sprites.md](sprites.md)) — and the two eagles' [merchants](#the-merchant),
which ride the same list with `merchant: true`. `updateRobot()` mirrors the animal state machine plus
jobs — `updateUnitStatus` first, so a chassis wears every state a player can be put under
(`makeRobot` clears the full set into it): rooted, netted, slowed, marked, stunned, on fire, and
scrapped by a burn like anything else ([status effects](#status-effects-one-set-for-every-unit)).
The root and the slow are spent inside `navStep` for a routed drive and folded into `wander()` by
hand for the loiter, which is the only movement a worker steers itself. **What job it runs is decided by the [flag](#team-flags) the player who owns its
bay serves** (`flagOf(b)` — a human teammate's flag over the owner's own); with no flag it falls back to the original bay-centred gather: pick the
nearest tree/rock within 8 tiles of the bay's mouth (`structMouth`, also where they deposit)
(`nearestObj`), work it in 0.9 s ticks into a
`carry` gold count (same `YIELD` numbers as `hitObject`, tree-fall leaves a stump and pays the
jackpot — banked in the carry rather than paid on the spot), and walk home to deposit into their
owner's `inv.gold` with a floater at 8+ carried. A worker's `harvest()` handles **deadTree** too (the brown bear den's ring: quicker,
`YIELD.deadTree*`, and felling one calls `flushBirds`), because a flag can be planted on one.
Robots drive on `navStep` ([Pathfinding](#pathfinding): reach 1 to a tree, rock or building,
reach 0 to a body or home) and are solid to players and animals (see
[Unit collisions](#unit-collisions)); a target
with no route, or one they get pinned on the way to, goes on `b.avoid` for 12 s. They die with
their bay and are reaped like animals. They inherit their bay's `team`/`owner`, join the y-sorted draws via
`drawRobot()` in team colours (the whole sprite bobs while driving, the tool swings at a target,
carried gold shows as a nugget up front), and show a health bar. Their SFX are positional
(`sfxAt`) so a remote base doesn't spam audio.

**A worker can fight.** One axe swing, `ROBOT_DMG` (5) every `ROBOT_ATK_CD` (1.1 s) at
anything inside `ROBOT_REACH` (15 px) — flat, with nothing scaling it. `robotStrike(b, e, pt)` is the single blow: a building goes through
`hurtStruct` (the same path a player's E swing takes, so the wreck, the rubble payout and the
`WRECKED A` line are one code path), and any **body** through `hurtUnit` with `cause: 'worker'` —
all credited to `players[b.owner]`, so a worker kill pays the bounty and levels its owner like any
other. `cause` doubles as the feed's **verb** (`KILL_VERB`), so a
worker kill reads `YOU CUT DOWN <NAME>` instead of `SHOT`. Targets come from
`robotFoeUnit(b, range)` (nearest enemy player or worker; players are noticed through `seenAt`, so a
buried body is as invisible to a worker as to a wolf) and `enemyStructNear(team, x, y, r)`.
`foePoint(e, fx, fy)` is where the axe lands: a body a little above its feet, or **the nearest
point on a building's footprint** — the bay is 3×2 and a worker measuring to its centre could
never reach past the wall it is standing against. The same swing animation `drawRobot()` already
had draws it, off `b.atkAim` and `b.atkCd` instead of `b.tgt` and `b.workT`.

A worker is **shootable**: its hitbox is `ROBOT_HIT_R` (7) about `robotHitY(b)` (`b.y - 1`, the
middle of a body whose treads sit at `b.y + 4`), and `hurtRobot(b, dmg, nx, ny, src)` is the single entry
point for damage — flash, knockback, the damage total, a scrap-and-sparks burst, `SFX.hit`, and
`robotDies` at zero. Shots reach it (only from another team — friendly fire is off, as it is for
players, so a bay's own side drives through its workers safely), and so does every class ability
and the roll, all of them through `hurtUnit`. `robotDies(b, src)`
**hands whatever the worker was hauling to whoever downed it** (`awardGold` on `b.carry`) — which
is what keeps shooting a loaded worker on its way home worth the arrows — and logs
`<NAME> SCRAPPED A WORKER` to the feed. A downed worker is not a downed player, so it never touches
the kill count. `updateRobot`'s own `hp <= 0` check routes through the same function (with no
`src`, so the wreck goes unclaimed). A turret's rocks ride the arrow pipeline, so a turret's mark
dies to them; a rival's **worker on an attack flag** melees one; a rival's abilities and roll catch
one like any other body; nothing else — a player's E swing, wildlife, the AI's target
picker — goes after a worker.

`hurtRobot` also sets `b.mad`/`b.madT`/`b.madX`/`b.madY` when the hit came from another team **and
the worker is under a flag**: it fights back for `ROBOT_MAD` (6 s) from where it was standing, and
never follows past `ROBOT_LEASH` (90 px) of that spot. An unflagged worker is a defenceless
hauler — see [Team flags](#team-flags) for why the anger is gated on the flag.

### Soldiers: the waves

The `soldiers` banner (js/robots.js). Every `STRUCTS.barracks.waveT` seconds each merchant's
[barracks](#base-building) rolls out a column of **soldiers** — the worker's chassis under its
side's pennant (`drawRobot` stamps `drawFlagPennant` on a `kind: 'soldier'` body, the one thing
that says this bot is not here to chop) — that marches [the road](world.md#the-road) to the rival
bird. `makeSoldier(o)` is `makeRobot` with `kind: 'soldier'`, `owner: -1` (no flag reads it, no
cargo, no payout but the bounty) and a **route**: its own eagle's junction (`e.mouth` — down the
roost's spur to the road), `roadWaypoints(team)`, the rival's junction; the rival roost itself is
read live each frame, since
it may have flown. `updateSoldier` is four rungs, first hit wins:

1. a rival **unit** inside `SOLDIER_AGGRO` (96 px — `robotFoeUnit`, so a buried hunter lets a
   column walk past): close and swing (`robotStrike`, the worker's own `ROBOT_DMG` every
   `ROBOT_ATK_CD`, `cause: 'soldier'` — `DEATH_CAUSE.soldier` is the feed line);
2. the rival **bird** inside six tiles: the nearest roost tile (`aiEagleTile`), and
   `SOLDIER_EAGLE_DMG` (8, against a hand's 20) a swing through `hurtEagle` — ahead of any
   building, since whatever a side builds round its bird stands within a step of it;
3. a rival **building** inside `SOLDIER_SIEGE` (40 px — what is in its way: a turret, a
   wall across the spur, a rival bay): `hurtStruct` through the same `robotStrike`;
4. the **march**: the next waypoint (`SOLDIER_WP_R` to count it reached; one `navStep` cannot
   route to is *skipped*, never waited on, so a column never stands on a blocked tile), then the
   roost through its lane.

It is allowed to fight and nothing else — no tree tempts it, no flag recalls it. Two waves
meeting on the road therefore grind each other down (they are rival units to each other), which
is the stalemate a player breaks by walking out. It takes every hit, state and sweep like any
other body (`bot: true` is what `isAnimalUnit` reads to send a blow down the robot path rather
than the animal one — a soldier carries a `kind` too), the roosting bird's **gust** rears at it
and buffets it like a player (`updateEagle`/`eagleGust`), a turret marks it, and it dies through
`robotDies` carrying a `SOLDIER_BOUNTY` (4 gold, through `awardGold`, so the kill levels too) for
whoever scraps it — no feed line, five a wave. The cap on a barracks' live soldiers is
`STRUCTS.barracks.tiers[0].cap`. Bots read them as attackers at their bird and as targets in
sight, and a pusher walks with its own column ([multiplayer.md](multiplayer.md#bots)).

### The merchant

Each eagle is **driven** by its team's merchant — the old trader in the wide fur hat with the
team-cloth crown and the white beard, seated on the bird's neck in flight (`MERCH_SEAT`, `drawEagle`; the look is
[sprites.md](sprites.md)'s own 16 × 18 grids, built so it never reads as a player on either side,
with a `MERCH` nameplate and a bar in its side's paint over it, `drawMerchant`; the bird wears `PERCH`) — who climbs
down the moment it roosts (`spawnMerchant`, called
from `eagleCrash`, the `merchant` banner in js/robots.js) and works **home** for its side, never
toward the fight. It raises no walls and no guns (both stay on the build list for players). Its
first job is its **stall**, and after that **home production**: it fells the **back woods** and
raises the **bot bays** there.

**The stall** (`OBJECTS.stall`, world.js) is the shop players walk to. The moment the merchant is
off the bird it looks for a 3×2 site (`merchStallSite`) about `MERCH_STALL_OUT` (4.6) tiles from
the roost at `MERCH_STALL_ANG` (0.9 rad) either side of the spur's axis: beside the track's head,
where everybody lands and respawns, never on the track itself (`SPUR_HW` and a tile more), dry
land holding nothing the axe cannot take. It clears and hammers it exactly as a bay (the shared
`raise` inside `updateMerchant`), and `pitchStall` sets it: the anchor is the front-left tile (the
row the y-sort reads, like the hut's), parts east and north, and the ground under its shade is
repainted. It carries its `team` and nothing else: no `tool`, no hp and no place in `structures`,
so nothing swings at it, shoots it or sieges it. It goes up once, about twenty seconds after the
landing, and until then the merchant's own body is the only counter. A pine or snag it fells is a **log** in its own stock (`b.wood`, no gold, like
the crater and the spur). The back woods are every pine inside `MERCH_BACK_R` (13 tiles) of the
roost whose bearing off the spur's axis (`e.laneDir`, 0 toward the road) is at least
`MERCH_BACK_ARC` (90°): the half facing away from the road. `merchBackPine` picks the one nearest
the roost first (the merchant's own distance breaks near ties) that still has an open side to
stand on, so the clearing grows out from home as one front. Each falls to a **stump** at
`MERCH_SWING_T` a swing, and a timed `b.avoids` list keeps trunks no route reached out of the
pick (without it the pick flips forever between two walled-in trees).

The **bays** (the barracks, [base building](#base-building)) jump that queue whenever one is due.
The first is due `MERCH_BAY_T` (30 s) after the landing and is free; each after it costs
`MERCH_BAY_WOOD` (40) logs, up to `MERCH_BAYS` (3), which lands them at about 1:00, 2:00 and
3:45 of match time. They fan round the back of the roost `MERCH_BAY_BACK` (8) tiles out, on the
slots `merchBaySlots` lists in order: the first corner (`merchBayDir`: of the two back corners,
±135° off the spur's axis, the one pointing nearer the world's edge, mirrored for both sides),
straight back, then the other corner. `merchNextBay` takes the first slot with no bay standing on
it, and `merchBaySite` the nearest 3×2 placement to that slot's point whose footprint is dry land
holding nothing the axe cannot take. `merchBayBlocker` hands it every pine, snag and rock on the
footprint and a `MERCH_BAY_RING` (1) ring round it, and the stumps on the footprint alone, felled
at `MERCH_BAY_SWING` (0.34 s) through `merchFell` (the axe always leaves a stump everywhere but
the footprint itself). Then `MERCH_BAY_HAMMER` (2.6 s) of hammering from the tile below the door,
with the merchant wholly off the footprint so the bay never goes up round it, sets the site
(`createStruct`, nobody pays gold). A wrecked bay drops out of `b.bays` and holds the next raise
`MERCH_BAY_REBUILD` (45 s); the first bay of an empty yard is always free again, so a side is
never out of waves. The waves find the road themselves ([Soldiers](#soldiers-the-waves)): every
soldier's route starts at its own spur's junction.

With nothing due and the back woods felled, it keeps to its post at the head of the spur, a step or
two either way. **Wherever it is, it keeps shop** too: its own body is a
[counter](#the-merchants-counter) as well as its stall, open to either team, and it stands still
and faces a customer served at its body for as long as the sale takes.

It is a unit in `robots` with `merchant: true` and `kind: 'merchant'`: the same
`separateUnits` (player radius and mass — `unitRadius`/`UNIT_MASS.merchant`) and y-sorted draw a
worker rides, dispatched to `updateMerchant`/`drawMerchant` off the flag after `updateRobot`'s
shared status/stun handling. A bay's owner is the team's first player (`createStruct` needs
one). `owner` is -1, so it reads no flag and no flag ever recalls it.

**It cannot be hurt, and it has no `hp` field at all rather than a large one.** `unitAlive`
(js/actions.js) answers false for a merchant, and that one function is the gate every target
picker in the game asks (CLAUDE.md's `unitAlive` rule; here also a turret's `turretAim`, a
worker's `robotFoeUnit` and a flag's `flagFoe`) — so
it is invisible to every weapon in the world rather than merely immune to one of them. It draws no
health bar either: a full bar that could never move would promise a fight that is not on offer.
`DBG.merchants` lists both.

## Team flags

**One order marker per player, of four kinds, that the whole side reads — every worker bot out of
a bay the planter owns, and every AI player on the team.** A flag is an **area**: `FLAG_R` (192 px,
twelve tiles) round the tile it stands on is the ground the order is about, and a ring on the snow
says so. The sim side is the `team flags` banner in [robots.js](../../js/robots.js) plus the
dispatch at the tail of `updateRobot()`; how an AI *player* answers one is the `flag` rung in
[ai.js](../../js/ai.js) ([Bots](multiplayer.md#bots)); the wheel is the `radial wheel` banner in
[js/ui/wheel.js](../../js/ui/wheel.js).

**The wheel is the order.** Right-click any tile (building is the list on T and managing is E —
[base building](#base-building); the HUD swallows its own presses), or press the `flag` key, and
the **flag wheel** opens on it, on the build wheel's own grammar — held open, the travel from the press picks, the
release plants: `FLAG_ORDER` clockwise from straight up, **ATTACK, DEFEND, GATHER, RALLY**
(`FLAG_TYPES`), each a wedge carrying its glyph at twice the banner's size. The hub cancels — unless
the wheel stands on your own flag, in which case the hub *is* the flag (it wears the pennant, the
label reads LIFT) and releasing there picks it up. R3 on a pad opens the
same wheel over the aim. `resolveWheel` writes `input.cmd = { kind: 'flag', tx, ty, id }` and
`runCmd` performs it next step — `plantFlag(p, tx, ty, type)`, or `clearFlag(p)` for the lift —
so the human's radial and a bot's `plantFlag` end in one function. A flag has no reach and goes
through no `contest()`: it is per-player state, not an act in the world.

| order | the crew, inside the ring | an AI teammate, inside the ring |
| --- | --- | --- |
| **ATTACK** | kill every rival unit and break every rival building in it (`flagFoe`: units first, a player through `seenAt`, a rival wave's soldiers included), chasing no further than `ROBOT_LEASH` past the rim; nothing left → hold the flag | a ring over the rival bird is a **push** (rung 8, the lane and the archer's station and all); anywhere else, break the nearest rival building with E and hold the ground when none is left — rivals in sight are rung 3's, the ring anchors them |
| **DEFEND** | hold the flag in a ring of posts and swing at whatever enters, never following out of the rim | a ring over its own bird is the **defend** rung (6); anywhere else, stand on the ring and go on down the ladder — hunt, loot, spend, harvest bounded to the ring, and stand where it would have roamed |
| **GATHER** | cut and mine everything in the ring, nearest the flag first (`cutNear`), banking a load at home at 8+ | walk in, then harvest bounded to the ring |
| **RALLY** | come and stand (a load is banked only if home is right there) | come and stand, fighting only a rival inside `AI_SIEGE_R` on the way — a rally is a disengage |

Only `{ tx, ty, type, owner }` is stored on `p.flag`; everything else is re-read off the ring as
it is needed, which is what makes the orders *survive their own success*: felling every tree
inside a GATHER ring leaves the crew holding the flag rather than stranded, and wrecking the last
building inside an ATTACK ring holds the ground it stood on.

**Whose flag a body serves** is one function, `servedFlag(p)`: **a human teammate's flag, if one
stands; else the teammate's flag a bot has joined; else its own.** That first clause is the whole
of command: *a human's flag is the side's plan.* While it stands every bot on the team lifts its
own flag (`aiFlagSync`) and walks to the human's from anywhere on the map — the defend, guard,
push and escort reads all give way to it — and every worker on the side (an AI teammate's bays
included, through `flagOf`) reads it. The one thing no order overrides is the **alarm**: a bird
under half its nerve calls everyone home regardless. Bots fly flags of their own, but **a bot's
flag is never a decision of its own — it is the ladder's decision made visible**: DEFEND at its
bird when it is walking home to a threat, ATTACK at the rival bird when it is pushing, GATHER
where it works (a guard's routine station flies nothing). Coordination is *one flag a plan, not
one a bot*: a bot plants nothing a teammate is already flying over the same ground
(`teamFlagAt`) — it joins that flag (`ai.join`) — and a bot with nothing of its own to fly helps
at the side's nearest standing flag that wants hands (`nearestTeamFlag` under `aiHelps`: an
ATTACK from anywhere unless it is one of the side's guards, a GATHER only inside `AI_FLAG_HELP`,
a DEFEND never — the threat read already calls exactly the number home — a RALLY from
anywhere). No bot ever flies a RALLY; there is no retreat in the ladder to make visible. The
whole of that is [the order](multiplayer.md#bots) in the ladder.

- **Moving is planting.** One flag per player, so planting anywhere moves it, and `flagRecall(p)`
  clears every worker that will read the new order (the whole side's for a human's flag, the
  owner's own for a bot's) the frame it lands, so the crew is *visibly* seen to turn.
- **A worker never chases off a flag but an ATTACK.** On every other order it swings back at
  whoever hit it and no further, and with no flag at all it does not fight (`b.mad`,
  [Robots](#robots)).
- It works **over the chart (M) too**: the right button opens the wheel on the chart's tile
  (`mapTileAt`) and pins it to the press point (`w.sx`/`w.sy`, `wheelLayout`) — the only way to
  order a tile that is off-screen. One chart pixel is 1 to ~1.2 tiles (`MAP_S`: the chart fits
  the view, 232 px at 360 rows, `fitMapSlab`), so a map order is ±1
  tile: fine for "take that bird", not for picking one tree.
- The middle mouse button does nothing.

**What it looks like** (the `what a flag looks like` group in [js/draw/marks.js](../../js/draw/marks.js);
`FLAG_TYPES`, in robots.js, holds the 7×7 glyph grids as camp-glyph-style rect lists):

- **The ring**, `drawFlagRing`, flat on the snow under everything that walks it (`drawFlagRings`,
  called from the world pass right after the flat statics): a dark line under a dashed one in the
  **side's ink** (`TEAMS[skin(team)].mark` — never white: white on snow is a ring nobody
  sees), two pixels wide, the dashes crawling round it so a standing order reads as
  *live* and not as a boundary painted on the map. On both maps `drawFlagMark` draws the same
  ground washed in the side's ink under a dark rim and a solid line of that ink. It is drawn on the world canvas, so it scales with the tile — it is
  a place, not a HUD element. While a flag wheel is held over the world the same function previews
  the ring the pick would lay, in the lit wedge's colour, or grey from the hub where nothing is
  chosen yet; over the chart the chart draws that preview itself.
- **Two colours for the glyphs, and they carry the stakes, not the order** (`FLAG_MINE` /
  `FLAG_FOE`, on the wheel's icons, the planted banner and the plant burst): DEFEND, GATHER and
  RALLY wear the game's standard bright ink, ATTACK the danger red. The *glyph* says which order it
  is; amber and green are already spoken for (affordable / interactable, and good) and an order is
  neither. The ring says whose ground, in the side's ink — the one colour the whole side already
  reads on every nameplate and map mark.
- **The planted flag**, `drawFlag()`, y-sorted into the world draws half a pixel behind its own
  tile so a flag on a tree isn't swallowed by the canopy: a pole with a **dark banner carrying the
  order's glyph inked in the team's colour**. Dark cloth and a bright glyph, not the reverse — at
  nine pixels square a solid colour with a hole punched in it is a blob, and the glyph is the
  message. Only your own side's flags are drawn (an order marker is not intelligence to hand a
  rival, and neither is the puff it lands with — `plantFlag`'s burst is the local side's only), on
  all three surfaces.
- **Both maps**, through the shared `drawFlagMark()`: the pennant in the team's colour with the
  ring it covers about it at that map's px per tile — a disc on the minimap (clipped to the disc,
  so a flag just off its edge shows as its rim) and the same on the chart, with the glyph over it.

## Death and respawn

Death is a walk back, never the end: while your team's eagle still roosts (`teamEagleDown`, the
eagle-drop banner in js/boot.js) going down costs a **timer and nothing else**, and you are
set down again at the bird ([Respawn at the bird](multiplayer.md#respawn-at-the-bird)); once the
eagle has been driven off every death on that side is permanent, and that is the only way anyone
is ever out of a match. `die(p, src, cause)` marks that player dead and drops its bow draw,
momentum and zipline handle either way. **Death keeps everything**: the wallet, the pouch, the
bag, the weapon and the build loaded into it, the unopened cards, the gear, the skill ranks, the
level and xp all stay on the body, and `reset(false)` brings the same player back — nothing
spills, nothing is looted, and the snow around a corpse is as clean as it was. (An item riding
the cursor mid-drag goes back in the bag, so it is still there when the body comes back instead
of vanishing with the hand holding it.) **What a kill is worth
is a flat bounty from nowhere**: `KILL_BOUNTY` (12, beside `die`; a scrapped soldier's
`SOLDIER_BOUNTY` is 4, so a player is three of them) to the credited killer through `awardGold`,
so a kill still levels the killer and taking the fight is still worth it — while an uncredited
death (ice, wolves, or the killer already dead) pays nobody. `die` also credits the kill (and
heals the killer if their kit carries `killHeal`, off a card) and writes the log line — see
[Kills and the event log](multiplayer.md#kills-and-the-event-log) — then asks
`teamEagleDown(p.team)`: with the eagle still roosting, `p.respawnT` starts counting down
(`respawnTime(p)`, `updateRespawns` — see [Respawn at the bird](multiplayer.md#respawn-at-the-bird)
for the whole path); with it driven off, `p.eliminated = true`, the permanent path. Either way
`checkLastStanding()` asks whether every **rival team** is now gone, which ends the match as a
win — a team-level question a kill can never answer, since a side is in the match while its bird
roosts ([PvP](multiplayer.md#pvp)).

Either way the local player's overlay goes up through `endMatch('lost' | 'won' | 'respawning')`
(js/player.js, the `damage & death` banner; the screens it raises are the `death & spectate`
banner, js/ui/screens.js): `state.mode = 'dead'`, every local overlay closed, and the screen goes
to a dim with two planks — **SPECTATE** and **LOBBY** — for `'lost'` (permanent), to
[the victory screen](rendering.md#the-end-screens), whose planks are **KEEP PLAYING** and
**LOBBY**, for `'won'`, or, for `'respawning'` (temporary), to **the wait**: no dim and no planks
at all — `endMatch` puts the view on an ally (`viewPlayer` holds it on the body until its
[fall](rendering.md#going-down) is over) (`state.deadView = 'spec'`, `specNext` keeping to
the side's own through `specOk`), one line — **RESPAWNING IN Ns** at 3× in the upper band — reads
the live countdown, and [the replay window](rendering.md#replay-the-last-four-seconds) opens large
over the view with a close box on its corner (or ESC), so the death is watched first and the ally
after, the player choosing when. **LOBBY** on a `'lost'` dim does not leave: it opens
[the defeat screen](rendering.md#the-end-screens), the loss's own summary — a lost match ends when
you stop watching it, not the instant you go down. LOBBY on **either** ceremony then opens
[the post-game lobby](rendering.md#the-post-game-lobby), the whole match's record, and that
screen's LOBBY is the door out.
`'respawning'` needs no state of its own beyond `state.rpClosed` (reset by every `endMatch`):
once `p.respawnT` hits 0, `respawnPlayer(p)` snaps `state.mode` back to `'play'` the same
one-line way `'KEEP PLAYING'` already does, lands the local player at its bird, and replays the HUD
slide-in a fresh eagle landing gets. A win *or* an elimination also freezes what its screen will
print (`endSnapshot()` on `state.end`: gold, kills, level, clock, team, class, the kit, and the
placing and killer only the loss prints) because the match keeps running underneath and a total
that climbs behind a tally which already counted it reads as a bug — and because a loss's summary
is opened off a plank minutes later, by which time none of those numbers are still true. Spectating
sets `state.spec` to a living player's id and `viewPlayer()` — the one place the camera and minimap
ask who to frame — returns it. The control is
a top-centre `[<] NAME [>]` strip (`specLayout`/`specHit`, sized to the widest player name so the
arrows never shift): clicking an arrow or pressing the arrow keys cycles (`specNext`, player order,
skipping the dead — and skipping rivals while a respawn wait runs, since the wait is not a scouting
window), ESC returns to the planks (on a wait, which has none, it closes the replay instead), and a
watched player that dies hands the view to the next. There is deliberately no hint text; with nobody left the plate shows a dash instead of a name. LOBBY (`toLobby`) fades to dark and reloads
the page on the same seed, which boots into the title screen. **TAB still opens the standings
while you are out**, which is the point of holding them above the dim.
`state.mode` is `title | drop | play | dead`, and `updatePlay()` runs in `play`, `dead` **and**
`drop` (the clock starts with the eagle; airborne players are skipped) — the match carries on
without you, and `updateRespawns` ticks a respawn timer down under the `'respawning'` overlay the
same way. Only **pause (P) and the settings panel (ESC)** stop the sim;
`update()` (time, darkness, camera, fx) always keeps running. In `title` only the ambient half
runs (`updateTitle`: animals and fish) — see [Main menu](rendering.md#main-menu-title).

## The M map does not pause

**M** opens the world chart with the sim still stepping (M, Escape or its CLOSE plank put it
away), the same deal the [build list](#base-building) takes: night still falls, arrows still fly, bots still hunt you.
`sampleHumanInput` handles it in its own branch, and the rule is *the map keeps your feet and
nothing else*: `mx`/`my`, `slide` and the grapple's held key are read as usual, the edge-triggered
`dodge` passes
straight through, and `fire`/`work`/`eatBerry`/`eatFish`/`cmd` are dropped along with any held
draw (the pointer is over the parchment, so there is nothing to aim or work at, and a gear plate
bought blind under the dim would be bought by accident). So you walk with the chart up and watch
your own marker cross it. Consequences worth knowing:

- The replay ring keeps recording (`replayLive`) — the capture point is above the map's dim, so
  the banked frames are clean world frames. `replayShowing` still hides the *window* under the panel.
- Dying with the map open is possible; `endMatch` clears `state.mapOpen`, and M only toggles in `play` and `drop` modes (mid-flight it is the ride's
  wide read; `landPlayer` closes it at touchdown), so the chart cannot survive into the death
  overlay.
- The world keeps the zoom you were playing at. The slab is UI and fits the view whatever the
  zoom (`fitMapSlab`, js/canvas.js: the chart takes the rows the view gives it, 96 up to
  `CHART_MAX` 232 px; [World zoom](rendering.md#world-zoom-and-the-two-pixel-spaces)), so
  opening the map never touches the camera.

## Saved matches

A **solo** match can be saved at any step and loaded later exactly where it stood: every body,
arrow in flight, building, drop, camp, the counter's stock and prices, the clock, and the three
seeded streams' positions (`rng`, `fxRng`, `mktRng` - `mulberry32` keeps its state on the
function as `.s` for this). A loaded match does not merely look like the saved one, it **plays
out** the same from that step: the proof is below. An online match (host or client) and the
practice room never save (`canSave`, js/save.js), nor does a match that is already decided.

**How it works** (js/save.js). The world is a seed: a load is a page on the saved `?seed` and
`?map`, which grows the very same valley, and the save is what the match has done to it since.
`saveBaseline` records the valley as it grew, at boot, before anything moves (each tile's object
by reference with a hash of its contents, and the ground); `saveCapture` then writes

- **the roots** (`SAVE_ROOTS`): every mutable global the sim reads - `state` without its UI keys
  (`SAVE_STATE_SKIP`: the panels, the drag, the fade, the intro), `players`, the entity arrays,
  `iceCracks`, `market`, the streams, wildlife's and the bot brain's module `let`s, the post-game
  record, and the camera and zoom - **as one object graph**, so a reference shared anywhere (a
  bot's hunt target, a den's camp, `player` as `players[localId]`) comes back shared. JSON with a
  handful of `$` tags: an object reached twice is written once and pointed at, a `Player` comes
  back with its class, `Map`/`Set`/typed arrays/`NaN`/`Infinity`/`-0`/`undefined` survive, and
  so do an array's own fields (a route's `partial`, js/nav.js - dropping it once made a loaded
  bot re-plan a step early); a reference into a static table (`saveTables`, three levels down:
  a camp's `CAMPS` row) is written as its path;
- **only the map objects and ground tiles that differ from the grown valley.** A reference to an
  untouched tile object is its tile index, so the 30 000-odd pines are never written. A tile
  object that points at a live thing (a den, hut or cairn at its camp's `site`, and the parts of
  its footprint) is always written, because the fresh valley's copy would point at the fresh
  page's camp.

**A new mutable global the sim reads joins `SAVE_ROOTS`**, or a loaded match silently forgets it
(the CLAUDE.md rule). A new *field* on anything already saved rides along untold. Functions and
canvases are nobody's state and are dropped (a console warning names the path if one turns up).

**The flow.** `saveMatch(slot)` takes the match synchronously on the step it was pressed, gzips it
(`CompressionStream`, base64 behind a `z`: 20-130 KB a save against 300 KB-1 MB of JSON) and hands
it to `PROFILE.putSave` - the metas (hero, level, clock, when, name, a 40 px minimap thumbnail) under one
index key so a list never opens a body, each body under its own. `loadSave(slot)` fades out,
unpacks the body into `sessionStorage` (`softfall.load`) and reloads onto the saved seed and
shape; boot calls `saveBootLoad` after the world stands and **before `prepGround`**, so the bake
paints the saved valley, then `saveBootEnter` once boot is done (the saved camera, the fade up
from dark, the match's music; no HUD slide, whose ease would move the camera and pop the day's
headline).

The ESC panel, and so the SAVES plank, is only up in play; the eagle's ride and a respawn wait
are covered by the autosave alone.

**Slots.** Five manual slots (`m0`-`m4`) and an autosave ring of three (`a0`-`a2`, the oldest
overwritten): an autosave every `SAVE_AUTO_T` (120 s) of match clock (`saveAutoTick`, from the
frame loop after the steps) and on the way into the ESC panel or the pause plate, never two inside
`SAVE_AUTO_GAP` (15 s). A save that lands flashes a gold down-arrow under the minimap, beside the match
clock where that hangs there (`drawSaveFlash`).

**The screens** (js/ui/saves.js). One grid: five manual cards over the autosave ring, each its
match at a glance - the thumbnail with the match clock (gold) and how long ago
(`NOW`/`12M`/`5H`/`3D`) on its foot, the save's **name** (`saveTitleOf`: the player's, else
`DAY n`), the class emblem and level; an empty manual card is a +, an autosave wears two chasing
arrows. There is no verb to pick: each card says its own (`svVerb`). A press on an empty manual
card (+) saves the match into it; a press on a kept card loads it; nothing writes over a kept
card (its X clears the slot, then its + takes the new save). In a match it opens on the settings
slab off the ESC panel's one **SAVES** button, which is there only while `canSave()` (a solo match:
never practice or online). In the **solo lobby** it is a pop-up off the **SAVES plate** - a third
plate beside the map and the target, there only while the profile holds a save: the newest save's
picture on a fanned stack of cards, its name under it, a play arrow over it under the hand - LOAD
only (an empty card does nothing with no match to keep), the newest card lit when it opens (`beginSavesPick`), so Enter picks the last match back up.
The title list itself carries nothing about saves. Loading over the match you are in arms the
card first (gold rim, the play arrow over the thumbnail, `SV_ARM_T`), and a second press does it.
The arrows walk the cards.

Every kept card has three handles beside its press. The **X** in its corner (out under the hand,
or on the picked card; Delete, a pad's X) arms it red, and a second press deletes it
(`savesDelete`). Its **name** is typed over in place - a click on it (the pencil shows beside it) or
F2, up to `SV_NAME_MAX` letters, digits and single spaces, Enter keeping it and Escape dropping it;
an emptied name falls back to the day, and a slot the player named keeps its name when written
over (`meta.named`). While a name is typed it owns the keyboard (`savesEditKey`, routed first in
`keyPress`). And the card can be **carried**: pressed and moved `SV_DRAG_PX` it rides the pointer,
the slot it left dark, and dropped on another manual slot the two trade places (Shift with Left or
Right steps a manual card one slot along); an autosave dropped on an EMPTY manual slot is kept
there and stops being one. The ring keeps the order it was written in, so nothing lands on it, and
the slot under a carried card rims gold where it may land and red where it may not
(`savesCanMove`, `PROFILE.swapSaves`). A load makes the character that played the save the active
one, so what the match adds to a lifetime tally lands on the right card.

**The proof** (`DBG.saveHash`: a hash of everything a save carries, less the camera and what
runs on the frame's clock rather than the match's - the snowfall, which `updateFx` sways on
`performance.now` and tops up off `fxRng`, so an ember's tint, the one draw that stream lends the
sim, and the wade's look a draw pass eases on each body, `SAVE_FRAME_KEYS`). Step a match on a frozen page, `saveMatch`, keep stepping and hash; `loadSave` it onto a
page frozen from its first frame, step the same counts and hash: the two must agree at every
count, across all three shapes, from a save made in the eagle's ride, early in play with the local
human idle, and deep in a ten-bot match with hundreds of buildings and robots standing.

## Settings

**The MULTIPLAYER plank** (js/ui/menu.js, the `rooms` banner) is the relay's open rooms as planks
under a HOST plank, a relay pip beside HOST (green and breathing while the list socket is open,
red and blinking while it is not) and, while the list is empty, one ghost of a row where the
first room will stand. A room's plank carries its host's name, ten seat pips (five a side, the
people in them lit in that side's paint - the relay lists a count per side), its four-letter
code on a plate (the thing a host reads aloud) and a red dot once its match is under way; a room
on another patch is dimmed and inert with its patch printed where the code would be. HOST makes
a room on the relay and opens the **waiting room** - the lobby, which every peer
sees as the host does, with the room's code on a 2x plate under the relay pip at the head of
your side's roster, a crown over the host's card, a brighter rim on every person's card than a
bot's, and a white flash with a cue on a card whose kind changed (someone came, or went). A
guest sees it minus the two pop-ups off the map plate and the target and the character swap (its class came with it), and
where LOCK IN would be a frozen plank wearing the host's name: the host's count comes over it and
the eagle on the host's zero. A guest whose host walks out of the waiting room is back on the
rooms list with a rattle; one whose host leaves mid-match gets the HOST LEFT end screen (a
headline and a LOBBY plank over the frozen world, `hostleft` in DEAD_ITEMS, js/ui/screens.js),
and one whose socket drops mid-match shows a red pip blinking top-centre until the transport
redials (`drawNetLink`). Joining a room whose seed is not this page's reloads the page onto it
(`?seed=N&join=CODE`). Under the wrapper with Steam asked for (`netSteam()`, js/net/net.js) the
same screen lists Steam's lobbies instead (`steamRooms`, js/net/transport-steam.js: the host
writes its name, patch, seed, state and seat counts into the lobby's data), joined with the same
click and with no code plate, since a lobby id is not for reading aloud. Which relay:
`netRelay()` (js/net/net.js) - `?relay=host:port` once,
remembered with the settings (`settings.relay`), else the page's own host.

`settings` (`v`, `volume`, `musicVol`, `sfxVol`, `mmR`, `mmZoom`, `hudScale`, `shake`, `muted`, `info`, `pixelCursor`, `hitbox`,
`teamBlue` — your side always painted BLUE, see [teams and colours](multiplayer.md#teams-and-colours) —
`teamPal` — the VIDEO page's COLOUR BLIND dropdown: `def` (OFF) or a colour-blind palette (`rg`, `by`, `hc`), same section —
`tipFollow` — the TOOLTIP row, the hover panel beside the pointer (the default) or parked bottom
left ([the hover tooltip](rendering.md#the-hover-tooltip)) —
`aiLevel` — the rival bots' level, picked in the lobby's AI pop-up, an index into `AI_LEVELS` (js/ai-skill.js), NORMAL until moved (a settings save from before EASY is moved up one, `loadSettings`) —
`mapType` — the map shape picked in the lobby's map pop-up, an index into `MAPS` (js/world.js); it is
what the NEXT load grows — LOCK IN reloads onto it when it is not this page's shape ([map shapes](world.md#map-shapes)) —
`scheme` — the keyboard scheme, `'wasd'` or `'click'` — with `binds` / `bindsClick`, the key
each action is bound to under each
([the two controllers](multiplayer.md#the-two-controllers)) —
`haptics` — the RUMBLE row, the pad's motor — `relay` (above) —
`fpsCap` — the FPS CAP row, frames the loop may present a second, 0 = every frame the screen
offers ([the fixed step](code-map.md#jsbootjs)) —
and the five video toggles `vidClouds`/`vidRays`/`vidStars`/`vidSnow`/`vidVig`) persists
**under the player profile** — `saveSettings()` is a call to `PROFILE.putSettings()` and
`loadSettings()` reads `PROFILE.settings()`, which returns `null` when this profile has never
saved any (the pre-profile migration: [architecture.md](architecture.md#profilejs)). `applyMinimapSize()` must be called after changing `mmR` —
it recomputes `MM_R`/`MM_CX`/`MM_CY`. `hudScale` (the HUD SIZE slider, default **1**; it steps between the screen's crisp sizes from 0.5 to 1.5, `hudSizes`, and a stored value draws at the nearest one, `hudSc`) needs no apply
call: the hud strip, the pack and the shelf read it live every frame
([rendering.md](rendering.md#the-hud-strip)). The **backpack** has no open/closed state: it is always up
([rendering.md](rendering.md#the-backpack)). (Old saves may still carry `res`, `fps`, `seed` or `paths` keys from removed settings;
`Object.assign` in `loadSettings` copies them harmlessly and nothing reads them.)

There is no fullscreen control in the ESC menu (players use F11); a `fullscreenchange` listener still refits the canvas when the
browser toggles it.

**The panel is a flat, solid slab** (`bakeFlatSlab`: an ink outline, one quiet steel line, a flat
night ground, never see-through) headed like the patch notes: its name big and gold with no rule
under it (`drawSlabHead`), the SAVES slab in its place the same. A toggle is a switch (gold track, knob
right when on), and the row under the pointer lifts as a band with its name white.

**The panel is tabbed.** A navbar under the title splits the rows into four pages — GAME
(minimap size, hud size, screen shake, rumble, info display, cursor, tooltip, my team), VIDEO (below),
AUDIO (the three sound dials and the speaker), CONTROLS (the listings, below) — and each page scrolls independently
inside the content window (`SET_CONTENT_Y`..`SET_CONTENT_B`, panel-local 43..202) when its rows
outgrow it, which is what lets the slab hold any number of future settings: the slab is 320×226
(`SET_W`/`SET_H`, canvas.js), and 226 fits under the 240-row floor `fitCanvas()` keeps, so it can never get taller. The wheel over the
open panel scrolls the open page (both the in-match ESC slab and the title's slide-in — the
title also takes W/S and the arrows), a 1 px thumb on the right edge appears only when a page
overflows, and the open page's name wears gold with a 1 px gold line under the word alone
(`drawNavCell`, the CONTROLS sub-navbar the same) while the others sit dim until hovered. Everything inside the panel is laid out by **`settingsLayout()`** (js/ui/panels.js) off
the row tables in `SET_TABS` — draw, hit test and the `DBG.settingsRows` anchors all read the
same function, so a click can never disagree with a pixel. Rows keep the **14 px pitch**;
`settingsHit()`'s bands are `y-3 .. y+10`, touching but never overlapping, so one click can
never land on two rows. It answers a row id, `'mute'`, `'close'`, `'leave'`, `'tab:<id>'`, `'ctab:<id>'`
(a CONTROLS sub-tab), `'c:<row>:<opt>'` (a choice row's word), `'drop:<row>'` (a dropdown's box) or
`'d:<row>:<opt>'` (an entry of the open list). A **choice row** carries its
own `val()` and `pick(id)` in `SET_TABS` — QUALITY's are the preset macro — so the draw (the word in force wears gold), the hit and
the click all read one table. A **toggle row** whose two states have names of their own carries
them there too, as `on`/`off` (CURSOR's PIXEL / BROWSER, TOOLTIP's FOLLOWS POINTER / BOTTOM LEFT,
MY TEAM's ALWAYS BLUE / AS DEALT); a row without them reads ON / OFF, and a plain toggle's row id
**is** its `settings` key, which is the whole of what its click does. A **dropdown row** (`kind: 'drop'`)
carries `val`/`pick` like a choice row; its box shows the entry in force and a click hangs the
list under it (`setDrop`), drawn over the page outside its clip. While the list is open it takes
the whole pointer: a click on an entry picks it, any click folds it, and ESC folds it before the panel.
The HUD SIZE slider steps notch to notch (a tick under the track at each): only the sizes
`hudSizes` finds crisp on this screen ([rendering](rendering.md#the-hud-strip)).

**The VIDEO page** holds one QUALITY row, five toggles and the COLOUR BLIND dropdown, every one a cosmetic-only render
pass a weak GPU can shed (they read at draw time; nothing the sim computes changes):
CLOUD SHADOWS (`vidClouds` — `cloudShade`'s two full-view multiply fills, the one pass that
costs every daytime frame), SUN SHAFTS (`vidRays` — `godRays` and its motes), ICE STARS
(`vidStars` — the whole `drawIceStars` pass, mirror included), SNOWFALL (`vidSnow` — the
falling flakes' draw; the sim still moves them), VIGNETTE (`vidVig` — the frame vignette only,
the hurt flash is feedback and never goes). The QUALITY row's LOW / MEDIUM / HIGH words are a
macro over four of them — clouds, shafts, stars and the vignette (`VID_PRESETS`): LOW turns them all off, MEDIUM keeps
everything but the cloud shadows, HIGH is everything, and the word matching the current mix
wears gold — a hand-picked mix golds none of them. SNOWFALL is deliberately in no preset:
falling snow is the game's identity and nearly free, so only a deliberate hand turns it off.
Between QUALITY and the toggles sits **FPS CAP** — 30 / 60 / 120 / 144 / UNLIMITED, a choice row
whose words are numbers because the row is an instrument — `settings.fpsCap`, which
`capSkips` (js/boot.js, [the fixed step](code-map.md#jsbootjs)) reads at the top of every
animation frame: a frame under the cap is skipped whole, its time banked into the next, so
the sim still takes every 1/60 s step it is owed and only the presentation thins. UNLIMITED
is every frame the screen offers. Last sits **COLOUR BLIND**, the team palettes
([colour-blind palettes](multiplayer.md#teams-and-colours)) named by what each is for: OFF,
PROTANOPIA / DEUTERANOPIA, TRITANOPIA, ACHROMATOPSIA, each entry beside its palette's chip.

**The foot is buttons, not a hint.** Under the content window (`SET_FOOT_Y`, `footPlanks`) sit
flat buttons (`drawFlatButton`, their line and word gold under the pointer): **CLOSE** — the one way out that is a
button; ESC and the pad's B still fold the slab — and, in a match only, the way out beside it,
LEAVE, out of the match or out of [practice](world.md#the-practice-arena) (the ESC
slab is the one menu either has, so its exit lives there; the title's slide-in has nothing to
leave, so it centres CLOSE alone). A solo match hangs **SAVES** between the two (while `canSave()`:
the [saves grid](#saved-matches)). `settingsHit()` answers `'close'` (→ `settingsClose`: the
in-match slab folds the way ESC folds it, the title's slide-in through `closeMenuPanel`),
`'saves'` (→ `openSaves`, js/ui/saves.js) and
`'leave'` (→ `toLobby()`, js/ui/screens.js, the death screen's own fade back to the title on this
seed, or `leavePractice()`, js/ui/menu.js, the reroll's whiteout onto a bare URL, landing on a fresh
title world); `leavePlankRect()` is the LEAVE plank, `null` on the title. While the saves grid is
up it stands in the panel's place: `renderSettings`, `settingsHit`, `settingsMouseDown` and
`settingsKey` each hand straight to it, and Escape backs out of it before it folds the panel.

**Mute is not a row.** It is a 9×9 speaker plate (`muteBtnRect`, `drawMuteBtn`) hard against the
left end of the MASTER track on the AUDIO page — `muteBtnRect()` returns `null` on any other
page, and its callers null-check: a cone with two waves coming off it, the waves swapped for a
red × when it is off. While muted all three sound dials draw grey rather than gold
(`drawSliderRow`'s `dim`), so what the speaker silences reads off the page without a word of
text. **N** still toggles the same flag from anywhere.

**The CONTROLS page is itself tabbed** — WASD, CLICK, MOUSE, GAMEPAD (`CTRL_TABS`, each cell
naming its listing in `ctrl`), one listing per controller, since a pad puts the
same verbs somewhere else — and the keyboard's listing is **three cells, one per scheme**: the
cell in gold is the scheme in force (`ctrlCellNow`), and a click on the other makes it the
live scheme (`settings.scheme`, dropping every order the click scheme held) as well as opening
its listing, so there is no SCHEME row and no words to switch. Its sub-navbar is
pinned at the top of the content window (`CTRL_TAB_H`) and only the listing under it scrolls;
it opens on the controller in hand (`ctrlTabNow`: GAMEPAD while a pad is
active — a green pip beside that word says one is — the keyboard otherwise) until a click picks
one. Every listing is **three columns** (`CTRL_COL_X`) grouped by what the verbs are for —
moving and fighting, the kit and its panels, the match's own keys — so it fits the window
without a scroll. The pad's listing is baked once (`bakeCtrlPad` into
`ctrlCvs`, js/ui/panels.js); **the keyboard's is live**: each rebindable verb beside
its key drawn as a **cap** — the same cap the work prompt wears in the world (`drawKeyCap`,
js/ui/wheel.js), printing whatever key the action is bound to — and the fixed ones (the mouse's
buttons, ESC, SCROLL, F3, `.`, where the scheme has room for them) as plain gold text, since nothing about them can be pressed. A
cap is a button: it lifts white on hover, a click sets it **listening** (the face pulses gold)
and the next key down is its key; a key another cap holds swaps the two, a reserved key is
refused, Escape or a click elsewhere calls it off
([rebinding](multiplayer.md#the-two-controllers)). RESET, a row under the listing at its right
edge, puts the defaults back and sits dim while they already are. `KEY_ROWS` is the three
columns per scheme (an action id, a run of caps on one verb — MOVE, ABILITIES — or a fixed pair), `keyRowsLayout`
places every cap and word listing-local, and the draw (`drawKeyRows`), `settingsHit`
(`'key:<action>'`, `'keyreset'`) and `DBG.keyRows` all read it. Under a rule at
`KEYS_PRIMER_Y`, baked (`bakeCtrlKeys`), **THE WEAPON** — the one thing about the left button a
new player cannot work out by pressing it, drawn rather than explained (`drawToolPrimer`); the
page is long enough that its scroll track appears.
GAMEPAD draws each button as a picture (`drawPadGlyph`: a face button is a disc with its
letter, a bumper a flat pill, a trigger a tall one, a stick a ring, the dpad a cross with its
pressed arm lit) beside its verb — moving and fighting, the abilities and the kit, then the
match's buttons with the menu set under a rule — and its live readout under them. The bindings themselves: [the two controllers](multiplayer.md#the-two-controllers).

The primer is a **real HORN BOW** — FLAME, ARROW, ARROW — sorted by `sortBits` and run through
`toolPlan` at bake time, so the picture cannot drift from the weapon: the shots sit left, the
flame right, and its line reaches both arrows. The cells, the hatch on the modifier and the lines
are the **same marks** the shelf draws in play (`modPlate`, js/ui/hud-draw.js, takes the context
to paint so a bake can borrow it) — what is learned here is recognised there. Each kind gets one
note in its own colour, and four lines close it: one click fires everything loaded, every
modifier shapes every shot, a heavier load takes longer to draw, and with no shot loaded it fires
a plain arrow. The title screen's TUTORIAL panel carries
the same keys under `1-4 CLASS ABILITIES`.

`settings.info` (one INFO DISPLAY toggle row in the ESC menu, **or F3**, minecraft-style — the
keydown handler flips it in any mode and suppresses the browser's find bar; default off) shows
the **info stack** — `drawTags()`, a vertical list on the left edge at the top quarter of the
view, drawn above every overlay. Four lines — **FPS** (`loop()`
accumulates raw unclamped frame deltas into `perf` and refreshes `perf.fps` every half second),
**SFX**, the sampled sound bank's decoded/asked-for tally (below),
**POS**, the tile coordinates of the player the camera frames (`viewPlayer()`, so spectators read
the watched player), and **SEED**, the run seed (see
[world.md](world.md#determinism-and-noise)) — each drawn as a dim label plus a value on one
shared x, so the numbers line up in a column; that dim-label / bright-value pairing is the same
one the berry and fish counters use. **Red on the fps value (below 45) is the only colour in the
stack that means anything** alongside **SFX** (below), and nothing else is tinted, which is what
lets a warning read. In title, FPS and SFX show and the other two do not.

**SFX** is the sampled sound bank: files decoded / files the table asks for, from `SFX.banked()`,
red on anything missing — why it is there: [Audio](#audio), *a failed load must never be quiet*.

`settings.hitbox` is the same idea one key over: **`.`** toggles it 0 ↔ 2 in any mode. One press
draws the circles and boxes the sim actually tests over the sprites that hide them, *and* the
route every walker is following with the tile it is heading for; the next press turns both off. It
has no ESC-menu row, only the `. HITBOX` line in the WASD scheme's CONTROLS block (CLICK and
MOUSE leave it out to make room for the burrow); the rest is in
[Debug overlays](rendering.md#debug-overlays-hitboxes-and-routes).

Beneath the minimap `renderMinimap()` prints the elapsed clock alone, centred on the disc. There
is no alive count: a match does not end on bodies (`aliveCount()`, js/player.js, has no caller
but `DBG`). Under the disc runs the notice lane, and the **stat sheet** flies into it whenever a
number on yours moves - every row of your sheet, the moved ones lit and blinking, gone again in
eight seconds: [rendering.md](rendering.md#the-stat-ledger-your-sheet-as-a-notice).

## Audio

[js/audio.js](../../js/audio.js) is three layers under one master dial, and `SFX` is all of them.

**Inside the step, a cue is asked for through js/net/events.js, never gated by hand.** A world
cue at a place is `sfxAt('cue', x, y[, r][, 0, arg])` (heard within `r` px, `nearPlayer`'s
default when 0; `EV_ANYWHERE` reaches every screen - the eagle's boom); a cue for one body is
`sfxFor(p, 'cue')` (a step, a nock, a refusal, a status landing on *you*); a level gained is
`sfxOwn(p, 'levelUp', 'pickup')` - one cue for the owner, another for bystanders in earshot.
Shakes go the same way (`shakeFor(p, n[, q])`, `shakeAt(x, y, n[, r])`). The why, and the bare
`SFX.cue()` outside the step, are CLAUDE.md's hard rule. Three cues still gate by hand on purpose, pending the plan's semantic events: the
roost alarm (with its plate), the market's four (with theirs), and the two end-of-match songs.
`SFX.stat(up)` is bare for a different reason and not an exception at all: `updateStatLedger`
runs inside the step but is the LOCAL screen's own chrome, watching the local body's kit, and a
client's snapshot moves those numbers for it.

`ensure()` builds the graph lazily: `master` (the master dial) → destination, and `sfxBus` (the
SOUNDS dial) under it. **Everything synthesised or sampled goes through `sfxBus`**, the wind bed
included — a new voice that connects to `master` directly would ignore the SOUNDS dial. The three
dial setters go through `dial(v, keep)`, which keeps the old value for anything that is not a
finite **number** — note the `typeof` test, since `+null` is `0`, not `NaN`, and a coercing guard
would let a null from a stale save clamp a whole bus to silence. Music runs *outside* this graph,
so a zeroed or broken `sfxBus` is silent while the songs play on, which is a confusing failure to
be handed and worth guarding against. Browsers
require a user gesture, so `SFX.unlock()` is called from click handlers; audio.js also arms its
own `pointerdown`/`mousedown`/`keydown` listeners, which is what actually starts the title track
(see *Music* below).

**The synth** (`tone`/`noise`) is two things: the UI blips in their own
right, and the fallback line under every sampled cue.

**Samples.** `SAMPLES` maps a key to the files behind it in `audio/sfx/`; `loadBank()` decodes all
of them on the first `ensure()`.

**The bytes come from [js/sfxdata.js](../../js/sfxdata.js), not from the network.** That file is
generated — `node app/bake-sfx.js` writes every clip in `audio/sfx/` into it as base64 — and it exists
because **double-clicking `index.html` has to work** (CLAUDE.md, Run and verify): a `file://` page is
allowed neither `fetch` nor XHR against its own folder, and an unloaded bank falls back to synth
without a sound of complaint.
`bytes(f)` prefers the inline data and falls back to `fetch` for a clip that is in the folder but
not yet baked, so adding one works over http before anyone reruns the script — **rerun it before
committing, or the new sound is dead for anyone opening the file directly.** The music is
deliberately *not* baked: it is ~70 MB, and an `<audio>` element streams a relative `file://` path
perfectly well — only `fetch` is blocked. Filenames still go through
`encodeURIComponent` on the fetch path, since several carry a `#` that a raw URL reads as a
fragment. Each decoded buffer is run through `trim()`,
which finds where the sound actually starts and ends inside a clip padded out to a fixed length,
so an axe hit does not fire 200 ms late.

**`trim()` also levels the bank, and that is not cosmetic.** These files arrive at wildly
different levels, so each one gets a gain `g` bringing it to **`SMP_LUFS`** — capped at `SMP_MAXG`
so a near-silent clip is not amplified into hiss, and at `SMP_CEIL` so a lifted clip cannot clip.
Without it the quiet third of the bank is inaudible under the music at any sane master setting,
*and* no per-cue `vol` can be tuned, because the same number means something different for every
file.

**It levels on LOUDNESS, not on peak** — the loudest `SMP_WIN` seconds of the trimmed window,
K-weighted and summed across channels (ITU-R BS.1770, and `loudness()` designs its two filters at
the buffer's own rate rather than copying the standard's 48 kHz table). A peak is the one thing a
sharp click and a sustained howl have in common, so peak levelling left the bank **16 dB apart by
ear** with every file sitting at the same peak — and split cues against themselves: the two gold
coins measured 8 dB apart and `smp()` picks one at random, so the same pickup rang twice as loud
every other time. Peak keeps one job, the `SMP_CEIL` cap. A clip shorter than the window still
divides by the whole window, because a 60 ms tick *is* quieter than a 400 ms one of the same
density — without that a levelled bank turns every click into a crack. Peak is taken across **all**
channels (the files are stereo) and the silence threshold is relative to that peak — an absolute
one trims the quiet clips' own content off as if it were padding; loudness is measured over the
**trimmed** window for the same reason, or the padding drags it down.

**`vol` is therefore one ladder, and the same number means the same thing everywhere.** It reads as
a step down from `SMP_LUFS`: 0.89 is a decibel under, 0.71 three, 0.56 five, 0.4 eight — a cue that
cuts, slows or filters its clip needs a little more or less to land on the same rung. The rungs,
from the top: the rare big moments (a wingbeat, the bird struck, a level, a record, the match
lost), then the events worth turning your head for, then the work you do all match — an axe, a
pick, a hammer, gold in the purse — and at the bottom the things that never stop (a boot, a
build's tick, a notch, the wind). **Anything that repeats sits under anything that happens once**,
whatever it sounds like close up: a cue heard two hundred times a match is mixed against the two
hundredth and not the first. The whole sampled bank spans about **10 dB**, and no cue's own files
should sit more than ~2 dB apart — `SFX.debug()` prints every clip's `g` and `SFX.meter()` reads
the bus, so both are checkable without guessing.

**A failed load must never be quiet about it.** `loadBank()` counts every file into `bankStat`
(`want`/`got`/`err`), logs one console warning naming the first failure, and `SFX.banked()` reads
the tally back — the **info stack prints `SFX got/want`, red when anything is missing**. This is
not decoration: an empty bank falls back to the synth on every cue, which is indistinguishable
by ear from every cue being wired to the wrong event — never swallow those rejections. A bank that came up
empty also gets one retry on the next gesture (`retryBank`), since starting the dev server after
opening the page is the ordinary way this happens.

`smp(key, opts)` plays one, **and returns whether it handled the cue**: false means nothing has
decoded yet (or ever will — `file://`, a missing folder, a codec) and the caller falls through to
its synth line, so the game is never silent waiting on a download. It returns *true* while muted,
so a muted cue never doubles up. Every cue therefore reads
`someCue() { if (smp('key', {...})) return; ...synth... }`. `opts`: `vol`, `rate` + `jitter` (a
fraction of rate, rolled per shot, which is what stops a repeated cue sounding looped), `lp`/`hp`
filter corners, `delay`, `gap` (the minimum seconds between two of this key — insurance against
two events in one frame), and `dur`. **`dur` matters more than it looks:** several of these clips
hold more than one cue — the footstep file is a whole walking loop, the coin rolls for two seconds
— so `dur` takes one hit off the front and rides a release ramp down over its last 40 ms rather
than clicking off mid-waveform. A key with several files picks one at random per shot.

Sampled cues that sit beside a synth sibling: `coin()` (gold into the purse — an `awardGold`
payout, a bot's deposit) and `stash()` (something into the backpack) are the world's;
`pickup()` stays the synth UI blip so menus keep an instant, identical
click. `hammer()` (raising, upgrading or finishing a structure) stands beside `place()` the same
way, with `building()` as its quieter, shorter sibling on a site's dust tick — it repeats for as
long as the build takes, so it is widely jittered and must never settle into a rhythm. `step()` is
one boot per footprint the local player leaves; `land()` is the same boot dropped an octave under a
low thump, so touching down off the eagle reads as weight rather than as an arrow connecting.
`yelp()` is a creature crying out under a hit it survived, and `monsterDie(kind)` takes the
animal's kind — a wolf yelps where a rabbit squeals.

**The market's four are notification cues, not world sounds**, and they are the one place a cue is
deliberately *not* jittered: `market(up)` plays `spike` (a coin ding) or `crash` (a sad falling
sigh) whole — the ding is spent in under half a second where the sigh sustains and sags for the
best part of one, so the two are told apart by their *shape* and not only by their pitch —
and `restock()` plays two clips as one cue — `freight`, a wagon pulling in, and `restock`, the
bell over the new stock, scheduled `RESTOCK_RING` (0.9 s) behind it through `smp`'s own `delay`.
The wagon runs its full 3.3 s, so it is still rolling under the bell, which is the point: the
goods arrive, *then* they are laid out. Jitter on either half would blur the two beats into one
noise, and a spike that could be mistaken for a crash is worse than no cue at all — these say a
*direction*, like the plates they arrive with ([the market](#the-fish-and-berry-market)).

**The notification layer is the market's rule generalised: the cues in the table below, most of them not a thing in
the world making a noise.** A stepped control, a panel, a countdown, a status landing on your own
body and a warning from across the map all have to be told apart from each other *and* from the
axes and bowstrings in the same instant, and that is exactly what the synth blips do badly — half
of them are the same square wave two notes apart, which is why `pickup`/`place`/`swap` all read as
"the UI answered" and nothing more. They are **unjittered** (`jitter: 0`) for the market's reason: each says
*this happened*, and a cue that arrives a little different every time reads as texture — but the
two that *are* a body in the world, `bigHurt` and `botOut`, keep a 0.04 jitter.

| Cue | Says | Fired from |
| --- | --- | --- |
| `countTick()` | one whole second of a wait gone | the class screen's PLAY count (`state.menu.countT`, js/ui/menu.js) and the range's 3-2-1 (`agUpdate`, js/world.js) — never the `nock` blip, which is the sound of a bow being ready |
| `ui(open)` | a surface came up, or went away | every overlay toggle in `keyPress` (js/input.js): the pack drawer, the sheet, the chart, the build list, the ESC slab, the pause plate, and each of Escape's back-outs |
| `notch()` | one step of a stepped control | the zoom rung and the build list's rows (the `wheel` listener), the minimap's steps, and a radial wheel's wedge as the travel crosses it (`pointerMove`) |
| `turn()` | a piece turned on the spot | R over the build ghost |
| `wheelUp()` | a radial wheel rolled open | `openFlagWheel`, `openWheelNear`, and whichever of the work key's four (manage, rack, roll die, range bell) the press opened |
| `record()` | a new BEST | `agEndRound` and the parkour line (js/world.js) — one cue for one meaning, on both instruments |
| `runUp(n)` / `runBroke()` | a run of hits reaching a milestone, and a run lost | `hitPTarget` every `AG_RUN_STEP` in a row (**pitched up as the run climbs** — the one place a rate is meant to be heard, because the number it tracks is the thing being climbed), and the arrow loop (js/sim.js) when a run of that length ends in the snow |
| `alarm()` | **your roost is being struck and you cannot see it** | `hurtEagle` (js/boot.js) when the bird is out of earshot and it is your own — the one cue in the game that speaks for something off screen, held to one warning per `EAGLE_WARN_GAP`, and the one that arrives with a **plate**: the `roost` notice under the minimap ([the plates](rendering.md#notices-the-plates-under-the-minimap)) and a feed line, so the ear turns your head and the corner says what happened |
| `marked()` / `dazed()` | you have been found; you are stunned out of your own hands | `markUnit`/`stunUnit` (js/actions.js), **local player only and fresh applications only** — a state re-applied every second would otherwise re-ring every second |
| `nightFall()` | the cold coming down | the darkness curve crossing `NIGHT_CUE` upward (js/sim.js), `dawnChime`'s opposite number |
| `warp()` | a body moved without walking it | `warpPlayer` (js/tools.js) — never the dodge whoosh, the sound of air being crossed, the one thing a teleport never does |
| `spectate()` | the camera handed to another body | `specNext` (js/ui/screens.js) |
| `defeat()` | the match lost | `endMatch` (js/player.js) — the sting the defeat song comes up under, as `victory()` is the win's |
| `bigHurt()` | a great bird taking a blow | `hurtEagle` within earshot — never `hurt()`, a man's winded oof. The clip is a bull at rest, so it plays `BIGHURT_RATE` (1.5) up with a 320 Hz highpass under it — pitch and the chest resonance are what separate a beast in a field from something with a beak |
| `botOut()` | a machine rolling out of the bay | the spawner's shutter (js/structures.js), through `sfxAt` |

**Never borrow a cue** for a new event: a borrowed cue teaches the ear the wrong thing — an
eagle that goes "oof" is a person, and two instruments that award a record two different ways
are two unrelated events.

**Ambience.** `SFX.setAmbience(on, night)` is called every frame from `update()`: on wherever the
world is live, off under the death and end screens where a song already owns the mix. audio.js
schedules a wind gust (or, once `state.darkness > 0.55`, sometimes an owl) every 11–26 s over the
synth wind bed.

**Music.** `SFX.music` streams `audio/music/` through one `HTMLAudioElement` per track — they run
minutes, and decoding them into buffers would cost tens of MB. They sit *outside* the WebAudio
graph, so `musicGain()` multiplies each element's `.volume` by its track volume, the MUSIC dial,
the master dial and mute by hand; a 50 ms `setInterval` walks the fades. `music.play(key, opts)`
crossfades (`in`/`out` seconds, `restart`), is a no-op when that key is already current, and
`music.stop(fade)` fades the whole layer out. `music.current` reads back the key; `music.el(key)`
hands out the live element, which is how a driver proves the handover chain without sitting
through five minutes of a track.

`music.hold(key, opts)` **borrows** the layer for as long as something is up on screen, and
`music.release(opts)` gives it back. A hold notes what was playing **and the second it had
reached** (`music.held`), fades it out, and the release brings it back and seeks it to that
second — so an interruption costs the listener the bars it covered rather than the whole song.
Holding twice over is still one hold: the first thing interrupted is the thing that comes back. An
ordinary `play` or `stop` clears the note, so a track that takes the layer for its own reason (a
victory, the lobby) can never be undone by a release arriving after it. The
[trading post](#the-merchants-counter) is the one caller.

| Track | Plays from | Loops |
| --- | --- | --- |
| `intro` — FROZEN NORTH RUN INTRO | boot, and `leaveLobby()` back to the menu | yes |
| `lobby` — FROZEN NORTH RUN CLASS SELECTION | `beginLobby()`; the hero pop-up keeps it | yes |
| `eagle` — FLYING ON EAGLE | `beginDrop()` | yes |
| `jump` — JUMPING OFF EAGLE | `dropJump()` for the local player | no → `foxglove` |
| `foxglove` — FOXGLOVE DROP | the end of `jump`, via `TRACKS.next` | no → silence |
| `village` — FOREST VILLAGE LOOP | `openShop()`, as a **hold**; `closeShop()` releases it | yes |
| `wiki` — WHISPERING WOODS | `beginWiki()`, as an ordinary **play**; `leaveWiki()` puts `intro` back | yes |
| `victory` — DROP THE ICE | `endMatch('won')` | yes |
| `defeat` — SLEEPY GAME SAVE | `endMatch('lost')` | yes |

The jump is a **hard cut**, not a crossfade (`{ out: 0.1, in: 0.05 }`): the ride's song is
interrupted by the leap. From there the layer runs itself — `jump` reaches its end, its `ended`
handler follows `TRACKS.next` into `foxglove`, and when *that* ends nothing follows it, so the
match plays out in silence until an end screen. `endMatch` is gated on `'won'`/`'lost'`, each with
its own song (`victory` / `defeat`); a `'respawning'` overlay is not the end of anything and must
not start either.
`rerollWorld()` and `toLobby()` fade the layer out under their wipe; both reload the page, so the
title track comes back from boot.

The **title track cannot start on its own** — no gesture has happened at boot. `musicPlay` catches
the rejected `play()` promise into `pending`, and the first click or keypress starts it. This is
why the dev server ([app/server.js](../../app/server.js)) answers Range requests: served a plain 200, an
`<audio>` element treats a multi-MB mp3 as an unbounded stream (`duration` `Infinity`) and cannot
seek in it.

The bow's rhythm has two of its own: `SFX.nock()` (a dry wooden tick when the renock clears —
deliberately near-silent, since it fires after every shot) and `SFX.dryFire()` (a slack string on
a press the tool cannot answer). See [the cycle](#the-cycle).

[Prone](#prone-under-the-snow) has four: `SFX.bury()` (a body dropping into deep snow — low crunch,
no pitch), `SFX.hidden()` (the cover finishing, barely there on purpose: it is the sound of *not*
being heard, and it plays with a rival somewhere close by), `SFX.rise()` (the snow shed in one
shove) and `SFX.ambush()` (the shot out of the snow landing — deeper and harder than `hit()`, with
a crack over the top, so an ambush never sounds like an ordinary arrow).

`SFX.victory()` (a four-note fanfare over a held low fifth) is the one *synth* cue longer than a
second; `endMatch` fires it the moment the match is won, as the sting the `victory` song comes up
underneath. `SFX.tally()` is the dry blip a climbing number makes on the victory screen — see
[The end screens](rendering.md#the-end-screens) for the rest of that timeline.

