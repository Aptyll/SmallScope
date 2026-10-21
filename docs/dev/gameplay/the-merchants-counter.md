# The merchant's counter

**Each eagle's merchant keeps a shop, and both shops serve everybody.** Walk up to either team's
**stall** (the stall its [merchant](robots.md#the-merchant) pitches beside the road's head) or to the
merchant itself, press **E**, and the counter opens: the **SHOP**, an items shop in League's
mould. It sells 53 items in League's four tiers (**basic**, **epic**, **boots** and
**legendary**, built out of each other) into [six item slots](#the-items), and the **health potion** (50, stacked up to 5 in one slot,
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

`BUILD_ITEMS` (js/sim/items.js) is the whole catalogue, in League's four tiers (`itemTier`). A
**basic** item is built from nothing and carries one stat. An **epic** names the basics it is
built `from` (a part named twice is needed twice) and carries a bigger mix. A **legendary** (a
built item at `ITEM_LEGEND_PRICE`, 2000, or dearer) is built from epics and basics and carries one
**passive**. **Boots** start as FUR BOOTS and upgrade into one of six pairs, and a body wears **one
pair** (`boots: true`; `bootsClash` refuses a second). An epic can carry a passive too (TOOTHED
KNIFE, BRAMBLE COAT, WARM STONE, two of the boots). `ITEM_ALL` is the catalogue in the grid's order
(tier, then price), `itemInto(id)` what an item goes into. Prices are on League's scale: a
legendary is 2600 to 3400, and the gold income is sized so a laner's first one lands near five
minutes ([economy](economy-one-currency.md)).

| basic | price | from | stats | passive |
| --- | --- | --- | --- | --- |
| GUT STRING | 300 |  | +12% ATTACK SPEED |  |
| IRON PLATE | 300 |  | +8 ARMOR |  |
| HOURGLASS | 300 |  | +6 COOLDOWN SPEED |  |
| AMBER BEAD | 350 |  | +2 ABILITY POWER |  |
| FLINT HEAD | 400 |  | +3 DAMAGE |  |
| WOLF HIDE | 400 |  | +25 HEALTH |  |
| CHAIN SHIRT | 800 |  | +20 ARMOR |  |
| PICKAXE | 850 |  | +6 DAMAGE |  |
| BEAR BELT | 900 |  | +55 HEALTH |  |
| DOWSING ROD | 1200 |  | +7 ABILITY POWER |  |
| FELLING AXE | 1300 |  | +10 DAMAGE |  |

| boots | price | from | stats | passive |
| --- | --- | --- | --- | --- |
| FUR BOOTS | 300 |  | +5 MOVE SPEED |  |
| SNOWSHOES | 900 | FUR BOOTS | +10 COOLDOWN SPEED, +8 MOVE SPEED |  |
| SKATES | 900 | FUR BOOTS | +12 MOVE SPEED | GLIDE |
| HOBNAIL BOOTS | 1000 | FUR BOOTS, IRON PLATE | +12 ARMOR, +8 MOVE SPEED |  |
| QUICKSTEP BOOTS | 1000 | FUR BOOTS, GUT STRING | +22% ATTACK SPEED, +8 MOVE SPEED |  |
| EMBER BOOTS | 1000 | FUR BOOTS, AMBER BEAD | +3 ABILITY POWER, +8 MOVE SPEED |  |
| MUKLUKS | 1000 | FUR BOOTS, WOLF HIDE | +15 HEALTH, +8 MOVE SPEED | STEADY |

| epic | price | from | stats | passive |
| --- | --- | --- | --- | --- |
| BRAMBLE COAT | 800 | IRON PLATE, IRON PLATE | +15 ARMOR | THORNS |
| FROST BUCKLER | 800 | IRON PLATE, HOURGLASS | +10 ARMOR, +8 COOLDOWN SPEED |  |
| PADDED JACKET | 800 | WOLF HIDE, IRON PLATE | +25 HEALTH, +10 ARMOR |  |
| WIND SASH | 850 | GUT STRING | +18% ATTACK SPEED, +6 MOVE SPEED |  |
| EMBER CORE | 850 | WOLF HIDE | +30 HEALTH, +8 COOLDOWN SPEED |  |
| LANTERN | 850 | AMBER BEAD | +4 ABILITY POWER, +3 MOVE SPEED |  |
| RECURVE LIMB | 900 | GUT STRING, GUT STRING | +35% ATTACK SPEED |  |
| TOOTHED KNIFE | 900 | FLINT HEAD | +4 DAMAGE | LEECH |
| WARM STONE | 900 | WOLF HIDE, WOLF HIDE | +40 HEALTH | DEN |
| ALMANAC | 900 | AMBER BEAD, HOURGLASS | +3 ABILITY POWER, +8 COOLDOWN SPEED |  |
| QUIVER | 1000 | FLINT HEAD, GUT STRING | +4 DAMAGE, +18% ATTACK SPEED |  |
| WHETSTONE | 1100 | FLINT HEAD, FLINT HEAD | +5 DAMAGE, +8 COOLDOWN SPEED |  |
| BONE KNIFE | 1100 | FLINT HEAD, WOLF HIDE | +4 DAMAGE, +35 HEALTH |  |

| legendary | price | from | stats | passive |
| --- | --- | --- | --- | --- |
| FEATHERS | 2600 | RECURVE LIMB, WIND SASH | +5 DAMAGE, +50% ATTACK SPEED, +5 MOVE SPEED | LIGHT |
| SNOW CLOAK | 2600 | WIND SASH, BEAR BELT | +20% ATTACK SPEED, +70 HEALTH, +8 MOVE SPEED | DRIFT |
| FROST LINE | 2700 | QUIVER, WIND SASH | +8 DAMAGE, +45% ATTACK SPEED | CHILL |
| BRAMBLE MAIL | 2700 | BRAMBLE COAT, PADDED JACKET | +40 HEALTH, +40 ARMOR | THORNS |
| GLACIER SHIELD | 2700 | FROST BUCKLER, PADDED JACKET | +30 HEALTH, +25 ARMOR, +15 COOLDOWN SPEED | STEADY |
| ICE SLATE | 2700 | DOWSING ROD, WOLF HIDE | +50 HEALTH, +8 ABILITY POWER | CHILL |
| HUNTER'S HORN | 2800 | QUIVER, RECURVE LIMB | +9 DAMAGE, +40% ATTACK SPEED, +3 MOVE SPEED | KINDLING |
| BEARSKIN | 2800 | WARM STONE, BEAR BELT | +110 HEALTH, +10 ARMOR | DEN |
| STONEHIDE | 2800 | CHAIN SHIRT, BEAR BELT | +70 HEALTH, +30 ARMOR | BRACE |
| HEARTH PLATE | 2800 | EMBER CORE, CHAIN SHIRT | +60 HEALTH, +20 ARMOR, +10 COOLDOWN SPEED | SMOLDER |
| MARSH LIGHT | 2800 | LANTERN, ALMANAC | +9 ABILITY POWER, +10 COOLDOWN SPEED, +5 MOVE SPEED | SCORCH |
| IRON BRAND | 2900 | WHETSTONE, CHAIN SHIRT | +8 DAMAGE, +20 ARMOR, +10 COOLDOWN SPEED | CHILL |
| HORNET NEST | 2900 | ALMANAC, RECURVE LIMB | +30% ATTACK SPEED, +8 ABILITY POWER, +10 COOLDOWN SPEED | KINDLING |
| SUNSTONE | 3000 | FELLING AXE, PICKAXE | +18 DAMAGE | AMBUSH |
| BEAR TOOTH | 3000 | TOOTHED KNIFE, FELLING AXE | +16 DAMAGE, +20 HEALTH | LEECH |
| WOLF FANG | 3000 | BONE KNIFE, PICKAXE | +9 DAMAGE, +50 HEALTH, +10 COOLDOWN SPEED | FEAST |
| GRINDSTONE | 3000 | WHETSTONE, BEAR BELT | +8 DAMAGE, +50 HEALTH, +15 COOLDOWN SPEED | SURGE |
| IRON COLLAR | 3000 | BONE KNIFE, CHAIN SHIRT | +8 DAMAGE, +40 HEALTH, +20 ARMOR | LEECH |
| STORM GLASS | 3000 | DOWSING ROD, ALMANAC | +11 ABILITY POWER, +15 COOLDOWN SPEED | SURGE |
| STILL CLOCK | 3000 | DOWSING ROD, CHAIN SHIRT | +18 ARMOR, +9 ABILITY POWER, +8 COOLDOWN SPEED | BRACE |
| SPLITTING MAUL | 3100 | FELLING AXE, WHETSTONE | +15 DAMAGE, +10 COOLDOWN SPEED | CULL |
| DEEP ROD | 3400 | DOWSING ROD, DOWSING ROD | +16 ABILITY POWER | AMPLIFY |

**What an item does goes through the kit.** `itemMods` folds every slot into the kit inside
`refreshKit` (js/sim/player.js), so every site that reads the
kit picks an item up without knowing items exist. Each stat line is an `ITEM_STATS` row, and every row adds
its number to the same hero stat in the kit's bonus bag `kit.add` (see
[Hero stats](hero-stats.md)): ARMOR is League armor, ATTACK SPEED a share of the hero's attack speed,
ABILITY POWER, COOLDOWN SPEED and MOVE SPEED flat. `ITEM_STAT_ORDER` is the
order the stats print in and the order of the panel's stat filters; each row's `short` label is the
wiki's narrow column. Two items add their stats
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
| LEECH | a blow heals its striker `LEECH_SHARE` (10%) of itself (`itemsOnHit`, through `healPlayer`) |
| THORNS | a blow taken from a player, a beast or a bot hands `THORN_SHARE` (20%) back to the striker, never to a tower and never a thorn for a thorn (`itemsOnHurt`) |
| CULL | a blow on a body under `CULL_BELOW` (35%) of its health lands ×`CULL_MUL` (1.2) (`itemsDeal`) |
| STEADY | every stun, root and slow lasts `STEADY_MUL` (0.7) of its length (`itemTen`, read by `ccMul`, js/sim/actions.js) |
| SURGE | for `SURGE_T` (4 s) after a key lands (`itemsOnCast`, js/sim/abilities.js), the next basic attack lands ×`SURGE_MUL` (1.5) (`itemsDeal`) |
| BRACE | under `BRACE_BELOW` (40%) health, +`BRACE_ARMOR` (15) armor on the stat sheet (`itemStat`, read by `statOf`, js/sim/stats.js; the stat panel's hover names it) |
| SMOLDER | once a second, rival players and bots within `SMOLDER_R` (30 px) catch a 1.2 s burn (`itemsTick`); beasts are left alone, so walking past a camp never wakes it |
| SCORCH | an ability's blow burns for `SCORCH_BURN` (2 s) (`itemsOnHit`, off the blow's `ab`) |
| AMPLIFY | the ability power from items ×`AMPLIFY_MUL` (1.25): `itemMods` folds every stat first, then the passives |

The passives that are not a kit number hang off shared functions: `itemsDeal` and `itemsOnHit` are
called from `hurtUnit` (js/sim/actions.js) for every blow a player lands, before and after it
lands, and `itemsOnHurt` for every blow a player takes; a burn's own ticks are not hits, so they
never feed KINDLING, CHILL, LEECH or SCORCH. `itemsTick` runs the player's fight clock
(`p.fightT`, also set by `damagePlayer`), DEN's heal, SURGE's window (`p.surgeT`) and SMOLDER's
pulse (`p.smolderT`) once a step from `updatePlayer` (js/sim/sim.js).

Items are **ids** in `p.items` (`ITEM_SLOTS`, six of them, an id or `null` each), never instances:
an item has no state of its own, so a slot is just the name of what is in it. They
survive a respawn. They ride the save on the player, and a save from before items gets six empty
slots (`saveApply`, js/sim/save.js). When the slots change, `itemsChanged` rebuilds the kit: new max
health arrives filled, the way a hero level does, and lost max health clamps.

## Buying and selling

**An item costs its own price minus every component of it already in your slots**, however deep
(`itemCost`, League's recipe rule): each slot is counted once, a component held takes its whole
price off, and a component not held is looked into in turn. So HUNTER'S HORN (2800) with a QUIVER
held costs 1800, and with a QUIVER and a GUT STRING (inside its RECURVE LIMB) 1500. The buy uses
those components up, so a part bought early is never wasted gold. It needs a free slot once they
are spent (`itemRoom`), and boots need no other pair held (`bootsClash`). A basic plays the coin
and anything built the money ding (`SFX.buy`).

**Selling an item** back pays `ITEM_SELL` (half) of its whole price (`itemSellValue`), whatever it
cost you.

**The potion stacks.** Buying one (`buyPotion`) takes a free slot for the first and adds to that
slot's stack after, up to five (`potionRoom`); selling the slot sells **one** potion at half price
(25), and the last frees the slot (`takePotion`). It is built from nothing and into nothing, so its
card in the pane shows what one drink heals, over how long, and how many you carry instead of a tree.
Fish and berries are never bought or sold: they heal where they stand.

**A sale pays gold but does not count as earned**: `tradeGold`, the one documented exception to
the `gainGold` rule in [CLAUDE.md](../../../CLAUDE.md). It adds nothing to `p.earned`, so selling
back and forth never climbs the scoreboard.

**Every order goes through `input.cmd`** `{kind: 'shop', act: 'item' | 'sellItem'}`
→ `runCmd` → `shopCmd`, validated on arrival by `cmdOk` (js/ui/wheel.js), so the HUD click and a
bot buy the same way. `buyItem` and `sellItem` re-check the reach, the gold and the
room themselves, so a stale order is harmless. Nothing is [contested](../multiplayer.md#contested-orders):
the stock is endless, so two buyers never want the same thing.

**Bots buy class builds** (`BOT_BUILDS`, js/sim/items.js), League's order: the first legendary,
then boots, then four more legendaries. The same lists are the panel's RECOMMENDED tab, so a bot
buys what the counter suggests to you. `botNextItem` is the next one it does not have, and
`botItemBuy` what it would buy now: that item whole if the purse covers it, else the first
component on the way to it (depth first, in the recipe's order, so an epic whole before its
basics) it can afford and has room for.
`aiSpend` (js/ai/ai.js, rung 0 of `aiThink`, after a free skill point) sends that order whenever
the bot is at a counter. When the purse covers the next **whole** item and the bot is out of a
fight (`p.fightT`), it walks to its own side's counter (the stall, or the merchant's body) if that
is within `AI_SHOP_DETOUR` (32 tiles), noting `SHOP` and the item as its thought (`aiNote`), which ends its
ladder for that think. An item that is neither on its list nor inside anything still left on it is a **stray** (`botStrayPart`): with the slots full, the bot sells it at the counter,
and a stray it could sell counts as room when it decides to walk there.

## The panel

League's shop on the HUD's own graphite plate (`drawHudFrame`, js/ui/strip.js), 500×288
(`SHOP_W`/`SHOP_H`) and pinned near the top edge (`SHOP_Y`):

- the **tabs** along the top (`state.shopTab`): **RECOMMENDED**, your class's build cut into START
  (the potion and the first item's basics), CORE (the first legendary and its epics), BOOTS and
  THEN, each a row under its headline (`shopRecommended`); and **ALL ITEMS**, the stat filters
  (`state.shopCat`: ALL, then one a stat in `ITEM_STAT_ORDER`, each the stat panel's own icon,
  `STAT_ICON`) over the whole catalogue a row a kind (`shopAllRows`: the potion and basics, every
  pair of boots, the epics, the legendaries; `SHOP_COLS` a row). A filter **dims** every item
  without that stat rather than hiding it, so nothing on the grid moves; picking it again clears it.
  The counter opens on RECOMMENDED;
- each **well** is rimmed by its tier (`itemMetal`: a basic dim green, an epic or a pair of boots
  steel blue, a legendary gold) with what it costs **you** now (`itemCost`) under it, in the
  refusal red when the purse is short (`SHOP_DEAR_INK`). The well keeps its colours: with fifty
  items on the grid, most are dear most of a match;
- the **pane** on the right: **BUILDS INTO** (`itemInto`, empty wells keeping the row's shape),
  the picked item's **tree** (`shopTree`: the item over its components, each over its own, every
  child centred under its parent, prices under each; a component you hold is rimmed green with a
  tick, `shopTreeOwned`, and so is everything under it), its **card** (icon, name in its tier's
  ink, full price, each stat with its icon in green, the passive in gold over one dim line, ONE
  PAIR on boots, a drink's heal on the potion) and the **BUY** plate at its foot wearing what the
  buy costs you now: green when it can go through, red when the purse is short, grey when there is
  no room or it would be a second pair (`shopBuyState`);
- along the bottom, **your six slots** (a potion stack wearing its count), the **SELL** plate and,
  while a slot is picked, what it sells for, and the purse.

A left click **picks** (an item on the grid, a node of the tree, a BUILDS INTO well, one of your
slots: `state.shopSel`, `state.shopSlot`); BUY buys the pick and SELL sells the picked slot. A
**right click** is the shortcut (`shopRightClick`, asked first by the right button in
`pointerPress`, js/app/input.js): on the grid or the tree it buys, on a slot it sells, and anywhere
else on the slab it is only swallowed, so no ping wheel opens through the counter. The tab, the
pick and the filter are this screen's own and stay out of a save (`SAVE_STATE_SKIP`). The counter
picks what a bot of your class would save for next (`botNextItem`) the first time it opens.
`shopHit` is shared by the click, the cursor and the tooltip, so the three can never disagree
about what the pointer is on; hovering an item describes it in the ordinary tooltip (`tipShop`,
`tipItem`: its tier, PRICE, its stats, its passive), and a slot adds what it SELLS FOR. The words
on it (the tabs, the row headlines, BUILDS INTO, BUY, SELL) are names, headlines and plates in
plain words like the menus; everything else is icons, rims and numbers.

**It is centred across the view**, `SHOP_Y` (4) from the top (`shopLayout`). Every icon (16 px, js/sprites/item-icons.js) is drawn at the largest **whole-number** scale that fits its well (`shopIcon`; a 20 px well shows it at 1x): a fractional one
stretches every third source pixel and frays 1 px linework.
