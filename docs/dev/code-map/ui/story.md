# js/ui/story.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the three lines under an end screen's tally: the record the sim keeps (who downed whom, each bird's worst moment and who stood by it), how the lines are picked for the local player, and how they are printed | `storyOf`, `storyDown` (called from the down block in js/sim/player.js), `storyBirdHit` (called from `hurtEagle`, js/sim/eagle.js), `storyLines`, `drawStoryLines` (called after `drawEndTally` by `renderVictory`/`renderDefeat`); `state.story` rides `SNAP_STATE` | `match story` |
