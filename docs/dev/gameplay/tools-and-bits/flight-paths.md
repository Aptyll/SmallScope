# Flight paths

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
(`solid: false`) pays for that with its siege, and needs no second flag. A burning shot trails fire instead of team colour, burns on its head in flight ([the draw](../the-swing-tools-e.md#the-draw)) and bursts embers where it lands.

**A shot meets everything its step crossed, then one blow.** A step is a *segment*, never a point:
`shotContacts` (js/sim/sim.js, `the shot's sweep`) lists what the segment met in the order it met
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
