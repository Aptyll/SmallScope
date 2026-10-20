# js/sim/save.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a save carries: the roots, `state`'s UI keys it leaves behind, the three streams' positions | `SAVE_ROOTS`, `saveArr`, `SAVE_STATE_SKIP` (the streams' `.s`: `mulberry32`, core.js) | `saved matches` |
| the grown valley every save is written against, and the tile objects that are always written | `saveBaseline`, `saveSum`, `saveBase` (its `live` set) | `saved matches` |
| the object graph: the `$` tags, the static rows written as names, the classes rebuilt | `saveEncode`, `saveDecode`, `saveStatics`, `SAVE_CLASSES` | `saved matches` |
| the match as a record and back, and the proof's hash | `saveCapture`, `saveApply`, `saveHash` (`DBG.saveHash`) | `saved matches` |
| the record put back on a fresh page (`DBG.saveLoad`), boot's two halves | `saveDevLoad`, `saveBootLoad` (before `prepGround`), `saveBootEnter`, `saveBootView` | `saved matches` |
