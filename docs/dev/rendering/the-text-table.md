# The text table

Every word the game prints for its own screens lives in `TEXT` ([js/app/text.js](../../../js/app/text.js)),
once, by key, and a screen asks for it with `tr('end.lost')`. It is the one place to read the
game's voice and fix a word, and the shape a translation drops into later: a second table with
the same keys.

**Keys** are `screen.thing`: `end.*` the end of a match, `score.*` the post-game stats, `recap.*`
the death recap, `board.*` the TAB scoreboard. A number or a name goes in through a slot,
`tr('end.respawn', { s: 5 })` for `RESPAWNING IN {s}S`, never by gluing strings round a word, so
another language can move it. A screen that keeps its choices in a data table keeps the keys
there (`DEAD_ITEMS`, `SCORE_GROUPS`, `RC_KIND`) and compares keys, never printed words, so a
reworded label never breaks a click.

**What stays out.** A thing's own name and blurb stay on its entry (`CLASSES`, `ITEMS`, `OBJECTS`,
`STRUCTS`: what a type is lives in its entry). The patch notes are history (`PATCH_NOTES`). A
player's name is data.

**The rules for a value** are lore.md's: capitals, the font's alphabet (`GLYPHS`, js/app/font.js:
no long dash, no ampersand, no brackets), and read in a second ([show, don't label](show-dont-label.md)).

**The check** (app/check-text.js, part of `node app/check-globals.js`) fails a `tr()` key that is
not in the table, a key nothing names, a character the font lacks, and a loose word in a file on
its `MOVED` list. A file joins `MOVED` once its last word has moved in, and never leaves, so the
table only grows. `node app/check-text.js --loose` counts the words still outside it, by file.
