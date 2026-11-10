# js/sim/arcus.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| ARCUS's tuning and his four keys | `SHAFT_*`, `WASTE_*`, `VOLLEY_*`, `TWIN_*`, `GATHER_*`, `RAIN_*`, `ARCUS_AB` (joined into `CLASS_AB`, abilities.js) | `arcus` › `tuning`, `the keys` |
| his arrows standing in the snow and FULL QUIVER falling (`arcusShafts`, `arcusRains`, both in `SAVE_ROOTS` and the snapshot) | `arcusDrop`, `updateArcusWorld` (`HERO_TICK`) | `arcus` › `WASTE NOTHING`, `R FULL QUIVER` |
| WASTE NOTHING, his passive (`HERO_PASSIVE.wastenothing`): a basic arrow that hits a hero drops past it (`HERO_SHOT_HIT.arcus`), he walks over his own to pull them up for attack speed stacks (`HERO_STAT`); TWIN NOCK's second arrow rides the loose hook | `arcusShot`, `arcusHit`, `arcusTick`, `arcusStack`, `arcusAs`, `arcusDeal` | `arcus` › `WASTE NOTHING` |
| Q: five arrows in a fan, each dropped where it ends (`HERO_SHOT_HIT.volley`, `HERO_SHOT_END.volley`); a body's second arrow lands for less | `arcusVolley`, `volleyHit`, `volleyEnd` | `arcus` › `Q VOLLEY` |
| W: two arrows a shot for a while | `arcusTwin` | `arcus` › `W TWIN NOCK` |
| E: every stuck arrow flies back through rivals, three on one slow it, each one home a stack (`HERO_SHOT_HIT.gather`, `HERO_SHOT_END.gather`) | `arcusGather`, `gatherHit`, `gatherEnd`, `arcusGatherHits` | `arcus` › `E GATHER UP` |
| R: a far spot rained on arrow by arrow, on a sunflower spiral (no rng) | `arcusQuiver`, `arcusSpot`, `rainPoint`, `rainAt`, `rainLand` | `arcus` › `R FULL QUIVER` |
