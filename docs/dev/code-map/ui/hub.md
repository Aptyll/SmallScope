# js/ui/hub.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the landing page: the title passed through onto it, the hero its HEROES and ITEMS panels show, the build they list | `hubEnter` (from `updateRooms`), `hubHero`/`hubHeroStep`, `hubBuild` (`buildsRec`, js/app/builds.js) | `the hub` |
| every rect on the page: YOU, MATCH HISTORY, the party's strip with the seats and PLAY (the X under it in a party), HEROES, ITEMS, FRIENDS (shorter off Steam), LADDER, the chat line, JOIN | `HUB_*`, `hubLayout` (also `roomLayout`), `hubGoLabel`, `hubRows`, `hubHistRows`, `hubLadRows`, `hubAbWells`, `hubItemWells`, `hubArrows`, `hubQuitRect` (the desktop build's QUIT), `hubPurseRect` | `layout` |
| what the pointer is on, what a panel's click opens (profile, its tabs, the wiki, skins), the wells' cards | `roomHit` (the cursor: render.js), `hubDo` (from `roomDo`), `hubTip` (from `tipAt`, js/ui/tooltip.js) | `the pointer` |
| the pixels | `hubT`, `hubRim`, `hubPanel` (also the FRIENDS panel's plate), `hubWell`, `drawHubCard` (the gear: `drawGear`, menu.js), `drawHubHistory`, `drawHubSeat`, `drawHubPlay`, `drawHubStrip`, `drawHubHero`, `drawHubItems`, `drawHubLadder`, `renderRoom` (from `renderTitle`) | `the pixels` |
