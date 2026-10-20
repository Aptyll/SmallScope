# js/net/snapshot.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the match's state as one plain object: which fields are skipped, which singletons ride | `SNAP_SKIP`, `SNAP_STATE` | `snapshot` |
| network ids: a stable id per moving entity, refs as tokens, the pack and its inverse, and a link to a body not sent yet put back when it is | `snapNids`, `snapMaps`, `snapNid`, `snapNidSet`, `snapKindOf`, `snapToken`/`snapDeref`, `packEnt`, `pack`/`unpack`/`snapResolve`, `snapPending`/`snapDerefAt`/`snapPendRetry` | `snapshot` › `network ids` |
| building the full form and weighing it | `snapBuild`, `snapSize` | `snapshot` › `build` |
| writing a full form back into the world | `snapApply` | `snapshot` › `apply` |
| the ack-keyed delta: the shadow, the history ring, the cut from a base, the in-place apply | `HIST_KEEP`, `snapShadow`, `snapShadowReset`, `snapSame`, `snapFieldDiff`, `snapHistoryPush`, `snapTileScan` (a slice of the tiles; `netHostFlush` runs one each step between flushes), `snapHistoryAt`, `snapDeltaFrom`, `snapBuildDelta`, `snapTileSame`, `snapApplyDelta`, `snapAssign`/`SNAP_MERGE` | `delta` |
| each side sent only what it sees: the hidden ids per tick, a hidden player's stub and the fields it keeps, one kind's cut for a side, a body sent whole after the fog, a client's build for its self-check | `SNAP_FOG_KEEP`, `SNAP_FOG_KINDS`, `snapFogHid`, `snapFogStub`, `snapFogCut`, `snapFogWhole`, `snapFogCamps` (the camps: a side's own `seen`, no clock), `snapBuildSeen` (`snapBuild(team)`, `snapDeltaFrom(h, base, team)`) | `fog` (the rule: js/sim/fog.js) |
| the bytes: the binary form, the shared key dictionary, the quantized positions and velocities | `SNAP_Q`, `SNAP_QPOS`, `SNAP_QUANT`, `snapQable`, `snapQi`, `snapQv`, `ENC_TAG`, `encDict`, `snapEncode`, `snapDecode` | `encode` |
| the wire's proofs: the echo through the bytes, a run sent as deltas, the compare and its one tolerance | `snapBlank`, `snapFrame`, `snapCompare`, `snapCompareLoose`, `snapQuantize`, `netEcho`, `netEchoRun`, `netDeltaRun` | `the echo harness` (how to run them: [checklists](../../checklists.md#verifying-a-change); the design: [pvp-architecture](../../../pvp-architecture.md)) |
