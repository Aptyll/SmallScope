'use strict';
// Softfall's base layer: the numbers with no one owner - the tile grid, the
// view, the day cycle and the economy - plus the seeded rng, the state and
// settings singletons, and the small helpers with the most inbound edges.
// Tuning for one feature lives with that feature; see docs/dev/architecture.md.
// ------------------------------------------------------------ constants
const TILE = 16;
// the field is square and mirrored left to right: its whole layout is
// js/sim/field.js, written in tiles against this one number
const WORLD = 140; // tiles per side
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

// The one piece of the shoal's tuning that is not in js/sim/wildlife.js with the
// rest of it: `state` below reads it at load time, and a const declared in a
// file that loads later does not exist yet when this one runs.

// One currency, many sources. Every source pays gold with a different yield profile
// (burst on completion, or per kill); this table is the whole economy, with the
// others beside their own systems: the clock, which pays every player on the
// ground TRICKLE_GOLD every TRICKLE_T s (the passive income banner, js/sim/sim.js),
// START_GOLD (js/sim/player.js), a soldier's last hit (SOLDIER_BOUNTY,
// js/sim/farm.js, shared by kind: SOLDIER_TYPES), a takedown (KILL_SOLDIERS
// TAKEDOWN_GOLD shares, js/sim/player.js) and a held pump.
// The scale is League's: a finished item is ~2600-3400 (BUILD_ITEMS,
// js/sim/items.js), and a laner who lands two in three last hits holds one at about 5:00.
// A beast's `xp` is the one thing here that is not gold: what its death is worth
// to the hunter's side standing near it (animalDies, js/sim/wildlife.js). The works pay no XP. The per-swing rows are 0 -
// a swing is work, the fell is the pay - because a per-swing coin on a one-second
// pine was the firehose that had every bot at the level cap by two minutes.
const YIELD = {
  // A pine is side income, never the farm: most fell for nothing and a `rare`
  // one holds a little gold. Every pine on the 3v3 field is a wall pine that
  // never falls (treeFells, js/sim/world.js), so this pays only a pine that can.
  treeHit: 0,   treeFall: 0,            // the fell itself pays nothing...
  treeRare: 14,                         // ...and a gold pine pays this on the fell
  rabbit: { coins: 2, each: 35 },       // 70 gold, but it bolts
  wolf:   { coins: 2, each: 55, xp: 15 }, // 110 gold, a den's four (440): the jungle's farm, a soldier's last hit apiece, and it bites back once woken
  scrap:  { coins: 2, each: 55, xp: 15 }, // the stray robots: a wolf's pay
  orca:   { coins: 8, each: 110, xp: 300 }, // the orca's pay: 880 gold to the killer, and EPIC_TEAM_GOLD to every teammate besides
  alpha:  { coins: 6, each: 105, xp: 150 }, // the black bear's pay: 630 gold to the killer, and EPIC_TEAM_GOLD to every teammate besides
  bird:   { coins: 2, each: 28 },       // 56 gold, and the hardest shot in the game (dormant: nothing spawns a bird now)
};

// ------------------------------------------------------------ rng
// The stream's whole state is the one integer on the function (`.s`), not a
// closed-over local, so a saved match (js/sim/save.js) can write it down and put
// it back: a loaded game draws the very next number the saved one would have.
function mulberry32(a) {
  const r = function () {
    const a = r.s = (r.s + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.s = a | 0;
  return r;
}
// THE MAP: every match and every screen play on the one
// valley this grows (worldRng, and hash2/vnoise under every per-tile look).
// It is a constant, never rolled and never sent: a page is born on the map.
const MAP_SEED = 471;
// SEED starts the MATCH's own stream: rng, fxRng, matchHash, the bots' sealed
// random. Rolled when the page loads, so no two matches play out alike, and
// never shown; ?seed=N pins it, which a tool uses to replay a bot match. It
// never touches the map. Only the host's matters: a client paints what the
// host sends, and nothing a client works out itself reads it.
const SEED = (function () {
  const q = /[?&]seed=([0-9]+)/.exec(location.search);
  return q ? (parseInt(q[1], 10) >>> 0) || 1 : (Math.floor(Math.random() * 0x7ffffffe) + 1);
})();
// a hash of (a, b) that differs match to match (hash2 is the map's, the same
// every match): for the host's own picks, a bot's first hero, a tie-break
function matchHash(a, b) { return hash2((a ^ SEED) | 0, (b + Math.imul(SEED, 0x9e3779b1)) | 0); }
// the MATCH's stream: everything that rolls while the match runs (and the
// beasts it starts with). The map is not made on it: see worldRng.
const rng = mulberry32(SEED);
function rand(a, b) { return a + rng() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
// Worldgen's streams: each pass that makes the map draws from its own,
// worldRng('ponds') and so on (the pass's name hashed into MAP_SEED), never
// from rng(). So a pass that changes (draws more or less, is added or cut)
// moves only its own layer; every other layer of the valley, and the match's
// stream, stay where they were. A stream carries its own rand and randi.
function worldRng(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  const r = mulberry32((MAP_SEED ^ h) >>> 0);
  r.rand = (a, b) => a + r() * (b - a);
  r.randi = (a, b) => Math.floor(r.rand(a, b + 1));
  return r;
}

// ------------------------------------------------------------ state
const state = {
  mode: 'title', // title | drop | play | dead  (drop = riding / falling from the eagle; dead = the local player is out of the match, or it is over)
  time: DAY_LEN * 0.25, // start mid-morning
  elapsed: 0,
  bearStacks: [0, 0], // black bears each side has slain: a buff that never runs out (BLACK_STACK_*, js/sim/wildlife.js)
  day: 1,
  tick: 0,       // sim steps taken; with SEED + player id it decides contested orders
  darkness: 0,
  // the weather's one wind field (the `wind` banner, js/sim/weather.js): windT is its
  // clock, wind its strength 0..1 - full by day, nothing at all by full dark -
  // and windDir which quarter it is running from, -1..1, veering over minutes
  wind: 0.7, windT: 0, windDir: 1,
  // the day's weather (the `weather` banner, js/sim/weather.js): the dials the air is
  // running on now, eased toward the day's row at dawn; wxForce is DBG's pin
  wx: { name: null, from: null, k: 1, snow: 1, wind: 1, gust: 1, sweep: 1, drift: 0, frost: 0 },
  wxForce: null,
  // seconds of sun shafts still owed at a match's start (matchHandOver sets it,
  // updateFx counts it down, rayLight reads it - js/draw/light.js)
  rayT: 0,
  deadTimer: 0,
  // out of the match: the overlay's state. over: 'lost' | 'won' | null; view:
  // 'menu' (the planks) | 'spec' (following a living player); spec: that player's
  // id; sel + hover: the planks' keyboard pick and per-plank hover eases
  over: null, deadView: 'menu', spec: -1, deadSel: 0, deadHover: [0, 0],
  // the replay window over a respawn wait has been closed (endMatch reopens it)
  rpClosed: false,
  // REPLAY on the defeat screen has the frame (deadActivate, js/ui/screens.js)
  rpAgain: false,
  // a win or an elimination freezes the numbers its end screen prints
  // (endSnapshot(), the victory banner); defeatT is the loss summary's own
  // clock, started when that view opens rather than when the player went down
  end: null, defeatT: 0,
  firstBlood: false, // the match's first player kill has been called (callKill, the `calls` banner, js/sim/player.js)
  paused: false,
  mapOpen: false,
  charOpen: false,     // the character panel (G): HUD, it does NOT stop the sim
  // the MERCHANT whose counter is open (js/shop.js), or null. HUD like the
  // panel above - the sim runs on underneath - and it holds the merchant itself
  // rather than a flag, because walking out of that body's reach is what shuts it.
  shop: null,
  settingsOpen: false,
  rebind: null,        // a cap on the CONTROLS page listening for its key: the action's id (input.js), or null
  // radial menu: { kind: 'ping'|..., tx, ty, seg, ax, ay } - ax/ay is the
  // press point; a ping wheel carries its world point wx/wy and its press
  // time t0, and one opened over the chart or the disc carries sx/sy, the
  // screen point it is pinned to (wheelLayout, js/ui/wheel.js)
  wheel: null,
  // the screens before a match (mode === 'title'): the open sub-panel
  // ('settings' | null) and its slide progress
  menu: { t: 0,
    panel: null, panelT: 0, closing: false,
    // the profile (screen 'profile', js/ui/profile.js; pfOver: up over an
    // ended match, pfBack the screen it returns to): charT its ease, pfTab
    // the open tab, pfWho whose profile (a pid, null yours), pfScroll the
    // list's scroll in px, pfOpen the open match's id, pfMode the filter (''
    // all), pfPick the picture picker up, pfSearch the search being typed
    // (null not), pfHot what the pointer is on; nameBuf the name field's
    // buffer, nameSel whether the next letter replaces it, nameEdit whether
    // the field is being typed in, nameShake its refusal rattle
    // the skins screen (js/ui/skins.js): skinT its ease, skTab the open
    // category (SKIN_TABS; it opens on the eagle), skSel the keyboard's card,
    // skNav the keyboard up on the navbar, skPick the card for sale picked for
    // a second press to buy, skHover the tabs' and cards' hover eases, skDeny
    // the short purse's shake, skFlash the buy's flash over card skFlashI
    skinT: 0, skTab: 0, skSel: 0, skNav: false, skKeyed: false, skPick: -1, skHover: {}, skDeny: 0, skFlash: 0, skFlashI: -1,
    charT: 0, nameBuf: '', nameSel: false, nameEdit: false, nameShake: 0,
    pfOver: false, pfBack: 'menu', pfTab: 0, pfWho: null, pfScroll: 0, pfOpen: '', pfMode: '', pfPick: false, pfSearch: null, pfHot: '',
    moved: false, keyNav: false, camT: 0, pressT: 0, // keyNav: the keys made the pick (it lights until the pointer moves)
    // lobby: which screen the menu shows, its cross-fade, the chosen hero
    // (csel, the hero row - js/ui/heroes.js), the stage's swap pop, lock-in hold.
    // screen: 'menu' | 'lobby' | 'hero' | 'wiki' | 'notes' | 'profile' | 'skins' | 'room'
    // ('room' is the party lobby, js/ui/rooms.js; 'lobby' the hero select).
    // 'hero' is the pop-up over the still-lit lobby: pop names it while open
    // (kept while it fades out) and popT is its ease; grow is its keyboard
    // row (the ability column); the wiki
    // is a surface of its own on wikiT, with wikiTab the open page (js/ui/wiki.js
    // `the wiki`); the patch notes are one too, on notesT, notesTab its open
    // tab (0 PATCH NOTES, 1 ROADMAP), notesSel the group the keys have picked
    // (js/ui/notes.js `patch notes`).
    screen: 'menu', screenT: 0, csel: 0, cswapT: 1, lockT: 0,
    // the lock-in's ring (lockFx, s left, champ-select.js `lobby`)
    lockFx: 0,
    // countT: seconds left of PLAY's countdown to the eagle (0 = not counting),
    // countN the last whole second it ticked on (-1 = never pressed, 0 = it
    // ran out)
    countT: 0, countN: -1,
    // the party lobby (js/ui/rooms.js): its ease, the open rooms a typed code
    // is looked up in and whether the list answered, the code being looked
    // for (seek), and a join under way. The CODE box (code, codeOn, codeShake)
    // starts empty here because a page booted to join (partyBootJoin) draws it
    // before any party screen has run
    roomsT: 0, rooms: [], seek: null, joining: false, code: '', codeOn: false, codeShake: 0,
    pop: null, popT: 0, grow: 0, wikiT: 0, wikiTab: 0, notesT: 0, notesTab: 0, notesSel: 0 },
  intro: 0,            // seconds left of the menu -> play transition (0 = none)
  introLen: 1,         // that transition's full length (the camera ease divides by it)
  introFrom: null,     // camera position the transition started from
  drop: null,          // the match's two eagles, { eagles }, from beginMatch on; null on the title (js/sim/eagle.js)
  fade: null,          // screen fade: { a, to, spd, color, then }
};

// volume is the master dial; musicVol and sfxVol sit under it (SFX.setVolume /
// setMusicVolume / setSfxVolume). A save written before the split simply has
// neither key and keeps the defaults - no version bump needed.
const settings = { v: 5, volume: 0.5, musicVol: 0.7, sfxVol: 1, mmSize: 1, hudScale: 1, muted: false, info: false, pixelCursor: true, hitbox: 0,
  // your side is painted BLUE and the rival side RED whatever team the roster
  // dealt you (skin(), js/sim/player.js); off = the roster's real colours
  teamBlue: true,
  // which of TEAM_PALETTES (js/sprites/core.js) the two sides wear: 'def',
  // or a repaint for colour-blind eyes - 'rg', 'by', 'hc'. applyTeamPal
  // puts it on the sprites; the COLOUR BLIND dropdown on the VIDEO page picks it
  teamPal: 'def',
  // the rival bots' difficulty: an index into AI_LEVELS (js/ai/ai-skill.js),
  // picked by the party's leader on the party screen and remembered; 1 (NORMAL) until someone moves it
  aiLevel: 1,
  // the VIDEO page's dressing toggles, all cosmetic-only passes a weak GPU
  // can shed (the ESC panel's QUALITY row presets them; panels.js)
  vidClouds: true, vidRays: true, vidStars: true, vidSnow: true, vidVig: true,
  // the VIDEO page's FPS CAP row: frames per second the loop may present, 0
  // = every frame the screen offers (capSkips, js/app/boot.js); the sim's step
  // is 1/60 whatever this says
  fpsCap: 0,
  // the VIDEO page's UI SIZE: the interface a step smaller (-1) or larger (1)
  // than the default (0), the world's view untouched (uiDevFor, js/app/canvas.js)
  uiSize: 0,
  // where the hover tooltip sits: true = it rides beside the pointer, false =
  // the fixed bottom-left corner it was born in (tipPos, js/ui/tooltip.js).
  tipFollow: true,
  // an ability's hover: false = the short card (the numbers at the rank you
  // hold), Shift held opens every rank's; true = every rank's always
  // (tipClassAb, js/ui/tooltip.js)
  tipFull: false,
  relay: '',          // the match relay (host:port) this screen talks to; empty = the page's own host (netRelay, js/net/net.js)
  // the keyboard scheme: 'wasd' (the keys walk, the mouse aims), 'click'
  // (the right button walks and orders - the `click to move` banner,
  // js/app/input.js). The CONTROLS page's top row; each scheme keeps its own
  // binds (settings.binds / bindsClick, mended by mendBinds).
  scheme: 'wasd',
  // the GAME page's size dials, one per HUD widget (hudSizes, js/ui/strip.js):
  // hudScale the bottom strip, hudRail the team rail along the top; the
  // minimap's is mmSize above (1 = MM_W_BASE px a side, applyMinimapSize)
  hudRail: 1 };
// pointer over the minimap's square, its frame included
function overMinimap() { return mouse.inside && overRect(mmFrameRect()); }

// performance monitor: fps averaged over half-second windows from raw
// (unclamped) frame deltas, so sim clamping can't mask slow frames; sim and
// draw are the ms a frame spent in update() and render() over the same
// window (the info stack's SIM and DRAW). DRAW is the script's side only:
// on a GPU canvas the pixels are drawn later, off the main thread.
const perf = { fps: 0, frames: 0, acc: 0, sim: 0, draw: 0, simAcc: 0, drawAcc: 0 };
function perfFrame(rawDt) {
  perf.frames++;
  perf.acc += rawDt;
  if (perf.acc < 0.5) return;
  perf.fps = Math.round(perf.frames / perf.acc);
  perf.sim = perf.simAcc / perf.frames;
  perf.draw = perf.drawAcc / perf.frames;
  perf.frames = 0;
  perf.acc = perf.simAcc = perf.drawAcc = 0;
}

// Settings live UNDER the profile - PROFILE.putSettings / PROFILE.settings,
// js/app/profile.js, the one file in the game that touches storage. A pre-profile
// save under the old 'softfall.settings' key is folded in by PROFILE.load()
// before this ever runs, so the migrations below still see it.
function saveSettings() { PROFILE.putSettings(settings, SETTINGS_LOCAL); }
// the settings that stay on this machine when the rest follow the Steam
// account to another PC (PROFILE.cloudSync): what this PC's screen and GPU
// want, and the relay it dials
const SETTINGS_LOCAL = ['uiSize', 'fpsCap', 'vidClouds', 'vidRays', 'vidStars', 'vidSnow', 'vidVig', 'relay'];
// repaint both sides in settings.teamPal: rebakes every team sprite in place
// (SPRITES.setTeamPal), a no-op when the palette is already on
function applyTeamPal() { SPRITES.setTeamPal(settings.teamPal); }
function loadSettings() {
  try {
    const s = PROFILE.settings(); // null when this profile has never saved any
    if (s) Object.assign(settings, s);
    delete settings.shake; // the screen shake and its toggle are gone (0.711)
    applyTeamPal();
    // ...and one from before EASY: its aiLevel counted from NORMAL, so a
    // saved level moves up one to stay the level it was
    if (s && (s.v | 0) < 3) {
      if (s.aiLevel != null) settings.aiLevel = (s.aiLevel | 0) + 1;
      settings.v = 3;
    }
    // ...and one from before the HUD's one size dial split: the rail keeps
    // the size the one dial gave it
    if (s && (s.v | 0) < 4) {
      if (s.hudScale != null) settings.hudRail = s.hudScale;
      settings.v = 4;
    }
    // ...and one from before the square minimap (0.964): the round disc's
    // radius dial (mmR, 24 = 100) becomes the square's size dial, and the
    // disc's zoom goes, since the square always shows the whole map
    if (s && (s.v | 0) < 5) {
      if (s.mmR != null) settings.mmSize = (s.mmR | 0) / 24;
      settings.v = 5;
    }
    delete settings.mmR; delete settings.mmZoom;
    settings.mmSize = Math.max(MM_SIZE_MIN, Math.min(MM_SIZE_MAX, Math.round((+settings.mmSize || 1) * 20) / 20));
  } catch (e) { }
}
// THE MINIMAP is a square of the whole played map in the BOTTOM-RIGHT
// corner, the League place, with the same gap to both edges (MM_GAP,
// measured from its outline). MM_X/MM_Y is the chart's own top-left and
// MM_W its side; the frame round it is MM_PAD px on three sides and
// MM_PAD_TOP on top, where the day band runs (mmFrameRect, js/ui/minimap.js).
const MM_GAP = 4;       // px of screen between the outline and either edge
const MM_PAD = 3;       // the frame past the chart: outline, edge, the chart's own dark rim
const MM_PAD_TOP = 5;   // ...and on top: outline, the 3 px day band, the rim
const MM_W_BASE = 112;  // the chart's side at 100 on the MINIMAP SIZE dial
const MM_SIZE_MIN = 0.6, MM_SIZE_MAX = 1.5; // the dial's reach (settings.mmSize)
function applyMinimapSize() {
  // never taller than leaves the top of the view to the news plates
  MM_W = Math.max(48, Math.min(Math.round(MM_W_BASE * settings.mmSize), Math.floor(VIEW_H * 0.55)));
  MM_X = VIEW_W - MM_GAP - MM_PAD - MM_W;
  MM_Y = VIEW_H - MM_GAP - MM_PAD - MM_W;
}
// recompute everything positioned off VIEW_W/VIEW_H; must run after any
// change to the canvas size (window resize, fullscreen)
function relayout() {
  applyMinimapSize();
  fitMapSlab();
  PANEL_X = Math.round((VIEW_W - PANEL_W) / 2);
  PANEL_Y = Math.round((VIEW_H - PANEL_H) / 2);
  MAP_X = PANEL_X + MAP_SIDE; MAP_Y = PANEL_Y + MAP_HEAD;
  SET_Y = Math.round((VIEW_H - SET_H) / 2);
  placeSlab(VIEW_W);
  fitFlakes();
  renderBars();
  layoutReplay();
}

// the settings slab centred over the first w px of the view (the party
// screen's room stands it left of the social column: slabCentre, menu.js),
// its sliders and mute with it
function placeSlab(w) {
  SET_X = Math.round((w - SET_W) / 2);
  SL_X = SET_X + 130;
  SET_MUTE_X = SL_X - 14;
}

// ------------------------------------------------------------ helpers
// A page event (a key, a click, a resize) waits for boot: its handler may call
// any global, and until boot.js runs, the files after the listener's own are
// still loading - a click or a resize mid-load threw ReferenceErrors on the
// web build. Files register here; boot.js attaches the lot with
// pageListenStart() once every global stands.
const PAGE_LISTENERS = [];
function pageListen(target, type, fn, opt) { PAGE_LISTENERS.push([target, type, fn, opt]); }
function pageListenStart() {
  for (const [target, type, fn, opt] of PAGE_LISTENERS) target.addEventListener(type, fn, opt);
  PAGE_LISTENERS.length = 0;
}

// seconds as M:SS - the HUD's match clock and the victory tally's, one source
function clockTxt(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// `o` is optional: { scale, rise, life } for a word bigger, faster or longer
// than a number's (the SHUTDOWN over a body, payTakedown js/sim/player.js)
function addFloater(x, y, txt, color, o) {
  evPush('float', [x, y, txt, color, o]); // the sim's cosmetics are recorded for screens that do not run it (js/net/events.js)
  floaters.push(Object.assign({ x, y, txt, color: color || '#ffffff', t: 0 }, o));
}

// Combat damage is ONE running total per body, worn beside its health bar
// (drawTally, js/draw/overhead.js) in that bar's colour: each hit adds to it,
// and a hit after TALLY_HOLD s of quiet starts a new one. A number per hit,
// rising out of the body, buried a bear under its own fight. The total and
// the tick of its last hit live on the body, so a save and a snapshot carry
// them like any other field, and the tick is the sim's, so a client fades it
// exactly as the host does.
const TALLY_HOLD = 1.0;  // s a total stands after its last hit (and the gap that starts a new one)
function tallyHit(u, amount) {
  const n = Math.max(1, Math.round(amount));
  if (!u.tallyN || (state.tick - u.tallyTick) * TICK_DT > TALLY_HOLD) u.tallyN = 0;
  u.tallyN += n;
  u.tallyTick = state.tick;
  u.tallyLast = n; // ...and this blow on its own: a big one draws its hit (js/draw/hitfx.js)
}


// `grav` true is the usual toss (a kick up, then a 90 px/s/s fall); a NUMBER
// is a fall that strength with no kick, for things that drift down rather
// than fly. `drift` is a steady sideways px/s the damping never takes (the
// wind carrying a pine's snow, js/sim/shed.js).
function burst(x, y, color, n, spd, life, grav, drift) {
  evPush('burst', [x, y, color, n, spd, life, grav, drift]);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = rand(0.3, 1) * (spd || 40);
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 - (grav === true ? 20 : 0),
      life: rand(0.5, 1) * (life || 0.5), maxLife: 0.4, color, size: rng() < 0.3 ? 2 : 1,
      grav: grav === true ? 90 : grav || 0, dx: drift || 0,
    });
  }
}

// a thin stream of motes from one point to another, each arriving as it
// fades (the ore's pull toward whoever is mining it, js/sim/mining.js)
function streamTo(x0, y0, x1, y1, color, n, life) {
  evPush('stream', [x0, y0, x1, y1, color, n, life]);
  for (let i = 0; i < n; i++) {
    const t = rand(0.7, 1) * (life || 0.4), sx = x0 + rand(-5, 5), sy = y0 + rand(-6, 2);
    particles.push({ x: sx, y: sy, vx: (x1 - sx) / t, vy: (y1 - sy) / t, life: t, maxLife: 0.15,
      color, size: 1, grav: 0, dx: 0 });
  }
}

// A COUNT ON THE HUD, cut to four characters. Gold has no ceiling any more -
// a purse climbs all match - so past a
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


