# js/sim/heroes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| where a named hero's kit reaches the shared sim: the passive table and its hooks, the hit-taken fold, stat bonuses, tenacity, walk multipliers, dashes on the rush state, world ticks and ground draws, each a list or table every hero file registers into | `HERO_PASSIVE` (`passiveHurt` in `damagePlayer`, `passiveDeal` in `hurtUnit`, `passiveCast`/`passiveTick` in `updateAbilities`, `passiveOut` in `bodyOut`), `HERO_TAKEN`/`heroTaken` (`damagePlayer`), `HERO_STAT`/`heroStat` (`statOf`, `statParts`), `HERO_TEN`/`heroTen` (`ccMul`), `HERO_MOVE`/`heroMove` (`abilityMoveMul`), `HERO_DASH`/`heroDash` (`p.dash`, the rush branch in sim.js), `HERO_TICK`/`heroTick` (`updateAbilityWorld`), `HERO_GROUND`/`heroGround` (`drawAbilityGround`), `HERO_MARK`/`heroMarks` (`drawUnitStates`), a dash row's `through` (`heroDashThrough`, `separateUnits`), `heroAbNow`; a row's `recast`/`ok` (`abRecast`, `tryAbility`) | `hero hooks` |
