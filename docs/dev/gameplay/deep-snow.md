# Deep snow

The DEEP band of the [snow depth map](../world.md#snow-depth) slows **every** walker, not only
players: each unit carries `e.wade` (0..1), eased toward whether its feet (`y + 4`) are in deep
snow at `DEEP_EASE` (~95% in a quarter second, and back out as fast) by `wadeStep`, which
`updateUnitStatus` runs for players, animals and robots alike. A body in the air, on the cable,
in the water or dead is in none of it. The numbers ([js/sim/depth.js](../../../js/sim/depth.js)):

- **Walking: `DEEP_WALK` 0.7.** `wadeMul(e)` folds into a player's `walkMax` (so it stacks with
  a drawn bow, a cast and the rest) and into `unitMoveMul` for everything else. A player at 75
  px/s eases to 52 over about 0.4 s going in (the snow's overspeed decay spends the rest) and
  is back to full within a quarter second out.
- **Dodge: `DEEP_DODGE` 0.85 of the travel.** The roll's displacement is scaled, not its
  velocity, so what it hits for and what it carries out are the dash's own (61 px of roll
  becomes 52).
- **Sliding: friction x`DEEP_SLIDE` (2)** on a snow slide in it, and no slide *starts* with the
  wade past `DEEP_SLIDE_BAR` - you can slide in, and the drift eats it.
- The walk cycle keeps time with the speed the wade leaves (`animT` steps with `spNow` over
  `PLAYER_SPEED`, updatePlayer, js/sim/sim.js), so a full wade strides 30% slower, and a wading
  body moving faster than 12 px/s kicks up a puff at its feet every `DEEP_PUFF_T`.

A rush, the grapple's reel and the zipline own their velocity and ignore it. Bots do not route
around deep snow (`findPath` has no cost for it); they walk through it slower like anybody.

**The look** (`drawWading`, js/draw/depth.js, around each body in `render()`): a body in it is
drawn `WADE_SINK` rows lower and cut at the snow's surface, with a collar of drift round the cut
that shivers while it moves. The draw eases its own copy of the wade on the frame's clock,
because a client's sim never runs; none of the `wade*` fields cross the wire (`SNAP_SKIP`).

The player (momentum, tools, dodge), the entities that share the world, the gold economy, what
you can build, and the supporting subsystems. Read this before changing how an input resolves,
what something pays out, or what a structure does.

Everything below describes **a player**, not *the* player: each mechanic runs per player off
`p.input`, and `player` is only the local player. [multiplayer.md](../multiplayer.md) covers the player
model, the input struct, teams, bots and how two players' orders are resolved.

> Several numbers below (ice cap, steer, slide threshold and fatigue, draw time and speed, arrow
> damage, dash speed, max hp) are **per class** — the constants are baselines the kits are
> written against and the sim reads them through `kitOf(p)`. See [Classes](../multiplayer.md#classes).
