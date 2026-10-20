# Heals: potions, creek fish and berry bushes

A player heals four ways, League's way: the **roost ring** at home ([Recall and the roost
ring](recall-and-the-roost-ring.md)), a **health potion** bought at the shop, a **creek fish** rolled
over, and a **berry bush** walked into. Every heal goes through `healPlayer(p, n)` (js/sim/player.js),
which caps at max health and returns what it gave. Nothing is carried but potions: there is no
pouch of food, no chew and no fishing.

## The health potion

`BUILD_ITEMS.potion` (js/sim/items.js, the `potion` banner): `price` 50, `stack` 5, no stats. It is
the one **stack item**: up to five sit in **one** of the six item slots, which holds `'potion'`
while `p.potions` is how many. `isStack(id)` says so; `isPart` and `ITEM_PARTS` leave it out.

- **Buying** goes through `buyItem` like any item (`{ kind: 'shop', act: 'item', id: 'potion' }`),
  which hands it to `buyPotion`: the first one takes a free slot, the next ones add to the stack,
  and a full stack or no free slot is refused (`potionRoom`).
- **Selling** goes through `sellItem` on the slot like any item, one potion at a time, at the usual
  `ITEM_SELL` (half: 25). The last one sold frees the slot (`takePotion`).
- **Drinking** is the slot's key (`ITEM_KEYS`, js/app/input.js: 5-0 on WASD, 1-6 under CLICK and
  MOUSE), a click on its well, the gamepad's d-pad left, or the MOUSE scheme's wheel wedge. Each
  sets the input's `useItem` to a slot index; the sim calls `useItem(p, slot)`, which drinks a
  potion and refuses anything else with the well's red (`itemDenied`). `drinkPotion` refuses while
  a drink is running (`p.potT > 0`), at full health, dead or in the air. A drink heals
  `POTION_HEAL` (100) over `POTION_T` (15 s), `potionTick` paying it every step through
  `healPlayer`. **Nothing stops it**: a hit, a stun, a roll and a recall all let it run. Death ends
  it (`die`), and it never ends a recall.
- **On the HUD** the well shows the flask, the count top-right and the key bottom-left, and sweeps
  the time left of a running drink with the strip's cooldown veil (`drawItemCell`,
  js/ui/hud-draw.js).

## The creek fish

The creek carries one kind of fish, a whitefish every `CREEK_FISH_GAP` tiles (`creekFishAt`, the
`creek` banner of js/sim/world.js). A hurt body **rolling** over a showing fish takes it
(`creekFishCatch`, called from the roll in `playerMove`, js/sim/sim.js): `CREEK_FISH_HEAL` (40) at once through
`healPlayer`, nothing carried. Two rollers reach one fish through `contest('creekfish:' + i)`. Its
place swims back after `CREEK_FISH_BACK` (45 s; `state.creekGone`). A body at full health rolls
past and leaves it. Fish cannot be bought or sold. The fish under the lakes' ice are scenery (the
`fish` banner, js/sim/wildlife.js).

## Berry bushes

`OBJECTS.bush` is walk-through (`solid: false`). Walking into a **ripe** one (`berries > 0`) heals
`BUSH_HEAL` (30) at once and empties it (`bushTouch`, js/sim/world.js, called every step from
`updatePlayer`; the feet tile decides, contested on `'bush:' + idx`). It regrows over
`BUSH_REGROW` (70 s) on the object clock, and its look is the cooldown: bare, then buds
(`BUSH_BUD_T`), dull berries (`BUSH_RIPEN_T`), ripe. Hovering a regrowing bush shows the clock as a
neutral bar. A body at full health walks through and leaves it ripe. No berry drops and E does
nothing to a bush.

**Where they stand**: `placeBushes()` runs at boot after the camps and landmarks
(js/app/boot.js) and uses **no rng**. genWorld still lays its own bushes so its stream never shifts
(CLAUDE.md hard rule 3); `placeBushes` takes every one of them up and sets:

- `BUSH_DEN_N` (2) round each of RED's wolf dens, toward the map's middle, mirrored onto BLUE's dens
  (tx <-> ty). A pair is laid only where both tiles are open, nudged up to `BUSH_NUDGE` tiles.
- One on **each** bank of the creek at `BUSH_RIVER_W` tiles either way from its middle (the outer
  places sit by the bears' stretches), `BUSH_BANK` tiles off the water. The creek meanders, so it is
  not its own mirror; a bank pair is the fair split instead.

An open tile is plain snow with no object, off the water and the orca's lake, outside a base's keep
and a camp's ground, and `BUSH_SPACING` from another bush. The practice field has none.

## Bots

The built-in brain (js/ai) drinks when under `AI_POTION_HP` (60%), never in its own roost ring (`aiDrink`, rung 1). Its heal rung (`aiHealRung`, 5', after the
fight rungs) walks into a ripe bush within `AI_HEAL_R` tiles, or rolls over a showing creek fish
from the dry bank when the roll lands on dry ground (`aiFishRoll`), only when hurt and with no
rival within `AI_HEAL_SAFE`. A fish chase gives up after `AI_FISH_T`. At a counter it buys one
potion before its build and tops up to `BOT_POTIONS` (2) when nothing on its list is affordable
(`botWantsPotion`); potions are sold last when the build needs their slot (`botStrayPart`).
Scripted bots read `me.potions`/`me.potionT`, see ripe bushes in `nodes`, and drink with
`useItem` ([bot API](../../bots/api.md)).
