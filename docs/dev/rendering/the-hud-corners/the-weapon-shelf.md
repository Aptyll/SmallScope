# The weapon shelf

**The class weapon and the item slots, top-left, on screen at all times**: the weapon in the big
well at the left end of a row (`shelfCellRect(-1)`, `SHELF_CELL` = `HUD_CELL`, 34) and the
`ITEM_SLOTS` [item slots](../../gameplay/the-merchants-counter.md#the-items) running right in smaller wells
(`shelfCellRect(0..5)`, `SHELF_ITEM` 26, `SHELF_GAP` 3 apart, `SHELF_WGAP` 5 off the weapon,
centred on its height), showing `p.items` left to right as the shop fills them. It is the whole
of what the HUD says about what a player carries into a fight, since the strip has no weapon well
and everything else carried is in [the drawer](the-backpack.md) under this row.

It stands on the [hud frame](the-hud-frame.md): `shelfPlateRect`, flush with the view's left edge
(only its right corners cut), its top level with the minimap's (`SHELF_TOP` = `MM_GAP`), `SHELF_PAD`
(4) of ground round the row, and a **fixed width** (`SHELF_ROW_MAX`), since the row never changes
length. The wells (`shelfWell`) sit in it with no drop shadow; a cell answers `shelfHit`
(`{kind:'tool'}` / `{kind:'item', i}`), and the ground between them answers `shelfPlateHit` so a
click on the plate never falls through to the world (`overHud`, and the right button's wheel
gate). Nothing on it is dragged or clicked: a hover raises the weapon's `tipCell` or the item's
`tipItem`.

**The weapon well** (the head of `drawShelf`) carries no words:

- its **rim** is the tool's rarity (`tierPlate`, the same 1px rim it wears in every other well),
  brightened on hover, and the 12px tool art is drawn doubled so the tool reads at the ability
  icons' size. There is one weapon slot (`TOOL_SLOTS`), so there is no "selected" tell;
- the **[cooldown sweep](the-hud-strip.md#the-cooldown-sweep)** turns once through exactly `toolCycle` off
  `p.nockT`, so the rate of fire is the speed of the hand rather than a number — and the veil
  clearing IS the bow being ready, since nothing else gates the draw
  ([the cycle](../../gameplay/the-swing-tools-e.md#the-cycle)).

**An item slot** wears its item's icon (`shopIcon(itemIcon(id))`) on the shop's own rim: a part
on the bottom tier's, a finished item on the top tier's, so a glance tells how far the build has
come. An empty slot is a dark well; a filled one lifts its rim grey under the pointer.
