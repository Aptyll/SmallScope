# js/ui/screens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the rolling four-second replay: the capture ring, its resolution, the full-frame recap on a death and the corner window on pause, the recap's close box and its ESC, the `#replay` overlay | `replayTick`, `rpTarget`, `rpEnsure`, `replayShowing`, `rpFull`, `replayFull`, `replayClose`, `rpRect`, `rpCloseRect`, `rpCloseHit`, `layoutReplay`, `renderReplay`, `RP_*` | `replay` |
| the death overlay and the respawn wait, spectating, back to the lobby, who the camera frames, the planks every ending shares | `DEAD_ITEMS`, `deadItems`, `endScreen`, `viewPlayer`, `specOk`, `specNext`, `toLobby`, `openDefeat`, `drawRespawnLine`, `renderDead`, `deadKey`, `deadClick`, `deadLayout`, `deadReady`, `endSkip`, `drawEndPlanks` | `death & spectate` (`endMatch`/`endSnapshot`: `damage & death`, player.js) |
| the four emotes both end screens hand back to the player, what performs them, and the bar that picks them | `EMOTES` (each with an `up` and a `down` pose picker), `EM_T`, `EM_TURN`, `emo`, `emoteNow`, `emoteAmbient`, `drawEndBody`, `drawSnowPuff` | `emotes` |
| the bar's plates: where they sit, what the pointer is on, what plays one, and its pixels | `EM_PLATE`/`EM_GAP`/`EM_BAR_DY`, `emoteLayout`, `emoteScreen`/`emoteLive`, `emoteHit`, `emotePlay`, `emoteKey`/`emoteClick`, `drawEmoteBar`, `EM_GLYPHS`/`EM_GLYPH_HOT` | `emotes` (the cursor's hand: `cursorInfo`, js/draw/render.js) |
| which key plays which plate | `EM_KEYS` (the digits, read by `deadKey`) | `emotes` |
