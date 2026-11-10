# js/draw/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a hero's own blade in its hands: the table each hero registers into (its `hilt` on the flat art), the flat blade asked by `drawHeldTool` (bodies.js), the hero's own hold of it at rest in every facing (`BLADE_HOLDS`: slanted, the other hand, over the shoulder, head down on the snow), and a hero's own carry of any weapon facing down or up (SAGITTA's shouldered crossbow) | `HERO_BLADES`, `BLADE_HOLDS`, `bakeBladeArt`, `heroBladeOf`, `heroBlade`, `heroCarry`, `HERO_CARRY`, `heldFlip`, `heldDrop` | `hero blades` |
| a shot in flight drawn as its own thing (IGNIA's FIREBRAND and her staff's ember, AURA's star bolt, SALVIA's sprig, LUCERNA's spark, HIEMS's ICICLE and frost bolt, FABER's SPARK and brass cog, BUCINA's note, VELOX's sling stone, SAGITTA's bolts), by the `look` the shot carries | `HERO_SHOTS` (`drawArrows`, passes.js) | `hero blades` |
<<<<<<< HEAD
| a mage's staff carried in every facing by its hero's own `hold` (`STAFF_HOLDS`: the leading hand or the far hand, always upright; a draw or a cast brings it into the leading hand, and a cast or a shot's first beat raises it up and out, the body a pixel up with it: `staffCasting`, `STAFF_RAISE`), mirrored facing left or up (IGNIA's crook, AURA's star shard, SALVIA's snowdrop staff, LUCERNA's lantern hung from the hand, HIEMS's snowflake, FABER's clock, BUCINA's horn, VELOX's staff sling) | `HERO_STAVES`, `STAFF_HOLDS`, `heroStaffOf`, `heroStaff` (`drawHeldTool`, bodies.js) | `hero blades` |
=======
| a mage's staff carried in every facing by its hero's own `hold` (`STAFF_HOLDS`: the leading hand or the far hand, always upright; a draw or a cast brings it into the leading hand), mirrored facing left or up (IGNIA's crook, AURA's star-glass, SALVIA's snowdrop staff, LUCERNA's lantern hung from the hand, HIEMS's snowflake, FABER's clock, BUCINA's horn, VELOX's staff sling) | `HERO_STAVES`, `STAFF_HOLDS`, `heroStaffOf`, `heroStaff` (`drawHeldTool`, bodies.js) | `hero blades` |
>>>>>>> 4e04775c (PATCH 0.704 — Hero powers come from craft and creation)
| what a hero wears on or around its body beyond its sprite (ARMATOS's standard on his back, FORTIVA's glints and shell), drawn behind and over the body | `HERO_BODY_FX`, `heroBodyFx` (`drawPlayer`, bodies.js) | `hero blades` |
| a hero drawn as something else for a while, in place of its sprite and held tool (RUPES's snowball while he rolls, MARIS's heaving snow while she is under it, FALCO gone into the sky on STOOP) | `HERO_BODY_DRAW`, `heroBodyDraw` (`drawPlayer`, bodies.js) | `hero blades` |
| a hero its own kit hides, drawn see-through for the side that still sees it (NIX in her cloud) | `HERO_FADE`, `heroFade` (`drawPlayer`, bodies.js) | `hero blades` |
| how far a look on a larger cell stands over and out past the 16 px one (the overhead frame's lift, a hand's reach) | `heroRise`, `heroReach` | `heroes` |
