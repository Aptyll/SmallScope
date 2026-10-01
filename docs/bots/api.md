# Bot API reference (api 1)

Everything a bot file reads and writes. Units: world pixels (y grows downward), seconds, ticks
of 1/60 s. A tile is 16 px; the world is `hello.map.world` tiles square. Teams are `0` and `1`,
the roster's real index (the game paints your own side blue on screen; the API never does).
Seats are `0..9`; seat `i` is on team `i % 2`.

The host side is [js/bots/api.js](../../js/bots/api.js); a field here that disagrees with it is
a bug in this page.

## The file

```js
defineBot({
  name: 'NAME', author: 'you', version: '1.0',  // shown on the ladder
  init(hello) { },          // optional: once, when the seat is taken
  think(obs, hello) { },    // every think: return an act, or null to keep holding
  end(result) { },          // optional: 'won' | 'lost' when the match is over
});
```

The file runs with only `defineBot` and standard JavaScript in reach: no `window`, no game
globals, no storage, no network. Keep state on `this`.

**Sealed.** On the ladder and in headless matches your file runs in a context of its own (a Node
vm), and in the game it runs in a Web Worker. Either way `Math.random` is seeded from the match
(seed and seat), and the clock stands still (`Date.now()` is 0), so the same seed and files
replay the same match. One think may take **50 ms of CPU** on the ladder; a think over that
counts as an error and your seat keeps its last act. (Only the example bots baked into the game
run in the page itself.)

## Timing

- The sim steps 60 times a second; a bot **thinks every 6 ticks** (10 a second), seats staggered.
- **Held** fields of an act stay held until the next act. **Edge** fields fire once, on the tick
  the act arrives.
- **Live game:** an answer that has not arrived by the next think is skipped (counted as `late`);
  the seat keeps its last act.
- **Headless and ladder:** lockstep. The runner does not step until every seat has answered, so a
  match is the same match every time for the same seed and the same files.

## Messages

Every message is plain JSON. You never send these yourself; `defineBot` does it for you. They
are listed because a socket transport later will carry exactly these.

| direction | message | when |
| --- | --- | --- |
| game → bot | `{ t: 'hello', api, seat, team, cls, name, seed, rules, map }` | once |
| bot → game | `{ t: 'ready', name, author, version }` | answer to hello |
| game → bot | `{ t: 'obs', tick, obs }` | every think |
| bot → game | `{ t: 'act', tick, act }` | answer to obs (`tick` echoes it) |
| bot → game | `{ t: 'err', tick, msg }` | your code threw |
| game → bot | `{ t: 'end', result }` | the match is over |

`rules`: `{ tickDt, thinkEvery, obsR, tile, world, gearCosts, gearMax }`. `gearCosts[n - 1]` is
the gold that takes a piece from level `n` to `n + 1`; `gearMax` is the top level.

`map`: `{ world, tile, shape, grid }`. `grid` is the map when your seat was taken: `world`
strings, one per row, one character per tile (`grid[ty][tx]`):

| `#` | `~` | `-` | `=` | `,` | `.` |
| --- | --- | --- | --- | --- | --- |
| solid (tree, rock, wall) | open water | ice | road or bridge | ford | snow |

Trees fall and buildings rise after that: `obs.nodes` and `obs.structs` are the live word near you.

## The observation

```js
obs = {
  tick, time,              // sim tick; match seconds
  me: {
    id, team, cls,         // cls: 'HUNTER' | 'WARRIOR'
    x, y, vx, vy,
    hp, maxHp, dead, respawnT, eliminated,
    level, xp, gold, skillPts,
    prone, hide,           // hide 0..1: how buried under the snow
    aboard, falling, zip,  // on the eagle; in the drop; -1 or the cable ridden
    abilities: [{ key, id, lv, cd, ready, range }],  // keys 0..3; lv 0 = locked; range px or null
    gear: [lv, lv, lv, lv],                // helmet, chest, legs, boots: 1..rules.gearMax
    tool: { type, bits, lvl } | null,      // the weapon in hand and the bits loaded in it
    toolSel, tools: [type | null],
    bag: [{ type, n } | null],
    food: { berry, fish, ... },            // the pouch: meals and unopened cards
    charging, chargeT,     // the draw in progress
    nav,                   // your last goTo: 'ok' | 'arrived' | 'fail' | null
    lastCmd: { kind, tick, ok, why } | null,  // what came of your latest order
    atShop,                // standing at a merchant's counter
  },
  allies:   [{ id, x, y, hp, maxHp, cls, dead, respawnT, aboard, bot }],  // your whole side, always
  enemies:  [{ id, x, y, vx, vy, hp, maxHp, cls, prone }],                // rivals your side can see
  soldiers: [{ id, team, x, y, hp, maxHp }],      // wave soldiers near your side, both teams
  animals:  [{ id, kind, level, x, y, hp, maxHp }],   // near you: rabbit, deer, wolf, alpha, dire, bird
  eagles:   [{ team, x, y, state, hp, maxHp, hitT, mouth }],  // both birds, always
  structs:  [{ id, type, team, tx, ty, hp, maxHp, building }],  // buildings near you
  nodes:    [{ kind, tx, ty }],    // tree, deadTree, rock, bush, chest near you; nearest 64, nearest first
  drops:    [{ id, type, n, x, y }],   // loot on the ground near you
  shots:    [{ x, y, vx, vy, team }],  // shots in flight near you
  flags:    [{ owner, type, tx, ty }], // your side's order markers
  merchants: [{ team, x, y, stall }],  // both merchants, always; stall: { tx, ty } | null
  shop:     [{ sec, i, kind, id, price }] | null,  // the counter's stock, only while atShop
  kills:    [{ victim, team, by, cause, tick, out }], // the kill feed since your last think
  team:     [{ from, say }],           // what teammates said since your last think
}
```

- **"Near"** is `rules.obsR` px (384, 24 tiles: the minimap's reach). `enemies` and `soldiers`
  are near *anyone on your side*; the rest is near *you*.
- **Hidden rivals.** A rival buried past the point where it drops off the minimap is not listed,
  unless a falcon mark is on it. The game's own sight rule decides, the one every turret and wolf
  uses.
- **Birds.** `state` is `'fly' | 'dive' | 'down' | 'flee' | 'gone'`. A bird `'down'` is the
  objective: drive the rival one to `'flee'` and your side wins. `hp` is its nerve. `hitT` is
  seconds since it was last struck. `mouth` is where its spur meets the road: the way in.
- **Ids.** A player's id is its seat. Every other id is stable for the match on this machine;
  use it to name a target in `think` or to remember a thing across thinks.
- **Tiles to pixels:** the centre of tile `(tx, ty)` is `(tx * 16 + 8, ty * 16 + 8)`.
- **Abilities.** `id` is what the key is on your body: hunter `pierce`, `net`, `grap`, `snow`;
  warrior `shield`, `rush`, `stomp`, `exec`, or an alternate (`cry`, `whirl`, `ham`, `wind`).
  `range` is how far its aim reaches in px, `null` when it has none.
- **`lastCmd`.** `ok` is true when the order went through. When it did not, `why` names the
  reason where the game has one: `'gold'`, `'max'`, `'far'`, `'points'`, `'busy'`, `'bad'`, or
  a placement's `'blocked'`, `'ground'`, `'unit'`; `null` otherwise.
- **`kills`.** Every death on the map since your last think, as the feed shows it on every
  screen. `by` is the killer's seat, or -1 when no player did it. `out` is true when
  the victim's bird has fallen, so it will not come back.
- **Shopping.** Walk to a merchant or its stall until `me.atShop`; `shop` then lists what is on
  the shelf. Buy one with `cmd: { kind: 'shop', act: 'buy', sec, i }`.

## The act

```js
act = {
  // held
  move: [mx, my],          // stick, each -1..1
  goTo: { x, y, reach },   // walk there by the game's pathfinder; overrides move. reach 1
                           // stops beside a tile you cannot stand on (a tree, a bird).
                           // Unreachable: dropped, and me.nav says 'fail' next think
  aim: [x, y],             // the world point you want the crosshair on
  fire,                    // held: a bow draws while held and looses on release; a blade swings
  work,                    // E held: chop, pick, strike a rival building or bird under the aim
  slide, grapple,          // shift held; the grapple reels while held
  // edge (once)
  dodge, jump,             // roll; hop on/off a zipline, leap off the eagle
  eatBerry, eatFish, useCard,
  ability,                 // 0..3: cast that key (or buy its level when a skill point waits)
  cmd,                     // an order: see below
  // talk
  call,                    // a callout your side sees and hears: { kind, x, y, n } (below)
  say,                     // any JSON up to 256 bytes, to your teammates' next obs.team
  think,                   // what you are doing and why (below)
}
```

Anything missing from an act is neutral (not held, not pressed). Numbers are clamped, unknown
fields are dropped, and a malformed act is ignored, never fatal. The game checks every order
again on its side, exactly as it does a player's.

**Orders (`cmd`)**, the same ones the game's menus send for a player:

| `cmd` | what it does |
| --- | --- |
| `{ kind: 'ability', i }` | spend a skill point on key `i` |
| `{ kind: 'gear', piece }` | buy the next level of a gear piece (0 helmet, 1 chest, 2 legs, 3 boots) |
| `{ kind: 'build', tx, ty, id, rot }` | place a building |
| `{ kind: 'upgrade' \| 'repair' \| 'demolish', tx, ty }` | manage your side's building there (within 60 px) |
| `{ kind: 'flag', tx, ty, id }` | plant your side's order marker (`id: null` lifts it) |
| `{ kind: 'shop', act: 'buy', sec, i }` / `{ act: 'trade', good, dir }` / `{ act: 'sellAll' }` | at a merchant's counter |

## The team channel

`say` is the only way five copies of a file share anything. Whatever one seat says reaches
every scripted teammate's next `obs.team` as `{ from: seat, say }`. Rivals never hear it. See
`bots/pack.js`: one seat calls a focus target and a rally, the rest follow.

## Callouts

`call` puts a word on the map for your whole side, humans included, with a ping and a sound:

| `kind` | prints | `n` |
| --- | --- | --- |
| `'bird'` | BIRD! | |
| `'help'` | HELP! | |
| `'push'` | PUSH! | |
| `'low'` | HUNTER LOW! | `'HUNTER'`, `'WARRIOR'` or `'BEAR'` (required) |
| `'here'` | 3 HERE! | how many rivals, 1 to 5 |

`x, y` is the spot in px. A call goes through the same rules as the game's own bots: your side
holds only a few at once, the same call at the same spot is not repeated, and one seat calls at
most once every few seconds. A call those rules refuse is dropped. Your seat also makes the
game's automatic calls, as every bot does.

## Thoughts

```js
think: {
  goal: 'PUSH',            // one short word
  why: 'BIRD IS DOWN',     // up to 20 characters
  target: { kind: 'bird', id: 1, x, y },   // or null
  plan, role, mood,        // optional words, shown in the bot view
}
```

The game shows every bot's thought in the bot view (F4) and records it in match logs. Goals the
bot view colours: `DEFEND PUSH GUARD FIGHT FLEE HIDE EAT HUNT GATHER MINE LOOT BUILD ESCORT RALLY
ROAM WOLF`; any other word shows plain. Target kinds: `player`, `soldier`, `bird` (id = team),
`animal`, `object`, `drop`, `point`.

## Hands

Every scripted seat aims with the same hands: the crosshair swings toward your `aim` at a fixed
speed with a small wobble, about as well as the game's HARD bots (`skillHands`, which arrives
with the difficulty work; until it does, the crosshair lands exactly on `aim`). `aim` is where
you *want* to aim; lead a moving target yourself.

## Versioning

`hello.api` is 1. A new field may appear at any time; a field is never renamed or removed without
the number going up.
