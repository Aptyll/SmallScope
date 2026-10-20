# The team rail

`drawRailScaled` (the `team rail` banner, js/ui/rail.js) is the roster and the score: one thin plate
(`drawHudFrame`) centred on `VIEW_W` at `RAIL_Y` (`MM_GAP`, level with the minimap's outline), Dota's top bar kept clean and minimal.
**Your side's chips on the left**, the rival's on the right, and between them the **score well**
(`drawRailScore`, no panel of its own): the match clock (`clockTxt(state.elapsed)`, the one clock
a match shows) on top, and `RAIL_LINE` under it the two kill totals at 1x in their sides' `mark`
either side of a quiet colon (`railKills` sums `p.kills` over every player who wore the side's
colour). A **chip** per active player (`railLayout`: `RAIL_CHIP`, `RAIL_GAP`, `RAIL_PAD`) is the
hero's **face** (0.536): `drawFace` (js/ui/hud-draw.js, the announcer's, the death recap's and the post-game lobby's
too) puts the model the player wears (`portraitSprite`: hero, skin, team paint) at 2x in a 14px
window over the strip portrait's dusk, inside a 1px `HUD_INK` rim. Under it the side's **hp bar**,
hung a pixel under its foot, one solid 2px run of the side's `mark` on a `RAIL_TRACK` groove,
deliberately unsegmented. `railSides` orders each side by id with **you first** on yours (0.536:
five a side, a proper 5v5; until then you were left off for the strip's sake). A side a seat
short still keeps the score well, not the plate, on the view's centre (`span` is the plate's
reach either side of that, what `railSc` caps on), so the clock never drifts. A chip's state,
Dota's top bar read plainly:

- **up**: the face, the bar full or not;
- **waiting**: a dead player with `respawnT` running — the face under `RAIL_WAIT_DIM` and the
  whole seconds left (`Math.ceil(p.respawnT)`) over it in `RAIL_WAIT`, outlined; the bar is bare;
- **out**: `eliminated`, or dead with no countdown (its bird already driven off) — the face under
  the darker `RAIL_OUT_DIM`, the bar bare.

A rival's face, hp and state read fields the fog leaves on a hidden rival's stub (`cls`, `look`,
`skins`, `hp`, `dead`, `respawnT`...: `SNAP_FOG_KEEP`, js/net/snapshot.js), so a client draws the
same rail as the host. No names on the plate: under the pointer a chip's rim turns `RAIL_HOV` and the
[tooltip](the-hover-tooltip.md) carries the words (`tipRail`, through `railHit` in `tipAt`): the
name in `playerTint`, the class, the level, and the countdown or OUT while the body is down — the
scoreboard's own line. *Where* anyone is stays the minimap's job.

It is drawn straight after the minimap in `renderUI` (under the counter's wash with it), rides
the intro slide up by `RAIL_SLIDE`, and **stays up while you are dead** — the side's state is
what a spectator reads, so the spectate control (`specLayout`, js/ui/screens.js), the surrender vote and the
announcer's plate all hang `headlineY()` under `railBottom()` (14 from the top when there is no rail:
the practice arena, or a match with an empty side — `railSides` is null, nothing draws, and the
clock goes back under the minimap: `mmClockShown`), and
the announcer's plate steps under the spectate control and the vote as well while they are up (`noteY`).
**Its scale is its own dial**, TOP BAR SIZE: `railSc` is `settings.hudRail` at its nearest stop
(`hudPick`), capped on the device grid where the plate would reach the view's edge or come within
`MM_GAP` of the minimap's outline (`railCap`);
the bake is blitted about the **top-centre** anchor and `railMouse` maps the pointer back through
it.
