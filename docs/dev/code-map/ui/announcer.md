# js/ui/announcer.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the announcer's calls landing on this screen (raised by the sim, replayed on a client), the queue that keeps two from overlapping, how long one holds, and the sting as one comes up | `annRaise` (from the `calls` banner, js/sim/player.js), `annTake` (also `evPlay`'s `'ann'`, js/net/events.js), `annQ`/`annT`, `ANN_LIFE`/`ANN_RUSH`/`ANN_WAIT`, `ageAnnouncer` (called from `updateFx`, sim.js), `annSting` (`SFX.announce`, audio.js) | `announcer` |
| what each call reads (FIRST BLOOD, the multi-kills, SHUTDOWN, ACE, TOWER DESTROYED, a bear SLAIN) | `ANN_TEXT`, `ANN_MULTI` | `announcer` |
| the plate under the team rail: its graphite, its size, its drop in and fade out | `drawAnnPlate`, `ANN_FACE`/`ANN_PAD`/`ANN_GAP`/`ANN_IN`/`ANN_OUT`/`ANN_DROP` (it hangs at `noteY`, js/ui/rail.js) | `announcer` |
| the faces on the plate and the feed: a player's, a side's, the tower glyph, a bear's camp glyph, dimmed for what was taken | `annFace`, `annFaceA`/`annFaceB`, `annSide`, `annGlyph`, `ANN_TOWER`, `ANN_DIM` | `announcer` |
| the kill feed under the news plates: its rows, how many, how long, where it starts and stops | `annFeed`, `FEED_MAX`/`FEED_LIFE`/`FEED_IN`/`FEED_FACE`/`FEED_AIR`, `drawFeed`, `drawFeedRow` (starts at `noteLaneBottom`, stops at `noteLaneFloor`, js/ui/notices.js) | `announcer` |
| the frame's call into it | `renderAnnouncer` (from `renderUI`, js/ui/compose.js) | `announcer` |
