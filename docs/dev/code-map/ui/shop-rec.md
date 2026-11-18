# js/ui/shop-rec.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the RECOMMENDED tab's three cards: which items, and why | `shopPicks` (the build in buying order off `buildsRec`, js/app/builds.js, or `BOT_BUILDS`; what you hold skipped; the opening three on an empty bag, `shopOpening`), `shopThreats`/`SHOP_THREATS` (a rival side's healers, walls, burst and attackers, read off what Tab shows; each answered by an item's `counter`, js/sim/items.js, for the styles whose job it is), `SHOP_HEAL_PASSIVES`, `SHOP_ARMOR_HEAVY`, `SHOP_FED`, `shopItemStat`, `shopHeroKind`/`shopItemKind` | `recommended` |
| their geometry and pixels: the cards (name, icon at 4x, 3x or 2x, price now, the two-word `why` tag, `shopWhy`, the faces of the rivals it answers), standing in the room's middle | `shopRecLayout` (called by `shopLayout`, shop.js), `drawShopCard`, `shopCardName` (a long name on two lines), `SHOP_CARD_*`, `SHOP_TAG_BG` | `recommended` |
