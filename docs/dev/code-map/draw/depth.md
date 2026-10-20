# js/draw/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a deep drift's pixels: crest, lip, outline, cast shade, the ripples on its top | `DEEP_PAL`, `deepTone` (called per pixel by `snowTile`, ground.js), `deepPx`/`deepIn` + the tile's depth window `DEEP_WIN`/`deepWin`/`deepTileOpen`/`deepTileClose` | `deep snow's look` |
| a body sunk to the shins in it, and the collar round the cut | `drawWading` (wraps `drawPlayer`/`drawAnimal`/`drawRobot` in `render()`), `wadeLook`, `wadeWidth`, `WADE_SINK`/`WADE_CUT` | `deep snow's look` |
