# js/draw/orca.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca's pixels: the shadow under the ice (cut to the ice's own pixels, a little deeper at the lock and darkening as it rises, its tail beating with its speed) and the breach (the lunge out of the hole, jaws anchored on the bitten spot, cut at the waterline, the slide back down) | `ORCA_SHADE*`, `ORCA_DEPTH`/`ORCA_DROP`/`ORCA_JAW_AT`, `orcaMask`/`orcaMaskBuild`, `drawOrcaShadow` (`drawGroundPass`, passes.js), `drawOrcaBreach` (the y-sorted list's `orca` entry, `render()`) | `the orca, drawn` (the thing itself: js/sim/orca.js; the count: `drawOrcaCount`, js/draw/overhead.js) |
| the orca up: its frames (the breach's cells cut at the waterline, `SPRITES.orca.left`/`right`, drawn by `drawAnimal`), its hole and the spouts' rings and lumps on the ground pass | `orcaUpFrame`, `ORCA_UP_WL`, `drawOrcaPool`, `ORCA_HOLE`/`ORCA_SPOUT_ARC` | `the orca, drawn` |
