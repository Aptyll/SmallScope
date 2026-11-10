# js/draw/trails.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the lines of prints over the open snow from each jungle camp to the camps nearest it (`TRAIL_LINKS`): the cheapest walk over open tiles, kept to the middle of a corridor (`TRAIL_WALL`) and made to wander (`TRAIL_WANDER`), walked a gait's step at a time (`TRAIL_GAITS`: deer, wolf, hare); prints only, on snow only (they break at a lane, at ice and inside a camp's yard, `TRAIL_YARD`); baked into the ground | `bakeTrails` (from `prepGround`), `paintTrails` (from `paintGroundTile`), `trailWalk`, `trailFoot` | `animal trails` |
