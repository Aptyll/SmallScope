# js/app/audio.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the songs, the sampled one-shots, the dials behind them | `SFX.music`, `TRACKS`, `SAMPLES`, `smp`, `trim`, `loudness`, `level`, `setAmbience` | its own IIFE — see [gameplay.md](../../gameplay/audio.md) |
| BORROWING the music layer and giving it back where it was taken (the trading post's song) | `musicHold`, `musicRelease`, `held`, exposed as `SFX.music.hold`/`release`/`held` | `music` (its one caller: `openShop`/`closeShop`, js/ui/shop.js) |
| the counter's money ding, a finished item landing in a slot (a part plays the coin) | `SFX.buy`, the `buy` row of `SAMPLES` | its own IIFE (its caller: `buyItem`, js/sim/items.js, through `sfxFor`) |
| the notification layer — nothing in the world making a noise, and none of it jittered | `SFX.countTick`, `SFX.ui(open)`, `SFX.notch`, `SFX.turn`, `SFX.wheelUp`, `SFX.record`, `SFX.runUp(n)`/`SFX.runBroke`, `SFX.alarm`, `SFX.marked`/`SFX.dazed`, `SFX.stat(up)` (a number on your own sheet moved), `SFX.nightFall`, `SFX.warp`, `SFX.spectate`, `SFX.defeat`, `SFX.bigHurt`, `SFX.botOut` | its own IIFE — the `count`…`botOut` rows of `SAMPLES` (who calls each: [gameplay.md](../../gameplay/audio.md); `SFX.alarm`'s spacing `EAGLE_WARN_GAP`: js/sim/eagle.js) |
