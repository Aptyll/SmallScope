# js/draw/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a deep drift's pixels: crest, lip, outline, cast shade, the ripples on its top | `DEEP_PAL`, `deepTone` (called per pixel by `snowTile`, ground.js), `deepPx`/`deepIn` + the tile's depth window `DEEP_WIN`/`deepWin`/`deepTileOpen`/`deepTileClose` | `deep snow's look` |
| the brush's reeds: the atlas, where they stand, the ones over the view into the y-sort, one drawn and thinned round the viewed hero | `REED_PAL`, `REED_*`, `reedAtlas`, `reedsOf` (kept on the drift), `reedDraws` (from `gatherDraws`, passes.js), `drawReed` (from `drawSorted`) | `deep snow's look` › `the reeds` |
