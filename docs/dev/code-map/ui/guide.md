# js/ui/guide.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the FIRST MATCH's coach: the lessons and what finishes each, its clock, when it is on (after the landing's headline), the card's rect, the X, the line of detail (open for a lesson's first seconds, then on the DETAILS key), the world arrow and the edge chevron | `GUIDE_STEPS`, `GUIDE_*`, `guide`, `guideOn`, `guideHeadlineUp`, `guideOpen`, `guideNext` (the first lesson not learned whose place is at hand), `guideDone`, `updateGuide`, `guideShown`, `guideRect`, `guideTipOn`, `guideClick` (from `pointerPress`, input.js), `drawGuideArrow`, `GUIDE_EDGE_ARROW`, `renderGuide` (from `renderUI`, js/ui/compose.js) | `the coach` (the mode: `PARTY_MODES.guide`, js/ui/rooms.js; the flag: `PROFILE.guided`, js/app/profile.js) |
| what a lesson points at: your side's counter, your lane's soldiers (LAST HIT, until a rival one is on screen; before the first wave, the spot up the lane where its laner waits, `laneHold`), the rival towers and the nearest | `guideCounter`, `guideShopNear` (SHOP steps aside far from it), `guideSoldier`, `guideRivalTowers`, `guideNearTower`, `guideAttackCap` | `the coach` |
