# The swing (E)

The axe is **not selectable and is not a weapon**. It is in the hands from a swing's start to the end of its cooldown
(`p.swingT > 0 || p.swingCd > 0`; both ride the online snapshot, so a client draws it the same); the rest of the time the hands hold the hero's own weapon. Which objects a swing
works is their `OBJECTS` entry's `work` flag. Two verbs, two inputs:

- **Left click = the hero's basic attack** ([the basic attack](the-basic-attack.md)): the press
  names a mark (`input.atk`), and the sim winds up and strikes it on its own.
- **The hands work on their own** (`autoWork(p)`, js/sim/actions.js — `updatePlayer` calls it every
  step `p.input.work` is *not* set). Whatever an `OBJECTS` entry marks `auto` — a tree (never a jungle wall's pine: the entry's `ready` is `treeFells`), a snowdrop clump, a rival's roosting eagle — and **any building on the
  other team** (`autoWorks`, resolving a footprint tile through `structOf` and refusing your
  own via `ownsStruct`, exactly as `workTarget` does) is swung at the moment it is inside
  `WORK_REACH`, no key held: `autoTarget(p)` takes the nearest such tile in the ring around
  the player — a rival's building or eagle first (`AUTO_PRIO_FOE`), then scenery, and by tile centre to body within a rank (`autoPrio`) — and `startSwing` runs the same swing E's would. What makes it
  automatic and not a cancel: it never drops a wind-up (`p.autoSwing` lets the attack run under
  it), and never touches the aim (`startSwing` leaves the facing alone while a wind-up is
  running) — you keep attacking or walking through it, and the tree comes down beside you, with
  **both tools on the sprite**: the axe sweeping in one hand, the weapon on the mark in the other
  (`drawHeldTool`, [below](#the-weapon-in-the-hand)). It obeys the
  same busy gates as E (a fall, a roll, a stun, an ability, the swing cooldown).
  Nothing in this is a key: the swing itself and the rim are the whole
  signal, so `drawWorkHint` shows no prompt over an `auto` target.
- **E = work** (`tryWork(p)`, auto-repeating every swing cooldown while held — `updatePlayer`
  calls it whenever `p.input.work` is set, and a held E always beats the hands' own choice).
  It is what reaches **the practice dummy** — the one thing not marked `auto` — and it still
  works anything else if you insist. It resolves `workTarget(p)`: the tile that player is
  aiming at, if it holds an object marked `work` or a rival's building
  (bare ice is nothing); and `near` = the tile is
  within `WORK_REACH` (1) tiles, Chebyshev, of the tile the player stands on — i.e. the 3×3
  ring around you, never a second row, regardless of where in your tile you stand. Out of reach or nothing workable, E
  does nothing — and **standing at a merchant's counter, E is the counter's** and swings at nothing
  at all ([opening it](the-merchants-counter.md#opening-it)). A valid target brings the axe out, drops any wind-up, faces the
  tile, and starts the swing; `swingHit(p)` **contests** the locked tile (`p.workTx/Ty`) so only
  one player's swing lands on it in a step, then hits whatever is there via
  `hitObject(o, p)`. The axe is drawn only until
  `swingT` and `swingCd` both run out, so it exists visually for the duration of the work. `workTarget()` is shared with the cursor, so the
  lock ring is exactly "E will do something here".

Whenever `workTarget()` is non-null, `near`, **and not something the hands take on their own**
(`autoWorks(t.o, player)` nulls it — and tools aren't blocked, a wind-up running or a cable
ridden), `drawWorkHint()` — called right after `drawSelection` in the overlay pass — floats a
key prompt over the target: a pixel key-cap wearing the work key (**E** until rebound) plus the
verb. Since every tree and rival building is `auto`, the only prompt that shows in play
is **HIT** over the practice dummy; the verb and the lift are still read off the `OBJECTS` entry
(`verb`, `lift`: 33 for a pine, 28 for the dummy, 10–12 for the short ones),
scenery wider than a tile takes it on its middle (`w`), and the building branch — BREAK,
clearing the sprite and centred on the footprint — stays for a building that is ever not `auto`.
A merchant and a zipline in reach claim the cap first (`drawShopHint`, `drawZipHint`). The cap
visibly presses (face drops a pixel, highlight gone, label goes gold) while the local player's
`input.work` is set.
If the prompt would overlap the player sprite (an adjacent target) it flips under the tile
instead. Since it only appears in reach, it doubles as the "you're close enough" signal.

**Stumps and open ice holes** are not E targets. **Buildings on another
team are**: `workTarget()` resolves the tile through `structOf()` (so any tile of a 3×2 footprint
counts, via its `part`) and returns the axe when `ownsStruct()` is false, and `swingHit` routes
the swing to the anchor. Your own buildings are never swung at. See
[Buildings](buildings.md) for the damage numbers. The axe never hits a living
thing: the hero's basic attack is the only weapon aimed at one.

## The attack's clock

There is no ammunition. What sits between one attack and the next is **the attack's own clock**:
the wind-up (`p.chargeT` up to `atkWind(p)`) and then the rest (`p.nockT` down from `atkRest(p)`),
one `attackCycle(p)` together ([the basic attack](the-basic-attack.md#the-attack)). Every readout
of it divides by `atkRest(p)`, never a bare number, so no meter can show a wait a different length
from the one running. It shows on **the reticle** (`cursorInfo` → `cursorLook`, js/draw/cursor.js):
every reticle in play carries `nock` (elapsed fraction, 1 = ready), and while the rest runs, four
gold corner marks fall inward and land on the ring. `SFX.nock()` plays on the rest completing
(very quiet). Nothing is drawn over the head for it: the hero's own wind-up is the tell.

## Shots in the air

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

Behind it, each shot draws a **short streak** (`drawArrows`, js/draw/passes.js): `SHOT_STREAK_LEN`
px of the shot's own colour off its tail, one unbroken line whose far end is its side's colour,
once the tail has cleared the bow (`a.flown`). A hero's own shot that flies bare names where its
body ends in `SHOT_STREAK`; one with a tail of its own gets none. Nothing is left behind in the
air. In the particle draw pass, a particle's

`maxLife` is the seconds it spends fading (`burst` uses 0.4) and its optional `alpha` caps how
opaque it ever gets; an optional `dx` is a steady sideways px/s the damping never takes (`burst`'s
`drift`: the wind carrying a pine's snow).

## The weapon in the hand

The weapon is also drawn **on the player** by `drawHeldTool()` (called from `drawPlayer()`): at
rest the hands hold the hero's own weapon (`SPRITES.weaponArt[attackOf(p).art]`, or the blade at
its length), so what someone fights with reads off their sprite from across the snow. It is carried
at the leading hand while idle/walking (turned to the facing, drawn *before* the body sprite for
`up` so it's occluded, riding the run's bob - `runBob`), and turned onto the mark through the wind-up (`aimAngle`, `p.aimA`).
**The carry rule** (top of `drawHeldTool`) keeps it off the face: every art is turned about where
the hand closes on it (`WEAPON_GRIP`, js/sprites/weapons.js, or a hero blade's `hilt`), never about
its own middle, so a blade reaches out of the fist; a blade's hand rides an ellipse about the hips
(`BLADE_HAND`), a carry sits at `CARRY_HAND_Y` by facing; and anything pointing up the screen
(`heldBehind`, past `HELD_RISE`) is drawn behind the body, as is a carried staff. `drawPlayer`
calls it twice, behind the body and over it.
**The grip rule** (`heroFist`, js/draw/heroes.js) keeps a hand on it: wherever a carry lands its
grip, outside a body facing away, a 2 px fist in the look's hand colour (`set.hand`, the skin
unless the look names a `hand` letter, with `set.ink` its outline) is drawn over the weapon,
reaching back to close the sleeve. A slanted blade's grip sits at the arm's end (`hip.down`), so
nothing grows out from under the body unheld. A carry a hero draws its own way (`HERO_CARRY`)
calls `heroFist` too.
Every art says which way its business end points as drawn (`WEAPON_FWD`, js/sprites/weapons.js)
and the hand turns it by the facing or the aim minus that: a bow's arrowhead is at +x, drawn the
way a bow is held — string toward the archer, belly toward the target — and the sword's point at
−x.
A melee swing sweeps the axe's icon along the swing arc instead, and a swing running
under a wind-up (an automatic one — `autoWork`) draws **both**: the sweep first, the weapon on
top, since the attack about to leave is the thing to read.
Mid-swing the axe takes over, swept along the same arc as the swing effect. Both sizes go
through the same code: the icon is centred on its own half-width, 8×8 for the axe and 12×12
for a weapon.
