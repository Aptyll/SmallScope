# js/ui/screens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the rolling four-second replay: the capture ring, its resolution, the full-frame recap on a death and the corner window on pause, the recap's close box and its ESC, the `#replay` overlay | `replayTick`, `rpTarget`, `rpEnsure`, `replayShowing`, `rpFull`, `replayFull`, `replayClose`, `rpRect`, `rpCloseRect`, `rpCloseHit`, `layoutReplay`, `renderReplay`, `RP_*` | `replay` |
| the death overlay and the respawn wait, spectating, back to the lobby, who the camera frames, the LOBBY word every ending shares | `DEAD_ITEMS`, `deadItems`, `endScreen`, `viewPlayer`, `specOk`, `specNext`, `toLobby`, `openDefeat`, `drawRespawnLine`, `renderDead`, `deadKey`, `deadClick`, `deadLayout`, `deadReady`, `endSkip`, `drawEndPlanks` | `death & spectate` (`endMatch`/`endSnapshot`: `damage & death`, player.js) |
