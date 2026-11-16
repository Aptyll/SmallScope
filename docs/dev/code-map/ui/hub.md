# js/ui/hub.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the landing page: the title passed through onto it, the hero its HEROES and ITEMS panels show, the build they list | `hubEnter` (from `updateRooms`), `hubHero`/`hubHeroStep`, `hubBuild` (`buildsRec`, js/app/builds.js) | `the hub` |
| every rect on the page: YOU, MATCH HISTORY, PARTY (its head with the count and the code, the seats and PLAY, the foot row: JOIN alone, the chat and the X in a party; `L.chat` the chat risen over the seats while a line is typed), HEROES, ITEMS, FRIENDS (empty off Steam), LADDER | `HUB_*`, `hubTalking`, `hubLayout` (also `roomLayout`), `hubGoLabel`, `hubCodeRect`, `hubRows`, `hubHistRows`, `hubLadRows`, `hubAbWells`, `hubItemWells`, `hubArrows`, `hubQuitRect` (the desktop build's QUIT), `hubPurseRect` | `layout` |
| what the pointer is on, what a panel's click opens (profile, its tabs, the wiki, skins), the wells' cards | `roomHit` (the cursor: render.js), `hubDo` (from `roomDo`), `hubTip` (from `tipAt`, js/ui/tooltip.js) | `the pointer` |
| the pixels | `hubT`, `hubRim`, `hubPanel` (also the FRIENDS panel's plate), `hubWell`, `drawHubCard` (the gear: `drawGear`, menu.js), `drawHubHistory`, `drawHubSeat`, `drawHubPlay`, `hubPlate` (the foot row's one shape), `drawHubTalk`, `drawHubChat` (the risen chat), `drawHubJoin`, `drawHubStrip`, `drawHubHero`, `drawHubItems`, `drawHubLadder`, `renderRoom` (from `renderTitle`) | `the pixels` |
