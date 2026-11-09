# js/draw/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a hero's own blade in its hands: the table each hero registers into (its `hilt` on the flat art), the flat blade asked by `drawHeldTool` (bodies.js), the slanted carry facing down or up, and a hero's own carry of any weapon facing down or up (SAGITTA's shouldered crossbow) | `HERO_BLADES`, `bakeBladeArt`, `heroBladeOf`, `heroBlade`, `heroCarry`, `HERO_CARRY` | `hero blades` |
| a shot in flight drawn as its own thing (IGNIA's FIREBRAND and her staff's ember, AURA's star bolt, SALVIA's sprig, LUCERNA's spark, HIEMS's ICICLE and frost bolt, FABER's SPARK and brass cog, BUCINA's note, VELOX's sling stone, SAGITTA's bolts), by the `look` the shot carries | `HERO_SHOTS` (`drawArrows`, passes.js) | `hero blades` |
| a mage's staff carried upright in the leading hand in every facing, held through a cast, mirrored facing left or up (IGNIA's crook, AURA's star shard, SALVIA's snowdrop staff, LUCERNA's lantern hung from the hand, HIEMS's snowflake, FABER's clock, BUCINA's horn, VELOX's staff sling) | `HERO_STAVES`, `heroStaffOf`, `heroStaff` (`drawHeldTool`, bodies.js) | `hero blades` |
| what a hero wears on or around its body beyond its sprite (ARMATOS's standard on his back, FORTIVA's glints and shell), drawn behind and over the body | `HERO_BODY_FX`, `heroBodyFx` (`drawPlayer`, bodies.js) | `hero blades` |
| a hero drawn as something else for a while, in place of its sprite and held tool (RUPES's snowball while he rolls) | `HERO_BODY_DRAW`, `heroBodyDraw` (`drawPlayer`, bodies.js) | `hero blades` |
| a hero its own kit hides, drawn see-through for the side that still sees it (NIX in her cloud) | `HERO_FADE`, `heroFade` (`drawPlayer`, bodies.js) | `hero blades` |
