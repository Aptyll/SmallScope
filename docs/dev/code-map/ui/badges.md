# js/ui/badges.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| RANKED's tiers: a rating to FLINT, IRON, BRONZE, SILVER, GOLD or CRYSTAL | `RANK_TIERS`, `RANK_TIER_LOW`, `RANK_TIER_W`, `rankTier` (the rating: `PROFILE.rank`, moved by `rankResult`, js/ui/rooms.js) | `badges` › `the tiers` |
| the badges' pixels: a tier's shield, the founder's feather | `BADGE_PX`, `BADGE_METAL`, `RANK_ART`, `FOUNDER_ART`, `badgeCanvas`, `drawRankBadge`, `drawFounderBadge` | `badges` › `the art` |
| who wears what: yours, or another person's off their card | `wearsFounder` (`PROFILE.founder`, or `founder` in a card's `bd`), `wearsRank` (`PROFILE.rankedN`, or a card's `rn`), `badgeRating`, the two `PF_BADGES` entries | `badges` › `who wears what` |

Where they show: under a profile's name (`PF_BADGES`, js/ui/profile.js), in the OVERVIEW's RANKED box
(`pfRatingMark`, js/ui/profile-tabs.js) and on a party seat (`drawRoomSeat`, js/ui/rooms.js: the
feather in the corner, the tier before a RANKED rating). The founder's purchase date comes from Steam
(`steamBought`, js/app/profile.js; desktop/steam-apps.js).
