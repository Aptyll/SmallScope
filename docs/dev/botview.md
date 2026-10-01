# The bot dev view

A window into what every bot is thinking: on the map in the game, and on an out-of-game page that
watches a match live or reviews saved ones. It is a dev instrument. It only reads the sim, and only
in a game of your own (`botViewOk`: a solo game or the title screen's living world): online it
would show a host the rival side's plans, so F4 and F6 do nothing there. Code: [js/ui/botview.js](../../js/ui/botview.js) and [botlab.html](../../botlab.html).

## Keys

- **F4** steps the in-game view: off, then the map, then the map and the table.
  - The map: a dotted line from each bot to what it is after, ending in a ring, and its goal word
    under its feet in its kind's colour, flashing white for a moment when it changes
    (`BOT_FLASH`). Hover a bot for its card: level, goal and why, what it is after and how many
    tiles away, HP, and whatever the brain wrote of its role, mood, plan and the options it
    weighed. The hovered bot's line goes solid.
  - The table (under the minimap): every bot by side, its level's first letter in the level's
    colour (`BOT_LEVEL_COL`), goal, kills, deaths, and a bar of how it has spent the match,
    coloured by kind. Hovering a row is hovering that bot: its card opens beside the row, so a bot
    off screen still has one. Under the rows one line per level: bots this match (+ finished
    matches this session), average kills, deaths and damage.
- **F6** opens [botlab.html](../../botlab.html) as a window of the game's own.
- `DBG.botView` (0..2) sets F4's step; `DBG.botThought(p)`, `DBG.BOTLOG`, `DBG.botLogExport()`
  and `DBG.openBotLab()` are the same code the keys reach.

## Where a thought comes from

The brain writes `p.ai.thought` (the record in the bot contract,
`/mnt/project-files/ai-behaviors/contract.md` until it lands in these docs):

```js
p.ai.thought = { goal, why, target: { x, y, kind, ref, id } | null,
  role, mood, plan, options: [{ goal, score }], skill, src, t }
```

`botThought(p)` is the one reader; a target counts only where it is a finite point (`botPoint`:
its `x, y`, else a tile's centre). Until a bot has a thought, `botGuess` reads the goal off the
ladder's own marks (a shot in flight, `want`, a rival noticed past the level's reaction time
(`seeT`, the ladder's engage rule), `huntTgt`, `tgt`, `hideT`, `roam`) and marks it `guess`; every
surface draws a guessed goal with a trailing `?`, so a guess never passes for the brain's word. A
shot at game is the hunt it belongs to (HUNT), at a wolf WOLF, at a rival, a soldier or a bear
FIGHT.

A goal is coloured by what it is for, six kinds: PUSH (push, rally, siege), RETREAT (flee, hide),
DEFEND (defend, guard, escort, follow) and FIGHT (fight, wolf) are loud; FARM (gather, mine, hunt,
eat, loot, build, spend, shop, forge) and ROAM (roam, idle) are quiet, because they are most of any
match and a fight or a push is what the eye should find. The six were checked as a set on the page's
panel for colour-blind separation in their stacking order, and none is a side's red or blue.
`BOT_GOALS` files each goal word in the game; the page's `KINDS` files the same words (and the
match log's activities), so a new word goes in both. A word nobody filed shows grey in the game and
counts as ROAM on the page. In the game ROAM is a lighter grey than on the page, since there it is
a word on a dark plate.

## The recorder

`botLogStep` runs in `updatePlay` after every player has stepped, and does its work every
`BOTLOG_STEP` of play on its own clock (`BOTLOG.t`), so a sped-up or long match stays cheap. Per
bot it keeps the seconds spent on each goal, every goal change (`{ t, id, goal, why, guess, x, y, tx, ty }`) and a sample a second
(`{ t, id, x, y, hp, mhp, k, d, goal }`). For everyone it keeps the kills (`{ t, a, v, x, y }`: a
body that went down this step, credited to whoever's kill count rose with it, `a = -1` for nobody),
and a sample a second of both birds (`{ t, e: [[hp, maxHp, state]] }` by team). A new drop (a new
`state.drop`) or the match clock running backward starts a new match (`BOTLOG.n` counts them), and
the old one's summary joins `BOTLOG.matches` (the session's last 50). None of it is sim state: it is in no save and on no wire.

`botLogExport()` is what the page saves: `{ kind: 'softfall-botlog', v: 1, seed, len, world, map,
sides, bots, people, events, samples, kills, birds, matches }`, where `map` is the minimap's
terrain as a PNG data URL (one pixel a tile), `world` the map's width in world pixels, `sides` each
team's paint on this screen (`{ name, col }` by team index) and `people` the seats no brain drives.

## The page

[botlab.html](../../botlab.html) is one file with no fetch, so it works double-clicked. Opened with
F6 it says hello, the game answers with its log, and then sends a frame four times a second
(`BOTLAB_T`) by `postMessage`: every bot's thought, the birds, the people, and the goal changes and
kills recorded since the last frame, with the recorder's match number so a new match starts the
page over. SAVE asks the game for a fresh export and downloads it. The desktop build ships the page
beside index.html (desktop/build.js) and opens it as a child of the game's window, so closing the
game closes it and the app quits. Opened on its own it shows its two ways in (F6 in the game, or
OPEN), and OPEN (or a drop anywhere on the page) takes any mix of:

- a saved botlog (the game's recorder, with its terrain and its session's earlier matches);
- match files from the fun-tests runner (`match-log.md` v1: `{ v: 1, seats, samples, events,
  players, fun }`), whose per-seat time is the brain's goals once they exist, else the sim's
  activities (`act`), with the run folder's terrain file (`map-<seed>-<shape>.json`) picked
  up by name when it is opened alongside (or the log's own inline `map`);
- a run folder's `summary.jsonl` (stats only, no replay);
- a ladder record `{ id, seed, shape, a, b, winner, ticks, log }` carrying either of the above.

A match loaded twice (a run's match file and its `summary.jsonl` line) counts once, the
replayable copy kept. A match file's sides are painted the way its seat names are: seat 0's side
blue (the game's `settings.teamBlue`). The header's picker switches between the live game and
every loaded match that replays.

**MATCH** is laid out like the game's own screen: the blue side down the left, the map in the
middle, the red side down the right, and the whole match along the bottom.

- Each side's strip: its name and kills, what the side is doing as a word (FIGHTING, PUSHING...:
  a loud kind two of its bots share, else what most of them do; ALL DOWN when none stands) with a
  pip per seat in that seat's kind (dark once down), and its bird's nerve as a bar; WON on the
  winner once a replay reaches the end. The clock sits between them.
- A card per seat: name, level, kills and deaths, the goal in plain ink beside its kind's mark (a
  guess with `?`) and why, and health. Hover a card to light the bot on the map and its row;
  click to pick it.
- The map: terrain dimmed so the marks carry (a grid where the log has none), each bot's last 20 s
  of path (`TRAIL_S`), a target line for the loud kinds (and for the picked bot), its kind as a ring
  round its side's dot, the birds with a ring of their nerve (live only: a log has
  no bird positions), and a cross where someone fell, fading over `KILL_S`. HEAT (H) shades
  where each side has stood up to now. The wheel zooms at the pointer, a drag pans, a
  double-click shows the whole map, F follows the picked bot; names show when zoomed or hovered.
- The picked bot (the edge column's top): goal and why, how long held, role, mood and plan, the
  options the brain weighed as bars, how it has spent the match, health and record.
- FEED: kills, each bird's nerve every tenth it loses, every bot turning to a side's business
  (`KEY_GOALS`: push, rally, defend, retreat...) and the picked bot's every goal; ALL adds every
  goal change. A bot flipping among two goals (three changes or more, each within `FLIP_S`) is one
  line with a count. A line picks its bot and jumps the replay there.
- The timeline, top to bottom: a lane per bird, full while it is whole and dipping as it is hurt;
  the kills, a diamond each in the killer's side colour (click one to pick the killer); a band per
  side, its bots stacked by kind, so its height is how many stand and its colours what they are
  doing (each column averaged over a few seconds, `SIDE_SMOOTH`, so a bot flickering between two
  goals doesn't stripe it); and the picked or hovered bot's own goals. A replay veils what has not
  happened yet. Click or drag to scrub; hover any row for what is under the pointer. The legend
  lists the kinds this match used by share of time, each word's goals on hover; hover one to light
  it everywhere, click to keep it lit. PLAY and a speed (1x to 30x) drive a replay.

**COMPARE** puts every known match side by side (live, the session's finished ones, everything
loaded): matches, average length and fun, kills per match and wins by side; per level, kills,
K/D, damage and siege per bot as bars, and how each level spends its time; the fun score's parts
averaged (`FUN_PARTS`, what the fun-tests scorer measures); and the match list, sortable, with
length, winner, fun and kills as bars. Click a match to watch it.

Keys: space plays, the arrows step a second (shift: ten), Home / End jump, up / down pick the next
bot, Esc lets go, F follows, H heat, 1 / 2 the views. Everything else is on hover.
