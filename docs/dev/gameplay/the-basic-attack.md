# The basic attack

Everything in this section lives in **[js/sim/attack.js](../../../js/sim/attack.js)**, under the
`basic attack` banner. **Each hero's left button is one basic attack, and it belongs to the
hero's kit** the way the [abilities](class-abilities-keys-1-4.md) do: a row on its `CLASSES` entry
(`attack`, js/sim/player.js), read through `attackOf(p)`. Nothing about it is carried, loaded,
bought, dropped or swapped: a hero has its weapon from the first frame of the match to the last,
and items and levels grow it through the hero's stats ([hero stats](hero-stats.md)).

| field | means |
| --- | --- |
| `name` | what the tooltip calls it (OATH GREATSWORD, STAR-GLASS, HEAVY ARBALEST) |
| `art` | the weapon's picture: `SPRITES.weaponArt[art]` (its 12 px icon) and `SPRITES.weaponHeld[art]` (a blade at its real length), js/sprites/weapons.js |
| `as` | base attacks a second: the ATTACK SPEED stat's level-1 number (`classAs`, js/sim/stats.js) |
| `range` | px from the hero's centre to the mark's edge that an attack lands from |
| `wind` | the share of each attack spent winding up before the blow leaves |
| `shot` | a ranged attack: `{ speed, col, look }`, a missile that flies at its mark and cannot miss it; its collar colour, and optionally the `look` it is drawn with in flight in place of an arrow (`HERO_SHOTS`, js/draw/heroes.js) |
| `cut` | a melee attack: `{ half }`, the radians of arc the hand swings through either side of the mark ([the cut](#the-cut)) |

Blades sit at 18 to 26 px of range and about 0.7 to 0.84 attacks a second (ARMATOS's OATH
GREATSWORD: 24 px, 0.77, `wind` 0.28; NIX's ICE DIRK, the quickest and shortest: 18 px, 0.84).
Shots sit at 66 to 96 px and about 0.52 to 0.78 (IGNIA's CROOK AND LANTERN: 80 px, 0.56; ARCUS's
WILLOW LONGBOW: 92 px, 0.78, `wind` 0.18; SAGITTA's HEAVY ARBALEST, the longest and slowest: 96
px, 0.52). The rows themselves are the one list. A new hero is a new `attack` row and nothing else.

## The attack

A basic attack is League's: **the player names a mark, and the hero does the rest.** The mark is
`p.input.atk`: a rival body its side can see, a rival building still standing, or the rival bird
on its roost (`atkGood`, the one test every picker asks: the sim, the pointer, the bots). A tree
or a rock is never a mark. The pointer names it ([the attack order](../multiplayer.md#keyboard-and-mouse),
`atkPress`, js/app/input.js); a bot names it the same way.

`attackStep(p, dt, free)` runs it for every player alike (`playerAttack`, js/sim/sim.js):

1. While the mark is good and inside `range` of the mark's edge (`atkIn`, `atkGap`), the feet are
   still and the hands are free (no cast, roll, fall, stun or cable), and the last attack's clock
   (`p.nockT`) has run out, the **wind-up** starts: `p.charging`, `p.chargeT` counting up to
   `atkWind(p)` (`wind` of the whole attack), the hero turned to the mark (`atkFace`, `p.aimA`).
   Starting one ends a recall.
2. Walking, the hands being wanted, the mark going bad or swapped, or the mark moving more than
   `ATK_LEASH` past the range **cancels** the wind-up, and costs nothing (`atkCancel`): the League
   rhythm of stop, hit, step.
3. The wind-up's end lands the blow (`basicAttack(p, t)`), and `p.nockT = atkRest(p)`, the rest
   of the attack. Walking after the blow has left is free.

`attackCycle(p)` is one whole attack, one over the ATTACK SPEED stat, so attack speed quickens the
wind-up and the rest together. Every readout of the attack's clock divides `p.nockT` by
`atkRest(p)`, and a pose drawn off it reads `atkSince(p)`.

What a blow lands for is `attackDmg(p)`: the hero's DAMAGE stat (`statOf`) plus the kit's speed
bonus (`spdDmg`, on a body that is moving). Every blow carries `basic: true` to `hurtUnit`, which
is how a hero's on-basic-attack passive (`passiveDeal`, js/sim/heroes.js) tells it from an
ability. A building takes it through `hurtStruct`; the rival bird takes `EAGLE_ARROW_DMG` through
`hurtEagle`, whatever the weapon.

**A shot** (`shootAttack`) is one missile from `BOW_Y` above the feet. It goes into the `arrows`
array with `homing` set to the mark, and the arrow loop steers it onto where the mark is each step
(`homingStep`). It lands on arrival (`homingLand`) and only on its mark, so a ranged attack can be
outrun but never sidestepped. A mark that dies or goes into the fog ends it where it is. A roll's
i-frames let it pass. `passiveShot` lets a hero's passive add to it (`HERO_PASSIVE` `shot`).

### Knockback

**Nothing a basic attack lands shoves anything**: a shot and a cut both pass `kb: 0, kbMul: 0`.
Knockback is for abilities, which pick it per blow (`o.kb`, `o.kbMul`). A **player** is never
shoved by any attack: `damagePlayer` gives a player knockback only from a key's blow (one with
`o.ab`, never `o.basic`). It still keeps which way the blow came (`hitNx`/`hitNy`) for the hit's
spark and recoil (js/draw/hitfx.js).

## The cut

A `cut` row is a blade, and its blow lands on the mark on the wind-up's last frame (`cutAttack`).
Each cut is recorded (`slashes`, `SLASH_T` 0.28 s, ticked by `updateSlashes` from `updatePlay`,
carrying the `blade` that made it), and what it leaves in the air is its weapon family's own (a
blade row's `smear`, `HERO_BLADES`; `edge` when it names none): a sword a long thin swish, an axe
or a pick a short heavy one and chips off its bite, a hammer a broad dull one and the snow its head
knocks up, a dirk a small quick one, and a spear none at all, since its point is pushed straight
out (`SWING_JAB`) with two lines of air beside it, the arm going out with it so the haft stays in
the hand (`heroArm`, `heroKnuckles`, js/draw/heroes.js). The swish is the blade's (`drawSwish`,
`SWISH_KIND`, js/draw/bodies.js); the chips, the snow and the thrust's lines are `drawSlashes`
(js/draw/abilities.js). **The hand swings the blade itself**: it is drawn at its real 22 px length
(`SPRITES.weaponHeld`, or the hero's own blade), the wind-up cocks it back to the start of its arc,
and for `SLASH_T` after the blow (`p.slashT`/`slashA`/`slashHalf`, counted down in `updatePlayer`)
`drawHeldTool` swings it across `half` either side of the mark in drawn steps at `SWING_FPS`
(`swingFrame`). The whole body acts with it (`attackLean`): 1 px back off the aim through the
wind-up, 1 px in toward it through the cut and the held finish. A key's cast keeps the blade in the
hands the same way (`castBeat`, js/draw/bodies.js). A bot with a blade closes to its `range`
(`aiMeleeD`, js/ai/ai.js) before it names a mark.

## A shot in flight

A basic attack's shot homes ([above](#the-attack)). Every other shot (an ability's) flies straight,
and is what the rest of this section is about.

**A shot meets everything its step crossed, then one blow.** A step is a *segment*, never a point:
`shotContacts` (js/sim/sim.js, `the shot's sweep`) lists what the segment met in the order it met
it — the tiles it entered (a grid DDA) up to the first that ends it (a rival roost, a solid tile), every **standing building by the shape it is drawn in** — `structShotBox`,
the box its sprite's opaque pixels cover where the draw lays it (`structArtOff`, so the barracks'
roof 6 px over its footprint stops a shot); a site still going up is its footprint alone — a target face,
and every body whose hit disc it crossed (`sweepDisc`, and `sweepBox` for the building's box): the
`ARROW_HIT_R` (10 px) disc at a player's chest, `ROBOT_HIT_R` (7) about `robotHitY` for a chassis,
`animalHitR` about `animalHitY` for a body that may be up on its own altitude. So speed never
skips a hit. The step's bounding box turns nearly every body away before the sweep is asked. The
tile a step starts in was asked by the step before; a shot's **first** step asks its spawn tile
only if it is heading into it (still inside `TILE`/2 on), so a bow overhanging the tree its body
hugs shoots out over the edge and never through the trunk. The arrow loop takes the contacts in
order — a raised tower shield first, on a player — and every body goes through the same local
`blow()`, which hands the shot's damage and shove to `hurtUnit`. **The solid-tile branch is also
the one place a shot sieges**: when the tile that stopped it is a rival's building
(`structFoe(sideOf(a), structOf(objAt(…)))`) the damage goes through `hurtStruct`, `STRUCT_DR`
(60 %) off like any player blow. A shot never hits its own side or its shooter. When a shot ends (out of life or on what it met), a shot with a `hit` asks `heroShotEnd` (`HERO_SHOT_END`), which is how ARCUS's arrows come to stand in the snow.

## The item slots

**The six item slots are on the bottom bar at all times**: a three-by-two grid after the ability
wells (`itemCellRect(0..5)`, js/ui/strip.js), showing `p.items` ([the items](the-merchants-counter.md#the-items)) left to
right and top row first as the shop fills them. With the purse beside them it
is the whole of what a player carries into a fight: there is no backpack (cut in 0.531). The
hero's basic attack has no well: it is the hero's own, and hovering the portrait raises
`tipAttack` (its damage, attack speed and range).

Nothing in a slot is dragged or clicked: it is read. `stripHit` answers `{kind:'item', i}`, a
hover raises the item's `tipItem` (the shop's own card), and the
[drawing](../rendering/the-hud-corners/the-hud-strip.md) has no words: a slot's rim says part or finished
(`itemMetal`, js/sim/items.js), and an empty one shows its number, dim.
