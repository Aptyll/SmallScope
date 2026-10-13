'use strict';
// The eagle's skins. Its art is painted in code: the classic and ironclad
// are Perch's own look (SPRITES.perch, js/sprites/perch.js), the rest the war
// eagles (SPRITES.warBirds, js/sprites/warbirds.js); both feed the skins
// screen's cards (SPRITES.birdSkinIcon).

// The bird's skins: what each one IS for the skins screen (js/ui/skins.js)
// and the purse (js/profile.js) - an id kept in a profile, a name, a rarity
// (SKIN_RARITY, js/ui/skins.js: the card's colour) and a price in coins. The
// first row is free and is what every bird wears by default.
const BIRD_SKINS = [
  { id: 'classic', name: 'CLASSIC', rarity: 'common', price: 0 },
  { id: 'helm', name: 'GREAT HELM', rarity: 'common', price: 100 },
  { id: 'beak', name: 'BEAK GUARD', rarity: 'common', price: 100 },
  { id: 'horned', name: 'HORNED', rarity: 'rare', price: 200 },
  { id: 'crested', name: 'CRESTED', rarity: 'rare', price: 200 },
  { id: 'ironclad', name: 'IRONCLAD', rarity: 'epic', price: 400 },
];
