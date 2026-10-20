# The swing tools (E)

The axe is **not selectable and is not a weapon**. `SWING_TOOLS` (`bow`, `axe`, indices
`SWING_BOW/AXE`) is an internal table for icons and names; `p.swing` is what
that player is *holding for work*, and it returns to `SWING_BOW` — which draws the hero's own
weapon — the moment a swing ends. Two verbs, two inputs:

- **Left click = the hero's basic attack** ([the basic attack](the-basic-attack.md)). The press only records intent (`clickAction` sets
  `input.fire`); `updatePlayer` starts the draw on the rising edge and fires on the falling one.
- **The hands work on their own** (`autoWork(p)`, js/sim/actions.js — `updatePlayer` calls it every
  step `p.input.work` is *not* set). Whatever an `OBJECTS` entry marks `auto` — a tree, a dead
  tree, a berried bush, a rival's roosting eagle — and **any building on the
  other team** (`autoToolFor`, resolving a footprint tile through `structOf` and refusing your
  own via `ownsStruct`, exactly as `workTarget` does) is swung at the moment it is inside
  `WORK_REACH`, no key held: `autoTarget(p)` takes the nearest such tile in the ring around
  the player — a rival's building or eagle first (`AUTO_PRIO_FOE`), then scenery, and by tile centre to body within a rank (`autoPrio`) — and `startSwing` runs the same swing E's would. What makes it
  automatic and not a cancel: it never drops a draw or the held button (`p.autoSwing` lets the
  draw begin under it, and the release fires on the frame the button lifts, swing or no swing),
  never stands a crawler up (`p.prone` waits, unlike E), and never touches the aim (`startSwing`
  leaves the facing alone while a draw is running, so the aim never flicks toward the tile) — you
  keep shooting, walking or drawing through it, and the tree comes down beside you, with
  **both tools on the sprite**: the axe sweeping in one hand, the drawn weapon on the aim
  in the other (`drawHeldTool`, [below](#the-draw)). It obeys the
  same busy gates as E (a fall, a roll, a stun, an ability, a meal, the swing cooldown).
  **Fish are the same idea on ice** (`autoFish(p, dt)`, js/sim/attack.js, called right after it):
  standing on an ice tile with a fish inside `FISH_CATCH_R` catches it with no press, once
  every `FISH_AUTO_CD` (1.2 s, `p.fishCd`) so a walk along a shoal is a stride per fish, and
  nothing can refuse the catch, because fish go in the pouch. It spends no attack cycle and runs
  under a draw; the fire button never spears — `basicAttack` attacks, fish or no fish. Nothing in this is a key: the swing itself, the catch pose and the rim are the whole
  signal, so `drawWorkHint` shows no prompt over an `auto` target and the fish brackets carry
  no verb (bright inside catch reach, dim outside).
- **E = work** (`tryWork(p)`, auto-repeating every swing cooldown while held — `updatePlayer`
  calls it whenever `p.input.work` is set, and a held E always beats the hands' own choice).
  It is what reaches **the practice dummy** — the one thing not marked `auto` — and it still
  works anything else if you insist. It resolves `workTarget(p)`: the tile that player is
  aiming at, if it holds a tree or a dead tree, a berried bush or a rival's building (all → axe;
  bare ice is nothing since the pick went in 0.531); and `near` = the tile is
  within `WORK_REACH` (1) tiles, Chebyshev, of the tile the player stands on — i.e. the 3×3
  ring around you, never a second row, regardless of where in your tile you stand. Out of reach or nothing workable, E
  does nothing — and **standing at a merchant's counter, E is the counter's** and swings at nothing
  at all ([opening it](the-merchants-counter.md#opening-it)). A valid target swaps `p.swing` to the right one, drops any draw, faces the
  tile, and starts the swing; `swingHit(p)` **contests** the locked tile (`p.workTx/Ty`) so only
  one player's swing lands on it in a step, then hits whatever is there via
  `hitObject(o, p)`. Once `swingT` and `swingCd`
  both reach 0, `updatePlayer` puts the weapon back (`p.swing = SWING_BOW`), so the axe only
  exists visually for the duration of the work. `workTarget()` is shared with the cursor, so the
  lock ring is exactly "E will do something here".

Whenever `workTarget()` is non-null, `near`, **and not something the hands take on their own**
(`autoToolFor(t.o, player) >= 0` nulls it — and tools aren't blocked, the bow drawn or a cable
ridden), `drawWorkHint()` — called right after `drawSelection` in the overlay pass — floats a
key prompt over the target: a pixel key-cap wearing the work key (**E** until rebound) plus the
verb. Since every tree, bush and rival building is `auto`, the only prompt that shows in play
is **HIT** over the practice dummy; the verb and the lift are still read off the `OBJECTS` entry
(`verb`, `lift`: 33 for a pine, 20 for a dead tree, 28 for the dummy, 10–12 for the short ones),
scenery wider than a tile takes it on its middle (`w`), and the building branch — BREAK,
clearing the sprite and centred on the footprint — stays for a building that is ever not `auto`.
A merchant and a zipline in reach claim the cap first (`drawShopHint`, `drawZipHint`). The cap
visibly presses (face drops a pixel, highlight gone, label goes gold) while the local player's
`input.work` is set.
If the prompt would overlap the player sprite (an adjacent target) it flips under the tile
instead. Since it only appears in reach, it doubles as the "you're close enough" signal.

`hitObject()` keeps its hard tool gating (trees need the axe, with
`SFX.deny` + a `NEEDS AXE` floater) as a safety net: `tryWork` and `autoWork`
always pick the right tool, so normal play never reaches it; buildings are not gated
at all, since the axe is the only tool E ever brings out for one.

**Stumps and open ice holes** are not E targets. **Buildings on another
team are**: `workTarget()` resolves the tile through `structOf()` (so any tile of a 3×2 footprint
counts, via its `part`) and returns the axe when `ownsStruct()` is false, and `swingHit` routes
the swing to the anchor. Your own buildings are never swung at. See
[Buildings](buildings.md) for the damage numbers. The axe never hits a living
thing: the hero's basic attack is the only weapon aimed at one.

Every basic attack is **hold-to-charge**: holding the button arms it (`p.fireArmed`), the draw
starts as soon as the cycle has run and runs `p.charging`/`p.chargeT` (movement targets
scale by the kit's `chargeMul`, 55% for the hunter — walk speed and the ice cap both — facing
tracks the mouse, a draw meter renders
above the player's health bar), and the release edge fires via `basicAttack(p)`. What the hold buys
is [The draw](#the-draw); a shot loosed out of full snow
cover multiplies the damage by `AMBUSH_MUL` (see [Prone](prone-under-the-snow.md)). Shots carry
their shooter's `owner`/`team`, live in the `arrows` array, and are updated in `updatePlay()`:
they die on solid tiles (and a rival's **building** that stops one is sieged), on a **rival player** (see [PvP](../multiplayer.md#pvp)), on an **enemy worker
bot** (`hurtRobot`) or on any animal hit (knockback scales with power) — whichever the step met
first ([a shot in flight](the-basic-attack.md#a-shot-in-flight)) — or at the end of the shot's life.

`p.fireArmed` is what makes the draw survive an attack that isn't ready. It is set on the press edge,
cleared on release and at every point that cancels a draw (`tryWork`, falling in a hole, a meal,
an ability cast, clipping onto the zipline, an
overlay opening in `sampleHumanInput`, `die`), and the draw begins on the first
step where it is set *and* `nockT <= 0`. Requiring a fresh press instead
would deadlock every controller that simply holds the button down — which is every bot:
`aiThink` sets `inp.fire = chargeT < drawTime(p) * k`, so after a shot it goes straight back to
true and no second edge ever arrives. `p.chargeT` is the raw seconds held and is **never
clamped** — every reader takes `drawPow(p)` (0..1) off it, and the meter's white blink at the
peak needs to see the hold run past the full draw.

## The cycle

There is no ammunition. What sits between one press and the next is **the attack's own cycle**:
`basicAttack` sets `p.nockT = attackCycle(p)` (the row's `cycle`, [the basic
attack](the-basic-attack.md)), and no draw can begin while that runs. Its end is the **one** gate:
the frame the wipe clears, a held button starts the draw. `attackCycle(p)` is the one number every
readout divides `nockT` by — the reticle's corner marks and the overhead slate
bar — so no meter can show a cooldown a different length from the one running; a new readout
divides by it too, never by the bare `kit.nock`.

Two indicators carry it, and neither is a word:

- **The overhead bar** (`drawPlayer`) — the draw meter's slot doubles as the cycle readout for
  *every* player: gold filling = drawing, slate filling = reloading, pale gold = just came back.
  Same geometry either way, so it never jumps.
- **The reticle** (`cursorInfo` → `drawCursor`). Every reticle in play carries `nock` (elapsed
  fraction, 1 = ready), whatever the pointer is over. While the cycle runs, four gold corner marks
  fall inward and land on the ring.

`SFX.nock()` plays on the cycle completing (very quiet — it plays after every shot).

## The draw

Under the keyboard's [CLICK scheme](../multiplayer.md#the-click-scheme) a locked target draws the
attack by itself to `CK_AUTO_DRAW` (0.7 — the same fraction a NORMAL bot looses at) while the hand
is off the button, through this same curve and the same cycle: the auto-attack is a bot's loose
and nothing more, a floor under the hand's own draw, never a second weapon. Its reach is
`ckReach` (js/app/input.js): a blade's `reach` plus 6, a shot's flight at that draw.

`drawPow(p)` — `chargeT` over `drawTime(p)`, clamped 0..1 — scales the attack three ways at once,
each on a straight line from a floor to the row's own number (the `the draw` banner,
js/sim/attack.js):

| | at a tap (`pw` 0) | at full draw | floor |
| --- | --- | --- | --- |
| range | ×`DRAW_RANGE_MIN` | ×1 | 0.22 |
| speed | ×`DRAW_SPEED_MIN` | ×1 | 0.6 |
| damage (the whole sum: stat + speed bonus) | ×`DRAW_DMG_MIN` | ×1 | 0.3 |

`shotFlight(s, pw)` turns that into the `spd` and `life` a shot (`{ speed, life }`) leaves with,
the range curve applied through the life, so a tap also *stops short* rather than only arriving
late. It is the one envelope: `shootAttack` fires through it and `drawAimLine` measures it, which
is what lets the line on the ground grow out of the bow as the string comes back. The SHORTBOW: 60
px and 5 damage at a tap, 272 px and 16 at full, at level 1.

`drawTime(p)` is the kit's `bowCharge` over ATTACK SPEED (`asMul`). The overhead bar, the aim line
and the bots all read `drawTime`, never `bowCharge`. **That curve is the whole punishment for
spamming the button** — short, slow and weak, with the cycle still to run before the next — dealt
by the attack itself rather than by a counter, so what a player sees (a stubby line, a pale meter)
is exactly what they get. Bots read the same curve: `aiThink` holds to `drawTime(p) × k` before
loosing.

A shot in flight is drawn in its own pass (using `ex`/`ey`) as **the one arrow body**: `ARROW_MAP`
(js/sim/actions.js), an ASCII master parsed once into `ARROW_BODY` — a white tip, a tapered flint
head, a 1 px collar, a single-gold shaft, and swept swallow-tail feathers in `TEAMS[a.team].mark`
edged with the team's `coatD` — so whose shot it is reads from the tail. `arrowBodyPx`
(js/draw/overhead.js) rasterises it at the live bearing by **DDA** — the spine advances exactly
one pixel along the flight's dominant axis per step (a diagonal shaft is a clean 8-connected
staircase, never a lumpy one with doubled cells), body columns are sampled onto that chain with
structural pixels winning collisions (`ARROW_BODY` is priority-sorted at parse), and each vane
row sits one exact pixel further out along the perpendicular's dominant axis, so rows never
collapse together and the two vanes stay mirrored at every angle. At the four cardinals this
degenerates to plain rounding. `paintArrowPx` dilates every pixel into `ARROW_RIM` first (a
plus-shaped 1 px dark edge) so the shaft reads over snow. `drawShaft` (js/draw/render.js) draws it;
`a.x`/`a.y` is the TIP (the point the sim tests) and the body trails `ARROW_LEN` (15) px behind
it, which is why the view cull uses the widened ±22 bound. The whole body is 16 long by 7 deep —
one 16×16 sprite cell, the scale everything else in the world is drawn at.

Behind it, each shot lays a **trail of team-coloured motes** into `particles`, one every
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
Opening an overlay or dying drops the draw without firing (and clears `fireArmed` with it);
`BOW_CHARGE` (0.9 s) is a full draw.

While the attack is drawn, `drawAimLine()` (called from `render()` right before the shots pass,
using `ex`/`ey`) shows it. A **cut** grows its wedge (above). A **shot** gets a static line of 2×2
drop-shadowed dots from the spawn point along the exact direction `shootAttack` uses. Both aim
from `player.y - BOW_Y` (6 px above the feet, where the shot spawns) — not the feet — so the line
and the flight pass exactly through the cursor instead of running parallel a few px above it.

The line is **truthful, not decorative**, at the **draw held right now**: it runs exactly as far
as the shot would fly if loosed this instant (`shotFlight`, so it grows out of the bow as the
string comes back, and a tap's line is a stub), and stops at an `isSolidTile`. It still stops at
the first animal it would hit (the same 8 px body test as the arrow update) with an impact cross —
line-coloured on a solid, hunt-amber on a body — and otherwise ends in a short perpendicular
range-cap bar. Colour follows the draw meter: gold charging, pale gold at full (`DRAW_COL` /
`DRAW_FULL_COL`, js/draw/overhead.js).

The weapon is also drawn **on the player** by `drawHeldTool()` (called from `drawPlayer()`): at
rest the hands hold the hero's own weapon (`SPRITES.weaponArt[attackOf(p).art]`, or the blade at
its length), so what someone fights with reads off their sprite from across the snow. It is carried
at the leading hand while idle/walking (turned to the facing, drawn *before* the body sprite for
`up` so it's occluded, riding the run's bob - `runBob`), and rotated toward the mouse while drawn.
Every art says which way its business end points as drawn (`WEAPON_FWD`, js/sprites/weapons.js)
and the hand turns it by the facing or the aim minus that: a bow's arrowhead is at +x, drawn the
way a bow is held — string toward the archer, belly toward the target — and the sword's point at
−x.
A melee swing sweeps the axe's icon along the swing arc instead, and a swing running
under a draw (an automatic one — `autoWork`) draws **both**: the sweep first, the drawn weapon
on top, since the attack about to leave is the thing to read.
Mid-swing the axe takes over, swept along the same arc as the swing effect. Both sizes go
through the same code: the icon is centred on its own half-width, 8×8 for the axe and 12×12
for a weapon.
