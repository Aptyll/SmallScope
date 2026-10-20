# The pouch

A player carries food and gold, and nothing else: the six item slots are the build
([the merchant's counter](the-merchants-counter.md)), and there is no backpack. (The backpack
drawer, its drag and the burrow it held were cut in 0.524, with the ore and the cards.)

**The pouch** (`p.food`, `newPouch()` in the `players` › `inventory: the pouch` banner of
js/sim/player.js) is a set of uncapped counters beside the wallet, one per `ITEMS` row. It
holds the two **meals**. A meal is pressed on Q and F or on
[the hud strip's meal wells](../rendering/the-hud-corners/the-hud-strip.md). Being uncapped is
why every count that shows one goes through **`shortNum`** (js/sim/core.js): `999`, then `1.2K`,
`12K`, `340K`, `1.2M`, four characters at most. The exact figure stays in the tooltip, the
surface whose job is comparing numbers.

| Item | Icon | Used by |
| --- | --- | --- |
| `berry` | `itemBerry` | Q, or clicking the strip's meal well: eats it (see [Food](food-the-meal-is-a-channel.md)) |
| `fish` (frost pike) / `sunfish` / `whitefish` / `snowChar` | `itemFrostPike` / `itemSunfish` / `itemWhitefish` / `itemSnowChar` | F, or clicking its meal well: eats one (same; which one: `fishToEat`) |

Four helpers are the whole API, and nothing outside them touches `p.food`'s counts except the
meal itself: `bagCount(p, type)`, `bagRoom(p, type)` (`Infinity` for a pouch kind, 0 for
anything else), `bagAdd(p, type, n)` (always takes it all) and `bagTake(p, type, n)`. The names
are older than the pouch. The drop pickup, the catch, a food trade at the counter and the bots'
food check go through them, so a new food is one `ITEMS` row with a `heal`.

Nothing can be refused: a drop on the snow is always picked up whole (the drop loop in
`updatePlay`, js/sim/sim.js).
