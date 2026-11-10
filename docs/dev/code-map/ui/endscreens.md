# js/ui/endscreens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the victory screen: its timeline, the side's stands, its sound cues, its art, and the passes both endings share | `WIN_T`, `WIN_BODY`/`WIN_TIER`/`WIN_BANNER_W`/`WIN_BANNER_H`, `drawEndWhy` (a 1V1's ending under either headline's rule: `onevoneWhy`, js/sim/onevone.js; the loss's dim overlay in screens.js prints DEFEAT and it too), `winLayout`, `winStands`, `winCues`, `tallyCues`, `renderVictory`, `stampGrid`, `drawWinAurora`, `drawWinRays`, `drawWinMotes`, `drawWinConfetti`, `WIN_CREST`, `mixHex`, `winBannerCv`, `drawWinBanner`, `drawBrazierIron`, `drawWinBrazier`, `drawWinDais`, `drawEndStatPlate`, `drawEndTally` | `victory` |
| the defeat screen: the loss's own summary, the whole side down in the drift, on the same anchors and stands | `DEF_T`, `DEF_STATS`, `defCues`, `renderDefeat`, `drawBlizzard`, `drawDefeatDrift`, `drawDeadBrazier`, `drawDefeatRime`, `DEF_RIME_BAND`/`DEF_RIME_GROW`, `DEF_ARROW` | `defeat` |
