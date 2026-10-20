# js/net/net.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| which role this screen plays, the transport interface and the loopback solo speaks through, who counts as a person, whether another screen shares the match (then nothing pauses it) | `NET`, `SNAP_EVERY`/`LATE_JOIN_T`/`RECONNECT_GRACE`/`IN_QMAX`/`IN_QWIN`, `isHuman`, `netShared`, `loopbackTransport`, `netSetup` | `net roles` |
| which relay or transport a screen uses, the three doors the title opens (host, join, leave), a room's listing and the roster to every peer | `RELAY_DEFAULT`, `netRelay`, `netSteam`, `netTransportFor`, `netHost`, `netJoin`, `netLeave`, `netHostRoom`, `netHostRoster`, `netClientRoster` | `net roles` |
| a host's half: inputs in (queued, one per peer per step, a press latched), HELLO / leave, the roster, the snapshot flush and the tile slices between flushes, the side each peer is cut for and the cosmetics it may see | `netHostStep`, `netInEdges`, `netHostHello`, `netHostFull`, `netFogTeam`, `netEvSeen`, `netHostLeave`, `netRoster`, `netHostFlush` | `host` |
| the party's moves: the page (seats or hero select) turned on every screen, a person shown out, a hero picked (a guest's through the leader) | `seatsOpen`, `netPhase`, `netClientPhase`, `seatKick`, `seatPick`, `netPick`, `NET.kicked`, `NET.phase` | `seats` |
| the party's READY list, bot level, mode, code, ratings and pings, sent with every roster | `roomInfo`, `roomInfoIn`, `seatReady`, `netReady`, `PING_EVERY`, `PING_EASE`, `pingsHost`, `pongIn`, `NET.ready`, `NET.pings`, `NET.aiLevel`, `NET.mode`, `NET.code`, `NET.ranks`, `NET.botLv` | `room info` |
| a client's half: its input out, welcome / full / snap in, the screen the local body calls for | `netClientStep`, `netClientHello`, `netClientWelcome`, `netClientApply`, `netClientMode` | `client` |
| a client's lifetime stats, read off its own snapshot body (what the step gates on `p === player`) | `netClientStats`, `NET.was` | `client` |
| a client easing every moved body to where the host put it, over the time deltas take to arrive | `LERP_SNAP`, `netClientApplyDelta`, `netClientLerp`, `EASE_MAX`, `netEaseClock` | `client` |
| a client's own walk ahead of the host: the inputs kept, the step, the host's word restored before a snapshot and the unseen inputs walked again after it, the correction bled off | `PRED`, `PRED_FIELDS`/`PRED_KEEP`/`PRED_EASE`/`PRED_SNAP`, `netPredictable`, `netPredictWalk`, `netPredictStep`, `netPredictRestore`, `netPredictMend` | `prediction` |
| the mid-match proofs: a client checking itself against the host's full form, a host throwing away a share of its sends | `NET.verify`/`VERIFY_EVERY`, `NET.lossOut` | `net roles` (the `NET` literal), `host` and `client` (the compare: `snapCompareLoose`, snapshot.js) |
