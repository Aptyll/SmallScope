# js/ui/endscreens.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the victory screen: its timeline and sound cues, its layout, the side's table (K/D/A, the damage bar against the side's best, soldiers, gold) and the passes both endings share | `WIN_T`, `WIN_SLIDE`, `END_TABLE_W`/`END_ROW`/`END_FACE`, `drawEndWhy` (a 1V1's ending under either headline: `onevoneWhy`, js/sim/onevone.js; the loss's dim overlay in screens.js prints DEFEAT and it too), `winLayout`, `endColumns`, `endKda`, `WIN_ICONS`/`WIN_ICON_PAL`/`DEF_ICON_PAL`, `WIN_ACCENT`/`DEF_ACCENT`, `endIcon`, `tallyCues`, `winCues`, `stampGrid`, `drawEndTitle`, `drawEndTable`, `drawEndBody`, `renderVictory` | `victory` |
| the defeat screen: the same board in frost, on the same anchors | `DEF_T`, `defCues`, `renderDefeat` | `defeat` |
