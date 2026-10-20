# The hover tooltip

One panel saying what the pointer is on — the fifth deliberate carve-out from
[show-don't-label](../show-dont-label.md). Every well
still has to read at a glance with the panel shut, which is what the item rims and the cooldown
sweeps are for.

**Where it sits is the player's**, and `tipPos(w, h)` is the only thing that answers — the TOOLTIP
row on the ESC panel's GAME page (`settings.tipFollow`, default **on**):

- **FOLLOWING** (the default) rides it beside the pointer, so the numbers arrive where the eye
  already is. `TIP_GAP` (11 px) is measured **sideways**, because every cursor glyph and the 18 px
  drag ghost reach further below the hotspot than beside it — one sideways step clears the lot
  without flinging the panel away from the thing it describes. The head row sits level with the
  pointer (`y = my - TIP_PAD`), the panel flips to the pointer's other side rather than cross the
  right edge, and both axes clamp `TIP_EDGE` (4 px) inside the view, so a hover in any corner reads.
- **FIXED** parks it bottom **left**, the corner the pointer is furthest from while it hovers the
  backpack or a wiki row — so the panel can never cover the well beside the one
  being read, and nothing else lives in that corner.

`DBG.tipRect()` returns the rect the
panel is painted at this frame, which is how the two modes are read without eyeballing pixels.

**`tipAt(mx, my)` is the only source**, and it asks the same hit-testers the press handler
does, so what the panel describes and what a click would do can never be two different things.
In `play`, in order: the merchant's counter (`shopHit` → `tipShop` — first, so a drag held over
its sell well is priced rather than merely described), then a **live drag** (whatever is on the
cursor describes itself, `tipCell`), the character panel's item slots (`charItemHit`, answering `tipItem`), a rail chip
(`railHit`), a
floating buy plate (`abBuyHit`), the strip (`stripHit`: an ability well, an item slot answering
`tipItem`, a meal well, the purse, and the portrait answering `tipAttack`) and last the drawer (`bagHit`). In `title` it answers the wiki's rows and
ability cards and the lobby's stage wells; every other mode returns null.

`tipResolve()` runs **once per frame in `render()`, before `renderUI`**, so every draw in the
frame reads the same answer.

A descriptor is `{ title, tcol, kind, rows: [[label, value, col]], notes: [[text, col]], icon,
plate, rim }` and `drawTooltip` is the only thing that knows how to paint one: the icon on its own
plate, the name in its ink, the kind under it, then label/value rows with a dotted
leader between them — the PLAYER panel's ledger, which is where that pattern already lives — and
free lines under those. The panel sizes itself to its widest line (capped at `TIP_MAXW`), so a
short tooltip is a short panel.

The builders, one per kind: `tipAttack` (the hero's basic attack: its full-draw damage, the
full draw, the renock and the reach, read off the sim's own functions),
`tipStack` (a meal), `tipGold`, `tipRail` (a rail
chip), `tipShop` (the counter's wells, js/ui/shop.js), `tipClassAb` (a strip
ability well in play, or the lobby's stage wells with `cls` passed — the in-play cooldown
and cast-hint rows only appear in play), and the shop's `tipItem` (an item slot on the strip or the character panel, a
wiki ITEMS row). `tipCell(s)` is the builder for whatever a bag cell holds.
