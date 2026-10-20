# js/ui/character.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the HUD's shared well tones and its big well | `HUD_CELL` (the strip's ability well), `BAG_PAD`, `BAG_BG` (a frame's ground), `BAG_WELL` (a filled well) | `the HUD's wells` |
| is the pointer over HUD that owns its own clicks, rather than over the world | `overHud` | `the HUD's wells` (its caller is `openPingWheel`, input.js) |
| the character panel (G): the live body, the stat ledger off the live kit, the six item slots (no buying: items are bought at a counter) | `CHAR_LEDW`/`CHAR_WELL`, `charLayout`, `charHit`, `charItemHit` (the slot-index read tipAt uses), `charClick`, `drawCharPanel` (state: `state.charOpen`, core.js) | `the character panel (G)` |
