# Hero stats

Every hero is the same seven League-style numbers, all in js/sim/stats.js (`STATS`), and
`statOf(p, key)` is the one reader: the sim, the HUD's stat panel and the bots all ask it.

| Stat | key | What it does | HUNTER L1, per level | WARRIOR L1, per level |
| --- | --- | --- | --- | --- |
| HEALTH | `hp` | `p.maxHp` (`levelMaxHp`); a level's growth is healed on the spot | 92, +7 | 120, +9 |
| DAMAGE | `dmg` | a full-draw basic attack (`attackDmg`, [the basic attack](the-basic-attack.md)) | 16, +1.3 | 18, +1.6 |
| ATTACK SPEED | `as` | full-draw attacks a second; `asMul` divides the draw (`drawTime`) and the renock (`attackCycle`) | 0.58, +1.3% | 0.77, +1% |
| ARMOR | `armor` | `damagePlayer` cuts every hit to `100 / (100 + armor)`, never under 1 (`armorTaken`; `armorRaw` its inverse, for `orcaLethal`) | 12, +2 | 20, +2.6 |
| ABILITY POWER | `ap` | each ability adds `ap ×` its entry's `ap` ratio (`abAp`/`abDmg`, js/sim/abilities.js) | 0 | 0 |
| COOLDOWN SPEED | `haste` | `abCdOf` runs `100 / (100 + haste)` as long (`hasteMul`) | 0 | 0 |
| MOVE SPEED | `ms` | the walk in px/s (`updatePlayer`, `aiWalkT`) | 72 | 72 |

The base and growth sit in each hero's `CLASSES` entry (`base`, `grow`); attack speed's base is
not written down but is the hero's own attack cycle (`classAs`: the kit's full draw plus the
attack row's renock), and its growth and bonuses are fractions. Items
(`ITEM_STATS`, js/sim/items.js) add to the kit's bonus bag `kit.add` (rebuilt by `refreshKit`); a bear buff multiplies at the moment it counts
(`statBuffMul`: damage dealt in `hurtUnit`, the walk in `abilityMoveMul`), and `statShown` is the
sheet with that on. `statParts` is the breakdown the panel's hover lists (base, levels, items, buff). Ice handling, the dodge
roll, hiding and food are class traits on the kit, not stats. There are no pre-match stat points.
