# js/ui/draft.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the draft's rules: the clocks, how many bans, who may lock what, a team's bans off its votes | `DRAFT_BAN_T`/`DRAFT_PICK_T`/`DRAFT_BAN_MANY`/`DRAFT_KEEP`, `DRAFT`, `draftOpen`, `draftHiding`, `draftBansPerTeam`, `draftWant`, `draftSideFull`, `draftCanLock`, `draftTeamBans` | `draft rules` |
| the five positions, a seat's handed out as the draft opens, a seat moving to another (a bot trades, a person keeps theirs); any hero plays any of them | `DRAFT_ACTS`, `posAsk`, `draftSeatRoles`, `draftSwapRole` (the positions: `POSITIONS`, js/sim/player.js, and the match's `p.position`, set by `draftReveal`; the profile's ask: `PROFILE.pos`) | `draft roles` |
| the bots' ban and pick, and a bot giving its hero up to a person | `DRAFT_RANGED`, `heroRanged`, `draftBotBan`, `draftBotPick`, `draftYield` | `draft bots` |
| the draft's run: opened by `beginLobby`, the clock (`updateTitle`), the pick phase, the reveal and the count, the host's hand on a seat's press, this screen's presses (a hero, the confirm, a position, a look) | `draftStart`, `draftStop`, `draftPickPhase`, `draftReveal`, `draftCount`, `draftUpdate`, `draftCheck`, `draftAct`, `draftShow`, `draftPoint`, `draftConfirm`, `draftRole`, `draftNextRole`, `draftWearSkin`, `draftSkin`, `draftStep` | `draft flow` |
| the host's copy to each guest, cut to its side; a guest taking it in | `draftMsg`, `draftSend`, `draftIn` (the wire: `draft` in netHostStep / the client's poll, js/net/net.js) | `draft wire` |
| what the champ select's look shares from the draft: a hero's head, the ban's stroke, the confirm plate's word (the look itself: js/ui/select.js) | `DRAFT_RED`, `HERO_HEAD16`, `heroHead` (a hero's face square: a named hero's own sprite, else the 48 px model's crop), `draftFace`, `draftSlash`, `draftWord` | `draft pixels` |
