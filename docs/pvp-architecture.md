# Online PvP architecture

One player is the **host** and runs the authoritative simulation; every other player is a
**client** that sends its input and renders what the host says. Two transports carry the same
protocol behind one five-call interface: a WebSocket **relay** (`app/server.js`, the server Noah
hosts) for browser and wrapper alike, and **Steam lobbies** with Steam's P2P packets from the
Electron wrapper (`desktop/`), the wrapper's default whenever Steam is up. No dedicated servers, no host migration.

This file is the reference for the wire: the code under `js/net/`, the relay and the wrapper cite
it by path. Read [game.md](dev/game.md) and [multiplayer.md](dev/multiplayer.md) first: the
ten-player `Player` array, the input struct and the bot brain are what keep the net code short.

## Status

- **Ships:** relay rooms (host a room, a public list, join by code, the waiting room, late join,
  rejoin into your own slot), the host-authoritative sim with snapshot clients (full sync + ack-keyed
  binary deltas at 15 Hz, eased on the client, the client's own walk predicted), the cosmetic event ring, the
  HOST LEFT ending, and the wrapper with Steam lobbies listed through the same rooms screen.
- **Unverified:** nothing on the Steam path (lobby round trip, P2P packets, the unreliable
  channel's frames) has run against a live Steam - only in Node against a fake bridge and as a
  headless wrapper boot. The first live test should watch `DBG.netStatus()`: `framesLost` on a
  client (the receiver counts a delta it gave up on) and `fulls` on the host.
- **Owed:** the host clamps nothing in a remote input; the roost alarm's notice plate (`raiseNotice`) and the own-bird alarm cue are raised on the host's screen only; a per-kind field policy if
  ~40-70 KB/s per client is too much for nine clients on a home upload.
- **Steam's host-left notice is code-read only**: a client turns the owner's leaving
  `LobbyChatUpdate` into `hostGone` (`wire`, js/net/transport-steam.js), never run against a live
  lobby - the first live test should have the host quit mid-match and mid-wait.

## What the game already gave the net code

- **Every combatant is a `Player`** in one array of `MAX_PLAYERS` (10), and every one of them
  steps through `updatePlayer(p, dt)` off its own `p.input`. A bot is `updateAI(p, dt)` writing
  that struct; a human is `sampleHumanInput(p, dt)` writing it. A network peer is a third writer.
- **The input struct is the whole controller-to-sim interface** (`makeInput()`): two axes, an aim
  point, five held flags, four edge-triggered flags, an ability index and a one-shot `cmd`. It
  is small, flat and already the only way a player acts on the world.
- **The world is a function of `SEED` and `MAP_TYPE`.** `genWorld`, the shape it grows
  ([map shapes](dev/world.md#map-shapes)), the paths, the road, the camps, the
  wildlife and the shoal all derive from the two. A client can build the whole static map from a
  32-bit number and a small index.
- **Contested orders resolve from `(SEED, id, state.tick)`** through `contest()`. Only the host
  runs them, so the property is a free extra rather than a requirement.
- **A sim file does not draw.** `render()` and `renderUI()` read the singletons (`players`,
  `arrows`, `structures`, `state`) and never call into the step, so a client that writes a
  snapshot into those singletons renders it with the draw code untouched.

## What had to change, and the constraint each left behind

- **The step is fixed.** `loop()` (js/app/boot.js) banks the frame's time and hands `update(TICK_DT)`
  zero or more times per frame (`TICK_DT = 1/60`, at most `TICK_MAX` steps), then `render()` once.
  It is 1/60 because the attack cycles were counted in 1/60 steps and every integrator was
  tuned there; a coarser network tick is a snapshot cadence (`SNAP_EVERY`), never a sim one.
  Practice and the title step the same way. The leftover fraction is banked, and only the drop is
  drawn in between steps (`tweenIn`: the camera, both birds, riders and fallers, restored by
  `tweenOut` before anything else reads them); ground play draws each step as it is.
- **No slot is the local human by construction.** `initPlayers(roster, local)` takes the roster and
  the local slot, `player = players[localId]`, `beginDrop` seats by slot, `applyProfile()` dresses
  `player`, `skin()` reads `player.team`. `?local=N` and `DBG.setLocal(N)` seat the local player
  elsewhere for a check. A person on another screen is `control: 'remote'`, and everything that
  treats a person differently from a bot asks `isHuman(p)` (js/net/net.js), never the string.
- **Effects and sounds raised inside the step carry the where and the who** (js/net/events.js,
  below), because a client does not run those moments and has to be told.
- **A hidden host keeps stepping.** A hidden tab gets no animation frames, so while
  `document.hidden` the frames come from a worker's 16 ms clock (`watchHidden`, js/app/boot.js); the
  wrapper sets `backgroundThrottling: false`. Those frames step the sim and draw nothing
  (`loop()` skips `render()` while hidden, unless a director take is recording).

## Module boundaries

Five files under `js/net/`, in the same flat shared scope as everything else. Nothing under `js/`
imports a Steam symbol: the one Steam-facing object is `window.steamBridge`, read in
`netSteam()`/`steamTransport`/`steamRooms` and nowhere else. The game keeps working from `file://`
because with no role asked for the only transport is the loopback.

| File | Owns | Talks to |
| --- | --- | --- |
| `js/net/events.js` | the cosmetic ring: `sfxAt`/`sfxFor`/`sfxOwn`/`shakeAt`/`shakeFor` are what a sim file calls where it used to gate a cue on the local screen; `evPush` records (host, inside the step only), `evDrain` empties the ring into a snapshot message, `evPlay` replays one entry on a client | every sim file that raises a cue |
| `js/net/net.js` | `NET` (the role `solo`/`host`/`client`, the peer table, the parked slots, the dictionaries, the byte counters), `isHuman`, the loopback transport, `netSetup`, `netRelay`, the three doors `netHost`/`netJoin`/`netLeave`, the host side (`netHostStep`, `netHostHello`, `netHostFull`, `netHostLeave`, `netHostFlush`, `netHostRoom`, `netHostRoster`), the client side (`netClientStep`, `netClientWelcome`, `netClientApply`, `netClientApplyDelta`, `netClientLerp`, `netClientMode`) | sim.js, boot.js, ui/menu.js |
| `js/net/snapshot.js` | the snapshot by reflection (`pack`/`packEnt`/`snapBuild`, `snapApply`), network ids (`snapNid`), the ack-keyed ring and the delta (`snapHistoryPush`, `snapHistoryAt`, `snapDeltaFrom`, `snapApplyDelta`), the bytes (`snapEncode`/`snapDecode`, `encDict`, the `SNAP_QUANT` quantizer), the proofs (`netEcho`, `netEchoRun`, `netDeltaRun`, `snapCompare`) | net.js, the singletons |
| `js/net/transport-ws.js` | `wsTransport(relay, room)` over the relay in `app/server.js`, and `wsRooms`, the live room list | net.js, ui/menu.js |
| `js/net/transport-steam.js` | `steamTransport(lobbyId)` over `window.steamBridge` (`createLobby`, `joinLobby`, `leaveLobby`, `lobbies`, `setLobbyData`, `send`, `onPackets`, `onEvent`), and `steamRooms`, the lobby list in the relay list's shape | net.js, ui/menu.js, the wrapper's preload |

There is no schema file and no field table: the snapshot is built by reflection, so the "schema"
is `SNAP_SKIP`, `SNAP_STATE`, `SNAP_KINDS`, `SNAP_MERGE` and `SNAP_QUANT` in snapshot.js.

The transport interface, the only thing the adapters share (the loopback, in net.js, has no peers:
`send` drops, `poll` is empty):

```
connect()                    client: open a session to the host (the room or lobby was given to the constructor)
listen()                     host: accept sessions
send(peer, msg, lossy) -> bool   a host names the peer (or '*'), a client's go to 'host'; msg is a plain
                             object (JSON, reliable) or a Uint8Array (the wire form); lossy marks bytes a
                             transport MAY drop whole - a delta, never a full sync
poll(dt) -> [{ peer, msg } | { peer, bin }]
close()
```

A transport also carries `open` (the room or lobby is up and the host known), `error`, and on a
host `roomData(data)`, what the rooms list shows of this room. It raises the same notices on either
wire: `{t:'peer'}` / `{t:'gone'}` to a host as someone comes or goes, and on the relay
`{t:'closed'}` (a client's socket dropped; it redials every `WS_RETRY` s) and `{t:'hostGone'}`.

**Steam leads in the wrapper, the relay everywhere else (Noah's ruling, 2026-10-14; the relay led
from 2026-09-14).** A player's own machine runs no relay, so a Steam launch with the API up asks
for Steam's lobbies on its own (`desktop/main.js` adds `?transport=steam` unless given
`--transport=relay` or a `--relay=ADDR`). A browser at a served address and one machine playing
itself in two windows reach the relay (`netRelay()`: `?relay=ADDR` remembered in the settings,
else the address the page was served from, else `localhost:8471`). `netSteam()` is true only with
the bridge present AND `?transport=steam`; the same three doors open on either.

**The relay** (`app/server.js`, a hand-rolled WebSocket server, no dependency) never reads a match.
A room has one host and any number of clients: `/ws?role=host` (the greeting `{t:'relay', id,
role, room}` carries the new four-letter code), `/ws?role=host&room=CODE`, `/ws?role=client&room=CODE`
(`{t:'refuse', why:'NOROOM'}` if there is none; `FULL` past `ROOM_MAX` rooms), `/ws?role=list`
(pushed `{t:'rooms', rooms}` now and on every change). A client's text frame reaches the host
tagged `peer`; a host's carries `to` (a client id or `'*'`). A binary frame from a host leads with
a 4-byte peer id (`0xFFFFFFFF` for everyone), stripped on the way; a client's arrives at the host
with its id in front. A host publishes its list entry with `{t:'room', data}`.

**The wrapper** (`desktop/`, Electron + steamworks.js): `main.js` holds Steam, answers the bridge's
IPC (`steam:*`) and pumps packets and lobby events to the page every 8 ms; `preload.js` exposes
`window.steamBridge` and nothing else of Node. It loads the same `index.html` a browser opens, so
`node app/server.js` and a double-click still run the game solo; with Steam absent the bridge
reports `ready: false` and the page plays solo. The App ID is the environment's `SteamAppId`, else
`desktop/steam_appid.txt` (Softfall's, 5244550), else 480.

**The role is decided by `netSetup(role, transport)`**: at boot from `?net=host|client` with
`&room=CODE` or `&lobby=ID`, or from the rooms screen through `netHost()`/`netJoin(code)`;
`netLeave()` returns to solo. `solo` is a host with no peers, and every guard reads `NET.isHost`
(true for solo and host) or `NET.isClient`, never the role string.

### The sim seam

In `update()` (js/sim/sim.js), host and solo, while the match is in `play`/`dead`/`drop` and unpaused
(a host with peers is never paused: `netShared`, js/net/net.js, keeps the step running under its
settings panel, and its pause key does nothing):

```
sampleHumanInput(player)
netHostStep(dt):  drain the transport - hello -> a slot, gone -> a bot, resync -> a full sync,
                  in -> that peer's queue; then ONE queued input per peer goes into its body's
                  p.input (held fields overwrite; the edges dodge, jump, useItem,
                  ability and cmd latch until the sim consumes them). An empty queue holds the last
                  input; past IN_QMAX, or never under two for IN_QWIN steps, the oldest folds into
                  the next (netInEdges keeps its edges)
evInStep = true;  updatePlay(dt);  evInStep = false     (the step, unchanged)
netHostFlush():   every SNAP_EVERY ticks: push the ring, cut each peer's delta from its ack,
                  attach the drained cosmetics and `ia` (the newest of that peer's inputs stepped),
                  send lossy; a peer whose ack aged out gets a full sync. The ticks between scan
                  their share of the tiles (snapTileScan), so the flush tick does not scan them all
```

At the title a host runs `netHostStep` alone, so a peer can knock before the match starts.

Client, in every mode:

```
sampleHumanInput(player)          (not at the title)
netClientStep(dt): send {t:'in'} - this tick's input and the ack - step our own walk on it
                   (netPredictStep), then clear the edges
                   netClientLerp(): ease every moved body toward the host's position (ours only
                   while it is not walking ahead)
                   drain the transport: full -> snapApply, snap -> snapApplyDelta + evPlay per event,
                   each wrapped in netPredictRestore / netPredictMend (below),
                   welcome / roster / count / refuse / closed / hostGone
                   after each apply, netClientMode(): which screen this state calls for, read off the local body
(no updatePlay: no updatePlayer, no updateAI, no resolveContests, no world subsystem)
```

## Authority, in one table

| Thing | Owner | Reaches a client as |
| --- | --- | --- |
| every own field of every player (position, hp, gold, items, potions, cooldowns, status timers, aboard/drop...) except `SNAP_SKIP` | host | snapshot fields, by reflection; every client gets every player's fields |
| arrows, drops, robots, animals (camp monsters among them), fish, the two eagles | host | snapshot lists keyed by network id (players by slot, eagles by team) |
| `objects` tiles (a building raised or wrecked, a felled tree), `ground`, the `structures` registry | host | whole in the full sync; in a delta only the tiles, tile fields and ground cells touched since the peer's ack (`objDiff`, `objWholeAt`, `groundDiff`, `structs`) - state, not events, and no hash check |
| the nets, the holes and ice cracks, the ice breaks, the orca (eased like a body: `netClientLerp`), the road registry (`pads`), the camps' `repopT` and `seen` (a side's cut: its own `seen` only, `snapFogCamps`) | host | snapshot singletons, sent when touched |
| `state`: `SNAP_STATE` (`time`, `elapsed`, `day`, `tick`, `darkness`, the wind's three, `fishT`, `creekGone`, `over`, `end`, `eagleCine`) | host | snapshot singleton, by the names touched; a client keeps its own `over`/`end` and holds the host's as `NET.hostOver` |
| deaths, respawns, the end of the match | host | snapshot state - `netClientMode` reads the local body (`aboard`, `dropT`, `dead`, `eliminated`) and the host's verdict turned to its own side |
| a hit's puff and number, a cue, a shake | host | the cosmetic ring (`ev` on a `snap`), replayed by `evPlay` |
| particles, footprints, snow, camera, cursor, HUD, tooltips, minimap, audio | each machine | never on the wire |
| profile stats | client-side | every `PROFILE.add*` in the sim is gated on `p === player` inside the step, which is the host's screen, so a client writes its own from its snapshot body: `netClientStats` (js/net/net.js) diffs `earned` (gold), `kills`, `dead`'s rising edge and `aboard`'s falling edge (`markDropped`, and the hard music cut off a flying bird - the leap's cue arrives as `sfxFor`'s event), counts the match and its first day at takeoff, and `endMatch('won')` writes `addWin` |

**Only the client's own walk is predicted** (the `prediction` banner, js/net/net.js). Each step
the input a client sends is also stepped on its own body through the same walk the host runs
(`walkHeading`, `walkSlide`, `walkStep`, with `kbDecay`, `iceUnder` and `clampWorld`:
the `the walk` banner in js/sim/sim.js), and kept in `PRED.hist`. Each snapshot names `ia`, the newest
of that client's inputs the host had stepped; `netPredictRestore` puts the body back on the host's
last word before the apply, `netPredictMend` keeps the host's new word and walks every input after
`ia` on top of it. The difference against where the body was drawn is not snapped: it is carried as
an offset the next steps bleed off over `PRED_EASE` (a correction past `PRED_SNAP` is a teleport and
is taken at once). Because the host steps one queued input per step (above), a replay lands within
a step of the host's walk; what is left is the host's own pushes (`separateUnits`, a hit). Only the
walk: while the host's word has the body dead, in the air, stunned, falling, rolling, rushing, on
the rope, leaping, on the cable, walking to it or riding, `netPredictable` is false and the body is
eased like any other. Nothing that touches another unit, a contest or damage is ever predicted.

## The wire form

**The snapshot is built by reflection, not from a field table** (`snapBuild`, `pack`): every own
property of every entity goes in except the names in `SNAP_SKIP`, so a field a sim file adds
tomorrow is carried the day it is added. A reference to another entity crosses as a token naming
kind and id (`P` player slot, `R`/`A`/`W`/`D`/`F` robot/animal/arrow/drop/fish by network id, `O`
object tile index, `C` camp index, `E` eagle by team) and `snapResolve` rebuilds it once everything
it can name exists. A player's `input`, `ai` and `nav` never cross. `Infinity`/`NaN`, a `Map`, a
`Set` and a `Uint8Array` ride as marked objects (`$n`, `$map`, `$set`, `$u8`). An eagle's `pad`
is an entry of the road registry (`pads`) shared by identity, so the registry is a singleton of
its own, merged by team, and the eagles are re-pointed at it after every apply
(`snapEaglesRepoint`). The wire form is cut
from this snapshot, not written beside it:

- **Stable ids and field deltas.** Every moving entity carries a network id for its life
  (`snapNid`); the host keeps a ring of what it packed at each flush tick and sends each client
  only the fields touched since the tick that client acked (a nested field by its JSON), the
  arrays' order when it moved, the ids that left, tiles and ground where they changed, each
  singleton field by field (the ack-keyed base, below). A client updates its
  entities **in place** under those ids, so a reference resolved a tick ago still points at the
  thing - which is also why a tile changes in place, and why a player's aliased plain objects
  (`SNAP_MERGE`: `inv`, `kit`, `spawn`, `look`) are merged rather than replaced
  - an allow-list, because a token merged into the live object it names guts that object.
- **Bytes with a dictionary.** The whole message is binary: every object key an index into a
  dictionary both ends grow in step (a message leads with the names it is the first to use, the
  header carries every name from the index the client's acked message left the list at, written
  by position), numbers as the smallest integer that holds them, a float32 or a float64
  (`ENC_TAG`) - a position or a velocity as an int16 count of eighths of a px (below) - tile
  indices as numbers, not dictionary names. The relay forwards binary frames untouched but for a
  routing header. Only `full` and `snap` go as bytes; every other message is JSON text.
- **15 Hz and interpolation.** `SNAP_EVERY` is 4; a client eases every body a delta moved from
  where it is drawn to where the host put it (`netClientLerp`, per axis: an axis a delta did not
  move keeps the target it had), and snaps instead of easing past `LERP_SNAP` (120 px, a
  teleport). The ease runs over the time deltas actually take to arrive plus twice their wobble
  (`netEaseClock`: one interval on a steady wire, up to `EASE_MAX`), so a late delta finds a body
  still moving instead of stood at its last target. The local player is eased like the rest only
  while it is not walking ahead (above).
- **What the sim keeps to itself.** `SNAP_SKIP` names the bookkeeping that ticks every step and no
  draw pass reads (footstep and dust clocks, a bot's think timer, a fish's turn clock...); the
  echo harness runs without them, so a name added there is proven harmless or caught as pixels.

**The proofs** (all on `DBG`, recipes in [checklists](dev/checklists.md)): `netEcho()` renders the
world frame, snapshots through the bytes, blanks every singleton, applies and renders again - the
pixels that differ are what the snapshot misses, and `snapCompare` names the fields (the harness
pins the wall clock and the shake, which `render()` would otherwise roll, and catches the
trampled snow's chunk repaints up whole, `trCatchUp`, which it would otherwise spread over frames). `netDeltaRun(ticks,
every, loss)` applies a run of deltas back in the page and compares after each.
`DBG.netVerify(on)` makes a host ride its full form along every `VERIFY_EVERY` (300) ticks so each
client checks itself (`netStatus().verifyFail`), and `DBG.netLoss(f)` throws away that share of a
host's snapshot sends before the transport. The size to expect on seed 42 with ten bodies and
buildings: a delta of 4-7 KB at 15 Hz, **~70 KB/s per client**, a full sync of ~1.9 MB.

**Quantized positions.** The names in `SNAP_QUANT` (`x`, `y`, `vx`, `vy`, `kbx`, `kby`, `zipD`) cross as an int16 count of
eighths of a px (`Q16`, 3 bytes against a float32's 5) - by field NAME at encode time, so a
timer, hp, gold or anything the HUD prints as a number never does, and the host reads nothing
back (the sim keeps its floats; only the bytes to a client are coarse). An eighth because a
sprite lands at `Math.round(x - camera)`, so an error under half a px is invisible at rest,
and the sim's own sub-px nudges (`separateUnits`' pushes, a knockback decaying toward zero
for ever) fall below it - the shadow compare (`snapFieldDiff`) compares the quantized value,
so a body that has not moved on the wire is not resent, which is where most of the saving
is. A position
is FLOORED (against a camera on the same grid, `round(floor8(x) - c) === round(x - c)`, so a
floored body cannot round to a different px), a velocity ROUNDED (it is only a heading on a
client, and flooring a knockback at 1e-100 would hand it -0.125 for good); past +/-4095 a
value falls through to the float32. The quantum is the wire's one designed loss, and the
proofs say so exactly: `snapCompare` tolerates one quantum on the named fields and nothing
else, and `netEcho` writes the wire's values into the world (`snapQuantize`) before its
reference frame, so the pixels it counts are what was lost BESIDES the quantum (left exact, a
merchant's axe drawn rotated toward its stump from a sub-px position moved one colour unit).
The client's self-check compares an easing body at its ease TARGET, per axis, not where it is
drawn (`netClientApplyDelta`).

**The ack-keyed base.** The host keeps a RING: `snapHistoryPush` packs the
world at every flush tick (`HIST_KEEP` = 75 entries, 5 s) and keeps, per entry, what that tick
touched - per entity the names that changed or left (whole for one new that tick), the ids
gone, whether the order moved, the same for the eagles and the singletons, each tile's touched
names (whole for one made or unmade), the ground cells, the structures' key - while the tile
shadow keeps only the newest form of every tile, so the ring holds no world per tick, only what
moved. The tiles are ~50k, so a host does not scan them on the flush tick alone: each tick between
two flushes scans its share (`snapTileScan`, from `netHostFlush`) into a pending set the next entry
takes, and the push scans whatever is left. A tile a slice has already passed waits one more
interval; the cut is a union of entries, so it is late, never lost (a `DBG.netVerify` tick rescans
all of them, so the proof compares like with like). The host's clock does not tick at the title, so
every guest who joins there shares one ring entry: the world behind the menu therefore stands still
once the room is shared (`updateTitle`), or a deer turned and turned back between two joins would
never reach the second guest. A client acks the newest tick it applied on every input it sends; the host keeps that
per peer and cuts each peer's delta from the ring entry at ITS ack (`snapDeltaFrom`, peers on
one ack sharing the cut), a full sync going to a peer whose ack aged out of the ring
(`netHostFull`, which also sets the base to the tick it sends). **The cut is the UNION of the
entries after the base, not a compare of the two ends**: the ack is a round trip stale, so the
client may hold any tick between the base and now, and a field that flipped and flipped back
in between has to go again or the client keeps the flip. `d.base` names the base; a client
refuses a delta whose base is newer than what it holds (it sends `{t:'resync'}` and a full sync
follows, as it does when a delta names an id the client never had) and ignores one no newer than
what it holds, which is what an unreliable channel needs and a reliable one never exercises. The
key dictionary is ack-keyed too: a message's header carries every name from the index the peer's
acked message left the list at (`pr.dictAt`), written by position on the far side, so a lost
message loses no name and a repeat is harmless; the full sync carries the list from 0, and a
client starts a fresh `dictIn` on every welcome. On the relay the ack simply trails the send by
a round trip, so a delta is a few fields fatter for it.

**The unreliable channel on Steam.** The host marks a delta LOSSY on the
transport call (`send(peer, bytes, true)`, netHostFlush); the Steam transport splits one into
binary frames - a 7-byte header (magic, sequence, part index, part count) over up to 1193
bytes of payload - on the UNRELIABLE channel when it fits `STEAM_LOSSY_PARTS` (16) of them, a
4.5 KB delta being four. The receiver keeps a frame's parts under its peer and sequence and
hands the bytes over only WHOLE: a part that never comes leaves the delta undelivered, and the
sequence is given up once `STEAM_PENDING` newer ones have come (`lost` on the transport,
`netStatus().framesLost`) - the ack-keyed ring resends what it carried, and a half-applied
delta would be a world the host never had. A repeat after completion is ignored (the completed
marker stays until it ages out), parts may arrive in any order, and the sequence wraps at
65536. Everything else - the full sync (three reliable frames of `STEAM_CHUNK`), the welcome,
rosters, a client's inputs - stays reliable. The bridge (`steam:send`, the pump in
`desktop/main.js`) carries a Uint8Array as bytes both ways, a frame told from text by its first
byte (`STEAM_MAGIC`, 0xB1; JSON starts with `{`); a text message over `STEAM_CHUNK` goes as
numbered `{t:'part'}` texts. steamworks.js exposes Steam's older P2P packets
(`steam.networking.sendP2PPacket`/`readP2PPacket`, sessions accepted on `P2PSessionRequest`), not
Steam's networking sockets: a reliable packet is capped at 1 MB and an unreliable one at 1200
bytes (`STEAM_UNREL`), which is why a delta must stay small enough to split. **None of this has
run against a live Steam** (Status, above).

## Message schema

Every message is a plain object with a type `t`. The two that carry the match - `full` and
`snap` - go through `snapEncode` as bytes; the rest are JSON text. On the relay everything is
reliable and ordered; on Steam only a `snap` is sent unreliable. There is no schema version on the
wire: the handshake is `PATCH_TXT`, the seed and the map shape in the `hello` (a snapshot carries
`v: 2`, which nothing reads).

| `t` | Dir | Form | Body |
| --- | --- | --- | --- |
| `hello` | c→h | JSON | `uid` (the client's identity across a reconnect, kept per tab in `sessionStorage`), `patch` (`PATCH_TXT`), `seed`, `map` (`MAP_TYPE` - the same world means the same shape of it, and a mismatch refuses with `SEED`), `name`, `cls` (the profile's hero), `rank` (its RANKED rating), and from a page crossing to meet another party `party` (its own party's code) and `pn` (how many people it brings) |
| `welcome` | h→c | JSON | `slot`, `hostSlot`, `seed`, `tick`, `roster`, `phase` (the waiting room's page: `room` or `pick`), `ready`, `lvl` (as on a `roster`) |
| `refuse` | h→c | JSON | `why`: `VERSION` / `SEED` / `LATE` / `FULL` / `KICKED` / `BUSY` / `MATCHED` (a crossing party the host did not seat) from the host; `NOROOM` / `FULL` from the relay. A client also sets `NET.refused` itself to `BYTES` (a frame it could not decode) and `HOSTGONE` |
| `roster` | h→c (`*`) | JSON | `roster`: ten `{control, team, name, cls}`, on every join and leave. A client turns the host's `human` into `remote` and keeps its own slot `human`. With it `ready` (the slots whose person said READY), `lvl` (the host's bot level), `mode`, `code`, `ranks` (each person's rating) and `seek` (seconds since FIND MATCH while the party is looking, else -1), `roomInfo` |
| `count` | h→c (`*`) | JSON | the waiting room's countdown: `ct`, the host's `countT`, and `n`, the digit shown |
| `draft` | c→h | JSON | `k` (`hover` or `lock`), `h`: the guest's press in the draft, a hero pointed at or confirmed (`draftAct`, js/ui/draft.js); the host answers with a `draft` |
| `draft` | h→c | JSON | `ph`, `tl` (s left), `n` (bans per team), `banned`, `hover`/`lock` per slot, `lead` (each team's bans): the draft as THIS peer's side may see it (`draftMsg`) - a rival's points hidden (-1), its lock only as -2, its bans until the ban phase ends; all of it once `ph` is `done`. Sent per peer on every change. Through the draft a `roster` carries each seat's starting hero, not its pick |
| `ready` | c→h | JSON | `on`: the guest's READY said or taken back (`seatReady`); the host answers with a `roster` |
| `ping` | h→c | JSON | `at`: the host's clock, every `PING_EVERY` (2 s); the guest sends it straight back as `pong` |
| `pong` | c→h | JSON | `at` as it came: the host eases that peer's round trip (`pongIn`). It is answered in the step, so it carries up to a frame's wait on each end |
| `pings` | h→c (`*`) | JSON | `ms`: a round trip per slot, `null` for a bot or the host, drawn as each person's bars in the room |
| `say` | c→h | JSON | `s`: a line for the room's chat; the host drops one that comes within `TALK_GAP` of that guest's last (`talkFrom`, js/ui/roomtalk.js) |
| `said` | h→c (`*`) | JSON | `slot`, `s`: a line of the room's chat, the host's own and every guest's it kept, cleaned to the pixel font's letters (`talkClean`) |
| `rematch` | h→c (`*`) | JSON | `seed`, `map`: the valley the room plays next, sent the moment a match ends (`rematchOffer`, js/ui/rooms.js) and again on the host's LOBBY. A guest's LOBBY reloads onto it and joins the same code; once the host has gone after it, the guest drops whatever else the old socket brings and does not end on HOST LEFT |
| `cross` | h→c (`*`) | JSON | `room`, `seed`, `map`, `code`, `n`: the leader's party is crossing to meet another (`seekCross`, js/ui/matchmaking.js); each guest saves its party and reloads to join that room with `party`/`pn` in its hello |
| `phase` | h→c (`*`) | JSON | `phase`: the host turned the waiting room's page, `room` (the seats) or `pick` (the hero select's draft) |
| `full` | h→c | bytes, reliable | `tick`, `ia` (as on a `snap`), `snap`: the whole `snapBuild()` - players, `objects` as a sparse map by tile index, `structs`, the five kinds, `eagles`, `ground` (base64 of the byte array), the singletons. The dictionary from index 0. Sent after the welcome, on a `resync`, and to a peer whose ack aged out of the ring |
| `snap` | h→c | bytes, lossy | `tick`, `d` (the delta, below), `ev` (the cosmetics drained this flush), `ia` (the newest of THIS peer's inputs the host has stepped: where its prediction replays from), and `full` when `NET.verify` is on and the tick is a `VERIFY_EVERY` one |
| `in` | c→h | JSON | `tick` (the client's own send counter), `ack` (the newest snapshot tick applied), `in`: `{mx, my, aimX, aimY, fire, work, slide, grapple, dodge, jump, ability, useItem, cmd}`. One struct per client tick, sent once; the host queues them and steps one per tick (`netHostStep`); the client clears its edges after sending and the host latches them until the sim consumes them. A `cmd` rides inside it - there is no separate command message |
| `resync` | c→h | JSON | no body: the client could not take a delta; the host answers with a `full` |
| `peer` / `gone` | transport→h | - | someone joined or left the room or lobby (`gone` hands the body to a bot and parks the slot, below) |
| `closed` / `hostGone` | transport→c | - | the client's own socket dropped (relay; it redials) / the host is gone: its socket closed on the relay, or the lobby's owner left on Steam |
| `replaced` | relay→h | JSON | another host socket took this room's code: the transport sets `error = 'REPLACED'` and closes without redialling (two hosts would otherwise swap the room forever) |
| `room` | h→relay | JSON | `data`: `{name, patch, seed, map, practice, state: 'open' or 'live', humans, sides, seek}` (`seek`: the mode while the party is looking for another, else empty) - what the list shows (`netHostRoom`); on Steam the same object goes into lobby data as strings |

There is no ping, no ack message of its own (the ack rides every `in`), no world hash and no
leave message (a leave is the transport's `gone`).

### The delta (`d`)

Cut by `snapDeltaFrom(h, base, team)` and applied by `snapApplyDelta`. `{v, tick, base}` (`base` -1
for "from nothing"), then only what was touched since the base:

| Key | Carries |
| --- | --- |
| `P`, `R`, `A`, `W`, `D`, `F` | per kind: `ch` - `[id, fields]` pairs, the fields touched as they stand now (whole for an entity new since the base), names that left as `$del`; `del` - ids gone; `order` - the array's ids in order, when it moved. An id a client has not seen is made; an `order` naming an id it lacks returns null and earns a `resync` |
| `eagles` | `[team, fields]` pairs |
| `state`, `orca`, `dropMeta` | a plain-object singleton, by the names touched |
| `camps`, `pads`, `holes`, `nets` | an array singleton, whole when touched |
| `objDiff`, `objWholeAt`, `objWhole` | tiles by index: touched fields (with `$del`), `null` for a tile gone, the whole tile for one made or unmade since the base (its index listed in `objWholeAt`; `objWhole` when there was no base). A tile still there changes in place |
| `groundDiff` | a flat `[index, type, ...]`; each cell is `repaintGround`ed |
| `structs` | the registry as tile indices, when it moved |

**Each side is sent only what it sees** (the `fog` banner, js/net/snapshot.js; the rule is
[the fog of war](dev/gameplay/fog-of-war.md)). Each ring entry keeps the ids each side cannot see
(`snapFogHid`); a peer's full form (`snapBuild(team)`) and its deltas are cut for its side
(`netFogTeam`: its own, or everything once its bird is gone - a change of side is a full sync).
A rival `R`/`A`/`W` out of sight is left out: `del` the tick it goes, sent whole (its id in the
kind's `whole`, so keys left over from before are dropped) the tick it comes back, never in
`order` while hidden. A rival player out of sight goes as a stub: `fogHid: 1` and only
`SNAP_FOG_KEEP` (name, class, level, hp, kills and the rest of what the rail, the scoreboard and
the post-game lobby show); every other field the client holds is the last-seen value and drawn
nowhere. A link to a body the side was not sent resolves to null and is put back when it arrives
(`snapPendRetry`). Within what a side sees, every player's every field goes, items included: there
is no per-recipient field policy beyond the fog.

### Events

**Only cosmetics are events** (js/net/events.js): the ring carries `burst`, `float`, `dmg`, `sfx`
(cue at a place with a radius; `EV_ANYWHERE` reaches every screen), `sfxp` (cue for a player id),
`sfxo` (owner cue / bystander cue), `shake` and `shakep` entries as `{k, a}`, recorded inside the
step on the host (`evInStep` and `evRecord`, which is on only while there are peers; `EV_MAX` 1024
per flush) and replayed by `evPlay` on a client against *its* player. A side's peers get only the
`burst`, `stream`, `float` and last-hit `coin` entries raised where it sees, and the bot calls and
missed coins meant for it (`netEvSeen`). Everything that changes
state - a build, a ground change, a death, a respawn, a trade, the end of the match - arrives as
snapshot state, not as an event, so a lost `snap` loses only cosmetics. Two wrinkles: a floater
that carries a team's paint records the HOST's `skin()` colour, and `burst` draws off the sim's
`rng` on a client as it does on the host. Footsteps (`sfxFor(p, 'step')` for every walking body)
are close to half the ring and the first thing to derive locally instead of shipping.

## The lobby lifecycle

The same screens and the same protocol ride either transport; only the list and the room differ
(a relay room with a four-letter code, or a public Steam lobby of `STEAM_LOBBY_MAX` 10).

1. **A party.** QUICKPLAY or RANKED on the title hosts the page's own party at once
   (`beginParty`, js/ui/rooms.js -> `netHost()` -> the transport's `listen()`), its mode in
   `NET.mode`: the relay deals a four-letter code; the Steam transport calls the bridge's
   `createLobby('public', 10)`, makes a code of the same shape (`steamCode`) and writes `patch`,
   `seed`, `state: 'open'`, `code` and the host's name into lobby data. The host publishes its
   list entry once the transport is open (`netHostRoom`), and again on every join, leave and at
   the drop (`state: 'live'`).
2. **Join by code.** A friend types or pastes the code into the CODE box of their own party
   (`partySeek`): the code is looked up on the list, fed live by `wsRooms`, or by `steamRooms`
   polled every `STEAM_LIST_T` (2 s) when `netSteam()`, matching a relay room's name or a lobby's
   `code`; an entry on another patch never matches (`roomOk`), and a Steam lobby without a `patch`
   key is someone else's test on a shared App ID. A Steam invite taken up (`joinRequested`, or
   `+connect_lobby ID` on the launch line, which desktop/main.js turns into `?join=ID`) joins
   directly (`partyBootJoin`).
3. **Join.** `joinRoom(r)`: **SEED is decided at load**, so a page born on another seed reloads
   itself onto the party's (`?seed=N&join=CODE`, plus `&transport=steam`; the Steam transport does
   the same from `connect()`, on another seed or map shape, with `&map=M&join=ID`) and joins from
   boot. Then `netJoin` -> `connect()`, and once the transport is open the client sends `hello`.
4. **The host answers** in `netHostHello`: `refuse` on another patch or seed, else the slot - the
   parked one for a returning `uid`; in a party the first open seat on the leader's side, only
   while the party is on its seats (`BUSY` once the hero select or the match has begun, `FULL`
   past five, `KICKED` for a uid the leader showed out). A host with no mode (a harness's
   `?net=host`) deals the first AI slot on the side with fewer PEOPLE (`LATE` past `LATE_JOIN_T`
   into a live match). The body becomes `control: 'remote'` and takes the hello's name, hero and
   rating; then `welcome`, a `full`, a `roster` to everyone and a fresh list entry. A newcomer is
   not ready until it says so.
5. **The party**, two pages the leader turns for everyone (`NET.phase`, the `phase` message).
   The SEATS (`room`, js/ui/rooms.js): your side's five; the leader's hand on a guest's seat end
   shows them out (`seatKick`, the seat stands empty again). Each guest's READY (`ready`) shows a
   tick on its seat, and the leader's FIND MATCH does nothing but flash the seats it waits on
   until every person has said it (`roomAllReady`). Every person's seat carries ping bars
   (`ping`/`pong`/`pings`) and, in RANKED, its rating. The party has a chat (`say`/`said`).
   FIND MATCH (`partyFind`) first looks for another party (**matchmaking**, below), then
   (`partyStart`) fills every empty seat on both sides with a bot, pins the bots' level
   in RANKED (`NET.botLv` from the people's average rating) and turns the page to the HERO SELECT
   (`pick`, the lobby), which runs the DRAFT (js/ui/draft.js): bans, then everyone's blind pick,
   the host keeping it and each guest pressing through `draft` messages; the leader's ESC turns back to the seats. Seats are
   locked once the drop is under way (`seatsOpen`). The client builds its bodies from the
   welcome's roster (`initPlayers(roster, slot)`) and updates them in place on each `roster`.
   The draft's closing count reaches every screen as `count`.
6. **The drop.** The count ends in `lockIn` and `beginDrop`, which seats by slot. A client
   never starts anything: the ride arrives as snapshot state (`state.drop`, `aboard`, `dropT`, the
   eagles) and `netClientMode` moves its screen from the title to the ride, to play, to the death
   overlay and back. The hop off the roost is an input (`input.work`, `input.dodge` or `input.jump`), like everything else a hand does.
7. **In match.** The party stays listed as `live`, which is how a dropped client finds it. On
   Steam the host learns who came and went from the lobby's chat updates (`LobbyChatUpdate` ->
   `peer`/`gone`).
8. **End.** The host's `state.over` crosses as `NET.hostOver`, and `netClientMode` turns the
   verdict to the client's own side (`endMatch('won' | 'lost')`, which moves a RANKED rating:
   `rankResult`); each screen keeps its own `state.over`/`state.end`. **The rematch**: the end
   names the next seed to every guest (`rematch`); the leader's LOBBY saves the mode and each
   uid's slot to `sessionStorage` and reloads as `?net=host&back=1` on that seed with the same
   code (`&room=CODE` on the relay, `&transport=steam&code=CODE` on Steam), straight onto the
   party (`rematchBootHost`); a guest's LOBBY reloads as `?join=CODE&back=1` and keeps trying the
   code for `REMATCH_WAIT` while the leader's page comes back, and the leader deals it the slot
   it held (`rematchSeat`). Leaving (`netLeave`) closes a leader's party; a guest walks out of one.
9. **The practice field.** PRACTICE TOOL's START sends guests `practice` and reloads the leader as
   `?practice=1&net=host&back=1` on the party's code; a guest reloads as `?practice=1&join=CODE&back=1`
   and keeps trying the code like a rematch. The field's host takes friends at any time (no
   `BUSY`), seats them on the spawn and parks a leaver's empty body in the corner; the list
   entry carries `practice: 1`, so a code typed on a title page reloads onto the field. The
   leader's LEAVE is a rematch back to the party (`rematch`, which a guest on the field follows at once).
10. **Matchmaking** (js/ui/matchmaking.js). QUICKPLAY and RANKED's FIND MATCH sets `NET.seek`,
   lists the room with `seek: mode` and reads the list. Of the parties looking in one mode, the
   lowest code hosts: it waits `MATCH_WAIT` (8 s, plus `MATCH_HOLD` while a higher one is still
   listed); every other party crosses to the lowest it sees (`seekCross`): the leader saves its
   party (`sessionStorage` `softfall.home`: code, mode, guests' slots), sends `cross`, and every
   page of it reloads as `?seed=S&map=M&join=ROOM&back=1&party=CODE&pn=N` (`CROSS`). The host
   seats the first crossing party's hellos on its rival side (`crossAdmit`) and refuses any other
   `MATCHED`; it starts once all `pn` are in or after `MATCH_GATHER` (20 s), and with nobody found
   at `MATCH_WAIT` it starts with bots. A page that has not been welcomed ignores what the host says
   to the whole room. A crossed page goes home on LOBBY after the match, on a refusal, after
   `MATCH_JOIN` (6 s) of failed tries, or when its host walks out (`partyLost`): its leader hosts
   the party's code again and its guests join it, all on `homeSeed(code)` (`crossHomeUrl`). The
   rival party's people are left out of the host's rematch seats (`pr.cross`).

### Joins, leaves, reconnects

- **A client drops.** On `gone` the host flips the body to `control: 'ai'` so the side keeps its
  number, clears its input and parks the slot under the client's `uid` (`NET.parked`) for
  `RECONNECT_GRACE` (60 s). A `hello` with that `uid` inside the grace, while the slot is still a
  bot, lands back in it - `welcome`, `full`, `remote` again. On the relay the client redials on
  its own every `WS_RETRY` (2 s) and says `hello` again on open. Past the grace the `uid` is a
  stranger and joins like one. The `uid` lives in `sessionStorage`, so it survives a reload and
  not a new tab.
- **A mid-match join** to a party is refused (`BUSY`). Without a mode it is a `hello` from an unknown `uid` while `state.drop` is set: accepted
  into an AI slot on the side with fewer people while `state.elapsed` is under `LATE_JOIN_T`
  (300 s), refused with `LATE` after. The joiner takes over the bot's body as it stands.
- **The host quits or vanishes.** No migration. On the relay the host's socket closing sends every
  client `hostGone` at once (there is no grace timer): a waiting guest goes back to a party of its own
  with a rattle, a playing one ends on the HOST LEFT plate (`endMatch('hostleft')`: no win, no
  loss). On Steam the client's transport raises the same `hostGone` when the owner it joined leaves
  the lobby (unverified live - Status). A second host socket on a room's code replaces the first:
  the old host is told `{t:'replaced'}` and stands down.
- **Host migration** needs every client to hold enough state to become the host and a
  deterministic successor pick. It is scoped out on purpose.

## Migration plan (finished)

Every step shipped as its own PR and kept solo play identical.

1. Fixed step, `TICK_DT = 1/60` - PATCH 3.42.
2. Unpin player 0 (`initPlayers(roster, local)`) - PATCH 3.43.
3. Cosmetics out of the sim (js/net/events.js) - PATCH 3.44.
4. `NET`, the loopback and the reflection snapshot with the echo harness - PATCH 3.45.
5. Two browsers through the relay (`transport-ws.js`, `app/server.js`), the `remote` control kind,
   the worker-driven hidden loop - PATCH 3.46.
6. The wrapper (`desktop/`) and the Steam transport - PATCH 3.47.
7. The rooms screen and the waiting room, on the relay - PATCH 3.48; dressed in 3.52; Steam's
   lobbies through the same screen in 3.53.
8. After the plan: the binary wire form, deltas and interpolation - 3.49; quantized positions -
   3.50; the ack-keyed ring - 3.51; Steam's unreliable channel and raw bytes over the bridge - 3.54;
   the client's own walk predicted, one input per host step, the ease sized from arrivals and the
   tile scan spread over the steps - 0.467.

Releases: every `v*` tag builds the portable zip (desktop/build.js - the page, `js/`, the
mp3s of `audio/music/` and the wrapper with steamworks.js, nothing else; `npm run steam:stage`
builds the same package into the SDK's content folder for a steamcmd upload),
.github/workflows/desktop.yml) and attaches it to a GitHub Release. A Steam tester's account
must own the app.


## Risks

The numbers are stable - code comments cite them (js/app/boot.js cites risk 3) - so a retired risk keeps
its line.

1. **The fixed step's presentation.** The sim's feel did not change at 1/60; a screen above 60 Hz
   draws the camera and the movers in between steps (`tweenIn`, render-only, since 0.451), and
   what remains is that a heavy stall plays a moment of slow motion instead of a jump.
2. **The snapshot is never quite complete.** Reflection carries every field, so the live risk is
   the reverse: a name added to `SNAP_SKIP` that a draw pass does read renders stale on a client,
   and a new entity ARRAY (a kind not in `SNAP_KINDS`, a singleton not in `snapSingles`) is not
   carried at all. `netEcho` is the gate: it is a pixel diff, not a play test. There is no schema
   version, so two builds on one `PATCH_TXT` can disagree silently.
3. **Background throttling on the host.** Alt-tab and the whole room freezes. Mitigation: while
   the page is hidden the loop is driven by a worker's clock (`watchHidden`, js/app/boot.js) and the
   wrapper sets `backgroundThrottling: false`. A client shows a blinking relay pip when its socket
   is down, but nothing when snapshots merely stop arriving.
4. **Edge-triggered inputs under loss.** `dodge`, `jump`, `useItem`, `ability` and `cmd`
   are one-tick pulses sent ONCE, and the host latches them. Every `in` rides the reliable
   channel on both transports, so none is lost today; moving inputs to an unreliable channel
   would need the edges resent until acked.
5. **Host advantage and trust.** The host sees zero latency and can edit anything; accepted for a
   friends game. The host clamps nothing in a remote input today (`mx`/`my` are copied as sent).
6. **Latency is real.** The walk is predicted, so it answers at once; everything else a client
   does (a shot, a roll, a potion, an ability) lands a round trip later, on the relay (two hops
   through Noah's server) more than on Steam, and other bodies are drawn about half a round trip
   plus an ease behind. There is no ping: the ease is sized from how deltas arrive, not from an
   RTT.
7. **Profile stats.** `gainGold` and the kill and death counters write `PROFILE` where
   `p === player` inside the step, which only ever runs on the host: a client's character earns
   a win and nothing else. Owed.
8. **Two ways to run the same page.** Electron and `file://` must both work forever.
   `window.steamBridge` is read only in `netSteam()` and the Steam transport; a stray reference
   elsewhere is a broken double-click.
9. **Binary encoding** - retired: `snapEncode`/`snapDecode` are one generic tagged form, proven by
   `netEcho` crossing the bytes on every echo.
10. **World drift.** A client whose `ground`/`objects` disagree with the host walks through a wall
    that is not there. Tiles cross as delta state cut from the ack, so a lost delta is resent, but
    there is no hash check: only `DBG.netVerify` (a proof switch, off by default) compares a
    client against the host's full form.
11. **Host migration will be demanded.** A host with a bad connection takes nine people down. It
    needs every client to hold a complete authoritative state - which a snapshot client nearly
    does, minus `SNAP_SKIP`, `ai` and `nav` - and to agree on a successor.
12. **The size of the full sync.** ~1.9 MB of bytes, uncompressed: the relay forwards it as one
    fragmented binary message, Steam as three reliable `STEAM_CHUNK` frames. A mid-match joiner
    sees nothing of the match until it lands, and every peer whose ack ages out of the ring (5 s of
    silence) costs the host another.
13. **Upload.** ~70 KB/s per client is ~650 KB/s from a host with nine, on a home connection. The
    mitigation owed is a per-kind field policy (what a client cannot see or use need not cross).

## Open decisions

Decided: public rooms and public lobbies ship (the list shows every room, live ones included; the
bridge can make a `friends` or `private` lobby and open the invite dialog, but no screen asks for
either); the host writes its own `p.input` directly through `sampleHumanInput`, not through a
transport; `?seed=N` is the host's, and a joiner reloads onto it.

Still open, with the current lean in italics:

- Whether `PATCH_TXT` plus the seed is enough of a handshake. *Add a wire version or a content
  hash of `js/` the first time two builds on one patch number meet.*
- What `DBG` may do on a client. *Nothing enforced: a client's writes to the singletons are
  overwritten by the next delta that touches them, and only then.*
- Whether the relay or Steam leads at launch on Steam. *Decided 2026-10-14: Steam leads in the
  wrapper, before the path has run against a live Steam - the first playtest is that run.*
