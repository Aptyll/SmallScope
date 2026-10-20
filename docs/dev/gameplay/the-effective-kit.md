# The effective kit

`refreshKit(p)` (js/sim/player.js) rebuilds a player's *effective kit*: `baseKit` copies the class
kit and adds the bonus fields (`add`, the [hero stat](hero-stats.md) bonus bag, and `huntMul`,
`foodMul`, `nightHeal`, `harvestMul`, `dodgeCd`, `stealth`, `ambushMul` and the item passives'
fields), then the six item slots (`itemMods`,
js/sim/items.js; see [the items](the-merchants-counter.md#the-items)) write into it. `kitOf(p)` returns that cache, so
every kit read site (movement, `attackDmg`, dodge timing, the AI, the draw meter) picks an
item up without knowing it exists. Sites that read the bonus fields: `statOf` (`add`),
`updateEat`'s landing and the daylight regen (`foodMul`/`nightHeal`), `hitObject`'s fell/break
payouts (`harvestMul`), `animalDies` (`huntMul`, paid to `a.lastHit`, stamped by the arrow loop),
**`seenAt()`** (`stealth`, see [Prone](prone-under-the-snow.md); the wolf pack, both turret checks
*and* `aiNearestEnemy` all go through it, so a stealth item works against a rival player
as well as against wolves and turrets), and the three dodge-refill sites (`dodgeCd`). No item raises
`huntMul`, `foodMul`, `nightHeal` or `harvestMul` now (the [parked cards](roguelike-cards.md) did); they sit at their defaults.
