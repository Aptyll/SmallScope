# js/app/board.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the global ladder: what a Steam leaderboard row carries (the rating, the card packed into its details) and how it is read back and checked | `boardPack`, `boardUnpack` (through `peopleClean`, js/app/history.js), `boardHash`, `boardText`, `boardTextAt`, `BOARD_V`, `BOARD_TXT` | `board` |
| posting your card and reading the board while the ladder is in view, and what the screens read off it | `boardSync` (from `updateTitle`, js/ui/menu.js, and `endMatch`), `boardList` (read by `pfLadder`, js/ui/profile-tabs.js), `boardCard` (read by `personCard`), `boardBridge`, `board`, `BOARD_TOP`, `BOARD_AROUND`, `BOARD_STALE`, `BOARD_RETRY` (the Steam side: desktop/steam-board.js, `steam:boardPost`/`steam:boardRead` in desktop/main.js) | `board` › `the board's rows` |
