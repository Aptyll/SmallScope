# Robots

`robots` holds the barracks' [soldiers](#soldiers-the-waves) (one 12×10 faceless tread-bot grid
in team colour, two tread frames — see [sprites.md](../sprites.md)) and the two eagles'
[merchants](#the-merchant), which ride the same list with `merchant: true`. `updateRobot()` runs
`updateUnitStatus` first, so a chassis wears every state a player can be put under (`makeRobot`
clears the full set into it): rooted, netted, slowed, marked, stunned, on fire, and scrapped by a
burn like anything else ([status effects](status-effects-one-set-for-every-unit.md)). A stun
switches the brain off, a bot on a zipline rides it, and otherwise the merchant runs
`updateMerchant` and a soldier `updateSoldier`. Worker bots (the player-built bot bay's crew)
were cut in 0.525.
Robots drive on `navStep` ([Pathfinding](pathfinding.md)) and are solid to players and animals
(see [Unit collisions](unit-collisions.md)). They join the y-sorted draws via `drawRobot()` in
team colours (the whole sprite bobs while driving, the axe swings at a target) and show a health
bar. Their SFX are positional (`sfxAt`) so a remote base doesn't spam audio.

**A soldier swings an axe.** One swing, `ROBOT_DMG` (5) every `ROBOT_ATK_CD` (1.1 s) at anything
inside `ROBOT_REACH` (15 px) — flat, with nothing scaling it. `robotStrike(b, e, pt)` is the
single blow: a building goes through `hurtStruct` (the same path a player's E swing takes, so the
wreck, the payout and the `WRECKED A` line are one code path), and any **body** through
`hurtUnit` with `cause: 'soldier'`, credited to nobody. Targets come from
`robotFoeUnit(b, range)` (nearest rival player or bot; players are noticed through `seenAt`, so a
buried body is as invisible to a soldier as to a wolf) and `enemyStructNear(team, x, y, r)`.
`foePoint(e, fx, fy)` is where the axe lands: a body a little above its feet, or **the nearest
point on a building's footprint** — a body measuring to a 3×2 building's centre could never reach
past the wall it is standing against. `drawRobot()` draws the swing off `b.atkAim` and `b.atkCd`.

A bot is **shootable**: its hitbox is `ROBOT_HIT_R` (7) about `robotHitY(b)` (`b.y - 1`, the
middle of a body whose treads sit at `b.y + 4`), and `hurtRobot(b, dmg, nx, ny, src)` is the single entry
point for damage — flash, knockback, the damage total, a scrap-and-sparks burst, `SFX.hit`, and
`robotDies` at zero. Shots reach it (only from another team — friendly fire is off, as it is for
players), and so does every class ability and the roll, all of them through `hurtUnit`. A downed
bot is not a downed player, so it never touches the kill count; what it pays is
[Farming](#farming).

## Soldiers: the waves

The `soldiers` banner (js/sim/robots.js). Every `STRUCTS.barracks.waveT` seconds each merchant's
[barracks](buildings.md) rolls out a column of **soldiers** — a tread-bot chassis under its
side's pennant (`drawRobot` stamps `drawPennant` on a `kind: 'soldier'` body, the one thing
that says this bot is not here to chop) — that marches **its bay's lane** (`b.lane`, from the
bay's `o.lane`: 0 top, 1 mid, 2 bot) to the rival bird. `makeSoldier(o)` is `makeRobot` with
`kind: 'soldier'`, `owner: -1` (no cargo, no payout but the bounty) and a
**route**. A top or bot soldier's is its own mouth of the [base](../world.md#the-bases) (`baseGate`),
then `laneWaypoints(team, lane)`: [the side lane](../world.md#the-side-lanes) every `ROAD_STEP` tiles to
the rival mouth, then the rival hollow's centre. A mid soldier's is its own eagle's junction
(`e.mouth`, where the road leaves its base), `roadWaypoints(team)`, the rival's junction. The
rival roost itself is read live each frame, since it may have flown. The mid road's middle is swapped for a way round [the cistern](../world.md#the-cistern)
(`cisternWayRound`): the road just short of its own gate, the bank of one of the fords outside the
culverts, the far bank, the road just past the rival gate. Every other soldier out of the door
(`o.queue`'s parity) takes the other ford, so a column forks round the ring and the two sides'
waves meet on the stones, never on the orca's ice. `updateSoldier` is four rungs, first hit wins:

1. a rival **unit** inside `SOLDIER_AGGRO` (96 px — `robotFoeUnit`, so a buried hunter lets a
   column walk past): close and swing (`robotStrike`, `ROBOT_DMG` every
   `ROBOT_ATK_CD`, `cause: 'soldier'` — `DEATH_CAUSE.soldier` is the feed line);
2. the rival **bird** inside six tiles: the nearest roost tile (`aiEagleTile`), and
   `SOLDIER_EAGLE_DMG` (8, against a hand's 20) a swing through `hurtEagle` — ahead of any
   building, since whatever a side builds round its bird stands within a step of it;
3. a rival **building** inside `SOLDIER_SIEGE` (40 px — what is in its way: a rival
   barracks), or a rival [road tower](#road-towers) inside
   `SOLDIER_TOWER_R` (160 px, `towerNear`), which a wave stops to bring down before it marches
   on: `hurtStruct` through the same `robotStrike`;
4. the **march**: first **the zipline** (`soldierBoard`): its own side's cable of its own lane within `SOLDIER_ZIP_REACH`
   (96 px) whose end nearer the rival bird is `SOLDIER_ZIP_GAIN` (96 px) nearer it than the
   soldier stands — walked to at its mount (`zipMount`), clipped onto inside `ZIP_GRAB`, ridden
   toward that end, out to the front. Never the rival's: it always ends under a standing rival
   [road tower](#road-towers), and riding it in would skip that tower. On
   the cable the brain is off (the ride branch in `updateRobot`: `zipRide`, no swing), so a
   rival who meets it there crashes with it ([the zipline](momentum-movement-players-only.md#the-zipline)). Off it, at the end or
   knocked off, `soldierRejoin` reads the route again from where it stands (the leg it is
   nearest). Else the next waypoint (`SOLDIER_WP_R` to count it reached; one `navStep` cannot
   route to is *skipped*, never waited on, so a column never stands on a blocked tile), then the
   roost through its lane, stopping at every rival road tower standing on the way.

It is allowed to fight and nothing else — no tree tempts it. Two waves
meeting on the road therefore grind each other down (they are rival units to each other), which
is the stalemate a player breaks by walking out. It takes every hit, state and sweep like any
other body (`bot: true` is what `isAnimalUnit` reads to send a blow down the robot path rather
than the animal one — a soldier carries a `kind` too), the roosting bird's **gust** rears at it
and buffets it like a player (`updateEagle`/`eagleGust`), a road tower marks it, and it dies through
`robotDies` paying its bounty to the rival who lands the **last hit** ([Farming](#farming)) and
`SOLDIER_XP` (20) shared by every rival scout standing near, whoever scrapped it
([Hero levels](../multiplayer.md#hero-levels)) — no feed line, three a wave. Its health is `STRUCTS.barracks` `botHp` (60) plus `SOLDIER_HP_GROW`
(10) for every `grow` the match has run (`makeSoldier`), so a hero's grown blow never makes every
hit a last hit. The cap on a barracks' live soldiers is
`STRUCTS.barracks.tiers[0].cap`. Bots read them as attackers at their bird and as targets in
sight, and a pusher walks with its own column ([multiplayer.md](../multiplayer.md#bots)).


## Farming

js/sim/farm.js. League's last hit: a rival soldier pays **only** the rival who lands its final
blow — `soldierBounty()`, `SOLDIER_BOUNTY` (16) plus `SOLDIER_BOUNTY_GROW` (1) for every barracks
`grow` (180 s) the match has run, paid by `robotDies` through `awardGold` — and a camp monster
(`a.home`: the wolves and the bears) pays its killer as ever (`animalDies`). Each is one **farm**
(`farmHit`: `p.farm`, in `PLAYER_RECORD`), which the scoreboard's FARM column and the post-game
COMBAT group's FARM row print. A soldier the waves, a tower or a beast finish pays nobody: the
**miss**. Both make a **coin pop** (`coinPop`, recorded as the `coin` event for the screens that
do not run the step, aged by `state.tick`): a gold coin that hops and spins off a last hit, and a
grey one that drops and fades where a miss fell, drawn only for the side that missed it and only
within `COIN_MISS_R` of the watched body (`drawPops`, js/draw/pops.js). A rival's gold coin in
the fog is not drawn. The wolf den is the jungle: four wolves at 16 each and back `repop` (75 s)
after the last dies, its clock on the den and on both maps ([world.md](../world.md#runtime)).
Bots farm through two roles, the LANER and the JUNGLER ([multiplayer.md](../multiplayer.md#bots)).

## Road towers

The `road towers` banner (js/sim/towers.js). Every zipline has two `STRUCTS.tower` (ROAD TOWER: 3x2,
700 hp, `fixed`, so nobody upgrades, repairs or wrecks one for a refund) beside it, placed at boot
([the zipline](../world.md#the-zipline)); the cable runs only to the furthest one standing.
`updateTower` (called from `updateStructures`) is one gun on a turntable:

- **What it shoots** (`towerMark`): a rival scout inside `TOWER_RANGE` (112 px from the foot)
  who hit one of its side's scouts in the ring within `TOWER_CALL_T` (the latest such, read off
  `foeHits`); else the mark it already holds; else the nearest rival bot; else the nearest rival
  scout. A scout is only a mark while `seenAt` says the side sees them.
- **The turn and the wind**: the gun turns at `TOWER_TRAVERSE`, and once inside `TOWER_LOCK` of
  the mark it winds for `TOWER_WIND` (0.7 s) before it looses; then `TOWER_RELOAD` (1.6 s).
  While it winds on a scout, `drawTowerFx` (js/draw/towers.js) runs a dashed line on the snow
  from the foot to them and a ring at their feet, brightening as the string comes back.
- **The bolt**: `TOWER_BOLT_T` in the air, then `hurtUnit` (`cause: 'tower'`, a short knockback).
  A bot takes `TOWER_DMG_BOT` (15). A scout takes `TOWER_DMG` (24), and each bolt in a row into
  the same scout adds `TOWER_HEAT` of that, up to three times the first. The spent bolt stands in
  the snow at the mark's feet for `TOWER_PIN_T`.

A wave turns on a tower inside `SOLDIER_TOWER_R` ([the waves](#soldiers-the-waves)), and a
pushing bot only walks in to hit one while its own wave stands in the ring (`aiLaneFort`,
`towerTanked`, [bots](../multiplayer.md#bots)). Its eye joins the side's fog sight (`STRUCTS.tower.sight`).

## The merchant

Each eagle is **driven** by its team's merchant — the old trader in the wide fur hat with the
team-cloth crown and the white beard, seated on the bird's neck in flight (`SPRITES.perch.merchSeat`, `drawEagle`; the look is
[sprites.md](../sprites.md)'s own 16 × 18 grids, built so it never reads as a player on either side,
with a `MERCH` nameplate and a bar in its side's paint over it, `drawMerchant`; the bird wears only its hp bar) — who climbs
down the moment it roosts (`spawnMerchant`, called
from `eagleCrash`, the `merchant` banner in js/sim/robots.js) and works **home** for its side, never
toward the fight. It raises no walls and no guns. Its
first job is its **stall**, and after that **home production**: it raises the **barracks** at its
base's three lane mouths and fells the **back woods** for logs to rebuild them.

**The stall** (`OBJECTS.stall`, world.js) is the shop players walk to. The moment the merchant is
off the bird it looks for a 3×2 site (`merchStallSite`) about `MERCH_STALL_OUT` (6) tiles from
the roost at `MERCH_STALL_ANG` (1.0 rad) either side of the road's axis (`e.laneDir`): just past the
paved crater, beside the road's head, where everybody lands and respawns, never on the road itself
(`laneDist`), on snow holding nothing the axe cannot take. It clears and hammers it exactly as a bay (the shared
`raise` inside `updateMerchant`), and `pitchStall` sets it: the anchor is the front-left tile (the
row the y-sort reads, like the hut's), parts east and north, and the ground under its shade is
repainted. It carries its `team` and nothing else: no `tool`, no hp and no place in `structures`,
so nothing swings at it, shoots it or sieges it. It goes up once, about twenty seconds after the
landing, and until then the merchant's own body is the only counter. A pine or snag it fells is a **log** in its own stock (`b.wood`, no gold, like
the crater). The back woods are every pine inside `MERCH_BACK_R` (13 tiles) of the
roost whose bearing off the road's axis (`e.laneDir`, 0 up the road) is at least
`MERCH_BACK_ARC` (90°): the half facing away from the road. `merchBackPine` picks the one nearest
the roost first (the merchant's own distance breaks near ties) that still has an open side to
stand on, so the clearing grows out from home as one front. Each falls to a **stump** at
`MERCH_SWING_T` a swing, and a timed `b.avoids` list keeps trunks no route reached out of the
pick (without it the pick flips forever between two walled-in trees).

The **bays** (the barracks, [base building](buildings.md)) jump that queue whenever one is due:
**one per lane**, each just inside that lane's mouth of the hollow (`baseBaySpot`,
js/sim/base.js), whose waves walk that lane. The first is due `MERCH_BAY_T` (30 s) after the
landing; `merchNextBay` takes the lanes in `MERCH_BAY_ORDER` (mid, top, bot) and the first with no
bay standing, and `merchBaySite` the nearest 3×2 placement to its spot whose footprint is dry land
off the road holding nothing the axe cannot take. Each lane's **first** bay is free
(`b.bayGift`), so all three go up one after another, about 1:00 to 1:40 of match time on seed 42.
`merchBayBlocker` hands it every pine, snag and rock on the
footprint and a `MERCH_BAY_RING` (1) ring round it, and the stumps on the footprint alone, felled
at `MERCH_BAY_SWING` (0.34 s) through `merchFell` (the axe always leaves a stump everywhere but
the footprint itself). Then `MERCH_BAY_HAMMER` (2.6 s) of hammering from the tile below the door,
with the merchant wholly off the footprint so the bay never goes up round it, sets the site
(`createStruct`, nobody pays gold) and stamps its `lane`. A wrecked bay drops out of `b.bays` and
holds the next raise `MERCH_BAY_REBUILD` (45 s); a rebuild costs `MERCH_BAY_WOOD` (40) logs, except
in an empty yard, so a side is never out of waves.

With nothing due and the back woods felled, it keeps to its post on the road just up from the bird, a step or
two either way. **Wherever it is, it keeps shop** too: its own body is a
[counter](the-merchants-counter.md) as well as its stall, open to either team, and it stands still
and faces a customer served at its body for as long as the sale takes.

It is a unit in `robots` with `merchant: true` and `kind: 'merchant'`: the same
`separateUnits` (player radius and mass — `unitRadius`/`UNIT_MASS.merchant`) and y-sorted draw a
soldier rides, dispatched to `updateMerchant`/`drawMerchant` off the flag after `updateRobot`'s
shared status/stun handling. A bay's owner is the team's first player (`createStruct` needs
one). `owner` is -1: it pays nobody.

**It cannot be hurt, and it has no `hp` field at all rather than a large one.** `unitAlive`
(js/sim/actions.js) answers false for a merchant, and that one function is the gate every target
picker in the game asks (CLAUDE.md's `unitAlive` rule; here also a road tower's mark, a
soldier's `robotFoeUnit`) — so
it is invisible to every weapon in the world rather than merely immune to one of them. It draws no
health bar either: a full bar that could never move would promise a fight that is not on offer.
`DBG.merchants` lists both.
