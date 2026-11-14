# js/ui/loadout.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the champ select's three wells and the picker over one: where they stand, what the pointer is on, a press, ESC | `LO_*`, `loLayout`, `loOptions`, `loadoutHit` (from `lobbyHit`), `loadoutClick` (from `lobbyClick`), `loadoutKey` (from `lobbyKey`), champ-select.js | `loadout picks` |
| this screen's picks on the hero it stands behind, and sending them to the host | `selLoadout`, `draftLoadSend` (from `draftConfirm` and `draftIn`, js/ui/draft.js) | `loadout picks` |
| the cards a hover raises, in champ select (standing in one place, left edge at the brief's first ability well and foot over the brief, in the air beside the grid's last row; over the well or the open picker where the view has no brief; never on LOCK IN) and on the HUD | `loadoutTip`, `tipTrick`, `tipCalling`, `TRICK_POW`, `CALLING_POW` (from `tipAt`, js/ui/tooltip.js) | `loadout picks` |
| a pick's icon, and the pixels | `loIcon`, `drawLoWell`, `drawLoadoutPicks` (from `renderLobby`, js/ui/champ-select.js) | `loadout picks` |
