# The basic attack

Everything in this section lives in **[js/sim/attack.js](../../../js/sim/attack.js)**, under the
`basic attack` banner. **Each hero's left button is one basic attack, and it belongs to the
hero's kit** the way the [abilities](class-abilities-keys-1-4.md) do: a row on its `CLASSES` entry
(`attack`, js/sim/player.js), read through `attackOf(p)`. Nothing about it is carried, loaded,
bought, dropped or swapped: a hero has its weapon from the first frame of the match to the last,
and items and levels grow it through the hero's stats ([hero stats](hero-stats.md)).

| field | means |
| --- | --- |
| `name` | what the tooltip calls it (SHORTBOW, LONGSWORD, OATH GREATSWORD) |
| `art` | the weapon's picture: `SPRITES.weaponArt[art]` (its 12 px icon) and `SPRITES.weaponHeld[art]` (a blade at its real length), js/sprites/weapons.js |
| `cycle` | seconds of renock after a press, before the next draw may start. `attackCycle(p)` scales it by `kit.nock / BOW_NOCK` (anything that shortens `kit.nock` quickens it) and divides by ATTACK SPEED (`asMul`) |
| `kb` | [knockback](#knockback): the multiplier the blow shoves with |
| `shot` | a ranged attack: `{ speed, life, col, look }`, one arrow's full-draw flight, its collar colour, and optionally the `look` it is drawn with in flight in place of an arrow (`HERO_SHOTS`, js/draw/heroes.js) |
| `cut` | a melee attack: `{ reach, half }`, the blade's px at full draw and the radians of sweep either side of the aim ([the cut](#the-cut)) |

Today's rows: the HUNTER's SHORTBOW (a shot, 320 px/s for 0.85 s, `cycle` 55/60 s), the WARRIOR's
LONGSWORD, ARMATOS's OATH GREATSWORD and FORTIVA's CHAIN GREATSWORD (a cut, 28 px and 1.05 rad,
`cycle` 30/60 s, `kb` 1.2), and BELLA's EAGLE SPATHA (a quicker, shorter cut: 26 px, 0.95 rad, `cycle` 26/60 s, `kb` 1; each named hero's blade is drawn as its own through `heroBlade`,
js/draw/heroes.js), and IGNIA's CROOK AND LANTERN (a slower ember shot: 260 px/s for 0.85 s, `cycle` 60/60 s, `kb` 0.6, drawn as `look: 'ember'`; her staff is carried, not swung: `staff` on the row, `HERO_STAVES`). A new hero is a new
`attack` row and nothing else. The ATTACK SPEED stat is read off the same row: `classAs(cls)` is
one over the full draw plus the renock (js/sim/stats.js).

## The press

`basicAttack(p)` is the one entry point, the falling edge of `input.fire`, for every player alike
(`playerAttack`, js/sim/sim.js):

1. The cover is read (`ambushReady`) before anything below can break it.
2. A `cut` runs `cutAttack`, a `shot` runs `shootAttack` plus one `sfxAt('arrow', …)`.
3. `p.nockT = attackCycle(p)` ([the cycle](the-swing-tools-e.md#the-cycle)), and `risePlayer` (the attack is what
   breaks cover).

What it lands for is `attackDmg(p, pw, amb)`: the hero's DAMAGE stat (`statOf`) plus the kit's
speed bonus (`spdDmg`, on a body that is moving), **the draw scales the whole sum**
(`drawDmgMul`, [the draw](the-swing-tools-e.md#the-draw)), and an ambush multiplies that by `kit.ambushMul`. Every
blow it lands carries `basic: true` to `hurtUnit`, which is how a hero's on-basic-attack passive
(`passiveDeal`, js/sim/heroes.js) tells it from an ability.

**A shot** is one arrow down the aim from `BOW_Y` above the feet, its speed and life from
`shotFlight(A.shot, pw)`: the same envelope the aim line measures. It goes into the `arrows`
array with `solid: true`, the row's `kb` and `col`, and `basic: true`. **The PIERCE** (HUNTER's
first ability, js/sim/abilities.js) is a heavier arrow through the same `shotFlight`, flagged
`pierce` so it cuts every body in its line.

### Knockback

`kb` is a **multiplier**, not a speed, and 1 is the ordinary shove. It has to be, because the
three kinds of unit are already pushed at three different weights — a player at `HIT_KB` (110
px/s, js/sim/player.js), a worker at `ROBOT_KB` (40, js/sim/robots.js), an animal on a curve off
the draw (25–70) — and one number on an attack has to mean the same thing landed on any of them.
It rides to `hurtUnit` as `o.kbMul`, which scales whatever shove that kind takes; `o.kb` beside it
is still the absolute px/s an *ability* (or the cut's own 30) picks for a particular blow. A shot
with no `kb` at all takes the ordinary shove, ×1.

## The cut

A `cut` row is a blade. **The draw is still the throttle** — a tap reaches `SLASH_REACH_MIN`
(60 %) of the blade for `DRAW_DMG_MIN` of the damage, a full draw the whole blade at its whole
worth (`slashReach`). What the edge reaches is the **wedge** —
`inCone`/`unitsInCone`/`structsInCone` (js/sim/actions.js): a body counts by its centre plus its
own radius, a building by any tile of its footprint — and nothing else: a body behind the
attacker is never cut. In the practice field the wedge's far half also lands on the dummies
(`abHitDummies`). Each cut leaves its wedge on the snow (`slashes`, `SLASH_T` 0.28 s, ticked by
`updateSlashes` from `updatePlay`) — the outline in white, gold when it landed, with a bright edge
sweeping across it — drawn by `drawSlashes` (js/sim/abilities.js), and the local player's draw
grows the same wedge in place of the aim line (`drawAimLine`), so the reach the cut is about to
have is on the ground before it lands. **The hand swings the blade itself**: it is drawn at its
real 22 px length (`SPRITES.weaponHeld`, or the hero's own blade), a draw winds it back to the
start of its arc, and for `SLASH_T` after the loose (`p.slashT`/`slashA`/`slashHalf`, counted
down in `updatePlayer`) `drawHeldTool` sweeps it across the wedge pivoting at the hands, two
ghosts of it trailing. A bot with a blade fights at `AI_MELEE_D` (18 px) instead of a bow's 70,
and only presses fire once the target is under the edge (`aiMelee`, js/ai/ai.js).

## A shot in flight

Every shot flies straight.

**A shot meets everything its step crossed, then one blow.** A step is a *segment*, never a point:
`shotContacts` (js/sim/sim.js, `the shot's sweep`) lists what the segment met in the order it met
it — the tiles it entered (a grid DDA) up to the first that ends it (a rival roost, the practice
dummy, a solid tile), every **standing building by the shape it is drawn in** — `structShotBox`,
the box its sprite's opaque pixels cover where the draw lays it (`structArtOff`, so the barracks'
roof 6 px over its footprint stops a shot); a site still going up is its footprint alone — a target face,
and every body whose hit disc it crossed (`sweepDisc`, and `sweepBox` for the building's box): the
`ARROW_HIT_R` (10 px) disc at a player's chest, `ROBOT_HIT_R` (7) about `robotHitY` for a chassis,
`animalHitR` about `animalHitY` for a body that may be up on its own altitude. So speed never
skips a hit. The step's bounding box turns nearly every body away before the sweep is asked. The
tile a step starts in was asked by the step before; a shot's **first** step asks its spawn tile
only if it is heading into it (still inside `TILE`/2 on), so a bow overhanging the tree its body
hugs shoots out over the edge and never through the trunk. The arrow loop takes the contacts in
order — a raised tower shield first, on a player — and every body goes through the same local
`blow()`, which hands the shot's damage and shove to `hurtUnit`. **The solid-tile branch is also
the one place a shot sieges**: when the tile that stopped it is a rival's building
(`structFoe(sideOf(a), structOf(objAt(…)))`) the damage goes through `hurtStruct`, `STRUCT_DR`
(60 %) off like any player blow. A shot never hits its own side or its shooter.

## The item slots

**The six item slots are on the bottom bar at all times**: a three-by-two grid after the ability
wells (`itemCellRect(0..5)`, js/ui/strip.js), showing `p.items` ([the items](the-merchants-counter.md#the-items)) left to
right and top row first as the shop fills them. With the purse beside them it
is the whole of what a player carries into a fight: there is no backpack (cut in 0.531). The
hero's basic attack has no well: it is the hero's own, and hovering the portrait raises
`tipAttack` (its damage, draw, renock and reach).

Nothing in a slot is dragged or clicked: it is read. `stripHit` answers `{kind:'item', i}`, a
hover raises the item's `tipItem` (the shop's own card), and the
[drawing](../rendering/the-hud-corners/the-hud-strip.md) has no words: a slot's rim says part or finished
(`itemMetal`, js/sim/items.js), and an empty one shows its number, dim.
