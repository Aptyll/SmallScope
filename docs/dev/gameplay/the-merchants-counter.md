# The merchant's counter

**Each eagle's merchant keeps a shop, and both shops serve everybody.** Walk up to either team's
**stall** (the stall its [merchant](robots.md#the-merchant) pitches beside the road's head) or to the
merchant itself, press **E**, and the counter opens: the **SHOP**, an items shop in League's
mould. It sells five cheap **parts** and eight **finished items** built out of them into
[six item slots](#the-items), and the **health potion** (50, stacked up to 5 in one slot,
[Heals](heals.md)). **Every item is on sale all the time, at one fixed price, and nothing sells
out**, so a player can save up for the one they want. The items themselves are
[js/sim/items.js](../../../js/sim/items.js) (the `items` banner); the counter is
[js/ui/shop.js](../../../js/ui/shop.js) (the `the counters`, `buying and selling` and `the shop panel`
banners).

Your own roost's merchant is the near one; the rival's is a walk through their base and sells the
same things, and since a shop nobody can reach is not a shop, a merchant **cannot be killed**: `unitAlive` (js/sim/actions.js)
answers false for one (the [CLAUDE.md](../../../CLAUDE.md) picker rule). It has no `hp` field
at all and draws no health bar.

## Opening it

`merchNear(p)` is the resolver — the nearest **counter** within `SHOP_REACH` (34 px) of a body,
either team's, where a counter is a merchant's body or its stall (`stallUp`), each measured by
`counterDist` (from the body itself, or from the nearest edge of the stall's footprint, so its back
and sides count as well as its front; the cap and a click's walk go to `counterPt`, the middle of
the stall's front edge) — and the `E SHOP` cap over it (`drawShopHint`, js/ui/wheel.js) is the same proximity
prompt the practice armory's `E ARM` uses. **A merchant in reach owns E outright**: unlike the
armory, the roll die and the bell — which all stand aside for a real
[work target](the-swing-tools-e.md) — the counter is taken *first*, ahead of the swing and ahead of
everything else the key does (`keyPress`, js/app/input.js). It has to be: the merchant fells trees for
a living and loiters among them, so there is very often a trunk one tile off the counter, and a
swing that outranked the counter would leave the shop unopenable under its own `E SHOP` cap.
One rule answers in all three places: the press, the cap, and whether the
cursor's [lock ring](../rendering/cursor.md) promises a swing. The counter is a **panel, not a held wheel**:
the press opens it and E, Escape, the X or **walking out of reach** shuts it (`updateShop`
re-checks `inReach` every step). It is HUD like the character sheet — **the sim runs
on underneath, and standing at a counter protects nobody**.

The character sheet closes when it opens, since the two slabs would sit on each other.
While it is up, E does not swing at the world (`sampleHumanInput`), the way a wheel already
swallows it.

**The frame goes under a wash while the counter is open** (`shopScrim`, `SHOP_WASH`), and exactly
two things stay lit above it — the ones a trade is made of: **the counter** and **the
[tooltip](../rendering/the-hud-corners/the-hover-tooltip.md)** pricing whatever the pointer is on. The minimap, the
hud strip and the world all go under. The mechanism is the draw ORDER in `renderUI` (js/ui/compose.js) and
not the panel: a panel cannot dim what is drawn after it, so the minimap and the strip are drawn,
then the wash, then the slab. Everything painted after that block (the news plates, the tooltip)
is above the wash by arriving late.

**The post has its own song.** `openShop` calls `SFX.music.hold('village', …)` — FOREST VILLAGE
LOOP, which loops for exactly as long as the counter is open — and `closeShop` calls
`SFX.music.release()`. A hold notes what was playing **and the second it had reached**, and the
release puts that track back at that second, so a trip to the shop costs the match's own track the
bars it covered rather than the whole song. Any ordinary `music.play`/`music.stop` in between
clears the hold, so a track that takes the layer for its own reason — a victory, the lobby — can
never be undone by a release arriving after it. See the `music` banner, js/app/audio.js.

The merchant **stands still and faces you** while a counter is open on its own body (`shopServing`,
read by `updateMerchant`): it drops the bays, the felling and the loiter for as long as the sale
takes. A counter open at the **stall** holds nobody, so its keeper goes on working. It is gated on
the OPEN PANEL rather than on proximity because everybody lands at the roost together, and a
merchant that stopped for anyone standing near it would never raise its stall.

## The items

`BUILD_ITEMS` (js/sim/items.js) is the whole catalogue, and two kinds share it. A **part** is cheap
and carries one stat. A **finished** item names the parts it is built `from` (a part named twice is
needed twice) and carries bigger stats and one **passive**.

| part | price | stat |
| --- | --- | --- |
| FLINT HEAD | 30 | +2 DAMAGE |
| WOLF HIDE | 25 | +15 HEALTH |
| GUT STRING | 30 | +8% ATTACK SPEED |
| IRON PLATE | 30 | +7 ARMOR |
| FUR BOOTS | 25 | +4 MOVE SPEED |

| item | price | from | stats | passive |
| --- | --- | --- | --- | --- |
| HUNTER'S HORN | 150 | FLINT HEAD, GUT STRING | +4 DAMAGE, +15% ATTACK SPEED | KINDLING |
| BEARSKIN | 140 | WOLF HIDE, IRON PLATE | +35 HEALTH, +14 ARMOR | DEN |
| WOLF FANG | 130 | FLINT HEAD, WOLF HIDE | +3 DAMAGE, +20 HEALTH | FEAST |
| IRON BRAND | 140 | FLINT HEAD, IRON PLATE | +3 DAMAGE, +14 ARMOR | CHILL |
| SKATES | 80 | FUR BOOTS | +6 MOVE SPEED | GLIDE |
| SNOW CLOAK | 120 | FUR BOOTS, WOLF HIDE | +20 HEALTH, +4 MOVE SPEED | DRIFT |
| FEATHERS | 130 | GUT STRING, FUR BOOTS | +18% ATTACK SPEED, +4 MOVE SPEED | LIGHT |
| SUNSTONE | 200 | FLINT HEAD, FLINT HEAD | +7 DAMAGE | AMBUSH |

**What an item does goes through the kit.** `itemMods` folds every slot into the kit inside
`refreshKit` (js/sim/player.js), so every site that reads the
kit picks an item up without knowing items exist. Each stat line is an `ITEM_STATS` row, and every row adds
its number to the same hero stat in the kit's bonus bag `kit.add` (see
[Hero stats](hero-stats.md)): ARMOR is League armor, ATTACK SPEED a share of the hero's attack speed,
MOVE SPEED flat on the hero's walk. `ITEM_STAT_ORDER` is the
order the stats print in and the order of the panel's category filters. Two items add their stats
twice, but **a passive counts once** however many items carry it (League's unique passives).

| passive | what it does (`ITEM_PASSIVES`) |
| --- | --- |
| KINDLING | every `KINDLE_EVERY` (3rd) hit lights the target for `KINDLE_BURN` (2 s) at the ordinary burn (`itemsOnHit`) |
| DEN | 3 HP a second (`restHeal`) once `ITEM_FIGHT_T` (5 s) have passed since a hit given or taken (`itemsTick`) |
| FEAST | a kill heals 20 (`killHeal`) |
| CHILL | a hit slows the target to `CHILL_MUL` (0.7) of its speed for `CHILL_T` (1 s) (`itemsOnHit`, through `slowUnit`) |
| GLIDE | ice top speed ×1.15 and +0.3 ice steer |
| DRIFT | stealth −0.15: seen from closer |
| LIGHT | the roll comes back 0.8 s sooner (`dodgeCd`) |
| AMBUSH | +0.4 on the ambush shot's multiplier (`ambushMul`) |

The two passives that are not a kit number hang off shared functions: `itemsOnHit` is called from
`hurtUnit` (js/sim/actions.js) for every blow a player lands, and a burn's own ticks are not hits,
so they never feed KINDLING or CHILL; `itemsTick` runs the player's fight clock (`p.fightT`, also
set by `damagePlayer`) and DEN's heal once a step from `updatePlayer` (js/sim/sim.js).

Items are **ids** in `p.items` (`ITEM_SLOTS`, six of them, an id or `null` each), never instances:
an item has no state of its own, so a slot is just the name of what is in it. They
survive a respawn. They ride the save on the player, and a save from before items gets six empty
slots (`saveApply`, js/sim/save.js). When the slots change, `itemsChanged` rebuilds the kit: new max
health arrives filled, the way a hero level does, and lost max health clamps.

## Buying and selling

**A finished item costs its own price minus the parts of it already in your slots** (`itemCost`),
each slot counted once, and the buy uses those parts up. So a SUNSTONE with one FLINT HEAD held
costs 170 and with two, 140: a part bought early is never wasted gold, and saving toward an item
can start one part at a time. The buy needs a free slot once those parts are spent (`itemRoom`).
A part plays the coin and a finished item the money ding (`SFX.buy`).

**Selling an item** back pays `ITEM_SELL` (half) of its whole price (`itemSellValue`), whatever it
cost you.

**The potion stacks.** Buying one (`buyPotion`) takes a free slot for the first and adds to that
slot's stack after, up to five (`potionRoom`); selling the slot sells **one** potion at half price
(25), and the last frees the slot (`takePotion`). It is built from nothing and into nothing, so its
read-out shows what one drink heals, over how long, and how many you carry instead of a tree.
Fish and berries are never bought or sold: they heal where they stand.

**A sale pays gold but does not count as earned**: `tradeGold`, the one documented exception to
the `gainGold` rule in [CLAUDE.md](../../../CLAUDE.md). It adds nothing to `p.earned`, so selling
back and forth never climbs the scoreboard.

**Every order goes through `input.cmd`** `{kind: 'shop', act: 'item' | 'sellItem'}`
→ `runCmd` → `shopCmd`, validated on arrival by `cmdOk` (js/ui/wheel.js), so the HUD click and a
bot buy the same way. `buyItem` and `sellItem` re-check the reach, the gold and the
room themselves, so a stale order is harmless. Nothing is [contested](../multiplayer.md#contested-orders):
the stock is endless, so two buyers never want the same thing.

**Bots buy class builds** (`BOT_BUILDS`, js/sim/items.js): a HUNTER finishes HUNTER'S HORN,
FEATHERS, WOLF FANG, SUNSTONE, SKATES, BEARSKIN, a WARRIOR BEARSKIN, IRON BRAND, WOLF FANG, SKATES,
SNOW CLOAK, SUNSTONE. `botNextItem` is the next one it does not have, and `botItemBuy` what it would
buy now: that item whole if the purse covers it, else the first of its parts it does not hold yet.
`aiSpend` (js/ai/ai.js, rung 0 of `aiThink`, after a free skill point) sends that order whenever
the bot is at a counter. When the purse covers the next **whole** item and the bot is out of a
fight (`p.fightT`), it walks to its own side's counter (the stall, or the merchant's body) if that
is within `AI_SHOP_DETOUR` (32 tiles), noting `SHOP` and the item as its thought (`aiNote`), which ends its
ladder for that think. A part no item still left on its list is built from is a **stray** (`botStrayPart`): with the slots full, the bot sells it at the counter,
and a stray it could sell counts as room when it decides to walk there.

## The panel

**Layout A**, on the HUD's own graphite plate (`drawHudFrame`, js/ui/strip.js), 344×206
(`SHOP_W`/`SHOP_H`) and pinned near the top edge (`SHOP_Y`):

- the **head**: SHOP, the purse and the X;
- down the left, the **category filters** (`state.shopCat`): ALL, then one plate a stat in
  `ITEM_STAT_ORDER`, each that stat's own picture. A filter **dims** every item without that stat
  rather than hiding it, so nothing on the grid moves; picking it again clears it;
- the **grid**: PARTS, then ITEMS four a row, each well rimmed by its tier (a part tier 0, an item
  tier 2) with what it costs **you** now (`itemCost`) under it, in the refusal red with the item
  greyed back when the purse is short (`SHOP_DEAR_*`);
- the **read-out** pane on the right: the picked item big, its name and full price, the
  **BUY** or **SELL** plate wearing the gold it moves, its stats in green, its passive in gold over
  one dim line, and its **build tree** (`shopTree`): a finished item over its parts, or a part
  under the items it goes into. A part already in your slots is rimmed green with a tick and wears
  no price;
- along the bottom, **your six slots** (a potion stack wearing its count), then the **potion
  plate** (`drawShopPotion`): the flask and how many you carry, its price, and BUY. A click on the
  flask picks it into the read-out; BUY buys one.

A click **picks** (an item on the grid, a node of the tree, one of your slots: `state.shopSel`,
`state.shopSlot`) and the plate acts on the pick, BUY for an item on sale, SELL for one in your
slots. The pick and the filter are this screen's own and stay out of a save (`SAVE_STATE_SKIP`). The
counter opens on what a bot of your class would save for next (`botNextItem`). `shopHit` is shared by
the click, the cursor and the tooltip, so the three can never disagree about what the pointer is
on; hovering an item describes it in the ordinary tooltip (`tipShop`, `tipItem`: PRICE, its stats,
its passive), and a slot adds what it SELLS FOR. The words on it (the head, PARTS, ITEMS, BUY,
SELL) are names and plates in plain words like the menus; everything else is icons, rims and
numbers.

**It is centred across the view**, `SHOP_Y` (4) from the top (`shopLayout`). Every icon is drawn at the largest **whole-number** scale that fits its well (`shopIcon`): a fractional one
stretches every third source pixel and frays 1 px linework.
