# js/app/gamepad.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| which button is which key, in play and over a menu | `PAD_PLAY`, `PAD_MENU` (the dpad's one exception, an end screen's emote bar: `emotePad`, js/ui/screens.js) | `gamepad` |
| the poll, which pad out of the browser's list (a live one over an idle ghost), the sticks, the aim off the body (and a wedge off a wheel's hub), the pointer over a panel, the walk under the panels that keep the world running, the stick-as-arrows repeat, A as the click or the selection | `padPoll`, `padFind`/`padLive`, `padAim`, `padRepeat`, `padTake`, `padMenuMode`/`padPanelMode`/`padPointerMode` | `gamepad` |
| a pad in hand (the CONTROLS page opens on its tab); an unmapped pad's layout read off its rest values; the live sticks and triggers the readout draws | `padActive`, `pad`, `padCalibrate` (`pad.rest`), `pad.raw` | `gamepad` |
