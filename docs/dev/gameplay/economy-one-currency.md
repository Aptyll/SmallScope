# Economy (one currency)

**Gold is not XP.** Gold buys; XP levels, and it comes only from being near when a rival body
dies — a soldier, a scout, a deer, a wolf, a bear — shared by the side standing there
([Hero levels](../multiplayer.md#hero-levels)). Nothing in this section pays XP: the works, the
clock, a pump and a sale are gold alone, so the road is where a scout levels; the lanes' soldiers
and the dens are where it gets rich, and the woods are pocket money.

Every player owns a wallet. `p.inv` is `{ gold }` — currency only, no ceiling — and the six
item slots beside it are the build. (`inv` is an alias for the local player's wallet.) **Gold is
the only currency**; the heals in the world (creek fish, berry bushes) are taken where they stand
and never carried ([Heals](heals.md)). The whole economy is the
`YIELD` table in the constants banner of [js/sim/core.js](../../../js/sim/core.js) - the one tuning table
with no single owner - which gives every source a different **yield profile**
rather than a different resource (the League model: one number, many ways to earn it):

| Source | Pays | Profile |
| --- | --- | --- |
| the start | `START_GOLD` (500, js/sim/player.js), in the wallet from the landing | League's start: a first part and a potion; never `earned` |
| the clock | `TRICKLE_GOLD` (8) every `TRICKLE_T` (4 s) — the `passive income` banner, js/sim/sim.js | 120 a minute to every player on the ground, silently (no floater, no blip); the floor under everyone's purse |
| tree (`TREE_HP` 3, js/sim/world.js) | `treeFall` 0: a plain pine pays nothing (`treeHit` is 0 too) | side income, never the farm — a pine a second chained, and only a gold pine pays; leaves a stump |
| dead tree (3 hp) | `deadTreeFall` 10 | a tree; none stand since 4.82 (the brown bear's ring went with its den) |
| gold pine (25%) | `treeRare` 20 on the fell | the `rare` roll, `treeRare()`: one pine in four, unmarked, so a chain of pines pays about 280 a minute |
| rabbit | `rabbit` 2 coins × 50 → 100 | bolts when approached; jinks one shot per 10 s |
| deer | `deer` 3 coins × 60 → 180 | the big mobile target: two of them, each running its side's line |
| wolf | `wolf` 2 coins × 80 → 160 | a den's four (640), each a FARM ([Farming](robots.md#farming)); neutral until hit, and then the pack bites back |
| black bear | `alpha` 6 coins × 150 → 900 | BLUE's river camp's one; `EPIC_TEAM_GOLD` (400) to every teammate besides, and the BLACK BUFF for the whole team |
| brown bear | `dire` 6 coins × 150 → 900 | RED's river camp's one; `EPIC_TEAM_GOLD` (400) to every teammate besides, and the BROWN BUFF for the whole team |
| bird | `bird` 2 coins × 40 → 80 | dormant: nothing spawns one |
| gold pump (`generator`) | `tiers[0].pay` (30) every `period` (10 s) to every hero of the side holding it — 180 a minute each | one of the map's two neutral objectives, taken by standing in its ring ([The gold pumps](buildings.md#the-gold-pumps)); both held is 360 a minute each, three times the trickle |
| a sale at [the counter](the-merchants-counter.md) | half an item's price (a potion one at a time) | the one payout that does not count as earned (`tradeGold`) — a trade is an exchange, not a source |

The scale is League's: a finished item costs about 2600-3400 ([the items](the-merchants-counter.md#the-items)),
and a laner who lands about two in three last hits holds one at about 4:05 (measured headless off
the real waves, which roll out at 1:00 and first meet in a lane's middle at about 1:20: every last
hit about 3:15, two in three about 4:05, two in five about 5:05). Soldiers stay the
better farm: a lane's last hits pay 960 a minute at the start (3 soldiers a wave every 30 s at
160 each) and grow with the wave and the bounty, while a player chaining pines nonstop earns about
280 a minute (56 fells a minute), under a third of it and a little over twice the trickle. The
animals, camps, pumps and kills are where the rest comes from; a takedown is three soldiers' worth
(480), so a kill lead is gold lead. The kit's `harvestMul` multiplies the fell (the payout
rounds); nothing raises it from 1 while the cards are parked.

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

Nothing lies on the ground to be picked up: every payout lands in the wallet on the spot, and
the only things a player carries are gold and the six item slots. Gold reads on the **hud strip's
right end** (bottom centre), on screen all match, and death touches none of it (see
[Death and respawn](death-and-respawn.md)).
