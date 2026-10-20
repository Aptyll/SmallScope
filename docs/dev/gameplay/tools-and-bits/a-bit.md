# A bit

One entry in the `BITS` table, and there are two kinds of them, told apart by `proj`.

**Every bit has a `weight`**, projectile and modifier alike. The weights add up to the tool's
load (`toolLoad`), and a load heavy for the body's tensile makes the pull to full power longer
([the draw](../the-swing-tools-e.md#the-draw)). A heavy bit costs time, never a shot.

A **projectile bit** is one shot: `path` (how it flies), `solid` (whether a wall stops it), `ff`
(whether it will hurt your own side), `kb`
([knockback](#knockback-one-number-thrown-at-three-weights)), and
`life`/`speed`/`dmg` as baselines. Optional `lit` is a light radius it carries in
flight; optional `reach` widens every hit test past the tip (a bit with a *body* — the fist, the
axe); optional `body` names the silhouette the shots pass draws it as (`BIT_BODY`, js/draw/render.js);
optional `impact` names what it does where it *lands* (`BIT_IMPACT`, js/sim/tools.js); and
`bot: false` marks a kind no bot will load. A spent shot is simply gone — nothing lands to be
picked back up.

## Knockback: one number thrown at three weights

`kb` is a **multiplier**, not a speed, and 1 is the ordinary shove. It has to be, because the
three kinds of unit are already pushed at three different weights — a player at `HIT_KB` (110 px/s,
js/sim/player.js), a worker at `ROBOT_KB` (40, js/sim/robots.js), an animal on a curve off the draw
(25–70) — and one number written on a bit has to mean the same thing thrown at any of them. It
rides to `hurtUnit` as `o.kbMul`, which scales whatever shove that kind takes; `o.kb` beside it
is still the absolute px/s an *ability* picks for a particular blow. A shot with no `kb` at all
(a turret's rock, whose thump names none either) takes the ordinary shove, ×1.

The spread across the table is the point of the number: a WISP barely nudges (×0.3), an ARROW is
the baseline (×1), an ICE LANCE staggers (×1.6), a THROWING LOG flattens (×2.4) and a BIG FIST
throws a body across the snow (×4). The tooltip prints it as `x4`, the one bit row that is a
multiple rather than a quantity.

A **modifier bit** (`proj: false`) never flies, but it costs weight like anything else. Its
`mod(m)` edits the shot envelope — `spdMul`, `dmgMul`, `dmgAdd`, `lifeMul`, `fan` (one shot
becomes N in a spread), `dup` (the whole fan fired again), `lit`, and the fire quartet below.

Two rules govern it, and both are load-bearing:

- **It applies to every shot.** Where a modifier sits means nothing: it changes every projectile
  the tool fires, the built-in arrow included when nothing else is loaded. There is no wrong place
  to put one and no way to waste one.
- **It compounds with whatever is already there.** Every `mod` composes with the value it is
  handed — `*=` a multiplier, `+=` a quantity — and must never `=` or `Math.max` it. Two SPEEDUPs are
  four times the speed, two SPLITTERs nine shots, two FLAMEs twice as long at twice the rate
  (which is exactly a PYRE). **Every modifier added from here follows that rule**; the only field
  that is set rather than composed is `m.type`, because a damage type is a category and not a
  magnitude.

Eight exist: SPEEDUP, SPLITTER, DUPLICATE, HEFT, LONGSHOT, and the three that carry fire.

## Fire on a shot

`m.type` is the shot's **damage type** (`DMG_TYPES`, js/sim/actions.js — `blunt` unless a modifier says
otherwise), and `m.burn` / `m.burnDps` are the fire it leaves in the body it hits. The shot carries
all four onto the arrow, and every hit branch in the arrow loop hands them to `hurtUnit` — so a
flaming shot burns a rival, a deer, a bird and a worker bot identically, with no per-kind code.
What a burn then does is [status effects](../status-effects-one-set-for-every-unit.md).

| bit | tier | what it writes |
| --- | --- | --- |
| **FLAME** | KEEN, under SPEEDUP | `type: 'fire'`, `BURN_T` 3 s at `BURN_DPS` 6, `dmgAdd += 2`, `lit` 30. The flat bonus is small on purpose: the burn is where the damage went |
| **PYRE** | GILDED, under FLAME | the same fire, `PYRE_T` 6 s at `PYRE_DPS` 12 — twice as long and twice as hot |
| **CINDER BURST** | GILDED, under DUPLICATE | plain fire, plus `m.cinder` — a `CINDER_R` (26 px) ring lit where the shot **ends**, hit or miss. The multiplying lineage's finish: SPLITTER multiplies one bit's arms, DUPLICATE fires the fan again, CINDER multiplies the impact |

A tool holding only modifiers fires nothing, the same as one whose very first cell is already
heavier than the body can swing.

## The closing line: three bits that are not archery

BIG FIST → BIG AXE → TELEPORT REQUEST is a lineage about *arriving* rather than about shooting,
and all three are deliberately hostile to range.

| bit | tier | what it is |
| --- | --- | --- |
| **BIG FIST** | WORN | a punch: `FIST_T` (0.2 s) of flight at 300 px/s — about a body length — 16 damage and `kb` ×4. The short life is the whole trick: it is gone before it reads as a projectile, so the left button looks like a melee swing. `reach` 5 gives it a body rather than a tip |
| **BIG AXE** | KEEN | the same brief flight on the `curve` path, 20 damage, `kb` ×2, `reach` 6 — and `impact: 'chop'`, which is what makes it more than a heavy fist |
| **TELEPORT REQUEST** | GILDED | 620 px/s and 6 damage, a body that is not a shape at all, and `impact: 'warp'` |

All three carry `bot: false`: a bot has no pointer and cannot read a weapon whose point is
*where you end up standing*, the same refusal that already keeps boomerangs and orbits out of
its hands.

**What a bit does where it lands** is one row in `BIT_IMPACT` (js/sim/tools.js), called from the arrow
update only when the shot ended **on** something (`a.struck` — a wall, a tree, a body, the roost,
a dummy, a target face) rather than merely running out of life over open snow. That distinction
is the teleport's whole rule: a request that hits nothing takes you nowhere.

- **`warp`** — the shooter is standing where the shot stopped, rewound `WARP_BACK` (0.02 s) of
  flight so it lands *short* of what it hit. The spot is pulled onto a tile a body can stand on
  (`nearestDryTile`), so a request buried in a treeline puts you beside the tree rather than
  inside it; the jump rises you out of the snow and drops the fish hoist, the way any hit does.
  The tell is `warps` — the character stamped as a flat violet silhouette every `WARP_STEP` (11
  px) of the line crossed, up to `WARP_MAX` (14) of them, fading together over `WARP_FLASH_T`
  (0.34 s) and **never at the arrival**, because the body is already standing there
  (`drawWarps`, js/draw/render.js; aged in `updateFx`). Without the trail a teleport reads as a body
  blinking out of existence rather than as a path.
- **`chop`** — one chop into every tree within `AXE_CHOP_R` (26 px) of where the head stopped,
  the struck tile included. It is the same blow an E swing lands (`chopTree`, js/sim/actions.js —
  gold, stump, fell payout and the rare pine's jackpot), routed through `contest()`
  on the same `work:` key, so an axe and a swing on one tile in one step are one chop. Three
  throws fell a pine, and they fell its neighbours with it.
