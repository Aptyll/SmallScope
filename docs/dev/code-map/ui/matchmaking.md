# js/ui/matchmaking.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a party looking for another: the list read, the lowest code hosting, the clock, a second press stopping it | `MATCH_WAIT`/`MATCH_HOLD`, `seekKey`, `seekRivals`, `seekStart`, `seekCancel`, `updateSeek` (from `updateRooms`), `seekGo`, `seekClock`, `seekText`, `NET.seek`/`NET.seekAt` (js/net/net.js) | `matchmaking` |
| crossing over: the guests told, the reload with the party's code in the hello, the host seating one party on its rival side | `seekCross`, `crossHeard` (the `cross` message), `crossUrl`, `CROSS`, `crossAdmit` and `crossedIn` (from `netHostHello`), `MATCH_GATHER`, `MATCH_JOIN` | `matchmaking` |
| going home: the crossed party back to its own code after the match, a refusal or a lost host | `HOME_KEY`, `homeParty`, `homeSave`, `homeSeed`, `crossHomeUrl` (read by `rematchUrl`), `crossHome`, `partyLost` (from `updateTitle`, menu.js) | `matchmaking` |
