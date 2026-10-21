# The wiki screen

`m.screen = 'wiki'`, entered from the WIKI tab over the [patch notes](the-patch-notes-screen.md) (Esc goes back to the title) and eased in on its own `wikiT`
(the chrome ducks under it the way it does under the lobby). One surface: the title's tabs, then a translucent frost slab (`drawMenuSlab`, up to `WIKI_W_MAX` = 400 wide,
`WIKI_H` = 200 tall, centred, narrowing with the view) with a **tab bar** of pages under its top
edge in the settings slab's navbar grammar — the open page in gold over a gold underline, the
rest dim until hovered — and a **content window** under a rule that the open page scrolls
through when it outgrows it: the wheel, up/down (W/S), and an iron rail on the right with a gilt
thumb (`drawWikiRail`; clicking the rail pages). Left/right (A/D) or a click switch pages, and
right past the last page opens PATCH NOTES; ESC leaves. What the pages say is [gameplay.md](../../gameplay/the-wiki.md).

A page is data. `WIKI_PAGES` is `{ id, label, build(cw) }` and `build` returns the page's
**blocks** top to bottom for a content width — `line` (a sentence), `rule` (a gold rule), `head` (a section name
with its column heads over their columns), `row` (an item in its well with its numbers in
the columns, `WIKI_ITEM_COLS` naming each column's label, width and getter; hoverable, answering
`tipItem`), `legend` (the deer wearing the overhead frame, a leader from each part of it
to its name), `beast` (a kind standing on its snow beside its growth table, `WIKI_BEASTS`),
`cls` (a class card: the body at 3x, pitch, health and the stat pips, `WIKI_STATS`), `story`
(the hero's story under its card, `CLASSES` `story` wrapped by `wikiWrap` from
`WIKI_CLS_TEXT_X` in `WIKI_STORY_INK`, hung off a thin rule), `ab`
(an ability: key plate, the strip's icon in a well, name, the `WIKI_AB_COLS` numbers, the blurb
wrapped by `wikiWrap`; hoverable, answering `tipClassAb`) and `lore` (a WORLD entry,
`WIKI_WORLD`: its figures in a `WIKI_FIG_W` column, its name in gold and its paragraph from
`WIKI_TEXT_X`, as tall as the taller of the two) —
each with a fixed height, built once per content width (`wikiBlocks(pageId, cw)`: a page whose
`build` reads `cw` wraps its sentences, a hero's story or a beast's line, to a slab that has
narrowed with the view). `wikiLayout()` is the single source of
every rect: the slab, the tab cells, the window, each block's y (pre-scroll), the scroll bound,
the rail and its thumb; `wikiHit(mx, my)` reads it back as a tab, a row (carrying its item id,
which is what the tooltip asks for) or the rail, so the hover, the click and the tooltip can
never disagree. Per-page scroll lives in `wikiScroll` beside the settings slab's `setScroll`;
the open page is `menu.wikiTab`. A new page is one table entry and one builder.

`drawWikiBeast` draws a kind exactly as `drawAnimal` hangs its frame in the world — the same
`drawBeastFrame` (js/draw/bodies.js) over the same sprite, on a low snow mound, at the least level
the kind spawns at (a bear's growth columns start there too, `wikiLevels`) — so the page teaches the frame by showing it, and a change to the
frame in the world changes it on the page. A camp monster's leash bar is shown part-filled, since bare
track says nothing. An ITEMS row (`drawWikiRow`) is the item's icon in a well rimmed part or
finished the way the shop rims it, white and lifted a pixel under the pointer, its name, a dotted
leader to its numbers. A WORLD entry's figures (`drawWikiFig`) are whatever sprites its `fig()`
returns at draw time — so they wear the side you play through `skin` — stood left to right on
one mound (`wikiMound`, the beasts' own; `road` makes it packed earth in the road's colours,
`air` leaves the eagle, a sprite seen from above, on no ground at all). Nothing here is bought
or pressed: a click only opens a tab or pages the rail.
