# js/ui/friends.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the list's poll, rich presence, the played-with mark, what a row's click does | `FR_*`, `FRIENDS`, `friendsBridge`, `friendsLobby`, `frGroup`, `frPatch`, `friendsTick` (its caller: `update`, sim.js), `friendsPresence`, `friendsPlayed`, `friendAct`, `friendDo` (the bridge: desktop/steam-friends.js, desktop/main.js) | `friends` |
| the column beside the party's seats: layout, hits, keys, scroll, pixels | `friendsLayout`, `friendsScrollBy`/`friendsOver` (the wheel: input.js), `friendsHit`/`friendHeadDo` (from `roomHit`/`roomDo`), `friendsKey` (from `roomKey`), `frBmp`, `drawFriends` (from `renderRoom`) | `friends` › `the column` |
| a friend's invite card on the title | `friendInvited` (the bridge's `invite` event), `friendCardRect`, `friendCardHit`, `friendCardClick` (from `menuClick`), `drawFriendCard` (from the title's render, menu.js) | `friends` › `the card` |
