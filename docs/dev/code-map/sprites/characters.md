# js/sprites/characters.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the player, the fish catch pose (the CATCH emote's, js/ui/screens.js), the skater, prone, the raider | by banner | `player`, `the fish catch`, `skater (champion 2)`, `prone`, `raider` |
| the run, the held run and the roll in a paint: motion.js's grids baked a facing at a time on first use, a look's fringe on their upright frames | `motionSet`, `fringeAt`, `MOTION_CLS` | `run and roll` |
| a character's paint on the class body: the tone and hair-colour tables, the six fringes, the per-character bake and its cache | `LOOK`, `fringed`, `lookPal`, `lookSet`, `champLook` | `looks` |
| a hero's own look in a team's paint (ARMATOS's LAST STANDARD and IRON OATH, FORTIVA's UNBROKEN and CHAINBREAKER, BELLA's IMPERIAL GENERAL and TRAITOR'S BLADE, IGNIA's HEARTHKEEPER and WANDERER); its side run off the drawn side frame | `heroSkinSet` (asked by `champLook`; the run: `heroRunSide`/`heroRunFront`, armatos.js) | `looks` |
