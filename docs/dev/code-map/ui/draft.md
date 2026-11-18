# js/ui/draft.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the draft's rules: the one clock, who may lock what (first come, first served across both sides) | `DRAFT_PICK_T` (the reveal's last stretch: `COUNT_T`, champ-select.js), `draftPickT` (a FIRST MATCH's pick has no clock), `DRAFT`, `draftOpen`, `draftHiding`, `draftWant`, `draftHolder`, `draftAllHeld`, `draftCanLock` | `draft rules` |
| the three positions, a seat's handed out as the draft opens, a seat moving to another (a bot trades, a person keeps theirs); any hero plays any of them | `DRAFT_ACTS`, `posAsk`, `draftSeatRoles`, `draftSwapRole` (the positions: `POSITIONS`, js/sim/player.js, and the match's `p.position`, set by `draftReveal`; the profile's ask: `PROFILE.pos`) | `draft roles` |
| the bots' pick, a bot giving its hero up to a person, the random hero for a seat that never locked | `DRAFT_RANGED`, `heroRanged`, `draftBotPick`, `draftYield`, `draftRandom` | `draft bots` |
| the draft's run: opened by `beginLobby`, the clock (`updateTitle`), the pick, the reveal (at the clock's last `COUNT_T`, or once every seat has locked) and the count, the host's hand on a seat's press, this screen's presses (a hero, the confirm, a position, a look) | `draftStart`, `draftStop`, `draftPickPhase`, `draftReveal`, `draftCount`, `draftUpdate`, `draftCheck`, `draftAct`, `draftShow`, `draftPoint`, `draftConfirm`, `draftRole`, `draftNextRole`, `draftWearSkin`, `draftSkin`, `draftStep` | `draft flow` |
| the host's copy to each guest, cut to its side; a guest taking it in | `draftMsg`, `draftSend`, `draftIn` (the wire: `draft` in netHostStep / the client's poll, js/net/net.js) | `draft wire` |
| what the champ select's look shares from the draft: a hero's head, the confirm plate's word (the look itself: js/ui/select.js) | `HERO_HEAD16`, `heroHead` (a hero's face square: its standing front in a look, around the head), `draftFace`, `draftWord` | `draft pixels` |
