# js/ui/profile.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the name tag bottom-left of the title (the picture's face, the name, the quill) | `profileTagRect`, `overProfileTag`, `drawProfileTag` (the player that wears the name: `applyProfile`, player.js) | `profile` › `the name tag` |
| the profile screen: its rects, whose profile is open, in and out, tabs | `PF_*`, `profileLayout`, `pfBody`, `pfCard` (someone else's, `menu.pfWho`), `beginProfile`/`leaveProfile`, `pfSetTab`, `pfOpenWho` | `profile` › `layout`, `in and out` |
| what the pointer is on, the clicks, the keys, the wheel | `profileHit` (the tabs' bodies: `profileTabHit`, profile-tabs.js), `profileClick`, `profileKey` (from input.js), `profileScrollBy`, `updateProfile`, `pfHot` | `profile` › `what the pointer is on` |
| the name field (select, type, Enter keeps, Esc drops a refused edit) | `pfNameKeep`, `profileCommit`, `drawNameField`, `NAME_SHAKE_T` (the store: `PROFILE.setName`, js/app/profile.js) | `profile` |
| the search over the people met, the picture picker | `pfFound`, `drawProfileFound`, `pfPickRect`, `pfPickCells`, `drawProfilePicker` (`PROFILE.setPic`) | `profile` › `the search`, `the picker` |
| the column, the top bar, a face by hero name, the whole screen | `drawProfileColumn`, `pfMateRects`, `pfBackRect`, `drawProfileBar`, `pfFace`, `pfRim`, `renderProfile` | `profile` › `pixels shared by every tab` |

How it looks and why: [the profile](../../rendering/main-menu-title.md#the-profile).
