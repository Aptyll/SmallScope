# Robots

`robots` holds the waves' [soldiers](#soldiers-the-waves) (one 12×10 faceless tread-bot grid
in team colour, two tread frames — see [sprites.md](../sprites.md)) and the two eagles'
[merchants](#the-merchant), which ride the same list with `merchant: true`. `updateRobot()` runs
`updateUnitStatus` first, so a chassis wears every state a player can be put under (`makeRobot`
clears the full set into it): rooted, netted, slowed, marked, stunned, on fire, and scrapped by a
burn like anything else ([status effects](status-effects-one-set-for-every-unit.md)). A stun
switches the brain off, and otherwise the merchant runs
`updateMerchant` and a soldier `updateSoldier`. Worker bots (the player-built bot bay's crew)
were cut in 0.525.
Robots drive on `navStep` ([Pathfinding](pathfinding.md)) and are solid to players and animals
(see [Unit collisions](unit-collisions.md)). They join the y-sorted draws via `drawRobot()` in
team colours, each kind its own sprite set (the whole sprite bobs while driving, a melee chassis rams
its target, a thrower's ball leaves its hand) and show a health bar. Their SFX are positional (`sfxAt`) so a remote base doesn't spam audio.

**Three kinds of soldier, League's.** What a kind is lives in `SOLDIER_TYPES` (js/sim/robots.js,
read through `soldierType(b)` off `b.type`): its health and its growth, its blow (`dmg` every `cd`
s from `reach` px; a building takes `struct` times it, the bird `eagle`), the shot that carries a
blow from range (`shot`, s in the air), its bounty share and its XP share, and its sprite set.
**Melee** rams with its chassis (5 every 1.1 s, 15 px, 60 hp), **ranged** throws a packed snowball (6 every
1.5 s from 72 px, 34 hp). What flies is the kind's `look` (`SOLDIER_SHOTS`: the
sounds it leaves and lands with, the puff where it hits). `robotStrike(b, e, pt)` is the single blow: an axe lands
now through `soldierLand`, a thrower's ball leaves its kind's `hand` (`soldierThrow`) as its
own thing in `soldierShots` and lands when its time is up (`updateSoldierShots`) on what it was
aimed at, a body where it then stands (it follows, it is not a dodgeable shot). It carries its blow
(`soldierBlow`), so it lands the same if its thrower is stunned or scrapped meanwhile, and stays
`SOLDIER_SPLAT_T` s more for its splat. `soldierLand` sends a building through `hurtStruct` (the
same path a player's E swing takes, so the wreck, the payout and the `WRECKED A` line are one code
path), the bird through `hurtEagle`, and any **body** through `hurtUnit` with `cause: 'soldier'`,
credited to nobody. The shot's pixels are `drawSoldierShots` (js/draw/soldiershots.js), over the
bodies: the claw's own snowball on a low lob, then a splat of
snow on what it struck. A soldier faces what it aims at, else the
way it drives (`b.faceL`, set in `updateSoldier`), which is the way its wreck falls. Targets come from
`robotFoeUnit(b, range)` (nearest rival player or bot; players are noticed through `seenAt`, so a
hidden body is as invisible to a soldier as to a wolf) and `enemyStructNear(team, x, y, r)`.
`foePoint(e, fx, fy)` is where the axe lands: a body a little above its feet, or **the nearest
point on a building's footprint** — a body measuring to a 3×2 building's centre could never reach
past the wall it is standing against. `drawRobot()` draws the swing off `b.atkAim` and `b.atkCd`.

A bot is **shootable**: its hitbox is `ROBOT_HIT_R` (7) about `robotHitY(b)` (`b.y - 1`, the
middle of a body whose treads sit at `b.y + 4`; a hero's machine is its own size, `robotHitR`), and `hurtRobot(b, dmg, nx, ny, src)` is the single entry
point for damage — flash, knockback, the damage total, a scrap-and-sparks burst, `SFX.hit`, and
`robotDies` at zero. Shots reach it (only from another team — friendly fire is off, as it is for
players), and so does every class ability and the roll, all of them through `hurtUnit`. A downed
bot is not a downed player, so it never touches the kill count; what it pays is
[Farming](#farming).

## Soldiers: the waves

The `waves` and `soldiers` banners (js/sim/robots.js). On the match's wave beat (`waveBeat`:
`WAVE.first`, 60 s of match clock, then every `WAVE.waveT`, 30 s) each side queues a column on
**each lane** (`waves`, one per side per lane; `waveKinds` cuts it to the lane's `WAVE.cap`) and
`updateWaves` walks it out of its own perch one soldier every `WAVE_ROLL` — a tread-bot chassis in
its side's paint that carries nothing (a melee soldier's blow is the chassis itself ramming in,
`soldierRam` in `drawRobot`) — and marches **its lane** (`b.lane`: 0 top, 1 bottom) to the rival
bird. A side whose bird is off its perch sends none. `makeSoldier(team, lane, type)` is
`robotBody` with `kind: 'soldier'`, `owner: -1` (no cargo, no payout but the bounty), stood
`WAVE_OUT` tiles out along its lane (`laneOut`, js/sim/field.js), and a **route**: its lane's
waypoints from its own perch to the rival's (`laneWaypoints`, [the lanes](../world.md#the-lanes),
every `LANE_STEP` tiles). The rival roost itself is read live each frame. On the march a
soldier rides its own side's cable of its lane when its end is `SOLDIER_ZIP_GAIN` nearer the rival
bird (`soldierBoard`), and reads its route again where it lets go (`soldierRejoin`). `updateSoldier` is four
rungs, first hit wins:

1. a rival **unit** inside `SOLDIER_AGGRO` (96 px — `robotFoeUnit`, so a hero hidden from it lets a
   column walk past): close to its kind's `reach` and strike (`robotStrike`, its kind's blow,
   `cause: 'soldier'` — `DEATH_CAUSE.soldier` is the feed line), marking it in `b.hitFoe` for the
   bots' last hit (`aiFarmHold`);
2. the rival **bird** inside six tiles: the nearest roost tile (`aiEagleTile`), and
   its kind's `eagle` (a melee 8, against a hand's 20) a blow through `hurtEagle` — ahead of any
   building, since whatever a side builds round its bird stands within a step of it;
3. a rival **building** inside `SOLDIER_SIEGE` (40 px — what is in its way: a rival
   pump), or a rival [lane tower](#road-towers) inside
   `SOLDIER_TOWER_R` (160 px, `towerNear`), which a wave stops to bring down before it marches
   on: `hurtStruct` through the same `robotStrike`;
4. the **march**: the next waypoint (`SOLDIER_WP_R` to count it reached; one `navStep` cannot
   route to is *skipped*, never waited on, so a column never stands on a blocked tile), then the
   roost, stopping at every rival lane tower standing on the way.

It is allowed to fight and nothing else — no tree tempts it. Two waves
meeting on a lane therefore grind each other down (they are rival units to each other), which
is the stalemate a player breaks by walking out. It takes every hit, state and sweep like any
other body (`bot: true` is what `isAnimalUnit` reads to send a blow down the robot path rather
than the animal one — a soldier carries a `kind` too), the roosting bird's **gust** rears at it
and buffets it like a player (`updateEagle`/`eagleGust`), a road tower marks it, and it dies through
`robotDies` paying its bounty to the rival who lands the **last hit** ([Farming](#farming)) and
`SOLDIER_XP` (20) times its kind's `xp` shared by every rival hero standing near, whoever scrapped it
([Hero levels](../multiplayer.md#hero-levels)) — no feed line, six or seven a wave. Its health is its kind's `hp` plus its `grow`
for every `WAVE.grow` the match has run (`makeSoldier`), so a hero's grown blow never makes every
hit a last hit. The cap on a side's soldiers on one lane is `WAVE.cap`. Bots read them as attackers at their bird and as targets in
sight, and a pusher walks with its own column ([multiplayer.md](../multiplayer.md#bots)).


## Farming

js/sim/farm.js. League's last hit: a rival soldier pays **only** the rival who lands its final
blow — `soldierBounty(b)`, its kind's `bounty` share (melee 1, ranged 0.65) of `SOLDIER_BOUNTY`
(57) plus `SOLDIER_BOUNTY_GROW` (4) for every `WAVE.grow` (180 s) the match has run, paid by `robotDies` through `awardGold` — and a camp monster
(`a.home`: the wolves and the bears) pays its killer as ever (`animalDies`). Each is one **farm**
(`farmHit`: `p.farm`, in `PLAYER_RECORD`), which the scoreboard's FARM column and the post-game
COMBAT group's FARM row print. A soldier the waves, a tower or a beast finish pays nobody: the
**miss**. Both make a **coin pop** (`coinPop`, recorded as the `coin` event for the screens that
do not run the step, aged by `state.tick`): a gold coin that hops and spins off a last hit, and a
grey one that drops and fades where a miss fell, drawn only for the side that missed it and only
within `COIN_MISS_R` of the watched body (`drawPops`, js/draw/pops.js). A rival's gold coin in
the fog is not drawn. The scrap piles are the jungle: three stray robots at 110 each and back `repop` (75 s)
after the last dies, its clock over the camp and on both maps ([camps](../world.md#camps)).
Bots farm through two roles, the LANER and the JUNGLER ([multiplayer.md](../multiplayer.md#bots)).

## Road towers

The `road towers` banner (js/sim/towers.js). Each lane has two `STRUCTS.tower` a side (ROAD TOWER:
3x2, 700 hp, `fixed`, so nobody upgrades, repairs or wrecks one for a refund) on its centreline,
one on the straight and one on the bend by the perch (`TOWER_SPOTS`, placed at boot by
`placeTowers`, [the lanes](../world.md#the-lanes)).
`updateTower` (called from `updateStructures`) is one gun on a turntable:

- **What it shoots** (`towerMark`): a rival hero inside `TOWER_RANGE` (112 px from the foot)
  who hit one of its side's heroes in the ring within `TOWER_CALL_T` (the latest such, read off
  `foeHits`); else the mark it already holds; else the nearest rival bot; else the nearest rival
  hero. A hero is only a mark while `seenAt` says the side sees them.
- **The turn and the wind**: the gun turns at `TOWER_TRAVERSE`, and once inside `TOWER_LOCK` of
  the mark it winds for `TOWER_WIND` (0.7 s) before it looses; then `TOWER_RELOAD` (1.6 s).
  While it winds on a hero, `drawTowerFx` (js/draw/towers.js) runs the gun's sight line, one
  unbroken thread in its side's colour, out from the gun's nose toward their chest: it reaches them as
  the string comes all the way back (`TOWER_AIM_HOT`), then burns pale until the loose.
- **The bolt**: `TOWER_BOLT_T` in the air, then `hurtUnit` (`cause: 'tower'`, a short knockback).
  A bot takes `TOWER_DMG_BOT` (15). A hero takes `TOWER_DMG` (24), and each bolt in a row into
  the same hero adds `TOWER_HEAT` of that, up to three times the first. The spent bolt stands in
  the snow at the mark's feet for `TOWER_PIN_T`.

A wave turns on a tower inside `SOLDIER_TOWER_R` ([the waves](#soldiers-the-waves)), and a
pushing bot only walks in to hit one while its own wave stands in the ring (`aiLaneFort`,
`towerTanked`, [bots](../multiplayer.md#bots)). Its eye joins the side's fog sight (`STRUCTS.tower.sight`).
Its side's cable on its lane runs only as far as the furthest of its towers still standing
([the ziplines](../world.md#the-ziplines)).

## The merchant

Each side's merchant — the old trader in the wide fur hat with the team-cloth crown and the white
beard ([sprites.md](../sprites.md)'s own 16 × 18 grids, built so it never reads as a player on
either side, with no word over it: its tent and the B SHOP prompt
say what it is, `drawMerchant`) — keeps its side's **trading post** in its court behind the perch,
the shop players walk to (the `merchant` banner, js/sim/robots.js). It never walks anywhere.

**The post** (`OBJECTS.stall`, world.js) stands from boot on the perch's centre line, behind the
bird (`MERCH_STALL` tiles from the world's edge, mirrored for BLUE; `placeStalls`), in the court the
map cuts for it ([world](../world.md): a bay of the plaza's stones with two wings of pines round
it), so both lanes are the same walk from it. It faces the field the way its bird does: RED's as
drawn, BLUE's mirrored. The anchor is the front-left tile (the row the y-sort reads), parts east
and north; the merchant's **sled** (`OBJECTS.sled`) is parked a tile off it. It carries its `team`
and nothing else: no `tool`, no hp and no place in `structures`, so nothing swings at it, shoots it
or sieges it.

**It builds the post itself.** A match starts with the merchant in its bird's saddle
(`spawnMerchants` at `beginMatch`). It hops off the back to its seat (`hopT`, `MERCH_HOP` seconds,
a straight arc of its own: no nav), then raises the tent a step every `MERCH_STEP` seconds
(`built` 0 to `MERCH_BUILT`: its load set down, the counter, the frame, open), with a puff and a
hammer's knock a step, and from then on it **sits** at its counter (`merchPost`), drawn as part of
the open tent's own grid. `stallBuilt(team)` is the step a post stands at, whole with no match on.
The post **trades from the first second**, built or not, and the body is a
[counter](the-merchants-counter.md) too once it has landed. A seated merchant takes no part in
`separateUnits`: it stands inside its own footprint.

A hero can set bodies of its own in `robots` too: FABER's small guns and old engine
(js/sim/faber.js) are a `robotBody` with his side, his id and a `kind` that `HERO_MACHINE`
(js/sim/heroes.js) answers. `updateRobot` runs that row's brain after the shared status/stun
handling, `drawRobot` its draw, and `robotDies` pays a rival the row's `pay` (no farm, no
bounty). Towers, soldiers and every weapon meet one as they meet a soldier, and a hero bot
targets one as it targets a soldier. Every wreck also runs `HERO_WRECK` (FABER's spare parts).

It is a unit in `robots` with `merchant: true` and `kind: 'merchant'`: the same
`separateUnits` (player radius and mass — `unitRadius`/`UNIT_MASS.merchant`) and y-sorted draw a
soldier rides, dispatched to `updateMerchant`/`drawMerchant` off the flag after `updateRobot`'s
shared status/stun handling. `owner` is -1: it pays nobody.

**It cannot be hurt, and it has no `hp` field at all rather than a large one.** `unitAlive`
(js/sim/actions.js) answers false for a merchant, and that one function is the gate every target
picker in the game asks (CLAUDE.md's `unitAlive` rule; here also a road tower's mark, a
soldier's `robotFoeUnit`) — so
it is invisible to every weapon in the world rather than merely immune to one of them. It draws no
health bar either: a full bar that could never move would promise a fight that is not on offer.
`DBG.merchants` lists both.
