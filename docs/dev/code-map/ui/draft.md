# js/ui/draft.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the draft's rules: the clocks, how many bans, who may lock what, a team's bans off its votes | `DRAFT_BAN_T`/`DRAFT_PICK_T`/`DRAFT_BAN_MANY`/`DRAFT_KEEP`, `DRAFT`, `draftOpen`, `draftHiding`, `draftBansPerTeam`, `draftWant`, `draftSideFull`, `draftCanLock`, `draftTeamBans` | `draft rules` |
| the bots' ban and pick, and a bot giving its hero up to a person | `DRAFT_RANGED`, `heroRanged`, `draftBotBan`, `draftBotPick`, `draftYield` | `draft bots` |
| the draft's run: opened by `beginLobby`, the clock (`updateTitle`), the pick phase, the reveal and the count, the host's hand on a seat's press, this screen's presses | `draftStart`, `draftStop`, `draftPickPhase`, `draftReveal`, `draftCount`, `draftUpdate`, `draftCheck`, `draftAct`, `draftShow`, `draftPoint`, `draftConfirm`, `draftStep` | `draft flow` |
| the host's copy to each guest, cut to its side; a guest taking it in | `draftMsg`, `draftSend`, `draftIn` (the wire: `draft` in netHostStep / the client's poll, js/net/net.js) | `draft wire` |
| the pixels: the clock, the phase's word and the ban wells; the word at the foot; the roster frames and both panels | `DRAFT_WELL`/`DRAFT_TOP`/`DRAFT_RED`/`DRAFT_MUTE`, `draftFace`, `draftSlash`, `drawDraftTop`, `draftWord`, `drawLobbyCard`, `drawLobbyRosters` | `draft pixels` |
