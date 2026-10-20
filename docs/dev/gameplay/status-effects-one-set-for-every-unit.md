# Status effects: one set for every unit

Everything in this section lives under the **`status effects`** banner at the foot of
[js/sim/actions.js](../../../js/sim/actions.js). Three kinds of thing walk this world — a **player**, an
**animal**, a **bot** — and all three take a blow and a state through the same funnels
(the [CLAUDE.md](../../../CLAUDE.md) hard rule; the detail is here):

| Reach for | When |
| --- | --- |
| `hurtUnit(e, dmg, nx, ny, src, o)` | **any** blow. `o` = `{ type, kb, kbMul, cause, ambush, crit, basic }` — `kb` the absolute px/s of shove an ability picks, `kbMul` the multiplier on whatever shove that kind takes anyway ([knockback](the-basic-attack.md#knockback)). Routes to `damagePlayer` / `hurtAnimal` / `hurtRobot`, which stay for what is genuinely per-kind (a den waking, a worker turning on whoever hit it) |
| `unitsNear(src, x, y, r)` | every living thing in a circle that `src` may touch — players, wildlife **and** bots in one list |
| `unitsHit(src, x, y, r)` | the same, minus anyone whose i-frames are up: the list a **blow** sweeps, so a rival mid-roll is untouchable. A lasting ground *condition* (a crater) wants `unitsNear` — a condition is not a hit, and a roll should not shrug one off |
| `stunUnit` `rootUnit` `slowUnit` `netUnit` `markUnit` `igniteUnit` | the one place each state is written. Each takes the worse/longer of what is already on the body |
| `unitMoveMul(e)` | what is left of a non-player's speed — `abilityMoveMul`'s twin. Spent inside `navStep`, so one edit slows every walker; the two movers that steer themselves rather than route (a loitering bot, a bird in flight) fold it in by hand |
| `knockUp(e, t, src)` / `upLift(e)` | a knock-up: a stun that lifts the body (`e.upT`), drawn by `abilityPose` |
| `shieldUnit(p, hp, t)` | a ward of `hp` for `t` s (`p.wardHp`/`p.wardT`), spent by `damagePlayer` before health |
| `ccMul(e)` | **tenacity**: what is left of a stun, root, slow or net on this body (the product of 1 − t over `HERO_TEN`, js/sim/heroes.js: `guardTen` today); `stunUnit` with `firm` skips it |
| `clearUnitStatus(e)` / `douseUnit(e)` | a fresh body, and a fire put out. Called by `Player.reset`, `die`, `makeAnimal`, `makeRobot` |

`unitFoe(src, e)` is the side rule they all share, and it is where **wildlife being neutral** is
written down once: an animal has no `team` (`unitTeam` → −1), so it is nobody's friend and
everybody's fair game — exactly how the world already treated a deer. `sideOf(w)` hands one of these
lists the side of a **thing in the world** — a net, a shot in flight — rather than a living
caster, so a net outlives the hunter who threw it and still knows whose it was; `abCredit(w)`
(js/sim/abilities.js) is its other half, and pays a kill to nobody once that caster is down.

## I-frames: only something deliberate grants them

`p.invuln` (players only — an animal or a bot has no such field and never had) counts down
in `updatePlayer` and is read by every picker at once: the arrow loop skips a player that has it,
`unitsHit` drops one, `rollSweep` passes over one, and `damagePlayer` returns early on one. **A hit
sets it nowhere.** The only things that grant it are deliberate:

| Granted by | For | Why |
| --- | --- | --- |
| `tryDodge` | `DODGE_T` + 0.05 s | the roll *is* the dodge — [Dodge roll](dodge-roll.md) |
| `Player.reset` — so `respawnPlayer` | 3 s (0 on the very first spawn) | nobody is spawn-camped |
| `landPlayer`, `practiceRevive` | 2 s | a beat of grace while the snow settles |
| the ice-hole scramble (`updatePlayer`, js/sim/sim.js) | 0.8 s | you climb out; you are not bitten climbing out |
| the drop briefing (`js/sim/eagle.js`) | 0.4 s, refreshed | the lesson is not a fight |

`rollTackle` **drops** them ([the roll is a hit](dodge-roll.md#the-roll-is-a-hit)).

Because a hit grants none, every blow lands its own
damage, its own shove and its own fire, nothing caps a wolf pack
([Camp monsters](wildlife.md#camp-monsters-neutral-until-hit)), and
a body can take several hits in one frame — `SFX.hurt()`’s 0.03 s `gap` collapses the oofs into
one so they do not phase, while the damage total (each hit adds to it), the red flash, the shove and the shake are
per hit. Knockback does not accumulate: the last blow of a step writes `kbx`/`kby` outright.

The six states, and what each does to a body:

| state | field | what it does | the tell on the body |
| --- | --- | --- | --- |
| **stun** | `stunT`/`stunMax` | a player has every intent dropped out of `p.input` at the top of `updatePlayer` (movement, fire, work, slide, the edge-triggered lot) rather than each action refusing separately, so a human and an AI fill are pinned by the identical window — the draw, the swing in flight and any roll are cancelled outright; an animal or a bot skips its brain for the window in `updateAnimal`/`updateRobot`. Never touches velocity: whatever hit you still slides you | three sparks orbiting (`drawStunStars`) |
| **root** | `rootT` | move multiplier 0 — no walk, no roll, no slide; attacks still work. Currently no ability sets it — the state and its tell stay with the universal set ([Intentional dead code](../checklists.md#intentional-dead-code)) | sprung iron jaws at the feet |
| **slow** | `slowT`/`slowMul` | the multiplier on every speed cap | — (the net's drape says it, when a net is why) |
| **net** | `netT` | the slow, plus the reason for it | a mesh drape over the sprite |
| **mark** | `markT` | on a player, `seenAt()` returns full range and both maps keep drawing them (its one legal bypass); an animal or a bot has no cover to strip, so it is the reveal alone. Like root, currently sourceless — kept with the set | gold chevrons falling toward the head |
| **fire** | `burnT`/`burnDps`/`burnBy` | see below | flame tongues off the crown, and lit snow under the feet |

Every one of them is **drawn on the body, for both sides**, at whatever size that body is —
`drawUnitStates(e, px, py, w, h, now)` (js/sim/abilities.js) takes the sprite's own box and is called by
`drawAbilityOnPlayer`, `drawAnimal`, `drawBird` and `drawRobot` alike. A state you cannot see is a
rule you cannot play around, and that is as true of a deer as of a rival. The player keeps one tell
of its own on top (a raised shield, `drawAbilityOnPlayer`), and the stun badge is the one visual that
differs by kind: over an animal or a robot the sparks sit above the health bar, while on a player
they ride a badge that **mirrors the level badge on the other side of the overhead frame** — same
backing and track, its left frame column shared with the health bar backing's right edge — whose
5×5 track drains from the bottom as the window runs out (`stunMax` is the height it drains from).
It is drawn for every player, like the stamina bar: a rival seeing stars is a tell worth having.

## Damage types, and fire

A blow carries a **type**, and `DMG_TYPES` is what a type *is* — the sparks it throws off a body and
how long it leaves that body burning. `blunt` is everything that always existed (an arrow, an axe, a
shoulder) and is the default when nothing names one.

**`fire` is the one type that outlives its own blow.** It ignites what it lands on; an ignited unit
then pays `burnDps` in bites `BURN_TICK` (0.4 s) apart until its clock runs out — `BURN_T` 3 s at
`BURN_DPS` 6 for a plain fire hit. A fresh ignition **refreshes** the clock (capped at `BURN_MAX`,
8 s) and takes the hotter of the two rates rather than lighting a second fire, so a SPLITTER fan
sets you properly alight instead of banking half a minute of it. Credit rides along in `burnBy`, so
burning to death is a kill for whoever struck the light (`KILL_VERB.fire` — "BURNED"; with nobody to
credit, `DEATH_CAUSE.fire` — "BURNED IN THE SNOW").

Two rules make the burn behave like fire rather than like a stream of small arrows:

- **`DOT_CAUSE`** (js/sim/player.js) — a bite of fire is *not a blow*. It goes **through** the i-frames
  a body does have — a roll does not put a fire out, and neither does a respawn — and never shoves:
  a burn is a condition on the body, not a blow landing on it. It still breaks cover:
  you cannot lie hidden while you are alight.
- **The tick's own damage type is `burn`, not `fire`** — otherwise the bite would relight the fire
  dealing it and nothing would ever go out.

Where fire comes from: the KINDLING item passive ([the items](the-merchants-counter.md#the-items)), which lights every
`KINDLE_EVERY`-th hit for `KINDLE_BURN` s. Nothing else on the map is on fire:
the roosting eagle is an objective with its own damage path, not a unit, and takes no status at all.
