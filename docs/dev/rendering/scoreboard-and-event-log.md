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
a building is progress — while the GOLD column shows the purse, so a player that has
spent can sit above one showing more gold (its LVL column is the visible tell). A team stripe in
`TEAMS[skin(team)].mark` runs down each group, each row carries a faint team wash (stronger for the
local player, which also gets a gold `>`), dead players dim to 0.55 and gain a tag — the respawn
countdown (`3s`), or `OUT` once `p.eliminated`. The columns are LVL, GOLD and K/D/A (kills, deaths,
assists - [Takedowns](../gameplay/death-and-respawn.md#takedowns-assists-bounties-and-shutdowns)). The panel
is `SB_W` (184) wide, its height follows the row count, and it is centred on `VIEW_W`/`VIEW_H`
every frame — no `relayout()` anchors, so it needs nothing on a resize.
