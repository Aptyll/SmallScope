# Economy (one currency)

**Gold is not XP.** Gold buys; XP levels, and it comes only from being near when a rival body
dies — a soldier, a scout, a deer, a wolf, a bear — shared by the side standing there
([Hero levels](../multiplayer.md#hero-levels)). Nothing in this section pays XP: the works, the
clock, a pump and a sale are gold alone, so the road is where a scout levels and the woods are
where it gets rich.

Every player owns a wallet **and** a pouch. `p.inv` is `{ gold }` — currency only, no ceiling —
while the food you carry lives in `p.food` ([The pouch](the-pouch.md)). (`inv` is an alias for
the local player's wallet.) **Gold is the only currency**; berries and fish are consumables
([Food](food-the-meal-is-a-channel.md)), never spent on anything. The whole economy is the
`YIELD` table in the constants banner of [js/sim/core.js](../../../js/sim/core.js) - the one tuning table
with no single owner - which gives every source a different **yield profile**
rather than a different resource (the League model: one number, many ways to earn it):

| Source | Pays | Profile |
| --- | --- | --- |
| the clock | `TRICKLE_GOLD` (1) every `TRICKLE_T` (4 s) — the `passive income` banner, js/sim/sim.js | 15 a minute to every player on the ground, silently (no floater, no blip); the floor under everyone's purse |
| tree (`TREE_HP` 3, js/sim/world.js) | `treeFall` 1 on the fell (`treeHit` is 0 — a swing is work, the fell is the pay) | slow, safe, everywhere — a pine a second chained, so a gold a second is the ceiling of full-time farming; leaves a stump |
| dead tree (3 hp) | `deadTreeFall` 1 | a tree; none stand since 4.82 (the brown bear's ring went with its den) |
| rare tree (8%) | + `treeRare` 3 → 4 | jackpot roll, see `treeRare()` |
| rabbit | `rabbit` 2 coins × 5 → 10 | bolts when approached; jinks one shot per 10 s |
| deer | `deer` 3 coins × 6 → 18 | the big mobile target: two of them, each running its side's line |
| wolf | `wolf` 2 coins × 8 → 16 | a den's four (64), each a FARM ([Farming](robots.md#farming)); neutral until hit, and then the pack bites back |
| black bear | `alpha` 6 coins × 15 → 90 | BLUE's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BLACK BUFF for the whole team |
| brown bear | `dire` 6 coins × 15 → 90 | RED's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BROWN BUFF for the whole team |
| bird | `bird` 2 coins × 4 → 8 | dormant: nothing spawns one |
| gold pump (`generator`) | `tiers[tier].pay` every `period` s: 2 / 4 / 7 every 10 s — 12 / 24 / 42 a minute, so the first pays back in 5 min and each upgrade in 6.7 and 7.8 | passive income, deposited to its owner; a 4x2 building, and each one its owner already has makes the next cost 2.5x (`ramp`, `buildCost`: 60, 150, 375), so the second pays back in 12.5 min and the next tier is the better buy |
| a sale at [the counter](the-merchants-counter.md) | half an item's price, or the fixed price for fish and berries | the one payout that does not count as earned (`tradeGold`) — a trade is an exchange, not a source, and the counter buys food at the price it sells it |

The table is sized so that a
player chaining pines nonstop earns about a gold a second, the trickle is a quarter of that,
and the animals, camps, kills and pumps are where the rest comes from. The kit's `harvestMul`
multiplies the fell (the payout rounds); nothing raises it from 1 while the cards are parked.

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

Physical drops exist for everything **carried**, which is food: `spawnDrop(x, y, type, n)`
(js/sim/core.js) lays one, `d.n` its count (default 1). A berried bush pays two `berry` drops and
a wrecked [fish net](../world.md#fish-nets) spills `fish` and `sunfish`; a caught fish goes
straight into the pouch (`autoFish`). Gold, berries and fish all read on the **hud strip's right
end** (bottom centre), on screen all match, and death touches none of them (see
[Death and respawn](death-and-respawn.md)). Drops are neutral: after 0.35 s they drift toward the
nearest player inside 28 px, and everyone standing on one contests it (`contest`); the winner
takes the whole drop through `bagAdd`, floating the number in `RES_COLORS[type]`. The pouch has
no ceiling, so a drop is never refused and never left half taken.
