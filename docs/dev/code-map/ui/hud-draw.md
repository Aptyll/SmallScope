# js/ui/hud-draw.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the plate a carried thing's icon sits on, wherever it sits | `cellPlate`, `drawItemIcon` | `the plates, bars and icons the widgets share` |
| the strip's pixels: the portrait (its xp band round the square, the level badge, the xp numbers over it, and the level-up it watches for), the health and stamina bars, the ability wells (and the cooldown-ready flash), the item slots, the meal wells and the purse, the buy plates, the whole strip | `drawPortrait`/`portraitSprite`/`xpFrac`/`abLvSeen`/`PORT_*`, `drawHpBar`/`HP_*`, `drawStBar`, `drawClassAbCell`/`abCdSeen`, `drawItemCell`, `drawFoodCell`, `drawGoldCell`, `drawAbBuyPlate`, `drawHudStrip`, `LOCK_DIM` | `drawing the strip` (their geometry: `hud strip`, js/ui/strip.js) |
| the cooldown sweep: League's radial clock cut to a square, and the ONE shape every wait is drawn in - the four ability wells and both meal buttons (through `drawFoodClock`); rasterised a pixel at a time and coalesced into one fillRect a run, the hand dropped below 12px of cell | `drawSweepCover`/`CD_SWEEP`/`CD_EDGE` | `drawing the strip` |
| the HUD size dials' draws: the 1x bake blitted about the strip's bottom-centre anchor (grown over the open build list: `buildHeadroom`), | `hudScaleCv`, `drawHudScaled`, `HUD_BAKE_HEAD` (the scale and the pointer's map back: `hudSc`/`stripMouse`, js/ui/strip.js) | `drawing the strip` |
