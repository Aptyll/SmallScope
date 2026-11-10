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

  // ---- the hover tooltip (js/ui/tooltip.js): a rank row's label is tip.<rank key>
  'tip.dmg': 'DAMAGE',
  'tip.shove': 'SHOVE DAMAGE',
  'tip.cut': 'FRONT DAMAGE CUT',
  'tip.slow': 'SLOW',
  'tip.slowT': 'SLOW FOR',
  'tip.stun': 'STUN',
  'tip.root': 'ROOT',
  'tip.up': 'KNOCK UP',
  'tip.t': 'LASTS',
  'tip.ward': 'DAMAGE CUT',
  'tip.chop': 'CHOP DAMAGE',
  'tip.armor': 'ARMOR',
  'tip.ten': 'TENACITY',
  'tip.heal': 'HEALS % MAX HEALTH',
  'tip.mark': 'MARKED FOR',
  'tip.shieldHp': 'SHIELD % MAX HEALTH',
  'tip.burn': 'BURN A SECOND',
  'tip.walk': 'WALKS FASTER',
  'tip.markDmg': 'MARKED HIT DAMAGE',
  'tip.hp': 'HEALS',
  'tip.wolfHp': 'WOLF HEALTH',
  'tip.hps': 'HEALS A SECOND',
  'tip.shield': 'SHIELD',
  'tip.as': 'ATTACK SPEED',
  'tip.shot': 'DAMAGE X',
  'tip.basicAttack': 'BASIC ATTACK',
  'tip.fullCharge': 'FULL CHARGE',
  'tip.betweenHits': 'BETWEEN HITS',
  'tip.reach': 'REACH',
  'tip.level': 'LEVEL',
  'tip.respawn': 'RESPAWN',
  'tip.carried': 'CARRIED',
  'tip.heroAbility': '{hero} ABILITY',
  'tip.cooldown': 'COOLDOWN',
  'tip.heroLevel': 'HERO LEVEL',
  'tip.gold': 'GOLD',
  'tip.purse': 'PURSE',
  'tip.cooldownIs': 'COOLDOWN {s}',
  // ---- the shop (js/ui/shop.js): an item's own name and passive stay on its entry
  'shop.rec': 'RECOMMENDED',
  'shop.all': 'ALL',
  'shop.start': 'START',
  'shop.games': '{n} GAMES',
  'shop.core': 'CORE',
  'shop.mostWins': 'MOST WINS',
  'shop.mostPicked': 'MOST PICKED',
  'shop.boots': 'BOOTS',
  'shop.alsoBuilt': 'ALSO BUILT',
  'shop.then': 'THEN',
  'shop.pick': 'PICK',
  'shop.win': 'WIN',
  'shop.buildsInto': 'BUILDS INTO',
  'shop.onePair': 'ONE PAIR',
  'shop.potionHeal': '+{hp} HEALTH OVER {s}S',
  'shop.buy': 'BUY',
  'shop.sell': 'SELL',
  'shop.sellsFor': 'SELLS FOR',
  'shop.goldN': '{n} GOLD',
  'shop.price': 'PRICE',
  'shop.pickRate': 'PICK RATE',
  'shop.winRate': 'WIN RATE',
  'shop.over': 'OVER',
  'shop.potion': 'POTION',
  'shop.basic': 'BASIC',
  'shop.epic': 'EPIC',
  'shop.legend': 'LEGENDARY',

  // ---- the settings slab (js/ui/panels.js): a row, tab or option label is a key in SET_TABS
  'set.game': 'GAME',
  'set.hudRail': 'TOP BAR SIZE',
  'set.map': 'MINIMAP SIZE',
  'set.hud': 'BOTTOM BAR SIZE',
  'set.shake': 'SCREEN SHAKE',
  'set.info': 'INFO DISPLAY',
  'set.cursor': 'CURSOR',
  'set.pixel': 'PIXEL',
  'set.browser': 'BROWSER',
  'set.tooltip': 'TOOLTIP',
  'set.followsPointer': 'FOLLOWS POINTER',
  'set.bottomLeft': 'BOTTOM LEFT',
  'set.details': 'ABILITY DETAILS',
  'set.always': 'ALWAYS',
  'set.myTeam': 'MY TEAM',
  'set.alwaysBlue': 'ALWAYS BLUE',
  'set.asDealt': 'AS DEALT',
  'set.video': 'VIDEO',
  'set.quality': 'QUALITY',
  'set.low': 'LOW',
  'set.medium': 'MEDIUM',
  'set.high': 'HIGH',
  'set.fpsCap': 'FPS CAP',
  'set.unlimited': 'UNLIMITED',
  'set.clouds': 'CLOUD SHADOWS',
  'set.rays': 'SUN SHAFTS',
  'set.stars': 'ICE STARS',
  'set.snow': 'SNOWFALL',
  'set.vignette': 'VIGNETTE',
  'set.colourBlind': 'COLOUR BLIND',
  'set.off': 'OFF',
  'set.protanopia': 'PROTANOPIA / DEUTERANOPIA',
  'set.tritanopia': 'TRITANOPIA',
  'set.achromatopsia': 'ACHROMATOPSIA',
  'set.audio': 'AUDIO',
  'set.master': 'MASTER',
  'set.music': 'MUSIC',
  'set.sounds': 'SOUNDS',
  'set.hold': 'HOLD {key}',
  'set.controls': 'CONTROLS',
  'set.reset': 'RESET',
  'set.close': 'CLOSE',
  'set.surrender': 'SURRENDER',
  'set.leave': 'LEAVE',
  'set.on': 'ON',
  'set.title': 'SETTINGS',

  // ---- the CONTROLS page (js/ui/panels.js): a fixed key and its word in KEY_ROWS (a bound action's verb is on KEY_ACTIONS)
  'ctl.wasd': 'WASD',
  'ctl.click': 'CLICK',
  'ctl.move': 'MOVE',
  'ctl.abilities': 'ABILITIES',
  'ctl.fire': 'FIRE',
  'ctl.rmb': 'RMB',
  'ctl.ping': 'PING',
  'ctl.items': 'ITEMS',
  'ctl.esc': 'ESC',
  'ctl.settings': 'SETTINGS',
  'ctl.scroll': 'SCROLL',
  'ctl.zoom': 'ZOOM',
  'ctl.f3': 'F3',
  'ctl.info': 'INFO',
  'ctl.dot': '.',
  'ctl.hitbox': 'HITBOX',
  'ctl.moveAct': 'MOVE / ACT',
  'ctl.holdRmb': 'HOLD RMB',
  'ctl.follow': 'FOLLOW',

  // ---- the hero pick (js/ui/select.js): a hero's and a position's names stay on their entries
  'pick.ban': 'BAN A HERO!',
  'pick.pick': 'PICK YOUR HERO!',
  'pick.loadout': 'PREPARE YOUR LOADOUT!',
  'pick.banning': 'BANNING...',
  'pick.picking': 'PICKING...',
  'pick.locked': 'LOCKED IN',
  'pick.practice': 'PRACTICE TOOL',
  'pick.quick': 'QUICKPLAY',
};

// the word for a key, with each {slot} filled from vars. An unknown key
// prints as itself so a miss shows on screen rather than as a blank, but the
// lint never lets one ship.
function tr(key, vars) {
  const s = TEXT[key];
  if (s === undefined) return key.toUpperCase();
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k]))) : s;
}

// a line of words broken into lines no wider than maxW px at scale 1, at the
// spaces: the one word-wrap, so a longer line (or a translation) still fits its box
function wrapText(text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (pixelTextWidth(next) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
