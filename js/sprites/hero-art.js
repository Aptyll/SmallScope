'use strict';
// ------------------------------------------------------------ hero art
// The one registry of what a hero looks like, keyed by the hero's id: the
// `id` on its CLASSES row (js/sim/player.js), which is also the profile's skin
// slot and the key its look rides the hello under (p.skins). Each hero's own
// sprite file registers once, at its end, with heroArt(id, art):
//   looks   its looks, the free one first (`grids`, `motion`, optional `pal`, and the
//           loose `cloth` boxes and skirt `hem` rows that hang behind a stop, heroCloth):
//           every body (champLook), the skins screen's tab, the draft's strip
//   pal     the paint under every look, over the team's coat
//   glyph   the skins navbar's 8x8 tab glyph ('w' lit)
//   emblem  the 12x12 emblem (the rail's chips, the rooms, tooltips) in
//           AB32_PAL's letters (js/draw/abilities.js)
// Readers ask heroArtOf(cls) (player.js) and never a hero's own globals, so a
// new hero, or a new look on one, is its own file plus its CLASSES row.
// player.js checks at load that every row has art and every art a row.
const HERO_ART = {};
const HERO_ART_KEYS = ['looks', 'pal', 'glyph', 'emblem'];
function heroArt(id, art) {
  if (HERO_ART[id]) throw new Error('hero-art.js: ' + id + ' is registered twice');
  for (const k of HERO_ART_KEYS) if (!art[k]) throw new Error('hero-art.js: ' + id + ' has no ' + k);
  if (!art.looks.length || art.looks[0].price) throw new Error('hero-art.js: ' + id + "'s first look must be free");
  HERO_ART[id] = Object.assign({ id }, art);
}
