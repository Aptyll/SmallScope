# The backpack

**A drawer under the weapon shelf, shut until asked for**. The HUD shows one weapon —
[the shelf](the-weapon-shelf.md) — and everything else a player carries in a cell is in here: the
consumables and the ore. It is **invisible by default**: the
pack key (B; L3 on a pad) or a click on the **tab** under the weapon well (`bagTabRect`: a small
`BAG_TAB_W`×`BAG_TAB_H` [hud frame](the-hud-frame.md) of its own, `BAG_TAB_AIR` (4) clear of the
shelf's plate and centred under the weapon, holding a small chevron pointing the way the drawer
will go) sets `state.bagOpen`, the
same again or ESC clears it, and the merchant's counter
holds it open while it is up because a sale is a drag out of it. `bagOpenNow()` is the one
answer everything reads; `bagEase` chases it on wall time over `BAG_SLIDE_T` (0.15 s,
`updateFx`), and the drawer draws sliding out from under the tab, clipped to the screen below
the tab's bottom edge so it emerges rather than fades. It answers the pointer only once fully
open; the tab always answers. `endMatch` shuts it.

While that counter is up the **corner is drawn out of the counter's wash** — the whole frame goes
dark under `shopScrim` and the shelf and this drawer are two of the four things left lit above it
([the counter](../../gameplay/the-merchants-counter.md#opening-it)) — so `renderUI` draws `drawCornerScaled` *after* the wash
in that case and before it otherwise. The corner's own reach is `cornerClaim()` across and `cornerBottom()` down, which is
what the counter's slab is pinned clear of.

The frame (`bagFrameRect()`, flush with the view's left edge `BAG_TAB_AIR` under the tab,
`BAG_W` wide) is **nothing but the inventory grid** (`BAG_CAP` 12 — two rows of
`BAG_COLS` 6), in the small `BAG_CELL` cells
([the hud frame](the-hud-frame.md) has the size and the why).
There is no numbers row — the two meals and the gold are the
[strip's right end](the-hud-strip.md). The tab never moves; its arrow's colour is its only state — gold
under the pointer, **amber** when no cell is free, red on a refusal (`bagDenied()`, aged in
`updateFx`, which also reddens and shakes the open drawer for `bagFlash` seconds).

A grid cell holding a tool or a bit wears that item's **tier plate** rather than the default well,
so a find is read at a glance without a rarity word anywhere; a tool also counts its loaded bits
as pips along the bottom, in the corner a stack number would have used.

- **One background, one frame, no internal line.** Every part of the drawer is the same opaque
  `BAG_BG` inside the [hud frame](the-hud-frame.md) the strip wears (free corners cut).
- **Depth comes from the cells, not from panels.** Three tones say it without a line: a filled
  cell recesses to `BAG_WELL` *below* the frame's ground, an empty one sits *above* it at
  `#171f45`, and the ground itself is between — occupied / free / frame.
- **An empty cell is the *lighter* one**: it has no icon to show off, and free space is what the
  grid is being read for, while a full cell goes dark behind its item. A stack of one prints no
  number — an empty corner says it.
- **A click on a cell uses what is in it** — a consumable's `use`, such as the burrow
  ([sendBagCell](../../gameplay/tools-and-bits/the-weapon-shelf.md)) — resolved on the
  release so that a press which travels is still a drag. Putting a *carried* item down is on the
  release too.
- **A well answers when something lands in it**: a `WELL_LIT_T` (0.3 s) wash in the colour of what
  happened — blue placed, green merged, gold swapped, red refused (`drawWellLit`) — drawn last,
  over the item. Its colours come back as a **ring** around the pack cell under the pointer
  while something is on the cursor, saying what letting go there *would* do before it does it
  ([what a gesture answers with](../../gameplay/tools-and-bits/what-a-gesture-answers-with.md)); that ring is painted
  after the drag ghost and outside the well, because the ghost is exactly as big as the cell.
- **The drawer swallows every click over itself.** `bagHit` reports `tab`, `cell` or `frame`
  (anywhere else inside, inert but eaten).
- **The grid does not stop the sim.** It is HUD, not an overlay — the same deal the
  [M map](../../gameplay/the-m-map-does-not-pause.md) takes, only smaller.

The model behind the grid is in [gameplay.md](../../gameplay/inventory-and-the-backpack.md).
