# Buildings

**Nobody builds by hand.** Every building on the map is the map's own or the merchant's: the
[road towers](../world.md#the-road) stand at boot (`placeTowers`, js/sim/towers.js), so do the
two neutral **gold pumps** ([below](#the-gold-pumps)), each
[merchant](robots.md#the-merchant) raises its side's **barracks** just inside its base's lane
mouths. Player
building (the T build list, walls, gates, turrets, bot bays and worker bots, and the E manage
wheel) was cut in 0.525, and the fish net with food in 0.538.

All the data lives in the `STRUCTS` table ([structures.js](../../../js/sim/structures.js)): the
gold pump (`generator`, 4x2), the barracks (3x2, wearing the bay's grid through `art: 'spawner'`)
and the road tower (3x2). Each has one tier: a gold `cost`, `hp`,
`buildT` and its per-type stats. The cost is only what a wrecker is paid half of (`wreckPay`).

- **One constructor.** `createStruct(tx, ty, type, tier, p, building)` drops the anchor object
  through `placeObj`, stamped with `owner`/`team`, lays the `part` fillers over the rest of the
  footprint (`footprint(type, tx, ty)`), sets the type's own state and joins the `structures`
  registry. With `building` it starts at 30% hp and rises over `buildT`; the merchant's barracks
  and `DBG.buildStruct` use that, the towers stand finished. `removeStruct()` clears the whole
  footprint. A building is solid from the moment it is laid (`isSolidTile` reads any `STRUCTS`
  entry as solid, except a `water` one).
- **Ownership**: a building wears its team's palette (`structSprite`), and `ownsStruct(o, p)` is
  true for its own side (or a building of nobody's), which is what keeps E from swinging at it
  (`autoToolFor`).
- **Construction**: `updateStructures()` (called from `updatePlay`, iterating only the
  `structures` registry) advances `buildT`, grows hp toward max and puffs dust. The draw shows a
  staked-out foundation pad over the footprint for the first 12% of the timer, then the sprite
  rises bottom-up behind a weld line that throws sparks (`bigBuildReveal()` is the shared split so
  the sparks sit on the drawn edge); completion flashes the sprite white (`o.flash`), puffs snow
  along the roofline and shakes. A yellow progress bar renders over the roof of every site
  (`drawBuildBars`). A big building y-sorts by the bottom of its footprint and sits its snow skirt
  on that edge.
- **Gold pump** (`generator`): the map's objective, [below](#the-gold-pumps). It is nobody's,
  so nothing can hurt it.
- **Barracks** (`barracks`): the wave bay. It wears the bay's 3×2 grid under its own overlay
  (`drawBarracksOverlay`: the shutter, the next soldier sliding down the door, the wave clock on
  the flank in the side's paint, the beacon amber while a column is leaving). On the match's beat
  (`barracksBeat`: `first`, 60 s of match clock, then every `waveT`, 30 s, so every lane rolls out
  together and a rebuilt bay falls into step) it queues a **wave**: `wave` (3) soldiers, one more per `grow` (180 s) it has stood, never more
  than `cap` (8) of its side's soldiers on its **lane** at once, every bay's queue and column on
  that lane counted (`barracksLaneLoad`). The queue leaves the door one every `BARRACKS_ROLL`
  (0.5 s), so a wave reads as a column. Breaking one stalls the waves until the merchant rebuilds
  it ([Soldiers](robots.md#soldiers-the-waves)).
- **Buildings take damage from everything a rival can throw, and only from the other team.**
  `hurtStruct(o, dmg, p, bot)` is the one blow: the flash, the shake, the damage total, the camera
  kick, the wreck payout and the `<NAME> WRECKED A <TYPE>` feed line are one path and cannot
  drift apart. What reaches it:
  - the **E swing**, `hitObject()`'s structure branch, **contested** with everything else E does
    (it runs inside `swingHit`'s `contest('work:' + idx)`);
  - **every arrow**, in the arrow update's solid-tile branch (js/sim/sim.js): a shot that dies on
    a building sieges it first, anywhere on the building's drawn shape
    ([the sweep](the-basic-attack.md#a-shot-in-flight), `structShotBox`);
  - the **abilities**: the stomp's ring, the shield's slam and the execute (their wedge, through
    `structsInCone`), the charge's slam into whatever it was driven into, the net, and the
    piercing shot, which rides the arrows array like any arrow;
  - a **soldier's axe** (`robotStrike`).

  **`STRUCT_DR` (0.6) damps a player's blow, and only a player's.** Every player number was tuned
  against a 40–160 hp *body*, so the damping is charged once, inside `hurtStruct`, rather than
  written out as a second building-sized number per weapon. A bot names itself in the fourth
  argument and keeps its full `ROBOT_DMG`, which is already a building number. `STRUCT_HIT_DMG` is
  the **raw** E swing (25) and lands 10 after the damping. At 0 hp it calls
  `destroyStructure(o, p)`, and the wreck pays the wrecker `wreckPay` (half the cost) on the spot
  through `awardGold`. Wildlife damages nothing.

  **`structsNear(src, x, y, r)` is the buildings half of `unitsNear`**: every rival building the
  circle touches, resolved to its anchor and listed once, so an **area** effect reaches a building
  through one call, and a 3×2 barracks is caught by whichever of its six tiles the ring actually
  crosses. `structFoe(src, s)` is its `unitFoe`: never your own, never a neutral, and PVP has
  nothing to say about it, because a building is not a body.
- **Every damaged building wears an hp bar** (`drawHealthBar`, centred on the sprite, `sy - 5`),
  drawn only once `hp < maxHp` so an untouched base stays clean, and never while `building`. The
  barracks and the tower draw their own. Below 60% hp a building also picks up four crack marks
  placed as fractions of its sprite, so damage reads without the bar.
- No structure emits light; an open snowdrop is the one thing on the map that does (see [Lighting](../rendering/light-and-weather.md)).

## The gold pumps

Two **neutral gold pumps** stand at boot (`placePumps`, js/sim/pumps.js, after the landmarks and
with no `rng()`), one beside the middle of the top lane and one beside the middle of the bot lane
(`pumpLaneMid`, where each lane crosses the creek), set off the road so a wave walks past. The
spot is the nearest 4x2 footprint of plain snow to the top lane's middle (`pumpSeek`, inside
`PUMP_SEEK` tiles) whose centre keeps `PUMP_ROAD` tiles off every road, clear of camps and the
cistern, with no water in its ring, **and whose point mirror on the bot lane passes the same
test** (`pumpSpotOk`, `pumpMirror`), so the pair is fair: each side has one pump a little nearer.
A shape where no pair stands (the frozen isles' lake) takes the nearest spot on each lane alone,
out to `PUMP_SEEK_FAR`, with `PUMP_STAND_LONE` of the ring standable. The pines in the
ring are felled (`pumpStand`). The pump's `team` stays undefined: `structFoe` is false for it, so
nothing hurts it, and `ownsStruct` is true, so E never swings at it.

- **The ring.** A hero (a player, never a soldier) counts when `unitAlive` and within `PUMP_R`
  (4.5) tiles of the pump's centre (`pumpCount`). One side alone in the ring fills it toward
  itself over `PUMP_CAP_T` (5 s): a rival's part-fill drains first at the same rate, and the
  holder alone in its own ring wipes a rival's part-fill out. Both sides inside pause it. An empty
  ring loses a part-fill over `PUMP_FADE_T` (10 s). A full fill flips the pump (`pumpFlip`: the
  jolt, a `place` cue, a ring of sparks in the side's mark). Holding needs nobody in the ring.
- **The pay.** While a side holds it, every `period` (10 s) each active hero on that side, alive
  or not, wherever they are, gets `tiers[0].pay` (30) through `gainGold` and a coin cue; one plain
  30 rises over the barrel as the drawn coin hops out (`drawPumpCoin`, only after a pay). It
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
