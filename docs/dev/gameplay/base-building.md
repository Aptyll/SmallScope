# Base building

**T opens the build list, and the ghost under the pointer is what a click lays.** **A tap of T**
opens the list on the **last piece picked** (`toggleBuild`; `buildLast`), and a tap again puts it
away (the strip lost its build well in 0.426). **Holding T** past `PIECE_HOLD`
opens the **piece wheel** over the pointer (`buildKeyPress`: the wheel kind `piece`, every piece
round the ring on the manage wheel's grammar, drawn only once the hold is a hold so a tap never
flashes it), and the release on a wedge opens the list on that piece (`buildKeyRelease`); a hold
let go in the hub changes nothing. The list (`drawBuildList`, the `build list` group in
[js/ui/wheel.js](../../../js/ui/wheel.js)) is a column standing over the strip's meal wells
(`buildTabRect`), one row a piece in
`BUILD_ORDER` — wall, long wall, gate, turret, generator, bot bay, fish net — each row its icon and its
price (gold's colour while the purse covers it, red while not), the picked row rimmed gold.
The column is the **strip's**: drawn in its 1× space at the strip's size
(`drawHudStrip`, js/ui/hud-draw.js, whose bake grows by `buildHeadroom` while the column is up),
hit tested through `stripMouse`, its foot clear of the strip's top edge.
The mouse wheel walks the rows (the camera's zoom waits), a click on a row picks it, a **hover on
a row prints what the piece is for** (`tipStruct`, js/ui/tooltip.js: the price, health, build
time and the type's own numbers, then its `STRUCTS` `blurb`), and **R turns a piece that turns**:
the picked row wears the rotate key's cap. In the world the picked piece rides the pointer as a
**ghost** (`drawBuildGhost`, the world pass): its own art, faint, snapped to the tile grid with
its footprint centred on the tile under the pointer, rimmed in the standard bright ink where it
can stand, the danger red where it cannot and **grey where it could but the purse cannot pay**
(`BUILD_BROKE`), and a **dot at every tile corner inside `BUILD_REACH`** (64 px) of the builder,
so the snap and the reach read as one thing without a number. **The pointer wears the piece too**
— the hammer cursor with the picked piece's icon on the picked row's gold under it
(`drawBuildCursor`, dim with the hammer where the ghost cannot stand), wherever a press would lay
it — so the mode is read where the eye is: a left press over the world lays or refuses, and never
fires. A left-click lays the ghost and **the list stays up** for the next piece. **A piece marked
`line` (the wall) is laid by a drag**: the press remembers its tile, the ghost becomes the run
from it along whichever axis the pointer travelled further (`buildLine`, at most `BUILD_LINE_MAX`
tiles, each tile its own colour, going grey where the purse gives out), and the release sends the
run as one order (`buildOrder`: `tx2`/`ty2` on the `build` cmd) that `placeLine` lays tile by
tile, each its own contested `placeStruct`, skipping what cannot stand; a press and release on
one tile is the single piece. T tapped, the well, Escape or the right button put the list away;
a red ghost refuses with the deny cue and nothing else. Rust is the reference.

**One placement rule.** `canPlaceAt(type, tx, ty, rot, p)` (structures.js) is what the ghost's
colour, the click, the pad's wheel, `findSite` and the AI all ask, so none of them can offer a
site another refuses: a `water` building wants a bare open ice hole; everything else wants every
footprint tile to be in-world snow or road (`ground` 0 / 3) holding nothing or a **stump** (a
stump is consumed — it is not a site, just something a wall may stand on), no unit inside the
footprint (a building is solid and would entomb it), and the builder within `BUILD_REACH` of the
nearest footprint tile. It answers `{ ok, why }` and never asks the price: a ghost you cannot afford
yet is still a valid site, and the row says the price. The one build *site* is the
hole: `buildSiteAt` answers `'water'` for a bare hole and `null` for everything else, and only the
pad's wheel (`buildOptionsAt`) asks it.

**Rotation is the footprint, never the art.** A type marked `rotates` may stand turned (`o.rot`
1): its `w` and `h` swap (`structW`/`structH` take the *object*, so a turned one answers turned —
or a bare type name, unturned; `footprint(type, tx, ty, rot)`), and that is the whole of it. A
3/4-view sprite cannot turn, so a type that rotates is `tiled`: each footprint tile wears one tile
of the named type's own grid (`drawTiledStruct`, js/draw/structs.js; `structSprite` resolves `tiled` the
way it resolves `art`). Today that is the **long wall** alone — two wall tiles laid as one piece
for a little under two walls, 2×1 or 1×2, hurt and upgraded as one — and the bay stays 3×2.

**The gate** (`STRUCTS.gate`, the `gate` flag) is a one-tile wall piece its own side walks
through and nobody else does: `isSolidTile(tx, ty, e)` answers open for a walker `e` of the gate's
team, and `moveEntity` and the pathfinder pass the walker, so a side's players and bots route
through their own gates while rivals, wildlife and every shot meet a wall (shots and the maps ask
without a walker). It is hurt, upgraded and wrecked like a wall, and laid one at a time (no
`line`), so a dragged wall with a gate in it is two gestures.

**Managing is E.** Holding E beside one of your own buildings (`manageNear`: the one
under the aim in reach, else the nearest in reach; never the barracks, which is `fixed`) opens
the **manage wheel** on the practice rack's grammar — upgrade straight up, **repair** between,
demolish last — and the release takes. A **site still going up** offers the demolish alone (the
wheel's `site`, fixed when it opens so the wedges never shift under the pointer). This list is
*not* generic over a table (`wheelOptions()` hand-builds it). **Repair** (`startRepair`) pays
`repairCost` — `REPAIR_SHARE` of the standing tier's price scaled by the share of hp missing, at
least 1 — and the building mends at `REPAIR_RATE` of its max hp a second (`o.mend`, spent in
`updateStructures`) whether or not it is being hit; the wheel's label says the price, or FULL
HEALTH. E never swings at a
building of your own (`workTarget`), which is what leaves the key free to open it. The right
button is the [flag wheel](team-flags.md) everywhere.

**A pad builds from a wheel.** `openWheelNear` (dpad down) opens the build wheel on the tile the body **faces**, offering `STRUCT_ORDER` on land and
`WATER_STRUCT_ORDER` over a hole (the wedges follow the table's length — see *One geometry*
below); the pick is laid on that
tile, a big one fitted round it by `findSite`, and a building of the player's own on that tile
opens its manage wheel instead.

All the data lives in the `STRUCTS` table: three tiers for wall/long wall/turret/gold pump (for
the wall and the long wall the wood → stone → gold *look* is just the sprite
palette; the turret has three timber grids of its own and the gold pump, a 4x2 `generator`, three
painted tiers of its own, [sprites](../sprites.md)) and **one each for the bay and the net**,
each with a gold `cost`, `hp`, `buildT`, and per-type stats. A `water: true` entry (only the net)
goes on a hole instead of snow, and that flag — never the type name — is what `canPlaceAt`,
`isSolidTile` and the dawn refreeze each read; see [Fish nets](../world.md#fish-nets).
`tiers[0]` is what the list builds, at `buildCost(type, p)`: an income building (`ramp`: the gold pump
2.5, the bay 1.5) costs `ramp` times more for each of that type its owner already has, standing or
going up (60, 150, 375... for gold pumps), and the price paid rides the building as `paid` for
the refund. Upgrading pays the next tier's cost and re-runs a shorter
construction, and the last tier (`tiers.length - 1`) reports MAX TIER. Building and [items](the-merchants-counter.md#buying-and-selling)
are the two gold sinks.

Mechanics (the wheel in [js/ui/wheel.js](../../../js/ui/wheel.js), the buildings in [structures.js](../../../js/sim/structures.js)):

- `state.wheel` (`{kind:'build'|'manage'|'flag'|'rack'|'pkdie'|'agbell', tx, ty, seg, ax, ay}`, plus
  `sx`/`sy` on a flag wheel opened over the chart) is the open wheel — `'flag'` is the
  [flag wheel](team-flags.md), `'rack'` is the practice armory, `'pkdie'` the parkour roll die and `'agbell'` the archery
  range's bell, all three opened by holding **E**
  beside them and resolved on its release
  ([world.md](../world.md#the-practice-arena)); ESC/M/settings/death
  close it, a left-click cancels it, and the game **keeps running** — opening the
  wheel mid-night is deliberate pressure. `wheelLayout()` is shared by `resolveWheel()` and
  `renderWheel()` so hover math and pixels can never disagree - and by `pointerMove` (js/app/input.js),
  which is what `seg` is for: it holds the wedge the cue last spoke for, so crossing into another one ticks `SFX.notch` once, for a mouse or a stick
  alike (the wheel opening itself is `SFX.wheelUp`). `resolveWheel()` does not act: it
  writes `player.input.cmd`, and `runCmd(p, c)` performs it in the next sim step (re-checking
  ownership and the 60 px reach).
- **One geometry, any number of options.** `wheelSpan(n)` is `2*PI/n` and `wheelAng(i, n)` is
  `-PI/2 + i * span`: n wedges of exactly the same size, the first centred straight up and the
  rest clockwise. Nothing is special-cased per count — 4 options land on up/right/down/left and 2
  on up/down because that is what the formula gives, and 3 land 120° apart. The hover test reads
  the segment with the *same* `floor((angle + span/2) / span)` the wedges are drawn from, so a
  wedge is exactly its own hitbox at any count. `wheelOptions()` returns ids only; `wheelLayout()`
  stamps the angle on each, so there is one source for the layout.
- **Radii** (all in the `radial wheel` banner): `WHEEL_HUB` 13 is the hole in the middle,
  `WHEEL_R` 40 the rim, `WHEEL_PAD` 4 the backing disc beyond it, and `WHEEL_RING` — the midpoint
  of the band — is where every icon and label sits, so they are the same distance from the centre
  in every direction. Wedges are drawn as annulus sectors (arc out at `WHEEL_R`, arc back at
  `WHEEL_HUB`) with a `WHEEL_GAP` of daylight between them, measured in px at the rim so the gap
  looks the same however many wedges there are.
- **The hub is the cancel target.** It carries a cross rather than the word CANCEL, and goes hot
  red while the pointer is inside it — which is where the pointer starts, so the way out is the way
  you came in. `WHEEL_HUB` is also the deadzone: nothing is chosen until the pointer travels 13 px,
  which makes a plain right-click (press and release without moving) a no-op. ESC and a left-click
  both close the wheel outright, and the left-click also stops the right-release that follows from
  firing the order.
- **The pointer is measured from `ax`/`ay`, the point the press that opened the wheel went down
  at** (the pointer's spot at the right press for a flag wheel, at the E or dpad press for the others), not from
  the wheel's drawn hub: that press is what the hand remembers, and the hub is pinned to the tile,
  so it drifts as the camera follows the player and gets clamped near a screen edge. Because that
  travel is invisible (the cursor can be anywhere on screen), `drawWheelStick()` draws it at the
  hub as a knob that moves **1:1** with the pointer — so the knob is visibly inside the lit wedge —
  clamped to the lane between the hub rim and the icon ring so it never lands on an icon. Grey on
  the cross means nothing is chosen; gold out in a wedge means that is what a release will do.
- `placeStruct(tx, ty, type, p, rot)` asks `canPlaceAt` (a stump under the footprint is consumed
  — the tile is **empty** after demolition), pays `tiers[0].cost` from that player's wallet, and
  has `createStruct()` drop the object into `building` state at 30% hp, stamped with
  `owner`/`team`/`rot` (`createStruct` is the one constructor — `DBG.buildStruct` uses it too —
  and lays the `part` fillers for a big footprint, turned or not). The placement itself is
  [contested](../multiplayer.md#contested-orders) on the anchor tile, and the winner re-asks
  `canPlaceAt` before it builds, so two footprints can't land on one tile.
- **A big building ordered by one tile** (the pad's wheel, the AI): `findSite(type, tx, ty)`
  tries every anchor that covers that tile through `canPlaceAt` (reach aside, unturned) and takes
  the one covering the most stumps; none → the order is denied. The anchor is the top-left tile.
  The list never needs it: its ghost *is* the anchor.
- **Ownership**: a building wears its team's palette (`structSprite`), and `ownsStruct(o, p)`
  means only its side can open the manage wheel, upgrade or demolish it. Stumps are neutral.
- **Construction**: `updateStructures()` (called from `updatePlay`, iterating only the
  `structures` registry) advances `buildT`, grows hp toward max, and puffs dust — **faster for
  every one of the site's side standing within `BUILD_REACH`** (`buildCrew`: `CREW_BOOST` a head,
  up to `CREW_MAX`, the dust quickening with it), so helping is standing there; it also spends a
  paid repair (`o.mend`); the draws pass
  shows `SPRITES.scaffold[0|1]` under 2/3 progress, then the real sprite under the `scaffold[2]`
  lattice. A sprite wider than 16 px — the bay — builds differently: the first 12% of the timer
  shows only a staked-out foundation pad over the footprint, then the sprite rises bottom-up behind
  a weld line that throws sparks from `updateStructures` (`bigBuildReveal()` is the shared split so
  the sparks sit on the drawn edge), and completion flashes the sprite white (`o.flash`), puffs
  snow along the roofline and shakes harder. Small builds keep their burst + `SFX.place` + shake. A
  yellow progress bar renders above every site (centred over the roof for a big one). Sites are
  solid from placement. A big building y-sorts by the bottom of its footprint and sits its snow
  skirt on that edge.
- **Turret**: a **slingshot on a timber base** that lobs rocks.

  **What it throws at**, in this order of preference (`TUR_RANK`, nearest inside a rank):
  a rival **player** → a rival **worker or soldier bot** → a **hostile creature hunting somebody**
  (a camp monster with a `target`; it belongs to no side, so it is every turret's problem) → a
  rival **building**. A held mark is kept while it holds — a sling that jumped to whichever body
  was a pixel nearer would swing forever and never finish a draw — but a **better-ranked one takes
  it the moment it arrives**, so a turret chewing a wall turns on the raider who walks up.
  `turretAim(o, tg, k)` is the single gate: it returns the aim point on a mark, or null the instant
  it stops being one. It rejects anything `unitAlive` rejects (dead, a merchant, a player still
  `inAir` on the eagle), anything on the turret's own team, a building `structFoe` rejects, and a
  beast that is not actually hunting — so the meadow is never shot at. `turretMark` and
  `turretHolds` both ask it, which is why acquiring and holding cannot drift apart. A **player's**
  ring is `seenAt(tg, range)`, so GHOSTSTEP and a buried body shrink it; nothing else hides.

  **The throw is solved, once, by `turretLaunch(pv, ax, ay)`**: the velocity that carries a rock
  from the pivot onto the aim point at `ROCK_SPD` (190 px/s over the ground) while `ROCK_FALL`
  (240 px/s²) pulls it down, the seconds that takes, and the bearing it leaves on. The flight is an
  exact parabola — no drag, one constant sag (the `sling` [path](tools-and-bits/flight-paths.md)) — so **its life IS
  its time of flight**, and a rock that runs out of life has *arrived*. The sag is slight and grows
  with the range: ~3 px off the chord at 64, ~12 px at 124.

  **The fork points along the THROW, not at the mark.** The tick swings `o.ang` toward
  `turretLaunch(...).ang` at `traverse` rad/s (2.2 / 3.0 / 3.8 — it never snaps), so the arms stand
  visibly *above* what they are throwing at, and `fireRock` throws along that same solve (snapping
  `o.ang` to it exactly as it lets go). With no mark the fork sweeps ±1.15 rad at a third of its
  traverse, so a live turret never reads as a prop.

  **Accuracy is rolled when the draw BEGINS, not at the release** (`turretRoll`): on a hit it aims
  true, on a miss it carries `o.off`, 14–26 px at a random bearing, for the whole of the draw.
  `acc` is 0.6 / 0.8 / 0.9 by tier. Because the fork and the dashed aim arc both read `turretGoal`
  (the aim point **plus** that offset), a throw that is going to miss *says so before it goes* —
  which is what the number is worth to the player standing in front of it.

  Once the bearing is inside `TUR_LOCK` (0.14 rad) it draws for `aim` seconds (0.55 / 0.45 / 0.35)
  and lets go every `rate` seconds; losing the bearing eases the draw back down rather than
  cancelling it. `o.rec` is the one release timer (`TUR_SNAP`, 0.14 s): it drives both the pouch
  snapping forward and the cords drawn across the mouth.

  **It needs no line of sight.** A rock flies **over the world** (`solid: false`, the wisp's own
  flag — the arrow loop's solid-tile branch *and* its building sweep both skip it), over walls,
  pines and the turret's own base, so a sling behind a wall of its own is a weapon and not a prop.
  Range alone limits a mark: `range` grows the hardest of any tier stat, 64 → 92 → 124, because
  reach is what the upgrade buys.

  **A rock is an ordinary entry in `arrows`** tagged `kind: 'rock'`, so bodies it crosses in flight
  take it through the usual pipeline, with friendly fire and kill credit for free. But flying over
  the world means it never *meets* a building — so when a rock's life ends, `rockLands` puts it
  exactly on the point it was thrown at and the ground there takes the thump: every rival building
  inside `ROCK_SPLASH` (7 px) through `hurtStruct` and every body through `hurtUnit`, by way of
  `structsNear`/`unitsHit`. **That landing is the only door a rock has to a building.** A rock that
  already struck something on the way in spent itself there and only puffs.
  **Gold pump** (`generator`): deposits `tiers[tier].pay` gold every `period` seconds straight into its
  **owner's** wallet (`awardGold` — the gold number rises over the pump's barrel as a drawn coin
  hops out of it, but there is nothing to collect and no pile to cap). **Bot bay** (`spawner`):
  keeps `tiers[0].bots` (3) robots alive, rolling them out **one at a time** — the first 1 s after
  completion, then 4 s apart; a lost bot takes 12 s to replace (`respawnT`/`respawnTotal`).
  `makeRobot` spawns at `structMouth()` (the ring around the footprint if that is blocked) with an
  exhaust puff. **Barracks** (`barracks`): the wave bay, **never on the wheel** — not in
  `STRUCT_ORDER`; each [merchant](robots.md#the-merchant) raises one just inside each of its base's three lane mouths, and
  `fixed: true` refuses the manage wheel's upgrade and demolish, so nobody pulls it down for the
  refund. It wears the bay's 3×2 grid (`art: 'spawner'`, read by `structSprite`) under its own
  overlay (`drawBarracksOverlay`: the shutter, the next soldier sliding down the door, the wave
  clock on the flank in the side's paint, the beacon amber while a column is leaving). Every
  `waveT` (30 s) it queues a **wave** — `wave` (3) soldiers, one more per `grow` (180 s) it has
  stood, never more than `cap` (8) of its side's soldiers on its **lane** at once, every bay's queue and column on that lane counted (`barracksLaneLoad`) — and the queue leaves the door
  one every `BARRACKS_ROLL` (0.5 s), so a wave reads as a column. Its `cost` (40) is only what a
  wrecker is paid half of: breaking one stalls the waves until the merchant rebuilds it
  ([Soldiers](robots.md#soldiers-the-waves)). `drawBayOverlay()` draws everything live on top of the baked sprite: the next bot
  sliding down the doorway over the last 0.8 s of its timer; a roll-up **shutter** over the doorway
  (`o.door`, lerped in the tick — open while any of its workers is out of the yard or one is
  rolling out, shut when the whole crew is home, so the door reports the bay's state);
  three **bot pips** on the right flank (lit = alive, blinking = being built, dark = empty) with the
  roll-out timer as a bar under them; a flickering slat across each vent grille; a roof **beacon**
  that blinks amber while a bot is due; and an hp bar over the roof once damaged. `removeStruct()`
  clears the whole footprint and kills its robots with it.
- **Buildings take damage from everything a rival can throw, and only from the other team.**
  `hurtStruct(o, dmg, p, bot)` is the one blow — the flash, the shake, the damage total, the camera
  kick, the wreck payout and the `<NAME> WRECKED A <TYPE>` feed line are one path and cannot
  drift apart. Four things reach it:
  - the **E swing**, `hitObject()`'s structure branch, **contested** with everything else E does
    (it runs inside `swingHit`'s `contest('work:' + idx)`);
  - **every bit a tool fires**, in the arrow update's solid-tile branch (js/sim/sim.js): a shot
    that dies on a wall sieges it first — anywhere on the building's drawn shape, the turret's
    turntable included ([the sweep](tools-and-bits/flight-paths.md), `structShotBox`). A bit whose `solid` is `false`
    (the care arrow, the wisp, the hook) passes through buildings without touching them — that
    is the trade for passing walls, and it needs no second flag;
  - a **turret's rock LANDING** (`rockLands`, js/sim/structures.js), which is how a piece that flies
    over the world reaches a building at all — see [Turret](../gameplay.md#the-buildings) above;
  - the **abilities**: the stomp's ring, the shield's slam and the execute (their wedge, through
    `structsInCone`), the charge's slam into whatever it was driven into, the net, and the
    piercing shot, which rides the arrows array like any bit — and the sword's cut, whose wedge
    reaches a wall the same way;
  - a **worker or soldier bot's axe** on a siege flag (`robotStrike`).

  **`STRUCT_DR` (0.6) damps a player's blow, and only a player's.** Every one of those player
  numbers was tuned against a 40–160 hp *body* and would melt a 60 hp wall, so the damping is
  charged once, inside `hurtStruct`, rather than written out as a second building-sized number
  per weapon: raise a shot's damage and the siege scales with it, and a new ability never has to
  remember the rule. A bot names itself in the fourth argument and keeps its full `ROBOT_DMG`,
  which is already a building number. `STRUCT_HIT_DMG` is the **raw** E swing (25) and lands 10
  after the damping, at the `swingCd` of 0.34 s: ~2 s for a
  tier-1 wall (60 hp), ~10 s for a tier-3 one (300 hp), ~7.5 s for the bay (220 hp). A full-draw
  plain arrow lands 7, so a tier-1 wall is nine shots. At 0 hp it calls
  `destroyStructure(o, true, p)` and the wreck pays out exactly like a demolition, straight to
  the wrecker. Wildlife still damages nothing.

  **`structsNear(src, x, y, r)` is the buildings half of `unitsNear`** — every rival building
  the circle touches, resolved to its anchor and listed once, so an **area** effect reaches a
  wall through one call rather than a tile loop per ability, and a 3×2 bay is caught by whichever
  of its six tiles the ring actually crosses. `structFoe(src, s)` is its `unitFoe`: never your
  own, never a neutral, and PVP has nothing to say about it, because a wall is not a body.
- Demolish refunds **50% of the cumulative cost across tiers** (`cumulativeCost`, `structRefund`),
  paid to the demolisher on the spot through `awardGold` — 23 gold for a fully-upgraded wall —
  except **a site still going up for the first time, which hands its whole price back**, so a
  misplaced piece costs nothing but the walk (an upgrade under way is still the half). A wreck
  always pays the wrecker the half. `demolishStruct()` → `destroyStructure(o, 'own', p)` is the
  live path for that, reached from `runCmd` for the wheel's demolish order (the one order a site
  takes); the manage wheel's label shows the refund. `canAfford`/`pay`/`costText` are generic over every `inv` key. Demolishing is
  **not** guarded beyond that — no confirmation dialog exists anywhere in this game.
- **Every damaged building wears an hp bar** (`drawHealthBar`, centred on the sprite, `sy - 5`),
  drawn only once `hp < maxHp` so an untouched base stays clean — and never while `building`, when
  hp is climbing rather than falling. The bot bay is excluded: `drawBayOverlay` draws its own at
  `sy - 11`. Below 60% hp a building also picks up four crack marks placed as fractions of its
  sprite, so damage reads without the bar.
- No structure emits light; an open snowdrop is the one thing on the map that does (see [Lighting](../rendering/light-and-weather.md)).
