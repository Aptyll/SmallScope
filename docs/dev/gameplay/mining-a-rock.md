# Mining a rock

Rocks come in three kinds (`ROCK_KINDS`, the `rocks and ore` banner of
[js/sim/mining.js](../../../js/sim/mining.js)), each with its own outline so the kind reads by shape before
colour: **STONE**, a pair of leaning slabs; **FROSTGLASS SPIRE**, ice prisms through the slabs;
**SUNSTONE**, a black obelisk seamed with amber. Where each stands is [world.md](../world.md#rocks).
Every rock is two tiles wide (`OBJECTS.rock.w`), and either tile answers for the whole rock.

**A rock mines itself: no key, just standing by it.** Every step `updateMine` (beside `updateEat`
in `updatePlayer`) looks for the nearest standing rock within `MINE_R` (40 px of its middle,
`rockCx`/`rockCy`) that nobody else is at (`mineFree`, `rockMiner`) and takes it: one miner per
rock, two in one step [contested](../multiplayer.md#contested-orders) on `mine:<tile>`. The bar
fills for as long as the miner stays inside the ring, whatever they do there - walk, shoot,
roll, eat, cast:

| kind | `mine` | `gold` | `ore` | `regrow` |
| --- | --- | --- | --- | --- |
| STONE | 2 s | 3 | 3–5 IRONSTONE | 120 s |
| FROSTGLASS SPIRE | 3 s | 8 | 1–2 FROSTGLASS | 180 s |
| SUNSTONE | 4 s | 20 | 1 SUNSTONE | 300 s |

The pick bites every `MINE_STRIKE` (0.5 s): the rock shivers and blinks white, chips and a
white spark fly off where the pick lands, three motes of the kind's colour stream into the miner
over `MINE_STREAM_T` (`streamTo`, core.js), and on a body standing with its hands free the E
swing's own animation plays at it with nothing landing and no cooldown spent. The rock cracks in
thirds (each new crack a chunk burst, a bigger blink and a small shake) while the kind's colour
rises up its body from the foot (`SPRITES.rockFill`) and a bar fills over it (`o.crack`, the
progress itself, drawn by `drawRock`, js/draw/render.js, for every screen); a ring of `MINE_R`
lies on the snow in the kind's colour round the rock your pick is at, and faint round a free
one within reach of a step (`drawMineRing`). **Only a rival's blow knocks the pick off**:
`damagePlayer` calls `mineHit` for a hit from anyone not on your team (a wolf included; a
teammate, a fall or the cold do nothing), which lets go and keeps that body off every rock for
`MINE_HIT_HOLD` (1.5 s). A stun holds the bar still. Stepping out of the ring, dying, the water,
the air or the zipline let go (`breakMine`). **Progress is never thrown away**: a rock
nobody is at closes back up at `MINE_DECAY` (0.35 s of pick per s, `tickRock`), and the next pick
at it, yours or a rival's, starts from what is left.

When it lands (`finishMine`) the rock pays its `gold` through `awardGold` (times `harvestMul`;
gold only, never XP), throws its ore onto the snow one piece at a time toward the miner
(`ORE_FLING`) for the [drop pickup](inventory-and-the-backpack.md), and lies as **rubble** (`o.regrow`, `SPRITES.rockSpent`) — still solid, not
offered to E (`OBJECTS.rock.ready` is `rockReady`) — until `tickRock` in the object timers
grows it back. The bots mine by the same rule (the harvest rung walks them beside a rock and
they stand there, key up, until it breaks); the merchant's axe, a crater and the
landing's lane take a rock off the map whole (`fellScenery`, js/sim/world.js). The ore sells at
[the counter](the-merchants-counter.md#buying-and-selling) for half its `ORE_PRICE` (IRONSTONE 2, FROSTGLASS 12, SUNSTONE 40).
