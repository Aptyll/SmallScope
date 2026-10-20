# Unit collisions

Players, animals and robots are solid circles to each other (`PLAYER_R` 4.5 — a merchant takes it
too — deer 5, rabbit 2.5, a camp monster its `MONSTER` row's `r`: the wolf 4.5, either bear 18;
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
(`hunt`, `isCampKind`): a beast bites from inside its `MONSTER` reach, and a bear's room (28.8 px wide, 38.4 px above or
below) nearly fills the 44 px it starts a blow inside, so a room would slide a standing target out of
reach as often as not. The hard passes run after the rooms and get the last word.

**A live dodge roll is the one exception to any of it.** `separateUnits` skips a pair outright
when one side is a player mid-roll and the other is *small* — every player, every robot, and
every animal but a deer and a bear (`MONSTER[kind].big`, asked through `isBigBeast`) — because the roll goes through
them and [swipes them](dodge-roll.md#the-roll-is-a-hit) instead of shoving them. A deer and a bear keep
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
[the creek](../world.md#the-creek) and plunges; an animal or a robot meets a wall there. A **bot**'s
own walk is strict too (`moveEntity(…, strict)` in `updatePlayer`) unless it is already standing
in water or a shove past `WADE_SHOVE` (40 px/s of knockback) is carrying it, so a bot never wades
in by itself and still goes in off the bank when it is knocked off. An
[ice break](../world.md#ice-breaks)'s water is read by the pixel at the feet (`iceBreakWet`): a
player goes in exactly where it shows, and a strict move (a bot's own walk, a shove) and every
other walker stop at its edge, unless the step starts in it.

**The cistern's stone is held to the pixel.** Every body, every step (`moveEntity`), meets
[the cistern](../world.md#the-cistern)'s footprint by `cisternReach`: the circle round its feet is
swept along the step and stops against the stone, so a roll, a rush, a reel or a shove ends at the
wall, never inside it.
