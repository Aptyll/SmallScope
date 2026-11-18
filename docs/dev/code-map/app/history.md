# js/app/history.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| a match filed at the whistle with all its seats (a match filed before 0.962 has ten: `SEATS_EVER`, js/app/builds.js), and what a record holds | `historyNote` (from `endMatch`, js/sim/player.js), `historyMode`, `MH_KEEP` (the store: `PROFILE.history`/`putHistory`, js/app/profile.js) | `history` |
| a record out of storage, checked | `historyClean`, `MH_NAME`, `MH_MODES`, `MH_NUM_MAX`, `MH_AT` | `history` |
| what the profile reads off the records | `historyList`, `historyYou`, `historySideKills`, `historyHeroes`, `historyMates`, `historyAgo`, `historyKda` | `history` › `what the screens read off it` |
| a player card (what a profile tells its party), the people this screen met, one person's card (the global ladder's, else the one heard) | `cardMine`, `profilePic`, `peopleClean`, `peopleNote`, `personCard`, `MH_CARD_REC`, `MH_CARD_BADGES` (the card's `bd`: badge ids, `pfBadgeIds`; `rn`: ranked matches, `PROFILE.rankedN`), `MH_PEOPLE_KEEP` (the wire: the hello's `card`, `NET.cards` in `roomInfo`, js/net/net.js; the store: `PROFILE.people`/`putPeople`) | `history` › `cards` |
