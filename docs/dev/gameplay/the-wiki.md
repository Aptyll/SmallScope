# The wiki

The **WIKI** tab over the patch notes (`m.screen = 'wiki'`, its own `wikiT` ease, ESC back) opens the
game written down: one surface, a tab bar of **pages**, each a scrolling column of blocks.
WHISPERING WOODS (`TRACKS.wiki`) loops under it from the moment it opens — an ordinary
`music.play` the way the lobby takes the layer, not the counter's hold, because the wiki is
a surface you sit in rather than a window over a running match; `leaveWiki()` puts `intro` back
([Audio](audio.md)). The
page itself — the slab, the tabs, the blocks, the rail — is in
[rendering.md](../rendering/the-hud-corners/the-wiki-screen.md); this section is what the pages *say* and where
the numbers come from. Every number on a page is read off the constant the sim spends, never
typed twice, so a retune can never leave the wiki lying.

- **CLASSES** (the page the wiki opens on) — every hero as the lobby reads them: the
  body at 3x in the side you play in, the name and role, the three lines of the pitch, and its
  level 1 health, damage, attack speed, armor and move speed (`WIKI_STATS`, off `statFrom`); under
  the card, the hero's story (who they were before the pass: `story` on its `CLASSES` entry, the
  rules it is written to in [lore.md](../lore.md)); under that, its
  passive (a `P` plate and `passiveIcon`, when the hero has one) and four abilities in key order — the key on a plate, the strip's own 32 px icon in a well
  (`classAbIcon`), the name, COOLDOWN and CAST in the columns (`WIKI_AB_COLS`, off `CLASS_AB`)
  (the cooldown at rank 1) and the blurb wrapped beneath. A hover raises the lobby's ability card
  (`tipClassAb` with the class passed: every rank's numbers, none lit). The intro names what a
  skill point does (`AB_RANK_LV`, `AB_ULT_LV`, [Hero levels](../multiplayer.md#hero-levels)).
- **BEASTS** — the meadow's two kinds and the camps' three, each drawn wearing the frame it wears in the snow; a
  legend naming the frame's parts once (the level plate, health, the stamina bar that is a
  camp monster's leash bar, the `!` noticed mark); and per kind a line of what it does and a growth
  table — HEALTH, KILL GOLD and, for a kind worth any, KILL XP (the whole, before the side near
  shares it; in the xp ink) at levels 1, 6 and 12 (`WIKI_LEVELS`) — from `ANIMAL_HP` /
  `ANIMAL_LV_HP` and `YIELD` / `ANIMAL_LV_GOLD` / `ANIMAL_LV_XP` through the same arithmetic `makeAnimal` and
  `animalDies` use ([Wildlife](wildlife.md)). The frames on the page wear the level a spawn would
  be dealt right now (`animalLevel()`).
- **ITEMS**: the merchant's catalogue written down ([the items](the-merchants-counter.md#the-items)): two tables, PARTS
  (`ITEM_PARTS`) then FINISHED (`ITEM_DONE`), each row the item's icon in a well rimmed part or
  finished the way the shop rims it, its name, and STATS / PASSIVE / PRICE (`WIKI_ITEM_COLS`,
  `wikiItemStats`) read off `BUILD_ITEMS`, `ITEM_STATS` and `ITEM_PASSIVES`. A hover raises the
  shop's own item card (`tipItem`, js/ui/shop.js).
- **WORLD** — the one page with no numbers on it: the valley written down. Twelve entries in the
  order an exile meets them — SOFTFALL, THE EMPIRE, THE EXILES, THE WORKS, THE CLAIM, THE EAGLES, THE
  COUNTER, THE MACHINES, THE ROAD, THE TOWERS (a whole loaded tower, `towerFigure`, js/draw/towers.js),
  THE WOLVES, GOLD (`WIKI_WORLD`) — each a figure on its mound
  in the side you play beside a short paragraph, between a two-line opening and a one-line
  close. Every sentence is either something a match does or the valley's reason for it, and the
  sentences live in that table and the heroes' stories alone; the premise, the fixed words and the voice they are
  written in are [lore.md](../lore.md).

Storage is [js/app/profile.js](../../../js/app/profile.js) and nothing here writes a key — see
[architecture.md](../architecture.md#profilejs).
