# The HUD corners

`renderUI()` owns three corners, the top edge and one strip, and every one of them is positioned off
`VIEW_W`/`VIEW_H` (never a literal), so a resize needs nothing from them. **The top left is
the weapon**: the one tool in hand and the bits loaded into it, with the inventory drawer
shut under it — the corner a Noita wand or a Terraria held item lives in — while every number
you own (berries, fish, gold, cards) is on the **hud strip's right end**. The bottom right is
empty world.

| Where | What | Function |
| --- | --- | --- |
| top left | the **weapon shelf**: the class weapon in its big well and the six item slots beside it, always up — and under the weapon well the small tab of the **inventory drawer**, shut until B or the tab | `drawShelf`, `drawBag` |
| top right, under the disc | the **notice lane**: the roost warning and the **stat sheet** that flies in when a number on yours moves | `renderNotices` |
| top right | the minimap and its day/night ring — the black outline sits `MM_GAP` (4 px) off the top edge and the right edge alike (`applyMinimapSize`, core.js) — the clock centred under it while no team rail is up (`mmClockShown`), and the notice plates under that | `renderMinimap`, `renderNotices` |
| top centre | the **team rail**: one thin plate, every other player in the match as a 12px emblem over a hp bar in the side's colour, your teammates left (never you: your own hp is the strip's) and the rival right, the match clock over the two kill totals between them — and under it, the camp plate, the DAY headline and the spectate control (`headlineY`) | `drawRailScaled` |
| beside the pointer, or bottom left | the hover tooltip, wherever the TOOLTIP row puts it | `tipPos`, `drawTooltip` |
| bottom centre | the hud strip, flush to the bottom: the stat panel, your portrait (xp round its edge, the level on its corner), the four ability wells over the health and stamina bars, the two meal wells over the gold | `drawHudStrip` |
| centre, on G | the character panel: the live body, the stat ledger, the six item slots | `drawCharPanel` |

Every widget slides **its own size** away for the landing intro — the minimap up by
`MM_R * 2 + 40`, the rail up by `RAIL_SLIDE`, the strip down by
`HUD_SLIDE` (`AB_H` + `XP_TAG` + 5), the top-left corner left by `CORNER_REACH` (the shelf's
fixed plate or the drawer, whichever is wider).

## Parts

- [Notices: the plates under the minimap](the-hud-corners/notices-the-plates-under-the-minimap.md) (6 KB)
- [The stat ledger: your sheet, as a notice](the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md) (4 KB)
- [The hover tooltip](the-hud-corners/the-hover-tooltip.md) (4 KB)
- [The patch notes screen](the-hud-corners/the-patch-notes-screen.md) (2 KB)
- [The wiki screen](the-hud-corners/the-wiki-screen.md) (4 KB)
- [The hud strip](the-hud-corners/the-hud-strip.md) (10 KB)
- [The team rail](the-hud-corners/the-team-rail.md) (3 KB)
- [The hud frame](the-hud-corners/the-hud-frame.md) (5 KB)
- [The weapon shelf](the-hud-corners/the-weapon-shelf.md) (2 KB)
- [The backpack](the-hud-corners/the-backpack.md) (4 KB)
- [The character panel (G)](the-hud-corners/the-character-panel-g.md) (1 KB)
