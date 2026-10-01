# The arena: bot-vs-bot matches without a browser

`app/arena/` plays whole matches between bots in Node, fast and headless, writes each one as a
match log, and scores how fun it was. Use it to see what a change to the bots (or to anything
they play) does to a hundred matches instead of one. No packages.

```
node app/arena/run.js --seeds 1-20 --level 0 --out arena-out/normal
node app/arena/run.js --seeds 1-8 --level 0,1,2            # a sweep over the three difficulties
node app/arena/run.js --seeds 1-8 --kind versus --a 1 --b 0 # HARD against NORMAL, no ally bonus
node app/arena/match.js '{"seed":42,"maxMin":3}' > one.json   # one match, its log on stdout
```

`run.js` flags: `--seeds` (`a-b` or `a,b,c`), `--level` (one or a list of `AI_LEVELS` indexes),
`--kind level|versus` with `--a`/`--b`, `--proxy` (the profile seat 0 plays, below), `--shape`
(`MAPS` index), `--max` (minutes before a timeout, default 40), `--every` (sample pitch in s,
default 2), `--jobs` (parallel matches, default one per core), `--out` (default
`arena-out/<date>`, gitignored), `--quiet`. It writes `<out>/<id>.json` per match,
`<out>/summary.jsonl` (one line per match without the samples), `<out>/map-<seed>-<shape>.json` (the terrain as the minimap paints it, once per seed and shape) and `<out>/aggregate.json` (the
means per setup), and prints a table.

From a script: `require('./app/arena/match').playMatch(opts)` plays one match in the calling
process and returns its log; `require('./app/arena/run').playChild(opts)` does it in a child
process and resolves with the log. **One page per process**: the game's scripts share one global
scope, so a process boots one world and plays one match.

Speed: about 6x real time per core early in a match, falling to about 2x in a big late fight; a
fifteen-minute match is three to five minutes of one core.

## Files

| File | What it owns |
| --- | --- |
| `app/arena/headless.js` | `bootGame`: the page without a browser. Runs every script `index.html` lists, in order, in this process's global scope; a stub `document`/`window`; a canvas that keeps only alpha, only for canvases up to 512x512, and supports what sprite bakes use (`fillRect`, `clearRect`, `drawImage` with translate/scale, `get`/`putImageData`); an inert audio graph; timers that never fire; `performance.now()` pinned at 0 |
| `app/arena/match.js` | `playMatch`: seats, the drop, the step loop, sampling, the kill and bird watchers, the log |
| `app/arena/fun.js` | `funScore`: the eight parts and the score, `FUN_WEIGHTS` and the tuning constants |
| `app/arena/run.js` | the batch: a queue of matches over child processes, the files, the table, `aggregate` |
| `app/arena/rescore.js` | a run folder scored again with today's fun.js |

## Is it the real game?

Yes, by construction and by test. Nothing in the sim is copied or changed: `playMatch` calls the
game's own `beginDrop` and `update(TICK_DT)`. Two wrappers watch without changing anything (`die`
for the kill feed, `hurtEagle` for who last hit a bird).

- **Tick for tick.** A Chromium page with its frame loop held off (`requestAnimationFrame` and
  `performance.now` stubbed before load) driven by the same steps reaches the same position, hp
  and gold for all ten players at every 10 s of a two-minute match on seed 42 as the arena does.
- **Pixels the sim reads.** The one pixel read in the sim is a building's shot box off its
  sprite's opaque pixels (`artBox`, js/sim.js). The bounding box and pixel count of 764 of the 769
  sprite canvases match Chromium exactly, every building among them; the other five are the
  berry and fish icons and the three `rockFill` overlays, which only the draw reads.
- **Replays.** One seed is one exact match: two runs give byte-identical samples and events.

What differs from a real match, on purpose:

- **No title screen.** The page boots and flies at once. A browser page idling on the title
  spends rng draws on its live world first, which is why the browser recipe in
  [multiplayer.md](multiplayer.md#bots) called a seed "a distribution, not a replay".
- **Seat 0 is a bot.** It is the page's `player`, `control = 'ai'`, with `sampleHumanInput`
  stubbed. The brain never ranks `player` into a push or a guard (`aiRank`), so seat 0 plays like
  a human who fights and farms but never leads the push. In `level` it wears `AI_LEVELS[proxy]`
  (NORMAL by default), a middling player.
- **The clock never stops for seat 0's death.** A dead `player` puts the page in `'dead'`, which
  stops `state.elapsed` and the day. The harness puts it back to `'play'` each tick, so the match
  runs on as it does for everyone else in it. The respawn itself is the game's.
- **The first flight is not scripted** (`PROFILE.markDropped()`), so every rider may leap.

## Setups

- **`level`** (default): the game as a human meets it at `settings.aiLevel`: seat 0's side (team 0)
  are the ALLIES (`AI_ALLIES`, a notch up and supportive), team 1 the RIVALS. A lopsided win rate
  is expected here; it is the difficulty.
- **`versus`**: team 0 plays `AI_LEVELS[a]`, team 1 `AI_LEVELS[b]` through `p.ai.prof`, no ally
  bonus. `a = b` is a mirror match.
- **Bot files** (js/bots/api.js, [docs/bots/](../bots/)): `playMatch({ seats: { 0: 'starter', 1: 'pack' } })`
  assigns seats to programs in the library (the baked examples are there already) before the drop;
  `bots: { id: source }` adds more, inline. Same seed and same files, same match.
  `beforeDrop(G)` is a raw hook for anything else.

## The match log

The format is written down for the other tools that read it (the ladder, the dashboard) at
`/mnt/project-files/ai-behaviors/match-log.md`; the source of truth is `playMatch`. In short:
a header (seed, shape, patch, setup, seats), `result` (`winner`, `reason`
`'eagle' | 'timeout' | 'error'`, `time`, `ticks`), a sample every `sampleEvery` s (both birds'
nerve and state, and per player position, hp, level, gold, damage, siege, kills, deaths, what
it was doing and its brain's goal), sparse `events` (kills, each 10% of a bird's nerve lost, a
bird driven off), per-player finals and `fun`.

`act`, what a body did over a sample window, is read off the sim so it means the same for every
brain: `dead`, `fight` (dealt or took damage), `siege` (hurt the bird or a building), `work`
(earned more gold than the window's passive income, the clock's trickle plus one), `move` (went
more than a tile, or rode), else `idle`. `goal` is
`p.ai.thought.goal` when a brain writes one, else null.

## The fun score

Eight parts in 0..1 and a weighted mean out of 100 (`FUN_WEIGHTS`, fun.js). It is a proxy for
fun, built to move when matches get more or less interesting; the raw numbers behind each part
ride along in `fun.raw`, so read those before trusting the squash. `node app/arena/rescore.js <run folder>`
scores a folder of logs again with today's fun.js without replaying anything, which is how the
weights are tuned.

| Part | Weight | 1.0 means | Measured |
| --- | --- | --- | --- |
| `close` | 2 | the loser nearly won | 1 minus the lowest the winner's bird fell all match (it regains nerve between assaults, so the end says little); a timeout: 1 minus the gap between the two lows |
| `swings` | 2 | the lead changed hands | lead changes, up to 3. The lead is `leadAt`: 0.6 x the nerve gap + 0.2 x the kill gap + 0.2 x the gold gap, averaged over 30 s, dead zone 0.05 |
| `comeback` | 1 | the winner was well behind once | the winner's worst deficit on that lead line, full at 0.3 |
| `length` | 1 | 12 to 18 minutes | falling to 0 at 5 and 30 |
| `action` | 2 | the fighting keeps coming | the longest gap after both birds land with no player damaging a player: free up to 60 s, 0 at 240 s |
| `busy` | 2 | nobody stands around | 1 minus twice the idle share of the time bodies were up |
| `spread` | 1 | the whole map is used | share of the walkable 8x8-tile cells anyone stood in, full at 60% |
| `variety` | 1 | bots do many things | entropy of the time spent on fight / siege / work / move, averaged with the goal entropy when brains write goals |

## Baselines

Runs live in `/mnt/project-files/ai-behaviors/runs/<name>/` so every thread can compare against
them. Re-run the same seeds and setup after a change and compare the two `aggregate.json` files.
