# js/ui/friends.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the list's poll, rich presence, the played-with mark, what a row's click does | `FR_*`, `FRIENDS`, `friendsBridge`, `friendsLobby`, `frGroup`, `frPatch`, `friendsTick` (its caller: `update`, sim.js), `friendsPresence`, `friendsPlayed`, `friendAct`, `friendDo` (the bridge: desktop/steam-friends.js, desktop/main.js) | `friends` |
| the hub's FRIENDS panel (Steam's friends; empty off Steam): layout, hits, keys, scroll, pixels | `SOCIAL_*`, `socialAddRect`, `friendsLayout`, `friendsScrollBy`/`friendsOver` (the wheel: input.js), `friendsHit`/`friendHeadDo` (from `roomHit`/`roomDo`), `friendsKey` (from `roomKey`), `frBmp`, `frStatus`, `drawFriendFace`, `drawSocial` (from `renderRoom`), `drawFriends` | `friends` › `the panel` |
| a friend's invite card over any screen before a match | `friendInvited` (the bridge's `invite` event), `friendCardRect`, `friendCardHit`, `friendCardClick` (from `menuClick`), `drawFriendCard` (from the title's render, menu.js) | `friends` › `the card` |
