# js/ui/shop-rec.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the RECOMMENDED tab's three cards: which items, and why | `shopPicks` (the build in buying order off `buildsRec`, js/app/builds.js, or `BOT_BUILDS`; what you hold skipped; START and THEN), `shopThreats`/`SHOP_THREATS` (a rival side's healers, walls, burst and attackers, read off what Tab shows; each answered by an item's `counter`, js/sim/items.js, for the styles whose job it is), `SHOP_HEAL_PASSIVES`, `SHOP_ARMOR_HEAVY`, `SHOP_FED`, `shopItemStat`, `shopHeroKind`/`shopItemKind` | `recommended` |
| their geometry and pixels: the cards (name, icon at 3x, price now, the two-word `why` tag, the faces of the rivals it answers) and the START / THEN row | `shopRecLayout` (called by `shopLayout`, shop.js), `drawShopCard`, `shopCardName` (a long name on two lines), `SHOP_CARD_*`, `SHOP_TAG_BG` | `recommended` |
