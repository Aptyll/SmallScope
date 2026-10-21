# js/ui/skins.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the catalogue: the navbar's categories, the rarity colours, the scout table (placeholders but the IRON HERO, whose `body` names its sprites), the placeholder weapon / trail tables, a bought skin's profile key | `SKIN_TABS`, `SKIN_RARITY`, `SCOUT_SKINS`, `WEAPON_SKINS`, `TRAIL_SKINS`, `skinRow`, `skinKey`, `skinHas`, `skinWorn` | `skins` › `the catalogue` (the eagle's table: `BIRD_SKINS`, js/sprites/eagle.js; the purse: `PROFILE.coins`/`buy`/`wear`, profile.js) |
| which skin a bird wears on this screen (your company's bird wears yours, the other company's the free one) | `birdSkinFor` (asked by `drawEagle`, js/sim/eagle.js), `birdSkinRow`, `skinOwned` | `skins` › `the catalogue` |
| the looks this profile wears on each hero, as `p.skins` carries them (the hello sends it) | `profileHeroSkins` (read by `applyProfile`, player.js, and the hello, net.js) | `skins` › `the catalogue` |
| which body a player wears on this screen (only you wear your scout skin; everyone else the class body) | `scoutBody` (asked by `drawPlayer`, js/draw/bodies.js), `SK_TAB_SCOUT` | `skins` › `the catalogue` |
| what a finished match pays | `COINS_MATCH`, `COINS_WIN`, `payMatchCoins` (its caller: `endMatch`, player.js) | `skins` › `the catalogue` |
| a card's picture: the eagle's own icon (`SPRITES.birdSkinIcon`), a scout body's own `icon`, a placeholder washed in its tint, a trail's streak | `skinArt` (the eagle's: `SPRITES.birdSkinIcon`, perch.js), `washed`, `trailArt`, `SK_ART_MAX` | `skins` › `the pictures` |
| the coin tag top-right of the title | `coinTagRect`, `overCoinTag`, `drawCoinTag`, `SK_COIN` | `skins` › `the coin tag` |
| the skins screen: the navbar, the grid of cards, a press that wears, picks or buys, the short purse's shake, the buy's flash, the keys | `SK_*`, `skinsLayout`, `skinsTab`, `beginSkins`/`leaveSkins`, `skinsHit`, `skinPress`, `skinsKey`, `skinsClick`, `updateSkins`, `drawSkinTab`, `drawSkinCard`, `renderSkins` | `skins` › `the screen` |
