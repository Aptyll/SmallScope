# js/draw/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a hero's own blade in its hands: the table each hero registers into, the flat blade asked by `drawHeldTool` (bodies.js), the slanted carry facing down or up | `HERO_BLADES`, `bakeBladeArt`, `heroBladeOf`, `heroBlade`, `heroCarry` | `hero blades` |
| a shot in flight drawn as its own thing (IGNIA's FIREBRAND and her staff's ember, AURA's star bolt), by the `look` the shot carries | `HERO_SHOTS` (`drawArrows`, passes.js) | `hero blades` |
| a mage's staff carried upright in the leading hand in every facing, held through a cast, mirrored facing left or up (IGNIA's crook, AURA's star shard) | `HERO_STAVES`, `heroStaffOf`, `heroStaff` (`drawHeldTool`, bodies.js) | `hero blades` |
| what a hero wears on or around its body beyond its sprite (ARMATOS's standard on his back, FORTIVA's glints and shell), drawn behind and over the body | `HERO_BODY_FX`, `heroBodyFx` (`drawPlayer`, bodies.js) | `hero blades` |
