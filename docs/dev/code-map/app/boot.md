# js/app/boot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| boot order, `DBG` | `startGame`, `window.DBG` | `boot` |
| the match between screens: the sim's recorded cosmetics, roles, host and client, the snapshot, its delta and bytes, the two transports | not here: the five [js/net/](../net/events.md) sections above, in load order | - |
| a hidden tab's frames: a worker's clock drives loop() while the page is hidden (stepping, never drawing), rAF when it is not | `hiddenTimer`, `hiddenTick`, `watchHidden` | `the fixed step` |
| the fixed step: the rAF loop banks each frame's time and steps the sim in whole 1/60 s slices (up to three a frame, the rest dropped; a quarter-slice of slack so a 60 Hz screen steps once a frame), polls the pad once a frame before them, renders once after | `TICK_DT`, `TICK_MAX`, `TICK_SLACK`, `tickAcc`, `loop` (`padPoll`, js/app/gamepad.js); the frames drawn in between steps (the camera by its centre and zoom, players, wildlife, robots, birds, shots and loot; render-only): `tween`, `tweenMark`, `tweenIn`, `tweenOut`, `TWEEN_SNAP` | `the fixed step` |
| the FPS cap: a frame under `settings.fpsCap` is skipped whole before the bank is touched, so the sim still steps every slice it is owed; a due clock advanced a period per frame taken holds the average exactly, and resyncs after a stall | `capDue`, `capSkips` | `the fixed step` |
