# js/app/history.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a match filed at the whistle with all ten seats, and what a record holds | `historyNote` (from `endMatch`, js/sim/player.js), `historyMode`, `MH_KEEP` (the store: `PROFILE.history`/`putHistory`, js/app/profile.js) | `history` |
| a record out of storage, checked | `historyClean`, `MH_NAME`, `MH_MODES`, `MH_NUM_MAX`, `MH_AT` | `history` |
| what the profile reads off the records | `historyList`, `historyYou`, `historySideKills`, `historyHeroes`, `historyMates`, `historyAgo`, `historyKda` | `history` › `what the screens read off it` |
| a player card (what a profile tells its party), the people this screen met | `cardMine`, `profilePic`, `peopleClean`, `peopleNote`, `MH_CARD_REC`, `MH_PEOPLE_KEEP` (the wire: the hello's `card`, `NET.cards` in `roomInfo`, js/net/net.js; the store: `PROFILE.people`/`putPeople`) | `history` › `cards` |
