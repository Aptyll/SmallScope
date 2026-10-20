# js/ui/recap.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the plate's sizes, how many lines it holds, each kind of blow's colour and word, the world's names, and the view (ring alone, lines, opened out) | `RC_X`/`RC_Y`/`RC_W`/`RC_W_OPEN`/`RC_HEAD`/`RC_RING`/`RC_ROW`/`RC_FACE`/`RC_ICON`/`RC_ICONS`/`RC_BAR`/`RC_ROWS`, `RC_KIND`, `RC_WORLD`/`RC_MOVE`, `recap`, `rcKind` | `death recap` |
| the record grouped into lines (one per face and per what it hit with, biggest first), the split by kind, and the killing blow's line | `recapRead` (the record: `recapNote`, js/sim/player.js) | `death recap` |
| a line's face and icon: the hitter's portrait, the world's figure by cause, `?` for a rival nobody saw; the key's strip icon, the weapon, the fire | `rcWorldFig`, `rcFace`, `rcWho`/`rcWhat` (the pointer's words) (`portraitSprite`, js/ui/hud-draw.js; `towerFigure`, js/draw/towers.js), `rcIcon` (`classAbIcon`, js/sim/abilities.js) | `death recap` |
| the ring, baked per split | `rcRing` | `death recap` |
| where everything sits, the pointer on it, the fold buttons and the drawing | `recapLayout`, `recapHover`, `recapHot` (the cursor, render.js), `recapClick` (from `deadClick`, js/ui/screens.js), `rcButton`, `rcTag`, `drawRecap` (its one caller: `renderReplay`, js/ui/screens.js) | `death recap` |
