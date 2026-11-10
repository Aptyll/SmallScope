# js/ui/skins.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the catalogue: the navbar's tabs (one per hero in `CLASSES` order, built off its row in the hero art registry: `heroArtOf`, js/sprites/hero-art.js), the rarity colours, a bought skin's profile key | `SKIN_TABS`, `SKIN_RARITY`, `skinRow`, `skinKey`, `skinHas`, `skinWorn` | `skins` › `the catalogue` |
| the looks this profile wears on each hero, as `p.skins` carries them (the hello sends it) | `profileHeroSkins` (read by `applyProfile`, player.js, and the hello, net.js) | `skins` › `the catalogue` |
| the slots the game no longer sells (the old HERO and WEAPON tints, the TRAIL streaks, the EAGLE skins) and what each skin cost, refunded once at boot | `SKIN_RETIRED`, `SKIN_RETIRED_SLOTS` (the refund: `PROFILE.refundRetired`, profile.js, called from boot.js) | `skins` › `the catalogue` |
| what a finished match pays | `COINS_MATCH`, `COINS_WIN`, `payMatchCoins` (its caller: `endMatch`, player.js) | `skins` › `the catalogue` |
| a card's picture: the hero standing in that look | `skinArt` (`SPRITES.champLook`, js/sprites/characters.js), `SK_ART_MAX` | `skins` › `the pictures` |
| the coin tag top-right of the title | `coinTagRect`, `overCoinTag`, `drawCoinTag`, `SK_COIN` | `skins` › `the coin tag` |
| the skins screen: the navbar, the grid of cards, a press that wears, picks or buys, the short purse's shake, the buy's flash, the keys | `SK_*`, `skinsLayout`, the scrolling tab row (`skTabs`, `skinTabsFrom`, `skinsScrollBy`, `skinsTabShow`, `skinsTabsOver`, its wheel in input.js), `skinsTab`, `beginSkins`/`leaveSkins`, `skinsHit`, `skinPress`, `skinsKey`, `skinsClick`, `updateSkins`, `drawSkinTab`, `drawSkinCard`, `renderSkins` | `skins` › `the screen` |
