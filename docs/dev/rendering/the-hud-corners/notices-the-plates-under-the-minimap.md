# Notices: the plates under the minimap

The HUD's corner for news from where you are NOT: the `notices` banner in [js/ui/notices.js](../../../../js/ui/notices.js),
raised by `raiseNotice(kind, txt, good)` and drawn by `renderNotices()` from `renderUI`. Two kinds
use it: **your roost being struck while you are elsewhere** (`roost`, raised from js/sim/eagle.js
*as well as* the line it puts in the [event log](../scoreboard-and-event-log.md), which is not drawn),
and your own [stat sheet](the-stat-ledger-your-sheet-as-a-notice.md) moving (`stats`).

**One shape, read left to right, with no sentence in it**: the **mark** of what the news is, then
what it is about, then one 8×8 glyph carrying which way — an arrow up or an arrow down. That row is
`noteBody`, the **default**: a kind may bring a `body` of its own instead, which is how the
[stat sheet](the-stat-ledger-your-sheet-as-a-notice.md) rides this lane carrying a ledger.

**A plate is its kind's size.** `noteW(K)`/`noteH(K)` answer off the kind (78×22 unless it says
otherwise), the lane **sums** the heights above a slot rather than counting a pitch, a plate slides
its own width clear of the edge, and the newest shoves the stack down by *its* own height. Nothing
in the lane is special-cased for the tall one. `noteLaneFloor()` is where the lane stops — the top
of the hud strip's xp numbers at the strip's size (`hudSc`) — and a plate that would cross it is not
drawn, which on a short view drops the **oldest** news and keeps the newest.

The mark sits in a sunken well at the plate's left. It is **stamped**, not blitted: `NOTE_KIND[k].glyph` into
`NOTE_MARKS`, one pixel grid per glyph (16 wide, in the tails' own grid language) so the draw
never grows an `if` per kind. `renderNotices` stamps it with `stampGrid` (js/ui/screens.js),
filling `h` with your side's ink through `skin(player.team)` over a dark rim — the reason to
stamp rather than bake, since a baked sprite cannot be recoloured per team. The `roost` plate's
is `bird`: a soaring raptor from below (head, swept wings, tail), **not** the maps' objective
diamond — `drawMapBird(g, x, y, col, rim)` is one 7 px size only, and blown up to 2× it reads
as a medical plus beside the arrow tail on the same plate. Its text is the **nerve the bird has
left**, as a percent, under the falling tail — the plate says what happened where the cue
(`SFX.alarm`) only turned your head: a cue for the ear, a number for the eye.

What it is about is the number, with an item's own icon before it when the notice's `good` names
one, **sized together**: `runW(s)` measures the pair at a scale and the icon is drawn at the text's
own, so both drop from 2× to 1× together if a headline is too long for 2×. The roost plate names no
good, so it is text alone.

The plate is a fixed `NOTE_W`×`NOTE_H` (78×22) card — 78 is what the content well needs, the 22 of `60%` at 2× over the 30 the mark's well and the
tail's gutter take
— and `noteCard` is the whole
of what makes it read as a stamped tag rather than as a rectangle: a shadow offset under it,
**corners notched** off (`noteBox`, which draws the shape as three bands), a lit top edge and a
shaded bottom one for the bevel, an opaque dark base under the kind's wash, a 1 px frame in its
accent (`noteFrame`), a sunken well behind the mark, and the kind's ink **draining along the base**
as the plate's own remaining life — the only place its 8 s is written down, and it is written as a
length. Text is the `drawPixelTextShadow` font, because the whole plate fades and an outline
stamped under a `globalAlpha` goes blotchy ([text over the world](../text-over-the-world.md)). `NOTE_KIND`
holds the palettes, and the roost's is handed straight to `logEvent` as its colour override, so the
plate and the feed line can never disagree.

`noteRect(k)` places slot `k` off `MM_*` — right edge flush with the disc's own, `NOTE_GAP` (18 px)
under its rim, so the column follows the minimap wherever the size dial and the view put it and
never lands on the clock. **The newest plate is slot `k = 0`**, hard under the disc, and its
arrival pushes the stack down: it flies in `NOTE_SLIDE` (30 px) off the right edge over `NOTE_IN`
(0.55 s) while the plates below ease down a whole `NOTE_PITCH` on that same curve. They are drawn
**oldest first** so the newest lands on top of the stack it is shoving.

**The arrival is a beat, not a fade-in.** There is no alpha ramp: the plate is opaque from its
first frame and a white **flash** covers the pop instead — `NOTE_FLASH` (0.45 s) of three pulses
under a decay, the first a near-white card and the two after it the plate blinking as it slides
home. The frame goes white whole while the field only washes to 0.85, because past the opening
peak the card still has to be readable — a flash you cannot see through is a blink. The exit is
the entrance run backwards, sliding the same `NOTE_SLIDE` back out to the right as it fades, so
the corner reads as one lane rather than as things dissolving in place. `ageNotices(dt)` runs the
whole clock from `updateFx` on wall time like the feed's lines — `NOTE_LIFE` (8 s), leaving over
the last `NOTE_OUT` (1.2 s), at most `NOTE_MAX` (3) on screen. The timings are long on purpose:
this is news you are meant to look *up* for, and a third-of-a-second slide is over before a glance
can land on it.

They draw **above the counter and the character sheet** (news must never arrive behind a panel)
and stay up while you are down, like the feed. They duck under the map and settings
panels, and the end screens own the frame outright. Each kind carries its own cue:
[audio](../../gameplay/audio.md).
