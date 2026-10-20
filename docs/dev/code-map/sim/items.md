# js/sim/items.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the catalogue: the five parts, the eight finished items built from them, their stats, passives and icons | `BUILD_ITEMS` (`from`, `stats`, `passive`, `icon`), `ITEM_PARTS`/`ITEM_DONE`, `ITEM_STATS` + `ITEM_STAT_ORDER` (the shop's filter order), `ITEM_PASSIVES`, `itemIcon`, `isPart`, `ITEM_METAL`/`itemMetal` (the rim and ink a part or a finished item wears everywhere) | `items` |
| the six slots and what they cost: a finished item minus the parts already held, the room a buy needs, the half an item sells back for | `ITEM_SLOTS` (`p.items`, js/sim/player.js), `itemCost`, `itemRoom`, `ITEM_SELL`, `itemSellValue` | `items` |
| folding the slots into the kit, and the kit rebuilt when they change | `itemMods` (called from `refreshKit`, js/sim/player.js), `itemsChanged` | `items` |
| one buy and one sale (reached through `shopCmd`, js/ui/shop.js) | `buyItem`, `sellItem` | `items` |
| the passives that are not a kit number: KINDLING, CHILL, DEN, and the fight clock DEN waits on | `itemsOnHit` (from `hurtUnit`, js/sim/actions.js), `itemsTick` (from `updatePlayer`, js/sim/sim.js), `ITEM_FIGHT_T`, `KINDLE_EVERY`/`KINDLE_BURN`, `CHILL_T`/`CHILL_MUL`, `p.fightT`/`p.kindleN` | `items` |
| each class's build and what a bot buys next | `BOT_BUILDS`, `botNextItem`, `botItemBuy` (read by `aiSpend`, js/ai/ai.js; the panel opens on `botNextItem` too) | `items` › `bots` |
| a held part no item left on a bot's list is built from, sold at the counter when the slots are full | `botStrayPart` (read by `aiSpend`, js/ai/ai.js) | `items` › `bots` |
