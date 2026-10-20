# Inventory and the backpack

A player carries in two places, and which one a kind lives in is **one flag on its `ITEMS` row**.

**The bag** (`p.bag`) is a fixed array of `p.bagCap` cells, each one `null`
or a `{ type, n }` stack of at most `ITEMS[type].stack`. Everyone starts with **one bag of 12**
(`BAG_CAP`, two rows of `BAG_COLS` 6 in the [drawer](../rendering/the-hud-corners/the-backpack.md) under the weapon shelf, shut until B); a second bag is a bigger `bagCap` and a longer array,
nothing else. It holds the consumables and the ore (and a stray tool or bit, which nothing drops
now) — and a bit only takes a cell once every tool carried (the one in hand, then
each in the pack) is full, since `fitAdd` (js/sim/tools.js) loads it into them first.

**The pouch** (`p.food`, `newPouch()`) is a set of uncapped counters beside the wallet, and it
holds the two **meals** and the five **unopened card** rarities — everything with
`pouch: true`. A pouch kind takes no cell, cannot be dragged, cannot be arranged and cannot be
refused: a meal is pressed on Q and F or on
[the hud strip's meal wells](../rendering/the-hud-corners/the-hud-strip.md), and a card opens itself the moment it
is held, so the cells are all the build's. Being uncapped is why every count that shows
one goes through **`shortNum`** (js/sim/core.js) — `999`, then `1.2K`, `12K`, `340K`, `1.2M`, four
characters at most. The exact figure stays in the tooltip, the surface whose job is comparing
numbers.

| Item | Icon | Where | Used by |
| --- | --- | --- | --- |
| `berry` | `itemBerry` | pouch, no cap | Q, or clicking the strip's meal well — eats it (see [Food](food-the-meal-is-a-channel.md)) |
| `fish` (frost pike) / `sunfish` / `whitefish` / `snowChar` | `itemFrostPike` / `itemSunfish` / `itemWhitefish` / `itemSnowChar` | pouch, no cap | F, or clicking its meal well — eats one (same; which one: `fishToEat`) |
| `cardWhite`/`cardGreen`/`cardBlue`/`cardPurple`/`cardGold` | `itemCard<Rarity>` | pouch, no cap | nothing: it opens itself the moment it is held, one at random (see [Roguelike cards](roguelike-cards.md)) |
| `tunnel` | `itemTunnel` | bag, stack 5 | a **consumable** (`use`): V, or clicking its pack cell (`sendBagCell`) — stands the hole's ghost up, and the dig spends one (see [The burrow](the-burrow-a-tunnel-anyone-can-ride.md)) |
| `tool:<id>` | `toolArt_<shape>_<tier>` | bag, stack 1 | nothing but the counter, which buys it back (see [Tools and bits](tools-and-bits.md)) |
| `bit:<id>` | `bitArt_<id>` | bag, stack `BIT_STACK` 255 | loads itself into the tool in hand on pickup (`fitAdd`) |
| `ironstone`/`frostglass`/`sunstone` | `itemOre_<key>` | bag, stack `ORE_STACK` 99 | nothing yet but the counter, which buys it at half its `price` (2 / 12 / 40); see [Mining a rock](mining-a-rock.md) |

An unopened card is an ordinary `ITEMS` entry (`pouch: true`) — one per rarity, since a white
card and a gold card are not interchangeable — which is what makes the drop pickup and the
counting helpers free for it, same as any other carried item. Tools and bits
register their rows the same way, from [js/sim/tools.js](../../../js/sim/tools.js), under namespaced keys so
a kind can never collide with a berry.

A tool is the **one instanced** item (the [CLAUDE.md](../../../CLAUDE.md) hard rule): it stacks to 1
and moves as a whole object (`bagPut(p, cell)`, and `spawnDrop`'s `it` payload). `bagAdd` cannot make one and must not be asked to — the drop pickup
branches on `d.it` for exactly this reason. Everything else in the bag is stateless.

**A bit stacks to `BIT_STACK` (255)**, which is a deliberate "as many as you will ever find". A
bit is ammunition for the build rather than a thing to ration: the twelve cells are for the *choice*
between kinds. 255 is the ceiling because the count still reads in three characters inside an 18 px
well — past that the number would need `shortNum` and a cell would stop saying exactly what is in
it. A tool stacks to 1; the pouch kinds (meals, cards) have no stack at all.

**The slot is the unit of capacity for what the bag holds**, which is the whole reason it is an
array and not a row of counters: two half stacks cost two cells, so a bag genuinely fills and the
pickup path can genuinely refuse. Six helpers in the `players` banner are the entire API —
`bagCount(p, type)`,
`bagUsed(p)`, `bagRoom(p, type)` (room in partial stacks + a full stack per empty cell),
`bagAdd(p, type, n)` (tops up partial stacks before opening a cell, returns how many went in),
`bagTake(p, type, n)` (spends from the **last** stack backwards, so partials empty and free their
cell) and `bagPut(p, cell)` (an instanced cell into the first free slot, or false). Nothing outside
them touches `p.bag` — `updateEat` (the meal landing), the fish catch, the drop pickup and the AI's
food check all go through the six. The one deliberate exception is the **drag**
(the drag banners of [js/ui/strip.js](../../../js/ui/strip.js)), which is moving cells between wells rather than storing items, and
owns `p.bag[i]` directly for exactly the length of one gesture.

**The four counting helpers are also where the pouch lives** (`isPouch(type)`): for a `pouch` kind
`bagCount` reads `p.food[type]`, `bagRoom` answers `Infinity`, `bagAdd` always takes it all and
`bagTake` spends it. That one branch is what keeps every caller generic over where a kind actually
sits — the drop pickup, the catch, a food trade at the counter and the bots' food check are
written once and neither know nor care.

**Refusing is a real outcome** for what the *bag* holds, and every path that cannot store
something says so the same way:
`bagDenied()` reddens and shakes the whole backpack frame for 0.6 s with one `SFX.deny()`, and re-firing while
it is already up does nothing, so standing on a drop you cannot carry is one flash and not sixty a
second. A pouch kind can never fire it.

The HUD is in the `UI` › `backpack` banner — see
[the backpack](../rendering/the-hud-corners/the-backpack.md).
