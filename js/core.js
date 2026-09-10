'use strict';
// Softfall's base layer: the numbers with no one owner - the tile grid, the
// view, the day cycle and the economy - plus the seeded rng, the state and
// settings singletons, and the small helpers with the most inbound edges.
// Tuning for one feature lives with that feature; see docs/dev/architecture.md.
// ------------------------------------------------------------ constants
const TILE = 16;
// ?practice=1 boots the training arena instead of a match (the full story on
// the `Practice mode` comment below) - parsed HERE, above WORLD, because the
// practice world is a small one: the training field plus a forest collar for
// the ice parkour, against the match's 232. Everything downstream sizes
// itself off WORLD (the ground arrays, the ground bake, both maps, the
// camera clamps), so the match world is untouched.
const PRACTICE = /[?&]practice=1/.test(location.search);
const WORLD = PRACTICE ? 76 : 232; // tiles per side (match: ~132-tile open interior, 2x the old 92's area; treeline depth unchanged); practice: field + a collar deep enough that the parkour runs INSIDE the forest, not along its hem
let VIEW_W = 640, VIEW_H = 360; // internal resolution; fitCanvas() sizes it to the window
let FULL_W = 640; // window width in game px BEFORE the 16:9 cap (bars canvas span)
// The frame the menus, the panels and the end screens were authored in: 270
// rows, the view's height before 3.22 widened it to 360. They stay centred
// in the taller view rather than stretched, so a screen lays itself out from
// frameTop() down - never against VIEW_H / 2, which would drift its planks
// off the art authored around them (menuLayout, js/menu.js is the pattern).
const FRAME_H = 270;
function frameTop() { return Math.round((VIEW_H - FRAME_H) / 2); }
const DAY_LEN = 110, NIGHT_LEN = 55;
const CYCLE = DAY_LEN + NIGHT_LEN;

// The one piece of the shoal's tuning that is not in js/wildlife.js with the
// rest of it: `state` below reads it at load time, and a const declared in a
// file that loads later does not exist yet when this one runs.
const FISH_SPAWN_T = 11;   // seconds between new fish while the shoal is healthy

// One currency, many sources. Every source pays gold with a different yield profile
// (burst on completion, or per kill); this table is the whole economy, with one
// source outside it: the clock, which pays every player on the ground a coin every
// TRICKLE_T s (the passive income banner, js/sim.js). The per-swing rows are 0 -
// a swing is work, the fell is the pay - because a per-swing coin on a one-second
// pine was the firehose that had every bot at the level cap by two minutes.
const YIELD = {
  treeHit: 0,   treeFall: 1,            // 3 hp tree  -> 1 gold, slow and safe (TREE_HP, js/world.js)
  treeRare: 3,                          // rare-tree jackpot on top of the fall payout (1 pine in 12: four trees' worth)
  rockHit: 0,   rockBreak: 3,           // 5 hp rock  -> 3 gold, better per swing than a pine, and a find 1 in 5
  deadTreeHit: 0, deadTreeFall: 1,      // 3 hp snag  -> 1 gold, the rookery's cover; leaves a stump
  rabbit: { coins: 2, each: 5 },        // 10 gold + a berry, but it bolts
  deer:   { coins: 3, each: 6 },        // 18 gold, the big mobile target
  wolf:   { coins: 3, each: 8 },        // 24 gold, a den's four: the resource camp, and it bites back once woken
  alpha:  { coins: 4, each: 10 },       // 40 gold, the buff camp's one - and the kill wears its blood (campBuff, js/wildlife.js)
  dire:   { coins: 6, each: 15 },       // 90 gold to the killer, the epic camp's one - and EPIC_TEAM_GOLD to every teammate besides
  bird:   { coins: 2, each: 4 },        // 8 gold, and the hardest shot in the game (dormant: nothing spawns a bird now)
};

// ------------------------------------------------------------ rng
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Practice mode: ?practice=1 (the PRACTICE const above WORLD) boots the
// training arena (the `practice arena` banner, js/world.js) instead of a
// match - no title menu, no eagles, no other players, and the clock pinned to
// early morning (sim.js never advances state.time under PRACTICE). It pins
// SEED to a constant BELOW ?seed on purpose, so the arena is the same ground
// on every machine every time: a practice room the seed can never reshuffle.
// Entered from the menu plank (menu.js beginPractice), left from the ESC
// panel (leavePractice) - both are page reloads, like the reroll.
const PRACTICE_SEED = 0x50524143; // 'PRAC'

// one run seed drives every deterministic value: worldgen, per-tile hashes, fx.
// ?seed=N in the URL replays a world exactly.
const SEED = (function () {
  if (PRACTICE) return PRACTICE_SEED;
  const q = /[?&]seed=([0-9]+)/.exec(location.search);
  if (q) return (parseInt(q[1], 10) >>> 0) || 1;
  return ((Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0) || 1;
})();
const SEED_TXT = 'SEED ' + SEED;
const rng = mulberry32(SEED);
function rand(a, b) { return a + rng() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }

// ------------------------------------------------------------ state
const state = {
  mode: 'title', // title | drop | play | dead  (drop = riding / falling from the eagle; dead = the local player is out of the match, or it is over)
  time: DAY_LEN * 0.25, // start mid-morning
  elapsed: 0,
  day: 1,
  tick: 0,       // sim steps taken; with SEED + player id it decides contested orders
  darkness: 0,
  // the weather's one wind field (the `wind` banner, js/sim.js): windT is its
  // clock, wind its strength 0..1 - full by day, nothing at all by full dark -
  // and windDir which quarter it is running from, -1..1, veering over minutes
  wind: 0.7, windT: 0, windDir: 1,
  // seconds of sun shafts still owed after the eagle drop (landPlayer sets it,
  // updateFx counts it down, rayLight reads it - js/draw-world.js)
  rayT: 0,
  shake: 0,
  deadTimer: 0,
  // out of the match: the overlay's state. over: 'lost' | 'won' | null; view:
  // 'menu' (the planks) | 'spec' (following a living player); spec: that player's
  // id; sel + hover: the planks' keyboard pick and per-plank hover eases
  over: null, deadView: 'menu', spec: -1, deadSel: 0, deadHover: [0, 0],
  // the replay window over a respawn wait has been closed (endMatch reopens it)
  rpClosed: false,
  // a win or an elimination freezes the numbers its end screen prints
  // (endSnapshot(), the victory banner); defeatT is the loss summary's own
  // clock, started when that view opens rather than when the player went down
  end: null, defeatT: 0,
  msg: null, msgT: 0,
  fishT: FISH_SPAWN_T, // countdown to the next fish swimming in (see updateFish)
  loc: null,     // the named place the local player is standing in: { L, t }
  dayPop: null,  // the dawn headline, top centre: { day, t } - set by each dawn and the landing (js/sim.js), drawn by renderUI
  paused: false,
  mapOpen: false,
  bagOpen: false,      // the inventory drawer under the weapon shelf (B, or its tab): HUD, it does NOT stop the sim
  charOpen: false,     // the character panel (G): HUD, it does NOT stop the sim either
  // the MERCHANT whose counter is open (js/shop.js), or null. HUD like the two
  // above - the sim runs on underneath - and it holds the merchant itself
  // rather than a flag, because walking out of that body's reach is what shuts it.
  shop: null,
  // an item riding the pointer between the grid, the four weapon slots and a
  // tool's own bit cells: { cell, from } - see the drag banner in js/ui.js. The
  // cell is the same object the bag held, so a tool keeps its bits across it.
  drag: null,
  // a press on a holdable cell that has not travelled far enough to become a
  // drag yet: { src, x, y }. Resolves as a plain click if the button comes
  // back up without moving - see the drag banner in js/ui.js.
  dragPend: null,
  settingsOpen: false,
  rebind: null,        // a cap on the CONTROLS page listening for its key: the action's id (input.js), or null
  // radial menu: { kind: 'build'|'manage'|'flag'|..., tx, ty, seg, ax, ay } - ax/ay is the
  // press point; a flag wheel opened over the chart carries sx/sy, the screen
  // point it is pinned to instead of its tile (wheelLayout, js/ui.js)
  wheel: null,
  // the build list (T, js/ui.js): { sel, rot } while it is open - the row
  // picked and whether the piece is turned; the ghost under the pointer is
  // what a click lays. Null while it is closed.
  build: null,
  // main menu (mode === 'title'): keyboard selection, per-item hover eases,
  // the open sub-panel ('settings' | 'help' | 'patch' | 'name' | null) and its slide progress
  // one hover ease per MENU_ITEMS entry + the seed row. That length is a
  // coupling to a table in a file that loads later, so the ease loop tops up a
  // missing cell rather than trusting it - a short array turned into NaN and
  // silently deleted the seed row when the fifth plank arrived.
  menu: { sel: 0, hover: [0, 0, 0, 0, 0, 0], t: 0,
    panel: null, panelT: 0, closing: false, patchScroll: 0, // patchScroll: px the notes are scrolled
    // the PLAYER panel (the `player profile` banner): the name being typed,
    // the refusal rattle and the two planks' hover eases
    nameBuf: '', nameShake: 0, nameHover: [0, 0],
    moved: false, dieT: 0, rolling: 0, camT: 0, pressT: 0,
    // frozen planks: refusal shudder timer, which plank was struck (menu index),
    // per-knock crack seed, the struck point (plank-local) and the ice chips it sprays (screen-space).
    // iceMarks: the PRACTICE TOOL plank's standing cracks - one per knock, and
    // the third knock breaks the sheet for good (menu.js iceRefuse)
    iceT: 0, iceI: -1, iceSeed: 0, iceX: 0, iceY: 0, shards: [], iceMarks: [],
    // class select: which screen the menu shows, its cross-fade, the chosen
    // class, per-portrait hover eases (a seed pair - updateTitle's `|| 0`
    // grows it with the roster, since CLASSES loads after this file), swap
    // pop, lock-in hold.
    // screen: 'menu' | 'select' | 'gear' | 'wiki'. 'gear' is the pop-up over
    // the still-lit select screen (gearT its ease, grow the keyboard row,
    // gearFxT/gearFxSlot the equip flash); the wiki is a surface of its own
    // on wikiT, with wikiTab the open page (menu.js `the wiki`).
    screen: 'menu', screenT: 0, csel: 0, chover: [0, 0], cswapT: 1, lockT: 0,
    // countT: seconds left of PLAY's countdown to the eagle (0 = not counting),
    // countN the last whole second it ticked on (-1 = never pressed, 0 = it
    // ran out); dhover the three difficulty notches' hover eases (menu.js
    // `class select`)
    countT: 0, countN: -1, dhover: [0, 0, 0],
    gearT: 0, grow: 0, gearFxT: 0, gearFxSlot: 0, wikiT: 0, wikiTab: 0 },
  intro: 0,            // seconds left of the title -> drop / landing -> play transition (0 = none)
  introLen: 1,         // that transition's full length (the camera ease divides by it)
  introFrom: null,     // camera position the transition started from
  drop: null,          // the eagle while it is in the air: see makeEagleRoute() / beginDrop()
  // the DROP BRIEF: a local player that never jumped rides the landing, and the
  // crash pans the camera to both roosts and states the objective before
  // handing the controls (and the E hop off the bird) back -
  // { ph: 'wait'|'theirs-go'|'theirs'|'ours-go'|'ours', t, total }, run by
  // updateDrop (js/boot.js), camera in js/sim.js, text in drawDropBrief.
  dropBrief: null,
  fade: null,          // screen fade: { a, to, spd, color, then }
};

// volume is the master dial; musicVol and sfxVol sit under it (SFX.setVolume /
// setMusicVolume / setSfxVolume). A save written before the split simply has
// neither key and keeps the defaults - no version bump needed.
const settings = { v: 2, volume: 0.5, musicVol: 0.7, sfxVol: 1, mmR: 24, mmZoom: 5, hudScale: 0.8, shake: true, muted: false, info: false, pixelCursor: true, hitbox: 0,
  // your side is painted BLUE and the rival side RED whatever team the roster
  // dealt you (skin(), js/player.js); off = the roster's real colours
  teamBlue: true,
  // the rival bots' difficulty: an index into AI_LEVELS (js/ai.js), picked on
  // class select's notches and remembered; 0 (NORMAL) until someone moves it
  aiLevel: 0,
  // the VIDEO page's dressing toggles, all cosmetic-only passes a weak GPU
  // can shed (the ESC panel's QUALITY row presets them; panels.js)
  vidClouds: true, vidRays: true, vidStars: true, vidSnow: true, vidVig: true,
  // phone mode (js/mobile.js): 'auto' reads the device, 'on'/'off' force it -
  // the TOUCH MODE row. hudScaleM is the HUD SIZE a phone plays at; the same
  // slider edits whichever of the two is live (hudSc, ui.js)
  mobile: 'auto', hudScaleM: 1.25,
  // the pad's rumble and a phone's buzz on a gesture that moves an item
  // (haptic, js/input.js). A mouse has no motor and never notices this row.
  haptics: true };
// Minimap zoom ladder, px per world tile: index settings.mmZoom (5 = the 1:1
// baseline). Twice the rungs and twice the reach of the old six, and like the
// camera it eases between them rather than snapping - mmCur is what anything
// drawing the disc reads.
const MM_ZOOMS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.6, 2, 2.5, 3.2, 4];
// saves written before settings.v existed hold an index into the old
// [0.5, 0.75, 1, 1.5, 2, 3]; land each one on its nearest new rung
const MM_MIGRATE = [2, 3, 5, 7, 8, 10];
let mmCur = -1; // eased px per tile; negative = not yet snapped to the setting
function mmStep() { return Math.max(0, Math.min(MM_ZOOMS.length - 1, settings.mmZoom | 0)); }
function mmWant() { return MM_ZOOMS[mmStep()]; }
function mmScale() { return mmCur < 0 ? mmWant() : mmCur; }
// pointer over the minimap disc (its ring included)
function overMinimap() { return mouse.inside && Math.hypot(mouse.x - MM_CX, mouse.y - MM_CY) <= MM_R + 7; } // to the outline's outer edge

// performance monitor: fps averaged over half-second windows from raw
// (unclamped) frame deltas, so sim clamping can't mask slow frames
const perf = { fps: 0, frames: 0, acc: 0 };

// Settings live UNDER the profile - PROFILE.putSettings / PROFILE.settings,
// js/profile.js, the one file in the game that touches storage. A pre-profile
// save under the old 'softfall.settings' key is folded in by PROFILE.load()
// before this ever runs, so the mmZoom migration below still sees it.
function saveSettings() { PROFILE.putSettings(settings); }
function loadSettings() {
  try {
    const s = PROFILE.settings(); // null when this profile has never saved any
    if (s) Object.assign(settings, s);
    // a save from before the minimap ladder grew: its mmZoom indexes the old
    // six-rung array, so carry it across instead of silently rescaling the
    // disc under someone who had already set it where they wanted it
    if (s && s.v !== 2) {
      settings.mmZoom = MM_MIGRATE[Math.max(0, Math.min(MM_MIGRATE.length - 1, s.mmZoom | 0))];
      settings.v = 2;
    }
  } catch (e) { }
  mmCur = mmWant();
}
// The disc sits in the top-right corner with the SAME gap to both edges
// (MM_GAP, measured from the black outline's outer edge at MM_R + MM_OUT),
// so it reads as one compact shape tucked into the corner, not a thing
// hugging one edge and floating off the other.
const MM_OUT = 7;  // outline's outer radius past MM_R (mmChrome, ui.js)
const MM_GAP = 4;  // px of screen between the outline and either edge
function applyMinimapSize() {
  MM_R = settings.mmR;
  MM_CX = VIEW_W - MM_R - MM_OUT - MM_GAP;
  MM_CY = MM_R + MM_OUT + MM_GAP;
}
// recompute everything positioned off VIEW_W/VIEW_H; must run after any
// change to the canvas size (window resize, fullscreen)
function relayout() {
  applyMinimapSize();
  fitMapSlab();
  PANEL_X = Math.round((VIEW_W - PANEL_W) / 2);
  PANEL_Y = Math.round((VIEW_H - PANEL_H) / 2);
  MAP_X = PANEL_X + MAP_SIDE; MAP_Y = PANEL_Y + MAP_HEAD;
  SET_X = Math.round((VIEW_W - SET_W) / 2);
  SET_Y = Math.round((VIEW_H - SET_H) / 2);
  SL_X = SET_X + 112;
  SET_MUTE_X = SL_X - 14;
  fitFlakes();
  renderBars();
  layoutReplay();
}

// ------------------------------------------------------------ helpers
function showMsg(t, dur) { state.msg = t; state.msgT = dur || 5; }

// seconds as M:SS - the HUD's match clock and the victory tally's, one source
function clockTxt(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function addFloater(x, y, txt, color) {
  floaters.push({ x, y, txt, color: color || '#ffffff', t: 0 });
}

// combat damage numbers: gold for damage the player's side deals, red '-N'
// for damage taken. Heavy hits (10+) render at 2x; a little random drift
// keeps rapid repeat hits from stacking into one unreadable pile.
function addDmgFloater(x, y, amount, taken, crit) {
  const n = Math.max(1, Math.round(amount));
  floaters.push({
    x: x + rand(-3, 3), y,
    txt: taken ? '-' + n : String(n),
    // a crit keeps the red-taken / gold-dealt language and runs hotter inside it
    color: taken ? (crit ? '#ff9a6a' : '#ff6a5a') : (crit ? '#fff0b0' : '#ffd95c'),
    t: 0, vx: rand(-9, 9), scale: crit || n >= 10 ? 2 : 1, rise: crit ? 27 : 20,
  });
}

// an ambush arrow landing, on whatever it lands on: a gold flare over the
// ordinary hit puff and a crack that never sounds like a normal shot
function ambushFx(x, y) {
  burst(x, y, '#fff4d0', 10, 90, 0.4);
  burst(x, y, '#ffd95c', 7, 55, 0.5);
  if (nearPlayer(x, y)) SFX.ambush();
}

function burst(x, y, color, n, spd, life, grav) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = rand(0.3, 1) * (spd || 40);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - (grav ? 20 : 0),
      life: rand(0.5, 1) * (life || 0.5), maxLife: 0.4, color, size: rng() < 0.3 ? 2 : 1, grav: grav ? 90 : 0,
    });
  }
}

// n = how much the pickup is worth. type is always an ITEMS key now (berry,
// fish, a card) - gold is paid on the spot through awardGold, never dropped.
// `it` is the instanced cell an item with state of its own travels as - a
// tool and the bits loaded into it. It is the SAME object the bag held and the
// same one the bag gets back, so a tool never loses its build to a throw, a
// death or a hand-off. Plain stacking items leave it undefined.
function spawnDrop(x, y, type, n, it) {
  const a = rng() * Math.PI * 2;
  const d = { x, y, vx: Math.cos(a) * rand(20, 45), vy: Math.sin(a) * rand(20, 45) - 30, z: 0, vz: rand(30, 60), type, n: n || 1, t: 0, it: it || null, lock: -1, lockT: 0, fade: 0 };
  drops.push(d);
  return d;
}
// A THROW IS NOT A SPILL. Something let go on purpose - dragged out of the
// pack onto the snow, or shaken off a discarded tool - leaves along a heading
// with real speed behind it, and is DEAF TO THE HAND THAT THREW IT for
// TOSS_LOCK_T seconds. Without that second half the pickup magnet simply
// hands back what you just decided to be rid of, and a bag you cannot empty
// standing still is a bag with no throw in it at all. The lock is ONE
// player's (`lock`, a player id): everyone else may take it the instant it
// lands, which is what keeps a hand-off across a fight working.
const TOSS_SPEED = 130;  // px/s a thrown item leaves the body at
const TOSS_LOCK_T = 3;   // s it refuses the hand that threw it
// on top of the little hop spawnDrop already gave it: the heading a throw
// carries, plus a touch more height so a fling reads as a fling
function flingDrop(d, vx, vy) { d.vx += vx; d.vy += vy; d.vz += 26; return d; }
function lockDrop(d, p) { d.lock = p ? p.id : -1; d.lockT = TOSS_LOCK_T; return d; }
// the question the pickup asks before magnetising or claiming anything
function dropLocked(d, p) { return d.lockT > 0 && d.lock === p.id; }

// A DROP NOBODY IS MEANT TO GET. Kit that comes off a body and is worth less
// than the litter it would leave falls, hops and casts its shadow like
// anything else - so a death still READS as a spill - and then EVAPORATES:
// it lifts VANISH_LIFT px, thins to nothing over VANISH_T and goes, out of
// everybody's reach the whole way. It never magnetises, never glints and
// never claims, because a glint says "walk to this" and nobody can have it.
// What goes this way and why: evaporateTool, js/tools.js.
const VANISH_T = 0.8;            // s a drop takes to go
const VANISH_LIFT = 6;           // px it rises while it does
const VANISH_COL = '#cfe0f2';    // the pale motes of the puff it leaves behind
function vanishDrop(d) { d.fade = VANISH_T; return d; }
// the question every loot path asks before it wants a drop at all - the
// pickup loop (updatePlay, js/sim.js), the bot's loot scan (js/ai.js) and
// both drop passes (js/render.js)
function dropGone(d) { return d.fade > 0; }

// wallets are per player: every cost check and payment names whose it is
function canAfford(cost, p) { const w = (p || player).inv; for (const k in cost) if ((w[k] || 0) < cost[k]) return false; return true; }
function pay(cost, p) { const w = (p || player).inv; for (const k in cost) w[k] -= cost[k]; }
// A COUNT ON THE HUD, cut to four characters. Gold and the two meals have no
// ceiling any more - a purse and a pouch both climb all match - so past a
// thousand the number carries its MAGNITUDE instead of its digits: 999, then
// 1.2K, 12K, 340K, 1.2M. What a HUD number is being read for is "about how
// much", and a fifth digit only pushes its neighbour along the strip; the
// exact figure still lives in the tooltip, the one surface whose job is
// comparing numbers (CLAUDE.md's instrument carve-out).
const NUM_SUFFIX = ['', 'K', 'M', 'B', 'T'];
function shortNum(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  let i = 0;
  while (n >= 1000 && i < NUM_SUFFIX.length - 1) { n /= 1000; i++; }
  // the decimal is only worth a character while it says something: 1.2K, but
  // 12K - and it is TRUNCATED, so a number never rounds up past a threshold
  // it has not reached
  const t = n < 10 ? (Math.floor(n * 10) / 10).toFixed(1).replace('.0', '') : String(Math.floor(n));
  return t + NUM_SUFFIX[i];
}
function costText(cost) {
  const parts = [];
  for (const k in cost) if (cost[k] > 0) parts.push(cost[k] + ' ' + k.toUpperCase());
  return parts.join('  ');
}

// ---- food: a meal is a channel, not a keypress ---------------------------
// Berries and fish answer the same question - "can I take this fight" - so
// they share ONE clock: eating either puts both away for FOOD_CD. And the meal
// itself takes time you have to survive, because a heal you can tap out from
// under an arrow is a heal nobody gets to play around.
//
// Nothing is spent up front. The food leaves the bag and the cooldown starts
// when the channel LANDS, exactly the way an ability's cooldown starts when
// its cast does (js/abilities.js), so a meal knocked out of your hands costs
// the time and nothing else. `breakEat` is every way one is knocked out - a
// hit, a stun, the ice - and every way one is DROPPED on purpose: the roll,
// and the fire button, which cancels the meal and draws in the same frame so a
// body chewing is never a body that cannot fight back (updatePlayer, sim.js).
// The two keys that stay refused mid-meal are the E swing and an ability -
// both spend a cooldown a stray press should not.
const FOOD_CD = 3;       // shared by both meals: the clock belongs to the food, not the type
const FOOD_EAT = 1.5;    // the channel, interruptible for its whole length
const FOOD_SLOW = 0.5;   // eating walks you - the same drag a cast puts on the legs
const FOOD_FX_T = 0.12;  // seconds between crumbs while chewing

// Q / F and a click on a food cell all arrive here. Refused - the meal button
// that was asked reddens and shakes and speaks the deny (foodDenied, ui.js,
// the pack's and the weapon well's own refusal) - while the clock is up, the
// body is busy, or there is nothing a meal could do.
function startEat(p, type) {
  if (p.dead || p.eatT > 0 || p.foodCd > 0 || p.hp >= p.maxHp ||
    bagCount(p, type) <= 0 || p.stunT > 0 || p.fallT > 0 || p.dodgeT > 0 ||
    p.castT > 0 || p.rushT > 0 || inAir(p)) {
    if (p === player) foodDenied(type);
    return;
  }
  p.eatT = FOOD_EAT;
  p.eatType = type;
  p.eatFxT = 0;
  if (p.charging) { p.charging = false; p.chargeT = 0; } // the bow comes down for the meal
  p.fireArmed = false;
  if (nearPlayer(p.x, p.y)) SFX.eat();
}

// the two edge-triggered intents (the input struct, multiplayer.md) - still
// two names because Q and F are two keys and two meals, even though one clock
// now covers both
function eatBerry(p) { startEat(p, 'berry'); }
function eatFish(p) { startEat(p, 'fish'); }

// DRAWING A CARD. The card key and a click on the strip's card button both
// arrive here: one unopened card is taken at random from everything the
// pouch holds (so a rarer card is exactly as likely as it is common in your
// hand), one entry of its rarity is picked at random, and the buff lands on
// the spot - onto p.cards, into the kit, and as a burst in the rarity's
// colour with the card's name rising out of it. No screen, no choice, no
// pause: the pick of three was the one thing in the game that asked you to
// read a menu mid-fight. Refused with nothing to draw (cardDenied, ui.js -
// the button's own red), like a meal with nothing behind it. A bot draws
// through resolveCardForBot (js/ai.js) and never comes here.
function useCard(p) {
  if (p.dead) { return; }
  let total = 0;
  for (const r of CARD_RARITIES) total += bagCount(p, cardKey(r));
  if (total <= 0 || inAir(p)) { if (p === player) cardDenied(); return; }
  let pick = Math.floor(rng() * total), rarity = CARD_RARITIES[0];
  for (const r of CARD_RARITIES) { pick -= bagCount(p, cardKey(r)); if (pick < 0) { rarity = r; break; } }
  bagTake(p, cardKey(rarity), 1);
  const id = Math.floor(rng() * CARDS[rarity].length);
  p.cards.push({ rarity, id });
  refreshKit(p);
  const col = RES_COLORS[cardKey(rarity)];
  cardFx(p.x, p.y, col);
  addFloater(p.x, p.y - 18, CARDS[rarity][id].name, col);
  if (nearPlayer(p.x, p.y)) SFX.levelUp();
}
// the buff landing: a ring of sparks thrown out and up in the card's colour,
// a white flare in the middle, and a slow column of motes climbing out of
// the body for a moment after - the level-up's own language, in the rarity's
// ink, so what you just became is read at a glance from across the clearing
function cardFx(x, y, color) {
  burst(x, y - 6, '#fff6d8', 8, 60, 0.35);
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2, s = rand(30, 70);
    particles.push({ x, y: y - 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 40,
      life: rand(0.5, 0.9), maxLife: 0.5, color, size: rng() < 0.4 ? 2 : 1, grav: 60 });
  }
  for (let i = 0; i < 14; i++) {
    particles.push({ x: x + rand(-7, 7), y: y + rand(-4, 4), vx: rand(-4, 4), vy: rand(-55, -25),
      life: rand(0.7, 1.2), maxLife: 0.6, color, size: 1, grav: 0 });
  }
}

// The meal ticking, and the shared clock beside it. Called from updatePlayer
// next to the ability clock, for every player alike.
function updateEat(p, dt) {
  if (p.foodCd > 0) p.foodCd = Math.max(0, p.foodCd - dt);
  if (p.eatT <= 0) return;
  p.eatT -= dt;
  // crumbs at the mouth for the whole channel: a meal is a tell a rival can
  // act on, and a buried body gives it away exactly as little as its bars do
  p.eatFxT -= dt;
  if (p.eatFxT <= 0) {
    p.eatFxT = FOOD_FX_T;
    particles.push({
      x: p.x + rand(-3, 3), y: p.y - 5, vx: rand(-9, 9), vy: rand(-20, -8),
      life: rand(0.3, 0.5), maxLife: 0.4, color: RES_COLORS[p.eatType],
      size: 1, grav: 45, alpha: 1 - concealOf(p),
    });
  }
  if (p.eatT > 0) return;
  const type = p.eatType;
  p.eatT = 0;
  p.eatType = null;
  if (bagCount(p, type) <= 0) return; // spilled out from under the meal
  bagTake(p, type, 1);
  p.foodCd = FOOD_CD;
  const heal = Math.round(ITEMS[type].heal * kitOf(p).foodMul); // HEARTHWEAVE makes meals bigger
  p.hp = Math.min(p.maxHp, p.hp + heal);
  if (nearPlayer(p.x, p.y)) SFX.heal();
  addFloater(p.x, p.y - 14, '+' + heal, '#8fe08a');
  burst(p.x, p.y - 8, RES_COLORS[type], 6, 30, 0.4);
}

// The meal dropped, from every side that can drop one. Nothing is spent, so an
// interruption costs the time and the tempo and nothing out of the bag.
function breakEat(p) {
  if (p.eatT <= 0) return;
  burst(p.x, p.y - 6, RES_COLORS[p.eatType] || '#f4f7ff', 4, 34, 0.35, true);
  p.eatT = 0;
  p.eatType = null;
}

