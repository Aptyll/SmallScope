# Online PvP architecture

One player is the **host** and runs the authoritative simulation; every other player is a
**client** that sends its input and renders what the host says. Two transports carry the same
protocol behind one five-call interface: a WebSocket **relay** (`app/server.js`, the server Noah
hosts) for browser and wrapper alike, and **Steam lobbies** with Steam's P2P packets from the
Electron wrapper (`desktop/`) behind `--transport=steam`. No dedicated servers, no host migration.

This file is the reference for the wire: the code under `js/net/`, the relay and the wrapper cite
it by path. Read [game.md](dev/game.md) and [multiplayer.md](dev/multiplayer.md) first: the
ten-player `Player` array, the input struct and the bot brain are what keep the net code short.

## Status

- **Ships:** relay rooms (host a room, a public list, join by code, the waiting room, late join,
  rejoin into your own slot), the host-authoritative sim with snapshot clients (full sync + ack-keyed
  binary deltas at 15 Hz, eased on the client, no prediction), the cosmetic event ring, the
  HOST LEFT ending, and the wrapper with Steam lobbies listed through the same rooms screen.
- **Unverified:** nothing on the Steam path (lobby round trip, P2P packets, the unreliable
  channel's frames) has run against a live Steam - only in Node against a fake bridge and as a
  headless wrapper boot. The first live test should watch `DBG.netStatus()`: `framesLost` on a
  client (the receiver counts a delta it gave up on) and `fulls` on the host.
- **Owed:** the host clamps nothing in a remote input; notices (`raiseNotice`: the roost alarm's
  plate, the market's) and the own-bird alarm cue are raised on the host's screen only; a per-kind field policy if
  ~70 KB/s per client is too much for nine clients on a home upload; walk prediction (deferred).
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
- **The world is a function of `SEED`.** `genWorld`, the road, the camps, the chests, the wildlife
  and the shoal all derive from it. A client can build the whole static map from a 32-bit number.
- **Contested orders resolve from `(SEED, id, state.tick)`** through `contest()`. Only the host
  runs them, so the property is a free extra rather than a requirement.
- **A sim file does not draw.** `render()` and `renderUI()` read the singletons (`players`,
  `arrows`, `structures`, `state`) and never call into the step, so a client that writes a
  snapshot into those singletons renders it with the draw code untouched.

## What had to change, and the constraint each left behind

- **The step is fixed.** `loop()` (js/boot.js) banks the frame's time and hands `update(TICK_DT)`
  zero or more times per frame (`TICK_DT = 1/60`, at most `TICK_MAX` steps), then `render()` once.
  It is 1/60 because `TOOL_ROF_STEP` counts rate of fire in 1/60 steps and every integrator was
  tuned there; a coarser network tick is a snapshot cadence (`SNAP_EVERY`), never a sim one.
  Practice and the title step the same way. The leftover fraction is banked, not rendered: there is
  no render interpolation between steps.
- **No slot is the local human by construction.** `initPlayers(roster, local)` takes the roster and
  the local slot, `player = players[localId]`, `beginDrop` seats by slot, `applyCharacter(p)` takes a
  target, `skin()` reads `player.team`. `?local=N` and `DBG.setLocal(N)` seat the local player
  elsewhere for a check. A person on another screen is `control: 'remote'`, and everything that
  treats a person differently from a bot asks `isHuman(p)` (js/net/net.js), never the string.
- **Effects and sounds raised inside the step carry the where and the who** (js/net/events.js,
  below), because a client does not run those moments and has to be told.
- **A hidden host keeps stepping.** A hidden tab gets no animation frames, so while
  `document.hidden` the frames come from a worker's 16 ms clock (`watchHidden`, js/boot.js); the
  wrapper sets `backgroundThrottling: false`.

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

**The relay leads, Steam sits behind a flag (Noah's ruling, 2026-09-14).** A browser at a served
address, the wrapper at `file://` and one machine playing itself in two windows all reach the relay
(`netRelay()`: `?relay=ADDR` remembered in the settings, else the address the page was served
from, else `localhost:8471`). `netSteam()` is true only with the bridge present AND
`?transport=steam` (the wrapper's `--transport=steam`); the same three doors open on either.

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

In `update()` (js/sim.js), host and solo, while the match is in `play`/`dead`/`drop` and unpaused:

```
sampleHumanInput(player)
netHostStep(dt):  drain the transport - hello -> a slot, gone -> a bot, resync -> a full sync,
                  in -> MERGED into that body's p.input (held fields overwrite; the edges dodge,
                  jump, eatBerry, eatFish, useCard, ability and cmd latch until the sim consumes them)
evInStep = true;  updatePlay(dt);  evInStep = false     (the step, unchanged)
netHostFlush():   every SNAP_EVERY ticks: push the ring, cut each peer's delta from its ack,
                  attach the drained cosmetics, send lossy; a peer whose ack aged out gets a full sync
```

At the title a host runs `netHostStep` alone, so a peer can knock before the match starts.

Client, in every mode:

```
sampleHumanInput(player)          (not at the title)
netClientStep(dt): send {t:'in'} - this tick's input and the ack - then clear the edges
                   netClientLerp(): ease every moved body toward the host's position
                   drain the transport: full -> snapApply, snap -> snapApplyDelta + evPlay per event,
                   welcome / roster / count / refuse / closed / hostGone
                   after each apply, netClientMode(): which screen this state calls for, read off the local body
(no updatePlay: no updatePlayer, no updateAI, no resolveContests, no world subsystem)
```

## Authority, in one table

| Thing | Owner | Reaches a client as |
| --- | --- | --- |
| every own field of every player (position, hp, gold, bag, gear, cooldowns, status timers, aboard/drop...) except `SNAP_SKIP` | host | snapshot fields, by reflection; every client gets every player's fields |
| arrows, drops, robots, animals (camp monsters among them), fish, the two eagles | host | snapshot lists keyed by network id (players by slot, eagles by team) |
| `objects` tiles (a build, a demolish, a felled tree), `ground`, the `structures` registry | host | whole in the full sync; in a delta only the tiles, tile fields and ground cells touched since the peer's ack (`objDiff`, `objWholeAt`, `groundDiff`, `structs`) - state, not events, and no hash check |
| the market, the nets, the holes and ice cracks, the road registry (`spurs`), the camps' `repopT` | host | snapshot singletons, sent when touched |
| `state`: `SNAP_STATE` (`time`, `elapsed`, `day`, `tick`, `darkness`, the wind's three, `fishT`, `over`, `end`, `eagleCine`) | host | snapshot singleton, by the names touched; a client keeps its own `over`/`end` and holds the host's as `NET.hostOver` |
| deaths, respawns, the end of the match | host | snapshot state - `netClientMode` reads the local body (`aboard`, `dropT`, `dead`, `eliminated`) and the host's verdict turned to its own side |
| a hit's puff and number, a cue, a shake | host | the cosmetic ring (`ev` on a `snap`), replayed by `evPlay` |
| particles, footprints, snow, camera, cursor, HUD, tooltips, minimap, audio | each machine | never on the wire |
| profile stats | client-side | every `PROFILE.add*` in the sim is gated on `p === player` inside the step, which is the host's screen, so a client writes its own from its snapshot body: `netClientStats` (js/net/net.js) diffs `xp` (gold), `kills`, `dead`'s rising edge and `aboard`'s falling edge (`markDropped`, and the hard music cut off a flying bird - the leap's cue arrives as `sfxFor`'s event), counts the match and its first day at takeoff, and `endMatch('won')` writes `addWin` |

**There is no prediction.** A client eases every body, its own included, over one snapshot
interval. The game is momentum walking, 1.5 s meals and a bow you draw; a mispredicted roll that
un-hits is a worse feel than a short delay on the walk. If the walk feels sluggish under real
latency, the pass to add predicts **only the movement banner** for the local player: it is a pure
function of the input, the position and the static tile grid, so re-running it over the unacked
inputs is cheap and exact. Nothing that touches another unit, a contest or damage is ever
predicted.

## The wire form

**The snapshot is built by reflection, not from a field table** (`snapBuild`, `pack`): every own
property of every entity goes in except the names in `SNAP_SKIP`, so a field a sim file adds
tomorrow is carried the day it is added. A reference to another entity crosses as a token naming
kind and id (`P` player slot, `R`/`A`/`W`/`D`/`F` robot/animal/arrow/drop/fish by network id, `O`
object tile index, `C` camp index, `E` eagle by team) and `snapResolve` rebuilds it once everything
it can name exists. A player's `input`, `ai` and `nav` never cross. `Infinity`/`NaN`, a `Map`, a
`Set` and a `Uint8Array` ride as marked objects (`$n`, `$map`, `$set`, `$u8`). An eagle's `spur`
and `pad` are entries of the road registry (`spurs`) shared by identity, so the registry is a
singleton of its own, merged by (team, pad), and the eagles are re-pointed at it after every apply
(`snapEaglesRepoint`); its `lane` is merged into the object already there. The wire form is cut
from this snapshot, not written beside it:

- **Stable ids and field deltas.** Every moving entity carries a network id for its life
  (`snapNid`); the host keeps a ring of what it packed at each flush tick and sends each client
  only the fields touched since the tick that client acked (a nested field by its JSON), the
  arrays' order when it moved, the ids that left, tiles and ground where they changed, each
  singleton field by field (the ack-keyed base, below). A client updates its
  entities **in place** under those ids, so a reference resolved a tick ago still points at the
  thing - which is also why a tile changes in place, and why a player's aliased plain objects
  (`SNAP_MERGE`: `inv`, `food`, `kit`, `flag`, `spawn`, `look`) are merged rather than replaced
  - an allow-list, because a token merged into the live object it names guts that object.
- **Bytes with a dictionary.** The whole message is binary: every object key an index into a
  dictionary both ends grow in step (a message leads with the names it is the first to use, the
  header carries every name from the index the client's acked message left the list at, written
  by position), numbers as the smallest integer that holds them, a float32 or a float64
  (`ENC_TAG`) - a position or a velocity as an int16 count of eighths of a px (below) - tile
  indices as numbers, not dictionary names. The relay forwards binary frames untouched but for a
  routing header. Only `full` and `snap` go as bytes; every other message is JSON text.
- **15 Hz and interpolation.** `SNAP_EVERY` is 4; a client eases every body a delta moved from
  where it is drawn to where the host put it over one interval (`netClientLerp`, per axis: an
  axis a delta did not move keeps the target it had), and snaps instead of easing past
  `LERP_SNAP` (120 px, a teleport). The local player is eased like the rest.
- **What the sim keeps to itself.** `SNAP_SKIP` names the bookkeeping that ticks every step and no
  draw pass reads (footstep and dust clocks, a bot's think timer, a fish's turn clock...); the
  echo harness runs without them, so a name added there is proven harmless or caught as pixels.

**The proofs** (all on `DBG`, recipes in [checklists](dev/checklists.md)): `netEcho()` renders the
world frame, snapshots through the bytes, blanks every singleton, applies and renders again - the
pixels that differ are what the snapshot misses, and `snapCompare` names the fields (the harness
pins the wall clock and the shake, which `render()` would otherwise roll). `netDeltaRun(ticks,
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
moved. A client acks the newest tick it applied on every input it sends; the host keeps that
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
wire: the handshake is `PATCH_TXT` and the seed in the `hello` (a snapshot carries `v: 2`, which
nothing reads).

| `t` | Dir | Form | Body |
| --- | --- | --- | --- |
| `hello` | c→h | JSON | `uid` (the client's identity across a reconnect, kept per tab in `sessionStorage`), `patch` (`PATCH_TXT`), `seed`, `name`, `cls`, `look` - from the profile's character |
| `welcome` | h→c | JSON | `slot`, `hostSlot`, `seed`, `tick`, `roster` |
| `refuse` | h→c | JSON | `why`: `VERSION` / `SEED` / `LATE` / `FULL` from the host; `NOROOM` / `FULL` from the relay. A client also sets `NET.refused` itself to `BYTES` (a frame it could not decode) and `HOSTGONE` |
| `roster` | h→c (`*`) | JSON | `roster`: ten `{control, team, name, cls, look}`, on every join and leave. A client turns the host's `human` into `remote` and keeps its own slot `human` |
| `count` | h→c (`*`) | JSON | the waiting room's countdown: `ct`, the host's `countT`, and `n`, the digit shown |
| `full` | h→c | bytes, reliable | `tick`, `snap`: the whole `snapBuild()` - players, `objects` as a sparse map by tile index, `structs`, the five kinds, `eagles`, `ground` (base64 of the byte array), the singletons. The dictionary from index 0. Sent after the welcome, on a `resync`, and to a peer whose ack aged out of the ring |
| `snap` | h→c | bytes, lossy | `tick`, `d` (the delta, below), `ev` (the cosmetics drained this flush), and `full` when `NET.verify` is on and the tick is a `VERIFY_EVERY` one |
| `in` | c→h | JSON | `tick` (the client's own send counter), `ack` (the newest snapshot tick applied), `in`: `{mx, my, aimX, aimY, fire, work, slide, grapple, dodge, jump, eatBerry, eatFish, useCard, ability, cmd}`. One struct per client tick, sent once; the client clears its edges after sending and the host latches them until the sim consumes them. A `cmd` rides inside it - there is no separate command message |
| `resync` | c→h | JSON | no body: the client could not take a delta; the host answers with a `full` |
| `peer` / `gone` | transport→h | - | someone joined or left the room or lobby (`gone` hands the body to a bot and parks the slot, below) |
| `closed` / `hostGone` | transport→c | - | the client's own socket dropped (relay; it redials) / the host is gone: its socket closed on the relay, or the lobby's owner left on Steam |
| `replaced` | relay→h | JSON | another host socket took this room's code: the transport sets `error = 'REPLACED'` and closes without redialling (two hosts would otherwise swap the room forever) |
| `room` | h→relay | JSON | `data`: `{name, patch, seed, state: 'open' or 'live', humans, sides}` - what the list shows (`netHostRoom`); on Steam the same object goes into lobby data as strings |

There is no ping, no ack message of its own (the ack rides every `in`), no world hash and no
leave message (a leave is the transport's `gone`).

### The delta (`d`)

Cut by `snapDeltaFrom(h, base)` and applied by `snapApplyDelta`. `{v, tick, base}` (`base` -1
for "from nothing"), then only what was touched since the base:

| Key | Carries |
| --- | --- |
| `P`, `R`, `A`, `W`, `D`, `F` | per kind: `ch` - `[id, fields]` pairs, the fields touched as they stand now (whole for an entity new since the base), names that left as `$del`; `del` - ids gone; `order` - the array's ids in order, when it moved. An id a client has not seen is made; an `order` naming an id it lacks returns null and earns a `resync` |
| `eagles` | `[team, fields]` pairs |
| `state`, `market`, `dropMeta` | a plain-object singleton, by the names touched |
| `camps`, `spurs`, `holes`, `iceCracks`, `nets` | an array singleton, whole when touched |
| `objDiff`, `objWholeAt`, `objWhole` | tiles by index: touched fields (with `$del`), `null` for a tile gone, the whole tile for one made or unmade since the base (its index listed in `objWholeAt`; `objWhole` when there was no base). A tile still there changes in place |
| `groundDiff` | a flat `[index, type, ...]`; each cell is `repaintGround`ed |
| `structs` | the registry as tile indices, when it moved |

Every client gets every player's every field, bag included: there is no per-recipient field
policy yet.

### Events

**Only cosmetics are events** (js/net/events.js): the ring carries `burst`, `float`, `dmg`, `sfx`
(cue at a place with a radius; `EV_ANYWHERE` reaches every screen), `sfxp` (cue for a player id),
`sfxo` (owner cue / bystander cue), `shake` and `shakep` entries as `{k, a}`, recorded inside the
step on the host (`evInStep` and `evRecord`, which is on only while there are peers; `EV_MAX` 1024
per flush) and replayed by `evPlay` on a client against *its* player. Everything that changes
state - a build, a ground change, a death, a respawn, a trade, the end of the match - arrives as
snapshot state, not as an event, so a lost `snap` loses only cosmetics. Two wrinkles: a floater
that carries a team's paint records the HOST's `skin()` colour, and `burst` draws off the sim's
`rng` on a client as it does on the host. Footsteps (`sfxFor(p, 'step')` for every walking body)
are close to half the ring and the first thing to derive locally instead of shipping.

## The lobby lifecycle

The same screens and the same protocol ride either transport; only the list and the room differ
(a relay room with a four-letter code, or a public Steam lobby of `STEAM_LOBBY_MAX` 10).

1. **The MULTIPLAYER plank** on the title opens the rooms screen (`beginRooms`, js/ui/menu.js): a
   HOST plank over the open rooms, fed live by `wsRooms` - or by `steamRooms`, polled every
   `STEAM_LIST_T` (2 s), when `netSteam()`. A row reads as its host's name, ten seat pips lit per
   person in their side's paint, the code and a dot once the match is live; a room on another
   patch is dimmed and inert with its patch printed (`roomOk`). A Steam lobby without a `patch`
   key is someone else's test on a shared App ID and is not listed.
2. **Host.** `hostRoom()` -> `netHost()` -> the transport's `listen()`: the relay deals a code;
   the Steam transport calls the bridge's `createLobby('public', 10)` and writes `patch`, `seed`,
   `state: 'open'` and the host's name into lobby data. The host then sits in the waiting room
   and publishes its list entry once the transport is open (`netHostRoom`), and again on every
   join, leave and at the drop (`state: 'live'`).
3. **Join.** `joinRoom(k)`: **SEED is decided at load**, so a page born on another seed reloads
   itself onto the room's (`?seed=N&join=CODE`, plus `&transport=steam`; the Steam transport does
   the same from `connect()` with `&net=client&lobby=ID`) and joins from boot. Then `netJoin` ->
   `connect()`, and once the transport is open the client sends `hello`.
4. **The host answers** in `netHostHello`: `refuse` on another patch or seed, else the slot - the
   parked one for a returning `uid`, otherwise the first AI slot on the side with fewer PEOPLE
   (`LATE` past `LATE_JOIN_T` into a live match, `FULL` with no AI slot left). The body becomes
   `control: 'remote'` and takes the hello's name, look and class; then `welcome`, a `full`, a
   `roster` to everyone and a fresh list entry. There is no team swap, no ready flag and no kick.
5. **Waiting room.** The class-select screen, which a guest sees without PLAY and with the host's
   name on a frozen plank; the host wears a crown and people a rim. The client builds its bodies
   from the welcome's roster (`initPlayers(roster, slot)`) and updates them in place on each
   `roster`. The host's PLAY count is meant to reach every screen as `count` (broken - Status).
6. **The drop.** The host's count ends in `lockIn` and `beginDrop`, which seats by slot. A client
   never starts anything: the ride arrives as snapshot state (`state.drop`, `aboard`, `dropT`, the
   eagles) and `netClientMode` moves its screen from the title to the ride, to play, to the death
   overlay and back. The leap is an input (`input.jump`), like everything else a hand does.
7. **In match.** The room stays listed as `live`, which is how a late joiner or a dropped client
   finds it. On Steam the host learns who came and went from the lobby's chat updates
   (`LobbyChatUpdate` -> `peer`/`gone`).
8. **End.** The host's `state.over` crosses as `NET.hostOver`, and `netClientMode` turns the
   verdict to the client's own side (`endMatch('won' | 'lost')`); each screen keeps its own
   `state.over`/`state.end`. Leaving (`netLeave`) closes a host's room; a guest walks out of one.

### Joins, leaves, reconnects

- **A client drops.** On `gone` the host flips the body to `control: 'ai'` so the side keeps its
  number, clears its input and parks the slot under the client's `uid` (`NET.parked`) for
  `RECONNECT_GRACE` (60 s). A `hello` with that `uid` inside the grace, while the slot is still a
  bot, lands back in it - `welcome`, `full`, `remote` again. On the relay the client redials on
  its own every `WS_RETRY` (2 s) and says `hello` again on open. Past the grace the `uid` is a
  stranger and joins like one. The `uid` lives in `sessionStorage`, so it survives a reload and
  not a new tab.
- **A mid-match join** is a `hello` from an unknown `uid` while `state.drop` is set: accepted
  into an AI slot on the side with fewer people while `state.elapsed` is under `LATE_JOIN_T`
  (300 s), refused with `LATE` after. The joiner takes over the bot's body as it stands.
- **The host quits or vanishes.** No migration. On the relay the host's socket closing sends every
  client `hostGone` at once (there is no grace timer): a waiting guest goes back to the rooms list
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
   3.50; the ack-keyed ring - 3.51; Steam's unreliable channel and raw bytes over the bridge - 3.54.
   Walk prediction stays deferred.

Releases: every `v*` tag builds the portable zip (desktop/build.js,
.github/workflows/desktop.yml), which the DOWNLOAD tag on the title opens
(`DOWNLOAD_URL`, js/ui/menu.js). A Steam tester's account must own the app.


## Risks

The numbers are stable - code comments cite them (js/boot.js cites risk 3) - so a retired risk keeps
its line.

1. **The fixed step's presentation.** The sim's feel did not change at 1/60; what remains is that
   a screen above 60 Hz repeats a sim state on the frames between steps, and a heavy stall plays
   a moment of slow motion instead of a jump. Render interpolation would remove the first.
2. **The snapshot is never quite complete.** Reflection carries every field, so the live risk is
   the reverse: a name added to `SNAP_SKIP` that a draw pass does read renders stale on a client,
   and a new entity ARRAY (a kind not in `SNAP_KINDS`, a singleton not in `snapSingles`) is not
   carried at all. `netEcho` is the gate: it is a pixel diff, not a play test. There is no schema
   version, so two builds on one `PATCH_TXT` can disagree silently.
3. **Background throttling on the host.** Alt-tab and the whole room freezes. Mitigation: while
   the page is hidden the loop is driven by a worker's clock (`watchHidden`, js/boot.js) and the
   wrapper sets `backgroundThrottling: false`. A client shows a blinking relay pip when its socket
   is down, but nothing when snapshots merely stop arriving.
4. **Edge-triggered inputs under loss.** `dodge`, `jump`, the meals, `useCard`, `ability` and `cmd`
   are one-tick pulses sent ONCE, and the host latches them. Every `in` rides the reliable
   channel on both transports, so none is lost today; moving inputs to an unreliable channel
   would need the edges resent until acked.
5. **Host advantage and trust.** The host sees zero latency and can edit anything; accepted for a
   friends game. The host clamps nothing in a remote input today (`mx`/`my` are copied as sent).
6. **Latency is real.** With no prediction the local walk lags by the round trip plus a snapshot
   interval, on the relay (two hops through Noah's server) more than on Steam. The ease is a
   fixed one interval, not sized from a measured RTT - there is no ping. The mitigation is walk
   prediction, deferred.
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
- Whether the relay or Steam leads at launch on Steam. *The relay leads until the Steam path has
  run against a live Steam.*
