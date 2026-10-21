# Class abilities (keys 1-4)

Everything in this section lives in **[js/sim/abilities.js](../../../js/sim/abilities.js)**, under the
`class abilities` banner. Keys 1-4 cast the four actives of the player's
[class](../multiplayer.md#classes) — `CLASS_AB[p.cls]`, one row per key, where **what an ability IS
lives in its table entry** (`cd`, `cast`, `use(p)`), never in an `if` elsewhere. **A key can
carry more than one option**: `CLASS_AB[cls][i]` is its first and `CLASS_AB_ALT[cls][i]` the
others (`abOptions(cls, i)` lists them), and which one a body carries is `p.abPick[i]`, picked
before the eagle in the [hero pop-up](../rendering.md#the-hero-pop-up)'s ability column and carried
through the lock-in page; **every reader asks `abOf(p, i)`** for what a key is on
this body, and `abKeyOf(p, id)` for the key an ability id stands on (−1 when it is not picked).
A bot keeps the first option on every key — the one its hands know, since `aiCombat` reaches
for keys by index. The hunter's keys carry one option each; the warrior's carry two:

| key | first | other |
| --- | --- | --- |
| 1 | SHIELD WALL | **WAR CRY** — every rival unit within `CRY_R` slowed (`rank` `slow` for `slowT`) and marked (`mark`) for both maps; nothing hurt (`abWarCry`) |
| 2 | BULL RUSH | **WHIRLWIND** — everything alive within `WHIRL_R` cut for its `rank` `dmg` and thrown `WHIRL_KB`, buildings cut too (`abWhirlwind`) |
| 3 | STOMP | **HAMSTRING** — the wedge ahead (`HAM_R`/`HAM_HALF`) cut for `dmg` and rooted `root` (its `rank`) (`abHamstring`) |
| 4 | EXECUTE | **SECOND WIND** — `rank` `heal` (30/40/50%) of max hp back over `t` (4 s), paid out each tick by `updateAbilities` (`p.windT`/`p.windRate`, `abSecondWind`); the strip's active tell |

The press goes
through `input.ability` (edge-triggered, like the dodge) into `tryAbility(p, i)`, so a bot casts
through exactly the key a human presses; `updateAbilities(p, dt)` runs the cooldowns, lands the
cast, and ages every state an ability leaves on a body; `updateAbilityWorld(dt)` (called from
`updatePlay`) steps what they leave in the world.

**Abilities are bought with skill points, never gold — and a key you have not bought does
nothing.** Ranks work like League's. Each key starts **LOCKED at rank 0**: the class hands you the
four actives, not the use of them. Every rank costs **one skill point** — the only thing a point
buys, one per [hero level](../multiplayer.md#hero-levels). The **first** point on a key unlocks it
(`abUnlocked(p, i)`, the one gate: `tryAbility` refuses a rank-0 key outright and every bot
reaches for keys through `abReady(p, i)` = bought and off cooldown), and **every rank after is a
clear step in what the key does**: its row's `rank` table holds each number per rank (`rank: {
dmg: [14, 19, 24, 29, 34], stun: 1 }` — a list scales, a plain number stays flat; rank 1 is the
old flat number), and a `cd` given as a list shrinks by rank. `abRk(p, id, key)` is the one
reader: every `use()` asks it for its numbers at the rank the caster holds, and what a cast leaves
in the world (a net in flight, a planted standard) copies its numbers when it is cast. Keys 1-3
hold **5 ranks**, rank n waiting for hero level `AB_RANK_LV[n-1]` (1, 3, 5, 7, 9); key 4 is the
**ultimate** (`AB_ULT`) with **3 ranks** at `AB_ULT_LV` (6, 11, 16) — `abReqOf(ab, i)` reads
either (or a row's own `lvReq`) and `abLvMax(p, i)` is its length. 5 + 5 + 5 + 3 is **18 points
against the 18 a capped hero earns**, so the ladder ends exactly where the hero does: every point
has a home and nothing is stranded. The choice is the ORDER — you land with one point and four
dark keys, so the first thing a match asks is which ability you want to be.
The rest of the set: `abLvCanBuy(p, i)` (a point in hand, room on the key, the hero level reached),
`buyAbilityLv(p, i)` (the single entry point, reached through `input.cmd {kind:'ability', i}` →
`runCmd` by HUD plate click and bots alike — the unlock floats `NAME UNLOCKED` and a fatter
burst, every rank after floats the number, gold at the top rank), and `abCdOf(p, i)` — the
cooldown at the held rank under COOLDOWN SPEED, which every cooldown-setting site reads instead of
the row's `cd` (the cast landing, and the shield's comes-down reset). `p.abLv` resets with the match (every boot builds fresh `Player`s). The wells carry the progress — fat
buy pips along the top edge, **one seat per rank the key can hold**, so an empty row
is a locked ability — and a locked well stands dim (dark rim, the icon at `LOCK_DIM`, a grey key
digit), as an empty item slot does; a press on one reddens and shakes
it (`abDenied`, the twin of `itemDenied`). The ASK floats clear of the wells: while a
point is unspent each un-maxed key grows a bobbing gold plus plate in the open screen above its
well (`abBuyRect`/`abBuyHit`/`drawAbBuyPlate`, UI › `hud strip`). The plate press buys — and so does **the key itself while a point is unspent**: the sim
consumes `p.input.ability` as a buy whenever `abLvCanBuy(p, i)` holds and as a cast otherwise
(js/sim/sim.js, beside the other edge intents), so key 2 with a point in hand levels ability 2 and the
next press casts it; a maxed key casts straight through an unspent point. That reaches every
controller and the well click alike, since all of them set the one field. Hover lights the plate
and the tooltip carries the numbers, kept to what a mid-fight glance needs: the cooldown and the
one number a rank raises (a `rank` key given as a list; plain numbers stay off it) at the rank
held, and the row's one-line `tip`; Shift (or ABILITY DETAILS on ALWAYS) shows every rank's,
the held one lit gold
([the hover tooltip](../rendering/the-hud-corners/the-hover-tooltip.md); `LOCKED` and
`UNLOCK 1 SKILL PT` on a dark key). Bots spend each free point in rung 0 of the ladder (`aiSpend`,
js/ai/ai.js, first thing `aiThink` asks): the ultimate whenever it can rank, then each basic key
unlocked once, then the basics maxed in the hero's `rankOrder` (its `CLASSES` row: HUNTER
shot, net, grapple; WARRIOR stomp, rush, shield; ARMATOS verdict, march, brace; FORTIVA sever,
yoke, heart; AURA star, orb, step). The cd column in the tables below is every rank's; the numbers in the text are rank
1's, and each row's `rank` table has the rest.

**Every ability lands on every kind of body.** A player, a rabbit, a deer, a bird, a wolf and a
[soldier](robots.md) take the same damage and the same states from every key — the
tables below say "rival" because that is who you are usually casting at, not because anything else
is exempt. That is not written into each ability: they sweep `unitsNear`/`unitsHit` and land through
`hurtUnit` and the state setters ([status effects](status-effects-one-set-for-every-unit.md)), so the
next kind of neutral fauna pushed into `animals` is in range of every key on the day it is added,
with no edit here. A **structure** is not a unit, so it takes no state — but a rival's building
takes the *damage* of every blow with an area, through `hurtStruct` (`STRUCT_DR` off): the SLAM and
the EXECUTE sweep `structsInCone`, the STOMP `structsNear`, the BULL RUSH's wall slam and the NET
SHOT's line check `structFoe` on what stopped them. The roosting eagle is an objective with its
own damage path, and takes none of it.

**A cast is a performance**: `p.castT` runs the ability's `cast` seconds, the body visibly does
it (`abilityPose` shifts/tilts the sprite — the pierce's locked lean-back, a hop into the stomp,
the recoil hop off the net shot), movement halves (the pierce windup all but plants the feet —
`PIERCE_SLOW`), and the effect fires at the aim held at the END
of the cast. Casting breaks prone cover like a shot, is refused mid-roll / mid-stun / in a hole,
and a stun knocks a cast (and the shield, the rush, and the grapple's rope) out of the hands.
Everything an ability
does to a body is **drawn on that body for both sides** (`drawAbilityOnPlayer`) — a netted player
wears the net — and every wind-up with an area is telegraphed on the snow (below the tables).

HUNTER — bow, distance control, the ground between:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| 1 | **PIERCING SHOT** | 12/11/10/9/8 s | locks a full draw for `PIERCE_WIND` (0.7 s) — the body plants (`PIERCE_SLOW` ×0.15 walk), the pose leans back and holds, and a thin dashed **telegraph line** is drawn on the ground along the live aim for BOTH sides, gold-flaring as the loose nears. Then the shot fires itself: one enhanced arrow (a full-draw plain arrow × its `rank` `shot`, 1.5/1.7/1.9/2.1/2.3, `PIERCE_SPD` 380, `PIERCE_RANGE` 520) that **goes through every body on the line** (`a.pierce`/`a.pierceHit`, the arrow loop in js/sim/sim.js) — only a raised shield or the world stops it. **It wears every modifier on the tool in hand** (`pierceMods`) — folded into one envelope and spent as a press spends one: `pierceFlight` is `shotFlight` at full draw, so SPEEDUP and LONGSHOT stretch the reach as well as the speed; HEFT and SPLITTER scale the damage after the multiplier; the fire and CINDER BURST ride it; SPLITTER fans it and DUPLICATE repeats it (`armOff`), every arm a pierce of its own. The telegraph draws that flight, one line per fan arm, each to where the world stops it (`teleLen`). The loose is the unmissable cue: `SFX.nock` snap + a white flash on the arrowhead |
| 2 | **NET SHOT** | 15/14/13/12/11 s | a weighted net down a line (`nets`, each carrying the rank it was thrown at): first rival hit takes 4/8/12/16/20 and is **slowed** (`p.slowT`/`slowMul` ×0.4, 2 s, the drape drawn on them); the recoil kicks the hunter backward with an animated hop (`p.hopT`) |
| 3 | **GRAPPLE** | 8/7/6/5/4 s | throws a hook down the aim ray: the first **tree or dead tree** within `GRAP_RANGE` (170 px) and `GRAP_ASSIST` of the line (the aim assist) anchors it, and the body is reeled straight at it at `GRAP_REEL` (260 px/s — over `SLIDE_MIN`, so shift on release carves a slide). The reel runs **while key 3 is held** (`input.grapple`, the one held ability input); releasing, arriving, a wall or a stun lets go through `grapEnd`, which KEEPS the momentum and starts the cooldown — a long ride and an instant release cost the same. A hook that catches nothing costs `GRAP_MISS_CD` (1 s) |
| 4 | **SNOW COVER** | 60/50/40 s | the burrow ([Prone](prone-under-the-snow.md), which only this key opens): the cast kneels and calls `tryProne`, the 60 s clock is paid **on the way under**, and the key again — like every other way back up — rises free. A kneel the snow refuses (still moving, sliding, no snow underfoot) refunds the clock. The well's active tell drains with `p.hide` as the cover builds |

WARRIOR — close pressure, blocking, momentum:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| 1 | **SHIELD WALL** | 9/8.5/8/7.5/7 s | raises a tower shield toward the aim for up to its `rank` `t`, 2.2 s (the cooldown starts when it comes DOWN). Any shot flying into the front arc dies on it (`abShieldBlocks`, checked in the arrow loop before the body); walking drops to 40 % and the weapon is out of hand. **The key again while the wall is up is the SLAM** (`tryAbility` sets `p.castSlam`, the row's `use` branches on it): a `SLAM_CAST` (0.16 s) wind-up with the wedge on the snow, then `abSlam` — `dmg` (8/12/16/20/24), `stun` (1.1 s) and `SLAM_KB` down the face on everything in `SLAM_R`/`SLAM_HALF` (30 px, ±0.85 rad, `unitsInCone`/`structsInCone`, js/sim/actions.js) — and the wall is spent (`abShieldDown`, the cooldown starts). **Mid-charge the same key slams too**: the rush ends on the spot (`rushEnd`, the carried body slammed where it stands) and the wind-up begins there; with no wall up it waits on the shield's cooldown like the raise would. A rush may be cast with the wall up — only the charge itself refuses the other keys |
| 2 | **BULL RUSH** | 12/11.5/11/10.5/10 s | a 0.3 s wind-up with **the line on the snow** for both sides (`RUSH_SPD × RUSH_T` long, stopped at solids, a bar at its end where the slam will be — the body faces the live aim the whole wind-up), then charges the aim line at 300 px/s for 0.42 s (its own movement branch in `updatePlayer`, no i-frames, ramping to speed over `RUSH_RAMP`): the **first rival hit is carried** on the shoulder and **slammed** at the end (a bear is never picked up: the charge stops against it and slams it where it stands) — 10/15/20/25/30 damage + 0.6 s stun, ×1.6 driven into a wall (`rushStep`/`rushEnd`) |
| 3 | **STOMP** | 14/13/12/11/10 s | a leap-stomp at the feet — the ring of `STOMP_R` on the snow through the wind-up, filling in as it nears, and flashed white where it lands (`abFx`): 12/17/22/27/32 damage + radial knockback + a beat of stun in `STOMP_R`, and the **crater** (`craters`) is deep snow that slows rivals crossing it for 4 s |
| 4 | **EXECUTE** | 18/15/12 s | a 0.55 s overhead wind-up with the wedge on the snow (`EXEC_R`/`EXEC_HALF`, 30 px, ±0.75 rad — narrower than the sword), then `abExecute`: every unit in it takes `execDmg` — its `rank` `dmg` (10/20/30) plus `missing` (half) of the life it has already lost, capped at `bonus` (40) extra — so a body the other three keys have worked over is finished, and a full one takes the base. `EXEC_KB` shove; a cut over twice the base is a crit |

ARMATOS, THE LAST STANDARD — the defensive initiator, the first hero with a passive. His rules
live in **[js/sim/armatos.js](../../../js/sim/armatos.js)** (`ARM_AB`, its `armatos` banner), his
pixels in [js/draw/armatos.js](../../../js/draw/armatos.js), his icons in
[js/sprites/armatos.js](../../../js/sprites/armatos.js). He fights with a cut of his own (his `attack` row, the
OATH GREATSWORD: [the basic attack](the-basic-attack.md)), drawn as his own blade, in a body of his own ([hero looks](../sprites.md#hero-looks)), with his side's torn
standard on his back (`drawHeroBack`, a `HERO_BODY_FX` row):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **LEGION'S RESOLVE** | — | damage taken fills `p.resolve` (`RESOLVE_FULL`, 30% of max hp, for a full bar; it drains after `RESOLVE_IDLE_T` without a hit). Full, the next key cast gives a shield of `RESOLVE_SHIELD` (14%) of max hp for `RESOLVE_SHIELD_T` (4 s), `shieldUnit` (`p.wardHp`, spent in `damagePlayer` after the dawn shield). The standard's cloth fills gold with it. `HERO_PASSIVE`, reached through `passiveHurt`/`passiveCast`/`passiveTick` |
| 1 | **IRON VERDICT** | 8/7.5/7/6.5/6 s | a line slam `VERDICT_LEN` long, ±`VERDICT_HALF` (`unitsInLine`), the box on the snow through the wind-up with its middle hashed gold: `dmg` (14/19/24/29/34) + `slow` for `slowT` on all in it, and those in the middle stretch (`VERDICT_MID`) are knocked up `up` instead (`knockUp`) |
| 2 | **HOLD THE LINE** | 12/11.5/11/10.5/10 s | a brace for `t` (the shield-wall state, `wall: true`): blows from the front take `cut` less (`holdTaken`, a `HERO_TAKEN` fold in `damagePlayer`). A rival hero's hit primes the bash (`p.holdHit`, the trim goes gold); the key again bashes the wedge ahead (`armBash`): `dmg` (10/14/18/22/26), shoved `BASH_KB`, and stunned `stun` only when primed |
| 3 | **VETERAN'S MARCH** | 14/13/12/11/10 s | a charge (the rush state with `p.dash = 'march'`, `HERO_DASH`) at `MARCH_SPD` for `MARCH_T`: lesser bodies are shoved aside once each for `shove` (5; `marchStep`, `MARCH_SHOVE`), and the first rival hero (or an anchored body) stops it: `dmg` (12/16/20/24/28) and `stun` (`marchEnd`) |
| 4 | **THE OLD GUARD** | 80/70/60 s | plants the standard (`guards`, one per owner, carrying the rank's numbers) for `t`: allies inside `GUARD_R` gain `armor` (40/60/80; `guardStat`, a `HERO_STAT` row read by `statOf`) and `ten` tenacity (`guardTen`); a rival who was inside and steps out (caught up to `GUARD_EDGE` past the rim, so a roll out still counts) is slowed `slow` for `slowT` (`updateGuards`) |

FORTIVA, THE UNBROKEN — the juggernaut who wins the long fight, the second hero with a passive.
Her rules live in **[js/sim/fortiva.js](../../../js/sim/fortiva.js)** (`FORT_AB`, its `fortiva`
banner), her pixels in [js/draw/fortiva.js](../../../js/draw/fortiva.js), her icons, looks and
blade in [js/sprites/fortiva.js](../../../js/sprites/fortiva.js). She has the most health of anyone
and a step less speed than the warrior, so a hero who keeps away can beat her. Her cut is the
warrior's (her `attack` row, the CHAIN GREATSWORD), drawn as her own blade, in a body of her own
([hero looks](../sprites.md#hero-looks)); what her state wears on her body (high-resolve
glints, the shield's shell, the after's embers) is `drawFortBody`, a `HERO_BODY_FX` row:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **UNBROKEN** | — | hero damage she deals or takes fills `p.resolve` (`unbFeed`; `UNB_FULL`, half her max hp traded, for a full bar; it drains `UNB_DRAIN` a second after `UNB_IDLE_T` without a trade). From `UNB_HIGH` she has `UNB_TEN` tenacity (a `HERO_TEN` row) and her basic attacks heal her `UNB_HEAL` of what they deal (`o.basic` in the `deal` hook). `HERO_PASSIVE.unbroken`: `hurt`, `deal`, `tick`, `out` |
| 1 | **SEVER THE CHAINS** | 7/6.5/6/5.5/5 s | a wide arc, `SEVER_R` and ±`SEVER_HALF` (`unitsInCone`), wedge on the snow with its outer band hashed gold: `dmg` (14/19/24/29/34), ×`SEVER_EDGE_MUL` past `SEVER_EDGE`, and each rival hero the edge catches (up to `SEVER_HEAL_N`) heals her `SEVER_HEAL` + `SEVER_HEAL_HP` of max hp |
| 2 | **DEFIANT HEART** | 13/12/11/10/9 s | a shield of `shieldHp` (12-20%) of max hp (`shieldUnit`) for `DEFY_T`; when it breaks or runs out (`defyRelease`) a shockwave in `DEFY_R` deals `dmg` (8/12/16/20/24) + `DEFY_PAY` of what the shield absorbed |
| 3 | **BREAK THE YOKE** | 10/9.5/9/8.5/8 s | a lunge (`p.dash = 'yoke'`, `HERO_DASH`) at `YOKE_SPD` for `YOKE_T` that stops on the first rival hero, then a ground strike (`yokeStrike`) in `YOKE_R`: `dmg` (12/16/20/24/28) and a `slow` slow for `slowT`; a rival hero hit gives back `YOKE_REFUND` of the cooldown |
| 4 | **NO KNEELING** | 90/80/70 s | a leap (`p.dash = 'vault'`) to the aim, at most `NOKNEEL_RANGE`; a wall stops it short and a stun drops her where she is. Landing (`noKneelLand`): `dmg` (30/45/60) in `NOKNEEL_R`, knocked up `up` within `NOKNEEL_UP_R`, then for `NOKNEEL_T` she has `NOKNEEL_TEN` tenacity and `NOKNEEL_AD` + `NOKNEEL_AD_LV` per level attack damage (a `HERO_STAT` row) |

BELLA, THE IMPERIAL GENERAL — the duelist who finds one weakness and spends it first, the third hero
with a passive. Her rules live in **[js/sim/bella.js](../../../js/sim/bella.js)** (`BELLA_AB`, its
`bella` banner), her pixels in [js/draw/bella.js](../../../js/draw/bella.js), her icons, looks and
blade in [js/sprites/bella.js](../../../js/sprites/bella.js). She is quick and light (104 hp, 16
armor, a step faster than the warrior) with a quicker, shorter cut (her `attack` row, the EAGLE
SPATHA), drawn as her own blade, in a body of her own ([hero looks](../sprites.md#hero-looks)).
What her state puts on a body (her pips, the parry's blade, the marks) is `drawBellaMarks`, a
`HERO_MARK` row; the duel's ring under the hero she called out is a `HERO_GROUND` row. Her two
dashes pass through the small bodies a roll passes (`through` on the `HERO_DASH` row,
`heroDashThrough` in `separateUnits`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **CALCULATED STRIKES** | — | each basic attack on a rival hero adds a stack of `p.prec` (`PREC_MAX`, 3; they fall away after `PREC_IDLE` without a hero hit). Full, the next key spends them: its blows for `EDGE_T` deal `EDGE_DMG` + `EDGE_AD` of her damage more, and she walks ×`EDGE_MS` for `EDGE_MS_T` (`bellaMoveMul`, a `HERO_MOVE` row). The same `deal` hook pays OUTMANEUVER's mark. `HERO_PASSIVE.calculated`: `deal`, `tick`, `out` |
| 1 | **FIRST CUT** | 7/6.5/6/5.5/5 s | a lunge (`p.dash = 'lunge'`) `LUNGE_LEN` ahead at `LUNGE_SPD`, cutting every rival body within `LUNGE_R` of the path once (`lungeStep`): `dmg` (12/17/22/27/32); the first rival hero cut gives back `LUNGE_REFUND` of the cooldown, once a cast |
| 2 | **PERFECT PARRY** | 10/9.5/9/8.5/8 s | a stance for `t`: the first rival hero's blow is cut by `cut` (`parryTaken`, a `HERO_TAKEN` fold) and, within `PARRY_REACH`, answered (`bellaRiposte`): `dmg` (14/19/24/29/34) and a `stun` stun |
| 3 | **OUTMANEUVER** | 9/8.5/8/7.5/7 s | refused without a rival body within `OUT_PICK` of the aim and `OUT_RANGE` of her (`slipTarget`, the row's `ok`); she slips through it (`p.dash = 'slip'`) to `OUT_PAST` beyond, dealing `dmg` and marking it for `mark`: her next basic attack on it deals `markDmg` (12/18/24/30/36) + `OUT_BONUS_AD` of her damage more |
| 4 | **THE FINAL GAMBIT** | 70/60/50 s | calls out a rival hero within `DUEL_RANGE` (`duelTarget`) for `t`: she walks ×`DUEL_MS` toward them. The key again (`recast`, refused past `FLURRY_REACH`) closes in and strikes `FLURRY_N` times `FLURRY_GAP` apart (`bellaStrike`): `FLURRY_DMG`, then a finisher of `dmg` (18/30/42) + `missing` of the life they are missing |

IGNIA, THE FIREMAGE — the first mage: she burns a fight down, slowly, and the snow and the creek
put her out. Her rules live in **[js/sim/ignia.js](../../../js/sim/ignia.js)** (`IGNIA_AB`, its
`ignia` banner), her pixels in [js/draw/ignia.js](../../../js/draw/ignia.js), her icons and looks in
[js/sprites/ignia.js](../../../js/sprites/ignia.js). She is fragile (84 hp, 10 armor) and shoots
from her CROOK AND LANTERN (her `attack` row: a slow ember, `look: 'ember'`), carried upright
(`HERO_STAVES`, [hero looks](../sprites.md#hero-looks)). Every fire her keys light is the shared
burn (`igniteUnit`, through `igniaLight` or a blow's `burn: [s, dps]` in `hurtUnit`) at a rate of
the rank's `burn` + `IGNIA_BURN_AP` of her ABILITY POWER + `IGNIA_BURN_AD` of her DAMAGE
(`igniaBurnRate`), and marks the body as hers (`kindleBy`). Burns are slow by design: her blows
are small, the fire does the work. BRUSHFIRE's line and melted strip are a `HERO_GROUND` row, the
sparks of WARM HANDS a `HERO_BODY_FX` row; `brushfires` is sim state (`SAVE_ROOTS`, the snapshot):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **SPREADING FLAME** | — | every `SPREAD_EVERY` steps (`updateKindling`, a `HERO_TICK` row) a body burning on her fire lights each rival within `SPREAD_R` that is not already burning, at its own rate and time left. Water puts it out where it stands, and so does deep snow unless a brushfire has melted it there (`igniaDoused`, then `douseUnit`). Soldiers and beasts burn and spread too. `HERO_PASSIVE.spreadflame`: `deal`, `tick`, `out` |
| 1 | **FIREBRAND** | 7/6.5/6/5.5/5 s | a burning stick thrown down a line (`igniaBrand`: a shot with `look: 'brand'`), `BRAND_RANGE` at `BRAND_SPD`; the first rival it hits takes `dmg` and burns `burn` (5/7/9/11/13) a second for `BRAND_BURN_T` |
| 2 | **BRUSHFIRE** | 12/11.5/11/10.5/10 s | a line of fire `BRUSH_LEN` long, across the aim at most `BRUSH_RANGE` away, for `t`; a rival on it (`brushTouch`) burns `burn` (6/8/10/12/14) a second, refreshed for `BRUSH_BURN_T` while they stand there. The strip it melts lingers `BRUSH_MELT` after (drawn; it also lets her fire burn in deep snow beside it) |
| 3 | **WARM HANDS** | 14/13/12/11/10 s | for `WARM_T` (`p.warmT`) the next key she casts burns ×`WARM_HOT` (`igniaHeat`, spent by that key), and she walks `walk` (15-35%) faster (`igniaMoveMul`, a `HERO_MOVE` row) |
| 4 | **WILDFIRE** | 90/75/60 s | a ring `WILD_R` around the aim (at most `WILD_RANGE`): every rival inside not across water (`waterBetween`) takes `dmg` (20/35/50) and burns `burn` (16/24/32) a second for `WILD_BURN_T`; for `t` its flames jump `WILD_JUMP_R` between rivals and ignore the snow (`wildT`), but never across the creek |

AURA, THE NORTHERN LIGHT — the far, patient mage: artillery. Her rules live in
**[js/sim/aura.js](../../../js/sim/aura.js)** (`AURA_AB`, its `aura` banner), her pixels in
[js/draw/aura.js](../../../js/draw/aura.js), her icons and staff art in
[js/sprites/aura.js](../../../js/sprites/aura.js). The least life of anyone (78 hp, 9 armor) and a
step slower than anyone, she shoots a star bolt (her `attack` row, the STAR SHARD, drawn as her own
shot through its `look`; the shard is carried upright, `HERO_STAVES`) and strikes from further than any key in the game: slowly, and in plain
view, since everything she casts is on the snow for both sides until it lands. Her strikes are
things she leaves in the world (`auraStars`, `auraOrbs`, `auraCurtains`, each carrying the rank
and reach it was cast with), stepped by `updateAuraWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **STARLIGHT** | — | her reaches (the star's range, the orb's drift, the step, the curtain's length) grow with the dark: ×(1 + `STARLIGHT_REACH` × `state.darkness`), a quarter more at full night (`auraReach`). Every rival body one of her keys touches is revealed for `STARLIGHT_T` (`markUnit`: seen through the fog, the woods and the brush, `inSight`). `HERO_PASSIVE.starlight`; the `aim` the range preview draws is the day's |
| 1 | **FALLING STAR** | 9/8.5/8/7.5/7 s | the aim, up to `STAR_RANGE` (300 px) away, is struck `STAR_DELAY` after the cast (`auraStar`, `starStrike`), its ring on the snow the whole time with the star coming down onto it: every rival body in `STAR_R` takes `dmg` (16/24/32/40/48), ×`STAR_CORE_MUL` within `STAR_CORE` of the centre; buildings in it take it too |
| 2 | **DRIFTING LIGHT** | 13/12.5/12/11.5/11 s | an orb drifts from her down the aim at `ORB_SPD` for `ORB_LEN`, through trees and walls (`updateAuraOrbs`): every rival body within `ORB_R` is slowed to `slow` (×0.7/0.65/0.6/0.55/0.5), held `ORB_SLOW_T` after it passes, and revealed. No damage |
| 3 | **STEP OF LIGHT** | 18/17/16/15/14 s | a blink down the aim, `STEP_LEN` (a hero dash so fast it lasts a few frames, `p.dash = 'step'`: a wall or the water's edge stops it short). Every rival body within `STEP_R` of where she stood is slowed ×`STEP_SLOW` for `slowT` (1/1.25/1.5/1.75/2 s). A bot spends it when a hero reaches her, aimed away (the row's `botAim`) |
| 4 | **THE CURTAIN** | 110/95/80 s | a band `CURTAIN_LEN` (900 px) long down the aim from where she stands falls `CURTAIN_DELAY` after the cast (`auraCurtain`, `curtainFall`), its edges on the snow brightening until then: every rival body within `CURTAIN_SEE` of it is revealed, struck or not, and those within `CURTAIN_HALF` take `dmg` (70/110/150); buildings under it too |

Bots play the named heroes through each row's `bot(p, foe, d, clear)` (`abBotKey`, asked by the ladder's
ability block in js/ai/ai-ladder.js); a row's `botAim(p, foe)` turns the aim to a point of its own for that cast (AURA's step away). A hero whose rows carry no `bot` keeps the ladder's old range rules.

Every wind-up with an area is **telegraphed on the snow for both sides** (`drawAbilityGround`): the
pierce's and the charge's marching line, the stomp's ring, the slam's and the execute's wedge — in
`TELE_COL` red, `TELE_HOT` gold for the last quarter, the inside hashing in as the landing nears
(`castProg`, off `p.castMax`) — and every landing flashes the same shape in the blow's own colour
for `AB_FX_T` (`abFx`, ticked in `updateAbilityWorld`). The shapes are `drawWedge`/`drawRing`/
`drawTeleLine`, and the sword's sweep (`drawSlashes`, called from js/draw/render.js beside the E swing
arcs) is the same wedge. A telegraphed cast keeps the body facing the live aim the whole wind-up
(`updateAbilities`), so the shape and the body agree about where it is going.

A player's movement caps fold through one function — `abilityMoveMul(p)`: root pins, cast/shield/net/
crater drag (the pierce windup's own harder drag included) — applied to the walk
cap **and** the ice cap in `updatePlayer`; the grapple's reel is its own movement branch there,
beside the rush's. An
animal or a bot folds the same root and slow through `unitMoveMul(e)`, spent inside `navStep`.
All damage passes its `src`, so an ability kill credits like an arrow — a net whose
caster has since gone down credits nobody (`abCredit`) rather than a corpse. Bots spend abilities in
the ladder's fight rung (`aiThink`), off cooldown at ranges each is good at (the grapple is the one they skip —
a held key and a terrain read the ladder does not try to fake). The strip's ability wells (icons,
cooldown wipes) are the HUD's half and live with it in [rendering.md](../rendering.md).
