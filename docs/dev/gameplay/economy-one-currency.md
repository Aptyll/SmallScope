# Economy (one currency)

**Gold is not XP.** Gold buys; XP levels, and it comes only from being near when a rival body
dies — a soldier, a scout, a deer, a wolf, a bear — shared by the side standing there
([Hero levels](../multiplayer.md#hero-levels)). Nothing in this section pays XP: the works, the
clock, a pump and a sale are gold alone, so the road is where a scout levels; the lanes' soldiers
and the dens are where it gets rich, and the woods are pocket money.

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
| tree (`TREE_HP` 3, js/sim/world.js) | `treeFall` 0: a plain pine pays nothing (`treeHit` is 0 too) | side income, never the farm — a pine a second chained, and only a gold pine pays; leaves a stump |
| dead tree (3 hp) | `deadTreeFall` 1 | a tree; none stand since 4.82 (the brown bear's ring went with its den) |
| gold pine (25%) | `treeRare` 2 on the fell | the `rare` roll, `treeRare()`: one pine in four, unmarked, so a chain of pines pays about 28 a minute |
| rabbit | `rabbit` 2 coins × 5 → 10 | bolts when approached; jinks one shot per 10 s |
| deer | `deer` 3 coins × 6 → 18 | the big mobile target: two of them, each running its side's line |
| wolf | `wolf` 2 coins × 8 → 16 | a den's four (64), each a FARM ([Farming](robots.md#farming)); neutral until hit, and then the pack bites back |
| black bear | `alpha` 6 coins × 15 → 90 | BLUE's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BLACK BUFF for the whole team |
| brown bear | `dire` 6 coins × 15 → 90 | RED's river camp's one; `EPIC_TEAM_GOLD` (40) to every teammate besides, and the BROWN BUFF for the whole team |
| bird | `bird` 2 coins × 4 → 8 | dormant: nothing spawns one |
| gold pump (`generator`) | `tiers[0].pay` (3) every `period` (10 s) to every hero of the side holding it — 18 a minute each | one of the map's two neutral objectives, taken by standing in its ring ([The gold pumps](buildings.md#the-gold-pumps)); both held is 36 a minute each, a little over twice the trickle |
| a sale at [the counter](the-merchants-counter.md) | half an item's price, or the fixed price for fish and berries | the one payout that does not count as earned (`tradeGold`) — a trade is an exchange, not a source, and the counter buys food at the price it sells it |

The table is sized so that soldiers stay the better farm: a lane's last hits pay 96 a minute at
the start (3 soldiers a wave every 30 s at 16 each) and grow with the wave and the bounty, while
a player chaining pines nonstop earns about 28 a minute (measured headless, 56 fells a minute),
under half of it and a little under twice the trickle. The animals, camps and kills are
where the rest comes from. The kit's `harvestMul` multiplies the fell (the payout rounds); nothing
raises it from 1 while the cards are parked.

**Gold is never a physical drop.** Every source pays the earner on the spot through
`awardGold(p, n, x, y)` (`players` banner, js/sim/player.js, beside `gainGold` — which it wraps,
paying the purse and `p.earned`, the match's gold earned): the plain gold number rises
at the place the action happened (the tree, the kill, the wreck), and the local earner gets the
coin blip. Who earns is always the actor: the swinger of the blow, the final-blow shooter of an
animal or a soldier (its bounty), the breaker of an enemy
building (half its cost, `wreckPay`), the killer of a player and the assists
(gold from nowhere, the victim's own purse untouched — see [Takedowns](death-and-respawn.md#takedowns-assists-bounties-and-shutdowns)). The
one payout to many is a held gold pump: each `pay` tick goes through `gainGold` to every hero on
the holding side, with one +3 over the barrel and a coin cue for each.

Physical drops exist for everything **carried**, which is food: `spawnDrop(x, y, type, n)`
(js/sim/core.js) lays one, `d.n` its count (default 1). A berried bush pays two `berry` drops and
a wrecked [fish net](../world.md#fish-nets) spills `fish` and `sunfish`; a caught fish goes
straight into the pouch (`autoFish`). Gold, berries and fish all read on the **hud strip's right
end** (bottom centre), on screen all match, and death touches none of them (see
[Death and respawn](death-and-respawn.md)). Drops are neutral: after 0.35 s they drift toward the
nearest player inside 28 px, and everyone standing on one contests it (`contest`); the winner
takes the whole drop through `bagAdd`, floating the number in `RES_COLORS[type]`. The pouch has
no ceiling, so a drop is never refused and never left half taken.
