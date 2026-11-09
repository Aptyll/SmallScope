'use strict';
// ------------------------------------------------------------ the text table
// Every word the game prints for its own screens lives here, once, by key:
// tr('end.lost') is what the loss screen says. One place to read the game's
// voice, one place to fix a word, and the shape a translation drops into
// later (a second table of the same keys). docs/dev/rendering/text.md says
// what goes in and what stays out.
//
// What stays out: a thing's own name and blurb stay on its entry (CLASSES,
// ITEMS, OBJECTS, STRUCTS: "what a type is lives in its entry"), and the
// patch notes are history (PATCH_NOTES, js/ui/menu.js). Player names are data.
//
// Keys are `screen.thing`, lowercase. A value is drawn by the pixel font, so
// it is CAPITALS from the font's alphabet (GLYPHS, js/app/font.js: no long
// dash, no ampersand, no brackets). A number or a name goes in through a
// {slot}, never by gluing strings round the word, so another language can
// move it. app/check-text.js fails an unknown key, a key nothing uses, a
// character the font lacks, and a loose word in a file that has moved in.
const TEXT = {
  // ---- the end of a match (js/ui/screens.js, js/ui/endscreens.js)
  'end.lost': 'YOUR EAGLE WAS DRIVEN OFF',
  'end.lostSub': 'THE MATCH IS OVER',
  'end.hostLeft': 'THE HOST LEFT',
  'end.hostLeftSub': 'THE MATCH ENDS HERE',
  'end.respawn': 'RESPAWNING IN {s}S',
  'end.victory': 'VICTORY',
  'end.defeat': 'DEFEAT',
  'end.noResult': 'NO RESULT',
  'end.spectate': 'SPECTATE',
  'end.keepPlaying': 'KEEP PLAYING',
  'end.lobby': 'LOBBY',
  'end.back': 'BACK',

  // ---- the post-game stats (js/ui/lobby.js)
  'score.stats': 'STATS',
  'score.graphs': 'GRAPHS',
  'score.combat': 'COMBAT',
  'score.kda': 'K/D/A',
  'score.farm': 'FARM',
  'score.level': 'LEVEL',
  'score.streak': 'BEST STREAK',
  'score.multi': 'BEST MULTI-KILL',
  'score.cc': 'CROWD CONTROL',
  'score.dealt': 'DAMAGE DEALT',
  'score.toHeroes': 'TO HEROES',
  'score.toEagle': 'TO THE EAGLE',
  'score.toStructs': 'TO STRUCTURES',
  'score.toBeasts': 'TO BEASTS',
  'score.total': 'TOTAL',
  'score.taken': 'TAKEN AND HEALED',
  'score.fromHeroes': 'FROM HEROES',
  'score.fromBeasts': 'FROM BEASTS',
  'score.healed': 'HEALED',
  'score.gold': 'GOLD',
  'score.earned': 'EARNED',
  'score.spent': 'SPENT',
  'score.hunted': 'BEASTS HUNTED',

  // ---- the death recap (js/ui/recap.js): a blow's kind, and the world's hitters
  'recap.attacks': 'ATTACKS',
  'recap.abilities': 'ABILITIES',
  'recap.other': 'OTHER',
  'recap.tower': 'TOWER',
  'recap.wave': 'WAVE',
  'recap.wolf': 'WOLF',
  'recap.bear': 'BEAR',
  'recap.fire': 'FIRE',
  'recap.orca': 'ORCA',
  'recap.ice': 'ICE',
  'recap.creek': 'CREEK',
  'recap.tackle': 'A TACKLE',
  'recap.eagle': 'EAGLE',
  'recap.roll': 'ROLL',
  'recap.burn': 'BURN',

  // ---- the TAB scoreboard (js/ui/panels.js)
  'board.title': 'SCOREBOARD',
  'board.player': 'PLAYER',
  'board.lvl': 'LVL',
  'board.gold': 'GOLD',
  'board.kda': 'K/D/A',
  'board.farm': 'FARM',
  'board.out': 'OUT',          // a player out for good
  'board.wait': '{s}S',        // a player's respawn wait
};

// the word for a key, with each {slot} filled from vars. An unknown key
// prints as itself so a miss shows on screen rather than as a blank, but the
// lint never lets one ship.
function tr(key, vars) {
  const s = TEXT[key];
  if (s === undefined) return key.toUpperCase();
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k]))) : s;
}
