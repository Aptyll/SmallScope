# Overhead health bars

Beside the bar sits the other thing drawn on every body alike: **`drawUnitStates(e, px, py, w, h,
now)`** ([js/sim/abilities.js](../../../js/sim/abilities.js)) paints the net drape, the root's sprung jaws,
the fire and the mark's gold chevrons over whatever sprite is wearing them, taking the sprite's own box so
a rabbit, a soldier and a player get the same four tells at their own size. `drawPlayer`
reaches it through `drawAbilityOnPlayer` (which adds the one a player alone can show — a raised
shield); `drawAnimal`, `drawBird` and `drawRobot` call it directly. **The
fire never washes over the body** — tongues off the crown and a lit row under the feet — because a
burning rival still has to read as the rival it is; the embers themselves are particles, thrown by
`updateBurn` rather than drawn here. What each state *does* is
[gameplay.md](../gameplay/status-effects-one-set-for-every-unit.md).

**The three bars over a body are three colours, never three shades of one**: health in the side's
paint, stamina white, the draw meter gold (the palette is one block above `drawHealthBar` in
[js/draw/overhead.js](../../../js/draw/overhead.js); the cursor's bow ring, the aim line and the mouse icon
read the same two golds, so "full draw" is one colour everywhere).
`drawHealthBar(cxp, topY, hp, maxHp, w, team, col?)` draws a small bar above every unit, always visible
— every player (in `drawPlayer`), animals (in `drawAnimal`), robots (in `drawRobot`), a hurt
building — **painted by side** (`barCol`): the team's `mark` through `skin()`, so it is blue over
you and your allies and red over rivals on your screen, and neutral gold (`BAR_NEUTRAL`, the WoW
grammar) over wildlife, the practice dummy and anything handed no team (under a colour-blind
palette a rival's bar wears a raised dark cap on its right end, `foeCue`). Health reads in **even
segments**: N blocks of one width with a 1 px dark tick between (`hpSegCount`), so a `w`-wide bar
splits only where `w + 1` divides by N, and every bar width is picked for that (`evenBarW` snaps a
free one); of the counts a width allows, the one nearest `maxHp / HP_SEG` wins, so a bigger pool shows more segments. `col` overrides the side
for the bars that are not health, every one hung under the health bar the way a player's stamina is
(3 rows down, sharing a frame wall; **health is always the top bar**, at the same height on every
animal): a camp monster's leash (`THREAT_COL` red, bare track at rest:
[gameplay.md](../gameplay/wildlife.md#camp-monsters-neutral-until-hit)), a deer's sprint and a
rabbit's dodge charge (both `STAM_COL` white, at the health bar's own width:
[gameplay.md](../gameplay/wildlife.md)) — every second bar always worn, since **the level plate
spans both**: `drawLevelBadge(rx, topY, level)` is the one 7-tall badge a hero and a beast
share, hard against the bar backing's left column and growing left with the digits, so a
rabbit's frame is the player's frame at 8 px. **A bear's frame is its body's size**: its
`MONSTER.frame` (`BEAR_FRAME`) draws the whole frame, bars, plate, `!` and stars, `s` (2) pixels
to its own pixel (each drawer takes that scale), a `w`-pixel bar cut into a fixed `segs` (5)
instead of `hpSegCount`'s, and centres it whole, plate and bar together, on the bear's centre
column, where every other frame centres its bar (`drawBeastFrame`). An empty bar is bare track (`drawHealthBar`
paints no fill at zero; a living thing's last sliver of hp is still a pixel). Over the frame,
where the stun stars turn, an animal that has a player in sight wears the **noticed mark** —
`drawSenseMark`, the font's `!` under a dark rim, white on prey and threat red on a camp monster,
rising out of the head over its first tenth of a second and gone the frame the sight is
([gameplay.md](../gameplay/wildlife.md)); the stars win while a stun runs. How full a bar is carries the
health — never its colour: a bar that drained toward red would spend the rival's colour on
"hurt", and a hurt ally would read as an enemy at a glance. **Birds are the one exception** — 3 hp means every hit is a kill, and
a bar over something that small is all bar; `drawBird` draws the sprite lifted off its own shadow
by `a.alt` instead, which is the only read on how high one is.
The overhead bar is the **only** player health display (the heart sprites in
js/sprites/icons.js are baked but unreferenced). Above it sits one
more small meter — **the slot the hands report to**, and it carries three states that can never
overlap, since a meal puts the bow down and blocks the draw for its whole length: gold while
charging (`DRAW_COL`), one white blink (`DRAW_FULL_FLASH`, 0.12 s) and then pale gold
(`DRAW_FULL_COL`) at full draw — brighter, never a new hue: two discrete states, since a gradient
is unreadable at 14 px, and never orange, which beside a red rival's bar is two warm bars; slate
while the renock runs, pale gold the instant it comes back (the bow's own ready colour
— white is the stamina bar's); and **heal green** filling
left to right while a meal is being chewed (`FOOD_EAT`, [Food](../gameplay/food-the-meal-is-a-channel.md)).
All three are drawn for **everyone**, because each is a tell somebody can act on — a shot is
coming, a shot is not coming, a heal is coming and hitting them takes it away. The overhead stack
floats clear of the sprite: stamina plate at `py - 4` (white, `STAM_COL`, on every side — the one
bar with no side to it; every player, since the level badge spans both
bars), health at `py - 7`, that meter at
`py - 10` (inside the same frame, directly above the hp bar, the mirror of
the stamina bar; every gap row between two bars is frame ink, as on a beast), and the player's name tag in team colour at `py - 18`, a clear row above the meter's
frame. A **dawn shield** ([gameplay.md](../gameplay/the-dawn-shield.md)) adds its own row straight
above the health bar, built the way the meter is (`drawShieldBar`: two-tone dawn gold, light over
deep, cut into one segment per snowdrop with a pale glint on its first pixel — gold is the dawn's
and no side's, so it reads the same over a friend or a rival), and while it holds the meter, the
name and a bot's callout all stand `SHIELD_LIFT` (3) rows higher; an empty shield is not drawn at
all. It is never on the team rail. **The orca's count** ([the orca](../gameplay/wildlife.md#the-orca)) stands
over the frame, over the shield's row if there is one (`drawOrcaCount`: the whole seconds left of
`ORCA_LINE`, 3 2 1, one white number at `ORCA_COUNT_K` with a 1 px `BAR_FRAME` rim, hopping up a
pixel as each number lands), and lifts the rest `ORCA_COUNT_LIFT`; it is up only over the head the
orca is after. The name is on **every** player, the local one included: the name is the profile's
([architecture.md](../architecture.md#profilejs)), and yours is what the rest of the table reads over
your head, so hiding it from you alone would make it the one label in the game you cannot check. Every frame is one **opaque** ink, `BAR_FRAME` (the name outline's `#0f1632`), over one track grey, `BAR_TRACK`: a see-through backing came out a different colour on snow, on a pine and on another body's frame.

**The frame is centred on the body, and the bars pay for it (`FRAME_DX`).** Horizontally the frame
is a 6 px level plate hard against the 16 px bar backing — 22 px at one digit; the plate sizes
itself to the number and grows *left*, so a two-digit level (the cap is 12) overhangs the way
the stun plate does on the right — and it is the *frame* that has
to straddle the sprite, not the bars inside it. So the whole stack is drawn `FRAME_DX` (3 px) right
of the sprite's own centre: `fx = round(p.x - ex) + FRAME_DX` is the stack's centre column and
everything in it hangs off that, giving `cx-11 .. cx+10`, exactly centred on the seam a 16×16
sprite is centred on. Measured off the canvas: a 22-column run from −11 to +10, centre 0.

**The stun plate is deliberately not counted.** It is a transient annex sharing the bar backing's
right edge (`fx+8 .. fx+13`), so a stun makes the frame 28 px and overhangs to the right until it
clears: the level badge is permanent and the stun plate is not, so the geometry follows the
permanent one. Turn the
[centre column](debug-overlays-hitboxes-and-routes.md#the-centre-column-hbmid) on under `.` before changing any of these numbers.

**The name tag is centred by `centreTextX`, on the body and not on `fx`.** It is not part of the
frame — it is a label on the model, so it takes the sprite's own centre. A glyph run is
an **odd** number of pixels wide at scale 1 (`pixelTextWidth` is `4n - 1`), so unlike the frame it
can never sit exactly on the seam — but it must at least sit on the same side of it every frame,
and `round(p.x - ex - w / 2)` does not: the half pixel the odd width carries lands on top of the
camera's own fraction, so which way it rounds flips as the model walks and the tag hops a pixel
left and right against a body that is holding still. `centreTextX` rounds the position first (the
once-and-only-once rule in [CLAUDE.md](../../../CLAUDE.md)) and then steps back a whole number of
pixels, `w >> 1`, which puts the run's **middle column** on `round(sx)` — the column
[hbMid](debug-overlays-hitboxes-and-routes.md#the-centre-column-hbmid) draws, so the overlay runs straight down the middle glyph. Use it
for any text centred over a model; free-floating text (damage floaters, wheel labels) is not
centred on anything and keeps its own maths. A player with a bounty wears it centred over the tag,
`BOUNTY_LIFT` rows up with a clear row between (`drawBountyTag`, js/draw/overhead.js): a 5 px gold
coin on a 1 px ink rim and the gold in the purse's ink; a bot's callout stands over it.

**Every other bar in the game is centred on its model directly** — an animal's frame carries the
level badge too, but its bars stay on the body's own centre and the badge simply overhangs to the
left, the way a stun plate overhangs right, so nothing but a player needs `FRAME_DX`. `drawHealthBar(cxp, …)` centres an even-width bar on `cxp`, and
every caller hands it a true centre: `a.x - ex` for an
animal (whose sprite is placed at `round(a.x - w/2 - ex)`), `b.x - ex` for a robot, and the centre
of the **footprint** for a building — `sx + sh + (spr.width >> 1)`, which is where the sprite
centres itself, `+ sh` so the readout rides the hit shudder with the thing it belongs to rather
than holding still over a wall that is rocking. Bar widths are kept even for the same reason the
sprites are.

**The whole stack hangs off one `hy`**, not off `py` directly (`drawPlayer`, js/draw/bodies.js).
It drops 6 rows for a [prone](../gameplay/prone-under-the-snow.md) pose, which starts that much
lower in the same 16×16 cell — bars floating over a head that is not there look broken; it lifts
4 rows while a caught fish is hoisted (the hoist holds the fish where the plate would sit), and
by the lift + 5 for a zipline rider, so the frame rises with the body and clears the handle; a
worn skin body (the IRON SCOUT) lifts it to its own head, `top` rows under its frame's top. And
its alpha fades with
`concealOf(p)`: name tag, both bars, the level badge and the draw meter that says a shot is coming
all go with the cover, weighted so you keep a readable copy of your own (×0.55), your side keeps
most of theirs (×0.7) and a rival keeps none (×1, skipped entirely below 3%). A buried rival whose
draw meter still showed would make the whole thing pointless.
