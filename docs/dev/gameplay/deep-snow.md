# Deep snow

Deep snow is the valley's **brush**: the DEEP band of the [snow depth map](../world.md#snow-depth),
laid by hand in mirrored patches (`FIELD_BRUSH`, js/sim/field.js; `layBrush`, [js/sim/depth.js](../../../js/sim/depth.js))
and in each warren's pool. It does not slow anybody.

**Hiding** is the fog of war's rule ([fog of war](fog-of-war.md)), so every reader of sight obeys
it at once - each screen's draws, each side's bots, and what the host sends each client. A body
whose position is in a patch (`brushOf`) is unseen by the other side unless one of that side's
heroes or wave soldiers stands in the same patch or within `FOG_BRUSH_RIM` (1.5 tiles) of its rim
(`brushHide`, js/sim/fog.js, measured with `brushIn`). Seeing out of a patch is nothing special,
and your own side always sees you. Towers never see into one. A mark (`markUnit`) still
shows a marked body anywhere.

**The look** ([js/draw/depth.js](../../../js/draw/depth.js)): the patch is baked into the ground as
a raised drift (`deepTone`; its painted edge wanders a few pixels off the sim's rim, `DEEP_RAG`, so it is not a ruled oval, while who is hidden still reads the sim's own depth), and frosted dead reeds stand in it (`reedsOf`, a staggered `REED_STEP`
grid jittered off the position hash, wherever the snow is deep; whole along the rim, `REED_RIM`,
and open in a few small glades inside it, `REED_GAP` and `REED_GLADE`, so the middle is clumps and openings, never one bare floor). A stand is three straws in whole clumps (`REED_TONES`, `REED_CLUMP`), no reed stands where a camp's beast rests (`REED_REST`), and the reeds thin round every beast the frame shows as they do round the viewed hero (`REED_FADE_BEAST`). Each reed is a tuft, a
solid wedge of dark straw with blades fanning out over it, lit on the left, off one small atlas
(`reedAtlas`, `REED_PAL`). Tufts are wider than the grid is apart, so a stand reads as one
thicket, and they are short along the rim (`REED_LOW`) and in low swales inside (`REED_SWALE`,
`REED_DIP`), so it rises to its middle with a rhythm, not one flat top. They are y-sorted with the bodies (`reedDraws` from `gatherDraws`,
`drawReed` in `drawSorted`, js/draw/passes.js), so a body among them stands half behind the ones in
front. Reeds within `REED_FADE` of the viewed hero thin to `REED_SEE`, so your own hero is never
lost in the brush. A tile paved or holed since the bake stands no reeds. The stand is denser than it was (`REED_STEP`), and its frame cost has not been measured since
(it was ~2 ms headless for about 270 reeds on screen at the widest zoom).

**Bots** see through the same rule (`seenAt`/`inSight`), so a rival in a patch is not there for
them until one walks up to it. A laner with no column on its lane waits in the nearest patch within
`AI_BRUSH_R` of its hold point that is no further out from its own base than the hold point
and within `AI_BRUSH_LANE` of its own lane's road (`aiBrushWait`, js/ai/ai-farm.js) instead of
standing in the open.
