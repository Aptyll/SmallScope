# The weapon shelf

**The class weapon and the item slots are on screen at all times, top-left**: the weapon in its
one big well at the left end of a row (`shelfCellRect(-1)`), then the `ITEM_SLOTS` item slots
(`shelfCellRect(0..5)`), smaller wells showing `p.items` ([the items](../the-merchants-counter.md#the-items)) left to right
as the shop fills them. It is the whole of what the HUD says about what a player carries into a
fight; the bottom strip has no weapon well, and the [inventory drawer](../../rendering/the-hud-corners/the-backpack.md)
is shut under it.

It stands on the same plate as the rest of the HUD, a fixed width, which swallows a click anywhere
on it (`shelfPlateHit`). The pointer is `shelfHit` (`{kind:'tool'}` / `{kind:'item', i}` / null)
and the draw `drawShelf`, in js/ui/strip.js and js/ui/hud-draw.js, scaled about the top-left
corner at its own size (`cornerSc`) ([rendering.md](../../rendering/the-hud-corners/the-hud-strip.md)). Nothing on the
shelf is dragged or clicked: it is read. A hover raises the weapon's `tipCell` or the item's
`tipItem` (the shop's own card), and the [drawing](../../rendering/the-hud-corners/the-weapon-shelf.md) has no words:
the weapon wears its rate-of-fire sweep, and a slot's rim says part or finished.

The drag belongs to the pack ([the drag banners](../../../../js/ui/bag.js), `state.drag`): a press
**arms** a pick-up and only travel past `DRAG_SLOP` promotes it, so a tap on the burrow still
stands its ghost up while a drag off it picks it up. A release over a pack cell puts it there; over the counter it
sells; over the rest of the HUD it goes home; **over the world it is thrown**.

**A throw goes where it was aimed, and stays thrown.** `throwCell` sends the item off the body
along the **cursor's heading** at `TOSS_SPEED` (130 px/s — the facing stands in when the pointer
is on the body), rather than tipping it out at the feet, so "put this over there" is a gesture and
not a wish; and for `TOSS_LOCK_T` (3 s) the drop is **deaf to the hand that threw it**
(`lockDrop`/`dropLocked`, js/sim/core.js — the drop carries one player id), because the pickup magnet
would otherwise reel straight back in what was just dragged out. The lock is one player's:
everybody else may take it the instant it lands, which is what makes a hand-off across a fight
work. A thrown **tool** sheds its bits on the way ([above](a-discarded-weapon-sheds-its-build.md)),
and they carry the same heading and the same lock.

**A drop onto a loaded cell SWAPS.** Whatever the drop displaces goes back to *home*, the cell
this drag started from (`dragHome`), because home is the one place already known to be free: it
is where the thing in hand came out of. Home can be gone by the time it is asked (a stack that did
not empty is still sitting in it), and then the displaced item rides the cursor, which is free,
because what was on it is what just went into the cell.

**A plain click uses what is in a pack cell** (`sendBagCell`, its `ITEMS[type].use`: the burrow
is the one kind with one). A kind with no use falls through to `bagClick`'s refusal.

**Every press in this widget ARMS; the release is what resolves it** — `hudPress` writes
`state.dragPend` and nothing else, `hudRelease` acts, for a pick-up (a press that travels past
`DRAG_SLOP`) and for putting a carried item down alike. **Never resolve a put-down on the press**:
a drop onto a loaded cell swaps, a swap whose displaced item cannot go home puts that item back
on the cursor, and the mouseup would then run the same `dragDrop` at the same pixel — one click,
two swaps. The item lands where the button came *up*, and a press can be called off by moving
away before letting go. Nothing can be destroyed: when the destination has no room the item does
not move at all, and the pack refuses through `bagDenied()`.
