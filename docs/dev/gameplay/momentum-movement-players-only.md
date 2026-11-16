# Momentum movement (players only)

A player moves on a real velocity (`p.vx/vy`): `p.input.mx/my` accelerates, and the surface
underfoot sets friction and speed caps. All the tuning constants live in the `players` banner of
[js/sim/player.js](../../../js/sim/player.js) (`ICE_MAX`, `SLIDE_MIN`/`SLIDE_EXIT`, `TRAIL_MIN`, above
`CLASSES`, whose kits are written against them) and the per-surface rates inline in
`updatePlayer()`'s movement block, which every player runs. **Momentum is deliberately players-only**
— animals, robots, and knockback move directly (a direction times a speed through `moveEntity`).

**Facing** (`p.dir`, the sprite a body shows) only ever changes through `faceToward(p, dx, dy, hold)`
in the `facing` banner of js/sim/player.js: the walk, a draw's aim, a raised shield, a work
swing and every aimed action. Near a diagonal the axis the body already faces wins
until the other one leads by `FACE_BIAS` (1.25), so walking or aiming along 45 degrees does not
flick between two sprites each frame. A shot, a slash, a cast, a rush and a roll pass `hold`: the
body keeps that facing for `FACE_HOLD` (0.15 s, `p.faceT`) and the walk cannot turn it straight
back on the next frame. A draw and a shield still turn it every step.

- **Snow at walking speed** uses a near-instant vector approach (settles in ~3 frames) toward
  `PLAYER_SPEED` (72) — crisp starts and stops, nothing floaty.
- **Everything faster** (ice, sliding, or overspeed on snow) switches to a steer-the-heading /
  ease-the-speed model: the travel direction *rotates* toward the input at a per-state rad/s
  rate (carving, never snapping), while speed eases toward a per-state target. Ice pumps
  toward `ICE_MAX` (150, ~2× walk) while a direction is held, glides on idle, and barely
  bleeds overspeed (what glides is `slickUnder`, js/sim/sim.js: the ice underfoot except the
  orca's pool, rough ice crusted with rime that walks like snow so its fight is fought standing;
  a rival hero's ice glides everywhere); snow kills overspeed (dodge exits included) in well under a second
  unless you shift-slide to keep it.
- **Dodge roll** is an impulse into the same velocity: `tryDodge()` sets `vx/vy` to
  `max(DODGE_SPEED, current speed)` (a dash never slows you), the roll itself applies no
  friction, and the speed **carries out of the roll** for the surface to spend — so dashes
  chain into real speed on ice but die fast on snow. I-frames still end with the roll. That
  carried speed is also what the roll **hits** for — see [The roll is a hit](dodge-roll.md#the-roll-is-a-hit).
- **Shift = slide**: engages only above `SLIDE_MIN` (85), drops out below `SLIDE_EXIT` (55) or
  on release (hysteresis). Sliding keeps momentum across snow (low friction, reduced steering).
  Tools work normally while sliding — you can draw, hold, and loose the bow or E a tree
  mid-slide; only the hole-flounder and the dodge roll lock tools out. Snow slides have **fatigue** (`player.slideT`): friction ramps
  with slide duration, so the early glide is cheap but the tail drops off hard and a slide
  ends decisively (~2.2 s from full speed). The timer recovers while sliding on ice, so
  snow→ice→snow chains start each snow leg fresh-ish; ice slide friction itself is flat. Above `TRAIL_MIN` (110) it carves a surface-specific double
  trail: on snow, two-tone carved grooves (shadowed top row, lit bottom row — lit from the
  top-left like the rest of the art); on ice, thin frosted skate scratches. Marks are
  `k`-tagged entries pushed into the existing `footprints` decal array (cap 800) every ~2.5px
  of travel, interpolated along the path so a fast frame never gaps the line — never drawn
  into the pre-rendered ground canvas — plus snow-spray particle bursts. Snow grooves have
  their own short hold-then-fade life (`SNOW_TRAIL_LIFE` 3.5 s, fading only over the last
  `SNOW_TRAIL_FADE` 1.4 s), so a trail stays crisp and then wipes away tail-first behind the
  player; ice scratches and walking footprints keep the original 9 s linear fade.
- **Walls kill the blocked axis** (`blockedX` → `vx = 0`, same for y) in both the roll and
  normal movement, so you never grind along a treeline at full speed. A wall taken **head-on
  mid-roll** costs more than the axis: past `TACKLE_MIN` of speed driven into it, that is a
  [tackle](dodge-roll.md#the-roll-is-a-hit).
- Walk animation and footprints key off actual speed (`sp > 8`), not input; sliding and
  ice-gliding use the standing pose. The stride's pace is the ground speed too (clamped to
  0.55-1.3 of a walk's), so a drawn bow's creep steps slower than a run and an ice run a
  little quicker. `die(p)` and `Player.reset()` zero `vx/vy` and clear
  `sliding`. Footprints and slide trails from every player share the one `footprints` decal array.
