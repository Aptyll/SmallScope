# js/draw/orca.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the orca's pixels: the shadow under the ice (cut to the ice's own pixels, a little deeper at the lock and darkening as it rises, its tail beating with its speed) and the breach (the lunge out of the hole, jaws anchored on the bitten spot, cut at the waterline, the slide back down) | `ORCA_SHADE*`, `ORCA_DEPTH`/`ORCA_DROP`/`ORCA_JAW_AT`, `orcaMask`/`orcaMaskBuild`, `drawOrcaShadow` (`render()`, after the lake's fish), `drawOrcaBreach` (the y-sorted list's `orca` entry, `render()`) | `the orca, drawn` (the thing itself: js/sim/orca.js; the count: `drawOrcaCount`, js/draw/overhead.js) |
