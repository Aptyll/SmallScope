# js/sim/stats.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| **what a hero stat IS**: the seven (HEALTH, DAMAGE, ATTACK SPEED, ARMOR, ABILITY POWER, COOLDOWN SPEED, MOVE SPEED), their keys, print formats and better-way, the empty bonus bag, and the ledger rows every stat ledger reads | `STATS`, `STAT_INT`/`STAT_AS`, `statBag`, `STAT_ROWS` (read by `renderHero` js/ui/menu.js, `drawCharPanel` js/ui/bag.js, `noteStatBody`/`updateStatLedger` js/ui/notices.js) | `hero stats` (the base and growth: `CLASSES[c].base`/`.grow`, player.js) |
| **reading one**: the pure form, a body's, attack speed's cycle and its multiplier, a buff on it, the panel's number and its breakdown | `statFrom`, `statOf`, `classAs`, `asMulFrom`/`asMul`, `statBuffMul`, `statShown`, `statParts` | `hero stats` |
| ARMOR at the hit and its inverse, COOLDOWN SPEED on a cooldown | `armorTaken` (`damagePlayer`, player.js), `armorRaw` (`orcaLethal`, orca.js), `hasteMul` (`abCdOf`, abilities.js) | `hero stats` |
