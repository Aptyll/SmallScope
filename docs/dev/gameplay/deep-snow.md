# Deep snow

Deep snow is the valley's **brush**: the DEEP band of the [snow depth map](../world.md#snow-depth),
laid by hand in mirrored patches (`BRUSH_PATCHES`, `layBrush`, [js/sim/depth.js](../../../js/sim/depth.js))
and in each warren's pool. It does not slow anybody.

**Hiding** is the fog of war's rule ([fog of war](fog-of-war.md)), so every reader of sight obeys
it at once - each screen's draws, each side's bots, and what the host sends each client. A body
whose position is in a patch (`brushOf`) is unseen by the other side unless one of that side's
heroes or wave soldiers stands in the same patch or within `FOG_BRUSH_RIM` (1.5 tiles) of its rim
(`brushHide`, js/sim/fog.js, measured with `brushIn`). Seeing out of a patch is nothing special,
and your own side always sees you. Towers and turrets never see into one. The falcon's mark still
shows a marked body anywhere.

**The look** ([js/draw/depth.js](../../../js/draw/depth.js)): the patch is baked into the ground as
a raised drift (`deepTone`), and frosted dead reeds stand in it (`reedsOf`, a staggered `REED_STEP`
grid jittered off the position hash, wherever the snow is deep). Each reed is a sprite off one
small atlas (`reedAtlas`, `REED_PAL`), y-sorted with the bodies (`reedDraws` from `gatherDraws`,
`drawReed` in `drawSorted`, js/draw/passes.js), so a body among them stands half behind the ones in
front. Reeds within `REED_FADE` of the viewed hero thin to `REED_SEE`, so your own hero is never
lost in the brush. A tile paved or holed since the bake stands no reeds. About 270 reeds on screen
at the widest zoom cost ~2 ms a frame headless (SwiftShader); not yet measured on a real GPU.

**Bots** see through the same rule (`seenAt`/`inSight`), so a rival in a patch is not there for
them until one walks up to it. A laner with no column on its lane waits in the nearest patch within
`AI_BRUSH_R` of its hold point that is no further out from its own base than the hold point
(`aiBrushWait`, js/ai/ai-farm.js) instead of standing in the open.

The hunter's snow cover ([prone](prone-under-the-snow.md)) is separate and works anywhere.
