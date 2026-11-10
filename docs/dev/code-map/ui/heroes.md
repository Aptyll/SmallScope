# js/ui/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the champ select's hero grid: a head per hero with its name under it, the row pitch that tightens on a short view so the last row clears LOCK IN (`heroPitch`), banned / taken / pointed-at cells; the search field over it and what it lets through; the press and the keys' step (both handed to the draft) | `HERO_CELL`/`HERO_GAP`/`HERO_PITCH`/`HERO_FACE`/`HERO_SEARCH_W`, `heroList`, `heroShown`, `heroCols`, `heroCells`, `heroCellAt`, `heroFilterRects`, `heroFilterAt`, `heroSearchKey`, `heroSearchClear` (empty at a new draft and at the turn to picks), `lobbyPick`, `lobbyStep`, `drawHeroFilters`, `drawHeroRow` | `hero grid` (the heroes: `CLASSES`, player.js; where it stands: `lobbyLayout`, menu.js `lobby`) |
