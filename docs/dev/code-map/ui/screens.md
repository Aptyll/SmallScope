# js/ui/screens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the rolling four-second replay: the capture ring, its resolution, the full frame off the defeat's REPLAY and the corner window on pause (a death plays none), the full frame's close box and its ESC, the `#replay` overlay | `replayTick`, `rpTarget`, `rpEnsure`, `replayShowing`, `rpFull`, `replayFull`, `replayClose`, `rpRect`, `rpCloseRect`, `rpCloseHit`, `layoutReplay`, `renderReplay`, `RP_*` | `replay` |
| the death overlay and the respawn wait (the live match, greyed: `DEATH_GREY_IN`/`DEATH_GREY`, `drawDeathGrey`, called from `renderScreen`, js/draw/passes.js), spectating (a ring of your fall and each living ally), back to the lobby, who the camera frames, the LOBBY word every ending shares | `DEAD_ITEMS`, `deadItems`, `endScreen`, `viewPlayer`, `specOk`, `specNext`, `toLobby`, `LOST_BEAT`, `lostBeat`, `openDefeat`, `drawRespawnLine`, `renderDead`, `deadKey`, `deadClick`, `deadLayout`, `deadReady`, `endSkip`, `drawEndPlanks` | `death & spectate` (`endMatch`/`endSnapshot`: `damage & death`, player.js) |
