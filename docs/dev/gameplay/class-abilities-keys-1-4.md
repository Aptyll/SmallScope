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
| 3 | STOMP | **LEG SWEEP** — the wedge ahead (`HAM_R`/`HAM_HALF`) cut for `dmg` and rooted `root` (its `rank`) (`abSweep`) |
| 4 | FINISHING BLOW | **SECOND WIND** — `rank` `heal` (30/40/50%) of max hp back over `t` (4 s), paid out each tick by `updateAbilities` (`p.windT`/`p.windRate`, `abSecondWind`); the strip's active tell |

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
yoke, heart; AURA star, orb, step; SALVIA poultice, cloak, snowdrops; LUCERNA crook, shoo, lantern; RUPES heave, shed, shoulder; NIX shard, drift step, cloud; VARRO lunge, snap, howl; BUCINA note, blast, echo; VELOX skip stone, quick step, ice lane). The cd column in the tables below is every rank's; the numbers in the text are rank
1's, and each row's `rank` table has the rest.

**Every ability lands on every kind of body.** A player, a rabbit, a deer, a bird, a wolf and a
[soldier](robots.md) take the same damage and the same states from every key — the
tables below say "rival" because that is who you are usually casting at, not because anything else
is exempt. That is not written into each ability: they sweep `unitsNear`/`unitsHit` and land through
`hurtUnit` and the state setters ([status effects](status-effects-one-set-for-every-unit.md)), so the
next kind of neutral fauna pushed into `animals` is in range of every key on the day it is added,
with no edit here. A **structure** is not a unit, so it takes no state — but a rival's building
takes the *damage* of every blow with an area, through `hurtStruct` (`STRUCT_DR` off): the SLAM and
the FINISHING BLOW sweep `structsInCone`, the STOMP `structsNear`, the BULL RUSH's wall slam and the NET
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
| 4 | **FINISHING BLOW** | 18/15/12 s | a 0.55 s overhead wind-up with the wedge on the snow (`EXEC_R`/`EXEC_HALF`, 30 px, ±0.75 rad — narrower than the sword), then `abFinish`: every unit in it takes `execDmg` — its `rank` `dmg` (10/20/30) plus `missing` (half) of the life it has already lost, capped at `bonus` (40) extra — so a body the other three keys have worked over is finished, and a full one takes the base. `EXEC_KB` shove; a cut over twice the base is a crit |

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

IGNIA, THE HEARTHKEEPER — the first mage: she burns a fight down, slowly, and the snow and the creek
put her out. Her rules live in **[js/sim/ignia.js](../../../js/sim/ignia.js)** (`IGNIA_AB`, its
`ignia` banner), her pixels in [js/draw/ignia.js](../../../js/draw/ignia.js), her icons and looks in
[js/sprites/ignia.js](../../../js/sprites/ignia.js). She is fragile (84 hp, 10 armor) and shoots
from her CROOK AND LANTERN (her `attack` row: a slow ember, `look: 'ember'`), carried upright
(`HERO_STAVES`, [hero looks](../sprites.md#hero-looks)). Every fire her keys light is the shared
burn (`igniteUnit`, through `igniaLight` or a blow's `burn: [s, dps]` in `hurtUnit`; a blow's `slow: [s, mul]` is put on the same way, RUPES's HEAVE) at a rate of
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

SALVIA, THE MENDER — the healer. Her rules live in
**[js/sim/salvia.js](../../../js/sim/salvia.js)** (`SALVIA_AB`, its `salvia` banner), her pixels in
[js/draw/salvia.js](../../../js/draw/salvia.js), her icons and staff art in
[js/sprites/salvia.js](../../../js/sprites/salvia.js). 80 hp, 10 armor, almost no damage of her own: a
green sprig off her SNOWDROP STAFF (her `attack` row, drawn as `look: 'sprig'`; the staff is carried upright,
`HERO_STAVES`). Every heal she gives goes through `salviaHeal` (`healPlayer`, the green number), on
ally players only; a heal's size is its `hp` plus her ability power × the row's `ap` (`abDmg`). What
she leaves in the world (`salviaBundles`, `salviaDrops`, `salviaThaws`, each carrying the heal it was
cast with) is stepped by `salviaWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **WARM BROTH** | — | every heal of hers also lends the healed `BROTH_WALK` (+15%) walk for `BROTH_T` (`p.brothT`, a `HERO_MOVE` row) and takes their slows off (`salviaUnslow`: the slow and the net's drape). `HERO_PASSIVE.warmbroth` |
| 1 | **POULTICE** | 9/8.5/8/7.5/7 s | a bundle flies down the aim `POULTICE_RANGE` (210 px) at `POULTICE_SPD` (`updateBundles`); a wall or a tree ends it. The first ally player it meets (not her) is healed `hp` (45/65/85/105/125); the first rival body (a hero, a soldier, a beast) is slowed ×`POULTICE_SLOW` for `POULTICE_SLOW_T`, no damage |
| 2 | **SNOWDROPS** | 14/13/12/11/10 s | `DROP_N` snowdrops planted round the aim, at most `DROP_RANGE` from her (the warren's clump art); an ally player (her too) who walks over one while hurt picks it and is healed `hp` (30/40/50/60/70). Unpicked, they wilt after `DROP_LIFE`; past `DROP_MAX` of hers the oldest go first |
| 3 | **WARM CLOAK** | 16/15/14/13/12 s | the ally player nearest the aim (within `CLOAK_PICK` of it and `CLOAK_RANGE` of her), else herself, gets a `shield` (40/60/80/100/120) for `CLOAK_T` (`shieldUnit`) and walks ×`CLOAK_WALK` for `CLOAK_RUN_T` (`p.cloakT`) |
| 4 | **THAW** | 100/85/70 s | a ring `THAW_R` (80 px) round where she stands, for `THAW_T`: every ally player inside sheds every slow each step, and is healed `hps` (30/45/60) at once and every `THAW_EVERY` after |

Her rows' `botAim` point a bot's heals at the most hurt ally in reach (`salviaNeedy`); a bot throws the
poultice at a rival when nobody needs it, and keeps THAW for one ally nearly down or two hurt.
HIEMS, THE LONG WINTER — the control mage. Her rules live in
**[js/sim/hiems.js](../../../js/sim/hiems.js)** (`HIEMS_AB`, its `hiems` banner), her pixels in
[js/draw/hiems.js](../../../js/draw/hiems.js), her icons, looks and staff art in
[js/sprites/hiems.js](../../../js/sprites/hiems.js). 82 hp, 10 armor, a step slower than most; a
frost bolt from her SNOWFLAKE STAFF (her `attack` row, drawn through its `look`). Little burst:
she freezes a fight and lets her side finish it. What she leaves in the world (`hiemsGlazes`,
`hiemsStorms`, each carrying its rank) is stepped by `updateHiemsWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **DEEP CHILL** | — | every blow of hers (her keys and her staff, `hiemsDeal` on `HERO_PASSIVE.deepchill`'s `deal`) chills the rival body: a stack held `CHILL_WINDOW`, slowing ×0.85 at one and ×0.7 at two (`hiemsChill`). The third freezes it in place for `FREEZE_T` (a stun, so tenacity cuts it; the ice is drawn round it, `frozeT`), and for `FREEZE_IMMUNE` after its chills stop at two. Soldiers and beasts chill too |
| 1 | **ICICLE** | 8/7.5/7/6.5/6 s | a shard down the aim (`ICICLE_SPD` for `ICICLE_RANGE`, riding `arrows`): the first rival takes `dmg` (14/20/26/32/38), is slowed ×`ICICLE_SLOW` for `ICICLE_SLOW_T` and chilled |
| 2 | **CLEAR ICE** | 15/14/13/12/11 s | a disc `GLAZE_R` at the aim (at most `GLAZE_RANGE`) turns to ice for `t` (3/3.5/4/4.5/5 s): a rival hero on it skates as on the creek's ice (`HERO_ICE`, read by `iceUnder`), and every rival body on it walks ×`GLAZE_SLOW`. Her own side walks it as snow. No damage |
| 3 | **COLD SNAP** | 12/11.5/11/10.5/10 s | a burst `SNAP_R` at the aim (at most `SNAP_RANGE`): every rival already chilled is rooted `root` (1 s), then every rival inside takes `dmg` (12/18/24/30/36) and is chilled; buildings take it too |
| 4 | **WHITEOUT** | 100/85/70 s | a blizzard `WHITE_R` round her for `WHITE_T`, riding her: rivals inside walk ×`WHITE_SLOW`, and once a second take `dmg` (10/16/22) and a chill. A rival hero inside sees only `WHITE_SEE` (a fifth) of their reach (`HERO_SIGHT`, read by `heroEyeR`): their side's other eyes still see |

RUPES, THE AVALANCHE — the engage tank. His rules live in
**[js/sim/rupes.js](../../../js/sim/rupes.js)** (`RUPES_AB`, its `rupes` banner), his pixels in
[js/draw/rupes.js](../../../js/draw/rupes.js), his icons, looks and maul in
[js/sprites/rupes.js](../../../js/sprites/rupes.js). 134 hp and 24 armor, two steps slower than
the hunter, and little damage: his ICE MAUL is the longsword's cut a little slower (`cycle` 34/60 s)
with a harder shove. Everything he does rides `p.pack`, his snowpack (0..1, `PACK_LAYERS` layers):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **SNOWPACK** | — | a hit he takes from anyone packs it (`dmg / (maxHp × PACK_FILL)`, `packHurt`); walking through deep snow packs `PACK_DEEP` a second (`packTick`); after `PACK_IDLE_T` without either it melts at `PACK_MELT` a second. Full, every hit he takes is cut by `PACK_CUT` (15%, `packTaken`, a `HERO_TAKEN` row). Each layer shows as white crust on his shoulders, arms and crown (`drawPackCrust`). `HERO_PASSIVE.snowpack` |
| 1 | **HEAVE** | 8/7.5/7/6.5/6 s | a block of snow thrown down the aim (a shot, `look: 'snowblock'`, `HEAVE_RANGE` 150 px): the first rival body takes `dmg` (14/20/26/32/38) and is slowed ×`slow` for `slowT` (the shot's `slow`, put on by `hurtUnit`). A hero hit packs him `HEAVE_PACK` (a layer, `packDeal`) |
| 2 | **SHED** | 10/9.5/9/8.5/8 s | the pack shaken off (`rupesShed`, `p.pack` to 0): every rival body and building in `SHED_R` takes `dmg` (10/14/18/22/26) plus `layer` (8/11/14/17/20) for each layer shed, and is slowed ×`slow` for `slowT` × (1 + half a layer) |
| 3 | **SHOULDER** | 13/12/11/10/9 s | a short charge (`p.dash = 'shoulder'`, `SHOULDER_SPD` for `SHOULDER_T`): the first rival body met takes `dmg` (12/18/24/30/36) and is thrown `SHOULDER_KB` the way he ran; a tree or a wall (any `isSolidTile`) within `SHOULDER_PIN` behind it (`solidBehind`) stuns it `stun` (1 s). A bear nothing shoves is struck, not thrown |
| 4 | **AVALANCHE** | 100/85/70 s | he rolls as a snowball (`p.dash = 'avalanche'`, up to `AVA_T`), from `AVA_SPD0` to `AVA_SPD1` as it grows, bending toward the aim at `AVA_STEER`; `p.avaD` is how far it has rolled (`avaGrow`). Soldiers and beasts are thrown aside; on the first hero (or a bear), a wall, or the clock it bursts (`avaBurst`): every rival body and building in a ring from `AVA_R0` to `AVA_R1` (by the roll) takes `dmg` (50/85/120) and is knocked up `up` (0.6/0.75/0.9 s) × (1 + `AVA_UP_GROW` × the growth). He comes out of it fully packed. Drawn as the ball in his place (`HERO_BODY_DRAW`) |

FABER, THE TINKER — the zone mage. His rules live in
**[js/sim/faber.js](../../../js/sim/faber.js)** (`FABER_AB`, its `faber` banner), his pixels in
[js/draw/faber.js](../../../js/draw/faber.js), his icons, looks and staff art in
[js/sprites/faber.js](../../../js/sprites/faber.js). 80 hp, 10 armor, slower than most; a brass cog
from his CLOCK STAFF (his `attack` row, drawn through its `look`). He holds a spot: his damage is
spread over machines he winds, and he is poor at a chase. His machines are bodies in `robots`
(`HERO_MACHINE`, js/sim/heroes.js), so towers, soldiers and every weapon hit them, and a rival who
breaks one is paid its `pay`. What else he leaves in the world (`faberParts`, `faberArcs`,
`faberBolts`, `faberSprings`) is stepped by `updateFaberWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **SPARE PARTS** | — | a body in `robots` broken within `PART_NEAR` (180 px) of him (a soldier of either side, or a machine) leaves a part on the snow for `PART_LIFE` (`HERO_WRECK`, `faberWreck`); walking over it takes `PART_CUT` (1 s) off each of keys 1-3's waits. At most `PART_MAX` of his lie at once. `HERO_PASSIVE.spareparts` |
| 1 | **SPARK** | 7/6.5/6/5.5/5 s | a spark down the aim (`SPARK_SPD` for `SPARK_RANGE`, riding `arrows`): the first rival takes `dmg` (16/24/32/40/48), and the step after it jumps to the nearest other rival within `ARC_R` for `ARC_SHARE` (60%) of the blow (`faberDeal` queues it, `updateArcs` lands it) |
| 2 | **WIND A MACHINE** | 14/13/12/11/10 s | a small gun set at the aim (at most `WINDER_PLACE`), `WINDER_HP` + `WINDER_HP_LV` a level, running `WINDER_LIFE`: every `WINDER_CD` it shoots the nearest rival within `WINDER_RANGE` (`robotFoeUnit`) with a bolt that follows its mark for `dmg` (9/12/15/18/21). Two at once; a third winds down the oldest. A rival who breaks one gets 20 gold |
| 3 | **CLOCKSPRING** | 16/15/14/13/12 s | a trap at the aim (at most `SPRING_RANGE`), wound after `SPRING_ARM`, waiting `SPRING_LIFE`: the first rival hero within `SPRING_R` is rooted `root` (1/1.15/1.3/1.45/1.6 s) and takes `dmg` (20). Soldiers and beasts walk over it. Three at once; a rival sees one only where their side sees |
| 4 | **THE OLD ENGINE** | 110/95/80 s | a big machine wound up at his side for `ENGINE_LIFE`, `ENGINE_HP` + `ENGINE_HP_LV` a level: it walks (`navStep`) to his aim, no further than `ENGINE_LEASH` from him, and every `ENGINE_SLAM_EVERY` (the first after `ENGINE_SLAM_FIRST`) with a rival within `ENGINE_SLAM_R` it slams: each is stunned `stun` (0.75 s) and takes `dmg` (50/85/120); buildings take it too. While it runs his small guns shoot `ENGINE_HASTE` (twice) as fast. A rival who breaks it gets 50 gold |

LUCERNA, THE LANTERN — the catch-and-save support. Her rules live in
**[js/sim/lucerna.js](../../../js/sim/lucerna.js)** (`LUCERNA_AB`, its `lucerna` banner), her pixels in
[js/draw/lucerna.js](../../../js/draw/lucerna.js), her icons, looks and lantern art in
[js/sprites/lucerna.js](../../../js/sprites/lucerna.js). 88 hp, 12 armor, little damage: a spark off
her LANTERN (her `attack` row, drawn as `look: 'lampspark'`; the lantern hangs from her hand,
`HERO_STAVES`). She has the game's only pull: `lucernaPull` draws a body along the snow at
`PULL_SPD` to a spot (`p.pullT`, stepped by `stepPulls` through `moveEntity`, so a wall stops it),
and a rival is held (`stunUnit`) while it travels. What she leaves in the world (`lucernaHooks`,
`lucernaLanterns`, `lucernaCircles`) is stepped by `lucernaWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **LAMPLIGHT** | — | every rival body within `LAMP_R` (56 px) of her is shown (`markUnit`: through the fog, the woods and the brush) and stays shown `LAMP_SEE_T` after leaving it (`lucernaTick`); an ally player inside (her too) sees ×(1 + `LAMP_NIGHT` × `state.darkness`) further, a third more at full night (`lucernaSight`, a `HERO_SIGHT` row). `HERO_PASSIVE.lamplight` |
| 1 | **SHEPHERD'S CROOK** | 14/13/12/11/10 s | a hook flies down the aim `CROOK_RANGE` (170 px) at `CROOK_SPD`, past allies (`updateHooks`); a wall or a tree ends it. The first rival body it meets (a hero, a soldier, a beast) takes `dmg` (20/35/50/65/80) and is pulled to `CROOK_STOP` from her, then walks ×`CROOK_SLOW` for `CROOK_SLOW_T` |
| 2 | **LANTERN** | 18/17/16/15/14 s | her lantern lands at the aim, at most `LANTERN_RANGE` from her, one at a time (`lucernaThrow`). An ally player who walks within `LANTERN_R` of it takes it and is pulled to her side, not held; rivals within `LANTERN_SEE` of it are shown. Untaken, it comes back after `t` (4/4.5/5/5.5/6 s) (`updateLanterns`). A bot throws it at an ally hero who is hurt with a rival close (`lucernaInDanger`, the row's `botAim`) |
| 3 | **SHOO** | 10/9.5/9/8.5/8 s | a swing of the crook `SHOO_REACH` in front of her, `SHOO_HALF` either side of the aim: every rival body in it takes `dmg` (15/25/35/45/55) and is shoved `SHOO_KB` (`hurtUnit`'s `kb`); buildings in it take the blow |
| 4 | **CIRCLE OF LIGHT** | 100/85/70 s | a ring `CIRCLE_R` (92 px) round where she stands, for `CIRCLE_T`: every rival inside is shown, and one within `CIRCLE_EDGE` of the rim walks ×`slow` (0.45/0.35/0.25) for `CIRCLE_SLOW_T` (`updateCircles`) |

BUCINA, THE HORN — the tempo support. Her rules live in
**[js/sim/bucina.js](../../../js/sim/bucina.js)** (`BUCINA_AB`, its `bucina` banner), her pixels in
[js/draw/bucina.js](../../../js/draw/bucina.js), her icons, looks and horn art in
[js/sprites/bucina.js](../../../js/sprites/bucina.js). 92 hp, 14 armor, no heals and no shields: a
note off her HORN (her `attack` row, drawn as `look: 'hornnote'`; the horn is carried upright,
`HERO_STAVES`). What she leaves in the world (`bucinaEchoes`, `bucinaCalls`) and the clocks she
lends (`p.heardT`, `p.rallyT`) are stepped by `bucinaWorld` (`HERO_TICK`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **HEARD** | — | whenever one of her keys strikes a rival body, every ally player within `HEARD_R` (150 px) of her, her too, walks ×`HEARD_WALK` for `HEARD_T` (`bucinaHeard`, `p.heardT`, a `HERO_MOVE` row). `HERO_PASSIVE.heard` |
| 1 | **HORN BLAST** | 10/9.5/9/8.5/8 s | a cone `BLAST_REACH` (78 px) in front of her, `BLAST_HALF` either side of the aim: every rival body in it takes `dmg` (15/25/35/45/55), is shoved `BLAST_KB` and walks ×`BLAST_SLOW` for `BLAST_SLOW_T`; buildings in it take the blow |
| 2 | **RALLYING NOTE** | 16/15/14/13/12 s | every ally player within `RALLY_R` (110 px), her too, for `RALLY_T`: attack speed +`as` (20/25/30/35/40%, a `HERO_STAT` 'as' row: a share on `asMul`, like an item's) and `RALLY_TEN` tenacity (`bucinaTen`, a `HERO_TEN` row) |
| 3 | **ECHO** | 13/12.5/12/11.5/11 s | a wave down the aim `ECHO_RANGE` (210 px) at `ECHO_SPD` (`updateEchoes`). A wall or a tree turns it round once, to run back as far as it came. Each pass strikes each rival body once for `dmg` (20/32/44/56/68); one struck going and coming is stunned `ECHO_STUN` |
| 4 | **SHAKE THE PINES** | 100/85/70 s | every pine within `PINES_R` (190 px) sheds its snow (`shedHit`, js/sim/shed.js; at most `PINES_PUFFS` seen to puff). Every rival body standing within `PINES_UNDER` of a pine's foot inside is stunned `stun` (0.75/1/1.25 s) (`bucinaUnderPine`); every rival in the woods inside (`inWoods`) is shown for `PINES_SEE_T` |

A bot rallies with two allies near and a rival hero close, and keeps SHAKE THE PINES for a rival hero under a pine or in the woods.
VARRO, THE WOLF-KEPT — the jungler: a diver who picks one rival and closes the ring on them. His
rules live in **[js/sim/varro.js](../../../js/sim/varro.js)** (`VARRO_AB`, its `varro` banner), his
pixels in [js/draw/varro.js](../../../js/draw/varro.js), his icons, looks and spear in
[js/sprites/varro.js](../../../js/sprites/varro.js). 112 hp, 18 armor, a step faster than a walk; his
HUNTING SPEAR is a cut a touch longer and narrower than the longsword's. His wolves are real wolves:
`animals` of kind `wolf` with his `team` and `owner` and `summon: 'pack'`, walked by
`HERO_SUMMON.pack` (`wolfStep`), so every blow, area and shot that finds a beast finds them, his
own side's do not, and their bars are in his side's colour (`drawBeastFrame`). A summon pays
nobody when it falls (`animalDies`).

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **THE PACK** | — | every wolf within `WOLVES_R` of him, his or a den's (never a rival's), adds `WOLVES_AS` attack speed, `WOLVES_MAX` at most (`HERO_STAT` 'as', a share folded into `asMul`); his blows on a beast (not a summon) land ×`WOLVES_BEAST`, which is his way through the woods. `HERO_PASSIVE.pack` |
| 1 | **LUNGE** | 8/7.5/7/6.5/6 s | needs a rival body within `LEAP_PICK` of the aim and `LEAP_RANGE` (80 px) of him (`ok`): he leaps at it (`p.dash = 'vleap'`, steering for it), lands `dmg` (14/19/24/29/34) and marks it for `LEAP_MARK_T` (`packBy`, `packUntil`; a paw over its head for both sides). His basic attacks on the mark add `markDmg` (5/7/9/11/13) + `LEAP_BONUS_AD` of his DAMAGE |
| 2 | **HOWL** | 14/13/12/11/10 s | every rival body within `HOWL_R` is shoved out (`HOWL_KB`) and slowed ×`slow` for `slowT` (1/1.25/1.5/1.75/2 s); his called wolves run ×`HOWL_PACK_MUL` for `HOWL_PACK_T`. No damage |
| 3 | **SNAP** | 9/8.5/8/7.5/7 s | needs a rival in `SNAP_REACH` (`ok`): two strikes `SNAP_GAP` apart, each `dmg` (10/14/18/22/26), on his mark if it stands in reach, else the rival nearest the aim; the second slows ×`slow` for `slowT` |
| 4 | **CALL THE PACK** | 90/75/60 s | needs a rival hero within `CALL_PICK` of the aim and `CALL_RANGE` (220 px) of him (`ok`): `CALL_N` wolves come out beside the pine nearest that hero (within `CALL_WOODS` tiles; at his heels in the open, `callSpots`) and hunt only it at `CALL_SPD`, biting `dmg` (5/7/9) every `CALL_BITE_CD` as his blows (`ab: 'call'`). Each has `wolfHp` (40/60/80) health; after `t` (5/5.5/6 s), or when the hero falls, they run off (`CALL_LEAVE_T`) |

NIX, THE SNOWBLIND — the night scout: an assassin of skill and weather, never magic. Her rules
live in **[js/sim/nix.js](../../../js/sim/nix.js)** (`NIX_AB`, its `nix` banner), her pixels in
[js/draw/nix.js](../../../js/draw/nix.js), her icons, looks and dirk in
[js/sprites/nix.js](../../../js/sprites/nix.js). Light (98 hp, 14 armor) and a step faster, with the
quickest, shortest cut (the ICE DIRK). Her shards and clouds are things she leaves in the world
(`nixShards`, `nixClouds`), stepped by `HERO_TICK`. Hidden means hidden from the other side's fog
(`HERO_COVER`, asked by `coverHide`): the rival's bots and screen both
lose her; a mark (`markUnit`: AURA's light, the falcon) still shows her.

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **NIGHT WATCH** | — | she walks ×(1 + `WATCH_MS` × `state.darkness`) (`nixMoveMul`, a `HERO_MOVE` row). Once she has been hidden (her cloud, SQUALL, or out of the other side's sight: `nixHidden`), her next blow on a rival hero adds `WATCH_DMG` + `WATCH_AD` of her DAMAGE, ×(1 + `WATCH_NIGHT` × darkness) (`watchDeal`, the passive's `deal`). Any rival she strikes is one DRIFT STEP can reach for `DRIFT_STEP_MEM` |
| 1 | **ICE SHARD** | 7/6.5/6/5.5/5 s | a shard down the aim, `SHARD_LEN` out: the first rival body (or building) takes `dmg` (18/27/36/45/54); then it flies home to her hand, and caught (`SHARD_CATCH`) gives back `SHARD_REFUND` of the wait (`updateNixShards`) |
| 2 | **SNOW CLOUD** | 18/17/16/15/14 s | a cloud `CLOUD_R` round her feet for `t` (3.5-5.5 s), one at a time. Inside it she is hidden from a side none of whose heroes or soldiers stands in it (`nixCover`); a blow she strikes from it shows her for `CLOUD_OUT`. Both sides see the cloud; her own side sees her in it faintly (`HERO_FADE`) |
| 3 | **DRIFT STEP** | 12/11/10/9/8 s | needs a rival she struck in the last `DRIFT_STEP_MEM` near the aim (`ok`): a cut for `dmg` (10/16/22/28/34), then a quick step (`HERO_DASH.drift`) to `DRIFT_STEP_PAST` behind them, turned to face them (`nixDrift`, `driftEnd`) |
| 4 | **SQUALL** | 80/65/50 s | she vanishes for `WHITEOUT_T`: untouchable (`invuln`) and hidden from both sides' rivals, then comes out beside the nearest rival hero within `WHITE_REACH` and strikes for `dmg` (60/95/130) + `WHITE_AD` of her DAMAGE (`nixWhiteStrike`). If that hero falls within `WHITE_RESET`, the key is ready again once; the cast it gives back cannot give itself back |

VELOX, THE SKATER — the kiting marksman: she throws her sling while she skates and never stands
still. Her rules live in **[js/sim/velox.js](../../../js/sim/velox.js)** (`VELOX_AB`, its `velox`
banner), her pixels in [js/draw/velox.js](../../../js/draw/velox.js), her icons and looks in
[js/sprites/velox.js](../../../js/sprites/velox.js). 82 hp, 10 armor, a step faster than a walk. Her
STAFF SLING throws a shorter, quicker stone than the hunter's arrow, and her kit barely slows her
while she draws (`chargeMul` 0.9) and turns sharply on ice (`iceSteer` 9, `iceMax` 1.25). Her
stones in flight and her lanes are things she leaves in the world (`veloxStones`, `veloxLanes`),
saved and sent like HIEMS's ice.

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **KEEP MOVING** | — | each of her basic hits adds a stack, `KEEP_MAX` at most, each walking ×(1 + `KEEP_MS`) (`HERO_MOVE`); the stacks hold `KEEP_T`, or `KEEP_ICE_T` when she stands on ice. `HERO_PASSIVE.keepmoving` |
| 1 | **SKIP STONE** | 7/6.5/6/5.5/5 s | a stone down the aim at `SKIP_SPD`: it lands every `SKIP_GAP` (`SKIP_ICE_GAP` after a landing on ice: the creek's, or a lane), `SKIP_N` times, and each landing hits every rival body within `SKIP_R` for `dmg` (14/21/28/35/42). A tree or a wall stops it |
| 2 | **ICE LANE** | 16/15/14/13/12 s | a strip `LANE_LEN` long and `LANE_W` wide from her feet down the aim, for `t` (3/3.5/4/4.5/5 s). On her own lane she skates (`HERO_ICE`) ×`LANE_FAST`; a rival body on it skates like the creek's ice; her own side walks it as snow |
| 3 | **QUICK STEP** | 9/8.5/8/7.5/7 s | a dash `QSTEP_D` down the aim (`p.dash = 'vstep'`), out of which she glides; her attack cycle is reset, and for `QSTEP_READY_T` her next draw is full at once and her next basic hit adds `dmg` (6/10/14/18/22) |
| 4 | **LONG RUN** | 100/85/70 s | for `t` (4/5/6 s) she walks ×(1 + `RUN_MS`) and slows, roots and stuns on her last `RUN_TEN` less (`HERO_TEN`); each basic hit throws a second stone (`ab: 'run'`, `dmg` 14/22/30) at the rival body nearest the one hit within `RUN_ECHO_R` |

Bots play the named heroes through each row's `bot(p, foe, d, clear)` (`abBotKey`, asked by the ladder's
ability block in js/ai/ai-ladder.js); a row's `botAim(p, foe)` turns the aim to a point of its own for that cast, held through the wind-up until it lands (AURA's step away, SALVIA's heals, LUCERNA's lantern). A hero whose rows carry no `bot` keeps the ladder's old range rules.

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
