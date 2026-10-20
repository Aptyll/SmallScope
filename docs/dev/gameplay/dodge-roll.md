# Dodge roll

**Space** (`tryDodge(p)`, driven by the edge-triggered `input.dodge`) dashes a player along its
`input.mx/my` (facing direction if nothing is held): an impulse of
`max(DODGE_SPEED (215), current speed)` into `p.vx/vy`
for `DODGE_T` (0.28 s), with i-frames for the roll only (`p.invuln` — momentum carried
past the roll gets no i-frames). It is the only i-frame a fight produces
([i-frames](status-effects-one-set-for-every-unit.md#i-frames-only-something-deliberate-grants-them)). Two charges (`DODGE_CHARGES`), refilling **one at a time**
every `DODGE_CD` (3.5 s); state lives on the player as `dodgeT/dodgeVX/dodgeVY/dodgeCharges/
dodgeRegenT/dodgeDustT` (`dodgeVX/VY` exist only for the render, which trails the afterimages
along them — movement runs on `vx/vy`). While rolling, movement input, friction, footprints,
walk animation, and the held tool are suppressed (still collides with solids; a wall zeroes
that axis), and `drawPlayer` plays the roll's frames over `DODGE_T` - a crouch, a dive, the
tucked ball turning over once, a squat ([the run and the roll](../sprites.md#the-run-and-the-roll))
- with two afterimages of the frames just shown trailing the velocity, plus dust bursts. A
worn IRON SCOUT has no tuck yet and spins its standing frame instead. The roll's exit speed is spent by the surface — see
[Momentum movement](momentum-movement-players-only.md). The charge meter is a single unsegmented **white** stamina
bar (`STAM_COL`, js/draw/overhead.js — white on every side, since stamina has no side) on a plate
directly beneath the overhead health bar — charges stay discrete in the sim,
the bar shows the pooled total (full charges + regen progress). Spending a charge leaves a
pale ghost of the lost chunk (`player.stamGhost`/`stamGhostT`): it holds ~0.3 s, then drains
into the live fill souls-style. Death cancels the roll, respawn refills
charges; pause, the settings panel and the wheel block the local player's roll (the
[map](the-m-map-does-not-pause.md) does not). The bar is drawn for
**every player** — a rival out of rolls is a tell, and the level badge spans both bars. A roll out of
[prone](prone-under-the-snow.md) is legal: `tryDodge` stands the player up first.

## The roll is a hit

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
([status effects](status-effects-one-set-for-every-unit.md)) — the loops differ only in their radius
and their once-per-roll bookkeeping.
