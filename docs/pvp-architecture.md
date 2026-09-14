# Online PvP architecture

Steam lobbies for matchmaking, one player as **host** running the authoritative simulation,
every other player a **client** that sends input and renders what the host says. Transport is
`ISteamNetworkingSockets` peer-to-peer over Steam Datagram Relay, reached from a Windows wrapper
through steamworks.js. No dedicated servers, no host migration at launch.

This is the design pass only. Nothing here is code yet, and the deep docs under `docs/dev/`
still describe the single-player game as it stands. Read [game.md](dev/game.md) and
[multiplayer.md](dev/multiplayer.md) first: the ten-player `Player` array, the input struct and the
bot brain are what make this plan short.

## What the code already gives us

- **Every combatant is a `Player`** in one array of `MAX_PLAYERS` (10), and every one of them
  steps through `updatePlayer(p, dt)` off its own `p.input`. A bot is `updateAI(p, dt)` writing
  that struct; a human is `sampleHumanInput(p, dt)` writing it. A network peer is a third writer.
- **The input struct is the whole controller-to-sim interface** (`makeInput()`): two axes, an aim
  point, five held flags, four edge-triggered flags, an ability index and a one-shot `cmd`. It
  is small, flat and already the only way a player acts on the world.
- **The world is a function of `SEED`.** `genWorld`, the road, the camps, the chests, the wildlife
  and the shoal all derive from it. A client can build the whole static map from a 32-bit number.
- **Contested orders resolve from `(SEED, id, state.tick)`** through `contest()`. Only the host
  will run them, so the property becomes a free extra rather than a requirement.
- **A sim file does not draw.** `render()` and `renderUI()` read the singletons (`players`,
  `arrows`, `structures`, `state`) and never call into the step, so a client that writes a
  snapshot into those singletons renders it with the draw code untouched.

## What the code does not give us

- **The step was variable** until PATCH 3.42: `loop()` handed `update()` the real frame `dt`,
  clamped to 50 ms, with no accumulator, so `state.tick` only counted calls. It is fixed at
  `TICK_DT` (1/60 s) now, which is what lets an input be stamped with the tick it belongs to and
  a snapshot with the tick it shows. What is still owed is render interpolation between steps.
- **Player 0 is the local human, by construction.** `initPlayers` makes it so, `player`/`inv`
  alias it, `beginDrop` seats it on the red bird, `applyCharacter` dresses it from the profile,
  `skin()` reads its team, and `gainGold` feeds the profile's stats through it.
- **Effects and sounds fire inside the sim.** `SFX.*`, `burst`, floaters and `state.shake`
  are called from actions.js, abilities.js, player.js, structures.js, robots.js and wildlife.js
  at the moment the thing happens. A client does not run those moments, so it has to be told.
- **The loop is rAF.** A background window is throttled to about 1 Hz, which is fine for one
  player and fatal for a host with nine.
- **There is no wrapper.** README promises Steam; nothing in the repo runs outside a browser.

## Module boundaries

Five new files under `js/net/`, loaded after `sim.js` and before `boot.js`, in the same flat
shared scope as everything else. Nothing under `js/` imports a Steam symbol. The game keeps
working from `file://` because with no bridge present the only transport is the loopback.

| File | Owns | Talks to |
| --- | --- | --- |
| `js/net/net.js` | `NET`: the role (`solo` / `host` / `client`), the peer table, the tick clock, `netHostStep()`, `netClientStep()`, the seam `updatePlay` calls | sim.js, boot.js |
| `js/net/schema.js` | the message table, the field lists a snapshot carries, the quantizers, `encode`/`decode` for every message, `SCHEMA_VER` | net.js only |
| `js/net/snapshot.js` | building a snapshot on the host (`snapPlayer`, `snapArrows`, delta against last ack), applying one on the client (`applySnapshot` writes the singletons), interpolation buffer, the full sync | net.js, the singletons |
| `js/net/events.js` | the event ring: `netEvent(kind, ...)` is what a sim file calls where it used to call `SFX.hit()` directly; on the host it both plays the cue and queues the event, on a client `playEvent` does the local cosmetics | actions.js, abilities.js, player.js, structures.js, robots.js, wildlife.js |
| `js/net/transport-loopback.js` | the solo transport: `send` is a no-op, `poll` returns nothing | net.js |
| `js/net/transport-steam.js` | the Steam transport: wraps `window.steamBridge` (lobby calls, `sendMessageToUser`, `receiveMessagesOnChannel`) behind the same five-call interface | the wrapper's preload |

The transport interface, the only thing the two adapters share:

```
connect(hostId)          client: open a P2P session to the host's SteamID
listen()                 host: accept sessions
send(peer, bytes, flags) flags: RELIABLE | UNRELIABLE_NO_NAGLE
poll() -> [{peer, bytes}]
close(peer)
```

**Order of transports, revised 2026-09-14 (Noah's ruling)**: the relay first, for browser and
wrapper alike - it is the server Noah hosts - and Steam later behind a flag. The wrapper below
stays as written; it just does not lead.

**The wrapper** (a new top-level `desktop/` folder, Electron): the main process holds
steamworks.js, the `BrowserWindow` loads `index.html` with `backgroundThrottling: false`, and a
preload exposes `window.steamBridge` with the lobby and messaging calls plus the local SteamID and
persona name. The renderer never touches Node. The wrapper is a shell around the same
`index.html` a browser opens, so `node app/server.js` and double-click still run the game solo.

**The role is decided once, before `startGame`.** `solo` when there is no bridge or the player
picked the offline plank; `host` when the local player created the lobby; `client` when they
joined one. `NET.role === 'solo'` behaves as a host with no peers, and every guard reads
`NET.isHost` (true for solo and host) or `NET.isClient`.

### The sim seam

`updatePlay` today:

```
tick++
for p: if ai -> updateAI; updatePlayer
resolveContests; updateMarket; updateAbilityWorld; updateDrop; arrows; drops; ...
```

After the change, host and solo:

```
netHostStep():  for each remote p: p.input <- newest queued input for this tick (or held last)
tick++
for p: if ai -> updateAI; if remote -> (already written); updatePlayer
resolveContests ... (unchanged)
netHostFlush(): every fourth tick build + send snapshot; flush the event ring; ack inputs
```

Client:

```
netClientStep(): send this tick's input (with the two before it)
                 drain incoming: snapshots into the interpolation buffer, events into playEvent
                 applyInterpolated(renderTime) -> writes players/arrows/drops/structures/robots/animals/fish/eagles/market/state clock
                 (no updatePlayer, no updateAI, no resolveContests, no world subsystem updates)
cosmetics only:  particles, floaters, footprints, snow, camera, shake, fx aging, HUD clocks
```

The fixed step lives in `loop()`: an accumulator hands `update(TICK_DT)` zero or more times per
frame, capped at a few steps to stop a stall spiralling, and `render()` runs once with the
fraction left over for the interpolation. `TICK_DT = 1 / 60` - **landed in PATCH 3.42**, at 60
rather than the 30 first proposed, because `TOOL_ROF_STEP` already counts rate of fire in 1/60
steps and every integrator was tuned there, so the refactor changed no feel; a coarser network
tick is a snapshot cadence, not a sim one. Practice and the title step the same way, so there is
one loop, not two.

## Authority, in one table

| Thing | Owner | Reaches a client as |
| --- | --- | --- |
| player position, velocity, facing, hp, level, xp, gold, bag, food, gear, cards, cooldowns, status timers, prone, aboard/drop | host | snapshot fields |
| arrows, drops, robots, animals, fish, camp monsters, the two eagles, structures and their hp/tier | host | snapshot lists (structures and eagles keyed by id, delta only) |
| `ground` / `objects` mutations, a build, a demolish, a felled tree, a hole opening | host | reliable event, plus a periodic 32-bit hash of both arrays for drift |
| market prices, stock, restock road | host | snapshot block at 1 Hz, trades as events |
| `state.time` / `day` / `tick` / `darkness` / wind | host | every snapshot carries `tick` and `time`; clients derive darkness and wind from them as they do now |
| deaths, kills, respawn timers, the end of the match | host | reliable event (`die`, `respawn`, `end`) |
| a hit landing, a swing, a cast, a shop trade, a market notice, a roost alarm | host | event; the client plays the fx and cue |
| particles, floaters, footprints, snow, camera, shake, cursor, HUD, tooltips, minimap, audio | each machine | never on the wire |
| profile stats (`addGold`, `addKill`, `addWin`...) | the owning client | events applied to `PROFILE` by the machine that owns the character |
| the local player's walk | client, **pass 2 only** | predicted then reconciled |

**Prediction is deliberately zero at launch.** The clients render the world about 100 ms in the
past and interpolate. The game is momentum walking, 1.5 s meals and a bow you draw; it is not a
twitch shooter, and a mispredicted roll that un-hits is a worse feel than a short delay on the
walk. If the walk feels sluggish under real SDR latency, pass 2 predicts **only the movement
banner** for the local player: it is a pure function of the input, the position and the static
tile grid, so re-running it over the unacked inputs is cheap and exact. Nothing that touches
another unit, a contest or damage is ever predicted.

## The wire form (PATCH 3.49)

Cut from the reflection snapshot, not written beside it, in three layers, each proven in the
page before it went between tabs:

- **Stable ids and field deltas.** Every moving entity carries a network id for its life
  (`snapNid`); the host keeps a ring of what it packed at each flush tick and sends each client
  only the fields touched since the tick that client acked (a nested field by its JSON), the
  arrays' order when it moved, the ids that left, tiles and ground where they changed, each
  singleton field by field (ack-keyed since PATCH 3.51, below). A client updates its
  entities **in place** under those ids, so a reference resolved a tick ago still points at the
  thing - which is also why a tile changes in place, and why a player's aliased plain objects
  (`inv`, `food`, `kit`, `flag`, `spawn`, `look`) are merged rather than replaced.
- **Bytes with a dictionary.** The whole message is binary: every object key an index into a
  dictionary both ends grow in step (a message leads with the names it is the first to use, the
  header carries every name from the index the client's acked message left the list at, written
  by position), numbers as the smallest integer that holds them
  or a float32 - a position or a velocity as an int16 count of eighths of a px (below) - tile
  indices as numbers. The relay forwards binary frames untouched but for a
  routing header.
- **15 Hz and interpolation.** `SNAP_EVERY` is 4; a client eases every body a delta moved from
  where it is drawn to where the host put it over one interval, and snaps instead of easing past
  `LERP_SNAP` (a teleport). The local player is eased like the rest: no prediction yet.
- **What the sim keeps to itself.** `SNAP_SKIP` names the bookkeeping that ticks every step and no
  draw pass reads (footstep and dust clocks, a bot's think timer, a fish's turn clock...); the
  echo harness runs without them, so a name added there is proven harmless or caught as pixels.

Measured on seed 42, a ten-body match with buildings: a delta averages **5.8 KB** at 15 Hz,
**87 KB/s per client** (down from 1.3 MB/s), ~6 ms of host time per delta, the full sync 1.9 MB of
bytes against 3.3 MB of JSON; 300 deltas applied back in the page with zero fields lost; between
two tabs the client checked itself against the host's full form every 5 s through a ride, a hop
and a walk with no disagreement. Two bugs the proofs caught on the way: a token merged into the
live object it named (a barracks gutted to two keys) - hence the merge allow-list - and a
delta that moved a body on one axis restarting its ease toward a stale target on the other.

**Quantized positions (PATCH 3.50).** `x`, `y`, `vx`, `vy`, `kbx`, `kby` cross as an int16 count of
eighths of a px (`Q16`, 3 bytes against a float32's 5) - by field NAME at encode time, so a
timer, hp, gold or anything the HUD prints as a number never does, and the host reads nothing
back (the sim keeps its floats; only the bytes to a client are coarse). An eighth because a
sprite lands at `Math.round(x - camera)`, so an error under half a px is invisible at rest,
and the sim's own sub-px nudges (`separateUnits`' pushes, a knockback decaying toward zero
for ever) fall below it - the shadow compare (`snapFieldDiff`) compares the quantized value,
so a body that has not moved on the wire is not resent, which is where most of the saving
is: at identical states the named fields carried per delta fell from 166 to 96. A position
is FLOORED (against a camera on the same grid, `round(floor8(x) - c) === round(x - c)`, so a
floored body cannot round to a different px), a velocity ROUNDED (it is only a heading on a
client, and flooring a knockback at 1e-100 would hand it -0.125 for good); past +/-4095 a
value falls through to the float32. The quantum is the wire's one designed loss, and the
proofs say so exactly: `snapCompare` tolerates one quantum on the named fields and nothing
else, and `netEcho` writes the wire's values into the world (`snapQuantize`) before its
reference frame, so the pixels it counts are what was lost BESIDES the quantum (left exact, a
merchant's axe drawn rotated toward its stump from a sub-px position moved one colour unit).
Measured on seed 42, strict A/B at identical states (two shadows, four minutes in, 150
deltas): **8212 -> 6842 bytes per delta**; along a run 20 s in, 5775 -> 4374; live between two
tabs a host sends **~85 -> 72 KB/s** to one client with the switch flipped in place. The
echo is 0 px with an empty mismatch list, 1500 ticks of deltas applied back with no mismatch,
a body at rest holds one exact position on the client, and the client's self-check ran null
through a ride, the hop and a 123 px walk. Found on the way: the self-check compared a body
moved on one axis where it was DRAWN on the other, not at that axis's ease target - fixed
per axis, which is what let a client that ate 300 queued deltas in one poll pass.

**The ack-keyed base (PATCH 3.51).** The shadow became a RING: `snapHistoryPush` packs the
world at every flush tick (`HIST_KEEP` = 75 entries, 5 s) and keeps, per entry, what that tick
touched - per entity the names that changed or left (whole for one new that tick), the ids
gone, whether the order moved, the same for the eagles and the singletons, each tile's touched
names (whole for one made or unmade), the ground cells, the structures' key - while the tile
shadow keeps only the newest form of every tile, so the ring holds no world per tick, only what
moved. A client acks the newest tick it applied on every input it sends; the host keeps that
per peer and cuts each peer's delta from the ring entry at ITS ack (`snapDeltaFrom`, peers on
one ack sharing the cut), a full sync going to a peer whose ack aged out of the ring
(`netHostFull`, which also sets the base to the tick it sends). **The cut is the UNION of the
entries after the base, not a compare of the two ends**: the ack is a round trip stale, so the
client may hold any tick between the base and now, and a field that flipped and flipped back
in between has to go again or the client keeps the flip - the first cut compared the ends, and
between two tabs a bot's `moving` flag that went false at 896 and true at 900, cut from 892,
was never sent. `d.base` names the base; a client refuses a delta whose base is newer than
what it holds (a resync follows) and ignores one no newer than what it holds, which is what an
unreliable channel needs and a reliable one never exercises. The key dictionary is ack-keyed
too: a message's header carries every name from the index the peer's acked message left the
list at, written by position on the far side, so a lost message loses no name and a repeat is
harmless; the full sync carries the list from 0 (the welcome no longer does). Proved with
`DBG.netLoss(f)`, which throws away that share of a host's snapshot sends before the
transport: between two tabs on seed 42 the client's self-check stayed null through the ride,
the hop and a 121 px walk at 30% loss (251 drops by then), a stretch at 70%, and a 7 s
blackout that outlived the ring and came back through the full sync; in the page,
`netDeltaRun(1200, 4, loss)` at 0.3 and 0.7 (bases up to 60 ticks back) with no mismatch. On
the relay the ack trails the send by a round trip, so a delta is a few fields fatter than
before (4.0-4.5 KB along a run 20 s in).

Still owed: the transport half of the unreliable channel (Steam's 1200-byte cap needs the
delta split into parts or slimmed further), and a per-kind field policy if ~70 KB/s is still
too much for nine clients on a home upload (~650 KB/s at ten players).

## Message schema

All messages are binary `ArrayBuffer`s over the transport, first byte the type, second the
`SCHEMA_VER`. Lobby-phase state rides Steam lobby data and lobby chat, not this channel.
`R` is reliable, `U` is unreliable no-Nagle.

| Type | Dir | Ch | Body |
| --- | --- | --- | --- |
| `HELLO` | c→h | R | `patch:u16` (PATCH_TXT ×100), `schema:u8`, `steamId:u64`, `name:str16`, `cls:u8`, `look:u8[6]` |
| `WELCOME` | h→c | R | `id:u8` (slot), `team:u8`, `seed:u32`, `tick:u32`, `time:f32`, `roster:[{id, team, control, name, cls, look}]×10`, `aiLevel:u8` |
| `REFUSE` | h→c | R | `why:u8` (VERSION / FULL / LATE / BANNED) |
| `FULLSYNC` | h→c | R, chunked | every snapshot field for every entity, `ground:u8[WORLD²]` (54 KB, deflated), `objects` as a sparse `(idx:u16, type:u8, extra)` list, structures, market, eagles. Sent once at join and once on reconnect |
| `INPUT` | c→h | U | `tick:u32`, then 3 × `{mx:i8, my:i8, aimX:u16, aimY:u16, flags:u8 (fire, work, slide, dodge, grapple, eatBerry, eatFish), ability:i8}` for ticks `t, t-1, t-2`; optional `cmd` appended as `{kind:u8, tx:u8, ty:u8, id:u8}` or `{kind:u8, piece:u8}` |
| `CMD` | c→h | R | a `cmd` that must not be lost even under loss: build, upgrade, demolish, gear, skill, shop. Carries `tick` and a `seq:u16`; the host de-duplicates by seq |
| `SNAP` | h→c | U | `tick:u32`, `time:f32`, `ackInput:u32`, `baseTick:u32` (the snapshot this is a delta from, 0 for full), then a bitmask-prefixed block per player, then arrows, drops, robots, animals, fish, eagles, each as `count` + entries |
| `ACK` | c→h | U | `snapTick:u32` — the newest snapshot applied, so the host can delta from it |
| `EVENT` | h→c | R | `tick:u32`, then a list of `{kind:u8, ...}` (table below) |
| `PING`/`PONG` | both | U | `t:u32` ms; the client uses the RTT to size its interpolation delay |
| `LEAVE` | both | R | `why:u8` |
| `HASH` | h→c | U | `tick:u32`, `ground:u32`, `objects:u32`; a client that disagrees twice in a row requests `FULLSYNC` |

### The per-player snapshot block

A bitmask says which groups changed since `baseTick`; unchanged groups are omitted.

| Group | Fields | Bytes |
| --- | --- | --- |
| pose | `x, y` (u16, 1/8 px), `vx, vy` (i8, 1/4 px/s), `dir` (u8), `moving, sliding, prone, dead, aboard` flags | 7 |
| vitals | `hp, maxHp` (u16), `level` (u8), `xp` (u16), `gold` (u32), `kills` (u8) | 12 |
| clocks | `swingT, swingCd, nockT, chargeT, dodgeT, eatT, castT, respawnT, hurtT, invuln` as u8 in 10 ms | 10 |
| status | `stunT, rootT, slowT, netT, markT, igniteT, shieldT, buffT, hide` as u8 | 9 |
| charges | `dodgeCharges, skillPts, abCd[4]` (u16 each), `abLv[4]` (u8) | 14 |
| held | current slot index, the tool instance in hand (type + bits, so the drawn body is right) | ~6 |
| bag | the full bag and pouch, only sent to **that** player's client and only on change | ~40 |
| meta | `cls, look, control, team, eliminated, flag` | rare, ~10 |

Ten players at 15 Hz with pose every snapshot and the rest on change is well under 1 KB per
snapshot. Arrows are `{id:u16, x, y, vx, vy, type:u8, owner:u8}`; a client that has not seen an
arrow's id spawns it, one it stops seeing is removed. Drops, robots, animals and fish follow the
same id-keyed pattern. Structures are keyed by tile index and only ship on change.

### Events

Two layers. **Cosmetics** are captured generically (PATCH 3.44, js/net/events.js): the ring
carries `burst`, `float`, `dmg`, `sfx` (cue at a place with a radius), `sfxp` (cue for a
player id), `sfxo` (owner cue / bystander cue), `shake` and `shakep` entries, recorded inside
the step on the host and replayed by `evPlay` on a client against *its* player. Nothing below
needs a cosmetic payload. **Semantic events** are the ones in this table: each changes client
state (a tile, a feed line, an overlay, a profile stat) and rides the reliable channel with
the snapshot.

| kind | payload | client cosmetics |
| --- | --- | --- |
| `hit` | target unit ref, dmg, nx, ny, dmgType, crit | flash, floater, knock puff, `SFX.hit`/`bigHurt`, shake if local |
| `swing` | player id, tool type | swing arc fx, `SFX.axe`/`pick` |
| `loose` | player id, pow | `SFX.loose` |
| `cast` | player id, ability id, aim | telegraph shapes, cue |
| `die` | player id, killer id, cause | death fx, feed line, `SFX.die`; the local client opens the death overlay |
| `respawn` | player id | landing fx |
| `struct` | tile, type, tier, op (build/upgrade/wreck/demolish) | `repaintGround` if needed, `SFX.build`/`wreck` |
| `ground` | tile, new type | `repaintGround` |
| `obj` | tile, type or null, extra | felled tree, opened chest, hole |
| `drop` | drop id, x, y, type, n, item | spawn animation, `SFX.drop` |
| `pickup` | drop id, player id | magnet fx, `SFX.pickup` |
| `gold` | player id, n, x, y | gold floater; the owning client calls `PROFILE.addGold` |
| `trade` | player id, act, good, n, price | till fx; the counter refreshes |
| `notice` | kind, payload | `raiseNotice` |
| `eagle` | team, hp, hx, hy | burst, `bigHurt`/`alarm`, the roost plate |
| `end` | how, snapshot of the tally | `endMatch` on every client with the host's numbers |
| `stat` | player id, which, n | the owning client's `PROFILE.add*` |
| `sound` | cue id, x, y | any cue not covered above; gated by `nearPlayer` locally |

## The lobby lifecycle

Everything before the first tick rides Steam's lobby system. The match itself rides P2P.

1. **The LOBBY plank.** On the title, beside PLAY, when `window.steamBridge` exists. It opens a
   panel with CREATE, a public lobby list (`requestLobbyList`, filtered to this patch, with a
   JOIN plank per row that reads as its player count and team colours), a friend's invite via
   the overlay, and the class row the current class-select already draws.
2. **Create.** Host calls `createLobby(PUBLIC or FRIENDS_ONLY, 10)`. Lobby data set by the host: `patch`,
   `schema`, `seed` (rolled now, so every joiner can pre-generate the world while waiting),
   `aiLevel`, `state = 'open'`. The host's own `HELLO` fields go into lobby member data.
3. **Join.** A joiner calls `joinLobby(id)`. Steam refuses a full lobby. On entering, the client
   checks `patch` and `schema` against its own and leaves with a version plate if they differ,
   otherwise it publishes its member data (name, class, look) and starts `genWorld` off the
   lobby's seed in the background.
4. **Waiting room.** The class-select lobby screen, drawn for ten slots: humans from member
   data, the rest as bots. Team assignment is the host's: alternate by join order, humans first
   on both sides, and a SWAP arrow on the host's screen. Team choice is member data written by
   the host; clients read it. Ready is a member-data flag.
5. **Start.** The host sets `state = 'starting'`, which locks joins, and starts the existing
   five-second PLAY count on every screen. Each client opens a P2P session to the host's
   identity (SDR handles the relay) and sends `HELLO`. The host answers `WELCOME` with the final
   roster, slot ids and teams, then `FULLSYNC` (cheap at tick 0: nothing has moved), then its
   first `SNAP`. A client whose session is not up by the end of the count is refused with
   `LATE` and the slot becomes a bot.
6. **Tick 0.** The host calls `initPlayers` with the roster instead of the defaults, then
   `beginDrop`. `beginDrop` seats players by slot, not by `p === player`. Every client has
   already run `initPlayers` from the `WELCOME` roster, set `player = players[myId]`, and
   applies the first snapshot; the eagle ride is fully authoritative, so the ride and the jump
   window arrive as snapshot state (`aboard`, `dropT`, eagle position) like everything else.
7. **In match.** The lobby stays alive with `state = 'live'` so a dropped client can find the
   host again. Steam's lobby member list is how the host notices a peer that vanished without a
   `LEAVE`.
8. **End.** `end` event; every client shows the ceremony with the host's tally. The lobby
   returns to `open` and the same room can start again with the same roster.

### Joins, leaves, reconnects

- **A client drops.** The host holds the slot for `RECONNECT_GRACE` (60 s), flips the body to
  `control: 'ai'` so the side keeps its number, and remembers the SteamID. A `HELLO` from that
  id inside the grace lands back in the slot: `WELCOME` with the same id, `FULLSYNC`, and the
  body returns to `remote`. Past the grace the slot is a bot for the rest of the match.
- **A mid-match join** is a `HELLO` from a new SteamID while `state = 'live'`. Accepted only
  into an `ai` slot on the smaller team (or either at equal size), and only while
  `state.elapsed` is under `LATE_JOIN_T` (5 minutes past the drop). The joiner gets the full
  sync and respawns at their bird through the ordinary respawn path. Refused with `LATE` after.
- **The host quits or vanishes.** No migration at launch. Clients that lose the host session
  for `HOST_LOST_T` (10 s) end locally with a `HOST LEFT` plate: no win, no loss, no stat
  writes. The lobby closes. Host migration is the first thing players will ask for and the
  hardest thing on this page; it needs every client to hold enough state to become the host,
  and a deterministic successor pick. It is scoped out on purpose and listed under risks.
- **Kick.** Host only, from the waiting room. In match, a peer is only ever dropped by Steam.

## Migration plan

Each step is a PR on its own, each keeps solo play identical, and each is verifiable with the
existing seed-42 fingerprint and headless staging before any Steam code exists. Steps 1 through 4
are pure refactors of the single-player game and are worth doing whatever happens to the
networking.

1. **Fixed step - DONE (PATCH 3.42).** Accumulator in `loop()`, `TICK_DT = 1/60`, `update(TICK_DT)` zero or more
   times per frame, `render()` once (the leftover fraction is banked, not yet interpolated). The world's clocks and the
   day cycle come out identical at the same wall time; gameplay feel is re-checked by hand since
   the momentum integrator has only ever seen 16 ms steps. Move the host tick off rAF onto a
   timer so an unfocused window keeps stepping. `DBG.step` already steps by `1/60`; it moves to
   `TICK_DT`.
2. **Unpin player 0 - DONE (PATCH 3.43).** `initPlayers(roster, local)` takes a roster (default:
   the one it builds today) and the local slot; `player = players[localId]`; `beginDrop` seats
   in slot order; `applyCharacter(p?)` takes a target; `skin()` reads `player.team` and was
   already correct for any local id, as were the team rail and the maps. `?local=N` and
   `DBG.setLocal(N)` seat the local player elsewhere for a check. What is still owed for a
   lobby is a `remote` control kind: the human-only branches (`autoFitTools`, a human's flag
   read by the whole side, the eagle's forced drop) test `control === 'human'` today.
3. **Events out of the sim - DONE (PATCH 3.44), as cosmetic capture rather than a named table.**
   Every cue, shake, puff and floater the step raises goes through js/net/events.js: `sfxAt`,
   `sfxFor`, `sfxOwn`, `shakeAt`, `shakeFor` carry the where and the who instead of the
   local answer, and `burst`/`addFloater`/`addDmgFloater` record themselves. Recording is on
   only inside `updatePlay` (`evInStep`) and only with `evRecord` set, so solo is untouched and
   nothing the HUD raises for itself is ever recorded. `evPlay` replays one entry on a client.
   The semantic events in the table above (a build, a ground change, a death, the end, the
   roost alarm with its plate, the market's) are state, not cosmetics, and land with the
   snapshot in step 4. `Math.random` in the fire colour moved to `fxRng`. Two wrinkles for
   step 4: a floater that carries a team's paint records the host's `skin()` colour, so the
   client will want the team instead; and `burst` draws off the sim's `rng`, which a client
   replaying it does too. Measured on seed 42: 20 s of a ten-bot match records about 50 entries a second, and 44% of them are footsteps (`sfxFor(p, 'step')` for every walking body), the obvious first thing to derive from snapshot motion on the client instead of shipping.
4. **Loopback harness - DONE (PATCH 3.45).** `NET` (js/net/net.js) with the loopback
   transport, and the snapshot (js/net/snapshot.js) built **by reflection** rather than a field
   table: every own property of every entity, refs as kind+index tokens, `input`/`ai`/`nav`
   skipped, the road registry a section of its own so an eagle's spur keeps its identity.
   `netEcho()` renders the world frame, snapshots, blanks every singleton, applies and
   renders again; the pixels that differ are the schema's misses, and a field-level audit
   names them. Measured on seed 42 over a 90 s match through the drop with buildings, bots
   and drops: 90 echoes, **0 pixels off in every one**, 0 fields lost, ~150 ms per echo. The
   JSON weighs 3.3 MB, of which 3.15 MB is the static `objects` array - so the wire form
   ships tiles only as mutation events over the seed-generated baseline, and the per-tick
   body is the remaining ~140 KB before quantization (players 23 KB, animals 27 KB, robots
   2-48 KB, fish 6 KB, ground 72 KB once). The quantizers and the delta are step 5's, cut
   from this correct form rather than written beside it. Two harness lessons: `render()`
   rolls the screen shake and animates a few things off the wall clock, so the harness pins
   both; and the eagle's `spur`/`pad`/`lane` carry clocks that advance after the crash,
   which a first draft skipped and the echo caught as a 24-pixel drift at the roost.
5. **Two browsers, one machine - DONE (PATCH 3.46), first cut.** `js/net/transport-ws.js` over
   a relay in `app/server.js` (hand-rolled WebSocket server, no dependency); the protocol in
   `js/net/net.js`: HELLO/WELCOME/FULL/SNAP/IN/REFUSE as JSON, a `remote` control kind on the
   host, the client never stepping and deriving its screen from its own body
   (`netClientMode`), the leap off the eagle made an input (`input.jump`) because a key handler
   that called `dropJump` directly did nothing on a client, and a worker-driven `loop()` while
   a tab is hidden (risk 3). Verified between two tabs on seed 42: the client joins the smaller
   side's first AI slot, rides its bird, a key press hops it off through the host, it walks
   87 px with the camera following and the host's particles and floaters arriving, dies into
   the death overlay and respawns, rejoins its own slot after a reload, and a third tab late-
   joins into slot 2. **The wire is fat**: 30 Hz snapshots of ~80 KB JSON, ~1.3 MB/s per
   client, 3.3 MB for the full sync - correct, not sendable over Steam. What this step leaves
   for the next: the quantized binary form and the delta against the acked snapshot, the
   objects diff already done (tiles and ground ship only where they changed), interpolation
   on the client (30 Hz motion with none), and the cosmetics' footsteps derived locally.
6. **The wrapper - DONE (PATCH 3.47), unverified against a running Steam.** `desktop/` with
   Electron 33 and steamworks.js 0.4, `main.js` answering the bridge's IPC and pumping packets,
   `preload.js` exposing `window.steamBridge` and nothing else of Node, and
   `js/net/transport-steam.js` speaking it behind the same five calls: the host creates a
   public lobby on the dev App ID (480) and writes patch, seed and state into its data; a
   joiner reads the seed and reloads itself onto it; chat updates become peer/gone; packets
   over `STEAM_CHUNK` go as parts. Verified: Electron boots the game from disk with the
   bridge present and Steam absent, and plays solo. **Not verified**: a lobby round trip -
   Steam was not running on the machine this was written on. **Deviation from the plan**:
   steamworks.js 0.4 exposes Steam's older `ISteamNetworking` P2P sockets, not
   `ISteamNetworkingSockets`; they relay through Steam's network all the same, but a
   reliable packet is capped at 1 MB (hence the parts) and an unreliable one at 1200 bytes,
   which makes the quantized wire form a precondition for the unreliable channel rather than
   an optimisation.
7. **Lobby screens - DONE (PATCH 3.48), on the relay first.** Noah's ruling (2026-09-14): the
   relay is the product's server - a browser at a served address, the wrapper at file:// and one
   machine playing itself in two windows all reach the relay Noah hosts with the port forwarded
   - and Steam waits behind a flag (`?transport=steam`, `--transport=steam`), the same three
   doors (`netHost`/`netJoin`/`netLeave`) on either. The MULTIPLAYER plank thawed: the rooms
   screen lists the relay's open rooms as planks under HOST (a host's name, ten pips lit per
   person in their side's paint, another patch dimmed); joining reloads the page onto the room's
   seed; the waiting room is the class-select screen minus PLAY, the notches and the swap for
   guests, with the host's count on every screen. The DOWNLOAD tag on the title opens the newest
   Release, which every `v*` tag builds (desktop/build.js, .github/workflows/desktop.yml: a
   153 MB portable zip, music included). Still owed here: the `HOST LEFT` end state as a plate
   (a guest's transport reports it, the screen does not yet), a version plate on the door.
8. **Pass 2 (only if needed): walk prediction** for the local player over the unacked inputs,
   with a snap threshold and a smooth pull-in. **Interpolation landed in 3.49** with the wire
   form (above); prediction stays deferred.

## Risks

Ranked by how likely each is to bite and how expensive it is when it does.

1. **The fixed step changes the game's feel.** Every integrator, cooldown and animation was
   tuned under 16 ms frames. Landing the step at 1/60 sidestepped this for the sim itself; the
   cost that remains is presentation: a screen above 60 Hz now repeats a sim state on the
   frames between steps, and a heavy stall plays a moment of slow motion instead of a jump.
   Render interpolation, which the client's snapshot buffer needs anyway, removes the first.
2. **The snapshot schema is never quite complete.** The render pass and the HUD read dozens of
   fields, and any one the snapshot omits renders stale on a client: a bow drawn that never
   looses, a stun star that never clears. Mitigation: the loopback echo harness in step 4 is a
   diff, not a play test, and the schema is versioned so a client and a host never disagree
   silently.
3. **Background throttling on the host.** Alt-tab and the whole lobby freezes. Mitigation:
   host tick on a timer, `backgroundThrottling: false` in the wrapper, and a visible plate on
   the clients when snapshots stop arriving so the failure is legible rather than a rubber band.
4. **Edge-triggered inputs under loss.** `dodge`, `ability`, `eatFish` and `cmd` are one-tick
   pulses. A lost datagram eats a dodge in a fight. Mitigation: three ticks per `INPUT`, a host
   that consumes each tick's struct exactly once, and `CMD` on the reliable channel for anything
   with a cost.
5. **Host advantage and trust.** The host sees zero latency and can, in principle, edit
   anything. For a friends-lobby game this is accepted and stated; the host also gets the
   `aiLevel` and the seed. Mitigation: input clamps on the host so a hacked client cannot walk
   at 10× speed, and nothing else.
6. **Steam Datagram Relay latency is real.** Two players on the same continent see 30 to 80 ms
   RTT through a relay; across an ocean it is 150+. With zero prediction the walk lags by that
   plus a snapshot interval. Mitigation: the interpolation delay is sized from the measured
   RTT, and step 8 exists.
7. **Profile stats and gold attribution.** `gainGold` is the XP source and calls
   `PROFILE.addGold` on the machine it runs on, which is the host for everyone. Mitigation: the
   `gold` and `stat` events, and a rule that the host never writes another SteamID's profile.
8. **Two ways to run the same page.** Electron and `file://` must both work forever. Every Steam
   call goes through one bridge object with an `if (!window.steamBridge)` at exactly one place,
   the role pick. A stray reference elsewhere is a broken double-click.
9. **Binary encoding in JavaScript.** Hand-written `DataView` packing is fiddly and the bugs are
   silent misalignments. Mitigation: the schema is a table in `schema.js` and encode/decode are
   generated from the same table, never written twice.
10. **World drift.** A client whose `ground`/`objects` disagree with the host walks through a
    wall that is not there. Mitigation: mutations are reliable events, the `HASH` check runs
    every second, and a mismatch pulls a full sync rather than guessing.
11. **Host migration will be demanded.** A host with a bad connection takes nine people down.
    It is out of scope here because it needs every client to hold a complete authoritative
    state and to agree on a successor; the snapshot schema being complete (risk 2) is the
    precondition, so getting that right first keeps the door open.
12. **Chunking the full sync.** `FULLSYNC` with the 54 KB ground array exceeds a single
    message's comfortable size; it is deflated and chunked over the reliable channel, and a
    client that joins mid-match spends a second or two on a plate while it lands. Steam's
    reliable channel handles the ordering; our code handles the reassembly and the timeout.

## Open decisions

Things this pass does not settle and a later one must, with the current lean in italics.

- ~~Public lobbies or invite-only at launch.~~ **Decided: public lobbies ship.** The list is a
  lobby-data filter on `patch` and `state = 'open'`, and the room's own kind is the host's choice
  at CREATE. The UI cost is one list screen.
- Whether the host may play as a client of its own sim through the same code path, or is
  special-cased to write `p.input` directly. *Same path with the loopback transport, so the
  host's own latency is one tick and its code is the client's code.*
- Where the `?seed=N` and `DBG` harness sit in a networked match. *Host only; a client's DBG
  writes to singletons are overwritten by the next snapshot, which is correct.*
- Whether `PATCH_TXT` alone is the version handshake or a content hash of `js/` is added.
  *`PATCH_TXT` plus `SCHEMA_VER`; a content hash is cheap to add later.*
