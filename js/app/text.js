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
  // how a 1V1 ended (onevoneWhy, js/sim/onevone.js): under either headline, and the feed's line
  'onevone.strike': 'FIRST STRIKE',
  'onevone.farm': '{n} SOLDIERS',
  'onevone.tower': 'FIRST TOWER',
  'onevone.line': '{why}: THE {side} SIDE WINS THE 1V1',

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
  'recap.tackle': 'A TACKLE',
  'recap.eagle': 'EAGLE',
  'recap.roll': 'ROLL',
  'recap.burn': 'BURN',

  // ---- the TAB scoreboard (js/ui/panels.js)
  'board.kda': 'K/D/A',
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
  'tip.share': 'SECOND ARROW DAMAGE',
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

  // ---- the wiki (js/ui/wiki.js): page tabs, page lines and table heads; a hero, ability or item keeps its own words on its entry
  'wiki.stats': 'STATS',
  'wiki.passive': 'PASSIVE',
  'wiki.cast': 'CAST',
  'wiki.heroes': 'HEROES',
  'wiki.beasts': 'BEASTS',
  'wiki.items': 'ITEMS',
  'wiki.world': 'WORLD',
  'wiki.heroesLine': 'THE HEROES. EACH ABILITY HAS ITS OWN COOLDOWN.',
  'wiki.skillLine': 'A SKILL POINT UNLOCKS AN ABILITY OR RANKS IT UP: {ranks} RANKS ON THE FIRST THREE, {ult} ON THE ULTIMATE AT LEVELS {levels}.',
  'wiki.beastsLine': 'EVERY BEAST IS DEALT THE TABLE\'S AVERAGE HERO LEVEL WHEN IT SPAWNS, AND KEEPS IT.',
  'wiki.beastsLevel': 'A LEVEL IS MORE HEALTH TO SHOOT THROUGH, AND MORE GOLD AND XP FOR THE KILL.',
  'wiki.itemsLine': 'SIX SLOTS. EVERY ITEM IS ON SALE AT EITHER COUNTER, ALWAYS AT ONE PRICE.',
  'wiki.itemsParts': 'AN ITEM COSTS LESS FOR EVERY PART OF IT YOU ALREADY HOLD. ONE PAIR OF BOOTS.',
  'wiki.seesYou': 'SEES YOU',
  'wiki.health': 'HEALTH',
  'wiki.stamina': 'STAMINA - A WOLF\'S LEASH',
  'wiki.lv': 'LV {n}',
  'wiki.killGold': 'KILL GOLD',
  'wiki.killXp': 'KILL XP',

  // ---- the wiki BEASTS page: a beast's name and what it does, every number through a slot
  'beast.rabbit': 'RABBIT',
  'beast.rabbitLine': 'BOLTS AT {sight} PX. ONE JINK CHARGE EVERY {cd} S.',
  'beast.deer': 'DEER',
  'beast.deerLine': 'TWO, ONE EACH SIDE OF THE CREEK, ALWAYS ON THE MOVE. BOLTS AT {sight} PX. SPRINTS {t} S AT {sprint}, THEN {run}.',
  'beast.wolf': 'WOLF',
  'beast.wolfLine': 'A DEN OF {n}. NEUTRAL UNTIL HIT. BITES {bite} +{lv} A LEVEL. BACK IN {back} S.',
  'beast.alpha': 'BLACK BEAR',
  'beast.alphaLine': 'ONE ON A BEND OF THE CREEK, OUT AT {out}, BACK {back} AFTER A KILL. NEVER UNDER LV {lv}. SWIPES {bite} +{lvBite}. THE TEAM GETS {gold} EACH AND {t} S OF THE {buff}, AND +{pct}% ON EVERY BLOW FOR GOOD, UP TO {max} BEARS.',
  'beast.orca': 'ORCA',
  'beast.orcaLine': 'UNDER THE ICE OF ITS POOL UNTIL {out}, THEN UP IN ITS HOLE, BACK {back} AFTER A KILL. LUNGES {bite} +{lvBite}, SPOUTS AT RANGE. THE TEAM GETS {gold} EACH AND {t} S OF THE {buff}: SOLDIERS NEAR YOU HIT BUILDINGS {x}X.',

  // ---- the wiki WORLD page: the setting (the voice and the fixed words: docs/dev/lore.md)
  'world.softfall': 'SOFTFALL',
  'world.empire': 'THE EMPIRE',
  'world.exiles': 'THE EXILES',
  'world.works': 'THE WORKS',
  'world.claim': 'THE CLAIM',
  'world.eagles': 'THE EAGLES',
  'world.counter': 'THE COUNTER',
  'world.machines': 'THE MACHINES',
  'world.road': 'THE ROAD',
  'world.towers': 'THE TOWERS',
  'world.wolves': 'THE WOLVES',
  'world.gold': 'GOLD',
  'world.softfallText': 'THE SNOW CAME DOWN SOFT AND DID NOT STOP, AND THE VALLEY\'S OLD WORKS WENT UNDER WHOLE. IT STILL FALLS EVERY WINTER, AND THE VALLEY COMES OUT FROM UNDER IT A DIFFERENT SHAPE EACH TIME. NO MAP OF SOFTFALL IS GOOD FOR TWO WINTERS.',
  'world.empireText': 'OVER THE PASS IS AN EMPIRE BIG ENOUGH THAT IT HAS NEVER NEEDED A NAME. IT KEEPS WHAT IT CAN USE. THE REST IT WALKS UP TO THE LAST PASS, A GENERAL OR A LAMPLIGHTER ALIKE, AND SHUTS THE GATE BEHIND THEM. NOBODY IS LET BACK.',
  'world.exilesText': 'NOBODY IN SOFTFALL WAS BORN HERE. A SOLDIER WHO WALKED HOME, A SMITH WHO WOULD NOT KNEEL, A GENERAL WHO WON THE WRONG WAR: THE VALLEY TAKES ANYONE WHO CAN DIG. ONE WHO GOES DOWN IS CARRIED BACK TO THE ROOST AND SENT OUT AGAIN, AND THE BETTER THE EXILE, THE LONGER THE COMPANY MAKES THEM SIT FIRST.',
  'world.worksText': 'NOBODY ALIVE SAW THE WORKS RUNNING. THE PINES GREW UP THROUGH THEM, SO THERE IS GOLD IN THE WOOD. THE ROAD, ITS TOWERS AND THE MACHINES ARE WHAT STILL STANDS ABOVE THE SNOW.',
  'world.claimText': 'TWO COMPANIES HIRE EXILES TO DIG THE WORKS OUT, AND NEITHER ASKS WHERE THEY CAME FROM. VALLEY LAW IS ONE LINE LONG: A CLAIM STANDS WHILE ITS BIRD HOLDS ITS ROOST. SO NOBODY COMES TO SOFTFALL TO KILL ANYBODY. SCARE THE OTHER BIRD OFF ITS GROUND AND THE VALLEY IS YOURS UNTIL THE NEXT SNOW.',
  'world.eaglesText': 'BIG ENOUGH TO CARRY FIVE EXILES AND A MERCHANT, ARMOURED IN COMPANY COLOUR, AND BRAVE ONLY UP TO A POINT. IT BEATS ITS WINGS AT WHATEVER CROWDS IT. HIT IT ENOUGH AND ITS NERVE GOES. IT LEAVES, AND ITS COMPANY LEAVES WITH IT.',
  'world.counterText': 'THE MERCHANTS ARE A GUILD OF THEIR OWN. ONE RIDES IN WITH EACH BIRD, BUILDS ITS BARRACKS AND SELLS TO ANY PURSE THAT WALKS UP, YOURS OR THEIRS. THEY ARE NOT ON A SIDE. THEY ARE ON THE PRICE OF FISH. NOBODY LAYS A HAND ON ONE.',
  'world.machinesText': 'OLDER THAN THE ROAD. THEY SLEEP UNDER THE SNOW UNTIL GOLD WAKES ONE, AND THEN THEY DO THE ONE THING THEY REMEMBER: MARCH. WHO BUILT THEM IS THE VALLEY\'S FAVOURITE ARGUMENT.',
  'world.roadText': 'THE WORKS\' HAUL ROAD RUNS STRAIGHT FROM ROOST TO ROOST, PACKED HARD BY WHATEVER THEY HAULED ALONG IT, AND A TRACK RUNS ROUND EACH SIDE OF THE VALLEY BY THE TREES. BOTH COLUMNS MARCH DOWN ALL THREE, SO EVERYTHING IN SOFTFALL ENDS UP ON A ROAD. MOST OF IT MEETS IN THE MIDDLE.',
  'world.towersText': 'THE WORKS RAISED THEM IN CUT STONE TO HOLD THE ROADS, THREE TO EVERY CABLE, AND GOLD WOKE THE CROSSBOWS ON TOP. A COMPANY\'S CABLE RUNS NO FURTHER THAN ITS LAST TOWER STANDING. A TOWER SHOOTS THE MARCHING COLUMN, UNTIL AN EXILE HURTS ONE OF ITS OWN UNDER IT.',
  'world.wolvesText': 'THE WOLVES WERE HERE FIRST AND HAVE NO OPINION ABOUT CLAIMS. LEAVE A DEN ALONE AND IT LEAVES YOU ALONE. THE BEARS WALK THE BENDS OF THE CREEK, AND A COMPANY THAT BRINGS ONE DOWN WALKS TALLER FOR A WHILE.',
  'world.goldText': 'THE ONLY THING THE VALLEY PAYS IN. THE WORKS WILL MAKE AN EXILE RICH, BUT A PINE NEVER TAUGHT ANYBODY ANYTHING. AN EXILE LEARNS ON THE ROAD, STANDING CLOSE WHEN THINGS FALL, AND THAT IS ALL A LEVEL IS.',
  'world.intro': 'SOFTFALL IS A VALLEY OVER THE EMPIRE\'S LAST PASS, AND THE SNOW THAT BURIED IT.',
  'world.introSub': 'THE EMPIRE THROWS PEOPLE OUT. THE VALLEY TAKES ANYONE WHO CAN DIG.',
  'world.outro': 'THAT IS ALL ANYBODY KNOWS. THE REST IS UNDER THE SNOW.',
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
