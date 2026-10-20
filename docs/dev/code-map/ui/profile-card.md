# js/ui/profile-card.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the name tag bottom-left of the title screen | `profileTagRect`, `overProfileTag`, `drawProfileTag` (the player that wears the name: `applyProfile`, player.js) | `profile card` › `the name tag` |
| the profile card: its layout, the name field (select, type, Enter keeps, Esc or a click off closes), the ledger | `PC_W`/`PC_H`, `profileLayout`, `beginProfile`/`leaveProfile`, `profileCommit`, `profileHit`, `profileKey`, `profileClick`, `updateProfile`, `renderProfileCard`, `NAME_SHAKE_T` | `profile card` › `the card` (the store: `PROFILE`, profile.js) |
| the plate grammar, the ledger and its icon grids | `drawWell`, `drawLedger`, `PC_ICON_PAL` and the `PC_*` grids | `profile card` › `pixels` |
