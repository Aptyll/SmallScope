# js/sim/nix.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| NIX's tuning and her four keys | `WATCH_*`, `SHARD_*`, `CLOUD_*`, `DRIFT_STEP_*`, `WHITE_*`, `NIX_AB` (joined into `CLASS_AB`, abilities.js) | `nix` › `tuning`, `the keys` |
| hidden: the cloud she stands in, the cover rule she adds to the fog (`HERO_COVER`), whether the other side sees her | `nixCloudOf`, `nixCover`, `nixHidden` | `nix` › `hidden` |
| NIGHT WATCH, her passive (`HERO_PASSIVE.nightwatch`): the hidden blow, the reveal on a blow from the cloud, the rival marked for DRIFT STEP (`nixBy`/`nixUntil` on the body), the night's walk (`HERO_MOVE`), SQUALL's reset | `watchDeal`, `nixTick`, `nixMoveMul`, `nixOut` | `nix` › `NIGHT WATCH` |
| Q, W, E, R: the shard out and home, the cloud, the step behind a struck rival (`HERO_DASH.drift`), the vanish and its strike | `nixShard`, `updateNixShards`; `nixCloud`, `updateNixClouds`; `driftTarget`, `nixDrift`, `driftEnd`; `nixWhiteout`, `whiteTarget`, `nixWhiteStrike` | `nix` › each key |
| what she leaves in the world (`nixShards`, `nixClouds`: `SAVE_ROOTS`, packed in snapshot.js), stepped once a step (`HERO_TICK`) | `updateNixShards`, `updateNixClouds` | `nix` |
