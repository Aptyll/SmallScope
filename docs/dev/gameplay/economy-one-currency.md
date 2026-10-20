# Economy (one currency)

**Gold is not XP.** Gold buys; XP levels, and it comes only from being near when a rival body
dies — a soldier, a scout, a deer, a wolf, a bear — shared by the side standing there
([Hero levels](../multiplayer.md#hero-levels)). Nothing in this section pays XP: the works, the
clock, a pump and a sale are gold alone, so the road is where a scout levels and the woods are
where it gets rich.

Every player owns a wallet **and** a bag. `p.inv` is `{ gold }` — currency only, no ceiling —
while everything you *carry* lives in `p.bag`, the slot array described in
[Inventory and the backpack](inventory-and-the-backpack.md). (`inv` is an alias for the local
player's wallet.) **Gold is the only currency.** The one other thing the world pays out is
**ore**, which only a mined rock gives up and which is carried in the bag
([Mining a rock](mining-a-rock.md)); berries/fish are consumables ([Food](food-the-meal-is-a-channel.md)), never spent on anything. The whole economy is the
`YIELD` table in the constants banner of [js/sim/core.js](../../../js/sim/core.js) - the one tuning table
with no single owner - which gives every source a different **yield profile**
rather than a different resource (the League model: one number, many ways to earn it):

| Source | Pays | Profile |
| --- | --- | --- |
| the clock | `TRICKLE_GOLD` (1) every `TRICKLE_T` (4 s) — the `passive income` banner, js/sim/sim.js | 15 a minute to every player on the ground, silently (no floater, no blip); the floor under everyone's purse |
| tree (`TREE_HP` 3, js/sim/world.js) | `treeFall` 1 on the fell (`treeHit` is 0 — a swing is work, the fell is the pay) | slow, safe, everywhere — a pine a second chained, so a gold a second is the ceiling of full-time farming; leaves a stump |
| dead tree (3 hp) | `deadTreeFall` 1 | a tree; none stand since 4.82 (the brown bear's ring went with its den) |
| rare tree (8%) | + `treeRare` 3 → 4 | jackpot roll, see `treeRare()` |
| rock | its kind's `gold` (`ROCK_KINDS`, js/sim/mining.js): STONE 3, FROSTGLASS SPIRE 8, SUNSTONE 20 | 2 / 3 / 4 s of standing by it, paid with **ore** besides; it regrows ([Mining a rock](mining-a-rock.md)) |
| rabbit | `rabbit` 2 coins × 5 → 10 | bolts when approached; jinks one shot per 10 s |
| deer | `deer` 3 coins × 6 → 18 | the big mobile target: two of them, each running its side's line |
| wolf | `wolf` 2 coins × 8 → 16 | a den's four (64), each a FARM ([Farming](robots.md#farming)); neutral until hit, and then the pack bites back |
| black bear | `alpha` 6 coins × 15 → 90 | BLUE's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BLACK BUFF for the whole team |
| brown bear | `dire` 6 coins × 15 → 90 | RED's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BROWN BUFF for the whole team |
| bird | `bird` 2 coins × 4 → 8 | dormant: nothing spawns one |
| gold pump (`generator`) | `tiers[tier].pay` every `period` s: 2 / 4 / 7 every 10 s — 12 / 24 / 42 a minute, so the first pays back in 5 min and each upgrade in 6.7 and 7.8 | passive income, deposited to its owner; a 4x2 building, and each one its owner already has makes the next cost 2.5x (`ramp`, `buildCost`: 60, 150, 375), so the second pays back in 12.5 min and the next tier is the better buy |
| chest | `CHEST_GOLD_MIN`–`MAX` (8–20) + a card + a free item part | ~14 caches along the treeline, one free E press — the world's one source of cards, and a part for nothing (`chestPart`, [the items](the-merchants-counter.md#the-items)) |
| a sale at [the counter](the-merchants-counter.md) | half a made thing's or an item's price, or the fixed price for fish and berries | the one payout that does not count as earned (`tradeGold`) — a trade is an exchange, not a source, and the counter buys food at the price it sells it |

The table is sized so that a
player chaining pines nonstop earns about a gold a second, the trickle is a quarter of that,
and the animals, chests, kills and rocks are where the rest comes from. PACKMULE and the
FORAGER card multiply the fell (`harvestMul`, +25% a level and +50%; the payout rounds).

**Gold is never a physical drop.** Every source pays the earner on the spot through
`awardGold(p, n, x, y)` (`players` banner, js/sim/player.js, beside `gainGold` — which it wraps,
paying the purse and `p.earned`, the match's gold earned): the plain gold number rises
at the place the action happened (the tree, the kill, the wreck), and the local earner gets the
coin blip. Who earns is always the actor: the swinger of the blow, the final-blow shooter of an
animal or a loaded worker bot (its `b.carry` goes to whoever downed it), the breaker of an enemy
building (the 50% wreck refund, same as a demolishing owner's), the killer of a player and the assists
(gold from nowhere, the victim's own purse untouched — see [Takedowns](death-and-respawn.md#takedowns-assists-bounties-and-shutdowns)), and a
gold pump's **owner**, into whose wallet each `pay` tick deposits directly. Robots carry a
single gold number (`b.carry`) and deposit at 8+ into their owner's wallet.

**Treasure chests** are the free-money exception to earning it: `placeChests()`
([world.md](../world.md#treasure-chests)) swaps ~14 inner-edge border trees for chests, and one E
press (`OPEN`, no tool gate) springs one — `CHEST_GOLD_MIN`–`CHEST_GOLD_MAX` gold straight to
the purse plus one unopened card drop rolled from `CHEST_ODDS` (rarity odds beside the other
chest constants in js/sim/world.js), and a free item part (`chestPart`, [the items](the-merchants-counter.md#the-items)).
The chest's tile opens with it.

Physical drops exist for everything **carried**: `spawnDrop(x, y, type, n)` takes the
value of the drop (`d.n`, default 1) and the pickup adds what fits through `bagAdd`, floating
that number in `RES_COLORS[type]`. It **returns the drop** it made, which is what lets a
deliberate throw give it a heading and a lock on top (`flingDrop`/`lockDrop`, js/sim/core.js). **Whatever was taken comes off `d.n`, and the drop is only
removed when `d.n` hits zero** — that is what lets a stack of 5 ore half-fill a bag and
leave 3 lying in the snow. A drop's `type` is always an `ITEMS` key: sources pay `berry` and
the card rarities, a caught fish goes straight into the pouch (taken by `autoFish`, or handed over by a
[fish net](../world.md#fish-nets) you are standing on), and a wrecked net's
contents carry `fish` and `sunfish` too (each drawn with its own `ITEMS` icon). Gold, berries and fish all read on
the **hud strip's right end** (bottom centre) — the berry and fish wells with the gold under
them, on screen all match. Death touches none of them —
see [Death and respawn](death-and-respawn.md). Drops are neutral: they drift
toward the nearest player, and everyone standing on one contests it
(`canAfford`/`pay` also take the player whose wallet is meant) — except that a player with **no
room** for a drop is neither magnetised by it nor a claimant, so a full bag hands the pickup to
whoever else is standing there instead of sitting on it, and standing alone on something you
cannot carry fires the [refusal tell](inventory-and-the-backpack.md) rather than eating it. Food is
outside all of that: the pouch has no ceiling, so a berry is never left in the snow.

Two things bend "no room" and "everyone standing on one". A drop inside its
[throw lock](the-basic-attack.md#the-item-slots-and-the-drag) is neither magnetised by nor claimable by **the one player who
threw it** — and raises no refusal for them either, since standing on something you meant to put
down is not a denial; it draws at half alpha for that player alone, and comes back to life when the three seconds are
up.
