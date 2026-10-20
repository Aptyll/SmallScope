# The patch notes screen

`m.screen = 'notes'` (js/ui/notes.js `patch notes`), opened from the `PATCH_TXT` tag and eased in
on its own `notesT` like the wiki. **The title's tabs** (js/ui/notes.js `the pages' tabs`) stand
over it and over the wiki: WIKI, PATCH NOTES, ROADMAP and KITCHEN at scale 2 across the top at `NOTES_TOP`,
the open one gold over the gold rule, the rest dim and lighter under the pointer. `drawPageTabs`
draws the row once for both screens (from `renderTitle`), so switching between them cross-fades
the page under a steady row; `openPageTab(i)` switches, and Left/Right walk the wiki's pages, then
PATCH NOTES, then ROADMAP. KITCHEN (`PAGE_LINK_TAB`) is a link, not a page: a small arrow
(`drawLinkArrow`) follows the word, a click opens `KITCHEN_URL` (the Softfall Kitchen website, its own
repo) with `window.open`, which the Electron build hands to the player's browser
(`setWindowOpenHandler`, desktop/main.js), and the keys stop at ROADMAP so they never leave the game.
The `PATCH_TXT` tag always opens on PATCH NOTES (`menu.notesTab` 0).
It is the whole view: a dark veil over the world, the tabs, and one column (`NOTES_W_MAX` = 440, narrowing with
the view) of folding groups, newest at the top. First EVERY PATCH: `PATCH_NOTES` folded by tenth
(0.390 - 0.391, 0.380 - 0.389 ... `NOTES_GROUPS`, built off the list, so a new patch needs nothing
here). A note with a third field shows that picture under its text (`NOTES_PICS`, from
`window.NOTES_ART` in the generated js/baked/notesart.js), scaled up by whole pixels to fit the column,
at most `NOTES_PIC_MAX` times. Below them the HIGHLIGHTS: `PATCH_DIGEST`, hand-written, the patches
since `DIGEST_FROM` condensed into short lines by what a player notices, each with its patch dim on
the right. A group is a chevron and its name; a click or Enter on the keys' pick folds it
(`notesOpen`, session only; only the newest patches start open). Only whole rows draw, never
one cut by the window's edge; a hairline rail with a gold thumb shows the scroll (wheel, Up/Down,
a click on the rail pages). The ROADMAP tab (`menu.notesTab` 1) is the same column over
`ROADMAP`'s sections (`ROAD_GROUPS`, all open at first): each section's done count dim on the
right, each line a 5 px box (an open ring to do, solid gold done, its words dimmed) and its words.
Esc on either tab goes back to the title.
