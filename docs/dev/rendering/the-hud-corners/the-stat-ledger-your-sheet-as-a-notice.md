# The stat ledger: your sheet, as a notice

The answer to *what did that DO?* — the `stat ledger` block in
[js/ui/notices.js](../../../../js/ui/notices.js), watched by `updateStatLedger(dt)` from `updateFx` and drawn as
a [notice](notices-the-plates-under-the-minimap.md) kind. A hero level and an
item bought both rewrite the kit silently: the floater over the body names the *thing* taken and never the
*number* it moved, so until this plate the only place to read the change was the character panel — a
key press and a pause in the middle of a fight.

**It does not stand on the HUD, it arrives.** A change flies the sheet in off the right edge into
the lane under the disc on the same ease, the same white frame pulse and the same lane as a roost
plate, holds `NOTE_LIFE` (8 s), and rides back out the way it came — and it **shoves** whatever
plate was in the lane down under it exactly as a roost plate does. When nothing has changed there is
nothing on screen at all. The only thing about it that is not a roost plate is its **size**
(`STAT_W` 100 wide, `statPlateH()` tall), and every plate is right-aligned on the disc's own right
edge, so the wider one still reads as the same lane.

**Every row of the sheet is on it, dim, and the rows that moved are lit**: label and number to
white, a wash across the row in its verdict colour, and the delta printed in the leader's own space
between them — `+9`, `-15`, `+8%`, `-0.30S`, the magnitude in that row's own format behind the sign
it moved in. Those rows **pulse** for `STAT_PULSE` (1.3 s) on the card's own three-pulses-under-a-
decay flash grammar, so the thing you are meant to read is still blinking when your eyes arrive.
The stats kind sets `flash: 0` so the card's white wash never fires: on a plate the size of a roost warning
that wash *is* the arrival, but over seven rows it would drown the green ones that are the news,
so the frame pulses and the rows do the blinking. **Green is better and red is worse**, by the row's
own `dir`.

**One stats plate is ever up.** A second change inside the first one's life drops it and flies a
fresh one, so the plate is what your sheet is *now* rather than a stack of what it has been; a row
still inside its own hold comes along on the new plate until that hold runs out.

It **watches the kit** rather than hooking the writers — `levelUp` and `itemsChanged` land in it for free, a host's snapshot lands a client's the same way,
and nothing that edits a kit has to remember to announce it. The test is the **printed** number,
not the raw one: a change too small to move the row is one the plate cannot show, and a `+0` beside
an unchanged number would be a lie. One cue per batch (`SFX.stat(up)`), never one per row — a gold
card moves three numbers and is one thing that happened; its direction is the batch's balance, so a
card that trades health for damage still speaks.

It reads `STAT_ROWS` (js/sim/stats.js), the seven [hero stats](../../gameplay/hero-stats.md) as the one
table the [hero pop-up](../../rendering.md#the-hero-pop-up) prices a pick from and the
[character panel](the-character-panel-g.md) spells a body out with, so the three can never disagree
about what a stat is, how it prints, or which way is up. The getters take `(kit, player)`: the
**hero level** is not in the kit, so a live body is passed and its level read; the hero pop-up
prices a pre-match pick where every hero is level 1 and passes nothing (the kit says whose it is).

**Anything outside the seven lights nothing** — an item bonus to ice, the dodge, stealth,
hunts, fells, `killHeal` or `ambushMul` moves no row.
