# The effective kit

`refreshKit(p)` (js/sim/player.js) rebuilds a player's *effective kit*: `baseKit` copies the class
kit and adds the bonus fields (`add`, the [hero stat](hero-stats.md) bonus bag, and `huntMul`,
`foodMul`, `nightHeal`, `harvestMul`, `dodgeCd`, `stealth`, `ambushMul` and the item passives'
fields), then every [card](roguelike-cards.md) in `p.cards` and the six item slots (`itemMods`,
js/sim/items.js; see [the items](the-merchants-counter.md#the-items)) write into it. `kitOf(p)` returns that cache, so
every kit read site (movement, `attackDmg`, dodge timing, the AI, the draw meter) picks a card or
an item up without knowing it exists. Sites that read the bonus fields: `statOf` (`add`),
`updateEat`'s landing and the daylight regen (`foodMul`/`nightHeal`), `hitObject`'s fell/break
payouts (`harvestMul`), `animalDies` (`huntMul`, paid to `a.lastHit`, stamped by the arrow loop),
**`seenAt()`** (`stealth`, see [Prone](prone-under-the-snow.md); the wolf pack, the road towers
*and* `aiNearestEnemy` all go through it, so a stealth card or item works against a rival player
as well as against wolves and towers), and the three dodge-refill sites (`dodgeCd`). No card or
item raises `huntMul`, `foodMul` or `nightHeal` now; they sit at their defaults.
