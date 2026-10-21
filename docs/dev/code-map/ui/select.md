# js/ui/select.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the champ select's look: its colours and sizes, the splash's and a skin thumbnail's size | `SEL_*`, `SPLASH_W`/`SPLASH_H`, `SKIN_THUMB_W`/`SKIN_THUMB_H`/`SKIN_THUMB_G`/`SKIN_SHOW` | `select look` (the rects: `lobbyLayout`, menu.js `lobby`) |
| a position's 11 px emblem (the map's square with its lane lit, a pine, a shield) | `POS11`, `posIcon` | `positions` (the positions themselves: `POSITIONS`, draft.js) |
| the headline, the timer bar, the seconds, each side's bans in its corner | `selHeadline`, `selClock`, `selActing`, `drawSelectTop` | `top band` |
| a seat row: the portrait disc, the position or PICKING..., the hero, the name; your trade mark; both columns and the seconds pointing at your row | `selDiscMask`, `drawSelDisc`, `selSwapRect`, `drawSelSwap`, `drawSeatRow`, `drawSeats` | `seat rows` |
| your locked hero big: the splash art (or its stand-in), the look's name | `heroSplash`, `selSkinRows`, `selSkinWorn`, `drawSplash` | `splash` |
| the skins under the splash, the chevrons | `selSkinCells`, `drawSkinStrip`, `drawSelChevron` | `skin strip` |
| the four keys at the foot, the mode with the map plate and the target, the confirm plate | `selLoadCells`, `drawLoadout`, `selModeName`, `drawSelMode`, `drawSelPlay` | `loadout` |
