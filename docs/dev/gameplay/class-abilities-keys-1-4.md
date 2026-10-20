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
| 1 | SHIELD WALL | **WAR CRY** — every rival unit within `CRY_R` slowed (`CRY_SLOW` for `CRY_SLOW_T`) and marked (`CRY_MARK_T`) for both maps; nothing hurt (`abWarCry`) |
| 2 | BULL RUSH | **WHIRLWIND** — everything alive within `WHIRL_R` cut for `WHIRL_DMG` and thrown `WHIRL_KB`, buildings cut too (`abWhirlwind`) |
| 3 | STOMP | **HAMSTRING** — the wedge ahead (`HAM_R`/`HAM_HALF`) cut for `HAM_DMG` and rooted `HAM_ROOT` (`abHamstring`) |
| 4 | EXECUTE | **SECOND WIND** — `WIND_HEAL` (30%) of max hp back over `WIND_T` (4 s), paid out each tick by `updateAbilities` (`p.windT`/`p.windRate`, `abSecondWind`); the strip's active tell |

The press goes
through `input.ability` (edge-triggered, like the dodge) into `tryAbility(p, i)`, so a bot casts
through exactly the key a human presses; `updateAbilities(p, dt)` runs the cooldowns, lands the
cast, and ages every state an ability leaves on a body; `updateAbilityWorld(dt)` (called from
`updatePlay`) steps what they leave in the world.

**Abilities are bought with skill points, never gold — and a key you have not bought does
nothing.** Each key starts **LOCKED at level 0**: the class hands you the four actives, not the
use of them. Every level costs **one skill point** — the only thing a point buys, one per
[hero level](../multiplayer.md#hero-levels). The **first** point on a key unlocks it (`abUnlocked(p,
i)`, the one gate: `tryAbility` refuses a level-0 key outright and every bot reaches for keys
through `abReady(p, i)` = bought and off cooldown), and each one after shaves `AB_LV_CD` (12%)
off that ability's cooldown — the one lever that means something on every key, twice at most,
so a capped key comes back 24% faster than a freshly unlocked one. Four keys × `AB_LV_MAX` is
**12 points against the 12 a capped hero earns**, so the ladder ends exactly where the hero does:
every point has a home and nothing is stranded. A row may also carry `lvReq`, the hero level each of its points waits for (ARMATOS's R: 6, 9, 12), checked by `abLvCanBuy`. The choice is the ORDER — you land with one point
and four dark keys, so the first thing a match asks is which ability you want to be, and a key
taken to 3 early is three keys still dark at level 4.
The rest of the set: `abLvCanBuy(p, i)` (a point in hand, room on the key),
`buyAbilityLv(p, i)` (the single entry point, reached through `input.cmd {kind:'ability', i}` →
`runCmd` by HUD plate click and bots alike — the unlock floats `NAME UNLOCKED` and a fatter
burst, every level after floats the number), and `abCdOf(p, i)` — which every cooldown-setting
site reads instead of the table's base `cd` (the cast landing, and the shield's comes-down
reset). `p.abLv` resets with the match (every boot builds fresh `Player`s). The wells carry the progress — fat
buy pips along the top edge, **one seat per point the key can hold**, so an empty row
is a locked ability — and a locked well stands dim (dark rim, the icon at `LOCK_DIM`, a grey key
digit), exactly as a meal button with nothing behind it does; a press on one reddens and shakes
it (`abDenied`, the twin of `foodDenied`). The ASK floats clear of the wells: while a
point is unspent each un-maxed key grows a bobbing gold plus plate in the open screen above its
well (`abBuyRect`/`abBuyHit`/`drawAbBuyPlate`, UI › `hud strip`). The plate press buys — and so does **the key itself while a point is unspent**: the sim
consumes `p.input.ability` as a buy whenever `abLvCanBuy(p, i)` holds and as a cast otherwise
(js/sim/sim.js, beside the other edge intents), so key 2 with a point in hand levels ability 2 and the
next press casts it; a maxed key casts straight through an unspent point. That reaches every
controller and the well click alike, since all of them set the one field. Hover lights the plate
and the tooltip carries the numbers (`LOCKED` and `UNLOCK 1 SKILL PT` on a dark key). Bots spend each free point in rung 0 of the ladder (`aiSpend`, js/ai/ai.js, first thing `aiThink` asks), lowest ability
level first — which spends their first four unlocking all four keys before any gets a cut. The cd
column in the tables below is the level-1 base.

**Every ability lands on every kind of body.** A player, a rabbit, a deer, a bird, a wolf and a worker
bot out of the [bot bay](robots.md) take the same damage and the same states from every key — the
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
| 1 | **PIERCING SHOT** | 12 s | locks a full draw for `PIERCE_WIND` (0.7 s) — the body plants (`PIERCE_SLOW` ×0.15 walk), the pose leans back and holds, and a thin dashed **telegraph line** is drawn on the ground along the live aim for BOTH sides, gold-flaring as the loose nears. Then the shot fires itself: one enhanced arrow (a full-draw plain arrow ×`PIERCE_MUL` 1.5, `PIERCE_SPD` 380, `PIERCE_RANGE` 520) that **goes through every body on the line** (`a.pierce`/`a.pierceHit`, the arrow loop in js/sim/sim.js) — only a raised shield or the world stops it. **It wears every modifier on the tool in hand** (`pierceMods`) — folded into one envelope and spent as a press spends one: `pierceFlight` is `shotFlight` at full draw, so SPEEDUP and LONGSHOT stretch the reach as well as the speed; HEFT and SPLITTER scale the damage after the multiplier; the fire and CINDER BURST ride it; SPLITTER fans it and DUPLICATE repeats it (`armOff`), every arm a pierce of its own. The telegraph draws that flight, one line per fan arm, each to where the world stops it (`teleLen`). The loose is the unmissable cue: `SFX.nock` snap + a white flash on the arrowhead |
| 2 | **NET SHOT** | 15 s | a weighted net down a line (`nets`): first rival hit takes 4 and is **slowed** (`p.slowT`/`slowMul` ×0.4, 2 s, the drape drawn on them); the recoil kicks the hunter backward with an animated hop (`p.hopT`) |
| 3 | **GRAPPLE** | 8 s | throws a hook down the aim ray: the first **tree, dead tree or rock** within `GRAP_RANGE` (170 px) and `GRAP_ASSIST` of the line (the aim assist) anchors it, and the body is reeled straight at it at `GRAP_REEL` (260 px/s — over `SLIDE_MIN`, so shift on release carves a slide). The reel runs **while key 3 is held** (`input.grapple`, the one held ability input); releasing, arriving, a wall or a stun lets go through `grapEnd`, which KEEPS the momentum and starts the cooldown — a long ride and an instant release cost the same. A hook that catches nothing costs `GRAP_MISS_CD` (1 s) |
| 4 | **SNOW COVER** | 60 s | the burrow ([Prone](prone-under-the-snow.md), which only this key opens): the cast kneels and calls `tryProne`, the 60 s clock is paid **on the way under**, and the key again — like every other way back up — rises free. A kneel the snow refuses (still moving, sliding, no snow underfoot) refunds the clock. The well's active tell drains with `p.hide` as the cover builds |

WARRIOR — close pressure, blocking, momentum:

| key | name | cd | what it does |
| --- | --- | --- | --- |
| 1 | **SHIELD WALL** | 9 s | raises a tower shield toward the aim for up to 2.2 s (the cooldown starts when it comes DOWN). Any shot flying into the front arc dies on it (`abShieldBlocks`, checked in the arrow loop before the body); walking drops to 40 % and the weapon is out of hand. **The key again while the wall is up is the SLAM** (`tryAbility` sets `p.castSlam`, the row's `use` branches on it): a `SLAM_CAST` (0.16 s) wind-up with the wedge on the snow, then `abSlam` — `SLAM_DMG` (8), `SLAM_STUN` (1.1 s) and `SLAM_KB` down the face on everything in `SLAM_R`/`SLAM_HALF` (30 px, ±0.85 rad, `unitsInCone`/`structsInCone`, js/sim/actions.js) — and the wall is spent (`abShieldDown`, the cooldown starts). **Mid-charge the same key slams too**: the rush ends on the spot (`rushEnd`, the carried body slammed where it stands) and the wind-up begins there; with no wall up it waits on the shield's cooldown like the raise would. A rush may be cast with the wall up — only the charge itself refuses the other keys |
| 2 | **BULL RUSH** | 12 s | a 0.3 s wind-up with **the line on the snow** for both sides (`RUSH_SPD × RUSH_T` long, stopped at solids, a bar at its end where the slam will be — the body faces the live aim the whole wind-up), then charges the aim line at 300 px/s for 0.42 s (its own movement branch in `updatePlayer`, no i-frames, ramping to speed over `RUSH_RAMP`): the **first rival hit is carried** on the shoulder and **slammed** at the end (a bear is never picked up: the charge stops against it and slams it where it stands) — 10 damage + 0.6 s stun, ×1.6 driven into a wall (`rushStep`/`rushEnd`) |
| 3 | **STOMP** | 14 s | a leap-stomp at the feet — the ring of `STOMP_R` on the snow through the wind-up, filling in as it nears, and flashed white where it lands (`abFx`): 12 damage + radial knockback + a beat of stun in `STOMP_R`, and the **crater** (`craters`) is deep snow that slows rivals crossing it for 4 s |
| 4 | **EXECUTE** | 18 s | a 0.55 s overhead wind-up with the wedge on the snow (`EXEC_R`/`EXEC_HALF`, 30 px, ±0.75 rad — narrower than the sword), then `abExecute`: every unit in it takes `execDmg` — `EXEC_DMG` (10) plus `EXEC_MISSING` (half) of the life it has already lost, capped at `EXEC_BONUS_MAX` (40) extra — so a body the other three keys have worked over is finished, and a full one takes ten. `EXEC_KB` shove; a cut over twice the base is a crit |

ARMATOS, THE LAST STANDARD — the defensive initiator, the first hero with a passive. His rules
live in **[js/sim/armatos.js](../../../js/sim/armatos.js)** (`ARM_AB`, its `armatos` banner), his
pixels in [js/draw/armatos.js](../../../js/draw/armatos.js), his icons in
[js/sprites/armatos.js](../../../js/sprites/armatos.js). He fights with the warrior's sword and loadout
(`heroBody(cls)`, js/sim/player.js, maps a hero to the loadout it borrows), drawn as his OATH
GREATSWORD, in a body of his own ([hero looks](../sprites.md#hero-looks-armatos)), with his side's torn
standard on his back (`drawHeroBack`):

| key | name | cd | what it does |
| --- | --- | --- | --- |
| P | **LEGION'S RESOLVE** | — | damage taken fills `p.resolve` (`RESOLVE_FULL`, 30% of max hp, for a full bar; it drains after `RESOLVE_IDLE_T` without a hit). Full, the next key cast gives a shield of `RESOLVE_SHIELD` (14%) of max hp for `RESOLVE_SHIELD_T` (4 s), `shieldUnit` (`p.wardHp`, spent in `damagePlayer` after the dawn shield). The standard's cloth fills gold with it. `HERO_PASSIVE`, reached through `passiveHurt`/`passiveCast`/`passiveTick` |
| 1 | **IRON VERDICT** | 8 s | a line slam `VERDICT_LEN` long, ±`VERDICT_HALF` (`unitsInLine`), the box on the snow through the wind-up with its middle hashed gold: `VERDICT_DMG` + `VERDICT_SLOW` for `VERDICT_SLOW_T` on all in it, and those in the middle stretch (`VERDICT_MID`) are knocked up `VERDICT_UP` instead (`knockUp`) |
| 2 | **HOLD THE LINE** | 12 s | a brace for `HOLD_T` (the shield-wall state, `wall: true`): blows from the front take `HOLD_CUT` less (`holdTaken`, a `HERO_TAKEN` fold in `damagePlayer`). A rival hero's hit primes the bash (`p.holdHit`, the trim goes gold); the key again bashes the wedge ahead (`armBash`): `BASH_DMG`, shoved `BASH_KB`, and stunned `BASH_STUN` only when primed |
| 3 | **VETERAN'S MARCH** | 14 s | a charge (the rush state with `p.dash = 'march'`, `HERO_DASH`) at `MARCH_SPD` for `MARCH_T`: lesser bodies are shoved aside once each (`marchStep`, `MARCH_SHOVE`), and the first rival hero (or an anchored body) stops it: `MARCH_DMG` and `MARCH_STUN` (`marchEnd`) |
| 4 | **THE OLD GUARD** | 80 s | plants the standard (`guards`, one per owner) for `GUARD_T`: allies inside `GUARD_R` gain `GUARD_ARMOR` armor (`guardStat`, a `HERO_STAT` row read by `statOf`) and `GUARD_TEN` tenacity (`guardTen`); a rival who was inside and steps out (caught up to `GUARD_EDGE` past the rim, so a roll out still counts) is slowed `GUARD_SLOW` for `GUARD_SLOW_T` (`updateGuards`). Its points wait for hero levels 6, 9 and 12 (`GUARD_LV`) |

Bots play him through each row's `bot(p, foe, d, clear)` (`abBotKey`, asked by the ladder's
ability block in js/ai/ai-ladder.js); a hero whose rows carry no `bot` keeps the ladder's old range rules.

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
