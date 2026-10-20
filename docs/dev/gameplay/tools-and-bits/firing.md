# Firing

**One press is the whole tool, resolved in one frame.** Nothing cycles between presses and
nothing is left behind: every loaded shot leaves together, each wearing every loaded modifier.

`fireTool(p)` is the one entry point — the falling edge of `input.fire`, for every player alike:

1. Read the cover first (`ambushReady`), before anything below can break it.
2. No tool on the selected slot → `dryFire(p)` and stop. (A fish underfoot never takes the
   press — the catch is `autoFish`'s, [the swing tools](../the-swing-tools-e.md).)
3. `toolPlan(cell)` — the one function the whole weapon runs on, below.
4. A blade hands the plan to `slashTool`
   ([the cut](the-cut-a-melee-tool.md)) and anything else runs `emitBit` for each shot plus one
   `sfxAt('arrow', …)`; then `p.nockT = toolRof(p, cell)` ([the cycle](../the-swing-tools-e.md#the-cycle)) and
   `risePlayer` (the shot is what breaks cover).

## `toolPlan`: one activation, in one pass

`toolPlan(cell)` walks the cells once and returns `{ shots, load, tensile, spent }`
(`spent` is every loaded cell). It is
the *only* place the arithmetic lives, and the press and the [aim line](../the-swing-tools-e.md#the-draw) both read
it — so the two can never disagree about what the button is about to do.

- **Order means nothing.** Every modifier folds into one envelope, and every projectile is
  pushed onto `shots` with a copy of the whole of it (`mods` lists the modifier cells that power
  it). A SPLITTER beside two ARROWs fans both.
- Every loaded cell's weight is added to `load`, which only slows [the draw](../the-swing-tools-e.md#the-draw).
- **No shot loaded still fires.** A tool with only modifiers, or with nothing, fires the built-in
  `TOOL_BASE_SHOT` (a plain ARROW, `i` -1, `base`) wearing whatever modifiers are there. It takes
  no cell, cannot be dropped or sold, and steps aside the moment a real shot is loaded.

`peekBit(cell)` is `shots[0].id` — the lead shot, what the aim line is drawn for.
`toolLoad(cell)` is the row's weight.

The cells keep themselves in order: `sortBits(cell)` puts projectiles on the left, modifiers on
the right and empty cells between, and `bitPut` runs it on every placement, so the row a player
sees is always shots then fittings however the bits went in.

`emitBit` is where the player is folded back in: `bitDmg(p, b)` is the hero's DAMAGE stat
(`statOf`, [hero stats](../hero-stats.md)) plus however much more or less this bit hits for than the
class's own bit, the kit's speed bonus (`spdDmg`) adds to it, **the draw
scales the whole sum** (`drawDmgMul`, [The draw](../the-swing-tools-e.md#the-draw)) and then the modifiers scale that —
so items, cards and levels all still matter to a weapon they know nothing about, and a spammed
level-twelve bow is still a weak one. Speed and life come from `shotFlight(b, m, pw)`, the same
envelope the aim line measures. The shot goes into the `arrows` array carrying
`path`, `solid`, `ff`, `kb`, `reach`, `body`, `impact`, `type`, `burn`, `burnDps`, `cinder`,
`lit` and `col` beside its position, velocity, damage, owner and team.

`toolReady(p)` is the only refusal besides the cycle: an empty weapon slot is dry, and
`updatePlayer` refuses the draw on it (`dryFire`, the slack-string tell). A tool in hand always
fires.

Every bit a press fires leaves in the **same frame**, so no two of them may be stacked inside
one another: each bit past the first is nudged `SHOT_SKEW` (0.05 rad) off the aim, alternating
sides, and a DUPLICATE's repeats `DUP_SKEW` (0.07) — per *bit* and per *repeat*, never per arm of
a SPLITTER's fan, which already spreads its own arms `FAN_SPREAD` (0.16) apart. Where arm *k* of
repeat *d* leaves is `armOff(m, k, d)`, and the piercing shot lays its volley out through it too.
