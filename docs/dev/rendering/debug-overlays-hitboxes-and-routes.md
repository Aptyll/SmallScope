# Debug overlays: hitboxes and routes

What the sim tests, drawn over what the art shows — the two are deliberately different (a tree's
canopy overhangs the tile above it; an arrow is tested against a circle at the *chest*, 6 px above
the feet), and every collision question is faster to answer by looking than by reading. One key:
`.` toggles `settings.hitbox` in **any** mode, beside F3 and for the same reason — the title
screen's world is live and a spectated match is someone else's feet:

| `settings.hitbox` | draws |
| --- | --- |
| `0` | nothing (default; persists under the profile like every other setting) |
| `2` | bodies (tile boxes, unit circles, projectile points, pickup radii) plus the route every walker is following |

Colour carries the kind, so there is nothing to label: **cyan** a wall to everyone (`isSolidTile`,
so a multi-tile building boxes each of its footprint tiles; the cistern's stone, held by the pixel,
is its footprint's edge px instead, with a green ring round the feet of each body near it:
`drawCisternHitbox`), **blue** open water — a wall to
animals and robots, a hole a player falls into — **green** the body circle
`moveEntity`/`separateUnits` push apart, plus a dot on the anchor point itself, **red** the circle
an arrow is tested against (on a standing building, the box of its drawn art — `structShotBox`, past the cyan footprint wherever the art stands past it), **violet** a walk-over pickup or a click target, **gold** a projectile
(a point, never a circle), **pink** the model's own centre column (`hbMid`).

Every shape is read from the expression the sim uses, never a copy of the number — an overlay that
disagrees with the sim is worse than none, because it is believed.

## The centre column (`hbMid`)

The one shape here that is about the **art** rather than the sim. The overhead frame — health bar,
stamina bar, level plate — is the only thing in the game that has to line up with a *sprite*
instead of with a number, and nothing else on screen shows where a sprite's middle is; a frame
three pixels off centre is invisible until something draws the line. Every player, animal, robot
and building gets one: movers off `ex`/`ey`, buildings off `ox`/`oy` (the same corner since the
sub-pixel camera) and from the centre of the **footprint**, which is what a structure sprite centres
itself over whether or not it is wider than its tiles.

Every sprite in the game is an **even** number of pixels wide and centred on the seam between its
two halves, so the true middle is a pixel *boundary* and no 1 px line can sit on it. `hbMid` draws
at `round(centre)` — the column just right of that seam — which turns the test into a count: a
frame that is genuinely centred has as many columns strictly left of the line as it has from the
line rightwards. It is dotted so the frame it is measuring reads through it.

**Reaches and sight ranges are deliberately not drawn.** `WORK_REACH`, a wolf's bite and a camp's ground, a
road tower's range, the bird flush, the fish catch: they are wide enough to bury the 7 px
circle the overlay exists to show, and a sight range is per-target (`seenAt`), so it needs a
design of its own rather than a ring.

Both passes draw **above `renderLighting`** — the only world passes that do — because a debug view
has to be as readable at midnight as at noon. Rings are rasterised by `hbRing` as 1 px world
pixels rather than stroked with `arc()`: a stroke is anti-aliased, and the world blit magnifies a
soft edge into mush. It plots the left/right extremes by row and the top/bottom by column, so the
ring closes at every radius and a fractional one (`PLAYER_R` is 4.5) is not rounded away. `hbLine`
is the same idiom for a straight run, and its `step` is what dots a planned route leg.

## Routes

`drawNavPaths` runs from the same place, one layer under the hitboxes, because a route is on the
ground and a body stands on it. It draws the **plan, not the walk** — the line leaves the unit,
runs through the waypoints it has left (`nav.i` onward), and ends in a box on `nav.gtx`/`nav.gty`,
the tile the unit decided to go to, which is the answer to *why is it walking over there*. The leg
it is on now is solid and the legs beyond it are dotted, so a route being followed reads
differently from one being replanned. One colour per kind of walker, as on the minimap: players
gold, a camp monster red, the rest of the wildlife green, a soldier blue.

Most routes are one leg: `navTo` takes the straight line whenever `navLineClear` allows it and
`navSmooth` collapses the rest, so a chain of waypoints means the unit is genuinely going around
something. `DBG.showPaths` still forces the same pass on by itself, whatever `settings.hitbox` is.

**Everything that walks has one of these**, grazing and patrolling included — see
[wildlife](../gameplay/wildlife.md). That is what makes the overlay readable: a line always shrinks
into its box and ends on the tile the walker actually stops on. Wandering is a routed goal like
any other; a mover steered by a heading on a timer would have no `nav` and nothing honest to draw.

The two exceptions are the two things that don't walk:

| Not a walker | Drawn as | Why |
| --- | --- | --- |
| a bird in flight | straight dotted line to `a.perch` + the goal box | it flies over the route grid, but the perch it's coming down on is a real decided destination |
| a fish | `hbArrow` — a barbed heading stub, teal, **no box** | it steers (`f.a`) and genuinely has nowhere it is going; a box would claim a destination that doesn't exist |

The arrowhead is the whole tell: **a barbed stub is a heading, a line ending in a box is a walk to
a decided place.** Keep that split if you add another mover — draw the box only when there is a
goal tile to put it on.
