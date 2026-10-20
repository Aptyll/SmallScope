# Team flags

**One order marker per player, of four kinds, that the whole side reads — every worker bot out of
a bay the planter owns, and every AI player on the team.** A flag is an **area**: `FLAG_R` (192 px,
twelve tiles) round the tile it stands on is the ground the order is about, and a ring on the snow
says so. The sim side is the `team flags` banner in [robots.js](../../../js/sim/robots.js) plus the
dispatch at the tail of `updateRobot()`; how an AI *player* answers one is the `flag` rung in
[ai.js](../../../js/ai/ai.js) ([Bots](../multiplayer.md#bots)); the wheel is the `radial wheel` banner in
[js/ui/wheel.js](../../../js/ui/wheel.js).

**The wheel is the order.** Right-click any tile (building is the list on T and managing is E —
[base building](base-building.md); the HUD swallows its own presses), or press the `flag` key, and
the **flag wheel** opens on it, on the build wheel's own grammar — held open, the travel from the press picks, the
release plants: `FLAG_ORDER` clockwise from straight up, **ATTACK, DEFEND, GATHER, RALLY**
(`FLAG_TYPES`), each a wedge carrying its glyph at twice the banner's size. The hub cancels — unless
the wheel stands on your own flag, in which case the hub *is* the flag (it wears the pennant, the
label reads LIFT) and releasing there picks it up. R3 on a pad opens the
same wheel over the aim. `resolveWheel` writes `input.cmd = { kind: 'flag', tx, ty, id }` and
`runCmd` performs it next step — `plantFlag(p, tx, ty, type)`, or `clearFlag(p)` for the lift —
so the human's radial and a bot's `plantFlag` end in one function. A flag has no reach and goes
through no `contest()`: it is per-player state, not an act in the world.

| order | the crew, inside the ring | an AI teammate, inside the ring |
| --- | --- | --- |
| **ATTACK** | kill every rival unit and break every rival building in it (`flagFoe`: units first, a player through `seenAt`, a rival wave's soldiers included), chasing no further than `ROBOT_LEASH` past the rim; nothing left → hold the flag | a ring over the rival bird is a **push** (rung 8, the lane and the archer's station and all); anywhere else, break the nearest rival building with E and hold the ground when none is left — rivals in sight are rung 3's, the ring anchors them |
| **DEFEND** | hold the flag in a ring of posts and swing at whatever enters, never following out of the rim | a ring over its own bird is the **defend** rung (6); anywhere else, stand on the ring and go on down the ladder — hunt, loot, spend, harvest bounded to the ring, and stand where it would have roamed |
| **GATHER** | cut and mine everything in the ring, nearest the flag first (`cutNear`), banking a load at home at 8+ | walk in, then harvest bounded to the ring |
| **RALLY** | come and stand (a load is banked only if home is right there) | come and stand, fighting only a rival inside `AI_SIEGE_R` on the way — a rally is a disengage |

Only `{ tx, ty, type, owner }` is stored on `p.flag`; everything else is re-read off the ring as
it is needed, which is what makes the orders *survive their own success*: felling every tree
inside a GATHER ring leaves the crew holding the flag rather than stranded, and wrecking the last
building inside an ATTACK ring holds the ground it stood on.

**Whose flag a body serves** is one function, `servedFlag(p)`: **a human teammate's flag, if one
stands; else the teammate's flag a bot has joined; else its own.** That first clause is the whole
of command: *a human's flag is the side's plan.* While it stands every bot on the team lifts its
own flag (`aiFlagSync`) and walks to the human's from anywhere on the map — the defend, guard,
push and escort reads all give way to it — and every worker on the side (an AI teammate's bays
included, through `flagOf`) reads it. The one thing no order overrides is the **alarm**: a bird
under half its nerve calls everyone home regardless. Bots fly flags of their own, but **a bot's
flag is never a decision of its own — it is the ladder's decision made visible**: DEFEND at its
bird when it is walking home to a threat, ATTACK at the rival bird when it is pushing, GATHER
where it works (a guard's routine station flies nothing). Coordination is *one flag a plan, not
one a bot*: a bot plants nothing a teammate is already flying over the same ground
(`teamFlagAt`) — it joins that flag (`ai.join`) — and a bot with nothing of its own to fly helps
at the side's nearest standing flag that wants hands (`nearestTeamFlag` under `aiHelps`: an
ATTACK from anywhere unless it is one of the side's guards, a GATHER only inside `AI_FLAG_HELP`,
a DEFEND never — the threat read already calls exactly the number home — a RALLY from
anywhere). No bot ever flies a RALLY; there is no retreat in the ladder to make visible. The
whole of that is [the order](../multiplayer.md#bots) in the ladder.

- **Moving is planting.** One flag per player, so planting anywhere moves it, and `flagRecall(p)`
  clears every worker that will read the new order (the whole side's for a human's flag, the
  owner's own for a bot's) the frame it lands, so the crew is *visibly* seen to turn.
- **A worker never chases off a flag but an ATTACK.** On every other order it swings back at
  whoever hit it and no further, and with no flag at all it does not fight (`b.mad`,
  [Robots](robots.md)).
- It works **over the chart (M) too**: the right button opens the wheel on the chart's tile
  (`mapTileAt`) and pins it to the press point (`w.sx`/`w.sy`, `wheelLayout`) — the only way to
  order a tile that is off-screen. One chart pixel is 1 to ~1.2 tiles (`MAP_S`: the chart fits
  the view, 232 px at 360 rows, `fitMapSlab`), so a map order is ±1
  tile: fine for "take that bird", not for picking one tree.
- The middle mouse button does nothing.

**What it looks like** (the `what a flag looks like` group in [js/draw/marks.js](../../../js/draw/marks.js);
`FLAG_TYPES`, in robots.js, holds the 7×7 glyph grids as camp-glyph-style rect lists):

- **The ring**, `drawFlagRing`, flat on the snow under everything that walks it (`drawFlagRings`,
  called from the world pass right after the flat statics): a dark line under a dashed one in the
  **side's ink** (`TEAMS[skin(team)].mark` — never white: white on snow is a ring nobody
  sees), two pixels wide, the dashes crawling round it so a standing order reads as
  *live* and not as a boundary painted on the map. On both maps `drawFlagMark` draws the same
  ground washed in the side's ink under a dark rim and a solid line of that ink. It is drawn on the world canvas, so it scales with the tile — it is
  a place, not a HUD element. While a flag wheel is held over the world the same function previews
  the ring the pick would lay, in the lit wedge's colour, or grey from the hub where nothing is
  chosen yet; over the chart the chart draws that preview itself.
- **Two colours for the glyphs, and they carry the stakes, not the order** (`FLAG_MINE` /
  `FLAG_FOE`, on the wheel's icons, the planted banner and the plant burst): DEFEND, GATHER and
  RALLY wear the game's standard bright ink, ATTACK the danger red. The *glyph* says which order it
  is; amber and green are already spoken for (affordable / interactable, and good) and an order is
  neither. The ring says whose ground, in the side's ink — the one colour the whole side already
  reads on every nameplate and map mark.
- **The planted flag**, `drawFlag()`, y-sorted into the world draws half a pixel behind its own
  tile so a flag on a tree isn't swallowed by the canopy: a pole with a **dark banner carrying the
  order's glyph inked in the team's colour**. Dark cloth and a bright glyph, not the reverse — at
  nine pixels square a solid colour with a hole punched in it is a blob, and the glyph is the
  message. Only your own side's flags are drawn (an order marker is not intelligence to hand a
  rival, and neither is the puff it lands with — `plantFlag`'s burst is the local side's only), on
  all three surfaces.
- **Both maps**, through the shared `drawFlagMark()`: the pennant in the team's colour with the
  ring it covers about it at that map's px per tile — a disc on the minimap (clipped to the disc,
  so a flag just off its edge shows as its rim) and the same on the chart, with the glyph over it.
