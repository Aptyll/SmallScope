# js/ui/guide.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the FIRST MATCH's coach: the lessons and what finishes each, its clock, when it is on, the card's rect, the X, the Shift line, the world arrow and the edge chevron | `GUIDE_STEPS`, `GUIDE_*`, `guide`, `guideOn`, `guideOpen`, `updateGuide`, `guideShown`, `guideRect`, `guideTipOn`, `guideClick` (from `pointerPress`, input.js), `drawGuideArrow`, `GUIDE_EDGE_ARROW`, `renderGuide` (from `renderUI`, js/ui/compose.js) | `the coach` (the mode: `PARTY_MODES.guide`, js/ui/rooms.js; the flag: `PROFILE.guided`, js/app/profile.js) |
| what a lesson points at: your side's counter, the rival towers and the nearest | `guideCounter`, `guideRivalTowers`, `guideNearTower`, `guideAttackCap` | `the coach` |
| RANKED's lock and its pips (the title's word and the party's list of modes) | `RANK_LOCK`, `drawRankedLock`, `drawRankedPips` (the rule: `RANKED_AT`/`rankedOpen`, js/ui/rooms.js) | `the coach` |
