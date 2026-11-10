# Scoreboard and event log

Two readouts of the **match** rather than of the world, in the `scoreboard & log` banner.

**The log is not drawn.** `events` is the last `EVENT_MAX` (12) lines the match wrote, newest
last, and `logEvent(txt, p, o?)` is the one interface every caller speaks — `p` is the player the
line is *about* and supplies its colours (plate `coatD`, edge `mark`, ink `playerTint(p)`), `o`
overrides them for a line nobody owns. No feed draws them: a scrolling column of sentences on
the play surface is what the [UI rule](show-dont-label.md) forbids, and the
bottom-left corner is the tooltip's alone. The ring is the match's record (`DBG.events`), so a
readout — a kill toast, a recap — lands on it for free. What gets logged lives in
[multiplayer.md](../multiplayer.md#kills-and-the-event-log).

**The scoreboard** is held-TAB (`scoreboardOpen()`: `keyHeld('board')`, any mode but `title`, so it
works while dead and while riding the eagle, and never under `DBG.hideUI`) and is drawn per frame, not baked — every number on
it is live. `scoreGroups()` is the ordering: players grouped by team, teams ranked by their total
`scoreOf(p)` and players inside a team by their own, ties broken by team then player id. `scoreOf`
is **the match's gold earned** (`p.earned`, paid by `gainGold`), not the purse — spending gold on
an item is progress — while the GOLD column shows the purse, so a player that has
spent can sit above one showing more gold. It is the centre piece while the key is held, on the HUD's
graphite (`drawHudFrame`): the two sides as two blocks, a stripe in `TEAMS[skin(team)].mark` down each and
the side's wash on its rows. A row is a hero: its face (`drawFace`), level and hero name at 2x in the numbers' white, the person's name under it
(a bot is its hero alone, `boardName`), the six items it carries in wells on their rims (`itemMetal`,
`shopIcon`), then K/D/A (kills, deaths, assists -
[Takedowns](../gameplay/death-and-respawn.md#takedowns-assists-bounties-and-shutdowns)), farm (last hits
on soldiers and camp monsters) and the purse, the three numbers at 2x. Your row is outlined in gold and
names its hero in gold. A dead hero's row dims to 0.55; one waiting to respawn wears its seconds over its
face (the rail chip's), one out for good the `board.out` tag. The head is the match clock
(`clockTxt(state.elapsed)`, the top bar's) and a glyph over the farm and gold columns (`endIcon`, the end
table's); K/D/A is the one word (`board.kda`). Never an objective's health. The panel is `SB_W` wide, its
height follows the row count, and it is centred on `VIEW_W`/`VIEW_H`
every frame — no `relayout()` anchors, so it needs nothing on a resize.
