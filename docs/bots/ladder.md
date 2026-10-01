# The bot ladder

Bot files play rated matches against each other, and every match is kept. Today the ladder runs
**offline, on your own computer**, through the headless match runner (`app/arena/`, no browser
needed). It is built so the same rules can run on a server later; see [Going online](#going-online).

## Running it

From the repository root (Node only, no packages):

```
node app/ladder/ladder.js add path/to/mybot.js        # enter your bot (id = file name, or --id)
node app/ladder/ladder.js run --matches 20            # play 20 rated matches
node app/ladder/ladder.js table                       # print the standings
node app/ladder/ladder.js page                        # rewrite the standings page
node app/ladder/ladder.js retire mybot                # stop scheduling a bot (--undo to bring it back)
```

`run` flags: `--matches` (default 4), `--jobs` (matches at once, default one per core), `--max`
(minutes before a match is called a draw, default 30). Every command takes `--dir` (default
`ladder-data/`, which git ignores). The example bots in `bots/` are always on the ladder.

A full match takes a few minutes of one core; `run` prints each result as it lands, then the
table, then the path of the standings page.

## How it works

- **An entry is one bot file playing all five seats of a side.** Seats 0, 2, 4, 6, 8 are team 0;
  1, 3, 5, 7, 9 are team 1. Sides alternate from one match to the next.
- **Pairing:** the entry with the fewest games plays one of the four closest to it in rating.
  Each match gets a fresh seed and map shape, both recorded, so any match can be replayed.
- **Rating:** Elo, everyone starts at 1000, K = 32. A driven-off bird is a win; a match that
  reaches `--max` is a draw; a match that crashes is not rated.
- **A changed file** keeps its rating and counts a new revision (`r2`, `r3` on the page), so
  you can watch a bot climb as you improve it. Retire it and enter it under a new id to start fresh.
- **Fairness:** every seat sees only what its player could see and aims with the same hands
  ([api.md](api.md#hands), arriving with the difficulty work), so the ladder ranks decisions, not aim.

## What it keeps

```
ladder-data/
  ladder.json      entries: rating, games, W/L/D, revision, file hash
  history.jsonl    one line per match: who, sides, seed, map, result, ratings before and after,
                   each side's kills, deaths, damage, siege, gold and bird nerve left, fun score
  logs/<id>.json   the full match log (the format the bot lab reads; F6 in the game, or botlab.html)
  bots/<id>.js     the files you entered
  ladder.html      the standings page: open it straight off the disk
```

The page shows the standings with each bot's rating over its matches, a head-to-head table
(row's win % against the column), and every match with its log. Click a bot to see only its
matches.

## Trust

On your computer a bot file runs inside the match process with your computer's rights. **Enter
only files you trust.** The online ladder will run each bot in its own sandboxed process (below).

## Going online

Everything that crosses between the game and a bot is a plain JSON message ([api.md](api.md#messages)),
and the ladder's rules (pairing, rating, the match record) live in `app/ladder/core.js` with no
files or processes in it. Going online changes where things run, not what a bot file is:

1. **A server runs the matches.** The same arena runner, on a server, plays the queue.
2. **Bots run sandboxed.** Each seat's bot runs in its own isolated process or container and
   talks to the match over a socket: a third transport beside `inline` and `worker`
   (`BOT_TRANSPORTS`, js/bots/api.js), carrying the same messages. Lockstep keeps a match exact.
3. **Records go in a database** instead of `ladder-data/`: the same `history.jsonl` records and
   logs, served to a web version of the standings page.
4. **People upload files** instead of `add`; a changed upload is a new revision, as now.

A bot written today against `api: 1` runs unchanged on that ladder.
