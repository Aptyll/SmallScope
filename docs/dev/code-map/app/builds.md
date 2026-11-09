# js/app/builds.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a match's builds filed at the whistle (every human seat's hero, finished items in order, result), and the match id every screen of it agrees on | `buildsNote` (from `endMatch`, js/sim/player.js), `buildsHash`, `buildsKey`, `p.buys` (pushed by `buyItem`, js/sim/items.js) | `builds` |
| records in from storage or a peer, checked and kept once; what a join sends | `buildsClean` (possible records only: `BUILDS_T_MAX`, `BUILDS_GOLD`/`BUILDS_GOLD_MIN`), `buildsMerge` (`BUILDS_TAKE` new from one join), `buildsPack`, `BUILDS_KEEP`/`BUILDS_SEND` (the store: `PROFILE.builds`/`putBuilds`, js/app/profile.js; the swap: `netMetaIn` and the `meta` message, js/net/net.js) | `builds` |
| one hero's numbers, and the RECOMMENDED tab's rows off them (the curated `BOT_BUILDS` below `BUILDS_MIN` games) | `buildsStats`, `buildsRec`, `buildsItem` (the tooltip's PICK RATE / WIN RATE), `buildsRate`, `buildsPct`, `BUILDS_HERO`/`BUILDS_MIN`/`BUILDS_PATH_MIN` | `builds` |

How it works and what it trusts: [recommended builds](../../gameplay/the-merchants-counter.md#recommended-builds).
