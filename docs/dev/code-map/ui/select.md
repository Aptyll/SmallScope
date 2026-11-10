# js/ui/select.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the champ select's look: its colours and sizes, the showcase's room and a skin thumbnail's size | `SEL_*`, `SHOW_W`/`SHOW_H`, `SKIN_THUMB_W`/`SKIN_THUMB_H`/`SKIN_THUMB_G`/`SKIN_SHOW` | `select look` (the rects: `lobbyLayout`, menu.js `lobby`) |
| a position's 11 px emblem (the map's square with its lane lit, a pine, a shield) | `POS11`, `posIcon` | `positions` (the positions themselves: `POSITIONS`, player.js) |
| the headline, the timer bar, the seconds, each side's bans in its corner | `selHeadline`, `selClock`, `selActing`, `drawSelectTop` | `top band` |
| a seat row: the portrait disc, the position or PICKING..., the hero, the name; your trade mark; both columns and the seconds pointing at your row | `selDiscMask`, `drawSelDisc`, `selSwapRect`, `drawSelSwap`, `drawSeatRow`, `drawSeats` | `seat rows` |
| your locked hero big: its in-game model on the stage light, turning and striding, the look's name | `SHOW_SCALE`, `SHOW_FOOT`, `SHOW_BEATS`, `SHOW_STRIDE`, `showBody`, `showScale`, `showBeat`, `selSkinRows`, `selSkinWorn`, `drawShowcase` (the model: `drawPlayer` with `stage`, js/draw/bodies.js; the light: `drawStageLight`, menu.js) | `showcase` |
| the pick's brief under the grid: the pointed (or hovered) hero's name, title and four ability icons, each raising its card over the row of wells (the tooltip's `over`; with 20 heroes the grid's last row leaves that ground empty, a full last row would put faces under the card), where the stage has no room; it steps aside while a loadout picker is open | `BRIEF_WELL`/`BRIEF_GAP`/`BRIEF_SPLIT`, `selBriefHero`, `selBrief`, `selBriefHit`, `drawSelBrief` | `the brief` (the card: `tipClassAb`, tooltip.js) |
| the book on the showcase and the hero's story laid over it | `SEL_BOOK`, `SEL_BOOK_ALPHA`, `SEL_STORY_PAD`/`SEL_STORY_PITCH`, `selBookRect`, `selStoryLines`, `selLoreOn`, `drawSelLore` | `lore book` (the story: `CLASSES` `story`, player.js; the press: `lobbyHit`/`lobbyClick` 'book', menu.js) |
| the skins under the showcase, the chevrons | `selSkinCells`, `drawSkinStrip`, `drawSelChevron` | `skin strip` |
| the match's size and mode bottom right, the confirm plate | `selModeName`, `drawSelMode`, `drawSelPlay` | `foot` |
