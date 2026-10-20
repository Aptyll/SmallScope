# js/draw/callouts.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| what a callout looks like: the plate over the caller's name (or over the ping when the caller is off the screen), its glyphs, the ground ping's pulse, the minimap's; a player's ping as a bare glyph on a stem over its spot, and that glyph alone (the wheel's wedges and the chart draw it too) | `drawCallouts` (called after `renderLighting`, render.js), `drawCallPlate`, `CALL_GLYPHS`, `drawPingMark`, `drawPingGlyph`, `callTag`/`callAnchor` (set from `drawPlayer`, js/draw/bodies.js), `drawCalloutsMap` (called from `renderMinimap`, js/ui/minimap.js) | `callout pixels` (what a call is: `bot callouts`, js/ai/ai-callouts.js) |
