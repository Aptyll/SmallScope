'use strict';
// The title's pages: WIKI, PATCH NOTES and ROADMAP under one row of tabs,
// opened from the PATCH_TXT tag (js/ui/menu.js). The wiki is a screen of its
// own (js/ui/wiki.js); PATCH NOTES and ROADMAP share the notes screen below.
// ------------------------------------------------------------ the pages' tabs
// One row of three words at scale 2 across the top of the view, drawn once
// over whichever of the two screens is up (renderTitle, js/ui/menu.js), so a
// switch between them cross-fades the page and never the row. The open one
// is gold over the gold rule, the rest dim, lighter under the pointer. On
// the keys the row is one walk left to right: the wiki's own pages, then
// PATCH NOTES, then ROADMAP (wikiKey, notesKey). The last tab, KITCHEN, is a
// link, not a page: a click opens the Softfall Kitchen website (how the game
// gets made) in the browser, and its small arrow says it leaves the game.
const PAGE_TABS = ['WIKI', 'PATCH NOTES', 'ROADMAP', 'KITCHEN'];
const PAGE_LINK_TAB = 3; // the tab that opens KITCHEN_URL
const KITCHEN_URL = 'https://aptyll.github.io/softfall-kitchen/';
const PAGE_LINK_ARROW = 16; // the link tab's arrow (10 px) and the gap before it, at scale 2
const PAGE_TAB_GAP = 28;
const NOTES_TOP = 12; // the row's top edge: the pages are the whole view, so it hugs the top
// which tab is open: the wiki's screen, else the notes screen's own pick
function pageTabOpen() { const m = state.menu; return m.screen === 'wiki' ? 0 : m.notesTab ? 2 : 1; }
function pageTabsLayout() {
  const ws = PAGE_TABS.map((t, i) => pixelTextWidth(t, 2) + (i === PAGE_LINK_TAB ? PAGE_LINK_ARROW : 0));
  let x = Math.round((VIEW_W - ws.reduce((s, w) => s + w, 0) - PAGE_TAB_GAP * (ws.length - 1)) / 2);
  return PAGE_TABS.map((text, i) => { const r = { i, text, x, y: NOTES_TOP, w: ws[i], h: 10 }; x += ws[i] + PAGE_TAB_GAP; return r; });
}
// the tab under (mx, my), or -1
function pageTabHit(mx, my) {
  for (const r of pageTabsLayout()) if (mx >= r.x - 6 && mx < r.x + r.w + 6 && my >= r.y - 4 && my < r.y + r.h + 4) return r.i;
  return -1;
}
// open tab i from whichever page is up: the wiki is its own screen with its
// own song, the other two are the notes screen's
function openPageTab(i) {
  if (i === PAGE_LINK_TAB) { SFX.place(); window.open(KITCHEN_URL, '_blank', 'noopener'); return; }
  const m = state.menu, from = pageTabOpen();
  if (i === from) return;
  if (i === 0) { beginWiki(); return; }
  if (from === 0) leaveWiki('notes'); else SFX.pickup();
  m.notesTab = i - 1; m.notesSel = 0; m.keyNav = false;
  notesScroll = 0;
}
function drawPageTabs(a) {
  const m = state.menu, open = pageTabOpen();
  const lift = Math.round((1 - a) * 20);
  const ready = (m.screen === 'wiki' ? m.wikiT : m.notesT) >= 1 && mouse.inside;
  const hot = ready ? pageTabHit(mouse.x, mouse.y) : -1;
  ctx.globalAlpha = a;
  for (const r of pageTabsLayout()) {
    const on = r.i === open;
    const col = on ? '#ffd95c' : r.i === hot ? '#cfe0ff' : '#5a6690';
    drawPixelTextShadow(ctx, r.text, r.x, r.y - lift, col, on ? '#3c2a1e' : 'rgba(8,12,28,0.9)', 2);
    if (r.i === PAGE_LINK_TAB) drawLinkArrow(r.x + r.w - 10, r.y - lift, col);
    if (on) drawGoldRule(r.x + (r.w >> 1), r.y + 15 - lift, (r.w >> 1) + 8, a);
  }
  ctx.globalAlpha = 1;
}

// a small arrow up and to the right, as tall as the tab's letters at scale 2,
// with the same drop shadow: this tab leaves the game
const LINK_ARROW = ['.####', '...##', '..#.#', '.#..#', '#....'];
function drawLinkArrow(x, y, col) {
  for (const [dx, c] of [[2, 'rgba(8,12,28,0.9)'], [0, col]]) {
    ctx.fillStyle = c;
    LINK_ARROW.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') ctx.fillRect(x + i * 2 + dx, y + j * 2 + dx, 2, 2); });
  }
}

// ------------------------------------------------------------ roadmap
// What is left to build, in plain words: sections of to-do lines, each a
// box (open: to do; gold and full: done) and its words. A done line stays,
// dim, until the patch that shipped it is on the notes. Write it as a player
// reads it, the way PATCH_NOTES are. It folds like the notes (NOTES_GROUPS
// below), every section open at first.
const ROADMAP = [
  ['BEFORE THE PLAYTEST', [
    [0, 'LAG-FREE MULTIPLAYER TEST: A NEW STEAM BUILD, TWO PCS, TWO STEAM ACCOUNTS, ONE WHOLE MATCH'],
  ]],
  ['MULTIPLAYER', [
    [0, 'A PLAYER JOINING MID-MATCH NO LONGER FREEZES THE HOST FOR HALF A SECOND'],
    [0, 'JOIN GAME ON A STEAM FRIEND TAKES YOU INTO THEIR PARTY'],
    [1, 'QUICKPLAY AND RANKED MATCH YOUR PARTY AGAINST OTHER PARTIES NEARBY, NOT ONLY BOTS'],
    [1, 'BRING YOUR PARTY INTO THE PRACTICE TOOL'],
  ]],
];

// ------------------------------------------------------------ patch notes
// The PATCH NOTES tab (menu.screen = 'notes', notesTab 0, eased on notesT
// like the wiki): the whole view under a dark veil, the tabs over it, and
// under them one column of folding groups, newest first: every patch in
// PATCH_NOTES (js/ui/menu.js), folded into its tenth (0.390 - 0.391,
// 0.380 - 0.389, ...) with the newest open, built off the list itself so a
// new patch needs no line here; a note with a picture shows it under its
// text. Below them the DIGEST - PATCH_DIGEST, written by hand: the recent
// patches condensed into short lines by what a player notices, each with the
// patch it came in, folded. A group is a chevron and its name; a click (or
// Enter on the keys' pick) folds it. The ROADMAP tab (notesTab 1) is the
// same column over ROADMAP's sections. Which groups are open lives in
// notesOpen for the session only.
const PATCH_DIGEST = [
  ['THE VALLEY', [
    ['EVERY HERO\'S STORY IN THE WIKI: ALL EXILES OF THE EMPIRE OVER THE PASS', '0.543'],
    ['CAMP TIMERS ON THE MAP: ONLY FOR CLEARS YOUR TEAM SAW', '0.537'],
    ['TWO GOLD PUMPS BY THE SIDE LANES: STAND IN THE RING TO TAKE ONE, YOUR TEAM GETS ITS GOLD', '0.535'],
    ['TOWERS, BASE AND ZIPLINES LIFT THE FOG', '0.534'],
    ['NO MORE ROCKS, PICK, CHESTS, CARDS OR BACKPACK: THE AXE AND THE TREES STAY', '0.531'],
    ['NO MORE BUILDING: THE MAP\'S TOWERS AND BARRACKS ARE THE ONLY BUILDINGS', '0.525'],
    ['DEEP SNOW IS BRUSH: HIDE IN THE FROSTED REEDS', '0.514'],
    ['TWO CROSSBOW TOWERS ON EVERY LANE\'S ZIPLINE, AND IT ENDS AT ITS LAST ONE STANDING', '0.503'],
    ['BOTS TAKE A LANE EACH: MID, TOP AND BOT', '0.501'],
    ['THREE LANES: TOP, MID AND BOT, EACH WITH ITS OWN WAVES AND ZIPLINE', '0.499'],
    ['EACH SIDE HAS A HOME BASE, AND ITS EAGLE FLIES IN OVER ITS OWN CORNER', '0.492'],
    ['THE ORCA GLIDES ONTO THE HOLE AND TURNS TO FACE YOU BEFORE IT STRIKES', '0.477'],
    ['THE ORCA STALKS YOU UNDER A 3 2 1 COUNTDOWN, AND HUNTS AGAIN A SECOND AFTER IT EATS', '0.476'],
    ['NO BLOOD: HITS THROW UP WHITE SNOW', '0.475'],
    ['THE WAVES GO ROUND THE CISTERN, OVER STEPPING STONES', '0.474'],
    ['THE CISTERN STANDS AT THE MIDDLE, AND AN ORCA HUNTS UNDER ITS ICE', '0.473'],
    ['NO MORE REEDS ALONG THE LAKE SHORES', '0.457'],
    ['A ZIPLINE RIDER NO LONGER WOBBLES ON SCREEN', '0.455'],
    ['EACH BEAR GIVES ITS OWN BUFF: BLACK BUFF AND BROWN BUFF', '0.454'],
    ['THE EAGLE NO LONGER JITTERS IN FLIGHT', '0.453'],
    ['TWO DEER ROAM THE VALLEY, ONE EACH SIDE OF THE CREEK', '0.452'],
    ['THE CAMERA GLIDES SMOOTHLY ON FAST RIDES, ON ANY SCREEN', '0.451'],
    ['PERCH WEARS ONLY ITS BIG HEALTH BAR, NO NAME BANNER', '0.450'],
    ['RABBITS NO LONGER DROP BERRIES', '0.449'],
    ['THE CAMERA STARTS TWICE AS CLOSE, AND THE WHEEL STILL ZOOMS OUT', '0.447'],
    ['FROST PIKE AND RARE GOLD SUNFISH SWIM UNDER THE ICE', '0.444'],
    ['THE EAGLE RIDE OPENS ON YOU, WITH A GOLD JUMP WINDOW AND A REAL KEY', '0.440'],
    ['PERCH FLIES IN ITS NEW LOOK, TUCKING TO DIVE AND FLARING TO LAND', '0.434'],
    ['ROLL OVER A FISH IN THE CREEK TO CATCH IT', '0.433'],
    ['THE CREEK IS WIDER, WITH FISH SWIMMING DOWN IT', '0.428'],
    ['PERCH ROOSTS WITH ITS WINGS OPEN AND A SADDLE ON ITS BACK', '0.427'],
    ['PERCH\'S HEALTH BAR IS BIGGER AND SHOWS ITS NUMBER', '0.427'],
    ['THE ZIPLINE STARTS IN THE STUMPS BESIDE YOUR BIRD', '0.420'],
    ['ANYONE RIDES EITHER ZIPLINE, THE WAVES TOO; RIVALS WHO MEET ON ONE CRASH OFF IT', '0.442'],
    ['THE PRACTICE FIELD HAS A DEER RIDE THROUGH THE FOREST', '0.412'],
    ['A RIDDEN DEER GALLOPS FASTER', '0.412'],
    ['THE DEER RIDE TRAIL TWISTS: A HAIRPIN, A SPRINT AND A HOOK', '0.416'],
    ['A RIDDEN DEER\'S HEALTH IS A TAN ROW UNDER THE RIDER\'S BARS', '0.425'],
    ['BEARS WEAR A BEAR-SIZED FRAME AND START AT LEVEL 6', '0.409'],
    ['ANIMALS AND CAMPS KEEP UP WITH THE AVERAGE PLAYER LEVEL', '0.439'],
    ['THE BEARS ARE TWICE AS BIG', '0.408'],
    ['A DEER\'S RIDER SITS DOWN ON ITS BACK', '0.406'],
    ['THE DEER STANDS TWICE AS TALL', '0.404'],
    ['RIDE A DEER: E HOPS ON, ROLL LEAPS THE ROAD\'S TRUNK', '0.402'],
    ['SNOWDROPS GLOW: WARM LIGHT, TWINKLES AND MOTES, BRIGHT AT NIGHT', '0.401'],
    ['WARRENS DRAWN BY HAND: A DEEP SNOW CIRCLE, THREE RABBITS, THREE SNOWDROPS', '0.400'],
    ['BURROWS RIDE IN YOUR PACK: V OR A CLICK ON THE CELL DIGS ONE', '0.399'],
    ['RABBIT WARRENS: DAWN SNOWDROPS SHIELD YOUR SIDE, BURROWS DIG TUNNELS', '0.395'],
    ['SIX HOG HUTS HIDE IN THE BORDER WOODS, THREE CHESTS AROUND EACH', '0.287'],
    ['A CREEK THAT NEVER FREEZES SPLITS THE VALLEY, BRIDGED AT THE ROAD', '0.286'],
    ['THE WOLF DEN IS A ROCK MAW, AND THERE ARE SIX CAMPS', '0.285'],
    ['THE CREEK BENDS SO EACH SIDE OWNS ONE BIG CAMP, AND BOTH PAY THE SAME', '0.317'],
    ['A BROWN BEAR AND A BLACK BEAR HOLD THE TWO BIG CAMPS', '0.324'],
    ['A BEAR STANDS UP BEFORE IT SWIPES: STEP BACK', '0.328'],
    ['A BEAR\'S BAR STAYS CLEAR WHEN IT REARS UP', '0.387'],
    ['A BEAR ROARS WHEN YOU WAKE IT', '0.368'],
    ['NOTHING PUSHES A BEAR: IT SHOVES YOU ASIDE', '0.383'],
    ['BEARS WALK THE RIVERBANK AND FISH, NO MORE DENS', '0.382'],
    ['BEARS BITE AND SWIPE, AND ONLY STAND UP TO ROAR', '0.388'],
    ['BEARS HAVE TWICE THE HEALTH, RUN FASTER AND COMMIT TO EVERY BLOW', '0.393'],
    ['AN AWAKE BEAR OR WOLF GOES FOR WHOEVER IS NEAREST', '0.389'],
    ['ROCKS STAND IN A FEW MINING SPOTS, THE RAREST AT THE CORNERS', '0.315'],
    ['ROLL OVER THE CREEK FROM ITS BANK', '0.312'],
    ['A ROWBOAT LIES FROZEN IN THE ICE', '0.298'],
    ['NO MORE SLEDS, AND THE MIDDLE OF THE ROAD IS OPEN GROUND', '0.334'],
    ['A ROCK FILLS WITH COLOUR AS IT IS MINED', '0.314'],
    ['STAND BY A ROCK AND IT MINES ITSELF', '0.313'],
    ['ROCKS COME IN THREE KINDS, AND ALL OF THEM GIVE ORE', '0.296'],
    ['LAKES HAVE SHORES, REEDS AND CRACKS', '0.293'],
  ]],
  ['WEATHER AND SNOW', [
    ['PINES OPEN A WINDOW ROUND YOU, NO MORE BLACK OUTLINE', '0.405'],
    ['EVERY DAY HAS ITS OWN WEATHER, FROM CALM TO GROUND BLIZZARD', '0.289'],
    ['THE DAY HAS HOURS: A ROSE DAWN, A BRIGHT MIDDAY, A GOLD DUSK', '0.284'],
    ['DEEP DRIFTS SLOW ANYONE WADING THROUGH THEM', '0.294'],
    ['THE SNOW PACKS INTO PATHS WHERE PEOPLE WALK', '0.292'],
    ['GUSTS SHAKE SNOW OFF THE PINES', '0.290'],
    ['THE FOREST IS SOFTER AND OFF THE GRID', '0.283'],
    ['EVERYTHING CASTS A SHADOW FROM ONE SUN', '0.279'],
  ]],
  ['FIGHTING AND TRADE', [
    ['A NEW HERO, IGNIA THE FIREMAGE: HER FIRE SPREADS RIVAL TO RIVAL, SNOW PUTS IT OUT', '0.546'],
    ['IGNIA\'S FIRST SKIN, WANDERER, ON THE SKINS SCREEN', '0.546'],
    ['HEROES RUNNING LEFT OR RIGHT KEEP THEIR FULL SIZE', '0.546'],
    ['A LEAGUE SHOP: 54 ITEMS, BOOTS, TIERS THAT BUILD INTO EACH OTHER, TABS FROM TANK TO MAGE', '0.545'],
    ['GOLD ON THE NEW SCALE: A FIRST FINISHED ITEM AT ABOUT 5:00', '0.545'],
    ['HEALTH POTIONS AT THE SHOP; CREEK FISH AND BERRY BUSHES HEAL WHERE THEY STAND', '0.538'],
    ['SOLDIERS ARE THE FARM: ONE PINE IN FOUR HOLDS 2 GOLD, THE REST NOTHING', '0.524'],
    ['A DEATH RECAP: WHO HIT YOU, WITH WHAT, HOW HARD', '0.521'],
    ['PINGS REPLACE FLAGS: TAP FOR GO HERE, HOLD FOR ATTACK, ON MY WAY, DANGER OR DEFEND', '0.519'],
    ['AN ANNOUNCER CALLS FIRST BLOOD, MULTI-KILLS, SHUTDOWNS, ACES, TOWERS AND BEARS; A KILL FEED SITS UNDER THE MINIMAP', '0.516'],
    ['ABILITY RANKS GROW DAMAGE AND EFFECT, ULTIMATES RANK AT 6, 11 AND 16, AND THE TOOLTIP SHOWS EVERY RANK', '0.515'],
    ['HEROES LEVEL TO 18', '0.515'],
    ['EVERY HERO HAS ITS OWN BASIC ATTACK; ONE BOTTOM BAR HOLDS ABILITIES, SIX ITEMS AND GOLD', '0.509'],
    ['A NEW HERO, BELLA THE IMPERIAL GENERAL: FIND ONE WEAKNESS AND SPEND IT FIRST', '0.522'],
    ['BELLA\'S FIRST SKIN, TRAITOR\'S BLADE, ON THE SKINS SCREEN', '0.522'],
    ['A NEW HERO, FORTIVA THE UNBROKEN: THE LONGER SHE FIGHTS, THE HARDER SHE IS TO STOP', '0.511'],
    ['FORTIVA\'S FIRST SKIN, CHAINBREAKER, ON THE SKINS SCREEN', '0.511'],
    ['A NEW HERO, ARMATOS THE LAST STANDARD: HE HOLDS THE LINE AND PLANTS HIS STANDARD', '0.504'],
    ['ARMATOS\'S FIRST SKIN, IRON OATH, ON THE SKINS SCREEN', '0.504'],
    ['GEAR IS GONE: ITEMS CARRY EVERY STAT, AND G SHOWS YOUR SIX ITEMS', '0.500'],
    ['ARROWS AND DAMAGE NUMBERS IN THE FOG ARE HIDDEN, AND ONLINE YOU ARE SENT ONLY WHAT YOUR SIDE SEES', '0.496'],
    ['YOUR SIX ITEM SLOTS SIT BESIDE YOUR WEAPON, TOP-LEFT', '0.495'],
    ['NO MORE TOOLS OR BITS IN THE SNOW: YOUR WEAPON IS YOUR CLASS\'S, AND A CHEST GIVES A FREE PART', '0.495'],
    ['THE WIKI HAS AN ITEMS PAGE, AND BOTS GO HOME TO SHOP', '0.495'],
    ['THE LAST HIT ON A RIVAL SOLDIER PAYS 16 GOLD AND A COIN; MISS IT AND NOBODY GETS IT', '0.494'],
    ['WOLF DENS SHOW THEIR RESPAWN CLOCK ON THE DEN AND BOTH MAPS, AND THE SCOREBOARD COUNTS FARM', '0.494'],
    ['SEVEN HERO STATS BESIDE YOUR PORTRAIT, HOVER ONE TO SEE WHERE IT COMES FROM', '0.493'],
    ['XP IS ITS OWN NUMBER: STAND NEAR WHEN RIVALS FALL TO LEVEL; THE WOODS PAY GOLD ONLY', '0.491'],
    ['ASSISTS PAY A SHARE OF THE KILL, AND THE SCOREBOARD SHOWS K/D/A', '0.490'],
    ['A STREAK PUTS A GOLD BOUNTY OVER YOUR NAME; ENDING IT IS A SHUTDOWN', '0.490'],
    ['A PLAYER WHO KEEPS DYING IS WORTH LESS GOLD', '0.490'],
    ['H RECALLS YOU HOME, AND THE RING ROUND YOUR BIRD HEALS YOU', '0.488'],
    ['THE SHOP SELLS ITEMS: CHEAP PARTS BUILD INTO FINISHED ITEMS, SIX SLOTS EACH', '0.487'],
    ['EVERY ITEM IS ALWAYS ON SALE, AND FISH AND BERRIES HAVE ONE FIXED PRICE', '0.487'],
    ['BOTS BUY ITEMS TOO, EACH CLASS ITS OWN BUILD', '0.487'],
    ['FOG OF WAR: YOU SEE ROUND YOUR SIDE, STONE BLOCKS SIGHT, THE WOODS HIDE, BOTS PLAY BY IT', '0.486'],
    ['A WAVE IS THREE SOLDIERS', '0.465'],
    ['THE GENERATOR IS A BIG GOLD PUMP THAT NODS AS IT PAYS', '0.423'],
    ['A GOLD PUMP PAYS 12, 24 OR 42 GOLD A MINUTE BY TIER', '0.423'],
    ['SCOUTS RUN WITH THEIR WHOLE BODY, AND THE ROLL TUCKS INTO A BALL', '0.397'],
    ['A CROWD SPREADS OUT INSTEAD OF STANDING IN ONE PILE', '0.372'],
    ['BODIES NO LONGER BLINK BETWEEN FACINGS IN A FIGHT', '0.377'],
    ['TURRETS SLING ROCKS OVER YOUR WALLS, AND EACH TIER THROWS FURTHER AND TRUER', '0.364'],
    ['EVERY GOLD PUMP OR BOT BAY YOU OWN MAKES THE NEXT ONE DEARER', '0.363'],
    ['YOUR BOTS ANSWER YOUR FLAGS OUT LOUD: ON IT, GUARDING', '0.358'],
    ['A NEW EASY LEVEL, AND BOTS THAT AIM AND MISS LIKE PEOPLE', '0.354'],
    ['BOTS PLAY AS A TEAM: SCOUTS, STALKERS, GUARDS, HELP CALLS AND BEAR HUNTS', '0.347'],
    ['A BOT THAT DOWNS YOU TWICE COMES LOOKING FOR YOU', '0.355'],
    ['YOUR BOTS CALL OUT WHAT THEY SEE, WITH AN ICON AND A PING', '0.345'],
    ['YOUR BOTS ANSWER YOUR FLAG ONE AT A TIME, AND BUILD ONLY WHAT STILL PAYS', '0.366'],
    ['BOTS MEET A PUSH AT HOME, THEN COUNTER', '0.367'],
    ['BOTS HOLD A SWORD SWING UNTIL YOU ARE IN REACH', '0.373'],
    ['RESPAWNS GROW WITH LEVEL: 5 S AT LEVEL 1, 50 S AT LEVEL 12', '0.371'],
    ['BOTS WALL OFF AN OPEN BASE, LEAVING ONE GATE ON THE ROAD', '0.386'],
    ['BOT GUARDS BUILD WALLS THAT ALWAYS LEAVE A GAP', '0.381'],
    ['BOT GUARDS BUILD TURRETS AND SCOUT INSTEAD OF STANDING', '0.379'],
    ['A GATE IN YOUR WALL THAT ONLY YOUR SIDE WALKS THROUGH', '0.327'],
    ['A BODY FREEZES AND SHATTERS OR BLOWS AWAY ON THE WIND WHEN IT GOES DOWN', '0.321'],
    ['THE STALL OPENS FROM ANY SIDE', '0.319'],
    ['EVERY MODIFIER SHAPES EVERY SHOT, AND A HEAVY LOAD ONLY DRAWS SLOWER', '0.318'],
    ['THE MERCHANT PITCHES A STALL, AND THE SHOP OPENS THERE', '0.305'],
    ['THE MERCHANT WORKS AT HOME AND RAISES BARRACKS', '0.302'],
    ['HEALTH BARS ARE CUT INTO EVEN SEGMENTS', '0.299'],
    ['HEALTH BARS STAY CRISP AT NIGHT AND NEVER HIDE BEHIND A TREE', '0.370'],
    ['DAMAGE ADDS UP IN ONE NUMBER BESIDE THE BAR, IN THE BAR\'S COLOUR', '0.376'],
    ['A FALLEN PLAYER\'S DAMAGE FLOATS UP AND FADES', '0.380'],
    ['THE PIERCING SHOT FLIES TWICE AS FAR', '0.273'],
  ]],
  ['MENUS AND CONTROLS', [
    ['PARTY SCREEN LIKE LEAGUE\'S: BIG PORTRAITS IN A ROW, ONE FIND MATCH BUTTON, A SOCIAL COLUMN WITH YOUR FRIENDS', '0.542'],
    ['STEAM FRIENDS BESIDE YOUR PARTY: JOIN THEIRS, INVITE THEM, ADD PEOPLE YOU PLAYED WITH', '0.541'],
    ['JOINING ON STEAM BY CODE OR INVITE NO LONGER FREEZES ON A BLUE SCREEN', '0.540'],
    ['THE TOP BAR SHOWS ALL TEN HEROES\' FACES, YOU FIRST', '0.536'],
    ['HERO DRAFT: BANS FROM FIVE HEROES ON, THEN EVERYONE PICKS AT ONCE, BLIND, NO REPEATS ON A TEAM', '0.517'],
    ['A KITCHEN TAB OPENS THE WEBSITE WHERE YOU WATCH THE GAME GET MADE', '0.510'],
    ['FIND MATCH PUTS ANOTHER PARTY AGAINST YOU, BOTS ONLY IF NOBODY IS LOOKING', '0.497'],
    ['THE PARTY LEADER SWITCHES MODES WITH A CLICK ON THE MODE NAME', '0.497'],
    ['THE PRACTICE TOOL WITH YOUR PARTY: START, THEN FRIENDS JOIN BY CODE ANY TIME', '0.489'],
    ['NO SAVED MATCHES: EVERY MATCH IS PLAYED START TO FINISH', '0.485'],
    ['QUICKPLAY, RANKED, PRACTICE TOOL: A PARTY WITH FRIENDS, FIND MATCH, PICK YOUR HERO', '0.484'],
    ['SURRENDER AFTER 15 MINUTES: START THE VOTE FROM ESC, VOTE YES OR NO UNDER THE CLOCK', '0.483'],
    ['ONE PROFILE, YOUR NAME AND STATS; PICK A HERO EACH MATCH ON THE LOBBY', '0.482'],
    ['PARTY CHAT, STEAM INVITES, A TASKBAR FLASH ON JOIN', '0.472'],
    ['THE PATCH NOTES SIT BETWEEN THE WIKI AND A ROADMAP OF WHAT COMES NEXT', '0.470'],
    ['ONLINE, YOUR WALK ANSWERS AT ONCE AND THE HOST\'S MENU NEVER FREEZES THE MATCH', '0.467'],
    ['THE MAP AND MINIMAP ARE GRAPHITE AND FLAT; POINT AT A CAMP FOR ITS NAME', '0.459'],
    ['THE FOUR WAR EAGLES WEAR PERCH\'S NEW LOOK', '0.446'],
    ['A SIZE SLIDER FOR EACH HUD PART, HALF TO DOUBLE IN 5% STEPS', '0.436'],
    ['POINT AT THE FISH WELL TO PICK WHICH FISH YOU EAT', '0.433'],
    ['POST-GAME STATS: A COLUMN PER PLAYER, FOLDING GROUPS, BEST STREAK AND MULTI-KILLS', '0.430'],
    ['POST-GAME NAMES UNDER EVERY FACE', '0.431'],
    ['POST-GAME GRAPHS: ANY STAT AS A BAR PER PLAYER WITH ITS NUMBER', '0.432'],
    ['THE BROWSER TAB SHOWS THE SOFTFALL S', '0.429'],
    ['THE BOTTOM BAR: PORTRAIT WITH XP ROUND ITS EDGE, HEALTH AND STAMINA BARS', '0.426'],
    ['CARDS OPEN THE MOMENT YOU PICK THEM UP, SO C IS FREE', '0.426'],
    ['THE TOP BAR IS SLIM: CLOCK OVER SCORE, A DOWNED PLAYER\'S SECONDS', '0.422'],
    ['THE HUD IS QUIET GRAPHITE; THE TOP BAR SHOWS THE OTHER NINE', '0.421'],
    ['PRACTICE TOOL: A CHEAT BAR, AND THREE MEDAL ROUNDS ON THE BELL', '0.411'],
    ['WATCH TWO LADDER BOTS PLAY, AT UP TO 8X SPEED', '0.375'],
    ['THE END SCREENS TELL THE MATCH IN THREE LINES: WHO HUNTED YOU, WHO HELD THE BIRD', '0.352'],
    ['EARN COINS EVERY MATCH AND SPEND THEM ON SKINS', '0.329'],
    ['FIVE ARMOURED WAR EAGLES TO FLY YOUR SIDE IN', '0.330'],
    ['YOUR WAR EAGLE LANDS TOO, AND EVERY EAGLE\'S SHADOW BEATS WITH ITS WINGS', '0.332'],
    ['THE EAGLES FLY STRAIGHT AND LEVEL AND PASS FAR APART', '0.335'],
    ['THE IRON HERO: A ROBOT SKIN YOU WEAR INTO A MATCH', '0.331'],
    ['HOLD T FOR A WHEEL OF PIECES, DRAG WALLS, REPAIR WITH E', '0.327'],
    ['THE EAGLE RIDE GLIDES, NAMES EVERY RIDER AND SHOWS THE JUMP KEY', '0.325'],
    ['YOUR DEATH REPLAYS AT FULL SPEED, AND THE WHEEL ZOOMS WHILE YOU WAIT', '0.321'],
    ['THE HUD READS ON BRIGHT SNOW: A DARK OUTLINE AND A BRIGHT EDGE', '0.318'],
    ['THE TOP BAR KEEPS SCORE: KILLS, THE CLOCK, EVERYONE\'S HEALTH', '0.316'],
    ['THE PATCH NOTES RUN NEWEST FIRST AND SHOW CONCEPT ART', '0.391'],
    ['THE PATCH NOTES FILL THE SCREEN AND FOLD', '0.303'],
    ['A MOUSE SCHEME FOR ONE HAND', '0.291'],
    ['A CLEANER, SOLID SETTINGS MENU WITH SWITCHES', '0.322'],
    ['A COLOUR BLIND DROPDOWN ON THE VIDEO PAGE, NAMED BY TYPE', '0.320'],
    ['A HUD SIZE SLIDER THAT ONLY STOPS ON CRISP SIZES', '0.320'],
    ['TEAM COLOURS FOR COLOUR-BLIND EYES', '0.288'],
    ['CLASS SELECT IS A LOBBY WITH BOTH TEAMS ON SCREEN', '0.275'],
    ['YOUR STAT SHEET FLIES IN WHEN A NUMBER MOVES', '0.272'],
    ['THE END SCREENS HAVE EMOTES, AND A LOBBY SHOWS EVERY RECORD', '0.270'],
  ]],
  ['SOUND AND SPEED', [
    ['NEW MUSIC, AND EVERY SOUND LEVELLED BY LOUDNESS', '0.278'],
    ['AN FPS CAP, AND A QUARTER OF EACH FRAME BACK', '0.271'],
    ['THE STEAM BUILD CARRIES ONLY WHAT THE GAME PLAYS', '0.276'],
    ['THE WEB BUILD OPENS TWO TO THREE TIMES FASTER', '0.396'],
    ['EACH FRAME DRAWS ABOUT A THIRD FASTER ON SLOWER PCS', '0.463'],
    ['EACH GAME STEP TAKES ABOUT 60% LESS TIME', '0.466'],
    ['A HIDDEN OR MINIMISED GAME NO LONGER DRAWS', '0.468'],
    ['THE EAGLES USE A QUARTER OF THE MEMORY', '0.469'],
  ]],
];
const DIGEST_FROM = '0.268'; // the oldest patch the digest covers, printed beside HIGHLIGHTS
const NOTES_W_MAX = 440;
const NOTES_PIC_MAX = 3; // the most a note's picture is scaled up
// the pictures notes show, by name (js/baked/notesart.js): {w, h, img}
const NOTES_PICS = {};
for (const [k, a] of Object.entries(window.NOTES_ART || {})) { const img = new Image(); img.src = a.src; NOTES_PICS[k] = { w: a.w, h: a.h, img }; }
// the groups, patches first: {id, name, items: [{text, v, pic}], digest}
const NOTES_GROUPS = (() => {
  const out = [];
  let g = null;
  for (const [v, text, pic] of PATCH_NOTES) {
    const tenth = v.slice(0, v.length - 1); // '0.387' -> '0.38'
    if (!g || g.tenth !== tenth) { g = { id: 'p:' + tenth, tenth, items: [] }; out.push(g); }
    g.items.push({ text, v, pic: NOTES_PICS[pic] || null });
  }
  for (const x of out) x.name = x.items.length > 1 ? x.items[x.items.length - 1].v + ' - ' + x.items[0].v : x.items[0].v;
  for (const [name, items] of PATCH_DIGEST) out.push({ id: 'd:' + name, name, digest: true, items: items.map(([text, v]) => ({ text, v })) });
  return out;
})();
// the roadmap's sections the same way: {id, name, items: [{text, done}], road}
const ROAD_GROUPS = ROADMAP.map(([name, items]) => ({ id: 'r:' + name, name, road: true, items: items.map(([done, text]) => ({ text, done: !!done })) }));
const notesOpen = new Set([NOTES_GROUPS[0].id, ...ROAD_GROUPS.map((g) => g.id)]); // the newest patches and every section start open
let notesScroll = 0, notesWrapW = 0;
const notesWrapped = new Map(); // item -> its lines, at notesWrapW
function notesGroups() { return state.menu.notesTab ? ROAD_GROUPS : NOTES_GROUPS; }
// everything the screen positions, in VIEW px: the column, the window, and
// each row with the y it draws at before the scroll
function notesLayout() {
  const cx = Math.round(VIEW_W / 2);
  const w = Math.min(NOTES_W_MAX, VIEW_W - 40), x = cx - (w >> 1);
  const winY = NOTES_TOP + 30, winH = VIEW_H - 22 - winY;
  const textW = w - 60;
  if (textW !== notesWrapW) { notesWrapW = textW; notesWrapped.clear(); }
  const groups = notesGroups(), road = !!state.menu.notesTab;
  const rows = [];
  let y = 0;
  const cap = (text, right) => { rows.push({ kind: 'cap', text, right, y, h: 9 }); y += 16; };
  if (!road) cap('EVERY PATCH', '');
  groups.forEach((g, gi) => {
    if (g.digest && gi && !groups[gi - 1].digest) { y += 8; cap('HIGHLIGHTS', DIGEST_FROM + ' - ' + PATCH_NOTES[0][0]); }
    rows.push({ kind: 'group', g, gi, y, h: 7 }); y += 12;
    if (!notesOpen.has(g.id)) return;
    for (const it of g.items) {
      let lines = notesWrapped.get(it);
      if (!lines) { lines = wikiWrap(it.text, textW); notesWrapped.set(it, lines); }
      // a picture sits under its text, scaled up by whole pixels to fit the text's width
      const ps = it.pic ? Math.max(1, Math.min(NOTES_PIC_MAX, Math.floor(textW / it.pic.w))) : 0;
      const ph = it.pic ? 4 + it.pic.h * ps : 0;
      rows.push({ kind: 'item', it, lines, ps, digest: g.digest, road: g.road, y, h: lines.length * 8 - 1 + ph }); y += lines.length * 8 + 3 + ph;
    }
    y += 4;
  });
  const maxScroll = Math.max(0, y - winH);
  notesScroll = Math.max(0, Math.min(maxScroll, notesScroll));
  const rail = { x: x + w + 6, y: winY, w: 2, h: winH };
  const th = Math.max(8, Math.round(rail.h * winH / Math.max(winH, y)));
  const thumb = { x: rail.x, y: rail.y + Math.round((rail.h - th) * (maxScroll ? notesScroll / maxScroll : 0)), w: 2, h: th };
  return { cx, x, w, winY, winH, rows, maxScroll, rail, thumb };
}
// what is under (mx, my): a tab, a group's header, the rail, or nothing
function notesHit(mx, my) {
  const tab = pageTabHit(mx, my);
  if (tab >= 0) return { kind: 'tab', i: tab };
  const L = notesLayout();
  if (L.maxScroll && mx >= L.rail.x - 3 && mx < L.rail.x + L.rail.w + 3 && my >= L.winY && my < L.winY + L.winH) return { kind: 'rail', y: my };
  if (my < L.winY || my >= L.winY + L.winH || mx < L.x || mx >= L.x + L.w) return null;
  for (const row of L.rows) {
    if (row.kind !== 'group') continue;
    const ry = L.winY + row.y - notesScroll;
    if (my >= ry - 2 && my < ry + 11) return { kind: 'group', gi: row.gi };
  }
  return null;
}
// the PATCH_TXT tag always opens on PATCH NOTES
function beginNotes() {
  const m = state.menu;
  m.screen = 'notes'; m.notesTab = 0; m.notesSel = 0; m.keyNav = false;
  notesScroll = 0;
  SFX.place();
}
function leaveNotes() { state.menu.screen = 'menu'; SFX.pickup(); }
function notesScrollBy(d) { notesScroll += d; notesLayout(); }
function notesToggle(gi) {
  const g = notesGroups()[gi];
  if (notesOpen.has(g.id)) { notesOpen.delete(g.id); SFX.pickup(); } else { notesOpen.add(g.id); SFX.place(); }
}
// the keys walk the groups: the pick lights, the window follows it, Enter
// folds it; left and right walk the tabs
function notesKey(k) {
  const m = state.menu;
  if (k === 'escape' || k === 'backspace') { leaveNotes(); return; }
  if (moveDir(k) === 'left') { if (!m.notesTab) m.wikiTab = WIKI_PAGES.length - 1; openPageTab(pageTabOpen() - 1); return; }
  if (moveDir(k) === 'right') { openPageTab(Math.min(PAGE_LINK_TAB - 1, pageTabOpen() + 1)); return; } // the keys never leave the game
  const d = moveDir(k) === 'up' ? -1 : moveDir(k) === 'down' ? 1 : 0;
  if (d) {
    if (m.keyNav) m.notesSel = Math.max(0, Math.min(notesGroups().length - 1, m.notesSel + d));
    m.keyNav = true;
    const L = notesLayout(), row = L.rows.find((r) => r.kind === 'group' && r.gi === m.notesSel);
    if (row.y - notesScroll < 20) notesScroll = row.y - 20;
    else if (row.y - notesScroll > L.winH - 40) notesScroll = row.y - L.winH + 40;
    notesLayout();
  } else if (k === 'enter' || k === ' ') { m.keyNav = true; notesToggle(m.notesSel); }
}
function notesClick() {
  const m = state.menu;
  if (m.notesT < 1) return;
  const h = notesHit(mouse.x, mouse.y);
  if (!h) return;
  if (h.kind === 'tab') openPageTab(h.i);
  else if (h.kind === 'group') { m.notesSel = h.gi; notesToggle(h.gi); }
  else if (h.kind === 'rail') { const L = notesLayout(); notesScrollBy(h.y < L.thumb.y ? -L.winH : h.y >= L.thumb.y + L.thumb.h ? L.winH : 0); }
}
// a chevron: right when folded, down when open, 5 px across
function drawNotesChevron(x, y, open, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < 3; i++) {
    if (open) ctx.fillRect(x + i, y + 1 + i, 5 - i * 2, 1);
    else ctx.fillRect(x + 1 + i, y + i, 1, 5 - i * 2);
  }
}
// a roadmap line's box, 5 px: an open ring to do, solid gold done
function drawRoadBox(x, y, done) {
  ctx.fillStyle = done ? '#c89a3c' : '#7a8bb8';
  if (done) { ctx.fillRect(x, y, 5, 5); return; }
  ctx.fillRect(x, y, 5, 1); ctx.fillRect(x, y + 4, 5, 1); ctx.fillRect(x, y + 1, 1, 3); ctx.fillRect(x + 4, y + 1, 1, 3);
}
// the tabs over it are drawPageTabs, called once for both screens
function renderNotes(now, a) {
  const m = state.menu, L = notesLayout();
  const lift = Math.round((1 - a) * 20);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(6,10,24,0.86)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const hit = m.notesT >= 1 && mouse.inside && !m.keyNav ? notesHit(mouse.x, mouse.y) : null;
  // only whole rows: one cut through its letters at the window's edge reads as a glitch
  const right = L.x + L.w;
  for (const row of L.rows) {
    const y = L.winY + row.y - notesScroll + lift;
    if (y < L.winY || y + row.h > L.winY + L.winH) continue;
    if (row.kind === 'cap') {
      drawPixelTextShadow(ctx, row.text, L.x, y, TIP_LABEL, '#0a0e23');
      if (row.right) drawPixelTextShadow(ctx, row.right, right - pixelTextWidth(row.right), y, TIP_LABEL, '#0a0e23');
      ctx.fillStyle = '#2c3a68'; ctx.fillRect(L.x, y + 8, L.w, 1);
    } else if (row.kind === 'group') {
      const g = row.g, open = notesOpen.has(g.id);
      const hot = (hit && hit.kind === 'group' && hit.gi === row.gi) || (m.keyNav && m.notesSel === row.gi);
      const col = hot ? '#ffd95c' : open ? '#f4f7ff' : '#9fb6d8';
      drawNotesChevron(L.x + (hot ? 1 : 0), y, open, col);
      drawPixelTextShadow(ctx, g.name, L.x + 10, y, col, '#0a0e23');
      if (g.road) { // a section's count, done over all, dim on the right
        const n = g.items.filter((it) => it.done).length + ' / ' + g.items.length;
        drawPixelTextShadow(ctx, n, right - pixelTextWidth(n), y, '#5a6690', '#0a0e23');
      }
    } else {
      // a digest line: the text indented, its patch dim on the right; a
      // roadmap line: its box where the digest's dot is; a patch: its
      // number in gold where the digest's text starts
      const it = row.it;
      if (row.road) {
        drawRoadBox(L.x + 10, y + 1, it.done);
        row.lines.forEach((l, i) => drawPixelTextShadow(ctx, l, L.x + 20, y + i * 8, it.done ? '#5a6690' : '#cfe0ff', '#0a0e23'));
      } else if (row.digest) {
        ctx.fillStyle = '#5a6690'; ctx.fillRect(L.x + 11, y + 2, 1, 1);
        row.lines.forEach((l, i) => drawPixelTextShadow(ctx, l, L.x + 16, y + i * 8, '#cfe0ff', '#0a0e23'));
        drawPixelTextShadow(ctx, it.v, right - pixelTextWidth(it.v), y, '#5a6690', '#0a0e23');
      } else {
        drawPixelTextShadow(ctx, it.v, L.x + 10, y, '#c89a3c', '#0a0e23');
        row.lines.forEach((l, i) => drawPixelTextShadow(ctx, l, L.x + 36, y + i * 8, '#9fb6d8', '#0a0e23'));
        if (it.pic && it.pic.img.complete) {
          ctx.save(); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(it.pic.img, L.x + 36, y + row.lines.length * 8 + 3, it.pic.w * row.ps, it.pic.h * row.ps);
          ctx.restore();
        }
      }
    }
  }
  if (L.maxScroll) { // a hairline rail and a gold thumb, no nubs
    ctx.fillStyle = '#1c2750'; ctx.fillRect(L.rail.x, L.rail.y, L.rail.w, L.rail.h);
    ctx.fillStyle = '#c89a3c'; ctx.fillRect(L.thumb.x, L.thumb.y, L.thumb.w, L.thumb.h);
  }
  drawBackHint(ctx, VIEW_W / 2, VIEW_H - 13);
  ctx.globalAlpha = 1;
}
