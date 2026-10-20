# Going down

A body that drops does not blink out: for `DOWN_T` (0.6 s) the `going down` banner
(js/draw/bodies.js) plays one of two falls in its place, after a white flash (`DOWN_FLASH`).
**Frozen**: the frame turns to ice (`DOWN_ICE`, by each pixel's own lightness), a crack
(`DOWN_CRACK`) sets, then it breaks into 3×3 shards that fly out and fall. **Blown away**: a pixel
at a time from the hat down, each one drifting downwind and up and paling to snow. Which one is
`hash2(id, deaths)`, so every screen and the recap see the same fall. It is drawn only:
`trackDowns(now)`, once a frame before the draw list, starts a fall on the edge of `p.dead` as this
machine sees it (so a client plays it too; a body already dead when first seen, a loaded save or a
late join, gets none) and `drawDown` draws it from the y-sorted pass. `die()` still throws its
team-colour burst over the flash. While the local player's own fall runs, `viewPlayer()` stays on
it, the replay keeps recording and the recap waits; then the view hands over to an ally.
