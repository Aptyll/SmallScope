# The bot dev view

A window into what every bot is thinking: on the map in the game, and on an out-of-game page that
watches a match live or reviews saved ones. It is a dev instrument. It only reads the sim, so it
works on a host, in a solo game and on the title screen's living world; a client runs no sim and
sees nothing. Code: [js/ui/botview.js](../../js/ui/botview.js) and [botlab.html](../../botlab.html).

## Keys

- **F4** steps the in-game view: off, then the map, then the map and the table.
  - The map: a dotted line from each bot to what it is after, ending in a ring, and its goal word
    under its feet in the goal's colour, flashing white for a moment when it changes
    (`BOT_FLASH`). Hover a bot for its card: level, goal and why, what it is after and how many
    tiles away, HP, and whatever the brain wrote of its role, mood, plan and the options it
    weighed. The hovered bot's line goes solid.
  - The table (under the minimap): every bot by side, its level's first letter in the level's
    colour (`BOT_LEVEL_COL`), goal, kills, deaths, and a bar of how it has spent the match, one
    colour per goal. Hovering a row is hovering that bot: its card opens beside the row, so a bot
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

`skill` is written by the skill layer (`skillHands`, js/ai-skill.js) onto any thought a brain
has written: `{ level, react, aim, off, rate, slip }` - the profile's name and reaction time,
the aim wobble in px right now, how far the crosshair trails the wish (rad), the notice rate
(under 1: a rival outside its cone) and the lapse in play, if any.

`botThought(p)` is the one reader. Until a bot has a thought, `botGuess` reads the goal off the
ladder's own marks (a shot in flight, `want`, a rival noticed past the level's reaction time
(`seeT`, the ladder's engage rule), `huntTgt`, `tgt`, `hideT`, `roam`) and marks it `guess`; every surface draws a guessed goal with a trailing `?`, so a guess never passes for the
brain's word. Goal colours are `BOT_GOALS`; a goal word it does not know shows in a neutral grey.
The page keeps its own copy of the table (`GOALS`), so a new colour goes in both.

## The recorder

`botLogStep` runs in `updatePlay` after every player has stepped. Per bot it keeps the seconds spent
on each goal, every goal change (`{ t, id, goal, why, guess, x, y, tx, ty }`) and a sample a second
(`{ t, id, x, y, hp, goal }`). When the match clock runs backward a new match has begun, and the old
one's summary joins `BOTLOG.matches` (the session's last 50). None of it is sim state: it is in no
save and on no wire.

`botLogExport()` is what the page saves: `{ kind: 'softfall-botlog', v: 1, seed, len, world, map,
bots, events, samples, matches }`, where `map` is the minimap's terrain as a PNG data URL (one
pixel a tile) and `world` the map's width in world pixels.

## The page

[botlab.html](../../botlab.html) is one file with no fetch, so it works double-clicked. Opened with
F6 it says hello, the game answers with its log, and then sends a frame of every bot's thought
four times a second (`BOTLAB_T`) by `postMessage`; SAVE LOG asks the game for a fresh export and
downloads it. The desktop build ships the page beside index.html (desktop/build.js). Opened on
its own, OPEN LOGS (or a drop anywhere on the page) takes any mix of:

- a saved botlog (the game's recorder, with its terrain and its session's earlier matches);
- match files from the fun-tests runner (`match-log.md` v1: `{ v: 1, seats, samples, events,
  players, fun }`), whose per-seat time is the brain's goals once they exist, else the sim's
  activities (`act`);
- a run folder's `summary.jsonl` (stats only, no replay);
- a ladder record `{ id, seed, shape, a, b, winner, ticks, log }` carrying either of the above.

A match loaded twice (a run's match file and its `summary.jsonl` line) counts once, the
replayable copy kept. A match file's sides are painted the way its seat names are: seat 0's side
blue (the game's `settings.teamBlue`). Match files carry no terrain, so their map is bare.

The map draws each bot's last 20 s of path (`TRAIL_S`), its target line and its goal as the dot's
centre. The wheel zooms at the pointer, a drag pans, a double-click shows the whole map, and F
follows the selected bot. A replay has a scrubber, PLAY and a speed (1x to 30x).

The tabs:

- **BOTS**: every bot now (live) or at the scrubber's time (a replay): level, goal and why, HP,
  record, and its time bar. Click a row or a bot on the map to select it; its line goes solid and
  the FEED narrows to it.
- **TIMELINE**: one lane per bot, its goal (or activity) coloured across the whole match, kills
  as white ticks on the killer's lane, and the cursor at the scrubber. Click to jump there and pick
  the bot.
- **FEED**: goal changes, newest first; for a match file, its kills and bird events. Click a line
  to jump the replay to it.
- **STATS**: every match known (live, the session's finished ones, everything loaded): per level
  bots, kills, deaths, K/D, damage and siege per bot; the share of time per goal and, separately,
  per activity; and a match list with length, winner and fun score. Click a match to replay it.

Keys: space plays, the arrows step a second (shift: ten), Home / End jump, Esc lets go of the
selected bot, F follows it, 1-4 pick the tabs.
