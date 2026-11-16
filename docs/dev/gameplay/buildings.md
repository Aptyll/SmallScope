# Buildings

**Nobody builds by hand.** Every building on the map is the map's own or the merchant's: the
[road towers](../world.md#the-lanes) stand at boot (`placeTowers`, js/sim/towers.js), so do the
two neutral **gold pumps** ([below](#the-gold-pumps)), and each side's soldiers walk out of its
perch with no building at all. Player
building (the T build list, walls, gates, turrets, bot bays and worker bots, and the E manage
wheel) was cut in 0.525, and the fish net with food in 0.538.

All the data lives in the `STRUCTS` table ([structures.js](../../../js/sim/structures.js)): the
gold pump (`pump`, 4x2) and the road tower (3x2). Each entry is flat: a gold `cost` (none on the pump), `hp`, `buildT`
and its own stats. The cost is only what a wrecker is paid half of (`wreckPay`). What a type
does is its entry's hooks, so the building sim never asks a type's name: `init(o)` (its state,
from `createStruct`), `built(o)` (a site finished), `tick(o, dt)` (each tick it stands,
`updateStructures`), and for its draw `sprite(o)`, `frame(o)` and `over(o, x, y, now)`
(`structSprite`, `drawStructObj`).

- **One constructor.** `createStruct(tx, ty, type, tier, p, building)` drops the anchor object
  through `placeObj`, stamped with `owner`/`team`, lays the `part` fillers over the rest of the
  footprint (`footprint(type, tx, ty)`), sets the type's own state and joins the `structures`
  registry. With `building` it starts at 30% hp and rises over `buildT`; `DBG.buildStruct`
  uses that, the towers stand finished. `removeStruct()` clears the whole
  footprint. A building is solid from the moment it is laid (`isSolidTile` reads any `STRUCTS`
  entry as solid, except a `water` one).
- **Ownership**: a building wears its team's palette (`structSprite`), and `ownsStruct(o, p)` is
  true for its own side (or a building of nobody's), which is what keeps E from swinging at it
  (`autoWorks`).
- **Construction**: `updateStructures()` (called from `updatePlay`, iterating only the
  `structures` registry) advances `buildT`, grows hp toward max and puffs dust. The draw shows a
  staked-out foundation pad over the footprint for the first 12% of the timer, then the sprite
  rises bottom-up behind a weld line that throws sparks (`bigBuildReveal()` is the shared split so
  the sparks sit on the drawn edge); completion flashes the sprite white (`o.flash`), puffs snow
  along the roofline and shakes. A yellow progress bar renders over the roof of every site
  (`drawBuildBars`). A big building y-sorts by the bottom of its footprint and sits its snow skirt
  on that edge.
- **Gold pump** (`pump`): the map's objective, [below](#the-gold-pumps). It is nobody's,
  so nothing can hurt it.
- **The waves** are no building: each side's columns walk straight out of its perch on the match's
  beat ([Soldiers](robots.md#soldiers-the-waves)).
- **Buildings take damage from everything a rival can throw, and only from the other team.**
  `hurtStruct(o, dmg, p, bot)` is the one blow: the flash, the shiver, the damage total,
  the wreck payout and the `<NAME> WRECKED A <TYPE>` feed line are one path and cannot
  drift apart. What reaches it:
  - the **E swing**, `hitObject()`'s structure branch, **contested** with everything else E does
    (it runs inside `swingHit`'s `contest('work:' + idx)`);
  - **every arrow**, in the arrow update's solid-tile branch (js/sim/sim.js): a shot that dies on
    a building sieges it first, anywhere on the building's drawn shape
    ([the sweep](the-basic-attack.md#a-shot-in-flight), `structShotBox`);
  - the **abilities**: every key with an area that names buildings (its wedge or ring, through
    `structsInCone`/`structsNear`), and every ability shot, which rides the arrows array like any
    arrow;
  - a **soldier's axe** (`robotStrike`).

  **`STRUCT_DR` (0.6) damps a player's blow, and only a player's.** Every player number was tuned
  against a 40–160 hp *body*, so the damping is charged once, inside `hurtStruct`, rather than
  written out as a second building-sized number per weapon. A bot names itself in the fourth
  argument and keeps its kind's full blow (`SOLDIER_TYPES`), which is already a building number. `STRUCT_HIT_DMG` is
  the **raw** E swing (25) and lands 10 after the damping. At 0 hp it calls
  `destroyStructure(o, p)`, and the wreck pays the wrecker `wreckPay` (half the cost) on the spot
  through `awardGold`. Wildlife damages nothing.

  **`structsNear(src, x, y, r)` is the buildings half of `unitsNear`**: every rival building the
  circle touches, resolved to its anchor and listed once, so an **area** effect reaches a building
  through one call, and a 3×2 tower is caught by whichever of its six tiles the ring actually
  crosses. `structFoe(src, s)` is its `unitFoe`: never your own, never a neutral, and PVP has
  nothing to say about it, because a building is not a body.
- **Every damaged building wears an hp bar** (`drawHealthBar`, centred on the sprite, `sy - 5`),
  drawn only once `hp < maxHp` so an untouched base stays clean, and never while `building`. The
  tower draws its own. Below 60% hp a building also picks up four crack marks
  placed as fractions of its sprite, so damage reads without the bar.
- No structure emits light; an open snowdrop is the one thing on the map that does (see [Lighting](../rendering/light-and-weather.md)).

## The gold pumps

Two **neutral gold pumps** stand at boot (`placePumps`, js/sim/pumps.js, after the camps and
with no `rng()`), one each side of the middle in the jungle by the base mouths (`PUMP_SPOT`, RED's,
mirrored across the middle column for BLUE), so the pair is fair: each side has one pump a little
nearer. The site is open ground in the field (js/sim/field.js), so nothing is cleared. The pump's
`team` stays undefined: `structFoe` is false for it, so nothing hurts it, and `ownsStruct` is true,
so E never swings at it.

- **The ring.** A hero (a player, never a soldier) counts when `unitAlive` and within `PUMP_R`
  (4.5) tiles of the pump's centre (`pumpCount`). One side alone in the ring fills it toward
  itself over `PUMP_CAP_T` (5 s): a rival's part-fill drains first at the same rate, and the
  holder alone in its own ring wipes a rival's part-fill out. Both sides inside pause it. An empty
  ring loses a part-fill over `PUMP_FADE_T` (10 s). A full fill flips the pump (`pumpFlip`: the
  jolt, a `place` cue, a ring of sparks in the side's mark). Holding needs nobody in the ring.
- **The pay.** While a side holds it, every `period` (10 s) each active hero on that side, alive
  or not, wherever they are, gets `pay` (20) through `gainGold` and a coin cue; one plain
  20 rises over the barrel as the drawn coin hops out (`drawPumpCoin`, only after a pay). It
  strokes only while held: the frame runs off `o.payT` (`pumpFrame`).
- **The colour is the whole read** (no text). The pump wears its holder's team paint, or a grey
  set held by nobody (`pumpSet`, js/draw/structs.js; `SPRITES.pumpNeutral`, js/baked/pump.js).
  `drawPumpRings` lays the roost's glowing rim (`roostRingArt`) flat on the snow in the holder's
  mark, or `PUMP_GREY`, and the fill of the side taking it as a three-pixel arc of its mark
  running round from the top; the fill shows only where the viewer's side can see. Both maps ink
  it the holder's colour or grey (`mmPump`/`chPump`, world.js).
- **State** rides the pump's tile object (`hold`, `cap`, `capBy`, `payT`, `paid`, `lane`), so the
  snapshot and the save carry it with the tile.
- **Bots** take and contest them (rung 5e', `aiPumpRung`, [Bots](../multiplayer.md#bots)).
