# The patch check (app/regress/)

The same small set of bot matches, replayed on every patch and read side by side. It is the
ladder used as QA: a patch that flips a winner, drains the fun score, makes matches drag or
crashes a bot shows up as a flag on a seed you can replay. It never judges balance by itself:
the fun score measures a match, and human play stays the judge. Nothing in the game changes
for it; it only drives the arena runner ([arena.md](arena.md)).

## Running it

```
node app/regress/regress.js run            play the set under this patch's name, then diff with the run before
node app/regress/regress.js diff [a] [b]   two runs side by side (default: the newest two)
node app/regress/regress.js page           rewrite regress.html from every run and the ladder's history
node app/regress/regress.js same           play the first match twice and compare: is the sim deterministic?
```

`run` flags: `--jobs` (matches at once, default one per core), `--as 4.50` (a branch before
its bump: keep the run under that name), `--only <key>` (one match of the set), `--max min`
(cut every match there instead). Every command takes `--dir` (default `regress-data/`,
git-ignored) and `--ladder` (default `ladder-data/`).

The set (`set.js`) is four matches cut at six minutes: about a minute of wall clock each on
one core. Run it before a PR that touches the sim, the brain or the bots, and read the diff.
A change to the set makes the run after it incomparable with the one before; the diff says
`SETUP` on the matches that changed.

## What it keeps

```
regress-data/
  <patch>/summary.json   one row per match: setup, winner, reason, minutes, kills, fun and its parts,
                         each side's kills, deaths, damage, siege, gold and bird nerve left, bot errors
  <patch>/<key>.json     the full match log (the bot lab opens it: F6 in the game, or botlab.html)
  <patch>/map-*.json     the terrain, once per seed and shape
  regress.html           the page: patches across, matches down, flags where a cell moved
  seasons.json           the ladder's history cut into one season per patch
```

A match's key (`1-0-L0-brain`: seed, map, side setup, who plays) is what one patch is matched
to the next on. `patch` is `PATCH_TXT` as the match log records it.

## The flags

| flag | means |
| --- | --- |
| `FLIP` | a different winner than the run before |
| `FUN+` / `FUN-` | the fun score moved 8 or more points |
| `LONGER` / `SHORTER` | match length moved a quarter or more |
| `BLOODIER` / `QUIETER` | kills moved by half or more, and at least 4 |
| `ERROR` | the match crashed on this patch and did not before |
| `BOT ERRORS` | a bot file threw more often than before |
| `SETUP` | the set changed for this match; not comparable |
| `NEW` | no run before to compare with |

The thresholds are `FLAG_FUN`, `FLAG_TIME` and `FLAG_KILLS` in `regress.js`. A cut-short
match is a draw; its numbers still compare. One flag is a seed to replay in the bot lab, not
a verdict: the same seed can flip on a one-pixel change in a chase.

## Seasons

The ladder's `history.jsonl` records the patch each match was played on. The page cuts it
into one season per patch, every entry rated from 1000 again within the season, so a bot's
rating reads against the game it played, and a bot whose rating drops after a balance patch
reads as "the game changed" rather than "the ladder broke". The ladder's own standings
(`app/ladder/`) are untouched; this is a second reading of the same records.

## Files

| File | What it owns |
| --- | --- |
| `app/regress/set.js` | `MATCHES`, the fixed set, and `keyOf`, a match's stable name |
| `app/regress/regress.js` | the commands; `rowOf` (a log to its row), `flagsOf`/`diffOf`/`totals` (two runs compared), `same` |
| `app/regress/page.js` | `writePage` (regress.html and seasons.json), `seasonsOf` (history cut by patch), `GLOSSARY` |
