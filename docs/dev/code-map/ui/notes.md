# js/ui/notes.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the title's three tabs (WIKI, PATCH NOTES, ROADMAP) over the wiki and the notes screen: the row, which is open, what is under a point, the switch, the draw | `PAGE_TABS`, `PAGE_TAB_GAP`, `NOTES_TOP`, `pageTabOpen`, `pageTabsLayout`, `pageTabHit`, `openPageTab`, `drawPageTabs` (called once from `renderTitle`, js/ui/menu.js) | `the pages' tabs` |
| the roadmap: what is left to build, by section, each line to do or done | `ROADMAP`, `ROAD_GROUPS`, `drawRoadBox` | `roadmap` (drawn by `renderNotes` on `menu.notesTab` 1) |
| the patch notes screen: every patch folded by tenth newest first, the pictures notes carry, the hand-written digest, what is open, the layout, what is under a point, the keys, the draw | `PATCH_DIGEST`, `DIGEST_FROM`, `NOTES_PICS`, `NOTES_PIC_MAX`, `NOTES_GROUPS`, `notesGroups`, `notesOpen`, `notesScroll`, `NOTES_W_MAX`, `notesLayout`, `notesHit`, `beginNotes`/`leaveNotes`, `notesScrollBy`, `notesToggle`, `notesKey`, `notesClick`, `drawNotesChevron`, `renderNotes` | `patch notes` (the list itself: `PATCH_NOTES`, js/ui/menu.js; its ease: `menu.notesT`, core.js; the wheel: input.js; the cursor: `cursorInfo`, js/draw/render.js) |
