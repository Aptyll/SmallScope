# The cut: a melee tool

The LONGSWORD is the one body with a `melee` block in `TOOLS` (`reach` 28 px of blade at full
draw, `half` 1.05 rad of sweep either side of the aim), and that block is the whole difference:
`fireTool` runs the same press, the same `toolPlan` and the same cycle, and then hands the plan to
`slashTool` instead of `emitBit`. **The draw is still the throttle** — a tap reaches
`SLASH_REACH_MIN` (60 %) of the blade for `DRAW_DMG_MIN` of the damage, a full draw the whole
blade at its whole worth (`slashReach`) — and **every bit in the plan is one cut of the same
swing**: its damage through `emitBit`'s own sum (bit, kit, level, the draw's multiplier, the
modifiers' `dmgMul`/`dmgAdd`, the ambush), its modifiers' damage type and fire on every body the
edge reaches. What the edge reaches is the **wedge** — `inCone`/`unitsInCone`/`structsInCone`
(js/sim/actions.js): a body counts by its centre plus its own radius, a building by any tile of its
footprint — and nothing else: a body behind the caster is never cut. A bit whose whole point is its
flight (a boomerang, a lob, an orbit) swings as a plain cut worth its damage; the sword is a place
the fittings you found can still go, not a second arsenal. Each cut leaves its wedge on the snow
(`slashes`, `SLASH_T` 0.28 s, ticked by `updateSlashes` from `updatePlay`) — the outline in white,
gold when it landed, with a bright edge sweeping across it — drawn by `drawSlashes` (js/sim/abilities.js,
called from js/draw/render.js beside the E swing arcs), and the local player's draw grows the same wedge
in place of the aim line (`drawAimLine`), so the reach the cut is about to have is on the ground
before it lands. **The hand swings the sword itself**: the blade is drawn at its real 22 px length
(`TOOL_HELD_ART`, baked as `toolHeld_<art>_<tier>` beside the 12 px bag icon, and used wherever the
hand holds a tool that has one), a draw winds it back to the start of its arc, and for `SLASH_T`
after the loose (`p.slashT`/`slashA`/`slashHalf`, counted down in `updatePlayer`) `drawHeldTool`
sweeps it across the wedge pivoting at the hands, two ghosts of it trailing, in front of the body
whichever way it faces. A bot with a blade fights at `AI_MELEE_D` (18 px) instead of a bow's 70, and
only presses fire once the target is under the edge (`aiMelee`, js/ai/ai.js).
