# js/ui/tooltip.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what the pointer is on, said in words | `tipAt`, `tipResolve`, `tipNow`, `tipSize`, `drawTooltip`, `TIP_*` | `tooltips` (resolved once per frame in `renderScreen`, js/draw/passes.js) |
| where that panel sits — beside the pointer, or parked bottom left | `tipPos`, `TIP_GAP`, `TIP_EDGE` (the row that picks: `settings.tipFollow`, `SET_TABS` js/ui/panels.js) | `tooltips` |
| the per-kind descriptions that panel is built from | `tipBase`, `tipAttack` (the hero's basic attack), `tipStack`, `tipCell`, `tipGold`, `tipTunnel`, `tipClassAb` (its per-rank rows: `AB_RANK_STAT`, `tipRanks`, `tipNum`, `tipCent`, `tipValW`), `tipRail`, `tipSec` | `tooltips` (the shop's own: `tipShop`/`tipItem`, js/ui/shop.js, which also answers a shelf item slot and a wiki ITEMS row) |
