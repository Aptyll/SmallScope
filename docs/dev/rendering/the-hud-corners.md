# The HUD corners

`renderUI()` owns three corners, the top edge and one strip, and every one of them is positioned off
`VIEW_W`/`VIEW_H` (never a literal), so a resize needs nothing from them. **The bottom bar is
the HUD's one bar**: the hud strip carries the abilities, the six item slots and the
gold. The top left is empty (the practice bar hangs there in PRACTICE TOOL), and so is the
bottom right.

| Where | What | Function |
| --- | --- | --- |
| top right, under the disc | the **notice lane**: the roost warning and the **stat sheet** that flies in when a number on yours moves — and under the plates, the **kill feed** | `renderNotices`, `renderAnnouncer` |
| top right | the minimap and its day/night ring — the black outline sits `MM_GAP` (4 px) off the top edge and the right edge alike (`applyMinimapSize`, core.js) — the clock centred under it while no team rail is up (`mmClockShown`), and the notice plates under that | `renderMinimap`, `renderNotices` |
| top centre | the **team rail**: one thin plate, every player in the match as a hero face over a hp bar in the side's colour, your side left (you first) and the rival right, five a side, the match clock over the two kill totals between them — and under it, the spectate control, the surrender vote and the **announcer's plate** (`headlineY`, `noteY`) | `drawRailScaled` |
| beside the pointer, or bottom left | the hover tooltip, wherever the TOOLTIP row puts it | `tipPos`, `drawTooltip` |
| bottom centre | the hud strip, flush to the bottom: the stat panel, your portrait (xp round its edge, the level on its corner), the four ability wells over the health and stamina bars, the six item slots, the purse | `drawHudStrip` |
| centre, on G | the character panel: the live body, the stat ledger, the six item slots | `drawCharPanel` |

Every widget slides **its own size** away for the landing intro — the minimap up by
`MM_R * 2 + 40`, the rail up by `RAIL_SLIDE`, the strip down by
`HUD_SLIDE` (`AB_H` + `XP_TAG` + 5).

## Parts

- [Notices: the plates under the minimap](the-hud-corners/notices-the-plates-under-the-minimap.md) (6 KB)
- [The announcer and the kill feed](the-hud-corners/the-announcer.md) (2 KB)
- [The stat ledger: your sheet, as a notice](the-hud-corners/the-stat-ledger-your-sheet-as-a-notice.md) (4 KB)
- [The hover tooltip](the-hud-corners/the-hover-tooltip.md) (3 KB)
- [The patch notes screen](the-hud-corners/the-patch-notes-screen.md) (2 KB)
- [The wiki screen](the-hud-corners/the-wiki-screen.md) (4 KB)
- [The hud strip](the-hud-corners/the-hud-strip.md) (11 KB)
- [The team rail](the-hud-corners/the-team-rail.md) (3 KB)
- [The hud frame](the-hud-corners/the-hud-frame.md) (4 KB)
- [The character panel (G)](the-hud-corners/the-character-panel-g.md) (1 KB)
