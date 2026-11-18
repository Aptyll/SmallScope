# js/draw/depth.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a deep drift's pixels: crest, lip, outline, cast shade, the ripples on its top | `DEEP_PAL`, `deepTone` (called per pixel by `snowTile`, ground.js), `deepPx`/`deepIn`, `deepRag`/`deepRagAt` (the painted edge's wander, `DEEP_RAG`; the skirt's too, `bakeDrifts`, lakes.js) + the tile's depth window `DEEP_WIN`/`deepWin`/`deepTileOpen`/`deepTileClose` | `deep snow's look` |
| the brush's reeds: the atlas, where they stand, the ones over the view into the y-sort, each patch thinned as one while the viewed side sees into it | `REED_PAL`, `REED_*`, `reedAtlas`, `REED_TONES` (a clump's straw: a row of the atlas each), `reedsOf` (kept on the drift; none where a camp's beast rests), `reedDraws` (from `gatherDraws`, passes.js), `reedThinOf` (a patch's eased alpha off `brushSeen`), `drawReed` (from `drawSorted`; at its patch's alpha, thinner round `reedBeasts`, the frame's shown beasts) | `deep snow's look` › `the reeds` |
