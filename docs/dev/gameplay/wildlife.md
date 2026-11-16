# Wildlife

`animals` holds **everything that is shot rather than swung at** — the warrens' rabbits, the camps'
wolves and stray robots, the black bear, the orca up in its hole, and the dormant bird, keyed by
`a.kind` with hp from `ANIMAL_HP`. There is no roaming neutral: every beast belongs to a camp.
**The rabbits (8 HP) are a camp's**:
three live in each [SNOWDROP WARREN](../world.md#camps), stocked by `stockCamps` at their plan's
spots and back all at once 40 s after the last of a warren's three dies, on the camp clock
(`updateCamps`, held while anyone stands in the warren). `a.meadow` remembers the warren (not
`a.home`, which is a camp monster's, so a rabbit is never a camp fight).
The camp monsters
([their table](#camp-monsters-neutral-until-hit)) belong to a [camp](../world.md#camps) instead — `a.home` points at it,
and the camp restocks them, all at once, once it is cleared. (**Birds**, 3 HP, are dormant: nothing spawns one.)

**Every animal wears a level** (`a.level`), the hero's plate on the left of its frame
([rendering.md](../rendering/overhead-health-bars.md)): `animalLevelOf(kind)`, which is
`animalLevel()` — the **average hero level of the active players** (bots included), rounded, capped at
`LEVEL_MAX` — never under a camp monster's `MONSTER.lv` (a bear's `BEAR_LV`, 6). `makeAnimal` deals
it at spawn and `relevelAnimal` (every tick in `updateAnimal`) keeps it on the table's average
after, but only while the body is at full hp and hunts nobody: never mid-fight, so a blow never
meets more hp than the last one did. A relevel resets hp to the new full. So the bear that sat out
the early game is as tough as the table when someone finally pulls it. What grows with it is hp, `ANIMAL_LV_HP` a level over `ANIMAL_HP` (rabbit +1, wolf +3; a level-6 pack is 45 hp a wolf), and a camp monster's bite (`MONSTER.lvBite`) — the wolves' numbers are in
[their table](#camp-monsters-neutral-until-hit).
**The kill pays for it**: `animalDies` grows the `YIELD` payout by `ANIMAL_LV_GOLD` (a tenth)
a level, rounded, before the HUNTSMAN bonus is taken off it — a level-6 rabbit is 105 gold, a
level-6 wolf 165, and a level-12 beast a little over twice its level-1 self, about what its hp
grew by. A kind with an `xp` in `YIELD` (wolf, stray robot, the bear) is also worth that much XP,
grown `ANIMAL_LV_XP` (the same tenth) a level and shared by the killer's side standing near
(`shareXp`, [Hero levels](../multiplayer.md#hero-levels)); a rabbit is worth no XP.

**The noticed mark.** An animal that has a player in sight wears a `!` over its head — the
`drawSenseMark` glyph in [rendering.md](../rendering/overhead-health-bars.md), stamina white on
prey and threat red on a wolf — for as long as it does: `a.senseT` counts the seconds since it
first did and is 0 whenever it does not. For prey, "in sight" is a player inside the
`FLEE_SIGHT` ring (through `seenAt`, so stealth keeps it down) **or a flight already under way**,
so a rabbit running wears the reason it is running and one that grazes on has not seen you; for
a camp monster it is a hunt in progress and nothing else — a leash bar still draining is still
a hunt — and the mark going out is the monster giving you up. The **body** says the same thing
at a distance where a `!` is a speck — see the clips below.

## What a beast is doing: the clips

A beast's animation is a named **clip** — a graze, a gallop, a
sit-up ([sprites.md](../sprites.md)) — not a walk flag. `ANIM_CLIPS` (js/sim/wildlife.js) is the whole of it: a row per kind naming the clips that
kind's `SPRITES` entry carries and the frames a second each runs at. `setClip(a, name)` puts a
beast in one and **restarts the loop**, so a sit-up always begins on the frame it was drawn to
begin on; `stepClip(a, dt, rate)` advances it, `rate` being the caller's own gait multiplier —
a wander is the same gallop run slower, not a second animation; and `clipFrame`
(js/draw/bodies.js) is the one thing that turns `a.clip` + `a.animT` into a canvas.

| kind | its clips | set by |
| --- | --- | --- |
| `rabbit` | `idle` low over its paws, `rise` up on its haunches, `hop` | `updatePrey` |
| `wolf`, `scrap` | `idle`, `run` | `updateCampMonster` |
| `alpha` / `dire` (the bears) | `idle`, `walk`, `run`, `bite`, `paw`, `roar` | `updateCampMonster` |

**The head is the tell.** Standing still and settled, a rabbit is low over its paws; standing
still and *wary*, it is rocked back on its haunches. So **a rabbit low over its paws has not seen
you** — the fact the `!` carries, said by the body, at a range where the mark is a speck. It is
what makes closing on one in a SNOW CLOAK (the DRIFT passive) visibly worth doing.

Wary is `a.wary`, held at `PREY_WARY_T` (3 s) whenever a player is in sight or a flight is
under way and decaying otherwise. It is deliberately softer than `a.senseT`, which snaps to 0:
the mark goes out the instant the animal loses you, the head stays up a moment longer, and a
rabbit that has just been run **sits up and watches before it settles again**. It costs nothing —
no speed, no sight, no bolt of its own.

**A rabbit sits up before it goes.** `RABBIT_ALERT` (0.3 s): the first time a rabbit notices a
player it rocks onto its haunches and **holds** — no walk, no flight — and only then bolts. It
is the one still shot anyone is ever offered at one. A **hit** skips it
(`hurtAnimal` clears `alertT`), so a rabbit already running never stops to pose; a stun clears
it with everything else; and the jink still fires out of it, because `arrowAtRabbit` is read
before the beat is.

`updateAnimal()` is the shared shell: it ages the flash and knockback, runs
`updateUnitStatus` (the shared clock — root, slow, mark, fire), dispatches to
`updatePrey` / `updateCampMonster`, clamps to the world, and calls `animalDies(a)` — the
one place a kill pays out, straight from the `YIELD` table. Everything in `animals` is a target
for arrows (the disc `animalHitR` about `animalHitY`: the arrow update sweeps it), gets the amber
hunt reticle, and joins the y-sorted draws.

**An animal is a unit like any other.** `makeAnimal` hands every kind the full status set through
`clearUnitStatus`, so a rabbit, a wolf, a stray robot and a bird take the same damage and the same six
states from every ability and every attack that a player does — rooted, netted, slowed, marked,
stunned, set alight — and wear the same tells at their own size
([status effects](status-effects-one-set-for-every-unit.md)). Nothing about wildlife is exempted
anywhere; what makes them everybody's target rather than nobody's is simply that they carry no
`team`, which `unitFoe` reads as neutral. **A new kind of neutral fauna pushed into `animals` gets
all of it for free** — the checklist for one is in
[checklists.md](../checklists.md#common-changes) ("Adding a kind of unit").

Prey behaviour lives in `updatePrey()`, and **every step of it is a routed goal** — grazing
included, which is what keeps the `.` overlay honest ([rendering.md](../rendering/debug-overlays-hitboxes-and-routes.md#routes)).

- **Grazing.** Idle, then pick one goal and walk it. `wanderGoal(a, base, spread, near, far)`
  tries 8 tiles in an arc, takes the first it can actually route to, and returns `null` when the
  animal is boxed in (the caller just idles and picks again). `preyWander` is the per-kind
  chooser: a rabbit off its warren's deep snow (`warrenHolds`) hops back toward the middle, and
  on it takes short 1–3 tile hops that end on it, so the warren reads as theirs. `navStep` walks it at
  `PREY_SPD`, and arriving (or `ok === false`) drops the goal and idles. The walk wears the
  `hop` / `run` clip at 0.6 rate — the same gait as a flight, taken lazily — and the idle at
  the end of it is where a settled rabbit drops back over its paws.
- **Bolting.** A rabbit flees on `FLEE_SIGHT` / `FLEE_TIME`: it sits tight and goes at 36 px and
  runs 1.6–2.6 s. The trigger asks **`seenAt(p, FLEE_SIGHT)`**, not raw distance, so a hero's
  stealth (DRIFT, −0.15 on `kit.stealth`) shrinks the ring by that share. A hit also sends it
  running from the nearest player (`fleeT`).
- **The flight** is a chain of routed legs at `PREY_RUN` (a rabbit's 104 px/s, half again a
  walking hero's): `fleeGoal(a, from)` picks a tile ~6 tiles off, as straight away from the
  threat as the ground allows (fanning out, then sideways, then past it), the first it can route
  to; a leg that arrives or fails hands over to the next, and an animal with nowhere to run stops
  fleeing. With no threat on the ground (every hero dead or aloft, no beast in sight) it runs out
  the leg under way and stops there. A warren's rabbit runs `RABBIT_LEG` (3.5) tile legs that must end on its warren's deep
  snow (`warrenHolds`), so it circles a hero wading after it instead of leaving the circle.
- **A rabbit's jink.** A rabbit wears the same white bar (`a.dodge`, 0..1), but it is one
  **dodge charge**, ready only when full. `arrowAtRabbit` looks at every shot in flight each step:
  one inside `RABBIT_DODGE_SIGHT` (90 px), still flying *toward* the rabbit, on a line that passes
  within `RABBIT_DODGE_MISS` (14 px) of its body, is a shot coming at it, and `rabbitDodge` spends
  the charge on a hand-steered dash straight off that line — sideways, to the side the body already
  leans to (the other if that one is a wall, `navLineClear`), at `RABBIT_DODGE_SPD` (260 px/s) for
  `RABBIT_DODGE_T` (0.11 s, ~29 px, clear of the 8 px `animalHitR` disc) — and then an ordinary
  bolt (`fleeT`) away from the shooter: the zig, then the zag. The charge comes back over
  `RABBIT_DODGE_CD` (6 s) whatever the rabbit is doing, so an empty bar is the read that the
  next arrow lands; a rooted rabbit never spends it. A shot already past or flying
  wide is nothing to it, and a stun drops a dash mid-jink like any other move.

A kill pays its `YIELD` gold, grown a tenth a level for the animal's level (`ANIMAL_LV_GOLD`,
above), straight to whoever landed the final blow (`a.lastHit`, through
`awardGold` — see [Economy](economy-one-currency.md)); and a burn credits the player that lit it, so an animal that walks away and dies of its
fire still pays. Shots, rolls and the class abilities are what hurt them (there is no
melee — the E swing is for scenery, never for a body); animals are solid
to players, robots and each other except birds, which fly (see
[Unit collisions](unit-collisions.md)), and sprites are side-view only (`dir` is `left|right`).
They are not shown on the minimap or world map.

## Camp monsters: neutral until hit

The [camps](../world.md#camps) keep four kinds — the **wolf** (a den's 3, the top half), the
**stray robot** (`scrap`, a scrap pile's 3, the bottom half: the wolves' numbers in placeholder
art), the **black bear** (`alpha`, its den below the bottom lane, 1) and the **orca** up in its
hole ([below](#the-orca)) — one `MONSTER`
row each (wildlife.js: the bite and what it grows a level, the reach, the seconds between one
body's bites, the hunting speed, the body's radius and mass, `big` for a bear's big body, and
`cause`, the death line a bite writes). The kind keys are the old wolves' and stay so saves
still load. All three run
`updateCampMonster()`:

- **Neutral.** There is no sight and no threat bar filling on a linger: a player can stand at
  the mouth of a den, or beside the bear, and nothing happens. **A hit is the whole trigger** — an arrow, a roll, a
  key, anything through `hurtUnit` — and it wakes the *camp*: `wakeCamp(w, hitter)` hands the
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
  a drawn camp's drawing (`campGround`, through `campNear`) — and
  drains over `CAMP_LEASH_T` (3 s) anywhere off it, with the monster at your heels or not; it
  keeps coming while the bar drains and the hunt ends only when the bar is empty. Then it walks
  home and **heals**: a monster with nobody to hunt mends from nothing to full over
  `CAMP_REGEN_T` (6 s), so a fight you break off is a fight reset, never a chip-away. A quarry
  that dies or boards its eagle hands the hunt straight on to the nearest player on the ground;
  with nobody there the hunt is over. While a camp hunts, the ground's edge lies on the snow as
  its **leash ring** (`drawCampLeashes`, js/draw/marks.js), baked from `campGround` itself so it is
  the leash to the pixel: Graphite dashes running round it, turning `THREAT_COL` red while every
  hunter's bar drains, and gone when the hunt ends. Only a side that sees a hunter sees it.
- **The chase.** The kind's `spd` (the table below) is faster than the 72 px/s walk and slower
  than a slide, so the answer is the momentum system, not
  distance; every one routes around trees and water ([Pathfinding](pathfinding.md)), and a quarry
  it cannot route to (out on a hole) it holds and faces. Bites do the row's `bite` plus `lvBite`
  for every level past the monster's first, inside `reach`, every `cd` seconds *per body*,
  through `damagePlayer(t, dmg, dx, dy, null, cause)` — `'wolf'` (`WENT TO THE WOLVES`) for the
  pack, `'bear'` (`MET A BEAR`) for either bear. **A bear's blow is telegraphed**: in reach it
  plays one of its attacks, on all fours and planted: the `bite` (coil, jaw wide, lunge, snap) or
  the `paw` (paw cocked over the head, swept out flat in front), taken in turn (`BEAR_ATTACKS`,
  `a.atkN`) so two blows in a row never look alike. The blow (`monsterBite`) lands only as the clip
  crosses `BEAR_STRIKE`. **A blow once begun is committed**, like a moba's auto attack: nothing but a
  stun cuts it, the bear turns with its quarry through the wind-up, and the blow lands on that quarry
  anywhere inside `reach × BEAR_COMMIT_REACH` (66 px, 22 px past its reach) - walking away does not dodge it, a roll or a
  dash does. The wind-up is the tell. Only the wake-up `roar` stands the bear on its hinds. A bear walks its patrol on `walk` and gallops the hunt on
  `run`, and moves through the tiles on its `foot` box (5), not its 18 px body: anything near a
  tile wide jams on the first tree beside its route. **Nothing caps the
  pack** ([i-frames](status-effects-one-set-for-every-unit.md#i-frames-only-something-deliberate-grants-them)):
  four wolves on you is four bites a second, ~36 hp/s at level 1. `cd` is the only dial on it.
- **Off duty** it patrols its camp on routed legs from the same `wanderGoal` the prey graze with
  (2–5 tiles); once it drifts past `r * 0.8` the arc narrows to 0.5 rad straight back at the
  camp, so the only way it will walk out there is home. Taking a quarry drops the patrol goal.
  The bear patrols its clearing the same way.
  The noticed mark (`a.senseT`) is worn on a hunt and nothing else.

| Kind | hp (+ a level) | bite (+ a level) | reach / cd / spd | body | kill |
| --- | --- | --- | --- | --- | --- |
| wolf | 30 (+3) | 9 (+1) | 13 px / 1 s / 96 | r 4.5, mass 2, a roll passes through | `YIELD.wolf` 110, a FARM |
| alpha (black bear) | 640 (+50) | 22 (+3) | 44 px / 1.4 s / 100 | r 18, mass 5, a big body a roll **tackles** | `YIELD.alpha` 630, `EPIC_TEAM_GOLD` (280) to every teammate on the ground, the BLACK BUFF for the whole team, a feed line |
| orca (up in its pool, from 20:00) | 1560 (+100), from lv 12 | 28 (+3) | 80 px / 1.8 s / 0: `still`, it never leaves its hole; past its reach it spouts (`spout`, 240 px) | r 20, mass 9, anchored | `YIELD.orca` 880, `EPIC_TEAM_GOLD` to every teammate on the ground, the ORCA BUFF (`p.pushT`, `ORCA_PUSH_T` 180 s) for the whole team, a feed line |

The bear is a `teamPay` camp kind (the orca is the other), in its den in the pit below the bottom
lane (the orca's pool is the pit above the top one). It is first out at 5:00
(`CAMPS.buff.first`; `stockCamps` holds it, `updateCamps` runs the clock, `campCleared` reads it
as cleared until then) and back `repop` (5:00) after each kill. Each kill also counts one more
black bear for the side, for good: `state.bearStacks[team]`, `BLACK_STACK_DMG` (+5%) on every
blow its heroes land per bear, up to `BLACK_STACK_MAX` (4) (`statStackMul`, stats.js, inside
`statBuffMul`; the panel's hover row BLACK BEARS n). Every payout grows `ANIMAL_LV_GOLD` a level like any
kill ([Wildlife](wildlife.md)). The teammate share goes through `awardGold` at each teammate's own feet (so a bot's purchase can
eat it the same tick), to every active teammate who is not dead
or in the air; the buff goes to every active teammate regardless. The bear's 150 XP is the
killer's side's, shared by whoever of it stands near ([Hero levels](../multiplayer.md#hero-levels)).

**The bear buff**: the **BLACK BUFF** (`MONSTER`'s `buff`, named in the wiki; `campBuff(p, t, kind)`,
the constants above the `camp monsters` banner; `p.buffKind` says whose): `p.buffT`
seconds during which every blow the player lands is `CAMP_BUFF_DMG` (×1.25, applied in
`hurtUnit` — a shot, a roll and a key alike) and the walk is `CAMP_BUFF_SPD` (×1.15, in
`abilityMoveMul`). The kill gives the killer's whole team the buff for `CAMP_BUFF_EPIC_T`
(120 s); a fresh grant only ever extends what is left, and the latest bear is the one worn. It is worn as a
**set of eight motes lifting off the snow round the feet in the bear's colour** (`buffCol`: violet) (`drawBuffRing`, js/draw/bodies.js) that loses a mote
at a time as it runs out — the motes are the timer, a full set on a rival is the warning — and it
goes out with the body on death. There is no HUD element for it: the motes are the read.

**Bots and camps.** A bot fights a camp that is already hunting it (`aiNearestWolf` answers
a monster whose `target` is that bot, inside `AI_SIGHT`) — and an **ally** also fights one hunting
anybody on its side inside `AI_ANCHOR_R` of the human, noticed from `AI_ANCHOR_D`, walking in to
its own range first, unless its own bird is under threat: the human is the camp fight's anchor
the way it is a rival's ([Bots](../multiplayer.md#bots), rung 4), so a bear you wake is one
your side comes to. It is *anybody on its side* because the camp turns to whoever is nearest, and the
helpers must not drop out when one of them walks in and takes it off you. A bot will pull a den on its own through
the hunt rung like any other animal, and never a bear (`teamPay`), which a
lone bot would die to. No bot walks *to* a camp deliberately yet — see
[checklists.md](../checklists.md#known-drift).

## The orca

**One orca lives under [its pool](../world.md#camps), the ORCA'S POOL camp's frozen pond in the pit above the top lane** (`CAMPS.orca`; the pond is laid by `genWorld`, js/sim/field.js, as `orcaLakeAt` round `orcaPool()`, an oval `LAIR_POOL` tiles across)
([js/sim/orca.js](../../../js/sim/orca.js), the pixels in [js/draw/orca.js](../../../js/draw/orca.js), its
art `SPRITES.orca`, baked by app/bake-orca/paint.py). Under the ice it is not an animal: nothing shoots it,
nothing walks into it, and it never leaves the water (up, from 20:00, it is one: below). `orca` is one `SAVE_ROOTS` singleton
that rides the snapshot; the client eases it like a body (`netClientLerp`).

- **It cruises** the whole disc (`orcaWater`) as a shadow under the ice at
  `ORCA_SWIM`, a dark under-ice silhouette the size of a bear, from one home tile (`orcaHome`: room
  of `ORCA_MARGIN` round it) to the next; every pick is `hash2` off the tick, never `rng()`.
- **It locks on** (`orcaLook`) the nearest player standing on *its bare ice* (`orcaPrey`: ground
  `1` inside the disc, not in the air) within
  `seenAt(p, ORCA_SIGHT)` of it. Every tile of the pool is its ice. A countdown over their head (`orcaLine`, drawn by `drawOrcaCount`) runs
  `ORCA_LINE` (3) s, 3 2 1, a knock in the ice under them on each number (`iceKnock`), while it
  stalks them (`orcaStalk`): a glide past beside them (`orcaPass` picks the mark, `ORCA_PASS`, on
  the side its heading already sits), a wide turn, then the run in under them as fast as the time
  left asks, up to `ORCA_DASH`. Its heading turns at a capped rate and its speed eases
  (`ORCA_ACC`), so the path is arcs, never a pivot; the shadow drops a little deeper at the lock
  and darkens as it rises (js/draw/orca.js). Off its ice and the hunt drops; it locks nobody for
  `ORCA_LET`.
- **Up, from 20:00** (THE ORCA UP, `CAMPS.orca` `first` 1200, `repop` 360): the orca's camp brings it
  out of the water as a camp monster (`MONSTER.orca`: `still`, `hole`, `spout`, `push`) in a hole
  in the middle of the pool, and the shadow is off while it is (`orcaUp`, `updateOrca`). The pool
  is rough ice (`slickUnder`, js/sim/sim.js; its rime is `paintRime`, js/draw/ground.js): it holds a
  foot like snow, so a blade can stand in reach of the hole instead of skating past it. It lunges
  at whoever it hunts inside its reach (the bear's wind-up and strike, jaws open as the tell) and
  past that SPOUTS (`orcaSpout`): a lump of the pool's ice thrown at the spot they stood on, landing
  `ORCA_SPOUT_T` later on everyone inside `ORCA_SPOUT_HIT`, its ring on the ground the warning
  (`drawOrcaPool`). Felled, it pays like the bear and gives the side the **ORCA BUFF** (`p.pushT`
  for `ORCA_PUSH_T`, blue motes a size out from the bear's): the side's soldiers within
  `ORCA_PUSH_R` of a hero wearing it hit buildings `ORCA_PUSH_STRUCT` (2) times as hard
  (`orcaPushMul`, in `soldierLand`). Then it goes back under (`orcaPutIn`), locking nobody for
  `ORCA_CALM`, until the clock brings it up again.
- **The line runs out** (`orcaStrike`): the ice breaks in the orca's own shape
  (`iceBreak(…, 'orca', …)` with `ORCA_CRACK` of warning cracks, [ice breaks](../world.md#ice-breaks))
  beside and below them (`ORCA_LEAN`, the 3/4 view's behind; shorter lunges where the ice for the
  long one is not there, and no strike at all where there is no bare ice), and the one it is
  after is rooted (`rootUnit`). Under the cracks the shadow glides onto the hole and turns to
  face the spot it lunges at, arriving as they open, so it never jumps. The orca lunges up out of the hole, and at `ORCA_BITE` its jaws
  shut on the spot they stood on (`orcaBite`): every unit `unitsHit` finds within `ORCA_JAWS`
  takes a blow of exactly its health, shield and armour (`orcaLethal`) through `hurtUnit`,
  cause `orca`, the death line `WENT TO THE ORCA`, counted as a beast's in the post-game
  record (`BEAST_CAUSES`). It slides back under by `ORCA_UP` and locks nobody for `ORCA_REST` (1 s) after.
- **Bots run.** Rung 0b of `aiThink`: once the profile's `react` of the line has gone,
  `orcaShore` walks them off its ice by the nearest way. Routes pay its toll
  ([pathfinding](pathfinding.md)), so a bot crosses only where round is much further. A bot file
  reads the line as `me.orca` ([the bot API](../../bots/api.md)).

`DBG` exposes `orca`, `orcaLine`, `orcaAge`, `orcaShore` and `ORCA_LINE`.
