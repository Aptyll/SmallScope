# Pathfinding

Everything that walks to a goal on its own — robots, bots, hunting wolves and patrolling
ones, prey both fleeing and grazing, any future enemy — routes through the `pathfinding` banner
rather than steering straight at it.
`findPath(sx, sy, gx, gy, reach, budget, e)` is grid A* over the tile map: a tile is `walkable()`
when it is in-world, not `isSolidTile` for the walker `e` (its own side's gates stand open; `navTo`
passes the unit, `navLineClear`/`navSmooth` carry it on), and not open water (`waterAt`: an ice hole or the creek); eight-connected with no
corner cutting (a diagonal needs both orthogonal neighbours open, so a unit of radius ≤ 5 never
clips a tree walking centre to centre); octile heuristic; typed-array scores stamped by a
generation counter so nothing is cleared between searches; a binary heap; no `rng`, so it is
deterministic. `reach` is the Chebyshev distance at which the goal counts as reached — 1 lets a
unit path to a tree it cannot stand on (and is exactly `WORK_REACH` for a bot's swing). A search
that exhausts `NAV_BUDGET` (700 expansions, ~a 25-tile detour) returns the route to the closest
tile it saw with `path.partial = true`, so a far goal still gets a first leg and a later replan
finishes it; only an enclosed goal (or an unwalkable one with reach 0) returns `null`. A full
search is cheap enough that dozens of units replanning several times a second is noise.
A tile can charge a **toll** (`navToll`, extra steps per step onto it): ground a walker can
stand on but should not linger on, so a route goes round unless round is much further. The one
toll today is [the orca's](wildlife.md#the-orca) ice (`ORCA_TOLL`, set by `spawnOrca`); the lane over its
lake charges none, so the bots keep to the road (the waves go round it by a ford:
[Soldiers](robots.md#soldiers-the-waves)). The straight line a plan tries in
place of a search, and `navSmooth`'s string-pulling, are `navLineClear` with `free` set, which
refuses a tolled tile, so neither cuts across ground the search went round.

Units do not call `findPath` directly. `navTo(e, gx, gy, r, reach, dt, budget)` (the last optional: a bigger
search budget for a walk into a corner's forest — the bots' `AI_ROOST_BUDGET`, ai.js) keeps a route on
`e.nav` (`{ path, i, gtx, gty, replanT, fail, stallT, … }`, created lazily on any entity) and
returns `{ dx, dy, d, ok }` — the unit direction to move this frame, the straight-line distance
to the goal (callers keep their own arrive radius), and `ok`. A plan first tries
`navLineClear()` (the same four-corner test `moveEntity` makes, every 4 px) and takes a direct
line when it is open, else A* plus `navSmooth()` string-pulling; it replans when the goal moves
more than a tile, every `NAV_REPLAN` (0.6 s), or — through `navStep()` — when `moveEntity`
reports a wall. **`ok = false` is the give-up signal**: the goal is unreachable, or the unit has
made no progress for `NAV_STALL` (1.6 s — pinned by other units, which routes ignore and
`separateUnits` resolves). There are no stuck timers anywhere else; a caller that gets `false`
drops the goal (robots and bots blacklist it for 12 s). A failed goal is not searched again until
`replanT` runs out. `navStep(e, gx, gy, r, spd, dt, reach)` wraps `navTo` with the
`moveEntity` call and `mvx/mvy` for the animal/robot movers; players (bots) take `navTo`'s
direction into `p.input` and move through their momentum. `navClear(e)` forgets a route.
`DBG.showPaths = true` draws every live route (`drawNavPaths`: bots gold, prey green, wolves
red, robots blue), and `DBG.findPath`/`DBG.walkable`/`DBG.navTo` are exposed for staging.
