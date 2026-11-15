# js/ui/profile-tabs.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what each tab lists: your matches or a card's, the heroes, the ladder | `pfMatches`, `pfMine`, `pfHeroes`, `pfLadder` | `profile tabs` › `what a tab lists` |
| every row's rect at the scroll, the filter words, an open match's seats, the hits | `pfListLayout`, `profileScrollMax`, `pfModeRects` (`PF_MODE_KEYS`), `pfSeatRects`, `pfKnown`, `profileTabHit` | `profile tabs` › `layout` |
| OVERVIEW: the most played hero large, four numbers | `drawOverview` | `profile tabs` › `OVERVIEW` |
| MATCH HISTORY: the summary, op.gg's row, an open match's scoreboard | `drawHistorySummary`, `drawRowHead`, `drawHistoryRow`, `drawRowBody`, `drawHistoryBoard`, `PF_BOARD_H` | `profile tabs` › `MATCH HISTORY` |
| RANKED's ladder and STATS' most played | `drawLadderRow`, `drawStatsRow`, `drawProfileTab` | `profile tabs` › `RANKED and STATS` |
