# js/sprites/characters.js (legacy IIFE)

| Looking for | Start at | Banner |
| --- | --- | --- |
| the letters every body starts from, and a team's coat, hat and trim laid over them | `PPAL`, `teamPlayerPal` | `paint` (`teamPlayerPal` sits under `run and roll`) |
| the run, the held run and the roll in a paint: motion.js's grids baked a facing at a time on first use | `motionSet` | `run and roll` |
| a hero flat in the snow (`prone[dir]` on its set, for the end-screen emotes and the loss's stage): a standing frame turned a quarter clockwise and dropped to the cell floor | `lie` | `lying down` |
| a hero's pose set in a team's paint and one of its looks (`CLASSES[cls].skins`, e.g. ARM_SKINS; a look's own `pal` laid over the hero's), baked on first ask and kept; its side run off the drawn side frame, and its front and back run too for a look with `run: 'drawn'` | `SPRITES.champLook` (asked through `classSet`, js/sim/player.js; the walk: `heroWalk`, the run: `heroRunSide`/`heroRunFront`, js/sprites/armatos.js) | `heroes` |
| a hero's 48 x 48 face in one look and team paint: its own standing front at 3x, kept up to `PORTRAIT_KEEP` | `SPRITES.portrait` | `heroes` |
| the merchant who drives each team's eagle: its grids, paint and walking set per team | `merchantSet`, `merchantPal`, `SPRITES.merchant` | `heroes` (after `portrait`) |
