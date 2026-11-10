# Heals: potions

A player heals two ways, League's way: the **roost ring** at home ([Recall and the roost
ring](recall-and-the-roost-ring.md)) and a **health potion** bought at the shop. Every heal goes through `healPlayer(p, n)` (js/sim/player.js),
which caps at max health and returns what it gave. A body under FROSTBITE (`cutHeal`, the item
passive) takes every heal `healCut` (40%) smaller while `healCutT` runs. Nothing is carried but potions: there is no
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
- **Drinking** is the slot's key (`ITEM_KEYS`, js/app/input.js: 5-0 on WASD, 1-6 under CLICK) or a click on its well. Each
  sets the input's `useItem` to a slot index; the sim calls `useItem(p, slot)`, which drinks a
  potion and refuses anything else with the well's red (`itemDenied`). `drinkPotion` refuses while
  a drink is running (`p.potT > 0`), at full health, dead or in the air. A drink heals
  `POTION_HEAL` (100) over `POTION_T` (15 s), `potionTick` paying it every step through
  `healPlayer`. **Nothing stops it**: a hit, a stun, a roll and a recall all let it run. Death ends
  it (`die`), and it never ends a recall.
- **On the HUD** the well shows the flask, the count top-right and the key bottom-left, and sweeps
  the time left of a running drink with the strip's cooldown veil (`drawItemCell`,
  js/ui/hud-draw.js).

## Bots

The built-in brain (js/ai) drinks when under `AI_POTION_HP` (60%), never in its own roost ring (`aiDrink`, rung 1). At a counter it buys one
potion before its build and tops up to `BOT_POTIONS` (2) when nothing on its list is affordable
(`botWantsPotion`); potions are sold last when the build needs their slot (`botStrayPart`).
Scripted bots read `me.potions`/`me.potionT` and drink with
`useItem` ([bot API](../../bots/api.md)).
