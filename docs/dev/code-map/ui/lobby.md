# js/ui/lobby.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the gold and damage samples (drawn by nothing on the lobby since the bar chart; the bot lab reads the last gold): the pitch, the cap, the halving that bounds a series of any length, and the sampler itself | `STAT_STEP`, `STAT_MAX`, `statT`, `statHalve`, `sampleStats` (its one caller: `updatePlay`, sim.js; the arrays it fills: `p.hGold`/`p.hDmg`, the `Player` constructor, js/sim/player.js) | `the samples` |
| the match's record, frozen at the whistle | `matchStats`, `statFreeze` (its one caller: `endMatch`, js/sim/player.js) | `the record` |
| the folding stat groups and their rows, the column geometry, the K/M/B cut, this screen's own state, and the accent each ending is struck in | `SCORE_GROUPS`, `SCORE_LABEL_W`/`SCORE_COL_W`/`SCORE_TEAM_GAP`/`SCORE_FACE`/`SCORE_NAME`/`SCORE_LIST_W`/`SCORE_LIST_ROW`/`SCORE_ROW`/`SCORE_HEAD`, `SCORE_STATS`, `scoreFmt`, `scoreName`, `scoreVal`, `scores`, `SCORE_WORDS`, `SCORE_IN`, `scoreAccent`, `scoreHead` | `the groups` |
| the composition: the columns in reading order, the narrowing on a small view, the scrolled window and its lines | `scoreCols`, `scoresLayout`, `scoreLines`, `scoresScrollBy` (the wheel: input.js) | `the layout` |
| the way in off either ceremony, the way back, and the controls: the page words, the GRAPHS page's stat list, a group's fold, BACK / LOBBY | `openScores`, `scoresBack`, `scoresHit`, `scoresActivate`, `scoresKey`, `scoresClick` (the four one-line hand-offs: `deadActivate`/`renderDead`/`deadKey`/`deadClick`, js/ui/screens.js; the door: `toLobby`, same file) | `the way in` |
| the pixels: the head, the page words, the faces, the groups with your column lit and each row's best underlined, the bare BACK / LOBBY words, and the GRAPHS page's stat list and bar chart | `SC_*`, `scoreWord`, `drawScoreFace`, `renderScores`, `drawScoreStats`, `scoreStep`, `drawScoreBars` | `the pixels` |
