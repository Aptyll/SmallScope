# js/sim/clivus.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| CLIVUS's tuning, his four keys and what they leave in the world | `FOOT_*`, `PICK_*`, `ROPE_*`, `VAULT_*`, `RING_*`, `CLIVUS_AB` (joined into `CLASS_AB`, abilities.js), `clivusRopes`, `clivusRings` | `clivus` › `tuning` |
| FOOTHOLD, his passive (`HERO_PASSIVE.foothold`): a key landing readies a harder basic strike | `isClivus`, `clivusCast`, `clivusTick`, `clivusDeal`, `clivusOut` | `clivus` › `FOOTHOLD` |
| Q: a wedge of the ice axe, twice as hard on a rival he holds (roped, rooted or stunned) | `clivusPick`, `clivusHolds` | `clivus` › `Q PICK STRIKE` |
| W: the rope down the aim (stepped by `HERO_TICK`), tied to the first rival hero; it roots them at the end of the tie unless they ran far enough to snap it | `clivusThrow`, `updateClivusRopes` | `clivus` › `W ROPE` |
| E: the vault over scenery and water to a spot his body fits (`HERO_DASH.vault`, `over`), the blow where he lands, and his settling clear of a pine when a stun cuts it short | `vaultFits`, `vaultSpot`, `clivusVault`, `vaultStep`, `vaultSettle`, `vaultLand` | `clivus` › `E VAULT` |
| R: the rope ring round him: a blow inside, and its tiles a wall to rivals only for a while (`HERO_SOLID`, read by `isSolidTile`) | `clivusRing`, `updateClivusRings`, `ringSolid` | `clivus` › `R ROPE RING` |
