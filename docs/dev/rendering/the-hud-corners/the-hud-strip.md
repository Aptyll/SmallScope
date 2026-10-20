# The hud strip

`drawHudStrip` is one plate, flush to the bottom — the [hud frame](the-hud-frame.md) — read left to
right the way a MOBA's bottom bar is (0.426), and the HUD's one bar: the **stat panel**, the **portrait**, then **four 34px ability wells**
`[1][2][3][4]` in key order with the **health bar** and the **stamina bar** under them, then the
**six item slots** in a three-by-two grid of 24px wells (`ITEM_CELL`), then the **two meal wells**
(the items' size) with the **purse** under them (`abCellRect(i)`, `itemCellRect(i)`,
`foodCellRect(i)`, `portraitRect`, `hpBarRect`, `stBarRect`, `goldCellRect`). The hero's basic
attack has no well: hovering the portrait names it (`tipAttack`). Unopened cards are not on the
strip either (they open the moment they are held, [gameplay](../../gameplay/roguelike-cards.md)), nor a
build well (the build key opens the list). The plate swallows clicks so nothing fires through it.

An **item slot** (`drawItemCell`) holds `p.items[i]` ([the items](../../gameplay/the-merchants-counter.md#the-items)), filled
left to right and top row first as the shop fills them: the item's icon (`shopIcon`) on its rim,
a part's green or a finished item's gold (`itemMetal`), so a glance tells how far the build has
come, and an empty slot shows its number, dim. It is read, never pressed or dragged: `stripHit`
answers `{kind:'item', i}`, the hover lights the rim and raises the shop's own card (`tipItem`).

A **meal well** (`drawFoodCell`) is the ability well's grammar at the items' size: the meal's icon
doubled, its key at 1× in the bottom-left corner and the count in the top-right.

The **stat panel** (`drawStatPanel`, js/ui/statpanel.js) is a plate of its own butted to the
strip's left frame, the strip's height: the seven [hero stats](../../gameplay/hero-stats.md) in two
columns (`STAT_PANEL_GRID`), each a dark well with its 7×7 icon (`STAT_ICON`, inked round) and its
number (`statShown`, so a bear buff is already in it — and the number it raises wears that bear's
ring colour while it runs). The strip and the panel are one widget: `hudStripRect` centres the
**pair** on the view, `stripCap` fits the pair, and `drawHudScaled` bakes from the panel's left
edge. `stripHit` answers it first (`statPanelHit`: `{kind: 'stat', key}` on a cell, the plate's
`'frame'` off one), so a press on it never reaches the world, and a hover raises the tooltip's
**breakdown** (`tipStat`, off `statParts`): BASE, the LEVEL's growth, what CARDS and ITEMS
gave, the buff, then the total under a rule (the descriptor's `sum`).

The **portrait** (`drawPortrait`) is a `PORT_SQ` square in the wells' own border (ink, then the
rim), the hero's standing frame at 3× (`portraitSprite`: the worn body's if one is worn, the
class body's otherwise) on a dusk ground. Inside the rim a 3 px band is the **xp, filling
clockwise from top centre round the square** — each band pixel's place along the perimeter
decides it, so the corners turn at the sides' pace — then one px of ink seals the face apart from
it. The xp you have of this level and what it needs stand over the square (`XP_TAG`), and the
level is the digit in an odd-sized badge on its bottom-right corner (13 px, 17 for two digits, so
the digits sit on a true centre). At `LEVEL_MAX` the band is full and the numbers go. A level-up
pops the band and the numbers white (`abLvSeen`/`abLvFlash`). The **health bar** (`drawHpBar`)
is green, with your health and your most printed on it — green and not your side's colour,
because this one bar is always yours and the overhead bars keep the sides. The **stamina bar**
(`drawStBar`) is the dodge charges, read as the overhead one is (`STAM_COL`, the spent chunk
draining as `STAM_GHOST`), notched between charges: the seat a mana bar takes when heroes come.

An **ability well** (`drawClassAbCell`) is the same grammar pointed at `CLASS_AB[p.cls][i]`: its
detailed 32px icon (`classAbIcon`, baked from `AB32` in js/sim/abilities.js) is the ability, a
**sweep** round the well is its cooldown (against the level-cut `abCdOf`, not the table base —
see below), and the key
digit sits big at 2× in the bottom-left corner (the keybind-indicator carve-out). Along the top
inner edge, centred **buy pips** on dark seats count the ranks in the key — one seat per
rank it can hold (`abLvMax`: five on keys 1-3, three on the ultimate), the first being the unlock
([gameplay.md](../../gameplay/class-abilities-keys-1-4.md)). A key with no point in it is **locked**,
and the well says so in the meal button's own grammar: dark rim, the icon at `LOCK_DIM` (0.28),
an empty pip row and a grey key digit — dim, never absent, so the strip never rearranges and you
can read what you have not bought. A press on one is refused with the same red band and 1px
shake the meal buttons refuse in (`abDenied`, aged in `updateFx` beside
`foodFlash`); a cooldown is NOT that refusal, because the sweep already says when it
comes home. The ASK lives off the well: while a
skill point is unspent and the key has room a **floating buy plate** bobs in the open screen
above the well, `AB_BUY_AIR` clear of the strip's line at the bottom of its bob, shadow included
(`abBuyRect`, a fixed hit rect the drawn bob stays inside; `abBuyHit` gates it on `abLvCanBuy`
AND `hudHome()`, so the plate's existence IS the appears-then-goes ask; `drawAbBuyPlate` draws it
under the same two gates
— a gold-rimmed plus, lighting on hover, the tooltip carrying the numbers). The `hudHome()` half
matters because the plate hangs in open screen ABOVE the strip: the intro's `HUD_SLIDE` ([the HUD corners](../the-hud-corners.md)) is not far
enough to carry it off the bottom with the wells, and a **drop brief pins `state.intro`** for the
whole roost tour (the brief's camera branch in js/sim/sim.js never counts it down), so without that
gate four gold plus plates bob alone along the bottom edge for the length of the cinematic.
`hudInT()` is the one answer to "how far in is the HUD", shared by `renderUI`'s slide and both
gates. Pressing the plate buys the level,
pressing the well casts — two surfaces, so neither can steal the other's click, and the well's
rim carries combat states only. On top of that it
tells the ability's moments: the rim goes **white while the body
performs the cast**, a **running** ability (the shield up, the fury out) pulses the rim in its own
colour (`acol` in its table row) and drains a bar of it along the bottom edge — the sweep waits
while that state runs, because the shield resets its cooldown on the drop and a hand turning under
a raised shield would be a lie (`activeF` in the table row is the readout) — and the well **pops
white** the frame a cooldown comes home. A click on the well sets `input.ability` exactly as the
key does (`hudPress`), and hovering it raises the ability tooltip (`tipClassAb` — the live
cooldown, level and next-level price, the blurb, nothing the well itself already shows better).

## The cooldown sweep

`drawSweepCover(x, y, w, h, frac, col, edge)` is League's radial cooldown **cut to a square**, and
the **one readout the four ability wells and the meal wells share**: the
veil fills the well and retreats **clockwise from 12 o'clock**, so the dark that is left is the
wait that is left and the hand's angle is the fraction at a glance — a hand at 4 o'clock and one
at 7 read apart in the corner of an eye mid-fight, where two bars part-way down do not. It is
the **one shape every wait on the HUD is drawn in** — an ability's cooldown, the meal clock, a
rail chip's respawn — so only the speed of the hand tells one clock from another.

The **meal clock** turns it too (`drawFoodClock`): both meal buttons off the one shared
`p.foodCd`, so the two turn **together** — which is the thing that says it is one clock and not
two. `drawFoodClock` passes `CD_EDGE` only at `w >= 12`; below that a cell turns the **bare
veil**, because at that size the hand's stroke lands ACROSS the berry and reads as a scratch on
the fruit rather than as a clock over it.

Two things it does not do the obvious way. It is **rasterised a pixel at a time**, for the reason
`mmRing` rasterises every curve of the minimap ([UI panels are baked once](../ui-panels-are-baked-once.md)):
a canvas path anti-aliases, and a soft diagonal across a 32px well is blur on a screen where every
other edge is hard. Unlike the minimap's chrome this one **cannot be baked** — the hand moves every
frame — so it stays cheap on size: the well is 32×32 (1024 angle tests), each row is walked once
and its covered pixels coalesced into ONE `fillRect` per run instead of one per pixel, and only
a well actually on cooldown is walked at all (about 30 µs a well).
And the veil is **not** a near-black cover but a translucent slate (`CD_SWEEP`):
the well's ground is `#080b1c` and half of every icon is nearly as dark, so a darker-still wash
over it changes nothing the eye can find, and the sweep would be a bare line turning over a well
that never dims. The slate drags an icon's lit pixels down and lifts its dark ones to a blue-grey,
so the waiting wedge is a different **material** rather than merely a darker one. `CD_EDGE`
draws the hand itself, centre to rim, as a 1px bright line; pass `null` instead and the cell
turns the veil alone. The pips and the key digit are
drawn **after** it: the wait is what the veil is for, and what you own is never dimmed by it.

The **meal wells** (`drawFoodCell`, `FOOD_BTNS`: berry, fish, in `stripHit`'s `food` order) are
the ability wells' size and grammar: the item icon **doubled** in the middle, the key at 2× in the
**bottom-left** corner where an ability prints its key (the keybind-indicator carve-out, wearing
the pad's own glyph while one is in hand), and the count in the **top-right** — `shortNum`,
because the pouch has no ceiling. Hover lights the rim, a press sets the same edge-triggered
intent the key does (`eatBerry`/`eatFish`), so `startEat` speaks every refusal and a well can
never disagree with its key. A refusal *shows*: whatever the reason (none in the pouch, the clock
still up, full health, a busy body), the asked well takes the red band and 1px shake for
`foodFlash` seconds — `foodDenied(type)`, aged in `updateFx` beside `bagDenied()`.
The shared food clock (`drawFoodClock`) sweeps both together and lifts the one being chewed
white. A meal you have none of keeps its seat but dims to 0.35, so the pair never rearranges.
The fish well shows the fish F will eat next (`fishToEat`) and, with nothing picked, the count of
all four. Pointing at it raises the **fish picker** (`drawFishPop`): the four fish in ability-size
wells in a column growing straight up out of the strip over the fish well (`FISH_POP` order: frost
pike nearest it, then gold sunfish, whitefish, snow char),
its frame running on into the strip's, each with its count; the hovered one's name in its colour
and its `+heal` stand over the column, the picked one wears a gold rim and the
others dim. The bake grows by `fishPopHeadroom()` while it is up.
The **purse** under them (`drawGoldCell`, `goldCellRect`) is the coin and the gold, centred, in
the same rim — a readout, not a button: no key, no hover, no refusal; `stripHit` answers `frame`
over it and `tipGold` gives the exact figure — inked `#f5c542` because the one number on the HUD
that is money must never read as a count of something carried.
