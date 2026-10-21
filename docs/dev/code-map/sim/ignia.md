# js/sim/ignia.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| IGNIA's tuning and her four keys | `SPREAD_*`, `IGNIA_BURN_*`, `BRAND_*`, `BRUSH_*`, `WARM_*`, `WILD_*`, `IGNIA_AB` (joined into `CLASS_AB`, abilities.js) | `ignia` › `tuning`, `the keys` |
| the fire she lights: the burn rate off her DAMAGE and ABILITY POWER, a light that remembers her (`kindleBy`), WARM HANDS doubling it, the water between two bodies, what puts her fire out | `igniaBurnRate`, `igniaLight`, `igniaDeal`, `igniaHeat`, `waterBetween`, `igniaDoused` | `ignia` › `the fire she lights` |
| KINDLING, her passive (`HERO_PASSIVE.kindling`, js/sim/heroes.js): a burning rival passes her fire to the next one near, deep snow and water put it out | `updateKindling` | `ignia` › `KINDLING` |
| Q, W, E: the thrown brand (an arrow with `burn` and `look: 'brand'`), the line of fire on the ground and its melted strip, the warmth that waits and her walk while it does | `igniaBrand`; `brushfires`, `brushAt`, `brushTouch`, `igniaBrushfire`, `updateBrushfires`; `igniaWarm`, `igniaMoveMul` | `ignia` › `Q FIREBRAND`, `W BRUSHFIRE`, `E WARM HANDS` |
| R: the ring that catches, the jumps that ignore snow and stop at the creek | `wildAt`, `igniaWildfire` | `ignia` › `R WILDFIRE` |
| what she registers: the passive's hooks, her walk, her world tick | `igniaTick`, `igniaOut`, `igniaWorld` | `ignia` › `the hooks she registers` |
